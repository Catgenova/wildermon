// The hammer (src/game/items.ts 'hammer': forged in a metal, fitted to a shaft): a Runecut hand tool in the line of the
// long sword, the Runestone Warhammer and the Runestone Pickaxe (tools/sculpt/gear/handparts.mjs), low-poly for the
// low-poly bodies (tools/sculpt/lowgear.mjs).
//
//   buildHammer({ enchanted }) -> { G, MATS, L, grip, contact, tris, all }
//
// Game units, its frame as handparts.mjs says (y up the haft toward the head, x the blow's way, z = x × y).
// Parts: (1) the one-piece head in the item's metal: the striking block on +x, eight-sided, its face an inset octagon
// behind a gold band; the waisted neck to the hub; the hub round the haft, a gold-ringed star medallion on its front and
// back; the cross peen on -x, a wedge to a thin edge; veins over the stone; (2) the upper collar; (3) the wooden haft,
// straight grained; (4) the lower collar and the faceted stone pommel, a gem on its front and back; over the head the
// haft's stub and a gold cap.
// The fist: choked up the haft so the face's middle (the contact) is the mallet's reach from it (contact − lead =
// [0.79, 2.85, 0]): laid out at life size, then grown whole to the props' scale (handparts.mjs GROW, the work clip's grip convention);
// the fist closed with the haft slanted across the palm (STRIKE_FIT).
// Enchanted: the hub's stars and discs, the face's diamond and the pommel's gems lit (unlit, full bright), glow added
// round them.

import { meshOf, trisOf, metalFaces } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, writeTool, grown, GROW, STRIKE_FIT, MATS_PLAIN, MATS_ENCHANTED, METAL } from './handparts.mjs';

/** The contact (the face's middle) and the fist on the haft, its own frame. */
export const HAMMER = { face: [0.575, 2.69, 0], lead: 0.62, r: 0.12 };

export function buildHammer({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { oct, tube, cap, medal, diamond, crack, glowDisc } = parts;
  const H = HAMMER, HY = H.face[1];
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---- the head (its metal) ------------------------------------------------------------------------------------- */
  const headFrom = G.F.length;
  // the hub round the haft: an eight-sided post, y HY ± 0.25
  const HB = 0.2, HZ = 0.175, HH = 0.29;
  const hub0 = oct([0, HY - HH, 0], X, Z, HB, HZ, 0.05), hub1 = oct([0, HY + HH, 0], X, Z, HB, HZ, 0.05);
  tube([hub0, hub1], (i, j) => (j === 3 || j === 7 ? 'stone' : j === 1 || j === 5 ? 'stoneL' : 'stoneB'));
  cap(hub1, 'stoneL', Y); cap(hub0, 'bevel', [0, -1, 0]);
  // the striking block on +x: sections across x (its y half-height a, z half-depth b)
  const blk = (x, a, b, k) => oct([x, HY, 0], Y, Z, a, b, k);
  // (a section's sides: 1 the top, 5 the foot, 3 and 7 the back and front, the rest its chamfers, the upper two lit)
  const facet = (j) => (j === 1 || j === 0 || j === 2 ? 'stoneL' : j === 5 ? 'stoneB' : j === 4 || j === 6 ? 'bevel' : 'stone');
  const S = [blk(HB - 0.01, 0.15, 0.13, 0.045), blk(0.28, 0.2, 0.165, 0.06), blk(0.465, 0.2, 0.165, 0.06), blk(0.47, 0.214, 0.178, 0.065), blk(0.535, 0.214, 0.178, 0.065), blk(H.face[0], 0.17, 0.14, 0.05)];
  tube(S, (i, j) => (i === 0 ? 'bevel' : i === 2 ? 'goldD' : i === 3 ? 'gold' : i === 4 ? 'bevel' : facet(j)));
  cap(S[S.length - 1], 'stone', X);
  // the cross peen on -x: from the hub to a thin edge across z
  const pe = (x, a, b, k) => oct([x, HY, 0], Y, Z, a, b, k);
  const PN = [pe(-HB + 0.01, 0.15, 0.13, 0.045), pe(-0.28, 0.18, 0.155, 0.05), pe(-0.49, 0.025, 0.13, 0.012)];
  tube(PN, (i, j) => (i === 1 && (j === 5 || j === 4 || j === 6) ? 'bevel' : facet(j)));
  cap(PN[PN.length - 1], 'bevel', [-1, 0, 0]);
  const headTo = G.F.length;

  /* ---- the haft: pommel, lower collar, wood, upper collar; the stub over the head --------------------------------- */
  const pm = pommelOf(parts, { pr: 0.165, pt: 0.22, r: H.r });
  haftOf(parts, [[pm.wood, H.r, 'wood'], [HY - HH - 0.15, H.r, 'gold'], [HY - HH - 0.15, 0.16, 'gold'], [HY - HH - 0.02, 0.16, 'gold'], [HY - HH, 0.13]], { grain: true });
  const stub = haftOf(parts, [[HY + HH, 0.14, 'gold'], [HY + HH + 0.07, 0.15, 'gold'], [HY + HH + 0.1, 0.1]], { top: 'gold' });

  /* ---- the hub's medallions, the face's diamond -------------------------------------------------------------------- */
  for (const sz of [1, -1]) medal([0, HY, sz * HZ], [sz, 0, 0], [0, 0, sz], 0.145, 0.105);
  diamond([H.face[0] + 0.003, HY, 0], Z, Y, X, 0.085, 0.11, 0.024);

  /* ---- veins over the stone ------------------------------------------------------------------------------------------ */
  const veinsFrom = G.F.length;
  for (const sz of [1, -1]) {
    crack([0, 0, sz * 0.166], X, Y, [0, 0, sz], [[0.31, HY + 0.13], [0.37, HY + 0.04], [0.34, HY - 0.06], [0.42, HY - 0.13]]);
    crack([0, 0, sz * 0.152], X, Y, [0, 0, sz], [[-0.23, HY + 0.11], [-0.3, HY + 0.04], [-0.36, HY + 0.02]]);
  }
  metalFaces(G, [[headFrom, headTo], [veinsFrom, G.F.length]], METAL);

  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) glowDisc([0, HY, sz * (HZ + 0.03)], X, Y, [0, 0, sz], 0.27, 0.27, 0.42);
    glowDisc([H.face[0] + 0.01, HY, 0], Z, Y, X, 0.2, 0.22, 0.4, 8);
    pm.glow();
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  void stub;
  return grown({
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: HY + HH + 0.1, tris, all: trisOf(G).length,
    // one fist: grip.lead and grip.second the same point; the wood's radius there
    grip: { axis: [0, 1, 0], lead: [0, H.lead, 0], second: [0, H.lead, 0], radius: H.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: HY - HH - 0.15 },
    fit: STRIKE_FIT,
    contact: H.face,
  }, GROW);
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('hammer', buildHammer);
