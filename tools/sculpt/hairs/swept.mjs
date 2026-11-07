// The swept-back undercut (tools/sculpt/ref/hair-swept-undercut.png): the game's 'swept', "Swept back". Meshed from the
// sheet: the locks' layout follows its creases lifted onto the hull carved from its five silhouettes
// (tools/sculpt/lowhairtrace.mjs, tools/sculpt/lowhairhull.mjs), each piece's ridges standing at the hull's surface and
// its grooves under it. Four pieces of parallel locks running from the hairline back over the skull (two on his right,
// the top with the quiff, one on his left) and the back, a shield with a ridge down its middle to the point at the nape
// the others run into. The sides and the back below them shaved (the head's own polygons in the shaved tone). Read by
// tools/sculpt/lowhair.mjs (the format is there).
export default {
  // the corners above the roots moved by up to this much (head units, where the lock is 0.2 high; less where lower)
  jitter: 0.006,
  // the sections, the piece's one edge to its other (up: the share of the hull's thickness): two locks, three locks,
  // one lock with a ridge down its middle
  sec2: [[-0.5, 0], [-0.46, 0.8], [-0.22, 1], [0.02, 0.86], [0.27, 1], [0.46, 0.8], [0.5, 0]],
  sec3: [[-0.5, 0], [-0.47, 0.82], [-0.31, 1], [-0.15, 0.9], [0.02, 1], [0.18, 0.9], [0.33, 1], [0.47, 0.82], [0.5, 0]],
  sec1: [[-0.5, 0], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.5, 0]],
  clumps: [
    // his right, low: the locks over the ear, from the temple back to the nape
    { id: 'right_low', sec: 'sec2', n: 8, path: [[50, -40, 0.02], [68, -52], [100, -57], [135, -54], [163, -44], [186, -12]], w: [0.32, 0.38, 0.4, 0.4, 0.36, 0.26], h: [0.1], ends: [0.5, 0.6], tipUp: [0.3, 0.2] },
    // his right, high: from the forehead's corner, over its edge (a lip), back along the skull's upper side
    { id: 'right_high', sec: 'sec2', n: 8, lip: true, path: [[30, -24, 0.02], [48, -36, 0.03], [95, -38], [135, -34], [163, -24], [188, -5]], w: [0.4, 0.42, 0.42, 0.4, 0.36, 0.26], h: [0.1], ends: [0.15, 0.6], tipUp: [0, 0.2] },
    // the top: the quiff, lifted off the forehead (a lip) and swept back over the crown
    { id: 'top', sec: 'sec3', n: 8, lip: true, scale: 1.12, path: [[25, -6, 0.08], [42, 0, 0.1], [90, 3], [130, 3], [165, 2], [190, 0]], w: [0.86, 0.92, 0.88, 0.8, 0.6, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0.2, 0.2] },
    // his left: three locks from the temple back down the side to the nape
    { id: 'left', sec: 'sec3', n: 8, path: [[28, 22, 0.06], [50, 40, 0.03], [95, 48], [135, 45], [160, 32], [186, 8]], w: [0.5, 0.56, 0.6, 0.58, 0.5, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0, 0.2] },
    // the fringe: the lowest lock's edge across the forehead from temple to temple, standing off it (its underside the
    // sheet's dark band over the forehead), under the top's and the sides' front ends
    { id: 'fringe', sec: 'sec1', n: 8, float: true, scale: 0.45, path: [[36, -32, 0.03], [31, -18, 0.06], [29, 0, 0.07], [31, 20, 0.06], [36, 32, 0.03]], w: [0.16, 0.2, 0.2, 0.2, 0.16], h: [0.1], ends: [0.4, 0.4], tipUp: [0, 0] },
    // the back: from the crown down the middle to the point at the nape
    { id: 'back', sec: 'sec1', n: 7, path: [[115, 0], [150, 0], [175, 0], [194, 0]], w: [0.8, 0.8, 0.56, 0.2], h: [0.1], ends: [0.5, 1], tipUp: [0.2, 0] },
  ],
  // the shaved: the skull's sides above and behind the ears, the back of the skull down to the nape (and the scalp under
  // the clumps, so a chink between two shows the shave, not skin); the temples, in front of the ears, stay bare skin as
  // the sheet's
  // the undercut's buzz forward of the shave to the sideburn: a near-vertical edge from the ear's front top up to the hair
  buzz: { lean: 0.25, drop: 0.03 },
  // the scalp the clumps' roots may sink into (the crossing checks leave it out)
  scalp: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b3', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f3', 'f4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
