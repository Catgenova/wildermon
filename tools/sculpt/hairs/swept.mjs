// The swept-back undercut (tools/sculpt/ref/hair-swept-undercut.png): the game's 'swept', "Swept back". Meshed from the
// sheet: the locks' layout follows its creases lifted onto the hull carved from its five silhouettes
// (tools/sculpt/lowhairtrace.mjs, tools/sculpt/lowhairhull.mjs), each piece's ridges standing at the hull's surface and
// its grooves under it. Four pieces of parallel locks running from the hairline back over the skull (two on his right,
// the top with the quiff, one on his left) and the back, a shield with a ridge down its middle to the point at the nape
// the others run into. The sides and the back below them shaved (the head's own polygons in the shaved tone). Read by
// tools/sculpt/lowhair.mjs (the format is there).
export default {
  // the corners above the roots moved by up to this much (head units, where the lock is 0.2 high; less where lower)
  jitter: 0.012,
  // the sections, the piece's one edge to its other (up: the share of the hull's thickness): two locks, three locks,
  // one lock with a ridge down its middle
  sec2: [[-0.5, 0], [-0.46, 0.55], [-0.22, 1], [0.02, 0.7], [0.27, 1], [0.46, 0.55], [0.5, 0]],
  sec3: [[-0.5, 0], [-0.47, 0.6], [-0.31, 1], [-0.15, 0.8], [0.02, 1], [0.18, 0.8], [0.33, 1], [0.47, 0.6], [0.5, 0]],
  sec1: [[-0.5, 0], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.5, 0]],
  clumps: [
    // his right, low: the locks over the ear, from the temple back to the nape
    { id: 'right_low', sec: 'sec2', n: 8, path: [[33, -46], [55, -58], [95, -60], [135, -56], [163, -44], [186, -12]], w: [0.4, 0.44, 0.44, 0.42, 0.36, 0.26], h: [0.1], ends: [0.5, 0.6], tipUp: [0.3, 0.2] },
    // his right, high: from the forehead's corner, over its edge (a lip), back along the skull's upper side
    { id: 'right_high', sec: 'sec2', n: 8, lip: true, path: [[21, -22], [45, -36], [95, -38], [135, -34], [163, -24], [188, -5]], w: [0.4, 0.42, 0.42, 0.4, 0.36, 0.26], h: [0.1], ends: [0.25, 0.6], tipUp: [0.5, 0.2] },
    // the top: the quiff, lifted off the forehead (a lip) and swept back over the crown
    { id: 'top', sec: 'sec3', n: 8, lip: true, path: [[12, -2], [35, 0], [90, 3], [130, 3], [165, 2], [190, 0]], w: [0.8, 0.9, 0.88, 0.8, 0.6, 0.32], h: [0.1], ends: [0.2, 0.6], tipUp: [0.5, 0.2] },
    // his left: three locks from the temple back down the side to the nape
    { id: 'left', sec: 'sec3', n: 8, path: [[24, 24], [46, 44], [95, 50], [135, 45], [160, 32], [186, 8]], w: [0.56, 0.64, 0.64, 0.6, 0.5, 0.32], h: [0.1], ends: [0.5, 0.6], tipUp: [0.3, 0.2] },
    // the fringe: the lowest lock's edge across the forehead from temple to temple, standing off it (its underside the
    // sheet's dark band over the forehead), under the top's and the sides' front ends
    { id: 'fringe', sec: 'sec1', n: 8, float: true, path: [[33, -50, 0.02], [27, -28, 0.05], [25, 0, 0.06], [27, 26, 0.05], [33, 48, 0.02]], w: [0.18, 0.2, 0.2, 0.2, 0.18], h: [0.1], ends: [0.5, 0.5], tipUp: [0.3, 0.3] },
    // the back: from the crown down the middle to the point at the nape
    { id: 'back', sec: 'sec1', n: 7, path: [[115, 0], [150, 0], [175, 0], [194, 0]], w: [0.8, 0.8, 0.56, 0.2], h: [0.1], ends: [0.5, 1], tipUp: [0.2, 0] },
  ],
  // the shaved: the temples, the skull's sides above the ears and behind them, the back of the skull down to the nape
  // (and the scalp under the clumps, so a chink between two shows the shave, not skin)
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b3', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
