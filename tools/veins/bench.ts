/**
 * The cost of the seams, two ways (`tools/veins/shot.mjs --bench`):
 *
 *   * `drawCost`: the seam drawing alone, `seam()` called on tile after tile
 *     of every kind on a canvas the size of the screen, after a pass that
 *     bakes whatever it bakes, in microseconds a tile.
 *   * `frameCost`: the game's whole frame over a field that is ore on every
 *     tile, held still and panned, by day and by night, in milliseconds.
 */
import type { Renderer } from '../../src/render/renderer';
import type { Game } from '../../src/game/game';

type SeamFn = (g: CanvasRenderingContext2D, x: number, y: number, kind: number, pts: ArrayLike<number>, rot: number, zoom: number, dpr: number) => void;

export function drawCost(seam: SeamFn, zooms: number[], kinds: number[]): Record<string, number> {
  const cv = document.createElement('canvas');
  cv.width = 1600;
  cv.height = 1000;
  const g = cv.getContext('2d')!;
  g.setTransform(2, 0, 0, 2, 0, 0);
  const out: Record<string, number> = {};
  const pts = new Float64Array(8);
  for (const zoom of zooms) {
    const n = 3000;
    const run = (): number => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const x = i % 50, y = Math.floor(i / 50);
        const sx = 100 + (i % 7) * 90 * zoom, sy = 100 + (i % 5) * 50 * zoom;
        const lift = (i % 3) * 2 * zoom;
        pts[0] = sx; pts[1] = sy - 24 * zoom;
        pts[2] = sx + 48 * zoom; pts[3] = sy - lift;
        pts[4] = sx; pts[5] = sy + 24 * zoom;
        pts[6] = sx - 48 * zoom; pts[7] = sy;
        seam(g, x, y, kinds[i % kinds.length], pts, 0, zoom, 2);
      }
      // Waits for the canvas to finish what it was told.
      g.getImageData(0, 0, 1, 1);
      return performance.now() - t0;
    };
    run();
    const times = [run(), run(), run()].sort((a, b) => a - b);
    out[`z${zoom}`] = (times[1] / n) * 1000;
  }
  return out;
}

export async function frameCost(renderer: Renderer, game: Game, set: { hour: (h: number) => void; at: (x: number, y: number) => void }, zooms: number[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const frame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));
  for (const turn of [0, 1]) {
    for (const zoom of zooms) {
      for (const [hour, when] of [[13, 'day'], [23, 'night']] as const) {
        for (const pan of [false, true]) {
          set.hour(hour);
          renderer.camera.zoom = zoom;
          renderer.camera.rotation = turn;
          const times: number[] = [];
          for (let i = 0; i < 90; i++) {
            set.at(30 + (pan ? i * 0.08 : 0), 30 + (pan ? i * 0.05 : 0));
            game.update(1 / 60);
            const t0 = performance.now();
            renderer.render(0);
            const c = (renderer as unknown as { canvas: { el: HTMLCanvasElement } }).canvas.el.getContext('2d')!;
            c.getImageData(0, 0, 1, 1);
            const dt = performance.now() - t0;
            if (i >= 20) times.push(dt);
            await frame();
          }
          times.sort((a, b) => a - b);
          out[`turn${turn} z${zoom} ${when} ${pan ? 'panned' : 'still'}`] = times[Math.floor(times.length / 2)];
        }
      }
    }
  }
  return out;
}
