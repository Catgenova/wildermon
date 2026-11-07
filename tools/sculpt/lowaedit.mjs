// Edits by hand to the low-poly arms' fitted vertices (tools/sculpt/lowafit-<who>.json), each one read off the sheets:
//
//   node tools/sculpt/lowaedit.mjs --who female --tilt ub:0.3,uc:0.6,ud:1,ue:1,el:1,fa:1,fb:0.6,fc:0.3 --toward el6,el7 --rise 0.3
//     tilts those rings (the factor each) so their side toward the named vertices rises by up to --rise (head units)
//     and the opposite side stays: y += rise * f * (d + R) / 2R, d the vertex's offset from the ring's centre along
//     the horizontal direction to the named vertices' mean, R the ring's largest |d|. For the elbow: the sheets'
//     crease on the inner front side above the point of the elbow on the outer back. --half: only the near half rises.
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
    // --half: only the side toward the named vertices rises (by d / R), the other half of the ring stays
    const w = (q) => (args.includes('--half') ? Math.max(0, q / R) : (q + R) / (2 * R));
    names.forEach((n, i) => { V[n][1] = +(V[n][1] + rise * +f * w(d[i])).toFixed(4); });
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
// --line fb,fc,fd,fe,fg --from fa --to w [--taper]: the named rings' centres put on the straight line from the --from
// ring's centre to the --to ring's (w: the wrist's six), each at its own centre's height, so the outline runs straight
// as the sheets' forearms do; --taper also sizes each ring (about its centre, across and front to back) between the
// first and the last named ring's sizes, linear in height
if (opt('line')) {
  const W6 = ['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0'], names = (r) => (r === 'w' ? W6 : ring(r));
  const rs = opt('line').split(','), A = centre(names(opt('from'))), B = centre(names(opt('to')));
  const size = (r) => { const c = centre(ring(r)); return [0, 2].map((k) => Math.max(...ring(r).map((n) => Math.abs(V[n][k] - c[k])))); };
  const r0 = rs[0], r1 = rs.at(-1), y0 = centre(ring(r0))[1], y1 = centre(ring(r1))[1], s0 = size(r0), s1 = size(r1);
  for (const r of rs) {
    const c = centre(ring(r)), t = (c[1] - A[1]) / (B[1] - A[1]), to = [0, 1, 2].map((k) => A[k] + t * (B[k] - A[k]));
    const u = (c[1] - y0) / (y1 - y0), s = size(r), k3 = args.includes('--taper') ? [0, 1].map((k) => (s0[k] + u * (s1[k] - s0[k])) / s[k]) : [1, 1];
    for (const n of ring(r)) V[n] = [to[0] + (V[n][0] - c[0]) * k3[0], V[n][1], to[2] + (V[n][2] - c[2]) * k3[1]].map((q) => +q.toFixed(4));
  }
}
const HAND = () => Object.keys(V).filter((n) => /^(w[kbtp]|k[bp]|m[bp]|n[bp]|t|p[abc]$|sk$)/.test(n));
// --onto fa,fg: the hand with its wrist ring moved (not turned) so the wrist's centre sits on the forearm's line (the
// straight line through those two rings' centres, extended), where the sheets have it: the forearm runs on into the
// hand with no step sideways at the wrist
if (opt('onto')) {
  const [a, b] = opt('onto').split(',').map((r) => centre(ring(r))), O = centre(['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0']);
  const d = [0, 1, 2].map((k) => b[k] - a[k]), l = Math.hypot(...d), u = d.map((q) => q / l);
  const t = [0, 1, 2].reduce((s, k) => s + (O[k] - a[k]) * u[k], 0), f = +opt('part', '1'), off = [0, 1, 2].map((k) => f * (a[k] + t * u[k] - O[k]));
  for (const n of HAND()) V[n] = V[n].map((q, k) => +(q + off[k]).toFixed(4));
  console.log('hand moved by', off.map((q) => q.toFixed(3)).join(', '));
}
if (opt('turn')) {
  const [ax, ay, az] = opt('turn').split(',').map((q) => (+q * Math.PI) / 180);
  const W = ['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0'], O = centre(W);
  const hand = HAND();
  for (const n of hand) {
    let [x, y, z] = V[n].map((q, k) => q - O[k]);
    [y, z] = [Math.cos(ax) * y - Math.sin(ax) * z, Math.sin(ax) * y + Math.cos(ax) * z];
    [x, z] = [Math.cos(ay) * x + Math.sin(ay) * z, -Math.sin(ay) * x + Math.cos(ay) * z];
    [x, y] = [Math.cos(az) * x - Math.sin(az) * y, Math.sin(az) * x + Math.cos(az) * y];
    V[n] = [x, y, z].map((q, k) => +(q + O[k]).toFixed(4));
  }
}
writeFileSync(file, JSON.stringify({ V }, null, 1));
