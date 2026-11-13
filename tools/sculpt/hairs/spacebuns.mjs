// Space buns: the game's 'spacebuns', "Space buns". Built by tools/sculpt/lowspacebuns.mjs (no reference sheet): a centre
// part from the forehead over the crown to the nape; each side's hair from the part and the hairline drawn up into one
// shell of locks to its own bun, high on the head left and right of the crown, above and behind the temple; a faceted
// band where each is tied; on it a round bun of coiled lobes (the top knot's knot, tools/sculpt/hairs/topknot.mjs,
// larger). Angles in degrees: theta round the head from the front (+ the body's left), phi up from the skull's middle;
// lengths in head units on the man (the woman's scaled by her skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Space buns',
  // the hairline on the skin, by the head's azimuth (0 the front, 90 over the ear, 180 the nape; both sides alike): its
  // height as a landmark's plus an offset. front: the forehead's top (lowhead t0); ear: the ear's top; nape: the back of
  // the skull at the brows' level (lowhead bk)
  hairline: [[0, 'front', -0.03], [28, 'front', -0.07], [50, 'front', -0.2], [68, 'ear', 0.17], [84, 'ear', 0.09], [100, 'ear', 0.07], [118, 'ear', -0.02], [145, 'nape', -0.3], [180, 'nape', -0.36]],
  // the part: each side's hair this many degrees off the head's middle plane
  part: 0.9,
  // the left bun's place (theta, phi; the right's mirrored), its axis that share of the way from the skull's normal there
  // to straight up
  bun0: { th: 98, ph: 50, up: 0.3 },
  // each side's locks round its bun: their count (a ridge each, a border between two), spaced evenly along the ring
  // `spaceAt` of the way out from the bun; each border a crease `valleyHalf` degrees each side of it in `creaseShade`
  locks: 11, spaceAt: 0.6, valleyHalf: 1.8, creaseShade: 3,
  // each lock's tip at the hairline: its ridge's end this many degrees past the edge (per |theta| where it ends: none at
  // the forehead's hairline), its borders' tipBack of that short of it; none at the part
  tip: [[0, 0], [30, 0], [60, 2], [90, 3], [180, 3]], tipBack: 0.4,
  // the rows out from the bun to the edge, as shares of the way (the bun's own point at 0); the first ring at the band's
  // foot
  rows: [0, 0.16, 0.36, 0.58, 0.8, 1],
  // the hair's thickness off the skin along the way (from the bun to the edge)
  thick: [[0, 0.075], [0.3, 0.058], [0.65, 0.04], [0.85, 0.028], [1, 0.014]],
  // and that taken this many times by |theta| where the lock ends (drawn up the back, flatter)
  thickBy: [[0, 1], [90, 1], [150, 0.8], [180, 0.75]],
  // the outside stood off the farthest of the skin's corners within this many degrees (the low-poly skull's corners
  // stand out of its faces)
  reach: 5,
  // a lock's relief: its ridge out and its borders in by this share of the thickness, at most `relief`
  reliefShare: 0.4, relief: 0.022,
  // the shell's inside sunk this far into the scalp where it lies on it, the rows out to `sinkTo` of the way; off the
  // skin by `lip` where it does not (toward its edge); the rim (the edge's thickness) in this shade
  sink: 0.04, sinkTo: 0.7, lip: 0.006, rimShade: 2,
  // the band where each bun is tied: its sides, its foot's radius and how far up the bun's axis from the skin, its
  // height, its middle's bulge and its top's narrowing (shares of the radius), in the darkest valley's shade
  band: { sides: 8, r: 0.13, foot: 0.03, h: 0.09, bulge: 0.08, top: 0.94, shade: 1 },
  // each bun: its lobes (the coiled hair, a ridge each and a crease between), its radius across and along its axis, its
  // middle this far above the band's top, its rings (latitude, degrees), each ring turned `twist` degrees on the last
  // (the coil), its ridges out and its creases in by `relief` of the radius, the creases in `creaseShade`
  bun: { lobes: 7, r: 0.25, rv: 0.215, lift: 0.17, lats: [-64, -32, 0, 32, 64], twist: 16, relief: 0.07, creaseShade: 3 },
};
