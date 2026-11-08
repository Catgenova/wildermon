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

/**
 * The creases between the front's tufts, his right to his left: each from its root on the scalp (over, out), its tip
 * `tip` degrees ahead of the root (the hairline on the forehead; less at the sides, clear of the temples), back to its
 * end (on his right side behind the ear; on top under the top's front, so the back stays the top's and the back's).
 * Stations: the root, the sole (halfway to the tip), the tip, the tuft's lifted front (a little behind the tip, so it
 * rises off the hairline and rolls forward over it), then on back to the end.
 */
function tuftLines() {
  const creases = [
    // [root, end, tip]: the first and the last the piece's borders (roots all along)
    [[60, -70], [168, -58], 0],
    [[52, -58], [170, -46], 6],
    [[44, -44], [165, -34], 14],
    [[42, -22], [140, -18], 23],
    [[42, -6], [128, -4], 24],
    [[42, 10], [126, 10], 24],
    [[43, 26], [124, 24], 22],
    [[46, 42], [122, 38], 14],
    [[58, 64], [112, 58], 0],
  ];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  return creases.map(([[o, u], e, tip]) => {
    const back = [o + 16, u];
    return [[o, u], [o - tip / 2, u], [o - tip, u], [o - tip * 0.6, u], ...[0, 0.3, 0.58, 0.82].map((f) => lerp(back, e, f)), e];
  });
}

export default {
  // the corners above the roots moved by up to this much (head units, where the lock is 0.2 high; less where lower)
  jitter: 0.006,
  // the sections, the piece's one edge to its other (up: the share of the hull's thickness): two locks, three locks,
  // one lock with a ridge down its middle
  sec2: [[-0.5, 0], [-0.46, 0.8], [-0.22, 1], [0.02, 0.86], [0.27, 1], [0.46, 0.8], [0.5, 0]],
  sec3: [[-0.5, 0], [-0.47, 0.82], [-0.31, 1], [-0.15, 0.9], [0.02, 1], [0.18, 0.9], [0.33, 1], [0.47, 0.82], [0.5, 0]],
  sec1: [[-0.5, 0], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.5, 0]],
  clumps: [
    // the front and the top: one mass of tufts combed straight back (tools/sculpt/lowhair.mjs massOf), the creases
    // between them below
    { id: 'front', mass: true, sink: 0.015, band: [[0.5, 0]], groove: 0.1, grooveAt: [0, 0, 0, 1, 0.6, 0.3, 0.3, 0.3, 0], valleyFrom: 4, flush: [0.1, 0.03], fit, lines: tuftLines() },
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
