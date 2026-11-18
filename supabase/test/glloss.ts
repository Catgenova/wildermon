/**
 * Your body drawn still once the sculpted bodies' GL context is lost (`../../src/sculpt/gl.ts` contextGone).
 *
 * Reported: "my character model is missing", with the wildermon drawn round an empty tile. A browser short of GPU memory
 * takes a WebGL context away; nothing listened, every body drawn after it was drawn on the lost context, as nothing, and
 * the flat figure was only for a browser with no WebGL at all. Drawn in Chromium (`glloss-page.ts`, the Solara bench with
 * nothing on it but you and the totem):
 *
 *   * a body is there to start with (dark pixels where it stands);
 *   * the context taken away (`WEBGL_lose_context`) and some frames drawn, it is there still: at least `KEPT` of them;
 *   * the page threw nothing.
 *
 * Needs a Chromium: the one in `CHROME_PATH`, Playwright's, or an installed Chrome; with none it says so and passes.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, finish } from './harness';

/** The share of the body's dark pixels still there after the loss: 0.99 with the context made again, 0.55 with none. */
const KEPT = 0.8;

const path = process.env.CHROME_PATH ?? [join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium'), '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find((p) => existsSync(p));
if (!path) {
  console.log('glloss: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(0);
}
const bundled = await build({
  entryPoints: [resolve('supabase/test/glloss-page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const browser = await chromium.launch({ executablePath: path, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
  // The page's own clock, moved by the frames (`tools/perf/solara.ts`).
  await tab.addScriptTag({ content: `(() => { const real = performance.now.bind(performance); let t = real(); let mark = real(); let last = t;
    performance.now = () => (last = Math.max(last, t + Math.min(250, real() - mark))); const d0 = Date.now() - t; Date.now = () => d0 + performance.now();
    let made = 0; const make = document.createElement.bind(document); document.createElement = (n, o) => { if (String(n).toLowerCase() === 'canvas') made++; return make(n, o); };
    window.driven = { tick: (ms) => { t = Math.max(t + ms, last); mark = real(); }, realNow: real, canvases: () => made }; })();` });
  await tab.addScriptTag({ content: `window.solaraScene = ${JSON.stringify({ houses: 0, pieces: 0, crates: 0, lying: 0, workers: 0, following: 0, stored: 0, peers: 0, lamps: 0 })};` });
  await tab.addScriptTag({ content: bundled.outputFiles[0].text });
  await tab.evaluate(() => (window as unknown as { solara: { ready: Promise<void> } }).solara.ready);
  const run = (n: number) => tab.evaluate(([k]) => (window as unknown as { solara: { frames: (...a: unknown[]) => unknown } }).solara.frames(k, 33, 2, 13), [n] as const);
  // The body's dark pixels, in the box over where you stand in the middle of the screen.
  const dark = () => tab.evaluate(() => {
    const cv = document.querySelector('canvas') as HTMLCanvasElement;
    const d = (cv.getContext('2d') as CanvasRenderingContext2D).getImageData((cv.width - 120) / 2, cv.height / 2 - 130, 120, 160).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 330) n++;
    return n;
  });
  for (let i = 0; i < 6; i++) { await run(30); await tab.waitForTimeout(200); }
  const before = await dark();
  const lost = await tab.evaluate(() => (window as unknown as { loseGL: () => string }).loseGL());
  for (let i = 0; i < 8; i++) { await run(30); await tab.waitForTimeout(250); }
  const after = await dark();
  check('a body drawn to start with', before > 300, `${before} dark pixels`);
  check('the context taken away', lost === 'lost', lost);
  check(`and drawn still after: at least ${KEPT * 100}% of its dark pixels`, after >= before * KEPT, `${before} -> ${after}`);
  check('the page threw nothing', !thrown.length, thrown.slice(0, 3).join('; '));
} finally {
  await browser.close();
}
finish('A lost GL context');
