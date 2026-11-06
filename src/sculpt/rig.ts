/**
 * The sculpt's skeleton: the figure's rig (`../render/figure`'s `Rig`, the
 * joint angles every poser there puts a body into) built into bone frames at
 * the sculpt's own proportions, and more joints over it than the figure has.
 *
 * The core is the figure's: pelvis, spine, chest, neck, head, and a shoulder,
 * elbow, wrist, hip, knee and ankle each side, composed exactly as
 * `skeleton()` in figure.ts composes them, so every pose -- a walk, a day's
 * work, a wave, a swim -- is the same pose on this body. Over it, driven from
 * the same rig rather than posed by hand:
 *
 *   - the spine in three (`spineA`, `spineB`, `chest`), the figure's one bend shared out;
 *   - a clavicle each side, raised with the arm and with a shrug;
 *   - a jaw, and a lid and a brow each side (a blink, a frown, a smile);
 *   - a thumb and a finger group per hand, each in two segments, curled by what the hand is doing;
 *   - the ball of each foot, bent as the heel lifts;
 *   - sway chains -- hair now, cloth later -- hung off a bone and swung by the rig's `tail`, each with its own stiffness.
 *
 * Proportions are parameters (`Proportions`): the reference's seven heads is
 * the default, the island's five kept for comparison. Both stand sixteen and
 * a half units to the crown, the height the island was drawn round.
 */
import { joint, place, ROOT, type Rig, type Xf, type Euler } from '../render/figure';
import { add, clamp, lerp, mul, sub, type V3 } from './sdf';

export interface Proportions {
  /** A name for the sheets. */
  id: string;
  /** Heads to the crown. */
  heads: number;
  /** Joint heights and lengths, in units: see `skeleton()` in figure.ts for the figure's. */
  hip: number; spine: number; chest: number; neck: number; headJ: number; armAt: number;
  upper: number; lower: number; thigh: number; shin: number;
  /** Half-width to a shoulder joint and to a hip joint. */
  shoulder: number; hipW: number;
  /** The head, chin to crown, and its half-width and half-depth. */
  head: number; headW: number; headD: number;
  /** The sole under the ankle, and the foot's length from the ankle forward. */
  sole: number; foot: number;
  /** Hand: palm length, and the fingers' length. */
  palm: number; finger: number;
  /** Radii: neck, upper arm, forearm, wrist, thigh, shin, ankle, chest half-width, waist half-width. */
  r: { neck: number; upper: number; fore: number; wrist: number; thigh: number; shin: number; ankle: number; chest: number; waist: number; pelvis: number };
}

/** The reference's build: seven heads to the crown, long legs, a real neck, a narrow waist. */
export const SEVEN: Proportions = {
  id: 'seven', heads: 7,
  hip: 8.4, spine: 1.4, chest: 2.2, neck: 1.6, headJ: 0.55, armAt: 1.3,
  upper: 3.3, lower: 2.7, thigh: 3.8, shin: 3.7,
  shoulder: 2.05, hipW: 0.95,
  head: 2.36, headW: 1.0, headD: 1.15,
  sole: 0.8, foot: 2.3,
  palm: 1.0, finger: 0.95,
  r: { neck: 0.5, upper: 0.52, fore: 0.44, wrist: 0.36, thigh: 0.72, shin: 0.5, ankle: 0.36, chest: 1.9, waist: 1.25, pelvis: 1.55 },
};

/** The island's build as it is drawn today: a head a quarter of the height, a long body over short sturdy legs. */
export const FIVE: Proportions = {
  id: 'five', heads: 4.6,
  hip: 7.25, spine: 1.1, chest: 1.8, neck: 2.12, headJ: 0.62, armAt: 1.66,
  upper: 2.8, lower: 2.4, thigh: 3.3, shin: 3.1,
  shoulder: 2.1, hipW: 1.0,
  head: 3.6, headW: 1.45, headD: 1.6,
  sole: 0.75, foot: 2.3,
  palm: 1.1, finger: 0.9,
  r: { neck: 0.62, upper: 0.66, fore: 0.56, wrist: 0.46, thigh: 0.86, shin: 0.62, ankle: 0.44, chest: 2.3, waist: 1.75, pelvis: 1.95 },
};

export type Bones = Record<string, Xf>;

/** A sway chain: `links` bones hung from `parent` at `at` (in the parent's frame), down `dir`, `step` apart. */
export interface Chain {
  name: string;
  parent: string;
  at: V3;
  dir: V3;
  links: number;
  step: number;
  /** Nought swings freely with the rig's tail, one does not swing at all. */
  stiffness: number;
}

/** The hair's chain: two links down the back of the head. */
export const HAIR_CHAIN = (P: Proportions): Chain => ({ name: 'hair', parent: 'head', at: [0, -P.headD * 0.55, P.head * 0.55], dir: [0, -0.3, -1], links: 2, step: P.head * 0.38, stiffness: 0.55 });

/** Everything the rig does not say, worked out from it and the clock. */
export interface Extras {
  /** Eyes shut, nought to one. */
  blink: number;
  /** Mouth open, nought to one; and the smile, nought to one. */
  jaw: number;
  smile: number;
  /** Brows raised (+) or knit (-), nought to one each way. */
  brow: number;
}

const DEG = Math.PI / 180;

/** The hand's curl, nought open to one a fist, from what the rig has it doing. */
export function curlOf(r: Rig, k: number): number {
  const open = r.open[k];
  const o = typeof open === 'boolean' ? (open ? 1 : 0) : open;
  if (o > 0) return clamp(1 - o) * 0.25;
  if (r.loose[k]) return 0.25 + 0.5 * clamp(r.curl[k]);
  return r.tool || !r.stowed ? 0.85 : 0.6;
}

/**
 * The bones of a body in a pose, at proportions `P`: every frame in the
 * body's own space, the lowest sole on the ground (or lifted by `rig.lift`).
 */
export function bonesOf(r: Rig, P: Proportions, chains: Chain[], x: Extras): Bones {
  const half = (e: Euler): Euler => [e[0] / 2, e[1] / 2, e[2] / 2];
  const pelvis = joint(ROOT, [r.at[0], r.at[1], P.hip + r.at[2]], ...r.pelvis);
  // The spine's bend shared between two joints, so the back curves rather than hinges.
  const spineA = joint(pelvis, [0, 0, P.spine * 0.5], ...half(r.spine));
  const spineB = joint(spineA, [0, 0, P.spine * 0.5], ...half(r.spine));
  const chest = joint(spineB, [0, 0, P.chest], ...r.chest);
  const neck = joint(chest, [0, -0.08, P.neck], ...r.neck);
  const head = joint(neck, [0, 0.06, P.headJ], ...r.head);
  const b: Bones = { pelvis, spineA, spineB, chest, neck, head };
  // The face: a jaw hinged under the ears, a lid and a brow over each eye.
  b.jaw = joint(head, [0, 0.1, P.head * 0.42], x.jaw * 18);
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const eye: V3 = [s * P.headW * 0.42, P.headD * 0.78, P.head * 0.58];
    b[`eye${k}`] = joint(head, eye);
    b[`lid${k}`] = joint(head, eye, -x.blink * 75);
    b[`brow${k}`] = joint(head, [eye[0], eye[1], eye[2] + P.head * 0.14], 0, 0, s * x.brow * -8);
    (b[`brow${k}`] as Xf).t[2] += x.brow * 0.08;
  }
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const [ap, aa, at] = r.arm[k];
    // The clavicle lifts a little with the arm raised past level, and with a shrug.
    const raise = Math.max(0, aa - 70) * 0.25 + Math.max(0, -ap - 70) * 0.2;
    const clav = joint(chest, [s * 0.4, 0.2, P.armAt + 0.15], 0, -s * (raise * 0.3), 0);
    b[`clav${k}`] = clav;
    b[`arm${k}`] = joint(clav, [s * (P.shoulder - 0.4), -0.3, -0.15 + r.shrug[k] + raise * 0.01], ap, -s * aa, s * at);
    b[`elbow${k}`] = joint(b[`arm${k}`], [0, 0, -P.upper], r.elbow[k]);
    b[`wrist${k}`] = joint(b[`elbow${k}`], [0, 0, -P.lower], ...r.hand[k]);
    // Fingers as a group and a thumb, each in two segments, curled by what the hand does.
    const c = curlOf(r, k);
    const knuckle: V3 = [0, 0.05, -P.palm];
    b[`fing${k}`] = joint(b[`wrist${k}`], knuckle, -c * 80);
    b[`fingTip${k}`] = joint(b[`fing${k}`], [0, 0, -P.finger * 0.55], -c * 85);
    b[`thumb${k}`] = joint(b[`wrist${k}`], [-s * P.r.wrist * 0.9, 0.3, -P.palm * 0.35], -c * 30, s * (35 + c * 25), 0);
    b[`thumbTip${k}`] = joint(b[`thumb${k}`], [0, 0, -P.finger * 0.5], -c * 60);
    const [lp, la, lt] = r.leg[k];
    b[`hip${k}`] = joint(pelvis, [s * P.hipW, 0, -0.1], lp, -s * la, s * lt);
    b[`knee${k}`] = joint(b[`hip${k}`], [0, 0, -P.thigh], -r.knee[k]);
    const level = r.flat[k] ? -(r.pelvis[0] + lp - r.knee[k]) : 0;
    b[`ankle${k}`] = joint(b[`knee${k}`], [0, 0, -P.shin], level + r.foot[k]);
  }
  // Stood on the lowest sole: heel and toe of each foot.
  const soles: V3[] = [[0, -0.5, -P.sole], [0, P.foot, -P.sole]];
  let low = Infinity;
  for (let k = 0; k < 2; k++) for (const p of soles) low = Math.min(low, place(b[`ankle${k}`], p)[2]);
  const dz = -low + r.lift - (r.sink > 0 ? Math.min(r.sink, 10.2) : 0);
  for (const key of Object.keys(b)) b[key] = { m: b[key].m, t: [b[key].t[0], b[key].t[1], b[key].t[2] + dz] };
  // The ball of each foot: bent up as the heel comes off the ground, so the toes stay down.
  for (let k = 0; k < 2; k++) {
    const heel = place(b[`ankle${k}`], soles[0])[2], toe = place(b[`ankle${k}`], soles[1])[2];
    const bend = clamp((heel - toe) / P.foot * 1.6) * 45;
    b[`toe${k}`] = joint(b[`ankle${k}`], [0, P.foot * 0.62, -P.sole + 0.15], -bend);
  }
  // Sway chains: each link turned by the rig's tail, less for a stiff chain and more down the chain.
  for (const ch of chains) {
    let parent = b[ch.parent];
    let at = ch.at;
    const d = ch.dir;
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    for (let i = 0; i < ch.links; i++) {
      const give = (1 - ch.stiffness) * (0.6 + 0.4 * i);
      const link = joint(parent, at, r.tail[0] * give, r.tail[1] * give, 0);
      b[`${ch.name}${i}`] = link;
      parent = link;
      at = [(d[0] / l) * ch.step, (d[1] / l) * ch.step, (d[2] / l) * ch.step];
    }
  }
  return b;
}

/** The rest pose's frames: what a sculpt is modelled against. */
export const REST_EXTRAS: Extras = { blink: 0, jaw: 0, smile: 0.5, brow: 0 };

/** A frame's inverse: for taking a rest-pose point into a bone's own space. */
export function inverse(x: Xf): Xf {
  const m = x.m;
  const mt = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  const t = x.t;
  return { m: mt, t: [-(mt[0] * t[0] + mt[1] * t[1] + mt[2] * t[2]), -(mt[3] * t[0] + mt[4] * t[1] + mt[5] * t[2]), -(mt[6] * t[0] + mt[7] * t[1] + mt[8] * t[2])] };
}

/** `a` then `b`: the frame that takes a point through `a` and then through `b`. */
export function compose(b: Xf, a: Xf): Xf {
  const m = b.m, n = a.m;
  return {
    m: [
      m[0] * n[0] + m[1] * n[3] + m[2] * n[6], m[0] * n[1] + m[1] * n[4] + m[2] * n[7], m[0] * n[2] + m[1] * n[5] + m[2] * n[8],
      m[3] * n[0] + m[4] * n[3] + m[5] * n[6], m[3] * n[1] + m[4] * n[4] + m[5] * n[7], m[3] * n[2] + m[4] * n[5] + m[5] * n[8],
      m[6] * n[0] + m[7] * n[3] + m[8] * n[6], m[6] * n[1] + m[7] * n[4] + m[8] * n[7], m[6] * n[2] + m[7] * n[5] + m[8] * n[8],
    ],
    t: place(b, a.t),
  };
}

/** The skinning frames: for each bone, posed × rest⁻¹, as a flat list of 3×4 row-major matrices in `order`. */
export function skinMatrices(posed: Bones, rest: Bones, order: string[]): Float32Array {
  const out = new Float32Array(order.length * 12);
  order.forEach((name, i) => {
    const p = posed[name] ?? ROOT, q = rest[name] ?? ROOT;
    const x = compose(p, inverse(q));
    out.set([x.m[0], x.m[1], x.m[2], x.t[0], x.m[3], x.m[4], x.m[5], x.t[1], x.m[6], x.m[7], x.m[8], x.t[2]], i * 12);
  });
  return out;
}

/** A joint's position and a step along one of its axes: handy while sculpting against the rest skeleton. */
export const at = (b: Bones, name: string, off: V3 = [0, 0, 0]): V3 => place(b[name], off);
export const between = (b: Bones, a: string, c: string, t: number): V3 => { const p = at(b, a), q = at(b, c); return add(p, mul(sub(q, p), t)); };
export const along = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
export { lerp };
export const deg = DEG;
