// The undercut top knot (tools/sculpt/hairs/topknot.mjs) for the low-poly bodies: the game's 'topknot', "Top knot". No
// reference sheet: built from the style's numbers on each body's own skull (tools/sculpt/lowhair.mjs skullOf, the ray
// from its middle to the skin per direction) as three closed pieces, rigid on the head:
//
//   top   the long hair on top: one shell of locks between the hair's edge (the forehead's hairline, the undercut's line
//         over the temples, under the crown at the back: `edge`) and the knot, every lock running from the edge to the
//         knot (columns round the knot, spaced evenly round the head; a ridge each, a border between two as a narrow
//         crease in the valleys' shade), its rows from the knot out to the edge, its thickness off the skin falling
//         from the knot to the edge; its inside sunk into the scalp it covers, off the skin at the edge, the rim between
//         the two (the edge's thickness) in the valleys' shade.
//   band  where the knot is tied: a short faceted ring round the knot's axis, its foot in the shell, in the darkest
//         valley's shade.
//   knot  the bun: a small rounded knot on the band, its lobes coiled (each ring turned on the last), a crease between
//         two lobes.
//
// The sides and the back below the edge shaved (the head's own polygons in the shaved tone, the swept back's shave),
// forward of that buzzed to the sideburn (tools/sculpt/lowhair.mjs buzzOf); the scalp under the top shaved too.
//
//   node tools/sculpt/lowtopknot.mjs [--who male,female]   # counts, open edges, crossings at rest and turned
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { skullOf, shaveOf, buzzOf, crossings, openEdges, skinHair } from './lowhair.mjs';
import TOPKNOT from './hairs/topknot.mjs';

const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
/** A direction from the skull's middle: theta round from the front toward the body's left, phi up from level (degrees). */
export const dirOf = (th, ph) => [Math.sin(rad(th)) * Math.cos(rad(ph)), Math.sin(rad(ph)), Math.cos(rad(th)) * Math.cos(rad(ph))];
/** A unit direction's theta and phi (degrees). */
export const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const interp = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 0; i + 1 < T.length; i++) if (x <= T[i + 1][0]) return T[i][1] + ((T[i + 1][1] - T[i][1]) * (x - T[i][0])) / (T[i + 1][0] - T[i][0]);
  return T.at(-1)[1];
};

/** The furthest crossing of a ray from o along unit d with the skull's triangles: its distance and polygon. */
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
 * degrees; per corner its own radius share (rs). */
function ring(o, A, f, n, r, a0 = 0, rs = null) {
  const g = cross(A, f);
  return Array.from({ length: n }, (_, j) => { const a = rad(a0 + (360 * j) / n); return add(o, mul(add(mul(f, Math.cos(a)), mul(g, Math.sin(a))), r * (rs ? rs[j] : 1))); });
}

/**
 * The top knot on a body: { verts, polys: [{ v, piece, valley?, buzz? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid }.
 */
export function buildTopknot(rig, S = TOPKNOT) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B), k = sizeOf(B), E = S.edge[rig.who];
  const skinAt = (d) => farHit(skull, C, d);
  const edgeAt = (d) => { const [th, ph] = angOf(d); return ph - interp(E, Math.abs(th)); };
  // the knot's direction from the skull's middle, and the frame round it: e1 over the top toward the front, e2 the body's
  // left
  const K = dirOf(180, S.knot.ph), e1 = [0, Math.cos(rad(S.knot.ph)), Math.sin(rad(S.knot.ph))], e2 = [1, 0, 0];
  const along = (al, ga) => unit(add(mul(K, Math.cos(rad(ga))), mul(add(mul(e1, Math.cos(rad(al))), mul(e2, Math.sin(rad(al)))), Math.sin(rad(ga)))));
  // the edge's angle from the knot per azimuth round it (al, degrees: 0 toward the front, + the body's left)
  const edgeGa = (al) => { let ga = 0; while (ga < 170 && edgeAt(along(al, ga + 0.25)) > 0) ga += 0.25; return ga; };
  // the knot's foot: the band's radius as an angle from the skull's middle
  const rK = skinAt(K).t, ga0 = deg(Math.atan2(S.band.r * k * 0.8, rK));
  const gaOf = (al, u) => ga0 + (edgeGa(al) - ga0) * u;
  // the columns: 2 * locks round the knot (a ridge at the front, then a border, ...), spaced evenly along the ring
  // spaceAt of the way out
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
  // (each lock's tip: its ridge's end past the edge by `tip` degrees (by |theta| where it ends), its borders' short of it
  // by tipBack of that, so the edge is the locks' ends rather than one level line; the run out to it eased in)
  for (const c of cols) { c.th = Math.abs(angOf(along(c.al, edgeGa(c.al)))[0]); const t = interp(S.tip, c.th); c.tip = c.ridge ? t : -S.tipBack * t; }
  const gaCol = (c, f) => gaOf(c.al, f) + c.tip * f ** 3;
  const nc = cols.length, R = S.rows.length - 1;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  // the shell's outside: per column its rows out from the knot (the first ring at the band's foot), the hair's thickness
  // off the skin there, a ridge's stood out and a border's in
  const thickAt = (u, th = 0) => interp(S.thick, u) * interp(S.thickBy, th) * k;
  const outer = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), rb = skinAt(d).t, t = thickAt(f, c.th), rel = Math.min(S.relief * k, S.reliefShare * t);
    return add(C, mul(d, rb + t + (c.ridge ? rel : -rel)));
  }));
  const knotO = add(C, mul(K, rK + thickAt(0)));
  // the scalp the shell covers: the head's skin polygons (not the ears) every corner of which the outside is over
  const covers = (q) => { const dq = unit(sub(q, C)); const [th, ph] = angOf(dq); return ph >= interp(E, Math.abs(th)); };
  const scalp = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every((v) => covers(B.verts[v]))) scalp.push(i); });
  const scalpSet = new Set(scalp);
  // the inside: sunk into the scalp where the skin under it is covered, out to sinkTo of the way; on toward the edge just
  // off the skin (so it never dips under the forehead's or the temples' skin beyond the edge)
  const inner = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), h = skinAt(d);
    return add(C, mul(d, f > S.sinkTo || !scalpSet.has(h.poly) ? h.t + S.lip * k : h.t - S.sink * k));
  }));
  const knotI = add(C, mul(K, rK - S.sink * k));
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V)), cO = V(knotO), cI = V(knotI);
  const top0 = polys.length;
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, crease = cols[j].strip ? { valley: S.creaseShade } : {};
    poly([cO, oi[q][0], oi[j][0]], crease);
    poly([cI, ii[j][0], ii[q][0]], { valley: S.rimShade });
    for (let i = 0; i + 1 < R; i++) {
      poly([oi[j][i], oi[q][i], oi[q][i + 1], oi[j][i + 1]], crease);
      poly([ii[j][i], ii[j][i + 1], ii[q][i + 1], ii[q][i]], { valley: S.rimShade });
    }
    poly([oi[j][R - 1], oi[q][R - 1], ii[q][R - 1], ii[j][R - 1]], { valley: S.rimShade });
  }
  const pieces = [{ id: 'top', polys: [top0, polys.length], verts: [0, verts.length] }];

  // the knot's axis: from the skin's normal at its foot (the direction from the skull's middle) toward straight up
  const A = unit(lerp(K, [0, 1, 0], S.knot.up)), foot = add(C, mul(K, rK));
  const F = unit(sub([0, 0, 1], mul(A, dot([0, 0, 1], A))));
  // the band: a faceted ring round the axis from its foot (in the shell) up its height, its middle bulged, its top
  // narrowed; closed by a fan at each end
  {
    const b = S.band, v0 = verts.length, p0 = polys.length, n = b.sides, r = b.r * k;
    const rings = [[b.foot, 1], [b.foot + b.h / 2, 1 + b.bulge], [b.foot + b.h, b.top]].map(([h, s]) => ring(add(foot, mul(A, h * k)), A, F, n, r * s, 180 / n).map(V));
    const bot = V(add(foot, mul(A, b.foot * k))), top = V(add(foot, mul(A, (b.foot + b.h) * k)));
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      for (let i = 0; i + 1 < rings.length; i++) polys.push({ v: [rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], piece: 1, valley: b.shade });
      polys.push({ v: [bot, rings[0][q], rings[0][j]], piece: 1, valley: b.shade }, { v: [top, rings.at(-1)[j], rings.at(-1)[q]], piece: 1, valley: b.shade });
    }
    pieces.push({ id: 'band', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // the knot: rings of lobes and creases round the axis at its latitudes, each turned on the last, closed at both poles
  {
    const u = S.bun, v0 = verts.length, p0 = polys.length, r = u.r * k, rv = u.rv * k;
    const mid = add(foot, mul(A, (S.band.foot + S.band.h + u.lift) * k));
    // per lobe: its ridge, then a crease's two sides
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
    pieces.push({ id: 'knot', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // each piece's faces turned outward (wound one way round; turned over where that encloses a negative volume)
  for (const pc of pieces) {
    let vol = 0;
    const o = verts[pc.verts[0]];
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], o), cross(sub(verts[v[j]], o), sub(verts[v[j + 1]], o))); }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
  // the undercut's buzz: the head's side faces forward of the shave to the sideburn, as patches just off them
  buzzOf(B, S, verts, polys, k);
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else if (p.v.length > 4) for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]);
    else {
      // (a quad split along its shorter diagonal, so it folds rather than twists)
      const [a, b, c, d] = p.v;
      if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    }
  });
  // (the shaved polygons: the undercut's and the scalp under the shell; the scalp the shell's edge and its inside sink
  // into, left out of the crossing checks, the same)
  const shave = [...new Set([...shaveOf(B, S.shave), ...scalp])].sort((a, b) => a - b);
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, shave, scalp: shave, centre: C, k, grid: { cols, outer: oi, inner: ii } };
  // a face of the shell still through the skin past the scalp (where the skull folds under the edge, between two
  // corners just off it): its inside corners stood off the skin a little at a time, the outside with them where the
  // shell would be under `lip` thick
  const mate = new Map(); ii.forEach((col, j) => col.forEach((v, i) => mate.set(v, oi[j][i])));
  for (let it = 0; it < 40; it++) {
    const X = crossings(rig, hair, B.verts, verts);
    if (!X.n) break;
    for (const v of new Set(X.hits.flatMap(([pi]) => polys[pi].v))) {
      if (!mate.has(v)) continue;
      const r = sub(verts[v], C), l = Math.hypot(...r), w = mate.get(v), ro = sub(verts[w], C), o = Math.hypot(...ro);
      verts[v] = add(C, mul(r, (l + 0.003 * k) / l));
      if (o < l + (0.003 + S.lip) * k) verts[w] = add(C, mul(ro, (l + (0.003 + S.lip) * k) / o));
    }
  }
  return hair;
}

/** The head turned and nodded (tools/sculpt/lowbob.mjs's poses). */
export const POSES = { 'turn left': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, 'turn right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] }, nod: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, 'look up': { neck_01: [-10, 0, 0], neck_02: [-12, 0, 0], head: [-14, 0, 0] } };

/** The hair's crossings through the body, by where: the face (in front of the ears, below the brows), the ears, the
 * neck, the torso, and the scalp's edge (under the shell, hidden). */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const B = rig.B, r = crossings(rig, hair, P, Hv), out = { face: 0, ear: 0, neck: 0, torso: 0, edge: 0 };
  const C = hair.centre;
  for (const [, sp] of r.hits) {
    const poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
    out[poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear ? 'ear' : c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25 ? 'face' : 'edge']++;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), hair = buildTopknot(rig);
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'pieces', hair.pieces.map((p) => `${p.id}:${p.polys[1] - p.polys[0]}`).join(' '), 'buzz', hair.polys.filter((p) => p.buzz).length,
      'valleys', [1, 2, 3, 4].map((s) => hair.polys.filter((p) => p.valley === s).length).join('/'), 'open edges', openEdges(hair), 'shaved', hair.shave.length, 'columns', hair.grid.cols.length);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
