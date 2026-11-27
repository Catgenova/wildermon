/**
 * Whose a tamed wildermon is, by name, wherever it is seen.
 *
 * Asked for: "Make it apparent who tamed wildermon belong to". Asked of the island, with somebody else's wildermon
 * beside you while they are away (offline, a day gone), your own, and a wild one:
 *
 *   * the creatures read (`rpc_creatures`) names the keeper of somebody else's (`keeperName`, `folk_name`), whole and
 *     packed, and yours as you are named; a wild one says none;
 *   * Examine of somebody else's says "Owner: <name>."; of a wild one, nothing of an owner;
 *
 * and of the browser, off the island's own rows: the name over it (`creatureLabel`), its hover card and Examine name
 * the keeper; a wild one has none; and a row from an island before this (no `keeperName`) is taken without a throw,
 * somebody else's showing its name alone and your own your name.
 *
 * The island half makes its own island and rolls it back.
 */
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { Creatures, type IslandCreature } from '../../src/game/creatures';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { creatureLabel, ownerLine, ownerOf } from '../../src/game/owner';
import { creatureLines } from '../../src/ui/creatureinfo';
import { MobsHeld } from '../../src/net/mobsync';
import { build } from './pagebuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { psql, check, finish } from './harness';

const ME = '7e5b0000-0000-4000-8000-0000000c0a01';
const THEM = '7e5b0000-0000-4000-8000-0000000c0a02';
const LOOKER = 'Looker';
const HOLDER = 'Holder';
const THEIRS = 'Bastion';
const OWN = 'Pip';

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; v_theirs int; v_mine int; v_wild int; j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Keepers', 132, 64, 32, 32, true) returning id into w;
  perform land_blank(w, 64);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 63) x, generate_series(0, 63) y;
  perform set_config('request.jwt.claims', json_build_object('sub', '${THEM}')::text, true);
  perform rpc_join(w, '${HOLDER}');
  perform set_config('request.jwt.claims', json_build_object('sub', '${ME}')::text, true);
  perform rpc_join(w, '${LOOKER}');
  update player set x = 32.5, y = 32.5, body_at = now(), swim_at = now() where world_id = w;
  -- Their settlement, which their worker works.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Holdfast', 33, 32, 10, 3, '${THEM}');
  -- Theirs at work beside you, its keeper offline these two days; yours following you; and a wild one.
  v_theirs := creature_spawn(w, 'rabba', 33.5, 32.5, 'deed', now() - interval '60 days', '${THEM}');
  v_mine := creature_spawn(w, 'rabba', 31.5, 32.5, 'active', now() - interval '60 days', '${ME}');
  v_wild := creature_spawn(w, 'rabba', 32.5, 34.5, 'wild', now() - interval '60 days', null);
  -- And one let go, its keeper's uid still on its row: wild all the same.
  update creature set keeper = '${THEM}' where world_id = w and id = v_wild;
  update creature set name = '${THEIRS}' where world_id = w and id = v_theirs;
  update creature set name = '${OWN}' where world_id = w and id = v_mine;
  update player set away = true, seen_at = now() - interval '2 days' where world_id = w and uid = '${THEM}';
  insert into said values ('IDS', v_theirs || ',' || v_mine || ',' || v_wild);
  insert into said values ('OFFLINE', (select (away and seen_at < now() - interval '1 day')::text from player where world_id = w and uid = '${THEM}'));
  insert into said values ('FOLK', folk_name(w, '${THEM}'));
  delete from caller where uid = '${ME}';
  insert into said values ('ROWS', rpc_creatures(w, 40)::text);
  delete from caller where uid = '${ME}';
  j := rpc_creatures(w, 40, '', '{}', true);
  insert into said values ('PACKED', j::text);
  delete from caller where uid = '${ME}';
  j := rpc_act(w, 'examine_creature', jsonb_build_object('kind', 'creature', 'id', v_theirs));
  insert into said values ('EXAMINE', (select text from event where world_id = w and uid = '${ME}' order by n desc limit 1));
  delete from caller where uid = '${ME}';
  j := rpc_act(w, 'examine_creature', jsonb_build_object('kind', 'creature', 'id', v_wild));
  insert into said values ('EXAMINE_WILD', (select text from event where world_id = w and uid = '${ME}' order by n desc limit 1));
end $t$;
select k || E'\\t' || coalesce(v, 'null') from said;
rollback;
`);
const said = new Map(isle.split('\n').filter((l) => l.includes('\t')).map((l) => [l.slice(0, l.indexOf('\t')), l.slice(l.indexOf('\t') + 1)] as [string, string]));
const [theirsId, mineId, wildId] = (said.get('IDS') ?? '').split(',').map(Number);
let rows: IslandCreature[] = [];
try {
  rows = JSON.parse(said.get('ROWS') ?? '[]') as IslandCreature[];
} catch {
  rows = [];
}
const rowOf = (id: number): IslandCreature | undefined => rows.find((r) => r.id === id);

console.log('--- the island');
check('their keeper is offline, two days gone', said.get('OFFLINE') === 'true', said.get('OFFLINE'));
check(`the creatures read names the keeper of somebody else's: "${HOLDER}"`, rowOf(theirsId)?.keeperName === HOLDER && said.get('FOLK') === HOLDER,
  JSON.stringify(rowOf(theirsId)?.keeperName));
check(`and of your own, you: "${LOOKER}"`, rowOf(mineId)?.keeperName === LOOKER, JSON.stringify(rowOf(mineId)?.keeperName));
check('a wild one says none, though its row still names who let it go', !!rowOf(wildId) && !('keeperName' in (rowOf(wildId) ?? {})), JSON.stringify(rowOf(wildId)));
{
  // Packed: the name rides in what else the row says, after its columns, so the columns are as they were.
  let held: IslandCreature[] | null = null;
  try {
    held = new MobsHeld().take(JSON.parse(said.get('PACKED') ?? '{}'), 0);
  } catch {
    held = null;
  }
  const cols = (JSON.parse(said.get('PACKED') ?? '{}') as { cols?: string[] }).cols ?? [];
  check('packed, the same: somebody else\'s by name, yours, and none for a wild one; no column added',
    !!held && held.find((r) => r.id === theirsId)?.keeperName === HOLDER && held.find((r) => r.id === mineId)?.keeperName === LOOKER
      && held.find((r) => r.id === wildId)?.keeperName === undefined && !cols.includes('keeperName'),
    JSON.stringify(held?.map((r) => [r.id, r.keeperName])));
}
check(`Examine of somebody else's: "Owner: ${HOLDER}."`, (said.get('EXAMINE') ?? '').includes(`Owner: ${HOLDER}.`), said.get('EXAMINE'));
check('Examine of a wild one: no owner', !!said.get('EXAMINE_WILD') && !said.get('EXAMINE_WILD')!.includes('Owner'), said.get('EXAMINE_WILD'));

/* ---- the browser ---------------------------------------------------------- */

console.log('--- the browser');
const game = Game.create(4242);
game.player.name = LOOKER;
game.creatures.sawAll(rows);
const theirs = game.creatures.get(theirsId);
const mine = game.creatures.get(mineId);
const wild = game.creatures.get(wildId);
check('the island\'s three are taken', !!theirs && !!mine && !!wild);
if (theirs && mine && wild) {
  check(`the name over somebody else's: "${THEIRS} · ${HOLDER}"`, creatureLabel(theirs, LOOKER) === `${THEIRS} · ${HOLDER}`, creatureLabel(theirs, LOOKER));
  check(`over your own: "${OWN} · ${LOOKER}"`, creatureLabel(mine, LOOKER) === `${OWN} · ${LOOKER}`, creatureLabel(mine, LOOKER));
  check('over a wild one: its name alone', creatureLabel(wild, LOOKER) === wild.name && ownerOf(wild, LOOKER) === null, creatureLabel(wild, LOOKER));
  const card = creatureLines(game, theirs);
  check(`its hover card: "Owner: ${HOLDER}"`, card.includes(`Owner: ${HOLDER}`), card.join(' | '));
  check('a wild one\'s: no owner', !creatureLines(game, wild).some((l) => l.startsWith('Owner')), creatureLines(game, wild).join(' | '));
  const examine = CREATURE_ACTION_BY_ID.get('examine_creature')!;
  examine.perform({ kind: 'creature', id: theirs.id }, game);
  const text = game.log[game.log.length - 1]?.text ?? '';
  check(`Examine: "Owner: ${HOLDER}."`, text.includes(`Owner: ${HOLDER}.`), text);
  examine.perform({ kind: 'creature', id: wild.id }, game);
  const wildText = game.log[game.log.length - 1]?.text ?? '';
  check('Examine of a wild one: no owner', !wildText.includes('Owner'), wildText);
  check(`somebody else's companion is not "your companion"`, !game.creatures.describe({ ...theirs, mode: 'active' }).includes('your'),
    game.creatures.describe({ ...theirs, mode: 'active' }));
}

// An island before this: the same rows with no `keeperName`.
{
  const old = rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    delete o.keeperName;
    return o as unknown as IslandCreature;
  });
  const herd = new Creatures();
  let threw = '';
  try {
    herd.sawAll(old);
    herd.sawAll(rows);
    herd.sawAll(old);
  } catch (e) {
    threw = String(e);
  }
  check('rows from an island that sends no name are taken without a throw, and a name it sent before is not kept', !threw && herd.get(theirsId)?.keeperName === undefined, threw);
  const t = herd.get(theirsId), m = herd.get(mineId);
  check(`its fallback: somebody else's its name alone ("${THEIRS}"), no owner line`, !!t && creatureLabel(t, LOOKER) === THEIRS && ownerLine(t, LOOKER) === null,
    t ? creatureLabel(t, LOOKER) : 'missing');
  check(`and your own, your name ("${OWN} · ${LOOKER}")`, !!m && creatureLabel(m, LOOKER) === `${OWN} · ${LOOKER}`, m ? creatureLabel(m, LOOKER) : 'missing');
  // And a game with no name of your own to hand says nothing rather than a dangling dot.
  check('and with no name of your own to hand, its name alone', !!m && creatureLabel(m, '') === OWN, m ? creatureLabel(m, '') : 'missing');
}

/* ---- drawn ------------------------------------------------------------------ */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}
interface Driven {
  load(rows: IslandCreature[], me: string): void;
  world(zoom: number): Promise<Array<{ text: string; ink: string }>>;
}
const drive = <T>(tab: Page, fn: (c: Driven, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { keeperShown: Driven }).keeperShown, a), [fn.toString(), arg] as const) as Promise<T>;

const options = browserOptions();
if (!options) {
  console.log('keepershown: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.KEEPERSHOWN_STRICT) check('a Chromium to draw in', false);
} else if (rows.length) {
  // KEEPERSHOWN_SHOTS=<dir>: the world with the plates on, at one device pixel a CSS pixel.
  const shots = process.env.KEEPERSHOWN_SHOTS ? resolve(process.env.KEEPERSHOWN_SHOTS) : null;
  if (shots) mkdirSync(shots, { recursive: true });
  const bundled = await build({
    entryPoints: [resolve('supabase/test/keepershown-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    await drive(tab, (c, a) => {
      const [r, m] = a as [IslandCreature[], string];
      return c.load(r, m);
    }, [rows, LOOKER]);
    const plates = await drive(tab, (c) => c.world(2));
    const plate = (start: string): { text: string; ink: string } | undefined => plates.find((p) => p.text === start || p.text.startsWith(`${start} · `));
    const wildName = rows.find((r) => r.id === wildId)?.name ?? '';
    check(`drawn: over somebody else's, "${THEIRS} · ${HOLDER}", in their colour`, plate(THEIRS)?.text === `${THEIRS} · ${HOLDER}` && plate(THEIRS)?.ink === 'theirs',
      JSON.stringify(plates));
    check(`drawn: over your own, "${OWN} · ${LOOKER}", in yours`, plate(OWN)?.text === `${OWN} · ${LOOKER}` && plate(OWN)?.ink === 'mine', JSON.stringify(plates));
    check('drawn: over a wild one, its name alone', !!wildName && plate(wildName)?.text === wildName, JSON.stringify(plates));
    if (shots) {
      const path = join(shots, 'keepershown-zoom2.png');
      await tab.screenshot({ path, clip: { x: 100, y: 80, width: 700, height: 440 } });
      console.log(`keepershown: ${path}`);
    }
    // And an island before this: the same rows with no name, drawn without a throw.
    await drive(tab, (c, a) => {
      const [r, m] = a as [IslandCreature[], string];
      return c.load(r.map((x) => ({ ...x, keeperName: undefined })), m);
    }, [rows, LOOKER]);
    const before = await drive(tab, (c) => c.world(2));
    check(`drawn from rows with no name: somebody else's "${THEIRS}" alone, yours "${OWN} · ${LOOKER}"`,
      before.some((p) => p.text === THEIRS) && before.some((p) => p.text === `${OWN} · ${LOOKER}`), JSON.stringify(before));
    check('nothing thrown on the page', !thrown.length, thrown.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

finish('the keeper of a tamed wildermon, by name');
