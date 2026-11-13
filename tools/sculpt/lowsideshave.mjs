// The side shave for the low-poly bodies: the game's 'sideshave', "Side shave". Modelled from its description
// (tools/sculpt/hairs/sideshave.mjs, no sheet), in the shape of the shoulder length (tools/sculpt/lowwarrior.mjs): one
// closed shell of locks over the skull, fitted to each body's own head, neck and shoulders, its left side shaved.
//
//   shave    the head's own polygons on the left from the temple to behind the ear (style.shave, by their corners'
//            names, the left side only) drawn in the shaved tone, with those the hair covers whole.
//   columns  the lock borders across the head from the front edge (the forehead's hairline from the part to the right
//            temple) round the right side and the back to the back edge (down behind the left ear): each border a path
//            over the skull from the part (the shave's top edge) to where the hair starts to hang; per lock a ridge
//            between its two borders stood out and the borders sunk, each border a narrow crease in the valleys' shade.
//   rows     down each column: over the skull from the part (its first faces in a valley's shade, the part's own rim)
//            to the hang, then down to the hem under the shoulder: the azimuth turning from the drop's to the hem's
//            (the front locks onto the right collarbone, the rest down the back), out over the neck, the shoulders and
//            the back where they are under it (drape); each lock's tip below its borders and thin. The front locks
//            part from the back's below the hang's splitRow (each side of the gap its own rim).
//   inside   sunk into the scalp under the cap, a thickness in from the outside where the hair hangs free, off the skin
//            where it is not the scalp (the face, the ears, the neck).
//
// Weights: the cap and the hang down to the jaw on the head; below, blended into those of the skin under it (the neck's,
// the torso's: weightOf), so the hang lies on the shoulders and the back in every pose. Kept off the face, the
// ears, the neck and the shoulders at rest and in the game's clips' poses (clearBody; the poses
// tools/sculpt/hairs/sideshave-poses-<who>.json, tools/sculpt/lowsideshaveanim.mjs --write).
//
//   node tools/sculpt/lowsideshave.mjs [--who female,male]   # counts, open edges, crossings at rest and head turned
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { crossings, openEdges, skinHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowbob.mjs';
import { radiiOf, dirOf } from './lowwarrior.mjs';
import SIDESHAVE from './hairs/sideshave.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const smooth = (x) => x * x * (3 - 2 * x);
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
/** A piecewise-linear table [[a, v], ...] at a. */
const table = (T, a) => { if (a <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (a <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (a - T[i - 1][0])) / (T[i][0] - T[i - 1][0]); return T.at(-1)[1]; };

/** The furthest crossing of a ray from o along unit d with triangles ({ P: three points, poly }): { t, poly }. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const { P: [a, b, c], poly: pi } of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = pi; }
  }
  return { t: best, poly };
}

/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}

/** A key's point as a direction from the skull's middle: [th, ph], or [vertex name, dth, dph]. */
function keyDir(B, C, p) {
  if (typeof p[0] !== 'string') return dirOf(p[0], p[1]);
  const [th, ph] = angOf(unit(sub(B.verts[B.index.get(p[0])], C)));
  return dirOf(th + p[1], ph + p[2]);
}

/** A border's path over the skull at a in [0, 1]: its directions at the style's capRows (shares of its length), the
 * part's first. */
function pathOf(B, C, S, a) {
  const K = S.keys, j = Math.max(0, Math.min(K.length - 2, K.findIndex((k, i) => i + 1 < K.length && a <= K[i + 1].a)));
  const k0 = K[j], k1 = K[j + 1], t = (a - k0.a) / (k1.a - k0.a);
  const ctrl = k0.pts.map((p, i) => unit(lerp(keyDir(B, C, p), keyDir(B, C, k1.pts[i]), t)));
  const fine = Array.from({ length: 161 }, (_, i) => unit(spline(ctrl, i / 160)));
  const len = [0];
  for (let i = 1; i < fine.length; i++) len.push(len[i - 1] + Math.acos(Math.min(1, dot(fine[i - 1], fine[i]))));
  return S.capRows.map((f) => {
    const L = f * len.at(-1); let i = 1; while (i < len.length - 1 && len[i] < L) i++;
    const u = (L - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
    return unit(lerp(fine[i - 1], fine[i], Math.min(1, Math.max(0, u))));
  });
}

const DRAPE = new Map();
/** The body under the hanging hair at rest (the head with its ears, the neck, the torso, the shoulder joints, the upper
 * arms): how far from the
 * upright axis through the skull's middle a level ray at height y toward azimuth th leaves it (0 if it misses). */
function drapeOf(rig, C) {
  if (!DRAPE.has(rig.who)) {
    const B = rig.B, T = B.tris.filter((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso', 'joint'].includes(p.part) || (p.part === 'arm' && t.v.every((i) => B.verts[i][1] > -2.2)); }).map((t) => ({ P: t.v.map((i) => B.verts[i]), poly: t.poly }));
    // (by height bands, for speed)
    const bands = new Map(), bandOf = (y) => Math.floor(y / 0.1);
    for (const t of T) { const lo = bandOf(Math.min(...t.P.map((p) => p[1]))), hi = bandOf(Math.max(...t.P.map((p) => p[1]))); for (let b = lo; b <= hi; b++) { if (!bands.has(b)) bands.set(b, []); bands.get(b).push(t); } }
    const memo = new Map();
    DRAPE.set(rig.who, (th, y) => {
      const key = `${th.toFixed(1)},${y.toFixed(3)}`;
      if (!memo.has(key)) memo.set(key, farHit(bands.get(bandOf(y)) ?? [], [C[0], y, C[2]], [Math.sin(rad(th)), 0, Math.cos(rad(th))]).t);
      return memo.get(key);
    });
  }
  return DRAPE.get(rig.who);
}

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/sideshave-poses-<who>.json, written by
 * tools/sculpt/lowsideshaveanim.mjs --write), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/sideshave-poses-${who}.json`), 'utf8')); } catch { return []; }
}

/** A hanging vertex's bones: on the head down to wHead under the skull's middle; from there to wBody under it blended
 * into the bones of the skin nearest it (the neck's, the torso's: the hair lies on it and moves with it). */
export function weightOf(rig, C, S, p) {
  const yH = C[1] - S.wHead, yB = C[1] - S.wBody;
  if (p[1] >= yH) return [['head', 1]];
  const t = ramp(yH - p[1], 0, yH - yB), B = rig.B;
  let best = Infinity, near = -1;
  B.verts.forEach((q, i) => { if (!['neck', 'torso'].includes(B.part[i])) return; const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < best) { best = d; near = i; } });
  const w = new Map([['head', 1 - t]]);
  for (const [bn, x] of rig.weights[B.names[near]]) w.set(bn, (w.get(bn) ?? 0) + t * x);
  return [...w].filter(([, x]) => x > 1e-4);
}

/**
 * The side shave on a body: { verts, polys: [{ v, piece, valley?, hang? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid }.
 */
export function buildSideshave(rig, style = SIDESHAVE, { clear = true } = {}) {
  const S = style, B = rig.B, { C, body, polyAt } = radiiOf(rig), drape = drapeOf(rig, C);
  // the columns: the front edge, then per lock its first border's crease edge, its ridge, its last border's; the back
  // edge
  const cols = [{ a: 0, kind: 'edge', lock: 0 }];
  const NL = S.locks.length - 1;
  for (let i = 0; i < NL; i++) {
    const a0 = S.locks[i], a1 = S.locks[i + 1];
    if (i > 0) cols.push({ a: a0 + S.crease, kind: 'border', lock: i });
    cols.push({ a: (a0 + a1) / 2, kind: 'ridge', lock: i });
    if (i + 1 < NL) cols.push({ a: a1 - S.crease, kind: 'border', lock: i, crease: true });
  }
  cols.push({ a: 1, kind: 'edge', lock: NL - 1 });
  for (let j = 0; j + 1 < cols.length; j++) cols[j].creaseNext = cols[j].crease === true;
  const nc = cols.length;
  // (the front locks' last column: the gap from it to the next below splitRow)
  const splitJ = cols.findIndex((c, j) => j + 1 < nc && c.a < S.split && cols[j + 1].a > S.split);
  const KC = S.capRows.length, KH = S.hangRows.length;
  const paths = cols.map((c) => pathOf(B, C, S, c.a));
  const capRel = (c, i) => (i === 0 ? 0 : S.relief * S.capRelief * (c.kind === 'ridge' ? 1 : c.kind === 'edge' ? 0 : -0.6) * Math.min(1, 2 * S.capRows[i]));
  const capOut = (c, d, i) => {
    const f = S.capRows[i], rb = body(d);
    let t = S.partThick + (S.capThick - S.partThick) * Math.min(1, f * 2.2);
    if (c.kind === 'edge' && c.a === 0 && i > 0) { const [th] = angOf(d); t = S.edgeThick[0] + (S.edgeThick[1] - S.edgeThick[0]) * ramp(Math.abs(th), 20, 70); }
    return rb + Math.max(S.minThick, t + capRel(c, i));
  };
  const hairline = B.verts[B.index.get('t0')][1] - S.hairlineDrop;
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
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
      if (c.kind === 'edge' && c.a === 0) { ri = Math.max(ri, rb + S.lip, edgeLift(i)); rr = Math.max(rr, ri + S.minThick); }
      ri = Math.min(ri, rr - S.minThick * 0.5);
      o.push(add(C, mul(d, rr))); n.push(add(C, mul(d, ri)));
    }
    // (the last cap rows' inside level out off what is under them, down to the hang's first row (the ear under the
    // drop), the outside a least thickness over it)
    for (let i = KC - 2; i < KC; i++) {
      const h = [n[i][0] - C[0], n[i][2] - C[2]], l = Math.hypot(...h), az = deg(Math.atan2(h[0], h[1]));
      let need = 0;
      for (let q = 0; q <= 6; q++) need = Math.max(need, drape(az, n[i][1] - (q / 6) * S.dropReach * (i - KC + 2)) + S.clear);
      if (l < need) n[i] = [C[0] + (h[0] * need) / l, n[i][1], C[2] + (h[1] * need) / l];
      const g = [o[i][0] - C[0], o[i][2] - C[2]], lg = Math.hypot(...g);
      if (lg < need + S.minThick) o[i] = [C[0] + (g[0] * (need + S.minThick)) / lg, o[i][1], C[2] + (g[1] * (need + S.minThick)) / lg];
    }
    // (the hair falls from its widest: the last cap rows' greatest distance from the upright axis)
    const D = o[KC - 1], h0 = [D[0] - C[0], D[2] - C[2]], hu = [h0[0] / Math.hypot(...h0), h0[1] / Math.hypot(...h0)];
    const hl = Math.max(...o.slice(KC - 3).map((p) => (p[0] - C[0]) * hu[0] + (p[2] - C[2]) * hu[1]));
    { const h = h0[0] * hu[0] + h0[1] * hu[1]; o[KC - 1] = [D[0] + hu[0] * (hl - h), D[1], D[2] + hu[1] * (hl - h)]; }
    outer.push(o); inner.push(n); hang.push({ D: o[KC - 1], th: deg(Math.atan2(hu[0], hu[1])), hl: hl - capRel(c, KC - 1) });
  }
  // down from the drop to the hem under the shoulder: the azimuth turning to the hem's, out over the body under it
  const yS = rig.bones[rig.at.get('upperarm_r')].head[1];
  const relOf = (c, last) => S.relief * (c.kind === 'ridge' ? 1 : c.kind === 'edge' ? 0 : -0.6) * (last ? 0.3 : 1);
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = outer[j], n = inner[j], { D, th: th0, hl } = hang[j];
    const hemY = yS - table(S.hemAt, c.a);
    let th1 = table(S.hemTh, c.a);
    // (the shorter way round)
    while (th1 - th0 > 180) th1 -= 360;
    while (th1 - th0 < -180) th1 += 360;
    const tipK = 1 + S.tipVar * (hash(c.lock + 1, 3) - 0.5) * 2;
    let Rb = 0;
    for (let i = 0; i < KH; i++) {
      const s = S.hangRows[i], last = i === KH - 1;
      let y = D[1] + (hemY - D[1]) * s;
      if (last) y += c.kind === 'ridge' ? -S.tipLen * tipK : c.kind === 'border' ? S.notch : 0;
      const th = th0 + (th1 - th0) * smooth(ramp(s, S.turn[0], S.turn[1])), hu = [Math.sin(rad(th)), Math.cos(rad(th))];
      const tk = last ? S.tipThick : S.thick * (1 - 0.3 * s);
      // (the base: no nearer the axis than the hang's flare, nor the body under it (at this row and between it and the
      // row above) less drape and a thickness, nor the row above)
      let under = 0;
      for (let q = 0; q <= 3; q++) {
        const sq = S.hangRows[i] - (q / 4) * (S.hangRows[i] - (i ? S.hangRows[i - 1] : 0)), yq = D[1] + (hemY - D[1]) * sq, tq = th0 + (th1 - th0) * smooth(ramp(sq, S.turn[0], S.turn[1]));
        for (const e of [-3, 0, 3]) under = Math.max(under, drape(tq + e, yq));
      }
      Rb = Math.max(Rb, hl * (1 + S.flare * s), under + S.drape + S.thick);
      let R0 = Rb + relOf(c, last);
      let pi = [C[0] + hu[0] * (R0 - tk), y, C[2] + hu[1] * (R0 - tk)];
      const v = sub(pi, C), lv = Math.hypot(...v), dv = mul(v, 1 / lv), rb = body(dv);
      if (lv < rb + S.clear) pi = add(C, mul(dv, rb + S.clear));
      R0 = Math.max(R0, (pi[0] - C[0]) * hu[0] + (pi[2] - C[2]) * hu[1] + S.minThick * 0.5);
      o.push([C[0] + hu[0] * R0, y, C[2] + hu[1] * R0]); n.push(pi);
    }
  }
  // the mesh
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V));
  const NR = KC + KH, gapFrom = KC - 1 + S.splitRow;
  const gap = (j, i) => j === splitJ && i >= gapFrom;
  const poly = (v, sh = {}) => { const u = v.filter((x, k) => x !== v[(k + 1) % v.length]); if (u.length >= 3) polys.push({ v: u, piece: 0, ...sh }); };
  for (let j = 0; j + 1 < nc; j++) {
    const k = j + 1, crease = cols[j].creaseNext ? { valley: S.creaseShade } : {};
    for (let i = 0; i + 1 < NR; i++) {
      if (gap(j, i)) continue;
      const hg = i >= KC - 1 ? { hang: true } : {};
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], { ...(i === 0 ? { valley: S.partShade } : crease), ...hg });
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade, inside: true, row: i, ...hg });
    }
    // the part's rim, and the hem's (the gap's top across it)
    poly([oi[k][0], oi[j][0], ii[j][0], ii[k][0]], { valley: S.rimShade, rim: true, part: true });
    const hr = gap(j, NR - 2) ? gapFrom : NR - 1;
    poly([oi[j][hr], oi[k][hr], ii[k][hr], ii[j][hr]], { valley: S.rimShade, rim: true, hang: true });
  }
  // the side rims: the front edge's and the back edge's, and either side of the gap
  const sideRim = (j, flip, from = 0) => { for (let i = from; i + 1 < NR; i++) { const q = [oi[j][i], oi[j][i + 1], ii[j][i + 1], ii[j][i]]; poly(flip ? q.slice().reverse() : q, { valley: S.rimShade, rim: true, ...(i >= KC - 1 ? { hang: true } : {}) }); } };
  sideRim(0, false); sideRim(nc - 1, true);
  if (splitJ >= 0) { sideRim(splitJ, true, gapFrom); sideRim(splitJ + 1, false, gapFrom); }
  // orientation: outward on the outside
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  for (const p of polys) if (!p.valley) delete p.valley;
  coverSkin(B, C, verts, polys, S.cover);
  const tris = trisOf(verts, polys);
  const pieces = [{ id: 'sideshave', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights: verts.map((p) => weightOf(rig, C, S, p)), pieces, centre: C, k: 1, grid: { cols, outer: oi, inner: ii, splitJ, gapFrom } };
  // (the head's polygons drawn shaved: the left side's named ones, and those the cap covers whole; those and the ones
  // it covers any of, the scalp its inside and the part's root may sink into, left out of the crossings)
  const named = new Set(S.shave), left = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every((v) => B.verts[v][0] > 1e-3 && named.has((B.names[v] ?? '').replace(/\.L$/, '')))) left.push(i); });
  hair.shave = [...new Set([...left, ...scalpOf(B, C, hair, 'every', (p) => !p.hang)])].sort((a, b) => a - b);
  hair.scalp = [...new Set([...left, ...scalpOf(B, C, hair, 'some', (p) => !p.rim)])].sort((a, b) => a - b);
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/** The cap's outside over the head's skin (as tools/sculpt/lowwarrior.mjs coverSkin). */
function coverSkin(B, C, verts, polys, margin) {
  const skinV = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly]; if (p.part !== 'head' || p.mat !== 'skin' || p.ear) continue;
    const [a, b, c] = t.v.map((i) => B.verts[i]);
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

/** Each polygon's triangles, the quad's shorter diagonal. */
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

/**
 * The hair clear of the body at rest and in the game's clips' poses (tools/sculpt/hairs/sideshave-poses-<who>.json): a
 * face of it through the skin that is not the scalp it covers has its corners moved out `step` at a time (through the
 * torso along its polygons' normals; else from the skull's middle, level out below the jaw), an inner corner's outer one with it so the shell
 * keeps its least thickness, until none is.
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, grid } = hair, C = hair.centre, mate = new Map();
  grid.inner.forEach((col, j) => col.forEach((v, i) => { if (v !== grid.outer[j][i]) mate.set(v, grid.outer[j][i]); }));
  const poses = posesOf(rig.who), B = rig.B, nrm = new Map();
  /** A skin polygon's outward normal at rest (away from the body's upright middle line at its height). */
  const normalOf = (sp) => {
    if (!nrm.has(sp)) {
      const P = (B.polys[sp].nv ?? B.polys[sp].v).map((i) => B.verts[i]), m = mul(P.reduce((a, q) => add(a, q), [0, 0, 0]), 1 / P.length);
      let n = [0, 0, 0];
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
      n = unit(n);
      if (dot(n, [m[0], 0, m[2] - C[2]]) < 0) n = mul(n, -1);
      nrm.set(sp, n);
    }
    return nrm.get(sp);
  };
  const states = [{ P: rig.B.verts, f: null, clip: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; })];
  const hitsIn = (st) => quickCrossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts);
  let live = states;
  for (let it = 0; it < 160; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat();
    // (through the torso: out along that polygon's own outward normal at rest, summed over the polygons it crossed;
    // else from the skull's middle, level below the jaw)
    const along = new Map();
    for (const [hp, sp] of hits) if (rig.B.polys[sp].part === 'torso') for (const v of hair.polys[hp].v) along.set(v, add(along.get(v) ?? [0, 0, 0], normalOf(sp)));
    const out = (v) => { if (along.has(v) && Math.hypot(...along.get(v)) > 1e-6) return unit(along.get(v)); const d = sub(verts[v], C); return unit(verts[v][1] < C[1] - 0.3 ? [d[0], 0, d[2]] : d); };
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
      const d = out(v);
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

/** Two triangles through each other (segment-triangle both ways). */
function triTri(A, Bt) {
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true;
  return false;
}

/** tools/sculpt/lowhair.mjs crossings' hits (the hair's triangles through the head's, the neck's and the torso's skin,
 * the scalp it covers left out), the skin's triangles found through a grid of cells: [hair polygon, skin polygon]. */
export function quickCrossings(rig, hair, P, H) {
  const B = rig.B, scalp = new Set(hair.scalp), CELL = 0.25;
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const lo = [0, 1, 2].map((k) => Math.min(...H.map((p) => p[k])) - 0.05), hi = [0, 1, 2].map((k) => Math.max(...H.map((p) => p[k])) + 0.05);
  const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`, cl = (v) => Math.floor(v / CELL);
  for (const t of B.tris) {
    const p = B.polys[t.poly];
    if (!['head', 'neck', 'torso'].includes(p.part) || (scalp.has(t.poly) && t.v.every(rigid))) continue;
    const T = t.v.map((i) => P[i]), a = [0, 1, 2].map((k) => Math.min(...T.map((q) => q[k]))), b = [0, 1, 2].map((k) => Math.max(...T.map((q) => q[k])));
    if (a.some((x, k) => x > hi[k]) || b.some((x, k) => x < lo[k])) continue;
    const e = { T, a, b, poly: t.poly };
    for (let x = cl(a[0]); x <= cl(b[0]); x++) for (let y = cl(a[1]); y <= cl(b[1]); y++) for (let z = cl(a[2]); z <= cl(b[2]); z++) { const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e); }
  }
  const hits = [];
  for (const [ta, tb, tc, pi] of hair.tris) {
    const A = [H[ta], H[tb], H[tc]], a = [0, 1, 2].map((k) => Math.min(A[0][k], A[1][k], A[2][k])), b = [0, 1, 2].map((k) => Math.max(A[0][k], A[1][k], A[2][k]));
    const seen = new Set();
    let hit = -1;
    for (let x = cl(a[0]); x <= cl(b[0]) && hit < 0; x++) for (let y = cl(a[1]); y <= cl(b[1]) && hit < 0; y++) for (let z = cl(a[2]); z <= cl(b[2]) && hit < 0; z++) {
      for (const e of grid.get(key(x, y, z)) ?? []) {
        if (seen.has(e)) continue; seen.add(e);
        if (e.a.some((v, k) => v > b[k]) || e.b.some((v, k) => v < a[k])) continue;
        if (triTri(A, e.T)) { hit = e.poly; break; }
      }
    }
    if (hit >= 0) hits.push([pi, hit]);
  }
  return hits;
}

/** The side shave on a body, as the game takes it. */
export const sideshaveOf = (rig, style = SIDESHAVE) => buildSideshave(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildSideshave(rig, SIDESHAVE, { clear: !args.includes('--raw') });
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'open edges', openEdges(hair), 'shave', hair.shave.length, 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'split after', hair.grid.splitJ, 'cleared in', JSON.stringify(hair.clearedIn?.reduce((a, x) => a + x, 0)), 'ms', Date.now() - t0);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
