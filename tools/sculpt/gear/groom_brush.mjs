// The brush (src/game/items.ts 'brush': a plank and nails, the tool a wildermon is groomed with) as the groom clip holds
// it (src/sculpt/anim/clips/tend.ts groom): a Runecut hand tool in the line of the mallet and the chisel
// (tools/sculpt/gear/handparts.mjs), named groom_brush so it stands apart from any brush drawn for other work.
//
//   node tools/sculpt/gear/groom_brush.mjs [--out <file>]   writes src/sculpt/assets/groom_brush.json
//
// Game units, its frame as handparts.mjs says: y along the handle from its butt toward the head (toward the thumb of the
// fist on it), x the way the bristles look (along the hand toward the knuckles: the fist pressed to the flank presses the
// bristles to it), z = x × y. Parts: (1) a faceted pale-stone butt cap and gold collar; (2) the wooden handle, straight
// grained; (3) the gold collar where it enters the head; (4) the head, a block of wood along the handle's line, eight-sided,
// a gold band round each end, a gold-ringed medallion on its back (-x); (5) the bristles, a straw-coloured pad standing off
// the head's +x face, in rows. Built at the props' size (the mallet's: its fist 0.85 up its haft, 3.9 long), no metal: the
// game makes it of wood and nails.
// Enchanted: the medallion's star and disc lit, glow added round it.

import { meshOf, trisOf } from '../lowgear.mjs';
import { partsOf, haftOf, writeTool, MATS_PLAIN as BASE_PLAIN, MATS_ENCHANTED as BASE_LIT } from './handparts.mjs';

const MATS_PLAIN = { ...BASE_PLAIN, bristle: { c: '#e2cf9c', vary: 0.04 }, bristle2: { c: '#c9b17a', vary: 0.04 }, bristleD: { c: '#9c8558' } };
const MATS_ENCHANTED = { ...BASE_LIT, bristle: MATS_PLAIN.bristle, bristle2: MATS_PLAIN.bristle2, bristleD: MATS_PLAIN.bristleD };

/** The brush's measures: the fist on the handle, the handle's radius, where the head runs along y, its half-sizes. */
export const BRUSH = { lead: 0.78, r: 0.165, h0: 1.4, h1: 3.15, back: 0.15, wide: 0.4, pad: 0.15 };

export function buildGroomBrush({ enchanted = false } = {}) {
  const G = meshOf(), parts = partsOf(G), { oct, tube, cap, medal, glowDisc, F, P } = parts;
  const B = BRUSH, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

  /* ---- the handle: the stone butt, a collar, the wood, the collar into the head ---------------------------------- */
  const butt = [parts.ring(0, B.r * 0.75, B.r * 0.3), parts.ring(0.06, B.r * 1.1, B.r * 0.4), parts.ring(0.2, B.r * 1.1, B.r * 0.4), parts.ring(0.24, B.r * 1.2, B.r * 0.42)];
  tube(butt, (i) => (i === 1 ? 'stone' : 'bevel'));
  cap(butt[0], 'bevel', [0, -1, 0]);
  haftOf(parts, [[0.24, B.r * 1.2, 'gold'], [0.31, B.r * 1.2, 'goldD'], [0.31, B.r, 'wood'], [B.h0 - 0.12, B.r * 0.95, 'gold'], [B.h0 - 0.12, B.r * 1.25, 'gold'], [B.h0 + 0.02, B.r * 1.25]], { grain: true });

  /* ---- the head: eight-sided sections along y, x its depth and z its width; a gold band near each end ----------- */
  const sec = (y, a = B.back, b = B.wide, k = 0.06) => oct([0, y, 0], X, Z, a, b, k);
  const H = [sec(B.h0, B.back * 0.8, B.wide * 0.9), sec(B.h0 + 0.06), sec(B.h0 + 0.2), sec(B.h0 + 0.28), sec(B.h1 - 0.28), sec(B.h1 - 0.2), sec(B.h1 - 0.06), sec(B.h1, B.back * 0.8, B.wide * 0.9)];
  tube(H, (i, j) => (i === 1 || i === 5 ? 'gold' : i === 0 || i === 6 ? 'goldD' : j % 2 ? 'wood2' : 'wood'));
  cap(H[0], 'wood2', [0, -1, 0]); cap(H[7], 'wood2', Y);

  /* ---- the bristles: a pad off the +x face, its rows split by dark lines ------------------------------------------ */
  const x0 = B.back - 0.01, x1 = B.back + B.pad, y0 = B.h0 + 0.12, y1 = B.h1 - 0.12, w = B.wide * 0.86;
  const pad = (ya, yb, za, zb, mat) => {
    const q = (x, y, z) => P([x, y, z]);
    const c = [[ya, za], [yb, za], [yb, zb], [ya, zb]];
    const top = c.map(([y, z]) => q(x1, y, z)), bot = c.map(([y, z]) => q(x0, y, z));
    F(top, mat, X);
    for (let j = 0; j < 4; j++) F([bot[j], bot[(j + 1) % 4], top[(j + 1) % 4], top[j]], 'bristle2', { from: [x1 - 0.1, (ya + yb) / 2, (za + zb) / 2] });
  };
  const ROWS = 3, gap = 0.035, rw = (2 * w - (ROWS - 1) * gap) / ROWS;
  for (let k = 0; k < ROWS; k++) { const za = -w + k * (rw + gap); pad(y0, y1, za, za + rw, k % 2 ? 'bristle2' : 'bristle'); }
  // the gaps between the rows, dark, a little back from the tips
  for (let k = 1; k < ROWS; k++) { const z = -w + k * (rw + gap) - gap; F([P([x1 - 0.03, y0, z]), P([x1 - 0.03, y1, z]), P([x1 - 0.03, y1, z + gap]), P([x1 - 0.03, y0, z + gap])], 'bristleD', X); }

  /* ---- the medallion on the back ---------------------------------------------------------------------------------- */
  const MY = (B.h0 + B.h1) / 2, MX = -B.back;
  medal([MX, MY, 0], [0, 0, 1], [-1, 0, 0], 0.17, 0.125);

  const tris = trisOf(G).length;
  if (enchanted) glowDisc([MX - 0.03, MY, 0], Z, Y, [-1, 0, 0], 0.32, 0.32, 0.42);
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: B.h1, tris, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, B.lead, 0], second: [0, B.lead, 0], radius: B.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: 0.31, to: B.h0 - 0.12 },
    // the fist closed round the handle across the finger roots (as the fine tools')
    fit: { backMax: 0.3 },
    // the bristles' tips at the head's middle: what meets the flank
    contact: [x1, MY, 0],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) await writeTool('groom_brush', buildGroomBrush);
