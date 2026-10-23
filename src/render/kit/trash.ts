import {
  css, deeper, grain, hex, KIT_INK, lathe, mix, nail, proj, slab, TAU, toneOf, woodTone,
  type Ctx, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';
import { rand } from '../ivy';

/**
 * The trash crate (`trash_crate`, one subtile), in the kit: an open crate of
 * slats with gaps between them, nailed to a post at each corner, filled to a
 * hand under its rim with rot and heaped in the middle over that -- a cabbage
 * gone over, a rotten apple, peelings, a fish's head -- and a few flies over
 * it. The wood is what it was built of; dyed, its slats are painted.
 */

/** Rot and refuse, each a pastel of its own with the kit's mauve in its shade. */
const MULCH: Tone = toneOf('#806c5e', '#463844');
const CABBAGE: Tone = toneOf('#a9c07e', '#566c5a');
const APPLE: Tone = toneOf('#dc9a76', '#7c4c52');
const PEEL: Tone = toneOf('#e6d29c', '#8c7866');
const FISH: Tone = toneOf('#c6d0da', '#626a84');

/** Half its width, the top of its slats, its corner posts and slats, and how high it is filled. */
const X = 4, H = 5.3, POST = 0.85, SLAT = 0.45, FILL = 3.5;
/** The slats up each side: their foot and head. */
const SLATS: Array<[number, number]> = [[0.35, 1.5], [2.05, 3.2], [3.85, 5.0]];

/** The top of what has been thrown in: lumps of rot a step darker and paler, a few peelings. */
function mulch(g: Ctx, k: PaintCtx, s: Side): void {
  const T = rand(17);
  for (let i = 0; i < 22; i++) {
    const x = (T() - 0.5) * s.w, y = (T() - 0.5) * s.h;
    const pick = T();
    g.fillStyle = pick < 0.4 ? css(mix(k.fill, hex('#3e3040'), 0.35), 0.75) : pick < 0.75 ? css(mix(k.fill, [255, 240, 210], 0.3), 0.7) : css(mix(k.fill, hex('#8a9a5a'), 0.45), 0.75);
    g.beginPath();
    g.ellipse(x, y, 0.35 + T() * 0.4, 0.22 + T() * 0.2, T() * 3, 0, TAU);
    g.fill();
  }
}

/** A slat's face: its grain along it, and a nail at each end into the post. */
const slatFace = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  grain(g, k.fill, s.w, s.h, seed, 'x', 0.7);
  for (const x of [0.32, s.w - 0.32]) nail(g, k.fill, x, s.h / 2, 0.13);
};

function trashOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const POSTS = deeper(WOOD, 0.12);
  const parts: KitPart[] = [];
  const I = X - POST;

  // What has been thrown in, up to a hand under the rim: dark between the slats, its top in lumps.
  parts.push({ faces: slab(-I, I, -I, I, 0, FILL, MULCH, { paint: { top: mulch } }), solid: false });

  // The corner posts, each a step deeper, their tops softened.
  for (const [i, [px, py]] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>).entries()) {
    const x0 = px < 0 ? -X : X - POST, y0 = py < 0 ? -X : X - POST;
    const side = (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 30 + i, 'y', 0.6);
    parts.push({ faces: slab(x0, x0 + POST, y0, y0 + POST, 0, H, POSTS, { corner: 0.1, bevel: 0.12, paint: { front: side, back: side, left: side, right: side } }), edges: true });
  }
  // The slats between the posts, set in a little from their faces, the gaps between them showing the rot inside.
  const IN = 0.12;
  SLATS.forEach(([z0, z1], n) => {
    const top = (g: Ctx, k: PaintCtx, s: Side): void => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 50 + n, 'x', 0.4); g.restore(); };
    const along = { front: slatFace(60 + n), back: slatFace(63 + n), top };
    const across = { left: slatFace(66 + n), right: slatFace(69 + n), top };
    const o = { corner: 0.06, bevel: 0.08 };
    parts.push({ faces: slab(-I, I, X - IN - SLAT, X - IN, z0, z1, WOOD, { ...o, paint: along }), edges: true });
    parts.push({ faces: slab(-I, I, -X + IN, -X + IN + SLAT, z0, z1, WOOD, { ...o, paint: along }), edges: true });
    parts.push({ faces: slab(-X + IN, -X + IN + SLAT, -I, I, z0, z1, WOOD, { ...o, paint: across }), edges: true });
    parts.push({ faces: slab(X - IN - SLAT, X - IN, -I, I, z0, z1, WOOD, { ...o, paint: across }), edges: true });
  });

  // Heaped over the rim in the middle: a cabbage gone over, a rotten apple, peelings, a fish's head.
  const heap = (cx: number, cy: number, profile: Array<[number, number]>, tone: Tone, sides: number, paint?: (g: Ctx, k: PaintCtx, s: Side) => void): void => {
    const faces = lathe(cx, cy, profile.map(([z, r]) => [FILL + z, r] as [number, number]), sides, tone, 0.5, (_k, _i, s) => (paint ? { paint: (g: Ctx, k: PaintCtx) => paint(g, k, s) } : undefined));
    parts.push({ faces, edges: true });
  };
  // The cabbage's leaves, their veins, and the brown where it has gone.
  heap(-1.25, -1.0, [[0, 1.35], [0.8, 1.6], [1.6, 1.35], [2.2, 0.55]], CABBAGE, 9, (g, k, s) => {
    g.strokeStyle = css(mix(k.fill, [255, 255, 240], 0.4), 0.6);
    g.lineWidth = 0.12;
    g.beginPath(); g.moveTo(s.w * 0.5, 0); g.lineTo(s.w * 0.5, s.h); g.stroke();
    g.fillStyle = css(mix(k.fill, hex('#7a6040'), 0.45), 0.5);
    g.beginPath(); g.ellipse(s.w * 0.3, s.h * 0.4, 0.3, 0.22, 0, 0, TAU); g.fill();
  });
  // The apple, its rotten side.
  heap(1.35, -0.85, [[0, 0.7], [0.55, 1.0], [1.15, 0.85], [1.45, 0.3]], APPLE, 9, (g, k, s) => {
    g.fillStyle = css(mix(k.fill, hex('#5a3a3a'), 0.4), 0.55);
    g.beginPath(); g.ellipse(s.w * 0.6, s.h * 0.5, 0.35, 0.3, 0, 0, TAU); g.fill();
  });
  // The peelings, in a curl.
  heap(-0.45, 1.4, [[0, 1.35], [0.6, 1.1], [1.1, 0.35]], PEEL, 8, (g, k, s) => {
    g.strokeStyle = css(mix(k.fill, hex('#8a6a50'), 0.4), 0.55);
    g.lineWidth = 0.12;
    g.beginPath(); g.moveTo(0, s.h * 0.3); g.quadraticCurveTo(s.w * 0.5, s.h * 0.9, s.w, s.h * 0.4); g.stroke();
  });
  // The fish's head, its eye and gill.
  heap(1.6, 1.45, [[0, 0.75], [0.7, 0.62], [1.05, 0.2]], FISH, 7, (g, k, s) => {
    g.strokeStyle = css(mix(k.fill, hex('#3c3848'), 0.4), 0.5);
    g.lineWidth = 0.1;
    g.beginPath(); g.arc(s.w * 0.5, 0, 0.45, 0.3, Math.PI - 0.3); g.stroke();
  });
  // The flies over it, and one sat on the rim.
  const flies: V3[] = [[-0.8, 0.2, 7.6], [0.9, -0.6, 8.4], [0.2, 1.0, 7.0]];
  parts.push({
    reach: flies.map(([x, y, z]) => [x, y, z] as V3),
    draw: (g, e) => {
      for (const f of flies) {
        const [px, py] = proj(e, f);
        g.fillStyle = 'rgba(240, 244, 252, 0.8)';
        g.beginPath();
        g.ellipse(px - 0.55, py - 0.45, 0.6, 0.3, -0.6, 0, TAU);
        g.ellipse(px + 0.55, py - 0.45, 0.6, 0.3, 0.6, 0, TAU);
        g.fill();
        g.fillStyle = css(mix(KIT_INK, hex('#3c3848'), 0.4));
        g.beginPath();
        g.arc(px, py, 0.5, 0, TAU);
        g.fill();
      }
    },
  });
  return { parts, shade: [[-X, -X, 0], [X, -X, 0], [X, X, 0], [-X, X, 0]] };
}


export const TRASH_CRATE: KitPiece = { model: (look) => trashOf(look), uses: { tint: true, material: true } };
