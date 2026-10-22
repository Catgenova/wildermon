import { wob } from '../kit';
import { LX, rampOf } from '../paint';
import type { Hook, Limb, PaintInfo, Tier, TreeGeometry, TreeLook } from '../types';

/**
 * Boughs for a conifer, painted in place of the shared tiers: each tier is a
 * pair of feathered sprays off the leader, one each way, sweeping out and
 * down to fingered tips, with a shorter pair hanging in front either side of
 * the trunk, so the trunk shows up the middle between tiers. Shared with the
 * cedar (`./cedar`), which hangs the same boughs to a broader, sweeping plan.
 */
export interface Boughs {
  /** Fingers along a side spray's underside. */
  fingers: number;
  /** A spray's thickness against its tier's height. */
  thick: number;
  /** How far a spray arches up before it falls, in its thickness. */
  lift: number;
  /** The tips turned back up at the end, in tier heights (a cedar's sweep). */
  curl: number;
  /** How far a spray falls for its length, before its tier's droop. */
  slope: number;
  /** The inner pair's reach against the side pair's, on every other tier from the bottom (0: none). */
  inner: number;
  /** Where the lowest tips stop, as a share of the height above the ground. */
  hem: number;
  /** Tiers above this share of the height are dead wood on a very old tree (1: none). */
  deadTop: number;
  /** Light caught on needle tips along the top of the sunward sprays. */
  glint?: boolean;
  /** How unevenly the tiers reach, 0 to 1. */
  ragged?: number;
}

/**
 * A closed outline through the points `p` (x, y, x, y...), rounded: a curve
 * through each edge's middle bent by its corner. Laid down clockwise
 * whichever way the points run, so outlines filled in one path never cancel
 * where they overlap.
 */
function rounded(ctx: CanvasRenderingContext2D, p: number[]): void {
  const n = p.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = ((i + 1) % n) * 2;
    a += p[i * 2] * p[j + 1] - p[j] * p[i * 2 + 1];
  }
  if (a < 0) {
    for (let i = 0, j = n - 1; i < j; i++, j--) {
      const x = p[i * 2];
      const y = p[i * 2 + 1];
      p[i * 2] = p[j * 2];
      p[i * 2 + 1] = p[j * 2 + 1];
      p[j * 2] = x;
      p[j * 2 + 1] = y;
    }
  }
  ctx.moveTo((p[0] + p[2]) / 2, (p[1] + p[3]) / 2);
  for (let i = 1; i <= n; i++) {
    const i0 = (i % n) * 2;
    const i1 = ((i + 1) % n) * 2;
    ctx.quadraticCurveTo(p[i0], p[i0 + 1], (p[i0] + p[i1]) / 2, (p[i0 + 1] + p[i1 + 1]) / 2);
  }
  ctx.closePath();
}

/** One spray: off (x, y) toward side `s`, `len` out and `drop` down at its tip, `th` thick. */
interface Spray { x: number; y: number; s: number; len: number; drop: number; th: number; fingers: number; lift: number; curl: number; seed: number; inner?: boolean }

const pts: number[] = [];

/**
 * A spray's outline, or a band of it: `lo` and `hi` are its underside and
 * top as shares of its thickness about the spine (0.55 and 0.45 the whole
 * spray, a negative `lo` a band clear of the spine), `F` the fingers along
 * its underside and `fk` their length, `end` how far along it runs; `sharp`
 * fingers come to a point.
 */
function sprayPath(ctx: CanvasRenderingContext2D, sp: Spray, lo: number, hi: number, F: number, fk: number, end: number, sharp: boolean, dy0 = 0, seed = 0): void {
  const { x, s, len, th, curl } = sp;
  const y = sp.y + dy0;
  const drop = Math.max(0, sp.drop);
  const p1x = x + s * len * 0.48;
  const p1y = y + drop * 0.12 - sp.lift * th;
  const p2x = x + s * len;
  const p2y = y + drop;
  let px = 0;
  let py = 0;
  let nx = 0;
  let ny = 0;
  // The spine at `t`, and the normal on its upper side whichever way it runs.
  const at = (t: number): void => {
    const u = 1 - t;
    px = u * u * x + 2 * u * t * p1x + t * t * p2x;
    py = u * u * y + 2 * u * t * p1y + t * t * p2y - curl * t * t * t * t;
    const dx = 2 * u * (p1x - x) + 2 * t * (p2x - p1x);
    const dy = 2 * u * (p1y - y) + 2 * t * (p2y - p1y) - 4 * curl * t * t * t;
    const d = Math.hypot(dx, dy) || 1;
    nx = (s * dy) / d;
    ny = (-s * dx) / d;
  };
  const prof = (t: number): number => 0.3 + 0.7 * Math.sin(Math.PI * (0.12 + 0.8 * t));
  pts.length = 0;
  pts.push(x, y - th * hi * 0.7);
  for (let q = 0; q < 2; q++) {
    const t = (q ? 0.7 : 0.3) * end;
    at(t);
    const w = th * hi * prof(t);
    pts.push(px + nx * w, py + ny * w);
  }
  // The tip, drawn out a little past the spine's end and hanging.
  at(end);
  pts.push(px + s * th * 0.35, py + th * 0.18 - ny * th * 0.1);
  // One break between fingers cut deeper than the rest, where the spray parts.
  const gap = sharp ? 1 + Math.floor(wob(sp.seed, 40) * (F - 1)) : -1;
  for (let j = F - 1; j >= 0; j--) {
    const t = end * (0.3 + 0.62 * (j + 0.5) / F);
    // Notch, then the finger hanging out and down from it, fanned out further toward the tip.
    const tn = Math.min(end, t + end * 0.31 / F);
    at(tn);
    const wn = th * lo * prof(tn) * (j + 1 === gap ? 0.05 : 0.75);
    pts.push(px - nx * wn, py - ny * wn);
    at(t);
    const w = th * lo * prof(t);
    const fl = th * fk * (0.6 + 0.8 * wob(sp.seed + seed, j)) * (0.8 + 0.4 * t);
    const fx = px - nx * w + s * fl * (0.35 + 0.6 * t);
    const fy = py - ny * w + fl * (0.95 - 0.3 * t);
    pts.push(fx, fy);
    if (sharp) pts.push(fx, fy);
  }
  pts.push(x + s * th * 0.2, y + th * lo * 0.5);
  rounded(ctx, pts);
}

/** Needle tips catching the light along the top of a sunward spray. */
function glints(ctx: CanvasRenderingContext2D, sp: Spray): void {
  const { x, y, s, len, th } = sp;
  const drop = Math.max(0, sp.drop);
  for (let q = 0; q < 3; q++) {
    const t = 0.3 + q * 0.24 + (wob(sp.seed, 50 + q) - 0.5) * 0.08;
    const u = 1 - t;
    const p1x = x + s * len * 0.48;
    const p1y = y + drop * 0.12 - sp.lift * th;
    const px = u * u * x + 2 * u * t * p1x + t * t * (x + s * len);
    const py = u * u * y + 2 * u * t * p1y + t * t * (y + drop) - th * 0.4;
    const k = th * (0.13 + 0.06 * wob(sp.seed, 55 + q));
    ctx.moveTo(px - s * k, py + k * 0.5);
    ctx.lineTo(px + s * k * 1.5, py - k * 0.75);
    ctx.lineTo(px + s * k * 0.3, py + k * 0.6);
    ctx.closePath();
  }
}

/** Where a tier's sprays leave the leader, and where its tips come to; `step` is the rise from one tier to the next. */
function sprays(t: Tier, b: Boughs, step: number, trunkW: number, top: boolean, floor: number, odd: boolean): { side: Spray[]; inner: Spray[] } {
  const y = top ? t.top + (t.bottom - t.top) * 0.55 : t.bottom - step * 0.62;
  const th = step * b.thick;
  const side: Spray[] = [];
  const inner: Spray[] = [];
  for (const s of [-1, 1]) {
    const reach = s < 0 ? t.left : t.right;
    if (reach < step * 0.3) continue;
    const k = s < 0 ? 0 : 1;
    side.push({
      x: t.ax - s * trunkW * 0.9, y, s, len: reach + trunkW * 0.9, drop: Math.min(reach * b.slope + t.droop, floor - y - th * 1.1), th, fingers: b.fingers, lift: b.lift, curl: b.curl * step,
      seed: t.seed + k * 5.1,
    });
    if (b.inner > 0 && !top && !odd && reach > step * 1.2) {
      const len = reach * b.inner;
      inner.push({
        x: t.ax + s * trunkW * 0.3, y: y + step * 0.2, s, len, drop: Math.min(len * (b.slope + 0.5) + t.droop * 0.6, floor - y - th * 1.3), th: th * 0.85,
        fingers: Math.max(2, b.fingers - 1), lift: b.lift * 0.5, curl: 0, seed: t.seed + 9.7 + k * 3.3, inner: true,
      });
    }
  }
  return { side, inner };
}

/**
 * One set of sprays in three tones: the whole of each in the deep one, the
 * body over all but its fingers, and its top lit -- broadly on the sunward
 * side, a narrow edge on the other. The body and the light are fingered
 * too, so the edges between the tones are ragged with needles.
 */
function paintSet(ctx: CanvasRenderingContext2D, set: Spray[], deep: string, body: string, lit: string, glint: boolean): void {
  if (!set.length) return;
  ctx.fillStyle = deep;
  ctx.beginPath();
  for (const sp of set) sprayPath(ctx, sp, 0.55, 0.45, sp.fingers, 0.48, 1, true);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  for (const sp of set) sprayPath(ctx, sp, 0.1, 0.42, 2, 0.34, 0.96, false);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  for (const sp of set) {
    // The shaded side's sprays catch light only on the inner pair, near the leader.
    const sun = sp.s * LX > 0;
    if (!sun && !sp.inner) continue;
    sprayPath(ctx, sp, sun ? -0.12 : -0.26, 0.4, 2, 0.3, sun ? 0.86 : 0.6, false, -sp.th * 0.05, 2);
    if (glint && sun) glints(ctx, sp);
  }
  ctx.fill();
}

/** The leader's tip: a small spire of needles over the top tier. */
function spire(ctx: CanvasRenderingContext2D, t: Tier, step: number, body: string, lit: string): void {
  const y0 = t.top - step * 0.1;
  const y1 = t.top + (t.bottom - t.top) * 0.55 + step * 0.35;
  const h = y1 - y0;
  const w = step * 0.42;
  const at = (k: number, dx: number): number[] => {
    const x = t.ax + dx;
    return [
      x, y0, x, y0, x + w * 0.4 * k, y0 + h * 0.45, x + w * k, y1, x + w * k, y1,
      x, y1 - h * 0.12, x - w * k, y1, x - w * k, y1, x - w * 0.4 * k, y0 + h * 0.45,
    ];
  };
  ctx.fillStyle = body;
  ctx.beginPath();
  rounded(ctx, at(1, 0));
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  rounded(ctx, at(0.45, -w * 0.25));
  ctx.fill();
}

const keepTiers = new WeakMap<TreeGeometry, Tier[]>();

/** The layout and painting a conifer species hangs its boughs with. */
export function boughsOf(b: Boughs): Pick<TreeLook, 'layout' | 'extra'> {
  const layout = (g: TreeGeometry, info: PaintInfo): void => {
    if (!g.tiers.length) {
      if (info.ageKey === 'shrivelled') snag(g, info);
      return;
    }
    const H = g.height;
    const live: Tier[] = [];
    for (const t of g.tiers) {
      const u = (g.foot.y - t.bottom) / H;
      t.hide = true;
      if (info.ageKey === 'veryOld' && u > b.deadTop + 0.1) continue;
      // The last tier under a dead top is cut back, so the crown rounds off under the dead wood.
      const k = info.ageKey === 'veryOld' && u > b.deadTop ? 0.55 : 1;
      // Uneven boughs: each side of a tier reaches its own way.
      const rag = (i: number): number => 1 + (b.ragged ?? 0) * (info.wob(1880 + i) - 0.5) * 0.5;
      live.push({ ...t, left: t.left * k * rag(live.length * 2), right: t.right * k * rag(live.length * 2 + 1) });
    }
    if (info.ageKey === 'veryOld' && b.deadTop < 1) deadCrown(g, info, b);
    // Dead boughs as thick as the living ones they were.
    else for (const l of g.dead) {
      l.w0 *= 1.6;
      l.w1 *= 1.6;
    }
    keepTiers.set(g, live);
  };
  const extra: Hook = (ctx, g, info) => {
    const tiers = keepTiers.get(g);
    if (!tiers || info.ageKey === 'clipped' || info.ageKey === 'shrivelled') return;
    const r = rampOf(info.leaf);
    const tw = g.trunk.w0 * 0.55;
    const n = tiers.length;
    const step = n > 1 ? Math.abs(tiers[0].bottom - tiers[1].bottom) : g.height * 0.2;
    // Bottom tier first: each tier hangs over the one under it.
    tiers.forEach((t, i) => {
      const top = i === n - 1 && !(info.ageKey === 'veryOld' && b.deadTop < 1);
      const { side, inner } = sprays(t, b, step, tw, top, g.foot.y - g.height * b.hem, i % 2 === 1);
      // The upper tiers stand in more light than the lower.
      const lift = i / Math.max(1, n - 1) + (wob(t.seed, 7) - 0.5) * 0.3 > 0.9 ? 1 : 0;
      // One set a tier: the inner pair painted with the outer, three fills a tier.
      paintSet(ctx, side.concat(inner), r[1], r[2], r[3 + lift], !!b.glint);
      if (top) spire(ctx, t, step, r[2], r[3 + lift]);
    });
  };
  return { layout, extra };
}

/** A very old conifer dead at the top: the leader runs on bare, and the boughs that were there are dead wood forking up off it. */
function deadCrown(g: TreeGeometry, info: PaintInfo, b: Boughs): void {
  const H = g.height;
  const t = g.trunk;
  t.y1 = g.foot.y - H * 0.9;
  t.w1 = t.w0 * 0.12;
  g.dead = [];
  const from = b.deadTop;
  for (let j = 0; j < 4; j++) {
    const u = from - 0.04 + j * ((0.86 - from) / 3);
    const y0 = g.foot.y - H * u;
    const side = j % 2 ? 1 : -1;
    const len = H * (0.24 - j * 0.035) * (0.85 + 0.3 * info.wob(1900 + j));
    const a = -Math.PI / 2 + side * (0.75 - j * 0.08);
    const x0 = t.x0 + (t.x1 - t.x0) * u;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    g.dead.push({
      x0, y0, cx: x0 + Math.cos(a) * len * 0.45 + side * len * 0.12, cy: y0 + Math.sin(a) * len * 0.45 + len * 0.1,
      x1, y1, w0: t.w0 * (0.42 - j * 0.05), w1: t.w0 * 0.1,
    });
  }
}

/** A dead conifer: a pole with the broken stubs of its whorls standing off it, short and uneven. */
function snag(g: TreeGeometry, info: PaintInfo): void {
  const H = g.height;
  const t = g.trunk;
  t.w1 = t.w0 * 0.2;
  const W = g.crown.rx;
  const stubs: Limb[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const u = 0.28 + 0.6 * (i / (n - 1)) + (info.wob(1950 + i) - 0.5) * 0.04;
    const y = g.foot.y - H * u;
    const x = t.x0 + (t.x1 - t.x0) * ((g.foot.y - y) / (g.foot.y - t.y1));
    const side = (i + (info.wob(1960) > 0.5 ? 1 : 0)) % 2 ? 1 : -1;
    const len = W * (0.5 - 0.3 * u) * (0.35 + 0.9 * info.wob(1970 + i));
    const up = 0.1 + 0.5 * info.wob(1980 + i);
    const w = t.w0 * (0.3 - 0.14 * u);
    stubs.push({
      x0: x, y0: y, cx: x + side * len * 0.5, cy: y - len * up * 0.3, x1: x + side * len, y1: y - len * up, w0: w, w1: w * 0.45,
    });
  }
  g.limbs = stubs;
}

/** Pine: tall and narrow, its tiers regular and evenly spaced, cool blue-green. */
export const pine: TreeLook = {
  form: 'conifer',
  leaf: ['#68a28d', '#38766b', '#21504f'],
  bark: '#704634',
  marks: 'furrows',
  cluster: { style: 'puff', lobes: 8, depth: 0.5 },
  shape: { height: 86, trunk: 0.17, width: 0.62, girth: 0.04, flare: 1.7, tiers: 7, droop: 0.4 },
  ages: { veryOld: { gaps: 0.4, dead: 3 }, shrivelled: { girth: 0.05 } },
  ...boughsOf({ fingers: 4, thick: 0.95, lift: 0.15, slope: 0.32, curl: 0, inner: 0, hem: 0.13, deadTop: 1, glint: true, ragged: 1 }),
};
