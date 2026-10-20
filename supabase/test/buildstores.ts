/**
 * Building out of the wagon beside it.
 *
 * Asked: "building a wall or other building actions should also be able to
 * draw materials from wagon or nearby storage within 3 tiles".
 *
 * A body with nothing in the pack but a mallet stands by a log wall planned on
 * its tile and the open span of a wooden bridge. Somebody else's wagon two
 * tiles off, off any settlement, holds logs and planks: a vehicle is anybody's
 * to load and to empty, so it is anybody's to build out of. Asked of both
 * sides, the same spread:
 *
 *   * a go at the wall is allowed and takes a log out of the wagon;
 *   * a go at the span is allowed and takes a plank out of the wagon;
 *   * with "Use stores within reach" off, each is refused, the span saying it
 *     has no plank to hand;
 *   * and with the wagon four tiles off, past `CRAFT_REACH`, the wall is
 *     refused and nothing is taken.
 *
 * The island half runs against the database the suite leaves behind, in one
 * transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import type { Bridge } from '../../src/game/bridges';
import { buildReach } from '../../src/game/buildActions';
import { Game } from '../../src/game/game';
import type { Item } from '../../src/game/items';
import { CRAFT_REACH } from '../../src/game/recipes';

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

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
let spot: [number, number] | null = null;
for (let r = 0; r < 80 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      const [x, y] = [64 + dx, 64 + dy];
      let dry = true;
      for (let j = -2; j <= 4 && dry; j++) {
        for (let i = -2; i <= 6 && dry; i++) dry = game.world.isPassable(x + i, y + j) && !game.world.hasWater(x + i, y + j);
      }
      if (dry) {
        spot = [x, y];
        break;
      }
    }
  }
}
const [px, py] = spot ?? [64, 64];
game.player.x = px + 0.5;
game.player.y = py + 0.5;
for (const c of [...game.crates.values()]) game.removeCrate(c.id);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
const pack = game.inventory;
for (const it of [...pack.items]) pack.remove(it.uid, it.count);
pack.add('mallet', { ql: 50 });
const stack = (id: string, count: number): Item => ({ uid: pack.nextUid++, id, ql: 30, dmg: 0, count });

const wall = game.buildings.setFence(px, py, 'n', 'solid', 'log');
const wagon = game.addFurniture('wagon', px + 2, py, 0, 0, 40, [stack('log', 3), stack('plank', 2)], 'Pine');
wagon.mine = false;
const bridge = {
  id: 9001, kind: 'wood', ax: px, ay: py + 3, bx: px + 3, by: py + 3, height: 40, level: 0,
  spans: [{ x: px + 1, y: py + 3, needed: { plank: 2 }, total: { plank: 2 } }],
} as unknown as Bridge;
game.bridges.set(bridge.id, bridge);

const inWagon = (id: string): number => wagon.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const ask = (id: string, t: Target): string => ACTION_BY_ID.get(id)?.check?.(t, game) ?? 'ALLOWED';
const go = (id: string, t: Target): void => void ACTION_BY_ID.get(id)?.perform(t, game);
const side: Target = { kind: 'tile', x: px, y: py, side: 'n' } as Target;
const span: Target = { kind: 'bridge', id: bridge.id } as Target;

game.settings.fromStores = true;
const sim: Record<string, string> = {};
sim.REACH = String(buildReach(game, undefined));
sim.WALL_ASK = ask('build_wall', side);
go('build_wall', side);
sim.WALL = `${inWagon('log')},${wall.needed.log}`;
sim.SPAN_ASK = ask('build_bridge', span);
go('build_bridge', span);
sim.SPAN = `${inWagon('plank')},${bridge.spans[0].needed.plank}`;
game.settings.fromStores = false;
sim.WALL_OFF = ask('build_wall', side);
sim.SPAN_OFF = ask('build_bridge', span);
game.settings.fromStores = true;
wagon.x = px + 4;
game.placed.furniture.remove(wagon);
game.placed.furniture.add(wagon);
sim.WALL_FAR = ask('build_wall', side);
go('build_wall', side);
sim.FAR = `${inWagon('log')},${wall.needed.log}`;

const LOGS = wall.total.log;
check('the reach is the three tiles asked for, on both sides', Number(sim.REACH) === CRAFT_REACH && CRAFT_REACH === 3, sim.REACH);
check('in the browser: a go at the wall is allowed and lays a log out of somebody else\'s wagon two tiles off',
  sim.WALL_ASK === 'ALLOWED' && sim.WALL === `2,${LOGS - 1}`, `${sim.WALL_ASK} ${sim.WALL}`);
check('and a go at a bridge\'s span decks a plank out of it',
  sim.SPAN_ASK === 'ALLOWED' && sim.SPAN === '1,1', `${sim.SPAN_ASK} ${sim.SPAN}`);
check('with stores turned off, both are refused, the span having no plank to hand',
  sim.WALL_OFF.startsWith('Need ') && sim.SPAN_OFF === 'Span needs 1 plank; no plank to hand.', `${sim.WALL_OFF} / ${sim.SPAN_OFF}`);
check('a wagon four tiles off is past reach: the wall is refused and nothing is taken',
  sim.WALL_FAR.startsWith('Need ') && sim.FAR === `2,${LOGS - 1}`, `${sim.WALL_FAR} ${sim.FAR}`);

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; them uuid := gen_random_uuid(); v_x int; v_y int; v_b int; v_wagon bigint; v_bridge bigint;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  -- Somewhere no settlement covers, with room round it.
  select gx, gy into v_x, v_y
    from generate_series(20, 200, 7) gx, generate_series(20, 200, 7) gy
   where not exists (select 1 from deed d where d.world_id = w
                      and abs(d.x - gx) <= d.radius + 8 and abs(d.y - gy) <= d.radius + 8)
   order by gx, gy limit 1;
  update player set x = v_x + 0.5, y = v_y + 0.5, act = null, act_queue = '[]'::jsonb, craft_from_stores = true,
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid = me;
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  delete from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = me;
  perform give(w, me, 'mallet', 1, 50);
  insert into said values ('REACH', build_reach(w, me, null)::text);

  -- A log wall planned on the north side of the tile.
  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, planned_by) values (w, v_b, 'Shed', me);
  insert into building_tile (world_id, building, x, y) values (w, v_b, v_x, v_y);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, 0, bd.dir, bd.x, bd.y, v_b, 'solid', 'log', wall_bill('log', 'solid'), wall_bill('log', 'solid'), me
    from border_of(v_x, v_y, 'n') bd;
  -- Somebody else's wagon two tiles off, with logs and planks in it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, material, made_by)
    values (w, 'furniture', 'wagon', v_x + 2, v_y, 0, 0, v_x + 2.5, v_y + 0.5, 40, 'Pine', them) returning id into v_wagon;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_wagon, 'log', 30, 3), (w, 'furniture', v_wagon, 'plank', 30, 2);
  -- A wooden bridge's open span three tiles south.
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level)
    values (w, 'wood', v_x, v_y + 3, v_x + 3, v_y + 3, 40, me, 0) returning id into v_bridge;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    values (w, v_bridge, 1, v_x + 1, v_y + 3, '{"plank": 2}', '{"plank": 2}');

  insert into said values ('WALL_ASK', coalesce(act_refusal(w, me, 'build_wall',
    jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n')), 'ALLOWED'));
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n'));
  insert into said values ('WALL', (select coalesce(sum(count), 0) from item where placed = v_wagon and def = 'log')
    || ',' || ((wall_at(w, v_x, v_y, 'n')).needed->>'log'));
  insert into said values ('SPAN_ASK', coalesce(act_refusal(w, me, 'build_bridge', jsonb_build_object('kind', 'bridge', 'id', v_bridge)), 'ALLOWED'));
  perform act_perform(w, me, 'build_bridge', jsonb_build_object('kind', 'bridge', 'id', v_bridge));
  insert into said values ('SPAN', (select coalesce(sum(count), 0) from item where placed = v_wagon and def = 'plank')
    || ',' || (select needed->>'plank' from bridge_span where world_id = w and bridge = v_bridge and n = 1));

  update player set craft_from_stores = false where world_id = w and uid = me;
  insert into said values ('WALL_OFF', coalesce(act_refusal(w, me, 'build_wall',
    jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n')), 'ALLOWED'));
  insert into said values ('SPAN_OFF', coalesce(act_refusal(w, me, 'build_bridge', jsonb_build_object('kind', 'bridge', 'id', v_bridge)), 'ALLOWED'));
  update player set craft_from_stores = true where world_id = w and uid = me;

  update placed set x = v_x + 4, cx = v_x + 4.5 where id = v_wagon;
  insert into said values ('WALL_FAR', coalesce(act_refusal(w, me, 'build_wall',
    jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n')), 'ALLOWED'));
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n'));
  insert into said values ('FAR', (select coalesce(sum(count), 0) from item where placed = v_wagon and def = 'log')
    || ',' || ((wall_at(w, v_x, v_y, 'n')).needed->>'log'));
end $$;
select k || '=' || v from said;
rollback;
`);
const island: Record<string, string> = {};
for (const line of isle.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) island[line.slice(0, i)] = line.slice(i + 1);
}

check('on the island, the same reach', Number(island.REACH) === CRAFT_REACH, island.REACH);
for (const k of ['WALL_ASK', 'WALL', 'SPAN_ASK', 'SPAN', 'WALL_OFF', 'SPAN_OFF', 'WALL_FAR', 'FAR']) {
  check(`on the island as in the browser: ${k}`, island[k] === sim[k], `island ${island[k]} / browser ${sim[k]}`);
}

/* ---- what was found ------------------------------------------------------------------------------- */

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nbuilding out of the stores — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
