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
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhair.mjs --asset)
  name: 'Braid',
  crown: CROWN_LINES,
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
    // the braid's bones down its length (tools/sculpt/lowbraid.mjs weightOf): the head to the neck to the body over
    // `neck`'s shares, on the shoulder from `shoulder[0]` the clavicle's half, over the chest by `shoulder[1]` the
    // chest's `chest`
    weights: { neck: [0.1, 0.18, 0.26, 0.34], shoulder: [0.34, 0.55], chest: 0.75 },
    // the hanging hearts' depth against their width
    depth: 0.36,
    // the hanging braid draped on the body (tools/sculpt/lowbraidbraid.mjs addBraid): from `join` of the crown links' way,
    // `lead` on along the last link,
    // down onto her right shoulder (`shoulder`: [x, z, y], her units, let down from y) and over its front down her chest (`chest`: [x, y] each),
    // those at `at` of its length, in `n` links, `gap` off the body past its hearts' backs; its hearts' faces out from the
    // body and `front` toward the front
    drape: { n: 24, pin: 2, rootLift: 0, lead: 0.2, neck: [[-0.66, -0.14, -0.28]], neckAt: [0.18], shoulder: [-0.82, 0.12, -0.1], chest: [[-0.62, -0.95], [-0.56, -1.35], [-0.52, -1.75]], at: [0.3, 0.55, 0.75, 1], gap: 0.03, front: 0.3 },
    // its first links, on the crown (tools/sculpt/lowbraidbraid.mjs addCrownLinks): along the seam from `start` of the
    // way down the part to the seam's end, each [from, to, width px] as shares of that way, larger toward the start;
    // `stretch` their length against their spacing, `depth` their depth against their width, their backs `sink` of that
    // into the hull and `lift` over it; the clumps under them lowered to `under` of the hull's thickness within `half`
    // degrees of their way, the whole `soft` degrees further
    crownLinks: { start: 0.83, join: 0.78, links: [[0, 0.46, 88], [0.33, 1, 80]], stretch: 1, depth: 0.3, sink: 1, lift: 0.05, dip: { under: 0.35, half: 16, soft: 14 } },
  },
  // the face strands: each a wavy path (her body's units, from its root under the clumps at the temple), its width and
  // thickness tapering to the tip
  strands: [
    { id: 'strandL', path: [[0.66, 1.4, 0.48], [0.76, 1.08, 0.46], [0.8, 0.78, 0.4], [0.9, 0.48, 0.34], [0.84, 0.18, 0.38], [0.9, -0.05, 0.28]], w: 0.11, t: 0.04 },
    { id: 'strandR', path: [[-0.68, 1.36, 0.42], [-0.76, 1.08, 0.36], [-0.74, 0.84, 0.3], [-0.8, 0.6, 0.24], [-0.74, 0.36, 0.2], [-0.78, 0.18, 0.12]], w: 0.09, t: 0.04 },
  ],
};
