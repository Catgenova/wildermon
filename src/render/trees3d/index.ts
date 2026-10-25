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
 *
 * The bushes in `BUSH3D` are drawn the same way, by the same bakes, budget,
 * stand-ins and shade: a bush species grows its own model and paints it
 * (`Bush3D`); every other bush is drawn flat (`bushSprite`).
 */
import type { Season } from '../../world/calendar';
import { hash2 } from '../../world/noise';
import { BUSH_DEFS, TREE_AGES, TREE_DEFS } from '../../world/tiles';
import { bushYear, LEAFING, LEAVES_DOWN, lookStep, SHEDDING, TURNING } from '../foliage';
import { eyeOf, proj, type Eye } from '../runestone';
import { ageKeyOf } from '../trees/tree';
import type { AgeKey } from '../trees/types';
import { lightOf, SUN_STEPS, sunStepOf, type Light } from './light';
import { ACROSS, boundsOf, footReach, footShade, paintTree3d, shownOf } from './paint';
import { grow, swayed } from './skeleton';
import { maple } from './species/maple';
import { oak } from './species/oak';
import { pine } from './species/pine';
import { lavender } from './species/lavender';
import { rose } from './species/rose';
import type { Build, Bush3D, Dress, Skeleton, Species3D, V3 } from './types';

export { sunStepOf, SUN_STEPS } from './light';

const byName = (name: string): number => TREE_DEFS.findIndex((d) => d.name === name);

/** The species drawn as solids, by their `TREE_DEFS` index, and what each is. */
const SPECIES: ReadonlyMap<number, Species3D> = new Map([
  [byName('Maple'), maple],
  [byName('Oak'), oak],
  [byName('Pine'), pine],
]);
/** Which species are drawn here: take one out and it is drawn flat again. */
export const TREE3D_SPECIES: Set<number> = new Set(SPECIES.keys());

const bushByName = (name: string): number => BUSH_DEFS.findIndex((d) => d.name === name);
/** The bushes drawn as solids, by their `BUSH_DEFS` index, and what each is: one file in `./species` each. */
const BUSH3D: ReadonlyMap<number, Bush3D> = new Map([
  [bushByName('Rose bush'), rose],
  [bushByName('Lavender bush'), lavender],
]);
/** Which bushes are drawn here: take one out and it is drawn flat again. */
export const BUSH3D_SPECIES: Set<number> = new Set(BUSH3D.keys());

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
  /** A bush's shade at its foot, which the renderer lays (`Sprite.foot`); a tree's is in its bake (`footShade`). */
  foot?: number;
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

/** A model seen from a turn, painted at a scale onto a canvas just its size, its own shade at its foot under it unless the renderer lays that. */
function bake(scale: number, sk: Skeleton, turn: number, paint: (g: CanvasRenderingContext2D, e: Eye) => void, ownFoot = true): TreeSprite {
  const t0 = performance.now();
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
  paint(g, e);
  tree3dStats.paintMs += performance.now() - t1;
  if (ownFoot) footShade(g, sk);
  tree3dStats.bakes++;
  tree3dStats.ms += performance.now() - t0;
  return { canvas, w, h, ax: -x0, ay: -y0, solid: true, foot: ownFoot ? undefined : footReach(sk) };
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
  return baked(`${scale}|${species}|${variant}|${form}|${look}`, at.turn, step, frame, () => {
    const spec = SPECIES.get(species) ?? maple;
    const seed = seedOf(species, variant, form);
    const sk = swayed(skeletonOf(species, variant, form), frame, SWAY_FRAMES, seed);
    return bake(scale, sk, at.turn, (g, e) => paintTree3d(g, { sk, spec, dress, light: lightOf(step), e, seed, frame }));
  });
}

/** The bake under a key's head at a turn, a step of the sun and a frame of the wind: kept, made now, or a near one standing in while this frame has made all it may. */
function baked(head: string, turn: number, step: number, frame: number, make: () => TreeSprite): TreeSprite {
  const key = `${head}|${turn}|${step}|${frame}`;
  const had = bakes.get(key);
  if (had) {
    bakes.delete(key);
    bakes.set(key, had);
    return had;
  }
  if (spent >= BAKE_MS || made >= MAKE_MOST) {
    const near = standIn(head, turn, step, frame);
    if (near) {
      tree3dStats.standIns++;
      return near;
    }
  }
  const t0 = performance.now();
  const spr = make();
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
  return shaded(`${species}|${variant}|${form}|${look}|`, step, turn, (light, e, disc) => {
    const sk = skeletonOf(species, variant, form);
    const spec = SPECIES.get(species) ?? maple;
    // The trunk's shade starts clear of the trunk and its roots: what is right at its foot is the tree's own (`footShade`), drawn with it.
    const r0 = sk.limbs[0]?.ra ?? 0;
    const clear = r0 * 2.6;
    for (const L of sk.limbs) {
      if (L.order < 0 || L.order > (dress.full > 0 ? 2 : 3)) continue;
      alongLimb(L, light, (p, r) => {
        const z = Math.max(0, p[2]);
        if (L.order === 0 && Math.hypot(p[0] + light.dx * z, p[1] + light.dy * z) < clear + r) return;
        disc(p, r);
      });
    }
    const job = { sk, spec, dress, light, e, seed: 0, frame: 0 };
    for (const s of shownOf(job)) lumpyDisc(disc, s.c.c, s.c.r * s.grown, s.c.k);
  });
}

/** How many steps along a limb the shade's discs take to run together. */
const stepsAlong = (L: Skeleton['limbs'][number], light: Light): number =>
  Math.max(1, Math.ceil(Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1], (L.b[2] - L.a[2]) * light.throw) / (Math.max(0.5, L.rb) * 1.3)));

/** Points along a limb close enough for the shade's discs to run together, `spread` times as far apart, and its radius at each. */
function alongLimb(L: Skeleton['limbs'][number], light: Light, at: (p: V3, r: number) => void, spread = 1): void {
  const n = Math.max(1, Math.ceil(stepsAlong(L, light) / spread));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    at([L.a[0] + (L.b[0] - L.a[0]) * t, L.a[1] + (L.b[1] - L.a[1]) * t, L.a[2] + (L.b[2] - L.a[2]) * t], Math.max(0.5, L.ra + (L.rb - L.ra) * t));
  }
}

/** A mass's lumpy shade: its middle, and four lumps round it. */
function lumpyDisc(disc: (p: V3, r: number) => void, c: V3, r: number, k: number): void {
  disc(c, r * 0.8);
  for (let i = 0; i < 4; i++) {
    const a = k * 9 + (i * Math.PI) / 2;
    disc([c[0] + Math.cos(a) * r * 0.42, c[1] + Math.sin(a) * r * 0.42, c[2]], r * 0.55);
  }
}

/** The light with the way its shade falls along the ground for each unit up. */
type Throw = Light & { dx: number; dy: number };

/**
 * A shade picture under a key's head at a step of the sun and a turn: kept,
 * a near step's standing in while this frame has made all it may, or made
 * now from the discs `throwOf` lays, each a point of the model and a radius.
 */
function shaded(head: string, step: number, turn: number, throwOf: (light: Throw, e: Eye, disc: (p: V3, r: number) => void) => void): TreeShade | null {
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
  const sun = lightOf(step);
  let out: TreeShade | null = null;
  if (sun.throw > 0) {
    const e = eyeOf(0, turn);
    const fl = Math.hypot(sun.sun[0], sun.sun[1]) || 1;
    const dx = (-sun.sun[0] / fl) * sun.throw, dy = (-sun.sun[1] / fl) * sun.throw;
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
    throwOf({ ...sun, dx, dy }, e, disc);
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

/* ---- bushes ---------------------------------------------------------------------------- */

const bushModels = new Map<string, Skeleton>();
function bushModelOf(species: number, form: number): Skeleton {
  const k = `${species}|${form}`;
  let sk = bushModels.get(k);
  if (!sk) bushModels.set(k, (sk = (BUSH3D.get(species) ?? rose).grow(bushSeedOf(species, form))));
  return sk;
}
const bushSeedOf = (species: number, form: number): number => 104729 + species * 7919 + form * 17;

/** The picture of a bush drawn as a solid, as `tree3dSprite` makes a tree's: its day's dress is `bushYear`'s. */
export function bush3dSprite(species: number, season: Season, day: number, at: TreeView, scale: number): TreeSprite {
  const form = formAt(at.x, at.y);
  const def = BUSH_DEFS[species] ?? BUSH_DEFS[0];
  const look = bushYear(def, species, season, day);
  const step = sunStepOf(at.hour, at.dark);
  // Bare canes have no leaf to move.
  const frame = look.full > 0 ? at.sway : 0;
  return baked(`${scale}|bush${species}|${form}|${season}${look.key}`, at.turn, step, frame, () => {
    const seed = bushSeedOf(species, form);
    const sk = swayed(bushModelOf(species, form), frame, SWAY_FRAMES, seed);
    const spec = BUSH3D.get(species) ?? rose;
    // Its foot's shade is laid by the renderer, in the ground shade's tone (`Sprite.foot`).
    return bake(scale, sk, at.turn, (g, e) => spec.paint(g, { sk, look, season, def, light: lightOf(step), e, seed, frame }), false);
  });
}

/** What a bush throws on the ground, as `tree3dShadow` a tree's: along its wood, and lumpy under its leaf as far as it is in leaf. */
export function bush3dShadow(species: number, season: Season, day: number, x: number, y: number, step: number, turn: number): TreeShade | null {
  const form = formAt(x, y);
  const look = bushYear(BUSH_DEFS[species] ?? BUSH_DEFS[0], species, season, day);
  return shaded(`bush${species}|${form}|${season}${look.key}|`, step, turn, (light, _e, disc) => {
    const sk = bushModelOf(species, form);
    // Clear of its foot, which is its own shade laid with it (`Sprite.foot`).
    const clear = footReach(sk) / ACROSS;
    // Its canes and the shoots off them, not the finest twigs; and no more than `BUSH_WOOD_DISCS` discs along them, spread over their length.
    const wood = sk.limbs.filter((L) => L.order >= 0 && L.order <= 2);
    const spread = Math.max(1, wood.reduce((n, L) => n + stepsAlong(L, light) + 1, 0) / BUSH_WOOD_DISCS);
    for (const L of wood) {
      alongLimb(L, light, (p, r) => {
        const z = Math.max(0, p[2]);
        if (Math.hypot(p[0] + light.dx * z, p[1] + light.dy * z) < clear - r) return;
        disc(p, r);
      }, spread);
    }
    if (look.full > 0) for (const c of sk.clumps) lumpyDisc(disc, c.c, c.r * (0.4 + 0.6 * look.full), c.k);
  });
}

/** The most discs a bush's wood throws its shade with: a twiggy bush's are spread out along it to this many. */
const BUSH_WOOD_DISCS = 720;

/** How far round a tile's bush's foot its own shade reaches, as `tree3dFoot`. */
export function bush3dFoot(species: number, x: number, y: number): number {
  return footReach(bushModelOf(species, formAt(x, y)));
}
