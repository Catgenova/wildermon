// The pompadour: the game's 'pompadour', "Pompadour". Built by tools/sculpt/lowpomp.mjs (no reference sheet: modelled
// from the description): short tapered sides and back, the front swept up high off the forehead and back over the top
// in a tall rounded quiff that rolls back toward the crown, its locks faceted along the sweep. One shell of locks
// radiating from the crown's whorl over the skull, its thickness off the skin the taper's plus the quiff's; the sides
// and the back below the shell's hem shaved (the head's own polygons in the shaved tone), the temples forward of that
// buzzed to the sideburn. Angles in degrees; lengths in the male skull's head units (scaled by each skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Pompadour',
  // the crown's whorl, where the locks meet: this far round over the head from the front (lowhairhull.mjs angOf over)
  whorl: 118,
  // the locks' borders round the whorl from the front toward the head's left (mirrored to its right): narrow over the
  // forehead (the quiff), wide down the sides and the back
  borders: [8, 24, 40, 58, 84, 112, 146, 180],
  // the rows from the whorl (0) to the hem (1): closer toward the hem, where the quiff's front turns
  rows: [0, 0.2, 0.38, 0.53, 0.66, 0.77, 0.86, 0.93, 0.98, 1],
  // the shell's hem round the head (theta round from the front, phi up from the skull's middle): through the forehead's
  // hairline (the head's t0, t1, phi `front` above them), the temple's corner (f2, `temple` above), then fixed points over
  // the ear and down the back
  front: 2, temple: 4,
  // (the hem kept this many degrees short of the shaved polygons' edge)
  edge: 2,
  hem: [[90, 14], [125, 7], [155, 0], [180, -3]],
  // the taper: the thickness off the skin at the hem, at the top of the sides, and the rise between (degrees of phi over
  // the hem)
  taper: { hem: 0.018, top: 0.048, rise: 38 },
  // the quiff: its greatest thickness off the skin; across (out, degrees from the middle) full within `full`, gone by
  // `edge`; along the sweep (over, degrees back from the forehead's hairline) per control point its share of the height
  quiff: {
    height: 0.36, full: 18, edge: 46,
    along: [[0, 0.15], [4, 0.55], [10, 0.9], [18, 1], [30, 0.9], [48, 0.6], [70, 0.3], [92, 0.1], [110, 0]],
    // the quiff's front leaned forward over the forehead: a corner within `reach` degrees of the hairline moved forward
    // (head units at the peak's height) by this much
    lean: 0.08, reach: 30,
  },
  // a lock's relief: its ridge out and its borders in by this share of the hair's thickness, at most `relief`; the
  // relief's share per row from the whorl (the whorl's rows flat)
  reliefShare: 0.2, relief: 0.045, reliefRows: [0, 0, 0.15, 0.4, 0.7],
  // each lock's border a crease this many degrees each side of it, in this valley shade
  valleyHalf: 1.2, creaseShade: 3,
  // the creases from this row on (the whorl's rows plain)
  creaseFrom: 3,
  // a ridge's rows moved this share of the way to the next row (the facets run diagonally along the sweep), within
  // `staggerFront` degrees of the front
  stagger: 0.3, staggerFront: 60,
  // the shell's inside: sunk this far into the scalp; the hem's rim in this valley shade, the inside in this
  rimShade: 2, insideShade: 1, sink: 0.04, minThick: 0.02,
  // the shell laid over the skin's radius averaged within this many degrees of each ray (the skull's folds smoothed)
  soft: 8,
  // the temples forward of the shave buzzed as far as the sideburn's line (tools/sculpt/lowhair.mjs buzzOf)
  buzz: { lean: 0.25, drop: 0.03 },
  // the head's own polygons drawn in the shaved tone (by their corners' names, tools/sculpt/lowhair.mjs shaveOf): the
  // scalp, the temples, the sides round the ears and the back down to the nape (the hem kept on them)
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
