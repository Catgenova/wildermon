/**
 * Volcano Isle's land as the lava's labyrinth reads it, off the survey chart: `src/world/lavachart.ts`.
 *
 * Each texel of the chart (`atlas.n` a side) round the labyrinth's centre (`LAVA_CENTRE`, out to `LAVA_RADIUS`) is
 * 0 where it is not Volcano Isle's land, 1 where it is, and 2 where it is that land `LAVA_INLAND` texels in from the
 * water every way and joined to the centre: where the labyrinth may lie, kept off the coast so nothing walks round its
 * walls by the sea. The world's ground is laid over the chart by scale, every seed alike, so this is one table for
 * every island, the island's `lava_chart` (generated with the definitions) and the browser's `lavaChart`.
 *
 *   npx esbuild tools/lava-chart.ts --bundle --platform=node --format=esm --outfile=/tmp/lc.mjs && node /tmp/lc.mjs   (from the root)
 *
 * `supabase/test/lava.ts` works it out again from the chart and holds the written table to it.
 */
import { writeFileSync } from 'node:fs';
import { readAtlas } from './atlas-node';
import { lavaChartOf } from './lava-chart-of';

const atlas = readAtlas();
const c = lavaChartOf(atlas);
const rows: string[] = [];
for (let y = 0; y < c.h; y++) {
  const runs: string[] = [];
  let x = 0;
  while (x < c.w) {
    const v = c.cells[y * c.w + x];
    let n = 1;
    while (x + n < c.w && c.cells[y * c.w + x + n] === v) n++;
    runs.push(`${v}${n.toString(36)}`);
    x += n;
  }
  rows.push(`  '${runs.join('.')}',`);
}
const out = `/**
 * Volcano Isle's land as the lava's labyrinth reads it, off the survey chart (\`tools/lava-chart.ts\` writes it; do not
 * edit): ${c.w} by ${c.h} texels of a ${c.n}-texel chart from (${c.x0}, ${c.y0}); 0 not the island's land, 1 its land,
 * 2 its land inland and joined to the centre. Each row is runs, a value and then how many in base 36, parted by dots.
 */
export const LAVA_CHART = {
  n: ${c.n},
  x0: ${c.x0},
  y0: ${c.y0},
  w: ${c.w},
  h: ${c.h},
  rows: [
${rows.join('\n')}
  ] as readonly string[],
};
`;
writeFileSync('src/world/lavachart.ts', out);
console.log(`lava chart: ${c.w} × ${c.h} texels from (${c.x0}, ${c.y0})`);
