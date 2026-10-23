import {
  boards, css, deeper, grain, hex, lathe, mix, paler, proj, slab, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone,
} from './core';
import { rand } from '../ivy';
import { bees, gableRoof } from './outdoor';

/**
 * The bees' houses, in the kit.
 *
 * A hive (`hive`, two subtiles by one): three boxes stacked on a stand of
 * four legs, painted pale -- cream and sage by turns, or the dye -- under a
 * crown board and a shingled gable roof of the wood it was built of; a
 * handhold cut in each side of each box, the entrance a slot along the foot
 * of the brood box's front over a landing board, and a few bees about it.
 *
 * A skep (`skep`, one subtile): a dome of coiled straw, each coil bound to the
 * next, on a plank stand of the wood it was built of, its mouth an arch at the
 * foot of its front, and a few bees about it.
 */

/* ---- the hive ------------------------------------------------------------------------- */

/** The boxes: half their length and depth, and where each one's foot is (the last its head). */
const BX = 6.2, BY = 3.8;
const BOX_Z = [3.2, 6.6, 8.8, 11];

/** A box's paint over its boards: a hair of the grain through it, a handhold, and on the brood box the entrance along its foot. */
function boxSide(seed: number, entrance: boolean) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    grain(g, k.fill, s.w, s.h, seed, 'x', 0.45);
    const dark = css(mix(k.fill, hex('#3e3040'), 0.72));
    const lip = css(mix(k.fill, [255, 250, 238], 0.5), 0.8);
    if (entrance) {
      // The entrance: a long low slot along the foot, the light on the board under it.
      g.fillStyle = dark;
      g.fillRect(s.w * 0.25, 0.75, s.w * 0.5, 0.6);
      g.fillStyle = lip;
      g.fillRect(s.w * 0.25, 0.63, s.w * 0.5, 0.12);
    } else {
      // A handhold: a scoop cut in, dark in its head and lit along its foot.
      const y = s.h * 0.55;
      g.beginPath();
      g.ellipse(s.w / 2, y, Math.min(1.2, s.w * 0.2), 0.3, 0, 0, Math.PI * 2);
      g.fillStyle = dark;
      g.fill();
      g.fillStyle = lip;
      g.fillRect(s.w / 2 - Math.min(1.0, s.w * 0.17), y - 0.36, Math.min(2.0, s.w * 0.34), 0.09);
    }
  };
}

/** The pale the boxes are painted, by turns, over the wood they were built of; or the dye, a step paler by turns. */
function boxPaint(look: KitLook): [Tone, Tone] {
  if (look.tint) {
    const t = woodTone(look.material, look.tint, 0.75);
    return [t, paler(t, 0.18)];
  }
  const w = woodTone(look.material);
  return [
    { lit: mix(w.lit, hex('#fbf2e2'), 0.55), shade: mix(w.shade, hex('#a2909e'), 0.45) },
    { lit: mix(w.lit, hex('#cfe3c4'), 0.6), shade: mix(w.shade, hex('#84968e'), 0.5) },
  ];
}

function hiveOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material);
  const STAND = deeper(WOOD, 0.12);
  const ROOF = deeper(WOOD, 0.3);
  const [A, B] = boxPaint(look);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const sx = hw - 1.8, sy = hd - 1.4;
  // The stand: four square legs and a board over them.
  for (const [i, x] of [-sx + 1.4, sx - 1.4].entries()) for (const [j, y] of [-sy + 0.8, sy - 0.8].entries()) {
    const leg = (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 3 + i * 2 + j, 'y', 0.6);
    add(slab(x - 0.48, x + 0.48, y - 0.48, y + 0.48, 0, 2.6, WOOD, { corner: 0.12, taper: 0.05, paint: { front: leg, back: leg, left: leg, right: leg } }));
  }
  const edge = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'x', 0.5);
  add(slab(-sx, sx, -sy, sy, 2.6, 3.2, STAND, {
    corner: 0.2, bevel: 0.1,
    paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 11); g.restore(); }, front: edge(12), back: edge(13), left: edge(14), right: edge(15) },
  }), { edges: true });
  // The boxes, the brood box at the foot, painted by turns.
  for (let i = 0; i < 3; i++) {
    const side = (n: number): ((g: Ctx, k: PaintCtx, s: Side) => void) => boxSide(20 + i * 5 + n, i === 0 && n === 0);
    add(slab(-BX, BX, -BY, BY, BOX_Z[i], BOX_Z[i + 1], i % 2 ? B : A, {
      corner: 0.18, bevel: 0.1,
      paint: { front: side(0), back: side(1), left: side(2), right: side(3) },
    }));
  }
  // The crown board over them, and the roof.
  add(slab(-BX - 0.35, BX + 0.35, -BY - 0.35, BY + 0.35, 11, 11.5, B, { corner: 0.15, bevel: 0.1 }), { edges: true });
  add(gableRoof(-BX - 0.9, BX + 0.9, -BY - 0.95, BY + 0.95, 11.5, 13.35, ROOF, 41), { edges: true });
  // The landing board out from the entrance.
  add(slab(-3.2, 3.2, BY, BY + 1.2, 3.2, 3.5, STAND, { corner: 0.1, paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 51, 'x', 0.6); g.restore(); } } }), { edges: true });
  parts.push(bees([[-2.2, 6.4, 5], [0.6, 7.0, 6.4], [2.6, 5.8, 4.4], [1.2, 5.4, 3.9], [-0.8, 6.8, 7.4]]));
  return { parts, shade: [[-sx - 0.3, -sy - 0.3, 0], [sx + 0.3, -sy - 0.3, 0], [sx + 0.3, sy + 0.3, 0], [-sx - 0.3, sy + 0.3, 0]] };
}

export const HIVE: KitPiece = {
  model: (look, { hw, hd }) => hiveOf(look, hw, hd),
  uses: { tint: true, material: true },
};

/* ---- the skep ---------------------------------------------------------------------------- */

/** Straw, sun-bleached on top and mauve in the shade; and the bramble it is bound with. */
const STRAW: Tone = toneOf('#efca76', '#9c7460');
const COIL_FOOT: Tone = { lit: mix(STRAW.lit, hex('#a07448'), 0.5), shade: mix(STRAW.shade, hex('#5a4048'), 0.3) };
/** The dome: its radius up its height, from the stand (`skep` in furniture.ts). */
const DOME: Array<[number, number]> = [[2.2, 3.2], [3.4, 3.45], [4.8, 3.35], [6, 2.95], [7, 2.3], [7.7, 1.45], [8.1, 0.6], [8.25, 0]];
const domeR = (z: number): number => {
  for (let i = 1; i < DOME.length; i++) {
    const [z0, r0] = DOME[i - 1], [z1, r1] = DOME[i];
    if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  }
  return 0;
};
/** How many coils, and how many sides it is turned in. */
const COILS = 7, SIDES = 16;
/** The side of the dome its front looks out of: the one centred on +y. */
const FRONT_SIDE = SIDES / 4 - 1;

/** The skep's mouth, on the screen: an arch over the stand on the face of the dome, dark in it. */
function mouth(g: Ctx, k: PaintCtx): void {
  const on = (x: number, z: number): [number, number] => {
    const r = domeR(z) + 0.1;
    return proj(k.e, [x, Math.sqrt(Math.max(0, r * r - x * x)), z]);
  };
  g.save();
  g.setTransform(k.base);
  g.beginPath();
  const W = 0.85, Z0 = 2.22, Z1 = 3.05, TOP = 3.55;
  const pts: Array<[number, number]> = [on(-W, Z0), on(-W, Z1)];
  for (let j = 1; j < 8; j++) {
    const a = Math.PI - (j / 8) * Math.PI;
    pts.push(on(Math.cos(a) * W, Z1 + Math.sin(a) * (TOP - Z1)));
  }
  pts.push(on(W, Z1), on(W, Z0));
  pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = css(hex('#4a3238'));
  g.fill();
  g.strokeStyle = css(mix(k.fill, hex('#5a3e3c'), 0.5), 0.9);
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();
}

function skepOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The stand: two runners and a board across them.
  for (const [i, x] of [-2.6, 2.6].entries()) {
    const side = (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 5 + i, 'x', 0.6);
    add(slab(x - 0.55, x + 0.55, -2.7, 2.7, 0, 1.6, deeper(WOOD, 0.1), { corner: 0.12, paint: { left: side, right: side, front: side, back: side } }));
  }
  const edge = (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 9, 'x', 0.5);
  add(slab(-3.8, 3.8, -3.8, 3.8, 1.6, 2.2, WOOD, {
    corner: 0.25, bevel: 0.1,
    paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); boards(g, k.fill, s.w, s.h, 3, 7, 'y'); g.restore(); }, front: edge, back: edge, left: edge, right: edge },
  }), { edges: true });

  // The dome: each coil swelling out of the groove under it, bound to the next at the groove.
  const top = 7.95, base = 2.2, ch = (top - base) / COILS;
  const profile: Array<[number, number]> = [];
  for (let c = 0; c < COILS; c++) {
    const z = base + c * ch;
    profile.push([z, domeR(z) - (c ? 0.3 : 0.02)], [z + ch * 0.5, domeR(z + ch * 0.5) + 0.12]);
  }
  profile.push([top, domeR(top) - 0.1], [top + 0.18, 0.55], [8.3, 0.05]);
  const BIND = mix(STRAW.lit, hex('#7a5638'), 0.6);
  add(lathe(0, 0, profile, SIDES, STRAW, 0.5, (k, i, s) => ({
    crease: k % 2 ? 0.12 : 0.4,
    // The foot of each coil turned down from the light, a step deeper, so the coils read as bands.
    ...(k % 2 === 0 && k < COILS * 2 ? { tone: COIL_FOOT } : {}),
    paint: (g: Ctx, kk: PaintCtx) => {
      const T = rand(k * 31 + i * 7 + 1);
      // The straw: short strands along the coil, some paler, some deeper.
      g.lineCap = 'round';
      for (let n = 0; n < 4; n++) {
        const y = ((n + 0.5) / 4) * s.h, x0 = T() * s.w * 0.4 - 0.2;
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 + s.w * (0.5 + T() * 0.6), y + (T() - 0.5) * 0.08);
        g.strokeStyle = T() < 0.5 ? css(mix(kk.fill, [255, 250, 230], 0.45), 0.5) : css(mix(kk.fill, hex('#7a5a50'), 0.3), 0.4);
        g.lineWidth = 0.08;
        g.stroke();
      }
      if (k % 2 === 0 && k > 0) {
        // The groove under each coil in shadow, and the binding over it, a stitch every other side.
        g.fillStyle = css(mix(kk.fill, hex('#5a3e3c'), 0.55), 0.8);
        g.fillRect(-0.2, -0.12, s.w + 0.4, 0.2);
        if ((i + k / 2) % 2 === 0) {
          g.beginPath();
          g.moveTo(s.w * 0.25, -0.15);
          g.lineTo(s.w * 0.7, s.h * 0.6);
          g.strokeStyle = css(mix(BIND, kk.fill, 0.15), 0.95);
          g.lineWidth = 0.24;
          g.stroke();
        }
      }
    },
    // The mouth: an arch cut at the foot of the front, laid over the coils it is cut through.
    ...(i === FRONT_SIDE && k === 0 ? { over: (g: Ctx, kk: PaintCtx) => mouth(g, kk) } : {}),
  })), { edges: false });
  parts.push(bees([[-1.6, 4.4, 4.6], [1.2, 4.6, 3.6], [2.4, 3.6, 6]]));
  return { parts, shade: [[-3.8, -3.8, 0], [3.8, -3.8, 0], [3.8, 3.8, 0], [-3.8, 3.8, 0]] };
}

export const SKEP: KitPiece = {
  model: (look) => skepOf(look),
  uses: { material: true },
};
