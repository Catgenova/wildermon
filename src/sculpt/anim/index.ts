/**
 * The clips the low-poly bodies play in the game (`../lowpoly.ts`), and which state plays which (`CLIP_OF`): a state's
 * own clip once it is approved, else the placeholder (`PLACEHOLDER`, the 6 7 gesture). A pose in none of the states
 * (`stateOf`: running, say) keeps the figure's pose mapped onto the rig (`fromGame`).
 *
 * A body drawn frame after frame (`FigurePose.id`) is faded over a fifth of a second whenever it goes from a clip to the
 * figure's pose or to another clip, so nothing jumps; a body drawn once (no id) is posed with nothing kept.
 */
import type { FigurePose } from '../../render/figure';
import { fitTime, runsOf, strideOf, type Clip } from './clip';
import type { M3, V } from './math';
import { blendLocal, clipLocal } from './player';
import type { Held, Skeleton } from './skeleton';
import { IDLE } from './clips/idle';
import { WALK } from './clips/walk';
import { SWING } from './clips/swing';
import { SIXSEVEN } from './clips/sixseven';
import { strideAt } from '../../game/player';
import { WEAPON_BY_ID } from '../../game/gear';
import { UNITS_PER_TILE } from '../../render/iso';

/**
 * The states a body is drawn in that a clip can play, all stood still but the walk: doing nothing (`idle`); walking
 * (`walk`); swinging something heavy in both hands over the head (`swing`: mining; a fight with a two-handed sword, axe or
 * maul); any other job (`work`); a fight with anything else in hand (`fight`); meditating (`meditate`); an emote
 * (`emote`); casting a spell (`cast`).
 */
export type State = 'idle' | 'walk' | 'swing' | 'work' | 'fight' | 'meditate' | 'emote' | 'cast';
/** Every clip, by name (the authoring tools find a clip here, `tools/sculpt/lowanim.mjs --clip <name>`). */
export const CLIPS: Record<string, Clip> = { idle: IDLE, walk: WALK, swing: SWING, sixseven: SIXSEVEN };
/** The clip a state plays until its own is approved: the 6 7 gesture. */
export const PLACEHOLDER = 'sixseven';
/**
 * The clip each state plays, by name: its own where approved, the placeholder where not. Each placeholder is replaced
 * here when the state's own clip lands. (Running, and walking or running while casting, emoting or at work, keep the
 * figure's pose: a stood clip would slide its planted feet over the ground. Swimming and driving are drawn by the flat
 * figure.)
 */
export const CLIP_OF: Record<State, string> = {
  idle: 'idle',
  walk: 'walk',
  swing: 'swing',
  work: PLACEHOLDER,
  fight: PLACEHOLDER,
  meditate: PLACEHOLDER,
  emote: PLACEHOLDER,
  cast: PLACEHOLDER,
};
/** The jobs done with the overhead swing whatever is in hand: the pickaxe's. */
const SWING_JOBS = new Set(['mine', 'chip_corner', 'mine_cellar']);
/** Meditating's job. */
const MEDITATE = 'meditate';
/** A fight's job, swung with the overhead swing when what is in hand is a two-handed weapon that is not a bow. */
const FIGHT = 'attack_creature';
/** Whether a pose's job is swung overhead in both hands. */
const swings = (pose: FigurePose): boolean => {
  if (SWING_JOBS.has(pose.job ?? '')) return true;
  const w = pose.job === FIGHT && pose.gear?.weapon ? WEAPON_BY_ID.get(pose.gear.weapon.id) : undefined;
  return !!w?.twoHanded && !w.ammo;
};
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
  if (pose.swimming || pose.driving) return undefined;
  if (pose.moving) return !pose.working && !pose.emote && !pose.cast && (pose.gait ?? 0) <= WALK_GAIT ? 'walk' : undefined;
  if (pose.cast) return 'cast';
  if (pose.emote) return 'emote';
  if (!pose.working) return 'idle';
  if (swings(pose)) return 'swing';
  return pose.job === MEDITATE ? 'meditate' : pose.job === FIGHT ? 'fight' : 'work';
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
  const s = ON ? stateOf(pose) : undefined, clip = s && CLIPS[CLIP_OF[s]];
  if (!clip) return undefined;
  if (s === 'walk') return { clip, t: walkTime(clip, pose.phase, body, pose.gait ?? 0) };
  // a go of a timed job: fitted to its length (the holds stretched, the blow kept: `fitTime`), a fight's swing one blow
  // a go (the placeholder as many runs as come nearest)
  if (pose.act && pose.act.length > 0) {
    const { run } = runsOf(clip, pose.act.length, s === 'swing' && pose.job === FIGHT ? 1 : Infinity);
    return { clip, t: fitTime(clip, Math.max(0, pose.act.t), run) };
  }
  // its time the island's (the figure's phase runs at six a second while it stands), each body its own way into the loop
  return { clip, t: pose.phase / 6 + offsetOf(pose.id) * clip.length };
}

/** What the jobs swung overhead are done with (`SWING_JOBS`): drawn in both hands as they are. */
export const SWING_TOOL = 'pickaxe';
/**
 * What a pose holds in both hands as its clip plays (`Clip.grip`), by its id: the weapon in hand in a fight; the pickaxe
 * at a job swung overhead (`SWING_JOBS`, `SWING_TOOL`); nothing at any other work.
 */
export function heldIn(pose: FigurePose): string | undefined {
  const c = clipFor(pose);
  if (!c?.clip.grip) return undefined;
  return pose.job === FIGHT ? pose.gear?.weapon?.id : SWING_JOBS.has(pose.job ?? '') ? SWING_TOOL : undefined;
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
export function animate(sk: Skeleton, pose: FigurePose, figure: () => Array<M3 | undefined>, held?: Held): Local {
  const c = clipFor(pose, sk.body);
  const now: Local = c ? clipLocal(sk, c.clip, c.t, c.clip.grip ? held : undefined) : { local: figure(), move: [0, 0, 0] };
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
