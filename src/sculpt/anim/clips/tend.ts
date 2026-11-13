/**
 * T1 to T5, tending a wildermon stood beside it, and H1 to H2, healing: the clips of the jobs done to a beast or a wound with
 * the hands (`../routes.ts` CLIP_OF_JOB).
 *
 * - `offer` (taming, feeding): leant in, the knees given, the right hand held out low, palm up, eased forward to the beast
 *   and held there, drawn back a little; the left hand out low at the side.
 * - `milk`: crouched at the flank, the heels down, both fists under the belly pulling down in turn.
 * - `groom` (the brush): the left hand flat on the beast's back, the right drawing the brush down the flank from high on
 *   the left to low on the right, the chest turning after it, lifted back over in an arc; `groom-hand` the same with the
 *   fist empty (the ancient comb).
 * - `tack` (saddling, the gear, the ancient brace, collar and bridle): both fists lifted to back height and the load laid
 *   over, then bent down to the girth, a buckle pulled tight twice, up again.
 * - `lead` (mounting, hitching, pairing): the left hand flat on the beast, the right on a lead short of its head, a pull
 *   back with the weight onto the heels and let go forward.
 * - `heal` (treating a beast's wounds): crouched as at the milking, both fists round a leg, passing a dressing round it
 *   hand over hand.
 * - `heal-self` (a dressing, a salve, cleaning a wound: one's own): stood, the left forearm across the chest, the right
 *   fist passing a dressing round it, the head bowed to it.
 *
 * The beast stands where the game puts it (beside the body, the body turned the way it last walked), so each reach is to
 * a place a beast of any size has something at: the hands held from the belt to the chest's height a forearm and a half
 * ahead. The feet stand where the idle stands them (`plant`), so the fades in and out keep them put; the crouches fade
 * in and out slowly (`../index.ts` SETTLE). The hands are put on their places (`Clip.hands`, the arms reached to them),
 * the rest keyed. Played mirrored, left-handed, from the facings the flat figure works left-handed from (`../index.ts`
 * LEFT_OF).
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** The feet where the idle stands them (`../idle.ts`). */
const PLANT: NonNullable<Clip['plant']> = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
/** Hers closer together, as the idle stands them. */
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };

/** The fingers closed on what they hold (a teat, a strap, a lead, a dressing). */
const FIST_L: Record<string, Euler> = { fingers_01_l: [70, 0, 0], fingers_02_l: [80, 0, 0], thumb_02_l: [20, 0, 0] };
const FIST_R: Record<string, Euler> = { fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], thumb_02_r: [20, 0, 0] };
/** The fingers out flat (a hand laid on a beast, a palm held up). */
const FLAT_L: Record<string, Euler> = { fingers_01_l: [6, 0, 0], fingers_02_l: [8, 0, 0] };
const FLAT_R: Record<string, Euler> = { fingers_01_r: [6, 0, 0], fingers_02_r: [8, 0, 0] };

/**
 * The arms keyed before the reach: each elbow out and down, which side the reach keeps it on (`Clip.hands`); an arm not
 * reached hangs as keyed.
 */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 12], lowerarm_l: [70, 0, 0], upperarm_r: [20, 0, -12], lowerarm_r: [70, 0, 0] };
/** An arm hanging loose at the side, a little forward. */
const HANG_L: Record<string, Euler> = { upperarm_l: [6, 0, 6], lowerarm_l: [22, 0, 0], hand_l: [0, -40, 0], fingers_01_l: [14, 0, 0], fingers_02_l: [20, 0, 0] };

/**
 * A crouch: the hips let down between the knees (the knees out over the toes, the heels down), the trunk leant over the
 * thighs from the hips, the head up to look ahead; `deep` 1 at the milking's depth.
 */
const crouch = (deep: number): KeyPose => ({
  rot: {
    pelvis: [26 * deep, 0, 0], spine_01: [6 * deep, 0, 0], spine_02: [6 * deep, 0, 0], spine_03: [4 * deep, 0, 0],
    neck_01: [-14 * deep, 0, 0], neck_02: [-6 * deep, 0, 0], head: [10, 0, 0],
    thigh_l: [70 * deep, -8 * deep, 14 * deep], thigh_r: [70 * deep, 8 * deep, -14 * deep], calf_l: [-110 * deep, 0, 0], calf_r: [-110 * deep, 0, 0],
  },
  move: [0, -0.24 * deep, 0.03 * deep],
});

/** A beat of a clip here: a key pose and where each reached hand is (body heights across, up, forward). */
interface HandBeat extends Beat { hands?: Partial<Record<'l' | 'r', Euler>> }
/** The reached hands' keys from the beats that place them, eased as the beats are. */
function handKeys(beats: HandBeat[], side: 'l' | 'r'): Array<Key<Euler>> {
  return beats.filter((b) => b.hands?.[side]).map((b) => ({ t: b.t, v: b.hands?.[side] as Euler, ...(b.ease ? { ease: b.ease } : {}) }));
}
/** A clip from its beats: looped, the feet planted as the idle stands them, the hands reached where the beats put them. */
function tendClip(name: string, length: number, beats: HandBeat[], way: Partial<Record<'l' | 'r', Euler>>, o: Partial<Clip> & { lag?: Record<string, number> } = {}): Clip {
  const { lag, ...rest } = o;
  const keys = poseToPose(beats, { length, loop: true, lag });
  const hands: Partial<Record<'l' | 'r', HandReach>> = {};
  for (const s of ['l', 'r'] as const) if (way[s]) hands[s] = { at: handKeys(beats, s), way: way[s] as Euler };
  return {
    name, loop: true, length, mask: 'full', plant: PLANT, breath: { count: 1, depth: 0.5 }, armsFree: true,
    tracks: keys.tracks, move: keys.move, poses: keys.poses, hands,
    bodies: { woman: { add: HER_FEET } },
    ...rest,
  };
}

/* ---- T1 offer: taming, feeding --------------------------------------------------------------------------------- */
/** Seconds a run: the hand eased out (1.1), held out still (to 1.9), drawn back a little. */
const OFFER_LENGTH = 2.4;
/** Leant in to the beast, the knees given, the head down to the hand. */
const OFFER_IN: KeyPose = {
  rot: {
    ...ELBOWS, ...HANG_L, ...FLAT_R,
    pelvis: [6, 4, 0], spine_01: [4, 2, 0], spine_02: [4, 2, 0], spine_03: [3, 0, 0], neck_01: [0, 0, 0], neck_02: [0, 0, 0], head: [4, 0, 0],
    upperarm_l: [16, 0, 10], lowerarm_l: [30, 0, 0],
  },
  move: [0, -0.015, 0.01],
};
/** Further in: the weight onto the front of the feet, the hand out to the beast. */
const OFFER_OUT: KeyPose = merge(OFFER_IN, { rot: { pelvis: [9, 6, 0], spine_01: [6, 3, 0], spine_02: [6, 3, 0], spine_03: [4, 0, 0], neck_01: [-4, 0, 0], head: [2, 0, 0] }, move: [0.004, -0.025, 0.025] });
/** Held out: the head lifted a touch to the beast's face. */
const OFFER_HELD: KeyPose = merge(OFFER_OUT, { rot: { head: [-2, 0, 0], neck_02: [-2, 0, 0] }, move: [0.004, -0.027, 0.027] });
const OFFER_BEATS: HandBeat[] = [
  { t: 0, pose: OFFER_IN, ease: 'inOut', stage: 'key', name: 'hand in', hands: { r: [-0.09, 0.56, 0.3] } },
  { t: 1.1, pose: OFFER_OUT, ease: 'inOut', stage: 'key', name: 'hand out', hands: { r: [-0.06, 0.61, 0.44] } },
  { t: 1.9, pose: OFFER_HELD, ease: 'inOut', name: 'held out', hands: { r: [-0.06, 0.615, 0.45] } },
];
export const OFFER = tendClip('offer', OFFER_LENGTH, OFFER_BEATS, { r: [1, 0, 0] }, {
  lag: { head: 0.08, neck_02: 0.05 },
  // a go fitted to its length by the hold
  stretch: [[1.1, 1.9]],
});

/* ---- T2 milk ---------------------------------------------------------------------------------------------------- */
/** Seconds a run: the right fist's pull and the left's. */
const MILK_LENGTH = 1.2;
const MILK_HALF = MILK_LENGTH / 2;
const SQUAT: KeyPose = merge(crouch(1), { rot: { ...ELBOWS, ...FIST_L, ...FIST_R } });
/** The right fist's pull: the shoulders rolled down after it. */
const PULL_R: KeyPose = merge(SQUAT, { rot: { spine_03: [5, 3, 0], head: [12, -4, 0] } });
const PULL_L: KeyPose = merge(SQUAT, { rot: { spine_03: [5, -3, 0], head: [12, 4, 0] } });
/** Where the fists close (up) and are drawn down to, body heights; each beside the middle. */
const TEAT_UP = 0.31, TEAT_DOWN = 0.2, TEAT_X = 0.05, TEAT_Z = 0.34;
const MILK_BEATS: HandBeat[] = [
  { t: 0, pose: PULL_L, ease: 'inOut', stage: 'key', name: 'right up, left down', hands: { r: [-TEAT_X, TEAT_UP, TEAT_Z], l: [TEAT_X, TEAT_DOWN, TEAT_Z] } },
  { t: MILK_HALF, pose: PULL_R, ease: 'inOut', stage: 'key', name: 'right down, left up', hands: { r: [-TEAT_X, TEAT_DOWN, TEAT_Z], l: [TEAT_X, TEAT_UP, TEAT_Z] } },
];
/** Hers let further down: her shins longer for her height stand her hips higher over the same bend. */
const HER_CROUCH: Clip['bodies'] = { woman: { add: HER_FEET, move: [1, 1.3, 1] } };
export const MILK = tendClip('milk', MILK_LENGTH, MILK_BEATS, { l: [0, 1, 0], r: [0, 1, 0] }, { lag: { spine_03: 0.05, head: 0.08 }, bodies: HER_CROUCH });

/* ---- T3 groom --------------------------------------------------------------------------------------------------- */
/** Seconds a run: the stroke down the flank (to 0.55), the brush lifted back over (to the end). */
const GROOM_LENGTH = 1.4, STROKE = 0.55;
/** Square to the flank, leant in a little, the left hand on the beast. */
const GROOM_BASE: KeyPose = {
  rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, spine_01: [5, 0, 0], spine_02: [5, 0, 0], neck_01: [0, 0, 0], head: [6, 0, 0] },
  move: [0, -0.02, 0.02],
};
/** At the stroke's start: high on the left, the chest turned left after the brush, the weight on the left foot. */
const GROOM_HIGH: KeyPose = merge(GROOM_BASE, { rot: { pelvis: [12, 6, 0], spine_02: [6, 6, 0], spine_03: [2, 6, 0], head: [2, 6, 0] }, move: [0.012, -0.025, 0.035] });
/** At its end: low on the right, the chest turned right after it, bent into it, the weight on the right foot. */
const GROOM_LOW: KeyPose = merge(GROOM_BASE, { rot: { pelvis: [20, -10, 0], spine_01: [8, -2, 0], spine_02: [9, -8, 0], spine_03: [4, -6, 0], head: [8, -8, 0] }, move: [-0.014, -0.05, 0.045] });
/** Lifted back over: the brush off the flank, the chest coming back. */
const GROOM_BACK: KeyPose = merge(GROOM_BASE, { rot: { pelvis: [6, 0, 0], spine_02: [4, 0, 0], head: [4, 0, 0] }, move: [0, -0.018, 0.018] });
const GROOM_ON: Euler = [0.16, 0.62, 0.4];
const GROOM_BEATS: HandBeat[] = [
  { t: 0, pose: GROOM_HIGH, ease: 'inOut', stage: 'key', name: 'brush high', hands: { r: [0.06, 0.66, 0.44], l: GROOM_ON } },
  { t: STROKE, pose: GROOM_LOW, ease: 'inOut', stage: 'key', name: 'brush low', hands: { r: [-0.15, 0.56, 0.46], l: GROOM_ON } },
  { t: 0.95, pose: GROOM_BACK, ease: 'out', name: 'lifted back', hands: { r: [-0.08, 0.68, 0.34], l: GROOM_ON } },
];
export const GROOM = tendClip('groom', GROOM_LENGTH, GROOM_BEATS, { l: [-1, 0, 0], r: [1, 0, 0] }, {
  lag: { spine_03: 0.03, head: 0.06 },
  tools: { r: 'groom_brush' },
  stretch: [[0.95, GROOM_LENGTH]],
});
/** The same strokes with the fist empty (the ancient comb, held in it). */
export const GROOM_HAND: Clip = { ...GROOM, name: 'groom-hand', tools: undefined };

/* ---- T4 tack ---------------------------------------------------------------------------------------------------- */
/** Seconds a run: lifted (0.5), laid over (0.9), down to the girth (1.5), two pulls on the buckle (to 2.2), up again. */
const TACK_LENGTH = 2.6;
const TACK_BASE: KeyPose = { rot: { ...ELBOWS, ...FIST_L, ...FIST_R, neck_01: [-2, 0, 0], head: [-4, 0, 0] } };
/** Lifted: the load raised to the chest's height, leant back a touch under it, the head up to the back. */
const TACK_LIFT: KeyPose = merge(TACK_BASE, { rot: { pelvis: [-2, 0, 0], spine_02: [-2, 0, 0], spine_03: [-3, 0, 0] }, move: [0, -0.012, -0.006] });
/** Laid over: reached up and in over the back, the weight onto the front of the feet. */
const TACK_OVER: KeyPose = merge(TACK_BASE, { rot: { pelvis: [10, 0, 0], spine_01: [3, 0, 0], spine_02: [3, 0, 0], spine_03: [0, 0, 0], neck_01: [-6, 0, 0], head: [-8, 0, 0] }, move: [0, -0.012, 0.035] });
/** At the girth: bent from the hips and the knees, the head down to the buckle. */
const TACK_GIRTH: KeyPose = merge(TACK_BASE, { rot: { pelvis: [24, -4, 0], spine_01: [8, -2, 0], spine_02: [8, -2, 0], spine_03: [5, 0, 0], neck_01: [-4, 0, 0], head: [10, 0, 0], thigh_l: [20, 0, 4], thigh_r: [20, 0, -4] }, move: [-0.005, -0.08, 0.04] });
/** The buckle's pull: the right fist drawn up, the shoulders after it. */
const TACK_PULL: KeyPose = merge(TACK_GIRTH, { rot: { spine_03: [4, -4, 0], pelvis: [22, -6, 0] }, move: [-0.008, -0.074, 0.036] });
const GIRTH: Euler = [0.04, 0.42, 0.34];
const TACK_BEATS: HandBeat[] = [
  { t: 0, pose: TACK_GIRTH, ease: 'inOut', name: 'up from the girth', hands: { r: [-0.05, 0.44, 0.33], l: GIRTH } },
  { t: 0.5, pose: TACK_LIFT, ease: 'inOut', stage: 'key', name: 'lifted', hands: { r: [-0.1, 0.72, 0.24], l: [0.1, 0.72, 0.24] } },
  { t: 0.9, pose: TACK_OVER, ease: 'inOut', stage: 'key', name: 'laid over', hands: { r: [-0.09, 0.76, 0.38], l: [0.09, 0.76, 0.38] } },
  { t: 1.5, pose: TACK_GIRTH, ease: 'inOut', stage: 'key', name: 'at the girth', hands: { r: [-0.05, 0.43, 0.34], l: GIRTH } },
  { t: 1.7, pose: TACK_PULL, ease: 'out', name: 'pulled', hands: { r: [-0.06, 0.5, 0.31], l: GIRTH } },
  { t: 1.85, pose: TACK_GIRTH, ease: 'inOut', name: 'let back', hands: { r: [-0.05, 0.44, 0.33], l: GIRTH } },
  { t: 2.05, pose: TACK_PULL, ease: 'out', stage: 'key', name: 'pulled tight', hands: { r: [-0.06, 0.51, 0.31], l: GIRTH } },
];
export const TACK = tendClip('tack', TACK_LENGTH, TACK_BEATS, { l: [0, 1, 0], r: [0, 1, 0] }, { lag: { head: 0.06 } });

/* ---- T5 lead ---------------------------------------------------------------------------------------------------- */
/** Seconds a run: the pull back (0.45), held (to 0.8), let go forward. */
const LEAD_LENGTH = 1.6;
const LEAD_BASE: KeyPose = { rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, spine_02: [2, 0, 0], head: [4, 0, 0] }, move: [0, -0.015, 0.008] };
/** Pulled: the weight back onto the heels, leant back, the chest turned right after the lead. */
const LEAD_BACK: KeyPose = merge(LEAD_BASE, { rot: { pelvis: [-4, -6, 0], spine_02: [-3, -4, 0], spine_03: [-2, -4, 0], head: [2, 4, 0] }, move: [-0.006, -0.03, -0.03] });
const ON_BEAST: Euler = [0.13, 0.6, 0.32];
const LEAD_BEATS: HandBeat[] = [
  { t: 0, pose: LEAD_BASE, ease: 'inOut', stage: 'key', name: 'lead in hand', hands: { r: [-0.1, 0.56, 0.34], l: ON_BEAST } },
  { t: 0.45, pose: LEAD_BACK, ease: 'out', stage: 'key', name: 'pulled', hands: { r: [-0.14, 0.53, 0.2], l: ON_BEAST } },
  { t: 0.8, pose: LEAD_BACK, ease: 'linear', name: 'held', hands: { r: [-0.14, 0.53, 0.2], l: ON_BEAST } },
];
export const LEAD = tendClip('lead', LEAD_LENGTH, LEAD_BEATS, { l: [-1, 0, 0], r: [0, 1, 0] }, { lag: { head: 0.06 }, stretch: [[0.45, 0.8]] });

/* ---- H1 heal: a beast's wounds -------------------------------------------------------------------------------------- */
/** Seconds a run: the dressing passed round the leg once, hand over hand. */
const HEAL_LENGTH = 1.6;
const HEAL_SQUAT: KeyPose = merge(crouch(0.85), { rot: { ...ELBOWS, ...FIST_L, ...FIST_R } });
/** The leg's middle and the dressing's round it: body heights. */
const LEG: Euler = [0, 0.32, 0.31], ROUND = 0.075;
/** A fist at an angle round the leg (0: on the near side, a quarter turn: on the right), lower as the dressing goes on. */
const round = (a: number, dy: number): Euler => [LEG[0] - Math.sin(a) * ROUND, LEG[1] + dy, LEG[2] - Math.cos(a) * ROUND];
const HEAL_BEATS: HandBeat[] = [0, 1, 2, 3].map((k): HandBeat => {
  const a = (k * Math.PI) / 2;
  return { t: (k * HEAL_LENGTH) / 4, pose: merge(HEAL_SQUAT, { rot: { spine_03: [4, k === 1 ? -3 : k === 3 ? 3 : 0, 0], head: [12, k === 1 ? -4 : k === 3 ? 4 : 0, 0] } }), ease: 'linear', stage: k % 2 ? undefined : 'key', name: ['right near', 'right round', 'right far', 'right back'][k], hands: { r: round(a, 0.01), l: round(a + Math.PI, -0.01) } };
});
export const HEAL = tendClip('heal', HEAL_LENGTH, HEAL_BEATS, { l: [0, 1, 0], r: [0, 1, 0] }, { lag: { head: 0.08 }, bodies: HER_CROUCH });

/* ---- H2 heal-self: one's own wound -------------------------------------------------------------------------------- */
/** Seconds a run: the dressing passed round the forearm once. */
const SELF_LENGTH = 1.6;
const SELF_BASE: KeyPose = {
  rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, upperarm_l: [24, 0, 30], spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [8, 0, 0], neck_02: [6, 0, 0], head: [16, 0, 0] },
  move: [0, -0.01, 0],
};
/** The left forearm across the chest (the left fist's place), and the middle of it the dressing goes round. */
const ARM_FIST: Euler = [-0.04, 0.61, 0.24], WRAP: Euler = [0.07, 0.61, 0.25], WRAP_R = 0.065;
const SELF_BEATS: HandBeat[] = [0, 1, 2, 3].map((k): HandBeat => {
  const a = (k * Math.PI) / 2;
  return { t: (k * SELF_LENGTH) / 4, pose: merge(SELF_BASE, { rot: { head: [16, 0, k === 1 ? 2 : k === 3 ? -2 : 0] } }), ease: 'linear', stage: k % 2 ? undefined : 'key', name: ['over', 'out', 'under', 'in'][k], hands: { l: ARM_FIST, r: [WRAP[0], WRAP[1] + Math.cos(a) * WRAP_R, WRAP[2] + Math.sin(a) * WRAP_R] } };
});
export const HEAL_SELF = tendClip('heal-self', SELF_LENGTH, SELF_BEATS, { l: [0, 0, -1], r: [0, 1, 0] }, {
  lag: { head: 0.06 },
  // her arms shorter for her height: the forearm held lower and nearer, its elbow kept down
  bodies: { woman: { add: HER_FEET, hands: { l: [0.04, -0.025, -0.03], r: [0.03, -0.025, -0.03] } } },
});

/** Every clip here and its mirror, by name (`../index.ts` CLIPS, LEFT_OF). */
const ALL = [OFFER, MILK, GROOM, GROOM_HAND, TACK, LEAD, HEAL, HEAL_SELF];
export const TEND_CLIPS: Record<string, Clip> = Object.fromEntries(ALL.flatMap((c) => [[c.name, c], [`${c.name}-left`, mirrorClip(c, `${c.name}-left`)]]));
export const TEND_LEFT: Record<string, string> = Object.fromEntries(ALL.map((c) => [c.name, `${c.name}-left`]));
