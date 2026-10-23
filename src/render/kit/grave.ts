import { rand } from '../ivy';
import {
  css, deeper, grain, hex, mix, paler, prism, slab, TAU, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';

/**
 * A grave (`grave`, one subtile by two), in the kit: a long low mound of
 * turned earth, flecked darker and paler where the spade left it, and a plain
 * cross of the wood it was made of at its head -- the end away from its
 * front, so the mound runs the way a body lies. The cross is three pieces,
 * the post under the bar, the bar, and the post over it, so nothing is drawn
 * through anything from any side.
 */

/** Turned earth. */
const EARTH: Tone = toneOf('#a8805e', '#5e4450');

/** Clods over a face of the mound: darker and paler lumps, a pebble now and then. */
const clods = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  const T = rand(seed);
  const n = Math.max(2, Math.round(s.w * s.h * 0.6));
  for (let i = 0; i < n; i++) {
    const x = T() * s.w, y = T() * s.h, r = 0.18 + T() * 0.3;
    g.beginPath();
    g.ellipse(x, y, r * 1.3, r, (T() - 0.5) * 0.8, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(k.fill, hex('#4a3440'), 0.35), 0.55) : css(mix(k.fill, [255, 236, 210], 0.22), 0.4);
    g.fill();
  }
  if (T() < 0.5) {
    g.beginPath();
    g.ellipse(T() * s.w, T() * s.h, 0.3, 0.22, 0, 0, TAU);
    g.fillStyle = css(hex('#cfc2bc'), 0.75);
    g.fill();
  }
};

function graveOf(look: KitLook, hd: number): KitModel {
  const WOOD = woodTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The mound: rings of an oval drawn in as they rise, pushed a little about so it is dug and not turned.
  const cy = 1.2, rx = 3.7, ry = hd - 2, N = 16;
  const J = rand(17);
  const jit = Array.from({ length: N }, () => 1 + (J() - 0.5) * 0.08);
  const ringAt = (k: number, z: number): V3[] => jit.map((j, i) => {
    const a = (i / N) * TAU;
    return [Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j, z] as V3;
  });
  add(prism([ringAt(1, 0), ringAt(0.94, 0.9), ringAt(0.78, 1.75), ringAt(0.52, 2.35), ringAt(0.22, 2.6)], EARTH,
    (k, i, s) => ({ crease: 0.12, paint: (g: Ctx, kk: PaintCtx) => clods(k * 40 + i)(g, kk, s) }),
    (s) => ({ crease: 0.12, paint: (g: Ctx, kk: PaintCtx) => { g.save(); g.translate(-s.w / 2, -s.h / 2); clods(9)(g, kk, s); g.restore(); } })));

  // The cross at its head.
  const y = -hd + 1.6, t = 0.45, bar = 6.8;
  const side = (seed: number, along: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, along, 0.7);
  const post = { front: side(1, 'y'), back: side(2, 'y'), left: side(3, 'y'), right: side(4, 'y') };
  add(slab(-t, t, y - t, y + t, 0, bar, WOOD, { corner: 0.1, paint: post }));
  add(slab(-2.5, 2.5, y - t, y + t, bar, bar + 0.95, paler(WOOD, 0.05), { corner: 0.1, bevel: 0.1, paint: { front: side(5, 'x'), back: side(6, 'x'), left: side(7, 'y'), right: side(8, 'y') } }), { edges: true });
  add(slab(-t, t, y - t, y + t, bar + 0.95, bar + 3.4, WOOD, { corner: 0.1, bevel: 0.12, paint: post }), { edges: true });
  // Where the post goes into the ground, the earth a step darker round it.
  add(slab(-0.9, 0.9, y - 0.9, y + 0.9, 0, 0.25, deeper(EARTH, 0.1), { corner: 0.5, bevel: 0.15, crease: 0.15 }), { solid: false, first: true });
  return { parts, shade: [[-rx, cy - ry, 0], [rx, cy - ry, 0], [rx, cy + ry, 0], [-rx, cy + ry, 0]] };
}

export const GRAVE: KitPiece = {
  model: (look, { hd }) => graveOf(look, hd),
  uses: { material: true },
};
