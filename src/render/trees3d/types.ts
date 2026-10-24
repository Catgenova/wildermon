/**
 * What a tree drawn as a solid is made of, and what a species file says.
 *
 * A tree is a model in tenths of a metre, the kit's units (`kit/core.ts`):
 * `x` and `y` along the ground as the world's own axes, `z` up, its foot at
 * the origin. It is never turned with the camera; the camera's turn is the
 * eye it is drawn from (`eyeOf`), and the sun is the world's (`../sun`), so
 * the light on it and the shade it throws agree with the ground's.
 */
import type { Season } from '../../world/calendar';
import type { AgeKey } from '../trees/types';

export type V3 = [number, number, number];
export type RGB = [number, number, number];

/** One straight piece of wood, tapering from `ra` at `a` to `rb` at `b`. */
export interface Limb {
  a: V3;
  b: V3;
  ra: number;
  rb: number;
  /** 0 the trunk, 1 a scaffold limb, 2 a branch off one, 3 a twig, 4 a fine twig; -1 a root. */
  order: number;
  /** The piece it grows from, or -1. */
  parent: number;
  /** Which scaffold limb it belongs to (the trunk and the leader are their own), for the sway. */
  bough: number;
  /** Dead wood: no leaf, greyed. */
  dead?: boolean;
  /** Has nothing growing off its end. */
  tip?: boolean;
}

/**
 * One mass of leaf: a lumpy ball round `c`, `r` across, edged in a few big
 * leaves. A crown is a handful of them, touching and overlapping.
 */
export interface Clump {
  c: V3;
  r: number;
  /** The limb it grows on, which it moves with in the wind. */
  limb: number;
  /** Its own seeded number, 0..1, for its order in a turning or thinning crown. */
  k: number;
  /** How far out of the middle of the crown it sits, 0 to 1. */
  out: number;
  /** How high up the crown, 0 its underside to 1 its top. */
  up: number;
}

/** The crown's ellipsoid: what the clumps are kept inside and lit against. */
export interface Envelope {
  c: V3;
  r: number;
  rz: number;
}

export interface Skeleton {
  limbs: Limb[];
  clumps: Clump[];
  crown: Envelope;
  height: number;
  /** The direction a carved rune faces out of the trunk, on the ground, when it has one. */
  rune: number | null;
  /** A hollow in the trunk, facing this way, when it has one. */
  hollow: number | null;
}

/** The tree's proportions at one age, in model units. */
export interface Build {
  /** Height of the whole tree at size 1 (`TREE_DEFS` size times the age's). */
  height: number;
  /** Clear stem below the crown, as a share of the height. */
  stem: number;
  /** The crown's half-width, as a share of the height. */
  spread: number;
  /** The crown's half-height, as a share of what is over the stem: under a half is a crown wider than it is tall. */
  dome: number;
  /** How far the ends of the limbs hang, as a share of their reach. */
  droop: number;
  /** Trunk radius at its foot, as a share of the height. */
  girth: number;
  /** Root flare: the foot this many times the trunk. */
  flare: number;
  /** Scaffold limbs off the trunk. */
  scaffolds: number;
  /** How many times a limb forks: 1 to 3. */
  forks: number;
  /** Branches off each limb at each fork. */
  branching: number;
  /** Masses of leaf in a full crown: one on top and the rest round it. */
  clumps: number;
  /** A mass's radius against the crown's half-width. */
  clumpSize: number;
  /** How bent the trunk and limbs grow, 0 to 1. */
  gnarl: number;
  /** Trunk lean, in model units at the top. */
  lean: number;
  /** Scaffold limbs that are dead wood. */
  dead: number;
  /** Shrivelled: every limb dead and broken back, nothing on it. */
  bare: boolean;
  /** A rune cut in the bark. */
  rune: boolean;
  hollow: boolean;
  /**
   * How it is grown: 'dome' (`grow`) a few sinuous limbs under one dome of
   * big masses; 'spreading' (`growSpreading`) a short trunk on buttress roots
   * splitting low into crooked limbs, the lowest near level, under an open
   * crown of many small masses on the branch ends.
   */
  habit?: 'dome' | 'spreading';
  /** Spreading: share of the scaffold limbs that reach out near level. */
  low?: number;
  /** Spreading: how far a limb turns at each elbow, radians. */
  zig?: number;
}

/** A run of tones from the deepest shade to the lit top: a clump is painted in four neighbours on it. */
export type Ramp = readonly string[];

/** Everything about one day's dress a painter needs. */
export interface Dress {
  season: Season;
  /** The step of the season's look, 0 to `LOOK_STEPS - 1`. */
  step: number;
  /** Share of the clumps in leaf, 0 to 1. */
  full: number;
  /** Share of the crown turned to autumn colour. */
  turned: number;
  /** Leaves or keys lying round the foot. */
  litter: number;
  /** Old enough to hang keys. */
  keys: boolean;
}

export interface Species3D {
  /** The `TREE_DEFS` name. */
  name: string;
  /** Each age's build: the mature one, and what each other age changes. */
  build: Build;
  ages: Partial<Record<AgeKey, Partial<Build>>>;
  /** Bark in the light and in shade, and the dead wood's; moss on the foot of the trunk, where it has any; furrows broken into ridges, where it is rough. */
  bark: { lit: string; shade: string; dead: string; furrow: string; moss?: string; ridged?: boolean };
  /** The leaf a mass is edged in and that falls: 'maple' five-pointed (the default), 'oak' round-lobed. */
  leafForm?: 'maple' | 'oak';
  /** A mass's height on the screen against its width: 0.86 unless given. */
  pad?: number;
  /** An open crown: the wood laid among the masses by depth, the branches seen through the gaps. */
  open?: boolean;
  /** The leaf through the year. A ramp runs from the deepest shade to the lit top. */
  leaf: {
    summer: Ramp;
    spring: Ramp;
    /** Autumn's three, from the top of the crown outward. */
    autumn: readonly [Ramp, Ramp, Ramp];
  };
  /** The seed it hangs: winged keys in pairs. */
  keys?: { colour: string; ripe: string };
  /** The buds on the bare twigs at the start of spring. */
  buds?: string;
}
