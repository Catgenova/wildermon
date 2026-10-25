/**
 * Crops drawn: a planter's plants flat (`cropPlant`, a row along the box), and
 * a field's as solids lit by the sun (`fieldBake`, below).
 */
import { mulberry32 } from '../world/noise';
import { HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { KIT_INK, KIT_INK_W } from './kit/core';
import { eyeOf, proj } from './runestone';
import { ACROSS } from './trees3d/paint';
import { lightOf, type Light } from './trees3d/light';
import type { RGB, V3 } from './trees3d/types';
import { hex, mixRgb, rgb } from './trees3d/vec';

const TAU = Math.PI * 2;

/**
 * One plant of a crop at a stage, its foot at (px, py), flat: what a planter
 * is drawn with a row of. Roots keep their heads down
 * and swell late, leaves spread, grain runs up into ears, herbs stay low and
 * bushy, and fibre opens into bolls; a ripe one carries its produce. `u`
 * turns a rosette's leaves, and `s` is its size, one at a field's.
 */
export function cropPlant(ctx: CanvasRenderingContext2D, px: number, py: number, look: string, stage: number, leaf: string, fruit: string, u = 0, s = 1): void {
  const grown = stage / 3;
  const h = (look === 'grain' ? 10 : look === 'leaf' ? 6 : 5) * (0.45 + grown * 0.85) * s;
  const w = (look === 'leaf' ? 7 : 4.5) * (0.5 + grown * 0.7) * s;
  ctx.lineCap = 'round';
  ctx.strokeStyle = leaf;
  ctx.fillStyle = leaf;
  if (look === 'grain') {
    // A stalk with an ear on top once it is up.
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 1 * s, py - h * 0.6, px + 1.6 * s, py - h);
    ctx.stroke();
    if (stage >= 2) {
      ctx.fillStyle = stage === 3 ? fruit : leaf;
      ctx.beginPath();
      ctx.ellipse(px + 1.8 * s, py - h - 1.6 * s, 1.7 * s, 3.4 * (stage === 3 ? 1.15 : 0.8) * s, 0.2, 0, TAU);
      ctx.fill();
    }
  } else if (look === 'leaf') {
    // A rosette of broad leaves, closing into a head when ripe.
    const blades = 5;
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * TAU + u;
      ctx.beginPath();
      ctx.ellipse(px + Math.cos(a) * w * 0.35, py - h * 0.35 + Math.sin(a) * w * 0.18, w * 0.5, h * 0.32, a * 0.3, 0, TAU);
      ctx.fill();
    }
    if (stage === 3) {
      ctx.fillStyle = fruit;
      ctx.beginPath();
      ctx.ellipse(px, py - h * 0.55, w * 0.42, h * 0.42, 0, 0, TAU);
      ctx.fill();
    }
  } else if (look === 'fibre') {
    ctx.lineWidth = 1.2 * s;
    for (const d of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + d * 2 * s, py - h * 0.6, px + d * 3.4 * s, py - h);
      ctx.stroke();
    }
    if (stage === 3) {
      ctx.fillStyle = fruit;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(px + d * 3.2 * s, py - h - 0.5 * s, 2.2 * s, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    // Roots and herbs: a low tuft, with the crop showing at the soil when ripe.
    ctx.lineWidth = 1.4 * s;
    for (const d of [-1.2, 0, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + d * 1.6 * s, py - h * 0.7, px + d * 2.6 * s, py - h);
      ctx.stroke();
    }
    if (stage === 3) {
      ctx.fillStyle = fruit;
      if (look === 'root') {
        ctx.beginPath();
        ctx.ellipse(px, py + 0.6 * s, 3.2 * s, 2.1 * s, 0, 0, TAU);
        ctx.fill();
      } else {
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(px + d * 2.2 * s, py - h * 0.75, 1.5 * s, 0, TAU);
          ctx.fill();
        }
      }
    }
  }
}


/* ---- fields drawn as solids --------------------------------------------------------------- */

/*
 * A tile of field as the solid trees are drawn (`./trees3d`): every plant
 * built in three dimensions, seen from the camera's turn, its planes lit by
 * the island's sun at its step of the day (`SUN_STEPS`), ruled round in the
 * kit's ink, its shade thrown on the furrows under it.
 *
 * One picture a crop, a stage, a winter or not, a turn and a step of the sun:
 * every tile of a crop at a stage is the same picture, put down once a tile
 * as the flat one was. Its furrows run along the world's x, row with row from
 * tile to tile, and turn with the camera.
 */

/** Model units: `UNITS_PER_TILE` across a tile, a height unit up (`HEIGHT_SCALE` pixels at zoom one). */
const HALF = UNITS_PER_TILE / 2;
/** Rows a tile: a ridge under each, a furrow between. */
const ROWS = 4;
const ROW = UNITS_PER_TILE / ROWS;
/** How high a ridge stands over its furrow, in height units: a tilled one and a fallow one. */
const RIDGE = 1.3;
/** Kept off the tile's edge, in model units: what the ground's hem shows through. */
const RIM = 0.9;
/** Ink round every mass, as the trees' (`KIT_INK`, `KIT_INK_W`). */
const INK = rgb(KIT_INK, 0.92);
/** A stalk's ink: lighter, or a field of them is all ink at zoom one. */
const STALK_INK = rgb(KIT_INK, 0.55);
/** The furrows' tones laid over the field's ground: a furrow's floor, a ridge's crest, a drill's wet line. */
const FURROW_INK = 'rgba(70,50,32,0.5)';
const CREST_LIGHT = 'rgba(255,236,214,0.32)';
const DRILL = 'rgba(52,34,22,0.78)';
/** Slope light laid over the ground: the sunny face of a ridge, and the face away. */
const SLOPE_LIT: RGB = [255, 238, 214];
const SLOPE_DARK: RGB = [52, 36, 24];
/** The shade the plants throw, in the trees' shade tone (`shaded` in `./trees3d`). */
const SHADE_TONE = 'rgba(30,56,66,0.26)';
/** A winter's rime on the ridges and on what faces up. */
const RIME = 'rgba(236,241,248,0.66)';
const RIME_TOP = '#eef2f8';
/** How far either side of a furrow's floor a winter's snow lies, in model units. */
const FROST_LYING = 1.3;
/** How far toward the rime a winter takes what faces up, and what does not. */
const FROST_UP = 0.55;
const FROST_SIDE = 0.22;
/** A crop's colours gone over for a winter it is waiting out: dull, and a little frosted. */
export const DORMANT_LEAF = '#8c8a62';
export const DORMANT_FRUIT = '#a99a78';
/** What a ripe crop's leaf turns toward as it ripens: grain and wemp to straw, potato haulm to yellow, cotton to rust. */
const STRAW = '#d8c27a';
/** A green head not yet ripe (grain, wemp); a rosemary's needles' shade; a woody stem (rosemary, cotton); a ripe awn's light. */
const GREEN_HEAD = '#d8f0a0';
const NEEDLE_DARK = '#1e3a2c';
const WOODY_STEM = '#5e4632';
const AWN_LIGHT = '#fff4d0';
/** What a sprout's first leaves are taken toward: fresh and bright. */
const SPROUT_GREEN = '#b8e07a';
/** Ripe grain: its heads warmed toward this, its stems a step darker. */
const GRAIN_WARM = '#e3a63e';
const GRAIN_STEM = '#9a7a3c';
/** The sheen on what is ripe to harvest: its heads, cobs, bulbs, bolls and flowers. */
const SHEEN = 'rgba(255,250,232,0.85)';
const HAULM = '#c9b46a';
const COTTON_RUST = '#a0703c';
/** Flowers on a ripe crop that shows them: the herbs' spikes and the potato's. */
const FLOWER: Record<string, string> = {
  sage: '#9a86c8', basil: '#f3efe2', thyme: '#d4a6cf', mint: '#b9a2d6', rosemary: '#a7bde6', potato: '#f1ecf4',
};
/** Corn's tassel, and the husk round a cob. */
const TASSEL = '#cdb07e';

/** Plants a row on a tile, by crop: a stage before ripe has the same. */
const PER_ROW: Record<string, number> = {
  wheat: 7, corn: 3, onion: 6, carrot: 6, cabbage: 3, potato: 3, sage: 4, basil: 4, thyme: 5, mint: 5, rosemary: 4, cotton: 3, wemp: 4,
};

type P2 = [number, number];
type Op =
  | { k: 'stalk'; pts: V3[]; w: number; col: string; bare?: boolean }
  | { k: 'leaf'; pts: V3[]; n: V3; col: string; rib?: boolean }
  | { k: 'ball'; c: V3; r: number; col: string; shine?: boolean }
  | { k: 'spindle'; a: V3; b: V3; w: number; col: string; shine?: boolean };

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const toHex = (c: RGB): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mixH = (a: string, b: string, k: number): string => toHex(mixRgb(hex(a), hex(b), k));
const unitV = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const addV = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const crossV = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A blade or a broad leaf from `a` out to `b`: `w` its half-width at the widest, `up` how much it cups, `droop` how far its tip falls. */
function leafOps(a: V3, b: V3, w: number, col: string, droop = 0, round = 0.5, rib = false): Op {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const flat = Math.hypot(d[0], d[1]);
  // Its side is across it level with the ground; an upright blade's side is any level way across.
  const side: V3 = flat > 1e-6 ? [-d[1] / flat, d[0] / flat, 0] : [1, 0, 0];
  const n = unitV(crossV(side, d));
  const N = 5;
  const left: V3[] = [], right: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const along: V3 = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t - droop * t * t];
    // Widest a little before the middle for a broad leaf, toward the foot for a blade.
    const half = w * Math.pow(Math.sin(Math.PI * Math.pow(t, round)), 0.8);
    left.push([along[0] + side[0] * half, along[1] + side[1] * half, along[2]]);
    right.push([along[0] - side[0] * half, along[1] - side[1] * half, along[2]]);
  }
  return { k: 'leaf', pts: [...left, ...right.reverse()], n: n[2] < 0 ? [-n[0], -n[1], -n[2]] : n, col, rib };
}

/** A point `r` out from `c` at an angle `a` and a height `z`. */
const out = (c: V3, a: number, r: number, z: number): V3 => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + z];

/**
 * One plant of a crop at a stage, its foot at the origin: `R` its own
 * roll for its jitter, `k` how grown (1 at ripe). What each crop is
 * known by, ripe: wheat's gold nodding ears, corn's tall stalk and cob,
 * onion's bulb sat on the soil, carrot's orange shoulder under lace,
 * cabbage's head, potato's flowers and tubers, the herbs' mounds and
 * spikes, cotton's bolls, wemp's tall fans and seed heads.
 */
function plantOf(id: string, stage: number, leaf: string, fruit: string, R: () => number): Op[] {
  const ops: Op[] = [];
  const ripe = stage >= 3;
  const a0 = R() * Math.PI * 2;
  if (stage === 1) {
    // A sprout: a tuft of blades for what comes up as grass, a pair of seed leaves and a first true leaf for the rest -- big enough to read as a green row from afar.
    const young = mixH(leaf, SPROUT_GREEN, 0.25);
    if (id === 'wheat' || id === 'corn' || id === 'onion') {
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * 1.6;
        ops.push({ k: 'stalk', pts: [[0, 0, 0], out([0, 0, 0], a, 0.6, 2.2), out([0, 0, 0], a, 1.5, 3.8 + R())], w: 1.1, col: young });
      }
    } else {
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0, 0, 1.8]], w: 0.9, col: young });
      for (const s of [0, Math.PI]) ops.push(leafOps([0, 0, 1.7], out([0, 0, 1.7], a0 + s, 2.6, 0.9), 1.15, young, 0, 0.6));
      ops.push(leafOps([0, 0, 1.8], out([0, 0, 1.8], a0 + 1.57, 1.6, 1.9), 0.8, leaf, 0, 0.6));
    }
    return ops;
  }
  const k = ripe ? 1 : 0.62;
  switch (id) {
    case 'wheat': {
      // Ripe: a dense gold mass of bowed heads over darker stems, straw blades filling in under them.
      const stalk = ripe ? mixH(fruit, GRAIN_STEM, 0.6) : leaf;
      const head = ripe ? mixH(fruit, GRAIN_WARM, 0.35) : mixH(leaf, GREEN_HEAD, 0.15);
      const blades = ripe ? 4 : 2;
      for (let i = 0; i < blades; i++) ops.push(leafOps([0, 0, 0.4], out([0, 0, 0], a0 + i * (6.28 / blades), 3.6 * k, 2.8 * k), ripe ? 0.6 : 0.45, ripe ? mixH(fruit, STRAW, 0.5) : leaf, 1.2, 0.35));
      const n = ripe ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * (6.28 / n) + R() * 0.5, lean = (ripe ? 1.2 : 0.6) + R() * 1.4, h = (ripe ? 8.6 : 8.5) * (0.9 + R() * 0.2) * k;
        const top = out([0, 0, 0], a, lean, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], out([0, 0, 0], a, lean * 0.4, h * 0.55), top], w: ripe ? 0.85 : 0.75, col: stalk });
        if (ripe) {
          // Ripe ears bow over, all their own way.
          const nod = a + (R() - 0.5) * 0.8;
          const tip = out(top, nod, 2.7, 0.9);
          ops.push({ k: 'spindle', a: out(top, nod, -0.2, -0.4), b: tip, w: 0.72, col: head, shine: true });
          // Its awns, fine and unruled, on past the tip.
          for (const s of [-0.35, 0.35]) ops.push({ k: 'stalk', pts: [out(top, nod, 1.6, 0.9), out(tip, nod + s, 1.4, 0.7)], w: 0.3, col: mixH(head, AWN_LIGHT, 0.3), bare: true });
        } else ops.push({ k: 'spindle', a: top, b: out(top, a, 0.3, 2.2), w: 0.42, col: head });
      }
      break;
    }
    case 'corn': {
      const h = 21 * k;
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0.2, 0, h * 0.5], [0.3, 0.1, h]], w: 1.5, col: ripe ? mixH(leaf, STRAW, 0.25) : leaf });
      for (let i = 0; i < 6; i++) {
        const z = (2.5 + i * 2.6) * k, a = a0 + i * 2.6;
        ops.push(leafOps([0.2, 0, z], out([0.2, 0, z + 2.5 * k], a, 6.5 * k, 0), 0.75, ripe && i < 2 ? mixH(leaf, STRAW, 0.5) : leaf, 3.2 * k, 0.4));
      }
      if (ripe) {
        const c: V3 = [0.2, 0, h * 0.48];
        ops.push(leafOps(c, out(c, a0 + 1.3, 1.4, 5.2), 1.15, mixH(leaf, STRAW, 0.2), 0, 0.5));
        ops.push({ k: 'spindle', a: out(c, a0 + 1.3, 0.6, 0.6), b: out(c, a0 + 1.3, 1.7, 5.0), w: 1.05, col: fruit, shine: true });
        for (let i = 0; i < 4; i++) ops.push({ k: 'stalk', pts: [[0.3, 0.1, h], out([0.3, 0.1, h], a0 + i * 1.6, 1.3, 2.2), out([0.3, 0.1, h], a0 + i * 1.6, 2.2, 1.6)], w: 0.6, col: TASSEL });
      }
      break;
    }
    case 'onion': {
      if (ripe) ops.push({ k: 'ball', c: [0, 0, 1.3], r: 1.85, col: fruit, shine: true });
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.26, h = (ripe ? 5.5 : 7) * (0.8 + R() * 0.3) * (ripe ? 1 : k + 0.2);
        const base: V3 = [0, 0, ripe ? 2.6 : 0];
        const tip = ripe && i % 2 ? out(base, a, 3.4, h * 0.35) : out(base, a, 0.9 + R(), h);
        ops.push({ k: 'stalk', pts: [base, out(base, a, ripe && i % 2 ? 1.6 : 0.4, h * 0.6), tip], w: 1.25, col: ripe ? mixH(leaf, fruit, 0.25 + 0.3 * (i % 2)) : leaf });
      }
      break;
    }
    case 'carrot': {
      if (ripe) ops.push({ k: 'spindle', a: [0, 0, -0.6], b: [0, 0, 1.4], w: 1.25, col: fruit, shine: true });
      for (let i = 0; i < 6; i++) {
        const a = a0 + i * 1.05, h = (4.8 + R()) * k, r = (2.4 + R()) * k;
        const tip = out([0, 0, 0], a, r, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 1], out([0, 0, 1], a, r * 0.4, h * 0.6), tip], w: 0.5, col: leaf });
        // Lace: a few small tufts along the frond.
        ops.push({ k: 'ball', c: tip, r: 0.95 * k + 0.2, col: leaf });
        ops.push({ k: 'ball', c: out([0, 0, 0], a + 0.25, r * 0.65, h * 0.8), r: 0.75 * k + 0.15, col: mixH(leaf, '#ffffff', 0.06) });
      }
      break;
    }
    case 'cabbage': {
      const n = 7, r = ripe ? 6 : 4.6;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        ops.push(leafOps([0, 0, 1], out([0, 0, 0], a, r, ripe ? 2.6 : 3.4), ripe ? 2.6 : 2.1, i % 2 ? leaf : mixH(leaf, '#000000', 0.06), -0.6, 0.55, true));
      }
      if (ripe) ops.push({ k: 'ball', c: [0, 0, 3.6], r: 3.7, col: fruit, shine: true });
      else ops.push({ k: 'ball', c: [0, 0, 2.4], r: 1.7, col: mixH(leaf, fruit, 0.4) });
      break;
    }
    case 'potato': {
      const haulm = ripe ? mixH(leaf, HAULM, 0.35) : leaf;
      if (ripe) for (let i = 0; i < 2; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 2.6 + 0.6, 3.6, 0.5), r: 1.25, col: fruit, shine: true });
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.25, r = (2.4 + R()) * k;
        const c = out([0, 0, 0], a, r, (3.2 + R() * 1.2) * k);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], c], w: 0.7, col: haulm });
        ops.push({ k: 'ball', c, r: 2.3 * k, col: i % 2 ? haulm : mixH(haulm, '#ffffff', 0.07) });
      }
      ops.push({ k: 'ball', c: [0, 0, 5.4 * k], r: 2.5 * k, col: haulm });
      if (ripe) for (let i = 0; i < 4; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 1.6, 1.8, 7.6 + R()), r: 0.6, col: FLOWER.potato, shine: true });
      break;
    }
    case 'sage': {
      for (let i = 0; i < 9; i++) {
        const a = a0 + i * 0.7 + R() * 0.3, z = 0.6 + (i % 3) * 1.4;
        ops.push(leafOps([0, 0, z], out([0, 0, z], a, (3.3 + R()) * k, 1.8 * k), 1.25 * k, i > 5 ? mixH(leaf, fruit, ripe ? 0.6 : 0.2) : leaf, 0.4, 0.6));
      }
      if (ripe) for (let i = 0; i < 3; i++) {
        const b = out([0, 0, 3], a0 + i * 2.1, 1.6, 4.5);
        ops.push({ k: 'stalk', pts: [[0, 0, 3], b], w: 0.5, col: leaf });
        ops.push({ k: 'spindle', a: out(b, a0 + i * 2.1, 0.1, -0.6), b: out(b, a0 + i * 2.1, 0.5, 2.3), w: 0.55, col: FLOWER.sage, shine: true });
      }
      break;
    }
    case 'basil': {
      const h = 5.5 * k;
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0, 0, h]], w: 0.8, col: leaf });
      for (let j = 0; j < 3; j++) {
        const z = h * (0.3 + j * 0.3), a = a0 + j * 1.57, r = (3.4 - j * 0.7) * k;
        for (const s of [0, Math.PI]) ops.push(leafOps([0, 0, z], out([0, 0, z], a + s, r, 0.8), 1.5 * k, j === 2 ? mixH(leaf, fruit, ripe ? 0.65 : 0.25) : leaf, 1.0, 0.55, true));
      }
      if (ripe) for (const s of [-1, 1]) ops.push({ k: 'spindle', a: out([0, 0, h - 0.5], a0 + s, 0.3, 0), b: out([0, 0, h - 0.5], a0 + s, 1.0, 2.6), w: 0.55, col: FLOWER.basil, shine: true });
      break;
    }
    case 'thyme': {
      for (let i = 0; i < 5; i++) {
        const c = i === 4 ? [0, 0, 1.6 * k] as V3 : out([0, 0, 0], a0 + i * 1.57, 1.9 * k, 1.0 * k);
        ops.push({ k: 'ball', c, r: 1.7 * k, col: i === 4 ? mixH(leaf, fruit, ripe ? 0.55 : 0.2) : leaf });
      }
      if (ripe) for (let i = 0; i < 5; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 1.26 + 0.6, i === 4 ? 0.3 : 1.7, i === 4 ? 3.6 : 2.6), r: 0.62, col: FLOWER.thyme, shine: true });
      break;
    }
    case 'mint': {
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * 1.57 + R() * 0.4, h = (4.6 + R() * 1.2) * k;
        const top = out([0, 0, 0], a, 1.2, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], top], w: 0.6, col: leaf });
        for (let j = 0; j < 2; j++) {
          const z = h * (0.45 + j * 0.35);
          const c = out([0, 0, 0], a, 1.2 * (z / h), z);
          for (const s of [-1, 1]) ops.push(leafOps(c, out(c, a + s * 1.57 + j, 1.9 * k, 0.4), 0.85 * k, j ? mixH(leaf, fruit, ripe ? 0.55 : 0.2) : leaf, 0.5, 0.5));
        }
        if (ripe) ops.push({ k: 'spindle', a: top, b: out(top, a, 0.3, 2.4), w: 0.5, col: FLOWER.mint, shine: true });
      }
      break;
    }
    case 'rosemary': {
      // Upright woody sprays, dark needles in pairs up each.
      const needle = mixH(leaf, NEEDLE_DARK, 0.1);
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.26, h = (6.6 + R() * 1.4) * k, top = out([0, 0, 0], a, (1.5 + R()) * k, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], out([0, 0, 0], a, 0.5 * k, h * 0.55), top], w: 0.6, col: mixH(leaf, WOODY_STEM, 0.5) });
        for (let j = 1; j <= 4; j++) {
          const t = j / 4.6, c: V3 = [top[0] * t, top[1] * t, top[2] * t];
          for (const s of [-1, 1]) ops.push(leafOps(c, out(c, a + s * 1.2, 1.3 * k, 0.9 * k), 0.38, j === 4 && ripe ? mixH(needle, fruit, 0.6) : needle, 0, 0.4));
        }
        if (ripe) ops.push({ k: 'ball', c: out(top, a, -0.2, -1.4), r: 0.6, col: FLOWER.rosemary, shine: true });
      }
      break;
    }
    case 'cotton': {
      const green = ripe ? mixH(leaf, COTTON_RUST, 0.3) : leaf;
      const h = 9 * k;
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0, 0, h]], w: 0.9, col: mixH(green, WOODY_STEM, 0.4) });
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * 1.57, z = h * (0.35 + i * 0.15), tip = out([0, 0, z], a, 3.2 * k, 1.6 * k);
        ops.push({ k: 'stalk', pts: [[0, 0, z], tip], w: 0.6, col: mixH(green, WOODY_STEM, 0.4) });
        ops.push(leafOps(tip, out(tip, a + 0.6, 2.6 * k, 0.6), 1.9 * k, green, 0.8, 0.6));
        if (ripe) for (let j = 0; j < 3; j++) ops.push({ k: 'ball', c: out(tip, a + j * 2.1, 0.55, 0.9 + (j === 2 ? 0.5 : 0)), r: 0.95, col: fruit, shine: true });
      }
      if (ripe) for (let j = 0; j < 3; j++) ops.push({ k: 'ball', c: out([0, 0, h], a0 + j * 2.1, 0.6, 0.7), r: 1.05, col: fruit, shine: true });
      else ops.push(leafOps([0, 0, h], out([0, 0, h], a0, 2 * k, 1.2), 1.3 * k, green, 0.5, 0.6));
      break;
    }
    case 'wemp': {
      const h = 17 * k;
      const green = ripe ? mixH(leaf, STRAW, 0.3) : leaf;
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0.3, 0, h * 0.5], [0.4, 0.2, h]], w: 1.0, col: green });
      for (let j = 0; j < 3; j++) {
        const z = h * (0.35 + j * 0.22), c: V3 = [0.3, 0.1, z], n = 5;
        // Two hands of leaflets a tier, fanned out either side.
        for (const side of [0, Math.PI]) {
          const sa = a0 + j * 1.9 + side, p = out(c, sa, 0.9, 0.2);
          for (let i = 0; i < n; i++) ops.push(leafOps(p, out(p, sa + (i - 2) * 0.45, (4.6 - j) * k, -0.4), 0.62, j === 2 && ripe ? mixH(green, fruit, 0.4) : green, 1.1, 0.4));
        }
      }
      if (ripe) {
        ops.push({ k: 'spindle', a: [0.4, 0.2, h - 1], b: [0.4, 0.4, h + 3.4], w: 1.0, col: fruit, shine: true });
        for (const s of [-1, 1]) ops.push({ k: 'spindle', a: [0.4, 0.2, h - 2.5], b: out([0.4, 0.2, h - 2.5], a0 + s, 1.5, 2.6), w: 0.7, col: fruit, shine: true });
      } else ops.push({ k: 'spindle', a: [0.4, 0.2, h - 0.5], b: [0.4, 0.3, h + 1.5], w: 0.6, col: mixH(leaf, GREEN_HEAD, 0.2) });
      break;
    }
    default:
      ops.push({ k: 'ball', c: [0, 0, 2 * k], r: 2 * k, col: leaf });
  }
  return ops;
}

/** How many ways a crop's plant grows: each plant on a tile is one of them, stamped where it stands. */
const VARIANTS = 4;
/** How many ways a tile of a crop is laid out: a tile takes one by where it is. */
export const FIELD_LAYOUTS = 3;

/**
 * The plants on a tile of a crop: a row along each ridge, `PER_ROW` to it,
 * each a little off its place by the crop's own roll and grown as one of its
 * `VARIANTS` -- the same at every stage, so a plant grows where it stood --
 * laid out one of `FIELD_LAYOUTS` ways, so a field is not one tile over again.
 */
function plantsOf(id: string, stage: number, leaf: string, fruit: string, layout: number): { feet: Array<{ at: V3; v: number }>; kinds: Op[][] } {
  const per = PER_ROW[id] ?? 4;
  const R = mulberry32(fieldHash(id) + 77 + layout * 1013);
  const feet: Array<{ at: V3; v: number }> = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < per; i++) {
      const jx = (R() - 0.5) * (UNITS_PER_TILE / per) * 0.3, jy = (R() - 0.5) * 1.2;
      feet.push({ at: [-HALF + (i + 0.5) * (UNITS_PER_TILE / per) + jx, -HALF + (j + 0.5) * ROW + jy, RIDGE * 0.8], v: Math.floor(R() * VARIANTS) });
    }
  }
  const kinds: Op[][] = [];
  for (let v = 0; v < VARIANTS; v++) kinds.push(plantOf(id, stage, leaf, fruit, mulberry32(fieldHash(id) + v * 7919 + 131)));
  return { feet, kinds };
}

function fieldHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** How lit a face turned along `n` is, as the trees' (`./trees3d/paint`): 0 in its own shade to 1 square to the sun. */
const litOf = (light: Light, n: V3): number =>
  clamp01((light.ambient + light.direct * Math.max(0, n[0] * light.sun[0] + n[1] * light.sun[1] + n[2] * light.sun[2]) - 0.22) / 0.82);
/** A colour as lit `l`: from its shade tone to its lit tone, flat. */
const litCol = (col: string, l: number): string => {
  const c = hex(col);
  return rgb(mixRgb(mixRgb(c, [0, 0, 0], 0.3), mixRgb(c, [255, 255, 255], 0.2), l));
};

export interface CropBake { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }
/** What the fields' bakes have cost: for a harness. */
export const cropStats = { bakes: 0, ms: 0, standIns: 0 };
/** Every bake kept, by its key, and the frame it was last asked for in. */
const cropBakes = new Map<string, { spr: CropBake; used: number }>();
/** The latest bake of each crop, stage and turn, in any layout, at any step of the sun and any scale: what stands in while a frame has made all it may. */
const cropLatest = new Map<string, CropBake>();
let cropPixels = 0;
let cropFrameNo = 0;
/** Pixels of field bakes kept. */
const CROP_PIXELS = 6_000_000;
/** What a frame may spend baking fields when an older bake of the same can stand in, and when only the bare ground can. */
const CROP_BAKE_MS = 3;
const CROP_COLD_MS = 24;
let cropSpent = 0;

/** A new frame: its own `CROP_BAKE_MS` to spend. */
export function cropFrame(): void {
  cropSpent = 0;
  cropFrameNo++;
}

/**
 * A tile of field: `stage` -1 for one tilled and lying fallow, else the crop
 * `id` at that stage; `dormant` a field waiting out a winter, which grows
 * nothing: its green gone dull, a rime on its ridges and on whatever faces up.
 * Seen from `turn`, under the sun's `step` (`sunStepOf`), `scale` pixels to a
 * pixel at zoom one, anchored at the tile's middle.
 *
 * Made now, or, once this frame has spent `CROP_BAKE_MS`, the same crop's
 * last bake in another layout, step of the sun or scale stands in; with none and
 * `CROP_COLD_MS` spent, the sown ground does until its turn comes.
 */
export function fieldBake(id: string, stage: number, leaf: string, fruit: string, dormant: boolean, turn: number, step: number, scale: number, layout = 0): CropBake {
  // Bare and sown ground is the same whatever the crop and however it is laid out: one bake for all of them.
  if (stage <= 0) { id = ''; layout = 0; }
  const head = `${id}|${stage}|${dormant ? 1 : 0}|${turn}`;
  const key = `${head}|${layout}|${step}|${scale}`;
  const had = cropBakes.get(key);
  if (had) {
    had.used = cropFrameNo;
    return had.spr;
  }
  if (stage > 0 && cropSpent >= CROP_BAKE_MS) {
    const near = cropLatest.get(head);
    if (near || cropSpent >= CROP_COLD_MS) {
      cropStats.standIns++;
      return near ?? fieldBake('', 0, '', '', dormant, turn, step, scale);
    }
  }
  const t0 = performance.now();
  const spr = bakeField(id, stage, leaf, fruit, dormant, turn, step, scale, layout);
  const ms = performance.now() - t0;
  cropSpent += ms;
  cropStats.bakes++;
  cropStats.ms += ms;
  cropBakes.set(key, { spr, used: cropFrameNo });
  cropLatest.set(head, spr);
  cropPixels += spr.canvas.width * spr.canvas.height;
  if (cropPixels > CROP_PIXELS) {
    // Room made by letting go of what has gone longest unasked for, and never what this frame has asked for.
    const old = [...cropBakes].sort((a, b) => a[1].used - b[1].used);
    for (const [k, b] of old) {
      if (cropPixels <= CROP_PIXELS * 0.8 || b.used === cropFrameNo) break;
      cropBakes.delete(k);
      cropPixels -= b.spr.canvas.width * b.spr.canvas.height;
      const h = k.split('|').slice(0, 4).join('|');
      if (cropLatest.get(h) === b.spr) cropLatest.delete(h);
    }
  }
  return spr;
}

/** Every field bake let go. */
export function forgetFields(): void {
  cropBakes.clear();
  cropStamps.clear();
  cropLatest.clear();
  cropPixels = 0;
}

function bakeField(id: string, stage: number, leaf0: string, fruit0: string, dormant: boolean, turn: number, step: number, scale: number, layout: number): CropBake {
  const leaf = dormant ? mixH(leaf0, DORMANT_LEAF, 0.6) : leaf0;
  const fruit = dormant ? mixH(fruit0, DORMANT_FRUIT, 0.45) : fruit0;
  const e = eyeOf(0, turn);
  const light = lightOf(step);
  const P = (p: V3): P2 => proj(e, p);
  const { feet, kinds } = stage >= 1 ? plantsOf(id, stage, leaf, fruit, layout) : { feet: [], kinds: [] };
  // Back to front.
  const near = (p: V3): number => p[0] * e.toward[0] + p[1] * e.toward[1];
  feet.sort((a, b) => near(a.at) - near(b.at));
  // The sun across the screen, for which side of a round thing is lit.
  const sv = [light.sun[0] * e.ux + light.sun[1] * e.vx, light.sun[0] * e.uy + light.sun[1] * e.vy - light.sun[2] * HEIGHT_SCALE];
  const sl = Math.hypot(sv[0], sv[1]) || 1;
  const look: PlantLook = { light, sun: [sv[0] / sl, sv[1] / sl], stalkLit: litOf(light, unitV([light.sun[0], light.sun[1], 0.4])) * 0.75, dormant };
  // Each way the plant grows, painted once, its foot at the origin: the same for every layout of the tile.
  const sk = `${id}|${stage}|${dormant ? 1 : 0}|${turn}|${step}|${scale}`;
  let stamps = cropStamps.get(sk);
  if (!stamps) {
    stamps = kinds.map((ops) => stampOf(ops, P, look, scale));
    cropStamps.set(sk, stamps);
    if (cropStamps.size > STAMPS_KEPT) cropStamps.delete(cropStamps.keys().next().value as string);
  }

  /* ---- the box: the tile, and every plant on it ---- */
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, r = 0): void => {
    x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
  };
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) grow(...P([cx * HALF, cy * HALF, 0]), 1);
  for (const f of feet) {
    const [fx, fy] = P(f.at), st = stamps[f.v];
    grow(fx + st.x0, fy + st.y0);
    grow(fx + st.x0 + st.cv.width / scale, fy + st.y0 + st.cv.height / scale);
  }
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((x1 - x0) * scale));
  canvas.height = Math.max(1, Math.ceil((y1 - y0) * scale));
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2d context');
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  /* ---- the ground: ridges and furrows, kept inside the tile ---- */
  const tile = new Path2D();
  const quad = (q: V3[], into: Path2D): void => {
    const [a, ...rest] = q.map(P);
    into.moveTo(a[0], a[1]);
    for (const p of rest) into.lineTo(p[0], p[1]);
    into.closePath();
  };
  const E = HALF - RIM;
  quad([[-E, -E, 0], [E, -E, 0], [E, E, 0], [-E, E, 0]], tile);
  g.save();
  g.clip(tile);
  const flatLit = litOf(light, [0, 0, 1]);
  const ridge = stage < 0 ? RIDGE * 0.75 : RIDGE;
  for (const side of [-1, 1]) {
    // Each face of every ridge, lit or shaded against the flat ground under it.
    const n = unitV([0, side * ridge, ROW / 2]);
    const d = litOf(light, n) - flatLit;
    const faces = new Path2D();
    for (let j = 0; j < ROWS; j++) {
      const yc = -HALF + (j + 0.5) * ROW;
      quad([[-HALF, yc, ridge], [HALF, yc, ridge], [HALF, yc + side * ROW / 2, 0], [-HALF, yc + side * ROW / 2, 0]], faces);
    }
    g.fillStyle = d >= 0 ? rgb(SLOPE_LIT, Math.min(0.55, d * 1.6)) : rgb(SLOPE_DARK, Math.min(0.55, -d * 1.6));
    g.fill(faces);
  }
  const lineAlong = (y: number, z: number, path: Path2D): void => {
    const [a, b] = [P([-HALF, y, z]), P([HALF, y, z])];
    path.moveTo(a[0], a[1]);
    path.lineTo(b[0], b[1]);
  };
  if (dormant) {
    // A winter's snow lying in the furrows, and rime along the ridges.
    const snow = new Path2D();
    for (let j = 0; j <= ROWS; j++) {
      const y = -HALF + j * ROW;
      quad([[-HALF, y - FROST_LYING, ridge * (FROST_LYING / (ROW / 2))], [HALF, y - FROST_LYING, ridge * (FROST_LYING / (ROW / 2))], [HALF, y + FROST_LYING, ridge * (FROST_LYING / (ROW / 2))], [-HALF, y + FROST_LYING, ridge * (FROST_LYING / (ROW / 2))]], snow);
    }
    g.fillStyle = RIME;
    g.fill(snow);
  }
  const furrows = new Path2D(), crests = new Path2D();
  for (let j = 0; j <= ROWS; j++) lineAlong(-HALF + j * ROW, 0, furrows);
  for (let j = 0; j < ROWS; j++) lineAlong(-HALF + (j + 0.5) * ROW, ridge, crests);
  g.strokeStyle = FURROW_INK;
  g.lineWidth = 0.9;
  g.stroke(furrows);
  g.strokeStyle = dormant ? RIME : CREST_LIGHT;
  g.lineWidth = dormant ? 1.6 : 1.1;
  g.stroke(crests);
  if (stage === 0) {
    // Sown: a dark drill pressed along each crest, the seed in it.
    g.strokeStyle = DRILL;
    g.lineWidth = 1.9;
    g.stroke(crests);
  }

  /* ---- the plants' shade on it, every plant's at once ---- */
  if (feet.length) {
    const fl = Math.hypot(light.sun[0], light.sun[1]) || 1;
    const dx = (-light.sun[0] / fl) * light.throw, dy = (-light.sun[1] / fl) * light.throw;
    const shade = new Path2D();
    const disc = (p: V3, r: number): void => {
      const z = Math.max(0, p[2]);
      const [sx, sy] = P([p[0] + dx * z, p[1] + dy * z, 0]);
      const rx = r * ACROSS, ry = rx / 2;
      shade.moveTo(sx + rx, sy);
      shade.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    };
    for (const f of feet) {
      disc(f.at, 1.4);
      for (const op of kinds[f.v]) {
        if (op.k === 'ball') disc(addV(f.at, op.c), op.r * 0.9);
        else if (op.k === 'spindle') disc(addV(f.at, [(op.a[0] + op.b[0]) / 2, (op.a[1] + op.b[1]) / 2, (op.a[2] + op.b[2]) / 2]), op.w);
        else if (op.k === 'leaf') disc(addV(f.at, op.pts[Math.floor(op.pts.length / 4)]), 0.9);
        else if (!op.bare) for (let i = 1; i < op.pts.length; i++) disc(addV(f.at, op.pts[i]), 0.35);
      }
    }
    g.fillStyle = SHADE_TONE;
    g.fill(shade);
  }
  g.restore();

  /* ---- the plants, back to front: each stamped where it stands, on whole pixels ---- */
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const f of feet) {
    const [fx, fy] = P(f.at), st = stamps[f.v];
    g.drawImage(st.cv, Math.round((fx + st.x0 - x0) * scale), Math.round((fy + st.y0 - y0) * scale));
  }
  return { canvas, w: x1 - x0, h: y1 - y0, ax: -x0, ay: -y0 };
}

/** How a bake's plants are lit: the light, the sun's way across the screen, a stalk's light, and whether it is a winter. */
interface PlantLook { light: Light; sun: P2; stalkLit: number; dormant: boolean }

/** Each crop's plants painted, by crop, stage, winter, turn, step and scale, the latest `STAMPS_KEPT` of them: what the layouts of a tile share. */
const cropStamps = new Map<string, Stamp[]>();
const STAMPS_KEPT = 48;
interface Stamp { cv: HTMLCanvasElement; x0: number; y0: number }

/** One way a plant grows, painted on a canvas of its own at `scale`, its foot `-x0, -y0` in from the corner: stamped on a tile as many times as it stands there. */
function stampOf(ops: Op[], P: (p: V3) => P2, look: PlantLook, scale: number): Stamp {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const op of ops) {
    const pts = op.k === 'ball' ? [op.c] : op.k === 'spindle' ? [op.a, op.b] : op.pts;
    const r = op.k === 'ball' ? op.r * ACROSS + 2 : op.k === 'spindle' ? op.w * ACROSS * 2 + 2 : 2;
    for (const p of pts) {
      const [x, y] = P(p);
      x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
      y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
    }
  }
  // On whole pixels of the bake, so a stamp is put down unstretched.
  x0 = Math.floor(x0 * scale) / scale; y0 = Math.floor(y0 * scale) / scale;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil((x1 - x0) * scale));
  cv.height = Math.max(1, Math.ceil((y1 - y0) * scale));
  const g = cv.getContext('2d');
  if (!g) throw new Error('no 2d context');
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  paintPlant(g, ops, P, look);
  return { cv, x0, y0 };
}

/** A plant's ink, then its faces, each lit as it faces the sun. */
function paintPlant(g: CanvasRenderingContext2D, ops: Op[], P: (p: V3) => P2, { light, sun, stalkLit, dormant }: PlantLook): void {
  const shapes: Array<{ op: Op; path: Path2D | null; pts?: P2[] }> = [];
  // Ink: every mass of it, and its stalks, as one.
  const ink = new Path2D();
  for (const op of ops) {
    if (op.k === 'stalk') {
      const pts = op.pts.map(P);
      const p = new Path2D();
      p.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 3) p.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      else for (const q of pts.slice(1)) p.lineTo(q[0], q[1]);
      shapes.push({ op, path: p });
    } else if (op.k === 'leaf') {
      const pts = op.pts.map(P);
      const p = new Path2D();
      p.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts.slice(1)) p.lineTo(q[0], q[1]);
      p.closePath();
      ink.addPath(p);
      shapes.push({ op, path: p, pts });
    } else if (op.k === 'ball') {
      const [cx, cy] = P(op.c);
      const r = op.r * ACROSS;
      const p = new Path2D();
      p.arc(cx, cy, r, 0, Math.PI * 2);
      ink.addPath(p);
      shapes.push({ op, path: p, pts: [[cx, cy]] });
    } else {
      const a = P(op.a), b = P(op.b);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
      const w = op.w * ACROSS;
      const p = new Path2D();
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      p.moveTo(a[0], a[1]);
      p.quadraticCurveTo(mx + nx * w * 2, my + ny * w * 2, b[0], b[1]);
      p.quadraticCurveTo(mx - nx * w * 2, my - ny * w * 2, a[0], a[1]);
      p.closePath();
      ink.addPath(p);
      shapes.push({ op, path: p, pts: [a, b, [nx, ny]] });
    }
  }
  g.strokeStyle = STALK_INK;
  for (const s of shapes) {
    if (s.op.k !== 'stalk' || s.op.bare) continue;
    g.lineWidth = s.op.w + KIT_INK_W * 1.6;
    g.stroke(s.path as Path2D);
  }
  g.strokeStyle = INK;
  g.lineWidth = KIT_INK_W * 2;
  g.stroke(ink);
  for (const { op, path, pts } of shapes) {
    if (op.k === 'stalk') {
      g.strokeStyle = litCol(dormant ? mixH(op.col, RIME_TOP, FROST_SIDE) : op.col, Math.min(0.8, 0.35 + stalkLit));
      g.lineWidth = op.w;
      g.stroke(path as Path2D);
    } else if (op.k === 'leaf') {
      // Two-sided: lit by whichever face the sun is on, the underside a little less.
      const l = Math.max(litOf(light, op.n), litOf(light, [-op.n[0], -op.n[1], -op.n[2]]) * 0.7);
      const col = dormant ? mixH(op.col, RIME_TOP, op.n[2] > 0.3 ? FROST_UP : FROST_SIDE) : op.col;
      g.fillStyle = litCol(col, l);
      g.fill(path as Path2D);
      if (op.rib && pts) {
        const n = pts.length / 2;
        g.strokeStyle = litCol(col, Math.max(0, l - 0.35));
        g.lineWidth = 0.4;
        g.beginPath();
        const a = pts[0], b = pts[n - 1];
        g.moveTo(a[0], a[1]);
        g.lineTo(a[0] + (b[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.8);
        g.stroke();
      }
    } else if (op.k === 'ball' && pts) {
      // Round: its shade, a lit face toward the sun, and a light on that.
      const [cx, cy] = pts[0];
      const r = op.r * ACROSS;
      g.fillStyle = litCol(op.col, litOf(light, unitV([-light.sun[0], -light.sun[1], 0.6])) * 0.6 + 0.12);
      g.fill(path as Path2D);
      g.fillStyle = litCol(op.col, litOf(light, unitV([light.sun[0] * 0.5, light.sun[1] * 0.5, 1])));
      g.beginPath();
      g.arc(cx + sun[0] * r * 0.2, cy + sun[1] * r * 0.2 - r * 0.04, r * 0.76, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dormant ? RIME_TOP : litCol(op.col, Math.min(1, litOf(light, light.sun) + 0.15));
      g.beginPath();
      if (dormant) g.ellipse(cx, cy - r * 0.55, r * 0.62, r * 0.32, 0, 0, Math.PI * 2);
      else g.arc(cx + sun[0] * r * 0.42, cy + sun[1] * r * 0.42, r * 0.3, 0, Math.PI * 2);
      g.fill();
      if (op.shine && !dormant) {
        // Ripe: a crisp sheen round its lit side.
        const a = Math.atan2(sun[1], sun[0]);
        g.strokeStyle = SHEEN;
        g.lineWidth = Math.max(0.45, r * 0.16);
        g.beginPath();
        g.arc(cx, cy, r * 0.74, a - 0.7, a + 0.7);
        g.stroke();
      }
    } else if (op.k === 'spindle' && pts) {
      // Long and round: its shade, and its half toward the sun lit.
      const [a, b, [nx, ny]] = pts;
      const w = op.w * ACROSS;
      g.fillStyle = litCol(dormant ? mixH(op.col, RIME_TOP, FROST_SIDE) : op.col, litOf(light, unitV([-light.sun[0], -light.sun[1], 0.6])) * 0.6 + 0.15);
      g.fill(path as Path2D);
      const sgn = nx * sun[0] + ny * sun[1] >= 0 ? 1 : -1;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      g.fillStyle = dormant ? mixH(op.col, RIME_TOP, FROST_UP) : litCol(op.col, litOf(light, unitV([light.sun[0], light.sun[1], 0.8])));
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(mx + nx * w * 2 * sgn, my + ny * w * 2 * sgn, b[0], b[1]);
      g.quadraticCurveTo(mx + nx * w * 0.3 * sgn, my + ny * w * 0.3 * sgn, a[0], a[1]);
      g.fill();
      if (op.shine && !dormant) {
        // Ripe: a glint along its lit side.
        const o = w * 1.05 * sgn;
        g.strokeStyle = SHEEN;
        g.lineWidth = Math.max(0.4, w * 0.4);
        g.beginPath();
        g.moveTo(a[0] + (b[0] - a[0]) * 0.28 + nx * o, a[1] + (b[1] - a[1]) * 0.28 + ny * o);
        g.lineTo(a[0] + (b[0] - a[0]) * 0.66 + nx * o, a[1] + (b[1] - a[1]) * 0.66 + ny * o);
        g.stroke();
      }
    }
  }
}
