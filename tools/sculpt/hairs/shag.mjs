// The curtain-fringe shag: the game's 'shag', "Shag". Built by tools/sculpt/lowshag.mjs from this description alone (no
// sheet): parted in the middle, a curtain fringe swept from the parting down and out over the brow ends on either side,
// the sides falling over the ears; choppy layers, shorter on the crown and the sides, longest at the back (to the
// shoulders), each layer's ends flicked outward (at the cheekbone, at the jaw, at the shoulders) over a step in to the
// layer under it; faceted, piecey locks with pointed ends of uneven length. Angles in degrees from the skull's middle
// (th round from the front toward her left, ph up from level; her right the same, mirrored); lengths in the body's head
// units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Shag',
  // the lock borders' paths over the skull, her left: at each key (a: 0 the hair's front edge, the curtain fringe's, 1
  // the back's middle) the border's control points from the parting (the first, on the middle line) to where it starts
  // to hang (the last); a border between two keys runs between theirs. The front edge: from the parting's foot on the
  // forehead down and out across the brow's end to the temple, then in front of the ear.
  keys: [
    { a: 0, pts: [[0, 30], [7, 19], [17, 11], [30, 5], [43, -1], [57, -7], [69, -13]] },
    { a: 0.14, pts: [[0, 48], [18, 39], [36, 27], [54, 15], [68, 5], [78, -4], [84, -12]] },
    { a: 0.3, pts: [[0, 66], [32, 56], [58, 42], [80, 28], [98, 15], [108, 2], [112, -10]] },
    { a: 0.55, pts: [[0, 92], [64, 76], [104, 56], [124, 38], [134, 20], [140, 5], [143, -9]] },
    { a: 0.8, pts: [[180, 68], [164, 56], [158, 42], [156, 27], [157, 12], [158, 0], [159, -11]] },
    { a: 1, pts: [[180, 56], [180, 45], [180, 34], [180, 22], [180, 10], [180, 0], [180, -11]] },
  ],
  // the locks per side, and their borders' a (the fringe's two narrowest)
  locks: [0, 0.07, 0.15, 0.29, 0.44, 0.6, 0.78, 1],
  // the rows down the skull from the parting to the hang (shares of the path's length)
  capRows: [0, 0.08, 0.27, 0.47, 0.67, 0.85, 1],
  // the rows down the hang (s: shares of the way from the hang's top to the column's hem), by layer: each layer's
  // body, the flick starting (pre), its end (tip: flicked `out` from the hair's line), the step in under it (ledge);
  // `out` added to the hair's line there (the step's negative). A tip's, a pre's and a ledge's height moved with the
  // lock's tip (tipLen, notch per layer; the pre's by `shift`)
  hang: [
    { s: 0.1, out: 0.02, layer: 0, pre: true, shift: 0.5 },
    { s: 0.2, out: 0.1, layer: 0, tip: true },
    { s: 0.2, out: -0.03, layer: 0, ledge: true },
    { s: 0.36, out: 0.02, layer: 1, pre: true, shift: 0.5 },
    { s: 0.46, out: 0.13, layer: 1, tip: true },
    { s: 0.46, out: -0.04, layer: 1, ledge: true },
    { s: 0.66, out: -0.01 },
    { s: 0.86, out: 0.03, layer: 2, pre: true, shift: 0.5 },
    { s: 1, out: 0.14, layer: 2, tip: true, hem: true },
  ],
  // each layer's ridge tip this much lower than its borders' line (varied by tipVar), its borders this much higher; a
  // layer's rows moved up or down by up to layerVar (a share of the hang) per lock; a tip's flick at a border this share
  // of the ridge's
  tipLen: [0.18, 0.24, 0.26], tipVar: 0.5, notch: [0.04, 0.05, 0.06], layerVar: 0.05, borderFlick: 0.6,
  // a ledge this far under its tip; rows at least this far apart down a column
  ledgeDrop: 0.035, rowGap: 0.012,
  // the hair's thickness off the scalp: at the parting, at the hang; the front edge's over the forehead and the temple
  partThick: 0.015, capThick: 0.12, edgeThick: [0.08, 0.11],
  // the hanging hair's thickness (outside to inside), its flare out from the upright axis toward the hem (a share), and
  // its tips' thickness at the hem
  thick: 0.09, flare: 0.03, tipThick: 0.018,
  // the face-framing locks (the front edge's to sideOutTo[0], easing off by sideOutTo[1]) this much further out from
  // the upright axis as they fall (over the ears)
  sideOut: 0.06, sideOutTo: [0.07, 0.22],
  // the hem: this far over the top of the shoulders (the torso's highest point under the hanging hair) at the back; the
  // sides' sideRise higher, from the front edge to sideTo, easing to the back's by backFrom (a)
  hemAbove: 0.08, sideRise: 0.3, sideTo: 0.15, backFrom: 0.78,
  // and no end nearer the torso under it than this (the head turns and nods in the clips)
  tipClear: 0.06,
  // the hem's level taken from the locks from this a on (the back's)
  hemFrom: 0.6,
  // a lock's relief: its ridge out and its borders in, by this much (the hang's, a share of it on the cap)
  relief: 0.045, capRelief: 0.7,
  // each lock's border a crease this far (a) each side of it, in this valley shade; the parting's first row in partShade
  // as far back as partTo (behind it the crown, where the locks fan out); a layer's step under its tip in stepShade, the
  // layer under it just below the step in underShade
  crease: 0.012, creaseShade: 3, partShade: 3, partTo: 0.6, stepShade: 2, underShade: 0,
  // the inside: sunk this far into the scalp under the cap, this far off the skin where it is not the scalp (the face,
  // the ears, the neck); the hem's and the front edge's inside off the skin by lip
  sink: 0.04, clear: 0.025, lip: 0.035, minThick: 0.025,
  // the inside never sunk within this many degrees of skin that is not the scalp (the ears, the nape); off the skin's
  // greatest radius within `wide` degrees of it where it is not sunk
  offScalp: 18, wide: 7,
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
