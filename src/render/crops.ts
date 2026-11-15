/**
 * Crops drawn: a planter's plants flat (`cropPlant`, a row along the box), and
 * a field's as solids lit by the sun (`fieldBake`, below).
 */
import { RIPE } from '../game/farming';
import { mulberry32 } from '../world/noise';
import { BED_RAIL } from './flooring';
import { HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { KIT_INK_W } from './kit/core';
import { eyeOf, proj, type Eye } from './runestone';
import { ACROSS } from './trees3d/paint';
import { lightOf, SUN_STEPS, type Light } from './trees3d/light';
import type { RGB, V3 } from './trees3d/types';
import { hex, mixRgb, rgb } from './trees3d/vec';

const TAU = Math.PI * 2;

/**
 * One plant of a crop at a stage, its foot at (px, py), flat: what the
 * low-end graphics' fields (`cropFlatSprite`) and the old planter box are
 * drawn with. Roots keep their heads down and swell late, leaves spread, grain
 * runs up into ears, herbs stay low and bushy, and fibre opens into bolls; a
 * ripe one carries its produce, in its colour. Painted as a field's are
 * (`paintPlant`) but flatter: each part its shade and, over it to the left,
 * its light, in the same pastel, and no ink. `u` turns a rosette's leaves,
 * and `s` is its size, one at a field's.
 */
export function cropPlant(ctx: CanvasRenderingContext2D, px: number, py: number, look: string, stage: number, leaf: string, fruit: string, u = 0, s = 1): void {
  const grown = stage / 3;
  const ripe = stage === 3;
  const h = (look === 'grain' ? 10 : look === 'leaf' ? 6 : 5) * (0.45 + grown * 0.85) * s;
  const w = (look === 'leaf' ? 7 : 4.5) * (0.5 + grown * 0.7) * s;
  // Grain and fibre go over to straw as they ripen.
  const green = ripe && (look === 'grain' || look === 'fibre') ? mixH(leaf, STRAW, 0.35) : leaf;
  const [lit, shade] = [litCol(green, 0.8), litCol(green, 0.28)];
  const [fLit, fShade] = [litCol(fruit, 0.85, true), litCol(fruit, 0.3, true)];
  const off = 0.35 * s;
  ctx.lineCap = 'round';
  /** Stalks or blades from the foot, each a curve through (cx, cy) to (ex, ey) off it: in shade, then their lit halves a little to the left. */
  const line = (lw: number, curves: number[][]): void => {
    for (const [col, k, dx, dy] of [[shade, 1, 0, 0], [lit, 0.55, -off * 0.6, -off * 0.3]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw * k;
      ctx.beginPath();
      for (const [cx, cy, ex, ey] of curves) {
        ctx.moveTo(px + dx, py + dy);
        ctx.quadraticCurveTo(px + cx + dx, py + cy + dy, px + ex + dx, py + ey + dy);
      }
      ctx.stroke();
    }
  };
  /** A round part in shade, and its light over its upper left. */
  const blob = (x: number, y: number, rx: number, ry: number, rot: number, dark: string, light: string): void => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.22, y - ry * 0.22, rx * 0.66, ry * 0.66, rot, 0, TAU);
    ctx.fill();
  };
  if (look === 'grain') {
    // A stalk with an ear on top once it is up: green, then gold and full ripe.
    line(1.3 * s, [[1 * s, -h * 0.6, 1.6 * s, -h]]);
    if (stage >= 2) blob(px + 1.8 * s, py - h - 1.6 * s, (ripe ? 2 : 1.6) * s, 3.4 * (ripe ? 1.2 : 0.8) * s, 0.2, ripe ? fShade : shade, ripe ? fLit : lit);
  } else if (look === 'leaf') {
    // A rosette of broad leaves, closing into a head when ripe.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + u;
      const right = Math.cos(a) > 0;
      blob(px + Math.cos(a) * w * 0.35, py - h * 0.35 + Math.sin(a) * w * 0.18, w * 0.5, h * 0.32, a * 0.3, shade, right ? litCol(green, 0.55) : lit);
    }
    if (ripe) blob(px, py - h * 0.55, w * 0.46, h * 0.46, 0, fShade, fLit);
  } else if (look === 'fibre') {
    line(1.2 * s, [-1, 0, 1].map((d) => [d * 2 * s, -h * 0.6, d * 3.4 * s, -h]));
    if (ripe) for (const d of [-1, 1]) blob(px + d * 3.2 * s, py - h - 0.5 * s, 2.4 * s, 2.3 * s, 0, fShade, fLit);
  } else {
    // Roots and herbs: a low tuft, with the crop showing at the soil (a root) or in flower over it (a herb) when ripe.
    if (ripe && look === 'root') blob(px, py + 0.4 * s, 3.4 * s, 2.3 * s, 0, fShade, fLit);
    line(1.4 * s, [-1.2, 0, 1.2].map((d) => [d * 1.6 * s, -h * 0.7, d * 2.6 * s, -h]));
    if (ripe && look !== 'root') for (const d of [-1, 0, 1]) blob(px + d * 2.2 * s, py - h * (d ? 0.8 : 1.05), 1.5 * s, 1.5 * s, 0, fShade, fLit);
  }
}

/* ---- fields drawn as solids --------------------------------------------------------------- */

/*
 * A tile of field as the solid trees are drawn (`./trees3d`): every plant
 * built in three dimensions, seen from the camera's turn, its planes lit by
 * the island's sun at its step of the day (`SUN_STEPS`), painted as the world
 * is (`paintPlant`: a soft edge, pastel light and shade, a mottle), its shade
 * thrown on the furrows under it; on a garden bed, inside its frame (`BED_IN`).
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
/** On a garden bed, how far in the ground and the plants' feet are drawn: inside its frame (`BED_RAIL`), with a hair to spare. */
const BED_IN = (HALF * (1 - 2 * BED_RAIL) - 0.4) / (HALF - RIM);
/**
 * The edge a mass is softly ruled in, painted as the world is
 * (`docs/aesthetic.md`): a deep of its own colour (`edgeOf`) rather than the
 * kit's ink, how strong it is laid, and how wide against the kit's ink.
 */
const EDGE_ALPHA = 0.48;
const EDGE_W = KIT_INK_W * 1.2;
/** The furrows' tones laid over the field's ground: a furrow's floor, a ridge's crest. */
const FURROW_INK = 'rgba(96,70,88,0.4)';
const CREST_LIGHT = 'rgba(255,240,208,0.34)';
/** Sown: the drill pressed along a crest, its lip catching the light, and the seed in it. */
const DRILL = '#8a6656';
const DRILL_LIP = 'rgba(255,236,200,0.5)';
const SEED = '#ead7a2';
/** The turned earth along a drill, a shade lighter and a shade darker than it. */
const CRUMB = ['#9c7766', '#7c5c55'] as const;
/** Slope light laid over the ground: the sunny face of a ridge, and the face away (plum, not black). */
const SLOPE_LIT: RGB = [255, 240, 210];
const SLOPE_DARK: RGB = [78, 60, 100];
/** The shade the plants throw, in the trees' shade tone (`shaded` in `./trees3d`). */
const SHADE_TONE = 'rgba(40,62,96,0.22)';
/** A winter's rime on the ridges and on what faces up. */
const RIME = 'rgba(222,232,248,0.62)';
const RIME_TOP = '#e6edf8';
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
/** A green ear of grain, not yet ripe: a deeper green than its blades, so a growing field reads green and a ripe one gold. */
const GREEN_EAR = '#6a9440';
const NEEDLE_DARK = '#1e3a2c';
const WOODY_STEM = '#5e4632';
const AWN_LIGHT = '#fff4d0';
/** What each herb's leaf is taken toward, so each reads by its colour as well as its shape: sage silver, basil bright, thyme pale, mint fresh. */
const SAGE_SILVER = '#c9d2c2';
const BASIL_BRIGHT = '#6cd04a';
const THYME_PALE = '#d8e4be';
const MINT_BRIGHT = '#7fe0a0';
/** The gloss along a glossy leaf (basil). */
const GLOSS = 'rgba(255,255,250,0.55)';
/** What a sprout's first leaves are taken toward: fresh and bright. */
const SPROUT_GREEN = '#b8e07a';
/** Ripe grain: its heads warmed toward this, its stems a step darker. */
const GRAIN_WARM = '#d38d2c';
const GRAIN_STEM = '#9a7a3c';
/** The sheen on what is ripe to harvest: its heads, cobs, bulbs, bolls and flowers. */
const SHEEN = 'rgba(255,250,232,0.85)';
const HAULM = '#c9b46a';
const COTTON_RUST = '#a0703c';
/** Flowers on a ripe crop that shows them: the herbs' spikes and the potato's. */
const FLOWER: Record<string, string> = {
  sage: '#9a86c8', basil: '#f3efe2', thyme: '#d4a6cf', mint: '#b9a2d6', rosemary: '#a7bde6', potato: '#f1ecf4',
};
/** What a ripe crop shows drawn flat (`cropPlant`): a herb its flowers, anything else its produce. */
export const ripeShows = (id: string, look: string, fruit: string): string => (look === 'herb' && FLOWER[id]) || fruit;
/** Corn's tassel, and the husk round a cob. */
const TASSEL = '#cdb07e';
/**
 * A stage the Tend action takes (`tend_crop`: not ripe, not tended at this
 * stage) drawn one of two ways. Still to tend: dry pale soil, weeds in the
 * furrows. Tended: dark damp soil, water along the furrows, each plant's foot
 * hoed round.
 */
export const DRY_SOIL = 'rgba(244,226,186,0.27)';
const DRY_CREST = 'rgba(255,246,222,0.4)';
export const DAMP_SOIL = 'rgba(66,42,50,0.32)';
const DAMP_CREST = 'rgba(255,236,214,0.26)';
export const WATER_LINE = 'rgba(190,224,242,0.62)';
const HOED = 'rgba(62,40,56,0.34)';
/** Weeds: a yellow-green no crop is, a lit blade and a darker one. */
export const WEED = '#c4d43c';
const WEED_DARK = '#8aa82a';
/** How many weeds a tile still to tend has, and how tall one stands, in height units. */
const WEEDS = 18;
const WEED_TALL = 2.6;

/** Plants a row on a tile, by crop: a stage before ripe has the same. */
const PER_ROW: Record<string, number> = {
  wheat: 7, corn: 3, onion: 6, carrot: 6, cabbage: 3, potato: 3, sage: 3, basil: 4, thyme: 6, mint: 5, rosemary: 5, cotton: 3, wemp: 4,
};

type P2 = [number, number];
/** `shine`: ripe produce, with a sheen on its lit side; `splash`: small and vivid on it (a root's shoulder, a flower), its colour kept. */
type Op =
  | { k: 'stalk'; pts: V3[]; w: number; col: string; bare?: boolean }
  | { k: 'leaf'; pts: V3[]; n: V3; col: string; rib?: boolean; gloss?: boolean; w?: number }
  | { k: 'ball'; c: V3; r: number; col: string; shine?: boolean; splash?: boolean }
  | { k: 'spindle'; a: V3; b: V3; w: number; col: string; shine?: boolean; splash?: boolean };

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
  return { k: 'leaf', pts: [...left, ...right.reverse()], n: n[2] < 0 ? [-n[0], -n[1], -n[2]] : n, col, rib, w };
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
      const head = ripe ? mixH(fruit, GRAIN_WARM, 0.6) : mixH(leaf, GREEN_EAR, 0.4);
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
        ops.push({ k: 'spindle', a: out(c, a0 + 1.3, 0.6, 0.6), b: out(c, a0 + 1.3, 1.7, 5.0), w: 1.05, col: fruit, shine: true, splash: true });
        for (let i = 0; i < 4; i++) ops.push({ k: 'stalk', pts: [[0.3, 0.1, h], out([0.3, 0.1, h], a0 + i * 1.6, 1.3, 2.2), out([0.3, 0.1, h], a0 + i * 1.6, 2.2, 1.6)], w: 0.6, col: TASSEL });
      }
      break;
    }
    case 'onion': {
      if (ripe) ops.push({ k: 'ball', c: [0, 0, 1.55], r: 2.05, col: fruit, shine: true, splash: true });
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.26, h = (ripe ? 5.5 : 7) * (0.8 + R() * 0.3) * (ripe ? 1 : k + 0.2);
        const base: V3 = [0, 0, ripe ? 2.6 : 0];
        const tip = ripe && i % 2 ? out(base, a, 3.4, h * 0.35) : out(base, a, 0.9 + R(), h);
        ops.push({ k: 'stalk', pts: [base, out(base, a, ripe && i % 2 ? 1.6 : 0.4, h * 0.6), tip], w: 1.25, col: ripe ? mixH(leaf, fruit, 0.25 + 0.3 * (i % 2)) : leaf });
      }
      break;
    }
    case 'carrot': {
      // Feathery fronds, each a stalk with pairs of small leaflets up it, a deeper green ripe; and ripe, the orange shoulder at the soil.
      if (ripe) ops.push({ k: 'spindle', a: [0, 0, 0.15], b: [0, 0, 1.9], w: 1.45, col: fruit, shine: true, splash: true });
      const frond = ripe ? mixH(leaf, '#3f7a52', 0.2) : leaf, tipCol = mixH(frond, '#ffffff', 0.08);
      for (let i = 0; i < 6; i++) {
        const a = a0 + i * 1.05, h = (4.8 + R()) * k, r = (2.4 + R()) * k;
        const base: V3 = [0, 0, 1], tip = out([0, 0, 0], a, r, h);
        ops.push({ k: 'stalk', pts: [base, out(base, a, r * 0.4, h * 0.6), tip], w: 0.45, col: frond });
        for (let j = 1; j <= 3; j++) {
          const t = 0.35 + j * 0.2, c: V3 = [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t];
          for (const s of [-1, 1]) ops.push(leafOps(c, out(c, a + s * 1.2, (1.5 - j * 0.25) * k + 0.3, 0.5), 0.45 * k + 0.12, j === 3 ? tipCol : frond, 0.3, 0.5));
        }
        ops.push(leafOps(tip, out(tip, a, 1.1 * k + 0.3, 0.4), 0.5 * k + 0.12, tipCol, 0.2, 0.5));
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
      if (ripe) for (let i = 0; i < 2; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 2.6 + 0.6, 1.8, 1.05), r: 1.3, col: fruit, shine: true, splash: true });
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.25, r = (2.4 + R()) * k;
        const c = out([0, 0, 0], a, r, (3.2 + R() * 1.2) * k);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], c], w: 0.7, col: haulm });
        ops.push({ k: 'ball', c, r: 2.3 * k, col: i % 2 ? haulm : mixH(haulm, '#ffffff', 0.07) });
      }
      ops.push({ k: 'ball', c: [0, 0, 5.4 * k], r: 2.5 * k, col: haulm });
      if (ripe) for (let i = 0; i < 4; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 1.6, 1.8, 7.6 + R()), r: 0.6, col: FLOWER.potato, shine: true, splash: true });
      break;
    }
    case 'sage': {
      // A broad, low, silvery dome of soft oval leaves, a round crown under them.
      const silver = mixH(leaf, SAGE_SILVER, 0.12);
      ops.push({ k: 'ball', c: [0, 0, 1.8 * k], r: 2.2 * k, col: mixH(silver, '#000000', 0.12) });
      for (let i = 0; i < 13; i++) {
        // Three rings, low and wide to high and in, each turned off the one under it.
        const ring = i < 7 ? 0 : i < 11 ? 1 : 2, n = [7, 4, 2][ring], j = i - [0, 7, 11][ring];
        const a = a0 + ring * 0.5 + (j / n) * Math.PI * 2 + R() * 0.25, z = (0.9 + ring * 1.2) * k;
        const col = ring === 2 ? mixH(silver, fruit, ripe ? 0.5 : 0.15) : ring === 1 ? silver : mixH(silver, '#000000', 0.05);
        ops.push(leafOps([0, 0, z], out([0, 0, z], a, (3.3 - ring * 0.7 + R() * 0.4) * k, (0.6 + ring * 0.5) * k), 1.7 * k, col, 0.4, 0.6));
      }
      if (ripe) for (let i = 0; i < 3; i++) {
        const b = out([0, 0, 3.4], a0 + i * 2.1, 1.2, 4.0);
        ops.push({ k: 'stalk', pts: [[0, 0, 3.2], b], w: 0.5, col: silver });
        ops.push({ k: 'spindle', a: out(b, a0 + i * 2.1, 0.1, -0.6), b: out(b, a0 + i * 2.1, 0.4, 2.4), w: 0.55, col: FLOWER.sage, shine: true, splash: true });
      }
      break;
    }
    case 'basil': {
      // A bushy, bright, glossy plant of big cupped leaves.
      const bright = mixH(leaf, BASIL_BRIGHT, 0.3);
      const h = 5.4 * k;
      ops.push({ k: 'stalk', pts: [[0, 0, 0], [0, 0, h]], w: 0.8, col: bright });
      for (let j = 0; j < 3; j++) {
        const z = h * (0.25 + j * 0.3), a = a0 + j * 1.57, r = (4.0 - j * 0.8) * k;
        for (const s of [0, Math.PI]) ops.push({ ...leafOps([0, 0, z], out([0, 0, z], a + s, r, 0.7), 2.0 * k, j === 2 ? mixH(bright, fruit, ripe ? 0.6 : 0.2) : bright, 0.9, 0.55, true), gloss: true } as Op);
      }
      if (ripe) for (const s of [-1, 1]) ops.push({ k: 'spindle', a: out([0, 0, h - 0.5], a0 + s, 0.3, 0), b: out([0, 0, h - 0.5], a0 + s, 0.9, 2.4), w: 0.55, col: FLOWER.basil, shine: true, splash: true });
      break;
    }
    case 'thyme': {
      // A low, pale, spreading mat.
      const pale = mixH(leaf, THYME_PALE, 0.16);
      for (let i = 0; i < 7; i++) {
        const c = i === 6 ? [0, 0, 1.15 * k] as V3 : out([0, 0, 0], a0 + i * 1.05, 1.9 * k, 0.95 * k);
        ops.push({ k: 'ball', c, r: 1.35 * k, col: i % 2 ? pale : mixH(pale, fruit, ripe ? 0.45 : 0.15) });
      }
      if (ripe) for (let i = 0; i < 6; i++) ops.push({ k: 'ball', c: out([0, 0, 0], a0 + i * 1.05 + 0.5, i === 5 ? 0.3 : 1.8, 1.9), r: 0.5, col: FLOWER.thyme, shine: true, splash: true });
      break;
    }
    case 'mint': {
      // Bright mid-green upright stems, leaves in pairs up each.
      const bright = mixH(leaf, MINT_BRIGHT, 0.2);
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * 1.26 + R() * 0.4, h = (6.2 + R() * 1.2) * k;
        const top = out([0, 0, 0], a, 0.7, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], top], w: 0.6, col: bright });
        for (let j = 0; j < 3; j++) {
          const z = h * (0.35 + j * 0.25);
          const c = out([0, 0, 0], a, 0.7 * (z / h), z);
          for (const s of [-1, 1]) ops.push(leafOps(c, out(c, a + s * 1.57 + j, (1.8 - j * 0.3) * k, 0.3), 0.85 * k, j === 2 ? mixH(bright, fruit, ripe ? 0.5 : 0.15) : bright, 0.4, 0.5));
        }
        if (ripe) ops.push({ k: 'spindle', a: top, b: out(top, a, 0.2, 1.9), w: 0.48, col: FLOWER.mint, shine: true, splash: true });
      }
      break;
    }
    case 'rosemary': {
      // Dark, upright needle spikes on woody stems.
      const needle = mixH(leaf, NEEDLE_DARK, 0.18);
      for (let i = 0; i < 6; i++) {
        const a = a0 + i * 1.05, h = (7.6 + R() * 1.6) * k, top = out([0, 0, 0], a, (0.9 + R() * 0.5) * k, h);
        ops.push({ k: 'stalk', pts: [[0, 0, 0], out([0, 0, 0], a, 0.3 * k, h * 0.55), top], w: 0.55, col: mixH(leaf, WOODY_STEM, 0.5) });
        for (let j = 1; j <= 6; j++) {
          const t = j / 6.4, c: V3 = [top[0] * t, top[1] * t, top[2] * t];
          for (const s of [-1, 1]) ops.push(leafOps(c, out(c, a + s * 1.3, 0.95 * k, 0.75 * k), 0.3, j >= 5 && ripe ? mixH(needle, fruit, 0.45) : needle, 0, 0.4));
        }
        if (ripe) for (const t of [0.7, 0.86]) ops.push({ k: 'ball', c: out([top[0] * t, top[1] * t, top[2] * t], a + 1.6, 0.6, 0), r: 0.5, col: FLOWER.rosemary, shine: true, splash: true });
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
  return { feet, kinds: kindsOf(id, stage, leaf, fruit) };
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
/** Hue (0 to 1), saturation and lightness of a colour. */
function hslOf(c: RGB): [number, number, number] {
  const [r, g, b] = c.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function rgbOf(h: number, s: number, l: number): RGB {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number): number => {
    const u = t - Math.floor(t);
    return 255 * (u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p);
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
/** `h` turned toward `to` (both 0 to 1, round the wheel the short way) by at most `by`. */
const hueToward = (h: number, to: number, by: number): number => {
  const d = ((to - h + 1.5) % 1) - 0.5;
  return h + Math.sign(d) * Math.min(Math.abs(d), by);
};
/** Where a shade turns a hue (a cool blue), and a light (a lemon), and how far each goes. */
const SHADE_TURN = 0.6, SHADE_BY = 0.045;
const LIGHT_TURN = 0.15, LIGHT_BY = 0.035;

/**
 * A crop's colour in the kit's pastel: its lightness lifted toward chalk and
 * its saturation held, so nothing in a field is darker than slate; what is
 * ripe keeps more of its colour (`ripe`), as a splash.
 */
const softKept = new Map<string, [number, number, number]>();
function softHsl(col: string, ripe = false): [number, number, number] {
  const key = ripe ? `${col}!` : col;
  const had = softKept.get(key);
  if (had) return had;
  const [h, s, l] = hslOf(hex(col));
  // A grey-green (rosemary, sage) kept a colour: chalk's saturation at least.
  const S = Math.max(Math.min(ripe ? 0.82 : 0.6, s * (ripe ? 1.1 : 1)), s > 0.03 ? 0.17 : s);
  const out: [number, number, number] = [h, S, Math.min(0.86, 0.25 + l * 0.65)];
  softKept.set(key, out);
  return out;
}

/**
 * A colour as lit `l` (0 in its own shade, 1 square to the sun), in the kit's
 * pastel: lighter and turned toward a lemon tint lit, darker and turned toward
 * a cool blue in shade, its saturation kept, so a shadow is a colour and not
 * a grey. In 24 steps, kept: a facet is one flat value.
 */
const litKept = new Map<string, string>();
const LIT_STEPS = 24;
function litCol(col: string, l: number, ripe = false): string {
  const k = Math.round(clamp01(l) * LIT_STEPS);
  const key = `${col}|${ripe ? 1 : 0}|${k}`;
  const had = litKept.get(key);
  if (had) return had;
  const [h, s, L] = softHsl(col, ripe);
  const t = k / LIT_STEPS - 0.5;
  // A grey with no hue of its own takes the shade's outright.
  const hue = t < 0 ? (s < 0.08 ? SHADE_TURN : hueToward(h, SHADE_TURN, SHADE_BY * -t * 2)) : hueToward(h, LIGHT_TURN, LIGHT_BY * t * 2);
  // A shade keeps a colour however grey the leaf (sage's silver): never less saturated than a fifth.
  // Short of a splash (`docs/aesthetic.md`) unless it is one.
  const out = rgb(rgbOf(hue, Math.min(ripe ? 0.9 : 0.61, t < 0 ? Math.max(0.2, s * (1 - t * 0.1)) : s * (1 - t * 0.3)), Math.max(0.3, Math.min(0.88, L + t * 0.32))));
  litKept.set(key, out);
  return out;
}
const edgeKept = new Map<string, string>();
/** The soft edge a mass is ruled in: a deep of its own colour, not ink; kept. */
const edgeOf = (col: string): string => {
  const had = edgeKept.get(col);
  if (had) return had;
  const [h, s, l] = softHsl(col);
  const out = rgb(rgbOf(s < 0.08 ? SHADE_TURN : hueToward(h, SHADE_TURN, SHADE_BY * 1.4), Math.min(0.7, Math.max(0.24, s * 1.1)), Math.max(0.24, l - 0.26)), EDGE_ALPHA);
  edgeKept.set(col, out);
  return out;
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
 * `tended` whether the stage it is at has been tended (`Crop.tendedNow`), which
 * shows at every stage before ripe, in a winter as well, as Tend goes then too.
 * Seen from `turn`, under the sun's `step` (`sunStepOf`), `scale` pixels to a
 * pixel at zoom one, anchored at the tile's middle.
 *
 * Made now, or, once this frame has spent `CROP_BAKE_MS`, the same crop's
 * last bake in another layout, step of the sun or scale stands in -- tended or
 * not as asked, else the other's; with none and `CROP_COLD_MS` spent, the sown
 * ground does until its turn comes.
 */
export function fieldBake(id: string, stage: number, leaf: string, fruit: string, dormant: boolean, tended: boolean, turn: number, step: number, scale: number, layout = 0, bed = false): CropBake {
  // Bare and sown ground is the same whatever the crop and however it is laid out: one bake for all of them.
  if (stage <= 0) { id = ''; layout = 0; }
  // Tended or not only shows at a stage the Tend action takes: fallow ground and a ripe crop are one picture either way.
  const care = stage >= 0 && stage < RIPE ? (tended ? 2 : 1) : 0;
  // A garden bed's in the same five parts as a field's, its turn marked: a stand-in is only ever the same kind of ground.
  const at = `${turn}${bed ? 'b' : ''}`;
  const head = `${id}|${stage}|${dormant ? 1 : 0}|${care}|${at}`;
  const key = `${head}|${layout}|${step}|${scale}`;
  const had = cropBakes.get(key);
  if (had) {
    had.used = cropFrameNo;
    return had.spr;
  }
  if (stage > 0 && cropSpent >= CROP_BAKE_MS) {
    // Tended or not, the other's picture of the same crop and stage before bare ground: the tile is only a frame or two from its own.
    const near = cropLatest.get(head) ?? (care ? cropLatest.get(`${id}|${stage}|${dormant ? 1 : 0}|${3 - care}|${at}`) : undefined);
    if (near || cropSpent >= CROP_COLD_MS) {
      cropStats.standIns++;
      return near ?? fieldBake('', 0, '', '', dormant, tended, turn, step, scale, 0, bed);
    }
  }
  const t0 = performance.now();
  const spr = bakeField(id, stage, leaf, fruit, dormant, care, turn, step, scale, layout, bed);
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
      const h = k.split('|').slice(0, 5).join('|');
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

/** `care`: 0 at a stage nobody tends (fallow, ripe), 1 still to tend, 2 tended (`fieldBake`). */
function bakeField(id: string, stage: number, leaf0: string, fruit0: string, dormant: boolean, care: number, turn: number, step: number, scale: number, layout: number, bed: boolean): CropBake {
  const leaf = dormant ? mixH(leaf0, DORMANT_LEAF, 0.6) : leaf0;
  const fruit = dormant ? mixH(fruit0, DORMANT_FRUIT, 0.45) : fruit0;
  const e = eyeOf(0, turn);
  const light = lightOf(step);
  // The ground and where each plant stands; on a garden bed, drawn in to inside its frame (`BED_IN`). A plant itself is drawn its own size either way (`Pp`).
  const P = (p: V3): P2 => proj(e, bed ? [p[0] * BED_IN, p[1] * BED_IN, p[2]] : p);
  const Pp = (p: V3): P2 => proj(e, p);
  const { feet, kinds } = stage >= 1 ? plantsOf(id, stage, leaf, fruit, layout) : { feet: [], kinds: [] };
  // Back to front.
  const near = (p: V3): number => p[0] * e.toward[0] + p[1] * e.toward[1];
  feet.sort((a, b) => near(a.at) - near(b.at));
  const weeds = care === 1 ? weedsOf(layout, stage, R0(id)) : [];
  // The sun across the screen, for which side of a round thing is lit.
  const look = lookOf(light, e, dormant);
  // Each way the plant grows, painted once, its foot at the origin: the same for every layout of the tile.
  const sk = `${id}|${stage}|${dormant ? 1 : 0}|${turn}|${step}|${scale}`;
  let stamps = cropStamps.get(sk);
  if (!stamps) {
    stamps = kinds.map((ops) => stampOf(ops, Pp, look, scale));
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
  for (const w of weeds) grow(...P(w), WEED_TALL * HEIGHT_SCALE + 2);
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
    g.fillStyle = d >= 0 ? rgb(SLOPE_LIT, Math.min(0.5, d * 1.6)) : rgb(SLOPE_DARK, Math.min(0.42, -d * 1.4));
    g.fill(faces);
  }
  if (care) {
    // A stage to tend: the soil pale and dry still to tend, dark and damp tended -- under a winter's snow, which lies white on either.
    g.fillStyle = care === 1 ? DRY_SOIL : DAMP_SOIL;
    g.fill(tile);
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
  if (care === 1) {
    // Still to tend: its ridges dusty.
    g.strokeStyle = DRY_CREST;
    g.lineWidth = 1.3;
    g.stroke(crests);
  } else if (care === 2) {
    // Tended: its ridges crisp, each plant's foot hoed round, and water along the furrows -- frozen out of sight in a winter.
    g.strokeStyle = DAMP_CREST;
    g.lineWidth = 0.8;
    g.stroke(crests);
    if (feet.length) {
      const hoed = new Path2D();
      for (const f of feet) {
        const [fx, fy] = P(f.at);
        const rx = 1.7 * ACROSS;
        hoed.moveTo(fx + rx, fy);
        hoed.ellipse(fx, fy, rx, rx / 2, 0, 0, Math.PI * 2);
      }
      g.fillStyle = HOED;
      g.fill(hoed);
    }
    if (!dormant) {
      const water = new Path2D();
      for (let j = 1; j < ROWS; j++) lineAlong(-HALF + j * ROW, 0, water);
      g.strokeStyle = WATER_LINE;
      g.lineWidth = 0.75;
      g.stroke(water);
    }
  }
  if (stage === 0) {
    // Sown: a drill pressed along each crest, its far lip lit, the seed in it: over the soil tended or not, so a sown field never reads as a fallow one.
    g.strokeStyle = DRILL;
    g.lineWidth = 1.9;
    g.stroke(crests);
    const lip = new Path2D();
    for (let j = 0; j < ROWS; j++) lineAlong(-HALF + (j + 0.5) * ROW - 0.45, ridge + 0.1, lip);
    g.strokeStyle = DRILL_LIP;
    g.lineWidth = 0.5;
    g.stroke(lip);
    const seeds = new Path2D();
    const RS = mulberry32(layout * 53 + 991);
    // The turned earth in it, broken: crumbs a shade either side of the drill's.
    const crumbs = [new Path2D(), new Path2D()];
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < 26; i++) {
        const [cx, cy] = P([-HALF + (i + RS()) * (UNITS_PER_TILE / 26), -HALF + (j + 0.5) * ROW + (RS() - 0.5) * 0.7, ridge]);
        const c = crumbs[i % 2], r = 0.3 + RS() * 0.25;
        c.moveTo(cx + r, cy);
        c.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
      }
    }
    g.fillStyle = CRUMB[0];
    g.fill(crumbs[0]);
    g.fillStyle = CRUMB[1];
    g.fill(crumbs[1]);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < 9; i++) {
        const [sx, sy] = P([-HALF + RIM + 1.5 + (i + RS() * 0.6) * ((UNITS_PER_TILE - 2 * RIM - 3) / 9), -HALF + (j + 0.5) * ROW + (RS() - 0.5) * 0.4, ridge * 0.9]);
        seeds.moveTo(sx + 0.55, sy);
        seeds.ellipse(sx, sy, 0.55, 0.36, 0, 0, Math.PI * 2);
      }
    }
    g.fillStyle = dormant ? mixH(SEED, RIME_TOP, 0.4) : SEED;
    g.fill(seeds);
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

  /* ---- the plants, back to front: each stamped where it stands, on whole pixels; and a tile still to tend, its weeds among them ---- */
  const order = [...feet.map((f) => ({ near: near(f.at), f, w: null as V3 | null })), ...weeds.map((w) => ({ near: near(w), f: null, w }))];
  order.sort((a, b) => a.near - b.near);
  const weedLit = Math.min(0.85, 0.4 + look.stalkLit);
  const weedCols = [WEED, WEED_DARK].map((c) => litCol(dormant ? mixH(c, DORMANT_LEAF, 0.55) : c, weedLit));
  for (const { f, w } of order) {
    if (f) {
      const [fx, fy] = P(f.at), st = stamps[f.v];
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(st.cv, Math.round((fx + st.x0 - x0) * scale), Math.round((fy + st.y0 - y0) * scale));
    } else if (w) {
      g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
      weedAt(g, P, w, weedCols);
    }
  }
  return { canvas, w: x1 - x0, h: y1 - y0, ax: -x0, ay: -y0 };
}

const R0 = (id: string): number => fieldHash(id || 'sown');

/**
 * Where a tile still to tend has its weeds: in the furrows between its rows and
 * along its edges, a few on the ridges between plants, by the layout and the
 * crop's own roll; the same at every stage, so a weed stands where it stood.
 */
function weedsOf(layout: number, stage: number, seed: number): V3[] {
  const R = mulberry32(seed + 4409 + layout * 271);
  const E = HALF - RIM - 1.2;
  const at: V3[] = [];
  for (let i = 0; i < WEEDS; i++) {
    const ridge = i % 5 === 4;
    const j = Math.floor(R() * (ROWS + 1));
    const y = ridge ? -HALF + (Math.min(ROWS - 1, j) + 0.5) * ROW : Math.max(-E, Math.min(E, -HALF + j * ROW));
    at.push([-E + R() * 2 * E, y + (R() - 0.5) * 0.8, ridge ? RIDGE * 0.8 : 0.1]);
  }
  // Sown ground has nothing on its ridges but the drill.
  return stage === 0 ? at.filter((p) => p[2] < 0.5) : at;
}

/** A weed: a tuft of blades splayed from `w`, `k` times a field's, softly edged as a stalk is, in `cols` (lit and darker). */
function weedAt(g: CanvasRenderingContext2D, P: (p: V3) => P2, w: V3, cols: string[], k = 1): void {
  const blades: P2[][] = [];
  const turn0 = (w[0] * 7.3 + w[1] * 3.1) % TAU;
  for (let i = 0; i < 5; i++) {
    const a = turn0 + i * 1.26, tall = WEED_TALL * k * (0.65 + ((i * 37) % 7) / 14);
    blades.push([P(w), P(out(w, a, 0.5 * k, tall * 0.6)), P(out(w, a, 1.3 * k, tall))]);
  }
  const path = (bs: P2[][]): void => {
    g.beginPath();
    for (const b of bs) {
      g.moveTo(b[0][0], b[0][1]);
      g.quadraticCurveTo(b[1][0], b[1][1], b[2][0], b[2][1]);
    }
    g.stroke();
  };
  // Its soft edge, then its lit blades and its darker ones, a stroke each.
  const w0 = Math.max(0.35, 0.6 * k);
  g.strokeStyle = edgeOf(WEED_DARK);
  g.lineWidth = w0 + KIT_INK_W * 1.6;
  path(blades);
  g.lineWidth = w0;
  for (const odd of [0, 1]) {
    g.strokeStyle = cols[odd];
    path(blades.filter((_, i) => i % 2 === odd));
  }
}

/** How a bake's plants are lit: the light, the sun's way across the screen, a stalk's light, and whether it is a winter. */
interface PlantLook { light: Light; sun: P2; stalkLit: number; dormant: boolean }

/** Each crop's plants painted, by crop, stage, winter, turn, step and scale, the latest `STAMPS_KEPT` of them: what the layouts of a tile share. */
const cropStamps = new Map<string, Stamp[]>();
const STAMPS_KEPT = 48;
interface Stamp { cv: HTMLCanvasElement; x0: number; y0: number }

/** How a bake's plants are lit, from a light and an eye. */
function lookOf(light: Light, e: Eye, dormant: boolean): PlantLook {
  // The sun across the screen, for which side of a round thing is lit.
  const sv = [light.sun[0] * e.ux + light.sun[1] * e.vx, light.sun[0] * e.uy + light.sun[1] * e.vy - light.sun[2] * HEIGHT_SCALE];
  const sl = Math.hypot(sv[0], sv[1]) || 1;
  return { light, sun: [sv[0] / sl, sv[1] / sl], stalkLit: litOf(light, unitV([light.sun[0], light.sun[1], 0.4])) * 0.75, dormant };
}

/* ---- a planter's row ------------------------------------------------------------------- */

/** How big a weed in a planter is, against one in a field: whatever size the crop is drawn at there. */
const PLANTER_WEED = 0.75;
/** The sun a planter's plants are lit by: a kit piece is baked once, so the late morning's. */
const PLANTER_SUN = Math.round(SUN_STEPS * 0.4);

/** A crop's plants at a stage, each way it grows (`VARIANTS`), its own roll the field's. */
const kindsOf = (id: string, stage: number, leaf: string, fruit: string): Op[][] =>
  Array.from({ length: VARIANTS }, (_, v) => plantOf(id, stage, leaf, fruit, mulberry32(fieldHash(id) + v * 7919 + 131)));

/** A plant drawn `k` times its size: its round parts and stalks as well as its points. */
const sized = (ops: Op[], k: number): Op[] => ops.map((op) => {
  if (op.k === 'ball') return { ...op, c: [op.c[0] * k, op.c[1] * k, op.c[2] * k] as V3, r: op.r * k };
  if (op.k === 'spindle') return { ...op, a: [op.a[0] * k, op.a[1] * k, op.a[2] * k] as V3, b: [op.b[0] * k, op.b[1] * k, op.b[2] * k] as V3, w: op.w * k };
  const pts = op.pts.map((p) => [p[0] * k, p[1] * k, p[2] * k] as V3);
  return op.k === 'stalk' ? { ...op, pts, w: Math.max(0.35, op.w * k) } : { ...op, pts, w: op.w === undefined ? undefined : op.w * k };
});

/**
 * Where a crop stands and what it is made of, for a harness (the clipping scan): a field tile's feet in its `layout`, and each way the plant grows at `stage`, `k` times its size, its parts in model units off its foot.
 */
export function cropPlan(id: string, stage: number, layout: number, k = 1): { feet: V3[]; feetZ: number; bedIn: number; parts: Array<Array<{ pts: V3[]; r: number }>> } {
  const { feet, kinds } = plantsOf(id, stage, '#000000', '#000000', layout);
  const parts = kinds.map((ops) => sized(ops, k).map((op) => (op.k === 'ball' ? { pts: [op.c], r: op.r } : op.k === 'spindle' ? { pts: [op.a, op.b], r: op.w } : { pts: op.pts, r: op.k === 'stalk' ? op.w / 2 : 0 })));
  return { feet: feet.map((f) => f.at), feetZ: RIDGE * 0.8, bedIn: BED_IN, parts };
}

/** How tall a planter's plants of a crop at a stage stand, `k` times their size, in model units. */
export function planterTall(id: string, stage: number, k: number): number {
  let top = 0;
  for (const op of plantOf(id, stage, '#000000', '#000000', mulberry32(fieldHash(id) + 131))) {
    const zs = op.k === 'ball' ? [op.c[2] + op.r] : op.k === 'spindle' ? [op.a[2], op.b[2]] : op.pts.map((p) => p[2]);
    top = Math.max(top, ...zs);
  }
  return top * k + 1;
}

/**
 * A planter's row of a crop at a stage, `k` times a field's size, seen by a
 * kit piece's eye: the field's own plants (`plantOf`), lit and painted as
 * they are, back to front, each foot at one of `at`; and `weeds`, a planter
 * still to tend's, among them (`weedAt`), at a sown one's as well.
 */
export function planterRow(g: CanvasRenderingContext2D, e: Eye, at: V3[], id: string, stage: number, leaf: string, fruit: string, k: number, weeds: V3[] = []): void {
  if (stage < 1 && !weeds.length) return;
  const kinds = stage >= 1 ? kindsOf(id, stage, leaf, fruit).map((ops) => sized(ops, k)) : [];
  const look = lookOf(lightOf(PLANTER_SUN), e, false);
  const plants = stage >= 1 ? at.map((p, i) => ({ p, i, weed: false })) : [];
  const order = [...plants, ...weeds.map((p, i) => ({ p, i, weed: true }))].map((o) => ({ ...o, d: o.p[0] * e.toward[0] + o.p[1] * e.toward[1] })).sort((a, b) => a.d - b.d);
  const P = (q: V3): P2 => proj(e, q);
  const weedCols = [WEED, WEED_DARK].map((c) => litCol(c, Math.min(0.85, 0.4 + look.stalkLit)));
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const { p, i, weed } of order) {
    if (weed) weedAt(g, P, p, weedCols, PLANTER_WEED);
    else paintPlant(g, kinds[i % VARIANTS], (q) => proj(e, [p[0] + q[0], p[1] + q[1], p[2] + q[2]]), look);
  }
  g.restore();
}

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

/**
 * Broken colour over a mass already filled (`docs/aesthetic.md`: a mottle of
 * two or three close values, scaled to the facet): dabs a step lighter and a
 * step darker than its light `l`, along the middle of a mass from `a` to `b`
 * (one point for a round one) and well inside its half-width `hw`, so they
 * need no clip: as many as it is big enough to carry, none on what is too
 * small, a fill for each step.
 */
function mottle(g: CanvasRenderingContext2D, col: string, l: number, ripe: boolean, a: P2, b: P2, hw: number, R: () => number): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.min(4, Math.floor((len + hw) * hw * 0.5));
  if (n <= 0 || hw < 0.6) return;
  const ux = len ? (b[0] - a[0]) / len : 1, uy = len ? (b[1] - a[1]) / len : 0;
  const r = hw * 0.36;
  for (const [step, k0] of [[0.2, 0], [-0.18, 1]] as const) {
    g.beginPath();
    for (let i = k0; i < n; i += 2) {
      const t = 0.3 + R() * 0.4, s = (R() * 2 - 1) * hw * 0.3;
      const x = a[0] + (b[0] - a[0]) * t - uy * s, y = a[1] + (b[1] - a[1]) * t + ux * s;
      g.moveTo(x + r * ux, y + r * uy);
      g.ellipse(x, y, r, r * 0.62, Math.atan2(uy, ux), 0, Math.PI * 2);
    }
    g.fillStyle = litCol(col, l + step, ripe);
    g.fill();
  }
}

/**
 * A plant painted, as the world is: each mass and stalk softly edged in a deep
 * of its own colour (laid under every face, so only the silhouette and the
 * gaps keep it), then its faces, each lit as it faces the sun -- toward a
 * warm tint lit and a cool hue in shade -- with a mottle over the broad ones,
 * and on what is ripe its colour kept as a splash and a sheen on its lit side.
 */
function paintPlant(g: CanvasRenderingContext2D, ops: Op[], P: (p: V3) => P2, { light, sun, stalkLit, dormant }: PlantLook): void {
  const shapes: Array<{ op: Op; path: Path2D; pts?: P2[] }> = [];
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
      shapes.push({ op, path: p, pts });
    } else if (op.k === 'ball') {
      const [cx, cy] = P(op.c);
      const p = new Path2D();
      p.arc(cx, cy, op.r * ACROSS, 0, Math.PI * 2);
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
      shapes.push({ op, path: p, pts: [a, b, [nx, ny]] });
    }
  }
  // The edges, every one before any face: gathered by colour and width, a stroke for each.
  const edges = new Map<string, { col: string; w: number; path: Path2D }>();
  for (const { op, path } of shapes) {
    if (op.k === 'stalk' && op.bare) continue;
    // Never wider than a fifth of what it rules round, or a narrow leaf or a small ball is all edge.
    const size = op.k === 'leaf' ? (op.w ?? 1) * ACROSS : op.k === 'ball' ? op.r * ACROSS : op.k === 'spindle' ? op.w * ACROSS : 0;
    const w = Math.round((op.k === 'stalk' ? op.w + EDGE_W : Math.min(EDGE_W * 1.3, size * 0.4)) * 20) / 20;
    const col = edgeOf(op.col), key = `${col}|${w}`;
    const had = edges.get(key) ?? { col, w, path: new Path2D() };
    had.path.addPath(path);
    edges.set(key, had);
  }
  for (const { col, w, path } of edges.values()) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke(path);
  }
  const first = shapes.find((s) => s.pts)?.pts?.[0] ?? [0, 0];
  const R = mulberry32(ops.length * 7919 + Math.round(first[0] * 37 + first[1] * 101));
  const rimed = (col: string, k: number): string => (dormant ? mixH(col, RIME_TOP, k) : col);
  for (const { op, path, pts } of shapes) {
    if (op.k === 'stalk') {
      g.strokeStyle = litCol(rimed(op.col, FROST_SIDE), Math.min(0.62, 0.14 + stalkLit * 0.55));
      g.lineWidth = op.w;
      g.stroke(path);
    } else if (op.k === 'leaf' && pts) {
      // Two-sided: lit by whichever face the sun is on, the underside a little less.
      const l = Math.max(litOf(light, op.n), litOf(light, [-op.n[0], -op.n[1], -op.n[2]]) * 0.7);
      const col = rimed(op.col, op.n[2] > 0.3 ? FROST_UP : FROST_SIDE);
      g.fillStyle = litCol(col, l);
      g.fill(path);
      const n = pts.length / 2;
      const a = pts[0], b = pts[n - 1], m = pts[Math.floor(n / 2)], o = pts[pts.length - 1 - Math.floor(n / 2)];
      mottle(g, col, l, false, a, b, Math.hypot(m[0] - o[0], m[1] - o[1]) / 2, R);
      if (op.gloss && !dormant) {
        // Glossy: a light along it, on its half toward the sun.
        const sx = (m[0] - o[0]) * 0.25, sy = (m[1] - o[1]) * 0.25;
        const side = sx * sun[0] + sy * sun[1] >= 0 ? 1 : -1;
        g.strokeStyle = GLOSS;
        g.lineWidth = 0.45;
        g.beginPath();
        g.moveTo(a[0] + (b[0] - a[0]) * 0.25 + sx * side, a[1] + (b[1] - a[1]) * 0.25 + sy * side);
        g.lineTo(a[0] + (b[0] - a[0]) * 0.7 + sx * side, a[1] + (b[1] - a[1]) * 0.7 + sy * side);
        g.stroke();
      }
      if (op.rib) {
        g.strokeStyle = litCol(col, Math.max(0, l - 0.3));
        g.lineWidth = 0.4;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(a[0] + (b[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.8);
        g.stroke();
      }
    } else if (op.k === 'ball' && pts) {
      // Round: its shade, a lit face toward the sun, and a light on that.
      const ripe = !!op.splash;
      const [cx, cy] = pts[0];
      const r = op.r * ACROSS;
      const col = rimed(op.col, FROST_SIDE);
      const lit = litOf(light, unitV([light.sun[0] * 0.5, light.sun[1] * 0.5, 1]));
      g.fillStyle = litCol(col, litOf(light, unitV([-light.sun[0], -light.sun[1], 0.6])) * 0.6 + 0.12, ripe);
      g.fill(path);
      g.fillStyle = litCol(col, lit, ripe);
      g.beginPath();
      g.arc(cx + sun[0] * r * 0.2, cy + sun[1] * r * 0.2 - r * 0.04, r * 0.76, 0, Math.PI * 2);
      g.fill();
      mottle(g, col, lit, ripe, [cx - r * 0.3, cy], [cx + r * 0.3, cy], r * 0.8, R);
      g.fillStyle = dormant ? RIME_TOP : litCol(col, Math.min(1, litOf(light, light.sun) + 0.2), ripe);
      g.beginPath();
      if (dormant) g.ellipse(cx, cy - r * 0.55, r * 0.62, r * 0.32, 0, 0, Math.PI * 2);
      else g.arc(cx + sun[0] * r * 0.42, cy + sun[1] * r * 0.42, r * 0.3, 0, Math.PI * 2);
      g.fill();
      if (ripe && !dormant) {
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
      const ripe = !!op.splash;
      const [a, b, [nx, ny]] = pts;
      const w = op.w * ACROSS;
      const col = rimed(op.col, FROST_SIDE);
      g.fillStyle = litCol(col, litOf(light, unitV([-light.sun[0], -light.sun[1], 0.6])) * 0.6 + 0.15, ripe);
      g.fill(path);
      const sgn = nx * sun[0] + ny * sun[1] >= 0 ? 1 : -1;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const lit = litOf(light, unitV([light.sun[0], light.sun[1], 0.8]));
      g.fillStyle = dormant ? mixH(op.col, RIME_TOP, FROST_UP) : litCol(col, lit, ripe);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo(mx + nx * w * 2 * sgn, my + ny * w * 2 * sgn, b[0], b[1]);
      g.quadraticCurveTo(mx + nx * w * 0.3 * sgn, my + ny * w * 0.3 * sgn, a[0], a[1]);
      g.fill();
      mottle(g, col, lit, ripe, a, b, w * 1.2, R);
      if (ripe && !dormant) {
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
