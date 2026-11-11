// The leather chest's arm charts for the sculpt (tools/sculpt/lowlchestsculpt.py): per arm a surface round its axis,
// from a dome over the shoulder (t < 0, above the shoulder's joint along the upper arm's line) down the upper arm to the
// elbow and the forearm to the wrist; θ round the axis (0 forward, 90 out), each node the arm's reach that way (the
// dome: the shoulder's reach rounded off), with its weights (the nearest arm or shoulder vertex's) and, per view, where
// it lands on the sheet at OFF out (the view's review pose and body map, lowlchestenv.mjs viewMapper).
//
//   node tools/sculpt/lowlchestarm.mjs <out dir> [--who male,female]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { bodySamples, sectioner } from './garments/leatherchest.mjs';
import { VIEWS, loadCams } from './lowleatherchestview.mjs';
import { viewMapper } from './lowlchestenv.mjs';
const args = process.argv.slice(2), dir = args[0], opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
mkdirSync(dir, { recursive: true });
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, k) => a.map((x) => x * k), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const unit = (a) => mul(a, 1 / (Math.hypot(...a) || 1)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const OFF = 0.12;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), C = loadCams()[who], J = rig.J, B = rig.B, S = bodySamples(B), out = { who, arms: {} };
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? 1 : -1, m = (p) => [sg * Math.abs(p[0]) * Math.sign(p[0] || 1) * (s === 'l' ? 1 : 1), p[1], p[2]];
    const sh = s === 'l' ? J.shoulder : [-J.shoulder[0], J.shoulder[1], J.shoulder[2]], el = s === 'l' ? J.elbow : [-J.elbow[0], J.elbow[1], J.elbow[2]], wr = s === 'l' ? J.wrist : [-J.wrist[0], J.wrist[1], J.wrist[2]];
    const armS = S.filter((q) => ['arm', 'joint'].includes(q.part) && Math.sign(q.p[0]) === sg).map((q) => q.p);
    const shS = S.filter((q) => ['arm', 'joint', 'torso'].includes(q.part) && sg * q.p[0] > 0.45 * Math.abs(J.shoulder[0])).map((q) => q.p);
    const frame = (o, tail) => { const a = unit(sub(tail, o)), e1 = unit(sub([0, 0, 1], mul(a, dot([0, 0, 1], a)))), e2 = cross(e1, a); return { o, a, e1, e2: mul(e2, sg * (dot(e2, [1, 0, 0]) >= 0 ? 1 : -1)) }; };
    const up = frame(sh, el), fo = frame(el, wr), Lu = Math.hypot(...sub(el, sh)), Lf = Math.hypot(...sub(wr, el));
    const secU = sectioner(armS, { ...up, dt: 0.1 }), secF = sectioner(armS, { ...fo, dt: 0.1 }), secS = sectioner(shS, { ...up, dt: 0.12 });
    const ths = Array.from({ length: 36 }, (_, k) => k * 10), DOME = 0.75, ts = [];
    for (let t = -DOME; t <= Lu + Lf + 1e-9; t += 0.05) ts.push(+t.toFixed(3));
    const nodeAt = (t, th) => {
      // (the dome: the shoulder's reach at the joint, rounded off over DOME above it; the upper arm; the forearm)
      if (t < 0) { const p = secS.at(0.05, th, 0), r = Math.hypot(...sub(p, add(up.o, mul(up.a, 0.05)))), k = Math.sqrt(Math.max(0, 1 - (t / DOME) ** 2)); const d = sub(p, add(up.o, mul(up.a, 0.05))); return add(add(up.o, mul(up.a, t)), mul(unit(d), r * Math.max(0.15, k))); }
      if (t <= Lu) { const a = secU.at(t, th, 0), b = secS.at(t, th, 0), w = Math.min(1, t / (0.6 * Lu)); return add(mul(b, 1 - w), mul(a, w)); }
      return secF.at(t - Lu, th, 0);
    };
    const P = ts.map((t) => ths.map((th) => nodeAt(t, th)));
    // (the weights of the nearest arm or shoulder vertex)
    const cand = B.verts.map((p, i) => i).filter((i) => ['arm', 'joint', 'hand'].includes(B.part[i]) && Math.sign(B.verts[i][0]) === sg);
    const W = P.map((row) => row.map((p) => { let bi = cand[0], bd = 1e9; for (const i of cand) { const d = Math.hypot(...sub(B.verts[i], p)); if (d < bd) { bd = d; bi = i; } } return rig.vw[bi]; }));
    // (each node's outward normal: from the axis)
    const axisPt = (t) => (t < Lu ? add(up.o, mul(up.a, t)) : add(fo.o, mul(fo.a, t - Lu)));
    const N = P.map((row, i) => row.map((p) => unit(sub(p, axisPt(ts[i])))));
    const views = {};
    for (const v of VIEWS) {
      const flat = P.flatMap((row, i) => row.map((p, j) => add(p, mul(N[i][j], OFF)))), Wf = W.flat(), Q = viewMapper(rig, C, v)(flat, Wf);
      views[v] = Q.map((q) => q.map((x) => +x.toFixed(2)));
    }
    out.arms[s] = { ts, ths, Lu, P: P.map((r) => r.map((p) => p.map((x) => +x.toFixed(4)))), N: N.map((r) => r.map((p) => p.map((x) => +x.toFixed(4)))), W, views, off: OFF };
  }
  writeFileSync(join(dir, `arm-${who}.json`), JSON.stringify(out));
  console.log(who, 'arms', Object.keys(out.arms).map((s) => `${s}: ${out.arms[s].ts.length} x ${out.arms[s].ths.length}`).join(', '));
}
