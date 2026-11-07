// The swept-back undercut (tools/sculpt/ref/hair-swept-undercut.png): the game's 'swept', "Swept back". Rolls of hair
// stacked up the skull: on the head's right each runs from the point at the back of the skull forward and up along the
// side, across the forehead, and curls up over to the head's left (the viewer's right from the front); on its left each
// runs from under that curl back down the side to the point; the top roll is the quiff, lifted off the forehead and
// curled to the left. The sides and the back below them shaved (the head's own polygons in the shaved tone). Read by
// tools/sculpt/lowhair.mjs (the format is there).
export default {
  // the corners above the roots moved by up to this much (head units), each its own way, so the rolls break into facets
  jitter: 0.04,
  // a roll's cross-section, its upper edge to its lower (its lower edge overhangs, as shingles): the upper root, the
  // broad top plane up to the ridge near the lower edge, the steep underside back to the lower root
  sec: [[-0.5, 0], [-0.22, 0.6], [0.22, 1], [0.47, 0.6], [0.5, 0]],
  // the same turned over, for a roll whose lower edge is on the head's right of its spine
  secR: [[-0.5, 0], [-0.47, 0.6], [-0.22, 1], [0.22, 0.6], [0.5, 0]],
  // the back's: a ridge down the middle
  secC: [[-0.5, 0], [-0.32, 0.72], [0, 1], [0.32, 0.72], [0.5, 0]],
  clumps: [
    // the lowest: from the point at the back along his right side, round the temple, across the forehead, up at his left
    { id: 'low', sec: 'secR', n: 13, path: [[178, -16], [158, -26], [132, -38, 0.01], [95, -58, 0.03], [56, -52, 0.05], [44, -20, 0.07], [46, 16, 0.09], [58, 36, 0.12]], w: [0.3, 0.38, 0.44, 0.48, 0.44, 0.36, 0.36, 0.34], h: [0.04, 0.08, 0.11, 0.15, 0.16, 0.15, 0.16, 0.15], ends: [0.4, 0.4], tipUp: [0, 0.4] },
    // his left side, low: from under the low roll's curl back down the side to the point
    { id: 'side_l', sec: 'secR', n: 10, path: [[46, 44, 0.06], [72, 58, 0.04], [112, 56, 0.02], [132, 38], [158, 26], [178, 16]], w: [0.42, 0.48, 0.48, 0.42, 0.36, 0.3], h: [0.17, 0.16, 0.13, 0.1, 0.07, 0.04], ends: [0.4, 0.4], tipUp: [0.4, 0] },
    // the middle: from the back of the crown along his right, over the forehead's top, curled over to his left
    { id: 'mid', sec: 'secR', n: 12, path: [[172, -9], [150, -18, 0.01], [125, -32, 0.02], [85, -40, 0.06], [60, -22, 0.12], [58, 8, 0.16], [68, 28, 0.16]], w: [0.24, 0.38, 0.46, 0.5, 0.48, 0.46, 0.4], h: [0.04, 0.08, 0.12, 0.18, 0.21, 0.21, 0.18], ends: [0.4, 0.4], tipUp: [0, 0.4] },
    // his left, high: from under the middle roll's curl back along the upper side to the point
    { id: 'mid_l', sec: 'secR', n: 10, path: [[62, 26, 0.12], [95, 38, 0.05], [125, 32, 0.02], [150, 18, 0.01], [172, 9]], w: [0.44, 0.5, 0.48, 0.4, 0.24], h: [0.19, 0.17, 0.12, 0.08, 0.04], ends: [0.4, 0.4], tipUp: [0.4, 0] },
    // the quiff: from the crown forward over the top, lifted off the forehead and curled to his left
    { id: 'quiff', n: 12, path: [[192, 0], [160, -2, 0.02], [120, -8, 0.07], [85, -8, 0.15], [68, 4, 0.22], [72, 18, 0.24]], w: [0.24, 0.4, 0.5, 0.54, 0.52, 0.42], h: [0.04, 0.11, 0.18, 0.22, 0.25, 0.22], ends: [0.4, 0.4], tipUp: [0, 0.4] },
    // the back: a shield from the crown down to the point at the nape the rolls run into, a ridge down its middle
    { id: 'back', sec: 'secC', n: 8, path: [[112, 0, 0.02], [140, 0, 0.02], [168, 0, 0.01], [197, 0]], w: [0.86, 0.84, 0.66, 0.4, 0.2], h: [0.13, 0.14, 0.13, 0.1, 0.07], ends: [0.6, 0.8], tipUp: [0, 0.2] },
  ],
  // the shaved: the temples, the skull's sides above the ears and behind them, the back of the skull down to the nape
  // (and the scalp under the clumps, so a chink between two shows the shave, not skin)
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b3', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
