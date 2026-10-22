/**
 * One tree, painted: the species' look (`./species`), worked out for its age
 * and the day's season, built into geometry, shrunk to fit its box if it
 * has to be, and painted by the shared painters in a fixed order.
 */
import type { Season } from '../../world/calendar';
import { TREE_AGES, TREE_DEFS, type TreeAge } from '../../world/tiles';
import { AUTUMN, fresh, newLeaf, wintry, type Leafage } from '../foliage';
import { contact, dulled, mix, tone, wob } from './kit';
import {
  Flecks, LX, LY, boleOf, paintCluster, paintFlowers, paintFruit, paintHollow, paintLimbs, paintLitter, paintStrands,
  paintTier, paintTrunk, paintTwigs, paintWithies, rampOf, type Bole, type Ramp,
} from './paint';
import { TREE_LOOKS } from './looks';
import type { AgeKey, Cluster, Form, Limb, PaintInfo, Shape, Strand, Tones, TreeGeometry, TreeLook } from './types';

/** Each form's mature tree, before a species changes any of it. */
const DEFAULTS: Record<Form, Shape> = {
  broadleaf: {
    height: 66, trunk: 0.36, width: 1.1, girth: 0.055, lean: 0, flare: 1.7, gnarl: 0.15, hollow: false, dead: 0,
    clusters: 22, clusterSize: 0.34, gaps: 0, limbs: 3, flat: 0.25, peak: 0, shift: 0, tiers: 0, droop: 0, strands: 0, hem: 0,
  },
  conifer: {
    height: 78, trunk: 0.13, width: 0.52, girth: 0.036, lean: 0, flare: 1.6, gnarl: 0.05, hollow: false, dead: 0,
    clusters: 0, clusterSize: 0, gaps: 0, limbs: 0, flat: 0, peak: 0, shift: 0, tiers: 7, droop: 0.45, strands: 0, hem: 0,
  },
  weeping: {
    height: 66, trunk: 0.42, width: 1.3, girth: 0.05, lean: 0, flare: 1.7, gnarl: 0.2, hollow: false, dead: 0,
    clusters: 14, clusterSize: 0.3, gaps: 0, limbs: 3, flat: 0.3, peak: 0, shift: 0, tiers: 0, droop: 0, strands: 44, hem: 0.1,
  },
};

/** Which look an age wears, by what the table says it looks like and then by its id. */
export function ageKeyOf(age: TreeAge): AgeKey {
  if (age.look === 'bare') return 'shrivelled';
  if (age.look === 'clipped') return 'clipped';
  if (age.look === 'worn') return 'veryOld';
  return age.id === 3 ? 'sapling' : age.id === 1 ? 'mature' : age.id === 2 ? 'old' : 'young';
}

/**
 * How each age changes a species' mature tree. A species' `ages` entry is
 * applied after this and wins.
 */
const AGE_RULES: Record<AgeKey, (s: Shape) => Partial<Shape>> = {
  sapling: (s) => ({
    trunk: Math.min(0.5, s.trunk * 1.2), girth: s.girth * 0.72, clusters: Math.max(6, Math.round(s.clusters * 0.42)),
    clusterSize: s.clusterSize * 1.22, limbs: Math.min(2, s.limbs), gnarl: 0, flare: 1 + (s.flare - 1) * 0.4,
    tiers: Math.max(4, s.tiers - 3), strands: Math.round(s.strands * 0.55), dead: 0, hollow: false, gaps: 0,
  }),
  young: (s) => ({
    girth: s.girth * 0.84, clusters: Math.round(s.clusters * 0.7), clusterSize: s.clusterSize * 1.1, gnarl: s.gnarl * 0.5,
    flare: 1 + (s.flare - 1) * 0.7, tiers: Math.max(5, s.tiers - 1), strands: Math.round(s.strands * 0.8), dead: 0, hollow: false,
  }),
  mature: () => ({}),
  old: (s) => ({
    girth: s.girth * 1.32, width: s.width * 1.06, clusters: Math.round(s.clusters * 1.12), gnarl: Math.min(1, s.gnarl + 0.35),
    flare: s.flare * 1.12, limbs: s.limbs + 1, strands: Math.round(s.strands * 1.1),
  }),
  veryOld: (s) => ({
    girth: s.girth * 1.5, width: s.width * 1.04, gnarl: Math.min(1, s.gnarl + 0.7), flare: s.flare * 1.18, hollow: true,
    dead: Math.max(s.dead, 3), gaps: Math.max(s.gaps, 0.5), limbs: s.limbs + 1, clusters: Math.round(s.clusters * 1.05),
  }),
  shrivelled: (s) => ({ girth: s.girth * 1.3, gnarl: Math.min(1, s.gnarl + 0.4), limbs: Math.max(3, s.limbs) }),
  clipped: (s) => ({
    height: 30, trunk: 0.34, width: 2.6, flat: 0.55, peak: -0.2, shift: 0, clusters: 9, clusterSize: 0.36, gaps: 0,
    girth: Math.max(0.07, s.girth * 1.4), limbs: 3, gnarl: 0.2, dead: 0, hollow: false,
  }),
};

/** A species' tree at an age: its form's defaults, its own mature shape, the age's rules, then its own word for that age. */
export function shapeOf(look: TreeLook, key: AgeKey): Shape {
  const base: Shape = { ...DEFAULTS[key === 'clipped' ? 'broadleaf' : look.form], ...look.shape };
  return { ...base, ...AGE_RULES[key](base), ...look.ages?.[key] };
}

type Box = { w: number; h: number; ax: number; ay: number };

/** Every tree's own seed, so every oak is the same oak and no two species wear the same wobble. */
const seedOf = (species: number): number => species * 7.13 + 1.7;

/** The leaf a day calls for, worked out from the species' own summer leaf. */
function leafOf(L: TreeLook, name: string, season: Season, look: Leafage, worn: boolean): { leaf: Tones; turned: Tones | null; share: number } {
  let leaf: Tones = L.leaf;
  let turned: Tones | null = null;
  let share = 0;
  if (look.palette || look.turning) {
    const au = L.autumn ?? AUTUMN[name] ?? L.leaf;
    if (season === 'spring') leaf = fresh(L.leaf);
    else if (season === 'winter') leaf = wintry(L.leaf);
    else if (season === 'autumn') {
      if (look.turning) {
        turned = au;
        share = look.turning.share;
      } else leaf = au;
    }
  }
  const dull = (t: Tones): Tones => t.map((c) => dulled(c, 0.16)) as unknown as Tones;
  return { leaf: worn ? dull(leaf) : leaf, turned: turned && worn ? dull(turned) : turned, share };
}

export function paintTree(ctx: CanvasRenderingContext2D, species: number, variant: number, season: Season,
  look: Leafage, box: Box): void {
  const L = TREE_LOOKS[species] ?? TREE_LOOKS[0];
  const def = TREE_DEFS[species] ?? TREE_DEFS[0];
  const age = TREE_AGES[variant] ?? TREE_AGES[0];
  const ageKey = ageKeyOf(age);
  const shape = shapeOf(L, ageKey);
  const size = def.size * age.size;
  const seed = seedOf(species);
  const worn = ageKey === 'veryOld';
  const { leaf, turned, share } = leafOf(L, def.name, season, look, worn);
  const bloom = look.bloom;
  const keep = bloom ? Math.max(look.full, bloom.cover * (worn ? 0.62 : 1)) : look.full;
  const info: PaintInfo = {
    species, name: def.name, age, ageKey, season, look, shape, leaf, turned, turning: share,
    bark: ageKey === 'shrivelled' ? dulled(L.bark, 0.32) : worn ? dulled(L.bark, 0.12) : L.bark,
    keep, bloom,
    fruiting: !!L.fruit && age.bears && !bloom && look.full >= 1,
    wob: (i) => wob(seed, i),
  };
  const bx = box.ax;
  const by = box.ay;
  const form: Form = ageKey === 'clipped' ? 'broadleaf' : L.form;
  const geo = form === 'conifer' ? conifer(shape, size, bx, by, seed, ageKey)
    : form === 'weeping' ? weeping(shape, size, bx, by, seed, keep)
      : broadleaf(shape, size, bx, by, seed);
  L.layout?.(geo, info);

  if (look.litter) paintLitter(ctx, bx, by, 8 + 12 * size, seed + 3, look.litter.tones, look.litter.n, look.litter.leaf);
  contact(ctx, bx, by, Math.max(geo.trunk.w0 * 3.2, geo.crown.rx * (form === 'conifer' ? 0.62 : 0.72)));

  // Too big for its box: drawn smaller about its foot, never in a bigger box.
  const fit = fitIn(geo, box);
  ctx.save();
  if (fit < 1) {
    ctx.translate(bx, by);
    ctx.scale(fit, fit);
    ctx.translate(-bx, -by);
  }
  if (form === 'conifer') paintConifer(ctx, L, geo, info, seed);
  else if (form === 'weeping') paintWeeping(ctx, L, geo, info, seed);
  else paintBroadleaf(ctx, L, geo, info, seed);
  L.extra?.(ctx, geo, info);
  ctx.restore();
}

/* ---- Geometry --------------------------------------------------------------- */

const empty = (): Pick<TreeGeometry, 'limbs' | 'clusters' | 'tiers' | 'strands' | 'dead'> =>
  ({ limbs: [], clusters: [], tiers: [], strands: [], dead: [] });

/** Main limbs off the top of a trunk, spread across the upper crown. */
function limbsTo(x: number, y: number, w: number, n: number, crown: TreeGeometry['crown'], seed: number, open = 0.62): Limb[] {
  const out: Limb[] = [];
  for (let j = 0; j < n; j++) {
    const u = n === 1 ? 0.5 : j / (n - 1);
    const a = -Math.PI / 2 + (u - 0.5) * 2.3 + (wob(seed, 200 + j) - 0.5) * 0.4;
    const reach = open * (0.85 + 0.3 * wob(seed, 210 + j));
    const x1 = crown.cx + Math.cos(a) * crown.rx * reach;
    const y1 = crown.cy + Math.sin(a) * crown.ry * reach * 0.9;
    out.push({
      x0: x + (u - 0.5) * w * 0.5, y0: y + w * 0.9,
      cx: x + (x1 - x) * 0.55 + (u - 0.5) * w * 0.6, cy: y + (y1 - y) * 0.4,
      x1, y1,
      w0: w * (0.62 - 0.16 * Math.abs(u - 0.5)), w1: w * 0.18,
    });
  }
  return out;
}

/** Dead limbs standing out of a crown, on the side `toward` (an angle) where it has thinned. */
function deadOf(n: number, crown: TreeGeometry['crown'], w: number, seed: number, toward = -Math.PI / 2): Limb[] {
  const out: Limb[] = [];
  for (let j = 0; j < n; j++) {
    const u = n === 1 ? 0.5 : j / (n - 1);
    const a = toward + (u - 0.5) * 1.5 + (wob(seed, 260 + j) - 0.5) * 0.4;
    const x0 = crown.cx + Math.cos(a) * crown.rx * 0.3;
    const y0 = crown.cy + Math.sin(a) * crown.ry * 0.3;
    const len = Math.min(crown.rx, crown.ry) * (0.42 + 0.2 * wob(seed, 270 + j));
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len - len * 0.15;
    const bend = (wob(seed, 280 + j) - 0.5) * len * 0.5;
    out.push({ x0, y0, cx: (x0 + x1) / 2 - Math.sin(a) * bend, cy: (y0 + y1) / 2 + Math.cos(a) * bend, x1, y1, w0: w, w1: w * 0.25 });
  }
  return out;
}

function broadleaf(s: Shape, size: number, bx: number, by: number, seed: number): TreeGeometry {
  const H = s.height * size;
  const top = by - H;
  const low = by - H * s.trunk;
  const ry = (low - top) / 2;
  const rx = ry * s.width;
  const w0 = H * s.girth;
  const lean = s.lean * w0 * 1.6;
  const cx = bx + lean + s.shift * rx;
  const cy = top + ry;
  const crown = { cx, cy, rx, ry };
  // The trunk stops just under the crown and forks there, so the fork shows.
  const trunk = { x0: bx, y0: by, x1: bx + lean, y1: low + ry * 0.06, w0, w1: w0 * 0.52 };
  const g: TreeGeometry = { foot: { x: bx, y: by }, height: H, trunk, crown, ...empty() };
  g.limbs = limbsTo(trunk.x1, trunk.y1, trunk.w1, Math.max(1, Math.round(s.limbs)), crown, seed);
  // A thin crown is thin on one side: the side its dead wood stands out of.
  const deadSide = wob(seed, 250) > 0.5 ? -Math.PI * 0.28 : -Math.PI * 0.72;
  const dsx = Math.cos(deadSide);
  const dsy = Math.sin(deadSide);
  const n = Math.max(1, Math.round(s.clusters));
  for (let i = 0; i < n; i++) {
    // Sunflower order: even cover with no grid in it.
    const rr = Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996 + seed;
    let ux = Math.cos(a) * rr + (wob(seed, 300 + i) - 0.5) * 0.14;
    let uy = Math.sin(a) * rr + (wob(seed, 330 + i) - 0.5) * 0.14;
    ux *= 1 + s.peak * 0.4 * uy;
    if (uy > 0) uy *= 1 - s.flat * 0.5;
    const r = s.clusterSize * rx * (0.8 + 0.4 * wob(seed, 360 + i));
    const x = cx + ux * Math.max(rx * 0.2, rx - r * 0.82);
    const y = cy + uy * Math.max(ry * 0.2, ry - r * 0.82);
    const lit = Math.max(-1, Math.min(1, ux * LX + uy * LY + (wob(seed, 390 + i) - 0.5) * 0.4));
    const away = Math.max(0, ux * dsx + uy * dsy);
    g.clusters.push({ x, y, r, lit, seed: i, hide: wob(seed, 420 + i) < s.gaps * (0.3 + 1.7 * away) });
  }
  g.dead = deadOf(Math.round(s.dead), crown, trunk.w1 * 0.42, seed, deadSide);
  return g;
}

function conifer(s: Shape, size: number, bx: number, by: number, seed: number, key: AgeKey): TreeGeometry {
  const H = s.height * size;
  const base = by - H * s.trunk;
  const n = Math.max(2, Math.round(s.tiers));
  const W = (H * s.width) / 2;
  const step = (base - (by - H)) / (n + 0.35);
  const w0 = H * s.girth;
  const lean = s.lean * w0 * 1.5;
  const crown = { cx: bx + lean * 0.5, cy: by - H * (s.trunk + (1 - s.trunk) * 0.45), rx: W, ry: (base - (by - H)) / 2 };
  const trunk = { x0: bx, y0: by, x1: bx + lean, y1: key === 'shrivelled' ? by - H * 0.92 : by - H * 0.78, w0, w1: w0 * 0.34 };
  const g: TreeGeometry = { foot: { x: bx, y: by }, height: H, trunk, crown, ...empty() };
  if (key === 'shrivelled') {
    // A conifer dies into a pole with the stubs of its whorls down it.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const y = by - H * (0.3 + 0.58 * t);
      const x = bx + lean * (y - by) / (trunk.y1 - by);
      const arm = W * (0.42 - 0.26 * t) * (0.7 + 0.6 * wob(seed, 240 + i));
      for (const side of [-1, 1]) {
        const ax = arm * (side > 0 ? 1 : 0.8 + 0.4 * wob(seed, 250 + i));
        g.limbs.push({ x0: x, y0: y, cx: x + side * ax * 0.6, cy: y - ax * 0.05, x1: x + side * ax, y1: y + ax * 0.32, w0: w0 * 0.32, w1: w0 * 0.1 });
      }
    }
    return g;
  }
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 1 : i / (n - 1);
    const bottom = base - i * step + step * 0.25;
    const tierTop = i === n - 1 ? by - H : bottom - step * 1.85;
    const reach = W * Math.pow(1 - u * 0.86, 0.95) * (0.92 + 0.16 * wob(seed, 140 + i));
    g.tiers.push({
      ax: bx + lean * (1 - u * 0.2),
      top: tierTop,
      bottom,
      left: reach * (0.88 + 0.24 * wob(seed, 150 + i)),
      right: reach * (0.88 + 0.24 * wob(seed, 160 + i)),
      droop: step * s.droop * (1 - u * 0.4),
      seed: seed + i * 1.37,
    });
  }
  if (s.gaps > 0) {
    // An old conifer dies back down one side of its upper half: the boughs
    // there are stubs, and the bare arms they grew on stand out past them.
    const side = wob(seed, 180) > 0.5 ? 1 : -1;
    g.tiers.forEach((t, i) => {
      const u = i / Math.max(1, n - 1);
      if (u < 1 - s.gaps * 1.5 || i === n - 1) return;
      const was = side > 0 ? t.right : t.left;
      const left = was * (0.18 + 0.2 * wob(seed, 185 + i));
      if (side > 0) t.right = left;
      else t.left = left;
      if (g.dead.length >= s.dead + 2) return;
      const y = t.top + (t.bottom - t.top) * 0.55;
      const len = was * (0.95 + 0.2 * wob(seed, 190 + i));
      g.dead.push({ x0: t.ax, y0: y, cx: t.ax + side * len * 0.5, cy: y - len * 0.02, x1: t.ax + side * len, y1: y - len * 0.3, w0: w0 * 0.42, w1: w0 * 0.1 });
    });
  }
  return g;
}

function weeping(s: Shape, size: number, bx: number, by: number, seed: number, keep: number): TreeGeometry {
  const H = s.height * size;
  const top = by - H;
  const ry = H * (1 - s.trunk) * 0.42;
  const rx = (H * (1 - s.trunk) * s.width) / 2;
  const w0 = H * s.girth;
  const lean = s.lean * w0 * 1.6;
  const cx = bx + lean;
  const cy = top + ry;
  const crown = { cx, cy, rx, ry };
  const trunk = { x0: bx, y0: by, x1: bx + lean, y1: by - H * s.trunk, w0, w1: w0 * 0.62 };
  const g: TreeGeometry = { foot: { x: bx, y: by }, height: H, trunk, crown, ...empty() };
  g.limbs = limbsTo(trunk.x1, trunk.y1, trunk.w1, Math.max(1, Math.round(s.limbs)), crown, seed, 0.7);
  const n = Math.max(1, Math.round(s.clusters));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const r = s.clusterSize * rx * (0.8 + 0.4 * wob(seed, 360 + i));
    const ux = u * 0.82 + (wob(seed, 300 + i) - 0.5) * 0.15;
    const uy = -Math.sqrt(Math.max(0, 1 - ux * ux)) * (0.35 + 0.5 * wob(seed, 330 + i));
    const lit = Math.max(-1, Math.min(1, ux * LX + uy * LY));
    g.clusters.push({ x: cx + ux * (rx - r * 0.6), y: cy + uy * (ry - r * 0.5), r, lit, seed: i });
  }
  const hem = by - H * s.hem;
  const m = Math.max(2, Math.round(s.strands));
  for (let j = 0; j < m; j++) {
    // Three curtains: one behind the trunk hung from the back of the dome,
    // one in front of it, and one laid over the top of the dome and arching
    // out and down over everything, so the dome itself is strands. The two
    // in front part in the middle, so the trunk shows through.
    const layer = j % 3;
    const u = (Math.floor(j / 3) / Math.max(1, Math.floor((m - 1) / 3))) * 2 - 1 + (wob(seed, 600 + j) - 0.5) * 0.14;
    const dome = Math.sqrt(Math.max(0, 1 - u * u));
    const y = layer === 2 ? cy - ry * dome * (0.85 + 0.15 * wob(seed, 610 + j))
      : cy - ry * dome * (layer === 0 ? 0.7 : 0.35 * wob(seed, 610 + j)) + ry * (layer === 0 ? 0.05 : 0.35);
    const part = layer === 0 ? 0 : Math.max(0, 1 - Math.abs(u) / 0.32) * H * (layer === 2 ? 0.26 : 0.18);
    const end = hem - H * 0.09 * wob(seed, 620 + j) - part;
    const root = layer === 2 ? 0.55 : 0.8;
    g.strands.push({
      x: cx + u * rx * root,
      y,
      len: Math.max(2, end - y),
      arch: u * rx * (layer === 2 ? 0.42 : 0.2 + 0.08 * wob(seed, 670 + j)),
      sway: u * rx * 0.04 + (wob(seed, 640 + j) - 0.5) * rx * 0.08,
      w: rx * (0.026 + 0.01 * wob(seed, 650 + j)),
      layer,
      seed: j,
      bare: wob(seed, 660 + j) >= keep,
    });
  }
  return g;
}

/** The leaf a crown that is not green in summer shows among its blossom. */
const SPRING_GREEN: Tones = ['#a6d06c', '#62a046', '#356c36'];

/** How much a tree has to shrink to sit inside its box. */
function fitIn(g: TreeGeometry, box: Box): number {
  let minX = g.foot.x;
  let maxX = g.foot.x;
  let minY = g.foot.y;
  const take = (x0: number, x1: number, y: number): void => {
    if (x0 < minX) minX = x0;
    if (x1 > maxX) maxX = x1;
    if (y < minY) minY = y;
  };
  take(g.crown.cx - g.crown.rx, g.crown.cx + g.crown.rx, g.crown.cy - g.crown.ry);
  for (const c of g.clusters) if (!c.hide) take(c.x - c.r, c.x + c.r, c.y - c.r);
  for (const t of g.tiers) if (!t.hide) take(t.ax - t.left, t.ax + t.right, t.top);
  for (const s of g.strands) take(Math.min(s.x, s.x + s.arch + s.sway) - s.w * 1.4, Math.max(s.x, s.x + s.arch + s.sway) + s.w * 1.4, s.y - s.len * 0.04);
  for (const l of [...g.limbs, ...g.dead]) take(Math.min(l.x0, l.x1) - l.w1, Math.max(l.x0, l.x1) + l.w1, Math.min(l.y0, l.y1) - l.w1);
  const fx = Math.min((box.ax - 1) / Math.max(1, g.foot.x - minX), (box.w - box.ax - 1) / Math.max(1, maxX - g.foot.x));
  const fy = (box.ay - 1) / Math.max(1, g.foot.y - minY);
  return Math.min(1, fx, fy);
}

/* ---- Painting --------------------------------------------------------------- */

function boleFor(g: TreeGeometry, s: Shape, seed: number): Bole {
  const t = g.trunk;
  return boleOf(t.x0, t.y0, t.x1, t.y1, t.w0, t.w1, s.flare, s.gnarl, seed);
}

/** The tones a clump is painted in: three neighbours on its ramp, by which way it faces. */
function tonesFor(r: Ramp, lit: number, back: boolean): [string, string, string] {
  let b = lit > 0.55 ? 2 : lit > -0.3 ? 1 : 0;
  if (back) b = Math.max(0, b - 1);
  return [r[b], r[b + 1], r[b + 2]];
}

function paintWood(ctx: CanvasRenderingContext2D, L: TreeLook, g: TreeGeometry, info: PaintInfo, seed: number): Bole {
  const bole = boleFor(g, info.shape, seed);
  const roots = info.ageKey === 'sapling' || info.ageKey === 'clipped' ? 0 : info.ageKey === 'young' ? 2 : 3;
  paintTrunk(ctx, bole, info.bark, seed, L.marks ?? 'furrows', roots);
  if (info.shape.hollow) paintHollow(ctx, bole, info.bark);
  return bole;
}

/** A limb cut back to `k` of its length, tapering to the same tip. */
function shortened(l: Limb, k: number): Limb {
  return {
    x0: l.x0, y0: l.y0, cx: l.x0 + (l.cx - l.x0) * k, cy: l.y0 + (l.cy - l.y0) * k,
    x1: l.x0 + (l.x1 - l.x0) * k, y1: l.y0 + (l.y1 - l.y0) * k, w0: l.w0, w1: l.w1 + (l.w0 - l.w1) * (1 - k) * 0.6,
  };
}

/** The dead wood of a very old tree, over everything else. */
function paintDead(ctx: CanvasRenderingContext2D, g: TreeGeometry, info: PaintInfo, seed: number): void {
  if (!g.dead.length) return;
  const wood = dulled(info.bark, 0.18);
  paintLimbs(ctx, g.dead, wood, 0.15);
  const c = g.crown;
  paintTwigs(ctx, g.dead, 3, tone(wood, -0.12), { cx: c.cx, cy: c.cy - c.ry * 0.15, rx: c.rx * 1.3, ry: c.ry * 1.4 }, seed + 11, 0.62, 0.66);
}

function paintBroadleaf(ctx: CanvasRenderingContext2D, L: TreeLook, g: TreeGeometry, info: PaintInfo, seed: number): void {
  const c = g.crown;
  paintWood(ctx, L, g, info, seed);
  if (info.ageKey === 'shrivelled') {
    // Dead wood standing up: the limbs it grew and the forks off them, and nothing past that.
    const stubs = g.limbs.map((l) => shortened(l, 0.55));
    paintLimbs(ctx, stubs, info.bark, 0.18);
    paintTwigs(ctx, stubs, 4, tone(info.bark, -0.08), { cx: c.cx, cy: c.cy, rx: c.rx * 0.92, ry: c.ry * 1.05 }, seed, 0.66, 0.68);
    return;
  }
  const keep = info.keep;
  // With the leaf off, the limbs stop short and the twigs carry on into the crown's outline.
  const limbs = keep < 1 ? g.limbs.map((l) => shortened(l, 0.6)) : g.limbs;
  const leafRamp = rampOf(info.leaf);
  const turnRamp = info.turned ? rampOf(info.turned) : null;
  const bloomRamp = info.bloom ? rampOf(info.bloom.tones) : null;
  // The new leaf among blossom is green whatever the summer crown is: a pink
  // or purple crown taken toward fresh green comes out the colour of tea.
  const green = parseInt(L.leaf[1].slice(3, 5), 16) > parseInt(L.leaf[1].slice(1, 3), 16);
  const budRamp = info.bloom ? rampOf(newLeaf(green ? L.leaf : SPRING_GREEN) as unknown as Tones) : null;
  const shown: Cluster[] = [];
  for (const cl of g.clusters) {
    if (cl.hide) continue;
    if (keep < 1 && wob(seed, 1400 + cl.seed) >= keep) continue;
    shown.push(keep < 1 ? { ...cl, r: cl.r * (0.62 + 0.38 * keep) } : cl);
  }
  // Rim clumps go behind the limbs and inner ones in front, so the wood shows between them.
  // And the clumps low in the middle go behind too, so the fork shows going up into the crown.
  const rim = (cl: Cluster): boolean => {
    const ux = (cl.x - c.cx) / c.rx;
    const uy = (cl.y - c.cy) / c.ry;
    return Math.hypot(ux, uy) > 0.6 || (uy > 0.15 && Math.abs(ux) < 0.4);
  };
  const back = shown.filter(rim).sort((a, b) => a.y - b.y);
  const front = shown.filter((cl) => !rim(cl)).sort((a, b) => a.y - b.y);
  const rampOfCluster = (cl: Cluster): Ramp => {
    if (bloomRamp && budRamp) return wob(seed, 1300 + cl.seed) < (info.bloom?.cover ?? 0) ? bloomRamp : budRamp;
    if (turnRamp) {
      const order = wob(seed, 1200 + cl.seed) * 0.6 + (1 - (cl.lit + 1) / 2) * 0.4;
      if (order < info.turning) return turnRamp;
    }
    return leafRamp;
  };
  const flecks = new Flecks();
  const paintSet = (set: Cluster[], isBack: boolean): void => {
    for (const cl of set) {
      const t = cl.tones ? [cl.tones[2], cl.tones[1], cl.tones[0]] : tonesFor(rampOfCluster(cl), cl.lit, isBack);
      // A clump at the back of the shaded side catches no sun of its own.
      paintCluster(ctx, cl, t[0], t[1], t[2], L.cluster, seed, flecks, !(isBack && cl.lit < -0.3));
    }
    flecks.flush(ctx);
  };
  paintSet(back, true);
  paintLimbs(ctx, limbs, info.bark, 0.14);
  const bare = keep <= 0 ? 5 : keep < 1 ? 4 : info.shape.gaps > 0.2 ? 3 : 1;
  const reach = keep < 1 || bare > 1 ? 0.98 : 0.75;
  paintTwigs(ctx, limbs, bare, L.twig ?? tone(info.bark, keep < 1 || bare > 1 ? -0.12 : -0.32),
    { cx: c.cx, cy: c.cy, rx: c.rx * reach, ry: c.ry * reach }, seed, keep < 1 ? 0.72 : 0.56, 0.68);
  L.beforeCrown?.(ctx, g, info);
  paintSet(front, false);
  if (info.bloom && bloomRamp) {
    const inFlower = shown.filter((cl) => wob(seed, 1300 + cl.seed) < info.bloom!.cover && cl.lit > -0.4);
    paintFlowers(ctx, inFlower, info.bloom.tones[0], info.bloom.eye, seed, Math.max(0.4, c.rx * 0.028));
  }
  if (info.fruiting && L.fruit) paintFruitOn(ctx, L, g, info, shown, seed);
  paintDead(ctx, g, info, seed);
}

/** Fruit dotted through the lower half of the clumps that show, never two touching. */
function paintFruitOn(ctx: CanvasRenderingContext2D, L: TreeLook, g: TreeGeometry, info: PaintInfo, shown: Cluster[], seed: number): void {
  const f = L.fruit!;
  const by = { mature: 1, old: 1.15, veryOld: 0.7 } as Record<AgeKey, number>;
  const want = Math.round(f.count * (by[info.ageKey] ?? 0.6));
  const r = Math.max(0.7, g.crown.rx * 0.042 * f.size);
  const spots: Array<[number, number]> = [];
  const order = shown.map((cl) => ({ cl, k: wob(seed, 1500 + cl.seed) + (cl.lit < -0.5 ? 0.5 : 0) })).sort((a, b) => a.k - b.k);
  for (let pass = 0; pass < 3 && spots.length < want; pass++) {
    for (const { cl } of order) {
      if (spots.length >= want) break;
      const x = cl.x + (wob(seed, 1600 + cl.seed * 3 + pass) - 0.5) * cl.r * 1.1;
      const y = cl.y + cl.r * (0.05 + 0.5 * wob(seed, 1700 + cl.seed * 3 + pass));
      if (spots.some(([px, py]) => Math.hypot(px - x, py - y) < r * 3)) continue;
      spots.push([x, y]);
    }
  }
  paintFruit(ctx, spots, r, f.colour, f.shape);
}

function paintConifer(ctx: CanvasRenderingContext2D, L: TreeLook, g: TreeGeometry, info: PaintInfo, seed: number): void {
  if (info.ageKey === 'shrivelled') {
    paintLimbs(ctx, g.limbs, dulled(info.bark, 0.1), 0.2);
    paintWood(ctx, L, g, info, seed);
    return;
  }
  paintWood(ctx, L, g, info, seed);
  const ramp = rampOf(info.leaf);
  L.beforeCrown?.(ctx, g, info);
  if (g.dead.length) paintDead(ctx, g, info, seed);
  const n = g.tiers.length;
  g.tiers.forEach((t, i) => {
    if (t.hide) return;
    paintTier(ctx, t, ramp, (i / Math.max(1, n - 1)) * 0.9 + (wob(seed, 170 + i) - 0.5) * 0.4);
  });
}

function paintWeeping(ctx: CanvasRenderingContext2D, L: TreeLook, g: TreeGeometry, info: PaintInfo, seed: number): void {
  const c = g.crown;
  if (info.ageKey === 'shrivelled') {
    paintWood(ctx, L, g, info, seed);
    const stubs = g.limbs.map((l) => shortened(l, 0.55));
    paintLimbs(ctx, stubs, info.bark, 0.18);
    paintTwigs(ctx, stubs, 4, tone(info.bark, -0.08), { cx: c.cx, cy: c.cy, rx: c.rx * 0.9, ry: c.ry * 1.1 }, seed, 0.62, 0.7);
    return;
  }
  const leaf = info.turned && info.turning >= 0.5 ? info.turned : info.leaf;
  const r = rampOf(leaf);
  const withy = dulled(mix(info.bark, '#c8b878', 0.6), info.ageKey === 'veryOld' ? 0.3 : 0);
  const keep = info.keep;
  const layer = (k: number): Strand[] => g.strands.filter((s) => s.layer === k);
  const leafy = (ss: Strand[]): Strand[] => ss.filter((s) => !s.bare);
  const thin = info.ageKey === 'veryOld' ? (s: Strand): boolean => wob(seed, 700 + s.seed) > 0.3 : (): boolean => true;
  const twig = Math.max(0.35, c.rx * 0.012);
  // Lit down the sunward side of the tree, shaded down the other.
  const sunward = (s: Strand): boolean => s.x + s.arch < c.cx + (wob(seed, 680 + s.seed) - 0.5) * c.rx * 0.7;
  const hang = (ss: Strand[], dark: number): void => {
    const shown = leafy(ss).filter(thin);
    paintStrands(ctx, shown.filter((s) => !sunward(s)), r[dark], r[dark + 1]);
    paintStrands(ctx, shown.filter(sunward), r[dark + 1], r[dark + 2]);
  };
  paintWithies(ctx, layer(0).filter((s) => s.bare), withy, twig);
  hang(layer(0), 0);
  paintWood(ctx, L, g, info, seed);
  paintLimbs(ctx, g.limbs, info.bark, 0.3);
  const bare = keep <= 0 ? 3 : keep < 1 ? 2 : 1;
  paintTwigs(ctx, g.limbs, bare, L.twig ?? tone(info.bark, -0.2), c, seed, 0.6, 0.66);
  L.beforeCrown?.(ctx, g, info);
  for (const cl of g.clusters) {
    if (keep < 1 && wob(seed, 1400 + cl.seed) >= keep) continue;
    const t = tonesFor(r, cl.lit, true);
    paintCluster(ctx, cl, t[0], t[1], t[2], L.cluster, seed);
  }
  paintWithies(ctx, layer(1).filter((s) => s.bare), withy, twig);
  hang(layer(1), 1);
  paintWithies(ctx, layer(2).filter((s) => s.bare), withy, twig);
  hang(layer(2), 2);
  paintDead(ctx, g, info, seed);
}
