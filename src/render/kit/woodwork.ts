import {
  boards, centre, cross, css, deeper, dot, faceColour, grain, hex, metalTone, mix, mul, nail, prism, ring, slab, sub, TAU, unit, woodTone,
  type Ctx, type Face, type PaintCtx, type Side, type Tint, type Tone, type V3,
} from './core';

/**
 * What the seats, tables, desks and boards of the kit share with the chair
 * (`chair.ts`): its square legs chamfered and drawn in a hair at the foot,
 * its grain run up a leg and along a rail, its boards across a top, a rod
 * between two points for a splayed leg or a peg, and the few things that
 * are not wood -- leather, paper, ink -- that lie on them.
 */

/** A wood's side, its grain running up it (a leg, a post) or along it (a rail, a board's edge), as on the chair. */
export const woodSide = (seed: number, along: 'x' | 'y', k = 0.7) => (g: Ctx, kk: PaintCtx, s: Side): void => grain(g, kk.fill, s.w, s.h, seed, along, k);

/** The same on all four sides of a slab. */
export const woodSides = (seed: number, along: 'x' | 'y', k = 0.7) => ({
  front: woodSide(seed, along, k), left: woodSide(seed + 1, along, k), right: woodSide(seed + 2, along, k), back: woodSide(seed + 3, along, k),
});

/** Boards over a slab's top, `n` of them running along x or y, from its corner. */
export const topBoards = (n: number, seed: number, along: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  boards(g, k.fill, s.w, s.h, n, seed, along);
  g.restore();
};

/** The chair's leg: square, `w` thick, its arrises chamfered and drawn in a hair at the foot, the grain up it. */
export const LEG_W = 0.9;
export function leg(x: number, y: number, z0: number, z1: number, tone: Tone, seed: number, w = LEG_W): Face[] {
  return slab(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z0, z1, tone, { corner: w * 0.18, taper: 0.07, paint: woodSides(seed, 'y') });
}

/** The tones of a piece of wood alone: its boards, painted in the dye where it has one, paler on a top, deeper on a rail low down. */
export function woodTones(material?: string, tint?: Tint): { wood: Tone; top: Tone; end: Tone } {
  const wood = woodTone(material, tint, 0.75);
  return { wood, top: { lit: mix(wood.lit, [255, 250, 240], 0.08), shade: mix(wood.shade, wood.lit, 0.08) }, end: deeper(wood, 0.12) };
}

/**
 * A level ring of `n` corners round (cx, cy) at height z, half `rx` by `ry`,
 * wound anticlockwise from above from straight behind it: a round seat, a
 * splayed leg's section.
 */
export function round(cx: number, cy: number, z: number, rx: number, ry: number, n: number, turn = 0.5, wobble?: (i: number) => number): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + ((i + turn) / n) * TAU;
    const k = wobble ? wobble(i) : 1;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, z] as V3;
  });
}

/**
 * A rod from `a` to `b`, `r` from its axis, `n` sides round: a peg, a
 * stretcher between splayed legs. Its ends are cut square to it, each a face.
 */
export function rod(a: V3, b: V3, r: number, tone: Tone, n = 6, crease = 0.3): Face[] {
  const d = unit(sub(b, a));
  const p1 = Math.abs(d[2]) > 0.95 ? ([1, 0, 0] as V3) : unit(cross(d, [0, 0, 1]));
  const p2 = cross(d, p1);
  const ringAt = (o: V3): V3[] => Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * TAU;
    return [o[0] + (p1[0] * Math.cos(t) + p2[0] * Math.sin(t)) * r, o[1] + (p1[1] * Math.cos(t) + p2[1] * Math.sin(t)) * r, o[2] + (p1[2] * Math.cos(t) + p2[2] * Math.sin(t)) * r] as V3;
  });
  const ra = ringAt(a);
  const faces = prism([ra, ringAt(b)], tone, () => ({ crease }));
  const n0 = mul(d, -1);
  const pts = dot(sub(centre(ra), b), n0) > 0 ? ra.slice().reverse() : ra.slice();
  faces.push({ pts, n: n0, tone, crease });
  return faces;
}

/**
 * A leg splayed out from under a seat: a chamfered square section, level at
 * the floor and level where it meets the seat, its foot `foot` and its head
 * `head` on the ground plan. Its grain runs up it.
 */
export function splayed(foot: [number, number], head: [number, number], z1: number, w: number, tone: Tone, seed: number): Face[] {
  const c = w * 0.18;
  const sq = (x: number, y: number, z: number, h: number): V3[] => ring(x - h, x + h, y - h, y + h, z, c);
  return prism([sq(foot[0], foot[1], 0, w / 2 - 0.05), sq(head[0], head[1], z1, w / 2)], tone, (_k, i, s) => ({
    crease: i % 2 ? 0.3 : 0.42, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, seed + i, 'y', 0.6),
  }));
}

/* ---- what is not wood ------------------------------------------------------------------- */

/** A book's leather: a cherry wood taken deep and toward the mauve -- a red-brown that reads beside any wood. */
export const LEATHER: Tone = deeper(woodTone('cherry'), 0.45);
/** A hat's felt: oak taken deep, a dark warm brown. */
export const FELT: Tone = deeper(deeper(woodTone('oak'), 0.6), 0.45);
/** Paper: the kit's linen, a step paler. */
export const PAPER: Tone = { lit: hex('#fdf6e8'), shade: hex('#cdb8ac') };
/** An inkwell: the anvils' lead, a dark lilac pewter. */
export const INKPOT: Tone = metalTone('lead');

/** Lines of writing across a page `w` by `h` in its frame, from its corner: short soft strokes, the last line short. */
export function writing(g: Ctx, fill: [number, number, number], w: number, h: number, lines: number, seed: number): void {
  g.lineCap = 'round';
  g.strokeStyle = css(mix(fill, hex('#5a4a5c'), 0.55), 0.6);
  g.lineWidth = Math.max(0.1, h / (lines * 4.5));
  let s = seed;
  for (let i = 0; i < lines; i++) {
    const y = h * (1 - (i + 1) / (lines + 1));
    s = (s * 9301 + 49297) % 233280;
    const end = i === lines - 1 ? 0.45 + (s / 233280) * 0.2 : 0.82 + (s / 233280) * 0.08;
    g.beginPath();
    g.moveTo(w * 0.12, y);
    g.lineTo(w * end, y);
    g.stroke();
  }
}

/** A brass knob on a drawer front, at (x, y) in its frame: a disc, its rim, a glint. */
export function knob(g: Ctx, k: PaintCtx, x: number, y: number, r: number, tone: Tone): void {
  const fill = faceColour(tone, Math.min(1, k.L + 0.1));
  g.beginPath();
  g.arc(x + r * 0.15, y - r * 0.2, r * 1.05, 0, TAU);
  g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.5), 0.5);
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(mix(fill, hex('#5a4630'), 0.35));
  g.fill();
  g.beginPath();
  g.arc(x, y, r * 0.7, 0, TAU);
  g.fillStyle = css(fill);
  g.fill();
  g.beginPath();
  g.arc(x - r * 0.25, y + r * 0.25, r * 0.28, 0, TAU);
  g.fillStyle = 'rgba(255, 252, 238, 0.8)';
  g.fill();
}

/** A carved border round a face `w` by `h`, `inset` in from its edge: a groove, and a lit lip inside it. */
export function border(g: Ctx, fill: [number, number, number], w: number, h: number, inset: number, lw = 0.22): void {
  g.lineJoin = 'round';
  g.strokeStyle = css(mix(fill, hex('#4a3640'), 0.5), 0.85);
  g.lineWidth = lw;
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  g.strokeStyle = css(mix(fill, [255, 248, 232], 0.5), 0.6);
  g.lineWidth = lw * 0.5;
  g.strokeRect(inset + lw * 0.8, inset + lw * 0.8, w - inset * 2 - lw * 1.6, h - inset * 2 - lw * 1.6);
}

/** Nail heads in a row up a face, where a board is fixed to the post behind it. */
export function nails(g: Ctx, fill: [number, number, number], x: number, ys: readonly number[], r = 0.15): void {
  for (const y of ys) nail(g, fill, x, y, r);
}
