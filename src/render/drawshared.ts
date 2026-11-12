import type { PlacedAnvil } from '../game/anvil';
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
