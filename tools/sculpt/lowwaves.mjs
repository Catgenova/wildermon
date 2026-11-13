// Long waves for the low-poly bodies: the game's 'waves', "Long waves". Modelled from its description
// (tools/sculpt/hairs/waves.mjs, no sheet), in the shape of the shoulder length (tools/sculpt/lowwarrior.mjs): one shell of
// locks over the skull, fitted to each body's own head, its hang lying on the body's own shoulders, chest and back.
//
//   columns  per side the lock borders: each border a path over the skull from the parting (a little toward her left)
//            to where the hair starts to hang, the front edge along the hairline and over the ear's root; per lock a
//            ridge between its two borders stood out and the borders sunk, each border a narrow crease in the valleys'
//            shade. Her right mirrors her left, but for the parting; the two sides meet on it and down the back's middle.
//   rows     over the skull from the parting to the hang, then down: the front locks round over the shoulder's top onto
//            the chest, the rest down the back to its middle, falling free from the head's widest and then lying on the
//            body; each lock swayed either way down its length (the waves), its ridge out at each crest; each lock's tip
//            below its borders and thin. Under the shoulder's top the front and the back are two pieces.
//   inside   sunk into the scalp under the cap, a thickness in from the outside where it hangs, off the skin where it is
//            not the scalp; the rims between the two at the hems, the front edges and the split in the valleys' shade.
//
// The cap and the hang's top rigid on the head; lower down, by its fall and where it comes down onto the body, the bones
// of the skin under it (weightOf), so it rides on the neck, the shoulders, the chest and the back. Kept off the face, the
// ears, the neck, the shoulders, the chest, the back and the arms at rest and in every one of the game's clips' poses
// (clearBody; the poses tools/sculpt/hairs/waves-poses-<who>.json, tools/sculpt/lowwavesanim.mjs --write).
//
//   node tools/sculpt/lowwaves.mjs [--who female,male] [--noclear] [--clips]   # counts, open edges, crossings at rest
//   and posed (--clips: the most in one of the clips' poses, by clip); WAVES_CACHE=<dir> keeps the clearing (clearBody)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { openEdges, skinHair } from './lowhair.mjs';
import { POSES } from './lowbob.mjs';
import { radiiOf, dirOf } from './lowwarrior.mjs';
import WAVES from './hairs/waves.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const smooth = (x) => x * x * (3 - 2 * x);
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

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

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/waves-poses-<who>.json), or none. */
export function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/waves-poses-${who}.json`), 'utf8')); } catch { return []; }
}

/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}

/** A border's path over the skull (her left), at a in [0, 1]: its directions at the style's capRows. */
function pathOf(S, a) {
  const K = S.keys, j = Math.max(0, Math.min(K.length - 2, K.findIndex((k, i) => i + 1 < K.length && a <= K[i + 1].a)));
  const k0 = K[j], k1 = K[j + 1], t = (a - k0.a) / (k1.a - k0.a);
  const ctrl = k0.pts.map((p, i) => unit(lerp(dirOf(...p), dirOf(...k1.pts[i]), t)));
  const fine = Array.from({ length: 121 }, (_, i) => unit(spline(ctrl, i / 120)));
  const len = [0];
  for (let i = 1; i < fine.length; i++) len.push(len[i - 1] + Math.acos(Math.min(1, dot(fine[i - 1], fine[i]))));
  return S.capRows.map((f) => {
    const L = f * len.at(-1); let i = 1; while (i < len.length - 1 && len[i] < L) i++;
    const u = (L - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
    return unit(lerp(fine[i - 1], fine[i], Math.min(1, Math.max(0, u))));
  });
}

/** The parting off the middle: a direction over the skull moved round toward her left, most at the forehead's top. */
function parted(S, d) {
  const [th, ph] = angOf(d), w = Math.cos(rad(th) / 2) ** 2 * ramp(ph, -10, 30);
  return dirOf(th + S.partShift * w, ph);
}

/** A hanging corner's bones: the head's, giving way by its fall under the skull's middle (u, S.weights.head) or as it
 * comes down onto the body (its gap off it, S.weights.contact) to those of the skin under it (`uw`, bone → weight), so
 * where it lies on the body it rides on it; the heaviest four (the game's per corner). */
function weightOf(S, u, { uw, gap }) {
  const [a, b] = S.weights.head, k = Math.max(ramp(u, a, b), 1 - ramp(gap, 0, S.weights.contact));
  const tot = [...uw.values()].reduce((s, w) => s + w, 0), m = new Map([['head', 1 - k]]);
  if (tot < 1e-6) m.set('neck_01', k);
  for (const [bn, w] of uw) m.set(bn, (m.get(bn) ?? 0) + (w / Math.max(tot, 1e-6)) * k);
  const top = [...m].filter(([, w]) => w > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((s, [, w]) => s + w, 0);
  return top.map(([bn, w]) => [bn, w / sum]);
}

const BODY = new Map();
/** The body's skin (the head, the neck, the torso, the shoulder joints) as a radius from the upright axis through the
 * skull's middle: r(az, y), the furthest crossing of the level ray toward az (degrees from the front, toward her left);
 * w(az, y) the skin's bones and weights there (its triangle's corners', by where the ray meets it). */
function bodyRadius(rig, C) {
  if (BODY.has(rig.who)) return BODY.get(rig.who);
  const B = rig.B, T = B.tris.filter((t) => ['head', 'neck', 'torso', 'joint'].includes(B.polys[t.poly].part)).map((t) => ({ P: t.v.map((i) => B.verts[i]), poly: t.v }));
  const memo = new Map();
  const hit = (az, y) => {
    const k = `${az.toFixed(2)}|${y.toFixed(3)}`;
    if (!memo.has(k)) {
      const o = [C[0], y, C[2]], d = [Math.sin(rad(az)), 0, Math.cos(rad(az))], h = farHit(T, o, d), w = new Map();
      if (h.poly !== -1) {
        // (the corners' shares: the triangle's barycentric weights where the ray meets it)
        const [A, Bv, Cv] = h.poly.map((i) => B.verts[i]), p = add(o, mul(d, h.t)), n = cross(sub(Bv, A), sub(Cv, A)), nn = dot(n, n);
        const bary = [cross(sub(Cv, Bv), sub(p, Bv)), cross(sub(A, Cv), sub(p, Cv)), cross(sub(Bv, A), sub(p, A))].map((x) => Math.max(0, dot(n, x) / nn));
        h.poly.forEach((vi, k2) => { for (const [bn, bw] of rig.weights[B.names[vi]]) w.set(bn, (w.get(bn) ?? 0) + bw * bary[k2]); });
      }
      memo.set(k, { t: h.t, w });
    }
    return memo.get(k);
  };
  const out = { r: (az, y) => hit(az, y).t, w: (az, y) => hit(az, y).w };
  BODY.set(rig.who, out);
  return out;
}

/**
 * Long waves on a body: { verts, polys: [{ v, piece, valley?, hang?, inside?, rim? }], tris: [[a, b, c, poly]], weights,
 * pieces, shave, scalp, centre, k, grid }.
 */
export function buildWaves(rig, style = WAVES, { clear = true } = {}) {
  const S = style, B = rig.B, { C, body, polyAt } = radiiOf(rig), BR = bodyRadius(rig, C);
  // the columns, her left: the front edge, then per lock its first border's crease edge, its ridge, its last border's
  const half = [{ a: 0, kind: 'edge', lock: 0 }];
  for (let i = 0; i + 1 < S.locks.length; i++) {
    const a0 = S.locks[i], a1 = S.locks[i + 1];
    if (i > 0) half.push({ a: a0 + S.crease, kind: 'border', lock: i });
    half.push({ a: (a0 + a1) / 2, kind: 'ridge', lock: i });
    half.push({ a: a1 - S.crease, kind: 'border', lock: i, crease: true });
  }
  for (const c of half) c.front = c.lock < S.front;
  // both sides: her right (x mirrored) from its front edge back, then her left from the back to its front edge
  const cols = [...half.map((c) => ({ ...c, side: -1 })), ...half.slice().reverse().map((c) => ({ ...c, side: 1 }))];
  for (let j = 0; j + 1 < cols.length; j++) {
    const c = cols[j], n = cols[j + 1];
    c.creaseNext = (c.side < 0 && n.side < 0 && c.crease === true) || (c.side < 0 && n.side > 0) || (c.side > 0 && n.side > 0 && c.kind === 'border' && !c.crease && n.crease === true);
  }
  const nc = cols.length;
  const mirror = (d, s) => [d[0] * s, d[1], d[2]];
  const KC = S.capRows.length;
  const paths = cols.map((c) => pathOf(S, c.a).map((d) => parted(S, mirror(d, c.side))));
  const capRel = (c, i) => (i === 0 ? 0 : S.relief * S.capRelief * (c.kind === 'ridge' ? 1 : -0.6) * Math.min(1, 2 * S.capRows[i]));
  const capOut = (c, d, i) => {
    const f = S.capRows[i], rb = body(d);
    let t = S.partThick + (S.capThick - S.partThick) * Math.min(1, f * 1.6);
    if (c.kind === 'edge' && i > 0) { const [th] = angOf(d); t = S.edgeThick[0] + (S.edgeThick[1] - S.edgeThick[0]) * ramp(Math.abs(th), 20, 70); }
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
      if (c.kind === 'edge') { ri = Math.max(ri, rb + S.lip, edgeLift(i)); rr = Math.max(rr, ri + S.minThick); }
      ri = Math.min(ri, rr - S.minThick * 0.5);
      o.push(add(C, mul(d, rr))); n.push(add(C, mul(d, ri)));
    }
    // (the hair falls from its widest: the last cap rows' greatest distance from the upright axis)
    const D = o[KC - 1], h0 = [D[0] - C[0], D[2] - C[2]], hu = [h0[0] / Math.hypot(...h0), h0[1] / Math.hypot(...h0)];
    const hl = Math.max(...o.slice(KC - 3).map((p) => (p[0] - C[0]) * hu[0] + (p[2] - C[2]) * hu[1]));
    { const h = h0[0] * hu[0] + h0[1] * hu[1]; o[KC - 1] = [D[0] + hu[0] * (hl - h), D[1], D[2] + hu[1] * (hl - h)]; }
    outer.push(o); inner.push(n); hang.push({ D: o[KC - 1], hl: hl - capRel(c, KC - 1), az0: c.side * Math.abs(deg(Math.atan2(hu[0], hu[1]))) });
  }
  // the hems: the back's at mid-back (its middle longer), the front's over the chest
  const yBack = rig.bones[rig.at.get('spine_03')].head[1] + S.hemBack;
  const yFront = rig.bones[rig.at.get('clavicle_l')].head[1] + S.hemFront;
  const aSplit = S.locks[S.front];
  // down from the drop: round toward where the lock ends up, falling free and then on the body, swayed in waves
  const outDir = new Map(), under = new Map();
  const W = S.wave;
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = outer[j], n = inner[j], { D, hl, az0 } = hang[j];
    const KH = c.front ? S.frontRows : S.backRows;
    const share = c.front ? c.a / aSplit : (c.a - aSplit) / (1 - aSplit);
    const FA = S.frontAz[rig.who];
    const azEnd = c.side * (c.front ? FA[0] + (FA[1] - FA[0]) * share : S.backAz[0] + (S.backAz[1] - S.backAz[0]) * share);
    const yHem = c.front ? yFront : yBack - S.hemU * share;
    const tipK = 1 + S.tipVar * (hash(c.lock + 1, c.side) - 0.5) * 2;
    const lockPh = c.lock * W.lockPhase + (c.side > 0 ? 0.7 : 0);
    for (let i = 1; i <= KH; i++) {
      const s = i / KH, last = i === KH;
      let y = D[1] + (yHem - D[1]) * s;
      if (last) y += c.kind === 'ridge' ? -S.tipLen * tipK : c.kind === 'border' ? S.notch : 0;
      const fall = D[1] - y, ph = (2 * Math.PI * fall) / W.len, wv = ramp(fall, W.fade[0], W.fade[1]);
      const th = last ? S.tipThick : S.thick * (1 - 0.3 * s);
      const rFree = hl * (1 + S.flare * s);
      // (round toward its end, the sway on top: the same sway everywhere, so neighbouring locks never cross)
      let az = az0 + (azEnd - az0) * smooth(ramp(fall, S.azOver[0], S.azOver[1]));
      az += deg((W.amp * wv * Math.sin(ph)) / Math.max(0.4, rFree));
      // (the body's furthest within half a row up and down and a few degrees round: the faces between rows clear it too)
      const dy = Math.abs(yHem - D[1]) / KH / 2;
      let rb = 0;
      const uw = new Map();
      for (const ea of [-4, 0, 4]) for (const ey of [-dy, 0, dy]) { rb = Math.max(rb, BR.r(az + ea, y + ey)); for (const [bn, w] of BR.w(az + ea, y + ey)) uw.set(bn, (uw.get(bn) ?? 0) + w / 9); }
      const hugK = ramp(fall, S.hug[0], S.hug[1]);
      const rIn = Math.max(rb + S.clear, (rFree - th) * (1 - hugK) + (rb + S.clear) * hugK);
      const bulge = W.bulge * wv * (0.5 + 0.5 * Math.sin(ph + lockPh)) * (c.kind === 'ridge' ? 1 : 0.4);
      const rOut = rIn + th + (last ? 0 : S.relief * (c.kind === 'ridge' ? 1 : -0.6) + bulge);
      const h = [Math.sin(rad(az)), Math.cos(rad(az))];
      const pi = [C[0] + h[0] * rIn, y, C[2] + h[1] * rIn], po = [C[0] + h[0] * Math.max(rOut, rIn + S.minThick * 0.5), y, C[2] + h[1] * Math.max(rOut, rIn + S.minThick * 0.5)];
      o.push(po); n.push(pi); under.set(`${j},${o.length - 1}`, { uw, gap: rIn - rb - S.clear });
    }
  }
  // the mesh: the parting's corners shared by the two sides
  const verts = [], polys = [], weights = [];
  const V = (p, w, out) => { const i = verts.push(p) - 1; weights.push(w); outDir.set(i, out); return i; };
  const partO = new Map(), partI = new Map();
  const key = (a) => a.toFixed(5);
  const wOf = (j, i, p) => (i < KC ? [['head', 1]] : weightOf(S, C[1] - p[1], under.get(`${j},${i}`)));
  const dOf = (i, p) => (i < KC ? unit(sub(p, C)) : unit([p[0] - C[0], 0, p[2] - C[2]]));
  const idx = (pts, map) => pts.map((col, j) => col.map((p, i) => {
    if (i) return V(p, wOf(j, i, p), dOf(i, p));
    const k = key(cols[j].a);
    if (!map.has(k)) map.set(k, V(p, [['head', 1]], dOf(0, p)));
    return map.get(k);
  }));
  const oi = idx(outer, partO), ii = idx(inner, partI);
  const poly = (v, sh = {}) => { const u = v.filter((x, k) => x !== v[(k + 1) % v.length]); if (u.length >= 3) polys.push({ v: u, piece: 0, ...sh }); };
  const rs = KC - 1 + S.splitRow;
  const split = (j) => cols[j].front !== cols[j + 1].front;
  for (let j = 0; j + 1 < nc; j++) {
    const k = j + 1, crease = cols[j].creaseNext ? { valley: S.creaseShade } : {};
    const NR = split(j) ? rs + 1 : Math.min(oi[j].length, oi[k].length);
    for (let i = 0; i + 1 < NR; i++) {
      const hg = i >= KC - 1 ? { hang: true } : {};
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], { ...(i === 0 && Math.max(cols[j].a, cols[k].a) <= S.partTo ? { valley: S.partShade } : i === 0 ? {} : crease), ...hg });
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade, inside: true, row: i, ...hg });
    }
    // the hem's rim (and the split's crotch)
    poly([oi[j][NR - 1], oi[k][NR - 1], ii[k][NR - 1], ii[j][NR - 1]], { valley: S.rimShade, rim: true, hang: true });
  }
  // the open sides' rims: the front edges', her right's and her left's, and each side of the split under it
  const sideRim = (j, from, first) => {
    for (let i = from; i + 1 < oi[j].length; i++) {
      const q = [oi[j][i], oi[j][i + 1], ii[j][i + 1], ii[j][i]];
      poly(first ? q : q.slice().reverse(), { valley: S.rimShade, rim: true, ...(i >= KC - 1 ? { hang: true } : {}) });
    }
  };
  sideRim(0, 0, true); sideRim(nc - 1, 0, false);
  for (let j = 0; j + 1 < nc; j++) if (split(j)) { sideRim(j, rs, false); sideRim(j + 1, rs, true); }
  // orientation: outward on the outside
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  for (const p of polys) if (!p.valley) delete p.valley;
  coverSkin(B, C, verts, polys, S.cover);
  const tris = trisOf(verts, polys);
  const pieces = [{ id: 'waves', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights, pieces, centre: C, k: 1, outDir, grid: { cols, outer: oi, inner: ii } };
  hair.shave = scalpOf(B, C, hair, 'every', (p) => !p.hang);
  hair.scalp = scalpOf(B, C, hair, 'some', (p) => !p.rim);
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/** The cap's outside over the head's skin (tools/sculpt/lowwarrior.mjs coverSkin). */
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

/** The head's skin polygons (not the ears) under the hair's polygons that pass `keep`, seen from the skull's middle. */
function scalpOf(B, C, hair, how, keep) {
  const T = hair.tris.filter(([, , , pi]) => keep(hair.polys[pi])).map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]], poly: 0 })), memo = new Map();
  const under = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v[how](under)) out.push(i); });
  return out;
}

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

/** The parts of the body the hair is kept off (the arms too: the long hair meets them). */
export const PARTS = ['head', 'neck', 'torso', 'joint', 'arm'];
/** The hair's triangles through the body's (the parts given; the scalp it covers left out, its rigid part): per hair
 * polygon the skin polygon it crosses. */
export function crossings(rig, hair, P, H, parts = PARTS) {
  const B = rig.B, scalp = new Set(hair.scalp ?? hair.shave);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => { const p = B.polys[t.poly]; return parts.includes(p.part) && !(scalp.has(t.poly) && t.v.every(rigid)); });
  // (the skin's triangles in a grid of cells G wide, each hair triangle tried against those in the cells it spans)
  const G = 0.3, cellOf = (x) => Math.floor(x / G), grid = new Map(), tb = new Float64Array(skinT.length * 6);
  skinT.forEach((t, s) => {
    const [a, b, c] = t.v.map((i) => P[i]);
    for (let k = 0; k < 3; k++) { tb[s * 6 + k] = Math.min(a[k], b[k], c[k]); tb[s * 6 + 3 + k] = Math.max(a[k], b[k], c[k]); }
    for (let x = cellOf(tb[s * 6]); x <= cellOf(tb[s * 6 + 3]); x++) for (let y = cellOf(tb[s * 6 + 1]); y <= cellOf(tb[s * 6 + 4]); y++) for (let z = cellOf(tb[s * 6 + 2]); z <= cellOf(tb[s * 6 + 5]); z++) {
      const key = (x + 500) * 1e6 + (y + 500) * 1e3 + (z + 500);
      let l = grid.get(key); if (!l) grid.set(key, (l = [])); l.push(s);
    }
  });
  const seen = new Int32Array(skinT.length).fill(-1), hits = [];
  hair.tris.forEach(([a, b, c, pi], ti) => {
    const A = [H[a], H[b], H[c]], lo = [0, 1, 2].map((k) => Math.min(A[0][k], A[1][k], A[2][k])), hi = [0, 1, 2].map((k) => Math.max(A[0][k], A[1][k], A[2][k]));
    for (let x = cellOf(lo[0]); x <= cellOf(hi[0]); x++) for (let y = cellOf(lo[1]); y <= cellOf(hi[1]); y++) for (let z = cellOf(lo[2]); z <= cellOf(hi[2]); z++) {
      const l = grid.get((x + 500) * 1e6 + (y + 500) * 1e3 + (z + 500)); if (!l) continue;
      for (const s of l) {
        if (seen[s] === ti) continue; seen[s] = ti;
        if (hi[0] < tb[s * 6] || lo[0] > tb[s * 6 + 3] || hi[1] < tb[s * 6 + 1] || lo[1] > tb[s * 6 + 4] || hi[2] < tb[s * 6 + 2] || lo[2] > tb[s * 6 + 5]) continue;
        if (triTri(A, skinT[s].v.map((i) => P[i]))) { hits.push([pi, skinT[s].poly]); return; }
      }
    }
  });
  return { n: hits.length, hits };
}

/** The crossings by where: the face, the ears, the neck, the torso (chest, shoulders, back), the arms, the scalp's edge. */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const B = rig.B, r = crossings(rig, hair, P, Hv), out = { face: 0, ear: 0, neck: 0, torso: 0, arm: 0, edge: 0 };
  const C = hair.centre;
  for (const [, sp] of r.hits) {
    const poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
    out[poly.part === 'neck' ? 'neck' : poly.part === 'torso' || poly.part === 'joint' ? 'torso' : poly.part === 'arm' ? 'arm' : poly.ear ? 'ear' : c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25 ? 'face' : 'edge']++;
  }
  return out;
}

/**
 * The hair clear of the body at rest and in the game's clips' poses (tools/sculpt/hairs/waves-poses-<who>.json): a face
 * of it through the skin that is not the scalp it covers has its corners moved out `step` at a time (the cap's from the
 * skull's middle, the hang's level out from the upright axis), an inner corner's outer one with it so the shell keeps its
 * least thickness, until none is. Where an arm passes through the hanging hair (moving out does not get it away from an
 * arm swung across it), its corners are moved the other way, at most S.armGive: in a lock's last S.liftRows rows lifted (the
 * lock's end drawn up), over it (beside the jaw) the outside pressed in toward the neck. Arm crossings that cannot be
 * cleared that way are left (hair.clearedIn counts them).
 * WAVES_CACHE=<dir>: the cleared corners kept there, by what went in, for the review renders.
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, grid, outDir } = hair, mate = new Map();
  const other = new Map(), at = new Map();
  for (const g of [grid.outer, grid.inner]) g.forEach((col, j) => col.forEach((v, i) => at.set(v, [j, i])));
  // (the columns of a corner's lock, its side's: a lock moves as one)
  const lockOf = (j) => grid.cols.flatMap((c, jj) => (c.lock === grid.cols[j].lock && c.side === grid.cols[j].side ? [jj] : []));
  grid.inner.forEach((col, j) => col.forEach((v, i) => { if (v !== grid.outer[j][i]) { mate.set(v, grid.outer[j][i]); other.set(grid.outer[j][i], v); } }));
  const poses = posesOf(rig.who);
  const states = [{ P: rig.B.verts, f: null, clip: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  const cache = process.env.WAVES_CACHE && join(process.env.WAVES_CACHE, `waves-${rig.who}-${createHash('sha1').update(JSON.stringify([S, verts, hair.weights, poses, clearBody.toString()])).digest('hex').slice(0, 16)}.json`);
  if (cache && existsSync(cache)) {
    const kept = JSON.parse(readFileSync(cache, 'utf8'));
    kept.verts.forEach((p, i) => { verts[i] = p; });
    Object.assign(hair, { clearedIn: kept.clearedIn, clearedClips: kept.clearedClips });
    return hair;
  }
  let live = states;
  const moved = new Map();
  for (let it = 0; it < 200; it++) {
    // (every state again when the last ones are clear, and every 10th round: a move for one pose can cross in another)
    let per = live.map((st) => hitsIn(st));
    if ((!per.some((h) => h.length) || it % 10 === 9) && live !== states) { live = states; per = live.map((st) => hitsIn(st)); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat();
    if (process.env.WAVES_LOG) console.log(rig.who, 'clearing round', it, live.length, 'poses crossing', hits.length, live.slice(0, 6).map((s) => s.clip).join());
    // (nothing left that may move: only arms, through corners already moved their most)
    const free = (v) => (moved.get(v) ?? 0) <= S.armGive;
    if (hits.every(([hp, sp]) => rig.B.polys[sp].part === 'arm' && !hair.polys[hp].v.some(free))) break;
    // (a hanging corner an arm passes through: in a lock's last S.liftRows rows the lock drawn back up its own length,
    // its inside or outside with it; over them the outside pressed in toward the neck)
    const lift = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'arm').flatMap(([hp]) => hair.polys[hp].v).filter((v) => outDir.get(v)[1] === 0));
    const done = new Set();
    for (const v of lift) {
      if (done.has(v) || (moved.get(v) ?? 0) > S.armGive) continue;
      const [j, i] = at.get(v);
      if (i > grid.outer[j].length - 1 - S.liftRows) {
        // (each of the last rows moved back toward the row over it, the end the most: the lock shortened along the
        // line it lies on, its rows kept in order)
        for (const jj of lockOf(j)) for (const col of [grid.outer[jj], grid.inner[jj]]) {
          const n = col.length - 1, top = n - S.liftRows + 1, was = col.map((u) => verts[u]);
          for (let k = top; k <= n; k++) {
            const u = col[k];
            if (done.has(u)) continue;
            const by = (step * (k - top + 1)) / (n - top + 1), to = sub(was[k - 1], was[k]), l = Math.hypot(...to);
            verts[u] = add(was[k], mul(to, Math.min(0.5, by / Math.max(l, 1e-6)))); done.add(u); moved.set(u, (moved.get(u) ?? 0) + by);
          }
        }
        continue;
      }
      if (mate.has(v)) continue;
      moved.set(v, (moved.get(v) ?? 0) + step);
      // (the inside with it where the shell would get thinner than its least)
      const d = mul(outDir.get(v), -step);
      verts[v] = add(verts[v], d);
      const iv = other.get(v);
      if (iv !== undefined && dot(sub(verts[v], verts[iv]), outDir.get(v)) < S.minThick * 0.5) verts[iv] = add(verts[iv], d);
    }
    // (a hanging corner moved with the lock under it, outside and inside, so a lock's end moves out whole, no spikes)
    const push = new Set();
    for (const v of new Set(hits.filter(([, sp]) => rig.B.polys[sp].part !== 'arm').flatMap(([hp]) => hair.polys[hp].v))) {
      if (outDir.get(v)[1] !== 0 || !at.has(v)) { push.add(v); continue; }
      const [j, i] = at.get(v);
      for (const jj of lockOf(j)) for (const col of [grid.outer[jj], grid.inner[jj]]) for (let k = i; k < col.length; k++) push.add(col[k]);
    }
    for (const v of push) {
      const d = outDir.get(v);
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) {
        const gap = dot(sub(verts[o], verts[v]), d);
        if (gap < S.minThick * 0.5) verts[o] = add(verts[o], mul(d, S.minThick * 0.5 - gap));
      }
    }
  }
  hair.clearedIn = states.map((st) => hitsIn(st).length);
  hair.clearedClips = states.filter((_, k) => hair.clearedIn[k]).map((s) => s.clip);
  if (cache) writeFileSync(cache, JSON.stringify({ verts, clearedIn: hair.clearedIn, clearedClips: hair.clearedClips }));
  return hair;
}

/** Long waves on a body, as the game takes it. */
export const wavesOf = (rig, style = WAVES) => buildWaves(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildWaves(rig, WAVES, { clear: !args.includes('--noclear') });
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'shave', hair.shave.length, 'columns', hair.grid.cols.length, 'left crossing in', JSON.stringify(hair.clearedClips ?? []), 'ms', Date.now() - t0);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
    // (with --clips: the most crossings in one of the clips' poses written for the clearing, by clip)
    if (args.includes('--clips')) {
      const by = {};
      for (const pose of posesOf(who)) {
        const f = posed(rig, pose), x = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)), c = pose.$clip.split(' ')[0];
        const n = Object.values(x).reduce((a, b) => a + b, 0); if (n > (by[c]?.n ?? 0)) by[c] = { n, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v)), at: pose.$clip.split(' ')[1] };
      }
      console.log(who, 'most in a pose, by clip', JSON.stringify(by));
    }
  }
}
