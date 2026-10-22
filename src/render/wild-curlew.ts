import {
  ACT_SECS, add, beat, birdBones, clamp, coatPalette, cross, curve, cyc, DEG, dot, eyes, frac, lerp, merge, mirrored, mix, orb, orbAlong,
  paint, disc, scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BirdPose, type BirdSpec, type Bones, type Kind, type Piece,
} from './beasts';
import { birdLegPieces, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { patch } from './wild-birds';

/**
 * The wormbill line: the Pebblebeak, a round brown-speckled shorebird chick
 * with a cream belly, short legs and a long thin bill curved down, which
 * grows into the Soilwhistle, a sleeker curlew on longer legs, heavily
 * speckled, with a longer bill and a small crest at the back of its head;
 * and then the Wormheron, a great heron on long legs, shaggy cream plumage
 * on its body and neck, slate-blue wings, tail and spiky crest, and a long
 * heavy bill. The species is still `wurla` underneath, as saves and the
 * database know it: the digger of worms.
 *
 * Every one of them carries a pink worm hanging from the end of its bill,
 * wriggling: what it takes home. At its task it turns and lays the worm it
 * has on the pile at its side, bows to the ground ahead, probes it in quick
 * jabs, drives its bill in deep, and pulls -- three tugs, the worm stretched
 * taut between its bill and the hole, clods flicked up at each -- until the
 * worm comes free and swings, and it straightens with it (`BILL_WORK`).
 *
 * The two small ones walk in a quick-stepping bob, the Wormheron in a slow,
 * high-stepping stalk with its head carried smooth ahead of it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/**
 * A feather of a wing, built folded along the right flank: its root along the arm, how long and wide, the way it points folded and
 * spread (degrees round from straight back toward up), how far out from the flank it lies (its layer), its colour and its tip's,
 * from how far along the tip colour starts, and how many pale spots it has.
 */
interface Pinion { at: number; len: number; w: number; fold: number; open: number; layer: number; mat: Mat; tip?: Mat; tipFrom?: number; dots?: number }

/** A feather of a crest, a tail or a plume: its length and half-width, how far back from its axis it leans (degrees), and out to the side (degrees). */
type Plume = [number, number, number, number];

interface Bill {
  stage: 0 | 1 | 2;
  spec: BirdSpec;
  /** The body's egg, and how far its front is tipped up (degrees). */
  body: { c: V3; r: V3; pitch: number };
  /** How far down each flank the brown of the back comes (radians from the top); nought for a body all cream. */
  back: number;
  /** Dark specks and pale ones over the back. */
  specks: [number, number];
  /** The neck: how thick at the root and under the head, how long, and how far its middle bows back (an S). */
  neck: { w: [number, number]; len: number; bow: number };
  head: { c: V3; r: V3 };
  eye: { dir: V3; size: number };
  /** The bill: its root on the face, how long, how thick at the root, how far down its tip points (degrees), how far its middle arches up. */
  bill: { at: V3; len: number; w: number; drop: number; arch: number };
  /** The crest: its root on the crown, its feathers, and whether they are spikes (the Wormheron's) rather than soft feathers. */
  crest: { at: V3; plumes: Plume[]; spikes: boolean } | null;
  /** The wing: its shoulder, which way its feathers face out folded (out and up a little by default), and its feathers. */
  wing: { at: V3; face?: V3; pointed?: boolean; pinions: Pinion[] };
  tail: Plume[];
  /** The Wormheron's shag: plumes hanging down the front of its neck (how far up it, length), and down its breast and flanks. */
  shag: { neck: Array<[number, number]>; breast: Plume[]; flank: Array<[number, number]> } | null;
  leg: { shank: number; w: number };
  /** The worm it digs: how long, how thick. */
  worm: { len: number; r: number };
  /** How far it bows: the body tipped (degrees), the neck bent, the head down past level, the knees. */
  bow: { tip: number; neck: number; nose: number; crouch: number };
  size: number;
}

/** A Pebblebeak: small and round, a brown speckled back, a cream belly, short thin legs, a long thin bill curved down. */
const PEBBLEBEAK_LOOK: Bill = {
  stage: 0,
  spec: {
    high: 1.05,
    leg: { at: [0.3, -0.1, -0.5], len: [0.22, 0.32, 0.06], rest: [8, -22] },
    neck: { at: [0, 0.66, 0.3], len: 0.16, lean: 34 },
    head: { pitch: 0 },
    wing: { at: [0.66, 0.3, 0.24] },
    tail: { at: [0, -0.98, 0.22], lift: 16 },
    swing: [30, 40],
    thrust: 12,
    waddle: 2,
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.1,
  },
  body: { c: [0, -0.05, 0], r: [0.78, 1.06, 0.72], pitch: 2 },
  back: 1.2,
  specks: [18, 10],
  neck: { w: [0.5, 0.44], len: 0.16, bow: 0 },
  head: { c: [0, 0.26, 0.1], r: [0.54, 0.56, 0.5] },
  eye: { dir: [0.74, 0.42, 0.36], size: 0.15 },
  bill: { at: [0, 0.68, -0.02], len: 1.15, w: 0.065, drop: 38, arch: 0.12 },
  crest: null,
  wing: {
    at: [0.74, 0.32, 0.24],
    pinions: [
      { at: 0.12, len: 1.2, w: 0.2, fold: 8, open: 104, layer: 0, mat: 'featherDark' },
      { at: 0.18, len: 1.12, w: 0.21, fold: 3, open: 78, layer: 0.025, mat: 'featherDark' },
      { at: 0.02, len: 0.82, w: 0.29, fold: 12, open: 50, layer: 0.05, mat: 'feather', tip: 'featherDark', tipFrom: 0.72, dots: 3 },
      { at: 0.06, len: 0.66, w: 0.29, fold: 0, open: 22, layer: 0.08, mat: 'feather', tip: 'coatLight', tipFrom: 0.84, dots: 3 },
      { at: -0.02, len: 0.46, w: 0.27, fold: 16, open: -8, layer: 0.11, mat: 'feather', dots: 2 },
    ],
  },
  tail: [[0.58, 0.17, 8, 0], [0.52, 0.15, 14, -22], [0.52, 0.15, 14, 22]],
  shag: null,
  leg: { shank: 0.4, w: 0.065 },
  worm: { len: 1.1, r: 0.09 },
  bow: { tip: 26, neck: 34, nose: 30, crouch: 0.45 },
  size: 2.2,
};

/** A Soilwhistle: sleeker, on longer legs, heavily speckled, a longer bill, a small crest at the back of its head. */
const SOILWHISTLE_LOOK: Bill = {
  stage: 1,
  spec: {
    high: 1.9,
    leg: { at: [0.3, -0.14, -0.48], len: [0.48, 0.82, 0.07], rest: [14, -32] },
    neck: { at: [0, 0.82, 0.28], len: 0.4, lean: 32 },
    head: { pitch: 0 },
    wing: { at: [0.58, 0.38, 0.26] },
    tail: { at: [0, -1.18, 0.14], lift: 6 },
    swing: [26, 36],
    thrust: 10,
    waddle: 2,
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.2,
  },
  body: { c: [0, -0.1, 0], r: [0.68, 1.22, 0.66], pitch: 5 },
  back: 1.45,
  specks: [44, 16],
  neck: { w: [0.44, 0.34], len: 0.4, bow: 0.06 },
  head: { c: [0, 0.18, 0.14], r: [0.44, 0.52, 0.42] },
  eye: { dir: [0.74, 0.44, 0.36], size: 0.12 },
  bill: { at: [0, 0.58, 0.04], len: 1.75, w: 0.065, drop: 40, arch: 0.13 },
  crest: { at: [0, -0.3, 0.28], plumes: [[0.72, 0.13, 48, 0], [0.62, 0.12, 58, -22], [0.62, 0.12, 58, 22], [0.5, 0.11, 72, -8], [0.44, 0.1, 80, 10]], spikes: false },
  wing: {
    at: [0.64, 0.4, 0.26],
    pinions: [
      { at: 0.14, len: 1.7, w: 0.22, fold: 6, open: 104, layer: 0, mat: 'featherDark' },
      { at: 0.2, len: 1.62, w: 0.23, fold: 2, open: 80, layer: 0.025, mat: 'featherDark' },
      { at: 0.04, len: 1.2, w: 0.3, fold: 9, open: 54, layer: 0.05, mat: 'feather', tip: 'featherDark', tipFrom: 0.74, dots: 5 },
      { at: 0.08, len: 0.98, w: 0.3, fold: 1, open: 26, layer: 0.08, mat: 'feather', tip: 'coatLight', tipFrom: 0.86, dots: 5 },
      { at: 0.0, len: 0.74, w: 0.29, fold: 12, open: -4, layer: 0.11, mat: 'feather', dots: 5 },
      { at: -0.04, len: 0.5, w: 0.26, fold: 22, open: -16, layer: 0.14, mat: 'feather', dots: 3 },
    ],
  },
  tail: [[0.82, 0.19, 4, 0], [0.74, 0.17, 10, -20], [0.74, 0.17, 10, 20], [0.62, 0.15, 16, -36], [0.62, 0.15, 16, 36]],
  shag: null,
  leg: { shank: 0.9, w: 0.075 },
  worm: { len: 1.3, r: 0.1 },
  bow: { tip: 30, neck: 46, nose: 24, crouch: 0.62 },
  size: 2.45,
};

/** A Wormheron: large, on long legs, shaggy cream body and neck, slate-blue wings, tail and spiky crest, a long heavy bill. */
const WORMHERON_LOOK: Bill = {
  stage: 2,
  spec: {
    high: 2.9,
    leg: { at: [0.42, -0.16, -0.7], len: [0.8, 1.3, 0.1], rest: [12, -30] },
    neck: { at: [0, 1.3, 0.62], len: 2.8, lean: 28 },
    head: { pitch: -30 },
    wing: { at: [0.84, 0.5, 0.42] },
    tail: { at: [0, -1.5, 0.05], lift: -12 },
    swing: [22, 30],
    thrust: 16,
    waddle: 1.5,
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.1,
  },
  body: { c: [0, -0.1, 0], r: [1.16, 1.66, 1.08], pitch: 14 },
  back: 0,
  specks: [0, 0],
  neck: { w: [0.52, 0.24], len: 2.8, bow: 1.0 },
  head: { c: [0, 0.18, 0.12], r: [0.46, 0.6, 0.44] },
  eye: { dir: [0.76, 0.44, 0.34], size: 0.12 },
  bill: { at: [0, 0.66, 0.0], len: 2.3, w: 0.13, drop: 34, arch: 0.12 },
  crest: {
    at: [0, -0.34, 0.22],
    plumes: [[1.45, 0.08, 96, 0], [1.3, 0.075, 88, -12], [1.3, 0.075, 88, 12], [1.1, 0.07, 104, -24], [1.1, 0.07, 104, 24], [0.9, 0.065, 76, -6], [0.9, 0.065, 76, 8], [0.8, 0.06, 114, 0]],
    spikes: true,
  },
  // Folded flat against the flank, its feathers nearly in one plane, so it is a long blade tapering to the primaries from every side.
  wing: {
    at: [1.3, 1.05, 0.72],
    face: [1, 0, 0.25],
    pointed: true,
    pinions: [
      { at: 0.4, len: 3.5, w: 0.22, fold: -9, open: 104, layer: 0, mat: 'featherDark' },
      { at: 0.5, len: 3.2, w: 0.24, fold: -10, open: 86, layer: 0.025, mat: 'featherDark' },
      { at: 0.2, len: 2.6, w: 0.32, fold: -7, open: 64, layer: 0.05, mat: 'feather', tip: 'featherDark', tipFrom: 0.7 },
      { at: 0.26, len: 2.0, w: 0.36, fold: -8, open: 40, layer: 0.075, mat: 'feather', tip: 'featherDark', tipFrom: 0.8 },
      { at: 0.06, len: 1.4, w: 0.38, fold: -6, open: 14, layer: 0.1, mat: 'feather' },
      { at: 0.1, len: 0.85, w: 0.36, fold: -7, open: -6, layer: 0.125, mat: 'feather' },
    ],
  },
  // Long slate plumes fanned out past the wingtips.
  tail: [[2.4, 0.24, 4, 0], [2.3, 0.22, 8, -14], [2.3, 0.22, 8, 14], [2.05, 0.2, 14, -28], [2.05, 0.2, 14, 28], [1.7, 0.18, 20, -40], [1.7, 0.18, 20, 40]],
  shag: {
    neck: [[0.08, 0.8], [0.2, 0.76], [0.32, 0.72], [0.44, 0.66], [0.56, 0.6], [0.68, 0.52], [0.8, 0.44]],
    flank: [[0.55, 0.8], [0.3, 0.9], [0.05, 0.95], [-0.2, 0.9], [-0.45, 0.8]],
    breast: [[1.35, 0.3, 10, 0], [1.25, 0.28, 14, -22], [1.25, 0.28, 14, 22], [1.1, 0.27, 20, -44], [1.1, 0.27, 20, 44], [0.95, 0.25, 26, -66], [0.95, 0.25, 26, 66], [0.8, 0.22, 32, -86], [0.8, 0.22, 32, 86]],
  },
  leg: { shank: 1.4, w: 0.11 },
  worm: { len: 2.0, r: 0.15 },
  bow: { tip: 24, neck: 64, nose: 22, crouch: 0.3 },
  size: 2.8,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so speckles are not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A ringing that dies away, `since` seconds after a blow. */
const ringOut = (since: number, k: number, f = 2.4, damp = 4): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
/** A frame turned about z by `yaw` degrees, then pitched and rolled, at `t`. */
const frameAt = (t: V3, yaw: number, pitch = 0, roll = 0): Xf => joint(joint({ m: ROOT.m, t }, [0, 0, 0], 0, 0, yaw), [0, 0, 0], pitch, roll);
/** A bone's frame squashed toward its own ground: what sinks back into the soil. */
const sunk = (x: Xf, k: number): Xf => ({ m: [x.m[0], x.m[1], x.m[2] * k, x.m[3], x.m[4], x.m[5] * k, x.m[6], x.m[7], x.m[8] * k], t: x.t });
/** A bone's frame made smaller about its own joint. */
const shrunk = (x: Xf, k: number): Xf => ({ m: x.m.map((v) => v * k) as Xf['m'], t: x.t });
/** Which way a bone faces over the ground, in degrees (left positive), from where its forward goes. */
const headingOf = (x: Xf): number => Math.atan2(-x.m[1], x.m[4]) / DEG;
/** A frame from its three axes (each a direction in the body's frame) and its joint. */
const axes = (x: V3, y: V3, z: V3, t: V3): Xf => ({ m: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], t });

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function woundTo(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
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

/** The least `x` in `lo`..`hi` at which `f`, falling as `x` rises, is down to `goal`. */
function solve(f: (x: number) => number, goal: number, lo: number, hi: number): number {
  for (let q = 0; q < 22; q++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < goal) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/* ---- a feather ----------------------------------------------------------------------- */

/** Half a feather's outline, across and along it, from its root to its tip: a long vane, rounded and pointed at the end. */
type Vane = ReadonlyArray<readonly [number, number]>;
const VANE: Vane = [[0.6, 0.08], [0.92, 0.3], [1, 0.56], [0.78, 0.82], [0.36, 0.96]];
/** A narrow, pointed one, for a crest and the plumes of a shag. */
const LANCE: Vane = [[0.7, 0.1], [1, 0.3], [0.8, 0.6], [0.4, 0.86]];

/**
 * A feather from `root` along `dir`, `len` long and `w` across each side of its shaft, its face turned along `face`: two halves either
 * side of the shaft, each lifted toward its edge by `fold`, and arched along its length; from `tipFrom` of the way along it its tip is
 * `tip`. Its face and its back, whichever is turned to the viewer drawn. Pale spots on its face, `dots` of them.
 */
function featherMesh(root: V3, dir: V3, face: V3, len: number, w: number, mat: Mat, o: { tip?: Mat; tipFrom?: number; vane?: Vane; fold?: number; arch?: number; dots?: number; seed?: number } = {}): Mesh {
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n));
  const vane = o.vane ?? VANE, fold = o.fold ?? 0.2, arch = o.arch ?? 0.08;
  const at = (x: number, y: number): V3 => add(add(add(root, scale(d, y * len)), scale(side, x * w)), scale(n, fold * Math.abs(x) * w + arch * len * Math.sin(Math.PI * y)));
  const edge: Array<readonly [number, number]> = [[0, 0], ...vane, [0, 1]];
  const split = o.tip ? clamp(o.tipFrom ?? 0.75, 0.05, 0.95) : 1;
  // The edge across at the split, from the outline either side of it.
  let xs = 0;
  for (let q = 0; q < edge.length - 1; q++) {
    const [x0, y0] = edge[q], [x1, y1] = edge[q + 1];
    if (split >= y0 && split <= y1) xs = x0 + ((x1 - x0) * (split - y0)) / Math.max(1e-6, y1 - y0);
  }
  const v: V3[] = [];
  const f: Face[] = [];
  const want: V3[] = [];
  const nb = scale(n, -1);
  const poly = (pts: V3[], m: Mat): void => {
    const b = v.length;
    v.push(...pts);
    f.push({ i: pts.map((_, k) => b + k), m });
    want.push(n);
    const c = v.length;
    v.push(...pts);
    f.push({ i: pts.map((_, k) => c + k), m });
    want.push(nb);
  };
  for (const sd of [1, -1]) {
    const base = edge.filter(([, y]) => y > 0 && y < split).map(([x, y]) => at(sd * x, y));
    poly([at(0, 0), ...base, at(sd * xs, split), at(0, split)], mat);
    if (split < 1) {
      const tipPts = edge.filter(([, y]) => y > split && y < 1).map(([x, y]) => at(sd * x, y));
      poly([at(0, split), at(sd * xs, split), ...tipPts, at(0, 1)], o.tip ?? mat);
    }
  }
  const out = mesh(v, woundTo(v, f, want));
  if (!o.dots) return out;
  // Spots along each side of the shaft, on its face: pale, every third one dark.
  const spots = Array.from({ length: o.dots }, (_, q) => {
    const sd = q % 2 ? -1 : 1, y = 0.28 + (0.5 * (q + 0.5)) / o.dots! + 0.06 * jitter(q + (o.seed ?? 0));
    return disc(add(at(sd * 0.5, y), scale(n, 0.012)), n, w * 0.16, w * 0.24, 5, q % 3 === 1 ? 'spot' : 'coatLight', { up: d });
  });
  return merge(out, paint(spots));
}

/** Feathers from a root, each `up` degrees back from `axisUp` toward `axisBack` and `out` to the side, faced outward. */
function plumes(root: V3, list: readonly Plume[], axisUp: V3, axisBack: V3, mat: Mat, o: { tip?: Mat; tipFrom?: number; vane?: Vane; arch?: number; flat?: boolean; alt?: Mat } = {}): Mesh {
  return merge(...list.map(([len, w, up, out], q) => {
    const a = up * DEG, b = out * DEG;
    const inPlane = add(scale(axisUp, Math.cos(a)), scale(axisBack, Math.sin(a)));
    const dir = unit(add(scale(inPlane, Math.cos(b)), [Math.sin(b), 0, 0]));
    const sd = out < 0 ? -1 : out > 0 ? 1 : q % 2 ? -1 : 1;
    // Faced out to its side, or, `flat`, up: a tail seen from the side is its edge.
    const face = o.flat ? unit([sd * 0.25, 0, 1]) : unit([sd * 0.85, 0.1, 0.55]);
    const r = add(root, [sd * Math.min(0.06, Math.abs(out) * 0.003), 0, 0]);
    return featherMesh(r, dir, face, len, w, o.alt && q % 2 ? o.alt : mat, { ...o, arch: (o.arch ?? 0.1) * (0.8 + 0.4 * jitter(q + len)) });
  }));
}

/* ---- the worm ------------------------------------------------------------------------ */

/** How many rings down a worm. */
const WORM_RINGS = 12;

/**
 * A worm, straight down its own -z from its head at the origin, `len` long and `r` thick: pink, a darker saddle a third of the way
 * along, round at both ends. It is bent into its shape each moment (`wormBent`).
 */
function wormMesh(len: number, r: number, n: number): Mesh {
  const R = WORM_RINGS;
  const prof = [0.55, 0.85, 1, 1, 1, 1, 0.97, 0.94, 0.9, 0.84, 0.74, 0.55, 0.25];
  return tube(Array.from({ length: R + 1 }, (_, k) => [0, 0, (-len * k) / R] as V3), prof.map((p) => p * r), prof.map((p) => p * r), n,
    (ring) => (ring === 3 || ring === 4 ? 'membrane' : 'petal'));
}

/** How a worm lies: hanging from a bill and curled at its end, stretched taut, or lying on the ground. */
type WormWay = 'hang' | 'taut' | 'lie';

/**
 * A worm's corners as it is this moment: each ring carried to its place along a middle line worked out from how it lies, turned square
 * to it, and wriggling. `phase` sets one worm apart from another.
 */
function wormBent(v: readonly V3[], a: Anim, len: number, way: WormWay, phase: number): V3[] {
  const R = WORM_RINGS, t = a.t + phase;
  // The middle line, ring by ring: how far round from straight down it has turned toward its front (+y), and where each ring is.
  const at: V3[] = [[0, 0, 0]], tan: V3[] = [];
  const seg = len / R;
  let p: V3 = [0, 0, 0];
  for (let k = 0; k <= R; k++) {
    const s = k / R;
    let phi = 0, x = 0;
    if (way === 'hang') {
      // Hanging, its tail curled up into a hook that opens and closes as it writhes.
      phi = (2.5 + 0.5 * Math.sin(t * TAU * 0.9)) * smooth((s - 0.25) / 0.5) + 0.25 * Math.sin(t * TAU * 1.3 - s * 4) * s;
      x = 0.18 * len * s * s * Math.sin(t * TAU * 1.1 - s * 3);
    } else if (way === 'taut') {
      x = 0.06 * len * Math.sin(Math.PI * s) * Math.sin(t * TAU * 3 - s * 6);
    } else {
      // On the ground, an S that creeps.
      phi = 1.1 * Math.sin(s * TAU * 0.75 - t * TAU * 0.6);
      x = 0.02 * len * Math.sin(s * 9 + t * 4);
    }
    const tg: V3 = [0, Math.sin(phi), -Math.cos(phi)];
    tan.push(tg);
    if (k) p = add(p, scale(add(tg, tan[k - 1]), seg * 0.5));
    at[k] = [x, p[1], p[2]];
  }
  return v.map((q) => {
    const k = Math.max(0, Math.min(R, Math.round((-q[2] / len) * R)));
    const tg = tan[k], c = at[k];
    // A ring is built square to straight down; its across stays across (x), and what was toward its front turns with it.
    const e2: V3 = [0, -tg[2], tg[1]];
    return [c[0] + q[0], c[1] + e2[1] * q[1], c[2] + e2[2] * q[1]] as V3;
  });
}

/* ---- the moves, in time -------------------------------------------------------------- */

/** The strike: when the blow lands, a stage at a time. */
export const BILL_HITS: readonly number[] = [0.5, 0.52, 0.56];

/**
 * A go at its task, in shares of it: the worm it has laid on the pile at its side (`lay`), back round to the front (`back`), three
 * quick probing jabs at the ground (`jabs`), the bill driven in deep (`deep`), three tugs (`tugs`), the worm out (`pop`) and swung,
 * and a toss of the head to settle it (`toss`). The heap of soil it dug sinks away over `sink`.
 */
export const BILL_WORK = { lay: 0.1, back: 0.2, jabs: [0.27, 0.33, 0.39] as const, deep: 0.46, tugs: [0.55, 0.62, 0.69] as const, pop: 0.75, toss: 0.86, sink: [0.88, 1] as const } as const;

/** Its call now and then, standing: seconds into the loop. */
export const BILL_CALLS: readonly number[] = [6.2, 17.4];

/* ---- its bones ----------------------------------------------------------------------- */

/** How far its wings are spread (nought folded, one fanned open), rolled up and out about the shoulder (degrees), and swept forward. */
interface WingSet { spread: number; raise: number; sweep: number }

function wingsOf(s: Bill, a: Anim): WingSet {
  const act = a.act;
  let spread = 0, raise = 0, sweep = 0;
  if (act?.kind === 'strike') {
    const hit = BILL_HITS[s.stage];
    if (s.stage === 2) {
      // The heron's threat: wings opened wide and held up round it, then thrown forward with the stab.
      const open = ramp(act.t, 0.04, 0.3) * (1 - ramp(act.t, hit + 0.14, 0.98));
      spread = open;
      raise = open * (70 + 20 * ramp(act.t, hit - 0.16, hit));
      sweep = open * (-6 + 22 * ramp(act.t, hit - 0.16, hit));
    } else {
      // Flared as it gathers itself, and flicked with the blow.
      const k = ramp(act.t, 0.06, hit - 0.12) * (1 - ramp(act.t, hit + 0.1, 0.95));
      spread = 0.75 * k;
      raise = k * (34 + 40 * ramp(act.t, hit - 0.12, hit));
      sweep = 10 * hump(act.t, hit, 0.1);
    }
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.2, 0.48) * (1 - ramp(act.t, 0.62, 0.95));
    spread = k;
    raise = 68 * k;
  } else if (act?.kind === 'work') {
    // Half opened for balance as it pulls, and flapped once as the worm comes free.
    const W = BILL_WORK;
    const tug = ramp(act.t, W.tugs[0] - 0.05, W.tugs[0]) * (1 - ramp(act.t, W.pop, W.pop + 0.08));
    const flap = hump(act.t, W.pop + 0.03, 0.06);
    spread = 0.3 * tug + 0.7 * flap;
    raise = 18 * tug + 50 * flap;
    for (const tg of W.tugs) raise += 8 * hump(act.t, tg, 0.03);
  } else {
    const g = a.go;
    if (g > 0 && s.stage < 2) {
      // Held a little out at a run, for balance.
      spread = g * 0.2 * a.gait;
      raise = g * 26 * a.gait;
    }
    if (g < 1) {
      // A stretch of the wings now and then, up over its back.
      const still = 1 - g;
      const shake = beat(a.t, [11.3], 1.1) * still * (1 - a.graze);
      spread += 0.8 * shake;
      raise += shake * (74 + 6 * Math.sin(a.t * TAU * 2));
    }
  }
  return { spread: clamp(spread), raise, sweep };
}

/** How far the crest is lifted (degrees, up toward upright) and how it flutters (degrees, to the side), this moment. */
function crestOf(s: Bill, a: Anim): [number, number] {
  const t = a.t, act = a.act;
  let lift = 0, side = 0;
  if (act?.kind === 'strike') {
    const hit = BILL_HITS[s.stage];
    lift = 30 * ramp(act.t, 0.04, hit - 0.1) * (1 - ramp(act.t, hit + 0.12, 0.95));
    side = ringOut((act.t - hit) * ACT_SECS.strike, 9, 5, 5);
  } else if (act?.kind === 'evolve') {
    lift = 26 * ramp(act.t, 0.2, 0.5) * (1 - ramp(act.t, 0.6, 0.9));
  } else if (act?.kind === 'work') {
    for (const tg of BILL_WORK.tugs) side += ringOut((act.t - tg) * ACT_SECS.work, 7, 5, 6);
    lift = 14 * hump(act.t, BILL_WORK.pop + 0.04, 0.08);
  } else {
    const g = a.go, w = frac(a.u);
    lift = g * (5 * Math.sin(w * TAU * 2 - 1.1));
    const st = 1 - g;
    lift += st * (3 * cyc(t, 7) + 14 * beat(t, BILL_CALLS, 0.9));
    side = g * 3 * Math.sin(w * TAU - 0.6) + st * 2.5 * cyc(t, 11, 0.5);
  }
  return [lift, side];
}

/** How far it bows for each part of its task, worked out once from its own bones: the bill's tip over the ground, at it, and deep in. */
interface Reach { hover: number; ground: number; deep: number; lay: number }
const reaches = new Map<Bill, Reach>();

/** Which side it keeps its pile of worms: its right. */
const PILE_SIDE = 1;
/** How far round to its side it turns its head to lay a worm down, in degrees of the neck. */
const LAY_TURN = 50;

/** Bowed by `k`: the body tipped, the neck bent and the head down, the legs given the tip back and bent at the knee. */
function bowBy(s: Bill, p: BirdPose, k: number, side = 0): void {
  const B = s.bow, tip = k * B.tip;
  p.pitch -= tip;
  p.neck[0] += k * B.neck;
  p.neck[1] += side;
  p.head[0] += tip - k * B.nose;
  for (const l of p.legs) {
    l[0] += tip * (s.spec.stance ?? 1) + k * 20 * B.crouch;
    l[1] += k * B.crouch;
  }
}

/** The pose a stage stands in bowed by `k` and turned `side`, with nothing else: what its reach is measured on. */
const BASE: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
const bowedBones = (s: Bill, k: number, side = 0): Bones => birdBones(s.spec, BASE, (p) => {
  p.head = [0, 0, 0];
  p.tail = [0, 0];
  p.wings = [[0, 0], [0, 0]];
  bowBy(s, p, k, side);
});

function reachOf(s: Bill): Reach {
  const had = reaches.get(s);
  if (had) return had;
  const tip = billTip(s), grip = billGrip(s), big = [0.8, 1, 1.4][s.stage];
  const tipZ = (k: number, side = 0, at = tip): number => place(bowedBones(s, k, side).head, at)[2];
  const R: Reach = {
    hover: solve((k) => tipZ(k), 0.75 * big, 0, 2.5),
    ground: solve((k) => tipZ(k), 0.02, 0, 2.5),
    deep: solve((k) => tipZ(k), -0.2 * big, 0, 3),
    // Laying a worm down at its side: its grip down to a little over the ground, the worm's length hanging under it.
    lay: solve((k) => tipZ(k, -PILE_SIDE * LAY_TURN, grip), 0.1 * big + 0.35 * s.worm.len, 0, 2.5),
  };
  reaches.set(s, R);
  return R;
}

/** How far through each part of a go at its task it is: bowed (by its reach), turned to the side, leaning back on a tug, a jerk. */
function workOf(s: Bill, t: number): { bow: number; turn: number; lean: number; jerk: number; flick: number } {
  const W = BILL_WORK, R = reachOf(s);
  const turn = ramp(t, 0, 0.06) * (1 - ramp(t, W.lay + 0.03, W.back));
  const lay = R.lay * hump(t, W.lay, 0.08);
  // Bowed over the ground ahead from as it comes round to the front, then probing: down to the ground and up in quick jabs.
  const over = ramp(t, W.back - 0.06, W.jabs[0] - 0.03) * (1 - ramp(t, W.pop, W.pop + 0.06));
  let bow = over * R.hover;
  for (const j of W.jabs) bow = lerp(bow, R.ground, hump(t, j, 0.03) * over);
  // The deep probe, and held there, the pulls easing it up a little at a time.
  const deep = ramp(t, W.jabs[2] + 0.02, W.deep) * (1 - ramp(t, W.pop - 0.01, W.pop + 0.04));
  const pulled = W.tugs.reduce((acc, tg) => acc + ramp(t, tg - 0.01, tg + 0.02), 0) / W.tugs.length;
  bow = lerp(bow, lerp(R.deep, R.ground * 0.72, pulled), deep);
  const lean = ramp(t, W.tugs[0] - 0.06, W.tugs[0] - 0.01) * (1 - ramp(t, W.pop + 0.02, W.pop + 0.14));
  const jerk = W.tugs.reduce((acc, tg) => acc + hump(t, tg + 0.008, 0.022), 0);
  const flick = hump(t, W.pop + 0.035, 0.05);
  return { bow: Math.max(bow, lay), turn, lean, jerk, flick };
}

/**
 * Its own moves over the pose a bird has (`birdBones`): head cocked and a teeter of the tail standing, probing at the ground grazing,
 * a bob as it walks, its strike, its task, and evolving. The wings are posed on their own (`wingsOf`), so they are left folded here.
 */
function poseBill(s: Bill, p: BirdPose, a: Anim): void {
  p.wings = [[0, 0], [0, 0]];
  const act = a.act, t = a.t, R = reachOf(s);
  if (act) {
    const k = 1 - ramp(act.t, 0, 0.12) * (1 - ramp(act.t, 0.9, 1));
    p.head[1] *= k;
    p.head[2] *= k;
  }
  if (!act && a.go < 1) {
    const st = 1 - a.go;
    // A cock of the head to look at the ground, a call now and then, and the small ones' teeter: the tail bobbed up and down.
    const cock = beat(t, [2.4, 9.6, 19.0], 1.4) - beat(t, [7.1, 14.6], 1.2);
    p.head[2] += st * 22 * cock;
    p.head[1] *= 0.6;
    const call = beat(t, BILL_CALLS, 1.0) * st * (1 - a.graze);
    p.head[0] += 24 * call;
    p.neck[0] -= 10 * call;
    p.jaw = Math.max(p.jaw, call * 0.6 * (0.5 + 0.5 * Math.sin(t * TAU * 4)));
    if (s.stage < 2) {
      const teeter = beat(t, [4.1, 13.2, 21.0], 1.6) * st;
      p.pitch += teeter * 5 * Math.sin(t * TAU * 3);
      p.tail[0] += teeter * 14 * Math.sin(t * TAU * 3 + 0.8);
    }
    if (a.graze > 0) {
      // Grazing, it probes: bowed over the ground and jabbing at it, in bursts, the bill going in to its root and out.
      const g = a.graze * st;
      const burst = clamp(0.8 + 0.5 * cyc(t, 3));
      const jab = Math.max(0, cyc(t, s.stage === 2 ? 40 : 64)) ** 2 * burst;
      bowBy(s, p, g * lerp(lerp(R.hover, R.ground, 0.7), lerp(R.ground, R.deep, 0.5), jab));
    }
  }
  if (a.go > 0 && !act) {
    const g = a.go, w = frac(a.u);
    if (s.stage < 2) {
      // The quick-stepping bob: down on each foot as it lands and up as it passes over it, the body tipped forward a little.
      p.lift += g * (0.05 + 0.04 * a.gait) * Math.cos(w * TAU * 2);
      p.pitch += g * (-4 + 3 * Math.sin(w * TAU * 2));
    } else {
      // The stalk: each foot lifted high and set down slowly, the body level and steady over them, the head carried smoothly ahead.
      for (const l of p.legs) l[1] *= 1.7;
      p.lift *= 0.4;
      p.roll *= 0.5;
      p.pitch += g * 2 * Math.sin(w * TAU * 2);
    }
  }
  if (act?.kind === 'strike') {
    const hit = BILL_HITS[s.stage], since = (act.t - hit) * ACT_SECS.strike;
    const gather = ramp(act.t, 0.04, hit - 0.16) * (1 - ramp(act.t, hit - 0.14, hit));
    const thrust = ramp(act.t, hit - 0.14, hit) * (1 - ramp(act.t, hit + 0.1, 0.95));
    if (s.stage === 0) {
      // Crouched and drawn back, then a hop forward into a jab of the bill, and a bounce.
      p.lift += 0.35 * hump(act.t, hit - 0.06, 0.12);
      p.pitch += 12 * gather - 10 * thrust + ringOut(since, 5);
      p.neck[0] += -16 * gather + 26 * thrust;
      p.head[0] += 14 * gather + 22 * thrust;
      for (const l of p.legs) { l[0] += 16 * gather - 4 * thrust; l[1] += 0.5 * gather; }
    } else if (s.stage === 1) {
      // Crouched low with the neck drawn back, then a hard stab forward of the long bill, and a rebound.
      p.pitch += 6 * gather - 8 * thrust + ringOut(since, 4);
      p.neck[0] += -24 * gather + 44 * thrust;
      p.head[0] += 16 * gather + 26 * thrust;
      p.tail[0] += 14 * gather - 8 * thrust;
      for (const l of p.legs) { l[0] += 10 * gather + 14 * thrust; l[1] += 0.45 * gather + 0.2 * thrust; }
    } else {
      // The neck drawn back into an S, wings up, then the bill driven out like a spear.
      p.pitch += 10 * gather - 6 * thrust + ringOut(since, 4);
      p.neck[0] += -34 * gather + 52 * thrust;
      p.head[0] += 24 * gather + 16 * thrust;
      p.tail[0] += -10 * gather + 8 * thrust;
      for (const l of p.legs) { l[0] += -4 * gather + 10 * thrust; l[1] += 0.2 * gather; }
    }
    p.jaw = Math.max(p.jaw, 0.8 * hump(act.t, hit - 0.08, 0.1));
  } else if (act?.kind === 'work') {
    const w = workOf(s, act.t);
    bowBy(s, p, w.bow, -PILE_SIDE * LAY_TURN * w.turn);
    p.head[1] += -PILE_SIDE * 20 * w.turn;
    // Pulling: leant back on braced legs, and a jerk of the head up and back at each tug.
    const big = [1, 1, 0.8][s.stage];
    p.pitch += big * (20 * w.lean + 5 * w.jerk);
    for (const l of p.legs) {
      l[0] -= (20 * w.lean + 5 * w.jerk) * big * (s.spec.stance ?? 1) - 10 * w.lean;
      l[1] += 0.25 * w.lean;
    }
    p.neck[0] -= 14 * w.jerk * big;
    p.head[0] += 8 * w.jerk * big;
    // The worm out: the head flung up, a little hop for the small ones, and a toss of the head to settle it.
    p.head[0] += 26 * w.flick + 14 * hump(act.t, BILL_WORK.toss, 0.04);
    p.neck[0] -= 18 * w.flick;
    if (s.stage < 2) p.lift += 0.18 * w.flick;
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.65, 0.95));
    p.neck[0] -= 14 * k;
    p.head[0] += 14 * k;
    p.lift += 0.25 * k;
  }
}

/** How far forward its strike carries the whole of it this moment, in its own units, and back again after. */
function surgeOf(s: Bill, a: Anim): number {
  if (a.act?.kind !== 'strike') return 0;
  const t = a.act.t, hit = BILL_HITS[s.stage];
  return [0.8, 0.6, 0.6][s.stage] * ramp(t, hit - 0.16, hit) * (1 - ramp(t, hit + 0.12, 0.96));
}

/** The bones of a stage in a pose, before its worms are placed: its body, its wings, its crest. */
function poseOf(s: Bill, a: Anim): Bones {
  const act = a.act;
  const b = birdBones(s.spec, act ? { ...a, go: 0 } : a, (p) => poseBill(s, p, a));
  // A wing's bone is its shoulder, square to the body; it is opened, rolled up and out and swept within itself (`wingBent`).
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1, at = s.wing.at;
    b[`wing${k}`] = joint(b.body, [sd * at[0], at[1], at[2]]);
  }
  if (s.crest) {
    const [lift, side] = crestOf(s, a);
    b.crest = joint(b.head, s.crest.at, lift, side);
  }
  const fwd = surgeOf(s, a);
  if (fwd) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + fwd, b[k].t[2]] };
  return b;
}

/** The bill's middle line, root to tip, in the head's frame. */
const billLine = (s: Bill): V3[] => {
  const B = s.bill, d = B.drop * DEG;
  const tip = add(B.at, [0, Math.cos(d) * B.len, -Math.sin(d) * B.len]);
  // Curved evenly: leaving the face a little under level, and pointing well down at its tip.
  return curve(B.at, add(B.at, [0, B.len * 0.52, -B.len * B.arch]), tip, 6);
};
/** Where the bill's tip is, in the head's frame. */
const billTip = (s: Bill): V3 => billLine(s)[6];
/** Where on the bill a worm is held, just short of the tip. */
const billGrip = (s: Bill): V3 => { const l = billLine(s); return add(scale(l[6], 0.6), scale(l[5], 0.4)); };

/** A stage's ground points, once: where it probes, where it keeps its pile of worms, and where its strike lands. */
interface Site { hole: V3; pile: V3; hit: V3 }
const sites = new Map<Bill, Site>();
function siteOf(s: Bill): Site {
  const had = sites.get(s);
  if (had) return had;
  const at = (t: number): Bones => poseOf(s, { ...BASE, act: { kind: 'work', t } });
  const hole = place(at(BILL_WORK.deep + 0.03).head, billTip(s));
  const pile = place(at(BILL_WORK.lay).head, billGrip(s));
  const hit = place(poseOf(s, { ...BASE, act: { kind: 'strike', t: BILL_HITS[s.stage] } }).head, billTip(s));
  const site = { hole: [hole[0], hole[1], 0] as V3, pile: [pile[0], pile[1], 0] as V3, hit };
  sites.set(s, site);
  return site;
}

/** Whether the worm hangs from its bill this moment: all but from laying one down to pulling the next out. */
const carrying = (a: Anim): boolean => !(a.act?.kind === 'work' && a.act.t >= BILL_WORK.lay && a.act.t < BILL_WORK.pop);
/** Whether a worm is stretched between its bill and the ground: from when it drives in deep to when the worm comes out. */
const pulling = (a: Anim): boolean => a.act?.kind === 'work' && a.act.t >= BILL_WORK.deep + 0.02 && a.act.t < BILL_WORK.pop;

/** How the worm it carries swings, forward and to the side (degrees): lagging the head as it goes, strikes and pulls. */
function swingOf(s: Bill, a: Anim): [number, number] {
  const act = a.act;
  if (act?.kind === 'strike') {
    const hit = BILL_HITS[s.stage];
    return [-30 * ramp(act.t, hit - 0.14, hit) * (1 - ramp(act.t, hit, 0.9)) + ringOut((act.t - hit) * ACT_SECS.strike, 34, 1.8, 3.5), 0];
  }
  if (act?.kind === 'work') {
    const since = (act.t - BILL_WORK.pop) * ACT_SECS.work;
    return [ringOut(since, 50, 2.2, 8) + ringOut((act.t - BILL_WORK.toss) * ACT_SECS.work, -20, 2.4, 9), ringOut(since, 14, 1.6, 8)];
  }
  if (act) return [0, 0];
  const w = frac(a.u) * TAU, g = a.go;
  return [g * (10 * Math.sin(w * 2 - 1.4) - 8 * a.gait) + (1 - g) * 4 * cyc(a.t, 6), g * 6 * Math.sin(w - 1.2) + (1 - g) * 3 * cyc(a.t, 4, 1)];
}

/** The worms on its pile: where each lies against the pile's middle, and which way (degrees). */
const PILE: ReadonlyArray<readonly [number, number, number]> = [[-0.15, 0.1, 30], [0.18, -0.08, 160]];

function billBones(s: Bill): (a: Anim) => Bones {
  return (a) => {
    const b = poseOf(s, a);
    const W = BILL_WORK, act = a.act, big = [0.8, 1, 1.4][s.stage];
    const site = siteOf(s);
    // The worm it carries, hung from its bill and swinging; swallowed as it bows to graze, and given back as it lifts its head.
    const gulp = act ? 0 : a.graze;
    if (carrying(a) && gulp < 0.98) {
      const [fwd, side] = swingOf(s, a);
      const x = frameAt(place(b.head, billGrip(s)), headingOf(b.head), fwd, side);
      b.worm = gulp > 0.01 ? shrunk(x, 1 - gulp) : x;
    }
    if (act?.kind === 'work') {
      // Its pile at its side, and the worm it lays on it, creeping in among the others at the end.
      const lie = (c: V3, yaw: number): Xf => {
        const d: V3 = [Math.cos(yaw * DEG), Math.sin(yaw * DEG), 0];
        return axes([0, 0, 1], cross(scale(d, -1), [0, 0, 1]), scale(d, -1), add(site.pile, [c[0] * big, c[1] * big, s.worm.r * 0.9]));
      };
      PILE.forEach(([x, y, yaw], q) => { b[`pile${q}`] = lie([x, y, 0], yaw); });
      if (act.t >= W.lay) {
        const laid = lie([0.02, 0.0, 0], 95);
        b.laid = act.t > W.sink[0] ? shrunk(laid, Math.max(0.02, 1 - ramp(act.t, W.sink[0], W.sink[1]))) : laid;
      }
      // The heap it digs up where it probes, growing with each jab, and sinking back at the end.
      const dug = ramp(act.t, W.jabs[0] - 0.02, W.deep) * 0.6 + 0.4 * ramp(act.t, W.tugs[0], W.pop);
      if (dug > 0.01) {
        const heap = shrunk(frameAt(site.hole, 0), 0.4 + 0.6 * dug);
        b.heap = act.t > W.sink[0] ? shrunk(sunk(heap, Math.max(0.02, 1 - ramp(act.t, W.sink[0], W.sink[1]))), Math.max(0.02, 1 - ramp(act.t, W.sink[0], W.sink[1]))) : heap;
      }
      // The worm being pulled: from the bill's tip down into the hole, stretched taut.
      if (pulling(a)) {
        const tip = place(b.head, billTip(s));
        const hole: V3 = [site.hole[0], site.hole[1], -0.1 * big];
        const d = sub(tip, hole), dist = Math.hypot(d[0], d[1], d[2]);
        if (dist > 0.05) {
          const z = scale(d, 1 / dist);
          let x = cross([0, 0, 1], z);
          x = Math.hypot(x[0], x[1], x[2]) < 1e-3 ? [1, 0, 0] : unit(x);
          const y = cross(z, x);
          const k = dist / s.worm.len;
          b.pull = axes(x, y, scale(z, k), tip);
        }
      }
    }
    return b;
  };
}

/* ---- its pieces ---------------------------------------------------------------------- */

/** A wing's feathers, built folded along the right flank, and how to fan them: each feather's corners, and its turn about its root. */
function wingOf(s: Bill): { mesh: Mesh; spans: Array<[number, number, V3, number]> } {
  const parts: Mesh[] = [];
  const spans: Array<[number, number, V3, number]> = [];
  let count = 0;
  // The arm goes back along the flank from the shoulder, a little down.
  const arm = unit([0, -1, -0.22]);
  s.wing.pinions.forEach((P, q) => {
    const root = add(scale(arm, P.at), [P.layer, 0, 0]);
    const a = P.fold * DEG;
    const dir: V3 = [0, -Math.cos(a), Math.sin(a)];
    const m = featherMesh(root, dir, s.wing.face ?? [1, 0, 0.5], P.len, P.w, P.mat, { tip: P.tip, tipFrom: P.tipFrom, fold: s.wing.face ? 0.06 : 0.16, arch: s.wing.face ? 0.01 : 0.05, dots: P.dots, seed: q * 3, vane: s.wing.pointed ? LANCE : VANE });
    parts.push(m);
    spans.push([count, count + m.v.length, root, (P.open - P.fold) * DEG]);
    count += m.v.length;
  });
  return { mesh: merge(...parts), spans };
}

/** A wing's corners as it is this moment (`wingsOf`), on the left (`sd` -1) or the right: fanned, rolled up and out, swept forward. */
function wingBent(s: Bill, v: readonly V3[], spans: ReadonlyArray<[number, number, V3, number]>, a: Anim, sd: number): V3[] {
  const W = wingsOf(s, a);
  const out = fanned(v, spans, W.spread, sd);
  if (Math.abs(W.raise) < 0.01 && Math.abs(W.sweep) < 0.01) return out;
  const r = sd * W.raise * DEG, y = -sd * W.sweep * DEG;
  const cr = Math.cos(r), sr = Math.sin(r), cy = Math.cos(y), sy = Math.sin(y);
  return out.map(([x0, y0, z0]) => {
    const x1 = cr * x0 + sr * z0, z1 = -sr * x0 + cr * z0;
    return [cy * x1 - sy * y0, sy * x1 + cy * y0, z1] as V3;
  });
}

/** A wing's corners fanned open by `k` (nought folded, one spread), each feather turned about its own root. */
function fanned(v: readonly V3[], spans: ReadonlyArray<[number, number, V3, number]>, k: number, sd: number): V3[] {
  if (k <= 0.001) return v as V3[];
  const out = v.slice() as V3[];
  for (const [s0, e, r0, turn] of spans) {
    const r: V3 = [sd * r0[0], r0[1], r0[2]];
    const c = Math.cos(turn * k), sn = Math.sin(turn * k);
    for (let i = s0; i < e; i++) {
      const y = v[i][1] - r[1], z = v[i][2] - r[2];
      out[i] = [v[i][0], r[1] + y * c + z * sn, r[2] - y * sn + z * c];
    }
  }
  return out;
}

/** A heap of turned soil, `r` across: a low mound with clods round it and the dark hole in its top. */
function heapMesh(r: number, n: number): Mesh {
  return merge(
    orbAlong([0, 0, 0], [0, 0, 1], [r, r * 0.9, r * 0.3], n, 3, 'bark'),
    ...[0, 1, 2, 3, 4].map((q) => {
      const a = q * 1.3 + 0.5, d = r * (0.85 + 0.25 * jitter(q + 5)), c = r * (0.16 + 0.08 * jitter(q + 9));
      return orbAlong([Math.cos(a) * d, Math.sin(a) * d, c * 0.5], [0, 0, 1], [c, c, c * 0.75], 5, 3, q % 2 ? 'shellDark' : 'shell');
    }),
    paint([disc([0, 0, r * 0.31], [0, 0, 1], r * 0.22, r * 0.18, 7, 'stoneDark')]),
  );
}

function billBuild(s: Bill, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7);
  const B = s.body, H = s.head;
  // The body: an egg tipped up at the front, the brown of the back over it, the cream of the breast below, paler under.
  const rings = k + 3, around = n + 3;
  const egg = tube(Array.from({ length: rings + 1 }, (_, q) => [B.c[0], B.c[1] - B.r[1] * Math.cos((Math.PI * q) / rings), B.c[2]] as V3),
    Array.from({ length: rings + 1 }, (_, q) => B.r[0] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    Array.from({ length: rings + 1 }, (_, q) => B.r[2] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    around, (ring, j) => {
      const ang = (((j + 1) / around) * TAU) % TAU;
      if (s.back > 0 && ring < rings - 1 && Math.abs(ang - Math.PI / 2) < s.back * (ring < 2 ? 1.2 : 1)) return 'feather';
      return Math.abs(ang - Math.PI * 1.5) < 0.95 ? 'belly' : 'coat';
    });
  // Speckled over the back: dark specks and pale ones, each painted on the egg; and fine streaks down the sides of the breast.
  const [dark, pale] = lod ? s.specks : [Math.round(s.specks[0] * 0.6), Math.round(s.specks[1] * 0.6)];
  const speck = (q: number, m: Mat, size: number, front = false): Mesh => {
    const u = jitter(q * 2 + 1), v = jitter(q * 2 + 2), sd = q % 2 ? 1 : -1;
    const along = front ? 0.45 + 0.4 * u : -0.85 + 1.5 * u;
    const round = front ? 0.75 + 0.35 * v : s.back * 0.85 * v;
    const dir: V3 = [sd * Math.sin(round), along, front ? Math.cos(round) - 0.2 : Math.cos(round)];
    return patch(B.c, B.r, dir, size * (0.7 + 0.5 * jitter(q + 40)), size * 0.7, m, { sides: 5 });
  };
  const specks = merge(
    ...Array.from({ length: dark }, (_, q) => speck(q, 'spot', 0.085)),
    ...Array.from({ length: pale }, (_, q) => speck(q + 100, 'coatLight', 0.06)),
    ...(s.back > 0 ? Array.from({ length: lod ? 8 : 4 }, (_, q) => speck(q + 200, 'coatDark', 0.05, true)) : []),
  );
  const tilt = (m: Mesh): Mesh => mesh(m.v.map((p) => {
    const a = B.pitch * DEG, y = p[1] - B.c[1], z = p[2] - B.c[2];
    return [p[0], B.c[1] + y * Math.cos(a) - z * Math.sin(a), B.c[2] + y * Math.sin(a) + z * Math.cos(a)] as V3;
  }), m.f);
  const body = tilt(merge(egg, specks));
  // The neck: up from the shoulders, bowed back in its middle for the heron's S; brown at its back on the two speckled ones.
  const N = s.neck;
  // Along a curve of two bends: out forward low down, back high up, and forward again into the back of the head.
  const P0: V3 = [0, 0, -0.3], P1: V3 = [0, N.bow * 0.5, N.len * 0.35], P2: V3 = [0, -N.bow * 1.2, N.len * 0.65], P3: V3 = [0, 0.04, N.len + 0.05];
  const links = N.bow > 0.3 ? 10 : 4;
  const neckPts: V3[] = Array.from({ length: links }, (_, q) => {
    const u = q / (links - 1), v = 1 - u;
    return add(add(scale(P0, v * v * v), scale(P1, 3 * v * v * u)), add(scale(P2, 3 * v * u * u), scale(P3, u * u * u)));
  });
  const neckW = neckPts.map((_, q) => lerp(N.w[0], N.w[1], smooth(q / (neckPts.length - 1))));
  const neck = tube(neckPts, neckW, neckW, n,
    (_r, j) => (s.back > 0 && Math.sin(((j + 1) / n) * TAU) < -0.35 ? 'feather' : 'coat'), { seam: 'both', up: [0, 1, 0] });
  // The head: an egg of cream, a brown cap over the crown and nape, a pale brow and a dark stripe through the eye, a pale ring round it.
  const skull = orb(H.c, H.r, n + 2, k + 1, 'coat');
  const capMat: Mat = s.stage === 2 ? 'mark' : 'feather';
  const cap = s.stage < 2 && patch(H.c, H.r, [0, -0.35, 1], 0.8, 0.95, capMat, { sides: 14 });
  const capSpecks = s.stage < 2 && merge(...Array.from({ length: lod ? 6 : 3 }, (_, q) => patch(H.c, H.r, [(jitter(q + 60) - 0.5) * 1.2, -0.6 + 0.9 * jitter(q + 70), 1], 0.08, 0.06, 'spot', { sides: 5 })));
  const stripe = (sd: number): Mesh | false => s.stage < 2 && patch(H.c, H.r, [sd * 0.62, 0.72, 0.14], 0.42, 0.07, 'featherDark', { sides: 8 });
  const brow = (sd: number): Mesh | false => s.stage < 2 && patch(H.c, H.r, [sd * 0.58, 0.5, 0.62], 0.4, 0.08, 'coatLight', { sides: 8 });
  const look = (shut: boolean): Mesh => eyes(H.c, H.r, s.eye.dir, s.eye.size, { shut, tall: 1.08, rim: 0.32, glint: 0.4 });
  // The bill: long, thin and curved down, pink at its root; the lower half on the jaw.
  const line = billLine(s), Bk = s.bill;
  const upper = taper(line, Bk.w, Bk.w * 0.18, 6, (ring) => (ring < 1 ? 'inner' : ring < 2 && s.stage === 2 ? 'inner' : 'bill'), 0.9);
  const lowLine = line.slice(0, 6).map((p, q) => add(p, [0, -0.01 * q, -Bk.w * (0.5 - 0.06 * q)]));
  const lower = taper(lowLine, Bk.w * 0.78, Bk.w * 0.18, 5, (ring) => (ring < 1 ? 'inner' : 'billDark'), 0.7);
  const headMesh = (shut: boolean): Mesh => merge(skull, cap, capSpecks, stripe(1), stripe(-1), brow(1), brow(-1), look(shut));
  // The tail: a short fan of feathers, dark at the tips.
  const tail = plumes([0, 0, 0], s.tail, [0, -1, 0.04], [0, -0.1, 1], 'feather', { tip: 'featherDark', tipFrom: s.stage === 2 ? 0.7 : 0.62, arch: 0.06, flat: true, vane: s.stage === 2 ? VANE : LANCE });
  const wing = wingOf(s);
  const L0 = s.spec.leg.len[0];
  const thigh = orbAlong([0, 0.02, -L0 * 0.5], [0, 0, 1], [s.leg.w * 2.6, s.leg.w * 2.8, L0 * 0.62], n, k, s.stage === 2 ? 'coat' : 'belly');
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } },
    { key: 'tail', mesh: tail, bone: 'tail0', bias: -0.08, lines: false },
    { key: 'neck', mesh: neck, bone: 'neck', bias: 0, under: 'head', convex: true, lines: false },
    { key: 'head', mesh: headMesh(false), shut: headMesh(true), bone: 'head', bias: 0.2 },
    // The bill a piece of its own, outlined thin: a full outline would be most of it.
    { key: 'bill', mesh: upper, bone: 'head', bias: 0.205, thin: true },
    { key: 'jaw', mesh: lower, bone: 'jaw', bias: 0.19, under: 'head', thin: true },
    ...[0, 1].map((q): Piece => {
      const sd = q ? 1 : -1;
      return {
        key: `wing${q}`, mesh: q ? wing.mesh : mirrored(wing.mesh), bone: `wing${q}`, bias: 0.04, after: 'body', front: [sd, 0, 0], airy: true,
        bent: (v, a) => wingBent(s, v, wing.spans, a, sd),
      };
    }),
    ...[0, 1].map((q): Piece => ({
      key: `thigh${q}`, mesh: thigh, bone: `${['bl', 'br'][q]}0`, bias: 0.015, after: 'body', front: [q ? 1 : -1, 0.3, 0], lines: false,
    })),
    ...birdLegPieces('bl', -1, s.leg.shank, s.leg.w, 5),
    ...birdLegPieces('br', 1, s.leg.shank, s.leg.w, 5),
  ];
  if (s.crest) {
    const C = s.crest;
    // Soft feathers swept back off the nape, or the heron's spikes.
    const crest = C.spikes
      ? merge(...C.plumes.map(([len, w, up, out]) => {
        const a = up * DEG, b = out * DEG;
        const dir = unit(add(scale(add(scale([0, 0.1, 1], Math.cos(a)), scale([0, -1, 0.1], Math.sin(a))), Math.cos(b)), [Math.sin(b), 0, 0]));
        return taper(curve([0, 0, 0], scale(dir, len * 0.55), add(scale(dir, len), [0, 0, len * 0.12]), 3), w * 1.6, 0.008, 5, (ring) => (ring < 2 ? 'feather' : 'featherDark'), 0.55, [1, 0, 0]);
      }))
      : plumes([0, 0, 0], C.plumes, [0, 0.1, 1], [0, -1, 0.1], 'feather', { vane: LANCE, tip: 'featherDark', tipFrom: 0.7, arch: 0.12 });
    pieces.push({ key: 'crest', mesh: crest, bone: 'crest', bias: 0.21, after: 'head', hide: [{ c: H.c, r: scale(H.r, 0.86) }], hideIn: 'head', lines: false });
  }
  if (s.shag) {
    // The heron's shag: long cream plumes hanging down the front of its neck, and down over its breast and flanks.
    const S = s.shag;
    // Tufts all round the neck, following its S: one down the front and one each side at every height, hanging and splayed a little.
    const neckAt = (u: number): V3 => {
      const z = u * (N.len + 0.35) - 0.3;
      for (let q = 0; q < neckPts.length - 1; q++) {
        const a = neckPts[q], b = neckPts[q + 1];
        if (z <= b[2] || q === neckPts.length - 2) return add(a, scale(sub(b, a), clamp((z - a[2]) / (b[2] - a[2]))));
      }
      return neckPts[0];
    };
    const neckShag = merge(...S.neck.flatMap(([up, len], q) => [0, -62, 62].map((round, r) => {
      const c = neckAt(up), w = lerp(neckW[0], neckW[neckW.length - 1], up) * 0.92, a = (round + (q % 2 ? 12 : -12)) * DEG;
      const out: V3 = [Math.sin(a), Math.cos(a), 0];
      return featherMesh(add(c, scale(out, w)), unit(add([0, 0, -1], scale(out, 0.42))), out, len * (r ? 0.7 : 1), 0.2, (q + r) % 3 === 1 ? 'muzzle' : (q + r) % 3 === 2 ? 'mark' : 'coat', { vane: LANCE, arch: 0.14, fold: 0.3 });
    })));
    const breast = plumes([0, B.c[1] + B.r[1] * 0.8, B.c[2] + B.r[2] * 0.3], S.breast, [0, 0.35, -1], [0, -1, 0], 'coat', { vane: LANCE, arch: 0.14, alt: 'muzzle' });
    // A fringe of plumes hanging from each flank under the wing, ragged along the belly.
    const fringe = merge(...S.flank.flatMap(([along, len], q) => [1, -1].map((sd) => {
      const y = B.c[1] + along * B.r[1], k = Math.sqrt(Math.max(0.05, 1 - along * along));
      return featherMesh([sd * B.r[0] * k * 0.86, y, B.c[2] - B.r[2] * k * 0.35], unit([sd * 0.25, -0.45, -1]), unit([sd, 0.1, -0.1]), len, 0.22, (q + (sd > 0 ? 0 : 1)) % 2 ? 'muzzle' : 'coat', { vane: LANCE, arch: 0.1, fold: 0.25 });
    })));
    pieces.push(
      { key: 'neckShag', mesh: neckShag, bone: 'neck', bias: 0.03, after: 'neck', lines: false },
      { key: 'breast', mesh: tilt(breast), bone: 'body', bias: 0.03, after: 'body', lines: false },
      { key: 'fringe', mesh: tilt(fringe), bone: 'body', bias: 0.02, after: 'body', lines: false },
    );
  }
  // The worms: the one in its bill, the one it pulls up, those on its pile, and the one it lays there; and the heap it digs.
  const W = s.worm;
  const worm = wormMesh(W.len, W.r, 6);
  pieces.push(
    { key: 'worm', mesh: worm, bone: 'worm', bias: 0.23, bent: (v, a) => wormBent(v, a, W.len, 'hang', 0), thin: true },
    { key: 'pull', mesh: worm, bone: 'pull', bias: 0.22, bent: (v, a) => wormBent(v, a, W.len, 'taut', 0.3), thin: true },
    { key: 'laid', mesh: worm, bone: 'laid', bias: 0.012, bent: (v, a) => wormBent(v, a, W.len, 'lie', 0.6), thin: true },
    ...PILE.map((_, q): Piece => ({ key: `pile${q}`, mesh: worm, bone: `pile${q}`, bias: 0.01, bent: (v, a) => wormBent(v, a, W.len, 'lie', 1.7 + q * 2.3), thin: true })),
    { key: 'heap', mesh: heapMesh([0.3, 0.36, 0.5][s.stage], n), bone: 'heap', bias: 0.26, airy: true },
  );
  return pieces;
}

/* ---- the ground it works ------------------------------------------------------------- */

/** The soil it turns: a dark patch where it probes, and clods flicked up at each tug and as the worm comes out. */
const SOIL: RGB = [128, 98, 70];
const SOIL_DARK: RGB = [92, 68, 50];
const CLOD: RGB = [118, 88, 62];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al.toFixed(3)})`;

function groundPatch(g: CanvasRenderingContext2D, view: View, c: V3, r: number, fill: RGB, al: number): void {
  if (al <= 0.01) return;
  g.beginPath();
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * TAU, rr = r * (0.84 + 0.2 * jitter(q + 2));
    const [x, y] = onScreen(view, [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.9, 0]);
    if (q) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = css(fill, al);
  g.fill();
}

/**
 * Clods thrown up from `c`, `since` seconds after: `count` lumps of soil, each flung out and up and falling back, tumbling, the dark
 * ones in one path and the light in another.
 */
function clods(g: CanvasRenderingContext2D, view: View, c: V3, since: number, id: number, big: number, count: number, away: number): void {
  if (since < 0 || since > 0.42) return;
  const al = 1 - smooth((since - 0.3) / 0.12);
  // Never smaller than a pixel across, however far out the island is drawn.
  const tr = g.getTransform(), px = 0.7 / (Math.hypot(tr.a, tr.b) || 1);
  for (const [tone, pick] of [[CLOD, 0], [SOIL_DARK, 1]] as const) {
    g.beginPath();
    for (let q = 0; q < count; q++) {
      if (q % 2 !== pick) continue;
      const k = id + q * 7;
      // Flung away from the bird, out to either side of straight back from the hole.
      const a = away + (jitter(k) - 0.5) * 2.4, sp = big * (3 + 3 * jitter(k + 1));
      const p: V3 = [c[0] + Math.cos(a) * sp * since, c[1] + Math.sin(a) * sp * since, big * (6 + 4 * jitter(k + 2)) * since - 30 * since * since];
      if (p[2] < -0.02) continue;
      const [x, y] = onScreen(view, p);
      const r = Math.max(px, big * (0.16 + 0.1 * jitter(k + 3))), spin = jitter(k + 4) * TAU + since * 16;
      for (let e = 0; e < 4; e++) {
        const ang = spin + (e / 4) * TAU, rr = r * (0.75 + 0.4 * jitter(k + e + 5));
        const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.8;
        if (e) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    }
    g.fillStyle = css(tone, al);
    g.fill();
  }
}

/** Down feathers knocked loose by its strike, drifting out from where it lands. */
function fluff(g: CanvasRenderingContext2D, view: View, c: V3, since: number, big: number): void {
  if (since < 0 || since > 0.3) return;
  const al = 0.9 * (1 - smooth((since - 0.15) / 0.15));
  g.beginPath();
  for (let q = 0; q < 5; q++) {
    const a = (q / 5) * TAU + jitter(q) * 0.8, sp = big * (1.4 + jitter(q + 3));
    const d = (sp * (1 - Math.exp(-since * 8))) / 8;
    const [x, y] = onScreen(view, [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, c[2] + d * 0.6 - since * 0.5]);
    const r = big * 0.07;
    g.moveTo(x + r, y);
    g.ellipse(x, y, r, r * 0.55, a, 0, TAU);
  }
  g.fillStyle = `rgba(250,244,230,${al.toFixed(3)})`;
  g.fill();
}

/* ---- the kinds ----------------------------------------------------------------------- */

function billKind(s: Bill): Kind {
  return {
    bones: billBones(s),
    build: (lod) => billBuild(s, lod),
    // The variant's coat is the brown of its back, its markings the cream of its breast; the Wormheron's back is a slate blue with
    // a little of the coat in it. The worm, the soil and the bill are the same on every variant.
    palette: (coat, mark) => {
      const cream = mix([244, 232, 208], mark, 0.35);
      const brown = mix([150, 104, 70], coat, 0.55);
      const slate = mix([102, 128, 170], coat, 0.26);
      const back = s.stage === 2 ? slate : brown;
      return coatPalette(coat, mark, {
        coat: cream,
        coatDark: mix(cream, brown, 0.45),
        coatLight: mix(cream, [255, 252, 244], 0.55),
        mark: mix(cream, [255, 252, 246], 0.5),
        muzzle: mix(cream, s.stage === 2 ? [176, 178, 188] : [200, 170, 140], 0.22),
        belly: mix(cream, [255, 250, 240], 0.3),
        feather: back,
        featherDark: s.stage === 2 ? mix(slate, [40, 50, 76], 0.45) : mix(brown, [52, 34, 26], 0.55),
        spot: mix(brown, [40, 26, 20], 0.68),
        inner: s.stage === 2 ? [232, 150, 120] : [222, 150, 150],
        bill: s.stage === 2 ? [98, 96, 106] : [96, 92, 102],
        billDark: s.stage === 2 ? [82, 80, 90] : [80, 76, 86],
        claw: s.stage === 2 ? [96, 102, 96] : [124, 130, 118],
        eye: [28, 22, 26],
        eyeWhite: [246, 240, 226],
        lid: mix(brown, [60, 40, 30], 0.3),
        glint: [255, 253, 246],
        petal: [238, 150, 160],
        membrane: [214, 112, 132],
        bark: [150, 116, 84],
        shell: [160, 124, 88],
        shellDark: [124, 94, 68],
        stoneDark: [64, 46, 36],
      });
    },
    shadow: [[1.0, 1.25, 1.6][s.stage], [0.8, 0.85, 1.1][s.stage]],
    stride: 1.1,
    size: s.size,
    blinks: 6,
    acts: ['strike', 'work'],
    motes: [[196, 140, 96], [240, 160, 170]],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      const big = [0.8, 1, 1.4][s.stage];
      if (act?.kind === 'strike') {
        if (!under) fluff(g, view, siteOf(s).hit, (act.t - BILL_HITS[s.stage]) * ACT_SECS.strike, big);
        return;
      }
      if (act?.kind !== 'work') return;
      const site = siteOf(s), T = ACT_SECS.work, W = BILL_WORK;
      if (under) {
        // The ground turned where it probes, darker as it digs in, and fading back at the end.
        const dug = ramp(act.t, W.jabs[0] - 0.03, W.deep) * (1 - ramp(act.t, W.sink[0], 1));
        groundPatch(g, view, site.hole, 0.7 * big, SOIL, 0.7 * dug);
        groundPatch(g, view, site.hole, 0.38 * big, SOIL_DARK, 0.7 * dug);
        return;
      }
      // Flung away from the bird: straight back from the hole, along the way it faces.
      const away = Math.atan2(site.hole[1], site.hole[0]);
      const at = add(site.hole, [0, 0, 0.1 * big]);
      W.jabs.forEach((j, q) => clods(g, view, at, (act.t - j - 0.01) * T, 3 + q * 5, big * 0.6, 3, away));
      W.tugs.forEach((tg, q) => clods(g, view, at, (act.t - tg) * T, 20 + q * 9, big * 0.8, 4 + s.stage, away));
      clods(g, view, at, (act.t - W.pop) * T, 60, big, 6 + 2 * s.stage, away);
    },
  };
}

export const PEBBLEBEAK = billKind(PEBBLEBEAK_LOOK);
export const SOILWHISTLE = billKind(SOILWHISTLE_LOOK);
export const WORMHERON = billKind(WORMHERON_LOOK);
