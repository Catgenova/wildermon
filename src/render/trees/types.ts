/**
 * What a species file says about how its tree is drawn.
 *
 * Every tree is painted by the shared painters in `./paint.ts`, run in order
 * by `./tree.ts`; a species only says which of them it uses and with what
 * numbers. So a species is made to look different by editing its own file in
 * `./species/` and nothing else:
 *
 * - `form` picks the painter: `broadleaf` (a crown of leaf clusters on a
 *   trunk and limbs), `conifer` (drooping tiers on a leader) or `weeping`
 *   (a dome with strands hanging off it).
 * - `leaf` is summer's three tones; spring's new leaf, an evergreen's winter
 *   and the dulling of a very old crown are all worked out from it. `autumn`
 *   replaces the colour it turns (`../foliage` AUTUMN otherwise).
 * - `bark` and `marks` are the trunk, `twig` the fine twigs if not bark; `cluster` is the shape of one clump of
 *   leaf (`puff` scalloped, `star` pointed, `leaves` single leaves round a
 *   middle).
 * - `shape` is the mature tree (any `Shape` field left out keeps the form's
 *   default); each age is worked out from it by the shared age rules, and
 *   `ages` then sets any field outright for one age.
 * - `fruit` is what hangs on it at the ages that bear (`TREE_AGES.bears`),
 *   only in summer and autumn while the crown is full and not in flower.
 * - `layout(geo, info)` may move, add or drop anything in the geometry after
 *   it is built and before anything is painted; `beforeCrown(ctx, geo, info)`
 *   paints after the trunk and limbs, under the leaf; `extra(ctx, geo, info)`
 *   paints last, over everything. All three are optional, and a painted hook
 *   must stay inside the sprite's box and keep to seeded randomness
 *   (`info.wob`), so every tree of a species and age is one picture.
 *
 * Units are the sprite's design units (64 to a tile's width); y grows down;
 * the foot of the trunk is `geo.foot`.
 */
import type { Season } from '../../world/calendar';
import type { TreeAge } from '../../world/tiles';
import type { Bloom, Leafage } from '../foliage';

/** Lit, body and underside, as a crown is painted. */
export type Tones = readonly [light: string, mid: string, deep: string];

/** The ages a species can set apart, by what they look like (`TREE_AGES`). */
export type AgeKey = 'sapling' | 'young' | 'mature' | 'old' | 'veryOld' | 'shrivelled' | 'clipped';

export type Form = 'broadleaf' | 'conifer' | 'weeping';

/** How one clump of leaf is outlined. */
export interface ClusterLook {
  style: 'puff' | 'star' | 'leaves';
  /** Bumps, points or leaves round one clump. */
  lobes: number;
  /** How deep they cut in, 0 to 1. */
  depth: number;
  /** `leaves` only: leaf length against the clump's radius, about 1. */
  leaf?: number;
  /** `leaves` only: leaf width against its length, about 0.4. */
  slim?: number;
  /** Single leaves standing out of each clump's edge (when not given: 3, or none for `leaves`). */
  flecks?: number;
}

/**
 * The tree's proportions. Lengths are shares of the tree's height unless
 * said otherwise; the height is `height` design units times the species'
 * `TREE_DEFS` size times the age's.
 */
export interface Shape {
  /** Height of the whole tree, in design units at size 1. */
  height: number;
  /** Clear stem below the crown, as a share of the height. */
  trunk: number;
  /** Crown width against crown height. */
  width: number;
  /** Half-width of the trunk just above its flare, as a share of the height. */
  girth: number;
  /** Trunk lean, -1 to 1 (left to right), in trunk widths. */
  lean: number;
  /** Width of the root flare against the trunk's. */
  flare: number;
  /** How bent and knotted the trunk is, 0 to 1. */
  gnarl: number;
  /** A hollow in the trunk. */
  hollow: boolean;
  /** Dead limbs standing out of the crown. */
  dead: number;
  /** Leaf clumps in a full crown. */
  clusters: number;
  /** A clump's radius against the crown's half-width. */
  clusterSize: number;
  /** Share of the clumps missing, 0 to 1: a thin, patchy crown. */
  gaps: number;
  /** Main limbs off the top of the trunk. */
  limbs: number;
  /** Underside of the crown flattened, 0 round to 1 flat. */
  flat: number;
  /** Above 0 the crown narrows toward the top; below, it is broadest at the top. */
  peak: number;
  /** The crown shifted sideways, in crown half-widths. */
  shift: number;
  /** `conifer`: tiers of boughs. */
  tiers: number;
  /** `conifer`: how far a tier's tips hang below where it leaves the leader, in tier steps. */
  droop: number;
  /** `weeping`: hanging strands. */
  strands: number;
  /** `weeping`: where the strands stop, as a share of the height above the ground. */
  hem: number;
}

export interface Fruit {
  colour: string;
  /** Dot size, 1 the default small dot. */
  size: number;
  /** How many on a mature crown. */
  count: number;
  shape: 'round' | 'pear' | 'oval';
}

export interface TreeLook {
  form: Form;
  leaf: Tones;
  autumn?: Tones;
  bark: string;
  /** The fine twigs, where they differ from the bark (birch: dark twigs on a white bole). */
  twig?: string;
  marks?: 'birch' | 'furrows' | 'smooth';
  cluster: ClusterLook;
  shape: Partial<Shape>;
  ages?: Partial<Record<AgeKey, Partial<Shape>>>;
  fruit?: Fruit;
  layout?: (geo: TreeGeometry, info: PaintInfo) => void;
  beforeCrown?: Hook;
  extra?: Hook;
}

export type Hook = (ctx: CanvasRenderingContext2D, geo: TreeGeometry, info: PaintInfo) => void;

/** One clump of leaf. `lit` is -1 facing away from the light to 1 facing it. */
export interface Cluster {
  x: number;
  y: number;
  r: number;
  lit: number;
  /** Its own index into `info.wob`, so a moved clump keeps its look. */
  seed: number;
  /** Left out: a gap in a thin crown, or leaf not yet out. */
  hide?: boolean;
  /** Its tones when not the crown's own (set by the season, or by a hook). */
  tones?: Tones;
  /** In flower. */
  bloom?: boolean;
}

/** A tapered piece of wood from (x0, y0) to (x1, y1) bent through (cx, cy). */
export interface Limb {
  x0: number; y0: number;
  cx: number; cy: number;
  x1: number; y1: number;
  w0: number; w1: number;
}

/** One tier of a conifer: hung off the leader at `ax`, from `top` down to its tips at `bottom`. */
export interface Tier {
  ax: number;
  top: number;
  bottom: number;
  /** Reach to the left and to the right of the leader. */
  left: number;
  right: number;
  /** How far its tips hang below `bottom`. */
  droop: number;
  seed: number;
  hide?: boolean;
}

/** One hanging strand of a weeping crown. */
export interface Strand {
  x: number;
  y: number;
  len: number;
  /** How far it reaches out sideways from its root before it hangs. */
  arch: number;
  /** Sideways drift at its end. */
  sway: number;
  w: number;
  /** 0 hangs behind the trunk, 1 in front of it, 2 over the top of the dome in front of everything. */
  layer: number;
  seed: number;
  /** Bare: a withy, with the leaf down. */
  bare?: boolean;
}

export interface TreeGeometry {
  foot: { x: number; y: number };
  /** The tree's height in design units. */
  height: number;
  trunk: { x0: number; y0: number; x1: number; y1: number; w0: number; w1: number };
  /** The crown's bounding ellipse. */
  crown: { cx: number; cy: number; rx: number; ry: number };
  limbs: Limb[];
  clusters: Cluster[];
  tiers: Tier[];
  strands: Strand[];
  dead: Limb[];
}

export interface PaintInfo {
  species: number;
  name: string;
  age: TreeAge;
  ageKey: AgeKey;
  season: Season;
  look: Leafage;
  /** The shape after the age rules and `ages`. */
  shape: Shape;
  /** The leaf as the day has it. */
  leaf: Tones;
  /** The colour it turns, while it is turning. */
  turned: Tones | null;
  /** The share of the crown turned. */
  turning: number;
  bark: string;
  /** How much of the crown is in leaf or flower, 0 bare to 1 full. */
  keep: number;
  bloom: Bloom | null;
  /** Fruit shows today. */
  fruiting: boolean;
  /** Seeded 0..1 for this species. */
  wob: (i: number) => number;
}
