/**
 * No plan: a bare side of storey 2 and up drawn with no plan model on it.
 *
 * Asked for: "On storey 2+ you can select a wall option 'no plan' that removes
 * the plan model and leaves the wall blank." Put to both sides on a tower two
 * tiles long and two storeys high, storey 2 floored and bare:
 *
 *   * a bare outside side of storey 2 is marked No plan and the mark taken off
 *     again (Mark out), each in the same words on both sides, and said the same;
 *   * refused, in the same words, on the ground storey, on a side inside the
 *     building, off the building, where a wall is planned, a second time, and
 *     a Mark out where there is no mark;
 *   * a wall planned on a marked side clears the mark on both sides; the storey
 *     removed clears its marks, and the building removed clears the rest;
 *   * the mark reaches a fresh browser through the ground read;
 *   * with every bare side marked the storey is as open as it was: the same
 *     `gapText` / `level_gap` sentence, and a roof refused in it on both sides;
 *   * and drawn in Chromium (`noplan-page.ts`): no plan model on a marked side
 *     and one on every other bare side, the menu offering No plan on a bare
 *     outside side of storey 2, Mark out on a marked one, and neither on the
 *     ground storey nor inside. Needs a Chromium as `storeyview.ts` does;
 *     without one the drawing is skipped, unless `STOREY_STRICT` is set.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it. The tower is building 9301 at (6, 52) and (7, 52), taken down after,
 * and Dane put back where he was.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ACTION_BY_ID } from '../../src/game/actions';
import { borderOf, gapText, type Side } from '../../src/game/building';
import { Game } from '../../src/game/game';
import type { NoPlanLook } from './noplan-page';

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
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ID = 9301;
const [TX, TY] = [6, 52];
const TILES: Array<[number, number]> = [[TX, TY], [TX + 1, TY]];
/** The tower's six outside sides. */
const OUTSIDE: Array<[number, number, Side]> = [[TX, TY, 'n'], [TX + 1, TY, 'n'], [TX + 1, TY, 'e'], [TX + 1, TY, 's'], [TX, TY, 's'], [TX, TY, 'w']];

const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);

/* ---- the tower, on both sides ---------------------------------------------- */
const game = Game.create(4242);
const bld = game.buildings;
game.player.x = TX + 0.5;
game.player.y = TY + 2.5;
game.player.level = 0;
game.inventory.add('mallet', { ql: 40 });
bld.nextId = ID;
const b = bld.create('Tower', TX, TY);
bld.addTile(b, TX + 1, TY);
b.levels = 2;
b.workLevel = 1;
const finish = (bill: { needed: Record<string, number> }): void => { for (const k of Object.keys(bill.needed)) bill.needed[k] = 0; };
for (const [x, y] of TILES) for (const level of [0, 1]) finish(bld.setFloor(b, level, x, y, 'plank'));
for (const [x, y, side] of OUTSIDE) finish(bld.setWall(b, 0, x, y, side, 'solid', 'plank'));

const dirOf = (side: Side): string => (side === 'n' || side === 's' ? 'h' : 'v');
const bx = (x: number, side: Side): number => (side === 'e' ? x + 1 : x);
const by = (y: number, side: Side): number => (side === 's' ? y + 1 : y);
sql(`
  delete from no_plan_side where world_id = w and building = ${ID};
  delete from wall where world_id = w and building = ${ID};
  delete from floor_tile where world_id = w and building = ${ID};
  delete from building_tile where world_id = w and building = ${ID};
  delete from building where world_id = w and id = ${ID};
  delete from building_tile where world_id = w and (x, y) in (${TILES.map(([x, y]) => `(${x}, ${y})`).join(', ')});
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'mallet';
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1);
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${ID}, 'Tower', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values ${TILES.map(([x, y]) => `(w, ${ID}, ${x}, ${y})`).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
    ${TILES.flatMap(([x, y]) => [0, 1].map((l) => `(w, ${l}, ${x}, ${y}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')`)).join(', ')};
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
    ${OUTSIDE.map(([x, y, s]) => `(w, 0, '${dirOf(s)}', ${bx(x, s)}, ${by(y, s)}, ${ID}, 'solid', 'plank', '{"plank": 0}', '{"plank": 4}')`).join(', ')};
  update player set body_at = now(), x = ${TX + 0.5}, y = ${TY + 2.5}, level = 0 where world_id = w and uid = u;`);

/** What each side says to a job: the browser's check, and the island's `build_refusal`. */
const say = (id: string, target: Record<string, unknown>): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  const a = ACTION_BY_ID.get(id);
  if (!a) throw new Error(`there is no ${id}`);
  const mine = a.check?.(t as never, game) ?? 'ALLOWED';
  const theirs = psql(`select coalesce(build_refusal(${W}, ${DANE}, '${id}', '${JSON.stringify(t)}'::jsonb), 'ALLOWED');`);
  return [mine, theirs];
};
const same = (what: string, id: string, target: Record<string, unknown>, want: string): void => {
  const [mine, theirs] = say(id, target);
  check(what, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
};
/** Do a job on both sides, and what each said doing it. */
const both = (id: string, target: Record<string, unknown>, prefix: string): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  game.log.length = 0;
  ACTION_BY_ID.get(id)?.perform(t as never, game);
  const mine = game.log.map((l) => l.text).find((s) => s.startsWith(prefix)) ?? 'NOTHING SAID';
  psql(`delete from event where world_id = ${W} and uid = ${DANE};`);
  psql(`select perform_building(${W}, ${DANE}, '${id}', '${JSON.stringify(t)}'::jsonb);`);
  const theirs = psql(`select text from event where world_id = ${W} and uid = ${DANE} and text like '${prefix.replace(/'/g, "''")}%' order by n desc limit 1;`) || 'NOTHING SAID';
  return [mine, theirs];
};
/** Whether each side holds a side of a storey marked. */
const held = (x: number, y: number, side: Side, level = 1): [boolean, boolean] => [
  bld.noPlan(level, borderOf(x, y, side)),
  psql(`select exists (select 1 from no_plan_side where world_id = ${W} and level = ${level} and dir = '${dirOf(side)}'
          and x = ${bx(x, side)} and y = ${by(y, side)} and building = ${ID});`) === 't',
];
const marks = (): [number, number] => [
  [...bld.noPlans.values()].filter((m) => m.building === ID).length,
  Number(psql(`select count(*) from no_plan_side where world_id = ${W} and building = ${ID};`)),
];
const side = (x: number, y: number, s: Side, level = 1): Record<string, unknown> => ({ x, y, side: s, level });

/* ---- refused, the same on both sides --------------------------------------- */
same('No plan on the ground storey is refused', 'no_plan', side(TX, TY, 'n', 0), 'Storey 2 and up only.');
same('and on a side inside the building', 'no_plan', side(TX, TY, 'e'), 'Outside sides only.');
same('and off the building', 'no_plan', side(TX, TY + 1, 'n'), 'No building here.');
same('and with no side', 'no_plan', { x: TX, y: TY, level: 1 }, 'Choose a side.');
same('Mark out where there is no mark is refused', 'mark_out', side(TX, TY, 'n'), 'Already marked out.');
same('a bare outside side of storey 2 may be marked No plan', 'no_plan', side(TX, TY, 'n'), 'ALLOWED');

/* ---- marked, and the mark taken off ---------------------------------------- */
{
  const [mine, theirs] = both('no_plan', side(TX + 1, TY, 'n'), 'No plan');
  check('marked No plan, said the same on both sides', mine === 'No plan: north side, storey 2.' && theirs === mine, `browser "${mine}", island "${theirs}"`);
  const [m, t] = held(TX + 1, TY, 'n');
  check('and both sides hold the mark', m && t, `browser ${m}, island ${t}`);
  same('a second No plan there is refused', 'no_plan', side(TX + 1, TY, 'n'), 'Already no plan.');
  same('and Mark out is allowed', 'mark_out', side(TX + 1, TY, 'n'), 'ALLOWED');
  const [mine2, theirs2] = both('mark_out', side(TX + 1, TY, 'n'), 'Marked out');
  check('marked out, said the same on both sides', mine2 === 'Marked out: north side, storey 2.' && theirs2 === mine2, `browser "${mine2}", island "${theirs2}"`);
  const [m2, t2] = held(TX + 1, TY, 'n');
  check('and neither side holds it any longer', !m2 && !t2, `browser ${m2}, island ${t2}`);
}

/* ---- a wall planned on a marked side clears it ----------------------------- */
{
  both('no_plan', side(TX, TY, 'w'), 'No plan');
  const [m0, t0] = held(TX, TY, 'w');
  const [mine, theirs] = both('plan_wall', { ...side(TX, TY, 'w'), wallType: 'solid', material: 'plank' }, 'Planned');
  const [m, t] = held(TX, TY, 'w');
  check('a wall planned on a marked side clears the mark on both sides', m0 && t0 && !m && !t && mine === theirs,
    `marked ${m0}/${t0}, after ${m}/${t}; "${mine}" / "${theirs}"`);
  same('and No plan where a wall is planned is refused', 'no_plan', side(TX, TY, 'w'), 'Already a wall on that side.');
  same('as is Mark out there', 'mark_out', side(TX, TY, 'w'), 'Already a wall on that side.');
  bld.removeWall(1, TX, TY, 'w');
  sql(`delete from wall where world_id = w and building = ${ID} and level = 1;`);
}

/* ---- every bare side marked: the storey is as open as it was ---------------- */
const gapMine = (): string => gapText(2, bld.levelGaps(b, 1, game.player.x, game.player.y)) ?? 'CLOSED';
const gapTheirs = (): string => psql(`select coalesce(level_gap(${W}, ${ID}, 1, ${DANE}), 'CLOSED');`);
const openMine = gapMine();
const openTheirs = gapTheirs();
for (const [x, y, s] of OUTSIDE) both('no_plan', side(x, y, s), 'No plan');
{
  const [m, t] = marks();
  check('every bare outside side of storey 2 marked, on both sides', m === 6 && t === 6, `browser ${m}, island ${t}`);
  const mine = gapMine();
  const theirs = gapTheirs();
  check('and storey 2 is as open as it was, in the same words on both sides',
    mine === openMine && theirs === openTheirs && mine === theirs && mine.includes('6 sides with no wall or columns'),
    `before "${openMine}" / "${openTheirs}", after "${mine}" / "${theirs}"`);
  same('a roof over it is refused as before', 'plan_floor', { x: TX, y: TY, material: 'plank', floorKind: 'roof' }, openMine);
}

/* ---- and a fresh browser is handed the marks -------------------------------- */
{
  const seen = JSON.parse(psql(`
    select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select (rpc_ground(${W}, 40, true)->'buildings')::text;`).split('\n').pop() ?? '{}') as {
      noPlan?: Array<{ building: number; level: number; x: number; y: number; dir: string }>;
    };
  const sent = (seen.noPlan ?? []).filter((m) => m.building === ID);
  check('the ground read hands a browser the six marks', sent.length === 6, JSON.stringify(sent));
  const g2 = Game.create(4242);
  g2.buildings.sawIsland(seen as never);
  const laid = OUTSIDE.filter(([x, y, s]) => g2.buildings.noPlan(1, borderOf(x, y, s))).length;
  const t2 = g2.buildings.list.get(ID);
  const gap2 = t2 ? gapText(2, g2.buildings.levelGaps(t2, 1, game.player.x, game.player.y)) : 'NO TOWER';
  check('and a fresh browser lays them in, the storey still open there', laid === 6 && gap2 === openMine, `${laid} marks; "${gap2}"`);
}

/* ---- the storey removed clears its marks, the building the rest ------------- */
{
  for (const [x, y] of TILES) {
    bld.removeFloor(1, x, y);
  }
  sql(`delete from floor_tile where world_id = w and building = ${ID} and level = 1;`);
  same('with its floors up, the top storey may come off', 'remove_storey', { x: TX, y: TY }, 'ALLOWED');
  both('remove_storey', { x: TX, y: TY }, 'Tower');
  const [m, t] = marks();
  check('removing the storey clears its marks on both sides', m === 0 && t === 0, `browser ${m}, island ${t}`);
  // And back up again, marked, for the building to take with it.
  b.levels = 2;
  b.workLevel = 1;
  for (const [x, y] of TILES) finish(bld.setFloor(b, 1, x, y, 'plank'));
  sql(`update building set levels = 2, work_level = 1 where world_id = w and id = ${ID};
    insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
      ${TILES.map(([x, y]) => `(w, 1, ${x}, ${y}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')`).join(', ')};`);
  both('no_plan', side(TX, TY, 'n'), 'No plan');
  const before = marks();
  sql(`delete from floor_tile where world_id = w and building = ${ID};
    delete from wall where world_id = w and building = ${ID};
    delete from building_tile where world_id = w and building = ${ID};
    delete from building where world_id = w and id = ${ID};`);
  const after = marks()[1];
  for (const [x, y] of TILES) bld.removeTile(b, x, y);
  const left = marks()[0];
  check('removing the building clears its marks on both sides', before[0] === 1 && before[1] === 1 && left === 0 && after === 0,
    `before ${before.join('/')}, after browser ${left}, island ${after}`);
}

/* ---- Dane back where he was ------------------------------------------------- */
{
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;`);
}

/* ---- drawn ------------------------------------------------------------------- */
/** A Chromium to drive, as `storeyview.ts` finds one, or null. */
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
const options = browserOptions();
if (!options) {
  console.log('noplan: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/noplan-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = { look: (marked: Array<[number, number, Side]>) => NoPlanLook; tx: number; ty: number };
    const at = await tab.evaluate(() => { const s = (window as unknown as { noplan: Page }).noplan; return { tx: s.tx, ty: s.ty }; });
    const look = (marked: Array<[number, number, Side]>): Promise<NoPlanLook> =>
      tab.evaluate((m) => (window as unknown as { noplan: Page }).noplan.look(m), marked);
    const { tx, ty } = at;
    const key = (x: number, y: number, s: Side): string => { const bd = borderOf(x, y, s); return `${bd.dir}:${bd.x},${bd.y}`; };
    const bare = await look([]);
    check('unmarked, a plan model on every bare outside side of storey 2', bare.models.join(' ') === bare.outside.join(' '),
      `drawn ${bare.models.join(' ')}; sides ${bare.outside.join(' ')}`);
    const marked: Array<[number, number, Side]> = [[tx, ty, 'n'], [tx + 1, ty, 'e'], [tx + 1, ty, 's']];
    const some = await look(marked);
    const want = bare.outside.filter((k) => !marked.some(([x, y, s]) => key(x, y, s) === k));
    check('marked No plan, no plan model on the three marked sides, one on the other three',
      some.models.join(' ') === want.join(' ') && some.held.filter(Boolean).length === 3, `drawn ${some.models.join(' ')}; want ${want.join(' ')}`);
    const r = (level: number, x: number, y: number, s: Side): string[] => some.rows[`${level}|${x},${y},${s}`] ?? [];
    check('a marked side\'s menu on storey 2: Plan wall and Mark out',
      r(1, tx, ty, 'n').join(' / ') === 'Plan wall (north) / Mark out (north)', r(1, tx, ty, 'n').join(' / '));
    check('a bare one\'s: Plan wall and No plan',
      r(1, tx + 1, ty, 'n').join(' / ') === 'Plan wall (north) / No plan (north)', r(1, tx + 1, ty, 'n').join(' / '));
    check('neither on the ground storey', !Object.entries(some.rows).some(([k, v]) => k.startsWith('0|') && v.some((l) => /^(No plan|Mark out)/.test(l))),
      r(0, tx, ty, 'n').join(' / '));
    check('nor on a side inside the building', r(1, tx, ty, 'e').join(' / ') === 'Plan wall (east)', r(1, tx, ty, 'e').join(' / '));
    const again = await look([]);
    check('the marks gone from the ground read, every plan model back', again.models.join(' ') === bare.outside.join(' ') && !again.held.some(Boolean),
      again.models.join(' '));
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} No plan checks failed`);
  process.exit(1);
}
console.log(`no plan — ${ok.length} of ${ok.length}`);
