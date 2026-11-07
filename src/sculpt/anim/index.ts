/**
 * The clips the low-poly bodies play in the game (`../lowpoly.ts`), and which state plays which. A state with no clip
 * yet keeps the figure's pose mapped onto the rig (`fromGame`); a clip is added here once it is approved.
 *
 * A body drawn frame after frame (`FigurePose.id`) is faded over a fifth of a second whenever it goes from a clip to the
 * figure's pose or to another clip, so nothing jumps; a body drawn once (no id) is posed with nothing kept.
 */
import type { FigurePose } from '../../render/figure';
import { strideOf, type Clip } from './clip';
import type { M3, V } from './math';
import { blendLocal, clipLocal } from './player';
import type { Skeleton } from './skeleton';
import { IDLE } from './clips/idle';
import { WALK } from './clips/walk';
import { strideAt } from '../../game/player';
import { UNITS_PER_TILE } from '../../render/iso';

/** The states a body is drawn in that a clip can play: so far, stood doing nothing, and walking. */
export type State = 'idle' | 'walk';
/** The clip each state plays, by state, once it is approved; a state left out keeps the figure's pose. */
export const CLIPS: Partial<Record<State, Clip>> = { idle: IDLE, walk: WALK };
/** The most of the way from a walk to a run (`FigurePose.gait`) still drawn as the walk; faster keeps the figure's pose. */
const WALK_GAIT = 0.15;
const TAU = Math.PI * 2;

let ON = true;
/** Clips played (true, as the game) or every state left to the figure's pose (false: for comparing with it). */
export function clipsOn(on: boolean): void { ON = on; }

/** Seconds a body takes to fade from one source of its pose to the next. */
const FADE = 0.2;

/** The state a pose is in, of those a clip can play. */
export function stateOf(pose: FigurePose): State | undefined {
  if (pose.working || pose.swimming || pose.driving || pose.emote || pose.cast) return undefined;
  if (!pose.moving) return 'idle';
  return (pose.gait ?? 0) <= WALK_GAIT ? 'walk' : undefined;
}

/**
 * Runs of a clip that keys its feet a turn of the game's walk phase, on a body: the game's stride (the ground a turn of the
 * phase carries the body over, `strideAt`) over the body's own (`strideOf`), so its planted feet keep up with the ground.
 */
const runsPerTurn = (c: Clip, body: 'man' | 'woman', gait = 0): number => (strideAt(gait) * UNITS_PER_TILE) / strideOf(c, body);
/** A walk's time for the game's walk phase on a body, its left heel down a quarter of a run in (as the figure's `walk`). */
export const walkTime = (c: Clip, phase: number, body: 'man' | 'woman', gait = 0): number => ((((phase / TAU) * runsPerTurn(c, body, gait) - 0.25) % 1) + 1) % 1 * c.length;
/** The game's walk phase that puts a body at time t of a walk (`walkTime`'s inverse over its first run). */
export const walkPhase = (c: Clip, t: number, body: 'man' | 'woman', gait = 0): number => ((t / c.length + 0.25) / runsPerTurn(c, body, gait)) * TAU;

/**
 * The clip a pose plays on a body and where in it, or none: the figure's pose is kept. A walk is played over the ground
 * the game carries the body over (`walkTime`).
 */
export function clipFor(pose: FigurePose, body: 'man' | 'woman' = pose.look?.gender === 'woman' ? 'woman' : 'man'): { clip: Clip; t: number } | undefined {
  const s = ON ? stateOf(pose) : undefined, clip = s && CLIPS[s];
  if (!clip) return undefined;
  if (s === 'walk') return { clip, t: walkTime(clip, pose.phase, body, pose.gait ?? 0) };
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
  const c = clipFor(pose, sk.body);
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
