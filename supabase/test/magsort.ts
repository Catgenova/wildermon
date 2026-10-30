/**
 * A magga sorts the bins.
 *
 * Asked for: "[Magga] now also sorts raw material bins and craft material bins." With nothing lying on the
 * settlement within its range, a magga takes a stack out of a settlement store that is not a bin and carries it to the
 * raw or craft material bin that takes it, as many of it as the bin has room for (`sortStack`, the island's
 * `sort_stack` and `sort_take`). Asked of the island and of the browser, the same settlement:
 *
 *   * the deed crate holds logs, nails and a hatchet; a raw material bin and a craft material bin stand empty;
 *   * a hatchet lies on the ground: it is carried first, before anything is sorted;
 *   * the logs go to the raw bin, the nails to the craft bin; the hatchet, which no bin takes, stays in the crate;
 *   * a larder of flour (a bin itself), a padlocked chest of logs and a locked stack of logs are never touched;
 *   * with the raw bin four short of full, four of ten more logs go in and six stay; full, nothing more goes;
 *   * and with nothing to sort it says why, in the same words on both sides.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { SPECIES, workRangeOf, type Creature, type GatherKind } from '../../src/game/creatures';
import { crateCentre } from '../../src/game/crates';
import { furnitureCapacity, furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { idleSays, type Idle, type IdleWhy } from '../../src/game/workerlog';
import type { Item } from '../../src/game/items';
import { TileType } from '../../src/world/tiles';

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

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000f59';
// Where everything stands, off the token.
const CRATE = [T + 2, T] as const;
const RAW = [T - 4, T + 2] as const;
const CRAFT = [T + 3, T + 3] as const;
const LARDER = [T - 4, T - 3] as const;
const CHEST = [T + 1, T - 4] as const;
const SHELF = [T - 1, T + 5] as const;
const HATCHET = [T - 2, T - 1] as const;
const LOGS = 6;
const NAILS = 50;
const MORE = 10;

/* ---- the browser, first, for the pieces' centres ------------------------ */

const g = Game.create(259, 512);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: 'Sortstead', x: T, y: T, radius: 10, level: 5 };
let uid = 1;
const it = (id: string, count: number, ql = 30): Item => ({ uid: uid++, id, ql, dmg: 0, count });
const crate = g.addCrate('log', CRATE[0], CRATE[1], 0, 0, [it('log', LOGS), it('nail', NAILS, 40), it('hatchet', 1)], true);
const raw = g.addFurniture('bulk_bin', RAW[0], RAW[1], 0, 0, 50, []);
const craft = g.addFurniture('craft_bin', CRAFT[0], CRAFT[1], 0, 0, 50, []);
const larder = g.addFurniture('larder', LARDER[0], LARDER[1], 0, 0, 50, [it('flour', 5)]);
const chest = g.addFurniture('chest', CHEST[0], CHEST[1], 0, 0, 50, [it('log', 3)]);
chest.lock = 1;
const shelf = g.addFurniture('shelves', SHELF[0], SHELF[1], 0, 0, 50, [{ ...it('log', 4), locked: true }]);
g.dropOnGround(HATCHET[0], HATCHET[1], it('hatchet', 1));
const magga = g.creatures.spawn('magga', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
magga.traits = [];
const step = (c: Creature): void =>
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
const carried: string[] = [];
const run = (secs: number): void => {
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    magga.hunger = 1;
    step(magga);
    const now = magga.carrying?.id ?? '';
    if (now && carried[carried.length - 1] !== now) carried.push(now);
    else if (!now && carried[carried.length - 1] !== '') carried.push('');
  }
};
const count = (items: Item[], id: string, locked = false): number =>
  items.filter((x) => x.id === id && !!x.locked === locked).reduce((n, x) => n + x.count, 0);
const furnState = (f: PlacedFurniture, id: string): number => count(f.items, id);

run(600);
const browser = {
  seq: carried.filter((x) => x).join(','),
  crate: `${count(crate.items, 'log')}|${count(crate.items, 'nail')}|${count(crate.items, 'hatchet')}`,
  bins: `${furnState(raw, 'log')}|${furnState(craft, 'nail')}`,
  kept: `${furnState(larder, 'flour')}|${furnState(chest, 'log')}|${count(shelf.items, 'log', true)}`,
  idle: magga.idle ? `${magga.idle.why}|${magga.idle.n}` : '',
};
// The raw bin four short of full, and ten more logs in the crate.
const cap = furnitureCapacity(raw);
raw.items.push(it('dirt', cap - LOGS - 4));
crate.items.push(it('log', MORE));
carried.length = 0;
run(600);
const browserFull = {
  seq: carried.filter((x) => x).join(','),
  crate: count(crate.items, 'log'),
  bin: furnState(raw, 'log'),
  idle: magga.idle ? `${magga.idle.why}|${magga.idle.n}` : '',
};

/* ---- the island ----------------------------------------------------------- */

const [ccx, ccy] = crateCentre(crate);
const centre = (f: PlacedFurniture): string => furnitureCentre(f).join(', ');
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; m int; v_crate bigint; v_raw bigint; v_craft bigint; v_larder bigint; v_chest bigint;
        v_shelf bigint; i int; seq text := ''; v_now text; v_last text := ''; v_t0 timestamptz; v_ms double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Magsort', 259, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Sorter');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Sortstead', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  v_crate := coalesce((select max(id) from crate), 0) + 1;
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by, deed) values (w, v_crate, 'log', ${CRATE[0]}, ${CRATE[1]}, 0, 0, u, true);
  insert into item (world_id, holder, crate, def, ql, count) values
    (w, 'crate', v_crate, 'log', 30, ${LOGS}), (w, 'crate', v_crate, 'nail', 40, ${NAILS}), (w, 'crate', v_crate, 'hatchet', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', ${RAW[0]}, ${RAW[1]}, 0, 0, ${centre(raw)}, 50, u) returning id into v_raw;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'craft_bin', ${CRAFT[0]}, ${CRAFT[1]}, 0, 0, ${centre(craft)}, 50, u) returning id into v_craft;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'larder', ${LARDER[0]}, ${LARDER[1]}, 0, 0, ${centre(larder)}, 50, u) returning id into v_larder;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_larder, 'flour', 30, 5);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, lock)
    values (w, 'furniture', 'chest', ${CHEST[0]}, ${CHEST[1]}, 0, 0, ${centre(chest)}, 50, u, 1) returning id into v_chest;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_chest, 'log', 30, 3);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'shelves', ${SHELF[0]}, ${SHELF[1]}, 0, 0, ${centre(shelf)}, 50, u) returning id into v_shelf;
  insert into item (world_id, holder, placed, def, ql, count, locked) values (w, 'furniture', v_shelf, 'log', 30, 4, true);
  perform drop_on_ground(w, ${HATCHET[0]}, ${HATCHET[1]}, 'hatchet', 30, null, 1);
  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  -- Plain: no rarity or size form rolled at its spawn, either of which stretches its reach (beast_mul).
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = null, post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;
  insert into said values ('CRATEXY', crate_centre_x((select cr from crate cr where world_id = w and id = v_crate)) || ', '
    || crate_centre_y((select cr from crate cr where world_id = w and id = v_crate)));

  -- One phase at a time, so the order it carries things in is seen.
  for i in 1..160 loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
    select coalesce(carrying->>'def', '') into v_now from creature where world_id = w and id = m;
    if v_now <> v_last then
      if v_now <> '' then seq := seq || case when seq = '' then '' else ',' end || v_now; end if;
      v_last := v_now;
    end if;
  end loop;
  insert into said values ('SEQ', seq);
  insert into said select 'CRATE', coalesce(sum(count) filter (where def = 'log'), 0) || '|' || coalesce(sum(count) filter (where def = 'nail'), 0)
    || '|' || coalesce(sum(count) filter (where def = 'hatchet'), 0) from item where holder = 'crate' and crate = v_crate and world_id = w;
  insert into said select 'BINS', (select coalesce(sum(count), 0) from item where placed = v_raw and def = 'log') || '|'
    || (select coalesce(sum(count), 0) from item where placed = v_craft and def = 'nail');
  insert into said select 'KEPT', (select coalesce(sum(count), 0) from item where placed = v_larder and def = 'flour') || '|'
    || (select coalesce(sum(count), 0) from item where placed = v_chest and def = 'log') || '|'
    || (select coalesce(sum(count), 0) from item where placed = v_shelf and def = 'log' and locked);
  insert into said select 'IDLE', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') || '|' || work_range(c) from creature c where world_id = w and id = m;

  -- What the idle magga's look for something to sort costs, with nothing to sort.
  v_t0 := clock_timestamp();
  for i in 1..20 loop perform sort_stack(w, c, ${T} + 0.5, ${T} + 0.5) from creature c where c.world_id = w and c.id = m; end loop;
  v_ms := extract(epoch from clock_timestamp() - v_t0) * 1000 / 20;
  insert into said values ('COST', round(v_ms::numeric, 3)::text);
  -- Against the ring search for something lying about, which it follows only when that came back empty.
  v_t0 := clock_timestamp();
  perform find_work_tile(w, ${T}, ${T}, work_range(c), 'fetch', c) from creature c where c.world_id = w and c.id = m;
  insert into said values ('RING', round((extract(epoch from clock_timestamp() - v_t0) * 1000)::numeric, 3)::text);

  -- The raw bin four short of full, and ten more logs in the crate.
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_raw, 'dirt', 30, ${cap - LOGS - 4});
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', v_crate, 'log', 30, ${MORE});
  seq := ''; v_last := '';
  for i in 1..80 loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
    select coalesce(carrying->>'def', '') || coalesce(':' || (carrying->>'count'), '') into v_now from creature where world_id = w and id = m;
    if v_now <> v_last then
      if v_now <> '' then seq := seq || case when seq = '' then '' else ',' end || v_now; end if;
      v_last := v_now;
    end if;
  end loop;
  insert into said values ('FULLSEQ', seq);
  insert into said select 'FULL', (select coalesce(sum(count), 0) from item where holder = 'crate' and crate = v_crate and def = 'log') || '|'
    || (select coalesce(sum(count), 0) from item where placed = v_raw and def = 'log');
  insert into said select 'FULLIDLE', coalesce(idle_why, '') || '|' || coalesce(idle_n::text, '') from creature where world_id = w and id = m;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const islandIdle = (k: string): Idle | null => {
  const [why, n] = (isle.get(k) ?? '').split('|');
  return why ? { why: why as IdleWhy, n: Number(n || 0) } : null;
};

/* ---- the two side by side -------------------------------------------------- */

check('the crate stands where both sides say', isle.get('CRATEXY') === `${ccx}, ${ccy}`, `${isle.get('CRATEXY')} / ${ccx}, ${ccy}`);
check('the hatchet lying on the ground is carried first, then the logs and then the nails, on both sides',
  isle.get('SEQ') === 'hatchet,log,nail' && browser.seq === 'hatchet,log,nail', `${isle.get('SEQ')} / ${browser.seq}`);
check(`the ${LOGS} logs go to the raw material bin and the ${NAILS} nails to the craft material bin`,
  isle.get('BINS') === `${LOGS}|${NAILS}` && browser.bins === `${LOGS}|${NAILS}`, `${isle.get('BINS')} / ${browser.bins}`);
check('and the crate keeps the hatchet it was given, which no bin takes',
  isle.get('CRATE') === '0|0|1' && browser.crate === '0|0|1', `${isle.get('CRATE')} / ${browser.crate}`);
check('never out of a bin (a larder of flour), a padlocked chest or a locked stack',
  isle.get('KEPT') === '5|3|4' && browser.kept === '5|3|4', `${isle.get('KEPT')} / ${browser.kept}`);
const reach = workRangeOf(magga, SPECIES.magga);
const sentence = idleSays({ why: 'range', n: reach }, 'fetch');
const says = (idle: Idle | null): string => (idle ? idleSays(idle, SPECIES.magga.gathers as GatherKind) : '');
check(`with nothing to sort: "${sentence}" on both sides`,
  islandIdle('IDLE')?.why === 'range' && magga.idle !== null && says(islandIdle('IDLE')) === sentence
    && browser.idle === `range|${reach}` && Number((isle.get('IDLE') ?? '').split('|')[2]) === reach,
  `${isle.get('IDLE')} / ${browser.idle}`);
check('the look for something to sort, with nothing to sort, costs less than the ring search for something lying about it follows',
  Number(isle.get('COST')) < Number(isle.get('RING')), `${isle.get('COST')} ms against ${isle.get('RING')} ms`);
check(`the raw bin four short of full: four of ${MORE} more logs go in, ${MORE - 4} stay, on both sides`,
  isle.get('FULL') === `${MORE - 4}|${LOGS + 4}` && `${browserFull.crate}|${browserFull.bin}` === `${MORE - 4}|${LOGS + 4}`,
  `${isle.get('FULL')} / ${browserFull.crate}|${browserFull.bin} — carried ${isle.get('FULLSEQ')} / ${browserFull.seq}`);
check('one load of four, and nothing more once the bin is full', isle.get('FULLSEQ') === 'log:4' && browserFull.seq === 'log',
  `${isle.get('FULLSEQ')} / ${browserFull.seq}`);
check('and it says why it stands idle again, the same on both sides',
  islandIdle('FULLIDLE')?.why === 'range' && browserFull.idle === `range|${reach}`, `${isle.get('FULLIDLE')} / ${browserFull.idle}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na magga sorts the bins — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
