// The animation rig of the low-poly male body (tools/sculpt/lowarm.mjs buildArmBody: head, torso, legs, both arms):
// a humanoid skeleton measured from the body's own named rings, skin weights per vertex by name, and the posing and
// skinning that move it. Written to tools/sculpt/rig-<who>.json (and, with --glb, a skinned glTF for inspection) by
//
//   node tools/sculpt/lowrig.mjs [--who male] [--glb out.glb] [--tmp dir]
//     re-derives the rig from the current mesh: tools/sculpt/rig-male.json and rig-male.glb (the game's rig is bundled
//     into --tmp, default tmp/lowrig, to fit its rest to ours)
//
// The rig is built on the approved mesh, not into it: the mesh's vertices are the bind pose exactly, so the body skinned
// at rest is the body unrigged (checked here: every skinned vertex equals its rest position in float32).
//
// Units and axes are the mesh's: y up (the chin's underside at 0, the floor at the soles), z forward, x the body's left.
// Bone frames: Y from the bone's head to its tail, X the bend axis (Y × the bone's flex direction), Z = X × Y. A local
// pose is [rx, ry, rz] in degrees, applied as Rz · Rx · Ry in the bone's own rest frame: rz the sideways swing, rx the
// flex (+rx carries the tail toward the flex direction: forward for the spine, the neck, the head, the clavicle, the arm
// and the leg; toward the palm for the hand, the fingers and the thumb; toe up for the foot and the ball), ry the twist
// about the bone's own axis. The right side's frames are the left's mirrored with X negated, so a pose mirrors as
// [rx, -ry, -rz] (sym()).
//
// Bones: 35 posed (control) bones and 16 driven helpers (51 deforming). The helpers are what keeps the volume at the
// joints of a low-poly mesh that has one ring at each: a joint helper sits on the joint's pivot and turns rigidly by half
// the child's turn, so the ring on the joint keeps its size (linear blending of the two bones would shrink it by the
// cosine of half the bend); the twist helpers share a forearm's or an upper arm's twist out along it.
//
// The game's figure rig (src/render/figure.ts, src/sculpt/rig.ts bonesOf) drives it through fromGame(): each of its bones'
// turns from its rest, taken onto ours, our own joint positions kept (see the report in rig-<who>.json, `game`).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildArmBody } from './lowarm.mjs';
import { nameVerts, loopSpecs } from './lowloops.mjs';

/* ---- vectors, 3x3 rotations (row-major), quaternions [w, x, y, z] ------------------------------------------------ */
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mx = (p) => [-p[0], p[1], p[2]];
const mean = (ps) => mul(ps.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ps.length);
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mm = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
export const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const tr = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** The frame whose columns are x, y, z. */
const cols = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const colOf = (m, k) => [m[k], m[3 + k], m[6 + k]];
/** Rotation by deg about a unit axis. */
export function axisAngle(a, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c, [x, y, z] = unit(a);
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
const RX = (d) => axisAngle([1, 0, 0], d), RY = (d) => axisAngle([0, 1, 0], d), RZ = (d) => axisAngle([0, 0, 1], d);
export function quat(m) {
  const t = m[0] + m[4] + m[8];
  let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [0.25 * s, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [(m[7] - m[5]) / s, 0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[2] - m[6]) / s, (m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s]; }
  const l = Math.hypot(...q); return q.map((x) => x / l);
}
export function qmat([w, x, y, z]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qinv = (q) => [q[0], -q[1], -q[2], -q[3]];
/** The rotation q taken t of the way from none (t may be negative or past one). */
export function qpow(q, t) {
  if (q[0] < 0) q = q.map((x) => -x);
  const a = Math.acos(Math.min(1, q[0])), s = Math.sin(a);
  if (s < 1e-9) return [1, 0, 0, 0];
  const k = Math.sin(a * t) / s;
  return [Math.cos(a * t), q[1] * k, q[2] * k, q[3] * k];
}
/** q = swing · twist, the twist about the local axis a (unit). */
export function swingTwist(q, a) {
  const p = q[1] * a[0] + q[2] * a[1] + q[3] * a[2];
  let t = [q[0], a[0] * p, a[1] * p, a[2] * p];
  const l = Math.hypot(...t);
  t = l < 1e-9 ? [1, 0, 0, 0] : t.map((x) => x / l);
  return { swing: qmul(q, qinv(t)), twist: t };
}
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* ---- the body with its vertices named ------------------------------------------------------------------------------ */
const sideOf = (p) => (p[0] > 1e-9 ? '.L' : p[0] < -1e-9 ? '.R' : '');

/** buildArmBody, its vertices named: the parts' own names with .L (the body's left) or .R (lowloops.mjs nameVerts), the
 * extra loops' vertices by their own names; the head's closed pieces (brows, pupils, lids, ears), which have no names of
 * their own, as brow.L#k etc. in vertex order. */
export function buildNamedBody(who = 'male') {
  const body = buildArmBody(who);
  const names = nameVerts(who, body.verts);
  for (const [i, n] of body.added ?? []) names[i] = n;
  // each loop vertex's ring, index and edge: { ring, k, a, b, t }
  const loops = new Map();
  for (const L of loopSpecs()) L.pts.forEach(([a, b, t, n], k) => loops.set(n, { ring: L.ring, k: +n.replace(/^.*?(\d+)(\.[LR])?$/, '$1'), a, b, t }));
  const piece = new Array(body.verts.length).fill(null);
  for (const p of body.polys) for (const i of p.v) if (!piece[i]) piece[i] = p.ear ? 'ear' : p.mat !== 'skin' ? p.mat : p.part;
  const count = {};
  names.forEach((n, i) => {
    if (n) return;
    const tag = piece[i] + sideOf(body.verts[i]);
    count[tag] = (count[tag] ?? 0) + 1;
    names[i] = `${tag}#${count[tag]}`;
  });
  const index = new Map(names.map((n, i) => [n, i]));
  if (index.size !== names.length) { const seen = {}; names.forEach((n, i) => (seen[n] ??= []).push(i)); throw new Error('vertex names are not unique: ' + JSON.stringify(Object.entries(seen).filter(([, l]) => l.length > 1).slice(0, 8).map(([n, l]) => [n, l.map((i) => body.verts[i])]))); }
  const part = new Array(body.verts.length).fill(null);
  for (const p of body.polys) for (const i of p.v) part[i] ??= p.part;
  return { ...body, tris: TUNE.MEND ? fanTris(body) : body.tris, names, index, part, loops: body.added ? loops : new Map() };
}

/**
 * The mesh's triangles with its slivers mended (TUNE.MEND, on: a proposal over the approved triangles). Its
 * ear-clipping leaves triangles of three corners nearly in a line (down the abs' centre line: wa0 hi0 hw0, wa0 hw0 bt0,
 * bt0 hw0 hi0; on the pectorals, the deltoids' fronts and the shoulder blades): flat at rest, they open into folds once
 * the rows either side turn by different amounts (the spine twisted or bent sideways). Each such triangle (a, b, c), b on
 * the segment ac, goes, with its neighbour (a, c, d) in the same polygon, into (a, b, d) and (b, c, d): at rest the same
 * surface to within the sliver's width (39 triangles change; a few antialiased pixels move by 5/255 or less).
 */
export function fanTris(m) {
  let T = m.tris.map((t) => ({ ...t, v: [...t.v] }));
  const area = (t) => Math.hypot(...cross(sub(m.verts[t.v[1]], m.verts[t.v[0]]), sub(m.verts[t.v[2]], m.verts[t.v[0]]))) / 2;
  const thin = (t) => area(t) < 2e-3 && Math.max(...[0, 1, 2].map((k) => Math.hypot(...sub(m.verts[t.v[k]], m.verts[t.v[(k + 1) % 3]])))) > 0.05;
  // a sliver is mended against a neighbour that is not one itself; a run of them in a line, from its end inward
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (let bad = 0; bad < T.length; bad++) {
      const t = T[bad];
      if (!thin(t)) continue;
      const L = [0, 1, 2].map((k) => Math.hypot(...sub(m.verts[t.v[(k + 2) % 3]], m.verts[t.v[(k + 1) % 3]])));
      const k = L.indexOf(Math.max(...L)), b = t.v[k], c = t.v[(k + 1) % 3], a = t.v[(k + 2) % 3];
      // the neighbour (a, c, d) runs a -> c
      const ni = T.findIndex((u, j) => j !== bad && u.poly === t.poly && [0, 1, 2].some((q) => u.v[q] === a && u.v[(q + 1) % 3] === c));
      if (ni < 0 || thin(T[ni])) continue;
      const u = T[ni], q = [0, 1, 2].find((j) => u.v[j] === a), d = u.v[(q + 2) % 3];
      T[bad] = { ...t, v: [a, b, d] };
      T[ni] = { ...u, v: [b, c, d] };
      changed = true;
    }
  }
  return T.map(({ stuck, ...t }) => t);
}

/* ---- the skeleton ---------------------------------------------------------------------------------------------------- */
/** The body's joints, measured off its named rings (the left side; the right is its mirror). */
export function measure(B) {
  const P = (n) => { const i = B.index.get(n) ?? B.index.get(n.replace(/\.L$/, '')); if (i === undefined) throw new Error(`no vertex ${n}`); return B.verts[i]; };
  const ring = (r, n, s = '.L') => mean(Array.from({ length: n }, (_, k) => P(`${r}${k}${s}`)));
  const A = (n) => P(`arm/${n}`);
  const row = (r) => ({ front: P(`${r}0`), back: P(`${r}8`) });
  // the spine's pivots lie 40% of the trunk's depth in from the back
  const spineZ = (r) => { const { front, back } = row(r); return back[2] + 0.4 * (front[2] - back[2]); };
  const J = {};
  const floor = P('so0.L')[1];
  J.root = [0, floor, 0];
  // the hip: under the thigh's top ring's centre, halfway between the body row under the waist and that ring
  const th = ring('th', 8), gl = ring('gl', 9);
  J.hip = [th[0] + TUNE.PIV.hipOut, gl[1] + TUNE.PIV.hipDown * (th[1] - gl[1]), th[2]];
  J.pelvis = [0, J.hip[1] + 0.45, spineZ('bt')];
  J.spine1 = [0, (ring('hi', 9)[1] + ring('hw', 9)[1]) / 2, spineZ('hi')];
  J.spine2 = [0, (ring('rb', 9)[1] + ring('rc', 9)[1]) / 2, spineZ('rb')];
  J.spine3 = [0, (ring('dc', 9)[1] + ring('ra', 9)[1]) / 2, spineZ('ra')];
  // the neck from the neck's foot (nm, low at the front notch, high at the nape) to the skull's base, behind the jaw
  const nm = mean(['nm0', 'nm1.L', 'nm2.L', 'nm3.L', 'nm4.L', 'nm5', 'nm1.R', 'nm2.R', 'nm3.R', 'nm4.R'].map(P));
  J.neck1 = [0, nm[1] - 0.05, nm[2] - 0.17];
  J.head = [0, P('n6.L')[1], (P('n6.L')[2] + P('j.L')[2]) / 2];
  J.neck2 = lerp(J.neck1, J.head, 0.5);
  J.crown = [0, P('c')[1], J.head[2]];
  J.jaw = [0, P('j.L')[1] - 0.04, (P('j.L')[2] + P('m5.L')[2]) / 2];
  J.chin = mean([P('ch0'), P('u0')]);
  // the clavicle from beside the notch (the neck foot's front corner, in and back) to the shoulder
  J.clav = add(P('nm1.L'), [0.05, -0.05, -0.12]);
  // the shoulder: the centre of the deltoid's ball, the sphere through its rings ja and jb (least squares)
  const ball = [];
  for (const r of ['ja', 'jb']) for (let k = 0; k < 8; k++) ball.push(A(`${r}${k}.L`));
  J.shoulder = add(sphere(ball).c, TUNE.PIV.shoulder);
  // the elbow: the ring el's centre, a fifth of the way to its back (3), where the hinge is
  const el = ring('arm/el', 8);
  J.elbow = lerp(el, A('el3.L'), TUNE.PIV.elbowBack);
  const W = ['wk', 'wb0', 'wb1', 'wt', 'wp1', 'wp0'].map((n) => A(`${n}.L`));
  J.wrist = mean(W);
  J.knuckle = mean([0, 1, 2, 3, 4].flatMap((k) => [A(`kb${k}.L`), A(`kp${k}.L`)]));
  J.mid = mean([0, 1, 2, 3, 4].flatMap((k) => [A(`mb${k}.L`), A(`mp${k}.L`)]));
  J.tip = mean([0, 1, 2, 3, 4].flatMap((k) => [A(`nb${k}.L`), A(`np${k}.L`)]));
  // the palm's way (from the back of the hand through to the palm), for the hand's bend axes
  J.palm = unit(sub(mean([0, 1, 2, 3, 4].map((k) => A(`kp${k}.L`)).concat([A('wp0.L'), A('wp1.L')])), mean([0, 1, 2, 3, 4].map((k) => A(`kb${k}.L`)).concat([A('wb0.L'), A('wb1.L')]))));
  J.thumb1 = lerp(A('wt.L'), A('pa.L'), 0.5);
  J.thumb2 = mean(['ta', 'tb', 'tc', 'td'].map((n) => A(`${n}.L`)));
  J.thumb3 = mean(['t1a', 't1b', 't1c', 't1d'].map((n) => A(`${n}.L`)));
  J.thumbTip = mean(['t2a', 't2b', 't2c', 't2d'].map((n) => A(`${n}.L`)));
  // the knee: the crease ring kb's centre at 45% of its depth from the back; the ankle under the ankle ring
  const kbs = B.names.filter((n) => /^kb\d[ab]?\.L$/.test(n)).map(P);
  const kbc = mean(kbs), zs = kbs.map((p) => p[2]);
  J.knee = [kbc[0], kbc[1], Math.min(...zs) + TUNE.PIV.kneeDepth * (Math.max(...zs) - Math.min(...zs))];
  const an = ring('an', 6), fc = ring('fc', 6);
  J.ankle = [an[0], an[1] + 0.3 * (fc[1] - an[1]), an[2] + 0.15];
  J.ball = [(P('ft2.L')[0] + P('ft5.L')[0]) / 2, floor + 0.17, (P('ft2.L')[2] + P('ft5.L')[2]) / 2];
  J.toe = [(P('ft0.L')[0] + P('ft1.L')[0]) / 2, floor + 0.12, (P('ft0.L')[2] + P('ft1.L')[2]) / 2];
  J.floor = floor;
  return J;
}

/** The least-squares sphere through points: its centre c and radius r. */
function sphere(pts) {
  // |p|^2 = 2 c·p + (r^2 - |c|^2): linear in (c, k)
  const A = [], b = [];
  for (const p of pts) { A.push([2 * p[0], 2 * p[1], 2 * p[2], 1]); b.push(dot(p, p)); }
  const M = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => A.reduce((s, r) => s + r[i] * r[j], 0)));
  const v = Array.from({ length: 4 }, (_, i) => A.reduce((s, r, k) => s + r[i] * b[k], 0));
  for (let i = 0; i < 4; i++) { // gauss
    let p = i; for (let k = i + 1; k < 4; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]]; [v[i], v[p]] = [v[p], v[i]];
    for (let k = i + 1; k < 4; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; v[k] -= f * v[i]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = v[i]; for (let j = i + 1; j < 4; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  const c = [x[0], x[1], x[2]];
  return { c, r: Math.sqrt(x[3] + dot(c, c)) };
}

const FWD = [0, 0, 1], UP = [0, 1, 0];
/**
 * The bones: { name, parent, head, tail, flex (the way +rx carries the tail), kind ('control' or 'helper'), driver (a
 * helper's: { from, kind: 'half' | 'twist' | 'wrist' | 'untwist', f }), game (the figure rig's bone it follows) }, the
 * frame R (columns X, Y, Z) worked out from head, tail and flex.
 */
export function skeleton(J) {
  const bones = [];
  const b = (name, parent, head, tail, flex, o = {}) => bones.push({ name, parent, head, tail, flex, kind: 'control', ...o });
  b('root', null, J.root, add(J.root, [0, 0, 0.6]), UP, { game: null });
  b('pelvis', 'root', J.pelvis, J.spine1, FWD, { game: 'pelvis' });
  b('spine_01', 'pelvis', J.spine1, J.spine2, FWD, { game: 'spineA' });
  b('spine_02', 'spine_01', J.spine2, J.spine3, FWD, { game: 'spineB' });
  b('spine_03', 'spine_02', J.spine3, J.neck1, FWD, { game: 'chest' });
  b('neck_01', 'spine_03', J.neck1, J.neck2, FWD, { game: 'neck' });
  b('neck_02', 'neck_01', J.neck2, J.head, FWD, { game: 'neck+head/2' });
  b('head', 'neck_02', J.head, J.crown, FWD, { game: 'head' });
  b('jaw', 'head', J.jaw, J.chin, [0, -1, 0], { game: 'jaw' });
  for (const s of ['l', 'r']) {
    const m = s === 'l' ? (p) => p : mx;
    const S = (n) => `${n}_${s}`;
    b(S('clavicle'), 'spine_03', m(J.clav), m(J.shoulder), FWD, { game: s === 'l' ? 'clav0' : 'clav1' });
    b(S('upperarm'), S('clavicle'), m(J.shoulder), m(J.elbow), FWD, { game: s === 'l' ? 'arm0' : 'arm1' });
    b(S('lowerarm'), S('upperarm'), m(J.elbow), m(J.wrist), FWD, { game: s === 'l' ? 'elbow0' : 'elbow1' });
    b(S('hand'), S('lowerarm'), m(J.wrist), m(J.knuckle), m(J.palm), { game: s === 'l' ? 'wrist0' : 'wrist1' });
    b(S('thumb_01'), S('hand'), m(J.thumb1), m(J.thumb2), m(J.palm), { game: s === 'l' ? 'thumb0' : 'thumb1' });
    b(S('thumb_02'), S('thumb_01'), m(J.thumb2), m(J.thumb3), m(J.palm));
    b(S('thumb_03'), S('thumb_02'), m(J.thumb3), m(J.thumbTip), m(J.palm));
    b(S('fingers_01'), S('hand'), m(J.knuckle), m(J.mid), m(J.palm), { game: s === 'l' ? 'fing0/2' : 'fing1/2' });
    b(S('fingers_02'), S('fingers_01'), m(J.mid), m(J.tip), m(J.palm), { game: s === 'l' ? 'fing0' : 'fing1' });
    b(S('thigh'), 'pelvis', m(J.hip), m(J.knee), FWD, { game: s === 'l' ? 'hip0' : 'hip1' });
    b(S('calf'), S('thigh'), m(J.knee), m(J.ankle), FWD, { game: s === 'l' ? 'knee0' : 'knee1' });
    b(S('foot'), S('calf'), m(J.ankle), m(J.ball), UP, { game: s === 'l' ? 'ankle0' : 'ankle1' });
    b(S('ball'), S('foot'), m(J.ball), m(J.toe), UP, { game: s === 'l' ? 'toe0' : 'toe1' });
  }
  // the driven helpers: each at a control bone's head (or along it), in its rest frame
  const h = (name, parent, like, driver, at = null) => {
    const L = bones.find((x) => x.name === like);
    bones.push({ name, parent, head: at ?? L.head, tail: L.tail, flex: L.flex, kind: 'helper', driver });
  };
  for (const s of ['l', 'r']) {
    const S = (n) => `${n}_${s}`, B = (n) => bones.find((x) => x.name === S(n));
    h(S('shoulder'), S('clavicle'), S('upperarm'), { from: S('upperarm'), kind: 'half', f: 0.5 });
    h(S('upperarm_twist'), S('upperarm'), S('upperarm'), { from: S('upperarm'), kind: 'untwist', f: 0.5 });
    h(S('elbow'), S('upperarm'), S('lowerarm'), { from: S('lowerarm'), kind: 'half', f: 0.5 });
    h(S('lowerarm_twist'), S('lowerarm'), S('lowerarm'), { from: S('hand'), kind: 'twist', f: 0.5 }, lerp(B('lowerarm').head, B('lowerarm').tail, 0.5));
    h(S('wrist'), S('lowerarm'), S('hand'), { from: S('hand'), kind: 'wrist', f: 0.5 });
    h(S('knuckles'), S('hand'), S('fingers_01'), { from: S('fingers_01'), kind: 'half', f: 0.5 });
    h(S('hip'), 'pelvis', S('thigh'), { from: S('thigh'), kind: 'half', f: 0.5 });
    h(S('knee'), S('thigh'), S('calf'), { from: S('calf'), kind: 'half', f: 0.5 });
  }
  for (const x of bones) {
    const Y = unit(sub(x.tail, x.head)), X = unit(cross(Y, x.flex)), Z = cross(X, Y);
    x.R = cols(X, Y, Z);
  }
  const at = new Map(bones.map((x, i) => [x.name, i]));
  for (const x of bones) {
    x.p = x.parent === null ? -1 : at.get(x.parent);
    if (x.p >= 0) { const P = bones[x.p]; x.Rrel = mm(tr(P.R), x.R); x.off = mv(tr(P.R), sub(x.head, P.head)); }
    if (x.driver) x.from = at.get(x.driver.from);
  }
  return { bones, at };
}

/* ---- the weights ----------------------------------------------------------------------------------------------------- */
/** The weights' tables (rings' shares along their chains), exported so the shot tool can try variants. */
export const TUNE = {
  // the mesh's centre-line slivers mended (fanTris): on (proposed; set false for the approved triangles exactly)
  MEND: true,
  // where the measured pivots sit: the elbow from its ring's centre toward its back (el3), the knee's depth from the back,
  // the hip between the body row under the waist (0) and the thigh's top ring (1), and out from the thigh's centre
  PIV: { elbowBack: -0.15, kneeDepth: 0.3, hipDown: 0.3, hipOut: 0.15, shoulder: [0.1, 0, 0] },
  // the arm's rings: their share along the chain (ring -> {bone: w})
  ARM: {
    ja: { clavicle: 0.3, shoulder: 0.7 },
    jb: { shoulder: 0.55, upperarm_twist: 0.45 },
    ua: { shoulder: 0.15, upperarm_twist: 0.6, upperarm: 0.25 },
    uc: { upperarm_twist: 0.35, upperarm: 0.65 },
    ue: { upperarm: 0.6, elbow: 0.4 },
    el: { elbow: 1 },
    fa: { elbow: 0.4, lowerarm: 0.6 },
    fb: { lowerarm: 0.85, lowerarm_twist: 0.15 },
    fc: { lowerarm: 0.6, lowerarm_twist: 0.4 },
    fd: { lowerarm: 0.3, lowerarm_twist: 0.7 },
    fe: { lowerarm_twist: 0.95, wrist: 0.05 },
    fg: { lowerarm_twist: 0.55, wrist: 0.45 },
  },
  LEG: {
    th: { pelvis: 0.2, hip: 0.6, thigh: 0.2 },
    tm: { thigh: 1 },
    ka: { thigh: 0.75, knee: 0.25 },
    kb: { knee: 1 },
    kc: { knee: 0.3, calf: 0.7 },
    ca: { calf: 1 }, cb: { calf: 1 },
    an: { calf: 0.45, foot: 0.55 },
    fc: { calf: 0.1, foot: 0.9 },
  },
  // the extra loops (tools/sculpt/lowloops.mjs), by ring and index (or `all`): unset, a loop vertex blends its edge's ends
  LOOP: {},
  // the crotch's point, shared by both legs; the thigh's top ring's inner points (by the crotch)
  CX: { pelvis: 0.6, hip_l: 0.2, hip_r: 0.2 },
  TH_IN: {},
  GL: { gl0: 0, gl1: 0.25, gl2: 0.4, gl3: 0.45, gl4: 0.45, gl5: 0.4, gl6: 0.3, gl7: 0.12, gl8: 0 },
  HAND_FING: { k: { knuckles: 1 }, m: { fingers_01: 0.5, fingers_02: 0.5 }, n: { fingers_02: 1 } },
  THUMB: { ta: { hand: 0.35, thumb_01: 0.65 }, tb: { hand: 0.45, thumb_01: 0.55 }, tc: { hand: 0.45, thumb_01: 0.55 }, td: { hand: 0.4, thumb_01: 0.6 }, t1: { thumb_02: 0.5, thumb_03: 0.5 }, t2: { thumb_03: 1 } },
  // the shoulder girdle's share by row, and the shoulder helper's share round the arm's cut
  ROWF: { tr: 1, sd: 1, da: 1, db: 0.85, dc: 0.6, ra: 0.25 },
  // the chest's front (the pectorals, columns 0 to 2) takes this share of it
  CLAV_FRONT: 1,
  NEAR: { da3: 0.28, da4: 0.3, da5: 0.28, db3: 0.22, db5: 0.22, dc3: 0.15, dc4: 0.12, dc5: 0.15, sd3: 0.1, sd4: 0.14, sd5: 0.1, da2: 0.06, da6: 0.06, db2: 0.05, db6: 0.05 },
  // the neck's foot (front, nape) and the neck's top ring (under the jaw, the nape)
  NM: { front: { spine_03: 0.3, neck_01: 0.7 }, back: { spine_03: 0.1, neck_01: 0.9 } },
  NECK: { g: { neck_02: 0.75, head: 0.25 }, n6: { neck_02: 0.7, head: 0.3 }, gFront: { neck_02: 0.7, head: 0.15, jaw: 0.15 } },
};

/**
 * Each vertex's bones, by its name: chain coordinates along the limbs ring by ring (each ring on a joint shared between
 * the bone above, the joint's helper and the bone below), the trunk by height between the spine's pivots, the shoulder
 * girdle by how far out from the neck. At most four, normalised. Returns { [name]: [[bone, w], ...] }.
 */
export function skinWeights(B, J) {
  const W = {};
  const sideBone = (side) => (n) => (side ? `${n}_${side}` : n);
  const spine = (y) => {
    // pelvis | spine_01 | spine_02 | spine_03, smooth across each pivot
    const cuts = [[J.spine1[1], 0.42, 'pelvis', 'spine_01'], [J.spine2[1], 0.36, 'spine_01', 'spine_02'], [J.spine3[1], 0.32, 'spine_02', 'spine_03']];
    let w = { pelvis: 1 };
    for (const [yc, hw, lo, hi] of cuts) {
      const t = sstep(yc - hw, yc + hw, y);
      const share = w[lo] ?? 0;
      if (share && t) { w[lo] = share * (1 - t); w[hi] = (w[hi] ?? 0) + share * t; }
    }
    return w;
  };
  /** Moves `frac` of the shares of `from` (all of them, proportionally) to the bones `to` ({bone: f}, summing to 1). */
  const move = (w, from, frac, to) => {
    if (frac <= 0) return w;
    let tot = 0;
    for (const f of from) tot += w[f] ?? 0;
    if (tot <= 0) return w;
    for (const f of from) if (w[f]) w[f] *= 1 - frac;
    for (const [bn, f] of Object.entries(to)) w[bn] = (w[bn] ?? 0) + tot * frac * f;
    return w;
  };
  const { ARM, LEG, GL, HAND_FING, THUMB, ROWF, NEAR: near, NM, NECK } = TUNE;
  // the extra loops' vertices (lowloops.mjs) after the rest: by default each takes its edge's ends' weights blended at its
  // place along the edge (so at rest it moves as the surface it was cut into); TUNE.LOOP[ring] over that
  const loops = B.loops ?? new Map();
  const dict = (n) => Object.fromEntries(W[n]);
  const blend = (a, b, t) => { const o = {}; for (const [k, x] of Object.entries(a)) o[k] = (o[k] ?? 0) + x * (1 - t); for (const [k, x] of Object.entries(b)) o[k] = (o[k] ?? 0) + x * t; return o; };
  const order = B.verts.map((_, i) => i).sort((a, b) => (loops.has(B.names[a]) ? 1 : 0) - (loops.has(B.names[b]) ? 1 : 0));
  for (const i of order) {
    const name = B.names[i], p = B.verts[i];
    let part = B.part[i];
    const side = name.endsWith('.L') || /\.L#\d+$/.test(name) ? 'l' : name.endsWith('.R') || /\.R#\d+$/.test(name) ? 'r' : '';
    const S = sideBone(side);
    const base = name.replace(/^arm\//, '').replace(/\.[LR]$/, '').replace(/#\d+$/, '');
    const ringOf = base.replace(/\d+[ab]?$/, '');
    let w = null;
    const named = (tab) => Object.fromEntries(Object.entries(tab).map(([k, v]) => [k === 'pelvis' ? k : S(k), v]));
    if (/^(g\d|n6)$/.test(base) && part !== 'neck') part = 'neck';
    const lp = loops.get(name);
    if (lp) {
      const own = TUNE.LOOP[lp.ring]?.[lp.k] ?? TUNE.LOOP[lp.ring]?.all;
      w = own ? Object.fromEntries(Object.entries(own).map(([k, v]) => [/^(pelvis|spine_0\d|neck_0\d|head)$/.test(k) ? k : S(k), v])) : blend(dict(lp.a), dict(lp.b), lp.t);
    } else if (ARM[ringOf] && (part === 'joint' || part === 'arm')) w = named(ARM[ringOf]);
    else if (part === 'arm' || part === 'hand' || part === 'joint') {
      if (['wk', 'wb', 'wt', 'wp'].includes(ringOf)) w = named({ wrist: 1 });
      else if (/^[kmn][bp]$/.test(ringOf)) w = named(HAND_FING[ringOf[0]]);
      else if (THUMB[base]) w = named(THUMB[base]);
      else if (/^t[12][abcd]$/.test(base)) w = named(THUMB[base.slice(0, 2)]);
      else if (base === 'pa') w = named({ hand: 0.7, wrist: 0.15, thumb_01: 0.15 });
      else w = named({ hand: 1 });
    } else if (part === 'legs' || part === 'pelvis') {
      if (ringOf === 'th' && TUNE.TH_IN[base]) w = named(TUNE.TH_IN[base]);
      else if (LEG[ringOf]) w = named(LEG[ringOf]);
      else if (/^k[abc]$/.test(ringOf.slice(0, 2)) && LEG[ringOf.slice(0, 2)]) w = named(LEG[ringOf.slice(0, 2)]);
      else if (ringOf === 'gl') { const f = GL[base] ?? 0; w = { pelvis: 1 - f, [S('hip')]: f }; }
      else if (['ft', 'so'].includes(ringOf)) w = named(['0', '1'].includes(base.slice(2)) ? { ball: 1 } : { foot: 1 });
      else if (base === 'cx') w = { ...TUNE.CX };
      else if (ringOf === 'bt') w = { pelvis: 1 };
      else throw new Error(`no leg weight for ${name}`);
    } else if (part === 'torso' || base.startsWith('nm')) {
      if (ringOf === 'nm') {
        // the neck's foot: the chest and the neck's lower bone, the nape (high at the back) more on the neck
        const back = sstep(0.35, -0.6, p[2]);
        w = Object.fromEntries(['spine_03', 'neck_01'].map((k) => [k, NM.front[k] * (1 - back) + NM.back[k] * back]));
      } else {
        w = spine(p[1]);
        // the shoulder girdle: out from the neck, over the upper chest and the shoulder blades, onto the clavicle
        const col = +base.slice(ringOf.length) || 0, front = col <= 2 && p[2] > 0 ? TUNE.CLAV_FRONT : 1;
        const f = (ROWF[ringOf] ?? 0) * front * sstep(0.32, 1.15, Math.abs(p[0]));
        if (f > 0 && side) move(w, ['spine_03', 'spine_02'], f * 0.85, { [S('clavicle')]: 1 });
        // the arm's cut and the planes round it give a little to the shoulder's helper, the armpit's least
        if (side && near[base]) move(w, ['spine_03', 'spine_02', S('clavicle')], near[base], { [S('shoulder')]: 1 });
      }
    } else if (part === 'neck' || /^(g\d|n6)$/.test(base)) {
      // the neck's top ring under the jaw and the nape: the neck's upper bone and the head
      w = { ...(p[1] > 0.35 ? NECK.n6 : NECK.g) };
      if (/^g[01]$/.test(base)) w = { ...NECK.gFront };
    } else if (part === 'head') {
      w = { head: 1 };
      if (/^(ch\d|u\d)$/.test(base)) w = { jaw: 0.75, head: 0.25 };
      else if (base === 'jl') w = { jaw: 0.4, head: 0.6 };
    } else throw new Error(`no weight for ${name} (${part})`);
    // at most four, normalised
    let list = Object.entries(w).filter(([, x]) => x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = list.reduce((s, [, x]) => s + x, 0);
    list = list.map(([bn, x]) => [bn, +(x / tot).toFixed(4)]);
    // the rounding's remainder on the largest, so each sums to exactly one at four decimals
    const rest = +(1 - list.reduce((s, [, x]) => s + x, 0)).toFixed(4);
    list[0][1] = +(list[0][1] + rest).toFixed(4);
    W[name] = list;
  }
  return W;
}

/* ---- posing and skinning --------------------------------------------------------------------------------------------- */
/** A local pose from [rx, ry, rz] degrees: Rz · Rx · Ry. */
export const euler = ([rx = 0, ry = 0, rz = 0]) => mm(RZ(rz), mm(RX(rx), RY(ry)));
/** The same pose on both sides: the left as given, the right mirrored. */
export function sym(pose, bone, e) { pose[`${bone}_l`] = e; pose[`${bone}_r`] = [e[0], -(e[1] ?? 0), -(e[2] ?? 0)]; return pose; }

/**
 * The world frames of a pose. pose: { bone: [rx, ry, rz] | 3x3 local rotation, $move: [dx, dy, dz] (the root's) }.
 * Returns per bone { W (world rotation), P (world head), S (skinning rotation W Rᵀ), L }.
 */
export function posed(rig, pose = {}) {
  const { bones } = rig, out = new Array(bones.length);
  const isId = (m) => m.every((x, k) => x === I3[k]);
  const local = bones.map((b) => { const e = pose[b.name]; const m = !e ? I3 : e.length === 9 ? e : euler(e); return isId(m) ? I3 : m; });
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i];
    let L = local[i];
    if (b.kind === 'helper' && local[b.from] !== I3) {
      const q = quat(local[b.from]), d = b.driver;
      const src = bones[b.from];
      if (d.kind === 'half') L = qmat(qpow(q, d.f));
      else if (d.kind === 'untwist') L = qmat(qpow(swingTwist(q, [0, 1, 0]).twist, -d.f));
      else if (d.kind === 'wrist') { const { swing, twist } = swingTwist(q, [0, 1, 0]); L = qmat(qmul(qpow(swing, d.f), twist)); }
      else if (d.kind === 'twist') {
        // half the hand's twist about its own axis, taken into the forearm's frame
        const tw = qmat(qpow(swingTwist(q, [0, 1, 0]).twist, d.f)), Rr = mm(tr(b.R), src.R);
        L = mm(Rr, mm(tw, tr(Rr)));
      }
    }
    let W, P;
    const still = L === I3 && (b.p < 0 ? !pose.$move : out[b.p].still);
    if (still) { out[i] = { W: b.R, P: b.head, S: I3, L, still }; continue; }
    if (b.p < 0) { W = mm(b.R, L); P = add(b.head, pose.$move ?? [0, 0, 0]); }
    else {
      const pa = out[b.p];
      W = mm(pa.W, mm(b.Rrel ?? mm(tr(bones[b.p].R), b.R), L));
      P = add(pa.P, mv(pa.W, b.off ?? mv(tr(bones[b.p].R), sub(b.head, bones[b.p].head))));
    }
    out[i] = { W, P, S: mm(W, tr(b.R)), L };
  }
  return out;
}

/** The rig ready to pose: bones with their frames, and each vertex's (bone index, weight) list. */
export function buildRig(who = 'male') {
  const B = buildNamedBody(who);
  const J = measure(B);
  const { bones, at } = skeleton(J);
  const weights = skinWeights(B, J);
  const vw = B.names.map((n) => weights[n].map(([bn, w]) => [at.get(bn), w]));
  return { who, B, J, bones, at, weights, vw };
}

/** The body's vertices in a pose. An identity pose returns the rest positions exactly. */
export function skin(rig, frames) {
  const { B, bones, vw } = rig;
  return B.verts.map((v, i) => {
    let x = 0, y = 0, z = 0, ident = true;
    for (const [bi] of vw[i]) { const f = frames[bi], S = f.S; if (S[0] !== 1 || S[4] !== 1 || S[8] !== 1 || S[1] || S[2] || S[3] || S[5] || S[6] || S[7] || f.P[0] !== bones[bi].head[0] || f.P[1] !== bones[bi].head[1] || f.P[2] !== bones[bi].head[2]) { ident = false; break; } }
    if (ident) return [...v];
    for (const [bi, w] of vw[i]) {
      const f = frames[bi], d = sub(v, bones[bi].head), q = add(mv(f.S, d), f.P);
      x += w * q[0]; y += w * q[1]; z += w * q[2];
    }
    return [x, y, z];
  });
}

/** Lowered or raised so the lowest sole vertex is on the floor (as the figure stands its body on its lowest sole). */
export function ground(rig, verts) {
  const so = rig.B.names.map((n, i) => (/^so\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const low = Math.min(...so.map((i) => verts[i][1]));
  const dy = rig.J.floor - low;
  return verts.map((p) => [p[0], p[1] + dy, p[2]]);
}

/* ---- the game's figure rig onto ours --------------------------------------------------------------------------------- */
/** The mesh's axes in the game's: x the body's right, y forward, z up (game = T · mesh). */
export const T = [-1, 0, 0, 0, 0, 1, 0, 1, 0];
/**
 * Our local pose from the game's bones (src/sculpt/rig.ts bonesOf) posed and at rest: each of our control bones turned in
 * the world as its game bone has turned from the game's rest, our own joint positions kept. `rest` must be the figure rig
 * that puts the game's bones where ours are at bind (fitRest() finds it). Bones the game has no one bone for: neck_02
 * halfway between the neck and the head; fingers_01 half the game's finger curl, fingers_02 the rest; thumb_02 and
 * thumb_03 follow thumb_01. Helpers are driven from the result as in any pose.
 */
export function fromGame(rig, gPosed, gRest) {
  const D = (g) => { const a = gPosed[g].m, b = gRest[g].m; return mm(tr(T), mm(mm(a, tr(b)), T)); };
  const half = (A, Bm) => mm(A, qmat(qpow(quat(mm(tr(A), Bm)), 0.5)));
  const Wd = {};
  for (const b of rig.bones) {
    if (b.kind !== 'control' || !b.game) continue;
    let d;
    if (b.game === 'neck+head/2') d = half(D('neck'), D('head'));
    else if (b.game.endsWith('/2')) { const g = b.game.slice(0, -2), wr = g.replace('fing', 'wrist'); d = half(D(wr), D(g)); }
    else d = D(b.game);
    Wd[b.name] = mm(d, b.R);
  }
  // locals, parents first
  const W = {}, pose = {};
  for (const b of rig.bones) {
    if (b.kind !== 'control') continue;
    const pW = b.p >= 0 ? W[rig.bones[b.p].name] : null;
    const base = pW ? mm(pW, b.Rrel) : b.R;
    const want = Wd[b.name] ?? base;
    pose[b.name] = mm(tr(base), want);
    W[b.name] = want;
  }
  return pose;
}

/**
 * The figure rig at rest whose bones lie as ours do at bind: the game's rest (figure.ts rest()) with each limb's angles
 * fitted (arm, elbow, hand; leg, knee, foot) so that its bones' long axes and bend axes match ours. `bonesOf(rig, P)` and
 * `restRig` come from the game; returns the fitted rig and the worst angle left, degrees.
 */
export function fitRest(rig, bonesOf, restRig, P) {
  const r = structuredClone(restRig);
  const want = (name) => { const b = rig.bones[rig.at.get(name)]; return mm(T, b.R); };
  // the game's frames: a limb hangs down its -z; its bend axis is its x
  const err = (g, gb, name, twist = true) => {
    const m = g[gb].m, w = want(name);
    const down = [-m[2], -m[5], -m[8]], ax = [m[0], m[3], m[6]];
    const e1 = Math.acos(Math.max(-1, Math.min(1, dot(down, colOf(w, 1)))));
    const e2 = twist ? Math.acos(Math.max(-1, Math.min(1, Math.abs(dot(ax, colOf(w, 0)))))) * 0.5 : 0;
    return e1 + e2;
  };
  const cost = () => {
    const g = bonesOf(r, P, [], { blink: 0, jaw: 0, smile: 0.5, brow: 0 });
    let c = 0;
    for (const k of [0, 1]) {
      const s = k ? 'r' : 'l';
      c += err(g, `arm${k}`, `upperarm_${s}`) + err(g, `elbow${k}`, `lowerarm_${s}`) + err(g, `hip${k}`, `thigh_${s}`) + err(g, `knee${k}`, `calf_${s}`);
      // the hand: its long axis down the hand, and the palm's way: the game's hand holds its palm to its -x on the left
      const m = g[`wrist${k}`].m, w = want(`hand_${s}`);
      c += Math.acos(Math.max(-1, Math.min(1, dot([-m[2], -m[5], -m[8]], colOf(w, 1)))));
      const palmG = mul([m[0], m[3], m[6]], k ? -1 : 1), palmW = mv(T, rig.J.palm.map((x, i) => (i === 0 && k ? -x : x)));
      c += 0.5 * Math.acos(Math.max(-1, Math.min(1, dot(palmG, unit(sub(palmW, mul(colOf(w, 1), dot(palmW, colOf(w, 1)))))))));
    }
    return c;
  };
  const params = [];
  for (const k of [0, 1]) {
    for (let j = 0; j < 3; j++) params.push([r.arm[k], j]);
    params.push([r.elbow, k]);
    for (let j = 0; j < 3; j++) params.push([r.hand[k], j]);
    for (let j = 0; j < 3; j++) params.push([r.leg[k], j]);
    params.push([r.knee, k]);
  }
  let best = cost();
  for (const step of [8, 4, 2, 1, 0.5, 0.25, 0.1]) {
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (const [o, j] of params) for (const d of [step, -step]) {
        o[j] += d; const c = cost();
        if (c < best - 1e-9) { best = c; moved = true; } else o[j] -= d;
      }
      if (!moved) break;
    }
  }
  return { rest: r, cost: best };
}

/**
 * The game's figure rig, bundled from its TypeScript (src/render/figure.ts sculptRig, src/sculpt/rig.ts bonesOf) by esbuild
 * into `dir`: { sculptRig, bonesOf, MALE, REST_EXTRAS, look }, and the rest fitted to ours (fitRest) as `fit`.
 */
export async function gameRig(rig, dir) {
  const { buildSync } = await import('esbuild');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'game-rig.mjs');
  const repo = resolve(new URL('.', import.meta.url).pathname, '../..');
  buildSync({ stdin: { contents: "export { sculptRig } from './src/render/figure';\nexport { bonesOf, MALE, REST_EXTRAS } from './src/sculpt/rig';", resolveDir: repo, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: file, logLevel: 'warning' });
  const g = await import(file);
  const look = { gender: 'man', skin: '#c98a5a', hair: 'bald', hairColour: '#2e2440', eyes: 'dark', beard: 'none', shirt: 'teal', trousers: 'brown' };
  const base = g.sculptRig({ phase: 0, moving: false, facing: 0, swimming: false, working: false, look }).rest;
  const fit = fitRest(rig, g.bonesOf, base, g.MALE);
  return { ...g, look, fit, gRest: g.bonesOf(fit.rest, g.MALE, [], g.REST_EXTRAS) };
}

/* ---- export ------------------------------------------------------------------------------------------------------- */
const r4 = (v) => v.map((x) => +x.toFixed(4));
/** The rig as data: bones (name, parent, head, tail, frame axes, kind, driver, game bone) and the weights by vertex name. */
export function rigData(rig) {
  const ctrl = rig.bones.filter((b) => b.kind === 'control').length;
  return {
    who: rig.who,
    built: 'node tools/sculpt/lowrig.mjs --who ' + rig.who + ' (from tools/sculpt/lowarm.mjs buildArmBody)',
    units: 'the low-poly head\'s: y up (the chin\'s underside 0, the floor ' + rig.J.floor + '), z forward, x the body\'s left',
    frames: 'Y head to tail; X the bend axis (Y × flex); Z = X × Y. Local pose [rx, ry, rz] degrees as Rz·Rx·Ry; +rx carries the tail toward flex. Right side: the left mirrored with X negated (a pose mirrors as [rx, -ry, -rz]).',
    skinning: 'linear blend: v\' = Σ w_i (W_i R_iᵀ (v - head_i) + P_i), W_i the posed world rotation, P_i the posed head; helpers driven from their `driver` (half: the source\'s local turn halved; twist: half the hand\'s twist about its own axis; wrist: half the swing and all the twist; untwist: the source\'s twist undone by f).',
    counts: { bones: rig.bones.length, control: ctrl, helpers: rig.bones.length - ctrl, vertices: rig.B.verts.length, maxInfluences: 4 },
    game: { axes: 'game = T · mesh, T = [[-1,0,0],[0,0,1],[0,1,0]] (x the body\'s right, y forward, z up)', follows: 'each control bone\'s `game` names the figure rig bone (src/sculpt/rig.ts bonesOf) whose turn from rest it takes (fromGame)' },
    bones: rig.bones.map((b) => ({
      name: b.name, parent: b.parent, kind: b.kind, head: r4(b.head), tail: r4(b.tail),
      x: r4(colOf(b.R, 0)), y: r4(colOf(b.R, 1)), z: r4(colOf(b.R, 2)),
      ...(b.driver ? { driver: b.driver } : {}), ...(b.game !== undefined ? { game: b.game } : {}),
    })),
    weights: rig.weights,
  };
}

/** A skinned glTF binary: the body (flat: each triangle its own corners), the skeleton as nodes, the weights. */
export function glb(rig) {
  const { B, bones, vw } = rig;
  const pos = [], nrm = [], jnt = [], wts = [];
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => B.verts[i]);
    const n = unit(cross(sub(b, a), sub(c, a)));
    for (const i of t.v) {
      pos.push(...B.verts[i]); nrm.push(...n);
      const l = vw[i].concat([[0, 0], [0, 0], [0, 0], [0, 0]]).slice(0, 4);
      jnt.push(...l.map(([j]) => j)); wts.push(...l.map(([, w]) => w));
    }
  }
  const nV = pos.length / 3;
  const ibm = [];
  for (const b of bones) {
    // inverse bind: (R, head)⁻¹ as a column-major 4x4
    const Rt = tr(b.R), t = mul(mv(Rt, b.head), -1);
    ibm.push(Rt[0], Rt[3], Rt[6], 0, Rt[1], Rt[4], Rt[7], 0, Rt[2], Rt[5], Rt[8], 0, t[0], t[1], t[2], 1);
  }
  const bufs = [new Float32Array(pos), new Float32Array(nrm), new Uint16Array(jnt), new Float32Array(wts), new Float32Array(ibm)];
  const views = [], acc = [];
  let off = 0;
  const parts = [];
  bufs.forEach((a, k) => {
    const bytes = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length });
    parts.push(bytes, Buffer.alloc(pad)); off += bytes.length + pad;
    const type = k === 4 ? 'MAT4' : k === 2 || k === 3 ? 'VEC4' : 'VEC3';
    const count = k === 4 ? bones.length : nV;
    const a2 = { bufferView: k, componentType: k === 2 ? 5123 : 5126, count, type };
    if (k === 0) { a2.min = [0, 1, 2].map((j) => Math.min(...B.verts.map((p) => p[j]))); a2.max = [0, 1, 2].map((j) => Math.max(...B.verts.map((p) => p[j]))); }
    acc.push(a2);
  });
  const bin = Buffer.concat(parts);
  const nodes = bones.map((b) => {
    const P = b.p >= 0 ? bones[b.p] : null;
    const Rl = P ? mm(tr(P.R), b.R) : b.R, t = P ? mv(tr(P.R), sub(b.head, P.head)) : b.head;
    const q = quat(Rl);
    return { name: b.name, translation: t, rotation: [q[1], q[2], q[3], q[0]], children: [] };
  });
  bones.forEach((b, i) => { if (b.p >= 0) nodes[b.p].children.push(i); });
  for (const n of nodes) if (!n.children.length) delete n.children;
  nodes.push({ name: `body-${rig.who}`, mesh: 0, skin: 0 });
  const json = {
    asset: { version: '2.0', generator: 'tools/sculpt/lowrig.mjs' },
    scene: 0, scenes: [{ nodes: [0, nodes.length - 1] }], nodes,
    meshes: [{ name: `body-${rig.who}`, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 } }] }],
    skins: [{ joints: bones.map((_, i) => i), inverseBindMatrices: 4, skeleton: 0 }],
    accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const who = opt('who', 'male');
  if (who !== 'male') throw new Error('the rig is built for the male body only');
  const rig = buildRig(who);
  const data = rigData(rig);
  const file = new URL(`./rig-${who}.json`, import.meta.url);
  // checks: the rest pose is the mesh, each weight list sums to one, no more than four
  const rest = skin(rig, posed(rig, {}));
  const f32 = (x) => Math.fround(x);
  const moved = rest.filter((p, i) => p.some((x, k) => f32(x) !== f32(rig.B.verts[i][k]))).length;
  const bad = Object.entries(rig.weights).filter(([, l]) => l.length > 4 || Math.abs(l.reduce((s, [, w]) => s + w, 0) - 1) > 1e-9);
  console.log(`${who}: ${data.counts.bones} bones (${data.counts.control} posed, ${data.counts.helpers} helpers), ${data.counts.vertices} vertices; rest pose moved ${moved}; weight lists not summing to one or over four: ${bad.length}`);
  // the figure rig's rest that lies as ours does at bind (fitRest), for fromGame in the game
  try {
    const G = await gameRig(rig, opt('tmp', 'tmp/lowrig'));
    const r = G.fit.rest;
    const q = (v) => (Array.isArray(v) ? v.map(q) : +v.toFixed(2));
    data.game.rest = { arm: q(r.arm), elbow: q(r.elbow), hand: q(r.hand), leg: q(r.leg), knee: q(r.knee), residualDeg: +(G.fit.cost * 180 / Math.PI).toFixed(1) };
    data.game.restNote = 'the figure rig (rest() with these limb angles) whose bones lie as ours at bind: fromGame takes each game bone\'s turn from bonesOf(this rest)';
  } catch (e) { console.log('game rig not bundled:', e.message); }
  const W = JSON.stringify(data.weights);
  writeFileSync(file, JSON.stringify({ ...data, weights: '@' }, null, 1).replace('"@"', W.replace(/\],"/g, '],\n  "')) + '\n');
  const g = opt('glb', new URL(`./rig-${who}.glb`, import.meta.url).pathname);
  writeFileSync(g, glb(rig)); console.log('wrote', file.pathname, g);
}
