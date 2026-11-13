// The high ponytail: the game's 'ponytail', "High ponytail". Built by tools/sculpt/lowponytail.mjs from this description
// alone (no sheet): all the hair drawn back smoothly from the hairline (the forehead, the temples, over and behind the
// ears, the nape) to a band at the back of the crown, the comb lines a few faceted locks; from the band a thick tail of
// faceted locks hanging down the back to about the shoulder blades, swung out away from the neck. Angles in degrees from
// the skull's middle (theta round from the front toward the body's left, phi up from level); lengths in head units on
// the man (the woman's scaled by her skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'High ponytail',
  // the hairline round the head, per body: per |theta| the phi under which there is no hair (the forehead's, along the
  // head's own t0-t1 edge; the temple's; over the ear; behind the ear to the nape, there over the skull's foot, above the
  // skin that moves with the neck)
  edge: {
    male: [[0, 29], [20, 28], [40, 22], [55, 12], [66, 4], [76, -2], [90, -2], [100, -4], [110, -12], [125, -14], [140, -10], [160, -6], [180, -5]],
    female: [[0, 35.5], [20, 33], [40, 25], [55, 12], [66, 0], [76, -8], [90, -9], [100, -10], [110, -14], [125, -12], [140, -9], [160, -8], [180, -8]],
  },
  // the band: where it sits (phi, at the back: theta 180)
  knot: { ph: 36 },
  // the comb lines: the locks round the band (a ridge each, a border between two), spaced evenly along the ring
  // `spaceAt` of the way out from the band, each border moved by up to `jitter` of a lock's width; each border a crease
  // `valleyHalf` degrees each side of it, in the shades of `creaseShade` in turn
  locks: 14, spaceAt: 0.7, jitter: 0.35, valleyHalf: 2, creaseShade: [3, 4, 3, 4, 4, 3, 4],
  // each lock's tip: its ridge's end this many degrees past the hairline (per |theta| where it ends), its borders'
  // tipBack of that short of it
  tip: [[0, 0], [30, 0.5], [60, 1.5], [180, 1.5]], tipBack: 0.3,
  // the rows out from the band to the hairline, as shares of the way (the band's own point at 0)
  rows: [0, 0.14, 0.32, 0.5, 0.67, 0.82, 0.93, 1],
  // the hair's thickness off the skin along the way (from the band to the hairline): drawn back flat
  thick: [[0, 0.08], [0.3, 0.058], [0.7, 0.046], [0.9, 0.038], [1, 0.022]],
  thickBy: [[0, 1], [90, 1], [180, 0.9]],
  // a lock's relief: its ridge out and its borders in by this share of the thickness, at most `relief`
  reliefShare: 0.35, relief: 0.02,
  // the shell's inside sunk this far into the rigid scalp it covers, the rows out to `sinkTo` of the way; off the skin by
  // `lip` where it does not (toward the hairline), `clear` over skin that moves with the neck; the rim in this shade
  sink: 0.04, sinkTo: 0.8, lip: 0.008, clear: 0.03, rimShade: 2,
  // the cap's outside at least `cover` over every point of the skin it covers, and `minGap` outside its inside
  cover: 0.015, minGap: 0.012,
  // the band: its sides, its foot's radius, how far out along its axis from the skin, its height, its middle's bulge and
  // its top's narrowing (shares of the radius), in the darkest valley's shade; its axis this phi at the back
  band: { sides: 8, r: 0.135, foot: 0.02, h: 0.15, bulge: 0.08, top: 0.97, shade: 1, ph: 22 },
  // the tail: its locks round it (a ridge each, a crease between, `creaseShade`), the crease's half width (degrees), the
  // ridges out and the creases in by `relief` of the radius; its section's depth against its width; each ring turned
  // `twist` degrees on the last
  tail: {
    lobes: 8, creaseHalf: 4, relief: 0.13, creaseShade: 3, depth: 0.7, twist: 3,
    // its radius along its length (0 the band's top, 1 the tip)
    r: [[0, 0.11], [0.03, 0.125], [0.08, 0.22], [0.18, 0.3], [0.4, 0.32], [0.65, 0.29], [0.85, 0.24], [1, 0.2]],
    // the rings along it (shares of its length)
    rings: [0, 0.03, 0.08, 0.14, 0.22, 0.32, 0.43, 0.54, 0.65, 0.75, 0.84, 0.92, 0.97],
    // out along the band's axis this far before it falls; its tip this far under the clavicles' joints; the body's back
    // at least `gap` from its surface
    out: 0.35, below: 0.42, gap: 0.08,
    // the locks' tips: a ridge's end this far past the tail's end (varied by tipVar), drawn in to tipIn of the radius, the
    // creases' this far short of it; the end's middle `apex` of the way to the tips
    tipLen: 0.14, tipVar: 0.5, tipBack: 0.12, tipIn: 0.85, apex: 0.1,
    // the weights along it (shares of its length): the head's alone to `head`, shared with the lower neck (neck_01) to
    // `share` of it by `neck`, then from `back` the chest's (spine_03) rising to `chest` by `chestAt`, the rest the lower
    // neck's
    weights: { head: 0.08, neck: 0.4, share: 0.5, back: 0.4, chestAt: 0.85, chest: 0.9 },
  },
};
