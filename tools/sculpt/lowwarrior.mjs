// The shoulder-length warrior cut for the low-poly bodies: the game's 'warrior', "Shoulder length". Modelled from its
// description (tools/sculpt/hairs/warrior.mjs, no sheet), in the shape of the bob (tools/sculpt/lowbob.mjs): one closed
// shell of locks over the skull, fitted to each body's own head and shoulders.
//
//   columns  per side the lock borders (the style's keys and locks): each border a path over the skull from the middle
//            parting to where the hair starts to hang, the front edge along the hairline and over the ear's root (the
//            hair tucked behind the ear), the back's middle straight down from the crown; per lock a ridge between its
//            two borders stood out and the borders sunk (two flat planes a lock), each border a narrow crease in the
//            valleys' shade. Her right mirrors her left; the two sides meet on the parting and down the back's middle.
//   rows     down each column: over the skull from the parting (the parting's own row on the scalp, its first faces in
//            a valley's shade) to the hang, then straight down to the hem a little over the shoulders, flaring a little;
//            each lock's tip below its borders and thin (the tapered ends).
//   inside   sunk into the scalp under the cap, a thickness in from the outside where the hair hangs free, off the skin
//            where it is not the scalp (the face, the ears, the neck); the rim between the two at the hem and along the
//            front edge in the valleys' shade.
//
// Rigid on the head; kept off the face, the ears, the neck and the shoulders at rest and in the game's clips' poses
// (clearBody; the poses tools/sculpt/hairs/warrior-poses-<who>.json, tools/sculpt/lowwarrioranim.mjs --write).
//
//   node tools/sculpt/lowwarrior.mjs [--who female,male]   # counts, open edges, crossings at rest and head turned
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { crossings, openEdges, skinHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowbob.mjs';
import WARRIOR from './hairs/warrior.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
/** A direction from the skull's middle: th round from the front toward her left, ph up from level (degrees). */
export const dirOf = (th, ph) => { const t = rad(th), p = rad(ph); return [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)]; };
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The furthest crossing of a ray from o along unit d with triangles ({ P: three points, poly }): { t, poly }. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const { P: [a, b, c], poly: pi } of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    // (a hair's breadth of slack: a ray along an edge between two triangles still meets one)
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = pi; }
  }
  return { t: best, poly };
}

const RADII = new Map();
/** The head's (with its ears) and the neck's skin as a radius from the skull's middle per direction, and the polygon
 * there, on a grid `step` degrees apart (th -180..180, ph -90..90): body(d) and polyAt(d) for a unit direction. */
export function radiiOf(rig, step = 2) {
  if (RADII.has(rig.who)) return RADII.get(rig.who);
  const B = rig.B, C = centreOf(B);
  const T = B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => ({ P: t.v.map((i) => B.verts[i]), poly: t.poly }));
  const nt = Math.round(360 / step) + 1, np = Math.round(180 / step) + 1, R = new Float64Array(nt * np), Q = new Int32Array(nt * np);
  for (let a = 0; a < nt; a++) for (let b = 0; b < np; b++) { const h = farHit(T, C, dirOf(-180 + a * step, -90 + b * step)); R[a * np + b] = h.t; Q[a * np + b] = h.poly; }
  // (a ray that still slips between two triangles: the most of its neighbours')
  for (let a = 0; a < nt; a++) for (let b = 1; b + 1 < np; b++) if (!(R[a * np + b] > 0)) {
    let m = 0, q = -1;
    for (const [da, db] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const k = ((a + da + nt) % nt) * np + b + db; if (R[k] > m) { m = R[k]; q = Q[k]; } }
    R[a * np + b] = m; Q[a * np + b] = q;
  }
  const cell = (d) => { const [th, ph] = angOf(d); return [Math.min(nt - 1.001, Math.max(0, (th + 180) / step)), Math.min(np - 1.001, Math.max(0, (ph + 90) / step))]; };
  const body = (d) => { const [x, y] = cell(d), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, v = (p, q) => R[p * np + q]; return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy; };
  const polyAt = (d) => { const [x, y] = cell(d); return Q[Math.round(x) * np + Math.round(y)]; };
  const out = { C, body, polyAt };
  RADII.set(rig.who, out);
  return out;
}

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/warrior-poses-<who>.json, written by
 * tools/sculpt/lowwarrioranim.mjs --write), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/warrior-poses-${who}.json`), 'utf8')); } catch { return []; }
}

const TORSO = new Map();
const BENT = ['ground', 'drink-cup', 'drink-cup-left', 'drink-skin', 'drink-skin-left', 'brush-floor', 'brush-floor-left'];
/** The highest point of the torso (and the shoulder joints) straight under (x, z) in the head's own frame (where the
 * hair is, rigid on it), at rest and in each of the clips' poses (the shoulders rise against the head as the arms come
 * down and the head nods): the highest of them, or -Infinity. `still`: at rest and in the idle only. The clips that
 * bend the head down to the chest (BENT) are left to clearBody, which lifts the ends only where they meet it. */
function torsoTop(rig, x, z, still = false) {
  if (!TORSO.has(rig.who)) {
    const B = rig.B, tris = B.tris.filter((t) => ['torso', 'joint'].includes(B.polys[t.poly].part)), hb = rig.bones[rig.at.get('head')];
    const sets = [Object.assign(tris.map((t) => ({ P: t.v.map((i) => B.verts[i]), poly: t.poly })), { still: true })];
    for (const pose of posesOf(rig.who)) {
      if (BENT.includes(pose.$clip.split(' ')[0])) continue;
      const f = posed(rig, pose), P = skin(rig, f), h = f[rig.at.get('head')];
      // (a posed point back in the head's rest frame: the head's turn undone, S its rotation)
      const back = (q) => { const d = sub(q, h.P); return add(hb.head, [0, 1, 2].map((r) => h.S[r] * d[0] + h.S[3 + r] * d[1] + h.S[6 + r] * d[2])); };
      const near = tris.filter((t) => t.v.some((i) => P[i][1] > h.P[1] - 3));
      sets.push(Object.assign(near.map((t) => ({ P: t.v.map((i) => back(P[i])), poly: t.poly })), { still: pose.$clip.startsWith('idle ') }));
    }
    TORSO.set(rig.who, sets);
  }
  let top = -Infinity;
  for (const T of TORSO.get(rig.who)) { if (still && !T.still) continue; const h = farHit(T, [x, -20, z], [0, 1, 0]); if (h.t > 0) top = Math.max(top, -20 + h.t); }
  return top;
}

/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}

/** A border's path over the skull (her left), at a in [0, 1]: its directions at the style's capRows (shares of its
 * length), the parting's first. */
function pathOf(S, a) {
  const K = S.keys, j = Math.max(0, Math.min(K.length - 2, K.findIndex((k, i) => i + 1 < K.length && a <= K[i + 1].a)));
  const k0 = K[j], k1 = K[j + 1], t = (a - k0.a) / (k1.a - k0.a);
  const ctrl = k0.pts.map((p, i) => unit(lerp(dirOf(...p), dirOf(...k1.pts[i]), t)));
  // (sampled finely, then at even shares of the arc's length)
  const fine = Array.from({ length: 121 }, (_, i) => unit(spline(ctrl, i / 120)));
  const len = [0];
  for (let i = 1; i < fine.length; i++) len.push(len[i - 1] + Math.acos(Math.min(1, dot(fine[i - 1], fine[i]))));
  return S.capRows.map((f) => {
    const L = f * len.at(-1); let i = 1; while (i < len.length - 1 && len[i] < L) i++;
    const u = (L - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
    return unit(lerp(fine[i - 1], fine[i], Math.min(1, Math.max(0, u))));
  });
}

/**
 * The warrior cut on a body: { verts, polys: [{ v, piece, valley?, hang? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid }.
 */
export function buildWarrior(rig, style = WARRIOR, { clear = true } = {}) {
  const S = style, B = rig.B, { C, body, polyAt } = radiiOf(rig);
  // the columns, her left: the front edge, then per lock its first border's crease edge, its ridge, its last border's
  const half = [{ a: 0, kind: 'edge', lock: 0 }];
  for (let i = 0; i + 1 < S.locks.length; i++) {
    const a0 = S.locks[i], a1 = S.locks[i + 1];
    if (i > 0) half.push({ a: a0 + S.crease, kind: 'border', lock: i });
    half.push({ a: (a0 + a1) / 2, kind: 'ridge', lock: i });
    half.push({ a: a1 - S.crease, kind: 'border', lock: i, crease: true });
  }
  // both sides: her right (x mirrored) from its front edge back, then her left from the back to its front edge
  const cols = [...half.map((c) => ({ ...c, side: -1 })), ...half.slice().reverse().map((c) => ({ ...c, side: 1 }))];
  // (the strip from a column to the next a border's valley: between a lock's last border and the next lock's first,
  // either side, and across the back's middle)
  for (let j = 0; j + 1 < cols.length; j++) {
    const c = cols[j], n = cols[j + 1];
    c.creaseNext = (c.side < 0 && n.side < 0 && c.crease === true) || (c.side < 0 && n.side > 0) || (c.side > 0 && n.side > 0 && c.kind === 'border' && !c.crease && n.crease === true);
  }
  const nc = cols.length;
  const mirror = (d, s) => [d[0] * s, d[1], d[2]];
  // each column's path over the skull, its outside's height off the skin there
  const KC =S.capRows.length, KH = S.hangRows.length;
  const paths = cols.map((c) => pathOf(S, c.a).map((d) => mirror(d, c.side)));
  const capOut = (c, d, i) => {
    const f = S.capRows[i], rb = body(d);
    let t = S.partThick + (S.capThick - S.partThick) * Math.min(1, f * 1.6);
    if (c.kind === 'edge' && i > 0) { const [th] = angOf(d); t = S.edgeThick[0] + (S.edgeThick[1] - S.edgeThick[0]) * ramp(Math.abs(th), 20, 70); }
    return rb + Math.max(S.minThick, t + capRel(c, i));
  };
  // (a lock's relief over the skull: none on the parting, its full share from halfway down)
  const capRel = (c, i) => (i === 0 ? 0 : S.relief * S.capRelief * (c.kind === 'ridge' ? 1 : -0.6) * Math.min(1, 2 * S.capRows[i]));
  // how far into the face (in front of the temples, below the forehead's hairline), the ears or down the nape a skin
  // point is: 0 the scalp, 1 off it
  const hairline = B.verts[B.index.get('t0')][1] - S.hairlineDrop;
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  // (the ears, the neck, and skin that moves with the neck, or within S.offScalp degrees of them: not the scalp, which
  // is rigid on the head; the inside rises off the skin over the scalp, never over them)
  const offScalp = (pl) => pl && (pl.ear || pl.part === 'neck' || !pl.v.every(rigid));
  const notScalp = (d, rb) => {
    const p = add(C, mul(d, rb)), [th, ph] = angOf(d), e = S.offScalp;
    for (const [a, b] of [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]]) if (offScalp(B.polys[polyAt(dirOf(th + a, ph + b))])) return 1;
    return Math.max(ramp(p[2] - C[2], 0.05, 0.3) * ramp(hairline - p[1], 0, 0.08), ramp(C[1] - 0.35 - p[1], 0, 0.15));
  };
  const outer = [], inner = [], hang = [];
  // over the skull
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = [], n = [];
    // (the front edge's inside off the skin by lip all along it, not only at its corners: each corner raised until the
    // straight edges either side of it clear the skin under them)
    const edgeLift = (i) => {
      let need = 0;
      for (const k of [i - 1, i + 1]) {
        if (k < 0 || k >= KC) continue;
        for (let t = 0; t <= 1; t += 0.1) { const m = lerp(paths[j][i], paths[j][k], t); need = Math.max(need, (body(unit(m)) + S.lip) / Math.hypot(...m)); }
      }
      return need;
    };
    for (let i = 0; i < KC; i++) {
      const d = paths[j][i], rb = body(d), f = notScalp(d, rb);
      let rr = capOut(c, d, i), ri = rb - S.sink + (S.sink + S.capClear) * f;
      if (c.kind === 'edge') { ri = Math.max(ri, rb + S.lip, edgeLift(i)); rr = Math.max(rr, ri + S.minThick); }
      ri = Math.min(ri, rr - S.minThick * 0.5);
      o.push(add(C, mul(d, rr))); n.push(add(C, mul(d, ri)));
    }
    // (the hair falls from its widest: the last cap rows' greatest distance from the upright axis, the drop's own moved
    // out to it)
    const D = o[KC - 1], h0 = [D[0] - C[0], D[2] - C[2]], hu = [h0[0] / Math.hypot(...h0), h0[1] / Math.hypot(...h0)];
    const hl = Math.max(...o.slice(KC - 3).map((p) => (p[0] - C[0]) * hu[0] + (p[2] - C[2]) * hu[1]));
    { const h = h0[0] * hu[0] + h0[1] * hu[1]; o[KC - 1] = [D[0] + hu[0] * (hl - h), D[1], D[2] + hu[1] * (hl - h)]; }
    outer.push(o); inner.push(n); hang.push({ D: o[KC - 1], hu, hl: hl - capRel(c, KC - 1) });
  }
  // the hem: level, hemAbove over the torso's top under the hanging hair's ends (outside and inside) at rest and in the
  // idle, the back's (the locks from hemFrom on); the side's, nearer the neck where the shoulders rise, and wherever
  // they rise higher in another clip (the swing's), raised over them (below)
  const relOf = (c, last) => S.relief * (c.kind === 'ridge' ? 1 : -0.6) * (last ? 0.3 : 1);
  let hemY = -Infinity;
  hang.forEach(({ hu, hl }, j) => {
    if (cols[j].a < S.hemFrom) return;
    const R0 = hl * (1 + S.flare) + relOf(cols[j], true);
    for (const r of [R0, R0 - S.thick]) hemY = Math.max(hemY, torsoTop(rig, C[0] + hu[0] * r, C[2] + hu[1] * r, true));
  });
  hemY += S.hemAbove;
  // straight down from the drop to the hem: the widest's distance from the upright axis, flaring a little; a lock's
  // ridge out and its borders in; each lock's tip lower and thinner
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = outer[j], n = inner[j], { D, hu, hl } = hang[j];
    const tipK = 1 + S.tipVar * (hash(c.lock + 1, c.side) - 0.5) * 2;
    for (let i = 0; i < KH; i++) {
      const s = S.hangRows[i], last = i === KH - 1;
      let y = D[1] + (hemY - D[1]) * s;
      if (last) y += c.kind === 'ridge' ? -S.tipLen * tipK : c.kind === 'border' ? S.notch : 0;
      const th = last ? S.tipThick : S.thick * (1 - 0.35 * s);
      let R0 = hl * (1 + S.flare * s) + relOf(c, last);
      // (the inside: a thickness in toward the upright axis, kept off the skin; the outside a least thickness outside it)
      let pi = [C[0] + hu[0] * (R0 - th), y, C[2] + hu[1] * (R0 - th)];
      const v = sub(pi, C), lv = Math.hypot(...v), dv = mul(v, 1 / lv), rb = body(dv);
      if (lv < rb + S.clear) pi = add(C, mul(dv, rb + S.clear));
      R0 = Math.max(R0, (pi[0] - C[0]) * hu[0] + (pi[2] - C[2]) * hu[1] + S.minThick * 0.5);
      let po = [C[0] + hu[0] * R0, y, C[2] + hu[1] * R0];
      // (the hanging hair no nearer the shoulders under it, in any clip, than tipClear; a row raised so stays
      // tipClear over the one under it)
      if (i >= KH - 2) {
        const lo = Math.max(torsoTop(rig, po[0], po[2]), torsoTop(rig, pi[0], pi[2])) + S.tipClear * (last ? 1 : 2);
        if (lo > y) { po = [po[0], lo, po[2]]; pi = [pi[0], lo, pi[2]]; }
      }
      o.push(po); n.push(pi);
    }
  }
  // the mesh: the parting's corners shared by the two sides (each border's first corner is on the middle line)
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const partO = new Map(), partI = new Map();
  const key = (a) => a.toFixed(5);
  const oi = outer.map((col, j) => col.map((p, i) => (i ? V(p) : partO.get(key(cols[j].a)) ?? (partO.set(key(cols[j].a), V(p)), partO.get(key(cols[j].a))))));
  const ii = inner.map((col, j) => col.map((p, i) => (i ? V(p) : partI.get(key(cols[j].a)) ?? (partI.set(key(cols[j].a), V(p)), partI.get(key(cols[j].a))))));
  const NR = KC + KH;
  const poly = (v, sh = {}) => { const u = v.filter((x, k) => x !== v[(k + 1) % v.length]); if (u.length >= 3) polys.push({ v: u, piece: 0, ...sh }); };
  for (let j = 0; j + 1 < nc; j++) {
    const k = j + 1, crease = cols[j].creaseNext ? { valley: S.creaseShade } : {};
    for (let i = 0; i + 1 < NR; i++) {
      const hang = i >= KC - 1 ? { hang: true } : {};
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], { ...(i === 0 && Math.max(cols[j].a, cols[k].a) <= S.partTo ? { valley: S.partShade } : i === 0 ? {} : crease), ...hang });
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade, inside: true, row: i, ...hang });
    }
    // the hem's rim
    poly([oi[j][NR - 1], oi[k][NR - 1], ii[k][NR - 1], ii[j][NR - 1]], { valley: S.rimShade, rim: true, hang: true });
  }
  // the front edges' rims, her right's and her left's
  for (const j of [0, nc - 1]) for (let i = 0; i + 1 < NR; i++) {
    const q = [oi[j][i], oi[j][i + 1], ii[j][i + 1], ii[j][i]];
    poly(j === 0 ? q : q.slice().reverse(), { valley: S.rimShade, rim: true, ...(i >= KC - 1 ? { hang: true } : {}) });
  }
  // orientation: outward on the outside (turned if the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  for (const p of polys) if (!p.valley) delete p.valley;
  coverSkin(B, C, verts, polys, S.cover);
  const tris = trisOf(verts, polys);
  const pieces = [{ id: 'warrior', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, centre: C, k: 1, hemY, grid: { cols, outer: oi, inner: ii } };
  // (the head's polygons drawn shaved: those the cap covers whole; those it covers any of, the scalp its inside may sink
  // into, left out of the crossings, whose outside is checked against every polygon of the skin, outsideCrossings)
  hair.shave = scalpOf(B, C, hair, 'every', (p) => !p.hang);
  hair.scalp = scalpOf(B, C, hair, 'some', (p) => !p.rim);
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/**
 * The cap's outside over the head's skin (the skull is a few large flat polygons; the cap's faces, a few corners apart,
 * cut under its convex creases): a corner of the skin (not the ears') under the cap and within `margin` of its outside
 * (or through it) moves the outside's face there out along its corners' rays, until none is.
 */
function coverSkin(B, C, verts, polys, margin) {
  // (its corners, and points along its triangles' edges and inside them: a crease between two corners pokes through too)
  const skinV = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly]; if (p.part !== 'head' || p.mat !== 'skin' || p.ear) continue;
    const [a, b, c] = t.v.map((i) => B.verts[i]);
    // (a point every 0.03 or so over the triangle)
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b))) / 0.03));
    for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) skinV.push(add(a, add(mul(sub(b, a), i / n), mul(sub(c, a), j / n))));
  }
  const cap = polys.filter((p) => !p.inside && !p.rim && !p.hang);
  for (let it = 0; it < 30; it++) {
    const T = trisOf(verts, cap).map(([a, b, c]) => ({ P: [verts[a], verts[b], verts[c]], poly: [a, b, c] }));
    const push = new Map();
    for (const v of skinV) {
      const w = sub(v, C), rv = Math.hypot(...w), h = farHit(T, C, mul(w, 1 / rv));
      if (h.t > 0 && h.t < rv + margin) for (const i of h.poly) push.set(i, Math.max(push.get(i) ?? 0, rv + margin - h.t));
    }
    if (!push.size) break;
    for (const [i, by] of push) { const w = sub(verts[i], C), l = Math.hypot(...w); verts[i] = add(C, mul(w, (l + by + 0.002) / l)); }
  }
}

/** Each polygon's triangles, the quad's shorter diagonal (a lock's plane folds along its length). */
function trisOf(verts, polys) {
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    const [a, b, c, d] = p.v;
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  return tris;
}

/** The head's skin polygons (not the ears) under the hair's polygons that pass `keep`, seen from the skull's middle:
 * with `every` corner under it, or `some`. */
function scalpOf(B, C, hair, how, keep) {
  const T = hair.tris.filter(([, , , pi]) => keep(hair.polys[pi])).map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]], poly: 0 })), memo = new Map();
  const under = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v[how](under)) out.push(i); });
  return out;
}

/** The hair's outside (and its rims) through any of the skin's polygons, the scalp's too (what would show): the count,
 * and per hair polygon the skin polygon it crosses. */
export function outsideCrossings(rig, hair, P = rig.B.verts, H = hair.verts) {
  return crossings(rig, { ...hair, scalp: [], polys: hair.polys.map((p) => (p.inside ? { ...p, buzz: true } : p)) }, P, H);
}

/**
 * The hair clear of the body at rest and in the game's clips' poses (tools/sculpt/hairs/warrior-poses-<who>.json): a face
 * of it through the skin that is not the scalp it covers has its corners moved out `step` at a time (from the skull's
 * middle; below levelBelow, level out from the head's upright axis; through the shoulders, raised), an inner corner's
 * outer one with it so the shell keeps its least thickness, until none is.
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, grid } = hair, C = hair.centre, mate = new Map();
  grid.inner.forEach((col, j) => col.forEach((v, i) => { if (v !== grid.outer[j][i]) mate.set(v, grid.outer[j][i]); }));
  const poses = posesOf(rig.who);
  const states = [{ P: rig.B.verts, f: null, clip: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  // (each round only the states that had crossings the round before; when none has, every state again)
  let live = states;
  for (let it = 0; it < 120; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat();
    const out = (p) => { const d = sub(p, C); return unit(p[1] < C[1] - S.levelBelow ? [d[0], 0, d[2]] : d); };
    const up = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'torso').flatMap(([hp]) => hair.polys[hp].v));
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
      const d = up.has(v) ? [0, 1, 0] : out(verts[v]);
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) {
        const gap = dot(sub(verts[o], verts[v]), d);
        if (gap < S.minThick * 0.5) verts[o] = add(verts[o], mul(d, S.minThick * 0.5 - gap));
      }
    }
  }
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.cleared = crossings(rig, hair, rig.B.verts, verts).n;
  return hair;
}

/** The warrior cut on a body, as the game takes it. */
export const warriorOf = (rig, style = WARRIOR) => buildWarrior(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = warriorOf(rig);
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'hem y', hair.hemY.toFixed(3), 'cleared in', JSON.stringify(hair.clearedIn?.reduce((a, x) => a + x, 0)), 'ms', Date.now() - t0);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
