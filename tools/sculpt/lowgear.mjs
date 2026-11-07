// Equipment for the low-poly bodies (tools/sculpt/lowarm.mjs buildArmBody, rigged by tools/sculpt/lowrig.mjs): the shared
// machinery a gear builder (tools/sculpt/gear/*.mjs) uses to make a rigid prop, put it in a hand and draw it.
//
//   the mesh: vertices and polygons with a material each (meshOf), cut into triangles by ear clipping (trisOf: a polygon
//   off its plane by more than a hair is drawn a triangle at a time, so each triangle is its own facet);
//   the game's scale: each body's mesh units to the figure's (gameScale, as src/sculpt/lowpoly.ts scale(): the base man's
//   height from src/sculpt/rig.ts heightOf, hers WOMAN_OF_MAN of his), so a prop made in game units is one size on both;
//   the hand socket (socketOf): a frame on the hand bone at the palm, where a grip of a given radius sits when the fist
//   closes on it: its y along the grip toward the thumb, its x along the hand toward the knuckles, its z out of the back
//   of the hand's thumb side; fistOn curls the fingers and the thumb onto the grip (the rig's finger bones); reach poses
//   one arm so its socket meets a frame (clavicle fixed: upper arm, forearm, hand, by descent on their turns);
//   heldBy places a prop's points by a socket on a posed rig (rigid on the hand bone), or by any bone and a rest frame.
//   the drawing: shoot() draws cells of meshes (a body, a prop) flat-shaded, one colour a polygon, by the review renders'
//   light (tools/sculpt/lowlight-<who>.json), skin as the bodies' review renders, everything else its material's colour
//   scaled by the light's brightness at that facet; emissive materials unlit, glow polygons added over the rest.
//
// Units and axes are the body's: y up, z forward, x the body's left. A prop is made in game units in its own frame and
// scaled by 1 / gameScale(who) onto a body.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { add, sub, mul, dot, cross, unit, mm, mv, tr, posed, euler } from './lowrig.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const REPO = resolve(DIR, '../..');

/* ---- the mesh ------------------------------------------------------------------------------------------------------ */
/** A mesh to build: V (points), F ({ v: indices, mat }), with p(point) -> index and f(indices, mat, out?) -> face. */
export function meshOf() {
  const G = { V: [], F: [] };
  G.p = (q) => { G.V.push([...q]); return G.V.length - 1; };
  /** A face; with `out` (a direction, or a point the face looks away from: { from }), turned to face that way. */
  G.f = (v, mat, out = null) => {
    let vs = [...v];
    if (out) {
      const n = newell(G.V, vs), c = centroid(G.V, vs);
      const d = out.from ? sub(c, out.from) : out;
      if (dot(n, d) < 0) vs.reverse();
    }
    G.F.push({ v: vs, mat });
    return G.F.length - 1;
  };
  return G;
}
export const newell = (V, v) => { let n = [0, 0, 0]; for (let i = 0; i < v.length; i++) { const a = V[v[i]], b = V[v[(i + 1) % v.length]]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; } return n; };
export const centroid = (V, v) => mul(v.reduce((s, i) => add(s, V[i]), [0, 0, 0]), 1 / v.length);

/** Ear clipping of one polygon (indices into V), in the plane of its normal; collinear corners are dropped first. */
function clip(V, v) {
  const n = unit(newell(V, v));
  const ax = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0], u = unit(cross(ax, n)), w = cross(n, u);
  const P = new Map(v.map((i) => [i, [dot(V[i], u), dot(V[i], w)]]));
  const cr = (a, b, c) => { const A = P.get(a), B = P.get(b), C = P.get(c); return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); };
  let ring = [...v];
  const scale = Math.max(1e-9, ...ring.map((i) => Math.hypot(...P.get(i))));
  const eps = 1e-7 * scale * scale;
  // drop collinear corners
  for (let again = true; again && ring.length > 3;) {
    again = false;
    for (let k = 0; k < ring.length; k++) { const a = ring[(k + ring.length - 1) % ring.length], b = ring[k], c = ring[(k + 1) % ring.length]; if (Math.abs(cr(a, b, c)) < eps) { ring.splice(k, 1); again = true; break; } }
  }
  const out = [];
  let guard = 0;
  while (ring.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[(k + ring.length - 1) % ring.length], b = ring[k], c = ring[(k + 1) % ring.length];
      if (cr(a, b, c) <= eps) continue;
      const inside = ring.some((d) => d !== a && d !== b && d !== c && cr(a, b, d) >= -eps && cr(b, c, d) >= -eps && cr(c, a, d) >= -eps);
      if (inside) continue;
      out.push([a, b, c]); ring.splice(k, 1); cut = true; break;
    }
    if (!cut) { for (let k = 1; k + 1 < ring.length; k++) out.push([ring[0], ring[k], ring[k + 1]]); ring = []; break; }
  }
  if (ring.length === 3) out.push(ring);
  return out;
}

/**
 * The mesh's triangles: [{ v: [a, b, c], face, n }] with each a normal: its face's (Newell) when the face lies in one plane
 * (within `tol` of its size), its own otherwise.
 */
export function trisOf(G, tol = 0.02) {
  const out = [];
  G.F.forEach((f, fi) => {
    const n = unit(newell(G.V, f.v)), c = centroid(G.V, f.v);
    const size = Math.max(1e-9, ...f.v.map((i) => Math.hypot(...sub(G.V[i], c))));
    const flat = f.v.every((i) => Math.abs(dot(sub(G.V[i], c), n)) <= tol * size);
    const ts = f.v.length === 3 ? [f.v] : clip(G.V, f.v);
    for (const t of ts) {
      const tn = unit(cross(sub(G.V[t[1]], G.V[t[0]]), sub(G.V[t[2]], G.V[t[0]])));
      // keep each triangle wound as its face is
      const tt = dot(tn, n) < 0 ? [t[0], t[2], t[1]] : t;
      out.push({ v: tt, face: fi, n: flat ? n : (dot(tn, n) < 0 ? mul(tn, -1) : tn) });
    }
  });
  return out;
}

/* ---- the game's scale ------------------------------------------------------------------------------------------------ */
let GAME = null;
/** The figure's numbers, bundled from the game's TypeScript: the base man's height and her share of it. */
export async function gameNumbers(tmp = join(REPO, 'tmp/lowgear')) {
  if (GAME) return GAME;
  const { buildSync } = await import('esbuild');
  mkdirSync(tmp, { recursive: true });
  const file = resolve(tmp, 'game-scale.mjs');
  buildSync({ stdin: { contents: "import { heightOf } from './src/sculpt/rig';\nimport { humanProportions } from './src/sculpt/human';\nexport { WOMAN_OF_MAN } from './src/sculpt/lowpoly';\nexport const MAN = heightOf(humanProportions(0));", resolveDir: REPO, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: file, logLevel: 'error', loader: { '.json': 'json' } });
  const g = await import(file);
  GAME = { man: g.MAN, womanOfMan: g.WOMAN_OF_MAN };
  return GAME;
}
/** A body's height in game units (sole to crown, standing at rest) and its mesh units to game units, as lowpoly.ts scale(). */
export async function gameScale(rig) {
  const g = await gameNumbers();
  let top = -Infinity; for (const p of rig.B.verts) top = Math.max(top, p[1]);
  const mesh = top - rig.J.floor, height = g.man * (rig.who === 'female' ? g.womanOfMan : 1);
  return { height, mesh, scale: height / mesh };
}

/* ---- the hand socket --------------------------------------------------------------------------------------------- */
const colOf = (m, k) => [m[k], m[3 + k], m[6 + k]];
const cols = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];

/**
 * The socket of one hand (side 'l' or 'r') at rest, for a grip of radius r (mesh units): { o (the grip's axis at the fist's
 * middle), R (columns: x along the hand toward the knuckles, y along the grip toward the thumb, z = x × y), bone }. The
 * grip lies across the palm against the finger roots: its axis a third of the way back from the knuckle line toward the
 * wrist, out from the palm by the palm's own depth there plus r, square across the hand (its bend axis).
 */
export function socketOf(rig, side, r, o = {}) {
  const { bones, at, B } = rig;
  const hb = bones[at.get(`hand_${side}`)], th = bones[at.get(`thumb_01_${side}`)];
  const W = hb.head, K = hb.tail, along = unit(sub(K, W)), across = colOf(hb.R, 0);
  // the palm's normal: the bone's flex direction, square to the hand
  let palm = unit(sub(hb.flex, mul(along, dot(hb.flex, along))));
  // toward the thumb along the bend axis
  const thumbWay = dot(sub(th.tail, W), across) > 0 ? 1 : -1, y = mul(across, thumbWay);
  const back = o.back ?? 0.3;
  const c = add(K, mul(sub(W, K), back));
  // the palm's depth: the hand's vertices near c on the palm's side
  let depth = 0;
  B.verts.forEach((p, i) => {
    const w = rig.vw[i].find(([bi]) => bi === at.get(`hand_${side}`) || bi === at.get(`knuckles_${side}`));
    if (!w || w[1] < 0.3) return;
    const d = sub(p, c);
    if (Math.abs(dot(d, along)) > 0.12) return;
    depth = Math.max(depth, dot(d, palm));
  });
  const origin = add(c, mul(palm, depth + r * (o.press ?? 1)));
  // the frame: x along the hand, y along the grip; tilted about the palm's normal by `tilt` (the grip runs from the heel of
  // the hand on the little finger's side to the index's root)
  const t = (o.tilt ?? 0) * Math.PI / 180;
  const yy = unit(add(mul(y, Math.cos(t)), mul(along, Math.sin(t))));
  const xx = unit(sub(along, mul(yy, dot(along, yy))));
  return { side, r, o: origin, R: cols(xx, yy, cross(xx, yy)), bone: at.get(`hand_${side}`), palm, depth };
}

/** A rest-space point or frame carried by a bone in a pose (rigid). */
export const carried = (rig, frames, bi, p) => add(mv(frames[bi].S, sub(p, rig.bones[bi].head)), frames[bi].P);
/** The socket's frame in a pose: { o, R }. */
export function socketAt(rig, frames, s) { const f = frames[s.bone]; return { o: carried(rig, frames, s.bone, s.o), R: mm(f.S, s.R) }; }

/**
 * The fingers and thumb of one side curled onto the grip of the socket (in the pose so far): each finger bone's flex
 * chosen so its tip and its middle joint lie on the grip's surface grown by the finger's half depth `fd`, the thumb
 * closed over it the same way. Returns the pose with those bones set.
 */
export function fistOn(rig, pose, s, fd) {
  const { bones, at } = rig;
  const tipOf = (F, name) => { const i = at.get(name), b = bones[i]; return add(mv(F[i].S, sub(b.tail, b.head)), F[i].P); };
  const err = (p, sk) => {
    const F = posed(rig, p), S = socketAt(rig, F, s), ax = colOf(S.R, 1);
    const dist = (q) => { const d = sub(q, S.o); return Math.hypot(...sub(d, mul(ax, dot(d, ax)))); };
    const want = s.r + fd;
    return sk.reduce((e, n) => { const q = n === 'mid' ? F[at.get(`fingers_02_${s.side}`)].P : n === 'tip' ? tipOf(F, `fingers_02_${s.side}`) : n === 'ttip' ? tipOf(F, `thumb_03_${s.side}`) : F[at.get(`thumb_03_${s.side}`)].P; const d = dist(q) - want; return e + d * d * (d < 0 ? 4 : 1); }, 0);
  };
  const out = { ...pose };
  const best = (names, keys, lo, hi, step) => {
    let bestE = Infinity, bestV = null;
    const grid = (k, cur) => {
      if (k === names.length) { const p = { ...out }; names.forEach((n, j) => { p[n] = [cur[j], 0, 0]; }); const e = err(p, keys); if (e < bestE) { bestE = e; bestV = [...cur]; } return; }
      for (let a = lo; a <= hi; a += step) grid(k + 1, [...cur, a]);
    };
    grid(0, []);
    names.forEach((n, j) => { out[n] = [bestV[j], 0, 0]; });
    return bestE;
  };
  best([`fingers_01_${s.side}`, `fingers_02_${s.side}`], ['mid', 'tip'], 0, 120, 6);
  best([`thumb_01_${s.side}`, `thumb_02_${s.side}`, `thumb_03_${s.side}`], ['tjoint', 'ttip'], -10, 60, 10);
  return out;
}

/**
 * One arm posed so its socket meets a target frame { o, R } (rest-space axes as the socket's): the upper arm's, the
 * forearm's and the hand's turns found by descent from the pose given, the elbow bent forward only, each bone kept in
 * its range. wPos weighs the distance (mesh units) against the turn (radians). Returns { pose, err }.
 */
export function reach(rig, pose, s, target, o = {}) {
  const side = s.side;
  const keys = [[`upperarm_${side}`, 0], [`upperarm_${side}`, 1], [`upperarm_${side}`, 2], [`lowerarm_${side}`, 0], [`hand_${side}`, 0], [`hand_${side}`, 1], [`hand_${side}`, 2], ...(o.clavicle ? [[`clavicle_${side}`, 0], [`clavicle_${side}`, 2]] : [])];
  // the ranges: the upper arm raised forward (+rx) or back, twisted, swung; the elbow bent forward only; the forearm's turn
  // (pronation) is the hand's own twist (ry), which the rig's twist helpers spread up the forearm
  const lim = { [`upperarm_${side}`]: [[-60, 170], [-90, 90], [-110, 110]], [`lowerarm_${side}`]: [[0, 150], [0, 0], [0, 0]], [`hand_${side}`]: [[-70, 70], [-110, 110], [-40, 40]], [`clavicle_${side}`]: [[-25, 25], [0, 0], [-25, 25]] };
  // from the pose given, and from the elbow bent and the arm raised forward, the better kept
  const starts = [{}, { [`upperarm_${side}`]: [30, 0, 0], [`lowerarm_${side}`]: [90, 0, 0] }, { [`upperarm_${side}`]: [60, 0, 0], [`lowerarm_${side}`]: [120, 0, 0], [`hand_${side}`]: [0, 60, 0] }, { [`upperarm_${side}`]: [10, 0, 0], [`lowerarm_${side}`]: [130, 0, 0], [`hand_${side}`]: [0, -60, 0] }];
  let best = null;
  for (const st of starts) {
    const r = descend({ ...pose, ...st });
    if (!best || r.e < best.e) best = r;
  }
  const cur = best.cur;
  const F = posed(rig, cur), S = socketAt(rig, F, s);
  return { pose: cur, cost: best.e, err: { pos: Math.hypot(...sub(S.o, target.o)), ang: [0, 1, 2].map((k) => Math.acos(Math.max(-1, Math.min(1, dot(colOf(S.R, k), colOf(target.R, k))))) * 180 / Math.PI) } };
  function descend(p0) {
  const cur = { ...p0 };
  for (const [b] of keys) cur[b] = Array.isArray(cur[b]) && cur[b].length === 3 ? [...cur[b]] : [0, 0, 0];
  const wPos = o.wPos ?? 4, wRot = o.wRot ?? 1;
  const cost = (p) => {
    const F = posed(rig, p), S = socketAt(rig, F, s);
    const dp = Math.hypot(...sub(S.o, target.o));
    let da = 0; for (const k of o.axes ?? [0, 1, 2]) da += 1 - dot(colOf(S.R, k), colOf(target.R, k));
    // the elbow kept out from the body
    let pen = 0;
    if (o.elbowOut) { const e = F[rig.at.get(`lowerarm_${side}`)].P; const want = o.elbowOut; pen += Math.max(0, (side === 'l' ? want - e[0] : e[0] + want)) ** 2 * 4; }
    return wPos * dp * dp + wRot * da + pen;
  };
  let e = cost(cur);
  for (let step = 24; step >= 0.4; step /= 2) {
    for (let it = 0; it < 30; it++) {
      let moved = false;
      for (const [b, k] of keys) {
        const [lo, hi] = lim[b][k];
        if (lo === hi) continue;
        for (const d of [step, -step]) {
          const t = { ...cur, [b]: [...cur[b]] };
          t[b][k] = Math.max(lo, Math.min(hi, t[b][k] + d));
          const te = cost(t);
          if (te < e - 1e-9) { e = te; Object.assign(cur, t); moved = true; }
        }
      }
      if (!moved) break;
    }
  }
  return { cur, e };
  }
}

/**
 * A prop's points (its own frame, game units) placed by a frame { o, R } on a body: scaled to the body's mesh units by
 * 1 / scale, its point `grip` (in its frame) put at o, its axes turned by R (prop x, y, z to R's columns).
 */
export function placed(V, frame, scale, grip = [0, 0, 0]) {
  return V.map((p) => add(frame.o, mv(frame.R, mul(sub(p, grip), 1 / scale))));
}

/* ---- the game's copy ---------------------------------------------------------------------------------------------- */
/**
 * A prop as the game loads it (src/sculpt/assets/<id>.json), rigid on one hand bone: its points (its own frame, game units),
 * its polygons (corners, material index; a face off its plane split into its triangles, so each polygon is one flat
 * facet as the bodies' are), its triangles [a, b, c, polygon], each point's glow alpha, the materials' colours and kinds
 * plain and enchanted (kind: 0 lit, 1 emissive, 2 glow: added, its alpha per corner), the polygons from `glowFrom` on
 * drawn only enchanted; its grip; and per body the hand sockets at rest (mesh units and axes, on the bone named) and the
 * body's mesh-to-game scale. A point p goes onto a body as o + R ((p - grip.lead) / scale) in the body's rest, skinned
 * wholly to the socket's bone (the body's own skinning then takes it to the figure's frame).
 */
export async function gearAsset(id, plain, lit, rigs) {
  const r5 = (x) => +x.toFixed(5);
  const G = lit.G, nPlain = plain.G.F.length;
  // the enchanted mesh is the plain one with the glow's faces after it
  if (plain.G.V.length > G.V.length || plain.G.F.some((f, i) => f.mat !== G.F[i].mat || f.v.join() !== G.F[i].v.join())) throw new Error('gearAsset: the enchanted mesh is not the plain one and its glow');
  const names = [...new Set(G.F.map((f) => f.mat))];
  const kind = (m) => (m.glow ? 2 : m.emit ? 1 : 0);
  const polys = [], tris = [];
  let glowFrom = -1;
  const T = trisOf(G);
  G.F.forEach((f, fi) => {
    if (fi === nPlain) glowFrom = polys.length;
    const ts = T.filter((t) => t.face === fi), flat = ts.every((t) => Math.abs(dot(t.n, unit(newell(G.V, f.v))) - 1) < 1e-6);
    if (flat) { const pi = polys.length; polys.push([f.v, names.indexOf(f.mat)]); for (const t of ts) tris.push(...t.v, pi); }
    else for (const t of ts) { const pi = polys.length; polys.push([t.v, names.indexOf(f.mat)]); tris.push(...t.v, pi); }
  });
  const sockets = {}, scale = {};
  for (const [who, rig] of Object.entries(rigs)) {
    const sc = await gameScale(rig);
    scale[who] = r5(sc.scale);
    sockets[who] = Object.fromEntries(['r', 'l'].map((side) => { const s = socketOf(rig, side, plain.grip.radius / sc.scale); return [side, { bone: rig.bones[s.bone].name, o: s.o.map(r5), R: s.R.map(r5) }]; }));
  }
  return {
    built: `node tools/sculpt/gear/${id}.mjs (tools/sculpt/lowgear.mjs gearAsset)`, id,
    units: 'game units; its own frame: y along it from the pommel\'s point (0) to the point, x across the flat, z out of the engraved face',
    length: r5(plain.L),
    verts: G.V.flat().map(r5), alpha: G.V.map((_, i) => r5(G.A?.[i] ?? 1)),
    polys, tris, glowFrom,
    mats: names,
    plain: names.map((n) => ({ c: plain.MATS[n].c, kind: kind(plain.MATS[n]) })),
    enchanted: names.map((n) => ({ c: lit.MATS[n].c, kind: kind(lit.MATS[n]) })),
    grip: Object.fromEntries(Object.entries(plain.grip).map(([k, v]) => [k, Array.isArray(v) ? v.map(r5) : r5(v)])),
    sockets, scale,
    socket: 'o: the grip\'s axis at the fist\'s middle, in the body\'s rest (mesh units and axes); R (row-major, columns x y z): x along the hand toward the knuckles, y along the grip toward the thumb, z = x × y. The prop\'s x, y, z go to R\'s columns, its grip.lead (or grip.second, for the other hand) to o.',
    counts: { tris: plain.tris, glowTris: lit.all - plain.tris, polys: polys.length },
  };
}

/* ---- materials ------------------------------------------------------------------------------------------------- */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/**
 * A material table: name -> { c: '#rrggbb', emit?: true (unlit), glow?: alpha (added over the rest, unlit, its corners'
 * alpha from the point's own `a` where given), skin?: 'male' | 'female' }.
 */
export const colourOf = (m) => hex(m.c);

/* ---- drawing ------------------------------------------------------------------------------------------------------- */
const LIGHT = Object.fromEntries(['male', 'female'].map((w) => {
  const C = JSON.parse(readFileSync(join(DIR, `lowlight-${w}.json`), 'utf8')).global, o = new Array(57).fill(0);
  for (let k = 0; k < C[0].length; k++) for (let ch = 0; ch < 3; ch++) o[k * 3 + ch] = C[ch][k] / 255;
  return [w, o];
}));

/**
 * One drawable: points P (any units, as the cell's camera), triangles (from trisOf, or the body's own), and per triangle
 * its colour and kind. kind: 0 lit (its colour scaled by the light's brightness), 1 skin by the male light, 2 skin by
 * the female light, 3 emissive, 4 glow (added, alpha per corner from `alpha`).
 */
export function drawable(P, tris, colOfTri, kindOfTri, alpha = null) {
  const a = [];
  tris.forEach((t, k) => {
    const n = t.n ?? unit(cross(sub(P[t.v[1]], P[t.v[0]]), sub(P[t.v[2]], P[t.v[0]])));
    const c = colOfTri(t, k), kind = kindOfTri(t, k);
    for (const i of t.v) a.push(+P[i][0].toFixed(5), +P[i][1].toFixed(5), +P[i][2].toFixed(5), +n[0].toFixed(4), +n[1].toFixed(4), +n[2].toFixed(4), +c[0].toFixed(3), +c[1].toFixed(3), +c[2].toFixed(3), kind, alpha ? +alpha[i].toFixed(3) : 1);
  });
  return a;
}
/** A mesh G (with trisOf) at points P, coloured by a material table, with each face's normal re-taken from P. */
export function gearDrawable(G, P, MATS, o = {}) {
  const T = trisOf(G).map((t) => {
    const f = G.F[t.face];
    const flatFace = t.n && unit(newell(G.V, f.v));
    // the normal in P: the face's (Newell, in P) when it was flat, the triangle's own otherwise
    const isFlat = flatFace && Math.abs(dot(flatFace, t.n) - 1) < 1e-6;
    const n = isFlat ? unit(newell(P, f.v)) : unit(cross(sub(P[t.v[1]], P[t.v[0]]), sub(P[t.v[2]], P[t.v[0]])));
    return { ...t, n };
  });
  const mat = (t) => MATS[G.F[t.face].mat] ?? { c: '#ff00ff' };
  const tone = (t) => { const m = mat(t); const c = colourOf(m); const j = m.vary ? 1 + m.vary * (((t.face * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 2 : 1; return c.map((x) => Math.min(1, x * j)); };
  return drawable(P, T, tone, (t) => { const m = mat(t); return m.glow ? 4 : m.emit ? 3 : 0; }, G.A ? G.V.map((_, i) => G.A[i] ?? 1) : null);
}
/** A body (a rig's B) at points P, its skin as its review renders. */
export function bodyDrawable(rig, P) {
  const B = rig.B, kind = rig.who === 'female' ? 2 : 1;
  const tris = B.tris.map((t) => ({ v: t.v, poly: t.poly }));
  const pn = B.polys.map((p) => unit(newell(P, p.nv ?? p.v)));
  const col = (t) => { const m = B.polys[t.poly].mat; return m === 'brow' || m === 'lid' ? [0.22, 0.15, 0.13] : m === 'pupil' ? [0.08, 0.06, 0.06] : [0.68, 0.49, 0.41]; };
  return drawable(P, tris.map((t) => ({ ...t, n: pn[t.poly] })), col, () => kind);
}
/** Edges of a mesh's faces at points P, for a wire overlay (flat [x, y, z, x, y, z, ...]). */
export function edgesOf(G, P) {
  const seen = new Set(), out = [];
  for (const f of G.F) for (let k = 0; k < f.v.length; k++) {
    const a = f.v[k], b = f.v[(k + 1) % f.v.length], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(key)) continue; seen.add(key); out.push(...P[a].map((x) => +x.toFixed(5)), ...P[b].map((x) => +x.toFixed(5)));
  }
  return out;
}
/** A triangle wire overlay: every triangle's edges. */
export function triEdgesOf(G, P) {
  const seen = new Set(), out = [];
  for (const t of trisOf(G)) for (let k = 0; k < 3; k++) {
    const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(key)) continue; seen.add(key); out.push(...P[a].map((x) => +x.toFixed(5)), ...P[b].map((x) => +x.toFixed(5)));
  }
  return out;
}

const PAGE = (w, h) => String.raw`<!doctype html><html><head><style>
html,body{margin:0;background:#2f292b}
#sheet{position:relative;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,Arial,sans-serif;color:#efe2d6;background:#3a3134}
canvas{position:absolute;left:0;top:0;width:${w}px;height:${h}px}
.lab{position:absolute;font-size:13px;color:#f1e6dc;white-space:nowrap;text-shadow:0 0 3px #000}
.sm{position:absolute;font-size:11px;color:#e4d6ca;white-space:pre;line-height:13px;text-shadow:0 0 3px #000}
.h{position:absolute;font-weight:600;font-size:20px;color:#f4dccb}
</style></head><body><div id=sheet><canvas id=gl></canvas><canvas id=ink></canvas><div id=ui></div></div></body></html>`;

const RENDER = String.raw`
const D = window.DATA, W = window.SW, Hh = window.SHH, dpr = window.devicePixelRatio;
const cv = document.getElementById('gl'); cv.width = W * dpr; cv.height = Hh * dpr;
const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
const vs = 'attribute vec3 p; attribute vec3 n; attribute vec3 col; attribute vec2 ka; uniform mat3 R; uniform vec3 piv; uniform float s; uniform float lift; uniform vec2 asp;' +
  ' varying vec3 vn; varying vec3 vc; varying vec2 vka;' +
  'void main(){ vec3 q = R*(p - piv); vn = R*n; vc = col; vka = ka; gl_Position = vec4(q.x*s*asp.x, q.y*s*asp.y, -q.z/60.0 - lift, 1.0); }';
const fs = 'precision highp float; varying vec3 vn; varying vec3 vc; varying vec2 vka; uniform int mode; uniform vec3 SHM[19]; uniform vec3 SHF[19]; uniform vec3 linec;' +
  'vec3 sh(vec3 C[19], vec3 nn){ float x = nn.x, y = nn.y, z = nn.z;' +
  ' return C[0] + C[1]*x + C[2]*y + C[3]*z + C[4]*x*y + C[5]*y*z + C[6]*(3.0*z*z-1.0) + C[7]*x*z + C[8]*(x*x-y*y)' +
  '   + C[9]*y*(3.0*x*x-y*y) + C[10]*x*y*z + C[11]*y*(5.0*z*z-1.0) + C[12]*z*(5.0*z*z-3.0) + C[13]*x*(5.0*z*z-1.0) + C[14]*z*(x*x-y*y) + C[15]*x*(x*x-3.0*y*y)' +
  '   + C[16]*pow(max(dot(nn, normalize(vec3(-0.95,0.25,-0.2))),0.0),8.0) + C[17]*max(-x,0.0)*pow(1.0-max(z,0.0),3.0) + C[18]*max(x,0.0)*pow(1.0-max(z,0.0),3.0); }' +
  'void main(){ if (mode == 2) { gl_FragColor = vec4(linec, 1.0); return; }' +
  ' float k = vka.x; vec3 nn = normalize(vn); if (!gl_FrontFacing) nn = -nn;' +
  ' if (k > 3.5) { gl_FragColor = vec4(vc * vka.y, 1.0); return; }' +
  ' if (k > 2.5) { gl_FragColor = vec4(vc, 1.0); return; }' +
  ' vec3 c;' +
  ' if (k > 1.5) c = sh(SHF, nn) * vc / vec3(0.68,0.49,0.41);' +
  ' else if (k > 0.5) c = sh(SHM, nn) * vc / vec3(0.68,0.49,0.41);' +
  ' else { vec3 l = sh(SHM, nn); float y = dot(l, vec3(0.299,0.587,0.114)) / dot(vec3(0.68,0.49,0.41), vec3(0.299,0.587,0.114)); c = vc * (0.18 + 0.82 * y); }' +
  ' gl_FragColor = vec4(min(c, 1.0), 1.0); }';
function shd(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram(); gl.attachShader(pr, shd(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, shd(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
const U = (n) => gl.getUniformLocation(pr, n);
const AL = { p: gl.getAttribLocation(pr, 'p'), n: gl.getAttribLocation(pr, 'n'), col: gl.getAttribLocation(pr, 'col'), ka: gl.getAttribLocation(pr, 'ka') };
gl.uniform3fv(U('SHM'), D.SHM); gl.uniform3fv(U('SHF'), D.SHF);
gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
gl.scissor(0, 0, W * dpr, Hh * dpr); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
const buf = gl.createBuffer();
const ink = document.getElementById('ink'); ink.width = W * dpr; ink.height = Hh * dpr; const ix = ink.getContext('2d');
/* an ink line round the silhouette (as the game inks a body): the cell's pixels that differ from its ground, grown by c.ink px */
function inkOf(c) {
  const [bx, by, bw, bh] = c.box.map((v) => Math.round(v * dpr)), px = new Uint8Array(bw * bh * 4);
  gl.readPixels(bx, Hh * dpr - by - bh, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const g = (c.bg ?? [0.27, 0.235, 0.245]).map((v) => Math.round(v * 255)), m = new Uint8Array(bw * bh);
  for (let i = 0; i < bw * bh; i++) m[i] = Math.abs(px[i * 4] - g[0]) + Math.abs(px[i * 4 + 1] - g[1]) + Math.abs(px[i * 4 + 2] - g[2]) > 6 ? 1 : 0;
  const r = Math.max(1, Math.round(c.ink * dpr)), img = ix.createImageData(bw, bh), col = c.inkc ?? [62, 44, 40];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (m[y * bw + x]) continue;
    let near = false;
    for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && dx * dx + dy * dy <= r * r + r && m[yy * bw + xx]) { near = true; break; } }
    if (near) { const o = ((bh - 1 - y) * bw + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255; }
  }
  ix.putImageData(img, bx, by);
}
function rotm(yaw, pitch, roll) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180, r = (roll ?? 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const Ry = [ca, 0, -sa, 0, 1, 0, sa, 0, ca], Rx = [1, 0, 0, 0, cb, sb, 0, -sb, cb], Rz = [Math.cos(r), -Math.sin(r), 0, Math.sin(r), Math.cos(r), 0, 0, 0, 1];
  const mul3 = (A, B) => { const m = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return m; };
  const m = mul3(Rz, mul3(Rx, Ry));
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
function attribs(stride) {
  for (const k of [AL.p, AL.n, AL.col, AL.ka]) gl.enableVertexAttribArray(k);
  gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 44, 0); gl.vertexAttribPointer(AL.n, 3, gl.FLOAT, false, 44, 12); gl.vertexAttribPointer(AL.col, 3, gl.FLOAT, false, 44, 24); gl.vertexAttribPointer(AL.ka, 2, gl.FLOAT, false, 44, 36);
}
function draw(c) {
  const [bx, by, bw, bh] = c.box;
  gl.viewport(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr); gl.scissor(bx * dpr, (Hh - by - bh) * dpr, bw * dpr, bh * dpr);
  gl.clearColor(c.bg ? c.bg[0] : 0.27, c.bg ? c.bg[1] : 0.235, c.bg ? c.bg[2] : 0.245, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix3fv(U('R'), false, rotm(c.cam.yaw, c.cam.pitch ?? 0, c.cam.roll ?? 0)); gl.uniform3fv(U('piv'), c.cam.c); gl.uniform1f(U('s'), c.cam.s);
  gl.uniform2f(U('asp'), 2 / bw, 2 / bh); gl.uniform1f(U('lift'), 0);
  // opaque first, then glow added over it (no depth written)
  const all = [].concat(...c.items);
  const opaque = [], glow = [];
  for (let i = 0; i < all.length; i += 33) { const dst = all[i + 9] > 3.5 ? glow : opaque; for (let j = 0; j < 33; j++) dst.push(all[i + j]); }
  gl.uniform1i(U('mode'), 0);
  gl.disable(gl.BLEND); gl.depthMask(true);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(opaque), gl.DYNAMIC_DRAW); attribs(); gl.drawArrays(gl.TRIANGLES, 0, opaque.length / 11);
  if (c.ink) inkOf(c);
  if (glow.length) {
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glow), gl.DYNAMIC_DRAW); attribs(); gl.drawArrays(gl.TRIANGLES, 0, glow.length / 11);
    gl.disable(gl.BLEND); gl.depthMask(true);
  }
  for (const e of c.edges ?? []) {
    gl.uniform1i(U('mode'), 2); gl.disableVertexAttribArray(AL.n); gl.disableVertexAttribArray(AL.col); gl.disableVertexAttribArray(AL.ka); gl.uniform1f(U('lift'), e.lift ?? 0.002);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(e.lines), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(AL.p, 3, gl.FLOAT, false, 12, 0);
    gl.uniform3fv(U('linec'), e.c ?? [0.2, 1, 0.9]);
    if (e.over) gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.LINES, 0, e.lines.length / 3); gl.uniform1f(U('lift'), 0); gl.enable(gl.DEPTH_TEST);
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
/** Cells: { items: [drawable, ...], cam: { yaw, pitch, roll?, s (px per unit), c (the point at the centre) }, box, label, note, bg, edges: [{ lines, c, over }] }. */
export async function shoot(w, h, cells, file, texts = []) {
  browser ??= await chromium.launch({ ...(existsSync(kept) ? { executablePath: kept } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.setContent(PAGE(w, h));
  await p.evaluate(([d, C, ww, hh, tx]) => { window.DATA = d; window.CELLS = C; window.SW = ww; window.SHH = hh; window.TEXTS = tx; }, [{ SHM: LIGHT.male, SHF: LIGHT.female }, cells, w, h, texts]);
  await p.addScriptTag({ content: RENDER });
  await p.waitForFunction('window.READY', null, { timeout: 180000 });
  await p.locator('#sheet').screenshot({ path: file });
  console.log('wrote', file);
  await p.close();
}
export async function closeBrowser() { if (browser) await browser.close(); browser = null; }

export { euler, cols, colOf };
