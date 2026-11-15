import { rand } from '../ivy';
import { speckle } from './hearthstone';
import {
  css, deeper, hex, mix, paler, prism, TAU, toneOf,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { OUTCROP_STAGES } from '../../game/outcrops';

/**
 * The outcroppings (`outcrops.ts`), one tile each, in the kit: a boulder of
 * plain grey stone, and one of rust-brown stone veined and chipped with iron
 * ore, each a heap of angular masses with a few stones loose at its foot.
 *
 * Its trim is how far it is mined down (`outcropStage`, nought whole to
 * `OUTCROP_STAGES` at its last use) and which of `OUTCROP_VARIANTS` shapes it
 * is, off its tile (`outcropTrim`). Each stage stands lower and narrower, its
 * crown cut flat and paler where the pick took it, more cracks down its sides,
 * one shoulder gone at the third stage, and more broken stone heaped round its
 * foot; an iron one shows fewer veins of ore as it is mined out.
 */

/** The shapes an outcropping comes in, by its tile. */
export const OUTCROP_VARIANTS = 4;
/** An outcropping's trim: its stage and its shape. */
export const outcropTrim = (stage: number, variant: number): number =>
  Math.max(0, Math.min(OUTCROP_STAGES, Math.round(stage))) + (OUTCROP_STAGES + 1) * (((Math.floor(variant) % OUTCROP_VARIANTS) + OUTCROP_VARIANTS) % OUTCROP_VARIANTS);
const stageOf = (trim: number | undefined): number => Math.max(0, Math.floor(trim ?? 0)) % (OUTCROP_STAGES + 1);
const variantOf = (trim: number | undefined): number => Math.floor(Math.max(0, Math.floor(trim ?? 0)) / (OUTCROP_STAGES + 1)) % OUTCROP_VARIANTS;

/* ---- the palette ------------------------------------------------------------------ */

/** Plain stone: a grey with a breath of lilac (the island's crag), its shade a slate mauve. */
const GREY: Tone = toneOf('#d4ccd6', '#52407e');
/** Ironstone: a warm rust-brown grey. */
const IRONSTONE: Tone = toneOf('#cda690', '#5e3c50');
/** The ore itself: rust red, the splash. */
const ORE: RGB = hex('#c4522e');
/** A fresh bright edge of ore where it has just been struck. */
const ORE_LIT: RGB = hex('#ec8a4a');
/** Rust run down a face below a vein. */
const RUST: RGB = hex('#b0603e');
/** Cracks: a deep plum, never black. */
const CRACK: RGB = hex('#4a3a5a');

/* ---- painting ---------------------------------------------------------------------- */

/** Cracks down a face: `n` jagged lines from near its top. */
function cracks(g: Ctx, fill: RGB, s: Side, n: number, seed: number): void {
  const T = rand(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = css(mix(fill, CRACK, 0.55), 0.7);
  g.lineWidth = 0.16;
  for (let i = 0; i < n; i++) {
    let x = s.w * (0.2 + T() * 0.6), y = s.h * (0.75 + T() * 0.25);
    g.beginPath();
    g.moveTo(x, y);
    const steps = 3 + Math.floor(T() * 2);
    for (let j = 0; j < steps; j++) {
      x = Math.max(s.w * 0.08, Math.min(s.w * 0.92, x + (T() - 0.5) * 1.4));
      y -= s.h * (0.12 + T() * 0.14);
      g.lineTo(x, Math.max(0, y));
    }
    g.stroke();
  }
}

/**
 * A vein of ore across a face: a jagged rust-red band slanting over it, a few chips of ore standing proud along it with
 * their struck edges catching the light, and rust run down the face below.
 */
function veins(g: Ctx, s: Side, n: number, seed: number): void {
  const T = rand(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const y0 = s.h * (0.3 + T() * 0.45), slant = (T() - 0.5) * s.h * 0.5;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 4; k++) pts.push([s.w * (0.05 + 0.9 * (k / 4)), y0 + slant * (k / 4 - 0.5) + (T() - 0.5) * 0.5]);
    // The rust run down from it.
    for (let k = 1; k < 4; k += 2) {
      const [x, y] = pts[k];
      g.beginPath();
      g.moveTo(x - 0.45, y);
      g.lineTo(x + 0.45, y);
      g.lineTo(x + 0.1, Math.max(0, y - s.h * (0.2 + T() * 0.25)));
      g.closePath();
      g.fillStyle = css(RUST, 0.3);
      g.fill();
    }
    // The band.
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = css(mix(ORE, CRACK, 0.25), 0.9);
    g.lineWidth = 0.55;
    g.stroke();
    g.strokeStyle = css(ORE, 0.95);
    g.lineWidth = 0.32;
    g.stroke();
    // Chips of ore along it, each with its struck edge lit.
    for (let k = 0; k < 2; k++) {
      const [x, y] = pts[1 + k * 2];
      const r = 0.42 + T() * 0.25;
      g.beginPath();
      g.moveTo(x - r, y - r * 0.2);
      g.lineTo(x - r * 0.2, y + r * 0.8);
      g.lineTo(x + r, y + r * 0.3);
      g.lineTo(x + r * 0.3, y - r * 0.7);
      g.closePath();
      g.fillStyle = css(ORE, 1);
      g.fill();
      g.strokeStyle = css(mix(ORE, CRACK, 0.5), 0.9);
      g.lineWidth = 0.1;
      g.stroke();
      g.beginPath();
      g.moveTo(x - r, y - r * 0.2);
      g.lineTo(x - r * 0.2, y + r * 0.8);
      g.strokeStyle = css(ORE_LIT, 0.95);
      g.lineWidth = 0.14;
      g.stroke();
    }
  }
}

/* ---- the masses -------------------------------------------------------------------- */

interface Dress { iron: boolean; cracks: number; veins: number; cut: boolean }

/**
 * A mass of rock: a few-sided block, its corners pushed about and its crown
 * tilted, drawn in as it rises (as the ogre cave's crag). `cut` gives it a flat
 * crown paler than its sides, where a pick has taken its top off.
 */
function mass(cx: number, cy: number, rx: number, ry: number, h: number, sides: number, seed: number, tone: Tone, d: Dress): Face[] {
  const J = rand(seed);
  const jit = Array.from({ length: sides }, () => 1 + (J() - 0.5) * 0.45);
  const lean = Array.from({ length: sides }, () => (J() - 0.5) * (d.cut ? 0.08 : 0.3) * h);
  const turn = J();
  const at = (k: number, z: number, tilt: number): V3[] => jit.map((j, i) => {
    const a = ((i + turn) / sides) * TAU;
    return [cx + Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j, Math.max(0, z + lean[i] * tilt)] as V3;
  });
  // The faces a vein shows on: one in two of the middle band's, one in three of the upper's, so the stone reads first.
  const veined = (k: number, i: number): boolean => (k === 1 && (i + seed) % 2 === 0) || (k === 2 && (i + seed) % 3 === 1);
  const skin = (sd: number, s: Side, side: boolean, vein = false) => (g: Ctx, k: PaintCtx): void => {
    speckle(g, k.fill, s.w, s.h, sd, 0.9);
    if (side && d.cracks) cracks(g, k.fill, s, d.cracks, sd + 11);
    if (vein && d.iron && d.veins && s.w > 1.2) veins(g, s, d.veins, sd + 23);
  };
  const crown = d.cut ? paler(tone, 0.22) : tone;
  return prism([at(0.94, 0, 0), at(1, h * 0.3, 0.3), at(0.86, h * 0.7, 0.7), at(d.cut ? 0.72 : 0.5, h, 0.3)], tone,
    (k, i, s) => ({ crease: 0.4, paint: skin(seed * 10 + k * 7 + i, s, true, veined(k, i)) }),
    (s) => ({ tone: crown, crease: 0.3, paint: skin(seed + 3, s, false) }));
}

/** A loose stone at the foot: a small mass, ore-red for an iron one now and then. */
function loose(x: number, y: number, r: number, seed: number, tone: Tone, ore: boolean): Face[] {
  const t: Tone = ore ? toneOf('#d47a52', '#7a3a3a') : deeper(tone, 0.05);
  return mass(x, y, r * 1.15, r, r * 1.1, 5, seed, t, { iron: false, cracks: 0, veins: 0, cut: false });
}

function outcropOf(iron: boolean, look: KitLook): KitModel {
  const stage = stageOf(look.trim), variant = variantOf(look.trim);
  const V = rand(1301 + variant * 97 + (iron ? 7 : 0));
  const tone = iron ? IRONSTONE : GREY;
  const parts: KitPart[] = [];
  const add = (faces: Face[]): void => { parts.push({ faces, edges: true }); };
  // Mined down: lower, narrower, its crown cut flat, more cracks; an iron one with fewer veins left.
  const high = [1, 0.8, 0.62, 0.46][stage], wide = [1, 0.93, 0.85, 0.76][stage];
  const dress = (more: number): Dress => ({ iron, cracks: Math.min(3, stage + more), veins: iron ? (stage < 1 ? 2 : 1) : 0, cut: stage > 0 });
  // The main mass, a little off the middle; a shoulder against it at the back; another at its side until the third stage.
  const mx = (V() - 0.5) * 1.4, my = (V() - 0.5) * 1.0;
  const rx = (6.4 + V() * 0.8) * wide, ry = (5.6 + V() * 0.6) * wide, h = (7.8 + V() * 1.2) * high;
  add(mass(mx, my, rx, ry, h, 7 + (variant % 2), 401 + variant * 13, tone, dress(0)));
  const back = V() < 0.5 ? -1 : 1;
  add(mass(mx + back * 5.0 * wide, my - 4.0 * wide, 3.4 * wide, 3.0 * wide, h * 0.66, 6, 431 + variant * 13, deeper(tone, 0.04), dress(0)));
  if (stage < 3) add(mass(mx - back * 5.6 * wide, my + 1.6, 2.8 * wide, 2.5 * wide, h * 0.48, 6, 461 + variant * 13, tone, dress(-1)));
  // Broken stone at its foot: more of it the further it is mined, ore among it for an iron one.
  const n = 2 + stage * 2;
  for (let i = 0; i < n; i++) {
    const a = 0.35 * TAU + (i / n) * 0.8 * TAU + (V() - 0.5) * 0.4, r = Math.max(rx, ry) + 1.0 + V() * 1.0;
    const x = Math.max(-9, Math.min(9, mx + Math.cos(a) * r)), y = Math.max(-9, Math.min(9, my + Math.sin(a) * r));
    add(loose(x, y, 0.55 + V() * 0.45, 501 + variant * 31 + i, tone, iron && i % 2 === 0));
  }
  // Its shade: what it covers on the ground.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of parts) for (const f of p.faces ?? []) for (const q of f.pts) {
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
  }
  // Drawn a seventh larger than declared (`layKitModel`), so declared well inside what the solids cover.
  const k = 0.55, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sx = (x1 - x0) * k / 2, sy = (y1 - y0) * k / 2;
  return { parts, shade: [[cx - sx, cy - sy, 0], [cx + sx, cy - sy, 0], [cx + sx, cy + sy, 0], [cx - sx, cy + sy, 0]] };
}

const STATES = Array.from({ length: OUTCROP_STAGES + 1 }, (_, s) => ({ trim: outcropTrim(s, 0), label: s ? `mined ${s}/${OUTCROP_STAGES}` : 'whole' }));

export const IRON_OUTCROP: KitPiece = { model: (look) => outcropOf(true, look), uses: { trim: true }, states: STATES };
export const ROCK_OUTCROP: KitPiece = { model: (look) => outcropOf(false, look), uses: { trim: true }, states: STATES };
