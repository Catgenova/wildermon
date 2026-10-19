import {
  ACT_SECS, add, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, LOOP, merge, mirrored, mix, orb, orbAlong, paint, pastel, scale,
  smooth, sub, taper, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The ghost line: the Whispet, a round little pearly ghost with two nub arms,
 * a curl of lilac on its head and a wisp of a tail curling up behind it like a
 * flame; which grows into the Lanternveil, a sheet of a ghost with a wide wavy
 * hem of lilac curls, its arms up, in a purple witch's hat with a drooping tip,
 * a ragged speckled brim and a jack-o'-lantern on its band; and then the
 * Hallowmire, tall, in a long tattered veil layered over itself and hung with
 * tendrils, long curling tendrils spread wide at its sides, under a huge torn
 * witch's hat with three jack-o'-lanterns on its band and brass lanterns of
 * amber light hanging from its brim on thin chains. The species is `whispet`.
 *
 * All three float: there are no feet, and the body hovers at a height of its
 * own with a slow bob, leaning into the way it drifts. What hangs off it -- its
 * hem and its curls, a tail, a hat's tip, tendrils, lanterns on their chains --
 * is not posed but trails: each follows where the body was a moment ago
 * (`lagged`), so it streams behind a drift, swings after a swoop and settles
 * after a blow by itself. All three are built by one set of functions from a
 * description of the stage (`Ghost`), so a stage is its numbers.
 *
 * It strikes (the Whispet darts in and bumps, the Lanternveil rears and swipes
 * down with its arms and its brim, the Hallowmire lashes out with its tendrils
 * and its lanterns flare), and every so often uses its Fear (`cast`, the act a
 * wildermon plays when it uses its ability): it swells up big, its eyes blaze
 * amber, it opens its mouth in a "boo", and a ring of violet goes out over the
 * ground and through the air round it with spectral wisps bursting out.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Ghost {
  stage: 0 | 1 | 2;
  size: number;
  /** How high the middle of the body (its bone) floats over the ground at rest. */
  high: number;
  /** The body's rings in its own frame, bottom to top: how high, how wide across, how deep, how far forward. */
  body: { z: number[]; w: number[]; h: number[]; y: number[] };
  /**
   * The hem: under `top` (in the body's frame) a ring is hem, lavender, and trails, fully by `low`; scalloped into `lobes`, each
   * dipping `dip` and the hem flaring `flare` between them; `curls` of lilac curling out off its sides, `curl` across; and, torn,
   * cut into ragged points `jag` deep.
   */
  hem: { top: number; low: number; lobes: number; dip: number; flare: number; curls: number; curl: number; jag: number };
  /** The face: the eyes' height, how far round from the front, how big and how tall; the mouth's height and width; blush; a shadow under a brim. */
  face: { z: number; turn: number; size: number; tall: number; mouth: number; mouthW: number; blush: number; shade: boolean; hush?: boolean };
  /** Nub arms: the shoulder on the right, how long, how thick at the root and the end, and how they are carried (forward, out); raised, or out at its sides. */
  arms?: { at: V3; len: number; w: [number, number]; rest: [number, number]; up: boolean };
  /** A wisp of a tail sweeping up behind it (`Strand`), in the body's frame. */
  tail?: Strand;
  /** A curl of lilac on the crown of its head. */
  tuft?: Strand;
  /**
   * The witch's hat: where its brim sits on the head, the brim's reach and droop, the crown's foot and height, its tip's reach out
   * to its right past the crown's top and how many turns it curls through, tilt (back, to its right), torn, its pumpkins and leaves.
   */
  hat?: {
    at: V3; brim: number; droop: number; foot: number; tall: number; reach: number; turns: number; tilt: [number, number];
    torn: boolean; pumpkins: number; leaves: number;
  };
  /** The outer veil over its shoulders: its top and bottom, how far out over the body, and how many torn points round its edge. */
  cape?: { top: number; low: number; out: number };
  /** A long tendril spread out at its right side (`Strand`), its root at the shoulder; the left is its mirror. */
  tendril?: Strand;
  /** Lanterns on chains, hung from the brim: round from the front (degrees, to its left positive), how far out on the brim, how long the chain; and how big. */
  lanterns?: Array<{ th: number; out: number; chain: number }>;
  lamp: number;
  /** How it goes: bob at rest, bob a stride walking and running, lean walking and running (degrees), sway, and whether it bounces. */
  gait: { bob: number; walk: number; run: number; lean: [number, number]; sway: number; bounce: boolean };
  /** How far it swells as it frightens. */
  fear: number;
  /** Its mid-air flourish standing: a loop-de-loop, or a spin; when in the loop, and how long. */
  flourish: { kind: 'loop' | 'spin'; at: number; len: number };
  /** When its strike lands. */
  hit: number;
}

/**
 * Something long and soft that trails off it -- a tail, a tendril, a hat's tip: a smooth line through `pts` in the frame it hangs
 * in, `w` thick at each (in step, between them), as deep as `flat` of that, its flat side facing along `up`; its colours from root
 * to end. It bends along its whole length as it trails (`bendStrand`).
 */
interface Strand { pts: V3[]; w: number[]; flat: number; up?: V3; mats: Mat[] }

/**
 * The Whispet's tail: a lick of flame up off its lower back, narrow where it leaves the body and widest just past it, rising
 * behind its head and curling forward over itself in most of a turn, narrowing to a point.
 */
function flameTail(): Strand {
  const pts: V3[] = [[0.22, -0.72, -0.42], [0.32, -1.1, -0.2], [0.44, -1.34, 0.22], [0.52, -1.36, 0.6]];
  const w = [0.36, 0.44, 0.4, 0.34];
  // The curl: round a middle behind its head, starting at its back and going up, over and forward and down, drawing in; turned
  // a third of the way toward its right, so it is a curl from behind as well as from the side.
  const c: V3 = [0.6, -1.08, 0.82], r0 = 0.27, turns = 0.9, steps = 8, e1 = unit([0.5, 0.87, 0]);
  for (let q = 0; q <= steps; q++) {
    const f = q / steps, th = (150 - f * turns * 360) * DEG, r = r0 * (1 - 0.6 * f);
    pts.push(add(c, add(scale(e1, Math.cos(th) * r), [0, 0, Math.sin(th) * r])));
    w.push(lerp(0.28, 0.02, f ** 0.85));
  }
  return { pts, w, flat: 0.6, up: [0.87, 0.5, 0], mats: ['feather', 'mark', 'mark', 'mark', 'mark', 'featherDark', 'featherDark'] };
}

/** A Whispet: a round pearly blob, flippers out at its sides, a lilac curl on its head and a flame of a tail sweeping up behind it. */
const WHISPET_LOOK: Ghost = {
  stage: 0,
  size: 2.2,
  high: 1.72,
  body: {
    z: [-0.94, -0.9, -0.76, -0.48, -0.12, 0.22, 0.5, 0.72, 0.87, 0.96],
    w: [0.0, 0.66, 1.1, 1.34, 1.4, 1.35, 1.17, 0.88, 0.52, 0.0],
    h: [0.0, 0.6, 1.0, 1.22, 1.28, 1.24, 1.08, 0.8, 0.48, 0.0],
    y: [-0.12, -0.12, -0.1, -0.05, 0, 0.02, 0.02, 0, 0, 0],
  },
  hem: { top: -0.05, low: -0.92, lobes: 3, dip: 0.1, flare: 0.06, curls: 0, curl: 0, jag: 0 },
  face: { z: 0.14, turn: 23, size: 0.25, tall: 1.32, mouth: -0.22, mouthW: 0.44, blush: 0.3, shade: false },
  arms: { at: [1.3, 0.12, -0.05], len: 0.62, w: [0.36, 0.2], rest: [0, 15], up: false },
  tail: flameTail(),
  tuft: {
    pts: [[-0.04, 0.06, 0.84], [-0.03, 0.07, 0.96], [0.03, 0.04, 1.03], [0.12, -0.02, 1.05], [0.18, -0.06, 0.99], [0.12, -0.07, 0.94]],
    w: [0.1, 0.09, 0.07, 0.05, 0.03, 0.012], flat: 0.75, up: [1, 0, 0], mats: ['feather', 'mark', 'mark', 'featherDark'],
  },
  lamp: 1,
  gait: { bob: 0.12, walk: 0.32, run: 0.4, lean: [9, 17], sway: 3, bounce: true },
  fear: 0.4,
  flourish: { kind: 'loop', at: 8.0, len: 2.8 },
  hit: 0.5,
};

/** A Lanternveil: a sheet of a ghost with a wide wavy hem of lilac curls, its nub arms raised, in a purple witch's hat with a jack-o'-lantern badge. */
const LANTERNVEIL_LOOK: Ghost = {
  stage: 1,
  size: 1.95,
  high: 2.55,
  body: {
    z: [-1.52, -1.42, -1.14, -0.7, -0.2, 0.32, 0.8, 1.16, 1.42, 1.58, 1.64],
    w: [2.2, 2.22, 1.96, 1.6, 1.36, 1.24, 1.16, 1.0, 0.72, 0.36, 0.0],
    h: [1.96, 1.98, 1.78, 1.48, 1.28, 1.16, 1.08, 0.94, 0.68, 0.34, 0.0],
    y: [-0.2, -0.2, -0.16, -0.08, -0.02, 0, 0.02, 0.02, 0, 0, 0],
  },
  hem: { top: -0.4, low: -1.52, lobes: 6, dip: 0.26, flare: 0.08, curls: 5, curl: 0.82, jag: 0 },
  face: { z: 0.7, turn: 23, size: 0.27, tall: 1.3, mouth: 0.3, mouthW: 0.42, blush: 0.32, shade: false },
  arms: { at: [1.16, 0.16, 0.38], len: 0.66, w: [0.32, 0.29], rest: [8, 40], up: true },
  hat: { at: [0, -0.1, 1.44], brim: 1.9, droop: 0.2, foot: 0.78, tall: 1.6, reach: 1.2, turns: 0.9, tilt: [15, 10], torn: false, pumpkins: 1, leaves: 5 },
  lamp: 1,
  gait: { bob: 0.1, walk: 0.14, run: 0.2, lean: [8, 15], sway: 4, bounce: false },
  fear: 0.26,
  flourish: { kind: 'spin', at: 14.0, len: 5.2 },
  hit: 0.5,
};

/**
 * A Hallowmire: tall, its long veil spreading wide at its foot, torn, with a second torn veil over its shoulders, curls of lilac off
 * its hem and two long tendrils spread out wide at its sides, curling at their ends; under a huge torn witch's hat with a band of
 * leaves and three jack-o'-lanterns, brass lanterns hanging from the brim on chains and one longer, lower down beside it.
 */
const HALLOWMIRE_LOOK: Ghost = {
  stage: 2,
  size: 2.2,
  high: 4.3,
  body: {
    z: [-3.1, -2.96, -2.44, -1.66, -0.76, 0.12, 0.9, 1.5, 1.94, 2.28, 2.48, 2.56],
    w: [2.86, 2.88, 2.5, 2.0, 1.6, 1.34, 1.22, 1.16, 1.0, 0.72, 0.36, 0.0],
    h: [2.58, 2.6, 2.26, 1.8, 1.44, 1.2, 1.1, 1.06, 0.92, 0.66, 0.34, 0.0],
    y: [-0.3, -0.3, -0.24, -0.14, -0.06, 0, 0.02, 0.04, 0.03, 0.01, 0, 0],
  },
  hem: { top: -1.2, low: -3.1, lobes: 9, dip: 0.3, flare: 0.06, curls: 7, curl: 1.04, jag: 0.7 },
  face: { z: 1.46, turn: 22, size: 0.29, tall: 1.5, mouth: 0.98, mouthW: 0.36, blush: 0.0, shade: true, hush: true },
  hat: { at: [0, -0.12, 2.2], brim: 3.05, droop: 0.32, foot: 1.28, tall: 2.6, reach: 2.0, turns: 1.3, tilt: [18, 8], torn: true, pumpkins: 3, leaves: 8 },
  cape: { top: 0.7, low: -1.1, out: 0.14 },
  tendril: {
    pts: [[1.08, 0.0, 0.4], [1.66, -0.14, 0.02], [2.16, -0.26, -0.58], [2.56, -0.34, -1.24], [2.98, -0.4, -1.74], [3.48, -0.42, -1.86], [3.78, -0.4, -1.56], [3.7, -0.36, -1.2], [3.44, -0.32, -1.15], [3.38, -0.3, -1.36], [3.5, -0.3, -1.44]],
    w: [0.4, 0.42, 0.4, 0.36, 0.3, 0.24, 0.18, 0.13, 0.09, 0.05, 0.02], flat: 0.42, up: [0, 1, 0], mats: ['coat', 'feather', 'mark', 'mark', 'mark', 'featherDark', 'featherDark'],
  },
  lanterns: [{ th: -42, out: 0.86, chain: 1.3 }, { th: -104, out: 0.96, chain: 2.2 }, { th: 64, out: 1.0, chain: 3.4 }, { th: 172, out: 0.9, chain: 1.1 }],
  lamp: 1.45,
  gait: { bob: 0.09, walk: 0.12, run: 0.24, lean: [6, 16], sway: 3, bounce: false },
  fear: 0.16,
  flourish: { kind: 'spin', at: 15.0, len: 7.5 },
  hit: 0.55,
};

/* ---- small things -------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a fringe is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A soft limit: about `x` while small, never past `k`. */
const soft = (x: number, k: number): number => k * Math.tanh(x / k);

/** A bone's frame stretched along its own three axes. */
function stretched(x: Xf, k: V3): Xf {
  const m = x.m;
  return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]] as Xf['m'], t: x.t };
}
/** A point in the world back into a bone's own frame (its turn undone, and its stretch). */
function into(x: Xf, p: V3): V3 {
  const m = x.m, d = sub(p, x.t);
  // The columns are the frame's axes, each as long as it is stretched.
  const out: V3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const ax: V3 = [m[c], m[3 + c], m[6 + c]];
    const l2 = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2] || 1;
    out[c] = (d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]) / l2;
  }
  return out;
}
/** Faces wound so each looks the way it should, whichever way round its corners were listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let a = 0; a < idx.length; a++) {
      const p = v[idx[a]], r = v[idx[(a + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/** A shape painted on a surface, its corners wound so it faces out along `n`. */
function facing(v: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let a = 0; a < v.length; a++) {
    const p = v[a], r = v[(a + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v, m };
}

/** A shape painted flat on a surface at `c`, facing `n`: its corners `pts`, across and up, in units of `k`. */
function flat(c: V3, n: V3, pts: ReadonlyArray<readonly [number, number]>, k: number, m: Mat, lit?: boolean): Disc {
  const d = unit(n);
  let u = cross([0, 0, 1], d);
  if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = [1, 0, 0];
  u = unit(u);
  const w = cross(d, u);
  return { ...facing(pts.map(([x, y]) => add(c, add(scale(u, x * k), scale(w, y * k)))), d, m), lit };
}

/* ---- the body's surface ----------------------------------------------------------------- */

/** The body's ring at a height: how wide, how deep and how far forward, between the rings either side. */
function ringAt(s: Ghost, z: number): [number, number, number] {
  const B = s.body, n = B.z.length;
  if (z <= B.z[0]) return [B.w[0], B.h[0], B.y[0]];
  for (let k = 1; k < n; k++) {
    if (z <= B.z[k]) {
      const f = (z - B.z[k - 1]) / (B.z[k] - B.z[k - 1]);
      return [lerp(B.w[k - 1], B.w[k], f), lerp(B.h[k - 1], B.h[k], f), lerp(B.y[k - 1], B.y[k], f)];
    }
  }
  return [B.w[n - 1], B.h[n - 1], B.y[n - 1]];
}
/** A point on the body at a height and round from its right (`phi`, radians; the front is a quarter turn), and the way out of it. */
function onBody(s: Ghost, z: number, phi: number): { p: V3; n: V3 } {
  const [w, h, y] = ringAt(s, z);
  const e = 0.02;
  const [w1, h1, y1] = ringAt(s, z + e), [w0, h0, y0] = ringAt(s, z - e);
  const c = Math.cos(phi), si = Math.sin(phi);
  const dphi: V3 = [-w * si, h * c, 0];
  const dz: V3 = [((w1 - w0) / (2 * e)) * c, (y1 - y0) / (2 * e) + ((h1 - h0) / (2 * e)) * si, 1];
  return { p: [w * c, y + h * si, z], n: unit(cross(dphi, dz)) };
}

/* ---- strands: what trails ----------------------------------------------------------------- */

/** A smooth line through points (Catmull-Rom), `per` steps from each to the next. */
function smoothLine(pts: readonly V3[], per: number): V3[] {
  const out: V3[] = [];
  const P = (i: number): V3 => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let q = 0; q < per; q++) {
      const t = q / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as V3);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** The same for a number at each point: eased from one to the next. */
const smoothNums = (xs: readonly number[], per: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) for (let q = 0; q < per; q++) out.push(lerp(xs[i], xs[i + 1], q / per));
  out.push(xs[xs.length - 1]);
  return out;
};

/** A strand as a mesh: a tube along its smooth line, and the line, for bending it (`bendStrand`). */
interface Laid { mesh: Mesh; line: V3[]; per: number }
const STRAND_STEPS = 3;
function strandMesh(S: Strand, n: number, o: { seam?: 'start' | 'end' | 'both'; mat?: (ring: number, j: number, rings: number) => Mat } = {}): Laid {
  const line = smoothLine(S.pts, STRAND_STEPS), ws = smoothNums(S.w, STRAND_STEPS), K = line.length;
  const mat = (ring: number, j: number): Mat => o.mat?.(ring, j, K) ?? S.mats[Math.min(S.mats.length - 1, Math.floor((ring / (K - 1)) * S.mats.length))];
  return { mesh: tube(line, ws, ws.map((w) => w * S.flat), n, mat, { up: S.up, seam: o.seam }), line, per: n };
}

type M3 = [number, number, number, number, number, number, number, number, number];
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul3 = (A: M3, B: M3): M3 => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
];
const app3 = (A: M3, v: V3): V3 => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
/** A turn by the vector `r`: about its direction, by its length in radians. */
function rodrigues(r: V3): M3 {
  const th = Math.hypot(r[0], r[1], r[2]);
  if (th < 1e-7) return I3;
  const [x, y, z] = [r[0] / th, r[1] / th, r[2] / th], c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}

/**
 * A strand's corners bent: each ring of it turned by `rot[k]` on top of every turn before it, from its root out, so the whole
 * line curves smoothly rather than kinking at joints, and every ring carried round with it.
 */
function bendStrand(v: readonly V3[], L: { line: V3[]; per: number }, rot: readonly V3[]): V3[] {
  const K = L.line.length, Q: V3[] = [L.line[0]], R: M3[] = [];
  let acc = I3;
  for (let k = 0; k < K; k++) {
    acc = mul3(acc, rodrigues(rot[k] ?? [0, 0, 0]));
    R.push(acc);
    if (k + 1 < K) Q.push(add(Q[k], app3(acc, sub(L.line[k + 1], L.line[k]))));
  }
  return v.map((p, i) => {
    const k = Math.min(K - 1, Math.floor(i / L.per));
    return add(Q[k], app3(R[k], sub(p, L.line[k])));
  });
}
/** Only the line of a strand, bent as its mesh would be: where its end is, for what comes off it. */
const bentLine = (L: { line: V3[]; per: number }, rot: readonly V3[]): V3[] => bendStrand(L.line, { line: L.line, per: 1 }, rot);

/**
 * How a strand bends this moment: trailing after where it was a moment ago (`d`, how far its end has been left behind, in the frame
 * it hangs in), spread along its length; a slow wave down it of its own; and a turn at its root and a curl toward its end for
 * whatever it is doing. `from` is how far along it the bending starts (a hat's tip bends, its crown does not).
 */
function strandRot(line: readonly V3[], o: { d: V3; gain: number; wave?: { axis: V3; amp: number; ph: number }; root?: V3; curl?: V3; from?: number }): V3[] {
  const K = line.length, from = Math.round((o.from ?? 0) * (K - 1)), span = Math.max(1, K - 1 - from);
  const dir = unit(sub(line[K - 1], line[from])), len = Math.max(0.3, Math.hypot(...sub(line[K - 1], line[from])));
  const dp = sub(o.d, scale(dir, dot(o.d, dir))), dl = Math.hypot(dp[0], dp[1], dp[2]);
  const ang = soft((dl * o.gain) / len, 1.1), axis = dl > 1e-6 ? unit(cross(dir, dp)) : ([0, 0, 0] as V3);
  const out: V3[] = [];
  for (let k = 0; k < K; k++) {
    if (k <= from) { out.push(k === 0 && o.root ? o.root : [0, 0, 0]); continue; }
    const f = (k - from) / span;
    let r = scale(axis, ang / span);
    if (o.wave) r = add(r, scale(o.wave.axis, (o.wave.amp * Math.sin(o.wave.ph - f * 4) * (0.4 + f)) / span));
    if (o.curl) r = add(r, scale(o.curl, (2 * f) / span));
    out.push(k === from + 1 && from > 0 && o.root ? add(r, o.root) : r);
  }
  return out;
}

/* ---- the pose ----------------------------------------------------------------------------- */

/** Everything a body's bones are turned by, this moment. */
interface Pose {
  /** The body moved from where it floats, in the ground's frame, and turned (degrees: nose up, roll to its right, yaw to its left). */
  x: number; y: number; z: number; pitch: number; roll: number; yaw: number;
  /** Swollen (one as built), and stretched along its own axes. */
  k: number; st: V3;
  /** The arms: raised and swung forward past how they are carried, and spread. */
  arm: [number, number, number];
  /** The tail lifted and swung; the hat tipped forward and to its right past its tilt; how far grown the hat and the lanterns are. */
  tail: [number, number]; hat: [number, number]; grow: number; lamps: number;
  /** The hem flared out, how hard its curls ripple; the tendrils raised, swung forward, curled. */
  flare: number; ripple: number; tend: [number, number, number];
  /** The mouth open in a "boo", the eyes blazing; how far it is going (and so streaming), and at what gait. */
  boo: number; blaze: number; go: number; gait: number;
}

/** Where the flourish standing is, nought to one through it, eased; and its bump, nought at either end. */
function flourishOf(s: Ghost, t: number): { k: number; on: number } {
  const F = s.flourish, u = (frac((t - F.at) / LOOP) * LOOP) / F.len;
  if (u <= 0 || u >= 1) return { k: 0, on: 0 };
  // Eased in and out more gently than a smoothstep, so it never turns faster than half again its mean rate.
  const k = u - Math.sin(u * TAU) / TAU;
  return { k, on: Math.sin(u * Math.PI) };
}

/** Standing: hovering and bobbing, swaying a little, looking about; now and then its flourish. */
function still(s: Ghost, a: Anim, p: Pose): void {
  const t = a.t, G = s.gait;
  p.z += G.bob * (cyc(t, 5) + 0.25 * cyc(t, 11, 1.3));
  p.roll += 2.2 * cyc(t, 3, 0.4);
  p.pitch += 1.6 * cyc(t, 4, 1.1);
  p.yaw += 7 * (cyc(t, 1, 0.3) * 0.6 + cyc(t, 2, 1.7) * 0.4);
  p.arm[0] += 6 * cyc(t, 6, 0.5);
  p.arm[2] += 4 * cyc(t, 4, 2.1);
  p.tail[1] += 8 * cyc(t, 4, 0.8);
  p.tend[0] += 6 * cyc(t, 5, 0.9);
  p.tend[1] += 5 * cyc(t, 3, 2.2);
  p.tend[2] += 8 * cyc(t, 6, 0.2);
  const f = flourishOf(s, t);
  if (f.on > 0) {
    if (s.flourish.kind === 'loop') {
      // A loop-de-loop: forward and up, over on its back at the top, and down again where it started.
      const th = f.k * TAU, R = 0.62;
      p.y += R * Math.sin(th);
      p.z += R * (1 - Math.cos(th));
      p.pitch += f.k * 360;
      p.arm[2] += 26 * f.on;
    } else {
      // A spin, one whole turn, its hem flaring out with it.
      p.yaw += f.k * 360;
      p.z += 0.2 * f.on;
      p.flare += 0.08 * f.on;
      p.tend[0] += 14 * f.on;
    }
    p.ripple += 0.6 * f.on;
  }
}

/**
 * Going: drifting, leaning into it. The Whispet bobs and bounces, squashed at the bottom of each and drawn out at the top; the
 * Lanternveil glides, swaying; the Hallowmire sweeps along slowly. At a run it swoops, stretched out along the way it goes.
 */
function going(s: Ghost, a: Anim, p: Pose): void {
  const w = frac(a.u), g = a.gait, G = s.gait;
  const amp = lerp(G.walk, G.run, g);
  if (G.bounce) {
    // A bounce: down to a soft bottom once a stride, never a jolt.
    const up = 0.5 - 0.5 * Math.cos(w * TAU);
    p.z += amp * (up - 0.5) * 2 * 0.5;
    p.st = [p.st[0] * (1 + 0.05 * (0.5 - up)), p.st[1] * (1 + 0.04 * (0.5 - up)), p.st[2] * (1 - 0.07 * (0.5 - up))];
    p.pitch += 5 * Math.sin(w * TAU);
    p.arm[0] += 14 * Math.sin(w * TAU - 0.6);
  } else {
    p.z += amp * Math.sin(w * TAU);
    p.roll += G.sway * Math.sin(w * TAU + 0.4);
    p.yaw += G.sway * 0.6 * Math.cos(w * TAU);
    p.arm[0] += 6 * Math.sin(w * TAU - 1);
  }
  p.pitch -= lerp(G.lean[0], G.lean[1], g);
  p.st = [p.st[0] * (1 - 0.04 * g), p.st[1] * (1 + 0.12 * g), p.st[2] * (1 - 0.04 * g)];
  p.z += 0.12 * g;
  p.tail[0] -= 12 + 10 * g;
  p.tend[1] -= 14 + 12 * g;
  p.tend[0] += 6;
  p.ripple += 0.35 + 0.35 * g;
  p.arm[2] -= 10 * g;
}

/**
 * One thing a strike moves, through the strike: out to `back` in its wind-up (eased, there by `ready`); then, from `from`, over to
 * `at` by `hit`, speeding up all the way, so the blow lands at its fastest rather than coming to rest on what it hits; a short
 * overshoot past it, carried on by the speed it arrived with and settling within a tenth of the strike; and then slowly back to
 * rest by its end.
 */
function blow(t: number, ready: number, from: number, hit: number, back: number, at: number): number {
  const wind = back * ramp(t, 0.02, ready);
  if (t < hit) {
    const k = clamp((t - from) / (hit - from)), go = k * k;
    return wind * (1 - go) + at * go;
  }
  const u = (t - hit) / 0.1;
  if (u < 1) {
    // The overshoot keeps the speed it arrived with: (at - back) * 2 / (hit - from) a strike, over a tenth of one.
    const v = ((2 * (at - back)) / (hit - from)) * (0.1 / Math.PI);
    return at + v * (1 - u) * Math.sin(Math.PI * u);
  }
  return at * (1 - ramp(t, hit + 0.1, 1));
}

/**
 * A strike, laid over whatever it is doing. Each lifts itself as it winds up and drops onto the blow, which is what is seen of it from
 * behind; the Whispet darts in and bumps, the Lanternveil rears up and sweeps its arms and its brim down across in front of it, the
 * Hallowmire draws its tendrils back and lashes them out forward.
 */
function strikePose(s: Ghost, t: number, p: Pose): void {
  const hit = s.hit;
  if (s.stage === 0) {
    const B = (back: number, at: number): number => blow(t, 0.2, 0.18, hit, back, at);
    const back = ramp(t, 0.03, 0.2) * (1 - ramp(t, 0.22, hit));
    const bump = hump(t, hit + 0.04, 0.09);
    p.y += B(-0.26, 0.6);
    p.z += B(0.25, -0.1);
    p.pitch += B(8, -14) + 6 * bump;
    p.st = [p.st[0] * (1 + 0.08 * back + 0.12 * bump), p.st[1] * (1 - 0.06 * back - 0.08 * bump), p.st[2] * (1 - 0.08 * back - 0.1 * bump)];
    p.arm[0] += B(-10, 30);
    p.arm[2] += B(0, -16);
    p.tail[0] += B(9, -8);
    return;
  }
  if (s.stage === 1) {
    const B = (back: number, at: number): number => blow(t, 0.3, 0.1, hit, back, at);
    // Its hem kept off the ground as it pitches forward over it.
    p.z += B(0.4, 0.05);
    p.y += B(-0.14, 0.42);
    p.pitch += B(9, -12);
    p.arm[0] += B(-14, 36);
    p.arm[2] += B(10, -22);
    p.hat[0] += B(-4, 8);
    p.flare += B(0.05, 0);
    p.ripple += 0.5 * Math.abs(B(1, 1));
    return;
  }
  const B = (back: number, at: number): number => blow(t, 0.34, 0.15, hit, back, at);
  p.z += B(0.3, -0.1);
  p.y += B(-0.1, 0.3);
  p.pitch += B(4, -5);
  p.tend[0] += B(10, -3);
  p.tend[1] += B(-12, 12);
  p.tend[2] += B(10, -8);
  p.hat[0] += B(-2, 4);
  p.ripple += 0.4 * Math.abs(B(1, 1));
}

/** Its Fear: drawn in, then swelling up big with its arms flung out, eyes blazing and mouth open in a "boo"; held; settling back. */
export const GHOST_FEAR = { gather: 0.2, swell: 0.38, out: 0.36, hold: 0.56, done: 0.92 } as const;
function fearPose(s: Ghost, t: number, p: Pose): void {
  const F = GHOST_FEAR;
  const gather = ramp(t, 0.02, F.gather) * (1 - ramp(t, F.gather - 0.02, F.swell));
  const big = ramp(t, F.gather - 0.1, F.swell + 0.1) * (1 - ramp(t, F.hold, F.done));
  p.k *= 1 - 0.05 * gather + s.fear * big;
  // Swollen about its middle, so lifted by as much as that would take its hem down, and a little more: it rears up as it grows.
  p.z += 0.05 * s.body.z[0] * gather + (s.fear * -s.body.z[0] + 0.12) * big;
  p.pitch += 4 * gather - 3 * big;
  // Its arms flung open to its sides, not at whoever it frightens, where they would be lost against its front.
  p.arm[0] += -14 * gather + 20 * big;
  p.arm[2] += -18 * gather + 55 * big;
  p.tend[0] += -5 * gather + 12 * big;
  p.tend[2] += 5 * gather - 9 * big;
  p.tail[0] += 10 * gather - 14 * big;
  p.hat[0] += 2 * gather - 2 * big;
  p.flare += -0.04 * gather + 0.14 * big;
  p.ripple += 0.9 * big;
  p.boo = ramp(t, F.gather + 0.02, F.swell + 0.02) * (1 - ramp(t, F.hold - 0.04, F.done - 0.06));
  p.blaze = ramp(t, F.gather, F.swell) * (1 - ramp(t, F.hold, F.done));
}

/** Evolving: the hat and the lanterns grow in on it out of the light, and it rises a little and swells at the flash. */
function evolvePose(s: Ghost, t: number, p: Pose): void {
  // Into a Hallowmire, out of the Lanternveil's hat: it starts at that hat's size, under the mist, and grows from there.
  p.grow = (s.stage === 2 ? lerp(0.6, 1, ramp(t, 0.1, 0.56)) : ramp(t, 0.1, 0.56)) * (1 + 0.06 * hump(t, 0.6, 0.12));
  p.lamps = ramp(t, 0.24, 0.68);
  p.z += 0.3 * ramp(t, 0.05, 0.45) * (1 - ramp(t, 0.6, 0.92));
  p.k *= 1 + 0.06 * hump(t, 0.5, 0.14);
  p.arm[0] += 30 * ramp(t, 0.3, 0.5) * (1 - ramp(t, 0.62, 0.92));
  p.ripple += 0.5 * hump(t, 0.5, 0.35);
}

/** The pose for what it is doing this moment. */
function poseOf(s: Ghost, a: Anim): Pose {
  const p: Pose = {
    x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0, k: 1, st: [1, 1, 1], arm: [0, 0, 0], tail: [0, 0], hat: [0, 0], grow: 1, lamps: 1,
    flare: 0, ripple: 0, tend: [0, 0, 0], boo: 0, blaze: 0, go: a.go, gait: a.gait,
  };
  if (a.go < 1) {
    const q: Pose = { ...p, st: [1, 1, 1], arm: [0, 0, 0], tail: [0, 0], hat: [0, 0], tend: [0, 0, 0] };
    still(s, a, q);
    mixInto(p, q, 1 - smooth(a.go));
  }
  if (a.go > 0) {
    const q: Pose = { ...p, st: [1, 1, 1], arm: [0, 0, 0], tail: [0, 0], hat: [0, 0], tend: [0, 0, 0] };
    going(s, a, q);
    mixInto(p, q, smooth(a.go));
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, act.t, p);
  else if (act?.kind === 'cast' || act?.kind === 'work') fearPose(s, act.kind === 'work' ? frac(act.t) : act.t, p);
  else if (act?.kind === 'evolve') evolvePose(s, act.t, p);
  return p;
}
/** `q`'s difference from rest added into `p`, `k` of it. */
function mixInto(p: Pose, q: Pose, k: number): void {
  p.x += q.x * k; p.y += q.y * k; p.z += q.z * k; p.pitch += q.pitch * k; p.roll += q.roll * k; p.yaw += q.yaw * k;
  p.st = [p.st[0] * lerp(1, q.st[0], k), p.st[1] * lerp(1, q.st[1], k), p.st[2] * lerp(1, q.st[2], k)];
  for (let i = 0; i < 3; i++) { p.arm[i] += q.arm[i] * k; p.tend[i] += q.tend[i] * k; }
  p.tail = [p.tail[0] + q.tail[0] * k, p.tail[1] + q.tail[1] * k];
  p.flare += q.flare * k;
  p.ripple += q.ripple * k;
}

/** The same moment as `a`, `secs` earlier: what what trails off the body follows. A go played once is at rest before it began. */
function lagged(a: Anim, secs: number): Anim {
  const b: Anim = { ...a, t: a.t - secs, u: a.u - secs * 1.6 };
  if (a.act) {
    // A go played once is over at its end, and then nothing of it trails: so over its last stretch what trails catches up with it,
    // and at its end is where it is, at rest.
    const fade = a.act.kind === 'work' ? 1 : smooth((1 - a.act.t) / 0.55);
    const t = a.act.t - (secs / ACT_SECS[a.act.kind]) * fade;
    // Evolving, the body before it began is the new one at rest, as it is drawn from the act's first frame: held there.
    b.act = a.act.kind === 'work' ? { kind: 'work', t: frac(t) } : t > 0 ? { kind: a.act.kind, t } : a.act.kind === 'evolve' ? { kind: 'evolve', t: 0 } : undefined;
  }
  return b;
}

/** The body's bone in a pose: floated, turned, swollen and stretched. Its middle stays where it floats, whatever it is doing. */
function bodyXf(s: Ghost, p: Pose): Xf {
  const b = joint(ROOT, [p.x, p.y, s.high + p.z], p.pitch, p.roll, p.yaw);
  return stretched(b, [p.k * p.st[0], p.k * p.st[1], p.k * p.st[2]]);
}
function hatXf(s: Ghost, body: Xf, p: Pose): Xf | null {
  if (!s.hat) return null;
  // Swelling, the hat swells half as much as the body does: a tall hat swollen whole swings its tip a long way, fast.
  const H = s.hat, g = Math.max(0.002, p.grow) * (1 + 0.5 * (p.k - 1)) / p.k;
  return stretched(joint(body, H.at, H.tilt[0] + p.hat[0], H.tilt[1] + p.hat[1]), [g, g, g]);
}

/** Where a lantern's chain hangs from, on the brim, in the hat's frame. */
function lampAt(s: Ghost, q: number): V3 {
  const H = s.hat!, L = s.lanterns![q];
  const r = H.brim * L.out, th = (90 + L.th) * DEG;
  return [Math.cos(th) * r, Math.sin(th) * r, brimZ(H, r, th) - 0.04];
}

/* ---- the bones ------------------------------------------------------------------------------ */

/** How far behind the body its hem trails, in seconds, at its foot. */
const TRAIL = 0.13;

/** How far a point on the body (or, `hat`, on its hat) has been left behind by where the body was `secs` ago, in that frame. */
function leftBehind(s: Ghost, a: Anim, secs: number, at: V3, hat = false): V3 {
  const p = poseOf(s, a), body = bodyXf(s, p), hb = hat ? hatXf(s, body, p)! : body;
  // Where it was over the last while, taken together, so what trails eases after a sudden move rather than whipping.
  let sum: V3 = [0, 0, 0];
  for (const f of LAG_SAMPLES) {
    const q = poseOf(s, lagged(a, secs * f)), back = bodyXf(s, q);
    sum = add(sum, sub(into(hb, place(hat ? hatXf(s, back, q)! : back, at)), at));
  }
  return scale(sum, 1 / LAG_SAMPLES.length);
}
const LAG_SAMPLES = [0.25, 0.5, 0.75, 1.0];

function ghostBones(s: Ghost): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = bodyXf(s, p);
    const b: Bones = { body };
    if (s.arms) {
      const A = s.arms;
      for (let k = 0; k < 2; k++) {
        const sd = k ? 1 : -1;
        const at: V3 = [sd * A.at[0], A.at[1], A.at[2]];
        // Each swings after where its shoulder was a moment ago. Raised arms (built pointing up) tip forward with a negative pitch
        // and out with a roll; arms out at the sides (built pointing out) lift with a roll and swing forward with a yaw.
        const d = leftBehind(s, a, 0.08, at);
        if (A.up) b[`arm${k}`] = joint(body, at, -(A.rest[0] + p.arm[0]) + soft(-d[1] * 30, 20), sd * (A.rest[1] + p.arm[2]) + soft(d[0] * 30, 15), 0);
        else b[`arm${k}`] = joint(body, at, 0, sd * (A.rest[1] - p.arm[2]) + sd * soft(-d[2] * 40, 20), sd * (p.arm[0] - 10 + soft(d[1] * 40, 20)));
      }
    }
    const hat = hatXf(s, body, p);
    if (hat) b.hat = hat;
    if (hat && s.lanterns) {
      // Each lantern hangs straight down from its chain, in the ground's frame whatever the hat is doing, and swings after where the
      // brim was a moment ago, as a weight on a chain does; a little of its own as well.
      const g = Math.max(0.002, p.grow * p.lamps) * p.k;
      s.lanterns.forEach((L, q) => {
        const at = lampAt(s, q), now = place(hat, at);
        // Where the brim was over the last while, taken together, so it swings rather than jerks.
        let w: V3 = [0, 0, 0];
        for (const f of LAG_SAMPLES) {
          const was = poseOf(s, lagged(a, (0.2 + 0.05 * L.chain) * f));
          w = add(w, scale(sub(place(hatXf(s, bodyXf(s, was), was)!, at), now), 1 / LAG_SAMPLES.length));
        }
        // Turned into the body's own heading, which the lantern is hung in.
        const cy = Math.cos(p.yaw * DEG), sy = Math.sin(p.yaw * DEG);
        const d: V3 = [w[0] * cy + w[1] * sy, -w[0] * sy + w[1] * cy, w[2]];
        const len = L.chain * g;
        const own = 4 * Math.sin(a.t * TAU * (6 + q) / LOOP + q * 1.9);
        // A long chain swings through less of an angle, so its lantern, far down it, does not swing faster than a short one's.
        const most = 22 * Math.min(1, 1.2 / L.chain);
        const pitch = soft(Math.atan2(d[1], len + 0.6) / DEG, most) + own * 0.6;
        const roll = soft(Math.atan2(-d[0], len + 0.6) / DEG, most) + own;
        b[`lamp${q}`] = stretched(joint(ROOT, now, pitch, roll, p.yaw), [g, g, g]);
      });
    }
    // The shadow under it, smaller the higher it floats.
    const k = 0.8 / (1 + Math.max(0, p.z) * 0.15);
    b.shadow = { m: [k, 0, 0, 0, k, 0, 0, 0, 1], t: [body.t[0], body.t[1], 0] };
    return b;
  };
}

/* ---- the strands, trailing ------------------------------------------------------------------- */

/** The hat's crown and its tip as one line: up from the brim leaning to its right, over, down, and curling round on itself. */
function hatStrand(H: NonNullable<Ghost['hat']>): { S: Strand; from: number } {
  const T = H.tall, R = H.reach, F = H.foot;
  const pts: V3[] = [[0, 0, -0.06], [0.03 * R, -0.03, 0.3 * T], [0.1 * R, -0.06, 0.58 * T], [0.25 * R, -0.08, 0.84 * T], [0.48 * R, -0.08, 1.0 * T], [0.74 * R, -0.06, 1.04 * T], [0.95 * R, -0.04, 0.9 * T]];
  const w = [F, 0.76 * F, 0.5 * F, 0.32 * F, 0.22 * F, 0.17 * F, 0.13 * F];
  // The curl at its end: round a middle in toward the crown, narrowing in to a point.
  const c: V3 = [0.95 * R - 0.24 * R, -0.03, 0.9 * T - 0.02 * T], r0 = 0.24 * R;
  const steps = Math.round(H.turns * 8);
  for (let q = 1; q <= steps; q++) {
    const f = q / steps, th = -f * H.turns * TAU, r = r0 * (1 - 0.62 * f);
    pts.push([c[0] + Math.cos(th) * r, c[1] + 0.02 * f, c[2] + Math.sin(th) * r]);
    w.push(lerp(0.12 * F, 0.02, f ** 0.8));
  }
  return { S: { pts, w, flat: 1, mats: ['shell'] }, from: 4 / (pts.length - 1) };
}

/** How the tail and the curl on its head bend: after the body, and waving a little of their own; the tail lifted or streaming back. */
function tailRot(s: Ghost, L: Laid, a: Anim, gain: number, own: number, lift: boolean): V3[] {
  const p = poseOf(s, a), end = L.line[L.line.length - 1];
  const d = leftBehind(s, a, 0.11, end);
  return strandRot(L.line, {
    d, gain,
    wave: { axis: [1, 0, 0.4], amp: own * (1 + p.ripple * 0.5), ph: a.t * TAU * 6 / LOOP + smooth(a.go) * a.u * TAU },
    root: lift ? [-p.tail[0] * DEG, 0, p.tail[1] * DEG] : undefined,
  });
}

/** How the hat's tip bends: after the hat, and swaying of its own. */
function tipRot(s: Ghost, L: Laid, from: number, a: Anim): V3[] {
  const p = poseOf(s, a), end = L.line[L.line.length - 1];
  const d = leftBehind(s, a, 0.1, end, true);
  return strandRot(L.line, { d, gain: 0.9, from, wave: { axis: [0, 1, 0.3], amp: 0.22 * (1 + p.ripple * 0.4), ph: a.t * TAU * 5 / LOOP + 0.7 } });
}

/**
 * How a tendril bends, on its right (`side` one) or its left: raised, swung forward and curled as the pose says, after the body and
 * waving of its own. Worked out for the right; the left's is its mirror.
 */
function tendrilRot(s: Ghost, L: Laid, a: Anim, side: number): V3[] {
  const p = poseOf(s, a), end = L.line[L.line.length - 1];
  const sd = side ? 1 : -1;
  const at: V3 = [sd * end[0], end[1], end[2]];
  const dl = leftBehind(s, a, 0.2, at), d: V3 = [sd * dl[0], dl[1], dl[2]];
  return strandRot(L.line, {
    d, gain: 0.85,
    wave: { axis: [0.3, 1, 0], amp: 0.3 + 0.2 * p.ripple, ph: a.t * TAU * 5 / LOOP + side * 1.7 + smooth(a.go) * a.u * TAU },
    root: [0, -p.tend[0] * DEG, p.tend[1] * DEG],
    curl: [0, -p.tend[2] * DEG, 0],
  });
}
/** Mirrored left for right: points and turns alike. */
const mirrorV = (v: readonly V3[]): V3[] => v.map((q) => [-q[0], q[1], q[2]] as V3);
const tendrilLines = new Map<Ghost, Laid>();
/** Where the end of a tendril is this moment, in the body's frame. */
function tendrilEnd(s: Ghost, a: Anim, side: number): V3 {
  let L = tendrilLines.get(s);
  if (!L) tendrilLines.set(s, (L = strandMesh(s.tendril!, 4)));
  const line = bentLine(L, tendrilRot(s, L, a, side)), e = line[line.length - 1];
  return side ? e : [-e[0], e[1], e[2]];
}

/* ---- the hem, trailing ------------------------------------------------------------------------- */

/** How much of a ring at height `z` is hem, and trails: nought above the hem, one at its foot. */
const hemWeight = (s: Ghost, z: number): number => smooth((s.hem.top - z) / (s.hem.top - s.hem.low));

/**
 * The hem's corners moved: each follows where the body was a moment ago, by as much as it is hem, so it streams behind a drift,
 * swings after a swoop and settles after a blow; flared out, and rippling round in a slow wave of its own.
 */
function hemBend(s: Ghost, top = s.hem.top, low = s.hem.low): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const p = poseOf(s, a);
    const now = bodyXf(s, p), backs = LAG_SAMPLES.map((f) => bodyXf(s, poseOf(s, lagged(a, TRAIL * 1.6 * f))));
    const t = a.t, lobes = Math.max(3, s.hem.lobes || 5);
    const amp = 0.05 + 0.06 * p.ripple;
    return v.map((q) => {
      const w = smooth((top - q[2]) / (top - low));
      if (w <= 0) return q;
      let lag: V3 = [0, 0, 0];
      for (const back of backs) lag = add(lag, into(now, place(back, q)));
      lag = scale(lag, 1 / backs.length);
      const phi = Math.atan2(q[1], q[0]);
      const wave = amp * Math.sin(phi * lobes + t * TAU * 5 / LOOP + smooth(a.go) * a.u * TAU);
      const out = 1 + p.flare * w;
      return [
        lerp(q[0], lag[0], w) * out + Math.cos(phi) * wave * 0.4 * w,
        lerp(q[1], lag[1], w) * out + Math.sin(phi) * wave * 0.4 * w - (0.12 + 0.22 * p.gait) * p.go * w,
        lerp(q[2], lag[2], w) + wave * w + (0.1 + 0.24 * p.gait) * p.go * w * Math.max(0, -Math.sin(phi)),
      ];
    });
  };
}

/* ---- meshes ---------------------------------------------------------------------------------- */

/**
 * A curl off the hem: a flat lilac swirl, out from `root` along `out`, a little down, then up and back over on itself, narrowing to
 * a point; its flat side faces round the body, so a curl at its side is seen whole from in front and behind.
 */
function hemCurl(root: V3, out: V3, r: number, w: number, mats: [Mat, Mat]): Mesh {
  // Its plane turned 35 degrees about the way it curls out, toward the sky, so seen along the hem it is never a peg: always more
  // than half as wide as it is seen face on. And it has some thickness of its own.
  const tilt = 35 * DEG, side0 = unit(cross([0, 0, 1], out));
  const up = add(scale([0, 0, 1], Math.cos(tilt)), scale(side0, -Math.sin(tilt))), face = add(scale(side0, Math.cos(tilt)), scale([0, 0, 1], Math.sin(tilt)));
  // And it sweeps round sideways as it rolls up, so even seen straight down the way it curls out it is a hook and not a peg.
  const at = (x: number, z: number, f: number): V3 => add(root, add(add(scale(out, x * r), scale(up, z * r)), scale(face, f * r)));
  const pts = smoothLine([at(-0.1, 0.18, 0), at(0.45, -0.04, 0.05), at(1.0, 0.0, 0.14), at(1.38, 0.34, 0.26), at(1.32, 0.8, 0.4), at(0.98, 0.98, 0.52), at(0.7, 0.8, 0.6), at(0.76, 0.56, 0.64), at(0.94, 0.6, 0.66)], 2);
  const widths = pts.map((_, q) => lerp(w, 0.02, (q / (pts.length - 1)) ** 0.85));
  return blade(pts, widths, face, { mat: mats[0], rib: mats[1], fold: 0.08, thick: 0.22 * r });
}

/** The body: a soft round shell of rings, lavender toward its hem, with its curls off the hem. */
function bodyMesh(s: Ghost, n: number): Mesh {
  const B = s.body, H = s.hem, N = B.z.length;
  // More rings, between the given ones, so the round of it is smooth.
  const zs: number[] = [];
  for (let k = 0; k < N - 1; k++) for (let q = 0; q < 2; q++) zs.push(lerp(B.z[k], B.z[k + 1], q / 2));
  zs.push(B.z[N - 1]);
  const rings = zs.map((z) => ringAt(s, z));
  const mat = (ring: number, j: number): Mat => {
    const z = zs[Math.min(ring, zs.length - 1)], w = hemWeight(s, z);
    // The lowest band of a sheet's hem: every other fold the warm light inside it shows through.
    if (H.lobes && ring === 0) return (Math.floor((j / n) * H.lobes * 2 + 0.5) % 2) ? 'feather' : 'membrane';
    return w > 0.86 ? 'mark' : w > 0.6 ? 'feather' : w > 0.3 ? 'coatDark' : 'coat';
  };
  const m = tube(zs.map((z, q) => [0, rings[q][2], z] as V3), rings.map((r) => r[0]), rings.map((r) => r[1]), n, mat);
  // The hem scalloped: dipped down at each lobe, flared out between, and, torn, cut into ragged points.
  if (H.lobes) {
    for (let k = 0; k < 3; k++) {
      const wk = [1, 0.55, 0.15][k];
      for (let j = 0; j < n; j++) {
        const i = k * n + j, q = m.v[i], phi = Math.atan2(q[1] - rings[k][2], q[0]);
        const lobe = 0.5 + 0.5 * Math.cos(phi * H.lobes + 0.3);
        // Torn: a long strip at every third corner, and the cloth between drawn up a little.
        const jag = H.jag ? (j % 3 ? -0.3 : 1) * (0.5 + 0.5 * jitter(j + 3)) : 0;
        q[2] -= (H.dip * lobe + H.jag * 0.5 * Math.max(0, jag)) * wk;
        const out = 1 + H.flare * (1 - lobe) * wk + (H.jag ? 0.04 * jag * wk : 0);
        q[0] *= out;
        q[1] = rings[k][2] + (q[1] - rings[k][2]) * out;
      }
    }
  }
  const curls: Mesh[] = [];
  for (let c = 0; c < H.curls; c++) {
    // Round its sides and its back, at the bottom of a lobe, curling out from it: none straight out of its front, where it would
    // be seen edge on over its face.
    const phi = -Math.PI / 2 + (c - (H.curls - 1) / 2) * ((TAU * 0.6) / Math.max(1, H.curls - 1)) + 0.15 * (jitter(c) - 0.5);
    const [w, h, y] = ringAt(s, B.z[0]);
    const root: V3 = [Math.cos(phi) * w * 0.9, y + Math.sin(phi) * h * 0.9, B.z[0] - H.dip * 0.5 + 0.12];
    const r = H.curl * (0.8 + 0.35 * jitter(c + 11));
    curls.push(hemCurl(root, [Math.cos(phi), Math.sin(phi), 0], r, r * 0.4, c % 2 ? ['mark', 'featherDark'] : ['feather', 'mark']));
  }
  return merge(m, ...curls);
}

/** The outer veil over a Hallowmire's shoulders: a shell a little out from the body, open at the bottom and torn into points there. */
function capeMesh(s: Ghost, n: number): Mesh {
  const C = s.cape!;
  const zs = [C.top, lerp(C.top, C.low, 0.3), lerp(C.top, C.low, 0.62), C.low].reverse();
  const rings = zs.map((z, q) => {
    const [w, h, y] = ringAt(s, z), o = C.out * (q === zs.length - 1 ? 0.2 : 1);
    return [w + o, h + o, y] as [number, number, number];
  });
  const m = tube(zs.map((z, q) => [0, rings[q][2], z] as V3), rings.map((r) => r[0]), rings.map((r) => r[1]), n,
    (ring) => (ring === 0 ? 'coatDark' : 'coat'), { start: false, seam: 'end' });
  // Its bottom torn into points, long and short, and the ring over it following them part way.
  for (let k = 0; k < 2; k++) {
    for (let j = 0; j < n; j++) {
      const q = m.v[k * n + j], pt = j % 2 === 0;
      const len = pt ? 0.45 + 0.5 * jitter(j + 5) : -0.05;
      q[2] -= len * [1, 0.35][k];
    }
  }
  return m;
}

/** How far down a brim is at a radius and round it: it droops to its edge, and waves. */
function brimZ(H: NonNullable<Ghost['hat']>, r: number, th: number): number {
  const f = clamp((r - H.foot) / (H.brim - H.foot));
  return -H.droop * f ** 1.6 + 0.08 * f * Math.sin(th * 3 + 0.6);
}

/** The witch's hat's brim: a wide disc round the crown's foot, drooping, its edge ragged, speckled lighter; torn through, on a Hallowmire. */
function brimMesh(H: NonNullable<Ghost['hat']>, n: number): Mesh {
  const B = 4, th0 = 0.09;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const at = (b: number, j: number, under: boolean): number => (under ? (B + 1) * n : 0) + b * n + (j % n);
  for (const under of [false, true]) {
    for (let b = 0; b <= B; b++) {
      for (let j = 0; j < n; j++) {
        const th = (j / n) * TAU;
        // The edge ragged: each point of it out or in a little, and a torn one's notched.
        const rag = b === B ? (jitter(j + 1) - 0.5) * 0.16 * H.brim + (H.torn && j % 5 === 2 ? -0.22 * H.brim : 0) : 0;
        const r = lerp(H.foot * 0.96, H.brim, b / B) + rag;
        v.push([Math.cos(th) * r, Math.sin(th) * r, brimZ(H, r, th) - (under ? th0 : 0)]);
      }
    }
  }
  for (let b = 0; b < B; b++) {
    for (let j = 0; j < n; j++) {
      // Holes torn through it, on a Hallowmire: a few cells left out, top and bottom.
      if (H.torn && b === 2 && jitter(j * 7 + b * 13) < 0.14) continue;
      const spot = b > 0 && jitter(j * 3 + b * 17 + 5) < 0.2;
      f.push({ i: [at(b, j, false), at(b, j + 1, false), at(b + 1, j + 1, false), at(b + 1, j, false)], m: spot ? 'spot' : 'shell' });
      want.push([0, 0, 1]);
      f.push({ i: [at(b, j, true), at(b, j + 1, true), at(b + 1, j + 1, true), at(b + 1, j, true)], m: 'shellDark' });
      want.push([0, 0, -1]);
    }
  }
  for (let j = 0; j < n; j++) {
    const th = ((j + 0.5) / n) * TAU;
    f.push({ i: [at(B, j, false), at(B, j + 1, false), at(B, j + 1, true), at(B, j, true)], m: 'shellDark' });
    want.push([Math.cos(th), Math.sin(th), 0]);
  }
  return mesh(v, wound(v, f, want));
}

/** A jack-o'-lantern: a squat ribbed pumpkin with a stalk, and a carved face on it looking out along `out`. */
function pumpkinMesh(c: V3, r: number, out: V3, n: number): Mesh {
  const zs = [-0.82, -0.6, -0.15, 0.3, 0.68, 0.82].map((f) => c[2] + f * r);
  const ws = [0.0, 0.7, 1.0, 0.98, 0.66, 0.0].map((f) => f * r * 1.18);
  const body = tube(zs.map((z) => [c[0], c[1], z] as V3), ws, ws, n, (_, j) => (j % 2 ? 'bloom' : 'billDark'));
  const stalk = taper([[c[0], c[1], c[2] + r * 0.7], [c[0] + r * 0.12, c[1], c[2] + r * 1.15]], r * 0.2, r * 0.12, 5, 'stem');
  const d = unit(out), at = add(c, scale(d, r * 1.2));
  const face = paint([
    flat(add(at, [-d[1] * r * 0.38, d[0] * r * 0.38, r * 0.2]), d, [[-1, -0.6], [1, -0.6], [0, 1]], r * 0.2, 'eye'),
    flat(add(at, [d[1] * r * 0.38, -d[0] * r * 0.38, r * 0.2]), d, [[-1, -0.6], [1, -0.6], [0, 1]], r * 0.2, 'eye'),
    flat(add(at, [0, 0, -r * 0.25]), d, [[-1, 0.2], [-0.5, -0.1], [-0.25, 0.15], [0, -0.15], [0.25, 0.15], [0.5, -0.1], [1, 0.2], [0.6, -0.5], [-0.6, -0.5]], r * 0.55, 'eye'),
  ]);
  return merge(body, stalk, face);
}

/** The band's leaves and its jack-o'-lanterns, on the brim at the crown's foot, round toward its front. */
function badgeMesh(s: Ghost, n: number): Mesh {
  const H = s.hat!, parts: Mesh[] = [];
  const r = H.foot * 1.02;
  // Its pumpkins side by side across the front of the band, a little round to its left; the middle one higher.
  const spots = H.pumpkins === 1 ? [118] : [74, 104, 134];
  const size = H.pumpkins === 1 ? 0.3 : 0.4;
  spots.forEach((th, q) => {
    const a = th * DEG, rr = r + size * 0.55, out: V3 = [Math.cos(a), Math.sin(a), 0.25];
    const z = 0.12 + size * 0.75 + (H.pumpkins > 1 && q === 1 ? size * 0.75 : 0);
    parts.push(pumpkinMesh([Math.cos(a) * rr, Math.sin(a) * rr, z], size * (q === 1 ? 1.08 : 1), out, n));
  });
  for (let q = 0; q < H.leaves; q++) {
    // Fanned out round the pumpkins, behind them and to either side, lying back on the brim and the crown.
    const th = (spots[0] - 34 + ((spots[spots.length - 1] - spots[0] + 68) * q) / Math.max(1, H.leaves - 1) + 9 * (jitter(q) - 0.5)) * DEG;
    const root: V3 = [Math.cos(th) * r, Math.sin(th) * r, 0.18 + 0.3 * jitter(q + 4)];
    const dir = unit([Math.cos(th), Math.sin(th), 0.55 + 0.5 * jitter(q + 9)]);
    const len = (H.pumpkins === 1 ? 0.62 : 0.85) * (0.8 + 0.4 * jitter(q + 2));
    parts.push(blade(curve(root, add(root, scale(dir, len * 0.55)), add(root, add(scale(dir, len), [0, 0, -0.08])), 3), [0.05, len * 0.3, len * 0.26, 0.03], [0, 0, 1],
      { mat: q % 2 ? 'leaf' : 'leafDark', rib: 'leafDark', fold: 0.2, thick: 0.03 }));
  }
  return merge(...parts);
}

/** A brass lantern hung at the end of its chain: an ornate cap and a ring, a round of amber glass in brass bars, and a finial under it. */
function lanternMesh(len: number, big: number, n: number): Mesh {
  const z0 = -len;
  const cap = tube([[0, 0, z0 + 0.04], [0, 0, z0 - 0.08], [0, 0, z0 - 0.2], [0, 0, z0 - 0.26]] as V3[], [0.05, 0.12, 0.27, 0.3].map((w) => w * big), [0.05, 0.12, 0.27, 0.3].map((w) => w * big), n, (ring) => (ring === 1 ? 'hornDark' : 'horn'));
  const glass = tube([[0, 0, z0 - 0.26], [0, 0, z0 - 0.42], [0, 0, z0 - 0.66], [0, 0, z0 - 0.82]] as V3[], [0.25, 0.33, 0.32, 0.22].map((w) => w * big), [0.25, 0.33, 0.32, 0.22].map((w) => w * big), n,
    (_, j) => (j % 3 === 0 ? 'hornDark' : 'crystal'), { start: false, end: false });
  const foot = taper([[0, 0, z0 - 0.82], [0, 0, z0 - 0.94], [0, 0, z0 - 1.12]], 0.26 * big, 0.02, n, 'horn');
  return merge(cap, glass, foot);
}
/** Its chain: a thin brass line with a bead or two on it, from the brim down to the lantern. */
function chainMesh(len: number, n: number): Mesh {
  const beads = len > 1.6 ? [0.35, 0.7] : [0.5];
  return merge(
    tube([[0, 0, 0], [0, 0, -len + 0.02]], 0.028, 0.028, 4, 'hornDark'),
    ...beads.map((f) => orbAlong([0, 0, -len * f], [0, 0, 1], [0.07, 0.07, 0.13], n, 3, 'horn')),
  );
}

/** A nub arm: a short round sleeve of the sheet with a soft round end, out at its side or up. */
function armMesh(A: NonNullable<Ghost['arms']>, n: number, k: number): Mesh {
  // A flipper: broad seen from in front, thin seen from the side, out and a little down.
  if (!A.up) return orbAlong([A.len * 0.42, 0, -0.04], [1, 0, -0.2], [A.w[1], A.w[0], A.len * 0.62], n, k, 'coat');
  return merge(
    tube([[0, 0, -0.1], [0, 0.02, A.len * 0.55], [0, 0.03, A.len]], [A.w[0], A.w[0] * 0.92, A.w[1]], [A.w[0] * 0.9, A.w[0] * 0.84, A.w[1] * 0.92], n, 'coat', { seam: 'start' }),
    orb([0, 0.03, A.len], [A.w[1], A.w[1] * 0.92, A.w[1] * 0.85], n, k, 'feather'),
  );
}

/* ---- the face ------------------------------------------------------------------------------- */

/** How many corners round the mouth and the tongue: the same open and booing, so one is moved into the other. */
const MOUTH = 14;
/** The mouth, open in a small happy D or a big "boo" O (`boo`), as corners across and up of its middle in units of its width. */
function mouthPts(boo: boolean, inner: boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let q = 0; q < MOUTH; q++) {
    const th = (q / MOUTH) * TAU;
    if (inner) out.push(boo ? [Math.cos(th) * 0.5, -0.78 + Math.sin(th) * 0.42] : [Math.cos(th) * 0.32, -0.42 + Math.sin(th) * 0.2]);
    else if (boo) out.push([Math.cos(th) * 0.82, -0.3 + Math.sin(th) * 1.16]);
    // The happy D: a flat top, gently arched, and a round bottom.
    else out.push(th < Math.PI ? [Math.cos(th), 0.08 + 0.1 * Math.sin(th)] : [Math.cos(th), Math.sin(th) * 0.78]);
  }
  return out;
}

interface FaceMeshes { open: Mesh; shut: Mesh; boo: V3[]; blazed: V3[] }

/**
 * Its face, painted on the body: big dark oval eyes with an amber light low in each and a glint high, a blush under each, and a small
 * open happy mouth. Shut, each eye is a lid's curve. Under a Hallowmire's brim, a shadow over its eyes. The mouth's corners come first,
 * the same in both, so a boo opens either; the eyes after, so they blaze.
 */
function faceMeshes(s: Ghost): FaceMeshes {
  const F = s.face, mouthAt = onBody(s, F.mouth, Math.PI / 2);
  const mc = add(mouthAt.p, scale(mouthAt.n, 0.03));
  // A Hallowmire shows no mouth until it boos: shut, its mouth is a point.
  const mouth = (boo: boolean): Disc[] => [
    flat(mc, mouthAt.n, mouthPts(boo, false), F.mouthW * 0.5 * (F.hush && !boo ? 0.02 : 1), 'nose'),
    flat(add(mc, scale(mouthAt.n, 0.008)), mouthAt.n, mouthPts(boo, true), F.mouthW * 0.5 * (F.hush && !boo ? 0.02 : 1), 'tongue'),
  ];
  const eyesOf = (shut: boolean, blaze: boolean): Disc[] => {
    const out: Disc[] = [];
    if (F.shade) {
      // The shadow under the brim, over both eyes: a band of cool dark the eyes look out of.
      // Laid on the curve of the face corner by corner, so it never stands off it at the sides.
      // Two of it, a paler one round a darker, so its edge is soft rather than a mask's.
      for (const [k, m, lift] of [[0.8, 'feather', 0.015], [0.62, 'claw', 0.02]] as const) {
        const v = Array.from({ length: 18 }, (_, q) => {
          const th = (q / 18) * TAU, at = onBody(s, F.z + 0.1 + Math.sin(th) * F.size * F.tall * 1.5 * k, Math.PI / 2 + Math.cos(th) * (F.turn + 20) * DEG * k * 1.05);
          return add(at.p, scale(at.n, lift));
        });
        out.push(facing(v, onBody(s, F.z, Math.PI / 2).n, m));
      }
    }
    for (const sd of [1, -1]) {
      const at = onBody(s, F.z, Math.PI / 2 - sd * F.turn * DEG), c = add(at.p, scale(at.n, 0.03)), n = at.n;
      const r = F.size, tall = F.tall;
      if (shut) {
        out.push(flat(add(c, [0, 0, -r * 0.2]), n, Array.from({ length: 9 }, (_, q) => {
          const th = Math.PI * (q / 8);
          return [Math.cos(th) * 1.05, -Math.sin(th) * 0.42] as [number, number];
        }).concat(Array.from({ length: 9 }, (_, q) => {
          const th = Math.PI * (1 - q / 8);
          return [Math.cos(th) * 0.9, -Math.sin(th) * 0.18] as [number, number];
        })), r, 'lid'));
        continue;
      }
      out.push(disc(c, n, r, r * tall, 12, 'eye'));
      // The amber light low in it, and blazing, filling most of it.
      const glow = blaze ? 0.8 : 0.56;
      out.push(disc(add(add(c, scale(n, 0.008)), [0, 0, -r * tall * (blaze ? 0.12 : 0.36)]), n, r * glow, r * tall * glow * (blaze ? 0.9 : 0.56), 10, 'flame', { lit: true }));
      const side = unit(cross([0, 0, 1], n));
      out.push(disc(add(add(add(c, scale(n, 0.016)), [0, 0, r * tall * 0.42]), scale(side, r * 0.3)), n, r * (blaze ? 0.2 : 0.3), r * (blaze ? 0.2 : 0.3), 6, 'glint', { lit: true }));
    }
    if (F.blush) {
      for (const sd of [1, -1]) {
        const at = onBody(s, F.z - F.size * F.tall * 1.05, Math.PI / 2 - sd * (F.turn + 16) * DEG);
        out.push(disc(add(at.p, scale(at.n, 0.025)), at.n, F.blush, F.blush * 0.58, 8, 'inner'));
      }
    }
    return out;
  };
  const open = paint([...mouth(false), ...eyesOf(false, false)]);
  const boo = paint([...mouth(true), ...eyesOf(false, true)]);
  const shut = paint([...mouth(false), ...eyesOf(true, false)]);
  return { open, shut, boo: boo.v, blazed: boo.v };
}

/* ---- the pieces ------------------------------------------------------------------------------- */

function ghostBuild(s: Ghost, lod: number): Piece[] {
  const n = cut(lod, 14, 18), k = cut(lod, 6, 8), sm = cut(lod, 6, 8);
  const face = faceMeshes(s);
  const M = MOUTH * 2;
  // The face moved as it boos: the mouth from its D to its O, and, the eyes open, their amber blazing up to fill them.
  const faceBent = (v: readonly V3[], a: Anim): V3[] => {
    const p = poseOf(s, a);
    if (p.boo <= 0 && p.blaze <= 0) return v as V3[];
    const open = v === face.open.v;
    return v.map((q, i) => (i < M ? lerpV(q, face.boo[i], p.boo) : open ? lerpV(q, face.blazed[i], p.blaze) : q));
  };
  const out: Piece[] = [
    { key: 'body', mesh: bodyMesh(s, n), bone: 'body', bias: 0, lines: false, bent: s.hem.lobes || s.tail ? hemBend(s) : undefined },
    { key: 'head', mesh: face.open, shut: face.shut, bone: 'body', bias: 0.002, after: 'body', bent: faceBent },
  ];
  if (s.cape) out.push({ key: 'cape', mesh: capeMesh(s, n + 4), bone: 'body', bias: 0.004, after: 'body', lines: false, bent: hemBend(s, s.cape.top - 0.3, s.cape.low - 0.5) });
  if (s.arms) {
    const arm = armMesh(s.arms, sm, k);
    out.push(
      { key: 'arm0', mesh: mirrored(arm), bone: 'arm0', bias: 0.01, after: 'body', front: [-1, 0.25, 0], lines: false },
      { key: 'arm1', mesh: arm, bone: 'arm1', bias: 0.01, after: 'body', front: [1, 0.25, 0], lines: false },
    );
  }
  if (s.tail) {
    const L = strandMesh(s.tail, sm);
    out.push({ key: 'tail', mesh: L.mesh, bone: 'body', bias: -0.004, lines: false, bent: (v, a) => bendStrand(v, L, tailRot(s, L, a, 0.5, 0.4, true)) });
  }
  if (s.tuft) {
    const L = strandMesh(s.tuft, 5);
    out.push({ key: 'tuft', mesh: L.mesh, bone: 'body', bias: 0.003, after: 'body', lines: false, bent: (v, a) => bendStrand(v, L, tailRot(s, L, a, 0.45, 0.25, false)) });
  }
  if (s.hat) {
    const { S, from } = hatStrand(s.hat);
    const L = strandMesh(S, cut(lod, 10, 12), { seam: 'start', mat: (ring, j, K) => (ring === 0 ? 'shellDark' : jitter(ring * 11 + j * 5) < 0.14 && ring < K - 4 ? 'spot' : 'shell') });
    out.push(
      { key: 'brim', mesh: brimMesh(s.hat, cut(lod, 20, 26)), bone: 'hat', bias: 0.05, after: ['body', 'head'] },
      { key: 'crown', mesh: L.mesh, bone: 'hat', bias: 0.01, after: 'brim', bent: (v, a) => bendStrand(v, L, tipRot(s, L, from, a)) },
      { key: 'badge', mesh: badgeMesh(s, sm), bone: 'hat', bias: 0.01, after: 'brim', front: [-0.5, 0.86, 0] },
    );
  }
  if (s.tendril) {
    const L = strandMesh(s.tendril, sm);
    for (let side = 0; side < 2; side++) {
      const sd = side ? 1 : -1;
      out.push({
        key: `tend${side}`, mesh: side ? L.mesh : mirrored(L.mesh), bone: 'body', bias: 0.006, after: 'body', front: [sd, 0, 0], lines: false,
        bent: (v, a) => {
          const rot = tendrilRot(s, L, a, side);
          return side ? bendStrand(v, L, rot) : mirrorV(bendStrand(mirrorV(v), L, rot));
        },
      });
    }
  }
  if (s.lanterns) {
    s.lanterns.forEach((L, q) => {
      out.push(
        { key: `chain${q}`, mesh: chainMesh(L.chain, 4), bone: `lamp${q}`, bias: 0.001, thin: true },
        { key: `lamp${q}`, mesh: lanternMesh(L.chain, s.lamp, sm + 2), bone: `lamp${q}`, bias: 0.002 },
      );
    });
  }
  return out;
}
const lerpV = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ---- what it throws about ------------------------------------------------------------------------ */

const VIOLET: RGB = [142, 104, 220];
const LILAC: RGB = [196, 172, 246];
const MIST: RGB = [244, 238, 255];
const AMBER: RGB = [255, 176, 72];
const PUMPKIN: RGB = [255, 136, 38];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn. */
const bigness = (s: Ghost): number => [0.7, 1, 1.45][s.stage];
/** How tall it stands, to the top of its hat, over the ground. */
const tallOf = (s: Ghost): number => s.high + (s.hat ? s.hat.at[2] + s.hat.tall * 1.04 : 1.3);

/**
 * A wisp of spectral smoke along a line of points on the screen, head first: soft and narrowing to nothing at its tail, a violet
 * haze round a lilac body round a pale core, each the same shape inside the last, so it has no hard edge.
 */
function wisp(g: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>, w0: number, al: number, tone: RGB = LILAC): void {
  if (al <= 0.004 || pts.length < 2 || w0 <= 0) return;
  const w = Math.max(w0, 1.6 * pixel(g));
  // Its tail: the same ribbon three times, each inside the last and brighter; its sides curves rather than corners, softened by a
  // blur, and fading out along its length from its head, so it is a lick of smoke and never a shard.
  const px = pixel(g), tail = pts[pts.length - 1];
  const layer = (k: number, c: RGB, a: number): void => {
    const L: Array<[number, number]> = [], R: Array<[number, number]> = [];
    for (let q = 0; q < pts.length; q++) {
      const p = pts[q], n = pts[Math.min(pts.length - 1, q + 1)], b = pts[Math.max(0, q - 1)];
      const dx = n[0] - b[0], dy = n[1] - b[1], dl = Math.hypot(dx, dy) || 1;
      // A ribbon, not a dart: narrowing to about a third of its width and rounding off there, where its fade has taken it.
      const f = q / (pts.length - 1), ww = w * k * (0.35 + 0.65 * (1 - f)) * (1 - f ** 3) + (q === pts.length - 1 ? w * k * 0.12 : 0);
      L.push([p[0] - (dy / dl) * ww, p[1] + (dx / dl) * ww]);
      R.push([p[0] + (dy / dl) * ww, p[1] - (dx / dl) * ww]);
    }
    // Its head rounded: round from its right side, over its front, to its left.
    const d0x = pts[1][0] - pts[0][0], d0y = pts[1][1] - pts[0][1], d0 = Math.hypot(d0x, d0y) || 1, w0h = w * k * 1.0;
    const cap: Array<[number, number]> = [];
    for (let e = 1; e < 6; e++) {
      const ph = (e / 6) * Math.PI, nx = d0y / d0, ny = -d0x / d0;
      cap.push([pts[0][0] + w0h * (Math.cos(ph) * nx - Math.sin(ph) * (d0x / d0)), pts[0][1] + w0h * (Math.cos(ph) * ny - Math.sin(ph) * (d0y / d0))]);
    }
    const ring = [...L, ...R.reverse(), ...cap];
    const gr = g.createLinearGradient(pts[0][0], pts[0][1], tail[0], tail[1]);
    gr.addColorStop(0, css(c, a));
    gr.addColorStop(0.55, css(c, a * 0.45));
    gr.addColorStop(1, css(c, 0));
    g.save();
    g.fillStyle = gr;
    g.shadowColor = css(c, a);
    g.shadowBlur = Math.min(6, (w * k * 0.6) / px);
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    // The outer haze blurred as well, where the browser can.
    if (k > 1 && 'filter' in g) g.filter = `blur(${Math.min(4, (w * k * 0.35) / px).toFixed(1)}px)`;
    g.beginPath();
    // Through the middles of the corners' sides, each corner a control point: a smooth outline.
    const mid = (q: number): [number, number] => { const A = ring[q % ring.length], B = ring[(q + 1) % ring.length]; return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; };
    const m0 = mid(ring.length - 1);
    g.moveTo(m0[0], m0[1]);
    for (let q = 0; q < ring.length; q++) {
      const m = mid(q);
      g.quadraticCurveTo(ring[q][0], ring[q][1], m[0], m[1]);
    }
    g.closePath();
    g.fill();
    g.restore();
  };
  layer(1.4, VIOLET, al * 0.16);
  layer(0.9, mix(VIOLET, tone, 0.3), al * 0.36);
  layer(0.5, mix(tone, MIST, 0.3), al * 0.5);
  // Its head: a soft round glow, pale in the middle, gone to nothing at its edge with no rim.
  const [x, y] = pts[0], r = w * 0.8;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(MIST, al * 0.9));
  grad.addColorStop(0.45, css(mix(tone, MIST, 0.4), al * 0.55));
  grad.addColorStop(1, css(tone, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** How many of the units being drawn in go to a pixel on the canvas: what keeps a line of light a pixel or two wide however far out it is seen. */
const pixel = (g: CanvasRenderingContext2D): number => {
  const T = g.getTransform();
  return 1 / (Math.hypot(T.a, T.b) || 1);
};

/** A spark: a tiny bright point with a little light round it. */
function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004) return;
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 3);
  halo.addColorStop(0, css(c, al * 0.5));
  halo.addColorStop(1, css(c, 0));
  g.fillStyle = halo;
  g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  g.fillStyle = css(mix(c, [255, 255, 240], 0.4), al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** Soft light, added to what is under it. */
function light(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(0.4, css(c, al * 0.4));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/**
 * A ring going out round `c` at its height (on the ground, or in the air), `r` across: the half of it on the viewer's side drawn over
 * the body, the far half under it. A violet haze with a bright line in it.
 */
function ring(g: CanvasRenderingContext2D, view: View, c: V3, mid: V3, r: number, w: number, al: number, front: boolean, squash = 1): void {
  if (al <= 0.004 || r <= 0) return;
  const N = 40;
  const pts: Array<{ p: [number, number]; near: boolean }> = [];
  for (let q = 0; q <= N; q++) {
    const th = (q / N) * TAU, p: V3 = [c[0] + Math.cos(th) * r, c[1] + Math.sin(th) * r, c[2] + Math.sin(th * 3) * 0.06 * r * (1 - squash)];
    pts.push({ p: onScreen(view, p), near: nearSide(p, mid, view) });
  }
  const stroke = (lw: number, col: RGB, a: number): void => {
    g.lineWidth = lw;
    g.strokeStyle = css(col, a);
    g.lineCap = 'round';
    g.beginPath();
    let on = false;
    for (let q = 0; q < N; q++) {
      const A = pts[q], B = pts[q + 1];
      if (A.near === front) {
        if (!on) g.moveTo(A.p[0], A.p[1]);
        g.lineTo(B.p[0], B.p[1]);
        on = true;
      } else on = false;
    }
    g.stroke();
  };
  // Never under a pixel and a half for its bright line, however far out it is seen.
  const px = pixel(g), lw = Math.max(w, 1.5 * px / 0.5);
  stroke(lw * 2.6, VIOLET, al * 0.3);
  stroke(lw * 1.4, LILAC, al * 0.55);
  stroke(lw * 0.5, MIST, al * 0.85);
}

/** Puffs of mist, drawn whole and solid on a layer of their own and that laid down once at `al`, so one never shows through another. */
function mistLayer(g: CanvasRenderingContext2D, puffs: ReadonlyArray<{ x: number; y: number; r: number; c: RGB }>, al: number): void {
  if (al <= 0.004 || !puffs.length || typeof document === 'undefined') return;
  const T = g.getTransform();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of puffs) {
    const X = T.a * p.x + T.c * p.y + T.e, Y = T.b * p.x + T.d * p.y + T.f, R = p.r * Math.hypot(T.a, T.b);
    x0 = Math.min(x0, X - R); y0 = Math.min(y0, Y - R); x1 = Math.max(x1, X + R); y1 = Math.max(y1, Y + R);
  }
  const W = Math.ceil(x1 - x0) + 2, H = Math.ceil(y1 - y0) + 2;
  if (W <= 2 || H <= 2 || W * H > 4e6) return;
  const cv = layerCanvas(W, H), l = cv.getContext('2d')!;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.clearRect(0, 0, W, H);
  l.setTransform(T.a, T.b, T.c, T.d, T.e - x0 + 1, T.f - y0 + 1);
  for (const p of puffs) {
    // Solid to near its edge and soft only at it, so where two meet they are one mist.
    const grad = l.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0, css(mix(p.c, MIST, 0.5), 1));
    grad.addColorStop(0.62, css(p.c, 1));
    grad.addColorStop(1, css(p.c, 0));
    l.fillStyle = grad;
    l.beginPath();
    l.arc(p.x, p.y, p.r, 0, TAU);
    l.fill();
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = clamp(al);
  g.drawImage(cv, 0, 0, W, H, x0 - 1, y0 - 1, W, H);
  g.restore();
}
let mistCanvas: HTMLCanvasElement | null = null;
function layerCanvas(w: number, h: number): HTMLCanvasElement {
  if (!mistCanvas) mistCanvas = document.createElement('canvas');
  if (mistCanvas.width < w || mistCanvas.height < h) {
    mistCanvas.width = Math.max(w, mistCanvas.width);
    mistCanvas.height = Math.max(h, mistCanvas.height);
  }
  return mistCanvas;
}

/** Where something thrown from `p` at `v` is `s` seconds on, slowing as it goes, as smoke does: it drifts to a stop and rises. */
const drifted = (p: V3, v: V3, s: number, slow = 3, rise = 0.6): V3 => {
  const k = (1 - Math.exp(-slow * s)) / slow;
  return [p[0] + v[0] * k, p[1] + v[1] * k, Math.max(0.05, p[2] + v[2] * k + rise * s * s)];
};
/** A wisp's line on the screen: where it is now, and back along where it came from. */
function trailOf(view: View, at: (s: number) => V3, s: number, len: number, n = 6): Array<[number, number]> {
  // Spread over the life it has had, never back past its start, so a young wisp narrows to nothing along its own path too.
  const span = Math.min(len, Math.max(s, 1e-3));
  return Array.from({ length: n }, (_, q) => onScreen(view, at(s - (span * q) / (n - 1))));
}
/** How big a wisp is drawn, `since` seconds old: born a soft dot, and grown to full size within a twelfth of a second. */
const born = (since: number): number => 0.5 + 0.5 * ramp(since, 0, 0.08);

/** The middle of the body, over the ground: what the near and far sides of things are sides of. */
const midOf = (b: Bones): V3 => [b.body.t[0], b.body.t[1], b.body.t[2]];

/**
 * The strike. Wisps of spectral smoke burst off where the blow lands, out ahead of it and up past it, with a soft violet light: off
 * the Whispet's face as it bumps, off the Lanternveil's arms where they sweep across, off the ends of the Hallowmire's tendrils where
 * they lash, its lanterns flaring amber.
 */
/** What strikes, at a moment: the Whispet's face, the Lanternveil's arms, the Hallowmire's tendrils' ends; and in front of it, where it lands. */
function strikers(s: Ghost, a: Anim, b: Bones): V3[] {
  if (s.stage === 0) return [place(b.body, [0, 1.3, -0.05]), place(b.body, [0, 1.75, 0])];
  if (s.stage === 1) return [place(b.arm0, [0, 0.1, s.arms!.len]), place(b.arm1, [0, 0.1, s.arms!.len]), place(b.body, [0, 2.2, 0.4])];
  return [0, 1].map((side) => place(b.body, tendrilEnd(s, a, side))).concat([place(b.body, [0, 3.0, -0.4])]);
}

function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Ghost, b: Bones, a: Anim, bones: (a: Anim) => Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(b), since = (t - s.hit) * ACT_SECS.strike;
  const over = s.high + (s.hat ? s.hat.at[2] + 0.4 : 1.0);
  // A streak of spectral smoke along the way what strikes comes in, from a little before the blow to just after it.
  const sw = ramp(t, s.hit - 0.18, s.hit - 0.06) * (1 - ramp(t, s.hit + 0.04, s.hit + 0.18));
  if (sw > 0) {
    const N = 8, at = (dt: number): Anim => ({ ...a, act: { kind: 'strike', t: Math.max(0, t - dt) } });
    const paths = Array.from({ length: N }, (_, q) => strikers(s, at(q * 0.022), bones(at(q * 0.022))));
    for (let w = 0; w < paths[0].length - 1; w++) {
      if (nearSide(paths[0][w], mid, view) !== front) continue;
      wisp(g, paths.map((ps) => onScreen(view, ps[w])), [0.36, 0.4, 0.5][s.stage] * big, 0.8 * sw);
    }
  }
  if (since < -0.04) return;
  const at = bones({ ...a, act: { kind: 'strike', t: s.hit } }), origins = strikers(s, { ...a, act: { kind: 'strike', t: s.hit } }, at);
  const fade = 1 - ramp(since, 0.14, 0.4);
  if (since >= 0) {
    const n = [7, 9, 12][s.stage];
    // Its sides, and the height of the top of its head (or its brim), for the wisps that go up past it.
    const across = unit([at.body.m[0], at.body.m[3], 0]), topZ = over - [0.5, 0.9, 1.3][s.stage];
    for (let q = 0; q < n; q++) {
      const th = (q / n) * TAU + jitter(q) * 0.6;
      // Out ahead of it and to the sides; and the last three bursting up beside its head and away past it, so the blow is seen
      // from behind it within a tenth of a second.
      const high = q >= n - 3;
      const side0 = (q % 2 ? 1 : -1) * (ringAt(s, 0)[0] + 0.4) * (q === n - 1 ? 0.3 : 1);
      const from = high ? add([mid[0], mid[1], topZ], scale(across, side0)) : origins[q % origins.length];
      const v: V3 = high ? add(scale(across, Math.sign(side0) * 2.4 * big), [0, 0, 12 * big]) : [Math.cos(th) * 3.2 * big, (2.4 + 2 * jitter(q + 3)) * big + Math.sin(th) * 1.4, (1.6 + 2.2 * jitter(q + 7)) * big];
      // Curling to one side and back as it goes, so its trail is a lick of smoke and not a line.
      const side = unit(cross(v, [0, 0, 1])), sway = (0.7 + 0.5 * jitter(q + 21)) * big * (q % 2 ? 1 : -1);
      const pos = (u: number): V3 => add(drifted(from, v, u, high ? 2.2 : 3.4, 0.8), scale(Math.hypot(side[0], side[1]) > 0.1 ? side : [1, 0, 0], sway * 0.5 * Math.sin(u * 7) * Math.min(1, u * 5)));
      if ((nearSide(pos(since), mid, view) || (high && pos(since)[2] > over)) !== front) continue;
      wisp(g, trailOf(view, pos, since, 0.2, 8), (0.5 + 0.16 * jitter(q + 1)) * big * born(since) * (1 - 0.35 * ramp(since, 0.05, 0.4)), fade);
    }
  }
  // A small ring going out over the ground under where it lands, past its sides, so the blow is seen from behind it.
  const tip = origins[origins.length - 1], land = s.stage ? lerpV(mid, tip, 0.5) : tip, rk = 1 - Math.exp(-Math.max(0, since) * 12);
  if (since >= 0) ring(g, view, [land[0], land[1], 0.06], mid, (0.6 + [3.4, 4.0, 4.2][s.stage] * rk) * Math.max(1, big), 0.34 * Math.max(1, big), 1 - ramp(since, 0.1, 0.36), front);
  // The light where it lands.
  const k = hump(since, 0.03, 0.12);
  for (const o of origins.slice(-1)) {
    const [x, y] = onScreen(view, o);
    // On the far side of it, a wider flash behind the body, so it shows as a halo round its outline from behind.
    if (nearSide(o, mid, view)) { if (front) light(g, x, y, (1.2 + 0.8 * big) * (0.8 + 0.4 * k), LILAC, 0.45 * k); }
    else if (!front) light(g, x, y, (2.4 + 1.6 * big) * (0.8 + 0.4 * k), VIOLET, 0.7 * k);
  }
  // A Hallowmire's lanterns flaring as its tendrils lash.
  if (s.lanterns) {
    const f = hump(t, s.hit + 0.02, 0.18);
    s.lanterns.forEach((L, q) => {
      const p = place(b[`lamp${q}`], [0, 0, -L.chain - 0.55]);
      if (nearSide(p, mid, view) !== front) return;
      const [x, y] = onScreen(view, p);
      light(g, x, y, 2.4, AMBER, 0.55 * f);
      for (let e = 0; e < 3 && since > 0; e++) {
        const sp = drifted(p, [Math.cos(e * 2.1 + q) * 1.6, Math.sin(e * 2.1 + q) * 1.6, 2.6], since, 3, -2);
        const [sx, sy] = onScreen(view, sp);
        spark(g, sx, sy, 0.09, AMBER, fade * f);
      }
    });
  }
}

/**
 * The Fear. As it swells, a ring of violet goes out from under it over the ground and another round it through the air at its middle,
 * and spectral wisps burst out all round it, up past its hat; its eyes blaze amber and, on a Hallowmire, its lanterns flash.
 */
function fearBurst(g: CanvasRenderingContext2D, view: View, s: Ghost, b: Bones, t: number, front: boolean): void {
  const F = GHOST_FEAR, big = bigness(s), mid = midOf(b);
  const since = (t - F.out) * ACT_SECS.cast;
  const wide = [1.5, 2.1, 2.6][s.stage];
  // A dark violet gathering under it as it draws in: the moment before.
  if (!front) {
    const gk = hump(t, F.gather + 0.06, 0.16);
    const [x, y] = onScreen(view, [mid[0], mid[1], 0.05]);
    if (gk > 0) {
      g.save();
      g.translate(x, y);
      g.scale(1, 0.5);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, wide * 1.6);
      grad.addColorStop(0, css(VIOLET, 0.32 * gk));
      grad.addColorStop(1, css(VIOLET, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, wide * 1.6, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  if (since < 0) return;
  const out = 1 - Math.exp(-since * 5.2);
  const al = 1 - ramp(since, 0.12, 0.5);
  // On the ground, wide; in the air, at its middle, a little behind.
  ring(g, view, [mid[0], mid[1], 0.06], mid, wide * (0.9 + 4.2 * out), 0.32 * big, al, front);
  const out2 = 1 - Math.exp(-Math.max(0, since - 0.04) * 4.6);
  ring(g, view, [mid[0], mid[1], mid[2] - 0.2 * s.high], mid, wide * (0.8 + 3.2 * out2), 0.26 * big, al * (since > 0.04 ? 1 : 0), front, 0.6);
  // Wisps bursting out all round it, curling as they go, and a few going straight up past its hat.
  const n = [10, 12, 14][s.stage], over = tallOf(s);
  const wfade = 1 - ramp(since, 0.18, 0.5);
  for (let q = 0; q < n; q++) {
    const th = (q / n) * TAU + jitter(q) * 0.4, up = q % 4 === 3;
    // From the outline of its swollen body at that height, a little out from it, so none starts on top of it.
    const k = Math.hypot(b.body.m[0], b.body.m[3], b.body.m[6]);
    const zl = (jitter(q + 5) - 0.6) * s.high * 0.8, R = ringAt(s, zl / k)[0] * k + 0.2;
    const from: V3 = [mid[0] + Math.cos(th) * R, mid[1] + Math.sin(th) * R, mid[2] + zl];
    const sp = (7 + 2 * jitter(q + 2)) * big;
    let v: V3 = up ? [Math.cos(th) * 1.2, Math.sin(th) * 1.2, 9 * big] : [Math.cos(th) * sp, Math.sin(th) * sp, (0.8 + 1.4 * jitter(q + 9)) * big];
    // One going out on the viewer's side is sent off toward the viewer as well, so its trail runs off the body rather than across its face.
    if (!up && dot([Math.cos(th), Math.sin(th), 0], view.T) > 0) v = add(v, scale(view.T, 0.3 * Math.hypot(v[0], v[1], v[2])));
    const curlK = (jitter(q + 13) - 0.5) * 3;
    const pos = (u: number): V3 => {
      const p = drifted(from, v, u, 2.2, 1.2);
      // Curling sideways as it slows.
      const c = curlK * u * u * 3 + 0.25 * big * Math.sin(u * 7 + q) * Math.min(1, u * 5);
      return [p[0] - Math.sin(th) * c, p[1] + Math.cos(th) * c, p[2]];
    };
    const p = pos(since);
    if ((nearSide(p, mid, view) || (up && p[2] > over * 0.8)) !== front) continue;
    // Faded in as it leaves the outline, so none is seen sitting on the body before it is on its way.
    wisp(g, trailOf(view, pos, since, 0.25, 8), (0.6 + 0.2 * jitter(q + 1)) * big * born(since), wfade * ramp(since, 0, 0.06));
  }
  // The lanterns flashing with it.
  if (s.lanterns) {
    const f = hump(t, F.out + 0.04, 0.16);
    s.lanterns.forEach((L, q) => {
      const p = place(b[`lamp${q}`], [0, 0, -L.chain - 0.55]);
      if (nearSide(p, mid, view) !== front) return;
      const [x, y] = onScreen(view, p);
      light(g, x, y, 2.8, AMBER, 0.6 * f);
    });
  }
}

/**
 * Evolving: at the start a cloud of lavender mist going up round it, thick enough to hide the change of body; then wisps of it
 * spiralling up round it and a few pumpkin-orange sparks, as the hat and the lanterns grow in.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Ghost, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(b), tall = tallOf(s);
  const since = t * ACT_SECS.evolve;
  const cloud = ramp(t, 0, 0.01) * (1 - ramp(t, 0.1, 0.3));
  if (cloud > 0) {
    // Fading by thinning and growing pale, the whole of it as one mist.
    const puffs: Array<{ x: number; y: number; r: number; c: RGB }> = [];
    // From its hem to its hat, each as wide as the body is there, so none of the body it is changing out of shows.
    const N = 16;
    for (let q = 0; q < N; q++) {
      const a = q * 2.4 + 0.3, h = tall * (0.03 + (0.86 * q) / (N - 1));
      const wide = Math.max(1, ringAt(s, h - s.high)[0] / 1.3);
      const r = (0.3 + 0.4 * jitter(q + 5)) * big * wide + since * 1.2;
      const c: V3 = [mid[0] + Math.cos(a) * r, mid[1] + Math.sin(a) * r, h + since * 1.5];
      if (nearSide(c, mid, view) !== front) continue;
      const [x, y] = onScreen(view, c);
      puffs.push({ x, y, r: ((1.7 + 0.8 * jitter(q)) * big * wide + since * 1.6) * (0.6 + 0.4 * cloud), c: mix(q % 3 ? LILAC : MIST, MIST, 0.6 * (1 - cloud)) });
    }
    mistLayer(g, puffs, 0.9 * cloud);
  }
  const fade = ramp(t, 0.08, 0.22) * (1 - ramp(t, 0.7, 0.92));
  const wideR = [1.7, 2.4, 3.2][s.stage];
  for (let q = 0; q < 10; q++) {
    // Up round it in a spiral, wide at its foot and gathering in as they rise.
    const pos = (u: number): V3 => {
      const rise = frac(u * 0.62 + q / 10), ang = (q / 10) * TAU * 2 + u * 3.4;
      const r = wideR * (1 - 0.4 * rise);
      return [mid[0] + Math.cos(ang) * r, mid[1] + Math.sin(ang) * r, rise * tall * 1.05];
    };
    const p = pos(since), rise = frac(since * 0.62 + q / 10);
    if (rise < 0.1 || nearSide(p, mid, view) !== front) continue;
    wisp(g, trailOf(view, pos, since, 0.22, 7), 0.28 * big, fade * Math.sin(rise * Math.PI));
  }
  // A few small sparks of pumpkin orange, going up with it and winking out.
  for (let q = 0; q < 7; q++) {
    const rise = frac(since * 0.5 + q / 7 + 0.05), ang = q * 2.4 + since * 2.2;
    const p: V3 = [mid[0] + Math.cos(ang) * wideR * 0.8, mid[1] + Math.sin(ang) * wideR * 0.8, tall * (0.15 + 0.9 * rise)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    spark(g, x, y, 0.08 * big, PUMPKIN, fade * Math.sin(rise * Math.PI));
  }
}

/** Its eyes' amber light, out of the face toward the viewer, only while the face is turned that way; bright as it frightens. */
function eyeGlow(g: CanvasRenderingContext2D, view: View, s: Ghost, b: Bones, a: Anim): void {
  const F = s.face, p = poseOf(s, a);
  const k = 0.16 + 0.3 * p.blaze;
  for (const sd of [1, -1]) {
    const at = onBody(s, F.z, Math.PI / 2 - sd * F.turn * DEG);
    // Only an eye looking well toward the viewer, and no wider than the eye and a little round it, so it never blooms past the body.
    if (dot(unit(turned(b.body, at.n)), view.T) < 0.45) continue;
    const [x, y] = onScreen(view, place(b.body, add(at.p, scale(at.n, 0.05))));
    light(g, x, y, F.size * (1 + 0.3 * p.blaze) * p.k, AMBER, k);
  }
}

/**
 * The lanterns' amber light, gently brighter and dimmer: drawn over the body for a lantern on the viewer's side of it, and under
 * it for one behind, so it is only seen round the body's edge there and never through it.
 */
function lanternGlow(g: CanvasRenderingContext2D, view: View, s: Ghost, b: Bones, a: Anim, front: boolean): void {
  if (!s.lanterns) return;
  const p = poseOf(s, a), mid = midOf(b);
  s.lanterns.forEach((L, q) => {
    const at = place(b[`lamp${q}`], [0, 0, -L.chain - 0.55]);
    if (nearSide(at, mid, view) !== front) return;
    const [x, y] = onScreen(view, at);
    const pulse = 0.3 + 0.05 * cyc(a.t, 4, q * 1.7);
    light(g, x, y, 1.5 * p.grow * p.lamps * p.k, [255, 196, 110], pulse * p.lamps);
    light(g, x, y, 0.55 * p.grow * p.lamps * p.k, [255, 240, 200], 0.35 * p.lamps);
  });
}
/** A direction in a bone's frame, out into the world's. */
const turned = (x: Xf, v: V3): V3 => [x.m[0] * v[0] + x.m[1] * v[1] + x.m[2] * v[2], x.m[3] * v[0] + x.m[4] * v[1] + x.m[5] * v[2], x.m[6] * v[0] + x.m[7] * v[1] + x.m[8] * v[2]];

/* ---- the kinds ---------------------------------------------------------------------------------- */

/** A colour pushed further from its own grey. */
const richer = (c: RGB, k = 1.2): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

function ghostKind(s: Ghost): Kind {
  const bones = ghostBones(s);
  return {
    bones,
    build: (lod) => ghostBuild(s, lod),
    // The variant's coat is its pearly body, kept near white; its markings the lavender of its hem, curls and tail, and the violet
    // they deepen to. The hat, the pumpkins, the leaves, the brass and the amber light are the same on every variant.
    palette: (coat, mark) => {
      const pearl = mix(pastel(coat), [255, 255, 255], 0.35);
      const lav = richer(mix(mark, [255, 255, 255], 0.12), 1.15);
      return coatPalette(coat, mark, {
        coat: pearl,
        coatLight: mix(pearl, [255, 255, 255], 0.6),
        coatDark: mix(pearl, lav, 0.22),
        feather: mix(pearl, lav, 0.5),
        mark: lav,
        featherDark: richer(mix(lav, [70, 40, 120], 0.3), 1.15),
        membrane: mix(mix(pearl, lav, 0.35), [255, 196, 140], 0.3),
        eye: [46, 26, 56],
        lid: [92, 64, 112],
        glint: [255, 254, 248],
        flame: [255, 164, 64],
        inner: [246, 166, 196],
        nose: [96, 36, 70],
        tongue: [240, 120, 150],
        claw: mix(lav, [62, 44, 96], 0.55),
        shell: [124, 84, 178],
        shellDark: [82, 54, 130],
        spot: [176, 146, 222],
        bloom: [252, 140, 40],
        billDark: [218, 102, 30],
        stem: [100, 120, 60],
        leaf: [118, 168, 88],
        leafDark: [80, 128, 74],
        horn: [214, 168, 86],
        hornDark: [148, 106, 58],
        crystal: [255, 214, 120],
        crystalDark: [240, 170, 80],
      }, 262);
    },
    shadow: [[1.2, 1.9, 2.5][s.stage], [1.2, 1.9, 2.5][s.stage]],
    stride: [1.1, 0.8, 0.55][s.stage],
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work', 'cast'],
    // Evolving, the motes rising round it are lavender and amber.
    motes: [[190, 160, 244], [255, 186, 92]],
    extra: (g, view, b, a, under) => {
      const front = !under;
      lanternGlow(g, view, s, b, a, front);
      if (front) eyeGlow(g, view, s, b, a);
      const act = a.act;
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, a, bones, act.t, front);
      else if (act.kind === 'cast' || act.kind === 'work') fearBurst(g, view, s, b, act.kind === 'work' ? frac(act.t) : act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const WHISPET = ghostKind(WHISPET_LOOK);
export const LANTERNVEIL = ghostKind(LANTERNVEIL_LOOK);
export const HALLOWMIRE = ghostKind(HALLOWMIRE_LOOK);
/** When each stage's strike lands, nought to one through it: for its voice. */
export const GHOST_HITS: readonly number[] = [WHISPET_LOOK.hit, LANTERNVEIL_LOOK.hit, HALLOWMIRE_LOOK.hit];
