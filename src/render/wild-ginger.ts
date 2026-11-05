import {
  ACT_SECS, add, beat, bipedBones, clamp, cross, cyc, DEG, coatPalette, dot, drift, frac, lerp, merge, mix, moved,
  onEgg, orb, orbAlong, paint, scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones,
  type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The gingerbread line, Christmas's own (the species is `crumbud`): the Crumbud, a little round gingerbread kid under a thick
 * cap of white icing dripping down its brow, holly and red berries on top, two twig nubs, two icing buttons down its front and
 * icing round its wrists and ankles; which grows into the Gingerbark, a tall lanky gingerbread treant with branching cookie
 * twigs off its crown capped in icing snow, a gold star cookie at the top, baubles hung in the twigs, a red bow tie with holly
 * at its neck and icing piped in swirls over its body; and then the Yuleheart, a huge gingerbread colossus, a wide rack of
 * icing-capped branches across its top hung with gold bells, red bows and snowflake cookies, a cookie plate on its chest with a
 * snowflake piped on it, two red scarves hanging from its shoulders and icing over its shoulders, fists and feet, red and green
 * gumdrops set in it.
 *
 * Every stage glows amber in the eyes and grins. All three are built by one set of functions from a description of the stage
 * (`Ginger`). It walks with a cheerful rolling stomp, punches with its big round fists, and its Taunt (`cast`, and at its watch
 * `work`) is a chest-thump, twice, arms flung wide after, a ring of gold and white going out over the ground at each thump.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** How an arm is held: forward, out to its side, the elbow bent, and the upper arm turned about itself (degrees). */
type Hold = readonly [number, number, number, number];

interface Ginger {
  stage: 0 | 1 | 2;
  /** The legs: the hip on the right, thigh, shin and the drop to the sole, how they stand (thigh forward, knee), thick at thigh and shin, the foot's length. */
  leg: { at: V3; len: [number, number, number]; rest: [number, number]; w: [number, number]; foot: number };
  hips: V3;
  chest: { at: V3; lean: number };
  torso: { c: V3; r: V3 };
  neck: { at: V3; len: number };
  /** The arms: the shoulder on the right, upper arm and forearm, thick, and the fist's half-size. */
  arm: { at: V3; len: [number, number]; w: [number, number]; fist: number };
  hold: readonly [Hold, Hold];
  /** The head's egg in its own frame, how far nose-up, and the eyes' size. */
  head: { c: V3; r: V3; pitch: number; eye: number };
  /** The branches off its crown: how many to a side, how long, how far out they reach, and how high. None for the Crumbud. */
  boughs: { per: number; len: number; out: number; up: number; w: number } | null;
  /** Icing over the shoulders, fists and feet. */
  caps: boolean;
  /** Gumdrops set in its icing. */
  gums: boolean;
  /** Icing buttons down its front (the Crumbud's). */
  buttons: number;
  /** A red bow tie at its neck (the Gingerbark's). */
  bow: boolean;
  /** The cookie plate on its chest with a snowflake on it, and the red scarves from its shoulders (the Yuleheart's). */
  plate: boolean;
  scarves: boolean;
  /** Icing piped in swirls over its body and limbs. */
  swirls: boolean;
  gait: { swing: [number, number]; waddle: number; armSwing: number; bounce: number };
  size: number;
}

/** A Crumbud: small and round, a big head under its icing, mitten hands. */
const CRUMBUD_LOOK: Ginger = {
  stage: 0,
  leg: { at: [0.34, 0.0, -0.02], len: [0.14, 0.14, 0.12], rest: [2, -6], w: [0.24, 0.22], foot: 0.36 },
  hips: [0.5, 0.42, 0.32],
  chest: { at: [0, 0, 0.08], lean: 4 },
  torso: { c: [0, 0, 0.38], r: [0.56, 0.46, 0.48] },
  neck: { at: [0, 0.04, 0.8], len: 0.02 },
  arm: { at: [0.54, 0.04, 0.58], len: [0.2, 0.2], w: [0.17, 0.17], fist: 0.2 },
  hold: [[14, 34, 26, 40], [14, 34, 26, 40]],
  head: { c: [0, 0.04, 0.6], r: [0.78, 0.7, 0.68], pitch: 2, eye: 0.1 },
  boughs: null,
  caps: false,
  gums: false,
  buttons: 2,
  bow: false,
  plate: false,
  scarves: false,
  swirls: false,
  gait: { swing: [28, 38], waddle: 8, armSwing: 18, bounce: 0.5 },
  size: 2.5,
};

/** A Gingerbark: tall and lanky, cookie twigs off its crown, a star at the top, a bow tie. */
const GINGERBARK_LOOK: Ginger = {
  stage: 1,
  leg: { at: [0.48, 0.0, -0.04], len: [0.42, 0.4, 0.16], rest: [4, -8], w: [0.34, 0.31], foot: 0.56 },
  hips: [0.62, 0.48, 0.38],
  chest: { at: [0, 0, 0.12], lean: 10 },
  torso: { c: [0, 0.02, 0.62], r: [0.74, 0.54, 0.8] },
  neck: { at: [0, 0.1, 1.36], len: 0.08 },
  arm: { at: [0.8, 0.06, 1.12], len: [0.52, 0.5], w: [0.24, 0.27], fist: 0.42 },
  hold: [[20, 26, 30, 50], [20, 26, 30, 50]],
  head: { c: [0, 0.06, 0.42], r: [0.56, 0.5, 0.5], pitch: 4, eye: 0.095 },
  boughs: { per: 2, len: 1.2, out: 1.8, up: 0.62, w: 0.12 },
  caps: true,
  gums: false,
  buttons: 0,
  bow: true,
  plate: false,
  scarves: false,
  swirls: true,
  gait: { swing: [22, 30], waddle: 6, armSwing: 14, bounce: 0.35 },
  size: 3.6,
};

/** A Yuleheart: huge and broad, a rack of branches hung with bells, a cookie plate and red scarves, icing everywhere. */
const YULEHEART_LOOK: Ginger = {
  stage: 2,
  leg: { at: [0.82, 0.0, -0.1], len: [0.36, 0.34, 0.24], rest: [4, -8], w: [0.56, 0.52], foot: 0.82 },
  hips: [1.2, 0.8, 0.6],
  chest: { at: [0, 0, 0.16], lean: 16 },
  torso: { c: [0, 0.08, 0.92], r: [1.5, 1.12, 1.1] },
  neck: { at: [0, 0.6, 1.9], len: 0.04 },
  arm: { at: [1.58, 0.24, 1.36], len: [0.6, 0.58], w: [0.56, 0.62], fist: 0.72 },
  hold: [[30, 18, 30, 50], [30, 18, 30, 50]],
  head: { c: [0, 0.36, 0.8], r: [0.86, 0.74, 0.72], pitch: 10, eye: 0.13 },
  boughs: { per: 3, len: 2.2, out: 2.5, up: 0.55, w: 0.17 },
  caps: true,
  gums: true,
  buttons: 0,
  bow: false,
  plate: true,
  scarves: true,
  swirls: true,
  gait: { swing: [18, 24], waddle: 5, armSwing: 8, bounce: 0.4 },
  size: 4.8,
};

/** A number of its own for each drip, bauble or dot, nought to one, so a row is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const toward = (a: readonly number[], b: readonly number[], k: number): [number, number, number, number] =>
  [0, 1, 2, 3].map((q) => lerp(a[q], b[q], k)) as [number, number, number, number];

/* ---- its moves, in time --------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike. The voice lands on these (`../audio/voice-ginger`). */
export const GINGER_HITS: readonly number[] = [0.46, 0.5, 0.58];
/** When its fists thump its chest in its Taunt, as shares of the act; a ring goes out over the ground at each. */
export const GINGER_THUMPS: readonly number[] = [0.34, 0.58];

/* ---- its bones ------------------------------------------------------------------------------- */

const specOf = (s: Ginger): BipedSpec => ({
  high: s.leg.len[0] + s.leg.len[1] + s.leg.len[2],
  leg: { at: s.leg.at, len: s.leg.len, rest: s.leg.rest },
  chest: s.chest,
  neck: { at: s.neck.at, len: s.neck.len, lean: 0 },
  head: { pitch: s.head.pitch },
  arm: { at: s.arm.at, len: s.arm.len, rest: [0, 0, 0] },
  swing: s.gait.swing,
  waddle: Math.min(2, s.gait.waddle),
  armSwing: s.gait.armSwing,
});

type Arms = [[number, number, number, number], [number, number, number, number]];

/** The thigh's angle (radians, forward of straight down) that puts the foot `y` ahead of the hip, of the two the nearer `near`. */
function thighFor(L1: number, L2: number, b: number, y: number, near: number): number {
  const A = L1 + L2 * Math.cos(b), B = L2 * Math.sin(b), R = Math.hypot(A, B), phi = Math.atan2(B, A);
  const k = Math.asin(clamp(y / R, -1, 1)), one = k - phi, two = Math.PI - k - phi;
  const off = (x: number): number => Math.abs(Math.atan2(Math.sin(x - near), Math.cos(x - near)));
  return off(one) <= off(two) ? one : two;
}

/** Each leg bent at the knee by `fold` more, the thigh brought round by as much as keeps the sole where it was. */
function crouch(s: Ginger, p: BipedPose, fold: number): void {
  if (!fold) return;
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  for (const l of p.legs) {
    const a0 = (lp + l[0] + 20 * l[1]) * DEG, b0 = (kp - 55 * l[1]) * DEG;
    const y0 = L1 * Math.sin(a0) + L2 * Math.sin(a0 + b0);
    const f = Math.max(0, l[1] + fold), b = (kp - 55 * f) * DEG;
    l[0] = thighFor(L1, L2, b, y0, a0) / DEG - lp - 20 * f;
    l[1] = f;
  }
}

/** The feet on the ground kept where they were put. */
function planted(s: Ginger, p: BipedPose, stride: ReadonlyArray<readonly [number, number, number]>, a: Anim): void {
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  const amp = lerp(s.gait.swing[0], s.gait.swing[1], a.gait), g = smooth(a.go);
  stride.forEach(([sw, fold, off], i) => {
    if (off > 0 || fold > 0 || amp <= 0) return;
    const l = p.legs[i], o = l[0] - sw, f = l[1], b = (kp - 55 * f) * DEG;
    const y = (deg: number): number => L1 * Math.sin(deg * DEG) + L2 * Math.sin(deg * DEG + b);
    const at = (x: number): number => lp + o + 20 * f + x;
    const want = lerp(y(at(-amp)), y(at(amp)), (sw + amp) / (2 * amp));
    const th = thighFor(L1, L2, b, want, at(sw) * DEG) / DEG;
    l[0] = lerp(l[0], th - lp - 20 * f, g);
  });
}

/** A stage's pose: standing, a breath and a bob, its head turning to look; going, a cheerful stomp; and its moves. */
function gingerPose(s: Ginger, p: BipedPose, a: Anim, arms: Arms): void {
  const g = smooth(a.go), w = frac(a.u), G = s.gait, t = a.t;
  const stride = p.legs.map((l) => [...l] as [number, number, number]);
  arms[0] = [...s.hold[0]];
  arms[1] = [...s.hold[1]];
  p.head[1] -= 10;
  if (a.go > 0) {
    const roll = g * G.waddle * Math.sin(w * TAU);
    p.chest[1] += roll;
    p.head[2] -= roll * 0.6 + p.roll;
    p.chest[0] += g * a.gait * 6;
    const sw = G.armSwing * (1 + 0.6 * a.gait) * Math.sin(w * TAU) * g;
    arms[0][0] += sw;
    arms[1][0] -= sw;
  } else {
    const look = drift(t);
    p.head[1] -= 14 * look;
    p.chest[0] += 2 * cyc(t, 3);
    if (s.stage === 0) {
      // The Crumbud bobs on its toes and swings its mittens now and then.
      const hop = beat(t, [2.6, 9.4, 15.8], 0.6) * (1 - a.graze);
      arms[0] = toward(arms[0], [30, 70, 20, 30], hop);
      arms[1] = toward(arms[1], [30, 70, 20, 30], hop);
      p.head[2] += 8 * hop * Math.sin(t * TAU);
    } else {
      const roll = beat(t, [6.0, 17.4], 2.0) * (1 - a.graze);
      arms[0][0] += 8 * roll;
      arms[1][0] -= 8 * roll;
      p.chest[2] += 5 * roll * Math.sin(t * TAU * 0.5);
    }
  }
  if (a.graze > 0 && !a.act) {
    arms[0] = toward(arms[0], [60, 10, 30, 60], a.graze);
    arms[1] = toward(arms[1], [60, 10, 30, 60], a.graze);
    p.jaw = a.graze * Math.max(0, Math.sin(t * TAU * 2));
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t, arms);
  else if (act?.kind === 'cast' || act?.kind === 'work') tauntPose(s, p, act.kind === 'work' ? frac(act.t) : act.t, arms);
  else if (act?.kind === 'evolve') {
    const k = act.t, up = ramp(k, 0.1, 0.45) * (1 - ramp(k, 0.62, 0.86));
    p.chest[0] -= 14 * up;
    p.head[0] += 14 * up;
    arms[0] = toward(arms[0], [20, 120, 40, 0], up);
    arms[1] = toward(arms[1], [20, 120, 40, 0], up);
    crouch(s, p, -0.1 * up);
  }
  if (a.go > 0) {
    planted(s, p, stride, a);
    crouch(s, p, g * G.bounce * (0.5 + 0.5 * Math.cos(w * TAU * 2 - 0.5)) * (1 - 0.4 * a.gait));
  }
  crouch(s, p, 0.1 * (1 - g));
}

/** The strike: the Crumbud's straight jab, the Gingerbark's long hook, the Yuleheart's two fists brought down together. */
function strikePose(s: Ginger, p: BipedPose, t: number, arms: Arms): void {
  const H = GINGER_HITS[s.stage];
  if (s.stage < 2) {
    const wind = ramp(t, 0.04, H - 0.16) * (1 - ramp(t, H - 0.16, H - 0.04));
    const out = ramp(t, H - 0.14, H) * (1 - ramp(t, H + 0.12, 0.9));
    arms[1] = toward(toward(arms[1], [10, 40, 110, 40], wind), s.stage ? [80, -24, 30, 40] : [92, 4, 6, 60], out);
    p.chest[2] += (s.stage ? 28 : 16) * out - 10 * wind;
    p.chest[0] += 10 * out;
    crouch(s, p, 0.16 * out);
    return;
  }
  const raise = ramp(t, 0.04, 0.36) * (1 - ramp(t, H - 0.12, H));
  const slam = ramp(t, H - 0.12, H) * (1 - ramp(t, 0.78, 0.98));
  arms[0] = toward(toward(arms[0], [-10, 40, 100, 0], raise), [96, 10, 12, 60], slam);
  arms[1] = toward(toward(arms[1], [-10, 40, 100, 0], raise), [96, 10, 12, 60], slam);
  p.chest[0] += -14 * raise + 22 * slam;
  p.head[0] += 12 * raise - 14 * slam;
  crouch(s, p, 0.36 * slam - 0.06 * raise);
}

/**
 * The Taunt: drawn up tall, its arms flung wide; then its fists brought in to thump its chest, twice (`GINGER_THUMPS`), its head
 * thrown back; and its arms out wide again after, chest out: come on, then.
 */
function tauntPose(s: Ginger, p: BipedPose, t: number, arms: Arms): void {
  const wide = ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.24, 0.32)) + ramp(t, 0.66, 0.8) * (1 - ramp(t, 0.92, 1));
  let thump = 0;
  for (const at of GINGER_THUMPS) thump = Math.max(thump, hump(t, at, 0.09));
  const held = ramp(t, 0.22, 0.3) * (1 - ramp(t, 0.64, 0.72));
  // Wide: arms out to the sides and up a little, palms open.
  arms[0] = toward(arms[0], [10, 80, 18, 20], wide);
  arms[1] = toward(arms[1], [10, 80, 18, 20], wide);
  // Thumping: the fists in on the chest, elbows out.
  const inOn: [number, number, number, number] = [62, 34, 120, 70];
  const off: [number, number, number, number] = [40, 50, 90, 60];
  const k = held;
  arms[0] = toward(arms[0], toward(off, inOn, thump), k);
  arms[1] = toward(arms[1], toward(off, inOn, thump), k);
  p.chest[0] -= 10 * (wide + held) + 6 * thump;
  p.head[0] += 14 * (wide + held * 0.6);
  p.chest[0] += 8 * thump;
  crouch(s, p, 0.08 * thump - 0.06 * wide);
}

/** The bones: a body on two legs with its own pose over it and its own arms. */
function gingerBones(s: Ginger): (a: Anim) => Bones {
  const spec = specOf(s);
  const arms: Arms = [[0, 0, 0, 0], [0, 0, 0, 0]];
  return (a: Anim): Bones => {
    const act = a.act;
    const base = act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a;
    const b = bipedBones(spec, base, (p) => gingerPose(s, p, a, arms));
    for (const k of [0, 1] as const) {
      const sd = k ? 1 : -1, [fw, out, el, tw] = arms[k];
      const sh = joint(b.chest, [sd * s.arm.at[0], s.arm.at[1], s.arm.at[2]], fw, -sd * out, 0);
      const up = joint(sh, [0, 0, 0], 0, 0, -sd * tw);
      const elbow = joint(up, [0, 0, -s.arm.len[0]], el);
      b[`arm${k}`] = up;
      b[`elbow${k}`] = elbow;
      b[`hand${k}`] = joint(elbow, [0, 0, -s.arm.len[1]], 0, 0, 0);
    }
    return b;
  };
}

/* ---- shapes ---------------------------------------------------------------------------------- */

/** Each face wound so it faces away from `mid`. */
function wound(v: readonly V3[], f: Face[], mid: V3): Face[] {
  for (const face of f) {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    const o: V3 = [cx / idx.length - mid[0], cy / idx.length - mid[1], cz / idx.length - mid[2]];
    if (nx * o[0] + ny * o[1] + nz * o[2] < 0) idx.reverse();
  }
  return f;
}

/** A frame with `up` as its Z and `fwd` (made square to it) as its Y. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (Math.hypot(Y[0], Y[1], Y[2]) < 1e-4) Y = [0, 1, 0];
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
function facingDisc(pts: V3[], n: V3, m: Mat, lit = false): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit };
}

/** A flat shape `pts` (in the plane of `X`, `Y` about `c`) given a thickness `th` along `N`: a cookie, a star, a plate. */
function slab(c: V3, X: V3, Y: V3, N: V3, pts: ReadonlyArray<readonly [number, number]>, th: number, front: Mat, side: Mat, back: Mat = side): Mesh {
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x), scale(Y, y)), scale(N, z)));
  const n = pts.length;
  const v: V3[] = [...pts.map(([x, y]) => at(x, y, th / 2)), ...pts.map(([x, y]) => at(x, y, -th / 2))];
  const f: Face[] = [{ i: Array.from({ length: n }, (_, k) => k), m: front }, { i: Array.from({ length: n }, (_, k) => n + k), m: back }];
  for (let k = 0; k < n; k++) f.push({ i: [k, (k + 1) % n, n + ((k + 1) % n), n + k], m: side });
  return mesh(v, wound(v, f, c));
}

/** A five-pointed star's outline, `r` to its points. */
const starPts = (r: number): Array<[number, number]> =>
  Array.from({ length: 10 }, (_, k) => {
    const a = Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? r * 0.45 : r;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });

/** A round outline of `n` points. */
const roundPts = (r: number, n: number): Array<[number, number]> =>
  Array.from({ length: n }, (_, k) => [Math.cos((k / n) * TAU) * r, Math.sin((k / n) * TAU) * r]);

/**
 * A cap of white icing over the top of an egg (`c`, `r`), down to `low` of the way from its top to its middle and a little
 * proud of it, with drips running down from its edge, longer and shorter by turn.
 */
function icingCap(c: V3, r: V3, n: number, drips: number, seed: number, low = 0.55, long = 0.5): Mesh {
  const cap = orb([0, 0, 0], [r[0] * 1.06, r[1] * 1.06, r[2] * 1.06], n + 2, 6, 'horn');
  const cut0 = r[2] * 1.06 * (1 - low);
  const flat = mesh(cap.v.map((p) => [c[0] + p[0], c[1] + p[1], c[2] + Math.max(p[2], cut0)] as V3), cap.f);
  const out: Mesh[] = [flat];
  for (let q = 0; q < drips; q++) {
    const th = (q / drips) * TAU + jitter(seed + q) * 0.4;
    const rim: V3 = [Math.cos(th) * Math.sqrt(1 - (1 - low) ** 2), Math.sin(th) * Math.sqrt(1 - (1 - low) ** 2), 1 - low];
    const e = onEgg(c, scale(r, 1.04), rim);
    const len = r[2] * long * (0.45 + 0.9 * jitter(seed + q * 3 + 1));
    const w = Math.min(r[0], r[1]) * (0.16 + 0.06 * jitter(seed + q + 7));
    out.push(orbAlong(add(e.p, [0, 0, -len * 0.45]), [0, 0, 1], [w, w, len * 0.62], n, 4, 'horn'));
  }
  return merge(...out);
}

/** Icing piped in a line through `pts`: a thin raised bead of white. */
const piping = (pts: readonly V3[], w: number, n: number): Mesh => tube(pts, w, w, Math.max(4, n - 2), 'horn');

/** A holly sprig at `at`: three pointed leaves fanned about `up`, and three red berries in the middle. */
function holly(at: V3, up: V3, size: number, n: number, seed: number): Mesh {
  const [X, Y, Z] = frameOf(up, [0, 1, 0]);
  const out: Mesh[] = [];
  for (let q = 0; q < 3; q++) {
    const a = (q - 1) * 0.95 + (jitter(seed + q) - 0.5) * 0.3;
    const dir = unit(add(add(scale(X, Math.sin(a)), scale(Y, Math.cos(a) * 0.4)), scale(Z, Math.cos(a) * 0.7)));
    out.push(orbAlong(add(at, scale(dir, size * 0.55)), dir, [size * 0.24, size * 0.07, size * 0.6], n, 4, q % 2 ? 'leafDark' : 'leaf'));
  }
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + seed;
    out.push(orb(add(at, add(scale(X, Math.cos(a) * size * 0.16), add(scale(Y, Math.sin(a) * size * 0.16 + size * 0.08), scale(Z, size * 0.12)))), size * 0.15, n, 4, 'shell'));
  }
  return merge(...out);
}

/** A gumdrop: a little dome, red or green. */
const gumdrop = (at: V3, r: number, n: number, red: boolean): Mesh => {
  const m = orb([0, 0, 0], [r, r, r * 0.9], n, 4, red ? 'bloom' : 'spot');
  return mesh(m.v.map((p) => [at[0] + p[0], at[1] + p[1], at[2] + Math.max(p[2], -r * 0.2)] as V3), m.f);
};

/** A bauble on a string from `at`: a round ball, red, green or gold by its number. */
function bauble(at: V3, drop: number, r: number, n: number, i: number): Mesh {
  const ball = add(at, [0, 0, -drop]);
  const which = i % 3;
  return merge(
    taper([at, ball], r * 0.12, r * 0.12, 3, 'stoneDark'),
    orb(ball, r, n, 5, which === 0 ? 'shell' : which === 1 ? 'spot' : 'crystal'),
    orb(add(ball, [0, 0, r * 0.95]), r * 0.3, 4, 3, 'crystalDark'),
  );
}

/** A gold bell hung from `at`: its shoulder, its flared mouth, and a clapper. */
function bell(at: V3, r: number, n: number): Mesh {
  const top = add(at, [0, 0, -r * 0.5]);
  const body = tube([add(top, [0, 0, 0]), add(top, [0, 0, -r * 0.55]), add(top, [0, 0, -r * 1.15]), add(top, [0, 0, -r * 1.45])],
    [r * 0.42, r * 0.6, r * 0.85, r * 1.05], [r * 0.42, r * 0.6, r * 0.85, r * 1.05], Math.max(6, n), (k) => (k < 1 ? 'crystal' : 'flame'), { start: true, end: true });
  return merge(
    taper([at, top], r * 0.12, r * 0.12, 3, 'shell'),
    orb(top, r * 0.42, n, 4, 'crystal'),
    body,
    orb(add(top, [0, 0, -r * 1.5]), r * 0.22, 4, 3, 'crystalDark'),
  );
}

/** A red bow: two loops, a knot and two tails, facing along `fwd`. */
function bow(at: V3, fwd: V3, r: number, n: number): Mesh {
  const [X, , Z] = frameOf([0, 0, 1], fwd);
  const out: Mesh[] = [];
  for (const sd of [-1, 1]) {
    out.push(orbAlong(add(at, add(scale(X, sd * r * 0.62), scale(Z, r * 0.12))), add(scale(X, sd), scale(Z, 0.3)), [r * 0.34, r * 0.22, r * 0.58], n, 4, 'shell'));
    out.push(orbAlong(add(at, add(scale(X, sd * r * 0.32), scale(Z, -r * 0.6))), add(scale(X, sd * 0.4), [0, 0, -1]), [r * 0.16, r * 0.08, r * 0.46], n, 3, 'shellDark'));
  }
  out.push(orb(at, r * 0.24, n, 4, 'shellDark'));
  return merge(...out);
}

/** A snowflake cookie: a round cookie with a white snowflake piped on it, both faces. */
function snowCookie(at: V3, r: number, n: number): Mesh {
  const X: V3 = [1, 0, 0], Y: V3 = [0, 0, 1], N: V3 = [0, 1, 0];
  const cookie = slab(at, X, Y, N, roundPts(r, 10), r * 0.22, 'coatLight', 'coatDark');
  const lines: Disc[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 3; q++) {
      const a = (q / 3) * Math.PI, ca = Math.cos(a), sa = Math.sin(a), w = r * 0.1, l = r * 0.8;
      const pts: V3[] = [[-l * ca - w * sa, l * sa * 0 - w * ca, 0], [l * ca - w * sa, -w * ca, 0], [l * ca + w * sa, w * ca, 0], [-l * ca + w * sa, w * ca, 0]]
        .map(([x, y]) => add(at, add(add(scale(X, x), scale(Y, y + (q === 1 ? 0 : 0))), scale(N, sd * r * 0.13))));
      // Rotated in the cookie's plane by its angle.
      const rot = pts.map((p) => {
        const d = sub(p, at), x = dot(d, X), y = dot(d, Y);
        const xr = x * Math.cos(a) - y * Math.sin(a), yr = x * Math.sin(a) + y * Math.cos(a);
        return add(at, add(add(scale(X, xr), scale(Y, yr)), scale(N, sd * r * 0.13)));
      });
      lines.push(facingDisc(rot, scale(N, sd), 'horn'));
    }
  }
  return merge(cookie, paint(lines));
}

/* ---- the head ------------------------------------------------------------------------------- */

/** Where its eyes sit, in the head's frame. */
const eyeAt = (s: Ginger, sd: number): V3 => {
  const H = s.head;
  return add(H.c, [sd * H.r[0] * 0.36, H.r[1] * 0.93, H.r[2] * 0.02]);
};

/**
 * The head: a round of gingerbread under a thick cap of icing that drips down its brow; two round amber eyes alight under it;
 * a wide open grin with a tongue in it; holly on top; and twig nubs (the Crumbud) or its branches (`boughsOf`).
 */
function headOf(s: Ginger, n: number): Mesh {
  const H = s.head, c = H.c, r = H.r;
  const skull = orb(c, r, n + 2, 6, 'coat');
  const cap = icingCap(add(c, [0, -r[1] * 0.04, r[2] * 0.02]), r, n, s.stage === 0 ? 11 : 9, 30 + s.stage, s.stage === 0 ? 0.62 : 0.5, s.stage === 0 ? 0.62 : 0.42);
  // Eyes: amber, round, lit, a brighter middle.
  const eyes = paint([-1, 1].flatMap((sd) => {
    const e = eyeAt(s, sd), N: V3 = unit([sd * 0.3, 1, 0.04]);
    const ring = (k: number, m: Mat): Disc => facingDisc(Array.from({ length: 10 }, (_, q) => {
      const a = (q / 10) * TAU;
      return add(add(e, scale(N, 0.02 + (1.3 - k) * 0.006)), [Math.cos(a) * H.eye * k * 0.95, 0, Math.sin(a) * H.eye * k * 1.05]);
    }), N, m, true);
    return [ring(1.3, 'stoneDark'), ring(1, 'ember'), ring(0.32, 'flame')];
  }));
  // The grin: wide, open, a tongue in the bottom of it.
  const mouthAt = add(c, [0, r[1] * 0.95, -r[2] * 0.36]), mw = r[0] * (s.stage === 0 ? 0.42 : 0.36), mh = r[2] * (s.stage === 0 ? 0.26 : 0.18);
  const half = Array.from({ length: 9 }, (_, q) => {
    const a = (q / 8) * Math.PI;
    return add(mouthAt, [Math.cos(a) * mw, 0.03, -Math.sin(a) * mh]);
  });
  const tongue = Array.from({ length: 7 }, (_, q) => {
    const a = Math.PI * 0.15 + (q / 6) * Math.PI * 0.7;
    return add(mouthAt, [Math.cos(a) * mw * 0.5, 0.05, -mh * 0.45 - Math.sin(a) * mh * 0.45]);
  });
  const mouth = paint([facingDisc(half, [0, 1, 0], 'stoneDark'), facingDisc(tongue, [0, 1, 0], 'tongue')]);
  // Blush on the Crumbud.
  const blush = s.stage === 0 ? paint([-1, 1].map((sd) => {
    const e = onEgg(c, r, unit([sd * 0.62, 0.72, -0.22]));
    return facingDisc(Array.from({ length: 8 }, (_, q) => add(add(e.p, scale(e.n, 0.03)), [Math.cos((q / 8) * TAU) * H.eye * 1.1, 0, Math.sin((q / 8) * TAU) * H.eye * 0.65])), e.n, 'inner');
  })) : null;
  // Holly on top of its icing, a little to one side.
  const hollyAt = onEgg(add(c, [0, -r[1] * 0.04, r[2] * 0.02]), scale(r, 1.06), unit([-0.42, 0.25, 0.88]));
  const sprig = holly(add(hollyAt.p, scale(hollyAt.n, 0.02)), hollyAt.n, r[0] * (s.stage === 0 ? 0.72 : 0.5), n, 3);
  const sprig2 = s.stage > 0 ? holly(add(onEgg(c, scale(r, 1.06), unit([0.5, 0.2, 0.84])).p, [0, 0, 0.02]), unit([0.5, 0.2, 0.84]), r[0] * 0.42, n, 9) : null;
  // The Crumbud's twig nubs up through its icing.
  const nubs = s.stage === 0 ? merge(...[-1, 1].map((sd) => {
    const base = onEgg(c, r, unit([sd * 0.42, -0.1, 0.9]));
    const tip = add(base.p, add(scale(base.n, r[2] * 0.36), [sd * 0.06, 0, 0.06]));
    return merge(taper([add(base.p, scale(base.n, -0.05)), tip], r[0] * 0.15, r[0] * 0.12, 6, 'coatDark'), orb(tip, r[0] * 0.13, 5, 3, 'coatLight'));
  })) : null;
  return merge(skull, cap, eyes, mouth, blush, sprig, sprig2, nubs, boughsOf(s, n));
}

/**
 * Its branches: off each side of its crown, reaching out and up, each forking, the tops of them capped in icing; the Gingerbark's
 * crowned with a gold star and hung with baubles, the Yuleheart's hung with gold bells, red bows and snowflake cookies.
 */
function boughsOf(s: Ginger, n: number): Mesh | null {
  const B = s.boughs;
  if (!B) return null;
  const H = s.head, c = H.c, r = H.r, out: Mesh[] = [];
  const nn = Math.max(5, n - 1);
  let hang = 0;
  for (const sd of [-1, 1]) {
    for (let q = 0; q < B.per; q++) {
      const u = (q + 0.5) / B.per;
      // From the crown, the first branch most nearly up, the last most nearly out.
      const root = onEgg(c, r, unit([sd * lerp(0.35, 0.85, u), lerp(-0.25, 0.05, u), lerp(0.92, 0.5, u)])).p;
      const reach = B.out * lerp(0.45, 1, u), rise = B.up * lerp(1.3, 0.55, u), len = B.len * lerp(0.75, 1, u);
      const mid = add(root, [sd * reach * 0.45, -0.1 * u, rise * 0.65]);
      const tip = add(root, [sd * reach, -0.18 * u, rise]);
      const w = B.w * lerp(1.15, 0.9, u);
      const pts = Array.from({ length: 6 }, (_, k) => {
        const t = k / 5;
        const a = add(scale(root, (1 - t) * (1 - t)), add(scale(mid, 2 * t * (1 - t)), scale(tip, t * t)));
        return add(a, [0, 0, Math.sin(t * Math.PI * 2) * 0.03 * len]);
      });
      out.push(tube(pts, pts.map((_, k) => w * lerp(1, 0.55, k / 5)), pts.map((_, k) => w * lerp(1, 0.55, k / 5)), nn, 'coat'));
      // A fork off the middle of it, up.
      const fork0 = pts[3], fork1 = add(fork0, [sd * reach * 0.12, 0.05, rise * 0.55 + 0.1]);
      out.push(taper([fork0, add(fork0, scale(sub(fork1, fork0), 0.5)), fork1], w * 0.8, w * 0.45, nn, 'coatDark'));
      // Icing along the top of the branch and on each tip.
      const blobs = [tip, fork1];
      blobs.forEach((p, k) => {
        const big = k < 1 ? 1.15 : 0.85;
        out.push(icingCap(add(p, [0, 0, w * 0.4]), [w * 2.0 * big, w * 1.7 * big, w * 1.2 * big], 5, 4, 70 + q * 9 + k + (sd > 0 ? 40 : 0), 0.8, 0.9));
      });
      // A run of icing along the top of the branch between them.
      out.push(piping(pts.slice(1, 5).map((p) => add(p, [0, 0, w * 0.75])), w * 0.38, nn));
      // What hangs from it.
      const from = add(pts[k3(B.per, q)], [0, 0, -w]);
      if (s.stage === 1) out.push(bauble(from, w * 2.4, w * 1.5, nn, hang++));
      else {
        const what = (q + (sd > 0 ? 1 : 0)) % 3;
        if (what === 0) out.push(bell(from, w * 2.0, nn));
        else if (what === 1) out.push(merge(taper([from, add(from, [0, 0, -w * 3])], w * 0.15, w * 0.15, 3, 'stoneDark'), snowCookie(add(from, [0, 0, -w * 3 - w * 1.6]), w * 1.7, nn)));
        else out.push(bow(add(from, [0, 0.05, -w * 0.6]), [0, 1, 0], w * 1.9, nn));
        // And a bell from the tip of the longest.
        if (q === B.per - 1) out.push(bell(add(tip, [0, 0, -w]), w * 1.9, nn));
      }
    }
  }
  // The Gingerbark's gold star on a stalk at the top of its crown.
  if (s.stage === 1) {
    const top = onEgg(c, r, [0, 0, 1]).p, stalk = add(top, [0, 0, r[2] * 0.75]);
    out.push(taper([top, stalk], B.w * 1.1, B.w * 0.8, nn, 'coatDark'));
    out.push(slab(add(stalk, [0, 0, r[2] * 0.42]), [1, 0, 0], [0, 0, 1], [0, 1, 0], starPts(r[0] * 0.62), r[0] * 0.14, 'crystal', 'crystalDark'));
    out.push(paint([facingDisc(starPts(r[0] * 0.36).map(([x, y]) => add(add(stalk, [0, 0, r[2] * 0.42]), [x, r[0] * 0.08, y])), [0, 1, 0], 'coatLight')]));
  }
  // The Yuleheart's: a big holly and bow in the middle of its crown.
  if (s.stage === 2) out.push(bow(add(onEgg(c, r, unit([0, 0.4, 0.92])).p, [0, 0.05, 0.12]), [0, 1, 0], r[0] * 0.32, nn));
  return merge(...out);
}
/** Which point along a branch something hangs from: further out on the outer branches. */
const k3 = (per: number, q: number): number => Math.min(5, 2 + Math.round((q / Math.max(1, per - 1)) * 2));

/* ---- the body ------------------------------------------------------------------------------- */

/**
 * The body: an egg of gingerbread; the Crumbud's two icing buttons down its front and icing round its neck; the others' icing
 * piped in swirls over it; the Gingerbark's bow tie, the Yuleheart's cookie plate and scarves.
 */
function bodyOf(s: Ginger, n: number): Mesh {
  const T = s.torso, out: Mesh[] = [orb(T.c, T.r, n + 2, 6, 'coat')];
  // A collar of icing round the top of it, where the head sits, drips running down.
  out.push(icingCap(T.c, T.r, n, [9, 12, 18][s.stage], 50 + s.stage, [0.26, 0.2, 0.12][s.stage], [0.28, 0.32, 0.6][s.stage]));
  for (let q = 0; q < s.buttons; q++) {
    const e = onEgg(T.c, T.r, unit([0, 1, lerp(0.1, -0.45, q / Math.max(1, s.buttons - 1))]));
    out.push(orbAlong(add(e.p, scale(e.n, 0.01)), e.n, [T.r[0] * 0.13, T.r[0] * 0.13, T.r[0] * 0.07], n, 4, 'horn'));
  }
  // The Crumbud's wavy icing round its middle.
  if (s.stage === 0) {
    const pts = Array.from({ length: 19 }, (_, k) => {
      const th = Math.PI * 0.1 + (k / 18) * Math.PI * 0.8;
      const e = onEgg(T.c, scale(T.r, 1.02), unit([Math.cos(th), Math.sin(th), -0.62 + 0.08 * Math.sin(k * 1.6)]));
      return e.p;
    });
    out.push(piping(pts, T.r[0] * 0.05, n));
  }
  if (s.swirls) out.push(swirlsOn(T.c, T.r, n, s.stage === 2 ? 0.035 : 0.03, s.stage === 2 ? 4 : 3, 61));
  return merge(...out);
}

/** Icing piped in loose swirls and zigzags over an egg's front and sides. */
function swirlsOn(c: V3, r: V3, n: number, w: number, count: number, seed: number): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const yaw = lerp(-1.1, 1.1, count === 1 ? 0.5 : q / (count - 1)) + (jitter(seed + q) - 0.5) * 0.3;
    const z0 = lerp(-0.2, 0.25, jitter(seed + q * 3));
    const pts: V3[] = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14, a = t * TAU * 1.1, rr = 0.24 * (1 - 0.6 * t);
      const dir = unit([Math.sin(yaw) + Math.cos(a) * rr, Math.cos(yaw), z0 + Math.sin(a) * rr * 1.2]);
      pts.push(onEgg(c, scale(r, 1.015), dir).p);
    }
    out.push(piping(pts, Math.min(r[0], r[2]) * w, n));
  }
  return merge(...out);
}

/** The Gingerbark's bow tie: red, with a holly sprig beside the knot. */
function bowTieOf(s: Ginger, n: number): Mesh | null {
  if (!s.bow) return null;
  const T = s.torso, e = onEgg(T.c, T.r, unit([0, 0.62, 0.78]));
  return merge(bow(add(e.p, scale(e.n, 0.05)), [0, 1, 0.3], T.r[0] * 0.36, n), holly(add(e.p, add(scale(e.n, 0.04), [T.r[0] * 0.32, 0, 0.02])), e.n, T.r[0] * 0.34, n, 17));
}

/** The Yuleheart's cookie plate on its chest: a shield of pale gingerbread with an icing rim and a snowflake piped on it. */
function plateOf(s: Ginger, n: number): Mesh | null {
  if (!s.plate) return null;
  const T = s.torso, e = onEgg(T.c, T.r, unit([0, 1, 0.12])), N = e.n;
  const [X, Y] = frameOf(N, [0, 0, 1]);
  const W = T.r[0] * 0.5, Hh = T.r[2] * 0.62;
  // A shield: flat-topped with notched shoulders, coming to a point below.
  const shape: Array<[number, number]> = [[-1, 0.8], [-0.55, 1], [0, 0.86], [0.55, 1], [1, 0.8], [0.95, 0.1], [0.6, -0.55], [0, -1], [-0.6, -0.55], [-0.95, 0.1]];
  const pts = shape.map(([x, y]) => [x * W, y * Hh] as [number, number]);
  const at = add(e.p, scale(N, 0.06));
  const plate = slab(at, X, Y, N, pts, T.r[1] * 0.12, 'coatLight', 'coatDark');
  // Its icing rim and its snowflake.
  const rim = piping([...pts, pts[0]].map(([x, y]) => add(at, add(add(scale(X, x * 0.9), scale(Y, y * 0.9)), scale(N, T.r[1] * 0.07)))), W * 0.05, n);
  const flake: Mesh[] = [];
  const mid = add(at, add(scale(Y, -Hh * 0.04), scale(N, T.r[1] * 0.07)));
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * TAU + Math.PI / 2, d = add(scale(X, Math.cos(a)), scale(Y, Math.sin(a)));
    const tip = add(mid, scale(d, W * 0.6));
    flake.push(piping([mid, tip], W * 0.045, n));
    // Two little barbs on each arm.
    const bar = add(mid, scale(d, W * 0.38)), side = add(scale(X, -Math.sin(a)), scale(Y, Math.cos(a)));
    flake.push(piping([add(bar, scale(side, -W * 0.13)), add(bar, scale(d, W * 0.12)), add(bar, scale(side, W * 0.13))], W * 0.035, n));
  }
  return merge(plate, rim, ...flake);
}

/**
 * The Yuleheart's two red scarves, one from each shoulder, hanging down its front past its belly, a white snowflake and a white
 * band near the foot of each.
 */
function scarvesOf(s: Ginger, n: number): Mesh | null {
  if (!s.scarves) return null;
  const T = s.torso, out: Mesh[] = [];
  for (const sd of [-1, 1]) {
    const top = onEgg(T.c, scale(T.r, 1.03), unit([sd * 0.62, 0.55, 0.58]));
    const w = T.r[0] * 0.24;
    const rows = 7, v: V3[] = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows;
      const dir = unit([sd * lerp(0.7, 0.72, t), lerp(0.5, 0.85, t), lerp(0.58, -0.75, t)]);
      const on = onEgg(T.c, scale(T.r, 1.06 + 0.04 * t), dir);
      const across = unit(cross(on.n, [0, 0, 1]));
      const flare = w * (1 + 0.25 * t);
      v.push(add(on.p, scale(across, -flare)), add(on.p, scale(across, flare)));
    }
    // The pointed foot.
    const last = v.length - 2, tipP = add(scale(add(v[last], v[last + 1]), 0.5), [0, 0.06, -w * 0.9]);
    v.push(tipP);
    const f: Face[] = [];
    for (let k = 0; k < rows; k++) f.push({ i: [k * 2, k * 2 + 1, k * 2 + 3, k * 2 + 2], m: k % 2 ? 'shell' : 'shellDark' });
    f.push({ i: [last, last + 1, v.length - 1], m: 'shell' });
    const front = mesh(v, wound(v, f, T.c));
    out.push(front);
    void top;
    // A white band and a snowflake on it near the foot.
    const bandK = rows - 1, a0 = v[bandK * 2], a1 = v[bandK * 2 + 1], b0 = v[(bandK - 1) * 2], b1 = v[(bandK - 1) * 2 + 1];
    const nrm = unit(cross(sub(a1, a0), sub(b0, a0)));
    const facing = dot(nrm, [0, 1, 0]) < 0 ? scale(nrm, -1) : nrm;
    const lift = (p: V3): V3 => add(p, scale(facing, 0.03));
    const band = facingDisc([lift(lerpV(a0, b0, 0.7)), lift(lerpV(a1, b1, 0.7)), lift(lerpV(a1, b1, 0.95)), lift(lerpV(a0, b0, 0.95))], facing, 'horn');
    const mid = lift(lerpV(lerpV(v[3 * 2], v[3 * 2 + 1], 0.5), lerpV(v[4 * 2], v[4 * 2 + 1], 0.5), 0.5));
    const across = unit(sub(v[7], v[6])), down = unit(cross(facing, across));
    const flake: Disc[] = [];
    for (let q = 0; q < 3; q++) {
      const ang = (q / 3) * Math.PI, d = add(scale(across, Math.cos(ang)), scale(down, Math.sin(ang))), side = add(scale(across, -Math.sin(ang)), scale(down, Math.cos(ang)));
      const L = w * 0.62, ww = w * 0.08;
      flake.push(facingDisc([add(mid, add(scale(d, -L), scale(side, -ww))), add(mid, add(scale(d, L), scale(side, -ww))), add(mid, add(scale(d, L), scale(side, ww))), add(mid, add(scale(d, -L), scale(side, ww)))], facing, 'horn'));
    }
    out.push(paint([band, ...flake]));
  }
  return merge(...out);
}
const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ---- the limbs ------------------------------------------------------------------------------ */

/** A length of gingerbread limb down its bone, a little fuller in the middle. */
const limbOf = (len: number, w0: number, w1: number, n: number): Mesh =>
  tube([[0, 0, w0 * 0.3], [0, 0, -len * 0.5], [0, 0, -len - w1 * 0.25]], [w0, (w0 + w1) * 0.55, w1], [w0, (w0 + w1) * 0.55, w1], n, 'coat');

/** A ring of icing round a limb at `z`, wavy. */
function cuff(rad: number, z: number, n: number, w: number): Mesh {
  const pts = Array.from({ length: 17 }, (_, k) => {
    const a = (k / 16) * TAU;
    return [Math.cos(a) * rad, Math.sin(a) * rad, z + Math.sin(a * 5) * w * 0.9] as V3;
  });
  return piping(pts, w, n);
}

/** A fist: a big round mitt of gingerbread with a thumb, icing over the back of it for a stage with caps, a gumdrop on it. */
function fistOf(s: Ginger, r: number, n: number, seed: number): Mesh {
  const c: V3 = [0, r * 0.1, -r * 0.85];
  const mitt = orb(c, [r * 0.95, r * 0.85, r * 0.95], n + 1, 5, 'coat');
  const thumb = orbAlong(add(c, [r * 0.7, r * 0.45, r * 0.2]), [0.4, 0.4, 1], [r * 0.32, r * 0.32, r * 0.5], n, 4, 'coat');
  const thumb2 = orbAlong(add(c, [-r * 0.7, r * 0.45, r * 0.2]), [-0.4, 0.4, 1], [r * 0.32, r * 0.32, r * 0.5], n, 4, 'coat');
  const icing = s.caps ? icingCap(add(c, [0, -r * 0.2, r * 0.05]), [r * 0.92, r * 0.85, r * 0.9], n, 6, seed, 0.62, 0.55) : null;
  const gum = s.gums ? gumdrop(add(c, [0, -r * 0.15, r * 0.98]), r * 0.24, n, seed % 2 === 0) : null;
  // Piped lines across the back of the Gingerbark's and Yuleheart's, as knuckles.
  const lines = s.stage > 0 ? piping([[-r * 0.6, r * 0.55, -r * 0.2], [-r * 0.2, r * 0.75, -r * 0.35], [r * 0.2, r * 0.75, -r * 0.35], [r * 0.6, r * 0.55, -r * 0.2]].map((p) => add(c, p as V3)), r * 0.05, n) : null;
  return merge(mitt, thumb, thumb2, icing, gum, lines);
}

/** A foot: a rounded flat-bottomed block of gingerbread, icing round its top and three toes marked in icing. */
function footOf(s: Ginger, w: number, len: number, sole: number, n: number, seed: number): Mesh {
  const body = orb([0, len * 0.3, -sole * 0.5], [w * 0.95, len * 0.75, sole * 0.75], n + 1, 5, 'coat');
  const flat = mesh(body.v.map((p) => [p[0], p[1], Math.max(p[2], -sole)] as V3), body.f);
  const toes = paint([-0.5, 0, 0.5].map((x) => facingDisc(Array.from({ length: 6 }, (_, q) => add([x * w * 0.6, len * 0.98, -sole * 0.5], [Math.cos((q / 6) * TAU) * w * 0.08, 0, Math.sin((q / 6) * TAU) * w * 0.16])), [0, 1, 0], 'horn')));
  const cap = s.caps ? icingCap([0, len * 0.2, -sole * 0.3], [w * 0.9, len * 0.6, sole * 0.55], n, 7, seed, 0.6, 0.6) : cuff(w * 0.85, -sole * 0.05, n, w * 0.07);
  return merge(flat, toes, cap);
}

/** Its arms and legs. */
function limbs(s: Ginger, n: number): Piece[] {
  const out: Piece[] = [];
  const A = s.arm, L = s.leg;
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    // The shoulder: icing over it for a stage with caps, a gumdrop in it.
    const shoulder = s.caps
      ? merge(icingCap([0, 0, A.w[0] * 0.2], [A.w[0] * 1.35, A.w[0] * 1.3, A.w[0] * 1.15], n, 7, 200 + k * 9, 0.5, 0.75),
        s.gums ? gumdrop([sd * A.w[0] * 0.3, A.w[0] * 0.3, A.w[0] * 1.2], A.w[0] * 0.38, n, k === 0) : null)
      : orb([0, 0, 0], A.w[0] * 1.1, n, 4, 'coat');
    const upper = merge(limbOf(A.len[0], A.w[0], A.w[1], n + 1), shoulder,
      s.swirls ? piping([[0, A.w[0] * 1.02, -A.len[0] * 0.2], [A.w[0] * 0.5, A.w[0] * 0.9, -A.len[0] * 0.45], [0, A.w[0] * 1.02, -A.len[0] * 0.7]], A.w[0] * 0.09, n) : null);
    const fore = merge(limbOf(A.len[1], A.w[1], A.w[1] * 1.1, n + 1), cuff(A.w[1] * 1.12, -A.len[1] * 0.88, n, A.w[1] * 0.12));
    out.push(
      { key: `arm${k}`, mesh: upper, bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: false },
      { key: `fore${k}`, mesh: fore, bone: `elbow${k}`, bias: 0.035, after: 'body', front },
      { key: `hand${k}`, mesh: fistOf(s, A.fist, n, 120 + k * 20), bone: `hand${k}`, bias: 0.04, after: ['body', `fore${k}`], front },
    );
  }
  for (const [key, sd, k] of [['ll', -1, 0], ['lr', 1, 1]] as Array<[string, number, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    // The Gingerbark's and Yuleheart's knees capped in icing too.
    const knee = s.stage > 0 ? merge(icingCap([0, L.w[1] * 0.2, -L.len[0] * 0.95], [L.w[0] * 1.15, L.w[0] * 1.1, L.w[0] * 0.8], n, 7, 240 + k * 7, 0.5, 0.7),
      s.gums ? gumdrop([sd * L.w[0] * 0.2, L.w[0] * 0.5, -L.len[0] * 0.95 + L.w[0] * 0.75], L.w[0] * 0.3, n, k === 1) : null) : null;
    out.push(
      { key: `${key}0`, mesh: merge(limbOf(L.len[0], L.w[0], L.w[1], n + 1), knee), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front },
      { key: `${key}1`, mesh: merge(limbOf(L.len[1], L.w[1], L.w[1] * 1.05, n + 1),
        s.swirls ? piping([[-L.w[1] * 0.6, L.w[1] * 0.85, -L.len[1] * 0.35], [0, L.w[1] * 1.05, -L.len[1] * 0.5], [L.w[1] * 0.6, L.w[1] * 0.85, -L.len[1] * 0.35]], L.w[1] * 0.08, n) : null),
        bone: `${key}1`, bias: 0.015, after: 'body', front },
      { key: `${key}2`, mesh: footOf(s, L.w[1] * 1.1, L.foot, L.len[2], n, 260 + k * 10), bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** A stage's pieces. */
function gingerBuild(s: Ginger, lod: number): Piece[] {
  const n = cut(lod, 7, 9);
  const T = s.torso, H = s.head;
  const torsoSolid = { c: T.c, r: scale(T.r, 0.86) };
  const headSolid = { c: H.c, r: scale(H.r, 0.75) };
  const pieces: Piece[] = [
    { key: 'hips', mesh: orb([0, 0, 0], s.hips, n + 2, 4, 'coat'), bone: 'body', bias: 0 },
    { key: 'body', mesh: bodyOf(s, n), bone: 'chest', bias: 0.005, breathes: { c: T.c, k: 0.02 } },
    { key: 'head', mesh: headOf(s, n), bone: 'head', bias: 0.2, hide: [headSolid] },
    ...limbs(s, n),
  ];
  const bt = bowTieOf(s, n);
  if (bt) pieces.push({ key: 'bowtie', mesh: bt, bone: 'chest', bias: 0.08, after: ['body'], hide: [torsoSolid] });
  const pl = plateOf(s, n);
  if (pl) pieces.push({ key: 'plate', mesh: pl, bone: 'chest', bias: 0.07, after: ['body'], hide: [torsoSolid] });
  const sc = scarvesOf(s, n);
  if (sc) pieces.push({ key: 'scarves', mesh: sc, bone: 'chest', bias: 0.075, after: ['body', 'plate'], hide: [torsoSolid] });
  return pieces;
}

/* ---- the ring it sends out ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/**
 * Its Taunt seen: at each thump a ring of gold goes out over the ground from its feet, widening and fading, a white one inside
 * it; sparkles of gold thrown up round its head. The near half of each ring is drawn over it, the far half under.
 */
function tauntRings(g: CanvasRenderingContext2D, view: View, s: Ginger, b: Bones, a: Anim, front: boolean): void {
  const act = a.act;
  if (!act || (act.kind !== 'cast' && act.kind !== 'work')) return;
  const t = act.kind === 'work' ? frac(act.t) : act.t;
  const secs = ACT_SECS[act.kind];
  const mid = place(b.body, [0, 0, 0]);
  const reach = [2.6, 3.4, 4.4][s.stage];
  GINGER_THUMPS.forEach((at, h) => {
    const since = (t - at) * secs;
    if (since < 0 || since > 0.6) return;
    const k = since / 0.6;
    for (const [rr, col, wide] of [[1, [255, 206, 84] as RGB, 0.14], [0.72, [255, 252, 244] as RGB, 0.09]] as Array<[number, RGB, number]>) {
      const R = reach * (0.45 + 0.55 * smooth(k)) * rr;
      g.beginPath();
      let started = false;
      for (let q = 0; q <= 40; q++) {
        const a2 = (q / 40) * TAU;
        const p: V3 = [mid[0] + Math.cos(a2) * R, mid[1] + Math.sin(a2) * R, 0.04];
        const near = dot(sub(p, mid), view.T) > 0;
        const [x, y] = onScreen(view, p);
        if (near !== front) { started = false; continue; }
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.strokeStyle = css(col, (1 - k) * 0.85);
      g.lineWidth = Math.max(1, wide * Math.hypot(view.ex[0], view.ex[1]) * (1 - 0.5 * k));
      g.stroke();
    }
    if (!front) return;
    // Sparkles up round its head.
    const head = place(b.head, s.head.c);
    for (let q = 0; q < 7; q++) {
      const i = h * 13 + q, th = (q / 7) * TAU + jitter(i);
      const p: V3 = [head[0] + Math.cos(th) * (0.5 + since * 2.2), head[1] + Math.sin(th) * (0.5 + since * 2.2), head[2] + since * 1.6 + jitter(i + 2) * 0.4];
      const [x, y] = onScreen(view, p);
      const r = (0.07 + 0.05 * jitter(i + 5)) * Math.hypot(view.ex[0], view.ex[1]) * (1 - k);
      g.fillStyle = css(q % 2 ? [255, 214, 92] : [255, 255, 255], 1 - k);
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r, y);
      g.lineTo(x, y - r);
      g.closePath();
      g.fill();
    }
  });
}

/* ---- the kinds ----------------------------------------------------------------------------- */

const AMBER: RGB = [240, 158, 44];
const GOLD: RGB = [255, 204, 84];

function gingerKind(s: Ginger): Kind {
  return {
    bones: gingerBones(s),
    build: (lod) => gingerBuild(s, lod),
    // The variant's coat is its gingerbread, its mark its icing. The holly, berries, ribbons, gold and gumdrops are the same on all.
    palette: (coat, mark) => {
      const ginger = mix(coat, [196, 122, 60], 0.35);
      const icing = mix(mark, [252, 250, 246], 0.6);
      return coatPalette(coat, mark, {
        coat: ginger,
        coatDark: mix(ginger, [120, 66, 32], 0.45),
        coatLight: mix(ginger, [236, 186, 120], 0.55),
        horn: icing,
        hornDark: mix(icing, [200, 210, 228], 0.45),
        leaf: [64, 148, 70],
        leafDark: [38, 104, 52],
        shell: [214, 48, 52],
        shellDark: [158, 28, 38],
        crystal: GOLD,
        crystalDark: [214, 150, 48],
        flame: [255, 226, 130],
        ember: AMBER,
        bloom: [226, 56, 64],
        spot: [104, 186, 72],
        stoneDark: [70, 28, 24],
        tongue: [236, 112, 120],
        inner: [240, 140, 128],
        mark: icing,
      }, 30);
    },
    shadow: [[0.75, 1.15, 1.9][s.stage], [0.6, 0.85, 1.45][s.stage]],
    stride: 1.3,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work', 'cast'],
    glow: (b) => [
      ...[-1, 1].map((sd) => ({ p: place(b.head, eyeAt(s, sd)), r: s.head.eye * 1.8, c: AMBER, a: 0.4 })),
      ...(s.stage === 1 ? [{ p: place(b.head, add(s.head.c, [0, 0, s.head.r[2] * 2.17])), r: s.head.r[0] * 0.9, c: GOLD, a: 0.35 }] : []),
    ],
    // Evolving, the motes rising round it are snow and gold.
    motes: [[250, 250, 255], GOLD],
    extra: (g, view, b, a, under) => tauntRings(g, view, s, b, a, !under),
  };
}

export const CRUMBUD = gingerKind(CRUMBUD_LOOK);
export const GINGERBARK = gingerKind(GINGERBARK_LOOK);
export const YULEHEART = gingerKind(YULEHEART_LOOK);
void moved;
