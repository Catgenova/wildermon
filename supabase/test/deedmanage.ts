/**
 * A settlement at a glance: ranks, permissions, upkeep, specialties, guards,
 * orders and a visitor log in the one Settlement window, on the island.
 *
 * Asked for: "Deed and settlement management. Put ranks, permissions,
 * upkeep and specialties in one clear panel, plus a visitor log and guard
 * settings." This holds the island and the window to each other, on an
 * island of its own (Deedwatch) that it makes and takes away again:
 *
 *   * the island: the two new powers and the visitor log's limits are the
 *     browser's (`RANK_POWERS`, `visitors.ts`);
 *   * a stranger walking onto the settlement is written down once an hour,
 *     however often they move in it; its founder and its citizens are not;
 *     a walk outside its border writes nothing; a visit older than
 *     `VISIT_KEEP_DAYS` goes at the hourly sweep, and nothing younger;
 *   * `rpc_deed_watch` lists each visitor once, latest first, with their first
 *     and last hour and hours seen, to the founder and a rank holding Visitor
 *     log, and says the browser's own sentence to a rank without it and to a
 *     stranger;
 *   * `rpc_deed_orders` sets every settlement worker on it, its founder's and
 *     its citizens', to one stance, for the founder and a rank holding
 *     Wildermon orders, refusing anybody else in the browser's words; and a
 *     wildermon assigned after takes the orders;
 *   * writing the visit costs `rpc_move` little: the note on its own is timed
 *     on a walk inside a settlement and outside every one;
 *   * the window, in Chromium, drawn from the island's own `rpc_social` and
 *     `rpc_deed_watch` answers: six tabs; every rank's permissions on one
 *     grid, ticked as the island has them, a tick one click that the island
 *     then holds; each worker's upkeep, soonest first; each trade against
 *     `SPECIALTY_AT` with the wildermon that would add to it, one click to
 *     assign (`assign_deed`); the orders the island set, and a click that sets
 *     others; the island's visitors; and on a phone nothing off the side of
 *     the window.
 *
 * Pictures of each tab at desktop and phone width, when `DEED_SHOTS` names a
 * folder. Needs a Chromium for its second half, as `care.ts` finds one; with
 * none it says so, and fails only when `CROWD_STRICT` is set, as it is in CI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { lacksSaid, powerBit, RANK_POWERS } from '../../src/game/ranks';
import { VISIT_KEEP_DAYS, VISIT_LIST_MAX, type DeedWatch } from '../../src/game/visitors';
import { DEED_TABS } from '../../src/ui/panels/deed';
import { SPECIALTY_AT, UNFED_PACE, UPKEEP_FOR } from '../../src/game/creatures';
import { percent, waitWords } from '../../src/game/words';
import type { Social } from '../../src/net/island';

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

const BOSS = 'd1660000-0000-4000-8000-00000000000b';
const CIT = 'd1660000-0000-4000-8000-00000000000c';
const STRANGER = 'd1660000-0000-4000-8000-00000000000d';
const OTHER = 'd1660000-0000-4000-8000-00000000000e';
const DX = 30, DY = 30, RADIUS = 5;
/** The island's world id, once made. */
let W = '';

/** As somebody: the claims set, then the statement. */
const as = (uid: string, sql: string): string =>
  psql(`select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, false) \\g /dev/null
delete from caller where uid = '${uid}';
${sql}`).split('\n').pop() ?? '';

/** A step from one point to another, ten seconds after the last word (`rpc_move`); where the island put you. */
function step(uid: string, x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  psql(`update player set x = ${x0}, y = ${y0}, level = 0, away = false, body_at = now(), walk_ahead = 0,
    moved_at = now() - interval '10 seconds' where world_id = '${W}' and uid = '${uid}';`);
  return JSON.parse(as(uid, `select rpc_move('${W}', ${x1}, ${y1}, 0)::text;`)) as { x: number; y: number };
}

const visits = (uid: string): number => Number(psql(`select count(*) from private.deed_visit where world_id = '${W}' and uid = '${uid}'`));

/* ---- the island -------------------------------------------------------------- */

console.log('--- the powers and the limits, on both sides');
const listed = psql(`select string_agg(id || '|' || bit || '|' || may || '|' || may_not || '|' || power_bit(id), E'\\n' order by bit)
  from rank_power where id in ('visitors', 'orders');`);
const want = RANK_POWERS.filter((p) => p.id === 'visitors' || p.id === 'orders')
  .map((p) => `${p.id}|${p.bit}|${p.may}|${p.mayNot}|${powerBit(p.id)}`).join('\n');
check('Visitor log and Wildermon orders: the same bits and words on the island', listed === want, `${listed} / ${want}`);
const limits = psql('select private.visit_keep_days() || \'|\' || private.visit_list_max()');
check('how long a visit is kept and how many are listed are the browser\'s', limits === `${VISIT_KEEP_DAYS}|${VISIT_LIST_MAX}`, limits);
const swept = psql(`select to_regclass('cron.job') is not null`) === 't'
  ? psql(`select count(*) from cron.job where jobname = 'deed-visit-keep'`) : 'no cron';
check('the hourly keeping is wound, where the island has a schedule', swept === '1' || swept === 'no cron', swept);

psql(`delete from world where name = 'Deedwatch';`);
W = psql(`
insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Deedwatch', 166, 64, 10, 10, true) returning id \\gset w_
select land_blank(:'w_id'::uuid, 64) \\g /dev/null
insert into auth.users (id) values ('${BOSS}'), ('${CIT}'), ('${STRANGER}'), ('${OTHER}') on conflict do nothing;
insert into account (uid, name) values ('${BOSS}', 'wardboss'), ('${CIT}', 'wardcit'), ('${STRANGER}', 'wardpasser'), ('${OTHER}', 'wardother')
  on conflict do nothing;
select :'w_id';`).split('\n').pop() ?? '';
for (const [uid, name] of [[BOSS, 'Boss'], [CIT, 'Cit'], [STRANGER, 'Passer'], [OTHER, 'Other']]) as(uid, `select rpc_join('${W}', '${name}') \\g /dev/null`);
psql(`
insert into deed (world_id, name, x, y, radius, level, founded_by) values ('${W}', 'Wardstead', ${DX}, ${DY}, ${RADIUS}, 2, '${BOSS}');
insert into deed_member (world_id, founder, uid) values ('${W}', '${BOSS}', '${CIT}');`);
const deedName = 'Wardstead';
const citRank = psql(`select r.name from deed_member m join deed_rank_def r on r.id = m.rank_id where m.world_id = '${W}' and m.uid = '${CIT}'`);

try {
  console.log('--- a visitor written down, once an hour');
  const edge = DX + RADIUS + 1.5;
  step(STRANGER, edge + 1, DY + 0.5, edge, DY + 0.5);
  check('a walk outside the border writes nothing', visits(STRANGER) === 0, String(visits(STRANGER)));
  const went = step(STRANGER, edge, DY + 0.5, DX + RADIUS + 0.5, DY + 0.5);
  check('a stranger walking over the border is written down', visits(STRANGER) === 1 && Math.floor(went.x) === DX + RADIUS, `${visits(STRANGER)} at ${went.x}`);
  step(STRANGER, DX + RADIUS + 0.5, DY + 0.5, DX + RADIUS - 0.5, DY + 0.5);
  step(STRANGER, DX + RADIUS - 0.5, DY + 0.5, DX + RADIUS - 1.5, DY + 1.5);
  check('and walking on inside it the same hour writes nothing more', visits(STRANGER) === 1, String(visits(STRANGER)));
  step(STRANGER, DX + 0.5, DY + 0.5, DX + 0.8, DY + 0.5);
  check('a step inside one tile is not even asked', visits(STRANGER) === 1, String(visits(STRANGER)));
  step(CIT, edge, DY + 0.5, DX + RADIUS + 0.5, DY + 0.5);
  step(BOSS, edge, DY + 0.5, DX + RADIUS + 0.5, DY + 0.5);
  check('its citizen and its founder are not visitors', visits(CIT) === 0 && visits(BOSS) === 0, `${visits(CIT)}, ${visits(BOSS)}`);
  // Two older hours by hand: one within the keeping, one past it.
  psql(`insert into private.deed_visit (world_id, founder, uid, hour) values
    ('${W}', '${BOSS}', '${STRANGER}', date_trunc('hour', now()) - interval '3 hours'),
    ('${W}', '${BOSS}', '${STRANGER}', date_trunc('hour', now()) - make_interval(days => ${VISIT_KEEP_DAYS}, hours => 1)),
    ('${W}', '${BOSS}', '${OTHER}', date_trunc('hour', now()) - interval '1 day');`);
  const gone = psql('select private.deed_visit_sweep()');
  check(`the sweep lets go of a visit past ${VISIT_KEEP_DAYS} days and nothing younger`, Number(gone) >= 1 && visits(STRANGER) === 2 && visits(OTHER) === 1,
    `${gone} gone, ${visits(STRANGER)} and ${visits(OTHER)} left`);

  console.log('--- the watch, read');
  const boss = JSON.parse(as(BOSS, `select rpc_deed_watch('${W}', '${BOSS}')::text;`)) as DeedWatch;
  const v = boss.visitors ?? [];
  const hourNow = Math.floor(Date.now() / 3600000) * 3600;
  check('its founder reads each visitor once, latest first', v.map((e) => e.name).join(',') === 'wardpasser,wardother' && boss.total === 2,
    JSON.stringify(boss));
  check('with the last and first hour and the hours seen', v[0]?.hours === 2 && Math.abs((v[0]?.last ?? 0) - hourNow) <= 3600
    && (v[0]?.last ?? 0) - (v[0]?.first ?? 0) === 3 * 3600, JSON.stringify(v[0]));
  const cit = JSON.parse(as(CIT, `select rpc_deed_watch('${W}', '${BOSS}')::text;`)) as DeedWatch;
  check('a rank without Visitor log is told why, in the browser\'s words', !cit.visitors && cit.visitorsWhy === lacksSaid(deedName, citRank, 'visitors'),
    `${cit.visitorsWhy}`);
  check('and may not set the orders', cit.order === false && boss.order === true, `${cit.order} ${boss.order}`);
  const stranger = JSON.parse(as(STRANGER, `select rpc_deed_watch('${W}', '${BOSS}')::text;`)) as { why?: string };
  check('a stranger reads nothing of it', stranger.why === `You are not a citizen of ${deedName}.`, JSON.stringify(stranger));

  console.log('--- the orders');
  const guard = psql(`select id from species_def where gathers = 'guard' order by id limit 1`);
  psql(`
  select creature_spawn('${W}', 'bevere', ${DX + 1.5}, ${DY + 1.5}, 'deed', null, '${BOSS}') \\g /dev/null
  select creature_spawn('${W}', '${guard}', ${DX + 2.5}, ${DY + 1.5}, 'deed', null, '${BOSS}') \\g /dev/null
  select creature_spawn('${W}', 'bevere', ${DX - 1.5}, ${DY + 1.5}, 'deed', null, '${CIT}') \\g /dev/null
  select creature_spawn('${W}', 'bevere', ${DX - 2.5}, ${DY + 1.5}, 'active', null, '${BOSS}') \\g /dev/null
  update creature set stance = 'defensive' where world_id = '${W}';
  update creature set stance = 'guard' where world_id = '${W}' and mode = 'active';`);
  const citWhy = JSON.parse(as(CIT, `select rpc_deed_orders('${W}', '${BOSS}', 'aggressive')::text;`)) as { why?: string };
  check('a rank without Wildermon orders is refused in the browser\'s words', citWhy.why === lacksSaid(deedName, citRank, 'orders'), JSON.stringify(citWhy));
  const badStance = JSON.parse(as(BOSS, `select rpc_deed_orders('${W}', '${BOSS}', 'guard')::text;`)) as { why?: string };
  check('Guarding you is not one of a settlement\'s orders', badStance.why === 'Passive, defensive or aggressive.', JSON.stringify(badStance));
  const rid = psql(`select rank_id from deed_member where world_id = '${W}' and uid = '${CIT}'`);
  as(BOSS, `select rpc_rank_allow('${W}', ${rid}, 'orders', true) \\g /dev/null`);
  const set = JSON.parse(as(CIT, `select rpc_deed_orders('${W}', '${BOSS}', 'aggressive')::text;`)) as { orders?: string; changed?: number };
  const stances = psql(`select string_agg(stance, ',' order by id) from creature where world_id = '${W}' and mode = 'deed'`);
  check('given Wildermon orders, the rank sets every settlement worker, its founder\'s and a citizen\'s', set.orders === 'aggressive' && set.changed === 3
    && stances === 'aggressive,aggressive,aggressive', `${JSON.stringify(set)} ${stances}`);
  psql(`update creature set mode = 'deed' where world_id = '${W}' and mode = 'active';`);
  const after = psql(`select stance from creature where world_id = '${W}' order by id desc limit 1`);
  check('and a wildermon assigned after takes the orders', after === 'aggressive', after);
  const watched = JSON.parse(as(BOSS, `select rpc_deed_watch('${W}', '${BOSS}')::text;`)) as DeedWatch;
  check('the watch says the orders, the workers by stance and the guards', watched.orders === 'aggressive' && watched.stances.aggressive === 4
    && watched.guards === 1, JSON.stringify({ o: watched.orders, s: watched.stances, g: watched.guards }));

  console.log('--- what writing a visit costs a walk');
  const cost = (x: number): number => Number(psql(`
    do $$ declare t0 timestamptz := clock_timestamp(); begin
      for i in 1 .. 500 loop perform private.deed_visit_note('${W}', '${STRANGER}', ${x}, ${DY + 0.5}); end loop;
      perform set_config('my.us', (extract(epoch from clock_timestamp() - t0) * 1e6 / 500)::text, false); end $$;
    select current_setting('my.us');`).split('\n').pop());
  const inside = cost(DX + 0.5), outside = cost(5.5);
  const move = Number(psql(`
    select set_config('request.jwt.claims', json_build_object('sub', '${STRANGER}')::text, false) \\g /dev/null
    do $$ declare t0 timestamptz; s double precision := 0; begin
      for i in 1 .. 40 loop
        delete from caller where uid = '${STRANGER}';
        update player set x = ${DX + 0.5} + (i % 2), y = ${DY + 0.5}, level = 0, walk_ahead = 0, moved_at = now() - interval '10 seconds'
          where world_id = '${W}' and uid = '${STRANGER}';
        t0 := clock_timestamp();
        perform rpc_move('${W}', ${DX + 1.5} - (i % 2), ${DY + 0.5}, 0);
        s := s + extract(epoch from clock_timestamp() - t0);
      end loop;
      perform set_config('my.us', (s * 1e6 / 40)::text, false); end $$;
    select current_setting('my.us');`).split('\n').pop());
  console.log(`    the note: ${inside.toFixed(1)} us inside a settlement (written already this hour), ${outside.toFixed(1)} us outside every one;`
    + ` a whole rpc_move over a tile line inside: ${move.toFixed(0)} us`);
  check('the note costs a walk under a twentieth of the move it rides on', inside < move / 20 + 50 && outside < move / 20 + 50,
    `${inside.toFixed(1)} / ${outside.toFixed(1)} us against ${move.toFixed(0)} us`);
} catch (e) {
  check('the island half ran', false, String(e).slice(0, 400));
}

/* ---- the window ------------------------------------------------------------- */

/** A Chromium to drive, as `care.ts` finds one, or null. */
function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

const shots = process.env.DEED_SHOTS;
const options = browserOptions();
const socialOf = (uid: string): Social => JSON.parse(as(uid, `select rpc_social('${W}')::text;`)) as Social;
const watchOf = (uid: string): DeedWatch => JSON.parse(as(uid, `select rpc_deed_watch('${W}', '${BOSS}')::text;`)) as DeedWatch;

interface Shown {
  tabs: string[]; on: string[]; heads: string[]; rows: string[]; notes: string[]; boxes: string[]; ranks: string[]; trades: string[]; powers: string[];
  orders: string[]; assign: string[]; visits: string[]; overflow: number; outside: string[];
}
interface Driven {
  asks: Array<{ action: string; target: { id?: number; job?: string } }>;
  calls: unknown[][];
  load: (s: Social, w: unknown) => void;
  open: () => void;
  tab: (label: string) => boolean;
  run: (ms: number) => void;
  read: () => Shown;
  click: (sel: string, starts?: string) => boolean;
  box: (rank: number, power: string) => boolean;
  scrollTo: (sel: string) => void;
}
const drive = <T>(tab: Page, fn: (c: Driven, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { deedmanage: Driven }).deedmanage, a), [fn.toString(), arg] as const) as Promise<T>;

if (!options) {
  console.log('deedmanage: no Chromium here (set CHROME_PATH), so the window was not drawn.');
  if (process.env.CROWD_STRICT) check('a Chromium to draw the window in', false);
} else if (W) {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/deedmanage-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const script = bundled.outputFiles[0].text;
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  const page = async (phone: boolean): Promise<{ tab: Page; thrown: string[]; close: () => Promise<void> }> => {
    const ctx = await browser.newContext(phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: `(() => {
      let t = performance.now();
      const d0 = Date.now() - t;
      performance.now = () => t;
      Date.now = () => d0 + t;
      window.driven = { tick: (ms) => { t += ms; } };
    })();` });
    await tab.addScriptTag({ content: script });
    return { tab, thrown, close: () => ctx.close() };
  };
  try {
    const { tab, thrown, close } = await page(false);
    await drive(tab, (c, a) => c.load((a as [Social, unknown])[0], (a as [Social, unknown])[1]), [socialOf(BOSS), watchOf(BOSS)]);
    await drive(tab, (c) => c.open());
    let shown = await drive(tab, (c) => c.read());
    check('six tabs, Settlement first', shown.tabs.join(',') === DEED_TABS.map((t) => t[1]).join(','), shown.tabs.join(','));
    if (shots) await tab.screenshot({ path: `${shots}/after-settlement-desktop.png` });

    // Change a rank's permission: the window (1), the Ranks tab (2), the box (3).
    await drive(tab, (c) => c.tab('Ranks'));
    shown = await drive(tab, (c) => c.read());
    const social = socialOf(BOSS);
    const defs = [...(social.deeds[0].defs ?? [])].sort((a, b) => a.ord - b.ord);
    check('the Ranks tab: a column a rank, highest first, as the island lists them', shown.ranks.join(',') === defs.map((r) => r.name).join(','), shown.ranks.join(','));
    check('and a row a power, in the order of RANK_POWERS', shown.powers.join(',') === RANK_POWERS.map((p) => p.label).join(','), String(shown.powers.length));
    const want = defs.flatMap((r) => RANK_POWERS.map((p) => `${r.id}:${p.id}:${(r.perms & powerBit(p.id)) !== 0 ? 1 : 0}:on`));
    const gotBoxes = [...shown.boxes].sort().join(' ');
    check('every box ticked where the island\'s rank holds the power, and the founder may tick them', gotBoxes === [...want].sort().join(' '),
      `${shown.boxes.length} boxes, ${want.length} wanted`);
    if (shots) await tab.screenshot({ path: `${shots}/after-ranks-desktop.png` });
    const builder = defs.find((r) => r.name === citRank)!;
    await drive(tab, (c, a) => c.box(a as number, 'visitors'), builder.id);
    const asked = await drive(tab, (c) => c.calls.slice());
    check('one click on a box asks the island to give that rank that power', JSON.stringify(asked.at(-1)) === JSON.stringify(['allow', builder.id, 'visitors', true]),
      JSON.stringify(asked));
    const gave = JSON.parse(as(BOSS, `select rpc_rank_allow('${W}', ${builder.id}, 'visitors', true)::text;`)) as { why?: string };
    await drive(tab, (c, a) => c.load((a as [Social, unknown])[0], (a as [Social, unknown])[1]), [socialOf(BOSS), watchOf(BOSS)]);
    await drive(tab, (c) => c.run(1000));
    shown = await drive(tab, (c) => c.read());
    check('the island gives it, and the box reads ticked from its answer', !gave.why && shown.boxes.includes(`${builder.id}:visitors:1:on`), JSON.stringify(gave));
    const citWatch = watchOf(CIT);
    check(`and the ${citRank} reads the visitor log now`, Array.isArray(citWatch.visitors) && citWatch.visitors.length === 2, JSON.stringify(citWatch.visitors?.length));

    // See upkeep due and set a specialty: the window (1), the Workers tab (2), Assign (3).
    await drive(tab, (c) => c.tab('Workers'));
    await drive(tab, (c) => c.run(1000));
    shown = await drive(tab, (c) => c.read());
    const upkeep = shown.rows.filter((r) => /unfed/.test(r));
    check('the Workers tab: each worker\'s upkeep, the unfed first and then the soonest due',
      upkeep.map((r) => r.replace(/(fed|unfed).*/, '')).join(',') === 'Alder,Bramble,Clod,Rowan' && upkeep[0].endsWith(`unfed · pace ${percent(UNFED_PACE)}`)
        && upkeep[1].includes(`fed 80% · unfed in ${waitWords(UPKEEP_FOR * 0.1)}`), upkeep.join(' / '));
    const trades = shown.trades;
    check(`each trade against ${SPECIALTY_AT}: a specialty at three, and two short of one`,
      trades.some((r) => r.startsWith('Felling trees') && r.includes('3 · +10%')) && trades.some((r) => r.startsWith('Digging clay') && r.includes(`1/${SPECIALTY_AT}`)),
      trades.join(' / '));
    check('with the wildermon following you that would add to it', shown.assign.join(',') === 'Loam · following:on', shown.assign.join(','));
    await drive(tab, (c) => c.click('.deed-candidate button', 'Assign'));
    const jobs = await drive(tab, (c) => c.asks.slice());
    check('and one click assigns it (assign_deed)', jobs.length === 1 && jobs[0].action === 'assign_deed' && jobs[0].target.id === 205, JSON.stringify(jobs));
    const islandOrders = watchOf(BOSS).orders;
    check('the orders the island set read on, the founder may change them',
      shown.orders.join(',') === ['passive:0:on', 'defensive:0:on', 'aggressive:1:on'].join(',') && islandOrders === 'aggressive', shown.orders.join(','));
    if (shots) await tab.screenshot({ path: `${shots}/after-workers-desktop.png` });
    await drive(tab, (c) => c.click('.deed-orders button', 'Defensive'));
    const ordered = await drive(tab, (c) => c.calls.at(-1));
    check('a click sets the orders on the island', JSON.stringify(ordered) === JSON.stringify(['orders', social.deeds[0].founder, 'defensive']), JSON.stringify(ordered));
    const put = JSON.parse(as(BOSS, `select rpc_deed_orders('${W}', '${BOSS}', 'defensive')::text;`)) as { orders?: string; changed?: number };
    check('which takes them', put.orders === 'defensive' && put.changed === 4, JSON.stringify(put));

    // See who visited: the window (1), the Visitors tab (2).
    await drive(tab, (c, a) => c.load((a as [Social, unknown])[0], (a as [Social, unknown])[1]), [socialOf(BOSS), watchOf(BOSS)]);
    await drive(tab, (c) => c.tab('Visitors'));
    await drive(tab, (c) => c.run(1000));
    shown = await drive(tab, (c) => c.read());
    check('the Visitors tab: the island\'s visitors, latest first, with when and how many hours',
      shown.visits.length === 2 && shown.visits[0] === 'wardpasser|this hour|2' && /^wardother\|1 d ago\|1$/.test(shown.visits[1]), shown.visits.join(' / '));
    if (shots) await tab.screenshot({ path: `${shots}/after-visitors-desktop.png` });
    if (thrown.length) check('and the page threw nothing', false, thrown.join('; '));
    await close();

    /* ---- a phone ---------------------------------------------------------- */
    const p = await page(true);
    await drive(p.tab, (c, a) => c.load((a as [Social, unknown])[0], (a as [Social, unknown])[1]), [socialOf(BOSS), watchOf(BOSS)]);
    await drive(p.tab, (c) => c.open());
    for (const t of ['Settlement', 'Ranks', 'Workers', 'Visitors']) {
      await drive(p.tab, (c, a) => c.tab(a as string), t);
      await drive(p.tab, (c) => c.run(500));
      const lay = await drive(p.tab, (c) => c.read());
      check(`on a phone, the ${t} tab: nothing off the side of the window`, lay.overflow <= 0 && lay.outside.length === 0,
        `${lay.overflow} ${lay.outside.join(', ')}`);
      if (shots) await p.tab.screenshot({ path: `${shots}/after-${t.toLowerCase()}-phone.png` });
    }
    if (p.thrown.length) check('and the phone page threw nothing', false, p.thrown.join('; '));
    await p.close();
  } finally {
    await browser.close();
  }
}

psql(`delete from world where name = 'Deedwatch';`);
for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
