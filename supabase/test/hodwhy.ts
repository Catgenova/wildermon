/**
 * A hod carrier says what the work in its range wants that the stores do not hold, and puts back what none of it wants.
 *
 * Seen on the island: hod carriers idle with "no planned building work within 30 tiles", with floors a storey up in
 * that range wanting marble brick, a wall wanting glass, and the stores holding marble shards and mortar but neither;
 * and one holding four mortar nothing wanted, which it kept. One settlement, the same on both sides, a Brickling on it:
 *
 *   * no planned work within its range: `range`, at its range;
 *   * a marble floor a storey up wanting only marble brick (its mortar in) and a wall wanting glass, the chest holding
 *     marble shards and mortar: `stock`, naming marble brick and then glass, nearest first, and the same words;
 *   * four mortar in its arms that nothing wants: back in the chest, its arms empty, and then `stock` as before;
 *   * and past `IDLE_WANTS` things wanted, the rest counted.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { SPECIES, workRangeOf, type Creature } from '../../src/game/creatures';
import { idleSays, IDLE_WANTS, type Idle, type IdleWhy } from '../../src/game/workerlog';
import { TileType } from '../../src/world/tiles';
import { itemDef, type Item } from '../../src/game/items';

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
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

/* ---- the settlement, set out in the browser ------------------------------ */

const T = 40;
const CHEST = [T + 1, T - 1] as const;
const g = Game.create(4251);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Hodwhy', x: T, y: T, radius: 10, level: 1 };
const hall = g.buildings.create('Hall', T + 3, T + 2);
// A marble floor a storey up, its mortar all in: it wants marble brick only.
const floor = g.buildings.setFloor(hall, 1, T + 3, T + 2, 'marble', 'floor');
floor.needed.mortar = 0;
// A wall further off wanting glass.
const wall = g.buildings.setWall(hall, 0, T + 5, T + 4, 'n', 'solid', 'stone_brick');
wall.needed = { glass: 2 };
wall.total = { glass: 2 };
const STOCK: [string, number][] = [['marble_shards', 3], ['mortar', 6]];
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 40, STOCK.map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count })));
const chestHas = (id: string): number => chest.items.filter((it: Item) => it.id === id).reduce((n, it) => n + it.count, 0);

/* ---- the island ------------------------------------------------------------ */

const U = '7e5b0000-0000-4000-8000-000000000d21';
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_id int; v_chest bigint; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodwhy', 251, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodwhy', ${T}, ${T}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${STOCK.map(([id, n]) => `(w, 'furniture', v_chest, '${id}', 30, ${n})`).join(', ')};
  v_id := creature_spawn(w, 'cobbe', ${T} + 1.6, ${T} - 0.4, 'deed', now() - interval '60 days', u);
  -- Ordinary blood: a rare one's range is its blood's (beast_mul), and one in a hundred spawns rare.
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         from_x = to_x, from_y = to_y, until = now() - interval '1 second', leg_at = now() - interval '1 second',
         leg_ends = now() - interval '1 second'
   where world_id = w and id = v_id;
  insert into said select 'RANGE', work_range(c)::text from creature c where world_id = w and id = v_id;

  -- No planned work at all.
  perform worker_settle(w, v_id);
  insert into said select 'NONE', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = w and id = v_id;

  -- The floor and the wall, wanting what the chest does not hold.
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 2, u);
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by)
    values (w, ${floor.level}, ${floor.x}, ${floor.y}, 1, '${floor.material}', '${floor.kind}', ${j(floor.needed)}, ${j(floor.total)}, u);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    values (w, ${wall.level}, '${wall.dir}', ${wall.x}, ${wall.y}, 1, '${wall.type}', '${wall.material}', ${j(wall.needed)}, ${j(wall.total)}, u);
  update creature set until = now() - interval '1 second', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'WANT', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = w and id = v_id;
  r := rpc_creatures(w, 40);
  insert into said select 'SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') || '|' || coalesce(e->>'idleWhat', '')
    from jsonb_array_elements(r) e where (e->>'id')::int = v_id;

  -- Four mortar in its arms, which nothing wants: a minute to put it back.
  update creature set carrying = '{"def": "mortar", "count": 4, "ql": 30}'::jsonb, phase = 'idle',
         until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
         leg_at = now() - interval '60 seconds', leg_ends = now() - interval '60 seconds'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'HELD', coalesce(carrying::text, 'null') || '|' || coalesce(idle_why, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = w and id = v_id;
  insert into said select 'AFTER', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = w and id = v_id;
  insert into said select 'MORTAR', coalesce(sum(count), 0)::text from item where world_id = w and placed = v_chest and def = 'mortar';
  insert into said values ('WANTS', idle_wants()::text);
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const islandIdle = (k: string): Idle | null => {
  const [why, n, what] = (isle.get(k) ?? '').split('|');
  return why ? { why: why as IdleWhy, n: Number(n || 0), ...(what ? { what: what.replace(/[[\]" ]/g, '').split(',') } : {}) } : null;
};

/* ---- the browser ------------------------------------------------------------ */

// The work is put back after the first step, as the island has it inserted after its first settle.
const planned = { floor: { ...floor.needed }, wall: { ...wall.needed } };
for (const k of Object.keys(floor.needed)) floor.needed[k] = 0;
wall.needed = { glass: 0 };
const cobbe = g.creatures.spawn('cobbe', T + 1.6, T - 0.4, 'deed', () => 0.5, -1e9);
cobbe.traits = [];
const step = (c: Creature): void =>
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
const range = workRangeOf(cobbe, SPECIES.cobbe);
step(cobbe);
const noneB = cobbe.idle ? { ...cobbe.idle } : null;
Object.assign(floor.needed, planned.floor);
wall.needed = { ...planned.wall };
step(cobbe);
const wantB = cobbe.idle ? { ...cobbe.idle } : null;
cobbe.carrying = { uid: g.inventory.nextUid++, id: 'mortar', ql: 30, dmg: 0, count: 4 };
const mortar0 = chestHas('mortar');
for (let i = 0; i < 1200 && cobbe.carrying; i++) {
  g.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g.update(0.05);
}
// And on, until it has stood about once more.
for (let i = 0; i < 1200 && !cobbe.idle; i++) {
  g.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g.update(0.05);
}
const heldB = cobbe.carrying;
const afterB = cobbe.idle ? { ...cobbe.idle } : null;

/* ---- the same on both sides --------------------------------------------------- */

// What it wants, by the names the game gives them.
const name = (id: string): string => itemDef(id).name.toLowerCase();
const WANTS = `Idle: no ${name('marble_brick')} or ${name('glass')} in your settlement stores.`;
const says = (idle: Idle | null | undefined): string => (idle ? idleSays(idle, 'hod') : '');
const sameIdle = (what: string, key: string, here: Idle | null, want: IdleWhy, sentence: string): void => {
  const there = islandIdle(key);
  check(`${what}: "${sentence}" on both sides`,
    there?.why === want && here?.why === want && says(there) === sentence && says(here) === sentence,
    `${isle.get(key)} / ${here?.why}|${here?.n}|${here?.what?.join(',') ?? ''} — ${says(there)} / ${says(here)}`);
};

check('the island and the browser give a Brickling the same range', Number(isle.get('RANGE')) === range, `${isle.get('RANGE')} / ${range}`);
sameIdle(`no planned work within its ${range} tiles`, 'NONE', noneB, 'range', `Idle: no planned building work within ${range} tiles of the totem.`);
sameIdle('work in range wanting marble brick and glass, the chest holding marble shards and mortar', 'WANT', wantB, 'stock',
  WANTS);
check('what it wants is named nearest first, the same on both sides',
  islandIdle('WANT')?.what?.join(',') === 'marble_brick,glass' && wantB?.what?.join(',') === 'marble_brick,glass', `${isle.get('WANT')} / ${wantB?.what}`);
check('and the island sends it so: the reason, how many things, and what',
  says(islandIdle('SENT')) === WANTS, isle.get('SENT'));
check('four mortar in its arms that nothing wants go back in the chest, on the island',
  (isle.get('HELD') ?? '').startsWith('null|') && Number(isle.get('MORTAR')) === STOCK[1][1] + 4, `${isle.get('HELD')}; chest mortar ${isle.get('MORTAR')}`);
check('and in the browser', !heldB && chestHas('mortar') === mortar0 + 4, `${heldB?.id ?? 'nothing'} held; chest mortar ${chestHas('mortar')} of ${mortar0} + 4`);
sameIdle('and then it says what it wants again', 'AFTER', afterB, 'stock', WANTS);
check(`it names at most ${IDLE_WANTS} things, the island's \`idle_wants\` the same`, Number(isle.get('WANTS')) === IDLE_WANTS, isle.get('WANTS'));
{
  const four: Idle = { why: 'stock', n: 4, what: ['marble_brick', 'glass', 'mortar'] };
  check('past those, the rest are counted', idleSays(four, 'hod') === `Idle: no ${name('marble_brick')}, ${name('glass')}, ${name('mortar')} or 1 more in your settlement stores.`, idleSays(four, 'hod'));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na hod carrier says what it wants and puts back what nothing wants — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
