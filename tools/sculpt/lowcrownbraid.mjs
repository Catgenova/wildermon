// The crown braid (tools/sculpt/hairs/crownbraid.mjs) for the low-poly bodies: the game's 'crownbraid', "Crown braid". No
// reference sheet: built straight on each body's own skull from the style's numbers (buildCrownbraid), as
//
//   comb     one closed shell of locks over the scalp (as tools/sculpt/lowcrew.mjs's): the locks run out from the
//            crown's whorl (the style's pole) to the hairline (lowcrew.mjs hairlineOf, off the body's own marks: the
//            forehead, the temples, a short sideburn, over and behind the ear, the nape), each column a direction round
//            the pole; its rows from the whorl to the braid's line (the hair drawn out into the braid) and from it to the
//            hairline (the hair combed up into it), a row on the line itself; its height off the skin falling from the
//            braid to the hairline; a ridge per lock, its borders sunk, each border a narrow crease in a valley shade;
//            its inside sunk into the scalp; the rim at the hairline in the valleys' shade.
//   braid    a closed ring of links round the head on the braid's line (from the forehead's top over the ears' tops to
//            the back, its height per theta off the body's marks: the forehead's hairline, the ear's top), each link the
//            side braid's heart (tools/sculpt/lowbraidbraid.mjs heartAt: two lobes over a point, a crease down the
//            middle) bent onto the head (every corner carried out from the skull's middle to its height over the skin),
//            its face out, its point along the ring, its top sunk under the point of the one before (the tuck). Each link
//            its own piece.
//
// Each vertex weighted as the skin under it (the skin's triangle hit from the skull's middle, its corners' weights
// blended); the comb's outside kept off the face, the ears and the neck at rest (clearSkin). The scalp it covers: the
// head's polygons with a corner under it; those wholly under it drawn in the shaved tone.
//
//   node tools/sculpt/lowcrownbraid.mjs [--who male,female]   # counts, open edges, crossings at rest and turned
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { openEdges, skinHair, hairCrossings } from './lowhair.mjs';
import { hairlineOf } from './lowcrew.mjs';
import { heartAt } from './lowbraidbraid.mjs';
import { POSES, crossReport } from './lowbob.mjs';
import CROWN from './hairs/crownbraid.mjs';

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
/** A direction from the skull's middle: theta round from the front toward the body's left, phi up from level. */
export const dirOf = (th, ph) => { const t = th * RAD, p = ph * RAD; return [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)]; };
const angOf = (d) => [Math.atan2(d[0], d[2]) * DEG, Math.asin(Math.max(-1, Math.min(1, d[1]))) * DEG];
const interp = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 0; i + 1 < T.length; i++) if (x <= T[i + 1][0]) return T[i][1] + ((T[i + 1][1] - T[i][1]) * (x - T[i][0])) / (T[i + 1][0] - T[i][0]);
  return T.at(-1)[1];
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => ((a + 540) % 360) - 180;

/** The furthest crossing of a ray from o along unit d with triangles ({ P, v, poly }), with its barycentrics. */
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

/** The pole's frame: p the pole, f toward the front across it, l toward the body's left; at(al, be) the direction be
 * degrees from the pole toward al (0 the front); polar(d) its [al, be]. */
function frameOf(S) {
  const p = dirOf(...S.pole), f = unit(sub([0, 0, 1], mul(p, p[2]))), l = cross(p, f);
  return { p, f, l, at: (al, be) => { const a = al * RAD, b = be * RAD; return unit(add(mul(p, Math.cos(b)), mul(add(mul(f, Math.cos(a)), mul(l, Math.sin(a))), Math.sin(b)))); }, polar: (d) => [Math.atan2(dot(d, l), dot(d, f)) * DEG, Math.acos(Math.max(-1, Math.min(1, dot(d, p)))) * DEG] };
}

/** A closed line round the pole ([theta, phi] points, the body's left from the front (0) to the back (180), mirrored for
 * its right), as its distance from the pole per angle round it: the farthest crossing of the column with the line. */
function reachOf(line, F) {
  const both = [...line.slice(1).reverse().map(([t, p]) => [-t, p]), ...line];
  const dense = [];
  for (let i = 0; i + 1 < both.length; i++) {
    const [t0, p0] = both[i], [t1, p1] = both[i + 1], n = Math.max(1, Math.ceil(Math.hypot(t1 - t0, p1 - p0)));
    for (let k = 0; k < n; k++) dense.push([t0 + ((t1 - t0) * k) / n, p0 + ((p1 - p0) * k) / n]);
  }
  dense.push(both.at(-1));
  const pol = dense.map(([t, p]) => F.polar(dirOf(t, p)));
  return (al) => {
    let best = 0;
    for (let i = 0; i + 1 < pol.length; i++) {
      const [a0, b0] = pol[i], [a1, b1] = pol[i + 1];
      const d0 = wrap(al - a0), d1 = wrap(al - a1), span = wrap(a1 - a0);
      if (Math.abs(span) < 1e-9 || (Math.sign(d0) === Math.sign(d1) && d0 !== 0)) continue;
      if (Math.abs(span) > 90 || Math.abs(d0) > 90 || Math.abs(d1) > 90) continue;
      const s = d0 / (d0 - d1), b = b0 + (b1 - b0) * s;
      if (b > best) best = b;
    }
    return best;
  };
}

/** The skull's size against the man's (tools/sculpt/lowtopknot.mjs's): the style's lengths scaled by it. */
const sizeOf = (B) => { const P = (n) => B.verts[B.index.get(n)]; return (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79); };

/** The braid's line on a body: its phi per theta (degrees), off the forehead's hairline and the ear's top. */
export function ringOf(rig, C, S = CROWN) {
  const B = rig.B, ang = (p) => angOf(unit(sub(p, C)));
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? ang(B.verts[i]) : null)).filter(Boolean);
  const top = Math.max(...ear.map((a) => a[1])), R = S.ring;
  const front = ang(B.verts[B.index.get('t0')])[1] + R.front, side = top + R.side, back = top + R.back;
  return (th) => { const a = Math.abs(th); return a <= 90 ? front + (side - front) * interp(R.toSide, a) : side + (back - side) * interp(R.toBack, a); };
}

/**
 * The crown braid on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave,
 * scalp, centre, k, grid }.
 */
export function buildCrownbraid(rig, S = CROWN, { clear = true } = {}) {
  const B = rig.B, C = centreOf(B), F = frameOf(S), k = sizeOf(B);
  const skull = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => ({ P: t.v.map((i) => B.verts[i]), v: t.v, poly: t.poly }));
  const under = (d) => farHit(skull, C, d);
  const line = hairlineOf(rig, C, S.hairline), reach = reachOf(line, F);
  const phiRing = ringOf(rig, C, S);
  const ringLine = Array.from({ length: 181 }, (_, i) => [i, phiRing(i)]), ringReach = reachOf(ringLine, F);
  const weightOf = (h) => {
    if (!h.tri) return [['head', 1]];
    const bw = [1 - h.u - h.v, h.u, h.v], m = new Map();
    h.tri.v.forEach((vi, j) => { for (const [bn, w] of rig.weights[B.names[vi]]) m.set(bn, (m.get(bn) ?? 0) + w * bw[j]); });
    const l = [...m].filter(([, w]) => w > 1e-3), s = l.reduce((a, [, w]) => a + w, 0);
    return l.map(([bn, w]) => [bn, w / s]);
  };
  const verts = [], polys = [], weights = [];
  const V = (p, w) => { verts.push(p); weights.push(w); return verts.length - 1; };

  // ---- the comb: columns round the pole, a ridge per lock and a border (a crease's two sides) between two
  const N = S.locks, cols = [];
  for (let i = 0; i < N; i++) {
    const a = -180 + (360 * i) / N, w = 360 / N;
    cols.push({ al: a + w / 2, ridge: true }, { al: a + w - S.valleyHalf, ridge: false, strip: true }, { al: a + w + S.valleyHalf, ridge: false });
  }
  for (const c of cols) c.al = wrap(c.al);
  const rows = [...S.innerRows.map((f) => ({ f, out: false })), ...S.outerRows.map((f) => ({ f, out: true }))], NR = rows.length, RING = S.innerRows.length - 1;
  // (the inside's rows: every other one, the braid's line's and the hairline's)
  const innerIdx = rows.map((_, i) => i).filter((i) => i % 2 === 1 || i === RING || i === NR - 1);
  const NI = innerIdx.length;
  const heightAt = (r) => {
    const T = S.thick;
    return r.out ? T.ring + (T.edge - T.ring) * smooth(0, 1, r.f) : T.pole + (T.ring - T.pole) * r.f;
  };
  const outer = [], inner = [];
  for (const c of cols) {
    c.ring = ringReach(c.al); c.reach = Math.max(reach(c.al), c.ring + 4);
    c.betas = rows.map((r) => (r.out ? c.ring + (c.reach - c.ring) * r.f : c.ring * r.f));
    const o = [], n = [];
    rows.forEach((r, i) => {
      const d = F.at(c.al, c.betas[i]), h = under(d), w = weightOf(h), t = heightAt(r) * k, edge = i === NR - 1;
      const rel = edge ? 0 : Math.min(S.relief * k, S.reliefShare * t) * (c.ridge ? 1 : -1) * Math.min(1, r.out ? 1 : r.f * 2.5);
      o.push(V(add(C, mul(d, h.t + t + rel)), w));
      if (innerIdx.includes(i)) n.push(V(add(C, mul(d, h.t - S.sink * k)), w));
    });
    outer.push(o); inner.push(n);
  }
  const hp = under(F.p), poleO = V(add(C, mul(F.p, hp.t + S.thick.pole * k)), weightOf(hp)), poleI = V(add(C, mul(F.p, hp.t - S.sink * k)), weightOf(hp));
  const nc = cols.length;
  // (the skull's corners under the comb kept under it: the comb's facets are chords between its rows, and the low-poly
  // skull's corners between two rows stand above a chord; each corner `over` short of the comb's outside has the outside
  // triangle over it let out by the shortfall, a few rounds)
  {
    const quads = [];
    for (let j = 0; j < nc; j++) {
      const q = (j + 1) % nc;
      quads.push([poleO, outer[q][0], outer[j][0]]);
      for (let i = 0; i + 1 < NR; i++) quads.push([outer[j][i], outer[q][i], outer[q][i + 1]], [outer[j][i], outer[q][i + 1], outer[j][i + 1]]);
    }
    const corners = [...new Set(skull.flatMap((t) => t.v))].map((i) => B.verts[i]);
    for (let round = 0; round < 6; round++) {
      let moved = 0;
      const T = quads.map((vs) => ({ P: vs.map((v) => verts[v]), v: vs }));
      for (const p of corners) {
        const d = unit(sub(p, C)), h = farHit(T, C, d);
        if (!h.tri) continue;
        const short = Math.hypot(...sub(p, C)) + S.over * k - h.t;
        if (short <= 0) continue;
        for (const v of h.tri.v) verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), short));
        moved++;
      }
      if (!moved) break;
    }
  }
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, crease = cols[j].strip ? { valley: S.creaseShade } : {};
    polys.push({ v: [poleO, outer[q][0], outer[j][0]], piece: 0 });
    for (let i = 0; i + 1 < NR; i++) polys.push({ v: [outer[j][i], outer[q][i], outer[q][i + 1], outer[j][i + 1]], piece: 0, ...(i >= S.creaseFrom ? crease : {}) });
    polys.push({ v: [poleI, inner[j][0], inner[q][0]], piece: 0, valley: S.insideShade });
    for (let i = 0; i + 1 < NI; i++) polys.push({ v: [inner[j][i], inner[j][i + 1], inner[q][i + 1], inner[q][i]], piece: 0, valley: S.insideShade });
    polys.push({ v: [outer[j][NR - 1], outer[q][NR - 1], inner[q][NI - 1], inner[j][NI - 1]], piece: 0, valley: S.rimShade });
  }
  const pieces = [{ id: 'comb', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];

  // ---- the braid: the ring's middle line on the combed hair, from the back round the body's right, the front, the left
  const NL = 720, line3 = Array.from({ length: NL }, (_, i) => { const th = -180 + (360 * i) / NL; return dirOf(th, phiRing(th)); });
  const surf = line3.map((d) => add(C, mul(d, under(d).t)));
  const Ls = [0]; for (let i = 1; i <= NL; i++) Ls.push(Ls[i - 1] + Math.hypot(...sub(surf[i % NL], surf[i - 1])));
  const LEN = Ls[NL];
  // (the line at an arc length: its point on the skin, and its frame: T along it, N out from the skull's middle, U across)
  const lineAt = (s) => {
    s = ((s % LEN) + LEN) % LEN;
    let i = 1; while (i < NL && Ls[i] < s) i++;
    const g = (s - Ls[i - 1]) / Math.max(1e-9, Ls[i] - Ls[i - 1]), p = add(surf[i - 1], mul(sub(surf[i % NL], surf[i - 1]), g));
    const a = surf[(i - 2 + NL) % NL], b = surf[(i + 1) % NL];
    const Nn = unit(sub(p, C)), T = unit(sub(sub(b, a), mul(Nn, dot(sub(b, a), Nn))));
    return { p, T, N: Nn, U: cross(Nn, T) };
  };
  const br = S.braid, Wd = br.w * k, D = Wd * br.depth, step = LEN / br.links, H = step * br.stretch;
  const base = S.thick.ring * k + br.lift * D;
  for (let l = 0; l < br.links; l++) {
    const v0 = verts.length, p0 = polys.length, s0 = (l + 0.5) * step;
    const at = (u, v, w) => {
      const f = lineAt(s0 + (v - 0.5) * H), q = add(f.p, mul(f.U, u * Wd)), d = unit(sub(q, C)), h = under(d);
      return add(C, mul(d, h.t + base + (w + br.tilt * (v - 0.5)) * D));
    };
    const Vb = (p) => V(p, weightOf(under(unit(sub(p, C)))));
    heartAt(Vb, (v, sh) => polys.push({ v, piece: pieces.length, ...sh }), null, null, null, null, H, Wd, 0, at, br.depth);
    pieces.push({ id: `link${l + 1}`, kind: 'braid', polys: [p0, polys.length], verts: [v0, verts.length] });
  }

  orient(verts, polys, pieces);
  const hair = { verts, polys, weights, centre: C, k, pieces, grid: { cols, outer, inner, poleI, line, ring: phiRing } };
  hair.tris = trisOf(hair);
  Object.assign(hair, scalpOf(rig, hair));
  if (clear) clearSkin(rig, hair);
  return hair;
}

/** Each piece's faces wound alike (each face turned to agree with a neighbour across a shared edge, from the first),
 * then turned outward (all turned over where they enclose a negative volume): tools/sculpt/lowbraid.mjs's. */
function orient(verts, polys, pieces) {
  for (const pc of pieces) {
    const ids = []; for (let i = pc.polys[0]; i < pc.polys[1]; i++) ids.push(i);
    const byEdge = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    for (const i of ids) polys[i].v.forEach((a, j) => { const b = polys[i].v[(j + 1) % polys[i].v.length], kk = key(a, b); (byEdge.get(kk) ?? byEdge.set(kk, []).get(kk)).push(i); });
    const done = new Set();
    for (const s0 of ids) {
      if (done.has(s0)) continue;
      done.add(s0); const q = [s0];
      while (q.length) {
        const i = q.pop(), v = polys[i].v;
        v.forEach((a, j) => {
          const b = v[(j + 1) % v.length];
          for (const n of byEdge.get(key(a, b))) {
            if (n === i || done.has(n)) continue;
            const w = polys[n].v, m = w.indexOf(a);
            // (a neighbour wound alike runs the shared edge the other way: b then a)
            if (w[(m + 1) % w.length] === b) w.reverse();
            done.add(n); q.push(n);
          }
        });
      }
    }
    const o = verts[pc.verts[0]];
    let vol = 0;
    for (const i of ids) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], o), cross(sub(verts[v[j]], o), sub(verts[v[j + 1]], o))); }
    if (vol < 0) for (const i of ids) polys[i].v.reverse();
  }
}

/** Each quad two triangles on its shorter diagonal; a larger polygon a fan. */
function trisOf(hair) {
  const { verts, polys } = hair, tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    if (p.v.length > 4) { for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]); return; }
    const [a, b, c, d] = p.v;
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  return tris;
}

/** The scalp: the head's skin polygons (not the ears) with a corner under the comb seen from the skull's middle; the
 * shave, the ones wholly under it (drawn in the shaved tone). */
function scalpOf(rig, hair) {
  const B = rig.B, C = hair.centre, pc = hair.pieces[0];
  const T = hair.tris.filter(([, , , pi]) => pi < pc.polys[1]).map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]] })), memo = new Map();
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
 * The outside kept off the skin at rest: a triangle (not the comb's inside) through the face's skin, the ears, the
 * neck or the shoulders has its corners moved out from the skull's middle `step` at a time, until none is.
 */
function clearSkin(rig, hair, step = 0.003) {
  const B = rig.B, C = hair.centre, { verts, tris } = hair;
  const inner = new Set(hair.grid.inner.flat().concat([hair.grid.poleI]));
  const scalp = new Set(hair.shave), rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part) && !(scalp.has(t.poly) && t.v.every(rigid)));
  const bb = (P) => [0, 1, 2].map((c) => [Math.min(...P.map((p) => p[c])), Math.max(...P.map((p) => p[c]))]);
  const sb = skinT.map((t) => bb(t.v.map((i) => B.verts[i])));
  const outerTris = tris.filter(([a, b, c]) => ![a, b, c].some((v) => inner.has(v)));
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  const triTri = (A, Bt) => { for (let j = 0; j < 3; j++) if (segTri(A[j], A[(j + 1) % 3], Bt) || segTri(Bt[j], Bt[(j + 1) % 3], A)) return true; return false; };
  let moved = 0;
  for (let it = 0; it < 60; it++) {
    const hit = new Set();
    for (const [a, b, c] of outerTris) {
      const A = [verts[a], verts[b], verts[c]], ab = bb(A);
      for (let s = 0; s < skinT.length; s++) {
        if (ab.some(([lo, hi], j) => hi < sb[s][j][0] || lo > sb[s][j][1])) continue;
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

/** The crown braid on a body. */
export const crownbraidOf = (rig, style = CROWN) => buildCrownbraid(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), t0 = Date.now(), hair = crownbraidOf(rig);
    const byKind = (kind) => hair.pieces.filter((p) => p.kind === kind).reduce((a, p) => a + p.polys[1] - p.polys[0], 0);
    console.log(who, 'polys', hair.polys.length, `(comb ${byKind('shell')}, braid ${byKind('braid')})`, 'tris', hair.tris.length, 'verts', hair.verts.length, 'valleys', [1, 2, 3, 4].map((s) => hair.polys.filter((p) => p.valley === s).length).join('/'), 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'shaved', hair.shave.length, 'clear moves', hair.clearMoves, 'ms', Date.now() - t0);
    console.log(who, 'ring phi at theta 0/45/90/135/180', [0, 45, 90, 135, 180].map((t) => hair.grid.ring(t).toFixed(1)).join(' '));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
    if (args.includes('--pieces')) {
      const X = hairCrossings(rig, hair), m = {};
      for (const x of X) { const key = [x.a.replace(/\d+/, ''), x.b.replace(/\d+/, '')].sort().join('-'); m[key] = (m[key] ?? 0) + 1; }
      console.log(who, 'pieces through one another where it shows', X.length, JSON.stringify(m));
    }
  }
}
