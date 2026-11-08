// The swept-back undercut (tools/sculpt/ref/hair-swept-undercut.png): the game's 'swept', "Swept back". Meshed from the
// sheet: the front one mass (tools/sculpt/lowhair.mjs massOf), its locks' creases laid as the sheet's run (back along his
// right side, round the forehead's corner, across the forehead rising to the quiff and down his left temple), each
// corner's height off the skin solved against the sheet's five silhouettes at once (tools/sculpt/lowhairfront.mjs);
// behind it the top over the crown, his left side, and the back, a shield with a ridge down its middle to the point at
// the nape, their heights the hull's carved from the same silhouettes (tools/sculpt/lowhairhull.mjs). The sides and the
// back below them shaved (the head's own polygons in the shaved tone). Read by tools/sculpt/lowhair.mjs (the format is
// there).
import { existsSync, readFileSync } from 'node:fs';

// the front mass's solved thicknesses (tools/sculpt/lowhairfront.mjs), if solved
const FIT = new URL('./swept-front.json', import.meta.url);
const fit = existsSync(FIT) ? JSON.parse(readFileSync(FIT, 'utf8')) : null;

export default {
  // the corners above the roots moved by up to this much (head units, where the lock is 0.2 high; less where lower)
  jitter: 0.006,
  // the sections, the piece's one edge to its other (up: the share of the hull's thickness): two locks, three locks,
  // one lock with a ridge down its middle
  sec2: [[-0.5, 0], [-0.46, 0.8], [-0.22, 1], [0.02, 0.86], [0.27, 1], [0.46, 0.8], [0.5, 0]],
  sec3: [[-0.5, 0], [-0.47, 0.82], [-0.31, 1], [-0.15, 0.9], [0.02, 1], [0.18, 0.9], [0.33, 1], [0.47, 0.82], [0.5, 0]],
  sec1: [[-0.5, 0], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.5, 0]],
  clumps: [
    // the front: one mass from the hairline over the forehead to the crown's front and back along his right side, its
    // locks' creases (lowest first: the roots, the fringe's lower edge, three creases, the back edge's roots) from behind
    // his right ear forward along the side, round the forehead's corner, across it rising to the quiff (just left of his
    // middle) and down his left temple, as the sheet's; each lock a dark groove, the roll's front, its lit top
    { id: 'front', mass: true, edge: true, n: 11, sink: 0.015, band: [[0.14, 0.02], [0.55, 0]], groove: 0.12, fit,
      lines: [
        [[168, -50], [140, -64], [105, -66], [72, -62], [50, -50], [44, -30], [43, -12], [42, 4], [44, 22], [48, 40], [64, 68]],
        [[168, -55], [140, -69], [105, -71], [70, -67], [38, -52], [25, -32], [20, -12], [19, 4], [22, 22], [32, 42], [60, 68]],
        [[171, -42], [140, -57], [105, -59], [72, -56], [48, -42], [40, -24], [40, -8], [46, 10], [58, 28], [74, 44], [90, 62]],
        [[174, -32], [140, -45], [105, -47], [80, -45], [62, -36], [58, -20], [62, -6], [70, 10], [84, 24], [98, 36], [108, 54]],
        [[177, -21], [140, -33], [108, -35], [92, -32], [78, -26], [76, -14], [82, -4], [94, 10], [106, 20], [116, 30], [122, 46]],
        [[180, -10], [145, -20], [118, -23], [104, -22], [96, -16], [100, -8], [108, -2], [118, 10], [126, 18], [130, 26], [132, 40]],
      ] },
    // the top: from under the front's back edge, back over the crown
    { id: 'top', sec: 'sec3', n: 6, scale: 0.825, path: [[92, -2, 0.06], [110, 3], [130, 3], [165, 2], [190, 0]], w: [0.8, 0.8, 0.6, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0.2, 0.2] },
    // his left: three locks from under the front's left end back down the side to the nape
    { id: 'left', sec: 'sec3', n: 6, scale: 0.825, path: [[66, 40, 0.03], [80, 44, 0.03], [100, 48], [135, 45], [160, 32], [186, 8]], w: [0.5, 0.56, 0.6, 0.58, 0.5, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0, 0.2] },
    // the back: from the crown down the middle to the point at the nape
    { id: 'back', sec: 'sec1', n: 7, scale: 0.78, path: [[115, 0], [150, 0], [175, 0], [194, 0]], w: [0.8, 0.8, 0.56, 0.2], h: [0.1], ends: [0.5, 1], tipUp: [0.2, 0] },
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
