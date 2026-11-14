/**
 * C1 to C9, casting a spell (`FigurePose.cast`): a clip for each way a spell is cast (`CastKind`, `../../../render/spells/info.ts`),
 * each a charge and a release, played once over the cast with the release on the spell's own (`castTime`):
 *
 * - `cast-bolt` (bolt: fire, a binding, a sentence sent at a creature): the weight back onto the right foot, the trunk turned
 *   right, the right hand drawn back beside the ear, cupped, the left held out at the target; released, the hips and trunk
 *   turned through, the right palm driven out at the target, the left fist pulled back to the ribs.
 * - `cast-curse` (curse: a creature marked, a hex, a judgment): the right hand drawn across to the left shoulder, the left fist
 *   at the chest; released, the right arm swept out straight at the target, the hand flat, thumb up.
 * - `cast-ward` (buff: a skin, a rage, a breath on oneself; an ally's spell cast on oneself): the forearms crossed before the
 *   chest, the knees given, the head down; released, the arms thrown open to the sides, palms out, the chest up.
 * - `cast-ally` (ally: a dressing, a ward, a blessing on somebody else): both hands cupped together before the belly, palms
 *   up; released, both pushed out at the ally, palms forward, the trunk leant after them.
 * - `cast-nova` (nova: everything round oneself): crouched, both fists gathered low; released, up out of the crouch, both arms
 *   flung wide and high, palms out.
 * - `cast-ground` (ground: a patch of ground blessed or cursed): both hands raised over the head, palms forward; released,
 *   bowed from the hips and the knees, both palms brought down flat toward the ground ahead.
 * - `cast-command` (command: a companion told, a creature told off): the right hand raised beside the head, the left fist on the
 *   hip; released, the right arm chopped down and forward at the target, the hand flat, thumb up.
 * - `cast-pray` (pray: a patron asked, a path's technique): palms together before the chest, the head bowed; released, both
 *   hands lifted over the head, palms forward, the head up.
 * - `cast-throw` (throw: a javelin, an axe or a knife thrown): the weapon in the right fist cocked back over the shoulder, the
 *   left arm out at the target; released, the right arm whipped over and through, the trunk turned through after it.
 *
 * The blows (strike, thrust) and the shots play the fight's own clips with the weapon in hand (`../index.ts` castClipOf).
 *
 * The feet stand where the idle stands them throughout (`plant`): the weight is shifted with the hips (`move`), the knees
 * bent to reach. The hands are put on their places (`Clip.hands`, the arms reached to them), in body heights across (the
 * body's left), up and forward; the trunk, the head and the fingers keyed. Each starts and ends with the arms hanging as the
 * idle's, so the fades in and out (`../index.ts` animate) are short. The release is a mark (`Clip.fx`, kind `cast`: a flare
 * at the releasing hand in the spell's colours, `../../../render/fx/cast.ts`) and an event; the spell's own effects find the
 * hands where the clip has them (`../../../render/spells/stage.ts` jointOf). Played mirrored, left-handed, from the facings
 * that turn the right side away from whoever is looking (five, six and seven: `CAST_LEFT_FACINGS`).
 */
import type { Clip, FxMark, HandReach, Key } from '../clip';
import { merge, mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import type { CastKind } from '../../../render/spells/info';

/** The feet where the idle stands them (`./idle.ts`); hers closer together. */
const PLANT: NonNullable<Clip['plant']> = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };

/** The arms hanging as the idle's (`./emote.ts` HANG), each a little out from the side. */
const HANG: Record<string, Euler> = {
  upperarm_l: [-2, 0, 7], upperarm_r: [-2, 0, -7], lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0],
  hand_l: [0, -50, 0], hand_r: [0, 50, 0], fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0], fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
};
/** The elbows keyed out and down before the reach, so the reach keeps them on that side (`Clip.hands`). */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 14], lowerarm_l: [60, 0, 0], upperarm_r: [20, 0, -14], lowerarm_r: [60, 0, 0] };
/** The fingers of each hand: spread straight, cupped round a charge, closed in a fist. */
const hand = (s: 'l' | 'r', f1: number, f2: number, th: number): Record<string, Euler> => ({ [`fingers_01_${s}`]: [f1, 0, 0], [`fingers_02_${s}`]: [f2, 0, 0], [`thumb_02_${s}`]: [th, 0, 0] });
const OPEN = (s: 'l' | 'r') => hand(s, -4, 0, 0);
const CUP = (s: 'l' | 'r') => hand(s, 38, 42, 14);
const FIST = (s: 'l' | 'r') => hand(s, 72, 82, 22);
const LOOSE = (s: 'l' | 'r') => hand(s, 12, 18, 0);

/** Where each hand hangs at rest, body heights (across to the left, up, forward), its grip's way and its knuckles' way. */
const REST: Record<'l' | 'r', HandAt> = { l: { at: [0.135, 0.47, 0.03], way: [0, 0, 1], k: [0, -1, 0] }, r: { at: [-0.135, 0.47, 0.03], way: [0, 0, 1], k: [0, -1, 0] } };
/** A hand at a beat: its place, the way its grip runs toward the thumb, the way its knuckles point. */
interface HandAt { at: Euler; way: Euler; k: Euler }
/** The rest's hands, as a beat gives them. */
const RESTING = { l: REST.l, r: REST.r };
/** The stood pose at rest, the arms hanging. */
const REST_POSE: KeyPose = { rot: { ...HANG, pelvis: [0, 0, 0], spine_01: [0, 0, 0], spine_02: [0, 0, 0], spine_03: [0, 0, 0], neck_01: [0, 0, 0], neck_02: [0, 0, 0], head: [0, 0, 0] } };

/** A beat of a cast: a key pose and where each hand is. */
interface CastBeat extends Beat { hands: Record<'l' | 'r', HandAt> }

/** The hand keys from the beats, eased as each beat is. */
function reachOf(beats: CastBeat[], s: 'l' | 'r'): HandReach {
  const key = (b: CastBeat, v: Euler): Key<Euler> => ({ t: b.t, v, ...(b.ease ? { ease: b.ease } : {}), ...(b.back !== undefined ? { back: b.back } : {}) });
  return { at: beats.map((b) => key(b, b.hands[s].at)), way: beats[0].hands[s].way, ways: beats.map((b) => key(b, b.hands[s].way)), knuckles: beats.map((b) => key(b, b.hands[s].k)) };
}

/** Seconds into each clip its spell leaves the hand: the release (`castTime` puts the spell's own there). */
export const RELEASE_EVENT = 'release';

/**
 * A cast's clip from its beats: played once, the feet planted as the idle stands them, the hands reached where the beats
 * put them, released at `release` seconds (a mark from the hands that send it: `from`).
 */
function castClip(name: string, length: number, release: number, beats: CastBeat[], from: Array<'l' | 'r'>, o: Partial<Clip> & { lag?: Record<string, number> } = {}): Clip {
  const { lag, ...rest } = o;
  const keys = poseToPose(beats, { length, loop: false, lag });
  const fx: FxMark[] = from.map((s) => ({ at: release, from: { bone: `hand_${s}` }, kind: 'cast', key: true, params: { side: s } }));
  return {
    name, loop: false, length, mask: 'full', plant: PLANT, breath: { count: 1, depth: 0.4 }, armsFree: true,
    tracks: keys.tracks, move: keys.move, poses: keys.poses,
    hands: { l: reachOf(beats, 'l'), r: reachOf(beats, 'r') },
    events: [{ t: release, name: RELEASE_EVENT }],
    fx,
    bodies: { woman: { add: HER_FEET } },
    ...rest,
  };
}
/** A beat at rest, the arms hanging: a clip's first and last. */
const rest = (t: number, name: string, ease: Beat['ease'] = 'inOut'): CastBeat => ({ t, pose: REST_POSE, ease, stage: 'key', name, hands: RESTING });

/* ---- C1 bolt -------------------------------------------------------------------------------------------------------- */
const BOLT_LENGTH = 1.3, BOLT_RELEASE = 0.6;
/** Drawn back: the weight onto the right foot, the hips and the trunk turned right, the head kept on the target. */
const BOLT_DRAWN: KeyPose = {
  rot: { ...ELBOWS, ...CUP('r'), ...OPEN('l'), pelvis: [0, -14, 2], spine_01: [0, -4, 0], spine_02: [-2, -8, 0], spine_03: [-4, -8, -2], neck_01: [0, 10, 0], neck_02: [0, 8, 0], head: [2, 10, 2] },
  move: [-0.012, -0.022, -0.014],
};
/** Wound further, the last gather before the release. */
const BOLT_WOUND: KeyPose = merge(BOLT_DRAWN, { rot: { pelvis: [0, -18, 3], spine_02: [-3, -10, 0], spine_03: [-6, -10, -3], head: [2, 12, 3] }, move: [-0.016, -0.026, -0.018] });
/** Released: turned through onto the left foot, leant into the palm, the head over it. */
const BOLT_SENT: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('r'), ...FIST('l'), pelvis: [4, 12, -2], spine_01: [2, 4, 0], spine_02: [4, 8, 0], spine_03: [6, 8, 2], neck_01: [-4, -6, 0], neck_02: [-2, -4, 0], head: [-2, -8, -2] },
  move: [0.01, -0.018, 0.018],
};
const BOLT_AFTER: KeyPose = merge(BOLT_SENT, { rot: { pelvis: [2, 8, -1], spine_03: [4, 5, 1], head: [0, -5, -1], ...LOOSE('r') }, move: [0.007, -0.014, 0.014] });
export const BOLT = castClip('cast-bolt', BOLT_LENGTH, BOLT_RELEASE, [
  rest(0, 'stood'),
  { t: 0.42, pose: BOLT_DRAWN, ease: 'inOut', stage: 'key', name: 'drawn back', hands: { r: { at: [-0.17, 0.87, -0.05], way: [1, 0, 0], k: [0, 1, 0.2] }, l: { at: [0.03, 0.78, 0.3], way: [-1, 0, 0], k: [0, 1, 0.2] } } },
  { t: 0.53, pose: BOLT_WOUND, ease: 'inOut', name: 'wound', hands: { r: { at: [-0.19, 0.89, -0.08], way: [1, 0, 0], k: [0, 1, 0.1] }, l: { at: [0.04, 0.79, 0.31], way: [-1, 0, 0], k: [0, 1, 0.2] } } },
  { t: BOLT_RELEASE, pose: BOLT_SENT, ease: 'out', stage: 'key', name: 'released', hands: { r: { at: [-0.03, 0.83, 0.42], way: [1, 0, 0], k: [0, 1, 0.35] }, l: { at: [0.15, 0.66, 0.06], way: [0, 0.4, 1], k: [0, 0, 1] } } },
  { t: 0.88, pose: BOLT_AFTER, ease: 'inOut', name: 'followed through', hands: { r: { at: [-0.04, 0.77, 0.38], way: [1, 0, 0], k: [0, 0.6, 1] }, l: { at: [0.15, 0.62, 0.05], way: [0, 0.4, 1], k: [0, 0, 1] } } },
  rest(BOLT_LENGTH, 'stood again'),
], ['r'], { lag: { head: 0.05, neck_02: 0.03, spine_03: 0.02 } });

/* ---- C2 curse ------------------------------------------------------------------------------------------------------- */
const CURSE_LENGTH = 1.3, CURSE_RELEASE = 0.6;
/** Gathered: the right hand across to the left hip, palm down, the trunk turned left and bowed over it, the head kept on the target. */
const CURSE_GATHER: KeyPose = {
  rot: { ...ELBOWS, ...hand('r', 30, 34, 10), ...FIST('l'), pelvis: [4, 12, 0], spine_01: [2, 4, 0], spine_02: [5, 9, 0], spine_03: [6, 9, 0], neck_01: [0, -10, 0], neck_02: [-2, -8, 0], head: [2, -6, 0] },
  move: [0.008, -0.016, -0.006],
};
/** Pointed: swept up and out straight at the target, the hand flat, palm down, leant after it, the head forward along the arm. */
const CURSE_POINT: KeyPose = {
  rot: { ...ELBOWS, ...hand('r', -6, -2, 0), ...FIST('l'), pelvis: [3, -8, 0], spine_01: [2, -2, 0], spine_02: [4, -6, 0], spine_03: [5, -6, 0], neck_01: [-6, 4, 0], neck_02: [-2, 4, 0], head: [-4, 4, 0] },
  move: [-0.004, -0.012, 0.014],
};
const CURSE_HELD: KeyPose = merge(CURSE_POINT, { rot: { spine_03: [4, -5, 0], head: [-2, 3, 0] }, move: [-0.004, -0.011, 0.012] });
const CHEST_FIST: HandAt = { at: [0.05, 0.71, 0.13], way: [0, 1, 0], k: [-1, 0, 0.3] };
export const CURSE = castClip('cast-curse', CURSE_LENGTH, CURSE_RELEASE, [
  rest(0, 'stood'),
  { t: 0.44, pose: CURSE_GATHER, ease: 'inOut', stage: 'key', name: 'gathered', hands: { r: { at: [0.13, 0.58, 0.12], way: [1, 0, 0.3], k: [0.3, -0.6, 1] }, l: CHEST_FIST } },
  { t: CURSE_RELEASE, pose: CURSE_POINT, ease: 'out', stage: 'key', name: 'pointed', hands: { r: { at: [-0.06, 0.84, 0.43], way: [1, 0, 0], k: [0, 0, 1] }, l: CHEST_FIST } },
  { t: 0.95, pose: CURSE_HELD, ease: 'inOut', name: 'held on it', hands: { r: { at: [-0.06, 0.82, 0.41], way: [1, 0, 0], k: [0, -0.1, 1] }, l: CHEST_FIST } },
  rest(CURSE_LENGTH, 'stood again'),
], ['r'], { lag: { head: 0.05, neck_02: 0.03 } });

/* ---- C3 ward -------------------------------------------------------------------------------------------------------- */
const WARD_LENGTH = 1.4, WARD_RELEASE = 0.6;
/** Gathered in: the forearms crossed before the chest, fists closed, the knees given, the head bowed over them. */
const WARD_IN: KeyPose = {
  rot: { ...ELBOWS, ...FIST('l'), ...FIST('r'), pelvis: [6, 0, 0], spine_01: [3, 0, 0], spine_02: [4, 0, 0], spine_03: [6, 0, 0], clavicle_l: [0, 0, 6], clavicle_r: [0, 0, -6], neck_01: [6, 0, 0], neck_02: [4, 0, 0], head: [10, 0, 0] },
  move: [0, -0.03, 0],
};
/** Thrown open: up out of it, the chest lifted, the arms out to the sides, palms out. */
const WARD_OUT: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [-2, 0, 0], spine_01: [-1, 0, 0], spine_02: [-3, 0, 0], spine_03: [-6, 0, 0], neck_01: [-2, 0, 0], neck_02: [-2, 0, 0], head: [-6, 0, 0] },
  move: [0, -0.006, 0],
};
const WARD_HELD: KeyPose = merge(WARD_OUT, { rot: { spine_03: [-3, 0, 0], head: [-2, 0, 0], ...LOOSE('l'), ...LOOSE('r') }, move: [0, -0.01, 0] });
export const WARD = castClip('cast-ward', WARD_LENGTH, WARD_RELEASE, [
  rest(0, 'stood'),
  { t: 0.44, pose: WARD_IN, ease: 'inOut', stage: 'key', name: 'crossed', hands: { r: { at: [0.05, 0.7, 0.18], way: [0.3, 1, 0], k: [1, 0.3, 0.6] }, l: { at: [-0.05, 0.67, 0.2], way: [-0.3, 1, 0], k: [-1, 0.3, 0.6] } } },
  { t: WARD_RELEASE, pose: WARD_OUT, ease: 'out', stage: 'key', name: 'thrown open', hands: { r: { at: [-0.38, 0.78, 0.1], way: [0, 0, 1], k: [-1, 0.6, 0] }, l: { at: [0.38, 0.78, 0.1], way: [0, 0, 1], k: [1, 0.6, 0] } } },
  { t: 0.95, pose: WARD_HELD, ease: 'inOut', name: 'held open', hands: { r: { at: [-0.36, 0.72, 0.1], way: [0, 0, 1], k: [-1, 0.4, 0] }, l: { at: [0.36, 0.72, 0.1], way: [0, 0, 1], k: [1, 0.4, 0] } } },
  rest(WARD_LENGTH, 'stood again'),
], ['r', 'l'], { lag: { head: 0.04 } });

/* ---- C4 ally -------------------------------------------------------------------------------------------------------- */
const ALLY_LENGTH = 1.5, ALLY_RELEASE = 0.6;
/** Cupped: both hands together before the belly, palms up, the head down to them. */
const ALLY_CUP: KeyPose = {
  rot: { ...ELBOWS, ...CUP('l'), ...CUP('r'), pelvis: [2, 0, 0], spine_02: [3, 0, 0], spine_03: [4, 0, 0], neck_01: [8, 0, 0], neck_02: [6, 0, 0], head: [12, 0, 0] },
  move: [0, -0.016, -0.004],
};
/** Given: both pushed out at the ally, palms forward, the trunk leant after them, the head up to them. */
const ALLY_GIVE: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [4, 0, 0], spine_01: [2, 0, 0], spine_02: [4, 0, 0], spine_03: [5, 0, 0], neck_01: [-4, 0, 0], neck_02: [-2, 0, 0], head: [-2, 0, 0] },
  move: [0, -0.012, 0.016],
};
const ALLY_HELD: KeyPose = merge(ALLY_GIVE, { rot: { ...LOOSE('l'), ...LOOSE('r'), spine_03: [4, 0, 0] }, move: [0, -0.011, 0.014] });
export const ALLY = castClip('cast-ally', ALLY_LENGTH, ALLY_RELEASE, [
  rest(0, 'stood'),
  { t: 0.44, pose: ALLY_CUP, ease: 'inOut', stage: 'key', name: 'cupped', hands: { r: { at: [-0.04, 0.64, 0.18], way: [-1, 0, 0], k: [0.2, 0.2, 1] }, l: { at: [0.04, 0.64, 0.18], way: [1, 0, 0], k: [-0.2, 0.2, 1] } } },
  { t: ALLY_RELEASE, pose: ALLY_GIVE, ease: 'out', stage: 'key', name: 'given', hands: { r: { at: [-0.08, 0.78, 0.4], way: [1, 0, 0], k: [0, 1, 0.3] }, l: { at: [0.08, 0.78, 0.4], way: [-1, 0, 0], k: [0, 1, 0.3] } } },
  { t: 1.0, pose: ALLY_HELD, ease: 'inOut', name: 'held out', hands: { r: { at: [-0.08, 0.75, 0.38], way: [1, 0, 0], k: [0, 1, 0.5] }, l: { at: [0.08, 0.75, 0.38], way: [-1, 0, 0], k: [0, 1, 0.5] } } },
  rest(ALLY_LENGTH, 'stood again'),
], ['r', 'l'], { lag: { head: 0.05 } });

/* ---- C5 nova -------------------------------------------------------------------------------------------------------- */
const NOVA_LENGTH = 1.5, NOVA_RELEASE = 0.55;
/** Gathered low: crouched, bent over both fists before the belly. */
const NOVA_LOW: KeyPose = {
  rot: { ...ELBOWS, ...FIST('l'), ...FIST('r'), pelvis: [16, 0, 0], spine_01: [5, 0, 0], spine_02: [6, 0, 0], spine_03: [8, 0, 0], clavicle_l: [0, 0, 8], clavicle_r: [0, 0, -8], neck_01: [4, 0, 0], neck_02: [4, 0, 0], head: [8, 0, 0] },
  move: [0, -0.07, -0.01],
};
/** Burst: up out of the crouch, the chest lifted, both arms flung wide and high, palms out. */
const NOVA_WIDE: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [-3, 0, 0], spine_01: [-1, 0, 0], spine_02: [-4, 0, 0], spine_03: [-8, 0, 0], clavicle_l: [0, 0, -6], clavicle_r: [0, 0, 6], neck_01: [-4, 0, 0], neck_02: [-3, 0, 0], head: [-8, 0, 0] },
  move: [0, -0.004, 0],
};
const NOVA_HELD: KeyPose = merge(NOVA_WIDE, { rot: { ...LOOSE('l'), ...LOOSE('r'), spine_03: [-4, 0, 0], clavicle_l: [0, 0, 0], clavicle_r: [0, 0, 0], head: [-3, 0, 0] }, move: [0, -0.012, 0] });
export const NOVA = castClip('cast-nova', NOVA_LENGTH, NOVA_RELEASE, [
  rest(0, 'stood'),
  { t: 0.42, pose: NOVA_LOW, ease: 'inOut', stage: 'key', name: 'gathered low', hands: { r: { at: [-0.05, 0.44, 0.2], way: [0, 1, 0.3], k: [0.6, -0.2, 0.6] }, l: { at: [0.05, 0.44, 0.2], way: [0, 1, 0.3], k: [-0.6, -0.2, 0.6] } } },
  { t: NOVA_RELEASE, pose: NOVA_WIDE, ease: 'out', stage: 'key', name: 'flung wide', hands: { r: { at: [-0.4, 0.93, 0.06], way: [0, 0, 1], k: [-0.8, 1, 0] }, l: { at: [0.4, 0.93, 0.06], way: [0, 0, 1], k: [0.8, 1, 0] } } },
  { t: 0.92, pose: NOVA_HELD, ease: 'inOut', name: 'held wide', hands: { r: { at: [-0.35, 0.84, 0.05], way: [0, 0, 1], k: [-1, 0.6, 0] }, l: { at: [0.35, 0.84, 0.05], way: [0, 0, 1], k: [1, 0.6, 0] } } },
  rest(NOVA_LENGTH, 'stood again'),
], ['r', 'l'], { lag: { head: 0.05 }, bodies: { woman: { add: HER_FEET, move: [1, 1.1, 1] } } });

/* ---- C6 ground ------------------------------------------------------------------------------------------------------ */
const GROUND_LENGTH = 1.7, GROUND_RELEASE = 0.65;
/** Raised: both hands over the head, palms forward, the chest and the head up. */
const GROUND_UP: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [-2, 0, 0], spine_02: [-3, 0, 0], spine_03: [-6, 0, 0], clavicle_l: [0, 0, -8], clavicle_r: [0, 0, 8], neck_01: [-4, 0, 0], neck_02: [-4, 0, 0], head: [-10, 0, 0] },
  move: [0, 0.002, -0.006],
};
/** Brought down: bowed from the hips and the knees, the hips back over the heels, both palms flat toward the ground ahead. */
const GROUND_DOWN: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [30, 0, 0], spine_01: [8, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [-8, 0, 0], neck_02: [-6, 0, 0], head: [2, 0, 0] },
  move: [0, -0.08, -0.03],
};
const GROUND_HELD: KeyPose = merge(GROUND_DOWN, { rot: { pelvis: [28, 0, 0], head: [0, 0, 0] }, move: [0, -0.076, -0.028] });
export const GROUND = castClip('cast-ground', GROUND_LENGTH, GROUND_RELEASE, [
  rest(0, 'stood'),
  { t: 0.45, pose: GROUND_UP, ease: 'inOut', stage: 'key', name: 'raised', hands: { r: { at: [-0.1, 1.1, 0.1], way: [1, 0, 0], k: [0, 1, 0.2] }, l: { at: [0.1, 1.1, 0.1], way: [-1, 0, 0], k: [0, 1, 0.2] } } },
  { t: GROUND_RELEASE, pose: GROUND_DOWN, ease: 'in', stage: 'key', name: 'brought down', hands: { r: { at: [-0.1, 0.34, 0.36], way: [1, 0, 0], k: [0, -0.3, 1] }, l: { at: [0.1, 0.34, 0.36], way: [-1, 0, 0], k: [0, -0.3, 1] } } },
  { t: 1.05, pose: GROUND_HELD, ease: 'inOut', name: 'held down', hands: { r: { at: [-0.1, 0.35, 0.35], way: [1, 0, 0], k: [0, -0.3, 1] }, l: { at: [0.1, 0.35, 0.35], way: [-1, 0, 0], k: [0, -0.3, 1] } } },
  rest(GROUND_LENGTH, 'stood again'),
], ['r', 'l'], { lag: { head: 0.05, spine_03: 0.02 } });

/* ---- C7 command ----------------------------------------------------------------------------------------------------- */
const COMMAND_LENGTH = 1.2, COMMAND_RELEASE = 0.5;
/** Raised: the right hand up beside the head, palm forward, the left fist on the hip, the chest up. */
const COMMAND_UP: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('r'), ...FIST('l'), pelvis: [0, -4, 0], spine_02: [-2, -4, 0], spine_03: [-4, -4, 0], clavicle_r: [0, 0, 6], neck_01: [0, 4, 0], head: [-4, 2, 0] },
  move: [-0.004, -0.008, -0.008],
};
/** Sent: the right arm chopped down and forward at the target, the hand flat, leant after it. */
const COMMAND_SENT: KeyPose = {
  rot: { ...ELBOWS, ...hand('r', -6, -2, 0), ...FIST('l'), pelvis: [5, 6, 0], spine_01: [2, 2, 0], spine_02: [5, 4, 0], spine_03: [7, 4, 0], neck_01: [-6, -4, 0], neck_02: [-3, -2, 0], head: [-3, -3, 0] },
  move: [0.004, -0.014, 0.016],
};
const COMMAND_HELD: KeyPose = merge(COMMAND_SENT, { rot: { spine_03: [5, 3, 0] }, move: [0.003, -0.012, 0.013] });
const HIP_FIST: HandAt = { at: [0.17, 0.56, 0.0], way: [0, 0, 1], k: [0.3, -1, 0] };
export const COMMAND = castClip('cast-command', COMMAND_LENGTH, COMMAND_RELEASE, [
  rest(0, 'stood'),
  { t: 0.36, pose: COMMAND_UP, ease: 'inOut', stage: 'key', name: 'raised', hands: { r: { at: [-0.17, 1.0, 0.04], way: [1, 0, 0], k: [0, 1, 0.1] }, l: HIP_FIST } },
  { t: COMMAND_RELEASE, pose: COMMAND_SENT, ease: 'out', stage: 'key', name: 'sent', hands: { r: { at: [-0.05, 0.74, 0.43], way: [0, 1, 0], k: [0, -0.3, 1] }, l: HIP_FIST } },
  { t: 0.82, pose: COMMAND_HELD, ease: 'inOut', name: 'held on it', hands: { r: { at: [-0.05, 0.71, 0.41], way: [0, 1, 0], k: [0, -0.35, 1] }, l: HIP_FIST } },
  rest(COMMAND_LENGTH, 'stood again'),
], ['r'], { lag: { head: 0.04 } });

/* ---- C8 pray -------------------------------------------------------------------------------------------------------- */
const PRAY_LENGTH = 1.7, PRAY_RELEASE = 0.65;
/** Asked: palms together before the chest, the head bowed over them, the knees given. */
const PRAY_IN: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [3, 0, 0], spine_02: [3, 0, 0], spine_03: [5, 0, 0], neck_01: [10, 0, 0], neck_02: [8, 0, 0], head: [16, 0, 0] },
  move: [0, -0.018, 0],
};
/** Lifted: both hands raised over the head, palms forward, the head and the chest up. */
const PRAY_UP: KeyPose = {
  rot: { ...ELBOWS, ...OPEN('l'), ...OPEN('r'), pelvis: [-2, 0, 0], spine_02: [-3, 0, 0], spine_03: [-6, 0, 0], clavicle_l: [0, 0, -8], clavicle_r: [0, 0, 8], neck_01: [-6, 0, 0], neck_02: [-5, 0, 0], head: [-12, 0, 0] },
  move: [0, 0, 0],
};
const PRAY_HELD: KeyPose = merge(PRAY_UP, { rot: { ...LOOSE('l'), ...LOOSE('r'), head: [-8, 0, 0] }, move: [0, -0.004, 0] });
export const PRAY = castClip('cast-pray', PRAY_LENGTH, PRAY_RELEASE, [
  rest(0, 'stood'),
  { t: 0.46, pose: PRAY_IN, ease: 'inOut', stage: 'key', name: 'palms together', hands: { r: { at: [-0.012, 0.75, 0.16], way: [0, 0, -1], k: [0, 1, 0.25] }, l: { at: [0.012, 0.75, 0.16], way: [0, 0, -1], k: [0, 1, 0.25] } } },
  { t: PRAY_RELEASE, pose: PRAY_UP, ease: 'out', stage: 'key', name: 'lifted', hands: { r: { at: [-0.15, 1.07, 0.13], way: [1, 0, 0], k: [-0.2, 1, 0.1] }, l: { at: [0.15, 1.07, 0.13], way: [-1, 0, 0], k: [0.2, 1, 0.1] } } },
  { t: 1.1, pose: PRAY_HELD, ease: 'inOut', name: 'held up', hands: { r: { at: [-0.16, 1.02, 0.12], way: [1, 0, 0], k: [-0.3, 1, 0.1] }, l: { at: [0.16, 1.02, 0.12], way: [-1, 0, 0], k: [0.3, 1, 0.1] } } },
  rest(PRAY_LENGTH, 'stood again'),
], ['r', 'l'], { lag: { head: 0.06 } });

/* ---- C9 throw ------------------------------------------------------------------------------------------------------- */
const THROW_LENGTH = 1.3, THROW_RELEASE = 0.55;
/** Cocked: the weight back onto the right foot, the trunk turned right and leant back, the left arm out at the target. */
const THROW_BACK: KeyPose = {
  rot: { ...ELBOWS, ...FIST('r'), ...hand('l', -4, 0, 0), pelvis: [-2, -20, 2], spine_01: [-1, -6, 0], spine_02: [-3, -10, 0], spine_03: [-5, -10, -3], neck_01: [0, 14, 0], neck_02: [0, 10, 0], head: [2, 12, 3] },
  move: [-0.014, -0.024, -0.02],
};
/** Thrown: turned through onto the left foot, leant over after the arm. */
const THROW_OUT: KeyPose = {
  rot: { ...ELBOWS, ...FIST('r'), ...FIST('l'), pelvis: [6, 16, -2], spine_01: [3, 5, 0], spine_02: [6, 9, 0], spine_03: [8, 9, 2], neck_01: [-6, -8, 0], neck_02: [-3, -6, 0], head: [-2, -8, -2] },
  move: [0.012, -0.022, 0.022],
};
const THROW_AFTER: KeyPose = merge(THROW_OUT, { rot: { pelvis: [8, 18, -2], spine_02: [8, 10, 0], spine_03: [10, 10, 2] }, move: [0.014, -0.026, 0.026] });
const THROW_FIST = (at: Euler, way: Euler): HandAt => ({ at, way, k: [0, 1, 0] });
/** The weapon held upright at the side, as it is taken off the back and as it is put back. */
const THROW_REST = (t: number, name: string): CastBeat => ({ ...rest(t, name), hands: { l: REST.l, r: { at: [-0.17, 0.5, 0.1], way: [-0.25, 1, 0.35], k: [0, -0.3, 1] } } });
export const THROW = castClip('cast-throw', THROW_LENGTH, THROW_RELEASE, [
  THROW_REST(0, 'stood'),
  { t: 0.42, pose: THROW_BACK, ease: 'inOut', stage: 'key', name: 'cocked', hands: { r: THROW_FIST([-0.17, 0.95, -0.12], [0, 0.25, 1]), l: { at: [0.06, 0.83, 0.36], way: [0, 1, 0], k: [0, 0, 1] } } },
  { t: THROW_RELEASE, pose: THROW_OUT, ease: 'out', stage: 'key', name: 'thrown', hands: { r: THROW_FIST([-0.05, 0.88, 0.38], [0, -0.1, 1]), l: { at: [0.15, 0.62, 0.05], way: [0, 0.4, 1], k: [0, 0, 1] } } },
  { t: 0.8, pose: THROW_AFTER, ease: 'inOut', name: 'followed through', hands: { r: THROW_FIST([0.04, 0.62, 0.32], [0, -0.6, 1]), l: { at: [0.15, 0.6, 0.04], way: [0, 0.4, 1], k: [0, 0, 1] } } },
  THROW_REST(THROW_LENGTH, 'stood again'),
], ['r'], { lag: { head: 0.05, spine_03: 0.02 }, tools: { r: 'javelin' } });

/** The clip each way of casting plays, of those cast with the hands alone (`castKindClip`). */
export const CAST_OF_KIND: Readonly<Partial<Record<CastKind, string>>> = {
  bolt: BOLT.name, curse: CURSE.name, buff: WARD.name, ally: ALLY.name, nova: NOVA.name, ground: GROUND.name, command: COMMAND.name, pray: PRAY.name, throw: THROW.name,
};

/** Every clip here and its mirror, by name (`../index.ts` CLIPS, LEFT_OF). */
const ALL = [BOLT, CURSE, WARD, ALLY, NOVA, GROUND, COMMAND, PRAY, THROW];
export const CAST_CLIPS: Record<string, Clip> = Object.fromEntries(ALL.flatMap((c) => [[c.name, c], [`${c.name}-left`, mirrorClip(c, `${c.name}-left`)]]));
export const CAST_LEFT: Record<string, string> = Object.fromEntries(ALL.map((c) => [c.name, `${c.name}-left`]));
/** The facings a cast is made left-handed from: those that turn the right side away from whoever is looking. */
export const CAST_LEFT_FACINGS: Record<string, readonly number[]> = Object.fromEntries(ALL.map((c) => [c.name, [5, 6, 7]]));

/** When a clip lets its spell go, seconds: its release (`RELEASE_EVENT`), a blow's impact, a bow's loose, a tool's strike. */
export function releaseOf(c: Clip): number {
  const e = c.events?.find((x) => x.name === RELEASE_EVENT) ?? c.events?.find((x) => x.name === 'impact') ?? c.events?.find((x) => x.name === 'loose');
  return e?.t ?? c.strike?.t ?? c.length / 2;
}
/**
 * A clip's time `share` of the way through a cast that lets its spell go at `release` of the way (`CastTiming.release`): the
 * charge stretched or squeezed to the spell's wind-up and the rest to its recovery, so the clip's release (`releaseOf`) falls
 * on the spell's own.
 */
export function castTime(c: Clip, share: number, release: number): number {
  const u = Math.max(0, Math.min(1, share)), r = Math.max(0.01, Math.min(0.99, release)), R = releaseOf(c);
  return u <= r ? (u / r) * R : R + ((u - r) / (1 - r)) * (c.length - R);
}
