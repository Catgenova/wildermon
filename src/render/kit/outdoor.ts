import { FACINGS } from '../../game/furniture';
import { hashOf, rand } from '../ivy';
import { cut, drawPads, type Pad } from '../runestone';
import {
  add, centre, cross, css, deeper, extrude, grain, hex, mix, mul, prism, proj, sub, TAU, toneOf, unit,
  type Ctx, type Eye, type Face, type KitPart, type PaintCtx, type Pt, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * What the kit's pieces that stand out of doors share: the forge's stone,
 * shingled roofs, struts set at a slant, bees, and moss on stone that gathers
 * it (`greening.ts`, `mossTrim` in furniture.ts).
 */

/* ---- stone ------------------------------------------------------------------------ */

/** Walling stone: the kiln's (`KILN_STONE` in forge.ts). */
export const STONE: Tone = toneOf('#ecd6c0', '#a68f94');
/** Dressed stone for a coping, a cornice, a voussoir: the kiln's dressing (`DRESSING`). */
export const DRESSED: Tone = toneOf('#f3e2cc', '#b29da0');
/** A block, as the anvil stands on (`BLOCK`). */
export const BLOCK: Tone = toneOf('#eadbc2', '#a89794');

/** A stone's skin over a face `w` by `h` in its frame: flat patches a step paler and a step greyer, and grit. */
export function stoneSkin(g: Ctx, fill: RGB, w: number, h: number, seed: number, k = 1): void {
  const T = rand(seed);
  for (let i = 0, n = Math.max(1, Math.round((w * h * k) / 7)); i < n; i++) {
    g.beginPath();
    g.ellipse(T() * w, T() * h, 0.6 + T() * 1.6, 0.35 + T() * 0.8, (T() - 0.5) * 0.6, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.35) : css(mix(fill, hex('#9c94a4'), 0.3), 0.25);
    g.fill();
  }
  g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.3);
  for (let i = 0; i < w * h * 0.5 * k; i++) g.fillRect(T() * w, T() * h, 0.14 + T() * 0.12, 0.14 + T() * 0.12);
}

/**
 * Ashlar over a face `w` by `h`: its skin, courses `course` high cut across it
 * and the joints between stones `long` apart, every other course broken by
 * half a stone. `shift` moves the joints along, so the faces of a round
 * carry them on.
 */
export function ashlar(g: Ctx, fill: RGB, w: number, h: number, course: number, long: number, seed: number, shift = 0): void {
  stoneSkin(g, fill, w, h, seed);
  const rows = Math.max(1, Math.round(h / course));
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * ch, y1 = y0 + ch;
    if (r) cut(g, fill, 0.15, () => { g.beginPath(); g.moveTo(-0.5, y0); g.lineTo(w + 0.5, y0); });
    const off = shift + (r % 2) * long * 0.5;
    for (let x = ((off % long) + long) % long; x < w; x += long) {
      if (x < 0.2 || x > w - 0.2) continue;
      cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(x, y0 + 0.08); g.lineTo(x, y1 - 0.08); });
    }
  }
}

/* ---- wood at a slant ---------------------------------------------------------------- */

/**
 * A square-sawn member from `a` to `b`, `w` across and `d` deep about its
 * line, its broad faces square to `up` where it can be: a brace, an axle, a
 * rail. Its sides paint along it (`x` from `a`), and both its ends are shut.
 */
export function strut(a: V3, b: V3, w: number, d: number, tone: Tone, paint?: (g: Ctx, k: PaintCtx, s: Side) => void, up: V3 = [0, 0, 1]): Face[] {
  const t = unit(sub(b, a));
  let u = cross(t, up);
  if (Math.hypot(...u) < 1e-6) u = cross(t, [1, 0, 0]);
  u = unit(u);
  const v = unit(cross(u, t));
  const ringAt = (p: V3): V3[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => add(add(p, mul(u, (i * w) / 2)), mul(v, (j * d) / 2)));
  const ra = ringAt(a), rb = ringAt(b);
  // Its sides, painted along it from `a`: their frames set from the member itself, whichever way it slants.
  const faces: Face[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const pts = [ra[i], ra[j], rb[j], rb[i]];
    // Out from its line through the middle of the side: the corners are its line's point and so much of `u` and `v`.
    const n = unit(sub(mul(add(ra[i], ra[j]), 0.5), a));
    const across = unit(sub(ra[j], ra[i]));
    const len = Math.hypot(...sub(b, a)), wide = Math.hypot(...sub(ra[j], ra[i]));
    const s: Side = { o: ra[i], a: t, b: across, w: len, h: wide, n, poly: pts };
    faces.push({ pts, n, tone, crease: 0.4, frame: { o: ra[i], a: t, b: across }, ...(paint ? { paint: (g: Ctx, k: PaintCtx) => paint(g, k, s) } : {}) });
  }
  faces.push({ pts: ra.slice().reverse(), n: mul(t, -1), tone: deeper(tone, 0.1), crease: 0.45 });
  faces.push({ pts: rb.slice(), n: t, tone: deeper(tone, 0.1), crease: 0.45 });
  return faces;
}

/** Grain along a member (`strut`). */
export const alongGrain = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, 'x', 0.6);

/** A turned round lying along x, from `x0` to `x1`, `r` about the line (y, z): an axle, a drum of rope, a handle. */
export function rollX(x0: number, x1: number, y: number, z: number, r: number, sides: number, tone: Tone, dress?: (k: number, i: number, s: Side) => Partial<Face> | undefined): Face[] {
  const ring = (x: number): V3[] => Array.from({ length: sides }, (_, i) => {
    const a = ((i + 0.5) / sides) * TAU;
    return [x, y + Math.cos(a) * r, z + Math.sin(a) * r] as V3;
  });
  const faces = prism([ring(x0), ring(x1)], tone, dress);
  const first = ring(x0).reverse();
  faces.push({ pts: first, n: [-1, 0, 0], tone, crease: 0.45 });
  return faces;
}

/* ---- roofs -------------------------------------------------------------------------- */

/**
 * A shingled gable roof: from `x0` to `x1` along its ridge, its eaves at `y0`
 * and `y1` and height `z0` (a fascia `t` deep), its ridge at `z1` over their
 * middle. The slopes are shingled in courses from the eaves up, the ridge
 * capped, and the gable ends boarded.
 */
export function gableRoof(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: Tone, seed: number, t = 0.55): Face[] {
  const ym = (y0 + y1) / 2;
  const outline: Pt[] = [[y0, z0], [y1, z0], [y1, z0 + t], [ym, z1], [y0, z0 + t]];
  const half = (x1 - x0) / 2;
  const end = (g: Ctx, k: PaintCtx): void => {
    // Boards up the gable, a seam between each, and the grain on them.
    g.save();
    g.translate(y0, z0);
    grain(g, k.fill, y1 - y0, z1 - z0, seed + 3, 'y', 0.6);
    for (let s = 0.95; s < y1 - y0 - 0.3; s += 0.95) {
      g.beginPath();
      g.moveTo(s, 0);
      g.lineTo(s, z1 - z0);
      g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.45), 0.7);
      g.lineWidth = 0.13;
      g.stroke();
    }
    g.restore();
    // A dark line under the fascia, where the roof sits out over the end.
    g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.35), 0.5);
    g.fillRect(y0, z0 + t, y1 - y0, 0.22);
  };
  const shingles = (fromEave: boolean, len: number, salt: number) => (g: Ctx, k: PaintCtx): void => {
    const T = rand(seed * 7 + salt);
    const step = 0.85;
    const dark = css(mix(k.fill, hex('#4a3448'), 0.55), 0.85), lit = css(mix(k.fill, [255, 246, 228], 0.45), 0.6);
    for (let r = 0, u = 0; u < len; r++, u += step) {
      // The butt of each course, a dark line with the light along its lower edge; the tabs between it and the next.
      const at = fromEave ? u : len - u;
      const tip = fromEave ? at + step : at - step;
      g.fillStyle = dark;
      g.fillRect(Math.min(at, at + (fromEave ? 0.14 : -0.14)), -half - 0.5, 0.14, 2 * half + 1);
      g.fillStyle = lit;
      g.fillRect(fromEave ? at + 0.14 : at - 0.28, -half - 0.5, 0.14, 2 * half + 1);
      for (let y = -half + ((r % 2) * 0.55) + T() * 0.2; y < half; y += 1.1 + T() * 0.15) {
        g.beginPath();
        g.moveTo(at, y);
        g.lineTo(tip, y);
        g.strokeStyle = css(mix(k.fill, hex('#4a3448'), 0.4), 0.55);
        g.lineWidth = 0.1;
        g.stroke();
        if (T() < 0.25) {
          g.fillStyle = css(mix(k.fill, T() < 0.5 ? [255, 248, 232] : hex('#6e5060'), 0.2), 0.5);
          g.fillRect(Math.min(at, tip), y + 0.08, step, 1);
        }
      }
    }
    // The ridge, capped: a band along the head of the slope.
    const head = fromEave ? len : 0;
    g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.25), 0.9);
    g.fillRect(fromEave ? head - 0.42 : head, -half - 0.5, 0.42, 2 * half + 1);
    g.fillStyle = css(mix(k.fill, [255, 248, 232], 0.4), 0.7);
    g.fillRect(fromEave ? head - 0.42 : head + 0.32, -half - 0.5, 0.1, 2 * half + 1);
  };
  const ends = deeper(tone, 0.14);
  return extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, x0, x1, tone, 0.12, {
    front: end,
    back: (g, k) => { g.save(); g.scale(-1, 1); end(g, k); g.restore(); },
    edge: (i) => {
      const p = outline[i], q = outline[(i + 1) % outline.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (i === 2) return { crease: 0.5, paint: shingles(true, len, 1) };
      if (i === 3) return { crease: 0.5, paint: shingles(false, len, 2) };
      return { crease: 0.45, paint: (g: Ctx, k: PaintCtx) => { g.save(); g.translate(0, -half); grain(g, k.fill, len, 2 * half, seed + i, 'y', 0.5); g.restore(); } };
    },
  }).map((f) => (Math.abs(f.n[0]) > 0.9 ? { ...f, tone: ends } : f));
}

/* ---- bees ------------------------------------------------------------------------------ */

/** A few of a swarm about a hive or a skep, at these points of it: gold, banded, their wings a pale blur. */
export function bees(at: V3[]): KitPart {
  return {
    reach: at,
    solid: false,
    draw: (g, e) => {
      for (const [i, p] of at.entries()) {
        const [x, y] = proj(e, p);
        g.fillStyle = 'rgba(244, 248, 255, 0.85)';
        g.beginPath();
        g.ellipse(x - 0.5, y - 0.65, 0.55, 0.32, -0.5, 0, TAU);
        g.ellipse(x + 0.5, y - 0.65, 0.55, 0.32, 0.5, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(x, y, 0.9, 0.58, i % 2 ? 0.2 : -0.2, 0, TAU);
        g.fillStyle = css(hex('#7a5a3c'));
        g.fill();
        g.beginPath();
        g.ellipse(x - 0.05, y - 0.05, 0.72, 0.44, i % 2 ? 0.2 : -0.2, 0, TAU);
        g.fillStyle = '#f2c94e';
        g.fill();
        g.fillStyle = css(hex('#6a4c3a'), 0.9);
        g.fillRect(x - 0.12, y - 0.48, 0.26, 0.92);
      }
    },
  };
}

/* ---- moss ---------------------------------------------------------------------------------- */

/** A piece's moss as its trim carries it (`mossTrim` in furniture.ts): how far on, nought to one, and how shady a side turned along (nx, ny) is. */
export interface Mossed { k: number; seed: number; shade: (nx: number, ny: number) => number }

/** Which way a piece faces, in the world: the way its front looks (`FRONT`) and its right hand (`ACROSS`), by `FACINGS`. */
const FRONT: Record<string, [number, number]> = { s: [0, 1], e: [1, 0], n: [0, -1], w: [-1, 0] };
const ACROSS: Record<string, [number, number]> = { s: [1, 0], e: [0, -1], n: [-1, 0], w: [0, 1] };

/** The moss a trim carries, or null for none: read exactly as the old model reads it (`mossOf` in furniture.ts). */
export function mossOf(trim: number | undefined): Mossed | null {
  if (!trim) return null;
  const stage = trim % 8;
  if (!stage) return null;
  const facing = FACINGS[Math.floor(trim / 8)] ?? 's';
  const [fx, fy] = FRONT[facing], [ax, ay] = ACROSS[facing];
  return {
    k: stage / 7,
    seed: stage,
    shade: (nx, ny) => 0.5 - 0.5 * ((nx * ax + ny * fx) + (nx * ay + ny * fy)) * Math.SQRT1_2,
  };
}
/** The trim of a piece's moss at `stage` (nought to seven), facing `facing` (`mossTrim`). */
export const mossAt = (stage: number, facing = 's'): number => Math.max(0, Math.min(7, stage)) + 8 * Math.max(0, FACINGS.indexOf(facing as never));

/** Pixels at zoom one across a unit of the model. */
const across = (e: Eye): number => Math.hypot(e.ux, e.uy);

/**
 * Moss over an upright face (four corners, foot first as `prism` winds them):
 * a fringe of cushions along its foot and a few along its head where the rain
 * sits, more and bigger on a side turned from the sun. Laid over the face,
 * let run past its edges.
 */
export function mossSide(m: Mossed, salt: number) {
  return (f: Face) => (g: Ctx, k: PaintCtx): void => {
    const amount = Math.min(1, m.k * (0.35 + 0.9 * m.shade(f.n[0], f.n[1])));
    if (amount <= 0.05) return;
    const [p0, p1, p2, p3] = f.pts;
    const w = Math.hypot(...sub(p1, p0)), h = Math.abs(p3[2] - p0[2]);
    const P = (u: number, v: number): V3 => {
      const lo = add(p0, mul(sub(p1, p0), u / w)), hi = add(p3, mul(sub(p2, p3), u / w));
      return add(lo, mul(sub(hi, lo), v / h));
    };
    const px = across(k.e), ps: Pad[] = [];
    for (let i = 0, s = 0.3; s < w - 0.3; i++, s += 0.75 * (0.8 + 0.4 * hashOf(salt, i, 1, 3))) {
      if (hashOf(salt, i, 2, 3) < amount) {
        const r = (0.42 + 0.4 * amount * hashOf(salt, i, 4, 3)) * px;
        const [x, y] = proj(k.e, P(s, 0.15 + 0.35 * hashOf(salt, i, 3, 3) * amount));
        ps.push([x, y, Math.max(0.6, r), Math.max(0.6, r) * 0.86]);
      }
      if (hashOf(salt, i, 5, 3) < amount * 0.4) {
        const r = (0.35 + 0.3 * amount) * px;
        const [x, y] = proj(k.e, P(s, h - 0.25));
        ps.push([x, y, Math.max(0.6, r), Math.max(0.6, r) * 0.86]);
      }
    }
    g.save();
    g.setTransform(k.base);
    drawPads(g, ps);
    g.restore();
  };
}

/** Moss over a level top from `x0` to `x1` and `y0` to `y1` at `z`: cushions along its edges, spreading in from them as it ages, thickest on the edges turned from the sun. */
export function mossTop(m: Mossed, salt: number, x0: number, x1: number, y0: number, y1: number, z: number) {
  return (g: Ctx, k: PaintCtx): void => {
    const w = x1 - x0, h = y1 - y0;
    const edges: Array<[number, number, (u: number, d: number) => [number, number], number]> = [
      [0, -1, (u, d) => [x0 + u, y0 + d], w], [0, 1, (u, d) => [x0 + u, y1 - d], w],
      [-1, 0, (u, d) => [x0 + d, y0 + u], h], [1, 0, (u, d) => [x1 - d, y0 + u], h],
    ];
    const px = across(k.e), ps: Pad[] = [];
    edges.forEach(([nx, ny, P, len], e) => {
      const amount = Math.min(1, m.k * (0.3 + 0.95 * m.shade(nx, ny)));
      for (let i = 0, u = 0.35; u < len - 0.35; i++, u += 0.7 * (0.8 + 0.4 * hashOf(salt, e, i, 7))) {
        if (hashOf(salt, e, i, 8) > amount) continue;
        const [x, y] = P(u, 0.3 + 0.5 * amount * hashOf(salt, e, i, 9));
        const r = Math.max(0.6, (0.4 + 0.45 * amount * hashOf(salt, e, i, 10)) * px);
        const [sx, sy] = proj(k.e, [x, y, z]);
        ps.push([sx, sy, r, r * 0.56]);
      }
    });
    g.save();
    g.setTransform(k.base);
    drawPads(g, ps);
    g.restore();
  };
}

/** A cushion of moss sitting on something at `at`, `r` units across (a statue's head and shoulders). */
export function mossCushion(at: V3, r: number): KitPart {
  return {
    reach: [add(at, [0, 0, r * 0.5]), add(at, [-r, -r, 0]), add(at, [r, r, 0])],
    solid: false,
    draw: (g, e) => {
      const [x, y] = proj(e, at);
      const R = r * across(e);
      drawPads(g, [[x - R * 0.3, y - R * 0.2, R * 0.7, R * 0.48], [x + R * 0.35, y - R * 0.12, R * 0.6, R * 0.42], [x, y - R * 0.38, R * 0.75, R * 0.5]]);
    },
  };
}

/** Faces with `over` laid on those a rule picks: moss on a slab's sides and top. */
export function overlaid(faces: Face[], pick: (f: Face) => ((g: Ctx, k: PaintCtx) => void) | undefined): Face[] {
  return faces.map((f) => {
    const o = pick(f);
    if (!o) return f;
    const was = f.over;
    return { ...f, frame: f.frame ?? { o: centre(f.pts), a: [1, 0, 0], b: [0, 1, 0] }, over: was ? (g, k) => { was(g, k); o(g, k); } : o };
  });
}
