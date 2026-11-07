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
  clumps: [
    // the lowest: from the point at the back along his right side, round the temple, across the forehead, up at his left
    { id: 'low', sec: 'secR', n: 13, path: [[194, -0.5], [166, -12], [135, -36, 0.01], [95, -58, 0.03], [52, -54, 0.04], [37, -20, 0.04], [38, 18, 0.05], [52, 38, 0.09]], w: [0.32, 0.4, 0.48, 0.5, 0.48, 0.42, 0.42, 0.38], h: [0.08, 0.13, 0.16, 0.17, 0.16, 0.14, 0.15, 0.15], ends: [0.5, 0.4], tipUp: [0.1, 0.4] },
    // his left side, low: from under the low roll's curl back down the side to the point
    { id: 'side_l', sec: 'secR', n: 10, path: [[40, 46, 0.03], [72, 60, 0.03], [120, 56, 0.02], [135, 36], [166, 12], [194, 0.5]], w: [0.46, 0.52, 0.5, 0.44, 0.4, 0.32], h: [0.17, 0.18, 0.16, 0.14, 0.11, 0.08], ends: [0.4, 0.5], tipUp: [0.4, 0.1] },
    // the middle: from the back of the crown along his right, over the forehead's top, curled over to his left
    { id: 'mid', sec: 'secR', n: 12, path: [[185, -0.5], [145, -34, 0.02], [85, -40, 0.05], [55, -22, 0.09], [52, 8, 0.12], [64, 30, 0.12]], w: [0.42, 0.48, 0.5, 0.5, 0.48, 0.4], h: [0.1, 0.16, 0.19, 0.2, 0.2, 0.17], ends: [0.5, 0.4], tipUp: [0.1, 0.4] },
    // his left, high: from under the middle roll's curl back along the upper side to the point
    { id: 'mid_l', sec: 'secR', n: 10, path: [[58, 26, 0.08], [95, 38, 0.05], [145, 32, 0.02], [185, 0.5]], w: [0.46, 0.5, 0.48, 0.42], h: [0.19, 0.18, 0.15, 0.1], ends: [0.4, 0.5], tipUp: [0.4, 0.1] },
    // the quiff: from the crown forward over the top, lifted off the forehead and curled to his left
    { id: 'quiff', n: 10, path: [[176, 0], [125, -8, 0.05], [80, -8, 0.12], [62, 4, 0.16], [66, 18, 0.17]], w: [0.4, 0.5, 0.54, 0.52, 0.42], h: [0.1, 0.18, 0.22, 0.24, 0.2], ends: [0.6, 0.4], tipUp: [0.1, 0.4] },
  ],
  // the shaved: the temples, the skull's sides above the ears and behind them, the back of the skull down to the nape
  // (and the scalp under the clumps, so a chink between two shows the shave, not skin)
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b3', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
