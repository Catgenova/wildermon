// The rig of tools/sculpt/lowrig.mjs, looked over: the skeleton on the mesh, the test poses (front and three-quarter, and
// close on each joint), the game's own walk and run on it, the weights as heat maps, and per pose the volume kept at
// each joint and the faces that pass through each other.
//
//   node tools/sculpt/lowrigshot.mjs --out <dir> [--only skeleton,poses,close,walk,weights,rest,rings]
//     writes rig-skeleton.png, rig-poses.png, rig-close.png, rig-walk.png, rig-weights.png, rig-rest-*.png (rings: the rest
//     without and with the extra loops, rings-before/after/edges.png) and
//     rig-metrics.json into <dir>
//
// Flat shading (one normal per polygon, the heads' shared camera-fixed light, tools/sculpt/lowlight-male.json) as
// tools/sculpt/lowarmshot.mjs draws the body; Playwright's Chromium with software GL.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildArmBody } from './lowarm.mjs';
import { TUNE, buildRig, posed, skin, ground, sym, axisAngle, mm, mv, tr, sub, add, cross, dot, unit, fromGame, gameRig } from './lowrig.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowrig'));
if (import.meta.url === `file://${process.argv[1]}`) mkdirSync(out, { recursive: true });
const MAIN = import.meta.url === `file://${process.argv[1]}`;
const only = MAIN ? opt('only', 'skeleton,poses,close,walk,weights,rest').split(',') : [];
const DIR = new URL('.', import.meta.url).pathname;

if (args.includes('--mend')) TUNE.MEND = true;
const rig = buildRig('male');
const { B, bones, at } = rig;
const LIGHT = JSON.parse(readFileSync(join(DIR, 'lowlight-male.json'), 'utf8'));
const SH = (() => { const C = LIGHT.global, o = new Array(57).fill(0); for (let k = 0; k < C[0].length; k++) for (let ch = 0; ch < 3; ch++) o[k * 3 + ch] = C[ch][k] / 255; return o; })();

/* ---- poses ------------------------------------------------------------------------------------------------------- */
/** A turn about a rest-space axis through the bone's head, as the bone's local pose. */
const W = (bone, axis, deg) => { const R = bones[at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
const L = (bone, axis, deg, e) => mm(e ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], W(bone, axis, deg));
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Both sides turned about a rest-space axis (the right about its mirror), after whatever turn they had. */
const symW = (p, bone, axis, deg) => { p[`${bone}_l`] = mm(W(`${bone}_l`, axis, deg), p[`${bone}_l`] ?? I); p[`${bone}_r`] = mm(W(`${bone}_r`, [-axis[0], axis[1], axis[2]], -deg), p[`${bone}_r`] ?? I); return p; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
export const POSES = [
  { id: 'rest', label: 'Rest (bind, as modelled)', pose: {} },
  { id: 'tpose', label: 'T-pose', pose: symW(symW({}, 'upperarm', Z, 74), 'lowerarm', Z, 10) },
  { id: 'overhead', label: 'Arms raised overhead', pose: (() => { const p = symW(symW({}, 'clavicle', Z, 22), 'upperarm', Z, 140); return symW(p, 'lowerarm', Z, 8); })() },
  { id: 'forward', label: 'Arms forward', pose: symW(symW(symW({}, 'clavicle', Y, -14), 'upperarm', X, -84), 'upperarm', Y, -2) },
  { id: 'elbow', label: 'Elbows bent 120°', pose: (() => { const p = symW({}, 'upperarm', X, -20); sym(p, 'lowerarm', [105, 0, 0]); return p; })() },
  { id: 'wrist', label: 'Wrists bent and twisted', pose: (() => { const p = symW({}, 'upperarm', X, -35); sym(p, 'lowerarm', [70, 0, 0]); p.hand_l = [55, 80, 0]; p.hand_r = [-50, 70, 0]; return p; })() },
  { id: 'squat', label: 'Squat', pose: (() => { const p = { spine_01: [12, 0, 0], spine_02: [10, 0, 0], spine_03: [6, 0, 0] }; symW(p, 'thigh', X, -100); symW(p, 'thigh', Y, 12); sym(p, 'calf', [-115, 0, 0]); sym(p, 'foot', [-14, 0, 0]); symW(p, 'upperarm', X, -70); sym(p, 'lowerarm', [20, 0, 0]); return p; })(), ground: true },
  { id: 'legfwd', label: 'Leg forward 90°', pose: { thigh_l: W('thigh_l', X, -90), calf_l: [-8, 0, 0], foot_l: [0, 0, 0] }, ground: true },
  { id: 'legside', label: 'Leg to the side 45°', pose: symW({ thigh_l: W('thigh_l', Z, 45) }, 'upperarm', Z, 25), ground: true },
  { id: 'bendfwd', label: 'Spine bent forward', pose: { spine_01: [22, 0, 0], spine_02: [20, 0, 0], spine_03: [16, 0, 0], neck_01: [8, 0, 0] }, ground: true },
  { id: 'bendside', label: 'Spine bent sideways', pose: symW({ spine_01: [0, 0, 12], spine_02: [0, 0, 12], spine_03: [0, 0, 10], neck_01: [0, 0, 6] }, 'upperarm', Z, 25), ground: true },
  { id: 'twist', label: 'Spine twisted', pose: { spine_01: [0, 14, 0], spine_02: [0, 16, 0], spine_03: [0, 14, 0], neck_01: [0, 8, 0] }, ground: true },
  { id: 'headturn', label: 'Head turned 70°', pose: { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] } },
  { id: 'nod', label: 'Head nod (down 40°)', pose: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } },
  { id: 'fist', label: 'Fist (left) and grip (right)', pose: (() => { const p = symW({}, 'upperarm', X, -40); sym(p, 'lowerarm', [60, 0, 0]); sym(p, 'fingers_01', [80, 0, 0]); sym(p, 'fingers_02', [50, 0, 0]); p.thumb_01_l = [20, 0, -35]; p.thumb_02_l = [25, 0, 0]; p.thumb_03_l = [35, 0, 0]; p.fingers_01_r = [45, 0, 0]; p.fingers_02_r = [35, 0, 0]; p.thumb_01_r = [10, 0, 15]; p.thumb_02_r = [15, 0, 0]; p.thumb_03_r = [20, 0, 0]; return p; })() },
];

/* ---- the game's rig: walk and run -------------------------------------------------------------------------------- */
let GAME = null;
export async function game() {
  if (GAME) return GAME;
  const g = await gameRig(rig, out);
  const at2 = (what, u) => {
    const p = { phase: u * Math.PI * 2, moving: true, facing: 0, swimming: false, working: false, look: g.look };
    if (what === 'run') p.gait = 1;
    return fromGame(rig, g.bonesOf(g.sculptRig(p).rig, g.MALE, [], g.REST_EXTRAS), g.gRest);
  };
  GAME = { at: at2, fit: g.fit };
  return GAME;
}

/* ---- metrics ----------------------------------------------------------------------------------------------------- */
/** The joint regions' volumes and the faces passing through each other, for a rig: metrics(P) against its rest. */
export function makeMetrics(rig) {
const { B, bones } = rig;
const wOf = (i) => rig.vw[i];
const has = (i, names) => wOf(i).some(([bi, w]) => w > 0.02 && names.includes(bones[bi].name));
const ringIs = (i, rings, side) => { const n = B.names[i].replace(/^arm\//, ''); const s = n.endsWith('.L') ? 'l' : n.endsWith('.R') ? 'r' : ''; const base = n.replace(/\.[LR]$/, '').replace(/\d+[ab]?$/, ''); return rings.includes(base) && (s === side || s === ''); };
// joint regions: the vertices round each joint, the centre the bone whose posed head is the pivot
const REGIONS = [];
for (const s of ['l', 'r']) {
  REGIONS.push({ id: `shoulder_${s}`, piv: `shoulder_${s}`, v: (i) => has(i, [`shoulder_${s}`, `upperarm_twist_${s}`]) || (B.part[i] === 'joint' && ringIs(i, ['ja', 'jb', 'ax'], s)) });
  REGIONS.push({ id: `elbow_${s}`, piv: `elbow_${s}`, v: (i) => B.part[i] !== 'torso' && ringIs(i, ['uc', 'ue', 'el', 'fa', 'fb'], s) && B.names[i].startsWith('arm/') });
  REGIONS.push({ id: `wrist_${s}`, piv: `wrist_${s}`, v: (i) => B.names[i].startsWith('arm/') && (ringIs(i, ['fe', 'fg', 'wk', 'wb', 'wt', 'wp', 'sk', 'pa', 'pb', 'pc', 'kb', 'kp', 'ta', 'tb', 'tc', 'td'], s)) });
  REGIONS.push({ id: `fingers_${s}`, piv: `fingers_01_${s}`, v: (i) => B.names[i].startsWith('arm/') && ringIs(i, ['kb', 'kp', 'qp', 'mb', 'mp', 'nb', 'np'], s) });
  REGIONS.push({ id: `hip_${s}`, piv: `hip_${s}`, v: (i) => !B.names[i].startsWith('arm/') && (ringIs(i, ['gl', 'gf', 'th', 'tm', 'cx', 'bt', 'hw'], s)) });
  REGIONS.push({ id: `knee_${s}`, piv: `knee_${s}`, v: (i) => !B.names[i].startsWith('arm/') && ringIs(i, ['tm', 'ka', 'kb', 'kc', 'ca'], s) });
  REGIONS.push({ id: `ankle_${s}`, piv: `foot_${s}`, v: (i) => !B.names[i].startsWith('arm/') && ringIs(i, ['cb', 'an', 'fc', 'ft', 'so'], s) });
}
REGIONS.push({ id: 'neck', piv: 'neck_02', v: (i) => has(i, ['neck_01', 'neck_02']) });
REGIONS.push({ id: 'waist', piv: 'spine_01', v: (i) => !B.names[i].startsWith('arm/') && ['ra', 'rb', 'rc', 'wa', 'hi', 'hw'].some((r) => B.names[i].replace(/\.[LR]$/, '').replace(/\d+$/, '') === r) });
for (const R of REGIONS) {
  R.set = new Set(B.verts.map((_, i) => i).filter(R.v));
  R.tris = B.tris.map((t, k) => k).filter((k) => B.tris[k].v.every((i) => R.set.has(i)));
}
/** The region's volume: its triangles closed by a fan to the centroid of each boundary loop. */
function volume(R, P) {
  const edges = new Map();
  for (const k of R.tris) { const v = B.tris[k].v; for (let j = 0; j < 3; j++) { const a = v[j], b = v[(j + 1) % 3]; const key = a < b ? `${a},${b}` : `${b},${a}`; const e = edges.get(key); if (e) e.n++; else edges.set(key, { a, b, n: 1 }); } }
  const bd = [...edges.values()].filter((e) => e.n === 1);
  const par = new Map(); const find = (x) => { while (par.get(x) !== x) x = par.get(x); return x; };
  for (const e of bd) { for (const x of [e.a, e.b]) if (!par.has(x)) par.set(x, x); par.set(find(e.a), find(e.b)); }
  const loops = new Map();
  for (const e of bd) { const r = find(e.a); (loops.get(r) ?? loops.set(r, []).get(r)).push(e); }
  const cent = new Map();
  for (const [r, es] of loops) { const vs = [...new Set(es.flatMap((e) => [e.a, e.b]))]; cent.set(r, vs.reduce((a, i) => add(a, P[i]), [0, 0, 0]).map((x) => x / vs.length)); }
  let vol = 0;
  const tet = (a, b, c) => dot(a, cross(b, c)) / 6;
  for (const k of R.tris) { const [a, b, c] = B.tris[k].v.map((i) => P[i]); vol += tet(a, b, c); }
  // the caps: each boundary edge as its triangle runs it, closed to its loop's centre the other way round
  for (const k of R.tris) { const v = B.tris[k].v; for (let j = 0; j < 3; j++) { const a = v[j], b = v[(j + 1) % 3]; const key = a < b ? `${a},${b}` : `${b},${a}`; if (edges.get(key).n !== 1) continue; vol += tet(P[b], P[a], cent.get(find(a))); } }
  return Math.abs(vol);
}
/** Pairs of triangles (sharing no vertex) that cross each other. */
function crossings(P) {
  const cell = 0.25, grid = new Map(), boxes = [];
  B.tris.forEach((t, k) => {
    const p = t.v.map((i) => P[i]);
    const lo = [0, 1, 2].map((j) => Math.min(p[0][j], p[1][j], p[2][j])), hi = [0, 1, 2].map((j) => Math.max(p[0][j], p[1][j], p[2][j]));
    boxes.push([lo, hi]);
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      const key = `${x},${y},${z}`; (grid.get(key) ?? grid.set(key, []).get(key)).push(k);
    }
  });
  const found = new Set();
  for (const list of grid.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const i = list[a], j = list[b], key = i < j ? i * 4096 + j : j * 4096 + i;
    if (found.has(key)) continue;
    const ti = B.tris[i].v, tj = B.tris[j].v;
    if (ti.some((x) => tj.includes(x))) continue;
    const [li, hi] = boxes[i], [lj, hj] = boxes[j];
    if (li[0] > hj[0] || lj[0] > hi[0] || li[1] > hj[1] || lj[1] > hi[1] || li[2] > hj[2] || lj[2] > hi[2]) continue;
    if (triTri(ti.map((x) => P[x]), tj.map((x) => P[x]))) found.add(key);
  }
  return found;
}
function triTri(A, Bt) {
  // each triangle's edges against the other's face
  const segTri = (p, q, T) => {
    const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), d = sub(q, p), h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-12) return false;
    const f = 1 / a, s = sub(p, T[0]), u = f * dot(s, h); if (u < 0 || u > 1) return false;
    const qv = cross(s, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) return false;
    const t = f * dot(e2, qv); return t > 1e-6 && t < 1 - 1e-6;
  };
  for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true;
  return false;
}
const REST = B.verts;
const restX = crossings(REST);
const restVol = Object.fromEntries(REGIONS.map((R) => [R.id, volume(R, REST)]));
const domBone = (k) => { const c = {}; for (const i of B.tris[k].v) for (const [bi, w] of rig.vw[i]) c[bi] = (c[bi] ?? 0) + w; return bones[+Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]].name; };
function metrics(P, frames) {
  const vol = {};
  for (const R of REGIONS) { const v = volume(R, P); vol[R.id] = +(100 * (v / restVol[R.id] - 1)).toFixed(1); }
  const x = [...crossings(P)].filter((k) => !restX.has(k));
  const pairs = {};
  for (const k of x) { const i = Math.floor(k / 4096), j = k % 4096; const a = domBone(i), b = domBone(j); const key = a < b ? `${a}×${b}` : `${b}×${a}`; pairs[key] = (pairs[key] ?? 0) + 1; }
  // faces turned over: a triangle (of more than a sliver's area) whose normal has turned more than 100° from its own
  // bone's turn of it
  let flips = 0;
  const nrm = (V, t) => cross(sub(V[t.v[1]], V[t.v[0]]), sub(V[t.v[2]], V[t.v[0]]));
  if (frames) B.tris.forEach((t) => {
    const n0 = nrm(REST, t); if (Math.hypot(...n0) < 0.01) return;
    const bi = rig.vw[t.v[0]][0][0], want = mv(frames[bi].S, n0), n1 = nrm(P, t);
    if (dot(unit(want), unit(n1)) < -0.17) flips++;
  });
  return { volume: vol, crossings: x.length, pairs, flips };
}
return metrics;
}
const metrics = makeMetrics(rig);

/* ---- drawing ----------------------------------------------------------------------------------------------------- */
const TOPO = { polys: B.polys.map((p) => p.nv ?? p.v), tris: B.tris.map((t) => [...t.v, t.poly]), mat: B.polys.map((p) => (p.mat === 'brow' ? 1 : p.mat === 'pupil' ? 2 : p.mat === 'lid' ? 1 : 0)) };
const flat = (P) => P.flat().map((x) => +x.toFixed(5));
/** A cell: verts, camera { yaw, pitch, s, c (the point at the cell's centre) }, box [x, y, w, h], label, and optional
 * bones (lines), heat (per-vertex weight 0..1). */
export function cell(P, cam, box, label, o = {}) { return { P: flat(P), cam, box, label, ...o }; }
function boneLines(frames, posedRig = true) {
  const segs = [];
  bones.forEach((b, i) => {
    if (b.kind !== 'control' || b.name === 'root') return;
    const f = frames[i], tail = add(mv(f.S, sub(b.tail, b.head)), f.P);
    segs.push([...f.P, ...tail, b.name.includes('_r') ? 1 : b.name.includes('_l') ? 2 : 0]);
  });
  return segs.map((s) => s.map((x) => +x.toFixed(4)));
}

const PAGE = (w, h) => String.raw`<!doctype html><html><head><style>
html,body{margin:0;background:#2f292b}
#sheet{position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,Arial,sans-serif;color:#efe2d6;background:#3a3134}
canvas{position:absolute;left:0;top:0;width:${w}px;height:${h}px}
.lab{position:absolute;font-size:13px;color:#f1e6dc;white-space:nowrap}
.sm{position:absolute;font-size:11px;color:#d9c9bc;white-space:pre;line-height:13px}
.h{position:absolute;font-weight:600;font-size:20px;color:#f4dccb}
</style></head><body><div id=sheet><canvas id=gl></canvas><div id=ui></div></div></body></html>`;

const RENDER = String.raw`
const D = window.DATA, W = window.SW, Hh = window.SHH, dpr = window.devicePixelRatio;
const cv = document.getElementById('gl'); cv.width = W * dpr; cv.height = Hh * dpr;
const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
const vs = 'attribute vec3 p; attribute vec3 n; attribute vec3 m; uniform mat3 R; uniform vec3 piv; uniform float s; uniform float lift; uniform vec2 asp; varying vec3 vn; varying vec3 vm;' +
  'void main(){ vec3 q = R*(p - piv); vn = R*n; vm = m; gl_Position = vec4(q.x*s*asp.x, q.y*s*asp.y, -q.z/30.0 - lift, 1.0); gl_PointSize = 5.0; }';
const fs = 'precision highp float; varying vec3 vn; varying vec3 vm; uniform int mode; uniform vec3 SHC[19]; uniform vec3 linec;' +
  'void main(){ if (mode == 2) { gl_FragColor = vec4(linec, 1.0); return; }' +
  ' vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn; float x = nn.x, y = nn.y, z = nn.z;' +
  ' vec3 base = vm.x < 0.5 ? vec3(0.68,0.49,0.41) : (vm.x < 1.5 ? vec3(0.22,0.15,0.13) : vec3(0.08,0.06,0.06));' +
  ' vec3 c = SHC[0] + SHC[1]*x + SHC[2]*y + SHC[3]*z + SHC[4]*x*y + SHC[5]*y*z + SHC[6]*(3.0*z*z-1.0) + SHC[7]*x*z + SHC[8]*(x*x-y*y)' +
  '   + SHC[9]*y*(3.0*x*x-y*y) + SHC[10]*x*y*z + SHC[11]*y*(5.0*z*z-1.0) + SHC[12]*z*(5.0*z*z-3.0) + SHC[13]*x*(5.0*z*z-1.0) + SHC[14]*z*(x*x-y*y) + SHC[15]*x*(x*x-3.0*y*y)' +
  '   + SHC[16]*pow(max(dot(nn, normalize(vec3(-0.95,0.25,-0.2))),0.0),8.0) + SHC[17]*max(-x,0.0)*pow(1.0-max(z,0.0),3.0) + SHC[18]*max(x,0.0)*pow(1.0-max(z,0.0),3.0);' +
  ' c *= base/vec3(0.68,0.49,0.41);' +
  ' if (mode == 1) { float h = vm.y; vec3 hc = h < 0.5 ? mix(vec3(0.12,0.16,0.42), vec3(0.1,0.75,0.55), h*2.0) : mix(vec3(0.1,0.75,0.55), vec3(0.98,0.85,0.15), h*2.0-1.0); if (h > 0.999) hc = vec3(0.95,0.3,0.15); float l = 0.55 + 0.45*max(dot(nn, normalize(vec3(-0.3,0.5,0.8))),0.0); c = hc*l; }' +
  ' gl_FragColor = vec4(c, 1.0); }';
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
const U = (n) => gl.getUniformLocation(pr, n);
const AL = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), m: gl.getAttribLocation(pr, 'm') };
gl.uniform3fv(U('SHC'), D.SH);
gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
gl.scissor(0, 0, W * dpr, Hh * dpr); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
const buf = gl.createBuffer();
function rotm(yaw, pitch) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // world to view: turn about y by yaw (the body turns its left toward the viewer), then tip by pitch (looking down)
  const Ry = [ca, 0, -sa, 0, 1, 0, sa, 0, ca], Rx = [1, 0, 0, 0, cb, sb, 0, -sb, cb];
  const m = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.push(Rx[i * 3] * Ry[j] + Rx[i * 3 + 1] * Ry[3 + j] + Rx[i * 3 + 2] * Ry[6 + j]);
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
function draw(c) {
  const [bx, by, bw, bh] = c.box;
  gl.viewport(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr); gl.scissor(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr);
  gl.clearColor(c.bg ? c.bg[0] : 0.27, c.bg ? c.bg[1] : 0.235, c.bg ? c.bg[2] : 0.245, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const P = c.P, V = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const pn = D.T.polys.map((v) => { let n = [0, 0, 0]; for (let i = 0; i < v.length; i++) { const a = V(v[i]), b = V(v[(i + 1) % v.length]); n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; } const l = Math.hypot(...n) || 1; return n.map((x) => x / l); });
  const arr = [];
  for (const [a, b, d, pi] of D.T.tris) for (const i of [a, b, d]) { const n = pn[pi]; arr.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], n[0], n[1], n[2], D.T.mat[pi], c.heat ? c.heat[i] : 0, 0); }
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
  gl.uniformMatrix3fv(U('R'), false, rotm(c.cam.yaw, c.cam.pitch ?? 0)); gl.uniform3fv(U('piv'), c.cam.c); gl.uniform1f(U('s'), c.cam.s);
  gl.uniform2f(U('asp'), 2 / bw, 2 / bh); gl.uniform1f(U('lift'), 0);
  gl.uniform1i(U('mode'), c.heat ? 1 : 0);
  for (const k of [AL.p, AL.n, AL.m]) gl.enableVertexAttribArray(k);
  gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(AL.n, 3, gl.FLOAT, false, 36, 12); gl.vertexAttribPointer(AL.m, 3, gl.FLOAT, false, 36, 24);
  gl.drawArrays(gl.TRIANGLES, 0, arr.length / 9);
  if (c.bones) {
    gl.disable(gl.DEPTH_TEST); gl.uniform1i(U('mode'), 2); gl.disableVertexAttribArray(AL.n); gl.disableVertexAttribArray(AL.m);
    for (const col of [0, 1, 2]) {
      const segs = c.bones.filter((s) => s[6] === col), L = [];
      for (const s of segs) L.push(s[0], s[1], s[2], s[3], s[4], s[5]);
      if (!L.length) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 12, 0);
      gl.uniform3fv(U('linec'), col === 0 ? [1, 0.95, 0.4] : col === 1 ? [0.35, 0.8, 1] : [1, 0.45, 0.6]);
      gl.lineWidth(1); gl.drawArrays(gl.LINES, 0, L.length / 3); gl.drawArrays(gl.POINTS, 0, L.length / 3);
    }
    gl.enable(gl.DEPTH_TEST);
  }
  if (c.edges) {
    // edges drawn where they are seen (depth-tested, lifted a little toward the eye)
    gl.uniform1i(U('mode'), 2); gl.disableVertexAttribArray(AL.n); gl.disableVertexAttribArray(AL.m); gl.uniform1f(U('lift'), 0.004);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c.edges), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 12, 0);
    gl.uniform3fv(U('linec'), c.edgec ?? [0.2, 1, 0.9]);
    gl.drawArrays(gl.LINES, 0, c.edges.length / 3); gl.uniform1f(U('lift'), 0);
  }
}
for (const c of window.CELLS) draw(c);
const ui = document.getElementById('ui');
const el = (cls, css, html) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = css; e.innerHTML = html; ui.appendChild(e); };
for (const c of window.CELLS) { if (c.label) el('lab', 'left:' + (c.box[0] + 6) + 'px;top:' + (c.box[1] + 4) + 'px', c.label); if (c.note) el('sm', 'left:' + (c.box[0] + 6) + 'px;top:' + (c.box[1] + c.box[3] - 6 - 13 * c.note.split('\n').length) + 'px', c.note); }
for (const t of window.TEXTS ?? []) el(t.cls ?? 'h', t.css, t.html);
window.READY = true;
`;

const kept = '/opt/pw-browsers/chromium';
let browser = null;
export async function shoot(w, h, cells, file, texts = [], topo = TOPO) {
  browser ??= await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(PAGE(w, h));
  await p.evaluate(([d, C, ww, hh, tx]) => { window.DATA = d; window.CELLS = C; window.SW = ww; window.SHH = hh; window.TEXTS = tx; }, [{ SH, T: topo }, cells, w, h, texts]);
  await p.addScriptTag({ content: RENDER });
  await p.waitForFunction('window.READY', null, { timeout: 120000 });
  await p.locator('#sheet').screenshot({ path: file });
  console.log('wrote', file);
  await p.close();
}

/* ---- sheets ------------------------------------------------------------------------------------------------------ */
const frameOf = (pose) => posed(rig, pose);
function posedVerts(entry) { const f = frameOf(entry.pose), P0 = skin(rig, f), P = entry.ground ? ground(rig, P0) : P0; return { f, P, dy: P[0][1] - P0[0][1] }; }
const MID = [0, -4.9, 0];
const metricsAll = {};

if (only.includes('rest')) {
  // the rest pose skinned against the body unrigged: the same numbers, so the same pixels
  const f = frameOf({});
  const P = skin(rig, f);
  const moved = P.filter((p, i) => p.some((x, k) => Math.fround(x) !== Math.fround(B.verts[i][k]))).length;
  console.log('rest: vertices moved by skinning (float32)', moved);
  // the body unrigged as the approved mesh draws it (buildArmBody, its own triangles) against the rig's rest
  const own = buildArmBody('male');
  const OWN = { polys: own.polys.map((p) => p.v), tris: own.tris.map((t) => [...t.v, t.poly]), mat: TOPO.mat };
  for (const [name, verts, topo] of [['unrigged', own.verts, OWN], ['skinned', P, TOPO]]) {
    await shoot(700, 760, [cell(verts, { yaw: 0, s: 50, c: MID }, [0, 0, 350, 760], ''), cell(verts, { yaw: 40, s: 50, c: MID }, [350, 0, 350, 760], '')], join(out, `rig-rest-${name}.png`), [], topo);
  }
  metricsAll.restMoved = moved;
}

if (only.includes('rings')) {
  // the body without the extra loops (lowloops.mjs) and with them, at rest: the same surface, so the same pixels but for
  // the new edges inside flat faces; and the same with the new edges drawn
  const a = buildArmBody('male', null, { loops: false }), b = buildArmBody('male');
  const topo = (m) => ({ polys: m.polys.map((p) => p.nv ?? p.v), tris: m.tris.map((t) => [...t.v, t.poly]), mat: m.polys.map((p) => (p.mat === 'brow' ? 1 : p.mat === 'pupil' ? 2 : p.mat === 'lid' ? 1 : 0)) });
  const isNew = new Set(b.added.map(([i]) => i)), E = [];
  for (const p of b.polys) p.v.forEach((u, k) => { const w = p.v[(k + 1) % p.v.length]; if (u < w || !p.v.includes(w)) if (isNew.has(u) || isNew.has(w)) E.push(...b.verts[u], ...b.verts[w]); });
  const views = [[0, 0, 'front', 50, MID], [40, 0, 'three-quarter', 50, MID], [180, 0, 'back', 50, MID], [60, 0, 'neck', 200, [0.5, -0.4, 0]], [30, -10, 'armpit, front', 160, [1.4, -1.5, 0]], [0, -60, 'groin, below', 120, [0, -5.5, 0]], [180, 0, 'gluteal fold', 120, [0.5, -5.3, 0]], [180, 0, 'palm (left)', 330, [2.35, -5.6, 0]]];
  for (const [tag, m, edges] of [['before', a, null], ['after', b, null], ['edges', b, E]]) {
    const cells = views.map(([yaw, pitch, lab, s, c], k) => cell(m.verts, { yaw, pitch, s, c }, [(k % 4) * 350, Math.floor(k / 4) * 420, 350, 420], '', edges ? { edges: E.map((x) => +x.toFixed(5)) } : {}));
    await shoot(1400, 840, cells, join(out, `rings-${tag}.png`), [], topo(m));
  }
}

if (only.includes('skeleton')) {
  const f = frameOf({});
  const cells = [], s = 52;
  [[0, 'Front'], [90, 'Side (left)'], [40, 'Three-quarter']].forEach(([yaw, lab], k) => cells.push(cell(B.verts, { yaw, s, c: MID }, [k * 420, 40, 420, 800], lab, { bones: boneLines(f) })));
  // close: the hand and the head
  cells.push(cell(B.verts, { yaw: 0, s: 150, c: [2.25, -5.3, 0] }, [1260, 40, 420, 400], 'Left hand, front', { bones: boneLines(f) }));
  cells.push(cell(B.verts, { yaw: 90, s: 150, c: [2.25, -5.3, 0] }, [1260, 440, 420, 400], 'Left hand, side', { bones: boneLines(f) }));
  const n = rig.bones.length, c = rig.bones.filter((b) => b.kind === 'control').length;
  await shoot(1680, 840, cells, join(out, 'rig-skeleton.png'), [{ css: 'left:12px;top:8px', html: `Male rig: ${n} bones (${c} posed, ${n - c} driven helpers; yellow centre, blue right, pink left; helpers sit on the joints)` }]);
}

if (only.includes('poses')) {
  const cells = [], cw = 250, ch = 330, s = 22, perRow = 4;
  POSES.forEach((e, k) => {
    const { f, P } = posedVerts(e);
    const m = metrics(P, f); metricsAll[e.id] = m;
    const x0 = (k % perRow) * cw * 2, y0 = 34 + Math.floor(k / perRow) * ch;
    const worst = Object.entries(m.volume).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([r, v]) => `${r} ${v > 0 ? '+' : ''}${v}%`).join(', ');
    cells.push(cell(P, { yaw: 0, s, c: MID }, [x0, y0, cw, ch], e.label));
    cells.push(cell(P, { yaw: 38, pitch: 8, s, c: MID }, [x0 + cw, y0, cw, ch], '', { note: `vol ${worst}\nnew crossings ${m.crossings}, folds ${m.flips}` }));
  });
  // the game's walk (contact) and run keys
  const g = await game();
  for (const [what, u, lab] of [['walk', 0, 'Game walk, contact'], ['run', 0.15, 'Game run key']]) {
    const k = cells.length / 2;
    const pose = g.at(what, u), f = frameOf(pose), P = ground(rig, skin(rig, f));
    const m = metrics(P, f); metricsAll[`game-${what}`] = m;
    const x0 = (k % perRow) * cw * 2, y0 = 34 + Math.floor(k / perRow) * ch;
    const worst = Object.entries(m.volume).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([r, v]) => `${r} ${v > 0 ? '+' : ''}${v}%`).join(', ');
    cells.push(cell(P, { yaw: 0, s, c: MID }, [x0, y0, cw, ch], lab));
    cells.push(cell(P, { yaw: 60, pitch: 8, s, c: MID }, [x0 + cw, y0, cw, ch], '', { note: `vol ${worst}\nnew crossings ${m.crossings}, folds ${m.flips}` }));
  }
  const rows = Math.ceil(cells.length / 2 / perRow);
  await shoot(cw * 2 * perRow, 34 + rows * ch, cells, join(out, 'rig-poses.png'), [{ css: 'left:12px;top:6px', html: 'Test poses, front and three-quarter (volume: the two joint regions that changed most; crossings: face pairs passing through each other that do not at rest)' }]);
}

if (only.includes('close')) {
  // close on each joint in the pose that tests it hardest
  const by = Object.fromEntries(POSES.map((e) => [e.id, e]));
  // the fist and the grip held out to the sides, for a clear view of the hands
  by.fistT = { pose: (() => { const p = { ...by.fist.pose }; symW(p, 'upperarm', Z, 70); delete p.lowerarm_l; delete p.lowerarm_r; p.upperarm_l = W('upperarm_l', Z, 70); p.upperarm_r = W('upperarm_r', Z, -70); return p; })() };
  const g = await game();
  // [pose, label, yaw, pitch, the bone whose posed head is the centre, scale]
  const C = [
    ['overhead', 'Shoulders overhead, front', 0, 0, 'shoulder_l', 80],
    ['overhead', 'Shoulder overhead, back 3/4', 140, 0, 'shoulder_l', 80],
    ['tpose', 'T-pose, front', 0, 0, 'shoulder_l', 80],
    ['tpose', 'T-pose, back 3/4', 140, 10, 'shoulder_l', 80],
    ['forward', 'Arms forward, 3/4', 50, 10, 'shoulder_l', 75],
    ['forward', 'Arms forward, top', 0, 70, 'shoulder_l', 75],
    ['elbow', 'Elbow 120°, outside', 90, 0, 'elbow_l', 110],
    ['elbow', 'Elbow 120°, inside', -60, 0, 'elbow_l', 110],
    ['wrist', 'Wrist bent + twisted (L)', 30, 0, 'wrist_l', 130],
    ['wrist', 'Wrist bent + twisted (R)', -30, 0, 'wrist_r', 130],
    ['fistT', 'Fist (L), palm side', 180, 0, 'knuckles_l', 300],
    ['fistT', 'Grip (R), palm side', 180, 0, 'knuckles_r', 300],
    ['squat', 'Squat, side', 90, 0, 'hip_l', 48],
    ['squat', 'Squat, front 3/4', 30, 0, 'hip_l', 48],
    ['legfwd', 'Leg forward, side', 90, 0, 'hip_l', 75],
    ['legfwd', 'Leg forward, front 3/4', 30, 0, 'hip_l', 75],
    ['legside', 'Leg side 45°, front', 0, 0, 'hip_l', 75],
    ['legside', 'Leg side 45°, back', 180, 0, 'hip_l', 75],
    ['bendfwd', 'Bend forward, side', 90, 0, 'spine_02', 55],
    ['bendside', 'Bend sideways, front', 0, 0, 'spine_02', 60],
    ['twist', 'Twist, back', 180, 0, 'spine_02', 60],
    ['headturn', 'Head turn, front', 0, 0, 'neck_02', 110],
    ['headturn', 'Head turn, 3/4', 40, 0, 'neck_02', 110],
    ['nod', 'Nod, side', 90, 0, 'neck_02', 110],
  ];
  const cells = [], cw = 300, chh = 300, perRow = 6;
  C.forEach(([id, lab, yaw, pitch, bone, s], k) => {
    const e = by[id];
    const { f, P, dy } = posedVerts(e);
    const c = add(f[at.get(bone)].P, [0, dy, 0]);
    cells.push(cell(P, { yaw, pitch, s, c }, [(k % perRow) * cw, 34 + Math.floor(k / perRow) * chh, cw, chh], lab));
  });
  await shoot(cw * perRow, 34 + Math.ceil(C.length / perRow) * chh, cells, join(out, 'rig-close.png'), [{ css: 'left:12px;top:6px', html: 'Close on each joint' }]);
}

if (only.includes('walk')) {
  const g = await game();
  const cells = [], cw = 230, chh = 330, N = 8;
  for (const [row, what, yaw] of [[0, 'walk', 0], [1, 'walk', 90], [2, 'run', 90]]) {
    for (let k = 0; k < N; k++) {
      const pose = g.at(what, k / N), f = frameOf(pose), P = ground(rig, skin(rig, f));
      if (row === 0) { const m = metrics(P, f); metricsAll[`walk-${k}`] = m; }
      cells.push(cell(P, { yaw, pitch: 6, s: 22, c: MID }, [k * cw, 34 + row * chh, cw, chh], `${what} ${k + 1}/${N}`, { bones: row === 1 ? boneLines(f) : null }));
    }
  }
  await shoot(cw * N, 34 + 3 * chh, cells, join(out, 'rig-walk.png'), [{ css: 'left:12px;top:6px', html: `The game's own walk (front; side with the bones) and run, eight keys each, from its figure rig (src/sculpt/rig.ts bonesOf) through fromGame(); fitted rest ${(g.fit.cost * 57.3).toFixed(1)}° summed residual` }]);
}

if (only.includes('weights')) {
  const show = [
    ['shoulder_l', 0], ['clavicle_l', 0], ['upperarm_twist_l', 30], ['elbow_l', 30], ['lowerarm_twist_l', 30], ['wrist_l', 20],
    ['hip_l', 30], ['knee_l', 30], ['spine_02', 30], ['neck_01', 30], ['fingers_02_l', 20], ['thumb_01_l', 20],
  ];
  const cells = [], cw = 280, chh = 380, perRow = 6;
  show.forEach(([bn, yaw], k) => {
    const bi = at.get(bn), heat = B.verts.map((_, i) => { const e = rig.vw[i].find(([b]) => b === bi); return e ? +e[1].toFixed(3) : 0; });
    const close = /finger|thumb|wrist/.test(bn);
    const c = close ? [2.3, -5.2, 0] : bn.startsWith('neck') ? [0, -0.3, 0] : /hip|knee/.test(bn) ? [0.8, -6.2, 0] : bn.startsWith('spine') ? [0, -2.6, 0] : [1.6, -2.4, 0];
    const s = close ? 160 : bn.startsWith('neck') ? 110 : /hip|knee/.test(bn) ? 50 : bn.startsWith('spine') ? 50 : 62;
    cells.push(cell(B.verts, { yaw, s, c }, [(k % perRow) * cw, 34 + Math.floor(k / perRow) * chh, cw, chh], bn, { heat }));
  });
  await shoot(cw * perRow, 34 + 2 * chh, cells, join(out, 'rig-weights.png'), [{ css: 'left:12px;top:6px', html: 'Weights per bone: blue 0, green 0.5, yellow 1 (red: all of it)' }]);
}

if (MAIN) writeFileSync(join(out, 'rig-metrics.json'), JSON.stringify(metricsAll, null, 1));
if (browser) await browser.close();
export async function closeBrowser() { if (browser) await browser.close(); browser = null; }
export { rig };
