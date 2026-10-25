/**
 * The Wildermon window's Care tab.
 *
 * Asked for: feeding, rest, beds, breeding and jobs on one screen, with what
 * needs attention first, a one-click fix where the rules allow one, and bulk
 * feeding, every job through the island's own door. Drawn in Chromium on the
 * page `care-page.ts` builds -- a settlement and twelve wildermon in every
 * state the tab sorts -- this asks:
 *
 *   * that the window opens on the Care tab, and the Cards tab is still there;
 *   * that the needs read worst first, in the order of `NEED_KINDS` and by how
 *     bad within a kind, and name what each is: hurt, hungry, unfed, due, no
 *     bed, idle, care, gear, pair -- one piece of gear offered once;
 *   * that each fix asks the island for the job the creature menu asks for
 *     (`game.ask`, which is `rpc_act`): a brush, the poorest food in the pack,
 *     the pack of its size, a pairing after its preview; walking first to one
 *     out of reach;
 *   * that Feed hungry feeds each hungry one in turn, the next only once the
 *     last is done, and each once; and Assign selected assigns the ticked;
 *   * and that on a phone nothing runs off the side of the window.
 *
 * Needs a Chromium: the one in `CHROME_PATH`, Playwright's, or an installed
 * Chrome. With none it says so and passes, unless `CROWD_STRICT` is set, as it
 * is in CI. No database.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NEED_KINDS } from '../../src/ui/panels/care';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A Chromium to drive, as `crowd.ts` finds one, or null. */
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
  console.log('care: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.CROWD_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/care-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const script = bundled.outputFiles[0].text;
const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
/** Where to put a picture of each screen, when asked (`CARE_SHOTS`). */
const shots = process.env.CARE_SHOTS;

type Row = { kind: string; id: number; says: string; fix: string };
type Ask = { action: string; target: { kind: string; id?: number; itemUid?: number; sure?: boolean } };
interface Care {
  game: { inventory: { items: Array<{ uid: number; id: string }> } };
  asks: Ask[];
  asked: string[];
  island: { on: boolean };
  open: () => void;
  tab: (t: 'care' | 'cards') => void;
  run: (ms: number) => void;
  rows: () => Row[];
  fix: (kind: string, id: number) => boolean;
  bulk: (name: string) => string;
  tick: (id: number) => void;
  reset: () => void;
  layout: () => { tab: string; careShown: boolean; overflow: number; outside: string[] };
}
const care = <T>(tab: Page, fn: (c: Care, arg: unknown) => T, arg?: unknown): Promise<T> =>
  tab.evaluate(([f, a]) => (new Function('c', 'a', `return (${f})(c, a)`))((window as unknown as { care: Care }).care, a), [fn.toString(), arg] as const) as Promise<T>;

/** A page of the game in a fresh context, its clock moved only by `tick`. */
async function open(browser: Awaited<ReturnType<typeof chromium.launch>>, phone: boolean): Promise<{ tab: Page; thrown: string[]; close: () => Promise<void> }> {
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
}

const browser = await chromium.launch(options);
try {
  /* ---- a desktop ------------------------------------------------------------ */
  const { tab, thrown, close } = await open(browser, false);
  await care(tab, (c) => c.open());
  const first = await care(tab, (c) => c.layout());
  check('the window opens on the Care tab', first.tab === 'Care' && first.careShown, JSON.stringify(first));

  // The needs, worst first.
  const rows = await care(tab, (c) => c.rows());
  const said = rows.map((r) => `${r.kind}:${r.id}`);
  const want = ['hurt:102', 'hungry:101', 'unfed:106', 'due:107', 'rest:103', 'idle:104', 'care:108', 'gear:107', 'pair:110'];
  check('the needs read worst first, one row each', said.join(' ') === want.join(' '), said.join(' '));
  const order = rows.map((r) => NEED_KINDS.indexOf(r.kind as never));
  check('in the order of NEED_KINDS', order.every((k, i) => k >= 0 && (i === 0 || k >= order[i - 1])), order.join(','));
  const fixOf = (kind: string, id: number): string => rows.find((r) => r.kind === kind && r.id === id)?.fix ?? '';
  check('a fix where the rules allow one, none where they do not',
    fixOf('hurt', 102).startsWith('Brush: +') && fixOf('hungry', 101) === 'Feed: potato ×5' && fixOf('unfed', 106) === 'Feed: potato ×5'
      && fixOf('care', 108).startsWith('Brush: +') && fixOf('gear', 107) === 'Fit: small wildermon pack' && fixOf('pair', 110) === 'Pair'
      && !fixOf('due', 107) && !fixOf('rest', 103) && !fixOf('idle', 104),
    rows.map((r) => `${r.kind}:${r.id}=${r.fix || '-'}`).join(' '));
  check('a need says what and how much',
    rows.find((r) => r.kind === 'hungry')?.says === 'Fed 12%' && /^Work pace 50%$/.test(rows.find((r) => r.kind === 'unfed')?.says ?? '')
      && /no free medium wildermon bed$/.test(rows.find((r) => r.kind === 'rest')?.says ?? '')
      && /^With Rowan · success \d+%$/.test(rows.find((r) => r.kind === 'pair')?.says ?? ''),
    rows.map((r) => r.says).join(' | '));

  // Each fix, the job the creature menu would ask the island for.
  const pressed = async (kind: string, id: number, ms = 0): Promise<{ asks: Ask[]; asked: string[]; pack: Array<{ uid: number; id: string }> }> => {
    await care(tab, (c) => c.reset());
    await care(tab, (c, a) => c.fix((a as [string, number])[0], (a as [string, number])[1]), [kind, id]);
    if (ms) await care(tab, (c, a) => c.run(a as number), ms);
    return care(tab, (c) => ({ asks: c.asks.slice(), asked: c.asked.slice(), pack: c.game.inventory.items.map((it) => ({ uid: it.uid, id: it.id })) }));
  };
  const uidOf = (pack: Array<{ uid: number; id: string }>, id: string): number | undefined => pack.find((it) => it.id === id)?.uid;
  {
    const r = await pressed('hurt', 102);
    check('Hurt: a brushing asked for', r.asks.length === 1 && r.asks[0].action === 'groom' && r.asks[0].target.id === 102, JSON.stringify(r.asks));
  }
  {
    const r = await pressed('hungry', 101);
    check('Hungry: a feeding of the potatoes asked for', r.asks.length === 1 && r.asks[0].action === 'feed' && r.asks[0].target.id === 101
      && r.asks[0].target.itemUid === uidOf(r.pack, 'potato'), JSON.stringify(r.asks));
  }
  {
    const before = await pressed('unfed', 106);
    check('Unfed, out of reach: walked to first, not asked yet', before.asks.length === 0, JSON.stringify(before.asks));
    await care(tab, (c) => c.run(12000));
    const r = await care(tab, (c) => c.asks.slice());
    check('and asked on arrival: a feeding', r.length === 1 && r[0].action === 'feed' && r[0].target.id === 106, JSON.stringify(r));
  }
  {
    const r = await pressed('care', 108);
    check('Care: a brushing asked for', r.asks.length === 1 && r.asks[0].action === 'groom' && r.asks[0].target.id === 108, JSON.stringify(r.asks));
  }
  {
    await pressed('gear', 107);
    await care(tab, (c) => c.run(12000));
    const r = await care(tab, (c) => ({ asks: c.asks.slice(), pack: c.game.inventory.items.map((it) => ({ uid: it.uid, id: it.id })) }));
    check('Gear: the small pack fitted on her', r.asks.length === 1 && r.asks[0].action === 'fit_gear_pack' && r.asks[0].target.id === 107
      && r.asks[0].target.itemUid === uidOf(r.pack, 'wild_pack_small'), JSON.stringify(r.asks));
  }
  {
    const r = await pressed('pair', 110, 2000);
    check('Pair: the preview asked first', r.asked.length === 1 && r.asked[0].includes('Pair Rowan with Sorrel') && r.asked[0].includes('Success: '),
      r.asked.join(' / ').slice(0, 200));
    check('then the pairing asked for, sure', r.asks.length === 1 && r.asks[0].action === 'pair_creature' && r.asks[0].target.id === 110 && r.asks[0].target.sure === true,
      JSON.stringify(r.asks));
  }

  // Feed hungry: one at a time, each once.
  {
    await care(tab, (c) => c.reset());
    await care(tab, (c) => {
      c.island.on = true;
    });
    const label = await care(tab, (c) => c.bulk('Feed hungry'));
    check('Feed hungry counts the hungry with food in the pack', label === 'Feed hungry (2)', label);
    const firstAsks = await care(tab, (c) => c.asks.slice());
    check('the nearest first, at once', firstAsks.length === 1 && firstAsks[0].action === 'feed' && firstAsks[0].target.id === 101, JSON.stringify(firstAsks));
    await care(tab, (c) => c.run(1000));
    const mid = await care(tab, (c) => c.asks.length);
    check('the next not while the first is in hand', mid === 1, `${mid} asked`);
    await care(tab, (c) => c.run(20000));
    const all = await care(tab, (c) => ({ asks: c.asks.slice(), rows: c.rows(), label: c.bulk('Feed hungry') }));
    check('then the next, walked to: each once', all.asks.map((a) => `${a.action}:${a.target.id}`).join(' ') === 'feed:101 feed:106', JSON.stringify(all.asks));
    check('and neither is hungry after', !all.rows.some((r) => r.kind === 'hungry' || r.kind === 'unfed') && all.label === 'Feed hungry (0) (disabled)',
      `${all.label}; ${all.rows.map((r) => r.kind).join(',')}`);
  }

  // Assign selected: the ticked ones, each once.
  {
    await care(tab, (c) => c.reset());
    await care(tab, (c) => {
      c.island.on = true;
      c.run(500);
      c.tick(101);
      c.tick(112);
    });
    const label = await care(tab, (c) => c.bulk('Assign selected'));
    await care(tab, (c) => c.run(15000));
    const asks = await care(tab, (c) => c.asks.slice());
    check('Assign selected: each ticked one assigned', label === 'Assign selected (2)'
      && asks.map((a) => `${a.action}:${a.target.id}`).join(' ') === 'assign_deed:101 assign_deed:112', `${label}; ${JSON.stringify(asks)}`);
  }

  // The Cards tab, as it was.
  {
    await care(tab, (c) => c.reset());
    await care(tab, (c) => c.tab('cards'));
    const cards = await tab.evaluate(() => document.querySelectorAll('.pals-cards:not([hidden]) .pal-card').length);
    check('the Cards tab: a card each', cards === 12, `${cards} cards`);
    await care(tab, (c) => c.tab('care'));
  }
  if (shots) await tab.screenshot({ path: `${shots}/care-desktop.png` });
  if (thrown.length) check('and the page threw nothing', false, thrown.join('; '));
  await close();

  /* ---- a phone -------------------------------------------------------------- */
  {
    const p = await open(browser, true);
    await care(p.tab, (c) => c.open());
    await care(p.tab, (c) => c.run(500));
    const lay = await care(p.tab, (c) => c.layout());
    check('on a phone, nothing runs off the side of the window', lay.careShown && lay.overflow <= 0 && lay.outside.length === 0, JSON.stringify(lay));
    if (shots) await p.tab.screenshot({ path: `${shots}/care-phone.png` });
    if (p.thrown.length) check('and the phone page threw nothing', false, p.thrown.join('; '));
    await p.close();
  }
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
