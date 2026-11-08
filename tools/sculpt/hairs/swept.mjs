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
    // [root, end, tip]: the first and the last the piece's borders (roots all along); the tufts between of uneven widths
    // (11 to 24 degrees across) and reach
    [[60, -70], [168, -58], 0],
    [[52, -59], [170, -47], 7],
    [[44, -45], [165, -35], 13],
    [[42, -21], [141, -17], 22],
    [[42, -10], [130, -8], 25],
    [[42, 9], [126, 9], 23],
    [[43, 22], [124, 21], 21],
    [[46, 42], [122, 38], 15],
    [[58, 64], [112, 58], 0],
  ];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  return creases.map(([[o, u], e, tip]) => {
    const back = [o + 16, u];
    return [[o, u], [o - tip / 2, u], [o - tip, u], [o - tip * 0.6, u], ...[0, 0.3, 0.58, 0.82].map((f) => lerp(back, e, f)), e];
  });
}

/**
 * The back: tufts from under the crown, the top and the sides down to a wide V at the nape, its point at the middle
 * (over `point`) and its arms straight up to behind each ear (out `arm`, `rise` degrees higher). The creases (the
 * borders his right and left, two between) and the tufts' ridges (the middle one to the point) fan out from the V to
 * their roots up under the other pieces; each line's stations: the root, two down the back, the lip (`lip` degrees above
 * the V, the tuft's lower end standing off the skin) and the V.
 */
const V = { point: 181, arm: 66, rise: 28 };
function vLines({ point, arm, rise } = V, lip = 2, tuck = 2) {
  const edge = (u) => point - (rise * Math.abs(u)) / arm;
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const line = ([u, root]) => {
    const E = [edge(u), u], len = Math.hypot(E[0] - root[0], E[1] - root[1]);
    return [root, lerp(root, E, 0.4), lerp(root, E, 0.75), lerp(root, E, 1 + lip / len), lerp(root, E, 1 - tuck / len)];
  };
  // [out at the V, root]
  const creases = [[-arm, [126, -76]], [-arm / 3, [128, -34]], [arm / 3, [128, 34]], [arm, [126, 76]]];
  const ridges = [[(-arm * 2) / 3, [127, -56]], [0, [127, 0]], [(arm * 2) / 3, [127, 56]]];
  return { lines: creases.map(line), ridges: ridges.map(line) };
}

export default {
  // the corners above the roots moved by up to this much (head units, where the lock is 0.2 high; less where lower)
  jitter: 0.006,
  // the sections, the piece's one edge to its other (up: the share of the hull's thickness; a third value, a groove's
  // floor and its depth): the top's three locks and the left's, each of uneven widths
  secTop: [[-0.5, 0], [-0.47, 0.82], [-0.33, 1], [-0.2, 0.88, 0.8], [-0.155, 0.88, 0.8], [0, 0.95], [0.15, 0.91, 0.5], [0.19, 0.91, 0.5], [0.34, 1], [0.47, 0.82], [0.5, 0]],
  secLeft: [[-0.5, 0], [-0.47, 0.82], [-0.29, 1], [-0.12, 0.9, 0.6], [-0.085, 0.9, 0.6], [0.06, 1], [0.2, 0.88, 0.9], [0.245, 0.88, 0.9], [0.36, 0.97], [0.47, 0.82], [0.5, 0]],
  // the V at the nape (vLines): the other pieces kept above it (each clump's `aboveV`: by so many degrees)
  v: V,
  clumps: [
    // the front and the top: one mass of tufts combed straight back (tools/sculpt/lowhair.mjs massOf), the creases
    // between them below
    { id: 'front', mass: true, aboveV: 12, sink: 0.015, band: [[0.5, 0]], groove: 0.1, grooveAt: [0, 0, 0, 1, 0.6, 0.3, 0.3, 0.3, 0],
      // the valleys: per crease, his right to his left, how wide, where its strip runs, how deep, and past it the tufts
      // closing up
      strip: { w: [0.16, 0.24, 0.14, 0.22, 0.17, 0.25, 0.15], from: [4, 3, 3, 3, 3, 3, 4], to: [6, 7, 5, 7, 6, 7, 5], depth: [0.7, 0.95, 0.6, 1, 0.75, 0.9, 0.6], merge: 0.4, peak: 'from' },
      // each tuft's lifted front raised or lowered; the shade under the rolls (the sole's faces, the tip's)
      lift: [1, 1.04, 0.96, 0.94, 1.07, 0.95, 1.05, 0.97], under: [0.62, 0.3],
      flush: [0.1, 0.03], fit, lines: tuftLines() },
    // the top: from under the front's back edge, back over the crown
    { id: 'top', aboveV: 12, sec: 'secTop', n: 5, scale: 0.825, path: [[92, -2, 0.06], [110, 3], [130, 3], [165, 2], [190, 0]], w: [0.8, 0.8, 0.6, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0.2, 0.2] },
    // his left: three locks from under the front's left end back down the side to the nape
    { id: 'left', aboveV: 12, sec: 'secLeft', n: 6, scale: 0.825, path: [[66, 40, 0.03], [80, 44, 0.03], [100, 48], [135, 45], [160, 32], [186, 8]], w: [0.5, 0.56, 0.6, 0.58, 0.5, 0.32], h: [0.1], ends: [0.15, 0.6], tipUp: [0, 0.2] },
    // the back: three tufts from under the others down to the wide V at the nape (vLines), their valleys darkest at the
    // lip where the tufts part
    { id: 'back', mass: true, sink: 0.015, scale: 0.7, least: [0, 0.12, 0.1, 0.08, 0], groove: 0.04, grooveAt: [0, 1, 1, 1, 0], strip: { w: 0.2, from: 1, to: 3, depth: [0.8, 0.65], peak: 'to' }, ...vLines() },
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
