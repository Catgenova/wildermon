import {
  ACT_SECS, add, beat, bipedBones, clamp, cross, cyc, DEG, coatPalette, dot, drift, frac, lerp, merge, mix, moved,
  onEgg, orb, paint, scale, smooth, sub, TAU, unit, type Anim, type BipedPose, type BipedSpec, type Bones, type Disc, type Kind,
  type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The stone line: the Chipkin, a squat little golem of pale sandstone lumps with a ridge of orange crystal down its back; which
 * grows into the Brickorn, broad in the shoulder, its forearms and shins bound in courses of terracotta brick and an amber gem
 * set in a stone plate on its chest; and then the Fortigran, huge and hunched, a round brick watchtower built into its back,
 * bands of cream stone round its upper arms and moss in the joints of its stones. The species is still `chissa` underneath: the one that
 * chisels your shards into stone brick.
 *
 * Each is built of rounded cream stones over a dark core, so the dark between them reads as the joints of drystone; a dark face
 * deep under a stone brow with two amber eyes alight in it; a crest of tall pale slabs fanned up off the head; and fists far too
 * big for it. All three are built by one set of functions from a description of the stage (`Golem`), so a stage is its numbers.
 * It walks with a heavy rolling stomp, its fists swinging low; it strikes with them; and at its task it holds a block of stone on
 * the ground with one fist and chips at it with the knuckles of the other, stone flying at each tap.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** How an arm is held: forward, out to its side, the elbow bent, and the upper arm turned about itself (degrees). */
type Hold = readonly [number, number, number, number];

interface Golem {
  stage: 0 | 1 | 2;
  /** The legs: the hip on the right, thigh, shin and the drop to the sole, how they stand (thigh forward, knee), how thick at the thigh and the shin, and the foot's length. */
  leg: { at: V3; len: [number, number, number]; rest: [number, number]; w: [number, number]; foot: number };
  /** The seat: the hips' half-sizes across, along and up. */
  hips: V3;
  /** The chest's joint on the hips, and how far forward of upright it is carried: its hunch. */
  chest: { at: V3; lean: number };
  /** The body: an egg in the chest's frame. */
  torso: { c: V3; r: V3 };
  /** How many stones are laid over the body, and how big each is against the body. */
  stones: { count: number; size: number };
  neck: { at: V3; len: number };
  /** The arms: the shoulder on the right, upper arm and forearm, how thick, and the fist's half-size. */
  arm: { at: V3; len: [number, number]; w: [number, number]; fist: number };
  /** How it holds its arms standing, left and right. */
  hold: readonly [Hold, Hold];
  /** The head's egg in its own frame, and how far nose-up it is carried; the eyes' size; and whether its brow, cheeks and jaw are rounded lumps rather than cut blocks. */
  head: { c: V3; r: V3; pitch: number; eye: number; round?: boolean };
  /** The crest: how many slabs, how long the middle one, how wide, how far they fan. */
  crest: { count: number; len: number; w: number; fan: number };
  /** Orange crystal shards down its back: how many, how long. */
  shards: { count: number; len: number };
  /** Brick courses round its forearms and shins, and on its shoulders. */
  brick: { fore: number; shin: number; shoulder: boolean };
  /** The stone plate with an amber gem in it on its chest. */
  plate: number;
  /** The watchtower on its back: radius, height, courses of brick, how far back and how far up its foot on the body. */
  tower: { r: number; h: number; courses: number; at: V3 } | null;
  /** A band of cream stone round each upper arm, under the shoulder. */
  arches: boolean;
  /** Moss on its stones, a share of them. */
  moss: number;
  /** How it goes: the legs' swing at a walk and at a run, how far it rolls from foot to foot, how far its arms swing, how much it bobs. */
  gait: { swing: [number, number]; waddle: number; armSwing: number; bounce: number };
  size: number;
}

/** A Chipkin: small and squat, a big head under its crest, big round fists, orange shards down its back. */
const CHIPKIN_LOOK: Golem = {
  stage: 0,
  leg: { at: [0.42, 0.0, -0.04], len: [0.16, 0.14, 0.14], rest: [4, -8], w: [0.34, 0.32], foot: 0.46 },
  hips: [0.62, 0.5, 0.38],
  chest: { at: [0, 0, 0.1], lean: 14 },
  torso: { c: [0, 0.02, 0.5], r: [0.82, 0.7, 0.66] },
  stones: { count: 18, size: 0.6 },
  neck: { at: [0, 0.32, 0.98], len: 0.04 },
  arm: { at: [0.78, 0.12, 0.74], len: [0.3, 0.28], w: [0.26, 0.3], fist: 0.36 },
  hold: [[22, 22, 30, 60], [22, 22, 30, 60]],
  head: { c: [0, 0.14, 0.44], r: [0.66, 0.6, 0.58], pitch: 4, eye: 0.14, round: true },
  crest: { count: 4, len: 0.86, w: 0.46, fan: 30 },
  shards: { count: 6, len: 0.5 },
  brick: { fore: 0, shin: 0, shoulder: false },
  plate: 0,
  tower: null,
  arches: false,
  moss: 0,
  gait: { swing: [26, 36], waddle: 7, armSwing: 12, bounce: 0.3 },
  size: 2.9,
};

/** A Brickorn: broad and stooped, brick bound round its forearms and shins, a gem in a stone plate on its chest. */
const BRICKORN_LOOK: Golem = {
  stage: 1,
  leg: { at: [0.62, 0.0, -0.08], len: [0.3, 0.28, 0.18], rest: [6, -10], w: [0.46, 0.44], foot: 0.64 },
  hips: [0.92, 0.66, 0.5],
  chest: { at: [0, 0, 0.14], lean: 26 },
  torso: { c: [0, 0.06, 0.74], r: [1.22, 0.98, 0.92] },
  stones: { count: 22, size: 0.54 },
  neck: { at: [0, 0.56, 1.42], len: 0.04 },
  arm: { at: [1.26, 0.2, 1.12], len: [0.5, 0.48], w: [0.38, 0.44], fist: 0.5 },
  hold: [[34, 18, 34, 60], [34, 18, 34, 60]],
  head: { c: [0, 0.14, 0.4], r: [0.66, 0.6, 0.56], pitch: 18, eye: 0.13 },
  crest: { count: 5, len: 0.96, w: 0.42, fan: 38 },
  shards: { count: 0, len: 0 },
  brick: { fore: 3, shin: 2, shoulder: false },
  plate: 0.44,
  tower: null,
  arches: false,
  moss: 0,
  gait: { swing: [22, 30], waddle: 6, armSwing: 10, bounce: 0.4 },
  size: 3.4,
};

/** A Fortigran: huge and hunched, a brick watchtower in its back, cream bands round its upper arms, moss in its joints. */
const FORTIGRAN_LOOK: Golem = {
  stage: 2,
  leg: { at: [0.9, 0.0, -0.12], len: [0.38, 0.34, 0.22], rest: [4, -8], w: [0.62, 0.58], foot: 0.86 },
  hips: [1.32, 0.86, 0.66],
  chest: { at: [0, 0, 0.16], lean: 34 },
  torso: { c: [0, 0.1, 0.92], r: [1.66, 1.3, 1.16] },
  stones: { count: 22, size: 0.56 },
  neck: { at: [0, 0.86, 1.62], len: 0.04 },
  arm: { at: [1.72, 0.36, 1.32], len: [0.62, 0.6], w: [0.6, 0.66], fist: 0.82 },
  hold: [[44, 16, 30, 60], [44, 16, 30, 60]],
  head: { c: [0, 0.16, 0.4], r: [0.72, 0.64, 0.6], pitch: 24, eye: 0.14 },
  crest: { count: 5, len: 1.04, w: 0.46, fan: 38 },
  shards: { count: 0, len: 0 },
  brick: { fore: 2, shin: 2, shoulder: false },
  plate: 0,
  tower: { r: 1.3, h: 1.5, courses: 8, at: [-0.3, -0.55, -0.42] },
  arches: true,
  moss: 0.5,
  gait: { swing: [18, 24], waddle: 5, armSwing: 8, bounce: 0.4 },
  size: 4.5,
};

/** A number of its own for each stone or chip, nought to one, so a heap is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const toward = (a: readonly number[], b: readonly number[], k: number): [number, number, number, number] =>
  [0, 1, 2, 3].map((q) => lerp(a[q], b[q], k)) as [number, number, number, number];

/* ---- its moves, in time --------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Chipkin's punch, the Brickorn's hook, the Fortigran's two fists down. The voice lands on these (`../audio/voice-golem`). */
export const GOLEM_HITS: readonly number[] = [0.46, 0.5, 0.58];
/** When its knuckles come down on the block at its task, as shares of a go at it: two taps. The voice and the chips land on these. */
export const GOLEM_TAPS: readonly number[] = [0.4, 0.8];

/* ---- its bones ------------------------------------------------------------------------------- */

const specOf = (s: Golem): BipedSpec => ({
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
function crouch(s: Golem, p: BipedPose, fold: number): void {
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

/** The feet on the ground kept where they were put: each leg on the ground turned to put its foot where an even sweep has it. */
function planted(s: Golem, p: BipedPose, stride: ReadonlyArray<readonly [number, number, number]>, a: Anim): void {
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

/**
 * A stage's pose: standing, a slow heavy breath and a roll of the shoulders, its head turning to look; going, a rolling stomp
 * with its fists swinging low; and its moves -- the strike, its task and evolving.
 */
function golemPose(s: Golem, p: BipedPose, a: Anim, arms: Arms): void {
  const g = smooth(a.go), w = frac(a.u), G = s.gait, t = a.t;
  const stride = p.legs.map((l) => [...l] as [number, number, number]);
  arms[0] = [...s.hold[0]];
  arms[1] = [...s.hold[1]];
  // Its head a little turned to the viewer's side, so the face under its brow reads.
  p.head[1] -= 12;
  if (a.go > 0) {
    // A heavy rolling stomp: weight from foot to foot, the shoulders swinging over each, the fists swinging low against the legs.
    const roll = g * G.waddle * Math.sin(w * TAU);
    p.chest[1] += roll;
    p.head[2] -= roll * 0.6 + p.roll;
    p.chest[0] += g * a.gait * 6;
    const sw = G.armSwing * (1 + 0.6 * a.gait) * Math.sin(w * TAU) * g;
    arms[0][0] += sw;
    arms[1][0] -= sw;
  } else {
    // Standing: a slow breath through the shoulders; now and then a roll of them, and a look about.
    const look = drift(t);
    p.head[1] -= 14 * look;
    p.chest[0] += 2 * cyc(t, 3);
    const roll = beat(t, [6.0, 17.4], 2.0) * (1 - a.graze);
    arms[0][0] += 8 * roll;
    arms[1][0] -= 8 * roll;
    p.chest[2] += 5 * roll * Math.sin(t * TAU * 0.5);
    if (s.stage === 0) {
      // The Chipkin knocks its fists together now and then.
      const knock = beat(t, [3.4, 11.8, 20.2], 0.7) * (1 - a.graze);
      arms[0] = toward(arms[0], [56, -6, 50, 70], knock);
      arms[1] = toward(arms[1], [56, -6, 50, 70], knock);
    }
  }
  if (a.graze > 0 && !a.act) {
    arms[0] = toward(arms[0], [60, 10, 30, 60], a.graze);
    arms[1] = toward(arms[1], [60, 10, 30, 60], a.graze);
    p.jaw = a.graze * Math.max(0, Math.sin(t * TAU * 2));
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t, arms);
  else if (act?.kind === 'work') workPose(s, p, act.t, arms);
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up as the light gathers, both fists raised to it.
    const k = act.t, up = ramp(k, 0.1, 0.45) * (1 - ramp(k, 0.62, 0.86));
    p.chest[0] -= 16 * up;
    p.head[0] += 14 * up;
    arms[0] = toward(arms[0], [20, 120, 40, 0], up);
    arms[1] = toward(arms[1], [20, 120, 40, 0], up);
    crouch(s, p, -0.1 * up);
  }
  if (a.go > 0) {
    planted(s, p, stride, a);
    crouch(s, p, g * G.bounce * (0.5 + 0.5 * Math.cos(w * TAU * 2 - 0.5)) * (1 - 0.4 * a.gait));
  }
  // Its knees always a little bent under its weight.
  crouch(s, p, 0.12 * (1 - g));
}

/**
 * The strike. The Chipkin throws a straight punch with its right; the Brickorn a hook with its right, turning into it; the
 * Fortigran raises both fists over its head and brings them down together, bowing into the blow.
 */
function strikePose(s: Golem, p: BipedPose, t: number, arms: Arms): void {
  const H = GOLEM_HITS[s.stage];
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
 * Its task: bent over a block of stone on the ground before it, its left fist holding it down, its right raised and brought
 * down knuckles first on the block, twice; the chips fly at each tap (`chips`).
 */
function workPose(s: Golem, p: BipedPose, t: number, arms: Arms): void {
  const down = ramp(t, 0, 0.14) * (1 - ramp(t, 0.9, 1));
  p.chest[0] += 18 * down;
  p.head[0] -= 10 * down;
  crouch(s, p, 0.2 * down);
  // The left fist on the block.
  arms[0] = toward(arms[0], [62, 4, 22, 70], down);
  // The right: up, and down on the block at each tap.
  let tap = 0;
  for (const at of GOLEM_TAPS) tap = Math.max(tap, hump(t, at, 0.07));
  const up = down * (1 - tap);
  arms[1] = toward(arms[1], toward([36, 26, 120, 70], [58, 2, 30, 70], tap), down);
  p.chest[2] += 6 * up;
  p.head[1] += 10 * down;
}

/** The bottom of a fist, in its hand's frame (`fistOf`). */
const fistBottom = (r: number): V3 => [0, r * 0.3, -r * 1.62];

/**
 * Where the block it chips at stands and how tall it is: under where its right fist comes down at a tap, so the knuckles land
 * on its top whatever the stage's arms; found once, from the pose itself.
 */
const blocks = new Map<Golem, { at: V3; h: number }>();
function blockOf(s: Golem, raw: (a: Anim) => Bones): { at: V3; h: number } {
  let got = blocks.get(s);
  if (!got) {
    const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t: GOLEM_TAPS[0] } };
    const p = place(raw(a).hand1, fistBottom(s.arm.fist));
    got = { at: [p[0], p[1], 0], h: Math.max(s.arm.fist * 0.5, p[2]) };
    blocks.set(s, got);
  }
  return got;
}

/** The bones: a body on two legs with its own pose over it, its own arms, and the block on the ground before it. */
function golemBones(s: Golem): (a: Anim) => Bones {
  const spec = specOf(s);
  const arms: Arms = [[0, 0, 0, 0], [0, 0, 0, 0]];
  const raw = (a: Anim): Bones => {
    const act = a.act;
    const base = act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a;
    const b = bipedBones(spec, base, (p) => golemPose(s, p, a, arms));
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
  raws.set(s, raw);
  return (a) => {
    const b = raw(a);
    b.block = joint(ROOT, blockOf(s, raw).at);
    return b;
  };
}
/** Each stage's bones without the block, for finding where the block goes (`blockOf`) from the pieces too. */
const raws = new Map<Golem, (a: Anim) => Bones>();

/* ---- stone, brick and slab ------------------------------------------------------------------- */

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

/** A block, half-sizes `r` in the frame `f`, its corners knocked a little off true, its top drawn in by `taperTop`. */
function block(c: V3, r: V3, f: [V3, V3, V3], mat: Mat | ((face: number) => Mat), seed = 0, rough = 0.06, taperTop = 0): Mesh {
  const [X, Y, Z] = f;
  const v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const id = seed * 7.1 + (sx + 1) + (sy + 1) * 2 + (sz + 1) * 4;
    const k = 1 + rough * (jitter(id) - 0.5) * 2, top = sz > 0 ? 1 - taperTop : 1;
    v.push(add(c, add(add(scale(X, sx * r[0] * k * top), scale(Y, sy * r[1] * (1 + rough * (jitter(id + 3) - 0.5)) * top)), scale(Z, sz * r[2] * (1 + rough * (jitter(id + 5) - 0.5))))));
  }
  const m = (q: number): Mat => (typeof mat === 'function' ? mat(q) : mat);
  const f6: Face[] = [
    { i: [0, 2, 3, 1], m: m(0) }, { i: [4, 5, 7, 6], m: m(1) },
    { i: [0, 1, 5, 4], m: m(2) }, { i: [2, 6, 7, 3], m: m(3) },
    { i: [0, 4, 6, 2], m: m(4) }, { i: [1, 3, 7, 5], m: m(5) },
  ];
  return mesh(v, wound(v, f6, c));
}

/** A rounded stone: a faceted egg, a little lumpy, pale or shaded or mossy by its number. */
function stone(c: V3, r: V3, seed: number, n: number, mat: Mat = 'coat'): Mesh {
  const m = orb([0, 0, 0], r, n + 2, 5, mat);
  const lumpy = m.v.map((p, i) => {
    const k = 1 + 0.1 * (jitter(seed * 13 + i) - 0.5);
    return add(c, scale(p, k));
  });
  return mesh(lumpy, m.f);
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

/** A shard of crystal: a four-sided spike from a base on a surface, two faces lit and two in shade. */
function shard(base: V3, dir: V3, len: number, w: number, twist: number): Mesh {
  const [X, Y] = frameOf(dir, [Math.cos(twist), Math.sin(twist), 0]);
  const D = unit(dir);
  const corners = [add(scale(X, w), [0, 0, 0]), scale(Y, w), scale(X, -w), scale(Y, -w)].map((o) => add(base, o));
  const tip = add(base, scale(D, len));
  const v: V3[] = [...corners, tip];
  const f: Face[] = [0, 1, 2, 3].map((q) => ({ i: [q, (q + 1) % 4, 4], m: (q % 2 ? 'crystalDark' : 'crystal') as Mat }));
  f.push({ i: [3, 2, 1, 0], m: 'crystalDark' });
  return mesh(v, wound(v, f, add(base, scale(D, len * 0.3))));
}

/** The colour of a brick by its number: mostly terracotta, some darker, the odd cream one. */
function brickMat(i: number, cream = 0.06): Mat {
  const k = jitter(i * 3.7 + 2);
  return k < cream ? 'horn' : k < cream + (1 - cream) * 0.66 ? 'shell' : 'shellDark';
}

/**
 * Courses of brick round a limb's bone, in its own frame (down its -Z): `courses` rings from `z0` down, each `ring` bricks round
 * at radius `rad`, every other course set half a brick round.
 */
function brickBand(rad: number, z0: number, courses: number, ring: number, h: number, seed: number, mat: (i: number) => Mat = brickMat): Mesh {
  const out: Mesh[] = [];
  for (let c = 0; c < courses; c++) {
    const z = z0 - c * h * 2.06;
    for (let q = 0; q < ring; q++) {
      const th = ((q + (c % 2) * 0.5) / ring) * TAU;
      const o: V3 = [Math.cos(th), Math.sin(th), 0];
      const along: V3 = [-Math.sin(th), Math.cos(th), 0];
      const w = (TAU * rad) / ring / 2 * 0.94;
      out.push(block(add(scale(o, rad), [0, 0, z]), [w, h * 0.55, h * 0.94], [along, o, [0, 0, 1]], mat(seed + c * 31 + q), seed + c * 31 + q, 0.05));
    }
  }
  return merge(...out);
}

/**
 * A sleeve of brick round a limb, in its frame (down its -Z) from `z0` to `z1`: courses laid flush one on the next round a dark
 * mortar core, from `r0` across at its top to `r1` at its bottom, each course set half a brick round from the last, so the dark
 * between the bricks is the mortar.
 */
function brickSleeve(z0: number, z1: number, r0: number, r1: number, n: number, seed: number): Mesh {
  const len = z0 - z1, courses = Math.max(3, Math.round(len / (Math.max(r0, r1) * 0.3)));
  const h = len / courses / 2, out: Mesh[] = [];
  out.push(tubeCore(z0, z1, r0 * 0.9, r1 * 0.9, n));
  for (let c = 0; c < courses; c++) {
    const z = z0 - h - c * h * 2, rad = lerp(r0, r1, (c + 0.5) / courses);
    const ring = Math.max(9, Math.round((TAU * rad) / (rad * 0.55)));
    for (let q = 0; q < ring; q++) {
      const th = ((q + (c % 2) * 0.5) / ring) * TAU;
      const o: V3 = [Math.cos(th), Math.sin(th), 0], along: V3 = [-Math.sin(th), Math.cos(th), 0];
      const w = (TAU * rad) / ring / 2 * 0.9;
      out.push(block(add(scale(o, rad), [0, 0, z]), [w, rad * 0.16, h * 0.86], [along, o, [0, 0, 1]], brickMat(seed + c * 31 + q, 0), seed + c * 31 + q, 0.05));
    }
  }
  return merge(...out);
}

/** The dark core a sleeve of brick is laid round: the mortar between its bricks. */
const tubeCore = (z0: number, z1: number, r0: number, r1: number, n: number): Mesh =>
  orb([0, 0, (z0 + z1) / 2], [Math.max(r0, r1), Math.max(r0, r1), (z0 - z1) / 2 * 1.04], n, 4, 'hoof');

/* ---- the head ------------------------------------------------------------------------------- */

/** Where its eyes sit, in the head's frame: deep in the dark of its face, under the brow. */
const eyeAt = (s: Golem, sd: number): V3 => {
  const H = s.head;
  return add(H.c, [sd * H.r[0] * 0.3, H.r[1] * 0.9, H.r[2] * 0.1]);
};

/**
 * The head: a block of cream stone, the front of it a dark hollow of a face framed by a heavy brow over it and cheek stones each
 * side; two slanted amber eyes alight in the dark; and the crest, tall pale slabs fanned up off its crown and laid back.
 */
function headOf(s: Golem, n: number): Mesh {
  const H = s.head, c = H.c, r = H.r;
  // The back of its head a rounded stone, and the dark hollow of its face in front of it.
  const skull = stone(add(c, [0, -r[1] * 0.25, r[2] * 0.05]), [r[0] * 0.86, r[1] * 0.72, r[2] * 0.82], 7, n + 1);
  const face = orb(add(c, [0, r[1] * 0.3, -r[2] * 0.05]), [r[0] * 0.68, r[1] * 0.62, r[2] * 0.6], n, 4, 'stoneDark');
  // The brow over it, a heavy slab overhanging well forward of the face and tipped down at the front, so the face sits in its
  // shadow; the Chipkin's a heavy rounded stone instead.
  const brow = H.round
    ? stone(add(c, [0, r[1] * 0.62, r[2] * 0.42]), [r[0] * 0.92, r[1] * 0.5, r[2] * 0.26], 5, n, 'coatLight')
    : block(add(c, [0, r[1] * 0.6, r[2] * 0.44]), [r[0] * 0.9, r[1] * 0.56, r[2] * 0.22], frameOf([0, 0.5, 1], [0, 1, 0]),
      (f) => (f === 1 ? 'coatLight' : f === 3 ? 'coat' : 'coatDark'), 5, 0.06);
  // Its cheeks: a stone each side, angled in toward the front so the two close on its chin like a helm; and its chin, jutting.
  // The Chipkin's rounded lumps, the others' cut blocks.
  const cheeks = [-1, 1].map((sd) => H.round
    ? stone(add(c, [sd * r[0] * 0.62, r[1] * 0.42, -r[2] * 0.22]), [r[0] * 0.3, r[1] * 0.44, r[2] * 0.48], 9 + sd, n, 'coat')
    : block(add(c, [sd * r[0] * 0.64, r[1] * 0.42, -r[2] * 0.24]), [r[0] * 0.15, r[1] * 0.42, r[2] * 0.44],
      frameOf([sd * 0.25, 0.15, 1], [-sd * 0.55, 1, 0]), (f) => (f === 3 ? 'coatLight' : 'coat'), 9 + sd, 0.08));
  const jaw = H.round
    ? stone(add(c, [0, r[1] * 0.62, -r[2] * 0.66]), [r[0] * 0.5, r[1] * 0.34, r[2] * 0.22], 13, n, 'coat')
    : block(add(c, [0, r[1] * 0.66, -r[2] * 0.66]), [r[0] * 0.44, r[1] * 0.3, r[2] * 0.15], frameOf([0, -0.3, 1], [0, 1, 0]),
      (f) => (f === 1 || f === 3 ? 'coatLight' : 'coat'), 13, 0.08);
  // The eyes: slanted amber slits, the inner corner lower, lit.
  const eyes = paint([-1, 1].map((sd) => {
    const e = eyeAt(s, sd), w = H.eye * 1.5, h = H.eye * 0.8, n3: V3 = [0, 1, 0];
    const pts: V3[] = [[-w, 0, -h * 0.2], [-w * 0.2, 0, h * 0.7], [w, 0, h * 0.5], [w * 0.5, 0, -h * 0.6]].map(([x, y, z]) => add(e, [sd * x, y + 0.02, z - sd * x * 0.0 + (sd * x > 0 ? 0.08 * h : -0.04 * h)]));
    return facingDisc(pts, n3, 'ember', true);
  }));
  // The crest: flat slabs off the brow and crown, the middle ones tallest, fanned out to the sides and swept back.
  const C = s.crest, slabs: Mesh[] = [];
  for (let q = 0; q < C.count; q++) {
    const u = C.count === 1 ? 0 : q / (C.count - 1) - 0.5, side = u * 2;
    const len = C.len * (1 - 0.3 * Math.abs(side)), ang = side * C.fan * DEG;
    const dir = unit([Math.sin(ang) * 1.1, -0.62 - 0.12 * Math.abs(side), Math.cos(ang)]);
    const root = add(c, [side * r[0] * 0.55, r[1] * (0.3 - 0.25 * Math.abs(side)), r[2] * 0.55]);
    // Flat across, its broad face toward the front and up.
    const f = frameOf(dir, [side * 0.6, 1, 0]);
    slabs.push(block(add(root, scale(dir, len * 0.45)), [C.w * 0.5, C.w * 0.16, len * 0.5], [f[0], f[1], f[2]],
      (face) => (face === 3 ? 'coatLight' : face === 2 ? 'coatDark' : face === 1 ? 'coatLight' : 'coat'), 21 + q, 0.04, 0.55));
  }
  return merge(skull, face, brow, ...cheeks, jaw, eyes, ...slabs);
}

/* ---- the body ------------------------------------------------------------------------------- */

/** The stones laid over the egg of the body, cream over a dark core, so the dark between them is the joints of drystone. */
function bodyOf(s: Golem, n: number): Mesh {
  const T = s.torso, S = s.stones;
  const core = orb(T.c, scale(T.r, 0.9), n + 2, 5, 'stone');
  const out: Mesh[] = [core];
  // A spread of directions over the egg (a spiral, so they are even), each a rounded stone sat on the shell.
  for (let q = 0; q < S.count; q++) {
    const z = 1 - (2 * (q + 0.5)) / S.count, ring = Math.sqrt(1 - z * z), th = q * 2.39996 + 0.4;
    // Fewer under it, where it would not be seen and its legs go in.
    if (z < -0.75) continue;
    const dir: V3 = [Math.cos(th) * ring, Math.sin(th) * ring, z];
    const e = onEgg(T.c, scale(T.r, 0.86), dir);
    // A little smaller than they would need to be to close up, so the dark of the joints shows between them.
    const sz = S.size * (0.68 + 0.3 * jitter(q + 5));
    const r: V3 = [T.r[0] * sz, T.r[1] * sz * 0.9, T.r[2] * sz * 0.8];
    const tone = jitter(q + 17);
    out.push(stone(add(e.p, scale(e.n, r[2] * 0.25)), r, q + 40, n, tone < 0.28 ? 'coatLight' : tone > 0.78 ? 'coatDark' : 'coat'));
    // Moss on some of them: a green cushion over the top of the stone, where rain would sit.
    if (jitter(q + 91) < s.moss && z > -0.3) out.push(stone(add(e.p, add(scale(e.n, r[2] * 0.72), [0, 0, r[2] * 0.22])), [r[0] * 0.78, r[1] * 0.72, r[2] * 0.38], q + 140, n, 'moss'));
  }
  return merge(...out);
}

/** Orange crystal shards up the back of the Chipkin, the biggest in the middle. */
function shardsOf(s: Golem): Mesh | null {
  const C = s.shards, T = s.torso;
  if (!C.count) return null;
  const out: Mesh[] = [];
  for (let q = 0; q < C.count; q++) {
    const u = q / (C.count - 1);
    const elev = lerp(-0.1, 1.15, u), yaw = Math.PI + (jitter(q) - 0.5) * 0.5;
    const dir: V3 = [Math.sin(yaw) * Math.cos(elev), Math.cos(yaw) * Math.cos(elev), Math.sin(elev)];
    const e = onEgg(T.c, T.r, dir);
    const big = 1 - 0.5 * Math.abs(u - 0.5) * 2;
    out.push(shard(add(e.p, scale(e.n, -0.05)), unit(add(e.n, [0, -0.3, 0.4])), C.len * (0.6 + 0.6 * big), C.len * 0.22 * (0.7 + 0.5 * big), q * 1.3));
    // A smaller one beside it.
    if (q % 2 === 0) out.push(shard(add(e.p, add(scale(e.n, -0.05), [0.12 * (q % 4 ? 1 : -1), 0, 0])), unit(add(e.n, [0.4 * (q % 4 ? 1 : -1), -0.2, 0.3])), C.len * 0.45, C.len * 0.14, q * 2.1));
  }
  return merge(...out);
}

/** Where on the body the Brickorn's plate sits: on top of its left shoulder, facing up and out, so it shows from most ways round. */
const PLATE_DIR: V3 = unit([-0.6, 0.38, 0.72]);

/** The Brickorn's plate: a hexagon of pale stone on its left shoulder, an amber gem in the middle of it. */
function plateOf(s: Golem): Mesh | null {
  if (!s.plate) return null;
  const T = s.torso, dir = PLATE_DIR;
  const e = onEgg(T.c, T.r, dir), N = e.n, [X, Y] = frameOf(N, [0, 0, 1]);
  const rad = s.plate, th = rad * 0.3;
  const ring = (k: number, lift: number): V3[] => Array.from({ length: 6 }, (_, q) => {
    const a = (q / 6) * TAU + Math.PI / 6;
    return add(add(e.p, scale(N, lift)), add(scale(X, Math.cos(a) * rad * k), scale(Y, Math.sin(a) * rad * k)));
  });
  const back = ring(1, -th * 0.5), front = ring(0.86, th);
  const v: V3[] = [...back, ...front];
  const f: Face[] = [{ i: [6, 7, 8, 9, 10, 11], m: 'coatLight' }, { i: [5, 4, 3, 2, 1, 0], m: 'coat' }];
  for (let q = 0; q < 6; q++) f.push({ i: [q, (q + 1) % 6, 6 + ((q + 1) % 6), 6 + q], m: q % 2 ? 'coat' : 'coatDark' });
  const plate = mesh(v, wound(v, f, e.p));
  const gem = paint([
    facingDisc(ring(0.5, th + 0.01).map((p, q) => (q % 2 ? p : add(e.p, scale(sub(p, e.p), 0.9)))), N, 'flame', true),
    facingDisc(ring(0.3, th + 0.02), N, 'ember', true),
  ]);
  return merge(plate, gem);
}

/**
 * The Fortigran's tower: a round tower of brick built into its back, course over course, three arched windows dark in its
 * side, a ring of cream stone round its top over a dark floor, and a cream band round its foot.
 */
function towerOf(s: Golem): Mesh | null {
  const W = s.tower;
  if (!W) return null;
  const T = s.torso, base = add(T.c, W.at), out: Mesh[] = [];
  // Built upright in the world although the chest it stands on is hunched forward: its axis tipped back by the hunch.
  const L = s.chest.lean * DEG, U: V3 = [0, -Math.sin(L), Math.cos(L)], F: V3 = [0, Math.cos(L), Math.sin(L)], X: V3 = [1, 0, 0];
  const at = (x: number, y: number, z: number): V3 => add(base, add(add(scale(X, x), scale(F, y)), scale(U, z)));
  const dirAt = (x: number, y: number): V3 => add(scale(X, x), scale(F, y));
  const h = W.h / W.courses / 2, ring = 14;
  for (let c = 0; c < W.courses; c++) {
    const z = h + c * h * 2.04;
    for (let q = 0; q < ring; q++) {
      const th = ((q + (c % 2) * 0.5) / ring) * TAU;
      const o = dirAt(Math.cos(th), Math.sin(th)), along = dirAt(-Math.sin(th), Math.cos(th));
      const w = (TAU * W.r) / ring / 2 * 0.95;
      const mossy = jitter(c * 17 + q) < s.moss * 0.5 && c < 3;
      out.push(block(at(Math.cos(th) * W.r, Math.sin(th) * W.r, z), [w, h * 0.7, h * 0.94], [along, o, U], mossy ? 'moss' : brickMat(c * 29 + q, 0), c * 29 + q, 0.05));
    }
  }
  // The core of it, dark, so the joints between the bricks read.
  for (let c = 0; c < 3; c++) out.push(orb(at(0, 0, W.h * (0.15 + c * 0.27)), [W.r * 0.93, W.r * 0.93, W.h * 0.16], 12, 3, 'stoneDark'));
  // The cream ring round its top, and the dark floor inside it.
  const top = W.h + h * 0.4, cap = 16;
  for (let q = 0; q < cap; q++) {
    const th = (q / cap) * TAU, o = dirAt(Math.cos(th), Math.sin(th)), along = dirAt(-Math.sin(th), Math.cos(th));
    const w = (TAU * (W.r * 1.08)) / cap / 2 * 0.94;
    out.push(block(at(Math.cos(th) * W.r * 1.08, Math.sin(th) * W.r * 1.08, top), [w, W.r * 0.17, h * 1.1], [along, o, U], q % 3 ? 'horn' : 'hornDark', 300 + q, 0.08));
  }
  // Its top: a low cream cap inside the ring, so it reads as a tower and not a tub from above.
  out.push(paint([facingDisc(Array.from({ length: 14 }, (_, q) => at(Math.cos((q / 14) * TAU) * W.r * 0.94, Math.sin((q / 14) * TAU) * W.r * 0.94, top + h * 0.75)), U, 'hornDark')]));
  // Three arched windows in a row on each side of it, high, where they show over its shoulders.
  const wins: Disc[] = [];
  for (const yaw of [-0.36, 0, 0.36, Math.PI - 0.36, Math.PI, Math.PI + 0.36]) {
    const o = dirAt(Math.cos(yaw), Math.sin(yaw));
    const along = dirAt(-Math.sin(yaw), Math.cos(yaw));
    const mid = at(Math.cos(yaw) * W.r * 1.02, Math.sin(yaw) * W.r * 1.02, W.h * 0.7);
    const ww = W.r * 0.09, hh = W.h * 0.09;
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI - (k / 8) * Math.PI;
      pts.push(add(add(mid, scale(along, Math.cos(a) * ww)), scale(U, hh * 0.4 + Math.sin(a) * ww)));
    }
    pts.push(add(add(mid, scale(along, ww)), scale(U, -hh)), add(add(mid, scale(along, -ww)), scale(U, -hh)));
    wins.push(facingDisc(pts.map((p) => add(p, scale(o, 0.06))), o, 'stoneDark'));
  }
  out.push(paint(wins));
  // The cream arch bands: from the tower's side low down, rising over the top of each shoulder and coming down in front of it
  // to the arm, blocks laid edge to edge along the curve.
  for (const sd of [-1, 1]) {
    const T = s.torso;
    const back = onEgg(T.c, T.r, unit([sd * 0.92, -0.5, 0.22]));
    const from = add(back.p, scale(back.n, 0.1));
    const over = onEgg(T.c, T.r, unit([sd * 1.0, 0.0, 0.42]));
    const peak = add(over.p, scale(over.n, 0.28));
    const down = onEgg(T.c, T.r, unit([sd * 0.95, 0.52, 0.0]));
    const to = add(down.p, scale(down.n, 0.1));
    const steps = 7;
    for (let q = 0; q < steps; q++) {
      const u = (q + 0.5) / steps, u2 = (q + 1.5) / steps;
      const p = bez(from, peak, to, u), p2 = bez(from, peak, to, Math.min(1, u2));
      const along = unit(sub(p2, p)), side: V3 = [sd, 0, 0];
      const outward = unit(cross(along, side));
      const len = Math.hypot(...sub(bez(from, peak, to, (q + 1) / steps), bez(from, peak, to, q / steps)) as [number, number, number]);
      out.push(block(p, [0.3, len * 0.47, 0.14], [side, along, dot(outward, [0, 0, 1]) < 0 ? scale(outward, -1) : outward],
        (f) => (f === 5 || f === 4 ? 'horn' : 'hornDark'), 600 + q + (sd > 0 ? 20 : 0), 0.06));
    }
  }
  return merge(...out);
}

/** A point along a curve from `a` to `b` bent toward `c`, `u` of the way. */
const bez = (a: V3, c: V3, b: V3, u: number): V3 => add(add(scale(a, (1 - u) * (1 - u)), scale(c, 2 * u * (1 - u))), scale(b, u * u));

/* ---- the limbs ------------------------------------------------------------------------------ */

/** A length of limb: two or three rounded stones down its bone. */
function limbStones(len: number, w0: number, w1: number, n: number, seed: number, count = 2): Mesh {
  const out: Mesh[] = [orb([0, 0, -len * 0.5], [w0 * 0.7, w0 * 0.7, len * 0.55], n, 4, 'stone')];
  for (let q = 0; q < count; q++) {
    const u = (q + 0.5) / count, w = lerp(w0, w1, u);
    out.push(stone([0, 0, -len * u], [w * 1.0, w * 0.95, len / count * 0.62 + w * 0.2], seed + q, n, jitter(seed + q) < 0.3 ? 'coatLight' : 'coat'));
  }
  return merge(...out);
}

/** A fist: a big rounded block, four knuckle stones across its front and a thumb stone. */
function fistOf(r: number, n: number, seed: number, mossy: boolean): Mesh {
  const c: V3 = [0, r * 0.1, -r * 0.8];
  const palm = merge(stone(c, [r * 0.95, r * 0.85, r * 0.9], seed, n, 'coat'),
    // Moss over the back of it.
    mossy ? stone(add(c, [-r * 0.2, -r * 0.2, r * 0.62]), [r * 0.62, r * 0.55, r * 0.3], seed + 30, n, 'moss') : null);
  const knuckles = [-0.66, -0.22, 0.22, 0.66].map((x, q) => stone(add(c, [x * r * 0.92, r * 0.62, -r * 0.42]), [r * 0.3, r * 0.34, r * 0.42], seed + q + 1, n, q % 2 ? 'coatLight' : 'coat'));
  const thumb = stone(add(c, [r * 0.82, r * 0.42, r * 0.1]), [r * 0.28, r * 0.36, r * 0.32], seed + 9, n, 'coatLight');
  const thumb2 = stone(add(c, [-r * 0.82, r * 0.42, r * 0.1]), [r * 0.28, r * 0.36, r * 0.32], seed + 11, n, 'coatLight');
  return merge(palm, ...knuckles, thumb, thumb2);
}

/** A foot: three flattened stones splayed forward of the ankle, flat underneath. */
function footOf(w: number, len: number, sole: number, n: number, seed: number): Mesh {
  const parts = [-0.5, 0, 0.5].map((x, q) => stone([x * w * 0.8, len * 0.42, -sole * 0.62], [w * 0.42, len * 0.42, sole * 0.5 + w * 0.12], seed + q, n, q === 1 ? 'coatLight' : 'coat'));
  const heel = stone([0, 0, -sole * 0.5], [w * 0.75, w * 0.7, sole * 0.6], seed + 7, n, 'coat');
  const m = merge(heel, ...parts);
  return mesh(m.v.map((p) => [p[0], p[1], Math.max(p[2], -sole)] as V3), m.f);
}

/** Its arms and legs. */
function limbs(s: Golem, n: number): Piece[] {
  const out: Piece[] = [];
  const A = s.arm, L = s.leg, B = s.brick;
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    const shoulder = B.shoulder ? moved(brickBand(A.w[0] * 1.15, -A.len[0] * 0.15, 2, 9, A.w[0] * 0.17, 600 + k * 50), [0, 0, 0]) : null;
    const upper = merge(limbStones(A.len[0], A.w[0] * 1.15, A.w[0], n, 70 + k * 10, 2), shoulder,
      // The Fortigran's cream band round its upper arm, under its arch.
      s.arches ? brickBand(A.w[0] * 1.12, -A.len[0] * 0.45, 1, 10, A.w[0] * 0.22, 700 + k * 9, (i) => (i % 2 ? 'horn' : 'hornDark')) : null);
    // A forearm of stone, or, for a stage with brick on it, a sleeve of brick from the elbow down to the wrist.
    const fore = B.fore
      ? merge(stone([0, 0, -A.len[1] * 0.02], [A.w[1] * 0.95, A.w[1] * 0.9, A.w[1] * 0.6], 90 + k * 10, n), brickSleeve(-A.len[1] * 0.1, -A.len[1] * 1.02, A.w[1] * 0.98, A.w[1] * 1.08, n, 800 + k * 40))
      : limbStones(A.len[1], A.w[1], A.w[1] * 1.1, n, 90 + k * 10, 2);
    out.push(
      { key: `arm${k}`, mesh: upper, bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: false },
      { key: `fore${k}`, mesh: fore, bone: `elbow${k}`, bias: 0.035, after: 'body', front },
      { key: `hand${k}`, mesh: fistOf(A.fist, n, 120 + k * 20, s.moss > 0 && k === 0), bone: `hand${k}`, bias: 0.04, after: ['body', `fore${k}`], front },
    );
  }
  for (const [key, sd, k] of [['ll', -1, 0], ['lr', 1, 1]] as Array<[string, number, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    out.push(
      { key: `${key}0`, mesh: limbStones(L.len[0], L.w[0], L.w[1], n, 150 + k * 10, 1), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front },
      { key: `${key}1`, mesh: B.shin
        ? merge(stone([0, 0, 0], [L.w[1] * 0.95, L.w[1] * 0.9, L.w[1] * 0.55], 170 + k * 10, n), brickSleeve(-L.len[1] * 0.05, -L.len[1] * 1.15, L.w[1] * 0.98, L.w[1] * 1.04, n, 900 + k * 40))
        : limbStones(L.len[1], L.w[1], L.w[1], n, 170 + k * 10, 1), bone: `${key}1`, bias: 0.015, after: 'body', front },
      { key: `${key}2`, mesh: footOf(L.w[1] * 1.1, L.foot, L.len[2], n, 190 + k * 10), bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** The block of stone it works at, on the ground before it, and the brick it has made of the last. */
function workBlockOf(s: Golem): Mesh {
  const r = s.arm.fist * 0.85, h = blockOf(s, raws.get(s)!).h;
  return merge(
    // Its top where the knuckles land.
    block([0, 0, h * 0.5], [r * 0.95, r * 0.85, h * 0.5], frameOf([0, 0, 1], [0.2, 1, 0]), (f) => (f === 1 ? 'coatLight' : f % 2 ? 'coat' : 'coatDark'), 1001, 0.1),
    // And the brick it made of the last, beside it.
    block([r * 1.7, -r * 0.3, r * 0.2], [r * 0.5, r * 0.26, r * 0.2], frameOf([0, 0, 1], [0.6, 1, 0]), (f) => (f === 1 ? 'coatLight' : 'coat'), 1003, 0.04),
  );
}

/** A stage's pieces. */
function golemBuild(s: Golem, lod: number): Piece[] {
  const n = cut(lod, 7, 9);
  const T = s.torso, H = s.head;
  const torsoSolid = { c: T.c, r: scale(T.r, 0.86) };
  const headSolid = { c: H.c, r: scale(H.r, 0.7) };
  const pieces: Piece[] = [
    { key: 'hips', mesh: merge(orb([0, 0, 0], scale(s.hips, 0.8), n + 2, 4, 'stone'), ...[-1, 1].map((sd, q) => stone([sd * s.hips[0] * 0.45, 0, 0], [s.hips[0] * 0.6, s.hips[1] * 0.95, s.hips[2] * 0.95], 220 + q, n))), bone: 'body', bias: 0 },
    { key: 'body', mesh: bodyOf(s, n), bone: 'chest', bias: 0.005, breathes: { c: T.c, k: 0.02 } },
    { key: 'head', mesh: headOf(s, n), bone: 'head', bias: 0.2, hide: [headSolid] },
    { key: 'block', mesh: workBlockOf(s), bone: 'block', bias: 0.05, shown: (a) => a.act?.kind === 'work' },
    ...limbs(s, n),
  ];
  const sh = shardsOf(s);
  if (sh) pieces.push({ key: 'shards', mesh: sh, bone: 'chest', bias: 0.03, after: ['body'], hide: [torsoSolid] });
  const pl = plateOf(s);
  if (pl) pieces.push({ key: 'plate', mesh: pl, bone: 'chest', bias: 0.07, after: ['body'], hide: [torsoSolid] });
  const tw = towerOf(s);
  if (tw) pieces.push({ key: 'tower', mesh: tw, bone: 'chest', bias: 0.02, after: ['body'], hide: [torsoSolid] });
  return pieces;
}

/* ---- the chips it knocks off ------------------------------------------------------------------ */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const thrown = (p: V3, v: V3, s: number, fall = 14): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/**
 * Chips of stone flung off the block at each tap at its task, and off what it strikes at each blow: small grey-cream flecks
 * flying out and falling, drawn over it for those on the viewer's side of it and under it for the rest.
 */
function chips(g: CanvasRenderingContext2D, view: View, s: Golem, b: Bones, a: Anim, front: boolean, pal: { light: RGB; dark: RGB }): void {
  const act = a.act;
  if (!act || (act.kind !== 'work' && act.kind !== 'strike')) return;
  const hits = act.kind === 'work' ? GOLEM_TAPS : [GOLEM_HITS[s.stage]];
  const secs = ACT_SECS[act.kind];
  const from = act.kind === 'work' ? place(b.block, [0, 0, blockOf(s, raws.get(s)!).h]) : place(b.hand1, [0, s.arm.fist, -s.arm.fist]);
  const mid = place(b.chest, s.torso.c), big = [0.7, 0.95, 1.25][s.stage];
  const paths = [new Path2D(), new Path2D()];
  let any = false;
  hits.forEach((hit, h) => {
    const since = (act.t - hit) * secs;
    if (since < 0 || since > 0.5) return;
    for (let q = 0; q < 9; q++) {
      const i = h * 37 + q;
      const th = (q / 9) * TAU + jitter(i) * 0.7, sp = (1.4 + 1.8 * jitter(i + 3)) * big;
      const p = thrown(from, [Math.cos(th) * sp, Math.sin(th) * sp, (2 + 2.4 * jitter(i + 7)) * big], since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const r = (0.07 + 0.06 * jitter(i + 2)) * big;
      const path = paths[q % 2];
      path.moveTo(x + r, y);
      path.lineTo(x, y + r * 0.8);
      path.lineTo(x - r, y);
      path.lineTo(x, y - r * 0.8);
      path.closePath();
      any = true;
    }
  });
  if (!any) return;
  g.fillStyle = css(pal.light, 0.95);
  g.fill(paths[0]);
  g.fillStyle = css(pal.dark, 0.95);
  g.fill(paths[1]);
}

/* ---- the kinds ----------------------------------------------------------------------------- */

const AMBER: RGB = [255, 214, 84];

function golemKind(s: Golem): Kind {
  const bones = golemBones(s);
  let tones = { light: [236, 222, 196] as RGB, dark: [168, 150, 128] as RGB };
  return {
    bones,
    build: (lod) => golemBuild(s, lod),
    // The variant's coat is its stone, its mark its brick. The amber of its eyes and gem, the orange of its shards and the moss
    // are the same on every variant.
    palette: (coat, mark) => {
      // Warm peach sandstone, as the sheet's: its mid a tan-peach, its lit faces cream, its shade a warm brown, and the joints
      // between the stones a deep brown. The variant only tints it; it never goes to chalk.
      const sand = mix(coat, [214, 160, 118], 0.72);
      const brick = mix(mark, [206, 104, 62], 0.35);
      tones = { light: mix(sand, [246, 226, 196], 0.6), dark: mix(sand, [150, 92, 62], 0.6) };
      return coatPalette(coat, mark, {
        coat: sand,
        coatDark: mix(sand, [168, 102, 70], 0.62),
        coatLight: mix(sand, [244, 220, 186], 0.62),
        stone: mix(sand, [96, 52, 38], 0.8),
        stoneDark: [62, 36, 32],
        shell: brick,
        shellDark: mix(brick, [120, 52, 34], 0.45),
        // The mortar between the bricks: a dark warm brown.
        hoof: [92, 50, 38],
        horn: mix(sand, [246, 226, 194], 0.7),
        hornDark: mix(sand, [216, 178, 138], 0.6),
        crystal: [255, 170, 70],
        crystalDark: [226, 118, 42],
        ember: AMBER,
        flame: [255, 168, 60],
        moss: [118, 168, 62],
        mark: brick,
      }, 30);
    },
    shadow: [[0.9, 1.4, 1.95][s.stage], [0.8, 1.15, 1.6][s.stage]],
    stride: 1.3,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work'],
    // Its eyes alight, and the Brickorn's gem.
    glow: (b) => [
      ...[-1, 1].map((sd) => ({ p: place(b.head, eyeAt(s, sd)), r: s.head.eye * 2.2, c: AMBER, a: 0.75 })),
      ...(s.plate ? [{ p: place(b.chest, onEgg(s.torso.c, s.torso.r, PLATE_DIR).p), r: s.plate * 0.9, c: AMBER, a: 0.4 }] : []),
    ],
    // Evolving, the motes rising round it are stone dust and amber.
    motes: [[232, 214, 186], AMBER],
    extra: (g, view, b, a, under) => chips(g, view, s, b, a, !under, tones),
  };
}

export const CHIPKIN = golemKind(CHIPKIN_LOOK);
export const BRICKORN = golemKind(BRICKORN_LOOK);
export const FORTIGRAN = golemKind(FORTIGRAN_LOOK);
