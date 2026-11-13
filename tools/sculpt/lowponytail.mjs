// The high ponytail (tools/sculpt/hairs/ponytail.mjs) for the low-poly bodies: the game's 'ponytail', "High ponytail". No
// reference sheet: built from the style's numbers on each body's own skull (tools/sculpt/lowhair.mjs skullOf, the ray
// from its middle to the skin per direction), after the top knot (tools/sculpt/lowtopknot.mjs), as three closed pieces:
//
//   cap   all the hair drawn back: one shell of locks between the hairline (the forehead's, the temples', over and
//         behind the ears, the nape's: `edge`) and the band, every lock running from the hairline to the band (columns
//         round the band, spaced evenly round the head; a ridge each, a border between two as a narrow crease in the
//         valleys' shade: the comb lines), its rows from the band out to the hairline, its thickness off the skin
//         falling from the band to the hairline; its inside sunk into the rigid scalp it covers, off the skin toward the
//         hairline and over skin that moves with the neck, the rim between the two in the valleys' shade.
//   band  where the tail is tied: a short faceted ring round the tail's root axis, its foot in the shell, in the darkest
//         valley's shade.
//   tail  the ponytail: rings of locks and creases round a spine from the band's top out along the band's axis and down
//         the back to about the shoulder blades, its centre kept off the body's back (and the cap) by its radius and a
//         gap at every height, so it swings out away from the neck; each lock's tip past the tail's end. On the head at
//         its root, on the neck and the chest along it (two bones a vertex, the style's tail.weights), so it follows the
//         back as the head turns and nods.
//
// The scalp the cap covers drawn shaved; the cap over the nape's skin (which moves with the neck) takes that skin's own
// weights, its inside `clear` off it. Kept off the face, the ears, the neck and the torso at rest and in the game's clips'
// poses (clearBody; the poses tools/sculpt/hairs/ponytail-poses-<who>.json: the frames of the clips, 12 a clip, the hair
// as built crossed the body in (tools/sculpt/lowponytailanim.mjs --frames 12 --add), and the head turned and nodded).
//
//   node tools/sculpt/lowponytail.mjs [--who male,female]   # counts, open edges, crossings at rest and turned
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { skullOf, crossings, openEdges, skinHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowtopknot.mjs';
import PONYTAIL from './hairs/ponytail.mjs';

const DIR = new URL('.', import.meta.url).pathname;
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
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The furthest crossing of a ray from o along unit d with triangles (three points, .poly): its distance and polygon. */
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
/** The nearest crossing of a ray from o along unit d with triangles: its distance, or Infinity. */
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

/** The skull's size against the man's (as the top knot's): the style's lengths scaled by it. */
const sizeOf = (B) => { const P = (n) => B.verts[B.index.get(n)]; return (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79); };

/** A ring of `n` corners round the axis A (unit) through o, radius r, the first toward f (unit, across A), turned by a0. */
function ring(o, A, f, n, r, a0 = 0) {
  const g = cross(A, f);
  return Array.from({ length: n }, (_, j) => { const a = rad(a0 + (360 * j) / n); return add(o, mul(add(mul(f, Math.cos(a)), mul(g, Math.sin(a))), r)); });
}

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/ponytail-poses-<who>.json, written by
 * tools/sculpt/lowponytailanim.mjs --write), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/ponytail-poses-${who}.json`), 'utf8')); } catch { return []; }
}

/** A tail vertex's weights at s of its length (W.weights): the head's alone to `head`, then shared with the lower neck
 * (to `share` each by `neck`), then from `back` on more and more the chest's (spine_03, to `chest` of it by `chestAt`),
 * the rest the lower neck's. Its root turns with the head; its end stays off the back as the head nods, turns and looks
 * up. */
export function tailWeights(s, W) {
  const { head, neck, share, back, chestAt, chest } = W.weights, ramp = (x, p, q) => Math.min(1, Math.max(0, (x - p) / (q - p)));
  if (s <= head) return [['head', 1]];
  if (s <= neck) { const t = ramp(s, head, neck) * share; return [['head', 1 - t], ['neck_01', t]]; }
  const t = ramp(s, back, chestAt), h = (1 - share) * (1 - t), c = chest * t;
  return [['head', h], ['neck_01', 1 - h - c], ['spine_03', c]].filter(([, w]) => w > 1e-4);
}

/**
 * The high ponytail on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid, spine }.
 */
export function buildPonytail(rig, S = PONYTAIL, { clear = true } = {}) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B), k = sizeOf(B), E = S.edge[rig.who];
  const skinAt = (d) => farHit(skull, C, d);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const edgeAt = (d) => { const [th, ph] = angOf(d); return ph - interp(E, Math.abs(th)); };
  // the band's direction from the skull's middle, and the frame round it: e1 over the top toward the front, e2 the body's
  // left
  const K = dirOf(180, S.knot.ph), e1 = [0, Math.cos(rad(S.knot.ph)), Math.sin(rad(S.knot.ph))], e2 = [1, 0, 0];
  const along = (al, ga) => unit(add(mul(K, Math.cos(rad(ga))), mul(add(mul(e1, Math.cos(rad(al))), mul(e2, Math.sin(rad(al)))), Math.sin(rad(ga)))));
  // the hairline's angle from the band per azimuth round it (al, degrees: 0 toward the front, + the body's left)
  const edgeGa = (al) => { let ga = 0; while (ga < 175 && edgeAt(along(al, ga + 0.25)) > 0) ga += 0.25; return ga; };
  // the band's foot: its radius as an angle from the skull's middle
  const rK = skinAt(K).t, ga0 = deg(Math.atan2(S.band.r * k * 0.8, rK));
  const gaOf = (al, u) => ga0 + (edgeGa(al) - ga0) * u;
  // the columns: 2 * locks round the band (a ridge at the front, then a border, ...), spaced evenly along the ring
  // spaceAt of the way out
  const N = 2 * S.locks, fine = Array.from({ length: 721 }, (_, i) => i / 2);
  const pts = fine.map((al) => { const d = along(al, gaOf(al, S.spaceAt)); return add(C, mul(d, skinAt(d).t)); });
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const alAt = (s) => { let i = 1; while (i < len.length - 1 && len[i] < s) i++; return fine[i - 1] + ((fine[i] - fine[i - 1]) * (s - len[i - 1])) / Math.max(1e-9, len[i] - len[i - 1]); };
  const cols = [];
  for (let c = 0; c < N; c++) {
    // (a border moved by up to `jitter` of a lock's width, each its own way, so the locks are not all one width)
    const jit = c % 2 ? S.jitter * (hash(c, 7) - 0.5) * 2 : 0;
    const al = alAt((len.at(-1) * (c + jit)) / N), ridge = c % 2 === 0;
    if (ridge || !S.valleyHalf) cols.push({ al, ridge });
    else cols.push({ al: al - S.valleyHalf, ridge: false, strip: true, shade: S.creaseShade[Math.floor(c / 2) % S.creaseShade.length] }, { al: al + S.valleyHalf, ridge: false });
  }
  for (const c of cols) { c.th = Math.abs(angOf(along(c.al, edgeGa(c.al)))[0]); const t = interp(S.tip, c.th); c.tip = c.ridge ? t : -S.tipBack * t; }
  const gaCol = (c, f) => gaOf(c.al, f) + c.tip * f ** 3;
  const nc = cols.length, R = S.rows.length - 1;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  // the shell's outside: per column its rows out from the band, the hair's thickness off the skin there, a ridge's stood
  // out and a border's in
  const thickAt = (u, th = 0) => interp(S.thick, u) * interp(S.thickBy, th) * k;
  const outer = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), rb = skinAt(d).t, t = thickAt(f, c.th), rel = Math.min(S.relief * k, S.reliefShare * t);
    return add(C, mul(d, rb + t + (c.ridge ? rel : -rel)));
  }));
  const knotO = add(C, mul(K, rK + thickAt(0)));
  // the scalp the shell covers: the head's skin polygons (not the ears) every corner of which is inside the hairline
  const covers = (q) => { const [th, ph] = angOf(unit(sub(q, C))); return ph >= interp(E, Math.abs(th)); };
  const scalp = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every((v) => covers(B.verts[v]))) scalp.push(i); });
  const sunk = new Set(scalp.filter((i) => B.polys[i].v.every(rigid)));
  // the inside: sunk into the rigid scalp where the skin under it is covered, out to sinkTo of the way; on toward the
  // hairline just off the skin (lip), over skin that moves with the neck `clear` off it
  const inner = cols.map((c) => S.rows.slice(1).map((f) => {
    const d = along(c.al, gaCol(c, f)), h = skinAt(d);
    const moves = h.poly < 0 || !B.polys[h.poly].v.every(rigid);
    return add(C, mul(d, moves ? h.t + S.clear * k : f > S.sinkTo || !sunk.has(h.poly) ? h.t + S.lip * k : h.t - S.sink * k));
  }));
  const knotI = add(C, mul(K, rK - S.sink * k));
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V)), cO = V(knotO), cI = V(knotI);
  const poly = (v, piece, sh = {}) => polys.push({ v, piece, ...sh });
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, crease = cols[j].strip ? { valley: cols[j].shade } : {};
    poly([cO, oi[q][0], oi[j][0]], 0, crease);
    poly([cI, ii[j][0], ii[q][0]], 0, { valley: S.rimShade, inside: true });
    for (let i = 0; i + 1 < R; i++) {
      poly([oi[j][i], oi[q][i], oi[q][i + 1], oi[j][i + 1]], 0, crease);
      poly([ii[j][i], ii[j][i + 1], ii[q][i + 1], ii[q][i]], 0, { valley: S.rimShade, inside: true });
    }
    poly([oi[j][R - 1], oi[q][R - 1], ii[q][R - 1], ii[j][R - 1]], 0, { valley: S.rimShade, rim: true });
  }
  const pieces = [{ id: 'cap', polys: [0, polys.length], verts: [0, verts.length] }];

  // the band's axis: straight back, tipped up band.ph; its foot on the skull
  const A = dirOf(180, S.band.ph), foot = add(C, mul(K, rK));
  const F = [1, 0, 0];
  {
    const b = S.band, v0 = verts.length, p0 = polys.length, n = b.sides, r = b.r * k;
    const rings = [[b.foot, 1], [b.foot + b.h / 2, 1 + b.bulge], [b.foot + b.h, b.top]].map(([h, s]) => ring(add(foot, mul(A, h * k)), A, F, n, r * s, 180 / n).map(V));
    const bot = V(add(foot, mul(A, b.foot * k))), top = V(add(foot, mul(A, (b.foot + b.h) * k)));
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      for (let i = 0; i + 1 < rings.length; i++) poly([rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], 1, { valley: b.shade });
      poly([bot, rings[0][q], rings[0][j]], 1, { valley: b.shade }); poly([top, rings.at(-1)[j], rings.at(-1)[q]], 1, { valley: b.shade });
    }
    pieces.push({ id: 'band', polys: [p0, polys.length], verts: [v0, verts.length] });
  }

  // the tail's spine: from the band's top out along its axis, then down to its tip `below` under the clavicles' joints,
  // a cubic through those; each station then moved back where the body (or the cap over the skull) is nearer than its
  // radius and the gap, and the run smoothed
  const T = S.tail, T0 = add(foot, mul(A, (S.band.foot + S.band.h) * k));
  const clav = rig.bones[rig.at.get('clavicle_l')].head[1], tipY = clav - T.below;
  const backT = B.tris.filter((t) => ['head', 'neck', 'torso', 'joint'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const capT = polys.slice(pieces[0].polys[0], pieces[0].polys[1]).flatMap((p) => p.v.slice(2).map((_, j) => [verts[p.v[0]], verts[p.v[j + 1]], verts[p.v[j + 2]]]));
  // (the backmost point of the body and the cap at a height y, over |x| under r: the least z)
  const backZ = (y, r) => {
    let z = Infinity;
    for (const x of [-r, -r / 2, 0, r / 2, r]) { const t = Math.min(nearHit(backT, [x, y, -6], [0, 0, 1]), nearHit(capT, [x, y, -6], [0, 0, 1])); if (Number.isFinite(t)) z = Math.min(z, -6 + t); }
    return z;
  };
  const rOf = (s) => interp(T.r, s) * k;
  const P1 = add(T0, mul(A, T.out * k));
  const zTip = backZ(tipY, rOf(1)) - rOf(1) * T.depth - T.gap * k;
  const P2 = [0, P1[1] - 0.45 * (P1[1] - tipY), Math.min(P1[2], zTip)], P3 = [0, tipY, zTip];
  const bez = (u) => { const w = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3]; return [T0, P1, P2, P3].reduce((a, p, i) => add(a, mul(p, w[i])), [0, 0, 0]); };
  const fineS = Array.from({ length: 201 }, (_, i) => bez(i / 200));
  const flen = [0]; for (let i = 1; i < fineS.length; i++) flen.push(flen[i - 1] + Math.hypot(...sub(fineS[i], fineS[i - 1])));
  const at = (s) => { const L = s * flen.at(-1); let i = 1; while (i < flen.length - 1 && flen[i] < L) i++; return lerp(fineS[i - 1], fineS[i], Math.min(1, Math.max(0, (L - flen[i - 1]) / Math.max(1e-9, flen[i] - flen[i - 1])))); };
  const stations = T.rings.map((s) => at(s));
  const need = stations.map((p, i) => (i < 2 ? -Infinity : backZ(p[1], rOf(T.rings[i])) - rOf(T.rings[i]) * T.depth - T.gap * k));
  for (let it = 0; it < 30; it++) {
    for (let i = 2; i < stations.length; i++) if (stations[i][2] > need[i]) stations[i] = [stations[i][0], stations[i][1], need[i]];
    if (it === 29) break;
    // (each inner station toward its neighbours' middle, a little)
    for (let i = 2; i + 1 < stations.length; i++) stations[i] = lerp(stations[i], lerp(stations[i - 1], stations[i + 1], 0.5), 0.3);
  }
  // the rings: per lock a ridge (out) and a crease's two sides (in); the section an oval (its depth along the body's
  // front-back), each ring turned on the last
  {
    const v0 = verts.length, p0 = polys.length, n = T.lobes, w = 360 / n, cs = [];
    for (let l = 0; l < n; l++) cs.push({ a: l * w, s: 1 + T.relief, ridge: true, lock: l }, { a: l * w + w / 2 - T.creaseHalf, s: 1 - T.relief, strip: true }, { a: l * w + w / 2 + T.creaseHalf, s: 1 - T.relief });
    const tanAt = (i) => unit(sub(stations[Math.min(stations.length - 1, i + 1)], stations[Math.max(0, i - 1)]));
    const tipK = (l) => 1 + T.tipVar * (hash(l + 1, rig.who.length) - 0.5) * 2;
    const last = stations.length - 1;
    const rings = stations.map((o, i) => {
      const t = tanAt(i), X = F, Y = unit(cross(t, X)), r = rOf(T.rings[i]);
      return cs.map((c) => {
        const a = rad(c.a + i * T.twist);
        let p = add(o, add(mul(X, Math.cos(a) * r * c.s), mul(Y, Math.sin(a) * r * c.s * T.depth)));
        // (the end: each ridge on past it to its lock's tip, thinner; the creases short of it)
        if (i === last) p = c.ridge ? add(add(o, mul(sub(p, o), T.tipIn)), mul(t, T.tipLen * k * tipK(c.lock))) : add(p, mul(t, -T.tipBack * k));
        return V(p);
      });
    });
    const root = V(add(T0, mul(A, -0.02 * k))), apex = V(add(stations[last], mul(tanAt(last), T.apex * T.tipLen * k)));
    const m = cs.length, sh = (j) => (cs[j].strip ? { valley: T.creaseShade } : {});
    for (let j = 0; j < m; j++) {
      const q = (j + 1) % m;
      poly([root, rings[0][q], rings[0][j]], 2, sh(j));
      for (let i = 0; i + 1 < rings.length; i++) poly([rings[i][j], rings[i][q], rings[i + 1][q], rings[i + 1][j]], 2, sh(j));
      poly([apex, rings[last][j], rings[last][q]], 2, sh(j));
    }
    pieces.push({ id: 'tail', polys: [p0, polys.length], verts: [v0, verts.length], rings, stations, root, apex });
  }
  // each piece's faces turned outward (wound one way round; turned over where that encloses a negative volume)
  for (const pc of pieces) {
    let vol = 0;
    const o = verts[pc.verts[0]];
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], o), cross(sub(verts[v[j]], o), sub(verts[v[j + 1]], o))); }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
  // the weights: the cap and the band on the head; the tail along its length (tailWeights), by its ring
  const tail = pieces[2], sOfV = new Map();
  tail.rings.forEach((rg, i) => rg.forEach((v) => sOfV.set(v, T.rings[i])));
  sOfV.set(tail.root, 0); sOfV.set(tail.apex, 1);
  // (the cap where it lies over skin that moves with the neck, the nape's: the skin's own weights under it, so it moves
  // as that skin does)
  const capEnd = pieces[0].verts[1];
  const weights = verts.map((p, i) => (sOfV.has(i) ? tailWeights(sOfV.get(i), T) : i < capEnd ? skinWeightsAt(rig, C, unit(sub(p, C))) : [['head', 1]]));
  const tris = trisOf(verts, polys, C);
  // (the shaved polygons: the scalp under the shell, every corner inside the hairline; those it sinks into, the rigid
  // ones, left out of the crossing checks)
  const hair = { verts, polys, tris, weights, pieces, shave: scalp, scalp: [...sunk], centre: C, k, grid: { cols, outer: oi, inner: ii }, spine: stations };
  // a face of the shell still through the skin (where the skull folds under the hairline, between two corners just off
  // it): its inside corners stood off the skin a little at a time, the outside with them where the shell would be under
  // `lip` thick
  const mate = new Map(); ii.forEach((col, j) => col.forEach((v, i) => mate.set(v, oi[j][i])));
  hair.mate = mate;
  for (let it = 0; it < 40; it++) {
    const X = crossings(rig, hair, B.verts, verts);
    const vs = new Set(X.hits.flatMap(([pi]) => polys[pi].v).filter((v) => mate.has(v)));
    if (!vs.size) break;
    for (const v of vs) {
      const r = sub(verts[v], C), l = Math.hypot(...r), w = mate.get(v), ro = sub(verts[w], C), o = Math.hypot(...ro);
      verts[v] = add(C, mul(r, (l + 0.003 * k) / l));
      if (o < l + (0.003 + S.lip) * k) verts[w] = add(C, mul(ro, (l + (0.003 + S.lip) * k) / o));
    }
  }
  // the cap's outside over every point of the skin it covers (coverSkin), and at least `minGap` outside its inside
  coverSkin(B, C, verts, polys, S.cover * k, mate, S.minGap * k);
  if (clear) clearBody(rig, hair, S);
  hair.tris = trisOf(verts, polys, C);
  return hair;
}

/**
 * The cap's outside over the head's skin (the skull is a few large flat polygons; the cap's faces, a few corners apart,
 * cut under its convex creases): a point of the skin (not the ears') under the cap and within `margin` of its outside
 * (or through it) moves the outside's face there out along its corners' rays, until none is; each outside corner kept
 * `gap` outside its inside one (mate: inside corner to outside), so the inside never shows through.
 */
function coverSkin(B, C, verts, polys, margin, mate, gap) {
  const skinV = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly]; if (p.part !== 'head' || p.mat !== 'skin' || p.ear) continue;
    const [a, b, c] = t.v.map((i) => B.verts[i]);
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b))) / 0.03));
    for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) skinV.push(add(a, add(mul(sub(b, a), i / n), mul(sub(c, a), j / n))));
  }
  const cap = polys.filter((p) => p.piece === 0 && !p.inside && !p.rim);
  const keepOut = () => { for (const [vi, vo] of mate) { const di = sub(verts[vi], C), li = Math.hypot(...di), dO = sub(verts[vo], C), lo = Math.hypot(...dO); if (lo < li + gap) verts[vo] = add(C, mul(dO, (li + gap) / lo)); } };
  keepOut();
  for (let it = 0; it < 30; it++) {
    const T = trisOf(verts, cap, C).map(([a, b, c]) => Object.assign([verts[a], verts[b], verts[c]], { poly: [a, b, c] }));
    const push = new Map();
    for (const v of skinV) {
      const w = sub(v, C), rv = Math.hypot(...w), h = farHit(T, C, mul(w, 1 / rv));
      if (h.t > 0 && h.t < rv + margin) for (const i of h.poly) push.set(i, Math.max(push.get(i) ?? 0, rv + margin - h.t));
    }
    if (!push.size) break;
    for (const [i, by] of push) { const w = sub(verts[i], C), l = Math.hypot(...w); verts[i] = add(C, mul(w, (l + by + 0.002) / l)); }
  }
  keepOut();
}

const HEADSKIN = new Map();
/** The weights of the head's skin (not the ears) where the ray from C along unit d leaves it, its corners' weights
 * mixed by where it meets their triangle: the three largest, summing to 1. */
function skinWeightsAt(rig, C, d) {
  const B = rig.B;
  if (!HEADSKIN.has(rig.who)) HEADSKIN.set(rig.who, B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }));
  let best = 0, at = null;
  for (const t of HEADSKIN.get(rig.who)) {
    const [a, b, c] = t.v.map((i) => B.verts[i]), e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(C, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const tt = dot(e2, q) / det; if (tt > best) { best = tt; at = { v: t.v, w: [1 - u - v, u, v] }; }
  }
  if (!at) return [['head', 1]];
  const sum = {};
  at.v.forEach((vi, j) => { for (const [bn, w] of rig.weights[B.names[vi]]) sum[bn] = (sum[bn] ?? 0) + w * at.w[j]; });
  const top = Object.entries(sum).filter(([, w]) => w > 1e-3).sort((x, y) => y[1] - x[1]).slice(0, 3), tot = top.reduce((a, [, w]) => a + w, 0);
  return top.map(([bn, w]) => [bn, +(w / tot).toFixed(4)]);
}

/** Each polygon's triangles: a quad split along its shorter diagonal (so it folds rather than twists); with C (the
 * skull's middle) a quad of the cap's outside folded out from it and one of its inside in toward it (the diagonal whose
 * middle is the further, the nearer), so the inside never shows through the outside between their corners; a fan else. */
function trisOf(verts, polys, C = null) {
  const tris = [];
  const far = (a, b) => Math.hypot(...sub(lerp(verts[a], verts[b], 0.5), C));
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else if (p.v.length > 4) for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]);
    else {
      const [a, b, c, d] = p.v;
      const ac = C && p.piece === 0 && !p.rim ? (p.inside ? far(a, c) <= far(b, d) : far(a, c) >= far(b, d)) : Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]));
      if (ac) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    }
  });
  return tris;
}

/**
 * The hair clear of the body at rest and in the game's clips' poses (tools/sculpt/hairs/ponytail-poses-<who>.json): a
 * face of the cap through the skin that is not the scalp has its corners moved out `step` at a time from the skull's
 * middle (an inner corner's outer one with it, so the shell keeps its thickness); a face of the tail through it has its
 * ring moved back, away from the body (and the rings either side of it half that), until none is.
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, mate } = hair, C = hair.centre, tail = hair.pieces[2];
  const ringOf = new Map(); tail.rings.forEach((rg, i) => rg.forEach((v) => ringOf.set(v, i)));
  const poses = posesOf(rig.who);
  const states = [{ P: rig.B.verts, f: null, clip: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, clip: pose.$clip }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  let live = states;
  for (let it = 0; it < 150; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat(), moveRing = new Map(), moveCap = new Set();
    for (const [hp] of hits) for (const v of hair.polys[hp].v) {
      if (ringOf.has(v)) { const i = ringOf.get(v); moveRing.set(i, 1); for (const j of [i - 1, i + 1]) if (j >= 1 && j < tail.rings.length && !moveRing.has(j)) moveRing.set(j, 0.5); }
      else if (v === tail.apex) moveRing.set(tail.rings.length - 1, 1);
      else if (v < hair.pieces[0].verts[1]) moveCap.add(v);
    }
    for (const [i, w] of moveRing) {
      if (i === 0) continue;
      for (const v of tail.rings[i]) verts[v] = add(verts[v], [0, 0, -step * w]);
      if (i === tail.rings.length - 1) verts[tail.apex] = add(verts[tail.apex], [0, 0, -step * w]);
    }
    for (const v of moveCap) {
      const d = unit(sub(verts[v], C));
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) { const gap = dot(sub(verts[o], verts[v]), d); if (gap < 0.02) verts[o] = add(verts[o], mul(d, 0.02 - gap)); }
    }
  }
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.cleared = crossings(rig, hair, rig.B.verts, verts).n;
  return hair;
}

/** The high ponytail on a body, as the game takes it. */
export const ponytailOf = (rig, style = PONYTAIL) => buildPonytail(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildPonytail(rig, PONYTAIL, { clear: !args.includes('--raw') });
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'pieces', hair.pieces.map((p) => `${p.id}:${p.polys[1] - p.polys[0]}`).join(' '),
      'valleys', [1, 2, 3, 4].map((s) => hair.polys.filter((p) => p.valley === s).length).join('/'), 'open edges', openEdges(hair), 'shaved', hair.shave.length, 'columns', hair.grid.cols.length,
      'cleared in', JSON.stringify(hair.clearedIn?.reduce((a, x) => a + x, 0)), 'ms', Date.now() - t0);
    console.log(who, 'spine', hair.spine.map((p) => `(${p[1].toFixed(2)},${p[2].toFixed(2)})`).join(' '));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
