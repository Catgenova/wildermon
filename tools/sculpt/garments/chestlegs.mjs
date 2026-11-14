// The legs pieces' triangles under each chest piece, left out while that chest is worn over them (src/sculpt/lowpoly.ts
// GARMENTS' `chest` and `legs`), so nothing of the trousers or the leggings is under the chest to come through it, as the
// body's own polygons under a garment are (`hides`). Triangles rather than polygons: a legs polygon from the waist to
// the thigh is cut at the chest's footprint.
//
// 1. At rest, a legs vertex is under a chest when, from its closest point on the body (the trunk, the hips or the legs),
//    the ray out along the body's normal there meets the chest within `reach` (not its glow, drawn only enchanted, nor
//    what it leaves out under a shawl, nor its sleeves, which hang beside the hips at rest and swing away from them), or
//    meets it before it reaches the vertex (the vertex stands out through the chest). (Stricter, with --margin, --up,
//    --down, --side: the same from the point lowered by `margin`, and the ray tilted up toward the camera, down under the
//    hem and to either side, all meeting the chest.) A legs triangle is under the chest when every corner is: the
//    waistband, the hips and the seat the chest covers, and whatever of the legs piece stood out through it there. The
//    hem lets the ray by, so the legs below it keep their look.
//    Less what the camera sees at rest in a gap of the chest (`gaps`): the legs seen between its plates, its panels or
//    its slits, neither crossing it nor standing out through it, are kept, as the body is seen there under the chest alone.
//    The body under what is left out, which the legs piece hides, is drawn again (`showOf`), as under the chest alone.
// 2. Then in the game's clips (`REFINE`: the idle, the walk, the one-handed fight, the overhead swing, kneeling at the
//    ground, the bench work, sat at the reins, the hop), the pair worn as the game wears it and skinned to the rig: where
//    the camera, from any of its eight facings, would see the body left out under what is worn (a hole through to nothing)
//    only because a legs triangle is left out, the nearest such triangle on that line of sight is kept, until none is.
//
//   node tools/sculpt/garments/chestlegs.mjs [--who male,female] [--reach 1] [--margin 0] [--up 0] [--down 0] [--side 0]
//       [--no-refine] [--chests plateChest,...] [--frames 1] [--out <file, {who} the body>]
//     (--chests: only those rows made again, the rest kept from the table; --frames: the clips' frames scaled, for a quick look)
//     writes src/sculpt/assets/lowchestlegs-<who>.json: { built, <chest>: { <legs>: { tris, drop, show } } } (CHESTS, LEGS),
//     each legs asset's triangle count (for a check that it was not rebuilt since), the triangles left out under that
//     chest and the body's polygons the legs piece hides drawn again there (`showOf`).
//
// The pairs as the game wears them, the clips' poses and the camera's sight are shared with tools/sculpt/lowchestlegscheck.mjs.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRig, posed, skin, ground } from '../lowrig.mjs';
import { closestOnBody, skinGarment, crossPairs, sub, add, mul, dot, cross, unit } from '../lowgarment.mjs';

const ROOT = new URL('../../..', import.meta.url).pathname;
/** The chest pieces and the legs pieces: their keys in the table (lowpoly.ts GARMENTS' `chest` and `legs`), their game assets' names. */
export const CHESTS = { tunic: 'lowtunic', leatherChest: 'lowleatherchest', plateChest: 'lowplatechest', chainChest: 'lowchainchest', scaleChest: 'lowscalechest' };
export const LEGS = { trousers: 'lowtrousers', leatherLegs: 'lowleatherlegs', leatherFlaps: 'lowleatherlegsflaps', plateLegs: 'lowplatelegs', chainLegs: 'lowchainlegs', scaleLegs: 'lowscalelegs' };
/** The items: each chest's key, and each legs item's garments as the game wears them under a chest (lowpoly.ts GARMENTS): [key, whether its `dropFrom` on is left out]. */
export const CHEST_ITEMS = { tunic: 'tunic', jerkin: 'leatherChest', breastplate: 'plateChest', hauberk: 'chainChest', cuirass: 'scaleChest' };
export const LEGS_ITEMS = {
  cloth: () => [['trousers', false]],
  // (the waist dropped under the leather chest and the hauberk; the hip flaps off under every chest but the tunic)
  leather: (chest) => (chest === 'leatherChest' || chest === 'chainChest' ? [['leatherLegs', true]] : chest === 'tunic' ? [['leatherLegs', false], ['leatherFlaps', false]] : [['leatherLegs', false]]),
  plate: () => [['plateLegs', false]],
  chain: () => [['chainLegs', false]],
  scale: (chest) => [['scaleLegs', chest === 'scaleChest']],
};
const TRUNK = new Set(['torso', 'pelvis', 'legs']);
const ASSETS = new Map();
export const assetOf = (name, who) => ASSETS.get(`${name}-${who}`) ?? ASSETS.set(`${name}-${who}`, JSON.parse(readFileSync(join(ROOT, `src/sculpt/assets/${name}-${who}.json`), 'utf8'))).get(`${name}-${who}`);
const ARM = /^(shoulder|upperarm|upperarm_twist|elbow|lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_[lr]$/;

/* ---- 1. at rest ---------------------------------------------------------------------------------------------------- */
/** The chest's triangles that count as covering (as above), binned in a grid of `cell`: `near(p)` the ones within `cell` of p. */
function chestGrid(rig, A, cell) {
  const end = Math.min(A.glowFrom ?? Infinity, A.dropFrom ?? Infinity), T = [];
  const nameOf = (b) => (b < A.base ? rig.bones[b].name : rig.bones[A.bones[b - A.base].from].name);
  const arm = A.weights.map((w) => { let b = -1, top = -1; for (let j = 0; j < w.length; j += 2) if (w[j + 1] > top) { top = w[j + 1]; b = w[j]; } return ARM.test(nameOf(b)); });
  for (let i = 0; i < A.tris.length; i += 4) {
    if (A.tris[i + 3] >= end || [0, 1, 2].some((k) => arm[A.tris[i + k]])) continue;
    T.push([0, 1, 2].map((k) => [A.verts[A.tris[i + k] * 3], A.verts[A.tris[i + k] * 3 + 1], A.verts[A.tris[i + k] * 3 + 2]]));
  }
  const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  T.forEach((t, k) => {
    const lo = [0, 1, 2].map((j) => Math.floor(Math.min(t[0][j], t[1][j], t[2][j]) / cell)), hi = [0, 1, 2].map((j) => Math.floor(Math.max(t[0][j], t[1][j], t[2][j]) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) (grid.get(key(x, y, z)) ?? grid.set(key(x, y, z), []).get(key(x, y, z))).push(k);
  });
  return (p) => {
    const c = p.map((x) => Math.floor(x / cell)), out = new Set();
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const k of grid.get(key(c[0] + x, c[1] + y, c[2] + z)) ?? []) out.add(k);
    return [...out].map((k) => T[k]);
  };
}
/** The distance along the ray o + t d to the first of T it meets past `from`, or Infinity. */
function rayHit(T, o, d, from = 1e-4) {
  let best = Infinity;
  for (const [a, b, c] of T) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, s = sub(o, a), u = f * dot(s, h); if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
    const t = f * dot(e2, q); if (t > from && t < best) best = t;
  }
  return best;
}

/** Each legs vertex's closest point on the body's trunk, hips and legs, and the body's normal there (its corners' blended). */
const POINTS = new Map();
export function bodyPoints(rig, L) {
  if (POINTS.has(L)) return POINTS.get(L);
  const { B } = rig, keep = B.tris.map((t) => t.v.every((i) => TRUNK.has(B.part[i])));
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const U = N.map(unit), out = [];
  for (let i = 0; i < L.verts.length; i += 3) {
    const c = closestOnBody(B.verts, B.tris, [L.verts[i], L.verts[i + 1], L.verts[i + 2]], keep), v = B.tris[c.tri].v;
    out.push({ q: c.q, n: unit(v.reduce((s, j, k) => add(s, mul(U[j], c.w[k])), [0, 0, 0])) });
  }
  POINTS.set(L, out);
  return out;
}

/** Per legs vertex, whether it stands out through the chest A at rest: the ray out from its body point (`P`) along the normal meets the chest, within `reach`, before it reaches the vertex. */
const THROUGH = new Map();
function through(rig, A, L, P, reach = 1) {
  if (THROUGH.has(A) && THROUGH.get(A).has(L)) return THROUGH.get(A).get(L);
  const near = chestGrid(rig, A, reach), out = P.map(({ q, n }, i) => { const v = [L.verts[i * 3], L.verts[i * 3 + 1], L.verts[i * 3 + 2]], t = rayHit(near(q), q, n); return t < reach && t < dot(sub(v, q), n); });
  if (!THROUGH.has(A)) THROUGH.set(A, new Map());
  THROUGH.get(A).set(L, out);
  return out;
}
/** The legs asset's triangles (their indices in its `tris`) under the chest asset A at rest (its vertices' body points `P`, as above: step 1). */
export function underChest(rig, A, L, P, { reach = 1, margin = 0, up = 0, down = 0, side = 0 } = {}) {
  const near = chestGrid(rig, A, reach);
  const covered = (o, n) => {
    const s = unit(cross(n, [0, 1, 0])), T = near(o);
    const rays = [n, ...(up ? [unit(add(n, [0, up, 0]))] : []), ...(down ? [unit(add(n, [0, -down, 0]))] : []), ...(side ? [unit(add(n, mul(s, side))), unit(sub(n, mul(s, side)))] : [])];
    return rays.every((d) => rayHit(T, o, d) < reach);
  };
  const outside = through(rig, A, L, P, reach);
  const under = P.map((b, i) => (covered(b.q, b.n) && (!margin || covered(add(b.q, [0, -margin, 0]), b.n))) || outside[i]);
  const out = [];
  for (let t = 0; t < L.tris.length; t += 4) if (under[L.tris[t]] && under[L.tris[t + 1]] && under[L.tris[t + 2]]) out.push(t / 4);
  return out;
}

/* ---- the clips, the pairs worn, the camera ------------------------------------------------------------------------- */
/** The game's clips (src/sculpt/anim), bundled for node. */
export async function loadAnim() {
  const { build } = await import('esbuild');
  const file = join(ROOT, 'tools/sculpt', `.chestlegs-anim-${process.pid}.mjs`);
  const LOADERS = { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' };
  writeFileSync(file, (await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: LOADERS, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text);
  try { return await import(pathToFileURL(file).href); } finally { rmSync(file); }
}
function clipPose(AN, rig, body, name, t) {
  const clip = AN.CLIPS[name], sk = AN.lowSkeleton(body);
  const r = AN.clipLocal(sk, clip, t, clip.grip ? AN.lowHeld(body) : undefined), pose = { $move: [0, 0, 0] };
  r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') pose[rig.bones[i].name] = m; });
  return pose;
}
/** The poses of a group: `n` times over its clip (offset `at` of a step: the check's frames fall between the refinement's). */
const SAMPLED = { idle: 'idle', walk: 'walk', fight: 'fight', kneel: 'ground', work: 'work', seat: 'seat-reins', hop: 'hop' };
export function posesOf(AN, rig, body, group, n, at = 0) {
  if (group === 'rest') return [{}];
  if (group === 'swing') {
    const keys = ['rest', 'drag', 'heave', 'top', 'strike', 'impact', 'follow-through'].map((k) => AN.CLIPS.swing.poses.find((p) => p.name === k).t + 1e-4);
    const L = AN.CLIPS.swing.length;
    return [...(at ? [] : keys), ...Array.from({ length: n }, (_, k) => ((k + at) / n) * L)].map((t) => clipPose(AN, rig, body, 'swing', t));
  }
  const name = SAMPLED[group];
  return Array.from({ length: n }, (_, k) => clipPose(AN, rig, body, name, ((k + at) / n) * AN.CLIPS[name].length));
}
/** The groups the refinement goes through, and how many frames of each. */
export const REFINE = { rest: 1, idle: 32, walk: 64, fight: 48, swing: 32, kneel: 48, work: 32, seat: 32, hop: 64 };

/**
 * A game asset (lowgarment.mjs garmentAsset) back as a garment the rig skins: its own bones as garmentBone's; its
 * triangles (not its glow, drawn only enchanted, nor those of the polygons `out` says) split into those drawn and those
 * left out under the chest (`under`, triangles' indices).
 */
export function garmentOf(rig, A, out = () => false, under = new Set()) {
  const verts = []; for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const tris = [], gone = [];
  for (let i = 0; i < A.tris.length; i += 4) {
    const pi = A.tris[i + 3], t = { v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]], poly: pi, tri: i / 4 };
    if ((A.glowFrom !== undefined && pi >= A.glowFrom) || out(pi)) continue;
    (under.has(i / 4) ? gone : tris).push(t);
  }
  const vw = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
  const bones = (A.bones ?? []).map(({ name: n, p, kind, head, R, from, drive, ...set }) => ({ name: n, parent: rig.bones[p].name, kind, head, R, driver: { from: rig.bones[from].name, kind: drive, ...set } }));
  return { verts, tris, gone, vw, bones, hides: A.hides ?? [] };
}
/** For each body vertex of a polygon the legs asset hides, the legs triangle nearest it at rest (its index in `tris`). */
const NEAR = new Map();
function nearTris(rig, who, k) {
  const id = `${k}-${who}`;
  if (NEAR.has(id)) return NEAR.get(id);
  const A = assetOf(LEGS[k], who), { B } = rig, P = [], T = [];
  for (let i = 0; i < A.verts.length; i += 3) P.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  for (let i = 0; i < A.tris.length; i += 4) T.push({ v: [A.tris[i], A.tris[i + 1], A.tris[i + 2]] });
  const near = new Map();
  for (const p of A.hides ?? []) for (const i of B.polys[p].v) if (!near.has(i)) near.set(i, closestOnBody(P, T, B.verts[i]).tri);
  NEAR.set(id, near);
  return near;
}
/**
 * The body's polygons the legs piece hides that are drawn again under the chest (`show`): those whose every corner's
 * nearest legs triangle is left out under it (`gone`, triangles' indices). The body there is drawn as under the chest
 * worn alone, so a gap the chest opens shows the body under it, never a hole through to nothing.
 */
export function showOf(rig, who, k, gone) {
  const near = nearTris(rig, who, k), A = assetOf(LEGS[k], who);
  return (A.hides ?? []).filter((p) => rig.B.polys[p].v.every((i) => gone.has(near.get(i))));
}
/**
 * A chest item over a legs item as the game wears them: the chest garment, the legs garments (each its key), the
 * triangles of each under the chest left out (`drop`: key → Set) and the body under those drawn again (`show`).
 */
export function pairOf(rig, who, chestItem, legsItem, drop = {}) {
  const ck = CHEST_ITEMS[chestItem], C = garmentOf(rig, assetOf(CHESTS[ck], who));
  const L = LEGS_ITEMS[legsItem](ck).map(([k, drops]) => {
    const A = assetOf(LEGS[k], who), out = (pi) => drops && A.dropFrom !== undefined && pi >= A.dropFrom, G = garmentOf(rig, A, out, drop[k] ?? new Set());
    const gone = new Set([...(drop[k] ?? [])]);
    if (gone.size) for (let i = 0; i < A.tris.length; i += 4) if (out(A.tris[i + 3])) gone.add(i / 4);
    const show = gone.size ? showOf(rig, who, k, gone) : [], shown = new Set(show);
    return { key: k, ...G, show, hides: G.hides.filter((p) => !shown.has(p)) };
  });
  return { chestKey: ck, C, L };
}

/** How far the game's camera looks down (src/render/figure.ts viewOf: atan(2 SY / HEIGHT_SCALE / √2)), in degrees; its eight facings, y up. */
export const VIEW_DOWN = Math.atan((2 * (24 / 40)) / 2.25 / Math.SQRT2) * 180 / Math.PI;
export const EYES = Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4, e = VIEW_DOWN * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; });
/** Where two crossing triangles meet: the mean of the points where an edge of either passes through the other. */
export function meetOf(A, B) {
  const pts = [];
  const seg = (p, q, T) => {
    const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), d = sub(q, p), h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-12) return;
    const f = 1 / a, s0 = sub(p, T[0]), u = f * dot(s0, h); if (u < 0 || u > 1) return;
    const qv = cross(s0, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) return;
    const t = f * dot(e2, qv); if (t > 0 && t < 1) pts.push(add(p, mul(d, t)));
  };
  for (let k = 0; k < 3; k++) { seg(A[k], A[(k + 1) % 3], B); seg(B[k], B[(k + 1) % 3], A); }
  return pts.length ? mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length) : A[0];
}
/** For each eye, the triangles (T: three points each) binned by where they fall across its line of sight. */
export function sightGrids(T, cell = 0.15) {
  return EYES.map((d) => {
    const u = Math.abs(d[1]) < 0.9 ? [d[2], 0, -d[0]] : [1, 0, 0], ul = Math.hypot(...u), U = mul(u, 1 / ul), V = cross(d, U), grid = new Map();
    T.forEach((t, k) => {
      const xs = t.map((p) => dot(p, U)), ys = t.map((p) => dot(p, V));
      for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) { const key = x * 100003 + y; (grid.get(key) ?? grid.set(key, []).get(key)).push(k); }
    });
    return { d, U, V, grid, cell };
  });
}
/** The eyes that can see p: the ray toward each meets none of T (but the triangles `skip`) past `eps`. */
export function seenBy(p, T, grids, skip = new Set(), eps = 0.015, first = false) {
  const out = [];
  for (const { d, U, V, grid, cell } of grids) {
    const key = Math.floor(dot(p, U) / cell) * 100003 + Math.floor(dot(p, V) / cell);
    let hit = false;
    for (const k of grid.get(key) ?? []) {
      if (skip.has(k)) continue;
      const [a, b, c] = T[k], e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s0 = sub(p, a), u = f * dot(s0, h); if (u < 0 || u > 1) continue;
      const q = cross(s0, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
      if (f * dot(e2, q) > eps) { hit = true; break; }
    }
    if (!hit) { out.push(d); if (first) break; }
  }
  return out;
}
export const seen = (p, T, grids, skip, eps) => seenBy(p, T, grids, skip, eps, true).length > 0;

/**
 * A pose of a pair: every triangle drawn (the body's shown, the chest's, the legs' kept; `ALL`, with the chest's and each
 * legs garment's first index), the legs' left out (`GONE`: per legs garment, its points), and the points of the body
 * left out under what is worn (`inside`: each triangle's middle and the points halfway from it to its corners).
 */
export function poseOf(rig, pair, pose) {
  const { C, L } = pair, f = posed(rig, pose), P0 = skin(rig, f), PB = ground(rig, P0), dy = PB[0][1] - P0[0][1];
  const sk = (G) => skinGarment(rig, f, G).map((p) => [p[0], p[1] + dy, p[2]]);
  const XC = sk(C), XL = L.map(sk);
  const hidden = new Set([C, ...L].flatMap((g) => g.hides));
  const ALL = rig.B.tris.filter((t) => !hidden.has(t.poly)).map((t) => t.v.map((i) => PB[i])), c0 = ALL.length;
  for (const t of C.tris) ALL.push(t.v.map((i) => XC[i]));
  const l0 = L.map((G, k) => { const at = ALL.length; for (const t of G.tris) ALL.push(t.v.map((i) => XL[k][i])); return at; });
  // (the body drawn again under the chest: `shownAt`, its first index in ALL; its triangles' points)
  const again = new Set(L.flatMap((G) => G.show)), back = rig.B.tris.filter((t) => again.has(t.poly) && !hidden.has(t.poly));
  const inside = [];
  for (const t of rig.B.tris) {
    if (!hidden.has(t.poly) || !t.v.every((i) => TRUNK.has(rig.B.part[i]))) continue;
    const P = t.v.map((i) => PB[i]), m = mul(P.reduce(add, [0, 0, 0]), 1 / 3);
    inside.push(m, ...P.map((p) => mul(add(m, p), 0.5)));
  }
  return { XC, XL, PB, ALL, c0, l0, inside, back };
}

/* ---- 2. in the clips ----------------------------------------------------------------------------------------------- */
/**
 * The pair's drop sets (key → Set of triangles) less what shows in a gap of the chest at rest: a legs triangle the camera
 * sees (its middle or a point halfway from it to a corner, from any facing, everything worn drawn) that neither crosses
 * the chest nor stands out through it is the legs under the chest seen between its plates, its panels or its slits, as
 * the body is when it is worn alone, and is kept. Returns how many were kept.
 */
export function gaps(rig, who, chestItem, legsItem, drop) {
  const pair = pairOf(rig, who, chestItem, legsItem), { XC, XL, ALL, l0 } = poseOf(rig, pair, {}), grids = sightGrids(ALL);
  let kept = 0;
  pair.L.forEach((G, k) => {
    const set = drop[G.key], A = assetOf(LEGS[G.key], who);
    if (!set?.size) return;
    const crossing = new Set(crossPairs(XL[k], G.tris, XC, pair.C.tris).map(([i]) => G.tris[i].tri));
    const out = through(rig, assetOf(CHESTS[pair.chestKey], who), A, bodyPoints(rig, A));
    G.tris.forEach((t, i) => {
      if (!set.has(t.tri) || crossing.has(t.tri) || t.v.some((q) => out[q])) return;
      const P = t.v.map((q) => XL[k][q]), m = mul(P.reduce(add, [0, 0, 0]), 1 / 3);
      if ([m, ...P.map((p) => mul(add(m, p), 0.5))].some((p) => seen(p, ALL, grids, new Set([l0[k] + i])))) { set.delete(t.tri); kept++; }
    });
  });
  return kept;
}

/**
 * The pair's drop sets (key → Set of triangles) refined in the poses: the nearest legs triangle left out on any line of sight
 * to the body left out under what is worn kept, until no such line is left. Returns how many were kept.
 */
export function refine(rig, who, chestItem, legsItem, drop, poses) {
  let kept = 0;
  for (let round = 0; round < 12; round++) {
    let changed = 0;
    for (const pose of poses) {
      const pair = pairOf(rig, who, chestItem, legsItem, drop);
      if (!pair.L.some((G) => G.gone.length)) return kept;
      const { XL, ALL, inside } = poseOf(rig, pair, pose), grids = sightGrids(ALL);
      const GONE = pair.L.map((G, k) => G.gone.map((t) => ({ tri: t.tri, T: t.v.map((i) => XL[k][i]) })));
      for (const m of inside) for (const d of seenBy(m, ALL, grids)) {
        let best = null;
        GONE.forEach((list, k) => { for (const g of list) { const t = rayHit([g.T], m, d, 0.015); if (t < (best?.t ?? Infinity)) best = { t, k, tri: g.tri }; } });
        if (!best) continue;
        const set = drop[pair.L[best.k].key];
        if (set.delete(best.tri)) { changed++; kept++; GONE[best.k] = GONE[best.k].filter((g) => g.tri !== best.tri); }
      }
    }
    if (!changed) break;
  }
  return kept;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const o = Object.fromEntries(['reach', 'margin', 'up', 'down', 'side'].map((k) => [k, +opt(k, { reach: 1, margin: 0, up: 0, down: 0, side: 0 }[k])]));
  const refining = !args.includes('--no-refine'), AN = refining ? await loadAnim() : null;
  // (--chests: only those chests' rows made again, the others kept from the table as it is; --frames: each group's
  // frames scaled, for a quick look)
  const only = opt('chests', ''), scale = +opt('frames', 1);
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), body = who === 'male' ? 'man' : 'woman';
    const legs = Object.fromEntries(Object.entries(LEGS).map(([k, n]) => { const L = assetOf(n, who); return [k, { L, P: bodyPoints(rig, L) }]; }));
    const out = { built: `node tools/sculpt/garments/chestlegs.mjs ${Object.entries(o).map(([k, v]) => `--${k} ${v}`).join(' ')}${refining ? '' : ' --no-refine'}` };
    const D = {}, file = join(ROOT, `src/sculpt/assets/lowchestlegs-${who}.json`), was = only ? JSON.parse(readFileSync(file, 'utf8')) : null;
    const chosen = (c) => !only || only.split(',').includes(c);
    for (const [c, n] of Object.entries(CHESTS)) {
      if (!chosen(c)) continue;
      const A = assetOf(n, who);
      D[c] = Object.fromEntries(Object.entries(legs).map(([l, { L, P }]) => [l, new Set(underChest(rig, A, L, P, o))]));
    }
    if (refining) {
      const poses = Object.entries(REFINE).flatMap(([g, k]) => posesOf(AN, rig, body, g, g === 'rest' ? k : Math.max(1, Math.round(k * scale))));
      // (each chest item over each legs item: its legs garments' sets refined as they are worn together)
      for (const [ci, ck] of Object.entries(CHEST_ITEMS)) for (const li of Object.keys(LEGS_ITEMS)) {
        if (!chosen(ck)) continue;
        const before = LEGS_ITEMS[li](ck).map(([k]) => D[ck][k].size), seenIn = gaps(rig, who, ci, li, D[ck]), kept = refine(rig, who, ci, li, D[ck], poses);
        console.log(who, `${ci}/${li}`, 'left out', before.join('+'), 'kept in its gaps', seenIn, 'kept in the clips', kept);
      }
    }
    // (each legs garment's body drawn again under each chest, as its legs item is worn under that chest's item)
    const itemOf = Object.fromEntries(Object.keys(LEGS).map((k) => [k, Object.keys(LEGS_ITEMS).find((li) => LEGS_ITEMS[li]('tunic').some(([x]) => x === k))]));
    for (const [ci, c] of Object.entries(CHEST_ITEMS)) {
      if (!chosen(c)) { out[c] = was[c]; continue; }
      out[c] = Object.fromEntries(Object.entries(D[c]).map(([l, s]) => {
        const show = pairOf(rig, who, ci, itemOf[l], D[c]).L.find((G) => G.key === l)?.show ?? [];
        return [l, { tris: legs[l].L.tris.length / 4, drop: [...s].sort((a, b) => a - b), show }];
      }));
      console.log(who, c, Object.entries(out[c]).map(([l, d]) => `${l} ${d.drop.length}/${d.tris} (body ${d.show.length})`).join(', '));
    }
    if (only) out.built = was.built;
    // (--out: written there instead, `{who}` in it the body)
    writeFileSync(opt('out', '') ? opt('out', '').replace('{who}', who) : file, JSON.stringify(out));
  }
}
