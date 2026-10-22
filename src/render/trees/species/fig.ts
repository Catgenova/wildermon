import { newLeaf } from '../../foliage';
import { tone } from '../kit';
import { paintFruit } from '../paint';
import type { Hook, PaintInfo, Tones, TreeGeometry, TreeLook } from '../types';

/** A fig leaf's lobes, round from one side to the other: angle off its midrib, and reach from its stalk against its length. */
const LOBES: ReadonlyArray<readonly [number, number]> = [[-1.75, 0.55], [-0.9, 0.82], [0, 1], [0.9, 0.82], [1.75, 0.55]];
/** Half a lobe's width, as an angle, and how deep the notches between them cut, against the length. */
const HALF = 0.36;
const NOTCH = 0.4;

/** One fig leaf from its stalk at (x, y) along angle `a`: rounded lobes between notches, as one outline of curves. */
function figLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, a: number): void {
  const at = (ang: number, r: number): [number, number] => [x + Math.cos(a + ang) * len * r, y + Math.sin(a + ang) * len * r];
  ctx.moveTo(x, y);
  for (let j = 0; j < LOBES.length; j++) {
    const [off, reach] = LOBES[j];
    const [ax, ay] = at(off - HALF, reach * 1.08);
    const [tx, ty] = at(off, reach);
    const [bx, by] = at(off + HALF, reach * 1.08);
    const [nx, ny] = j === LOBES.length - 1 ? [x, y] : at((off + LOBES[j + 1][0]) / 2, NOTCH);
    ctx.quadraticCurveTo(ax, ay, tx, ty);
    ctx.quadraticCurveTo(bx, by, nx, ny);
  }
  ctx.closePath();
}

/** A clump on the crown's rim, which the shared painter lays behind the limbs (`tree.ts` rim). */
const onRim = (ux: number, uy: number): boolean => Math.hypot(ux, uy) > 0.6 || (uy > 0.15 && Math.abs(ux) < 0.4);

/**
 * Big lobed leaves on the clumps: the rim's under the clumps in front,
 * standing out past the crown's edge, so the outline of a fig is its leaves;
 * the front's over them. Each takes the tones its clump is painted in, so it
 * turns, comes into leaf and drops with the crown.
 */
const leavesOn = (front: boolean): Hook => (ctx, geo, info) => {
  const keep = info.keep;
  if (keep <= 0 || info.ageKey === 'shrivelled') return;
  const c = geo.crown;
  const base: Tones = info.bloom ? newLeaf(fig.leaf) : info.leaf;
  const groups = new Map<string, number[]>();
  for (const cl of geo.clusters) {
    if (cl.hide || (keep < 1 && info.wob(1400 + cl.seed) >= keep)) continue;
    const ux = (cl.x - c.cx) / c.rx;
    const uy = (cl.y - c.cy) / c.ry;
    if (onRim(ux, uy) === front) continue;
    if (!front && uy > 0.5) continue;
    // In front, only the clumps that face the light: the shaded ones are leaf enough as they are.
    if (front && cl.lit < -0.3) continue;
    const turned = info.turned && info.wob(1200 + cl.seed) * 0.6 + (1 - (cl.lit + 1) / 2) * 0.4 < info.turning;
    const t = turned ? info.turned! : base;
    const r = cl.r * (keep < 1 ? 0.62 + 0.38 * keep : 1);
    const a = front ? -Math.PI / 2 + ux * 1.4 + (info.wob(1950 + cl.seed) - 0.5) * 0.8
      : Math.atan2(uy * 0.8 - 0.35, ux) + (info.wob(1950 + cl.seed) - 0.5) * 0.5;
    const len = r * (front ? 0.72 : 0.95) * (0.9 + 0.25 * info.wob(1960 + cl.seed));
    const out = front ? 0.05 : 0.72;
    const x = cl.x + Math.cos(a) * r * out;
    const y = cl.y + Math.sin(a) * r * out;
    const key = cl.lit > 0.2 ? `${t[0]}|${t[1]}|${t[2]}` : `${t[1]}|${t[2]}|${tone(t[2], -0.25)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(x, y, len, a);
  }
  const shape = (g: number[], k: number, dx: number, dy: number): void => {
    ctx.beginPath();
    for (let i = 0; i < g.length; i += 4) {
      const [x, y, len, a] = [g[i] + dx, g[i + 1] + dy, g[i + 2] * k, g[i + 3]];
      figLeaf(ctx, x, y, len, a);
    }
    ctx.fill();
  };
  ctx.lineCap = 'round';
  for (const [key, g] of groups) {
    const [lit, body, edge] = key.split('|');
    ctx.fillStyle = edge;
    shape(g, 1, 0.25, 0.3);
    ctx.fillStyle = lit;
    shape(g, 0.9, -0.15, -0.2);
    // Veins: the midrib and one to each side lobe, in the darker tone.
    ctx.strokeStyle = body;
    ctx.lineWidth = Math.max(0.25, g[2] * 0.05);
    ctx.beginPath();
    for (let i = 0; i < g.length; i += 4) {
      const [x, y, len, a] = [g[i], g[i + 1], g[i + 2], g[i + 3]];
      for (let j = 1; j < 4; j++) {
        const [off, reach] = LOBES[j];
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a + off * 0.9) * len * reach * 0.7, y + Math.sin(a + off * 0.9) * len * reach * 0.7);
      }
    }
    ctx.stroke();
  }
  if (front && info.fruiting) refruit(ctx, geo, info);
};

/**
 * The figs again over the front leaves, where the shared painter put them
 * (`tree.ts` paintFruitOn, worked the same way from the same seed).
 */
function refruit(ctx: CanvasRenderingContext2D, geo: TreeGeometry, info: PaintInfo): void {
  const f = fig.fruit!;
  const by: Partial<Record<string, number>> = { mature: 1, old: 1.15, veryOld: 0.7 };
  const want = Math.round(f.count * (by[info.ageKey] ?? 0.6));
  const r = Math.max(0.7, geo.crown.rx * 0.042 * f.size);
  const shown = geo.clusters.filter((cl) => !cl.hide);
  const order = shown.map((cl) => ({ cl, k: info.wob(1500 + cl.seed) + (cl.lit < -0.5 ? 0.5 : 0) })).sort((a, b) => a.k - b.k);
  const spots: Array<[number, number]> = [];
  for (let pass = 0; pass < 3 && spots.length < want; pass++) {
    for (const { cl } of order) {
      if (spots.length >= want) break;
      const x = cl.x + (info.wob(1600 + cl.seed * 3 + pass) - 0.5) * cl.r * 1.1;
      const y = cl.y + cl.r * (0.05 + 0.5 * info.wob(1700 + cl.seed * 3 + pass));
      if (spots.some(([px, py]) => Math.hypot(px - x, py - y) < r * 3)) continue;
      spots.push([x, y]);
    }
  }
  paintFruit(ctx, spots, r, f.colour, f.shape);
}

/** Fig: a broad open crown of big round-lobed leaves on a smooth grey-brown trunk, small purple figs. */
export const fig: TreeLook = {
  form: 'broadleaf',
  leaf: ['#9fcf6e', '#5a9a48', '#2f6434'],
  bark: '#8e7c6c',
  marks: 'smooth',
  cluster: { style: 'puff', lobes: 4, depth: 0.95, flecks: 0 },
  shape: { height: 64, trunk: 0.36, width: 1.55, girth: 0.075, gnarl: 0.4, clusters: 10, clusterSize: 0.39, limbs: 4, flat: 0.3 },
  fruit: { colour: '#6c4a78', size: 0.95, count: 9, shape: 'round' },
  beforeCrown: leavesOn(false),
  extra: leavesOn(true),
};
