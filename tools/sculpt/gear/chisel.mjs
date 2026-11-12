// The stone chisel (src/game/items.ts 'chisel': the kit's is copper; its material a metal): a Runecut hand tool in the line
// of the long sword, the Runestone Warhammer and the Runestone Pickaxe (tools/sculpt/gear/handparts.mjs), low-poly for the
// low-poly bodies (tools/sculpt/lowgear.mjs). Held in the LEFT fist, upright on the work, its top struck by the mallet.
//
//   buildChisel({ enchanted }) -> { G, MATS, L, grip, contact (the struck top), cut (the edge's middle), tris, all }
//
// Game units, its frame as handparts.mjs says, its y from the cutting edge (0) up to the struck top (2.4), toward the
// thumb of the left fist round it; the blade's width along z, its flats looking down ±x.
// Parts: (1) the blade in the item's metal, a flat wedge bevelled to the edge, a rune line and a diamond down each flat;
// (2) the square shank; (3) the gold bolster, a gem on each flat's side; (4) the wooden grip, straight grained, swelling
// under the fist; (5) the gold collar and the line's stone pommel (as the awl's and the file's), its foot the struck top,
// a gold-ringed star medallion on each broad face.
// The fist: 1.42 up it, the struck top 0.98 over the fist (the work clip's grip convention): laid out at life size,
// then grown whole (handparts.mjs GROW_CHISEL).
// Enchanted: the runes, the bolster's gems and the pommel's medallions lit, glow added along the blade and round them.

import { meshOf, trisOf, metalFaces } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, writeTool, grown, GROW_CHISEL, MATS_PLAIN, MATS_ENCHANTED, METAL } from './handparts.mjs';

export const CHISEL = { lead: 1.12, top: 1.9, r: 0.15 };

export function buildChisel({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, cap, line, diamond, star4, crack, glowDisc } = parts;
  const C = CHISEL, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---- the blade (its metal): sections across y, half-width a along z, half-thickness b along x ------------------- */
  const headFrom = G.F.length;
  const sec = (y, a, b, k) => oct([0, y, 0], Z, X, a, b, k);
  const B = [sec(0, 0.17, 0.008, 0.004), sec(0.1, 0.165, 0.045, 0.02), sec(0.5, 0.115, 0.06, 0.025), sec(0.56, 0.075, 0.06, 0.02), sec(0.74, 0.07, 0.065, 0.02)];
  // (an octagon's sides: 7 the +x flat, 3 the -x flat, 1 and 5 the narrow sides, the rest its chamfers)
  tube(B, (i, j) => (i === 0 ? 'bevel' : j === 7 ? 'stoneL' : j === 3 ? 'stone' : 'stoneB'));
  cap(B[0], 'bevel', [0, -1, 0]);
  const bladeTo = G.F.length;

  /* ---- the bolster, the grip; the struck top, the line's pommel (its medallions on the flats' sides, ±x) -------------- */
  const pm = pommelOf(parts, { pr: 0.16, pt: 0.26, r: 0.135, y0: C.top, dir: -1, faces: 'x' });
  const GY0 = 0.84, GY1 = pm.wood;
  haftOf(parts, [[0.72, 0.075, 'goldD'], [0.74, 0.14, 'gold'], [0.84, 0.14, 'gold'], [GY0, 0.125, 'wood'], [1.2, 0.152, 'wood'], [GY1, 0.135]], { grain: true });
  // the bolster's gems, front and back (on its ±x faces)
  for (const sx of [1, -1]) F([P([sx * 0.143, 0.81, 0]), P([sx * 0.143, 0.79, 0.045]), P([sx * 0.143, 0.77, 0]), P([sx * 0.143, 0.79, -0.045])], 'gem', [sx, 0, 0]);

  /* ---- the runes and the veins down each flat ------------------------------------------------------------------------ */
  const veinsFrom = G.F.length;
  for (const sx of [1, -1]) {
    // the flat's plane: a point on it at y, its x the blade's half-thickness there
    const xAt = (y) => (y < 0.1 ? 0.008 + 0.037 * y / 0.1 : 0.045 + 0.015 * (y - 0.1) / 0.4) + 0.003;
    crack([sx * xAt(0.3), 0, 0], [0, 0, 1], Y, [sx, 0, 0], [[0.1, 0.48], [0.06, 0.4], [0.09, 0.3]], 0.01);
    crack([sx * xAt(0.3), 0, 0], [0, 0, 1], Y, [sx, 0, 0], [[-0.07, 0.2], [-0.1, 0.15]], 0.01);
    void xAt;
  }
  metalFaces(G, [[headFrom, bladeTo], [veinsFrom, G.F.length]], METAL);
  for (const sx of [1, -1]) {
    const x = sx * 0.06;
    line([x, 0, 0], Z, Y, [sx, 0, 0], 0, 0.2, 0, 0.42, 0.018);
    diamond([x, 0.47, 0], Z, Y, [sx, 0, 0], 0.035, 0.04, 0.012);
  }

  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sx of [1, -1]) glowDisc([sx * 0.075, 0.36, 0], Z, Y, [sx, 0, 0], 0.11, 0.24, 0.4, 8);
    pm.glow();
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return grown({
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: C.top, tris, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, C.lead, 0], second: [0, C.lead, 0], radius: C.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: GY0, to: GY1 },
    // the struck top (where the mallet meets it), and the edge's middle on the work
    contact: [0, C.top, 0], cut: [0, 0, 0],
  }, GROW_CHISEL);
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('chisel', buildChisel, (p) => ({ hand: 'l', cut: p.cut, top: p.contact }));
