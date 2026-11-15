/**
 * Trade and class icons before players' names.
 *
 * Asked for: "Create runecut trade and class icons to display next to player
 * names in chat and in game."
 *
 *   * every trade (`CRAFT_CLASSES`) and every class (`COMBAT_CLASSES`,
 *     `MAGIC_CLASSES`) has an icon, each its own picture, the trades on a
 *     round stone and the classes on a shield, every one edged in the stones'
 *     ink (`src/render/emblems.ts`);
 *   * the icons before a name are the trade and class the island has on that
 *     player's row, read as an islander reads it (`PEOPLE_COLUMNS`), and the
 *     speaker of a line of talk from before you came is the one `rpc_chat`
 *     says (`by`, `20261120000065_talk_says_who_said_it.sql`);
 *   * in chat, over people's heads and in the Social window, each icon titled
 *     with its trade or class; a player with neither shows none;
 *   * a trade changed on the island changes the icons on lines already drawn;
 *   * and Settings, Name icons, takes every one of them away and puts them back.
 *
 * Makes its own island (Nameicons) on the suite's database and takes it away
 * after. The browser half needs a Chromium (`CHROME_PATH`, Playwright's, or an
 * installed Chrome); with none it says so and passes, unless `NAMEICONS_STRICT`
 * is set. `NAMEICONS_SHOTS=<dir>` keeps pictures of the windows and the world.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLASSES, CRAFT_CLASSES } from '../../src/game/classes';
import { BADGE_IDS, BadgeBook, badgeIds, badgesOf, badgeTitle, isTrade, NO_BADGES } from '../../src/game/badges';
import { EMBLEM_IDS, EMBLEM_INK, EMBLEM_NAMES, emblemInks, emblemParts } from '../../src/render/emblems';
import { PEOPLE_COLUMNS, type Social } from '../../src/net/island';
import type { PlayerRow } from '../../src/contract/rows';
import { psql, check, finish } from './harness';

/* ---- the icons ------------------------------------------------------------------------------ */

const missing = CLASSES.filter((c) => !EMBLEM_IDS.includes(c.id) || !emblemParts(c.id, isTrade(c.id) ? 'stone' : 'shield').length);
check(`every trade (${CRAFT_CLASSES.length}) and every class (${CLASSES.length - CRAFT_CLASSES.length}) has an icon`,
  !missing.length && EMBLEM_IDS.length === CLASSES.length, missing.map((c) => c.id).join(', ') || `${EMBLEM_IDS.length} icons`);
check('and every icon is somebody\'s trade or class, the trades first',
  BADGE_IDS.join(',') === CLASSES.map((c) => c.id).join(','), BADGE_IDS.join(','));
const pictures = CLASSES.map((c) => EMBLEM_NAMES[c.id]);
check('each a picture of its own', pictures.every(Boolean) && new Set(pictures).size === pictures.length, pictures.join(', '));
check('the trades on the round stone, the classes on the shield',
  CLASSES.every((c) => isTrade(c.id) === (c.kind === 'craft')) && emblemParts('smith', 'stone')[0].d !== emblemParts('blade', 'shield')[0].d);
check('every icon edged in the stones\' ink',
  CLASSES.every((c) => emblemParts(c.id, isTrade(c.id) ? 'stone' : 'shield')[0].stroke === EMBLEM_INK && emblemInks(c.id, isTrade(c.id) ? 'stone' : 'shield').includes(EMBLEM_INK)));
check('each titled with what it is', badgeTitle('smith') === 'Trade: Smith' && badgeTitle('blade') === 'Class: Sworn Blade', `${badgeTitle('smith')}, ${badgeTitle('blade')}`);
check('a trade or class this browser does not know is none, and so is nothing',
  badgesOf('wizard', 'smith') === NO_BADGES && badgesOf(null, null) === NO_BADGES && badgeIds(badgesOf(null, null), true).length === 0);
check('with Name icons off, none', badgeIds(badgesOf('smith', 'blade'), false).length === 0 && badgeIds(badgesOf('smith', 'blade'), true).join() === 'smith,blade');

/* ---- the island ----------------------------------------------------------------------------- */

const SMITH = '1c0a0000-0000-4000-8000-00000000000a';
const TAILOR = '1c0a0000-0000-4000-8000-00000000000b';
const KINDLER = '1c0a0000-0000-4000-8000-00000000000c';
const NOBODY = '1c0a0000-0000-4000-8000-00000000000d';
const ME = '1c0a0000-0000-4000-8000-00000000000e';
/** Each of them: name, trade and class on the island's row. */
const FOLK: Array<[string, string, string | null, string | null]> = [
  [SMITH, 'Anvilhand', 'smith', 'blade'],
  [TAILOR, 'Threadly', 'tailor', null],
  [KINDLER, 'Emberwick', null, 'kindler'],
  [NOBODY, 'Plainsby', null, null],
  [ME, 'Watcher', 'fisher', 'warder'],
];
const want = (uid: string): string[] => {
  const f = FOLK.find((x) => x[0] === uid)!;
  return [f[2], f[3]].filter((x): x is string => !!x);
};

/** As somebody: the claims set, then the statement, its last line. */
const as = (uid: string, sql: string): string =>
  psql(`select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, false) \\g /dev/null
delete from caller where uid = '${uid}';
${sql}`).split('\n').pop() ?? '';
/** As somebody signed in, under the role every browser has: what an islander may read. */
const read = (uid: string, sql: string): string =>
  psql(`begin;
select set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true) \\g /dev/null
set local role authenticated;
${sql}
rollback;`).split('\n').filter((l) => l && l !== 'BEGIN' && l !== 'ROLLBACK' && l !== 'SET').pop() ?? '';

psql(`delete from world where name = 'Nameicons';`);
const W = psql(`
insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Nameicons', 619, 32, 10, 10, true) returning id \\gset w_
select land_blank(:'w_id'::uuid, 32) \\g /dev/null
insert into auth.users (id) values ${FOLK.map((f) => `('${f[0]}')`).join(', ')} on conflict do nothing;
insert into account (uid, name) values ${FOLK.map((f) => `('${f[0]}', '${f[1].toLowerCase()}')`).join(', ')} on conflict do nothing;
select :'w_id';`).split('\n').pop() ?? '';

let rows: PlayerRow[] = [];
let chat: Array<{ text: string; at?: number; by?: string }> = [];
let social: Social | null = null;
try {
  for (const [uid, name] of FOLK) as(uid, `select rpc_join('${W}', '${name}') \\g /dev/null`);
  for (const [uid, , craft, combat] of FOLK) {
    psql(`update player set craft_class = ${craft ? `'${craft}'` : 'null'}, combat_class = ${combat ? `'${combat}'` : 'null'}, away = false,
      -- Ashore a month: past New (\`NEW_DAYS\`, newplayer.ts asks after that).
      joined_at = now() - interval '30 days'
      where world_id = '${W}' and uid = '${uid}';`);
  }
  for (const [uid, name] of FOLK) as(uid, `select rpc_say('${W}', 'Morning from ${name}.') \\g /dev/null`);

  // What the roster reads, as an islander reads it.
  rows = JSON.parse(read(ME, `select coalesce(jsonb_agg(r), '[]')::text from (select ${PEOPLE_COLUMNS} from player where world_id = '${W}' and away = false) r;`) || '[]') as PlayerRow[];
  check('an islander reads everybody\'s trade and class off the roster\'s columns',
    rows.length === FOLK.length && FOLK.every(([uid, , craft, combat]) => {
      const r = rows.find((x) => x.uid === uid);
      return r && (r.craft_class ?? null) === craft && (r.combat_class ?? null) === combat;
    }), JSON.stringify(rows.map((r) => [r.name, r.craft_class, r.combat_class])));

  // The talk from before you came, as the island hands it back.
  const lines = JSON.parse(as(ME, `select rpc_chat('${W}')::text;`) || '[]') as Array<{ n: number; text: string; at: string; by?: string }>;
  const saidBy = new Map(FOLK.map((f) => [`<${f[1].toLowerCase()}>`, f[0]]));
  check('every line of talk from before you came says who said it',
    lines.length === FOLK.length && lines.every((l) => {
      const who = [...saidBy.entries()].find(([k]) => l.text.toLowerCase().startsWith(k));
      return who && l.by === who[1];
    }), JSON.stringify(lines.map((l) => [l.text, l.by])));
  chat = lines.map((l) => ({ text: l.text, at: Date.parse(l.at), by: l.by }));

  // And the book of icons, from those two alone.
  const book = new BadgeBook();
  book.saw(rows);
  check('the icons before each line are its speaker\'s trade and class, from what the island sends',
    lines.every((l) => badgeIds(book.get(l.by), true).join() === want(l.by!).join()),
    lines.map((l) => `${l.text}: ${badgeIds(book.get(l.by), true).join('+') || 'none'}`).join('; '));
  check('a player with neither has none', badgeIds(book.get(NOBODY), true).length === 0 && book.get(NOBODY) !== undefined);

  // Somebody not ashore, asked after once.
  let asked: string[] = [];
  const later = new BadgeBook();
  later.ask = (uids) => {
    asked = uids;
    return Promise.resolve(rows.filter((r) => uids.includes(r.uid)));
  };
  later.want(SMITH);
  later.want(SMITH);
  await new Promise((done) => setTimeout(done, 10));
  check('somebody not in the roster is asked after once, and known after', asked.join() === SMITH && badgeIds(later.get(SMITH), true).join() === 'smith,blade', asked.join());

  social = JSON.parse(as(ME, `select rpc_social('${W}')::text;`)) as Social;
  check('the Social window\'s answer lists everybody else ashore', FOLK.filter((f) => f[0] !== ME).every((f) => social!.here.some((h) => h.uid === f[0])),
    JSON.stringify(social.here.map((h) => h.name)));
} finally {
  psql(`delete from world where id = '${W}';`);
}

/* ---- the browser ---------------------------------------------------------------------------- */

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

type Icons = Array<{ id: string; title: string }>;
interface Driven {
  load: (rows: PlayerRow[], chat: unknown[], s: Social, me: string) => Promise<void>;
  said: (text: string, by: string) => void;
  saw: (rows: PlayerRow[]) => void;
  look: (style: string, light: string) => Promise<void>;
  show: (id: string, x: number, y: number, w: number, h: number) => Promise<{ x: number; y: number; w: number; h: number }>;
  world: (zoom: number, night: boolean) => Promise<Array<{ text: string; icons: string[] }>>;
  setIcons: (on: boolean) => boolean;
  read: () => { chat: Array<{ text: string; by: string; icons: Icons }>; social: Array<{ text: string; by: string; icons: Icons }> };
}
const drive = <T>(tab: Page, fn: (c: Driven, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { nameIcons: Driven }).nameIcons, a), [fn.toString(), arg] as const) as Promise<T>;

const ids = (icons: Icons): string => icons.map((i) => i.id).join();
const titled = (icons: Icons): boolean => icons.every((i) => i.title === badgeTitle(i.id));
const nameOf = (uid: string): string => FOLK.find((f) => f[0] === uid)![1];

const options = browserOptions();
if (!options) {
  console.log('nameicons: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.NAMEICONS_STRICT) check('a Chromium to draw in', false);
} else if (social) {
  const shots = process.env.NAMEICONS_SHOTS ? resolve(process.env.NAMEICONS_SHOTS) : null;
  if (shots) mkdirSync(shots, { recursive: true });
  const bundled = await build({
    entryPoints: [resolve('supabase/test/nameicons-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/ui/tokens.css', 'src/style.css', 'src/ui/interior.css', 'src/ui/creator.css', 'src/phone.css']
    .map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    await drive(tab, (c, a) => {
      const [r, l, s, m] = a as [PlayerRow[], unknown[], Social, string];
      return c.load(r, l, s, m);
    }, [rows, chat, social, ME]);

    // Chat.
    await drive(tab, (c) => c.look('runecut', 'day'));
    let chatBox = await drive(tab, (c) => c.show('events', 60, 60, 460, 330));
    let shown = await drive(tab, (c) => c.read());
    check('a line of talk for every line the island handed back, each with its speaker',
      shown.chat.length === chat.length && shown.chat.every((l, i) => l.by === chat[i].by), shown.chat.map((l) => l.by).join());
    check('in chat, each speaker\'s trade and class before their name, each titled',
      shown.chat.every((l) => ids(l.icons) === want(l.by).join() && titled(l.icons)),
      shown.chat.map((l) => `${nameOf(l.by)}: ${ids(l.icons) || 'none'}`).join('; '));
    check('and none before somebody with neither', shown.chat.some((l) => l.by === NOBODY && l.icons.length === 0));
    const clip = (b: { x: number; y: number; w: number; h: number }, r = 40) => ({ x: Math.max(0, b.x - r), y: Math.max(0, b.y - r), width: b.w + 2 * r, height: b.h + 2 * r });
    if (shots) {
      await tab.screenshot({ path: join(shots, 'chat-runecut-day.png'), clip: clip(chatBox) });
      await drive(tab, (c) => c.look('runecut', 'night'));
      chatBox = await drive(tab, (c) => c.show('events', 60, 60, 460, 330));
      await tab.screenshot({ path: join(shots, 'chat-runecut-night.png'), clip: clip(chatBox) });
      await drive(tab, (c) => c.look('classic', 'day'));
      chatBox = await drive(tab, (c) => c.show('events', 60, 60, 460, 330));
      await tab.screenshot({ path: join(shots, 'chat-classic.png'), clip: clip(chatBox) });
      await drive(tab, (c) => c.look('runecut', 'day'));
    }

    // Social.
    const socialBox = await drive(tab, (c) => c.show('social', 60, 60, 360, 420));
    shown = await drive(tab, (c) => c.read());
    const people = shown.social.filter((r) => r.by);
    check('in Social, everybody else ashore with their trade and class before their name, each titled',
      people.length >= FOLK.length - 1 && people.every((r) => ids(r.icons) === want(r.by).join() && titled(r.icons)),
      people.map((r) => `${nameOf(r.by)}: ${ids(r.icons) || 'none'}`).join('; '));
    if (shots) {
      await tab.screenshot({ path: join(shots, 'social-runecut-day.png'), clip: clip(socialBox) });
      await drive(tab, (c) => c.look('runecut', 'night'));
      await drive(tab, (c) => c.show('social', 60, 60, 360, 420));
      await tab.screenshot({ path: join(shots, 'social-runecut-night.png'), clip: clip(socialBox) });
      await drive(tab, (c) => c.look('runecut', 'day'));
    }

    // Over their heads.
    for (const [zoom, night] of [[1, false], [3, false], [1, true], [3, true]] as const) {
      const plates = await drive(tab, (c, a) => c.world((a as [number, boolean])[0], (a as [number, boolean])[1]), [zoom, night]);
      const others = FOLK.filter((f) => f[0] !== ME);
      check(`over their heads at zoom ${zoom} ${night ? 'by night' : 'by day'}: each name plate with its trade and class`,
        others.every((f) => plates.some((p) => p.text === f[1] && p.icons.join() === want(f[0]).join())),
        plates.map((p) => `${p.text}: ${p.icons.join('+') || 'none'}`).join('; '));
      if (shots) {
        await tab.screenshot({ path: join(shots, `world-zoom${zoom}-${night ? 'night' : 'day'}.png`), clip: zoom === 1 ? { x: 330, y: 230, width: 440, height: 250 } : { x: 170, y: 40, width: 760, height: 660 } });
      }
    }

    // A trade changed on the island, read again: the lines already drawn change with it.
    await drive(tab, (c) => c.show('events', 60, 60, 460, 330));
    await drive(tab, (c, a) => c.saw(a as PlayerRow[]), rows.map((r) => (r.uid === SMITH ? { ...r, craft_class: 'miner' } : r)));
    await drive(tab, (c, a) => c.said('<anvilhand> Took up the pick.', a as string), SMITH);
    await new Promise((done) => setTimeout(done, 100));
    shown = await drive(tab, (c) => c.read());
    const smith = shown.chat.filter((l) => l.by === SMITH);
    check('a trade changed on the island: every line of theirs shows the new one',
      smith.length === 2 && smith.every((l) => ids(l.icons) === 'miner,blade'), smith.map((l) => ids(l.icons)).join(' | '));

    // Settings, Name icons.
    const off = await drive(tab, (c) => c.setIcons(false));
    shown = await drive(tab, (c) => c.read());
    const platesOff = await drive(tab, (c) => c.world(1, false));
    check('Name icons off: none in chat, in Social or over anybody\'s head',
      off && shown.chat.every((l) => !l.icons.length) && shown.social.every((r) => !r.icons.length) && platesOff.every((p) => !p.icons.length),
      `${shown.chat.filter((l) => l.icons.length).length} lines, ${shown.social.filter((r) => r.icons.length).length} rows, ${platesOff.filter((p) => p.icons.length).length} plates`);
    if (shots) await tab.screenshot({ path: join(shots, 'world-zoom1-day-icons-off.png'), clip: { x: 330, y: 230, width: 440, height: 250 } });
    const on = await drive(tab, (c) => c.setIcons(true));
    shown = await drive(tab, (c) => c.read());
    check('and on again, back', on && shown.chat.filter((l) => l.by !== NOBODY).every((l) => l.icons.length > 0));
    check('nothing thrown on the page', !thrown.length, thrown.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

finish('trade and class icons before names');
