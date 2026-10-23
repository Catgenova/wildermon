import {
  clothTone, css, deeper, extrude, faceColour, grain, hex, lathe, mix, paler, proj, slab, stud, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type RGB, type Side, type Tone, type V3,
} from './core';
import { fielded, rod, spun, stroke } from './turnery';

/**
 * The beds and the tent, in the kit.
 *
 * A bed (`bed`, three subtiles by two) is a double on four square posts with
 * turned finials, the head pair taller: an arched headboard and a low
 * footboard, both fielded in three panels, a gold stud in the crest of the
 * headboard; rails along its sides; a ticking mattress at the head under two
 * plump pillows, and a blanket over the rest with the sheet turned down over
 * its head. The blanket takes the dye; the sheet, pillows and ticking stay
 * linen, the wood stays plain.
 *
 * A cot (`cot`, two by two) is a camp bed: canvas laced between two round
 * poles on four square legs, a stretcher across each end, a pillow at the
 * head and the blanket rolled and tied at the foot. Canvas and roll take
 * the dye.
 *
 * A tent (`tent`, two by two) is a ridge tent: cloth over a ridge pole on a
 * pole at each end, its back closed and its door at its right end (as you
 * face it) open, the two flaps gathered and tied back, guyed out from each
 * pole top to two pegs. All its cloth takes the dye. It has nothing in the
 * wind (its old model had nothing either).
 */

/* ---- painting ------------------------------------------------------------------------ */

/** Wood's grain along a side, up it or along it. */
const woodSide = (seed: number, along: 'x' | 'y', k = 0.7) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);

/** Fielded panels across a board `w` wide from `y0` to `y1`, `n` of them, its grain under them. */
function panels(g: Ctx, f: RGB, w: number, y0: number, y1: number, n: number, seed: number): void {
  g.save();
  g.translate(0, y0);
  grain(g, f, w, y1 - y0, seed, 'y', 0.6);
  g.restore();
  const m = 0.55, gap = 0.45, pw = (w - 2 * m - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) fielded(g, f, m + i * (pw + gap), y0 + 0.5, m + i * (pw + gap) + pw, y1 - 0.5);
}

/** Cloth's soft light: a glow toward its upper left, a little shade toward its far corner. */
function clothLight(g: Ctx, k: PaintCtx, w: number, h: number, cx = 0, cy = 0): void {
  const gr = g.createRadialGradient(cx - w * 0.15, cy + h * 0.15, 0, cx, cy, Math.max(w, h) * 0.75);
  gr.addColorStop(0, css(mix(k.fill, [255, 252, 246], 0.3), 0.45));
  gr.addColorStop(1, css(mix(k.fill, hex('#6a5468'), 0.25), 0.25));
  g.fillStyle = gr;
  g.fillRect(cx - w, cy - h, w * 2, h * 2);
}

/** A row of folds hanging down a side of cloth `w` by `h` (y up): soft dents from the foot, every `step`. */
function folds(g: Ctx, k: PaintCtx, w: number, h: number, step: number, seed: number): void {
  const dark = css(mix(k.fill, hex('#6a5468'), 0.35), 0.45);
  const lite = css(mix(k.fill, [255, 250, 240], 0.4), 0.45);
  for (let x = step * 0.7, i = 0; x < w - step * 0.3; x += step, i++) {
    const r = ((seed * 7 + i * 13) % 5) / 10;
    stroke(g, dark, 0.14, [[x, 0.05], [x + 0.1, h * (0.45 + r)]]);
    stroke(g, lite, 0.1, [[x - 0.22, 0.05], [x - 0.15, h * (0.3 + r * 0.6)]]);
  }
}

/* ---- the bed ------------------------------------------------------------------------- */

/** The bed: half its length (head at its left) and width to the middle of its posts, how thick they are; its heights. */
const L = 13.6, W = 8.6, POST = 1.4;
const HEAD_TOP = 10.1, FOOT_TOP = 6.3, RAIL_Z0 = 2.2, RAIL_Z1 = 3.6;
/** The mattress and blanket: where the blanket starts from the head, its underside and top, and the mattress's top. */
const BLANKET_X = -L + 5, BED_Z0 = 3.0, MAT_Z1 = 5.25, BLANKET_Z1 = 5.6;

function bedOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP = paler(WOOD, 0.1);
  const END = deeper(WOOD, 0.12);
  const LINEN = clothTone();
  const SHEET = paler(LINEN, 0.35);
  const BLANKET = look.tint ? clothTone(look.tint) : deeper(LINEN, 0.42);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The posts, square with their arrises taken off, and a turned finial on each.
  for (const [x, top] of [[-L, HEAD_TOP], [L, FOOT_TOP]]) {
    for (const [i, y] of [-W, W].entries()) {
      add(slab(x - POST / 2, x + POST / 2, y - POST / 2, y + POST / 2, 0, top, WOOD, {
        corner: 0.24, bevel: 0.2,
        paint: { front: woodSide(11 + i + x, 'y'), back: woodSide(13 + i + x, 'y'), left: woodSide(15 + i + x, 'y'), right: woodSide(17 + i + x, 'y') },
      }));
      add(lathe(x, y, [[top - 0.05, 0.62], [top + 0.25, 0.86], [top + 0.62, 0.78], [top + 0.95, 0.42], [top + 1.12, 0.08]], 10, TOP), { edges: true });
    }
  }

  // The headboard: a board between the head posts, its crest arched, three panels in it and a gold stud in the arch.
  const hy = W - POST / 2 - 0.02;
  const crest = (k: number): number => 8.9 + 1.0 * Math.sin(k * Math.PI);
  const headOutline: Pt[] = [[-hy, RAIL_Z0], [hy, RAIL_Z0]];
  for (let i = 0; i <= 8; i++) headOutline.push([hy - (i / 8) * hy * 2, crest(i / 8)]);
  const headFace = (seed: number) => (g: Ctx, k: PaintCtx): void => {
    g.save();
    g.translate(-hy, 0);
    panels(g, k.fill, hy * 2, RAIL_Z0 + 0.2, 8.6, 3, seed);
    g.restore();
    stud(g, 0, 9.35, 0.42);
  };
  add(extrude([-L, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], headOutline, -0.32, 0.32, WOOD, 0.16, { front: headFace(21), back: headFace(22) }), { edges: true });

  // The footboard: a lower board between the foot posts, fielded, under a capping rail.
  add(slab(L - 0.3, L + 0.3, -hy, hy, RAIL_Z0, FOOT_TOP - 0.7, WOOD, {
    paint: {
      left: (g, k, s) => panels(g, k.fill, s.w, 0, s.h, 3, 31),
      right: (g, k, s) => panels(g, k.fill, s.w, 0, s.h, 3, 32),
    },
  }));
  add(slab(L - 0.48, L + 0.48, -hy, hy, FOOT_TOP - 0.7, FOOT_TOP - 0.1, TOP, { bevel: 0.14, paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 33, 'x', 0.5); g.restore(); } } }), { edges: true });

  // The side rails, between the posts.
  for (const [i, y] of [-W, W].entries()) {
    add(slab(-L + POST / 2 + 0.02, L - POST / 2 - 0.02, y - 0.36, y + 0.36, RAIL_Z0, RAIL_Z1, END, {
      bevel: 0.12, paint: { front: woodSide(41 + i, 'x'), back: woodSide(43 + i, 'x') },
    }), { edges: true });
  }

  // The mattress at the head: ticking, its stripes running the length of it.
  const my = W - POST / 2 - 0.08;
  const ticking = (g: Ctx, k: PaintCtx, x0: number, x1: number, y0: number, y1: number): void => {
    const blue = css(mix(k.fill, hex('#7d8fb4'), 0.38), 0.55);
    for (let y = y0 + 0.45; y < y1; y += 0.9) stroke(g, blue, 0.16, [[x0, y], [x1, y]]);
  };
  add(slab(-L + 0.42, BLANKET_X, -my, my, BED_Z0, MAT_Z1, LINEN, {
    corner: 0.5, bevel: 0.32, crease: 0.25,
    paint: {
      top: (g, k, s) => ticking(g, k, -s.w / 2, s.w / 2, -s.h / 2, s.h / 2),
      front: (g, k, s) => ticking(g, k, 0, s.w, 0, s.h),
      back: (g, k, s) => ticking(g, k, 0, s.w, 0, s.h),
    },
  }));

  // The blanket over the rest, the sheet turned down over its head, a band woven across near its foot.
  add(slab(BLANKET_X, L - POST / 2 - 0.05, -my, my, BED_Z0, BLANKET_Z1, BLANKET, {
    corner: 0.55, bevel: 0.38, crease: 0.25,
    paint: {
      top: (g, k, s) => {
        clothLight(g, k, s.w / 2, s.h / 2);
        // `x` runs along the bed from the head, from the middle.
        const x0 = -s.w / 2;
        const sheet = faceColour(SHEET, k.L);
        g.fillStyle = css(sheet);
        g.fillRect(x0 - 0.2, -s.h, 1.6, s.h * 2);
        stroke(g, css(mix(sheet, hex('#6a5468'), 0.3), 0.7), 0.14, [[x0 + 1.4, -s.h], [x0 + 1.4, s.h]]);
        stroke(g, css(mix(sheet, [255, 255, 255], 0.5), 0.7), 0.12, [[x0 + 0.3, -s.h], [x0 + 0.3, s.h]]);
        // The woven bands toward the foot.
        for (const bx of [s.w / 2 - 3.1, s.w / 2 - 2.2]) {
          g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.28), 0.6);
          g.fillRect(bx, -s.h, 0.45, s.h * 2);
        }
        // A crease or two where it lies over the sleeper's place.
        stroke(g, css(mix(k.fill, hex('#6a5468'), 0.3), 0.4), 0.12, [[x0 + 3, -s.h * 0.4], [x0 + 5.5, -s.h * 0.15], [x0 + 8, -s.h * 0.3]]);
        stroke(g, css(mix(k.fill, hex('#6a5468'), 0.3), 0.35), 0.12, [[x0 + 4, s.h * 0.35], [x0 + 7, s.h * 0.2]]);
      },
      front: (g, k, s) => {
        folds(g, k, s.w, s.h, 2.1, 1);
        for (const bx of [s.w - 3.1, s.w - 2.2]) { g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.28), 0.6); g.fillRect(bx, 0, 0.45, s.h); }
        g.fillStyle = css(faceColour(SHEET, k.L));
        g.fillRect(-0.2, 0, 1.6, s.h);
      },
      back: (g, k, s) => {
        folds(g, k, s.w, s.h, 2.1, 2);
        for (const bx of [2.2, 3.1]) { g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.28), 0.6); g.fillRect(bx - 0.45, 0, 0.45, s.h); }
        g.fillStyle = css(faceColour(SHEET, k.L));
        g.fillRect(s.w - 1.4, 0, 1.6, s.h);
      },
      right: (g, k, s) => folds(g, k, s.w, s.h, 2.2, 3),
    },
  }));

  // The pillows: two plump ones side by side at the head, a seam round each.
  for (const [a, b] of [[-my + 0.25, -0.18], [0.18, my - 0.25]]) {
    add(slab(-L + 0.75, -L + 4.35, a, b, MAT_Z1, MAT_Z1 + 1.35, SHEET, {
      corner: 0.9, bevel: 0.6, crease: 0.2,
      paint: { top: (g, k, s) => { clothLight(g, k, s.w / 2, s.h / 2, -0.2, 0.2); stroke(g, css(mix(k.fill, hex('#6a5468'), 0.25), 0.45), 0.12, [[-s.w * 0.3, -s.h * 0.1], [0, s.h * 0.05], [s.w * 0.3, -s.h * 0.1]]); } },
    }));
  }

  return { parts, shade: [[-L - 0.7, -W - 0.7, 0], [L + 0.7, -W - 0.7, 0], [L + 0.7, W + 0.7, 0], [-L - 0.7, W + 0.7, 0]] };
}

/* ---- the cot ------------------------------------------------------------------------- */

/** The cot: half its length (head at its left) and width to its poles, the poles' height and how round. */
const CL = 9, CW = 3.9, CZ = 3.4, POLE_R = 0.46;

function cotOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const END = deeper(WOOD, 0.14);
  // Canvas is unbleached, a step deeper than linen; the blanket is wool, a step deeper again (as the bed's).
  const CANVAS = look.tint ? clothTone(look.tint) : deeper(clothTone(), 0.2);
  const ROLL = look.tint ? deeper(CANVAS, 0.16) : deeper(clothTone(), 0.42);
  const PILLOW = paler(clothTone(), 0.35);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const poleZ = CZ + POLE_R;

  // The legs, square, under the poles, and a stretcher across each end low down.
  for (const [i, x] of [-CL + 0.9, CL - 0.9].entries()) {
    for (const [j, y] of [-CW, CW].entries()) {
      add(slab(x - 0.42, x + 0.42, y - 0.42, y + 0.42, 0, CZ - 0.02, WOOD, {
        corner: 0.12, taper: 0.06, paint: { front: woodSide(51 + i * 2 + j, 'y'), left: woodSide(55 + i * 2 + j, 'y'), right: woodSide(59 + i * 2 + j, 'y'), back: woodSide(63 + i * 2 + j, 'y') },
      }));
    }
    add(slab(x - 0.28, x + 0.28, -CW + 0.44, CW - 0.44, 0.9, 1.45, END, { corner: 0.08 }));
  }

  // The poles, round, the length of it, their ends standing proud of the legs.
  for (const y of [-CW, CW]) add(rod([-CL, y, poleZ], [CL, y, poleZ], POLE_R, WOOD, 8), { edges: true });

  // The canvas laced between them, the laces over the poles, a little sag in its middle.
  const cy = CW - POLE_R - 0.02;
  add(slab(-CL + 0.55, CL - 0.55, -cy, cy, poleZ - 0.18, poleZ + 0.12, CANVAS, {
    crease: 0.25,
    paint: {
      top: (g, k, s) => {
        const gr = g.createLinearGradient(0, -s.h / 2, 0, s.h / 2);
        gr.addColorStop(0, css(mix(k.fill, [255, 252, 244], 0.25), 0.45));
        gr.addColorStop(0.5, css(mix(k.fill, hex('#6a5468'), 0.22), 0.4));
        gr.addColorStop(1, css(mix(k.fill, [255, 252, 244], 0.2), 0.35));
        g.fillStyle = gr;
        g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
        const lace = css(mix(k.fill, hex('#5a4458'), 0.5), 0.75);
        for (let x = -s.w / 2 + 0.7; x < s.w / 2 - 0.4; x += 1.1) {
          stroke(g, lace, 0.15, [[x, s.h / 2 - 0.05], [x + 0.45, s.h / 2 - 0.55]]);
          stroke(g, lace, 0.15, [[x, -s.h / 2 + 0.05], [x + 0.45, -s.h / 2 + 0.55]]);
        }
        // Its hems at the ends.
        stroke(g, css(mix(k.fill, hex('#5a4458'), 0.3), 0.5), 0.13, [[-s.w / 2 + 0.45, -s.h / 2], [-s.w / 2 + 0.45, s.h / 2]]);
        stroke(g, css(mix(k.fill, hex('#5a4458'), 0.3), 0.5), 0.13, [[s.w / 2 - 0.45, -s.h / 2], [s.w / 2 - 0.45, s.h / 2]]);
      },
    },
  }));

  // The pillow at the head.
  const top = poleZ + 0.12;
  add(slab(-CL + 0.9, -CL + 3.5, -cy + 0.5, cy - 0.5, top, top + 1.1, PILLOW, {
    corner: 0.8, bevel: 0.5, crease: 0.2,
    paint: { top: (g, k, s) => clothLight(g, k, s.w / 2, s.h / 2, -0.2, 0.2) },
  }));

  // The blanket rolled at the foot, in three lengths between the two straps tied round it.
  const R = 1.0, rx = CL - 2.5, rz = top + R - 0.05, y0 = -cy + 0.45, y1 = cy - 0.45;
  const STRAP = deeper(WOOD, 0.3);
  const s0 = y0 + 1.1, s1 = y1 - 1.1 - 0.42;
  add(spun([rx, y0, rz], [0, 1, 0], [[0, R * 0.8], [0.22, R], [s0 - y0, R]], 10, ROLL));
  add(spun([rx, s0, rz], [0, 1, 0], [[0, R + 0.07], [0.42, R + 0.07]], 10, STRAP));
  add(spun([rx, s0 + 0.42, rz], [0, 1, 0], [[0, R], [s1 - s0 - 0.42, R]], 10, ROLL));
  add(spun([rx, s1, rz], [0, 1, 0], [[0, R + 0.07], [0.42, R + 0.07]], 10, STRAP));
  add(spun([rx, s1 + 0.42, rz], [0, 1, 0], [[0, R], [y1 - s1 - 0.42 - 0.22, R], [y1 - s1 - 0.42, R * 0.8]], 10, ROLL));
  return { parts, shade: [[-CL, -CW - 0.6, 0], [CL, -CW - 0.6, 0], [CL, CW + 0.6, 0], [-CL, CW + 0.6, 0]] };
}

/* ---- the tent ------------------------------------------------------------------------ */

/** The tent: half its length along its ridge, half its width at its foot, the ridge's height; the door's half width and head. */
const TL = 8.2, TW = 5.2, TH = 8.4, DOOR = 2.8, DOOR_TOP = 7.0;

function tentOf(look: KitLook): KitModel {
  // Canvas, unbleached a step deeper than linen (as the cot's), or the dye.
  const CLOTH = look.tint ? clothTone(look.tint) : deeper(clothTone(), 0.2);
  const WOOD = woodTone(look.material);
  const ROPE: Tone = deeper(clothTone(), 0.35);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The cloth: one A over the ridge from end to end, panels sewn down its slopes, a hem at its foot.
  const outline: Pt[] = [[-TW, 0], [TW, 0], [0, TH]];
  const slope = Math.hypot(TW, TH);
  const seamCol = (k: PaintCtx): string => css(mix(k.fill, hex('#5a4458'), 0.35), 0.6);
  const slopePaint = (footAtStart: boolean) => (g: Ctx, k: PaintCtx): void => {
    // `x` runs down or up the slope, `y` along the ridge from its middle.
    const foot = footAtStart ? 0 : slope;
    const up = footAtStart ? 1 : -1;
    const gr = g.createLinearGradient(foot, 0, foot + up * slope, 0);
    gr.addColorStop(0, css(mix(k.fill, hex('#6a5468'), 0.2), 0.35));
    gr.addColorStop(0.6, css(k.fill, 0));
    gr.addColorStop(1, css(mix(k.fill, [255, 250, 240], 0.3), 0.4));
    g.fillStyle = gr;
    g.fillRect(-1, -TL - 1, slope + 2, TL * 2 + 2);
    for (const y of [-TL / 3, TL / 3]) {
      stroke(g, seamCol(k), 0.16, [[0, y], [slope, y]]);
      stroke(g, css(mix(k.fill, [255, 250, 240], 0.45), 0.5), 0.09, [[0, y + 0.22], [slope, y + 0.22]]);
    }
    // The hem, and a patch at each peg loop.
    g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.18), 0.6);
    g.fillRect(footAtStart ? 0 : slope - 0.55, -TL, 0.55, TL * 2);
    for (const y of [-TL + 0.6, -TL / 3, TL / 3, TL - 0.6]) g.fillRect(footAtStart ? 0 : slope - 1.1, y - 0.4, 1.1, 0.8);
    // A sag between the seams, where the cloth hangs off the ridge.
    for (const y of [-TL * 0.66, 0, TL * 0.66]) stroke(g, css(mix(k.fill, hex('#6a5468'), 0.3), 0.3), 0.14, [[foot + up * slope * 0.15, y - 0.3], [foot + up * slope * 0.75, y + 0.2]]);
  };
  const endPaint = (door: boolean) => (g: Ctx, k: PaintCtx): void => {
    // `x` across the end from its middle (seen from outside), `y` up.
    if (door) {
      const gr = g.createLinearGradient(0, DOOR_TOP, 0, 0);
      gr.addColorStop(0, css(mix(k.fill, hex('#3e3040'), 0.72)));
      gr.addColorStop(1, css(mix(k.fill, hex('#3e3040'), 0.55)));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-DOOR, 0);
      g.lineTo(0, DOOR_TOP);
      g.lineTo(DOOR, 0);
      g.closePath();
      g.fill();
      // The floor cloth inside, catching a little light.
      g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.35));
      g.fillRect(-DOOR * 0.8, 0, DOOR * 1.6, 0.5);
    } else {
      stroke(g, seamCol(k), 0.16, [[0, 0.2], [0, TH - 0.4]]);
      stroke(g, css(mix(k.fill, [255, 250, 240], 0.45), 0.5), 0.09, [[-0.2, 0.2], [-0.2, TH - 0.6]]);
      // A vent at its head.
      g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.55), 0.9);
      g.beginPath();
      g.moveTo(-0.6, TH - 2.2);
      g.lineTo(0, TH - 1.3);
      g.lineTo(0.6, TH - 2.2);
      g.closePath();
      g.fill();
    }
    g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.18), 0.6);
    g.fillRect(-TW, 0, TW * 2, 0.5);
  };
  add(extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, -TL, TL, CLOTH, 0.14, {
    sunk: true,
    front: endPaint(true),
    back: endPaint(false),
    edge: (i) => (i === 1 ? { paint: slopePaint(true), crease: 0.3 } : i === 2 ? { paint: slopePaint(false), crease: 0.3 } : undefined),
  }));

  // The flaps, gathered back from the door either side and tied.
  for (const s of [-1, 1]) {
    const flap: Pt[] = [[s * 0.38, DOOR_TOP + 0.4], [s * (DOOR + 0.2), TH * 0.33], [s * (DOOR + 0.8), 0.05], [s * (DOOR - 0.05), 0.05], [s * (DOOR * 0.9), TH * 0.28]];
    add(extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], flap, TL + 0.04, TL + 0.3, CLOTH, 0.08, {
      front: (g, k) => {
        // The gathers, run down to the tie, and the tie round them.
        const dark = css(mix(k.fill, hex('#6a5468'), 0.35), 0.5);
        stroke(g, dark, 0.13, [[s * 0.9, DOOR_TOP - 0.3], [s * (DOOR + 0.15), TH * 0.36]]);
        stroke(g, dark, 0.13, [[s * (DOOR + 0.35), TH * 0.28], [s * (DOOR + 0.6), 0.3]]);
        g.fillStyle = css(faceColour(ROPE, k.L));
        g.save();
        g.translate(s * (DOOR + 0.3), TH * 0.33);
        g.rotate(-s * 0.5);
        g.fillRect(-0.55, -0.17, 1.1, 0.34);
        g.restore();
      },
    }));
  }

  // The poles at each end, standing out of the cloth, and the ridge pole over them.
  const px = TL + 0.48;
  for (const x of [-px, px]) {
    add(rod([x, 0, 0], [x, 0, TH + 0.7], 0.3, WOOD, 8, (_k, _i, s) => ({ paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 81, 'y', 0.4) })));
  }
  add(rod([-px - 0.35, 0, TH + 0.12], [px + 0.35, 0, TH + 0.12], 0.3, WOOD), { edges: true });

  // The guys, from each pole top out to two pegs.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const a: V3 = [sx * px, 0, TH + 0.25], b: V3 = [sx * 9.7, sy * 3.6, 0];
      parts.push({
        reach: [a, b],
        draw: (g, e) => {
          const [ax, ay] = proj(e, a), [bx, by] = proj(e, b);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(ax, ay);
          g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 0.6, bx, by);
          g.strokeStyle = css(mix(ROPE.shade, hex('#4a3640'), 0.35), 0.9);
          g.lineWidth = 0.55;
          g.stroke();
          g.beginPath();
          g.moveTo(ax, ay);
          g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 0.6, bx, by);
          g.strokeStyle = css(ROPE.lit, 0.9);
          g.lineWidth = 0.25;
          g.stroke();
          // The peg, a hair of wood out of the ground.
          g.fillStyle = css(faceColour(WOOD, 0.9));
          g.strokeStyle = css(mix(WOOD.shade, hex('#3e3040'), 0.4));
          g.lineWidth = 0.35;
          g.beginPath();
          g.ellipse(bx, by - 0.4, 0.42, 0.75, 0, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        },
      });
    }
  }
  return { parts, shade: [[-TL - 0.5, -TW - 0.3, 0], [TL + 0.5, -TW - 0.3, 0], [TL + 0.5, TW + 0.3, 0], [-TL - 0.5, TW + 0.3, 0]] };
}

export const BED: KitPiece = { model: (look) => bedOf(look), uses: { tint: true, material: true } };
export const COT: KitPiece = { model: (look) => cotOf(look), uses: { tint: true, material: true } };
export const TENT: KitPiece = { model: (look) => tentOf(look), uses: { tint: true, material: true } };
