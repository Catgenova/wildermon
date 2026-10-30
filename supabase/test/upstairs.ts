/**
 * Settlement workers walk up a building's staircases to work a storey up, and back down.
 *
 * Asked: "allow wildermon to move up storeys when working along stairs". One settlement on its own island, rolled
 * back: a house of two storeys, a staircase up from the ground to the first, a wall with a door across that storey
 * and a chest on it behind the door; and a second building of two storeys with no staircase. On the island:
 *
 *   * a worker carrying a load to the chest goes to the foot of the flight, up it, across the floor through the door
 *     and puts the load in, and comes back down the flight to the ground;
 *   * every leg a storey up starts and ends on something to stand on, keeps to the floor and goes through no wall;
 *   * a store a storey up with no staircase is no store for it, and a leg to one is no leg: `stairs`, storey 2;
 *   * a hod carrier fits a planned wall a storey up standing on that storey, beside it;
 *   * one with work a storey up only in a building with no staircase says `stairs`, storey 2, and so does its card;
 *   * a floor taken away from under a worker lets it down; nothing stands a storey up with nothing under it; and one
 *     let off the settlement comes down.
 *
 * In the browser, the worker the island sends a storey up is drawn on that storey (`Game.creatureStorey`), a share of
 * the way up the flight it is climbing (`Game.creatureLift`), and walks on along the way it was sent (`walkLegs`);
 * and the card says the reason as the island does.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the settlement ------------------------------------------------------------- */

const T = 40;
const U = '7e5b0000-0000-4000-8000-0000000057a1';
/** The house: four tiles a side, two storeys. */
const HX = [T + 2, T + 5] as const;
const HY = [T + 2, T + 5] as const;
/** Its staircase up to storey 2, climbed northward: its foot the tile south of it, with no floor over it. */
const STAIR = [T + 3, T + 4] as const;
const WELL = [T + 3, T + 5] as const;
/** The chest on storey 2, behind a wall with a door in it. */
const CHEST = [T + 4, T + 2] as const;
/** The planned wall a storey up, on the north side of this tile. */
const PLAN = [T + 5, T + 3] as const;
/** The building with no staircase, its chest and its planned wall. */
const BX = [T - 7, T - 5] as const;
const BY = [T + 2, T + 4] as const;
const SHED_CHEST = [T - 6, T + 2] as const;
const SHED_PLAN = [T - 6, T + 3] as const;
/** The chest on the ground the hod carrier fetches from. */
const STORE = [T - 1, T - 1] as const;

const tiles = (xs: readonly [number, number], ys: readonly [number, number]): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let y = ys[0]; y <= ys[1]; y++) for (let x = xs[0]; x <= xs[1]; x++) out.push([x, y]);
  return out;
};
/** Floors on storey 2 (level 1): every house tile but the stairwell and the staircase's own. */
const FLOORS = tiles(HX, HY).filter(([x, y]) => !(x === WELL[0] && y === WELL[1]) && !(x === STAIR[0] && y === STAIR[1]));
/** Walls on storey 2: the house round, and across it at x = T + 4 with a door at y = T + 3. `h`: a tile's north side; `v`: its west. */
const WALLS: Array<{ dir: 'h' | 'v'; x: number; y: number; type: string }> = [];
for (let x = HX[0]; x <= HX[1]; x++) WALLS.push({ dir: 'h', x, y: HY[0], type: 'solid' }, { dir: 'h', x, y: HY[1] + 1, type: 'solid' });
for (let y = HY[0]; y <= HY[1]; y++) {
  WALLS.push({ dir: 'v', x: HX[0], y, type: 'solid' }, { dir: 'v', x: HX[1] + 1, y, type: 'solid' });
  WALLS.push({ dir: 'v', x: T + 4, y, type: y === T + 3 ? 'door' : 'solid' });
}
const solid = new Set(WALLS.filter((w) => w.type === 'solid').map((w) => `${w.dir},${w.x},${w.y}`));
const floored = new Set([...FLOORS, STAIR].map(([x, y]) => `${x},${y}`));

const sql = `
discard temp;
begin;
create temp table said (k text, v text);
create temp table legs (scn text, i int, fx float8, fy float8, tx float8, ty float8, sf int, st int, phase text,
                        carrying text, way jsonb, stands boolean, from_stands boolean, wall jsonb);
do $t$
declare w uuid; u uuid := '${U}'; v_id int; v_hod int; v_chest bigint; v_shed bigint; v_store bigint; r jsonb; c creature; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Upstairs', 377, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 12}, ${T + 12}) x, generate_series(${T - 12}, ${T + 12}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Stairs');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Upstairs', ${T}, ${T}, 12, 1, u);

  -- The house, its floors, its staircase and its walls a storey up.
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'House', 2, u), (w, 2, 'Shed', 2, u);
  insert into building_tile (world_id, building, x, y) values
    ${tiles(HX, HY).map(([x, y]) => `(w, 1, ${x}, ${y})`).join(', ')},
    ${tiles(BX, BY).map(([x, y]) => `(w, 2, ${x}, ${y})`).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${FLOORS.map(([x, y]) => `(w, 1, ${x}, ${y}, 1, 'plank', 'floor', null, '{}', '{}', u)`).join(', ')},
    (w, 1, ${STAIR[0]}, ${STAIR[1]}, 1, 'plank', 'stairs', 's', '{}', '{}', u),
    ${tiles(BX, BY).map(([x, y]) => `(w, 1, ${x}, ${y}, 2, 'plank', 'floor', null, '{}', '{}', u)`).join(', ')};
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${WALLS.map((wl) => `(w, 1, '${wl.dir}', ${wl.x}, ${wl.y}, 1, '${wl.type}', 'plank', '{}', '{}', u)`).join(', ')};
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, level) values
    (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u, 1) returning id into v_chest;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, level) values
    (w, 'furniture', 'chest', ${SHED_CHEST[0]}, ${SHED_CHEST[1]}, 0, 0, ${SHED_CHEST[0]} + 0.375, ${SHED_CHEST[1]} + 0.375, 40, u, 1) returning id into v_shed;

  -- The way up and across, as the rule has it.
  insert into said values ('WAY', array_to_string(creature_way(w, ${T - 3}, ${T}, 0, ${CHEST[0]}, ${CHEST[1]}, 1), ','));
  insert into said values ('DOWN', array_to_string(creature_way(w, ${CHEST[0]}, ${CHEST[1]}, 1, ${T - 3}, ${T}, 0), ','));
  insert into said values ('NOWAY', coalesce(array_to_string(creature_way(w, ${T - 3}, ${T}, 0, ${SHED_CHEST[0]}, ${SHED_CHEST[1]}, 1), ','), 'null'));

  /* A worker with a load for the chest a storey up: up, in, and down. */
  v_id := creature_spawn(w, 'bevere', ${T - 2} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'home', job = null, post = null,
         carrying = '{"def": "mortar", "count": 2, "ql": 30}'::jsonb,
         from_x = to_x, from_y = to_y, until = now() - interval '1 millisecond', leg_at = now() - interval '1 millisecond',
         leg_ends = now() - interval '1 millisecond'
   where world_id = w and id = v_id;
  -- The shed's chest, a storey up with no staircase, is no store of its: the house's is.
  select * into c from creature where world_id = w and id = v_id;
  insert into said select 'STORE', coalesce(s.id::text, 'none') from worker_store(w, c, 'mortar', 2) s;
  for i in 1..40 loop
    update creature set worn = 0, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_id;
    perform worker_settle(w, v_id);
    insert into legs select 'carry', i, from_x, from_y, to_x, to_y, storey_from, storey, phase, carrying->>'def', way,
           storey <= 0 or frame_stands(w, floor(to_x)::int, floor(to_y)::int, storey),
           storey_from <= 0 or frame_stands(w, floor(from_x)::int, floor(from_y)::int, storey_from), null
      from creature where world_id = w and id = v_id;
    if not exists (select 1 from said where k = 'SENT_WAY') then
      r := rpc_creatures(w, 40);
      insert into said select 'SENT_WAY', e::text from jsonb_array_elements(r) e where (e->>'id')::int = v_id and e ? 'way';
    end if;
    if not exists (select 1 from said where k = 'SENT_UP') then
      r := rpc_creatures(w, 40);
      insert into said select 'SENT_UP', e::text from jsonb_array_elements(r) e
       where (e->>'id')::int = v_id and (e->>'storeyFrom')::int = 0 and (e->>'storey')::int = 1;
    end if;
  end loop;
  insert into said select 'CHEST', coalesce(sum(count), 0)::text from item where world_id = w and placed = v_chest and def = 'mortar';

  /* A leg to the shed's chest: no way, and it says the storey. */
  select * into c from creature where world_id = w and id = v_id;
  c.storey := 0; c.storey_from := 0; c.way := null; c.phase := 'home';
  c.from_x := ${T - 3} + 0.5; c.from_y := ${T} + 0.5; c.to_x := ${SHED_CHEST[0]} + 0.375; c.to_y := ${SHED_CHEST[1]} + 0.375;
  c.leg_at := now(); c.leg_ends := now() + interval '5 seconds'; c.until := c.leg_ends;
  c := worker_way_leg(w, c, ${T - 3} + 0.5, ${T} + 0.5, 1.0, null);
  insert into said values ('SHED_LEG', c.idle_why || '|' || c.idle_n || '|' || c.to_x || ',' || c.to_y || '|' || c.phase);

  /* Falls: a floor taken from under it, a storey up with nothing under it, and let off the settlement. */
  update creature set storey = 1, storey_from = 1, way = null, phase = 'idle',
         from_x = ${T + 5} + 0.5, from_y = ${T + 5} + 0.5, to_x = ${T + 5} + 0.5, to_y = ${T + 5} + 0.5
   where world_id = w and id = v_id;
  insert into said select 'ON_FLOOR', storey::text from creature where world_id = w and id = v_id;
  delete from floor_tile where world_id = w and level = 1 and x = ${T + 5} and y = ${T + 5};
  insert into said select 'FLOOR_GONE', storey || '|' || storey_from from creature where world_id = w and id = v_id;
  update creature set storey = 1, storey_from = 1, from_x = ${T - 3} + 0.5, to_x = ${T - 3} + 0.5 where world_id = w and id = v_id;
  insert into said select 'NO_FLOOR', storey || '|' || storey_from from creature where world_id = w and id = v_id;
  update creature set storey = 1, storey_from = 1, from_x = ${CHEST[0]} + 0.5, from_y = ${CHEST[1]} + 0.5,
         to_x = ${CHEST[0]} + 0.5, to_y = ${CHEST[1]} + 0.5, way = '[[1, 1, 1, 1]]'
   where world_id = w and id = v_id;
  update creature set mode = 'active' where world_id = w and id = v_id;
  insert into said select 'LET_GO', storey || '|' || storey_from || '|' || coalesce(way::text, 'null') from creature where world_id = w and id = v_id;
  delete from creature where world_id = w and id = v_id;
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by)
    values (w, 1, ${T + 5}, ${T + 5}, 1, 'plank', 'floor', '{}', '{}', u);

  /* A hod carrier, its work a storey up in the shed with no staircase: it says so. */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values
    (w, 'furniture', 'chest', ${STORE[0]}, ${STORE[1]}, 0, 0, ${STORE[0]} + 0.375, ${STORE[1]} + 0.375, 40, u) returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'mortar', 30, 6);
  delete from item where world_id = w and placed = v_chest;
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 1, 'h', ${SHED_PLAN[0]}, ${SHED_PLAN[1]}, 2, 'solid', 'plank', '{"mortar": 1}', '{"mortar": 1}', u);
  v_hod := creature_spawn(w, 'cobbe', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         from_x = to_x, from_y = to_y, until = now() - interval '1 millisecond', leg_at = now() - interval '1 millisecond',
         leg_ends = now() - interval '1 millisecond'
   where world_id = w and id = v_hod;
  perform worker_settle(w, v_hod);
  insert into said select 'SHED_HOD', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || storey from creature where world_id = w and id = v_hod;
  r := rpc_creatures(w, 40);
  insert into said select 'SHED_SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') from jsonb_array_elements(r) e where (e->>'id')::int = v_hod;

  /* The house's planned wall a storey up: fitted standing on that storey, beside it. */
  delete from wall where world_id = w and level = 1 and x = ${SHED_PLAN[0]} and y = ${SHED_PLAN[1]} and dir = 'h';
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 1, 'h', ${PLAN[0]}, ${PLAN[1]}, 1, 'solid', 'plank', '{"mortar": 2}', '{"mortar": 2}', u);
  update creature set idle_why = null, idle_n = null where world_id = w and id = v_hod;
  for i in 1..80 loop
    update creature set worn = 0, hunger = 1, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_hod;
    perform worker_settle(w, v_hod);
    insert into legs select 'hod', i, from_x, from_y, to_x, to_y, storey_from, storey, phase, carrying->>'def', way,
           storey <= 0 or frame_stands(w, floor(to_x)::int, floor(to_y)::int, storey),
           storey_from <= 0 or frame_stands(w, floor(from_x)::int, floor(from_y)::int, storey_from),
           (select wl.needed from wall wl where wl.world_id = w and wl.level = 1 and wl.dir = 'h' and wl.x = ${PLAN[0]} and wl.y = ${PLAN[1]})
      from creature where world_id = w and id = v_hod;
  end loop;
end $t$;
select 'L=' || json_build_array(scn, i, fx, fy, tx, ty, sf, st, phase, carrying, way, stands, from_stands, wall)::text from legs order by scn, i;
select k || '=' || v from said;
rollback;
`;

const out = psql(sql).split('\n').filter((l) => l.includes('='));
const said = new Map(out.filter((l) => !l.startsWith('L=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
type Leg = { scn: string; i: number; fx: number; fy: number; tx: number; ty: number; sf: number; st: number; phase: string; carrying: string | null;
  way: unknown; stands: boolean; fromStands: boolean; wall: Record<string, number> | null };
const legs: Leg[] = out.filter((l) => l.startsWith('L=')).map((l) => {
  const [scn, i, fx, fy, tx, ty, sf, st, phase, carrying, way, stands, fromStands, wall] = JSON.parse(l.slice(2));
  return { scn, i, fx, fy, tx, ty, sf, st, phase, carrying, way, stands, fromStands, wall };
});
const at = (k: string): string => said.get(k) ?? '?';
const tile = (x: number): number => Math.floor(x);
const triples = (s: string): number[][] => {
  const n = s.split(',').filter(Boolean).map(Number);
  const out: number[][] = [];
  for (let i = 0; i + 2 < n.length; i += 3) out.push([n[i], n[i + 1], n[i + 2]]);
  return out;
};

/** The walls a straight leg across a storey goes through, tile by tile. */
const throughWalls = (l: Leg): string[] => {
  const hits: string[] = [];
  let [x, y] = [tile(l.fx), tile(l.fy)];
  const [x1, y1] = [tile(l.tx), tile(l.ty)];
  for (let n = 0; n < 40 && (x !== x1 || y !== y1); n++) {
    const dx = Math.sign(x1 - x);
    const dy = dx ? 0 : Math.sign(y1 - y);
    const border = dx > 0 ? `v,${x + 1},${y}` : dx < 0 ? `v,${x},${y}` : dy > 0 ? `h,${x},${y + 1}` : `h,${x},${y}`;
    if (solid.has(border)) hits.push(border);
    x += dx;
    y += dy;
    if (!floored.has(`${x},${y}`) && (x !== x1 || y !== y1)) hits.push(`off the floor at ${x},${y}`);
  }
  return hits;
};

/* ---- the island: the way ------------------------------------------------------------ */

{
  const way = triples(at('WAY'));
  const last = way[way.length - 1] ?? [];
  check('the way up: to the foot of the flight on the ground, up it, through the door, to the chest',
    way.length > 2 && way[0][0] === WELL[0] && way[0][1] === WELL[1] && way[0][2] === 0 && way[1][0] === STAIR[0] && way[1][1] === STAIR[1] && way[1][2] === 1
      && way.some(([x, y, l]) => x === T + 4 && y === T + 3 && l === 1) && last[0] === CHEST[0] && last[1] === CHEST[1] && last[2] === 1,
    at('WAY'));
  const down = triples(at('DOWN'));
  check('and down: through the door, onto the flight at its head, off its foot onto the ground',
    down.some(([x, y, l]) => x === STAIR[0] && y === STAIR[1] && l === 1) && down[down.length - 1]?.[0] === WELL[0]
      && down[down.length - 1]?.[1] === WELL[1] && down[down.length - 1]?.[2] === 0, at('DOWN'));
  check('no way up a building with no staircase', at('NOWAY') === 'null', at('NOWAY'));
}

/* ---- the island: up with a load, and down -------------------------------------------- */

{
  const carry = legs.filter((l) => l.scn === 'carry');
  const up = carry.find((l) => l.sf === 0 && l.st === 1);
  const atChest = carry.find((l) => l.st === 1 && tile(l.tx) === CHEST[0] && tile(l.ty) === CHEST[1]);
  const upI = up?.i ?? 1e9;
  const down = carry.find((l) => l.i > (atChest?.i ?? 1e9) && l.sf === 1 && l.st === 0);
  check('the house\'s chest is a store for it, the shed\'s is not', at('STORE') !== 'none' && at('STORE') !== '?', at('STORE'));
  check('a worker with a load for the chest a storey up walks up the flight to it',
    !!up && tile(up.fx) === WELL[0] && tile(up.fy) === WELL[1] && tile(up.tx) === STAIR[0] && tile(up.ty) === STAIR[1] && !!atChest && atChest.i > upI,
    up ? `up at leg ${up.i} to ${tile(up.tx)},${tile(up.ty)}; at the chest at leg ${atChest?.i}` : 'never up');
  check('and puts the load in it', at('CHEST') === '2', `${at('CHEST')} mortar in the chest`);
  check('and comes back down the flight to the ground',
    !!down && tile(down.fx) === STAIR[0] && tile(down.fy) === STAIR[1] && tile(down.tx) === WELL[0] && tile(down.ty) === WELL[1],
    down ? `down at leg ${down.i} from ${tile(down.fx)},${tile(down.fy)} to ${tile(down.tx)},${tile(down.ty)}` : 'never down');
  const all = legs.filter((l) => l.sf > 0 || l.st > 0);
  const unstood = all.filter((l) => !l.stands || !l.fromStands);
  check('every leg a storey up starts and ends on something to stand on', all.length > 0 && !unstood.length,
    unstood.map((l) => `${l.scn} ${l.i}`).join(' '));
  const walled = all.filter((l) => l.sf === l.st && l.st > 0).flatMap((l) => throughWalls(l).map((h) => `${l.scn} ${l.i}: ${h}`));
  check('and keeps to the floor and through no wall', !walled.length, walled.join('; '));
}

check('a leg to the chest in the shed with no staircase: none, and why: storey 2',
  at('SHED_LEG') === `stairs|2|${T - 3 + 0.5},${T + 0.5}|idle`, at('SHED_LEG'));
check('a floor taken away from under it: let down to the ground', at('ON_FLOOR') === '1' && at('FLOOR_GONE') === '0|0', `${at('ON_FLOOR')} → ${at('FLOOR_GONE')}`);
check('nothing stands a storey up with nothing under it', at('NO_FLOOR') === '0|0', at('NO_FLOOR'));
check('let off the settlement, it comes down', at('LET_GO') === '0|0|null', at('LET_GO'));

/* ---- the island: the hod carrier ------------------------------------------------------ */

{
  const [why, n] = at('SHED_HOD').split('|');
  check('a hod carrier with work a storey up only in a building with no staircase: stairs, storey 2',
    why === 'stairs' && n === '2', at('SHED_HOD'));
  check('and the island sends it so', at('SHED_SENT') === 'stairs|2', at('SHED_SENT'));
  const hod = legs.filter((l) => l.scn === 'hod');
  const fits = hod.filter((l, k) => k > 0 && (l.wall?.mortar ?? 0) < (hod[k - 1].wall?.mortar ?? 2));
  const first = hod.find((l) => (l.wall?.mortar ?? 2) < 2);
  const beside = (l: Leg): boolean => l.st === 1 && tile(l.tx) === PLAN[0] && (tile(l.ty) === PLAN[1] || tile(l.ty) === PLAN[1] - 1);
  check('a hod carrier fits a planned wall a storey up', hod.length > 0 && (hod[hod.length - 1].wall?.mortar ?? 2) === 0,
    `mortar wanted at the end: ${hod[hod.length - 1]?.wall?.mortar}`);
  check('standing on that storey, beside it, each piece',
    !!first && fits.length > 0 && fits.every((l) => beside(hod[hod.indexOf(l) - 1]) || beside(l)),
    fits.map((l) => { const p = hod[hod.indexOf(l) - 1]; return `leg ${l.i}: storey ${p.st} at ${tile(p.tx)},${tile(p.ty)}`; }).join('; '));
}

/* ---- the browser ---------------------------------------------------------------------- */

{
  const g = Game.create(4377);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.creatures.fromIsland = true;
  const sentUp = JSON.parse(said.get('SENT_UP') ?? 'null') as IslandCreature | null;
  const sentWay = JSON.parse(said.get('SENT_WAY') ?? 'null') as IslandCreature | null;
  check('the island sends the storey, the storey the leg starts at and the way', !!sentUp && !!sentWay?.way?.length,
    `${said.get('SENT_UP')?.slice(0, 80)} / ${sentWay?.way?.length}`);
  if (sentUp) {
    g.creatures.sawAll([sentUp], g.time);
    const c = g.creatures.get(sentUp.id)!;
    const now = Date.now();
    c.legAt = now - 1000;
    c.legEnds = now + 3000;
    const quarter = g.creatureLift(c);
    check('a worker a quarter of the way up a flight: drawn a quarter of a storey up, on the storey it came from',
      Math.abs(quarter - 0.25) < 0.05 && g.creatureStorey(c) === 0, `${quarter.toFixed(2)}, storey ${g.creatureStorey(c)}`);
    c.legAt = now - 4000;
    c.legEnds = now - 1;
    check('at the head of the flight: on the storey it climbed to', g.creatureLift(c) === 1 && g.creatureStorey(c) === 1,
      `${g.creatureLift(c)}, storey ${g.creatureStorey(c)}`);
  }
  if (sentWay?.way?.length) {
    g.creatures.sawAll([sentWay], g.time);
    const c = g.creatures.get(sentWay.id)!;
    const next = sentWay.way[0];
    c.legEnds = Date.now() - 1;
    c.legAt = c.legEnds - 1000;
    g.creatures.update(0.016, g);
    check('off the end of its leg, it walks on along the way it was sent',
      c.legToX === next[0] && c.legToY === next[1] && (c.storey ?? 0) === next[2] && c.way?.length === sentWay.way.length - 1,
      `to ${c.legToX},${c.legToY} storey ${c.storey}; ${c.way?.length} left of ${sentWay.way.length}`);
  }
  const says = idleSays({ why: 'stairs', n: 2 }, 'hod');
  check('the card says it: no stairs up to storey 2', says === 'Idle: no stairs up to storey 2.', says);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nworkers walk up a building's staircases to their work — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
