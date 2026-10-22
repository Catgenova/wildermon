import type { Limb, PaintInfo, TreeGeometry, TreeLook } from '../types';

/**
 * A very old fruit tree as the orchard rows have it: the leaf kept down one
 * side of the crown, and on the other the main limbs standing bare out of the
 * fork, forked again at their tips. Shared by pomegranate, apricot and quince.
 */
export function wornOrchard(geo: TreeGeometry, info: PaintInfo): void {
  if (info.ageKey !== 'veryOld') return;
  const c = geo.crown;
  const t = geo.trunk;
  for (const cl of geo.clusters) {
    const ux = (cl.x - c.cx) / c.rx;
    const uy = (cl.y - c.cy) / c.ry;
    // Gone from the upper right, thinning toward the middle; a few left low on the right.
    if (ux * 0.85 - uy * 0.55 > -0.12 + 0.42 * info.wob(800 + cl.seed)) cl.hide = true;
  }
  // Bare limbs, in crown units from its middle: two out of the fork, each forked once more.
  const at = (ux: number, uy: number): [number, number] => [c.cx + ux * c.rx, c.cy + uy * c.ry];
  const j = (i: number): number => (info.wob(810 + i) - 0.5) * 0.16;
  const limb = (p: [number, number], q: [number, number], w0: number, w1: number, bend: number): Limb => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    return { x0: p[0], y0: p[1], cx: p[0] + dx * 0.5 - dy * bend, cy: p[1] + dy * 0.5 + dx * bend, x1: q[0], y1: q[1], w0, w1 };
  };
  const w = t.w1;
  const fork: [number, number] = [t.x1 + w * 0.15, t.y1 + w * 0.4];
  const a = at(0.3 + j(0), -0.3 + j(1));
  const b = at(0.66 + j(2), 0.12 + j(3));
  const tips: Array<[number, number]> = [at(0.62 + j(5), -0.62 + j(6)), at(0.98, -0.18 + j(7))];
  geo.dead = [
    limb(fork, a, w * 0.62, w * 0.3, 0.12),
    limb(a, at(0.18 + j(4), -0.95), w * 0.3, w * 0.12, -0.1),
    limb(a, tips[0], w * 0.26, w * 0.1, 0.1),
    limb(fork, b, w * 0.5, w * 0.24, -0.14),
    limb(b, tips[1], w * 0.22, w * 0.09, 0.12),
  ];
  // A tuft of leaf still out on the ends of the two lower bare limbs.
  const spare = geo.clusters.filter((cl) => cl.hide).slice(0, tips.length);
  spare.forEach((cl, i) => {
    cl.hide = false;
    [cl.x, cl.y] = tips[i];
    cl.y += cl.r * 0.2;
    cl.r *= 0.62;
    cl.lit = 0.3;
  });
}

/** Pomegranate: a dark green crown with small red pomegranates. */
export const pomegranate: TreeLook = {
  form: 'broadleaf',
  leaf: ['#8cbc5a', '#4c8a3a', '#2a5a2c'],
  bark: '#6e5244',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 7, depth: 0.5, leaf: 0.9, slim: 0.5 },
  shape: { height: 62, trunk: 0.3, width: 1.55, girth: 0.072, gnarl: 0.25, clusters: 18, clusterSize: 0.33, limbs: 3, flat: 0.2, peak: 0.25 },
  ages: { veryOld: { gaps: 0, hollow: false }, shrivelled: { trunk: 0.46, width: 1.9 } },
  fruit: { colour: '#d42c2a', size: 1.1, count: 14, shape: 'round' },
  layout: wornOrchard,
};
