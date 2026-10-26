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
 * or, with none, flat for that frame, so a step of the sun or a turn of the
 * camera is made over a few frames rather than in one.
 *
 * What a frame had to stand in for is made in the frames' spare time after
 * (`tree3dIdle`), nearest the middle of the view first, and then the next step
 * of the sun ahead of it, bakes and shades, so the step finds them made. A
 * bake is kept in the browser between visits (`./store`), and the trees round
 * where you come ashore are baked while the island is still being read
 * (`preloadTrees3d`).
 *
 * The bushes in `BUSH3D` are drawn the same way, by the same bakes, budget,
 * stand-ins and shade: a bush species grows its own model and paints it
 * (`Bush3D`); every other bush is drawn flat (`bushSprite`).
 *
 * So are the stumps and felled logs of the species in `STUMP3D_SPECIES`
 * (`./stump`): each in its own species' bark (`SPECIES`), its foot that
 * species' foot; every other is drawn flat (`stumpSprite`, `lyingSprite`).
 */
import type { Season } from '../../world/calendar';
import { hash2 } from '../../world/noise';
import { BUSH_DEFS, TREE_AGES, TREE_DEFS } from '../../world/tiles';
import { blooms, bushYear, LEAFING, LEAVES_DOWN, lookStep, PETALS_DOWN, SHEDDING, TURNING } from '../foliage';
import { eyeOf, proj, type Eye } from '../runestone';
import { ageKeyOf } from '../trees/tree';
import type { AgeKey } from '../trees/types';
import { lightOf, SUN_STEPS, sunStepOf, type Light } from './light';
import { ACROSS, boundsOf, footReach, footShade, paintTree3d, shownOf } from './paint';
import { growOrchard } from './orchard';
import { grow, swayed } from './skeleton';
import { fetchStored, isStored, openStore, putStored } from './store';
import { inkOf } from '../ink';
import { apple } from './species/apple';
import { apricot } from './species/apricot';
import { birch } from './species/birch';
import { cedar } from './species/cedar';
import { cherry } from './species/cherry';
import { fig } from './species/fig';
import { lavender } from './species/lavender';
import { lemon } from './species/lemon';
import { maple } from './species/maple';
import { oak } from './species/oak';
import { olive } from './species/olive';
import { peach } from './species/peach';
import { pear } from './species/pear';
import { pine } from './species/pine';
import { plum } from './species/plum';
import { pomegranate } from './species/pomegranate';
import { quince } from './species/quince';
import { rose } from './species/rose';
import { thorn } from './species/thorn';
import { willow } from './species/willow';
import { logsOf, paintLogs3d, paintStump3d, STUMP_SHAPES, stumpOf, thrown, woodOf, woodSpec, type StumpModel, type StumpShape } from './stump';
import type { Build, Bush3D, Dress, Skeleton, Species3D, V3 } from './types';

export { nextSunStep, sunStepOf, SUN_STEPS } from './light';

const byName = (name: string): number => TREE_DEFS.findIndex((d) => d.name === name);

/** The species drawn as solids, by their `TREE_DEFS` index, and what each is. */
const SPECIES: ReadonlyMap<number, Species3D> = new Map([
  [byName('Maple'), maple],
  [byName('Oak'), oak],
  [byName('Pine'), pine],
  [byName('Birch'), birch],
  [byName('Cedar'), cedar],
  [byName('Willow'), willow],
  [byName('Cherry'), cherry],
  [byName('Apple'), apple],
  [byName('Pear'), pear],
  [byName('Plum'), plum],
  [byName('Peach'), peach],
  [byName('Apricot'), apricot],
  [byName('Quince'), quince],
  [byName('Fig'), fig],
  [byName('Lemon'), lemon],
  [byName('Olive'), olive],
  [byName('Pomegranate'), pomegranate],
]);
/** Which species are drawn here: take one out and it is drawn flat again. */
export const TREE3D_SPECIES: Set<number> = new Set(SPECIES.keys());

const bushByName = (name: string): number => BUSH_DEFS.findIndex((d) => d.name === name);
/** The bushes drawn as solids, by their `BUSH_DEFS` index, and what each is: one file in `./species` each. */
const BUSH3D: ReadonlyMap<number, Bush3D> = new Map([
  [bushByName('Rose bush'), rose],
  [bushByName('Thorn bush'), thorn],
  [bushByName('Lavender bush'), lavender],
]);
/** Which bushes are drawn here: take one out and it is drawn flat again. */
export const BUSH3D_SPECIES: Set<number> = new Set(BUSH3D.keys());

/** How many shapes each species grows at each age; a tile wears one of them. */
export const FORMS = 3;
/** Frames of the wind, gone round one after another, `SWAY_MS` each. */
export const SWAY_FRAMES = 4;
export const SWAY_MS = 1040;
/**
 * How long a frame may spend making bakes, and shades, while it draws. A bake
 * is read back once made (`inkOf`), which has the canvas draw it there and
 * then, so the clock sees the whole of what it cost.
 */
const BAKE_MS = 4;
const SHADE_MS = 2;
/** And for a tree with no bake at all to stand in, which would otherwise be drawn flat. */
const BARE_MS = 16;
/** Pixels of bakes kept, and of shades. */
const PIXELS = 20_000_000;
const SHADE_PIXELS = 6_000_000;
/** Milliseconds a frame lends the work after it (`tree3dIdle`) on top of its spare time, and the most saved up. */
const TRICKLE_MS = 1;
const CREDIT_MOST = 12;


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
  /** Where in it there is anything (`inkOf`). */
  ink: [number, number, number, number];
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

/** Which of `FORMS` a tile's tree is grown as, and which of its own species' forms (`Species3D.forms`). */
export const formAt = (x: number, y: number): number => Math.floor(hash2(Math.round(x), Math.round(y), 5309) * FORMS) % FORMS;
const formOf = (species: number, x: number, y: number): number => formAt(x, y) % Math.max(1, Math.min(FORMS, SPECIES.get(species)?.forms ?? FORMS));
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
  const H = b.height * def.size * age.size, seed = seedOf(species, variant, form);
  sk = b.habit === 'orchard' ? growOrchard(b, H, seed) : grow(b, H, seed);
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

/** How many of its fruit a tree hangs at each age, against a mature one's, as the flat trees hang them. */
const FRUIT_BY: Partial<Record<AgeKey, number>> = { mature: 1, old: 1.15, veryOld: 0.7 };

/**
 * A tree's dress for its species: a fruit tree's flower in spring at the ages
 * that bear (`blooms`), with its petals under it, and its fruit in the seasons
 * the island's fruiting table has it on the tree.
 */
export function dressFor(species: number, variant: number, season: Season, day: number): { dress: Dress; key: string } {
  const out = dressOf(variant, season, day);
  const o = SPECIES.get(species)?.orchard;
  if (!o) return out;
  const age = TREE_AGES[variant] ?? TREE_AGES[0];
  const d = out.dress;
  d.keys = false;
  d.bloom = season === 'spring' && blooms(species, variant);
  if (d.bloom) d.litter = PETALS_DOWN[d.step];
  else if (season !== 'autumn') d.litter = 0;
  d.fruit = age.bears && age.alive && o.fruit.seasons.includes(season) ? o.fruit.count * (FRUIT_BY[ageKeyOf(age)] ?? 0.6) : 0;
  return out;
}

/* ---- bakes --------------------------------------------------------------------------- */

const bakes = new Map<string, TreeSprite>();
let pixels = 0;
/** The frame each bake was last drawn in, so making ahead never puts away what is on the screen. */
const usedIn = new WeakMap<TreeSprite, number>();
let frameNo = 0;
let spent = 0;
let shadeSpent = 0;
/** Whether the renderer has drawn a frame: a preload stops then (`preloadTrees3d`). */
let drawing = false;
/** Saved up for `tree3dIdle`, in milliseconds. */
let credit = 0;
/** What has been made, and how often an older one stood in: for a harness, and for the renderer to know a shade is not yet its sun's own. */
export const tree3dStats = { bakes: 0, ms: 0, standIns: 0, paintMs: 0, shadeStandIns: 0, flats: 0, ahead: 0, aheadLook: 0, stored: 0, shades: 0, shadeMs: 0, idleMs: 0 };

/** A bake under a head at a step of the sun and a frame of the wind, for a tile. */
type MakeAt = (step: number, frame: number) => TreeSprite;
/** The discs a model throws its shade with, under a light. */
type ThrowOf = (light: Throw, e: Eye, disc: (p: V3, r: number) => void) => void;

/** A bake to make: its key, its head, and how. */
interface Job {
  key: string;
  head: string;
  turn: number;
  step: number;
  frame: number;
  x: number;
  y: number;
  makeAt: MakeAt;
  /** The same tile's maker on another day (`Maker.lookAt`), for its next look made ahead. */
  lookAt?: LookAt;
}
/** A shade to make (`shaded`). */
interface ShadeJob {
  head: string;
  turn: number;
  x: number;
  y: number;
  throwOf: ThrowOf;
  lookAt?: LookAt;
}
/** What this frame stood in for, and every bake it drew in still air, by head and turn: what `tree3dIdle` makes. */
const missing = new Map<string, Job>();
const seen = new Map<string, Job>();
/** The shades this frame had none of, by key, with the step each is for. */
const shadeMissing = new Map<string, [ShadeJob, number]>();
/** The shapes the shade was last asked for, by head and turn. */
const shadeKinds = new Map<string, ShadeJob>();
/** Bakes being fetched from the browser's store, and new ones to put there. */
const loading = new Set<string>();
const toStore: Array<[string, TreeSprite]> = [];

/** What the bakes and shades kept hold: for a harness. */
export const tree3dMemory = (): { bakes: number; bakePx: number; shades: number; shadePx: number; kinds: number; loading: number; missing: number; nextLookPx: number; nextShadesPx: number; lastLook: number } => ({ bakes: bakes.size, bakePx: pixels, shades: shadows.size, shadePx: shadePixels, kinds: shadeKinds.size, loading: loading.size, missing: missing.size, nextLookPx, nextShadesPx, lastLook: lastLook.size });

/** A new frame: its own `BAKE_MS` to spend. Called by the renderer once a frame. */
export function tree3dFrame(): void {
  if (!drawing) {
    drawing = true;
    void openStore();
  }
  // The last look goes once a frame has drawn every tree from its own look's bakes, or after `LAST_LOOK_FRAMES` whatever.
  if (oldLook.size && frameNo > lookTurnedIn + 1 && ((!usedLastLook && !missing.size) || frameNo > lastLookUntil)) dropLastLook();
  usedLastLook = false;
  frameNo++;
  spent = 0;
  shadeSpent = 0;
  missing.clear();
  seen.clear();
  shadeMissing.clear();
}

/**
 * The season's look has turned (`forgetTrees`): the next look's bakes and
 * shades made ahead (`tree3dIdle`) are the ones kept now, and the last look's
 * stand in for any the new look has not got yet, rather than the flat trees,
 * until a frame draws none of them (`dropLastLook`). With `all`, everything
 * is let go.
 */
export function forgetTrees3d(all = false): void {
  lastLook.clear();
  oldLook.clear();
  if (all) {
    bakes.clear();
    pixels = 0;
  } else {
    for (const [k, b] of bakes) {
      oldLook.add(k);
      const at = k.split('|');
      if (at[at.length - 1] === '0') lastLook.set(`${at.slice(0, -4).join('|')}|${at[at.length - 3]}|${at[at.length - 2]}`, b);
    }
    lastLookUntil = frameNo + LAST_LOOK_FRAMES;
    lookTurnedIn = frameNo;
  }
  for (const [k, b] of nextLook) {
    if (bakes.has(k)) continue;
    bakes.set(k, b);
    usedIn.set(b, frameNo);
    pixels += b.canvas.width * b.canvas.height;
  }
  for (const [k, sh] of nextShades) keepShade(k, sh);
  nextLook.clear();
  nextLookPx = 0;
  nextShades.clear();
  nextShadesPx = 0;
  shadeKinds.clear();
}
/** The bakes of the look before, by head less its look, turn and step: what stands in after a change of look (`forgetTrees3d`), for `LAST_LOOK_FRAMES` at most. */
const lastLook = new Map<string, TreeSprite>();
/** Every bake kept when the look turned, and the frame it turned in: those not drawn since are let go (`dropLastLook`). */
const oldLook = new Set<string>();
let lookTurnedIn = 0;
const LAST_LOOK_FRAMES = 1800;
let lastLookUntil = 0;
/** Whether a frame stood in with the last look's bakes. */
let usedLastLook = false;

/** The last look let go: every bake kept when the look turned that no frame has drawn since. */
function dropLastLook(): void {
  for (const k of oldLook) {
    const b = bakes.get(k);
    if (!b || (usedIn.get(b) ?? 0) >= lookTurnedIn) continue;
    bakes.delete(k);
    pixels -= b.canvas.width * b.canvas.height;
  }
  oldLook.clear();
  lastLook.clear();
}

/**
 * The next look's bakes and shades, made ahead in the hour before it turns
 * (`tree3dIdle`): kept apart, so making them puts away nothing, up to
 * `LOOK_PIXELS` and `LOOK_SHADE_PIXELS`.
 */
const nextLook = new Map<string, TreeSprite>();
let nextLookPx = 0;
const nextShades = new Map<string, TreeShade | null>();
let nextShadesPx = 0;
/** About thirty-four megabytes of bakes, and eight of shades. */
const LOOK_PIXELS = 8_500_000;
const LOOK_SHADE_PIXELS = 2_000_000;

/** A bake kept, and room made for it by letting go the least lately drawn: never one drawn this frame or the last, while there is another to let go. */
function keep(key: string, spr: TreeSprite): void {
  bakes.set(key, spr);
  usedIn.set(spr, frameNo);
  pixels += spr.canvas.width * spr.canvas.height;
  if (pixels <= PIXELS) return;
  for (const [k, old] of bakes) {
    if (pixels <= PIXELS) return;
    if ((usedIn.get(old) ?? 0) >= frameNo - 1) continue;
    bakes.delete(k);
    pixels -= old.canvas.width * old.canvas.height;
  }
  while (pixels > PIXELS && bakes.size > 1) {
    const [k, old] = bakes.entries().next().value as [string, TreeSprite];
    bakes.delete(k);
    pixels -= old.canvas.width * old.canvas.height;
  }
}

/** A bake drawn this frame moved to the end of the line to be let go. */
function touch(key: string, spr: TreeSprite): void {
  bakes.delete(key);
  bakes.set(key, spr);
  usedIn.set(spr, frameNo);
}

/** Frames making ahead rests once the bakes are full of what is on the screen, and the frame it starts again. */
const AHEAD_REST = 600;
let fullUntil = 0;

/** Whether a bake of `px` pixels can be kept without putting away one drawn this frame or the last. */
function roomAhead(px: number): boolean {
  let left = pixels + px - PIXELS;
  for (const b of bakes.values()) {
    if (left <= 0) return true;
    if ((usedIn.get(b) ?? 0) >= frameNo - 1) return false;
    left -= b.canvas.width * b.canvas.height;
  }
  return left <= 0;
}

/** A model seen from a turn, painted at a scale onto a canvas just its size, its own shade at its foot under it unless the renderer lays that; and read back once for where in it there is anything. */
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
  const ink = inkOf(canvas);
  tree3dStats.bakes++;
  tree3dStats.ms += performance.now() - t0;
  return { canvas, w, h, ax: -x0, ay: -y0, solid: true, foot: ownFoot ? undefined : footReach(sk), ink };
}

/** A job's bake made and kept, and put by to be kept in the browser too. Made ahead, it is kept only if that puts away nothing on the screen. */
function make(j: Job, ahead = false): TreeSprite | null {
  const spr = j.makeAt(j.step, j.frame);
  if (toStore.length < 256) toStore.push([j.key, spr]);
  if (ahead && !roomAhead(spr.canvas.width * spr.canvas.height)) {
    fullUntil = frameNo + AHEAD_REST;
    return null;
  }
  keep(j.key, spr);
  return spr;
}

/** A job's bake fetched from the browser's store, kept when it comes. */
function fetchJob(j: Job, ahead = false): void {
  if (loading.has(j.key)) return;
  loading.add(j.key);
  void fetchStored(j.key).then((got) => {
    loading.delete(j.key);
    if (!got || bakes.has(j.key)) return;
    if (ahead && !roomAhead(got.canvas.width * got.canvas.height)) {
      fullUntil = frameNo + AHEAD_REST;
      return;
    }
    tree3dStats.stored++;
    keep(j.key, { ...got, solid: true });
  });
}

/** What a tree or a bush on a tile is baked and shaded under, and how: one for `tree3dSprite`, `tree3dShadow`, `tree3dIdle` and `preloadTrees3d` alike. */
interface Maker {
  head: string;
  /** Whether it is in leaf, which the wind moves. */
  leafy: boolean;
  makeAt: MakeAt;
  shadeHead: string;
  throwOf: ThrowOf;
  /** The same tile's maker as it will be dressed on another day: what its next look is made ahead from (`tree3dIdle`). Without it, a kind's next look is made when it comes. */
  lookAt?: LookAt;
}
/** A tile's maker on a day of a season. */
type LookAt = (season: Season, day: number) => Maker;

function treeMaker(species: number, variant: number, season: Season, day: number, x: number, y: number, turn: number, scale: number): Maker {
  const form = formOf(species, x, y);
  const { dress, key: look } = dressFor(species, variant, season, day);
  return {
    lookAt: (s, d) => treeMaker(species, variant, s, d, x, y, turn, scale),
    head: `${scale}|${species}|${variant}|${form}|${look}`,
    // The bare wood has no leaf to move.
    leafy: dress.full > 0,
    makeAt: (step, frame) => {
      const spec = SPECIES.get(species) ?? maple;
      const seed = seedOf(species, variant, form);
      const sk = swayed(skeletonOf(species, variant, form), frame, SWAY_FRAMES, seed);
      return bake(scale, sk, turn, (g, e) => paintTree3d(g, { sk, spec, dress, light: lightOf(step), e, seed, frame, frames: SWAY_FRAMES, scale }));
    },
    shadeHead: `${species}|${variant}|${form}|${look}|`,
    throwOf: (light, e, disc) => {
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
    },
  };
}

/**
 * The picture of a tree drawn as a solid, at a scale of pixels to a pixel at
 * zoom one: made now, or a near one standing in while this frame has made
 * all it may, or null -- drawn flat this frame -- with none to stand in.
 */
export function tree3dSprite(species: number, variant: number, season: Season, day: number, at: TreeView, scale: number): TreeSprite | null {
  const m = treeMaker(species, variant, season, day, at.x, at.y, at.turn, scale);
  return baked(m, at.turn, sunStepOf(at.hour, at.dark), m.leafy ? at.sway : 0, at.x, at.y);
}

/** The bake under a maker's head at a turn, a step of the sun and a frame of the wind: kept, fetched from the browser's store, made now, or a near one standing in; null when there is none. */
function baked(m: Maker, turn: number, step: number, frame: number, x: number, y: number): TreeSprite | null {
  const { head } = m;
  const key = `${head}|${turn}|${step}|${frame}`;
  const still = `${head}|${turn}|0`;
  if (!seen.has(still)) seen.set(still, { key: `${head}|${turn}|${step}|0`, head, turn, step, frame: 0, x, y, makeAt: m.makeAt, lookAt: m.lookAt });
  const had = bakes.get(key);
  if (had) {
    touch(key, had);
    return had;
  }
  const job: Job = { key, head, turn, step, frame, x, y, makeAt: m.makeAt };
  const near = standIn(head, turn, step, frame);
  if (isStored(key)) fetchJob(job);
  else if (spent < (near ? BAKE_MS : BARE_MS)) {
    const t0 = performance.now();
    const spr = make(job);
    spent += performance.now() - t0;
    return spr;
  }
  if (!missing.has(key)) missing.set(key, job);
  if (near) {
    tree3dStats.standIns++;
    if (bakes.has(near[0])) touch(near[0], near[1]);
    return near[1];
  }
  tree3dStats.flats++;
  return null;
}

/** The nearest bake already made of the same tree in the same dress: still air, the sun's nearest step, then any turn at this step, then any turn at any step. */
function standIn(head: string, turn: number, step: number, frame: number): [string, TreeSprite] | null {
  const at = (t: number, s: number): [string, TreeSprite] | null => {
    const k = `${head}|${t}|${s}|0`;
    const b = bakes.get(k);
    return b ? [k, b] : null;
  };
  const steps = (t: number): [string, TreeSprite] | null => {
    for (let d = 1; d <= 9; d++) {
      for (const s of [step - d, step + d]) {
        if (s < -1 || s > 8) continue;
        const b = at(t, s);
        if (b) return b;
      }
    }
    return null;
  };
  let b = (frame ? at(turn, step) : null) ?? steps(turn);
  for (let t = 1; t < 8 && !b; t++) b = at((turn + t) % 8, step);
  for (let t = 1; t < 8 && !b; t++) b = steps((turn + t) % 8);
  if (b || !lastLook.size) return b;
  if (frameNo > lastLookUntil) {
    lastLook.clear();
    return null;
  }
  const kind = head.slice(0, head.lastIndexOf('|'));
  for (let d = 0; d <= 9; d++) {
    for (const s of d ? [step - d, step + d] : [step]) {
      const k = `${kind}|${turn}|${s}`;
      const was = lastLook.get(k);
      if (was) {
        usedLastLook = true;
        return [k, was];
      }
    }
  }
  return null;
}

/**
 * The work after a frame: what it stood in for, nearest `(fx, fy)` first, then
 * the shades it had none of, then every bake and shade it drew made for the
 * sun's `next` step ahead of it. Given the frame's spare milliseconds, and
 * `TRICKLE_MS` more saved up each frame, so a wood that leaves no spare time
 * still gets its next step made a bake every so often rather than all at once
 * when the sun moves. And in the last of the look's days, every one drawn
 * made as `look` will dress it (`nextLook`), so the change finds them made.
 */
export function tree3dIdle(spare: number, next: number | null, fx: number, fy: number, look: { season: Season; day: number; step: number } | null = null): void {
  const avg = tree3dStats.bakes ? tree3dStats.ms / tree3dStats.bakes : 8;
  // Never less saved up than a bake costs, or a slow machine would never make one.
  credit = Math.min(Math.max(CREDIT_MOST, avg * 1.25), credit + TRICKLE_MS + Math.max(0, spare));
  const put = toStore.shift();
  if (put) void putStored(put[0], put[1]);
  const t0 = performance.now();
  const far = (j: { x: number; y: number }): number => (j.x - fx) ** 2 + (j.y - fy) ** 2;
  const bakeJobs = (list: Iterable<Job>): Job[] => [...list].filter((j) => !bakes.has(j.key) && !loading.has(j.key)).sort((a, b) => far(a) - far(b));
  const run = (j: Job, ahead = false): boolean => {
    if (bakes.has(j.key) || loading.has(j.key)) return true;
    if (isStored(j.key)) {
      fetchJob(j, ahead);
      return true;
    }
    if (credit < avg) return false;
    const t = performance.now();
    make(j, ahead);
    if (ahead) tree3dStats.ahead++;
    credit -= performance.now() - t;
    return true;
  };
  const shade = (sj: ShadeJob, step: number, k: string): boolean => {
    if (shadows.has(k)) return true;
    if (credit < 1) return false;
    const t = performance.now();
    makeShade(sj, step, k);
    credit -= performance.now() - t;
    return true;
  };
  let going = true;
  for (const j of bakeJobs(missing.values())) if (!(going = run(j))) break;
  if (going) for (const [k, [sj, step]] of [...shadeMissing.entries()].sort((a, b) => far(a[1][0]) - far(b[1][0]))) if (!(going = shade(sj, step, k))) break;
  if (going && next !== null) {
    for (const j of bakeJobs([...seen.values()].map((j) => ({ ...j, step: next, key: `${j.head}|${j.turn}|${next}|0` })))) {
      if (frameNo < fullUntil) break;
      if (!(going = run(j, true))) break;
    }
    // Only into room there is: made ahead, a shade must not put away one the lines are laid from.
    if (going) {
      for (const sj of [...shadeKinds.values()].sort((a, b) => far(a) - far(b))) {
        if (shadePixels >= SHADE_PIXELS * 0.85) break;
        if (!(going = shade(sj, next, `${sj.head}${next}|${sj.turn}`))) break;
      }
    }
  }
  if (going && look && frameNo >= lookRestUntil) going = lookAhead(look, far, avg);
  // Nothing left to do: none is saved up, so whatever comes next starts from a frame's worth rather than a burst.
  if (going) credit = Math.min(credit, TRICKLE_MS);
  tree3dStats.idleMs += performance.now() - t0;
}

/** Frames the next look's making rests once it has nothing left to make, and the frame it looks again. */
const LOOK_REST = 30;
let lookRestUntil = 0;
/** The look and sun step the next look's bakes are made for. */
let lookFor = '';

/** The next look's bakes and then its shades, for every bake this frame drew, nearest first, while there is credit and room; false when out of credit. */
function lookAhead(look: { season: Season; day: number; step: number }, far: (j: { x: number; y: number }) => number, avg: number): boolean {
  // Made for another look than this one, they go.
  const want = `${look.season}${lookStep(look.day)}|${look.step}`;
  if (want !== lookFor) {
    lookFor = want;
    nextLook.clear();
    nextLookPx = 0;
    nextShades.clear();
    nextShadesPx = 0;
  }
  const jobs: Job[] = [];
  for (const j of seen.values()) {
    if (!j.lookAt) continue;
    const m = j.lookAt(look.season, look.day);
    const key = `${m.head}|${j.turn}|${look.step}|0`;
    if (bakes.has(key) || nextLook.has(key) || loading.has(key)) continue;
    jobs.push({ key, head: m.head, turn: j.turn, step: look.step, frame: 0, x: j.x, y: j.y, makeAt: m.makeAt });
  }
  jobs.sort((a, b) => far(a) - far(b));
  for (const j of jobs) {
    if (nextLookPx >= LOOK_PIXELS) break;
    if (isStored(j.key)) {
      loading.add(j.key);
      void fetchStored(j.key).then((got) => {
        loading.delete(j.key);
        if (!got || nextLook.has(j.key) || nextLookPx >= LOOK_PIXELS) return;
        tree3dStats.stored++;
        nextLook.set(j.key, { ...got, solid: true });
        nextLookPx += got.canvas.width * got.canvas.height;
      });
      continue;
    }
    if (credit < avg) return false;
    const t = performance.now();
    const spr = j.makeAt(j.step, 0);
    if (toStore.length < 256) toStore.push([j.key, spr]);
    nextLook.set(j.key, spr);
    nextLookPx += spr.canvas.width * spr.canvas.height;
    tree3dStats.aheadLook++;
    credit -= performance.now() - t;
  }
  let left = jobs.length > 0 && nextLookPx < LOOK_PIXELS;
  for (const sj of [...shadeKinds.values()].sort((a, b) => far(a) - far(b))) {
    if (!sj.lookAt || nextShadesPx >= LOOK_SHADE_PIXELS) continue;
    const m = sj.lookAt(look.season, look.day);
    const k = `${m.shadeHead}${look.step}|${sj.turn}`;
    if (shadows.has(k) || nextShades.has(k)) continue;
    left = true;
    if (credit < 1) return false;
    const t = performance.now();
    const out = drawShade({ head: m.shadeHead, turn: sj.turn, x: sj.x, y: sj.y, throwOf: m.throwOf }, look.step);
    nextShades.set(k, out);
    if (out) nextShadesPx += out.canvas.width * out.canvas.height;
    credit -= performance.now() - t;
  }
  if (!left) lookRestUntil = frameNo + LOOK_REST;
  return true;
}

/**
 * Baked ahead of the first frame, while the island is still being read: every
 * tree and bush in `tiles` (nearest the middle first) as it will be seen, and
 * its shade, and then the same for the sun's `next` step. A bake kept in the
 * browser's store is fetched rather than baked. It works a slice at a time so
 * the page keeps answering, and stops once the renderer draws its first frame.
 */
export async function preloadTrees3d(
  tiles: ReadonlyArray<{ bush: boolean; stump?: boolean; species: number; variant: number; x: number; y: number }>,
  at: { season: Season; day: number; hour: number; dark: number; turn: number; scale: number; next: number | null },
): Promise<void> {
  await openStore();
  const step = sunStepOf(at.hour, at.dark);
  const slice = (): Promise<void> => new Promise((ok) => setTimeout(ok, 0));
  let t0 = performance.now();
  const yieldNow = async (): Promise<void> => {
    if (performance.now() - t0 < 12) return;
    const put = toStore.shift();
    if (put) void putStored(put[0], put[1]);
    await slice();
    t0 = performance.now();
  };
  const makers = tiles
    .filter((t) => (t.bush ? BUSH3D_SPECIES : t.stump ? STUMP3D_SPECIES : TREE3D_SPECIES).has(t.species))
    .map((t) => ({
      t,
      m: t.bush ? bushMaker(t.species, at.season, at.day, t.x, t.y, at.turn, at.scale)
        : t.stump ? stumpMaker(t.species, at.season, t.x, t.y, at.turn, at.scale)
        : treeMaker(t.species, t.variant, at.season, at.day, t.x, t.y, at.turn, at.scale),
    }));
  for (const s of at.next === null ? [step] : [step, at.next]) {
    const jobs = new Map<string, Job>();
    const shades: Array<[ShadeJob, string]> = [];
    for (const { t, m } of makers) {
      const key = `${m.head}|${at.turn}|${s}|0`;
      if (jobs.has(key)) continue;
      jobs.set(key, { key, head: m.head, turn: at.turn, step: s, frame: 0, x: t.x, y: t.y, makeAt: m.makeAt });
      shades.push([{ head: m.shadeHead, turn: at.turn, x: t.x, y: t.y, throwOf: m.throwOf }, `${m.shadeHead}${s}|${at.turn}`]);
    }
    // What the browser kept is fetched, several at a time, while what it did not keep is baked.
    const fetches: Promise<void>[] = [];
    for (const j of jobs.values()) {
      if (bakes.has(j.key) || !isStored(j.key)) continue;
      fetches.push(fetchStored(j.key).then((got) => {
        if (got && !bakes.has(j.key)) {
          tree3dStats.stored++;
          keep(j.key, { ...got, solid: true });
        }
      }));
    }
    for (const j of jobs.values()) {
      if (drawing) return;
      if (bakes.has(j.key) || isStored(j.key)) continue;
      make(j);
      await yieldNow();
    }
    for (const [sj, k] of shades) {
      if (drawing) return;
      if (!shadows.has(k)) makeShade(sj, s, k);
      await yieldNow();
    }
    await Promise.all(fetches);
    // Any that would not come back are baked.
    for (const j of jobs.values()) {
      if (drawing) return;
      if (bakes.has(j.key)) continue;
      make(j);
      await yieldNow();
    }
  }
  while (toStore.length && !drawing) {
    const put = toStore.shift();
    if (put) await putStored(put[0], put[1]);
  }
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
 * throws none, or when it is not made yet and the sun's nearest step has none
 * to stand in (counted in `shadeStandIns`, so the renderer asks again). The
 * renderer lays it with the ground (`Renderer.solidFrame`).
 */
export function tree3dShadow(species: number, variant: number, season: Season, day: number, x: number, y: number, step: number, turn: number): TreeShade | null {
  const m = treeMaker(species, variant, season, day, x, y, turn, 1);
  return shaded(m.shadeHead, step, turn, x, y, m.throwOf, m.lookAt);
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
 * made now while this frame has time, a near step's standing in, or none yet
 * -- made after the frame (`tree3dIdle`).
 */
function shaded(head: string, step: number, turn: number, x: number, y: number, throwOf: ThrowOf, lookAt?: LookAt): TreeShade | null {
  const kind = `${head}|${turn}`;
  if (!shadeKinds.has(kind)) {
    shadeKinds.set(kind, { head, turn, x, y, throwOf, lookAt });
    if (shadeKinds.size > 1200) shadeKinds.delete(shadeKinds.keys().next().value as string);
  }
  const k = `${head}${step}|${turn}`;
  const had = shadows.get(k);
  if (had !== undefined) {
    shadows.delete(k);
    shadows.set(k, had);
    return had;
  }
  if (shadeSpent < SHADE_MS) {
    const t0 = performance.now();
    const out = makeShade({ head, turn, x, y, throwOf }, step, k);
    shadeSpent += performance.now() - t0;
    return out;
  }
  // Out of time this frame: the sun's nearest step stands in, or none yet.
  tree3dStats.shadeStandIns++;
  if (!shadeMissing.has(k)) shadeMissing.set(k, [{ head, turn, x, y, throwOf }, step]);
  for (let d = 1; d <= SUN_STEPS + 1; d++) {
    for (const s of [step - d, step + d]) {
      const near = shadows.get(`${head}${s}|${turn}`);
      if (near) return near;
    }
  }
  return null;
}

/** A shade made from the discs its job lays, kept under `k` (`keepShade`). */
function makeShade(j: ShadeJob, step: number, k: string): TreeShade | null {
  const out = drawShade(j, step);
  keepShade(k, out);
  return out;
}

/** A shade kept, the least lately asked for let go past `SHADE_PIXELS`. */
function keepShade(k: string, out: TreeShade | null): void {
  const was = shadows.get(k);
  if (was) shadePixels -= was.canvas.width * was.canvas.height;
  shadows.delete(k);
  shadows.set(k, out);
  if (out) shadePixels += out.canvas.width * out.canvas.height;
  while (shadePixels > SHADE_PIXELS && shadows.size > 1) {
    const [old, s] = shadows.entries().next().value as [string, TreeShade | null];
    shadows.delete(old);
    if (s) shadePixels -= s.canvas.width * s.canvas.height;
  }
}

/** The shade the discs a job lays throw at a step of the sun. */
function drawShade(j: ShadeJob, step: number): TreeShade | null {
  const t0 = performance.now();
  const sun = lightOf(step);
  let out: TreeShade | null = null;
  if (sun.throw > 0) {
    const e = eyeOf(0, j.turn);
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
    j.throwOf({ ...sun, dx, dy }, e, disc);
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
  tree3dStats.shades++;
  tree3dStats.shadeMs += performance.now() - t0;
  return out;
}
const shadows = new Map<string, TreeShade | null>();
let shadePixels = 0;

/** How far round a tile's tree's foot its own shade reaches, in pixels at zoom one across, before it grows (`grownAt`). */
export function tree3dFoot(species: number, variant: number, x: number, y: number): number {
  return footReach(skeletonOf(species, variant, formOf(species, x, y)));
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

function bushMaker(species: number, season: Season, day: number, x: number, y: number, turn: number, scale: number): Maker {
  const form = formAt(x, y);
  const def = BUSH_DEFS[species] ?? BUSH_DEFS[0];
  const look = bushYear(def, species, season, day);
  return {
    lookAt: (s, d) => bushMaker(species, s, d, x, y, turn, scale),
    head: `${scale}|bush${species}|${form}|${season}${look.key}`,
    // Bare canes have no leaf to move.
    leafy: look.full > 0,
    makeAt: (step, frame) => {
      const seed = bushSeedOf(species, form);
      const sk = swayed(bushModelOf(species, form), frame, SWAY_FRAMES, seed);
      const spec = BUSH3D.get(species) ?? rose;
      // Its foot's shade is laid by the renderer, in the ground shade's tone (`Sprite.foot`).
      return bake(scale, sk, turn, (g, e) => spec.paint(g, { sk, look, season, def, light: lightOf(step), e, seed, frame }), false);
    },
    shadeHead: `bush${species}|${form}|${season}${look.key}|`,
    throwOf: (light, _e, disc) => {
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
    },
  };
}

/** The picture of a bush drawn as a solid, as `tree3dSprite` makes a tree's: its day's dress is `bushYear`'s. Null to be drawn flat this frame. */
export function bush3dSprite(species: number, season: Season, day: number, at: TreeView, scale: number): TreeSprite | null {
  const m = bushMaker(species, season, day, at.x, at.y, at.turn, scale);
  return baked(m, at.turn, sunStepOf(at.hour, at.dark), m.leafy ? at.sway : 0, at.x, at.y);
}

/** What a bush throws on the ground, as `tree3dShadow` a tree's: along its wood, and lumpy under its leaf as far as it is in leaf. */
export function bush3dShadow(species: number, season: Season, day: number, x: number, y: number, step: number, turn: number): TreeShade | null {
  const m = bushMaker(species, season, day, x, y, turn, 1);
  return shaded(m.shadeHead, step, turn, x, y, m.throwOf, m.lookAt);
}

/** The most discs a bush's wood throws its shade with: a twiggy bush's are spread out along it to this many. */
const BUSH_WOOD_DISCS = 720;

/** How far round a tile's bush's foot its own shade reaches, as `tree3dFoot`. */
export function bush3dFoot(species: number, x: number, y: number): number {
  return footReach(bushModelOf(species, formAt(x, y)));
}

/* ---- stumps and felled logs ----------------------------------------------------------- */

/** The species whose stumps and felled logs are drawn as solids, by their `TREE_DEFS` index: take one out and it is drawn flat again. */
export const STUMP3D_SPECIES: Set<number> = new Set(SPECIES.keys());
/** The age a stump is the foot of: a stump keeps its species and not its age (`packTreeData`), and what is felled for its timber is mostly old. */
const STUMP_AGE = Math.max(0, TREE_AGES.findIndex((a) => a.name === 'Old'));

/** A species' kind of stump, by how its tree grows. */
function shapeOf(spec: Species3D): StumpShape {
  const b = spec.build;
  return STUMP_SHAPES[b.whorls ? 'conifer' : b.habit === 'spreading' || b.habit === 'upright' || b.habit === 'orchard' ? b.habit : 'dome'];
}

const stumpModels = new Map<string, StumpModel>();
function stumpModelOf(species: number, form: number): StumpModel {
  const k = `${species}|${form}`;
  let m = stumpModels.get(k);
  if (!m) stumpModels.set(k, (m = stumpOf(skeletonOf(species, STUMP_AGE, form), shapeOf(SPECIES.get(species) ?? maple), seedOf(species, STUMP_AGE, form))));
  return m;
}
/** A day's dress for wood with no leaf on it. */
const bareOf = (season: Season): Dress => ({ season, step: 0, full: 0, turned: 0, litter: 0, keys: false });
/** A species' flat stump's wood (`TREE_DEFS` trunk). */
const trunkOf = (species: number): string => (TREE_DEFS[species] ?? TREE_DEFS[0]).trunk;
/** Whether a stump of a species wears its bark's moss in a season: outside the summer, where its bark has any. */
const dampFor = (species: number, season: Season): boolean => !!(SPECIES.get(species) ?? maple).bark.moss && season !== 'summer';
/** A stump's look in a season, for a bake's key. */
const stumpLook = (species: number, season: Season): string => `${season === 'winter' ? 'w' : 'x'}${dampFor(species, season) ? 'm' : ''}`;

/** A stump of a species painted under a light: its model with its shade's reach (`thrown`), and how to paint it. */
function stumpPainter(species: number, form: number, season: Season, light: Light, scale: number): { sk: Skeleton; paint: (g: CanvasRenderingContext2D, e: Eye) => void } {
  const m = stumpModelOf(species, form);
  const sk = thrown(m, light);
  const trunk = trunkOf(species);
  const job = { sk, spec: woodSpec(SPECIES.get(species) ?? maple, trunk, dampFor(species, season)), dress: bareOf(season), light, seed: seedOf(species, STUMP_AGE, form), frame: 0, scale };
  return { sk, paint: (g, e) => paintStump3d(g, { ...job, e }, m, woodOf(trunk)) };
}

function stumpMaker(species: number, season: Season, x: number, y: number, turn: number, scale: number): Maker {
  const form = formOf(species, x, y);
  return {
    lookAt: (s) => stumpMaker(species, s, x, y, turn, scale),
    head: `${scale}|stump${species}|${form}|${stumpLook(species, season)}`,
    leafy: false,
    makeAt: (step) => {
      const p = stumpPainter(species, form, season, lightOf(step), scale);
      // Its shade, at its foot and thrown, is in its picture (`paintStump3d`).
      return bake(scale, p.sk, turn, p.paint, false);
    },
    // It throws none with the trees' (`Renderer.solidFrame`): its own is in its picture.
    shadeHead: `stump${species}|${form}|`,
    throwOf: () => {},
  };
}

/**
 * The picture of a stump drawn as a solid, as `tree3dSprite` makes a tree's:
 * the foot of its species' tree on that tile, sawn off, and its shade.
 * Moss over its rim outside the summer where its bark has moss, and snow on
 * its top in winter. Null to be drawn flat this frame.
 */
export function stump3dSprite(species: number, season: Season, _day: number, at: TreeView, scale: number): TreeSprite | null {
  return baked(stumpMaker(species, season, at.x, at.y, at.turn, scale), at.turn, sunStepOf(at.hour, at.dark), 0, at.x, at.y);
}

/** The most felled logs drawn on a tile: one for each, up to this many. */
export const LOGS_DRAWN = 3;
/** The ways a felled log lies, round the compass: it keeps none of its own, so its tile picks one. */
const LOG_WAYS = 4;
/** A log's length, in model units: over half a tile. */
const LOG_LONG = 23;
const logModels = new Map<string, ReturnType<typeof logsOf>>();

function logMaker(species: number, n: number, season: Season, x: number, y: number, turn: number, scale: number, beside: boolean): Maker {
  const way = Math.floor(hash2(Math.round(x), Math.round(y), 6271) * LOG_WAYS) % LOG_WAYS;
  const count = Math.max(1, Math.min(LOGS_DRAWN, Math.round(n)));
  const spec = SPECIES.get(species) ?? maple;
  const angle = (way / LOG_WAYS) * Math.PI + Math.PI / 8;
  // Beside a stump: the stump that tile's tree left, painted in the same picture, the logs to one side of it in the world.
  const form = formOf(species, x, y);
  const kind = `${species}|${way}|${count}|${beside ? form : -1}`;
  const model = (): ReturnType<typeof logsOf> => {
    let m = logModels.get(kind);
    if (!m) {
      // As thick as its kind of stump, a little less.
      const r = shapeOf(spec).radius * 0.66;
      const off = beside ? Math.max(...stumpModelOf(species, form).cuts.map((c) => Math.hypot(c.c[0], c.c[1]) + c.r)) * 1.3 + r * (count > 1 ? 2.1 : 1.15) : 0;
      logModels.set(kind, (m = logsOf(r, LOG_LONG, count, angle, off, species * 31 + way * 7 + count)));
    }
    return m;
  };
  return {
    lookAt: (s) => logMaker(species, n, s, x, y, turn, scale, beside),
    head: `${scale}|log${kind}|${beside ? stumpLook(species, season) : season === 'winter' ? 'w' : 'x'}`,
    leafy: false,
    makeAt: (step) => {
      const m = model();
      const light = lightOf(step);
      const trunk = trunkOf(species);
      const job = { sk: m.sk, spec: woodSpec(spec, trunk, false, true), dress: bareOf(season), light, seed: seedOf(species, STUMP_AGE, way), frame: 0, scale };
      const logs = (g: CanvasRenderingContext2D, e: Eye): void => paintLogs3d(g, { ...job, e }, m.logs, woodOf(trunk));
      if (!beside) return bake(scale, m.sk, turn, logs, false);
      // With the stump: the nearer of the two laid over the other.
      const s = stumpPainter(species, form, season, light, scale);
      const both: Skeleton = { ...m.sk, limbs: [...m.sk.limbs, ...s.sk.limbs], crown: s.sk.crown.r > m.sk.crown.r ? s.sk.crown : m.sk.crown };
      const toward = eyeOf(0, turn).toward;
      const mid = m.logs.reduce((d, l) => d + (l.a[0] + l.b[0]) * toward[0] + (l.a[1] + l.b[1]) * toward[1], 0);
      return bake(scale, both, turn, (g, e) => {
        if (mid >= 0) { s.paint(g, e); logs(g, e); } else { logs(g, e); s.paint(g, e); }
      }, false);
    },
    // Lying, it throws no more than the shade under it, which is its own (`paintLogs3d`).
    shadeHead: `log${kind}|`,
    throwOf: () => {},
  };
}

/**
 * The picture of felled logs of a species lying on a tile, drawn as solids:
 * one to three of them (`n`), lying a way the tile picks. On a stump's tile
 * (`beside`), the stump with them, the logs to one side of it. Each a length
 * of its kind of stump's stem, both ends sawn. Null to be drawn flat this frame.
 */
export function log3dSprite(species: number, n: number, season: Season, at: TreeView, scale: number, beside: boolean): TreeSprite | null {
  return baked(logMaker(species, n, season, at.x, at.y, at.turn, scale, beside), at.turn, sunStepOf(at.hour, at.dark), 0, at.x, at.y);
}
