// The pixie cut: the game's 'pixie', "Pixie cut". Built by tools/sculpt/lowpixie.mjs (no reference sheet: modelled from
// its description): one closed shell of locks over the scalp running out from the crown's whorl, close at the sides and
// tapered to the nape, a little longer on top; the top's locks swept toward her right into a fringe lying diagonally
// across the forehead (high at her left temple, low at her right, above the brows), its locks ending in points. Angles in
// degrees, lengths in the body's head units (the skull's radius about 0.85).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Pixie cut',
  // the whorl the locks run out from: [theta round from the front toward her left, phi up from level], from the skull's
  // middle
  pole: [176, 62],
  // the hairline, her left (her right mirrored), each point [theta, phi] off the body's own marks (lowpixie.mjs
  // hairlineOf): the forehead's (t0) phi less frontDrop at the middle, falling toward the temples; the sideburn in front
  // of the ear down to the ear's top less `sideburn`, `sideburnW` wide; over the ear `overEar` above its top; behind it;
  // the nape's sides `napeSide` and its middle `nape` degrees under level (the taper's point)
  frontDrop: 1, temple: [[24, -1.5], [38, -5], [50, -11], [57, -17]], sideburn: 12, sideburnW: 6, overEar: 6, behindEar: 11,
  napeSide: -28, nape: -54,
  // the fringe's edge over the forehead: per theta its height as a share of the way from the brows' top (0) up to the
  // forehead's hairline (1); where it is under the hairline the locks run on over the forehead to it
  fringe: [[46, 1], [34, 0.8], [18, 0.64], [0, 0.52], [-18, 0.44], [-34, 0.4], [-46, 0.38], [-54, 0.38], [-60, 0.6], [-64, 1.2]],
  // and never nearer the brows' top than this (degrees)
  fringeLow: 9,
  // the locks' borders round the whorl from the front (0) to the back (180) on each side (mirrored); a ridge between each
  // two (the middle front lock's ridge on the centre line)
  borders: [6, 16, 26, 36, 46, 57, 69, 82, 96, 110, 124, 138, 152, 166, 180],
  // these borders each a crease this many degrees each side of it, in this valley shade (src/sculpt/gl.ts HAIR_VALLEYS
  // step) where the lock is more top than side by creaseTop, from row creaseFrom on
  creases: [6, 26, 46, 69, -16, -36, -57], valleyHalf: 1, creaseShade: 3, creaseTop: 0.3, creaseFrom: 3,
  // the sweep: each column's direction round the whorl turned this many degrees toward her right by its end (per start
  // angle, between linearly), along its length by smooth(sweepFrom, 1)
  sweep: [[-180, 0], [-120, -2], [-80, -12], [-40, -30], [0, -45], [40, -38], [80, -16], [120, -3], [180, 0]], sweepFrom: 0.35,
  // the rows down each lock, from the whorl (0) to its end (1); the inside's rows (indices into rows) under them
  rows: [0.1, 0.22, 0.34, 0.46, 0.57, 0.67, 0.76, 0.84, 0.91, 0.96, 1],
  innerRows: [2, 5, 7, 8, 9, 10],
  // the hair's height off the skin: the top's at the crown and toward the front; the sides' and the back's; at the
  // hairline of the sides and the back, reached over `fadeDeg` (the back's over `backFade`)
  topBack: 0.06, topFront: 0.11, side: 0.016, back: 0.02, edge: 0.005, fadeDeg: 20, backFade: 34,
  // how much a point is the top rather than the side: its height up the head with `tilt` of its forwardness, lo to hi
  tilt: 0.35, topLo: 0.45, topHi: 0.88,
  // the fringe over the forehead: its outside this high off the skin at the hairline, easing to `tipH` at its tips; its
  // inside `lip` off the skin
  fringeH: 0.045, tipH: 0.016, lip: 0.01,
  // the fringe's tips: a ridge's this many degrees past the edge, a border's this many short, each up to tipJit either way
  // (repeatably), a few ridges' (by `tipFew`) `tipExtra` further; a tip's length turned toward her right round the whorl
  // by `tipSlant` of it (the points run on across the forehead); the nape's points the same, straight down
  tipLong: 4, tipShort: 1.5, tipJit: 1, tipFew: 0.6, tipExtra: 2, tipSlant: 1.2, napeLong: 5, napeShort: 1,
  // a lock's relief: its ridge out and its borders in by this share of the hair's height there, at most `relief`; flat at
  // the whorl's rows
  reliefShare: 0.3, relief: 0.018, reliefFrom: [0, 0.25, 0.6, 0.85],
  // the sides' last band (more side than top by stubbleTop, theta within stubbleTh) in the shaved tone: the fade
  stubbleTop: 0.3, stubbleTh: [62, 140],
  // the inside: sunk into the scalp this far
  sink: 0.035,
  // the inside's and the cut's shade
  insideShade: 1, rimShade: 2,
};
