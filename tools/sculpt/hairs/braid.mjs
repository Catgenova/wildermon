// The side braid updo (tools/sculpt/ref/hair-side-braid.png): the game's 'braid', "Braid". Built by
// tools/sculpt/lowbraid.mjs (the format is there): the crown's clumps laid between border lines over the skull, fitted to
// the sheet's creases on the carved hull (tools/sculpt/lowbraidlines.mjs), their heights the hull's (and solved,
// tools/sculpt/lowbraidcrown.mjs);
// the braid along a spine from behind her right ear over the shoulder onto the chest, its segments, its tie and its
// tip; two wavy strands at the temples.

/** The crown's border lines, each front to back as (over, out) points (tools/sculpt/lowhair.mjs dirOf: over 0 ahead,
 * 90 up, 180 back; out + her left). The part runs back from the hairline over her left brow to the crown, where the
 * seam starts: a herringbone down the back of the head to the braid's root behind her right ear (SEAM). Her right
 * side's clumps sweep from the part across the crown and down her right side, round to the seam; her left side's back
 * over her left side and round the back of the head to it; each side's clumps end on the seam one below the other. */
import { existsSync, readFileSync } from 'node:fs';

/** The seam's points, the crown to the root: each side's n-th border ends on the n-th. */
export const SEAM = [[108, 2], [150, -8], [186, -18], [220, -26], [250, -32]];
/** As drawn, before tools/sculpt/lowbraidlines.mjs fits them to the sheet's creases. Every border but the crown's
 * starts on the part, the hairline's at its front, each higher one further back, so each side's clumps fan out of the
 * part: the lowest across the forehead's hairline to the temple and on over the ear, the highest over the crown. */
export const LINES = {
  // the part's back end, up to the seam's top: the highest clumps' upper border
  crown: [[76, 10], [92, 6], [108, 2]],
  // her right: the borders between the sweep's clumps, the crown's down to the hairline over the ear
  r1: [[70, 11], [84, -16], [108, -30], [132, -24], SEAM[1]],
  r2: [[56, 13], [64, -28], [104, -52], [155, -46], SEAM[2]],
  r3: [[42, 15], [42, -32], [58, -62], [118, -74], [180, -58], SEAM[3]],
  r4: [[30, 17], [28, -24], [14, -52], [4, -66], [48, -84], [120, -90], [200, -72], [235, -52], SEAM[4]],
  // her left: each wrapping round the back
  l1: [[70, 13], [84, 30], [110, 28], [135, 18], SEAM[1]],
  l2: [[56, 15], [64, 40], [112, 45], [165, 22], SEAM[2]],
  l3: [[42, 16], [44, 45], [40, 62], [125, 62], [195, 32], SEAM[3]],
  l4: [[30, 17], [26, 45], [12, 68], [2, 78], [62, 88], [150, 82], [222, 60], [248, 24], SEAM[4]],
};
// the braid's spine and widths fitted to the sheet's five views (tools/sculpt/lowbraidspine.mjs), if fitted
const SPINE_FIT = new URL('./braid-spine.json', import.meta.url);
const SPINE = existsSync(SPINE_FIT) ? JSON.parse(readFileSync(SPINE_FIT, 'utf8')) : {};
// each clump's heights per station solved against the sheet's five views (tools/sculpt/lowbraidcrown.mjs), if solved
const CROWN_FIT = new URL('./braid-crown.json', import.meta.url);
const CROWN = existsSync(CROWN_FIT) ? JSON.parse(readFileSync(CROWN_FIT, 'utf8')) : {};
// the lines fitted to the sheet's creases, if fitted
const FIT = new URL('./braid-lines.json', import.meta.url);
const lines = existsSync(FIT) ? JSON.parse(readFileSync(FIT, 'utf8')) : LINES;

/** The clumps with their solved heights (m: per inner station, a share of the section's). */
const withFit = (clumps) => clumps.map((c) => (CROWN[c.id] && CROWN[c.id].length === c.n - 1 ? { ...c, m: CROWN[c.id] } : c));

export default {
  lines,
  // the crown's clumps: each between two border lines (upper: under the clump above it, its edge tucked; lower: its lip
  // over the next), `n` stations front to back, `taper` how far in from its front end it narrows to a point (share of
  // the length; its back end blunt, along the seam), and `lift`: its lip's height, a share of the hull's thickness there
  clumps: withFit([
    { id: 'r1', upper: 'crown', lower: 'r1', n: 7, taper: [0.2, 0], lift: 1.0 },
    { id: 'r2', upper: 'r1', lower: 'r2', n: 7, taper: [0.2, 0], lift: 0.95 },
    { id: 'r3', upper: 'r2', lower: 'r3', n: 8, taper: [0.16, 0], lift: 0.9 },
    { id: 'r4', upper: 'r3', lower: 'r4', n: 8, taper: [0.12, 0], lift: 0.85 },
    { id: 'l1', upper: 'crown', lower: 'l1', n: 7, taper: [0.2, 0], lift: 1.0 },
    { id: 'l2', upper: 'l1', lower: 'l2', n: 7, taper: [0.2, 0], lift: 0.95 },
    { id: 'l3', upper: 'l2', lower: 'l3', n: 8, taper: [0.16, 0], lift: 0.9 },
    { id: 'l4', upper: 'l3', lower: 'l4', n: 8, taper: [0.12, 0], lift: 0.85 },
  ]),
  // a clump's cross-section, its upper border (-0.5) to its lower (0.5): [across, height] (height a share of the hull's
  // thickness; 'root' a corner sunk in the scalp); the upper edge tucked under the clump above, the lower a lip standing
  // over the next clump, the face under the lip its valley
  sec: [[-0.62, 'root'], [-0.54, 0.55], [-0.05, 1.02], [0.45, 1], [0.58, 0.72], [0.5, 'root']],
  // the braid: its spine (her body's units, from behind her right ear down over the shoulder onto the chest), its
  // segments' starts along it (shares of its length; then the tie, then the tip), their half-widths across (deep:
  // `depth` of that), the tip's a share of the last segment's
  braid: {
    spine: [[-0.55, 0.4, -0.58], [-0.56, 0.3, -0.26], [-0.7, -0.18, 0.1], [-0.54, -0.66, 0.48], [-0.48, -1.22, 0.83], [-0.56, -1.52, 0.92]],
    seg: [0, 0.17, 0.34, 0.51],
    tie: [0.68, 0.73],
    w: [0.46, 0.46, 0.45, 0.44],
    tipW: 0.66,
    depth: 0.6,
    // each body's own, fitted
    fits: SPINE,
  },
  // the face strands: each a wavy path (her body's units, from its root under the clumps at the temple), its width and
  // thickness tapering to the tip
  strands: [
    { id: 'strandL', path: [[0.66, 1.4, 0.48], [0.76, 1.08, 0.46], [0.8, 0.78, 0.4], [0.9, 0.48, 0.34], [0.84, 0.18, 0.38], [0.9, -0.05, 0.28]], w: 0.11, t: 0.04 },
    { id: 'strandR', path: [[-0.68, 1.36, 0.42], [-0.76, 1.08, 0.36], [-0.74, 0.84, 0.3], [-0.8, 0.6, 0.24], [-0.74, 0.36, 0.2], [-0.78, 0.18, 0.12]], w: 0.09, t: 0.04 },
  ],
};
