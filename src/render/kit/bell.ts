import { materialOf } from '../../game/materials';
import { ANVIL_METALS } from '../forge';
import {
  css, deeper, faceColour, grain, hex, IRON, KIT_INK, lathe, metalTone, mix, proj, sheen, slab, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';
import { gableRoof, strut } from './outdoor';

/**
 * A bell (`bell`, one subtile), in the kit: the bell cast in the metal it was
 * cast of (bronze when it does not say), hung from an iron strap in a timber
 * frame -- two posts on sills, braced at their feet, a header beam across
 * their heads under a little shingled gable roof -- its clapper showing under
 * the lip and the rope hanging from it.
 */

/** The posts: how far out, and their head. */
const X = 3.9, H = 16.4;
/** Hemp rope. */
const ROPE: Tone = toneOf('#ead2a4', '#9a7e6c');

/** The metal a bell was cast of, by the name its item gives: bronze when it does not say or names none of the anvils' metals. */
export function castTone(material: string | undefined, fallback = 'bronze'): Tone {
  const id = materialOf(material)?.id ?? material?.toLowerCase() ?? '';
  return metalTone(ANVIL_METALS[id] ? id : fallback);
}

function bellOf(look: KitLook): KitModel {
  const WOOD = deeper(woodTone(), 0.36);
  const METAL = castTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const along = (seed: number, dir: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, dir, 0.6);
  for (const [i, px] of [-X, X].entries()) {
    add(slab(px - 0.62, px + 0.62, -3.4, 3.4, 0, 1, deeper(WOOD, 0.12), { corner: 0.15, bevel: 0.12, paint: { left: along(3 + i, 'x'), right: along(5 + i, 'x'), front: along(7 + i, 'x'), back: along(9 + i, 'x') } }), { edges: true });
    add(slab(px - 0.5, px + 0.5, -0.5, 0.5, 1, H, WOOD, { corner: 0.12, paint: { left: along(11 + i, 'y'), right: along(13 + i, 'y'), front: along(15 + i, 'y'), back: along(17 + i, 'y') } }));
    for (const s of [-1, 1]) add(strut([px, s * 2.8, 1.25], [px, s * 0.85, 5.1], 0.55, 0.55, WOOD, (g, k, sd) => grain(g, k.fill, sd.w, sd.h, 21 + i + s, 'x', 0.5), [1, 0, 0]));
  }
  add(slab(-X - 0.8, X + 0.8, -0.62, 0.62, H, H + 1.2, WOOD, { corner: 0.12, bevel: 0.1, paint: { front: along(31, 'x'), back: along(32, 'x'), left: along(33, 'x'), right: along(34, 'x') } }), { edges: true });
  add(gableRoof(-X - 1.7, X + 1.7, -2.7, 2.7, H + 1.2, H + 3.6, deeper(WOOD, 0.3), 41), { edges: true });
  // The strap it hangs from, and the bell: a crown, a waist, a flared lip, two raised rings round it.
  add(slab(-0.42, 0.42, -0.3, 0.3, 14.5, H, IRON, { paint: { front: (g, k, s) => sheen(g, k.fill, s.w, s.h, 3), back: (g, k, s) => sheen(g, k.fill, s.w, s.h, 4) } }));
  const RINGS = [9.5, 13];
  add(lathe(0, 0, [[8.6, 3], [8.95, 3.05], [9.4, 2.72], [11, 2.02], [13.2, 1.8], [14.2, 1.42], [14.6, 0.7], [14.75, 0.1]], 16, METAL, 0.5, (k, _i, s) => ({
    crease: 0.15,
    paint: (g: Ctx, kk: PaintCtx) => {
      sheen(g, kk.fill, s.w, s.h, k * 7 + 1);
      // The raised rings, lit along their heads.
      const lo = [8.6, 8.95, 9.4, 11, 13.2, 14.2, 14.6][k] ?? 0;
      for (const z of RINGS) {
        const y = z - lo;
        if (y < -0.3 || y > s.h + 0.3) continue;
        g.fillStyle = css(mix(kk.fill, hex('#3e3448'), 0.35), 0.8);
        g.fillRect(-0.2, y - 0.14, s.w + 0.4, 0.14);
        g.fillStyle = css(mix(kk.fill, [255, 252, 240], 0.55), 0.85);
        g.fillRect(-0.2, y, s.w + 0.4, 0.12);
      }
    },
  })), { edges: true });
  // The clapper under the lip, and the rope down from it.
  const clapper = add(lathe(0, 0, [[7.75, 0.3], [7.95, 0.58], [8.4, 0.58], [8.65, 0.3]], 10, IRON));
  const top: V3 = [0, 0, 7.75], foot: V3 = [0, 0.8, 3.4];
  parts.push({
    reach: [top, foot], solid: false, after: [clapper],
    draw: (g, e) => {
      const [ax, ay] = proj(e, top), [bx, by] = proj(e, foot);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2 + 0.6, (ay + by) / 2, bx, by);
      g.strokeStyle = css(mix(ROPE.shade, KIT_INK, 0.5));
      g.lineWidth = 1.2;
      g.stroke();
      g.strokeStyle = css(faceColour(ROPE, 0.95));
      g.lineWidth = 0.55;
      g.stroke();
      // A knot at its end.
      g.beginPath();
      g.arc(bx, by, 0.75, 0, Math.PI * 2);
      g.fillStyle = css(mix(ROPE.shade, KIT_INK, 0.5));
      g.fill();
      g.beginPath();
      g.arc(bx - 0.15, by - 0.15, 0.45, 0, Math.PI * 2);
      g.fillStyle = css(ROPE.lit);
      g.fill();
    },
  });
  return { parts, shade: [[-X - 0.8, -3.4, 0], [X + 0.8, -3.4, 0], [X + 0.8, 3.4, 0], [-X - 0.8, 3.4, 0]] };
}

export const BELL: KitPiece = {
  model: (look) => bellOf(look),
  uses: { material: true },
};
