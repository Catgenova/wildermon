/**
 * A trail is drawn on ground under water as well as on dry ground.
 *
 * Reported: "trails do not appear to draw over tiles with water", with a
 * trail running up to a pool and stopping at its edge. The island wears a
 * trail into ground that a pond or the sea covers as into any other
 * (`wear_step` asks only what the ground is); the renderer left out the path
 * on every tile with water on it.
 *
 * On a meadow with a spring's pond in a hollow and the sea along one side, a
 * trail worn through the pond and one down the beach into the sea, drawn in
 * Chromium (`trailwater-page.ts`), each tile's colour with the trails worn
 * against the same tile as grass:
 *
 *   * on dry ground, the path, as ever;
 *   * on a tile the pond's edge crosses and on a tile all under its shallows,
 *     the path, under the water, sandier than the grass bed beside it;
 *   * under the pond's deepest middle less of it than under its shallows:
 *     as much as the water lets show;
 *   * on a tile the sea's edge crosses, the path up to the water, and on the
 *     first tile all under the sea, some of it.
 *
 * Needs a Chromium as `storeyview.ts` does; without one nothing is drawn,
 * unless `TRAILWATER_STRICT` is set, as it is in CI. Needs no database.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import type { TrailSample } from './trailwater-page';
import { ok, bad, check } from './harness';

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

/** How far apart two colours are, summed over the channels. */
const apart = (a: number[], b: number[]): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
/** How much sandier the first is: red gained over blue, against the second. */
const sandier = (a: number[], b: number[]): number => (a[0] - a[2]) - (b[0] - b[2]);
/** Seen, drawn: the least the colour of a tile with a path on it is apart from the same tile without. */
const SEEN = 6;

const options = browserOptions();
if (!options) {
  console.log('trailwater: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.TRAILWATER_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/trailwater-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = {
      trail: Array<[number, number]>;
      underPond(x: number, y: number): boolean;
      depth(x: number, y: number): number;
      corners(x: number, y: number): number[];
      wear(worn: boolean): void;
      look(fx: number, fy: number, fh: number, zoom: number, tiles: Array<[number, number]>): Promise<TrailSample[]>;
    };
    const info = await tab.evaluate(() => {
      const p = (window as unknown as { trailwater: Page }).trailwater;
      return p.trail.map(([x, y]) => ({ x, y, under: p.underPond(x, y), depth: p.depth(x, y), corners: p.corners(x, y) }));
    });
    const trail = info.map((t): [number, number] => [t.x, t.y]);
    const wear = (worn: boolean): Promise<void> => tab.evaluate((w) => (window as unknown as { trailwater: Page }).trailwater.wear(w), worn);
    const look = (fx: number, fy: number, fh: number, zoom: number, tiles: Array<[number, number]>): Promise<TrailSample[]> =>
      tab.evaluate(([a, b, c, d, t]) => (window as unknown as { trailwater: Page }).trailwater.look(a, b, c, d, t), [fx, fy, fh, zoom, tiles] as const);
    /** Each tile's colour worn and not, looking from (fx, fy, fh). */
    const both = async (fx: number, fy: number, fh: number, zoom: number, tiles: Array<[number, number]>): Promise<Array<{ x: number; y: number; on: boolean; worn: number[]; grass: number[] }>> => {
      await wear(true);
      const worn = await look(fx, fy, fh, zoom, tiles);
      await wear(false);
      const grass = await look(fx, fy, fh, zoom, tiles);
      await wear(true);
      return worn.map((s, i) => ({ x: s.x, y: s.y, on: s.on && grass[i].on, worn: s.rgb, grass: grass[i].rgb }));
    };
    const at = (x: number, y: number) => info.find((t) => t.x === x && t.y === y)!;
    const say = (s: { x: number; y: number; worn: number[]; grass: number[] }): string =>
      `(${s.x}, ${s.y}) depth ${at(s.x, s.y).depth.toFixed(1)}: ${s.worn.map((c) => c.toFixed(0)).join(',')} against ${s.grass.map((c) => c.toFixed(0)).join(',')}`;

    /* ---- the pond ---- */
    const pondRow = trail.filter(([, y]) => y === 14);
    const pond = (await both(14, 14, 25, 1.5, pondRow)).filter((s) => s.on);
    for (const s of pond) console.log('pond', say(s), at(s.x, s.y).under ? 'under' : '');
    const dry = pond.filter((s) => at(s.x, s.y).depth === 0);
    const edge = pond.filter((s) => at(s.x, s.y).depth > 0 && !at(s.x, s.y).under);
    const shallow = pond.filter((s) => at(s.x, s.y).under && at(s.x, s.y).depth < 6);
    const deepest = Math.max(...pond.map((s) => at(s.x, s.y).depth));
    const deep = pond.filter((s) => at(s.x, s.y).depth === deepest);
    check('on dry ground beside the pond, the path is drawn', dry.length > 0 && dry.every((s) => apart(s.worn, s.grass) > SEEN * 3), dry.map(say).join('; '));
    check('on a tile the pond\'s edge crosses, the path is drawn', edge.length > 0 && edge.every((s) => apart(s.worn, s.grass) > SEEN && sandier(s.worn, s.grass) > 0),
      edge.map(say).join('; ') || 'no such tile');
    check('on a tile all under the pond\'s shallows, the path is drawn under the water, sandier than the grass bed',
      shallow.length > 0 && shallow.every((s) => apart(s.worn, s.grass) > SEEN && sandier(s.worn, s.grass) > 0), shallow.map(say).join('; ') || 'no such tile');
    const most = (l: typeof pond): number => Math.max(...l.map((s) => apart(s.worn, s.grass)));
    check('under the pond\'s deepest middle, less of it than under its shallows', deep.length > 0 && shallow.length > 0 && most(deep) < Math.min(...shallow.map((s) => apart(s.worn, s.grass))),
      deep.map(say).join('; ') || 'no such tile');

    /* ---- the sea ---- */
    const seaCol = trail.filter(([x, y]) => x === 22 && y >= 29);
    const sea = (await both(22, 32, 5, 2, seaCol)).filter((s) => s.on);
    for (const s of sea) console.log('sea', say(s));
    const crossed = sea.filter((s) => at(s.x, s.y).corners.some((h) => h < 0) && at(s.x, s.y).corners.some((h) => h > 0));
    const under = sea.filter((s) => at(s.x, s.y).corners.every((h) => h < 0)).slice(0, 1);
    check('on a tile the sea\'s edge crosses, the path is drawn up to the water', crossed.length > 0 && crossed.every((s) => apart(s.worn, s.grass) > SEEN * 3),
      crossed.map(say).join('; ') || 'no such tile');
    check('on the first tile all under the sea, some of it', under.length > 0 && under.every((s) => apart(s.worn, s.grass) > SEEN / 2 && sandier(s.worn, s.grass) > 0),
      under.map(say).join('; ') || 'no such tile');
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
