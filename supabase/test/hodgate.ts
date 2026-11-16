/**
 * A hod carrier names the build gate that keeps it from work the stores have pieces for, and its stock line names only
 * what the stores lack.
 *
 * Seen on the island: a Bastiondrake idle "stock", naming glass, timber and marble brick, with 1051 glass and 333
 * timber in the settlement stores. Glass walls and a glass roof wanted them; its carpentry (1) was under glass
 * building's gate (40), so it might not fit them, and its card named every thing any work wanted, held or not.
 * One settlement, the same on both sides, a Brickling at masonry 90 on it, the chest holding glass and timber:
 *
 *   1. a glass wall wanting glass and timber, carpentry 1: `gate`, naming glass building's carpentry 40, with the
 *      wall's distance in rings from the totem;
 *   2. a marble wall wanting marble brick instead: `stock`, naming marble brick only;
 *   3. both: `gate` as in 1, and what the stores lack (`hod_lacking`, `Game.hodWanted` with `stocked`) is marble brick
 *      only, never glass or timber;
 *   4. carpentry 40: it takes glass or timber for the glass wall.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { SPECIES, workRangeOf, type Creature } from '../../src/game/creatures';
import { idleSays, type Idle, type IdleWhy } from '../../src/game/workerlog';
import { gateOf } from '../../src/game/skillgates';
import { TileType } from '../../src/world/tiles';
import { itemDef, type Item } from '../../src/game/items';
import { psql, check, finish } from './harness';

const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

/* ---- the settlement, set out in the browser ------------------------------ */

const T = 40;
const CHEST = [T + 1, T - 1] as const;
const SKILLS = { carpentry: 1, masonry: 90 };
const STOCK: [string, number][] = [['glass', 100], ['timber', 40]];
const g = Game.create(4263);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Hodgate', x: T, y: T, radius: 10, level: 1 };
const hall = g.buildings.create('Hall', T + 3, T + 2);
// A glass wall, six rings out, wanting glass and timber; a marble wall nearer, wanting marble brick only.
const glass = g.buildings.setWall(hall, 0, T + 6, T + 3, 'n', 'solid', 'glass');
const marble = g.buildings.setWall(hall, 0, T - 3, T + 2, 'n', 'solid', 'marble');
marble.needed = { marble_brick: 4 };
marble.total = { marble_brick: 4 };
const GLASS_BILL = { ...glass.needed };
const MARBLE_BILL = { ...marble.needed };
const RINGS = Math.max(Math.abs(glass.x - T), Math.abs(glass.y - T));
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 40, STOCK.map(([id, count]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count })));
const chestHas = (id: string): number => chest.items.filter((it: Item) => it.id === id).reduce((n, it) => n + it.count, 0);

/* ---- the island ------------------------------------------------------------ */

const U = '7e5b0000-0000-4000-8000-000000000d63';
const wallSql = (w: typeof glass, bill: Record<string, number>): string =>
  `(w, ${w.level}, '${w.dir}', ${w.x}, ${w.y}, 1, '${w.type}', '${w.material}', ${j(bill)}, ${j(bill)}, u)`;
const idleSql = (k: string): string => `
  update creature set until = now() - interval '1 second', phase = 'idle', carrying = null where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select '${k}', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = w and id = v_id;`;
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_id int; v_chest bigint; c creature; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hodgate', 263, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mason');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hodgate', ${T}, ${T}, 10, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${CHEST[0]} + 0.375, ${CHEST[1]} + 0.375, 40, u) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values
    ${STOCK.map(([id, n]) => `(w, 'furniture', v_chest, '${id}', 30, ${n})`).join(', ')};
  insert into said values ('BILL', wall_bill('glass', 'solid')::text);
  v_id := creature_spawn(w, 'cobbe', ${T} + 1.6, ${T} - 0.4, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         skills = skills || ${j(SKILLS)},
         from_x = to_x, from_y = to_y, until = now() - interval '1 second', leg_at = now() - interval '1 second',
         leg_ends = now() - interval '1 second'
   where world_id = w and id = v_id;
  select * into c from creature where world_id = w and id = v_id;
  insert into said values ('RANGE', work_range(c)::text), ('CARPENTRY', worker_level(c, 'carpentry')::text);
  insert into building (world_id, id, name, planned_by) values (w, 1, 'Hall', u);

  -- 1. The glass wall alone.
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values ${wallSql(glass, GLASS_BILL)};
  ${idleSql('GLASS')}

  -- 2. The marble wall alone.
  update wall set needed = '{"glass": 0, "timber": 0}' where world_id = w and material = 'glass';
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values ${wallSql(marble, MARBLE_BILL)};
  ${idleSql('MARBLE')}

  -- 3. Both.
  update wall set needed = total where world_id = w and material = 'glass';
  ${idleSql('BOTH')}
  select * into c from creature where world_id = w and id = v_id;
  insert into said select 'LACKING', coalesce(array_to_string(l.items, ','), '') || '|' || l.n from hod_lacking(w, ${T}, ${T}, work_range(c), u) l;
  insert into said select 'SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->>'idleN', '') || '|' || coalesce(e->>'idleWhat', '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_id;

  -- 4. At glass building's carpentry: it takes the glass wall's pieces.
  update creature set skills = skills || '{"carpentry": 40}', carrying = null, phase = 'idle' where world_id = w and id = v_id;
  for i in 1..40 loop
    update creature set worn = 0, hunger = 1, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_id;
    perform worker_settle(w, v_id);
    select * into c from creature where world_id = w and id = v_id;
    exit when c.carrying->>'def' in ('glass', 'timber')
          or exists (select 1 from wall wl where wl.world_id = w and wl.material = 'glass' and wl.needed <> wl.total);
  end loop;
  insert into said select 'FIT', coalesce(c.carrying->>'def', '-') || '|' || coalesce(c.idle_why, '') || '|'
         || (select wl.needed::text from wall wl where wl.world_id = w and wl.material = 'glass');
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const islandIdle = (k: string): Idle | null => {
  const [why, n, what] = (isle.get(k) ?? '').split('|');
  return why ? { why: why as IdleWhy, n: Number(n || 0), ...(what ? { what: what.replace(/[[\]" ]/g, '').split(',') } : {}) } : null;
};

/* ---- the browser ------------------------------------------------------------ */

const cobbe = g.creatures.spawn('cobbe', T + 1.6, T - 0.4, 'deed', () => 0.5, -1e9);
cobbe.traits = [];
cobbe.skills = { ...cobbe.skills, ...SKILLS };
const range = workRangeOf(cobbe, SPECIES.cobbe);
const step = (c: Creature): Idle | null => {
  c.carrying = null;
  c.idle = undefined;
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
  const idle = c.idle as Idle | null | undefined;
  return idle ? { ...idle } : null;
};
const zero = (bill: Record<string, number>): void => { for (const k of Object.keys(bill)) bill[k] = 0; };
// 1. The glass wall alone.
zero(marble.needed);
const glassB = step(cobbe);
// 2. The marble wall alone.
zero(glass.needed);
Object.assign(marble.needed, MARBLE_BILL);
const marbleB = step(cobbe);
// 3. Both.
Object.assign(glass.needed, GLASS_BILL);
const bothB = step(cobbe);
const stocked = (item: string): boolean => chestHas(item) > 0;
const near = (x: number, y: number, dir?: string): boolean => Math.max(Math.abs(x - T), Math.abs(y - T)) <= range && g.workOnDeed(x, y, dir);
const lackingB = g.hodWanted(near, { x: T, y: T }, stocked);
// 4. At glass building's carpentry.
cobbe.skills.carpentry = 40;
cobbe.idle = undefined;
for (let i = 0; i < 2400 && cobbe.carrying?.id !== 'glass' && cobbe.carrying?.id !== 'timber' && glass.needed.glass === GLASS_BILL.glass; i++) {
  g.player.stats.stamina = 1;
  cobbe.hunger = 1;
  g.update(0.05);
}

/* ---- the same on both sides --------------------------------------------------- */

const name = (id: string): string => itemDef(id).name.toLowerCase();
const says = (idle: Idle | null | undefined): string => (idle ? idleSays(idle, 'hod', null, undefined, SKILLS) : '');
const sameIdle = (what: string, key: string, here: Idle | null, want: IdleWhy, sentence: string): void => {
  const there = islandIdle(key);
  check(`${what}: "${sentence}" on both sides`,
    there?.why === want && here?.why === want && says(there) === sentence && says(here) === sentence,
    `${isle.get(key)} / ${here?.why}|${here?.n}|${here?.what?.join(',') ?? ''} — ${says(there)} / ${says(here)}`);
};

const gate = gateOf('material', 'glass');
check('glass building is gated at carpentry 40', gate?.skill === 'carpentry' && gate.level === 40 && gate.name === 'Glass building', JSON.stringify(gate));
check('a glass wall\'s bill is glass and timber, on both sides',
  JSON.stringify(GLASS_BILL) === JSON.stringify({ glass: 24, timber: 8 }) && JSON.stringify(JSON.parse(isle.get('BILL') ?? '{}')) === JSON.stringify(GLASS_BILL),
  `${JSON.stringify(GLASS_BILL)} / ${isle.get('BILL')}`);
check('the island and the browser give the Brickling the same range, and carpentry 1',
  Number(isle.get('RANGE')) === range && Number(isle.get('CARPENTRY')) === 1, `${isle.get('RANGE')} / ${range}; carpentry ${isle.get('CARPENTRY')}`);

const GATED = `Idle: Glass building ${RINGS} tiles from the totem needs carpentry 40 (yours 1.0).`;
sameIdle('1. a glass wall wanting the glass and timber in the chest, at carpentry 1', 'GLASS', glassB, 'gate', GATED);
check('   named by its gate: material, glass', islandIdle('GLASS')?.what?.join(',') === 'material,glass' && glassB?.what?.join(',') === 'material,glass',
  `${isle.get('GLASS')} / ${glassB?.what}`);
sameIdle('2. a marble wall wanting marble brick, the chest holding glass and timber', 'MARBLE', marbleB, 'stock',
  `Idle: no ${name('marble_brick')} in your settlement stores.`);
check('   naming marble brick only', islandIdle('MARBLE')?.what?.join(',') === 'marble_brick' && marbleB?.what?.join(',') === 'marble_brick',
  `${isle.get('MARBLE')} / ${marbleB?.what}`);
sameIdle('3. both walls', 'BOTH', bothB, 'gate', GATED);
check('   and the island sends it so', says(islandIdle('SENT')) === GATED, isle.get('SENT'));
check('   what the stores lack is marble brick only, never glass or timber, on both sides',
  isle.get('LACKING') === 'marble_brick|1' && lackingB.items.join(',') === 'marble_brick' && lackingB.n === 1,
  `${isle.get('LACKING')} / ${lackingB.items.join(',')}|${lackingB.n}`);
{
  const [held, why, needed] = (isle.get('FIT') ?? '').split('|');
  const left = JSON.parse(needed || '{}') as Record<string, number>;
  check('4. at carpentry 40 it takes glass or timber for the glass wall, on the island',
    ['glass', 'timber'].includes(held) || left.glass < GLASS_BILL.glass || left.timber < GLASS_BILL.timber, `${isle.get('FIT')} (${why})`);
}
check('   and in the browser',
  cobbe.carrying?.id === 'glass' || cobbe.carrying?.id === 'timber' || glass.needed.glass < GLASS_BILL.glass || glass.needed.timber < GLASS_BILL.timber,
  `${cobbe.carrying?.id ?? 'nothing'} held; ${JSON.stringify(glass.needed)}; ${(cobbe.idle as Idle | null | undefined)?.why ?? ''}`);
{
  // The island before this, in the gap after the site goes up: the old `stock` line still reads.
  const old: Idle = { why: 'stock', n: 3, what: ['glass', 'timber', 'marble_brick'] };
  check('an island sending the old stock line: still said', idleSays(old, 'hod') === `Idle: no ${name('glass')}, ${name('timber')} or ${name('marble_brick')} in your settlement stores.`, idleSays(old, 'hod'));
}

finish('a hod carrier names its build gate, and stock only what the stores lack');
