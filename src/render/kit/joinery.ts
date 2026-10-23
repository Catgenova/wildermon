import {
  BRASS, css, faceColour, grain, hex, mix, nail, TAU,
  type Ctx, type PaintCtx, type RGB, type Side, type Tone,
} from './core';

/**
 * What the cabinet-maker's pieces of the kit share (cupboards, wardrobes,
 * shelves, the coffer): frame-and-panel work painted on a face, turned brass
 * knobs, keyhole plates and hinges -- all in a face's frame, `x` across from
 * its left as seen from outside and `y` up, in units.
 */

/** A wood side's grain, running up it (a stile, a post) or along it (a rail, a board's edge). */
export const grained = (seed: number, along: 'x' | 'y' = 'x', k = 0.7) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);

/** A top's grain, from its middle (a slab's top frame is its middle). */
export const topGrain = (seed: number, along: 'x' | 'y' = 'x', k = 0.6) => (g: Ctx, kk: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  grain(g, kk.fill, s.w, s.h, seed, along, k);
  g.restore();
};

/**
 * A panel sunk in its frame, from (x0, y0) to (x1, y1): its field a hair
 * deeper with the grain up it, the frame's shade along its head and left
 * (the light is from the upper left), a lit lip along its foot and right,
 * and, `raised`, a fielded middle standing proud with its own lit edges.
 * `deep` sinks it further: a wider, darker shade, for a panel that must read
 * from far off.
 */
export function panel(g: Ctx, fill: RGB, x0: number, y0: number, x1: number, y1: number, seed: number, raised = true, deep = 1): void {
  const w = x1 - x0, h = y1 - y0;
  g.fillStyle = css(mix(fill, hex('#5c4458'), Math.min(0.42, 0.28 * deep)));
  g.fillRect(x0, y0, w, h);
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.translate(x0, y0);
  grain(g, fill, w, h, seed, 'y', 0.55);
  g.restore();
  const d = Math.min(0.36 * deep, w * 0.14, h * 0.14);
  g.fillStyle = css(mix(fill, hex('#4a3640'), Math.min(0.72, 0.6 * deep)), 0.9);
  g.fillRect(x0, y1 - d, w, d);
  g.fillRect(x0, y0, d, h - d);
  g.fillStyle = css(mix(fill, [255, 248, 232], 0.5), 0.8);
  g.fillRect(x0 + d, y0, w - d, d * 0.75);
  g.fillRect(x1 - d * 0.75, y0 + d * 0.75, d * 0.75, h - d * 1.75);
  if (!raised) return;
  const m = Math.min(0.6, w * 0.22, h * 0.22);
  if (w - 2 * m < 0.5 || h - 2 * m < 0.5) return;
  // The fielded middle: its lit head and left, its shaded foot and right.
  g.fillStyle = css(mix(fill, [255, 248, 236], 0.12), 0.9);
  g.fillRect(x0 + m, y0 + m, w - 2 * m, h - 2 * m);
  g.fillStyle = css(mix(fill, [255, 248, 232], 0.4), 0.55);
  g.fillRect(x0 + m, y1 - m - 0.12, w - 2 * m, 0.12);
  g.fillRect(x0 + m, y0 + m, 0.12, h - 2 * m);
  g.fillStyle = css(mix(fill, hex('#4a3640'), 0.35), 0.45);
  g.fillRect(x0 + m, y0 + m, w - 2 * m, 0.1);
  g.fillRect(x1 - m - 0.1, y0 + m, 0.1, h - 2 * m);
}

/** A line cut between two doors, or a door and its frame: a dark groove and a lit lip to its right. */
export function joint(g: Ctx, fill: RGB, x0: number, y0: number, x1: number, y1: number, w = 0.26): void {
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = css(mix(fill, hex('#3e2c38'), 0.68));
  g.lineWidth = w;
  g.stroke();
  g.beginPath();
  g.moveTo(x0 + w * 0.8, y0);
  g.lineTo(x1 + w * 0.8, y1);
  g.strokeStyle = css(mix(fill, [255, 248, 232], 0.45), 0.55);
  g.lineWidth = w * 0.5;
  g.stroke();
}

/** A turned knob, or a ring's boss, of `tone` (brass unless said): a dark rim, its face, a glint at its upper left. */
export function knob(g: Ctx, k: PaintCtx, x: number, y: number, r: number, tone: Tone = BRASS): void {
  const fill = faceColour(tone, Math.min(1, k.L + 0.12));
  g.beginPath();
  g.arc(x, y, r * 1.22, 0, TAU);
  g.fillStyle = css(mix(fill, hex('#3a2c30'), 0.6), 0.95);
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(fill);
  g.fill();
  g.beginPath();
  g.arc(x - r * 0.32, y + r * 0.32, r * 0.42, 0, TAU);
  g.fillStyle = 'rgba(255, 252, 240, 0.75)';
  g.fill();
}

/** A keyhole in a small brass plate, its foot at `y`: a lozenge of brass, the hole a round over a slot. */
export function keyhole(g: Ctx, k: PaintCtx, x: number, y: number, s = 1, tone: Tone = BRASS): void {
  const fill = faceColour(tone, Math.min(1, k.L + 0.1));
  const pts: Array<[number, number]> = [[x, y + 1.1 * s], [x + 0.42 * s, y + 0.55 * s], [x, y], [x - 0.42 * s, y + 0.55 * s]];
  const path = (): void => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
  path();
  g.strokeStyle = css(mix(fill, hex('#3a2c30'), 0.55), 0.9);
  g.lineWidth = 0.18 * s;
  g.lineJoin = 'round';
  g.stroke();
  g.fillStyle = css(fill);
  g.fill();
  const dark = css(mix(fill, hex('#2a2030'), 0.85));
  g.fillStyle = dark;
  g.beginPath();
  g.arc(x, y + 0.66 * s, 0.13 * s, 0, TAU);
  g.fill();
  g.fillRect(x - 0.055 * s, y + 0.34 * s, 0.11 * s, 0.32 * s);
}

/** A hinge's leaf on a face, from `y0` to `y1` up it at `x` (its pin side), reaching `reach` across: iron or brass, a rivet or two. */
export function hinge(g: Ctx, k: PaintCtx, x: number, y0: number, y1: number, reach: number, tone: Tone): void {
  const fill = faceColour(tone, Math.min(1, k.L + 0.05));
  const x1 = x + reach;
  g.fillStyle = css(mix(fill, hex('#2e2a3c'), 0.55), 0.9);
  g.fillRect(Math.min(x, x1) - 0.08, y0 - 0.08, Math.abs(reach) + 0.16, y1 - y0 + 0.16);
  g.fillStyle = css(fill);
  g.fillRect(Math.min(x, x1), y0, Math.abs(reach), y1 - y0);
  g.fillStyle = css(mix(fill, [255, 255, 255], 0.45), 0.6);
  g.fillRect(Math.min(x, x1), y1 - 0.08, Math.abs(reach), 0.08);
  nail(g, fill, x + reach * 0.62, (y0 + y1) / 2, 0.11);
}
