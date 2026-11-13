/**
 * H1, a blow landing on the body (`../index.ts` flinchOver), `FLINCH_SECS` long from the island's word
 * (`player.hurt_at`): added over whatever the body is playing (the idle, the walk, the fights, the shot, a block), never
 * taking anything from it. Authored for a blow from straight ahead; `../index.ts` turns the trunk's lean and the body's
 * shift away from wherever the blow came from (`FigurePose.flinch.from`), the arms and legs as keyed.
 *
 * By where it landed (`player.hurt_where`):
 *   - the head (`HEAD`): the head and neck snapped back, the shoulders hunched up, recovered with a nod;
 *   - the legs and feet (`LEGS`): the knees buckling under (the hips let down, the feet kept where they stand on a stood
 *     clip), the trunk bent over the leg, caught and stood up again;
 *   - anywhere else, or not said (`BODY`): the chest knocked back, the trunk folding a little round the blow, the head
 *     snapped back and recovered, the arms flung out, the knees dipping.
 */
import type { Clip } from '../clip';
import { poseToPose, type Beat, type KeyPose } from '../author';
import { FLINCH_SECS } from '../../../game/fight';

const LENGTH = FLINCH_SECS;
/** The blow's snap; the rebound past rest the other way; settled. */
const SNAP = 0.05, REBOUND = 0.15, SETTLE = 0.26;
/** The moment the blow lands, seconds in (the flat figure's jolt, `../../../render/figure.ts`). */
export const FLINCH_SNAP = SNAP;

const REST: KeyPose = { rot: {}, move: [0, 0, 0] };
const beats = (snap: KeyPose, rebound: KeyPose, settle: KeyPose): Beat[] => [
  { t: 0, pose: REST, ease: 'inOut', stage: 'key', name: 'rest' },
  { t: SNAP, pose: snap, ease: 'out', stage: 'key', name: 'snap' },
  { t: REBOUND, pose: rebound, ease: 'inOut', stage: 'key', name: 'rebound' },
  { t: SETTLE, pose: settle, ease: 'inOut', name: 'settling' },
  { t: LENGTH, pose: REST, ease: 'inOut', stage: 'key', name: 'recovered' },
];
const clipOf = (name: string, b: Beat[]): Clip => ({ name, loop: false, length: LENGTH, mask: 'additive', ...poseToPose(b, { length: LENGTH, loop: false }), events: [{ t: SNAP, name: 'impact' }] });

/** A blow to the body: the chest knocked back and the head with it, the arms flung, the knees dipping; then folded round it. */
export const BODY = clipOf('flinch', beats(
  { rot: { spine_01: [-2, 0, 0], spine_02: [-5, 0, 0], spine_03: [-7, 0, 0], neck_01: [-3, 0, 0], head: [-9, 0, 0],
    clavicle_l: [0, 0, 4], clavicle_r: [0, 0, -4], upperarm_l: [-10, 0, 8], upperarm_r: [-10, 0, -8], lowerarm_l: [10, 0, 0], lowerarm_r: [10, 0, 0] },
  move: [0, -0.01, -0.016] },
  { rot: { spine_01: [3, 0, 0], spine_02: [5, 0, 0], spine_03: [5, 0, 0], neck_01: [2, 0, 0], head: [5, 0, 0],
    clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 2], upperarm_l: [4, 0, 2], upperarm_r: [4, 0, -2], lowerarm_l: [6, 0, 0], lowerarm_r: [6, 0, 0] },
  move: [0, -0.012, -0.008] },
  { rot: { spine_02: [2, 0, 0], spine_03: [1, 0, 0], head: [1, 0, 0] }, move: [0, -0.004, -0.002] },
));
/** A blow to the head: the head and neck snapped back, the shoulders hunched up to it; recovered with a nod. */
export const HEAD = clipOf('flinch-head', beats(
  { rot: { spine_03: [-4, 0, 0], neck_01: [-8, 0, 0], neck_02: [-7, 0, 0], head: [-18, 0, 0],
    clavicle_l: [0, 0, 7], clavicle_r: [0, 0, -7], upperarm_l: [-4, 0, 6], upperarm_r: [-4, 0, -6] },
  move: [0, -0.006, -0.01] },
  { rot: { spine_03: [2, 0, 0], neck_01: [3, 0, 0], neck_02: [2, 0, 0], head: [7, 0, 0], clavicle_l: [0, 0, 3], clavicle_r: [0, 0, -3] },
    move: [0, -0.006, -0.004] },
  { rot: { head: [2, 0, 0] }, move: [0, -0.002, 0] },
));
/** A blow to the legs: the knees buckling (the hips let down), the trunk bent over them; caught and stood up again. */
export const LEGS = clipOf('flinch-legs', beats(
  { rot: { pelvis: [4, 0, 0], spine_01: [3, 0, 0], spine_02: [4, 0, 0], spine_03: [3, 0, 0], head: [-4, 0, 0],
    upperarm_l: [-6, 0, 10], upperarm_r: [-6, 0, -10] },
  move: [0, -0.03, -0.008] },
  { rot: { pelvis: [5, 0, 0], spine_01: [3, 0, 0], spine_02: [5, 0, 0], spine_03: [4, 0, 0], head: [-3, 0, 0],
    upperarm_l: [-2, 0, 6], upperarm_r: [-2, 0, -6] },
  move: [0, -0.036, -0.004] },
  { rot: { pelvis: [1, 0, 0], spine_02: [1, 0, 0] }, move: [0, -0.01, 0] },
));
/** The clip for where a blow landed (`player.hurt_where`). */
export const flinchClipOf = (where: string | undefined): Clip => (where === 'head' ? HEAD : where === 'legs' || where === 'feet' ? LEGS : BODY);
