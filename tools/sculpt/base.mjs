// The sculpt's human base from MakeHuman's base mesh (CC0: see src/sculpt/NOTICE.md), as src/sculpt/assets/human.json:
//
//   node tools/sculpt/base.mjs --mh /path/to/makehuman/makehuman/data        # writes the asset and prints its sizes
//   node tools/sculpt/base.mjs --mh ... --out /some/dir/human.json
//
// What it does: reads base.obj, keeps the body and the two eyeballs, applies the macro targets for a man and a woman
// (and the stylising targets below), measures each one's skeleton from the rig's joint helpers, turns both into our units
// (z up, y forward, x the body's right, sixteen and a half units to the crown), maps the rig's weights onto our bones,
// decimates the body to the three bands with the same topology for both, and writes it all out, quantised.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const MH = resolve(opt('mh', '/home/user/makehumancommunity/makehuman/makehuman/data'));
const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = resolve(opt('out', join(ROOT, 'src/sculpt/assets/human.json')));
const HEIGHT = 16.5;

/* ---- the mesh ------------------------------------------------------------------------------------------------------ */
function readObj(path) {
  const verts = [], faces = [], groups = {};
  let g = '';
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) { const p = line.split(/\s+/); verts.push([+p[1], +p[2], +p[3]]); }
    else if (line.startsWith('g ')) { g = line.split(/\s+/)[1]; groups[g] ??= []; }
    else if (line.startsWith('f ')) { const idx = line.split(/\s+/).slice(1).filter(Boolean).map((s) => +s.split('/')[0] - 1); faces.push({ g, idx }); groups[g].push(faces.length - 1); }
  }
  return { verts, faces, groups };
}
function readTarget(path) {
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    if (p.length >= 4) out.push([+p[0], +p[1], +p[2], +p[3]]);
  }
  return out;
}
const T = (rel) => join(MH, 'targets', rel + '.target');
function applyTargets(verts, list) {
  const out = verts.map((v) => [v[0], v[1], v[2]]);
  for (const [rel, w] of list) {
    if (!w) continue;
    for (const [i, dx, dy, dz] of readTarget(T(rel))) { const v = out[i]; if (v) { v[0] += dx * w; v[1] += dy * w; v[2] += dz * w; } }
  }
  return out;
}

/* ---- the targets for each body: MakeHuman's macro mix for a young adult, average build, the three ethnic shapes evened ---- */
const macro = (gender, o = {}) => {
  const list = [];
  for (const e of ['african', 'asian', 'caucasian']) list.push([`macrodetails/${e}-${gender}-young`, 1 / 3]);
  // Muscle and weight: nought to one each, half being average (the average target is empty, the base itself).
  const m = o.muscle ?? 0.5, w = o.weight ?? 0.5;
  const mm = m < 0.5 ? [['minmuscle', 1 - 2 * m], ['averagemuscle', 2 * m]] : [['averagemuscle', 2 - 2 * m], ['maxmuscle', 2 * m - 1]];
  const ww = w < 0.5 ? [['minweight', 1 - 2 * w], ['averageweight', 2 * w]] : [['averageweight', 2 - 2 * w], ['maxweight', 2 * w - 1]];
  for (const [mn, mw] of mm) for (const [wn, wgt] of ww) if (mw * wgt > 0) list.push([`macrodetails/universal-${gender}-young-${mn}-${wn}`, mw * wgt]);
  // Proportions: half is the base; toward one the ideal, toward nought the uncommon.
  const p = o.proportions ?? 0.5;
  for (const [mn, mw] of mm) for (const [wn, wgt] of ww) if (mw * wgt > 0) {
    if (p > 0.5) list.push([`macrodetails/proportions/${gender}-young-${mn}-${wn}-idealproportions`, (2 * p - 1) * mw * wgt]);
    if (p < 0.5) list.push([`macrodetails/proportions/${gender}-young-${mn}-${wn}-uncommonproportions`, (1 - 2 * p) * mw * wgt]);
  }
  for (const [rel, w] of o.extra ?? []) list.push([rel, w]);
  return list;
};
// Stylising toward the island's sheet: the head a touch larger, the eyes larger, the nose and jaw simpler.
const STYLE = [
  ['head/head-scale-vert-incr', 0.1], ['head/head-scale-horiz-incr', 0.1], ['head/head-scale-depth-incr', 0.05],
  ['eyes/l-eye-scale-incr', 0.4], ['eyes/r-eye-scale-incr', 0.4], ['eyes/l-eye-height2-incr', 1.0], ['eyes/r-eye-height2-incr', 1.0], ['eyes/l-eye-height1-incr', 0.5], ['eyes/r-eye-height1-incr', 0.5],
  ['nose/nose-scale-vert-decr', 0.25], ['nose/nose-scale-horiz-decr', 0.1],
  ['chin/chin-width-decr', 0.8], ['chin/chin-prominent-decr', 0.2], ['chin/chin-triangle', 0.35], ['head/head-invertedtriangular', 0.4],
  ['cheek/l-cheek-bones-incr', 0.3], ['cheek/r-cheek-bones-incr', 0.3], ['cheek/l-cheek-trans-up', 0.3], ['cheek/r-cheek-trans-up', 0.3],
];
const BODIES = {
  man: macro('male', { muscle: 1.0, weight: 0.55, proportions: 1.0, extra: [...STYLE, ['torso/torso-scale-horiz-incr', 0.35], ['torso/torso-vshape-incr', 0.4], ['armslegs/l-upperarm-shoulder-muscle-incr', 0.6], ['armslegs/r-upperarm-shoulder-muscle-incr', 0.6]] }),
  woman: macro('female', { muscle: 0.5, weight: 0.45, proportions: 0.75, extra: STYLE }),
};

/* ---- the skeleton: MakeHuman's joints, measured on each body, and the map onto our bones ---------------------------- */
const skel = JSON.parse(readFileSync(join(MH, 'rigs/default.mhskel'), 'utf8'));
const mhw = JSON.parse(readFileSync(join(MH, 'rigs/default_weights.mhw'), 'utf8')).weights;
const centroid = (verts, ids) => { const c = [0, 0, 0]; for (const i of ids) { c[0] += verts[i][0]; c[1] += verts[i][1]; c[2] += verts[i][2]; } return c.map((x) => x / ids.length); };
const jointAt = (verts, name) => centroid(verts, skel.joints[name]);
const boneEnds = (verts, bone) => { const b = skel.bones[bone]; return [jointAt(verts, b.head), jointAt(verts, b.tail)]; };

/** Our bone for one of MakeHuman's; the body's left (.L) is our k = 0. */
function ourBone(mh) {
  const side = mh.endsWith('.L') ? 0 : mh.endsWith('.R') ? 1 : -1;
  const n = side < 0 ? mh : mh.slice(0, -2);
  const k = side < 0 ? '' : String(side);
  if (['root', 'spine05', 'pelvis'].includes(n)) return 'pelvis';
  if (n === 'spine04') return 'spineA';
  if (n === 'spine03') return 'spineB';
  if (n === 'spine02' || n === 'spine01' || n === 'breast') return 'chest';
  if (n.startsWith('neck')) return 'neck';
  if (n === 'jaw' || n === 'special04' || /^tongue/.test(n)) return 'jaw';
  if (n === 'eye') return `eye${k}`;
  if (n === 'head' || /^(special|levator|oculi|orbicularis|oris|risorius|temporalis)/.test(n)) return 'head';
  if (n === 'clavicle' || n === 'shoulder01') return `clav${k}`;
  if (n.startsWith('upperarm')) return `arm${k}`;
  if (n.startsWith('lowerarm')) return `elbow${k}`;
  if (n === 'wrist' || n.startsWith('metacarpal')) return `wrist${k}`;
  if (/^finger1-[12]$/.test(n)) return `thumb${k}`;
  if (n === 'finger1-3') return `thumbTip${k}`;
  if (/^finger[2-5]-1$/.test(n)) return `fing${k}`;
  if (/^finger[2-5]-[23]$/.test(n)) return `fingTip${k}`;
  if (n.startsWith('upperleg')) return `hip${k}`;
  if (n.startsWith('lowerleg')) return `knee${k}`;
  if (n === 'foot') return `ankle${k}`;
  if (n.startsWith('toe')) return `toe${k}`;
  throw new Error(`no bone of ours for ${mh}`);
}
/** The MakeHuman bone (head, tail) that stands for each of ours, for the frames the mesh is carried over by. */
const FRAME_OF = {
  pelvis: ['spine05', 'spine05'], spineA: ['spine04', 'spine04'], spineB: ['spine03', 'spine03'], chest: ['spine02', 'spine01'],
  neck: ['neck01', 'neck03'], head: ['head', 'head'], jaw: ['jaw', 'jaw'],
};
for (const [k, s] of [[0, 'L'], [1, 'R']]) Object.assign(FRAME_OF, {
  [`eye${k}`]: [`eye.${s}`, `eye.${s}`], [`clav${k}`]: [`clavicle.${s}`, `clavicle.${s}`],
  [`arm${k}`]: [`upperarm01.${s}`, `upperarm02.${s}`], [`elbow${k}`]: [`lowerarm01.${s}`, `lowerarm02.${s}`],
  [`wrist${k}`]: [`wrist.${s}`, `metacarpal2.${s}`], [`fing${k}`]: [`finger3-1.${s}`, `finger3-1.${s}`], [`fingTip${k}`]: [`finger3-2.${s}`, `finger3-3.${s}`],
  [`thumb${k}`]: [`finger1-1.${s}`, `finger1-2.${s}`], [`thumbTip${k}`]: [`finger1-3.${s}`, `finger1-3.${s}`],
  [`hip${k}`]: [`upperleg01.${s}`, `upperleg02.${s}`], [`knee${k}`]: [`lowerleg01.${s}`, `lowerleg02.${s}`],
  [`ankle${k}`]: [`foot.${s}`, `foot.${s}`], [`toe${k}`]: [`toe3-1.${s}`, `toe3-1.${s}`],
});
const BONES = Object.keys(FRAME_OF);

/* ---- our coordinates: x the body's right, y forward, z up from the ground, scaled to the height ------------------------ */
function framesAndProportions(verts, body) {
  const ys = body.map((i) => verts[i][1]);
  const ground = Math.min(...ys), crown = Math.max(...ys);
  const s = HEIGHT / (crown - ground);
  const ours = (p) => [-p[0] * s, p[2] * s, (p[1] - ground) * s];
  const frames = {};
  for (const [b, [h, t]] of Object.entries(FRAME_OF)) {
    const H = ours(boneEnds(verts, h)[0]), Tl = ours(boneEnds(verts, t)[1]);
    frames[b] = [...H, ...Tl];
  }
  // The pelvis's frame stands over the hip joints, where our rig puts it.
  const hipL = ours(boneEnds(verts, 'upperleg01.L')[0]), hipR = ours(boneEnds(verts, 'upperleg01.R')[0]);
  frames.pelvis = [0, (hipL[1] + hipR[1]) / 2, (hipL[2] + hipR[2]) / 2 + 0.1, ...frames.pelvis.slice(3)];
  const J = (b) => frames[b].slice(0, 3), E = (b) => frames[b].slice(3, 6);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const z = (b) => J(b)[2];
  // Half-widths of the body at a height, for the radii the stamps and the hair chain use.
  const halfAt = (zz, lo, hi) => { let w = 0; for (const i of body) { const p = ours(verts[i]); if (Math.abs(p[2] - zz) < 0.25 && Math.abs(p[0]) >= lo && Math.abs(p[0]) <= hi) w = Math.max(w, Math.abs(p[0])); } return w; };
  const headV = body.map((i) => ours(verts[i])).filter((p) => p[2] > z('head'));
  const headW = Math.max(...headV.map((p) => Math.abs(p[0]))), headY = headV.map((p) => p[1]);
  const chin = E('jaw');
  const P = {
    heads: HEIGHT / (HEIGHT - chin[2]),
    hip: z('pelvis'), spine: z('spineB') - z('pelvis'), chest: z('chest') - z('spineB'), neck: z('neck') - z('chest'), headJ: z('head') - z('neck'),
    armAt: z('arm0') - z('chest'),
    upper: dist(J('arm0'), J('elbow0')), lower: dist(J('elbow0'), J('wrist0')), thigh: dist(J('hip0'), J('knee0')), shin: dist(J('knee0'), J('ankle0')),
    shoulder: Math.abs(J('arm0')[0]), hipW: Math.abs(J('hip0')[0]),
    head: (HEIGHT - z('head')) / 1.04, headW, headD: (Math.max(...headY) - Math.min(...headY)) / 2,
    sole: z('ankle0'), foot: E('toe0')[1] - J('ankle0')[1],
    palm: dist(J('wrist0'), J('fing0')), finger: dist(J('fing0'), E('fingTip0')),
    eye: [Math.abs(J('eye1')[0] - J('head')[0]), J('eye1')[1] - J('head')[1], J('eye1')[2] - J('head')[2]].map((x) => +x.toFixed(3)),
    jaw: [0, J('jaw')[1] - J('head')[1], J('jaw')[2] - J('head')[2]].map((x) => +x.toFixed(3)),
    r: {
      neck: halfAt(z('neck') + 0.4, 0, 1.2), upper: 0.55,
      fore: 0.45, wrist: 0.3, thigh: 0.8, shin: 0.5, ankle: 0.3,
      chest: halfAt(z('arm0') - 1.4, 0, 1.6), waist: halfAt(z('spineB') + 0.3, 0, 1.6), pelvis: halfAt(z('pelvis') - 0.6, 0, 2.2),
    },
  };
  for (const k of Object.keys(P)) if (typeof P[k] === 'number') P[k] = +P[k].toFixed(3);
  for (const k of Object.keys(P.r)) P.r[k] = +P.r[k].toFixed(3);
  return { frames, P, ours, s };
}

/* ---- decimation: quadric edge collapses on the triangles, the face and hands kept dear ----------------------------------- */
function decimate(pos, tris, keepWeight, target) {
  // pos: array of [x,y,z]; tris: array of [a,b,c]; keepWeight: per vertex multiplier on the error; returns { map, tris } with map old->new (or -1).
  const n = pos.length;
  const Q = new Float64Array(n * 10);
  const addPlane = (v, a, b, c, d, w) => { const o = v * 10, q = Q; q[o] += a * a * w; q[o + 1] += a * b * w; q[o + 2] += a * c * w; q[o + 3] += a * d * w; q[o + 4] += b * b * w; q[o + 5] += b * c * w; q[o + 6] += b * d * w; q[o + 7] += c * c * w; q[o + 8] += c * d * w; q[o + 9] += d * d * w; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const planeOf = (t) => { const p0 = pos[t[0]], e1 = sub(pos[t[1]], p0), e2 = sub(pos[t[2]], p0); const nrm = cross(e1, e2); const l = Math.hypot(...nrm); if (l < 1e-12) return null; const a = nrm[0] / l, b = nrm[1] / l, c = nrm[2] / l; return [a, b, c, -(a * p0[0] + b * p0[1] + c * p0[2]), l / 2]; };
  const alive = new Uint8Array(tris.length).fill(1);
  const vt = Array.from({ length: n }, () => new Set());
  tris.forEach((t, i) => { for (const v of t) vt[v].add(i); });
  const edgeCount = new Map();
  const ek = (a, b) => (a < b ? a * n + b : b * n + a);
  for (const t of tris) { for (let i = 0; i < 3; i++) { const k = ek(t[i], t[(i + 1) % 3]); edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1); } }
  tris.forEach((t) => {
    const pl = planeOf(t); if (!pl) return;
    for (const v of t) addPlane(v, pl[0], pl[1], pl[2], pl[3], pl[4] * keepWeight[v]);
    // A boundary edge pins its ends with a plane through it, perpendicular to the face.
    for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3];
      if (edgeCount.get(ek(a, b)) === 1) {
        const e = sub(pos[b], pos[a]), nn = cross(e, [pl[0], pl[1], pl[2]]), l = Math.hypot(...nn) || 1;
        const q = [nn[0] / l, nn[1] / l, nn[2] / l]; const d = -(q[0] * pos[a][0] + q[1] * pos[a][1] + q[2] * pos[a][2]);
        addPlane(a, q[0], q[1], q[2], d, 50 * pl[4]); addPlane(b, q[0], q[1], q[2], d, 50 * pl[4]);
      }
    }
  });
  const qErr = (v, p) => { const o = v * 10, q = Q, [x, y, z] = p; return q[o] * x * x + 2 * q[o + 1] * x * y + 2 * q[o + 2] * x * z + 2 * q[o + 3] * x + q[o + 4] * y * y + 2 * q[o + 5] * y * z + 2 * q[o + 6] * y + q[o + 7] * z * z + 2 * q[o + 8] * z + q[o + 9]; };
  const costOf = (a, b) => {
    const pa = pos[a], pb = pos[b], mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
    let best = null;
    for (const p of [mid, pa, pb]) { const c = qErr(a, p) + qErr(b, p); if (!best || c < best[0]) best = [c, p]; }
    return best;
  };
  // A binary heap of [cost, a, b, version].
  const heap = [];
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const ver = new Uint32Array(n);
  const edgesOf = (v) => { const s = new Set(); for (const ti of vt[v]) if (alive[ti]) for (const u of tris[ti]) if (u !== v) s.add(u); return s; };
  for (const k of edgeCount.keys()) { const a = Math.floor(k / n), b = k % n; const [c] = costOf(a, b); push([c, a, b, ver[a] + ver[b]]); }
  const map = new Int32Array(n); for (let i = 0; i < n; i++) map[i] = i;
  const find = (v) => { while (map[v] !== v) v = map[v]; return v; };
  let nTris = tris.length;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  while (nTris > target && heap.length) {
    const [, a0, b0, v] = pop();
    const a = find(a0), b = find(b0);
    if (a === b || a0 !== a || b0 !== b || v !== ver[a] + ver[b]) continue;
    const [, p] = costOf(a, b);
    // No triangle may flip or flatten when its corner moves to p.
    let ok = true;
    for (const vv of [a, b]) for (const ti of vt[vv]) {
      if (!alive[ti]) continue;
      const t = tris[ti]; if (t.includes(a) && t.includes(b)) continue;
      const before = planeOf(t); if (!before) continue;
      const moved = t.map((u) => (u === a || u === b ? p : pos[u]));
      const e1 = sub(moved[1], moved[0]), e2 = sub(moved[2], moved[0]), nn = cross(e1, e2), l = Math.hypot(...nn);
      if (l < 1e-9 || dot([nn[0] / l, nn[1] / l, nn[2] / l], before) < 0.2) { ok = false; break; }
    }
    if (!ok) continue;
    // Collapse b into a at p.
    pos[a] = p; map[b] = a; ver[a]++;
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    keepWeight[a] = Math.max(keepWeight[a], keepWeight[b]);
    for (const ti of vt[b]) {
      if (!alive[ti]) continue;
      const t = tris[ti];
      if (t.includes(a)) { alive[ti] = 0; nTris--; continue; }
      for (let i = 0; i < 3; i++) if (t[i] === b) t[i] = a;
      vt[a].add(ti);
    }
    vt[b].clear();
    for (const u of edgesOf(a)) { const [c] = costOf(a, u); push([c, Math.min(a, u), Math.max(a, u), ver[a] + ver[u]]); }
  }
  return { map: Array.from({ length: n }, (_, i) => find(i)), tris: tris.filter((_, i) => alive[i]), nTris };
}

/* ---- build ------------------------------------------------------------------------------------------------------------ */
const obj = readObj(join(MH, '3dobjs/base.obj'));
const KEEP = ['body'];
const keptFaces = KEEP.flatMap((g) => obj.groups[g] ?? []);
const used = new Set(); for (const fi of keptFaces) for (const i of obj.faces[fi].idx) used.add(i);
const bodyIds = [...used].sort((a, b) => a - b);
const eyeHelper = (g) => [...new Set(obj.groups[g].flatMap((fi) => obj.faces[fi].idx))];
const bodies = {};
for (const [name, targets] of Object.entries(BODIES)) {
  const v = applyTargets(obj.verts, targets);
  const body = obj.groups.body.flatMap((fi) => obj.faces[fi].idx);
  // The eyes' centres and size, from MakeHuman's eyeball helpers (kept out of the mesh: the lids are a closed surface over them).
  const eyes = ['helper-l-eye', 'helper-r-eye'].map((g) => { const ids = eyeHelper(g); const c = centroid(v, ids); let r = 0; for (const i of ids) r += Math.hypot(v[i][0] - c[0], v[i][1] - c[1], v[i][2] - c[2]) / ids.length; return { c, r }; });
  bodies[name] = { verts: v, eyes, ...framesAndProportions(v, body) };
  console.log(name, JSON.stringify(bodies[name].P));
}
// Our bone weights per vertex, from the rig's, merged where several of its bones are one of ours, the top four kept.
const bw = new Map();
for (const [mh, list] of Object.entries(mhw)) {
  const ob = ourBone(mh); const bi = BONES.indexOf(ob); if (bi < 0) throw new Error(`frame for ${ob}`);
  for (const [i, w] of list) { if (!used.has(i)) continue; let m = bw.get(i); if (!m) { m = new Map(); bw.set(i, m); } m.set(bi, (m.get(bi) ?? 0) + w); }
}
const top4 = (i) => { const m = bw.get(i); if (!m) return [[BONES.indexOf('pelvis'), 1]]; const l = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const s = l.reduce((t, x) => t + x[1], 0) || 1; return l.map(([b, w]) => [b, w / s]); };
// Triangles of the body (quads split along the shorter diagonal, on the man's shape), in a compact vertex numbering.
const idOf = new Map(bodyIds.map((v, i) => [v, i]));
const manPos = bodyIds.map((i) => bodies.man.ours(bodies.man.verts[i]));
const womanPos = bodyIds.map((i) => bodies.woman.ours(bodies.woman.verts[i]));
const bodyTris = [];
for (const fi of keptFaces) {
  const f = obj.faces[fi], q = f.idx.map((i) => idOf.get(i));
  const d = (a, b) => Math.hypot(...[0, 1, 2].map((k) => manPos[a][k] - manPos[b][k]));
  if (q.length === 4) { if (d(q[0], q[2]) <= d(q[1], q[3])) bodyTris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); else bodyTris.push([q[0], q[1], q[3]], [q[1], q[2], q[3]]); }
  else bodyTris.push(q);
}
// What each vertex is, for the error weights and the materials: the face, the hands and the feet are kept dear.
const region = bodyIds.map((i) => {
  const [b] = top4(i)[0]; const name = BONES[b];
  if (/^(head|jaw|eye)/.test(name)) return 1; if (/^(wrist|fing|thumb)/.test(name)) return 2; if (/^(ankle|toe)/.test(name)) return 3; return 0;
});

/* ---- the face and the hair the island draws over the base: the eyes as almonds on the face, brows, a shell of hair -------
 * Built per body in MakeHuman's space (y up, z forward), the same topology for both, bound to our head bone. Regions:
 * 5 the eye's white with the iris stamped, 6 the pupil, 7 the lid line, 8 a brow, 9 hair. */
function extras(b, shared) {
  const V = b.verts, out = { pos: [], tris: [], region: [], stamp: [] };
  const face = obj.groups.body.flatMap((fi) => obj.faces[fi].idx).filter((i) => V[i][1] > b.eyes[0].c[1] - 1.5);
  // The skin's front at (x, y): the furthest-forward face vertex near it.
  const skinZ = (x, y, w = 0.14) => { let z = -9; for (const i of face) if (Math.abs(V[i][0] - x) < w && Math.abs(V[i][1] - y) < w) z = Math.max(z, V[i][2]); return z; };
  const add = (p, region, stamp = -1) => { out.pos.push(p); out.region.push(region); out.stamp.push(stamp); return out.pos.length - 1; };
  const ey = (b.eyes[0].c[1] + b.eyes[1].c[1]) / 2;
  for (const e of b.eyes) {
    const s = e.c[0] < 0 ? -1 : 1;
    // An almond on a sphere larger than the eyeball, set a little wider than the base's, its front just proud of the lids;
    // the outer corner a touch lower. The white shows at the corners round a large dark iris.
    const R = e.r * 1.95, lid = skinZ(e.c[0], e.c[1]);
    const c = [e.c[0] + s * 0.04, e.c[1] + 0.02, lid + 0.025 - R];
    const N = 16, rings = [0, 0.45, 0.8, 1.0];
    const on = (t, f) => {
      const outer = Math.cos(t) * s, th = 1.0 * Math.cos(t) * f, up = Math.sin(t) >= 0 ? 0.48 : 0.38;
      const tv = (up * Math.sin(t) * (1 - 0.2 * Math.cos(t) * Math.cos(t)) - 0.12 * Math.max(0, -outer)) * f;
      return [c[0] + R * Math.sin(th) * Math.cos(tv), c[1] + R * Math.sin(tv), c[2] + R * Math.cos(th) * Math.cos(tv)];
    };
    const irisC = [c[0] - s * R * 0.04, c[1] - 0.02, c[2] + R], irisR = R * 0.46;
    // A lash tick at the outer corner, flicked up and out.
    { const o = on(s > 0 ? 0 : Math.PI, 1.0); const q = (dx, dy) => [o[0] + s * dx, o[1] + dy, o[2] + 0.006]; const t0 = add(q(0, 0.03), 7), t1 = add(q(0, -0.02), 7), t2 = add(q(0.12, 0.09), 7); out.tris.push([t0, t1, t2], [t0, t2, t1]); }
    const dist = (p) => Math.hypot(p[0] - irisC[0], p[1] - irisC[1], p[2] - irisC[2]);
    const centre = add(irisC, 5, irisR);
    const ring = rings.slice(1).map((f) => Array.from({ length: N }, (_, i) => { const p = on((i / N) * Math.PI * 2, f); return add(p, 5, irisR - dist(p)); }));
    for (let i = 0; i < N; i++) out.tris.push([centre, ring[0][i], ring[0][(i + 1) % N]]);
    for (let r = 0; r + 1 < ring.length; r++) for (let i = 0; i < N; i++) { const a = ring[r][i], d = ring[r][(i + 1) % N], e2 = ring[r + 1][i], f2 = ring[r + 1][(i + 1) % N]; out.tris.push([a, e2, f2], [a, f2, d]); }
    // The lid line: a dark band round the almond, thick along the upper lid, thin below, a hair in front.
    const lidIn = Array.from({ length: N }, (_, i) => { const p = on((i / N) * Math.PI * 2, 1.0); return add([p[0], p[1], p[2] + 0.004], 7); });
    const lidOut = Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; const p = on(t, Math.sin(t) >= 0 ? 1.24 : 1.07); return add([p[0], p[1], p[2] + 0.004], 7); });
    for (let i = 0; i < N; i++) { const a = lidIn[i], d = lidIn[(i + 1) % N], e2 = lidOut[i], f2 = lidOut[(i + 1) % N]; out.tris.push([a, e2, f2], [a, f2, d]); }
    // The pupil, a disc a hair in front of the iris's middle, and one glint up and to the body's right of it.
    const disc = (cc, r, region, lift) => { const pc = add([cc[0], cc[1], cc[2] + lift], region); const pr = Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2; return add([cc[0] + r * Math.cos(t), cc[1] + r * Math.sin(t), cc[2] + lift - (r * r) / (2 * R)], region); }); for (let i = 0; i < 10; i++) out.tris.push([pc, pr[i], pr[(i + 1) % 10]]); };
    disc(irisC, irisR * 0.45, 6, 0.006);
    disc([irisC[0] - 0.35 * irisR, irisC[1] + 0.4 * irisR, irisC[2]], irisR * 0.18, 10, 0.012);
    // The brow: a thick dark arc on the brow ridge, tapering outward, lying on the skin.
    const bx = [0.06, 0.24, 0.42, 0.58, 0.7], by = [0.36, 0.42, 0.44, 0.4, 0.33], bh = [0.1, 0.09, 0.08, 0.06, 0.035];
    const top = [], bot = [];
    for (let i = 0; i < bx.length; i++) {
      const x = e.c[0] + s * (bx[i] - 0.3), yTop = e.c[1] + by[i], yBot = yTop - bh[i];
      top.push(add([x, yTop, skinZ(x, yTop) + 0.02], 8)); bot.push(add([x, yBot, skinZ(x, yBot) + 0.02], 8));
    }
    for (let i = 0; i + 1 < bx.length; i++) out.tris.push([top[i], bot[i], bot[i + 1]], [top[i], bot[i + 1], top[i + 1]]);
  }
  // The mouth: a dark line a little below the nose, its ends turned slightly down, the calm mouth of the sheet.
  {
    const my = ey - 0.98, mt = [], mb = [];
    for (let i = 0; i < 7; i++) {
      const u = i / 6, x = -0.3 + 0.6 * u, y = my - 0.035 * Math.pow(Math.abs(u - 0.5) * 2, 2), z = skinZ(x, y, 0.1) + 0.02;
      mt.push(add([x, y + 0.015, z], 11)); mb.push(add([x, y - 0.015, z], 11));
    }
    for (let i = 0; i < 6; i++) out.tris.push([mt[i], mb[i], mb[i + 1]], [mt[i], mb[i + 1], mt[i + 1]]);
  }
  // The hair: a shell of the scalp's own faces pushed out, and over it the sheet's wedges -- a fringe mass swept over the
  // forehead with pointed tips, side masses over the ears, a tousled top with two cowlicks, a mass down the nape.
  const hairline = (p) => (p[2] > 0.3 ? ey + 0.55 : p[2] > -0.3 ? ey + 0.1 : ey + 0.05);
  const scalp = shared ?? new Set(face.filter((i) => V[i][1] > hairline(V[i])));
  out.scalp = scalp;
  const nrm = new Map();
  const tris = [];
  for (const fi of obj.groups.body) {
    const q = obj.faces[fi].idx; if (!q.every((i) => scalp.has(i))) continue;
    const t = q.length === 4 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
    for (const tr of t) { tris.push(tr); const [a, bb, cc] = tr.map((i) => V[i]); const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]]; const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const i of tr) { const m = nrm.get(i) ?? [0, 0, 0]; nrm.set(i, [m[0] + n[0], m[1] + n[1], m[2] + n[2]]); } }
  }
  const hash = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const hid = new Map();
  for (const i of scalp) {
    const n = nrm.get(i); if (!n) continue; const l = Math.hypot(...n) || 1;
    const p = V[i], edge = p[1] < hairline(p) + 0.2;
    const h = (edge ? 0.08 : 0.14 + 0.22 * Math.max(0, n[1] / l)) + 0.04 * hash(i);
    hid.set(i, add([p[0] + (n[0] / l) * h, p[1] + (n[1] / l) * h - (edge ? 0.08 : 0), p[2] + (n[2] / l) * h], 9));
  }
  for (const tr of tris) if (tr.every((i) => hid.has(i))) out.tris.push(tr.map((i) => hid.get(i)));
  // A clump of hair: a lofted flattened teardrop along a curve through three points -- a thick rounded base sunk a
  // little into the shell, the body standing off the skull, tapering to a point. Its upper face carries a highlight
  // stamp (region 9 lilac, region 12 teal), positive where the ring faces up and out.
  const clump = (pts, w0, h0, up, region = 9) => {
    const P = (t) => [0, 1, 2].map((k) => (1 - t) * (1 - t) * pts[0][k] + 2 * (1 - t) * t * pts[1][k] + t * t * pts[2][k]);
    const S = 8, M = 10, rings = [];
    for (let i = 0; i <= S; i++) {
      const t = i / S, c = P(t), d = [0, 1, 2].map((k) => P(Math.min(1, t + 0.01))[k] - P(Math.max(0, t - 0.01))[k]), dl = Math.hypot(...d) || 1;
      const tg = d.map((x) => x / dl);
      let side = [tg[1] * up[2] - tg[2] * up[1], tg[2] * up[0] - tg[0] * up[2], tg[0] * up[1] - tg[1] * up[0]]; const sl = Math.hypot(...side) || 1; side = side.map((x) => x / sl);
      const u = [side[1] * tg[2] - side[2] * tg[1], side[2] * tg[0] - side[0] * tg[2], side[0] * tg[1] - side[1] * tg[0]];
      // Rounded at the base (a quarter circle over the first fifth), then tapering to the point.
      const g = t < 0.2 ? Math.sqrt(1 - (1 - t / 0.2) * (1 - t / 0.2)) : 1 - ((t - 0.2) / 0.8) * ((t - 0.2) / 0.8) * 0.96;
      const taper = i === S ? 0.02 : Math.max(0.02, g), w = w0 * taper, h = h0 * taper;
      rings.push(Array.from({ length: M }, (_, j) => {
        const a = (j / M) * Math.PI * 2, lit = Math.sin(a) - 0.25;
        return add([c[0] + side[0] * w * Math.cos(a) + u[0] * h * Math.sin(a), c[1] + side[1] * w * Math.cos(a) + u[1] * h * Math.sin(a), c[2] + side[2] * w * Math.cos(a) + u[2] * h * Math.sin(a)], region, lit * 0.3);
      }));
    }
    const p0 = P(0), b = [0, 1, 2].map((k) => p0[k] - (P(0.05)[k] - p0[k]) * 1.5);
    const cap = add(b, region, -0.3);
    for (let j = 0; j < M; j++) out.tris.push([cap, rings[0][(j + 1) % M], rings[0][j]]);
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < M; j++) { const a = rings[i][j], d = rings[i][(j + 1) % M], e2 = rings[i + 1][j], f2 = rings[i + 1][(j + 1) % M]; out.tris.push([a, d, f2], [a, f2, e2]); }
  };
  // The clumps are set by direction from the skull's middle: azimuth from the front (toward the body's left positive),
  // elevation, and how far out past the skull. The flat of each faces out. Sizes in head widths.
  const c0 = [0, ey + 0.15, 0.3];
  const skull = face.map((i) => { const d = [V[i][0] - c0[0], V[i][1] - c0[1], V[i][2] - c0[2]]; const l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, d[2] / l, l]; });
  const H = (az, el, out, cap = 9) => {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
    // The skull's radius along d: the furthest vertex within a narrow cone, widening the cone until one is found.
    let r = 0; for (const cone of [0.99, 0.975, 0.95, 0.9]) { for (const v of skull) if (v[0] * d[0] + v[1] * d[1] + v[2] * d[2] > cone) r = Math.max(r, v[3]); if (r) break; }
    r = Math.min(r || 0.9, cap);
    return [c0[0] + d[0] * (r + out), c0[1] + d[1] * (r + out), c0[2] + d[2] * (r + out)];
  };
  const HW = 1.7;
  const C = (a, b, c, w, h, region) => { const p1 = H(...b); const up = [p1[0] - c0[0], p1[1] - c0[1], p1[2] - c0[2]]; clump([H(...a), p1, H(...c)], w * HW, h * HW, up, region); };
  // The fringe: three big clumps from the right temple sweeping left across the forehead, tips over the brows (one between
  // them), and a small clump flicking up off the forehead at the parting. Two of them carry the teal. (A clump's middle
  // control point pulls its curve only half way, so the middles stand at twice the mass wanted.)
  C([-70, 28, -0.04], [-40, 32, 0.55], [-14, 4, 0.18], 0.17, 0.06, 12);
  C([-55, 36, -0.04], [-15, 38, 0.6], [2, 2, 0.18], 0.18, 0.06);
  C([-35, 42, -0.04], [12, 38, 0.56], [30, 6, 0.18], 0.17, 0.06);
  C([-45, 42, -0.02], [-52, 62, 0.5], [-72, 74, 0.6], 0.09, 0.04);
  // The top: four clumps fanning up and back from the front of the crown, the tips splaying apart.
  C([-30, 50, -0.04], [-40, 82, 0.85], [-118, 38, 0.56], 0.2, 0.075, 12);
  C([-10, 56, -0.04], [0, 90, 0.9], [180, 42, 0.6], 0.21, 0.075);
  C([15, 52, -0.04], [40, 82, 0.85], [122, 38, 0.56], 0.2, 0.075);
  C([40, 44, -0.04], [70, 72, 0.75], [150, 28, 0.5], 0.2, 0.075);
  // The sides: two clumps a side sweeping back over the top third of the ear, and one behind it to the nape.
  for (const sd of [-1, 1]) {
    C([sd * 40, 36, -0.04], [sd * 75, 18, 0.34], [sd * 104, -8, 0.26], 0.16, 0.06);
    C([sd * 60, 30, -0.04], [sd * 95, 8, 0.32], [sd * 122, -16, 0.22], 0.15, 0.06);
    C([sd * 118, 40, -0.04], [sd * 132, 8, 0.42], [sd * 138, -20, 0.12, 1.0], 0.16, 0.06);
  }
  // The nape: three clumps down the neck, the middle one longest.
  C([150, 32, -0.04], [146, -2, 0.46], [154, -30, 0.12, 1.0], 0.2, 0.06);
  C([180, 36, -0.04], [180, -4, 0.5], [180, -40, 0.12, 1.0], 0.2, 0.07);
  C([210, 32, -0.04], [214, -2, 0.46], [206, -30, 0.12, 1.0], 0.2, 0.06);
  return out;
}
const exMan = extras(bodies.man), exWoman = extras(bodies.woman, exMan.scalp);
if (exMan.pos.length !== exWoman.pos.length) throw new Error('the extras differ between the bodies');
const exManPos = exMan.pos.map((p) => bodies.man.ours(p)), exWomanPos = exWoman.pos.map((p) => bodies.woman.ours(p));
console.log(`extras: ${exMan.pos.length} verts, ${exMan.tris.length} tris`);

const BANDS = [[0, 1100], [1, 3200], [2, 10000]];
const bands = [];
const headSlot = BONES.indexOf('head');
for (const [band, target] of BANDS) {
  const pos = manPos.map((p) => [...p]);
  const tris = bodyTris.map((t) => [...t]);
  // The face and the hands keep the close band's density at every band; the body pays for it.
  const keep = band === 2 ? [6, 5, 2.5] : band === 1 ? [40, 20, 5] : [12, 6, 2];
  const kw = region.map((r) => (r === 1 ? keep[0] : r === 2 ? keep[1] : r === 3 ? keep[2] : 1));
  const dec = decimate(pos, tris, kw, target);
  const keptSet = new Set(dec.tris.flat());
  const kept = [...keptSet].sort((a, b) => a - b), newId = new Map(kept.map((v, i) => [v, i]));
  const n0 = kept.length;
  const tri = [...dec.tris.map((t) => t.map((v) => newId.get(v))), ...exMan.tris.map((t) => t.map((v) => v + n0))];
  const q = (p) => p.map((x) => Math.round(x * 500));
  const stamp = [];
  exMan.stamp.forEach((d, i) => { if (d > -1) stamp.push(n0 + i, Math.round(d * 1000)); });
  bands.push({
    band, verts: n0 + exMan.pos.length, tris: tri.flat(),
    man: [...kept.flatMap((v) => q(manPos[v])), ...exManPos.flatMap(q)], woman: [...kept.flatMap((v) => q(womanPos[v])), ...exWomanPos.flatMap(q)],
    region: [...kept.map((v) => region[v]), ...exMan.region],
    bw: [...kept.flatMap((v) => { const l = top4(bodyIds[v]); const out = []; for (let i = 0; i < 4; i++) out.push(l[i] ? l[i][0] : 0, l[i] ? Math.round(l[i][1] * 255) : 0); return out; }), ...exMan.pos.flatMap(() => [headSlot, 255, 0, 0, 0, 0, 0, 0])],
    stamp,
  });
  console.log(`band ${band}: ${n0 + exMan.pos.length} verts, ${tri.length} tris`);
}
const asset = {
  licence: 'Base mesh, targets and rig from MakeHuman (makehumancommunity/makehuman), CC0 1.0: see src/sculpt/NOTICE.md',
  height: HEIGHT, bones: BONES,
  frames: { man: bodies.man.frames, woman: bodies.woman.frames },
  proportions: { man: bodies.man.P, woman: bodies.woman.P },
  bands,
};
for (const f of Object.values(asset.frames)) for (const k of Object.keys(f)) f[k] = f[k].map((x) => +x.toFixed(3));
mkdirSync(dirname(OUT), { recursive: true });
const text = JSON.stringify(asset);
writeFileSync(OUT, text);
console.log(`wrote ${OUT}: ${(statSync(OUT).size / 1024).toFixed(0)} KB, gzip ${(gzipSync(text).length / 1024).toFixed(0)} KB`);
