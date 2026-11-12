import type { Kit } from './kit';

/**
 * The shapes the masonry painter works in: a block, a lobe of growth, a variant, a stock, the
 * painted set (`Masonry`, `Low`), and `Lay`, the hooks one lay is painted through.
 */

export type Rand = () => number;

export type Ctx = CanvasRenderingContext2D;

export type Pt = [number, number];

/** A lobe of a mass of growth: where it is, and how big. */
export type Lobe = [number, number, number];

/** One block of a wall, and the outline it was drawn with. */
export interface Block { x: number; y: number; w: number; h: number; course: number; pts: Pt[] }

/** How many more blocks of a tone are owed, so sand and brown come in pairs. */
export interface Run { tone: string; left: number }

/** Ivy over the top of a section: a crest, and the curtain that falls from it. */
export interface Drape { cx: number; w: number; fall: number; tongues?: number; seed: number }

/** A hedge at the foot of one. */
export interface Hedge { cx: number; w: number; h: number; flowers: number; seed: number }

export interface Variant {
  name: string;
  tells: string;
  seed: number;
  extras: { moss: number };
  drapes: Drape[];
  foot: { hedges: Hedge[] };
}

/**
 * A field wall: the low one, with a coping instead of a band and everything it
 * carries painted into the one picture, because it has no openings to clip
 * growth out of and no storey above it to belong to.
 */
export interface Low {
  face: HTMLCanvasElement[];
  /** The same with a gap for a gate, and a pier dressed against each side of it. */
  gate: HTMLCanvasElement[];
  /** The run of cope stones seen from above, one per variant, the same stones as that variant's face. */
  cap: HTMLCanvasElement[];
  /** The same with the gate's opening taken out of it, and a flat stone on each pier. */
  gateCap: HTMLCanvasElement[];
  /** On a coping of stones, the one over a corner or a junction, which the copes either side stop at. */
  corner?: HTMLCanvasElement;
  ends: HTMLCanvasElement;
  h: number;
  /** How far the face and the cap are painted past the wall, so a cope stone can stand over the run. */
  proud: number;
  /**
   * On a masonry whose head is laid by hand, how far that head rises over
   * its line along a section, per variant, in picture px at evenly spaced
   * points from end to end: the face's, and the gate's with its piers.
   */
  crest?: number[][];
  gateCrest?: number[][];
  /**
   * On a frame, its post where the run turns a corner or stops, and on a log
   * wall its corner: `foot` px over the ground, on the footing, to the head;
   * `alt` for a wall running the other way, where a corner is laid the other
   * way round.
   */
  post?: { img: HTMLCanvasElement; alt?: HTMLCanvasElement; foot: number };
}

/** The painted wall, in the pieces a renderer fills its faces with. */
export interface Masonry {
  /** One per variant: the stone of a storey, which butts any other left or right and stacks on any. */
  face: HTMLCanvasElement[];
  /** The same, with an archway cut through it and a ring of rough voussoirs round the hole. */
  arch: HTMLCanvasElement[];
  /** What grows into that opening: ivy dangling from the head of it, and grass in the threshold. */
  archIvy: HTMLCanvasElement[];
  archWeed: HTMLCanvasElement[];
  /** The same with a window: the hole, the ivy over it, and what has seeded behind the sill. */
  window: HTMLCanvasElement[];
  winIvy: HTMLCanvasElement[];
  winWeed: HTMLCanvasElement[];
  /** And with a doorway, whose head is a baulk of oak rather than anything cut. */
  door: HTMLCanvasElement[];
  doorIvy: HTMLCanvasElement[];
  doorWeed: HTMLCanvasElement[];
  /** And a cart gate: the same at twice the span, with a corbel under each end of the beam. */
  gate: HTMLCanvasElement[];
  gateIvy: HTMLCanvasElement[];
  gateWeed: HTMLCanvasElement[];
  /** And a bay: the hole and the shelf it stands on. What stands on it is not flat, so it is not here. */
  bay: HTMLCanvasElement[];
  /**
   * The quoins at the left and the right end of a section, over the face, for
   * where a run stops or turns a corner; absent on a masonry that has none.
   */
  quoinL?: HTMLCanvasElement;
  quoinR?: HTMLCanvasElement;
  /** The low wall at a given fraction of a storey, painted once per height that asks for it. */
  low: (k: number) => Low;
  /**
   * On a masonry whose gates hang between piers, how far those piers stand
   * over the garden wall either side of them, as a share of a storey: a gate
   * of it stands that much over the tallest garden wall it hangs in, and
   * never under its own height.
   */
  piers?: number;
  /**
   * How much of the top of a face is the head of the storey -- the band
   * course, the plate, the frieze -- in picture px. A gable end carried up
   * over the top storey is the field under it laid again, without it.
   */
  head: number;
  /** The ivy of the top storey, `pad` px taller than a face, the extra above its top edge. */
  spill: HTMLCanvasElement[];
  /** The hedge at the foot of the ground storey, and the damp along its ground line. */
  base: HTMLCanvasElement[];
  foot: HTMLCanvasElement[];
  /** The cap along the top of a wall, and the end grain where a run stops. */
  cap: HTMLCanvasElement;
  /**
   * On a masonry whose cap is a course of stones, the one stone over the
   * square where two walls meet at a corner, front edge at the bottom, a
   * joint all round it: each wall's cap stops at it. Without it one wall's
   * cap ran on over the corner and the other's stopped against it, and the
   * joints of the two met anywhere.
   */
  corner?: HTMLCanvasElement;
  ends: HTMLCanvasElement;
  /** On a masonry whose foot goes round a free end as it runs along the face, the ground storey's end. */
  endsFoot?: HTMLCanvasElement;
  /**
   * On polished metal, the part of any of its pictures that keeps its light
   * on a face turned from the sun -- its brightest pixels, and nothing else --
   * which the renderer lays again over a face after the hour's shade. A
   * mirror turned from the sun still shows the sky; shaded over whole,
   * silver went to grey stone on every face away from the light.
   */
  gleam?: (img: HTMLCanvasElement) => HTMLCanvasElement;
  /**
   * Whether its pictures are lit from their left, and so are laid the other
   * way round on a face that runs right to left on screen. That face is the
   * one turned from the light, and laid as painted it had the light on the
   * wrong side of everything in it: the shade down every post on the side
   * toward the sun.
   */
  handed?: boolean;
  /**
   * On a frame, the post it is finished with where a run turns a corner or
   * stops, a storey tall, its outer edge on the picture's left; and how far
   * it reaches into a section from the section's end, in picture px, which
   * is over the half of the end post the section has of its own. On a log
   * wall, its corner, where the logs of the two walls cross: `alt` for the
   * wall that runs the other way, which takes the crossing the other way
   * round, and no `free`, since a log wall that stops has only its ends.
   */
  post?: { img: HTMLCanvasElement; alt?: HTMLCanvasElement; reach: number; free?: boolean };
  /**
   * The stone the wall's own thickness shows in the reveal of an archway.
   *
   * A painted wall's face is a picture, not the material's flat colour, so
   * the colour the material carries is no guide to what the side of a hole
   * cut through it should be. This is the picture's own shaded stone.
   */
  reveal: [number, number, number];
  /** And the ink it outlines every block with, for the edge of a hole cut in it. */
  line: [number, number, number];
  /** The oak over a doorway, for the leaf hung under it and the soffit it makes. */
  beam: [number, number, number];
  beamLine: [number, number, number];
  /**
   * How much of the ground storey is plinth, in the section's own pixels, or
   * 0 where the masonry has none.
   *
   * A plinth is the one course of a wall that stands out past its face, so it
   * is the one that throws anything on the ground it stands on -- and the
   * renderer draws the ground, not this.
   */
  plinth: number;
  /**
   * What the hour darkens a face of it toward, as three channels.
   *
   * Cobblestone goes toward a warm near-black, which on grey stone reads as
   * shade. On red brick the same multiply takes the red to brown -- a face
   * turned from the light loses light, and on this island it goes cool as it
   * does, toward the colour of the stone the brick is dressed in.
   */
  shade: [number, number, number];
  /** Whether the ivy, hedge and weed pictures below have anything in them to draw. */
  growth: boolean;
  /**
   * The beam ends of the floor over a storey, for the two walls of a house
   * its joists rest on; absent on a masonry that has none.
   *
   * Per variant: the logs as they stand off a face seen from a diagonal
   * (`iso`) and from square on (`square`), each `h` px deep from the head of
   * the storey and painted leaning out to the left -- the face whose picture
   * is laid mirrored takes them mirrored -- and the shade the row throws on
   * a face in the sun, `sh` px deep, falling to the right.
   */
  vigas?: {
    iso: HTMLCanvasElement[];
    square: HTMLCanvasElement[];
    shade: HTMLCanvasElement[];
    h: number;
    sh: number;
  };
  /** Per variant, the coat rolled over the head of a wall nothing stands on; laid over the top of the face. */
  brow?: HTMLCanvasElement[];
  /**
   * Per variant, how far the head of a wall nothing stands on rises over its
   * line along the section, in picture px at evenly spaced points from end to
   * end, nothing at either end; absent where the head runs to a line.
   */
  crest?: number[][];
  /**
   * Where the coat has come away, for the renderer to lay out of doors where
   * the weather takes it: off a corner (painted with the corner on the right),
   * out of the foot (two courses more under it than show, for the foot to
   * cover), under the end of a sill, under the head. Each is laid with its
   * first course `lip` px down, on one of the wall's course lines, which are
   * `ch` apart from `from` down the storey.
   */
  losses?: {
    corner: HTMLCanvasElement[];
    foot: HTMLCanvasElement[];
    sill: HTMLCanvasElement[];
    head: HTMLCanvasElement[];
    lip: number;
    ch: number;
    from: number;
  };
  /**
   * Whether the wall is a coat laid by hand: its head rising and falling, its
   * corners and ends rolled, its insides in the shade of the room.
   */
  soft: boolean;
  /** How much of `shade` the hour lays over a face it lights `k`. */
  shadow: (k: number) => number;
  /** The top of the wall's own tones, where it is drawn flat -- lit, its crown, and the far slope of it -- on a masonry that has them. */
  top?: { lit: [number, number, number]; hi: [number, number, number]; shade: [number, number, number] };
  /**
   * Whether the coat goes round a corner: a face carried on past its end by
   * the thickness of the wall that turns there, rather than both walls
   * stopping short and leaving their two ends showing in the angle.
   */
  wrap: boolean;
  /**
   * Whether a run takes its variants by a hash of where each section is,
   * rather than in turn. In turn, five pictures repeat every twenty metres;
   * on stone the joints hide it, and on a coat of mud it is a stamp.
   */
  scatter: boolean;
  /** The coat's own lit tone, for the rounded arris where it turns a corner. */
  hi: [number, number, number];
  /**
   * The flat colour to lay under a section before its picture, or none.
   *
   * Two sections' pictures meet on one line, and each one's edge is drawn
   * half-covered, so a hairline of whatever is behind shows between them. On
   * stone or brick the joints swallow it; on a coat of mud, which has no
   * joints, it is a ruled line down the wall every four metres. On a frame
   * it is the oak, which is what every seam and every floor line of a frame
   * falls in: under the limewash it was a pale line along every floor.
   */
  under?: [number, number, number];
  /** A section is `w` by `h`; the ivy reaches `pad` above it, and the cap is `capH` deep. */
  w: number;
  h: number;
  pad: number;
  capH: number;
  /**
   * The road: `paveN` squared pictures of cobbles laid on the ground, in light
   * and shade rather than in colour, to be laid over a tile with `overlay`.
   * Tile (x, y) takes the one at (x mod paveN, y mod paveN) and they butt.
   */
  pave: () => HTMLCanvasElement[];
  paveN: number;
  /** The grey that changes nothing under `overlay`, for anything drawn beside the road. */
  neutral: string;
  /** What each variant carries, for anything that wants to say. */
  tells: string[];
}

/**
 * What a masonry is, as far as the painter is concerned.
 *
 * Everything below paints one wall: the courses, the openings cut in them,
 * the coping, the cap, the end grain, and every green thing that has got into
 * any of it. What tells cobblestone from brickwork is the colour it is laid
 * in, the size of the unit and whether it was laid by eye or to a line -- and
 * that is all that is in here.
 */
export interface Tone { lit: string; shade: string; hi: string }

export interface Stock {
  pastel: Record<string, string>;
  /** The tones a unit can take. `flat` is the band course, `dress` the stone an opening is cut in. */
  tones: Record<string, Tone>;
  /**
   * How the field is laid.
   *
   * `rubble` is stone off the field, courses of it roughly level and no two
   * pieces alike: the size of every block is drawn, so there is no bond and
   * the seam has to be kept by hand. `bond` is a moulded unit laid to a line
   * in a half lap, which keeps the seam by itself -- every other course has a
   * unit across it, and that unit is drawn at both edges from one seed.
   * `render` is mud brick under a coat of mud: a field of plaster laid on by
   * hand, with the brick showing only where the coat has come away. `frame`
   * is timbercraft: an oak frame pegged together and stood on a footing,
   * its panels filled with daub and limewashed.
   */
  lay: 'rubble' | 'bond' | 'render' | 'frame' | 'log' | 'plank' | 'gild';
  /** For a bond: courses to a storey, and units across a course. */
  rows: number;
  across: number;
  /** For a bond: a course of headers every this many, or 0 for stretchers only. */
  headers: number;
  /** The two tones the plinth's stones are cut from, the first in a little over a third of them. */
  base: [string, string];
  /** How wide the joint is, in pixels. Brick shows more mortar than rubble does. */
  mortar: number;
  /** Blocks across the band course at the head of a storey. */
  bandN: number;
  /** A plinth of dressed stone at the ground, this many pixels of the storey tall; 0 for none. */
  plinth: number;
  /** What share of a novice's wear this masonry takes: kiln-fired units chip, they do not spall. */
  wear: number;
  /** What the hour's light darkens a face toward; see `Masonry.shade`. */
  shade: [number, number, number];
  /** And how far, for a face the hour lights `k`; see `Masonry.shadow`. */
  shadow: (k: number) => number;
  /**
   * Whether anything grows on it: ivy over the top, a hedge at the foot,
   * moss in the joints, weeds in a threshold. Cobblestone and brick carry
   * the island's planting and nothing else does -- a coat of mud is bare.
   */
  growth: boolean;
  /** The share of units that take each tone, in order; whatever is left takes the field's own. */
  mix: Array<[string, number]>;
  /** The tones that come in pairs rather than singly, because a load of them came in together. */
  pairs: string[];
  /** The tones a field wall carries that a house wall does not, and how often. */
  field: Array<[string, number]>;
  /**
   * On sandstone, the stone's own grain: the beds it was laid down in,
   * showing as faint laminae across every block and crossing at a slant in
   * one in five; bands of iron through the iron-rich ones; its arrises worn
   * soft; blocks of no set length; and time taking it by honeycomb and by
   * scaling off in skins, where cut stone chips and cracks.
   */
  grain?: boolean;
  /** How much taller than the short courses the tall ones are, turn about: 0.3 lays them 1.3 to 0.7. None lays them alike. */
  rhythm?: number;
  /**
   * On slate, brick laid for show: Flemish bond, a stretcher and a header
   * turn about in every course; a diaper of violet headers over the field;
   * and a course of dogtooth under the band at the head of every storey.
   */
  ornate?: boolean;
  /**
   * Laid by a master, for the masonries that ask the most of a mason: every
   * course dead level and every joint the width of the next, arrises cut
   * true, and next to nothing knocked or cracked. The value of each unit,
   * and the hand in its outline, are left as they are -- that is the
   * material, not the workmanship.
   */
  master?: boolean;
  /**
   * On marble, a house wall faced in great slabs rather than laid in
   * courses: two to a section across and two courses to a storey, each
   * column of two sawn from its own block, so its veins run on over the bed
   * joint from the upper slab into the lower and break at every joint
   * across. Every unit of it, and every dressing, is veined; a garden wall
   * of it is laid in courses of blocks.
   */
  slab?: boolean;
  /**
   * On stained glass, a panel of leaded glass under the band where the slabs would
   * be: pastel panes of no set size between a marble pilaster at each end of
   * the section. Everything else -- the band, the plinth, the quoins, every
   * architrave, hood and sill -- is the marble's, laid in an ivory stone,
   * because the glass is set in a frame of cut stone.
   */
  stained?: boolean;
}

/**
 * What a lay paints, piece by piece: every picture of a masonry is cut and
 * assembled the same way, and these are the parts of it that differ by lay.
 */
export interface Lay {
  /** A storey's field, and the units in it that are this variant's own to mark. */
  courses(kit: Kit, g: Ctx, R: Rand, crests: Pt[], open: boolean, vi: number): Block[];
  /** What an archway is cut in: jambs, imposts, the ring. */
  arch(kit: Kit, g: Ctx, R: Rand): void;
  /** What a window or a bay is cut in. */
  surround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, wide: number, shelf: number): void;
  /** What a doorway or a cart gate is cut in, `reach` the corbels under a gate's beam. */
  doorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number, reach: number): void;
  /** The foot of the ground storey: a plinth, a footing, the eroded foot of a coat. */
  foot(kit: Kit, g: Ctx, R: Rand): void;
  /** The top of a wall, seen from above. */
  cap(kit: Kit, g: Ctx): void;
  /** The stone over a corner, on a masonry whose cap is a course of stones. */
  corner?(kit: Kit): HTMLCanvasElement;
  /** The end of a storey where a run stops, `Wc` across. */
  ends(kit: Kit, g: Ctx, R: Rand, Wc: number): void;
  /** The end of the ground storey, on a masonry whose foot goes round a free end. */
  endsFoot?(kit: Kit, g: Ctx, R: Rand, Wc: number, y0: number, ends: HTMLCanvasElement): void;
  /** A low wall's coping, if it has one. */
  coping?(kit: Kit, g: Ctx, seed: number): void;
  /** The course a dry cope is levelled on, if it has one. */
  levelling?(kit: Kit, g: Ctx, R: Rand): void;
  /** A low wall's body under its coping, `fh` tall. */
  lowCourses(kit: Kit, g: Ctx, R: Rand, fh: number, rows: number, vi: number): Block[];
  /** A low wall's cap from above. */
  lowCap(kit: Kit, g: Ctx, v: Variant): void;
  /** A low wall's end. */
  lowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number, rows: number): void;
  /** A pier at one side of a gate in a low wall, before the gap is cut. */
  gatePier?(kit: Kit, g: Ctx, R: Rand, side: number, line: number, fh: number): void;
  /** What stands either side of a gate in a low wall, after the gap is cut. */
  gateAfter?(kit: Kit, g: Ctx, R: Rand, fh: number, gx0: number, gx1: number): void;
  /** The top of a gate's pier, seen from above. */
  gateCapPier(kit: Kit, g: Ctx, R: Rand, x: number): void;
  /** A low wall's post at a corner or an end. */
  lowPost?(kit: Kit, fh: number): NonNullable<Low['post']>;
  /** A low wall's cope stone over a corner. */
  lowCorner?(kit: Kit): HTMLCanvasElement;
  /** A storey's post at a corner or an end. */
  post?(kit: Kit): NonNullable<Masonry['post']>;
  /** The quoins at a section's left (-1) or right (1) end. */
  quoins?(kit: Kit, side: -1 | 1): HTMLCanvasElement;
  /** The flat colour laid under a section's picture (`Masonry.under`). */
  under?(kit: Kit): [number, number, number] | undefined;
  /** The rise of a head nothing stands on, its rolled brow, the coat's losses and the beam ends: a coat of mud's. */
  crest?(kit: Kit): number[][];
  brow?(kit: Kit): HTMLCanvasElement[];
  losses?(kit: Kit): NonNullable<Masonry['losses']>;
  vigas?(kit: Kit, losses: NonNullable<Masonry['losses']>): NonNullable<Masonry['vigas']>;
  /** How much of the top of a face is the head of the storey (`Masonry.head`). */
  head: number;
  soft?: boolean;
  wrap?: boolean;
  scatter?: boolean;
  handed?: boolean;
  /** Whether a face away from the sun keeps its brightest pixels (`Masonry.gleam`). */
  gleam?: boolean;
  /** How far a gate's piers stand over the wall (`Masonry.piers`). */
  piers?: number;
}
