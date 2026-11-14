import type { PlacedAnvil } from '../game/anvil';
import type { LadderBody } from './ladderbody';
import type { Side, StairHand, Border } from '../game/building';
import type { PlacedCampfire } from '../game/campfire';
import type { Creature } from '../game/creatures';
import type { PlacedFurniture } from '../game/furniture';
import type { PlacedKiln } from '../game/kiln';
import type { Swirl } from '../game/motes';
import type { PlacedPost } from '../game/posts';
import type { Peer } from '../game/roster';
import type { Runestone } from '../game/runestones';
import type { PlacedSmelter } from '../game/smelter';
import type { PlacedTrap } from '../game/traps';
import type { WaterPlant } from '../world/waterplants';
import type { AqueductPart } from './aqueducts';
import type { BridgePieceAt } from './bridgekit';
import type { DeedTotemLook } from './deedtotem';
import type { Seat } from './figure';
import type { PieceView } from './furniture';
import type { Mote } from './life';
import type { WorldRec as SpellRec } from './spells/kit';
import type { SpiralPieceAt } from './spiralkit';
import type { Sprite, DeckShape } from './sprites';

/**
 * What the renderer and its painters (`stairdraw.ts` and the rest) both draw with: the entity a line of the ground
 * is sorted by, a sway, a plan's colour, a flight's steps and a shaded colour.
 */

/** A sway on the screen, about `ox`, `oy` (`swayOnScreen` in `./furniture`). */
export interface Swayed { ox: number; oy: number; a: number; b: number; c: number; d: number; up: number }

export interface Entity {
  kind: 'tree' | 'bush' | 'stump' | 'player' | 'peer' | 'pile' | 'token' | 'crate' | 'creature' | 'campfire' | 'crop' | 'smelter' | 'kiln' | 'furniture' | 'hull' | 'anvil' | 'post' | 'trap' | 'deck' | 'life' | 'waterplant' | 'spell' | 'swirl' | 'runestone' | 'spiral';
  x: number;
  y: number;
  sx: number;
  sy: number;
  spr: Sprite | null;
  creature?: Creature;
  peer?: Peer;
  crateId?: number;
  fire?: PlacedCampfire;
  smelter?: PlacedSmelter;
  kiln?: PlacedKiln;
  piece?: PlacedFurniture;
  anvil?: PlacedAnvil;
  post?: PlacedPost;
  trap?: PlacedTrap;
  deck?: { kind: string; done: boolean; drop: number; id: number; shape?: DeckShape; green?: number; span?: number };
  /** A piece of a material bridge: a slice of its deck, its back, its front or its near parapet (`bridgekit.ts`). */
  bp?: BridgePieceAt;
  /** A piece of a spiral staircase: a tread, a stretch of its rail, its post or its cap (`spiralkit.ts`), and how much of it shows. */
  sp?: SpiralPieceAt;
  spAlpha?: number;
  /**
   * What it sorts by among its line, where not where it stands on the screen:
   * a bridge's pieces round whoever is under or on its deck (`BridgePieceAt.key`,
   * `deckKey`).
   */
  key?: number;
  /** A field on a slope: how far its picture's points go down the screen for each pixel across and down from its middle (`fieldTilt`). */
  tilt?: [number, number];
  /** A lotus standing up off the water: its raised leaves, flowers and seed heads, sorted among what else stands there. */
  plant?: WaterPlant;
  /** A mote swirl turning over the tile (`./swirls`). */
  swirl?: Swirl;
  /** A Runestone, taken on its front tile and drawn over its whole three by three (`./runestones`). */
  stone?: Runestone;
  /** A settlement's token, drawn as a totem a course taller for each level of the settlement (`./deedtotem`). */
  totem?: DeedTotemLook;
  /** 1 rare, 2 supreme, 3 fantastic, for the shine over it; absent for the ordinary run of things. */
  rare?: number;
  /**
   * Pixels to draw above where it sorts. A driver sits on the cart, so the
   * figure belongs above it on screen while still sorting as though it stood
   * on the same ground — lift the sort key instead and the cart is drawn last,
   * over the top of its own driver.
   */
  lift?: number;
  /** A body on a ladder: where it is drawn on it, how far up it its feet are and the way it faces (`./ladderbody.ts`). */
  ladder?: LadderBody;
  /**
   * Where a body on a hull's deck is drawn, in pixels from where it sorts.
   * Everybody aboard sorts with the hull, a hair after it, so the deck is never
   * drawn over them; each is drawn at their own place on it.
   */
  drawDx?: number;
  drawDy?: number;
  /** On a deck on their feet rather than sat at a helm or on a seat. */
  standing?: boolean;
  /**
   * Sat driving something with a seat of its own (`driverOn` in
   * `./furniture`): what is sat on and held, and the way the body faces,
   * square along the piece however it is turned rather than the nearest of
   * the eight ways, so it sits square on the bench.
   */
  seat?: Seat;
  seatFacing?: number;
  /** Which way round a piece is drawn this frame, worked out once where it is taken, so its layers and its crew agree. */
  view?: PieceView;
  /** For a hull drawn in layers round the people on her (`takeAboard`): which layer this is. */
  layer?: number;
  /** Something small aloft over this line of the ground: a butterfly, a dragonfly, a petal or a leaf (`./life`). */
  mote?: Mote;
  /** A piece of a spell standing in the world: an orb, a bolt, a shell, a puff of its smoke (`./spells`). */
  fx?: SpellRec;
  /** A piece of an aqueduct: a bay's insides or its face and water, the spout at its foot, or the cut at its head (`./aqueducts`). */
  aq?: AqueductPart;
  /** The part of the screen a body shows in, for one down a hole: the ground in front of the hole hides the rest (`onFlight`). */
  clip?: Array<[number, number]>;
  /**
   * The roll, pitch and lift of the boat this is or is aboard, or the cart, as
   * a change to the screen about her floor contact (`swayOnScreen` in
   * `./furniture`): she and everybody on her are drawn through the same one,
   * so they move together.
   */
  sway?: Swayed;
}

export const PLAN_COLOR = 'rgba(120, 220, 140, 0.95)';
/** Steps to a storey's flight: six made every step half a metre, and a flight a pile of blocks. */
export const FLIGHT_STEPS = 8;
export const rgb = (c: readonly [number, number, number], k: number, a = 1): string =>
  `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

/**
 * What is on its way to the ground: a piece of furniture following the
 * cursor, or a staircase on its tile, turned the way Q and E have turned it.
 * `ok` is whether it can go where it is.
 */
export type Ghost =
  | { kind: 'furniture'; piece: string; material?: string; x: number; y: number; sx: number; sy: number; facing: Side; ok: boolean; level?: number }
  | { kind: 'stairs'; x: number; y: number; level: number; material: string; floorKind: 'stairs' | 'ladder'; side: Side; hand?: StairHand; ok: boolean; buildingId?: number };

/**
 * What a picture made by `baked` reads besides what is in its key: whether it
 * is kept off a runestone's runes drawn behind it (`occludes`), and whether it
 * is drawn in the sun's light, and so made again when that moves on (`lit`).
 */
export interface BakeAs { occludes?: boolean; lit?: boolean }
/** How dark it is when a lamp inside starts to show through a wall or a roof (`lampBehind`), and pictures stop being kept. */
export const LAMP_DARK = 0.2;

/**
 * Which of `n` pictures a section of a run takes, by a hash of where it is,
 * for a masonry that takes them so: in no order a street shows, never the
 * same as the section either side of it along the run, and never the same
 * as the section under it, so no picture stands twice in a row either way.
 *
 * Along the run every fourth section takes its picture by the hash alone,
 * and each of the three after it one of the others -- not the one the
 * section before took, and the third not the one the next fourth takes
 * either -- so no section has to know more of the run than the three before
 * it. Bumping a picture that matched the one before it, as this did, only
 * moved the match on: three sections running took the same picture. Up the
 * wall each storey is the one under it turned on by the same step, a step
 * the run keeps, so the storeys differ and the run still does.
 */
export function scatterOf(b: Border, level: number, n: number): number {
  const along = b.dir === 'h' ? b.x : b.y, run = b.dir === 'h' ? b.y : b.x;
  const hash = (i: number, salt: number): number => {
    let k = (i * 374761393 + run * 668265263 + salt * 1442695041 + (b.dir === 'h' ? 0 : 97)) | 0;
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return (k ^ (k >>> 16)) >>> 0;
  };
  if (n < 3) return (hash(along, 0) + level) % n;
  /** By a hash, one of the `n` that is none of `not`. */
  const other = (not: number[], h: number): number => {
    const free: number[] = [];
    for (let j = 0; j < n; j++) if (!not.includes(j)) free.push(j);
    return free[h % free.length];
  };
  const first = Math.floor(along / 4) * 4;
  let v = hash(first, 1) % n;
  for (let i = first + 1; i <= along; i++) {
    v = other(i - first === 3 ? [v, hash(first + 4, 1) % n] : [v], hash(i, 2));
  }
  return (v + level * (1 + (hash(0, 3) % (n - 1)))) % n;
}
