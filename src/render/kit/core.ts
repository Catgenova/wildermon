import type { Tint } from '../../game/dyestuffs';
import { materialOf } from '../../game/materials';
import { WOOD_TONE } from '../materials';
import { ANVIL_METALS } from '../metals';
import { rand } from '../ivy';
import {
  add, area2, at, CREASE_INK, css, cut, dot, faceColour, glyphPath, hex, mix, mul, newell, plate, proj, RUNE_GOLD, RUNE_WHITE, STONE_INK, sub, TAU, toneOf, unit,
  type Ctx, type Eye, type Face, type PaintCtx, type Painter, type PlateOpts, type Pt, type RGB, type Tone, type V3,
} from '../runestone';

export type { Ctx, Eye, Face, PaintCtx, Painter, Pt, RGB, Tone, V3, Tint };

/**
 * The furniture kit: what a piece of furniture redrawn in the runestones'
 * kit (`runestone.ts`) is built from, and what it says to the generic code
 * that bakes and draws it (`kitpieces.ts`). See `docs/kit-pieces.md`.
 *
 * A piece is a model in tenths of a metre -- `x` across it to its right as
 * you face its front, `y` toward its front, `z` up -- centred on the middle of
 * its footprint, which is `hw` by `hd` either way (five units a subtile). It
 * is a list of parts: faceted solids (`Face[]`, lit, creased and ruled round
 * in ink as one) and loose drawings (moss, flowers, a coin), laid back to
 * front by their boxes.
 */

/* ---- what a piece is asked for ------------------------------------------------ */

/** What a placed piece is drawn as: alight, its dye, its one number (`pieceTrim`), what it was built of. */
export interface KitLook {
  lit: boolean;
  tint?: Tint;
  /** A state the piece is in (a lid up, a stage of moss); for a piece drawn in layers this is the layer, and never reaches its model. */
  trim?: number;
  /** The wood it was sawn from ("Oak", "cherry") or the metal it was cast in, as the item names it. */
  material?: string;
  /** Which of a burning piece's flickers it is at (`KitPiece.flicker`): set only when it is lit, by the clock, never by the caller. */
  frame?: number;
}

/** One thing in a model. */
export interface KitPart {
  /** A solid: its faces, ruled round in ink as one. */
  faces?: Face[];
  /** Or something drawn loose, on the screen at zoom one from the footprint's middle: moss, a coin, a flower. */
  draw?: (g: Ctx, e: Eye) => void;
  /** Points a loose drawing reaches, for its box (solids are measured off their faces). */
  reach?: V3[];
  /**
   * Pixels at zoom one a loose drawing may run past the screen box of its
   * reach -- the leaves round a vine's line, a halo round a lamp -- for the
   * size of the picture only, never for the order it is laid in.
   */
  pad?: number;
  /** Clicked by: solids are unless they say otherwise; loose drawings never are. */
  solid?: boolean;
  /** Light caught along the near arrises of its tops, as on the smith's pieces. */
  edges?: boolean;
  /** Laid before everything else whatever its place: a rug, a plinth sunk in the floor. */
  first?: boolean;
  /** Laid after these whatever the boxes say: a strap over a lid, a lock plate on a front. */
  after?: KitPart[];
  /**
   * For a piece drawn in layers (`KitPiece.layers`), which one it is in: a
   * number, or from the eye -- a crate's side is in its far half or its near
   * half by which way it is seen (`halfOf`).
   */
  layer?: number | ((e: Eye) => number);
  /** Drawn only when the piece is drawn whole, never in a layer: the still water a fountain shows when it is set down. */
  wholeOnly?: boolean;
  /** Its ink, in pixels at zoom one, and its colour, where not the kit's (`KIT_INK`). */
  ink?: number;
  inkColour?: RGB;
}

/** A model: its parts, and its footprint on the floor for the soft shade it throws, in units (null for none). */
export interface KitModel {
  parts: KitPart[];
  shade?: V3[] | null;
}

/** Room a piece's model is built in: half its footprint each way, in units. */
export interface KitSize { hw: number; hd: number }

/**
 * A piece of furniture drawn in the kit, registered by its kind
 * (`kit/index.ts`). The generic code builds its model once for each look it
 * depends on and bakes it for each view and scale.
 */
export interface KitPiece {
  model: (look: KitLook, size: KitSize) => KitModel;
  /** Which of the look its model is built from; the rest is left out of its bake's key, so a chair does not bake again when lit. Unsaid: all. */
  uses?: { lit?: boolean; tint?: boolean; trim?: boolean; material?: boolean };
  /** Drawn in this many layers, `trim` saying which (the renderer draws something between them: a wildermon in a crate, a fountain's water). */
  layers?: number;
  /** The states `trim` puts it in, for the preview sheet (`tools/piece-sheet.mjs`). */
  states?: Array<{ trim: number; label: string }>;
  /** Drawn over its bake every frame (`drawFurnitureLive`): a flame, cloth in the wind. `air` is the wind and the dye when the piece says `wind`. */
  live?: (ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, night: number, t: number, air?: KitAir) => void;
  /** Where it takes the night back off itself this frame (`furnitureHoles`). */
  holes?: (sx: number, sy: number, zoom: number, view: KitView, t: number) => Array<{ x: number; y: number; r: number; a: number }>;
  /** Its live drawing wants the wind (`clothInWind`). */
  wind?: boolean;
  /** Lit, how many flickers its fire is baked in (`KitLook.frame`), one every `FLICKER_MS` round and round, as the old models' fires were. Unlit, or unsaid, one bake. */
  flicker?: number;
}

/** A piece's turn on the screen (`PieceView`). */
export interface KitView { ux: number; uy: number; vx: number; vy: number }
/** The wind on a piece's cloth (`Air` in furniture.ts). */
export interface KitAir { x: number; y: number; force: number; t: number; tint?: Tint; device?: number }

/* ---- the palette ----------------------------------------------------------------- */

/** The ink every piece of furniture is ruled round in: the kit's warm grey-brown, a step browner for wood (the beds'). */
export const KIT_INK: RGB = mix(STONE_INK, hex('#5a3a30'), 0.35);
/** How wide, in pixels at zoom one. */
export const KIT_INK_W = 0.7;

/** What a wood is in the light, from its board colour (`WOOD_TONE`): a step paler and creamier. */
const WOOD_LIGHT: RGB = hex('#fff2dc');
/** And what it goes to turned from the light: a warm mauve, never the board darkened. */
const WOOD_DUSK: RGB = hex('#6a5468');
/** The board colour of a wood nobody has named: oak. */
const WOOD_PLAIN = '#bb8f5c';

/** The board colour of a material, by its name as the item writes it. */
export function woodHexOf(material?: string): string {
  const id = materialOf(material)?.id ?? material?.toLowerCase() ?? '';
  return WOOD_TONE[id] ?? WOOD_PLAIN;
}

/**
 * A wood as the kit tones it: its board colour taken a step toward cream in
 * the light and toward mauve in the shade. Dyed, the dye is laid over it as a
 * paint that lets the grain through, `stain` of the way (cloth takes all of it,
 * `clothTone`).
 */
export function woodTone(material?: string, tint?: Tint, stain = 0.5): Tone {
  let board = hex(woodHexOf(material));
  if (tint) board = mix(board, mix(hex(tint.colour), WOOD_LIGHT, 0.12), stain);
  return { lit: mix(board, WOOD_LIGHT, 0.2), shade: mix(board, WOOD_DUSK, 0.55) };
}
/** The same wood a step deeper: a plinth, the inside of a box, end grain. */
export const deeper = (t: Tone, k = 0.18): Tone => ({ lit: mix(t.lit, t.shade, k), shade: mix(t.shade, hex('#3e3040'), k * 0.8) });
/** And a step paler: a worn top, a turned knob. */
export const paler = (t: Tone, k = 0.15): Tone => ({ lit: mix(t.lit, [255, 250, 240], k), shade: mix(t.shade, t.lit, k) });

/** Cloth: linen undyed, or the dye whole, kept in the island's pastels. */
export function clothTone(tint?: Tint): Tone {
  if (!tint) return toneOf('#f9eed8', '#c4a89c');
  const c = hex(tint.colour);
  return { lit: mix(c, [255, 248, 236], 0.22), shade: mix(mix(c, hex(tint.shade), 0.6), WOOD_DUSK, 0.3) };
}

/** A metal as the anvils are cast (`ANVIL_METALS`): its own pastel hue, so a fitting says what it is. Iron when it does not say. */
export function metalTone(metal = 'iron'): Tone {
  const m = ANVIL_METALS[metal.toLowerCase()] ?? ANVIL_METALS.iron;
  return toneOf(m[0], m[1]);
}
/** The iron of straps and hinges: the anvils' iron a step darker, so it reads against pale wood. */
export const IRON: Tone = { lit: mix(hex('#a6b2c6'), hex('#5f6982'), 0.45), shade: hex('#454c66') };
/** Brass for a lock plate or a ring: warm, a hair toward the runes' gold. */
export const BRASS: Tone = toneOf('#ecd38a', '#8f7440');

/* ---- small sums ------------------------------------------------------------------ */

export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const centre = (pts: readonly V3[]): V3 => mul(pts.reduce<V3>((m, p) => add(m, p), [0, 0, 0]), 1 / pts.length);

/**
 * One side of a solid as it is painted: its corner at the left of its foot as
 * seen from outside, the way across it, the way up it (a unit of height a
 * unit), how wide and how tall it is, and which way it faces.
 */
export interface Side { o: V3; a: V3; b: V3; w: number; h: number; n: V3; poly: V3[] }

/**
 * A solid of rings, one over the next from its foot to its top, each side
 * between two rings a face and the last ring its top (`prism` in forge.ts).
 * `dress` says what each side is (band `k`, side `i` from the ring's first
 * corner); a side's painter draws in its frame, `x` across from its left as
 * seen from outside and `y` up. The top's frame is its middle, `x` along its
 * first edge and `y` across that (toward the front on a ring wound as `ring`
 * winds them).
 */
export function prism(rings: V3[][], tone: Tone, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined, top?: Partial<Face> | ((s: Side) => Partial<Face> | undefined)): Face[] {
  const faces: Face[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const lo = rings[k], hi = rings[k + 1];
    const mid = mul(add(centre(lo), centre(hi)), 0.5);
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      const pts = [lo[i], lo[j], hi[j], hi[i]];
      // A side with no width (a ring's corner not cut): nothing to draw.
      if (Math.hypot(...sub(lo[j], lo[i])) < 1e-6 && Math.hypot(...sub(hi[j], hi[i])) < 1e-6) continue;
      let n = newell(pts);
      if (dot(n, sub(centre(pts), mid)) < 0) n = mul(n, -1);
      const nh = Math.hypot(n[0], n[1]);
      const a: V3 = nh > 1e-6 ? [n[1] / nh, -n[0] / nh, 0] : [1, 0, 0];
      const [l, r] = dot(lo[i], a) <= dot(lo[j], a) ? [lo[i], lo[j]] : [lo[j], lo[i]];
      let b = unit(cross(a, n));
      if (b[2] < 0) b = mul(b, -1);
      if (b[2] > 0.05) b = mul(b, 1 / b[2]);
      const zs = pts.map((p) => p[2]);
      const s: Side = { o: l, a, b, w: Math.hypot(r[0] - l[0], r[1] - l[1], r[2] - l[2]), h: Math.max(...zs) - Math.min(...zs), n, poly: pts };
      faces.push({ pts, n, tone, crease: 0.4, frame: { o: l, a, b }, ...(dress?.(k, i, s) ?? {}) });
    }
  }
  const last = rings[rings.length - 1];
  let n = newell(last);
  if (dot(n, sub(centre(last), centre(rings[rings.length - 2]))) < 0) n = mul(n, -1);
  const a = unit(sub(last[1], last[0])), tb = cross(n, a), tc = centre(last);
  const span = (d: V3): number => Math.max(...last.map((p) => dot(sub(p, tc), d))) - Math.min(...last.map((p) => dot(sub(p, tc), d)));
  // Its frame from its middle: `w` across along its first edge, `h` along the other way.
  const ts: Side = { o: tc, a, b: tb, w: span(a), h: span(tb), n, poly: last };
  const t = typeof top === 'function' ? top(ts) : top;
  faces.push({ pts: last.slice(), n, tone, crease: 0.45, frame: { o: ts.o, a: ts.a, b: ts.b }, ...(t ?? {}) });
  return faces;
}

/**
 * A level ring round a box from `x0` to `x1` and `y0` to `y1` at height `z`,
 * its four upright corners cut `c` back (an octagon; a plain rectangle when
 * `c` is nought), wound anticlockwise from above starting at the back left:
 * sides 0 back, 2 right, 4 front, 6 left, the odd ones its cut corners.
 */
export function ring(x0: number, x1: number, y0: number, y1: number, z: number, c = 0): V3[] {
  return [[x0 + c, y0, z], [x1 - c, y0, z], [x1, y0 + c, z], [x1, y1 - c, z], [x1 - c, y1, z], [x0 + c, y1, z], [x0, y1 - c, z], [x0, y0 + c, z]];
}

/** Which way a side of a `ring` looks. */
export type Facing = 'back' | 'right' | 'front' | 'left' | 'corner';
export const RING_SIDE: Facing[] = ['back', 'corner', 'right', 'corner', 'front', 'corner', 'left', 'corner'];

export interface SlabOpts {
  /** Its upright corners cut back by this: a rounded box at a distance. */
  corner?: number;
  /** Its top edge chamfered by this, in from the sides and down them. */
  bevel?: number;
  /** Narrower at its foot than its head by this either way (a tapered leg), or wider when less than nought. */
  taper?: number;
  /** What is painted on each side, by which way it looks, and on its top: `x` across from the left as seen from outside, `y` up (the top: from its middle, `x` right, `y` to the front). */
  paint?: Partial<Record<Facing | 'top' | 'bevel', (g: Ctx, k: PaintCtx, s: Side) => void>>;
  crease?: number;
}

/**
 * A slab: a box `x0`..`x1` by `y0`..`y1` from `z0` up to `z1`, its corners
 * and top edge softened as `o` says -- a seat, a board, a leg, a chest's
 * body. Every side has a frame to be painted in (`SlabOpts.paint`).
 */
export function slab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: Tone, o: SlabOpts = {}): Face[] {
  const c = o.corner ?? 0, b = Math.min(o.bevel ?? 0, (z1 - z0) * 0.45), t = o.taper ?? 0;
  const rings = [ring(x0 + t, x1 - t, y0 + t, y1 - t, z0, c)];
  if (b > 0) rings.push(ring(x0, x1, y0, y1, z1 - b, c), ring(x0 + b, x1 - b, y0 + b, y1 - b, z1, Math.max(0, c - b * 0.4)));
  else rings.push(ring(x0, x1, y0, y1, z1, c));
  const p = o.paint ?? {};
  return prism(rings, tone, (k, i, s) => {
    const side = b > 0 && k === 1 ? 'bevel' : RING_SIDE[i];
    const f = p[side];
    return { crease: side === 'corner' || side === 'bevel' ? 0.3 : o.crease ?? 0.42, ...(f ? { paint: (g: Ctx, kk: PaintCtx) => f(g, kk, s) } : {}) };
  }, (s) => (p.top ? { paint: (g: Ctx, kk: PaintCtx) => p.top!(g, kk, s) } : undefined));
}

/**
 * Rings round an upright axis at (cx, cy): `profile` is [height, radius]
 * from the foot up, `sides` round -- a turned knob, a bun foot, a finial.
 */
export function lathe(cx: number, cy: number, profile: ReadonlyArray<[number, number]>, sides: number, tone: Tone, turn = 0.5, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined): Face[] {
  const rings = profile.map(([z, r]) => Array.from({ length: sides }, (_, i) => {
    const a = ((i + turn) / sides) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as V3;
  }));
  return prism(rings, tone, (k, i, s) => ({ crease: 0.18, ...(dress?.(k, i, s) ?? {}) }));
}

/**
 * An outline pushed through a thickness: `outline` in the plane of `U` and
 * `W` (anticlockwise or not), from `a0` to `a1` along `A`, its rims
 * chamfered by `bevel` (`plate` in runestone.ts). A shaped rail, a lid's
 * curve seen end on, a strap over it. Its two flat faces paint in (`s` along
 * `U`, `t` along `W`) from `o`; its edge strips in (along the edge, through
 * it from its middle).
 */
export function extrude(o: V3, U: V3, W: V3, A: V3, outline: Pt[], a0: number, a1: number, tone: Tone, bevel: number, more: Partial<PlateOpts> = {}): Face[] {
  const mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
  return plate({ o: at(o, [mid, A]), U, W, A, outline: area2(outline) < 0 ? outline.slice().reverse() : outline, half: [half, half], tTop: 1, bevel, tone, ...more });
}

/** Faces turned `angle` about the line through `pivot` along `axis` (a unit), frames and all: a lid lifted on its hinges. */
export function turned(faces: readonly Face[], pivot: V3, axis: V3, angle: number): Face[] {
  const c = Math.cos(angle), s = Math.sin(angle), k = unit(axis);
  const rot = (v: V3): V3 => add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  const pt = (p: V3): V3 => add(pivot, rot(sub(p, pivot)));
  return faces.map((f) => ({ ...f, pts: f.pts.map(pt), n: rot(f.n), frame: f.frame ? { o: pt(f.frame.o), a: rot(f.frame.a), b: rot(f.frame.b) } : undefined }));
}

/** Faces carried through `fn`, a bend of the model (a back raked as it rises): frames carried with them, each face's way out worked again. */
export function warped(faces: readonly Face[], fn: (p: V3) => V3): Face[] {
  return faces.map((f) => {
    const pts = f.pts.map(fn);
    let n = newell(pts);
    if (dot(n, f.n) < 0) n = mul(n, -1);
    if (!f.frame) return { ...f, pts, n };
    const o = fn(f.frame.o);
    return { ...f, pts, n, frame: { o, a: sub(fn(add(f.frame.o, f.frame.a)), o), b: sub(fn(add(f.frame.o, f.frame.b)), o) } };
  });
}

/** For a part of a piece drawn in two halves round what is inside it: 1, the near half, when (x, y) is nearer the eye than the middle, else 0. */
export const halfOf = (x: number, y: number) => (e: Eye): number => (x * e.toward[0] + y * e.toward[1] > 0.01 ? 1 : 0);

/** Faces moved by `d`. */
export const moved = (faces: readonly Face[], d: V3): Face[] => faces.map((f) => ({ ...f, pts: f.pts.map((p) => add(p, d)), frame: f.frame ? { ...f.frame, o: add(f.frame.o, d) } : undefined }));

/* ---- what is painted on wood ------------------------------------------------------ */

/** A seam between two boards in a face's frame, from (x0, y0) to (x1, y1): a dark groove and a lit lip under it. */
export function seam(g: Ctx, fill: RGB, x0: number, y0: number, x1: number, y1: number, w = 0.16): void {
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = css(mix(fill, hex('#4a3640'), 0.5), 0.9);
  g.lineWidth = w;
  g.stroke();
  // The lit lip of the board under it, where the light gets in at the joint.
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = (dy / l) * w * 0.8, ny = (-dx / l) * w * 0.8;
  g.beginPath();
  g.moveTo(x0 + nx, y0 + ny);
  g.lineTo(x1 + nx, y1 + ny);
  g.strokeStyle = css(mix(fill, [255, 248, 232], 0.45), 0.55);
  g.lineWidth = w * 0.5;
  g.stroke();
}

/**
 * The grain of a board over a face `w` by `h` in its frame: long soft
 * streaks a step paler and a step deeper running `along` x (or up y), now and
 * then a small knot. Sparse: the face's light does the work at zoom one.
 */
export function grain(g: Ctx, fill: RGB, w: number, h: number, seed: number, along: 'x' | 'y' = 'x', k = 1): void {
  const T = rand(seed);
  const [L, H] = along === 'x' ? [w, h] : [h, w];
  g.save();
  if (along === 'y') g.transform(0, 1, 1, 0, 0, 0);
  g.lineCap = 'round';
  const n = Math.max(1, Math.round(H * 0.9 * k));
  // The streaks a step deeper and a step paler, each laid as one stroke: a face's grain is two calls, not a dozen.
  const dark = new Path2D(), light = new Path2D();
  for (let i = 0; i < n; i++) {
    const y = ((i + 0.3 + T() * 0.4) / n) * H;
    const x0 = T() * L * 0.3, x1 = L - T() * L * 0.3;
    const c1 = y + (T() - 0.5) * 0.35, c2 = y + (T() - 0.5) * 0.35, y1 = y + (T() - 0.5) * 0.2;
    const P = T() < 0.55 ? dark : light;
    T();
    P.moveTo(x0, y);
    P.bezierCurveTo(x0 + (x1 - x0) * 0.3, c1, x0 + (x1 - x0) * 0.7, c2, x1, y1);
  }
  g.lineWidth = 0.14;
  g.strokeStyle = css(mix(fill, hex('#5c4048'), 0.3), 0.32);
  g.stroke(dark);
  g.strokeStyle = css(mix(fill, [255, 246, 228], 0.4), 0.38);
  g.stroke(light);
  if (L * H > 18 && T() < 0.7 * k) {
    const x = L * (0.2 + 0.6 * T()), y = H * (0.25 + 0.5 * T());
    g.beginPath();
    g.ellipse(x, y, 0.32, 0.18, 0, 0, TAU);
    g.fillStyle = css(mix(fill, hex('#5c4048'), 0.4), 0.55);
    g.fill();
  }
  g.restore();
}

/** Boards across a face `w` by `h`: `n` of them laid along x one over the next, each its own hair of tint, seams between and grain on each. */
export function boards(g: Ctx, fill: RGB, w: number, h: number, n: number, seed: number, along: 'x' | 'y' = 'x'): void {
  const T = rand(seed * 3 + 1);
  const [L, H] = along === 'x' ? [w, h] : [h, w];
  g.save();
  if (along === 'y') g.transform(0, 1, 1, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const y0 = (i / n) * H, y1 = ((i + 1) / n) * H;
    const tint = T();
    if (tint < 0.4) { g.fillStyle = css(mix(fill, [255, 248, 234], 0.08 + tint * 0.1), 0.6); g.fillRect(-0.5, y0, L + 1, y1 - y0); }
    else if (tint > 0.7) { g.fillStyle = css(mix(fill, hex('#6e5060'), 0.06 + (tint - 0.7) * 0.15), 0.55); g.fillRect(-0.5, y0, L + 1, y1 - y0); }
    grain(g, fill, L, y1 - y0, seed + i * 17, 'x', 0.8);
    if (i) seam(g, fill, -0.5, y0, L + 0.5, y0);
  }
  g.restore();
}

/** A nail's head on a face, at (x, y) in its frame. */
export function nail(g: Ctx, fill: RGB, x: number, y: number, r = 0.16): void {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(mix(fill, hex('#3c3848'), 0.6), 0.9);
  g.fill();
  g.beginPath();
  g.arc(x - r * 0.3, y + r * 0.3, r * 0.4, 0, TAU);
  g.fillStyle = 'rgba(255, 252, 244, 0.5)';
  g.fill();
}

/**
 * A rune inlaid in gold, as the forge's runes are lit but still: its channel
 * cut, gold laid in it and a white heart along it. In a face's frame, `s`
 * units from its middle to its top; never under two pixels of channel.
 */
export function inlay(g: Ctx, fill: RGB, glyph: string, x: number, y: number, s: number, w = 0.32): void {
  const tr = g.getTransform();
  const px = Math.max(1e-6, Math.min(Math.hypot(tr.a, tr.b), Math.hypot(tr.c, tr.d)));
  const ww = Math.max(w, 1.1 / px);
  cut(g, fill, ww * 1.25, () => glyphPath(g, glyph, x, y, s));
  glyphPath(g, glyph, x, y, s);
  g.strokeStyle = RUNE_GOLD;
  g.lineWidth = ww * 0.75;
  g.stroke();
  glyphPath(g, glyph, x, y, s);
  g.strokeStyle = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.4), 0.9);
  g.lineWidth = ww * 0.3;
  g.stroke();
}

/**
 * A small gold lozenge set in a face, as a stud or an inlaid diamond: the
 * kit's gold, edged in amber, a white glint up its left. In a face's frame,
 * `r` units from its middle to its top. Reads at zoom one as a gold fleck.
 */
export function stud(g: Ctx, x: number, y: number, r: number): void {
  const pts: Pt[] = [[x, y + r], [x + r * 0.66, y], [x, y - r], [x - r * 0.66, y]];
  const path = (): void => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
  path();
  g.fillStyle = '#b8803c';
  g.fill();
  g.save();
  g.translate(x, y + r * 0.08);
  g.scale(0.74, 0.74);
  g.translate(-x, -y);
  path();
  g.fillStyle = RUNE_GOLD;
  g.fill();
  g.restore();
  g.beginPath();
  g.moveTo(x - r * 0.3, y + r * 0.15);
  g.lineTo(x, y + r * 0.6);
  g.strokeStyle = css(hex(RUNE_WHITE), 0.85);
  g.lineWidth = r * 0.22;
  g.lineCap = 'round';
  g.stroke();
}

/** Metal's sheen over a side `w` by `h`: dark at its foot and a cool light along its head, a few flecks of scale. */
export function sheen(g: Ctx, fill: RGB, w: number, h: number, seed: number): void {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(40, 36, 52, 0.18)');
  gr.addColorStop(0.55, 'rgba(40, 36, 52, 0)');
  gr.addColorStop(1, 'rgba(240, 242, 255, 0.3)');
  g.fillStyle = gr;
  g.fillRect(-0.5, 0, w + 1, h);
  const T = rand(seed);
  g.fillStyle = css(mix(fill, hex('#3c3848'), 0.4), 0.3);
  for (let i = 0; i < Math.round(w * h * 0.4); i++) g.fillRect(T() * w, T() * h, 0.12, 0.12);
}

/** An iron band (or `tone`, any metal) across a face, from `x0` to `x1` along it and `y0` to `y1` up it, lit as the face is, with a lit edge and nails. */
export function band(g: Ctx, k: PaintCtx, x0: number, x1: number, y0: number, y1: number, nails: number, upright: boolean, tone: Tone = IRON): void {
  const fill = faceColour(tone, k.L);
  // Its rim, a step darker than the iron, so a band reads against any wood or paint.
  g.fillStyle = css(mix(fill, hex('#2e2a3c'), 0.6), 0.95);
  g.fillRect(x0 - 0.13, y0 - 0.13, x1 - x0 + 0.26, y1 - y0 + 0.26);
  g.fillStyle = css(fill);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.save();
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  sheen(g, fill, x1 - x0 + 0.2, y1 - y0, Math.round(x0 * 13 + y0 * 7));
  g.restore();
  // The light along its upper or left edge.
  g.fillStyle = css(mix(fill, [255, 255, 255], 0.45), 0.6);
  if (upright) g.fillRect(x0, y0, 0.12, y1 - y0); else g.fillRect(x0, y1 - 0.12, x1 - x0, 0.12);
  for (let i = 0; i < nails; i++) {
    const u = (i + 0.5) / nails;
    if (upright) nail(g, fill, (x0 + x1) / 2, y0 + (y1 - y0) * u, 0.15);
    else nail(g, fill, x0 + (x1 - x0) * u, (y0 + y1) / 2, 0.15);
  }
}

/* ---- the light on its edges -------------------------------------------------------- */

/** The light caught along the near arrises of a solid's tops (`litEdges` in forge.ts): a hair of pale light, broken. */
export function litEdges(g: Ctx, e: Eye, faces: readonly Face[], seed: number, colour = 'rgba(255, 246, 228, 0.55)'): void {
  const T = rand(seed);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = colour;
  for (const f of faces) {
    if (f.n[2] < 0.75 || dot(f.n, e.toward) <= 1e-6 || f.pts.length < 3) continue;
    const m0 = dot(centre(f.pts), e.toward);
    const scr = f.pts.map((q) => proj(e, q));
    // A top under a dozen pixels on its bake: the light along it would be a smudge, and its clip and stroke are dear.
    const tr = g.getTransform();
    let a = 0;
    for (let i = 0; i < scr.length; i++) { const p = scr[i], q = scr[(i + 1) % scr.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (Math.abs(a) * 0.5 * Math.abs(tr.a * tr.d - tr.b * tr.c) < 12) continue;
    g.save();
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    // Its near arrises broken into dashes, all of them one stroke.
    const dashes = new Path2D();
    for (let i = 0; i < f.pts.length; i++) {
      const j = (i + 1) % f.pts.length;
      if (dot(mul(add(f.pts[i], f.pts[j]), 0.5), e.toward) <= m0 + 0.05) continue;
      const [ax, ay] = scr[i], [bx, by] = scr[j];
      for (let u = T() * 0.1; u < 1;) {
        const v = Math.min(1, u + 0.25 + 0.4 * T());
        T();
        dashes.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
        dashes.lineTo(ax + (bx - ax) * v, ay + (by - ay) * v);
        u = v + 0.05 + 0.12 * T();
      }
    }
    g.lineWidth = 0.8;
    g.stroke(dashes);
    g.restore();
  }
  g.restore();
}

/** The crease ink, re-exported for pieces that rule a line of their own between faces. */
export { CREASE_INK };

/** The kit's small sums and colours, for a piece to take from one place. */
export { add, css, dot, faceColour, hex, mix, mul, proj, sub, TAU, toneOf, unit } from '../runestone';
