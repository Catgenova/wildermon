// The buzz cut (tools/sculpt/hairs/buzz.mjs) for the low-poly bodies: the game's 'buzz', "Buzz cut". No reference sheet:
// one thin closed shell laid over each body's own skull (tools/sculpt/lowhair.mjs skullOf: the head's skin without the
// ears), from the skull's middle per direction (theta round from the front toward the body's left, phi up):
//
//   columns  one per hairline point of the style (its `hem`, mirrored for the body's right), each from the crown down
//            through the style's level rows to its hairline: the forehead's, the temple's corner, the sideburn, over
//            the ear, behind it, the nape;
//   outside  each corner the hair's height off the skin there (`top` over the crown easing to `side` low down, `edge` at
//            the hairline), moved a little each its own way (`jitter`); the bands' quads joined a few columns at a
//            time into one flat-lit facet each (staggered band to band), the crown a cap of `crownPlanes` planes: a few
//            planes, not the skull's own; the last band over the hairline (the taper) on the sides and the back drawn in
//            the shaved scalp's tone (the clippers' fade), the front's hairline a clean edge;
//   inside   sunk into the scalp where the skin under it is covered whole and moves with the head, else just off the
//            skin; the rim between them at the hairline (the cut's thickness) in a valley's shade.
//
// Each vertex skinned as the skin under it is (its bones' weights from that triangle's corners): the nape's hair bends
// with the nape. Kept off the face, the ears, the neck and the shoulders, and over the skin by `show` everywhere,
// at rest and in the game's clips' poses (tools/sculpt/hairs/bob-poses-<who>.json, the same body poses the bob is kept
// clear in: clearBody).
//
//   node tools/sculpt/lowbuzz.mjs [--who male,female] [--raw]   # counts, crossings at rest and turned, the skin's
//                                                                # clearance (--raw: as laid, not cleared)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { skullOf, skinHair } from './lowhair.mjs';
import BUZZ from './hairs/buzz.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const RAD = Math.PI / 180;
/** A direction from the skull's middle: theta round from the front toward the body's left, phi up from level. */
export const dirOf = (th, ph) => [Math.sin(th * RAD) * Math.cos(ph * RAD), Math.sin(ph * RAD), Math.cos(th * RAD) * Math.cos(ph * RAD)];
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** The skull's triangles with their corners' indices (the head's skin, the ears left out). */
function skullTris(B) {
  return B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => ({ v: t.v, P: t.v.map((i) => B.verts[i]), poly: t.poly }));
}
/** Where a ray from o along unit d last crosses the triangles: { t, tri, u, v } (barycentric on the triangle), t 0 for none. */
function rayFar(T, o, d) {
  let best = { t: 0, tri: -1, u: 0, v: 0 };
  T.forEach(({ P: [a, b, c] }, i) => {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) return;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) return;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) return;
    const t = dot(e2, q) / det;
    if (t > best.t) best = { t, tri: i, u, v };
  });
  return best;
}

/** The hairline's phi at theta (the style's table for the body, mirrored; straight between its points). */
export function hemAt(table, th) {
  const a = Math.min(180, Math.abs(th));
  for (let i = 1; i < table.length; i++) if (a <= table[i][0]) { const [t0, p0] = table[i - 1], [t1, p1] = table[i]; return p0 + ((p1 - p0) * (a - t0)) / (t1 - t0); }
  return table.at(-1)[1];
}

/** A polygon split into triangles: a quad on its shorter diagonal, a larger one by ear clipping in the plane across its
 * mean direction from the skull's middle. */
function trisOf(verts, v, C) {
  if (v.length === 3) return [v];
  if (v.length === 4) { const [a, b, c, d] = v; return Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d])) ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]; }
  const m = unit(v.reduce((s, i) => add(s, sub(verts[i], C)), [0, 0, 0]));
  const ax = unit(cross(Math.abs(m[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], m)), ay = cross(m, ax);
  const P = new Map(v.map((i) => [i, [dot(sub(verts[i], C), ax), dot(sub(verts[i], C), ay)]]));
  const area = (r) => r.reduce((s, i, k) => { const a = P.get(i), b = P.get(r[(k + 1) % r.length]); return s + a[0] * b[1] - b[0] * a[1]; }, 0);
  const sgn = Math.sign(area(v)) || 1, out = [];
  const crs = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * sgn;
  const inside = (p, a, b, c) => crs(a, b, p) > 1e-12 && crs(b, c, p) > 1e-12 && crs(c, a, p) > 1e-12;
  let r = [...v], guard = 0;
  while (r.length > 3 && guard++ < 500) {
    let cut = -1;
    for (let k = 0; k < r.length && cut < 0; k++) {
      const a = P.get(r[(k + r.length - 1) % r.length]), b = P.get(r[k]), c = P.get(r[(k + 1) % r.length]);
      if (crs(a, b, c) <= 1e-12) continue;
      if (r.some((i) => ![r[(k + r.length - 1) % r.length], r[k], r[(k + 1) % r.length]].includes(i) && inside(P.get(i), a, b, c))) continue;
      cut = k;
    }
    if (cut < 0) cut = 0;
    out.push([r[(cut + r.length - 1) % r.length], r[cut], r[(cut + 1) % r.length]]);
    r.splice(cut, 1);
  }
  out.push(r);
  return out;
}

/**
 * The buzz cut on a body: { verts, polys: [{ v, piece, valley?, shaved? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid }. style: tools/sculpt/hairs/buzz.mjs. clear: kept off the body (clearBody).
 */
export function buildBuzz(rig, style = BUZZ, { clear = true } = {}) {
  const S = style, B = rig.B, { centre: C } = skullOf(B), T = skullTris(B), table = S.hem[rig.who];
  // the columns: the hairline's points round the head, the body's right mirrored, in order round from behind its right
  const half = table.map(([th]) => th);
  const cols = [...half.filter((t) => t > 0 && t < 180).map((t) => -t).reverse(), ...half].map((th) => ({ th, hem: hemAt(table, th) }));
  const n = cols.length;
  const verts = [], under = [];
  // (the skin along a ray, and its reach: the furthest along the ray any of the skull's corners within `reach` degrees
  // of it stands, so the shell's faces, chords between its corners, pass over the skull's own corners between them)
  const corners = [...new Set(T.flatMap((t) => t.v))].map((i) => sub(B.verts[i], C)), cosW = Math.cos(S.reach * RAD);
  const ray = (th, ph) => {
    const d = dirOf(th, ph), h = rayFar(T, C, d), n0 = h.tri >= 0 ? unit(cross(sub(T[h.tri].P[1], T[h.tri].P[0]), sub(T[h.tri].P[2], T[h.tri].P[0]))) : d;
    let reach = h.t;
    for (const v of corners) { const a = dot(v, d); if (a > cosW * Math.hypot(...v)) reach = Math.max(reach, a); }
    return { d, ...h, reach, cos: Math.max(0.5, Math.abs(dot(n0, d))) };
  };
  // the hair's height off the skin at a point (along the ray: the skin's facing taken out, so the height is the skin's
  // normal's), its corner `jk` jittered
  const height = (c, ph, kind, jk) => {
    const fade = ease((Math.abs(c.th) - S.taperFrom + 6) / 12);
    if (kind === 'hem') return S.edge + (S.edgeTaper - S.edge) * fade;
    const h = S.side + (S.top - S.side) * ease((ph - S.topAt[0]) / (S.topAt[1] - S.topAt[0]));
    return h * (1 + S.jitter * (2 * hash(jk[0] * 7 + 3, jk[1] * 13 + 1) - 1)) * (kind === 'taper' ? 0.85 : 1);
  };
  const V = (p, r) => { under.push(r); return verts.push(p) - 1; };
  // per column its corners top down: the level rows over its hairline (by their index in S.rows), the taper's, the hem's
  cols.forEach((c, j) => {
    // (each level row's corner moved up or down by up to `jog` degrees, its own way: the bands' edges zigzag)
    const lv = S.rows.map((ph, i) => ({ ph: ph + (i ? S.jog * (2 * hash(j * 5 + 11, i * 3 + 7) - 1) : 0), level: i })).filter((r) => r.ph > c.hem + S.taper + S.rowGap);
    c.rows = [...lv, { ph: c.hem + S.taper, kind: 'taper' }, { ph: c.hem, kind: 'hem' }];
    c.out = c.rows.map((r) => {
      const R = ray(c.th, r.ph), h = height(c, r.ph, r.kind, [j, r.level ?? (r.kind === 'taper' ? 20 : 21)]);
      return V(add(C, mul(R.d, R.reach + h / R.cos)), R);
    });
  });
  // the crown: one point over the head's top
  const top = ray(0, 90), crownO = V(add(C, mul(top.d, top.reach + S.top)), top);
  const nOut = verts.length;
  const polys = [];
  const P = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  // the crown's cap: its planes each a run of the columns' top corners (by theta, the front's plane about the middle)
  const sector = (th) => Math.floor((((th + 180 / S.crownPlanes) % 360) + 360) % 360 / (360 / S.crownPlanes));
  const first = cols.findIndex((c, j) => sector(c.th) !== sector(cols[(j + n - 1) % n].th));
  for (let s = 0, j = first; s < S.crownPlanes; s++) {
    const run = [j];
    let k = (j + 1) % n;
    while (sector(cols[k].th) === sector(cols[j].th)) { run.push(k); k = (k + 1) % n; }
    run.push(k);
    P([crownO, ...run.reverse().map((i) => cols[i].out[0])]);
    j = k;
  }
  // the bands: between each two columns, quad by quad down the rows both have; then one face from the last of those down
  // to the taper's row (the rows only one of them has); the taper's band; the rim
  const quads = [];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n, A = cols[j], Bc = cols[k];
    const la = A.rows.filter((r) => r.level !== undefined).length, lb = Bc.rows.filter((r) => r.level !== undefined).length, m = Math.min(la, lb);
    for (let i = 0; i + 1 < m; i++) quads.push({ i, j, v: [A.out[i], Bc.out[i], Bc.out[i + 1], A.out[i + 1]] });
    const ta = la, tb = lb; // the taper's corner's index in each column
    P([A.out[m - 1], Bc.out[m - 1], ...Bc.out.slice(m, tb), Bc.out[tb], A.out[ta], ...A.out.slice(m, ta).reverse()]);
    const fade = Math.abs(A.th) >= S.taperFrom && Math.abs(Bc.th) >= S.taperFrom;
    P([A.out[ta], Bc.out[tb], Bc.out[tb + 1], A.out[ta + 1]], fade ? { shaved: true } : {});
  }
  // (the bands' quads joined `group` columns at a time (per band, the crown's first), staggered band to band: one flat-lit facet each)
  const byBand = new Map();
  for (const q of quads) { if (!byBand.has(q.i)) byBand.set(q.i, []); byBand.get(q.i).push(q); }
  for (const [i, qs] of byBand) {
    qs.sort((a, b) => a.j - b.j);
    const g = S.group[Math.min(i, S.group.length - 1)], off = i % 2 ? Math.floor(g / 2) : 0;
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const tops = [run[0].v[0], ...run.map((q) => q.v[1])], bots = [run[0].v[3], ...run.map((q) => q.v[2])];
      P([...tops, ...bots.reverse()]);
      run = [];
    };
    for (const q of qs) {
      if (run.length && (q.j !== run.at(-1).j + 1 || Math.floor((q.j + off) / g) !== Math.floor((run[0].j + off) / g))) flush();
      run.push(q);
    }
    flush();
  }
  const nOuter = polys.length;
  // the inside: each outer corner's mate on the same ray, sunk into the scalp (decided once the outside is laid: the
  // skin's polygons it covers whole)
  const outTris = polys.flatMap((p) => trisOf(verts, p.v, C)).map((t) => ({ P: t.map((i) => verts[i]) }));
  const scalp = scalpOf(B, C, outTris);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const sinkable = new Set([...scalp].filter((pi) => B.polys[pi].v.every(rigid)));
  // (a corner sunk only where it and every corner it shares a face with are over such skin: the inside's faces then stay
  // under the scalp it covers whole)
  const over = (i) => under[i].tri >= 0 && sinkable.has(T[under[i].tri].poly);
  const near = Array.from({ length: nOut }, () => new Set());
  for (let pi = 0; pi < nOuter; pi++) for (const a of polys[pi].v) for (const b of polys[pi].v) near[a].add(b);
  const mate = [];
  for (let i = 0; i < nOut; i++) {
    const R = under[i], rOut = Math.hypot(...sub(verts[i], C));
    const hem = cols.some((c) => c.out.at(-1) === i);
    const r = hem || ![...near[i]].every(over) ? R.reach + S.lip : R.t - S.sink;
    mate.push(V(add(C, mul(R.d, Math.min(r, rOut - 0.004))), R));
  }
  for (let pi = 0; pi < nOuter; pi++) { const p = polys[pi]; P(p.v.map((i) => mate[i]).reverse(), { valley: S.insideShade }); }
  // the rim: the hairline's cut, the shell's thickness there
  for (let j = 0; j < n; j++) {
    const a = cols[j].out.at(-1), b = cols[(j + 1) % n].out.at(-1);
    P([a, b, mate[b], mate[a]], { valley: S.rimShade });
  }
  // the faces wound outward (built one way round; all turned over where the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  // each vertex skinned as the skin under it: the bones' weights at the triangle it is over, from its corners'
  const weights = under.map((R) => {
    if (R.tri < 0) return [['head', 1]];
    const t = T[R.tri], bc = [1 - R.u - R.v, R.u, R.v], w = {};
    t.v.forEach((vi, k) => { for (const [bn, x] of rig.weights[B.names[vi]]) w[bn] = (w[bn] ?? 0) + x * Math.max(0, bc[k]); });
    const tot = Object.values(w).reduce((a, x) => a + x, 0);
    return Object.entries(w).filter(([, x]) => x / tot > 1e-3).map(([bn, x]) => [bn, x / tot]);
  });
  const hair = { verts, polys, tris: [], weights, pieces: [{ id: 'buzz', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }], centre: C, k: 1, grid: { cols, crownO, mate, nOut, nOuter, skinR: under.map((R) => R.t), cos: under.map((R) => R.cos) } };
  retri(hair);
  hair.scalp = [...scalp];
  hair.shave = hair.scalp;
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/** The hair's triangles from its polygons (each polygon's own). */
function retri(hair) {
  hair.tris = hair.polys.flatMap((p, pi) => trisOf(hair.verts, p.v, hair.centre).map((t) => [...t, pi]));
}

/** The skin's polygons (the skull's: the ears and the face's parts left out) the shell covers whole: every corner seen
 * from the skull's middle under it. */
function scalpOf(B, C, outTris) {
  const memo = new Map();
  const covered = (vi) => { if (!memo.has(vi)) memo.set(vi, rayFar(outTris, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const out = new Set();
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every(covered)) out.add(i); });
  return out;
}

/** The body's poses the hair is kept clear in: the game's clips (tools/sculpt/lowbobanim.mjs --write), the same bodies'
 * poses whatever the hair. */
export function posesOf(who) {
  const f = join(DIR, `hairs/bob-poses-${who}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
}

/**
 * Where the skin stands within `show` of the shell's outside (or through it), at rest: points over the skull's
 * triangles under the hair (each triangle's corners, its edges' middles, its middle), each ray from the skull's middle;
 * per point the outer polygon and triangle it is under and how far short it falls.
 */
export function skinShows(rig, hair, show = BUZZ.show) {
  const B = rig.B, C = hair.centre, T = skullTris(B), { nOuter } = hair.grid;
  const outT = hair.tris.map(([a, b, c, pi], ti) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]], pi, ti })).filter((t) => t.pi < nOuter);
  const out = [];
  for (const t of T) {
    const [a, b, c] = t.P, pts = [a, b, c, mul(add(a, b), 0.5), mul(add(b, c), 0.5), mul(add(c, a), 0.5), mul(add(add(a, b), c), 1 / 3)];
    for (const p of pts) {
      const d = unit(sub(p, C)), h = rayFar(outT, C, d);
      if (!(h.t > 0)) continue;
      const rs = rayFar(T, C, d).t, gap = h.t - rs;
      if (gap < show) out.push({ pi: outT[h.tri].pi, ti: outT[h.tri].ti, gap, p });
    }
  }
  return out;
}

/**
 * The hair clear of the body: a face of it through skin that is not the scalp it covers (the face, the ears, the neck,
 * the shoulders, the skin that bends with the neck) at rest or in a pose, or with the skin within `show` of its outside
 * at rest, has its triangle's corners moved out from the skull's middle `step` at a time (where the skin shows, by most
 * of what it falls short) (an inner corner's outer mate with it, the
 * shell kept its least thickness), until none is.
 */
const CLEAR = 0.002;
function clearBody(rig, hair, S, step = 0.003) {
  const { verts } = hair, C = hair.centre, { mate } = hair.grid, outerOf = new Map(mate.map((m, i) => [m, i]));
  const states = [{ P: rig.B.verts, f: null }, ...posesOf(rig.who).map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f }; })];
  // (the scalp's edge, the skull's skin the hair covers in part, left out: the inside's chords under its facets are
  // under the outside too, which `show` keeps over it)
  // (at rest the hair drawn in `CLEAR` toward the skull's middle: a face that only touches the face's or the ears' skin
  // at rest would cross it in a pose by the rounding alone)
  const shrunk = () => verts.map((p) => { const d = sub(p, C), l = Math.hypot(...d); return add(C, mul(d, (l - CLEAR) / l)); });
  const hitsIn = (st) => fastCrossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : shrunk()).filter(([, sp]) => whereOf(rig, C, sp) !== 'edge');
  // (each round checks the states that had crossings the round before; when those are clear, all of them again)
  let it = 0, live = states.map((_, i) => i);
  for (; it < 80; it++) {
    let per = live.map((i) => [i, hitsIn(states[i])]).filter(([, h]) => h.length);
    const sh = skinShows(rig, hair, S.show), shows = sh.map((x) => x.ti);
    if (!per.length && !shows.length && live.length < states.length) { live = states.map((_, i) => i); per = live.map((i) => [i, hitsIn(states[i])]).filter(([, h]) => h.length); }
    if (!per.length && !shows.length) break;
    live = [0, ...per.map(([i]) => i).filter((i) => i)];
    // (each corner by `step`, or where the skin stands through the outside, by what that falls short of `show`)
    const hits = per.flatMap(([, h]) => h.map(([, , ti]) => ti)), by = new Map();
    for (const ti of hits) for (const v of hair.tris[ti].slice(0, 3)) by.set(v, Math.max(by.get(v) ?? 0, step));
    for (const x of sh) for (const v of hair.tris[x.ti].slice(0, 3)) by.set(v, Math.max(by.get(v) ?? 0, step, 0.7 * (S.show - x.gap)));
    for (const [v, amt] of by) {
      const d = unit(sub(verts[v], C));
      verts[v] = add(verts[v], mul(d, amt));
      // (an inner corner pushes its outer mate on, the shell its least thickness; an outer corner the inner under it
      // stays)
      const o = outerOf.get(v);
      if (o !== undefined && Math.hypot(...sub(verts[o], C)) - Math.hypot(...sub(verts[v], C)) < 0.004) verts[o] = add(verts[o], mul(unit(sub(verts[o], C)), amt));
    }
    retri(hair);
  }
  hair.clearRounds = it;
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.shows = skinShows(rig, hair, S.show).length;
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
/**
 * tools/sculpt/lowhair.mjs crossings (the hair's triangles through the skin of the head, the neck and the torso, the
 * scalp it covers where rigid on the head left out), the skin's triangles binned in a grid first: [[hair polygon, skin
 * polygon, hair triangle], ...], one per hair triangle.
 */
const SKIN_T = new WeakMap();
export function fastCrossings(rig, hair, P, H) {
  const B = rig.B, scalp = new Set(hair.scalp ?? hair.shave);
  if (!SKIN_T.has(hair)) {
    const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
    SKIN_T.set(hair, B.tris.filter((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso'].includes(p.part) && !(scalp.has(t.poly) && t.v.every(rigid)); }));
  }
  const skinT = SKIN_T.get(hair), cell = 0.12, key = (x, y, z) => `${x},${y},${z}`, grid = new Map();
  const bb = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const hb = bb(H);
  skinT.forEach((t, s) => {
    const b = bb(t.v.map((i) => P[i]));
    if (b.some(([lo, hi], k) => hi < hb[k][0] || lo > hb[k][1])) return;
    for (let x = Math.floor(b[0][0] / cell); x <= Math.floor(b[0][1] / cell); x++) for (let y = Math.floor(b[1][0] / cell); y <= Math.floor(b[1][1] / cell); y++) for (let z = Math.floor(b[2][0] / cell); z <= Math.floor(b[2][1] / cell); z++) {
      const kk = key(x, y, z); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(s);
    }
  });
  const hits = [];
  for (const [ti, [a, b, c, pi]] of hair.tris.entries()) {
    const A = [H[a], H[b], H[c]], ab = bb(A), seen = new Set();
    let hit = -1;
    for (let x = Math.floor(ab[0][0] / cell); x <= Math.floor(ab[0][1] / cell) && hit < 0; x++) for (let y = Math.floor(ab[1][0] / cell); y <= Math.floor(ab[1][1] / cell) && hit < 0; y++) for (let z = Math.floor(ab[2][0] / cell); z <= Math.floor(ab[2][1] / cell) && hit < 0; z++) {
      for (const s of grid.get(key(x, y, z)) ?? []) {
        if (seen.has(s)) continue; seen.add(s);
        if (triTri(A, skinT[s].v.map((i) => P[i]))) { hit = s; break; }
      }
    }
    if (hit >= 0) hits.push([pi, skinT[hit].poly, ti]);
  }
  return hits;
}

/** The buzz cut on a body as the game takes it. */
export const buzzOf = (rig, style = BUZZ) => buildBuzz(rig, style);

/** Each piece closed: every edge in two of its faces, the two running it opposite ways. */
export function openEdges(hair) {
  const E = new Map();
  for (const p of hair.polys) p.v.forEach((a, j) => { const b = p.v[(j + 1) % p.v.length], key = a + ',' + b; E.set(key, (E.get(key) ?? 0) + 1); });
  let open = 0;
  for (const [key, c] of E) { const [a, b] = key.split(','); if (c !== 1 || E.get(b + ',' + a) !== 1) open++; }
  return open;
}

/** The head turned and nodded (tools/sculpt/lowbob.mjs's poses). */
export const POSES = { 'turn left': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, 'turn right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] }, nod: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, 'look up': { neck_01: [-10, 0, 0], neck_02: [-12, 0, 0], head: [-14, 0, 0] } };

/** Where a skin polygon is (tools/sculpt/lowbob.mjs crossReport's split): the face (in front of the ears, below the
 * brows), the ears, the neck, the torso, else the scalp's edge. */
export function whereOf(rig, C, sp) {
  const B = rig.B, poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
  return poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear ? 'ear' : c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25 ? 'face' : 'edge';
}
/** The hair's crossings through the body, by where: the face, the ears, the neck, the torso, the scalp's edge. */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const out = { face: 0, ear: 0, neck: 0, torso: 0, edge: 0 };
  for (const [, sp] of fastCrossings(rig, hair, P, Hv)) out[whereOf(rig, hair.centre, sp)]++;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k, f) => { const i = args.indexOf(`--${k}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildBuzz(rig, BUZZ, { clear: !args.includes('--raw') });
    const shaved = hair.polys.filter((p) => p.shaved).length, valleys = hair.polys.filter((p) => p.valley).length;
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, `(outside ${hair.grid.nOuter} polys, ${shaved} in the shaved tone, ${valleys} in valleys)`, 'columns', hair.grid.cols.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'ms', Date.now() - t0);
    if (hair.clearedIn) console.log(who, 'cleared in', hair.clearRounds, 'rounds; crossings left at rest and in the', hair.clearedIn.length - 1, 'clip poses:', hair.clearedIn.reduce((a, x) => a + x, 0), '; skin within show of the outside:', hair.shows);
    console.log(who, 'at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([k, pose]) => { const f = posed(rig, pose); return `${k} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
    const th = hair.verts.slice(0, hair.grid.nOut).map((p, i) => Math.hypot(...sub(p, hair.centre)) - Math.hypot(...sub(hair.verts[hair.grid.mate[i]], hair.centre)));
    const up = hair.verts.slice(0, hair.grid.nOut).map((p, i) => (Math.hypot(...sub(p, hair.centre)) - hair.grid.skinR[i]) * hair.grid.cos[i]);
    console.log(who, 'shell thickness (outside to inside along the ray) min', Math.min(...th).toFixed(3), 'max', Math.max(...th).toFixed(3), '; the outside over the skin under it (along the skin\'s normal): mean', (up.reduce((a, x) => a + x, 0) / up.length).toFixed(3), 'max', Math.max(...up).toFixed(3));
  }
}
