// Edits by hand to the low-poly arms' fitted vertices (tools/sculpt/lowafit-<who>.json), each one read off the sheets:
//
//   node tools/sculpt/lowaedit.mjs --who female --tilt ub:0.3,uc:0.6,ud:1,ue:1,el:1,fa:1,fb:0.6,fc:0.3 --toward el6,el7 --rise 0.3
//     tilts those rings (the factor each) so their side toward the named vertices rises by up to --rise (head units)
//     and the opposite side stays: y += rise * f * (d + R) / 2R, d the vertex's offset from the ring's centre along
//     the horizontal direction to the named vertices' mean, R the ring's largest |d|. For the elbow: the sheets'
//     crease on the inner front side above the point of the elbow on the outer back.
//   node tools/sculpt/lowaedit.mjs --who female --move el5:0,0.05,0          # moves named vertices by (x, y, z)
//   node tools/sculpt/lowaedit.mjs --who female --scale fb:1.1,1,1.05        # a ring scaled about its centre (x, y, z)
//   node tools/sculpt/lowaedit.mjs --who female --turn 0,0,-5                 # the hand with its wrist ring turned about
//     the wrist's centre, about the world's x, y and z axes in turn (degrees): the wrist's bend and deviation
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'female');
const file = join(new URL('.', import.meta.url).pathname, `lowafit-${who}.json`);
const { V } = JSON.parse(readFileSync(file, 'utf8'));
const ring = (r) => Array.from({ length: 8 }, (_, i) => `${r}${i}`);
const centre = (names) => [0, 1, 2].map((k) => names.reduce((s, n) => s + V[n][k], 0) / names.length);

if (opt('tilt')) {
  const to = opt('toward').split(','), rise = +opt('rise', '0.3');
  for (const [r, f] of opt('tilt').split(',').map((s) => s.split(':'))) {
    const names = ring(r), c = centre(names), t = centre(to);
    const d0 = [t[0] - c[0], t[2] - c[2]], l = Math.hypot(...d0), u = [d0[0] / l, d0[1] / l];
    const d = names.map((n) => (V[n][0] - c[0]) * u[0] + (V[n][2] - c[2]) * u[1]), R = Math.max(...d.map(Math.abs));
    names.forEach((n, i) => { V[n][1] = +(V[n][1] + (rise * +f * (d[i] + R)) / (2 * R)).toFixed(4); });
  }
}
if (opt('move')) for (const s of opt('move').split(' ')) {
  const [n, v] = s.split(':'), dv = v.split(',').map(Number);
  V[n] = V[n].map((q, k) => +(q + dv[k]).toFixed(4));
}
if (opt('scale')) for (const s of opt('scale').split(' ')) {
  const [r, v] = s.split(':'), k3 = v.split(',').map(Number), names = ring(r), c = centre(names);
  for (const n of names) V[n] = V[n].map((q, k) => +(c[k] + (q - c[k]) * k3[k]).toFixed(4));
}
if (opt('turn')) {
  const [ax, ay, az] = opt('turn').split(',').map((q) => (+q * Math.PI) / 180);
  const W = ['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0'], O = centre(W);
  const hand = Object.keys(V).filter((n) => /^(w[kbtp]|k[bp]|m[bp]|n[bp]|t|p[abc]$|sk$)/.test(n));
  for (const n of hand) {
    let [x, y, z] = V[n].map((q, k) => q - O[k]);
    [y, z] = [Math.cos(ax) * y - Math.sin(ax) * z, Math.sin(ax) * y + Math.cos(ax) * z];
    [x, z] = [Math.cos(ay) * x + Math.sin(ay) * z, -Math.sin(ay) * x + Math.cos(ay) * z];
    [x, y] = [Math.cos(az) * x - Math.sin(az) * y, Math.sin(az) * x + Math.cos(az) * y];
    V[n] = [x, y, z].map((q, k) => +(q + O[k]).toFixed(4));
  }
}
writeFileSync(file, JSON.stringify({ V }, null, 1));
