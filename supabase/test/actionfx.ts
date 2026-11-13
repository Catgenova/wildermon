/**
 * Action effects with thirty people at work in view (`actionfx-page.ts`: fifteen fighting with a weapon in one hand, its
 * sparks; fifteen mining, its chips), drawn in Chromium on the page's own clock:
 *
 *   * with Effects on All, the marks on the clips fire both kinds, and the particles alive never pass the action
 *     effects' share of the pool (`ACTION_SHARE` of `MOST_PARTICLES`), even asked for far more than that at once;
 *   * with the pool held by a spell's particles past that share, the action effects add none: the spells win;
 *   * a frame with them costs at most `MARGIN` more than the same scene with Effects off, and a few milliseconds;
 *   * with Effects off, nothing is fired and nothing added; on Fewer, fewer than on All;
 *   * on the processor's GL (`glSoftware`), only the marks marked `key` fire: the sparks and not the chips.
 *
 * Every effect is measured as on a graphics card (the page's `soft` set false) but the last. Needs a Chromium: the one in
 * `CHROME_PATH`, Playwright's, or an installed Chrome. With none it says so and passes, unless `FX_STRICT` is set.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Measured } from './actionfx-page';
import { ok, bad, check, finish } from './harness';

/** How much longer a frame with the effects may be than without, as a share, and in milliseconds over that. */
const MARGIN = 0.25;
const MARGIN_MS = 3;
/** Frames a measurement, a thirtieth of a second apart, at the zoom the island is played at. */
const FRAMES = 90;
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
  console.log('actionfx: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.FX_STRICT ? 1 : 0);
}

const bundled = await build({
  entryPoints: [resolve('supabase/test/actionfx-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const script = bundled.outputFiles[0].text;

type Api = { share: number; most: number; frames: (n: number, step: number, zoom: number, effects: string, soft: boolean, ask?: number, askN?: number) => Measured; fill: (n: number, secs: number) => void };
const run = (tab: Page, n: number, effects: string, soft = false, ask = 0, askN = 0): Promise<Measured> =>
  tab.evaluate(([n, step, zoom, effects, soft, ask, askN]) => (window as unknown as { actionFx: Api }).actionFx.frames(n, step, zoom, effects, soft, ask, askN),
    [n, STEP, ZOOM, effects, soft, ask, askN] as const);
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
  // Warm: the sculpted bodies' chunk loaded and their bakes landed, a round at a time with a break for the idle work.
  for (let i = 0; i < 6; i++) {
    await run(tab, 30, 'all');
    await tab.waitForTimeout(300);
  }
  if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
  const { share, most: MOST_PARTICLES } = await tab.evaluate(() => { const a = (window as unknown as { actionFx: Api }).actionFx; return { share: a.share, most: a.most }; });

  // All and Off in turn, three rounds each, so the machine's moods fall on both.
  const all: Measured[] = [], off: Measured[] = [];
  for (let r = 0; r < 3; r++) {
    off.push(await run(tab, FRAMES, 'off'));
    all.push(await run(tab, FRAMES, 'all'));
  }
  const fired = all.reduce((s, m) => s + m.fired, 0), kinds = all.reduce((s, m) => ({ sparks: s.sparks + (m.byKind.sparks ?? 0), chips: s.chips + (m.byKind.chips ?? 0) }), { sparks: 0, chips: 0 });
  check('with Effects on All, thirty at work fire their marks: sparks off the blows and chips off the picks', kinds.sparks > 0 && kinds.chips > 0,
    `${fired} in ${3 * FRAMES} frames: ${kinds.sparks} sparks, ${kinds.chips} chips; ${all.reduce((s, m) => s + m.spawned, 0)} particles`);
  const most = Math.max(...all.map((m) => m.most));
  check(`and the particles alive stay within the action effects' share of the pool, ${share} of ${MOST_PARTICLES}`, most <= share, `at most ${most}`);
  const tAll = median(all.map((m) => m.median)), tOff = median(off.map((m) => m.median));
  check(`and a frame with them is within ${MARGIN * 100}% and ${MARGIN_MS} ms of the same with Effects off`, tAll <= tOff * (1 + MARGIN) + MARGIN_MS,
    `${tAll.toFixed(2)} ms against ${tOff.toFixed(2)} ms (medians of three rounds' medians)`);
  check('with Effects off, nothing is fired and no particle added', off.every((m) => m.fired === 0 && m.spawned === 0 && m.alive === 0),
    off.map((m) => `${m.fired} fired, ${m.spawned} added, ${m.alive} alive`).join('; '));

  // Asked for far more than the pool at once: a burst of 200 particles at the body five times a frame.
  const flood = await run(tab, 30, 'all', false, 5, 200);
  check(`asked for ${5 * 200} particles a frame on top, the action effects still hold to ${share}`, flood.most <= share && flood.dropped > 0,
    `at most ${flood.most} alive; ${flood.dropped} left out`);
  await run(tab, 30, 'off');

  // A spell's particles past the action effects' share: they add none while it lasts.
  await tab.evaluate((n) => (window as unknown as { actionFx: Api }).actionFx.fill(n, 2), share + 20);
  const held = await run(tab, 45, 'all');
  check(`with a spell's ${share + 20} particles in the pool, the action effects add none (the spells come first)`, held.spawned === 0 && held.fired > 0,
    `${held.fired} fired, ${held.spawned} added, ${held.dropped} left out`);
  // (the spell's particles gone: their two seconds on the page's clock)
  await run(tab, 30, 'off');

  const fewer = await run(tab, FRAMES * 2, 'fewer'), whole = await run(tab, FRAMES * 2, 'all');
  check('on Fewer, fewer particles than on All', fewer.fired > 0 && fewer.spawned < whole.spawned, `${fewer.spawned} against ${whole.spawned}`);

  const soft = await run(tab, FRAMES * 2, 'all', true);
  check('on the processor\'s GL, only the marks marked key: the sparks, not the chips', (soft.byKind.sparks ?? 0) > 0 && !soft.byKind.chips,
    `${soft.byKind.sparks ?? 0} sparks, ${soft.byKind.chips ?? 0} chips`);
  if (thrown.length) check('the page threw nothing', false, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}
void ok;
void bad;
finish('action effects with thirty at work in view');
