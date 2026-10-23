import { HEIGHT_SCALE } from '../iso';
import { rand } from '../ivy';
import { DRESSED, flame, FOOTING, glow, lilac, ringCourses, speckle, STONE } from './hearthstone';
import {
  band, css, hex, lathe, mix, proj, TAU,
  type Ctx, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type V3,
} from './core';

/**
 * A brazier (`brazier`, one subtile), in the kit: a shallow bowl of dressed
 * stone bound in two iron bands, on a turned shaft of coursed stone over a
 * round foot. In the bowl a bed of coals in grey ash; lit, the coals glow and
 * a fire stands up off them.
 */

/** The foot and shaft, [height, radius] from the floor up. */
const SHAFT: Array<[number, number]> = [[0, 2.5], [0.7, 2.5], [1.0, 1.85], [1.4, 1.6], [4.6, 1.3], [5.0, 1.7], [5.25, 2.05]];
/** The bowl, from the shaft's head to its rim. */
const RIM = 7.7, RIM_R = 4.6;
const BOWL: Array<[number, number]> = [[5.25, 2.05], [6.0, 3.45], [7.0, 4.35], [RIM, RIM_R]];
/** Where its two bands go round it, and the hollow inside its rim. */
const BANDS = [5.9, 7.4], HOLLOW_R = 3.9;
/** The fire on the coals: how wide and how tall. */
const FIRE_W = 5.6, FIRE_H = 7.6;

/** The coals in the bowl, on its top in the top's frame from its middle: ash, and the coals in it glowing or dead. */
function coals(lit: boolean) {
  return (g: Ctx, k: PaintCtx): void => {
    // The rim's dressed top, and the hollow inside it.
    g.beginPath();
    g.ellipse(0, 0, HOLLOW_R + 0.15, HOLLOW_R + 0.15, 0, 0, TAU);
    g.fillStyle = css(mix(k.fill, hex('#5a4e5e'), 0.5));
    g.fill();
    g.beginPath();
    g.ellipse(0, 0, HOLLOW_R - 0.15, HOLLOW_R - 0.15, 0, 0, TAU);
    g.fillStyle = lit ? '#b8483a' : '#4c4250';
    g.fill();
    const T = rand(7);
    for (let i = 0; i < 16; i++) {
      const a = T() * TAU, r = Math.sqrt(T()) * (HOLLOW_R - 0.7);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      g.beginPath();
      g.ellipse(x, y, 0.6 + 0.25 * T(), 0.45 + 0.2 * T(), T() * 3, 0, TAU);
      g.fillStyle = lit ? (i % 3 ? '#ffb456' : '#fff0c4') : i % 3 ? '#2e262e' : '#9a8e94';
      g.fill();
    }
    if (lit) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, 0, 0, HOLLOW_R, 0.4, '255, 170, 90');
      g.restore();
    }
  };
}

/** A band of iron round a turned side, at `z` over the floor, `w` deep. */
function ironAt(z: number, w: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const y = z - s.o[2];
    if (y + w / 2 < 0 || y - w / 2 > s.h) return;
    band(g, k, -0.4, s.w + 0.4, y - w / 2, y + w / 2, 1, false);
  };
}

function brazierOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  // The foot and the shaft, coursed.
  parts.push({
    faces: lathe(0, 0, SHAFT, 12, STONE, 0.5, (k, i, s) => ({
      crease: 0.2,
      paint: (g: Ctx, kk: PaintCtx) => {
        if (k === 3) { speckle(g, kk.fill, s.w, s.h, 3 + i, 0.6); ringCourses(g, kk.fill, s, i, 11 + i, 1.1); }
        lilac(g, kk.L, s.w, s.h);
      },
    })),
    edges: true,
  });
  // The bowl, dressed and banded, its coals on its top.
  const bands = BANDS.map((z) => ironAt(z, 0.55));
  const bowl: KitPart = {
    faces: lathe(0, 0, BOWL, 14, DRESSED, 0.5, (_k, i, s) => ({
      crease: 0.16,
      paint: (g: Ctx, kk: PaintCtx) => {
        speckle(g, kk.fill, s.w, s.h, 30 + i, 0.5);
        lilac(g, kk.L, s.w, s.h);
        for (const b of bands) b(g, kk, s);
      },
    })).map((f, j, all) => (j === all.length - 1 ? { ...f, tone: FOOTING, paint: coals(look.lit) } : f)),
    edges: true,
  };
  parts.push(bowl);
  // Lit, the fire standing up off the coals, and its light round it.
  if (look.lit) {
    const reach: V3[] = [[-FIRE_W / 2, -FIRE_W / 2, RIM], [FIRE_W / 2, FIRE_W / 2, RIM], [-FIRE_W / 2, FIRE_W / 2, RIM + FIRE_H], [FIRE_W / 2, -FIRE_W / 2, RIM + FIRE_H]];
    parts.push({
      reach, after: [bowl],
      draw: (g, e) => {
        const [x, y] = proj(e, [0, 0, RIM]);
        const W = FIRE_W * Math.hypot(e.ux, e.vx) * 0.5, H = FIRE_H * HEIGHT_SCALE;
        glow(g, x, y - H * 0.3, W * 2.4, 0.4);
        flame(g, x, y + 0.5, W, H, 5, look.frame ?? 0);
      },
    });
  }
  return { parts, shade: [[-3.4, -3.4, 0], [3.4, -3.4, 0], [3.4, 3.4, 0], [-3.4, 3.4, 0]] };
}

export const BRAZIER: KitPiece = {
  model: (look) => brazierOf(look),
  uses: { lit: true },
  flicker: 4,
};
