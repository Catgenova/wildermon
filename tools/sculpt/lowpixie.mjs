// The pixie cut (tools/sculpt/hairs/pixie.mjs) for the low-poly bodies: the game's 'pixie', "Pixie cut". No reference
// sheet: built straight on each body's own skull from the style's numbers, as one closed shell of locks (buildPixie), in
// the crew cut's way (tools/sculpt/lowcrew.mjs) with the top swept to one side:
//
//   whorl    the locks run out from one point at the back of the crown (the style's pole); each column a direction round
//            it, turned toward her right along its length by the style's sweep (most at the front, none at the back).
//   hairline the hair's edge on the skull, off the body's own marks (hairlineOf): the forehead's (t0), the temples, a short
//            sideburn, over the ear, behind it, the nape's point.
//   fringe   the edge the locks run to (edgeOf): the hairline, or lower where the style's fringe line over the forehead
//            is (high at her left temple, low at her right, above the brows: from the brows' top to the hairline by share);
//            the locks past the hairline lie on the forehead, their tips' outside easing to the fringe's tip height.
//   tips     a ridge's end past the edge, a border's short of it (each lock ends in a point), over the forehead and at the
//            nape; the tip's cut in the valleys' shade.
//   height   off the skin: the top (high up the head) topBack to topFront, the sides and the back side/back, fading to
//            `edge` at the hairline (the taper to the ears and the nape), not where the locks run on as the fringe.
//   locks    a ridge between each two borders stood out, the borders sunk; the top's and the fringe's borders each a narrow
//            crease in a valley shade.
//   inside   the shell's inner side sunk into the scalp, `lip` off the forehead under the fringe; the rim at the edge.
//
// Each vertex weighted as the skin under it (the skin's triangle hit from the skull's middle, its corners' weights
// blended), so the hair moves with the scalp; the outside kept clear of the skin at rest (clearSkin). The scalp it covers:
// the head's polygons with a corner under the hair short of the hairline; those wholly under it drawn in the shaved tone.
//
//   node tools/sculpt/lowpixie.mjs [--who female,male]   # counts, open edges, crossings at rest and with the head turned
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { openEdges, skinHair } from './lowhair.mjs';
import { POSES, crossReport } from './lowbob.mjs';
import PIXIE from './hairs/pixie.mjs';

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
/** A direction from the skull's middle: theta round from the front toward her left, phi up from level (degrees). */
export const dirOf = (th, ph) => { const t = th * RAD, p = ph * RAD; return [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)]; };
const angOf = (d) => [Math.atan2(d[0], d[2]) * DEG, Math.asin(Math.max(-1, Math.min(1, d[1]))) * DEG];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
/** A piecewise-linear table [[x, y], ...] (x rising) read at x, held at its ends. */
const table = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 0; i + 1 < T.length; i++) if (x <= T[i + 1][0]) { const [x0, y0] = T[i], [x1, y1] = T[i + 1]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return T.at(-1)[1];
};

/** The furthest crossing of a ray from o along unit d with triangles ({ P: three points, v }), with its barycentrics. */
function farHit(tris, o, d) {
  let best = { t: 0, tri: null, u: 0, v: 0 };
  for (const tri of tris) {
    const [a, b, c] = tri.P, e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-9 || u > 1 + 1e-9) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
    const t = dot(e2, q) / det; if (t > best.t) best = { t, tri, u, v };
  }
  return best;
}

/** The hairline on both sides, [theta, phi] from her right's back (-180) round the front to her left's back (180), off
 * the body's own marks; and the brows' top (phi) and the forehead's hairline (phi). */
export function hairlineOf(rig, C, S = PIXIE) {
  const B = rig.B, P = (n) => B.verts[B.index.get(n)], ang = (p) => angOf(unit(sub(p, C)));
  const front = ang(P('t0'))[1] - S.frontDrop;
  const brow = Math.max(...B.names.map((n, i) => (n && n.startsWith('brow') ? ang(B.verts[i])[1] : -90)));
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? ang(B.verts[i]) : null)).filter(Boolean);
  const top = Math.max(...ear.map((a) => a[1])), upper = ear.filter((a) => a[1] > top - 22);
  const eF = Math.min(...upper.map((a) => a[0])), eB = Math.max(...upper.map((a) => a[0]));
  const left = [
    [0, front], ...S.temple.map(([th, d]) => [th, front + d]),
    // the sideburn: its front edge down to a point, its foot back to the ear
    [eF - S.sideburnW, top - S.sideburn * 0.4], [eF - S.sideburnW * 0.5, top - S.sideburn], [eF - 1, top - S.sideburn * 0.5],
    // up the ear's front, over its top, down behind it (clear of the ear's back, which stands off the head)
    [eF + 1, top + S.overEar * 0.5], [(eF + eB) / 2, top + S.overEar], [eB + 4, top + S.overEar * 0.8], [eB + S.behindEar, top - 2], [eB + S.behindEar + 6, top - 12],
    // round to the nape, its sides up and its middle down to a point (the taper)
    [eB + S.behindEar + 20, (top - 12 + S.napeSide) / 2], [148, S.napeSide], [180, S.nape],
  ];
  const line = [...left.slice(1).reverse().map(([t, p]) => [-t, p]), ...left];
  return { line, brow, front };
}

/** The pole's frame: p the pole, f toward the front across it, l toward her left; at(al, be) the direction be degrees
 * from the pole at al round it, polar(d) the reverse. */
function frameOf(S) {
  const p = dirOf(...S.pole), f = unit(sub([0, 0, 1], mul(p, p[2]))), l = cross(p, f);
  return { p, f, l, at: (al, be) => { const a = al * RAD, b = be * RAD; return unit(add(mul(p, Math.cos(b)), mul(add(mul(f, Math.cos(a)), mul(l, Math.sin(a))), Math.sin(b)))); }, polar: (d) => [Math.atan2(dot(d, l), dot(d, f)) * DEG, Math.acos(Math.max(-1, Math.min(1, dot(d, p)))) * DEG] };
}

/** A line [[theta, phi], ...] (both sides, theta rising) as a reach: per angle round the pole, its distance from the pole
 * (degrees) where it crosses that column (the furthest crossing). */
function reachOf(line, F) {
  const dense = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [t0, p0] = line[i], [t1, p1] = line[i + 1], n = Math.max(1, Math.ceil(Math.hypot(t1 - t0, p1 - p0)));
    for (let k = 0; k < n; k++) dense.push([t0 + ((t1 - t0) * k) / n, p0 + ((p1 - p0) * k) / n]);
  }
  dense.push(line.at(-1));
  const pol = dense.map(([t, p]) => F.polar(dirOf(t, p)));
  return (al) => {
    let best = 0;
    for (let i = 0; i + 1 < pol.length; i++) {
      const [a0, b0] = pol[i], [a1, b1] = pol[i + 1];
      const d0 = ((al - a0 + 540) % 360) - 180, d1 = ((al - a1 + 540) % 360) - 180, span = ((a1 - a0 + 540) % 360) - 180;
      if (Math.abs(span) < 1e-9 || Math.sign(d0) === Math.sign(d1) && d0 !== 0) continue;
      if (Math.abs(span) > 90 || Math.abs(d0) > 90 || Math.abs(d1) > 90) continue;
      const s = d0 / (d0 - d1), b = b0 + (b1 - b0) * s;
      if (b > best) best = b;
    }
    return best;
  };
}

/** The edge the locks run to: the hairline, densified, lowered where the fringe's line is under it. */
function edgeOf(H, S) {
  const out = [];
  for (let i = 0; i + 1 < H.line.length; i++) {
    const [t0, p0] = H.line[i], [t1, p1] = H.line[i + 1], n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / 1.5));
    for (let k = 0; k < n; k++) out.push([t0 + ((t1 - t0) * k) / n, p0 + ((p1 - p0) * k) / n]);
  }
  out.push(H.line.at(-1));
  const lo = S.fringe.at(-1)[0], hi = S.fringe[0][0], T = [...S.fringe].reverse();
  return out.map(([t, p]) => [t, t >= lo && t <= hi ? Math.min(p, Math.max(H.brow + S.fringeLow, H.brow + table(T, t) * (H.front - H.brow))) : p]);
}

/**
 * The pixie cut on a body: { verts, polys: [{ v, piece, valley?, buzz?, over? }], tris: [[a, b, c, poly]], weights,
 * pieces, shave, scalp, centre, k, grid }.
 */
export function buildPixie(rig, S = PIXIE, { clear = true } = {}) {
  const B = rig.B, C = centreOf(B), F = frameOf(S);
  const skull = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => ({ P: t.v.map((i) => B.verts[i]), v: t.v, poly: t.poly }));
  const under = (d) => farHit(skull, C, d);
  const H = hairlineOf(rig, C, S), hairReach = reachOf(H.line, F), edge = edgeOf(H, S), edgeReach = reachOf(edge, F);
  const fwd = [0, 0, 1], up = [0, 1, 0];
  const topness = (d) => smooth(S.topLo, S.topHi, dot(d, up) + S.tilt * dot(d, fwd));
  // the columns round the pole: per lock its borders and its ridge; a crease's border two columns, its strip between
  const half = [{ al: 0, ridge: true }];
  S.borders.forEach((b, i) => { if (i > 0) half.push({ al: (S.borders[i - 1] + b) / 2, ridge: true }); half.push({ al: b, ridge: false }); });
  const cols0 = [...half.filter((c) => c.al > 0 && c.al < 180).reverse().map((c) => ({ ...c, al: -c.al })), ...half];
  const cols = [];
  for (const c of cols0) {
    if (S.creases.includes(c.al)) cols.push({ al: c.al - S.valleyHalf, ridge: false, strip: true }, { al: c.al + S.valleyHalf, ridge: false });
    else cols.push(c);
  }
  const nc = cols.length, rows = S.rows, NR = rows.length;
  // each column: its sweep, its end (the edge, its tip past or short of it), its rows' (alpha, beta) round the pole
  const sweepAt = (s) => smooth(S.sweepFrom, 1, s);
  for (const [j, c] of cols.entries()) {
    c.bend = table(S.sweep, c.al);
    const aEnd = c.al + c.bend, rEdge = edgeReach(aEnd), rHair = hairReach(aEnd), th = angOf(F.at(aEnd, rEdge))[0];
    c.fringe = smooth(1, 4, rEdge - rHair);
    c.nape = Math.abs(th) > 140 ? smooth(140, 160, Math.abs(th)) : 0;
    const jit = S.tipJit * (2 * hash(j, 7) - 1);
    const tipF = c.fringe * ((c.ridge ? S.tipLong + (hash(j, 11) > S.tipFew ? S.tipExtra : 0) : -S.tipShort) + jit);
    const tipN = c.nape * ((c.ridge ? S.napeLong : -S.napeShort) + 0.5 * jit);
    c.end = rEdge + tipF + tipN;
    c.th = th;
    // (the last row's tip turned on toward her right by its length past the edge)
    c.path = rows.map((f, i) => [c.al + c.bend * sweepAt(f) - (i === NR - 1 ? S.tipSlant * Math.max(0, tipF) : 0), f * c.end]);
  }
  // the hair's height off the skin at a row of a column, and whether it is past the hairline (over the forehead)
  const heightAt = (c, i, d) => {
    const [al, be] = c.path[i], deg = hairReach(al) - be, tp = topness(d);
    const bk = smooth(0, -0.5, dot(d, fwd)), fadeDeg = S.fadeDeg + (S.backFade - S.fadeDeg) * bk;
    const fade = smooth(0, fadeDeg, deg);
    const sideT = S.edge + (S.side + (S.back - S.side) * bk - S.edge) * fade;
    const front = smooth(-0.3, 0.7, dot(d, fwd));
    let topT = S.topBack + (S.topFront - S.topBack) * front;
    // (the top fades at the hairline too where the locks end there; where they run on as the fringe it eases to the
    // fringe's height at the hairline and on to its tip)
    const f = c.fringe;
    if (deg >= 0) topT = (S.edge + (topT - S.edge) * fade) * (1 - f) + (S.fringeH + (topT - S.fringeH) * smooth(0, 10, deg)) * f;
    let h = sideT + (topT - sideT) * tp;
    if (f > 0 && deg < 0) {
      const u = Math.min(1, -deg / Math.max(1e-6, c.end - hairReach(al)));
      h = S.fringeH + (S.tipH - S.fringeH) * u;
    }
    return { h, deg };
  };
  const outer = [], inner = [];
  const verts = [], weights = [], polys = [];
  const weightOf = (h) => {
    if (!h.tri) return [['head', 1]];
    const bw = [1 - h.u - h.v, h.u, h.v], m = new Map();
    h.tri.v.forEach((vi, k) => { for (const [bn, w] of rig.weights[B.names[vi]]) m.set(bn, (m.get(bn) ?? 0) + w * bw[k]); });
    const l = [...m].filter(([, w]) => w > 1e-3), s = l.reduce((a, [, w]) => a + w, 0);
    return l.map(([bn, w]) => [bn, w / s]);
  };
  const V = (p, w) => { verts.push(p); weights.push(w); return verts.length - 1; };
  cols.forEach((c) => {
    const o = [], n = [];
    c.deg = [];
    c.path.forEach(([al, be], i) => {
      const d = F.at(al, be), hit = under(d), rb = hit.t, w = weightOf(hit);
      const { h, deg } = heightAt(c, i, d);
      c.deg.push(deg);
      const tip = i === NR - 1;
      // the lock's relief (none at a tip: the ridge's and the border's ends part by their lengths)
      const rel = tip ? 0 : Math.min(S.relief, S.reliefShare * h) * (c.ridge ? 1 : -1) * (S.reliefFrom[i] ?? 1);
      const over = c.fringe > 0.05 && deg < 0;
      o.push(V(add(C, mul(d, rb + Math.max(over ? S.lip + 0.006 : S.edge * 0.6, h + rel))), w));
      // the inside: sunk into the scalp; `lip` off the forehead past the hairline (over the forehead the fringe)
      if (S.innerRows.includes(i)) n.push(V(add(C, mul(d, over ? rb + S.lip * smooth(0, 3, -deg) : rb - S.sink * (c.fringe > 0.05 ? smooth(0, 6, deg) : 1))), w));
    });
    outer.push(o); inner.push(n);
  });
  // the whorl: one point over the pole, out and in
  const hp = under(F.p), crownO = V(add(C, mul(F.p, hp.t + S.topBack)), weightOf(hp)), crownI = V(add(C, mul(F.p, hp.t - S.sink)), weightOf(hp));
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  const NI = S.innerRows.length;
  for (let j = 0; j < nc; j++) {
    const k = (j + 1) % nc, cj = cols[j], ck = cols[k];
    poly([crownO, outer[k][0], outer[j][0]]);
    // (the sides' last band, the fade's end, in the shaved tone: `buzz`, as tools/sculpt/lowhair.mjs gameHair draws it;
    // still a part of the closed shell)
    const side = (c) => !c.fringe && Math.abs(c.th) >= S.stubbleTh[0] && Math.abs(c.th) <= S.stubbleTh[1] && topness(F.at(c.al + c.bend, c.end)) < S.stubbleTop;
    const fade = side(cj) && side(ck) ? { buzz: true } : {};
    for (let i = 0; i + 1 < NR; i++) {
      const d = F.at(...cj.path[i]);
      const over = cj.deg[i + 1] < 0 && ck.deg[i + 1] < 0 && cj.fringe > 0.05 ? { over: true } : {};
      // (a crease's strip in its valley shade where the lock is the top's or the fringe's, short of the whorl)
      const sh = i + 2 === NR && fade.buzz ? fade : cj.strip && i >= S.creaseFrom && (topness(d) > S.creaseTop || cj.fringe > 0.5) ? { valley: S.creaseShade } : {};
      poly([outer[j][i], outer[k][i], outer[k][i + 1], outer[j][i + 1]], { ...sh, ...over });
    }
    poly([crownI, inner[j][0], inner[k][0]], { valley: S.insideShade });
    for (let i = 0; i + 1 < NI; i++) poly([inner[j][i], inner[j][i + 1], inner[k][i + 1], inner[k][i]], { valley: S.insideShade });
    // the rim: the edge, the fringe's cut
    poly([outer[j][NR - 1], outer[k][NR - 1], inner[k][NI - 1], inner[j][NI - 1]], fade.buzz ? fade : { valley: S.rimShade });
  }
  // orientation: outward
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  const hair = { verts, polys, weights, centre: C, k: 1, grid: { cols, outer, inner, crownO, crownI, line: H.line, edge, brow: H.brow }, pieces: [{ id: 'pixie', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }] };
  hair.tris = trisOf(hair);
  Object.assign(hair, scalpOf(rig, hair));
  if (clear) clearSkin(rig, hair);
  return hair;
}

/** Each quad two triangles on its shorter diagonal (a lock's plane folds along its length). */
function trisOf(hair) {
  const { verts, polys } = hair, tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    const [a, b, c, d] = p.v;
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  return tris;
}

/** The scalp: the head's skin polygons (not the ears) with a corner under the hair short of the hairline (the fringe
 * over the forehead left out: the forehead is not shaved, and the fringe is kept off it), seen from the skull's middle;
 * the shave, those wholly under it. */
function scalpOf(rig, hair) {
  const B = rig.B, C = hair.centre, T = hair.tris.filter(([, , , pi]) => !hair.polys[pi].over).map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]] })), memo = new Map();
  const isUnder = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const scalp = [], shave = [];
  B.polys.forEach((p, i) => {
    if (p.part !== 'head' || p.mat !== 'skin' || p.ear || !p.v.some(isUnder)) return;
    scalp.push(i);
    if (p.v.every(isUnder)) shave.push(i);
  });
  return { scalp, shave };
}

/**
 * The outside kept off the skin at rest: an outside triangle through the face's skin, the ears, the neck or the shoulders
 * has its corners moved out from the skull's middle `step` at a time, until none is (through the shaved scalp it may go).
 */
function clearSkin(rig, hair, step = 0.003) {
  const B = rig.B, C = hair.centre, { verts, tris } = hair;
  const inner = new Set(hair.grid.inner.flat().concat([hair.grid.crownI]));
  const scalp = new Set(hair.shave), rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part) && !(scalp.has(t.poly) && t.v.every(rigid)));
  const bb = (P) => [0, 1, 2].map((k) => [Math.min(...P.map((p) => p[k])), Math.max(...P.map((p) => p[k]))]);
  const sb = skinT.map((t) => bb(t.v.map((i) => B.verts[i])));
  const outerTris = tris.filter(([a, b, c]) => ![a, b, c].some((v) => inner.has(v)));
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  const triTri = (A, Bt) => { for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true; return false; };
  let moved = 0;
  for (let it = 0; it < 60; it++) {
    const hit = new Set();
    for (const [a, b, c] of outerTris) {
      const A = [verts[a], verts[b], verts[c]], ab = bb(A);
      for (let s = 0; s < skinT.length; s++) {
        if (ab.some(([lo, hi], k) => hi < sb[s][k][0] || lo > sb[s][k][1])) continue;
        if (triTri(A, skinT[s].v.map((i) => B.verts[i]))) { for (const v of [a, b, c]) if (!inner.has(v)) hit.add(v); break; }
      }
    }
    if (!hit.size) break;
    for (const v of hit) verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), step));
    moved += hit.size;
  }
  hair.clearMoves = moved;
  return hair;
}

/** The pixie cut on a body. */
export const pixieOf = (rig, style = PIXIE) => buildPixie(rig, style);
/** The hair with its fade's band counted as hair (lowhair.mjs openEdges and crossings pass over `buzz` polygons). */
export const checked = (hair) => ({ ...hair, polys: hair.polys.map(({ buzz, ...p }) => p) });

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = buildRig(who), t0 = Date.now(), hair = checked(pixieOf(rig));
    console.log(who, 'polys', hair.polys.length, 'tris', hair.tris.length, 'verts', hair.verts.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'shave', hair.shave.length, 'columns', hair.grid.cols.length, 'clear moves', hair.clearMoves, 'ms', Date.now() - t0);
    const ang = (p) => angOf(unit(sub(p, hair.centre)));
    const tips = hair.grid.cols.map((c, j) => [c, ang(hair.verts[hair.grid.outer[j].at(-1)])]).filter(([c]) => c.fringe > 0.05);
    // (each tip's height over the brow under it: the brows' corners within 5 degrees of it round the head)
    const brows = rig.B.names.map((n, i) => (n && n.startsWith('brow') ? ang(rig.B.verts[i]) : null)).filter(Boolean);
    const over = tips.map(([, a]) => { const b = brows.filter((q) => Math.abs(q[0] - a[0]) < 5); return [a[0], b.length ? a[1] - Math.max(...b.map((q) => q[1])) : null]; });
    console.log(who, 'fringe tips [theta, degrees over the brow under it]:', over.map(([t, d]) => `${t.toFixed(0)},${d === null ? '-' : d.toFixed(1)}`).join(' '), 'least', Math.min(...over.filter(([, d]) => d !== null).map(([, d]) => d)).toFixed(1));
    console.log(who, 'fringe columns', hair.grid.cols.filter((c) => c.fringe > 0.05).map((c) => `${c.al.toFixed(0)}>${c.th.toFixed(0)}`).join(' '));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
