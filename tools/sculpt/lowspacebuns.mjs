// Space buns (tools/sculpt/hairs/spacebuns.mjs) for the low-poly bodies: the game's 'spacebuns', "Space buns". No
// reference sheet: built from the style's numbers on each body's own skull (tools/sculpt/lowhair.mjs skullOf and the
// neck under it, the ray from its middle to the skin per direction), in the shape of the top knot
// (tools/sculpt/lowtopknot.mjs), once per side, rigid on the head:
//
//   top   the side's hair: one shell of locks between its edge (the hairline round the face, over the ear and down to
//         the nape: `hairline`; and the part, the head's middle plane less `part` degrees) and its bun, every lock from
//         the edge to the bun (columns round the bun, spaced evenly round the head; a ridge each, a border between two
//         as a narrow crease in the valleys' shade), its rows from the bun out to the edge, its thickness off the skin
//         falling from the bun to the edge; its inside sunk into the scalp it covers, off the skin toward the edge, the
//         rim between the two (the edge's thickness) in the valleys' shade. The part between the two sides' rims, the
//         scalp under them shaved.
//   band  where the bun is tied: a short faceted ring round the bun's axis, its foot in the shell, in the darkest
//         valley's shade.
//   bun   a round bun on the band, its lobes coiled (each ring turned on the last), a crease between two lobes.
//
// Her right side mirrors her left. Kept off the face, the ears, the neck and the shoulders at rest, turned and nodded,
// and through the game's clips (tools/sculpt/lowspacebunsanim.mjs).
//
//   node tools/sculpt/lowspacebuns.mjs [--who male,female]   # counts, open edges, crossings at rest and turned
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { skullOf, crossings, openEdges, skinHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowtopknot.mjs';
import SPACEBUNS from './hairs/spacebuns.mjs';

const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
/** A direction from the skull's middle: theta round from the front toward the body's left, phi up from level (degrees). */
const dirOf = (th, ph) => [Math.sin(rad(th)) * Math.cos(rad(ph)), Math.sin(rad(ph)), Math.cos(rad(th)) * Math.cos(rad(ph))];
/** A unit direction's theta and phi (degrees). */
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const interp = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 0; i + 1 < T.length; i++) if (x <= T[i + 1][0]) return T[i][1] + ((T[i + 1][1] - T[i][1]) * (x - T[i][0])) / (T[i + 1][0] - T[i][0]);
  return T.at(-1)[1];
};

/** The furthest crossing of a ray from o along unit d with the triangles: its distance and polygon. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const tri of tris) {
    const [a, b, c] = tri, e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = tri.poly; }
  }
  return { t: best, poly };
}

/** The skull's size against the man's (tools/sculpt/lowhair.mjs buildOnce's k): the style's lengths scaled by it. */
const sizeOf = (B) => { const P = (n) => B.verts[B.index.get(n)]; return (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79); };

/** A ring of `n` corners round the axis A (unit) through o, radius r, the first toward f (unit, across A), turned by a0
 * degrees. */
function ring(o, A, f, n, r, a0 = 0) {
  const g = cross(A, f);
  return Array.from({ length: n }, (_, j) => { const a = rad(a0 + (360 * j) / n); return add(o, mul(add(mul(f, Math.cos(a)), mul(g, Math.sin(a))), r)); });
}

/**
 * Space buns on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave, scalp,
 * centre, k, grid }.
 */
export function buildSpacebuns(rig, S = SPACEBUNS) {
  const B = rig.B, { tris: head, centre: C } = skullOf(B), k = sizeOf(B);
  // (the skin under the hair: the head's without the ears, and the neck's under the nape)
  const skull = [...head, ...B.tris.filter((t) => B.polys[t.poly].part === 'neck').map((t) => Object.assign(t.v.map((i) => B.verts[i]), { poly: t.poly }))];
  const memo = new Map();
  const skinAt = (d) => { const key = d.map((x) => x.toFixed(6)).join(); if (!memo.has(key)) memo.set(key, farHit(skull, C, d)); return memo.get(key); };
  // the hairline as an angle: per |theta| the phi under which the skin falls below the hairline's height there
  const P = (n) => B.verts[B.index.get(n)];
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? B.verts[i] : null)).filter(Boolean);
  const LM = { front: P('t0')[1], ear: Math.max(...ear.map((p) => p[1])), nape: P('bk')[1] };
  const yh = (th) => interp(S.hairline.map(([a, lm, dy]) => [a, LM[lm] + dy * k]), th);
  const E = [];
  for (let th = 0; th <= 180; th += 2) {
    let ph = 80;
    while (ph > -70 && C[1] + dirOf(th, ph)[1] * skinAt(dirOf(th, ph)).t >= yh(th)) ph -= 0.5;
    E.push([th, ph + 0.25]);
  }
  const below = (d) => { const [th, ph] = angOf(d); return ph - interp(E, Math.abs(th)); };
  // the skin's reach per direction for the outside: the farthest of the ray's crossing and the head's corners within
  // `reach` degrees of it (a corner of the low-poly skull stands out of the faces round it: never through the hair)
  const cv = new Set(B.polys.flatMap((p) => (p.part === 'head' && p.mat === 'skin' && !p.ear ? p.v : [])));
  const corners = [...cv].map((i) => B.verts[i]).map((p) => { const r = sub(p, C), l = Math.hypot(...r); return { d: mul(r, 1 / l), l }; });
  const cosR = Math.cos(rad(S.reach));
  const reachAt = (d) => Math.max(skinAt(d).t, ...corners.filter((c) => dot(c.d, d) > cosR).map((c) => c.l * dot(c.d, d)));
  const sp = Math.sin(rad(S.part));
  // the left side's hair: inside its edge (above the hairline, left of the part)
  const inside = (d) => below(d) > 0 && d[0] > sp;
  // the bun's direction from the skull's middle, and a frame round it: e1 toward the front, e2 across
  const K = dirOf(S.bun0.th, S.bun0.ph), e1 = unit(sub([0, 0, 1], mul(K, K[2]))), e2 = cross(K, e1);
  const along = (al, ga) => unit(add(mul(K, Math.cos(rad(ga))), mul(add(mul(e1, Math.cos(rad(al))), mul(e2, Math.sin(rad(al)))), Math.sin(rad(ga)))));
  // the edge's angle from the bun per azimuth round it (al, degrees), and whether it ends there on the part
  const EDGE = new Map();
  const edgeOf = (al) => {
    const key = al.toFixed(4);
    if (!EDGE.has(key)) { let ga = 0; while (ga < 170 && inside(along(al, ga + 0.25))) ga += 0.25; EDGE.set(key, { ga, part: below(along(al, ga + 0.25)) > 0 }); }
    return EDGE.get(key);
  };
  const edgeGa = (al) => edgeOf(al).ga;
  // the bun's foot: the band's radius as an angle from the skull's middle
  const rK = skinAt(K).t, ga0 = deg(Math.atan2(S.band.r * k * 0.8, rK));
  const gaOf = (al, u) => ga0 + (edgeGa(al) - ga0) * u;
  // the columns: 2 * locks round the bun (a ridge, then a border, ...), spaced evenly along the ring spaceAt of the way out
  const N = 2 * S.locks, fine = Array.from({ length: 721 }, (_, i) => i / 2);
  const pts = fine.map((al) => { const d = along(al, gaOf(al, S.spaceAt)); return add(C, mul(d, skinAt(d).t)); });
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const alAt = (s) => { let i = 1; while (i < len.length - 1 && len[i] < s) i++; return fine[i - 1] + ((fine[i] - fine[i - 1]) * (s - len[i - 1])) / Math.max(1e-9, len[i] - len[i - 1]); };
  const cols = [];
  for (let c = 0; c < N; c++) {
    const al = alAt((len.at(-1) * c) / N), ridge = c % 2 === 0;
    if (ridge || !S.valleyHalf) cols.push({ al, ridge });
    else cols.push({ al: al - S.valleyHalf, ridge: false, strip: true }, { al: al + S.valleyHalf, ridge: false });
  }
  // (a column moved onto each corner where the edge turns from the part to the hairline, so the two meet in a point
  // rather than across a lock)
  for (let a = 0; a < 360; a += 0.5) {
    if (edgeOf(a).part === edgeOf(a + 0.5).part) continue;
    let lo = a, hi = a + 0.5;
    for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (edgeOf(m).part === edgeOf(lo).part) lo = m; else hi = m; }
    const at = edgeOf(lo).part ? hi : lo, gap = (c) => Math.abs(((c.al - at + 540) % 360) - 180);
    const near = cols.reduce((b, c, i) => (gap(c) < gap(cols[b]) ? i : b), 0), move = at - cols[near].al;
    // (a border's strip moves as one)
    const mate = cols[near].strip ? near + 1 : !cols[near].ridge && cols[near - 1]?.strip ? near - 1 : -1;
    cols[near].al = at; if (mate >= 0) cols[mate].al += move;
  }
  // (each lock's tip at the hairline: its ridge's end past the edge by `tip` degrees, its borders' short of it by tipBack
  // of that, so the edge is the locks' ends rather than one line; none at the part; the run out to it eased in)
  for (const c of cols) {
    const e = edgeOf(c.al), t = e.part ? 0 : interp(S.tip, Math.abs(angOf(along(c.al, e.ga))[0]));
    c.th = Math.abs(angOf(along(c.al, e.ga))[0]); c.part = e.part; c.tip = c.ridge ? t : -S.tipBack * t;
  }
  const gaCol = (c, f) => gaOf(c.al, f) + c.tip * f ** 3;
  const nc = cols.length, R = S.rows.length - 1;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const thickAt = (u, th = 0) => interp(S.thick, u) * interp(S.thickBy, th) * k;
  // the outside: per column its rows out from the bun (the first ring at the band's foot), the hair's thickness off the
  // skin there, a ridge's stood out and a border's in
  const outer = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), rb = reachAt(d), t = thickAt(f, c.th), rel = Math.min(S.relief * k, S.reliefShare * t);
    return add(C, mul(d, rb + t + (c.ridge ? rel : -rel)));
  }));
  const bunO = add(C, mul(K, rK + thickAt(0)));
  // the scalp the hair covers: the head's skin polygons (not the ears) every corner of which is above the hairline (the
  // part's line between the sides' rims with it)
  const scalp = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every((v) => below(unit(sub(B.verts[v], C))) >= 0)) scalp.push(i); });
  const scalpSet = new Set(scalp);
  // the inside: sunk into the scalp where the skin under it is covered, out to sinkTo of the way; on toward the edge just
  // off the skin
  const inner = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), h = skinAt(d);
    return add(C, mul(d, f > S.sinkTo || !scalpSet.has(h.poly) ? h.t + S.lip * k : h.t - S.sink * k));
  }));
  const bunI = add(C, mul(K, scalpSet.has(skinAt(K).poly) ? rK - S.sink * k : reachAt(K) + S.lip * k));
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V)), cO = V(bunO), cI = V(bunI);
  const pieces = [];
  const top0 = polys.length;
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh }), outside = new Set();
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, crease = cols[j].strip ? { valley: S.creaseShade } : {};
    outside.add(polys.length); poly([cO, oi[q][0], oi[j][0]], crease);
    poly([cI, ii[j][0], ii[q][0]], { valley: S.rimShade });
    for (let i = 0; i + 1 < R; i++) {
      outside.add(polys.length); poly([oi[j][i], oi[q][i], oi[q][i + 1], oi[j][i + 1]], crease);
      poly([ii[j][i], ii[j][i + 1], ii[q][i + 1], ii[q][i]], { valley: S.rimShade });
    }
    poly([oi[j][R - 1], oi[q][R - 1], ii[q][R - 1], ii[j][R - 1]], { valley: S.rimShade });
  }
  pieces.push({ id: 'top.L', polys: [top0, polys.length], verts: [0, verts.length] });

  // the bun's axis: from the skin's normal at its foot (the direction from the skull's middle) toward straight up
  const A = unit(lerp(K, [0, 1, 0], S.bun0.up)), foot = add(C, mul(K, rK));
  const F = unit(sub([0, 0, 1], mul(A, dot([0, 0, 1], A))));
  // the band: a faceted ring round the axis from its foot (in the shell) up its height, its middle bulged, its top
  // narrowed; closed by a fan at each end
  {
    const b = S.band, v0 = verts.length, p0 = polys.length, n = b.sides, r = b.r * k;
    // (a corner of a ring under the skin where the axis leans off the normal: stood just off it)
    const lift = (p) => { const r0 = sub(p, C), l = Math.hypot(...r0), d = mul(r0, 1 / l), t = reachAt(d) + S.lip * k; return l < t ? add(C, mul(d, t)) : p; };
    const rings = [[b.foot, 1], [b.foot + b.h / 2, 1 + b.bulge], [b.foot + b.h, b.top]].map(([h, s], i) => ring(add(foot, mul(A, h * k)), A, F, n, r * s, 180 / n).map((p) => V(lift(p))));
    const bot = V(add(foot, mul(A, b.foot * k))), top = V(add(foot, mul(A, (b.foot + b.h) * k)));
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      for (let i = 0; i + 1 < rings.length; i++) polys.push({ v: [rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], piece: 1, valley: b.shade });
      polys.push({ v: [bot, rings[0][q], rings[0][j]], piece: 1, valley: b.shade }, { v: [top, rings.at(-1)[j], rings.at(-1)[q]], piece: 1, valley: b.shade });
    }
    pieces.push({ id: 'band.L', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // the bun: rings of lobes and creases round the axis at its latitudes, each turned on the last, closed at both poles
  {
    const u = S.bun, v0 = verts.length, p0 = polys.length, r = u.r * k, rv = u.rv * k;
    const mid = add(foot, mul(A, (S.band.foot + S.band.h + u.lift) * k));
    const cs = [];
    for (let l = 0; l < u.lobes; l++) { const a = (360 * l) / u.lobes, w = 360 / u.lobes; cs.push({ a, s: 1 + u.relief }, { a: a + w / 2 - 4, s: 1 - u.relief, strip: true }, { a: a + w / 2 + 4, s: 1 - u.relief }); }
    const g = cross(A, F);
    const rings = u.lats.map((lat, i) => cs.map((c) => {
      const a = rad(c.a + i * u.twist), cl = Math.cos(rad(lat)) * c.s;
      return V(add(add(mid, mul(A, rv * Math.sin(rad(lat)))), mul(add(mul(F, Math.cos(a)), mul(g, Math.sin(a))), r * cl)));
    }));
    const bot = V(add(mid, mul(A, -rv))), apex = V(add(mid, mul(A, rv)));
    const n = cs.length, sh = (j) => (cs[j].strip ? { valley: u.creaseShade } : {});
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      polys.push({ v: [bot, rings[0][q], rings[0][j]], piece: 2, ...sh(j) });
      for (let i = 0; i + 1 < rings.length; i++) polys.push({ v: [rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], piece: 2, ...sh(j) });
      polys.push({ v: [apex, rings.at(-1)[j], rings.at(-1)[q]], piece: 2, ...sh(j) });
    }
    pieces.push({ id: 'bun.L', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // each piece's faces turned outward (wound one way round; turned over where that encloses a negative volume)
  for (const pc of pieces) {
    let vol = 0;
    const o = verts[pc.verts[0]];
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], o), cross(sub(verts[v[j]], o), sub(verts[v[j + 1]], o))); }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
  // her right side: the left mirrored across the head's middle plane, its faces wound back
  const nv = verts.length, np = polys.length;
  for (let i = 0; i < nv; i++) verts.push([2 * C[0] - verts[i][0], verts[i][1], verts[i][2]]);
  for (let i = 0; i < np; i++) polys.push({ ...polys[i], v: polys[i].v.map((x) => x + nv).reverse(), piece: polys[i].piece + 3 });
  for (const pi of [...outside]) outside.add(pi + np);
  for (const pc of pieces.slice(0, 3)) pieces.push({ id: pc.id.replace('.L', '.R'), polys: pc.polys.map((x) => x + np), verts: pc.verts.map((x) => x + nv) });
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else {
      // (a quad split along its shorter diagonal, so it folds rather than twists)
      const [a, b, c, d] = p.v;
      if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    }
  });
  // (the shaved polygons: the scalp the hair covers, the part's line between; left out of the crossing checks, the same)
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, shave: scalp, scalp, centre: C, k, grid: { cols, outer: oi, inner: ii, edge: E } };
  // a face still through the skin past the scalp: its corners stood off the skin a little at a time (the shell's inside
  // corners, the outside with them where the shell would be under `lip` thick)
  const mate = new Map();
  ii.forEach((col, j) => col.forEach((v, i) => { mate.set(v, oi[j][i]); mate.set(v + nv, oi[j][i] + nv); }));
  mate.set(cI, cO); mate.set(cI + nv, cO + nv);
  for (let it = 0; it < 120; it++) {
    const X = crossings(rig, hair, B.verts, verts);
    if (!X.n) break;
    for (const v of new Set(X.hits.flatMap(([pi]) => polys[pi].v))) {
      if (!mate.has(v)) { const r = sub(verts[v], C), l = Math.hypot(...r); verts[v] = add(C, mul(r, (l + 0.003 * k) / l)); continue; }
      const r = sub(verts[v], C), l = Math.hypot(...r), w = mate.get(v), ro = sub(verts[w], C), o = Math.hypot(...ro);
      verts[v] = add(C, mul(r, (l + 0.003 * k) / l));
      if (o < l + (0.003 + S.lip) * k) verts[w] = add(C, mul(ro, (l + (0.003 + S.lip) * k) / o));
    }
  }
  // the outside's faces over the scalp's (the skull's corners and folds stand out of the flat faces between the hair's
  // rows and columns): their corners stood out a little at a time until none dips under it
  const scalpT = B.tris.filter((t) => scalpSet.has(t.poly)).map((t) => t.v.map((i) => B.verts[i]));
  const outT = tris.filter(([, , , pi]) => outside.has(pi));
  for (let it = 0; it < 60; it++) {
    const up = new Set();
    for (const [a, b, c] of outT) { const T = [verts[a], verts[b], verts[c]]; if (scalpT.some((st) => triTri(T, st))) [a, b, c].forEach((v) => up.add(v)); }
    if (!up.size) break;
    for (const v of up) { const r = sub(verts[v], C), l = Math.hypot(...r); verts[v] = add(C, mul(r, (l + 0.003 * k) / l)); }
  }
  // kept off the skin with the head turned and nodded (POSES, further than the game's clips turn it): where the nape's
  // skin (on the neck as much as the head) meets the hair's edge, the faces' corners stood out a little at a time, the
  // shell's inside under its outside
  const states = Object.values(POSES).map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f }; });
  for (let it = 0; it < 60; it++) {
    const hits = states.flatMap((st) => crossings(rig, hair, st.P, skinHair(rig, hair, st.f)).hits);
    if (!hits.length) break;
    for (const v of new Set(hits.flatMap(([pi]) => polys[pi].v))) {
      const r = sub(verts[v], C), l = Math.hypot(...r);
      verts[v] = add(C, mul(r, (l + 0.003 * k) / l));
      const w = mate.get(v);
      if (w !== undefined) { const ro = sub(verts[w], C), o = Math.hypot(...ro); if (o < l + (0.003 + S.lip) * k) verts[w] = add(C, mul(ro, (l + (0.003 + S.lip) * k) / o)); }
    }
  }
  return hair;
}

/** Whether two triangles pass through each other (an edge of either through the other). */
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

const CACHE = new Map();
/** Space buns on a body, once per body. */
export function spacebunsOf(rig, style = SPACEBUNS) {
  if (style !== SPACEBUNS) return buildSpacebuns(rig, style);
  if (!CACHE.has(rig.who)) CACHE.set(rig.who, buildSpacebuns(rig, style));
  return CACHE.get(rig.who);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildSpacebuns(rig);
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'pieces', hair.pieces.map((p) => `${p.id}:${p.polys[1] - p.polys[0]}`).join(' '),
      'valleys', [1, 2, 3, 4].map((s) => hair.polys.filter((p) => p.valley === s).length).join('/'), 'open edges', openEdges(hair), 'shaved', hair.shave.length, 'columns', hair.grid.cols.length, 'at the part', hair.grid.cols.filter((c) => c.part).length, 'ms', Date.now() - t0);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
