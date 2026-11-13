// A ring of hair round the head under a bare crown, for the low-poly bodies: balding (tools/sculpt/hairs/balding.mjs,
// the game's 'balding') and the monk cut (tools/sculpt/hairs/monk.mjs, 'monk'). No reference sheet: one thin closed
// shell laid over each body's own skull (tools/sculpt/lowhair.mjs skullOf), as the buzz cut's (tools/sculpt/lowbuzz.mjs)
// but open over the crown, from the skull's middle per direction (theta round from the front toward the body's left,
// phi up):
//
//   columns  one per point of the style's two tables (its `hem`, the hairline, and its `crown`, the upper edge, where the
//            hair gives out or is shaved off), mirrored for the body's right, and between them at most `step` apart;
//            all the way round (`from` 0) or from `from` each side round the back (a horseshoe, its two ends closed);
//            each column's upper edge moved up or down by up to `crownJog` (an uneven edge, not a cut);
//   rows     the same share of each column's height from the upper edge down to the hairline (`rows`), the hair's
//            height off the skin at each (`height`), moved a little each its own way (`jitter`), eased down to the
//            edge's toward a horseshoe's ends (`endFade`); the bands' quads joined a few columns at a time into one
//            flat-lit facet each, staggered band to band; the bands in `thin` (the hair thinning under the upper edge)
//            and the last on the sides and the back (the trim) in the shaved scalp's tone;
//   inside   sunk into the scalp where the skin under it is covered whole and moves with the head, else just off the
//            skin; the rims between them (the hairline, the upper edge, a horseshoe's ends) in a valley's shade;
//   wisps    a few thin flat strands lying over the bare top (`wisps`), each its own closed piece, on the head bone.
//
// Each vertex of the ring skinned as the skin under it is; kept off the face, the ears, the neck and the shoulders and
// over the skin by `show` at rest and in the game's clips' poses (tools/sculpt/lowbuzz.mjs clearBody: the bob's poses, or
// the style's `poses`, tools/sculpt/hairs/<poses>-poses-<who>.json: every clip's at 8 times).
//
//   node tools/sculpt/lowring.mjs [--style balding,monk] [--who male,female] [--raw]   # counts, crossings at rest and
//                                                                                        # turned, the skin's clearance
import { readFileSync } from 'node:fs';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { skullOf, skinHair } from './lowhair.mjs';
import { dirOf, hemAt, skullTris, rayFar, trisOf, retri, scalpOf, clearBody, openEdges, crossReport, POSES } from './lowbuzz.mjs';
import BALDING from './hairs/balding.mjs';
import MONK from './hairs/monk.mjs';

export const RING_STYLES = { balding: BALDING, monk: MONK };
const RAD = Math.PI / 180;
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/**
 * The ring on a body: { verts, polys: [{ v, piece, valley?, shaved? }], tris, weights, pieces, shave, scalp, centre, k,
 * grid }. style: tools/sculpt/hairs/balding.mjs or monk.mjs. clear: kept off the body (tools/sculpt/lowbuzz.mjs clearBody).
 */
export function buildRing(rig, S, { clear = true } = {}) {
  const B = rig.B, { centre: C } = skullOf(B), T = skullTris(B), hemT = S.hem[rig.who], topT = S.crown[rig.who], from = S.from;
  // the columns' thetas on the body's left: the tables' points, `from`, and between them at most `step` apart
  const pts = [...new Set([from, 180, ...hemT.map(([t]) => t), ...topT.map(([t]) => t)])].filter((t) => t >= from && t <= 180).sort((a, b) => a - b);
  const half = [];
  pts.forEach((t, i) => {
    if (i) { const t0 = pts[i - 1], k = Math.ceil((t - t0) / S.step); for (let s = 1; s < k; s++) half.push(t0 + ((t - t0) * s) / k); }
    if (!half.length || t - half.at(-1) > 1.5) half.push(t);
  });
  const closed = from === 0;
  const ths = closed ? [...half.filter((t) => t > 0 && t < 180).map((t) => -t).reverse(), ...half] : [...half, ...half.filter((t) => t < 180).reverse().map((t) => -t)];
  const n = ths.length, m = S.rows.length;
  const corners = [...new Set(T.flatMap((t) => t.v))].map((i) => sub(B.verts[i], C)), cosW = Math.cos(S.reach * RAD);
  const ray = (th, ph) => {
    const d = dirOf(th, ph), h = rayFar(T, C, d), n0 = h.tri >= 0 ? unit(cross(sub(T[h.tri].P[1], T[h.tri].P[0]), sub(T[h.tri].P[2], T[h.tri].P[0]))) : d;
    let reach = h.t;
    if (S.reach > 0) for (const v of corners) { const a = dot(v, d); if (a > cosW * Math.hypot(...v)) reach = Math.max(reach, a); }
    return { d, ...h, reach, cos: Math.max(0.5, Math.abs(dot(n0, d))) };
  };
  const verts = [], under = [];
  const V = (p, r) => { under.push(r); return verts.push(p) - 1; };
  const cols = ths.map((th, j) => {
    const hem = hemAt(hemT, th);
    const top = Math.max(hem + 3, hemAt(topT, th) + (S.crownJog ? S.crownJog * (2 * hash(j * 7 + 2, 5) - 1) : 0));
    // (toward a horseshoe's ends the heights eased down to the edge's)
    const fade = closed || !S.endFade ? 1 : ease((Math.abs(th) - from) / S.endFade);
    const out = S.rows.map((s, i) => {
      const ph = top + (hem - top) * s, R = ray(th, ph);
      const h0 = S.height[0] + (S.height[i] - S.height[0]) * fade;
      const edge = i === 0 || i === m - 1;
      const h = h0 * (1 + (edge ? 0.5 : 1) * S.jitter * (2 * hash(j * 13 + 3, i * 17 + 1) - 1));
      return V(add(C, mul(R.d, R.reach + h / R.cos)), R);
    });
    return { th, hem, top, out };
  });
  const nOut = verts.length, polys = [];
  const P = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  // the bands: per band and pair of columns a quad, joined `group` columns at a time (staggered band to band), a run
  // broken where the shaded tone changes
  const bands = closed ? n : n - 1;
  for (let i = 0; i + 1 < m; i++) {
    const g = S.group[Math.min(i, S.group.length - 1)], off = i % 2 ? Math.floor(g / 2) : 0;
    const shadedAt = (j) => S.thin.includes(i) || (i === m - 2 && Math.abs(cols[j].th) >= S.taperFrom && Math.abs(cols[(j + 1) % n].th) >= S.taperFrom);
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const tops = [cols[run[0]].out[i], ...run.map((j) => cols[(j + 1) % n].out[i])], bots = [cols[run[0]].out[i + 1], ...run.map((j) => cols[(j + 1) % n].out[i + 1])];
      P([...tops, ...bots.reverse()], shadedAt(run[0]) ? { shaved: true } : {});
      run = [];
    };
    for (let j = 0; j < bands; j++) {
      if (run.length && (Math.floor((j + off) / g) !== Math.floor((run[0] + off) / g) || shadedAt(j) !== shadedAt(run[0]))) flush();
      run.push(j);
    }
    flush();
  }
  const nOuter = polys.length;
  // the inside: each outer corner's mate on the same ray, sunk into the scalp where it and every corner it shares a
  // face with are over skin the shell covers whole and that moves with the head only, else `lip` off the skin
  const outTris = polys.flatMap((p) => trisOf(verts, p.v, C)).map((t) => ({ P: t.map((i) => verts[i]) }));
  const scalp = scalpOf(B, C, outTris);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const sinkable = new Set([...scalp].filter((pi) => B.polys[pi].v.every(rigid)));
  const over = (i) => under[i].tri >= 0 && sinkable.has(T[under[i].tri].poly);
  const near = Array.from({ length: nOut }, () => new Set());
  for (let pi = 0; pi < nOuter; pi++) for (const a of polys[pi].v) for (const b of polys[pi].v) near[a].add(b);
  const edge = new Set(cols.flatMap((c, j) => (!closed && (j === 0 || j === n - 1) ? c.out : [c.out[0], c.out[m - 1]])));
  const mate = [];
  for (let i = 0; i < nOut; i++) {
    const R = under[i], rOut = Math.hypot(...sub(verts[i], C));
    const r = edge.has(i) || ![...near[i]].every(over) ? R.reach + S.lip : R.t - S.sink;
    mate.push(V(add(C, mul(R.d, Math.min(r, rOut - 0.004))), R));
  }
  for (let pi = 0; pi < nOuter; pi++) { const p = polys[pi]; P(p.v.map((i) => mate[i]).reverse(), { valley: S.insideShade }); }
  // the rims: the hairline's cut, the upper edge's, and a horseshoe's two ends
  for (let j = 0; j < bands; j++) {
    const A = cols[j], Bc = cols[(j + 1) % n], a = A.out[m - 1], b = Bc.out[m - 1], a0 = A.out[0], b0 = Bc.out[0];
    P([a, b, mate[b], mate[a]], { valley: S.rimShade });
    P([b0, a0, mate[a0], mate[b0]], { valley: S.topShade });
  }
  if (!closed) {
    const A = cols[0].out, Z = cols[n - 1].out;
    for (let i = 0; i + 1 < m; i++) {
      P([A[i], A[i + 1], mate[A[i + 1]], mate[A[i]]], { valley: S.topShade });
      P([Z[i + 1], Z[i], mate[Z[i]], mate[Z[i + 1]]], { valley: S.topShade });
    }
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
  const hair = { verts, polys, tris: [], weights, pieces: [{ id: 'ring', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }], centre: C, k: 1, grid: { cols, mate, nOut, nOuter, skinR: under.map((R) => R.t), cos: under.map((R) => R.cos) } };
  retri(hair);
  hair.scalp = [...scalp];
  hair.shave = hair.scalp;
  if (clear) clearBody(rig, hair, S, undefined, S.poses ? JSON.parse(readFileSync(new URL(`./hairs/${S.poses}-poses-${rig.who}.json`, import.meta.url), 'utf8')) : undefined);
  addWisps(rig, hair, S, T, ray);
  return hair;
}

/**
 * The wisps over the bare top: each a flat strand along its path ([theta, phi] points from the root), `wispWidth` wide
 * (narrowing to a third at its tip), its top `wispHeight` off the skin and `wispThick` thick; four corners a point
 * (its top's two edges, its underside's), closed at both ends. On the head bone (the top of the skull moves with it).
 */
function addWisps(rig, hair, S, T, ray) {
  const paths = S.wisps?.[rig.who] ?? [];
  const C = hair.centre, { verts, polys, weights } = hair;
  for (const path of paths) {
    const v0 = verts.length, p0 = polys.length, k = path.length;
    const at = path.map(([th, ph]) => { const R = ray(th, ph); return { R, p: add(C, mul(R.d, R.t)) }; });
    at.forEach(({ R }, i) => {
      const fw = at[Math.min(k - 1, i + 1)].p, bw = at[Math.max(0, i - 1)].p, along = unit(sub(fw, bw)), up = R.d;
      const side = unit(cross(along, up)), w = (S.wispWidth / 2) * (1 - (2 / 3) * (i / (k - 1)));
      const top = R.t + S.wispHeight / R.cos, bot = R.t + Math.max(S.show * 1.2, S.wispHeight - S.wispThick) / R.cos;
      for (const [s, r] of [[-1, top], [1, top], [1, bot], [-1, bot]]) { verts.push(add(add(C, mul(R.d, r)), mul(side, s * w))); weights.push([['head', 1]]); }
    });
    const c = (i, q) => v0 + i * 4 + q;
    for (let i = 0; i + 1 < k; i++) {
      polys.push({ v: [c(i, 0), c(i, 1), c(i + 1, 1), c(i + 1, 0)], piece: 0 });
      polys.push({ v: [c(i, 1), c(i, 2), c(i + 1, 2), c(i + 1, 1)], piece: 0 });
      polys.push({ v: [c(i, 2), c(i, 3), c(i + 1, 3), c(i + 1, 2)], piece: 0, valley: S.insideShade });
      polys.push({ v: [c(i, 3), c(i, 0), c(i + 1, 0), c(i + 1, 3)], piece: 0 });
    }
    polys.push({ v: [c(0, 3), c(0, 2), c(0, 1), c(0, 0)], piece: 0, valley: S.insideShade });
    polys.push({ v: [c(k - 1, 0), c(k - 1, 1), c(k - 1, 2), c(k - 1, 3)], piece: 0 });
    // (wound outward: turned over where this strand's volume comes out negative)
    let vol = 0;
    for (const p of polys.slice(p0)) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
    if (vol < 0) for (const p of polys.slice(p0)) p.v.reverse();
    hair.pieces.push({ id: `wisp${hair.pieces.length}`, kind: 'strand', polys: [p0, polys.length], verts: [v0, verts.length] });
  }
  retri(hair);
  void T;
}

/** Balding on a body as the game takes it. */
export const baldingOf = (rig, style = BALDING) => buildRing(rig, style);
/** The monk cut on a body as the game takes it. */
export const monkOf = (rig, style = MONK) => buildRing(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k, f) => { const i = args.indexOf(`--${k}`); return i < 0 ? f : args[i + 1]; };
  for (const id of opt('style', 'balding,monk').split(',')) for (const who of opt('who', 'male,female').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildRing(rig, RING_STYLES[id], { clear: !args.includes('--raw') });
    const shaved = hair.polys.filter((p) => p.shaved).length, valleys = hair.polys.filter((p) => p.valley).length;
    console.log(id, who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, `(outside ${hair.grid.nOuter} polys, ${shaved} in the shaved tone, ${valleys} in valleys)`, 'columns', hair.grid.cols.length, 'pieces', hair.pieces.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'ms', Date.now() - t0);
    if (hair.clearedIn) console.log(id, who, 'cleared in', hair.clearRounds, 'rounds; crossings left at rest and in the', hair.clearedIn.length - 1, 'clip poses:', hair.clearedIn.reduce((a, x) => a + x, 0), '; skin within show of the outside:', hair.shows);
    console.log(id, who, 'at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(id, who, 'posed', Object.entries(POSES).map(([k, pose]) => { const f = posed(rig, pose); return `${k} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
