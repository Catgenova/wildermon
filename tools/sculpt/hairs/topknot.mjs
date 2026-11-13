// The undercut top knot: the game's 'topknot', "Top knot". Built by tools/sculpt/lowtopknot.mjs (no reference sheet):
// the sides and the back shaved close (the swept back's shave and buzz, tools/sculpt/hairs/swept.mjs), the long hair on
// top combed from the hairline over the crown into one shell of locks that meet under a band at the crown, and a small
// rounded knot tied on it there. Angles in degrees: theta round the head from the front (+ the body's left), phi up from
// the skull's middle; lengths in head units on the man (the woman's scaled by her skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Top knot',
  // the hair's edge round the head, per body: per |theta| the phi under which the head is shaved (the front's the
  // forehead's hairline, along the head's own t0-t1 edge; the sides' the undercut's line above the temple; the back's
  // under the crown)
  edge: {
    male: [[0, 29], [20, 30.5], [40, 33], [60, 37], [90, 40], [120, 40], [150, 37], [180, 35]],
    female: [[0, 35.5], [25, 35], [45, 36], [60, 38], [90, 40], [120, 40], [150, 37], [180, 35]],
  },
  // the knot: where it sits (phi, at the back: theta 180), its axis that share of the way from the skull's normal there to
  // straight up
  knot: { ph: 66, up: 0.45 },
  // the locks round the knot: their count (a ridge each, a border between two), spaced evenly along the ring `spaceAt`
  // of the way out from the knot; each border a crease `valleyHalf` degrees each side of it in `creaseShade`
  locks: 12, spaceAt: 0.75, valleyHalf: 2.2, creaseShade: 3,
  // each lock's tip: its ridge's end this many degrees past the edge (per |theta| where it ends: none at the forehead's
  // hairline), its borders' tipBack of that short of it
  tip: [[0, 0], [30, 0], [60, 2.5], [90, 3.5], [180, 3.5]], tipBack: 0.4,
  // the rows out from the knot to the edge, as shares of the way (the knot's own point at 0); the first ring at the
  // band's foot
  rows: [0, 0.2, 0.42, 0.64, 0.84, 1],
  // the hair's thickness off the skin along the way (from the knot to the edge)
  thick: [[0, 0.1], [0.3, 0.085], [0.65, 0.062], [0.85, 0.04], [1, 0.018]],
  // and that taken this many times by |theta| where the lock ends (the hair combed up the back to the knot lies flatter)
  thickBy: [[0, 1], [60, 1], [120, 0.75], [180, 0.6]],
  // a lock's relief: its ridge out and its borders in by this share of the thickness, at most `relief`
  reliefShare: 0.4, relief: 0.026,
  // the shell's inside sunk this far into the scalp where it lies on it, the rows out to `sinkTo` of the way; off the
  // skin by `lip` where it does not (toward its edge); the rim (the edge's thickness) in this shade
  sink: 0.04, sinkTo: 0.7, lip: 0.006, rimShade: 2,
  // the band where the knot is tied: its sides, its foot's radius and how far up the knot's axis from the skin, its
  // height, its middle's bulge and its top's narrowing (shares of the radius), in the darkest valley's shade
  band: { sides: 8, r: 0.14, foot: 0.03, h: 0.13, bulge: 0.06, top: 0.94, shade: 1 },
  // the knot: its lobes (the coiled hair, a ridge each and a crease between), its radius across and along its axis, its
  // middle this far above the band's top, its rings (latitude, degrees), each ring turned `twist` degrees on the last
  // (the coil), its ridges out and its creases in by `relief` of the radius, the creases in `creaseShade`
  bun: { lobes: 6, r: 0.235, rv: 0.19, lift: 0.17, lats: [-62, -28, 8, 42, 70], twist: 14, relief: 0.07, creaseShade: 3 },
  // the undercut: the swept back's buzz forward of the shave to the sideburn, and its shaved polygons
  buzz: { lean: 0.25, drop: 0.03 },
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f3', 'f4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
