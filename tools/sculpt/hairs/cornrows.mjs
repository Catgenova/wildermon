// Cornrows: the game's 'cornrows', "Cornrows". Built by tools/sculpt/lowcornrows.mjs: rows of flat plaits lying on the
// scalp from the forehead's hairline straight back over the crown to the nape, each a chain of links (a flattened
// version of the side braid's hearts, tools/sculpt/lowbraidbraid.mjs heartAt: two lobes over a point, the point toward
// the nape, each link's top tucked under the one before), the parts between the rows the scalp in the shaved tone.
// Angles in degrees on the skull (tools/sculpt/lowhair.mjs dirOf): over, about the head's left-right axis from straight
// ahead at the skull's centre (90 straight up, 180 straight back); out, toward the head's left. Lengths in the male
// skull's head units (scaled by each body's skull, k).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Cornrows',
  // the rows, her right to her left: each its out at the crown (over 90), the over it starts at (the forehead's
  // hairline) and ends at (the nape), and its out at the front and the back ends (the side rows bend down behind the
  // ears); the rows on the head's right mirrored from the left's
  rows: [
    { out: 0, from: 26, to: 214 },
    { out: 18, from: 27, to: 213, front: 17, back: 17 },
    { out: 36, from: 31, to: 210, front: 35, back: 33 },
    { out: 54, from: 40, to: 205, front: 55, back: 47 },
  ],
  // a link: its width across the row, its length along it, how far along the row the next link starts (less than the
  // length: each link's top tucked under the one before), its lobes' height off the skin, the crease's and the notch's
  // share of it, how far its rim is sunk into the skin; the lobes' peaks across and along it (tools/sculpt/lowcornrows.mjs
  // RIM); the notch's and the crease's valley shade (src/sculpt/gl.ts HAIR_VALLEYS step, the darkest 1)
  width: 0.18, length: 0.17, pitch: 0.115, height: 0.045, crease: 0.85, notch: 0.6, sink: 0.015,
  lobe: [0.2, 0.38], shades: [2, 4],
  // the first link's and the last link's width and height as a share of the rest (the row tapering at its ends)
  taper: [0.75, 0.7],
  // the parts: a cap over the scalp in the shaved tone, this many degrees past the outermost rows' middles and past the
  // rows' ends, this far off the skin (where it would pass through unshaved skin between two of the skull's facets at
  // the hairline, raised capStep at a time until it does not, by capMax at most), in this many quads from the forehead
  // to the nape
  capOut: 9, capEnd: 2, capLift: 0.008, capStep: 0.003, capMax: 0.012, capAlong: 18,
};
