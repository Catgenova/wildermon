/**
 * A settlement grown to Solara's size drawn (`tools/perf/solara-page.ts`: its houses, pieces, crates, things lying
 * about, wildermon and 30 other players in view, at 1280 by 720) in Chromium on the page's own clock, and what a frame
 * costs counted, never timed:
 *
 *   * the kept pictures of the buildings put down at most `BUILDING_SCREENS` screens of pixels a frame (uncropped,
 *     each was the whole box of its piece of wall or floor: 28 screens);
 *   * the sculpted bodies drawn again on the GL at most `SCULPT_REDRAWS` a frame, and your own (each is a GL draw
 *     copied back onto the page, which waits for the GL: 30 of them a frame was 195 ms).
 *
 * Chromium from `CHROME_PATH`, or the one this container has.
 */
import { execFileSync } from 'node:child_process';
import { ok, bad, check } from './harness';

const BUILDING_SCREENS = 4;
const SCULPT_REDRAWS = 4;
const W = 1280, H = 720, FRAMES = 60;

execFileSync('npx', ['esbuild', 'tools/perf/solara.ts', '--bundle', '--platform=node', '--format=esm', '--packages=external',
  '--outfile=node_modules/.cache/solara.mjs', '--log-level=error'], { stdio: 'inherit' });
const runs = { runs: [{ name: 'solara', scene: { peers: 30 }, frames: FRAMES, width: W, height: H }] };
const line = execFileSync('node', ['node_modules/.cache/solara.mjs', JSON.stringify(runs)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .trim().split('\n').filter((l) => l.startsWith('{')).pop()!;
const r = JSON.parse(line) as {
  counts: Record<string, number>; frames: number;
  api: Record<string, number>; imgs: Record<string, { n: number; kpx: number }>;
};

check('the settlement is the size it is meant to be', r.counts.walls >= 250 && r.counts.floors >= 350 && r.counts.lying >= 600 && r.counts.peers === 30,
  JSON.stringify(r.counts));
const screen = (W * H) / 1000;
const building = r.imgs.buildings?.kpx ?? 0;
check(`the buildings' kept pictures put down at most ${BUILDING_SCREENS} screens of pixels a frame`, building > 0 && building <= BUILDING_SCREENS * screen,
  `${(building / screen).toFixed(2)} screens, ${r.imgs.buildings?.n} pictures`);
const gl = (r.api.drawImageGL ?? 0) / r.frames;
check(`sculpted bodies drawn again at most ${SCULPT_REDRAWS} a frame, and your own`, gl <= SCULPT_REDRAWS + 1, `${gl.toFixed(2)} a frame`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\na settlement grown to Solara's size, what a frame draws — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
