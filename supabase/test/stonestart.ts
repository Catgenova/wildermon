/**
 * A first join picks its Runestone and starts beside it (`START_GAP`,
 * `START_RING`, `startChoices` in runestones.ts; `rpc_join`'s `p_stone` and
 * `start_landing` on the island).
 *
 * Asked for: "new players should select between the 5 runestones for
 * spawning, and spawn 2 tiles away from that stone on selection". So this
 * asks, of the island:
 *
 *   * the tiles a newcomer may start on round a stone, and their order, are
 *     the browser's (`start_ring` against `START_RING`): the ring `START_GAP`
 *     tiles out from the stone's edge first, then each ring past it;
 *   * a newcomer who picks each of the five starts on the first tile of that
 *     ring, exactly `START_GAP` tiles from the stone's edge, on a tile a body
 *     stands on (passable, dry, no stone's, no building, not too steep), and
 *     the join's answer says the body is there;
 *   * with every tile of that ring built on, the next ring out;
 *   * a stone that is not one is refused at the door, and nobody is made;
 *   * somebody already on the island is where they were, whatever they pick;
 *   * no stone named, or a world the stones do not stand on, is the spawn;
 *
 * and of the browser:
 *
 *   * `startChoices` is all five for a first join on a world the stones stand
 *     on, and none for somebody coming back or on a test's world;
 *   * `Island.firstJoin` says first only when the island has no body of this
 *     account and says how big it is, and says not first when a read fails;
 *   * in Chromium (`stonestart-page.ts`), the chooser on the boot card shows
 *     the five, by name and where each stands, for a first join only, and
 *     answers with the one clicked. Needs a Chromium as `noplan.ts` does;
 *     without one that part is skipped, unless `STONESTART_STRICT` is set.
 *
 * Runs against the database the suite leaves behind; the island half is
 * rolled back.
 *
 *   npx esbuild supabase/test/stonestart.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/stonestart.mjs && node node_modules/.cache/stonestart.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import {
  RUNESTONES, START_GAP, START_RING, START_SPARE, STONE_HALF, STONE_LEAST, startChoices, stoneCentre,
} from '../../src/game/runestones';
import { Island } from '../../src/net/island';
import { supabase } from '../../src/net/supabase';
import type { StoneCard } from './stonestart-page';

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

/* ---- the island ------------------------------------------------------------ */

const N = 1024;
const SPAWN = 5;
/** A newcomer for each stone, by its place in `RUNESTONES`; and the rest. */
const uidOf = (i: number): string => `57a7e000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
const BACK = uidOf(10);
const NONE = uidOf(11);
const RING = uidOf(12);
const WRONG = uidOf(13);
const SMALL = uidOf(14);
const chebyshev = (x: number, y: number, c: { x: number; y: number }): number => Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
const crown = stoneCentre(RUNESTONES[0], N);
const near = STONE_HALF + START_GAP;

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.joined(w uuid, u uuid, p_stone text) returns text language plpgsql as $f$
declare j jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
  j := rpc_join(w, 'Newcomer', p_stone);
  return (j->'you'->>'x') || ',' || (j->'you'->>'y') || ',' || (j->>'new')
    || '|' || (select p.x || ',' || p.y from player p where p.world_id = w and p.uid = u);
exception when others then
  return 'ERR ' || sqlerrm || '|' || (select count(*) from player p where p.world_id = w and p.uid = u);
end $f$;
-- Whether a tile is one a body may start on, by the Telestone's own terms.
create function pg_temp.free(w uuid, x int, y int) returns text language sql as $f$
  select passable(w, x, y) || ',' || (not has_water(w, x, y)) || ',' || (runestone_at(w, x, y) is null)
    || ',' || (tile_slope(w, x, y) <= landing_stand()) || ',' || (building_at(w, x, y) is null)
$f$;
insert into said select 'RING', string_agg(k || ':' || dx || ',' || dy, ' ' order by k) from start_ring();
do $t$
declare w uuid; ws uuid; s record; v text; c record; k int := 0;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stonestart', 4246, ${N}, ${SPAWN}, ${SPAWN}, true) returning id into w;
  perform land_blank(w, ${N});
  -- Dry and level west of x 1000, where every stone stands on a world this size; the sea east of it.
  update land_corner set heights = decode(repeat('0a00', 1000) || repeat('d8ff', ${N + 1 - 1000}), 'hex') where world_id = w;

  -- 1. A newcomer picking each stone.
  for s in select * from runestones() order by ord loop
    v := pg_temp.joined(w, ('57a7e000-0000-4000-8000-' || lpad((s.ord + 1)::text, 12, '0'))::uuid, s.id);
    insert into said values ('AT:' || s.ord, v);
    insert into said values ('FREE:' || s.ord, pg_temp.free(w, floor(split_part(v, ',', 1)::double precision)::int,
                                                              floor(split_part(v, ',', 2)::double precision)::int));
  end loop;

  -- 2. Somebody already on the island, picking another stone: where they were.
  perform pg_temp.joined(w, '${BACK}', null);
  update player set x = 40.5, y = 41.5 where world_id = w and uid = '${BACK}';
  insert into said values ('BACK', pg_temp.joined(w, '${BACK}', 'sunreach'));

  -- 3. No stone named: the spawn.
  insert into said values ('NONE', pg_temp.joined(w, '${NONE}', null));

  -- 4. Every tile of the near ring round the Crownstone built on: the next ring out.
  insert into building (world_id, id, name) values (w, 9401, 'Ring');
  insert into building_tile (world_id, building, x, y)
  select w, 9401, ${crown.x} + r.dx, ${crown.y} + r.dy from start_ring() r
   where greatest(abs(r.dx), abs(r.dy)) = ${near};
  insert into said values ('RING4', pg_temp.joined(w, '${RING}', 'crownstone'));

  -- 5. A stone that is not one: refused, and nobody made.
  insert into said values ('WRONG', pg_temp.joined(w, '${WRONG}', 'atlantis'));

  -- 6. A world the stones do not stand on: the spawn.
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stoneless', 4247, 64, 7, 9, true) returning id into ws;
  perform land_blank(ws, 64);
  insert into said values ('SMALL', pg_temp.joined(ws, '${SMALL}', 'crownstone'));
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}

const ringWant = START_RING.map(([dx, dy], k) => `${k}:${dx},${dy}`).join(' ');
check(`the tiles a newcomer may start on round a stone, in order, are the browser's: ${START_RING.length} tiles, rings ${near} to ${near + START_SPARE} from its centre`,
  said.get('RING') === ringWant, said.get('RING') === ringWant ? '' : said.get('RING'));
check(`the first of them is ${START_GAP} tiles from the stone's edge`,
  Math.max(Math.abs(START_RING[0][0]), Math.abs(START_RING[0][1])) === near, START_RING[0].join(','));

/** "x,y,new|x,y" off `pg_temp.joined`: where the answer put the body, whether it was made, and where its row is. */
const parse = (v: string | undefined): { x: number; y: number; made: boolean; row: string } | null => {
  const m = /^([\d.]+),([\d.]+),(true|false)\|(.*)$/.exec(v ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]), made: m[3] === 'true', row: m[4] } : null;
};

RUNESTONES.forEach((s, i) => {
  const c = stoneCentre(s, N);
  const got = parse(said.get(`AT:${i}`));
  const want = { x: c.x + START_RING[0][0] + 0.5, y: c.y + START_RING[0][1] + 0.5 };
  const tx = got ? Math.floor(got.x) : NaN;
  const ty = got ? Math.floor(got.y) : NaN;
  check(`a newcomer picking ${s.name} (${s.place}) starts on the first tile of the near ring, ${want.x},${want.y}`,
    !!got && got.made && got.x === want.x && got.y === want.y, said.get(`AT:${i}`));
  check(`  ${START_GAP} tiles from its edge (${near} from its centre)`, chebyshev(tx, ty, c) - STONE_HALF === START_GAP, `${tx},${ty}`);
  check('  on a tile a body stands on: passable, dry, no stone\'s, not too steep, no building', said.get(`FREE:${i}`) === 'true,true,true,true,true', said.get(`FREE:${i}`));
  check('  and the join\'s answer is where the body is', !!got && got.row === `${got.x},${got.y}`, got?.row);
});

{
  const got = parse(said.get('RING4'));
  const want = START_RING.find(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy)) === near + 1)!;
  check(`with every tile of the near ring built on, the first of the next ring out: ${crown.x + want[0] + 0.5},${crown.y + want[1] + 0.5}`,
    !!got && got.made && got.x === crown.x + want[0] + 0.5 && got.y === crown.y + want[1] + 0.5
      && chebyshev(Math.floor(got.x), Math.floor(got.y), crown) === near + 1, said.get('RING4'));
}
check('somebody already on the island is where they were, whatever stone they name', said.get('BACK') === '40.5,41.5,false|40.5,41.5', said.get('BACK'));
check('a newcomer naming no stone starts on the spawn', said.get('NONE') === `${SPAWN + 0.5},${SPAWN + 0.5},true|${SPAWN + 0.5},${SPAWN + 0.5}`, said.get('NONE'));
check('a stone that is not one is refused at the door, and nobody is made',
  said.get('WRONG') === 'ERR Bad request: rpc_join p_stone: not a Runestone.|0', said.get('WRONG'));
check(`on a world under ${STONE_LEAST} across, a stone named is the spawn`, said.get('SMALL') === '7.5,9.5,true|7.5,9.5', said.get('SMALL'));

/* ---- the browser ------------------------------------------------------------ */

check(`a first join on the island picks between all ${RUNESTONES.length}`, startChoices(true, 4096).length === RUNESTONES.length && startChoices(true, STONE_LEAST) === RUNESTONES);
check('somebody coming back picks none', startChoices(false, 4096).length === 0);
check(`a first join on a world under ${STONE_LEAST} across picks none`, startChoices(true, 256).length === 0);

{
  // `Island.firstJoin` over a stand-in keeper: the body's row and the island's size, as the account may read them.
  let rows: Record<string, unknown[] | null> = {};
  const sb = supabase() as unknown as Record<string, unknown> & { auth: Record<string, unknown> };
  sb.auth.getSession = async () => ({ data: { session: { access_token: 't', user: { id: 'me' } } }, error: null });
  sb.from = (table: string) => {
    const self: Record<string, unknown> = {};
    for (const k of ['select', 'eq', 'limit']) self[k] = () => self;
    self.then = (done: (v: unknown) => void) => done(rows[table] ? { data: rows[table], error: null } : { data: null, error: { message: 'offline' } });
    return self;
  };
  const isl = new Island({ say: () => {}, ground: () => {}, people: () => {}, pack: () => {} });
  const ask = async (): Promise<string> => { const r = await isl.firstJoin('w'); return `${r.first},${r.size}`; };
  rows = { player: [], world: [{ size: 4096 }] };
  check('firstJoin: no body on the island is a first join, with its size', await ask() === 'true,4096');
  rows = { player: [{ uid: 'me' }], world: [{ size: 4096 }] };
  check('firstJoin: a body on it is not', await ask() === 'false,4096');
  rows = { player: null, world: [{ size: 4096 }] };
  check('firstJoin: a read that fails is not a first join (the join goes on as before)', await ask() === 'false,4096');
  rows = { player: [], world: [] };
  check('firstJoin: an island it may not read is not a first join', (await ask()).startsWith('false'));
}

/* ---- the chooser, drawn ----------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return {};
}

const options = browserOptions();
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = options ? await chromium.launch(options) : null;
} catch {
  browser = null;
}
if (!browser) {
  console.log('stonestart: no Chromium here (set CHROME_PATH); the chooser is not drawn.');
  if (process.env.STONESTART_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/stonestart-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
  });
  try {
    const tab = await (await browser.newContext({ viewport: { width: 960, height: 640 } })).newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = { show: (first: boolean, size: number) => Promise<StoneCard>; pick: (id: string) => Promise<{ answered: string | null; left: number }> };
    const show = (first: boolean, size: number): Promise<StoneCard> =>
      tab.evaluate(([f, n]) => (window as unknown as { stonestart: Page }).stonestart.show(f as boolean, n as number), [first, size]);
    const back = await show(false, 4096);
    check('drawn: coming back, no chooser on the boot card, and the join goes straight on', back.stones.length === 0 && back.head === null && back.at_once, JSON.stringify(back));
    const small = await show(true, 256);
    check('drawn: a first join on a test\'s world, no chooser', small.stones.length === 0 && small.at_once, JSON.stringify(small));
    const first = await show(true, 4096);
    const want = RUNESTONES.map((s) => `${s.id}|${s.name}|${s.place}`);
    check(`drawn: a first join, the ${RUNESTONES.length} stones on the boot card, by name and where each stands`,
      JSON.stringify(first.stones) === JSON.stringify(want) && !first.at_once, first.stones.join('; '));
    check(`drawn: headed with the gap, ${START_GAP} tiles`, first.head === `Starting Runestone: ${START_GAP} tiles from it`, first.head ?? '');
    const picked = await tab.evaluate(() => (window as unknown as { stonestart: Page }).stonestart.pick('wardenfall'));
    check('drawn: a stone clicked is the answer, and the chooser goes', picked.answered === 'wardenfall' && picked.left === 0, JSON.stringify(picked));
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nfirst join beside a Runestone — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
