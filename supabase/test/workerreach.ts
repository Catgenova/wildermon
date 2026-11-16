/**
 * A worker reaches every storey tile the player reaches, by the player's own step rule, and works what it reaches.
 *
 * Reported: "my bastiondrakes keep getting caught on the same nonsensical idle error "no pathway to storey 4"
 * despite multiple fix attempts. I'm able to navigate my player to every spot of my estate." The card's line is
 * "Idle: no stairs up to storey 4." (`stairs`).
 *
 * Solara Manor's layout, read off the island (`manorbridge.json`): two buildings of four storeys, the west one's
 * flights all finished, the east one's last flight (to storey 4) only planned, and a marble bridge three lanes wide
 * between their storey-4 floors. The player walks up the west building and over the bridge onto the east one's storey 4
 * (`manorbridge.ts`). And an annex of the other ways a body gets up a storey: a flight stepped off at its side, the
 * floor of the building next door, a ramp from one storey to another, a ramp up from the ground; and a loft with only a
 * ladder up, which a beast does not climb. Each moved into a small island of its own, on both sides:
 *
 *   * every tile a storey up the player reaches from the ground (the browser's `stepRule`, `liftRule`) the island's
 *     way for a worker (`creature_way`) reaches from the same ground and back down, and its own reach
 *     (`storey_reached`) says so; and a tile a storey up the player does not reach, nor does the worker;
 *   * on the manor, walls planned on the east building's storey 4 and mortar in a chest on the ground: a hod carrier
 *     goes up the west building, over the bridge, fits every one, and comes back down, and never says `stairs` or
 *     `stranded`; with no bridge, `stairs`, storey 4;
 *   * up the ladder only: `stairs`, storey 2, as the help says.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Game } from '../../src/game/game';
import type { Bridge } from '../../src/game/bridges';
import type { BuildingsJSON, FloorKind, Wall } from '../../src/game/building';
import { TileType } from '../../src/world/tiles';
import { check, finish, psql } from './harness';

type Floor = { b: number; level: number; x: number; y: number; kind: FloorKind; facing?: string; done: boolean };
type WallRow = { b: number; level: number; dir: 'h' | 'v'; x: number; y: number; type: string; material: string; done: boolean; lowered?: boolean };
type Span = { ax: number; ay: number; bx: number; by: number; level: number; levelB?: number; width: number };
type Estate = { buildings: Array<{ id: number; name: string; levels: number; tiles: Array<[number, number]> }>; floors: Floor[]; walls: WallRow[]; bridges: Span[] };
type Cell = [number, number, number];
type Box = { x0: number; x1: number; y0: number; y1: number };

const U = '7e5b0000-0000-4000-8000-0000b1a5d0e5';
const at = (x: number, y: number, l: number): string => `${x},${y},${l}`;
const SIZE = 64;

/* ---- the manor ---------------------------------------------------------------- */

type Row = { buildings: Array<{ id: number; name: string; levels: number }>;
  tiles: Array<[number, number, number, boolean | null]>;
  floors: Array<[number, number, number, number, string, string | null, string, boolean]>;
  walls: Array<[number, number, string, number, number, string, string, boolean, boolean | null]> };
/** Read from the repository's root, where the suite runs, wherever the test is bundled to. */
const M = JSON.parse(readFileSync(resolve('supabase/test/manorbridge.json'), 'utf8')) as Row;
/** Moved into a small island: the live coordinates less these. */
const OX = 2550, OY = 2980;
/** Storey 4, as both sides count storeys: the ground is nought. */
const UP = 3;
/** The bridge, its ends on the west building's (6) storey-4 floor and the east one's (5). */
const AX = 2573 - OX, BX = 2579 - OX, Y = 3006 - OY;
const IDS = new Set([5, 6]);
const manor = (bridge: boolean): Estate => ({
  buildings: M.buildings.filter((b) => IDS.has(b.id)).map((b) => ({ id: b.id, name: b.name, levels: b.levels,
    tiles: M.tiles.filter((t) => t[0] === b.id).map((t) => [t[1] - OX, t[2] - OY] as [number, number]) })),
  floors: M.floors.filter((f) => IDS.has(f[0])).map(([b, level, x, y, kind, facing, , done]) =>
    ({ b, level, x: x - OX, y: y - OY, kind: kind as FloorKind, ...(facing ? { facing } : {}), done })),
  walls: M.walls.filter((w) => IDS.has(w[0])).map(([b, level, dir, x, y, type, material, done, lowered]) =>
    ({ b, level, dir: dir as 'h' | 'v', x: x - OX, y: y - OY, type, material, done, ...(lowered ? { lowered } : {}) })),
  bridges: bridge ? [{ ax: AX, ay: Y, bx: BX, by: Y, level: UP, width: 3 }] : [],
});
/** Where the worker and the player start: the ground east of the manor. */
const FROM = { x: 2588 - OX, y: 3008 - OY };
const STORE = { x: 2586 - OX, y: 3010 - OY };
const MANOR_BOX: Box = { x0: 2562 - OX, x1: 2592 - OX, y0: 2998 - OY, y1: 3014 - OY };
/** Planned on the east building's storey 4: walls along its north and south sides, a mortar each. */
const PLANNED: Array<['h', number, number]> = [];
for (let x = 2579 - OX; x <= 2581 - OX; x++) PLANNED.push(['h', x, 3005 - OY], ['h', x, 3008 - OY]);

/* ---- the annex ------------------------------------------------------------------- */

const square = (x0: number, y0: number, n = 3): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) out.push([x, y]);
  return out;
};
const storeys = (b: number, tiles: Array<[number, number]>, levels: number[], but: Floor[] = []): Floor[] => {
  const out: Floor[] = [];
  for (const level of levels) for (const [x, y] of tiles) {
    const s = but.find((f) => f.level === level && f.x === x && f.y === y);
    out.push(s ?? { b, level, x, y, kind: 'floor', done: true });
  }
  return out;
};
const flight = (b: number, level: number, x: number, y: number, facing: string, kind: FloorKind = 'stairs'): Floor => ({ b, level, x, y, kind, facing, done: true });
/** Its buildings' tiles. */
const SIDE = square(6, 6), NEXT = square(14, 6), DOOR = square(17, 6), LOW = square(6, 20), HIGH = square(14, 20), RAMPED = square(24, 20), LOFT = square(30, 6);
const annex: Estate = {
  buildings: [
    { id: 1, name: 'Side Stair', levels: 2, tiles: SIDE },
    { id: 2, name: 'Tower', levels: 2, tiles: NEXT },
    { id: 3, name: 'Hall', levels: 2, tiles: DOOR },
    { id: 4, name: 'Low', levels: 3, tiles: LOW },
    { id: 5, name: 'High', levels: 4, tiles: HIGH },
    { id: 6, name: 'Ramped', levels: 2, tiles: RAMPED },
    { id: 7, name: 'Loft', levels: 2, tiles: LOFT },
  ],
  floors: [
    // A flight climbed from the south, a wall across its head on storey 2: stepped off at its sides.
    ...storeys(1, SIDE, [1], [flight(1, 1, 7, 7, 's')]),
    // A tower with a flight up, and the hall beside it with none: its storey 2 walked onto from the tower's.
    ...storeys(2, NEXT, [1], [flight(2, 1, 15, 7, 's')]),
    ...storeys(3, DOOR, [1]),
    // Up two storeys of the low building, and a ramp from its storey 3 up to the high one's storey 4.
    ...storeys(4, LOW, [1, 2], [flight(4, 1, 7, 21, 's'), flight(4, 2, 7, 20, 's')]),
    ...storeys(5, HIGH, [1, 2, 3]),
    // A ramp up from the ground onto storey 2, and no staircase.
    ...storeys(6, RAMPED, [1]),
    // A ladder up, and nothing else.
    ...storeys(7, LOFT, [1], [flight(7, 1, 31, 7, 's', 'ladder')]),
  ],
  walls: [
    { b: 1, level: 1, dir: 'h', x: 7, y: 7, type: 'solid', material: 'plank', done: true },
    // The hall's wall off the tower's storey 2, a door in it.
    { b: 3, level: 1, dir: 'v', x: 17, y: 6, type: 'solid', material: 'plank', done: true },
    { b: 3, level: 1, dir: 'v', x: 17, y: 7, type: 'door', material: 'plank', done: true },
    { b: 3, level: 1, dir: 'v', x: 17, y: 8, type: 'solid', material: 'plank', done: true },
  ],
  bridges: [
    { ax: 8, ay: 21, bx: 14, by: 21, level: 2, levelB: 3, width: 1 },
    { ax: 19, ay: 21, bx: 24, by: 21, level: 0, levelB: 1, width: 1 },
  ],
};
const ANNEX_FROM = { x: 3, y: 14 };
const ANNEX_BOX: Box = { x0: 1, x1: 36, y0: 2, y1: 26 };

/* ---- the browser: where the player gets to ------------------------------------ */

const g = Game.create(4242, SIZE);
for (let x = 0; x <= SIZE; x++) for (let y = 0; y <= SIZE; y++) g.world.setHeight(x, y, 20);
for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) g.world.setTile(x, y, TileType.Grass, 0);
const done = { needed: {}, total: {} };
const short = { needed: { plank: 1 }, total: { plank: 1 } };
const spans = (s: Span): Array<{ x: number; y: number }> => {
  const out: Array<{ x: number; y: number }> = [];
  if (s.ay === s.by) for (let x = Math.min(s.ax, s.bx) + 1; x < Math.max(s.ax, s.bx); x++) out.push({ x, y: s.ay });
  else for (let y = Math.min(s.ay, s.by) + 1; y < Math.max(s.ay, s.by); y++) out.push({ x: s.ax, y });
  return out;
};

/** Every tile at every storey a body walks to from a tile, four ways round, and up and down spirals (`stepRule`, `liftRule`). */
const walk = (from: Cell, box: Box, until?: (c: Cell) => boolean): Set<string> => {
  const seen = new Set<string>([at(...from)]);
  const q: Cell[] = [from];
  while (q.length) {
    const [x, y, l] = q.shift()!;
    const next: Cell[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < box.x0 || nx > box.x1 || ny < box.y0 || ny > box.y1) continue;
      const nl = g.stepRule(x, y, l, nx, ny);
      if (nl !== null) next.push([nx, ny, nl]);
    }
    for (const nl of g.liftRule(x, y, l)) next.push([x, y, nl]);
    for (const n of next) {
      if (seen.has(at(...n))) continue;
      seen.add(at(...n));
      if (until?.(n)) return seen;
      q.push(n);
    }
  }
  return seen;
};

/**
 * The tiles a storey up the player walks to from a tile on the ground (`up`), and of those, the ones from which they
 * walk back down to the ground (`down`).
 */
const playerReach = (e: Estate, from: { x: number; y: number }, box: Box): { up: Cell[]; down: Set<string> } => {
  const json: BuildingsJSON = {
    nextId: 100,
    list: e.buildings.map((b) => ({ id: b.id, name: b.name, levels: b.levels, tiles: b.tiles.map(([x, y]) => `${x},${y}`) })) as never,
    walls: e.walls.map((w) => ({ building: w.b, level: w.level, dir: w.dir, x: w.x, y: w.y, type: w.type, material: w.material,
      ...(w.done ? done : short), ...(w.lowered ? { lowered: true } : {}) }) as unknown as Wall),
    floors: e.floors.map((f) => ({ building: f.b, level: f.level, x: f.x, y: f.y, kind: f.kind, ...(f.facing ? { facing: f.facing } : {}),
      material: 'marble', ...(f.done ? done : short) }) as never),
  };
  g.bridges.clear();
  g.buildings.sawIsland(json as never);
  e.bridges.forEach((s, i) => {
    const b = { id: i + 1, kind: 'marble', ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, height: 91, level: s.level,
      ...(s.levelB !== undefined ? { levelB: s.levelB } : {}), width: s.width, side: 1, rise: 0,
      spans: spans(s).map((p) => ({ ...p, needed: {}, total: {} })) } as unknown as Bridge;
    g.bridges.set(b.id, b);
  });
  g.reindexDecks();
  const up = [...walk([from.x, from.y, 0], box)].map((k) => k.split(',').map(Number) as Cell).filter(([, , l]) => l >= 1)
    .sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const down = new Set(up.filter((c) => [...walk(c, box, ([, , l]) => l === 0)].some((k) => k.endsWith(',0'))).map((c) => c.join(',')));
  return { up, down };
};

/* ---- the island ------------------------------------------------------------------ */

const estateSql = (e: Estate, from: { x: number; y: number }, box: Box): string => `
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Solara', 655, ${SIZE}, ${from.x}, ${from.y}, true) returning id into w;
  perform land_blank(w, ${SIZE});
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, ${SIZE - 1}) x, generate_series(0, ${SIZE - 1}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Solara');
  insert into deed (world_id, name, x, y, radius, level, founded_by)
    values (w, 'Solara', ${Math.round((box.x0 + box.x1) / 2)}, ${Math.round((box.y0 + box.y1) / 2)}, 24, 1, u);
  insert into building (world_id, id, name, levels, planned_by) values ${e.buildings.map((b) => `(w, ${b.id}, '${b.name}', ${b.levels}, u)`).join(', ')};
  insert into building_tile (world_id, building, x, y) values ${e.buildings.flatMap((b) => b.tiles.map(([x, y]) => `(w, ${b.id}, ${x}, ${y})`)).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${e.floors.map((f) => `(w, ${f.level}, ${f.x}, ${f.y}, ${f.b}, 'marble', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, '${f.done ? '{}' : '{"plank": 1}'}', '${f.done ? '{}' : '{"plank": 1}'}', u)`).join(',\n    ')};
  ${e.walls.length ? `insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by, lowered) values
    ${e.walls.map((x) => `(w, ${x.level}, '${x.dir}', ${x.x}, ${x.y}, ${x.b}, '${x.type}', '${x.material}', '${x.done ? '{}' : '{"plank": 1}'}', '${x.done ? '{}' : '{"plank": 1}'}', u, ${x.lowered ? 'true' : 'false'})`).join(',\n    ')};` : ''}
  ${e.bridges.map((s) => `insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level, level_b, width, side, rise)
    values (w, 'marble', ${s.ax}, ${s.ay}, ${s.bx}, ${s.by}, 91, u, ${s.level}, ${s.levelB ?? 'null'}, ${s.width}, 1, 0) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select w, v_b, o, p.x, p.y, '{}', '{}' from unnest(array[${spans(s).map((p) => p.x).join(', ')}], array[${spans(s).map((p) => p.y).join(', ')}]) with ordinality p(x, y, o);`).join('\n  ')}`;

/**
 * Of each tile a storey up: whether the worker's way from the ground gets there and back down, its reach, and whether
 * the reach of the whole box at once has it (`storey_reach`, a hod carrier's): `cell=up,down,reach,box`.
 */
const reachSql = (from: { x: number; y: number }, box: Box, cells: Cell[]): string => cells.length ? `
  r := storey_reach(w, ${box.x0}, ${box.y0}, ${box.x1}, ${box.y1});
  foreach cell slice 1 in array array[${cells.map((c) => `array[${c.join(', ')}]`).join(', ')}]::int[][] loop
    insert into said values ('WAY', cell[1] || ',' || cell[2] || ',' || cell[3] || '='
      || (creature_way(w, ${from.x}, ${from.y}, 0, cell[1], cell[2], cell[3]) is not null) || ','
      || (creature_way(w, cell[1], cell[2], cell[3], ${from.x}, ${from.y}, 0) is not null) || ','
      || storey_reached(w, cell[1], cell[2], cell[3]) || ','
      || (r ? (cell[1] || ',' || cell[2] || ',' || cell[3])));
  end loop;` : '';

/** Walls planned on a storey, a mortar each. */
const plannedSql = (b: number, level: number, ws: Array<['h' | 'v', number, number]>): string => `
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${ws.map(([d, x, y]) => `(w, ${level}, '${d}', ${x}, ${y}, ${b}, 'solid', 'marble', '{"mortar": 1}', '{"mortar": 1}', u)`).join(', ')};`;

/** A hod carrier on the ground beside `store`, mortar in it, settled until the walls on `level` are fitted or it says no way. */
const hodSql = (store: { x: number; y: number }, level: number): string => `
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values
    (w, 'furniture', 'chest', ${store.x}, ${store.y}, 0, 0, ${store.x} + 0.375, ${store.y} + 0.375, 40, u) returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'mortar', 30, 20);
  v_hod := creature_spawn(w, 'cobbe', ${store.x + 1} + 0.5, ${store.y} + 0.5, 'deed', now() - interval '60 days', u);
  -- Its masonry and carpentry over a wall's gate (craftgates.ts): this is about the way up.
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         from_x = to_x, from_y = to_y, until = now() - interval '1 millisecond', leg_at = now() - interval '1 millisecond',
         leg_ends = now() - interval '1 millisecond', skills = skills || '{"masonry": 90, "carpentry": 90}'
   where world_id = w and id = v_hod;
  for i in 1..400 loop
    update creature set worn = 0, hunger = 1, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_hod;
    perform worker_settle(w, v_hod);
    select * into c from creature where world_id = w and id = v_hod;
    if c.idle_why in ('stairs', 'stranded') then insert into said values ('SAID', i || ':' || c.idle_why || ' ' || c.idle_n); end if;
    if c.storey = ${level} then insert into said values ('ON_UP', i::text); end if;
    if c.storey = 0 and c.storey_from > 0 then insert into said values ('CAME_DOWN', i::text); end if;
    exit when not exists (select 1 from wall wl where wl.world_id = w and wl.level = ${level} and not bill_done(wl.needed))
          or (i > 20 and c.idle_why in ('stairs', 'stranded'));
  end loop;
  insert into said select 'LEFT', count(*)::text from wall wl where wl.world_id = w and wl.level = ${level} and not bill_done(wl.needed);`;

const run = (body: string): Map<string, string[]> => {
  const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_b bigint; v_hod int; v_store bigint; i int; c creature; cell int[]; r jsonb;
begin
${body}
end $t$;
select k || '=' || v from said;
rollback;`);
  const said = new Map<string, string[]>();
  for (const l of out.split('\n').filter((s) => s.includes('='))) {
    const k = l.slice(0, l.indexOf('='));
    said.set(k, [...(said.get(k) ?? []), l.slice(l.indexOf('=') + 1)]);
  }
  return said;
};
type Way = { cell: string; up: boolean; down: boolean; reach: boolean; box: boolean };
const waysOf = (said: Map<string, string[]>): Way[] => (said.get('WAY') ?? []).map((s) => {
  const [cell, r] = s.split('=');
  const [up, down, reach, box] = r.split(',');
  return { cell, up: up === 'true', down: down === 'true', reach: reach === 'true', box: box === 'true' };
});
const show = (cell: string, ox = 0, oy = 0): string => { const [x, y, l] = cell.split(',').map(Number); return `${x + ox},${y + oy} storey ${l + 1}`; };
const listed = (ws: Way[], ox = 0, oy = 0): string => `${ws.length}${ws.length ? `: ${ws.slice(0, 8).map((r) => `${show(r.cell, ox, oy)} ${r.up ? 'up' : 'no up'} ${r.down ? 'down' : 'no down'} ${r.reach ? 'reached' : 'not reached'}`).join('; ')}` : ''}`;
/** Every tile a storey up of an estate's finished floors (not a ladder's), by the island's cell. */
const floorCells = (e: Estate): Cell[] => e.floors.filter((f) => f.level >= 1 && f.done && f.kind !== 'ladder').map((f) => [f.x, f.y, f.level] as Cell);

/**
 * The worker's way to each tile the player reaches and its reach both found, and its way back down found wherever the
 * player's is (a body up a flight whose foot is walled across has none either).
 */
const fine = (r: Way, down: Set<string>): boolean => r.up && r.reach && (r.down || !down.has(r.cell));

/* ---- the manor, with its bridge ------------------------------------------------ */

const withBridge = playerReach(manor(true), FROM, MANOR_BOX);
const east4 = withBridge.up.filter(([x, , l]) => l === UP && x >= BX);
check('Solara Manor: the player reaches the east building\'s storey 4 from the ground, over the bridge', east4.length > 0, `${east4.length} tiles`);
const a = run(estateSql(manor(true), FROM, MANOR_BOX) + plannedSql(5, UP, PLANNED) + reachSql(FROM, MANOR_BOX, withBridge.up) + hodSql(STORE, UP));
const ma = waysOf(a);
check(`the worker's way finds every one of the ${withBridge.up.length} tiles a storey up the player reaches, and back down (\`creature_way\`), and its reach says so (\`storey_reached\`)`,
  ma.length === withBridge.up.length && ma.every((r) => fine(r, withBridge.down)), listed(ma.filter((r) => !fine(r, withBridge.down)), OX, OY));
const sameBox = (ws: Way[]): Way[] => ws.filter((r) => r.box !== r.up);
check('the reach of the whole box at once (`storey_reach`) has every one of them', sameBox(ma).length === 0, listed(sameBox(ma), OX, OY));
check('a hod carrier with walls planned on the east building\'s storey 4 never says no stairs up or no stairs down', !a.has('SAID'),
  (a.get('SAID') ?? []).slice(0, 4).join(', '));
check('it goes up to storey 4', a.has('ON_UP'), (a.get('ON_UP') ?? []).slice(0, 3).join(','));
check('fits every wall planned there', a.get('LEFT')?.[0] === '0', `${a.get('LEFT')?.[0]} of ${PLANNED.length} left`);
check('and comes back down for more', (a.get('CAME_DOWN') ?? []).length >= 2, (a.get('CAME_DOWN') ?? []).slice(0, 4).join(','));

/* ---- an unfinished bridge off the east building's storey 4: walls fitted from its deck ------ */

/**
 * Read off the island: walls planned on storey 4 along an unfinished bridge's deck were fitted from that deck
 * (`hod_stand`), which nobody walks yet: the way there went to the floor beside it, the reach of the whole range at once
 * had no such tile (`storey_reach`), and the hod carrier said no stairs up to storey 4 every round. Fitted from the floor
 * beside it, both say the same, and the hod carrier fits them and is not stranded on the deck.
 */
const OPEN = { x: 2580 - OX, y0: 3007 - OY, y1: 3011 - OY };
const openSql = `
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level, level_b, width, side, rise)
    values (w, 'marble', ${OPEN.x}, ${OPEN.y0}, ${OPEN.x}, ${OPEN.y1}, 91, u, ${UP}, null, 1, 1, 0) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select w, v_b, y - ${OPEN.y0}, ${OPEN.x}, y, '{"plank": 1}', '{"plank": 1}' from generate_series(${OPEN.y0 + 1}, ${OPEN.y1 - 1}) y;
  r := storey_reach(w, ${MANOR_BOX.x0}, ${MANOR_BOX.y0}, ${MANOR_BOX.x1}, ${MANOR_BOX.y1});
  insert into said select 'HOD_REACHED', wl.x || ',' || wl.y || '=' || hod_reached(w, 'wall', wl.level, wl.dir, wl.x, wl.y) || ','
         || hod_reached(w, 'wall', wl.level, wl.dir, wl.x, wl.y, r) || ',' || coalesce((select s.x || ',' || s.y from hod_stand(w, 'wall', wl.level, wl.dir, wl.x, wl.y) s), 'none')
    from wall wl where wl.world_id = w and wl.level = ${UP} and not bill_done(wl.needed);`;
const o = run(estateSql(manor(true), FROM, MANOR_BOX) + plannedSql(5, UP, PLANNED) + openSql + hodSql(STORE, UP));
const deckWall = (o.get('HOD_REACHED') ?? []).find((s) => s.startsWith(`${OPEN.x},${OPEN.y0 + 1}=`)) ?? '';
check('an unfinished bridge off storey 4: the wall along its deck is fitted from the floor beside it, not the deck nobody walks', deckWall.endsWith(`,${OPEN.x},${OPEN.y0}`), deckWall || 'not listed');
const split = (o.get('HOD_REACHED') ?? []).filter((s) => { const [a, b] = s.split('=')[1].split(','); return a !== b; });
check('each wall planned there is reached the same by its own way (`hod_reached`) and by the whole range at once (`storey_reach`)',
  (o.get('HOD_REACHED') ?? []).length === PLANNED.length && split.length === 0, split.slice(0, 4).join('; ') || `${(o.get('HOD_REACHED') ?? []).length} of ${PLANNED.length} listed`);
check('the hod carrier never says no stairs up or no stairs down', !o.has('SAID'), (o.get('SAID') ?? []).slice(0, 4).join(', '));
check('and fits every wall planned there', o.get('LEFT')?.[0] === '0', `${o.get('LEFT')?.[0]} of ${PLANNED.length} left`);

/* ---- and without it: its storey 4 out of everybody's reach ------------------------- */

const noBridge = playerReach(manor(false), FROM, MANOR_BOX);
check('with no bridge, the player does not reach the east building\'s storey 4', !noBridge.up.some(([x, , l]) => l === UP && x >= BX));
const east = floorCells(manor(false)).filter(([x, , l]) => l === UP && x >= BX);
const eastKeys = new Set(east.map((k) => k.join(',')));
const b = run(estateSql(manor(false), FROM, MANOR_BOX) + plannedSql(5, UP, PLANNED) + reachSql(FROM, MANOR_BOX, [...noBridge.up, ...east]) + hodSql(STORE, UP));
const mb = waysOf(b);
check('nor the worker\'s way, nor its reach', mb.filter((r) => eastKeys.has(r.cell)).every((r) => !r.up && !r.reach),
  listed(mb.filter((r) => eastKeys.has(r.cell) && (r.up || r.reach)), OX, OY));
check('while every tile the player still reaches, the worker does', mb.filter((r) => !eastKeys.has(r.cell)).every((r) => fine(r, noBridge.down)),
  listed(mb.filter((r) => !eastKeys.has(r.cell) && !fine(r, noBridge.down)), OX, OY));
check('and the reach of the whole box at once is the same, tile for tile', sameBox(mb).length === 0, listed(sameBox(mb), OX, OY));
check('and the hod carrier says no stairs up to storey 4', (b.get('SAID') ?? []).some((s) => s.endsWith(`stairs ${UP + 1}`)),
  (b.get('SAID') ?? []).slice(0, 3).join(', ') || 'nothing said');

/* ---- the annex: the other ways up ---------------------------------------------------- */

const player = playerReach(annex, ANNEX_FROM, ANNEX_BOX);
const playerKeys = new Set(player.up.map((k) => k.join(',')));
const loft = floorCells(annex).filter(([x, y]) => LOFT.some(([lx, ly]) => lx === x && ly === y));
const loftKeys = new Set(loft.map((k) => k.join(',')));
/** A tile under a flight going up from it: a body stepping onto it goes up, but a worker fitting a wall there stops on it (`flightfoot.ts`). */
const under = new Set(annex.floors.filter((f) => f.kind === 'stairs' && f.done).map((f) => at(f.x, f.y, f.level - 1)));
const others = floorCells(annex).filter((k) => !playerKeys.has(k.join(',')));
const c = run(estateSql(annex, ANNEX_FROM, ANNEX_BOX) + plannedSql(7, 1, [['h', 31, 6]]) + reachSql(ANNEX_FROM, ANNEX_BOX, [...player.up, ...others]) + hodSql({ x: 33, y: 12 }, 1));
const ca = waysOf(c);
const by = (name: string, tiles: Array<[number, number]>, level: number): void => {
  const mine = player.up.filter(([x, y, l]) => l === level && tiles.some(([tx, ty]) => tx === x && ty === y));
  const ws = ca.filter((r) => mine.some((m) => m.join(',') === r.cell));
  check(`${name}: the player reaches ${mine.length} of its ${tiles.length} tiles on storey ${level + 1}, and back down; the worker's way and reach every one`,
    mine.length === tiles.length && mine.every((m) => player.down.has(m.join(','))) && ws.length === mine.length && ws.every((r) => fine(r, player.down)),
    listed(ws.filter((r) => !fine(r, player.down))));
};
by('a flight whose head meets a wall on storey 2, stepped off at its side', SIDE, 1);
by('the building next door, through a door off the tower\'s storey 2', DOOR, 1);
by('up a ramp from storey 3 of one building', HIGH, 3);
by('up a ramp from the ground', RAMPED, 1);
const loftWays = ca.filter((r) => loftKeys.has(r.cell));
check('up a ladder only: the player reaches the loft, the worker does not (no ladders)',
  loft.every((l) => playerKeys.has(l.join(','))) && loftWays.length === loft.length && loftWays.every((r) => !r.up && !r.reach), listed(loftWays.filter((r) => r.up || r.reach)));
const stray = ca.filter((r) => !playerKeys.has(r.cell) && !loftKeys.has(r.cell) && !under.has(r.cell) && (r.up || r.reach));
check('and no other tile a storey up the player does not reach, the worker does', stray.length === 0, listed(stray));
check('the reach of the whole box at once is each tile\'s, tile for tile', sameBox(ca).length === 0, listed(sameBox(ca)));
check('a hod carrier with a wall planned on the loft\'s storey 2 says no stairs up to storey 2', (c.get('SAID') ?? []).some((s) => s.endsWith('stairs 2')),
  (c.get('SAID') ?? []).slice(0, 3).join(', ') || 'nothing said');

finish('a worker reaches what the player reaches');
