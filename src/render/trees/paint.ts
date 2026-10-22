/**
 * The shared tree painters: wood, leaf clumps, conifer tiers, hanging
 * strands, fruit and bare branches. Each one takes plain geometry
 * (`./types`) and paints it lit from `LIT`, so a species file only ever
 * chooses numbers and never draws.
 *
 * Kept to flat fills of a few hundred shapes at most a tree: no per-pixel
 * work, no blur, no gradients. Every tree of a species and age is one baked
 * sprite, but a wood still paints hundreds of them whenever the look of the
 * season turns over.
 */
import { LIT, TAU, mix, tone, wob } from './kit';
import type { ClusterLook, Cluster, Limb, Strand, Tier, Tones } from './types';

const LN = Math.hypot(LIT.x, LIT.y);
/** The light's direction as a unit vector. */
export const LX = LIT.x / LN;
export const LY = LIT.y / LN;

/**
 * Five tones out of a crown's three: a cool shadow under the deep one and a
 * warm highlight over the lit one. A clump is painted in three neighbours of
 * these, picked by which way it faces, so a crown has five values in it
 * without any one clump having more than three.
 */
export type Ramp = readonly [shadow: string, deep: string, mid: string, light: string, high: string];
export function rampOf(t: Tones): Ramp {
  return [mix(tone(t[2], -0.28), '#1d3940', 0.25), t[2], t[1], t[0], mix(t[0], '#fff7d6', 0.3)];
}

/* ---- Wood ------------------------------------------------------------------- */

/** A tapered limb as one closed outline, for filling. */
export function limbPath(ctx: CanvasRenderingContext2D, l: Limb, grow = 0, dx = 0, dy = 0): void {
  const n = (ax: number, ay: number, bx: number, by: number): [number, number] => {
    const d = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / d, (bx - ax) / d];
  };
  const [n0x, n0y] = n(l.x0, l.y0, l.cx, l.cy);
  const [n1x, n1y] = n(l.cx, l.cy, l.x1, l.y1);
  const [nmx, nmy] = n(l.x0, l.y0, l.x1, l.y1);
  const w0 = l.w0 + grow;
  const w1 = l.w1 + grow;
  const wm = (w0 + w1) / 2;
  ctx.moveTo(l.x0 + n0x * w0 + dx, l.y0 + n0y * w0 + dy);
  ctx.quadraticCurveTo(l.cx + nmx * wm + dx, l.cy + nmy * wm + dy, l.x1 + n1x * w1 + dx, l.y1 + n1y * w1 + dy);
  ctx.lineTo(l.x1 - n1x * w1 + dx, l.y1 - n1y * w1 + dy);
  ctx.quadraticCurveTo(l.cx - nmx * wm + dx, l.cy - nmy * wm + dy, l.x0 - n0x * w0 + dx, l.y0 - n0y * w0 + dy);
  ctx.closePath();
}

/**
 * Limbs in two passes over all of them at once: the wood in its shaded
 * tone, then a narrower copy slid toward the light in the lit one, so every
 * limb has a lit flank and a dark one for the cost of two fills.
 */
export function paintLimbs(ctx: CanvasRenderingContext2D, limbs: readonly Limb[], bark: string, shaded = 0.3): void {
  if (!limbs.length) return;
  ctx.fillStyle = tone(bark, -shaded);
  ctx.beginPath();
  for (const l of limbs) {
    limbPath(ctx, l);
    // A round end, not a sawn one.
    ctx.moveTo(l.x1 + l.w1, l.y1);
    ctx.arc(l.x1, l.y1, l.w1, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = tone(bark, -shaded * 0.25);
  ctx.beginPath();
  for (const l of limbs) {
    const k = 0.5;
    limbPath(ctx, { ...l, w0: l.w0 * k, w1: l.w1 * k }, 0, LX * l.w0 * 0.4, LY * l.w0 * 0.3);
  }
  ctx.fill();
}

/** A trunk's two edges, sampled from the foot up; what its outline, its shading and its marks are all laid off. */
export interface Bole {
  lx: number[];
  rx: number[];
  y: number[];
}

/**
 * The trunk's edges: tapering from foot to top, flared into the roots, bent
 * by its lean and, with `gnarl`, swelling and pinching along its length.
 */
export function boleOf(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number,
  flare: number, gnarl: number, seed: number): Bole {
  const n = 9;
  const lx: number[] = [];
  const rx: number[] = [];
  const y: number[] = [];
  const bend = (wob(seed, 501) - 0.5) * w0 * (0.8 + gnarl * 1.1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t + bend * Math.sin(Math.PI * t)
      + gnarl * w0 * 0.18 * Math.sin(t * 6 + seed) * (1 - t * 0.8);
    const w = w0 + (w1 - w0) * Math.pow(t, 0.8);
    const foot = (flare - 1) * w0 * Math.exp(-t * 11);
    const swell = (k: number): number => 1 + gnarl * 0.2 * Math.sin(t * (9 + k) + seed * (1.3 + k)) * (wob(seed, 510 + i + k * 20) + 0.3);
    lx.push(cx - w * swell(0) - foot * (0.9 + 0.2 * wob(seed, 530)));
    rx.push(cx + w * swell(1) + foot * (0.9 + 0.2 * wob(seed, 531)));
    y.push(y0 + (y1 - y0) * t);
  }
  return { lx, rx, y };
}

/** The bole's outline, or the band of it between `a` and `b` across (0 its left edge, 1 its right). */
export function bolePath(ctx: CanvasRenderingContext2D, b: Bole, a = 0, c = 1): void {
  const n = b.y.length;
  const at = (i: number, k: number): number => b.lx[i] + (b.rx[i] - b.lx[i]) * k;
  ctx.moveTo(at(0, a), b.y[0]);
  for (let i = 1; i < n - 1; i++) {
    ctx.quadraticCurveTo(at(i, a), b.y[i], (at(i, a) + at(i + 1, a)) / 2, (b.y[i] + b.y[i + 1]) / 2);
  }
  ctx.lineTo(at(n - 1, a), b.y[n - 1]);
  ctx.lineTo(at(n - 1, c), b.y[n - 1]);
  for (let i = n - 2; i > 0; i--) {
    ctx.quadraticCurveTo(at(i, c), b.y[i], (at(i, c) + at(i - 1, c)) / 2, (b.y[i] + b.y[i - 1]) / 2);
  }
  ctx.lineTo(at(0, c), b.y[0]);
  // The foot is not cut off flat: it sits a little into the ground in the middle.
  const mid = (at(0, a) + at(0, c)) / 2;
  ctx.quadraticCurveTo(mid, b.y[0] + (b.rx[0] - b.lx[0]) * 0.08, at(0, a), b.y[0]);
  ctx.closePath();
}

/**
 * The trunk: roots, the bole in three bands of one bark (the lit flank, the
 * body, the shaded flank), and its marks. `marks` is the species' bark:
 * birch's dark dashes on white, furrows running up a rough bark, or nothing.
 */
export function paintTrunk(ctx: CanvasRenderingContext2D, b: Bole, bark: string, seed: number,
  marks: 'birch' | 'furrows' | 'smooth', roots: number, markInk?: string): void {
  const n = b.y.length;
  const w0 = (b.rx[2] - b.lx[2]) / 2;
  // Roots: knuckles running out from the flare along the ground.
  if (roots > 0) {
    ctx.fillStyle = tone(bark, -0.12);
    ctx.beginPath();
    for (let i = 0; i < roots; i++) {
      const side = i % 2 ? 1 : -1;
      const reach = w0 * (1.2 + 0.9 * wob(seed, 540 + i));
      const from = side > 0 ? b.rx[1] - w0 * 0.3 : b.lx[1] + w0 * 0.3;
      const fy = b.y[0] - w0 * 0.5;
      limbPath(ctx, {
        x0: from, y0: fy, cx: from + side * reach * 0.5, cy: b.y[0] - w0 * 0.15,
        x1: from + side * reach, y1: b.y[0] + w0 * 0.12 * (wob(seed, 550 + i) - 0.3),
        w0: w0 * 0.42, w1: w0 * 0.1,
      });
    }
    ctx.fill();
  }
  ctx.fillStyle = bark;
  ctx.beginPath();
  bolePath(ctx, b);
  ctx.fill();
  ctx.fillStyle = tone(bark, -0.26);
  ctx.beginPath();
  bolePath(ctx, b, 0.58, 1);
  ctx.fill();
  ctx.fillStyle = mix(bark, '#fff8e8', 0.22);
  ctx.beginPath();
  bolePath(ctx, b, 0.06, 0.3);
  ctx.fill();
  if (marks === 'smooth') return;
  ctx.save();
  ctx.beginPath();
  bolePath(ctx, b);
  ctx.clip();
  if (marks === 'birch') {
    // Lenticels: short dark dashes across the white, and a darker patch or two near the foot.
    ctx.fillStyle = markInk ?? '#3b3532';
    ctx.beginPath();
    const count = 6 + Math.round((b.y[0] - b.y[n - 1]) / 5);
    for (let i = 0; i < count; i++) {
      const t = wob(seed, 560 + i) * 0.95;
      const k = Math.min(n - 2, Math.floor(t * (n - 1)));
      const y = b.y[k] + (b.y[k + 1] - b.y[k]) * (t * (n - 1) - k);
      const l = b.lx[k];
      const w = b.rx[k] - l;
      const s = wob(seed, 600 + i) * 0.7;
      const len = w * (0.18 + 0.4 * wob(seed, 640 + i));
      const h = Math.max(0.35, w * 0.05);
      const x = l + w * s;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y - h * 1.4, x + len, y);
      ctx.quadraticCurveTo(x + len * 0.5, y + h * 0.8, x, y);
    }
    ctx.fill();
  } else {
    // Furrows: a few dark lines running up the bole, following its edges.
    ctx.strokeStyle = markInk ?? tone(bark, -0.42);
    ctx.lineWidth = Math.max(0.3, w0 * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let f = 0; f < 4; f++) {
      const k = 0.2 + f * 0.2 + (wob(seed, 680 + f) - 0.5) * 0.1;
      const from = Math.floor(wob(seed, 690 + f) * 3);
      const to = n - 1 - Math.floor(wob(seed, 700 + f) * 4);
      for (let i = from; i <= to; i++) {
        const x = b.lx[i] + (b.rx[i] - b.lx[i]) * (k + Math.sin(i * 1.7 + f) * 0.04);
        if (i === from) ctx.moveTo(x, b.y[i]);
        else ctx.lineTo(x, b.y[i]);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A hollow low in the bole: a dark mouth with a lit lip under it. */
export function paintHollow(ctx: CanvasRenderingContext2D, b: Bole, bark: string, at = 0.3): void {
  const n = b.y.length;
  const i = Math.max(1, Math.min(n - 2, Math.round(at * (n - 1))));
  const w = b.rx[i] - b.lx[i];
  const x = b.lx[i] + w * 0.52;
  const y = b.y[i];
  ctx.fillStyle = mix(bark, '#fff4dc', 0.3);
  ctx.beginPath();
  ctx.ellipse(x - w * 0.02, y + w * 0.05, w * 0.24, w * 0.4, 0.08, 0, TAU);
  ctx.fill();
  ctx.fillStyle = tone(bark, -0.66);
  ctx.beginPath();
  ctx.ellipse(x + w * 0.02, y - w * 0.02, w * 0.18, w * 0.33, 0.08, 0, TAU);
  ctx.fill();
}

/**
 * Bare wood: from each limb's end, forks of twigs growing on up and out,
 * held inside `reach` (the crown's ellipse, a little enlarged). Gathered by
 * depth so the whole of it is one stroke per weight of twig.
 */
export function paintTwigs(ctx: CanvasRenderingContext2D, from: readonly Limb[], depth: number, colour: string,
  reach: { cx: number; cy: number; rx: number; ry: number }, seed: number, spread = 0.52, shrink = 0.7): void {
  if (depth <= 0 || !from.length) return;
  const levels: number[][] = Array.from({ length: depth }, () => []);
  const widths: number[] = Array.from({ length: depth }, () => 0);
  let k = 0;
  const grow = (x: number, y: number, a: number, len: number, w: number, d: number): void => {
    k++;
    // Held inside the crown: a twig that would leave it is shortened along
    // its own line, and one that starts outside is not grown at all. Pulled
    // onto the edge instead, every tip lined up along an arc.
    const outside = (px: number, py: number): boolean =>
      ((px - reach.cx) / reach.rx) ** 2 + ((py - reach.cy) / reach.ry) ** 2 > 1;
    if (d > 0 && outside(x, y)) return;
    let ex = x + Math.cos(a) * len;
    let ey = y + Math.sin(a) * len;
    for (let tries = 0; tries < 4 && outside(ex, ey); tries++) {
      len *= 0.7;
      ex = x + Math.cos(a) * len;
      ey = y + Math.sin(a) * len;
    }
    if (outside(ex, ey) && d > 0) return;
    levels[d].push(x, y, ex, ey);
    widths[d] = Math.max(widths[d], w);
    if (d + 1 >= depth) return;
    const kids = d === 0 && wob(seed, 800 + k) > 0.4 ? 3 : 2;
    for (let j = 0; j < kids; j++) {
      const off = (j - (kids - 1) / 2) * spread * (0.75 + 0.5 * wob(seed, 820 + k * 3 + j));
      let na = a + off;
      // Wood grows toward the light: every fork pulls a little toward straight up.
      na += (-Math.PI / 2 - na) * 0.08;
      grow(ex, ey, na, len * shrink * (0.82 + 0.36 * wob(seed, 860 + k * 3 + j)), w * 0.66, d + 1);
    }
  };
  for (const l of from) {
    const a = Math.atan2(l.y1 - l.cy, l.x1 - l.cx);
    const len = Math.hypot(l.x1 - l.x0, l.y1 - l.y0) * 0.5;
    grow(l.x1, l.y1, a, len, l.w1 * 1.3, 0);
  }
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  for (let d = 0; d < depth; d++) {
    const s = levels[d];
    if (!s.length) continue;
    ctx.lineWidth = Math.max(0.3, widths[d]);
    ctx.beginPath();
    for (let i = 0; i < s.length; i += 4) {
      ctx.moveTo(s[i], s[i + 1]);
      ctx.lineTo(s[i + 2], s[i + 3]);
    }
    ctx.stroke();
  }
}

/* ---- Leaf ------------------------------------------------------------------- */

/**
 * One clump of leaf as a closed outline: a scalloped puff, a many-pointed
 * star, or single leaves radiating from a middle.
 */
export function clusterPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: ClusterLook, seed: number): void {
  const rot = wob(seed, 1) * TAU;
  const k = look.lobes;
  if (look.style === 'puff') {
    // Bumps between notches, as one scalloped outline of curves: built of
    // arcs it was a dozen circles a clump, and arcs are the dearest thing to
    // put in a path.
    const half = Math.PI / k;
    const rn = r * (1 - 0.3 * look.depth);
    const rc = 2 * r - rn * Math.cos(half);
    const sx = x + Math.cos(rot) * rn;
    const sy = y + Math.sin(rot) * rn * 0.9;
    ctx.moveTo(sx, sy);
    for (let j = 0; j < k; j++) {
      const a = rot + (j / k) * TAU;
      const bump = rc * (0.9 + 0.2 * wob(seed, j + 2));
      const nr = rn * (0.94 + 0.12 * wob(seed, j + 12));
      const na = a + half * 2;
      ctx.quadraticCurveTo(x + Math.cos(a + half) * bump, y + Math.sin(a + half) * bump * 0.9,
        j === k - 1 ? sx : x + Math.cos(na) * nr, j === k - 1 ? sy : y + Math.sin(na) * nr * 0.9);
    }
    ctx.closePath();
    return;
  }
  if (look.style === 'star') {
    // Pointed lobes, each a convex blade between two notches: a maple's leaf
    // drawn at the size of a clump.
    const inner = r * (1 - 0.5 * look.depth);
    const half = Math.PI / k;
    const notch = (j: number): [number, number] => {
      const a = rot + (j / k) * TAU - half;
      return [x + Math.cos(a) * inner, y + Math.sin(a) * inner * 0.92];
    };
    const [sx, sy] = notch(0);
    ctx.moveTo(sx, sy);
    for (let j = 0; j < k; j++) {
      const a = rot + (j / k) * TAU;
      const rr = r * (0.86 + 0.2 * wob(seed, j + 2));
      const tx = x + Math.cos(a) * rr;
      const ty = y + Math.sin(a) * rr * 0.92;
      const bulge = (r + inner) * 0.5;
      ctx.quadraticCurveTo(x + Math.cos(a - half * 0.75) * bulge, y + Math.sin(a - half * 0.75) * bulge * 0.92, tx, ty);
      const [nx, ny] = notch(j + 1);
      ctx.quadraticCurveTo(x + Math.cos(a + half * 0.75) * bulge, y + Math.sin(a + half * 0.75) * bulge * 0.92, nx, ny);
    }
    ctx.closePath();
    return;
  }
  const len = r * 0.5 * (look.leaf ?? 1);
  const wide = len * (look.slim ?? 0.4);
  roundPath(ctx, x, y, r * 0.44);
  for (let j = 0; j < k; j++) {
    const a = rot + ((j + 0.3 * wob(seed, j + 7)) / k) * TAU;
    const d = r - len * (0.95 + 0.15 * wob(seed, j + 2));
    leafPath(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.92, len, wide, a);
  }
}

/** A near-circle of four curves: cheaper than an arc wherever exactness does not show. */
export function roundPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.quadraticCurveTo(x + r, y + r, x, y + r);
  ctx.quadraticCurveTo(x - r, y + r, x - r, y);
  ctx.quadraticCurveTo(x - r, y - r, x, y - r);
  ctx.quadraticCurveTo(x + r, y - r, x + r, y);
  ctx.closePath();
}

/**
 * One leaf, `len` from its middle to either end and `wide` across, along
 * angle `a`: broad toward its stalk and drawn out to a point, so it reads as
 * a leaf and not as a lozenge.
 */
export function leafPath(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, wide: number, a: number): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy * wide * 1.5;
  const ny = ux * wide * 1.5;
  const bx = x - ux * len;
  const by = y - uy * len;
  const tx = x + ux * len;
  const ty = y + uy * len;
  ctx.moveTo(bx, by);
  ctx.bezierCurveTo(bx + nx - ux * len * 0.15, by + ny - uy * len * 0.15, x + nx + ux * len * 0.25, y + ny + uy * len * 0.25, tx, ty);
  ctx.bezierCurveTo(x - nx + ux * len * 0.25, y - ny + uy * len * 0.25, bx - nx - ux * len * 0.15, by - ny - uy * len * 0.15, bx, by);
  ctx.closePath();
}

/**
 * Single leaves standing out of clumps' edges, gathered by colour so a whole
 * crown of them is a handful of fills. Laid after the clumps they belong to,
 * so a leaf may lie over the next clump along, which is what leaves do.
 */
export class Flecks {
  private readonly by = new Map<string, number[]>();
  add(colour: string, x: number, y: number, len: number, tilt: number): void {
    let list = this.by.get(colour);
    if (!list) this.by.set(colour, (list = []));
    list.push(x, y, len, tilt);
  }
  flush(ctx: CanvasRenderingContext2D): void {
    for (const [colour, l] of this.by) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (let i = 0; i < l.length; i += 4) leafPath(ctx, l[i], l[i + 1], l[i + 2], l[i + 2] * 0.42, l[i + 3]);
      ctx.fill();
    }
    this.by.clear();
  }
}

const LIT_PUFF: ClusterLook = { style: 'puff', lobes: 9, depth: 0.5 };

/**
 * One clump in three tones by one light, with no clipping: the whole of it
 * in the deepest tone, a slightly smaller copy slid up-sun in the middle
 * tone, which leaves a crescent of the deep one along its shaded edge, and a
 * small copy high on its sunward shoulder in the lit tone. The copies keep
 * the clump's own scallops, so its light is broken the way its edge is.
 * Then single leaves on its rim, lit ones toward the sun and dark ones under
 * it, so its outline is leaf and not a bubble.
 */
export function paintCluster(ctx: CanvasRenderingContext2D, c: Cluster, deep: string, mid: string, light: string,
  look: ClusterLook, seed: number, flecks?: Flecks, shoulder = true): void {
  const s = seed + c.seed * 3.7;
  ctx.fillStyle = deep;
  ctx.beginPath();
  clusterPath(ctx, c.x, c.y, c.r, look, s);
  ctx.fill();
  ctx.fillStyle = mid;
  ctx.beginPath();
  clusterPath(ctx, c.x + LX * c.r * 0.14, c.y + LY * c.r * 0.14, c.r * 0.86, look, s);
  ctx.fill();
  if (shoulder) {
    ctx.fillStyle = light;
    ctx.beginPath();
    // The lit shoulder of a clump of single leaves is a soft scallop: the
    // leaves already show at its edge, and drawing them a third time is waste.
    clusterPath(ctx, c.x + LX * c.r * 0.36, c.y + LY * c.r * 0.38, c.r * 0.56, look.style === 'leaves' ? LIT_PUFF : look, s + 0.5);
    ctx.fill();
  }
  // A clump of single leaves has its leaves at its edge already.
  const n = look.flecks ?? (look.style === 'leaves' ? 0 : 3);
  if (n <= 0 || c.r < 1.2) return;
  const own = flecks ?? new Flecks();
  const sun = Math.atan2(LY, LX);
  const leafAt = (colour: string, i: number, a: number, k: number): void => {
    const d = c.r * (0.86 + 0.12 * wob(s, 70 + i));
    own.add(colour, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.92, c.r * 0.2 * k, a + (wob(s, 90 + i) - 0.5) * 1.2);
  };
  for (let i = 0; i < n; i++) leafAt(light, i, sun + ((i + 0.5) / n - 0.5) * 2.4 + (wob(s, 50 + i) - 0.5) * 0.4, 1);
  for (let i = 0; i < n - 1; i++) leafAt(deep, i + 20, sun + Math.PI + ((i + 0.5) / (n - 1) - 0.5) * 2 + (wob(s, 60 + i) - 0.5) * 0.4, 0.9);
  if (!flecks) own.flush(ctx);
}

/** Single flowers dotted over a clump in bloom, each with its eye where the kind has one that shows. */
export function paintFlowers(ctx: CanvasRenderingContext2D, cs: readonly Cluster[], pale: string, eye: string | null,
  seed: number, dot: number): void {
  ctx.fillStyle = pale;
  ctx.beginPath();
  const at: number[] = [];
  for (const c of cs) {
    const n = 2 + Math.round(wob(seed, 900 + c.seed) * 2);
    for (let i = 0; i < n; i++) {
      const a = wob(seed, 910 + c.seed * 5 + i) * TAU;
      const d = c.r * 0.62 * Math.sqrt(wob(seed, 930 + c.seed * 5 + i));
      const x = c.x + Math.cos(a) * d + LX * c.r * 0.2;
      const y = c.y + Math.sin(a) * d + LY * c.r * 0.2;
      ctx.moveTo(x + dot, y);
      ctx.arc(x, y, dot, 0, TAU);
      at.push(x, y);
    }
  }
  ctx.fill();
  if (!eye) return;
  ctx.fillStyle = eye;
  ctx.beginPath();
  for (let i = 0; i < at.length; i += 2) {
    ctx.moveTo(at[i] + dot * 0.4, at[i + 1]);
    ctx.arc(at[i], at[i + 1], dot * 0.4, 0, TAU);
  }
  ctx.fill();
}

/* ---- Fruit ------------------------------------------------------------------ */

/**
 * Small fruit: a dot in its colour on a shaded underside, with a fleck of
 * light on the lit shoulder. Kept small on purpose -- a fruit the size of a
 * clump of leaf reads as a bauble hung on the tree.
 */
export function paintFruit(ctx: CanvasRenderingContext2D, spots: ReadonlyArray<readonly [number, number]>, r: number,
  colour: string, shape: 'round' | 'pear' | 'oval'): void {
  if (!spots.length) return;
  const body = (dx: number, dy: number, k: number): void => {
    for (const [x, y] of spots) {
      const px = x + dx;
      const py = y + dy;
      if (shape === 'oval') {
        ctx.moveTo(px + r * 0.82 * k, py);
        ctx.ellipse(px, py, r * 0.82 * k, r * 1.08 * k, 0.25, 0, TAU);
      } else {
        ctx.moveTo(px + r * k, py);
        ctx.arc(px, py, r * k, 0, TAU);
        if (shape === 'pear') {
          ctx.moveTo(px - r * 0.12 + r * 0.6 * k, py - r * 0.85);
          ctx.arc(px - r * 0.12, py - r * 0.85, r * 0.6 * k, 0, TAU);
        }
      }
    }
  };
  ctx.fillStyle = tone(colour, -0.38);
  ctx.beginPath();
  body(r * 0.16, r * 0.18, 1.04);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  body(-r * 0.06, -r * 0.08, 0.84);
  ctx.fill();
  ctx.fillStyle = mix(colour, '#ffffff', 0.62);
  ctx.beginPath();
  for (const [x, y] of spots) {
    const hx = x - r * 0.36;
    const hy = y - r * 0.4;
    ctx.moveTo(hx + r * 0.26, hy);
    ctx.arc(hx, hy, r * 0.26, 0, TAU);
  }
  ctx.fill();
}

/* ---- Conifer ---------------------------------------------------------------- */

/**
 * One tier of boughs: off the leader at its top, sweeping out and down to
 * drooping tips, with a ragged hem of hanging bough-ends between them.
 */
export function tierPath(ctx: CanvasRenderingContext2D, t: Tier, dx = 0, dy = 0): void {
  const ax = t.ax + dx;
  const top = t.top + dy;
  const bot = t.bottom + dy;
  const h = bot - top;
  const reach = Math.max(t.left, t.right);
  const tips = Math.max(4, Math.round((t.left + t.right) / (h * 0.4)));
  const rx = ax + t.right;
  const ry = bot + t.droop * (0.9 + 0.2 * wob(t.seed, 1));
  const ly = bot + t.droop * (0.9 + 0.2 * wob(t.seed, 2));
  ctx.moveTo(ax, top);
  ctx.bezierCurveTo(ax + t.right * 0.22, top + h * 0.18, ax + t.right * 0.62, top + h * 0.45, rx, ry);
  for (let j = 1; j <= tips; j++) {
    const u = j / tips;
    const x = rx - u * (t.left + t.right);
    const sag = t.droop * Math.pow(Math.abs(x - ax) / reach, 1.4);
    const y = j === tips ? ly : bot + sag + h * 0.1 * (wob(t.seed, j + 10) - 0.3);
    const mx = rx - (u - 0.5 / tips) * (t.left + t.right);
    const msag = t.droop * Math.pow(Math.abs(mx - ax) / reach, 1.4);
    ctx.quadraticCurveTo(mx, bot + msag - h * (0.14 + 0.1 * wob(t.seed, j + 30)), x, y);
  }
  ctx.bezierCurveTo(ax - t.left * 0.62, top + h * 0.45, ax - t.left * 0.22, top + h * 0.18, ax, top);
  ctx.closePath();
}

/**
 * A tier in three tones: its underside in the deep one, the body above it,
 * and the sunward shoulder lit -- then a few strokes of needles catching the
 * light along the top of the lit side.
 */
export function paintTier(ctx: CanvasRenderingContext2D, t: Tier, r: Ramp, lit: number): void {
  const h = t.bottom - t.top;
  const up = lit > 0.4 ? 1 : 0;
  ctx.fillStyle = r[up];
  ctx.beginPath();
  tierPath(ctx, t);
  ctx.fill();
  // No clip: the body is the tier again, a little shorter, so the deep tone
  // is left along its hem; the light a smaller tier on its sunward shoulder.
  ctx.fillStyle = r[up + 1];
  ctx.beginPath();
  tierPath(ctx, { ...t, top: t.top + h * 0.02, bottom: t.bottom - h * 0.24, left: t.left * 0.95, right: t.right * 0.93, droop: t.droop * 0.85 });
  ctx.fill();
  ctx.fillStyle = r[up + 2];
  ctx.beginPath();
  tierPath(ctx, { ...t, ax: t.ax - t.left * 0.12, top: t.top + h * 0.08, bottom: t.bottom - h * 0.42, left: t.left * 0.7, right: t.right * 0.25, droop: t.droop * 0.6 });
  ctx.fill();
  // Bough-ends: small drooping tufts across the tier, lit on the sunward
  // half and shaded on the other, so a tier reads as boughs and not a skirt.
  const tufts = 2 + Math.round((t.left + t.right) / Math.max(1, h * 1.3));
  for (const sun of [true, false]) {
    ctx.fillStyle = sun ? r[lit > 0.75 ? 4 : 3] : r[up + 1];
    ctx.beginPath();
    for (let i = 0; i < tufts; i++) {
      const u = (i + 0.5) / tufts;
      const x = t.ax - t.left * 0.82 + (t.left + t.right) * 0.82 * u + (wob(t.seed, 80 + i) - 0.5) * h * 0.25;
      if ((x < t.ax) !== sun) continue;
      const reach = Math.min(1, Math.abs(x - t.ax) / Math.max(t.left, t.right));
      const ty = t.top + h * (0.3 + 0.4 * reach) + (wob(t.seed, 90 + i) - 0.5) * h * 0.15;
      const tw = h * (0.3 + 0.12 * wob(t.seed, 100 + i)) * (1 - 0.3 * reach);
      tierPath(ctx, { ax: x, top: ty - tw * 0.7, bottom: ty + tw * 0.2, left: tw, right: tw, droop: tw * 0.45, seed: t.seed + i * 3.1 });
    }
    ctx.fill();
  }
  // Needle strokes: short dashes slanting down the lit shoulder.
  ctx.strokeStyle = r[4];
  ctx.lineWidth = Math.max(0.3, h * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 2 + Math.round((t.left + t.right) / Math.max(1, h * 1.4));
  for (let i = 0; i < n; i++) {
    const u = (i + wob(t.seed, 40 + i) * 0.6) / n;
    const x = t.ax - t.left * (0.12 + 0.7 * u);
    const y = t.top + h * (0.22 + 0.4 * u) + (wob(t.seed, 60 + i) - 0.5) * h * 0.15;
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.24, y + h * 0.2);
  }
  ctx.stroke();
}

/* ---- Weeping ---------------------------------------------------------------- */

/** Where a strand is `t` of the way down: out from its root, then hanging. */
function strandAt(s: Strand, t: number): [number, number] {
  const u = 1 - t;
  const x0 = s.x;
  const x1 = s.x + s.arch;
  const x2 = s.x + s.arch + s.sway * 0.5;
  const x3 = s.x + s.arch + s.sway;
  const y0 = s.y;
  const y1 = s.y - s.len * 0.04;
  const y2 = s.y + s.len * 0.45;
  const y3 = s.y + s.len;
  return [
    u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  ];
}

/** One hanging strand: thick where it leaves the crown, ragged with leaf, coming to nothing. */
export function strandPath(ctx: CanvasRenderingContext2D, s: Strand, k = 1, dx = 0): void {
  const n = 11;
  const lx: number[] = [];
  const ly: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  let [px, py] = strandAt(s, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = strandAt(s, Math.min(1, t + 0.02));
    const [qx, qy] = i === 0 ? [x, y] : [px, py];
    const [cx, cy] = strandAt(s, t);
    const tx = x - qx || 0.0001;
    const ty = y - qy || 1;
    const l = Math.hypot(tx, ty);
    // Leaves either side, alternating, so the edge is ragged and not a ribbon.
    const w = s.w * k * (1 - 0.65 * t);
    const a = w * (i % 2 ? 1.6 : 0.5);
    const b = w * (i % 2 ? 0.5 : 1.6);
    lx.push(cx + dx - (ty / l) * a);
    ly.push(cy + (tx / l) * a);
    rx.push(cx + dx + (ty / l) * b);
    ry.push(cy - (tx / l) * b);
    px = cx;
    py = cy;
  }
  ctx.moveTo(lx[0], ly[0]);
  for (let i = 1; i <= n; i++) ctx.lineTo(lx[i], ly[i]);
  const [ex, ey] = strandAt(s, 1);
  ctx.lineTo(ex + dx, ey + s.w * 1.4);
  for (let i = n; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
  ctx.closePath();
}

/** Strands in one tone each pass, with a lit edge down their sunward side. */
export function paintStrands(ctx: CanvasRenderingContext2D, ss: readonly Strand[], body: string, lit: string): void {
  if (!ss.length) return;
  ctx.fillStyle = body;
  ctx.beginPath();
  for (const s of ss) strandPath(ctx, s);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  for (const s of ss) strandPath(ctx, s, 0.42, -s.w * 0.5);
  ctx.fill();
}

/** Withies: the bare whips of a weeping crown with its leaf down. */
export function paintWithies(ctx: CanvasRenderingContext2D, ss: readonly Strand[], colour: string, width: number): void {
  if (!ss.length) return;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of ss) {
    ctx.moveTo(s.x, s.y);
    ctx.bezierCurveTo(s.x + s.arch, s.y - s.len * 0.04, s.x + s.arch + s.sway * 0.5, s.y + s.len * 0.45, s.x + s.arch + s.sway, s.y + s.len);
  }
  ctx.stroke();
}

/* ---- Ground ----------------------------------------------------------------- */

/**
 * What has come down under a tree and lies there: petals through its spring
 * in flower, leaves on the days its crown is thinning. Close round the foot
 * and kept inside the tree's own tile, so the ground drawn in front of it
 * never cuts the edge of it off.
 */
export function paintLitter(ctx: CanvasRenderingContext2D, bx: number, by: number, reach: number, seed: number,
  tones: readonly [string, string, string], n: number, leaf: boolean): void {
  const rx = Math.min(16, reach);
  const ry = rx * 0.48;
  for (let i = 0; i < n; i++) {
    const a = wob(seed, 3300 + i) * TAU;
    const d = 0.25 + 0.75 * Math.sqrt(wob(seed, 3400 + i));
    const len = (leaf ? 1.9 : 1.45) * (0.8 + 0.5 * wob(seed, 3500 + i));
    ctx.fillStyle = leaf ? tones[i % 3] : tones[i % 3 === 0 ? 0 : 1];
    ctx.beginPath();
    ctx.ellipse(bx + Math.cos(a) * rx * d, by + Math.sin(a) * ry * d, len, len * 0.46, (wob(seed, 3600 + i) - 0.5) * 1.2, 0, TAU);
    ctx.fill();
  }
}
