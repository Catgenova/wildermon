/**
 * A fence on a slope stands on it.
 *
 * Reported: "fences on slopes aren't adhering to the slope properly" -- a stone fence along the top of a slope stood
 * level at the height of its first end, over the ground where the slope fell away. A fence, and a half wall, of four
 * borders running up a slope that rises half a height a tile, with no building, drawn in Chromium (`fenceslope-page.ts`):
 * the foot of what is drawn (its face and shadow) is as far under the ground's line at one end as at the other, not
 * level with the first end.
 *
 * Chromium from `CHROME_PATH`, or the one this container has.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './pagebuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ok, bad, check } from './harness';
import type { FenceSlope } from './fenceslope-page';

function browserOptions(): LaunchOptions | null {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args: ['--no-sandbox'] };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args: ['--no-sandbox'] };
  }
  return null;
}

const options = browserOptions();
if (!options) {
  console.log('fenceslope: no Chromium here (set CHROME_PATH), so nothing was drawn.');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/fenceslope-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    // (less motion asked for, so nothing on the screen moves of itself between the picture without the wall and the one
    // with it: the wind in the flowers and trees, the body's idle)
    const ctx = await browser.newContext({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = { settle: (t: string | null) => Promise<{ w: number; h: number; px: number[] }>; ends: () => FenceSlope };
    const draw = (t: string | null): Promise<{ w: number; h: number; px: number[] }> =>
      tab.evaluate((t) => (window as unknown as { fenceslope: Page }).fenceslope.settle(t), t);
    // (each picture settled: drawn until two draws in a row agree, so a picture still loading is not taken for the wall)
    const bare = await draw(null);
    const ends = await tab.evaluate(() => (window as unknown as { fenceslope: Page }).fenceslope.ends());
    for (const type of ['fence', 'half_wall']) {
      const with_ = await draw(type);
      if (process.env.FENCE_SHOT) {
        await tab.screenshot({ path: `${process.env.FENCE_SHOT}-${type}.png` });
      }
      const groundAt = (sx: number): number => ends.a[1] + (ends.b[1] - ends.a[1]) * (sx - ends.a[0]) / (ends.b[0] - ends.a[0]);
      // The lowest pixel the wall changed in a narrow band of columns a little in from each end, within reach of the
      // ground's line there (a change far under it is something else on the screen, not the wall's foot).
      const foot = (sx: number): number => {
        let low = -1;
        const x0 = Math.round(sx * ends.dpr) - 2, x1 = x0 + 4, yMax = Math.min(with_.h - 1, Math.round((groundAt(sx) + 60) * ends.dpr));
        for (let x = x0; x <= x1; x++) for (let y = 0; y <= yMax; y++) {
          const i = (y * with_.w + x) * 4;
          if (Math.abs(with_.px[i] - bare.px[i]) + Math.abs(with_.px[i + 1] - bare.px[i + 1]) + Math.abs(with_.px[i + 2] - bare.px[i + 2]) > 30) low = Math.max(low, y);
        }
        return low / ends.dpr;
      };
      // Near either end of its last border: a border drawn level at its first end's height was furthest off at its other.
      const inA = ends.a[0] + (ends.b[0] - ends.a[0]) * 0.79, inB = ends.a[0] + (ends.b[0] - ends.a[0]) * 0.96;
      const da = foot(inA) - groundAt(inA), db = foot(inB) - groundAt(inB);
      // Its foot, face and shadow, as far under the ground's line at one end as at the other: it follows the slope.
      check(`a ${type} four borders up a slope rising ${ends.rise} heights: its foot as far from the ground at both ends of a border (${da.toFixed(1)} and ${db.toFixed(1)} px under it)`,
        Math.abs(da - db) <= 3 && da > -3 && da < 20, `${da.toFixed(1)}, ${db.toFixed(1)}`);
    }
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\na fence on a slope — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
