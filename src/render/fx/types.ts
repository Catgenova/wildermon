/**
 * The shapes the action effects pass about (`./actions.ts`), kept apart so the sculpted bodies' chunk (`src/sculpt/fxmarks.ts`)
 * and the figure (`../figure.ts`) can name them without loading the effects.
 */
import type { FigurePose } from '../figure';
import type { FxFrom, FxMark } from '../../sculpt/anim/clip';
import type { P3 } from '../spells/kit';

export type { FxFrom, FxMark };
export type V3 = [number, number, number];

/** A point of a body as a clip has it, in the figure's frame: x its right, y ahead, z up (game units; z height units) from its feet. */
export interface FxPoint {
  at: V3;
  /** Which way the point was going there, a unit step in the same frame: none when it was still. */
  way: V3 | null;
  /** What the point is on: the id of the weapon or tool, for a tool's point. */
  held?: string;
}

/** A mark a body's clip crossed since its last frame (`SculptFx.track`). */
export interface FxCross {
  mark: FxMark;
  /** Its index in the clip's `fx`, its run of the loop (0 for a one-shot) and the clip's name. */
  i: number;
  run: number;
  clip: string;
  /** Where the mark has the body: worked out only when asked (`FxCross.point`), and kept per body, clip and what is held. */
  point: () => FxPoint | null;
}

/** What the sculpted bodies' chunk does for the effects, once it has loaded (`../figure.ts` sculptFx). */
export interface SculptFx {
  /** The marks body `id`'s clip crossed since it was last asked of, `now` seconds on the drawing clock. */
  track(id: string, pose: FigurePose, now: number): readonly FxCross[];
  /** A point of a body as its clip has it now (`FxFrom`), or null where it plays none. */
  point(pose: FigurePose, from: FxFrom): FxPoint | null;
}

/** A body an effect is fired at: where it stands (tiles; z the ground under its feet, height units) and which way it faces. */
export interface FxBody {
  x: number;
  y: number;
  z: number;
  facing: number;
}

/**
 * An effect to draw (`./registry.ts` ACTION_FX): which, on whom, where in the world and which way it was going there, the
 * body's pose (its gear, its tool, its job) and the mark's numbers or those `fxAt` was given.
 */
export interface FxEvent {
  kind: string;
  /** The body: 'player', or 'o' and a peer's id. */
  who: string;
  at: P3;
  /** A unit step in the world the point was moving along (tiles across and down, height units up, as one length), or null. */
  way: P3 | null;
  body: FxBody;
  pose?: FigurePose;
  /** The id of the weapon or tool the point is on, when it is one. */
  held?: string;
  params: Readonly<Record<string, number | string | boolean>>;
  /** Your own body's. */
  mine: boolean;
  /** Fired in the processor-drawn GL too (`FxMark.key`). */
  key: boolean;
  /** The same for the same body, mark and run of its clip: a burst's shape, the same on every screen. */
  seed: number;
}
