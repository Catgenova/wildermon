// The side braid's joins measured, not eyeballed: for each pair of pieces that should run into each other (the crown
// links, the hanging hearts, the tie, the tip, in order; and the first link against the crown's clumps), the least
// distance between their surfaces (head units, and as a share of the smaller piece's width). A join that touches or
// overlaps reads 0; anything over `--max` (default 0.01, touching within rounding) fails the run.
//
//   node tools/sculpt/lowbraidgaps.mjs [--who female,male] [--max 0.01]
import { buildRig, sub, dot, cross, add, mul } from './lowrig.mjs';
import BRAID from './hairs/braid.mjs';
import { carve, buildBraid } from './lowbraid.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const whos = opt('who', 'female,male').split(','), MAX = +opt('max', 0.01);

/** The closest point on triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5). */
function closest(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, mul(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const den = 1 / (va + vb + vc);
  return add(a, add(mul(ab, vb * den), mul(ac, vc * den)));
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
/** Points sampled over triangles (corners, edge midpoints, centre). */
const samples = (T) => T.flatMap(([a, b, c]) => [a, b, c, mul(add(a, b), 0.5), mul(add(b, c), 0.5), mul(add(a, c), 0.5), mul(add(add(a, b), c), 1 / 3)]);
/** Least distance between two triangle sets (sampled points of each against the other's triangles, both ways). */
function gap(A, B) {
  let best = Infinity;
  for (const [S, T] of [[samples(A), B], [samples(B), A]]) for (const p of S) for (const [a, b, c] of T) { const d = dist(p, closest(p, a, b, c)); if (d < best) best = d; if (best === 0) return 0; }
  return best;
}
const width = (T) => { const P = T.flat(), lo = [0, 1, 2].map((i) => Math.min(...P.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...P.map((p) => p[i]))); return Math.min(...[0, 1, 2].map((i) => hi[i] - lo[i]).sort((x, y) => y - x).slice(0, 2)); };

let bad = 0;
const H = carve();
for (const who of whos) {
  const rig = who === 'female' ? H.rig : buildRig(who), hair = buildBraid(rig, BRAID, H);
  const trisOf = (pi) => hair.tris.filter((t) => t[3] !== undefined ? hair.polys[t[3]].piece === pi : false).map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]);
  const chain = hair.pieces.map((p, i) => ({ ...p, i })).filter((p) => p.kind === 'braid' || p.kind === 'tie');
  const clumps = hair.pieces.map((p, i) => ({ ...p, i })).filter((p) => p.kind === 'clump').flatMap((p) => trisOf(p.i));
  const rows = [];
  if (chain.length) rows.push(['crown', chain[0].id, gap(clumps, trisOf(chain[0].i)), width(trisOf(chain[0].i))]);
  for (let j = 0; j + 1 < chain.length; j++) { const A = trisOf(chain[j].i), B = trisOf(chain[j + 1].i); rows.push([chain[j].id, chain[j + 1].id, gap(A, B), Math.min(width(A), width(B))]); }
  for (const [a, b, g, w] of rows) {
    const fail = g > MAX;
    if (fail) bad++;
    console.log(`${who} ${a} -> ${b}: gap ${g.toFixed(3)} (${(100 * g / w).toFixed(0)}% of width)${fail ? '  DISCONNECTED' : ''}`);
  }
}
console.log(bad ? `${bad} joins open` : 'every join touches');
process.exitCode = bad ? 1 : 0;
