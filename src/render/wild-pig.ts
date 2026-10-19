import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, lifted, merge, mix, orb, orbAlong, paint, pastel, quadBones,
  quadPose, scale, shadowOf, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type MatOf, type Piece, type QuadPose,
  type QuadSpec,
} from './beasts';
import { cut, quadPieces, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { trot } from './wild-paws';

/**
 * The pig line: the Pigroot, a round little piglet-boar in a crown of leaves
 * and a garland, which grows into the Plowhog, a sturdy young boar under a
 * mantle of leaves in a green harness with a cow-bell at its throat, and then
 * the Harvestusk, a massive war-boar of the harvest under a mane of leaves,
 * wheat and flowers, in a green and gold caparison with a big gold bell. The
 * species is still `seavic` underneath, as saves and the database know it.
 *
 * Each is a tan-brown boar with a cream belly and lower face, a pink snout,
 * warm brown eyes and big pink-lined ears, on dark cloven hooves; its tusks
 * come up out of its lower jaw beside the snout and curve up, growing from
 * ivory nubs to great earth-stained sweeps past its snout. All three are
 * built by one set of functions from a description of the stage (`Pig`), so a
 * stage is its numbers. It farms: it roots a furrow through the soil with its
 * snout and tusks, then noses a seed in and a sprout comes up.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body or a head: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Pig {
  /** Which it is, for the things a stage does its own way: what it wears, how it strikes. */
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest, and how far round its underside the cream of its belly comes (radians). */
  body: Rings;
  belly: number;
  /** Shoulder to hip, and the legs: how long, how thick at the top, and how tall the hoof is. */
  len: number;
  legs: number;
  thick: number;
  hoof: number;
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /**
   * The head's rings in its own frame, from the back of the skull to the end of the snout; how far nose-up it is carried
   * (degrees); how deep its chin is against the muzzle, and how far out its jowls are set; and for each band between two
   * rings, how high up its side the cream of the lower face comes (the sine of the angle from level).
   */
  head: Rings & { pitch: number; chin: number; jowl: number; cream: number[] };
  /** The eyes: how far along the head, how far up its side from level (radians), how big, how heavy a brow, and how far a lid of fur comes down over each. */
  eye: { y: number; up: number; size: number; brow: number; lid: number };
  /** Each ear: its length and width, and how far it is splayed out and laid back (degrees). */
  ear: { len: number; w: number; out: number; back: number };
  /** How big its tusks are: under a half, ivory nubs; one, a young boar's; past two, a war-boar's. */
  tusk: number;
  /** The crown of leaves on its head: how many, how long, how wide they are fanned; and how many flowers and ears of wheat in it. */
  crown: { n: number; len: number; spread: number; flowers: number; wheat: number };
  /** The rows of leaves round its neck, front to back: how many in each, how long, how far back they are swept (degrees). */
  ruff: Array<[number, number, number]>;
  /** How much longer the leaves over the nape stand, and how far up; and how far the leaves down its sides hang. */
  wild: number;
  hang: number;
  /** The leaves over its back: how many rows from the withers to the rump, the longest, and how far down its flanks (radians from the ridge). */
  back: { rows: number; len: number; down: number };
  /** Ears of wheat standing in its mane and along its back, and flowers in it. */
  wheat: number;
  flowers: number;
  /** How long the shaggy cream fur is on its chest and legs; nought for none. */
  fur: number;
  /** How tall the bell at its throat is. */
  bell: number;
  /** The tail: how long each of its links is, how far it curls at each, and how long the leaves of its tuft (nought for none). */
  tail: { len: number; curl: number; tuft: number };
  /**
   * How it goes: a trot at a walk too or a four-beat walk; how much it bobs and nods; how far it rolls its weight from side to
   * side; how far its legs swing at a walk and a run, and for how much of a stride a foot is down.
   */
  gait: { trot: boolean; bob: number; nod: number; roll: number; swing: [number, number]; duty: [number, number] };
  size: number;
}

/** A Pigroot: a round little piglet with a domed head too big for it, big eyes, a short snout, short legs, ivory nubs at its jaw. */
const PIGROOT_LOOK: Pig = {
  stage: 0,
  body: { y: [-1.0, -0.86, -0.46, 0.06, 0.52, 0.82, 0.94], z: [0.12, 0.11, 0.11, 0.13, 0.14, 0.16, 0.18], w: [0.5, 0.86, 1.07, 1.12, 1.04, 0.82, 0.38], h: [0.54, 0.87, 0.97, 1.03, 0.95, 0.8, 0.34] },
  belly: 1.25,
  len: 1.9, legs: 0.75, thick: 0.29, hoof: 0.15,
  neck: { at: [0, 0.84, -0.12], len: 0.3, w: 0.66, lean: 70 },
  head: {
    y: [-0.4, -0.25, 0.02, 0.32, 0.5, 0.7, 0.92, 1.1, 1.18], z: [0.28, 0.3, 0.27, 0.2, 0.12, 0.08, 0.08, 0.09, 0.1],
    w: [0.4, 0.92, 1.05, 0.9, 0.62, 0.44, 0.36, 0.32, 0.27], h: [0.44, 0.78, 0.85, 0.72, 0.54, 0.42, 0.35, 0.32, 0.25], pitch: 0, chin: 0.62, jowl: 0.62,
    cream: [-0.55, -0.25, 0.02, 0.22, 0.34, 0.42, 0.42, 0.42],
  },
  eye: { y: 0.3, up: 0.32, size: 0.18, brow: 0, lid: 0 },
  ear: { len: 0.85, w: 0.5, out: 72, back: 30 },
  tusk: 0.3,
  crown: { n: 6, len: 0.55, spread: 1.2, flowers: 3, wheat: 2 },
  ruff: [[20, 0.46, 58], [18, 0.4, 70]],
  wild: 0, hang: 0.2,
  back: { rows: 0, len: 0, down: 0 },
  wheat: 0, flowers: 4,
  fur: 0,
  bell: 0.2,
  tail: { len: 0.18, curl: -75, tuft: 0 },
  gait: { trot: true, bob: 0.22, nod: 4, roll: 3, swing: [24, 28], duty: [0.56, 0.36] },
  size: 2.0,
};

/** A Plowhog: a sturdy young boar, low and deep in the barrel, its head on a longer muzzle, a mantle of leaves over its back. */
const PLOWHOG_LOOK: Pig = {
  stage: 1,
  body: { y: [-1.4, -1.24, -0.72, 0.02, 0.76, 1.28, 1.46], z: [0.14, 0.12, 0.12, 0.14, 0.2, 0.26, 0.28], w: [0.6, 0.92, 1.04, 1.08, 1.1, 0.98, 0.44], h: [0.58, 0.84, 0.94, 0.98, 1.0, 0.92, 0.44] },
  belly: 0.95,
  len: 2.6, legs: 1.15, thick: 0.4, hoof: 0.19,
  neck: { at: [0, 1.22, -0.12], len: 0.85, w: 0.8, lean: 65 },
  head: {
    y: [-0.45, -0.28, 0.05, 0.44, 0.84, 1.18, 1.34, 1.48, 1.53], z: [0.34, 0.32, 0.26, 0.2, 0.1, 0.02, 0.0, -0.01, -0.01],
    w: [0.3, 0.7, 0.84, 0.68, 0.48, 0.37, 0.36, 0.32, 0.27], h: [0.42, 0.74, 0.78, 0.62, 0.46, 0.38, 0.37, 0.34, 0.29], pitch: 2, chin: 0.58, jowl: 0.5,
    cream: [-0.75, -0.55, -0.3, -0.12, 0.0, 0.08, 0.1, 0.1],
  },
  eye: { y: 0.46, up: 0.3, size: 0.15, brow: 0.6, lid: 0.12 },
  ear: { len: 1.2, w: 0.56, out: 64, back: 24 },
  tusk: 1,
  crown: { n: 6, len: 0.7, spread: 1.5, flowers: 3, wheat: 0 },
  ruff: [[22, 0.62, 30], [22, 0.72, 44]],
  wild: 0.4, hang: 0.15,
  back: { rows: 7, len: 0.78, down: 1.05 },
  wheat: 0, flowers: 3,
  fur: 0.22,
  bell: 0.4,
  tail: { len: 0.2, curl: -24, tuft: 0.4 },
  gait: { trot: false, bob: 0.2, nod: 3, roll: 3, swing: [20, 26], duty: [0.64, 0.4] },
  size: 2.1,
};

/**
 * A Harvestusk: a massive war-boar, deep and broad in the chest and humped at the shoulder, its great head carried low and
 * level with its back, tusks as long as its head sweeping out and forward from its jaw, and a crest of leaves, wheat and
 * flowers along the whole of its back, tallest over the shoulders.
 */
const HARVESTUSK_LOOK: Pig = {
  stage: 2,
  body: { y: [-1.9, -1.7, -1.02, -0.1, 0.82, 1.56, 1.84], z: [0.08, 0.08, 0.12, 0.26, 0.56, 0.62, 0.6], w: [0.82, 1.44, 1.54, 1.56, 1.62, 1.46, 0.6], h: [0.6, 1.04, 1.2, 1.36, 1.6, 1.5, 0.62] },
  belly: 0.85,
  len: 3.4, legs: 1.45, thick: 0.56, hoof: 0.26,
  neck: { at: [0, 1.72, 0.3], len: 0.6, w: 1.1, lean: 72 },
  head: sized(1.25, {
    y: [-0.52, -0.3, 0.1, 0.54, 1.02, 1.5, 1.72, 1.92, 1.98], z: [0.38, 0.34, 0.26, 0.16, 0.04, -0.06, -0.08, -0.09, -0.09],
    w: [0.38, 0.9, 1.02, 0.84, 0.6, 0.48, 0.46, 0.41, 0.34], h: [0.34, 0.86, 0.92, 0.8, 0.64, 0.56, 0.5, 0.44, 0.36], pitch: 0, chin: 0.44, jowl: 0.62,
    cream: [-0.8, -0.6, -0.35, -0.18, -0.05, 0.02, 0.05, 0.05],
  }),
  eye: { y: 0.6, up: 0.3, size: 0.165, brow: 1, lid: 0.22 },
  ear: { len: 1.2, w: 0.62, out: 70, back: 24 },
  tusk: 3.2,
  crown: { n: 7, len: 0.85, spread: 2.0, flowers: 2, wheat: 2 },
  ruff: [[28, 0.9, 20], [28, 1.0, 32], [26, 1.1, 44], [24, 1.15, 52]],
  wild: 0.6, hang: 0.15,
  back: { rows: 9, len: 0.95, down: 0.4 },
  wheat: 12, flowers: 5,
  fur: 0.3,
  bell: 0.62,
  tail: { len: 0.24, curl: -18, tuft: 0.5 },
  gait: { trot: false, bob: 0.15, nod: 2, roll: 4, swing: [16, 22], duty: [0.68, 0.46] },
  size: 1.85,
};

/** A head's rings, every one of them `k` times the size. */
function sized(k: number, H: Pig['head']): Pig['head'] {
  const by = (xs: number[]): number[] => xs.map((x) => x * k);
  return { ...H, y: by(H.y), z: by(H.z), w: by(H.w), h: by(H.h) };
}

/** A number of its own for each leaf, nought to one, so a mane is not a pattern. */
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
const onHead = (s: Pig, y: number, th: number): { p: V3; n: V3 } => onRings(s.head, y, th);
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Where the end of the snout is, in the head's frame. */
function noseOf(s: Pig): V3 {
  const H = s.head, last = H.y.length - 1;
  return [0, H.y[last], H.z[last]];
}

/** Where each ear is rooted on the head (the right one): high on the side of the skull, behind the cheeks. */
function earRoot(s: Pig): V3 {
  const H = s.head, q = onHead(s, lerp(H.y[1], H.y[2], 0.45), 1.02);
  return sub(q.p, scale(q.n, 0.12));
}

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/* ---- the body's solids, and its outer surface ----------------------------------------------- */

/** An egg: its middle and its half-sizes. */
interface Egg { c: V3; r: V3 }

/** The mass of a ham over each hind leg and of a shoulder over each fore leg, part of the barrel (`quartersOf`). */
function solidsOf(s: Pig): Egg[] {
  const spec = specOf(s), w = s.thick, out: Egg[] = [];
  for (const sd of [1, -1]) {
    const hip = spec.hind.at, sh = spec.fore.at;
    // (The Pigroot's set lower and flatter, under the arc of its back rather than a lump on it.)
    out.push({ c: [sd * (hip[0] + w * 0.15), hip[1] - 0.05, hip[2] + 0.24 - (s.stage ? 0 : 0.1)], r: [w * 1.12 + 0.1, w * 1.55 + 0.14, s.body.h[2] * (s.stage ? 0.56 : 0.45)] });
    out.push({ c: [sd * (sh[0] + w * 0.1), sh[1], sh[2] + 0.27], r: [w * 1.0 + 0.1, w * 1.3 + 0.12, s.body.h[4] * 0.5] });
  }
  return out;
}

/** How far along `n` from `p` the way out of an egg is, if `p` is inside it; nought if not. */
function outOf(p: V3, n: V3, e: Egg): number {
  const P: V3 = [(p[0] - e.c[0]) / e.r[0], (p[1] - e.c[1]) / e.r[1], (p[2] - e.c[2]) / e.r[2]];
  const N: V3 = [n[0] / e.r[0], n[1] / e.r[1], n[2] / e.r[2]];
  const a = dot(N, N), b = dot(P, N), c = dot(P, P) - 1;
  if (c >= 0) return 0;
  return (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a;
}

/**
 * Where the outside of it is, `y` along the barrel and `th` round it, and `off` out from there: on the barrel, or on the
 * ham or the shoulder where they stand out of it, and on the Harvestusk on its caparison. What lies on it -- a strap, a bag,
 * a leaf's root -- goes through these points, so it lies on it rather than in the air or under it.
 */
function outer(s: Pig, y: number, th: number, off: number): { p: V3; n: V3 } {
  const q = onRings(s.body, y, th);
  let p = q.p;
  for (const e of solidsOf(s)) {
    const t = outOf(p, q.n, e);
    if (t > 0) p = add(p, scale(q.n, t));
  }
  return { p: add(p, scale(q.n, off + (s.stage === 2 ? CAP_OFF : 0))), n: q.n };
}

/* ---- its bones ------------------------------------------------------------------------- */

/** A stage's body on four hooves (`QuadSpec`): its legs, neck, ears and tail from its numbers, and a pig's short stride. */
function specOf(s: Pig): QuadSpec {
  // The Harvestusk stands wider on its legs, under a broader body.
  const wide = s.stage === 2 ? 0.1 : 0;
  return {
    high: s.legs + 0.7,
    fore: { at: [s.body.w[4] * 0.52 + wide, s.len * 0.42, -0.25], len: [s.legs * 0.5, s.legs * 0.5, s.hoof], rest: [-3, 0, 0], fold: [55, 85], toe: [s.thick * 0.88, s.thick * 0.44] },
    hind: { at: [s.body.w[2] * 0.54 + wide * 2.2, -s.len * 0.38, -0.2], len: [s.legs * 0.54, s.legs * 0.54, s.hoof], rest: [14, -28, 0], fold: [35, 55], toe: [s.thick * 0.88, s.thick * 0.44] },
    neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
    head: { pitch: s.head.pitch },
    tail: { at: [0, s.body.y[0] + 0.06, s.body.z[0] + s.body.h[0] * 0.55], links: 3, len: s.tail.len, lift: s.stage ? 6 : 34, curl: s.tail.curl, sway: 12 },
    ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
    swing: s.gait.swing,
    duty: s.gait.duty,
    graze: 0,
    nose: 0,
    bow: 0,
    rock: 5,
  };
}

/** Where each leg's foot is in a stride at a walk as `quadPose` has it, a four-beat, and in a trot, the diagonals together. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * The strike, as shares of it: gathered by `gather`, the blow landing at `hit` (a quarter of a second in), and settled by
 * the end. The Harvestusk's fore hooves come down in its stamp at `hit` too.
 */
export const PIG_STRIKE = { gather: 0.36, hit: 0.5 } as const;
/** How far into a strike the scrape of a fore hoof before the charge is over, from its start. */
const SCRAPE = 0.24;

/**
 * A go at its task, as shares of it: its snout goes into the soil at `bite` and is pushed forward through it until `plow`,
 * with a shove at each of `shoves`; lifted out by `lift`, and nosed down once at `poke`, which puts the seed in and brings
 * the sprout up; and drawn back to where it began by the end, so the next go starts where this one did.
 */
export const PIG_WORK = { bite: 0.1, shoves: [0.24, 0.44] as const, plow: 0.56, lift: 0.64, poke: 0.72, back: 0.8 } as const;

/** How far through a strike it has gathered itself (nought to one and gone again by the blow) and thrown itself forward, and its settling. */
function strikeOf(t: number): { gather: number; thrust: number; settle: number } {
  const S = PIG_STRIKE;
  const gather = ramp(t, 0, S.gather) * (1 - ramp(t, S.gather, S.hit));
  const thrust = ramp(t, S.gather - 0.02, S.hit) * (1 - ramp(t, S.hit + 0.04, 1));
  const after = clamp((t - S.hit) / (1 - S.hit));
  const settle = t > S.hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
  return { gather, thrust, settle };
}

/**
 * A go at its task: how far its head is down at the soil (eased in and out of a go played once, held while it works on),
 * how far forward through the soil its snout has been pushed, the jolt of each shove, how far it has lifted its snout out,
 * and the poke that puts the seed in. Played once, everything comes back up together in one ease at the end.
 */
function workOf(t: number, graze: number): { down: number; plow: number; shove: number; lift: number; poke: number } {
  const W = PIG_WORK;
  const back = ramp(t, 0.7, 1);
  const down = Math.max(graze, ramp(t, 0, 0.45) * (1 - back));
  const plow = ramp(t, W.bite, W.plow) * (1 - ramp(t, W.back, 1));
  const shove = Math.max(...W.shoves.map((c) => hump(t, c, 0.07)));
  // The poke: nosed down quickly onto the seed, and lifted away from it more slowly.
  const poke = ramp(t, W.poke - 0.09, W.poke) * (1 - ramp(t, W.poke, W.poke + 0.13));
  const lift = ramp(t, W.plow - 0.02, W.lift) * (1 - back) - poke;
  return { down, plow, shove, lift, poke };
}

/**
 * How far the whole body is carried forward this moment, in its own units: drawn back as it gathers to strike and thrown
 * forward as it charges; and leaning forward behind its snout as it plows, its hindquarters driving at each shove. Its legs
 * are swung back by as much, so its hooves stay where they are.
 */
function surge(s: Pig, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t), far = [0.2, 0.24, 0.18][s.stage];
    return s.len * (far * k.thrust - 0.09 * k.gather - 0.04 * k.settle);
  }
  if (act?.kind === 'work') {
    const w = workOf(act.t, a.graze);
    return s.len * w.down * (0.06 * w.plow + 0.04 * w.shove) * (s.stage ? 1 : 0.5);
  }
  return 0;
}

/**
 * Its head down at the soil, `down` of the way, as a boar roots: the neck bowed down from its low carriage (`fit`), the head
 * nose down past level by a third of a right angle so the snout leads forward into the soil rather than tucking under, the
 * forequarters let down, and the head reached forward along the neck as far as it must (`reachOf`, in `pigBones`).
 */
function headDown(s: Pig, p: QuadPose, down: number): void {
  p.neck[0] += down * (trialBow ?? neckBowOf(s));
  p.head[0] -= down * 26;
  p.pitch -= down * 3;
  const ears = Math.min(1, 1.0 / s.ear.len);
  p.ears[0][0] += down * 12 * ears;
  p.ears[1][0] += down * 12 * ears;
}

/** While a stage's bow and reach are being found (`fit`), the ones being tried. */
let trialBow: number | null = null;
let trialReach: number | null = null;
const bows = new Map<Pig, { bow: number; reach: number }>();

/** The underside of the end of its snout, in the head's frame: what goes into the soil. */
const rimOf = (s: Pig): V3 => { const H = s.head, last = H.y.length - 1; return [0, H.y[last], H.z[last] - H.h[last]]; };

/**
 * How far it bows its neck to put its snout in the soil, and how far its head then reaches forward along it: the neck bowed
 * until the rim of its snout meets the ground at the deepest of its plowing, up to bowed half way to straight down; and if
 * that is not far enough, the head reached along the neck the rest of the way, never more than half the length of its skull
 * behind the neck's end, and the neck drawn out by as much (`pigBuild`). Found by halving, once for each stage.
 */
function neckBowOf(s: Pig): number { return fit(s).bow; }
export function reachOf(s: Pig): number { return fit(s).reach; }
function fit(s: Pig): { bow: number; reach: number } {
  const had = bows.get(s);
  if (had) return had;
  const bones = pigBones(s), rim = rimOf(s), tusk = s.tusk >= 0.5 ? tuskLine(s) : [], thick = s.tusk >= 0.5 ? tuskWidths(s) : [];
  // The rim of the snout down to the soil, but the undersides of the tusks never more than a thirtieth into it.
  const low = (bow: number, reach: number): number => {
    trialBow = bow;
    trialReach = reach;
    let lo = Infinity;
    for (const t of [...PIG_WORK.shoves, 0.34]) {
      const head = bones({ t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t } }).head;
      lo = Math.min(lo, place(head, rim)[2], ...tusk.map((q, i) => place(head, [q[0], q[1], q[2] - thick[i]])[2] + 0.045));
    }
    trialBow = trialReach = null;
    return lo;
  };
  // Bowed down from its carriage at most to half way between level and straight down.
  const most = 135 - s.neck.lean, cap = 0.5 * Math.abs(s.head.y[0]);
  let a = -40, z = most;
  for (let q = 0; q < 14; q++) { const m = (a + z) / 2; if (low(m, 0) > 0.015) a = m; else z = m; }
  let reach = 0;
  if (low(a, 0) > 0.03) {
    let r0 = 0, r1 = cap;
    for (let q = 0; q < 14; q++) { const m = (r0 + r1) / 2; if (low(a, m) > 0.015) r0 = m; else r1 = m; }
    reach = r0;
  }
  const out = { bow: a, reach };
  bows.set(s, out);
  return out;
}

/** How far its head is reached along its neck this moment (`fit`). */
function reachNow(s: Pig, a: Anim): number {
  const act = a.act, down = act?.kind === 'work' ? workOf(act.t, a.graze).down : act ? 0 : a.graze;
  return down > 0 ? down * (trialReach ?? reachOf(s)) : 0;
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`), as it is meant: its gait -- the Pigroot's bouncing trot,
 * the Plowhog's steady plod, the Harvestusk's heavy four-beat walk -- the body's tip and how far it is lifted or let down; a
 * snuffle at the ground now and then as it stands; and its moves. Where its hooves go on the ground is worked out after
 * (`pigBones`), from this.
 */
function pigPose(s: Pig, spec: QuadSpec, p: QuadPose, a: Anim): void {
  trot(p, a);
  // The Pigroot's tail a corkscrew: each link turned to its side as well as curled, so it is a curl from behind too.
  if (s.stage === 0) p.tail[1] += 70;
  const g = smooth(a.go), G = s.gait;
  if (G.trot && a.go > 0 && a.gait < 0.5) {
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = step(a.u + DIAGONALS[i], duty, amp);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    const w = frac(a.u);
    // In the air only while all four hooves are: a run's two diagonal pairs each down for `duty` of a stride, half a stride
    // apart, and between them a moment with none down, the body carried up over it.
    const duty = lerp(G.duty[0], G.duty[1], a.gait), half = frac(a.u * 2) * 0.5;
    p.lift = duty < 0.5 && half > duty ? g * a.gait * [0.3, 0.2, 0.08][s.stage] * s.legs * Math.sin((Math.PI * (half - duty)) / (0.5 - duty)) : 0;
    // A trot rocks fore and aft with each diagonal pair it lands on, twice a stride, never once a stride, which would tip it
    // one way over one pair and the other over the next.
    p.pitch += g * a.gait * (1.5 * Math.sin(w * TAU * 2 + 0.6) - (spec.rock ?? 5) * Math.sin(w * TAU));
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.6);
    p.ears[0][0] += g * 3 * G.nod * Math.sin(w * TAU * 2 - 1.4) * Math.min(1, 1 / s.ear.len);
    p.ears[1][0] += g * 3 * G.nod * Math.sin(w * TAU * 2 - 1.1) * Math.min(1, 1 / s.ear.len);
    p.tail[1] += g * 18 * Math.sin(w * TAU + 0.4);
    if (s.stage === 2) {
      // The heavy walk: the head swinging a beat behind, and a rock fore and aft as each pair of hooves takes the weight.
      const walk = 1 - a.gait;
      p.neck[1] += g * 5 * walk * Math.sin(w * TAU + 0.3);
      p.pitch += g * 1.2 * Math.sin(w * TAU * 2 + 0.8);
    }
  } else if (!a.act) {
    // The Pigroot's big ears flicked half as far as they are given standing (`quadPose`, `trot`): a twitch, not a snap.
    if (s.stage === 0) for (const e of p.ears) e[0] *= 0.5;
    // Standing, now and then a snuffle at the ground in front of it, the snout working.
    const snuffle = beat(a.t, [7.4, 19.6], 1.6) * (1 - a.graze);
    p.neck[0] += 10 * snuffle;
    p.head[0] -= 10 * snuffle + 3 * snuffle * Math.sin(a.t * 30);
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') {
    const w = workOf(act.t, a.graze), d = w.down;
    // Its look about it as it stands put away while it is at the soil, so its snout goes where the furrow is.
    p.neck[1] *= 1 - d;
    p.head[1] *= 1 - d;
    p.head[2] *= 1 - d;
    // Rooting: the snout in the soil and pushed on through it, a shove of the hindquarters behind it twice a go; lifted out,
    // and nosed down once to put the seed in. The ears flop forward at each shove and the tail goes.
    headDown(s, p, d);
    p.neck[0] -= d * 1.5 * w.plow;
    p.head[0] += d * [15, 13, 10][s.stage] * w.lift;
    const ears = Math.min(1, 1.0 / s.ear.len);
    p.ears[0][0] -= d * 20 * w.shove * ears;
    p.ears[1][0] -= d * 20 * w.shove * ears;
    p.tail[1] += d * 60 * Math.sin(act.t * TAU * 3);
    p.tail[0] += d * 14 * w.shove;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, then at the turn a shake of the head, ears flapping, and the tail going.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.62, 0.85)), shake = hump(act.t, 0.55, 0.12);
    const ears = Math.min(1, 1.0 / s.ear.len);
    p.neck[0] -= 12 * up;
    p.head[0] += 14 * up;
    p.head[2] += 16 * shake * Math.sin(act.t * 70);
    p.ears[0][0] += (26 * shake * Math.sin(act.t * 70) - 14 * up) * ears;
    p.ears[1][0] -= (26 * shake * Math.sin(act.t * 70) + 14 * up) * ears;
    p.tail[1] += 25 * Math.sin(act.t * 30) * up;
  } else if (a.graze > 0) {
    // Head down at the ground, nosing at it: the work's own pose at its start, so a go at its task follows on from it.
    headDown(s, p, a.graze);
    p.neck[1] *= 1 - a.graze;
    p.head[1] *= 1 - a.graze;
    p.head[0] += a.graze * 3 * Math.sin(a.t * TAU * 1.5);
  }
  // However far the body is carried forward, the legs swung back by as much, so the hooves stay where they are -- but in a
  // strike the hooves step forward with the charge, lifted as they go, and back again as it settles, the fore the whole way
  // and the hind some of it, so the body is not thrown out past its legs.
  const d = surge(s, a);
  if (d) {
    const S = act?.kind === 'strike' ? strikeOf(act.t).thrust : -1;
    for (let i = 0; i < 4; i++) {
      const L = (i < 2 ? spec.fore : spec.hind).len, steps = S >= 0, k = i < 2 ? 1 : 0.85;
      p.legs[i][0] -= Math.asin(clamp((steps ? d * (1 - k * S) : d) / (L[0] + L[1]), -0.9, 0.9)) / DEG;
      if (steps) {
        // The hind hooves a shorter step, a beat after the fore.
        // (On the way in, the Pigroot's hop and the Harvestusk's rear already have its hooves off the ground.)
        const up = 4 * S * (1 - S) * (act!.t < PIG_STRIKE.hit ? (s.stage === 1 ? 1 : 0) : 0.5) * k;
        p.legs[i][1] += 0.3 * up;
        p.legs[i][2] = Math.max(p.legs[i][2], up);
      }
    }
  }
}

/** How far the body is let down onto its legs this moment as it walks: twice a stride, as each pair of hooves takes the weight. */
function dipOf(s: Pig, a: Anim): number {
  if (a.go <= 0) return 0;
  return smooth(a.go) * s.gait.bob * s.legs * (0.5 + 0.5 * Math.cos(frac(a.u) * TAU * 2 + [2.0, 0.3, 2.0][s.stage])) * (1 - 0.6 * a.gait);
}

/** How far down from its hip a leg reaches, and how far forward, as posed: its swing and its fold against the body's pitch. */
function legReach(L: QuadSpec['fore'], p: QuadPose, sw: number, f: number): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
  const a1 = (p.pitch + rest[0] + sw) * DEG, a2 = a1 + (rest[1] - f * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40))) * DEG;
  return [L.len[0] * Math.sin(a1) + L.len[1] * Math.sin(a2), L.len[0] * Math.cos(a1) + L.len[1] * Math.cos(a2)];
}

/** How high a hoof is carried at the top of its swing, as it goes: the Pigroot's high, a piglet's prance. */
const clearance = (s: Pig, a: Anim): number => smooth(a.go) * s.legs * (s.stage === 0 ? 0.3 : 0.16 + 0.08 * a.gait);

/**
 * The swing and fold that put a leg's hoof `y` forward of its hip and `z` down from it, worked out as the two bones of the leg
 * make a triangle with the line from the hip to the hoof: the knee bent the one way it bends, by as much as that line is
 * short of the leg's length. As far as it goes: a hoof asked to be further off than the leg reaches is put as far down as
 * the leg, as straight as it goes, reaches at that `y`. One answer, changing as smoothly as the hoof moves.
 */
/** How much short of its full length a leg begins to give up reaching (`legTo`), as a share of that length. */
const GIVE = 0.06;

function legTo(L: QuadSpec['fore'], p: QuadPose, y: number, z: number): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75], [l0, l1] = L.len;
  // The knee's bend straight, as far as it goes: unfolded, a leg whose lower bone is set back from its upper is still bent.
  const least = Math.max(0, -rest[1]) * DEG, most = 170 * DEG;
  // Never quite straight: as the hoof is asked further off than `far - give`, the leg reaches for it less and less, never
  // getting all the way, so its knee never snaps through the last of its bend (which a knee straightening right out does,
  // its bend changing faster and faster to nothing).
  const far = Math.hypot(l0 + l1 * Math.cos(least), l1 * Math.sin(least)), give = GIVE * (l0 + l1);
  let d = Math.hypot(y, z);
  if (d > far - give) {
    d = far - give * Math.exp(-(d - far + give) / give);
    z = Math.sqrt(Math.max(0, d * d - Math.min(y * y, d * d)));
  }
  const bend = Math.max(least, Math.min(most, Math.acos(clamp((d * d - l0 * l0 - l1 * l1) / (2 * l0 * l1), -1, 1))));
  const a1 = Math.atan2(y, z) + Math.atan2(l1 * Math.sin(bend), l0 + l1 * Math.cos(bend));
  const sw = a1 / DEG - p.pitch - rest[0];
  const f = (bend / DEG + rest[1]) / lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40));
  return [sw, Math.max(0, f)];
}

/** A leg bent so that its hoof reaches `want` down from its hip, no further forward or back than it is (`legTo`). */
function plant(L: QuadSpec['fore'], p: QuadPose, i: number, want: number): void {
  const [y] = legReach(L, p, p.legs[i][0], p.legs[i][1]);
  const [sw, f] = legTo(L, p, y, want);
  p.legs[i][0] = sw;
  p.legs[i][1] = f;
}

/**
 * Each stage's strike. The Pigroot rears its head back, then hops into a butt with its forehead; the Plowhog lunges, head
 * low, drops its shoulders and hooks its tusk up and across; the Harvestusk scrapes a fore hoof, rears, charges, sweeps its
 * tusks up from low on one side to high on the other and stamps both fore hooves down as the blow lands.
 */
function strikePose(s: Pig, p: QuadPose, t: number): void {
  const k = strikeOf(t), S = PIG_STRIKE;
  // Gathered: down on its haunches, the rump let down and the head drawn in and down, the ears pinned back; then thrown
  // forward, its shoulders dropped into the blow. Its legs bend to it (`pigBones`).
  p.pitch += 6 * k.gather - 3 * k.thrust + 2 * k.settle;
  p.lift -= s.legs * (0.1 * k.gather + 0.06 * k.thrust);
  p.neck[0] += 14 * k.gather + 18 * k.thrust - 6 * k.settle;
  p.head[0] += -18 * k.gather - 4 * k.thrust + 5 * k.settle;
  // The ears laid back, the less the longer they are, so their tips do not whip.
  const ears = Math.min(1, 1.0 / s.ear.len) * (s.stage === 0 ? 0.6 : 1);
  for (const e of p.ears) e[0] += (34 * k.gather + 30 * k.thrust - 20 * k.settle) * ears;
  p.tail[0] += 26 * k.thrust;
  p.squash += 0.06 * k.gather - 0.04 * k.thrust;
  // The hind legs driving off their toes.
  p.foot[2] -= 14 * k.thrust;
  p.foot[3] -= 14 * k.thrust;
  if (s.stage === 0) {
    // Its head reared up and back as it gathers, then a hop into the butt, the forehead brought down and forward onto the
    // blow, and a bounce back off it; the ears held pinned through the blow.
    const rear = ramp(t, 0.05, 0.26) * (1 - ramp(t, 0.26, 0.4));
    const hop = hump(t, 0.43, 0.1);
    p.head[0] += 30 * rear;
    p.neck[0] -= 20 * rear;
    p.lift += 0.3 * s.legs * hop;
    for (const l of p.legs) { l[1] += 0.35 * hop; l[2] = Math.max(l[2], hop); }
    const butt = ramp(t, 0.3, S.hit) * (1 - ramp(t, S.hit + 0.08, 0.85));
    p.head[0] -= 28 * butt;
    p.neck[0] += 10 * butt;
    p.head[0] += 12 * hump(t, S.hit + 0.14, 0.08);
    for (const e of p.ears) e[0] += 18 * ramp(t, 0.3, 0.36) * (1 - ramp(t, 0.55, 0.7));
    p.squash += 0.08 * hump(t, S.hit + 0.02, 0.06);
    return;
  }
  if (s.stage === 1) {
    // The hook: head low and turned to its right as it lunges, its shoulders dropped, then swung up and across to its left,
    // the tusk leading.
    const low = ramp(t, 0.15, S.hit - 0.04) * (1 - ramp(t, S.hit - 0.04, S.hit + 0.04));
    const hook = ramp(t, S.hit - 0.1, S.hit + 0.06) * (1 - ramp(t, S.hit + 0.14, 0.92));
    p.neck[1] += 14 * low - 18 * hook;
    p.head[1] += 12 * low - 16 * hook;
    p.head[0] += -12 * low + 45 * hook;
    p.head[2] += 10 * low - 24 * hook;
    // The long ears held back against the head's swing up, so they ride it rather than whip.
    for (const e of p.ears) e[0] -= 22 * hook * Math.min(1, 1.0 / s.ear.len);
    p.pitch -= 2 * low + 1 * hook;
    p.lift -= s.legs * 0.08 * Math.max(low, hook);
    return;
  }
  // The Harvestusk: a fore hoof lifted, put down and scraped back along the ground before the charge, starting from still.
  const { w, up } = scrapeOf(t);
  p.legs[1][0] += 16 * w;
  p.legs[1][1] += 0.2 * up;
  p.legs[1][2] = Math.max(p.legs[1][2], up);
  // Both fore hooves raised as it rears into the charge, and stamped down as the blow lands.
  const rise = ramp(t, SCRAPE + 0.02, S.hit - 0.1) * (1 - ramp(t, S.hit - 0.09, S.hit));
  for (const i of [0, 1]) {
    p.legs[i][0] += 34 * rise;
    p.legs[i][1] += 1.0 * rise;
    p.legs[i][2] = Math.max(p.legs[i][2], rise);
  }
  p.pitch += 12 * rise;
  p.squash += 0.08 * hump(t, S.hit + 0.03, 0.07);
  // The sweep: its head low to its right as it comes in, then swung up and over to its left past the blow.
  const low = ramp(t, 0.2, S.hit - 0.04) * (1 - ramp(t, S.hit - 0.04, S.hit + 0.06));
  const sweep = ramp(t, S.hit - 0.08, S.hit + 0.14) * (1 - ramp(t, S.hit + 0.22, 0.96));
  p.neck[1] += 16 * low - 22 * sweep;
  p.head[1] += 12 * low - 16 * sweep;
  p.head[0] += -12 * low + 32 * sweep;
  p.head[2] += 12 * low - 22 * sweep;
}

/**
 * The Harvestusk's scrape of a fore hoof before its charge: lifted and swung forward from still, put down at the front of its
 * swing and dragged back along the ground, and lifted back to where it stood -- how far through its swing it is, from forward
 * (one) to back (minus one), and how far up, each move eased in and out.
 */
function scrapeOf(t: number): { w: number; up: number } {
  if (t >= SCRAPE) return { w: 0, up: 0 };
  const sc = t / SCRAPE;
  if (sc < 0.35) return { w: smooth(sc / 0.35), up: Math.sin((Math.PI * sc) / 0.35) ** 2 };
  if (sc < 0.75) return { w: 1 - 2 * smooth((sc - 0.35) / 0.4), up: 0 };
  return { w: smooth((sc - 0.75) / 0.25) - 1, up: 0.6 * Math.sin((Math.PI * (sc - 0.75)) / 0.25) ** 2 };
}

/** How far a strike rolls its barrel over its legs: into the side its head goes low on, and over the other way as it hooks up. */
function strikeRoll(s: Pig, t: number): number {
  if (!s.stage) return 0;
  const S = PIG_STRIKE;
  const low = ramp(t, 0.15, S.hit - 0.04) * (1 - ramp(t, S.hit - 0.04, S.hit + 0.05));
  const hook = ramp(t, S.hit - 0.06, S.hit + 0.08) * (1 - ramp(t, S.hit + 0.17, 0.93));
  return s.stage === 1 ? 3 * low - 4 * hook : 3 * low - 5 * hook;
}

const LEG_KEYS = ['fl', 'fr', 'hl', 'hr'];

/** How low the lowest sole of `feet` is. */
function lowOf(spec: QuadSpec, b: Bones, feet: readonly number[]): number {
  let low = Infinity;
  for (const i of feet) {
    const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
    for (const y of [ahead, -behind]) low = Math.min(low, place(b[`${LEG_KEYS[i]}2`], [0, y, -L.len[2]])[2]);
  }
  return low;
}

/** Whether a hoof is in use this moment and so bears no weight however low it is: the Harvestusk's fore hoof as it scrapes the ground. */
const busy = (s: Pig, a: Anim, i: number): boolean => a.act?.kind === 'strike' && s.stage === 2 && i === 1 && a.act.t < SCRAPE;

/**
 * How much of its weight each hoof bears this moment, nought to one: walking or running, a hoof bears weight only while it is
 * on the ground, taking it up over the first sixth of its time there and giving it up over the last; and in a run, with both
 * pairs off the ground between the beats, none bears any and the body flies. Raised in a move, a hoof bears none until it
 * is nearly down; and one in use bears none.
 */
function weightsOf(s: Pig, p: QuadPose, a: Anim): number[] {
  const G = s.gait, duty = lerp(G.duty[0], G.duty[1], a.gait);
  const beats = G.trot || a.gait >= 0.5 ? DIAGONALS : FOUR_BEAT, g = a.act ? 0 : smooth(a.go);
  return [0, 1, 2, 3].map((i) => {
    if (busy(s, a, i)) return 0;
    const still = 1 - smooth(p.legs[i][2] / 0.12);
    if (!g) return still;
    const q = frac(a.u + beats[i]) / duty;
    return lerp(still, q >= 1 ? 0 : smooth(q / 0.16) * smooth((1 - q) / 0.16), g);
  });
}

/**
 * How far each hoof holds the body down to where its leg reaches the ground from, nought to one: wholly while it is down;
 * from the last eighth of its swing, as it comes in to land, more and more, so the body is let down to meet it rather than
 * dropping onto it as it lands; and over the first eighth after it leaves the ground, less and less. Raised in a move, as
 * far as it is nearly down; in use, not at all.
 */
function holdsOf(s: Pig, p: QuadPose, a: Anim): number[] {
  return [0, 1, 2, 3].map((i) => {
    if (busy(s, a, i)) return 0;
    const off = p.legs[i][2];
    return 1 - smooth(a.act ? off / 0.4 : Math.min(off, 1 - off) / 0.3);
  });
}

/** How much of a hoof's swing it takes to let go of the ground's speed as it lifts, and to take it up again as it comes down. */
const SPEED_IN = 0.16;

/** How far a fore leg's knee and a hind leg's hock may bend, in degrees, under a hoof on the ground. */
const BENT = [75, 110];

/** How far the body may be carried over a hoof bearing none of its weight, beyond where that leg reaches the ground from. */
const SLACK = 0.35;

/** What the last bones worked out had each hoof bear, and how far through its swing it was: for tools that check the gait. */
export const PIG_FEET = { weight: [1, 1, 1, 1], off: [0, 0, 0, 0] };

/** Where the collar is round the neck, in the neck's frame, and the point at the throat the bell hangs from. */
function collarOf(s: Pig): { z: number; rx: number; ry: number; bell: V3 } {
  const z = s.neck.len * (s.stage === 1 ? 0.8 : s.stage ? 0.85 : 0.5), rx = s.neck.w * 1.0 + 0.05, ry = s.neck.w * 0.92 + 0.05;
  return { z, rx, ry, bell: [0, ry + 0.02, z - 0.04] };
}

/**
 * How the bell swings on its collar this moment, in degrees: forward and back, and side to side. It hangs straight down
 * whatever the neck does, swinging a beat behind the body: twice a stride fore and aft and once side to side as it walks, a
 * long swing set going by the blow of a strike, a jolt at each shove of the plowing, and rung hard at the turn of evolving --
 * each swing starting from where the bell is, not with a jump.
 */
function bellSwing(s: Pig, a: Anim): [number, number] {
  const g = smooth(a.go), w = frac(a.u), big = [1.25, 1, 0.8][s.stage];
  let fore = 2.5 * Math.sin((a.t * TAU) / 3) * (1 - g), side = 2 * Math.sin((a.t * TAU) / 4 + 1) * (1 - g);
  if (a.go > 0) {
    fore += g * (10 + 6 * a.gait) * Math.sin(w * TAU * 2 - 1.3) * big;
    side += g * 9 * Math.sin(w * TAU - 1.0) * big;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    // Swung back as the body is thrown forward under it, then set swinging by the blow, the swing growing over the first
    // twentieth of a second rather than starting at full speed.
    const k = strikeOf(act.t), S = PIG_STRIKE, after = act.t - S.hit, end = (1 - ramp(act.t, 0.9, 1)) * smooth(after / 0.1);
    fore += -16 * k.gather - 10 * k.thrust + (after > 0 ? 34 * Math.sin(after * 30) * Math.exp(-after * 5) * end : 0) * big;
    side += after > 0 ? -14 * Math.sin(after * 24) * Math.exp(-after * 5) * end : 0;
  } else if (act?.kind === 'work') {
    const W = workOf(act.t, a.graze);
    fore += W.down * (16 * W.shove * Math.sin(act.t * 70) + 10 * W.poke);
    side += W.down * 6 * Math.sin(act.t * TAU * 2);
  } else if (act?.kind === 'evolve') {
    const after = act.t - 0.5;
    if (after > 0) {
      const end = (1 - ramp(act.t, 0.92, 1)) * smooth(after / 0.05);
      fore += 30 * Math.sin(after * 40) * Math.exp(-after * 6) * end;
      side += 18 * Math.sin(after * 32) * Math.exp(-after * 6) * end;
    }
  }
  return [fore, side];
}

/** A turn about the ground's own axes: forward (about x) then to the side (about y), in degrees, for what hangs straight down. */
function hanging(fore: number, side: number): number[] {
  const a = fore * DEG, b = side * DEG, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // ry(b) * rx(a)
  return [cb, sb * sa, sb * ca, 0, ca, -sa, -sb, cb * sa, cb * ca];
}

/**
 * The bones of a stage. Its body is carried where its pose says (`pigPose`) -- its tip, and its height lifted or let down from
 * where it stands -- but never higher than the hooves bearing its weight can reach the ground from; then every leg is bent to
 * put its hoof where it should be: on the ground, as far as it bears the weight; clear of it by as much as its swing carries
 * it, as far as it does not; and, raised in a move, where the move has it, but never under the ground. So no hoof bearing
 * weight hangs over the ground, none goes into it, and the body passes from one to the next without a jump. Then it is
 * carried forward as it strikes and plows, its barrel rolled over its legs, and the bones of the mane, the collar and the
 * bell.
 */
function pigBones(s: Pig): (a: Anim) => Bones {
  const spec = specOf(s);
  const col = collarOf(s);
  const legOf = (i: number): QuadSpec['fore'] => (i < 2 ? spec.fore : spec.hind);
  /** How high its body stands, standing still, its knees a little bent. */
  let stand: number | undefined;
  /** How high the body can be for leg `i`, as it is swung, to reach the ground with it nearly straight. */
  const ceiling = (b: Bones, p: QuadPose, i: number, y0 = legReach(legOf(i), p, p.legs[i][0], p.legs[i][1])[0]): number => {
    const L = legOf(i);
    const [l0, l1] = L.len, least = Math.max(0, -(L.rest ?? [0, 0, 0])[1]) * DEG;
    const far = Math.hypot(l0 + l1 * Math.cos(least), l1 * Math.sin(least)) - GIVE * (l0 + l1);
    const most = Math.sqrt(Math.max(0, far * far - y0 * y0));
    return b.body.t[2] - place(b[`${LEG_KEYS[i]}0`], [0, 0, 0])[2] + most + L.len[2];
  };
  /**
   * How low the body can be for leg `i`, as it is swung, with its knee bent no further than `BENT` -- any lower and the knee
   * goes down into the ground under it.
   */
  const floor = (b: Bones, p: QuadPose, i: number, y0 = legReach(legOf(i), p, p.legs[i][0], p.legs[i][1])[0], moving = false): number => {
    // (Ten degrees less in a move, where the knee is bent deepest and longest.)
    const L = legOf(i), [l0, l1] = L.len, bend = (BENT[i < 2 ? 0 : 1] - (moving ? 10 : 0)) * DEG;
    const least = Math.sqrt(Math.max(0, l0 * l0 + l1 * l1 + 2 * l0 * l1 * Math.cos(bend) - y0 * y0));
    return b.body.t[2] - place(b[`${LEG_KEYS[i]}0`], [0, 0, 0])[2] + least + L.len[2];
  };
  /** Where each hoof is along the ground under the body standing, square under its hip: the middle of its stride. */
  const rest0 = quadPose(spec, { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  rest0.pitch = 0;
  const middle = [0, 1, 2, 3].map((i) => legOf(i).at[1] + legReach(legOf(i), rest0, 0, 0)[0]);
  /**
   * Where each hoof is along the ground this moment as it walks or runs, from the body's middle: on the ground, carried
   * back under the body at the body's own speed, from where it came down to where it leaves, so it does not slide; in the
   * air, brought forward again from where it left to where it will come down, starting and ending at the ground's own speed
   * (a curve whose speed at either end matches the ground's), so it neither flicks back as it lifts nor lands moving.
   * Every leg covers the same ground in a stride, what its swing carries the legs through between them.
   */
  const track = (a: Anim): number[] => {
    const G = s.gait, D = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    const beats = G.trot || a.gait >= 0.5 ? DIAGONALS : FOUR_BEAT, g = smooth(a.go);
    const span = g * ([spec.fore, spec.hind].reduce((t, L) => t + legReach(L, rest0, amp, 0)[0] - legReach(L, rest0, -amp, 0)[0], 0) / 2);
    return [0, 1, 2, 3].map((i) => {
      const P = frac(a.u + beats[i]);
      if (P < D) return middle[i] + span * (0.5 - P / D);
      // Eased from where it left to where it comes down, with the ground's speed let go of over the first sixth of the swing
      // and taken up again over the last.
      const t = (P - D) / (1 - D), m = (-span / D) * (1 - D);
      const w = (x: number): number => (x < SPEED_IN ? x * (1 - x / SPEED_IN) ** 2 : 0);
      return middle[i] - span / 2 + span * smooth(t) + m * (w(t) - w(1 - t));
    });
  };
  const posed = (a: Anim): QuadPose => {
    const p = quadPose(spec, { ...a, graze: 0 });
    pigPose(s, spec, p, a);
    return p;
  };
  const standing = (): number => {
    if (stand === undefined) {
      const p = posed({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
      p.roll = 0;
      const b = quadBones(spec, p);
      stand = Math.min(...[0, 1, 2, 3].map((i) => ceiling(b, p, i))) - 0.04 * s.legs;
    }
    return stand;
  };
  return (a) => {
    const act = a.act;
    const p = posed(a);
    // The roll of the body as it stands and goes is the barrel's alone: the legs hang square under it.
    const roll = p.roll;
    p.roll = 0;
    const wt = weightsOf(s, p, a), hold = holdsOf(s, p, a);
    let b = quadBones(spec, p);
    // Walking or running, each hoof where its track puts it along the ground, as far forward of its hip as that is.
    const going = !act && a.go > 0, along = going ? track(a) : null;
    const hipY = (i: number): number => place(b[`${LEG_KEYS[i]}0`], [0, 0, 0])[1];
    const ahead = (i: number): number => (along ? along[i] - hipY(i) : legReach(legOf(i), p, p.legs[i][0], p.legs[i][1])[0]);
    // How high the body is carried: where its pose says, but no higher than its hooves bearing weight reach the ground from.
    const meant = standing() + p.lift - dipOf(s, a);
    const reach = Math.min(...[0, 1, 2, 3].map((i) => ceiling(b, p, i, ahead(i)) + SLACK * s.legs * (1 - hold[i])));
    const low = Math.max(...[0, 1, 2, 3].map((i) => floor(b, p, i, ahead(i), !!act) - SLACK * s.legs * (1 - hold[i])));
    const H = Math.min(Math.max(meant, low), reach - 0.005);
    b = lifted(b, H - b.body.t[2]);
    // Every leg bent to put its hoof where it should be, each hoof in the air carried level rather than curled toe down
    // through the ground (its curl, as `quadBones` gives it, taken back out against the leg as it is now bent). Twice:
    // bending one leg does not move another, but levelling a hoof moves its own sole.
    const clear = clearance(s, a), foot0 = [...p.foot];
    const level = (): void => {
      for (let i = 0; i < 4; i++) {
        const off = p.legs[i][2];
        if (off <= 0) continue;
        const L = legOf(i), rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75], [sw, fold] = p.legs[i];
        const flat = -(p.pitch + rest[0] + sw + rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40)));
        p.foot[i] = foot0[i] + clamp(off * 3) * (35 * fold + 0.6 * flat);
      }
      b = quadBones(spec, p);
      b = lifted(b, H - b.body.t[2]);
    };
    for (let pass = 0; pass < 2; pass++) {
      level();
      for (let i = 0; i < 4; i++) {
        const h = lowOf(spec, b, [i]), off = p.legs[i][2];
        // In a move, a raised hoof where the move puts it, but never under the ground: the two eased into each other, so it
        // leaves the ground as the move lifts it rather than being let go of all at once.
        const soft = 0.1 * s.legs;
        const free = busy(s, a, i) ? 0.15 * s.legs * scrapeOf(act!.t).up : act ? (h + Math.sqrt(h * h + soft * soft)) / 2 : clear * Math.sin(Math.PI * off);
        const want = act ? (1 - hold[i]) * free : free;
        const L = legOf(i), depth = legReach(L, p, p.legs[i][0], p.legs[i][1])[1] + (h - want);
        if (along) {
          [p.legs[i][0], p.legs[i][1]] = legTo(L, p, ahead(i), depth);
          continue;
        }
        if (Math.abs(h - want) < 1e-6) continue;
        plant(L, p, i, depth);
      }
    }
    level();
    b.shadow = shadowOf(b.body, Math.max(0, H - standing()));
    PIG_FEET.weight = wt;
    PIG_FEET.off = p.legs.map((l) => l[2]);
    const d = surge(s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // The weight rolled from side to side as it stands and walks, onto whichever fore hoof is down, and on the Harvestusk a
    // rock fore and aft: the barrel and what is on it turned over the legs, so the hooves stay where they are.
    let tip = 0, side = roll;
    if (a.go > 0) {
      const g = smooth(a.go), w = frac(a.u);
      tip += s.stage === 2 ? g * 1.4 * Math.sin(w * TAU * 2 + 0.5) : 0;
      side += g * s.gait.roll * Math.sin(w * TAU + 0.4);
    }
    if (act?.kind === 'strike') side += strikeRoll(s, act.t);
    // Plowing, its barrel rocked from side to side behind each push.
    if (act?.kind === 'work') side += 5 * workOf(act.t, a.graze).down * Math.sin(act.t * TAU * 2);
    if (tip || side) b.trunk = joint(b.trunk, [0, 0, 0], tip, side, 0);
    // Rooting, its head reached forward along its neck down to the soil (`fit`); the neck drawn out with it (`pigBuild`).
    const r = reachNow(s, a);
    if (r > 0) {
      const N = b.neck.m, along: V3 = [N[2] * r, N[5] * r, N[8] * r];
      for (const k of ['head', 'jaw', 'ear0', 'ear1']) if (b[k]) b[k] = { m: b[k].m, t: add(b[k].t, along) };
    }
    // The front of the mane and the collar go with the neck: its bone is the neck's, turned back to the body's carriage.
    b.ruff = joint(b.neck, [0, 0, 0], spec.neck.lean);
    // The bell hangs straight down from the collar at the throat, swinging.
    // Let down to the ground as the head goes down, it is laid back along it rather than going into it: swung back by as far
    // as it must be to clear the ground, and its own swing kept behind that, as the ground stops it swinging forward.
    const [free, sway] = bellSwing(s, a);
    const hook = place(b.neck, col.bell), long = s.bell * 1.1 * Math.cos(sway * DEG), room = 0.03 + s.bell * 0.55;
    // How far it is swung back to clear the ground, eased in from nothing as the hook comes down to where it would touch
    // (an angle straight from the depth starts off infinitely fast).
    const deep = 1 - (hook[2] - room - 0.1 * long) / long, eased = deep < 0 ? 0 : deep < 0.2 ? (deep * deep) / 0.4 : deep - 0.1;
    const need = Math.min(88, Math.acos(clamp(1 - eased, -1, 1)) / DEG);
    // (Eased in by how far it would go into the ground, not by the angle, which starts off too fast.)
    const fore = lerp(free, -need - Math.sqrt(free * free + 4), smooth(deep / 0.2 + 1));
    b.bell = { m: hanging(fore, sway), t: hook };
    return b;
  };
}

/* ---- leaves, flowers and wheat ------------------------------------------------------------ */

/**
 * A thin flat thing along a line of points -- a leaf, a petal, a tuft of fur -- `widths` across it (half-widths) at each, its
 * face turned along `face`, its edges lifted by `fold` of its width so it is a shallow V down its middle: the half to its
 * left in `mats[0]` and to its right in `mats[1]`, so the fold reads as a rib, and its underside in `mats[2]`.
 */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: mats[j] });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: mats[2] });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** The colours a leaf or a tuft comes in: green, a paler spring green, cream fur, or the green ribbon; each a top in two halves and an underside. */
type Tone = 'green' | 'spring' | 'fur' | 'ribbon';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = {
  green: ['leaf', 'stem', 'leafDark'], spring: ['moss', 'shellDark', 'shell'], fur: ['belly', 'muzzle', 'muzzle'], ribbon: ['cloth', 'clothDark', 'clothDark'],
};
/** Which of the two greens a leaf is: mostly the deep one, now and then the spring green of a young leaf. */
const toneOf = (i: number, spring = 0.3): Tone => (jitter(i * 3 + 1) < spring ? 'spring' : 'green');

/** A leaf: a pointed oval along a gentle arch from `root` in the way `dir` goes, `len` long and `w` across, its face turned along `face`. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, tone: Tone, arch = 0.14, sharp = 0.8): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.015, w * Math.sin(Math.PI * (k / (K - 1)) ** sharp) ** 0.9));
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, TONES[tone]);
}

/** A tuft of fur: a narrow pointed lock from `root` down the way `dir` goes, hanging in a curve, cream. */
const tuft = (root: V3, dir: V3, face: V3, len: number, K: number): Mesh => leaf(root, dir, face, len, len * 0.36, K, 'fur', 0.16, 0.9);

/**
 * A small five-petalled flower at `c`, facing along `n`, `r` across: white petals round a yellow middle, each petal a sheet
 * with its colour painted on both faces always lit, so a flower turned from the light is still white.
 */
function flower(c: V3, n: V3, r: number, spin = 0): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const paints: Disc[] = [];
  const petals = Array.from({ length: 5 }, (_, q) => {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = (k: number, lift: number): V3 => add(add(c, scale(d, r * k)), scale(z, r * lift));
    for (const sd of [1, -1]) paints.push(disc(add(at(0.55, 0.11), scale(z, sd * 0.012)), scale(z, sd), r * 0.36, r * 0.3, 7, 'petal', { up: cross(z, d), lit: true }));
    return sheet([at(0.12, 0.05), at(0.55, 0.12), at(0.95, 0.08)], [r * 0.2, r * 0.42, r * 0.2], z, 0.12, ['petal', 'petal', 'petal']);
  });
  for (const sd of [1, -1]) paints.push(disc(add(c, scale(z, sd * r * 0.16)), scale(z, sd), r * 0.26, r * 0.26, 7, 'bloom', { lit: true }));
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.14)), z, [r * 0.27, r * 0.27, r * 0.14], 6, 3, 'bloom'), paint(paints));
}

/**
 * An ear of wheat: a golden stalk from `root` the way `dir` goes, `len` long, bending a little over, and on its upper half a
 * plump head of grain -- a golden spindle with its kernels in four rows down it, light and dark in turn.
 */
function wheatEar(root: V3, dir: V3, len: number, lod: number, id: number): Mesh {
  const d = unit(dir);
  let x = cross(d, [0, 0, 1]);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(x, d);
  // Bent over a little toward its own side, as a ripe ear is.
  const nod = scale(y, -0.12 * len), mid = add(add(root, scale(d, len * 0.45)), scale(nod, 0.3));
  const top = add(add(root, scale(d, len)), nod);
  const stalk = tube([root, mid], len * 0.022, len * 0.022, 3, 'crystalDark', { seam: 'start' });
  const hd = unit(sub(top, mid)), hl = Math.hypot(...sub(top, mid));
  const core = orbAlong(add(mid, scale(hd, hl * 0.5)), hd, [len * 0.06, len * 0.06, hl * 0.52], 5, 3, 'crystal');
  const kernels: Mesh[] = [];
  const rows = lod ? 5 : 3;
  for (let k = 0; k < rows; k++) {
    const at = add(mid, scale(hd, hl * (0.12 + 0.72 * (k / (rows - 1))))), kl = len * 0.13 * (1 - 0.35 * (k / rows));
    for (const [ax, sd] of [[x, 1], [x, -1], [y, 1], [y, -1]] as Array<[V3, number]>) {
      if (!lod && ax === y) continue;
      const kd = unit(add(scale(hd, 0.75), scale(ax, sd * 0.66)));
      kernels.push(sheet([at, add(at, scale(kd, kl * 0.55)), add(at, scale(kd, kl))], [0.012, kl * 0.32, 0.01], ax === x ? y : x, 0.3,
        (k + id + (sd > 0 ? 0 : 1)) % 2 ? ['crystal', 'ember', 'crystalDark'] : ['ember', 'crystal', 'crystalDark']));
    }
  }
  return merge(stalk, core, ...kernels);
}

/** One leaf, flower or ear of wheat of a piece of them: its mesh, where it is rooted, the way it lifts when it rustles, and whether it is a flower, which pops as it evolves. */
interface Frond { mesh: Mesh; root: V3; out: V3; bloom?: boolean; len?: number }
/** A mesh of them with, for each corner, how far out along its own it is, which way it lifts, where it is rooted and the middle of its flower. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[]; root: V3[]; mid: Array<V3 | null> }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [], root: V3[] = [], mid: Array<V3 | null> = [];
  for (const p of parts) {
    const c = p.bloom ? scale(p.mesh.v.reduce((t, q) => add(t, q), [0, 0, 0] as V3), 1 / p.mesh.v.length) : null;
    const L = p.len ?? Math.max(1e-3, ...p.mesh.v.map((q) => Math.hypot(...sub(q, p.root))));
    for (const q of p.mesh.v) {
      w.push(p.bloom ? 0.5 : clamp(Math.hypot(...sub(q, p.root)) / L));
      out.push(p.out);
      root.push(p.root);
      mid.push(c);
    }
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out, root, mid };
}

/**
 * How far the leaves are lifted off the body this moment, as a share of their length, how far they are thrown up, and how
 * far grown they are: bristling as it gathers to strike, at each shove of its plowing and as it evolves, bouncing and
 * swaying as it goes, stirring now and then as it stands; and as it evolves grown in from little more than half their size,
 * overshooting at the turn and settling.
 */
function rustle(s: Pig, a: Anim, phase: number): { lift: number; bounce: number; grow: number } {
  let lift = 0.03 * beat(a.t, [4.6, 13.9, 21.2], 1.2) * (1 - a.go), grow = 1;
  let bounce = a.go > 0 ? smooth(a.go) * (s.gait.bob + 0.05 * a.gait + 0.03 * s.stage) * Math.sin(frac(a.u) * TAU * 2 - 1.2 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    lift += 0.2 * k.gather + 0.12 * k.thrust;
    bounce += 0.08 * k.settle;
  } else if (act?.kind === 'work') {
    const w = workOf(act.t, a.graze);
    lift += w.down * (0.04 + 0.12 * w.shove);
    bounce += w.down * 0.05 * Math.sin(act.t * TAU * 4 - phase);
  } else if (act?.kind === 'evolve') {
    lift += 0.22 * hump(act.t, 0.5, 0.25);
    bounce += 0.05 * hump(act.t, 0.55, 0.12) * Math.sin(act.t * 70 - phase);
    grow = 0.55 + 0.45 * ramp(act.t, 0.04, 0.5) + 0.12 * hump(act.t, 0.54, 0.08);
  }
  return { lift, bounce, grow };
}

/** A piece of leaves that rustles (`rustle`): every corner moved by as far out along its own as it is; its flowers popping open as it evolves. */
function rustling(s: Pig, f: Fronds, len: number, phase: number, grows = true): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const r = rustle(s, a, phase), grow = grows ? r.grow : 1;
    const pop = a.act?.kind === 'evolve' ? 0.6 * hump(a.act.t, 0.55, 0.14) : 0;
    if (!r.lift && !r.bounce && !pop && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len, c = f.mid[i], R = f.root[i];
      let q: V3 = grow === 1 ? p : add(R, scale(sub(p, R), grow));
      if (c && pop) {
        const cc = grow === 1 ? c : add(R, scale(sub(c, R), grow));
        q = add(cc, scale(sub(q, cc), 1 + pop));
      }
      return [q[0] + f.out[i][0] * r.lift * k, q[1] + f.out[i][1] * r.lift * k, q[2] + f.out[i][2] * r.lift * k + r.bounce * k];
    });
  };
}

/* ---- the mane ------------------------------------------------------------------------------ */

/**
 * Where a point on a ring round the neck is, in the frame at the neck's root carried as the body is (the `ruff` bone): `t`
 * up the neck from its root, `th` round it from its right side (up positive, the throat straight down), and the way out.
 */
function onNeck(s: Pig, t: number, th: number, r = s.neck.w * 0.95): { p: V3; n: V3 } {
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  const n = add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th)));
  return { p: add(scale(A, t), scale(n, r)), n };
}

/** How far up the neck from its root each row of the mane round it is: the first just behind the head, the last at the root. */
const rowT = (s: Pig, r: number): number => s.neck.len * (s.stage === 2 ? 0.55 : 0.8) * (1 - r / s.ruff.length);

/**
 * The leaves round its neck, in rows from just behind the head back toward the shoulders, each a ring standing out from the
 * neck and swept back; longer and standing up over the nape the wilder it is. None at the throat, where its bell and the
 * fur of its chest are, and none under it.
 */
function ruffLeaves(s: Pig, K: number): Frond[] {
  const out: Frond[] = [];
  // Swept toward the tail and a little up, whatever the neck's carriage: along the neck, on a neck carried nearly upright, is down the chest.
  const back = unit([0, -1, 0.3]);
  s.ruff.forEach(([count, L, swept], r) => {
    const sweep = swept * DEG;
    for (let q = 0; q < count; q++) {
      const id = r * 37 + q;
      const th = ((q + (r % 2) * 0.5) / count) * TAU + 0.25 * (jitter(id) - 0.5);
      // Round the throat: a gap there, a little narrower on the Pigroot, whose garland goes round its front.
      const gap = 0.55;
      if (Math.abs(frac((th + Math.PI / 2) / TAU + 0.5) - 0.5) * TAU < gap) continue;
      // On the older ones a mane, over the nape and down the sides of the neck only: none hanging over the chest.
      if (s.stage && Math.sin(th) < (s.stage === 2 ? 0.45 : -0.2)) continue;
      const { p, n } = onNeck(s, rowT(s, r), th);
      const nape = Math.max(0, Math.sin(th)) * s.wild;
      const below = Math.max(0, -Math.sin(th));
      const len = L * (0.82 + 0.3 * jitter(id + 7)) * (1 - 0.35 * below) * (1 + 0.7 * nape) * (s.stage ? 0.75 + 0.25 * Math.max(0, Math.sin(th)) : 1);
      const round = scale(unit(cross(n, back)), q % 2 ? 1 : -1);
      const dir = unit(add(add(add(add(scale(n, Math.cos(sweep)), scale(back, Math.sin(sweep))), [0, 0, nape * 1.2]), [0, 0, -s.hang * Math.abs(Math.cos(th))]), scale(round, 0.3 * jitter(id + 2))));
      const face = add(add(scale(n, Math.sin(sweep)), scale(back, -Math.cos(sweep))), scale(round, 0.6));
      const root = add(p, scale(n, 0.02 - 0.04 * r));
      out.push({ mesh: leaf(root, dir, face, len, len * 0.44, K, toneOf(id), 0.18), root, out: unit(face) });
    }
  });
  return out;
}

/** The wheat and flowers in the mane over its neck: ears of wheat standing up out of the nape, fanned, and flowers down each side. */
function maneExtras(s: Pig, K: number, lod: number): Frond[] {
  const out: Frond[] = [];
  const rows = s.ruff.length, L = s.ruff[rows - 1][1];
  // Of the stage's ears of wheat, half in the mane over its neck; the rest go along its back (`backLeaves`).
  const n = Math.ceil(s.wheat / 2);
  for (let q = 0; q < n; q++) {
    const f = n > 1 ? q / (n - 1) - 0.5 : 0, id = 800 + q;
    const r = q % rows, th = Math.PI / 2 + f * 1.5 + 0.1 * (jitter(id) - 0.5);
    const { p, n: nn } = onNeck(s, rowT(s, r), th);
    const dir = unit(add(scale(nn, 0.8), [0, 0, 0.9]));
    const len = L * (1.25 + 0.3 * jitter(id + 1)) * (1 - 0.25 * Math.abs(f));
    const back = unit(add(dir, [0, -0.55 - 0.3 * jitter(id + 2), 0]));
    out.push({ mesh: wheatEar(p, back, len, lod, id), root: p, out: nn, len });
  }
  for (let q = 0; q < s.flowers && s.stage; q++) {
    const sd = q % 2 ? 1 : -1, r = Math.min(rows - 1, Math.floor(q / 2));
    const th = (sd > 0 ? 0 : Math.PI) + sd * (0.75 - 0.35 * r + 0.15 * jitter(q + 40));
    const { p, n: nn } = onNeck(s, rowT(s, r), th);
    const at = add(p, scale(nn, s.ruff[r][1] * 0.42));
    out.push({ mesh: flower(at, add(nn, [0, 0.35, 0.25]), 0.24 + 0.04 * s.stage, q * 0.9), root: p, out: nn, bloom: true });
  }
  return out;
}

/**
 * The leaves over its back, in rows from the withers to the rump, each row in layers from the ridge down the flanks: the
 * Plowhog's mantle lying back over its back like shingles, the Harvestusk's mane standing up off the ridge of its back and
 * lying over the top of its caparison. On the Harvestusk, ears of wheat standing up out of the ridge; flowers on both.
 */
function backLeaves(s: Pig, K: number, lod: number): Frond[] {
  const B = s.back, out: Frond[] = [];
  if (!B.rows) return out;
  const front = s.body.y[5] - 0.15, rear = s.body.y[1] + 0.25;
  const layers = s.stage === 2 ? 3 : 4;
  // More rows than there is room for end to end, so each overlaps the next like shingles; each leaf its own length, turned a
  // little its own way, and each row set off from the last, so from behind it is leaves and not a net.
  const rows = Math.round(B.rows * (s.stage === 2 ? 1 : 1.4));
  for (let q = 0; q < rows; q++) {
    const f = q / Math.max(1, rows - 1), y = lerp(front, rear, f);
    const len = B.len * (1 - 0.3 * f);
    for (const sd of [1, -1]) {
      for (let lay = 0; lay < layers; lay++) {
        const id = 300 + q * 11 + (sd > 0 ? 0 : 5) + lay;
        const down = ((lay + 0.5 * (q % 2)) / (layers - 0.5)) * B.down + 0.1 * (jitter(id + 9) - 0.5);
        const th0 = Math.PI / 2 - down - 0.06;
        const at = outer(s, y - lay * 0.12 + 0.12 * (jitter(id + 7) - 0.5), sd > 0 ? th0 : Math.PI - th0, 0.01);
        // The Harvestusk's stand up off the ridge, the rest lie back; lower layers hang further down the flank.
        const stand = s.stage === 2 ? 0.7 - 0.2 * lay : 0.35 - 0.05 * lay;
        const yaw = (jitter(id + 11) - 0.5) * 0.9 * sd;
        const dir = unit(add(add(scale(at.n, stand), [yaw, -1, -0.25 * lay * s.hang]), [0, 0, 0]));
        const L = len * (0.7 + 0.6 * jitter(id + 3)) * (1 - 0.1 * lay);
        out.push({ mesh: leaf(at.p, dir, at.n, L, L * 0.48, K, toneOf(id, 0.28), 0.2), root: at.p, out: at.n });
      }
    }
  }
  if (s.stage === 2) {
    // The Harvestusk's crest: leaves twice as long standing up all along the ridge of its back in a mound, tallest over its
    // shoulders -- its highest point -- and falling away to its rump, splayed out some forty degrees to either side.
    const n = 24;
    for (let q = 0; q < n; q++) {
      const f = q / (n - 1), id = 940 + q, sd = q % 2 ? 1 : -1;
      const y = lerp(s.body.y[5] - 0.05, s.body.y[1] + 0.1, f), tall = 1 - 0.7 * f ** 1.3;
      const at = outer(s, y, Math.PI / 2 + sd * (0.4 + 0.25 * jitter(id)), 0.01);
      const dir = unit(add(scale(at.n, 0.9), [sd * 1.0, -0.6 - 0.3 * f, 0.1]));
      // Tallest down the middle cut by a fifth, so the whole is a broad mound; each leaf's face turned back as well as out,
      // so seen from behind it is a spread of leaves and not a row of edges.
      const L = B.len * 1.6 * tall * (0.85 + 0.3 * jitter(id + 2));
      out.push({ mesh: leaf(at.p, dir, [sd * 0.6, -1, 0.4], L, L * 0.42, K, toneOf(id, 0.35), 0.16), root: at.p, out: at.n, len: L });
    }
  }
  // Wheat along the ridge, standing up and back, the rest of the stage's.
  const n = s.wheat - Math.ceil(s.wheat / 2);
  for (let q = 0; q < n; q++) {
    const f = (q + 0.5) / n, id = 860 + q, sd = q % 2 ? 1 : -1;
    const splay = s.stage === 2 ? 0.55 : 0.25;
    const at = outer(s, lerp(front - 0.1, rear + (s.stage === 2 ? 0.1 : 0.5), f), Math.PI / 2 + sd * (splay + 0.15 * jitter(id)), 0.01);
    const len = B.len * (s.stage === 2 ? 2.1 : 1.35) * (0.85 + 0.3 * jitter(id + 1)) * (1 - (s.stage === 2 ? 0.55 : 0.35) * f);
    out.push({ mesh: wheatEar(at.p, unit(add(add(at.n, [0, -0.55, 0.6]), [sd * splay, 0, 0])), len, lod, id), root: at.p, out: at.n, len });
  }
  // Flowers lying on the leaves, down each side.
  const nf = s.stage === 2 ? 4 : 2;
  for (let q = 0; q < nf; q++) {
    const sd = q % 2 ? 1 : -1, f = (Math.floor(q / 2) + 0.4) / Math.ceil(nf / 2);
    const th0 = Math.PI / 2 - 0.45 - 0.25 * jitter(q + 70);
    const at = outer(s, lerp(front, rear, f * 0.8), sd > 0 ? th0 : Math.PI - th0, 0.01);
    out.push({ mesh: flower(add(at.p, scale(at.n, B.len * 0.32)), add(at.n, [0, -0.1, 0.3]), 0.26 + 0.04 * s.stage, q * 1.3), root: at.p, out: at.n, bloom: true });
  }
  return out;
}

/**
 * The crown on its head: leaves standing up off the crown between its ears, fanned and swept a little back; white flowers
 * round the front of it; and on the Pigroot and the Harvestusk a sprig of golden wheat tucked into one side.
 */
function crownOf(s: Pig, K: number, lod: number): Frond[] {
  const H = s.head, C = s.crown, out: Frond[] = [];
  const crown = onHead(s, lerp(H.y[1], H.y[2], 0.4), Math.PI / 2).p;
  for (let q = 0; q < C.n; q++) {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, id = 500 + q;
    const root = add(crown, [f * H.w[1] * 0.55 * Math.min(C.spread, 1.6), -0.1 - 0.12 * Math.abs(f), -0.1]);
    const dir = unit([f * 1.25 * C.spread, -0.4 - 0.25 * jitter(id), 1]);
    const L = C.len * (1 - 0.4 * Math.abs(f) + 0.15 * jitter(id + 1));
    out.push({ mesh: leaf(root, dir, [0, 1, 0.2], L, L * 0.42, K, toneOf(id, 0.35), 0.1), root, out: [0, -0.3, 1] });
  }
  for (let q = 0; q < C.flowers; q++) {
    const sd = q % 2 ? -1 : 1, mid = q === 2;
    const at = onHead(s, lerp(H.y[1], H.y[2], mid ? 0.95 : 0.75), Math.PI / 2 - (mid ? 0 : sd * 0.42));
    out.push({ mesh: flower(add(at.p, scale(at.n, 0.07)), add(at.n, [0, 0.25, 0.55]), 0.2 + 0.04 * s.stage, q * 0.8), root: at.p, out: at.n, bloom: true });
  }
  for (let q = 0; q < C.wheat; q++) {
    const at = onHead(s, lerp(H.y[1], H.y[2], 0.35 - 0.12 * q), Math.PI / 2 - 0.45 - 0.12 * q);
    const len = C.len * (1.25 + 0.15 * q);
    out.push({ mesh: wheatEar(at.p, unit([0.55 + 0.2 * q, -0.55, 1]), len, lod, 900 + q), root: at.p, out: at.n, len });
  }
  return out;
}

/**
 * The Pigroot's garland round its neck: a ring of leaves lying back over its shoulders, white flowers in it, a green
 * ribbon tied in a bow at its front with a little round jingle bell under the knot (the bell is its own piece).
 */
function garlandOf(s: Pig, K: number): Frond[] {
  const out: Frond[] = [];
  const t = s.neck.len * 0.3;
  for (let q = 0; q < s.flowers; q++) {
    // Down each side and round toward the front, clear of the bow.
    const sd = q % 2 ? 1 : -1, k = Math.floor(q / 2);
    const th = -Math.PI / 2 + sd * (0.85 + 0.75 * k);
    const { p, n } = onNeck(s, t, th, s.neck.w * 1.08);
    out.push({ mesh: flower(add(p, scale(n, 0.06)), add(n, [0, 0.4, 0.2]), 0.21, q * 0.9), root: p, out: n, bloom: true });
  }
  return out;
}

/** The ribbon bow at the front of the garland: two loops, two tails and a knot, in the ribbon's green, square to the throat. */
function bowOf(s: Pig, n: number): Mesh {
  // On the right side of its neck, low, where it is seen side on and stays clear of the ground with its head down.
  const { p: at, n: out } = onNeck(s, s.neck.len * 0.3, -0.45, s.neck.w * 1.08 + 0.05);
  const lean = s.neck.lean * DEG, x = unit(cross(out, [0, Math.sin(lean), Math.cos(lean)])), up = unit(cross(out, x));
  const r = 0.22;
  const loops = [1, -1].map((sd) => {
    const pts = Array.from({ length: 7 }, (_, q) => {
      const a = (q / 6) * TAU;
      return add(at, add(scale(x, sd * r * (1 - Math.cos(a)) * 0.9), add(scale(up, r * 0.55 * Math.sin(a) + sd * 0.02), scale(out, 0.03 * Math.sin(a / 2)))));
    });
    return tube(pts, 0.08, 0.025, 4, (_r, j) => (j % 2 ? 'clothDark' : 'cloth'), { up: out, start: false, end: false });
  });
  const tails = [1, -1].map((sd) => leaf(add(at, scale(up, -0.02)), add(add(scale(x, sd * 0.35), scale(up, -1)), scale(out, 0.3)), out, 0.12, 0.08, 3, 'ribbon', 0.08, 0.3));
  const knot = orbAlong(add(at, scale(out, 0.02)), out, [0.09, 0.08, 0.06], n, 3, 'cloth');
  return merge(...loops, ...tails, knot);
}

/* ---- straps, cloth and what hangs from them -------------------------------------------------- */

/** How far the Harvestusk's caparison stands off its body. */
const CAP_OFF = 0.08;

/** A ribbon lying on a surface: through `pts`, each with the way out of the surface there, `w` across (half), its one face turned out. */
function band(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, mat: MatOf): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], K = pts.length;
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(d, pts[k].n));
    v.push(add(pts[k].p, scale(side, -w)), add(pts[k].p, scale(side, w)));
  }
  for (let k = 0; k < K - 1; k++) {
    f.push({ i: [2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2], m: typeof mat === 'function' ? mat(k, 0) : mat });
    want.push(unit(add(pts[k].n, pts[k + 1].n)));
  }
  return mesh(v, wound(v, f, want));
}

/** A ring of gold: a hoop `r` across, square to `n`, at `c`. */
function goldRing(c: V3, n: V3, r: number, th: number): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const pts = Array.from({ length: 9 }, (_, q) => add(c, add(scale(x, Math.cos((q / 8) * TAU) * r), scale(y, Math.sin((q / 8) * TAU) * r))));
  return tube(pts, th, th, 4, (_r, j) => (j % 2 ? 'metal' : 'metalLit'), { start: false, end: false });
}

/** A strap right round the barrel at `y` along it, lying on its outside, `w` across, and how far off it. */
function girth(s: Pig, y: number, w: number, off: number, mat: MatOf): Mesh {
  const pts = Array.from({ length: 25 }, (_, q) => outer(s, y, (q / 24) * TAU, off));
  return band(pts, w, mat);
}

/**
 * Its harness, lying on its outside: on the Plowhog a green strap round its barrel behind the shoulders with a gold ring
 * on each side; on the Harvestusk a brown leather girth over its caparison, a breast strap round the front of its chest
 * from ring to ring, and a strap back along each flank to its haunch, gold rings where they meet. Where the rings are.
 */
function harnessOf(s: Pig): { mesh: Mesh; rings: V3[] } {
  if (s.stage === 0) {
    // The satchel's strap round its middle.
    return { mesh: girth(s, s.body.y[3] + 0.05, 0.06, 0.04, (k) => (k % 2 ? 'leatherDark' : 'leather')), rings: [] };
  }
  const y = s.len * 0.42 - (s.stage === 2 ? 0.62 : 0.5), off = 0.04, w = s.stage === 2 ? 0.12 : 0.1;
  const strap: MatOf = s.stage === 2 ? (k) => (k % 2 ? 'leatherDark' : 'leather') : (k) => (k % 2 ? 'clothDark' : 'cloth');
  const th = s.stage === 2 ? 0.32 : 0.3;
  const rings = [1, -1].map((sd) => outer(s, y, sd > 0 ? th : Math.PI - th, off + 0.05));
  const parts: Mesh[] = [girth(s, y, w, off, strap)];
  for (const r of rings) parts.push(goldRing(r.p, r.n, w * 1.25, w * 0.32));
  if (s.stage === 2) {
    // The breast strap: from one ring forward along the shoulder, round the front of the chest, and back to the other.
    const fwd = Array.from({ length: 6 }, (_, q) => outer(s, lerp(y, s.body.y[5] + 0.05, q / 5), th - 0.35 * (q / 5), off));
    const round = Array.from({ length: 9 }, (_, q) => {
      const a = lerp(th - 0.35, Math.PI - th + 0.35, q / 8);
      // Round the front of the chest: on the last ring of the barrel's front, below the neck.
      const k = Math.sin(((q + 0.5) / 9) * Math.PI);
      return outer(s, s.body.y[5] + 0.05 + 0.2 * k, a - 0.35 * k * Math.cos(a), off);
    });
    const back = Array.from({ length: 6 }, (_, q) => outer(s, lerp(s.body.y[5] + 0.05, y, q / 5), Math.PI - th + 0.35 * (1 - q / 5), off));
    parts.push(band([...fwd, ...round.slice(1, -1), ...back], w * 0.85, strap));
    // A strap back along each flank from the ring to the haunch.
    for (const sd of [1, -1]) {
      const pts = Array.from({ length: 8 }, (_, q) => outer(s, lerp(y, s.body.y[1] + 0.2, q / 7), sd > 0 ? th + 0.05 * Math.sin((q / 7) * Math.PI) : Math.PI - th - 0.05 * Math.sin((q / 7) * Math.PI), off));
      parts.push(band(pts, w * 0.8, strap));
    }
  }
  return { mesh: merge(...parts), rings: rings.map((r) => r.p) };
}

/**
 * The Harvestusk's caparison: a cloth draped over its back and down both flanks from its shoulders to its rump, lying on it
 * and hanging a little below its widest, its hem cut into points. Plain green, so it reads at a glance, and a band of
 * gold along its hem and its ends; one face, out.
 */
function caparisonOf(s: Pig): Mesh {
  const y0 = s.body.y[1] + 0.2, y1 = s.len * 0.42 + 0.02, cols = 12, low = -0.42, drop = 0.3;
  const side = 9, rows = side * 2 + 1;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const at = (c: number, r: number): { p: V3; n: V3 } => {
    const y = lerp(y0, y1, c / cols);
    // r from the left hem (0) over the ridge (side) to the right hem.
    const sd = r < side ? -1 : 1, u = Math.abs(r - side) / side;
    const hang = u > 0.8 ? (u - 0.8) / 0.2 : 0;
    const th0 = lerp(Math.PI / 2, low, Math.min(u, 0.8) / 0.8);
    const q = outer(s, y, sd > 0 ? th0 : Math.PI - th0, 0);
    // The hem's points: every other column's longer.
    const dag = hang >= 1 && c % 2 === 1 ? 0.2 : 0;
    const n: V3 = hang > 0 ? unit([q.n[0], q.n[1], 0]) : q.n;
    return { p: add(q.p, [0, 0, -(drop * hang + dag)]), n };
  };
  const N: V3[] = [];
  for (let c = 0; c <= cols; c++) for (let r = 0; r < rows; r++) { const q = at(c, r); v.push(q.p); N.push(q.n); }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const A = c * rows + r, B = (c + 1) * rows + r, u = Math.max(Math.abs(r - side), Math.abs(r + 1 - side)) / side;
      const hem = u > 0.86, end = c === 0 || c === cols - 1;
      f.push({ i: [A, A + 1, B + 1, B], m: hem || end ? 'trim' : 'cloth' });
      want.push(unit(add(add(N[A], N[A + 1]), add(N[B], N[B + 1]))));
    }
  }
  return mesh(v, wound(v, f, want));
}

/**
 * The pennant on each flank of the Harvestusk: a shield of green cloth with a gold border hanging from the harness ring, a
 * golden leaf on it, lying on the caparison.
 */
function pennantOf(s: Pig, sd: number): Mesh {
  const y = s.len * 0.42 - 0.62 - 0.05, th = 0.06;
  const c = outer(s, y, sd > 0 ? th : Math.PI - th, 0.07), n = c.n;
  const up: V3 = unit(sub([0, 0, 1], scale(n, n[2]))), across = unit(cross(up, n));
  const W = 0.36, H = 0.55;
  const shape: Array<[number, number]> = [[-1, 1], [1, 1], [1, -0.2], [0, -1], [-1, -0.2]];
  const pt = (x: number, z: number, k = 1): V3 => add(c.p, add(scale(across, x * W * k), scale(up, z * H * k)));
  const v = shape.map(([x, z]) => pt(x, z));
  const back = v.map((p) => sub(p, scale(n, 0.04)));
  const verts = [...v, ...back], m = shape.length;
  const f: Face[] = [{ i: shape.map((_, q) => q), m: 'trim' }, { i: shape.map((_, q) => m + q), m: 'clothDark' }];
  const want: V3[] = [n, scale(n, -1)];
  for (let q = 0; q < m; q++) { f.push({ i: [q, (q + 1) % m, m + (q + 1) % m, m + q], m: 'trim' }); want.push(unit(sub(scale(add(v[q], v[(q + 1) % m]), 0.5), c.p))); }
  const slab = mesh(verts, wound(verts, f, want));
  // The green inside its gold border, and a golden leaf on it with its stem.
  // Wound to face out, as a disc is: the shape goes round clockwise seen from outside.
  const inner = shape.map(([x, z]) => add(pt(x, z, 0.8), scale(n, 0.012))).reverse();
  const leafAt = add(pt(0, 0.08), scale(n, 0.02));
  return merge(slab, paint([
    { v: inner, m: 'cloth' },
    disc(leafAt, n, W * 0.3, H * 0.5, 8, 'trim', { up }),
    disc(add(leafAt, scale(n, 0.004)), n, W * 0.05, H * 0.42, 4, 'clothDark', { up }),
  ]));
}

/** A string of carrots stuffed in a bag, their tops out of it: each an orange cone with a tuft of green on it. */
function carrots(top: V3, out: V3, n: number, len: number, K: number, seed: number): Mesh {
  const parts: Mesh[] = [];
  for (let q = 0; q < n; q++) {
    const f = n > 1 ? q / (n - 1) - 0.5 : 0;
    const root = add(top, [0, f * len * 0.7, -len * 0.45]);
    const dir = unit(add(add([0, f * 0.6, 1], scale(out, 0.45)), [0, 0, 0]));
    const tip = add(root, scale(dir, len));
    parts.push(tube([root, add(root, scale(dir, len * 0.5)), tip], [len * 0.2, len * 0.17, len * 0.1], [len * 0.2, len * 0.17, len * 0.1], 5, (r) => (r ? 'flame' : 'ember'), { seam: 'start' }));
    for (let l = 0; l < 3; l++) {
      const a = (l - 1) * 0.6 + 0.3 * jitter(seed + q * 3 + l);
      parts.push(leaf(tip, unit(add(dir, [Math.sin(a) * 0.8, 0, 0.2])), out, len * 0.7, len * 0.16, K, 'green', 0.15));
    }
  }
  return merge(...parts);
}

/**
 * A bag on its flank, lying against it: `y` along the barrel and `th` round it, hanging from the strap above it: a rounded
 * pouch of leather with a darker flap over its top and a gold stud, and carrots stuffed in its top.
 */
function bagOf(s: Pig, y: number, th: number, size: V3, n: number, K: number, carrot: number, seed: number, light = false): Mesh {
  const q = outer(s, y, th, 0.02), sd = Math.sign(q.n[0]) || 1;
  const [d, l, h] = size;
  const c: V3 = [q.p[0] + sd * d * 0.85, q.p[1], q.p[2] - h * 0.35];
  const pts: V3[] = [[c[0], c[1], c[2] + h * 0.5], [c[0], c[1], c[2] + h * 0.1], [c[0], c[1], c[2] - h * 0.35], [c[0] - sd * d * 0.1, c[1], c[2] - h * 0.5]];
  const body = tube(pts, [d * 0.85, d, d * 0.95, d * 0.6], [l * 0.9, l, l * 0.95, l * 0.6], n, light ? 'leatherLit' : 'leather');
  const out: V3 = [sd, 0, 0];
  const face: V3 = [c[0] + sd * d * 1.0, c[1], c[2] + h * 0.18];
  const flap = paint([
    disc(face, out, l * 0.86, h * 0.34, 8, light ? 'leather' : 'leatherDark', { up: [0, 0, 1] }),
    disc(add(face, [sd * 0.01, 0, -h * 0.2]), out, l * 0.13, l * 0.13, 6, 'metalLit', { up: [0, 0, 1], lit: true }),
  ]);
  const top: V3 = [c[0], c[1], c[2] + h * 0.5];
  return merge(body, flap, carrot ? carrots(top, out, carrot, h * 0.85, K, seed) : undefined);
}

/**
 * A bell: a gold bell on its loop, `h` tall, hanging down from the origin -- a rounded crown, a waist and a flared lip, a
 * band at its shoulder and its lip, the clapper showing under it -- or, on the Pigroot, a round jingle bell with its slot.
 */
function bellMesh(s: Pig, n: number): Mesh {
  const h = s.bell;
  const loop = goldRing([0, 0, -h * 0.08], [1, 0, 0], h * 0.12, h * 0.035);
  if (s.stage === 0) {
    const c: V3 = [0, 0, -h * 0.62];
    return merge(loop, orb(c, h * 0.46, n, 5, 'metal'), paint([
      disc(add(c, [0, h * 0.47, -h * 0.05]), [0, 1, -0.1], h * 0.3, h * 0.06, 6, 'metalDark'),
      disc(add(c, [0, -h * 0.47, -h * 0.05]), [0, -1, -0.1], h * 0.3, h * 0.06, 6, 'metalDark'),
    ]));
  }
  const prof: Array<[number, number]> = [[-0.14, 0.05], [-0.18, 0.28], [-0.3, 0.42], [-0.55, 0.46], [-0.82, 0.58], [-0.96, 0.7], [-1.0, 0.72]];
  const pts = prof.map(([z]) => [0, 0, z * h] as V3), rr = prof.map(([, r]) => r * h);
  const body = tube(pts, rr, rr, n, (ring) => (ring === 1 || ring === 5 ? 'metalDark' : ring === 0 ? 'metalLit' : 'metal'), { end: false });
  const clapper = orb([0, 0, -h * 0.98], h * 0.13, 6, 3, 'metalDark');
  // The inside of its mouth, dark, seen from under it.
  const mouth = paint([disc([0, 0, -h * 0.995], [0, 0, -1], h * 0.7, h * 0.7, n, 'metalDark')]);
  return merge(loop, body, mouth, clapper);
}

/** The collar round its neck the bell hangs from: a band round the neck at its root, green on the Plowhog, leather on the Harvestusk. */
function collarMesh(s: Pig): Mesh {
  const C = collarOf(s);
  const pts = Array.from({ length: 17 }, (_, q) => {
    const a = (q / 16) * TAU;
    return { p: [Math.cos(a) * C.rx, Math.sin(a) * C.ry, C.z] as V3, n: unit([Math.cos(a) / C.rx, Math.sin(a) / C.ry, 0]) };
  });
  const mat: MatOf = s.stage === 2 ? (k) => (k % 2 ? 'leatherDark' : 'leather') : (k) => (k % 2 ? 'clothDark' : 'cloth');
  return merge(band(pts, 0.07 + 0.03 * s.stage, mat), goldRing([0, C.ry + 0.01, C.z - 0.02], [0, 1, 0], 0.06 + 0.03 * s.stage, 0.025 + 0.008 * s.stage));
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.025)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  const n = pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3);
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/**
 * The eyes, open or shut, set on the sides of the head where it narrows into the muzzle: each round and warm brown with a
 * dark middle and a glint, a soft lid line over it; on the older ones a lid of fur come a little down over the top, slanting
 * in toward the snout, so it looks out fierce and kind at once. All of an eye goes out of sight together when the skull or
 * the muzzle is between it and the viewer, so the far one is hidden round the head rather than painted over it.
 */
function eyesOf(s: Pig, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onHead(s, E.y, E.up), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.12, 0.05])), p = add(q.p, scale(n, 0.01)), at = add(p, scale(n, 0.03));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size;
    if (shut) {
      out.push(disc(add(p, scale(up, -r * 0.15)), n, r * 1.08, r * 0.3, 8, 'lid', o));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.16)), n, r * 1.12, r * 1.08, 10, 'lid', o));
    out.push(disc(p, n, r, r, 12, 'bark', o));
    out.push(disc(add(p, scale(n, 0.005)), n, r * 0.54, r * 0.57, 10, 'eye', o));
    if (E.lid) out.push(disc(add(add(p, scale(n, 0.008)), scale(up, r * (1.4 - E.lid * 1.2))), n, r * 1.3, r * 0.72, 10, 'coat', { ...o, spin: -side * 0.35 }));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, r * (E.lid ? 0.12 : 0.34))), scale(across, side * r * 0.3)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }));
    if (!s.stage) out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, -r * 0.36)), scale(across, -side * r * 0.32)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }));
  }
  return paint(out);
}

/**
 * Its tusks, out of the lower jaw on each side of the snout and curving out and up: on the Pigroot short ivory nubs, on the
 * Plowhog a curve up to the top of its snout, on the Harvestusk great sweeps up and out past it. Ivory, stained with earth
 * at the root and in streaks up the outside.
 */
/** The line of its right tusk, in the head's frame, root to point (`tusksOf`). */
function tuskLine(s: Pig): V3[] {
  const H = s.head, last = H.y.length - 1, sn = last - 2;
  const r = H.w[sn], ys = H.y[sn], zs = H.z[sn], h = H.h[sn], T = s.tusk;
  if (T < 0.5) {
    const at: V3 = [r * 0.9, ys - 0.26, zs - h * 0.5];
    return curve(at, add(at, [0.07, 0.03, 0.08]), add(at, [0.11, 0.06, 0.18]), 3);
  }
  // Its root set up the side of the jaw by half its own thickness, so a heavy tusk does not hang below the jaw.
  const L = 0.3 + 0.48 * T, out = Math.min(0.55, 0.42 + 0.06 * T), thick = Math.min(0.3, 0.06 + 0.22 * L);
  const root: V3 = [r * 0.9, ys - 0.22, zs - h * 0.5 + 0.5 * thick];
  // Its tip no higher than the brow, however long it is -- above that a long tusk reads as a horn, from behind most of all --
  // the length it would have gone up in put into going out and forward instead.
  const brow = H.z[3] + H.h[3] * 0.4, k = Math.min(1, (brow - root[2]) / (L * 0.55)), more = 1 + 0.6 * (1 - k);
  // A long one's point turned out and a little down at the end, a tusk's hook rather than a horn's.
  const hook = T >= 2 ? 0.1 * L : 0;
  return cubic(root, add(root, [L * out * 0.55 * more, L * 0.42 * more, -L * 0.12 * k]), add(root, [L * out * 1.2 * more, L * 0.6 * more, L * 0.25 * k]), add(root, [L * out * 1.25 * more + hook, L * 0.75 * more, L * 0.55 * k - hook]), 7);
}

/** How thick a tusk is at each point of its line (`tuskLine`), from its root to its tip. */
function tuskWidths(s: Pig): number[] {
  const L = 0.3 + 0.48 * s.tusk;
  return tuskLine(s).map((_, q) => lerp(Math.min(0.3, 0.06 + 0.22 * L), 0.02, (q / 7) ** 1.9));
}

function tusksOf(s: Pig, n: number): Mesh {
  const T = s.tusk;
  return merge(...[1, -1].map((sd) => {
    // The right one's line (`tuskLine`), or its mirror: seen from the front, out from the jaw and up; seen side on, forward
    // from the jaw and up in a crescent, the point turned back a little. Under a half, a nub: a short fat ivory point out of
    // the jaw at the corner of the mouth, tipped up and out.
    const pts = tuskLine(s).map((q) => [sd * q[0], q[1], q[2]] as V3);
    if (T < 0.5) return tube(pts, [0.085, 0.08, 0.05, 0.014], [0.085, 0.08, 0.05, 0.014], 6, (ring) => (ring ? 'tooth' : 'hornDark'), { seam: 'start' });
    const rr = tuskWidths(s);
    // Earth on it: all round its root, and up its outside in streaks, less toward the point.
    return tube(pts, rr, rr, 7, (ring, j) => {
      // Earth caked round its root, and a smudge or two up its outside, each its own: no bands.
      const outward = Math.cos(((j + 1) / 7) * TAU) * sd > 0.3;
      return ring <= 1 || (ring === 2 && j % 3 !== 1) || (ring < 5 && outward && jitter(ring * 7 + j + (sd > 0 ? 0 : 50)) < 0.32) ? 'hornDark' : 'tooth';
    }, { seam: 'start' });
  }));
}

/**
 * The head: a boar's wedge, built as rings from the back of the skull to the snout (`Pig.head`), tan above and cream over
 * the cheeks, jaw and underside of the muzzle; full jowls low at the back of it, a chin under the muzzle, a ridge over each
 * eye on the older ones, the snout's flat pink end with its nostrils; a smile back along each side, open on the Pigroot,
 * with a rosy blush on each of its cheeks; and its tusks.
 */
function headOf(s: Pig, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, snout = last - 2;
  // The Pigroot's pink from a ring further back, so its short snout reads pink from the side too; the mouth stays at `snout`.
  const pinkFrom = s.stage ? snout : snout - 1;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    if (ring >= pinkFrom) return 'nose';
    const up = Math.sin(((j + 1) / n) * TAU);
    return up > H.cream[Math.min(ring, H.cream.length - 1)] ? 'coat' : 'muzzle';
  });
  const tip = noseOf(s);
  const end: V3 = [0, tip[1] + 0.012, tip[2]], er = H.w[last], eh = H.h[last];
  const disk = paint([
    disc(end, [0, 1, 0], er * 0.95, eh * 0.95, 12, 'pad'),
    disc(add(end, [0, 0.004, 0]), [0, 1, 0], er * 0.8, eh * 0.8, 12, 'nose'),
    ...[1, -1].map((sd) => disc(add(end, [sd * er * 0.36, 0.01, 0]), [0, 1, 0], er * 0.15, eh * 0.3, 6, 'pad')),
  ]);
  const jowls = merge(...[1, -1].map((sd) => orb([sd * H.w[2] * H.jowl, H.y[2] + 0.04, H.z[2] - H.h[2] * 0.38], [H.w[2] * 0.56, (H.y[3] - H.y[1]) * 0.42, H.h[2] * 0.52], n, k, 'muzzle')));
  const chin = orb([0, lerp(H.y[4], H.y[5], 0.5), H.z[5] - H.h[5] * 0.7], [H.w[5] * 0.62, (H.y[6] - H.y[4]) * 0.45, H.h[5] * H.chin], n, k, 'muzzle');
  const E = s.eye;
  const brows = E.brow > 0 && merge(...[1, -1].map((sd) => {
    const q0 = onHead(s, E.y - E.size * 0.2, E.up + E.size * 3), q = sd > 0 ? q0 : left(q0);
    return orbAlong(sub(q.p, scale(q.n, E.size * (1.05 - 0.45 * E.brow))), [0, 1, -0.45], [E.size * 1.1, E.size * 1.0, E.size * 2], 7, 4, 'coat');
  }));
  // The smile: from low on the side of the muzzle near the snout back to the corner of the mouth under the cheek, turned up.
  const mouthLine = paint([1, -1].map((sd) => line(Array.from({ length: 6 }, (_, q) => {
    const f = q / 5, y = lerp(H.y[snout] - 0.04, lerp(H.y[4], H.y[5], 0.2), f), th = -0.6 + 0.08 * f + 0.24 * f ** 3;
    const at = onHead(s, y, th);
    return sd > 0 ? at : left(at);
  }), H.w[2] * (s.stage ? 0.03 : 0.04), 'lid')));
  // The Pigroot's mouth open in its smile: a soft pink under the snout, and a rosy blush on each cheek.
  const happy = s.stage === 0 && paint([
    ...[1, -1].map((sd) => {
      const q0 = onHead(s, H.y[snout] - 0.1, -0.68), q = sd > 0 ? q0 : left(q0);
      return disc(add(q.p, scale(q.n, 0.02)), q.n, 0.085, 0.05, 7, 'tongue', { at: sub(q.p, scale(q.n, 0.05)) });
    }),
    ...[1, -1].map((sd) => {
      const q0 = onHead(s, lerp(H.y[2], H.y[3], 0.6), -0.12), q = sd > 0 ? q0 : left(q0);
      return disc(add(q.p, scale(q.n, 0.02)), q.n, H.w[2] * 0.2, H.h[2] * 0.12, 8, 'inner', { at: sub(q.p, scale(q.n, 0.05)) });
    }),
  ]);
  // A darker streak of fur down the middle of the brow, and a few flecks on the crown, on the older ones.
  const flecks: Disc[] = [];
  if (s.stage) {
    for (let q = 0; q < 6; q++) {
      const at = onHead(s, lerp(H.y[0], H.y[3], jitter(q + 80)), Math.PI / 2 + (jitter(q + 90) - 0.5) * 1.2);
      flecks.push(disc(add(at.p, scale(at.n, 0.015)), at.n, H.w[2] * 0.07, H.w[2] * 0.05, 5, q % 2 ? 'coatLight' : 'coatDark', { spin: q }));
    }
  }
  return merge(skull, jowls, chin, brows, tusksOf(s, n), disk, mouthLine, happy, paint(flecks), eyesOf(s, shut));
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Pig): Egg[] {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[7]) / 2, H.z[5]], r: [H.w[5] * 0.85, (H.y[7] - H.y[4]) / 2, H.h[5] * 0.85] },
  ];
}

/** A pointed ear, big and soft, built upright facing forward and cupped so its lining looks forward and out: tan outside with a darker tip, pink inside. */
function earOf(len: number, w: number, n: number): Mesh {
  const line0 = curve([0, 0, 0], [0, -0.06, len * 0.5], [0, 0.06, len], 5);
  const ws = [w * 0.62, w * 0.95, w, w * 0.78, w * 0.42, 0.02];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.4 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.03, x * 0.22)), n, (ring) => (ring >= 4 ? 'coatDark' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, ws[q] * 0.24 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.1]), ...side(-1), cup([0, 0.03, len * 0.93]), ...side(1).reverse()];
  const vein = [[-0.025, 0.04, len * 0.16], [-0.02, 0.05, len * 0.7], [0.02, 0.05, len * 0.7], [0.025, 0.04, len * 0.16]] as V3[];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }, { v: vein, m: 'nose' }]));
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A curve through four points (a cubic Bézier), in `n` steps. */
function cubic(a: V3, b: V3, c: V3, d: V3, n: number): V3[] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n, u = 1 - t;
    return add(add(scale(a, u * u * u), scale(b, 3 * u * u * t)), add(scale(c, 3 * u * t * t), scale(d, t * t * t)));
  });
}

/** A cloven hoof: two dark toes side by side with a cleft between them, each a squat wedge longer forward than it is wide. */
function cloven(r: number, h: number, n: number): Mesh {
  // Its sole flat on the ground: the rim of the last ring, tipped with the toe, cut off level with it rather than dipping under.
  const m = merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.2, -h * 0.5], [sd * r * 0.48, r * 0.28, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.62, r * 0.74, r * 0.8], n, 'hoof', { seam: 'start' })));
  return mesh(m.v.map((p) => [p[0], p[1], Math.max(p[2], -h)] as V3), m.f);
}

/**
 * Shaggy cream fur round the lower leg: a skirt of it from the knee, flaring as it hangs and cut into locks round its hem, the
 * locks longer behind than in front, stopping short of the fetlock so the hoof shows under it. Solid, so it reads as fur
 * round the leg and not as flakes beside it; in the lower leg's frame, `w` the leg's width at the knee.
 */
function legFur(s: Pig, lower: number, w: number, n: number, seed: number): Mesh {
  // Twelve locks round the leg, each hanging straight down it to its own point, with a notch between each and the next:
  // twenty-four points round, the even ones the locks' middles and the odd ones the notches, so no edge runs on a slant
  // from one lock's tip to the next lock's like a wrapped bandage.
  const L = 12, N = 2 * L, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  // Each lock its own length, from half again as short to half again as long, longer behind than in front, and never down
  // to the hoof.
  const tip = (j: number): number => {
    const th = (j / L) * TAU, behind = 0.5 - 0.5 * Math.sin(th);
    const base = 0.42 + (s.fur * (0.2 + 0.45 * behind)) / lower * 1.4;
    return Math.min(0.68, 0.36 + (base - 0.36) * (0.5 + jitter(seed + j * 3)));
  };
  const hem = (q: number): number => (q % 2 ? 0.36 + 0.4 * (Math.min(tip((q - 1) / 2), tip(((q + 1) / 2) % L)) - 0.36) : tip(q / 2));
  const ring = (q: number, at: number, k: number): V3 => {
    const th = (q / N) * TAU;
    return [Math.cos(th) * w * k * (1 - 0.25 * at), Math.sin(th) * w * k * (1 - 0.25 * at), -lower * at];
  };
  // Three rows down to where the locks part, then each drawn in over two more to its point.
  const rows: Array<(q: number) => V3> = [
    (q) => ring(q, 0.02, 1.0), (q) => ring(q, 0.2, 1.08), (q) => ring(q, 0.36, 1.14),
    (q) => ring(q, lerp(0.36, hem(q), 0.55), q % 2 ? 1.1 : 1.16), (q) => ring(q, hem(q), q % 2 ? 1.08 : 1.1),
  ];
  for (const row of rows) for (let q = 0; q < N; q++) v.push(row(q));
  for (let r = 0; r < rows.length - 1; r++) {
    for (let q = 0; q < N; q++) {
      const q2 = (q + 1) % N, A = r * N;
      // The coat's own colour at the top, as the leg's, and one cream below: no band between them, nor stripes down it.
      f.push({ i: [A + q, A + q2, A + N + q2, A + N + q], m: r < 2 ? 'coat' : 'belly', soft: r === 0 || undefined });
      const th = ((q + 0.5) / N) * TAU;
      want.push([Math.cos(th), Math.sin(th), 0.2]);
    }
  }
  return mesh(v, wound(v, f, want));
}

/**
 * Shaggy cream fur on its chest: a few long locks hanging off the front of the chest between the fore legs, lying on it and
 * swept back under it, longest in the middle. The cream they hang from is the chest's own (`pigBuild`).
 */
function chestFur(s: Pig, K: number): Mesh {
  const B = s.body, locks: Mesh[] = [];
  const count = 5;
  for (let q = 0; q < count; q++) {
    const f = q / (count - 1) - 0.5, id = 600 + q;
    const th = -Math.PI / 2 + f * 1.6;
    const at = outer(s, B.y[5] + 0.08, th, -0.02);
    const len = s.fur * (2.1 + 0.5 * jitter(id)) * (1 - 0.45 * Math.abs(f)) * (Math.abs(f) < 0.3 ? 0.6 : 1);
    locks.push(tuft(at.p, unit(add(scale(at.n, 0.25), [f * 0.3, -0.3, -1])), at.n, len, K));
  }
  return merge(...locks);
}

/** Its fur: flecks lighter and darker than the coat over the flanks and the haunches, and a darker line down its spine on the older ones. */
function furMarks(s: Pig): Mesh {
  const out: Disc[] = [];
  // None on the Pigroot: smooth as a piglet.
  const count = [0, 14, 16][s.stage];
  for (const sd of [1, -1]) {
    for (let q = 0; q < count; q++) {
      const id = q * 3 + (sd > 0 ? 0 : 100);
      const y = lerp(s.body.y[1], s.body.y[5], jitter(id));
      const th = -0.15 + 1.0 * jitter(id + 1);
      const { p, n } = onRings(s.body, y, sd > 0 ? th : Math.PI - th);
      const r = s.len * (0.02 + 0.016 * jitter(id + 2));
      out.push(disc(add(p, scale(n, 0.025)), n, r * 1.6, r * 0.6, 5, q % 2 ? 'coatLight' : 'coatDark', { spin: 0.3 + jitter(id + 3) * 0.6 }));
    }
  }
  return paint(out);
}

/** The ham over each hind leg and the shoulder over each fore leg, part of the barrel (`solidsOf`). */
function quartersOf(s: Pig, n: number, k: number): Mesh {
  return merge(...solidsOf(s).map((e) => orb(e.c, e.r, n, k, 'coat')));
}

/** Rings `R` resampled to `count` on a Catmull-Rom curve through them: the same body, smoothly round between its rings. */
function smoothRings(R: Rings, count: number): Rings {
  const N = R.y.length;
  const at = (a: readonly number[], t: number): number => {
    const i = Math.min(N - 2, Math.floor(t)), f = t - i;
    const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(N - 1, i + 2)];
    return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f ** 3);
  };
  const ts = Array.from({ length: count }, (_, q) => (q / (count - 1)) * (N - 1));
  return { y: ts.map((t) => at(R.y, t)), z: ts.map((t) => at(R.z, t)), w: ts.map((t) => at(R.w, t)), h: ts.map((t) => at(R.h, t)) };
}

/** A lower leg's mesh recoloured: its lower part cream, as a pig's legs pale toward the hoof. */
function creamFoot(m: Mesh, from: number): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const z = f.i.reduce((t, i) => t + m.v[i][2], 0) / f.i.length;
    return z < from ? { ...f, m: 'belly' } : f;
  }));
}

/** A stage's pieces: a pig's body (`quadPieces`) with its own head, and its ears, hooves, crown, mane, fur, harness, bags and bell. */
function pigBuild(s: Pig, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), K = lod ? 6 : 3;
  const skull = headSolids(s)[0];
  const B = s.body;
  // Twelve round at every fineness, the Pigroot sixteen: fewer, and a round piglet is a box.
  const nb = Math.max(s.stage ? 12 : 16, n);
  // The Pigroot's rings drawn on a smooth curve through its own, twice as many, so its top and flanks are round, not runs of
  // flat panels between a few rings.
  const R = s.stage ? B : smoothRings(B, 13);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb,
    (ring, j) => ((ring > 0 && ring < R.y.length - 1 && under(nb, j, s.belly)) || (s.fur && ring >= R.y.length - 3 && under(nb, j, 1.7)) ? 'belly' : 'coat'));
  // The Pigroot's lower legs thickening to the hoof, a piglet's stout trotters, so they show under its round belly.
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = (fore ? 0.5 : 0.54) * s.legs, w = s.thick;
    return { upper: [fore ? 0.3 : 0.05, -L, w * (fore ? 1.9 : 1.5), w * 1.05], lower: s.stage ? [0, -L * 0.95, w, w * 0.72] : [0, -L * 0.95, w * 0.88, w * 0.92], foot: cloven(w * (s.stage ? 0.82 : 0.95), s.hoof, n) };
  };
  const crown = fronds(crownOf(s, K, lod));
  const tuftLeaves = s.tail.tuft ? fronds(Array.from({ length: 6 }, (_, q): Frond => {
    const f = q / 5 - 0.5;
    const dir = unit([f * 2.2, -1, 0.35 + 0.4 * (0.5 - Math.abs(f))]);
    return { mesh: leaf([0, -0.04, 0], dir, [0, 0.2, 1], s.tail.tuft * (1 - 0.35 * Math.abs(f)), s.tail.tuft * 0.4, K, q === 2 ? 'spring' : 'green', 0.15), root: [0, -0.04, 0], out: [0, 0, 1] };
  })) : undefined;
  // The Pigroot's a pink corkscrew: a thin round tail wound a turn and a half about its length, all on its first link (the
  // others left empty), so it is a curl seen from any side.
  const tw = (q: number): number => 0.085 - 0.014 * q + 0.01 * s.stage;
  const tailLinks = s.stage
    ? [0, 1, 2].map((q) => tube(curve([0, 0.03, 0], [0, -s.tail.len * 0.5, 0.02], [0, -s.tail.len * 1.05, 0], 2), tw(q), tw(q), 5, 'coat', { seam: 'start' }))
    : [corkscrew(s.tail.len * 1.7, 0.08, 1.5, 0.045, 0.028), mesh([], []), mesh([], [])];
  if (tuftLeaves) tailLinks[2] = merge(tailLinks[2], moved(tuftLeaves.mesh, [0, -s.tail.len, 0]));
  const extras: Piece[] = [
    { key: 'crown', mesh: crown.mesh, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [skull], thin: true, bent: rustling(s, crown, s.crown.len, 0.3) },
  ];
  // Round the neck: the Pigroot's garland and bow, or the leaves of the mane; the collar the bell hangs from.
  const ruff = fronds([...ruffLeaves(s, K), ...(s.stage ? maneExtras(s, K, lod) : garlandOf(s, K))]);
  extras.push({ key: 'ruff', mesh: ruff.mesh, bone: 'ruff', bias: 0.16, after: ['neck', 'body', 'collar', 'chestFur', 'harness', 'caparison'], thin: true, bent: rustling(s, ruff, s.ruff[0][1], 0) });
  if (s.stage === 0) extras.push({ key: 'bow', mesh: bowOf(s, n), bone: 'ruff', bias: 0.18, after: ['neck', 'body', 'ruff'], front: [0, 1, -0.3] });
  else extras.push({ key: 'collar', mesh: collarMesh(s), bone: 'neck', bias: 0.05, after: ['neck', 'body', 'chestFur'], thin: true });
  extras.push({ key: 'bell', mesh: bellMesh(s, n), bone: 'bell', bias: 0.2, after: ['neck', 'body', 'collar', 'bow', 'ruff', 'chestFur', 'head'], front: [0, 1, 0], sheen: 'metalLit' });
  if (s.fur) extras.push({ key: 'chestFur', mesh: chestFur(s, K), bone: 'trunk', bias: 0.12, after: ['body', 'neck', 'fl0', 'fr0'], front: [0, 1, 0], thin: true });
  if (s.stage === 2) extras.push({ key: 'caparison', mesh: caparisonOf(s), bone: 'trunk', bias: 0.05, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0', 'fl1', 'fr1', 'hl1', 'hr1'], thin: true });
  const harness = harnessOf(s);
  extras.push({ key: 'harness', mesh: harness.mesh, bone: 'trunk', bias: 0.07, after: ['body', 'caparison', 'fl0', 'fr0', 'hl0', 'hr0'], thin: true });
  if (s.back.rows) {
    const mane = fronds(backLeaves(s, K, lod));
    extras.push({ key: 'mane', mesh: mane.mesh, bone: 'trunk', bias: 0.12, after: ['body', 'caparison', 'harness', 'bags0', 'bags1'], thin: true, bent: rustling(s, mane, s.back.len, 0.6) });
  }
  // What hangs on each flank: the Pigroot's satchel on its right; the Plowhog's pouches and the Harvestusk's saddlebags, and its pennants.
  const bagY = s.stage === 2 ? -0.35 : s.stage === 1 ? -0.05 : s.body.y[3] + 0.05;
  for (const [q, sd] of [[0, 1], [1, -1]] as Array<[number, number]>) {
    if (s.stage === 0 && sd < 0) continue;
    const th = s.stage === 0 ? -0.08 : 0.12;
    const size: V3 = s.stage === 0 ? [0.14, 0.24, 0.26] : s.stage === 1 ? [0.17, 0.3, 0.3] : [0.24, 0.44, 0.44];
    const bag = bagOf(s, bagY, sd > 0 ? th : Math.PI - th, size, n, K, s.stage ? 3 : 0, 40 + q * 7, s.stage === 0);
    extras.push({ key: `bags${q}`, mesh: bag, bone: 'trunk', bias: 0.09, after: ['body', 'caparison', 'harness', 'fl0', 'fr0', 'hl0', 'hr0', 'fl1', 'fr1', 'hl1', 'hr1'], front: [sd, 0, 0] });
    if (s.stage === 2) extras.push({ key: `pennant${q}`, mesh: pennantOf(s, sd), bone: 'trunk', bias: 0.1, after: ['body', 'caparison', 'harness', 'fl0', 'fr0', 'fl1', 'fr1'], front: [sd, 0, 0] });
  }
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.92, len: s.neck.len },
    // The head is its own (`headOf`): this egg is only where it stands for the ears to go behind.
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: -45,
    tail: tailLinks,
    fore: legs(true),
    hind: legs(false),
    breath: 0.03,
    extras,
  });
  // Shaggy cream fur round each lower leg, over the leg and drawn with it.
  if (s.fur) {
    for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
      const lower = (fore ? 0.5 : 0.54) * s.legs;
      pieces.push({ key: `${key}fur`, mesh: legFur(s, lower, s.thick, n, key.charCodeAt(0) * 7 + key.charCodeAt(1)), bone: `${key}1`, bias: 0.025, after: [`${key}1`, `${key}2`, 'body', 'caparison'], front: [side * 0.7, fore ? 0.7 : -0.7, 0] });
    }
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(barrel, s.stage ? quartersOf(s, n, k) : quartersOf(s, Math.max(12, n), 8), furMarks(s)) };
    // The neck drawn out along itself as the head reaches forward down to the soil (`fit`), so the head stays on it.
    if (pc.key === 'neck') return { ...pc, bent: (v: readonly V3[], a: Anim) => { const r = reachNow(s, a); return r > 0 ? v.map((q) => (q[2] > 0 ? [q[0], q[1], q[2] * (1 + r / s.neck.len)] as V3 : q)) : (v as V3[]); } };
    if (/^[fh][lr]1$/.test(pc.key)) return { ...pc, mesh: creamFoot(pc.mesh, -(pc.key[0] === 'f' ? 0.5 : 0.54) * s.legs * (s.stage ? 0.35 : 0.68)) };
    return pc;
  });
}

/**
 * A corkscrew tail: a tube `r0` thick tapering to `r1`, wound `turns` times round a line `len` long going back from its root,
 * the winding growing from nothing at the root to `wide` across.
 */
function corkscrew(len: number, wide: number, turns: number, r0: number, r1: number): Mesh {
  const N = 16, pts: V3[] = [], rr: number[] = [];
  for (let q = 0; q <= N; q++) {
    const f = q / N, a = f * turns * TAU, R = wide * smooth(f * 3);
    pts.push([R * Math.sin(a), 0.03 - len * f, R * (1 - Math.cos(a)) + 0.04 * f]);
    rr.push(lerp(r0, r1, f));
  }
  return tube(pts, rr, rr, 6, 'inner', { seam: 'start' });
}

/** A mesh moved by `by`. */
function moved(m: Mesh, by: V3): Mesh {
  return mesh(m.v.map((p) => add(p, by)), m.f);
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [112, 168, 82];
const LEAF_SPRING: RGB = [176, 204, 104];
const PETAL: RGB = [253, 250, 242];
const WHEAT: RGB = [236, 188, 74];
const CHAFF: RGB = [246, 214, 128];
const SOIL: RGB = [96, 66, 46];
const LOAM: RGB = [150, 110, 76];
const RIM: RGB = [196, 160, 118];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** A leaf in the air, `len` long, turned `ang`: two-tone down its middle, a soft edge in a darker shade, its rib only when big enough to be more than a smudge. */
function flyingLeaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const t = g.getTransform(), px = len * Math.hypot(t.a, t.b);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.36, -len / 2, 0);
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = len * 0.06;
  g.strokeStyle = css(mix(c, [30, 46, 24], 0.35), al);
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 255, 230], 0.2), al);
  g.fill();
  if (px > 9) {
    g.beginPath();
    g.moveTo(-len * 0.4, 0);
    g.lineTo(len * 0.4, 0);
    g.stroke();
  }
  g.restore();
}

/** A white petal in the air: a small oval with a warm edge. */
function flyingPetal(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  if (al <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
  g.fillStyle = css(PETAL, al * 0.9);
  g.fill();
  g.lineWidth = r * 0.18;
  g.strokeStyle = css([214, 180, 120], al * 0.7);
  g.stroke();
  g.restore();
}

/** An ear of wheat in the air, `len` long, turned `ang`: a golden spindle with its kernels marked across it in chevrons and a stub of stalk. */
function flyingWheat(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, al: number): void {
  if (al <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.ellipse(len * 0.1, 0, len * 0.4, len * 0.13, 0, 0, TAU);
  g.fillStyle = css(WHEAT, al);
  g.fill();
  g.lineWidth = len * 0.05;
  g.strokeStyle = css([150, 104, 34], al);
  g.stroke();
  g.beginPath();
  for (let q = 0; q < 4; q++) {
    const cx = -len * 0.18 + q * len * 0.16;
    g.moveTo(cx, -len * 0.11);
    g.lineTo(cx + len * 0.07, 0);
    g.lineTo(cx, len * 0.11);
  }
  g.moveTo(-len * 0.3, 0);
  g.lineTo(-len * 0.5, 0);
  g.stroke();
  g.restore();
}

/** A fleck of chaff: a tiny golden sliver, half see-through. */
function chaff(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  if (al <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(CHAFF, al);
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.35, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** A clod of earth in the air: a lumpy pebble with a pale rim, so it is seen against fur and grass alike. */
function clod(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number, c: RGB = SOIL, rim = true): void {
  if (al <= 0.01) return;
  g.beginPath();
  for (let q = 0; q < 6; q++) {
    const t = ang + (q / 6) * TAU, k = r * (0.8 + 0.25 * Math.sin(q * 2.3 + ang));
    if (q) g.lineTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
    else g.moveTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  if (!rim) return;
  g.lineWidth = r * 0.25;
  g.strokeStyle = css(RIM, al * 0.85);
  g.stroke();
}

/** A soft puff of dust on the ground at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, at);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([186, 156, 120], al));
  grad.addColorStop(0.6, css([186, 156, 120], al * 0.5));
  grad.addColorStop(1, css([186, 156, 120], 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.58, 0, 0, TAU);
  g.fill();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Plowhog's: less than in proportion on the small one, so they still read. */
const bigness = (s: Pig): number => 0.4 + 0.6 * (s.len / 2.6);
/** How tall it stands, over the top of its mane, for throwing what it throws high enough to be seen over it from behind. */
const tallOf = (s: Pig): number => s.legs + s.body.h[4] * 2 + (s.stage === 2 ? 1.1 : s.stage === 1 ? 0.5 : 0.2);

/** The tip of its snout, and the ground under it, in the world. */
const snoutAt = (s: Pig, b: Bones): V3 => place(b.head, add(noseOf(s), [0, 0.04, -s.head.h[s.head.h.length - 1] * 0.5]));

/** Where the blow lands, in the head's frame: the Pigroot's forehead, the others' snout where their tusks rise beside it. */
function blowAt(s: Pig): V3 {
  const H = s.head, last = H.y.length - 1;
  if (s.stage === 0) return [0, lerp(H.y[3], H.y[4], 0.5), H.z[3] + H.h[3] * 0.85];
  return [0, H.y[last] - 0.15, H.z[last] + H.h[last] * (0.6 + 0.4 * s.stage)];
}

/** Lines of force out from where a blow lands: short white strokes radiating, drawn in over a moment and gone. */
function impact(g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, al: number, seed: number): void {
  if (al <= 0.01) return;
  g.save();
  g.lineCap = 'round';
  for (let q = 0; q < 7; q++) {
    const a = (q / 7) * TAU + jitter(seed + q) * 0.5, r0 = r * (0.35 + 0.5 * k), r1 = r * (0.7 + 0.6 * k) * (0.8 + 0.4 * jitter(seed + q + 9));
    for (const [w, c] of [[0.22, 'rgba(120,80,40,'], [0.12, 'rgba(255,250,236,']] as Array<[number, string]>) {
      g.strokeStyle = `${c}${clamp(al).toFixed(3)})`;
      g.lineWidth = r * w * (1 - 0.5 * k);
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8);
      g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.8);
      g.stroke();
    }
  }
  g.restore();
}

/**
 * The strike: where the blow lands -- the Pigroot's forehead, the others' tusks -- a burst of dust and earth, with lines of
 * force out from it; leaves (and on the Harvestusk, wheat) torn out of its crown and mane, flying up and out and coming down;
 * and on the Harvestusk, where its fore hooves stamp down, a cloud of dust bursting up off the ground, a ring of it going
 * out over the ground, clods thrown up and the turf cracked. Each thing is drawn in front of the body or behind it, as it is;
 * what flies the viewer's way is thrown higher, so seen from behind it clears the mane, and seen from behind, where the head
 * is hidden by the body, the blow's burst is drawn up over the head.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Pig, b: Bones, at: Bones, t: number, front: boolean): void {
  const big = bigness(s), S = PIG_STRIKE, mid = b.body.t;
  // The scrape of the Harvestusk's fore hoof as it gathers itself.
  if (s.stage === 2) {
    const kick = hump(t, SCRAPE * 0.75, SCRAPE * 0.35);
    if (kick > 0 && front) {
      const foot = place(b.fr2, [0, -0.2, -s.hoof]);
      dust(g, view, [foot[0], foot[1] - 0.3 * (1 - kick), 0.1], (0.9 + 1.6 * (t / SCRAPE)) * big, 0.55 * kick);
    }
  }
  const since = (t - S.hit) * ACT_SECS.strike;
  if (since < -0.02) return;
  const fade = 1 - ramp(t, 0.76, 1);
  // The blow: a burst of dust and earth where it lands, and lines of force out of it.
  const fwd = unit(sub(place(at.body, [0, 1, 0]), at.body.t));
  const away = dot(fwd, view.T) < -0.3;
  let P = place(at.head, blowAt(s));
  if (away) {
    // Hidden beyond the body: over the top of its head instead.
    const top = place(at.head, [0, s.head.y[2], s.head.z[2] + s.head.h[2]]);
    P = [P[0], P[1], Math.max(P[2], top[2]) + 0.35 * big];
  }
  if (front && since > -0.02) {
    const k = ramp(since, -0.02, 0.2), al = 1 - ramp(since, 0.12, 0.3);
    const [x, y] = onScreen(view, P);
    dust(g, view, [P[0], P[1], P[2] - 0.3 * big], (0.7 + 0.35 * s.stage + 1.6 * k) * big, 0.75 * al);
    impact(g, x, y, (1.2 + 0.4 * s.stage) * big, k, al, 11 + s.stage);
  }
  // Earth and bits flung out of the blow.
  if (since > 0 && since < 0.5) {
    const fl = 1 - smooth((since - 0.2) / 0.3), count = 7 + 3 * s.stage;
    for (let c = 0; c < count; c++) {
      const id = 200 + c + 17 * s.stage;
      const th = (c / count) * TAU + jitter(id) * 0.6;
      const v: V3 = [Math.cos(th) * (2 + 1.6 * jitter(id + 1)), Math.sin(th) * (2 + 1.6 * jitter(id + 2)) + 1.2 * fwd[1], 2.6 + 2.2 * jitter(id + 3)];
      if (dot(v, view.T) > 0) v[2] += 1.5;
      const p = thrown(P, scale(v, 0.85 + 0.15 * s.stage), since, 10);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const r = (0.2 + 0.14 * jitter(id + 4)) * big;
      clod(g, x, y, r, id + since * 7, fl, c % 2 ? SOIL : LOAM, r < 0.2 * big);
    }
  }
  if (s.stage === 2 && since >= 0) {
    // The stamp: dust bursting up round its fore hooves, a ring of it going out over the ground, the turf cracked, clods thrown.
    const hit: V3 = scale(add(place(at.fl2, [0, 0.1, -s.hoof]), place(at.fr2, [0, 0.1, -s.hoof])), 0.5);
    hit[2] = 0.04;
    const [gx, gy] = onScreen(view, hit);
    if (!front) {
      const out = ramp(since, 0, 0.32), rx = big * (1.4 + 3.2 * out);
      g.lineWidth = 0.2 * big * (1 - out);
      g.strokeStyle = css([232, 210, 172], 0.85 * (1 - out));
      g.beginPath();
      g.ellipse(gx, gy, rx, rx * 0.45, 0, 0, TAU);
      g.stroke();
      const al = 1 - ramp(since, 0.2, 0.32);
      g.save();
      g.strokeStyle = css([66, 44, 32], 0.85 * al);
      g.lineWidth = 0.15 * big;
      g.lineCap = 'round';
      for (let c = 0; c < 8; c++) {
        const th = (c / 8) * TAU + jitter(c + 50) * 0.6, L = (0.9 + 0.8 * jitter(c + 51)) * big * ramp(since, 0, 0.05);
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + Math.cos(th) * L * 0.5 + 0.1 * big, gy + Math.sin(th) * L * 0.28);
        g.lineTo(gx + Math.cos(th) * L, gy + Math.sin(th) * L * 0.52);
        g.stroke();
      }
      g.restore();
    }
    const cloud = 1 - ramp(since, 0.1, 0.38);
    for (let c = 0; c < 6; c++) {
      const th = (c / 6) * TAU + 0.4;
      const at2: V3 = [hit[0] + Math.cos(th) * big * (0.6 + 1.6 * ramp(since, 0, 0.3)), hit[1] + Math.sin(th) * big * (0.5 + 1.2 * ramp(since, 0, 0.3)), 0.2 + 0.6 * big * ramp(since, 0, 0.25)];
      if (nearSide(at2, mid, view) === front) dust(g, view, at2, (0.9 + 1.4 * ramp(since, 0, 0.3)) * big, 0.6 * cloud);
    }
    if (since < 0.55) {
      const fl = 1 - smooth((since - 0.25) / 0.3);
      for (let c = 0; c < 10; c++) {
        const id = 260 + c, th = (c / 10) * TAU + jitter(id) * 0.5;
        const v: V3 = [Math.cos(th) * (2 + 1.5 * jitter(id + 1)), Math.sin(th) * (2 + 1.5 * jitter(id + 2)), 3 + 2.5 * jitter(id + 3)];
        if (dot(v, view.T) > 0) v[2] += 2;
        const p = thrown(hit, v, since, 10);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        const r = (0.24 + 0.16 * jitter(id + 4)) * big;
        clod(g, x, y, r, id + since * 7, fl, c % 2 ? SOIL : LOAM, r < 0.2 * big);
      }
    }
  }
  if (since < 0) return;
  // Leaves torn out of its crown and mane, flying up and out and tumbling down; petals and, on the Harvestusk, wheat with them.
  const head = place(at.head, [0, s.head.y[1], s.head.z[1] + s.head.h[1]]);
  const nape = place(at.ruff, onNeck(s, s.neck.len * 0.5, Math.PI / 2, s.neck.w + s.ruff[0][1] * 0.5).p);
  const count = 10 + 5 * s.stage;
  for (let q = 0; q < count; q++) {
    const from = q % 2 ? head : nape;
    const th = (q / count) * TAU + jitter(q) * 0.6;
    const speed = 2.6 + 2.2 * jitter(q + 9);
    const v: V3 = [Math.cos(th) * speed, Math.sin(th) * speed * 0.8 - 0.4, 3.4 + 2.6 * jitter(q + 2)];
    if (dot(v, view.T) > 0) v[2] += 1.5 + 0.8 * s.stage;
    const p = thrown(from, v, since, 6);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const spin = q * 1.7 + since * (6 + 6 * jitter(q + 5)) * (q % 2 ? 1 : -1);
    if (q % 4 === 3) flyingPetal(g, x, y, 0.26 * big, spin, fade);
    else if (s.stage === 2 && q % 4 === 1) flyingWheat(g, x, y, 1.0 * big, spin, fade);
    else flyingLeaf(g, x, y, 1.1 * big, spin, jitter(q * 3 + 1) < 0.3 ? LEAF_SPRING : LEAF, fade);
  }
}

/** Where its snout is in the soil as it goes in and at the end of its push, and where it noses the seed in: on the ground. */
interface Furrow { from: V3; to: V3; poke: V3 }

/**
 * Plowing: a furrow of turned earth on the ground running back from its snout, growing as it pushes on through the soil, a
 * ridge of pale soil thrown up along each side of it; a spray of earth off its snout all the while it pushes, and at each
 * shove clods thrown up and out to either side and a low puff of dust; then where it noses the seed in, a seed on the soil
 * pushed under, and a sprout popping up out of it with two leaves, and a few flecks of wheat chaff. Seen from behind, where
 * its head is hidden by its body, the earth is thrown higher and a puff of dust and chaff goes up over its head. A go played
 * once throws nothing until its snout is in.
 */
function plowSpray(g: CanvasRenderingContext2D, view: View, s: Pig, b: Bones, fur: Furrow, a: Anim, t: number, front: boolean): void {
  const W = PIG_WORK, w = workOf(t, a.graze), big = bigness(s) * 1.1, mid = b.body.t;
  const seam = a.graze >= 0.5;
  const fwd = unit(sub(place(b.body, [0, 1, 0]), b.body.t)), flat = unit([fwd[0], fwd[1], 0]);
  const away = dot(fwd, view.T) < -0.3;
  // The head's outline on the screen, near enough: earth still going up is not drawn over it, so none is pasted on the face.
  const H = s.head, hc = place(b.head, [0, lerp(H.y[2], H.y[H.y.length - 1], 0.4), H.z[2]]);
  const [hx, hy] = onScreen(view, hc), [ox, oy] = onScreen(view, add(hc, [0, 0, H.h[2]])), hr = Math.hypot(ox - hx, oy - hy);
  const onFace = (x: number, y: number, rising: boolean): boolean => front && rising && !away && Math.hypot(x - hx, (y - hy) * 1.1) < hr * 1.15;
  // How much of the furrow is drawn: growing as the snout pushes on, all of it after; gone as the next go begins.
  const grown = ramp(t, W.bite, W.plow);
  const there = seam ? Math.max(w.down * (0.35 + 0.65 * grown), 1 - ramp(t, 0.04, 0.14)) * (1 - ramp(t, 0.94, 1) * 0.65) : w.down * grown;
  const tip: V3 = [lerp(fur.from[0], fur.to[0], grown), lerp(fur.from[1], fur.to[1], grown), 0.02];
  const long = (0.7 + 1.5 * (seam ? Math.max(grown, 1 - ramp(t, 0.04, 0.14)) : grown)) * big;
  const tail: V3 = [tip[0] - flat[0] * long, tip[1] - flat[1] * long, 0.02];
  if (!front && there > 0.01) {
    const [x0, y0] = onScreen(view, tail), [x1, y1] = onScreen(view, tip);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const wd = 0.5 * big;
    g.save();
    g.lineCap = 'round';
    for (const sd of [1, -1]) {
      g.strokeStyle = css(RIM, 0.95 * there);
      g.lineWidth = wd * 0.6;
      g.beginPath();
      g.moveTo(x0 + nx * wd * 0.72 * sd, y0 + ny * wd * 0.72 * sd);
      g.lineTo(x1 + nx * wd * 0.6 * sd, y1 + ny * wd * 0.6 * sd);
      g.stroke();
    }
    g.strokeStyle = css(SOIL, 0.95 * there);
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.restore();
    for (let q = 0; q < 5; q++) {
      const f = (q + 0.5) / 5, sd = q % 2 ? 1 : -1;
      const at: V3 = [lerp(tail[0], tip[0], f) - flat[1] * sd * 0.42 * big, lerp(tail[1], tip[1], f) + flat[0] * sd * 0.42 * big, 0.02];
      const [x, y] = onScreen(view, at);
      clod(g, x, y, 0.2 * big, q * 2.1, there, q % 2 ? LOAM : SOIL);
    }
  }
  // A spray of earth off its snout all the while it pushes on: small clods thrown forward and out to either side from just
  // ahead of the snout, as a plow throws its soil, each coming in over its first thirtieth of a second.
  const pushing = (seam || t > W.bite) && w.down > 0.5;
  if (pushing) {
    for (let q = 0; q < 12; q++) {
      const id = 700 + q, t0 = W.bite + (q / 12) * (W.plow - W.bite);
      const since = (t - t0) * ACT_SECS.work;
      if (since < 0 || since > 0.42) continue;
      const sd = q % 2 ? 1 : -1, side: V3 = [-flat[1] * sd, flat[0] * sd, 0];
      const v: V3 = add(add(scale(side, 1.4 + 1.2 * jitter(id)), scale(flat, 1.2 + 0.8 * jitter(id + 3))), [0, 0, 2.2 + 1.2 * jitter(id + 1) + (away ? 3 : 0)]);
      const at = ramp(t0, W.bite, W.plow);
      const from: V3 = [lerp(fur.from[0], fur.to[0], at) + flat[0] * 0.3 * big, lerp(fur.from[1], fur.to[1], at) + flat[1] * 0.3 * big, 0.06];
      const sv = scale(v, 0.85 + 0.2 * big), p = thrown(from, sv, since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (onFace(x, y, sv[2] - 9 * since > 0)) continue;
      const al = smooth(since / 0.03) * (1 - smooth((since - 0.25) / 0.17));
      clod(g, x, y, (away ? 0.16 : 0.1 + 0.06 * jitter(id + 2)) * big, id + since * 9, al, q % 3 ? SOIL : LOAM);
    }
  }
  // At each shove, clods thrown up and out to both sides, the near side's higher to clear the mane seen from behind.
  W.shoves.forEach((t0, k) => {
    if (t < t0 - 0.02 && !seam) return;
    const since = frac(t - t0 + 0.02) * ACT_SECS.work;
    if (since > 0.6) return;
    const fade = 1 - smooth((since - 0.32) / 0.28);
    const P = ramp(t0, W.bite, W.plow);
    const from: V3 = [lerp(fur.from[0], fur.to[0], P), lerp(fur.from[1], fur.to[1], P), 0.1];
    // Seen from behind, where the snout is hidden, more of them, thrown up well over its back: lumps of earth, tumbling, with
    // no pale rim, which on a big one reads as a tile.
    const n = away ? 32 : 12;
    for (let q = 0; q < n; q++) {
      const id = q * 5 + k * 23;
      const sd = q % 2 ? 1 : -1, side: V3 = [-flat[1] * sd, flat[0] * sd, 0];
      const v: V3 = add(add(scale(side, 2 + 1.8 * jitter(id)), scale(flat, 1.0 - 1.4 * jitter(id + 1))), [0, 0, 4 + 2.4 * jitter(id + 2)]);
      if (away) v[2] += 3.5 + 1.5 * s.stage;
      else if (dot(side, view.T) > 0) v[2] += 1.5 + s.stage;
      const sv = scale(v, 0.8 + 0.15 * big), p = thrown(from, sv, since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (onFace(x, y, sv[2] - 9 * since > 0)) continue;
      const r = (away ? 0.15 + 0.05 * jitter(id + 3) : 0.24 + 0.18 * jitter(id + 3)) * big;
      clod(g, x, y, r, id + since * (5 + 6 * jitter(id + 5)) * (q % 2 ? 1 : -1), fade * smooth(since / 0.03), q % 3 ? SOIL : LOAM, r < 0.2 * big);
    }
    if (front && (nearSide(from, mid, view) || away)) {
      const up = away ? place(b.head, [0, s.head.y[2], s.head.z[2] + s.head.h[2]]) : from;
      dust(g, view, [up[0], up[1], away ? up[2] + 0.3 * big : up[2]], (0.9 + 2.2 * since) * big, 0.45 * (1 - smooth(since / 0.5)));
    }
  });
  // Where the snout is down in the soil, the soil heaped up round its end in front of it, so it goes into the ground rather
  // than through it.
  const rim = s.head.y.map((y, q) => place(b.head, [0, y, s.head.z[q] - s.head.h[q]])).slice(3).reduce((m, p) => (p[2] < m[2] ? p : m));
  if (front && rim[2] < 0.03 && !away) {
    const deep = smooth((0.03 - rim[2]) / 0.05), [x, y] = onScreen(view, [rim[0], rim[1], 0.02]);
    const [, y1] = onScreen(view, [rim[0], rim[1], 0.02 + 0.3 * big]), rh = Math.abs(y1 - y), rw = rh * 1.3;
    g.fillStyle = css(LOAM, 0.95 * deep);
    g.beginPath();
    g.ellipse(x, y, rw, rh * 0.45, 0, Math.PI, TAU);
    g.fill();
    g.strokeStyle = css(SOIL, 0.9 * deep);
    g.lineWidth = rh * 0.12;
    g.beginPath();
    g.ellipse(x, y, rw, rh * 0.45, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    for (let q = 0; q < 4; q++) clod(g, x + (q - 1.5) * rw * 0.45, y - rh * (0.3 + 0.1 * (q % 2)), 0.1 * big, q * 1.7, deep, q % 2 ? SOIL : LOAM, false);
  }
  // The seed: on the soil before the snout as it lifts out, nosed under at the poke; then the sprout coming up out of it.
  const Pp = fur.poke;
  const seedIn = ramp(t, W.plow + 0.02, W.lift) * (1 - ramp(t, W.poke - 0.01, W.poke + 0.03));
  const sprout = ramp(t, W.poke + 0.01, W.poke + 0.08) * (1 - ramp(t, 0.93, 1));
  const pokeOn = seam || t > W.plow;
  if (pokeOn && nearSide(Pp, mid, view) === front) {
    const [x, y] = onScreen(view, Pp);
    if (seedIn > 0.01) {
      g.fillStyle = css([236, 204, 120], seedIn);
      g.strokeStyle = css([120, 84, 40], seedIn);
      g.lineWidth = 0.06 * big;
      g.beginPath();
      g.ellipse(x, y - 0.1 * big, 0.22 * big, 0.14 * big, 0.5, 0, TAU);
      g.fill();
      g.stroke();
    }
    if (sprout > 0.01) {
      // A little mound of earth, and the sprout up out of it: a stem and two leaves opening, with a bounce as it pops up.
      const pop = 1 + 0.25 * hump(t, W.poke + 0.09, 0.05);
      const hgt = 0.95 * big * sprout * pop;
      g.fillStyle = css(SOIL, sprout);
      g.beginPath();
      g.ellipse(x, y, 0.42 * big, 0.18 * big, 0, 0, TAU);
      g.fill();
      g.strokeStyle = css([58, 112, 44], sprout);
      g.lineWidth = 0.12 * big;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 0.08 * big, y - hgt * 0.5, x, y - hgt);
      g.stroke();
      const open = ramp(t, W.poke + 0.05, W.poke + 0.12);
      for (const sd of [1, -1]) flyingLeaf(g, x + sd * 0.26 * big * open, y - hgt + 0.06 * big, 0.62 * big * (0.5 + 0.5 * open), sd * (0.55 + 0.5 * open) - (sd < 0 ? Math.PI : 0), LEAF_SPRING, sprout);
    }
  }
  // Wheat chaff: golden flecks going up off it as the sprout pops, and down again, twirling; from behind, up over its head.
  if (pokeOn) {
    const since = (t - W.poke) * ACT_SECS.work;
    if (since > 0 && since < 0.5) {
      const fade = 1 - smooth((since - 0.2) / 0.3);
      for (let q = 0; q < 9; q++) {
        const v: V3 = [(jitter(q + 120) - 0.5) * 2.4, (jitter(q + 121) - 0.5) * 1.8, 3 + 1.8 * jitter(q + 122) + (away ? 3 : 0)];
        if (dot(v, view.T) > 0) v[2] += 1;
        const p = thrown(add(Pp, [0, 0, 0.1]), v, since, 7);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        chaff(g, x, y, 0.2 * big, q + since * 18, fade);
      }
    }
  }
}

/**
 * Evolving: at the start a burst of leaves, ears of wheat and petals popping out of it, which covers the moment it changes
 * into its new body; then leaves, wheat and petals going up round it in a spiral, wider at its feet and gathering in as they
 * rise; and at the turn a glint off the bell as it rings.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Pig, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  // From the first moment, thick enough to hide the change of body under it: a cloud of pale green and gold over the whole of
  // it, thinning and gone by a quarter of the way through, and leaves, wheat and petals bursting off it at full size.
  const burst = 1 - ramp(t, 0.1, 0.27), grow = 0.75 + 0.25 * ramp(t, 0, 0.05);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    if (front) {
      const cloud = 0.9 * (1 - ramp(t, 0.05, 0.24));
      for (const [y, z, r, c] of [[0, 0.8, 0.72, 0], [s.len * 0.45, 1.15, 0.5, 1], [-s.len * 0.4, 0.9, 0.5, 1], [0, 1.4, 0.45, 0], [s.len * 0.75, 1.0, 0.42, 1]] as Array<[number, number, number, number]>) {
        const at: V3 = [0, y, b.body.t[2] * z + since * 0.8], [x, yy] = onScreen(view, at), R = (s.len * r + 1.4 * since) * (0.85 + 0.15 * big);
        const grad = g.createRadialGradient(x, yy, 0, x, yy, R);
        const col: RGB = c ? [236, 230, 160] : [210, 232, 170];
        grad.addColorStop(0, css(col, cloud));
        grad.addColorStop(0.65, css(col, cloud * 0.75));
        grad.addColorStop(1, css(col, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x, yy, R, R * 0.8, 0, 0, TAU);
        g.fill();
      }
    }
    for (let q = 0; q < 44; q++) {
      const th = (q / 44) * TAU * 2.6 + jitter(q) * 0.7, el = (jitter(q + 40) - 0.3) * 1.6;
      const dir = unit([Math.cos(th), Math.sin(th) * 1.3, el]);
      // From a little off its surface, so none is a scab on it.
      const from: V3 = [dir[0] * (s.body.w[3] + 0.1), s.body.y[3] + dir[1] * (s.len * 0.5 + 0.1), b.body.t[2] + dir[2] * (s.body.h[3] + 0.1)];
      const v: V3 = [Math.cos(th) * (3 + 2.5 * jitter(q + 3)), Math.sin(th) * (3 + 2.5 * jitter(q + 5)), 2 + 3 * jitter(q + 7)];
      const p = thrown(from, v, since, 4);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 4 === 0) flyingPetal(g, x, y, 0.34 * big * grow, q + since * 6, burst);
      else if (q % 4 === 1) flyingWheat(g, x, y, 1.15 * big * grow, q * 1.3 + since * 7, burst);
      else flyingLeaf(g, x, y, 1.3 * big * grow, q * 1.3 + since * 7, q % 4 === 2 ? LEAF : LEAF_SPRING, burst);
    }
  }
  const fade = ramp(t, 0.1, 0.25) * (1 - ramp(t, 0.75, 1));
  const tall = tallOf(s) + s.head.h[2], wide = s.len * 0.8;
  for (let q = 0; q < 21; q++) {
    const rise = frac(t * 1.2 + q / 21);
    const ang = (q / 21) * TAU * 3 + t * TAU * 1.4;
    const r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r * 0.75, Math.sin(ang) * r, rise * tall];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = fade * Math.sin(rise * Math.PI);
    if (q % 3 === 0) flyingPetal(g, x, y, 0.3 * big, ang * 2, al);
    else if (q % 3 === 1) flyingWheat(g, x, y, 0.95 * big, ang * 1.5 + rise * 4, al);
    else flyingLeaf(g, x, y, 0.95 * big, ang * 1.5 + rise * 4, q % 2 ? LEAF : LEAF_SPRING, al);
  }
  // The bell ringing at the turn: a glint off it, and rings of light going out from it.
  const ring = hump(t, 0.52, 0.1);
  if (front && ring > 0 && dot(unit(sub(place(b.bell, [0, 0, 0]), mid)), view.T) > -0.2) {
    const at = place(b.bell, [0, 0, -s.bell * 0.6]), [x, y] = onScreen(view, at);
    glint(g, x, y, (0.9 + 0.5 * s.stage) * big * ring, ring);
    for (const k of [0, 1]) {
      const out = clamp((t - 0.48 - 0.06 * k) / 0.25);
      if (out <= 0 || out >= 1) continue;
      g.strokeStyle = css([255, 232, 150], 0.8 * (1 - out));
      g.lineWidth = 0.08 * big * (1 - out);
      g.beginPath();
      g.arc(x, y, (0.3 + 1.6 * out) * big, 0, TAU);
      g.stroke();
    }
  }
}

/** A glint: a small four-pointed star of light, added to what is under it. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, c: RGB = [255, 246, 214]): void {
  if (al <= 0.01 || r <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 0.9);
  halo.addColorStop(0, css(c, al * 0.6));
  halo.addColorStop(1, css(c, 0));
  g.fillStyle = halo;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = css(c, al);
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
  g.restore();
}

/** Light: a small warm flash where the blow lands; and as it evolves, a green-gold glow over it, a flash of it to cover the change at the start. */
function pigGlow(s: Pig, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act, big = bigness(s);
  if (act?.kind === 'strike') {
    const k = hump(act.t, PIG_STRIKE.hit + 0.02, 0.1);
    if (k <= 0) return [];
    // Over the head, where the blow lands, so it is seen from every side and never through the body.
    return [{ p: add(place(b.head, blowAt(s)), [0, 0, 0.5 * big]), r: 1.0 * big + 0.3, c: [255, 236, 196], a: 0.4 * k }];
  }
  if (act?.kind === 'evolve') {
    const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
    const open = 1 - ramp(act.t, 0.02, 0.09);
    if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [236, 240, 170], a: 0.55 * open });
    const k = 0.2 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.07);
    if (k > 0) out.push({ p: place(b.trunk, [0, 0, s.body.h[3] + 0.4]), r: s.len * 0.8, c: [220, 236, 150], a: k });
    const ring = hump(act.t, 0.52, 0.08);
    if (ring > 0) out.push({ p: place(b.bell, [0, 0, -s.bell * 0.6]), r: (0.6 + 0.3 * s.stage) * big, c: [255, 226, 130], a: 0.6 * ring });
    return out;
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, plows and evolves. */
function pigKind(s: Pig): Kind {
  const bones = pigBones(s);
  // Where everything is at the moment the blow lands, for what is torn off then to fly from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: PIG_STRIKE.hit } });
  // Where its snout is in the soil as it goes in, at the end of its push and as it noses the seed in, for the furrow and the sprout.
  const furrow = (a: Anim): Furrow => {
    const at = (t: number): V3 => { const p = snoutAt(s, bones({ ...a, go: 0, graze: 1, act: { kind: 'work', t } })); return [p[0], p[1], 0.02]; };
    // The seed goes in just ahead of where the snout comes down, so the sprout is seen in front of it as it lifts its head.
    const fwd = unit(sub(at(PIG_WORK.plow), at(PIG_WORK.bite + 0.04)));
    return { from: at(PIG_WORK.bite + 0.04), to: at(PIG_WORK.plow), poke: add(at(PIG_WORK.poke), scale(fwd, 0.35 * bigness(s))) };
  };
  let furrowAt: Furrow | null = null;
  return {
    bones,
    build: (lod) => pigBuild(s, lod),
    // The variant's coat is its fur and its markings the cream of its belly, face and fur; its pink, its hooves, tusks,
    // leaves, flowers, wheat, gold, cloth and leather its own, the same on every variant.
    palette: (coat, mark) => {
      // The fur painted part way from the variant's own colour to the island's chalk (`pastel`), so a dark brown is still brown.
      const fur = mix(pastel(coat, 30), coat, 0.66), cream = mix(pastel(mark, 40), mark, 0.5);
      const snout: RGB = s.stage === 0 ? [240, 150, 156] : s.stage === 1 ? [212, 132, 132] : [178, 114, 112];
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [60, 40, 34], 0.32),
        coatLight: mix(fur, [255, 244, 222], 0.3),
        belly: cream,
        muzzle: mix(cream, fur, 0.12),
        mark: cream,
        featherDark: mix(cream, [150, 120, 96], 0.3),
        inner: [240, 154, 164],
        nose: snout,
        pad: mix(snout, [90, 40, 46], 0.5),
        tongue: [214, 96, 110],
        lid: mix(fur, [40, 24, 22], 0.6),
        eye: [44, 24, 22],
        bark: [132, 78, 42],
        hoof: [70, 52, 48],
        tooth: [248, 238, 210],
        hornDark: [156, 112, 72],
        leaf: LEAF,
        stem: mix(LEAF, [70, 120, 60], 0.35),
        leafDark: [92, 140, 70],
        moss: LEAF_SPRING,
        shellDark: mix(LEAF_SPRING, [130, 168, 76], 0.4),
        shell: [196, 214, 140],
        petal: [253, 250, 242],
        bloom: [248, 204, 62],
        crystal: WHEAT,
        crystalDark: [196, 146, 52],
        ember: [250, 214, 110],
        flame: [240, 128, 44],
        metal: [230, 178, 58],
        metalLit: [255, 226, 128],
        metalDark: [168, 112, 34],
        cloth: [86, 146, 76],
        clothDark: [58, 108, 56],
        trim: [234, 186, 70],
        leather: [150, 96, 58],
        leatherDark: [112, 70, 44],
        leatherLit: [206, 156, 100],
      }, 30);
    },
    shadow: [s.len * 0.75, s.body.w[4] * 0.95],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are green and gold, its leaves' and its wheat's.
    motes: [[126, 190, 86], [246, 204, 92]],
    glow: (b, a) => pigGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') plowSpray(g, view, s, b, (furrowAt ??= furrow(a)), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PIGROOT = pigKind(PIGROOT_LOOK);
export const PLOWHOG = pigKind(PLOWHOG_LOOK);
export const HARVESTUSK = pigKind(HARVESTUSK_LOOK);
/** Each stage's description, for its voice to time itself by. */
export const PIG_STAGES: readonly Pig[] = [PIGROOT_LOOK, PLOWHOG_LOOK, HARVESTUSK_LOOK];
export type { Pig };
