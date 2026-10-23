import { materialOf } from '../../game/materials';
import { cut } from '../runestone';
import {
  css, hex, lathe, mix, sheen, slab,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone,
} from './core';
import { castTone } from './bell';
import { ashlar, BLOCK, DRESSED, mossCushion, mossOf, mossSide, mossTop, mossAt, overlaid, stoneSkin, strut, type Mossed } from './outdoor';

/**
 * A statue (`statue`, one subtile), in the kit: a robed figure with a staff,
 * cast in the metal it was cast of -- bronze, gone green, when it does not
 * say -- on a plinth of dressed stone: a base, a die in ashlar with a sunk
 * panel cut with two lines in its front, and a cornice. It gathers moss
 * (`greening.ts`) as its trim says (`mossTrim`): on its ledges and up its
 * foot, more on its shady sides, and on the figure's head and shoulders
 * once it is well on.
 */

/** Its plinth: the base's half width and head, the die's, the cornice's. */
const BASE = 4.4, BASE_Z = 0.8, DIE = 3.6, DIE_Z = 4.4, CORNICE = 4, Z = 5.1;

/** Bronze or copper weathered to verdigris; any other metal as it was cast. */
function figureTone(material: string | undefined): Tone {
  const id = materialOf(material)?.id ?? material?.toLowerCase() ?? 'bronze';
  const t = castTone(material);
  if (material && id !== 'bronze' && id !== 'copper') return t;
  return { lit: mix(t.lit, hex('#a6d2bc'), 0.75), shade: mix(t.shade, hex('#4c7672'), 0.7) };
}

/** Moss on whichever of a solid's upright sides and its top a rule says. */
function mossed(faces: Face[], m: Mossed | null, salt: number, top?: [number, number, number, number, number]): Face[] {
  if (!m) return faces;
  return overlaid(faces, (f) => {
    if (Math.abs(f.n[2]) < 0.2 && Math.max(Math.abs(f.n[0]), Math.abs(f.n[1])) > 0.95) return mossSide(m, salt + Math.round(f.n[0] * 3 + f.n[1] * 7))(f);
    if (top && f.n[2] > 0.95) return mossTop(m, salt + 50, ...top);
    return undefined;
  });
}

function statueOf(look: KitLook): KitModel {
  const m = mossOf(look.trim);
  const METAL = figureTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 1.2);
  const dressed = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => ashlar(g, k.fill, s.w, s.h, 1.8, 3.6, seed);
  // The panel in the die's front: sunk, and cut with two lines.
  const panel = (g: Ctx, k: PaintCtx, s: Side): void => {
    stoneSkin(g, k.fill, s.w, s.h, 21, 1);
    const x0 = 0.9, x1 = s.w - 0.9, y0 = 0.8, y1 = s.h - 0.8;
    cut(g, k.fill, 0.24, () => { g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); });
    g.fillStyle = css(mix(k.fill, hex('#9c8c9a'), 0.18), 0.6);
    g.fillRect(x0 + 0.12, y0 + 0.12, x1 - x0 - 0.24, y1 - y0 - 0.24);
    for (const t of [s.h * 0.45, s.h * 0.62]) cut(g, k.fill, 0.18, () => { g.beginPath(); g.moveTo(1.6, t); g.lineTo(s.w - 1.6, t); });
  };
  add(mossed(slab(-BASE, BASE, -BASE, BASE, 0, BASE_Z, BLOCK, { corner: 0.2, bevel: 0.15, paint: { front: skin(1), back: skin(2), left: skin(3), right: skin(4) } }), m, 11, [-BASE, BASE, -BASE, BASE, BASE_Z]), { edges: true });
  add(mossed(slab(-DIE, DIE, -DIE, DIE, BASE_Z, DIE_Z, BLOCK, { corner: 0.15, paint: { front: panel, back: dressed(22), left: dressed(23), right: dressed(24) } }), m, 21));
  add(mossed(slab(-CORNICE, CORNICE, -CORNICE, CORNICE, DIE_Z, Z, DRESSED, { corner: 0.2, bevel: 0.25 }), m, 31, [-CORNICE, CORNICE, -CORNICE, CORNICE, Z]), { edges: true });

  // The figure: a robe falling in folds from the shoulders, the head over it, the arms, and the staff in its right hand.
  const fold = (k: number, i: number, s: Side) => (g: Ctx, kk: PaintCtx): void => {
    sheen(g, kk.fill, s.w, s.h, k * 17 + i);
    if (k < 3 && i % 2 === 0) {
      g.beginPath();
      g.moveTo(s.w * 0.5, 0);
      g.lineTo(s.w * 0.45, s.h);
      g.strokeStyle = css(mix(kk.fill, hex('#2e4440'), 0.45), 0.55);
      g.lineWidth = 0.14;
      g.stroke();
    }
  };
  add(lathe(0, 0, [[Z, 2.1], [Z + 0.6, 2.0], [Z + 4.2, 1.45], [Z + 6.2, 1.2], [Z + 6.9, 1.55], [Z + 7.5, 1.3], [Z + 7.9, 0.5]], 12, METAL, 0.5, (k, i, s) => ({ crease: 0.2, paint: fold(k, i, s) })), { edges: true });
  const head = add(lathe(0, 0.15, [[Z + 7.85, 0.5], [Z + 8.2, 0.85], [Z + 9, 0.92], [Z + 9.5, 0.7], [Z + 9.85, 0.2]], 10, METAL, 0.5, () => ({ crease: 0.15 })), { edges: true });
  add(strut([1.3, 0.2, Z + 7], [2.3, 1, Z + 5.4], 0.72, 0.72, METAL));
  add(strut([-1.3, 0.2, Z + 7], [-0.95, 1.05, Z + 5.0], 0.72, 0.72, METAL));
  add(strut([2.5, 1, Z], [2.5, 1, Z + 11.2], 0.55, 0.55, METAL, (g, k, s) => sheen(g, k.fill, s.w, s.h, 9)));
  add(lathe(2.5, 1, [[Z + 11.15, 0.3], [Z + 11.55, 0.6], [Z + 12, 0.15]], 8, METAL), { edges: true });
  // The moss on its head and shoulders once it is well on.
  if (m && m.k > 0.4) {
    const spots: Array<[number, number, number]> = [[0, 0.15, Z + 9.85], [-1.25, 0.2, Z + 8], [1.25, 0.2, Z + 8]];
    spots.slice(0, m.k > 0.7 ? 3 : 1).forEach((at, i) => parts.push({ ...mossCushion(at, (0.55 + 0.35 * m.k) * (i ? 0.8 : 1)), after: [head] }));
  }
  return { parts, shade: [[-BASE, -BASE, 0], [BASE, -BASE, 0], [BASE, BASE, 0], [-BASE, BASE, 0]] };
}

export const STATUE: KitPiece = {
  model: (look) => statueOf(look),
  uses: { trim: true, material: true },
  states: [
    { trim: mossAt(2), label: 'moss 2' },
    { trim: mossAt(5), label: 'moss 5' },
    { trim: mossAt(7), label: 'moss 7' },
    { trim: mossAt(7, 'n'), label: 'moss 7 n' },
  ],
};
