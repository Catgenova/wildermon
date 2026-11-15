/**
 * Volcano Isle's land as the lava's labyrinth reads it, worked out off the survey chart: what `tools/lava-chart.ts`
 * writes to `src/world/lavachart.ts`, and what `supabase/test/lava.ts` holds the written table to.
 */
import type { Atlas } from '../src/world/atlas-world';
import { REGIONS } from '../src/world/regions';
import { LAVA_CENTRE, LAVA_INLAND, LAVA_RADIUS, LAVA_SIZE } from '../src/world/lavaland';

/** The table: 0 not Volcano Isle's land, 1 its land, 2 its land `LAVA_INLAND` texels in from the water every way, in its largest piece. */
export function lavaChartOf(atlas: Atlas): { n: number; x0: number; y0: number; w: number; h: number; cells: Uint8Array } {
  const n = atlas.n;
  const V = REGIONS.findIndex((r) => r.key === 'Volcano');
  const cx = Math.floor((LAVA_CENTRE[0] * n) / 10000), cy = Math.floor((LAVA_CENTRE[1] * n) / 10000);
  const r = Math.ceil((LAVA_RADIUS * n) / LAVA_SIZE) + 2;
  const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r);
  const w = Math.min(n, cx + r + 1) - x0, h = Math.min(n, cy + r + 1) - y0;
  const land = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < n && y < n && atlas.region[y * n + x] === V && atlas.elev[y * n + x] > 0;
  const cells = new Uint8Array(w * h);
  const k = LAVA_INLAND;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!land(x0 + x, y0 + y)) continue;
      let inland = true;
      for (let dy = -k; dy <= k && inland; dy++) {
        for (let dx = -k; dx <= k; dx++) {
          if (dx * dx + dy * dy <= k * k && !land(x0 + x + dx, y0 + y + dy)) {
            inland = false;
            break;
          }
        }
      }
      cells[y * w + x] = inland ? 2 : 1;
    }
  }
  // Only the largest piece of inland ground: a spit cut off by the margin is land, not labyrinth.
  const piece = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (cells[i] !== 2 || piece[i] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [i];
    piece[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      count++;
      const x = j % w, y = (j - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (cells[q] === 2 && piece[q] < 0) {
          piece[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(count);
  }
  const big = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) if (cells[i] === 2 && piece[i] !== big) cells[i] = 1;
  return { n, x0, y0, w, h, cells };
}
