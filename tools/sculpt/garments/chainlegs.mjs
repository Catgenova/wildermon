// The chain set's leggings: mail chausses over the padded hose, from the hips (under whatever is worn at the waist) down
// to the ankle; the hose's padded waistband above the mail, a brass ring row at the mail's top and at the ankle, and a
// leather garter under each knee with a gold buckle and its gem (glowing when enchanted) and a rune line round it. The
// body's polygons the mail covers whole are hidden (`hides`). From `dropFrom` on, the mail below the boots' top: left
// out under the chain set's boots, which take its place there.
//
//   buildChainLegs(rig, design?) → the mesh (chainmail.mjs chainMesh, its `hides`, `dropFrom`)
//
//   node tools/sculpt/garments/chainlegs.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowchainlegs-male.json and -female.json
//
// The mail: the body's own triangles over the hips and the legs (chainmail.mjs mailShell), in courses on the set's grid,
// its links round each leg's axis (round the trunk's at the hips, blended by the legs' weights).
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { add, mul } from '../lowgarment.mjs';
import { bodySamples } from './platechest.mjs';
import { hemRow, chainMesh, mailShell, coveredPolys, band, stud, writePiece, linksOf, axisThrough, legBones, ringAt } from './chainmail.mjs';
import { COURSE, DESIGN as CHEST, skinAt } from './chainchest.mjs';

/**
 * Per body: the mail's offset; its top (under the hauberk's mail and the tunic), the hose's waistband over it; the mail's
 * foot above the ankle; the garter (its height below the knee, its width, its clearance over the mail); where the boots'
 * top sits (as a share of the way from the knee down to the ankle, chainboots.mjs) and how far above it the mail they
 * replace begins; the links' radius round a leg.
 */
export const DESIGN = {
  male: { c: 0.05, top: -4.45, band: [-4.55, -4.0], foot: 0.3, garter: { y: -0.75, w: 0.24, c: 0.04 }, boots: 0.42, under: 0.2, links: { rL: 0.62 } },
  female: { c: 0.045, top: -3.9, band: [-4.0, -3.55], foot: 0.28, garter: { y: -0.7, w: 0.22, c: 0.035 }, boots: 0.42, under: 0.2, links: { rL: 0.55 } },
};

export function buildChainLegs(rig, D = DESIGN[rig.who]) {
  const { B, J } = rig, C = COURSE[rig.who], L = CHEST[rig.who].links, G = chainMesh();
  const parts = (t) => t.v.map((i) => B.part[i]);
  const LEG = new Set(['torso', 'pelvis', 'legs']);
  const keep = (t) => parts(t).every((p) => LEG.has(p)) && t.region !== 'foot';
  const footY = J.ankle[1] + D.foot, bootTop = J.knee[1] + (J.ankle[1] - J.knee[1]) * D.boots;
  const legAxis = (s) => axisThrough([s * J.hip[0], J.hip[1], J.hip[2]], [s * J.ankle[0], J.ankle[1], J.ankle[2]]);
  const links = linksOf(rig, { z0: J.pelvis[2], rT: L.rT, w: L.w, edge: L.edge, centre: L.centre, limbs: [1, -1].map((s) => [s, legBones(s > 0 ? 'l' : 'r'), legAxis(s), D.links.rL]) });
  const shell = (lo, hi, tag) => mailShell(G, rig, {
    tag, ...C, links, keep, lo: () => lo, hi: () => hi, c: () => D.c,
    mat: (f, up, t, k) => hemRow(C.h, { lo: footY, hi: D.top })(k, up) ?? (up ? 'plate' : 'shade'),
  });
  // the hose's waistband (padded), under the mail's top
  mailShell(G, rig, { tag: 'hose', h: 100, d: 0, crest: 0.5, foot: 1, keep, lo: () => D.band[0], hi: () => D.band[1], c: () => D.c * 0.5, mat: () => 'under', lipMat: 'under' });
  // the mail above the boots' top
  const upper = shell(bootTop + D.under, D.top, 'chausses');
  // the mail below the boots' top, and the garters on it: left out under the chain boots (their cuff takes the garters' place)
  G.dropFrom = G.polys.length;
  const lower = shell(footY, bootTop + D.under, 'chausses low');
  const S = bodySamples(B).filter((s) => s.part === 'legs').map((s) => s.p);
  for (const s of [1, -1]) {
    const gy = J.knee[1] + D.garter.y, ax = legAxis(s), skin = ['legs'];
    const rows = [gy + D.garter.w / 2, gy + 0.025, gy - 0.025, gy - D.garter.w / 2].map((y) => { const [x, z] = ax(y); return ringAt(S.filter((p) => p[0] * s > 0), x, z, y, 16, D.c + C.d + D.garter.c, { dy: 0.15, wedge: 24 }); });
    // (each column out as far as its farthest row, so the strap stands straight)
    rows[0].forEach((_, k) => { const [x, z] = ax(gy), r = Math.max(...rows.map((row) => Math.hypot(row[k][0] - x, row[k][2] - z))); rows.forEach((row) => { const p = row[k], l = Math.hypot(p[0] - x, p[2] - z); row[k] = [x + ((p[0] - x) * r) / l, p[1], z + ((p[2] - z) * r) / l]; }); });
    band(G, rows, { axis: (p) => { const [x, z] = ax(p[1]); return [x, p[1], z]; }, t: 0.03, mat: (r) => (r === 1 ? 'rune' : 'leather'), w: (p) => skinAt(rig, p, skin), tag: s > 0 ? 'garter.l' : 'garter.r' });
    // its buckle on the outside
    const k = 4, out = rows[1][s > 0 ? k : 16 - k], [x, z] = ax(gy), n = [out[0] - x, 0, out[2] - z];
    stud(G, add(out, mul(n, 0.02 / Math.hypot(n[0], n[2]))), n, [0, 0, 1], { a: 0.1, b: 0.13, h: 0.04, inset: 0.55, w: skinAt(rig, out, skin), tag: 'garter buckle' });
  }
  G.hides = coveredPolys(rig, (i) => upper.covered(i, 0.02) || lower.covered(i, 0.02) || (upper.covered(i) && lower.covered(i)));
  return G;
}

if (import.meta.url === `file://${process.argv[1]}`) await writePiece('chainlegs', buildChainLegs, 'chainlegs.mjs');
