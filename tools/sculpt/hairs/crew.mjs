// The crew cut: the game's 'crew', "Crew cut". Built by tools/sculpt/lowcrew.mjs (no reference sheet: modelled from its
// description): one closed shell of locks over the scalp, running out from the crown's whorl (forward over the top to the
// fringe, down the sides and the back); the top longer and brushed forward to a short ragged fringe just above the
// forehead's hairline, the sides and the back short, tapered to the skin toward the ears and the nape (the fade). Angles in
// degrees, lengths in the body's head units (the skull's radius about 0.85).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Crew cut',
  // the whorl the locks run out from: [theta round from the front toward her left, phi up from level], from the skull's
  // middle
  pole: [180, 64],
  // the hairline, her left (her right mirrored), each point [theta, phi] off the body's own marks (tools/sculpt/lowcrew.mjs
  // hairlineOf): the forehead's (t0) phi less frontDrop at the middle, falling toward the temples; the sideburn in front
  // of the ear down to the ear's top less `sideburn`; over the ear `overEar` above its top; the nape `nape` degrees under
  // level at the back
  frontDrop: 1, temple: [[24, -1.5], [38, -5], [50, -11], [57, -17]], sideburn: 9, sideburnW: 7, overEar: 7, behindEar: 12, nape: -35,
  // (creaseFrom: the creases' shade from this row on, the whorl's rows plain)
  // the locks' borders round the whorl, from the front (0, over the top to the fringe) to the back (180, down to the nape),
  // her left; a ridge between each two (the middle front lock's ridge on the centre line)
  borders: [5, 15, 25, 35, 47, 60, 74, 90, 106, 122, 138, 154, 168, 180],
  // the rows down each lock, from the whorl (0) to the hairline (1); the inside's rows (indices into rows) under them
  rows: [0.1, 0.24, 0.38, 0.52, 0.65, 0.76, 0.85, 0.92, 1],
  innerRows: [2, 5, 7, 8],
  // the hair's height off the skin: the top's at the crown and at the front (brushed forward, fuller toward the fringe);
  // the sides' and the back's; at the hairline of the sides and the back (the fade's end), reached over `fadeDeg` (the
  // back's over `backFade`)
  topBack: 0.06, topFront: 0.085, side: 0.024, back: 0.018, edge: 0.005, fadeDeg: 24, backFade: 45,
  // how much a point is the top rather than the side: its height up the head with `tilt` of its forwardness, from lo
  // (side) to hi (top)
  tilt: 0.35, topLo: 0.65, topHi: 0.85,
  // the fringe: the front locks' tips this far past the hairline (degrees) and this high off the skin; a ridge's tip
  // ragLong further, a border's ragShort less, each tip up to ragJit either way (repeatably)
  fringeOver: 1.5, fringeTip: 0.045, ragLong: 0.6, ragShort: -0.4, ragJit: 1.4,
  // the fringe's last rows: the hair's height eased from the top's to the tip's over these rows from the end
  fringeEase: 2,
  // a lock's relief: its ridge out and its borders in by this share of the hair's height there, at most `relief`
  reliefShare: 0.25, relief: 0.015,
  // the relief's share along the first rows from the whorl (flat there: the locks meet in one point)
  reliefFrom: [0, 0.2, 0.5, 0.8],
  // these borders each a crease this many degrees each side of it, in this valley shade (src/sculpt/gl.ts HAIR_VALLEYS
  // step) where it is more top than side by creaseTop
  creases: [15, 35, 60, 90], valleyHalf: 0.9, creaseShade: 3, creaseTop: 0.45, creaseFrom: 2,
  // the sides' and the back's last band (where the hairline is more side than top by this) in the shaved tone: the fade
  stubbleTop: 0.3,
  // the inside: sunk into the scalp this far; the fringe's tips' inside this far off the forehead
  sink: 0.035, lip: 0.012,
  // the inside's and the cut's shade
  insideShade: 1, rimShade: 2,
};
