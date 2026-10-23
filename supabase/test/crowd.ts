/**
 * A settlement full of wildermon and walls, drawn without drawing them again.
 *
 * Reported: Solara "is not reaching above 10fps at any zoom", and then "still
 * massive fps drops in solara". Measured here, in Chromium, on the page
 * `crowd-page.ts` builds: Solara as the island counted it, thirty wildermon
 * shut in crates, 110 walls, 87 floor tiles, lit fires and an altar.
 *
 *   * A wildermon standing about is put down from pictures, one for each
 *     sixth of a second of its loop (`beasts.ts`), kept up to `BUDGET`
 *     pixels. Each picture was the size of every pose at every facing put
 *     together, so with nine following at twice the zoom on a screen of two
 *     pixels to the point the ones longest unused went just before they were
 *     wanted again. Once a loop has gone round, a second loop must make next
 *     to no canvases at all.
 *   * After dark an altar in view had the whole night mixed at the screen's
 *     full size; it is mixed at the lights' share of it.
 *   * Every floor tile was drawn afresh every frame after dark, and the shade
 *     the walls throw on every tile round them every frame at any hour, path,
 *     clip and fill: both are laid from pictures now (`baked`), so a settled
 *     frame draws next to none of either.
 *   * A wheel of the zoom made every crated wildermon's picture again at
 *     every quarter octave, every piece's bake at every twentieth of a zoom
 *     under one, and drew every wall afresh in every frame of it: frames of
 *     half a second. What was made at the last size stands in now while the
 *     zoom moves, and is made again a few a frame once it settles.
 *
 * And, generously, what a frame and a step of the game cost, so a frame that
 * has gone back to seconds says so.
 *
 * The clock is the page's own, moved a sixth of a second a frame -- a
 * sixtieth while the zoom is wheeled -- so what is drawn does not depend on
 * how fast this machine is. Needs a Chromium: the one in `CHROME_PATH`,
 * Playwright's, or an installed Chrome. With none it says so and passes,
 * unless `CROWD_STRICT` is set, as it is in CI.
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
/** A frame on the settled scene, at 960 by 540 points, two pixels to the point; and a step of the game's. Measured headless on Solara: 29 and 0.4. */
const FRAME_MOST = 400;
const STEP_MOST = 10;
/** Floor tiles and tiles' shade a settled frame may draw afresh, by day or after dark: those whose pictures come due (`BAKE_KEEP`). Before, 87 floors after dark and 186 shades at any hour. */
const AFRESH_MOST = 12;
/** A sixtieth of a second: the frames of a wheel of the zoom. */
const SIXTIETH = 1000 / 60;
/** A wheel from a far view to a close one, in a second. */
const WHEEL_FRAMES = 60;
/**
 * Canvases the wheel may make: the ground's edges at the new sizes (`HEM_MOVING_MOST` a frame), a figure's, what comes into
 * view. Measured headless: 293; before, 1372, a crated wildermon's picture each at every quarter octave.
 */
const WHEEL_CANVASES = 700;
/** Walls drawn afresh in a frame of the wheel, on the average: before, every wall in sight in every frame, 37. Measured headless: 9.5. */
const WHEEL_WALLS = 20;
/** Its worst frame, generously. Measured headless: 156; before, 485. */
const WHEEL_WORST = 1500;

const browser = await chromium.launch(options);
try {
  const open = async (dpr: number, following = 1) => {
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
    await tab.addScriptTag({ content: `window.crowdScene = { following: ${following} };` });
    await tab.addScriptTag({ content: page });
    if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
    return { tab, ctx };
  };
  type Move = { pan?: number; zoomTo?: number };
  const frames = (tab: Awaited<ReturnType<typeof open>>['tab'], n: number, zoom: number, hour: number, step = SIXTH, move: Move = {}): Promise<Measured> =>
    tab.evaluate(([n, step, zoom, hour, move]) => (window as unknown as { crowd: { frames: (n: number, s: number, z: number, h: number, m: Move) => Measured } })
      .crowd.frames(n, step, zoom, hour, move), [n, step, zoom, hour, move] as const);

  {
    // With the nine that followed the body when Solara would not draw ten frames a second.
    const { tab, ctx } = await open(2, 9);
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
  {
    // The whole settlement in view, by day and after dark: its floors and the shade round its walls laid from pictures.
    const { tab, ctx } = await open(1);
    for (const hour of [13, 23]) {
      await frames(tab, 24, 0.35, hour);
      const seen = await frames(tab, 24, 0.35, hour);
      const { floors, shades } = seen.afresh;
      check(`${hour > 20 ? 'after dark' : 'by day'}, the whole settlement in view: a settled frame draws at most ${AFRESH_MOST} floor tiles and tiles' shade afresh`,
        floors + shades <= AFRESH_MOST, `${floors.toFixed(1)} floors and ${shades.toFixed(1)} shades a frame`);
      check(`and a frame is under ${FRAME_MOST} ms`, seen.frame < FRAME_MOST, `${seen.frame.toFixed(1)} ms`);
    }
    await ctx.close();
  }
  {
    // A wheel of the zoom from a far view to a close one, sixty frames a second, once the far view has settled.
    const { tab, ctx } = await open(1);
    await frames(tab, 24, 0.5, 13);
    const wheel = await frames(tab, WHEEL_FRAMES, 0.5, 13, SIXTIETH, { zoomTo: 2 });
    check(`a wheel of the zoom over the settlement makes at most ${WHEEL_CANVASES} canvases`, wheel.canvases <= WHEEL_CANVASES,
      `${wheel.canvases} in ${wheel.frames} frames`);
    check(`and draws at most ${WHEEL_WALLS} walls afresh a frame`, wheel.afresh.walls <= WHEEL_WALLS, `${wheel.afresh.walls.toFixed(1)} a frame`);
    check(`and its worst frame is under ${WHEEL_WORST} ms`, wheel.worst < WHEEL_WORST, `${wheel.worst.toFixed(0)} ms; ${wheel.frame.toFixed(1)} ms on the average`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
