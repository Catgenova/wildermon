import type { GearLook, GearPiece } from '../contract/gear';
import type { Look } from '../game/look';

/**
 * Who somebody is on this screen and where they are drawn: the shapes the
 * island's roster (`roster.ts`) fills from the island's rows and the game
 * (`game.ts`) keeps for the person at this screen.
 */

/** Who somebody is on this screen. The person at it is always 0. */
export type PeerId = number;
export const HOST_ID: PeerId = 0;

/** Where somebody is and what they look like doing it. */
export interface PeerState {
  id: PeerId;
  name: string;
  /**
   * Who they are to the island.
   *
   * `id` is a hash: it tells two people apart on screen and is no use for
   * naming one to a door. Inviting somebody to your deed, asking to be their
   * friend or writing to them all want the uid the island knows them by, and
   * the only place the browser ever had it was the row it threw away building
   * this.
   */
  uid?: string;
  x: number;
  y: number;
  /** Facing, in world space; the renderer turns it into a screen side. */
  dirX: number;
  dirY: number;
  /** Storey they stand on. */
  level: number;
  moving: boolean;
  swimming: boolean;
  /** Mid-action, so they are drawn working rather than standing. */
  working: boolean;
  /**
   * *What* they are mid-action on, as an id out of our own table of actions.
   *
   * `working` says somebody is busy and the figure bends over; this says what
   * at, and it is drawn over their head. Sent as the id rather than as the
   * words for the same reason `look` is sent as ids: what arrives from
   * somebody else's machine and goes on this one's canvas has to be something
   * we wrote, not something they typed. An id we do not know draws nothing.
   */
  act?: string;
  /** Dyed cloth, so people are told apart by more than a name over their head. */
  tunic?: string;
  trousers?: string;
  /**
   * Who they are to look at. Sent as the eight ids rather than as colours, so
   * that what arrives from somebody else's machine and goes into `fillStyle`
   * on this one cannot be anything but an entry in a table we wrote.
   */
  look?: Look;
  /** What they have on, each piece to be drawn in its own material, dye and rarity; already checked against our own tables (`gearFrom`). */
  gear?: GearLook;
  /** The tool the job in hand is done with (mining's pickaxe), in its metal, as the island took it from their pack (`toolFrom`). */
  tool?: GearPiece;
  /** Lain where they fell (`../game/fell.ts` lyingAt): `x`, `y` and `level` are where they fell. */
  down?: boolean;
}
