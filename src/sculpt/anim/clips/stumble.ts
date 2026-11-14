/**
 * H2, a heavy blow landing (`FigurePose.heavy`: the island's `player.hurt_heavy`, a creature's blow drawn back for and
 * landed at `HEAVY_HIT` times its weight): a stumble back of `STUMBLE_SECS` in place of the flinch (`./flinch.ts`), added
 * over whatever the body is playing as the flinch is, turned away from where the blow came from (`FigurePose.flinch.from`).
 *
 *   - the blow: the chest knocked back hard, the head snapped back, the arms flung out to the sides, the knees giving;
 *   - the stumble: the body carried on back, a foot (the one on the side it is knocked toward, the right from straight
 *     ahead) lifted and stepped back under it;
 *   - caught: the foot down behind, the hips let down over it, the trunk brought forward again;
 *   - recovered: the foot stepped in to where it stood, the body upright.
 *
 * On a clip stood on its feet (`stood`, as the flinch's) the stepping foot is put where the stumble says and the other
 * kept where it stood, the knees bent to reach; on any other (a walk, a swing that keys its own feet) only the trunk, the
 * arms and the head stumble.
 */
import type { FigurePose } from '../../../render/figure';
import { sampleClip, sampleKey, type Clip, type Key } from '../clip';
import { poseToPose, type Beat, type KeyPose } from '../author';
import { add, QI, qmat, qmul, quat, scl, type M3, type Q, type V } from '../math';
import type { Skeleton } from '../skeleton';
import { STUMBLE_SECS } from '../../../game/fight';

type Local = { local: Array<M3 | undefined>; move: V; wet?: number };

const LENGTH = STUMBLE_SECS;
const REST: KeyPose = { rot: {}, move: [0, 0, 0] };
/** Knocked back: the chest and head thrown back, the arms flung out to the sides, the knees giving. */
const BLOW: KeyPose = {
  rot: {
    spine_01: [-6, 0, 0], spine_02: [-12, 0, 0], spine_03: [-14, 0, 0], neck_01: [-6, 0, 0], neck_02: [-4, 0, 0], head: [-20, 0, 0],
    clavicle_l: [0, 0, 10], clavicle_r: [0, 0, -10], upperarm_l: [-6, 0, 38], upperarm_r: [-4, 0, -34], lowerarm_l: [30, 0, 0], lowerarm_r: [26, 0, 0],
  },
  move: [0, -0.02, -0.05],
};
/** Carried on back, a foot up on its way back under the body. */
const STEP: KeyPose = {
  rot: {
    spine_01: [-4, 0, 0], spine_02: [-9, 0, 0], spine_03: [-10, 0, 0], neck_01: [-2, 0, 0], head: [-8, 0, 0],
    clavicle_l: [0, 0, 8], clavicle_r: [0, 0, -8], upperarm_l: [8, 0, 48], upperarm_r: [6, 0, -44], lowerarm_l: [36, 0, 0], lowerarm_r: [32, 0, 0],
  },
  move: [0, -0.01, -0.1],
};
/** Caught on the foot behind: the hips let down over it, the trunk brought forward, the arms coming down. */
const CAUGHT: KeyPose = {
  rot: {
    pelvis: [4, 0, 0], spine_01: [3, 0, 0], spine_02: [5, 0, 0], spine_03: [4, 0, 0], neck_01: [3, 0, 0], head: [6, 0, 0],
    upperarm_l: [10, 0, 22], upperarm_r: [8, 0, -20], lowerarm_l: [22, 0, 0], lowerarm_r: [20, 0, 0],
  },
  move: [0, -0.04, -0.12],
};
/** Stepping back in. */
const IN: KeyPose = { rot: { spine_02: [2, 0, 0], spine_03: [2, 0, 0], upperarm_l: [4, 0, 6], upperarm_r: [4, 0, -5], lowerarm_l: [8, 0, 0], lowerarm_r: [8, 0, 0] }, move: [0, -0.015, -0.05] };
const BEATS: Beat[] = [
  { t: 0, pose: REST, ease: 'inOut', stage: 'key', name: 'rest' },
  { t: 0.07, pose: BLOW, ease: 'out', stage: 'key', name: 'struck' },
  { t: 0.3, pose: STEP, ease: 'inOut', name: 'stumbling' },
  { t: 0.5, pose: CAUGHT, ease: 'out', stage: 'key', name: 'caught' },
  { t: 0.8, pose: IN, ease: 'inOut', name: 'stepping in' },
  { t: LENGTH, pose: REST, ease: 'inOut', stage: 'key', name: 'recovered' },
];
export const STUMBLE: Clip = { name: 'stumble', loop: false, length: LENGTH, mask: 'additive', ...poseToPose(BEATS, { length: LENGTH, loop: false }), events: [{ t: 0.07, name: 'impact' }] };
/** The stepping foot, body heights: how far back of where it stood, and up off the ground. */
const BACK: Array<Key<number>> = [{ t: 0, v: 0 }, { t: 0.12, v: 0 }, { t: 0.3, v: 0.09, ease: 'inOut' }, { t: 0.42, v: 0.17, ease: 'out' }, { t: 0.62, v: 0.17 }, { t: 0.95, v: 0, ease: 'inOut' }, { t: LENGTH, v: 0 }];
const LIFT: Array<Key<number>> = [{ t: 0, v: 0 }, { t: 0.12, v: 0 }, { t: 0.27, v: 0.06, ease: 'out' }, { t: 0.42, v: 0, ease: 'in' }, { t: 0.62, v: 0 }, { t: 0.78, v: 0.04, ease: 'out' }, { t: 0.95, v: 0, ease: 'in' }, { t: LENGTH, v: 0 }];

/** Whether a pose is part way through a heavy blow's stumble. */
export const stumbling = (pose: FigurePose): boolean => !!pose.heavy && !!pose.flinch && pose.flinch.t >= 0 && pose.flinch.t < 1 && !pose.swimming && !pose.driving && pose.down === undefined;
/** The bones the stumble turns away from where the blow came from: the trunk, the neck and the head. */
const TRUNK = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'neck_02', 'head']);
const LEGS = /^(thigh|calf|foot|ball)_[lr]$/;

/** The stumble laid over what a body is drawn with (`base`), `pose.flinch.t` of the way through it. */
export function stumbleOver(sk: Skeleton, base: Local, pose: FigurePose, stood: boolean): Local {
  const f = pose.flinch as NonNullable<FigurePose['flinch']>, t = Math.min(1, Math.max(0, f.t)) * LENGTH, s = sampleClip(STUMBLE, t, sk.body);
  const a = f.from ?? 0, ca = Math.cos(a), sa = Math.sin(a);
  const q: Array<Q | undefined> = base.local.map((m) => (m ? quat(m) : undefined)), p: Array<Q | undefined> = [...q];
  for (const [bone, e] of Object.entries(s.rot)) {
    const i = sk.at.get(bone);
    if (i === undefined || LEGS.test(bone)) continue;
    // (a lean back from ahead; to the right from the left, as the flinch's)
    const r = TRUNK.has(bone) ? [e[0] * ca, e[1], e[2] - e[0] * sa] as [number, number, number] : e;
    p[i] = qmul(q[i] ?? QI, sk.local(i, r));
  }
  if (!stood) return { local: p.map((x, i) => (x ? qmat(x) : base.local[i])), move: base.move };
  // carried away from where the blow came from, and a foot stepped back under the body that way: the one on the side it goes
  const m = s.move, away: V = [-sa, 0, -ca], move: V = [m[0] + m[2] * sa, m[1], m[2] * ca];
  const plant = sk.plantOf({ q, move: base.move }), side = sa > 0.3 ? 1 : sa < -0.3 ? 0 : 1;
  const back = sampleKey(BACK, t, LENGTH, false) * sk.height, lift = sampleKey(LIFT, t, LENGTH, false) * sk.height;
  plant.at = [...plant.at] as [V, V];
  plant.at[side] = add(add(plant.at[side], scl(away, back)), [0, lift, 0]);
  plant.air = side === 0 ? [Math.min(1, lift / (0.01 * sk.height)), 0] : [0, Math.min(1, lift / (0.01 * sk.height))];
  return sk.finish({ q: p, move: add(base.move, scl(move, sk.height)) }, { plant, free: true });
}
