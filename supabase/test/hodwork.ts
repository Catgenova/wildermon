/**
 * A hod carrier works on everything on its settlement built a piece at a time off a bill, and both sides agree on it.
 *
 * Asked for: "implement that brickling can work on floors and other deed constructions as well that require bricks or
 * slabs". It worked only on planned walls on the ground floor. One settlement, set out the same on both sides from the
 * browser's own bills: a stone wall a storey up, a stone floor, a stone roof two storeys up, a plank staircase and a
 * plank ladder, a stone column, a stone bridge of two spans, an aqueduct of two spans, a foundation wanting three
 * barrowfuls of concrete, a log wall nobody has logs for, and a stone wall past the worker's reach. One chest holds
 * everything the reachable work wants except the logs.
 *
 *   * Chosen and fitted a piece at a time until nothing more can be (`hod_needing_stocked` and `hod_fit` on the island,
 *     `Game.hodNeeding` and `Game.fitPiece` in the browser), the two sides take the same work in the same order, piece
 *     for piece, and leave every bill the same;
 *   * every kind of work is served, only the open span of a bridge at a time, and nothing out of reach or wanting what
 *     the stores do not hold;
 *   * the last pieces do what a builder's do: the foundation's top is packed dirt, and the finished stone work has its
 *     moss or ivy clock started;
 *   * the piece in hand goes wherever it is wanted, before anything nearer that the stores could feed;
 *   * and a Brickling at work for an hour, on both sides, fits a floor and then a wall a storey up out of the chest,
 *     one for one.
 *
 * The island half makes its own islands and rolls them back.
 */
import { execFileSync } from 'node:child_process';
import { Game, type HodTarget } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';
import type { Bill } from '../../src/game/building';
import type { Item } from '../../src/game/items';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const said = (out: string): Map<string, string> =>
  new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

/* ---- the settlement, set out in the browser ------------------------------ */

const T = 40;
const RANGE = 12;
const g = Game.create(4243);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 14; y <= T + 14; y++) for (let x = T - 14; x <= T + 14; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
g.deed = { name: 'Hodfield', x: T, y: T, radius: 10, level: 1 };
const hall = g.buildings.create('Hall', T + 3, T + 3);
for (const [x, y] of [[T + 4, T + 3], [T + 4, T + 4], [T + 3, T + 4]]) g.buildings.addTile(hall, x, y);
const upper = g.buildings.setWall(hall, 1, T + 3, T + 3, 'n', 'solid', 'stone_brick');
const logs = g.buildings.setWall(hall, 0, T + 1, T + 2, 'n', 'solid', 'log');
const far = g.buildings.setFence(T + RANGE + 1, T, 'n', 'solid', 'stone_brick');
const floor = g.buildings.setFloor(hall, 0, T + 4, T + 3, 'stone_brick', 'floor');
const roof = g.buildings.setFloor(hall, 2, T + 3, T + 3, 'stone_brick', 'roof');
const stairs = g.buildings.setFloor(hall, 1, T + 4, T + 4, 'plank', 'stairs', 's');
const ladder = g.buildings.setFloor(hall, 1, T + 3, T + 4, 'plank', 'ladder', 's');
const column = g.buildings.setColumn(hall, 0, T + 3, T + 5, 'stone_brick');
const bridge = g.addBridge('stone_brick', T - 6, T, T - 3, T, 10);
const aqueduct = g.addBridge('aqueduct', T, T + 6, T, T + 9, 10);
const slab = g.addFoundation(T - 2, T - 4, 6, 3);
const walls = [upper, logs, far];
const floors = [floor, roof, stairs, ladder];

// The chest: everything the reachable work wants but the logs.
const reachable: Bill[] = [upper, floor, roof, stairs, ladder, column, ...bridge.spans, ...aqueduct.spans, slab];
const stock = new Map<string, number>();
for (const b of reachable) for (const [id, n] of Object.entries(b.needed)) stock.set(id, (stock.get(id) ?? 0) + n);
const CHEST = [T + 2, T] as const;
const pile = (): Item[] => [...stock].map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count }));
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 40, pile());
const bills0 = JSON.stringify(reachable.map((b) => b.needed));

/* ---- the same settlement on the island ----------------------------------- */

const setOut = (w: string, u: string): string => `
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (${w}, 'Hodfield', ${T}, ${T}, 10, 1, ${u});
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (${w}, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, ${u}) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${[...stock].map(([id, n]) => `(${w}, 'furniture', v_chest, '${id}', 30, ${n})`).join(',\n    ')};
  insert into building (world_id, id, name, levels, planned_by) values (${w}, 1, 'Hall', 2, ${u});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${walls.map((wl) => `(${w}, ${wl.level}, '${wl.dir}', ${wl.x}, ${wl.y}, ${wl.building}, '${wl.type}', '${wl.material}', ${j(wl.needed)}, ${j(wl.total)}, ${u})`).join(',\n    ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${floors.map((f) => `(${w}, ${f.level}, ${f.x}, ${f.y}, 1, '${f.material}', '${f.kind}', ${f.facing ? `'${f.facing}'` : 'null'}, ${j(f.needed)}, ${j(f.total)}, ${u})`).join(',\n    ')};
  insert into building_column (world_id, level, x, y, building, material, needed, total, planned_by)
    values (${w}, ${column.level}, ${column.x}, ${column.y}, 1, '${column.material}', ${j(column.needed)}, ${j(column.total)}, ${u});
  ${[bridge, aqueduct].map((b) => `
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by) values (${w}, '${b.kind}', ${b.ax}, ${b.ay}, ${b.bx}, ${b.by}, ${b.height}, ${u})
    returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values
    ${b.spans.map((s, i) => `(${w}, v_b, ${i + 1}, ${s.x}, ${s.y}, ${j(s.needed)}, ${j(s.total)})`).join(', ')};`).join('')}
  insert into foundation (world_id, id, x, y, top, needed, total, made_by) values (${w}, 1, ${slab.x}, ${slab.y}, ${slab.top}, ${j(slab.needed)}, ${j(slab.total)}, ${u});
`;

const U = '7e5b0000-0000-4000-8000-000000000d11';
const isle = said(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table seq (ord serial, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_chest bigint; v_b bigint; r record; i int; held record;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodfield', 191, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 14}, ${T + 14}) x, generate_series(${T - 14}, ${T + 14}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  ${setOut('w', 'u')}
  -- The piece in hand, a plank: wherever it is wanted, before the nearer work the stores feed.
  select * into held from hod_needing(w, ${T}, ${T}, ${RANGE}, 'plank');
  insert into said values ('HELD', held.kind || '|' || held.level || '|' || held.x || '|' || held.y || '|' || held.item);
  select * into held from hod_needing_stocked(w, u, ${T}, ${T}, ${RANGE});
  insert into said values ('FIRST', held.kind || '|' || held.level || '|' || held.x || '|' || held.y || '|' || held.item);
  -- Chosen, taken out of the chest and fitted, until there is nothing more to fit.
  for i in 1..2000 loop
    select * into r from hod_needing_stocked(w, u, ${T}, ${T}, ${RANGE});
    exit when r.item is null;
    if take_one_stored(w, u, array[r.item]) is null then raise exception 'nothing to take for %', r.item; end if;
    if not hod_fit(w, r.kind, r.level, r.dir, r.x, r.y, r.ref, r.n, r.item) then raise exception 'it did not go in: %', r; end if;
    insert into seq (v) values (r.kind || '|' || r.level || '|' || r.x || '|' || r.y || '|' || r.item);
  end loop;
  insert into said select 'SEQ', string_agg(s.v, ',' order by s.ord) from seq s;
  insert into said select 'WALLS', string_agg(needed::text, ';' order by ord) from (
    select wl.needed, array_position(array[${walls.map((wl) => `'${wl.level}|${wl.x}|${wl.y}'`).join(',')}], wl.level || '|' || wl.x || '|' || wl.y) as ord
      from wall wl where wl.world_id = w) q;
  insert into said select 'FLOORS', string_agg(needed::text, ';' order by ord) from (
    select f.needed, array_position(array[${floors.map((f) => `'${f.level}|${f.x}|${f.y}'`).join(',')}], f.level || '|' || f.x || '|' || f.y) as ord
      from floor_tile f where f.world_id = w) q;
  insert into said select 'COLUMN', needed::text from building_column where world_id = w;
  insert into said select 'SPANS', string_agg(sp.needed::text, ';' order by b.kind desc, sp.n) from bridge_span sp join bridge b on b.world_id = sp.world_id and b.id = sp.bridge where sp.world_id = w;
  insert into said select 'SLAB', needed::text from foundation where world_id = w;
  insert into said select 'CHEST', coalesce(string_agg(def || ':' || count, ',' order by def), '') from item where world_id = w and placed = v_chest;
  insert into said values ('PACKED', (land_tile(w, ${slab.x}, ${slab.y}) = tile_id('Packed dirt'))::text);
  insert into said select 'GREEN', string_agg(thing, ',' order by thing) from green_since where world_id = w;
end $t$;
select k || '=' || v from said;
rollback;
`));

/* ---- the same, in the browser --------------------------------------------- */

const near = (x: number, y: number): boolean => Math.max(Math.abs(x - T), Math.abs(y - T)) <= RANGE;
const takeable = (it: Item, id: string): boolean => it.id === id && it.count > 0 && !it.locked;
const stocked = (id: string): boolean => g.deedStores().some((st) => st.items.some((it: Item) => takeable(it, id)));
const level = (t: HodTarget): number =>
  t.kind === 'wall' ? t.wall.level : t.kind === 'floor' ? t.floor.level : t.kind === 'column' ? t.column.level : 0;
const word = (job: { target: HodTarget; item: string; x: number; y: number }): string => `${job.target.kind}|${level(job.target)}|${job.x}|${job.y}|${job.item}`;

const heldB = g.hodNeeding(near, 'plank', { x: T, y: T }, () => false);
const firstB = g.hodNeeding(near, undefined, { x: T, y: T }, stocked);
const seqB: string[] = [];
for (let i = 0; i < 2000; i++) {
  const job = g.hodNeeding(near, undefined, { x: T, y: T }, stocked);
  if (!job) break;
  const it = chest.items.find((x) => takeable(x, job.item))!;
  it.count -= 1;
  if (it.count <= 0) chest.items.splice(chest.items.indexOf(it), 1);
  g.fitPiece(job.target, job.item);
  seqB.push(word(job));
}

const seqI = (isle.get('SEQ') ?? '').split(',');
const firstOff = seqB.findIndex((v, i) => v !== seqI[i]);
check('the piece in hand, a plank, goes to the plank work wherever it is, on both sides',
  isle.get('HELD') === (heldB && word(heldB)) && heldB?.target.kind === 'floor' && heldB.item === 'plank', `${isle.get('HELD')} | ${heldB && word(heldB)}`);
check('and with nothing in hand the first piece is the same on both sides', isle.get('FIRST') === (firstB && word(firstB)), `${isle.get('FIRST')} | ${firstB && word(firstB)}`);
check('piece for piece, the two sides take the same work in the same order',
  seqB.length > 0 && seqB.length === seqI.length && firstOff < 0,
  `${seqB.length} pieces in the browser, ${seqI.length} on the island${firstOff >= 0 ? `; first apart at ${firstOff}: ${seqB[firstOff]} | ${seqI[firstOff]}` : ''}`);
const kinds = new Set(seqB.map((v) => v.split('|')[0]));
check('every kind of work is served: walls a storey up, floors, a roof, stairs, a ladder, a column, a bridge, an aqueduct, a foundation',
  ['wall', 'floor', 'column', 'span', 'foundation'].every((k) => kinds.has(k))
    && seqB.some((v) => v.startsWith('wall|1|')) && seqB.some((v) => v.startsWith('floor|2|')) && seqB.some((v) => v.startsWith('floor|1|')),
  [...kinds].join(', '));
const total = reachable.reduce((n, b) => n + Object.values(JSON.parse(bills0)[reachable.indexOf(b)] as Record<string, number>).reduce((a, c) => a + c, 0), 0);
check('everything the stores could feed went in, and nothing else', seqB.length === total, `${seqB.length} of ${total}`);
// A bridge is built from one end: no piece goes into its second span while the first is open.
const spanOrder = (b: typeof bridge): boolean => {
  const at = (s: { x: number; y: number }): number[] => seqB.map((v, i) => (v.startsWith(`span|0|${s.x}|${s.y}|`) ? i : -1)).filter((i) => i >= 0);
  const [one, two] = b.spans.map(at);
  return one.length > 0 && two.length > 0 && Math.max(...one) < Math.min(...two);
};
check('of a bridge and an aqueduct only the open span is worked, the first before the second', spanOrder(bridge) && spanOrder(aqueduct));
const sameBills = (key: string, here: Bill[]): void => {
  const there = (isle.get(key) ?? '').split(';').map((s) => JSON.stringify(JSON.parse(s || '{}'), Object.keys(JSON.parse(s || '{}')).sort()));
  const mine = here.map((b) => JSON.stringify(b.needed, Object.keys(b.needed).sort()));
  check(`and every ${key.toLowerCase()} bill is left the same on both sides`, JSON.stringify(there) === JSON.stringify(mine), `${there.join(' ')} | ${mine.join(' ')}`);
};
sameBills('WALLS', walls);
sameBills('FLOORS', floors);
sameBills('COLUMN', [column]);
sameBills('SPANS', [...bridge.spans, ...aqueduct.spans]);
sameBills('SLAB', [slab]);
check('the log wall nobody has logs for and the wall out of reach are left as they were',
  JSON.stringify(logs.needed) === JSON.stringify(logs.total) && JSON.stringify(far.needed) === JSON.stringify(far.total));
const chestB = chest.items.filter((it) => it.count > 0).map((it) => `${it.id}:${it.count}`).sort().join(',');
check('and what went in came out of the chest, one for one, on both sides', chestB === (isle.get('CHEST') ?? '') && chestB === '', `${chestB} | ${isle.get('CHEST')}`);
check('the last barrowful packs the foundation\'s top, on both sides', isle.get('PACKED') === 'true' && g.world.getTile(slab.x, slab.y) === TileType.PackedDirt,
  `${isle.get('PACKED')} | ${g.world.getTile(slab.x, slab.y)}`);
check('and the finished stone wall, bridge, aqueduct and foundation have their moss or ivy started, on both sides',
  (isle.get('GREEN') ?? '') === 'bridge,bridge,slab,wall'
    && upper.greenSince !== undefined && bridge.greenSince !== undefined && aqueduct.greenSince !== undefined && slab.greenSince !== undefined,
  `${isle.get('GREEN')}`);

/* ---- an hour of a Brickling at it, on both sides ------------------------- */

// A floor three tiles off and a stone wall a storey up six off, and a chest holding the bills of both.
const FLOOR = [T + 2, T + 1] as const;
const WALL = [T + 6, T] as const;
const g2 = Game.create(4244);
for (const c of [...g2.creatures.list.values()]) g2.creatures.remove(c.id);
for (let y = T - 6; y <= T + 6; y++) for (let x = T - 6; x <= T + 9; x++) { g2.world.setHeight(x, y, 4); g2.world.setTile(x, y, TileType.Grass, 0); }
g2.player.x = T + 0.5;
g2.player.y = T + 0.5;
g2.deed = { name: 'Hodstead', x: T, y: T, radius: 10, level: 1 };
const shed = g2.buildings.create('Shed', FLOOR[0], FLOOR[1]);
const floor2 = g2.buildings.setFloor(shed, 0, FLOOR[0], FLOOR[1], 'stone_brick', 'floor');
const wall2 = g2.buildings.setWall(shed, 1, WALL[0], WALL[1], 'n', 'solid', 'stone_brick');
const want2 = new Map<string, number>();
for (const b of [floor2, wall2]) for (const [id, n] of Object.entries(b.needed)) want2.set(id, (want2.get(id) ?? 0) + n);
const all2 = [...want2.values()].reduce((a, b) => a + b, 0);
const floorBill = Object.values(floor2.total).reduce((a, b) => a + b, 0);
const chest2 = g2.addFurniture('chest', T + 1, T - 1, 0, 0, 40, [...want2].map(([id, count]) => ({ uid: g2.inventory.nextUid++, id, ql: 30, dmg: 0, count })));

const U2 = '7e5b0000-0000-4000-8000-000000000d12';
const run = said(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U2}'; v_id int; v_chest bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodstead', 192, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 6}, ${T + 9}) x, generate_series(${T - 6}, ${T + 6}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodstead', ${T}, ${T}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 1}, ${T - 1}, 0, 0, ${T + 1} + 0.375, ${T - 1} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${[...want2].map(([id, n]) => `(w, 'furniture', v_chest, '${id}', 30, ${n})`).join(', ')};
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Shed', 2, u);
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by)
    values (w, 0, ${FLOOR[0]}, ${FLOOR[1]}, 1, 'stone_brick', 'floor', ${j(floor2.needed)}, ${j(floor2.total)}, u);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, 1, '${wall2.dir}', ${wall2.x}, ${wall2.y}, 1, 'solid', 'stone_brick', ${j(wall2.needed)}, ${j(wall2.total)}, u);
  v_id := creature_spawn(w, 'cobbe', ${T} + 0.6, ${T} + 0.6, 'active', now() - interval '60 days', u);
  update creature set mode = 'deed', stance = 'passive', hunger = 1, phase = 'idle', from_x = to_x, from_y = to_y,
         until = now() - interval '3600 seconds', settled_at = now() - interval '3600 seconds', leg_at = now() - interval '3600 seconds',
         leg_ends = now() - interval '3600 seconds'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'FLOOR', coalesce(sum(e.value::int), 0)::text from floor_tile f, jsonb_each_text(f.needed) e where f.world_id = w;
  insert into said select 'WALL', coalesce(sum(e.value::int), 0)::text from wall wl, jsonb_each_text(wl.needed) e where wl.world_id = w;
  insert into said select 'CHEST', coalesce(sum(count), 0)::text from item where world_id = w and placed = v_chest;
end $t$;
select k || '=' || v from said;
rollback;
`));
const cobbe = g2.creatures.spawn('cobbe', T + 0.6, T + 0.6, 'deed');
for (let i = 0; i < 72000; i++) {
  g2.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g2.update(0.05);
}
const leftOf = (b: Bill): number => Object.values(b.needed).reduce((a, n) => a + n, 0);
const chestLeft2 = chest2.items.reduce((n, it) => n + it.count, 0);
for (const [side, floorLeft, wallLeft, chestLeft] of [
  ['on the island', Number(run.get('FLOOR')), Number(run.get('WALL')), Number(run.get('CHEST'))],
  ['in the browser', leftOf(floor2), leftOf(wall2), chestLeft2],
] as const) {
  const fitted = all2 - floorLeft - wallLeft;
  check(`${side}: in an hour it finishes the nearer floor and goes on to the wall a storey up`, floorLeft === 0 && wallLeft < all2 - floorBill,
    `floor wants ${floorLeft} of ${floorBill}, wall ${wallLeft}`);
  check(`${side}: what went in came out of the chest, one for one, give or take one in hand`,
    all2 - chestLeft >= fitted && all2 - chestLeft - fitted <= 1, `fitted ${fitted}, taken ${all2 - chestLeft}`);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na hod carrier works on everything built off a bill — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
