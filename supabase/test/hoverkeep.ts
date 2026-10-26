/**
 * The world's hover box comes back.
 *
 * Reported: "after playing for a bit, mouseovers go away and don't return
 * until refresh". The card of a thing in the pack or a store holds the one
 * tooltip while the pointer rests on its row, and gave it up only on that
 * row's `mouseleave`; a row taken out from under the pointer -- the thing
 * eaten, dragged off, used up, or taken by the island's word on the pack --
 * never has one, so the card was left up and the world under the pointer was
 * refused the tooltip until the page was reloaded. And a note pinned open by
 * the Tile window's `i` held it until the `i` was pressed again.
 *
 * Drawn in Chromium (`hoverkeep-page.ts`), the pointer read by the game's
 * `Input` and the world said by `UI.hoverFrame` as `main.ts` does each frame,
 * with the real mouse:
 *
 *   * the ground under the pointer is said;
 *   * a thing's row in the pack shows its card, and the ground is said again
 *     once the pointer is back on it;
 *   * with the last row's thing taken from the pack while the pointer rests on
 *     it, the ground is said again once the pointer is on it, at two places,
 *     and the card is not left up;
 *   * a note pinned by the Tile window's `i` is put away by a press on the
 *     world, and the ground under the pointer is said again;
 *   * and the page throws nothing.
 *
 * Needs a Chromium as `respawnpick.ts` does; without one it says so and
 * passes, unless `HOVER_STRICT` is set, as it is in CI.
 *
 *   npx esbuild supabase/test/hoverkeep.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/hoverkeep.mjs && node node_modules/.cache/hoverkeep.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import type { Driven, Read } from './hoverkeep-page';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

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
  console.log('hoverkeep: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.HOVER_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/hoverkeep-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});

type Box = { x: number; y: number } | null;
type Win = { hoverkeep: Driven };
const row = (tab: Page, name: string): Promise<Box> => tab.evaluate((n) => (window as unknown as Win).hoverkeep.row(n), name);
/** The pointer to a point by small steps, as a hand moves it, and a frame drawn there. */
async function to(tab: Page, at: Box): Promise<Read> {
  if (!at) return { tip: null };
  await tab.mouse.move(at.x, at.y, { steps: 6 });
  await tab.waitForTimeout(30);
  return tab.evaluate(() => (window as unknown as Win).hoverkeep.read());
}
/** The ground is said: the tooltip is up and is the world's, by its tile's coordinates and slope. */
const isGround = (r: Read): boolean => !!r.tip && /\d+, \d+ · slope/.test(r.tip);
const said = (r: Read): string => r.tip ?? 'nothing';

const browser = await chromium.launch(options);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
  await tab.addStyleTag({ content: ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n') });
  await tab.addScriptTag({ content: bundled.outputFiles[0].text });
  if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);

  const ground = await tab.evaluate(() => (window as unknown as Win).hoverkeep.ground());
  check('a point on the world with no window over it', !!ground, JSON.stringify(ground));
  const elsewhere: Box = ground ? { x: ground.x - 60, y: ground.y + 40 } : null;

  let r = await to(tab, ground);
  check('the ground under the pointer is said', isGround(r), said(r));

  const mallet = await row(tab, 'Mallet');
  r = await to(tab, mallet);
  check('a mallet\'s row in the pack shows its card', !!r.tip?.startsWith('Mallet'), said(r));
  r = await to(tab, ground);
  check('and the ground is said again with the pointer back on it', isGround(r), said(r));

  const logs = await row(tab, 'Log');
  check('the logs\' row is the pack\'s last', !!logs && !!mallet && logs.y > mallet.y, `${JSON.stringify(mallet)} ${JSON.stringify(logs)}`);
  r = await to(tab, logs);
  check('the last row, the logs, shows their card', !!r.tip?.startsWith('Log'), said(r));
  await tab.evaluate(() => (window as unknown as Win).hoverkeep.take('log'));
  const gone = await row(tab, 'Log');
  check('the logs taken from the pack under the pointer leave no row', gone === null);
  r = await to(tab, ground);
  check('with the logs gone from under the pointer, the ground is said again', isGround(r), said(r));
  r = await to(tab, elsewhere);
  check('and at another place on the ground', isGround(r), said(r));
  check('and the logs\' card is not left up', !r.tip?.startsWith('Log'), said(r));

  const i = await tab.evaluate(() => (window as unknown as Win).hoverkeep.info());
  check('the Tile window\'s i', !!i, JSON.stringify(i));
  if (i) {
    await to(tab, i);
    await tab.mouse.click(i.x, i.y);
    r = await to(tab, ground);
    check('a click on the i pins its note over the world\'s', /^[^|]*: uses\|/.test(r.tip ?? ''), said(r));
    if (ground) await tab.mouse.click(ground.x, ground.y);
    r = await to(tab, elsewhere);
    check('a press on the world puts the pinned note away, and the ground is said again', isGround(r), said(r));
  }
  check('the page threw nothing', thrown.length === 0, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
