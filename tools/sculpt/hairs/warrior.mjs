// The shoulder-length warrior cut: the game's 'warrior', "Shoulder length". Built by tools/sculpt/lowwarrior.mjs from
// this description alone (no sheet): straight hair parted in the middle, combed down each side from the parting, tucked
// behind the ears, the back hanging straight to the shoulders, in faceted long locks with tapered ends. Angles in degrees
// from the skull's middle (th round from the front toward her left, ph up from level; her right the same, mirrored);
// lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Shoulder length',
  // the lock borders' paths over the skull, her left: at each key (a: 0 the hair's front edge along the hairline, 1 the
  // back's middle) the border's control points from the parting (the first, on the middle line) to where it starts to
  // hang (the last); a border between two keys runs between theirs. th 180 with ph over 0 is the back's middle line
  // over the top (the crown).
  keys: [
    { a: 0, pts: [[0, 31], [22, 22], [44, 12], [62, 6], [80, 4], [96, 3], [107, -6]] },
    { a: 0.28, pts: [[0, 62], [30, 52], [58, 38], [82, 24], [102, 13], [114, 3], [120, -8]] },
    { a: 0.55, pts: [[0, 92], [64, 76], [104, 56], [124, 38], [134, 20], [140, 5], [143, -9]] },
    { a: 0.8, pts: [[180, 68], [164, 56], [158, 42], [156, 27], [157, 12], [158, 0], [159, -11]] },
    { a: 1, pts: [[180, 56], [180, 45], [180, 34], [180, 22], [180, 10], [180, 0], [180, -11]] },
  ],
  // the locks per side, and their borders' a (the front ones narrower: they curve round the temple)
  locks: [0, 0.12, 0.26, 0.41, 0.56, 0.71, 0.86, 1],
  // the rows down the skull from the parting to the hang (shares of the path's length) and down the hang to the hem
  capRows: [0, 0.08, 0.27, 0.47, 0.67, 0.85, 1],
  hangRows: [0.3, 0.62, 0.88, 1],
  // the hair's thickness off the scalp: at the parting, at the hang; the front edge's over the forehead and the temple
  partThick: 0.015, capThick: 0.11, edgeThick: [0.06, 0.09],
  // the hanging hair's thickness (outside to inside), its flare out from the upright axis toward the hem (a share), and
  // its tips' thickness
  thick: 0.085, flare: 0.05, tipThick: 0.018,
  // the hem: this far over the top of the shoulders (the torso's highest point under the hanging hair), each lock's tip
  // this much lower than its borders (tipLen, varied by tipVar), its borders this much higher (the notch between two locks)
  hemAbove: 0.08, tipLen: 0.2, tipVar: 0.35, notch: 0.05,
  // and no end nearer the torso under it than this (the head turns and nods in the clips)
  tipClear: 0.06,
  // the hem's level taken from the locks from this a on (the back's)
  hemFrom: 0.5,
  // a lock's relief: its ridge out and its borders in, by this much (the hang's, a share of it on the cap)
  relief: 0.045, capRelief: 0.7,
  // each lock's border a crease this far (a) each side of it, in this valley shade; the parting's first row in partShade
  // as far back as partTo (behind it the crown, where the locks fan out)
  crease: 0.012, creaseShade: 3, partShade: 3, partTo: 0.6,
  // the inside: sunk this far into the scalp under the cap, this far off the skin where it is not the scalp (the face,
  // the ears, the neck); the hem's and the front edge's inside off the skin by lip
  sink: 0.04, clear: 0.025, lip: 0.035, minThick: 0.025,
  // the inside never sunk within this many degrees of skin that is not the scalp (the ears, the nape)
  offScalp: 18,
  // the cap's inside this far off the skin where it is not sunk (the skull's creases between its corners)
  capClear: 0.05,
  // the cap's outside at least this far over every corner of the skin it covers
  cover: 0.02,
  // the forehead's hairline: this far under the head's t0 (the inside stays off the skin below it)
  hairlineDrop: 0.08,
  // below this far under the skull's middle a corner through the body is moved out level (clearBody), not along its ray
  levelBelow: 0.3,
  // the inside's and the cut's shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  insideShade: 1, rimShade: 2,
};
