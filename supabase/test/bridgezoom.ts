/**
 * A bridge zoomed in past ×5: every piece drawn, and drawn the same frame after frame.
 *
 * Reported: "bridges flicker and glitch at any further zoom than 5x" -- a
 * marble bridge meeting a building's storey floor, part of its deck missing
 * and the ground showing through, parapets cut off near the floor, and
 * flickering. Past zoom 5 a bridge's pictures are baked at the largest scale
 * (`BAKE_STEPS`), and those on the screen came to more than the kit's budget:
 * each bake let go of a picture still on the screen, so every frame made a
 * few again and left the rest out. In Chromium, at 1440 by 900 (`bridgezoom-page.ts`):
 *
 *   * a marble bridge three lanes wide and a stone brick ramp one lane wide,
 *     each between two buildings' storey floors, at zoom 4, 6 and the most,
 *     on four camera turns: settled, every still frame draws every piece from
 *     its own picture (none made, none stood in by another scale's, none left
 *     out) and the same pictures in the same places as the last;
 *   * the bridge pictures kept went past the budget at least once, so the
 *     case the report was is the case drawn;
 *   * wheeled in from 5 to the most while dragged about, then let settle,
 *     the same.
 *
 * Needs a Chromium as `levelmark.ts` does; without one nothing is drawn,
 * unless `BRIDGEZOOM_STRICT` is set, as it is in CI. Needs no database.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { SCULPTED_MAX_ZOOM } from '../../src/engine/camera';
import type { Still } from './bridgezoom-page';
import { bad, check, finish } from './harness';

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

const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
/** What was wrong with a run of still frames, or nothing. */
const fault = (r: Still): string => {
  const out: string[] = [];
  if (sum(r.made)) out.push(`made ${r.made.join(',')}`);
  if (sum(r.stood)) out.push(`stood in ${r.stood.join(',')}`);
  if (sum(r.missed)) out.push(`left out ${r.missed.join(',')}`);
  if (!r.drawn[0]) out.push('no bridge drawn');
  if (new Set(r.drawn).size > 1) out.push(`${new Set(r.drawn).size} different sets of pictures drawn in ${r.drawn.length} frames`);
  return out.join('; ');
};

const options = browserOptions();
if (!options) {
  console.log('bridgezoom: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.BRIDGEZOOM_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/bridgezoom-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Bz = { bridgezoom: {
      scenes: string[];
      still: (s: number, z: number, t: number, n: number) => Promise<Still>;
      wander: (s: number, z0: number, z1: number, t: number, steps: number, n: number) => Promise<Still & { left: number }>;
    } };
    const scenes = await tab.evaluate(() => (window as unknown as Bz).bridgezoom.scenes);
    let over = 0, budget = 0;
    for (let s = 0; s < scenes.length; s++) {
      for (const zoom of [4, 6, SCULPTED_MAX_ZOOM]) {
        const faults: string[] = [];
        for (const turn of [0, 2, 4, 6]) {
          const r = await tab.evaluate((a) => (window as unknown as Bz).bridgezoom.still(a[0], a[1], a[2], 5), [s, zoom, turn] as const);
          over = Math.max(over, r.kept);
          budget = r.budget;
          const f = fault(r);
          if (f) faults.push(`turn ${turn}: ${f}`);
        }
        check(`${scenes[s]}, zoom ${zoom}, turns 0, 2, 4 and 6: every piece drawn from its own picture, the same pictures in the same places every still frame`,
          faults.length === 0, faults.join(' / '));
      }
    }
    check('the bridge pictures kept went past the budget, the case reported', over > budget, `${(over / 1e6).toFixed(1)} Mpx kept, budget ${(budget / 1e6).toFixed(1)} Mpx`);
    const w = await tab.evaluate((m) => (window as unknown as Bz).bridgezoom.wander(0, 5, m, 0, 24, 5), SCULPTED_MAX_ZOOM);
    check(`marble, wheeled in from 5 to ${SCULPTED_MAX_ZOOM} while dragged, then settled: every piece drawn, the same pictures in the same places every still frame`,
      !fault(w), `${fault(w)} (left out while moving: ${w.left})`);
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

finish('bridgezoom');
