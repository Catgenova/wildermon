/**
 * Where Volcano Isle's labyrinth of lava lies, and its heart: the ground's half of `src/game/lava.ts`, a leaf so the
 * generator can read it (seryll lies in the heart and nowhere else, `rockKindFor`).
 *
 * Written for the island, 4096 tiles a side, and laid over any other world by scale as the chart is: the centre
 * (`LAVA_CENTRE`, the caldera's middle on the chart), the labyrinth out to `LAVA_RADIUS` tiles round it, and its heart
 * within `LAVA_HEART`, which no lava ever lies on. The island's `lava_centre`, `lava_radius_at`, `lava_heart_at`.
 */
import { LAVA_CHART } from './lavachart';

/** The size of world the numbers below are written for: the island's. */
export const LAVA_SIZE = 4096;
/** The labyrinth's centre, in ten-thousandths of the map across and down: the middle of the caldera, measured. */
export const LAVA_CENTRE = [5090, 1074] as const;
/** How far the labyrinth reaches round its centre, in tiles of the island. */
export const LAVA_RADIUS = 500;
/** Its heart, in tiles of the island: no lava, and the only place seryll lies (the caldera, the summit). */
export const LAVA_HEART = 120;
/** Chart texels in from the water the labyrinth keeps (`tools/lava-chart.ts`). */
export const LAVA_INLAND = 5;
/** The share of the heart's dry tiles that are seryll seams. */
export const SERYLL_HEART = 0.005;

/** The centre, the reach and the heart on a world this size, in tiles, the last two to the nearest. The island's `lava_geometry`. */
export function lavaGeometry(size: number): { cx: number; cy: number; radius: number; heart: number } {
  return {
    cx: Math.floor((LAVA_CENTRE[0] * size) / 10000),
    cy: Math.floor((LAVA_CENTRE[1] * size) / 10000),
    radius: Math.floor((2 * LAVA_RADIUS * size + LAVA_SIZE) / (2 * LAVA_SIZE)),
    heart: Math.floor((2 * LAVA_HEART * size + LAVA_SIZE) / (2 * LAVA_SIZE)),
  };
}

/** Whether a tile is in the heart: within `LAVA_HEART` of the centre, laid over by scale. The island's `lava_in_heart`. */
export function inLavaHeart(x: number, y: number, size: number): boolean {
  const g = lavaGeometry(size);
  const dx = x - g.cx, dy = y - g.cy;
  return dx * dx + dy * dy < g.heart * g.heart;
}

let cells: Uint8Array | null = null;
/** The chart's table unpacked, the first time it is asked for. */
function chartCells(): Uint8Array {
  if (cells) return cells;
  const c = LAVA_CHART;
  const out = new Uint8Array(c.w * c.h);
  c.rows.forEach((row, y) => {
    let x = 0;
    for (const run of row.split('.')) {
      const n = parseInt(run.slice(1), 36);
      out.fill(Number(run[0]), y * c.w + x, y * c.w + x + n);
      x += n;
    }
  });
  cells = out;
  return out;
}

/** What the chart says of a tile of a world `size` across: 0 not the island's land, 1 its land, 2 the labyrinth's. The island's `lava_chart_at`. */
export function lavaChartAt(x: number, y: number, size: number): number {
  const c = LAVA_CHART;
  const tx = Math.floor((x * c.n) / size) - c.x0;
  const ty = Math.floor((y * c.n) / size) - c.y0;
  if (tx < 0 || ty < 0 || tx >= c.w || ty >= c.h) return 0;
  return chartCells()[ty * c.w + tx];
}
