import type { Limb, TreeGeometry, TreeLook } from '../types';

/** Where the heads of leaf sit for so many limbs, in crown radii from its middle (y down). */
const HEADS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, -0.3]],
  2: [[-0.42, -0.2], [0.38, -0.42]],
  3: [[-0.56, -0.02], [-0.02, -0.56], [0.55, -0.16]],
  4: [[-0.6, 0.04], [-0.14, -0.58], [0.42, -0.42], [0.64, 0.2]],
  5: [[-0.62, 0.12], [-0.38, -0.46], [0.1, -0.64], [0.54, -0.3], [0.64, 0.26]],
};

/**
 * The crown gathered into one head of leaf at the end of each limb, round the
 * crown's rim and open below the middle, so the heads stand apart with the
 * limbs showing between them. The highest head is on the leader, the trunk
 * carried on up; the others branch off it, the lower heads the lower down.
 * `pull` is how tight each head is drawn (1 as built). Without a `leader`,
 * every limb forks off the top of the trunk instead, spread across it.
 */
export function headed(geo: TreeGeometry, pull: number, leader = true): number[] {
  const n = Math.min(5, geo.limbs.length);
  const { cx, cy, rx, ry } = geo.crown;
  if (!n || !geo.clusters.length) return [];
  geo.limbs.length = n;
  const heads = HEADS[n].map(([x, y]) => ({ x: cx + x * rx, y: cy + y * ry }));
  const sum = heads.map(() => ({ x: 0, y: 0, n: 0 }));
  const near = geo.clusters.map((cl) => {
    let best = 0;
    let d = Infinity;
    heads.forEach((h, j) => {
      const e = Math.hypot((cl.x - h.x) / rx, (cl.y - h.y) / ry);
      if (e < d) { d = e; best = j; }
    });
    sum[best].x += cl.x;
    sum[best].y += cl.y;
    sum[best].n++;
    return best;
  });
  geo.clusters.forEach((cl, i) => {
    const h = heads[near[i]];
    const s = sum[near[i]];
    cl.x = h.x + (cl.x - s.x / s.n) * pull;
    cl.y = h.y + (cl.y - s.y / s.n) * pull;
  });
  const t = geo.trunk;
  const top = heads.reduce((a, h) => (h.y < a.y ? h : a), heads[0]);
  const order = heads.map((h, j) => ({ h, j })).sort((a, b) => b.h.y - a.h.y);
  order.forEach(({ h, j }, rank) => {
    const l = geo.limbs[j];
    const lead = leader && h === top;
    const f = !leader || lead ? 0 : Math.min(0.55, 0.1 + 0.16 * rank);
    // Forked: the limbs to either side of the middle leave the trunk together, as two big limbs.
    const across = leader ? 0 : (h.x >= t.x1 ? 1 : -1) * t.w1 * 0.42;
    const x0 = t.x1 + (top.x - t.x1) * f + across;
    const y0 = t.y1 + (top.y - t.y1) * f + (leader ? 0 : t.w1 * 0.3);
    const x1 = x0 + (h.x - x0) * 0.88;
    const y1 = y0 + (h.y - y0) * 0.88;
    l.x0 = x0;
    l.y0 = y0;
    // Up first, then out to its head.
    l.cx = x0 + (x1 - x0) * (lead ? 0.5 : 0.3);
    l.cy = y0 + (y1 - y0) * (lead ? 0.5 : 0.8);
    l.x1 = x1;
    l.y1 = y1;
    l.w0 = lead ? t.w1 * 0.95 : t.w1 * (leader ? 0.62 - 0.08 * f : 0.6);
    l.w1 = t.w1 * 0.1;
  });
  return near;
}

/**
 * A very old tree has died back down one side, the side its dead wood stands
 * out of: the heads there are gone but the lowest, which is half the size,
 * and their limbs stand bare. The other side keeps every clump.
 */
export function diedBack(geo: TreeGeometry, near: number[], low = 0.7): void {
  if (!near.length) return;
  const side = geo.dead.reduce((s, l) => s + l.x1 - geo.crown.cx, 0) >= 0 ? 1 : -1;
  const heads = geo.limbs.map((l) => ({ x: l.x1, y: l.y1 }));
  const dead = heads.map((h) => (h.x - geo.crown.cx) * side > geo.crown.rx * 0.1);
  let keep = -1;
  heads.forEach((h, j) => { if (dead[j] && (keep < 0 || h.y > heads[keep].y)) keep = j; });
  geo.clusters.forEach((cl, i) => {
    const j = near[i];
    if (!dead[j]) cl.hide = false;
    else if (j === keep) {
      cl.r *= low;
      cl.x = heads[j].x + (cl.x - heads[j].x) * low;
      cl.y = heads[j].y + (cl.y - heads[j].y) * low;
    } else cl.hide = true;
  });
  // Dead wood grows out of the living wood, not out of the air: each dead
  // limb starts partway up the limb nearest it.
  for (const d of geo.dead) {
    let best = geo.limbs[0];
    let e = Infinity;
    for (const l of geo.limbs) {
      const k = Math.hypot(l.x1 - d.x1, l.y1 - d.y1);
      if (k < e) { e = k; best = l; }
    }
    const x0 = best.x0 + (best.x1 - best.x0) * 0.6;
    const y0 = best.y0 + (best.y1 - best.y0) * 0.6;
    d.cx += (x0 - d.x0) * 0.5;
    d.cy += (y0 - d.y0) * 0.5;
    d.x0 = x0;
    d.y0 = y0;
  }
}

/** A limb drawn out to `k` times its length, keeping its bend. */
export function stretch(l: Limb, k: number): void {
  l.cx = l.x0 + (l.cx - l.x0) * k;
  l.cy = l.y0 + (l.cy - l.y0) * k;
  l.x1 = l.x0 + (l.x1 - l.x0) * k;
  l.y1 = l.y0 + (l.y1 - l.y0) * k;
}

/** Birch: a white bole with dark marks forking into pale limbs, and an open crown of a few big, separate heads of leaf. */
export const birch: TreeLook = {
  form: 'broadleaf',
  leaf: ['#d6df8e', '#a9c05e', '#6b8c40'],
  bark: '#ebe7dd',
  twig: '#6e5a52',
  marks: 'birch',
  cluster: { style: 'puff', lobes: 8, depth: 0.6 },
  shape: { height: 74, trunk: 0.38, width: 1.1, girth: 0.065, lean: 0.2, flare: 1.45, gnarl: 0.2, clusters: 12, clusterSize: 0.35, limbs: 4, gaps: 0.06, peak: 0.05, flat: 0.15 },
  ages: { sapling: { limbs: 3, girth: 0.056 } },
  layout: (geo, info) => {
    const near = headed(geo, 0.62);
    if (info.ageKey === 'veryOld') diedBack(geo, near);
    // Standing dead, its limbs are painted cut back to a little over half: reach them out past the heads they held.
    if (info.ageKey === 'shrivelled') for (const l of geo.limbs) stretch(l, 1.3);
  },
};
