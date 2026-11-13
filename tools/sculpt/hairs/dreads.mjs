// Dreadlocks to the shoulders from a parted scalp: the game's 'dreads', "Dreads". Built by tools/sculpt/lowdreads.mjs:
// rope locks in two layers over a low cap, each a faceted tube rising out of the scalp at the centre parting, lying
// on the skull to where it leaves the head and hanging from there; the front ones down over the temples, framing the
// face, the rest over the ears' tops, behind them and down the back. Angles in degrees from the skull's middle
// (tools/sculpt/lowhairhull.mjs centreOf): theta round from the front toward her left, phi up from level. Her left as
// written; her right the same, mirrored. Lengths in the body's head units.
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Dreads',
  // the locks in two layers, the inner first (the outer laid over it, `layerGap` further off the skin): per lock its
  // drop [theta `drop`, phi `dropPh`], where it leaves the head and hangs to `tip` under the skull's middle. All combed
  // one way (none across another): a lock's root on the centre parting by its drop's theta (`part`: [drop theta,
  // degrees over the skull from the front], between, evenly), either side of it by the lock's radius and `partAcross`
  // (behind the crown `backAcross`: the two sides' roots meeting over the middle line, no parting down the back).
  // r: the locks' radius; sides: their section's.
  part: [[52, 36], [64, 47], [108, 54], [124, 78], [139, 96], [176, 148]],
  partAcross: 0.012, backAcross: -0.05,
  // the drops: in front of the ear (framing the face), then behind it, the two layers' by turns
  layers: [
    {
      id: 'in', r: 0.072, sides: 5,
      drop: [58, 113, 123, 134, 144, 155, 166],
      dropPh: [4, -8, -10, -12, -12, -12, -12],
      tip: [1.46, 1.6, 1.63, 1.66, 1.68, 1.7, 1.72],
    },
    {
      id: 'out', r: 0.076, sides: 5,
      drop: [52, 64, 108, 118, 128, 139, 150, 160, 171],
      dropPh: [6, 6, -6, -8, -10, -12, -12, -12, -12],
      tip: [1.42, 1.48, 1.58, 1.62, 1.65, 1.67, 1.69, 1.7, 1.7],
    },
  ],
  // on the middle line at the back, once (the inner layer's): root and drop [theta, phi]
  centre: [{ id: 'nape', root: [180, 22], drop: [180, -12], tip: 1.72, r: 0.072, sides: 5, layer: 0 }],
  // the under-layer (tools/sculpt/lowdreads.mjs capOf): small locks lying close over the scalp under the others, a
  // corrugated shell: its columns (ridges and grooves by turns) and rows (at `rowAt` of the way from the crown to the
  // hairline: the last but one close over it, so the edge stands full height to there), each row turned `swirl`
  // degrees on; its height off the skin, a ridge's `ridge` higher and a groove's `groove` lower, its lumps; its
  // hairline's sinking into the skin (under the ears); its grooves' shade; the hairline: [|theta|, phi] (the
  // forehead's, the temple's, the sideburn's, over the ear, behind it, the nape's)
  cap: { cols: 40, rows: 4, rowAt: [0.35, 0.68, 0.9, 1], swirl: 8, off: 0.085, ridge: 0.03, groove: 0.01, lump: 0.01, sink: 0.012, shade: 4, hairline: [[0, 30], [30, 27], [50, 12], [60, -12], [66, -30], [82, -32], [88, -8], [92, 0], [100, 0], [108, -16], [130, -24], [150, -28], [180, -30]] },
  // the tube: each ring turned half a side from the one before (the rope's twist, its facets running diagonally); the
  // rings' spacing over the skull and down the hang; a ring's radius from full down to `pinch` of it (the lock's
  // knots, each ring its own)
  spacing: [0.36, 0.75], pinch: 0.88,
  // the outer layer this far further off the skin than the inner (over the skull and down the hang), eased in over
  // this share of its way over the skull from its root; down the hang only `hangGap` of that (the layers' locks side
  // by side there)
  layerGap: 0.06, layerEase: 0.35, hangGap: 0.3,
  // the section over the skull [across, up] against the radius (the lock lying flatter on the scalp), round down the
  // hang, eased between over this many rings
  flat: [1.1, 0.9], flatEase: 2,
  // the lock's centre over the skull at this share of its radius off the skin; its root (a point) this far under the
  // skin, the lock rising out of it over this share of its way over the skull
  lie: 1, sink: 0.03, rootEase: 0.08,
  // the tip: the last `taper` of the lock narrowed to `tipR` of its radius, its end a blunt cap standing `tipCap` of the
  // radius past the last ring
  taper: 0.3, tipR: 0.62, tipCap: 0.35,
  // the hang: its least gap from the skin beside it and up to `ahead` above, its flare out (head units per unit down),
  // its distance from the drop's eased to that over `easeHang` of its way, its tip at least `shoulder` above the
  // shoulders, the back or the chest under it (the lock shortened), each lock's own sway across (head units, at most),
  // lean out from the head (degrees, at most), and length, longer or shorter (head units, at most)
  gap: 0.03, flare: 0, ahead: 0.3, easeHang: 0.3, shoulder: 0.1, sway: 0.04, lean: 4, length: 0.06,
  // the locks apart where they meet: their centres at least this share of their radii's sum apart
  apart: 1.04,
  // a lock's lift over the one under it spread over this many of its points either side
  spread: 3,
  // a point lifted at most this much in all (where the locks are too many for the room, they press together), the lift
  // eased in over this many of its first points
  liftMost: 0.06, liftEase: 4,
  // the shades (src/sculpt/gl.ts HAIR_VALLEYS step; 0 none): the root's point to its first ring, the facets turned in
  // toward the head, the tip's cut
  rootShade: 0, innerShade: 3, tipShade: 2,
  // a facet turned in: its normal against the way out from the head at most this
  innerDot: -0.35,
  // the scalp: the head's polygons the roots sink into (those the cap covers drawn shaved), as names of their corners (tools/sculpt/lowhead.mjs; tools/sculpt/lowhair.mjs shaveOf)
  scalp: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'o6', 'bk', 'n6'],
  // clearing the body in the clips' poses (tools/sculpt/lowdreads.mjs clearBody): a ring moved out at most `clearMost`,
  // raised (the lock shortened over the shoulders) at most `raiseMost`;
  // below `levelBelow` under the skull's middle a lock moved out level, not straight out from the skull's middle
  clearMost: 0.1, raiseMost: 0.4,
  levelBelow: 0.3,
};
