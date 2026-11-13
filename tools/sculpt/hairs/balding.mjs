// Balding: the game's 'balding', "Balding". Built by tools/sculpt/lowring.mjs: male-pattern hair loss, not a cut. A
// horseshoe of short hair round the sides and the back (one thin closed shell over the skull from the temples behind
// the receded corners, over the ears, round the nape), its upper edge uneven and thinning (a band in the shaved scalp's
// tone, the skin showing through); the forehead, the top and the crown bare; a few thin wisps left lying back over the
// top. No reference sheet: modelled from the description. Angles in degrees from the skull's middle
// (tools/sculpt/lowhair.mjs skullOf): theta round from the front toward the body's left (its right the same, mirrored),
// phi up from level; lengths in the body's head units (the head two tall).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Balding',
  // the hair starts this far round from the front (each side): the temples' corners behind it are bare
  from: 40,
  // the lower hairline per body: [theta, phi] round the head's left from the front to the back (the temple, the
  // sideburn, over the ear, behind it, the nape)
  hem: {
    male: [[0, 31], [24, 30.5], [34, 28], [43, 23], [50, 15], [56, 5], [60, -6], [63, -14], [67, -15], [70, -11], [74, -5], [79, 0], [86, 1.5], [93, 1], [99, 1], [104, -4], [110, -16], [118, -27], [130, -34], [143, -37], [161, -39], [180, -39]],
    female: [[0, 37], [24, 36], [33, 33], [42, 26], [49, 16], [54, 4], [57, -8], [60, -17], [64, -19], [67, -16], [71, -10], [76, -6], [83, -4.5], [90, -4.5], [96, -6], [101, -12], [107, -24], [115, -32], [128, -38], [141, -40], [160, -42], [180, -42]],
  },
  // the upper edge (where the hair gives out), per body, the same way round: low at the temples, rising over the ears,
  // highest over the back of the head under the bare crown
  crown: {
    male: [[40, 27], [50, 29], [60, 31], [75, 33], [90, 34], [110, 36], [130, 39], [155, 42], [180, 43]],
    female: [[40, 30], [50, 32], [60, 34], [75, 35], [90, 36], [110, 38], [130, 41], [155, 44], [180, 45]],
  },
  // each column's upper edge up or down by up to this many degrees, its own way (uneven, not a cut line)
  crownJog: 8,
  // the hair's columns: every point of the two tables and at most this many degrees apart
  step: 9,
  // the rows down each column from the upper edge (0) to the hairline (1), and the hair's height off the skin at each
  rows: [0, 0.2, 0.45, 0.72, 0.88, 1],
  height: [0.01, 0.034, 0.05, 0.05, 0.04, 0.02],
  // the bands drawn in the shaved scalp's tone: `thin` by index (the first, under the upper edge: the hair thinning),
  // and the last on the sides and the back (|theta| over `taperFrom`: trimmed short at the hairline)
  thin: [0], taperFrom: 60,
  // toward the horseshoe's ends (within `endFade` degrees of `from`) the heights ease down to the edge's
  endFade: 14,
  // each corner's height moved by up to this share of it, its own way
  jitter: 0.3,
  // the outside's planes: each band's quads joined `group` columns at a time (per band, the top's first), staggered
  group: [1, 3, 3, 2],
  // the inside: sunk into the scalp where the skin under it is covered whole and moves with the head, else `lip` off it
  sink: 0.03, lip: 0.003,
  // the cut's edges (the hairline's, the upper edge's, the ends') in these valley shades
  rimShade: 2, topShade: 3, insideShade: 1,
  // the least the outside stands off the skin anywhere over it
  show: 0.008, reach: 0,
  // the wisps over the bare top: each a path of [theta, phi] points (from its root toward its tip), its width and its
  // height off the skin (lengths in head units)
  wisps: {
    male: [
      [[-7, 49], [-11, 57], [-8, 65], [2, 71]],
      [[7, 50], [9, 57], [16, 62]],
      [[162, 61], [176, 68], [196, 71]],
      [[138, 58], [143, 65]],
    ],
    female: [
      [[-7, 52], [-11, 60], [-8, 67], [2, 73]],
      [[7, 53], [9, 60], [16, 65]],
      [[162, 63], [176, 70], [196, 73]],
      [[138, 60], [143, 67]],
    ],
  },
  wispWidth: 0.036, wispHeight: 0.016, wispThick: 0.008,
};
