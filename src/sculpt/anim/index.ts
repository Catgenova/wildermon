/**
 * The clips the low-poly bodies play in the game (`../lowpoly.ts`), and which state plays which. A state with no clip
 * yet keeps the figure's pose mapped onto the rig (`fromGame`); a clip is added here once it is approved.
 *
 * A body drawn frame after frame (`FigurePose.id`) is faded over a fifth of a second whenever it goes from a clip to the
 * figure's pose or to another clip, so nothing jumps; a body drawn once (no id) is posed with nothing kept.
 */
import type { FigurePose } from '../../render/figure';
import type { Clip } from './clip';
import type { M3, V } from './math';
import { blendLocal, clipLocal } from './player';
import type { Skeleton } from './skeleton';

/** The states a body is drawn in that a clip can play: so far, stood doing nothing. */
export type State = 'idle';
/** The clip each state plays, by state, once it is approved; a state left out keeps the figure's pose. */
export const CLIPS: Partial<Record<State, Clip>> = {};

let ON = true;
/** Clips played (true, as the game) or every state left to the figure's pose (false: for comparing with it). */
export function clipsOn(on: boolean): void { ON = on; }

/** Seconds a body takes to fade from one source of its pose to the next. */
const FADE = 0.2;

/** The state a pose is in, of those a clip can play. */
function stateOf(pose: FigurePose): State | undefined {
  if (!pose.moving && !pose.working && !pose.swimming && !pose.driving && !pose.emote && !pose.cast) return 'idle';
  return undefined;
}

/** The clip a pose plays and where in it, or none: the figure's pose is kept. */
export function clipFor(pose: FigurePose): { clip: Clip; t: number } | undefined {
  const s = ON ? stateOf(pose) : undefined, clip = s && CLIPS[s];
  if (!clip) return undefined;
  // its time the island's (the figure's phase runs at six a second while it stands), each body its own way into the loop
  return { clip, t: pose.phase / 6 + offsetOf(pose.id) * clip.length };
}

/** A share of a loop for a body, from its id, so bodies stood together do not breathe as one. */
function offsetOf(id: string | undefined): number {
  if (!id) return 0;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

type Local = { local: Array<M3 | undefined>; move: V };
interface Kept { source: string; out: Local; from: Local | null; at: number }
const KEPT = new Map<string, Kept>();
const MAX_KEPT = 256;

/**
 * The local turns and shift a body is drawn with for a pose: its clip's if it has one, else `figure()` (the figure's pose
 * on the rig); faded from what it was drawn with when that changes.
 */
export function animate(sk: Skeleton, pose: FigurePose, figure: () => Array<M3 | undefined>): Local {
  const c = clipFor(pose);
  const now: Local = c ? clipLocal(sk, c.clip, c.t) : { local: figure(), move: [0, 0, 0] };
  if (!pose.id) return now;
  const key = `${sk.body}|${pose.id}`, source = c ? c.clip.name : 'figure', ms = performance.now();
  let k = KEPT.get(key);
  if (k) KEPT.delete(key);
  if (!k) k = { source, out: now, from: null, at: ms };
  else if (k.source !== source) { k.from = k.out; k.source = source; k.at = ms; }
  KEPT.set(key, k);
  if (KEPT.size > MAX_KEPT) KEPT.delete(KEPT.keys().next().value as string);
  let out = now;
  if (k.from) {
    const u = (ms - k.at) / 1000 / FADE;
    if (u >= 1) k.from = null;
    else out = blendLocal(k.from, now, u * u * (3 - 2 * u));
  }
  k.out = out;
  return out;
}
