import { BLOOM_KINDS, TOPIARY_SHAPES, HEDGE_CLIPS, BONSAI_STEPS, BIRDS_MOST, CHIME_STILL, STAND_HOLDS } from '../../game/gardendefs';
import { WALL_THICK } from '../../game/building';
import { CROP_STAGES, RIPE } from '../../game/farming';
import { planterRow, planterTall, DAMP_SOIL, DRY_SOIL } from '../crops';
import { planterHolds } from '../plantertrim';
import { rand } from '../ivy';
import { UNITS_PER_TILE } from '../iso';
import { eyeOfView, FLOWER, flowerClump } from '../runestone';
import {
  KIT_INK as KIT_INK_RGB, boards, BRASS, clothTone, css, deeper, grain, hex, IRON, lathe, mix, nail, paler, proj, slab, TAU, toneOf, woodTone,
  type Ctx, type Eye, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type KitAir, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { leg, rod, woodSides } from './woodwork';
import { gableRoof, strut } from './outdoor';
import { benchOf } from './seating';
import { climbingRoses, jit, leaf, roseOf, roseTrim } from './rosearch';

/**
 * The garden pieces (`garden.ts`), in the kit: beds, a window box and a
 * hanging basket of wildflowers; a herb box; a topiary tub; a potted fern and
 * palm and a stand for them; a hedge; a wisteria pergola; a bonsai on its
 * stand; a flower cart; a birdhouse; an arbour bench; a carved wildermon
 * figure; a trophy plaque; a folding screen; and a wind chime.
 *
 * Each piece's `trim` is what it holds and how far it has grown, worked out
 * by the renderer off what the island keeps (`gardenTrim`), and read back
 * here by the same sums.
 */

/* ---- the palette ------------------------------------------------------------------------ */

/** Terracotta: a fired clay pot. */
const CLAY: Tone = toneOf('#f4c4a2', '#bb8a88');
/** Garden earth, its shade toward the kit's mauve (the planter's). */
const EARTH: Tone = toneOf('#866650', '#4a3844');
/** Leaves, lit, mid and deep, and their ink: box and yew a step bluer than a rose's. */
const LEAF: RGB[] = [hex('#b4d89a'), hex('#76a874'), hex('#4b7656')];
const BOX: RGB[] = [hex('#c2e2b2'), hex('#86b88c'), hex('#5c8a6c')];
const LEAF_INK: RGB = mix(BOX[2], hex('#5a3a30'), 0.3);
const STEM: RGB = hex('#7d6a50');
/** Wisteria: its racemes, lit and shaded, and the pale tip. */
const WISTERIA: Array<[RGB, RGB]> = [[hex('#b9a2ea'), hex('#7a62b4')], [hex('#a68ce0'), hex('#6a52a6')], [hex('#cbb6f0'), hex('#8c76c2')]];
const WIST_TIP: RGB = hex('#e8def8');
const INK = 0.8;

/**
 * A trim as these pieces carry it: one more than what it says, so that none
 * at all (nought, or unsaid) is the piece as the game measures it -- grown,
 * in flower, full (`FURNITURE_HEIGHT`).
 */
const said = (trim: number | undefined, full: number): number => (trim && trim > 0 ? Math.floor(trim) - 1 : full);

/** Pixels on the screen for a unit across, at this turn. */
const across = (e: Eye): number => Math.hypot(e.ux, e.vx);

/* ---- small helpers ------------------------------------------------------------------------ */

/** A clay pot: a flared lathe with a rolled rim, its foot at (x, y, z), `r` its rim's radius and `h` its height. */
function pot(x: number, y: number, z: number, r: number, h: number, tone: Tone = CLAY): Face[] {
  return lathe(x, y, [[z, r * 0.68], [z + h * 0.82, r * 0.92], [z + h * 0.82, r * 1.02], [z + h, r * 1.02], [z + h, r * 0.86]], 10, tone, 0.5,
    (k) => ({ crease: k === 1 ? 0.35 : 0.22 }));
}

/** A lobed mass of leaves at `c`, `r` units across, in `tones`, inked round: a shrub, a pad, a hedge's top. */
function leafBlob(g: Ctx, e: Eye, c: V3, r: number, tones: RGB[], seed: number, squash = 0.8): void {
  const [px, py] = proj(e, c);
  const R = r * across(e);
  const n = 6;
  const lobes: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + jit(seed, i) * 0.6;
    const d = i === 0 ? 0 : 0.42 + 0.12 * jit(seed, i + 9);
    lobes.push([Math.cos(a) * d, Math.sin(a) * d * squash, 0.5 + 0.14 * jit(seed, i + 19)]);
  }
  lobes.push([0, 0, 0.62]);
  const path = (k: number, dy = 0): void => {
    g.beginPath();
    for (const [lx, ly, lr] of lobes) {
      g.moveTo(px + lx * R + lr * R * k, py + ly * R + dy);
      g.arc(px + lx * R, py + ly * R + dy, lr * R * k, 0, TAU);
    }
  };
  path(1);
  g.strokeStyle = css(LEAF_INK, 0.9);
  g.lineWidth = INK * 1.4;
  g.stroke();
  g.fillStyle = css(tones[1]);
  g.fill();
  // Shade under it, to the lower right; light on its upper left.
  path(0.72, R * 0.18);
  g.fillStyle = css(tones[2], 0.45);
  g.fill();
  for (const [lx, ly, lr] of lobes.slice(0, 4)) {
    g.beginPath();
    g.arc(px + lx * R - lr * R * 0.2, py + ly * R - lr * R * 0.28, lr * R * 0.42, 0, TAU);
    g.fillStyle = css(tones[0], 0.8);
    g.fill();
  }
  // A grain of leaf dabs across it.
  const Rn = rand(seed + 3);
  for (let i = 0; i < 10; i++) {
    const a = Rn() * TAU, d = Rn() * R * 0.8;
    leaf(g, px + Math.cos(a) * d, py + Math.sin(a) * d * squash, a, R * 0.32, tones[i % 3 === 0 ? 2 : 0]);
  }
}

/**
 * Drawn loose with an even line of `ink` round the whole of it, as a solid is
 * ruled round: drawn apart, its shape laid a hair out every way in the ink,
 * and it over that. For what is painted stroke by stroke -- flowers, fronds.
 */
function inked(g: Ctx, ink: RGB, draw: (h: Ctx) => void): void {
  const W = g.canvas.width, H = g.canvas.height;
  const pic = document.createElement('canvas');
  pic.width = W; pic.height = H;
  const h = pic.getContext('2d');
  const line = document.createElement('canvas');
  line.width = W; line.height = H;
  const l = line.getContext('2d');
  if (!h || !l) { draw(g); return; }
  const m = g.getTransform();
  h.setTransform(m);
  draw(h);
  l.drawImage(pic, 0, 0);
  l.globalCompositeOperation = 'source-in';
  l.fillStyle = css(ink);
  l.fillRect(0, 0, W, H);
  const d = Math.max(0.6, INK * 0.75 * Math.hypot(m.a, m.b));
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d * 0.7, d * 0.7], [-d * 0.7, d * 0.7], [d * 0.7, -d * 0.7], [-d * 0.7, -d * 0.7]]) g.drawImage(line, dx, dy);
  g.drawImage(pic, 0, 0);
  g.restore();
}
const FLOWER_INK: RGB = mix(LEAF[2], hex('#5a3a30'), 0.45);

/** A part drawn loose, laid by the points it reaches, clicked by too when `solid`. */
const loose = (reach: V3[], draw: (g: Ctx, e: Eye) => void, solid = true, pad = 0): KitPart => ({ reach: corners(reach), draw, solid, ...(pad ? { pad } : {}) });
/** Every corner of the box round some points: what they reach from any side. */
function corners(pts: readonly V3[]): V3[] {
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const out: V3[] = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) out.push([x, y, z]);
  return out;
}

/** Boards along a side, nailed at the ends. */
const boarded = (seed: number, n = 2) => (g: Ctx, k: PaintCtx, s: Side): void => {
  boards(g, k.fill, s.w, s.h, n, seed, 'x');
  for (const x of [0.4, s.w - 0.4]) nail(g, k.fill, x, s.h * 0.5, 0.12);
};

/** Soil seen from above: crumbs dark and pale. */
const soil = (seed: number, damp = false) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.fillStyle = damp ? DAMP_SOIL : DRY_SOIL;
  g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
  const R = rand(seed);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = i % 2 ? css(mix(k.fill, hex('#3e3040'), 0.35), 0.6) : css(mix(k.fill, [255, 236, 210], 0.25), 0.6);
    g.beginPath();
    g.arc((R() - 0.5) * s.w, (R() - 0.5) * s.h, 0.16 + R() * 0.12, 0, TAU);
    g.fill();
  }
};

/** The shade a piece throws, a box on the floor. */
const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];

/* ---- wildflowers, by stage ------------------------------------------------------------------- */

/** The four stages a bed's flowers are drawn at: bare, in leaf, in bud, in flower (`roseStage`). */
export const BLOOM_STAGES = ['bare', 'leafy', 'bud', 'flower'] as const;

/** A bed's, a box's or a basket's trim (`gardenTrim`): the stage, and the kind in each slot (nought for none, else one more than its place in `BLOOM_KINDS`). */
export const bloomTrim = (stage: number, kinds: readonly string[]): number => 1 + bloomCode(stage, kinds);
const bloomCode = (stage: number, kinds: readonly string[]): number =>
  Math.max(0, Math.min(3, stage)) + 4 * kinds.slice(0, 4).reduce((n, k, i) => n + (1 + Math.max(0, (BLOOM_KINDS as readonly string[]).indexOf(k))) * 5 ** i, 0);
const bloomOf = (trim: number | undefined): { stage: number; kinds: string[] } => {
  const t = said(trim, bloomCode(3, [...BLOOM_KINDS]));
  const kinds: string[] = [];
  let code = Math.floor(t / 4);
  for (let i = 0; i < 4 && code; i++, code = Math.floor(code / 5)) kinds.push(code % 5 ? BLOOM_KINDS[(code % 5) - 1] : '');
  return { stage: t % 4, kinds };
};

/**
 * A clump of wildflowers of `kind` rooted at `at`, at a stage: a few sprigs
 * bare, a tuft of leaves in leaf, closed heads in its colour in bud, open in
 * flower. `k` scales it; `trail` lets its leaves hang down over an edge.
 */
function bloomPart(at: V3, kind: string, stage: number, k: number, seed: number, trail = 0): KitPart {
  const reach: V3[] = [[at[0] - 2 * k, at[1] - 1, at[2] - trail], [at[0] + 2 * k, at[1] + 1, at[2] + 5 * k]];
  return loose(reach, (g0, e) => inked(g0, FLOWER_INK, (g) => {
    const [x, y] = proj(e, at);
    const big = (k * across(e)) / 4.2;
    if (trail > 0) {
      // Strands hanging over the edge, leaves in pairs down them.
      const drop = trail * 2.25;
      for (const s of [-1, 1]) {
        const x0 = x + s * 2.4 * big;
        g.beginPath();
        g.moveTo(x0, y);
        g.quadraticCurveTo(x0 + s * 1.2 * big, y + drop * 0.6, x0 + s * 0.6 * big, y + drop);
        g.strokeStyle = css(LEAF[2], 0.9);
        g.lineWidth = 0.55;
        g.stroke();
        for (let i = 1; i <= 3; i++) leaf(g, x0 + s * 0.9 * big, y + (drop * i) / 3.4, s > 0 ? 0.6 : 2.5, 3 * big, LEAF[i % 2]);
        if (stage === 3 && kind) {
          const col = FLOWER[kind] ?? FLOWER.white;
          g.beginPath();
          g.arc(x0 + s * 0.6 * big, y + drop, 1.4 * big, 0, TAU);
          g.fillStyle = col.ring;
          g.fill();
          g.beginPath();
          g.arc(x0 + s * 0.6 * big, y + drop, 1 * big, 0, TAU);
          g.fillStyle = col.petal;
          g.fill();
        }
      }
    }
    if (stage === 0) {
      // Bare: a few short sprigs out of the soil.
      g.strokeStyle = css(LEAF[2]);
      g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const sx = x + (i - 1) * 2 * big;
        g.moveTo(sx, y);
        g.lineTo(sx + (i - 1) * 0.6 * big, y - 2.2 * big);
      }
      g.stroke();
      return;
    }
    flowerClump(g, x, y, kind || 'white', seed, big, stage === 3 ? Infinity : 0);
    if (stage === 2) {
      // In bud: closed heads on stems, green with a touch of their colour.
      const col = FLOWER[kind] ?? FLOWER.white;
      const R = rand(seed + 7);
      for (let i = 0; i < 4; i++) {
        const hx = x + (R() - 0.5) * 9 * big, up = (6 + R() * 5) * big;
        g.strokeStyle = '#5b876a';
        g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(x + (hx - x) * 0.3, y); g.quadraticCurveTo(hx, y - up * 0.5, hx, y - up); g.stroke();
        g.beginPath();
        g.ellipse(hx, y - up, 0.9 * big, 1.4 * big, 0, 0, TAU);
        g.fillStyle = css(mix(hex(col.petal), LEAF[1], 0.55));
        g.fill();
        g.strokeStyle = col.ring;
        g.lineWidth = 0.35;
        g.stroke();
      }
    }
  }), true, 6);
}

/** The flowers along a row of slots, each `at` a slot's root, by a bloom trim. */
function bloomRow(at: V3[], trim: number | undefined, k: number, salt: number, trail = 0): KitPart[] {
  // Unsaid, in flower in every slot: what the game measures it at (`FURNITURE_HEIGHT`).
  const { stage, kinds } = bloomOf(trim);
  return at.flatMap((p, i) => (kinds[i] ? [bloomPart(p, kinds[i], stage, k, salt * 31 + i * 7, trail)] : []));
}

/* ---- 1. the raised flower bed ------------------------------------------------------------------ */

const BED_X = 9.2, BED_Y = 4.2, BED_H = 4.6;

function flowerBedOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75), CAP = paler(W, 0.08), IN = deeper(W, 0.3);
  const parts: KitPart[] = [];
  const T = 0.7;
  // Its walls: boards outside, the earth in them; a cap rail round the top.
  parts.push({ faces: slab(-BED_X, BED_X, -BED_Y, BED_Y, 0, BED_H, W, { corner: 0.18, paint: { front: boarded(3, 3), back: boarded(4, 3), left: boarded(5, 3), right: boarded(6, 3) } }) });
  parts.push({ faces: slab(-BED_X + T, BED_X - T, -BED_Y + T, BED_Y - T, BED_H - 0.4, BED_H - 0.3, EARTH, { paint: { top: soil(11) } }), solid: false, after: [] });
  for (const [x0, x1, y0, y1] of [[-BED_X - 0.15, BED_X + 0.15, -BED_Y - 0.15, -BED_Y + T], [-BED_X - 0.15, BED_X + 0.15, BED_Y - T, BED_Y + 0.15],
    [-BED_X - 0.15, -BED_X + T, -BED_Y + T, BED_Y - T], [BED_X - T, BED_X + 0.15, -BED_Y + T, BED_Y - T]] as Array<[number, number, number, number]>) {
    parts.push({ faces: slab(x0, x1, y0, y1, BED_H, BED_H + 0.45, CAP, { bevel: 0.1, paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 13, 'x', 0.5); g.restore(); } } }), edges: true });
  }
  void IN;
  const z = BED_H - 0.3;
  parts.push(...bloomRow([[-6.6, -0.6, z], [-2.2, 0.8, z], [2.2, -0.7, z], [6.6, 0.6, z]], look.trim, 1.7, 1));
  return { parts, shade: shadeOf(-BED_X, BED_X, -BED_Y, BED_Y) };
}

const BLOOM_STATES = [
  { trim: bloomTrim(0, ['pink', 'white', 'yellow', 'blue']), label: 'bare' },
  { trim: bloomTrim(1, ['pink', 'white', 'yellow', 'blue']), label: 'in leaf' },
  { trim: bloomTrim(2, ['pink', 'white', 'yellow', 'blue']), label: 'in bud' },
  { trim: bloomTrim(3, ['pink', 'white', 'yellow', 'blue']), label: 'in flower' },
  { trim: bloomTrim(3, ['blue', 'blue']), label: 'two blue' },
  { trim: bloomTrim(0, []), label: 'empty' },
];

export const FLOWER_BED: KitPiece = { model: (look) => flowerBedOf(look), uses: { trim: true, material: true, tint: true }, states: BLOOM_STATES };

/* ---- 2. the window box --------------------------------------------------------------------------- */

/** Where a wall's outer face is, from the middle of the row of spots along it: toward the piece's front. */
const FACE_Y = UNITS_PER_TILE / 8 - WALL_THICK * UNITS_PER_TILE;
const BOXW_X = 8, BOXW_D = 2.6, BOXW_Z0 = 6.4, BOXW_Z1 = 8.8;

function windowBoxOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const y1 = FACE_Y - 0.1, y0 = y1 - BOXW_D;
  const parts: KitPart[] = [];
  // Two iron brackets under it, from the wall.
  for (const x of [-BOXW_X + 1.6, BOXW_X - 1.6]) {
    parts.push({ faces: strut([x, y1, BOXW_Z0 - 2.4], [x, y0 + 0.4, BOXW_Z0], 0.3, 0.3, IRON) });
    parts.push({ faces: slab(x - 0.15, x + 0.15, y0 + 0.2, y1, BOXW_Z0 - 0.3, BOXW_Z0, IRON) });
  }
  parts.push({ faces: slab(-BOXW_X, BOXW_X, y0, y1, BOXW_Z0, BOXW_Z1, W, { corner: 0.12, paint: { front: boarded(21), back: boarded(22), left: boarded(23, 1), right: boarded(24, 1) } }), edges: true });
  parts.push({ faces: slab(-BOXW_X + 0.4, BOXW_X - 0.4, y0 + 0.4, y1 - 0.4, BOXW_Z1 - 0.3, BOXW_Z1 - 0.2, EARTH, { paint: { top: soil(25) } }), solid: false });
  const z = BOXW_Z1 - 0.2, ym = (y0 + y1) / 2;
  parts.push(...bloomRow([[-5, ym, z], [0, ym, z], [5, ym, z]], look.trim, 1.5, 2, 1.6));
  // Up on the wall: no shade on the floor under it.
  return { parts, shade: null };
}

export const WINDOW_BOX: KitPiece = { model: (look) => windowBoxOf(look), uses: { trim: true, material: true, tint: true }, states: BLOOM_STATES };

/* ---- 3. the hanging basket ------------------------------------------------------------------------ */

const ROPE: Tone = toneOf('#e9d3a6', '#a88a74');
const HANG_Z = 23, BASKET_Z = 15.5, BASKET_R = 3.2;

/** An iron bracket off the wall at the head of a hung piece, its hook out over `y` at `z`. */
function bracket(y: number, z: number, wood: Tone = woodTone()): KitPart[] {
  const parts: KitPart[] = [];
  parts.push({ faces: slab(-0.9, 0.9, FACE_Y - 0.5, FACE_Y, z - 3, z + 0.8, deeper(wood, 0.1), { corner: 0.1, paint: woodSides(890, 'y') }) });
  parts.push({ faces: strut([0, FACE_Y - 0.4, z], [0, y - 0.3, z], 0.55, 0.55, wood) });
  parts.push({ faces: strut([0, FACE_Y - 0.4, z - 2.6], [0, y + (FACE_Y - y) * 0.45, z - 0.1], 0.4, 0.4, wood) });
  // An iron hook off its end.
  parts.push({ faces: rod([0, y, z - 0.2], [0, y, z - 0.9], 0.12, IRON, 4) });
  return parts;
}

function hangingBasketOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const y = FACE_Y - 3.2;
  parts.push(...bracket(y, HANG_Z, woodTone(look.material, look.tint, 0.6)));
  // The ropes from the hook to the rim, three of them.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    parts.push({ faces: rod([0, y, HANG_Z - 0.3], [Math.cos(a) * BASKET_R * 0.95, y + Math.sin(a) * BASKET_R * 0.95, BASKET_Z + 2.3], 0.1, ROPE, 4) });
  }
  // The pot, round-bottomed, in a net of rope.
  parts.push({ faces: lathe(0, y, [[BASKET_Z - 0.4, 0.3], [BASKET_Z, BASKET_R * 0.7], [BASKET_Z + 1.4, BASKET_R], [BASKET_Z + 2.4, BASKET_R * 1.02], [BASKET_Z + 2.4, BASKET_R * 0.86]], 10, CLAY, 0.5,
    () => ({ crease: 0.25 })) });
  const z = BASKET_Z + 2.3;
  parts.push(...bloomRow([[-1.3, y, z], [1.3, y + 0.3, z]], look.trim, 1.25, 3, 1.4));
  // Hung up: no shade on the floor under it.
  return { parts, shade: null };
}

export const HANGING_BASKET: KitPiece = {
  model: (look) => hangingBasketOf(look), uses: { trim: true },
  states: [
    { trim: bloomTrim(1, ['pink', 'blue']), label: 'in leaf' },
    { trim: bloomTrim(2, ['pink', 'blue']), label: 'in bud' },
    { trim: bloomTrim(3, ['pink', 'blue']), label: 'in flower' },
    { trim: bloomTrim(3, ['yellow', 'white']), label: 'yellow, white' },
    { trim: bloomTrim(3, []), label: 'empty' },
  ],
};

/* ---- 4. the herb box -------------------------------------------------------------------------------- */

const HB = 3.8, HB_H = 4.2;

function herbBoxOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const has = planterHolds(look.trim);
  const parts: KitPart[] = [];
  for (const px of [-HB + 0.5, HB - 0.5]) for (const py of [-HB + 0.5, HB - 0.5]) parts.push({ faces: slab(px - 0.45, px + 0.45, py - 0.45, py + 0.45, 0, 0.6, deeper(W, 0.2)) });
  parts.push({ faces: slab(-HB, HB, -HB, HB, 0.6, HB_H, W, { corner: 0.15, paint: { front: boarded(31), back: boarded(32), left: boarded(33), right: boarded(34) } }), edges: true });
  parts.push({ faces: slab(-HB + 0.5, HB - 0.5, -HB + 0.5, HB - 0.5, HB_H - 0.35, HB_H - 0.25, EARTH, { paint: { top: soil(35, !!has?.tended) } }), solid: false });
  if (has && has.stage > 0) {
    const [lf, fr] = has.crop.colors;
    const z = HB_H - 0.25;
    const at: V3[] = [[-1.6, -1, z], [1.4, -1.2, z], [-1.2, 1.4, z], [1.6, 1.2, z]];
    const size = Math.min(0.5, 6 / Math.max(1, planterTall(has.crop.id, has.stage, 1)));
    const tall = planterTall(has.crop.id, has.stage, size);
    parts.push(loose(at.flatMap(([x, y, zz]) => [[x - 1.4, y - 1.4, zz], [x + 1.4, y + 1.4, zz + tall]] as V3[]), (g, e) => planterRow(g, e, at, has.crop.id, has.stage, lf, fr, size, [])));
  }
  return { parts, shade: shadeOf(-HB, HB, -HB, HB) };
}

/** A planter's trim, as `planterTrim` makes it, for the sheet's states (the herbs are fifth to ninth in `CROP_LIST`). */
const herbTrim = (crop: number, stage: number): number => 1 + crop * CROP_STAGES + stage;
export const HERB_BOX: KitPiece = {
  model: (look) => herbBoxOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: 0, label: 'bare' },
    { trim: herbTrim(7, 1), label: 'basil sprouting' },
    { trim: herbTrim(6, 2), label: 'sage growing' },
    { trim: herbTrim(9, RIPE), label: 'mint ripe' },
    { trim: herbTrim(10, RIPE), label: 'rosemary ripe' },
  ],
};

/* ---- 5. the topiary tub -------------------------------------------------------------------------- */

/** A topiary tub's trim: its shape (nought bushy, else one more than its place in `TOPIARY_SHAPES`) and how far grown out, in tenths. */
export const topiaryTrim = (shape: string | null, out: number): number => 1 +
  (shape ? 1 + Math.max(0, (TOPIARY_SHAPES as readonly string[]).indexOf(shape)) : 0) + 5 * Math.round(Math.max(0, Math.min(1, out)) * 10);
const TUB = 3.6, TUB_H = 5.2;

function topiaryOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const t = said(look.trim, topiaryTrim('ball', 0) - 1);
  const shape = t % 5 ? TOPIARY_SHAPES[(t % 5) - 1] : null;
  const out = Math.floor(t / 5) / 10;
  const parts: KitPart[] = [];
  // The tub: a square box on ball feet with finials on its corners, as at Versailles.
  for (const px of [-TUB + 0.6, TUB - 0.6]) for (const py of [-TUB + 0.6, TUB - 0.6]) {
    parts.push({ faces: lathe(px, py, [[0, 0.3], [0.35, 0.55], [0.7, 0.3]], 6, deeper(W, 0.15)) });
    parts.push({ faces: lathe(px, py, [[TUB_H + 0.3, 0.32], [TUB_H + 0.65, 0.42], [TUB_H + 1.1, 0.05]], 6, paler(W, 0.1)) });
  }
  parts.push({ faces: slab(-TUB, TUB, -TUB, TUB, 0.7, TUB_H, W, { corner: 0.4, paint: woodSides(41, 'y') }), edges: true });
  parts.push({ faces: slab(-TUB - 0.15, TUB + 0.15, -TUB - 0.15, TUB + 0.15, TUB_H, TUB_H + 0.3, paler(W, 0.08), { bevel: 0.1 }) });
  // The trunk, a short stem out of the earth.
  const z0 = TUB_H + 0.3;
  parts.push({ faces: rod([0, 0, z0], [0, 0, z0 + 2.4], 0.35, toneOf('#b39274', '#6e5658'), 6) });
  const H = 11;
  const fuzz = shape ? out : 1;
  const reach: V3[] = [[-4, -4, z0 + 1], [4, 4, z0 + H + 2]];
  parts.push(loose(reach, (g, e) => {
    const c = (dz: number): V3 => [0, 0, z0 + dz];
    const R = across(e);
    if (!shape) {
      // Bushy: an untidy mass, sprigs out of it every way.
      leafBlob(g, e, c(6), 4.4, BOX, 51, 0.9);
      leafBlob(g, e, c(9), 3.1, BOX, 52, 0.9);
    } else if (shape === 'ball') {
      leafBlob(g, e, c(6.5), 4.2, BOX, 53, 1);
    } else if (shape === 'cone') {
      for (let i = 0; i < 4; i++) leafBlob(g, e, c(3.6 + i * 2.4), 4 - i * 0.95, BOX, 54 + i, 0.75);
    } else if (shape === 'spiral') {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7;
        leafBlob(g, e, [Math.cos(a) * 0.6, Math.sin(a) * 0.6, z0 + 3 + i * 1.9], 3.6 - i * 0.55, BOX, 60 + i, 0.55);
      }
    } else {
      // A wildermon: a round body, a head, two pointed ears and a tail, clipped out of box.
      leafBlob(g, e, c(5.2), 3.4, BOX, 70, 0.85);
      leafBlob(g, e, [1.2, 1.2, z0 + 9], 2.3, BOX, 71, 0.95);
      leafBlob(g, e, [-2.2, -2.2, z0 + 6.6], 1.3, BOX, 74, 0.9);
      for (const s of [-1, 1]) leafBlob(g, e, [1.2 + s * 1.3, 1.2 - s * 1.3, z0 + 11.3], 0.8, BOX, 72 + s, 1.4);
    }
    // Grown out: sprigs standing out of the clipped shape.
    if (fuzz > 0) {
      const Rn = rand(77 + t);
      const n = Math.round(16 * fuzz);
      for (let i = 0; i < n; i++) {
        const a = Rn() * TAU, zz = 3 + Rn() * 8;
        const [x, y] = proj(e, [Math.cos(a) * 3.6, Math.sin(a) * 3.6, z0 + zz]);
        leaf(g, x, y, a, R * (0.9 + fuzz), BOX[Rn() < 0.5 ? 0 : 2]);
      }
    }
  }));
  return { parts, shade: shadeOf(-TUB, TUB, -TUB, TUB) };
}

export const TOPIARY_TUB: KitPiece = {
  model: (look) => topiaryOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: topiaryTrim(null, 1), label: 'bushy' },
    { trim: topiaryTrim('ball', 0), label: 'ball' },
    { trim: topiaryTrim('cone', 0), label: 'cone' },
    { trim: topiaryTrim('spiral', 0), label: 'spiral' },
    { trim: topiaryTrim('wildermon', 0), label: 'wildermon' },
    { trim: topiaryTrim('cone', 0.6), label: 'cone growing out' },
  ],
};

/* ---- 6. the potted fern and the potted palm ---------------------------------------------------------- */

/** A frond: a curved rib from `from` out and over to `to`, leaflets either side shrinking to its tip. */
function frond(g: Ctx, e: Eye, from: V3, mid: V3, to: V3, n: number, w: number, tones: RGB[]): void {
  const a = proj(e, from), b = proj(e, mid), c = proj(e, to);
  const at = (t: number): [number, number] => {
    const s = 1 - t;
    return [s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]];
  };
  g.strokeStyle = css(mix(tones[2], STEM, 0.4));
  g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(b[0], b[1], c[0], c[1]); g.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.02));
    const ang = Math.atan2(y2 - y, x2 - x);
    const L = w * (1 - t * 0.75) * across(e);
    for (const s of [-1, 1]) leaf(g, x + Math.cos(ang + s * 1.2) * L * 0.45, y + Math.sin(ang + s * 1.2) * L * 0.45, ang + s * 0.9, L, tones[(i + (s > 0 ? 0 : 1)) % 3 === 0 ? 2 : s > 0 ? 0 : 1]);
  }
}

const FERN: RGB[] = [hex('#d0ebb0'), hex('#9ccb88'), hex('#6c9a6c')];
const PALM: RGB[] = [hex('#b8dca8'), hex('#78ac82'), hex('#4c7860')];

function fernParts(x: number, y: number, z: number, k: number): KitPart {
  return loose([[x - 7.5 * k, y - 7.5 * k, z - 1 * k], [x + 7.5 * k, y + 7.5 * k, z + 8.5 * k]], (g0, e) => inked(g0, FLOWER_INK, (g) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3;
      const up = i % 3 === 0 ? 6.5 : 4.5;
      frond(g, e, [x, y, z], [x + Math.cos(a) * 2.6 * k, y + Math.sin(a) * 2.6 * k, z + up * k], [x + Math.cos(a) * 5.4 * k, y + Math.sin(a) * 5.4 * k, z + (up - 3.2) * k], 9, 1.1 * k, FERN);
    }
  }), true, 4);
}

function palmParts(x: number, y: number, z: number, k: number): KitPart[] {
  const top: V3 = [x + 0.4 * k, y, z + 9 * k];
  return [
    { faces: rod([x, y, z], [x + 0.2 * k, y, z + 4.5 * k], 0.45 * k, toneOf('#c9a77c', '#7e6060'), 6) },
    { faces: rod([x + 0.2 * k, y, z + 4.5 * k], top, 0.35 * k, toneOf('#c9a77c', '#7e6060'), 6) },
    loose([[x - 11 * k, y - 11 * k, z + 3 * k], [x + 11 * k, y + 11 * k, z + 14 * k]], (g0, e) => inked(g0, FLOWER_INK, (g) => {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.2;
        frond(g, e, top, [top[0] + Math.cos(a) * 3 * k, top[1] + Math.sin(a) * 3 * k, top[2] + 1.8 * k], [top[0] + Math.cos(a) * 6.4 * k, top[1] + Math.sin(a) * 6.4 * k, top[2] - 2.6 * k], 12, 1.5 * k, PALM);
      }
    }), true, 4),
  ];
}

function pottedOf(kind: 'fern' | 'palm'): KitModel {
  const parts: KitPart[] = [{ faces: pot(0, 0, 0, 2.8, 4.2) }];
  parts.push({ faces: lathe(0, 0, [[3.9, 2.45], [4.0, 2.45], [4.0, 0.01]], 10, EARTH), solid: false });
  if (kind === 'fern') parts.push(fernParts(0, 0, 4, 0.85));
  else parts.push(...palmParts(0, 0, 4, 1));
  return { parts, shade: shadeOf(-2.8, 2.8, -2.8, 2.8) };
}

export const POTTED_FERN: KitPiece = { model: () => pottedOf('fern'), uses: {} };
export const POTTED_PALM: KitPiece = { model: () => pottedOf('palm'), uses: {} };

/* ---- 7. the hedge ----------------------------------------------------------------------------------- */

/** A hedge's trim: how full, in tenths, and its clip (nought none, else one more than its place in `HEDGE_CLIPS`). */
export const hedgeTrim = (full: number, clip: string | null): number => 1 +
  Math.round(Math.max(0, Math.min(1, full)) * 10) + 11 * (clip ? 1 + Math.max(0, (HEDGE_CLIPS as readonly string[]).indexOf(clip)) : 0);
const HEDGE_HALF = UNITS_PER_TILE / 2 - 0.6, HEDGE_D = 3.4, HEDGE_H = 10;

/** A hedge's own greens: box, a step deeper and more saturate than the leaves of a shrub. */
const HEDGE_TONE: Tone = toneOf('#a8d396', '#5b8a66');
const HEDGE_LEAF: RGB[] = [hex('#c4e6a8'), hex('#86b878'), hex('#4f7c5c')];

/** Leaf over a hedge's faces: small leaves in its greens, packed the closer the fuller it is. */
const hedgeSkin = (seed: number, dense: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  const R = rand(seed);
  const n = Math.round(s.w * s.h * 0.55 * dense);
  for (let i = 0; i < n; i++) {
    const x = R() * s.w, y = R() * s.h;
    g.fillStyle = css(i % 4 === 0 ? mix(k.fill, HEDGE_LEAF[2], 0.55) : i % 4 === 1 ? mix(k.fill, HEDGE_LEAF[0], 0.5) : mix(k.fill, HEDGE_LEAF[1], 0.3), 0.8);
    g.beginPath();
    g.ellipse(x, y, 0.5, 0.28, R() * TAU, 0, TAU);
    g.fill();
  }
};

function hedgeOf(look: KitLook): KitModel {
  const t = said(look.trim, hedgeTrim(1, 'flat') - 1);
  const full = (t % 11) / 10, clipN = Math.floor(t / 11);
  const clip = clipN ? HEDGE_CLIPS[clipN - 1] : null;
  const parts: KitPart[] = [];
  const y = FACE_Y - HEDGE_D / 2 - 0.4;
  if (full < 0.15) {
    // Just planted: a row of sprouts, a stem and a few leaves each.
    const at: V3[] = Array.from({ length: 4 }, (_, i) => [-HEDGE_HALF + 2.5 + i * ((2 * HEDGE_HALF - 5) / 3), y, 0]);
    for (const p of at) parts.push({ faces: rod(p, [p[0], p[1], 3.2], 0.18, toneOf('#c9a882', '#7e6266'), 4) });
    parts.push(loose(at.flatMap((p) => [[p[0] - 1.5, p[1] - 1, 2], [p[0] + 1.5, p[1] + 1, 4.5]] as V3[]), (g0, e) => inked(g0, FLOWER_INK, (g) => {
      for (const [i, p] of at.entries()) {
        const [x, yy] = proj(e, [p[0], p[1], 3]);
        for (let j = 0; j < 5; j++) leaf(g, x + (j - 2) * 0.9, yy - Math.abs(j - 2) * 0.5 - 1, -Math.PI / 2 + (j - 2) * 0.5, across(e) * 1.6, HEDGE_LEAF[(i + j) % 3]);
      }
    })));
    return { parts, shade: shadeOf(-HEDGE_HALF, HEDGE_HALF, y - 1, y + 1) };
  }
  const h = 3 + (HEDGE_H - 3) * full, d = HEDGE_D * (0.6 + 0.4 * full);
  const dense = 0.5 + 0.5 * full;
  const skin = (n: number) => ({ front: hedgeSkin(130 + n, dense), back: hedgeSkin(131 + n, dense), left: hedgeSkin(132 + n, dense), right: hedgeSkin(133 + n, dense),
    top: (g: Ctx, k: PaintCtx, sd: Side) => { g.save(); g.translate(-sd.w / 2, -sd.h / 2); hedgeSkin(134 + n, dense)(g, k, sd); g.restore(); } });
  // The body of it; clipped round, a step lower, the round top laid on in leaf over it.
  const body = clip === 'round' ? h - d * 0.45 : h;
  parts.push({ faces: slab(-HEDGE_HALF, HEDGE_HALF, y - d / 2, y + d / 2, 0, body, HEDGE_TONE, { corner: clip === 'flat' ? 0.3 : 0.9, bevel: clip === 'flat' ? 0.15 : 0.4, paint: skin(0) }) });
  // Its top: a tidy flat lip clipped flat, a rounded crown clipped round, and left to itself a shaggy run of sprigs.
  const n = 9;
  const tops: V3[] = Array.from({ length: n }, (_, i) => [-HEDGE_HALF + 1.6 + (i * (2 * HEDGE_HALF - 3.2)) / (n - 1), y, body]);
  parts.push(loose([[-HEDGE_HALF, y - d, body - 1], [HEDGE_HALF, y + d, h + (clip ? 0.5 : 2.5)]], (g, e) => {
    if (clip === 'round') {
      for (const [i, c] of tops.entries()) leafBlob(g, e, [c[0], c[1], c[2] + d * 0.05], d * 0.62, HEDGE_LEAF, 120 + i, 0.55);
      return;
    }
    const Rn = rand(141 + (clip ? 7 : 0));
    const many = clip ? 30 : 70;
    for (let i = 0; i < many; i++) {
      const x = -HEDGE_HALF + 0.4 + Rn() * (2 * HEDGE_HALF - 0.8);
      const [px, py] = proj(e, [x, y + (Rn() - 0.5) * d * 0.9, h - 0.1]);
      const L = across(e) * (clip ? 0.9 : 1.2 + Rn() * 1.2);
      leaf(g, px, py - (clip ? 0 : Rn() * 2.5), -Math.PI / 2 + (Rn() - 0.5) * (clip ? 2.6 : 1.8), L, HEDGE_LEAF[i % 3]);
    }
  }));
  return { parts, shade: shadeOf(-HEDGE_HALF, HEDGE_HALF, y - d / 2, y + d / 2) };
}

export const HEDGE: KitPiece = {
  model: (look) => hedgeOf(look), uses: { trim: true },
  states: [
    { trim: hedgeTrim(0, null), label: 'planted' },
    { trim: hedgeTrim(0.5, null), label: 'half grown' },
    { trim: hedgeTrim(1, null), label: 'full' },
    { trim: hedgeTrim(1, 'flat'), label: 'clipped flat' },
    { trim: hedgeTrim(1, 'round'), label: 'clipped round' },
  ],
};

/* ---- 8. the wisteria pergola ----------------------------------------------------------------------- */

/** A wisteria's trim: days grown in twentieths up to four, and its season's look: nought flowering, one in leaf, two bare. */
export const wisteriaTrim = (days: number, look: 0 | 1 | 2): number => 1 + Math.floor(Math.min(4, Math.max(0, days)) * 20) + 100 * look;
const PG = 8.6, PG_H = 22;

function pergolaOf(look: KitLook): KitModel {
  const W = woodTone(look.material);
  const t = said(look.trim, wisteriaTrim(4, 0) - 1);
  const days = (t % 100) / 20, season = Math.floor(t / 100);
  const parts: KitPart[] = [];
  for (const x of [-PG, PG]) for (const y of [-PG, PG]) parts.push({ faces: slab(x - 0.7, x + 0.7, y - 0.7, y + 0.7, 0, PG_H, W, { corner: 0.15, paint: woodSides(150 + x + y, 'y') }) });
  // Two beams along it, rafters across them, their ends cut.
  const beams = [-PG, PG].map((y, i) => ({ faces: slab(-PG - 1.6, PG + 1.6, y - 0.45, y + 0.45, PG_H, PG_H + 1.6, deeper(W, 0.05), { paint: woodSides(160 + i, 'x') }), edges: true } as KitPart));
  parts.push(...beams);
  const rafters: KitPart[] = [];
  for (let i = 0; i < 6; i++) {
    const x = -PG + 0.4 + (i * (2 * PG - 0.8)) / 5;
    const r: KitPart = { faces: slab(x - 0.3, x + 0.3, -PG - 1.6, PG + 1.6, PG_H + 1.6, PG_H + 2.6, paler(W, 0.06), { paint: woodSides(170 + i, 'y') }), edges: true, after: beams };
    rafters.push(r);
    parts.push(r);
  }
  // The wisteria: a twisted trunk up one post, its growth along the top.
  const grow = Math.min(1, days / 3);
  const trunk: V3[] = Array.from({ length: 9 }, (_, i) => [PG - 1.2 + Math.sin(i * 1.3) * 0.6, PG - 1.2 + Math.cos(i * 1.3) * 0.6, (i / 8) * (PG_H + 2) * Math.max(0.2, grow)]);
  parts.push(loose(trunk, (g, e) => {
    const pts = trunk.map((p) => proj(e, p));
    for (const [w, c] of [[2.2, mix(STEM, hex('#4a3844'), 0.5)], [1.5, STEM]] as Array<[number, RGB]>) {
      g.strokeStyle = css(c);
      g.lineWidth = w * across(e) * 0.6;
      g.lineCap = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  }));
  if (days >= 1) {
    const top = PG_H + 2.8;
    const masses: V3[] = [];
    // Spread from the corner it climbs over the top, round the edges first, as far as it has grown.
    const n = Math.round(4 + 10 * Math.min(1, (days - 1) / 2));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.7, r = i % 3 === 2 ? 3 : PG - 0.5;
      masses.push([Math.cos(a) * r, Math.sin(a) * r, top + jit(i, 3) * 1.2]);
    }
    masses.sort((p, q) => Math.hypot(p[0] - PG, p[1] - PG) - Math.hypot(q[0] - PG, q[1] - PG));
    masses.length = n;
    const bare = season === 2;
    const flowering = season === 0 && days >= 3;
    const budding = season === 0 && days >= 2 && days < 3;
    parts.push({ ...loose([[-PG - 3, -PG - 3, top - 11], [PG + 3, PG + 3, top + 4]], (g, e) => {
      for (const [i, c] of masses.entries()) {
        if (bare) {
          // Bare in winter: grey twining stems over the rafters.
          const [x, y] = proj(e, c);
          g.strokeStyle = css(mix(STEM, hex('#9a90a0'), 0.4));
          g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(x - 4, y); g.quadraticCurveTo(x, y - 3, x + 4, y + 1);
          g.moveTo(x - 2, y + 1); g.quadraticCurveTo(x + 1, y + 3, x + 3, y - 2);
          g.stroke();
          continue;
        }
        leafBlob(g, e, c, 3.2 + jit(i, 4), LEAF, 180 + i, 0.7);
      }
      if (!flowering && !budding) return;
      // The racemes: long drooping clusters of florets, paler toward the tip.
      for (let i = 0; i < masses.length * 2; i++) {
        const c = masses[i % masses.length];
        const [x0, y0] = proj(e, [c[0] + (jit(i, 5) - 0.5) * 3, c[1] + (jit(i, 6) - 0.5) * 3, c[2] - 1]);
        const len = (budding ? 4 : 8 + jit(i, 7) * 7) * across(e);
        const [lit, shade] = WISTERIA[i % WISTERIA.length];
        for (let j = 0; j < 11; j++) {
          const f = j / 10;
          const r = (1 - f * 0.6) * across(e) * 1.05;
          const xx = x0 + Math.sin(f * 2 + i) * 0.6, yy = y0 + f * len;
          g.beginPath();
          g.arc(xx + 0.2, yy + 0.2, r, 0, TAU);
          g.fillStyle = css(budding ? mix(shade, LEAF[1], 0.5) : shade);
          g.fill();
          g.beginPath();
          g.arc(xx - 0.15, yy - 0.15, r * 0.75, 0, TAU);
          g.fillStyle = css(budding ? mix(lit, LEAF[0], 0.5) : f > 0.75 ? WIST_TIP : lit);
          g.fill();
        }
      }
    }, true, 10), after: [...beams, ...rafters] });
  }
  return { parts, shade: shadeOf(-PG - 1.6, PG + 1.6, -PG - 1.6, PG + 1.6) };
}

export const WISTERIA_PERGOLA: KitPiece = {
  model: (look) => pergolaOf(look), uses: { trim: true, material: true },
  states: [
    { trim: wisteriaTrim(0.5, 0), label: 'planted' },
    { trim: wisteriaTrim(1.6, 1), label: 'in leaf' },
    { trim: wisteriaTrim(2.4, 0), label: 'in bud' },
    { trim: wisteriaTrim(4, 0), label: 'spring, in flower' },
    { trim: wisteriaTrim(4, 1), label: 'summer' },
    { trim: wisteriaTrim(4, 2), label: 'winter' },
  ],
};

/* ---- 9. the bonsai on its stand ---------------------------------------------------------------------- */

/** A bonsai's trim: how far grown, in tenths, and its steps of shaping. */
export const bonsaiTrim = (grown: number, prunes: number): number => 1 +
  Math.round(Math.max(0, Math.min(1, grown)) * 10) + 11 * Math.max(0, Math.min(BONSAI_STEPS, prunes));
const GLAZE: Tone = toneOf('#9fc2c6', '#5a7488');

function bonsaiOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.6);
  const t = said(look.trim, bonsaiTrim(1, BONSAI_STEPS) - 1);
  const grown = Math.max(0.2, (t % 11) / 10), steps = Math.floor(t / 11);
  const parts: KitPart[] = [];
  // The stand: a low table, four legs and an apron.
  for (const [x, y] of [[-3.2, -2.6], [3.2, -2.6], [3.2, 2.6], [-3.2, 2.6]] as Array<[number, number]>) parts.push({ faces: leg(x, y, 0, 3.2, deeper(W, 0.1), 300 + x + y, 0.6) });
  parts.push({ faces: slab(-3.8, 3.8, -3.2, 3.2, 3.2, 3.8, W, { corner: 0.3, bevel: 0.15, paint: woodSides(310, 'x') }), edges: true });
  // The pot: shallow, glazed, on little feet.
  parts.push({ faces: slab(-2.6, 2.6, -1.8, 1.8, 3.9, 5.1, GLAZE, { corner: 0.4, bevel: 0.2 }), edges: true });
  parts.push({ faces: slab(-2.3, 2.3, -1.5, 1.5, 5.0, 5.05, EARTH), solid: false });
  // The tree: a trunk leaning and turning, and pads of foliage, more set apart the more it is shaped.
  const k = grown;
  const trunk: V3[] = [[0, 0, 5], [0.8 * k, 0.2, 5 + 2 * k], [-0.4 * k, -0.2, 5 + 4 * k], [0.6 * k, 0.1, 5 + 6 * k]];
  parts.push(loose(trunk, (g, e) => {
    const pts = trunk.map((p) => proj(e, p));
    for (const [w, c] of [[0.9, hex('#4a3844')], [0.6, hex('#8a6a58')]] as Array<[number, RGB]>) {
      g.strokeStyle = css(c);
      g.lineWidth = w * across(e) * (0.6 + 0.6 * k);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  }));
  const pads: Array<[V3, number]> = steps === 0
    ? [[[0.2 * k, 0, 5 + 5.5 * k], 2.6 * k]]
    : Array.from({ length: Math.min(steps + 1, 5) }, (_, i) => {
      const side = i % 2 ? -1 : 1;
      return [[side * (1.6 - i * 0.2) * k, (i % 3 - 1) * 0.6, 5 + (2.6 + i * 1.2) * k], (1.5 - i * 0.12) * k] as [V3, number];
    });
  parts.push(loose(pads.flatMap(([c, r]) => [[c[0] - r, c[1] - r, c[2] - r], [c[0] + r, c[1] + r, c[2] + r]] as V3[]), (g, e) => {
    for (const [i, [c, r]] of pads.entries()) leafBlob(g, e, c, r, LEAF, 330 + i, steps ? 0.45 : 0.8);
  }, true, 3));
  return { parts, shade: shadeOf(-3.8, 3.8, -3.2, 3.2) };
}

export const BONSAI: KitPiece = {
  model: (look) => bonsaiOf(look), uses: { trim: true, material: true, tint: true },
  states: [0, 1, 2, 3, 4, 5].map((n) => ({ trim: bonsaiTrim(1, n), label: `shaped ${n}` })).concat([{ trim: bonsaiTrim(0.3, 0), label: 'young' }]),
};

/* ---- 10. the flower cart --------------------------------------------------------------------------- */

function flowerCartOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const parts: KitPart[] = [];
  const WH = 3.6;
  // Two spoked wheels, one each side.
  for (const y of [-3.9, 3.9]) {
    parts.push({ faces: lathe(-1.5, y, [[0, 0.01], [0, 0.01]], 4, W), solid: false });
    parts.push(loose([[-1.5 - WH - 0.8, y - 0.8, -0.4], [-1.5 + WH + 0.8, y + 0.8, 2 * WH + 0.4]], (g, e) => {
      // The rim as the circle it is, turned with the cart, and six spokes to its hub.
      const at = (a: number, r: number) => proj(e, [-1.5 + Math.cos(a) * r, y, WH + Math.sin(a) * r]);
      const [cx, cy] = at(0, 0);
      for (const [w, c] of [[1.6, deeper(W, 0.4).shade], [1, W.lit]] as Array<[number, RGB]>) {
        g.strokeStyle = css(c);
        g.lineWidth = w;
        g.beginPath();
        for (let i = 0; i <= 24; i++) { const [px, py] = at((i / 24) * TAU, WH); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      }
      g.strokeStyle = css(W.shade);
      g.lineWidth = 0.5;
      for (let i = 0; i < 6; i++) { const [px, py] = at((i / 6) * TAU, WH); g.beginPath(); g.moveTo(cx, cy); g.lineTo(px, py); g.stroke(); }
    }));
  }
  // The bed of the cart, its sides, its legs at the handle end, and the handles.
  parts.push({ faces: slab(-7.5, 7, -3.4, 3.4, 4, 4.8, W, { paint: woodSides(401, 'x') }), edges: true });
  for (const [y0, y1] of [[-3.4, -2.9], [2.9, 3.4]]) parts.push({ faces: slab(-7.5, 7, y0, y1, 4.8, 6.4, W, { paint: woodSides(402, 'x') }) });
  parts.push({ faces: slab(-7.5, -7, -2.9, 2.9, 4.8, 6.4, W) });
  parts.push({ faces: slab(6.5, 7, -2.9, 2.9, 4.8, 6.4, W) });
  for (const y of [-2.6, 2.6]) {
    parts.push({ faces: leg(6.2, y, 0, 4, deeper(W, 0.15), 410 + y, 0.6) });
    parts.push({ faces: rod([7, y, 5.4], [9.6, y * 1.1, 6.6], 0.3, W, 5) });
  }
  // Its load: clay pots of flowers.
  const pots: Array<[number, number, string]> = [[-5.2, -1.3, 'pink'], [-2.4, 1.4, 'yellow'], [0.4, -1.2, 'blue'], [3.6, 1.2, 'white'], [-4.6, 1.6, 'lilac'], [2.2, 1.3, 'pink']];
  for (const [x, y, c] of pots) {
    parts.push({ faces: pot(x, y, 4.8, 1.3, 2.2) });
    parts.push(bloomPart([x, y, 6.9], c, 3, 0.8, 420 + Math.round(x * 3 + y)));
  }
  return { parts, shade: shadeOf(-7.5, 7, -3.6, 3.6) };
}

export const FLOWER_CART: KitPiece = { model: (look) => flowerCartOf(look), uses: { material: true, tint: true } };

/* ---- 11. the birdhouse ------------------------------------------------------------------------------ */

const BH_Z = 13, BH_W = 2, BH_H = 3.2;

function birdhouseOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const parts: KitPart[] = [];
  parts.push({ faces: slab(-0.45, 0.45, -0.45, 0.45, 0, BH_Z, deeper(W, 0.1), { corner: 0.1, paint: woodSides(501, 'y') }) });
  parts.push({ faces: slab(-1.2, 1.2, -1.2, 1.2, 0, 0.5, deeper(W, 0.25)) });
  const house = slab(-BH_W, BH_W, -BH_W, BH_W, BH_Z, BH_Z + BH_H, W, {
    corner: 0.1,
    paint: {
      ...woodSides(502, 'y'),
      front: (g, k, s) => {
        grain(g, k.fill, s.w, s.h, 503, 'y', 0.6);
        g.beginPath();
        g.arc(s.w / 2, s.h * 0.62, 0.55, 0, TAU);
        g.fillStyle = css(mix(k.fill, hex('#2e2430'), 0.75));
        g.fill();
      },
    },
  });
  parts.push({ faces: house, edges: true });
  parts.push({ faces: gableRoof(-BH_W - 0.6, BH_W + 0.6, -BH_W - 0.6, BH_W + 0.6, BH_Z + BH_H, BH_Z + BH_H + 1.8, deeper(W, 0.3), 504), edges: true });
  parts.push({ faces: rod([0, BH_W, BH_Z + 1.1], [0, BH_W + 1, BH_Z + 1.1], 0.12, W, 4) });
  // Room for its birds, drawn over the bake (`birds`).
  parts.push(loose([[-7, -7, BH_Z - 2], [7, 7, BH_Z + 9]], () => undefined));
  return { parts, shade: shadeOf(-1.2, 1.2, -1.2, 1.2) };
}

/**
 * Small birds about a birdhouse, drawn each frame over it: by day and out of
 * winter (`birdsAbout`), as many as the Effects setting allows (`gardenFx`),
 * each on a loop of its own, out from the hole, round and back, or a moment on
 * the perch.
 */
export const gardenFx = { birds: true, share: 1, season: 'summer' as string };

function birds(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, night: number, t: number, seed: number): void {
  if (!gardenFx.birds || night >= 0.5 || gardenFx.season === 'winter' || zoom < 0.6) return;
  const n = Math.round(BIRDS_MOST * gardenFx.share);
  const e = eyeOfView(view);
  const [hx, hy] = proj(e, [0, BH_W + 0.6, BH_Z + 2]);
  for (let i = 0; i < n; i++) {
    const period = 7 + i * 2.3, ph = ((t + seed * 1.7 + i * 3.1) % period) / period;
    // Out, round in a loop, and back in.
    const a = ph * TAU + i * 2.1;
    const r = Math.sin(ph * Math.PI) * (6 + i * 2.5);
    const x = sx + (hx + Math.cos(a) * r) * zoom, y = sy + (hy - Math.abs(Math.sin(a)) * r * 0.5 - Math.sin(ph * Math.PI) * 4) * zoom;
    const flap = Math.sin(t * 22 + i) > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(zoom, zoom);
    ctx.fillStyle = '#7a5a4c';
    ctx.beginPath(); ctx.ellipse(0, 0, 1.3, 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c49a';
    ctx.beginPath(); ctx.ellipse(-0.2, 0.15, 0.8, 0.45, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5a4448';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-1.6, -0.4 * flap); ctx.lineTo(0, -0.1); ctx.lineTo(1.6, -0.4 * flap); ctx.stroke();
    ctx.restore();
  }
}

export const BIRDHOUSE: KitPiece = {
  model: (look) => birdhouseOf(look), uses: { material: true, tint: true }, wind: true,
  live: (ctx, sx, sy, zoom, view, night, t, air) => birds(ctx, sx, sy, zoom, view, night, air?.t ?? t, air?.seed ?? 0),
};

/* ---- 13. the arbour bench --------------------------------------------------------------------------- */

function arbourOf(look: KitLook): KitModel {
  const bench = benchOf(look);
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [...bench.parts];
  const X = 9.2, Y = -2.6, H = 15, R = 4.5;
  for (const x of [-X, X]) parts.push({ faces: slab(x - 0.55, x + 0.55, Y - 0.55, Y + 0.55, 0, H, W, { corner: 0.12, paint: woodSides(601 + x, 'y') }) });
  // The arch over the back, and laths up between the posts.
  const SEG = 12;
  for (let k = 0; k < SEG; k++) {
    const t0 = Math.PI * (1 - k / SEG), t1 = Math.PI * (1 - (k + 1) / SEG);
    parts.push({ faces: strut([X * Math.cos(t0), Y, H + R * Math.sin(t0)], [X * Math.cos(t1), Y, H + R * Math.sin(t1)], 0.5, 0.5, W) });
  }
  for (let i = 1; i < 6; i++) {
    const x = -X + (i * 2 * X) / 6;
    const top = H + R * Math.sqrt(Math.max(0, 1 - (x / X) ** 2));
    parts.push({ faces: slab(x - 0.14, x + 0.14, Y - 0.14, Y + 0.14, 7.5, top, paler(W, 0.08)) });
  }
  for (const z of [10, 13]) parts.push({ faces: slab(-X, X, Y - 0.12, Y + 0.12, z - 0.12, z + 0.12, paler(W, 0.08)) });
  parts.push(...climbingRoses((q) => {
    if (q < 0.55) return [-X, 0, 1 + ((H - 1) * q) / 0.55];
    const th = Math.PI - (Math.PI / 2) * ((q - 0.55) / 0.45);
    return [X * Math.cos(th), 0, H + R * Math.sin(th)];
  }, 0.9, look.trim ?? roseTrim(0, 10, true), 1.2).map((p) => moveY(p, Y)));
  return { parts, shade: shadeOf(-X - 0.6, X + 0.6, -3, 2.6) };
}

/** A part moved back along y by `dy`: the roses on the arbour's back, which stands behind the seat. */
function moveY(p: KitPart, dy: number): KitPart {
  return {
    ...p,
    reach: p.reach?.map(([x, y, z]) => [x, y + dy, z] as V3),
    draw: p.draw ? (g, e) => { const [ox, oy] = proj(e, [0, dy, 0]); g.save(); g.translate(ox, oy); p.draw?.(g, e); g.restore(); } : undefined,
  };
}

export const ARBOUR_BENCH: KitPiece = {
  model: (look) => arbourOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: roseTrim(0, 0.6, true), label: 'canes' },
    { trim: roseTrim(1, 1.6, true), label: 'leafing' },
    { trim: roseTrim(2, 2.5, true), label: 'buds' },
    { trim: roseTrim(0, 4, true), label: 'in flower' },
    { trim: roseTrim(3, 4, false), label: 'out of season' },
  ],
};
void roseOf;

/* ---- 14. the carved figure -------------------------------------------------------------------------- */

/**
 * A carved figure's kind as its trim carries it (`figureTrim`): one more than
 * its place in the field guide's kinds, and a thousand more once its model
 * has come in, so it is baked again as itself rather than as the block it is
 * drawn as before.
 */
export const figureTrim = (index: number, ready: boolean): number => (index < 0 ? 0 : index + 1 + (ready ? 1000 : 0));
/** What draws a kind as a carving, by its place in the guide's kinds: set by `render/gardenlook.ts`, which loads the models. */
export const carving: { draw: ((g: Ctx, index: number, w: number, h: number, wood: RGB) => boolean) | null } = { draw: null };

function figureOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.6);
  const t = Math.max(0, Math.floor(look.trim ?? 0));
  const index = (t % 1000) - 1;
  const ready = t >= 1000 && index >= 0;
  const parts: KitPart[] = [];
  parts.push({ faces: slab(-2.2, 2.2, -2.2, 2.2, 0, 1.2, deeper(W, 0.15), { corner: 0.3, bevel: 0.15, paint: woodSides(701, 'x') }), edges: true });
  const H = 8.5;
  if (!ready) {
    // No kind yet, or its model not come in: the block roughed out, two lumps stepping in.
    parts.push({ faces: slab(-1.9, 1.9, -1.7, 1.7, 1.2, 5.4, W, { corner: 0.5, bevel: 0.3, paint: woodSides(703, 'y') }), edges: true });
    parts.push({ faces: slab(-1.5, 1.5, -1.3, 1.3, 5.4, 1.2 + H, W, { corner: 0.6, bevel: 0.3, paint: woodSides(704, 'y') }), edges: true });
    return { parts, shade: shadeOf(-2.2, 2.2, -2.2, 2.2) };
  }
  parts.push(loose([[-2.8, -2.8, 1.2], [2.8, 2.8, 1.2 + H]], (g, e) => {
    const [x, y] = proj(e, [0, 0, 1.2]);
    const pw = 5.6 * across(e) * 1.1, ph = H * 2.25;
    // Ruled round in the wood's own deep shade, as a solid is.
    inked(g, mix(W.shade, KIT_INK_RGB, 0.5), (h) => {
      h.save();
      h.translate(x - pw / 2, y - ph);
      carving.draw?.(h, index, pw, ph, W.lit);
      h.restore();
    });
  }));
  return { parts, shade: shadeOf(-2.2, 2.2, -2.2, 2.2) };
}

export const CARVED_FIGURE: KitPiece = {
  model: (look) => figureOf(look), uses: { trim: true, material: true, tint: true },
  states: [...[0, 4, 8, 20, 40].map((i) => ({ trim: figureTrim(i, true), label: `kind ${i + 1}` })), { trim: 0, label: 'no kind' }],
};

/* ---- 15. the trophy plaque ---------------------------------------------------------------------------- */

/** What a plaque shows, by the trophy's id: an ear, a tusk, a jaw, a scale, or a crest for anything else. */
export const TROPHY_SHAPES = ['crest', 'ear', 'tusk', 'jaw', 'scale'] as const;
export const trophyTrim = (def: string | null): number => {
  if (!def) return 1;
  const i = TROPHY_SHAPES.findIndex((s) => s !== 'crest' && def.includes(s));
  return 2 + Math.max(0, i);
};
const PLQ_Z = 14, PLQ_H = 7, PLQ_W = 3.4;

function plaqueOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.6);
  // Unsaid, a crest on it: what the game measures it at.
  const t = said(look.trim, 1);
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - 0.6;
  // A shield of board, its edge moulded, a brass plate under where the trophy hangs.
  parts.push({ faces: slab(-PLQ_W, PLQ_W, y0, y1, PLQ_Z, PLQ_Z + PLQ_H, W, { corner: 0.9, bevel: 0.25, paint: { front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 801, 'y', 0.6); } } }), edges: true });
  parts.push({ faces: slab(-1.6, 1.6, y0 - 0.12, y0, PLQ_Z + 0.6, PLQ_Z + 1.4, BRASS), edges: true });
  if (t > 0) {
    const shape = TROPHY_SHAPES[Math.min(TROPHY_SHAPES.length - 1, t - 1)];
    const c: V3 = [0, y0 - 0.8, PLQ_Z + 4.4];
    parts.push(loose([[c[0] - 3, c[1] - 1, c[2] - 3], [c[0] + 3, c[1] + 1, c[2] + 3]], (g, e) => {
      const [x, y] = proj(e, c);
      const u = across(e);
      g.lineJoin = 'round';
      const ink = (fill: string, path: () => void): void => {
        path(); g.strokeStyle = 'rgba(74, 56, 62, 0.9)'; g.lineWidth = INK * 1.3; g.stroke(); g.fillStyle = fill; g.fill();
      };
      if (shape === 'ear') {
        ink('#9cb08a', () => { g.beginPath(); g.moveTo(x - 2 * u, y + 2 * u); g.quadraticCurveTo(x - 2.4 * u, y - 2 * u, x + 2.6 * u, y - 4 * u); g.quadraticCurveTo(x + 1.6 * u, y + 0.6 * u, x - 2 * u, y + 2 * u); });
        ink('#c9a7a0', () => { g.beginPath(); g.moveTo(x - 1.2 * u, y + 1 * u); g.quadraticCurveTo(x - 1 * u, y - 1.4 * u, x + 1.6 * u, y - 2.6 * u); g.quadraticCurveTo(x + 0.6 * u, y + 0.2 * u, x - 1.2 * u, y + 1 * u); });
      } else if (shape === 'tusk') {
        ink('#f0e4c8', () => { g.beginPath(); g.moveTo(x - 2.6 * u, y + 1.6 * u); g.quadraticCurveTo(x - 1 * u, y - 3.6 * u, x + 2.8 * u, y - 2.4 * u); g.quadraticCurveTo(x - 0.4 * u, y - 1.6 * u, x - 1.4 * u, y + 2 * u); g.closePath(); });
      } else if (shape === 'jaw') {
        ink('#e8dcc4', () => { g.beginPath(); g.moveTo(x - 3 * u, y - 1 * u); g.quadraticCurveTo(x, y + 3.4 * u, x + 3 * u, y - 1 * u); g.lineTo(x + 2.2 * u, y - 1 * u); g.quadraticCurveTo(x, y + 2 * u, x - 2.2 * u, y - 1 * u); g.closePath(); });
        g.fillStyle = '#fbf3e2';
        for (let i = 0; i < 5; i++) { const tx = x + (i - 2) * 0.9 * u; g.beginPath(); g.moveTo(tx - 0.3 * u, y - 0.4 * u + Math.abs(i - 2) * -0.3 * u + 0.8 * u); g.lineTo(tx, y - 0.9 * u); g.lineTo(tx + 0.3 * u, y + 0.4 * u); g.fill(); }
      } else if (shape === 'scale') {
        ink('#7fc0b8', () => { g.beginPath(); g.moveTo(x, y - 3 * u); g.quadraticCurveTo(x + 3 * u, y - 1 * u, x, y + 3 * u); g.quadraticCurveTo(x - 3 * u, y - 1 * u, x, y - 3 * u); });
        g.fillStyle = 'rgba(232, 214, 255, 0.7)';
        g.beginPath(); g.ellipse(x - 0.6 * u, y - 0.8 * u, 0.7 * u, 1.3 * u, 0.4, 0, TAU); g.fill();
      } else {
        ink('#d9b56a', () => { g.beginPath(); g.arc(x, y, 2 * u, 0, TAU); });
        ink('#c0605e', () => { g.beginPath(); g.arc(x, y, 1 * u, 0, TAU); });
      }
    }, true, 3));
  }
  return { parts, shade: null };
}

export const TROPHY_PLAQUE: KitPiece = {
  model: (look) => plaqueOf(look), uses: { trim: true, material: true, tint: true },
  states: [...TROPHY_SHAPES.map((s, i): { trim: number; label: string } => ({ trim: i + 2, label: s })), { trim: 1, label: 'empty' }],
};

/* ---- 17. the folding screen -------------------------------------------------------------------------- */

function screenOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.6);
  const CLOTH = clothTone(look.tint);
  const parts: KitPart[] = [];
  const H = 16;
  // Three leaves, zig-zag across the spot, each a frame with a lattice over its cloth.
  const pts: Array<[number, number]> = [[-4.4, -1.4], [-1.5, 1.2], [1.5, -1.2], [4.4, 1.4]];
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const lattice = (g: Ctx, k: PaintCtx, s: Side): void => {
      g.fillStyle = css(mix(CLOTH.lit, k.fill, 0.2));
      g.fillRect(0, 0, s.w, s.h);
      g.strokeStyle = css(W.shade, 0.85);
      g.lineWidth = 0.22;
      for (let d = -s.h; d < s.w + s.h; d += 1.4) {
        g.beginPath(); g.moveTo(d, 0); g.lineTo(d + s.h, s.h); g.stroke();
        g.beginPath(); g.moveTo(d + s.h, 0); g.lineTo(d, s.h); g.stroke();
      }
    };
    parts.push({ faces: strut([ax, ay, H / 2], [bx, by, H / 2], 0.18, H - 2.4, CLOTH, lattice) });
    for (const [x, y] of [[ax, ay], [bx, by]]) parts.push({ faces: slab(x - 0.3, x + 0.3, y - 0.3, y + 0.3, 0, H, W, { corner: 0.08 }) });
    parts.push({ faces: rod([ax, ay, H - 0.3], [bx, by, H - 0.3], 0.28, W, 4) });
    parts.push({ faces: rod([ax, ay, 0.9], [bx, by, 0.9], 0.28, W, 4) });
  }
  parts.push(loose([[-4.9, -1.9, 0], [4.9, 1.9, 16.4]], () => undefined));
  return { parts, shade: shadeOf(-4.6, 4.6, -1.6, 1.6) };
}

export const FOLDING_SCREEN: KitPiece = { model: (look) => screenOf(look), uses: { material: true, tint: true } };

/* ---- 18. the tiered plant stand ------------------------------------------------------------------------ */

/** A stand's trim: what is on each of its steps, lowest first: nought none, one a fern, two a palm. */
export const standTrim = (pots: readonly string[]): number => 1 +
  pots.slice(0, STAND_HOLDS).reduce((n, p, i) => n + (p.includes('fern') ? 1 : p.includes('palm') ? 2 : 0) * 3 ** i, 0);

function standOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.75);
  const t = said(look.trim, standTrim(['potted_fern', 'potted_palm', 'potted_fern']) - 1);
  const parts: KitPart[] = [];
  const steps: Array<[number, number]> = [[2.4, 3], [0, 6.5], [-2.4, 10]];
  for (const [y, z] of steps) {
    parts.push({ faces: slab(-4, 4, y - 1.2, y + 1.2, z - 0.6, z, W, { corner: 0.12, bevel: 0.1, paint: woodSides(901 + z, 'x') }), edges: true });
    for (const x of [-3.6, 3.6]) parts.push({ faces: leg(x, y, 0, z - 0.6, deeper(W, 0.1), 910 + z + x, 0.55) });
  }
  steps.forEach(([y, z], i) => {
    const what = Math.floor(t / 3 ** i) % 3;
    if (!what) return;
    parts.push({ faces: pot(0, y, z, 1.25, 2) });
    if (what === 1) parts.push(fernParts(0, y, z + 1.9, 0.45));
    else parts.push(...palmParts(0, y, z + 1.9, 0.5));
  });
  return { parts, shade: shadeOf(-4, 4, -3.6, 3.6) };
}

export const PLANT_STAND: KitPiece = {
  model: (look) => standOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: standTrim([]), label: 'empty' },
    { trim: standTrim(['potted_fern']), label: 'one fern' },
    { trim: standTrim(['potted_fern', 'potted_palm', 'potted_fern']), label: 'full' },
  ],
};

/* ---- 19. the wind chime ------------------------------------------------------------------------------- */

const CHIME_HOOK = 24, CHIME_DISC = 21.6;
const TUBES: Array<[number, number]> = [[0, 4.2], [1.2, 3.4], [2.4, 4.8], [3.6, 2.9], [4.8, 3.8]];

function chimeOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.6);
  const y = FACE_Y - 3;
  const parts: KitPart[] = [...bracket(y, CHIME_HOOK, W)];
  // Room for its tubes, drawn over the bake as the wind swings them (`chimeTubes`).
  parts.push(loose([[-3.4, y - 3.4, CHIME_DISC - 9], [3.4, y + 3.4, CHIME_DISC]], () => undefined));
  parts.push({ faces: rod([0, y, CHIME_HOOK - 0.2], [0, y, CHIME_DISC + 0.3], 0.08, ROPE, 4) });
  parts.push({ faces: lathe(0, y, [[CHIME_DISC, 1.4], [CHIME_DISC + 0.4, 1.4], [CHIME_DISC + 0.4, 0.01]], 10, W), edges: true });
  return { parts, shade: null };
}

/**
 * Its tubes, the striker and the sail, drawn each frame: hung still in still
 * air, swung by the wind as hard as it blows and each its own way, knocking
 * together over `CHIME_STILL`.
 */
function chimeTubes(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, air?: KitAir): void {
  const e = eyeOfView(view);
  const f = Math.max(0, air?.force ?? 0);
  const t = air?.t ?? 0;
  const y = FACE_Y - 3;
  const W = woodTone();
  const sway = f < CHIME_STILL ? 0.04 : 0.12 + f * 0.5;
  const wind = air ? Math.atan2(air.y, air.x) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(zoom, zoom);
  ctx.lineCap = 'round';
  const hang = (ax: number, ay: number, len: number, w: number, ph: number, fill: RGB): void => {
    const a = Math.sin(t * (2.2 + ph * 0.3) + ph) * sway + (f >= CHIME_STILL ? Math.cos(wind) * f * 0.25 : 0);
    const top: V3 = [ax, y + ay, CHIME_DISC - 0.1];
    const bot: V3 = [ax + Math.sin(a) * len * 0.45, y + ay + Math.cos(wind + ph) * Math.sin(a) * len * 0.3, CHIME_DISC - 0.1 - len * Math.cos(a)];
    const [x0, y0] = proj(e, top), [x1, y1] = proj(e, bot);
    ctx.strokeStyle = css(mix(KIT_INK_RGB, fill, 0.15));
    ctx.lineWidth = w + INK * 1.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = css(fill);
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = css(mix(fill, [255, 248, 236], 0.45), 0.8);
    ctx.lineWidth = w * 0.35;
    ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.lineTo(x1 - w * 0.2, y1); ctx.stroke();
  };
  for (const [i, [ang, len]] of TUBES.entries()) hang(Math.cos(ang) * 1.1, Math.sin(ang) * 1.1, len, 0.7, i * 1.3, W.lit);
  // The striker in the middle, and the sail under it.
  hang(0, 0, 4.4, 0.35, 9, ROPE.shade);
  ctx.restore();
}

export const WIND_CHIME: KitPiece = {
  model: (look) => chimeOf(look), uses: { material: true, tint: true }, wind: true,
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => chimeTubes(ctx, sx, sy, zoom, view, air),
};

void deeper; void IRON; void hex;
