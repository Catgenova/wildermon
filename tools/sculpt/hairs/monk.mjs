// The monk cut: the game's 'monk', "Monk cut". Built by tools/sculpt/lowring.mjs: a tonsure. The crown shaved clean in
// a round patch (bare skin), a full ring of hair round the head under it: a bowl's straight fringe over the forehead,
// over the ears' tops, level round the back; thick and blunt at its cut. One closed shell. No reference sheet: modelled
// from the description. Angles in degrees from the skull's middle (tools/sculpt/lowhair.mjs skullOf): theta round from
// the front toward the body's left (its right the same, mirrored), phi up from level; lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Monk cut',
  // the hair all the way round
  from: 0,
  // the lower hairline per body, [theta, phi] round the head's left from the front to the back: the fringe cut straight
  // over the forehead, round the temples, over the ear's top, level round the back
  hem: {
    male: [[0, 23], [14, 23], [28, 21.5], [40, 17], [48, 11], [55, 4], [60, -3], [64, -7], [69, -6], [74, -3], [79, 0], [86, 1.5], [93, 1], [99, 1], [104, -3], [111, -9], [122, -15], [140, -19], [160, -21], [180, -21]],
    female: [[0, 27], [14, 27], [28, 26], [39, 22], [47, 14], [53, 4], [57, -5], [61, -10], [66, -10], [71, -7], [76, -5], [83, -4.5], [90, -4.5], [96, -6], [101, -10], [108, -15], [120, -20], [140, -23], [160, -25], [180, -25]],
  },
  // the shaved crown's edge per body, the same way round: a round patch on the top of the head a little toward its back
  crown: {
    male: [[0, 54], [30, 53], [60, 50], [90, 47], [120, 44], [150, 42], [180, 41]],
    female: [[0, 57], [30, 56], [60, 53], [90, 50], [120, 47], [150, 45], [180, 44]],
  },
  crownJog: 0,
  step: 9,
  // the rows down each column from the crown's edge (0) to the hairline (1), and the hair's height off the skin at each:
  // a clean cut at the crown, fuller down to a blunt hem
  rows: [0, 0.16, 0.42, 0.72, 1],
  height: [0.03, 0.055, 0.068, 0.072, 0.064],
  thin: [], taperFrom: 999,
  endFade: 0,
  jitter: 0.18,
  group: [3, 2, 3, 2],
  sink: 0.03, lip: 0.006,
  rimShade: 2, topShade: 2, insideShade: 1,
  show: 0.008, reach: 0,
  // kept clear in every clip's poses at 8 times (tools/sculpt/hairs/dreads-poses-<who>.json, written by
  // tools/sculpt/lowdreadsanim.mjs --write: the body's poses, whatever the hair): the fringe lies on the brow
  poses: 'dreads',
  wisps: { male: [], female: [] },
};
