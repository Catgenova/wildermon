/**
 * The clips the low-poly bodies play in the game (`../lowpoly.ts`), and which state plays which (`CLIP_OF`): a state's
 * own clip once it is approved, else the placeholder (`PLACEHOLDER`, the 6 7 gesture). A pose in none of the states
 * (`stateOf`: running, say) keeps the figure's pose mapped onto the rig (`fromGame`).
 *
 * A body drawn frame after frame (`FigurePose.id`) is faded over a fifth of a second whenever it goes from a clip to the
 * figure's pose or to another clip, so nothing jumps; a body drawn once (no id) is posed with nothing kept.
 */
import type { FigurePose, Seat } from '../../render/figure';
import { fitTime, runsOf, strideOf, type Clip, type Side } from './clip';
import { qmat, qmul, quat, type M3, type Q, type V } from './math';
import { addPose, blendLocal, blendPose, clipLocal, plantBetween, poseAt } from './player';
import type { Held, Pose, Skeleton } from './skeleton';
import { IDLE } from './clips/idle';
import { WALK } from './clips/walk';
import { SWING } from './clips/swing';
import { SIXSEVEN } from './clips/sixseven';
import { WORK } from './clips/work';
import { HANDS } from './clips/hands';
import { GROUND } from './clips/ground';
import { SHOOT } from './clips/shoot';
import { FIGHT as FIGHT_CLIP } from './clips/fight';
import { SEAT_OARS, SEAT_REINS, SEAT_SADDLE, SEAT_TILLER, SEAT_TILLER_LEFT, SEAT_TUCK } from './clips/seated';
import { DIG, RAKE, REAP } from './clips/dig';
import { mirrorClip } from './author';
import { ACTION_BY_ID } from '../../game/actions';
import { clipOfJob } from './routes';
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
export const CLIPS: Record<string, Clip> = {
  idle: IDLE, walk: WALK, swing: SWING, sixseven: SIXSEVEN, work: WORK, 'work-left': mirrorClip(WORK, 'work-left'), hands: HANDS, ground: GROUND,
  fight: FIGHT_CLIP, 'fight-left': mirrorClip(FIGHT_CLIP, 'fight-left'), shoot: SHOOT,
  'seat-reins': SEAT_REINS, 'seat-oars': SEAT_OARS, 'seat-tiller': SEAT_TILLER, 'seat-tiller-left': SEAT_TILLER_LEFT, saddle: SEAT_SADDLE, 'saddle-tuck': SEAT_TUCK,
  dig: DIG, 'dig-left': mirrorClip(DIG, 'dig-left'), rake: RAKE, 'rake-left': mirrorClip(RAKE, 'rake-left'), reap: REAP, 'reap-left': mirrorClip(REAP, 'reap-left'),
};
/** The clip a state plays until its own is approved: the 6 7 gesture. */
export const PLACEHOLDER = 'sixseven';
/**
 * The clip each state plays, by name: its own where approved, the placeholder where not. Each placeholder is replaced
 * here when the state's own clip lands; a job at `work` plays its tool's clip where it has one (`workClipOf`), the
 * state's otherwise; a fight with a weapon swung in one hand plays the one-handed fight (`ONE_HAND`, `./clips/fight.ts`),
 * any other fight the state's own. (Running, and walking or running while casting, emoting or at work, keep the
 * figure's pose: a stood clip would slide its planted feet over the ground. Swimming is drawn by the flat figure; sat
 * driving plays its seat's clip, `seatClipOf`, put on the seat by `seatedLocal`.)
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
export { CLIP_OF_JOB, CLIP_OF_TOOL } from './routes';
/** The clip a job in the `work` state plays (`./routes.ts` `clipOfJob`, else the state's own). */
export function workClipOf(job: string | undefined): string {
  return (job ? clipOfJob(job) : undefined) ?? CLIP_OF.work;
}
/**
 * The clips played left-handed (`lefty`), by the right-handed clip's name: its mirror. The flat figure works left-handed
 * from the two facings where its right hand's blow would cross the face (`../../render/figure.ts` lefty); so does this.
 */
const LEFT_OF: Readonly<Record<string, string>> = { work: 'work-left', fight: 'fight-left', dig: 'dig-left', rake: 'rake-left', reap: 'reap-left' };
/** Whether work is done left-handed from where it is seen: as the flat figure (facings three and seven). */
const lefty = (facing: number): boolean => { const f = ((Math.round(facing) % 8) + 8) % 8; return f === 3 || f === 7; };

/** The jobs done with the overhead swing whatever is in hand: the pickaxe's (mining, and those its tool routes to the swing: `./routes.ts`). */
const SWING_JOBS = new Set(['mine', 'chip_corner', 'mine_cellar']);
const swingJob = (job: string | undefined): boolean => !!job && (SWING_JOBS.has(job) || clipOfJob(job) === 'swing');
/** Meditating's job. */
const MEDITATE = 'meditate';
/**
 * A fight's job, swung with the overhead swing when what is in hand is a two-handed weapon that is not a bow, or a polearm
 * or a javelin (`BOTH_HANDS`); with the one-handed fight (`ONE_HAND`) when it is any other weapon held in the hand.
 */
const FIGHT = 'attack_creature';
/** The weapons the game swings in one hand that are drawn in both in a fight's overhead swing: a long shaft is held in two. */
const BOTH_HANDS = new Set(['spear', 'javelin']);
/** The weapon a fight is fought with, if the pose is in one. */
const fightWeapon = (pose: FigurePose) => (pose.job === FIGHT && pose.gear?.weapon ? WEAPON_BY_ID.get(pose.gear.weapon.id) : undefined);
/** Whether a pose is a fight with a bow in hand (an archery weapon: one that shoots arrows): it plays the shot (`SHOOT`). */
const shoots = (pose: FigurePose): boolean => !!fightWeapon(pose)?.ammo;
/** Whether a pose's job is swung overhead in both hands. */
const swings = (pose: FigurePose): boolean => {
  if (swingJob(pose.job)) return true;
  const w = fightWeapon(pose);
  return !!w && ((!!w.twoHanded && !w.ammo) || BOTH_HANDS.has(w.id));
};
/**
 * Whether a pose is a fight with a weapon swung in one hand (a knife, a sword, a hatchet, a club, a throwing axe): the
 * one-handed fight clip (`./clips/fight.ts`) with it in the striking fist (`toolsIn`). A bow plays the shot (`shoots`); bare hands keep the
 * state's own.
 */
export const ONE_HAND = (pose: FigurePose): boolean => {
  const w = fightWeapon(pose);
  return !!w && !w.twoHanded && !w.ammo && !BOTH_HANDS.has(w.id);
};
/** The most of the way from a walk to a run (`FigurePose.gait`) still drawn as the walk; faster keeps the figure's pose. */
const WALK_GAIT = 0.15;
const TAU = Math.PI * 2;

let ON = true;
/** Clips played (true, as the game) or every state left to the figure's pose (false: for comparing with it). */
export function clipsOn(on: boolean): void { ON = on; }
/** Whether clips are played (`clipsOn`). */
export const clipsPlaying = (): boolean => ON;

/** Seconds a body takes to fade from one source of its pose to the next. */
const FADE = 0.2;
/**
 * Seconds a fade into or out of a clip takes where that is longer than `FADE`, its feet kept planted throughout where
 * the two clips stand them (`plantBetween`): getting down onto the knees at the ground and up off them; down into the
 * sickle's crouch and up out of it.
 */
const SETTLE: Readonly<Record<string, number>> = { ground: 0.55, reap: 0.4, 'reap-left': 0.4 };
/** Seconds after a long fade lands over which the clip's own motion is let go into from rest. */
const RELEASE = 0.25;
/** The legs' bones, which a long fade keeps on its own pace (the root's too); the rest lead or trail them. */
const LEGS = /^(thigh|calf|foot|ball)_[lr]$/;
/** Smoothstep, clamped. */
const smooth = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
/** Smootherstep, clamped: at rest at both ends, its pace easing to nothing too (a long fade's arrival). */
const smoother = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * x * (x * (6 * x - 15) + 10); };

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
  const s = ON ? stateOf(pose) : undefined, name = s === 'work' ? workClipOf(pose.job) : s === 'fight' && shoots(pose) ? SHOOT.name : s === 'fight' && ONE_HAND(pose) ? 'fight' : s && CLIP_OF[s];
  const clip = name ? CLIPS[(lefty(pose.facing) && LEFT_OF[name]) || name] : undefined;
  if (!clip) return undefined;
  if (s === 'walk') return { clip, t: walkTime(clip, pose.phase, body, pose.gait ?? 0) };
  // a go of a timed job: fitted to its length (the holds stretched, the blow kept: `fitTime`), a fight's swing one blow
  // a go (the placeholder as many runs as come nearest)
  if (pose.act && pose.act.length > 0) {
    const { run } = runsOf(clip, pose.act.length, (s === 'swing' && pose.job === FIGHT) || clip === SHOOT ? 1 : Infinity);
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
  if (!c?.clip.grip && !c?.clip.wields) return undefined;
  return pose.job === FIGHT ? pose.gear?.weapon?.id : swingJob(pose.job) ? SWING_TOOL : undefined;
}

/**
 * The tools a job at the work clip holds, by the tool it is done with: the struck tools with the chisel in the other
 * hand (and the chisel's own jobs with the mallet striking it); every other tool alone in the striking hand, the other
 * hand closed on the work. A tool not listed (or none) holds the clip's own (`Clip.tools`).
 */
export const TOOLS_OF: Readonly<Record<string, { strike: string; hold?: string }>> = {
  hammer: { strike: 'hammer', hold: 'chisel' }, mallet: { strike: 'mallet', hold: 'chisel' }, chisel: { strike: 'mallet', hold: 'chisel' },
  hatchet: { strike: 'hatchet' }, butchering_knife: { strike: 'butchering_knife' }, awl: { strike: 'awl' }, carving_knife: { strike: 'carving_knife' },
  trowel: { strike: 'trowel' }, file: { strike: 'file' }, whetstone: { strike: 'whetstone' },
};
/** The long tools a body's shorter grip (`Correction.grip`) is for: those that reach as far as the clip's own. */
const LONG = new Set(['hammer', 'mallet', 'hatchet', 'butchering_knife']);
/** The tool a pose works with: the piece in hand (`FigurePose.tool`), else its job's (`ActionDef.tool`). */
const toolOfPose = (pose: FigurePose): string | undefined => pose.tool?.id ?? (pose.job ? ACTION_BY_ID.get(pose.job)?.tool : undefined);

/**
 * The tools a pose's clip draws in its hands (`Clip.tools`, or its job's own: `TOOLS_OF`), by the side, and how far up
 * its handle each is held on the body (`Correction.grip`, the long tools'): none for a clip that holds none.
 */
export function toolsIn(pose: FigurePose, body: 'man' | 'woman' = pose.look?.gender === 'woman' ? 'woman' : 'man'): { tools: NonNullable<Clip['tools']>; up: Partial<Record<'l' | 'r', number>> } | undefined {
  const c = clipFor(pose, body)?.clip;
  if (!c?.tools) return undefined;
  const side = c.strike?.side ?? 'r', other = side === 'r' ? 'l' : 'r';
  // a fight: the weapon in the striking fist, nothing in the other
  if (pose.job === FIGHT) return { tools: pose.gear?.weapon ? { [side]: pose.gear.weapon.id } : {}, up: {} };
  const own = TOOLS_OF[toolOfPose(pose) ?? ''];
  const tools = own ? { [side]: own.strike, ...(own.hold ? { [other]: own.hold } : {}) } : c.tools;
  const grip = c.bodies?.[body]?.grip ?? {}, up = Object.fromEntries(Object.entries(grip).filter(([s]) => LONG.has(tools[s as 'l' | 'r'] ?? '')));
  return { tools, up };
}

/**
 * How far the work is brought to a tool that reaches less far than the clip's own (`Clip.strike`), body heights: the
 * difference of the two tools' reaches (`Held.contact` from the fist), turned as the striking fist is at the blow; kept
 * per body, clip and tool.
 */
const SHIFTS = new Map<string, [number, number, number]>();
function shiftOf(sk: Skeleton, c: Clip, tool: Held | undefined, own: Held | undefined, id: string): [number, number, number] | undefined {
  if (!c.strike || !tool?.contact || !own?.contact) return undefined;
  const key = `${sk.body}|${c.name}|${id}`;
  let d = SHIFTS.get(key);
  if (!d) {
    const s = c.strike.side, r = clipLocal(sk, c, c.strike.t, undefined, () => own), g = sk.gripOf(sk.fk(r.local, r.move), own)[s === 'r' ? 1 : 0];
    const reach = (h: Held): [number, number, number] => [(h.contact as V)[0] / h.scale, ((h.contact as V)[1] - h.lead) / h.scale, (h.contact as V)[2] / h.scale];
    const a = reach(tool), b = reach(own), dd: V = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const w = [0, 1, 2].map((i) => (g.R[i * 3] * dd[0] + g.R[i * 3 + 1] * dd[1] + g.R[i * 3 + 2] * dd[2]) / sk.height) as [number, number, number];
    SHIFTS.set(key, (d = w));
  }
  return d;
}

/** A share of a loop for a body, from its id, so bodies stood together do not breathe as one. */
function offsetOf(id: string | undefined): number {
  if (!id) return 0;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * The clip a body sat driving plays (`./clips/seated.ts`), by what it sits on and holds: astride, the saddle's (and how far
 * toward the legs drawn up, `Seat.tuck`); at the oars; at a tiller, on the side the tiller is (`Seat.grip`); else on a
 * box at the reins.
 */
export function seatClipOf(seat: Seat): { clip: Clip; tuck: number } {
  if (seat.astride) return { clip: SEAT_SADDLE, tuck: Math.max(0, Math.min(1, seat.tuck ?? 0)) };
  if (seat.hands === 'oars') return { clip: SEAT_OARS, tuck: 0 };
  if (seat.hands === 'tiller') return { clip: seat.grip[0] >= 0 ? SEAT_TILLER : SEAT_TILLER_LEFT, tuck: 0 };
  return { clip: SEAT_REINS, tuck: 0 };
}

/**
 * Where a body sat driving is put, in the mesh's own units and frame (x the body's left, y up, z forward; `../lowpoly.ts`
 * works it out from the seat and the flat figure's pose on it): the seat; the height of its top; where the hips go across
 * and forward; the lowest of what is sat on for a pose's bones (the seat of the trousers, as skinned); each fist's place
 * and its grip's way (where the flat figure's fists are: on the reins, the oars' handles, the tiller's end); whether the
 * feet go down on the floor (`floor`), astride not; and turns added to the trunk, the flat figure's own
 * from where it sits still (a cart's rock and jolt, a rower's swing, the balance against a hull's heel), degrees about
 * the body's right, forward and up.
 */
export interface SeatFit {
  seat: Seat;
  top: number;
  hips: [number, number];
  low: (local: Array<M3 | undefined>, move: V) => number;
  reach: Partial<Record<Side, { at: V; way: V }>>;
  floor: boolean;
  trunk?: Partial<Record<'pelvis' | 'spine' | 'chest' | 'neck' | 'head', [number, number, number]>>;
}
/** The sculpted bones each of the flat figure's trunk joints is shared over, and how much of it each takes. */
const TRUNK: Readonly<Record<string, ReadonlyArray<[string, number]>>> = {
  pelvis: [['pelvis', 1]], spine: [['spine_01', 0.5], ['spine_02', 0.5]], chest: [['spine_03', 1]], neck: [['neck_01', 0.5], ['neck_02', 0.5]], head: [['head', 1]],
};
/**
 * The flat figure's trunk turns as an added pose: pitch about the body's right (mesh -x), roll about forward (+z), yaw about
 * up (+y); the neck's and the head's yaw left to the clip's own look about.
 */
function trunkPose(sk: Skeleton, trunk: NonNullable<SeatFit['trunk']>): Pose {
  const q: Array<Q | undefined> = [];
  for (const [joint, e] of Object.entries(trunk)) for (const [bone, k] of TRUNK[joint] ?? []) {
    const i = sk.at.get(bone);
    if (i === undefined || !e) continue;
    const yaw = joint === 'neck' || joint === 'head' ? 0 : e[2] * k;
    q[i] = qmul(qmul(sk.world(i, [0, 1, 0], yaw), sk.world(i, [0, 0, 1], e[1] * k)), sk.world(i, [-1, 0, 0], e[0] * k));
  }
  return { q, move: [0, 0, 0] };
}
/**
 * A body sat driving, finished: its seat's clip at the island's time (blended toward the legs drawn up as far as the seat
 * says), the flat figure's trunk turns added; the hips put across and forward where the seat says and down on its top (the
 * lowest of what is sat on, `SeatFit.low`, on it); the feet put down flat on the floor under where the clip has them, the
 * knees bent to reach (never the hips let down to reach it); the fists on what they hold.
 */
export function seatedLocal(sk: Skeleton, pose: FigurePose, fit: SeatFit): { local: Array<M3 | undefined>; move: V; name: string } {
  const { clip, tuck } = seatClipOf(fit.seat), t = pose.phase / 6 + offsetOf(pose.id) * clip.length;
  let p = poseAt(sk, clip, t);
  if (tuck > 0) p = blendPose(p, poseAt(sk, SEAT_TUCK, t), tuck);
  if (fit.trunk) addPose(p, trunkPose(sk, fit.trunk), 1);
  const pelvis = sk.at.get('pelvis') as number, local = (): Array<M3 | undefined> => p.q.map((q) => (q ? qmat(q) : undefined));
  const F = sk.fk(local(), p.move);
  p.move = [p.move[0] + fit.hips[0] - F[pelvis].P[0], p.move[1], p.move[2] + fit.hips[1] - F[pelvis].P[2]];
  p.move = [p.move[0], p.move[1] + fit.top - fit.low(local(), p.move), p.move[2]];
  // (each foot reached for as one in the air is, so the hips are never let down to it)
  const plant = fit.floor ? { ...sk.plantOf(p), air: [1, 1] as [number, number] } : undefined;
  const out = sk.finish(p, { plant, free: true, reach: fit.reach });
  return { ...out, name: clip.name };
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
export function animate(sk: Skeleton, pose: FigurePose, figure: () => Array<M3 | undefined>, held?: Held, tools?: (id: string) => Held | undefined, fit?: SeatFit): Local {
  // sat driving: the seat's clip, put on the seat (`seatedLocal`)
  const sat = fit && ON ? seatedLocal(sk, pose, fit) : undefined;
  const c = sat ? undefined : clipFor(pose, sk.body);
  // a clip at a time: one holding hand tools holds the job's own, the work brought to the striking one where it reaches less far
  const play = (p: { clip: Clip; t: number }): Local => {
    const hold = p.clip.tools ? toolsIn(pose, sk.body) : undefined, side = p.clip.strike?.side ?? 'r', other = side === 'r' ? 'l' : 'r';
    const id = hold?.tools[side], ref = p.clip.tools?.[side];
    const d = tools && id && ref && id !== ref ? shiftOf(sk, p.clip, tools(id), tools(ref), id) : undefined;
    // (a clip that wields what is in hand: both fists reached as they close on its grip)
    const wield = p.clip.wields && held ? { hold: { l: held, r: held } } : {};
    return clipLocal(sk, p.clip, p.t, p.clip.grip ? held : undefined, tools, { ids: hold?.tools, ...(d ? { shift: { [other]: d } } : {}), ...wield });
  };
  const now: Local = sat ?? (c ? play(c) : { local: figure(), move: [0, 0, 0] });
  if (!pose.id) return now;
  const key = `${sk.body}|${pose.id}`, source = sat ? sat.name : c ? c.clip.name : 'figure', ms = performance.now();
  let k = KEPT.get(key);
  if (k) KEPT.delete(key);
  if (!k) k = { source, out: now, from: null, at: ms };
  else if (k.source !== source) { k.span = Math.max(SETTLE[k.source] ?? FADE, SETTLE[source] ?? FADE); k.from = k.out; k.was = k.cur; k.source = source; k.at = ms; }
  k.cur = c ? { clip: c.clip, t: c.t } : undefined;
  KEPT.set(key, k);
  if (KEPT.size > MAX_KEPT) KEPT.delete(KEPT.keys().next().value as string);
  let out = now;
  if (k.from) {
    const span = k.span ?? FADE, u = (ms - k.at) / 1000 / span, settle = span > FADE && !!k.was && !!c && !!plantBetween(sk, k.was, c, 0);
    if (u >= 1 + (settle ? RELEASE / span : 0)) k.from = null;
    else if (settle && k.was && c) {
      // a long fade (getting down or up): toward the pose the clip is at as the fade lands, held still meanwhile, then let
      // go into the clip's own motion from rest (never a motion against the fade's); the trunk, the head and the arms ahead
      // of the legs going down (bowed to the ground as the knees bend) and behind them coming up (the legs straightened
      // under the bowed trunk first); the feet kept where the two clips stand them, the legs bent to reach
      const rem = (1 - u) * span, ahead = stateOf(pose) === 'walk' ? c : clipFor({ ...pose, phase: pose.phase + rem * 6, ...(pose.act ? { act: { ...pose.act, t: pose.act.t + rem } } : {}) }, sk.body) ?? c;
      const goal = ahead === c ? now : play(ahead);
      let local: Array<M3 | undefined>, move: V, plant;
      if (u < 1) {
        const w = smoother(u), legs = blendLocal(k.from, goal, w), top = blendLocal(k.from, goal, smoother(k.source in SETTLE ? u * 1.5 : u * 1.5 - 0.5));
        local = legs.local.map((m, i) => (LEGS.test(sk.bones[i]?.name ?? '') ? m : top.local[i]));
        move = legs.move; plant = plantBetween(sk, k.was, ahead, w);
      } else {
        const v = smoother(((u - 1) * span) / RELEASE), b = blendLocal(goal, now, v);
        local = b.local; move = b.move; plant = plantBetween(sk, ahead, c, v);
      }
      out = sk.finish({ q: local.map((m) => m && quat(m)), move }, { plant, armsOut: -3 });
    } else out = blendLocal(k.from, now, smooth(u));
  }
  k.out = out;
  return out;
}
