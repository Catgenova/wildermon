/**
 * Every action effect, by the kind a clip's mark (`../../sculpt/anim/clip.ts` FxMark.kind) or `ActionFx.fxAt` names.
 *
 * An effect is a function of the event (`./types.ts` FxEvent: where, on whom, which way the point was going, the body's
 * pose and the mark's numbers) and the kit (`./kit.ts` ActionKit: the spells' shapes and particles, within the action
 * effects' budget, and `k.mat` for the colours of what it comes off). It draws its first frame there and then; one that
 * goes on (a glint fading, a light dying) returns a `FxLinger`, drawn each frame for its seconds.
 *
 * To add effects: a file of your own beside this one exporting a record of them, spread in below. Keep a burst small (the
 * pool is the spells' too) and mark the particles that are only detail `small: true`.
 */
import type { ActionKit } from './kit';
import type { FxEvent } from './types';
import { STRIKE_FX } from './strikes';

/** An effect going on after its first frame: drawn each frame for `secs`, `u` nought to one through them. */
export interface FxLinger {
  secs: number;
  draw(k: ActionKit, u: number): void;
}
export type ActionFxFn = (e: FxEvent, k: ActionKit) => void | FxLinger;

export const ACTION_FX: Readonly<Record<string, ActionFxFn>> = {
  ...STRIKE_FX,
};
