import { rand } from '../ivy';
import { cut } from '../runestone';
import {
  band, css, deeper, faceColour, grain, hex, IRON, KIT_INK, lathe, mix, paler, proj, sheen, slab, TAU, toneOf, woodTone,
  type Ctx, type Eye, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tone, type V3,
} from './core';

import { ashlar, gableRoof, rollX, STONE, stoneSkin, strut } from './outdoor';

/**
 * A well (`well`, two subtiles by two), in the kit: a round of stone walling
 * in courses under a coping, the shaft dark down into it with the water a
 * long way down; two posts of the wood it was built of standing on the
 * coping, a windlass between them -- its drum wound with rope, the rope down
 * to a bucket hanging over the shaft, an iron crank and a turned handle at
 * its right end -- and a shingled gable roof over the lot.
 */

/** The drum's radius, the coping's, the coping's foot and top, and the shaft's radius. */
const R = 7.4, RC = 7.8, LIP = 4.5, ZK = 5.4, HOLE = 5.2;
/** The posts: how far out, and their head under the roof; the windlass's height and its drum's half length and radius. */
const PX = 6.4, POST_TOP = 13.8, ZA = 11.6, DRUM = 2.8, DRUM_R = 1.0;
/** Hemp rope. */
const ROPE: Tone = toneOf('#ead2a4', '#9a7e6c');

const ringAt = (e: Eye, r: number, z: number, n = 40): Pt[] =>
  Array.from({ length: n }, (_, i) => proj(e, [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r, z]));
const poly = (g: Ctx, pts: readonly Pt[]): void => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

/** The coping's top and the shaft down through it, on the screen. */
function wellTop(g: Ctx, k: PaintCtx): void {
  const e = k.e;
  g.save();
  g.setTransform(k.base);
  // The coping's stones, a joint between each.
  const T = rand(91);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.12;
    const [px, py] = proj(e, [Math.cos(a) * HOLE, Math.sin(a) * HOLE, ZK]), [qx, qy] = proj(e, [Math.cos(a) * RC, Math.sin(a) * RC, ZK]);
    cut(g, k.fill, 0.3, () => { g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); });
    const b = a + TAU / 28, r = HOLE + (RC - HOLE) * (0.3 + 0.4 * T());
    const [sx, sy] = proj(e, [Math.cos(b) * r, Math.sin(b) * r, ZK]);
    g.beginPath();
    g.ellipse(sx, sy, 0.8 + T(), 0.38, 0, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.45) : css(mix(k.fill, hex('#9c94a4'), 0.3), 0.3);
    g.fill();
  }
  // The shaft: dark, its far wall in courses going down into it, and the water far down.
  const deep = hex('#3a3244');
  poly(g, ringAt(e, HOLE, ZK));
  g.fillStyle = css(deep);
  g.fill();
  g.save();
  poly(g, ringAt(e, HOLE, ZK));
  g.clip();
  for (let d = 0; d < 4; d++) {
    poly(g, ringAt(e, HOLE, ZK - d * 1.1));
    g.fillStyle = css(mix(faceColour(STONE, 0.6), deep, 0.42 + d * 0.16));
    g.fill();
    poly(g, ringAt(e, HOLE, ZK - (d + 1) * 1.1));
    g.fillStyle = css(deep);
    g.fill();
    // A joint along the foot of each course.
    poly(g, ringAt(e, HOLE, ZK - (d + 1) * 1.1));
    g.strokeStyle = css(mix(deep, hex('#2e2838'), 0.5), 0.6);
    g.lineWidth = 0.3;
    g.stroke();
  }
  const [wx, wy] = proj(e, [0, 0, ZK - 5.5]);
  const across = Math.hypot(e.ux, e.uy);
  g.beginPath();
  g.ellipse(wx, wy, HOLE * 0.7 * across, HOLE * 0.32 * across, 0, 0, TAU);
  g.fillStyle = 'rgba(120, 168, 186, 0.6)';
  g.fill();
  g.beginPath();
  g.ellipse(wx - 1.2, wy - 0.5, 1.8, 0.5, 0, 0, TAU);
  g.fillStyle = 'rgba(226, 242, 248, 0.45)';
  g.fill();
  g.restore();
  poly(g, ringAt(e, HOLE, ZK));
  g.strokeStyle = css(mix(k.fill, KIT_INK, 0.65));
  g.lineWidth = 0.6;
  g.stroke();
  g.restore();
}

function wellOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const ROOF = deeper(WOOD, 0.3);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The round of walling and its coping.
  const drum = lathe(0, 0, [[0, R], [LIP, R], [LIP, RC], [ZK - 0.12, RC], [ZK, RC - 0.12]], 28, STONE, 0.5, (k, i, s) => ({
    crease: k === 0 || k === 2 ? 0.25 : 0.4,
    paint: (g: Ctx, kk: PaintCtx) => {
      if (k === 0) ashlar(g, kk.fill, s.w, s.h, 1.15, 3.4, 10 + i, i * s.w);
      else if (k === 2) {
        stoneSkin(g, kk.fill, s.w, s.h, 40 + i, 1.4);
        if (i % 2 === 0) cut(g, kk.fill, 0.14, () => { g.beginPath(); g.moveTo(0.12, 0.05); g.lineTo(0.12, s.h - 0.05); });
      }
    },
  }));
  drum[drum.length - 1] = { ...drum[drum.length - 1], paint: wellTop };
  add(drum, { edges: true });

  // The posts on the coping.
  for (const [i, x] of [-PX, PX].entries()) {
    const side = (n: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 20 + i * 4 + n, 'y', 0.7);
    add(slab(x - 0.55, x + 0.55, -0.55, 0.55, ZK, POST_TOP, WOOD, { corner: 0.14, paint: { front: side(0), back: side(1), left: side(2), right: side(3) } }));
  }
  // The windlass: the axle through the posts, the drum with its rope, the crank and its handle.
  const axle = deeper(WOOD, 0.1);
  for (const [x0, x1] of [[-7.35, -PX - 0.55], [-PX + 0.55, -DRUM], [DRUM, PX - 0.55], [PX + 0.55, 7.6]]) add(rollX(x0, x1, 0, ZA, 0.36, 6, axle));
  add(rollX(-DRUM, DRUM, 0, ZA, DRUM_R, 12, ROPE, () => ({
    crease: 0.2,
    paint: (g: Ctx, k: PaintCtx) => {
      // The turns of rope round it, each lit along one edge.
      for (let x = 0.15; x < DRUM * 2; x += 0.34) {
        g.beginPath();
        g.moveTo(x, -0.2);
        g.lineTo(x + 0.12, 2);
        g.strokeStyle = css(mix(k.fill, hex('#6a4c48'), 0.4), 0.7);
        g.lineWidth = 0.08;
        g.stroke();
      }
    },
  })), { edges: true });
  // The drum's cheeks, a turned rim of wood at either end.
  for (const x of [-DRUM, DRUM - 0.3]) add(rollX(x, x + 0.3, 0, ZA, DRUM_R + 0.2, 12, WOOD));
  add(strut([7.85, 0, ZA + 0.3], [7.85, 0, ZA - 2.2], 0.5, 0.4, IRON, (g, k, s) => sheen(g, k.fill, s.w, s.h, 5)));
  add(rollX(7.6, 9.2, 0, ZA - 2.0, 0.32, 6, paler(WOOD, 0.1), () => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, 1.6, 2, 7, 'x', 0.5) })));

  // The bucket hanging over the shaft on the rope: staves bound in iron.
  const BX = 0.7, BY = 0.2, B0 = 7.6, B1 = 9.2;
  const bucket = lathe(BX, BY, [[B0, 0.85], [B1, 1.08]], 10, WOOD, 0.5, () => ({
    paint: (g: Ctx, k: PaintCtx) => {
      g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.45), 0.7);
      g.lineWidth = 0.1;
      g.beginPath(); g.moveTo(0.04, 0); g.lineTo(0.04, 2); g.stroke();
      band(g, k, -0.2, 2, 0.18, 0.42, 0, false);
      band(g, k, -0.2, 2, 1.12, 1.36, 0, false);
    },
  }));
  bucket[bucket.length - 1] = { ...bucket[bucket.length - 1], tone: deeper(WOOD, 0.45) };
  add(bucket);
  // The rope off the front of the drum down to the bucket's bail.
  const top: V3 = [BX, DRUM_R + 0.06, ZA], foot: V3 = [BX, BY + 0.1, B1 + 0.9];
  parts.push({
    reach: [top, foot, [BX - 0.9, BY, B1], [BX + 0.9, BY, B1]],
    solid: false,
    draw: (g, e) => {
      const [ax, ay] = proj(e, top), [bx, by] = proj(e, foot);
      const [l0x, l0y] = proj(e, [BX - 1.0, BY, B1]), [l1x, l1y] = proj(e, [BX + 1.0, BY, B1]);
      g.lineCap = 'round';
      // The bail over the bucket, then the rope.
      g.beginPath();
      g.moveTo(l0x, l0y);
      g.quadraticCurveTo(bx, by - 1.2, l1x, l1y);
      g.strokeStyle = css(mix(IRON.shade, KIT_INK, 0.3));
      g.lineWidth = 0.7;
      g.stroke();
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokeStyle = css(mix(ROPE.shade, KIT_INK, 0.5));
      g.lineWidth = 1.1;
      g.stroke();
      g.strokeStyle = css(ROPE.lit);
      g.lineWidth = 0.5;
      g.stroke();
    },
  });

  // The roof over it.
  add(gableRoof(-8.2, 8.2, -3.5, 3.5, POST_TOP, 17.1, ROOF, 61), { edges: true });
  return { parts, shade: Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * TAU) * RC, Math.sin((i / 16) * TAU) * RC, 0] as V3) };
}

export const WELL: KitPiece = {
  model: (look) => wellOf(look),
  uses: { material: true },
};
