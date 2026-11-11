// The leather chest's torso shell for the sculpt (tools/sculpt/lowlchestsculpt.py): the trunk's surface (torso, neck,
// pelvis) as a chart, every 2 degrees round (0 the front, 90 the body's left) and every 0.04 up, each point the body's
// reach that way from the trunk's axis at that height (garments/leatherchest.mjs trunkCharts, its wedge: the surface,
// not the hull), smoothed over the chart; with the registered cameras (lowleatherchestcams.json) for mapping the sheet.
//
//   node tools/sculpt/lowlchestshell.mjs <out dir> [--who male,female]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { designOf, bodySamples, trunkCharts } from './garments/leatherchest.mjs';
import { loadCams } from './lowleatherchestview.mjs';
const args = process.argv.slice(2), dir = args[0], opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
mkdirSync(dir, { recursive: true });
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), D = designOf(who), S = bodySamples(rig.B), { chest } = trunkCharts(D, S);
  const top = who === 'male' ? 0.1 : 0.05, bot = who === 'male' ? -6.3 : -5.5, split = who === 'male' ? -4.6 : -4.0;
  const as = Array.from({ length: 180 }, (_, k) => -180 + 2 * k), ys = []; for (let y = top; y >= bot - 1e-9; y -= 0.04) ys.push(+y.toFixed(3));
  const ax = ys.map((y) => chest.axisAt(y));
  let R = ys.map((y, i) => as.map((a) => { const p = chest.at(y, a, 0); return Math.hypot(p[0] - ax[i][0], p[2] - ax[i][2]); }));
  // (below the hips' split (`split`) a curtain: each column the split row's radius, flaring out 0.12 a unit down, so the
  // skirt plates hang across the legs, not round each)
  const si = ys.findIndex((y) => y <= split);
  for (let i = si + 1; i < ys.length; i++) { R[i] = R[si].map((r) => r + 0.12 * (split - ys[i])); ax[i] = ax[si]; }
  // (smoothed: a few passes of the mean of each point and its four neighbours, no lower than the body)
  for (let it = 0; it < 6; it++) R = R.map((row, i) => row.map((r, j) => { const n = [R[Math.max(0, i - 1)][j], R[Math.min(ys.length - 1, i + 1)][j], row[(j + 1) % as.length], row[(j + as.length - 1) % as.length]]; return Math.max(r * 0.97, (r * 2 + n.reduce((a, b) => a + b, 0)) / 6); }));
  writeFileSync(join(dir, `shell-${who}.json`), JSON.stringify({ who, as, ys, axis: ax.map((p) => [+p[0].toFixed(4), +p[2].toFixed(4)]), R: R.map((r) => r.map((x) => +x.toFixed(4))), cams: loadCams()[who] }));
  console.log(who, ys.length, 'rows', as.length, 'columns');
}
