import {
  boards, css, deeper, extrude, grain, hex, lathe, mix, slab, stud, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tint, type Tone,
} from './core';
import { border, nails, woodSides } from './woodwork';

/**
 * The sign and the signboard (`sign`, one subtile; `great_sign`, two by
 * one), in the kit. What is written on them the renderer puts over them in
 * the world, from their height, so all these are is the board.
 *
 * A sign is a board of three planks across two square posts with turned
 * knobs, nailed to them, a carved border round its face and a gold stud at
 * the head of it. A signboard is wider, of four planks between heavier posts,
 * under a little pitched cap of shingles to keep the rain off the paint. The
 * board is a paler wood than the posts; dyed, the board is painted in the dye
 * and the posts and the cap are left as they are.
 */

/** The board's own tone: the wood a step toward cream, or the dye laid over it as paint. */
function boardTone(material?: string, tint?: Tint): Tone {
  if (tint) return woodTone(material, tint, 0.75);
  const w = woodTone(material);
  return { lit: mix(w.lit, [255, 248, 232], 0.25), shade: mix(w.shade, w.lit, 0.18) };
}

/** A board's face: its planks, the carved border, the nails into the posts behind it, and the stud at its head. */
function boardFace(planks: number, seed: number, posts: readonly number[], x0: number, inset: number, r: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, planks, seed);
    border(g, k.fill, s.w, s.h, inset);
    for (const px of posts) nails(g, k.fill, px - x0, [inset + r * 0.6, s.h - inset - r * 0.6], r * 0.42);
    stud(g, s.w / 2, s.h - inset - r * 0.2, r);
  };
}

/** The back of a board: its planks. */
function boardBack(planks: number, seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => boards(g, k.fill, s.w, s.h, planks, seed);
}

/** A post: square, chamfered, the grain up it. */
const post = (x: number, w: number, z1: number, tone: Tone, seed: number): Face[] =>
  slab(x - w / 2, x + w / 2, -w / 2, w / 2, 0, z1, tone, { corner: w * 0.18, taper: 0.06, bevel: 0.1, paint: woodSides(seed, 'y') });

/* ---- the sign ------------------------------------------------------------------------- */

const SIGN_POST = 3.9, SIGN_TOP = 11.2;

function signOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP: Tone = { lit: mix(WOOD.lit, [255, 250, 240], 0.08), shade: mix(WOOD.shade, WOOD.lit, 0.08) };
  const BOARD = boardTone(look.material, look.tint);
  const parts: KitPart[] = [];
  for (const [i, x] of [-SIGN_POST, SIGN_POST].entries()) {
    parts.push({ faces: post(x, 0.9, SIGN_TOP, WOOD, 11 + i * 4) });
    parts.push({ faces: lathe(x, 0, [[SIGN_TOP - 0.05, 0.36], [SIGN_TOP + 0.16, 0.48], [SIGN_TOP + 0.4, 0.4], [SIGN_TOP + 0.58, 0.18], [SIGN_TOP + 0.64, 0.02]], 8, TOP), edges: true });
  }
  const X = 4.6;
  parts.push({
    faces: slab(-X, X, 0.45, 1.05, 5.8, 10.6, BOARD, {
      corner: 0.14, bevel: 0.12,
      paint: { front: boardFace(3, 21, [-SIGN_POST, SIGN_POST], -X, 0.5, 0.55), back: boardBack(3, 22), left: woodSides(23, 'y').left, right: woodSides(23, 'y').right },
    }),
    edges: true,
  });
  return { parts, shade: [[-X, -0.6, 0], [X, -0.6, 0], [X, 1.2, 0], [-X, 1.2, 0]] };
}

/* ---- the signboard -------------------------------------------------------------------- */

function greatSignOf(look: KitLook, hw: number): KitModel {
  const WOOD = woodTone(look.material);
  const BOARD = boardTone(look.material, look.tint);
  const CAP = deeper(WOOD, 0.4);
  const parts: KitPart[] = [];
  const x = hw - 0.8, PX = x - 0.4, POST_TOP = 13.6;
  for (const [i, px] of [-PX, PX].entries()) parts.push({ faces: post(px, 1.1, POST_TOP, WOOD, 11 + i * 4) });
  parts.push({
    faces: slab(-x, x, 0.55, 1.2, 7, 13.2, BOARD, {
      corner: 0.16, bevel: 0.12,
      paint: { front: boardFace(4, 21, [-PX, PX], -x, 0.6, 0.7), back: boardBack(4, 22), left: woodSides(23, 'y').left, right: woodSides(23, 'y').right },
    }),
    edges: true,
  });
  // The cap: two pitched slopes of shingles over a ridge along it, seen end on and pushed along it.
  const Y0 = -1.3, Y1 = 2.9, YM = (Y0 + Y1) / 2, Z0 = POST_TOP, EAVE = Z0 + 0.32, RIDGE = Z0 + 1.35;
  const cap: Pt[] = [[Y0, Z0], [Y1, Z0], [Y1, EAVE], [YM, RIDGE], [Y0, EAVE]];
  const L = x + 0.6;
  const shingles = (seed: number) => (g: Ctx, k: PaintCtx): void => {
    const len = Math.hypot(Y1 - YM, RIDGE - EAVE);
    const rows = 3, deep = css(mix(k.fill, hex('#3e2a34'), 0.45), 0.85), lit = css(mix(k.fill, [255, 246, 228], 0.35), 0.6);
    g.save();
    g.translate(0, -L);
    grain(g, k.fill, len, L * 2, seed, 'y', 0.5);
    for (let r = 0; r < rows; r++) {
      const s0 = (r / rows) * len, s1 = ((r + 1) / rows) * len;
      // The butt of each course, and the joints between its shingles staggered from the course under it.
      g.fillStyle = deep;
      g.fillRect(s0, 0, 0.14, L * 2);
      g.fillStyle = lit;
      g.fillRect(s0 + 0.14, 0, 0.08, L * 2);
      const w = 1.25, off = r % 2 ? w / 2 : 0;
      g.strokeStyle = deep;
      g.lineWidth = 0.1;
      for (let t = off; t < L * 2; t += w) { g.beginPath(); g.moveTo(s0 + 0.1, t); g.lineTo(s1, t); g.stroke(); }
    }
    g.restore();
  };
  const gable = (g: Ctx, k: PaintCtx): void => { g.save(); g.translate(Y0, Z0); grain(g, k.fill, Y1 - Y0, RIDGE - Z0, 41, 'x', 0.6); g.restore(); };
  parts.push({
    faces: extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], cap, -L, L, CAP, 0.14, {
      front: gable, back: gable,
      edge: (i) => (i === 2 || i === 3 ? { paint: shingles(50 + i), crease: 0.5 } : undefined),
    }),
    edges: true,
  });
  return { parts, shade: [[-L, Y0, 0], [L, Y0, 0], [L, Y1, 0], [-L, Y1, 0]] };
}

export const SIGN: KitPiece = { model: (look) => signOf(look), uses: { tint: true, material: true } };
export const GREAT_SIGN: KitPiece = { model: (look, { hw }) => greatSignOf(look, hw), uses: { tint: true, material: true } };
