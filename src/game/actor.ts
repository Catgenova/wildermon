import type { ActionDef, Target } from './actions';
import type { Inventory } from './items';
import type { LogKind } from './events';
import type { Player } from './player';
import type { Skills } from './skills';
import type { PeerId } from '../net/protocol';

/**
 * The person at this screen (`Game.local`): a body, a pack, and whatever they
 * are in the middle of doing.
 *
 * Here: the body, the pack, the skills, the job in hand and the queue behind
 * it, and the two little clocks that belong to a body rather than to a world
 * (how long you have been swimming, when you were last warned about drowning).
 *
 * Not here: the land, the creatures, the buildings, the weather, the time of
 * day, and the fog. Those are the island's, or this screen's.
 */
export interface ActiveAction {
  def: ActionDef;
  target: Target;
  state: 'walking' | 'performing';
  elapsed: number;
  duration: number;
  /** The wall second (`Game.wallNow`) a go the island is doing began, for its bar to run off the wall clock. */
  began?: number;
  /** Standing still until this time, waiting for a called wildermon to arrive. */
  waitUntil?: number;
  /** Goes left, when a number was asked for; undefined runs until the wind goes. */
  left?: number;
  /** How many were asked for, for saying so when it is done. */
  goes?: number;
}

/** Where somebody's news goes: on screen. */
export type Hearer = (text: string, kind: LogKind) => void;

export class Actor {
  /** What they are in the middle of, and what is lined up behind it. */
  action: ActiveAction | null = null;
  /**
   * Jobs lined up behind the one in hand.
   *
   * `was` is the kind of thing the target was when it went on the queue, and
   * it is here because a row id does not survive the row. Eat the last of a
   * stack and the next job names an id that no longer exists — see
   * `retarget`, and `act_retarget` on the island, which does the same thing
   * for the same reason.
   */
  queue: Array<{ def: ActionDef; target: Target; goes?: number; was?: string }> = [];
  /** Clocks that belong to a body: time spent swimming, and the last warning given. */
  swimClock = 0;
  drownWarning = 0;
  /** How far this body went on its last turn, in tiles: what a cart is hauled by. */
  stepped = 0;
  /** Told whenever something happens to them. */
  hear: Hearer = () => {};

  constructor(
    /** Who they are on this machine (`HOST_ID`). */
    readonly id: PeerId,
    /** Who they are to what this machine keeps of them (a grave's `who`). */
    readonly who: string,
    readonly player: Player,
    readonly inventory: Inventory,
    readonly skills: Skills,
  ) {}

  get name(): string {
    return this.player.name;
  }
}
