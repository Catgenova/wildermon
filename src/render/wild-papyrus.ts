import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, darker, disc, dot, frac, lerp, lifted, lighter, merge, mix, onEgg, orb,
  orbAlong, paint, pastel, quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc,
  type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The papyrus line: the Reedling, a small long low creature on four short
 * legs, something of a platypus -- a flat dark duck's bill on a round cream
 * face, amber eyes and a soft smile, dark webbed feet -- its fur cream under
 * long green leaf-feathers flecked with tan: a ruff of them over its head and
 * neck and down its back, a sprig of cream papyrus plumes standing up off its
 * crown, and a feathery tail of them curled up behind it; which grows into the
 * Papyruskin, bigger and longer, its neck raised, a layered mane and body of
 * leaf-feathers, and three folded papyrus sheets carried on its back, their
 * edges rolled, strapped on with green reed bands, and a long sweeping tail;
 * and then the Pressmere, large and stately on a long upright neck under a
 * heavy mane, a big stack of folded sheets bound with reed bands on its back,
 * a tall bundle of papyrus reeds topped with plumes rising behind its neck
 * and a second near its tail, and a long trailing tail. The species is still
 * `papra` underneath, as saves and the database know it: it presses reeds
 * and water into papyrus at the settlement's paper presses.
 *
 * Each is its variant's coat in its leaf-feathers and its markings in the
 * cream of its face, throat, belly and legs; its bill, feet, sheets, bands and
 * plumes are the same on every variant. Built the way the capybara line is
 * (`./wild-capy`): one set of functions from a description of the stage
 * (`Papy`), every foot given a point on the ground to be at and its leg bent
 * to reach it, so a planted foot stays where it was put. It waddles low, its
 * body rolled and swung from side to side over its feet and its tail swinging
 * the other way; the Pressmere slower and statelier. Every leaf-feather is a
 * blade of its own laid on the body's curve and pointing down it, and stirs.
 *
 * At its task a small press of its own is set on the ground before it (bone
 * `press`): it lays reed strips on the press with its bill, a row across and
 * a row along; then presses them -- the Reedling with its flat bill, the
 * other two stepping up onto the press's lid -- and the strips are a sheet;
 * and it peels the cream sheet up off the press in its bill and tosses it back
 * onto its pack (`PAPER_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Papy {
  stage: 0 | 1 | 2;
  /** The body's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the drop from the ankle to the sole; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far out from the middle its hips and shoulders are, as a share of the body's width there. */
  hip: number;
  /** Standing: each leg's upper pitched forward, and its lower against it, in degrees. */
  stand: { fore: [number, number]; hind: [number, number] };
  /** A webbed foot's size: its toes are half as long again. */
  foot: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes, and its middle from the top of the neck in the head's frame; how far nose-up it is carried. */
  head: { r: V3; at: V3; pitch: number };
  /** The bill: how long out of the face, half across, and half deep at its middle. */
  bill: { len: number; w: number; h: number };
  eye: number;
  /** The leaf-feathers down its back: rows rooted from `from` along it to `to`, down each flank to `low` (radians over level); a leaf's length and half-width; the gap between rows. */
  cloak: { from: number; to: number; low: number; leaf: [number, number]; gap: number };
  /** The mane down its neck: how many rows, and a leaf's length and half-width at the top of it (the lowest are longer). */
  mane: { rows: number; leaf: [number, number] };
  /** The leaf-feathers on its crown and the back of its head: how many rows, and a leaf's length and half-width. */
  crest: { rows: number; leaf: [number, number] };
  /** The plumes standing up off its crown: how many, how tall, and how big a plume's head. */
  plumes: { n: number; h: number; r: number };
  /** The tail: its line from its root in the rump, a few points through which it is drawn; how thick at the root; its leaves. */
  tail: { pts: V3[]; w: number; leaf: [number, number]; every: number };
  /** The sheets on its back: how many tiers, along it from `to` to `from`, how far each lies over the one under it, how far squared off on top the highest is, how high up its flank the lowest one's edge is (radians over level), and a rolled edge's radius. */
  sheets: { n: number; from: number; to: number; th: number; flat: number; drop: number; roll: number } | null;
  /** Reed bands round it over the sheets, where along it. */
  bands: number[];
  /** Bundles of papyrus reeds on its back: its foot on the sheets (along it, out to its right), leaning back and out (degrees), how tall, how many reeds. */
  bundles: Array<{ y: number; x: number; lean: [number, number]; h: number; n: number }>;
  /** Its press at its task: how wide, how deep and how high, and whether it has a lid. */
  press: { w: number; d: number; h: number; lid: boolean };
  /**
   * How it goes: how far its body drops at each footfall, at a walk and a run; how much of a stride a foot is down; how far a leg
   * swings (degrees); how high a foot is lifted; how far its body rolls, and swings from side to side (degrees), and its head nods.
   */
  gait: { bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; yaw: number; nod: number };
  /** Its strike: a lunge with its bill, a shove, or reared up and stamped down. */
  strike: 0 | 1 | 2;
}

/** How big each is drawn against how it is built: one for all three, so a stage's size is its build. */
const SIZE = 3.3;

/** A body's rings from its length rump to chest and its half-width and half-depth at its middle: long and low, the chest rising into the neck. */
function barrelOf(L: number, W: number, H: number): Rings {
  return {
    y: [-0.5, -0.485, -0.44, -0.36, -0.22, -0.04, 0.16, 0.32, 0.42, 0.475, 0.5].map((v) => v * L),
    z: [0.12, 0.12, 0.1, 0.06, 0.02, 0, 0.02, 0.07, 0.13, 0.19, 0.24].map((v) => v * H),
    w: [0.16, 0.46, 0.72, 0.9, 0.99, 1.0, 0.97, 0.88, 0.72, 0.5, 0.2].map((v) => v * W),
    h: [0.16, 0.46, 0.7, 0.87, 0.97, 1.0, 0.98, 0.9, 0.74, 0.52, 0.22].map((v) => v * H),
  };
}

/** A Reedling: small, long and low on short legs, a ruff of leaf-feathers, a sprig of plumes on its crown, its tail curled up. */
const REEDLING_LOOK: Papy = {
  stage: 0,
  body: barrelOf(1.36, 0.29, 0.23),
  len: 0.84,
  fore: [0.12, 0.11, 0.045], hind: [0.13, 0.12, 0.045], thick: 0.12, hip: 0.66,
  stand: { fore: [-6, 14], hind: [22, -40] },
  foot: 0.1,
  neck: { at: [0, 0.52, 0.08], len: 0.16, w: 0.19, lean: 48 },
  head: { r: [0.28, 0.29, 0.25], at: [0, 0.13, 0.13], pitch: 4 },
  bill: { len: 0.3, w: 0.12, h: 0.034 },
  eye: 0.052,
  cloak: { from: 0.5, to: -0.3, low: 0.14, leaf: [0.62, 0.095], gap: 0.2 },
  mane: { rows: 2, leaf: [0.24, 0.07] },
  crest: { rows: 3, leaf: [0.2, 0.048] },
  plumes: { n: 3, h: 0.5, r: 0.16 },
  tail: { pts: [[0, 0, 0], [0, -0.26, 0.06], [0, -0.44, 0.3], [0, -0.34, 0.56]], w: 0.07, leaf: [0.5, 0.085], every: 0.09 },
  sheets: null,
  bands: [],
  bundles: [],
  press: { w: 0.46, d: 0.38, h: 0.05, lid: false },
  gait: { bob: [0.012, 0.03], duty: [0.62, 0.42], swing: [26, 34], step: 0.42, roll: 7, yaw: 5, nod: 4 },
  strike: 0,
};

/** A Papyruskin: bigger and longer, its neck raised, three folded sheets on its back in reed bands, a long sweeping tail. */
const PAPYRUSKIN_LOOK: Papy = {
  stage: 1,
  body: barrelOf(2.1, 0.4, 0.32),
  len: 1.3,
  fore: [0.22, 0.2, 0.06], hind: [0.24, 0.21, 0.06], thick: 0.18, hip: 0.66,
  stand: { fore: [-6, 14], hind: [22, -40] },
  foot: 0.14,
  neck: { at: [0, 0.9, 0.12], len: 0.62, w: 0.26, lean: 26 },
  head: { r: [0.28, 0.3, 0.25], at: [0, 0.13, 0.13], pitch: 6 },
  bill: { len: 0.36, w: 0.13, h: 0.04 },
  eye: 0.058,
  cloak: { from: 0.8, to: -0.5, low: 0.14, leaf: [0.86, 0.125], gap: 0.27 },
  mane: { rows: 4, leaf: [0.3, 0.085] },
  crest: { rows: 3, leaf: [0.24, 0.054] },
  plumes: { n: 4, h: 0.52, r: 0.17 },
  tail: { pts: [[0, 0, 0], [0, -0.4, 0.06], [0, -0.82, 0.12], [0, -1.12, 0.06]], w: 0.09, leaf: [0.8, 0.105], every: 0.11 },
  sheets: { n: 2, from: 0.5, to: -0.72, th: 0.034, flat: 0.3, drop: -0.08, roll: 0.04 },
  bands: [0.16, -0.4],
  bundles: [],
  press: { w: 0.66, d: 0.5, h: 0.08, lid: true },
  gait: { bob: [0.02, 0.05], duty: [0.64, 0.44], swing: [24, 32], step: 0.38, roll: 5.5, yaw: 4, nod: 3 },
  strike: 1,
};

/** A Pressmere: large and stately on a long upright neck, a heavy mane, a big stack of sheets, two bundles of plumed reeds. */
const PRESSMERE_LOOK: Papy = {
  stage: 2,
  body: barrelOf(3.1, 0.6, 0.5),
  len: 1.94,
  fore: [0.3, 0.28, 0.085], hind: [0.33, 0.3, 0.085], thick: 0.3, hip: 0.64,
  stand: { fore: [-6, 14], hind: [22, -40] },
  foot: 0.2,
  neck: { at: [0, 1.3, -0.08], len: 1.36, w: 0.6, lean: 14 },
  head: { r: [0.43, 0.46, 0.38], at: [0, 0.2, 0.18], pitch: 8 },
  bill: { len: 0.56, w: 0.2, h: 0.06 },
  eye: 0.085,
  cloak: { from: 1.2, to: -0.7, low: 0.12, leaf: [1.16, 0.165], gap: 0.36 },
  mane: { rows: 6, leaf: [0.42, 0.11] },
  crest: { rows: 3, leaf: [0.28, 0.062] },
  plumes: { n: 4, h: 0.56, r: 0.18 },
  tail: { pts: [[0, 0, 0], [0, -0.55, -0.02], [0, -1.15, -0.06], [0, -1.7, 0.02]], w: 0.13, leaf: [1.1, 0.14], every: 0.14 },
  sheets: { n: 3, from: 0.62, to: -1.04, th: 0.042, flat: 0.4, drop: -0.1, roll: 0.055 },
  bands: [0.2, -0.62],
  bundles: [
    { y: 0.46, x: -0.24, lean: [-10, -12], h: 1.6, n: 10 },
    { y: -0.84, x: 0.2, lean: [-36, 12], h: 0.9, n: 6 },
  ],
  press: { w: 0.96, d: 0.72, h: 0.12, lid: true },
  gait: { bob: [0.03, 0.07], duty: [0.68, 0.48], swing: [20, 28], step: 0.3, roll: 4, yaw: 3, nod: 2.5 },
  strike: 2,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a pattern is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const sgnPow = (x: number, p: number): number => Math.sign(x) * Math.abs(x) ** p;

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
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** `v` pitched about x by `deg` degrees, as a joint's pitch turns it. */
function rotX(v: V3, deg: number): V3 {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/** A beat once a turn at `x` nought, smooth all the way round: a footfall's jolt. */
const pulse = (x: number): number => Math.max(0, Math.cos(TAU * x)) ** 14;

const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A frame made `k` times bigger about its own joint. */
const grown = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k); return { m: x.m.map((v) => v * q) as Xf['m'], t: x.t }; };

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
/** Each face's material chosen from where its middle is. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    return { ...face, m: f(c) };
  }));
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** A box, `c` its middle and `r` its half-sizes, square to its frame. */
function box(c: V3, r: V3, mat: Mat, top: Mat = mat): Mesh {
  const v: V3[] = [];
  for (const z of [-1, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) v.push([c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]]);
  const f: Face[] = [
    { i: [0, 1, 3, 2], m: mat }, { i: [4, 5, 7, 6], m: top },
    { i: [0, 1, 5, 4], m: mat }, { i: [2, 3, 7, 6], m: mat },
    { i: [0, 2, 6, 4], m: mat }, { i: [1, 3, 7, 5], m: mat },
  ];
  return mesh(v, wound(v, f, [[0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0]]));
}

/* ---- the strike and the task, in time ------------------------------------------------------- */

/** When each stage's blow lands, as a share of its strike: the Reedling's lunge, the Papyruskin's shove, the Pressmere's stamp. */
export const PAPER_HITS: readonly number[] = [0.5, 0.52, 0.58];
/**
 * A go at its task, as shares of it: the bill dabbed down at `lay` and `lay2`, each laying a row of reed strips on the press; the
 * press shut from `shut` and come down on the strips at `press` (the Reedling's bill patting them at `pat` and `press`), where they
 * are a sheet; let up at `open`; the sheet gripped at `grip` and peeled up by `peel`, and tossed back onto its pack by `toss`.
 */
export const PAPER_WORK = { lay: 0.1, lay2: 0.22, shut: 0.3, pat: 0.4, press: 0.5, open: 0.64, grip: 0.74, peel: 0.86, toss: 0.96 } as const;

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Papy): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [ringAt(s.body, s.len * 0.5).w * s.hip, s.len * 0.5, -ringAt(s.body, s.len * 0.5).h * 0.42], len: s.fore, rest: [s.stand.fore[0], s.stand.fore[1], 0], fold: [FOLD, FOLD], toe: [s.foot * 1.5, s.foot * 0.4] },
  hind: { at: [ringAt(s.body, -s.len * 0.5).w * s.hip * 1.04, -s.len * 0.5, -ringAt(s.body, -s.len * 0.5).h * 0.42], len: s.hind, rest: [s.stand.hind[0], s.stand.hind[1], 0], fold: [FOLD, FOLD], toe: [s.foot * 1.5, s.foot * 0.4] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  swing: s.gait.swing,
  duty: s.gait.duty,
  graze: 30,
  nose: 16,
  bow: 4,
  rock: 2,
});

/** Where a leg's ankle is from its hip, the upper pitched `a` and the lower `b` against it (degrees). */
function ankleAt(len: readonly number[], a: number, b: number): V3 {
  const A = a * DEG, B = (a + b) * DEG;
  return [0, len[0] * Math.sin(A) + len[1] * Math.sin(B), -(len[0] * Math.cos(A) + len[1] * Math.cos(B))];
}

/**
 * A leg bent so its ankle is at `T` (from the body's middle, level, along the ground): the swing of its upper and the fold of its
 * knee. The knee bends the way it does standing whatever the foot is asked, so it never flips; a point out of reach is reached
 * for as far as the leg goes.
 */
function legTo(spec: QuadSpec, i: number, pitch: number, T: V3): [number, number] {
  const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0];
  const loc = sub(rotX(T, -pitch), [SIDE[i] * L.at[0], L.at[1], L.at[2]]);
  const L0 = L.len[0], L1 = L.len[1];
  const most = (L0 + L1) * 0.985, ease = (L0 + L1) * 0.95, d0 = Math.hypot(loc[1], loc[2]);
  const D = clamp(d0 > ease ? ease + (most - ease) * Math.tanh((d0 - ease) / (most - ease)) : d0, Math.abs(L0 - L1) + 0.02 * (L0 + L1), most);
  const b = (rest[1] >= 0 ? 1 : -1) * Math.acos(clamp((D * D - L0 * L0 - L1 * L1) / (2 * L0 * L1), -1, 1));
  const a = Math.atan2(loc[1], -loc[2]) - Math.atan2(L1 * Math.sin(b), L0 + L1 * Math.cos(b));
  return [a / DEG - rest[0], (rest[1] - b / DEG) / FOLD];
}

/** The tip of its bill, in the head's frame. */
function billTip(s: Papy): V3 {
  const B = billRoot(s);
  return add(B.p, scale(B.d, s.bill.len));
}

/** A stage standing: how far its body is tipped to stand on all four feet, how high its middle is, and where each ankle is. */
interface Rest {
  pitch: number; h: number; ankle: V3[];
  /** The points of each foot that could touch the ground, in its frame; and of its head, the tip and the underside of its bill and its chin. */
  sole: V3[][]; chin: V3[];
}
function restOf(s: Papy, spec: QuadSpec): Rest {
  const ankle = (i: number, pitch: number): V3 => {
    const L = i < 2 ? spec.fore : spec.hind, r = L.rest ?? [0, 0, 0];
    return add(rotX([SIDE[i] * L.at[0], L.at[1], L.at[2]], pitch), rotX(ankleAt(L.len, r[0], r[1]), pitch));
  };
  const gap = (pitch: number): number => (ankle(0, pitch)[2] - spec.fore.len[2]) - (ankle(2, pitch)[2] - spec.hind.len[2]);
  let lo = -30, hi = 30;
  for (let q = 0; q < 40; q++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) > 0) hi = mid;
    else lo = mid;
  }
  const pitch = (lo + hi) / 2;
  const h = -(ankle(0, pitch)[2] - spec.fore.len[2]);
  const H = s.head, tip = billTip(s), root = billRoot(s);
  return {
    pitch, h,
    ankle: [0, 1, 2, 3].map((i) => { const a = ankle(i, pitch); return [a[0], a[1], (i < 2 ? spec.fore : spec.hind).len[2]] as V3; }),
    sole: [0, 1, 2, 3].map((i) => {
      const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
      return [[0, ahead, -L.len[2]], [0, -behind, -L.len[2]]] as V3[];
    }),
    chin: [add(tip, [0, 0, -s.bill.h * 0.6]), add(mixV(root.p, tip, 0.5), [0, 0, -s.bill.h]), add(H.at, [0, 0, -H.r[2] * 0.95])],
  };
}

/**
 * Where its feet are to be this moment and how the rest of it is carried: for each leg the point its ankle is to be at (from
 * under the body's middle along the ground, and its height over the ground) and how its foot is pitched past level; how high
 * the body's middle is, how far it is carried forward, how far the body rolls and rocks over its legs, and swings from side to
 * side.
 */
interface Plan { at: V3[]; foot: number[]; H: number; surge: number; roll: number; rock: number; yaw: number }

/** Standing: every foot where it stands. */
function stillPlan(R: Rest, p: QuadPose): Plan {
  return { at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0], H: R.h, surge: 0, roll: p.roll, rock: 0, yaw: 0 };
}

/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const SWING_EDGE = 0.1;

/**
 * Going: each foot down for its share of a stride, swept back under the body at the speed the ground goes by, and brought
 * forward again through the air. A low waddle at a walk, four beats, its body rolled over each foot as it comes down and swung
 * from side to side with the stride; at a run, the diagonals together.
 */
function goingPlan(s: Papy, spec: QuadSpec, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const trot = g >= 0.5;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const legLen = Math.min(spec.fore.len[0] + spec.fore.len[1], spec.hind.len[0] + spec.hind.len[1]);
  const half = legLen * Math.sin(amp * DEG);
  const beats = trot ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];
  const mid = trot ? duty / 2 : frac(0.75 + duty / 2);
  const bob = lerp(G.bob[0], G.bob[1], g);
  const drop = bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * (w - mid)));
  let air = 0;
  if (trot && duty < 0.5) {
    const x = frac(w * 2) * 0.5;
    if (x >= duty) air = bob * 1.4 * Math.sin((Math.PI * (x - duty)) / (0.5 - duty)) ** 2;
  }
  const at: V3[] = [], foot: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ph = frac(a.u + beats[i]), A = R.ankle[i];
    if (ph < duty) {
      at.push([A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]]);
      foot.push(0);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty), e = SWING_EDGE;
    const L = (i < 2 ? spec.fore : spec.hind).len, lift = G.step * (L[0] + L[1]) * (1 + 0.2 * g);
    const y0 = A[1] - half - v * e, y1 = A[1] + half + v * e;
    const y = u < e ? A[1] - half - v * u : u > 1 - e ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * e), -v * (1 - 2 * e), (u - e) / (1 - 2 * e));
    at.push([A[0], y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // The webbed foot let hang toes down as it comes forward, peeled off the ground heel first.
    foot.push(-26 * Math.sin(Math.PI * u) ** 2);
  }
  const roll = G.roll * Math.sin((w - mid) * TAU + Math.PI / 2) * (trot ? 0.5 : 1);
  const yaw = G.yaw * Math.sin((w - mid) * TAU) * (trot ? 0.4 : 1);
  const rock = trot ? 1.6 * Math.sin(w * TAU * 2) : 0.6 * Math.sin((w - mid) * TAU * 2);
  return { at, foot, H: R.h - drop + air, surge: 0, roll, rock, yaw };
}

/** A plan `k` of the way from `a` to `b`. */
function mixPlan(a: Plan, b: Plan, k: number): Plan {
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)),
    foot: a.foot.map((x, i) => lerp(x, b.foot[i], k)),
    H: lerp(a.H, b.H, k), surge: lerp(a.surge, b.surge, k), roll: lerp(a.roll, b.roll, k), rock: lerp(a.rock, b.rock, k), yaw: lerp(a.yaw, b.yaw, k),
  };
}

/** The neck and the head bowed together toward the ground, `x` of the way. */
function bow(p: QuadPose, x: number): void {
  p.neck[0] += 70 * x;
  p.head[0] -= 30 * x;
}
/** Where a point on its head is, bowed `x` (`bow`): along the ground from the body's middle standing, and over the ground. */
function headPoint(spec: QuadSpec, p: QuadPose, plan: Plan, x: number, at: V3): V3 {
  const q: QuadPose = { ...p, neck: [p.neck[0], p.neck[1]], head: [p.head[0], p.head[1], p.head[2]] };
  bow(q, x);
  const b = quadBones(spec, q), w = place(b.head, at);
  return [w[0] - b.body.t[0], w[1] - b.body.t[1] + plan.surge, w[2] - b.body.t[2] + plan.H];
}
/** How low its bill and chin come, bowed `x`. */
function chinOver(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number): number {
  return Math.min(...R.chin.map((c) => headPoint(spec, p, plan, x, c)[2]));
}
/** The head bowed as far as puts the tip of its bill `z` over the ground. */
function billTo(s: Papy, spec: QuadSpec, p: QuadPose, plan: Plan, z: number): void {
  const tip = billTip(s);
  let lo = -0.8, hi = 2.4;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (headPoint(spec, p, plan, mid, tip)[2] > z) lo = mid;
    else hi = mid;
  }
  bow(p, (lo + hi) / 2);
}

/* ---- the press ------------------------------------------------------------------------------- */

/**
 * Where its press stands before it at its task: its middle along the ground from the body's middle, put where the tip of its
 * bill comes down onto the press's top, but never under its fore feet; and how far it steps forward onto the lid.
 */
interface PressAt { y: number; top: number; step: number }
function pressOf(s: Papy, spec: QuadSpec, R: Rest): PressAt {
  const P = s.press, p = quadPose(spec, { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  p.pitch += R.pitch;
  p.neck = [0, 0];
  p.head = [0, 0, 0];
  const plan = stillPlan(R, p), top = P.h + P.h * 0.3;
  const q = { ...p, neck: [0, 0] as [number, number], head: [0, 0, 0] as [number, number, number] };
  billTo(s, spec, q, plan, top);
  const tip = headPoint(spec, q, plan, 0, billTip(s));
  const toe = R.ankle[0][1] + s.foot * 1.6;
  // The bill comes down a little in from its near edge, so the sheet is gripped there and peeled up toward the far one.
  const y = Math.max(tip[1] + P.d * 0.28, toe + P.d * 0.55);
  // Onto the lid: its fore feet a little into the near half of it, from where they stand.
  const step = Math.max(0, y - P.d * 0.12 - R.ankle[0][1] - s.len * 0.2);
  return { y, top, step };
}

/* ---- what it does ------------------------------------------------------------------------------- */

/**
 * A go at its task: the bill dabbed down twice to lay a row of strips; then the Reedling pats them flat with its bill, and the
 * other two step up onto the lid and come down on it, their bills lifted; then the lid is let up with a flick of the bill, the
 * sheet gripped at its near edge and peeled up, and tossed back over its shoulder.
 */
function workPlan(s: Papy, spec: QuadSpec, R: Rest, P: PressAt, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), W = PAPER_WORK, L = s.fore[0] + s.fore[1];
  plan.roll *= 0.3;
  const top = P.top, up = s.head.r[2] * 0.9;
  // Its bill's height through the go, over the press's top: down at each dab, the pats, the lid's flick and the grip.
  let z = top + up * 0.8;
  const dab = Math.max(hump(t, W.lay, 0.06), hump(t, W.lay2, 0.06));
  z -= up * 0.8 * dab;
  if (!s.press.lid) {
    // The Reedling pats the strips flat with its bill, twice.
    const pat = Math.max(hump(t, W.pat, 0.05), hump(t, W.press, 0.05));
    z -= up * 0.86 * pat;
    plan.H -= R.h * 0.08 * Math.max(pat, 0.5 * ramp(t, W.shut, W.pat) * (1 - ramp(t, W.press, W.open)));
    p.pitch -= 4 * pat;
  } else {
    // Up on the lid, the head lifted, proud; its bill to the lid's edge to flick it up.
    const onLid = ramp(t, W.shut, W.pat) * (1 - ramp(t, W.open - 0.02, W.open + 0.08));
    z += up * 0.9 * onLid;
    z -= up * 0.7 * hump(t, W.open - 0.02, 0.05);
    const surge = P.step * onLid;
    plan.surge = surge;
    for (let i = 0; i < 4; i++) {
      const A = R.ankle[i], fore = i < 2;
      const there: V3 = fore ? [A[0] * 0.9, A[1] + P.step + s.len * 0.08, A[2] + s.press.h * 1.3] : [A[0], A[1] + P.step, A[2]];
      const [a0, a1] = fore ? (i ? [W.shut, W.pat] : [W.shut - 0.04, W.pat - 0.04]) : (i === 3 ? [W.shut + 0.02, W.pat + 0.02] : [W.shut + 0.05, W.pat + 0.05]);
      const [b0, b1] = fore ? (i ? [W.open, W.open + 0.1] : [W.open - 0.04, W.open + 0.06]) : (i === 3 ? [W.open + 0.02, W.open + 0.12] : [W.open + 0.05, W.open + 0.15]);
      if (t < a0) plan.at[i] = A;
      else if (t < a1) plan.at[i] = arc(A, there, ramp(t, a0, a1), L * (fore ? 0.6 : 0.3));
      else if (t < b0) plan.at[i] = [...there] as V3;
      else if (t < b1) plan.at[i] = arc(there, A, ramp(t, b0, b1), L * (fore ? 0.4 : 0.3));
      plan.foot[i] = -14 * Math.sin(Math.PI * ramp(t, a0, a1)) - 12 * Math.sin(Math.PI * ramp(t, b0, b1));
    }
    // Down on it at the press, its weight thrown onto its fore feet, and again.
    const press = hump(t, W.press, 0.07) + 0.6 * hump(t, W.press + 0.08, 0.05);
    plan.H += R.h * (0.1 * onLid - 0.14 * press);
    p.pitch += 5 * onLid - 6 * press;
    p.squash += 0.04 * press;
  }
  // The grip at the sheet's edge, and the peel up and back; the toss over its shoulder.
  z -= up * 0.86 * hump(t, W.grip, 0.05);
  const peel = ramp(t, W.grip + 0.02, W.peel);
  z += (up * 1.4 + s.press.d * 0.4) * peel;
  plan.H += R.h * 0.04 * peel;
  billTo(s, spec, p, plan, z);
  const toss = ramp(t, W.peel, W.toss) * (1 - ramp(t, W.toss, 1));
  p.neck[0] -= 22 * toss;
  p.head[0] += 30 * toss;
  p.head[1] += 14 * hump(t, W.toss, 0.05);
  // A dabble of its bill as each strip goes down.
  p.head[1] += 6 * dab * Math.sin(t * TAU * 18);
  return plan;
}

/**
 * Grazing: its bill down at the grass, dabbling -- a quick sideways shake of it, in bursts -- its weight on its fore legs.
 */
function grazePlan(s: Papy, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, k: number): Plan {
  const plan = stillPlan(R, p);
  plan.roll *= 1 - k;
  plan.H -= R.h * 0.04 * k;
  const burst = 0.5 + 0.5 * Math.max(0, cyc(a.t, 8));
  p.head[1] += k * 8 * cyc(a.t, 72) * burst;
  const stand = chinOver(spec, R, p, plan, 0);
  const want = Math.max(0.01, lerp(stand, 0.015, k));
  let lo = -0.6, hi = 2.4;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (chinOver(spec, R, p, plan, mid) > want) lo = mid;
    else hi = mid;
  }
  bow(p, (lo + hi) / 2);
  return plan;
}

/**
 * The Reedling's lunge: it crouches, its rump wiggling, springs forward with its head low and snaps at what is in front of it
 * with its bill; then hops back to where it was.
 */
function lungePlan(s: Papy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = PAPER_HITS[0];
  const L = s.fore[0] + s.fore[1], J = s.len * 0.45;
  const crouch = ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.3));
  const out = ramp(t, 0.22, 0.48) * (1 - ramp(t, 0.66, 0.88));
  plan.surge = J * out;
  const fly = hump(t, 0.36, 0.15), hop = hump(t, 0.77, 0.1);
  plan.H += R.h * (-0.15 * crouch + 0.5 * fly + 0.2 * hop - 0.1 * hump(t, hit + 0.02, 0.07));
  p.pitch += -6 * crouch + 8 * fly - 7 * hump(t, hit, 0.08);
  plan.yaw += 8 * crouch * Math.sin(t * TAU * 6);
  const snap = ramp(t, 0.24, hit) * (1 - ramp(t, hit + 0.06, 0.82));
  p.neck[0] += 18 * snap + 10 * hump(t, hit, 0.05);
  p.head[0] -= 10 * snap - 14 * hump(t, hit - 0.04, 0.04);
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], there: V3 = [A[0], A[1] + J, A[2]];
    const [t0, t1] = i < 2 ? [0.22, 0.47] : [0.25, 0.49];
    if (t > t0 && t < t1) plan.at[i] = arc(A, there, ramp(t, t0, t1), L * (i < 2 ? 0.7 : 0.5));
    else if (t >= t1 && t < 0.68) plan.at[i] = there;
    else if (t >= 0.68 && t < 0.87) plan.at[i] = arc(there, A, ramp(t, 0.68, 0.87), L * 0.4);
    plan.foot[i] = -18 * Math.sin(Math.PI * ramp(t, t0, t1)) - 12 * Math.sin(Math.PI * ramp(t, 0.68, 0.87));
  }
  return plan;
}

/**
 * The Papyruskin's shove: it draws back, its head lowered, then drives forward off its hind legs, a fore foot stepping into it,
 * and shoves with its shoulder, its bill swung across; and settles back.
 */
function shovePlan(s: Papy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = PAPER_HITS[1];
  const L = s.fore[0] + s.fore[1];
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.3, 0.44));
  const drive = ramp(t, 0.32, hit) * (1 - ramp(t, 0.66, 0.96));
  plan.surge = s.len * (-0.1 * back + 0.26 * drive);
  plan.H += R.h * (-0.08 * back - 0.05 * drive);
  p.pitch += 4 * back - 5 * drive;
  p.neck[0] += 16 * (back + drive) + 12 * hump(t, hit, 0.05);
  p.neck[1] += 24 * drive;
  p.head[0] -= 10 * drive;
  p.head[2] -= 16 * drive;
  plan.roll += -8 * drive + 4 * hump(t, hit, 0.06);
  plan.yaw += -6 * drive;
  const A = R.ankle[1], step: V3 = [A[0] * 1.1, A[1] + s.len * 0.32, A[2]];
  if (t > 0.34 && t < hit) plan.at[1] = arc(A, step, ramp(t, 0.34, hit), L * 0.4);
  else if (t >= hit && t < 0.72) plan.at[1] = step;
  else if (t >= 0.72 && t < 0.94) plan.at[1] = arc(step, A, ramp(t, 0.72, 0.94), L * 0.3);
  plan.foot[1] = -16 * Math.sin(Math.PI * ramp(t, 0.34, hit)) - 12 * Math.sin(Math.PI * ramp(t, 0.72, 0.94));
  return plan;
}

/** How long the Pressmere's stamp takes to come down, as a share of its strike. */
const STAMP_DROP = 0.14;
/**
 * The Pressmere's stamp: it rears its fore end up off the ground on its hind legs, its neck drawn back, both fore feet lifted,
 * and brings them down together in front of it, the whole of it shaking; then it steps its feet back.
 */
function stampPlan(s: Papy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = PAPER_HITS[2];
  const L = s.fore[0] + s.fore[1];
  const top = hit - STAMP_DROP;
  const rear = ramp(t, 0.04, top - 0.04) * (1 - clamp((t - top) / (hit - top)) ** 2);
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  const land = hump(t, hit + 0.03, 0.08);
  plan.H += R.h * (0.2 * rear - 0.08 * land) + 0.02 * shake;
  p.pitch += 14 * rear - 3 * land;
  p.neck[0] += -12 * rear + 14 * land;
  p.head[0] += -6 * rear;
  plan.rock += 2 * shake;
  plan.roll += 1.5 * shake;
  for (const i of [0, 1]) {
    const A = R.ankle[i];
    const high: V3 = [A[0] * 1.05, A[1] + L * 0.4, A[2] + L * 1.1];
    const down: V3 = [A[0], A[1] + s.len * 0.12, A[2]];
    const [b0, b1] = i ? [0.78, 0.96] : [0.68, 0.86];
    if (t < top) plan.at[i] = arc(A, high, ramp(t, 0.06, top - 0.04), 0);
    else if (t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t < b0) plan.at[i] = down;
    else if (t < b1) plan.at[i] = arc(down, A, ramp(t, b0, b1), L * 0.16);
    plan.foot[i] = -20 * ramp(t, 0.06, top - 0.04) * (1 - ramp(t, top, hit)) - 6 * hump(t, hit, 0.04);
  }
  return plan;
}

/** Evolving: hunched as the light gathers and its leaves grow over it, then drawn up tall at the turn, a shake, and settled. */
function evolvePlan(R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p);
  const hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.38, 0.54)), up = ramp(t, 0.44, 0.6) * (1 - ramp(t, 0.72, 0.94));
  plan.H += R.h * -0.1 * hunch;
  p.pitch += -3 * hunch + 4 * up;
  p.neck[0] += 18 * hunch - 16 * up;
  p.head[0] += -10 * hunch + 16 * up;
  p.head[2] += 12 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  plan.roll += 2 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  return plan;
}

/**
 * Standing about: breathing, its head drifting, now and then a dabble -- its bill dipped and shaken quickly from side to side --
 * its weight shifted from side to side; the Pressmere holds its head higher and still.
 */
function still(s: Papy, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R, p);
  const dabble = beat(a.t, [4.2, 13.6, 20.8], 1.4);
  const lift = beat(a.t, [8.8, 17.4], 3);
  const calm = [1, 0.8, 0.55][s.stage];
  p.neck[0] = (-2 + 10 * dabble - 6 * lift) * calm;
  p.neck[1] *= 0.6 * calm;
  p.head[0] = 1.5 * cyc(a.t, 5) - 12 * dabble + 8 * lift;
  p.head[1] = p.head[1] * 0.7 * calm + 9 * dabble * Math.sin(a.t * TAU * 6);
  p.head[2] *= 0.6;
  plan.roll = 1.4 * cyc(a.t, 2, 0.4);
  plan.yaw = 1.2 * cyc(a.t, 3, 1.1);
  return plan;
}

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Papy, spec: QuadSpec, R: Rest, P: PressAt, p: QuadPose, a: Anim): Plan {
  p.pitch += R.pitch;
  const act = a.act;
  if (act?.kind === 'strike') return [lungePlan, shovePlan, stampPlan][s.strike](s, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, spec, R, P, p, act.t);
  if (act?.kind === 'evolve') return evolvePlan(R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return grazePlan(s, spec, R, p, a, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, spec, R, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  // Going: the head carried a little lower and forward, nodding with the stride, swung against the body's swing.
  p.neck[0] += g * (6 + 8 * a.gait) * (s.stage === 2 ? 0.5 : 1);
  p.neck[1] = p.neck[1] * (1 - g * 0.7) - g * going.yaw * 0.8;
  p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 2;
  p.head[1] -= g * going.yaw * 0.6;
  p.squash += g * (s.stage === 2 ? 0.02 : 0.012) * (pulse(w - 0.78) + pulse(w - 0.28));
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/* ---- its bones ------------------------------------------------------------------------------- */

/** How low a leg's shin and knee come: the lowest point of any. */
function shinLow(s: Papy, b: Bones, i: number): number {
  const fore = i < 2, key = LEGS4[i], L = fore ? s.fore : s.hind, w = s.thick;
  const rings: Array<[string, V3, number]> = [[`${key}0`, [0, 0, -L[0]], w * 0.62], [`${key}1`, [0, 0, -L[1] * 0.5], w * 0.5], [`${key}1`, [0, 0.02, -L[1]], w * 0.45]];
  let low = Infinity;
  for (const [bone, at, r] of rings) {
    const c = place(b[bone], at), d = sub(place(b[bone], add(at, [0, 0, -1])), c);
    low = Math.min(low, c[2] - r * Math.sqrt(Math.max(0, 1 - d[2] * d[2])));
  }
  return low;
}

/** Where its tail goes into its rump, in the trunk's frame. */
const tailRoot = (s: Papy): V3 => { const B = s.body; return [0, B.y[1], B.z[1] + B.h[1] * 0.35]; };

/**
 * The sheet being peeled, as two halves: the far half hinged at its far edge on the press, the near half from the fold to the
 * tip of the bill that has it, bent at the fold so the near edge is in the bill; past what the sheet reaches, the far edge comes
 * up off the press and the whole hangs from the bill. Each half's frame has the half along its -y, its face up along z.
 */
function peelBones(s: Papy, tip: V3, k: number): [Xf, Xf] {
  const D = s.press.d * 0.8, a = D * 0.5, top = s.press.h * 1.12;
  let H: V3 = [0, D * 0.5, top];
  const v = sub(tip, H), dist = len3([0, v[1], v[2]]);
  if (dist > a * 2 * 0.98) {
    // Off the press: hanging from the bill, back toward where it lay and down.
    const hang = unit(mixV(unit([0, -v[1], -v[2]]), [0, 0.15, -1], 0.5));
    H = add(tip, scale(hang, a * 2 * 0.98));
  }
  const w = sub(tip, H), d = Math.max(1e-4, len3([0, w[1], w[2]]));
  const phi = Math.atan2(w[2], w[1]), al = Math.acos(clamp(d / (2 * a), -1, 1));
  // The fold up over the line from the hinge to the bill, so the sheet arches.
  const dirA: V3 = [0, Math.cos(phi - al), Math.sin(phi - al)];
  const F = add(H, scale(dirA, a));
  const dirB = unit([0, tip[1] - F[1], tip[2] - F[2]]);
  const frame = (dir: V3, at: V3): Xf => {
    const Y = scale(dir, -1), Z: V3 = [0, -Y[2], Y[1]];
    const z = Z[2] < 0 ? scale(Z, -1) : Z;
    return grown(xfOf(cross(Y, z), Y, z, mixV(tip, at, k)), k);
  };
  return [frame(dirA, H), frame(dirB, F)];
}

/**
 * The bones of a stage: its pose, every leg bent to put its foot where the pose says (`legTo`), the body raised to the height
 * the pose says and carried forward as far, rolled, rocked and swung over its legs, so the feet stay where they are; its tail;
 * and at its task its press, the press's lid and the sheet it peels.
 */
function papyBones(s: Papy): (a: Anim) => Bones {
  const spec = specOf(s), R = restOf(s, spec), P = pressOf(s, spec, R);
  return (a) => {
    const p = quadPose(spec, { ...a, graze: 0, go: a.act ? 0 : a.go });
    const plan = planOf(s, spec, R, P, p, a);
    // However it is posed, its bill never down in the ground.
    if (chinOver(spec, R, p, plan, 0) < 0.01) {
      let lo = -1.5, hi = 0;
      for (let q = 0; q < 14; q++) {
        const mid = (lo + hi) / 2;
        if (chinOver(spec, R, p, plan, mid) < 0.01) hi = mid;
        else lo = mid;
      }
      bow(p, lo);
    }
    for (let i = 0; i < 4; i++) {
      const g = plan.at[i], floor = Math.max(...R.sole[i].map((q) => -rotX(q, plan.foot[i])[2]));
      if (g[2] < floor) g[2] = floor;
      p.foot[i] = plan.foot[i];
    }
    p.roll = 0;
    const solve = (): Bones => {
      for (let i = 0; i < 4; i++) {
        const g = plan.at[i];
        const [sw, fold] = legTo(spec, i, p.pitch, [g[0], g[1] - plan.surge, g[2] - plan.H]);
        p.legs[i] = [sw, fold, 0];
      }
      return quadBones(spec, p);
    };
    let b = solve();
    b = lifted(b, plan.H - b.body.t[2]);
    for (let pass = 0; pass < (a.act?.kind === 'work' ? 0 : 3); pass++) {
      let again = false, rise = 0;
      for (let i = 0; i < 4; i++) {
        const dip = 0.01 - shinLow(s, b, i);
        if (dip <= 0) continue;
        again = true;
        if (a.act && i >= 2) rise = Math.max(rise, dip * 1.15);
        else plan.at[i][2] += dip * 1.15;
      }
      if (!again) break;
      plan.H += rise;
      b = solve();
      b = lifted(b, plan.H - b.body.t[2]);
    }
    b.shadow = shadowOf(b.body, Math.max(0, plan.H - R.h));
    if (plan.surge) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + plan.surge, b[k].t[2]] };
    if (plan.roll || plan.rock || plan.yaw) b.trunk = joint(b.trunk, [0, 0, 0], plan.rock, plan.roll, plan.yaw);
    b.tail = joint(b.trunk, tailRoot(s), 0, 0, 0);
    if (a.act?.kind === 'work') {
      const t = a.act.t, W = PAPER_WORK;
      b.press = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, P.y, 0] };
      if (s.press.lid) {
        // Open, swung up past upright off its hinge at the far edge; shut onto the strips as the feet come up onto it; let up again.
        const open = 1 - ramp(t, W.shut - 0.02, W.shut + 0.08) * (1 - ramp(t, W.open - 0.02, W.open + 0.06));
        const squeeze = hump(t, W.press, 0.07) + 0.6 * hump(t, W.press + 0.08, 0.05);
        b.lid = joint(b.press, [0, s.press.d * 0.5, s.press.h * (1 - 0.15 * squeeze)], -104 * open, 0, 0);
      }
      const tip = sub(place(b.head, billTip(s)), b.press.t);
      if (t > W.grip - 0.01) {
        const [A, B] = peelBones(s, tip, 1 - ramp(t, W.peel + 0.04, W.toss));
        b.peelA = { m: A.m, t: add(A.t, b.press.t) };
        b.peelB = { m: B.m, t: add(B.t, b.press.t) };
      }
    }
    return b;
  };
}

/* ---- leaf-feathers and plumes ------------------------------------------------------------------ */

/**
 * A thin blade through a line of points, its face at each along `ns`, `ws` across it (half-widths) at each, folded along its rib
 * so its halves take the light differently; each stretch between two points its own material (`mats`). Two-sided, so it is not
 * lost seen from under it.
 */
function bladeOf(pts: readonly V3[], ns: readonly V3[], ws: readonly number[], mats: (k: number) => Mat): Mesh {
  const K = pts.length, v: V3[] = [], th = Math.min(0.008, Math.max(...ws) * 0.14);
  const nn: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)])), n = unit(sub(ns[k], scale(d, dot(ns[k], d)))), side = unit(cross(d, n));
    nn.push(n);
    v.push(add(pts[k], scale(side, -ws[k])), add(pts[k], scale(n, ws[k] * 0.22)), add(pts[k], scale(side, ws[k])));
  }
  const B = v.length;
  for (let q = 0; q < B; q++) v.push(sub(v[q], scale(nn[Math.floor(q / 3)], th)));
  const f: Face[] = [], want: V3[] = [];
  for (let k = 0; k < K - 1; k++) {
    const n = unit(add(nn[k], nn[k + 1])), mm = mats(k);
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m: mm });
      want.push(n);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: mm });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** How wide a leaf is `u` of the way along it, against its widest: narrow at its root, widest a third out, to a soft point. */
const leafProfile = (u: number): number => Math.max(0.16 * (1 - u), Math.sin(Math.PI * clamp(u) ** 0.62) ** 0.85);

/**
 * A broad lanceolate leaf along a line of points, its face at each along `ns`, `w` across each side of its rib at its widest: each
 * half two faces, the part toward its root in `base` and its tip in `tip`, its edges lifted by `fold` so it is a shallow V along
 * its rib and shades in two tones, the way the maple line's leaves are built (`./wild-maple`). Laid on something (`flat`), only
 * its face; standing free, its back too, a shade darker.
 */
function leafAlong(pts: readonly V3[], ns: readonly V3[], w: number, base: Mat, tip: Mat, o: { flat?: boolean; fold?: number } = {}): Mesh {
  const K = pts.length, fold = o.fold ?? 0.3, split = Math.round((K - 1) * 0.66);
  const edge = (k: number, sd: number): V3 => {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)])), n = unit(sub(ns[k], scale(d, dot(ns[k], d)))), side = unit(cross(d, n));
    const x = w * leafProfile(k / (K - 1));
    return add(add(pts[k], scale(side, sd * x)), scale(n, fold * x));
  };
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const poly = (corners: V3[], m: Mat, n: V3): void => { const b = v.length; v.push(...corners); f.push({ i: corners.map((_, q) => b + q), m }); want.push(n); };
  const mid = unit(ns[Math.floor(K / 2)]);
  for (const sd of [1, -1]) {
    const e = Array.from({ length: K }, (_, k) => edge(k, sd));
    const rootPart = [pts[0], ...e.slice(1, split + 1), pts[split]], tipPart = [pts[split], ...e.slice(split, K - 1), pts[K - 1]];
    poly(rootPart, base, mid);
    poly(tipPart, tip, mid);
    if (!o.flat) {
      const th = Math.min(0.008, w * 0.1), back = (c: V3[]): V3[] => c.map((p) => sub(p, scale(mid, th)));
      poly(back(rootPart), 'coatDark', scale(mid, -1));
      poly(back(tipPart), 'coatDark', scale(mid, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}
/** A leaf's colours: the coat, its tip lighter, now and then tinted tan. */
const leafTones = (id: number): [Mat, Mat] => ['coat', jitter(id * 5.3 + 1) < 0.22 ? 'spot' : 'coatLight'];

/** How wide a leaf-feather is along it, for `K` points: narrow at its root, widest a third out, drawn to a fine point. */
const leafWidths = (K: number): number[] => (K >= 5 ? [0.3, 0.86, 1, 0.62, 0.04] : K === 4 ? [0.34, 1, 0.6, 0.04] : [0.4, 1, 0.04]);

/**
 * A leaf-feather lying on the body: rooted `th` round it at `y` on the side `sd`, laid back along its curve for `len`, turned
 * `down` radians from straight back toward its belly, a hair off the fur at its root and lifting a little toward its tip; past
 * the rump it runs on straight.
 */
function featherOn(B: Rings, y: number, th: number, sd: number, len: number, w: number, down: number, lift: number, mats: (k: number) => Mat, K: number): { mesh: Mesh; root: V3 } {
  const pts: V3[] = [], ns: V3[] = [], end = B.y[0] + 0.04;
  for (let k = 0; k < K; k++) {
    const u = k / (K - 1), r = ringAt(B, Math.max(end, y)), rad = (r.w + r.h) / 2;
    const yy = y - len * u * Math.cos(down), tt = th - (len * u * Math.sin(down)) / rad;
    if (yy < end && k > 1) {
      // Off the end of the body: on straight from the last two points.
      const a = pts[k - 1], b = pts[k - 2];
      pts.push(add(a, scale(unit(sub(a, b)), len / (K - 1))));
      ns.push(ns[k - 1]);
      continue;
    }
    const q0 = onRings(B, Math.max(end, yy), tt), q = sd > 0 ? q0 : left(q0);
    pts.push(add(q.p, scale(q.n, 0.007 + lift * len * u * u)));
    ns.push(q.n);
  }
  return { mesh: bladeOf(pts, ns, leafWidths(K).map((x) => x * w), mats), root: pts[0] };
}
/** A broad leaf lying on the body (`featherOn`'s line), only its face. */
function leafOnBody(B: Rings, y: number, th: number, sd: number, len: number, w: number, down: number, lift: number, tones: [Mat, Mat], K: number): { mesh: Mesh; root: V3 } {
  const line = featherOn(B, y, th, sd, len, 0.001, down, lift, () => 'coat', K), pts: V3[] = [], ns: V3[] = [];
  // Its line back out of the blade it would have been: the middle of each ring of three, and the way out of the body there.
  for (let k = 0; k < K; k++) {
    const p = line.mesh.v[k * 3 + 1];
    pts.push(p);
    const r = ringAt(B, clamp(p[1], B.y[0], B.y[B.y.length - 1]));
    ns.push(unit([p[0] / Math.max(0.01, r.w * r.w), 0, (p[2] - r.z) / Math.max(0.01, r.h * r.h)]));
  }
  return { mesh: leafAlong(pts, ns, w, tones[0], tones[1], { flat: true, fold: 0.22 }), root: line.root };
}

/** What stirs, as one mesh: each corner's root (what it sways on), a phase of its own, and how far it goes. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
interface Sprig { mesh: Mesh; root: V3; id: number; k?: number | ((p: V3) => number) }
function stirOf(parts: readonly Sprig[]): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) {
    for (const v of p.mesh.v) {
      root.push(p.root);
      ph.push(jitter(p.id + 31) * TAU);
      k.push(typeof p.k === 'function' ? p.k(v) : p.k ?? 1);
    }
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

/**
 * How what grows on it stirs this moment: how far each leaf-feather and plume sways on its root and how fast, and how far grown
 * it is. A breeze standing; stirred with each step as it goes, shaken as a blow lands and as it presses; and as it evolves,
 * growing out from under half its size.
 */
function stirring(s: Papy, a: Anim): { jig: number; at: number; grow: number } {
  let jig = 0.06 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)), at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * (0.1 + 0.06 * a.gait);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    jig += 0.2 * hump(act.t, PAPER_HITS[s.strike] + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    jig += 0.12 * hump(act.t, PAPER_WORK.press + 0.03, 0.1) + 0.08 * hump(act.t, PAPER_WORK.toss, 0.06);
    at = act.t * 50;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.08 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(0.3, jig), at, grow };
}

/** A piece of things that stir and grow (`stirring`): each scaled from its root and swayed on it, a beat of its own. */
function stirred(s: Papy, G: Stir, more = 1): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const st = stirring(s, a), jig = st.jig * more, at = st.at, grow = st.grow;
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i], kk = G.k[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * kk * Math.sin(at + ph), fore = jig * kk * 0.6 * Math.cos(at * 1.3 + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/**
 * A papyrus plume's head: a spray of fine cream threads out of the top of its stalk, up and out round its axis and drooping
 * under their own weight, fluffed out toward their ends, tan at their roots, over a soft tuft. Fewer threads drawn small.
 */
function umbel(c: V3, axis: V3, r: number, fine: boolean, id: number): Mesh {
  const A = unit(axis), N = fine ? 16 : 8, K = fine ? 4 : 3;
  let u = cross(A, [0, 0, 1]);
  if (len3(u) < 1e-3) u = [1, 0, 0];
  u = unit(u);
  const w = cross(A, u), out: Mesh[] = [];
  for (let q = 0; q < N; q++) {
    const az = (q / N) * TAU + jitter(id + q) * 0.6, cone = 0.2 + 1.0 * jitter(id + q + 9);
    const radial = add(scale(u, Math.cos(az)), scale(w, Math.sin(az)));
    const dir = unit(add(scale(A, Math.cos(cone)), scale(radial, Math.sin(cone))));
    const L = r * (0.8 + 0.45 * jitter(id + q + 4));
    const pts = Array.from({ length: K }, (_, k) => { const t = k / (K - 1); return add(add(c, scale(dir, L * t)), [0, 0, -L * 0.65 * t * t]); });
    const face = unit(add(radial, scale(A, -0.2)));
    const ws = (K === 4 ? [0.02, 0.08, 0.14, 0.08] : [0.02, 0.12, 0.07]).map((x) => x * r * (fine ? 1 : 1.4));
    out.push(bladeOf(pts, pts.map(() => cross(dir, cross(face, dir))), ws, (k) => (k === 0 ? 'hornDark' : k === K - 2 ? 'cap' : 'horn')));
  }
  out.push(orbAlong(add(c, scale(A, r * 0.1)), A, [r * 0.2, r * 0.2, r * 0.26], fine ? 6 : 5, 3, 'cap'));
  return merge(...out);
}

/** A plume: a thin green stalk from `root` up through `mid` to `top`, and its head there. */
function plumeOf(root: V3, mid: V3, top: V3, r: number, fine: boolean, id: number): Mesh {
  const pts = [root, mixV(mixV(root, top, 0.5), mid, 0.6), top];
  const stalk = tube(pts, [r * 0.16, r * 0.13, r * 0.11], [r * 0.16, r * 0.13, r * 0.11], fine ? 4 : 3, 'stem');
  return merge(stalk, umbel(top, sub(top, pts[1]), r, fine, id));
}

/* ---- its body ----------------------------------------------------------------------------------- */

/** The body as one solid, a little inside its skin. */
function barrelSolid(s: Papy): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.86, ((y1 - y0) / 2) * 0.86, Math.max(...B.h) * 0.86] };
}

/** The body: cream fur, its top a deep green under the leaf-feathers that lie on it. */
function bodyOf(s: Papy, n: number): Mesh {
  const B = s.body, K = B.y.length;
  return tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU);
    if (up > 0.25 && ring < K - 2) return 'coatDark';
    return up < -0.55 ? 'belly' : 'mark';
  });
}

/**
 * The leaf-feathers down its back: orderly rows of broad lanceolate leaves from its shoulders back, like a duck's feathers, each
 * laid along the body's own curve and sweeping back, overlapping the row behind it, each row half a leaf round from the one
 * before; ending above the middle of its flank so its cream belly shows under them. Together one smooth green mantle.
 */
function cloakOf(s: Papy, fine: boolean): Sprig[] {
  const M = s.cloak, B = s.body, out: Sprig[] = [], K = fine ? 6 : 4;
  let row = 0;
  for (let y = M.from; y >= M.to - 1e-6; y -= M.gap, row++) {
    const r = ringAt(B, y);
    const span = Math.PI / 2 - M.low, arcLen = span * (r.w + r.h) * 0.5;
    const count = Math.max(1, Math.round(arcLen / (M.leaf[1] * 1.5)));
    for (let q = 0; q <= count; q++) {
      const th = Math.PI / 2 - Math.min(span, (q + (row % 2) * 0.5) * (span / (count + 0.5)));
      for (const sd of q === 0 && row % 2 === 0 ? [1] : [1, -1]) {
        const id = row * 131 + q * 17 + (sd > 0 ? 0 : 7);
        const low = clamp((Math.PI / 2 - th) / span);
        // As long as the leaf, but no further past the rump than a little: it runs on into the tail.
        const L = Math.min(M.leaf[0], y - B.y[0] + M.leaf[0] * 0.3);
        const leaf = leafOnBody(B, y, th, sd, L, M.leaf[1], 0.12 + 0.3 * low, 0.03, leafTones(id), K);
        out.push({ mesh: leaf.mesh, root: leaf.root, id, k: 0.4 + 0.5 * low });
      }
    }
  }
  return out;
}

/** The neck's girth along it, at the root and under the head. */
const neckW = (s: Papy, z: number): number => s.neck.w * lerp(1.14, 0.78, clamp(z / s.neck.len) ** 0.7);

/** The neck: a tube up out of its chest into its head, its throat cream and the back of it green under its mane. */
function neckOf(s: Papy, n: number): Mesh {
  const N = s.neck, zs = [-N.w * 0.9, N.len * 0.3, N.len * 0.7, N.len + N.w * 0.1];
  return tube(zs.map((z, q) => [0, q === 3 ? 0.03 : 0, z] as V3), zs.map((z) => neckW(s, z)), zs.map((z) => neckW(s, z) * 0.92), n,
    (_ring, j) => (Math.sin(((j + 1) / n) * TAU) > 0.05 ? 'mark' : 'coat'), { up: [0, 1, 0], seam: 'both' });
}

/**
 * The mane down its neck: rows of broad leaves on the back and sides of it, from under its head to its shoulders, each lying on it
 * and sweeping down and back, short at the top and longer toward its shoulders, where they lie over its back; the cream of its
 * throat and the front of it left open.
 */
function maneOf(s: Papy, fine: boolean): Sprig[] {
  const N = s.neck, M = s.mane, out: Sprig[] = [], K = fine ? 5 : 4, rows = fine ? M.rows : Math.max(1, Math.ceil(M.rows * 0.7));
  for (let row = 0; row < rows; row++) {
    const f = rows === 1 ? 0.5 : row / (rows - 1), z = lerp(N.len * 0.94, -N.w * 0.1, f);
    const w = neckW(s, z), big = 0.65 + 0.9 * f, lw = M.leaf[1] * (0.8 + 0.5 * f);
    const reach = 1.3, count = Math.max(2, Math.round((reach * 2 * w) / (lw * 1.5)));
    for (let q = 0; q <= count; q++) {
      const ph = lerp(-reach, reach, (q + (row % 2) * 0.5) / (count + 0.5)), id = 2000 + row * 71 + q * 13;
      const n: V3 = unit([Math.sin(ph), -Math.cos(ph), 0]);
      const at: V3 = [Math.sin(ph) * w, -Math.cos(ph) * w * 0.92, z];
      const dir = unit(add(add([0, 0, -1], [0, -(0.2 + 0.6 * f), 0]), scale(n, 0.06)));
      const L = M.leaf[0] * big;
      const pts = Array.from({ length: K }, (_, k) => add(add(at, scale(n, 0.008 + 0.06 * L * (k / (K - 1)) ** 2)), scale(dir, (L * k) / (K - 1))));
      const tones = leafTones(id);
      out.push({ mesh: leafAlong(pts, pts.map(() => n), lw, tones[0], tones[1], { flat: true, fold: 0.22 }), root: at, id, k: 0.7 });
    }
  }
  return out;
}

/* ---- its head ----------------------------------------------------------------------------------- */

/** The way out of the skull's middle to a point, scaled to a ball. */
const dirIn = (C: V3, R: V3, p: V3): V3 => unit([(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]]);
/** Whether a way out of the skull is the cream of its face: its front up over its eyes, its cheeks, and under its chin. */
const creamFace = (d: V3): boolean => (d[1] > -0.3 && d[2] < 0.62) || d[2] < -0.3;
/** The way out of the head to the right eye. */
const EYE: V3 = [0.6, 0.62, 0.34];

/** Where its bill comes out of its face, in the head's frame, and the way it points: forward and a little down. */
function billRoot(s: Papy): { p: V3; d: V3 } {
  const H = s.head, e = onEgg(H.at, H.r, [0, 1, -0.42]);
  return { p: add(e.p, [0, -H.r[1] * 0.12, 0]), d: unit([0, 1, -0.14]) };
}

/**
 * The bill: a duck's, long, broad and flat, dark grey, its lower half darker so the line of its mouth runs along its side,
 * rounded at its end, two nostrils on its top near the tip.
 */
function billOf(s: Papy, n: number): Mesh {
  const B = billRoot(s), b = s.bill, d = B.d;
  const st = [-0.12, 0.0, 0.25, 0.55, 0.8, 0.92, 1.0];
  const ws = [0.66, 0.78, 0.94, 1.0, 0.96, 0.78, 0.36], hs = [1.8, 1.3, 0.95, 0.8, 0.72, 0.6, 0.32];
  const pts = st.map((u, q) => add(add(B.p, scale(d, b.len * u)), [0, 0, b.h * (q < 2 ? 0.25 : 0) - b.h * 0.3 * u * u]));
  const bill = tube(pts, ws.map((w) => w * b.w), hs.map((h) => h * b.h), n, (_ring, j) => (Math.sin(((j + 1) / n) * TAU) > -0.12 ? 'bill' : 'billDark'), { up: [0, 0, 1] });
  const nos: Disc[] = [];
  for (const sd of [1, -1]) {
    const at = add(add(B.p, scale(d, b.len * 0.78)), [sd * b.w * 0.3, 0, b.h * 0.62 - b.h * 0.3 * 0.6]);
    nos.push(disc(at, [0, 0.15, 1], b.w * 0.09, b.w * 0.14, 5, 'billDark', { up: [0, 1, 0] }));
  }
  return merge(bill, paint(nos));
}

/** A shape painted on the skull, its corners laid onto its curve: a cheek, a smile. */
function onSkull(s: Papy, pts: V3[], m: Mat, lift: number, o: { lit?: boolean } = {}): Disc {
  const H = s.head;
  const v = pts.map((d) => { const e = onEgg(H.at, H.r, d); return add(e.p, scale(e.n, lift)); });
  const mid = onEgg(H.at, H.r, pts.reduce((t, p) => add(t, p), [0, 0, 0] as V3));
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  const vv = nx * mid.n[0] + ny * mid.n[1] + nz * mid.n[2] < 0 ? [...v].reverse() : v;
  return { v: vv, m, lit: o.lit, at: sub(mid.p, scale(mid.n, H.r[0] * 0.04)) };
}

/** Its eyes: amber, each with a dark rim and a dark middle and two glints, laid onto the skull's curve; a lid's line, shut. */
function eyesOf(s: Papy, shut: boolean): Mesh {
  const E = s.eye, H = s.head, C = H.at, R = H.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * EYE[0], EYE[1], EYE[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.01)), at = add(q.p, scale(n, -R[0] * 0.04));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -E * 0.1)), n, E * 1.1, E * 0.32, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, E * 1.18, E * 1.22, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, E, E * 1.05, 12, 'gem', o), 0.016));
    out.push(onto(disc(add(p, scale(across, side * E * 0.06)), n, E * 0.5, E * 0.62, 10, 'eye', o), 0.02));
    out.push(onto(disc(add(add(p, scale(up, E * 0.36)), scale(across, side * E * 0.26)), n, E * 0.34, E * 0.36, 6, 'glint', { ...o, lit: true }), 0.026));
    out.push(onto(disc(add(add(p, scale(up, -E * 0.42)), scale(across, -side * E * 0.3)), n, E * 0.15, E * 0.15, 5, 'glint', { ...o, lit: true }), 0.026));
  }
  const m = paint(out);
  // An eye goes whole once its side of the head is turned away, rather than showing a sliver at the edge of it.
  m.f.forEach((f, q) => { f.unless = out[q].v[0][0] > 0 ? [-1, -0.2, 0] : [1, -0.2, 0]; });
  return m;
}

/**
 * The head: a round skull, cream over its face, cheeks and chin and green over its crown and the back of it, its bill out of the
 * front of its face; a soft smile up from each corner of the bill; and its eyes.
 */
function headOf(s: Papy, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = H.at, R = H.r;
  const skull = orbAlong(C, [0, 1, 0], [R[0], R[2], R[1]], n + 5, k + 3, 'coat');
  const out: Mesh[] = [painted(skull, (c) => (creamFace(dirIn(C, R, c)) ? 'mark' : 'coat'))];
  // Round cheeks under its eyes.
  for (const sd of [1, -1]) out.push(orbAlong(onEgg(C, R, [sd * 0.72, 0.42, -0.42]).p, [sd * 0.6, 0.5, -0.3], [R[0] * 0.34, R[0] * 0.3, R[0] * 0.38], n, 4, 'mark'));
  out.push(billOf(s, n + 2));
  // The smile: a dark line from each corner of the bill back along the cheek, turned up at its end.
  const smileD: Disc[] = [];
  for (const sd of [1, -1]) {
    const line: V3[] = [[sd * 0.3, 0.88, -0.42], [sd * 0.5, 0.76, -0.38], [sd * 0.64, 0.64, -0.26], [sd * 0.66, 0.6, -0.18]];
    const th = 0.035;
    smileD.push(onSkull(s, [...line.map((p) => add(p, [0, 0, th])), ...[...line].reverse().map((p) => add(p, [0, 0, -th]))], 'lid', 0.012));
  }
  out.push(paint(smileD));
  out.push(eyesOf(s, shut));
  return merge(...out);
}

/** The skull as a solid, a little inside it. */
const headSolid = (s: Papy): { c: V3; r: V3 } => ({ c: s.head.at, r: scale(s.head.r, 0.9) });

/**
 * The leaf-feathers on its head: a ruff over its crown and round the back of its skull, rooted in rows from its brow back, each
 * lying back off it and standing out a little, the back rows longest so they run on into its mane; a few on each cheek behind the
 * eye, swept back. None in front of its eyes.
 */
function crestOf(s: Papy, fine: boolean): Sprig[] {
  const H = s.head, C = H.at, R = H.r, Cr = s.crest, out: Sprig[] = [], K = fine ? 5 : 4;
  for (let row = 0; row < Cr.rows; row++) {
    // From the brow back: how far round from straight up toward the back of the head.
    const f = row / Math.max(1, Cr.rows - 1), back = lerp(0.15, 1.15, f);
    const count = fine ? 5 + row * 2 : 3 + row;
    for (let q = 0; q < count; q++) {
      const az = lerp(-1, 1, (q + 0.5) / count) * lerp(0.9, 1.5, f), id = 3000 + row * 37 + q * 7;
      const d: V3 = [Math.sin(az) * Math.sin(back + 0.3), -Math.sin(back) * Math.cos(az) * 0.9 + 0.15, Math.cos(back) * Math.cos(az * 0.8)];
      const e = onEgg(C, R, d);
      const dir = unit(add(add([0, -1, 0.35 - 0.25 * f], scale(e.n, 0.5)), [Math.sin(az) * 0.3, 0, 0]));
      const L = Cr.leaf[0] * (0.8 + 0.5 * f), root = add(e.p, scale(e.n, -0.01));
      const pts = Array.from({ length: K }, (_, k) => { const u = k / (K - 1); return add(add(root, scale(dir, L * u)), scale(e.n, 0.2 * L * u * u)); });
      const tones = leafTones(id);
      out.push({ mesh: leafAlong(pts, pts.map(() => e.n), Cr.leaf[1] * 1.2, tones[0], tones[1]), root: e.p, id, k: 1.2 });
    }
  }
  // On each cheek behind the eye, swept back.
  for (const sd of [1, -1]) {
    for (let q = 0; q < (fine ? 3 : 2); q++) {
      const id = 3500 + q * 5 + (sd > 0 ? 0 : 2), e = onEgg(C, R, [sd * 0.92, -0.25 - 0.12 * q, 0.15 - 0.28 * q]);
      const dir = unit(add([sd * 0.25, -1, 0.05 - 0.2 * q], scale(e.n, 0.35)));
      const L = Cr.leaf[0] * (0.75 - 0.1 * q), root = add(e.p, scale(e.n, -0.01));
      const pts = Array.from({ length: K }, (_, k) => add(root, scale(dir, (L * k) / (K - 1))));
      const tones = leafTones(id);
      out.push({ mesh: leafAlong(pts, pts.map(() => e.n), Cr.leaf[1], tones[0], tones[1]), root: e.p, id, k: 1 });
    }
  }
  return out;
}

/** The sprig of plumes off its crown: stalks rising up and back from the top of its head, fanned a little, each with its plume. */
function crownPlumes(s: Papy, fine: boolean): Sprig[] {
  const H = s.head, P = s.plumes, out: Sprig[] = [];
  const base = onEgg(H.at, H.r, [0, -0.35, 0.94]).p;
  for (let q = 0; q < P.n; q++) {
    const u = P.n === 1 ? 0 : lerp(-1, 1, q / (P.n - 1)), id = 4000 + q * 11;
    const h = P.h * (1.0 - 0.18 * Math.abs(u) + 0.12 * jitter(id));
    const root = add(base, [u * H.r[0] * 0.2, -0.02 * Math.abs(u), -0.02]);
    const top = add(root, [u * h * 0.32, -h * (0.36 + 0.1 * jitter(id + 1)), h]);
    const mid = add(root, [u * h * 0.08, -h * 0.05, h * 0.55]);
    const m = plumeOf(root, mid, top, P.r * (0.9 + 0.2 * jitter(id + 2)), fine, id);
    out.push({ mesh: m, root, id, k: (v) => 1.5 * clamp((v[2] - root[2]) / h) });
  }
  return out;
}

/* ---- its legs and feet --------------------------------------------------------------------------- */

/**
 * A webbed foot (the right; the left is its mirror): broad and dark, three long toes splayed forward with the web between them
 * scalloped in toward the heel, a claw on each, and a short toe back.
 */
function footOf(r: number, drop: number, fine: boolean): Mesh {
  const z0 = -drop + r * 0.05, out: Mesh[] = [];
  const toes = [-0.48, 0, 0.48], tl = [1.35, 1.55, 1.35];
  const tips = toes.map((a, q): V3 => [Math.sin(a) * r * tl[q], r * 0.15 + Math.cos(a) * r * tl[q], z0]);
  const ring: V3[] = [[-r * 0.38, -r * 0.22, z0]];
  for (let q = 0; q < 3; q++) {
    ring.push(tips[q]);
    if (q < 2) { const m = mixV(tips[q], tips[q + 1], 0.5); ring.push([m[0] * 0.78, r * 0.15 + (m[1] - r * 0.15) * 0.72, z0]); }
  }
  ring.push([r * 0.38, -r * 0.22, z0]);
  const c: V3 = [0, r * 0.35, z0 + r * 0.1], th = r * 0.06;
  const v: V3[] = [c, ...ring, add(c, [0, 0, -th * 2]), ...ring.map((p) => add(p, [0, 0, -th]))];
  const f: Face[] = [], want: V3[] = [], M = ring.length, B = M + 1;
  for (let q = 0; q < M - 1; q++) {
    f.push({ i: [0, 1 + q, 2 + q], m: 'membrane' });
    want.push([0, 0, 1]);
    f.push({ i: [B, B + 1 + q, B + 2 + q], m: 'pad' });
    want.push([0, 0, -1]);
    f.push({ i: [1 + q, 2 + q, B + 2 + q, B + 1 + q], m: 'pad' });
    want.push(unit([ring[q][0] + ring[q + 1][0], ring[q][1] + ring[q + 1][1] - r * 0.3, 0]));
  }
  f.push({ i: [0, M, 1], m: 'membrane' });
  want.push([0, 0, 1]);
  out.push(mesh(v, wound(v, f, want)));
  // The toes along the web's top, and a claw on each; the ankle a round knob.
  const nn = fine ? 5 : 4;
  for (let q = 0; q < 3; q++) {
    const d = unit(sub(tips[q], [0, r * 0.15, z0]));
    out.push(tube([[0, r * 0.1, z0 + r * 0.22], add(tips[q], [-d[0] * r * 0.12, -d[1] * r * 0.12, r * 0.08])], [r * 0.2, r * 0.1], [r * 0.16, r * 0.08], nn, 'pad'));
    out.push(tube([add(tips[q], [-d[0] * r * 0.1, -d[1] * r * 0.1, r * 0.07]), add(tips[q], [d[0] * r * 0.16, d[1] * r * 0.16, r * 0.0])], [r * 0.08, r * 0.01], [r * 0.07, r * 0.01], 4, 'claw'));
  }
  out.push(tube([[0, 0, z0 + r * 0.12], [0, -r * 0.5, z0 + r * 0.02]], [r * 0.12, r * 0.04], [r * 0.1, r * 0.03], 4, 'pad'));
  out.push(orb([0, r * 0.05, z0 + r * 0.32], [r * 0.34, r * 0.4, r * 0.32], nn + 1, 3, 'pad'));
  return merge(...out);
}

/**
 * Leaf-feathers over the top of a leg (the right; the left is its mirror), in its upper's frame: rooted round its outside and
 * front and hanging down it to about its knee, so its shoulder and its hip are feathered as its body is.
 */
function cuffOf(s: Papy, fore: boolean, fine: boolean): Mesh {
  const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : 1.12), out: Mesh[] = [], N = fine ? 4 : 3;
  for (let q = 0; q < N; q++) {
    const a = lerp(-1.4, 1.4, q / (N - 1)), id = 7000 + q * 11 + (fore ? 0 : 5);
    const n: V3 = [Math.cos(a), Math.sin(a) * (fore ? 1 : -1), 0];
    const at: V3 = [n[0] * w * 0.95, n[1] * w * 0.95, -L[0] * (0.05 + 0.15 * (q % 2))];
    const dir = unit(add([0, 0, -1], scale(n, 0.1)));
    const len = (L[0] + L[1]) * 0.6, K = fine ? 5 : 4, tones = leafTones(id);
    const pts = Array.from({ length: K }, (_, k) => add(add(at, scale(dir, (len * k) / (K - 1))), scale(n, 0.008)));
    out.push(leafAlong(pts, pts.map(() => n), w * 0.55, tones[0], tones[1], { flat: true }));
  }
  return merge(...out);
}

/** The legs: short, rooted up inside the body, cream fur going tan toward the foot, a broad dark webbed foot. */
function legPieces(s: Papy, n: number, fine: boolean): Piece[] {
  const out: Piece[] = [], hide = [barrelSolid(s)];
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : 1.12);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.6, -L[0], q / 4)] as V3), [w * 0.6, w * 1.08, w * 1.0, w * 0.82, w * 0.62], [w * 0.6, w * 1.0, w * 0.94, w * 0.78, w * 0.58], n, 'mark', { seam: 'end' });
    const end = w * 0.46;
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(w * 0.3, -L[1], q / 3)] as V3), [w * 0.58, w * 0.56, lerp(w * 0.55, end, 0.5), end], [w * 0.58, w * 0.56, lerp(w * 0.55, end, 0.5), end], n, (ring) => (ring >= 2 ? 'belly' : 'mark'), { seam: 'both' });
    const foot = footOf(s.foot * (fore ? 1 : 1.08), L[2], fine);
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.1, -L[0] * 0.12], [0, 0, 1], [w * 1.15, w * 1.1, w * 1.05], n, 4, 'mark'));
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: true, hide: fore ? hide : undefined, hideIn: fore ? 'trunk' : undefined },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front },
      { key: `${key}c`, mesh: side < 0 ? mirror(cuffOf(s, fore, fine)) : cuffOf(s, fore, fine), bone: `${key}0`, bias: 0.07, after: ['body', 'cloak'], front: [side, 0, 0], hide, hideIn: 'trunk', lines: false },
    );
  }
  return out;
}

/* ---- its tail ------------------------------------------------------------------------------------- */

/** A line through points, smoothed and evenly spaced by length: `n` points. */
function lineThrough(pts: readonly V3[], n: number): V3[] {
  const fine: V3[] = [];
  const K = pts.length, P = (i: number): V3 => pts[clamp(i, 0, K - 1)];
  for (let i = 0; i < K - 1; i++) {
    for (let q = 0; q < 8; q++) {
      const t = q / 8, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t2 = t * t, t3 = t2 * t;
      fine.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as V3);
    }
  }
  fine.push(pts[K - 1]);
  const cum = [0];
  for (let k = 1; k < fine.length; k++) cum.push(cum[k - 1] + len3(sub(fine[k], fine[k - 1])));
  const total = cum[cum.length - 1], out: V3[] = [];
  let k = 1;
  for (let q = 0; q < n; q++) {
    const d = (q / (n - 1)) * total;
    while (k < cum.length - 1 && cum[k] < d) k++;
    out.push(mixV(fine[k - 1], fine[k], clamp((d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]))));
  }
  return out;
}

/**
 * The tail: a short tapering core along its line, and a fan of long leaves over it -- pairs rooted along its first half, each
 * following its line and turned out to either side, the outer ones rooted nearer its root and shorter, and one along its middle to
 * its tip. Each corner keeps how far along the tail it is, so the tail bends as it swings.
 */
function tailOf(s: Papy, fine: boolean): { mesh: Mesh; u: number[] } {
  const T = s.tail, N = 12, line = lineThrough(T.pts, N), parts: Array<{ m: Mesh; u: number[] }> = [];
  const core = tube(line.slice(0, 7), line.slice(0, 7).map((_, q) => T.w * lerp(1, 0.4, q / 6)), line.slice(0, 7).map((_, q) => T.w * 0.9 * lerp(1, 0.4, q / 6)), fine ? 6 : 4, 'coatDark', { seam: 'start' });
  const coreU = core.v.map((_, i) => (Math.floor(i / (fine ? 6 : 4)) / (N - 1)));
  let total = 0;
  for (let q = 1; q < N; q++) total += len3(sub(line[q], line[q - 1]));
  const at = (u: number): { p: V3; t: V3 } => {
    const x = clamp(u) * (N - 1), q = Math.min(N - 2, Math.floor(x));
    return { p: mixV(line[q], line[q + 1], x - q), t: unit(sub(line[q + 1], line[q])) };
  };
  const K = fine ? 6 : 4, side: V3 = [1, 0, 0];
  // Its line is in the body's middle, so across it is always across the body, however it curls.
  const fanned = (u0: number, u1: number, spread: number, sd: number, lift: number, id: number, wk: number): void => {
    const pts: V3[] = [], ns: V3[] = [], us: number[] = [];
    for (let k = 0; k < K; k++) {
      const t = k / (K - 1), u = lerp(u0, u1, t), q = at(u), up = unit(cross(q.t, side));
      // Fanned out across the tail and up or down from it by turns, so it is a fan seen from the side as well as from behind.
      const across = unit(add(scale(side, 0.75), scale(up, 0.66 * sd))), off = sd * Math.sin(spread) * total * (u - u0);
      pts.push(add(add(q.p, scale(across, off)), scale(up, T.w * 0.5 + lift * t)));
      ns.push(unit(add(up, scale(side, -0.6 * sd))));
      us.push(u);
    }
    const tones = leafTones(id), m = leafAlong(pts, ns, T.leaf[1] * wk, tones[0], tones[1]);
    // Each corner the share of the way along of the nearest point of its line.
    parts.push({ m, u: m.v.map((v) => { let best = 0, bd = Infinity; pts.forEach((p, k) => { const d = len3(sub(v, p)); if (d < bd) { bd = d; best = k; } }); return us[best]; }) });
  };
  const pairs = fine ? 4 : 3;
  for (let j = pairs - 1; j >= 0; j--) {
    const f = j / Math.max(1, pairs - 1), u0 = lerp(0.42, 0.05, f), u1 = Math.min(1, u0 + (T.leaf[0] / total) * lerp(1, 0.75, f));
    for (const sd of [1, -1]) fanned(u0, u1, lerp(0.16, 0.5, f), sd, T.w * 0.2, 5000 + j * 19 + (sd > 0 ? 0 : 7), lerp(1, 0.85, f));
  }
  fanned(0.5, 1, 0, 1, T.w * 0.4, 5900, 1.1);
  const u: number[] = [...coreU];
  for (const p of parts) u.push(...p.u);
  return { mesh: merge(core, ...parts.map((p) => p.m)), u };
}

/** How far its tail swings out to the side (degrees, at its tip) and lifts, this moment: a swish standing; against its body's swing going. */
function tailSwing(s: Papy, a: Anim): [number, number] {
  let yaw = 10 * cyc(a.t, 6) + 16 * beat(a.t, [6.4, 15.8, 22.2], 1.2) * Math.sin(a.t * TAU * 3);
  let lift = 4 * cyc(a.t, 4, 0.6);
  if (a.go > 0) {
    const g = smooth(a.go), w = frac(a.u);
    yaw = lerp(yaw, -s.gait.yaw * 3 * Math.sin((w - 0.1) * TAU), g);
    lift = lerp(lift, 4 * Math.sin(w * TAU * 2), g);
  }
  const act = a.act;
  if (act?.kind === 'strike') { yaw = 26 * hump(act.t, PAPER_HITS[s.strike], 0.2) * Math.sin(act.t * 30); lift = 12 * hump(act.t, 0.3, 0.2); }
  else if (act?.kind === 'work') { yaw = 8 * Math.sin(act.t * TAU * 2); lift = 10 * hump(act.t, PAPER_WORK.press, 0.12) - 6 * hump(act.t, PAPER_WORK.toss, 0.06); }
  else if (act?.kind === 'evolve') { yaw = 20 * hump(act.t, 0.62, 0.12) * Math.sin(act.t * 40); lift = 14 * ramp(act.t, 0.44, 0.6) * (1 - ramp(act.t, 0.72, 0.94)); }
  return [yaw, lift];
}

/* ---- what it carries ------------------------------------------------------------------------------ */

/** How many points across a sheet, from its left edge over the top to its right. */
const ACROSS = 11;

/**
 * Tier `k` of the sheets, from the lowest, across the body at `y`: from its left edge over the top to its right, each tier lying
 * on the one under it, the higher ones a little narrower, flatter on top and hanging less far down; its hanging edge wavy along
 * the body and its face a little rippled, as a soft sheet lies.
 */
function sheetSection(s: Papy, y: number, k: number): V3[] {
  const S = s.sheets!, r = ringAt(s.body, y), off = 0.012 + S.th * k;
  const f = S.n === 1 ? 0 : k / (S.n - 1), e = 2 / (2 + 0.6 * S.flat * f), drop = S.drop + 0.2 * f + 0.05 * Math.sin(y * 7 + k * 1.7);
  const w = r.w * (1 - 0.06 * f) + off, h = r.h + off;
  return Array.from({ length: ACROSS }, (_, i) => {
    const th = lerp(Math.PI - drop, drop, i / (ACROSS - 1)), ripple = 1 + 0.025 * Math.sin(i * 1.9 + y * 11 + k);
    return [w * ripple * sgnPow(Math.cos(th), e), y, r.z + h * ripple * sgnPow(Math.sin(th), e)] as V3;
  });
}
/** Where along it tier `k` runs: each shorter than the one under it at both ends, so they step up like a stack. */
function layerSpan(s: Papy, k: number): [number, number] {
  const S = s.sheets!, L = S.from - S.to;
  return [S.to + L * 0.12 * k, S.from - L * 0.1 * k];
}

/**
 * The sheets: tiers of soft papyrus laid over its back like a blanket, following its curve and hanging down its flanks, each a
 * thin sheet with a faint weave of crossed strips on its face and a wavy hanging edge, rolled into a round scroll at its front
 * edge and its back.
 */
function sheetsOf(s: Papy, fine: boolean): Mesh {
  const S = s.sheets!, out: Mesh[] = [], nr = fine ? 7 : 5, NY = fine ? 6 : 3;
  for (let k = 0; k < S.n; k++) {
    const [y0, y1] = layerSpan(s, k), ys = Array.from({ length: NY }, (_, q) => lerp(y0, y1, q / (NY - 1)));
    const tops = ys.map((y) => sheetSection(s, y, k)), th = 0.01;
    const v: V3[] = [], f: Face[] = [], want: V3[] = [];
    for (const sec of tops) for (const p of sec) v.push(p);
    const B = v.length;
    tops.forEach((sec, q) => sec.forEach((p) => { const r = ringAt(s.body, ys[q]); v.push(add(p, scale(unit([p[0], 0, p[2] - r.z]), -th))); }));
    const idx = (q: number, i: number): number => q * ACROSS + i;
    for (let q = 0; q < NY - 1; q++) {
      for (let i = 0; i < ACROSS - 1; i++) {
        const mid = add(v[idx(q, i)], v[idx(q + 1, i + 1)]), r = ringAt(s.body, mid[1] / 2), out0 = unit([mid[0] / 2, 0, mid[2] / 2 - r.z]);
        // The weave: strips along it, and across now and then, a shade darker where they lie.
        const weave = fine ? i % 3 === 1 || (q % 2 === 1 && i % 3 === 0) : i % 4 === 1;
        f.push({ i: [idx(q, i), idx(q, i + 1), idx(q + 1, i + 1), idx(q + 1, i)], m: weave ? 'lining' : 'cloth' });
        want.push(out0);
        f.push({ i: [B + idx(q, i), B + idx(q, i + 1), B + idx(q + 1, i + 1), B + idx(q + 1, i)], m: 'clothDark' });
        want.push(scale(out0, -1));
      }
    }
    out.push(mesh(v, wound(v, f, want)));
    // Its back edge rolled into a scroll, a round cylinder across it, a little out from the sheet; and its front edge over the top of
    // its back, where it shows, behind the neck.
    for (const [q, sd] of [[0, -1], [NY - 1, 1]] as Array<[number, number]>) {
      const r = ringAt(s.body, ys[q]), sec = sd > 0 ? tops[q].slice(2, ACROSS - 2) : tops[q];
      const pts = sec.map((p) => { const o = unit([p[0], 0, p[2] - r.z]); return add(add(p, scale(o, S.roll * 0.55)), [0, sd * S.roll * 0.15, 0]); });
      out.push(tube(fine ? pts : pts.filter((_, i) => i % 2 === 0), S.roll, S.roll, nr, (ring) => (ring % 5 === 2 ? 'lining' : 'cloth')));
    }
  }
  return merge(...out);
}

/**
 * The outline of the sheets at `y` over its back, from the hanging edge of the lowest tier on its left to the one on its right:
 * what a strap goes over, its ends tucked under the sheets' edges.
 */
function bandLoop(s: Papy, y: number): V3[] {
  const S = s.sheets!, r = ringAt(s.body, y), pts: V3[] = [], N = 14, edge = sheetSection(s, y, 0)[ACROSS - 1];
  const reach = Math.atan2((edge[2] - r.z) / r.h, edge[0] / r.w) + 0.04;
  for (let q = 0; q <= N; q++) {
    const th = lerp(Math.PI - reach, reach, q / N), bx = r.w * Math.cos(th), bz = r.h * Math.sin(th);
    // Round the body a hair off it, the way out from its middle at this point.
    const a = Math.atan2(bz, bx);
    let rho = Math.hypot(bx, bz) + 0.012;
    // And out over every layer whose span here covers this way round.
    for (let k = 0; k < S.n; k++) {
      const [y0, y1] = layerSpan(s, k);
      if (y < y0 || y > y1) continue;
      const sec = sheetSection(s, y, k);
      for (let i = 0; i < sec.length - 1; i++) {
        const a0 = Math.atan2(sec[i][2] - r.z, sec[i][0]), a1 = Math.atan2(sec[i + 1][2] - r.z, sec[i + 1][0]);
        if ((a - a0) * (a - a1) > 0) continue;
        const f = Math.abs(a1 - a0) < 1e-6 ? 0 : (a - a0) / (a1 - a0);
        const p = mixV(sec[i], sec[i + 1], f);
        rho = Math.max(rho, Math.hypot(p[0], p[2] - r.z) + 0.006);
      }
    }
    pts.push([rho * Math.cos(a), y, r.z + rho * Math.sin(a)]);
  }
  return pts;
}

/** The reed bands: flat green straps over the sheets. */
function bandsOf(s: Papy): Mesh {
  return merge(...s.bands.map((y) => tube(bandLoop(s, y), 0.007, 0.028 + s.sheets!.roll * 0.15, 4, (ring) => (ring % 2 ? 'leaf' : 'leafDark'), { up: [0, 1, 0] })));
}

/** The top of the sheets at `y`, `x` out to its right: on the highest tier there. */
function stackTop(s: Papy, y: number, x: number): V3 {
  if (!s.sheets) { const q = onRings(s.body, y, Math.PI / 2); return add(q.p, [x, 0, 0]); }
  let k = s.sheets.n - 1;
  while (k > 0 && (y < layerSpan(s, k)[0] || y > layerSpan(s, k)[1])) k--;
  const sec = sheetSection(s, y, k), mid = sec[(ACROSS - 1) / 2];
  return [x, y, mid[2] - Math.abs(x) * 0.2];
}

/**
 * A bundle of papyrus reeds standing on its back: green stalks gathered at their foot and tied round a third of the way up with
 * a reed band, fanning out above it, each topped with a plume.
 */
function bundleOf(s: Papy, B: Papy['bundles'][number], fine: boolean, id0: number): Sprig[] {
  const foot = stackTop(s, B.y, B.x), out: Sprig[] = [];
  const lean = rotX([0, 0, 1], -B.lean[0]), up = unit([Math.sin(B.lean[1] * DEG) * lean[2], lean[1], lean[2]]);
  const tie = add(foot, scale(up, B.h * 0.28)), n = fine ? B.n : Math.max(3, Math.ceil(B.n * 0.6)), r = s.plumes.r * 1.05;
  const stalks: Mesh[] = [];
  for (let q = 0; q < n; q++) {
    const id = id0 + q * 13, az = (q / n) * TAU + jitter(id) * 0.6, spread = 0.12 + 0.24 * jitter(id + 1) + (q === 0 ? -0.1 : 0);
    const radial: V3 = [Math.cos(az), Math.sin(az) * 0.7, 0];
    const h = B.h * (0.72 + 0.32 * jitter(id + 2));
    const dir = unit(add(up, scale(radial, spread)));
    const rootQ = add(foot, scale(radial, r * 0.25)), tieQ = add(tie, scale(radial, r * 0.18));
    const top = add(tieQ, scale(dir, h - B.h * 0.28));
    stalks.push(tube([rootQ, tieQ, mixV(tieQ, top, 0.5), top], r * 0.13, r * 0.13, fine ? 4 : 3, 'stem'));
    out.push({ mesh: umbel(top, dir, r * (0.9 + 0.25 * jitter(id + 3)), fine, id), root: foot, id, k: 0.5 + 0.5 * (h / B.h) });
  }
  const band = tube([add(tie, scale(up, -r * 0.2)), add(tie, scale(up, r * 0.2))], r * 0.5, r * 0.5, fine ? 7 : 5, 'leafDark');
  out.push({ mesh: merge(...stalks, band), root: foot, id: id0, k: (v) => 0.4 * clamp(len3(sub(v, foot)) / B.h) });
  return out;
}

/* ---- its press ------------------------------------------------------------------------------------- */

/**
 * The press, as its pieces on its bone, in its frame on the ground before it: a low wooden bed with a rim; two rows of reed
 * strips laid on it, one across and one along; the sheet they become; and the lid hinged at its far edge, a knob on top.
 */
function pressPieces(s: Papy, fine: boolean): Piece[] {
  const P = s.press, W = PAPER_WORK, out: Piece[] = [];
  const working = (a: Anim, t0: number, t1: number): boolean => !!a.act && a.act.kind === 'work' && a.act.t >= t0 && a.act.t < t1;
  const top = P.h, rim = P.w * 0.05;
  const bed = merge(
    box([0, 0, P.h * 0.5], [P.w * 0.5, P.d * 0.5, P.h * 0.5], 'wood', 'woodDark'),
    box([0, P.d * 0.5 - rim * 0.5, top + rim * 0.3], [P.w * 0.5, rim * 0.5, rim * 0.3], 'wood'),
    box([0, -P.d * 0.5 + rim * 0.5, top + rim * 0.3], [P.w * 0.5, rim * 0.5, rim * 0.3], 'wood'),
  );
  out.push({ key: 'press', mesh: bed, bone: 'press', bias: -0.1, convex: true });
  const sw = P.w * 0.8, sd = P.d * 0.8, st = P.h * 0.12;
  const across = merge(...[-1, 0, 1].map((q) => box([0, q * sd * 0.3, top + st], [sw * 0.5, sd * 0.13, st], q ? 'stem' : 'hornDark', q ? 'leaf' : 'hornDark')));
  const along = merge(...[-1, 0, 1].map((q) => box([q * sw * 0.3, 0, top + st * 3], [sw * 0.13, sd * 0.5, st], q ? 'hornDark' : 'stem', q ? 'horn' : 'leaf')));
  out.push({ key: 'strips', mesh: across, bone: 'press', bias: -0.05, after: 'press', shown: (a) => working(a, W.lay, W.press) });
  out.push({ key: 'strips2', mesh: along, bone: 'press', bias: -0.04, after: ['press', 'strips'], shown: (a) => working(a, W.lay2, W.press) });
  out.push({ key: 'sheet', mesh: box([0, 0, top + st * 1.2], [sw * 0.5, sd * 0.5, st * 1.2], 'clothDark', 'cloth'), bone: 'press', bias: -0.05, after: 'press', shown: (a) => working(a, W.press, W.grip) });
  // The sheet as it is peeled: two halves (`peelBones`), each along its -y.
  const half = (): Mesh => box([0, -sd * 0.25, 0], [sw * 0.5, sd * 0.25, st * 0.8], 'clothDark', 'cloth');
  out.push({ key: 'peelA', mesh: half(), bone: 'peelA', bias: 0.02 });
  out.push({ key: 'peelB', mesh: half(), bone: 'peelB', bias: 0.02, after: 'peelA' });
  if (P.lid) {
    const lt = P.h * 0.35;
    const lid = merge(
      box([0, -P.d * 0.5, lt], [P.w * 0.52, P.d * 0.5, lt], 'woodDark', 'wood'),
      box([0, -P.d * 0.5, lt * 2 + P.h * 0.25], [P.w * 0.3, P.d * 0.08, P.h * 0.25], 'woodDark', 'wood'),
    );
    out.push({ key: 'lid', mesh: lid, bone: 'lid', bias: 0.01, after: ['press', 'strips', 'strips2', 'sheet'], convex: !fine });
  }
  return out;
}

/* ---- the pieces --------------------------------------------------------------------------------- */

/** A stage's pieces: its body, neck and head, the leaf-feathers on them, its tail and legs, what it carries, and its press. */
function papyBuild(s: Papy, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), fine = lod > 0;
  const solid = barrelSolid(s), N = s.neck;
  const neckSolid = { c: [0, 0, N.len * 0.45] as V3, r: [N.w * 0.68, N.w * 0.64, N.len * 0.58] as V3 };
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: bodyOf(s, cut(lod, 10, 14)), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.03 } });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body'], convex: true });
  const cloak = stirOf(cloakOf(s, fine));
  pieces.push({ key: 'cloak', mesh: cloak.mesh, bone: 'trunk', bias: 0.06, after: ['body'], hide: [solid], bent: stirred(s, cloak), airy: true });
  const mane = stirOf(maneOf(s, fine));
  pieces.push({ key: 'mane', mesh: mane.mesh, bone: 'neck', bias: 0.07, after: ['neck', 'cloak'], hide: [neckSolid], bent: stirred(s, mane), airy: true });
  const head = { mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true) };
  const extras = ['mane', 'cloak', 'sheets', 'bands', 'bundle0', 'bundle1'];
  pieces.push({ key: 'head', ...head, bone: 'head', bias: 0.2, hide: [headSolid(s)], after: extras, front: [0, 1, 0] });
  const crest = stirOf(crestOf(s, fine));
  pieces.push({ key: 'crest', mesh: crest.mesh, bone: 'head', bias: 0.21, after: ['head'], front: [0, -1, 0.5], hide: [headSolid(s)], bent: stirred(s, crest), airy: true });
  const plumes = stirOf(crownPlumes(s, fine));
  pieces.push({ key: 'plumes', mesh: plumes.mesh, bone: 'head', bias: 0.19, after: ['head', 'crest'], front: [0, -1, 0.2], hide: [headSolid(s)], bent: stirred(s, plumes, 1.6), airy: true });
  const T = tailOf(s, fine);
  pieces.push({
    key: 'tail', mesh: T.mesh, bone: 'tail', bias: -0.04, airy: true,
    bent: (v, a) => {
      const [yaw, lift] = tailSwing(s, a);
      const st = stirring(s, a);
      return v.map((p, i) => {
        const u = T.u[i], ya = yaw * DEG * u ** 1.3, pi = lift * DEG * u, g = lerp(st.grow, 1, 0.4);
        const q = rotX([p[0] * g, p[1] * g, p[2] * g], pi), c = Math.cos(ya), sn = Math.sin(ya);
        return [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c, q[2]];
      });
    },
  });
  pieces.push(...legPieces(s, n, fine));
  if (s.sheets) {
    pieces.push({ key: 'sheets', mesh: sheetsOf(s, fine), bone: 'trunk', bias: 0.09, after: ['body', 'cloak'], hide: [solid] });
    if (s.bands.length) pieces.push({ key: 'bands', mesh: bandsOf(s), bone: 'trunk', bias: 0.1, after: ['body', 'cloak', 'sheets'], hide: [solid], thin: true });
  }
  s.bundles.forEach((B, q) => {
    const G = stirOf(bundleOf(s, B, fine, 6000 + q * 300));
    pieces.push({ key: `bundle${q}`, mesh: G.mesh, bone: 'trunk', bias: 0.11, after: ['body', 'cloak', 'sheets', 'bands'], bent: stirred(s, G, 1.2), airy: true });
  });
  pieces.push(...pressPieces(s, fine));
  // A reed strip held across its bill on its way to the press, until the second row is down.
  const tip = billTip(s);
  pieces.push({
    key: 'held', mesh: box(add(tip, [0, -s.bill.len * 0.25, -s.bill.h * 0.2]), [s.press.w * 0.36, s.bill.len * 0.1, s.bill.h * 0.35], 'stem', 'leaf'), bone: 'head', bias: 0.24, after: ['head'],
    shown: (a) => a.act?.kind === 'work' && (a.act.t < PAPER_WORK.lay - 0.03 || (a.act.t > PAPER_WORK.lay + 0.03 && a.act.t < PAPER_WORK.lay2 - 0.03)),
  });
  return pieces;
}

/* ---- drawn round it ----------------------------------------------------------------------------------- */

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const WATER: RGB = [168, 214, 240], WATER_INK: RGB = [60, 104, 150], WATER_LIGHT: RGB = [228, 246, 255];
/** The size of a pixel in the canvas's own units, for things drawn by hand. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** A drop of water: a pale-blue bead with an inked edge and a glint, never under a pixel and a bit across. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(WATER_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * 1.15 + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(WATER, al);
  g.beginPath();
  g.ellipse(x, y, r, r * 1.15, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(WATER_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35, r * 0.36, 0, TAU);
    g.fill();
  }
}

/** Pressing: the water squeezed out of the strips, squirting out from under the press's sides as it comes down, and falling. */
function squeeze(g: CanvasRenderingContext2D, view: View, s: Papy, b: Bones, t: number, front: boolean): void {
  const pr = b.press;
  if (!pr) return;
  const P = s.press, mid = pr.t, k = Math.sqrt(P.w / 0.66);
  for (const [t0, n0] of [[PAPER_WORK.press - 0.01, 0], [PAPER_WORK.press + 0.07, 20]] as Array<[number, number]>) {
    const since = (t - t0) * ACT_SECS.work;
    if (since < 0 || since > 0.26) continue;
    for (let q = 0; q < 8; q++) {
      const id = n0 + q * 7, sd = q % 2 ? 1 : -1, along = (jitter(id) - 0.5) * P.d * 0.7;
      const from: V3 = [mid[0] + sd * P.w * 0.45, mid[1] + along, mid[2] + P.h * 1.2];
      const v: V3 = [sd * (0.6 + 0.6 * jitter(id + 1)) * k, (jitter(id + 2) - 0.5) * 0.6 * k, (1.2 + 0.8 * jitter(id + 3)) * k];
      const p: V3 = [from[0] + v[0] * since, from[1] + v[1] * since, Math.max(0.01, from[2] + v[2] * since - 4.5 * since * since)];
      if (nearSide(p, b.body.t, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      drop(g, x, y, 0.022 * k, 1 - smooth((since - 0.16) / 0.1));
    }
  }
}

/** Evolving: leaf-feathers and wisps of plume spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Papy, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.44, 0.52));
  if (swirl <= 0) return;
  const B = s.body, big = 0.6 + 0.4 * (B.y[B.y.length - 1] - B.y[0]) / 1.4, mid = b.body.t;
  const rx = ringAt(B, 0).w * 1.8 + 0.3 * big, ry = (B.y[B.y.length - 1] - B.y[0]) * 0.65 + 0.2, high = ringAt(B, 0).h * 3 + 0.6 * big;
  const px = pxOf(g);
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 16) * TAU + u * TAU * 1.3, kk = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * kk, Math.sin(ang) * ry * kk, -ringAt(B, 0).h * 0.4 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const cream = q % 3 === 0, c: RGB = cream ? [250, 240, 216] : q % 3 === 1 ? [138, 168, 92] : [176, 196, 118], r = (cream ? 0.06 : 0.09) * big;
    g.fillStyle = css(c, swirl);
    g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
    g.lineWidth = Math.max(px * 0.8, r * 0.16);
    g.beginPath();
    g.ellipse(x, y, r, r * (cream ? 0.8 : 0.32), ang * 2, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** Light over it as it evolves: a soft green glow as it begins, and over its back at the turn. */
function papyGlow(s: Papy, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], B = s.body, L = B.y[B.y.length - 1] - B.y[0];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, 0, ringAt(B, 0).h * 0.6]), r: L, c: [214, 236, 190], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, 0, ringAt(B, 0).h * 1.6]), r: L * 0.7 + 0.4, c: [244, 238, 210], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the water it squeezes from the strips. */
function papyKind(s: Papy): Kind {
  const B = s.body;
  return {
    bones: papyBones(s),
    build: (lod) => papyBuild(s, lod),
    // The variant's coat for its leaf-feathers, kept leafy rather than chalked; its markings for the cream of its fur. Its bill,
    // its webbed feet, the papyrus, the reed bands and the plumes the same on every variant.
    palette: (coat, mark) => {
      const leaf = darker(coat, 0.16), cream = mix(mark, pastel(mark), 0.4);
      return coatPalette(coat, mark, {
        coat: leaf,
        coatDark: darker(leaf, 0.3),
        coatLight: lighter(mix(leaf, [196, 196, 100], 0.3), 0.06),
        mark: cream,
        belly: mix(cream, [206, 170, 116], 0.3),
        muzzle: cream,
        spot: mix([206, 168, 104], leaf, 0.15),
        bill: [96, 92, 98],
        billDark: [64, 60, 68],
        pad: [84, 74, 72],
        membrane: [110, 98, 92],
        claw: [54, 46, 46],
        lid: [70, 46, 36],
        eye: [42, 24, 18],
        gem: [222, 146, 46],
        glint: [255, 252, 240],
        cloth: [232, 210, 158],
        clothDark: [196, 166, 110],
        lining: [224, 200, 148],
        stem: [128, 152, 76],
        leaf: [116, 146, 70],
        leafDark: [86, 112, 54],
        cap: [252, 244, 222],
        horn: [232, 214, 170],
        hornDark: [204, 176, 120],
        wood: [176, 130, 86],
        woodDark: [134, 96, 62],
      }, 30);
    },
    shadow: [(B.y[B.y.length - 1] - B.y[0]) * 0.62 + 0.25, Math.max(...B.w) * 1.25],
    stride: 1.3,
    size: SIZE,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are a leaf's green and the plumes' cream.
    motes: [[150, 182, 100], [250, 240, 214]],
    glow: (b, a) => papyGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (act?.kind === 'work') squeeze(g, view, s, b, act.t, !under);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, !under);
    },
  };
}

export const REEDLING = papyKind(REEDLING_LOOK);
export const PAPYRUSKIN = papyKind(PAPYRUSKIN_LOOK);
export const PRESSMERE = papyKind(PRESSMERE_LOOK);
