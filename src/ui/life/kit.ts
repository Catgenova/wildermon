/**
 * What every animal and light on the frames is drawn with (`src/ui/runecut-life.ts`): the
 * piece it lives on, what the island says, and a few small helpers. Each one lives in a
 * file of its own beside this, so each can be worked on alone.
 */


import { NIGHT_WASH } from '../../render/nightwash';
import { NIGHT_FRAME } from '../runecut-frames';

export type Ctx = CanvasRenderingContext2D;


/** What the island says, for the ones that answer to it. */
export interface LifeWorld {
  /** Runecut's stone after dark. */
  night: boolean;
  /** The island's season is winter. */
  winter: boolean;
  /** Something is being made from a recipe now. */
  crafting: boolean;
  /** Favour held, as a share of what can be held, 0 to 1. */
  favour: number;
  /** A treasure map is in the pack: its hoard is still in the ground. */
  map: boolean;
}

/** One piece to draw on: its frame, its box in interface pixels, its band and reach. */
export interface LifePiece {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  F: number;
  R: number;
  seed: number;
}

/** How big the animals are drawn, against the sizes their shapes are written at. */
export const SIZE = 1.6;

/** A number in 0..1 for a pair of numbers, the same every time. */
export const rnd = (a: number, b = 0): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Smoothstep: 0 to 1, slow at both ends. */
export const ease = (u: number): number => u * u * (3 - 2 * u);

export const clamp01 = (u: number): number => Math.max(0, Math.min(1, u));

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** A point `u` (0..1) of the way round a w × h box from its top left, clockwise, `d` out past its edge. */
export function round(u: number, w: number, h: number, d: number): [number, number] {
  const L = 2 * (w + h);
  let s = ((u % 1) + 1) % 1 * L;
  if (s < w) return [s, -d];
  s -= w;
  if (s < h) return [w + d, s];
  s -= h;
  if (s < w) return [w - s, h + d];
  s -= w;
  return [-d, h - s];
}

/** A soft round light at (x, y), `r` across, in `rgb`, `a` strong at its middle. */
export function glow(g: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  if (a <= 0.01) return;
  const f = g.createRadialGradient(x, y, 0, x, y, r);
  f.addColorStop(0, `rgba(${rgb}, ${a})`);
  f.addColorStop(0.35, `rgba(${rgb}, ${a * 0.45})`);
  f.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = f;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A flight from `a` to `b` over an arc `lift` high, `u` of the way along. */
export function arc(a: [number, number], b: [number, number], lift: number, u: number): [number, number] {
  const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - lift;
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]];
}

/**
 * A colour (`#rrggbb`) after dark: under the island's night wash (`NIGHT_WASH`)
 * at the share of it the frames take (`NIGHT_FRAME`), so an animal sits in the
 * same light as the frame it is on.
 */
export function underNight(hex: string): string {
  const w = NIGHT_WASH.colour.split(',').map(Number), a = NIGHT_WASH.alpha * NIGHT_FRAME;
  return '#' + w.map((v, i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(c + (v - c) * a).toString(16).padStart(2, '0');
  }).join('');
}
