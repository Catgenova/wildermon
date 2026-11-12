// The bob with blunt bangs (tools/sculpt/ref/hair-bob.png): the game's 'bob', "Bob". Built by tools/sculpt/lowbob.mjs:
// one shell of locks over the hull carved from the sheet's five views, the fringe cut straight over the brows, the sides
// to the jaw, the back to the nape, the ends turned under. Angles in degrees round the head from the front (her left;
// her right the same, mirrored); lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Bob',
  // the hull carved the same both sides (each voxel kept only with its mirror: the sheet's views see one side each);
  // fitPairs: the fit moving each pair of columns together (false: each its own, the sheet's sides as drawn, her right
  // fuller)
  symmetric: true, fitPairs: false,
  // the locks' borders round her left, front to back: the fringe's four across the forehead to the temple, then the
  // side's and the back's
  borders: [0, 12, 24, 36, 46, 66, 88, 110, 132, 156, 180],
  // the fringe's end: the border doubled, the fringe's last lock's a hair before it, the side's first a little after (the
  // hull drops from the temple to the jaw there)
  temple: 46, templeGap: [0.6, 2],
  // where a fringe column's hem is looked for from (phi, degrees up from the skull's middle), down
  fringeFrom: 60,
  // the fringe cut level at the height the hull's fringe ends at within this angle of the front
  fringeMid: 22,
  // the fringe's radius the greatest within this many degrees across (the sheet's parting fills)
  fringeFill: 8,
  // the fringe's cut moved down this far under the hull's (the hull's fringe ends at the highest of the views')
  fringeShift: -0.09,
  // the rows down each column: from the crown (0) to the fringe's cut (1), the same in every column; then on the sides
  // and the back from that level (0) on down to the hem (1)
  rowsTop: [0, 0.3, 0.6, 0.85, 1],
  rowsLow: [0.4, 0.75, 1],
  // a lock's tip: its ridge's hem this many degrees lower than its borders' (the fringe's nearly straight)
  tip: 0, fringeTip: 0, partRise: 0,
  // the fringe's cut: each strand's middle this much lower than its borders (separate blunt strands), the parting this
  // much higher (a narrow split showing the forehead); never lower than the brows' top less browCover
  fringeTipY: 0.018, partRiseY: 0.035, browCover: 0.005,
  // the sides' and the back's hem this far under the hull's (the hull's lower edge is the highest of the views' lock
  // tips), carried straight down
  hemDrop: 0.03,
  // the sides' and the back's hems' heights smoothed along the columns this many passes (the hull's voxels step)
  hemSmooth: 3,
  // a lock's relief: its ridge out and its borders in by this share of the hair's thickness there, at most `relief`
  reliefShare: 0.4, relief: 0.05,
  // the relief's share per row (after the crown): the crown's planes flatter
  reliefRows: [0, 0.6],
  // the ends turned under: the last rows (the hem last) moved in toward the head's upright axis by this much
  curl: [0.02, 0.05],
  // the hair's least thickness off the skin; the hanging curtain's thickness and its inside's clearance off the skin;
  // the inside sunk into the scalp; the hem's inside off the skin
  minThick: 0.03, thick: 0.08, clear: 0.025, sink: 0.04, lip: 0.012,
  // the forehead's hairline under the fringe: this far under the head's t0 (the inside stays off the skin below it)
  hairlineDrop: 0.08,
  // below this far under the skull's middle a corner through the body is moved out level (tools/sculpt/lowbob.mjs
  // clearBody), not down
  levelBelow: 0.3,
  // the inside's and the cut's shade (src/sculpt/gl.ts HAIR_VALLEYS step)
  insideShade: 1, rimShade: 2,
  // the fringe below the hairline a sheet this thick (off the forehead under it)
  fringeSheet: 0.035,
  // each quad two triangles, each its own flat facet
  triFacets: true,
  // a ridge's rows moved this share of the way to the next row (diagonal facets)
  stagger: 0.2,
};
