import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, frac, lerp, LOOP, merge, mix, moved, onEgg, orb, orbAlong, paint, pastel,
  quadBonesOf, scale, smile, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { trot } from './wild-paws';

/**
 * The vine line: the Snarepup, a small fluffy fox-cat of a pup, cream fur
 * mottled with mossy leaf patches, tufts of leaves on its head and back, big
 * dark eyes and a bushy tail curled up behind it patterned in leaves; which
 * grows into the Lashrunner, lean and low-slung, carried in a stalking
 * crouch, a ridge of leaf spines down its back and a long whip of a vine for
 * a tail, leaves along it and a leaf at its tip, lashing in a big curve; and
 * then the Vinehunter, big and long-bodied on long legs, its back under a
 * thick mane of leaves trailing vines, two vine tails whipping behind it and
 * a narrow head with intent eyes. The species is still `rowl` underneath, as
 * saves and the database know it: wild, it attacks on sight; at a settlement
 * it hunts round it and brings the carcasses home.
 *
 * Built the way the chip line is (`./wild-chip`): one set of functions from
 * a description of the stage (`Vine`), a body on four paws (`quadBonesOf`)
 * with its own head, tail and leaves. It prowls low at a walk and runs in a
 * bound, its back arching and stretching (`flexed`); its tail is a chain of
 * links with a wave running down it, each a little behind the one before, so
 * it lashes and trails and follows through after the body. It strikes in a
 * pounce: gathered, sprung, the fore paws slammed down and the jaws snapping,
 * the vine tail lashing over its back as it lands. At its task it stalks a
 * kill on the ground before it, springs up and dives onto it, bites and
 * shakes it, and lifts it in its jaws to carry home.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/**
 * How a tail is carried: lifted at the root (degrees up from straight back), swung to the right, curled up at each link and
 * further at its last three; a wave running down it, `wave` degrees from side to side and `heave` up and down at each link,
 * `phase` (in turns) at its root, each link `lag` of a turn behind the one before; and how much more the wave swings toward
 * the tip than at the root.
 */
interface Key { lift: number; yaw: number; curl: number; tip: number; wave: number; heave: number; phase: number }

/** A tail: where it roots on the body, each link's length and how thick it is, root to tip; how the wave goes down it. */
interface Tail {
  at: V3;
  links: number[];
  w: number[];
  /** Fur in a bush (a pup's), or a vine with leaves along it. */
  bush: boolean;
  /** A turn of the wave behind, per link; and how much it grows toward the tip. */
  lag: number;
  grow: number;
  rest: Key;
  /** Leaves along a vine: the length of each, and how big the leaf at its tip is. */
  leaf: number;
  tipLeaf: number;
}

/** A row of leaves on the back: `th` round the barrel from the right side (a quarter turn is the ridge), `y0` to `y1` along it, `count` of them, each `len` long and `w` wide, stood `stand` degrees up off the barrel and swept back. */
interface Row { th: number; y0: number; y1: number; count: number; len: number; w: number; stand: number; mat?: Mat }

interface Vine {
  stage: 0 | 1 | 2;
  body: Rings;
  /** Shoulder to hip; the legs' length, how thick they are, and how big a paw is across; brown stockings on the lower legs. */
  len: number;
  legs: number;
  thick: number;
  paw: number;
  stockings: boolean;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes; the muzzle's half-width, half-length and half-height and how far under the skull's middle it comes out; the nose's pitch. */
  head: { r: V3; muzzle: V3; drop: number; pitch: number };
  /** The eyes: the way out to the right one, how big, and how hard a brow comes down over them (nought for a pup's round eyes). */
  eye: { dir: V3; size: number; fierce: number };
  ear: { len: number; w: number; out: number; back: number };
  /** Fluff out of each cheek, how long; a tuft of leaves on the crown, how many and how long. */
  cheek: number;
  crown: [number, number];
  /** Leaves down the neck behind the ears, how many and how long. */
  mane: [number, number];
  tails: Tail[];
  back: Row[];
  /** Vines hanging from the shoulders and hips, each a chain of leaves: how many down each side and how long. */
  drapes: [number, number];
  /** Moss patches on the coat, how many down each side. */
  patches: number;
  /** How low it carries itself, standing and prowling: nought upright, one a stalking crouch. */
  crouch: number;
  gait: { swing: [number, number]; low: number; nod: number; roll: number };
  /** How far forward it lunges as it strikes, against its own length. */
  lunge: number;
  size: number;
}

/** A Snarepup: small and round, a head too big for it, big dark eyes, leaf tufts on its crown and back, and a bushy tail curled up behind. */
const SNAREPUP_LOOK: Vine = {
  stage: 0,
  body: { y: [-0.86, -0.74, -0.4, 0.04, 0.48, 0.78, 0.88], z: [0.1, 0.08, 0.04, 0.02, 0.06, 0.1, 0.12], w: [0.3, 0.47, 0.5, 0.47, 0.52, 0.48, 0.24], h: [0.32, 0.46, 0.48, 0.45, 0.5, 0.48, 0.24] },
  len: 1.42, legs: 0.5, thick: 0.15, paw: 0.2, stockings: true,
  neck: { at: [0, 0.72, 0.12], len: 0.26, w: 0.36, lean: 32 },
  head: { r: [0.78, 0.64, 0.68], muzzle: [0.26, 0.24, 0.17], drop: 0.3, pitch: -6 },
  eye: { dir: [0.52, 0.76, 0.22], size: 0.24, fierce: 0 },
  ear: { len: 0.62, w: 0.34, out: 30, back: 6 },
  cheek: 0.24,
  crown: [4, 0.68],
  mane: [3, 0.34],
  tails: [{
    at: [0, -0.84, 0.26], links: [0.24, 0.24, 0.24, 0.23, 0.22, 0.21, 0.2], w: [0.15, 0.21, 0.26, 0.28, 0.27, 0.23, 0.15], bush: true, lag: 0.07, grow: 0.6,
    rest: { lift: 34, yaw: 12, curl: 21, tip: 18, wave: 0, heave: 0, phase: 0 }, leaf: 0, tipLeaf: 0,
  }],
  back: [{ th: Math.PI / 2, y0: -0.2, y1: 0.3, count: 3, len: 0.36, w: 0.11, stand: 55 }],
  drapes: [0, 0],
  patches: 4,
  crouch: 0,
  gait: { swing: [30, 44], low: 0, nod: 5, roll: 2 },
  lunge: 0.38,
  size: 2.5,
};

/** A Lashrunner: lean and low-slung in a stalking crouch, a fox's head, a ridge of leaf spines down its back, and a long whip of a vine tail with a leaf at its tip. */
const LASHRUNNER_LOOK: Vine = {
  stage: 1,
  body: { y: [-1.42, -1.28, -0.8, 0, 0.74, 1.22, 1.38], z: [0.12, 0.1, 0.05, 0.0, 0.08, 0.14, 0.16], w: [0.3, 0.42, 0.44, 0.37, 0.47, 0.46, 0.24], h: [0.3, 0.44, 0.44, 0.36, 0.5, 0.48, 0.24] },
  len: 2.45, legs: 1.45, thick: 0.115, paw: 0.17, stockings: true,
  neck: { at: [0, 1.2, 0.14], len: 0.52, w: 0.36, lean: 66 },
  head: { r: [0.47, 0.52, 0.43], muzzle: [0.2, 0.5, 0.17], drop: 0.13, pitch: -6 },
  eye: { dir: [0.6, 0.66, 0.36], size: 0.15, fierce: 0.5 },
  ear: { len: 0.6, w: 0.26, out: 24, back: 26 },
  cheek: 0.28,
  crown: [3, 0.5],
  mane: [4, 0.46],
  tails: [{
    at: [0, -1.36, 0.3], links: Array.from({ length: 13 }, (_, q) => 0.36 - 0.006 * q), w: Array.from({ length: 13 }, (_, q) => 0.07 - 0.003 * q), bush: false, lag: 0.055, grow: 1.4,
    rest: { lift: 56, yaw: 18, curl: -10, tip: -6, wave: 0, heave: 0, phase: 0 }, leaf: 0.55, tipLeaf: 0.75,
  }],
  back: [
    { th: Math.PI / 2, y0: -1.1, y1: 1.15, count: 7, len: 0.9, w: 0.2, stand: 50 },
    { th: 1.2, y0: -0.6, y1: 0.8, count: 3, len: 0.45, w: 0.14, stand: 34, mat: 'leafDark' },
  ],
  drapes: [0, 0],
  patches: 5,
  crouch: 0.7,
  gait: { swing: [30, 44], low: 0.1, nod: 3, roll: 3 },
  lunge: 0.26,
  size: 2.05,
};

/** A Vinehunter: big, long-bodied on long legs, its back under a thick mane of leaves trailing vines, two vine tails, a narrow head and intent eyes. */
const VINEHUNTER_LOOK: Vine = {
  stage: 2,
  body: { y: [-2.0, -1.82, -1.12, 0, 1.0, 1.66, 1.86], z: [0.16, 0.14, 0.08, 0.02, 0.12, 0.2, 0.22], w: [0.42, 0.58, 0.6, 0.48, 0.64, 0.62, 0.32], h: [0.42, 0.6, 0.6, 0.46, 0.68, 0.66, 0.32] },
  len: 3.4, legs: 2.25, thick: 0.15, paw: 0.22, stockings: true,
  neck: { at: [0, 1.66, 0.2], len: 0.8, w: 0.44, lean: 68 },
  head: { r: [0.46, 0.6, 0.42], muzzle: [0.21, 0.56, 0.17], drop: 0.13, pitch: -8 },
  eye: { dir: [0.62, 0.62, 0.38], size: 0.15, fierce: 0.8 },
  ear: { len: 0.66, w: 0.28, out: 20, back: 46 },
  cheek: 0.3,
  crown: [4, 0.7],
  mane: [6, 0.75],
  tails: [
    {
      at: [0, -1.92, 0.4], links: Array.from({ length: 13 }, (_, q) => 0.48 - 0.008 * q), w: Array.from({ length: 13 }, (_, q) => 0.09 - 0.004 * q), bush: false, lag: 0.05, grow: 1.3,
      rest: { lift: 30, yaw: 16, curl: -4, tip: -8, wave: 0, heave: 0, phase: 0 }, leaf: 0.6, tipLeaf: 0.85,
    },
    {
      at: [0.18, -1.7, 0.62], links: Array.from({ length: 7 }, (_, q) => 0.5 - 0.012 * q), w: Array.from({ length: 7 }, (_, q) => 0.06 - 0.004 * q), bush: false, lag: 0.06, grow: 1.2,
      rest: { lift: 44, yaw: 26, curl: -9, tip: -10, wave: 0, heave: 0, phase: 0.3 }, leaf: 0.5, tipLeaf: 0.65,
    },
  ],
  back: [
    { th: Math.PI / 2, y0: -1.6, y1: 1.5, count: 8, len: 1.25, w: 0.25, stand: 48 },
    { th: 1.12, y0: -1.6, y1: 1.4, count: 8, len: 0.85, w: 0.18, stand: 22 },
    { th: 0.72, y0: -1.3, y1: 1.2, count: 6, len: 0.62, w: 0.15, stand: 8, mat: 'leafDark' },
  ],
  drapes: [2, 1.1],
  patches: 6,
  crouch: 0.5,
  gait: { swing: [26, 40], low: 0.05, nod: 2, roll: 4 },
  lunge: 0.3,
  size: 2.2,
};

/* ---- helpers --------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a row of leaves is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** A mesh with every face of one colour made another. */
const recoloured = (m: Mesh, from: Mat, to: Mat): Mesh => mesh(m.v, m.f.map((f) => (f.m === from ? { ...f, m: to } : f)));

/** Every bone moved by `d`, for a body thrown forward in a lunge. */
function shifted(b: Bones, d: V3): Bones {
  if (!d[0] && !d[1] && !d[2]) return b;
  const out: Bones = {};
  for (const k of Object.keys(b)) out[k] = { m: b[k].m, t: k === 'shadow' ? [b[k].t[0] + d[0], b[k].t[1] + d[1], 0] : add(b[k].t, d) };
  return out;
}

/**
 * A leaf: a blade from `root` out along `dir`, its face turned along `face`, `len` long and `w` across at its widest a third
 * of the way out, drooping toward the back of its face by `droop` of its length by the tip, its sides lifted into a shallow V
 * along a darker rib.
 */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, o: { droop?: number; mat?: Mat; rib?: Mat; twist?: number } = {}): Mesh {
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), dr = o.droop ?? 0.25;
  const at = (k: number, sag: number): V3 => add(add(root, scale(d, len * k)), scale(n, -dr * len * sag));
  return blade([root, at(0.33, 0.06), at(0.7, 0.3), at(1, 0.7)], [w * 0.22, w, w * 0.62, 0.008], n, { fold: 0.3, twist: o.twist ?? 0, thick: Math.min(0.03, w * 0.2), mat: o.mat ?? 'leaf', rib: o.rib ?? 'leafDark' });
}

/* ---- its moves --------------------------------------------------------------------------- */

/** The strike: how far through it it has gathered itself, springs, lands with its fore paws and jaws, and has let go of the blow. */
export const VINE_STRIKE = { gather: 0.3, spring: 0.36, hit: 0.5, hold: 0.62 };
/**
 * A go at its task: when it has crouched over the kill, springs up, dives onto it, has it in its jaws, shakes it (to
 * `shake`), and has lifted it to carry.
 */
export const VINE_WORK = { crouch: 0.2, spring: 0.24, land: 0.4, grab: 0.46, shake: 0.66, lifted: 0.8 };

/** How far through a strike it has gathered itself, how far into the spring and out along the lunge, and how hard it has just landed. */
function strikeOf(t: number): { gather: number; fly: number; reach: number; land: number } {
  const S = VINE_STRIKE;
  const gather = ramp(t, 0, S.gather) * (1 - ramp(t, S.spring, S.hit));
  const fly = hump(t, (S.spring + S.hit) / 2, (S.hit - S.spring) / 2 + 0.03);
  const reach = ramp(t, S.spring - 0.04, S.hit) * (1 - ramp(t, S.hold, 1));
  const land = t < S.hit ? 0 : Math.exp(-(t - S.hit) * 12) * (1 - ramp(t, 0.85, 1));
  return { gather, fly, reach, land };
}

/** How far through a go at its task: down in its crouch, up in its spring, its fore paws and jaws on the kill, shaking it, and holding it up. */
function workOf(t: number, moving: number): { crouch: number; fly: number; pin: number; shake: number; hold: number } {
  const W = VINE_WORK, still = 1 - moving;
  const crouch = still * ramp(t, 0, W.crouch) * (1 - ramp(t, W.spring, W.land - 0.06));
  const fly = still * hump(t, (W.spring + W.land) / 2, (W.land - W.spring) / 2 + 0.02);
  const pin = still * ramp(t, W.land - 0.04, W.land) * (1 - ramp(t, W.shake - 0.04, W.lifted));
  const shake = still * (t > W.grab && t < W.shake ? Math.sin(Math.PI * (t - W.grab) / (W.shake - W.grab)) : 0);
  // On the move it is carrying what it caught home: held up in its jaws the whole time.
  const hold = Math.max(moving, still * ramp(t, W.shake - 0.04, W.lifted));
  return { crouch, fly, pin, shake, hold };
}

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on four paws (`QuadSpec`): its legs, neck and ears from its numbers. The tails are its own (`tailBones`). */
function specOf(s: Vine): QuadSpec {
  return {
    high: s.legs + 0.5,
    fore: { at: [s.body.w[4] * 0.5, s.len * 0.44, -0.3], len: [s.legs * 0.5, s.legs * 0.46, s.paw * 0.55], rest: [-3, 6, 0], fold: [55, 85], toe: [s.paw * 1.1, s.paw * 0.4] },
    hind: { at: [s.body.w[2] * 0.52, -s.len * 0.42, -0.14], len: [s.legs * 0.46, s.legs * 0.42, hock(s)], rest: [22, -48, 0], fold: [35, 55], toe: [s.paw * 1.1, s.paw * 0.4] },
    neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
    head: { pitch: s.head.pitch },
    ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
    swing: s.gait.swing,
    duty: [0.62, 0.3],
    graze: 104 - s.neck.lean,
    nose: 22,
    bow: 10,
    rock: 5,
  };
}

/** How high a hind paw's heel is carried, its sole to the hock, on a long hind foot. */
// A pup's as long as stands its hind paws on the ground level with its fore paws, its hips being higher on its body than its
// shoulders and its hind legs bent; the hunters' a little shorter, so they stalk with their hindquarters drawn up.
const hock = (s: Vine): number => (s.stage ? s.legs * 0.26 : 0.16 + 0.156 * s.legs + s.paw * 0.55);

/** Where each ear is rooted on the head (the right one): high on the crown, toward the side. */
function earRoot(s: Vine): V3 {
  const q = onSkull(s, [0.6, -0.15, 0.78]);
  return sub(q.p, scale(q.n, 0.08));
}

/** Its legs folded under it by `k`: the fore legs bent at the elbow and the hind at the hock, so it sinks low over its paws. */
function crouched(p: QuadPose, k: number): void {
  if (!k) return;
  for (const i of [0, 1]) {
    p.legs[i][0] -= 34 * k;
    p.legs[i][1] -= 1.3 * k;
  }
  for (const i of [2, 3]) {
    p.legs[i][0] += 30 * k;
    p.legs[i][1] += 1.2 * k;
  }
}

/**
 * Its run: a bound, as a cat runs. The hind feet come down together and
 * drive, the body goes out long through the air with the fore legs reaching,
 * the fore feet come down one after the other and it rocks over them, and the
 * hind legs swing up under its chest to come down again ahead of where they
 * left. The head is held level through it all, on whatever it is running down.
 */
function bound(p: QuadPose, a: Anim): void {
  const g = a.go * smooth(a.gait);
  if (g <= 0) return;
  const w = frac(a.u);
  const bump = (x: number, x0: number, x1: number): number => (x > x0 && x < x1 ? Math.sin((Math.PI * (x - x0)) / (x1 - x0)) : 0);
  // A leg through a bound: down for three tenths of the stride, sweeping `amp` either way; then trailing out behind, swung
  // through folded, and reaching out ahead before it comes down.
  const leg = (u: number, amp: number, trail: number, reach: number, fold: [number, number]): [number, number, number] => {
    const q = frac(u), duty = 0.3;
    if (q < duty) return [amp * (1 - (2 * q) / duty), 0, 0];
    const t = (q - duty) / (1 - duty);
    return [-amp + 2 * amp * smooth(t) - trail * bump(t, 0, 0.35) + reach * bump(t, 0.6, 1), 1.3 * bump(t, fold[0], fold[1]) ** 2, t];
  };
  const fore: [number, number] = [0.05, 0.72], hind: [number, number] = [0.2, 1.05];
  const legs = [leg(a.u - 0.44, 32, 4, 26, fore), leg(a.u - 0.47, 32, 4, 26, fore), leg(a.u, 28, 22, 16, hind), leg(a.u - 0.03, 28, 22, 16, hind)];
  p.legs = p.legs.map((l, i) => [lerp(l[0], legs[i][0], g), lerp(l[1], legs[i][1], g), lerp(l[2], legs[i][2], g)] as [number, number, number]);
  // Nose up while the hind legs drive, down while the fore feet take it.
  const turn = (w0: number, w1: number): number => smooth((w - w0) / (w1 - w0));
  const rock = 7 * (w < 0.5 ? 1 - 2 * turn(0.33, 0.44) : -1 + 2 * turn(0.77, 1));
  p.pitch = lerp(p.pitch, rock, g);
  p.head[0] = lerp(p.head[0], -rock - 2, g);
  // In the air twice a stride: stretched out after the drive, and gathered after the fore feet push off.
  p.lift = lerp(p.lift, 0.3 * bump(w, 0.33, 0.44) + 0.5 * bump(w, 0.77, 1), g);
  p.squash = lerp(p.squash, -0.04 * Math.max(0, Math.sin(TAU * (w - 0.25))), g);
  p.roll *= 1 - g;
}

/**
 * Its spine through a bound: arched as its hind legs come up under it, and
 * let out long as it stretches through the air; and as it gathers to spring,
 * its back drawn up. Everything on the trunk goes with it, its leaves too.
 */
function flexOf(s: Vine, a: Anim): number {
  const g = a.go * smooth(a.gait);
  let arch = g > 0 ? g * (0.06 + 0.18 * Math.cos(TAU * (frac(a.u) - 0.87))) * s.len / 2.4 : 0;
  if (a.act?.kind === 'strike') arch += 0.1 * strikeOf(a.act.t).gather * s.len / 2.4 - 0.08 * strikeOf(a.act.t).fly * s.len / 2.4;
  if (a.act?.kind === 'work') arch += 0.1 * workOf(a.act.t, a.go).crouch * s.len / 2.4;
  return arch;
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its
 * crouch, its prowl and its bound; and its moves -- a pounce, gathered, sprung
 * and landed; its kill pounced on, shaken and carried; and evolving, drawn up
 * and shaking itself.
 */
function vinePose(s: Vine, p: QuadPose, a: Anim): void {
  trot(p, a);
  const g = smooth(a.go), walk = 1 - a.gait, G = s.gait;
  // Carried low, the more so prowling; drawn up out of it as it runs.
  crouched(p, s.crouch * (1 - g * a.gait) + g * walk * G.low * 2);
  if (a.go > 0) {
    const w = frac(a.u);
    // A prowl: the head let down and stretched forward on whatever it is stalking, the shoulders rolling over each paw.
    p.neck[0] += g * walk * (6 + 10 * s.crouch);
    p.head[0] += g * walk * (4 + 8 * s.crouch);
    p.head[0] += g * walk * G.nod * Math.sin(w * TAU * 2 - 0.6);
    p.roll += g * walk * G.roll * Math.sin(w * TAU + 0.3);
    p.ears[0][0] += g * (2 * G.nod * Math.sin(w * TAU * 2 - 1.4) + 25 * a.gait);
    p.ears[1][0] += g * (2 * G.nod * Math.sin(w * TAU * 2 - 1.1) + 25 * a.gait);
    // Low and level at a run.
    p.neck[0] += 12 * a.gait * g;
  } else {
    // Standing, now and then it drops into a crouch and stares, its ears pricked, as though at something in the grass.
    const stare = beat(a.t, [7.4, 18.6], 2.4) * (1 - a.graze);
    crouched(p, 0.35 * stare);
    p.neck[0] += 10 * stare;
    p.head[0] += 12 * stare;
    p.ears[0][0] -= 10 * stare;
    p.ears[1][0] -= 10 * stare;
    // And a stretch, the fore paws out and the chest down.
    const stretch = beat(a.t, [12.2], 1.8) * (1 - a.graze);
    p.pitch -= 9 * stretch;
    p.head[0] += 9 * stretch;
    p.legs[0][0] += 24 * stretch;
    p.legs[1][0] += 24 * stretch;
  }
  bound(p, a);
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    // Gathered: down on its haunches, its rump treading, ears pinned, head low and level on what it will spring at.
    crouched(p, 0.6 * k.gather);
    p.neck[0] += 12 * k.gather;
    p.head[0] += 4 * k.gather;
    const tread = k.gather * Math.sin(act.t * 70) * ramp(act.t, 0.12, 0.2);
    p.legs[2][0] += 4 * tread;
    p.legs[3][0] -= 4 * tread;
    for (const e of p.ears) e[0] += 45 * k.gather + 35 * k.reach;
    // Sprung and landed: its stalking crouch let out, the hind legs driven out straight behind, the fore legs flung out ahead
    // and slammed down there, the body up off the ground and stretched long, the neck thrust out and the head driven into a bite.
    crouched(p, -s.crouch * k.reach);
    p.lift += 0.2 * s.legs * k.fly;
    for (const i of [2, 3]) {
      p.legs[i][0] -= (36 - 4 * (i - 2)) * k.reach;
      p.legs[i][1] -= 0.5 * k.reach;
      p.foot[i] -= 35 * k.reach;
    }
    for (const i of [0, 1]) {
      p.legs[i][0] += (32 - 6 * i) * k.reach + 8 * k.fly;
      p.legs[i][1] -= 0.25 * k.reach;
    }
    p.pitch += 6 * k.fly - 8 * k.land - 3 * k.reach;
    p.neck[0] += 18 * k.reach - 10 * k.fly;
    p.head[0] -= 10 * k.land - 8 * k.fly;
    p.jaw = 3 * Math.max(hump(act.t, VINE_STRIKE.hit - 0.04, 0.1), 0.6 * k.fly);
    p.squash += 0.1 * k.land - 0.06 * k.fly;
    if (s.stage === 0) {
      // A pup hops high into its pounce, reared up with both fore paws raised and curled to bat, and comes down on them
      // nose first, squashed flat by the landing.
      const rear = hump(act.t, VINE_STRIKE.spring + 0.04, 0.1);
      p.lift += 0.42 * k.fly;
      p.pitch += 26 * rear - 12 * k.land;
      p.head[0] -= 14 * rear - 6 * k.land;
      for (const i of [0, 1]) {
        p.legs[i][0] += 48 * rear;
        p.legs[i][1] += 1.1 * rear;
        p.legs[i][2] = Math.max(p.legs[i][2], rear);
      }
      for (const i of [2, 3]) p.legs[i][1] += 0.5 * k.fly;
      p.squash += 0.16 * k.land - 0.08 * k.fly;
    }
  } else if (act?.kind === 'work') {
    const w = workOf(act.t, a.go);
    // Over the kill: crouched low and staring down at it, its rump wiggling; sprung straight up and turned nose down in the air,
    // and come down on it fore paws first; the head down on it, biting and shaking it from side to side; then up, holding it.
    crouched(p, 0.8 * w.crouch);
    p.neck[0] += 22 * w.crouch;
    p.head[0] -= 14 * w.crouch;
    const wiggle = w.crouch * ramp(act.t, 0.1, 0.16) * Math.sin(act.t * 60);
    p.roll += 3 * wiggle;
    p.legs[2][0] += 3 * wiggle;
    p.legs[3][0] -= 3 * wiggle;
    // A pup's a high mousing leap for the size of it.
    p.lift += (s.stage ? 0.32 * s.legs : 0.55) * w.fly;
    p.pitch -= 16 * w.fly + 8 * w.pin;
    p.squash += (s.stage ? 0.08 : 0.16) * hump(act.t, VINE_WORK.land + 0.02, 0.05);
    p.legs[0][0] += 20 * w.fly + 12 * w.pin;
    p.legs[1][0] += 18 * w.fly + 10 * w.pin;
    p.legs[0][1] += 0.4 * w.fly;
    p.legs[1][1] += 0.4 * w.fly;
    p.legs[2][1] += 0.6 * w.fly;
    p.legs[3][1] += 0.6 * w.fly;
    p.neck[0] += 30 * w.pin;
    p.head[0] -= 24 * w.pin;
    p.neck[1] += 18 * w.shake * Math.sin(act.t * 95);
    p.head[2] += 22 * w.shake * Math.sin(act.t * 95 + 0.6);
    p.jaw = 2 * hump(act.t, VINE_WORK.grab - 0.03, 0.06);
    // Held up: the head high, the kill hanging from its jaws.
    p.neck[0] -= 12 * w.hold;
    p.head[0] += 8 * w.hold;
    for (const e of p.ears) e[0] -= 6 * w.hold;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, a shake from nose to tail at the turn, and settled into its new body.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.6, 0.85)), shake = hump(act.t, 0.55, 0.12);
    p.neck[0] -= 16 * up;
    p.head[0] += 12 * up;
    p.pitch += 7 * up;
    p.legs[0][0] += 10 * up;
    p.legs[1][0] += 10 * up;
    p.head[2] += 18 * shake * Math.sin(act.t * 70);
    p.roll += 4 * shake * Math.sin(act.t * 70 + 1);
    p.ears[0][0] += 26 * shake * Math.sin(act.t * 70) - 12 * up;
    p.ears[1][0] -= 26 * shake * Math.sin(act.t * 70) + 12 * up;
    p.squash += 0.1 * hump(act.t, 0.66, 0.06);
  }
}

const mixKey = (a: Key, b: Key, t: number): Key => ({
  lift: lerp(a.lift, b.lift, t), yaw: lerp(a.yaw, b.yaw, t), curl: lerp(a.curl, b.curl, t), tip: lerp(a.tip, b.tip, t),
  wave: lerp(a.wave, b.wave, t), heave: lerp(a.heave, b.heave, t), phase: lerp(a.phase, b.phase, t),
});
const addKey = (a: Key, d: Partial<Key>): Key => ({
  lift: a.lift + (d.lift ?? 0), yaw: a.yaw + (d.yaw ?? 0), curl: a.curl + (d.curl ?? 0), tip: a.tip + (d.tip ?? 0),
  wave: a.wave + (d.wave ?? 0), heave: a.heave + (d.heave ?? 0), phase: a.phase + (d.phase ?? 0),
});

/**
 * A tail's bones carried as `k` says, from its root on the body: each link on
 * from the one before, curled up by as much, and swung and heaved by a wave
 * running down it, a little behind at each link and growing toward the tip:
 * so a flick at the root goes down it and cracks at the end.
 */
function tailBones(T: Tail, body: Xf, k0: Key, late?: (q: number) => Key): Xf[] {
  const n = T.links.length, out: Xf[] = [];
  const keys = Array.from({ length: n }, (_, q) => (late ? late(q) : k0));
  const wave = (q: number, off = 0): number => Math.sin(TAU * (keys[q].phase - q * T.lag) + off) * (1 + T.grow * q / n);
  const k = keys[0];
  let prev = joint(body, T.at, -(k.lift + k.heave * wave(0, 1.2) * 0.5), 0, k.yaw + k.wave * wave(0) * 0.5);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    // Each link carried as the tail was a moment before the link above it (`late`): its lift and swing at the root come down
    // it link by link, so the tip follows the root and overshoots it, as a whip does.
    const c = keys[q], up = keys[q - 1];
    const pitch = c.lift - up.lift + c.curl + (q >= n - 3 ? c.tip : 0) + c.heave * wave(q, 1.2) / n * 2;
    prev = joint(prev, [0, -T.links[q - 1], 0], -pitch, 0, c.yaw - up.yaw + c.wave * wave(q) / n * 2);
    out.push(prev);
  }
  return out;
}

/** A vine tail's lag down its length at a strike: how far behind its root (in turns of the strike) its tip moves. */
const LASH_LAG = 0.15;

/** How a tail is carried this moment, before any act: swaying as it stands, trailing and lashing behind as it goes. */
function tailCarried(s: Vine, T: Tail, a: Anim, which: number): Key {
  const R = T.rest, g = smooth(a.go), w = frac(a.u), run = g * a.gait;
  // Standing: a slow sway, and now and then a lash, the wave running out down it to the tip. Twelve turns a loop.
  const flick = beat(a.t, [4.1, 10.3, 16.6, 21.1], 1.1) * (1 - g);
  let k: Key = addKey(R, {
    yaw: 8 * cyc(a.t, 4, which) * (1 - g),
    lift: 3 * cyc(a.t, 3, 1 + which) * (1 - g),
    wave: (T.bush ? 10 : 22) * (1 - g) + (T.bush ? 30 : 34) * flick,
    heave: (T.bush ? 6 : 16) * (1 - g),
    phase: (a.t * 12) / LOOP + which * 0.3,
  });
  if (g > 0) {
    // Going: the wave runs down it once a stride, a beat behind the body; trailing lower and further out behind at a run.
    const going: Key = addKey(R, {
      lift: T.bush ? -10 * run : -(R.lift - 8) * run * 0.8 + 8 * (1 - run),
      curl: T.bush ? -R.curl * 0.5 * run : -R.curl * (0.8 * run + 0.35 * (1 - run)),
      tip: -R.tip * 0.5 * run,
      yaw: 6 * Math.sin(w * TAU + 0.8) * (1 - run),
      wave: T.bush ? 22 : 40 + 16 * run,
      heave: T.bush ? 10 + 14 * run : 9 + 5 * run,
      phase: w + 0.25 + which * 0.3,
    });
    k = mixKey(k, going, g);
  }
  return k;
}

/**
 * The tail (or a vine of it) at the strike: let down low behind as it
 * gathers, its tip twitching; streamed out straight behind through the spring;
 * then lashed up and over its back as it lands, curling forward, the wave
 * cracking out at its tip; and let back down to how it carries it.
 */
function tailStruck(s: Vine, T: Tail, k: Key, t: number, which: number): Key {
  const S = VINE_STRIKE;
  if (T.bush) {
    // A pup's bush fluffed up and swished.
    return addKey(k, { lift: 22 * ramp(t, 0, S.gather) * (1 - ramp(t, S.hold, 1)), wave: 40 * hump(t, S.hit, 0.2), phase: t * 2.5 });
  }
  const R = T.rest;
  const low: Key = { ...k, lift: R.lift - 26, curl: R.curl * 0.6, tip: R.tip + 24 * Math.sin(t * 60), wave: 14, heave: 4, phase: t * 3 + which * 0.3 };
  const out: Key = { ...k, lift: 8 + 6 * which, curl: -1, tip: -4, wave: 24, heave: 6, phase: t * 4 + which * 0.3 };
  const over: Key = { ...k, lift: 52 - 8 * which, curl: 12, tip: 16, yaw: k.yaw + (which ? -16 : 12), wave: 24, heave: 10, phase: t * 3.4 + which * 0.25 };
  if (t < S.gather) return mixKey(k, low, ramp(t, 0, S.gather * 0.6));
  if (t < S.spring + 0.04) return mixKey(low, out, ramp(t, S.gather, S.spring + 0.04));
  // Swung over with an overshoot, and let back down past where it rests and back.
  if (t < S.hit + 0.1) return mixKey(out, over, backOut(clamp((t - S.spring - 0.04) / (S.hit + 0.1 - S.spring - 0.04))));
  return mixKey(over, k, backOut(clamp((t - S.hit - 0.1) / (0.92 - S.hit - 0.1)), 1.2));
}

/** Eased out past one and back: a swing that overshoots where it is going and settles there, by `k`. */
const backOut = (x: number, k = 1.7): number => 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2;

/** The tail at its task: still but for the tip twitching as it stalks, swished as it pounces, and held high and swaying as it carries off its kill. */
function tailWorked(T: Tail, k: Key, w: ReturnType<typeof workOf>, t: number, which: number): Key {
  const twitch = w.crouch * (T.bush ? 0 : 1);
  return addKey(mixKey(k, { ...k, wave: 8, heave: 4, phase: t * 9 }, w.crouch), {
    tip: 24 * twitch * Math.sin(t * 50),
    lift: 18 * w.fly + 14 * w.hold * (T.bush ? 1 : 0.6),
    wave: 50 * w.fly + 12 * w.hold + 30 * w.shake,
    heave: 6 * w.hold,
    phase: (t * 3 + which * 0.3) * (w.hold + w.fly + w.shake),
  });
}

/**
 * The bones of a stage: a body on four paws (`quadBonesOf`), lunging forward
 * as it strikes; its tails; a lower jaw that opens; and, at its task, the
 * kill on the ground before it and then in its jaws.
 */
function vineBones(s: Vine): (a: Anim) => Bones {
  const spec = specOf(s);
  const posed = quadBonesOf(spec, (p, a) => vinePose(s, p, a));
  const M = muzzleOf(s);
  // Where the kill lies at its task: on the ground under where its jaws come down.
  let preyAt: V3 | null = null;
  return (a) => {
    const act = a.act, work = act?.kind === 'work';
    let b = posed(work ? { ...a, graze: 0 } : a);
    if (act?.kind === 'strike') {
      // Thrown forward along the lunge and drawn back after: the hind feet driven back, the fore paws out ahead.
      const k = strikeOf(act.t);
      b = shifted(b, [0, s.lunge * s.len * k.reach, 0]);
    }
    // The lower jaw on its hinge under the back of the muzzle.
    const jawOpen = act?.kind === 'strike' ? 34 * Math.max(hump(act.t, VINE_STRIKE.hit - 0.04, 0.1), 0.6 * strikeOf(act.t).fly)
      : work ? 30 * hump(act.t, VINE_WORK.grab - 0.03, 0.06) * (1 - a.go) : 0;
    b.jaw = joint(b.head, hingeOf(s), -jawOpen);
    s.tails.forEach((T, which) => {
      let k = tailCarried(s, T, a, which);
      let late: ((q: number) => Key) | undefined;
      if (act?.kind === 'strike') {
        k = tailStruck(s, T, k, act.t, which);
        // The whip: each link a little behind the one above it, so a swing at the root runs down it and cracks at the tip.
        if (!T.bush) {
          const base = tailCarried(s, T, a, which), lag = LASH_LAG / (T.links.length - 1);
          late = (q) => tailStruck(s, T, base, Math.max(0, act.t - q * lag), which);
        }
      }
      else if (work) k = tailWorked(T, k, workOf(act.t, a.go), act.t, which);
      else if (act?.kind === 'evolve') k = addKey(k, { lift: 24 * hump(act.t, 0.4, 0.3), wave: 60 * hump(act.t, 0.55, 0.15), phase: act.t * 6 });
      tailBones(T, b.body, k, late).forEach((x, q) => { b[`${which ? 'vine' : 'tail'}${q}`] = x; });
    });
    if (work) {
      const w = workOf(act.t, a.go);
      // The kill: lying on the ground where its jaws come down, until it has it; then hanging from its jaws.
      if (!preyAt) {
        const at = posed({ ...a, go: 0, gait: 0, graze: 0, act: { kind: 'work', t: VINE_WORK.grab } });
        const jaw = place(at.head, [0, M.c[1] + M.r[1] * 0.5, M.c[2] - M.r[2]]);
        preyAt = [jaw[0], jaw[1], 0];
      }
      if (w.hold > 0 || a.go > 0.5 || act.t >= VINE_WORK.grab) b.preyHeld = joint(b.head, [0, M.c[1] + M.r[1] * 0.55, M.c[2] - M.r[2] * 0.7], 0, 0, 0);
      else b.preyGround = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: preyAt };
    }
    return b;
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The middle of the skull, in the head's frame: a little up from the neck's end. */
const skullAt = (s: Vine): V3 => [0, 0, s.head.r[2] * 0.3];
/** Where a way out of the middle of the skull meets it, and the way out of it there. */
const onSkull = (s: Vine, dir: V3): { p: V3; n: V3 } => onEgg(skullAt(s), s.head.r, dir);
/** The muzzle's egg: where its middle is, and how wide, long and high it is. */
function muzzleOf(s: Vine): { c: V3; r: V3 } {
  const H = s.head, C = skullAt(s), m = H.muzzle;
  return { c: [0, C[1] + H.r[1] * 0.5 + m[1] * 0.42, C[2] - H.drop], r: [m[0], m[1], m[2]] };
}

/**
 * The eyes, set on the front of the skull and looking forward as much as
 * out: each a dark rim, an iris, a dark middle and two glints; a pup's round
 * and nearly all dark, the older ones' amber-green with a slit of a pupil and
 * a lid of fur coming down over the top at a slant, which is all an intent
 * stare is. All of an eye goes out of sight together when the head is between
 * it and the viewer (`at`).
 */
function eyesOf(s: Vine, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onSkull(s, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, 0.03));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const C = skullAt(s), R = s.head.r;
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = 1 - 0.3 * E.fierce;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.14, r * 1.16 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * 1.04 * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(p, n, r * 0.7, r * 0.74 * tall, 10, 'crystalDark', o), 0.02));
    // A pup's pupil wide and round; a hunter's a tall slit.
    out.push(onto(disc(p, n, r * (0.56 - 0.36 * E.fierce), r * (0.66 - 0.06 * E.fierce) * tall, 8, 'eye', o), 0.024));
    if (E.fierce > 0) {
      // The lid: the fur of the brow come down over the top of the eye at a slant, lower toward the nose, a dark line along its edge.
      const tilt = side * 0.55 * E.fierce, lidUp = unit(add(scale(up, Math.cos(tilt)), scale(across, Math.sin(tilt))));
      const edge = r * tall * (1 - 0.65 * E.fierce);
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.62)), n, r * 1.4, r * 0.64, 10, 'coat', { ...o, up: lidUp }), 0.028));
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.02)), n, r * 1.36, r * 0.12, 8, 'lid', { ...o, up: lidUp }), 0.032));
    }
    out.push(onto(disc(add(add(p, scale(up, r * 0.34 * tall)), scale(across, side * r * 0.3)), n, r * (0.3 - 0.06 * E.fierce), r * (0.3 - 0.06 * E.fierce), 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.38 * tall)), scale(across, -side * r * 0.3)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/**
 * The head: a fox-cat's -- a round skull with full cheeks low on each side,
 * a muzzle out of the lower front of it, short and soft on a pup and long and
 * narrow on the hunters, pale at its end, a small dark nose and a mouth; fluff
 * out of each cheek; moss patches on the brow and a cheek; and a tuft of
 * leaves on the crown, upright on a pup and swept back on the others.
 */
function headOf(s: Vine, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), M = muzzleOf(s), m = M.r;
  const skull = orb(C, H.r, n + 2, k + 2, 'coat');
  const cheekC: V3 = [0, C[1] + H.r[1] * 0.2, C[2] - H.r[2] * 0.36], cheekR: V3 = [H.r[0] * 0.55, H.r[1] * 0.62, H.r[2] * 0.52];
  const cheeks = merge(...[1, -1].map((sd) => orb([sd * H.r[0] * 0.48, cheekC[1], cheekC[2]], cheekR, n, k, 'muzzle')));
  const snout = orbAlong(M.c, [0, 1, -0.1], [m[0], m[2], m[1]], n, k, 'muzzle');
  // The bridge of the nose, coat-coloured, down the top of the muzzle into the brow.
  const bridge = orbAlong([0, M.c[1] - m[1] * 0.15, M.c[2] + m[2] * 0.45], [0, 1, -0.15], [m[0] * 0.72, m[2] * 0.6, m[1] * 0.85], n, k, 'coat');
  const nose = orbAlong([0, M.c[1] + m[1] * 0.92, M.c[2] + m[2] * 0.36], [0, 1, 0.4], [m[0] * 0.42, m[0] * 0.26, m[0] * 0.3], 6, 3, 'nose');
  const mouth = s.eye.fierce < 0.3
    ? smile([0, M.c[1] + m[1] * 0.96, M.c[2] - m[2] * 0.22], [0, 1, -0.3], m[0] * 0.85, 'lid')
    : paint([1, -1].map((sd) => {
      const pts = Array.from({ length: 4 }, (_, q) => onEgg(M.c, m, [sd * (0.12 + 1.1 * (q / 3)), 1 - 0.75 * (q / 3), -0.5 - 0.25 * (q / 3)]));
      const v = [...pts.map((e) => add(e.p, scale(e.n, 0.02))), ...[...pts].reverse().map((e) => add(add(e.p, scale(e.n, 0.02)), [0, 0, -m[2] * 0.12]))];
      return { v: sd > 0 ? v : [...v].reverse(), m: 'lid' as Mat };
    }));
  // The inside of the mouth, a dark pink, seen only while the jaw hangs open.
  const throat = orbAlong([0, M.c[1] + m[1] * 0.05, M.c[2] - m[2] * 0.55], [0, 1, 0], [m[0] * 0.78, m[2] * 0.5, m[1] * 0.85], Math.min(n, 6), 3, 'inner');
  // Fluff out of each cheek, in three points swept back.
  const fluff = merge(...[1, -1].flatMap((sd) => [0, 1, 2].map((q) => {
    const p = onEgg([sd * H.r[0] * 0.48, cheekC[1], cheekC[2]], cheekR, [sd, -0.3 - 0.25 * q, 0.2 - 0.4 * q]);
    const dir = unit(add(p.n, [0, -0.9, -0.1 - 0.2 * q]));
    const L = s.cheek * (1 - 0.18 * q);
    return tube([sub(p.p, scale(p.n, 0.05)), add(p.p, scale(dir, L * 0.5)), add(p.p, scale(dir, L))], [L * 0.32, L * 0.2, 0.01], [L * 0.13, L * 0.08, 0.01], 4, q === 1 ? 'coat' : 'muzzle', { up: p.n });
  })));
  // Moss on the brow, in two leaf shapes, and a patch over one eye.
  const brow = onSkull(s, [0.12, 0.25, 1]), brow2 = onSkull(s, [-0.2, 0.05, 1]), over = onSkull(s, [-0.62, 0.42, 0.62]);
  const marks = paint([
    disc(add(brow.p, scale(brow.n, 0.02)), brow.n, H.r[0] * 0.3, H.r[1] * 0.2, 7, 'moss', { spin: 0.5 }),
    disc(add(brow2.p, scale(brow2.n, 0.022)), brow2.n, H.r[0] * 0.26, H.r[1] * 0.16, 7, 'mark', { spin: -0.4 }),
    disc(add(over.p, scale(over.n, 0.02)), over.n, H.r[0] * 0.22, H.r[0] * 0.16, 7, 'moss', { spin: 0.9 }),
  ]);
  return merge(skull, cheeks, bridge, snout, nose, mouth, throat, fluff, marks, eyesOf(s, shut));
}

/**
 * A tuft of leaves on the crown between the ears, a piece of its own so it
 * lies over the head. A pup's fans up from one root like a sprig, each leaf
 * leaning further back than the one before and out to alternate sides, so it
 * shows as a fan side on and as a spray of leaves face on; the others' lie
 * swept back over the neck.
 */
function crownOf(s: Vine): Mesh {
  const [cn, cl] = s.crown;
  return merge(...Array.from({ length: cn }, (_, q) => {
    const f = cn > 1 ? q / (cn - 1) : 0.5, side = q % 2 ? -1 : 1;
    if (s.stage === 0) {
      // From forward of upright (-45 degrees) to back past level (95), and out to a side by turns, the middle ones longest.
      const lean = (-45 + 140 * f) * Math.PI / 180, out = side * (0.3 + 0.3 * Math.abs(f - 0.5));
      const at = onSkull(s, [0, -0.05, 1]);
      const dir = unit([out, -Math.sin(lean), Math.cos(lean)]);
      const len = cl * (0.75 + 0.35 * Math.sin(Math.PI * f)) * (0.9 + 0.2 * jitter(q + 3));
      return leaf(sub(at.p, scale(at.n, 0.05)), dir, [side, 0.15, 0.1], len, len * 0.34, { droop: 0.22, mat: q % 2 ? 'leafDark' : 'leaf', rib: q % 2 ? 'leaf' : 'leafDark' });
    }
    const g = f - 0.5;
    const at = onSkull(s, [g * 0.5, -0.1 - 0.15 * Math.abs(g), 1]);
    const dir = unit([g * 0.5, -1.6, 0.7]);
    const len = cl * (1 - 0.5 * Math.abs(g)) * (0.85 + 0.3 * jitter(q + 3));
    return leaf(sub(at.p, scale(at.n, 0.04)), dir, [side, 0.5, 0.25], len, len * 0.32, { droop: 0.3, mat: q % 2 ? 'leafDark' : 'leaf', rib: q % 2 ? 'leaf' : 'leafDark' });
  }));
}

/** Where the lower jaw hinges, in the head's frame: under the back of the muzzle. */
const hingeOf = (s: Vine): V3 => { const M = muzzleOf(s); return [0, M.c[1] - M.r[1] * 0.6, M.c[2] - M.r[2] * 0.2]; };

/** The lower jaw, on its own bone from its hinge (`vineBones`): the underside of the muzzle with a pale chin and two fangs, closed up inside the muzzle. */
function jawOf(s: Vine, n: number, k: number): Mesh {
  const M = muzzleOf(s), m = M.r;
  const c: V3 = [0, M.c[1] + m[1] * 0.06, M.c[2] - m[2] * 0.52];
  const chin = orbAlong(c, [0, 1, -0.05], [m[0] * 0.78, m[2] * 0.42, m[1] * 0.88], Math.min(n, 7), Math.min(k, 4), 'muzzle');
  const fangs = s.stage > 0 && merge(...[1, -1].map((sd) => {
    const at: V3 = [sd * m[0] * 0.45, M.c[1] + m[1] * 0.62, M.c[2] - m[2] * 0.42];
    return tube([at, add(at, [0, 0.02, m[2] * 0.62])], [m[0] * 0.14, 0.006], [m[0] * 0.1, 0.006], 4, 'tooth');
  }));
  // Built in the head's frame and hung on a bone at the hinge: moved so the hinge is its origin, or it would sit a hinge's
  // length in front of the face.
  const h = hingeOf(s), m0 = merge(chin, fangs);
  return mesh(m0.v.map((v) => sub(v, h)), m0.f);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Vine): Array<{ c: V3; r: V3 }> {
  const M = muzzleOf(s);
  return [{ c: skullAt(s), r: scale(s.head.r, 0.9) }, { c: M.c, r: scale(M.r, 0.85) }];
}

/** A pointed ear, upright, facing forward and cupped: cream outside going to moss at the tip, pink inside with a pale tuft at its foot. */
function earOf(len: number, w: number, n: number): Mesh {
  const line0 = curve([0, 0, 0], [0, -0.05, len * 0.5], [0, 0.04, len], 5);
  const ws = [w * 0.68, w * 0.96, w, w * 0.7, w * 0.34, 0.015];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.38 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.025, x * 0.22)), n, (ring) => (ring >= 3 ? 'moss' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3].map((q) => cup([sd * ws[q] * 0.64, ws[q] * 0.24 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.08]), ...side(-1), cup([0, 0.03, len * 0.72]), ...side(1).reverse()];
  const tuft = [cup([-w * 0.3, w * 0.2 + 0.02, len * 0.06]), cup([0, w * 0.22 + 0.02, len * 0.4]), cup([w * 0.3, w * 0.2 + 0.02, len * 0.06])];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }, { v: tuft, m: 'coatLight' }]));
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A paw: a soft mitten a little forward of the ankle with three toes on its front, and on the hunters a claw out of each. `r` across, its sole `drop` under the ankle. */
function pawOf(s: Vine, r: number, drop: number, n: number, k: number, shank = 0): Mesh {
  const mat: Mat = s.stockings ? 'coatDark' : 'coatLight';
  const toes = merge(...[-1, 0, 1].map((q) => orb([q * r * 0.42, r * 0.95, -drop + r * 0.22], [r * 0.25, r * 0.3, r * 0.22], 5, 3, 'muzzle')));
  const claws = s.stage > 0 && merge(...[-1, 0, 1].map((q) => tube([[q * r * 0.42, r * 1.15, -drop + r * 0.25], [q * r * 0.44, r * 1.38, -drop + r * 0.04]], [r * 0.08, 0.006], [r * 0.07, 0.006], 4, 'claw')));
  // A hind foot's long bone, the heel up at the hock, down to the paw.
  const foot = shank > 0 && tube([[0, -shank * 0.3, 0.06], [0, r * 0.1, -drop * 0.5], [0, r * 0.3, -drop + r * 0.55]], [shank, shank * 0.85, shank * 0.8], [shank, shank * 0.85, shank * 0.8], Math.min(n, 7), mat, { seam: 'start' });
  return merge(orbAlong([0, r * 0.35, -drop + r * 0.5], [0, 1, 0], [r, r * 0.62, r * 1.25], n, k, mat), toes, claws, foot);
}

/**
 * A mesh mottled in moss: of its faces that are not painted on it, those
 * higher than `z0` in its own frame (or every one, with no `z0`) turned moss
 * or the darker green by turns, in drifts of their own, `share` of them,
 * more of them the higher they are.
 */
function mottled(m: Mesh, share: number, seed: number, z0 = -Infinity, z1 = z0 + 1, belly = -Infinity, brown = false): Mesh {
  return mesh(m.v, m.f.map((f, q) => {
    if (f.decal || f.m !== 'coat') return f;
    let z = 0, y = 0, x = 0;
    for (const i of f.i) { x += m.v[i][0]; y += m.v[i][1]; z += m.v[i][2]; }
    x /= f.i.length; y /= f.i.length; z /= f.i.length;
    if (z < belly) return { ...f, m: 'belly' as Mat };
    const up = z0 === -Infinity ? 1 : 0.5 + 0.5 * clamp((z - z0) / (z1 - z0));
    // Drifts: a slow wave over the surface, so moss comes in patches rather than in single facets.
    const drift = 0.55 + 0.25 * Math.sin(y * 3.4 + seed) + 0.25 * Math.cos(x * 3.7 + z * 3.1 + y * 1.3 + seed * 2) + 0.12 * (jitter(q + seed * 31) - 0.5);
    const k = drift * up;
    if (k <= 1 - share) return f;
    // The darkest drifts green-brown on the hunters, as their backs are.
    const deep = k > 1 - share * 0.32;
    return { ...f, m: (deep ? (brown && jitter(q * 3 + seed) < 0.5 ? 'coatDark' : 'mark') : 'moss') as Mat };
  }));
}

/** Its shoulders and haunches: an egg over each leg, part of the barrel, reaching down to where the leg comes out from under the body. */
function quartersOf(s: Vine): Array<{ c: V3; r: V3 }> {
  const spec = specOf(s), w = s.thick, hip = spec.hind.at, sh = spec.fore.at;
  return [1, -1].flatMap((sd) => [
    { c: [sd * (hip[0] + w * 0.15), hip[1] + 0.02, hip[2] + 0.16] as V3, r: [w * 1.25 + 0.08, w * 1.7 + 0.12, s.body.h[2] * 0.55] as V3 },
    { c: [sd * (sh[0] + w * 0.1), sh[1] - 0.02, sh[2] + 0.2] as V3, r: [w * 1.05 + 0.08, w * 1.35 + 0.1, s.body.h[4] * 0.5] as V3 },
  ]);
}

/**
 * Where the outside of its trunk is, `y` along it and `th` round it from its
 * right side: on the barrel, or out on a shoulder or a haunch where one bulges
 * past it -- whichever is furthest out along the way from the barrel's middle
 * line -- and the way out of it there.
 */
function onCoat(s: Vine, eggs: ReadonlyArray<{ c: V3; r: V3 }>, y: number, th: number): { p: V3; n: V3 } {
  const B = onRings(s.body, y, th);
  const axis: V3 = [0, y, B.p[2] - Math.sin(th) * ringH(s.body, y)];
  const d = unit(sub(B.p, axis));
  let best = B, far = dot(sub(B.p, axis), d);
  for (const e of eggs) {
    // Where the ray out from the middle line along `d` leaves this egg, if it goes through it.
    const o: V3 = [(axis[0] - e.c[0]) / e.r[0], (axis[1] - e.c[1]) / e.r[1], (axis[2] - e.c[2]) / e.r[2]];
    const v: V3 = [d[0] / e.r[0], d[1] / e.r[1], d[2] / e.r[2]];
    const A = dot(v, v), Bq = 2 * dot(o, v), C = dot(o, o) - 1, disc2 = Bq * Bq - 4 * A * C;
    if (disc2 <= 0) continue;
    const t = (-Bq + Math.sqrt(disc2)) / (2 * A);
    if (t <= far) continue;
    far = t;
    const p = add(axis, scale(d, t));
    best = { p, n: unit([(p[0] - e.c[0]) / (e.r[0] * e.r[0]), (p[1] - e.c[1]) / (e.r[1] * e.r[1]), (p[2] - e.c[2]) / (e.r[2] * e.r[2])]) };
  }
  return best;
}
/** How deep the barrel is at `y`. */
function ringH(R: Rings, y: number): number {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  return lerp(R.h[k], R.h[k + 1], clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k])));
}

/** A painted shape's corners wound so it faces out along `n`, as a decal must to be seen from that side. */
function facingOut(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}

/**
 * A soft blot of colour laid on a surface: its edge a wobbling round, each
 * corner put on the surface (`at`, from two numbers round its middle), and
 * lifted off it by `lift`, so it bends round the body as paint does rather
 * than standing off it flat.
 */
function blot(at: (u: number, v: number) => { p: V3; n: V3 }, ru: number, rv: number, lift: number, m: Mat, seed: number, corners = 12): Disc {
  const v: V3[] = [];
  let nn: V3 = [0, 0, 0];
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * TAU, wob = 1 + 0.2 * Math.sin(3 * a + seed * 5.3) + 0.12 * Math.sin(5 * a + seed * 2.1);
    const q = at(Math.cos(a) * ru * wob, Math.sin(a) * rv * wob);
    v.push(add(q.p, scale(q.n, lift)));
    nn = add(nn, q.n);
  }
  return { v: facingOut(v, nn), m };
}

/**
 * Its moss: big soft patches of it over the back, the shoulders and the
 * haunches and down onto the flanks, each a blot of moss with a darker one
 * laid over part of it (and on the hunters a blot of brown now and then),
 * the cream showing between, as the concept's coat is painted.
 */
function patchesOf(s: Vine): Mesh {
  const eggs = quartersOf(s), out: Disc[] = [], L = s.len * 0.5;
  // Each patch: along the body (a share of half its length), how far up round it (radians from the side), how long and how far round.
  const spots: Array<[number, number, number, number]> = s.stage
    ? [[0.72, 1.05, 0.26, 0.55], [0.25, 1.2, 0.28, 0.5], [-0.25, 1.0, 0.3, 0.55], [-0.72, 0.95, 0.3, 0.6], [0.55, 0.3, 0.2, 0.35], [-0.6, 0.2, 0.22, 0.35], [0, 0.45, 0.18, 0.3]]
    : [[0.62, 1.0, 0.3, 0.55], [-0.15, 1.25, 0.3, 0.5], [-0.7, 0.75, 0.3, 0.6], [0.35, 0.35, 0.2, 0.35], [-0.45, 0.2, 0.18, 0.3]];
  spots.forEach(([fy, th, ry, rth], q) => {
    for (const sd of [1, -1]) {
      const id = q * 3 + (sd > 0 ? 0 : 41);
      const y0 = (fy + 0.08 * (jitter(id) - 0.5)) * L, t0 = th + 0.15 * (jitter(id + 1) - 0.5);
      const at = (dy: number) => (u: number, v: number) => { const e = onCoat(s, eggs, y0 + dy + u, t0 + v); return sd > 0 ? e : left(e); };
      out.push(blot(at(0), ry * L * 1.5, rth * 1.35, 0.025, 'moss', id));
      // A darker blot over part of it, off to one side.
      out.push(blot(at(ry * L * 0.5 * (jitter(id + 2) - 0.5)), ry * L * 0.75, rth * 0.6, 0.035, s.stage && jitter(id + 3) < 0.35 ? 'coatDark' : 'mark', id + 7, 10));
    }
  });
  return paint(out);
}

/** Moss on the shoulder or the thigh: a blot down the outside of the upper leg and one inside, on its own tube (down it is -z). */
function legMoss(s: Vine, fore: boolean): Mesh {
  const L = (fore ? 0.5 : 0.46) * s.legs, w = s.thick * (fore ? 1.35 : 1.5);
  const at = (a0: number) => (u: number, v: number) => ({ p: [Math.cos(a0 + v) * w, Math.sin(a0 + v) * w * 0.9, -L * 0.3 + u] as V3, n: [Math.cos(a0 + v), Math.sin(a0 + v), 0] as V3 });
  return paint([blot(at(0.2), L * 0.3, 0.8, 0.02, 'moss', fore ? 4 : 6), blot(at(Math.PI - 0.2), L * 0.25, 0.7, 0.02, 'moss', fore ? 5 : 8)]);
}

/** Moss on the neck: a blot over the back of it and one on each side, on the neck's own tube (up it is z, its back -y). */
function neckMoss(s: Vine): Mesh {
  const w = s.neck.w, h = s.neck.w * 0.95, L = s.neck.len;
  const at = (z0: number, a0: number) => (u: number, v: number) => {
    const a = a0 + v, z = z0 + u;
    return { p: [Math.cos(a) * w, Math.sin(a) * h, z] as V3, n: unit([Math.cos(a) / w, Math.sin(a) / h, 0]) };
  };
  return paint([
    blot(at(L * 0.45, -Math.PI / 2 + 0.1), L * 0.5, 0.9, 0.025, 'moss', 3),
    blot(at(L * 0.3, -0.5), L * 0.35, 0.5, 0.025, 'moss', 5),
    blot(at(L * 0.55, -Math.PI + 0.5), L * 0.35, 0.5, 0.025, 'mark', 7),
  ]);
}

/** The leaves on its back: each row down both sides (`Vine.back`), a leaf stood up off the barrel and swept back, bigger toward the middle. */
function backOf(s: Vine): Mesh {
  const out: Mesh[] = [];
  s.back.forEach((row, ri) => {
    const ridge = Math.abs(row.th - Math.PI / 2) < 0.01;
    for (const sd of ridge ? [1] : [1, -1]) {
      for (let q = 0; q < row.count; q++) {
        const id = ri * 31 + q * 3 + (sd > 0 ? 0 : 17);
        const f = row.count > 1 ? q / (row.count - 1) : 0.5;
        const y = lerp(row.y1, row.y0, f) + (ridge ? 0.04 * (jitter(id) - 0.5) : 0.14 * (jitter(id + 1) - 0.5));
        const th0 = row.th + (ridge ? 0.18 * (q % 2 ? 1 : -1) : 0.12 * (jitter(id + 2) - 0.5));
        const at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
        const big = (0.72 + 0.4 * Math.sin(Math.PI * (0.15 + 0.7 * f))) * (0.85 + 0.3 * jitter(id + 4));
        const st = (row.stand + 10 * (jitter(id + 5) - 0.5)) * Math.PI / 180;
        const back = unit(sub([0, -1, 0], scale(at.n, dot([0, -1, 0], at.n))));
        const dir = unit(add(scale(at.n, Math.sin(st)), scale(back, Math.cos(st))));
        const L = row.len * big;
        // A leaf on the ridge turned to face out to one side or the other, so it shows broad side on rather than edge on.
        const face = ridge ? unit([q % 2 ? 1 : -1, 0, 0.45]) : at.n;
        out.push(leaf(sub(at.p, scale(at.n, 0.05)), dir, face, L, row.w * big, { droop: 0.25 + 0.2 * jitter(id + 6), mat: row.mat ?? (q % 3 === 2 ? 'leafDark' : 'leaf'), rib: row.mat === 'leafDark' || q % 3 === 2 ? 'leaf' : 'leafDark', twist: (jitter(id + 7) - 0.5) * 0.6 }));
      }
    }
  });
  // Vines hanging from the shoulders and hips, each a curl of stem down the flank with leaves along it.
  const [dn, dl] = s.drapes;
  for (const sd of [1, -1]) {
    for (let q = 0; q < dn; q++) {
      const y = lerp(s.body.y[4], s.body.y[2], q / Math.max(1, dn - 1)) * 0.9;
      const at0 = onRings(s.body, y, 0.95), at = sd > 0 ? at0 : left(at0);
      const pts = curve(sub(at.p, scale(at.n, 0.02)), add(at.p, [sd * 0.25, -dl * 0.45, -dl * 0.25]), add(at.p, [sd * 0.18, -dl * 0.95, -dl * 0.6]), 4);
      out.push(tube(pts, [0.05, 0.045, 0.04, 0.032, 0.02], [0.05, 0.045, 0.04, 0.032, 0.02], 5, 'stem'));
      for (let e = 1; e <= 4; e++) {
        const p = pts[e], d = unit(sub(pts[e], pts[e - 1]));
        const out2 = unit(add(cross(d, [0, 0, 1]), [0, 0, -0.3]));
        out.push(leaf(p, unit(add(scale(out2, e % 2 ? sd : -sd), scale(d, 0.6))), [sd, 0, 0.6], 0.32 + 0.06 * e, 0.11, { droop: 0.3, mat: e % 2 ? 'leaf' : 'leafDark' }));
      }
    }
  }
  return merge(...out);
}

/** Leaves down the back of the neck, from behind the ears, swept back toward the ridge of the back. */
function maneOf(s: Vine): Mesh {
  const [count, L0] = s.mane, out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const f = count > 1 ? q / (count - 1) : 0;
    for (const sd of [1, -1]) {
      const z = lerp(s.neck.len * 0.95, 0, f), th = (sd > 0 ? 0.55 : Math.PI - 0.55) + 0.2 * (jitter(q) - 0.5);
      const root: V3 = [Math.cos(th) * s.neck.w * 0.85, -s.neck.w * 0.35, z];
      // On the neck's own bone: back is -y and up the neck is z.
      const dir = unit([Math.cos(th) * 0.45, -1, 0.35 - 0.25 * f]);
      const L = L0 * (0.8 + 0.35 * Math.sin(Math.PI * (0.2 + 0.6 * f))) * (0.9 + 0.2 * jitter(q + 9));
      out.push(leaf(root, dir, [Math.cos(th), 0, Math.sin(th) + 0.6], L, L * 0.28, { droop: 0.3, mat: (q + (sd > 0 ? 0 : 1)) % 2 ? 'leafDark' : 'leaf' }));
    }
  }
  return merge(...out);
}

/**
 * The tail's links: a pup's a bush of fur fat in the middle and patterned in
 * leaf shapes of moss, with a leaf sprouting here and there; the hunters' a
 * vine, a thin stem with a leaf out of every link, turning from one side to
 * the other down it, and a big leaf at its tip.
 */
function tailOf(s: Vine, T: Tail, n: number, which: number): Mesh[] {
  const N = T.links.length;
  return T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, N - 1)];
    if (T.bush) {
      const fur = tube([[0, 0.06, 0], [0, -L * 0.5, 0], [0, -L - 0.06, 0]], [w0, (w0 + w1) / 2 * 1.04, w1], [w0, (w0 + w1) / 2 * 1.04, w1], Math.min(n, 8),
        (ring) => (q === N - 1 && ring >= 1 ? 'coatLight' : 'coat'), { seam: 'both' });
      // Leaf-shaped blots of moss round it, turning from one side over the top to the other down its length.
      const wm = (w0 + w1) / 2 * 1.06, a0 = Math.PI / 2 + (q % 3 - 1) * 1.1;
      const on = (a1: number) => (u: number, v: number) => ({ p: [wm * Math.cos(a1 + v), -L * 0.5 + u, wm * Math.sin(a1 + v)] as V3, n: [Math.cos(a1 + v), 0, Math.sin(a1 + v)] as V3 });
      const moss = q < N - 1 && paint([blot(on(a0), L * 0.55, 0.9, 0.02, q % 2 ? 'mark' : 'moss', q + 3), blot(on(a0 + Math.PI), L * 0.45, 0.7, 0.02, 'moss', q + 9)]);
      const sprout = (q === 2 || q === 4) && leaf([0, -L * 0.4, w0 * 0.85], [q === 2 ? 0.4 : -0.4, -0.6, 0.8], [0, 0, 1], 0.24, 0.08, { droop: 0.2 });
      // The tip a soft point of fur.
      const tip = q === N - 1 && tube([[0, -L, 0], [0, -L - w1 * 1.4, 0]], [w1, 0.01], [w1, 0.01], Math.min(n, 7), 'coatLight');
      return merge(fur, moss, sprout, tip);
    }
    const stem = tube([[0, 0.04, 0], [0, -L - 0.04, 0]], [w0, w1], [w0, w1], 5, 'stem', { seam: 'both' });
    const sd = (q + which) % 2 ? 1 : -1;
    // A leaf out of every link, off alternate sides and lying back along the vine; none on the first, by the body.
    const lf = q > 0 && q % 2 === 1 && leaf([sd * w0 * 0.6, -L * 0.5, w0 * 0.3], [sd * 1, -0.55, 0.45], [sd * 0.3, 0.1, 1], T.leaf * (0.75 + 0.35 * jitter(q + which * 20)), T.leaf * 0.4, { droop: 0.35, mat: q % 3 ? 'leaf' : 'leafDark', rib: q % 3 ? 'leafDark' : 'leaf' });
    const tip = q === N - 1 && merge(
      leaf([0, -L, 0], [0.15, -1, 0.1], [0.2, 0, 1], T.tipLeaf, T.tipLeaf * 0.42, { droop: 0.2 }),
      leaf([0, -L * 0.85, 0], [-0.7, -0.8, 0.15], [-0.2, 0, 1], T.tipLeaf * 0.55, T.tipLeaf * 0.24, { droop: 0.3, mat: 'leafDark', rib: 'leaf' }),
    );
    return merge(stem, lf, tip);
  });
}

/** A mesh with each face that is not painted on coloured as `by` says for where its middle is, or left as it is. */
function shaded(m: Mesh, by: (c: V3) => Mat | null): Mesh {
  return mesh(m.v, m.f.map((f) => {
    if (f.decal) return f;
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const to = by(c);
    return to ? { ...f, m: to } : f;
  }));
}

/**
 * What it catches: a small fawn beast gone limp -- a round head with a dark
 * eye and long dark-tipped ears, a white belly and a darker back, four legs
 * and a long thin tail with a pale tip. On the ground it lies on its side,
 * turned partly round so it shows its length from most of the ways it is
 * seen; in the jaws it is held by the scruff, its head up in the bite and its
 * body hanging under them a little forward of the chest, its legs splayed
 * and dangling and its tail hanging straight down below it.
 */
function preyOf(s: Vine, held: boolean, n: number): Mesh {
  const r = [0.34, 0.48, 0.56][s.stage];
  // Along it from its rump (-1) to its neck (1): lying across (along x), or hanging down from the neck, a little forward.
  const along = (u: number): V3 => (held ? [0, r * 0.35 * (1 - u), -(1 - u) * r * 1.4] : [u * r * 1.4, 0, r * 0.55]);
  const pts = [-1, -0.5, 0, 0.5, 1].map(along);
  // Its back toward the hunter's chest (or up, lying), its belly away: white.
  const back: V3 = held ? [0, -1, 0] : [0, 0, 1];
  const body = shaded(tube(pts, [r * 0.46, r * 0.7, r * 0.74, r * 0.62, r * 0.42], [r * 0.46, r * 0.7, r * 0.74, r * 0.62, r * 0.42], Math.min(n, 8), 'shell', { up: held ? [1, 0, 0] : [0, 0, 1] }),
    (c) => {
      // How far toward its back it is from the line down its middle.
      const k = dot(sub(c, held ? [0, -0.25 * c[2], c[2]] : [c[0], 0, r * 0.55]), back) / r;
      return k > 0.35 ? 'shellDark' : k < -0.3 ? 'coatLight' : null;
    });
  const neck = pts[4], rump = pts[0];
  // The head: on the ground out beyond the neck; in the jaws, tipped back up out of the bite.
  const hr = r * 0.48, headAt = held ? add(neck, [0, r * 0.28, r * 0.22]) : add(neck, [r * 0.5, 0, 0]);
  const face: V3 = held ? [0, 1, 0.5] : [1, 0, -0.1];
  const eyesAt = [1, -1].map((q) => onEgg(headAt, [hr, hr * 0.92, hr], held ? [q * 0.7, 0.55, 0.45] : [0.55, q * 0.7, 0.45]));
  const head = merge(
    orb(headAt, [hr, hr * 0.92, hr], Math.min(n, 7), 4, 'shell'),
    orbAlong(add(headAt, scale(unit(face), hr * 0.85)), face, [hr * 0.5, hr * 0.45, hr * 0.5], 5, 3, 'coatLight'),
    paint(eyesAt.map((e) => disc(add(e.p, scale(e.n, 0.015)), e.n, hr * 0.2, hr * 0.2, 6, 'eye'))),
    ...[1, -1].map((q) => {
      const ear = held
        ? [add(headAt, [q * hr * 0.4, -hr * 0.3, hr * 0.4]), add(headAt, [q * hr * 0.95, -hr * 0.6, -hr * 0.2]), add(headAt, [q * hr * 1.1, -hr * 0.7, -hr * 1.1])]
        : [add(headAt, [-hr * 0.2, q * hr * 0.35, hr * 0.6]), add(headAt, [-hr * 1.1, q * hr * 0.6, hr * 0.95]), add(headAt, [-hr * 1.9, q * hr * 0.7, hr * 1.0])];
      return tube(ear as V3[], [hr * 0.28, hr * 0.3, hr * 0.08], [hr * 0.1, hr * 0.1, hr * 0.06], 4, (ring) => (ring === 2 ? 'shellDark' : 'shell'), { up: held ? [0, 1, 0] : [0, 0, 1] });
    }),
  );
  // The tail: thin, hanging down from the rump, its tip pale.
  const tailEnd = held ? add(rump, [0, r * 0.15, -r * 1.6]) : add(rump, [-r * 1.5, r * 0.3, -r * 0.35]);
  const tail = tube(curve(add(rump, held ? [0, -r * 0.1, -r * 0.2] : [-r * 0.25, 0, 0]), scale(add(rump, tailEnd), 0.5), tailEnd, 3), [r * 0.12, r * 0.1, r * 0.08, r * 0.05], [r * 0.12, r * 0.1, r * 0.08, r * 0.05], 4,
    (ring) => (ring >= 2 ? 'coatLight' : 'shell'));
  const legs = merge(...[[-0.6, 1, 1.35], [-0.6, -1, 1.35], [0.45, 1, 1], [0.45, -1, 1]].map(([u, side, len]) => {
    const p = along(u);
    const foot: V3 = held ? add(p, [side * r * 0.75, r * (u > 0 ? 1.0 : 0.45), -r * (u > 0 ? 0.45 : 0.7) * len]) : add(p, [u * r * 0.5 + (u < 0 ? -r * 0.4 : r * 0.2), side * r * 0.6 * len, -r * 0.45]);
    return tube([add(p, held ? [side * r * 0.35, r * 0.15, 0] : [0, side * r * 0.3, -r * 0.15]), foot], [r * 0.16, r * 0.1], [r * 0.16, r * 0.1], 4, 'shell');
  }));
  const all = merge(body, head, tail, legs);
  // Held, swung a little forward off the chest and turned partly round, so it shows its side and its belly both.
  return held ? moved(all, [0, 0, 0], 32, 18) : moved(all, [0, 0, 0], 35);
}

/** How far a point is up off the body's barrel, against its height there: nought on it, one a body's height out. */
function outOf(R: Rings, p: V3): number {
  const y = clamp(p[1], R.y[0], R.y[R.y.length - 1]);
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  return Math.max(0, Math.hypot(p[0] / w, (p[2] - z) / h) - 1);
}

/**
 * Its back bent through a bound and a pounce (`flexOf`), and its leaves
 * rustling: each corner of a leaf stirred by as much as it stands out from
 * the barrel, in a ripple running back along it -- in a gust now and then
 * as it stands, and all the time as it goes, faster at a run.
 */
function flexed(s: Vine, leaves: boolean): (v: readonly V3[], a: Anim) => V3[] {
  const reach = new WeakMap<readonly V3[], Float32Array>();
  const half = s.body.y[s.body.y.length - 1];
  return (v, a) => {
    const arch = flexOf(s, a);
    let stir = 0, ph = 0;
    if (leaves) {
      const gust = beat(a.t, [2.3, 9.1, 14.8, 20.4], 1.6) * (1 - a.go);
      stir = 0.05 * gust + a.go * (0.05 + 0.05 * a.gait) + (a.act ? 0.08 * (a.act.kind === 'strike' ? hump(a.act.t, VINE_STRIKE.hit + 0.05, 0.25) : a.act.kind === 'work' ? workOf(a.act.t, a.go).shake + 0.5 * workOf(a.act.t, a.go).fly : 0) : 0);
      ph = a.go > 0 ? frac(a.u) * 2 : a.t * 1.5;
    }
    if (!arch && !stir) return v as V3[];
    let w = reach.get(v);
    if (!w && leaves) {
      w = new Float32Array(v.length);
      for (let i = 0; i < v.length; i++) w[i] = Math.min(1.6, outOf(s.body, v[i]));
      reach.set(v, w);
    }
    return v.map((p, i) => {
      const along = arch * Math.max(0, 1 - (p[1] / half) ** 2);
      if (!w || !w[i]) return [p[0], p[1], p[2] + along] as V3;
      const e = w[i] * stir, q = TAU * ph + p[1] * 2.2 + p[0] * 1.3;
      return [p[0] + e * Math.sin(q), p[1] + e * 0.5 * Math.cos(q * 1.3), p[2] + along + e * 0.4 * Math.sin(q + 1)] as V3;
    });
  };
}

/** A stage's pieces: a fox-cat's body (`quadPieces`) with its own head, jaw, ears, paws and tails, its moss and its leaves, and what it catches. */
function vineBuild(s: Vine, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const skull = headSolids(s)[0], w = s.thick;
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = (fore ? 0.5 : 0.46) * s.legs;
    return { upper: [fore ? 0.26 : 0.1, -L, w * (fore ? 1.6 : 1.9), w * 1.05], lower: [0, -(fore ? 0.46 : 0.42) * s.legs, w, w * 0.8], foot: pawOf(s, s.paw, fore ? s.paw * 0.55 : hock(s), n, k, fore ? 0 : w * 0.75) };
  };
  // Shoulders and haunches, part of the barrel: a mass over each leg reaching down to where it comes out from under the body.
  const quarters = merge(...quartersOf(s).map((e) => orb(e.c, e.r, n, k, 'coat')));
  // A pup's chest a ruff of fluff, pale, in points.
  const ruff = s.stage === 0 && merge(...[-0.5, 0, 0.5].map((x, q) => {
    const at = onRings(s.body, s.body.y[5] * 0.95, -Math.PI / 2 + x);
    const dir = unit(add(at.n, [0, 0.6, -0.4]));
    return tube([sub(at.p, scale(at.n, 0.06)), add(at.p, scale(dir, 0.12)), add(at.p, scale(dir, 0.22 - 0.03 * q))], [0.13, 0.08, 0.01], [0.07, 0.05, 0.01], 4, 'muzzle', { up: at.n });
  }));
  const flex = flexed(s, false), rustle = flexed(s, true);
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.95, len: s.neck.len },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: -40,
    tail: [],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras: [
      { key: 'back', mesh: backOf(s), bone: 'trunk', bias: 0.1, after: ['body', 'neck'], bent: rustle },
      ...(s.mane[0] ? [{ key: 'mane', mesh: maneOf(s), bone: 'neck', bias: 0.11, after: ['neck', 'body'], under: ['head'] } as Piece] : []),
      { key: 'crown', mesh: crownOf(s), bone: 'head', bias: 0.21, after: ['head'], hide: [skull] },
      { key: 'jaw', mesh: jawOf(s, n, k), bone: 'jaw', bias: 0.19, under: ['head'], hide: [skull], hideIn: 'head' },
      { key: 'preyGround', mesh: preyOf(s, false, n), bone: 'preyGround', bias: 0, shown: (a) => a.act?.kind === 'work' },
      { key: 'preyHeld', mesh: preyOf(s, true, n), bone: 'preyHeld', bias: 0.22, after: ['jaw'], shown: (a) => a.act?.kind === 'work' },
    ],
  });
  s.tails.forEach((T, which) => tailOf(s, T, n, which).forEach((m, q) => pieces.push({ key: `${which ? 'vine' : 'tail'}${q}`, mesh: m, bone: `${which ? 'vine' : 'tail'}${q}`, bias: -0.05 + q * 0.004, chain: which ? 'vine' : 'tail' })));
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    // Moss over its back and down its flanks in drifts, cream under it.
    if (pc.key === 'body') return { ...pc, mesh: merge(mottled(merge(pc.mesh, quarters), 0, 3, -Infinity, 0, s.stage ? -s.body.h[3] * 0.5 : -Infinity), ruff, patchesOf(s)), bent: flex };
    if (pc.key === 'neck') return { ...pc, mesh: merge(pc.mesh, neckMoss(s)) };
    // Moss on the thighs and shoulders; on a pup on its legs too.
    if (/^[fh][lr]0$/.test(pc.key)) return { ...pc, mesh: merge(pc.mesh, legMoss(s, pc.key[0] === 'f')) };
    // Brown stockings down the lower legs of the hunters.
    if (s.stockings && /^[fh][lr][12]$/.test(pc.key)) return { ...pc, mesh: recoloured(pc.mesh, 'coat', 'coatDark') };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [176, 166, 140];
/** The two greens of a leaf shaken loose, the same on every variant. */
const LOOSE: readonly [RGB, RGB] = [[132, 170, 86], [92, 128, 66]];

/** A soft puff of dust at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, at);
  g.fillStyle = css(DUST, al);
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.5, 0, 0, TAU);
  g.fill();
}

/** A loose leaf in the air, `r` long, turned `ang`, tumbling: a pointed oval with a rib down it. */
function looseLeaf(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const ca = Math.cos(ang), sa = Math.sin(ang), wide = r * 0.38 * Math.abs(Math.cos(ang * 2.3));
  g.fillStyle = css(c, al);
  g.beginPath();
  g.moveTo(x - ca * r, y - sa * r);
  g.quadraticCurveTo(x - sa * wide * 2, y + ca * wide * 2, x + ca * r, y + sa * r);
  g.quadraticCurveTo(x + sa * wide * 2, y - ca * wide * 2, x - ca * r, y - sa * r);
  g.fill();
  g.strokeStyle = css(darker(c, 0.35), al);
  g.lineWidth = Math.max(0.05, r * 0.14);
  g.stroke();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, drifting down as a leaf does. */
const drifted = (p: V3, v: V3, s: number): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 3 * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/**
 * Leaves shaken off it, and dust: as the strike lands, a puff where its fore
 * paws come down and leaves flicked off the tip of its lash; at its task, a
 * puff as it lands on its kill and leaves knocked loose as it shakes it.
 */
function scatter(g: CanvasRenderingContext2D, view: View, s: Vine, b: Bones, a: Anim, front: boolean, leafC: RGB, darkC: RGB): void {
  const act = a.act;
  if (!act || (act.kind !== 'strike' && act.kind !== 'work')) return;
  const strike = act.kind === 'strike', t0 = strike ? VINE_STRIKE.hit : VINE_WORK.land;
  if (act.t < t0 || (!strike && a.go > 0)) return;
  const since = (act.t - t0) * ACT_SECS[act.kind], mid = b.body.t, big = s.size * (1 + s.stage * 0.4) / 1.9;
  // The dust where the fore paws come down.
  const paws: V3 = scale(add(place(b.fl2, [0, 0, 0]), place(b.fr2, [0, 0, 0])), 0.5);
  const ground: V3 = [paws[0], paws[1] + s.paw, 0.05];
  if (front === nearSide(ground, mid, view)) dust(g, view, add(ground, [0, 0, 0.5 * since]), (0.5 + 2.4 * since) * big, 0.42 * (1 - smooth(since / 0.3)));
  // Leaves off it: from the lash's tip as the strike cracks it, or from its back as it shakes its kill.
  const tails = s.tails.length && !s.tails[0].bush;
  const from = strike && tails ? place(b[`tail${s.tails[0].links.length - 1}`], [0, -0.3, 0]) : place(b.body, [0, 0, s.body.h[3] + 0.1]);
  const count = strike ? (tails ? 6 : 3) : 5;
  for (let q = 0; q < count; q++) {
    const ang = jitter(q + 3) * TAU, sp = (1.2 + 1.6 * jitter(q + 9)) * big;
    const p = drifted(from, [Math.cos(ang) * sp, Math.sin(ang) * sp, 1.5 + 2.5 * jitter(q + 5)], since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    looseLeaf(g, x, y, (0.14 + 0.08 * jitter(q + 1)) * big, q * 1.9 + since * 9 * (q % 2 ? 1 : -1), q % 2 ? darkC : leafC, 1 - smooth((since - 0.3) / 0.25));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes and hunts. */
function vineKind(s: Vine): Kind {
  return {
    bones: vineBones(s),
    build: (lod) => vineBuild(s, lod),
    // The variant's coat is its fur and its markings its moss; the leaves are the markings' green made leafier, the stockings a
    // warm brown, and the eyes dark on a pup and amber-green on the hunters.
    palette: (coat, mark) => {
      const fur = mix(pastel(coat, 40), coat, 0.75);
      const moss = mix(pastel(mark, 90), mark, 0.85), leafC = mix(moss, [128, 170, 84], 0.25);
      return coatPalette(coat, mark, {
        coat: fur,
        coatLight: mix(fur, [255, 252, 240], 0.45),
        coatDark: mix(mix(fur, [118, 92, 54], 0.62), moss, 0.12),
        belly: mix(fur, [255, 250, 238], 0.35),
        muzzle: mix(fur, [255, 252, 242], 0.38),
        mark: darker(moss, 0.22),
        moss: darker(moss, 0.06),
        leaf: leafC,
        leafDark: darker(leafC, 0.28),
        stem: mix(darker(moss, 0.3), [120, 96, 60], 0.35),
        inner: [232, 160, 160],
        nose: [70, 50, 48],
        lid: [70, 52, 50],
        eye: [34, 26, 28],
        crystal: s.stage ? [214, 196, 70] : [92, 66, 48],
        crystalDark: s.stage ? [140, 150, 50] : [58, 40, 34],
        claw: [236, 228, 210],
        tooth: [248, 244, 232],
        shell: [170, 132, 94],
        shellDark: [104, 76, 56],
      }, 40);
    },
    shadow: [s.len * 0.8, s.body.w[4] * 1.05],
    stride: 1.2,
    size: s.size,
    leaps: [false, true],
    acts: ['strike', 'work'],
    extra: (g, view, b, a, under) => scatter(g, view, s, b, a, !under, LOOSE[0], LOOSE[1]),
  };
}

export const SNAREPUP = vineKind(SNAREPUP_LOOK);
export const LASHRUNNER = vineKind(LASHRUNNER_LOOK);
export const VINEHUNTER = vineKind(VINEHUNTER_LOOK);
