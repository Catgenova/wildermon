// The side braid updo (tools/sculpt/ref/hair-side-braid.png): the game's 'braid', "Braid". Built by
// tools/sculpt/lowbraid.mjs: the crown's clumps between border lines traced on the sheet and lifted onto its carved
// hull (tools/sculpt/lowbraidcrown.mjs), the braid's hearts on a spine triangulated from the sheet
// (tools/sculpt/lowbraidbraid.mjs), the tie, the tip and the face strands.

/** The crown as the sheet shows it (tools/sculpt/lowbraidcrown.mjs): its borders over the scalp (map degrees, east her
 * right, north her face), each from its anchors: a map point, a lifted trace (tools/sculpt/hairs/braid-traces.json: the
 * back's chevrons bl1-bl5 (her left) and br1-br5 (her right), the profile's and front's r1-r3 and hairR, the rear
 * three-quarter's l3a and l3b, the front's fl1 and hairL), a seam tip V<k>. Every border on each side starts at the fan's
 * point on the part (the outermost at its front, P0 over the brow, where the profile's blades meet; each further in
 * further back along it) and ends on the seam, the
 * k-th border of each side at the k-th chevron's tip; the outermost (the hairline) at the braid's root. Between two
 * borders a clump. Six clumps each side. */
const P0 = [-6, 44];
export const CROWN_LINES = {
  seam: [['bl1', 'br1'], ['bl2', 'br2'], ['bl3', 'br3'], ['bl4', 'br4'], ['bl5', 'br5'], [100, -104]],
  lines: {
    part: [P0, [-3, 30], [-9, 0], [-13, -32], 'V1'],
    br1: ['part@0.32', [6, 0], 'br1'],
    br2: ['part@0.22', [14, 15], [20, 0], 'br2'],
    br3: ['part@0.12', [18, 35], [30, 5], 'br3'],
    br4: ['part@0.05', [12, 44], 'r1:profile', 'br4'],
    br5: [P0, [14, 56], 'r2:profile', 'br5'],
    hairR: ['hairR', [124, -60], 'V6'],
    bl1: ['part@0.3', [-20, -5], 'bl1'],
    bl2: ['part@0.2', [-24, 20], [-38, -20], 'bl2'],
    bl3: ['part@0.11', [-38, 35], [-58, 0], 'l3b', 'bl3'],
    bl4: ['part@0.04', 'fl1', [-80, 15], [-85, -40], 'bl4'],
    bl5: [P0, [-30, 58], [-72, 48], [-98, 5], [-100, -50], 'bl5'],
    hairL: ['hairL:front', [-90, 62], [-112, 15], [-115, -45], 'hairL:back', 'V6'],
  },
  // (the hairlines: a clump's edge there lies on the skin)
  edges: ['hairR', 'hairL'],
  clumps: [
    ['R1', 'part', 'br1'], ['R2', 'br1', 'br2'], ['R3', 'br2', 'br3'], ['R4', 'br3', 'br4'], ['R5', 'br4', 'br5'], ['R6', 'br5', 'hairR'],
    ['L1', 'part', 'bl1'], ['L2', 'bl1', 'bl2'], ['L3', 'bl2', 'bl3'], ['L4', 'bl3', 'bl4'], ['L5', 'bl4', 'bl5'], ['L6', 'bl5', 'hairL'],
  ].map(([id, inner, outer]) => ({ id, inner, outer })),
};

export default {
  crown: CROWN_LINES,
  // the crown's two narrow braids down the back of the head (the user's addition; tools/sculpt/lowbraidbraid.mjs
  // addCrownBraids): along the seam from `start` of the way down the part, `apart` degrees either side of it closing to
  // its end over the last `close` of the way, n hearts each from `from` to `to` of the way, `w` wide (head units)
  // narrowing by `taper` to the end, `stretch` their length against their spacing, their backs `lift` over the hull
  crownBraids: { start: 0.5, apart: 11, close: 0.35, n: 6, from: 0, to: 1, w: 0.34, taper: 0.3, stretch: 1.12, lift: 0.005 },
  // the braid (tools/sculpt/lowbraidbraid.mjs): sheet rows in the front view. The root's row (where the braid leaves the
  // crown's seam); each heart's top, bottom (its point) and width (px); the tie's rows and width; the tip's rows and
  // width; the rows over which its face turns from out of her neck (faceFrom) to the front (faceTo); the hearts'
  // length against their rows (each tucked under the one above).
  braid: {
    root: [196],
    hearts: [[198, 250, 72], [238, 292, 72], [280, 324, 66], [312, 344, 56]],
    tie: [340, 354, 36],
    tip: [352, 398, 44],
    face: [200, 280], faceFrom: [-0.7, 0, 0.5], faceTo: [-0.25, 0, 1],
    stretch: 1.22,
  },
  // the face strands: each a wavy path (her body's units, from its root under the clumps at the temple), its width and
  // thickness tapering to the tip
  strands: [
    { id: 'strandL', path: [[0.66, 1.4, 0.48], [0.76, 1.08, 0.46], [0.8, 0.78, 0.4], [0.9, 0.48, 0.34], [0.84, 0.18, 0.38], [0.9, -0.05, 0.28]], w: 0.11, t: 0.04 },
    { id: 'strandR', path: [[-0.68, 1.36, 0.42], [-0.76, 1.08, 0.36], [-0.74, 0.84, 0.3], [-0.8, 0.6, 0.24], [-0.74, 0.36, 0.2], [-0.78, 0.18, 0.12]], w: 0.09, t: 0.04 },
  ],
};
