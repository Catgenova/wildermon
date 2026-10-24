/**
 * Somebody else is drawn once.
 *
 * Reported by catgenova: "I appear double to other players, even my chat
 * bubble is doubled." The island had them up on Thistlekit and at the reins of
 * wagon 275 at once -- Take the reins never asked whether the body was in a
 * saddle -- and every other screen drew them in both: on the saddle by the
 * mount, on the box by the wagon, each with a name and a bubble.
 *
 * Drawn in Chromium on the page `saddle-page.ts` builds, at three zooms and
 * every eighth of a turn, standing and walked along: up on a mount, at a
 * wagon's reins, and both at once, the name is written once a frame and never
 * twice -- and never not at all, once the camera has come round to them.
 *
 * Needs a Chromium: the one in `CHROME_PATH`, Playwright's, or an installed
 * Chrome. With none it says so and passes, unless `CROWD_STRICT` is set, as it
 * is in CI.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
  console.log('saddle: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.CROWD_STRICT ? 1 : 0);
}

const bundled = await build({
  // From the repository's root, where the suite is run.
  entryPoints: [resolve('supabase/test/saddle-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const page = bundled.outputFiles[0].text;

/** Frames drawn of each view; the first few are the camera coming round, and are not counted. */
const FRAMES = 18;
const SETTLE = 4;

type Scene = { mounted: boolean; reins: boolean };
const browser = await chromium.launch(options);
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const thrown: string[] = [];
  tab.on('pageerror', (e) => thrown.push(e.message));
  await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
  // The page's clock, moved only by `tick`.
  await tab.addScriptTag({ content: `(() => {
    let t = performance.now();
    const d0 = Date.now() - t;
    performance.now = () => t;
    Date.now = () => d0 + t;
    window.driven = { tick: (ms) => { t += ms; } };
  })();` });
  await tab.addScriptTag({ content: page });
  if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);

  for (const [scene, what] of [
    [{ mounted: true, reins: false }, 'up on a wildermon'],
    [{ mounted: false, reins: true }, 'at a wagon\'s reins'],
    [{ mounted: true, reins: true }, 'up on a wildermon and at a wagon\'s reins at once'],
  ] as Array<[Scene, string]>) {
    const wrong: string[] = [];
    let views = 0;
    for (const walk of [false, true]) for (const zoom of [0.6, 1, 2]) for (let turn = 0; turn < 8; turn++) {
      const n: number[] = await tab.evaluate(([s, z, t, w, f]) => (window as unknown as { saddle: { frames: (s: Scene, n: number, z: number, t: number, w: boolean) => number[] } })
        .saddle.frames(s, f, z, t, w), [scene, zoom, turn, walk, FRAMES] as const);
      views++;
      const counted = n.slice(SETTLE);
      if (counted.some((c) => c !== 1)) wrong.push(`${walk ? 'walking' : 'standing'}, zoom ${zoom}, turn ${turn}: ${counted.join(' ')}`);
    }
    check(`${what}, somebody else's name is written once a frame`, wrong.length === 0,
      wrong.length ? `${wrong.length} of ${views} views: ${wrong.slice(0, 3).join('; ')}` : `${views} views of ${FRAMES - SETTLE} frames`);
  }
  if (thrown.length) check('and the page threw nothing', false, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(bad.length ? `\n${bad.length} wrong` : '\nall as they should be');
process.exit(bad.length ? 1 : 0);
