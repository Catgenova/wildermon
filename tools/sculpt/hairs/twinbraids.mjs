// The twin braids: the game's 'twinbraids', "Twin braids". Built by tools/sculpt/lowtwinbraids.mjs from this description
// alone (no sheet): a centre part from the forehead to the nape, the hair combed down either side and behind the ears to
// a gather below each ear, there plaited; each plait hangs in front of the shoulder onto the upper chest and ends in a
// small band and a short tuft. Angles in degrees from the skull's middle (th round from the front toward her left, ph up
// from level; her right the same, mirrored); lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Twin braids',
  // the parting: down the middle line from the forehead's hairline (degrees over the front, from level) over the crown to
  // the nape (past the back's level)
  part: [31, 222],
  // the gather on her left, where the plait starts: its direction (th, ph), the ring the combed hair ends on round it
  // (r degrees), the ring's side each border reaches it from (psi, degrees round it from the back toward the crown: the
  // front edge's first, the nape's last), and the hair's thickness there
  gather: { th: 122, ph: -56, r: 13, psi: [150, -10], thick: 0.1 },
  // the front edge's path between the parting and the gather (behind the ear), and over what share of the borders (a)
  // the others leave its curve for the straight way to the gather (the great circle)
  front: [[24, 21], [52, 9], [80, 5], [100, -4], [110, -24]],
  frontBlend: 0.4,
  // the locks per side, their borders' a (0 the front edge, 1 the nape's edge)
  locks: [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.8, 1],
  // the rows from the parting to the gather (shares of each border's length)
  capRows: [0, 0.015, 0.14, 0.31, 0.49, 0.67, 0.84, 1],
  // the hair's thickness off the scalp: at the parting, over the skull; the edges'
  partThick: 0.015, capThick: 0.06, edgeThick: 0.05,
  // a lock's relief: its ridge out and its borders in, by this much
  relief: 0.022,
  // each lock's border a crease this far (a) each side of it, in this valley shade; the parting's first row in partShade
  crease: 0.012, creaseShade: 3, partShade: 3,
  // the inside: sunk this far into the scalp, this far off the skin where it is not the scalp; the edges' inside off the
  // skin by lip; the least thickness
  sink: 0.04, lip: 0.03, minThick: 0.025, capClear: 0.04,
  // the inside never sunk within this many degrees of skin that is not the scalp (the ears, the nape)
  offScalp: 14,
  // the outside at least this far over every corner of the skin it covers
  cover: 0.02,
  // the forehead's hairline: this far under the head's t0
  hairlineDrop: 0.08,
  // the inside's and the cut's shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  insideShade: 1, rimShade: 2,
  // the plaits (her left; her right mirrored), per body (with its own gather where it says): from the gather (lift past
  // the ring's hair) down beside the neck (`neck`: [x, y, z] brought in toward the neck until it meets it), over the
  // shoulder (`shoulder`: [x, z] let down onto it) and down the front (`chest`: [x, y] each brought back onto the chest), each that far off the skin past the link's
  // back (gap); `n` links, the first `first` times as wide, each `width` wide tapering to `end` of it, `depth` of the
  // width deep, `stretch` its length against its spacing (each tucked under the one above); the band and the tuft past the
  // last link (lengths and widths), the band in a valley's shade
  plait: {
    female: { neck: [0.6, 0.12, -0.22], shoulder: [0.62, -0.02], chest: [[0.6, -0.55], [0.58, -0.88]], n: 10, gap: 0.045 },
    male: { gather: { th: 118, ph: -47 }, neck: [0.82, 0.14, -0.18], shoulder: [0.76, 0.04], chest: [[0.64, -0.45], [0.6, -0.8]], n: 10, gap: 0.045 },
    // (and no spine point moved further than maxMove off where it was laid, keeping it off the body in the clips)
    maxMove: 0.25,
    lift: 0.04, width: 0.3, first: 1.3, end: 0.8, depth: 0.42, stretch: 1.3, front: 0.3,
    band: { len: 0.05, w: 0.6 }, tuft: { len: 0.13, w: 0.9 }, bandShade: 2,
  },
};
