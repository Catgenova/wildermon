/**
 * What an action effect draws with (`./registry.ts` ACTION_FX): the spells' kit (`../spells/kit.ts` FxScene: its shapes,
 * glows, lights and particles, drawn by the spells' stage in its passes), on the spells' own particle pool and frame, with
 * the action effects' budget and level of detail laid over it:
 *   - `burst` and `emit` take `share` of what is asked (Fewer, a body far off), a third on fast graphics as the spells'
 *     do, and never more than `room`, the particles the action effects may still add this frame (`./actions.ts`: what is
 *     left of their share of the pool once the spells' are counted, so a spell always has its own);
 *   - a burst marked `small` is left out while the camera is zoomed out past `SMALL_ZOOM`, where it would be a pixel;
 *   - `light` only while the effect may light the night (`lit`: All, near, and within the action effects' own lights);
 *   - `flash` never: an action effect does not tint the screen.
 */
import { FxScene, type BurstOpts, type P3 } from '../spells/kit';
import type { FxMaterials } from './material';
import type { FxEvent } from './types';

/** The zoom under which a burst marked `small` is left out. */
export const SMALL_ZOOM = 1.5;
/** A spell's share of a burst on fast graphics (`FxScene.burst`), the same for an action's. */
const FAST_SHARE = 0.35;

/** A burst of an action effect: the spells' (`BurstOpts`), and whether it is small enough to leave out zoomed out. */
export type ActionBurst = BurstOpts & { small?: boolean };

export class ActionKit extends FxScene {
  /** The effect being drawn. */
  ev!: FxEvent;
  /** The colours of what it comes off (`./material.ts`). */
  mat!: FxMaterials;
  /** The share of what it asks for that is drawn: one, or less with Effects on Fewer or for a body far off. */
  share = 1;
  /** Zoomed out past `SMALL_ZOOM`: bursts marked `small` left out. */
  small = false;
  /** Whether it may put a light down (`light`). */
  lit = true;
  /** The water's surface under a point, height units, or null where there is none. */
  water: (x: number, y: number) => number | null = () => null;
  /** Particles the action effects may still add this frame. */
  room = 0;
  /** Particles added this frame, and asked for but left out for want of room. */
  spawned = 0;
  dropped = 0;

  override burst(p: P3, n: number, o: ActionBurst = {}): void {
    if (o.small && this.small) return;
    this.put(p, Math.round(n * this.share * (this.fast ? FAST_SHARE : 1)), o);
  }

  override emit(p: P3, perSecond: number, o: ActionBurst = {}): void {
    if (o.small && this.small) return;
    const want = perSecond * this.dt * this.share * (this.fast ? FAST_SHARE : 1);
    this.put(p, Math.floor(want) + (this.rand() < want - Math.floor(want) ? 1 : 0), o);
  }

  override light(p: { x: number; y: number }, radius: number, strength: number, colour?: string): void {
    if (this.lit) super.light(p, radius, strength, colour);
  }

  override flash(): void {
    // Never for an action: the screen is not tinted by a blow.
  }

  /** `n` particles, as many as there is room for. */
  private put(p: P3, n: number, o: ActionBurst): void {
    const real = Math.min(n, this.room);
    if (n > real) this.dropped += n - real;
    if (real <= 0) return;
    // (counted here, so the spells' own cut on fast graphics is not made twice)
    const fast = this.fast;
    this.fast = false;
    super.burst(p, real, o);
    this.fast = fast;
    this.room -= real;
    this.spawned += real;
  }
}
