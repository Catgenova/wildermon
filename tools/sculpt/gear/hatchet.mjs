// The hatchet (src/game/items.ts 'hatchet': a hatchet head forged in a metal, fitted to a shaft; the kit's is copper): a
// Runecut hand tool in the line of the long sword, the Runestone Warhammer and the Runestone Pickaxe
// (tools/sculpt/gear/handparts.mjs), low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs).
//
//   buildHatchet({ enchanted }) -> { G, MATS, L, grip, contact (the edge's middle), tris, all }
//
// Game units, its frame as handparts.mjs says (y up the haft toward the head, x the blow's way: the edge leads, z = x × y).
// Parts: (1) the one-piece head in the item's metal: the eye round the haft, the blade flaring from it to a curved edge
// (its section a flat lozenge, bevelled to the edge), the short poll behind; a gold-ringed star medallion on each face of
// the blade; veins over the stone; (2) the upper collar; (3) the wooden haft, straight grained; (4) the lower collar and
// the faceted stone pommel, a gem on its front and back; over the eye the haft's stub and a gold cap.
// The fist: choked up the haft so the edge's middle is the mallet's reach from it (contact − lead = [0.85, 2.85, 0],
// the edge 0.06 past the mallet's face): laid out at life size, then grown whole to the props' scale (handparts.mjs GROW, the work clip's grip convention);
// the fist closed with the haft slanted across the palm (STRIKE_FIT).
// Enchanted: the medallions' stars and discs and the pommel's gems lit, glow added round them.

import { meshOf, trisOf, metalFaces } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, writeTool, grown, GROW, STRIKE_FIT, MATS_PLAIN, MATS_ENCHANTED, METAL } from './handparts.mjs';

export const HATCHET = { lead: 0.62, edge: [0.62, 2.69, 0], r: 0.125 };

export function buildHatchet({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, cap, medal, crack, glowDisc } = parts;
  const H = HATCHET, HY = H.edge[1], X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---- the head (its metal) --------------------------------------------------------------------------------------- */
  const headFrom = G.F.length;
  // the eye: an eight-sided post round the haft
  const EX = 0.185, EZ = 0.13, EH = 0.23;
  const e0 = oct([0, HY - EH, 0], X, Z, EX, EZ, 0.05), e1 = oct([0, HY + EH, 0], X, Z, EX, EZ, 0.05);
  tube([e0, e1], (i, j) => (j === 3 || j === 7 ? 'stone' : j === 1 || j === 5 ? 'stoneL' : 'stoneB'));
  cap(e1, 'stoneL', Y); cap(e0, 'bevel', [0, -1, 0]);
  // the blade: stations out along x, each [x, top, foot, half-thickness]; its ring the pickaxe's (a narrow flat along
  // the top and the foot, the faces, a bevel down to them), the edge's points curved back at its ends
  const ST = [[0.16, 2.89, 2.51, 0.1], [0.3, 2.92, 2.47, 0.082], [0.45, 3., 2.39, 0.054], [0.545, 3.05, 2.34, 0.034], [0.62, 3.06, 2.32, 0.005]];
  const bring = ([x, top, bot, t], last) => {
    const h = top - bot, te = t * 0.35, bt = h * 0.06, xe = (dy) => (last ? x - 0.045 * Math.pow(Math.abs(dy) / (h / 2), 2) : x);
    const yc = (top + bot) / 2;
    return [[top, te], [top - bt, t], [bot + bt, t], [bot, te], [bot, -te], [bot + bt, -t], [top - bt, -t], [top, -te]].map(([y, z]) => P([xe(y - yc), y, z]));
  };
  const BR = ST.map((s, i) => bring(s, i === ST.length - 1));
  const BM = ['stoneL', 'stone', 'stoneB', 'bevel', 'bevel', 'stone', 'stoneL', 'stoneL'];
  for (let i = 0; i + 1 < BR.length; i++) for (let j = 0; j < 8; j++) {
    const a = BR[i], b = BR[i + 1], m = i === BR.length - 2 && (j === 1 || j === 5) ? 'bevel' : BM[j];
    F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], m, { from: [(ST[i][0] + ST[i + 1][0]) / 2, HY, 0] });
  }
  // the poll behind the eye
  const po = (x, a, b, k) => oct([x, HY, 0], Y, Z, a, b, k);
  const PL = [po(-EX + 0.01, 0.17, 0.11, 0.04), po(-0.29, 0.17, 0.11, 0.04), po(-0.315, 0.14, 0.09, 0.035)];
  tube(PL, (i, j) => (i === 1 ? 'bevel' : j === 1 ? 'stoneL' : j === 5 ? 'stoneB' : 'stone'));
  cap(PL[2], 'stone', [-1, 0, 0]);
  const headTo = G.F.length;

  /* ---- the haft: pommel, lower collar, wood, upper collar; the stub over the eye ------------------------------------- */
  const pm = pommelOf(parts, { pr: 0.165, pt: 0.22, r: H.r });
  haftOf(parts, [[pm.wood, H.r, 'wood'], [HY - EH - 0.13, H.r * 0.96, 'gold'], [HY - EH - 0.13, 0.155, 'gold'], [HY - EH - 0.01, 0.155, 'gold'], [HY - EH + 0.02, 0.125]], { grain: true });
  haftOf(parts, [[HY + EH - 0.02, 0.13, 'gold'], [HY + EH + 0.06, 0.145, 'gold'], [HY + EH + 0.09, 0.095]], { top: 'gold' });

  /* ---- the blade's medallions: on each face's slant ------------------------------------------------------------------- */
  const MX = 0.375, slope = (ST[2][3] - ST[1][3]) / (ST[2][0] - ST[1][0]), zAt = (x) => ST[1][3] + slope * (x - ST[1][0]);
  const faceOf = (sz) => { const u = [1, 0, sz * slope], l = Math.hypot(...u), uu = u.map((v) => v / l), n = [-sz * slope, 0, 1].map((v) => v * sz); const ln = Math.hypot(...n); return { u: uu, n: n.map((v) => v / ln) }; };
  const veinsFrom = G.F.length;
  for (const sz of [1, -1]) {
    const { u, n } = faceOf(sz);
    crack([0.3, 0, sz * zAt(0.3)], u, Y, n, [[0.17, 2.94], [0.13, 2.89], [0.2, 2.84]]);
    crack([0.3, 0, sz * zAt(0.3)], u, Y, n, [[0.17, 2.52], [0.21, 2.48], [0.25, 2.44]]);
  }
  metalFaces(G, [[headFrom, headTo], [veinsFrom, G.F.length]], METAL);
  for (const sz of [1, -1]) {
    const { u, n } = faceOf(sz);
    medal([MX, HY, sz * zAt(MX)], u, n, 0.13, 0.095);
  }

  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) { const { u, n } = faceOf(sz); glowDisc([MX, HY, sz * (zAt(MX) + 0.03)], u, Y, n, 0.26, 0.28, 0.42); }
    pm.glow();
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  void Z;
  return grown({
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: HY + EH + 0.09, tris, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, H.lead, 0], second: [0, H.lead, 0], radius: H.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: HY - EH - 0.13 },
    fit: STRIKE_FIT,
    contact: H.edge,
  }, GROW);
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('hatchet', buildHatchet);
