/**
 * Casting's action effects (`./registry.ts` ACTION_FX):
 *
 *   - `cast`: a spell let go (the release mark on a casting clip, `../../sculpt/anim/clips/cast.ts`), at the hand it leaves:
 *     a flare and a ring of motes in the spell's own colours (its group's palette, `../spells/index.ts` SpellVisual.palette),
 *     the flare fading over `RELEASE_SECS`. The spell's own effects are drawn by the spells' stage, from the same hand.
 */
import { visualOf } from '../spells/index';
import type { ActionFxFn } from './registry';

/** Seconds the flare at the releasing hand fades over. */
export const RELEASE_SECS = 0.22;
/** Motes off the releasing hand. */
export const RELEASE_MOTES = 6;

const cast: ActionFxFn = (e, k) => {
  const id = e.pose?.cast?.id, pal = id ? visualOf(id)?.palette : undefined;
  if (!pal) return;
  k.burst(e.at, RELEASE_MOTES, { kind: 'mote', colour: [pal.core, pal.main, pal.accent], size: 1.3, life: [0.18, 0.35], speed: [0.04, 0.14], up: [1, 5], gravity: 0, drag: 0.6, over: true, small: true });
  return {
    secs: RELEASE_SECS,
    draw: (kk, u) => {
      const a = 1 - u;
      kk.glow(e.at, 5 + 4 * u, 0.55 * a, pal.light, true);
      kk.flare(e.at, 7 * (0.6 + 0.4 * u), 0.8 * a, pal.core, u * 2, pal.light, true);
    },
  };
};

export const CAST_FX: Readonly<Record<string, ActionFxFn>> = { cast };
