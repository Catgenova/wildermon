// The crown braid: the game's 'crownbraid', "Crown braid". Built by tools/sculpt/lowcrownbraid.mjs (no reference sheet:
// modelled from its description): the hair combed up from the hairline all round, and in from the crown's whorl, into
// one thick braid wrapped round the head like a circlet, from the forehead's top over the ears' tops to the back; its
// links the side braid's hearts (tools/sculpt/lowbraidbraid.mjs heartAt), each tucked under the one before. Nothing
// hangs. Angles in degrees (theta round the head from the front, + the body's left; phi up from the skull's middle);
// lengths in head units on the man (the woman's scaled by her skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Crown braid',
  // the whorl the hair inside the braid is drawn out from: [theta, phi]
  pole: [180, 80],
  // the hairline (tools/sculpt/lowcrew.mjs hairlineOf, off the body's own marks): the forehead's (t0) phi less frontDrop,
  // the temples, a short sideburn, over the ear, behind it and the nape
  hairline: { frontDrop: 1, temple: [[24, -1.5], [38, -5], [50, -11], [57, -17]], sideburn: 7, sideburnW: 6, overEar: 7, behindEar: 12, nape: -35 },
  // the braid's middle line round the head, off the body's marks: at the front this many degrees above the forehead's
  // hairline (t0); over the ears this many above the ear's top; at the back this many above the ear's top. Between, the
  // front's eased to the side's along `toSide` (|theta| 0..90), the side's to the back's along `toBack` (90..180)
  ring: { front: 12, side: 15, back: 17, toSide: [[0, 0], [25, 0.1], [50, 0.5], [70, 0.88], [90, 1]], toBack: [[90, 0], [120, 0.25], [180, 1]] },
  // the braid: its links (hearts) round the ring, their width across, their depth (a share of the width), their length
  // `stretch` times the spacing (each tucked under the one before), each link's top sunk and its point raised by `tilt`
  // of its depth (the tuck), its middle line `lift` of its depth over the combed hair
  braid: { links: 20, w: 0.27, depth: 0.5, stretch: 1.25, tilt: 0.45, lift: 0.6 },
  // the combed hair under it: the locks round the whorl (a ridge each, a border between two as a crease `valleyHalf`
  // degrees each side of it in `creaseShade`), the rows from the whorl to the braid's line and from it to the hairline
  // (shares of the way)
  // (the creases from this row out, the whorl's first rows plain)
  locks: 12, valleyHalf: 1.6, creaseShade: 3, creaseFrom: 1,
  innerRows: [0.18, 0.42, 0.66, 0.86, 1], outerRows: [0.3, 0.6, 0.85, 1],
  // the hair's height off the skin: at the whorl, at the braid, at the hairline (the outer band thinning toward it)
  thick: { pole: 0.05, ring: 0.042, edge: 0.007 },
  // a lock's relief: its ridge out and its borders in by this share of the height, at most `relief`
  reliefShare: 0.35, relief: 0.016,
  // the skull's corners kept at least this far under the comb's outside (its facets are chords between its rows)
  over: 0.02,
  // the shell's inside sunk into the scalp this far; its inside's and its edge's shades
  sink: 0.035, insideShade: 1, rimShade: 2,
};
