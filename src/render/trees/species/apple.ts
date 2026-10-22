import type { Limb, PaintInfo, TreeGeometry, TreeLook } from '../types';

/** A point `t` along a limb's curve. */
const along = (l: Limb, t: number): [number, number] => {
  const u = 1 - t;
  return [u * u * l.x0 + 2 * u * t * l.cx + t * t * l.x1, u * u * l.y0 + 2 * u * t * l.cy + t * t * l.y1];
};

/**
 * A very old fruit tree's dead wood, shared by the orchard trees (apple,
 * cherry, plum, peach): the main limb on the thin side of the crown is the
 * one that died, grown on out past the leaf, and the snags fork off it
 * rather than standing loose out of the crown.
 */
export function orchardDeadwood(g: TreeGeometry, info: PaintInfo): void {
  if (info.ageKey !== 'veryOld' || !g.dead.length || g.limbs.length < 2) return;
  const c = g.crown;
  const side = Math.sign(g.dead.reduce((s, d) => s + d.x1 - c.cx, 0)) || 1;
  const main = g.limbs.reduce((a, b) => (side * (b.x1 - a.x1) > 0 ? b : a));
  g.limbs = g.limbs.filter((l) => l !== main);
  const reach = 1.28;
  const x1 = main.x0 + (main.x1 - main.x0) * reach + side * c.rx * 0.1;
  const y1 = main.y0 + (main.y1 - main.y0) * reach - c.ry * 0.16;
  const dead: Limb = {
    x0: main.x0, y0: main.y0, x1, y1,
    cx: main.x0 + (x1 - main.x0) * 0.4, cy: main.y0 + (y1 - main.y0) * 0.62,
    w0: main.w0 * 1.05, w1: main.w1 * 0.7,
  };
  const n = g.dead.length;
  const snags = g.dead.map((d, j): Limb => {
    const t = 0.5 + (0.4 * (j + 0.5)) / n;
    const [sx, sy] = along(dead, t);
    // Off alternate flanks of the dead limb, up and out.
    const out = j % 2 ? -0.55 : 0.75;
    const base = Math.atan2(y1 - dead.cy, x1 - dead.cx);
    const a = base - side * out * (0.8 + 0.3 * info.wob(1900 + j));
    const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0) * (0.75 + 0.3 * info.wob(1910 + j));
    const ex = sx + Math.cos(a) * len;
    const ey = sy + Math.sin(a) * len;
    return { x0: sx, y0: sy, cx: (sx + ex) / 2, cy: (sy + ey) / 2 - len * 0.12, x1: ex, y1: ey, w0: dead.w0 * 0.45 * (1 - t * 0.5), w1: d.w1 * 0.8 };
  });
  g.dead = [dead, ...snags];
  // No leaf left along the dead limb: it stands in a gap of its own making, not across the crown.
  for (const cl of g.clusters) {
    if (cl.hide) continue;
    for (let t = 0.5; t <= 1; t += 0.125) {
      const [px, py] = along(dead, t);
      if (Math.hypot(cl.x - px, cl.y - py) < cl.r * 0.62) {
        cl.hide = true;
        break;
      }
    }
  }
}

/** Dead standing: fewer, heavier forks, the fine twigs kept in close to the limbs. */
export function orchardSnag(g: TreeGeometry, info: PaintInfo): void {
  if (info.ageKey !== 'shrivelled') return;
  const c = g.crown;
  // Spread into a wide V, heavier, so the stubs left standing are limbs and not withies.
  for (const l of g.limbs) {
    const dx = l.x1 - l.x0;
    l.x1 = l.x0 + dx * 1.6;
    l.cx = l.x0 + (l.cx - l.x0) * 1.3;
    l.y1 += Math.abs(dx) * 0.25;
    l.w0 *= 1.3;
    l.w1 *= 1.6;
  }
  c.rx *= 1.1;
}

/**
 * An open crown: the inner clumps of its lower half drawn smaller, so the limbs show dark
 * between them going up into the leaf.
 */
export function orchardOpen(g: TreeGeometry, k: number): void {
  const c = g.crown;
  for (const cl of g.clusters) {
    const uy = (cl.y - c.cy) / c.ry;
    if (uy > -0.15 && Math.hypot((cl.x - c.cx) / c.rx, uy) < 0.62) cl.r *= k;
  }
}

/** The orchard trees' own wood at every age: dead wood when very old, a snag when dead. */
export function orchardWood(g: TreeGeometry, info: PaintInfo): void {
  orchardDeadwood(g, info);
  orchardSnag(g, info);
}

/** Apple: a broad round crown of rounded leaves on a stout forked trunk, small red apples through it. */
export const apple: TreeLook = {
  form: 'broadleaf',
  leaf: ['#a8d270', '#64a048', '#386c34'],
  bark: '#7c5c44',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 8, depth: 0.5, leaf: 0.85, slim: 0.55 },
  shape: {
    height: 68, trunk: 0.33, width: 1.38, girth: 0.072, flare: 1.9, gnarl: 0.3, clusters: 18, clusterSize: 0.35,
    limbs: 3, flat: 0.25,
  },
  ages: {
    sapling: { width: 1.15, girth: 0.058 },
    young: { width: 1.35 },
    veryOld: { gaps: 0.45, dead: 3 },
    shrivelled: { girth: 0.085, limbs: 3, trunk: 0.4 },
  },
  fruit: { colour: '#d63a30', size: 1, count: 14, shape: 'round' },
  layout: orchardWood,
};
