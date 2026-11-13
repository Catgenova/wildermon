/**
 * Animations On and Off (`Settings.animations`) on a busy stretch of the island (`animoff-page.ts`: thirty people at work
 * and in a fight, eight wildermon, three of them walking, trees, the sea with a swimmer in it, a lit fire), drawn in
 * Chromium on the page's own clock, three rounds of each in turn so the machine's moods fall on both:
 *
 *   * with Animations Off, bodies are drawn afresh at most `QUIET_MOST` a frame once the change to Off has been drawn,
 *     and `FEWER` times fewer than On or better over the whole round;
 *   * Off makes no new wildermon pictures once its still poses are drawn, and draws none for itself;
 *   * a frame with Animations Off costs no more than one with them On, within `MARGIN`.
 *
 * Prints the frame times and the redraws a frame of each. Needs a Chromium: the one in `CHROME_PATH`, Playwright's, or an
 * installed Chrome. With none it says so and passes, unless `ANIMOFF_STRICT` is set.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Measured } from './animoff-page';
import { ok, bad, check, finish } from './harness';

/** Bodies drawn afresh a frame with Animations Off and nothing changing, at most; and how many times fewer than On. */
const QUIET_MOST = 0.05;
const FEWER = 10;
/** How much longer a frame with Animations Off may be than with them On, as a share: none, but for the machine's noise. */
const MARGIN = 0.05;
/** Frames a round, a thirtieth of a second apart, at the zoom the island is played at; the last of them counted as quiet. */
const FRAMES = 90;
const QUIET = 60;
const STEP = 1000 / 30;
const ZOOM = 2;

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
  console.log('animoff: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.ANIMOFF_STRICT ? 1 : 0);
}

const bundled = await build({
  entryPoints: [resolve('supabase/test/animoff-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const script = bundled.outputFiles[0].text;

type Api = { frames: (n: number, step: number, zoom: number, animations: string, quiet: number) => Measured; ready: Promise<void> };
const run = (tab: Page, n: number, animations: string, quiet = 0): Promise<Measured> =>
  tab.evaluate(([n, step, zoom, animations, quiet]) => (window as unknown as { animOff: Api }).animOff.frames(n, step, zoom, animations, quiet),
    [n, STEP, ZOOM, animations, quiet] as const);
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1];

const browser = await chromium.launch(options);
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
  await tab.addScriptTag({ content: `(() => {
    const real = performance.now.bind(performance);
    let t = real();
    const d0 = Date.now() - t;
    performance.now = () => t;
    Date.now = () => d0 + t;
    window.driven = { tick: (ms) => { t += ms; }, realNow: real };
  })();` });
  await tab.addScriptTag({ content: script });
  await tab.evaluate(() => (window as unknown as { animOff: Api }).animOff.ready);
  // Warm: the sculpted bodies' chunk loaded and their bakes landed, both ways, a round at a time with a break for the idle work.
  for (let i = 0; i < 6; i++) {
    await run(tab, 30, i % 2 ? 'off' : 'on');
    await tab.waitForTimeout(300);
  }
  const on: Measured[] = [], off: Measured[] = [];
  for (let r = 0; r < 3; r++) {
    on.push(await run(tab, FRAMES, 'on', QUIET));
    off.push(await run(tab, FRAMES, 'off', QUIET));
  }
  const tOn = median(on.map((m) => m.median)), tOff = median(off.map((m) => m.median));
  const rOn = median(on.map((m) => m.redraws)), rOff = median(off.map((m) => m.redraws)), qOff = Math.max(...off.map((m) => m.quietRedraws));
  const said = (ms: Measured[]): string => ms.map((m) => `${m.median.toFixed(2)} ms (mean ${m.mean.toFixed(2)}), ${m.redraws.toFixed(2)} bodies a frame (${m.quietRedraws.toFixed(2)} quiet), `
    + `${m.beastMade.toFixed(2)} wildermon pictures made, ${m.beastLive.toFixed(2)} drawn for themselves`).join('\n     ');
  console.log(`On:  ${said(on)}\nOff: ${said(off)}`);
  check(`Animations Off: bodies drawn afresh at most ${QUIET_MOST} a frame once nothing changes`, qOff <= QUIET_MOST,
    `${qOff.toFixed(3)} a frame over the last ${QUIET} of each round`);
  check(`Animations Off: bodies drawn afresh ${FEWER} times fewer than On or better`, rOff * FEWER <= rOn && rOn > 0,
    `${rOff.toFixed(3)} a frame against ${rOn.toFixed(2)}`);
  check('Animations Off: no wildermon picture made or drawn for itself once its still poses are drawn',
    off.slice(1).every((m) => m.beastMade === 0 && m.beastLive === 0), off.map((m) => `${m.beastMade.toFixed(2)} made, ${m.beastLive.toFixed(2)} for itself`).join('; '));
  check(`Animations Off: a frame no slower than On (within ${MARGIN * 100}%)`, tOff <= tOn * (1 + MARGIN),
    `${tOff.toFixed(2)} ms against ${tOn.toFixed(2)} ms (medians of three rounds' medians)`);
  if (thrown.length) check('the page threw nothing', false, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}
void ok;
void bad;
finish('Animations On and Off on a busy stretch of the island');
