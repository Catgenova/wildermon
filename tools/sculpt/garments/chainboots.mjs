// The chain set's boots: mail chausses' feet, from the middle of the calf down over the foot, on a thick leather sole
// with a welt round it; a turned-down leather cuff at the top with a rune line round it, a leather strap round the ankle
// with a gold buckle and its gem (glowing when enchanted) on the outside, and a leather strap over the instep. The body
// stands on their soles (`soles`); the body's polygons they cover whole are hidden (`hides`). Worn with the chain
// leggings, the leggings' mail below the boots' top is left out (their `dropFrom`).
//
//   buildChainBoots(rig, design?) → the mesh (chainmail.mjs chainMesh, its `hides`, `soles`)
//
//   node tools/sculpt/garments/chainboots.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowchainboots-male.json and -female.json
//
// The mail: the body's own triangles over the calf and the foot (chainmail.mjs mailShell), in courses on the set's grid,
// its links round each leg's axis. The sole: the foot's downward-facing triangles let straight down by its thickness,
// its edge stood out horizontally into a welt and closed back in to the mail's edge. The straps and the cuff: bands of the
// body's triangles across a field (the height, or the way along the foot from the heel to the toe), out over the mail.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { add, mul, unit } from '../lowgarment.mjs';
import { chainMesh, mailShell, coveredPolys, stud, writePiece, linksOf, axisThrough, legBones, facing, normalsOf } from './chainmail.mjs';
import { COURSE, DESIGN as CHEST, skinAt } from './chainchest.mjs';
import { DESIGN as LEGS } from './chainlegs.mjs';

/**
 * Per body: the mail's offset; the sole's thickness and its welt's reach; the cuff's span about the boots' top (as the
 * leggings' design places it), the ankle strap's height over the ankle's joint and its width, the instep strap's place
 * along the foot (a share of the way from the ankle to the toe) and its width; the straps' offset over the mail; the
 * links' radius round the leg.
 */
export const DESIGN = {
  male: { c: 0.06, sole: 0.2, welt: 0.07, cuff: [-0.06, 0.26], ankle: { y: 0.32, w: 0.2 }, instep: { at: 0.5, w: 0.22 }, strap: 0.05, links: { rL: 0.5 } },
  female: { c: 0.055, sole: 0.18, welt: 0.06, cuff: [-0.05, 0.24], ankle: { y: 0.3, w: 0.18 }, instep: { at: 0.5, w: 0.2 }, strap: 0.045, links: { rL: 0.44 } },
};

export function buildChainBoots(rig, D = DESIGN[rig.who]) {
  const { B, J } = rig, C = COURSE[rig.who], L = CHEST[rig.who].links, G = chainMesh(), N = normalsOf(B);
  const top = J.knee[1] + (J.ankle[1] - J.knee[1]) * LEGS[rig.who].boots;
  const isLeg = (t) => t.v.every((i) => B.part[i] === 'legs');
  // (the sole: the foot's triangles facing down)
  const down = (t) => { const [a, b, c] = t.v.map((i) => B.verts[i]), n = unit([0, 1, 2].map((k) => (b[(k + 1) % 3] - a[(k + 1) % 3]) * (c[(k + 2) % 3] - a[(k + 2) % 3]) - (b[(k + 2) % 3] - a[(k + 2) % 3]) * (c[(k + 1) % 3] - a[(k + 1) % 3]))); return n[1] < -0.6 || t.v.every((i) => N[i][1] < -0.6); };
  const sole = (t) => isLeg(t) && t.region === 'foot' && down(t);
  const sock = (t) => isLeg(t) && !sole(t);
  const legAxis = (s) => axisThrough([s * J.knee[0], J.knee[1], J.knee[2]], [s * J.ankle[0], J.ankle[1], J.ankle[2]]);
  const links = linksOf(rig, { z0: J.pelvis[2], rT: L.rT, w: L.w, edge: L.edge, centre: L.centre, limbs: [1, -1].map((s) => [s, legBones(s > 0 ? 'l' : 'r'), legAxis(s), D.links.rL]) });
  // the mail
  mailShell(G, rig, {
    tag: 'boot mail', ...C, links, keep: sock, hi: () => top, c: () => D.c,
    mat: (f, up) => (up ? 'plate' : 'shade'),
  });
  // the sole: let down, its edge stood out into the welt and back in under the mail's edge
  const heelToe = (s) => [[s * J.ankle[0], J.ankle[2] - 0.25], [s * J.toe[0], J.toe[2]]];
  const outOf = (p) => {
    const [a, b] = heelToe(Math.sign(p[0]) || 1), d = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[2] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1])));
    const v = [p[0] - (a[0] + d[0] * t), 0, p[2] - (a[1] + d[1] * t)];
    return unit(Math.hypot(v[0], v[2]) < 1e-6 ? [0, 0, 1] : v);
  };
  const soles = [];
  const soleShell = mailShell(G, rig, {
    tag: 'sole', h: 100, d: 0, crest: 0.5, foot: 1, keep: sole, c: () => D.sole, normal: () => [0, -1, 0], mat: () => 'leather',
    edges: (a, b, va, vb) => {
      const welt = (q) => G.add(add(add(q.p, mul(outOf(q.p), D.welt + D.c)), [0, -D.sole * 0.35, 0]), q.w, 'sole');
      const lip = (q) => G.add(add(q.p, mul(outOf(q.p), D.c * 0.4)), q.w, 'sole');
      const wa = welt(a), wb = welt(b), la = lip(a), lb = lip(b), o = outOf(mul(add(a.p, b.p), 0.5));
      G.polys.push({ v: facing(G, [va, vb, wb, wa], add(o, [0, -0.5, 0])), mat: 'leather', part: 'sole', tag: 'sole' });
      G.polys.push({ v: facing(G, [wa, wb, lb, la], add(o, [0, 1.5, 0])), mat: 'leather', part: 'sole', tag: 'sole' });
    },
  });
  for (const v of soleShell.verts) soles.push(v);
  // the cuff at the top, its rune line; the ankle strap; the instep strap
  const over = D.c + C.d + D.strap;
  const strap = (tag, keep, field, lo, hi, c, mat) => mailShell(G, rig, { tag, h: 100, d: 0, crest: 0.5, foot: 1, keep, field, lo: () => lo, hi: () => hi, c: () => c, mat: () => mat, lipMat: 'leather' });
  strap('cuff', sock, undefined, top + D.cuff[0], top + D.cuff[1], over, 'leather');
  strap('cuff rune', sock, undefined, top + (D.cuff[0] + D.cuff[1]) / 2 - 0.025, top + (D.cuff[0] + D.cuff[1]) / 2 + 0.025, over + 0.012, 'rune');
  strap('cuff trim', sock, undefined, top + D.cuff[0] - 0.035, top + D.cuff[0] + 0.03, over + 0.008, 'gold');
  const ay = J.ankle[1] + D.ankle.y;
  strap('ankle strap', sock, undefined, ay - D.ankle.w / 2, ay + D.ankle.w / 2, over, 'leather');
  // (the instep: along the foot from the ankle toward the toe; only the foot's own triangles, the sole left out)
  const along = (p) => { const s = Math.sign(p[0]) || 1, a = [s * J.ankle[0], J.ankle[2]], b = [s * J.toe[0], J.toe[2]], d = [b[0] - a[0], b[1] - a[1]]; return ((p[0] - a[0]) * d[0] + (p[2] - a[1]) * d[1]) / Math.hypot(d[0], d[1]); };
  const footLen = Math.hypot(J.toe[0] - J.ankle[0], J.toe[2] - J.ankle[2]), ia = D.instep.at * footLen;
  strap('instep strap', (t) => sock(t) && t.region === 'foot', along, ia - D.instep.w / 2, ia + D.instep.w / 2, over, 'leather');
  // the ankle strap's buckles, on the outside
  for (const s of [1, -1]) {
    const [x, z] = legAxis(s)(ay), p = B.verts.reduce((best, q, i) => (B.part[i] === 'legs' && Math.abs(q[1] - ay) < 0.2 && q[0] * s > 0 && (!best || q[0] * s > best[0] * s) ? q : best), null);
    const n = unit([p[0] - x, 0, p[2] - z]);
    stud(G, add(p, mul(n, over + 0.015)), n, [0, 0, 1], { a: 0.09, b: 0.12, h: 0.035, inset: 0.55, w: skinAt(rig, p, ['legs']), tag: 'ankle buckle' });
  }
  G.soles = soles;
  // (a body vertex under the boot: every triangle round it the mail's or the sole's, below the top)
  const round = new Map();
  B.tris.forEach((t) => t.v.forEach((i) => (round.get(i) ?? round.set(i, []).get(i)).push(t)));
  G.hides = coveredPolys(rig, (i) => B.verts[i][1] < top - 0.02 && (round.get(i) ?? []).every((t) => sock(t) || sole(t)));
  return G;
}

if (import.meta.url === `file://${process.argv[1]}`) await writePiece('chainboots', buildChainBoots, 'chainboots.mjs');
