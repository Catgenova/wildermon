import {
  ACT_SECS, add, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, merge, mix, orbAlong, paint, scale, smooth,
  sub, TAU, tube, unit, type Anim, type Bones, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, hump, jitter, nearSide, quadPieces, ramp } from './beastkit';
import { mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import {
  badgerBones, BADGER_HITS, barrelSolid, blowFlash, css, domed, eyesOf, headSolids, left, legPieces, line, onRings, restOf, specOf,
  stillPlan, strikeBurst, thrown, wound, type Badger, type Plan, type Rest, type Rings,
} from './wild-badger';

/**
 * The pestlet line: the Pestlet, a small pangolin, a cream face with a pointed snout, big round ears and a dark eye, covered in
 * overlapping scales of orange, rust and sand with a few lavender among them, a long scaly tail curled up over its back, and a
 * shallow round stone bowl of swirled mortar on its back; which grows into the Churnscale, bigger, a bigger bowl ringed with
 * lavender-grey stones set among its scales, its tail arched high over its back and ending in a squared spout that pours a
 * stream of mortar into the bowl; and then the Mortarium, large and long on heavy legs and big pale claws, pale stone plates
 * carved with spirals over its shoulders and flanks, spiky scales down its sides, a big stone bowl banded with orange diamonds,
 * and a huge tail arched over it pouring a thick stream. The species is still `crakka` underneath, as saves and the database
 * know it: the concrete mixer.
 *
 * Its body, legs, gait, eyes and strikes are the badger line's (`./wild-badger`). Its scales, bowl and tail are its own: the
 * bowl and the tail are one piece on its back, every facet of them put in order with every other, so the near rim hides the
 * stream where it goes in and the tail's root goes behind the bowl; the tail's corners are bound to a line through its middle
 * (`tailBound`) and moved with it as it sways, walks and stirs. At its task the tail's tip pours, then dips into the bowl and
 * goes once round it, the mortar turning with it and a little slopping over the rim, and lifts out pouring again.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Pest extends Badger {
  /** Rows of scales over its back and flanks: from and to along it, how many rows, scales a side in a row, how far round from the top (radians), how long and wide, how far a free end stands up. */
  scales: { from: number; to: number; rows: number; per: number; spread: number; a: number; b: number; lift: number };
  /** The stone bowl on its back: where along it, its radius at the rim, how tall, how thick its rim, how full, how far sunk into its back. */
  bowl: { at: number; r: number; h: number; rim: number; fill: number; sink: number };
  /** The tail's line standing (from its root in the rump to its tip), how thick at root and tip, rows of scales and scales round a row, its spout's length (nought for a pointed tip), and whether it pours standing. */
  arch: { pts: V3[]; r: [number, number]; rows: number; per: number; spout: number; pours: boolean };
  /** The lavender-grey stones set round the bowl, how big; nought for none. */
  chunks: number;
  /** The pale stone plates over its shoulders and flanks, how long; nought for none. */
  shields: number;
  /** Orange diamonds set round the bowl. */
  band: boolean;
  /** How far the lowest scale of each row and the tail's side scales stand out: its spikes; nought for none. */
  spikes: number;
  /** Scales on its head: rows, a row's count, how long. */
  crown: { rows: number; per: number; a: number };
  /** How thick the stream of mortar is where it leaves the spout. */
  stream: number;
}

const NO_PLATES = { from: 0, to: 0, rows: 0, per: 0, spread: 0.9, a: 0, b: 0, t: 0.03, lift: 0 };
const NO_LEAVES = { n: 0, len: 0, from: 0, to: 0 };
const NO_DIG = { snuffle: 0, dig: 0, sniff: 0, mark: 0 };
const MASK = { stripe: 1, band: 1, cheek: -1, back: 0.3 };

/** The head's rings, a round skull and a long pointed snout, at a size of one; each stage's at its own size. */
const HEAD_Y = [-0.3, -0.24, -0.1, 0.06, 0.2, 0.32, 0.42, 0.5];
const HEAD_Z = [0.08, 0.09, 0.08, 0.04, 0, -0.03, -0.05, -0.06];
const HEAD_W = [0.1, 0.36, 0.42, 0.37, 0.26, 0.17, 0.11, 0.065];
const HEAD_H = [0.1, 0.35, 0.4, 0.33, 0.22, 0.14, 0.09, 0.055];
const headAt = (k: number, pitch: number, snout = 1): Badger['head'] => ({
  y: HEAD_Y.map((y, q) => (q >= 4 ? HEAD_Y[3] + (y - HEAD_Y[3]) * snout : y) * k), z: HEAD_Z.map((z) => z * k), w: HEAD_W.map((w) => w * k), h: HEAD_H.map((h) => h * k), pitch,
});

/** A Pestlet: a small pangolin, a shallow bowl of mortar on its back, its tail curled up over it. */
const PESTLET_LOOK: Pest = {
  stage: 0,
  body: { y: [-1.1, -0.95, -0.52, 0, 0.48, 0.76, 0.9], z: [0.02, 0.05, 0.1, 0.13, 0.12, 0.08, 0.04], w: [0.28, 0.47, 0.56, 0.58, 0.54, 0.45, 0.24], h: [0.18, 0.31, 0.39, 0.42, 0.39, 0.31, 0.17] },
  len: 1.3,
  fore: [0.15, 0.13, 0.07], hind: [0.15, 0.13, 0.07], thick: 0.27, hip: 0.56, hindThick: 1.08,
  stand: { fore: [0, 44], hind: [24, -60] },
  paw: 0.14, hindPaw: 0.13,
  claw: { n: 4, len: 0.09, w: 0.032 }, hindClaw: 0.06,
  neck: { at: [0, 0.72, 0.08], len: 0.12, w: 0.36, lean: 74 },
  head: headAt(1.15, -8, 0.82),
  mask: MASK,
  nose: 0.052,
  eye: { y: 0.035, up: 0.42, size: 0.082, tall: 1.12, lid: 0 },
  ear: { len: 0.3, w: 0.24, out: 62, back: 16, at: [0.42, 0.95] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 0.1, w: 0.05, lift: 0, leaves: 0 },
  gait: { bob: [0.05, 0.06], duty: [0.58, 0.44], swing: [36, 40], step: 0.5, roll: 8, nod: 4, sway: 6, jiggle: 0.5 },
  strike: 0,
  digs: 0,
  work: NO_DIG,
  size: 4.0,
  scales: { from: 0.8, to: -1.05, rows: 6, per: 4, spread: 1.95, a: 0.3, b: 0.21, lift: 0.1 },
  bowl: { at: -0.1, r: 0.6, h: 0.26, rim: 0.08, fill: 0.8, sink: 0.12 },
  arch: { pts: [[0, -0.97, 0.3], [0, -1.33, 0.5], [0, -1.55, 0.95], [0, -1.43, 1.38], [0, -1.11, 1.6], [0, -0.79, 1.55], [0, -0.61, 1.36]], r: [0.27, 0.1], rows: 9, per: 5, spout: 0, pours: false },
  chunks: 0,
  shields: 0,
  band: false,
  spikes: 0,
  crown: { rows: 2, per: 3, a: 0.1 },
  stream: 0.06,
};

/** A Churnscale: bigger, a bigger bowl ringed with lavender-grey stones, its tail arched high and pouring from a squared spout. */
const CHURNSCALE_LOOK: Pest = {
  stage: 1,
  body: { y: [-1.64, -1.43, -0.8, -0.05, 0.7, 1.17, 1.38], z: [-0.06, 0, 0.08, 0.14, 0.16, 0.12, 0.04], w: [0.42, 0.74, 0.88, 0.9, 0.86, 0.72, 0.38], h: [0.24, 0.42, 0.55, 0.59, 0.57, 0.46, 0.24] },
  len: 2.3,
  fore: [0.24, 0.21, 0.1], hind: [0.24, 0.21, 0.1], thick: 0.4, hip: 0.64, hindThick: 1.06,
  stand: { fore: [8, 50], hind: [24, -62] },
  paw: 0.22, hindPaw: 0.19,
  claw: { n: 4, len: 0.17, w: 0.05 }, hindClaw: 0.1,
  neck: { at: [0, 1.16, 0.16], len: 0.24, w: 0.56, lean: 84 },
  head: headAt(1.8, -10, 0.9),
  mask: MASK,
  nose: 0.082,
  eye: { y: 0.06, up: 0.42, size: 0.12, tall: 1.05, lid: 0.08 },
  ear: { len: 0.43, w: 0.35, out: 60, back: 20, at: [0.42, 0.95] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 0.1, w: 0.05, lift: 0, leaves: 0 },
  gait: { bob: [0.07, 0.09], duty: [0.6, 0.5], swing: [34, 38], step: 0.42, roll: 7, nod: 3, sway: 5, jiggle: 0.45 },
  strike: 1,
  digs: 0,
  work: NO_DIG,
  size: 3.4,
  scales: { from: 1.24, to: -1.56, rows: 7, per: 5, spread: 1.95, a: 0.45, b: 0.31, lift: 0.15 },
  bowl: { at: -0.14, r: 1.05, h: 0.48, rim: 0.13, fill: 0.8, sink: 0.16 },
  arch: { pts: [[0, -1.5, 0.4], [0, -2.07, 0.75], [0, -2.37, 1.6], [0, -2.12, 2.55], [0, -1.42, 3.0], [0, -0.72, 2.85], [0, -0.34, 2.4]], r: [0.46, 0.2], rows: 11, per: 6, spout: 0.42, pours: true },
  chunks: 0.27,
  shields: 0,
  band: false,
  spikes: 0,
  crown: { rows: 3, per: 3, a: 0.15 },
  stream: 0.12,
};

/** A Mortarium: large and long, pale stone plates with spirals, spiky scales, a big banded bowl and a huge tail pouring into it. */
const MORTARIUM_LOOK: Pest = {
  stage: 2,
  body: { y: [-3.6, -3.2, -1.9, 0, 1.75, 2.76, 3.2], z: [-0.16, -0.04, 0.16, 0.34, 0.44, 0.32, 0.08], w: [1.0, 1.7, 2.1, 2.16, 2.14, 1.82, 0.9], h: [0.4, 0.76, 1.06, 1.2, 1.21, 0.92, 0.42] },
  len: 5.8,
  fore: [0.55, 0.48, 0.3], hind: [0.54, 0.47, 0.28], thick: 1.6, hip: 0.64, hindThick: 1.0,
  stand: { fore: [8, 46], hind: [24, -58] },
  paw: 0.74, hindPaw: 0.6,
  claw: { n: 4, len: 0.8, w: 0.2 }, hindClaw: 0.42,
  neck: { at: [0, 2.78, 0.6], len: 0.7, w: 1.4, lean: 78 },
  head: headAt(4.0, -6, 1.0),
  mask: MASK,
  nose: 0.155,
  eye: { y: 0.12, up: 0.44, size: 0.21, tall: 0.9, lid: 0.26 },
  ear: { len: 0.86, w: 0.7, out: 58, back: 26, at: [0.42, 0.95] },
  plates: NO_PLATES, stones: 0, legStones: false, leaves: NO_LEAVES, sprout: 0, mound: 0,
  tail: { len: 0.1, w: 0.05, lift: 0, leaves: 0 },
  gait: { bob: [0.16, 0.2], duty: [0.62, 0.52], swing: [30, 34], step: 0.34, roll: 6, nod: 2, sway: 5, jiggle: 0.35 },
  strike: 2,
  digs: 0,
  work: NO_DIG,
  size: 1.9,
  scales: { from: 2.76, to: -3.4, rows: 9, per: 6, spread: 1.95, a: 1.0, b: 0.7, lift: 0.32 },
  bowl: { at: -0.3, r: 2.25, h: 1.15, rim: 0.28, fill: 0.84, sink: 0.36 },
  arch: { pts: [[0, -3.4, 0.9], [0, -4.5, 1.6], [0, -5.0, 3.4], [0, -4.5, 5.2], [0, -3.2, 6.1], [0, -1.8, 5.9], [0, -1.0, 5.0]], r: [1.0, 0.45], rows: 12, per: 6, spout: 0.9, pours: true },
  chunks: 0.5,
  shields: 1.5,
  band: true,
  spikes: 1,
  crown: { rows: 3, per: 3, a: 0.32 },
  stream: 0.26,
};

/* ---- a scale ------------------------------------------------------------------------- */

/**
 * A scale: rooted at `root` on whatever it grows on, `n` the way out there and `back` the way it lies; `a` long and `b` wide, its
 * root end round and its free end pointed (`point`), `t` thick, the free end standing up `lift` off the root; its top a low
 * point a little toward its tip, so it is lit in facets; its underside its dark `edge`. Top and underside do not meet, so the
 * top's edge is inked all round: each scale drawn as one.
 */
interface Scale { root: V3; n: V3; back: V3; a: number; b: number; t: number; lift: number; m: Mat; edge: Mat; point: number; id: number }

function scaleMesh(P: Scale): Mesh {
  const z = unit(P.n), y = unit(sub(P.back, scale(z, dot(P.back, z)))), x = cross(y, z);
  const S = 10;
  const at = (lx: number, ly: number, h: number): V3 => add(P.root, add(add(scale(x, lx), scale(y, ly)), scale(z, h)));
  // Its outline: round behind (toward its root) and drawn to a point ahead, a little uneven.
  const shape = (j: number): [number, number] => {
    const th = ((j + 0.5) / S) * TAU - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    const ly = s > 0 ? s * P.a : s * P.a * 0.55;
    const lx = c * P.b * (s > 0 ? 1 - P.point * s ** 1.6 : 1) * (0.95 + 0.1 * jitter(P.id * 7 + j));
    return [lx, ly];
  };
  const rise = (ly: number): number => P.lift * clamp((ly / P.a + 0.55) / 1.55);
  const top: V3[] = [], under: V3[] = [];
  for (let j = 0; j < S; j++) {
    const [tx, ty] = shape(j);
    top.push(at(tx, ty, P.t + rise(ty)));
    under.push(at(tx * 0.96, ty * 0.96, rise(ty) - P.t * 0.5));
  }
  const peak = at(0, P.a * 0.18, P.t * 2.6 + rise(P.a * 0.18));
  const low = at(0, P.a * 0.1, rise(P.a * 0.1) - P.t);
  const v: V3[] = [...top, ...under, peak, low];
  const f: Face[] = [], want: V3[] = [];
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S;
    const out = unit(sub(scale(add(top[j], top[j1]), 0.5), peak));
    f.push({ i: [j, j1, 2 * S], m: P.m });
    want.push(unit(add(z, scale(out, 0.4))));
    f.push({ i: [S + j1, S + j, 2 * S + 1], m: P.edge });
    want.push(scale(z, -1));
  }
  return mesh(v, wound(v, f, want));
}

/** Which colour a scale is, by a number of its own and how warm where it is: orange, rust, sand, and now and then lavender. */
function scaleTone(id: number, lav: number, warm = 0.5): [Mat, Mat] {
  const r = jitter(id * 13 + 7);
  if (r < lav) return ['petal', 'cap'];
  const w = warm + (jitter(id * 5 + 3) - 0.5) * 0.8;
  if (w > 0.62) return ['feather', 'featherDark'];
  if (w > 0.2) return ['coat', 'coatDark'];
  return ['coatLight', 'bark'];
}

/** How many of its scales are lavender, at each stage. */
const LAVENDER = [0.07, 0.12, 0.15];

/* ---- its back ------------------------------------------------------------------------- */

/** Where the bowl is: the middle of its foot on its back, the heights of its foot, rim and mortar, and its radii. */
interface Geo { c: V3; z0: number; zr: number; zs: number; ri: number; rs: number }
function geoOf(s: Pest): Geo {
  const W = s.bowl, top = onRings(s.body, W.at, Math.PI / 2).p;
  const z0 = top[2] - W.sink, zr = z0 + W.h, zs = z0 + W.h * W.fill;
  const ri = W.r - W.rim;
  return { c: [0, W.at, z0], z0, zr, zs, ri, rs: ri * 0.96 };
}

/** How wide its body is at `y`, from its rings. */
function wideAt(B: Rings, y: number): number {
  let k = 0;
  while (k < B.y.length - 2 && B.y[k + 1] < y) k++;
  return lerp(B.w[k], B.w[k + 1], clamp((y - B.y[k]) / (B.y[k + 1] - B.y[k])));
}
/** The point on top of its body over (x, y), and the way out there. */
function onBack(B: Rings, x: number, y: number): { p: V3; n: V3 } {
  const w = wideAt(B, y), c = clamp(Math.abs(x) / w, 0, 0.98), th = Math.acos(c);
  const q = onRings(B, y, th);
  return x >= 0 ? q : left(q);
}

/**
 * The scales over its back and flanks, in rows from behind its neck to its rump, set like bricks, each lying back and a little
 * down round it, the rows behind lying over the roots of the ones in front; none under the bowl. Its spikes: the lowest of
 * each row longer and standing out.
 */
function bodyScales(s: Pest, G: Geo): Mesh[] {
  const C = s.scales, B = s.body, out: Mesh[] = [];
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y0 = lerp(C.from, C.to, f);
    const per = C.per + (r % 2 ? 0 : 1);
    for (const sd of [1, -1]) {
      for (let q = 0; q < per; q++) {
        const id = 100 + r * 31 + q * 3 + (sd > 0 ? 0 : 1000);
        const g = (q + (r % 2 ? 0.5 : 0) + 0.15) / per;
        const th = Math.PI / 2 - g * C.spread;
        const y = y0 + (jitter(id) - 0.5) * 0.04 * s.len;
        const q0 = onRings(B, y, th), at = sd > 0 ? q0 : left(q0);
        // None hidden under the bowl.
        if (Math.hypot(at.p[0], at.p[1] - G.c[1]) < s.bowl.r * 0.82 && at.p[2] > G.z0 - s.bowl.h * 0.3) continue;
        const down = unit(cross(at.n, [0, -1, 0]));
        const round = scale(down, sd * (dot(down, [0, 0, 1]) > 0 ? -1 : 1));
        const back = unit(add([0, -1, 0], scale(round, 0.25 + 0.5 * g)));
        const low = q === per - 1 && s.spikes > 0 && f > 0.12 && f < 0.9;
        const k = (0.9 + 0.2 * jitter(id + 5)) * (1 - 0.15 * Math.abs(f - 0.45)) * (1 + 0.2 * g);
        const [m, edge] = low ? (jitter(id + 9) < 0.5 ? ['petal', 'cap'] as [Mat, Mat] : ['feather', 'featherDark'] as [Mat, Mat]) : scaleTone(id, LAVENDER[s.stage], 0.75 - 0.6 * g);
        out.push(scaleMesh({
          root: add(at.p, scale(at.n, -C.a * 0.08)), n: at.n, back,
          a: C.a * k * (low ? 1.5 : 1), b: C.b * k * (low ? 0.7 : 1), t: C.a * 0.06, lift: C.lift * k * (low ? 1.7 : 1),
          m, edge, point: low ? 0.85 : 0.55, id,
        }));
      }
    }
  }
  return out;
}

/** A rough stone: a lumpy faceted ball `r` big, half sunk into what it sits on, lavender-grey, darker under, paler on top. */
function chunkMesh(c: V3, r: V3, up: V3, id: number): Mesh {
  const b = orbAlong([0, 0, 0], up, r, 5, 3, 'crystalDark');
  const v = b.v.map((p, i) => add(c, scale(p, 0.86 + 0.26 * jitter(id * 31 + i))) as V3);
  const sky = unit(add(unit(up), [0, 0, 0.8]));
  const f = b.f.map((face) => {
    const mid = scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    const out = unit(sub(mid, c)), u = dot(out, sky);
    const m: Mat = u > 0.72 ? 'petal' : out[2] < -0.2 ? 'cap' : 'crystalDark';
    return { ...face, m };
  });
  return mesh(v, f);
}

/** The Churnscale's and the Mortarium's stones round the foot of the bowl, set in among the scales. */
function chunksOf(s: Pest, G: Geo): Mesh[] {
  if (!s.chunks) return [];
  const out: Mesh[] = [];
  const N = s.stage === 2 ? 9 : 8;
  for (let q = 0; q < N; q++) {
    const id = 400 + q;
    const a = (q / N) * TAU + 0.3 + (jitter(id) - 0.5) * 0.3;
    const rr = s.bowl.r * (1.0 + 0.12 * jitter(id + 1));
    const x = Math.cos(a) * rr, y = G.c[1] + Math.sin(a) * rr * 0.95;
    const at = onBack(s.body, x, y);
    const k = s.chunks * (0.75 + 0.5 * jitter(id + 2));
    out.push(chunkMesh(add(at.p, scale(at.n, k * 0.55)), [k * 1.1, k * 0.95, k * 0.8], unit(add(at.n, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0])), id));
  }
  return out;
}

/**
 * A pale stone plate: a big scale of stone on its shoulder, flank or haunch, carved with a spiral, a raised groove going round
 * three times out from its middle.
 */
function shieldMesh(at: { p: V3; n: V3 }, back: V3, L: number, id: number): Mesh {
  const plate = scaleMesh({ root: add(at.p, scale(at.n, L * 0.02)), n: at.n, back, a: L, b: L * 0.72, t: L * 0.08, lift: L * 0.2, m: 'shell', edge: 'shellDark', point: 0.62, id });
  const z = unit(at.n), y = unit(sub(back, scale(z, dot(back, z)))), x = cross(y, z);
  const c = add(at.p, add(scale(y, L * 0.28), scale(z, L * 0.02 + L * 0.08 * 2.2 + L * 0.18 * 0.4)));
  const pts: V3[] = [];
  const turns = 2.3, steps = 22;
  for (let q = 0; q <= steps; q++) {
    const u = q / steps, a = u * turns * TAU, r = L * 0.42 * (0.08 + 0.92 * u);
    pts.push(add(c, add(add(scale(x, Math.cos(a) * r * 0.8), scale(y, Math.sin(a) * r)), scale(z, L * 0.03 * u))));
  }
  const groove = tube(pts, L * 0.045, L * 0.03, 4, 'shellDark', { up: z });
  return merge(plate, groove);
}

/** The Mortarium's plates: over each shoulder, flank and haunch. */
function shieldsOf(s: Pest): Mesh[] {
  if (!s.shields) return [];
  const B = s.body, out: Mesh[] = [];
  const spots: Array<[number, number, number]> = [[0.8, 0.5, 1.15], [0.5, 0.28, 1.1], [0.2, 0.42, 1.0]];
  for (const sd of [1, -1]) {
    spots.forEach(([f, th, k], q) => {
      const id = 600 + q * 7 + (sd > 0 ? 0 : 50);
      const y = lerp(B.y[0], B.y[B.y.length - 1], f);
      const q0 = onRings(B, y, th), at = sd > 0 ? q0 : left(q0);
      const down = unit(cross(at.n, [0, -1, 0]));
      const round = scale(down, sd * (dot(down, [0, 0, 1]) > 0 ? -1 : 1));
      const back = unit(add([0, -1, 0], scale(round, 0.35)));
      out.push(shieldMesh({ p: add(at.p, scale(at.n, s.scales.a * 0.25)), n: at.n }, back, s.shields * k, id));
    });
  }
  return out;
}

/* ---- the bowl --------------------------------------------------------------------------- */

/**
 * The bowl: a round open bowl of stone blocks, its foot sunk in its back; its outer wall in courses of blocks, staggered, two
 * stones' colours; a pale rim all round on top; the inner wall going down in shadow to the mortar; on the Mortarium, orange
 * diamonds set round its middle.
 */
function bowlMesh(s: Pest, G: Geo, N: number): Mesh {
  const W = s.bowl, r = W.r, H = W.h, z0 = G.z0, zr = G.zr;
  // Its profile, from its foot round over the rim and down inside to the mortar: (radius, height).
  const prof: Array<[number, number]> = [
    [r * 0.58, z0 - H * 0.12], [r * 0.8, z0 + H * 0.2], [r * 0.94, z0 + H * 0.55], [r, zr - H * 0.1], [r * 0.99, zr],
    [G.ri, zr], [G.ri * 0.985, G.zs - H * 0.02],
  ];
  const c = G.c;
  const v: V3[] = [];
  for (const [pr, pz] of prof) for (let j = 0; j < N; j++) {
    const a = (j / N) * TAU;
    v.push([c[0] + Math.cos(a) * pr, c[1] + Math.sin(a) * pr, pz]);
  }
  const f: Face[] = [], want: V3[] = [];
  // The rim and the inside, all round in one: its lip, its top and its inner wall down to the mortar.
  for (let k = 3; k < prof.length - 1; k++) {
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N, a = ((j + 0.5) / N) * TAU;
      const radial: V3 = [Math.cos(a), Math.sin(a), 0];
      const m: Mat = k === 5 ? 'stoneDark' : 'crystal';
      f.push({ i: [k * N + j, k * N + j1, (k + 1) * N + j1, (k + 1) * N + j], m });
      want.push(k === 3 ? unit(add(radial, [0, 0, 0.6])) : k === 4 ? [0, 0, 1] : scale(radial, -1));
    }
  }
  const parts: Mesh[] = [mesh(v, wound(v, f, want))];
  // Its outer wall: courses of stone blocks, each block a stone of its own, a little rounded out, inked round; every other
  // course half a block round, two stones' colours.
  const NB = Math.max(7, Math.round(N / 2.4));
  for (let k = 0; k < 3; k++) {
    const [r0, h0] = prof[k], [r1, h1] = prof[k + 1];
    for (let q = 0; q < NB; q++) {
      const id = 700 + k * 41 + q;
      const a0 = ((q + (k % 2) * 0.5) / NB) * TAU, a1 = ((q + 1 + (k % 2) * 0.5) / NB) * TAU;
      const bv: V3[] = [], bf: Face[] = [], bw: V3[] = [];
      for (const [pr, pz] of [[r0, h0], [r1, h1]] as Array<[number, number]>) {
        for (let j = 0; j <= 2; j++) {
          const a = lerp(a0, a1, j / 2), bulge = j === 1 ? r * 0.025 : 0;
          bv.push([c[0] + Math.cos(a) * (pr + bulge), c[1] + Math.sin(a) * (pr + bulge), pz + (j === 1 ? (h1 - h0) * 0.04 : 0)]);
        }
      }
      for (let j = 0; j < 2; j++) {
        const a = lerp(a0, a1, (j + 0.5) / 2);
        bf.push({ i: [j, j + 1, 4 + j, 3 + j], m: s.band && k === 1 ? 'horn' : jitter(id) < 0.45 ? 'horn' : 'stone', soft: k === 0 || undefined });
        bw.push(unit([Math.cos(a), Math.sin(a), 0.3]));
      }
      parts.push(mesh(bv, wound(bv, bf, bw)));
    }
  }
  if (s.band) {
    // Diamonds round its middle course: each a low four-sided point standing off the wall, orange, its facets lit apart.
    const D = 11, zc = z0 + H * 0.56, rc = r * 0.95;
    for (let q = 0; q < D; q++) {
      const a = ((q + 0.5) / D) * TAU;
      const out: V3 = [Math.cos(a), Math.sin(a), 0.18], side: V3 = [-Math.sin(a), Math.cos(a), 0];
      const mid: V3 = [c[0] + Math.cos(a) * rc, c[1] + Math.sin(a) * rc, zc];
      const dw = r * 0.13, dh = H * 0.3;
      const ring: V3[] = [add(mid, [0, 0, dh]), add(mid, scale(side, dw)), add(mid, [0, 0, -dh]), add(mid, scale(side, -dw))].map((p) => add(p, scale(out, r * 0.035)));
      const tip = add(mid, scale(out, r * 0.085));
      const inner = ring.map((p) => add(scale(sub(p, mid), 0.5), add(mid, scale(out, r * 0.075))));
      const dv: V3[] = [...ring, ...inner, tip], df: Face[] = [], dwnt: V3[] = [];
      for (let j = 0; j < 4; j++) {
        const j1 = (j + 1) % 4;
        df.push({ i: [j, j1, 4 + j1, 4 + j], m: 'ember' });
        dwnt.push(unit(add(out, scale(unit(sub(scale(add(ring[j], ring[j1]), 0.5), mid)), 0.8))));
        df.push({ i: [4 + j, 4 + j1, 8], m: 'flame' });
        dwnt.push(unit(add(out, scale(unit(sub(scale(add(ring[j], ring[j1]), 0.5), mid)), 0.3))));
      }
      parts.push(mesh(dv, wound(dv, df, dwnt)));
    }
  }
  return merge(...parts);
}

/**
 * The mortar in the bowl: a round surface just under the rim, cream, with two arms of a darker swirl going round out from its
 * middle, built into it (not painted on, so the rim in front of it covers it); turned as it is stirred.
 */
function mortarMesh(s: Pest, G: Geo, N: number): Mesh {
  const R = 8, c: V3 = [G.c[0], G.c[1], G.zs];
  const v: V3[] = [add(c, [0, 0, s.bowl.h * 0.04])];
  for (let q = 1; q <= R; q++) {
    const rho = (q / R) * G.rs;
    for (let j = 0; j < N; j++) {
      const a = (j / N) * TAU;
      v.push([c[0] + Math.cos(a) * rho, c[1] + Math.sin(a) * rho, c[2] + s.bowl.h * 0.04 * (1 - (q / R) ** 2)]);
    }
  }
  const arm = (q: number, j: number): Mat => {
    const rho = (q - 0.5) / R, a = (j + 0.5) / N;
    const ph = frac(a * 2 + rho * 1.1);
    if (q === 1) return 'flame';
    return ph < 0.17 ? 'bill' : ph > 0.5 && ph < 0.6 && q < R ? 'flame' : 'water';
  };
  const f: Face[] = [];
  for (let j = 0; j < N; j++) f.push({ i: [0, 1 + j, 1 + ((j + 1) % N)], m: arm(1, j) });
  for (let q = 1; q < R; q++) {
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N, a = 1 + (q - 1) * N, b = 1 + q * N;
      f.push({ i: [a + j, b + j, b + j1, a + j1], m: arm(q + 1, j) });
    }
  }
  return mesh(v, wound(v, f, f.map(() => [0, 0, 1] as V3)));
}

/* ---- the tail ------------------------------------------------------------------------- */

/** A point along a line through `P` (Catmull-Rom), `u` from nought at the first to one at the last. */
function spline(P: readonly V3[], u: number): V3 {
  const n = P.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  const o: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) o[k] = 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * f3);
  return o;
}
/** The tail's frame at `u`: where its middle is, the way along it, its side (toward its right) and its up. */
interface Frame { c: V3; t: V3; s: V3; u: V3 }
function frameAt(P: readonly V3[], u: number): Frame {
  const e = 0.01, c = spline(P, u);
  const t = unit(sub(spline(P, Math.min(1, u + e)), spline(P, Math.max(0, u - e))));
  const sd = unit(sub([1, 0, 0], scale(t, t[0])));
  return { c, t, s: sd, u: cross(sd, t) };
}
const atFrame = (F: Frame, o: V3): V3 => add(F.c, add(add(scale(F.t, o[0]), scale(F.s, o[1])), scale(F.u, o[2])));

/** How thick the tail is at `u`. */
const tailR = (s: Pest, u: number): number => lerp(s.arch.r[0], s.arch.r[1], u ** 0.8) * (1 - 0.08 * Math.sin(Math.PI * u));

/**
 * The tail as built standing, in pieces each bound to a place along it: a core the scales go round, rows of scales round it each
 * lying toward the tip, the rows nearer the tip over the ones behind; a pointed tip, or a squared spout with a lip, mortar in its
 * mouth. Every corner's place along it and where it is from its middle there, so it can be moved with it.
 */
interface TailBuilt { mesh: Mesh; u: number[]; o: V3[] }
function tailBuilt(s: Pest, n: number): TailBuilt {
  const A = s.arch, P = A.pts;
  const meshes: Mesh[] = [], us: number[][] = [];
  const put = (m: Mesh, u: number | number[]): void => {
    meshes.push(m);
    us.push(typeof u === 'number' ? m.v.map(() => u) : u);
  };
  // Its length, for the size of a row of scales.
  let L = 0;
  for (let q = 0; q < 40; q++) L += Math.hypot(...sub(spline(P, (q + 1) / 40), spline(P, q / 40)));
  // The core: rings along it.
  const RU = Array.from({ length: 15 }, (_, q) => q / 14);
  const core = tube(RU.map((u) => spline(P, u)), RU.map((u) => tailR(s, u) * 0.82), RU.map((u) => tailR(s, u) * 0.82), n, 'coatDark', { seam: 'start' });
  put(core, RU.flatMap((u) => Array(n).fill(u)));
  // The scales: rows round it from its root to its tip.
  const lav = LAVENDER[s.stage];
  for (let r = 0; r < A.rows; r++) {
    const u = 0.03 + (r / (A.rows - 1)) * 0.93;
    const F = frameAt(P, u), R = tailR(s, u);
    const per = Math.max(4, Math.round(A.per * (1 - 0.35 * u)));
    for (let j = 0; j < per; j++) {
      const id = 2000 + r * 17 + j;
      const ph = ((j + (r % 2 ? 0.5 : 0)) / per) * TAU + 0.2;
      const out = unit(add(scale(F.s, Math.cos(ph)), scale(F.u, Math.sin(ph))));
      // The scales at its sides stand out more on the Mortarium: its spikes.
      const sideK = s.spikes ? Math.abs(Math.cos(ph)) ** 4 * s.spikes * 0.6 : 0;
      const a = (L / A.rows) * 1.45 * (1 + 0.5 * sideK), b = ((Math.PI * R) / per) * 1.3;
      const [m, edge] = scaleTone(id, lav, 0.55 + 0.3 * Math.sin(ph));
      put(scaleMesh({ root: add(F.c, scale(out, R * 0.78)), n: out, back: F.t, a, b, t: a * 0.06, lift: a * (0.12 + 0.5 * sideK), m, edge, point: 0.4 + 0.35 * sideK, id }), u);
    }
  }
  if (A.spout) {
    // The spout: a squared block on the end, a lip round its mouth, the mortar in it.
    const F = frameAt(P, 1), w = tailR(s, 1) * 1.35, Ls = A.spout;
    const zs = [-Ls * 0.35, Ls * 0.1, Ls * 0.55, Ls * 0.62, Ls * 0.8, Ls];
    const ws = [w * 0.85, w * 1.0, w * 1.04, w * 1.16, w * 1.18, w * 1.12];
    const pts = zs.map((z) => atFrame(F, [z, 0, 0]));
    const spout = tube(pts, ws, ws, 4, (ring) => (ring >= 5 ? 'water' : ring >= 3 ? 'coatLight' : ring === 2 ? 'featherDark' : 'coat'), { up: F.u });
    put(spout, 1);
  }
  const u: number[] = [], o: V3[] = [];
  const all = merge(...meshes);
  us.forEach((list) => u.push(...list));
  // Each corner from its middle at its place along it, in that place's frame.
  const frames = new Map<number, Frame>();
  all.v.forEach((p, i) => {
    let F = frames.get(u[i]);
    if (!F) { F = frameAt(P, u[i]); frames.set(u[i], F); }
    const d = sub(p, F.c);
    o.push([dot(d, F.t), dot(d, F.s), dot(d, F.u)]);
  });
  return { mesh: all, u, o };
}

/* ---- its work, in time ---------------------------------------------------------------- */

/**
 * A go at its task, as shares of it: its tail's tip, pouring over the bowl, comes down into it by `down`, goes once round the
 * bowl stirring until `up`, a little mortar slopping over the rim at `slop`, and lifts out pouring again by the end, ready for
 * the next go.
 */
export const PESTLET_WORK = { down: 0.16, up: 0.84, slop: [0.42, 0.62] as readonly number[] } as const;
/** How far down in the bowl the tip is through a go. */
const dipOf = (t: number): number => ramp(t, 0.03, PESTLET_WORK.down) * (1 - ramp(t, PESTLET_WORK.up, 0.97));
/** How far round the bowl the tip has gone through a go. */
const stirOf = (t: number): number => TAU * smooth((t - 0.1) / 0.8) + 0.6;
/** How much is pouring from its spout: while the tip is up. */
const flowOf = (t: number): number => 1 - ramp(t, 0.06, 0.15) + ramp(t, 0.86, 0.95);

/**
 * The tail's line this moment: its standing line, swayed about its root as it stands and walks; at its task the end brought over
 * the bowl and down into it and round; lifted as it strikes.
 */
function tailPose(s: Pest, G: Geo, a: Anim): V3[] {
  const P = s.arch.pts.map((p) => [...p] as V3), n = P.length - 1, root = P[0];
  let yaw = 3.5 * cyc(a.t, 2) + 1.5 * cyc(a.t, 5, 1), pitch = 2 * cyc(a.t, 3, 0.5);
  if (a.go > 0) {
    const g = smooth(a.go), w = frac(a.u);
    yaw = lerp(yaw, 7 * Math.sin(w * TAU), g);
    pitch = lerp(pitch, 3 * Math.sin(w * TAU * 2) - 3, g);
  }
  const act = a.act;
  if (act?.kind === 'strike') pitch -= 10 * hump(act.t, 0.45, 0.4);
  if (act?.kind === 'evolve') pitch -= 8 * hump(act.t, 0.55, 0.15) * Math.sin(act.t * 60);
  const cy = Math.cos(yaw * DEG), sy = Math.sin(yaw * DEG), cp = Math.cos(pitch * DEG), sp = Math.sin(pitch * DEG);
  for (let k = 1; k <= n; k++) {
    const w = k / n, d = sub(P[k], root);
    const yw = lerp(1, cy, w), ys = sy * w, pc = lerp(1, cp, w), ps = sp * w;
    // Turned about the up through its root, then pitched about its side.
    let x = d[0] * yw - d[1] * ys, y = d[0] * ys + d[1] * yw, z = d[2];
    [y, z] = [y * pc - z * ps, y * ps + z * pc];
    P[k] = add(root, [x, y, z]);
  }
  const work = act?.kind === 'work' ? 1 : 0;
  if (work) {
    const t = act!.t, dip = dipOf(t), th = stirOf(t);
    const rho = G.rs * 0.45 * dip;
    const spout = s.arch.spout;
    const mouthUp = s.bowl.h * 2.2 + spout;
    // Over the bowl, and then down into it and round.
    const over: V3 = [G.c[0], G.c[1] - G.rs * 0.1, G.zr + mouthUp];
    const inBowl: V3 = [G.c[0] + Math.cos(th) * rho, G.c[1] + Math.sin(th) * rho, G.zs + tailR(s, 1) * 0.9 + spout * 0.2];
    const end = mixV3(over, inBowl, dip);
    // The arch let down as the tip goes in, so it bends lower rather than stretching.
    for (let k = 1; k < n; k++) P[k][2] = root[2] + (P[k][2] - root[2]) * (1 - 0.28 * dip);
    P[n] = mixV3(P[n], end, s.stage === 0 ? 1 : 0.9 + 0.1 * dip);
    if (s.stage === 0) P[n - 2] = add(P[n - 2], [0, 0.18, 0.12]);
    const above: V3 = add(mixV3(P[n - 2], end, 0.5), [0, 0, s.bowl.h * (1.1 - 0.3 * dip) + spout * 0.6]);
    P[n - 1] = mixV3(P[n - 1], above, s.stage === 0 ? 0.9 : 0.9 * dip);
  }
  return P;
}
const mixV3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** How much pours from it this moment: standing, a Churnscale's and a Mortarium's always, none going; at its task while its tip is up. */
function flowNow(s: Pest, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'work') return flowOf(act.t);
  if (act) return 0;
  return s.arch.pours ? 1 - smooth(a.go) : 0;
}

/** How far the mortar has turned this moment: slowly under a pour, once round with the tip at its task. */
function turnNow(s: Pest, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'work') return stirOf(act.t) * 0.8;
  return s.arch.pours ? (a.t / 24) * TAU * 2 : 0;
}

/* ---- its back, as one piece ------------------------------------------------------------- */

/** The stream: a tube from the spout's mouth down to the mortar, built straight and moved into place every frame. */
const STREAM_RINGS = 7;
const STREAM_SIDES = 6;
function streamMesh(G: Geo): Mesh {
  // Built where it lands, the size of nothing: what is measured of it standing (`extentOf`) is in the bowl.
  const pts = Array.from({ length: STREAM_RINGS }, (_, q) => [G.c[0], G.c[1], G.zs + q * 0.001] as V3);
  return tube(pts, 0.001, 0.001, STREAM_SIDES, 'water', { up: [0, 1, 0] });
}

/**
 * Its back as one piece: the bowl, the mortar, the tail and the stream, every facet of them put in order with the others; the
 * tail's corners moved with its line, the mortar turned, the stream run from the spout down to the mortar.
 */
function backPiece(s: Pest, G: Geo, lod: number, hide: Array<{ c: V3; r: V3 }>): Piece {
  const N = cut(lod, 18, 26);
  const bowl = bowlMesh(s, G, N);
  const mortar = mortarMesh(s, G, cut(lod, 28, 40));
  const T = tailBuilt(s, cut(lod, 6, 8));
  const stream = streamMesh(G);
  const m = merge(bowl, mortar, T.mesh, stream);
  const nb = bowl.v.length, nm = mortar.v.length, nt = T.mesh.v.length;
  const c = G.c;
  const bent = (v: readonly V3[], a: Anim): V3[] => {
    const out = v.slice() as V3[];
    // The mortar, turned about the bowl's middle.
    const turn = turnNow(s, a), ct = Math.cos(turn), st = Math.sin(turn);
    for (let i = nb; i < nb + nm; i++) {
      const p = v[i], dx = p[0] - c[0], dy = p[1] - c[1];
      out[i] = [c[0] + dx * ct - dy * st, c[1] + dx * st + dy * ct, p[2]];
    }
    // The tail, on its line this moment.
    const P = tailPose(s, G, a);
    const frames = new Map<number, Frame>();
    for (let q = 0; q < nt; q++) {
      const u = T.u[q];
      let F = frames.get(u);
      if (!F) { F = frameAt(P, u); frames.set(u, F); }
      out[nb + nm + q] = atFrame(F, T.o[q]);
    }
    // The stream, from the spout's mouth down to the mortar under it, thinning, wavering; nothing while nothing pours.
    const flow = flowNow(s, a);
    const end = frameAt(P, 1);
    const mouth = atFrame(end, [s.arch.spout * 0.98 + tailR(s, 1) * (s.arch.spout ? 0 : 0.6), 0, 0]);
    const jet: V3 = [end.t[0], end.t[1], 0];
    const bottomZ = G.zs + s.bowl.h * 0.03;
    const drop = Math.max(0.01, mouth[2] - bottomZ);
    const base = nb + nm + nt;
    for (let k = 0; k < STREAM_RINGS; k++) {
      const u = k / (STREAM_RINGS - 1);
      const along: V3 = add(add(mouth, scale(jet, drop * 0.25 * Math.sin(Math.PI * u * 0.5))), [0, 0, -drop * u]);
      const wob = 1 + 0.12 * cyc(a.t, 40, u * 9) * u;
      const r = s.stream * flow * lerp(1, 0.62, u) * wob * (k === STREAM_RINGS - 1 ? 1.6 : 1);
      for (let j = 0; j < STREAM_SIDES; j++) {
        const th = ((j + 0.5) / STREAM_SIDES) * TAU;
        out[base + k * STREAM_SIDES + j] = [along[0] + Math.cos(th) * r, along[1] + Math.sin(th) * r, along[2] + (k === STREAM_RINGS - 1 ? r * 0.3 : 0)];
      }
    }
    return out;
  };
  return { key: 'back', mesh: m, bone: 'trunk', bias: 0.12, after: ['body', 'armor'], hide, bent };
}

/* ---- the head --------------------------------------------------------------------------- */

/**
 * The head, as rings from the back of the skull to the end of the snout: cream all over its face, a cap of orange over the back
 * of its crown, paler orange down the bridge of its snout, its underside paler again; a small dark nose on the end and a mouth
 * line back along the snout; dark eyes with a light in each.
 */
function headOf(s: Pest, n: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0];
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU), f = (H.y[Math.min(ring, last)] - H.y[0]) / len;
    if (up > 0.5 && f < 0.36) return 'coat';
    if (up > 0.82 && f < 0.72) return 'mark';
    if (up < -0.55) return 'belly';
    return 'muzzle';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.2, H.z[last] - H.h[last] * 0.05];
  const nose = orbAlong(tipC, [0, 1, 0.1], [s.nose * 1.15, s.nose * 0.9, s.nose * 0.85], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.86, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.38, 0.004, -s.nose * 0.05]), [0, 1, 0.1], s.nose * 0.15, s.nose * 0.22, 6, 'pad')));
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils];
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], H.y[last] - len * 0.3, f);
      const at = onRings(H, y, -0.55 + 0.25 * f ** 2);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.022, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Scales over the back of its head, in rows from behind the ears forward to above the eyes, each lying back. */
function crownOf(s: Pest): Mesh | null {
  const C = s.crown, H = s.head;
  if (!C.rows) return null;
  const out: Mesh[] = [];
  const last = H.y.length - 1, len = H.y[last] - H.y[0];
  for (let r = 0; r < C.rows; r++) {
    const per = C.per - (r % 2);
    const y = H.y[0] + len * (0.12 + 0.14 * (C.rows - 1 - r));
    for (let q = 0; q < per; q++) {
      const id = 3000 + r * 11 + q;
      const g = per > 1 ? q / (per - 1) - 0.5 : 0;
      const at = onRings(H, y, Math.PI / 2 + g * 1.1);
      out.push(scaleMesh({ root: add(at.p, scale(at.n, -C.a * 0.1)), n: at.n, back: unit([g * 0.6, -1, -0.15]), a: C.a * (1 - 0.15 * r), b: C.a * 0.75, t: C.a * 0.06, lift: C.a * 0.28, m: jitter(id) < 0.3 ? 'feather' : 'coat', edge: 'featherDark', point: 0.5, id }));
    }
  }
  return merge(...out);
}

/** An ear: big and round, a thick cup, cream with a paler rim and warm orange inside. */
function earOf(s: Pest, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  return merge(
    tube(curve([0, 0, -0.03], [0, 0.03, L * 0.5], [0, -0.02, L], 4), [w * 0.7, w * 0.98, w * 1.02, w * 0.82, w * 0.3], w * 0.34, n, (ring) => (ring >= 3 ? 'mark' : 'muzzle'), { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.34, L * 0.48], [0, 1, 0.08], w * 0.62, L * 0.34, 9, 'inner')]),
  );
}

/* ---- the work and its bones ------------------------------------------------------------- */

/** Its pose at its task: its feet where they stand, its body leaning a little after its tail as it goes round, its head low. */
function workPlan(s0: Badger, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const plan = stillPlan(R, p);
  void s0; void spec; void down;
  const dip = dipOf(t), th = stirOf(t);
  plan.roll += 3 * Math.cos(th) * dip;
  plan.rock = 1.5 * Math.sin(th) * dip;
  p.neck[0] += 8;
  p.head[0] -= 6 - 3 * Math.sin(th * 2) * dip;
  p.neck[1] += 5 * Math.cos(th) * dip;
  for (const e of p.ears) e[0] += 8 * dip;
  void a;
  return plan;
}

/* ---- what it throws about --------------------------------------------------------------- */

/** The colours of the bits about it: orange, rust, lavender, cream mortar. */
const BIT_RGB: readonly RGB[] = [[226, 124, 56], [170, 70, 44], [176, 150, 200], [248, 236, 206]];
const MORTAR_RGB: RGB = [248, 236, 206];
const MORTAR_INK: RGB = [150, 124, 90];

/** A blob of mortar: a round drop, lit on top, inked round. */
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, stretch = 1): void {
  if (r <= 0.004) return;
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fillStyle = css(MORTAR_RGB);
  g.fill();
  g.lineWidth = r * 0.28;
  g.strokeStyle = css(MORTAR_INK);
  g.stroke();
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.35 * stretch, r * 0.3, r * 0.22, 0, 0, TAU);
  g.fillStyle = 'rgb(255,253,246)';
  g.fill();
}

/** A chip of scale turning in the air: a pointed shape, a darker edge. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB): void {
  if (len <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(-len * 0.1, -len * 0.42, len / 2, 0);
  g.quadraticCurveTo(-len * 0.1, len * 0.42, -len / 2, 0);
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = len * 0.08;
  g.strokeStyle = css(mix(c, [50, 24, 20], 0.55));
  g.stroke();
  g.restore();
}

/** How big a stage's bits are drawn, against the Churnscale's: more than in proportion on the small one, so they still read. */
const bigness = (s: Pest): number => 0.3 + 0.7 * (s.len / 2.0);

/**
 * Its work: as the tip goes round, mortar heaved up over the rim ahead of it and sliding back down the outside, gone before it is
 * off the bowl; drops off the tip as it lifts out.
 */
function workBits(g: CanvasRenderingContext2D, view: View, s: Pest, G: Geo, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  PESTLET_WORK.slop.forEach((c0, k) => {
    const since = (t - c0) * ACT_SECS.work;
    if (since < 0 || since > 0.42) return;
    const th = stirOf(c0) + 0.5;
    for (let q = 0; q < 3; q++) {
      const id = k * 11 + q * 3;
      const a2 = th + (q - 1) * 0.16;
      const rim: V3 = [G.c[0] + Math.cos(a2) * s.bowl.r * 0.97, G.c[1] + Math.sin(a2) * s.bowl.r * 0.97, G.zr];
      // Up over the rim, out a little, and down the outer wall.
      const out = Math.min(1, since / 0.12);
      const fall = Math.max(0, since - 0.1);
      const p: V3 = [rim[0] + Math.cos(a2) * s.bowl.r * 0.06 * out, rim[1] + Math.sin(a2) * s.bowl.r * 0.06 * out, rim[2] + s.bowl.h * (0.35 * Math.sin(Math.PI * Math.min(1, since / 0.16)) - 1.6 * fall * fall * (1 + jitter(id)))];
      const w = place(b.trunk, p);
      if (nearSide(w, mid, view) !== front) continue;
      const [x, y] = onScreen(view, w);
      const gone = 1 - ramp(since, 0.25, 0.42);
      blob(g, x, y, (0.13 + 0.05 * jitter(id + 1)) * big * gone, 1 + 0.6 * ramp(since, 0.1, 0.3));
    }
  });
  // Drops off the tip as it lifts out of the bowl, falling back in.
  if (t > PESTLET_WORK.up - 0.02 && t < 0.99) {
    const since = (t - (PESTLET_WORK.up - 0.02)) * ACT_SECS.work;
    for (let q = 0; q < 2; q++) {
      const sq = since - q * 0.06;
      if (sq < 0) continue;
      const th = stirOf(PESTLET_WORK.up);
      const from: V3 = [G.c[0] + Math.cos(th) * G.rs * 0.3, G.c[1] + Math.sin(th) * G.rs * 0.3, G.zs + s.bowl.h * (1.2 + 1.6 * ramp(t, PESTLET_WORK.up, 0.95))];
      const z = from[2] - 9 * big * sq * sq;
      if (z < G.zs) continue;
      const w = place(b.trunk, [from[0], from[1], z]);
      if (nearSide(w, mid, view) !== front) continue;
      const [x, y] = onScreen(view, w);
      blob(g, x, y, 0.045 * big, 1.4);
    }
  }
}

/** Evolving: a burst of chips of scale as it begins, then a swirl of them and of drops of mortar going round and up it. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Pest, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 24; q++) {
      const th = (q / 24) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.4, s.body.y[3] + Math.sin(th) * s.len * 0.3, s.body.h[3] * 0.9]);
      const v: V3 = [Math.cos(th) * (2 + 2 * jitter(q + 3)), Math.sin(th) * (2 + 2 * jitter(q + 5)), 3 + 3 * jitter(q + 7)];
      const p = thrown(from, scale(v, big), since, 7 * big);
      if (p[2] < 0.3 * big) continue;
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      chip(g, x, y, 0.42 * big * burst, q * 1.3 + since * 8, BIT_RGB[q % BIT_RGB.length]);
    }
  }
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.66, 0.86));
  if (swirl > 0) {
    const rx = s.body.w[3] * 1.35 + 0.3 * big, ry = s.len * 0.75 + 0.3 * big, top = s.body.h[3] * 2 + big;
    for (let q = 0; q < 18; q++) {
      const rise = frac(t * 1.6 + jitter(q + 20));
      const ang = (q / 18) * TAU + t * 9;
      const p = place(b.trunk, [Math.cos(ang) * rx, Math.sin(ang) * ry, -s.body.h[3] * 0.3 + rise * top]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const k = swirl * Math.sin(rise * Math.PI);
      if (q % 3 === 0) blob(g, x, y, 0.06 * big * k);
      else chip(g, x, y, 0.36 * big * k, ang * 2 + q, BIT_RGB[q % BIT_RGB.length]);
    }
  }
}

/** Light over it as it evolves: a warm glow as it begins, and over its bowl at the turn. */
function pestGlow(s: Pest, G: Geo, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [250, 206, 140], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [G.c[0], G.c[1], G.zr]), r: s.len * 0.9 + 0.5, c: [255, 232, 170], a: k });
  return out;
}

/* ---- its pieces -------------------------------------------------------------------------- */

/** A mesh in other colours. */
const recolour = (m: Mesh, f: (mat: Mat, fi: number) => Mat): Mesh => ({ ...m, f: m.f.map((face, fi) => ({ ...face, m: f(face.m, fi) })) });

/** Scales down the outside and front of a lower leg, in two rows, each lying down toward the paw. */
function legScales(s: Pest, key: string): Mesh {
  const fore = key[0] === 'f', side = key[1] === 'l' ? -1 : 1;
  const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
  const out: Mesh[] = [];
  for (let r = 0; r < 2; r++) {
    const z = -L[1] * (0.05 + 0.42 * r);
    for (let q = 0; q < 5; q++) {
      const id = 5000 + r * 13 + q + (fore ? 0 : 100) + (side > 0 ? 0 : 50);
      // Round the outside and the front of it, from behind the outside to the inside of the front.
      const a = (-0.35 + q * 0.42 + (r % 2) * 0.2) * Math.PI;
      const n: V3 = [side * Math.cos(a), Math.sin(a), 0];
      const rr = w * (0.56 - 0.04 * r);
      const [m, edge] = scaleTone(id, 0.04, 0.55);
      out.push(scaleMesh({ root: [n[0] * rr * 0.86, n[1] * rr * 0.86, z], n, back: [0, 0, -1], a: L[1] * 0.42, b: w * 0.42, t: w * 0.03, lift: w * 0.1, m, edge, point: 0.4, id }));
    }
  }
  return merge(...out);
}

/** A stage's pieces: the badger's body and legs under its own scales, head, ears, bowl and tail. */
function pestBuild(s: Pest, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), nh = cut(lod, 10, 16);
  const B = s.body, skull = headSolids(s)[0];
  const G = geoOf(s);
  const R = domed(B);
  const nb = cut(lod, 10, 14);
  // Under the scales, its skin dark where it shows between them; its belly cream.
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb, (ring, j) => {
    const up = Math.sin(((j + 1) / nb) * TAU);
    return ring > 0 && ring < R.y.length - 1 && up < -0.45 ? 'belly' : 'coatDark';
  });
  const solid = barrelSolid(s);
  const armor = merge(...bodyScales(s, G), ...chunksOf(s, G), ...shieldsOf(s));
  const extras: Piece[] = [
    { key: 'armor', mesh: armor, bone: 'trunk', bias: 0.08, after: ['body'], hide: [solid] },
    backPiece(s, G, lod, [solid]),
  ];
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -30,
    tail: [],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: orbAlong([0, 0, 0], [0, 1, 0], [0.01, 0.01, 0.01], 3, 3, 'coat') },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: orbAlong([0, 0, 0], [0, 1, 0], [0.01, 0.01, 0.01], 3, 3, 'coat') },
    breath: 0.03,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  // Its legs scaled in a checker of orange and rust, its feet cream, its claws pale; the near ones over its scales.
  for (const pc of legPieces(s, n, k)) {
    const foot = /2$/.test(pc.key);
    const m = recolour(pc.mesh, (mat) => (foot && mat === 'coatDark' ? 'muzzle' : mat));
    const shin = /1$/.test(pc.key);
    pieces.push({ ...pc, mesh: shin ? merge(m, legScales(s, pc.key)) : m, after: pc.after === 'body' ? ['body', 'armor'] : pc.after });
  }
  const crown = crownOf(s);
  if (crown) pieces.push({ key: 'crown', mesh: crown, bone: 'head', bias: 0.205, after: ['head'], hide: headSolids(s).slice(0, 1) });
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, nh, false), shut: headOf(s, nh, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: barrel };
    // The neck: scaled orange over the top, cream under.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nhh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nhh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.2 ? 'coat' : 'muzzle'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function pestKind(s: Pest): Kind {
  const bones = badgerBones(s, workPlan, ['strike', 'evolve', 'work']);
  const R = restOf(s, specOf(s));
  const G = geoOf(s);
  const atHits = (a: Anim): Bones[] => BADGER_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  return {
    bones,
    build: (lod) => pestBuild(s, lod),
    // The variant's coat for its scales and its markings for its face; lavender scales, stone, mortar and pale claws on every one.
    palette: (coat, mark) => {
      const orange = mix(coat, [214, 108, 44], 0.5), rust = mix(orange, [150, 56, 34], 0.62), sand = mix(orange, [236, 172, 96], 0.55);
      const cream = mix(mark, [250, 232, 176], 0.55);
      return coatPalette(coat, mark, {
        coat: orange,
        coatDark: mix(orange, [116, 52, 36], 0.5),
        coatLight: sand,
        feather: rust,
        featherDark: mix(rust, [66, 28, 24], 0.55),
        bark: mix(sand, [150, 92, 56], 0.55),
        petal: [178, 152, 200],
        cap: [118, 94, 146],
        mark: mix(cream, orange, 0.4),
        muzzle: cream,
        belly: mix(cream, [232, 210, 166], 0.45),
        inner: mix(orange, [236, 156, 112], 0.35),
        lid: [56, 32, 24],
        nose: [72, 46, 42],
        pad: [40, 26, 24],
        eye: [24, 14, 12],
        bloom: [64, 36, 24],
        glint: [255, 253, 246],
        claw: [246, 236, 210],
        hornDark: [200, 182, 150],
        stone: [164, 154, 142],
        horn: [138, 132, 136],
        stoneDark: [104, 96, 96],
        crystal: [214, 206, 190],
        crystalDark: [158, 148, 178],
        shell: [216, 196, 164],
        shellDark: [146, 122, 96],
        water: [248, 232, 190],
        bill: [222, 190, 128],
        flame: [255, 248, 222],
        ember: [232, 136, 52],
      }, 30);
    },
    shadow: [s.len * 0.85 + 0.25, s.body.w[4] * 1.05],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are its scales' orange and the mortar's cream.
    motes: [[230, 132, 60], [250, 238, 206]],
    glow: (b, a) => pestGlow(s, G, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      } else if (act.kind === 'work') workBits(g, view, s, G, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PESTLET = pestKind(PESTLET_LOOK);
export const CHURNSCALE = pestKind(CHURNSCALE_LOOK);
export const MORTARIUM = pestKind(MORTARIUM_LOOK);
