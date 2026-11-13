// The buzz cut: the game's 'buzz', "Buzz cut". Built by tools/sculpt/lowbuzz.mjs: hair clipped short and even all over,
// one thin closed shell hugging the skull from a clean hairline (the forehead, the temples, a short sideburn, round the
// ears, the nape), a little thicker over the top than on the sides, its outside broken into a few flat planes. No
// reference sheet: modelled from the description. Angles in degrees from the skull's middle (tools/sculpt/lowhair.mjs
// skullOf): theta round from the front toward the body's left (its right the same, mirrored), phi up from level;
// lengths in the body's head units (the head two tall).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Buzz cut',
  // the hairline per body: [theta, phi] round the head's left from the front to the back, each a column of the shell
  // (the forehead's line just above the head's t0, the temple's corner, the sideburn down in front of the ear, over the
  // ear's top, down behind it, the nape level with the ear's lower half)
  hem: {
    male: [[0, 31], [12, 31], [24, 30.5], [34, 28], [43, 23], [50, 15], [56, 5], [60, -6], [63, -14], [67, -15], [70, -11], [74, -5], [79, 0], [86, 1.5], [93, 1], [99, 1], [104, -4], [110, -16], [118, -27], [130, -34], [143, -37], [161, -39], [180, -39]],
    female: [[0, 37], [12, 37], [24, 36], [33, 33], [42, 26], [49, 16], [54, 4], [57, -8], [60, -17], [64, -19], [67, -16], [71, -10], [76, -6], [83, -4.5], [90, -4.5], [96, -6], [101, -12], [107, -24], [115, -32], [128, -38], [141, -40], [160, -42], [180, -42]],
  },
  // the level rows the shell's columns run through above their hems (phi), the crown a point over them; a row closer
  // than `rowGap` above a column's hem is left out of it
  rows: [68, 50, 32, 13, -7, -23, -33], rowGap: 6,
  // the taper: a narrow band over the hairline `taper` degrees tall, drawn in the shaved scalp's tone (the clippers'
  // fade) on the sides and the back (|theta| over `taperFrom`); at the front the hairline stays a clean edge
  taper: 7, taperFrom: 48,
  // the hair's height off the skin: `top` over the crown (phi over topAt[1]), `side` low on the sides and the back (phi
  // under topAt[0]), between them eased; at the hairline `edge` (the front's) and `edgeTaper` (the faded sides')
  top: 0.04, side: 0.026, topAt: [0, 55], edge: 0.02, edgeTaper: 0.008,
  // each outer corner's height moved by up to this share of it (repeatably, its own way): the planes tilt apart
  jitter: 0.3,
  // the outside's planes: each band between two rows its quads joined `group` columns at a time (per band from the
  // crown's down; the next band's joins staggered by half), each join one flat-lit facet; the crown's cap in
  // `crownPlanes` planes; each row's corners up or down by up to `jog` degrees, so the bands' edges zigzag
  group: [4, 3, 2], crownPlanes: 4, jog: 3,
  // the skin under a corner taken as far out along its ray as any of the skull's own corners within this many degrees
  // of it stands (the shell's faces pass over the skull's corners between its own)
  reach: 0,
  // the inside: sunk this far into the scalp where the skin under it is covered whole; elsewhere (the forehead, the
  // temples, the nape's skin that bends with the neck) `lip` off the skin
  sink: 0.03, lip: 0.003,
  // the rim (the hairline's cut, the shell's thickness there) in this valley shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  rimShade: 2, insideShade: 1,
  // the least the outside stands off the skin anywhere over it (the skin's facets under the shell's)
  show: 0.008,
};
