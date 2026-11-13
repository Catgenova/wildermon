/**
 * The emotes (`../../../game/emotes.ts`), each played once over its own length, its time the emote's (`FigurePose.emoteT`,
 * `../index.ts` clipFor): E1, the wave, made with the right arm (`WAVE`; the left's its mirror); E2, the hop (`HOP`); and
 * E3, the nod made in place of a wave with both hands full (`NOD`), as the flat figure makes it (`../../../render/figure.ts`
 * wave, hop, nod). Each is keyed by sampling its own timing from the game's (`emotePose`, `waveUp`, `HOPS`) every
 * `STEP` seconds, so it cannot drift from the flat figure's: every key a blend of the key poses below by how far through
 * each beat the emote is. Each starts and ends stood as the idle stands, the arms hanging, so it fades in from the idle and
 * out to it (`../index.ts` animate) without a jump.
 */
import type { Clip, FootKeys, Key } from '../clip';
import type { Euler } from '../math';
import { EMOTE_BY_ID, HOPS, emotePose, waveUp } from '../../../game/emotes';

/** Seconds between the sampled keys. */
const STEP = 1 / 30;
/** Smoothstep, clamped. */
const smooth = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
/** Of the way from a to b, clamped, smoothed. */
const step = (x: number, a: number, b: number): number => smooth((x - a) / (b - a));

type Pose = Record<string, Euler>;
/** Euler turns added up, each weighted: Σ w·pose. */
function sum(...parts: Array<[Pose, number]>): Pose {
  const out: Pose = {};
  for (const [p, w] of parts) for (const [b, e] of Object.entries(p)) {
    const o = out[b] ?? [0, 0, 0];
    out[b] = [o[0] + e[0] * w, o[1] + e[1] * w, o[2] + e[2] * w];
  }
  return out;
}
/** b less a, bone by bone (a bone in either). */
function less(b: Pose, a: Pose): Pose {
  const out: Pose = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k] ?? [0, 0, 0], y = b[k] ?? [0, 0, 0]; out[k] = [y[0] - x[0], y[1] - x[1], y[2] - x[2]]; }
  return out;
}

/**
 * A clip of `length` seconds keyed every `STEP` from `at(k)` (k 0 to 1 of the way through): each bone's turn and the
 * body's shift, and for a clip that keys its feet where they are.
 */
function sampled(name: string, length: number, at: (k: number) => { rot: Pose; move?: Euler; feet?: { l: Foot; r: Foot } }): Pick<Clip, 'tracks' | 'move' | 'feet'> & { name: string } {
  const n = Math.max(2, Math.round(length / STEP)), tracks: Record<string, Array<Key<Euler>>> = {}, move: Array<Key<Euler>> = [];
  const feet = { l: { z: [], lift: [], pitch: [] } as FootKeys, r: { z: [], lift: [], pitch: [] } as FootKeys };
  let keyed = false;
  for (let i = 0; i <= n; i++) {
    const k = i / n, t = +(k * length).toFixed(4), p = at(k);
    for (const [b, e] of Object.entries(p.rot)) (tracks[b] ??= []).push({ t, v: e.map((x) => +x.toFixed(2)) as Euler, ease: 'linear' });
    move.push({ t, v: (p.move ?? [0, 0, 0]).map((x) => +x.toFixed(4)) as Euler, ease: 'linear' });
    if (p.feet) {
      keyed = true;
      for (const s of ['l', 'r'] as const) for (const ch of ['z', 'lift', 'pitch'] as const) feet[s][ch].push({ t, v: +p.feet[s][ch].toFixed(4), ease: 'linear' });
    }
  }
  return { name, tracks, move, ...(keyed ? { feet: { stride: 0, ...feet } } : {}) };
}
type Foot = { z: number; lift: number; pitch: number };

/** Stood as the idle stands: feet a little apart and turned out, flat; hers closer together (`./idle.ts`). */
const STANCE: Clip['plant'] = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
/** Her stance's narrower feet, as the idle's. */
const HER_STANCE: Pose = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };

/** The arms hanging, the hands loose (the idle's, `./idle.ts` ARMS), each a little out from the side: kept off the hips by hand, these clips keying their arms free (`Clip.armsFree`). */
const HANG: Pose = {
  upperarm_l: [-2, 0, 7], upperarm_r: [-2, 0, -7],
  lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0],
  hand_l: [0, -50, 0], hand_r: [0, 50, 0],
  fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0],
  fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
};

/* ---- E1, the wave ------------------------------------------------------------------------------------------------- */

/** Seconds a wave runs: the game's. */
const WAVE_LENGTH = EMOTE_BY_ID.get('wave')?.seconds ?? 1.9;
/**
 * The right arm raised, solved on him in the chest's frame, staged as the flat figure stages it for whoever is looking
 * (`../../../render/figure.ts` WAVE_ROUND): `SIDE`, seen from in front, behind or three-quarters on, the upper arm out to
 * the side 10 degrees behind straight out, so the hand is clear of the head and the palm is seen three-quarters on, and 15
 * above level (the elbow over the shoulder, as the flat figure's 102-degree raise), the shoulder lifted 8; the forearm
 * upright, leaning 10 degrees out (`mid`), 27 out at a swing out, 12 in toward the head at a swing in, the hand open
 * along it, the palm forward and turned 24 degrees out. `AHEAD`, seen side on: the upper arm 60 degrees forward of
 * straight out and 10 above level, so the hand is up ahead of the face rather than behind the head; the forearm upright,
 * swung forward and back (the swing seen side on), the palm turned 27 degrees in, toward whoever is on that side.
 */
interface Staging { mid: Pose; out: Pose; in: Pose }
const SIDE: Staging = {
  mid: { clavicle_r: [0, 0, -8], upperarm_r: [-9.5, 91.7, -79.7], lowerarm_r: [57.9, -0.7, -9.1], hand_r: [4.3, 70.4, 4.7] },
  out: { clavicle_r: [0, 0, -8], upperarm_r: [-9.5, 87.6, -79.7], lowerarm_r: [41.3, -0.5, -9.3], hand_r: [4.3, 76.2, 4.7] },
  in: { clavicle_r: [0, 0, -8], upperarm_r: [-9.5, 95.6, -79.7], lowerarm_r: [78.9, -1.9, -7.8], hand_r: [4.3, 67.8, 4.7] },
};
const AHEAD: Staging = {
  mid: { clavicle_r: [0, 0, -8], upperarm_r: [57.7, 120.9, -94.7], lowerarm_r: [63.1, -0.8, -8.9], hand_r: [4.3, 49, 4.7] },
  out: { clavicle_r: [0, 0, -8], upperarm_r: [57.7, 113.6, -94.7], lowerarm_r: [44.5, -0.5, -9.3], hand_r: [4.3, 55, 4.7] },
  in: { clavicle_r: [0, 0, -8], upperarm_r: [57.7, 126.9, -94.7], lowerarm_r: [78.4, -1.8, -7.9], hand_r: [4.3, 48.3, 4.7] },
};
/** The waving hand open: the fingers and thumb straight. */
const OPEN: Pose = { fingers_01_r: [0, 0, 0], fingers_02_r: [0, 0, 0], thumb_01_r: [0, 0, 0] };
/**
 * Raised, the body leant away from the arm onto the other foot: the hips over the left foot, the trunk tilted left, the
 * head tilted toward the arm and lifted a little.
 */
const LEAN: Pose = { pelvis: [0, 0, -1.5], spine_01: [0, 0, 1], spine_02: [0, 0, 2], spine_03: [0, 0, 2.5], neck_01: [0, 0, -2], head: [-3, 0, -4] };
const LEAN_MOVE: Euler = [0.008, 0, 0];
/** Each swing out rocks the trunk after it (and a swing in back), degrees a whole swing. */
const ROCK: Pose = { spine_02: [0, 0, -0.8], spine_03: [0, 0, -1.2] };
/** The elbow bent ahead of the raise, so the hand comes up near the body and over the elbow: the forearm folded this far further while the upper arm is still low. */
const FOLD: Euler = [40, 0, 0];
/** Seconds the hand trails the forearm's swing, and how far it is flapped for a whole swing of lead (degrees, in the palm's plane). */
const FLAP_LAG = 0.06;
const FLAP: Euler = [-18, 0, -10];

/** How far up the arm is, eased, `k` of the way through the wave (the game's `waveUp`). */
export const waveRaise = (k: number): number => smooth(waveUp(k));
/** The wave's swings (the game's `emotePose` wave, three out and in), each at its furthest, shares of the wave: a twelfth in, then every sixth. */
const SWINGS = Array.from({ length: 6 }, (_, i) => 1 / 12 + i / 6);

/** The wave with the right arm, staged as `st` says. */
function wave(name: string, st: Staging): Clip {
  const arm = less(st.mid, HANG), out = less(st.out, st.mid), inward = less(st.in, st.mid);
  return {
    ...sampled(name, WAVE_LENGTH, (k) => {
      const r = waveRaise(k), s = emotePose('wave', k).wave;
      // the elbow first: bent toward its raised bend ahead of the upper arm, and a little past it while the upper arm is low
      const el = smooth(Math.min(1, 1.8 * waveUp(k))), fold = Math.max(0, el - r);
      // the hand flapped after the forearm: by how far the swing has gone on since it was where the hand is
      const lag = s - emotePose('wave', k - FLAP_LAG / WAVE_LENGTH).wave;
      const rot = sum(
        [HANG, 1],
        [{ clavicle_r: arm.clavicle_r, upperarm_r: arm.upperarm_r, hand_r: arm.hand_r }, r],
        [{ lowerarm_r: arm.lowerarm_r }, el],
        [out, Math.max(0, s)],
        [inward, Math.max(0, -s)],
        [{ lowerarm_r: FOLD }, fold],
        [{ hand_r: FLAP }, lag],
        [less(OPEN, HANG), smooth(Math.min(1, 2.5 * waveUp(k)))],
        [LEAN, r],
        [ROCK, s * r],
      );
      return { rot, move: [LEAN_MOVE[0] * r, 0, 0] };
    }),
    loop: false,
    length: WAVE_LENGTH,
    mask: 'full',
    plant: STANCE,
    armsFree: true,
    poses: [
      { t: 0, name: 'stood' }, { t: +(0.1 * WAVE_LENGTH).toFixed(3), name: 'rising' },
      ...SWINGS.map((k, i) => ({ t: +(k * WAVE_LENGTH).toFixed(3), name: i % 2 ? 'swung in' : 'swung out' })),
      { t: +(0.9 * WAVE_LENGTH).toFixed(3), name: 'lowering' }, { t: WAVE_LENGTH, name: 'stood' },
    ],
    bodies: { woman: { add: HER_STANCE } },
  };
}
/** E1, the wave with the right arm, seen from in front, behind or three-quarters on. */
export const WAVE = wave('wave', SIDE);
/** And seen side on. */
export const WAVE_AHEAD = wave('wave-ahead', AHEAD);

/* ---- E3, the nod: a wave with both hands full ----------------------------------------------------------------------- */

/** The head and chest bowed at the deepest of the nod, degrees, as the flat figure's (`nod`). */
const BOW: Pose = { spine_03: [5, 0, 0], neck_01: [7, 0, 0], head: [16, 0, 0] };
/** Held up before and after the nod: the head lifted a little. */
const HEAD_UP: Pose = { head: [-2, 0, 0] };

export const NOD: Clip = {
  ...sampled('nod', WAVE_LENGTH, (k) => {
    const held = step(k, 0.05, 0.25) * (1 - step(k, 0.72, 0.95)), dip = Math.sin(Math.PI * step(k, 0.22, 0.62)) ** 2;
    return { rot: sum([HANG, 1], [HEAD_UP, held], [BOW, dip]) };
  }),
  loop: false,
  length: WAVE_LENGTH,
  mask: 'full',
  plant: STANCE,
  armsFree: true,
  poses: [{ t: 0, name: 'stood' }, { t: +(0.42 * WAVE_LENGTH).toFixed(3), name: 'bowed' }, { t: WAVE_LENGTH, name: 'stood' }],
  bodies: { woman: { add: HER_STANCE } },
};

/* ---- E2, the hop -------------------------------------------------------------------------------------------------- */

/** Seconds a hop runs: the game's. */
const HOP_LENGTH = EMOTE_BY_ID.get('hop')?.seconds ?? 1.5;
const [ONE, TWO] = HOPS;
/** When the crouch before the first hop is deepest, and how long after each landing its own is: shares of the hop. */
const LOAD = ONE.off * (5 / 7), LAND = 0.08;
/** How deep each landing's crouch is, of the first crouch's. */
const LANDS = [0.9, 0.7];
/** The sine's quarter from a to b, clamped: fast out of a, slowing into b. */
const quarter = (x: number, a: number, b: number): number => Math.sin((Math.PI / 2) * Math.max(0, Math.min(1, (x - a) / (b - a))));
/** How deep the crouch is at k (1: the first crouch's deepest), as the flat figure's (`hopPose` crouch). */
function crouch(k: number): number {
  const low = [ONE.on + LAND, TWO.on + LAND];
  if (k <= 0) return 0;
  if (k < LOAD) return smooth(k / LOAD);
  if (k < ONE.off) return 1 - quarter(k, LOAD, ONE.off);
  if (k >= ONE.on && k < low[0]) return LANDS[0] * quarter(k, ONE.on, low[0]);
  if (k >= low[0] && k < TWO.off) return LANDS[0] * (1 - quarter(k, low[0], TWO.off));
  if (k >= TWO.on && k < low[1]) return LANDS[1] * quarter(k, TWO.on, low[1]);
  if (k >= low[1]) return LANDS[1] * (1 - smooth((k - low[1]) / (1 - low[1])));
  return 0;
}
/** How far each hop's leap is through (0 to 1) at k, and which hop, or none on the ground. */
export function hopAir(k: number): { i: number; u: number } | undefined {
  for (const [i, h] of HOPS.entries()) if (k > h.off && k < h.on) return { i, u: (k - h.off) / (h.on - h.off) };
  return undefined;
}
/** Up on the toes as the legs drive up out of each crouch, 0 to 1. */
function push(k: number): number {
  const low = ONE.on + LAND;
  if (k >= LOAD && k < ONE.off) return quarter(k, LOAD, ONE.off);
  if (k >= low && k < TWO.off) return quarter(k, low, TWO.off);
  return 0;
}

/** At the deepest of the first crouch: the hips down and back, the trunk leant over the knees, the head kept up. */
const CROUCH: Pose = { pelvis: [16, 0, 0], spine_01: [7, 0, 0], spine_02: [9, 0, 0], spine_03: [6, 0, 0], neck_01: [-11, 0, 0], neck_02: [-7, 0, 0], head: [-13, 0, 0] };
const CROUCH_MOVE: Euler = [0, -0.085, -0.03];
/** Driven up off the toes: the hips risen with the legs straight, the trunk up. */
const PUSH_MOVE: Euler = [0, 0.012, 0.005];
/** In the air: the trunk curled a little over the knees drawn up, the chest turned toward the left arm out. */
const TUCK: Pose = { spine_02: [6, 0, 0], neck_01: [-4, 0, 0], spine_03: [0, 6, 0], pelvis: [0, -3, 0] };
/** How far the feet are drawn up in the air (body heights), the back one less and later; the toes pointed, degrees. */
const TUCK_LIFT = 0.1, TRAIL = 0.8, TRAIL_LAG = 0.05, POINT = -26;
/**
 * The arms: forward and up from hanging (`UP`, 1), back (`BACK`), out to the side (`WIDE`): the left's; the right goes
 * through the same `ARM_LAG` behind and `RIGHT_SIZE` as far.
 */
const UP: Pose = { upperarm_l: [62, 0, 6], lowerarm_l: [30, 0, 0] };
const BACK: Pose = { upperarm_l: [-38, 0, 4], lowerarm_l: [14, 0, 0] };
const WIDE: Pose = { upperarm_l: [8, 0, 40], lowerarm_l: [32, 0, 0], clavicle_l: [0, 0, 4] };
const ARM_LAG = 0.05, RIGHT_SIZE = 0.85;
/** The arms through the hop, [k, forward (+1 up, -1 back), out], at times read off the hops. */
const ARMS: Array<[number, number, number]> = [
  [0, 0, 0],
  [LOAD, -1, 0.1],
  [ONE.off + 0.02, 0.9, 0.2],
  [(ONE.off + ONE.on) / 2, 0.35, 0.85],
  [ONE.on, 0.3, 0.45],
  [ONE.on + LAND, -0.6, 0.2],
  [TWO.off + 0.02, 0.7, 0.2],
  [(TWO.off + TWO.on) / 2, 0.3, 0.6],
  [TWO.on, 0.25, 0.3],
  [TWO.on + LAND, 0.15, 0.15],
  [1, 0, 0],
];
/** The arms' [forward, out] at k, eased key to key. */
function armsAt(k: number): [number, number] {
  const x = Math.max(0, Math.min(1, k));
  let i = 0;
  while (i < ARMS.length - 2 && x > ARMS[i + 1][0]) i++;
  const a = ARMS[i], b = ARMS[i + 1], w = smooth((x - a[0]) / (b[0] - a[0]));
  return [a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
}
/** The left arm's pose for [forward, out]; mirrored for the right. */
const armOf = ([f, o]: [number, number], size: number): Pose => sum([UP, Math.max(0, f) * size], [BACK, Math.max(0, -f) * size], [WIDE, o * size]);
const toRight = (p: Pose): Pose => Object.fromEntries(Object.entries(p).map(([b, e]) => [b.replace(/_l$/, '_r'), [e[0], -e[1], -e[2]] as Euler]));
/** How far the knees are drawn up at k, of all the way (0 on the ground): up through the rise, let down to reach for the ground. */
const tuckAt = (k: number): number => { const a = hopAir(k); return a ? (a.i ? 0.55 : 1) * Math.sin(Math.PI * Math.min(1, a.u / 0.85)) ** 2 : 0; };
/** The toes: pointed down off the ground and through the air, put down toe first. */
function toeAt(k: number): number {
  const a = hopAir(k);
  if (a) return POINT * (1 - 0.8 * smooth(a.u));
  for (const h of HOPS) if (k >= h.on && k < h.on + 0.03) return 0.2 * POINT * (1 - (k - h.on) / 0.03);
  return POINT * push(k);
}

export const HOP: Clip = {
  ...sampled('hop', HOP_LENGTH, (k) => {
    const c = crouch(k), p = push(k), a = hopAir(k), air = a ? Math.sin(Math.PI * a.u) : 0;
    const tucks = [tuckAt(k), TRAIL * tuckAt(k - TRAIL_LAG)], toe = toeAt(k);
    const rot = sum(
      [HANG, 1],
      [armOf(armsAt(k), 1), 1],
      [toRight(armOf(armsAt(k - ARM_LAG), RIGHT_SIZE)), 1],
      [CROUCH, c],
      [TUCK, air],
    );
    const foot = (s: 0 | 1): Foot => ({ z: 0, lift: TUCK_LIFT * tucks[s], pitch: toe });
    return {
      rot,
      move: [0, CROUCH_MOVE[1] * c + PUSH_MOVE[1] * p, CROUCH_MOVE[2] * c + PUSH_MOVE[2] * p],
      feet: { l: foot(0), r: foot(1) },
    };
  }),
  loop: false,
  length: HOP_LENGTH,
  mask: 'full',
  plant: STANCE,
  armsFree: true,
  poses: [0, LOAD, ONE.off, (ONE.off + ONE.on) / 2, ONE.on + LAND, TWO.off, (TWO.off + TWO.on) / 2, TWO.on + LAND, 1].map((k, i) => ({ t: +(k * HOP_LENGTH).toFixed(3), name: ['stood', 'crouched', 'off', 'tucked', 'landed', 'off again', 'tucked', 'landed', 'stood'][i] })),
  bodies: { woman: { add: HER_STANCE } },
};
