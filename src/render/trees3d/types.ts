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
  /** A conifer's branch: the clump of the spray it carries (`Pad`), which it turns with. */
  pad?: number;
}

/**
 * One mass of leaf: a lumpy ball round `c`, `r` across, edged in a few big
 * leaves. A crown is a handful of them, touching and overlapping.
 */
export interface Clump {
  /** A conifer's bough (`Whorls`): its shape, where the mass is its middle. */
  pad?: Pad;
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
  /**
   * Where it is a cluster: the lumps it is made of, each `o` off its middle
   * and `r` across, all inside `r` of it. Painted as one mass with one rim.
   */
  subs?: Array<{ o: V3; r: number }>;
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
  /** How far past a mass's `r` its leaf reaches on the screen, for the bounds of its picture: 1.45 unless given. */
  leafReach?: number;
  /** A conifer's dark middle round its leader, as a share of each whorl's reach (`Whorls.core`). */
  core?: number;
  /** How low in its crown a conifer's sprays part to show the trunk (`Whorls.parted`). */
  parted?: number;
}

/** The tree's proportions at one age, in model units. */
export interface Build {
  /** A conifer: whorls of hanging boughs up one leader in place of limbs and masses. */
  whorls?: Whorls;
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
  /**
   * Bark in the light and in shade, and the dead wood's; moss on the foot of the trunk, where it has any; furrows broken into ridges, where it is rough;
   * long fibres down the trunk in this colour between its furrows, where it is stringy; the dead wood's shade, where it is not the living's.
   */
  bark: { lit: string; shade: string; dead: string; furrow: string; moss?: string; ridged?: boolean; strands?: string; deadShade?: string };
  /** The leaf a mass is edged in and that falls: 'maple' five-pointed (the default), 'oak' round-lobed. */
  leafForm?: 'maple' | 'oak';
  /** Roots drawn as lobes of the trunk's foot on the ground, with dips between, rather than as limbs. */
  buttress?: boolean;
  /** Snow as a narrow line along the top edge of the wood, rather than over all its upper face. */
  snowLine?: boolean;
  /** Stones and ferns round the foot: the stone's colour (`Undergrowth`). */
  undergrowth?: { stone: RGB };
  /** A carved rune inked in the kit's ink, and lit as a runestone's runes after dark. */
  inkedRune?: boolean;
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
  /** Keeps its leaf all year: its winter leaf, and its new tips in spring (`leaf.spring`). */
  evergreen?: { winter: Ramp };
}

/**
 * A conifer's habit: whorls of boughs round a straight leader, widest at
 * the bottom and narrowing up it, each bough a pad lying out from the
 * leader and falling to a hem of hanging fingers. The build's `stem` is the
 * bare trunk under the lowest whorl, `spread` the lowest whorl's reach and
 * `droop` how far a bough falls for its reach.
 */
export interface Whorls {
  /** Whorls up the leader. */
  tiers: number;
  /** Boughs in the lowest whorl; the top ones have fewer. */
  pads: number;
  /** A spray's half-width at its widest, against its length. */
  width: number;
  /** How much of a bough's reach is bare branch before its spray starts. */
  bare: number;
  /** Boughs that reach out further than the rest of their whorl. */
  long: number;
  /** How far its fingers hang under it, against the rise from one whorl to the next. */
  hang: number;
  /** Fingers round a bough's end. */
  fingers: number;
  /** How unevenly the boughs reach, 0 to 1. */
  ragged: number;
  /** The top whorl's reach against the lowest's. */
  taper: number;
  /** Where the live crown stops, as a share of the height: the leader above it dead (1: alive to the top). */
  deadTop: number;
  /** The dead leader snapped and bent over. */
  broken: boolean;
  /** Dead stubs of boughs on the bare trunk. */
  stubs: number;
  /** Share of the boughs gone from the whorls. */
  gaps: number;
  /** A ragged tuft of small boughs on the leader over the top whorl, its tip clear of them. */
  spire: boolean;
  /** How low the lowest boughs hang, as a share of the height. */
  hem: number;
  /**
   * Lacy sprays: each bough sweeps out and hangs, its sides and end a fringe
   * of this many small hanging tips, its top in layers. None: the pine's
   * pads with blunt fingers.
   */
  lace?: number;
  /** The leader's tip bent over, as a share of the height. */
  nod?: number;
  /** A bough's branch against the leader's radius where it leaves it: 0.22 unless given. */
  limb?: number;
  /** Roots as buttresses: two pieces, out of the trunk and down along the ground (`Species3D.buttress`). */
  buttress?: boolean;
  /** The crown's dark middle round the leader, as a share of each whorl's reach: none unless given. */
  core?: number;
  /** Where the top whorl is under a spire, as a share of the height: 0.86 unless given. */
  top?: number;
  /** Small whorls up the spire over the top whorl: two unless given. */
  tufts?: number;
  /** The trunk's foot swollen this much wider into its roots. */
  swell?: number;
  /** How far up the crown, as a share of it, each bough carries a second, shorter spray over it. */
  split?: number;
  /** Lacy sprays turned aside from the eye to show the trunk (`partOf`) only this low in the crown, and a few higher: all of them unless given. */
  parted?: number;
}

/** One bough of a conifer, round its mass's middle. */
export interface Pad {
  /** From the mass's middle to where the spray starts, on its branch. */
  root: V3;
  /** From the mass's middle to where its branch leaves the leader. */
  base: V3;
  /** Its way out along the ground, a unit vector. */
  d: V3;
  reach: number;
  /** Half-width at its widest. */
  w: number;
  /** How far its end falls below where it leaves the leader. */
  drop: number;
  /** How far the needles hang under it at its end. */
  hang: number;
  fingers: number;
  /** Lacy (`Whorls.lace`): its fringe's tips. */
  lace?: number;
}
