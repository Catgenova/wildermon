/**
 * Trees drawn as solids, for the species in `TREE3D_SPECIES`: grown in three
 * dimensions from a seed (`./skeleton`), seen from the camera's turn, lit by
 * the island's sun at its step of the day (`./light`), painted (`./paint`)
 * and baked once for each way it can be seen, kept so many pixels' worth and
 * the least lately drawn let go. Every other species is drawn by
 * `../trees` as it always was; taking a species out of the set puts it back.
 *
 * A bake is keyed by everything it is drawn from: the scale, the species, its
 * age, which of `FORMS` grown shapes the tile has, the day's dress, the turn,
 * the sun's step and the wind's frame. A frame makes bakes for at most
 * `BAKE_MS`; past that a tree is shown by its nearest bake already made --
 * the same sun a frame of the wind back, the sun's last step, the last turn --
 * so a step of the sun or a turn of the camera is made over a few frames
 * rather than in one.
 */
import type { Season } from '../../world/calendar';
import { hash2 } from '../../world/noise';
import { TREE_AGES, TREE_DEFS } from '../../world/tiles';
import { LEAFING, LEAVES_DOWN, lookStep, SHEDDING, TURNING } from '../foliage';
import { eyeOf, proj } from '../runestone';
import { ageKeyOf } from '../trees/tree';
import type { AgeKey } from '../trees/types';
import { lightOf, SUN_STEPS, sunStepOf } from './light';
import { ACROSS, boundsOf, footReach, footShade, paintTree3d, shownOf } from './paint';
import { grow, swayed } from './skeleton';
import { birch } from './species/birch';
import { cedar } from './species/cedar';
import { maple } from './species/maple';
import { oak } from './species/oak';
import { pine } from './species/pine';
import { willow } from './species/willow';
import type { Build, Dress, Skeleton, Species3D, V3 } from './types';

export { sunStepOf, SUN_STEPS } from './light';

const byName = (name: string): number => TREE_DEFS.findIndex((d) => d.name === name);

/** The species drawn as solids, by their `TREE_DEFS` index, and what each is. */
const SPECIES: ReadonlyMap<number, Species3D> = new Map([
  [byName('Maple'), maple],
  [byName('Oak'), oak],
  [byName('Pine'), pine],
  [byName('Birch'), birch],
  [byName('Cedar'), cedar],
  [byName('Willow'), willow],
]);
/** Which species are drawn here: take one out and it is drawn flat again. */
export const TREE3D_SPECIES: Set<number> = new Set(SPECIES.keys());

/** How many shapes each species grows at each age; a tile wears one of them. */
export const FORMS = 3;
/** Frames of the wind, gone round one after another, `SWAY_MS` each. */
export const SWAY_FRAMES = 4;
export const SWAY_MS = 260;
/**
 * What a frame may make, bakes and shades together, when an older one can
 * stand in: so many milliseconds, and so many of them. The count is the one
 * that holds: a canvas's drawing is mostly done when it is first copied, not
 * when it is drawn, so the clock here sees only part of what a bake costs.
 */
const BAKE_MS = 4;
const MAKE_MOST = 1;
/** Pixels of bakes kept. */
const PIXELS = 20_000_000;

export interface TreeSprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
  /** Drawn here: its pictures are its tile's, whichever bake it is (`Renderer.treePicture`). */
  solid: true;
}

/** Where a tree is seen from and when. */
export interface TreeView {
  x: number;
  y: number;
  /** The camera's turn, 0 to 7. */
  turn: number;
  hour: number;
  dark: number;
  /** The wind's frame, 0 to `SWAY_FRAMES - 1`. */
  sway: number;
}

/** Which of `FORMS` a tile's tree is grown as. */
export const formAt = (x: number, y: number): number => Math.floor(hash2(Math.round(x), Math.round(y), 5309) * FORMS) % FORMS;
/** The wind's frame a tile's tree is at: each its own beat. */
export const swayAt = (x: number, y: number, ms: number): number =>
  Math.floor(ms / SWAY_MS + hash2(Math.round(x), Math.round(y), 811) * SWAY_FRAMES) % SWAY_FRAMES;

/* ---- what a tree is ---------------------------------------------------------------- */

function buildOf(spec: Species3D, key: AgeKey): Build {
  return { ...spec.build, ...spec.ages[key] };
}

const skeletons = new Map<string, Skeleton>();
function skeletonOf(species: number, variant: number, form: number): Skeleton {
  const k = `${species}|${variant}|${form}`;
  let sk = skeletons.get(k);
  if (sk) return sk;
  const spec = SPECIES.get(species) ?? maple;
  const def = TREE_DEFS[species] ?? TREE_DEFS[0];
  const age = TREE_AGES[variant] ?? TREE_AGES[0];
  const b = buildOf(spec, ageKeyOf(age));
  sk = grow(b, b.height * def.size * age.size, seedOf(species, variant, form));
  skeletons.set(k, sk);
  return sk;
}
const seedOf = (species: number, variant: number, form: number): number => species * 7919 + variant * 131 + form * 17 + 3;

/** A day's dress for a tree at an age, and its name for a bake's key. */
export function dressOf(variant: number, season: Season, day: number): { dress: Dress; key: string } {
  const age = TREE_AGES[variant] ?? TREE_AGES[0];
  const keys = age.bears;
  const step = lookStep(day);
  if (!age.alive) return { dress: { season, step, full: 0, turned: 0, litter: 0, keys: false }, key: season === 'winter' ? 'xw' : 'x' };
  switch (season) {
    case 'spring': {
      const s = Math.min(step, 3);
      return { dress: { season, step: s, full: LEAFING[s], turned: 0, litter: s >= 3 && keys ? 3 : 0, keys }, key: `p${s}` };
    }
    case 'summer':
      return { dress: { season, step: 0, full: 1, turned: 0, litter: keys ? 5 : 0, keys }, key: 'u' };
    case 'autumn':
      return { dress: { season, step, full: SHEDDING[step], turned: TURNING[step], litter: 5 + LEAVES_DOWN[step], keys }, key: `a${step}` };
    default:
      return { dress: { season, step: 0, full: 0, turned: 0, litter: 0, keys: false }, key: 'w' };
  }
}

/* ---- bakes --------------------------------------------------------------------------- */

const bakes = new Map<string, TreeSprite>();
let pixels = 0;
let spent = 0;
let made = 0;
/** What has been made, and how often an older one stood in: for a harness, and for the renderer to know a shade is not yet its sun's own. */
export const tree3dStats = { bakes: 0, ms: 0, standIns: 0, paintMs: 0, shadeStandIns: 0 };

/** A new frame: its own `BAKE_MS` to spend. Called by the renderer once a frame. */
export function tree3dFrame(): void {
  spent = 0;
  made = 0;
}

/** Every bake let go: the season's look has turned (`forgetTrees`). */
export function forgetTrees3d(): void {
  bakes.clear();
  pixels = 0;
}

function keep(key: string, spr: TreeSprite): void {
  bakes.set(key, spr);
  pixels += spr.canvas.width * spr.canvas.height;
  while (pixels > PIXELS && bakes.size > 1) {
    const [k, old] = bakes.entries().next().value as [string, TreeSprite];
    bakes.delete(k);
    pixels -= old.canvas.width * old.canvas.height;
  }
}

function bake(scale: number, species: number, variant: number, form: number, dress: Dress, turn: number, step: number, frame: number): TreeSprite {
  const t0 = performance.now();
  const spec = SPECIES.get(species) ?? maple;
  const seed = seedOf(species, variant, form);
  const sk = swayed(skeletonOf(species, variant, form), frame, SWAY_FRAMES, seed);
  const e = eyeOf(0, turn);
  const [x0, y0, x1, y1] = boundsOf(sk, e);
  const w = x1 - x0, h = y1 - y0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2d context');
  g.scale(scale, scale);
  g.translate(-x0, -y0);
  const t1 = performance.now();
  paintTree3d(g, { sk, spec, dress, light: lightOf(step), e, seed, frame, frames: SWAY_FRAMES });
  tree3dStats.paintMs += performance.now() - t1;
  footShade(g, sk);
  tree3dStats.bakes++;
  tree3dStats.ms += performance.now() - t0;
  return { canvas, w, h, ax: -x0, ay: -y0, solid: true };
}

/**
 * The picture of a tree drawn as a solid, at a scale of pixels to a pixel at
 * zoom one: made now, or a near one standing in while this frame has made
 * all it may.
 */
export function tree3dSprite(species: number, variant: number, season: Season, day: number, at: TreeView, scale: number): TreeSprite {
  const form = formAt(at.x, at.y);
  const { dress, key: look } = dressOf(variant, season, day);
  const step = sunStepOf(at.hour, at.dark);
  // The bare wood has no leaf to move.
  const frame = dress.full > 0 ? at.sway : 0;
  const head = `${scale}|${species}|${variant}|${form}|${look}`;
  const key = `${head}|${at.turn}|${step}|${frame}`;
  const had = bakes.get(key);
  if (had) {
    bakes.delete(key);
    bakes.set(key, had);
    return had;
  }
  if (spent >= BAKE_MS || made >= MAKE_MOST) {
    const near = standIn(head, at.turn, step, frame);
    if (near) {
      tree3dStats.standIns++;
      return near;
    }
  }
  const t0 = performance.now();
  const spr = bake(scale, species, variant, form, dress, at.turn, step, frame);
  spent += performance.now() - t0;
  made++;
  keep(key, spr);
  return spr;
}

/** The nearest bake already made of the same tree in the same dress: still air, the sun's nearest step, then any turn. */
function standIn(head: string, turn: number, step: number, frame: number): TreeSprite | null {
  const tries: string[] = [];
  if (frame) tries.push(`${head}|${turn}|${step}|0`);
  for (let d = 1; d <= 9; d++) for (const s of [step - d, step + d]) if (s >= -1 && s <= 8) tries.push(`${head}|${turn}|${s}|0`);
  for (let t = 1; t < 8; t++) tries.push(`${head}|${(turn + t) % 8}|${step}|0`);
  for (const k of tries) {
    const b = bakes.get(k);
    if (b) return b;
  }
  return null;
}

/* ---- the shade on the ground ------------------------------------------------------- */

/**
 * What a tree throws on the ground, from one turn: a picture of it, solid,
 * `SHADE_SCALE` pixels to a pixel at zoom one, and the box it covers in
 * pixels at zoom one from the tree's foot.
 */
export interface TreeShade {
  canvas: HTMLCanvasElement;
  box: [number, number, number, number];
}
/** How finely a tree's shade is kept: it is soft at the edge whatever it is drawn at. */
const SHADE_SCALE = 2;

/**
 * What a tree throws on the ground at a step of the sun, seen from a turn:
 * lumpy shade on the ground under each mass of leaf, and along its wood. Null when it
 * throws none. The renderer lays it with the ground (`Renderer.solidFrame`).
 */
export function tree3dShadow(species: number, variant: number, season: Season, day: number, x: number, y: number, step: number, turn: number): TreeShade | null {
  const form = formAt(x, y);
  const { dress, key: look } = dressOf(variant, season, day);
  const head = `${species}|${variant}|${form}|${look}|`;
  const k = `${head}${step}|${turn}`;
  if (shadows.has(k)) return shadows.get(k) ?? null;
  // Out of time this frame: the sun's nearest step stands in.
  if (spent >= BAKE_MS || made >= MAKE_MOST) {
    for (let d = 1; d <= SUN_STEPS + 1; d++) {
      for (const s of [step - d, step + d]) {
        const near = shadows.get(`${head}${s}|${turn}`);
        if (near) {
          tree3dStats.shadeStandIns++;
          return near;
        }
      }
    }
  }
  const t0 = performance.now();
  const light = lightOf(step);
  let out: TreeShade | null = null;
  if (light.throw > 0) {
    const sk = skeletonOf(species, variant, form);
    const spec = SPECIES.get(species) ?? maple;
    const e = eyeOf(0, turn);
    const fl = Math.hypot(light.sun[0], light.sun[1]) || 1;
    const dx = (-light.sun[0] / fl) * light.throw, dy = (-light.sun[1] / fl) * light.throw;
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const disc = (p: V3, r: number): void => {
      const z = Math.max(0, p[2]);
      const [sx, sy] = proj(e, [p[0] + dx * z, p[1] + dy * z, 0]);
      const rx = r * ACROSS, ry = rx / 2;
      path.moveTo(sx + rx, sy);
      path.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      x0 = Math.min(x0, sx - rx); x1 = Math.max(x1, sx + rx);
      y0 = Math.min(y0, sy - ry); y1 = Math.max(y1, sy + ry);
    };
    // The trunk's shade starts clear of the trunk and its roots: what is right at its foot is the tree's own (`footShade`), drawn with it.
    const r0 = sk.limbs[0]?.ra ?? 0;
    const clear = r0 * 2.6;
    for (const L of sk.limbs) {
      if (L.order < 0 || L.order > (dress.full > 0 ? 2 : 3)) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1], (L.b[2] - L.a[2]) * light.throw) / (Math.max(0.5, L.rb) * 1.3)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p: V3 = [L.a[0] + (L.b[0] - L.a[0]) * t, L.a[1] + (L.b[1] - L.a[1]) * t, L.a[2] + (L.b[2] - L.a[2]) * t];
        const r = Math.max(0.5, L.ra + (L.rb - L.ra) * t);
        const z = Math.max(0, p[2]);
        if (L.order === 0 && Math.hypot(p[0] + dx * z, p[1] + dy * z) < clear + r) continue;
        disc(p, r);
      }
    }
    const job = { sk, spec, dress, light, e, seed: 0, frame: 0 };
    for (const s of shownOf(job)) {
      // A mass throws a lumpy shade: its middle, and four lumps round it.
      const r = s.c.r * s.grown;
      disc(s.c.c, r * 0.8);
      for (let i = 0; i < 4; i++) {
        const a = s.c.k * 9 + (i * Math.PI) / 2;
        disc([s.c.c[0] + Math.cos(a) * r * 0.42, s.c.c[1] + Math.sin(a) * r * 0.42, s.c.c[2]], r * 0.55);
      }
    }
    if (x1 > x0) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil((x1 - x0) * SHADE_SCALE));
      canvas.height = Math.max(1, Math.ceil((y1 - y0) * SHADE_SCALE));
      const g = canvas.getContext('2d');
      if (g) {
        g.setTransform(SHADE_SCALE, 0, 0, SHADE_SCALE, -x0 * SHADE_SCALE, -y0 * SHADE_SCALE);
        g.fillStyle = 'rgb(30,56,66)';
        g.fill(path);
        out = { canvas, box: [x0, y0, x1, y1] };
      }
    }
  }
  shadows.set(k, out);
  spent += performance.now() - t0;
  made++;
  if (shadows.size > 160) shadows.delete(shadows.keys().next().value as string);
  return out;
}
const shadows = new Map<string, TreeShade | null>();

/** How far round a tile's tree's foot its own shade reaches, in pixels at zoom one across, before it grows (`grownAt`). */
export function tree3dFoot(species: number, variant: number, x: number, y: number): number {
  return footReach(skeletonOf(species, variant, formAt(x, y)));
}
