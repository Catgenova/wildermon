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
import { quat, type M3, type V } from './math';
import { blendLocal, clipLocal, plantBetween } from './player';
import type { Held, Skeleton } from './skeleton';
import { IDLE } from './clips/idle';
import { WALK } from './clips/walk';
import { SWING } from './clips/swing';
import { SIXSEVEN } from './clips/sixseven';
import { HANDS } from './clips/hands';
import { GROUND } from './clips/ground';
import { ACTION_BY_ID } from '../../game/actions';
import { RECIPE_BY_ID } from '../../game/recipes';
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
export const CLIPS: Record<string, Clip> = { idle: IDLE, walk: WALK, swing: SWING, sixseven: SIXSEVEN, hands: HANDS, ground: GROUND };
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
/**
 * The jobs done knelt at the ground with no tool (`ground`): planting and sowing, foraging and searching, the traps, picking
 * up, at the water's edge, tending a campfire or an ash pit. (Driving a post in and pulling it up are lifts, not ground
 * work; cooking at a campfire keeps the state's own until a clip of its own.)
 */
const GROUND_JOBS = [
  // a tile or a plant
  'plant', 'plant_seed', 'sow_patch', 'plant_moss', 'plant_grass', 'plant_vine', 'drop_dirt', 'drop_dirt_here', 'change_tile',
  'forage', 'botanize', 'pick_flowers', 'collect_motes', 'lift_stones', 'track', 'search_caches', 'dig_cache',
  // an item or a trap on the ground
  'pick_up', 'pick_up_all', 'set_trap', 'take_catch', 'empty_creel', 'pick_up_trap', 'strike_foundation',
  // the water's edge
  'pan', 'drink', 'plant_lily', 'plant_lotus', 'pick_water_plant', 'pull_water_plant',
  // a fire on the ground, an ash pit
  'build_campfire', 'light_campfire', 'fuel_campfire', 'put_out_campfire', 'take_apart_campfire',
  'take_ashes_fire', 'take_ashes_oven', 'take_ashes_smelter', 'take_ashes_kiln',
];
/**
 * The clip a job in the `work` state plays, by the job (its action's id), where it is not the state's own (`CLIP_OF.work`):
 * the work with the hands and no tool at waist height (`hands`) for the jobs below, and for every recipe made with no tool
 * that is not cooked at a campfire (`handsRecipe`). A later clip for a family of jobs adds its rows.
 */
export const CLIP_OF_JOB: Readonly<Record<string, string>> = Object.fromEntries([
  // an item in hand
  'repair_item', 'patch_item', 'mend_kit', 'seal_item', 'sign_item', 'dye_item', 'make_dye_recipe', 'boil_dye_recipe', 'strip_dye',
  'enchant', 'absorb_soul', 'hone_whetstone', 'open_seed_jar', 'open_ferment', 'serve_dish', 'quench_item', 'draw_map', 'copy_map',
  'use_bronze_mirror', 'use_ancient_file', 'use_ancient_lamp', 'use_ancient_pot',
  // a vessel filled or emptied, a waist-high smelter, kiln, oven, barrel, crate or piece of furniture
  'fill_bucket', 'fill_skin', 'pour_into_barrel', 'empty_vessel',
  'fuel_smelter', 'light_smelter', 'damp_smelter', 'pour_ingot', 'smelter_take_all', 'fuel_kiln', 'light_kiln', 'damp_kiln', 'kiln_take_all',
  'fuel_oven', 'light_oven', 'put_out_oven', 'furniture_take_all', 'crate_take_all', 'start_brew', 'set_brew_spring',
].map((job) => [job, 'hands']).concat(GROUND_JOBS.map((job) => [job, 'ground'])));
/** Whether a job is a recipe made with no tool and not at a campfire (cooking there is done crouched at the fire). */
const handsRecipe = (job: string): boolean => {
  const r = RECIPE_BY_ID.get(job);
  return !!r && !r.tool && !ACTION_BY_ID.get(job)?.tool && r.station !== 'campfire';
};
/** The clip a job in the `work` state plays (`CLIP_OF_JOB`, then `handsRecipe`, then the state's own). */
export function workClipOf(job: string | undefined): string {
  if (!job) return CLIP_OF.work;
  return CLIP_OF_JOB[job] ?? (handsRecipe(job) ? 'hands' : CLIP_OF.work);
}
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
/**
 * Seconds a fade into or out of a clip takes where that is longer than \`FADE\`, its feet kept planted throughout where
 * the two clips stand them (\`plantBetween\`): getting down onto the knees at the ground and up off them.
 */
const SETTLE: Readonly<Record<string, number>> = { ground: 0.55 };

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
  const s = ON ? stateOf(pose) : undefined, clip = s && CLIPS[s === 'work' ? workClipOf(pose.job) : CLIP_OF[s]];
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

/**
 * What a pose holds in both hands as its clip plays (`Clip.grip`), by its id: the weapon in hand in a fight; nothing at
 * work (mining's pickaxe is not drawn yet, so the hands close on a handle of their own).
 */
export function heldIn(pose: FigurePose): string | undefined {
  const c = clipFor(pose);
  return c?.clip.grip && pose.job === FIGHT ? pose.gear?.weapon?.id : undefined;
}

/** A share of a loop for a body, from its id, so bodies stood together do not breathe as one. */
function offsetOf(id: string | undefined): number {
  if (!id) return 0;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

type Local = { local: Array<M3 | undefined>; move: V };
/** What a body was drawn with last (its clip and time, when one), and at the change, what it came from. */
interface Kept { source: string; out: Local; from: Local | null; at: number; was?: { clip: Clip; t: number }; cur?: { clip: Clip; t: number }; span?: number }
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
  else if (k.source !== source) { k.span = Math.max(SETTLE[k.source] ?? FADE, SETTLE[source] ?? FADE); k.from = k.out; k.was = k.cur; k.source = source; k.at = ms; }
  k.cur = c ? { clip: c.clip, t: c.t } : undefined;
  KEPT.set(key, k);
  if (KEPT.size > MAX_KEPT) KEPT.delete(KEPT.keys().next().value as string);
  let out = now;
  if (k.from) {
    const u = (ms - k.at) / 1000 / (k.span ?? FADE), w = u * u * (3 - 2 * u);
    if (u >= 1) k.from = null;
    else {
      out = blendLocal(k.from, now, w);
      // a long fade (getting down or up): the feet kept where the two clips stand them, the legs bent to reach
      const plant = (k.span ?? FADE) > FADE && k.was && c ? plantBetween(sk, k.was, c, w) : undefined;
      if (plant) out = sk.finish({ q: out.local.map((m) => m && quat(m)), move: out.move }, { plant, armsOut: -3 });
    }
  }
  k.out = out;
  return out;
}
