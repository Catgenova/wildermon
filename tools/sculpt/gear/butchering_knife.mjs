// The butchering knife (src/game/items.ts 'butchering_knife': a knife blade forged in a metal, fitted to a shaft; the
// kit's is copper), drawn as a cleaver: a Runecut hand tool in the line of the long sword, the Runestone Warhammer and the
// Runestone Pickaxe (tools/sculpt/gear/handparts.mjs), low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs).
//
//   buildCleaver({ enchanted }) -> { G, MATS, L, grip, contact (the edge where it meets the work), tris, all }
//
// Game units, its frame as handparts.mjs says (y up the handle toward the blade's tip, x the blow's way: the edge leads,
// z = x × y: the blade's flats look down ±z).
// Parts: (1) the blade in the item's metal, a broad slab from the bolster to its square tip, its spine straight over the
// handle's line, its edge bevelled; a gold-ringed star medallion at the tip's corner by the spine, on both flats; a rune
// line and a diamond down each flat by the spine; veins over the stone; (2) the gold bolster; (3) the wooden handle,
// straight grained; (4) the lower collar and the faceted stone pommel, a gem on its front and back.
// The fist: choked up the handle so the edge's point 2.85 over it (the contact, 0.85 out) is the mallet's reach:
// laid out at life size, then grown whole to the props' scale (handparts.mjs GROW, the work clip's grip convention);
// the fist closed with the haft slanted across the palm (STRIKE_FIT).
// Enchanted: the medallions' stars and discs, the runes and the pommel's gems lit, glow added round them.

import { meshOf, trisOf, metalFaces } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, writeTool, grown, GROW, STRIKE_FIT, MATS_PLAIN, MATS_ENCHANTED, METAL } from './handparts.mjs';

export const CLEAVER = { lead: 0.62, edge: [0.62, 2.69, 0], r: 0.12 };

export function buildCleaver({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { P, tube, cap, medal, line, diamond, crack, glowDisc } = parts;
  const C = CLEAVER, X = [1, 0, 0], Y = [0, 1, 0];

  /* ---- the blade (its metal): sections up y across x, from the spine to the edge ------------------------------------- */
  const headFrom = G.F.length;
  const XS = -0.13, B0 = 1.25;
  // stations: [y at the spine, y at the edge, the edge's x, half-thickness]
  const ST = [[B0, B0 + 0.1, 0.46, 0.032], [1.55, 1.57, 0.6, 0.032], [2.15, 2.15, 0.625, 0.03], [C.edge[1], C.edge[1], C.edge[0], 0.028], [3.15, 3.07, 0.6, 0.026]];
  const sec = ([ys, ye, xe, t]) => {
    const xb = xe - 0.11, yb = ys + (ye - ys) * 0.8;
    // the spine's two corners, the flats' foot by the bevel, the edge (a hair thick)
    return [[XS, ys, t], [xb, yb, t], [xe, ye, 0.004], [xe, ye, -0.004], [xb, yb, -t], [XS, ys, -t]].map((q) => P(q));
  };
  const R = ST.map(sec);
  tube(R, (i, j) => (j === 0 ? 'stoneL' : j === 4 ? 'stone' : j === 5 ? 'stoneB' : 'bevel'), (i) => [0.2, (ST[i][0] + ST[i + 1][0]) / 2, 0]);
  cap(R[R.length - 1], 'stoneL', [0.1, 1, 0]);
  cap(R[0], 'bevel', [0, -1, 0]);
  const headTo = G.F.length;

  /* ---- the handle: pommel, wood, the bolster up into the blade's heel ------------------------------------------------- */
  const pm = pommelOf(parts, { pr: 0.16, pt: 0.22, r: C.r, zkWood: 0.82 });
  haftOf(parts, [[pm.wood, C.r, 'wood'], [B0 - 0.22, C.r * 1.05, 'gold'], [B0 - 0.22, 0.16, 'gold'], [B0 - 0.02, 0.16, 'gold'], [B0 + 0.03, 0.1]], { grain: true, zk: 0.82, top: 'goldD' });

  /* ---- veins, then the medallions and the runes on the flats -------------------------------------------------------- */
  const veinsFrom = G.F.length;
  for (const sz of [1, -1]) {
    const c = [0, 0, sz * 0.03], n = [0, 0, sz];
    crack(c, X, Y, n, [[0.42, 1.75], [0.36, 1.87], [0.4, 2.], [0.33, 2.1]]);
    crack(c, X, Y, n, [[0.44, 2.45], [0.37, 2.53], [0.39, 2.61]]);
  }
  metalFaces(G, [[headFrom, headTo], [veinsFrom, G.F.length]], METAL);
  const MC = [0.05, 2.91];
  for (const sz of [1, -1]) {
    const c = [0, 0, sz * 0.03], n = [0, 0, sz];
    medal([MC[0], MC[1], sz * 0.029], [sz, 0, 0], n, 0.11, 0.08);
    line([0, 0, sz * 0.034], X, Y, n, -0.04, 1.45, -0.04, 2.6, 0.022);
    diamond([-0.04, 2.71, sz * 0.031], X, Y, n, 0.035, 0.045, 0.012);
  }

  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) {
      const n = [0, 0, sz];
      glowDisc([MC[0], MC[1], sz * 0.06], X, Y, n, 0.24, 0.24, 0.42);
      glowDisc([-0.04, 2.05, sz * 0.045], X, Y, n, 0.1, 0.7, 0.3, 8);
    }
    pm.glow();
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return grown({
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: 3.15, tris, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, C.lead, 0], second: [0, C.lead, 0], radius: C.r * 0.91 + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: B0 - 0.22 },
    fit: STRIKE_FIT,
    contact: C.edge,
  }, GROW);
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('butchering_knife', buildCleaver);
