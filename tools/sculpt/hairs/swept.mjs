// The swept-back undercut (tools/sculpt/ref/hair-swept-undercut.png): the game's 'swept', "Swept back". Meshed from the
// sheet: its creases traced in the views that show them and lifted onto the hull carved from its five silhouettes
// (tools/sculpt/hairs/swept-lines.json, tools/sculpt/lowhairlines.mjs: swept-lines-map.json, scalp-map degrees), all
// from the whorl on the forehead's hairline a little to his left, back to the centre line of the back and the V at the
// nape. Two masses (tools/sculpt/lowhair.mjs massOf): his right side's six tufts (B1 to B6, the lowest first) up to the
// parting C, and his left's four (Q1 to Q4); each tuft's top the hull's thickness there, the creases between grooves
// with their valleys shaded, the borders (the hairline, the parting, the whorl and the back's centre line) sunk in the
// scalp. The sides and the back below the hair shaved (the head's own polygons in the shaved tone), the sides forward of
// that buzzed to the sideburn. Read by tools/sculpt/lowhair.mjs (the format is there).
import { readFileSync } from 'node:fs';
import { overOutOfMap, resample } from '../lowhairlines.mjs';

const MAP = JSON.parse(readFileSync(new URL('./swept-lines-map.json', import.meta.url), 'utf8'));
/** The stations along each line, the whorl first and the back's centre line last. */
const N = 16;
/** The hairline (a border on the skin) let down this many degrees (away from the crown, toward the ears and the nape),
 * none at the whorl and at the V: the sheet's lower edge is the tufts' underside hanging over the buzz, a little under
 * where they meet the skin. */
const DROP = 3;
const lines = (ids) => ids.map((id) => resample(MAP[id], N).map(([e, n], j) => {
  if (id !== 'r0' && id !== 'l0') return overOutOfMap([e, n]);
  const a = Math.hypot(e, n), f = (a + DROP * Math.min(1, j / 3, (N - 1 - j) / 3)) / a;
  return overOutOfMap([e * f, n * f]);
}));

/** A mass's tufts: per crease between two tufts (his right to his left) the valley's strip: how wide (a share of the way
 * to the ridge beside it), the stations it runs over, how deep (of the groove; its shade the same share). */
const strip = (k) => ({ w: 0.18, from: 2, to: N - 3, depth: Array(k).fill(0.9), merge: 0.6, peak: 'from' });
/** The groove's share along the stations: none at the whorl and at the back's centre line, full between. */
const grooveAt = Array.from({ length: N }, (_, j) => Math.min(1, j / 3, (N - 1 - j) / 2));

/** Each tuft's section across: rows a quarter, half and three quarters of the way between its creases, the middle at
 * the hull's height and the others a little under it (a rounded top), the creases `groove` (head units) under it. */
const TUFT = { band: [[0.22, 0.05], [0.5, 0], [0.78, 0.05]], groove: 0.12, grooveAt };
/** Where the two masses meet (the parting C over the top, the back's centre line): the left's edge at this share of
 * the hull's thickness, the right's a little over it (laid on the left's), in a crease. */
const MEET = 0.5;

export default {
  jitter: 0,
  // the outline fitted onto the sheet's in its five views (tools/sculpt/lowhair.mjs outlineFit)
  outline: { rounds: 10, step: 0.015, edge: 0.3 },
  clumps: [
    // his right: the hairline (r0), five creases, the parting (C); six tufts
    { id: 'right', mass: true, apex: true, sink: 0.015, ...TUFT, borderUp: [null, MEET + 0.04], endUp: MEET + 0.04, strip: strip(5), lines: lines(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'C']) },
    // his left: the parting, three creases, the hairline (l0); four tufts
    { id: 'left', mass: true, apex: true, sink: 0.015, ...TUFT, borderUp: [MEET, null], endUp: MEET, strip: strip(3), lines: lines(['C', 'l1', 'l2', 'l3', 'l0']) },
  ],
  // the undercut's buzz forward of the shave to the sideburn: a near-vertical edge from the ear's front top up to the hair
  buzz: { lean: 0.25, drop: 0.03 },
  // the scalp the masses' borders sink into (the crossing checks leave it out)
  scalp: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f2', 'f3', 'f4', 'b3', 'b4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
  shave: ['c', 'a0', 'a1', 'a2', 'a3', 't0', 't1', 't2', 't3', 'f3', 'f4', 'b5', 'e5', 'o6', 'bk', 'n6', 'k5'],
};
