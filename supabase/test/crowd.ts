/**
 * A settlement full of wildermon, drawn without drawing them again.
 *
 * Reported: Solara "is not reaching above 10fps at any zoom". Two things there
 * cost a frame whatever the zoom, and both are measured here, in Chromium, on
 * the page `crowd-page.ts` builds: the settlement round its token, with nine
 * wildermon following, three at work and six shut in crates, an altar, lit
 * fires, a house, crops and a pile on the ground.
 *
 *   * A wildermon standing about is put down from pictures, one for each
 *     sixth of a second of its loop (`beasts.ts`), kept up to `BUDGET`
 *     pixels. Each picture was the size of every pose at every facing put
 *     together, about five times what one pose covers, so at twice the zoom
 *     on a screen of two pixels to the point a dozen of them wanted more than
 *     the budget: the ones longest unused went just before they were wanted
 *     again, and every body drew a new picture every sixth of a second for as
 *     long as it was in view. Once a loop has gone round, a second loop must
 *     make next to no canvases at all -- no wildermon picture, no crate's
 *     still, no bake.
 *   * After dark an altar in view had the whole night mixed at the screen's
 *     full size, four times the pixels of the lights' share it is mixed at
 *     otherwise, for its stars' sake. They are cut out of a copy of their own
 *     box now, as a runestone's runes are.
 *
 * And, generously, what a frame and a step of the game cost on the settled
 * scene, so a frame that has gone back to seconds says so.
 *
 * The clock is the page's own, moved a sixth of a second a frame, so what is
 * drawn does not depend on how fast this machine is. Needs a Chromium: the
 * one in `CHROME_PATH`, Playwright's, or an installed Chrome. With none it
 * says so and passes, unless `CROWD_STRICT` is set, as it is in CI.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Measured } from './crowd-page';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** A Chromium to drive, as `scripts/boot-check.mjs` finds one, or null. */
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
  console.log('crowd: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.CROWD_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/crowd-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const page = bundled.outputFiles[0].text;

/** One frame of the island's ten a second before the fix, at the size the stand loop moves: a sixth of a second. */
const SIXTH = 1000 / 6;
/** A wildermon's loop standing (`LOOP` in `beasts.ts`), and a little: every sixth of it seen once. */
const LOOP_FRAMES = 24 * 6;
/** Canvases a settled loop may make: a lit fire's next flicker, a body that turned. Before, a dozen a frame. */
const SETTLED_MOST = 12;
/** A frame on the settled scene, at 960 by 540 points, two pixels to the point; and a step of the game's. Measured headless: 26 and 0.3. */
const FRAME_MOST = 400;
const STEP_MOST = 10;

const browser = await chromium.launch(options);
try {
  const open = async (dpr: number) => {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: dpr });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    // The page's clock, moved only by `tick`; the real one kept for timing; and every canvas made, counted.
    await tab.addScriptTag({ content: `(() => {
      const real = performance.now.bind(performance);
      let t = real();
      const d0 = Date.now() - t;
      performance.now = () => t;
      Date.now = () => d0 + t;
      let made = 0;
      const make = document.createElement.bind(document);
      document.createElement = (name, o) => { if (String(name).toLowerCase() === 'canvas') made++; return make(name, o); };
      window.driven = { tick: (ms) => { t += ms; }, realNow: real, canvases: () => made };
    })();` });
    await tab.addScriptTag({ content: page });
    if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
    return { tab, ctx };
  };
  const frames = (tab: Awaited<ReturnType<typeof open>>['tab'], n: number, zoom: number, hour: number): Promise<Measured> =>
    tab.evaluate(([n, step, zoom, hour]) => (window as unknown as { crowd: { frames: (n: number, s: number, z: number, h: number) => Measured } })
      .crowd.frames(n, step, zoom, hour), [n, SIXTH, zoom, hour] as const);

  {
    const { tab, ctx } = await open(2);
    const first = await frames(tab, LOOP_FRAMES + 12, 2, 13);
    const settled = await frames(tab, LOOP_FRAMES, 2, 13);
    check(`by day at twice the zoom, two pixels to the point: a second loop round makes at most ${SETTLED_MOST} canvases`,
      settled.canvases <= SETTLED_MOST, `${settled.canvases} in ${settled.frames} frames; the first loop made ${first.canvases}`);
    check(`and a settled frame is under ${FRAME_MOST} ms`, settled.frame < FRAME_MOST, `${settled.frame.toFixed(1)} ms`);
    check(`and a step of the game under ${STEP_MOST} ms`, settled.update < STEP_MOST, `${settled.update.toFixed(2)} ms`);
    await ctx.close();
  }
  {
    const { tab, ctx } = await open(1);
    await frames(tab, 12, 1, 23);
    const night = await frames(tab, 12, 1, 23);
    check('after dark with the altar in view, the night is mixed at the lights\' share of the screen, not all of it',
      night.night > 0 && night.night < 1, `${night.night} of the screen's width`);
    check(`and a frame is under ${FRAME_MOST} ms`, night.frame < FRAME_MOST, `${night.frame.toFixed(1)} ms`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
