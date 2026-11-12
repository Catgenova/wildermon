// The mallet (src/game/items.ts 'mallet': carved from a log, its material a wood, never a metal): a Runecut hand tool
// in the line of the long sword, the Runestone Warhammer and the Runestone Pickaxe (tools/sculpt/gear/handparts.mjs),
// low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs). It sets the hand tools' reach (the work clip's grip
// convention): the face's middle 2.85 over the fist and 0.79 out along the blow (the fist 0.85 up the haft, its pommel
// under it): laid out at life size, then grown whole to the props' scale (handparts.mjs GROW, the work clip's grip convention);
// the fist closed with the haft slanted across the palm (STRIKE_FIT).
//
//   buildMallet({ enchanted }) -> { G, MATS, L, grip, contact, tris, all }
//
// Game units, its frame as handparts.mjs says (y up the haft toward the head, x the blow's way, z = x × y).
// Parts: (1) the head, one block of pale wood across the haft (eight-sided, 1.15 long and 0.66 across), a gold band
// round each end, its faces the end grain inset behind a chamfer; a gold-ringed star medallion on its front and back;
// (2) the upper collar; (3) the wooden haft, straight grained; (4) the lower collar and the faceted stone pommel, a gem on
// its front and back; over the head, the haft's wedged end and a gold cap. No part of it takes the item's metal: the
// game makes the mallet of wood only (src/game/recipes.ts make_mallet, material 'wood').
// Enchanted: the medallions' stars and discs and the pommel's gems lit, glow added round them.

import { meshOf, trisOf } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, writeTool, grown, GROW, STRIKE_FIT, MATS_PLAIN, MATS_ENCHANTED } from './handparts.mjs';

/** The work clip's mallet: the fist on the haft and the face's middle (its contact), its own frame. */
export const MALLET = { lead: 0.62, face: [0.575, 2.69, 0], r: 0.14, head: 0.33 };

export function buildMallet({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { oct, tube, cap, medal, glowDisc } = parts;
  const M = MALLET, HY = M.face[1], HR = M.head, HX = M.face[0];
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---- the head: sections across x, its y and z half-sizes; the gold bands near each end ---------------------------- */
  const sec = (x, a, k = a * 0.42) => oct([x, HY, 0], Y, Z, a, a * 0.94, k);
  const xs = [-HX, -HX + 0.05, -0.47, -0.4, 0.4, 0.47, HX - 0.05, HX];
  const R = [sec(-HX, HR - 0.06), sec(-HX + 0.05, HR), sec(-0.47, HR + 0.012), sec(-0.4, HR + 0.012), sec(0.4, HR + 0.012), sec(0.47, HR + 0.012), sec(HX - 0.05, HR), sec(HX, HR - 0.06)];
  // the middle's bands, its rings at ±0.4 at the head's own size (the gold stands proud of it)
  const Rin = [sec(-0.4, HR), sec(0.4, HR)];
  tube([R[0], R[1], R[2], R[3]], (i, j) => (i === 0 ? 'head2' : i === 2 ? 'gold' : i === 1 ? (j % 2 ? 'head2' : 'head') : 'gold'));
  tube([R[3], Rin[0]], 'goldD');
  tube([Rin[0], Rin[1]], (i, j) => (j % 2 ? 'head2' : 'head'));
  tube([Rin[1], R[4]], 'goldD');
  tube([R[4], R[5], R[6], R[7]], (i, j) => (i === 2 ? 'head2' : i === 0 ? 'gold' : j % 2 ? 'head2' : 'head'));
  cap(R[0], 'endgrain', [-1, 0, 0]); cap(R[7], 'endgrain', X);
  void xs;

  /* ---- the haft: pommel, lower collar, wood, upper collar; the wedged end over the head ------------------------------ */
  const pm = pommelOf(parts, { pr: 0.175, pt: 0.22, r: M.r });
  haftOf(parts, [[pm.wood, M.r, 'wood'], [HY - HR - 0.13, M.r * 0.96, 'gold'], [HY - HR - 0.13, 0.17, 'gold'], [HY - HR - 0.01, 0.17, 'gold'], [HY - HR + 0.02, 0.14]], { grain: true });
  haftOf(parts, [[HY + HR * 0.93, 0.15, 'gold'], [HY + HR * 0.93 + 0.07, 0.15, 'gold'], [HY + HR * 0.93 + 0.1, 0.1]], { top: 'gold' });

  /* ---- the medallions on the head's front and back --------------------------------------------------------------- */
  const ZF = HR * 0.94;
  for (const sz of [1, -1]) medal([0, HY, sz * ZF], [sz, 0, 0], [0, 0, sz], 0.175, 0.13);

  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) glowDisc([0, HY, sz * (ZF + 0.03)], X, Y, [0, 0, sz], 0.32, 0.3, 0.42);
    pm.glow();
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return grown({
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: HY + HR * 0.93 + 0.1, tris, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, M.lead, 0], second: [0, M.lead, 0], radius: M.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: HY - HR - 0.13 },
    fit: STRIKE_FIT,
    contact: M.face,
  }, GROW);
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('mallet', buildMallet);
