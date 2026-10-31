import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The glass line: the Glimmip, a small chubby gecko, ivory on its belly and
 * flanks and mint along its back and crown, speckled peach and coral, with
 * big round dark eyes rimmed warm orange, round peach pads on its toes, and a
 * tail that curls up behind it into one iridescent glass bubble, a couple of
 * little ones beside it; which grows into the Glascade, taller and leggier,
 * standing more upright, a crest of glassy droplets down its neck and back,
 * coral scales at the root of its tail and its tail curled up into a bigger
 * glass balloon with bubbles budding off it; and then the Prismetail, tall
 * and proud, droplet frills down its neck, at its elbows and on its legs, and
 * a huge curled tail ending in a great swirled bubble ringed by smaller ones.
 * The species is `glimmip`: it melts sand from the settlement's stores into
 * glass lumps at a lit smelter.
 *
 * Each is its variant's scales on its back, crown and tail and its markings
 * the ivory of its throat, belly and flanks; the glass of its bubbles and
 * droplets, its speckles, its pads and its eyes are the same on every
 * variant. Built from a description of the stage (`Gecko`) and walked as the
 * kiln line walks (`./wild-kiln`): every foot put where it should be and its
 * leg bent to reach it, a lizard's sprawl, the diagonals together, its spine
 * waving and its tail swinging against it.
 *
 * The glass is drawn as the frog line's water is: a ball of its own colours
 * with its shine painted on, here in swirled bands of pastel pink, butter,
 * mint, sky and lilac, each a little under full so the side in the light
 * keeps its colour, a soft highlight, a bright crescent and a glint.
 *
 * At its task a small stone smelter stands in front of it: it reaches into the
 * glowing mouth and draws out a gob of molten glass on its tongue, lifts its
 * head and puffs it into a glowing bubble that cools from orange to clear,
 * the bubble on its tail swelling with it; the bubble settles into a lump, and
 * it turns and sets the glass lump down at its side (`GLASS_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Gecko {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Hip to shoulder. */
  len: number;
  /** How far out the hips and shoulders are, as a share of the barrel's width there, and how far down it, as a share of its depth. */
  hip: number;
  drop: number;
  /** Each leg: upper, lower, and the ankle's height over the sole; how thick. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far apart its feet stand, against the barrel's width at its shoulders and hips. */
  spread: number;
  /** How far up from straight out its knees and elbows point. */
  knee: number;
  /** How far ahead of its shoulder a fore foot stands, and behind its hip a hind foot, as shares of the barrel's length. */
  reachOut: [number, number];
  /** How high the middle of the barrel is carried. */
  high: number;
  /** The neck: where it comes out of the body, how long, how wide at its root and at the head, how far forward of upright, and its bow. */
  neck: { at: V3; len: number; w: [number, number]; lean: number; curve: [number, number, number] };
  /** The skull's half-sizes; the snout's (across, up, along); how far up the skull sits from the neck; the head's pitch, nose up. */
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number; tall: number };
  /** The bumps of scale along the top of its head, brow to crown: how many and how big. */
  crown: { count: number; size: number };
  /** The droplets down the back and sides of its neck: how many a side, how long the longest, and in how many rows. */
  nape: { count: number; len: number; rows: number };
  /** Along its spine: how many, the shortest and the longest, and whether glass droplets or bumps of its scales. */
  ridge: { count: number; len: [number, number]; glass: boolean };
  /** Droplet frills at each elbow and knee: how many and how long; on the hind legs only, or all four. */
  frill: { count: number; len: number; fore: boolean };
  tail: {
    at: V3;
    links: number[];
    w: number[];
    /** Lifted at the root (degrees up from straight back), and how far each link after the first is curled up past the one before. */
    lift: number; bend: number[];
    /** How many of its last links are glass: the tail turning clear and swelling out into its bubble (`glassBubbles`). */
    glass: number;
    /** How far it is carried round to its left, in degrees. */
    side?: number;
    /** How many droplets stand along the outside of its curl, from which link on, and how long the longest. */
    drops: number; from: number; dropLen: number;
  };
  /** The bubble at its tail's end: its radius, and the small ones budding off it as [round its rim from the top as seen (degrees), out from its middle against its radius, size against it]. */
  bubble: { r: number; buds: ReadonlyArray<readonly [number, number, number]> };
  /** How many speckles on its skin. */
  spots: number;
  /** The smelter it works at: its radius; the lump's radius; and the bubble it blows, as a share of its tail's. */
  smelter: { r: number; lump: number; blow: number };
  gait: {
    duty: [number, number]; swing: [number, number];
    step: number; bob: number; roll: number;
    wave: [number, number];
  };
  size: number;
}

/** A Glimmip: small, low and chubby on short splayed legs, a big round head with big eyes, its tail curled up into one glass bubble. */
const GLIMMIP_LOOK: Gecko = {
  stage: 0,
  body: { y: [-0.84, -0.7, -0.38, 0, 0.36, 0.62, 0.74], z: [0.0, -0.01, -0.01, 0.0, 0.03, 0.07, 0.1], w: [0.24, 0.45, 0.58, 0.6, 0.56, 0.44, 0.22], h: [0.15, 0.27, 0.33, 0.34, 0.32, 0.27, 0.15] },
  len: 1.0, hip: 0.72, drop: 0.5,
  fore: [0.34, 0.24, 0.07], hind: [0.36, 0.24, 0.07], thick: 0.14, spread: 1.5, knee: 1.5, reachOut: [0.1, 0.08],
  high: 0.3,
  neck: { at: [0, 0.62, 0.06], len: 0.16, w: [0.34, 0.32], lean: 60, curve: [0, 0, 0] },
  head: { r: [0.5, 0.47, 0.38], snout: [0.35, 0.2, 0.24], up: 0.1, pitch: 10 },
  eye: { dir: [0.8, 0.46, 0.4], size: 0.17, tall: 1.06 },
  crown: { count: 4, size: 0.07 },
  nape: { count: 0, len: 0, rows: 0 },
  ridge: { count: 6, len: [0.07, 0.1], glass: false },
  frill: { count: 0, len: 0, fore: false },
  tail: { at: [0, -0.8, 0.06], links: [0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12], w: [0.2, 0.175, 0.15, 0.13, 0.11, 0.095, 0.08], lift: 6, bend: [6, 14, 22, 26, 22, 14], glass: 3, side: 18, drops: 0, from: 0, dropLen: 0 },
  bubble: { r: 0.48, buds: [[-36, 1.08, 0.26], [-60, 1.12, 0.16]] },
  spots: 34,
  smelter: { r: 0.6, lump: 0.15, blow: 0.62 },
  gait: { duty: [0.62, 0.42], swing: [0.34, 0.35], step: 0.2, bob: 0.025, roll: 2.5, wave: [12, 16] },
  size: 2.6,
};

/** A Glascade: taller and leggier, standing up on straighter legs, its neck raised, a crest of droplets, its tail curled into a glass balloon. */
const GLASCADE_LOOK: Gecko = {
  stage: 1,
  body: { y: [-1.4, -1.22, -0.68, 0, 0.66, 1.06, 1.24], z: [0.02, 0.0, 0.0, 0.02, 0.07, 0.15, 0.22], w: [0.3, 0.54, 0.64, 0.66, 0.64, 0.52, 0.32], h: [0.24, 0.4, 0.47, 0.49, 0.48, 0.43, 0.28] },
  len: 1.8, hip: 0.62, drop: 0.55,
  fore: [0.66, 0.56, 0.08], hind: [0.7, 0.56, 0.08], thick: 0.17, spread: 1.1, knee: 1.15, reachOut: [0.1, 0.07],
  high: 1.12,
  neck: { at: [0, 1.0, 0.24], len: 0.5, w: [0.58, 0.46], lean: 48, curve: [0.04, 0.0, 0.06] },
  head: { r: [0.56, 0.62, 0.46], snout: [0.37, 0.25, 0.41], up: 0.08, pitch: 10 },
  eye: { dir: [0.74, 0.52, 0.44], size: 0.245, tall: 1.04 },
  crown: { count: 4, size: 0.1 },
  nape: { count: 4, len: 0.38, rows: 1 },
  ridge: { count: 7, len: [0.18, 0.3], glass: true },
  frill: { count: 2, len: 0.2, fore: false },
  tail: { at: [0, -1.36, 0.08], links: [0.27, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19, 0.18], w: [0.3, 0.27, 0.245, 0.22, 0.2, 0.18, 0.165, 0.15, 0.135, 0.12], lift: 2, bend: [-10, -6, 6, 18, 26, 28, 24, 16, 8], glass: 3, side: -30, drops: 5, from: 2, dropLen: 0.2 },
  bubble: { r: 0.92, buds: [[-30, 1.1, 0.24], [-56, 1.1, 0.15], [56, 1.08, 0.18], [82, 1.08, 0.11]] },
  spots: 54,
  smelter: { r: 0.95, lump: 0.2, blow: 0.5 },
  gait: { duty: [0.64, 0.44], swing: [0.32, 0.34], step: 0.2, bob: 0.03, roll: 2, wave: [11, 15] },
  size: 2.45,
};

/** A Prismetail: tall and proud, its neck and chest upright, droplet frills, a huge curled tail ending in a great swirled bubble ringed by smaller ones. */
const PRISMETAIL_LOOK: Gecko = {
  stage: 2,
  body: { y: [-1.9, -1.66, -0.94, 0, 0.86, 1.3, 1.5], z: [0.02, 0.0, 0.0, 0.05, 0.18, 0.36, 0.5], w: [0.5, 0.92, 1.1, 1.15, 1.15, 1.0, 0.62], h: [0.4, 0.64, 0.78, 0.85, 0.9, 0.85, 0.55] },
  len: 2.4, hip: 0.6, drop: 0.55,
  fore: [1.06, 0.9, 0.12], hind: [1.0, 0.82, 0.12], thick: 0.32, spread: 1.02, knee: 1.1, reachOut: [0.1, 0.07],
  high: 1.75,
  neck: { at: [0, 1.2, 0.56], len: 0.9, w: [1.08, 0.82], lean: 42, curve: [0.08, 0.0, 0.1] },
  head: { r: [0.88, 0.98, 0.7], snout: [0.58, 0.38, 0.64], up: 0.08, pitch: 12 },
  eye: { dir: [0.72, 0.52, 0.46], size: 0.35, tall: 1.02 },
  crown: { count: 5, size: 0.16 },
  nape: { count: 5, len: 0.62, rows: 2 },
  ridge: { count: 8, len: [0.3, 0.52], glass: true },
  frill: { count: 3, len: 0.5, fore: true },
  tail: { at: [0, -1.84, 0.1], links: [0.4, 0.39, 0.38, 0.37, 0.36, 0.35, 0.34, 0.33, 0.32, 0.31, 0.3, 0.29], w: [0.5, 0.46, 0.42, 0.39, 0.36, 0.33, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2], lift: 6, bend: [-12, -8, 0, 12, 22, 28, 26, 16, 6, -4, -8], glass: 4, side: -34, drops: 9, from: 2, dropLen: 0.46 },
  bubble: { r: 2.1, buds: [[-18, 1.1, 0.2], [-40, 1.1, 0.13], [-64, 1.08, 0.1], [28, 1.09, 0.16], [52, 1.08, 0.11], [84, 1.07, 0.13], [116, 1.06, 0.08], [-98, 1.06, 0.09]] },
  spots: 76,
  smelter: { r: 1.5, lump: 0.3, blow: 0.36 },
  gait: { duty: [0.68, 0.48], swing: [0.27, 0.31], step: 0.17, bob: 0.05, roll: 3.2, wave: [9, 12] },
  size: 1.9,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

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
/** The barrel's width, depth and height of its middle line at `y`. */
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (Math.hypot(Y[0], Y[1], Y[2]) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
/** A bone's frame from its three axes and where it is. */
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A frame's turn applied to a direction. */
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame standing upright at `t`, scaled by `g`. */
const upright = (t: V3, g = 1): Xf => ({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t });

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

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/* ---- glass ------------------------------------------------------------------------------- */

/**
 * Where a bubble reaches, for the box it is drawn in and the name over it: corners round it, `r` out each way, and no faces. The
 * bubble itself is glass, drawn by hand over or under the body (`glassBall`), where a ball of facets would be an opaque egg.
 */
function reachMesh(r: number): Mesh {
  const v: V3[] = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]];
  return mesh(v, []);
}

/** A droplet of glass: a teardrop, narrow at its root and swelling to a round bulb at its end, `len` long and `r` round at its widest, a glint on it. */
function dropMesh(root: V3, dir: V3, len: number, r: number, m: Mat, fine: boolean): Mesh {
  const D = unit(dir);
  const fs = fine ? [0, 0.22, 0.45, 0.62, 0.76, 0.88, 0.96, 1] : [0, 0.4, 0.7, 0.9, 1];
  const prof = (f: number): number => (f < 0.66 ? 0.28 + 0.72 * smooth(f / 0.66) : Math.sqrt(Math.max(0.0025, 1 - ((f - 0.66) / 0.34) ** 2)));
  const pts = fs.map((f) => add(root, scale(D, f * len)));
  const w = fs.map((f) => r * prof(f));
  const body = tube(pts, w, w, fine ? 7 : 5, (ring) => (ring >= 1 ? m : 'membrane'), { seam: 'start' });
  // Its glint: a spot of light on its bulb, up and toward the viewer's usual side.
  let up = sub([0, 0, 1], scale(D, D[2]));
  if (Math.hypot(up[0], up[1], up[2]) < 1e-3) up = [0, 1, 0];
  up = unit(up);
  const bulb = add(root, scale(D, len * 0.68));
  const glint = disc(add(bulb, scale(up, r * 0.92)), up, r * 0.26, r * 0.2, 5, 'glint', { lit: true });
  return merge(body, paint([glint]));
}

/** A tint for the `q`th droplet: mostly pink and butter, now and then mint or lilac, so a row of them shimmers. */
const dropTint = (q: number): Mat => (['bloom', 'petal', 'bloom', 'cap', 'petal', 'water'] as const)[Math.floor(jitter(q * 5 + 3) * 6)];

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Glimmip's headbutt, the Glascade's tail swipe, the Prismetail's stamp. */
export const GLASS_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** When the Prismetail's tail comes down after its stamp, as a share of the strike. */
export const PRISMETAIL_SLAM = 0.7;
/**
 * A go at its task, as shares of it: its head in the smelter's mouth; the gob of glass taken up; its head lifted and the puff
 * begun; the bubble blown; the bubble settled into a lump; and the lump set down.
 */
export const GLASS_WORK = { reach: 0.18, grab: 0.27, puff: 0.38, blown: 0.6, lump: 0.68, set: 0.84 } as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each ankle is and how its foot is pitched; and how the rest is carried. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted, swung to the left, and curled up past how it is carried. */
  tail: [number, number, number];
  jaw: number;
  /** How much the bubble on its tail is swollen past its own size. */
  swell: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  reach: number[];
}

const rests = new Map<Gecko, Rest>();
function restOf(s: Gecko): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], ankle: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    const dy = (fore ? 1 : -1) * s.reachOut[fore ? 0 : 1] * (B.y[B.y.length - 1] - B.y[0]);
    ankle.push([SIDE[i] * r.w * s.spread, y + dy, L[2]]);
    reach.push(L[0] + L[1]);
  }
  const R = { hip, ankle, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Gecko, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], jaw: 0, swell: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])], jaw: m(a.jaw, b.jaw), swell: m(a.swell, b.swell),
  };
}

/** `p` moved by as much as `to` is from `from`, every number of it. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    neck: [d(p.neck[0], to.neck[0], from.neck[0]), d(p.neck[1], to.neck[1], from.neck[1])],
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
    jaw: d(p.jaw, to.jaw, from.jaw), swell: d(p.swell, to.swell, from.swell),
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/** The diagonals together, as a lizard walks. */
const BEATS = [0, 0.5, 0.5, 0];
const EDGE = 0.12;

/**
 * Going: a gecko's sprawling walk, the diagonals together, each foot swept back under the body at the ground's own speed and
 * brought round and forward through the air; the body twisting over its feet, the tail swinging against it and its bubble
 * bobbing; the head held steady against the twist.
 */
function goingPlan(s: Gecko, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const L = R.reach[i], half = L * amp, A = R.ankle[i], ph = frac(a.u + BEATS[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.25 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const outward = 0.07 * L * Math.sin(Math.PI * u);
    p.at[i] = [A[0] + SIDE[i] * outward, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    // A gecko peels its toes up off the ground from the heel.
    p.foot[i] = (i < 2 ? -18 : -24) * Math.sin(Math.PI * u) ** 2;
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - duty * 0.15));
  p.H += s.len * (-G.bob * (1 - 0.4 * g) * down + g * (0.03 + 0.02 * Math.max(0, Math.sin(2 * TAU * (w - 0.1)))));
  const wave = waveOf(s, a);
  p.neck[1] = -wave * 0.7;
  p.head[1] = -wave * 0.3;
  p.roll = G.roll * Math.sin(TAU * w);
  // The tail held up off the ground as it goes, so its bubble rides clear, and swung against the spine.
  p.tail = [6 + g * 8, -wave * 1.1, -2 * down];
  p.neck[0] = 8 * g;
  p.head[0] = [7, 4, 2.5][s.stage] * (2 * down - 1) - 4 * g;
  p.pitch = g * (2 + 2 * Math.sin(2 * TAU * w)) + (s.stage === 2 ? -1.4 * down : 0);
  return p;
}

/** How far its spine is bent from side to side this moment, in degrees at either end of it. */
function waveOf(s: Gecko, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return -smooth(Math.min(1, a.go)) * lerp(s.gait.wave[0], s.gait.wave[1], a.gait) * Math.cos(TAU * frac(a.u));
}
const bendAt = (s: Gecko, y: number, deg: number): number => deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
function bendPt(s: Gecko, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = bendAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
}

/** How far its tongue is out this moment, nought to one: a gecko's lick of its own eye now and then as it stands. */
const tongueOf = (a: Anim): number => (a.act || a.go > 0 ? 0 : Math.max(beat(a.t, [3.1, 14.2, 20.6], 0.4)));

/**
 * Standing about: breathing, looking about, its tail swaying and its bubble bobbing on it; now and then its head tilted,
 * curious, a look back at its bubble, and a lick of its lips.
 */
function stillPlan(s: Gecko, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [2 * cyc(t, 5), 8 * look, 4 * drift(t, 2)];
  p.tail = [3 * cyc(t, 3, 1), 7 * cyc(t, 4), 4 * cyc(t, 2, 0.6)];
  p.H += 0.012 * s.len * (a.breath - 0.5);
  p.swell = 0.03 * cyc(t, 6);
  const tilt = beat(t, [8.4, 17.2], 1.8);
  p.head[2] += 18 * tilt;
  p.head[0] += 6 * tilt;
  p.neck[0] -= 4 * tilt;
  // A look back over its shoulder at its bubble, which it puffs up a little for the look.
  const over = beat(t, [12.5], 2.4);
  p.neck[1] += 30 * over;
  p.head[1] += 28 * over;
  p.tail[1] -= 10 * over;
  p.swell += 0.06 * over;
  p.jaw = 3 * tongueOf(a);
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Glimmip's headbutt: rocked back on its haunches with its head tucked, then thrown forward onto its fore feet, and back. */
function headbutt(s: Gecko, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = GLASS_HITS[0];
  const back = ramp(t, 0.04, 0.24) * (1 - ramp(t, 0.42, hit - 0.02));
  const out = ramp(t, 0.42, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.surge = s.len * (-0.1 * back + 0.18 * out);
  p.H += s.len * (0.02 * back - 0.04 * out);
  p.pitch = 10 * back - 9 * out;
  p.neck = [-10 * back + 12 * out, 0];
  p.head = [14 * back - 8 * out + 6 * jolt, 0, 0];
  p.squash = 0.06 * back + 0.08 * jolt;
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + s.len * 0.16, A[2]];
    const k = ramp(t, 0.42, hit - 0.02) * (1 - ramp(t, 0.7 + 0.06 * i, 0.94 + 0.04 * i));
    p.at[i] = t < 0.6 ? arc(A, fwd, ramp(t, 0.42, hit - 0.02), R.reach[i] * 0.25) : arc(fwd, A, 1 - k, R.reach[i] * 0.2);
  }
  p.tail = [10 * back + 6 * jolt, 0, 6 * back];
  p.swell = 0.1 * jolt;
  return p;
}

function swipeOf(t: number): number {
  const hit = GLASS_HITS[1];
  if (t < 0.22) return -0.45 * smooth(t / 0.22);
  if (t < 0.4) return -0.45;
  if (t < hit) return lerp(-0.45, 1, ((t - 0.4) / (hit - 0.4)) ** 1.4);
  return 1 - ramp(t, hit + 0.1, 1);
}
/** The Glascade's tail swipe: braced on its fore feet, its hindquarters swung round and its balloon of a tail swung across in front of it. */
function swipe(s: Gecko, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), k = swipeOf(t), hit = GLASS_HITS[1];
  const jolt = hump(t, hit + 0.02, 0.06);
  p.yaw = 26 * k;
  p.surge = s.len * 0.05 * Math.abs(k);
  p.side = s.len * 0.5 * Math.sin(26 * k * DEG);
  p.neck = [6 * Math.abs(k), -22 * k];
  p.head = [4 * jolt, -20 * k, -6 * k];
  const engage = ramp(t, 0, 0.2) * (1 - ramp(t, 0.8, 1));
  p.tail = [engage * (-10 + 6 * Math.sin(Math.PI * clamp(t / hit))), 56 * k, engage * (-6 * jolt - 6)];
  p.roll = -5 * k;
  p.squash = 0.06 * jolt;
  p.swell = 0.12 * jolt;
  for (const i of [2, 3]) {
    const A = R.ankle[i], yaw = 26 * k * DEG, piv: V3 = [0, R.ankle[0][1], 0];
    const d = sub(A, piv), turned: V3 = [piv[0] + d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), piv[1] + d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw), A[2]];
    const lift = R.reach[i] * 0.2 * Math.max(hump(t, 0.16, 0.12), hump(t, hit - 0.06, 0.08), hump(t, 0.82, 0.12));
    p.at[i] = [turned[0], turned[1], A[2] + lift];
  }
  return p;
}

/** The Prismetail's stamp: it rears its forequarters up and brings both fore feet down together, its tail lifted and brought down after. */
function stamp(s: Gecko, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = GLASS_HITS[2];
  const top = hit - 0.12, peak = top - 0.18;
  const rear = t < peak ? smooth(t / peak) : t < top ? 1 : 1 - clamp((t - top) / (hit - top)) ** 2;
  const land = hump(t, hit + 0.04, 0.1), shake = t > hit ? Math.sin((t - hit) * 34) * (1 - ramp(t, hit, 0.9)) : 0;
  p.pitch = 18 * rear - 2 * land;
  p.H += s.len * (0.06 * rear - 0.03 * land) + 0.02 * shake;
  p.surge = -s.len * 0.05 * rear;
  p.neck = [-12 * rear + 12 * land, 0];
  p.head = [10 * rear - 10 * land, 0, 3 * shake];
  p.squash = 0.07 * land;
  p.roll = 1.5 * shake;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 1.05, A[1] + R.reach[i] * 0.15, A[2] + R.reach[i] * 0.55];
    if (t < top) p.at[i] = mixV(A, high, smooth(Math.min(1, t / peak)));
    else if (t < hit) p.at[i] = mixV(high, A, ((t - top) / (hit - top)) ** 2);
    p.foot[i] = 16 * rear;
  }
  const slam = PRISMETAIL_SLAM;
  const up = ramp(t, 0.05, peak) * (1 - ramp(t, slam - 0.08, slam));
  p.tail = [14 * up - 8 * hump(t, slam + 0.03, 0.06), 0, 4 * up];
  p.swell = 0.08 * land + 0.06 * hump(t, slam + 0.03, 0.06);
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** Numbers its task needs, worked out the first time it is posed: how far it bows to the ground and to the smelter's mouth, and where they are. */
interface Work {
  ready: boolean;
  set: number; push: number;
  /** Where the lump is set down, and the smelter, on the ground. */
  lumpOut: V3; smelter: V3;
}
const works = new Map<Gecko, Work>();
const workOf = (s: Gecko): Work => {
  let W = works.get(s);
  if (!W) { W = { ready: false, set: 0.6, push: 0.4, lumpOut: [0, 0, 0], smelter: [0, 0, 0] }; works.set(s, W); }
  return W;
};
/** How far it turns to its right to set the lump down, in degrees. */
const TURN = [50, 46, 42];

/** Bowed `b` of the way down (one, about as far as it goes), or with `b` under nought its head lifted. */
function bowed(s: Gecko, p: Plan, b: number, yaw: number): void {
  const N = [26, 46, 60][s.stage], Hd = [22, 30, 36][s.stage], P = [8, 9, 7][s.stage];
  p.neck[0] += N * b;
  p.head[0] -= Hd * b;
  p.pitch -= P * Math.max(0, b);
  p.H -= s.len * 0.03 * Math.max(0, b);
  p.neck[1] += yaw * 0.6;
  p.head[1] += yaw * 0.35;
  p.yaw += yaw * 0.12;
}

/** How far through the puff the bubble it blows is, nought (the gob) to one (blown full), and back down to the lump. */
const blownOf = (t: number): number => ramp(t, GLASS_WORK.puff, GLASS_WORK.blown) * (1 - ramp(t, GLASS_WORK.blown + 0.02, GLASS_WORK.lump));
/** How hot the glass at its mouth is: white-orange as it comes out, cooling to clear as it is blown. */
const heatOf = (t: number): number => (t < GLASS_WORK.grab ? 0 : 1 - ramp(t, GLASS_WORK.puff, GLASS_WORK.blown + 0.04));

/**
 * A go at its task: bowed to the smelter's mouth and its head in, the gob taken up on its tongue; drawn back and its head lifted
 * high, its cheeks puffing as the gob swells into a bubble and its tail's bubble swells with it; the bubble settling into a lump;
 * turned to its right and the lump set down.
 */
function workPlan(s: Gecko, R: Rest, t: number): Plan {
  const p = restPlan(s, R), W = workOf(s), K = GLASS_WORK, turnBy = TURN[s.stage];
  const up = -[0.55, 0.45, 0.35][s.stage];
  const keys: Array<[number, number, number, number]> = [
    [0, 0, 0, 0], [0.1, 0, W.push * 0.6, 0.3], [K.reach, 0, W.push, 1], [K.grab, 0, W.push, 1], [0.33, 0, W.push * 0.2, 0.2],
    [K.puff, 0, up, 0], [K.blown, 0, up, 0], [K.lump, 0, up * 0.6, 0], [0.76, -turnBy * 0.6, W.set * 0.5, 0],
    [K.set, -turnBy, W.set, 0], [0.93, -turnBy * 0.3, W.set * 0.2, 0], [1, 0, 0, 0],
  ];
  let q = 0;
  while (q < keys.length - 2 && keys[q + 1][0] <= t) q++;
  const a0 = keys[q], a1 = keys[q + 1], k = smooth((t - a0[0]) / (a1[0] - a0[0]));
  const yaw = lerp(a0[1], a1[1], k), b = lerp(a0[2], a1[2], k), lunge = lerp(a0[3], a1[3], k);
  bowed(s, p, b, yaw);
  p.surge += s.len * 0.12 * lunge;
  p.neck[0] += 6 * lunge;
  // Its jaws open as it takes the gob and as it lets the lump go.
  p.jaw = 9 * Math.max(hump(t, K.grab - 0.03, 0.05), hump(t, K.set + 0.02, 0.05));
  // Puffing: the head bobbed with each breath into the bubble, and its tail's bubble swelling as it blows.
  const puff = ramp(t, K.puff, K.puff + 0.04) * (1 - ramp(t, K.blown, K.lump));
  p.head[0] += 4 * puff * Math.sin((t - K.puff) * 70);
  p.squash = 0.03 * puff * (0.5 + 0.5 * Math.sin((t - K.puff) * 70));
  p.swell = 0.14 * blownOf(t);
  p.tail = [3 * puff, -0.35 * yaw, -4 * puff];
  const i = 1, A = R.ankle[i], step = Math.abs(yaw) / turnBy;
  p.at[i] = [A[0], A[1] + s.len * 0.04 * step, A[2] + R.reach[i] * 0.12 * Math.sin(Math.PI * step)];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its head high and its bubble swollen, a shake, and settled. */
function evolvePlan(s: Gecko, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.64, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += s.len * (-0.03 * hunch + 0.015 * up);
  p.pitch = -3 * hunch + 3 * up;
  p.neck = [12 * hunch - 12 * up, 0];
  p.head = [-10 * hunch + 16 * up, 0, 9 * shake];
  p.roll = 3 * shake;
  p.tail = [-6 * hunch + 10 * up, 10 * shake, 6 * up];
  p.swell = 0.16 * up;
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  return p;
}

function planOf(s: Gecko, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([headbutt, swipe, stamp][s.stage](s, R, a, act.t));
  if (act?.kind === 'work') return mixPlan(stillPlan(s, R, a), workPlan(s, R, act.t), downOf(act.t, a.graze));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, R, a), workPlan(s, R, 0.5), a.graze);
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

const snoutAt = (s: Gecko): V3 => { const H = s.head; return [0, H.r[1] * 0.55 + H.snout[2] * 0.3, H.up - H.r[2] * 0.3]; };
const snoutTip = (s: Gecko): V3 => { const c = snoutAt(s); return [0, c[1] + s.head.snout[2] * 0.92, c[2] - s.head.snout[1] * 0.2]; };
const skullAt = (s: Gecko): V3 => [0, 0, s.head.up];

function legOf(s: Gecko, body: Xf, i: number, hipLocal: V3, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const hip = place(body, hipLocal), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = Math.hypot(d[0], d[1], d[2]);
  const most = (l0 + l1) * 0.985, least = Math.abs(l0 - l1) + 0.08 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit([SIDE[i] * [1, 0.4, 0.32][s.stage], fore ? -1.2 : 0.4, s.knee]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const frame = (from: V3, to: V3): [V3, V3, V3] => frameOf(sub(from, to), fwd);
  const [X0, Y0, Z0] = frame(hip, knee), [X1, Y1, Z1] = frame(knee, at);
  const head = unit([fwd[0] + SIDE[i] * 0.45 * fwd[1], fwd[1] - SIDE[i] * 0.45 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the body, each link on from the one before it, lifted and curled up and swung. */
function tailBones(s: Gecko, body: Xf, lift: number, yaw: number, curl: number, wave = 0, lag = 0): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, bendPt(s, T.at, wave), -(T.lift + lift), 0, yaw * 0.4 + bendAt(s, T.at[1], wave) + (T.side ?? 0));
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.bend[q - 1] + (curl * 2 * q) / n), 0, (yaw * 0.6) / (n - 1) + (q >= n - 3 ? lag / 3 : 0));
    out.push(prev);
  }
  return out;
}

/** Where the bubble's middle is, in the last link's frame: on out past its end by most of its radius, so the glass of the tail swells into it. */
const bubbleAt = (s: Gecko): V3 => [0, -s.tail.links[s.tail.links.length - 1] - s.bubble.r * 0.96, 0];

/**
 * The bones of a stage: its pose, every leg bent to put its foot where the pose says, the neck and head on the body, the tail in
 * links and its bubble -- kept upright whichever way the tail is turned, so its shine stays on top -- and at its task the smelter,
 * the gob and the bubble it blows, and the lump.
 */
function geckoBones(s: Gecko): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, a: Anim, wave = 0, lag = 0): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, bendPt(s, s.neck.at, wave), -lean, 0, P.neck[1] + bendAt(s, s.neck.at[1], wave));
    b.head = joint(b.neck, [0, s.neck.curve[2], s.neck.len], lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, [0, s.head.r[1] * 0.1, s.head.up - s.head.r[2] * 0.35], -P.jaw);
    const tail = tailBones(s, body, P.tail[0], P.tail[1], P.tail[2], wave, lag);
    tail.forEach((x, q) => { b[`tail${q}`] = x; });
    const end = tail[tail.length - 1];
    const bob = s.bubble.r * 0.04 * cyc(a.t, 4, 0.7);
    const mid = place(end, bubbleAt(s));
    b.bubble = upright([mid[0], mid[1], mid[2] + bob], 1 + P.swell);
    for (let i = 0; i < 4; i++) {
      const g = P.at[i];
      const [u, l, f] = legOf(s, body, i, bendPt(s, R.hip[i], wave), [g[0], g[1], Math.max(g[2], (i < 2 ? s.fore : s.hind)[2])], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    const tk = tongueOf(a);
    if (tk > 0.01) {
      const tip = snoutTip(s), h = b.head, m = h.m;
      b.tongue = { m: [m[0], m[1] * tk, m[2], m[3], m[4] * tk, m[5], m[6], m[7] * tk, m[8]], t: place(h, [0, tip[1] - s.head.snout[2] * 0.2, tip[2] - s.head.snout[1] * 0.25]) };
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  const W = workOf(s), K = GLASS_WORK;
  /** Where something held at its mouth is: just off the tip of its snout, `r` out in front of it. */
  const heldAt = (b: Bones, r = 0): V3 => place(b.head, add(snoutTip(s), [0, r, -r * 0.2]));
  const prepare = (): void => {
    W.ready = true;
    const tipAt = (t: number): V3 => {
      const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t } };
      return heldAt(pose(workPlan(s, R, t), a));
    };
    // How far it bows to set the lump down: as far as brings its mouth down to the lump's top, found by halving.
    let lo = 0, hi = 1.8;
    for (let q = 0; q < 18; q++) {
      W.set = (lo + hi) / 2;
      if (tipAt(K.set)[2] > s.smelter.lump * 1.6) lo = W.set; else hi = W.set;
    }
    W.set = (lo + hi) / 2;
    const out = tipAt(K.set);
    W.lumpOut = [out[0], out[1], 0];
    // How far it bows to the smelter: as far as brings its mouth to the middle of the smelter's mouth; and the smelter put there.
    const mouthZ = s.smelter.r * MOUTH[1];
    lo = -0.6; hi = 1.6;
    for (let q = 0; q < 18; q++) {
      W.push = (lo + hi) / 2;
      if (tipAt(K.reach)[2] > mouthZ) lo = W.push; else hi = W.push;
    }
    W.push = (lo + hi) / 2;
    const at = tipAt(K.reach);
    W.smelter = [0, at[1] + s.smelter.r * 0.86, 0];
  };
  return (a) => {
    if (!W.ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go }), wave = waveOf(s, a);
    const lag = a.act || a.go <= 0 ? 0 : -7 * smooth(Math.min(1, a.go)) * Math.cos(TAU * (frac(a.u) - 0.18));
    const b = pose(P, a, wave, lag);
    if (a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
      const t = a.act?.kind === 'work' ? a.act.t : 0.5;
      const g = Math.max(0.001, a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze);
      b.smelter = upright(W.smelter, g);
      // The gob: on its tongue from when it takes it up, swelling into the bubble it blows, which sits out in front of its mouth.
      const blowR = s.bubble.r * s.smelter.blow, k = blownOf(t);
      const r = lerp(s.smelter.lump * 0.7, blowR, k);
      b.blow = upright(heldAt(b, r * 0.92), r / blowR);
      // The lump: at its mouth from when the bubble settles, set down on its right, and taken away to the stores.
      b.lump = t < K.set ? upright(heldAt(b, s.smelter.lump * 0.8)) : upright(W.lumpOut, 1 - ramp(t, 0.94, 1));
    }
    return b;
  };
}

/** Where the smelter's mouth is, as shares of its radius: how wide either side of its middle, and how high its middle and its top. */
const MOUTH = [0.36, 0.34, 0.62] as const;

/* ---- what is on it ------------------------------------------------------------------------ */

/** A droplet on a bone: where its root is and which way it hangs, how long and how round, and its tint. */
interface Drop { bone: 'trunk' | 'head' | 'neck' | 'tail' | 'fl1' | 'fr1' | 'hl1' | 'hr1'; link?: number; root: V3; dir: V3; len: number; r: number; m: Mat; small?: boolean; glass: boolean }

const layouts = new Map<Gecko, Drop[]>();
function dropsOf(s: Gecko): Drop[] {
  const had = layouts.get(s);
  if (had) return had;
  const out: Drop[] = [];
  const B = s.body, H = s.head, C = skullAt(s);
  // The crown: a row of round bumps of its scales over its brow and back over its crown, the biggest in the middle.
  for (let q = 0; q < s.crown.count; q++) {
    const u = s.crown.count > 1 ? q / (s.crown.count - 1) : 0.5, phi = lerp(-20, 95, u) * DEG;
    const e = onEgg(C, H.r, unit([0, Math.cos(phi + 0.6) * 0.9, Math.sin(phi + 0.6)]));
    const L = s.crown.size * (1 - 0.35 * Math.abs(u - 0.5));
    out.push({ bone: 'head', root: add(e.p, scale(e.n, -L * 0.3)), dir: unit(add(e.n, [0, -0.5, 0])), len: L * 1.4, r: L * 0.62, m: 'coat', glass: false });
  }
  // Down the back and sides of its neck: droplets hanging back and out, the longest at the top, in one row or two.
  const N = s.neck;
  for (let row = 0; row < s.nape.rows; row++) {
    for (let q = 0; q < s.nape.count; q++) {
      const f = s.nape.count > 1 ? q / (s.nape.count - 1) : 0.5, z = lerp(N.len * 0.92, N.len * 0.05, f), w = lerp(N.w[1], N.w[0], 1 - z / N.len);
      const L = s.nape.len * (1 - 0.4 * f) * (row ? 0.78 : 1) * (0.9 + 0.2 * jitter(q + row * 13));
      for (const sd of [-1, 1]) {
        const ang = sd * (row ? 62 : 22) * DEG, root: V3 = [Math.sin(ang) * w * 0.9, -Math.cos(ang) * w * 0.9, z];
        const dir = unit([Math.sin(ang) * (row ? 1.1 : 0.7), -0.9, -0.45]);
        out.push({ bone: 'neck', root, dir, len: L, r: L * 0.34, m: dropTint(q + row * 7 + (sd > 0 ? 3 : 0)), glass: true });
      }
    }
  }
  // Along its spine: round bumps of its scales on the little one; on the bigger ones glass droplets lying back like a crest.
  const Rg = s.ridge, y0 = B.y[5] - 0.02, y1 = B.y[0] + 0.1;
  for (let q = 0; q < Rg.count; q++) {
    const f = q / Math.max(1, Rg.count - 1), y = lerp(y0, y1, f), sd = q % 2 ? -1 : 1;
    const at = onRings(B, y, Math.PI / 2 + sd * 0.08);
    const L = lerp(Rg.len[1], Rg.len[0], f) * (0.92 + 0.16 * jitter(q + 40));
    const dir = unit([sd * 0.18, -1.1 - 0.4 * f, 0.55]);
    out.push({ bone: 'trunk', root: add(at.p, scale(at.n, -L * 0.15)), dir, len: L, r: L * (Rg.glass ? 0.3 : 0.55), m: Rg.glass ? dropTint(q + 20) : 'coat', glass: Rg.glass, small: q % 2 === 1 });
  }
  // Frills at its knees and elbows: a few droplets hanging back off the top of each lower leg.
  const legs: Array<Drop['bone']> = s.frill.fore ? ['fl1', 'fr1', 'hl1', 'hr1'] : ['hl1', 'hr1'];
  for (const leg of legs) {
    const side = leg[1] === 'l' ? -1 : 1, fore = leg[0] === 'f';
    for (let q = 0; q < s.frill.count; q++) {
      const L = s.frill.len * (1 - 0.22 * q) * (fore ? 0.85 : 1);
      const dir = unit([side * 0.5, fore ? -1 : -0.8, 0.2 - 0.45 * q]);
      out.push({ bone: leg, root: [side * s.thick * 0.7, -s.thick * 0.4, s.thick * (0.5 - 0.7 * q)], dir, len: L, r: L * 0.3, m: dropTint(q + (fore ? 50 : 60) + side), glass: true });
    }
  }
  // Along the outside of its tail's curl, from its middle on: droplets standing up off it, the longest toward the bubble.
  const T = s.tail;
  for (let q = 0; q < T.drops; q++) {
    const scaled = T.links.length - T.glass, link = Math.min(scaled - 1, T.from + Math.floor((q / T.drops) * (scaled - T.from)));
    const f = q / Math.max(1, T.drops - 1), sd = q % 2 ? -1 : 1;
    const L = T.dropLen * (0.6 + 0.4 * f) * (0.9 + 0.2 * jitter(q + 80));
    out.push({ bone: 'tail', link, root: [sd * T.w[link] * 0.4, -T.links[link] * (0.25 + 0.5 * (q % 2)), T.w[link] * 0.7], dir: unit([sd * 0.55, -0.35, 1]), len: L, r: L * 0.3, m: dropTint(q + 90), glass: true });
  }
  layouts.set(s, out);
  return out;
}
const dropOf = (D: Drop, fine: boolean): Mesh => dropMesh(D.root, D.dir, D.len, D.r, D.m, fine);

/* ---- what it is made of ------------------------------------------------------------------------- */

/** Whether a point on the barrel is in the ivory: everything under a line high on its flank, so its scales are a band down its back. */
const creamAt = (s: Gecko, c: V3): boolean => { const r = ringAt(s.body, c[1]); return c[2] < r.z + r.h * lerp(0.56, 0.7, clamp((c[1] - s.body.y[4]) / (s.body.y[6] - s.body.y[4]))); };

/** The barrel: its scales down its back, the ivory of its belly, flanks and chest, a chest swell, and its speckles. */
function barrelOf(s: Gecko, n: number, lod: number): Mesh {
  const B = s.body;
  const skin = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(skin.v, skin.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, skin.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return creamAt(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const cy = lerp(B.y[5], B.y[6], 0.7), cr = ringAt(B, B.y[5]);
  const chestC: V3 = [0, cy, cr.z - cr.h * 0.3], chestR: V3 = [cr.w * 0.92, (B.y[6] - B.y[5]) * 1.5, cr.h * 0.8];
  const chest = orb(chestC, chestR, n, 5, 'belly');
  return merge(body, chest, paint(speckles(s, lod)));
}

/**
 * Its speckles: peach and coral dots of every size over its ivory flanks, deeper mint ones in the band of its scales, and on the
 * bigger ones a patch of coral scales over its rump toward its tail, as the sheet has.
 */
function speckles(s: Gecko, lod: number): Disc[] {
  const B = s.body, out: Disc[] = [], count = lod ? s.spots : Math.round(s.spots * 0.5);
  for (let q = 0; q < count; q++) {
    const y = lerp(B.y[1] + 0.05, B.y[5], jitter(q * 3 + 1));
    const sd = q % 2 ? 1 : -1, round = lerp(-0.5, 1.45, jitter(q * 3 + 2));
    const at = onRings(B, y, sd > 0 ? round : Math.PI - round);
    const inCream = creamAt(s, at.p);
    const r = B.w[3] * (0.035 + 0.06 * jitter(q * 3 + 3)) * (inCream ? 1 : 0.8);
    const m: Mat = inCream ? (jitter(q + 5) < 0.6 ? 'spot' : 'shell') : jitter(q + 5) < 0.6 ? 'coatDark' : 'spot';
    out.push(disc(add(at.p, scale(at.n, 0.012)), at.n, r, r * (0.75 + 0.25 * jitter(q + 9)), 6, m, { spin: jitter(q) * 3, up: [0, 1, 0] }));
  }
  if (s.stage) {
    // The coral over its rump: scales shingled across its back from its hips to its tail's root.
    const rows = lod ? 4 : 2;
    for (let q = 0; q < rows * 5; q++) {
      const row = Math.floor(q / 5), col = q % 5;
      const y = lerp(B.y[2], B.y[0] + 0.06, (row + 0.5 * (col % 2)) / rows), th = Math.PI / 2 + (col - 2) * 0.28;
      const at = onRings(B, y, th);
      const r = B.w[3] * 0.1 * (1 - 0.15 * row);
      out.push(disc(add(at.p, scale(at.n, 0.014)), at.n, r, r * 0.8, 6, jitter(q + 11) < 0.7 ? 'shell' : 'shellDark', { spin: 0.3, up: [0, 1, 0] }));
    }
  }
  return out;
}

function creamUnder(m: Mesh, under: (p: V3) => boolean): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const top = f.i.reduce((t, i) => (m.v[i][2] > t[2] ? m.v[i] : t), m.v[f.i[0]]);
    return under(top) ? { ...f, m: 'belly' as Mat } : f;
  }));
}

/**
 * The head: a round skull, wide and a little flat, a size too big on the little one; a rounded snout; the ivory of its face
 * under a line from the corner of its mouth back under its eye and down its throat, its scales over its crown and down its
 * nose; peach speckles on its cheeks; the bumps on its crown; its big eyes; and a small smile.
 */
function headOf(s: Gecko, n: number, k: number, lod: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const sn = H.snout, snoutC = snoutAt(s), snoutR: V3 = [sn[0], sn[2], sn[1]];
  const eyeLow = onEgg(C, H.r, s.eye.dir).p[2] - C[2] - s.eye.size * 0.6;
  const faceLine = (y: number): number => lerp(-H.r[2] * 0.2, eyeLow, clamp(((y - C[1]) / H.r[1] + 0.55) / 0.8));
  const skull = creamUnder(orb(C, H.r, n + 4, k + 3, 'coat'), (p) => p[2] - C[2] < faceLine(p[1]));
  const snout = creamUnder(orb(snoutC, snoutR, n + 2, k + 2, 'coat'), (p) => p[2] < snoutC[2] + sn[1] * 0.55);
  const bumps = dropsOf(s).filter((D) => D.bone === 'head').map((D) => dropOf(D, !!lod));
  const reachBack = [0.62, 0.78, 0.84][s.stage];
  const mouth = paint([lineOn(Array.from({ length: 9 }, (_, q) => {
    const x = (q / 8 - 0.5) * 2;
    return onEgg(snoutC, snoutR, [x * reachBack, 1 - 0.55 * Math.abs(x) * reachBack, -0.16 + 0.32 * x * x]);
  }), sn[0] * 0.03, 'lid')]);
  const nostrils = paint([1, -1].map((sd) => disc(add(onEgg(snoutC, snoutR, [sd * 0.28, 0.9, 0.48]).p, [0, 0.01, 0]), [sd * 0.2, 1, 0.5], sn[0] * 0.05, sn[0] * 0.04, 5, 'lid')));
  // Peach speckles over its cheeks and the sides of its crown, mint ones over its brow.
  const spots: Disc[] = [];
  for (let q = 0; q < (lod ? 14 : 6); q++) {
    const sd = q % 2 ? 1 : -1, e = onEgg(C, H.r, unit([sd * (0.45 + 0.5 * jitter(q + 70)), -0.5 + 0.8 * jitter(q + 71), 0.1 + 0.7 * jitter(q + 73)]));
    const toEye = sub(e.p, onEgg(C, H.r, [sd * s.eye.dir[0], s.eye.dir[1], s.eye.dir[2]]).p);
    if (Math.hypot(toEye[0], toEye[1], toEye[2]) < s.eye.size * 1.5) continue;
    const r = H.r[0] * (0.035 + 0.04 * jitter(q + 72));
    const cream = e.p[2] - C[2] < faceLine(e.p[1]);
    spots.push(disc(add(e.p, scale(e.n, 0.012)), e.n, r, r * 0.85, 6, cream ? 'spot' : jitter(q + 74) < 0.5 ? 'spot' : 'coatDark', { spin: q }));
  }
  return merge(skull, snout, ...bumps, mouth, nostrils, paint(spots), eyesOf(s, shut));
}

/**
 * The eyes: big and round, set on the front of the skull: each a warm orange rim, a deep brown iris filling most of it, a dark
 * middle and two glints, laid onto the skull's own curve.
 */
function eyesOf(s: Gecko, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = E.tall;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.014));
      continue;
    }
    // A raised rim of its scales round the eye, then the orange ring, the brown iris and the dark middle.
    out.push(onto(disc(p, n, r * 1.26, r * 1.26 * tall, 12, 'coatLight', o), 0.008));
    out.push(onto(disc(p, n, r * 1.1, r * 1.1 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(add(p, scale(up, -r * 0.02)), n, r * 0.84, r * 0.86 * tall, 12, 'crystalDark', o), 0.02));
    out.push(onto(disc(add(p, scale(up, -r * 0.04)), n, r * 0.5, r * 0.56 * tall, 10, 'eye', o), 0.024));
    out.push(onto(disc(add(add(p, scale(up, r * 0.38 * tall)), scale(across, side * r * 0.3)), n, r * 0.28, r * 0.28, 7, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.36 * tall)), scale(across, -side * r * 0.32)), n, r * 0.12, r * 0.12, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

function headSolids(s: Gecko): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.9) }, { c: snoutAt(s), r: [sn[0] * 0.85, sn[2] * 0.85, sn[1] * 0.85] }];
}

/** The neck: its scales down the back of it, ivory down its throat, a few speckles, and its droplets. */
function neckOf(s: Gecko, n: number, lod: number): Mesh {
  const N = s.neck, [w0, w1] = N.w;
  const m = tube([[0, 0, -0.3], [0, N.curve[0], N.len * 0.35], [0, N.curve[1], N.len * 0.7], [0, N.curve[2], N.len + 0.05]], [w0 * 1.04, lerp(w0, w1, 0.4), lerp(w0, w1, 0.75), w1], [w0 * 0.96, lerp(w0, w1, 0.4) * 0.94, lerp(w0, w1, 0.75) * 0.92, w1 * 0.92], n,
    'coat', { seam: 'both' });
  const skin = mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length), w = lerp(w0, w1, clamp(c[2] / N.len));
    return c[1] > w * 0.05 ? { ...f, m: 'belly' as Mat } : f;
  }));
  const drops = dropsOf(s).filter((D) => D.bone === 'neck').map((D) => dropOf(D, !!lod));
  const spots: Disc[] = [];
  for (let q = 0; q < (lod ? 3 + 4 * s.stage : 1 + s.stage); q++) {
    const z = N.len * (0.1 + 0.8 * jitter(q + 90)), ang = (q % 2 ? 1 : -1) * (0.9 + 0.8 * jitter(q + 91)), w = lerp(w0, w1, z / N.len);
    const nrm: V3 = [Math.sin(ang), -Math.cos(ang), 0];
    spots.push(disc([nrm[0] * w * 1.01, nrm[1] * w * 0.93, z], nrm, w * 0.09, w * 0.075, 6, 'spot', { spin: q }));
  }
  return merge(skin, ...drops, paint(spots));
}

/**
 * A foot: a small sole of ivory, its toes splayed out in a fan, and on the end of each a round peach pad, a gecko's -- big on the
 * little one, so they read.
 */
function footOf(s: Gecko, fore: boolean, n: number, k: number): Mesh {
  const L = fore ? s.fore : s.hind, w = s.thick * 0.85, drop = L[2];
  const sole = orbAlong([0, w * 0.2, -drop + w * 0.28], [0, 1, 0], [w * 0.7, w * 0.4, w * 0.5], n, k, 'belly');
  const toes: Mesh[] = [];
  const count = 4, len = w * [1.3, 1.45, 1.5][s.stage], thick = w * [0.2, 0.18, 0.18][s.stage], pad = w * [0.44, 0.38, 0.36][s.stage];
  for (let q = 0; q < count; q++) {
    const a = ((q - (count - 1) / 2) / Math.max(1, count - 1)) * 1.7;
    const dir = unit([Math.sin(a), Math.cos(a), 0]), root: V3 = [Math.sin(a) * w * 0.3, w * 0.35 + Math.cos(a) * w * 0.25, -drop + w * 0.24];
    const tip = add(root, scale(dir, len));
    toes.push(taper([root, add(root, add(scale(dir, len * 0.5), [0, 0, len * 0.04])), tip], thick, thick * 0.85, 5, 'belly'));
    toes.push(orb(add(tip, [0, 0, pad * 0.1]), [pad, pad, pad * 0.78], 7, 4, 'pad'));
  }
  return merge(sole, ...toes);
}

/** The tail's links: each its scales down the top and ivory beneath, speckled; coral at its root on the bigger ones; its droplets. */
function tailOf(s: Gecko, lod: number): Mesh[] {
  const T = s.tail, drops = dropsOf(s).filter((D) => D.bone === 'tail');
  return T.links.map((L, q) => {
    // Its last links are glass, drawn by hand with its bubble (`glassBubbles`): here only where they reach.
    if (q >= T.links.length - T.glass) return mesh([[T.w[q], 0, 0], [-T.w[q], 0, 0], [0, -L, T.w[q]]], []);
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)];
    // Its underside ivory; on the bigger ones its top coral over its root, as its rump is.
    const top: Mat = s.stage && q < 3 ? 'shell' : 'coat';
    const core = tube([[0, 0.04, 0], [0, -L * 0.5, 0], [0, -L - 0.02, 0]], [w0, (w0 + w1) / 2, w1], [w0 * 0.92, (w0 + w1) * 0.45, w1 * 0.92], 7,
      (ring, j) => (Math.abs(((j + 1) / 7) * TAU - Math.PI * 1.5) < 1.3 ? 'belly' : top), { seam: 'both' });
    const spots = paint([1, -1].map((sd) => disc([sd * w0 * 0.97, -L * (0.3 + 0.4 * (q % 2)), w0 * 0.15], [sd, 0, 0.3], w0 * 0.2, w0 * 0.15, 6, q % 3 ? 'spot' : 'coatDark', { spin: q })));
    const own = drops.filter((D) => D.link === q).map((D) => dropOf(D, !!lod));
    return merge(core, lod ? spots : null, ...own);
  });
}

/* ---- the smelter and the glass ------------------------------------------------------------------------ */

/**
 * A small stone smelter, built in its own frame on the ground, its mouth facing `-y`: a squat drum of fieldstone, a dome over it
 * with a short chimney, courses painted round it, and the mouth an arch of darker stones with the melt glowing in it.
 */
function smelterOf(s: Gecko, n: number): Mesh {
  const R = s.smelter.r, wall = R * 0.7;
  const drum = tube([[0, 0, 0], [0, 0, wall * 0.5], [0, 0, wall]], [R * 1.04, R, R * 0.98], [R * 1.04, R, R * 0.98], n + 4, 'stone', { up: [0, 1, 0] });
  const dome = orb([0, 0, wall], [R * 0.98, R * 0.98, R * 0.62], n + 4, 5, 'stone');
  const chimney = tube([[0, R * 0.12, wall + R * 0.4], [0, R * 0.14, wall + R * 1.05]], [R * 0.3, R * 0.24], [R * 0.3, R * 0.24], 8, 'stoneDark', { up: [0, 1, 0] });
  const courses: Disc[] = [];
  const onDrum = (a: number, z: number, lift = 0.012): V3 => [Math.sin(a) * (R + lift), -Math.cos(a) * (R + lift), z];
  for (const z of [wall * 0.33, wall * 0.66]) {
    for (let q = 0; q < 16; q++) {
      const a0 = (q / 16) * TAU, a1 = ((q + 1) / 16) * TAU;
      if (Math.abs(Math.sin((a0 + a1) / 2)) < MOUTH[0] * 1.3 && Math.cos((a0 + a1) / 2) > 0) continue;
      courses.push(facingDisc([onDrum(a0, z - R * 0.012), onDrum(a1, z - R * 0.012), onDrum(a1, z + R * 0.012), onDrum(a0, z + R * 0.012)], [Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2), 0], 'stoneDark'));
    }
  }
  const arch = (w: number, top: number, bottom: number, lift: number): V3[] => {
    const pts: V3[] = [];
    for (let q = 0; q <= 8; q++) {
      const a = Math.PI * (q / 8), x = Math.cos(a) * w, z = top - w + Math.sin(a) * w;
      pts.push([x, -Math.sqrt(Math.max(0, R * R - x * x)) - lift, Math.max(bottom, z)]);
    }
    pts.push([-w, -Math.sqrt(R * R - w * w) - lift, bottom], [w, -Math.sqrt(R * R - w * w) - lift, bottom]);
    return pts;
  };
  const mw = R * MOUTH[0], mt = R * MOUTH[2];
  const mouthDecals = paint([
    facingDisc(arch(mw * 1.22, mt + mw * 0.22, 0.01, 0.01), [0, -1, 0], 'stoneDark'),
    facingDisc(arch(mw, mt, 0.02, 0.016), [0, -1, 0], 'lid'),
    facingDisc(arch(mw * 0.8, mt * 0.72, 0.03, 0.02), [0, -1, 0], 'ember', true),
    facingDisc(arch(mw * 0.5, mt * 0.4, 0.04, 0.024), [0, -1, 0], 'flame', true),
  ]);
  return merge(drum, dome, chimney, paint(courses), mouthDecals);
}

/** A glass lump: a rounded, flattened knob of pale glass, lumpy on top, a glint on it; in its own frame with its foot at the origin. */
function lumpOf(r: number, n: number): Mesh {
  const body = orb([0, 0, r * 0.62], [r * 1.1, r, r * 0.66], n, 4, 'water');
  const knob = orb([r * 0.3, -r * 0.15, r * 1.05], [r * 0.55, r * 0.5, r * 0.36], 6, 3, 'membrane');
  const glint = disc([-r * 0.35, -r * 0.2, r * 1.2], [-0.3, -0.3, 1], r * 0.22, r * 0.16, 6, 'glint', { lit: true });
  return merge(body, knob, paint([glint]));
}

/* ---- a stage's pieces ------------------------------------------------------------------------------ */

function geckoBuild(s: Gecko, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 2, lod), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  const back = dropsOf(s).filter((D) => D.bone === 'trunk' && (lod || !D.small)).map((D) => dropOf(D, !!lod));
  pieces.push({ key: 'back', mesh: merge(...back), bone: 'trunk', bias: 0.08, after: ['body'] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n + 3, lod), bone: 'neck', bias: 0, under: 'head' });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, lod, false), shut: headOf(s, n, k, lod, true), bone: 'head', bias: 0.2, hide });
  pieces.push({
    key: 'tongue', bone: 'tongue', bias: 0.19, after: ['head'], shown: (a) => tongueOf(a) > 0.01,
    mesh: merge(taper([[0, 0, 0], [0, s.head.snout[2] * 0.35, -s.head.snout[1] * 0.05], [0, s.head.snout[2] * 0.5, s.head.snout[1] * 0.1]], s.head.snout[0] * 0.2, s.head.snout[0] * 0.14, 5, 'tongue', 0.5)),
  });
  tailOf(s, lod).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail' }));
  // The bubble and the little ones budding off it are glass, drawn by hand (`glassBubbles`): here only how far they reach.
  pieces.push({ key: 'bubble', mesh: reachMesh(s.bubble.r * (1 + 2 * Math.max(...s.bubble.buds.map(([, out, size]) => out - 1 + size)))), bone: 'bubble', bias: 0.02 });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const side3: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const inner = (c: V3): boolean => c[0] * side < -w * 0.2 && c[2] < w * 0.3;
    const hw = !fore ? w * (s.stage ? 1.15 : 1.08) : w;
    const upperSkin = merge(orb([0, 0, hw * 0.1], scale([1.25, 1.3, 1.15], hw * (s.stage ? 1 : 0.9)), n + 1, k + 1, 'coat'), tube([[0, 0, 0], [0, 0, -L[0]]], [hw * 1.2, w * 0.95], [hw * 1.2, w * 0.95], n, 'coat', { seam: 'start' }), orb([0, 0, -L[0]], w * 0.98, n, k, 'coat'));
    const upper = merge(mesh(upperSkin.v, upperSkin.f.map((f) => (inner(scale(f.i.reduce((t, j) => add(t, upperSkin.v[j]), [0, 0, 0] as V3), 1 / f.i.length)) ? { ...f, m: 'belly' as Mat } : f))),
      lod ? paint([0, 1, 2].map((q) => disc([side * hw * 1.18, (q - 1) * hw * 0.5, -L[0] * (0.2 + 0.28 * q)], [side, 0, 0.2], hw * 0.18, hw * 0.14, 6, q % 2 ? 'spot' : 'shell', { spin: q + i }))) : null);
    const shin = tube([[0, 0, w * 0.7], [0, 0.02, -L[1]]], [w * 0.9, w * 0.72], [w * 0.9, w * 0.72], n, 'coat', { seam: 'start' });
    const frills = dropsOf(s).filter((D) => D.bone === `${key}1`).map((D) => dropOf(D, !!lod));
    const lower = merge(mesh(shin.v, shin.f.map((f) => {
      const c = scale(f.i.reduce((t, j) => add(t, shin.v[j]), [0, 0, 0] as V3), 1 / f.i.length);
      return c[0] * side < w * 0.7 ? { ...f, m: 'belly' as Mat } : f;
    })), ...frills,
      paint([0, 1, 2].slice(0, lod ? 3 : 1).map((q) => { const a = (q * 2.1 + i) % TAU, d: V3 = [Math.cos(a), Math.sin(a), 0]; return disc([d[0] * w * 0.88, d[1] * w * 0.88, -L[1] * (0.2 + 0.25 * q)], d, w * 0.22, w * 0.18, 6, 'spot', { spin: q }); })));
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, after: ['body', 'back'], front: side3 },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}2`, mesh: footOf(s, fore, n, k), bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front: out3 },
    );
  }
  const working = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
  const workT = (a: Anim): number => (a.act?.kind === 'work' ? a.act.t : 0.5);
  const K = GLASS_WORK;
  pieces.push({ key: 'smelter', mesh: smelterOf(s, n), bone: 'smelter', bias: 0, shown: working });
  // The bubble it blows, from the gob it takes up to when it settles into the lump; the lump from then.
  pieces.push({ key: 'blow', mesh: orb([0, 0, 0], s.bubble.r * s.smelter.blow, 9, 6, 'flame'), bone: 'blow', bias: 0.21, shown: (a) => working(a) && workT(a) >= K.grab && workT(a) < K.puff + 0.08 });
  pieces.push({ key: 'blown', mesh: reachMesh(s.bubble.r * s.smelter.blow), bone: 'blow', bias: 0.21, shown: (a) => working(a) && workT(a) >= K.puff + 0.08 && workT(a) < K.lump });
  pieces.push({ key: 'lump', mesh: lumpOf(s.smelter.lump, n), bone: 'lump', bias: 0.21, shown: (a) => working(a) && workT(a) >= K.lump });
  const bend = (v: readonly V3[], a: Anim): V3[] => { const w = waveOf(s, a); return w ? v.map((p) => bendPt(s, p, w)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/* ---- its light ------------------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** The smelter's fire and the hot glass, and the cool light through the glass. */
const EMBER: RGB = [255, 140, 44];
const HOT: RGB = [255, 214, 130];
const SHEEN: RGB = [236, 246, 255];

function light(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(0.45, css(c, al * 0.35));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** The screen radius of something `r` across at `p`: the distance to a point `r` off it across the view. */
function screenR(view: View, p: V3, r: number): number {
  const [x0, y0] = onScreen(view, p);
  return Math.max(...([[r, 0, 0], [0, r, 0], [0, 0, r]] as V3[]).map((d) => { const [x, y] = onScreen(view, add(p, d)); return Math.hypot(x - x0, y - y0); }));
}

/* ---- its glass ------------------------------------------------------------------------------- */

/** The colours in a bubble's film, in the order they run round it: pink, peach, butter, teal and lilac. */
const FILM: readonly RGB[] = [[255, 140, 186], [255, 178, 132], [255, 226, 120], [104, 214, 204], [180, 160, 255]];

/**
 * A ball of glass `R` across at (x, y) on the canvas, drawn so it reads as clear: the backdrop through its middle, a soap film's
 * colour toward its rim, swirls of pink, peach, butter, teal and lilac curving round inside it, a thin warm rim, a crisp white
 * highlight high on its left, a spot over it and a soft reflection low on its right. `turn` turns the swirls; `k` is how much of
 * it there is, nought to one; `fine` leaves out the swirls on a little one; `gap`, where the tail's glass swells into it, has no
 * rim across it (an angle on the canvas and how far either side of it).
 */
function glassBall(g: CanvasRenderingContext2D, x: number, y: number, R: number, turn: number, k = 1, fine = true, gap?: { at: number; half: number }): void {
  if (R <= 0 || k <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1, hair = 1 / px;
  g.save();
  const body = g.createRadialGradient(x - R * 0.2, y - R * 0.25, R * 0.05, x, y, R);
  body.addColorStop(0, css([255, 255, 255], 0.08 * k));
  body.addColorStop(0.6, css([255, 240, 244], 0.14 * k));
  body.addColorStop(1, css([255, 216, 228], 0.46 * k));
  g.fillStyle = body;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.fill();
  if (fine) {
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, TAU);
    g.clip();
    // Its swirls: bands of the film curving round the light high on its left and sweeping down its lower right, each band
    // a little wavy, as a soap film's colours run.
    const cx = x - R * 0.32, cy = y - R * 0.38;
    g.lineCap = 'round';
    for (let q = 0; q < FILM.length + 2; q++) {
      const rr = R * (0.6 + 0.13 * q), a0 = -0.35 + 0.25 * Math.sin(turn + q), a1 = 2.0 + 0.3 * Math.cos(turn * 1.3 + q * 2);
      g.strokeStyle = css(FILM[(q + Math.floor(turn)) % FILM.length], 0.56 * k);
      g.lineWidth = R * (0.12 + 0.04 * Math.sin(turn + q * 1.7));
      g.beginPath();
      for (let j = 0; j <= 12; j++) {
        const u = j / 12, ang = lerp(a0, a1, u), w = rr * (1 + 0.06 * Math.sin(u * 7 + q + turn * 2));
        const px0 = cx + Math.cos(ang) * w, py0 = cy + Math.sin(ang) * w;
        if (j) g.lineTo(px0, py0); else g.moveTo(px0, py0);
      }
      g.stroke();
    }
    g.restore();
  }
  // The film thickest round its edge: a ring running through every colour of it, turning slowly.
  const ring = g.createConicGradient(turn * 1.7, x, y);
  [...FILM, FILM[0]].forEach((c, q) => ring.addColorStop(q / FILM.length, css(c, 0.55 * k)));
  g.strokeStyle = ring;
  g.lineWidth = R * 0.16;
  const a0 = gap ? gap.at + gap.half : 0, a1 = gap ? gap.at - gap.half + TAU : TAU;
  g.beginPath();
  g.arc(x, y, R * 0.9, a0 + (gap ? 0.12 : 0), a1 - (gap ? 0.12 : 0));
  g.stroke();
  g.strokeStyle = css([236, 150, 112], 0.8 * k);
  g.lineWidth = Math.max(hair, R * 0.035);
  g.beginPath();
  g.arc(x, y, R, a0, a1);
  g.stroke();
  g.fillStyle = css([255, 255, 255], 0.95 * k);
  g.beginPath();
  g.ellipse(x - R * 0.4, y - R * 0.46, R * 0.21, R * 0.1, -0.65, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(x - R * 0.1, y - R * 0.68, Math.max(hair * 0.8, R * 0.05), 0, TAU);
  g.fill();
  g.strokeStyle = css([255, 255, 255], 0.5 * k);
  g.lineWidth = Math.max(hair, R * 0.05);
  g.beginPath();
  g.arc(x, y, R * 0.8, 0.25, 1.2);
  g.stroke();
  g.restore();
}

/** A Catmull-Rom curve through `pts`, `per` points a span, ends and all. */
function smoothed(pts: ReadonlyArray<readonly [number, number]>, per: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

/** The colours that run up out of its tail into the glass: coral, peach and teal. */
const RUN: readonly RGB[] = [[248, 132, 120], [255, 182, 132], [96, 206, 196]];

/** Each point of a line moved `k` of its width (`width(i)`) square to the line, to its left on the canvas. */
function offsetLine(pts: ReadonlyArray<[number, number]>, width: (i: number) => number, k: number): Array<[number, number]> {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(c[1] - a[1]), ny = c[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const w = width(i) * k;
    return [p[0] + nx * w, p[1] + ny * w];
  });
}

/** A line through `pts` on the canvas, from its start. */
function lineThrough(g: CanvasRenderingContext2D, pts: ReadonlyArray<[number, number]>): void {
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
}

/**
 * The tail turning to glass and swelling out into the bubble, as a glassblower's gather at the end of the pipe: from where its
 * scales end, along the bones of its glass links, a clear neck widening into the bubble's rim, with the bubble's film, rim and
 * sheen down its sides and the tail's coral, peach and teal running up it into the bubble's swirls. Drawn outside the bubble
 * only, so the two are one glass with no seam; says where on the bubble's rim it joins, which the bubble leaves open.
 */
function glassNeck(g: CanvasRenderingContext2D, view: View, s: Gecko, b: Bones, x: number, y: number, R: number): { at: number; half: number } | undefined {
  const T = s.tail, n = T.links.length, first = n - T.glass;
  const from = b[`tail${first}`];
  if (!from) return undefined;
  // From half way down its last scaled link, so its scales go on under the glass and turn into it rather than ending.
  const before = b[`tail${first - 1}`];
  const world: V3[] = [...(before ? [place(before, [0, -T.links[first - 1] * 0.45, 0])] : []), from.t];
  for (let q = first + 1; q < n; q++) world.push(b[`tail${q}`].t);
  world.push(place(b[`tail${n - 1}`], [0, -T.links[n - 1], 0]));
  const pts = smoothed([...world.map((p) => onScreen(view, p)), [x, y]], 6);
  // Its width along it: the tail's where the scales end, flaring out to most of the bubble's as it reaches it.
  const w0 = screenR(view, from.t, T.w[first - 1] ?? T.w[first]), wEnd = R * 0.7;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1] || 1;
  const width = (i: number): number => lerp(w0, wEnd, (lens[i] / total) ** 2.6);
  const left = offsetLine(pts, width, 1), right = offsetLine(pts, width, -1);
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1, hair = 1 / px;
  const outline = (): void => {
    lineThrough(g, left);
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
  };
  // Up to where it is inside the bubble's rim, which the bubble draws.
  const inside = pts.findIndex(([px2, py2]) => Math.hypot(px2 - x, py2 - y) < R * 0.98);
  const upto = inside < 0 ? pts.length : inside + 3;
  g.save();
  g.lineCap = 'round';
  // Only outside the bubble: the canvas but for the bubble's disc.
  g.beginPath();
  g.rect(x - R * 40, y - R * 40, R * 80, R * 80);
  g.arc(x, y, R, 0, TAU, true);
  g.clip();
  g.beginPath();
  outline();
  g.fillStyle = css([255, 236, 242], 0.3);
  g.fill();
  // Its film down both sides, and its warm rim.
  g.lineWidth = Math.max(hair, w0 * 0.5);
  g.strokeStyle = css(FILM[1], 0.5);
  g.beginPath();
  lineThrough(g, offsetLine(pts, width, 0.8).slice(0, upto));
  g.stroke();
  g.strokeStyle = css(FILM[3], 0.45);
  g.beginPath();
  lineThrough(g, offsetLine(pts, width, -0.8).slice(0, upto));
  g.stroke();
  g.strokeStyle = css([236, 150, 112], 0.8);
  g.lineWidth = Math.max(hair, R * 0.035);
  for (const edge of [left, right]) {
    g.beginPath();
    lineThrough(g, edge.slice(0, upto));
    g.stroke();
  }
  // A sheen down its near side.
  g.strokeStyle = css([255, 255, 255], 0.6);
  g.lineWidth = Math.max(hair, w0 * 0.16);
  g.beginPath();
  lineThrough(g, offsetLine(pts, width, 0.45).slice(0, upto));
  g.stroke();
  g.restore();
  // The tail's colours running up out of its scales and on into the bubble, curling round as its swirls do.
  g.save();
  g.beginPath();
  outline();
  g.moveTo(x + R * 0.97, y);
  g.arc(x, y, R * 0.97, 0, TAU);
  g.clip();
  g.lineCap = 'round';
  const end = pts[Math.max(0, pts.length - 3)], into = Math.atan2(y - end[1], x - end[0]);
  RUN.forEach((c, q) => {
    const line = offsetLine(pts, width, (q - 1) * 0.42);
    const tail = line[line.length - 1];
    const turn = q % 2 ? -1 : 1;
    for (let j = 1; j <= 10; j++) {
      const u = j / 10, ang = into + turn * u * (1.6 + 0.4 * q), rr = R * (0.15 + 0.5 * u);
      line.push([tail[0] + Math.cos(ang) * rr - Math.cos(into) * R * 0.1 * u, tail[1] + Math.sin(ang) * rr - Math.sin(into) * R * 0.1 * u]);
    }
    g.strokeStyle = css(c, 0.5);
    g.lineWidth = Math.max(hair, w0 * 0.45);
    g.beginPath();
    lineThrough(g, line);
    g.stroke();
  });
  g.restore();
  // Where it joins the bubble's rim, and how wide it is there.
  const at = inside < 0 ? Math.atan2(end[1] - y, end[0] - x) : Math.atan2(pts[inside][1] - y, pts[inside][0] - x);
  return { at, half: Math.asin(Math.min(0.95, width(inside < 0 ? pts.length - 1 : inside) / R)) };
}

/**
 * The bubble on its tail and the little ones budding off it round its rim as seen, each glass (`glassBall`): under the body when
 * it is on the far side of it, over it when on the near side, so the body hides it or is seen through it. Its swirls turn slowly
 * as it stands, and it swells with the bone.
 */
function glassBubbles(g: CanvasRenderingContext2D, view: View, s: Gecko, b: Bones, a: Anim, front: boolean): void {
  if (!b.bubble) return;
  const p = b.bubble.t;
  if (nearSide(p, b.body.t, view) !== front) return;
  const [x, y] = onScreen(view, p), R = screenR(view, p, s.bubble.r * b.bubble.m[0]);
  const turn = [0.3, 1.4, 2.6][s.stage] + 0.35 * cyc(a.t, 1, s.stage);
  const gap = glassNeck(g, view, s, b, x, y, R);
  glassBall(g, x, y, R, turn, 1, true, gap);
  s.bubble.buds.forEach(([deg, out, size], q) => {
    const ang = (deg + 4 * cyc(a.t, 2 + q, q * 1.3)) * DEG, r = R * size * (1 + 0.06 * cyc(a.t, 3 + q, q));
    glassBall(g, x + Math.sin(ang) * R * out, y - Math.cos(ang) * R * out, r, turn + q, 1, false);
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const bigness = (s: Gecko): number => 0.5 + 0.5 * (s.len / 1.7);
/** The tints of the little bubbles and glints it throws. */
const BEAD_RGB: readonly RGB[] = [[255, 200, 220], [255, 236, 170], [190, 236, 222], [206, 220, 255], [228, 206, 250]];

/** A little bubble in the air: a pale tinted ball, a rim, and a glint; never under a pixel and a half. */
function bead(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, css([255, 255, 255], al * 0.7));
  grad.addColorStop(0.5, css(c, al * 0.45));
  grad.addColorStop(1, css(c, al * 0.75));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.strokeStyle = css(mix(c, [214, 134, 96], 0.45), al);
  g.lineWidth = Math.max(r * 0.14, 0.1);
  g.stroke();
}

/** A glint: a bright point with a soft light round it. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, c: RGB = SHEEN): void {
  if (al <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, 1 / px);
  g.save();
  g.globalCompositeOperation = 'lighter';
  light(g, x, y, r * 4, c, 0.5 * al);
  g.restore();
  g.fillStyle = css([255, 255, 255], al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = [214, 200, 184]): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.45 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(base, [252, 246, 236], 0.2 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const ang = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.42 : 0, lr = rr * (q ? 0.72 : 1);
    const cx = x + Math.cos(ang) * d, cy = y + Math.sin(ang) * d * 0.6 - rr * 0.18 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, css(c, al * (q ? 0.7 : 1)));
    grad.addColorStop(0.55, css(c, al * 0.45 * (q ? 0.7 : 1)));
    grad.addColorStop(1, css(c, 0));
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
}

/** Little bubbles thrown from `from`, `since` seconds after, floating up and out, slowing as they rise. */
function beads(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.6): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, ang = jitter(k) * TAU, sp = speed * (0.6 + 0.6 * jitter(k + 1));
    const v: V3 = [Math.cos(ang) * sp, Math.sin(ang) * sp, up * (0.7 + 0.6 * jitter(k + 2))];
    const p = thrown(from, v, since, 1.5);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = 1 - smooth((since - life * 0.6) / (life * 0.4));
    if (q % 3 === 2) glint(g, x, y, size * 0.5, al);
    else bead(g, x, y, size * (0.6 + 0.8 * jitter(k + 3)), BEAD_RGB[q % BEAD_RGB.length], al);
  }
}

/**
 * What a strike throws: little bubbles and glints shaken off its bubble as the blow lands, and off the Glimmip's crown a puff;
 * the Glascade's tail sweeps dust off the ground; the Prismetail's stamp a ring of dust and bubbles up from its feet.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Gecko, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - GLASS_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  const bub = b.bubble ? b.bubble.t : mid;
  beads(g, view, mid, bub, since, front, 7, 40 + s.stage * 30, 1.2 * big, 1.6, 0.07 * big);
  if (s.stage === 0) {
    const crown = place(b.head, [0, s.head.r[1] * 0.4, s.head.up + s.head.r[2] * 0.7]);
    if (front) puff(g, view, crown, 0.3 * big, since / 0.32, 3);
    return;
  }
  if (s.stage === 1) {
    const n = s.tail.links.length - 1, end = place(b[`tail${n}`], [0, -s.tail.links[n] * 0.6, 0]), ground: V3 = [end[0], end[1], 0.1];
    if (nearSide(ground, mid, view) === front) puff(g, view, ground, 0.5 * big, since / 0.36, 5);
    return;
  }
  const feet = [place(b.fl2, [0, 0, -s.fore[2]]), place(b.fr2, [0, 0, -s.fore[2]])], ground = scale(add(feet[0], feet[1]), 0.5);
  ground[2] = 0.02;
  if (since < 0.5) {
    const out = ramp(since, 0, 0.4), rx = big * (1.2 + 3 * out);
    for (let c = 0; c < 9; c++) {
      const th = (c / 9) * TAU + 0.3, p: V3 = [ground[0] + Math.cos(th) * rx, ground[1] + Math.sin(th) * rx * 0.75, 0.15 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, big * 0.55, since / 0.5, 30 + c);
    }
  }
  for (const [q, f] of feet.entries()) beads(g, view, mid, [f[0], f[1], 0.2], since, front, 6, 700 + q * 50, 1.6 * big, 3, 0.06 * big, 0.6);
}

/**
 * At its task: the smelter's mouth glowing, brighter as its head is in it; the gob glowing white-orange on its tongue, the bubble
 * it blows glowing as it swells and cooling to clear, a few little bubbles floating off it; and a glint as the lump is set down.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Gecko, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = workOf(s), K = GLASS_WORK, big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5;
  if (!b.smelter) return;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const R = s.smelter.r, mouth = place(b.smelter, [0, -R * 1.02, R * MOUTH[1]]);
  const g0 = b.smelter.m[0], near = hump(t, (K.reach + K.grab) / 2, 0.14);
  if (front && g0 > 0.2) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const [x, y] = onScreen(view, mouth);
    const toward = clamp(-dot([0, 1, 0], view.T) + 0.6);
    light(g, x, y, R * (0.8 + 0.4 * near) * g0, EMBER, (0.22 + 0.3 * near) * toward * g0);
    light(g, x, y, R * 0.35 * g0, HOT, (0.14 + 0.3 * near) * toward * g0);
    // The glass at its mouth, glowing while it is hot.
    const heat = heatOf(t);
    if (heat > 0 && b.blow && t < K.lump) {
      const p = b.blow.t, r = screenR(view, p, s.bubble.r * s.smelter.blow * b.blow.m[0]);
      const [px, py] = onScreen(view, p);
      light(g, px, py, r * 2.2, EMBER, 0.55 * heat);
      light(g, px, py, r * 1.1, HOT, 0.5 * heat);
    }
    g.restore();
  }
  // The bubble it blows, glass like its tail's, from when the gob has swelled until it settles into the lump.
  if (front && b.blow && t >= K.puff + 0.08 && t < K.lump) {
    const p = b.blow.t, [px, py] = onScreen(view, p);
    glassBall(g, px, py, screenR(view, p, s.bubble.r * s.smelter.blow * b.blow.m[0]), 4.2 + 3 * t, 1, true);
  }
  if (b.blow && t >= K.puff) beads(g, view, mid, b.blow.t, since(K.puff + 0.1), front, 5, 300, 0.5 * big, 1.6, 0.05 * big, 0.6);
  const dt = since(K.set);
  if (dt >= 0 && dt < 0.4) {
    const p: V3 = [W.lumpOut[0], W.lumpOut[1], s.smelter.lump * 1.4];
    if (nearSide(p, mid, view) === front) {
      const [x, y] = onScreen(view, p);
      glint(g, x, y, 0.05 * big, 1 - dt / 0.4);
    }
  }
}

/** Evolving: a burst of little bubbles off it at the start, then bubbles and glints swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Gecko, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], B = s.body;
  const burst = 1 - ramp(t, 0.1, 0.26);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 24; q++) {
      const th = (q / 24) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * B.w[3] * 0.6, Math.sin(th) * s.len * 0.45, B.h[3] * 0.7]);
      const v: V3 = [Math.cos(th) * (1.4 + 1.4 * jitter(q + 3)), Math.sin(th) * (1.4 + 1.4 * jitter(q + 5)), 2 + 2 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 2);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 3) bead(g, x, y, 0.08 * big, BEAD_RGB[q % BEAD_RGB.length], burst * ramp(t, 0, 0.03));
      else glint(g, x, y, 0.04 * big, burst * ramp(t, 0, 0.03));
    }
  }
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl > 0) {
    const rx = B.w[3] * 1.5 + 0.3 * big, ry = s.len * 0.85 + 0.3 * big, high = B.h[3] * 2.4 + 1.0 * big;
    for (let q = 0; q < 18; q++) {
      const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32);
      const ang = (q / 18) * TAU + u * TAU * 1.4;
      const k = (1 - u) ** 1.2;
      const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -B.h[3] * 0.4 + u * high * 0.7]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 3) bead(g, x, y, 0.09 * big * (1 - 0.4 * u), BEAD_RGB[q % BEAD_RGB.length], swirl * ramp(u, 0, 0.15));
      else glint(g, x, y, 0.04 * big, swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function geckoKind(s: Gecko): Kind {
  const bones = geckoBones(s);
  return {
    bones,
    build: (lod) => geckoBuild(s, lod),
    // The variant's colour its scales, its markings the ivory of its throat, belly and flanks; its speckles, pads, eyes and glass
    // the same on every variant.
    palette: (coat, mark) => {
      const scales = mix(coat, pastel(coat, 160), 0.2), ivory = mix(mark, [255, 246, 228], 0.25);
      return coatPalette(coat, mark, {
        coat: scales,
        coatDark: mix(scales, [70, 150, 140], 0.22),
        coatLight: mix(scales, [250, 255, 246], 0.32),
        mark: ivory,
        belly: ivory,
        muzzle: mix(ivory, [255, 252, 244], 0.5),
        inner: [240, 150, 140],
        tongue: [244, 140, 150],
        lid: [176, 98, 52],
        nose: [150, 88, 60],
        eye: [28, 16, 12],
        eyeWhite: [255, 252, 248],
        glint: [255, 254, 250],
        crystal: [238, 150, 64],
        crystalDark: [92, 50, 30],
        // Peach and coral speckles, and the coral of its rump.
        spot: [248, 168, 120],
        shell: [248, 156, 134],
        shellDark: [238, 132, 118],
        pad: [248, 168, 98],
        // Its glass, in pastel bands: pink, butter, mint, sky and lilac.
        // Each a little under full, so the side of a bubble in the light keeps its colour rather than going to white.
        bloom: [232, 142, 178],
        petal: [234, 196, 112],
        water: [112, 192, 178],
        membrane: [144, 180, 226],
        cap: [190, 160, 226],
        ember: [255, 130, 34],
        flame: [255, 210, 110],
        stone: [178, 170, 160],
        stoneDark: [116, 106, 100],
      } as Partial<ReturnType<Kind['palette']>>, 160);
    },
    shadow: [s.len * 0.8 + s.tail.links.reduce((x, y) => x + y, 0) * 0.12, s.body.w[3] * 1.35],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    motes: [[255, 206, 222], [196, 238, 226]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      glassBubbles(g, view, s, b, a, front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const GLIMMIP = geckoKind(GLIMMIP_LOOK);
export const GLASCADE = geckoKind(GLASCADE_LOOK);
export const PRISMETAIL = geckoKind(PRISMETAIL_LOOK);
