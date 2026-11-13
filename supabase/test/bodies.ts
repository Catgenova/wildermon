/**
 * What sculpted bodies cost a frame, with Animations On and Off, where they cost the most (`bodies-page.ts`): the busy
 * stretch `animoff.ts` draws, a crowd of sixty at work and in a fight, the camera swept fast across both (every body in
 * the crowd new to the view: each round dresses them afresh), and the zoom eased in and out over the crowd. Drawn in
 * Chromium on the page's own clock, `ROUNDS` rounds of each in turn so the machine's moods fall on both.
 *
 *   * a frame with Animations On costs at most `ON_TIMES` times one with them Off, plus `ON_PLUS` ms (medians);
 *   * the sculpted bodies cost a frame no more than their budget (`BODY_BUDGET_MS` in `src/render/figure.ts`) and `SLACK`
 *     ms on average, over every round of every scene;
 *   * no frame of the sweep, nor of the zoom, takes longer than the longest frame of the same round with Animations Off
 *     plus `ONE_BODY` times the longest any one frame spent on the bodies in the busy stretch;
 *   * the page threw nothing.
 *
 * Prints every round's median, ninetieth centile and longest frame. Needs a Chromium: the one in `CHROME_PATH`,
 * Playwright's, or an installed Chrome. With none it says so and passes, unless `BODIES_STRICT` is set. `BODIES_JSON`
 * names a file the figures are written to as well; `BODIES_SHOTS` a folder for a picture of each scene, On and Off.
 */
import { build } from 'esbuild';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Measured, Scene } from './bodies-page';
import { BODY_BUDGET_MS } from '../../src/render/bodybudget';
import { check, finish } from './harness';

/** On against Off, by the median frame: at most this many times as long, and this many ms over. */
const ON_TIMES = 1.6;
const ON_PLUS = 4;
/** Milliseconds a frame the bodies may run over their budget on average: a body is started while any of it is left. */
const SLACK = 2;
/** The sweep's and the zoom's longest frame: Off's longest and this many of the longest frame's bodies in the busy stretch. */
const ONE_BODY = 2.5;
const ROUNDS = Number(process.env.BODIES_ROUNDS ?? 3);
const FRAMES = 90;
const STEP = 1000 / 30;
const ZOOM = 2;
const SCENES = (process.env.BODIES_SCENES === 'none' ? [] : process.env.BODIES_SCENES?.split(',') ?? ['busy', 'crowd', 'pan', 'zoom']) as Scene[];

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
  console.log('bodies: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  process.exit(process.env.BODIES_STRICT ? 1 : 0);
}

const bundled = await build({
  entryPoints: [resolve('supabase/test/bodies-page.ts')],
  bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const script = bundled.outputFiles[0].text;

type Api = { frames: (n: number, step: number, zoom: number, animations: string, scene: Scene) => Measured; ready: Promise<void>; shot: () => string; pin: (s: number | null) => void; fresh: () => void };
const run = (tab: Page, n: number, animations: string, scene: Scene): Promise<Measured> =>
  tab.evaluate(([n, step, zoom, animations, scene]) => (window as unknown as { bodies: Api }).bodies.frames(n, step, zoom, animations, scene),
    [n, STEP, ZOOM, animations, scene] as const);
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
  await tab.evaluate(() => (window as unknown as { bodies: Api }).bodies.ready);
  const api = <T>(f: (b: Api) => T): Promise<T> => tab.evaluate(f as never) as Promise<T>;
  // Warm: the sculpted bodies' chunk loaded and their bakes landed, both ways, a round at a time with a break for the idle work.
  for (let i = 0; i < 6; i++) {
    await run(tab, 30, i % 2 ? 'off' : 'on', 'busy');
    await tab.waitForTimeout(300);
  }
  const shots = process.env.BODIES_SHOTS;
  if (shots) {
    // The same frames before and after a change: the quality held at its best, every body given time to be drawn.
    mkdirSync(shots, { recursive: true });
    await tab.evaluate(() => (window as unknown as { bodies: Api }).bodies.pin(0));
    for (const scene of ['busy', 'crowd'] as Scene[]) {
      for (const a of ['off', 'on']) {
        // Four rounds; Off, until no body is left waiting (where the renderer counts them), up to forty.
        for (let i = 0; i < 40; i++) {
          const m = await run(tab, 30, a, scene);
          if (i >= 3 && (a === 'on' || !(m.deferred > 0))) break;
        }
        const url = await tab.evaluate(() => (window as unknown as { bodies: Api }).bodies.shot());
        writeFileSync(join(shots, `${scene}-${a}.png`), Buffer.from(url.split(',')[1], 'base64'));
      }
    }
    await tab.evaluate(() => (window as unknown as { bodies: Api }).bodies.pin(null));
  }
  void api;
  const got: Record<string, { on: Measured[]; off: Measured[] }> = {};
  for (const scene of SCENES) {
    got[scene] = { on: [], off: [] };
    for (let r = 0; r < ROUNDS; r++) {
      for (const a of ['on', 'off'] as const) {
        if (scene === 'pan') await tab.evaluate(() => (window as unknown as { bodies: Api }).bodies.fresh());
        got[scene][a].push(await run(tab, FRAMES, a, scene));
      }
    }
  }
  const f = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '-');
  for (const scene of SCENES) {
    for (const a of ['on', 'off'] as const) {
      console.log(`${scene.padEnd(5)} ${a.padEnd(3)} ` + got[scene][a].map((m) => `median ${f(m.median)} p90 ${f(m.p90)} worst ${f(m.worst)} ms, `
        + `${m.redraws.toFixed(2)} bodies a frame, bodies ${f(m.bodyMs)} ms a frame (worst ${f(m.bodyWorst)}), ${f(m.deferred)} waiting, quality ${f(m.step)}`).join('\n          '));
    }
  }
  if (process.env.BODIES_JSON) writeFileSync(process.env.BODIES_JSON, JSON.stringify(got, null, 1));
  if (!process.env.BODIES_BEFORE && SCENES.length === 4) {
    for (const scene of SCENES) {
      const on = median(got[scene].on.map((m) => m.median)), off = median(got[scene].off.map((m) => m.median));
      check(`${scene}: Animations On within ${ON_TIMES}× Off + ${ON_PLUS} ms (median frame)`, on <= off * ON_TIMES + ON_PLUS, `${on.toFixed(1)} ms against ${off.toFixed(1)} ms`);
    }
    const all = SCENES.flatMap((s) => [...got[s].on, ...got[s].off]);
    const spent = all.reduce((p, m) => p + m.bodyMs, 0) / all.length;
    check(`sculpted bodies within their budget of ${BODY_BUDGET_MS} ms a frame (+${SLACK})`, spent <= BODY_BUDGET_MS + SLACK, `${spent.toFixed(2)} ms a frame over every round`);
    const one = Math.max(...got.busy.on.map((m) => m.bodyWorst));
    for (const scene of ['pan', 'zoom'] as Scene[]) {
      const worst = got[scene].on.map((m, i) => [m.worst, got[scene].off[i].worst + ONE_BODY * one]);
      check(`${scene}: no frame longer than Off's longest + ${ONE_BODY}× the bodies' longest frame (${one.toFixed(1)} ms)`, worst.every(([w, most]) => w <= most),
        worst.map(([w, most]) => `${w.toFixed(1)} ≤ ${most.toFixed(1)}`).join('; '));
    }
  }
  check('the page threw nothing', thrown.length === 0, thrown.join('; '));
  await ctx.close();
} finally {
  await browser.close();
}
finish('Sculpted bodies a frame: a crowd, a fast sweep and a zoom, Animations On and Off');
