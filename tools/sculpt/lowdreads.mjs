// Dreadlocks to the shoulders (tools/sculpt/hairs/dreads.mjs) for the low-poly bodies: the game's 'dreads', "Dreads".
// No sheet: built from the style's locks on each body's own skull (buildDreads):
//
//   spine    per lock: its root a point under the skin on the centre parting (rootOf), rising out of it and lying on the
//            skull (its centre its radius off the skin) to its drop, where it leaves the head; from there down, out
//            from the head's upright axis as far as the skin beside and above it needs (the face's side, the ear, the
//            jaw), in again under the head toward the neck as that allows, with its own sway across and lean, to its
//            tip, shortened to end over the shoulders, the back or the chest under it. Two layers, the outer further
//            off the skin; each lock lifted over those before it where they meet, a little at most (layOver: where the
//            room is short they press together, the outline kept close).
//   tube     rings along the spine (closer over the skull than down the hang), each turned half a side from the one
//            before (the rope's twist: the facets run diagonally), pinched by its own amount (the knots); the last of
//            it tapered, its end a blunt cap; the facets turned in toward the head and the tip's cut in the valleys'
//            tones.
//   cap      the under-layer (capOf): small locks lying close over the scalp, a corrugated shell swirling out from the
//            crown down to the hairline, showing between the locks; the scalp it covers drawn shaved.
//
// Rigid on the head. Kept clear of the face, the ears, the neck and the shoulders at rest and in the game's clips'
// poses (clearBody; the poses tools/sculpt/hairs/dreads-poses-<who>.json, written by tools/sculpt/lowdreadsanim.mjs
// --write): a lock through the skin moved out there, through the shoulders shortened.
//
//   node tools/sculpt/lowdreads.mjs [--who female,male]   # counts, crossings at rest and turned, how far the locks
//                                                         # stand out, what of the scalp shows, locks through locks
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { openEdges, skinHair, shaveOf } from './lowhair.mjs';
import DREADS from './hairs/dreads.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180;
/** A direction from the skull's middle: theta round from the front toward her left, phi up from level (degrees). */
export const dirOf = (th, ph) => [Math.sin(rad(th)) * Math.cos(rad(ph)), Math.sin(rad(ph)), Math.cos(rad(th)) * Math.cos(rad(ph))];
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The furthest crossing of a ray from o along unit d with triangles (three points each), or 0. */
function farHit(tris, o, d) {
  let best = 0;
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > best) best = t;
  }
  return best;
}
/** The nearest crossing of a ray from o along unit d with triangles (three points each), or Infinity. */
function nearHit(tris, o, d) {
  let best = Infinity;
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > 0 && t < best) best = t;
  }
  return best;
}
/** Whether the segment p-q passes through the triangle. */
function segTri(p, q, [a, b, c]) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
  const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qq) / det; return t > 0 && t < 1;
}
const triTri = (A, Bt) => { for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true; return false; };

/**
 * The hair's triangles through the body's skin, as tools/sculpt/lowhair.mjs crossings finds them (the head's, the
 * neck's and the torso's; the scalp it covers, where rigid on the head, left out), each hair polygon once with the first
 * skin polygon it meets: the skin's triangles binned in a grid first (the same answer, many poses quicker). P, H: the
 * body's and the hair's vertices posed.
 */
const SKIN_T = new Map();
export function fastCrossings(rig, hair, P, H) {
  const B = rig.B, key = `${rig.who}|${hair.scalp.length}|${hair.scalp.at(-1)}`;
  if (!SKIN_T.has(key)) {
    const scalp = new Set(hair.scalp), rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
    SKIN_T.set(key, B.tris.filter((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso'].includes(p.part) && !(scalp.has(t.poly) && t.v.every(rigid)); }));
  }
  const skinT = SKIN_T.get(key), G = 0.2, cells = new Map();
  const bb = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const hb = bb(H);
  const tri = skinT.map((t) => { const pts = t.v.map((i) => P[i]); return { pts, b: bb(pts), poly: t.poly }; }).filter((t) => t.b.every(([lo, hi], k) => hi >= hb[k][0] - 0.01 && lo <= hb[k][1] + 0.01));
  const cellsOf = (b, f) => { for (let x = Math.floor(b[0][0] / G); x <= Math.floor(b[0][1] / G); x++) for (let y = Math.floor(b[1][0] / G); y <= Math.floor(b[1][1] / G); y++) for (let z = Math.floor(b[2][0] / G); z <= Math.floor(b[2][1] / G); z++) f(`${x},${y},${z}`); };
  tri.forEach((t, i) => cellsOf(t.b, (c) => { if (!cells.has(c)) cells.set(c, []); cells.get(c).push(i); }));
  const hits = [];
  for (const [a, b, c, pi] of hair.tris) {
    const A = [H[a], H[b], H[c]], ab = bb(A), seen = new Set();
    let hit = -1;
    cellsOf(ab, (c2) => { if (hit >= 0) return; for (const i of cells.get(c2) ?? []) { if (seen.has(i)) continue; seen.add(i); const t = tri[i]; if (ab.some(([lo, hi], k) => hi < t.b[k][0] || lo > t.b[k][1])) continue; if (triTri(A, t.pts)) { hit = i; return; } } });
    if (hit >= 0) hits.push([pi, tri[hit].poly]);
  }
  return { n: hits.length, hits };
}

/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
/** A polyline's points at arc lengths `at` along it. */
function along(pts, at) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  return at.map((s) => {
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1])));
    return add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), t));
  });
}
const lenOf = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(...sub(p, pts[i - 1])) : 0), 0);
/** The nearest point to p on the segment a-b. */
const nearOn = (p, a, b) => { const d = sub(b, a), t = Math.min(1, Math.max(0, dot(sub(p, a), d) / Math.max(1e-12, dot(d, d)))); return add(a, mul(d, t)); };

const CACHE = new Map();
/** A body's skin as the locks see it: the head (with the ears) and the neck as a radius from the skull's middle per
 * direction, and the head's, the neck's and the upper torso's reach out from the head's upright axis per azimuth and
 * height (the hang's least distance). */
function skinOf(rig) {
  if (CACHE.has(rig.who)) return CACHE.get(rig.who);
  const B = rig.B, C = centreOf(B);
  const tri = (parts) => B.tris.filter((t) => parts.includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const headT = tri(['head', 'neck']), hangT = headT;
  const memo = new Map(), hmemo = new Map();
  const radius = (th, ph) => { const k = `${Math.round(th * 2)},${Math.round(ph * 2)}`; if (!memo.has(k)) memo.set(k, farHit(headT, C, dirOf(th, ph))); return memo.get(k); };
  // (the reach level out from the axis at height y, azimuth a: the widest of the skin within a lock's radius above and
  // below, and a few degrees either side)
  const reach = (a, y) => {
    const k = `${Math.round(a)},${Math.round(y * 50)}`;
    if (!hmemo.has(k)) {
      let m = 0;
      for (const da of [-3, 0, 3]) for (const dy of [-0.06, 0, 0.06]) m = Math.max(m, farHit(hangT, [C[0], y + dy, C[2]], [Math.sin(rad(a + da)), 0, Math.cos(rad(a + da))]));
      hmemo.set(k, m);
    }
    return hmemo.get(k);
  };
  // (the top of the shoulders, the upper back and the chest under a point: the highest of the torso's and the neck's
  // skin straight under it, or far down)
  const lowT = B.tris.filter((t) => ['neck', 'torso'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const floor = (x, z) => { const t = nearHit(lowT, [x, 3, z], [0, -1, 0]); return Number.isFinite(t) ? 3 - t : -9; };
  // (the skull alone, the ears left out: the cap runs under them)
  const bareT = B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part) && !B.polys[t.poly].ear).map((t) => t.v.map((i) => B.verts[i])), bmemo = new Map();
  const bare = (th, ph) => { const k = `${Math.round(th * 2)},${Math.round(ph * 2)}`; if (!bmemo.has(k)) bmemo.set(k, farHit(bareT, C, dirOf(th, ph))); return bmemo.get(k); };
  const out = { C, radius, reach, floor, bare };
  CACHE.set(rig.who, out);
  return out;
}

/** Each lock's spine (its rings' centres, root first) and radius, laid on the body, both sides, and laid over one
 * another (layOver). */
function spinesOf(rig, S) {
  const { C, radius, reach, floor } = skinOf(rig);
  const L = [];
  locksOf(S).forEach((lk, li) => {
    for (const side of lk.centre ? [1] : [1, -1]) {
      const m = ([th, ph]) => [side * th, ph], seed = li * 2 + (side < 0 ? 1 : 0);
      // over the skull: the root, the via points, the drop, through the directions (theta, phi), the lock's centre
      // `lie` of its radius off the skin, its root `sink` under the skin and rising out of it over `rootEase` of the way
      const ang = [lk.root, ...(lk.via ?? []), lk.end ?? lk.drop].map(m);
      const nScalp = 16, scalp = [];
      for (let k = 0; k <= nScalp; k++) {
        const [th, ph] = spline(ang, k / nScalp), e = Math.min(1, k / nScalp / S.rootEase), off = lk.r * (lk.lie ?? S.lie) * e - S.sink * (1 - e) + (lk.layer ?? 0) * S.layerGap * Math.min(1, k / nScalp / S.layerEase);
        scalp.push(add(C, mul(dirOf(th, ph), radius(th, ph) + off)));
      }
      // (an under-lock: over the skull only, its tip where it ends)
      if (lk.end) {
        let pts = scalp;
        for (let pass = 0; pass < 2; pass++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : mul(add(add(pts[i - 1], mul(p, 2)), pts[i + 1]), 0.25)));
        L.push({ id: `${lk.id}.${side > 0 ? 'L' : 'R'}`, r: lk.r, sides: lk.sides, pts, nOver: pts.length, seed, end: true });
        continue;
      }
      // the hang: down from the drop, out from the upright axis as far as the skin needs there and `ahead` above it
      // (the face's side, the ear, the jaw), in again under the head toward the neck as that allows (from the drop's
      // own distance over its first `easeHang` of the way), swaying across and leaning by the lock's own amounts
      const D = scalp.at(-1), a = Math.atan2(D[0] - C[0], D[2] - C[2]) * 180 / Math.PI, h0 = Math.hypot(D[0] - C[0], D[2] - C[2]);
      let yTip = C[1] - lk.tip - (hash(seed, 4) * 2 - 1) * S.length;
      const nHang = 10;
      const sway = (hash(seed, 1) * 2 - 1) * S.sway, lean = rad(hash(seed, 2) * S.lean), ph0 = hash(seed, 3) * Math.PI;
      const hd = [Math.sin(rad(a)), 0, Math.cos(rad(a))], sd = [Math.cos(rad(a)), 0, -Math.sin(rad(a))];
      const hangTo = (yEnd) => {
        let H = [];
        for (let k = 1; k <= nHang; k++) {
          const t = k / nHang, y = D[1] + (yEnd - D[1]) * t;
          let req = 0;
          for (const up of [0, 0.5, 1]) req = Math.max(req, reach(a, Math.min(D[1], y + up * S.ahead)));
          req += lk.r + S.gap + (lk.layer ?? 0) * S.layerGap * S.hangGap;
          H.push(Math.max(req, h0 + (req - h0) * Math.min(1, t / S.easeHang)));
        }
        for (let pass = 0; pass < 2; pass++) H = H.map((h, k) => Math.max(h, k === 0 || k === H.length - 1 ? h : (H[k - 1] + 2 * h + H[k + 1]) / 4));
        return H.map((hk, k) => {
          const t = (k + 1) / nHang, y = D[1] + (yEnd - D[1]) * t, drop = D[1] - y, h = hk + S.flare * drop + Math.sin(lean) * drop * 0.5;
          return add([C[0] + hd[0] * h, y, C[2] + hd[2] * h], mul(sd, side * sway * Math.sin(Math.PI * t + ph0) * Math.min(1, t * 3)));
        });
      };
      // (every point of it at least `shoulder` above the shoulders, the back or the chest under it: the lock shortened
      // to end there, never through them)
      let hang = hangTo(yTip);
      for (let pass = 0; pass < 4; pass++) {
        const low = Math.max(...hang.map((p) => floor(p[0], p[2]) + S.shoulder - p[1]));
        if (low <= 1e-3) break;
        yTip += low;
        hang = hangTo(yTip);
      }
      // (a smooth run, the corner at the drop rounded)
      let pts = [...scalp, ...hang];
      for (let pass = 0; pass < 3; pass++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : mul(add(add(pts[i - 1], mul(p, 2)), pts[i + 1]), 0.25)));
      L.push({ id: lk.centre ? lk.id : `${lk.id}.${side > 0 ? 'L' : 'R'}`, r: lk.r, sides: lk.sides, pts, nOver: scalp.length, seed });
    }
  });
  // each lock laid over those before it (on its dense run), then its rings: closer over the curve, sparser down the
  // straight hang
  L.forEach((lk, li) => {
    layOver(lk, 'pts', L.slice(0, li), S, C);
    const scalpLen = lenOf(lk.pts.slice(0, lk.nOver)), total = lenOf(lk.pts);
    const nS = Math.max(2, Math.round(scalpLen / S.spacing[0])), nH = Math.max(3, Math.round((total - scalpLen) / S.spacing[1]));
    const at = lk.end ? Array.from({ length: nS + 1 }, (_, k) => (scalpLen * k) / nS) : [...Array.from({ length: nS }, (_, k) => (scalpLen * k) / nS), ...Array.from({ length: nH + 1 }, (_, k) => scalpLen + ((total - scalpLen) * k) / nH)];
    lk.ring = along(lk.pts, at);
    lk.nS = nS;
  });
  return { locks: L, C };
}

/** A lock's root [theta, phi] by its drop's theta (tools/sculpt/hairs/dreads.mjs part): on the centre parting, either
 * side of it by the lock's radius and `partAcross` (behind the crown `backAcross`). */
export function rootOf(S, L, thD) {
  const P = S.part, k = Math.max(0, P.findIndex(([d], i) => i + 1 < P.length && thD <= P[i + 1][0]));
  const [d0, a0] = P[k], [d1, a1] = P[Math.min(P.length - 1, k + 1)], al = a0 + (a1 - a0) * Math.min(1, Math.max(0, (thD - d0) / Math.max(1e-9, d1 - d0)));
  const ph = al <= 90 ? al : 180 - al, gap = Math.max(0.005, L.r + (al <= 90 ? S.partAcross : S.backAcross));
  const across = Math.min(60, (Math.asin(Math.min(1, gap / (0.85 * Math.max(0.05, Math.cos(rad(ph)))))) * 180) / Math.PI);
  return [al <= 90 ? across : 180 - across, ph];
}

/** The style's locks, each layer's (tools/sculpt/hairs/dreads.mjs layers), and the middle line's. */
export function locksOf(S) {
  const out = [];
  // (the under-locks first, the lowest: short and thin, from the parting over the crown, between the others' roots)
  const U = S.under;
  if (U) U.alpha.forEach((al, i) => {
    const ph = al <= 90 ? al : 180 - al, across = Math.min(60, (Math.asin(Math.min(1, U.across / (0.85 * Math.max(0.05, Math.cos(rad(ph)))))) * 180) / Math.PI);
    const th = al <= 90 ? across : 180 - across, turn = al <= 90 ? U.turn[i] : -U.turn[i];
    out.push({ id: `un${i}`, root: [th, ph], end: [th + turn, ph - U.fall[i]], r: U.r, sides: U.sides, layer: 0, lie: U.lie });
  });
  S.layers.forEach((L, layer) => L.drop.forEach((thD, i) => out.push({ id: `${L.id}${i}`, root: rootOf(S, L, thD), drop: [thD, L.dropPh[i]], tip: L.tip[i], r: L.r, sides: L.sides, layer })));
  for (const c of S.centre ?? []) out.push({ ...c, centre: true });
  return out;
}

/**
 * A lock's points (lk[key]) lifted over the locks before it where they meet: each point moved out (from the skull's
 * middle; down the hang level out from the upright axis) as far as needed for the lock to lie on the one under it
 * (their centres `apart` of their radii's sum apart), the lifts spread along the lock (the most within `spread` points,
 * then smoothed), so it rides up and over rather than kinking. Its root stays.
 */
function layOver(lk, key, under, S, C) {
  if (!under.length) return;
  const outOf = (q) => (q[1] < C[1] - S.levelBelow ? unit([q[0] - C[0], 0, q[2] - C[2]]) : unit(sub(q, C)));
  const tot = lk[key].map(() => 0);
  for (let pass = 0; pass < 4; pass++) {
    const P = lk[key], lift = P.map((p, i) => {
      if (i === 0) return 0;
      const u = outOf(p);
      let most = 0;
      for (const o of under) {
        const Q = o[key] ?? o.ring;
        for (let j = 0; j + 1 < Q.length; j++) {
          const q = nearOn(p, Q[j], Q[j + 1]), v = sub(p, q), al = dot(v, u), lat = Math.hypot(...sub(v, mul(u, al))), w = (lk.r + o.r) * S.apart;
          if (lat >= w) continue;
          most = Math.max(most, Math.sqrt(w * w - lat * lat) - al);
        }
      }
      return Math.max(0, Math.min(most, S.liftMost - tot[i]));
    });
    if (Math.max(...lift) < 1e-4) break;
    const n = lift.length, sp = S.spread;
    let f = lift.map((_, i) => { let m = 0; for (let k = Math.max(0, i - sp); k <= Math.min(n - 1, i + sp); k++) m = Math.max(m, lift[k]); return Math.min(m, S.liftMost - tot[i]); });
    for (let k = 0; k < sp; k++) f = f.map((x, i) => (i === 0 || i === n - 1 ? x : Math.max(lift[i], (f[i - 1] + 2 * x + f[i + 1]) / 4)));
    // (the root stays, the lift eased in over its first `liftEase` points; no point lifted more than `liftMost` in all:
    // where the locks are too many for the room they press together, the silhouette kept low)
    lk[key] = P.map((p, i) => (i === 0 ? p : add(p, mul(outOf(p), f[i] * Math.min(1, i / S.liftEase)))));
    f.forEach((x, i) => { tot[i] += x; });
  }
}

/** A ring's section [across, up] against its radius: flattened over the skull (`flat`, its first `nS` rings), round
 * down the hang, eased over `flatEase` rings between. */
const flatAt = (S, i, nS) => { const t = Math.min(1, Math.max(0, (i - nS + 1) / S.flatEase)); return [S.flat[0] + (1 - S.flat[0]) * t, S.flat[1] + (1 - S.flat[1]) * t]; };

/**
 * The under-layer: a low closed shell over the scalp (`cap`), corrugated into small locks lying close (rope ridges
 * between grooves) swirling out from the crown, under the locks and showing between them. From one point over the
 * crown down `rows` rows (at `rowAt` of the way) in `cols` columns round the head (each row turned `swirl` degrees on) to the hairline
 * (`hairline`: phi by |theta|, between, evenly): a ridge's corners `off` plus `ridge` off the skin, a groove's `off`
 * less `groove` (each corner up to `lump` higher or lower, repeatably), its last row sunk into the skin; its inside a
 * fan to the skull's middle. Every other strip between a groove and a ridge in the valleys' shade `shade`.
 */
/** The cap's hairline: phi at a theta (tools/sculpt/hairs/dreads.mjs cap.hairline, by |theta|, between, evenly). */
const hairlineOf = (K) => (th) => { const a = Math.abs(((th + 540) % 360) - 180), H = K.hairline, k = Math.max(0, H.findIndex(([t], i) => i + 1 < H.length && a <= H[i + 1][0])); const [t0, p0] = H[k], [t1, p1] = H[Math.min(H.length - 1, k + 1)]; return p0 + (p1 - p0) * Math.min(1, Math.max(0, (a - t0) / Math.max(1e-9, t1 - t0))); };

function capOf(rig, S, C, base) {
  const { bare: radius } = skinOf(rig), K = S.cap, verts = [], polys = [];
  const hl = hairlineOf(K);
  const top = base + verts.push(add(C, mul(dirOf(0, 90), radius(0, 90) + K.off))) - 1;
  const at = [];
  for (let j = 0; j < K.cols; j++) {
    const col = [];
    for (let k = 1; k <= K.rows; k++) {
      const th = -180 + (360 * j) / K.cols + K.swirl * k, ph = 90 - (90 - hl(th)) * K.rowAt[k - 1];
      const off = k === K.rows ? -K.sink : K.off + (j % 2 ? -K.groove : K.ridge) + K.lump * (hash(j, 31 + k) * 2 - 1);
      col.push(base + verts.push(add(C, mul(dirOf(th, ph), radius(th, ph) + off))) - 1);
    }
    at.push(col);
  }
  const mid = base + verts.push([...C]) - 1;
  for (let j = 0; j < K.cols; j++) {
    const a = at[j], b = at[(j + 1) % K.cols], sh = j % 2 ? { valley: K.shade } : {};
    polys.push({ v: [top, b[0], a[0]], ...sh });
    for (let k = 0; k + 1 < K.rows; k++) polys.push({ v: [a[k], b[k], b[k + 1]], ...sh }, { v: [a[k], b[k + 1], a[k + 1]], ...sh });
    polys.push({ v: [mid, a[K.rows - 1], b[K.rows - 1]], valley: K.shade });
  }
  return { verts, polys };
}

/** One lock's tube: { verts, polys } from its ring centres: its root a point (under the skin), its rings from the
 * second on, its tip a blunt cap. Vertices: the root, each ring's `sides`, the tip's point. */
function tubeOf(lk, S, C, base) {
  const R = lk.ring, n = R.length, N = lk.sides, verts = [], polys = [];
  const T = R.map((p, i) => unit(sub(R[Math.min(n - 1, i + 1)], R[Math.max(0, i - 1)])));
  // (the frames carried along the spine: the first's normal out from the skull's middle)
  let nrm = unit(sub(sub(R[0], C), mul(T[0], dot(sub(R[0], C), T[0]))));
  const twist0 = hash(lk.seed, 7) * Math.PI * 2;
  const radiusAt = (i) => {
    const u = i / (n - 1), tp = u > 1 - S.taper ? 1 - (1 - S.tipR) * ((u - (1 - S.taper)) / S.taper) : 1;
    const knot = i > 0 && i < n - 1 ? 1 - (1 - S.pinch) * hash(lk.seed, 11 + i) : 1;
    return lk.r * tp * knot;
  };
  verts.push(R[0]);
  for (let i = 0; i < n; i++) {
    if (i) { nrm = sub(nrm, mul(T[i], dot(nrm, T[i]))); nrm = unit(nrm); }
    if (i === 0) continue;
    const bin = cross(T[i], nrm), r = radiusAt(i), [fw, fh] = flatAt(S, i, lk.nS);
    for (let s = 0; s < N; s++) {
      const ang = twist0 + ((s + (i % 2) * 0.5) * 2 * Math.PI) / N;
      verts.push(add(R[i], add(mul(nrm, Math.cos(ang) * r * fh), mul(bin, Math.sin(ang) * r * fw))));
    }
  }
  const V = (i, s) => base + 1 + (i - 1) * N + (s % N);
  for (let i = 1; i + 1 < n; i++) for (let s = 0; s < N; s++) {
    // (the rings turned half a side apart: each quad's two triangles, its own facets)
    const a = V(i, s), b = V(i, s + 1), c = V(i + 1, s + 1), d = V(i + 1, s);
    if (i % 2 === 0) polys.push({ v: [a, b, d] }, { v: [b, c, d] }); else polys.push({ v: [a, b, c] }, { v: [a, c, d] });
  }
  // the root's point to the first ring (out of the scalp, in the root's shade) and the tip's blunt cap
  const tipC = base + verts.length;
  verts.push(add(R[n - 1], mul(T[n - 1], radiusAt(n - 1) * S.tipCap)));
  for (let s = 0; s < N; s++) {
    polys.push({ v: [base, V(1, s + 1), V(1, s)], ...(S.rootShade ? { valley: S.rootShade } : {}) });
    polys.push({ v: [tipC, V(n - 1, s), V(n - 1, s + 1)], valley: S.tipShade });
  }
  return { verts, polys };
}

/**
 * The dreads on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave, scalp,
 * centre, k, locks }. style: tools/sculpt/hairs/dreads.mjs.
 */
export function buildDreads(rig, style = DREADS, { clear = true } = {}) {
  const S = style, { locks, C } = spinesOf(rig, S);
  const hair = assemble(rig, S, locks, C);
  // (the skin a root's blunt end sinks into past the named scalp, the hairline's edge: left out of the checks as the
  // scalp is, crossings)
  const extra = new Set(fastCrossings(rig, hair, rig.B.verts, hair.verts).hits.filter(([hp]) => isRoot(hair, hp)).map(([, sp]) => sp));
  hair.scalp = [...hair.scalp, ...extra];
  hair.extra = extra;
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/** Whether a polygon of the hair is a root's (its blunt end, or the first band of its tube) or the cap's. */
const isRoot = (h, pi) => { const p = h.polys[pi], pc = h.pieces[p.piece]; return pc.kind === 'cap' || p.v.includes(pc.verts[0]); };

function assemble(rig, S, locks, C, extra = new Set()) {
  const verts = [], polys = [], pieces = [];
  locks.forEach((lk, pi) => {
    const t = tubeOf(lk, S, C, verts.length), v0 = verts.length, p0 = polys.length;
    verts.push(...t.verts);
    t.polys.forEach((p) => polys.push({ ...p, piece: pi }));
    pieces.push({ id: lk.id, kind: 'lock', polys: [p0, polys.length], verts: [v0, verts.length] });
  });
  if (S.cap) {
    const t = capOf(rig, S, C, verts.length), v0 = verts.length, p0 = polys.length;
    verts.push(...t.verts);
    t.polys.forEach((p) => polys.push({ ...p, piece: pieces.length }));
    pieces.push({ id: 'cap', kind: 'cap', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // orientation: each tube's faces wound outward (turned if its volume comes out negative)
  for (const pc of pieces) {
    let vol = 0;
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) { const v = polys[i].v; vol += dot(verts[v[0]], cross(verts[v[1]], verts[v[2]])); }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
  // the facets turned in toward the head (out from the skull's middle over the skull, level out from the upright axis
  // down the hang), in the valleys' shade
  for (const p of polys) {
    if (p.valley) continue;
    const P = p.v.map((i) => verts[i]), c = mul(add(add(P[0], P[1]), P[2]), 1 / 3), n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    const out = c[1] < C[1] - S.levelBelow ? unit([c[0] - C[0], 0, c[2] - C[2]]) : unit(sub(c, C));
    if (dot(n, out) < S.innerDot) p.valley = S.innerShade;
  }
  const tris = polys.map((p, pi) => [...p.v, pi]);
  // the shave: the scalp's polygons (by name) the cap covers whole (every corner under it seen from the skull's middle);
  // the rest is skin
  const capT = pieces.filter((pc) => pc.kind === 'cap').flatMap((pc) => tris.slice(pc.polys[0], pc.polys[1]).map(([a, b, c]) => [verts[a], verts[b], verts[c]]));
  const B = rig.B, under = (vi) => !capT.length || farHit(capT, C, unit(sub(B.verts[vi], C))) > Math.hypot(...sub(B.verts[vi], C)) + 0.005;
  const shave = shaveOf(B, S.scalp).filter((pi) => B.polys[pi].v.every(under));
  return { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, centre: C, k: 1, scalp: [...shave, ...extra], shave, locks, extra };
}

/**
 * The locks clear of the body: a lock through the skin that is not the scalp its roots sink into (the face, the ears,
 * the jaw, the neck, the shoulders) at rest or in one of the game's clips' poses (tools/sculpt/hairs/dreads-poses-<who>.json)
 * has its rings there moved out `step` at a time (from the skull's middle; below `levelBelow` level out from the upright
 * axis), its neighbours less; through the torso, its rings from there to the tip raised instead (the lock shortened);
 * until none is, each ring moved `most` at most.
 */
function clearBody(rig, hair, S, step = 0.01, most = S.clearMost) {
  const C = hair.centre;
  let poses = [];
  try { poses = JSON.parse(readFileSync(join(DIR, `hairs/dreads-poses-${rig.who}.json`), 'utf8')); } catch { /* none written */ }
  const states = [{ P: rig.B.verts, f: null }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f }; })];
  // (the cap's rim sinks into the skin at the hairline by design: its crossings left out)
  const hitsIn = (h, st) => fastCrossings(rig, h, st.P, st.f ? skinHair(rig, h, st.f) : h.verts).hits.filter(([hp]) => h.pieces[h.polys[hp].piece].kind !== 'cap');
  // (each polygon's lock and ring)
  const ringOf = (h, pi) => { const p = h.polys[pi], lk = h.locks[p.piece], v0 = h.pieces[p.piece].verts[0]; return [p.piece, Math.min(lk.ring.length - 1, p.v.includes(v0) ? 0 : 1 + Math.floor((Math.min(...p.v) - v0 - 1) / lk.sides))]; };
  const start = hair.locks.map((lk) => lk.ring.map((p) => [...p]));
  let cur = hair, live = states;
  for (let it = 0; it < 80; it++) {
    const all = live.map((st) => [st, hitsIn(cur, st)]).filter(([, h]) => h.length);
    live = all.map(([st]) => st);
    if (!live.length) break;
    const moves = new Map();
    for (const [, hits] of all) for (const [hp, sp] of hits) {
      const [li, ri] = ringOf(cur, hp), torso = rig.B.polys[sp].part === 'torso', key = `${li},${ri}`;
      moves.set(key, (moves.get(key) ?? false) || torso);
    }
    for (const [key, torso] of moves) {
      const [li, ri] = key.split(',').map(Number), lk = cur.locks[li];
      if (torso) {
        // (through the shoulders: the lock from this ring on raised, the tip shortened)
        for (let j = Math.max(1, ri - 1); j < lk.ring.length; j++) lk.ring[j] = add(lk.ring[j], [0, step * Math.min(1, (j - ri + 2) / 2), 0]);
        continue;
      }
      for (let j = Math.max(1, ri - 2); j <= Math.min(lk.ring.length - 1, ri + 2); j++) {
        const p = lk.ring[j], w = j === ri ? 1 : Math.abs(j - ri) === 1 ? 0.6 : 0.25;
        const out = p[1] < C[1] - S.levelBelow ? unit([p[0] - C[0], 0, p[2] - C[2]]) : unit(sub(p, C));
        lk.ring[j] = add(p, mul(out, step * w));
      }
    }
    // (no ring moved out further than `most` from where it was built, nor raised more than `raiseMost`)
    cur.locks.forEach((lk, li) => { lk.ring = lk.ring.map((p, j) => { const s0 = start[li][j], dy = Math.min(S.raiseMost, Math.max(-most, p[1] - s0[1])), d = [p[0] - s0[0], 0, p[2] - s0[2]], l = Math.hypot(...d), k = l > most ? most / l : 1; return [s0[0] + d[0] * k, s0[1] + dy, s0[2] + d[2] * k]; }); });
    cur = assemble(rig, S, cur.locks, C, hair.extra);
  }
  // (every state checked again once moved)
  const left = states.map((st) => hitsIn(cur, st).length);
  Object.assign(hair, cur, { clearedIn: left, cleared: left[0], states: states.length });
  return hair;
}

/** The dreads on a body (built, then cleared). */
export const dreadsOf = (rig, style = DREADS) => buildDreads(rig, style);

/** The head turned and nodded (tools/sculpt/lowbraid.mjs's poses). */
export const POSES = { 'turn left': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, 'turn right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] }, nod: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, 'look up': { neck_01: [-10, 0, 0], neck_02: [-12, 0, 0], head: [-14, 0, 0] } };

/** The locks' crossings through the body, by where: the face (in front of the ears, below the brows), the ears, the
 * neck, the torso, the scalp's edge; and the cap's (its rim sunk in the skin at the hairline), apart. */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const B = rig.B, r = fastCrossings(rig, hair, P, Hv), out = { face: 0, ear: 0, neck: 0, torso: 0, edge: 0, cap: 0 };
  const C = hair.centre;
  for (const [hp, sp] of r.hits) {
    if (hair.pieces[hair.polys[hp].piece].kind === 'cap') { out.cap++; continue; }
    const poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
    out[poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear ? 'ear' : c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25 ? 'face' : 'edge']++;
  }
  return out;
}

/** How far each lock stands out (its surface, along its rings and midway between them): over the skull (above `below`
 * under its middle) off the skin (the distance to the nearest of the head's, the neck's and the torso's triangles less
 * its radius); under it, out past the head's own outline above it (its distance from the upright axis less its radius
 * less the skin's widest reach at its azimuth from its height up to the skull). The most per lock and in all. */
export function standoff(rig, hair, below = 0.25) {
  const { reach } = skinOf(rig);
  const B = rig.B, C = hair.centre, T = B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const near = (p, [a, b, c]) => {
    // (the nearest point of a triangle to p: Ericson's closest point)
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
    const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / (d4 - d3 + d5 - d6)));
    const den = 1 / (va + vb + vc); return add(a, add(mul(ab, vb * den), mul(ac, vc * den)));
  };
  const per = hair.locks.map((lk) => {
    let most = 0;
    const pts = lk.ring.flatMap((p, i) => (i + 1 < lk.ring.length ? [p, mul(add(p, lk.ring[i + 1]), 0.5)] : [p]));
    for (const p of pts) {
      if (p[1] >= C[1] - below) {
        let d = Infinity;
        for (const t of T) d = Math.min(d, Math.hypot(...sub(p, near(p, t))));
        most = Math.max(most, d - lk.r);
        continue;
      }
      const a = (Math.atan2(p[0] - C[0], p[2] - C[2]) * 180) / Math.PI;
      let w = 0;
      for (let y = p[1]; y <= C[1] - below; y += 0.05) w = Math.max(w, reach(a, y));
      most = Math.max(most, Math.hypot(p[0] - C[0], p[2] - C[2]) - lk.r - w);
    }
    return [lk.id, +most.toFixed(3)];
  });
  return { per, most: Math.max(...per.map(([, d]) => d)) };
}

/**
 * What of the head shows that should be under the hair: the hair (its cap and its locks), the head, the neck and the
 * torso drawn into a depth buffer (orthographic, `px` per head unit) from each view — eight turns round the body at
 * each of `pitches` degrees down (the game's camera looks down about 8), and straight down — and the pixels where the
 * nearest is the scalp (the head's polygons the hair covers, drawn shaved) or the cap between the locks counted, against
 * the hair's own. { views: [{ yaw, pitch, scalp, cap, hair }], scalp, cap } (the most in any one view). The scalp: the
 * head's polygons the style names as such (tools/sculpt/hairs/dreads.mjs scalp), shaved or not, but those within
 * `margin` degrees of the hairline (where the skin begins).
 */
export function bald(rig, hair, { px = 160, pitches = [8, 35], margin = 8 } = {}) {
  // (the scalp: every head polygon the style names as such, shaved or not, more than `margin` degrees above the
  // hairline: the hairline's own edge, where the skin begins, is not counted)
  const St = hair.style ?? DREADS, hl = hairlineOf(St.cap), B = rig.B, C = hair.centre;
  const scalp = new Set(shaveOf(B, St.scalp).filter((pi) => {
    const c = mul(B.polys[pi].v.reduce((a, i) => add(a, B.verts[i]), [0, 0, 0]), 1 / B.polys[pi].v.length), d = unit(sub(c, C));
    return (Math.asin(d[1]) * 180) / Math.PI > hl((Math.atan2(d[0], d[2]) * 180) / Math.PI) + margin;
  }));
  const capP = hair.pieces.findIndex((p) => p.kind === 'cap');
  const T = [];
  for (const t of B.tris) { const p = B.polys[t.poly]; if (['head', 'neck', 'torso'].includes(p.part)) T.push({ P: t.v.map((i) => B.verts[i]), k: scalp.has(t.poly) ? 1 : 0 }); }
  for (const [a, b, c, pi] of hair.tris) T.push({ P: [hair.verts[a], hair.verts[b], hair.verts[c]], k: hair.polys[pi].piece === capP ? 2 : 3 });
  const views = [];
  for (const pitch of pitches) for (let yaw = 0; yaw < 360; yaw += 45) views.push({ yaw, pitch });
  views.push({ yaw: 0, pitch: 90 });
  const W = Math.round(3.2 * px), Hh = Math.round(3.2 * px);
  return (() => {
    const out = views.map(({ yaw, pitch }) => {
      const a = rad(yaw), b = rad(pitch);
      // (the view's axes: right, up, toward the viewer)
      const f = [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)], r = unit(cross([0, 1, 0], f).map((x) => (Math.abs(b - Math.PI / 2) < 1e-6 ? 0 : x))), rr = Math.abs(b - Math.PI / 2) < 1e-6 ? [1, 0, 0] : r, u = cross(f, rr);
      const Z = new Float32Array(W * Hh).fill(-Infinity), K = new Uint8Array(W * Hh);
      const pr = (p) => { const d = sub(p, C); return [W / 2 + dot(d, rr) * px, Hh / 2 - dot(d, u) * px, dot(d, f)]; };
      for (const t of T) {
        const [p0, p1, p2] = t.P.map(pr), x0 = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
        const y0 = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
        const den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
        if (Math.abs(den) < 1e-9) continue;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const w0 = ((p1[1] - p2[1]) * (x + 0.5 - p2[0]) + (p2[0] - p1[0]) * (y + 0.5 - p2[1])) / den, w1 = ((p2[1] - p0[1]) * (x + 0.5 - p2[0]) + (p0[0] - p2[0]) * (y + 0.5 - p2[1])) / den, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * p0[2] + w1 * p1[2] + w2 * p2[2], i = y * W + x;
          if (z > Z[i]) { Z[i] = z; K[i] = t.k; }
        }
      }
      const n = [0, 0, 0, 0];
      for (const k of K) n[k]++;
      return { yaw, pitch, scalp: n[1], cap: n[2], hair: n[3] };
    });
    return { views: out, scalp: Math.max(...out.map((v) => v.scalp)), cap: Math.max(...out.map((v) => v.cap)) };
  })();
}

/** Where two locks pass through each other: pairs of triangles of two locks that cross (the roots' first ring, inside
 * the scalp, left out). */
export function lockCrossings(hair, H = hair.verts) {
  const T = hair.tris.map(([a, b, c, pi]) => { const P = [H[a], H[b], H[c]]; return { P, piece: hair.polys[pi].piece, cap: hair.pieces[hair.polys[pi].piece].kind === 'cap', root: [a, b, c].includes(hair.pieces[hair.polys[pi].piece].verts[0]), bb: [0, 1, 2].map((k) => [Math.min(...P.map((p) => p[k])), Math.max(...P.map((p) => p[k]))]) }; });
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  const pairs = new Map();
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const A = T[i], B = T[j];
    if (A.piece === B.piece || A.root || B.root || A.cap || B.cap || A.bb.some(([lo, hi], c) => hi < B.bb[c][0] || lo > B.bb[c][1])) continue;
    let x = false;
    for (let e = 0; e < 3 && !x; e++) x = segTri(A.P[e], A.P[(e + 1) % 3], B.P) || segTri(B.P[e], B.P[(e + 1) % 3], A.P);
    if (x) { const key = [hair.pieces[A.piece].id, hair.pieces[B.piece].id].sort().join('-'); pairs.set(key, (pairs.get(key) ?? 0) + 1); }
  }
  return pairs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = dreadsOf(rig);
    console.log(who, 'locks', hair.pieces.length, 'verts', hair.verts.length, 'tris', hair.tris.length, 'valleys', hair.polys.filter((p) => p.valley).length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'ms', Date.now() - t0);
    console.log(who, 'rings', hair.locks.map((l) => `${l.id}:${l.ring.length}`).join(' '));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)), 'clips\' poses left crossing', (hair.clearedIn ?? []).slice(1).filter((n) => n).length, 'of', (hair.states ?? 1) - 1, 'root skin', hair.extra.size);
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
    const so = standoff(rig, hair);
    console.log(who, 'standout off the skull and past the head\'s outline under it (head units; a lock is', (2 * Math.max(...hair.locks.map((l) => l.r))).toFixed(3), 'thick): most', so.most, JSON.stringify(so.per.filter(([, d]) => d > 0.1)));
    const bl = bald(rig, hair);
    console.log(who, 'showing (pixels at 160 a head unit, the most in a view): scalp', bl.scalp, 'cap', bl.cap, 'of the hair\'s', Math.min(...bl.views.map((v) => v.hair)), '-', Math.max(...bl.views.map((v) => v.hair)), JSON.stringify(bl.views.filter((v) => v.scalp + v.cap > 0).map((v) => `${v.yaw}/${v.pitch}: ${v.scalp}+${v.cap}`)));
    const X = lockCrossings(hair);
    console.log(who, 'locks through locks', [...X.values()].reduce((a, b) => a + b, 0), JSON.stringify(Object.fromEntries(X)));
  }
}
