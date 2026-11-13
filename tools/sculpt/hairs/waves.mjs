// Long waves: the game's 'waves', "Long waves". Built by tools/sculpt/lowwaves.mjs from this description alone (no
// sheet): long loose hair to about the middle of the back, parted a little off the middle (toward her left), in a few
// broad faceted locks, each an S-curve down its length; the front locks over the shoulders onto the chest, either side,
// the rest down the back. Angles in degrees from the skull's middle (th round from the front toward her left, ph up from
// level; her right the same, mirrored); lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Long waves',
  // the lock borders' paths over the skull, her left: at each key (a: 0 the hair's front edge along the hairline, 1 the
  // back's middle) the border's control points from the parting (the first, on the middle line) to where it starts to
  // hang (the last); a border between two keys runs between theirs (tools/sculpt/hairs/warrior.mjs's, a little fuller)
  keys: [
    { a: 0, pts: [[0, 31], [22, 22], [44, 12], [62, 6], [80, 4], [96, 3], [107, -6]] },
    { a: 0.28, pts: [[0, 62], [30, 52], [58, 38], [82, 24], [102, 13], [114, 3], [120, -8]] },
    { a: 0.55, pts: [[0, 92], [64, 76], [104, 56], [124, 38], [134, 20], [140, 5], [143, -9]] },
    { a: 0.8, pts: [[180, 68], [164, 56], [158, 42], [156, 27], [157, 12], [158, 0], [159, -11]] },
    { a: 1, pts: [[180, 56], [180, 45], [180, 34], [180, 22], [180, 10], [180, 0], [180, -11]] },
  ],
  // the parting moved this far toward her left at the forehead (th), less toward the crown and down the sides
  partShift: 13,
  // the locks per side, and their borders' a; the first `front` of them fall forward over the shoulder onto the chest,
  // the rest down the back
  locks: [0, 0.2, 0.4, 0.6, 0.8, 1],
  front: 2,
  // the rows down the skull from the parting to the hang (shares of the path's length)
  capRows: [0, 0.08, 0.27, 0.47, 0.67, 0.85, 1],
  // the hanging rows: the front locks' and the back's, evenly down to their hems
  frontRows: 11, backRows: 15,
  // the front and the back split from the hang's row this many down (above it one sheet over the shoulder's top)
  splitRow: 2,
  // the hems: the back's this far under the chest bone's head (spine_03; mid-back), its middle this much longer; the
  // front's this far under the clavicle's head
  hemBack: 0.1, hemU: 0.18, hemFront: -0.35,
  // where the locks end up round the upright axis through the skull's middle (degrees from the front): the front locks
  // per body from frontAz[0] (the front edge) to frontAz[1] (the arms, the chin bowed to the chest and the bow drawn, kept
  // off them), the back's from backAz to the back's middle; reached over this much
  // of the descent (from the hang's top, smoothed)
  frontAz: { female: [22, 36], male: [16, 30] }, backAz: [126, 180], azOver: [0.25, 1.75],
  // the hair's thickness off the scalp: at the parting, at the hang; the front edge's over the forehead and the temple
  partThick: 0.015, capThick: 0.15, edgeThick: [0.06, 0.09],
  // the hanging hair's thickness (outside to inside), its flare out from the upright axis as it falls (a share), and its
  // tips' thickness
  thick: 0.09, flare: 0.12, tipThick: 0.02,
  // the hang falls free from the head's widest at first, then lies on the body: free above `hug[0]` of the descent, on
  // the body (`clear` off it) from `hug[1]`
  hug: [1.2, 1.9],
  // the waves: each lock swayed sideways `amp` either way (an S down it), `len` a whole wave, from `fade` of the descent
  // full; its ridge out by `bulge` at each wave's crest, the next lock's crest `lockPhase` (radians) on
  wave: { amp: 0.085, len: 1.1, fade: [0.1, 0.7], bulge: 0.03, lockPhase: 1.3 },
  // each lock's tip this much lower than its borders (tipLen, varied by tipVar), its borders this much higher
  tipLen: 0.16, tipVar: 0.35, notch: 0.04,
  // a lock's relief: its ridge out and its borders in, by this much (the hang's, a share of it on the cap)
  relief: 0.04, capRelief: 0.7,
  // each lock's border a crease this far (a) each side of it, in this valley shade; the parting's first row in partShade
  // as far back as partTo
  crease: 0.012, creaseShade: 3, partShade: 3, partTo: 0.6,
  // the inside: sunk this far into the scalp under the cap, this far off the skin where it is not the scalp; the front
  // edge's inside off the skin by lip
  sink: 0.04, clear: 0.035, lip: 0.035, minThick: 0.025,
  // the inside never sunk within this many degrees of skin that is not the scalp (the ears, the nape)
  offScalp: 18,
  // the cap's inside this far off the skin where it is not sunk
  capClear: 0.05,
  // the cap's outside at least this far over every corner of the skin it covers
  cover: 0.02,
  // the forehead's hairline: this far under the head's t0
  hairlineDrop: 0.08,
  // the hanging hair's bones: the head's alone above head[0] of its fall under the skull's middle, those of the skin
  // under it from head[1]; and those of the skin wholly where it comes within `contact` of lying on it
  weights: { head: [0.6, 1.2], contact: 0.3 },
  // the inside's and the cut's shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  insideShade: 1, rimShade: 2,
  // the most a hanging corner is lifted or pressed in out of an arm's way (lowwaves.mjs clearBody)
  armGive: 0.45,
  // in a lock's last this many rows lifted (the lock shortened), pressed in toward the neck above them
  liftRows: 3,
};
