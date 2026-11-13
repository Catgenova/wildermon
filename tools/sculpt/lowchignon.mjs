// The low chignon (tools/sculpt/hairs/chignon.mjs) for the low-poly bodies: the game's 'chignon', "Low chignon". No
// reference sheet: built from the style's numbers on each body's own skull (tools/sculpt/lowhair.mjs skullOf, the ray
// from its middle to the skin per direction), in the shape of the top knot (tools/sculpt/lowtopknot.mjs), as three
// closed pieces, rigid on the head:
//
//   shell   the hair swept back: one shell of locks between the hairline (`edge`: the forehead's, over the temples and
//           the ears, down behind the ears to the nape) and the bun, every lock running from the hairline to the bun
//           (columns round the bun, spaced evenly round the head; a ridge each, a border between two as a narrow comb
//           line in a valley's shade), its rows from the bun out to the hairline; the side part one border widened into
//           a groove in the darkest valley's shade toward the forehead, the hair thinned there and raised the far side
//           of it; its inside sunk into the scalp it covers, off the skin at the hairline, the rim between the two (the
//           hairline's thickness) in the valleys' shade.
//   bun     the chignon: a rolled bun at the nape, wider than high, its axis out from the skull toward straight back,
//           its lobes coiled (each ring turned on the last, a crease between two lobes).
//   strand  one loose strand at a temple: a faceted tapered lock from under the hairline, down in front of the ear.
//
// The scalp under the shell drawn shaved (the head's own polygons in the shaved tone where the hairline thins). Kept off
// the face, the ears, the neck and the shoulders at rest and in the game's clips, and the nape's skin, which the neck
// pulls about, kept under the hair's outside in them (clearPoses: the frames tools/sculpt/lowchignonanim.mjs --write
// found a crossing in, tools/sculpt/hairs/chignon-poses-<who>.json).
//
//   node tools/sculpt/lowchignon.mjs [--who male,female]   # counts, open edges, crossings at rest and turned
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { skullOf, crossings, openEdges, skinHair } from './lowhair.mjs';
import { dirOf, angOf, crossReport, POSES } from './lowtopknot.mjs';
import CHIGNON from './hairs/chignon.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
const interp = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 0; i + 1 < T.length; i++) if (x <= T[i + 1][0]) return T[i][1] + ((T[i + 1][1] - T[i][1]) * (x - T[i][0])) / (T[i + 1][0] - T[i][0]);
  return T.at(-1)[1];
};
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
/** An angle's difference from another, in -180..180. */
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

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

/**
 * The shell's outside over the head's skin (the skull is a few large flat polygons; the shell's faces, a few corners
 * apart, cut under its convex creases): a point of the skin (not the ears') under the outside and within `margin` of it
 * (or through it) moves the outside's face there out along its corners' rays, until none is (tools/sculpt/lowwarrior.mjs
 * coverSkin).
 */
function coverSkin(B, C, verts, cap, margin) {
  const skinV = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly]; if (p.part !== 'head' || p.mat !== 'skin' || p.ear) continue;
    const [a, b, c] = t.v.map((i) => B.verts[i]);
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b))) / 0.03));
    for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) skinV.push(add(a, add(mul(sub(b, a), i / n), mul(sub(c, a), j / n))));
  }
  const triOf = (p) => (p.v.length === 3 ? [p.v] : [[p.v[0], p.v[1], p.v[2]], [p.v[0], p.v[2], p.v[3]], [p.v[0], p.v[1], p.v[3]], [p.v[1], p.v[2], p.v[3]]]);
  for (let it = 0; it < 30; it++) {
    const T = cap.flatMap(triOf).map((v) => Object.assign(v.map((i) => verts[i]), { poly: v }));
    const push = new Map();
    for (const v of skinV) {
      const w = sub(v, C), rv = Math.hypot(...w), d = mul(w, 1 / rv);
      let best = 0, at = null;
      for (const tri of T) { const h = farHit([tri], C, d); if (h.t > best) { best = h.t; at = tri.poly; } }
      if (at && best < rv + margin) for (const i of at) push.set(i, Math.max(push.get(i) ?? 0, rv + margin - best));
    }
    if (!push.size) break;
    for (const [i, by] of push) { const w = sub(verts[i], C), l = Math.hypot(...w); verts[i] = add(C, mul(w, (l + by + 0.002) / l)); }
  }
}

/**
 * The low chignon on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave,
 * scalp, centre, k, grid }.
 */
export function buildChignon(rig, S = CHIGNON) {
  const B = rig.B, who = rig.who, { tris: skull, centre: C } = skullOf(B), k = sizeOf(B), E = S.edge[who];
  const skinAt = (d) => farHit(skull, C, d);
  const edgeAt = (d) => { const [th, ph] = angOf(d); return ph - interp(E, Math.abs(th)); };
  // the bun's direction from the skull's middle; a direction as lam (toward the body's left, from the middle plane) and
  // mu (round the left-right axis: the front's 0, up 90, the back 180); the locks run from the bun along straight lines
  // in (lam, mu), so the front's go back over the top, the sides' back over the ears, all drawn in to the bun
  const kph = S.knot.ph[who], K = dirOf(S.knot.th, kph), lamK = deg(Math.asin(K[0])), muK = (deg(Math.atan2(K[1], K[2])) + 360) % 360;
  const along = (al, ga) => {
    const lam = rad(Math.max(-89, Math.min(89, lamK + ga * Math.sin(rad(al))))), mu = rad(muK - ga * Math.cos(rad(al)));
    return [Math.sin(lam), Math.cos(lam) * Math.sin(mu), Math.cos(lam) * Math.cos(mu)];
  };
  // the hairline's angle from the bun per azimuth round it (al, degrees: 0 up over the crown to the forehead, + the
  // body's left)
  const EG = new Map();
  const edgeGa = (al) => {
    const key = al.toFixed(4);
    if (!EG.has(key)) { let ga = 0; while (ga < 175 && edgeAt(along(al, ga + 0.25)) > 0) ga += 0.25; EG.set(key, ga); }
    return EG.get(key);
  };
  // the shell's first ring: under the bun, its foot's radius as an angle from the skull's middle
  const rK = skinAt(K).t, ga0 = deg(Math.atan2(0.5 * S.bun.ry * k, rK));
  const gaOf = (al, u) => ga0 + (edgeGa(al) - ga0) * u;
  const endTh = (al) => angOf(along(al, edgeGa(al)))[0];
  // the columns: 2 * locks round the bun (a ridge straight up over the crown, then a border, ...), spaced evenly along
  // the ring spaceAt of the way out
  const N = 2 * S.locks, fine = Array.from({ length: 721 }, (_, i) => i / 2);
  const pts = fine.map((al) => { const d = along(al, gaOf(al, S.spaceAt)); return add(C, mul(d, skinAt(d).t)); });
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const alAt = (s) => { let i = 1; while (i < len.length - 1 && len[i] < s) i++; return fine[i - 1] + ((fine[i] - fine[i - 1]) * (s - len[i - 1])) / Math.max(1e-9, len[i] - len[i - 1]); };
  // the side part: the azimuth whose lock meets the hairline at the part's theta; the border nearest it moved there
  let alP = 0;
  { let best = Infinity; for (let al = 0; al <= 120; al += 0.25) { const e = Math.abs(endTh(al) - S.part.th); if (e < best) { best = e; alP = al; } } }
  const raw = Array.from({ length: N }, (_, c) => ({ al: alAt((len.at(-1) * c) / N), ridge: c % 2 === 0 }));
  const near = raw.filter((c) => !c.ridge).reduce((a, c) => (Math.abs(wrap(c.al - alP)) < Math.abs(wrap(a.al - alP)) ? c : a));
  const cols = [];
  for (const c of raw) {
    if (c.ridge) cols.push({ ...c });
    else if (c === near) cols.push({ al: alP - S.part.half, ridge: false, strip: true, part: true }, { al: alP + S.part.half, ridge: false, part: true });
    else cols.push({ al: c.al - S.valleyHalf, ridge: false, strip: true }, { al: c.al + S.valleyHalf, ridge: false });
  }
  for (const c of cols) c.th = Math.abs(endTh(c.al));
  const nc = cols.length, R = S.rows.length - 1;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  // the hair's thickness off the skin: by the way out and where the lock ends; thinned in the part, raised the far side
  const P = S.part;
  const thickAt = (u, c = null) => {
    let t = interp(S.thick, u) * interp(S.thickBy, c ? c.th : 0) * k;
    if (!c) return t;
    const w = ramp(u, P.from, P.from + 0.2);
    if (c.part) t *= 1 - P.dip * w;
    const dal = wrap(c.al - alP);
    if (!c.part && dal < 0 && -dal < P.spread) t += P.lift * k * w * (1 + dal / P.spread);
    return t;
  };
  const outer = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaOf(c.al, f)), rb = skinAt(d).t, t = thickAt(f, c), rel = Math.min(S.relief * k, S.reliefShare * t);
    return add(C, mul(d, rb + t + (c.ridge ? rel : -rel)));
  }));
  const knotO = add(C, mul(K, rK + thickAt(0)));
  // the scalp the shell covers: the head's skin polygons (not the ears) every corner of which is above the hairline
  const covers = (q) => { const [th, ph] = angOf(unit(sub(q, C))); return ph >= interp(E, Math.abs(th)); };
  const scalp = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every((v) => covers(B.verts[v]))) scalp.push(i); });
  const scalpSet = new Set(scalp);
  // the inside: sunk into the scalp where the skin under it is covered, out to sinkTo of the way; on toward the
  // hairline just off the skin
  const inner = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaOf(c.al, f)), h = skinAt(d);
    return add(C, mul(d, f > S.sinkTo || !scalpSet.has(h.poly) ? h.t + S.lip * k : h.t - S.sink * k));
  }));
  const knotI = add(C, mul(K, rK - S.sink * k));
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V)), cO = V(knotO), cI = V(knotI);
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, c = cols[j];
    const shade = (f) => ({ outside: true, ...(c.strip ? { valley: c.part && f >= P.from ? P.shade : S.creaseShade } : {}) });
    poly([cO, oi[q][0], oi[j][0]], shade(0));
    poly([cI, ii[j][0], ii[q][0]], { valley: S.rimShade });
    for (let i = 0; i + 1 < R; i++) {
      poly([oi[j][i], oi[q][i], oi[q][i + 1], oi[j][i + 1]], shade(S.rows[i + 1]));
      poly([ii[j][i], ii[j][i + 1], ii[q][i + 1], ii[q][i]], { valley: S.rimShade });
    }
    poly([oi[j][R - 1], oi[q][R - 1], ii[q][R - 1], ii[j][R - 1]], { valley: S.rimShade });
  }
  const pieces = [{ id: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];

  // the bun: rings of lobes and creases round its axis at its latitudes, each turned on the last, closed at both poles;
  // its cross-section an oval (rx across, ry up and down)
  const u = S.bun, foot = add(C, mul(K, rK));
  const A = unit(add(lerp(K, [0, 0, -1], S.knot.back), [0, S.knot.up, 0])), F = [1, 0, 0], G = cross(A, F);
  {
    const v0 = verts.length, p0 = polys.length, mid = add(foot, mul(A, u.out * k));
    const cs = [];
    for (let l = 0; l < u.lobes; l++) { const a = (360 * l) / u.lobes, w = 360 / u.lobes; cs.push({ a, s: 1 + u.relief }, { a: a + w / 2 - 5, s: 1 - u.relief, strip: true }, { a: a + w / 2 + 5, s: 1 - u.relief }); }
    const rings = u.lats.map((lat, i) => cs.map((c) => {
      const a = rad(c.a + i * u.twist), cl = Math.cos(rad(lat)) * c.s;
      return V(add(add(mid, mul(A, u.rv * k * Math.sin(rad(lat)))), add(mul(F, Math.cos(a) * u.rx * k * cl), mul(G, Math.sin(a) * u.ry * k * cl))));
    }));
    const bot = V(add(mid, mul(A, -u.rv * k))), apex = V(add(mid, mul(A, u.rv * k)));
    const n = cs.length, sh = (j) => (cs[j].strip ? { valley: u.creaseShade } : {});
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      polys.push({ v: [bot, rings[0][q], rings[0][j]], piece: 1, ...sh(j) });
      for (let i = 0; i + 1 < rings.length; i++) polys.push({ v: [rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], piece: 1, ...sh(j) });
      polys.push({ v: [apex, rings.at(-1)[j], rings.at(-1)[q]], piece: 1, ...sh(j) });
    }
    pieces.push({ id: 'bun', polys: [p0, polys.length], verts: [v0, verts.length] });
  }

  // the loose strand: from under the hairline at the temple down the skin in front of the ear, drawn forward with a
  // wave, off the skin and curling out toward its tip, a flat diamond section narrowing to a point
  if (S.strand) {
    const s = S.strand, v0 = verts.length, p0 = polys.length;
    const ph0 = interp(E, Math.abs(s.th)) + s.above, r0 = skinAt(dirOf(s.th, ph0)).t, drop = deg((s.len * k) / r0);
    const spine = Array.from({ length: s.rings }, (_, i) => {
      const f = i / (s.rings - 1), th = s.th - Math.sign(s.th) * (s.fwd * f + s.wave * Math.sin(2 * Math.PI * f)), ph = ph0 - drop * f, d = dirOf(th, ph);
      return add(C, mul(d, skinAt(d).t + (0.012 + (s.off - 0.012) * Math.min(1, 3 * f) + s.curl * f * f) * k));
    });
    const rings = spine.slice(0, -1).map((p, i) => {
      const f = i / (s.rings - 1), nrm = unit(sub(p, C)), dn = unit(sub(spine[i + 1], p)), across = unit(cross(dn, nrm)), out = unit(cross(across, dn));
      const w = s.w * k * (1 - 0.75 * f ** 1.5) / 2, dd = s.d * k * (1 - 0.6 * f) / 2;
      return [add(p, mul(across, w)), add(p, mul(out, dd)), add(p, mul(across, -w)), add(p, mul(out, -dd))].map(V);
    });
    const tip = V(spine.at(-1));
    const sh = (j) => (j >= 2 ? { valley: s.shade } : {});
    polys.push({ v: rings[0].slice().reverse(), piece: 2, valley: s.shade });
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 4; j++) { const q = (j + 1) % 4; polys.push({ v: [rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], piece: 2, ...sh(j) }); }
    for (let j = 0; j < 4; j++) polys.push({ v: [rings.at(-1)[j], rings.at(-1)[(j + 1) % 4], tip], piece: 2, ...sh(j) });
    pieces.push({ id: 'strand', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  // each piece's faces turned outward (wound one way round; turned over where that encloses a negative volume)
  for (const pc of pieces) {
    let vol = 0;
    const o = verts[pc.verts[0]];
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], o), cross(sub(verts[v[j]], o), sub(verts[v[j + 1]], o))); }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
  coverSkin(B, C, verts, polys.filter((p) => p.outside), S.cover * k);
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
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, shave: scalp, scalp, centre: C, k, grid: { cols, outer: oi, inner: ii, alP } };
  // a face of the shell still through the skin past the scalp (where the skull folds under the hairline, between two
  // corners just off it): its inside corners stood off the skin a little at a time, the outside with them where the
  // shell would be under `lip` thick; a corner of the strand moved out from the skull's middle
  const mate = new Map([[cI, cO]]); ii.forEach((col, j) => col.forEach((v, i) => mate.set(v, oi[j][i])));
  const strand = pieces.find((p) => p.id === 'strand');
  for (let it = 0; it < 100; it++) {
    const X = crossings(rig, hair, B.verts, verts);
    if (!X.n) break;
    for (const v of new Set(X.hits.flatMap(([pi]) => polys[pi].v))) {
      const r = sub(verts[v], C), l = Math.hypot(...r);
      if (strand && v >= strand.verts[0] && v < strand.verts[1]) { verts[v] = add(C, mul(r, (l + 0.003 * k) / l)); continue; }
      if (!mate.has(v)) continue;
      const w = mate.get(v), ro = sub(verts[w], C), o = Math.hypot(...ro);
      verts[v] = add(C, mul(r, (l + 0.003 * k) / l));
      if (o < l + (0.003 + S.lip) * k) verts[w] = add(C, mul(ro, (l + (0.003 + S.lip) * k) / o));
    }
  }
  clearPoses(rig, hair, S, mate);
  return hair;
}

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/chignon-poses-<who>.json, written by
 * tools/sculpt/lowchignonanim.mjs --write: the frames where it crossed the body), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/chignon-poses-${who}.json`), 'utf8')); } catch { return []; }
}

/**
 * The hair clear of the body in the game's clips' poses (posesOf): where the neck pulls the nape's skin out through the
 * hair's outside, or the hair meets the neck or the shoulders, the hair's corners there moved out from the skull's
 * middle `step` at a time (an inside corner's outside one with it, so the shell keeps `lip` of thickness), until no
 * pose has a crossing that shows (shown). Rigid on the head, so moved once for every pose.
 */
function clearPoses(rig, hair, S, mate, step = 0.004) {
  const { verts } = hair, C = hair.centre, k = hair.k;
  const states = posesOf(rig.who).map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; });
  const hitsIn = (st) => shown(rig, hair, st.P, skinHair(rig, hair, st.f));
  let live = states;
  for (let it = 0; it < 150 && states.length; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, i) => per[i].length);
    for (const v of new Set(per.flat().flatMap(([hp]) => hair.polys[hp].v))) {
      const r = sub(verts[v], C), l = Math.hypot(...r);
      verts[v] = add(C, mul(r, (l + step * k) / l));
      const w = mate.get(v);
      if (w !== undefined) { const ro = sub(verts[w], C), o = Math.hypot(...ro); if (o < l + (step + S.lip) * k) verts[w] = add(C, mul(ro, (l + (step + S.lip) * k) / o)); }
    }
  }
  hair.clearedIn = states.map(hitsIn).reduce((a, h) => a + h.length, 0);
  hair.poses = states.length;
}

/** The hair's crossings through the body that would show (P, H: the body's and the hair's vertices, posed): any of it
 * through the face, the ears, the neck or the torso, and the hair's outside (the shell's outside, the bun, the strand)
 * through the rest of the head's skin (the scalp under the shell, where the neck pulls it out through the hair). */
export function shown(rig, hair, P = rig.B.verts, H = hair.verts) {
  const B = rig.B, C = hair.centre;
  return crossings(rig, hair, P, H).hits.filter(([hp, sp]) => {
    const p = hair.polys[hp], s = B.polys[sp];
    if (s.part !== 'head' || s.ear || p.outside || p.piece > 0) return true;
    const c = s.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / s.v.length), [0, 0, 0]);
    return c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25;
  });
}

/** The hair's crossings through the body (tools/sculpt/lowtopknot.mjs crossReport: the face, the ears, the neck, the
 * torso, and the scalp's edge under the shell), and of those at the scalp's edge the ones through the hair's outside:
 * `through`, the skin showing through the hair. */
export function chignonReport(rig, hair, P = rig.B.verts, H = hair.verts) {
  const out = crossReport(rig, hair, P, H), B = rig.B;
  out.through = shown(rig, hair, P, H).filter(([, sp]) => B.polys[sp].part === 'head' && !B.polys[sp].ear).length - out.face;
  return out;
}

/** The low chignon on a body, as the game takes it. */
export const chignonOf = (rig, style = CHIGNON) => buildChignon(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), hair = chignonOf(rig);
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'pieces', hair.pieces.map((p) => `${p.id}:${p.polys[1] - p.polys[0]}`).join(' '),
      'valleys', [1, 2, 3, 4].map((s) => hair.polys.filter((p) => p.valley === s).length).join('/'), 'open edges', openEdges(hair), 'clip poses', hair.poses, 'left crossing in them', hair.clearedIn, 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'part al', hair.grid.alP);
    console.log(who, 'crossings at rest', JSON.stringify(chignonReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(chignonReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
