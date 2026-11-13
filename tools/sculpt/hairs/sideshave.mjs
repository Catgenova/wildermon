// The side shave: the game's 'sideshave', "Side shave". Built by tools/sculpt/lowsideshave.mjs from this description
// alone (no sheet): the head's left side (the body's left, +x) shaved close in the shaved tone from the temple to behind
// the ear, as the swept back's undercut but on that side only; the rest long, from a deep part along the top of the
// shave swept over the top to fall past the right side of the face (clear of the eye) to below the right shoulder and
// down the back, in faceted locks with tapered ends. Angles in degrees from the skull's middle (th round from the front
// toward the left, ph up from level); a point given as [name, dth, dph] is the direction of the head's vertex of that
// name (tools/sculpt/lowhead.mjs) moved by dth, dph, so the edges sit on each body's own hairline. Lengths in the body's
// head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Side shave',
  // the shaved side: the head's polygons on the left whose corners are all named here (the temple, over and round the
  // ear, behind it down to the nape's side), drawn in the shaved tone
  shave: ['t1', 't2', 't3', 'f2', 'f3', 'f4', 'b4', 'b5', 'e5', 'o6', 'k5', 'n6'],
  // the lock borders' paths, at each key (a: 0 the front edge along the forehead's hairline to the right temple, 1 the
  // back edge down behind the left ear) the border's control points from the part (the first, on the shave's top edge
  // t1-t2-t3) to where it starts to hang (the last); a border between two keys runs between theirs
  keys: [
    { a: 0, pts: [['t1.L', -2, 1], ['t0', 0, 2], ['t1.R', 0, 1], ['f2.R', -2, 2], ['b4.R', 0, 6], ['b4.R', -4, -2], ['b4.R', -6, -9]] },
    { a: 0.16, pts: [['t1.L', 12, 5], [22, 52], [-10, 54], [-42, 44], [-66, 28], [-82, 12], [-90, -6]] },
    { a: 0.34, pts: [['t2.L', -10, 1], [45, 74], [-20, 78], [-80, 58], [-104, 32], [-114, 12], [-118, -8]] },
    { a: 0.52, pts: [['t2.L', 10, -1], [90, 80], [-130, 80], [-136, 54], [-142, 30], [-146, 10], [-148, -9]] },
    { a: 0.7, pts: [['t3.L', -18, 3], [140, 72], [-170, 66], [-172, 44], [-174, 24], [-176, 6], [-177, -10]] },
    { a: 0.86, pts: [['t3.L', -6, 2], [152, 60], [164, 48], [164, 30], [162, 14], [161, 0], [160, -12]] },
    { a: 1, pts: [['t3.L', 0, -1], ['t3.L', -4, -12], ['f4.L', 4, 0], ['f4.L', 6, -10], ['o6.L', 4, 0], ['o6.L', 5, -6], ['o6.L', 6, -12]] },
  ],
  // the locks and their borders' a (narrower over the forehead, where the hair turns down past the face)
  locks: [0, 0.09, 0.19, 0.3, 0.41, 0.52, 0.62, 0.71, 0.8, 0.9, 1],
  // the front locks (falling past the face onto the right shoulder's front) end at this border: the back's hang apart
  // from theirs below the hang's row splitRow
  split: 0.3, splitRow: 3,
  // each column's azimuth at the hem (a, th): the front locks over the right collarbone, the back's down the back
  hemTh: [[0, -34], [0.3, -58], [0.3001, -128], [0.52, -150], [0.7, -178], [0.86, -200], [1, -220]],
  // the azimuth turns from the drop's to the hem's between these heights (shares of the way from the drop to the hem)
  turn: [0.25, 0.62],
  // the rows down the skull from the part to the hang (shares of the path's length) and down the hang to the hem
  capRows: [0, 0.07, 0.22, 0.4, 0.58, 0.76, 0.9, 1],
  hangRows: [0.1, 0.21, 0.32, 0.43, 0.53, 0.63, 0.73, 0.82, 0.91, 1],
  // the hair's thickness off the scalp: at the part, over the top (swept up off the part); the front edge's over the
  // forehead and the temple
  partThick: 0.035, capThick: 0.17, edgeThick: [0.07, 0.1],
  // the hanging hair's thickness, its flare out from the upright axis toward the hem (a share), its tips' thickness
  thick: 0.08, flare: 0.04, tipThick: 0.018,
  // the hem: this far under the shoulder joint (a, dy), each lock's tip this much lower than its borders (tipLen, varied
  // by tipVar), its borders this much higher (the notch between two locks)
  hemAt: [[0, 0.32], [0.3, 0.22], [0.31, 0.12], [0.7, 0.2], [1, 0.06]],
  tipLen: 0.2, tipVar: 0.35, notch: 0.05,
  // the hanging hair's inside this far off the neck, the shoulders, the chest and the back under it (at rest)
  drape: 0.1,
  // the drop's inside off what is under it this far down (the ear)
  dropReach: 0.35,
  // weights: on the head down to wHead under the skull's middle, by wBody under it those of the skin nearest it
  wHead: 0.45, wBody: 1.5,
  // a lock's relief: its ridge out and its borders in, by this much (the hang's, a share of it on the cap)
  relief: 0.045, capRelief: 0.7,
  // each lock's border a crease this far (a) each side of it, in this valley shade; the part's first row in partShade
  crease: 0.01, creaseShade: 3, partShade: 2,
  // the inside: sunk this far into the scalp under the cap, this far off the skin where it is not the scalp (the face,
  // the ears, the neck); the front edge's inside off the skin by lip
  sink: 0.04, clear: 0.03, lip: 0.035, minThick: 0.025,
  // the inside never sunk within this many degrees of skin that is not the scalp (the ears, the nape)
  offScalp: 18,
  // the cap's inside this far off the skin where it is not sunk
  capClear: 0.05,
  // the cap's outside at least this far over every corner of the skin it covers
  cover: 0.02,
  // the forehead's hairline: this far under the head's t0 (the inside stays off the skin below it)
  hairlineDrop: 0.08,
  // the inside's and the cut's shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  insideShade: 1, rimShade: 2,
};
