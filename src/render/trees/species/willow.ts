import { LX, clusterPath, rampOf, type Ramp } from '../paint';
import type { ClusterLook, Limb, PaintInfo, Strand, TreeGeometry, TreeLook } from '../types';

/**
 * Willow: a dome of rounded heads of leaf, each with its own curtain of
 * clumpy leafy locks hanging off it, parted in front so the trunk and its
 * fork show. Painted here rather than by the shared weeping painter, which
 * only draws the bare withies the locks become with the leaf down.
 */

/** One head of the dome and the locks hanging off it. */
interface Head { x: number; y: number; r: number; front: boolean; seed: number; turned: boolean; locks: Lock[] }
/** One hanging lock of leaf, from (x, y), `len` long, `w` half as wide at the top, arching `arch` out over its head and drifting `sway` sideways at its end. */
interface Lock { x: number; y: number; len: number; w: number; arch: number; sway: number; seed: number }

const HEAD: ClusterLook = { style: 'puff', lobes: 7, depth: 0.55 };

const crowns = new WeakMap<TreeGeometry, Head[]>();

/** Where each head sits on the dome, as shares of the crown's half-width and half-height, and whether it hangs in front. */
const PLAN: ReadonlyArray<readonly [number, number, number]> = [
  // Back row: round the top of the dome, out to its shoulders.
  [-0.76, 0.02, 0], [0.78, 0.06, 0], [-0.4, -0.52, 0], [0.42, -0.5, 0], [0.02, -0.74, 0],
  // Front row: lower and out either side of the parting, the one over it high and short.
  [-0.5, 0.16, 1], [0.54, 0.2, 1], [-0.04, -0.36, 1], [0.88, 0.36, 1], [-0.88, 0.32, 1], [0.22, 0.02, 0],
];

function layout(g: TreeGeometry, info: PaintInfo): void {
  if (info.ageKey === 'shrivelled' || info.ageKey === 'clipped') {
    if (info.ageKey === 'shrivelled') stag(g);
    return;
  }
  const c = g.crown;
  const H = g.height;
  const s = info.shape;
  const n = Math.max(3, Math.min(PLAN.length, Math.round(s.clusters)));
  const hem = g.foot.y - H * s.hem;
  const keep = info.keep;
  const old = info.ageKey === 'veryOld';
  const heads: Head[] = [];
  const withies: Strand[] = [];
  // A very old willow has died back on one side of its top: dead wood stands there instead.
  const deadSide = info.wob(2001) > 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [ux, uy, front] = PLAN[i];
    if (old && ux * deadSide > -0.1 && uy < 0.1) continue;
    const r = s.clusterSize * c.rx * (0.9 + 0.25 * info.wob(2010 + i)) * (front ? 0.92 : 1);
    const x = c.cx + ux * (c.rx - r * 0.55);
    const y = c.cy + uy * (c.ry - r * 0.3);
    const head: Head = { x, y, r, front: !!front, seed: i, turned: info.wob(2030 + i) < info.turning, locks: [] };
    const k = 4 + (r > c.rx * 0.3 ? 1 : 0);
    for (let j = 0; j < k; j++) {
      const o = (j + 0.5) / k - 0.5 + (info.wob(2100 + i * 7 + j) - 0.5) * 0.18;
      const lx = x + o * r * 1.3;
      const ly = y - r * (0.62 - o * o * 1.4);
      // The outer locks hang longest; those in front of the trunk part for it.
      const out = Math.min(1, Math.abs(lx - c.cx) / c.rx);
      const part = front ? Math.max(0, 1 - out / 0.4) * H * 0.3 : 0;
      const end = hem - H * (0.1 * (1 - out) + 0.2 * info.wob(2200 + i * 7 + j) ** 2) - part;
      const lock: Lock = {
        x: lx, y: ly, len: Math.max(r, end - ly), w: r * (0.17 + 0.09 * info.wob(2300 + i * 7 + j)), arch: o * r * 0.7,
        sway: (lx - c.cx) / c.rx * r * 0.5 + (info.wob(2400 + i * 7 + j) - 0.5) * r * 0.3, seed: i * 7 + j,
      };
      // With the leaf down a lock is a bare withy.
      if (info.wob(2500 + i * 7 + j) >= keep) {
        withies.push({
          x: lx, y: ly - r * 0.3, len: lock.len + r * 0.3, arch: (lx - c.cx) / c.rx * r * 0.5, sway: lock.arch + lock.sway,
          w: lock.w, layer: front ? 1 : 0, seed: lock.seed, bare: true,
        });
      } else head.locks.push(lock);
    }
    // A head is in leaf while any of its locks is.
    if (head.locks.length) heads.push(head);
  }
  g.clusters = [];
  g.strands = withies;
  if (old) g.dead = deadWood(g, deadSide);
  crowns.set(g, heads);
}

/** Dead limbs standing up out of the bare side of a very old crown. */
function deadWood(g: TreeGeometry, side: number): Limb[] {
  const c = g.crown;
  const t = g.trunk;
  const out: Limb[] = [];
  for (let j = 0; j < 3; j++) {
    const a = -Math.PI / 2 + side * (0.15 + j * 0.35);
    const len = c.ry * (1.25 - j * 0.2);
    const x0 = t.x1 + side * t.w1 * 0.3;
    const y0 = t.y1 - c.ry * 0.1 * j;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    out.push({ x0, y0, cx: x0 + Math.cos(a) * len * 0.5 - side * len * 0.12, cy: y0 + Math.sin(a) * len * 0.5, x1, y1, w0: t.w1 * (0.85 - j * 0.15), w1: t.w1 * 0.22 });
  }
  return out;
}

/**
 * A dead willow: the trunk and its fork, the limbs long and thick, and the
 * crown they are held in drawn in close so only their first forks grow.
 */
function stag(g: TreeGeometry): void {
  for (const l of g.limbs) {
    const k = 1.2;
    l.cx = l.x0 + (l.cx - l.x0) * k;
    l.cy = l.y0 + (l.cy - l.y0) * k;
    l.x1 = l.x0 + (l.x1 - l.x0) * k;
    l.y1 = l.y0 + (l.y1 - l.y0) * k;
    l.w0 *= 1.3;
    l.w1 *= 1.5;
  }
  const c = g.crown;
  c.rx *= 1.12;
  c.ry *= 1.2;
}

/** One lock: a chain of leaf clumps down a line, narrowing to its end, scalloped either side. */
function lockPath(ctx: CanvasRenderingContext2D, l: Lock, k: number, dx: number, from: number, to: number): void {
  const n = Math.max(3, Math.round(((to - from) * l.len) / (l.w * 1.5)));
  const at = (t: number): [number, number, number] => {
    const tt = from + (to - from) * t;
    const a = 1 - (1 - Math.min(1, tt * 3.5)) ** 2;
    return [l.x + dx + l.arch * a + l.sway * tt * tt, l.y + l.len * tt, l.w * k * (1 - 0.55 * tt)];
  };
  const [x0, y0, w0] = at(0);
  ctx.moveTo(x0 - w0 * 0.8, y0);
  for (let j = 0; j < n; j++) {
    const [mx, my, mw] = at((j + 0.5) / n);
    const [ex, ey, ew] = at((j + 1) / n);
    const bulge = 1.35 + 0.3 * ((l.seed + j) % 3) / 2;
    ctx.quadraticCurveTo(mx - mw * bulge, my, ex - ew * 0.75, ey);
  }
  const [tx, ty, tw] = at(1);
  ctx.quadraticCurveTo(tx, ty + tw * 2.2, tx + tw * 0.75, ty);
  for (let j = n - 1; j >= 0; j--) {
    const [mx, my, mw] = at((j + 0.5) / n);
    const [ex, ey, ew] = at(j / n);
    const bulge = 1.35 + 0.3 * ((l.seed + j + 1) % 3) / 2;
    ctx.quadraticCurveTo(mx + mw * bulge, my, ex + ew * 0.8, ey);
  }
  ctx.closePath();
}

/** One row of heads with their locks, in the tones of `r` from `b` up. */
function paintRow(ctx: CanvasRenderingContext2D, heads: Head[], r: Ramp, b: number, seed: number, cx: number): void {
  if (!heads.length) return;
  const locks = heads.flatMap((h) => h.locks);
  const sunward = (l: Lock): boolean => (l.x - cx) * LX > 0 || (l.seed % 3 === 0);
  // The heads: deep all over, the body slid up-sun, the lit cap.
  ctx.fillStyle = r[b];
  ctx.beginPath();
  for (const h of heads) clusterPath(ctx, h.x, h.y, h.r, HEAD, seed + h.seed * 3.7);
  ctx.fill();
  ctx.fillStyle = r[b + 1];
  ctx.beginPath();
  for (const h of heads) clusterPath(ctx, h.x - h.r * 0.1, h.y - h.r * 0.14, h.r * 0.84, HEAD, seed + h.seed * 3.7);
  ctx.fill();
  ctx.fillStyle = r[b + 2];
  ctx.beginPath();
  for (const h of heads) clusterPath(ctx, h.x - h.r * 0.24, h.y - h.r * 0.34, h.r * 0.5, HEAD, seed + h.seed * 3.7 + 0.5);
  ctx.fill();
  // The locks: shaded ones and lit ones, then the light down their sunward edge.
  for (const sun of [false, true]) {
    ctx.fillStyle = r[b + (sun ? 1 : 0)];
    ctx.beginPath();
    for (const l of locks) if (sunward(l) === sun) lockPath(ctx, l, 1, 0, 0, 1);
    ctx.fill();
  }
  ctx.fillStyle = r[b + 2];
  ctx.beginPath();
  for (const l of locks) lockPath(ctx, l, 0.42, -l.w * 0.4, 0, sunward(l) ? 0.75 : 0.4);
  ctx.fill();
}

const beforeCrown = (ctx: CanvasRenderingContext2D, g: TreeGeometry, info: PaintInfo): void => {
  const heads = crowns.get(g);
  if (!heads || !heads.length) return;
  const own = rampOf(info.leaf);
  const turned = info.turned ? rampOf(info.turned) : null;
  const seed = info.species * 7.13 + 1.7;
  for (const front of [false, true]) {
    for (const t of turned ? [false, true] : [false]) {
      const row = heads.filter((h) => h.front === front && (!turned || h.turned === t)).sort((a, b) => a.y - b.y);
      paintRow(ctx, row, t && turned ? turned : own, front ? 1 : 0, seed, g.crown.cx);
    }
  }
};

export const willow: TreeLook = {
  form: 'weeping',
  leaf: ['#d6e88a', '#a6c95a', '#6e983e'],
  bark: '#7c5e48',
  marks: 'furrows',
  cluster: HEAD,
  shape: { height: 66, trunk: 0.4, width: 1.75, girth: 0.062, flare: 1.8, gnarl: 0.35, lean: 0.15, clusters: 9, clusterSize: 0.36, limbs: 3, hem: 0.2 },
  ages: {
    sapling: { clusters: 5, clusterSize: 0.46, width: 1.5, hem: 0.24 },
    young: { clusters: 7, clusterSize: 0.4, hem: 0.2 },
    old: { clusters: 11, hem: 0.17 },
    veryOld: { clusters: 11, hem: 0.2 },
    shrivelled: { trunk: 0.5, limbs: 4, girth: 0.07 },
  },
  layout,
  beforeCrown,
};
