import { METAL_TONE } from './materials';
import { animationsOff } from '../engine/motion';
import type { GearLook, GearPiece, GearSlot } from '../contract/gear';
import type { SculptFx } from './fx/types';
import { EMOTE_BY_ID, HOPS, SIX_SEVEN_SWAP, emotePose } from '../game/emotes';
import { BLOCK, BLOCK_IMPACT, COVER } from '../sculpt/anim/clips/block';
import { FLINCH_SNAP } from '../sculpt/anim/clips/flinch';
import { FLINCH_SECS } from '../game/fight';
import { sampleKey } from '../sculpt/anim/clip';
import {
  BUILDS, DEFAULT_LOOK, eyeColour, hairColour, shirtColour, skinColour, trouserColour, type Look,
} from '../game/look';
import { HALF_H, HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { rarityOf } from '../game/items';
import { BASE_SPEED, CADENCE } from '../game/player';

/**
 * People: posed, and put on the screen.
 *
 * A body is posed on a rig of nineteen bones -- pelvis, spine, chest, neck,
 * head, and a shoulder, elbow, wrist, hip, knee and ankle each side -- every
 * frame, walking, working, swimming, sat driving, waving (`rigOf`, `settle`),
 * and drawn as the sculpted body on that pose (`../sculpt`, `drawFigure`),
 * kept between frames as pictures (`drawStill`). What it holds and sits in --
 * reins, oars, a tiller -- and the rings on the water round a swimmer are
 * drawn here round it.
 *
 * And what the wildermon and the rest are drawn with: faceted meshes on
 * bones (`mesh`, `place`, `render`), every facet a flat colour in the light
 * from over the viewer's left shoulder, the whole inked round its outside in
 * a dark shade of each thing's own colour.
 *
 * Units are tenths of a metre, as everywhere else that stands on the ground:
 * `x` to the body's right, `y` the way it faces, `z` up, from the ground
 * between its feet.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type V3 = [number, number, number];
export type RGB = [number, number, number];
export type Pt = [number, number];

/* ---- colour ---------------------------------------------------------------- */

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as RGB;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, k = 1, a = 1): string =>
  `rgba(${Math.max(0, Math.min(255, Math.round(c[0] * k)))}, ${Math.max(0, Math.min(255, Math.round(c[1] * k)))}, ${Math.max(0, Math.min(255, Math.round(c[2] * k)))}, ${a})`;
const INK: RGB = [40, 28, 26];

/* ---- turns ------------------------------------------------------------------ */

type M3 = number[];
const mm = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const mv = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** Pitch about x: a limb hanging down swings forward. */
const rx = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
/** Roll about y: a limb hanging down swings to the left. */
const ry = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
/** Yaw about z: the front turns to the left. */
const rz = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

/** A bone's frame: its turn, and where its joint is. */
export interface Xf { m: M3; t: V3 }
export const ROOT: Xf = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
/** A joint `at` in its parent's frame, turned by pitch, then roll, then yaw, in degrees. */
export function joint(p: Xf, at: V3, pitch = 0, roll = 0, yaw = 0): Xf {
  const r = mm(rz(yaw * DEG), mm(ry(roll * DEG), rx(pitch * DEG)));
  const o = mv(p.m, at);
  return { m: mm(p.m, r), t: [o[0] + p.t[0], o[1] + p.t[1], o[2] + p.t[2]] };
}
export const place = (x: Xf, v: V3): V3 => {
  const m = x.m, t = x.t;
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + t[0], m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + t[1], m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + t[2]];
};
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/* ---- meshes ----------------------------------------------------------------- */

/** What a facet is made of, looked up per body when it is drawn. */
type BodyMat = 'skin' | 'lip' | 'hair' | 'brow' | 'edge' | 'eye' | 'white' | 'glint' | 'tunic' | 'trim' | 'trousers' | 'boot' | 'cuff' | 'sole' | 'belt' | 'buckle' | 'stubble' | 'shaved' | 'rein' | 'haft' | 'iron';
/**
 * And what a piece of gear is made of, looked up in the piece's own palette
 * (`gearPalette` in `./gear`): the same names on every piece, each piece its
 * own metal, wood, leather and dye.
 */
export type GearMat = 'metal' | 'metalDark' | 'metalLit' | 'mail' | 'scale' | 'scaleDark' | 'leather' | 'leatherDark' | 'leatherLit' | 'lace'
  | 'cloth' | 'clothDark' | 'lining' | 'wood' | 'woodDark' | 'grip' | 'blade' | 'fitting' | 'gem' | 'string' | 'fletch' | 'rivet'
  // A circlet's three settings, each its stone or, while it is empty, its gold.
  | 'stone1' | 'stone2' | 'stone3';
/**
 * And what a wildermon is made of (`./beasts`), looked up in its own
 * palette: its coat and its markings, the colours of its variant, and the
 * things of its kind -- a horn, a hoof, a leaf growing out of its back.
 */
export type BeastMat = 'coat' | 'coatDark' | 'coatLight' | 'mark' | 'belly' | 'muzzle' | 'nose' | 'inner' | 'eyeWhite' | 'lid'
  | 'claw' | 'pad' | 'horn' | 'hornDark' | 'membrane' | 'hoof' | 'tooth' | 'tongue' | 'leaf' | 'leafDark' | 'stem' | 'petal' | 'bloom' | 'moss' | 'bark'
  | 'stone' | 'stoneDark' | 'crystal' | 'crystalDark' | 'ember' | 'flame' | 'shell' | 'shellDark' | 'feather' | 'featherDark'
  | 'bill' | 'billDark' | 'water' | 'cap' | 'spot';
export type Mat = BodyMat | GearMat | BeastMat;
/**
 * Worked into a facet's surface, in its own shade, where it is drawn big
 * enough to read: the rows of a mail shirt, the courses of scale, the channels
 * of a quilted coat, the lames of plate, the grain of a board.
 */
export type Pattern = 'mail' | 'scale' | 'quilt' | 'lames' | 'grain' | 'studs';

export interface Face {
  /** Corners, anticlockwise seen from outside. */
  i: number[];
  m: Mat;
  /** Painted on the face under it rather than a surface of its own: no outline, and drawn after the rest of its part. */
  decal?: boolean;
  /** A decal lit as a glint is, whichever way it is turned to the light: the gold of a ring too small to have a lit side of its own. */
  lit?: boolean;
  /** Part of a surface rather than an edge of one: its open rim is not inked. A nose is not outlined where it meets the face. */
  soft?: boolean;
  /**
   * Where one piece of the body goes into another, and no edge of either: no
   * line along any edge of it, however it is turned. The top of a sleeve,
   * which is the shoulder of the tunic it is sewn into, turns out to the side
   * when the arm is swung up or back, and would otherwise be outlined on the
   * chest; and the ends of the cuff, with the forearm in it, turn to face
   * the viewer as the arm swings back, and would be a ring round the elbow.
   */
  seam?: boolean;
  /**
   * How wide the thing it is part of is, when that is narrow: inked only
   * where it is drawn at least twice as wide as the lines along it and four
   * pixels across. The fingers of an open hand, lined in lines as wide as
   * they are, are a mitten.
   */
  fine?: number;
  /**
   * In a fold, the back of a knee: lit as though turned down from level by
   * `CREASE_DOWN`, however it is turned, so it is in shadow. With the knee
   * bent, the calf behind it faces up into the light, and seen from behind
   * the back of the knee was the lightest thing on the leg where the crease
   * should be its darkest.
   */
  crease?: boolean;
  /** Only while this way, in the mesh's own frame, is not toward the viewer: an eye seen side on, drawn only when the face is not. */
  unless?: V3;
  /** The point, in the mesh's own frame, whose being out of sight behind a solid hides this facet: one for all a curl's facets, so it goes or stays whole. */
  at?: V3;
  /** Worked into its surface where it is drawn big enough: see `Pattern`. */
  pat?: Pattern;
}

export interface Mesh {
  v: V3[];
  f: Face[];
  /** Every edge between two surfaces, or on the rim of one: [a, b, face, other face or -1]. */
  e: Array<[number, number, number, number]>;
}

export function mesh(v: V3[], f: Face[]): Mesh {
  const at = new Map<string, [number, number, number, number]>();
  f.forEach((face, fi) => {
    if (face.decal) return;
    const n = face.i.length;
    for (let k = 0; k < n; k++) {
      const a = face.i[k], b = face.i[(k + 1) % n];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const had = at.get(key);
      if (had) had[3] = fi;
      else at.set(key, [a, b, fi, -1]);
    }
  });
  return { v, f, e: [...at.values()] };
}

/** Put two meshes together as one part. */
function join(...ms: Mesh[]): Mesh {
  const v: V3[] = [], f: Face[] = [];
  for (const m of ms) {
    const base = v.length;
    v.push(...m.v);
    for (const face of m.f) f.push({ ...face, i: face.i.map((i) => i + base) });
  }
  return mesh(v, f);
}

/**
 * Rings round the z axis, bottom to top, each `[z, rx, ry, cx, cy]`, `n`
 * round and starting half a step round from the right so that one flat
 * facet looks straight ahead. Closed at either end unless told otherwise;
 * `mat` may be a function of the band and the facet, for a sleeve or a sole.
 */
function rings(rs: number[][], n: number, mat: Mat | ((band: number, j: number) => Mat), caps: { top?: boolean; bottom?: boolean } = {}): Mesh {
  const v: V3[] = [];
  const f: Face[] = [];
  const m = (b: number, j: number): Mat => (typeof mat === 'function' ? mat(b, j) : mat);
  rs.forEach(([z, rxx, ryy, cx = 0, cy = 0]) => {
    for (let j = 0; j < n; j++) {
      const a = ((j + 0.5) / n) * TAU;
      v.push([cx + Math.cos(a) * rxx, cy + Math.sin(a) * ryy, z]);
    }
  });
  for (let k = 0; k < rs.length - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j], m: m(k, j) });
    }
  }
  if (caps.bottom !== false) f.push({ i: Array.from({ length: n }, (_, j) => n - 1 - j), m: m(-1, 0) });
  if (caps.top !== false) {
    const last = (rs.length - 1) * n;
    f.push({ i: Array.from({ length: n }, (_, j) => last + j), m: m(rs.length - 1, 0) });
  }
  return mesh(v, f);
}

/** A low-poly ball: `n` round and `k` bands from pole to pole. */
export function ball(c: V3, r: V3, n: number, k: number, mat: Mat): Mesh {
  const v: V3[] = [[c[0], c[1], c[2] - r[2]]];
  for (let b = 1; b < k; b++) {
    const t = (b / k) * Math.PI, z = -Math.cos(t), s = Math.sin(t);
    for (let j = 0; j < n; j++) {
      const a = ((j + (b % 2) * 0.5) / n) * TAU;
      v.push([c[0] + Math.cos(a) * s * r[0], c[1] + Math.sin(a) * s * r[1], c[2] + z * r[2]]);
    }
  }
  v.push([c[0], c[1], c[2] + r[2]]);
  const f: Face[] = [];
  const top = v.length - 1;
  for (let j = 0; j < n; j++) f.push({ i: [0, 1 + ((j + 1) % n), 1 + j], m: mat });
  for (let b = 0; b < k - 2; b++) {
    for (let j = 0; j < n; j++) {
      const a0 = 1 + b * n, a1 = 1 + (b + 1) * n, j2 = (j + 1) % n;
      // Every other band is turned half a step, so its quads are split into triangles that meet the band either side.
      if (b % 2 === 0) {
        f.push({ i: [a0 + j, a0 + j2, a1 + j], m: mat });
        f.push({ i: [a0 + j2, a1 + j2, a1 + j], m: mat });
      } else {
        f.push({ i: [a0 + j, a0 + j2, a1 + j2], m: mat });
        f.push({ i: [a0 + j, a1 + j2, a1 + j], m: mat });
      }
    }
  }
  const last = 1 + (k - 2) * n;
  for (let j = 0; j < n; j++) f.push({ i: [last + j, last + ((j + 1) % n), top], m: mat });
  return mesh(v, f);
}

/**
 * A tapering chain along a line of points: a ponytail, a braid, a lock, the
 * point of a beard. `rs` is the radius at each point, `n` how many sides.
 */
function chain(pts: V3[], rs: number[], n: number, mat: Mat, ends = true): Mesh {
  const v: V3[] = [];
  const f: Face[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    d = [d[0] / l, d[1] / l, d[2] / l];
    // Two directions square to the chain: one across it, one from it and that.
    let u: V3 = Math.abs(d[0]) < 0.9 ? [0, d[2], -d[1]] : [-d[2], 0, d[0]];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const w: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    for (let j = 0; j < n; j++) {
      const t = ((j + 0.5) / n) * TAU, c = Math.cos(t) * rs[k], s = Math.sin(t) * rs[k];
      v.push([pts[k][0] + u[0] * c + w[0] * s, pts[k][1] + u[1] * c + w[1] * s, pts[k][2] + u[2] * c + w[2] * s]);
    }
  }
  // Each ring runs round the chain the same way, so one winding faces every side out, however the chain bends.
  for (let k = 0; k < pts.length - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j], m: mat });
    }
  }
  if (ends) {
    f.push({ i: Array.from({ length: n }, (_, j) => n - 1 - j), m: mat });
    const last = (pts.length - 1) * n;
    f.push({ i: Array.from({ length: n }, (_, j) => last + j), m: mat });
  }
  return mesh(v, f);
}

/** A polygon's normal, the long way round, which is right for a quad that is not quite flat. */
function newell(p: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < p.length; k++) {
    const a = p[k], b = p[(k + 1) % p.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}

/** Flat pieces laid on a surface: an eye, a brow, a buckle. Each is a decal of four corners. */
function decals(quads: Array<{ q: V3[]; m: Mat; unless?: V3; lit?: boolean }>): Mesh {
  const v: V3[] = [];
  const f: Face[] = [];
  for (const { q, m, unless, lit } of quads) {
    const base = v.length;
    v.push(...q);
    f.push({ i: q.map((_, k) => base + k), m, decal: true, unless, lit });
  }
  return mesh(v, f);
}

/** A quad laid flat on a surface, centred at `c`, spanning ±`u` and ±`w`, wound to face along `n`. */
function plate(c: V3, u: V3, w: V3, n: V3, m: Mat): { q: V3[]; m: Mat } {
  const q: V3[] = [
    [c[0] - u[0] - w[0], c[1] - u[1] - w[1], c[2] - u[2] - w[2]],
    [c[0] + u[0] - w[0], c[1] + u[1] - w[1], c[2] + u[2] - w[2]],
    [c[0] + u[0] + w[0], c[1] + u[1] + w[1], c[2] + u[2] + w[2]],
    [c[0] - u[0] + w[0], c[1] - u[1] + w[1], c[2] - u[2] + w[2]],
  ];
  const k = newell(q);
  return { q: k[0] * n[0] + k[1] * n[1] + k[2] * n[2] < 0 ? q.reverse() : q, m };
}

/** A face made of these corners, wound to face along `want`. */
function faceOut(v: V3[], idx: number[], want: V3, m: Mat): Face {
  const k = newell(idx.map((i) => v[i]));
  return { i: k[0] * want[0] + k[1] * want[1] + k[2] * want[2] < 0 ? [...idx].reverse() : idx, m };
}

/* ---- the body, per look ------------------------------------------------------ */

/** The proportions a build comes to: shoulders, waist and hips, how far toward a woman's frame, and height. */
export interface Frame {
  sh: number;
  wa: number;
  hi: number;
  fem: number;
  tall: number;
}

const BETWEEN = { shoulder: 1, waist: 0.92, hip: 1.03 };

function frameOf(look: Look): Frame {
  // (a body in between, the old 'neither': no look has it now, but the walk's pace was reckoned over all three, `paced.ts`)
  const b = BUILDS[look.gender] ?? BETWEEN;
  const fem = look.gender === 'woman' ? 1 : look.gender === 'man' ? 0 : 0.5;
  return { sh: b.shoulder, wa: b.waist, hi: b.hip, fem, tall: 1 - fem * 0.035 };
}

/*
 * The skeleton at rest. A body is sixteen and a half tenths of a metre to the
 * crown -- thirty-seven pixels at zoom one, the figure the island was drawn
 * round -- and proportioned to be read at that size rather than measured:
 * a head a quarter of the height, a long body over short sturdy legs, and
 * hands and feet a little big, which is what makes a figure thirty pixels
 * tall read as somebody rather than a stick.
 */
const HIP = 7.25;
const SPINE = 1.1;
const CHEST = 1.8;
const NECK = 2.12;
const HEADJ = 0.62;
const ARM_AT = 1.66;
const UPPER = 2.8;
const LOWER = 2.4;
const THIGH = 3.3;
const SHIN = 3.1;
/** The top of the skull: over the temples by as much as the stretch of the drawing leaves the dome looking as tall as it is wide. */
const CROWN = 2 + (1.46 * 1.7) / 2.25 / 1.01;

/**
 * The head is made at one size and then scaled up to the one it is drawn at,
 * hair, beard, face and all, so every haircut sits on the skull it was cut
 * for whatever size heads end up.
 */
const HEAD_SIZE: V3 = [1.24, 1.22, 1.08];
const bigger = (p: V3): V3 => [p[0] * HEAD_SIZE[0], p[1] * HEAD_SIZE[1], p[2] * HEAD_SIZE[2] + 0.03];

/** Hands a little over life size too, so that a hand reads at the size the island is played at: a fist, and an open hand waving. */
const HAND = 1.12;
/** How far down the hand from the wrist a haft goes through the fist. */
const GRIP = -0.55 * HAND;

/** Every facet of a mesh marked as part of something `w` wide: see `Face.fine`. */
const fine = (m: Mesh, w: number): Mesh => ({ ...m, f: m.f.map((f) => ({ ...f, fine: w })) });
/** Nought below `a`, one above `b`, smooth between. */
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---- posing ------------------------------------------------------------------- */

export type Euler = [number, number, number];

/** A pose: every joint's turn, in degrees, and where the body is. Exported for the spells' cast poses (`./spells`). */
export interface Rig {
  at: V3;
  pelvis: Euler;
  spine: Euler;
  chest: Euler;
  neck: Euler;
  head: Euler;
  /** Each side, left then right: [forward, out from the body, turned in]. */
  arm: [Euler, Euler];
  elbow: [number, number];
  hand: [Euler, Euler];
  leg: [Euler, Euler];
  knee: [number, number];
  /** Toe up, over and above whatever keeps the foot flat. */
  foot: [number, number];
  /** Keep the foot flat to the ground whatever the leg above it is doing. */
  flat: [boolean, boolean];
  /** How hair that hangs is swinging: back, and to the side. */
  tail: Euler;
  /** Off the ground, a hop's worth. */
  lift: number;
  /** In water to the chest, a swimmer: the body is let down this far rather than stood on its feet. */
  sink: number;
  /** A swimmer's head, held this far over the water whatever the body under it is doing; the water is where the feet were. */
  float?: number;
  /** How far a swimmer is under way rather than treading water, nought to one: blended, so the rings of the one fade in over the other. */
  under?: number;
  /**
   * Sat down, on a seat this high over the floor the feet are on, and astride or not: see `Seat`. On the `ground`, the
   * legs fold as they do astride but there is no beast under you to hide anything behind.
   */
  sit?: { up: number; astride: boolean; ground?: boolean };
  /** What a driver has in hand: see `Seat`. */
  seat?: Seat;
  /** How slack the reins hang, from taut (nought) to let go (one). */
  slack?: number;
  /** A pair of oars, right then left: each turned about its rowlock, out over the water, and its blade turned flat to the air from square to it by `feather`. */
  oars?: Array<{ lock: V3; out: V3; feather: number; splash?: number }>;
  /** A tiller in hand, from where it is pivoted on the rudder's head to its end in the fist, and its wood as `#rrggbb`: see `steer`. */
  tiller?: { pivot: V3; end: V3; wood?: string };
  /**
   * Where each fist was put sat driving (`fistOn`), left then right, in the body's frame from the feet, and the way what
   * it holds runs through it; `rest`, a hand laid on the thigh holding nothing: what a sculpted body on the same seat
   * reaches its hands to (`../sculpt/anim` seatedLocal).
   */
  fists?: [Fist | undefined, Fist | undefined];
  blink: boolean;
  reins: boolean;
  /** A mallet in the right hand and a chisel in the left. */
  tool: boolean;
  /** The pose mirrored left for right, and whatever is in the hands with it. */
  lefty: boolean;
  /**
   * A run carried on a curve rather than stood on whichever foot is lowest:
   * `h` above where the hips are at mid-stance, `w` of the way (nought at a
   * walk, one at a run), and the stance leg's thigh and knee angles at
   * mid-stance, which is what says where the hips are then; and the gait,
   * nought walking and one running. Never lower than a foot on the ground
   * allows.
   */
  hover?: { h: number; w: number; thigh: number; knee: number; g: number };
  /** Each shoulder raised this far, for an arm lifted high. */
  shrug: [number, number];
  /** How firmly each foot is on the ground, for the body carried on a curve: its knee gives or straightens to keep it there. */
  plant?: [number, number];
  /**
   * Where the ground under the body has got to, in the body's frame (x to its right, y ahead), while something carries
   * the body over it that the pose does not know of -- a spell drawing it in to strike and back (`./spells`, `cast.close`):
   * a foot kept on the ground goes with the ground, so it stays where it was put rather than gliding with the body.
   */
  ground?: [number, number];
  /**
   * How far each hand is open, from closed (nought) to spread (one): a float rather than a switch, so that a hand opening to wave
   * or closing again uncurls and curls its fingers over a few frames (`kit.open`'s steps) instead of snapping from a fist to a fan. `true` is one, so a pose written before the float still reads.
   */
  open: [number | boolean, number | boolean];
  /** Each hand hanging loose, neither open nor closed: walking with nothing in it. */
  loose: [boolean, boolean];
  /** And how far a loose hand's fingers are curled in toward the palm, from hanging straight (nought) to closed (one): see `curled`. */
  curl: [number, number];
  /** The hands wanted for something else -- work, the water, the reins, a wave or a hop -- and whatever they held put away. */
  stowed: boolean;
  /** Which shoulder something heavy is carried over: the right (1), or the left (0) from where the right would put it behind the head. */
  carried: number;
  /** How much further it is turned about itself there, in degrees, to show its head to the viewer. */
  spin: number;
  /**
   * Something heavy on its way from one shoulder to the other in both hands: the weapon's own frame, in the hips' frame, which
   * the hands are put on rather than it hung from either (see `shoulder`). Absent on a shoulder.
   */
  swapping?: Xf;
  /**
   * Blending into or out of work, which puts the weapon away, how far into the putting away it is: nought in the hand, one put
   * away (see `stowHand`). Absent otherwise.
   */
  stowing?: number;
  /** And the hand it is in, which way it lay in the chest's frame as that hand carried it, and how far along it the fist is: see `stowHand`. */
  stowHand?: number;
  stowTurn?: M3;
  stowAt?: number;
  /** The facing a blade in the fist is carried for, following the body's round more slowly than it turns (see `settle`). */
  bladeFacing?: number;
  /**
   * A weapon in the right fist carried by the forearm rather than set off the hips, this share of the way: a blow
   * struck by a spell (`./spells`), where the swing of the arm has to be the swing of the blade. Nought or absent
   * is the carry as it always was.
   */
  wield?: number;
  /*
   * What follows is all for the spells' casts (`./spells`), and all of it
   * optional: a pose that sets none of it is drawn exactly as it always was.
   * The numbers are shares or degrees that a cast blends in from nought
   * (`castOver` in ./spells/index), so each comes in smoothly with the cast.
   */
  /**
   * A spear or a javelin (`carry 'staff'`) taken by the arms rather than stood upright off the hips, this share of the way: held
   * in the right fist along the line of the forearm, its point out past the knuckles -- or, with `both`, along the line from the
   * right fist through the left -- so a thrust levels it, a sweep swings it low and a brace grounds its butt.
   */
  wieldStaff?: number;
  /**
   * A bow taken by the left fist rather than stood off the hips, this share of the way: its stave through the fist as a haft is
   * held, and its back out past the knuckles, so the bow arm aims it. Put the hand with `reach` and a `haft` straight up to stand
   * the stave upright, leant to cant it; or turn the hand about the forearm (`hand[0]`).
   */
  wieldBow?: number;
  /**
   * The other hand on the haft too, this share of the way: for a weapon in the right fist or over a shoulder, that hand is put on
   * the haft `bothAt` from the first fist and closed on it; for a spear with `wieldStaff`, the shaft runs from the right fist
   * through the left wherever the pose puts it, and the left closes on it there.
   */
  both?: number;
  /** Where along the haft the second hand closes, in units from the first fist: toward the head above nought, toward the butt below. */
  bothAt?: number;
  /**
   * How far the weapon in the right fist (or the shouldering fist) is turned in it, in degrees, its head toward the line of the
   * forearm past the knuckles -- where a wrist would have to bend to do it -- from where the carry holds it: square across the fist
   * for something shouldered, a third of the way along for a blade with `wield`, along the forearm for a spear with `wieldStaff`.
   * About 150 with `wield` is a blade held point down, reversed in the fist.
   */
  haft?: number;
  /** How far the weapon is slid through the fist toward its point, in units: a spear held near its butt for a long thrust. */
  slide?: number;
  /** A bow's string drawn back to the right hand's fingers, this share of the way from straight. */
  draw?: number;
  /**
   * An arrow on the string, its nock where the string is drawn to and its shaft over the bow hand; two (`2`), the
   * second nocked beside the first along the string and fanned a little up the stave from it, for two loosed at once.
   */
  nocked?: boolean | number;
  /**
   * An arrow held in the right fist, closed on its shaft a fifth of the way up from the nock and pointing out past
   * the knuckles as a haft does (turned toward the forearm by `haft`): one fetched from the quiver, or carried to the
   * string. As long as the bow's own arrows, or seven units with no bow.
   */
  arrowHand?: boolean;
  /**
   * What is in the hands put away for the cast, from where it is half way in (0.5) to where it is half way out
   * again: a knife sheathed to dress a wound, a maul slung to lay both hands on somebody. Blended in and out with the
   * cast like the rest, so it goes as the cast takes the hands and comes back as it gives them back; a pose that
   * wants it seen going brings the hand to the hip (or over the shoulder) first, with `reach`.
   */
  stow?: number;
  /** The right hand emptied -- what was in it thrown -- without putting anything away: the weapon is not drawn, the shield stays on. */
  thrown?: boolean;
  /**
   * Each hand put at a place, left then right, rather than posed joint by joint: the middle of the hand at `at`, in the body's
   * own frame from the middle of its feet as `figureJoint` gives it (x to the right, y ahead, z up), the elbow toward `pole`
   * (default down, back and out to its own side) and, given `haft`, the fist closed on something running that way. `w` of the
   * way from the pose's own arm (one when left out). Out of reach, the hand reaches as far as it goes toward the place.
   */
  reach?: [HandGoal | undefined, HandGoal | undefined];
  /** Each hand's shape, left then right, as shares of each shape: see `HandShape`. Over whatever `open` and `loose` say. */
  shape?: [HandShape | undefined, HandShape | undefined];
  /** The mouth open, this share of the way to a shout. */
  mouth?: number;
  /**
   * Down on one knee, this share of the way: the knee on the ground with its toes tucked under behind it, the other foot flat
   * ahead with the thigh over it all but level. The right knee unless `kneelLeft`. Not on the move.
   */
  kneel?: number;
  kneelLeft?: boolean;
}

/** Where a hand is put: see `Rig.reach`. */
export interface HandGoal {
  at: V3;
  w?: number;
  pole?: V3;
  haft?: V3;
  /** Bow the trunk forward over the hips as far as it takes for the hand to get there (down to the ground, say), and no further. */
  stoop?: boolean;
}

/**
 * A hand's shape, as shares of each, blended from a closed hand: `claw` fingers spread and bent hard at the middle joints; `cup`
 * fingers together, bent a little at both, a bowl; `flat` straight and together, an offering palm (turned up by the hand's roll);
 * `point` the forefinger out straight, the rest curled; `two` the fore and middle fingers out in a vee.
 */
export interface HandShape { claw?: number; cup?: number; flat?: number; point?: number; two?: number }
const HAND_SHAPES = ['claw', 'cup', 'flat', 'point', 'two'] as const;

function rest(): Rig {
  return {
    at: [0, 0, 0], pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
    arm: [[4, 8, 0], [4, 8, 0]], elbow: [10, 10], hand: [[0, 0, 0], [0, 0, 0]],
    leg: [[0, 2, 0], [0, 2, 0]], knee: [3, 3], foot: [0, 0], flat: [true, true],
    tail: [0, 0, 0], lift: 0, sink: 0, blink: false, reins: false, tool: false, lefty: false, shrug: [0, 0], open: [0, 0], loose: [false, false], curl: [0, 0], stowed: false, carried: 1, spin: 0,
  };
}

/** The same pose the other way about, left for right. */
function mirror(r: Rig): void {
  const m = (e: Euler): Euler => [e[0], -e[1], -e[2]];
  r.at = [-r.at[0], r.at[1], r.at[2]];
  r.pelvis = m(r.pelvis);
  r.spine = m(r.spine);
  r.chest = m(r.chest);
  r.neck = m(r.neck);
  r.head = m(r.head);
  r.tail = m(r.tail);
  // The limbs are already set down alike for both sides, so each takes the other's angles; a hand's turn about the arm is the one thing that flips.
  r.arm = [r.arm[1], r.arm[0]];
  r.elbow = [r.elbow[1], r.elbow[0]];
  r.hand = [m(r.hand[1]), m(r.hand[0])];
  r.leg = [r.leg[1], r.leg[0]];
  r.knee = [r.knee[1], r.knee[0]];
  r.foot = [r.foot[1], r.foot[0]];
  r.flat = [r.flat[1], r.flat[0]];
  r.shrug = [r.shrug[1], r.shrug[0]];
  r.open = [r.open[1], r.open[0]];
  r.loose = [r.loose[1], r.loose[0]];
  r.curl = [r.curl[1], r.curl[0]];
  if (r.plant) r.plant = [r.plant[1], r.plant[0]];
  if (r.shape) r.shape = [r.shape[1], r.shape[0]];
  r.lefty = !r.lefty;
}

/**
 * What somebody driving is sat on, and what is in their hands, in the
 * body's own frame from where its feet are put -- the floor of a cart's box
 * or a boat, or a saddle -- across to the right, forward, and up. A driver
 * was a body stood on that floor with its thighs held out level, so it sat
 * on the air above a bench a hand lower, or with its feet on a boat's
 * gunwale, holding reins out over the water to nothing.
 */
export interface Seat {
  /** The reins of a team or a mount, a pair of oars, or a boat's tiller. */
  hands: 'reins' | 'oars' | 'tiller';
  /** The top of what is sat on, over the floor the feet are put on: nought on a saddle, which is where the feet are put. */
  up: number;
  /** Astride a beast's back with the legs down either side of it, rather than sat with the feet on a floor. */
  astride?: boolean;
  /**
   * Astride, how far the legs are drawn up, nought to one: the thighs forward along the beast's back, the knees high and the
   * shins folded back along its flanks, so the boots ride up at its sides -- on a small mount, or short in the stirrups.
   * Left out, nought: the legs hang down its sides.
   */
  tuck?: number;
  /** Where the reins run to; the right-hand oar's rowlock (the left's is its mirror); the end of the tiller. */
  grip: V3;
  /**
   * A tiller's pivot, on the head of the rudder, in the same frame, and its wood as `#rrggbb`: given, the tiller is the
   * driver's to draw, swung about it with the hand, and whatever draws the hull leaves it out of her.
   */
  pivot?: V3;
  wood?: string;
  /**
   * How far the hull under the seat is heeled over to the body's right and pitched bow down, in degrees, as whoever draws
   * the hull has it this moment: the body is carried over with her by that, and balances against it.
   */
  sway?: { heel: number; pitch: number };
  /**
   * The near side of what is sat in, on the screen from the feet at zoom
   * one, for whatever of the body is down behind it: the outline of the
   * whole of it from outside, and the rim round the open top that is seen
   * down into. Reins and oars, which come out over the top, are not hidden.
   */
  sides?: { outline: Pt[]; rim: Pt[] };
}

/** What the game says a body is doing: the same fields a player's pose has always had. */
export interface FigurePose {
  phase: number;
  moving: boolean;
  /** 0 at a walk, 1 at a run. */
  gait?: number;
  /** Which of the eight ways it faces: nought straight at you, two to screen right. */
  facing: number;
  swimming: boolean;
  working: boolean;
  /**
   * The job being worked at, by its action id, for the few jobs that are not done stood up with a tool: meditating
   * (`meditate`) is done sat cross-legged on the ground. Left out, or any other job, is the work at the bench.
   */
  job?: string;
  driving?: boolean;
  /**
   * For a body `driving`, what it is sat on and what its hands are doing
   * there; a cart's box with the reins when left out. With it, `facing` may
   * be between two of the eight ways, square along whatever is sat in.
   */
  seat?: Seat;
  tunic?: string;
  trousers?: string;
  look?: Look;
  emote?: string;
  emoteT?: number;
  /** For a body `working`, where it is in the go of its job and how long a go takes, seconds, when known (a sculpted figure's clip is fitted to it). */
  act?: { t: number; length: number };
  /**
   * Who this is, for a body drawn frame after frame: with it, going from
   * standing to walking, into the water or down to work is a blend over a
   * fifth of a second rather than a jump, and turning from one of the eight
   * ways to the next is a quick turn rather than a cut.
   */
  id?: string;
  /** What is worn and held, each piece drawn on the body in its own material, dye and rarity. */
  gear?: GearLook;
  /**
   * The tool the job in hand is done with, when it is one a sculpted figure holds (mining's pickaxe, a bench tool: `../sculpt/anim/routes.ts` CLIP_OF_TOOL): the one the job
   * uses, in its own metal, lit when enchanted. Left out, a sculpted figure at that job holds one of no metal (iron's).
   */
  tool?: GearPiece;
  /**
   * Which garments a low-poly body has on (the sculpted bodies, `../sculpt/lowpoly`): each left out at the game's default,
   * the shawl, the trousers, the boots and the tunic worn and the hood down; the hood is up only with the shawl, and the
   * hair is not drawn under it. The plate, leather and chain sets' pieces are off unless asked for, each plain unless `enchanted` says so.
   */
  outfit?: Partial<Record<'shawl' | 'trousers' | 'boots' | 'tunic' | 'hood' | 'plateChest' | 'plateLegs' | 'plateBoots' | 'plateHelm' | 'plateMantle' | 'leatherChest' | 'leatherLegs' | 'leatherBoots' | 'leatherShawl' | 'leatherHat' | ChainPiece | 'scaleHelm' | 'scaleChest' | 'scaleShawl' | 'scaleLegs' | 'scaleBoots', boolean>> & {
    enchanted?: Partial<Record<'chest' | 'legs' | 'boots' | 'helm' | 'mantle' | 'leatherChest' | 'leatherLegs' | 'leatherBoots' | 'leatherShawl' | 'leatherHat' | 'clothShawl' | 'clothHood' | 'clothTunic' | 'clothTrousers' | 'clothBoots' | ChainPiece | 'scaleHelm' | 'scaleChest' | 'scaleShawl' | 'scaleLegs' | 'scaleBoots', boolean>>;
    /**
     * The metal each plate or chain piece is smithed from (`GearPiece.material`): its plates or its mail drawn in it (`src/sculpt/lowpoly.ts` plateMat); none, its own colours.
     * The scale set's pieces (`scale`, one for the set) in dragon scale's colour (`DRAGON_SCALE`), or a metal's where one is named.
     */
    metal?: Partial<Record<PlatePiece, string>>;
    /** The dye each cloth or leather piece is dyed (`GearPiece.dye`, `#rrggbb`): its fabric or leather drawn in it (`src/sculpt/lowpoly.ts` dyeMat). */
    dye?: Partial<Record<DyedPiece, string>>;
  };
  /**
   * A spell part way through being cast: which, and how far through it, nought to one. What it does to the body
   * is the spell's own (`./spells`, registered with `castPosesBy`), laid over whatever else the body is doing --
   * over the arms and the trunk only while it walks, swims or drives.
   */
  cast?: { id: string; t: number };
  /**
   * A blow taken on the shield worn, how far through it, nought to one (`../game/fight` blockAt, `BLOCK_SECS`): the shield
   * arm brought up across the chest and the body braced behind it (`../sculpt/anim/clips/block.ts`), laid over whatever else
   * the body is doing. Nothing without a shield on.
   */
  block?: number;
  /**
   * A blow landing on the body (`../game/fight` flinchAt, `FLINCH_SECS`): how far through the flinch, nought to one;
   * where it landed (a hit location's slot: head, chest, arms, legs, feet), when known; and where it came from, radians
   * round from straight ahead toward the body's left (π: from behind), when known, else from ahead. The body jolted away
   * from it (`../sculpt/anim/clips/flinch.ts`), lit by it for its first `FLINCH_LIT` seconds; laid over whatever else the
   * body is doing.
   */
  flinch?: { t: number; where?: string; from?: number };
  /**
   * The body veiled by a spell (`FxScene.veil` in ./spells/kit): `tint` of the way to `colour` over all of it, and
   * drawn `fade` of the way to nothing -- a shroud, a body gone to smoke. Laid over the picture as it is put down,
   * so the picture itself is kept as it is.
   */
  veil?: FigureVeil;
  /** A rod's line and float drawn by the action effects while they are out over the water (`./fx/fishing.ts`): the rod's own left out then. */
  line?: boolean;
}

/** A body veiled: see `FigurePose.veil`. `colour` is '#rrggbb'; `tint` and `fade` nought to one. */
export interface FigureVeil {
  colour: string;
  tint: number;
  fade: number;
}

/*
 * Feet that stay where they are put. Standing, working and hopping were
 * posed joint by joint, the hips swayed over to one foot and rolled, and the
 * legs swung with them: the feet slid most of a tenth of a metre across the
 * ground each time the weight changed legs, and the free one stood on
 * nothing. Now where each ankle stands is said first and the leg is solved
 * to it from wherever the hips have been put -- the thigh's pitch and roll
 * and the knee's bend that reach it exactly -- so the hips can sway, drop
 * and turn over planted feet.
 */

/** Where the ankles stand at rest, in the frame the body is stood in: a little wider than the hips, the left a little ahead, toes turned out. */
function stance(fr: Frame): [V3, V3] {
  const T = fr.tall, z = HIP * T - 0.1 - (THIGH + SHIN) * T + 0.06;
  return [[-(fr.hi + 0.3), 0.2, z], [fr.hi + 0.3, -0.12, z]];
}
/** How far each foot is turned out at rest, in degrees: the leg's turn in, negative. */
const TOE_OUT = -6;

/** The hips' height, as `r.at[2]`, that leaves leg `k` bent `bend` degrees at the knee to reach `ankle`. */
function hipsFor(r: Rig, fr: Frame, k: number, ankle: V3, bend: number): number {
  const T = fr.tall, a = THIGH * T, b = SHIN * T, s = k ? 1 : -1;
  const pelvis = joint(ROOT, [r.at[0], r.at[1], 0], ...r.pelvis);
  const hip = place(pelvis, [s * fr.hi, 0, -0.1]);
  const reach = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(bend * DEG));
  const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
  return ankle[2] + Math.sqrt(Math.max(0, reach * reach - dx * dx - dy * dy)) - hip[2] - HIP * T;
}

/**
 * Leg `k` put down with its ankle at `ankle`, in the frame the body is
 * stood in, from the hips as `r` has them: the thigh pitched and rolled and
 * the knee bent so the ankle is there, the leg's turn kept. Out of reach, it
 * reaches straight toward it.
 */
function plant(r: Rig, fr: Frame, k: number, ankle: V3): void {
  const T = fr.tall, a = THIGH * T, b = SHIN * T, s = k ? 1 : -1;
  const pelvis = joint(ROOT, [r.at[0], r.at[1], HIP * T + r.at[2]], ...r.pelvis);
  const hip = place(pelvis, [s * fr.hi, 0, -0.1]);
  const m = pelvis.m, w: V3 = [ankle[0] - hip[0], ankle[1] - hip[1], ankle[2] - hip[2]];
  // Into the hips' frame, and the leg's own turn about itself undone.
  const d = mv(rz(-s * r.leg[k][2] * DEG), [m[0] * w[0] + m[3] * w[1] + m[6] * w[2], m[1] * w[0] + m[4] * w[1] + m[7] * w[2], m[2] * w[0] + m[5] * w[1] + m[8] * w[2]]);
  const far = Math.hypot(d[0], d[1], d[2]) || 1, L = Math.min(a + b - 1e-3, far);
  const x = (d[0] * L) / far, y = (d[1] * L) / far, z = (d[2] * L) / far;
  const knee = Math.acos(Math.max(-1, Math.min(1, (L * L - a * a - b * b) / (2 * a * b))));
  // Straight down the leg, the ankle is the thigh's length and the shin's, bent back by the knee; pitched forward, then rolled out.
  const pitch = Math.atan2(y, Math.hypot(x, z)) - Math.atan2(-b * Math.sin(knee), a + b * Math.cos(knee));
  const roll = Math.atan2(-x, -z);
  r.leg[k] = [pitch / DEG, (-s * roll) / DEG, r.leg[k][2]];
  r.knee[k] = knee / DEG;
}

/**
 * Which way leg `k`'s foot points along the ground as `r` has it, in
 * degrees round to the left from straight ahead: the hips, the leg and the
 * foot kept level, as `skeleton` puts them together.
 */
function footYaw(r: Rig, fr: Frame, k: number): number {
  const T = fr.tall, s = k ? 1 : -1, [lp, la, lt] = r.leg[k];
  const pelvis = joint(ROOT, [r.at[0], r.at[1], HIP * T + r.at[2]], ...r.pelvis);
  const knee = joint(joint(pelvis, [s * fr.hi, 0, -0.1], lp, -s * la, s * lt), [0, 0, -THIGH * T], -r.knee[k]);
  const ankle = joint(knee, [0, 0, -SHIN * T], (r.flat[k] ? -(r.pelvis[0] + lp - r.knee[k]) : 0) + r.foot[k]);
  return Math.atan2(-ankle.m[1], ankle.m[4]) / DEG;
}

/**
 * Both feet planted at `feet`, the hips `r.at[2]` as high as leaves the leg
 * taking the weight -- the right at `on` one, the left at minus one, shared
 * between -- bent `bend` degrees at the knee, and never so high that either
 * leg is pulled straight.
 */
function standOn(r: Rig, fr: Frame, feet: [V3, V3], on: number, bend: number): void {
  const u = 0.5 + 0.5 * Math.max(-1, Math.min(1, on));
  const h = hipsFor(r, fr, 0, feet[0], bend) * (1 - u) + hipsFor(r, fr, 1, feet[1], bend) * u;
  r.at[2] = Math.min(h, hipsFor(r, fr, 0, feet[0], 2), hipsFor(r, fr, 1, feet[1], 2));
  for (let k = 0; k < 2; k++) plant(r, fr, k, feet[k]);
}

/** A smooth step from `a` to `b`: nought before, one after. */
const step = (x: number, a: number, b: number): number => ease(Math.max(0, Math.min(1, (x - a) / (b - a))));

/**
 * Where a standing body looks in each sixteen seconds, as [when, turned to
 * its left, nodded up], in seconds and degrees: about, and held a while each
 * time, as somebody does who is waiting -- not a slow sway side to side.
 */
const LOOKS: [number, number, number][] = [[0.4, 3, 1], [2.7, 17, -1], [5.0, 10, 2], [8.6, -13, 0], [10.1, -21, -2], [14.6, -2, 0]];
/** How far down a standing body looks at most, in degrees: see `idle`. */
const LOOK_LEAST = -24;
/** And how much of that the neck and the head take, the chest bowing the rest. */
const LOOK_BOW = -16;
/**
 * Under a helm with a brim and a nasal the face is gone from in front at
 * far less than that, so there the head and the chest each bow no further
 * than this, and the hand is looked down at: bowed to it, the brim and
 * nasal covered all of the face but a strip. Brought up higher to the
 * eyes instead, the gauntlet was held in front of the face.
 */
const LOOK_BOW_HELM = -7;
/** How far the elbow of the hand looked at bends under a helm, in degrees, where it is 80 bare: brought up as far, the gauntlet's fingers were at the chin. */
const LOOK_HAND_HELM = 66;
/** How much further the upper arms are turned in at rest than they were, and the elbows bent, in degrees: see `idle`. */
const IDLE_TURN_IN = 8, IDLE_BEND = 4;
/**
 * And seen square from in front or behind (`IDLE_FRONT`, by facing), each arm a little further forward (`IDLE_FRONT_ARM`, out
 * from the side and turned in by it, in degrees), the elbow bent further (`IDLE_FRONT_BEND`) and the hand turned in by
 * `IDLE_FRONT_HAND`: so the hands hang on the front of the thighs and the forearms lean in from the elbow, a break in the
 * outline. Bent only straight toward whoever looks, the arms read from there as two straight tubes.
 */
const IDLE_FRONT = [1, 0.4, 0, 0.4, 1, 0.4, 0, 0.4];
const IDLE_FRONT_ARM: Euler = [4, 0, 6], IDLE_FRONT_BEND = 8, IDLE_FRONT_HAND = 12;
/** And when it blinks: as each look starts, and now and then besides, once twice in a row. */
const BLINKS = [0.45, 2.75, 4.1, 5.05, 8.65, 10.15, 11.3, 11.62, 14.65];

/**
 * Standing: breathing, the weight on one leg and then the other with the
 * hips swinging over it and the free knee easing, the shoulders tilted
 * against the hips, the head looking about and blinking, and now and then a
 * shrug of the shoulders or a look at a hand. Everything repeats in sixteen
 * seconds and nothing more often than it should: four breaths, unevenly
 * spaced and of uneven depth, in quicker than out; the weight changing legs
 * twice; the looks and the blinks at their own times. `t` is in seconds.
 *
 * The two arms are not one arm twice: the left hangs a little straighter
 * and further forward, the right more bent with its hand turned further in,
 * and both hands loose rather than fists. The look at a hand is at one with
 * nothing in it (`busy`, left then right): the right, or the left when the
 * right holds something -- looked at, a sword's blade came up through the
 * body and a spear's shaft across the face -- and none when both are full.
 * And the eyes go to where the hand is, wherever that is.
 */
function idle(r: Rig, t: number, fr: Frame, busy: [boolean, boolean] = [false, false], helmed = false, facing = 1): void {
  const tt = ((t % 16) + 16) % 16;
  const turn = (period: number): number => (TAU * t) / period;
  // Breathing: the rate drifting a sixth either way over the loop, in quicker than out, deeper and shallower.
  const bp = turn(4) + 0.55 * Math.sin(turn(16) + 0.9);
  const depth = 0.8 + 0.2 * Math.sin(turn(16 / 3) + 0.4);
  const b = depth * Math.sin(bp + 0.4 * Math.sin(bp));
  // The weight on the right at one, the left at minus one, changing over in a second and a half and then held, with a little drift.
  const weight = (x: number): number => Math.tanh(2.6 * Math.sin((TAU * x) / 16)) / Math.tanh(2.6) + 0.05 * Math.sin((TAU * x) / (16 / 5));
  const w = weight(t);
  // The arms hang a third of a second behind the body as it goes over, as anything hanging does.
  const lag = w - weight(t - 0.35);
  // Far enough over, and the shoulders up enough with each breath, to be a pixel or two at the sizes the island is played at: less
  // was a body stood still there.
  r.pelvis = [0, -5.5 * w, -2.5 * w];
  r.at = [0.62 * w, 0, 0];
  r.spine = [0.5 * b, 3.6 * w, 1.6 * w];
  r.chest = [1.8 * b, 2.4 * w, 0.9 * w];
  r.neck = [-0.8 * b, -1 * w, 0];
  r.shrug = [0.15 * (b + 1), 0.15 * (b + 1)];
  // Clear of the hips: wider set ones, under narrower shoulders, hang the arms further out.
  const out = Math.max(5, Math.asin(Math.min(1, (1.55 * fr.hi + 0.85 - 2.1 * fr.sh) / 4.6)) / DEG - 2);
  const front = byFacing(IDLE_FRONT, facing);
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    /*
     * Relaxed, the upper arm turned in at the shoulder and the elbow bent a
     * little, so the forearm comes forward and in and the hand hangs in front
     * of the side of the thigh, its fingers loosely curled. The elbows were
     * bent a few degrees straight forward and the upper arms not turned, so
     * from in front the arms hung straight, out from the body in an A, with
     * flat hands on the ends: a mannequin's. Turned in by `IDLE_TURN_IN`
     * more, as the bend still showed only from three-quarters on.
     */
    r.arm[k] = [(k ? 2 : 5) + 1.2 * b + (k ? -1 : 1) * w, out + (k ? 0 : 1) + 0.8 * b - s * 9 * lag, (k ? 22 : 15) + IDLE_TURN_IN];
    r.elbow[k] = (k ? 27 : 21) + IDLE_BEND + 2 * b + 2 * (k ? Math.max(0, w) : Math.max(0, -w));
    // The hands hanging relaxed, bent a little back off the forearm and turned in toward the thigh, the right further.
    r.hand[k] = [k ? 9 : 5, 0, -s * (k ? 8 : 3)];
    r.arm[k] = r.arm[k].map((v, j) => v + IDLE_FRONT_ARM[j] * front) as Euler;
    r.elbow[k] += IDLE_FRONT_BEND * front;
    r.hand[k][2] -= s * IDLE_FRONT_HAND * front;
    r.loose[k] = true;
    r.curl[k] = k ? 0.5 : 0.35;
  }
  // The head: from one look to the next in under half a second, then held.
  const n = LOOKS.length;
  let i = n - 1;
  while (i >= 0 && LOOKS[i][0] > tt) i--;
  const cur = LOOKS[(i + n) % n], was = LOOKS[(i - 1 + 2 * n) % n];
  const g = step((tt - cur[0] + 16) % 16, 0, 0.45);
  const yaw = was[1] + (cur[1] - was[1]) * g, nod = was[2] + (cur[2] - was[2]) * g;
  // The neck takes a third of a look and the head the rest, and the head stays level as the shoulders tilt.
  r.neck[2] = 0.35 * yaw;
  r.head = [nod - 0.6 * b, -1.2 * w, 0.65 * yaw];
  r.blink = BLINKS.some((at) => tt >= at && tt < at + 0.14);
  r.tail = [3 * Math.sin(turn(16 / 5)), 2 * Math.sin(turn(16 / 3)), 0];
  // A shrug, the shoulders up and back and down again with a deeper breath, between six and eight seconds in.
  const sh = Math.pow(Math.sin(Math.PI * step(tt, 5.7, 7.7)), 2);
  if (sh > 0) {
    r.chest[0] += 4 * sh;
    r.head[0] += 4 * sh;
    r.shrug = [r.shrug[0] + 0.55 * sh, r.shrug[1] + 0.55 * sh];
    for (let k = 0; k < 2; k++) {
      r.arm[k][0] -= 6 * sh;
      r.arm[k][1] += 3 * sh;
    }
  }
  // And a look at a free hand from twelve seconds in: the forearm brought up, the hand turned over and back, and let down.
  const lk = step(tt, 12.1, 12.7) * (1 - step(tt, 13.7, 14.4));
  const k: number = !busy[1] ? 1 : !busy[0] ? 0 : -1;
  if (lk > 0 && k >= 0) {
    const s = k ? 1 : -1;
    const over = Math.sin(Math.PI * step(tt, 12.6, 13.8));
    // From the arm as it hangs at three-quarters, without what square on adds (`IDLE_FRONT`): with it, the gauntlet came up to the chin.
    const f = front * lk;
    r.arm[k] = [r.arm[k][0] + 24 * lk - IDLE_FRONT_ARM[0] * f, r.arm[k][1] - 2 * lk - IDLE_FRONT_ARM[1] * f, r.arm[k][2] + 18 * lk - IDLE_FRONT_ARM[2] * f];
    // Under a helm, held at the chest rather than up at the chin, where it is looked down at under the brim.
    r.elbow[k] += (helmed ? LOOK_HAND_HELM : 80) * lk - IDLE_FRONT_BEND * f;
    r.hand[k] = [r.hand[k][0] * (1 - lk) + 8 * lk, 0, r.hand[k][2] * (1 - lk) - s * 55 * over];
    // Where the eyes are and where the hand is, in the chest's frame, which the neck and the head turn from: the look is the way
    // from the one to the other, the neck taking a third of it. It was a nod by so much, which side on put the eyes past a hand
    // held up at the chin. Bowed no further than leaves the face to be seen from above, though the eyes go a little further.
    const bones = skeleton(fr, r), c = bones.chest.m;
    const eye = place(bones.head, [0, 1.3, 1.45]), hand = place(bones[`wrist${k}`], [0, 0, -0.55]);
    const v: V3 = [hand[0] - eye[0], hand[1] - eye[1], hand[2] - eye[2]];
    const d: V3 = [c[0] * v[0] + c[3] * v[1] + c[6] * v[2], c[1] * v[0] + c[4] * v[1] + c[7] * v[2], c[2] * v[0] + c[5] * v[1] + c[8] * v[2]];
    const look = Math.max(LOOK_LEAST, Math.atan2(d[2], Math.hypot(d[0], d[1])) / DEG), yaw = Math.atan2(-d[0], d[1]) / DEG;
    // The neck and the head bow no further than `LOOK_BOW` and the chest the rest: bowed the whole way, a helm's crown and nasal
    // filled the face from in front.
    const nod = Math.max(helmed ? LOOK_BOW_HELM : LOOK_BOW, look);
    r.chest[0] += Math.max(helmed ? LOOK_BOW_HELM : -90, look - nod) * lk;
    r.neck = [r.neck[0] * (1 - lk) + 0.35 * nod * lk, r.neck[1], r.neck[2] * (1 - lk) + 0.35 * yaw * lk];
    r.head = [r.head[0] * (1 - lk) + 0.65 * nod * lk, r.head[1], r.head[2] * (1 - lk) + 0.65 * yaw * lk];
  }
  // The feet stay where they are, and the legs are solved to them from where the hips have gone.
  r.leg = [[0, 0, TOE_OUT], [0, 0, TOE_OUT]];
  standOn(r, fr, stance(fr), w, 3);
}

/*
 * A stride as an animator keys it, for one leg from the moment its heel
 * comes down (nought) to the next: the thigh's angle from upright in the
 * ground's terms (forward positive -- the hips' own tilt is taken off it),
 * the knee's bend, and the toe's lift off flat. The other leg is the same
 * half a stride on. Between the keys it is curved smoothly (`loop`).
 *
 * Walking: the heel down with the leg reaching (contact); the knee giving as
 * the weight comes onto it and the foot slapping flat (down); the leg upright
 * under the body as the other comes past (passing); the heel peeling up as the
 * body goes over the toes (up); the toe last off the ground with the knee
 * already folding, the foot carried through low under the body, and the shin
 * swung out ahead to reach for the next. Each foot is on the ground for
 * `WALK_DOWN` of the stride, so both are down for a tenth of each step.
 *
 * Running: landing nearly under the body rather than out ahead of it; sinking
 * onto the knee to mid-stance; the leg driven out straight behind to the toe;
 * the heel flicked up under the seat as the thigh comes through; the knee
 * driven up high in front, and the shin swung out and pawed back under the
 * body for the landing. Each foot is down for `RUN_DOWN` of the stride, and
 * between steps the body is in the air.
 */
const WALK_LEG: Key[] = [
  { at: 0, v: [25, 3, 16] },
  { at: 0.1, v: [18, 15, 0] },
  { at: 0.3, v: [3, 5, 0] },
  { at: 0.45, v: [-9, 4, -7] },
  { at: 0.55, v: [-15, 20, -24] },
  { at: 0.63, v: [-10, 42, -30] },
  { at: 0.74, v: [9, 60, -8] },
  { at: 0.86, v: [24, 34, 4] },
  { at: 0.94, v: [27, 9, 13] },
];
const RUN_LEG: Key[] = [
  { at: 0, v: [22, 16, 6] },
  { at: 0.1, v: [8, 34, 0] },
  { at: 0.2, v: [-8, 28, -6] },
  { at: 0.31, v: [-25, 14, -32] },
  { at: 0.42, v: [-17, 66, -30] },
  { at: 0.55, v: [12, 96, -12] },
  { at: 0.67, v: [38, 76, 0] },
  { at: 0.79, v: [48, 48, 8] },
  { at: 0.89, v: [38, 22, 10] },
  { at: 0.95, v: [28, 14, 8] },
];
/**
 * Seen from in front or behind, the running leg in the air, as far as the
 * body is square on to the viewer: its shin let back no further than this
 * many degrees from the thigh's line, its foot carried out to the side by as
 * much as this many units at the middle of the swing, so the knee goes out
 * a little with it, and the thigh driven up by as much as this many degrees
 * more through the swing, to no more than the last from upright. The knee
 * driven up with the shin folded under it was a thigh pointed at the viewer
 * with a flat cut for an end -- a stump, the shin a twentieth of its length
 * on the screen; with the shin let down and no more, the legs were two posts
 * and the boots never left the ground on the screen (a step toward the
 * viewer goes down the screen as far as the lift goes up it). Lifting the
 * knee itself, with the shin hanging under it, puts the boot up the screen.
 * Driven up by fifty-five degrees more to no more than eighty, the boot rose
 * three and a half pixels at the smallest size, and in a mail skirt, which
 * hides the thigh, that read as a jog on the spot; now about five. The shin
 * is let down only as the thigh comes forward, from the fifth number of
 * degrees to the sixth: let down off the toe too, the leg behind was a post
 * as the one in front reached straight for the ground, and for a frame or
 * two both legs were straight together. Off the toe it folds as it does from
 * the side, and from in front the boot comes up behind the knee.
 */
const RUN_FRONT = [30, 0.7, 70, 90, -5, 25];
/**
 * One stride in each four, walking or running, done a little differently,
 * so that a body going a long way does not read as one stride drawn over and
 * over: each row is a stride's [left arm's reach, right arm's reach (shares
 * more or less), the hips' turn (degrees more), the elbows (degrees more
 * bent), a glance (degrees the head turns, to its left), the hips' drop
 * (share more: a heavier or a lighter stride), the arms' swing out from the
 * side (degrees more), the shoulders' turn (degrees more), where the arms'
 * swing comes to its ends (a share of a stride later), and how far the back
 * leans into the walk (degrees more)]. One goes into the next through the
 * stride rather than at its end, and each body starts the four at its own
 * place (`strideSeed`), so two walking side by side are not in step with
 * each other's. Varied by the reach, the hips' turn, the elbows and the
 * glance alone, at the size the island is played at a wrist moved two pixels
 * and the head less than one from one stride to the next, and four strides
 * read as one drawn four times; these show in the outline.
 */
const WALK_VARY = [
  [-0.06, 0.05, -0.8, -2, 2, 0.12, 3, -2, 0.02, 1.5],
  [0.12, -0.08, 1.4, 4, -6, -0.14, -2, 2.5, -0.03, -1.4],
  [-0.1, 0.12, -1.2, -3, 1, 0.07, -4, -1.5, 0, 2],
  [0.05, -0.1, 0.6, 2, 6, -0.1, 3, 1.5, 0.03, -1.8],
];
/** Where in `WALK_VARY` a body starts, from who it is: a whole number of strides added to its walk's phase. */
function strideSeed(id: string | undefined): number {
  let h = 0;
  for (let i = 0; id && i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % WALK_VARY.length) + WALK_VARY.length) % WALK_VARY.length;
}
/** Walking, how far the elbow is bent with the arm back, and how much further as it comes forward, in degrees. */
const WALK_ELBOW = [24, 22];
/** How much of a stride each foot is on the ground, walking and running. */
const WALK_DOWN = 0.62;
const RUN_DOWN = 0.32;
/*
 * How far the hips are let down from where a straight leg would hold them,
 * through one step (nought at a heel strike), walking and running: what puts
 * the weight in a stride. Walking, lowest just after the heel comes down
 * with the knee giving, highest as the legs pass. Running, lowest at
 * mid-stance sunk on the knee, and up into the air off the toe, highest
 * between the steps with both feet off the ground.
 */
const WALK_DROP: Key[] = [
  { at: 0, v: [0.26] },
  { at: 0.18, v: [0.38] },
  { at: 0.55, v: [0.03] },
  { at: 0.8, v: [0.08] },
];
const RUN_DROP: Key[] = [
  { at: 0, v: [0.22] },
  { at: 0.28, v: [0.48] },
  { at: 0.6, v: [0.12] },
  { at: 0.8, v: [-0.08] },
];
/**
 * Seen from in front or behind at a run, the hips let down by as much as this
 * many units more, deepest this far into a step: from the side the rise and
 * fall reads in the legs, but square on the body stayed level on the screen
 * and the run read as a jog on the spot. Let down and not lifted, so a foot on
 * the ground still reaches it; and eased in and out over the whole step
 * rather than put on the landing, which (as a deeper `RUN_DROP`) jolted the
 * hips a quarter of a unit in a frame onto the foot.
 */
const RUN_BOB = [0.14, 0.35];

/**
 * Walking into running, `g` between them: the two strides keyed above mixed,
 * with the body over them. A foot on the ground stays where it was put down:
 * from its heel strike to its toe leaving, the hip and the knee are turned to
 * keep it on a track going back under the body at an even pace, rolling from
 * the heel over the flat of the foot to the toe -- the pace the keyed contact
 * and toe-off poses imply, so the stride is the keys' and not a number of its
 * own. The hips turn with the leading leg and drop on the side of the leg in
 * the air; the shoulders turn the other way; the arms swing against the legs
 * from the shoulder, the forearm and hand following through a moment behind;
 * and the head is held level and looking where it is going whatever the body
 * under it is doing. At a run the whole body leans in from the ankles and
 * the arms are bent and driven.
 */
function walk(r: Rig, phi: number, g: number, fr: Frame, facing = 2): void {
  const L = (a: number, b: number): number => a + (b - a) * g;
  const frac = (x: number): number => x - Math.floor(x);
  const T = fr.tall, A = THIGH * T, B = SHIN * T;
  // This stride's way of being done, going into the next's (see `WALK_VARY`).
  const n = Math.floor(phi / TAU), into = ease(phi / TAU - n), N = WALK_VARY.length;
  const va = WALK_VARY[((n % N) + N) % N], vb = WALK_VARY[(((n + 1) % N) + N) % N];
  const vary = (j: number): number => va[j] + (vb[j] - va[j]) * into;
  // Leg 0's stride, from its heel strike; and the step, from either's.
  const u0 = frac(phi / TAU - 0.25);
  const step = frac(2 * u0);
  // Leaning into the run from the ankles, the hips tipped with the body: the back bent forward over them instead opened a gap
  // between the coat and the belt behind, and the trousers showed in it.
  const tip = -L(1, 10);
  const down = L(WALK_DOWN, RUN_DOWN);
  // The keyed leg at `u` of its stride: [thigh from upright, knee, toe up].
  const keyed = (u: number): number[] => {
    const w = loop(WALK_LEG, u), n = loop(RUN_LEG, u);
    return [L(w[0], n[0]), L(w[1], n[1]), L(w[2], n[2])];
  };
  // The hips turn with the leading leg (see below), which carries each hip forward and back.
  const hipsAt = (u: number): number => -(L(6, 9) + vary(2)) * Math.cos(TAU * u);
  const hipY = (k: number, u: number): number => (k ? 1 : -1) * fr.hi * Math.sin(hipsAt(u) * DEG);
  // A point of the sole, from the ankle, with the foot tipped `a` toe up: along the way of going, and up.
  const sole = (p: V3, a: number): Pt => [p[1] * Math.cos(a * DEG) - p[2] * Math.sin(a * DEG), p[1] * Math.sin(a * DEG) + p[2] * Math.cos(a * DEG)];
  const ankleY = (q: number[]): number => A * Math.sin(q[0] * DEG) + B * Math.sin((q[0] - q[1]) * DEG);
  const HEEL = SOLE[0], TOE: V3 = [0, SOLE[2][1], SOLE[0][2]];
  // Where the heel comes down, from the hip, and how far the ground goes back under the body in a stride: from there to where the
  // toe leaves it, keyed, with the sole between.
  const strike = keyed(0), off = keyed(down);
  const heel0 = ankleY(strike) + sole(HEEL, strike[2])[0];
  const pace = (heel0 + (TOE[1] - HEEL[1]) - ankleY(off) - sole(TOE, off[2])[0]) / down;
  // The body carried on a curve rather than stood on whichever foot is lowest, which jolts: how far the hips are let down, here.
  const H0 = A + B - HEEL[2], heavy = 1 + vary(5);
  // How square on to the viewer, in front or behind, the body is seen, at a run (see `RUN_FRONT`, `RUN_BOB`).
  const front = g * Math.max(0, Math.min(1, (Math.abs(Math.cos(facing * 45 * DEG)) - 0.5) / 0.5));
  let H = H0 - heavy * L(loop(WALK_DROP, step)[0], loop(RUN_DROP, step)[0]) - front * RUN_BOB[0] * (0.5 + 0.5 * Math.cos(TAU * (step - RUN_BOB[1])));
  // Where a foot on the ground has its ankle, from the hip, with the hips `h` up: the heel it rolls over on the track while the
  // toe is up, the toe once the heel has lifted.
  // The hips dropped on one side (see below) put that hip lower, and with the leg turned out from them the sole's outer edge too.
  const drop = L(4, 3) * Math.sin(TAU * (u0 + 0.05));
  const ankleOf = (k: number, u: number, a: number, h: number): Pt => {
    const s = k ? 1 : -1, tilt = (drop - s * L(2.5, 1.2)) * DEG;
    const y = hipY(k, 0) + heel0 - pace * u - hipY(k, u);
    const [py, pz] = a >= 0 ? sole(HEEL, a) : sole(TOE, a);
    // Down the leg's own plane, which the hips' roll and the leg's turn out of them tip from upright.
    return [y + (a >= 0 ? 0 : TOE[1] - HEEL[1]) - py, (-h + s * fr.hi * Math.sin(drop * DEG) - pz + SOLE[1][0] * Math.abs(Math.sin(tilt))) / Math.cos(tilt)];
  };
  const reach = 0.998 * (A + B);
  // On the ground from the heel strike to the toe leaving it, the weight coming on and going off over a few hundredths.
  const onOf = (early: number): number => ramp(early, -L(0.04, 0.08), L(0.02, 0.04)) * (1 - ramp(early, down - 0.07, down));
  const legs = [0, 1].map((k) => {
    // Its stride, counted from a little before the heel comes down so the weight can come onto it as it lands.
    const u = frac(u0 + k / 2), early = u > 0.8 ? u - 1 : u;
    return { u: early, q: keyed(u), on: onOf(early) };
  });
  /*
   * Never higher than a foot on the ground reaches with its knee all but
   * straight, which would leave it standing on nothing: let down smoothly
   * toward that rather than stopped at it in a kink -- and, coming down to
   * land, let down toward it from before the foot is down, as a body falling
   * onto a leg is, rather than as the weight came on in a frame: at a run that
   * dropped the hips a third of a unit in one frame, onto the foot.
   */
  const short = (k: number, w: number, h: number): number => {
    const u = frac(w + k / 2), early = u > 0.8 ? u - 1 : u, on = onOf(early);
    if (on <= 0) return 0;
    const [y, z] = ankleOf(k, early, keyed(u)[2], h);
    const by = -z - Math.sqrt(Math.max(0, reach * reach - y * y));
    return by > -0.06 ? on * (by > 0.06 ? by : ((by + 0.06) * (by + 0.06)) / 0.24) : 0;
  };
  {
    const at = (w: number): number => {
      const s = frac(2 * w), h = H0 - heavy * L(loop(WALK_DROP, s)[0], loop(RUN_DROP, s)[0]);
      return Math.max(short(0, w, h), short(1, w, h));
    };
    const d = L(0, 0.035);
    H -= d > 0 ? 0.25 * at(u0 - d) + 0.5 * at(u0) + 0.25 * at(u0 + d) : at(u0);
  }
  // The hips turn with the leading leg, and drop on the side whose leg is off the ground, most just after the other heel takes the
  // weight; the body goes over the foot it is on, most of a hand's breadth to each side at a walk. The back takes the hips' turn and
  // drop back out, so the lean is along the way of going and the shoulders turn against the hips from square.
  const hips = hipsAt(u0);
  r.pelvis = [tip, drop, hips];
  r.at = [-L(0.3, 0.12) * Math.sin(TAU * (u0 - 0.02)), 0, 0];
  /*
   * The legs put where the feet go, in the round. The ankle was solved in
   * the leg's own fore-and-aft plane alone, which the hips' turn swings
   * from side to side: a planted foot twisted seven degrees either way and
   * its ball skated a hand's breadth across the ground under every step.
   * Now each foot has a line along the ground -- out to its own side, a
   * little wider at a walk than at a run -- and is turned out a few
   * degrees, and the ankle is put on that line in three dimensions from
   * wherever the hips are, the leg turned against the hips' turn so the
   * foot keeps pointing the same way: on the ground, at the even pace the
   * keys imply; in the air, where the keyed thigh and knee carry it.
   */
  const pelvisXf = joint(ROOT, [r.at[0], r.at[1], HIP * T], ...r.pelvis);
  const ground = HIP * T - 0.1 - H;
  r.plant = [0, 0];
  for (let k = 0; k < 2; k++) {
    const { u, q, on } = legs[k];
    const s = k ? 1 : -1;
    // A degree and a half more out on the left than the right: nobody's two feet are the same.
    const out = L(5, 2) + (k ? 0 : 1.5), yaw = -s * out;
    const lineX = s * (fr.hi + L(0.28, 0.1));
    r.leg[k] = [0, 0, -out - s * hips];
    // In the air: the keyed thigh and knee from the hip -- seen from in front or behind at a run, the shin let down and the foot
    // carried out to the side (see `RUN_FRONT`).
    const hip = place(pelvisXf, [s * fr.hi, 0, -0.1]);
    const wide = front * (1 - on) * Math.sin(Math.PI * Math.max(0, Math.min(1, (u - down) / (1 - down))));
    const thigh = q[0] + Math.min(Math.max(0, RUN_FRONT[3] - q[0]), RUN_FRONT[2] * front * (1 - on) * Math.sin(Math.PI * Math.max(0, Math.min(1, (u - 0.45) / 0.52))));
    const knee = q[1] + (thigh - q[0]) - front * (1 - on) * ramp(thigh, RUN_FRONT[4], RUN_FRONT[5]) * Math.max(0, q[1] - q[0] - RUN_FRONT[0]);
    /*
     * Taken up from where the toe left the ground, and eased back onto the keyed swing by the next heel strike. The track the foot
     * goes back along on the ground is the ground's, and the hips' turn carries the hip forward and back over it; the keyed leg in
     * the air goes from the hip, so as the weight came off the toe it was blended toward a foot a fifth or a quarter of a unit
     * behind it, and the toe slid back that far as it lifted, jogging and running.
     */
    const uu = u < 0 ? u + 1 : u, lag = hipY(k, down) - hipY(k, 0);
    const taken = uu <= down ? ramp(uu, 0.02, down - 0.08) : 1 - ease((uu - down) / (1 - down));
    const air: V3 = [lineX + s * RUN_FRONT[1] * wide, hip[1] + A * Math.sin(thigh * DEG) + B * Math.sin((thigh - knee) * DEG) - lag * taken, hip[2] - A * Math.cos(thigh * DEG) - B * Math.cos((thigh - knee) * DEG)];
    let at = air;
    if (on > 0) {
      // On the ground: the heel it rolls over on the track while the toe is up, the toe once the heel has lifted.
      const a = q[2];
      const [py, pz] = a >= 0 ? sole(HEEL, a) : sole(TOE, a);
      const down: V3 = [lineX, hipY(k, 0) + heel0 - pace * u + (a >= 0 ? 0 : TOE[1] - HEEL[1]) - py, ground - pz];
      at = [air[0] + on * (down[0] - air[0]), air[1] + on * (down[1] - air[1]), air[2] + on * (down[2] - air[2])];
    }
    r.foot[k] = q[2];
    plant(r, fr, k, at);
    // The leg rolled out from the hips tips a foot peeling up off its heel round toward the other: turned back by however far it is.
    let miss = footYaw(r, fr, k) - yaw;
    miss -= 360 * Math.round(miss / 360);
    r.leg[k][2] -= s * miss;
    plant(r, fr, k, at);
    r.plant[k] = on;
    // The arm against the leg, so with the other leg: forward as that heel comes down, a moment behind it, and the forearm a moment
    // behind the upper arm again -- still folding forward as the arm starts back, and opening behind as it starts forward.
    const v = frac(u + 0.5);
    const swing = Math.cos(TAU * (v - L(0.04, 0.03) - vary(8)));
    const follow = Math.cos(TAU * (v - L(0.12, 0.06) - vary(8)));
    const fore = Math.max(0, swing);
    // The right arm swings a little further than the left, as most people's does.
    const reach = (k ? 1.08 : 1) + vary(k);
    /*
     * Swung in across the body a little as it comes forward, and the
     * shoulder lifted with it, rather than straight fore and aft like a
     * pendulum: seen from in front or behind, that was two tubes hanging
     * still. At a run the elbow is keyed against the shoulder -- most bent
     * with the arm forward and the fist up at the chest, opening as it goes
     * back -- and the shoulder goes no further forward than puts the fist
     * there; how far the elbow is bent comes in with the square of the
     * gait, so half way to a run is not a pair of forearms held up still.
     * Walking, the elbow is bent a quarter of a right angle at rest and
     * half of one coming forward, so the forearm comes up off the line of the
     * thigh and in across the body: bent less, in armour at the size the
     * island is played at the arms were two tubes against the body.
     */
    // Walking, back further than forward and out from the side as it goes, the elbow kept a little bent: back by less, and out by a
    // third as much, from in front and behind in plate and scale the hand never came out past the hip's outline (a woman's, in
    // none of 64 moments; now in a third of them) and the arms read as two tubes beside the body. And coming forward in across the
    // belt, and at a run the fist across toward the bottom of the breastbone: from in front in mail the arms otherwise kept inside
    // the body's outline; swung up as far as a walking arm, the forearm lay level across the chest and read as a hand on the heart.
    const back = Math.max(0, -swing);
    r.arm[k] = [L(3, 4) + reach * (swing > 0 ? L(27, 23) : L(34, 34)) * swing, L(6, 9) + vary(6) - L(16, 12) * fore + L(20, 0) * back, L(3, 16) + L(4, 14) * fore];
    r.elbow[k] = WALK_ELBOW[0] + vary(3) + L(8, 0) * back + WALK_ELBOW[1] * Math.max(0, follow) + g * g * (84 - WALK_ELBOW[0] + 24 * follow - WALK_ELBOW[1] * Math.max(0, follow));
    r.shrug[k] = L(0.14, 0.24) * fore;
    // The hand hanging loose trails the swing walking; curling closed with the gait into a fist at a run, it goes with the forearm,
    // turning knuckles-out as it comes forward and back as it goes back, rather than a piston's end.
    r.hand[k] = [L(10, 2) * Math.cos(TAU * (v - 0.22)), 0, -s * 8 * g * swing];
    r.loose[k] = true;
    r.curl[k] = g;
  }
  // At a run the body gives forward a little at each landing, sunk on the knee, and comes up straight off the toe.
  const give = L(0.5, 1.5) * (0.5 - 0.5 * Math.cos(TAU * Math.min(1, step / L(0.6, 0.64))));
  r.spine = [-L(2, 1) - give - vary(9), -0.6 * drop, -hips];
  const turn = (L(6, 13) + vary(7)) * Math.cos(TAU * (u0 - 0.03));
  // And the shoulders roll against the hips, more at a run, where the arms drive.
  r.chest = [-L(0.5, 1), -0.25 * drop + L(0.6, 1.6) * Math.sin(TAU * (u0 + 0.05)), turn];
  // The head held level and looking ahead, the neck taking most of what the body under it turns and tips.
  const pitch = tip + r.spine[0] + r.chest[0], roll = drop + r.spine[1] + r.chest[1];
  const ahead = -L(1, 3) - pitch;
  r.neck = [0.6 * ahead, -0.6 * roll, -0.55 * turn + 0.4 * vary(4)];
  r.head = [0.4 * ahead, -0.4 * roll, -0.38 * turn + 0.6 * vary(4)];
  // Carried at that height, the feet that are down kept on the ground by their knees for whatever the hips' roll leaves (`plantFoot`).
  r.hover = { h: H - H0, w: 1, thigh: 0, knee: 0, g };
  // Hair that hangs bouncing with the steps, and streaming out behind at a run.
  r.tail = [L(8, 30) + L(5, 9) * Math.sin(TAU * (step - 0.25)), 5 * Math.sin(TAU * u0), 0];
}

/**
 * An arm put where its hand is wanted rather than joint by joint: the wrist
 * to `to` with the elbow out toward `pole`, both in the hips' frame, so a
 * hand on something stays on it however the body above the hips moves. Out
 * of reach, it reaches as far as it goes toward the place. Given `haft`, the
 * hand turns so what it grips runs that way through the fist, with the
 * fingers as near the line of the forearm as that allows. Returns the
 * wrist's frame in the hips' frame, for finding what is in the hand.
 */
function hold(r: Rig, fr: Frame, k: number, to: V3, pole: V3, haft?: V3): Xf {
  const T = fr.tall, s = k ? 1 : -1;
  const chest = joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const c = chest.m;
  // From the hips' frame into the chest's, which the arm hangs from.
  const into = (v: V3): V3 => [c[0] * v[0] + c[3] * v[1] + c[6] * v[2], c[1] * v[0] + c[4] * v[1] + c[7] * v[2], c[2] * v[0] + c[5] * v[1] + c[8] * v[2]];
  const S: V3 = [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]];
  const W = into([to[0] - chest.t[0], to[1] - chest.t[1], to[2] - chest.t[2]]);
  const a = UPPER * T, b = LOWER * T;
  const n = unit([W[0] - S[0], W[1] - S[1], W[2] - S[2]]);
  const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, Math.hypot(W[0] - S[0], W[1] - S[1], W[2] - S[2])));
  const q = into(pole), qn = dot(q, n);
  const p = unit([q[0] - n[0] * qn, q[1] - n[1] * qn, q[2] - n[2] * qn]);
  // The upper arm out of the line to the wrist, toward the pole, as far as the two bones need to meet.
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const u: V3 = [n[0] * ca + p[0] * sa, n[1] * ca + p[1] * sa, n[2] * ca + p[2] * sa];
  const f = unit([n[0] * d - u[0] * a, n[1] * d - u[1] * a, n[2] * d - u[2] * a]);
  // The upper arm's frame -- x the elbow's hinge, z back up the arm -- and the pitch, roll and yaw that turn it so, undone in the order a joint does them.
  const x = unit(cross(p, n)), z: V3 = [-u[0], -u[1], -u[2]], y = cross(z, x);
  r.arm[k] = [Math.atan2(y[2], z[2]) / DEG, (s * Math.asin(Math.max(-1, Math.min(1, x[2])))) / DEG, (s * Math.atan2(x[1], x[0])) / DEG];
  const e = Math.atan2(dot(f, y), dot(f, u));
  r.elbow[k] = e / DEG;
  // The forearm's frame.
  const ce = Math.cos(e), se = Math.sin(e);
  const yf: V3 = [y[0] * ce + z[0] * se, y[1] * ce + z[1] * se, y[2] * ce + z[2] * se];
  const zf: V3 = [z[0] * ce - y[0] * se, z[1] * ce - y[1] * se, z[2] * ce - y[2] * se];
  let hx: V3, hy: V3, hz: V3;
  if (haft) {
    // The haft through the fist along the hand's y, the fingers down its z as near the forearm's way as square to the haft lets them.
    hy = unit(into(haft));
    const fd = dot(f, hy);
    hz = unit([hy[0] * fd - f[0], hy[1] * fd - f[1], hy[2] * fd - f[2]]);
    hx = cross(hy, hz);
    const g = (v: V3, w: V3): number => dot(v, w);
    r.hand[k] = [Math.atan2(g(zf, hy), g(zf, hz)) / DEG, Math.asin(Math.max(-1, Math.min(1, -g(zf, hx)))) / DEG, Math.atan2(g(yf, hx), g(x, hx)) / DEG];
  } else {
    const h = joint({ m: [x[0], yf[0], zf[0], x[1], yf[1], zf[1], x[2], yf[2], zf[2]], t: [0, 0, 0] }, [0, 0, 0], ...r.hand[k]).m;
    hx = [h[0], h[3], h[6]];
    hy = [h[1], h[4], h[7]];
    hz = [h[2], h[5], h[8]];
  }
  // Back out into the hips' frame.
  const wc: V3 = [S[0] + u[0] * a + f[0] * b, S[1] + u[1] * a + f[1] * b, S[2] + u[2] * a + f[2] * b];
  return { m: mm(c, [hx[0], hy[0], hz[0], hx[1], hy[1], hz[1], hx[2], hy[2], hz[2]]), t: place(chest, wc) };
}

/** A key of a motion that loops: `at` of the way round, the values there, and whether it is a blow landing -- arrived at full speed and left from still. */
interface Key { at: number; v: number[]; hit?: boolean }

/** Where a looping motion is `s` of the way round, curved smoothly through its keys (which run in order from nought). */
function loop(keys: Key[], s: number): number[] {
  const n = keys.length;
  const t = (i: number): number => keys[((i % n) + n) % n].at + Math.floor(i / n);
  const v = (i: number): number[] => keys[((i % n) + n) % n].v;
  let i = n - 1;
  while (i > 0 && keys[i].at > s) i--;
  const h = t(i + 1) - t(i), u = (s - t(i)) / h;
  // How fast each value is changing at a key, per whole turn of the loop.
  const rate = (j: number, into: boolean): number[] => {
    const key = keys[((j % n) + n) % n];
    if (key.hit && !into) return v(j).map(() => 0);
    if (key.hit) return v(j).map((x, m) => (2 * (x - v(j - 1)[m])) / (t(j) - t(j - 1)));
    return v(j).map((_, m) => (v(j + 1)[m] - v(j - 1)[m]) / (t(j + 1) - t(j - 1)));
  };
  const m0 = rate(i, false), m1 = rate(i + 1, true);
  const u2 = u * u, u3 = u2 * u;
  return v(i).map((a, m) => (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * h * m0[m] + (-2 * u3 + 3 * u2) * v(i + 1)[m] + (u3 - u2) * h * m1[m]);
}

/** Where a mallet's head is and a chisel's top, in the frame of the hand holding it. */
const MALLET_HEAD: V3 = [0, 2.25, GRIP];
const CHISEL_TOP: V3 = [0, 0.95, GRIP];

/*
 * The mallet hand through a blow, in the hips' frame: where the wrist is,
 * which way the elbow points, and which way the haft runs. It lands at
 * nought (that key is filled in by `work`, from wherever the chisel is),
 * bounces and settles; then is drawn up from the elbow, the forearm folding
 * back as the upper arm rises, until the wrist is beside the ear and a little
 * behind it with the elbow bent past a right angle and pointing up and out, and the
 * mallet lying back over the shoulder, its head behind the head; is held
 * there, cocked; and comes down onto the chisel in the last seventh of the
 * turn, the elbow leading and the head whipping over last. It went down past
 * the hip and up again with the arm straight, a windmill, and was held
 * straight up over the crown like a hand up in a class. Down beside the
 * head, not in front of it: the wrist out past the shoulder and no further
 * forward than the ear until it is below the chin, and only then forward and
 * in to the work. It came over and down in front of the face, the forearm
 * across the mouth seen from in front and three-quarters on, and the fist
 * over the nose side on from the left.
 */
const BLOW: Key[] = [
  { at: 0.08, v: [1.8, 3.1, 3.2, 0.5, -0.6, -0.7, -0.95, 0.15, 0.35] },
  { at: 0.2, v: [1.8, 3.2, 2.8, 0.4, -0.6, -0.8, -1, 0.15, 0.12] },
  { at: 0.27, v: [3.0, 1.5, 2.5, 0.65, -0.4, -0.6, -0.6, -0.1, 0.8] },
  { at: 0.34, v: [3.1, 1.2, 3.9, 0.9, -0.2, -0.4, -0.2, 0.6, 0.75] },
  { at: 0.48, v: [3.1, -0.4, 5.7, 0.9, 0.3, 0.2, 0, -0.1, 1] },
  { at: 0.6, v: [3.1, -0.6, 6.35, 0.85, 0.35, 0.45, -0.05, -0.65, 0.75] },
  { at: 0.72, v: [3.2, -0.82, 6.5, 0.85, 0.3, 0.45, -0.05, -0.85, 0.5] },
  { at: 0.86, v: [3.25, -1.0, 6.7, 0.85, 0.3, 0.45, -0.05, -0.97, 0.22] },
  { at: 0.92, v: [3.3, -0.5, 6.3, 0.8, 0.5, 0.1, 0.1, -0.7, 0.7] },
  { at: 0.955, v: [3.3, -0.2, 4.6, 0.8, -0.3, -0.5, 0.15, -0.15, 0.98] },
  { at: 0.98, v: [2.8, 1.2, 2.4, 0.5, -0.6, -0.7, -0.3, 0.5, 0.8] },
];
/*
 * At the top the arm was held dead still: the three keys there were within a
 * quarter of a unit of one another, and a third of a second of every second
 * the arm was frozen, a pause and then a hit. Now the cock loads through it --
 * the wrist creeping back and up and the head of the mallet tipping further
 * back over the shoulder -- until the blow comes down. And on the draw up the
 * fist goes out from the work to the side first and rises beside the shoulder,
 * out and back of it: brought forward at the height of the chest first, the
 * mallet's head went up past the mouth and chin.
 */
/** How far into a blow, after it lands, work may change hands: see `settle`. */
const WORK_SWAP = 0.12;
/**
 * Where the mallet is held up instead of cocked behind the ear while the hand
 * it is in is the far one from where it is seen -- after a turn onto a
 * facing that works the other way (see `lefty`), until the next blow lands
 * and the hands change: out beside the chest, below the shoulder, in the hips'
 * frame as `BLOW` has it, the mallet lying back as it does cocked. Cocked behind the ear with the far arm, the forearm
 * lay across the brow and the mallet over the crown, a hand on the forehead,
 * for up to half a second every time the body turned that way at work; and
 * with the haft as the blow had it, the mallet stood up from the fist beside
 * the cheek as it began to fall.
 */
const FAR_COCK = [3.4, 0.9, 2.5, 0.8, 0.1, -0.6, -0.05, -0.97, 0.22];
/** Seconds the mallet hand takes to come down to `FAR_COCK` once a turn makes it the far one: see `settle`. */
const FAR_DOWN = 0.2;
/** Which facings work is done left-handed at, for easing between them as the body turns (see `lefty`). */
const LEFTY = [0, 0, 0, 1, 0, 0, 0, 1];

/** Where the ankles stand at work: apart, the left forward under the work and the right back and turned out, braced for the blow. */
function workFeet(fr: Frame): [V3, V3] {
  const z = stance(fr)[0][2];
  return [[-(fr.hi + 0.6), 0.95, z], [fr.hi + 0.75, -0.55, z]];
}

/**
 * At work with a mallet and chisel: the chisel held upright in the left
 * hand at the belt, and the mallet in the right swung up round behind the
 * head and brought down over it onto the top of the chisel. The body rises
 * and turns the right shoulder back as the mallet goes up, the weight going
 * back onto the right foot and the hips with it, and turns and bends into
 * the blow with the weight driven onto the left, which jolts through both
 * hands and the knees; the feet stay planted and the work stays where it is
 * through all of it, and the head stays down over the work: bowed, back,
 * neck and head together, under twenty degrees, which leaves the face to be
 * seen from above and in front -- bowed as far as the eyes would need, over
 * thirty, it was a crown over a chest, and a cap or a helm hid the face. Seen from where the right hand's swing would come across
 * the face, it is done the other way about, left-handed (`left`, see `lefty`).
 */
function work(r: Rig, w: number, fr: Frame, left: boolean, far = 0): void {
  const s = (((w / TAU) % 1) + 1) % 1;
  const T = fr.tall;
  r.tool = true;
  // How high the mallet is, near enough: nought as it lands, one held up at the top.
  const up = s < 0.2 ? 0.12 * Math.sin((Math.PI * s) / 0.2) : s < 0.7 ? ease((s - 0.2) / 0.5) : s < 0.86 ? 1 : 1 - Math.pow((s - 0.86) / 0.14, 2);
  const jolt = s < 0.25 ? Math.pow(1 - s / 0.25, 2) : 0;
  // The weight back on the right foot as the mallet goes up, and driven onto the left, the forward one, into the blow.
  const on = -0.65 + 1.25 * up - 0.25 * jolt;
  // The hips go with the weight, and turn the right side back with the mallet and round again into the blow.
  r.pelvis = [-3, -3 * on, 3 - 9 * up + 2 * jolt];
  r.at = [0.3 * on, -0.35 * on, 0];
  r.spine = [-9 + 4 * up - 2.5 * jolt, 1.5 * on, 0];
  r.chest = [-4 + 3 * up - jolt, -2 * up, 4 - 7 * up - 2 * jolt];
  r.neck = [-3 + 2 * up, 0, -3 + 5 * up];
  r.head = [-4 + up + 1.5 * jolt, 0, -2 + 3 * up];
  // Feet planted apart, the left forward under the work and the right back, and the knees giving a little more to each blow.
  const feet = workFeet(fr);
  r.leg = [[0, 0, -4], [0, 0, -16]];
  standOn(r, fr, feet, on, 9 + 7 * jolt);
  /*
   * The chisel, stood on the work at the belt and jolted down by each blow.
   * The work does not move as the hips sway and turn over it, so the chisel
   * is put where it is in the world -- where it was in front of the hips
   * stood square -- and found in the hips' frame from there.
   */
  const pelvis = joint(ROOT, [r.at[0], r.at[1], HIP * T + r.at[2]], ...r.pelvis), pm = pelvis.m;
  const into = (v: V3): V3 => [pm[0] * v[0] + pm[3] * v[1] + pm[6] * v[2], pm[1] * v[0] + pm[4] * v[1] + pm[7] * v[2], pm[2] * v[0] + pm[5] * v[1] + pm[8] * v[2]];
  const square = HIP * T + hipsFor({ ...rest(), leg: r.leg }, fr, 1, feet[1], 9);
  const bench: V3 = [-0.6 * T, 3.6 * T, square + (1.05 - 0.12 * jolt) * T];
  const chisel = hold(r, fr, 0, into([bench[0] - pelvis.t[0], bench[1] - pelvis.t[1], bench[2] - pelvis.t[2]]), into([-1, -0.3, -0.8]), into([0.1, 0.2, 1]));
  const top = place(chisel, CHISEL_TOP);
  // The wrist that puts the mallet's head on the chisel's top, found by moving it by however far the head misses, a few times over.
  const haft: V3 = [-1, 0.15, 0];
  let wrist: V3 = [top[0] + 2.2 * T, top[1] - 0.9 * T, top[2] + 0.5 * T];
  for (let q = 0; q < 3; q++) {
    const head = place(hold(r, fr, 1, wrist, [0.4, -0.6, -0.8], haft), MALLET_HEAD);
    wrist = [wrist[0] + top[0] - head[0], wrist[1] + top[1] - head[1], wrist[2] + top[2] + 0.5 * T - head[2]];
  }
  const k = loop([{ at: 0, v: [wrist[0] / T, wrist[1] / T, wrist[2] / T, 0.4, -0.6, -0.8, ...haft], hit: true }, ...BLOW], s);
  // The far hand held up beside the shoulder rather than cocked behind the head, the elbow out and down, by as much as it is up
  // and the far one --
  // and down. The elbow's way out at each end taken round with the arm to where it is between, and turned from the one to the
  // other about it (`swivel`): blended as they stood, each came into line with the arm somewhere between, raised behind the head
  // and coming down beside it, and the elbow went round two units in a frame.
  // Held there through the start of the blow too, coming down onto the chisel from beside the chest only over the last twentieth
  // of the turn: let back to the blow's own way as the mallet fell, the far hand rose to behind the ear first and the mallet stood
  // up beside the cheek.
  const fall = s < 0.86 ? up : 1 - ease(Math.max(0, Math.min(1, (s - 0.955) / 0.045)));
  const low = far * Math.min(1, Math.max(0, fall));
  const at: V3 = [k[0] * T, k[1] * T, k[2] * T], down: V3 = [FAR_COCK[0] * T, FAR_COCK[1] * T, FAR_COCK[2] * T];
  const wr: V3 = [at[0] + (down[0] - at[0]) * low, at[1] + (down[1] - at[1]) * low, at[2] + (down[2] - at[2]) * low];
  const sh = place(joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest), [2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[1]]);
  const pole = low > 0 ? swivel(sh, wr, carriedWay(sh, at, [k[3], k[4], k[5]], wr), carriedWay(sh, down, [FAR_COCK[3], FAR_COCK[4], FAR_COCK[5]], wr), low) : ([k[3], k[4], k[5]] as V3);
  hold(r, fr, 1, wr, pole, [0, 1, 2].map((j) => k[6 + j] + (FAR_COCK[6 + j] - k[6 + j]) * low) as V3);
  if (left) mirror(r);
}

/** Whether work is done left-handed from where it is seen: see `work`. */
const lefty = (facing: number): boolean => {
  const f = ((Math.round(facing) % 8) + 8) % 8;
  return f === 3 || f === 7;
};

/** How far a swimmer is in the water: to the chest. Going in and coming out are blended by how much of this they are in. */
const SINK = 10.2;

/*
 * Swimming. The body was stood upright and let down to the chest, the arms
 * waving over the water, and the picture cut off flat along the screen at
 * the feet: whatever of the body was nearer the viewer than the feet and
 * above the water was cut away with what was under it, and whatever was
 * further off and under it showed. Now the water is a level in the body's
 * own space and every facet is cut at it (`waterline`): what is over it is
 * drawn, what is under it is drawn faintly through the water, and where the
 * two meet the water rings the body. So a swimmer can lie in the water as a
 * swimmer does, and the stroke under the surface shows as it would.
 *
 * Under way, breaststroke: from the glide, arms out ahead and legs out
 * behind, the hands sweep out and round and in under the chin while the
 * head and shoulders come up to breathe; the knees draw up as the hands
 * come in, the hands shoot forward, and the legs whip round and together
 * behind, which drives the body on into the next glide. One stroke to
 * every `SWIM_STROKE` of the walk's phase, which goes as fast as the
 * swimmer does, so a better swimmer strokes faster. Stopped, treading
 * water: upright, the hands sculling flat under the surface out to the
 * sides and the legs turning over in turn under the body, the head bobbing
 * a little with each sweep.
 */
/** Walk-phase radians to a stroke: a stroke every second and a quarter at an unskilled swimmer's pace. */
export const SWIM_STROKE = TAU / 0.9;
/** Radians of the idle clock (six to a second) to one sweep of the hands treading water: one every second and three-quarters. */
export const TREAD_RATE = 0.6;
/**
 * How high the head is held over the water treading it, in the middle of its bob, from the front or the back: the tops of
 * the shoulders break the surface at the top of each kick. Lowered to 0.62 for the stalk side on, it put them under at
 * every phase front and back, where there was no stalk, and the beat of the kick went with them; side on the ceiling in
 * `shouldersUnder` took the drop back. Side on is let down on its own (`TREAD_SIDE_SINK`).
 */
const TREAD_FLOAT = 0.8;
/** How far out past the shoulder a hand sculls treading water, at the middle of its sweep. */
const TREAD_REACH = 1.5;

/**
 * Breaststroke, a stroke from the start of the glide: [the body's lean (pelvis),
 * the back arched up against it (spine and chest each), where the wrists
 * are -- across from the middle, ahead of the head and up from the surface
 * (`swimHand`) -- which way the elbows go, out and up, the hand's turn, the
 * thigh's forward/out, the knee, the foot pointed, and the head's height
 * over the water].
 *
 * The hands were keyed as the arm's angles, and in between keys they went
 * where the angles took them: up out of the water and together in front of
 * the face, as if praying, while the head came up. Keyed where they are,
 * they sweep out wide under the surface, come in under the chin at it as
 * the head comes up to breathe -- a head's height, which reads at any zoom
 * -- and shoot forward under it into the glide.
 *
 * At the out-sweep the wrists were barely under the surface with the elbows
 * level, so both arms lay straight out on it to the sides, the one the
 * mirror of the other, a foam ring round each: from in front or behind, a
 * scarecrow. Now the sweep is a forearm's depth under, the elbows let down
 * under the line of the arm so that it bends, and one arm runs a few hundredths of a
 * stroke ahead of the other (`ARM_LEAD`), as no two arms are ever quite together.
 *
 * That was still a bar of shirt along the surface from behind: a hundredth and
 * a half of a stroke between the arms is a sixtieth of a second, and the upper
 * arms lay on the water. Now the elbows at the out-sweep go down into it, so
 * the upper arm slants down through the surface, and the arms are four
 * hundredths apart and do not set their elbows quite alike (`ELBOW_ODD`).
 *
 * In under the chin the wrists were under the surface by less than a hand is
 * long, and turned up there the hand stood out of the water by the jaw with its
 * fingers up, seen side on. Now they come in a forearm's depth under, as
 * `HANDS_UNDER` keeps them setting off, and the hand under the water with them.
 */
const BREAST: Key[] = [
  { at: 0, v: [-62, 7, 0.5, 5.6, -1.6, 1, -0.2, -20, 2, 3, 6, -30, 0.1] },
  { at: 0.14, v: [-60, 8, 2.3, 5.0, -1.45, 1, -0.5, -30, 2, 5, 6, -30, 0.2] },
  { at: 0.28, v: [-52, 10, 3.2, 2.7, -1.25, 1, -0.8, -10, 6, 7, 14, -24, 0.75] },
  { at: 0.4, v: [-44, 12, 0.8, 1.4, -0.75, 1, 0.2, 30, 26, 12, 70, 10, 1.6] },
  { at: 0.52, v: [-54, 10, 0.4, 3.4, -0.85, 1, -0.4, 10, 40, 24, 112, 22, 0.35] },
  { at: 0.64, v: [-60, 8, 0.45, 5.4, -1.4, 1, -0.2, -10, 12, 22, 46, -10, 0.12] },
  { at: 0.76, v: [-62, 7, 0.5, 5.6, -1.6, 1, -0.2, -20, 2, 5, 8, -30, 0.1] },
];

/**
 * Put a swimmer's wrist `k` at `at` -- across from the body's middle (out to
 * its own side), ahead of the head, and up from the surface of the water --
 * the elbow toward `pole` (out to its own side, back, up), both in the body's
 * frame. The water is where the head's `float` says it is, so a hand put at
 * the surface stays there however the body bobs or leans under it.
 */
function swimHand(r: Rig, fr: Frame, k: number, at: V3, pole: V3): void {
  const T = fr.tall, s = k ? 1 : -1;
  const pelvis = joint(ROOT, [r.at[0], r.at[1], HIP * T + r.at[2]], ...r.pelvis);
  const chest = joint(joint(pelvis, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const head = joint(joint(chest, [0, -0.08, NECK * T], ...r.neck), [0, 0.06, HEADJ], ...r.head).t;
  const water = head[2] - (r.float ?? 0);
  const m = pelvis.m;
  // Into the hips' own frame, which `hold` works in.
  const into = (v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const w: V3 = [s * at[0] - pelvis.t[0], head[1] + at[1] - pelvis.t[1], water + at[2] - pelvis.t[2]];
  hold(r, fr, k, into(w), into([s * pole[0], pole[1], pole[2]]));
}

/**
 * Turn hand `k` at the wrist, and about the forearm, so its fingers run as
 * near `fingers` and the back of the hand faces as near `back` as a wrist
 * goes, both in the body's frame: found a few turns at a time from where it
 * is, coarse and then fine. A hand that only followed the forearm went up out
 * of the water wherever the forearm rose to it, waving.
 */
function aimHand(r: Rig, fr: Frame, k: number, fingers: V3, back: V3): void {
  const T = fr.tall, s = k ? 1 : -1;
  const chest = joint(joint(joint(ROOT, [0, 0, 0], ...r.pelvis), [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const [ap, aa, at] = r.arm[k];
  const elbow = joint(joint(chest, [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]], ap, -s * aa, s * at), [0, 0, -UPPER * T], r.elbow[k]);
  const f = unit(fingers), n = unit(back);
  const score = (h: Euler): number => {
    const m = joint(elbow, [0, 0, 0], ...h).m;
    // The fingers down the hand's -z; the back of it out its x on the hand's own side.
    return -(m[2] * f[0] + m[5] * f[1] + m[8] * f[2]) + s * (m[0] * n[0] + m[3] * n[1] + m[6] * n[2]);
  };
  const most: Euler = [70, 35, 100];
  const h: Euler = [...r.hand[k]];
  let best = score(h);
  for (const step of [24, 10, 4]) {
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < 3; a++) {
        for (const d of [-step, step]) {
          const was = h[a];
          h[a] = Math.max(-most[a], Math.min(most[a], was + d));
          const got = score(h);
          if (got > best) best = got;
          else h[a] = was;
        }
      }
    }
  }
  r.hand[k] = h;
}

/** How far ahead of the stroke one arm is, and behind it the other, as a share of a stroke. */
const ARM_LEAD = 0.04;
/** How much further out, and how much lower, the right elbow is set than the left, swimming: each arm has its own habit. */
const ELBOW_ODD: [number, number] = [0.18, -0.15];

function swim(r: Rig, phi: number, moving: boolean, fr: Frame, facing = 0): void {
  r.flat = [false, false];
  r.sink = SINK;
  r.under = moving ? 1 : 0;
  if (!moving) {
    tread(r, phi, fr);
    shouldersUnder(r, fr, facing, 0, TREAD_SIDE_SINK, TREAD_SIDE_DEEP);
    return;
  }
  const s = (((phi / SWIM_STROKE) % 1) + 1) % 1;
  const [lean, arch, , , , , , , lp, la, kn, ft, up] = loop(BREAST, s);
  r.pelvis = [lean, 0, 0];
  r.spine = [arch, 0, 0];
  r.chest = [arch, 0, 0];
  // The head up out of the water, looking where it is going: whatever the body's lean, the face is turned to the way ahead.
  r.neck = [-(lean + 2 * arch) * 0.62, 0, 0];
  r.head = [-(lean + 2 * arch) * 0.38 + 4, 0, 0];
  r.float = up;
  // And the hands where they were on the body: kept as deep under the water, the forearm rose to them and a hand came up by the jaw.
  const sunk = shouldersUnder(r, fr, facing, BREATH_GIVE);
  for (let k = 0; k < 2; k++) {
    // Each arm a little off the stroke the body is at: the right a touch ahead, the left a touch behind.
    const [, , ax, ay, az, apx, apz, awr] = loop(BREAST, (s + (k ? ARM_LEAD : -ARM_LEAD) + 1) % 1);
    r.hand[k] = [0, 0, awr];
    r.open[k] = 1;
    const odd = k ? 0.5 : -0.5;
    swimHand(r, fr, k, [ax, ay, az - sunk], [apx + odd * ELBOW_ODD[0], -0.2, apz + odd * ELBOW_ODD[1]]);
    r.leg[k] = [lp, la, 0];
    r.knee[k] = kn;
    r.foot[k] = ft;
  }
  r.tail = [70, 0, 0];
}

/*
 * Treading water. Nothing of it showed: the head went up and down by under a
 * pixel, and the hands and legs were all under the water. Now the hands
 * scull just under the surface, out and in, the palms turned the way they
 * push, and the body rises on each sweep -- twice to a sweep, out and in,
 * a little after the hands are going fastest, a hand's breadth -- with the
 * shoulders rolling against the legs as they turn over under it.
 */
function tread(r: Rig, phi: number, fr: Frame): void {
  const q = phi * TREAD_RATE;
  const s = Math.sin(q), c = Math.cos(q);
  r.pelvis = [-10, -2 * s, 0];
  r.spine = [-4, 2 * s, 0];
  r.chest = [2 + 1.5 * c, 4 * s, 0];
  // The head kept level over the roll, and looking about.
  r.neck = [6, -3.5 * s, 0];
  r.head = [4, -0.5 * s, 14 * Math.sin(q * 0.23)];
  /*
   * Topped out a little under the shoulders, for the top of the shirt showed in a crescent inside the foam round them: so only
   * a head on a long neck ever showed, standing up out of rings. Now that what comes up out of the water by a sliver is let up
   * gradually (`waterline`), from the front and the back the tops of the shoulders break the surface at the top of each kick
   * and go back under it, the one a little before the other as the shoulders roll: the beat of the kick at the island's zoom.
   * Side on they are kept under it and the body let down further (`shouldersUnder`), and the beat is the head's bob.
   */
  r.float = TREAD_FLOAT + 0.32 * Math.cos(2 * q - 0.6);
  // The shoulders let down a little with the arms out under the water, the tops of them under it with the arms.
  r.shrug = [-0.15, -0.15];
  for (let k = 0; k < 2; k++) {
    /*
     * The hands out to the sides just under the surface, sweeping out and in, each a little behind the other, and each
     * flat on the water and tipped the way it is going, so it pushes down on it both ways. The elbows were let straight
     * down under them, so the forearm rose steeply to the wrist and the hand, which a wrist cannot bend back flat from
     * that, stood up out of the water palm out, waving. Now the elbow goes out to the side and only a little down, the
     * forearm lies nearly level a hand's depth under, and the hand lies flat at the end of it.
     */
    const side = k ? 1 : -1, o = Math.sin(q + (k ? 0.35 : 0)), v = Math.cos(q + (k ? 0.35 : 0));
    r.open[k] = 1;
    swimHand(r, fr, k, [2.1 * fr.sh + TREAD_REACH + 0.8 * o, 1.1 + 0.35 * c, -0.75], [0.8, -0.5, -0.5]);
    aimHand(r, fr, k, [side * 0.8, 0.6, 0], [-side * 0.5 * v, 0, 1]);
    // The legs turning over in turn, as a cyclist's do: a knee up and forward while the other leg presses down.
    const w = Math.sin(q + (k * Math.PI));
    r.leg[k] = [34 + 18 * w, 18, 0];
    r.knee[k] = 64 + 26 * Math.sin(q + k * Math.PI + 1.2);
    r.foot[k] = -14;
  }
  r.tail = [40 + 6 * c, 0, 0];
}

/*
 * Treading water side on, the line across the shoulders points at you, so the top of the near shoulder breaking the
 * surface at the top of a kick is seen end on: a round cap as wide as the neck standing in the foam under the jaw, which
 * read as a ball held under the chin however it was wetted and let down. From the front or the back the same two caps
 * are a line across the root of the neck and read as shoulders. So, turned side on, the body is let up only as far as
 * keeps the tops of the shoulders under the lip of the water (`waterline`), eased into that rather than stopped at it, and
 * the head bobs by what is left.
 *
 * It came on only from past three quarters round, so the three-quarter facings had none of it and side on all of it:
 * turning from the one to the other, the body dropped by the whole of the cut between two of the eight ways. Now it comes
 * on from a little short of three quarters round, which gives those a third of it and halves the step.
 *
 * Under way the breath brought the same cap up under the jaw side on, for the ceiling was only kept treading water. Now
 * it is kept swimming too, but the head is not let down by all of it: the shoulders are let down from the neck by half
 * of what is cut (`give`), up to `BREATH_SHRUG`, and the body by the rest, so the breath still lifts the face out of the
 * water while the shoulder stays under.
 */
const SIDE_ON_FROM = 0.3;
/** What share of the cut the shoulders take, let down from the neck, swimming under way; and how far at most. */
const BREATH_GIVE = 0.5;
const BREATH_SHRUG = 0.45;
/** How far the top of the chest's round over each shoulder stands over the arm's joint, at any build: what showed side on. */
const SHOULDER_ROUND = 0.95;
/**
 * And how far under the lip it is kept: at the lip, side on, the neck stood bare out of a ring as thin as itself from the
 * shoulders to the jaw, a head on a stalk, with nothing round its root as there is from the front.
 */
const SIDE_ON_DEEP = 0.1;
/**
 * Treading water side on, how much lower the body is let down than from the front, and how much lower the ceiling over the
 * shoulders goes with it. Lowering the ceiling alone did nothing for the stalk: the bob already stood over it, so it only
 * pressed the bob flatter, and the neck stood as long out of the water at the top of it. Let down together, the whole bob
 * goes down, the water half-way up the neck, and the ceiling, lowered by a little less than the body, trims the top of the
 * bob to what it was before: the head bobs as far as it did.
 */
const TREAD_SIDE_SINK = 0.45;
const TREAD_SIDE_DEEP = 0.3;
/** How softly the bob is eased in under that ceiling: a hard stop at it was a head that rose, stuck and fell. */
const SHOULDERS_EASE = 0.12;
function shouldersUnder(r: Rig, fr: Frame, facing: number, give = 0, sink = 0, deep = 0): number {
  const side = Math.abs(Math.sin((facing * TAU) / 8));
  const w = Math.max(0, Math.min(1, (side - SIDE_ON_FROM) / (1 - SIDE_ON_FROM)));
  if (!w) return 0;
  // Let down by `sink` side on, and the ceiling `deep` further under the lip (`TREAD_SIDE_SINK`).
  r.float = (r.float ?? 0) - w * sink;
  const over = (): number => {
    const b = skeleton(fr, r);
    return Math.max(b.arm0.t[2], b.arm1.t[2]) + SHOULDER_ROUND - SHOULDER_SLIVER + SIDE_ON_DEEP + w * deep;
  };
  const soft = (x: number): number => SHOULDERS_EASE * Math.log(1 + Math.exp(x / SHOULDERS_EASE));
  const was = over();
  if (give) {
    const s = Math.min(BREATH_SHRUG, give * w * soft(was));
    r.shrug = [r.shrug[0] - s, r.shrug[1] - s];
  }
  r.float = (r.float ?? 0) - w * soft(over());
  return was - over();
}

/*
 * Driving. Sat on whatever the vehicle has to sit on (`Seat`): the box of a
 * cart or a wagon, a rowing boat's thwart, a sailing boat's stern sheets by
 * the tiller, or a saddle. The body is put on the seat and the feet on the
 * floor (`skeleton`), so it sits on the bench at every facing whatever the
 * build, and the hands go where what they hold is.
 */
/** A fist put on something sat driving (`Rig.fists`). */
export interface Fist { at: V3; haft: V3; rest?: boolean }
/** The hips' frame, sat on a seat `up` high over the floor: the underside of the thighs on it, in the body's frame from the feet. */
function hipsOn(r: Rig, up: number): Xf {
  const m = joint(ROOT, [0, 0, 0], ...r.pelvis).m;
  return { m, t: [r.at[0], r.at[1], up - m[8] * SEAT] };
}
/** Put the fist of hand `k` on a point given in the body's frame from the feet, `pole` the way the elbow goes, `haft` what it holds. */
function fistOn(r: Rig, fr: Frame, k: number, at: V3, pole: V3, haft: V3): void {
  (r.fists ??= [undefined, undefined])[k] = { at, haft };
  const { m, t } = hipsOn(r, r.sit?.up ?? 0);
  // Into the hips' own frame, which `hold` works in.
  const into = (v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const want = into([at[0] - t[0], at[1] - t[1], at[2] - t[2]]);
  const p = into(pole), h = into(haft);
  let wrist = want;
  // The wrist that puts the middle of the fist there, found by moving it by however far the fist misses, a few times over.
  for (let q = 0; q < 3; q++) {
    const fist = place(hold(r, fr, k, wrist, p, h), [0, 0, GRIP]);
    wrist = [wrist[0] + want[0] - fist[0], wrist[1] + want[1] - fist[1], wrist[2] + want[2] - fist[2]];
  }
  hold(r, fr, k, wrist, p, h);
}

/** A saddled beast's barrel under its rider, from the saddle: what the far leg is hidden behind. */
export const BARREL = { c: [0, 0, -2.4] as V3, r: [1.9, 5.5, 2.4] as V3 };

/** The box seat of a cart or wagon when nothing says otherwise: the reins out ahead to a team, the bench a hand over the boards. */
const BOX: Seat = { hands: 'reins', up: 2.7, grip: [0, 14, 5.6] };
/** What a body is sat on driving (its own seat, or a cart's box when it says none), or nothing: swimming, or not driving. */
export const seatOf = (p: FigurePose): Seat | undefined => (p.driving && !p.swimming ? p.seat ?? BOX : undefined);

function drive(r: Rig, phi: number, moving: boolean, seat: Seat, fr: Frame): void {
  r.seat = seat;
  r.sit = { up: seat.up, astride: !!seat.astride };
  r.flat = [true, true];
  if (seat.hands === 'oars') row(r, phi, moving, seat, fr);
  else if (seat.hands === 'tiller') steer(r, phi, moving, seat, fr);
  else reinsIn(r, phi, moving, seat, fr);
}

/*
 * At the reins: sat square on the box, the thighs along the bench and the
 * feet braced on the boards ahead, the forearms out level and a fist round
 * each pair of reins over the knees. Going, the team's heads nod and draw
 * the reins out and let them back, so the hands give forward and come back
 * with them, the reins going slack and taut; the cart rocks on its wheels
 * and the body sways with it from the hips, the head held level over it,
 * and every so often a rut jolts the shoulders. Stopped, the hands rest
 * out over the knees with the reins slack (on the thighs, a sculpted body's
 * knuckles went into them), and the driver breathes and looks about. On a saddle, the same hands over the withers, the legs down
 * either side of the beast with the heels down, and the body going with
 * the beast's stride.
 */
/**
 * A cart going along a track, at `phi` of the driver's clock: the team's nod,
 * once to a stride of theirs; the rock of the wheels, two swings slower than
 * that and never in step, so it is never the same twice running, the slower
 * of them on its own (`roll`); a jolt from a rut now and then; and the
 * bench's bump with each beat of the wheels, and the same a little later,
 * which is when the shoulders feel it.
 */
function rutted(phi: number): { nod: number; rock: number; roll: number; jolt: number; bump: number; after: number } {
  const roll = Math.sin(phi * 0.43 + 0.7);
  return {
    nod: Math.sin(phi * 0.5),
    rock: 0.65 * roll + 0.35 * Math.sin(phi * 1.07 + 2.1),
    roll,
    jolt: Math.pow(Math.max(0, Math.sin(phi * 0.37) * Math.sin(phi * 0.83 + 1)), 3),
    bump: Math.pow(Math.abs(Math.sin(phi * 0.5 + 0.6)), 1.5),
    after: Math.pow(Math.abs(Math.sin(phi * 0.5 + 0.1)), 1.5),
  };
}
/** How far a cart rolls on her springs with the slow swing of the rock, in degrees; her nose goes down with a rut's jolt; and lifts with each bump, in units. */
const CART_ROLL = 1.3;
const CART_PITCH = 1.2;
const CART_LIFT = 0.1;
/**
 * A cart or a wagon on the move, under the driver at `phi` of their clock, as
 * a boat's sway is (`boatSway` in `./furniture`): heeled to her right and
 * pitched nose down, in degrees, and lifted, in units. She was still while
 * her driver rocked and bumped on her, so the body gave against nothing that
 * was seen to move. Whoever draws her draws her driver through the same
 * sway, and the body's own rock is the rest of it (`reinsIn`).
 */
export function cartSway(phi: number, moving: boolean): { heel: number; pitch: number; lift: number } {
  if (!moving) return { heel: 0, pitch: 0, lift: 0 };
  const { roll, jolt, bump } = rutted(phi);
  return { heel: CART_ROLL * roll, pitch: CART_PITCH * jolt, lift: CART_LIFT * bump };
}

function reinsIn(r: Rig, phi: number, moving: boolean, seat: Seat, fr: Frame): void {
  r.reins = true;
  const t = phi / 6;
  const ride = rutted(phi);
  const nod = moving ? ride.nod : 0, rock = moving ? ride.rock : 0, jolt = moving ? ride.jolt : 0;
  const bump = moving ? ride.bump : 0, after = moving ? ride.after : 0;
  // What of the roll and the lift the cart takes under the body (`cartSway`), which the body is drawn through: not on a saddle.
  const cart = moving && !seat.astride ? 1 : 0;
  const b = Math.sin((t * TAU) / 4.2);
  if (seat.astride) {
    const k = Math.max(0, Math.min(1, seat.tuck ?? 0));
    r.leg = [[46 + 40 * k, 26 + 10 * k, -8], [46 + 40 * k, 26 + 10 * k, -8]];
    r.knee = [62 + 68 * k, 62 + 68 * k];
    r.foot = [12, 12];
    r.flat = [false, false];
    r.at = [0, 0.3, moving ? 0.12 * Math.abs(Math.sin(phi * 0.5)) : 0];
  } else {
    // The feet a little apart and turned out, the knees over them, and the feet in under the knees: further out and further
    // apart, on a wagon the boot on the near side stood on the top of the board there, seen from in front.
    r.leg = [[84, 4, -6], [84, 4, -6]];
    r.knee = [98, 98];
  }
  /*
   * Going, the body goes with the cart: it was a couple of degrees of sway
   * and a pixel of nod, which at the size the island is played at was a
   * driver sat still on a moving cart. Then it was a bump that was mostly
   * nothing, a rock that took nearly three seconds and was all taken back
   * at the head, and a jolt that hardly ever came: still a passenger sat
   * still. Now the bench bumps the body up with every beat of the wheels and
   * the shoulders give forward a beat after it; the body rocks from the hips
   * ten degrees either way, about once in a second and a half at a walk, the
   * head turning back against little more than half of it so it rocks too;
   * and a rut every few seconds throws the shoulders forward and the head
   * back.
   *
   * That rock was one pure swing, ten degrees either way: a metronome. And
   * the bump lifted the whole body most of a unit off a bench that stayed
   * where it was, a hop rather than a ride. Now the rock is two swings that
   * never fall into step, seven degrees at the most, and a rut throws the
   * body over to one side as well as forward and it settles back; the bench
   * lifts the hips a little, and the rest of the bump goes into the back,
   * which gives under it and comes up again a beat later.
   */
  // Which way a rut throws the body: one side for a while and then the other.
  // The way it changes over is a quick turn rather than a switch, so a jolt that lands just then is not thrown both ways at once.
  const kick = moving ? 3 * jolt * Math.tanh(4 * Math.sin(phi * 0.19)) : 0;
  if (moving && !seat.astride) r.lift = (0.25 - CART_LIFT) * bump + 0.1 * jolt;
  /*
   * Given how far the box is rolled this moment (`Seat.sway`), the hips take back that much: the renderer eases her roll in and
   * out as her driver sets off and stops, over longer than the body's own pose is blended (`BLEND`), and a body taking
   * back a roll she no longer had sat a degree off her for a fifth of a second.
   */
  const rolled = seat.sway && !seat.astride ? seat.sway.heel : cart * CART_ROLL * ride.roll;
  r.pelvis = [4, 2 * rock - rolled + 0.5 * kick, 0];
  r.spine = [-9 + 3.8 * jolt + 4 * bump + 1.2 * b * (moving ? 0 : 1), 3.5 * rock + kick, 0];
  r.chest = [-2 + 2.2 * jolt + 1.4 * nod * 0.3 + 2.5 * after - 1.2 * bump, 1.5 * rock + 0.5 * kick, 0];
  // The head kept nearly level and looking ahead over the team; stopped, looking about.
  r.neck = [6 - 3 * jolt - 1.5 * after - 2 * bump, -2.3 * rock - 1.2 * kick, 0];
  r.head = [4 - 4.5 * jolt, -1.6 * rock - 0.6 * kick, moving ? 3 * Math.sin(phi * 0.09) : 14 * Math.sin((t * TAU) / 11) * Math.min(1, 2 * Math.abs(Math.sin((t * TAU) / 23)))];
  r.blink = !moving && t % 4.3 < 0.12;
  // How taut the reins are, nought to one: drawn out with each nod and let back, and let go slack stopped.
  r.slack = moving ? 0.45 - 0.35 * nod : 1;
  const hips = hipsOn(r, seat.up).t;
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const at: V3 = moving
      ? [s * 0.85, hips[1] + 2.75 + 0.42 * nod, hips[2] + 1.75 + 0.18 * nod - 0.25 * jolt]
      : [s * 0.85, hips[1] + 3.0, hips[2] + 2.6 + 0.06 * b];
    fistOn(r, fr, k, at, [s * 0.7, -0.6, -0.5], [-s * 0.9, 0.15, 0.4]);
  }
  r.tail = [12 + 4 * rock + 6 * jolt, 3 * rock + kick, 0];
}

/*
 * At the oars: sat on the thwart facing her stern, the feet braced on the
 * boards, an oar in each fist over its rowlock. A stroke is the catch --
 * leant forward with the arms out, the blades dropped in behind -- the
 * drive, the back swinging up and the arms drawing the handles into the
 * ribs while the blades sweep through the water, the finish, the hands
 * pressed down to lift the blades out and turned to lay them flat, and the
 * recovery, the hands away first and then the body swinging forward after
 * them, the blades skimming back over the water. One stroke to `ROW_STROKE`
 * of the walk's phase, which goes as fast as she does. Stopped, the oars
 * lie flat on the water with the handles in the lap.
 */
const ROW_STROKE = TAU / 0.42;
/** An oar outboard of its rowlock, for its inboard: sculls as they are cut. */
const OAR_OUT = 1.75;
/**
 * The stroke, from the catch: [how far round each oar is (its blade toward
 * the stern from straight out), the blade's height over the water, how far
 * it is turned flat, the back's swing (forward is less)].
 *
 * The back swung from 26 degrees forward to 12 back, which seen from in
 * front or behind was a body sat upright while only the oars moved. Now it
 * reaches well forward at the catch, the hands out past the knees, and lies
 * back past upright at the finish, as a rower's does.
 *
 * The oars went round to 44 degrees at the catch, which took the hands out
 * past the shoulders a hand and a half either side, at shoulder height: from
 * behind, a body with its arms straight out to the sides. Now they go round to
 * 36, the hands a little over shoulder-width apart and further forward, the
 * body reaching down after them.
 */
const STROKE: Key[] = [
  { at: 0, v: [-36, -0.05, 0, -39] },
  { at: 0.1, v: [-28, -0.75, 0, -29] },
  { at: 0.3, v: [0, -0.75, 0, 4] },
  { at: 0.42, v: [16, -0.3, 0, 20] },
  { at: 0.5, v: [14, 0.9, 1, 17] },
  { at: 0.66, v: [-8, 1.2, 1, -6] },
  { at: 0.84, v: [-31, 1.1, 1, -31] },
  { at: 0.94, v: [-37, 0.5, 0.2, -39] },
];
/** Where in the stroke the blades go in, and how much of it the splash they throw up takes to open out and settle. */
const ROW_CATCH = 0.97;
const ROW_SPLASH = 0.24;

/**
 * The two hands are never quite together: the left a little ahead through
 * the stroke, as a share of it, and over the right by this much in the
 * middle of the drive, where the handles come in toward each other.
 */
const ROW_LEAD = 0.04;
const ROW_OVER = 0.18;
/**
 * And the left blade squares and turns flat this much of a stroke after its own place in it. A lead of a fortieth of a
 * stroke, a twentieth of a second, was two oars moving as one at the size the island is played at, and two blades turned
 * at the same moment are a pair: the lead is four hundredths now, and the blades are not turned together.
 */
const ROW_FEATHER_LAG = 0.02;
/**
 * How far behind the oars the back swings, as a share of a stroke. The back opened in the same instant the blades went
 * in, so the catch read as the body throwing the oars round rather than as the blades taking hold of the water and the
 * body then taking the weight of them; now the back stays reached out a moment after the blades bite, the arms
 * straightening on the handles, and then swings. At the finish it is the same: the hands go away first and the body after.
 */
const ROW_LOAD = 0.03;
/** How far back in the stroke the head is following the back from, as a share of it, and how much of the difference it keeps. */
const ROW_HEAD_LAG = 0.1;
const ROW_HEAD_GIVE = 0.5;

function row(r: Rig, phi: number, moving: boolean, seat: Seat, fr: Frame): void {
  const st = (((phi / ROW_STROKE) % 1) + 1) % 1;
  const still = (): number[] => [10, 0.02, 1, 4 + 1.5 * Math.sin(phi / 6 * TAU / 4.2)];
  // The back a little behind the oars all through the stroke (`ROW_LOAD`).
  const sb = (st + 1 - ROW_LOAD) % 1;
  const [, , , swing] = moving ? loop(STROKE, sb) : still();
  // Where the back was a moment ago, which the head follows: it lags the swing a little, as a weight on the neck does.
  const was = moving ? loop(STROKE, (sb + 1 - ROW_HEAD_LAG) % 1)[3] : swing;
  // The legs out along the boards to the stretcher, the knees down under the gunwales.
  r.leg = [[92, 12, -4], [92, 12, -4]];
  r.knee = [50, 50];
  // The back swings from the hips; the head stays up, looking over the stern.
  r.pelvis = [6, 0, 0];
  r.spine = [swing * 0.55 - 4, 0, 0];
  r.chest = [swing * 0.45, 0, 0];
  r.neck = [-swing * 0.45 + 2 - ROW_HEAD_GIVE * (swing - was), 0, 0];
  r.head = [-swing * 0.35 + 2 - 0.5 * ROW_HEAD_GIVE * (swing - was), 0, moving ? 0 : 10 * Math.sin(phi / 6 * TAU / 13)];
  const lock = seat.grip, inboard = Math.max(2, lock[0] - 1.05), out = inboard * OAR_OUT;
  r.oars = [];
  for (let k = 1; k >= 0; k--) {
    const s = k ? 1 : -1;
    /*
     * Each hand at its own place in the stroke, the left a touch ahead. Through
     * the drive the left handle rides over the right, which drops its blade
     * that much deeper, the oar turning about its rowlock. The two arms and
     * oars were each other's mirror all through the stroke.
     */
    const sk = (st + (k ? 0 : ROW_LEAD)) % 1;
    const [sweep, h0, square] = moving ? loop(STROKE, sk) : still();
    const feather = moving && !k ? loop(STROKE, (sk + 1 - ROW_FEATHER_LAG) % 1)[2] : square;
    // How far through its life the splash of the blade going in is: from nought as it goes in to one as it has settled.
    const splash = moving ? ((sk - ROW_CATCH + 1) % 1) / ROW_SPLASH : 1;
    const over = k || !moving ? 0 : ROW_OVER * Math.pow(Math.max(0, Math.sin(Math.PI * (st - 0.18) / 0.42)), 2) * (st > 0.18 && st < 0.6 ? 1 : 0);
    const height = h0 - over * (out - 1.4) / inboard;
    // Dropped toward the blade by as much as puts its middle at `height` over the water.
    const dip = Math.asin(Math.max(-0.9, Math.min(0.9, (lock[2] - height) / (out - 1.4))));
    const a = sweep * DEG;
    const dir: V3 = [s * Math.cos(a) * Math.cos(dip), Math.sin(a) * Math.cos(dip), -Math.sin(dip)];
    const at: V3 = [s * lock[0], lock[1], lock[2]];
    r.oars.push({ lock: at, out: [dir[0] * out, dir[1] * out, dir[2] * out], feather, splash });
    // The fist on the handle, a hand in from its end, the elbow drawn back past the ribs rather than winged out.
    const h = inboard - 0.5;
    fistOn(r, fr, k, [at[0] - dir[0] * h, at[1] - dir[1] * h, at[2] - dir[2] * h], [s * 0.4, -0.7, -0.4], [s * dir[0], s * dir[1], s * dir[2]]);
  }
  r.tail = [10 - swing * 0.3, 0, 0];
}

/**
 * For the action effects (`./fx/rowing.ts`): a rower's oars (the right, then the left): where each is in its stroke, a
 * share of it (the blade goes in at `catch`), and, asked for, where each blade meets the water (the figure's level
 * nought, as `oar` draws it), in the body's frame. Null for a body not sat at oars.
 */
export function oarsOf(pose: FigurePose): { catch: number; strokes: [number, number]; blades: () => V3[] } | null {
  const seat = seatOf(pose);
  if (seat?.hands !== 'oars') return null;
  const st = (((pose.phase / ROW_STROKE) % 1) + 1) % 1;
  return {
    catch: ROW_CATCH,
    strokes: [st, (st + ROW_LEAD) % 1],
    blades: () => {
      const r = rest();
      row(r, pose.phase, pose.moving, seat, frameOf(pose.look ?? DEFAULT_LOOK));
      return (r.oars ?? []).map((o) => {
        const tip = o.lock[2] + o.out[2], u = tip < 0 && o.lock[2] > 0 ? o.lock[2] / (o.lock[2] - tip) : 1;
        return [o.lock[0] + o.out[0] * u, o.lock[1] + o.out[1] * u, 0] as V3;
      });
    },
  };
}

/*
 * At the tiller: sat aft on the stern sheets to one side of it, the hand on
 * that side on its end and the other on the knee, looking forward past the
 * mast and now and then up at the sail. Under way she heels and lifts to
 * the water and the body leans against it from the hips, the head held
 * level; stopped, the same, gentler.
 */
/** How far the tiller is put over either way at the most, in degrees, steering under way. */
const TILLER_SWING = 9;
function steer(r: Rig, phi: number, moving: boolean, seat: Seat, fr: Frame): void {
  const t = phi / 6;
  const b = Math.sin((t * TAU) / 4.2);
  /*
   * A degree or two of lean and a head that looked up now and then were all
   * there was of it. Then the body heeled eight degrees and rose a third of a
   * unit off its seat with the swell -- on a hull that did neither, so at the
   * size the island is played at it was a man swaying on a boat sat still,
   * and the fist stayed on a tiller that never moved.
   *
   * Now the hull heels, pitches and lifts on the water, and the body with
   * her (`Seat.sway`, from whoever draws her): sat on her, it goes where her
   * seat goes. What the body does of its own is balance against her, the
   * hips and back a third of the heel the other way and the neck and head
   * most of the rest, so the eyes stay level while the mast leans; and steer.
   * The tiller is his to draw (`Seat.pivot`): it swings on the rudder's head
   * with his fist on the end of it, put over this way and that in no steady
   * rhythm, the shoulders turning with each push and pull.
   */
  const heel = seat.sway?.heel ?? 0, pitch = seat.sway?.pitch ?? 0;
  const work = moving ? 0.7 * Math.sin(phi * 0.27 + 0.4) + 0.3 * Math.sin(phi * 0.61 + 1.3) : 0.3 * Math.sin((t * TAU) / 7);
  r.leg = [[80, 12, -6], [80, 12, -6]];
  r.knee = [80, 80];
  const k = seat.grip[0] >= 0 ? 1 : 0, s = k ? 1 : -1;
  r.pelvis = [6, -0.15 * heel, 0];
  r.spine = [-6 + 1.2 * b - 0.3 * pitch, -0.2 * heel, s * 2 * work];
  r.chest = [-1 + 0.8 * b, -0.1 * heel, s * 5 * work];
  r.neck = [4 + 0.3 * pitch, -0.25 * heel, -s * 2.5 * work];
  // Looking ahead, and up at the sail every so often.
  const up = Math.pow(Math.max(0, Math.sin((t * TAU) / 9)), 8);
  r.head = [4 + 16 * up + 0.3 * pitch, -0.2 * heel, 6 * Math.sin((t * TAU) / 13) - 10 * up - s * 1.5 * work];
  r.blink = t % 4.7 < 0.12;
  // The end of the tiller, swung about its pivot by how far it is put over.
  let g = seat.grip, haft: V3 = [0, 1, 0.1];
  if (seat.pivot) {
    const p = seat.pivot, a = TILLER_SWING * work * DEG, c = Math.cos(a), n = Math.sin(a);
    const d: V3 = [g[0] - p[0], g[1] - p[1], g[2] - p[2]];
    g = [p[0] + d[0] * c - d[1] * n, p[1] + d[0] * n + d[1] * c, g[2]];
    haft = unit([g[0] - p[0], g[1] - p[1], g[2] - p[2]]);
    r.tiller = { pivot: p, end: g, wood: seat.wood };
  }
  fistOn(r, fr, k, g, [s * (0.5 - 0.35 * work), -0.9 + 0.2 * work, -0.35 + 0.3 * work], haft);
  // The other hand flat on its thigh, half way to the knee, the fingers toward the knee.
  const hips = hipsOn(r, seat.up).t;
  r.open[1 - k] = 1;
  fistOn(r, fr, 1 - k, [-s * 1.2, hips[1] + 1.75, hips[2] + 0.75], [-s * 0.3, -0.9, -0.6], [s, 0, 0]);
  (r.fists as NonNullable<Rig['fists']>)[1 - k] = { ...(r.fists as NonNullable<Rig['fists']>)[1 - k] as Fist, rest: true };
  aimHand(r, fr, 1 - k, [0, 0.95, -0.3], [0, -0.2, 1]);
  r.tail = [10 - 0.2 * heel, -0.2 * heel, 0];
}

/** How far to turn the hand on side `k` about its forearm, in degrees, for its palm to face as near `want` as it can, in the chest's frame. */
function palmTo(r: Rig, k: number, want: V3): number {
  const s = k ? 1 : -1;
  const [ap, aa, at] = r.arm[k];
  const m = mm(rz(s * at * DEG), mm(ry(-s * aa * DEG), rx((ap + r.elbow[k]) * DEG)));
  // Into the forearm's frame, where the palm faces across the hand, away from the side the hand is on, until it is turned.
  const w: V3 = [m[0] * want[0] + m[3] * want[1] + m[6] * want[2], m[1] * want[0] + m[4] * want[1] + m[7] * want[2], m[2] * want[0] + m[5] * want[1] + m[8] * want[2]];
  return Math.atan2(-s * w[1], -s * w[0]) / DEG;
}

/**
 * A wave with the hand nearest whoever is looking, or the other if that one has something in it (see `wave`, `waveArm`); or a
 * hop, knees tucked in the air, with whatever is held still held (see `hop`). `busy` is which hands are full, left then right.
 */
function emote(r: Rig, id: string, t: number, facing: number, fr: Frame, busy: [boolean, boolean], arm = waveArm(facing, busy), staged = facing): void {
  if (id === 'wave') wave(r, t, facing, fr, arm, busy, staged);
  else if (id === 'hop') hop(r, t, fr, busy);
  else if (id === '67') sixSeven(r, t);
}

/** The 6 7's upper arms, as the hop's keys (`HOP_ARMS`): forward, out, turned; the forearms out ahead of it, palms up. */
const SIX_SEVEN_ARM: [number, number, number] = [22, 10, -40];
/**
 * The 6 7 gesture: both upper arms a little forward, the elbows bent so the forearms come out ahead, palms up; one forearm
 * lifted as the other drops, swapped every half `SIX_SEVEN_SWAP`; the chest tilted after the higher hand and the head bobbed on
 * each swap. Eased in over the first tenth and out over the last.
 */
function sixSeven(r: Rig, t: number): void {
  const on = step(t, 0, 0.1) * (1 - step(t, 0.9, 1));
  const secs = EMOTE_BY_ID.get('67')?.seconds ?? SIX_SEVEN_SWAP * 4;
  const ph = (TAU * t * secs) / SIX_SEVEN_SWAP, swing = Math.sin(ph);
  for (const k of [0, 1] as const) {
    const s = k ? 1 : -1;
    r.arm[k] = [r.arm[k][0] + (SIX_SEVEN_ARM[0] - r.arm[k][0]) * on, r.arm[k][1] + (SIX_SEVEN_ARM[1] - r.arm[k][1]) * on, r.arm[k][2] * (1 - on) + SIX_SEVEN_ARM[2] * on];
    r.elbow[k] = r.elbow[k] + (78 + 28 * s * swing - r.elbow[k]) * on;
  }
  r.chest = [r.chest[0], r.chest[1] + 4 * swing * on, r.chest[2]];
  r.head = [r.head[0] - 6 * Math.abs(Math.cos(ph)) * on, r.head[1] + 3 * swing * on, r.head[2]];
}

/**
 * The arm a wave is made with at `facing`: the one staged for the camera (see `wave`), unless it has something in it and the
 * other does not; with both full -- a weapon and a shield -- the shield arm, the shield on the forearm and the hand free behind it.
 */
function waveArm(facing: number, busy: [boolean, boolean]): number {
  const k = stagedArm(facing);
  return busy[0] && busy[1] ? 0 : busy[k] ? 1 - k : k;
}
/**
 * The arm a pose's wave is made with at `facing` (`waveArm`, its hands' load as `busyOf` reads them): 0 the left, 1 the
 * right; or -1 with both hands full, where the flat figure nods instead (`wave`, `nod`). For the sculpted bodies' clips.
 */
export function waveArmOf(p: FigurePose, facing = p.facing): number {
  const busy = busyOf(p, facing);
  return busy[0] && busy[1] ? -1 : waveArm(facing, busy);
}
/** The arm a wave is staged for at `facing` with both hands free: the near one, but the far one side on (see `wave`). */
const stagedArm = (facing: number): number => {
  const f = ((Math.round(facing) % 8) + 8) % 8;
  return f === 2 ? 0 : f >= 5 && f !== 6 ? 0 : 1;
};

/*
 * Which way round from straight out to the side the waving arm is raised, at
 * each facing, toward straight ahead, in degrees. Seen from in front or
 * behind, a little forward of out to the side, where the hand is beside the
 * head; three-quarters on, a little behind straight out, which is what takes
 * the hand off the side of the head on the screen and away from the face;
 * three-quarters away, half way, which takes it furthest from the head; and
 * side on all but straight ahead, so it waves in front of the face and
 * clear of it.
 */
const WAVE_ROUND = [20, -25, 86, 42, 20, 42, 86, -25];
/** How high the upper arm is raised, from hanging, and how far the elbow is bent at the middle of each swing, at each facing: the forearm leaning further out, away from the head, where the head is nearest the hand on the screen. */
const WAVE_RAISE = [102, 98, 102, 102, 102, 102, 102, 98];
const WAVE_BEND = [86, 76, 66, 84, 86, 84, 66, 76];
/*
 * And the same for the other arm, the one a wave is not staged for at each
 * facing, which waves when the staged one has something in it, or when the
 * body turns in the middle of a wave made with the staged one: the far arm
 * three-quarters on raised half way forward, which takes the hand out past
 * the side of the head rather than behind it; the near one side on raised
 * straight ahead, a little lower and with the elbow opened, so the forearm
 * leans out ahead of the face and the hand is clear of it -- out to the side,
 * it comes at the viewer and the hand was over the face, and raised straight
 * back, the hand sat on the back of the crown and the wave read as
 * scratching the head; and the far one three-quarters away straight out,
 * past the back of the head.
 */
const WAVE_ROUND_OTHER = [20, 45, 84, 0, 20, 0, 84, 45];
/**
 * How much lower, in degrees, the waving arm goes as it comes round from one facing's staging to a far different one in front
 * of the head, and how much higher where it comes round behind it, from side on to three-quarters away; and how many seconds the
 * staging takes to come round an eighth: see `wave`. Thirty-five lower, the hand was held forward at the chest for a sixth of a
 * second, a palm put up to stop someone rather than a wave.
 */
const WAVE_OVER = -28, WAVE_BEHIND = 15, WAVE_TURN = 0.3;
const WAVE_RAISE_OTHER = [102, 98, 100, 102, 102, 102, 100, 98];
const WAVE_BEND_OTHER = [86, 80, 62, 84, 86, 84, 62, 80];
/** Each arm's tables, round the eight facings: the staged ones where it is the staged arm, the other ones where not. */
const WAVE_BY_ARM = [0, 1].map((k) => {
  const pick = (main: number[], other: number[]): number[] => main.map((v, f) => (stagedArm(f) === k ? v : other[f]));
  return { round: pick(WAVE_ROUND, WAVE_ROUND_OTHER), raise: pick(WAVE_RAISE, WAVE_RAISE_OTHER), bend: pick(WAVE_BEND, WAVE_BEND_OTHER) };
});

/**
 * A wave, `t` of the way through, with arm `k`. The arm is raised from where
 * it hangs, in one turn of the shoulder through the plane it ends up in -- it
 * was the shoulder's three angles each eased from one end to the other, which
 * swung the hand in an arc round the back of the head side on -- a little
 * past where it stops and back, the elbow bending from the start so the hand
 * comes up near the body and over the elbow: bent after the arm was up, it
 * went up a straight arm, a T with a fist on the end of it. The hand opens
 * as it comes up, over a few frames, and closes again as it comes down.
 * Then the forearm swings from the elbow three times, the hand flapping a
 * moment behind it and the palm toward whoever is looking; and it comes down
 * the way it went up, the forearm first. The shoulder comes up with the arm,
 * the body leans away from it and rocks a little with each swing, and the
 * head turns toward whoever is looking.
 *
 * With the arm on the near side of the body from where it is seen -- the
 * right, but the left from the left-hand side -- as it would be staged for a
 * camera: the far arm waves behind the head. Except side on, where the arm
 * goes up ahead of the face: the near one, upper arm and shoulder piece and
 * all, comes up across the face on its way, and the far one goes up behind
 * the head and comes out in front of it with only the forearm and the hand.
 */
function wave(r: Rig, t: number, facing: number, fr: Frame, k: number, busy: [boolean, boolean] = [false, false], staged = facing): void {
  if (busy[0] && busy[1]) {
    nod(r, t, facing);
    return;
  }
  const T = fr.tall, s = k ? 1 : -1;
  /*
   * Up from still, a little past and back, the elbow bending ahead of the raise; and down again with the elbow kept bent until
   * the upper arm is most of the way down, so the hand comes down past the shoulder. The elbow opened ahead of the upper arm
   * coming down, and for a tenth of a second the arm was held straight out ahead at the height of the shoulder.
   */
  const x = ease(Math.max(0, Math.min(1, t / 0.24)));
  const raise = (1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2)) * (1 - step(t, 0.76, 0.96));
  // The elbow bent from the first frames, and further than it is held up, so the forearm is folded up before the upper arm comes
  // level (`early`): bent as the arm rose, side on it went up for a frame or two as one straight arm pointing ahead at the height
  // of the shoulder, with the fist on the end of it.
  const lift = step(t, 0, 0.05) * (1 - step(t, 0.84, 1));
  // Three swings of the forearm, in and out from upright, eased in and out of.
  const swings = step(t, 0.15, 0.25) * (1 - step(t, 0.72, 0.82));
  const ph = (TAU * 3 * (t - 0.2)) / 0.58;
  const swing = swings * Math.sin(ph);
  // Read at the way the body faces as drawn, so turning in the middle of a wave eases from one facing's staging to the next.
  const view = viewOf(facing), table = WAVE_BY_ARM[k];
  // The body leans away from the arm, rocks with each swing, and the shoulder comes up.
  r.spine = [r.spine[0], r.spine[1] - 2 * s * raise, r.spine[2]];
  r.chest = [r.chest[0] + 1.5 * raise, r.chest[1] - 4 * s * raise + 1.2 * s * swing, r.chest[2] - 1.5 * s * swing];
  r.shrug = k ? [r.shrug[0], r.shrug[1] + 0.45 * raise] : [r.shrug[0] + 0.45 * raise, r.shrug[1]];
  // Every direction from here on in the chest's frame: x to the right, y forward, z up.
  const chest = joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const back = (v: V3): V3 => { const m = chest.m; return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; };
  const [ap, aa, at] = r.arm[k];
  const hang = mv(mm(rz(s * at * DEG), mm(ry(-s * aa * DEG), rx(ap * DEG))), [0, 0, -1]);
  /*
   * The staging read at `staged`, which follows the body round more slowly
   * than it turns (see `settle`); and where the arm comes round a long way
   * between one facing's staging and the next, it goes up over the top of
   * the head on the way, by up to `WAVE_OVER` degrees (`WAVE_BEHIND` round
   * behind it): turned straight round, the hand went across the face in
   * three frames. The forearm's swing goes on through it.
   */
  const f8 = ((staged % 8) + 8) % 8, f0 = Math.floor(f8), across = Math.min(1, Math.abs(table.round[(f0 + 1) % 8] - table.round[f0]) / 90);
  const over = (f0 === 2 || f0 === 5 ? WAVE_BEHIND : WAVE_OVER) * across * Math.sin(Math.PI * (f8 - f0)) * lift;
  const psi = byFacing(table.round, staged) * DEG, el = (byFacing(table.raise, staged) + over) * DEG;
  const out: V3 = [s * Math.cos(psi), Math.sin(psi), 0];
  const raised: V3 = [Math.sin(el) * out[0], Math.sin(el) * out[1], -Math.cos(el)];
  // The upper arm turned from hanging to raised about the one axis between them, overshooting a little at the top.
  const om = Math.acos(Math.max(-1, Math.min(1, dot(hang, raised)))), so = Math.sin(om) || 1;
  const wa = Math.sin((1 - raise) * om) / so, wb = Math.sin(raise * om) / so;
  const u = unit([hang[0] * wa + raised[0] * wb, hang[1] * wa + raised[1] * wb, hang[2] * wa + raised[2] * wb]);
  // The forearm bent from the elbow toward forward as it hangs and toward straight up as it is raised; and kept toward up as it
  // comes down, so the hand comes down past the shoulder: bent toward forward, the arm side on lowered ahead of the body was one
  // straight line, the forearm on from the upper arm.
  const up = t < 0.5 ? Math.min(lift, Math.max(0, Math.min(1, 1.6 * raise))) : lift;
  const want: V3 = [0, 1 - up, up], wu = dot(want, u);
  const p = unit([want[0] - u[0] * wu, want[1] - u[1] * wu, want[2] - u[2] * wu]);
  // Coming down, the elbow folds further, the hand toward the shoulder, before it opens again at the side.
  const fold = 30 * step(t, 0.74, 0.86), early = t < 0.5 ? 35 * Math.max(0, 1 - raise) : 0;
  const bend = (r.elbow[k] + (byFacing(table.bend, staged) + Math.min(0, over) + fold + early - (swing > 0 ? 24 : 16) * swing - r.elbow[k]) * lift) * DEG;
  const fa: V3 = [u[0] * Math.cos(bend) + p[0] * Math.sin(bend), u[1] * Math.cos(bend) + p[1] * Math.sin(bend), u[2] * Math.cos(bend) + p[2] * Math.sin(bend)];
  const S: V3 = [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]];
  const a = UPPER * T, b = LOWER * T;
  const wrist = place(chest, [S[0] + u[0] * a + fa[0] * b, S[1] + u[1] * a + fa[1] * b, S[2] + u[2] * a + fa[2] * b]);
  const was = r.hand[k];
  hold(r, fr, k, wrist, mv(chest.m, u));
  // The palm turned toward whoever is looking, and forward, and the hand flapping a little behind the forearm's swing. Seen from
  // behind, forward, to whoever is in front: turned to the viewer, it was the palm shown over the back of the head.
  const fore = Math.max(0, Math.min(1, (view.T[1] + 0.4) / 0.6));
  const toward = back([view.T[0] * fore, view.T[1] * fore + 1 - fore, 0]);
  const palm = palmTo(r, k, unit([toward[0] + 0.3 * out[0], toward[1] + 0.6, 0.2]));
  r.hand[k] = [was[0] + (14 * swings * Math.cos(ph) - was[0]) * lift, was[1] * (1 - lift), was[2] + (palm - was[2]) * lift];
  r.open[k] = step(t, 0.04, 0.14) * (1 - step(t, 0.8, 0.92));
  // The head turned toward whoever is looking, when they are in front, rather than about; and tilted toward the arm.
  const to = view.T[1] > -0.2 ? Math.max(-20, Math.min(20, Math.atan2(-view.T[0], view.T[1]) / DEG)) : 0;
  r.neck = [r.neck[0], r.neck[1], r.neck[2] * (1 - raise)];
  r.head = [r.head[0] + 3 * raise, r.head[1] + 3 * s * raise, r.head[2] * (1 - Math.min(1, raise)) + 0.6 * to * Math.min(1, raise)];
}

/**
 * The greeting with both hands full, a weapon and a shield, `t` of the way
 * through: the head turned to whoever is looking and a nod with a little bow
 * from the chest. It was a wave with the shield arm, the hand behind the
 * shield, which read as the shield raised -- and side on, over the face.
 *
 * The weapon hand stays down, the forearm only coming up a little with the
 * bow: brought up and forward, it tipped a blade in the fist up to level
 * (see `heldFrame`), pointed at whoever the body faced, which reads as a
 * threat and not a greeting. And seen from behind, the head turns over the
 * shoulder toward the viewer by up to `NOD_BACK` degrees, so the nod is
 * made to them: kept facing away, it was the back of the head dipping,
 * which reads as looking at the ground.
 */
const NOD_BACK = 35;
function nod(r: Rig, t: number, facing: number): void {
  const held = step(t, 0.05, 0.25) * (1 - step(t, 0.72, 0.95));
  const dip = Math.pow(Math.sin(Math.PI * step(t, 0.22, 0.62)), 2);
  const view = viewOf(facing), way = Math.atan2(-view.T[0], view.T[1]) / DEG;
  const to = view.T[1] > -0.2 ? Math.max(-20, Math.min(20, way)) : way >= 0 ? NOD_BACK : -NOD_BACK;
  r.chest = [r.chest[0] - 5 * dip, r.chest[1], r.chest[2] + 0.25 * to * held];
  r.neck = [r.neck[0] - 7 * dip, r.neck[1], r.neck[2] * (1 - held) + 0.25 * to * held];
  r.head = [r.head[0] + 2 * held - 16 * dip, r.head[1], r.head[2] * (1 - held) + 0.5 * to * held];
  r.elbow[1] += 12 * held;
}

/*
 * The hop, phase by phase, in the hop's own time (see `HOPS` for when the
 * feet are off the ground): a crouch to load, the legs driven straight and
 * up onto the toes to leave, the knees tucked in the air and let down again
 * to reach for the ground, the landing taken on the knees and hips -- which
 * is also the crouch that loads the second, smaller hop -- and the last
 * landing taken and stood up out of. The body's height in the air is a fall
 * under gravity between where the hips were as the feet left and where they
 * are as the feet come down, whatever the legs are doing under it.
 */
const HOP_LOAD = 0.15;
/** How far down the hips go at the deepest of the first crouch, in the body's units, and how much of that each landing takes. */
const HOP_DROP = 1.7;
const HOP_LAND = [0.9, 0.7];
/** When each landing is at its deepest. */
const HOP_LOW = [0.53, 0.84];
/**
 * The arms through a hop, as [when, swung forward, out, elbow]: back to load, swung forward and up through the leap, out to the
 * sides in the air for balance -- under half way to level: out to the level, it was a puppet's arms -- and forward and down to land.
 * This is the left; the right goes through it `HOP_RIGHT` behind and `HOP_RIGHT_SIZE` as far, and a hand with something in it
 * `HOP_HELD` as far, so the two arms are not one arm twice.
 */
const HOP_ARMS: Key[] = [
  { at: 0, v: [3, 7, 15] },
  { at: 0.15, v: [-44, 12, 28] },
  { at: 0.21, v: [46, 24, 28] },
  { at: 0.27, v: [28, 40, 30] },
  { at: 0.36, v: [16, 46, 28] },
  { at: 0.45, v: [12, 38, 30] },
  { at: 0.51, v: [12, 18, 38] },
  { at: 0.555, v: [-24, 14, 30] },
  { at: 0.6, v: [36, 26, 30] },
  { at: 0.67, v: [18, 36, 30] },
  { at: 0.76, v: [12, 30, 32] },
  { at: 0.84, v: [12, 16, 32] },
  { at: 0.93, v: [5, 9, 20] },
];

const HOP_RIGHT = 0.05;
const HOP_RIGHT_SIZE = 0.85;
const HOP_HELD = 0.35;
/** And the legs: the right, the back one, tucked `HOP_TRAIL` as far as the left and `HOP_RIGHT` after it; and the chest turned this far toward the left in the air, in degrees. */
const HOP_TRAIL = 0.8;
const HOP_TWIST = 7;
/**
 * And how the right arm differs in shape in the air, not only in time and size: bent further at the elbow, held less far out and
 * turned in at the shoulder, so one arm is out for balance and the other comes forward and in; and how far both arms are turned
 * in at the shoulder there, which is what shows a bent elbow from in front. In degrees, at the top of the leap.
 */
const HOP_RIGHT_BEND = 20, HOP_RIGHT_IN = 0.7, HOP_RIGHT_TURN = 12, HOP_TURN = 10;
/** How much of that shape the right arm keeps on the ground, and how far both elbows bend further at the deepest of a crouch, in degrees. */
const HOP_KEEP = 0.75, HOP_GIVE = 12;
/**
 * And the arms through a crouch: the right reaching forward by `HOP_REACH` degrees at the deepest of it, with the body, and
 * giving `HOP_GIVE_RIGHT` degrees at the elbow with it and staying given until `HOP_ARM_LAG` of the hop after it; the left going `HOP_WIDE` degrees further out
 * for balance, near straight -- so at the deepest of a landing one is out and one forward and bent. Given together and alike,
 * from in front the landing was one symmetrical A at the size the island is played at; and with the right's reach late as
 * well, at the deepest it was only behind the left, not different from it.
 */
const HOP_REACH = 40, HOP_ARM_LAG = 0.04, HOP_GIVE_RIGHT = 44, HOP_WIDE = 26;

/** The hop's pose `t` of the way through, over whatever the body was doing standing: everything but how high it is off the ground. */
function hopPose(r: Rig, t: number, fr: Frame, busy: [boolean, boolean]): void {
  const [one, two] = HOPS;
  // In from standing and back out to it at the ends, so it starts and finishes on the idle it was done over.
  const env = step(t, 0, 0.08) * (1 - step(t, 0.9, 1));
  // How deep the crouch is: down to load, driven up out of it as fast as the hop leaves, and each landing taken as fast as it comes.
  const wave = (x: number, a: number, b: number): number => Math.sin((Math.PI / 2) * Math.max(0, Math.min(1, (x - a) / (b - a))));
  const crouch = (t: number): number => {
    if (t < 0) return 0;
    if (t < HOP_LOAD) return ease(t / HOP_LOAD);
    if (t < one.off) return 1 - wave(t, HOP_LOAD, one.off);
    if (t >= one.on && t < HOP_LOW[0]) return HOP_LAND[0] * wave(t, one.on, HOP_LOW[0]);
    if (t >= HOP_LOW[0] && t < two.off) return HOP_LAND[0] * (1 - wave(t, HOP_LOW[0], two.off));
    if (t >= two.on && t < HOP_LOW[1]) return HOP_LAND[1] * wave(t, two.on, HOP_LOW[1]);
    if (t >= HOP_LOW[1]) return HOP_LAND[1] * (1 - ease((t - HOP_LOW[1]) / (1 - HOP_LOW[1])));
    return 0;
  };
  // And the right arm takes each crouch `HOP_ARM_LAG` after the body does (see `HOP_REACH`).
  const c = crouch(t), late = crouch(t - HOP_ARM_LAG);
  // Up on the toes as the legs straighten to leave, pointed in the air, and down toe first, the heel after.
  const push = Math.max(wave(t, HOP_LOAD, one.off) * (t < one.off ? 1 : 0), wave(t, HOP_LOW[0], two.off) * (t >= HOP_LOW[0] && t < two.off ? 1 : 0));
  let toe = -24 * push;
  let air = 0;
  for (const h of HOPS) {
    if (t >= h.off && t < h.on) {
      const u = (t - h.off) / (h.on - h.off);
      toe = -24 + 20 * ease(u);
      air = Math.sin(Math.PI * u);
    } else if (t >= h.on && t < h.on + 0.03) toe = -4 * (1 - (t - h.on) / 0.03);
  }
  // The knees drawn up through the rise and let down again to reach for the ground before it arrives: the back one later and less.
  const tuckAt = (x: number): number => {
    for (const [i, h] of HOPS.entries()) {
      if (x >= h.off && x < h.on) return (i ? 0.55 : 1) * Math.pow(Math.sin(Math.PI * Math.min(1, (x - h.off) / (h.on - h.off) / 0.85)), 2);
    }
    return 0;
  };
  const tucks = [tuckAt(t), HOP_TRAIL * tuckAt(t - HOP_RIGHT)], tuck = tucks[0];
  // The hips go down and back over the feet, and the body leans forward over them as far as keeps it balanced.
  const base = hipsFor({ ...r, pelvis: [0, 0, 0], at: [0, 0, 0] }, fr, 1, stance(fr)[1], 3);
  r.pelvis = [r.pelvis[0] * (1 - env), r.pelvis[1] * (1 - env), r.pelvis[2] * (1 - env)];
  r.at = [r.at[0] * (1 - env), -0.55 * c, r.at[2] * (1 - env) + base * env - HOP_DROP * c];
  r.spine = [r.spine[0] * (1 - env) - 18 * c - 5 * tuck, r.spine[1] * (1 - env), r.spine[2] * (1 - env)];
  r.chest = [r.chest[0] - 4 * c, r.chest[1] * (1 - env), r.chest[2] * (1 - env) + HOP_TWIST * air];
  // The hips turned a little against the chest, so the twist shows from in front as the shoulders going one way over the hips.
  r.pelvis = [r.pelvis[0], r.pelvis[1], r.pelvis[2] - 0.4 * HOP_TWIST * air];
  // The head kept looking ahead rather than at the ground.
  r.neck = [r.neck[0] + 12 * c + 3 * tuck, r.neck[1], r.neck[2]];
  r.head = [r.head[0] + 8 * c, r.head[1], r.head[2]];
  r.hover = undefined;
  r.plant = undefined;
  r.leg = [[0, 0, TOE_OUT], [0, 0, TOE_OUT]];
  // Up on the toes, the ankle goes up and forward over the tip of the boot, which stays where it was on the ground.
  const q = toe * DEG, tip = SOLE[2];
  const lift: V3 = [0, tip[1] - (tip[1] * Math.cos(q) - tip[2] * Math.sin(q)), tip[2] - (tip[1] * Math.sin(q) + tip[2] * Math.cos(q))];
  r.at[2] += lift[2];
  for (let k = 0; k < 2; k++) {
    const at = stance(fr)[k];
    plant(r, fr, k, [at[0], at[1] + lift[1], at[2] + lift[2]]);
    r.leg[k] = [r.leg[k][0] + 42 * tucks[k], r.leg[k][1] + 4 * tucks[k], r.leg[k][2]];
    r.knee[k] += 78 * tucks[k];
    r.foot[k] = toe;
  }
  for (let k = 0; k < 2; k++) {
    const [p, a, e] = loop(HOP_ARMS, Math.max(0, Math.min(0.9999, t - (k ? HOP_RIGHT : 0))));
    const g = env * (k ? HOP_RIGHT_SIZE : 1) * (busy[k] ? HOP_HELD : 1);
    // Something of the right arm's shape kept on the ground, and both elbows giving with the knees as a landing is taken: shaped
    // only in the air, the arms came down at the landing into one straight A, the one the mirror of the other.
    const shape = k ? Math.max(air, HOP_KEEP * env) : 0, out = a * (1 - (1 - HOP_RIGHT_IN) * shape) + (k ? 0 : HOP_WIDE * c);
    r.arm[k] = [r.arm[k][0] + (p + (k ? HOP_REACH * c : 0) - r.arm[k][0]) * g, Math.max(r.arm[k][1], r.arm[k][1] + (out - r.arm[k][1]) * g), r.arm[k][2] * (1 - g) + (HOP_TURN * air + HOP_RIGHT_TURN * shape) * g];
    r.elbow[k] = r.elbow[k] + (e + HOP_RIGHT_BEND * shape + (k ? HOP_GIVE_RIGHT * Math.max(c, late) : HOP_GIVE * c) - r.elbow[k]) * g;
  }
}

/** The hop `t` of the way through, and lifted off the ground as far as the leap has it. */
function hop(r: Rig, t: number, fr: Frame, busy: [boolean, boolean]): void {
  const under = mixRig(r, r, 1);
  hopPose(r, t, fr, busy);
  const h = HOPS.find((h) => t > h.off && t < h.on);
  if (!h) return;
  // Where the hips are, stood on the lowest sole, for the pose at a moment of it.
  const hips = (x: Rig): number => skeleton(fr, { ...x, lift: 0 }).pelvis.t[2];
  const at = (x: number): number => {
    const q = mixRig(under, under, 1);
    hopPose(q, x, fr, busy);
    return hips(q);
  };
  const u = (t - h.off) / (h.on - h.off);
  const want = at(h.off) + (at(h.on) - at(h.off)) * u + emotePose('hop', t).lift / HEIGHT_SCALE;
  r.lift = Math.max(0, want - hips(r));
}

/**
 * Which hands have something in them, left then right, at `facing`: a shield or a bow in the left; anything else in the right, or
 * over whichever shoulder it is carried (see `overLeft`).
 */
function busyOf(p: FigurePose, facing: number, side = overLeft(facing) ? 0 : 1): [boolean, boolean] {
  const held = p.gear?.weapon && weaponOf(p.gear.weapon.id);
  const over = !!held && held.carry === 'shoulder' && side < 0.5;
  return [!!p.gear?.offhand || (!!held && (held.carry === 'bow' || over)), !!held && held.carry !== 'bow' && !over];
}

/**
 * What `settle` chooses once and keeps for a body drawn frame after frame, rather than the pose choosing it afresh from the way it
 * faces each time: the arm a wave is being made with, chosen as it starts, and where something heavy is between the shoulders,
 * nought over the left and one over the right, which goes from the one to the other over `SWAP` seconds (see `shoulder`).
 */
interface Kept {
  wave?: number;
  /** The facing a wave is staged for, following the body round more slowly than it turns: see `wave`. */
  waveFacing?: number;
  side?: number;
  /** And the shoulder it is on its way to, which is the one whose hand is full as far as an emote is concerned (see `settle`). */
  bound?: number;
  /** At work, how far the mallet hand is held down as the far one (see `FAR_COCK`), and for which hand: see `settle`. */
  far?: number;
  farLeft?: boolean;
}

/*
 * Meditating. It was the work at the bench -- stood up swinging a mallet at
 * nothing -- because that is what every job was. Now it is done sat on the
 * ground cross-legged: the hips down on it, the thighs out to either side and
 * turned out so the knees fall open, the shins folded back across each other
 * in front, the hands resting palm up on the knees. The back is held up from
 * the hips and the head held level, the eyes shut, and the only thing
 * that moves is the breath: in and out once in five and a half seconds, the
 * chest lifting and the shoulders rising a little with it, the head nodding
 * back up a degree on the in-breath.
 */
/** The job sat down for (`FigurePose.job`). */
export const MEDITATE = 'meditate';
/** How high the hips sit over the ground, sat on it: the round of the buttocks and the cloth under them. */
const MEDITATE_UP = 0.35;
/** One breath, in seconds, in and out. */
const MEDITATE_BREATH = 5.5;
function meditate(r: Rig, phi: number, fr: Frame): void {
  const t = phi / 6;
  // In (one) and out (minus one): longer at the top and the bottom than through the middle, as a slow breath is.
  const s = Math.sin((t * TAU) / MEDITATE_BREATH), breath = Math.sign(s) * Math.pow(Math.abs(s), 0.7);
  // Sat on the ground, the feet not stood on it: they rest where the legs fold them.
  r.sit = { up: MEDITATE_UP, astride: true, ground: true };
  r.flat = [false, false];
  // The thighs forward and out, turned out so the knees fall open; the shins folded back across each other, the right over the left.
  r.leg = [[39, -65, -83], [41, -63, -83]];
  r.knee = [127, 124];
  r.foot = [24, 24];
  // The back held up from the hips, the chest lifting with the breath and the head let down a little.
  r.pelvis = [4, 0, 0];
  r.spine = [-3 - 1.2 * breath, 0, 0];
  r.chest = [-2 - 1.6 * breath, 0, 0];
  r.neck = [3, 0, 0];
  r.head = [1 + 1.2 * breath, 0, 0];
  r.shrug = [0.1 + 0.08 * breath, 0.1 + 0.08 * breath];
  r.blink = true;
  // The hands on the knees, palm up and a little cupped, the elbows out and back at the sides.
  const b = skeleton(fr, r);
  r.reach = [0, 1].map((k) => {
    const knee = b[`knee${k}`].t, side = k ? 1 : -1;
    return { at: [knee[0] * 0.78, knee[1] * 0.85, knee[2] + 0.95 + 0.04 * breath], pole: [side * 1, -0.35, -0.2] };
  }) as [HandGoal, HandGoal];
  r.shape = [{ cup: 0.55 }, { cup: 0.55 }];
  r.open = [0.6, 0.6];
  r.loose = [false, false];
}

/**
 * The pose for `p`, at `p.facing` as drawn -- between two of the eight ways while turning, so that whatever is set by facing
 * (`byFacing`) comes round with the body -- and the work done left-handed or not as `left` says (see `lefty`, `settle`), with
 * whatever else `settle` keeps (`kept`).
 */
function rigOf(p: FigurePose, fr: Frame, left = lefty(p.facing), kept: Kept = {}): Rig {
  const r = rest();
  const side = kept.side ?? (overLeft(p.facing) ? 0 : 1);
  const busy = busyOf(p, p.facing, kept.bound ?? side);
  if (p.swimming) {
    swim(r, p.phase, p.moving, fr, p.facing);
  } else if (p.driving) drive(r, p.phase, p.moving, p.seat ?? BOX, fr);
  else if (p.moving) walk(r, p.phase + TAU * strideSeed(p.id), Math.max(0, Math.min(1, p.gait ?? 0)), fr, p.facing);
  else if (p.working && p.job === MEDITATE) meditate(r, p.phase, fr);
  else if (p.working) work(r, p.phase, fr, left, kept.far !== undefined && kept.farLeft === left ? kept.far : left ? 1 - byFacing(LEFTY, p.facing) : byFacing(LEFTY, p.facing));
  else idle(r, p.phase / 6, fr, busy, /helm/.test(p.gear?.head?.id ?? ''), p.facing);
  if (p.emote && !p.swimming && !p.driving) emote(r, p.emote, p.emoteT ?? 0, p.facing, fr, busy, kept.wave, kept.waveFacing);
  // Put away for what wants both hands -- work, the water, the reins, a seat -- and not for an emote, which was a weapon and a
  // shield gone to the back in one frame and back again at the end: a wave is made with the hand that is free, and a hop with
  // everything held as it was (see `emote`).
  r.stowed = r.tool || r.reins || !!r.sit || r.sink > 0;
  // Something too heavy to carry out in front, over the right shoulder.
  const held = p.gear?.weapon && weaponOf(p.gear.weapon.id);
  if (held && held.carry === 'shoulder' && !r.stowed) shoulder(r, fr, held, side, p.facing);
  // At a run the body goes lower on bent knees, and the bow is held that much higher.
  if (held && held.carry === 'bow' && !r.stowed) bowArm(r, fr, held, p.moving ? 1.3 * Math.max(0, Math.min(1, p.gait ?? 0)) : 0, p.facing);
  if (p.moving && !p.swimming && !p.driving && !r.stowed) carrying(r, held || undefined, !!p.gear?.offhand, Math.max(0, Math.min(1, p.gait ?? 0)), fr, p.facing, held && held.carry !== 'shoulder' ? clearAhead(p, fr, held) : 0);
  // Standing, the arm with something in it kept off the legs as on the move (see `clearOfLegs`): stood at rest, a sword lay through
  // the thigh and was turned out of it in the fist.
  else if (held && held.carry !== 'shoulder' && !r.stowed && !p.swimming && !p.driving) clearOfLegs(r, fr, held, p.facing, 0);
  // A hand with something in it is closed on it.
  if (held && !r.stowed) r.loose[held.carry === 'bow' ? 0 : held.carry === 'shoulder' ? r.carried : 1] = false;
  // Both, while something heavy goes from one shoulder to the other in them.
  if (r.swapping) r.loose = [false, false];
  if (p.gear?.offhand && !r.stowed) r.loose[0] = false;
  if (p.block !== undefined && p.gear?.offhand && !r.stowed && !p.swimming && !p.driving) blocked(r, p.block);
  if (p.flinch && !p.swimming && !p.driving) flinched(r, p.flinch);
  if (p.cast && castPoser) {
    // Each hand's goal, seeded where the hand is before the cast, so a goal the cast sets is blended in from there (see `Rig.reach`).
    seedReach(r, fr);
    castOver(r, p, castPoser);
    // Put away for the cast, once it has the hands (`Rig.stow`): carried from the hand to where it goes over the middle
    // half of the way, as work's putting away is (`stowing`), rather than gone from the hand in a frame.
    const stow = r.stow ?? 0;
    if (stow >= 0.5) r.stowed = true;
    if (stow > STOW_CAST[0] && stow < STOW_CAST[1] && held && r.stowing === undefined) r.stowing = STOW_GO[0] + (STOW_GO[1] - STOW_GO[0]) * (stow - STOW_CAST[0]) / (STOW_CAST[1] - STOW_CAST[0]);
  }
  if (r.kneel || r.reach || r.both) castExtras(r, p, fr);
  return r;
}

/**
 * The arms on the move with something in them, at gait `g`: an arm holding
 * a weight does not swing as a free one does. A blade or a hatchet in the
 * right fist swings a little over half as far, held out from the thigh so the
 * blade goes by the leg and not through it, and at a run is carried with the
 * elbow bent at the hip rather than pumped up at the chest; a spear upright in
 * it hardly swings at all, the hand at the side where its slant (`staffUp`)
 * keeps the shaft off the face, out from the hip and up a little so the butt
 * rides beside the stride and not down among the feet; and a shield on the left forearm is carried steady at the side, the
 * elbow bent and the arm out from the body, swinging a fraction as far.
 */
/** How much of a free arm's swing the arm carrying a spear upright keeps, at each facing: see `carrying`. */
const STAFF_SWING = [0.4, 0.4, 0.4, 0.4, 0.4, 0.3, 0.22, 0.4];
function carrying(r: Rig, held: Weapon | undefined, shield: boolean, g: number, fr: Frame, facing: number, least = 0): void {
  const L = (a: number, b: number): number => a + (b - a) * g;
  // The arm's swing about where it hangs from, `keep` of it kept.
  const steady = (k: number, keep: number, fore = L(3, 6)): void => {
    r.arm[k][0] = fore + keep * (r.arm[k][0] - L(3, 6));
  };
  // The elbow's swing about its middle, as the free arm has it (see `walk`).
  const bend = (k: number): number => r.elbow[k] - (WALK_ELBOW[0] + WALK_ELBOW[1] / 2 + g * g * (90 - WALK_ELBOW[0] - WALK_ELBOW[1] / 2));
  if (held?.carry === 'fist') {
    // At a run the sword arm still drives, the elbow working with it, rather than hanging dead at the side.
    const e = bend(1);
    steady(1, L(0.55, 0.6), L(3, 10));
    // Further out from the body the further back it swings, so the fist and the blade go by the thigh and not into it.
    r.arm[1][1] += L(6, 9) + 0.45 * Math.max(0, L(3, 10) - r.arm[1][0]);
    r.arm[1][2] = L(0, 6);
    r.elbow[1] = L(24, 46) + L(0.4, 0.5) * e;
  } else if (held?.carry === 'staff') {
    // Out from the hip and the elbow bent up a little more, so the butt rides beside the stride and not among the feet; and still
    // swung two fifths as far as a free arm rather than a prop held still at the side -- save side on to the left, where the
    // shaft in the far hand stands in front of the face and swung further it came within three units of its middle.
    const e = bend(1);
    steady(1, L(1, 0.85) * byFacing(STAFF_SWING, facing), L(-4, -2));
    r.arm[1][1] += 15;
    r.arm[1][2] = 0;
    r.elbow[1] = L(50, 56) + 0.2 * e;
  }
  if (shield && held?.carry !== 'bow') {
    const e = bend(0);
    steady(0, L(0.3, 0.3), L(8, 14));
    r.arm[0][1] += L(5, 4);
    r.arm[0][2] = L(0, 10);
    r.elbow[0] = L(34, 76) + 0.3 * e;
  }
  // And the arm with something in it out from the side as far as keeps it off the legs (see `clearOfLegs`), and as far as it is
  // already on its way out for a leg that is coming (`clearAhead`).
  if (held && held.carry !== 'shoulder') clearOfLegs(r, fr, held, facing, g, least);
}

/*
 * How far the arm with something in it is out from the side to keep it off
 * the legs, ahead of the leg that it is kept off. Taken out only by as much
 * as clears the leg now, the arm stood still until a thigh came at what it
 * held and then went out twenty or thirty degrees in a frame or two -- a
 * spear's hand and shaft nudged sideways once a stride. Now how far each
 * moment of the stride asks for is found once for each way of carrying it,
 * gait, facing and stride of `WALK_VARY` (sampled at `CLEAR_SAMPLES` points
 * round the stride), and the arm goes out no faster than `CLEAR_RATE`
 * degrees for each whole stride to be there in time, and comes back in no
 * faster either. (Found for the plain stride alone, it asked for too little
 * on strides whose arm swung further or nearer the side, and those took the
 * rest in a frame, ten degrees in a sixty-fourth of a stride.) Found all at
 * once the first time it was wanted, a table cost a frame three to twenty
 * milliseconds -- one dropped as an armed walker first turned or sped up.
 * Now `CLEAR_EACH` of its moments are found each time it is asked for, the
 * nearest the moment first (until then the rest ask for nothing, and the arm
 * only clears the leg as it is now); and once it is whole, the next stride's
 * and then those for the facings either side and the steps of gait up and
 * down, a few moments at a time, before the body comes to them. A stride's
 * pictures are not kept while its table is still being found (`clearReady`).
 */
const CLEAR_SAMPLES = 48, CLEAR_RATE = 150, CLEAR_EACH = 6;
interface Clearing {
  asks: Float32Array;
  found: Uint8Array;
  left: number;
  /** The most any of its moments asks for; and whether the ones to come after it have all been found. */
  most: number;
  ahead: boolean;
}
const clearings = new Map<string, Clearing>();
let clearingNow = false;
/** The table for carrying `p`'s weapon at gait `g` (a step of `GAIT_STEPS`), facing `facing` (one of the eight) and stride `v` of `WALK_VARY`. */
function clearingFor(p: FigurePose, fr: Frame, g: number, facing: number, v: number): Clearing {
  const key = `${p.gear?.weapon?.id}|${!!p.gear?.offhand}|${fr.fem}|${g}|${facing}|${v}`;
  let c = clearings.get(key);
  if (!c) {
    if (clearings.size > 2048) clearings.clear();
    c = { asks: new Float32Array(CLEAR_SAMPLES), found: new Uint8Array(CLEAR_SAMPLES), left: CLEAR_SAMPLES, most: 0, ahead: false };
    clearings.set(key, c);
  }
  return c;
}
/** Find up to `most` more of `c`'s moments, outward from the one nearest `u` of the stride, ahead before behind. */
function findClearing(c: Clearing, p: FigurePose, fr: Frame, g: number, facing: number, v: number, u: number, most: number): void {
  const at = Math.round(u * CLEAR_SAMPLES);
  clearingNow = true;
  try {
    for (let j = 0, made = 0; j < CLEAR_SAMPLES && made < most && c.left; j++) {
      const i = (((at + (j & 1 ? (j + 1) >> 1 : -(j >> 1))) % CLEAR_SAMPLES) + CLEAR_SAMPLES) % CLEAR_SAMPLES;
      if (c.found[i]) continue;
      clearedBy = 0;
      // Counted from stride `v` with no one's own start (`strideSeed`), so the walk is that stride's.
      rigOf({ ...p, id: undefined, emote: undefined, cast: undefined, phase: (v + i / CLEAR_SAMPLES) * TAU, gait: g, facing }, fr);
      c.asks[i] = clearedBy;
      c.most = Math.max(c.most, clearedBy);
      c.found[i] = 1;
      c.left--;
      made++;
    }
  } finally {
    clearingNow = false;
  }
}
/** The step of gait, the facing, the stride of `WALK_VARY` and how far through it, that `p`'s table is found for. */
function clearAt(p: FigurePose): [number, number, number, number] {
  const N = WALK_VARY.length, n = Math.floor(p.phase / TAU);
  return [Math.round(Math.max(0, Math.min(1, p.gait ?? 0)) * GAIT_STEPS) / GAIT_STEPS, ((Math.round(p.facing) % 8) + 8) % 8, (((n + strideSeed(p.id)) % N) + N) % N, p.phase / TAU - n];
}
function clearAhead(p: FigurePose, fr: Frame, w: Weapon): number {
  if (clearingNow) return 0;
  const [g, facing, v, u] = clearAt(p), N = WALK_VARY.length;
  // This stride's, and the ones either side of it, for looking ahead into the next and back into the last.
  const near = [clearingFor(p, fr, g, facing, (v + N - 1) % N), clearingFor(p, fr, g, facing, v), clearingFor(p, fr, g, facing, (v + 1) % N)];
  if (near[1].left) findClearing(near[1], p, fr, g, facing, v, u, CLEAR_EACH);
  else if (!near[1].ahead) {
    // Then the next stride's, the last's, and those it may turn or change pace into, a few moments at a time.
    const up = Math.min(1, Math.round(g * GAIT_STEPS + 1) / GAIT_STEPS), down = Math.max(0, Math.round(g * GAIT_STEPS - 1) / GAIT_STEPS);
    const next: Array<[number, number, number]> = [[g, facing, (v + 1) % N], [g, facing, (v + N - 1) % N]];
    for (let k = 0; k < N; k++) next.push([g, (facing + 1) % 8, (v + k) % N], [g, (facing + 7) % 8, (v + k) % N], [up, facing, (v + k) % N], [down, facing, (v + k) % N]);
    near[1].ahead = true;
    for (const [ng, nf, nv] of next) {
      const c = clearingFor(p, fr, ng, nf, nv);
      if (c.left) {
        findClearing(c, p, fr, ng, nf, nv, nv === v ? u : 0, CLEAR_EACH / 2);
        near[1].ahead = false;
        break;
      }
    }
  }
  // The most any moment asks for, less how far it is to go at `CLEAR_RATE`: only those near enough to ask for more are looked at.
  let most = 0;
  for (let t = 0; t < 3; t++) {
    const c = near[t], by = (c.most - most) / CLEAR_RATE;
    if (by <= 0) continue;
    const from = Math.max(0, Math.ceil((u - by + 1 - t) * CLEAR_SAMPLES)), to = Math.min(CLEAR_SAMPLES - 1, Math.floor((u + by + 1 - t) * CLEAR_SAMPLES));
    for (let i = from; i <= to; i++) most = Math.max(most, c.asks[i] - CLEAR_RATE * Math.abs(u - (t - 1 + i / CLEAR_SAMPLES)));
  }
  return most;
}
/** Whether a walking body's arm is as `clearAhead` will have it from now on: no table wanted, or this stride's table whole. */
function clearReady(p: FigurePose, fr: Frame): boolean {
  const w = p.gear?.weapon && weaponOf(p.gear.weapon.id);
  if (!w || w.carry === 'shoulder') return true;
  const [g, facing, v] = clearAt(p);
  return !clearingFor(p, fr, g, facing, v).left;
}

/* ---- a spell being cast ------------------------------------------------------- */

/** What lays a spell's cast over a pose: `./spells`, which registers itself so this file needs to know no spell. */
let castPoser: ((r: Rig, p: FigurePose) => void) | null = null;
export function castPosesBy(fn: ((r: Rig, p: FigurePose) => void) | null): void {
  castPoser = fn;
}

/**
 * A pose the other way about, left for right (`mirror`), for a cast played left-handed (`cast.mirror` in
 * ./spells/index): the pose under it mirrored, the cast's own written over that, and the two mirrored back, so
 * whatever the cast leaves alone comes back as it was.
 */
export const mirrorRig = (r: Rig): void => mirror(r);

/**
 * Which shoulder something heavy is over for `pose`, nought the left and one the right, between while it goes from
 * one to the other: as the body drawn as `pose.id` has it now (see `settle`), or as its facing puts it. Nothing when
 * nothing heavy is carried. What a cast played left-handed is decided by, alike for the body drawn and its effects.
 */
export function figureShoulder(pose: FigurePose): number | null {
  const w = pose.gear?.weapon && weaponOf(pose.gear.weapon.id);
  if (!w || w.carry !== 'shoulder') return null;
  const side = pose.id ? keptSide(pose.id) : undefined;
  return side ?? (overLeft(pose.facing) ? 0 : 1);
}

/** Where the ankles stand at rest for a look, in the body's frame from the middle of its feet: for a pose that steps (`stepIn` in ./spells/poses). */
export function figureStance(look: Look = DEFAULT_LOOK): [V3, V3] {
  return stance(frameOf(look));
}

/**
 * Both feet of a pose being written put down at `feet` (in the body's frame from the middle of its feet, as
 * `figureStance` gives them), the legs solved to them from the hips as the pose has them, and the hips let down as
 * far as leaves the leg taking the weight -- the right at `on` one, the left at minus one -- bent `bend` degrees.
 */
export function standFeet(r: Rig, feet: [V3, V3], o: { on?: number; bend?: number; look?: Look } = {}): void {
  standOn(r, frameOf(o.look ?? DEFAULT_LOOK), feet, o.on ?? 0, o.bend ?? 6);
}

/**
 * The cast over the pose. On the move -- walking, swimming, driving -- only the arms and the trunk are the
 * spell's: the legs, the hips and the body's height are put back as the motion had them, so a spell cast on the
 * run neither stops the feet nor lifts them off the ground.
 */
function castOver(r: Rig, p: FigurePose, poser: (r: Rig, p: FigurePose) => void): void {
  const moving = p.moving || p.swimming || !!p.driving;
  // Copied, not kept by reference: a pose writes into the arrays it is handed (`r.leg[0] = ...`, `r.at[1] += ...`), and
  // kept by reference the walk's own legs were the cast's -- the feet jumped on the first frame of a cast on the move,
  // slid while it lasted and jumped back at its end.
  const keep = moving ? {
    at: [...r.at] as V3, pelvis: [...r.pelvis] as Euler, leg: [[...r.leg[0]], [...r.leg[1]]] as [Euler, Euler], knee: [...r.knee] as [number, number],
    foot: [...r.foot] as [number, number], flat: [...r.flat] as [boolean, boolean], lift: r.lift, sink: r.sink,
    hover: r.hover && { ...r.hover }, plant: r.plant && ([...r.plant] as [number, number]), tail: [...r.tail] as Euler,
  } : null;
  poser(r, p);
  if (keep) Object.assign(r, keep);
}

/*
 * What a cast asks of the body besides its joints' turns: down on one knee,
 * a hand put at a place, the other hand on the haft. Each is solved here,
 * after the cast is laid over the pose and blended in, for the body's own
 * build -- a hand put on a haft is on it whether the shoulders are a man's
 * or a woman's -- and each only when a cast asks for it.
 */

/**
 * Seed `r.reach` with each hand as it is now -- where its middle is, the way its elbow is out from the line of the arm,
 * the way a haft through its fist would run -- nought of the way there, for a cast's goals to be blended in from: what a
 * goal gives is blended from these (`castOver` in ./spells/index), so the hand sets off from where it was.
 */
function seedReach(r: Rig, fr: Frame): void {
  const b = skeleton(fr, r);
  r.reach = [0, 1].map((k) => {
    const sh = b[`arm${k}`].t, el = b[`elbow${k}`].t, m = b[`wrist${k}`].m;
    return { at: place(b[`wrist${k}`], [0, 0, GRIP]), w: 0, pole: [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]], haft: [m[1], m[4], m[7]] };
  }) as [HandGoal, HandGoal];
}

function castExtras(r: Rig, p: FigurePose, fr: Frame): void {
  const moving = p.moving || p.swimming || !!p.driving;
  if ((r.kneel ?? 0) > 0 && !moving && !r.sit) kneelDown(r, fr, Math.min(1, r.kneel ?? 0));
  if (r.reach) {
    const goals = r.reach;
    delete r.reach;
    for (let k = 0; k < 2; k++) {
      const g = goals[k];
      if (g && (g.w ?? 1) > 0) reachTo(r, fr, k, g);
    }
  }
  if ((r.both ?? 0) > 0) bothHands(r, p, fr);
}

/** From the body's frame (the feet's, as `skeleton` builds it) into its hips' own, which `hold` works in: a place, or with `dir` a way. */
const hipsInto = (b: Bones, v: V3, dir = false): V3 => {
  const m = b.pelvis.m, t = b.pelvis.t;
  const d: V3 = dir ? v : [v[0] - t[0], v[1] - t[1], v[2] - t[2]];
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
};

/**
 * Hand `k` put at `g.at` -- the middle of the hand, in the body's frame from the middle of its feet -- with the two-bone
 * solve that puts a hand on reins and oars (`hold`), and `g.w` of the way from where the pose had the arm.
 */
function reachTo(r: Rig, fr: Frame, k: number, g: HandGoal): void {
  const s = k ? 1 : -1, w = Math.min(1, g.w ?? 1);
  if (g.stoop) stoopTo(r, fr, k, g.at, w);
  const b = skeleton(fr, r);
  const want = hipsInto(b, g.at);
  /*
   * The elbow where the goal says, or else where the pose's own elbow is -- out from the line of the arm, and a little
   * down, back and out of its own side for an arm held straight, where that says nothing -- so a goal blended in from
   * where the hand was starts from the arm as it was, rather than swinging the elbow round to somewhere else first.
   */
  let pole: V3;
  if (g.pole) pole = hipsInto(b, g.pole, true);
  else {
    const { sh, el } = armNow(r, fr, k), d = hipsInto(b, [s * 0.5, -0.35, -0.8], true);
    pole = [el.t[0] - sh.t[0] + 0.3 * d[0], el.t[1] - sh.t[1] + 0.3 * d[1], el.t[2] - sh.t[2] + 0.3 * d[2]];
  }
  const haft = g.haft && hipsInto(b, g.haft, true);
  const was = { arm: [...r.arm[k]] as Euler, elbow: r.elbow[k], hand: [...r.hand[k]] as Euler };
  // The wrist that puts the middle of the hand there, found by moving it by however far the hand misses, a few times over.
  let wrist = want;
  for (let q = 0; q < 3; q++) {
    const fist = place(hold(r, fr, k, wrist, pole, haft), [0, 0, GRIP]);
    wrist = [wrist[0] + want[0] - fist[0], wrist[1] + want[1] - fist[1], wrist[2] + want[2] - fist[2]];
  }
  hold(r, fr, k, wrist, pole, haft);
  if (w < 1) {
    const n = (a: number, c: number): number => a + (c - a) * w;
    r.arm[k] = [n(was.arm[0], r.arm[k][0]), n(was.arm[1], r.arm[k][1]), n(was.arm[2], r.arm[k][2])];
    r.elbow[k] = n(was.elbow, r.elbow[k]);
    r.hand[k] = [n(was.hand[0], r.hand[k][0]), n(was.hand[1], r.hand[k][1]), n(was.hand[2], r.hand[k][2])];
  }
}

/** Arm `k`'s shoulder, elbow and wrist as the pose has them, in the hips' frame, as `hold` builds them. */
function armNow(r: Rig, fr: Frame, k: number): { sh: Xf; el: Xf; wr: Xf } {
  const T = fr.tall, s = k ? 1 : -1;
  const chest = joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const sh = joint(chest, [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]], r.arm[k][0], -s * r.arm[k][1], s * r.arm[k][2]);
  const el = joint(sh, [0, 0, -UPPER * T], r.elbow[k]);
  return { sh, el, wr: joint(el, [0, 0, -LOWER * T]) };
}

/** How far forward the trunk may bow for a hand to reach somewhere (`HandGoal.stoop`), in degrees, and the spine's share of it (the chest takes the rest). */
const STOOP_MOST = 75, STOOP_SPINE = 0.6;

/**
 * The trunk bowed forward over the hips, spine and chest together, as little
 * as brings `at` within reach of hand `k`'s shoulder -- the arm all but
 * straight, and the hand's middle past the wrist -- and `w` of that.
 */
function stoopTo(r: Rig, fr: Frame, k: number, at: V3, w: number): void {
  const T = fr.tall, most = 0.97 * (UPPER + LOWER) * T - GRIP;
  const s0 = r.spine[0], c0 = r.chest[0];
  const bow = (a: number): number => {
    r.spine[0] = s0 - STOOP_SPINE * a;
    r.chest[0] = c0 - (1 - STOOP_SPINE) * a;
    const sh = skeleton(fr, r)[`arm${k}`].t;
    return Math.hypot(at[0] - sh[0], at[1] - sh[1], at[2] - sh[2]) - most;
  };
  if (bow(0) <= 0) return;
  // Halved toward the least bow that reaches, or as far as it goes.
  let lo = 0, hi = STOOP_MOST;
  if (bow(hi) > 0) lo = hi;
  else for (let q = 0; q < 8; q++) { const mid = (lo + hi) / 2; if (bow(mid) > 0) lo = mid; else hi = mid; }
  bow(hi * w);
}

/**
 * The second hand on the haft (`Rig.both`): for a spear taken by the arms, the shaft already runs through it and the hand only
 * closes on it; for anything else, the hand is put on the haft `bothAt` from the first fist -- by default below it toward the
 * butt where the grip is long enough, under the pommel where it is not, or up the haft of an axe or a maul held by its end --
 * and closed on it there.
 */
function bothHands(r: Rig, p: FigurePose, fr: Frame): void {
  const arm = p.gear?.weapon && weaponOf(p.gear.weapon.id);
  if (!arm || arm.carry === 'bow' || r.stowed || r.thrown) return;
  const both = Math.min(1, r.both ?? 0);
  const b = skeleton(fr, r);
  const held = heldFrame(r, b, arm, p.facing);
  if (!held) return;
  const k = 1 - held.hand, xf = held.xf;
  const along: V3 = [xf.m[2], xf.m[5], xf.m[8]];
  if (arm.carry === 'staff' && (r.wieldStaff ?? 0) > 0) {
    // The hand where the pose has it, turned to close on the shaft: `hold` to where the wrist already is, the elbow where it already is.
    const { sh, el, wr } = armNow(r, fr, k);
    const was = { arm: [...r.arm[k]] as Euler, elbow: r.elbow[k], hand: [...r.hand[k]] as Euler };
    hold(r, fr, k, wr.t, [el.t[0] - sh.t[0], el.t[1] - sh.t[1], el.t[2] - sh.t[2]], hipsInto(b, along, true));
    const turned = r.hand[k];
    r.arm[k] = was.arm;
    r.elbow[k] = was.elbow;
    r.hand[k] = [was.hand[0] + (turned[0] - was.hand[0]) * both, was.hand[1] + (turned[1] - was.hand[1]) * both, was.hand[2] + (turned[2] - was.hand[2]) * both];
  } else {
    // Where along it the first fist is: nought, or a shouldered weapon's `fist`; less however far it is slid through.
    const first = (arm.carry === 'shoulder' ? arm.fist ?? 0 : 0) - (r.slide ?? 0);
    const room = arm.from - first;
    // Below the first fist where the grip runs on far enough, a fist apart or as near the end as leaves the end in the hand; a
    // short grip's end cupped in the palm under the pommel; and up the haft of what is held by the end of it, an axe's or a maul's.
    const by = r.bothAt ?? (room <= -1.5 ? Math.max(-1.5, room + 0.5) : arm.carry === 'fist' ? room - 0.3 : 1.6);
    reachTo(r, fr, k, { at: place(xf, [0, 0, first + by]), haft: along, pole: [(k ? 1 : -1) * 0.6, -0.2, -0.75], w: both });
  }
  // Closed on it.
  r.open[k] = +r.open[k] * (1 - both);
  if (both >= 0.5) r.loose[k] = false;
}

/** How far the round of the knee stands out from its joint, under it, kneeling: what it is stood on. */
const KNEE_ROUND = 0.84;
/** Kneeling: how far behind upright the thigh of the knee that is down is, the shin of the foot that is flat ahead, and how far the toes behind point down from straight back, in degrees. */
const KNEEL_THIGH = -8, KNEEL_SHIN = -6, KNEEL_TOE = -80;
/** Where the ball of the foot is, under the toes, in the ankle's frame (see `footMesh`). */
const TOE_SOLE: V3 = [0, 1.72 * 1.04, -0.75];

/**
 * Down on one knee, `w` of the way from the pose's legs: the thigh of the
 * knee that is down hanging all but straight from the hip, the knee on the
 * ground, the shin back along it and the toes tucked under, the foot all but
 * upright on the ball of it; the other thigh out ahead all but level, its
 * shin upright and its foot flat. Solved in the leg's own plane for this
 * build: the knee's round and the ball of the foot behind it on one ground,
 * and the sole ahead on the same ground. The body is let down onto it by
 * `skeleton`, which stands a kneeling body on whatever of it is lowest,
 * knee or sole.
 */
function kneelDown(r: Rig, fr: Frame, w: number): void {
  const T = fr.tall, A = THIGH * T, B = SHIN * T, p0 = r.pelvis[0];
  const down = r.kneelLeft ? 0 : 1, ahead = 1 - down;
  // The shin back from the knee as far up as puts the ball of the foot, turned toes down, on the ground the knee is on.
  const psi = KNEEL_TOE * DEG, toe = TOE_SOLE[1] * Math.sin(psi) + TOE_SOLE[2] * Math.cos(psi);
  const phi = -Math.acos(Math.max(-1, Math.min(1, (toe + KNEE_ROUND) / B))) / DEG;
  // The hips that high over the ground, from the thigh hanging to the knee; the leg ahead reaching down to it.
  const H = A * Math.cos(KNEEL_THIGH * DEG) + KNEE_ROUND;
  const thigh = Math.acos(Math.max(-1, Math.min(1, (H - B * Math.cos(KNEEL_SHIN * DEG) - 0.75) / A))) / DEG;
  const want: Array<{ leg: Euler; knee: number; foot: number; flat: boolean }> = [];
  want[down] = { leg: [KNEEL_THIGH - p0, 4, 0], knee: KNEEL_THIGH - phi, foot: KNEEL_TOE - phi, flat: false };
  want[ahead] = { leg: [thigh - p0, 6, -6], knee: thigh - KNEEL_SHIN, foot: 0, flat: true };
  const n = (a: number, c: number): number => a + (c - a) * w;
  for (let k = 0; k < 2; k++) {
    const x = want[k], [lp] = r.leg[k];
    // The pose's foot as the turn at the ankle it comes to, for a foot that is kept level as well as one that is not.
    const was = r.flat[k] ? -(p0 + lp - r.knee[k]) + r.foot[k] : r.foot[k];
    r.leg[k] = [n(r.leg[k][0], x.leg[0]), n(r.leg[k][1], x.leg[1]), n(r.leg[k][2], x.leg[2])];
    r.knee[k] = n(r.knee[k], x.knee);
    if (x.flat && r.flat[k]) r.foot[k] = n(r.foot[k], 0);
    else {
      const level = x.flat ? -(p0 + r.leg[k][0] - r.knee[k]) : x.foot;
      r.foot[k] = n(was, level);
      r.flat[k] = false;
    }
  }
}

/** The bones and the weapon's frame for one pose, found once for however many points are asked of them. */
function posedFor(pose: FigurePose): { b: Bones; r: Rig; held: () => { xf: Xf; hand: number; arm: Weapon } | null } {
  const fr = frameOf(pose.look ?? DEFAULT_LOOK);
  // A body drawn as `pose.id` with something heavy on its way between the shoulders, or kept on the one it was on while a
  // spell is cast: on that shoulder here too, so a spell's effects find the weapon where it is drawn.
  const side = pose.id ? keptSide(pose.id) : undefined;
  const r = rigOf(pose, fr, undefined, side === undefined ? {} : { side });
  const b = skeleton(fr, r);
  let held: { xf: Xf; hand: number; arm: Weapon } | null | undefined;
  return {
    b, r,
    held: () => {
      if (held === undefined) {
        const arm = pose.gear?.weapon && weaponOf(pose.gear.weapon.id);
        const h = arm ? heldFrame(r, b, arm, pose.facing) : null;
        held = h && arm ? { ...h, arm } : null;
      }
      return held;
    },
  };
}

/** One point of a posed body: a bone's, or one of what is held (see `figureJoint`). */
function jointOn(f: ReturnType<typeof posedFor>, bone: string, at: V3): V3 {
  const xf = f.b[bone];
  if (xf) return place(xf, at);
  if (!HELD_POINTS.has(bone)) return [0, 0, 0];
  const h = f.held();
  // Nothing held, or it is put away: the right fist stands for it.
  if (!h) return place(f.b.wrist1, [at[0], at[1], GRIP + at[2]]);
  const { xf: w, arm } = h;
  const plus = (p: V3): V3 => place(w, [p[0] + at[0], p[1] + at[1], p[2] + at[2]]);
  switch (bone) {
    case 'tip': return plus([0, 0, arm.to]);
    case 'butt': return plus([0, 0, arm.from]);
    case 'grip': return place(f.b[`wrist${h.hand}`], [at[0], at[1], GRIP + at[2]]);
    case 'bowBottom': return plus(arm.tips?.[0] ?? [0, 0, arm.from]);
    case 'bowTop': return plus(arm.tips?.[1] ?? [0, 0, arm.to]);
    case 'nock': case 'arrow': {
      const lo = place(w, arm.tips?.[0] ?? [0, 0, arm.from]), hi = place(w, arm.tips?.[1] ?? [0, 0, arm.to]);
      const nock = nockOf(f.r, f.b, arm, w) ?? [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      if (bone === 'nock') return [nock[0] + at[0], nock[1] + at[1], nock[2] + at[2]];
      const rest = place(w, arm.rest ?? [0, 0, 0]), d = unit([rest[0] - nock[0], rest[1] - nock[1], rest[2] - nock[2]]), L = (arm.arrow ?? 7) + at[2];
      return [nock[0] + d[0] * L, nock[1] + d[1] * L, nock[2] + d[2] * L];
    }
  }
  return plus([0, 0, 0]);
}
/** The points of what is held that `figureJoint` knows besides the bones. */
const HELD_POINTS = new Set(['weapon', 'tip', 'butt', 'grip', 'bowTop', 'bowBottom', 'nock', 'arrow']);

/**
 * Where a point in a bone's frame is, on a body posed so, in the body's own units from the middle of its feet:
 * x to its right, y ahead of it, z up. For what a spell draws at a hand, the head or a weapon's point (`./spells`).
 * Bones: pelvis, spine, chest, neck, head, arm0/1, elbow0/1, wrist0/1, hip0/1, knee0/1, ankle0/1 (0 the left).
 *
 * And what is held, wherever its carry and the cast put it: `weapon` (`at` in the weapon's own frame, z along it
 * from its butt to its point, nought where the fist closes), `tip` and `butt` (its ends, `at` added in its frame),
 * `grip` (the middle of the fist holding it), `bowTop` and `bowBottom` (where the string is made fast), `nock`
 * (where the string is, drawn or not) and `arrow` (the point of an arrow on it; `at[2]` further along). With
 * nothing in the hands, or it put away, each of these is the right fist.
 */
export function figureJoint(pose: FigurePose, bone: string, at: V3 = [0, 0, 0]): V3 {
  return jointOn(lastPosed(pose), bone, at);
}

/**
 * The last body posed for `figureJoint`, kept for the next call that asks of the same pose: a spell's effects ask
 * for a hand, the head and a blade's trail a point at a time, each with a pose made afresh (`./spells/stage`), and
 * each was a whole cast laid over the body and a skeleton built for one point.
 */
let posed: { pose: FigurePose; f: ReturnType<typeof posedFor> } | null = null;
const POSE_KEYS = ['phase', 'moving', 'gait', 'facing', 'swimming', 'working', 'driving', 'seat', 'look', 'gear', 'emote', 'emoteT', 'tunic', 'trousers'] as const;
function lastPosed(pose: FigurePose): ReturnType<typeof posedFor> {
  const was = posed?.pose;
  if (posed && was && POSE_KEYS.every((k) => was[k] === pose[k]) && was.cast?.id === pose.cast?.id && was.cast?.t === pose.cast?.t) return posed.f;
  posed = { pose, f: posedFor(pose) };
  return posed.f;
}

/** Several points of one posed body (see `figureJoint`), the body posed once for all of them: a blade's trail, a bow's tips and string. */
export function figureJoints(pose: FigurePose, wants: ReadonlyArray<string | readonly [string, V3]>): V3[] {
  const f = posedFor(pose);
  return wants.map((w) => (typeof w === 'string' ? jointOn(f, w, [0, 0, 0]) : jointOn(f, w[0], w[1])));
}

/**
 * The body's proportions for a look, in its own units, for a pose that places a hand by position and wants to
 * match the figure: the hips' joint over the soles standing straight, the spine and chest joints up from it, the
 * right shoulder in the chest's frame (the left is its mirror), the upper arm and the forearm, the fist's middle
 * below the wrist, the right hip joint in the hips' frame, the thigh and the shin.
 */
export function figureProportions(look: Look = DEFAULT_LOOK): {
  hips: number; spine: number; chest: number; shoulder: V3; upper: number; lower: number; fist: number; hip: V3; thigh: number; shin: number;
} {
  const fr = frameOf(look), T = fr.tall;
  return {
    hips: (THIGH + SHIN) * T + 0.1 + 0.75, spine: SPINE * T, chest: CHEST * T, shoulder: [2.1 * fr.sh, -0.1, ARM_AT * T],
    upper: UPPER * T, lower: LOWER * T, fist: -GRIP, hip: [fr.hi, 0, -0.1], thigh: THIGH * T, shin: SHIN * T,
  };
}

/**
 * Put hand `k` of a pose being written at `at` now, as `Rig.reach` does after the pose (see there), for the look
 * given or the plain one: for a pose that goes on to work from where the arm then is. The legs and trunk are taken
 * as the pose has them so far.
 */
export function reachHand(r: Rig, k: number, at: V3, o: { pole?: V3; haft?: V3; w?: number; look?: Look } = {}): void {
  reachTo(r, frameOf(o.look ?? DEFAULT_LOOK), k, { at, pole: o.pole, haft: o.haft, w: o.w });
}

/**
 * The turn of arm `k` (`Rig.arm[k]`) that points the upper arm along `dir`, in the chest's frame (x to the right, y
 * ahead, z up), with the elbow hinged so the forearm bends toward `bend` (ahead when left out). `arm[k]` is a
 * pitch forward, then a roll out, then a yaw, each about the chest's axes: raised past level ahead, a roll "out"
 * carries the arm across the body instead. Pointing the arm says where it goes whatever that place is.
 */
export function armToward(k: number, dir: V3, bend: V3 = [0, 1, 0]): Euler {
  const s = k ? 1 : -1, u = unit(dir);
  let q = unit(bend);
  if (Math.abs(dot(q, u)) > 0.97) q = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  // The elbow's hinge square to the arm and to the way the forearm bends; then the frame `hold` turns into a pitch, a roll and a yaw.
  const p: V3 = unit([-(q[0] - u[0] * dot(q, u)), -(q[1] - u[1] * dot(q, u)), -(q[2] - u[2] * dot(q, u))]);
  const x = unit(cross(p, u)), z: V3 = [-u[0], -u[1], -u[2]], y = cross(z, x);
  return [Math.atan2(y[2], z[2]) / DEG, (s * Math.asin(Math.max(-1, Math.min(1, x[2])))) / DEG, (s * Math.atan2(x[1], x[0])) / DEG];
}

/* ---- one pose into the next -------------------------------------------------- */

/**
 * What a body is doing, as far as blending goes: a change of it is blended.
 * Swimming and driving are each two things, under way and stopped: one name
 * for both let the breaststroke drop to treading water, and an oar or the
 * reins jump from the middle of a stroke to lying still, in one frame.
 */
const doing = (p: FigurePose): string => (p.swimming ? (p.moving ? 'swim' : 'tread') : p.driving ? (p.moving ? 'drive' : 'drive still') : p.moving ? 'walk' : p.working ? (p.job === MEDITATE ? MEDITATE : 'work') : 'idle');

/**
 * And the either/or choices made in it: work done left-handed (`left`, see `settle`), the emote, and the arm a wave is made with
 * (`arm`). Each is a different pose rather than a different amount of one, so a change of any of them is blended as a change of
 * what is being done is, rather than cut. Which shoulder something heavy is over is not among them: blended joint by joint, its
 * head went through the skull on the way, so it goes from the one to the other on a way of its own (see `shoulder`).
 */
const doingAt = (p: FigurePose, left: boolean, arm?: number): string =>
  `${doing(p)}|${p.working && left ? 'left' : ''}|${p.emote ?? ''}${p.emote === 'wave' ? arm ?? '' : ''}`;

/** Seconds to blend from one thing to the next, and to come round one eighth of a turn. */
const BLEND = 0.22;
const TURN = 0.11;
const TURN_STANDING = 0.16;

function mixRig(a: Rig, b: Rig, w: number): Rig {
  const n = (x: number, y: number): number => x + (y - x) * w;
  const e = (x: Euler, y: Euler): Euler => [n(x[0], y[0]), n(x[1], y[1]), n(x[2], y[2])];
  /*
   * Where what is in the hands changes. A weapon put away for work or the reins went at the start of the blend and the tools
   * came at the half way, so for a tenth of a second neither was in the hands; and coming back from work the sword was back in a
   * hand still raised at the chisel, its blade across the belly. Now the weapon goes and the tools come at the same moment, and
   * at the end where the hand is down where the weapon is held: a quarter of the way into work, three quarters out of it.
   * Otherwise -- work changing hands at a blow -- at the half way, where the two hands are passing at the work (see `settle`).
   */
  const swap = a.stowed === b.stowed ? 0.5 : a.stowed ? 0.75 : 0.25;
  return {
    at: e(a.at, b.at), pelvis: e(a.pelvis, b.pelvis), spine: e(a.spine, b.spine), chest: e(a.chest, b.chest), neck: e(a.neck, b.neck), head: e(a.head, b.head),
    arm: [e(a.arm[0], b.arm[0]), e(a.arm[1], b.arm[1])], elbow: [n(a.elbow[0], b.elbow[0]), n(a.elbow[1], b.elbow[1])], hand: [e(a.hand[0], b.hand[0]), e(a.hand[1], b.hand[1])],
    leg: [e(a.leg[0], b.leg[0]), e(a.leg[1], b.leg[1])], knee: [n(a.knee[0], b.knee[0]), n(a.knee[1], b.knee[1])], foot: [n(a.foot[0], b.foot[0]), n(a.foot[1], b.foot[1])],
    flat: b.flat, tail: e(a.tail, b.tail), lift: n(a.lift, b.lift), sink: n(a.sink, b.sink), blink: b.blink, reins: b.reins,
    tool: w < swap ? a.tool : b.tool, lefty: w < 0.5 ? a.lefty : b.lefty,
    // A float or a seat is taken at once, from the start of the blend, so the body is let into the water or onto the seat by it rather than
    // dropped on at the end; from one float to another -- swimming to treading water -- the head goes from the one height to the other.
    float: a.float !== undefined && b.float !== undefined ? n(a.float, b.float) : b.float ?? a.float,
    under: a.under !== undefined && b.under !== undefined ? n(a.under, b.under) : b.under,
    sit: b.sit && { ...b.sit, up: a.sit ? n(a.sit.up, b.sit.up) : b.sit.up }, seat: b.seat,
    // What is in the hands comes with the pose it is held in: an oar swung from where it was to where it goes, and turned flat or square
    // on the way, and the reins taken up or let go, rather than either put down at once.
    oars: a.oars && b.oars && a.oars.length === b.oars.length
      ? b.oars.map((o, i) => ({ ...o, out: e(a.oars![i].out, o.out), feather: n(a.oars![i].feather, o.feather) }))
      : b.oars,
    tiller: a.tiller && b.tiller ? { ...b.tiller, end: e(a.tiller.end, b.tiller.end) } : b.tiller,
    slack: a.slack !== undefined && b.slack !== undefined ? n(a.slack, b.slack) : b.slack,
    // Carried on the curve as much as the walk being blended into or out of is, so that stopping in the air at a run comes down
    // over the blend rather than dropping onto the lower foot at once.
    hover: b.hover ? { ...b.hover, w: b.hover.w * w } : a.hover && { ...a.hover, w: a.hover.w * (1 - w) },
    shrug: [n(a.shrug[0], b.shrug[0]), n(a.shrug[1], b.shrug[1])], open: [n(+a.open[0], +b.open[0]), n(+a.open[1], +b.open[1])],
    // A loose hand changes to a fist three quarters of the way through, curling closed toward it before then, rather than at the
    // start, where a running fist opened in a frame as the body began to stop.
    loose: w < 0.75 ? a.loose : b.loose,
    curl: [n(a.loose[0] ? a.curl[0] : 1, b.loose[0] ? b.curl[0] : 1), n(a.loose[1] ? a.curl[1] : 1, b.loose[1] ? b.curl[1] : 1)],
    stowed: w < swap ? a.stowed : b.stowed, stowing: a.stowed === b.stowed || a.tool === b.tool ? undefined : b.stowed ? w : 1 - w,
    // Something heavy goes from one shoulder's hand to the other's half way, where the one coming down passes the one going up.
    carried: w < 0.5 ? a.carried : b.carried, spin: w < 0.5 ? a.spin : b.spin, swapping: w < 0.5 ? a.swapping : b.swapping,
    plant: b.plant ? [b.plant[0] * w, b.plant[1] * w] : a.plant && [a.plant[0] * (1 - w), a.plant[1] * (1 - w)], ground: b.ground ?? a.ground,
    // A cast's asks, blended as a cast blends them in (from nought where one pose has none), so stopping or setting off in the
    // middle of a cast neither drops a blade back to its carry nor straightens a knee that is down; a switch goes over half way.
    wield: some(a.wield, b.wield, n), wieldStaff: some(a.wieldStaff, b.wieldStaff, n), wieldBow: some(a.wieldBow, b.wieldBow, n),
    both: some(a.both, b.both, n), bothAt: some(a.bothAt, b.bothAt, n), haft: some(a.haft, b.haft, n), slide: some(a.slide, b.slide, n),
    draw: some(a.draw, b.draw, n), mouth: some(a.mouth, b.mouth, n), kneel: some(a.kneel, b.kneel, n),
    nocked: w < 0.5 ? a.nocked : b.nocked, thrown: w < 0.5 ? a.thrown : b.thrown, kneelLeft: w < 0.5 ? a.kneelLeft : b.kneelLeft,
    arrowHand: w < 0.5 ? a.arrowHand : b.arrowHand, stow: some(a.stow, b.stow, n),
    shape: a.shape || b.shape ? [0, 1].map((k) => {
      const x = a.shape?.[k], y = b.shape?.[k];
      return x || y ? Object.fromEntries(HAND_SHAPES.map((s) => [s, n(x?.[s] ?? 0, y?.[s] ?? 0)])) : undefined;
    }) as Rig['shape'] : undefined,
  };
}

/** Two of a number a pose may leave out, blended from nought where one leaves it out, and left out where both do. */
const some = (a: number | undefined, b: number | undefined, n: (x: number, y: number) => number): number | undefined =>
  a === undefined && b === undefined ? undefined : n(a ?? 0, b ?? 0);

/**
 * From swimming to treading water and back, which in the water is not done
 * in the time it takes to stop walking: the blend took the body from lying
 * along the surface to upright in a fifth of a second, which read as being
 * snapped upright on a string. Now it takes most of a second, and the arms go
 * first and the body after them: stopping, the hands come round out to the
 * sides while the legs are still sinking under; setting off, the hands reach
 * forward and the body tips up along the surface behind them.
 */
const WATER_BLEND = 0.6;
function mixWater(a: Rig, b: Rig, t: number, fr: Frame): Rig {
  /*
   * Setting off, the arms went first too, and the stroke's arms are set
   * against a body lying along the surface: put on one still upright, "out
   * ahead along the glide" is up at the shoulders in front of the chest, so
   * both forearms and fists came up out of the water and reached forward for
   * a third of a second. So setting off is the other way about: the body tips
   * forward first, the arms coming round under it after, and they are at
   * the stroke only once it is lying along the water.
   */
  const off = (b.under ?? 0) > (a.under ?? 0);
  const wa = ease(off ? Math.max(0, (t - 0.3) / 0.7) : Math.min(1, t / 0.65));
  const arms = mixRig(a, b, wa);
  const body = mixRig(a, b, ease(off ? Math.min(1, t / 0.6) : Math.max(0, (t - 0.25) / 0.75)));
  const r: Rig = { ...body, arm: arms.arm, elbow: arms.elbow, hand: arms.hand, shrug: arms.shrug };
  /*
   * But the arms' angles are the chest's, and the chest is part way between upright and lying along the water: tread's "down
   * and out to the side" on a chest tipped flat is forward along the surface, so a forearm and an open hand came up through it
   * for a sixth of a second, setting off, waving. Either order breaks somewhere. So the hands are not blended as angles at all
   * but as where they are in the water -- across, ahead of the head, under the surface -- from where each pose has them, and
   * kept a forearm's depth under it all the way; the arm is put to them on the body as it is, the elbow and the hand turned
   * as the two poses turn them between, the fingers never up.
   */
  const A = skeleton(fr, a), B = skeleton(fr, b);
  for (let k = 0; k < 2; k++) {
    const p = inWater(A, a, k), q = inWater(B, b, k);
    const at = mixV(p.at, q.at, wa), pole = mixV(p.pole, q.pole, wa), fingers = mixV(p.fingers, q.fingers, wa);
    at[2] = Math.min(at[2], HANDS_UNDER);
    fingers[2] = Math.min(fingers[2], 0);
    swimHand(r, fr, k, at, pole);
    aimHand(r, fr, k, fingers, mixV(p.back, q.back, wa));
  }
  return r;
}
/** How far under the surface a swimmer's wrists are kept going from swimming to treading water or back: a forearm's depth less a hand. */
const HANDS_UNDER = -0.75;
const mixV = (a: V3, b: V3, w: number): V3 => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
/**
 * Where a swimmer's hand `k` is in the water, as `swimHand` takes it -- the wrist across from the middle, ahead of the head
 * and up from the surface, the elbow's way out from the line of the arm -- and which way its fingers run and the back of it
 * faces, as `aimHand` takes them.
 */
function inWater(b: Bones, r: Rig, k: number): { at: V3; pole: V3; fingers: V3; back: V3 } {
  const s = k ? 1 : -1, w = b[`wrist${k}`], e = b[`elbow${k}`].t, sh = b[`arm${k}`].t, m = w.m;
  const water = b.head.t[2] - (r.float ?? 0);
  return {
    at: [s * w.t[0], w.t[1] - b.head.t[1], w.t[2] - water],
    pole: [s * (e[0] - (sh[0] + w.t[0]) / 2), e[1] - (sh[1] + w.t[1]) / 2, e[2] - (sh[2] + w.t[2]) / 2],
    fingers: [-m[2], -m[5], -m[8]],
    back: [s * m[0], s * m[3], s * m[6]],
  };
}

interface Held {
  doing: string;
  /** The pose last drawn, and the one a blend started from, and when. */
  rig: Rig;
  from: Rig;
  since: number;
  /** The way it faces as drawn, the way it is turning to, where the turn started and when. */
  facing: number;
  goal: number;
  turnFrom: number;
  turnSince: number;
  seen: number;
  /** How far the head and shoulders are turned ahead of the body toward where it is turning, in degrees: see `settle`. */
  lead: number;
  /** What it was doing before, and at what gait it last walked: a stop from a run brakes, a start shifts the weight first. */
  was: string;
  gait: number;
  /** Its feet as drawn, and how high its hips were drawn over them: see `footed`. */
  feet?: Foot[];
  hips?: number;
  /** Where the ground was under it last time it was drawn (`Rig.ground`). */
  ground?: [number, number];
  /** Working left-handed, as last changed at a blow, and how far the mallet hand is held down as the far one: see `settle`. */
  left: boolean;
  far: number;
  /** The arm a wave is being made with and the way the body faced as it was chosen, and where something heavy is between the shoulders: see `Kept`. */
  wave?: number;
  waveFrom?: number;
  waveFacing?: number;
  side: number;
  /** Whether the blend going on is from swimming to treading water or back, which is blended its own way (`mixWater`). */
  water?: boolean;
  /** The facing a blade in the fist is carried for: see `BLADE_TURN`. */
  blade?: number;
  /** Which way the elbow of the arm putting a weapon away or taking it out was last drawn out, in the hips' frame: see `stowHand`. */
  stowPole?: V3;
}

const held = new Map<string, Held>();
/** Where something heavy is between the shoulders for a body drawn as `id`, as `settle` keeps it; nothing for a body not drawn lately. */
const keptSide = (id: string): number | undefined => held.get(id)?.side;
const ease = (x: number): number => x * x * (3 - 2 * x);

/** Seconds a weapon takes to be put away in the hand for work, or taken out again: see `stowHand`. */
const STOW_TIME = 0.7;
/**
 * How much of that the hand has the weapon in it, carrying it to where it goes; and from how far through the mallet and the
 * chisel are in the hands, which have come back to the work by then.
 */
const STOW_CARRY = 0.55, STOW_TOOL = 0.85;
/** How fast the elbow of the arm doing it may go round the line of the arm, in degrees a second: see `stowHand`. */
const STOW_SWIVEL = 480;

/**
 * Putting a weapon away for work, `s` of the way (nought in the hand, one put away; taking it out again, the same the other
 * way): the hand it is carried in takes it to where it goes -- over its shoulder onto the back, to the scabbard, through the
 * belt -- and lets go of it there at `STOW_CARRY`, then comes on to the work. It went on its own in the third of a fifth of a
 * second the blend gave it, in a straight line through the body from the hand to the back, with the hands already at the work,
 * and a maul coming off the back was gone for a frame on the way.
 *
 * `r` is the blend of `held` (with the weapon in the hand) and `worked` (at the work); the arm with the weapon is turned from
 * the one to the other by way of the arm reaching to where the weapon goes. Which way the weapon lay as it was carried is kept
 * for `wield` (`Rig.stowTurn`).
 */
function stowHand(r: Rig, held: Rig, worked: Rig, s: number, fr: Frame, arm: Weapon, facing: number, fit: number, kept: { pole?: V3 }, most: number): Rig {
  const k = arm.carry === 'shoulder' ? held.carried : arm.carry === 'bow' ? 0 : 1, sd = k ? 1 : -1, T = fr.tall;
  // The weapon as that hand carries it: which way it lies in the chest's frame, and how far along it the fist is.
  const B0 = skeleton(fr, held), hf = heldFrame(held, B0, arm, facing);
  if (!hf) return r;
  const c0 = B0.chest.m, hm = hf.xf.m, fist0 = place(B0[`wrist${k}`], [0, 0, GRIP]);
  const out: Rig = {
    ...r, arm: [[...r.arm[0]], [...r.arm[1]]], elbow: [...r.elbow], hand: [[...r.hand[0]], [...r.hand[1]]],
    stowing: s, stowHand: k, stowed: s >= STOW_CARRY, tool: s >= STOW_TOOL, lefty: worked.lefty, carried: held.carried, spin: held.spin,
    stowTurn: mm([c0[0], c0[3], c0[6], c0[1], c0[4], c0[7], c0[2], c0[5], c0[8]], hm),
    stowAt: (fist0[0] - hf.xf.t[0]) * hm[2] + (fist0[1] - hf.xf.t[1]) * hm[5] + (fist0[2] - hf.xf.t[2]) * hm[8],
  };
  // An arm's shoulder, elbow and wrist in the hips' frame, which `hold` works in.
  const chestOf = (q: Rig): Xf => joint(joint(ROOT, [0, 0, SPINE * T], ...q.spine), [0, 0, CHEST * T], ...q.chest);
  const armOf = (q: Rig, j = k): { sh: V3; el: V3; wr: V3 } => {
    const [ap, aa, at] = q.arm[j], sj = j ? 1 : -1;
    const sh = joint(chestOf(q), [sj * 2.1 * fr.sh, -0.1, ARM_AT * T + q.shrug[j]], ap, -sj * aa, sj * at);
    const el = joint(sh, [0, 0, -UPPER * T], q.elbow[j]);
    return { sh: sh.t, el: el.t, wr: place(el, [0, 0, -LOWER * T]) };
  };
  // Where the fist's part of it is once put away, in the hips' frame, and the wrist that holds it there.
  const B = skeleton(fr, out), P = B.pelvis, at = place(awayFrame(out, B, arm, facing, fr, fit), [0, 0, out.stowAt ?? 0]);
  const into = (v: V3): V3 => [P.m[0] * v[0] + P.m[3] * v[1] + P.m[6] * v[2], P.m[1] * v[0] + P.m[4] * v[1] + P.m[7] * v[2], P.m[2] * v[0] + P.m[5] * v[1] + P.m[8] * v[2]];
  const grip = into([at[0] - P.t[0], at[1] - P.t[1], at[2] - P.t[2]]);
  const sh = armOf(out).sh, toSh = unit([sh[0] - grip[0], sh[1] - grip[1], sh[2] - grip[2]]);
  const W1: V3 = [grip[0] + toSh[0] * -GRIP, grip[1] + toSh[1] * -GRIP, grip[2] + toSh[2] * -GRIP];
  /*
   * The arm as it reaches there, the elbow forward of an arm reaching back over the shoulder and out and back of one reaching
   * down to the hip; and from as it carries to that, and from that to as it works, the wrist and the elbow each taken from the
   * one place to the other, bowed out and up past the shoulder, and the arm put to them. Put by the wrist alone, with the elbow's
   * way out turned between the two ends' about the arm, the wrist passed near the shoulder on its way to work raised behind the
   * ear, and the elbow went round three units in a frame; turned joint by joint, the upper arm went the other way round in a frame
   * wherever the two ends were near half a turn apart.
   */
  const ch = chestOf(out), onBack = !(arm.stow === 'hip' && cutsOf(arm).sheathed) && arm.stow !== 'belt';
  const lets: Rig = { ...out, arm: [[...out.arm[0]], [...out.arm[1]]], elbow: [...out.elbow], hand: [[...out.hand[0]], [...out.hand[1]]] };
  hold(lets, fr, k, W1, mv(ch.m, onBack ? [0.3 * sd, 1, -0.3] : [0.5 * sd, -1, -0.2]));
  const [a, b, v] = s < STOW_CARRY ? [armOf(held), armOf(lets), ease(s / STOW_CARRY)] : [armOf(lets), armOf(worked), ease((s - STOW_CARRY) / (1 - STOW_CARRY))];
  const bow = mv(ch.m, onBack ? [0.8 * sd, 0.3, 1.2] : [0.8 * sd, 0.5, 0]), arc = Math.sin(Math.PI * v);
  const wrist = [0, 1, 2].map((j) => a.wr[j] + (b.wr[j] - a.wr[j]) * v + bow[j] * arc) as V3;
  const elbow = [0, 1, 2].map((j) => a.el[j] + (b.el[j] - a.el[j]) * v + 0.6 * bow[j] * arc) as V3;
  /*
   * The elbow's way out from there, turned from the way it was last drawn out by `most` degrees at most: where the two ends'
   * elbows are on either side of the arm, the way between comes into line with it for a frame or two, and the elbow went round
   * three units in one. Free toward either end, where the way it wants is the pose's own.
   */
  let pole = [0, 1, 2].map((j) => elbow[j] - (sh[j] + wrist[j]) / 2) as V3;
  if (kept.pole) pole = swivel(sh, wrist, kept.pole, pole, 1, most * (1 + 8 * Math.pow(1 - arc, 4)));
  kept.pole = pole;
  hold(out, fr, k, wrist, pole);
  // The hand turned as it is to carry until it lets go, and from that to how it works after: blended from the one pose to the
  // other with the rest of the body, it went round half a turn and back about the wrist on the way.
  const h = nearTurn(worked.hand[k], held.hand[k]), hv = s < STOW_CARRY ? 0 : v;
  out.hand[k] = held.hand[k].map((x, j) => x + (h[j] - x) * hv) as Euler;
  out.arm[k] = nearTurn(out.arm[k], r.arm[k]);
  return out;
}

/**
 * An elbow's way out, `pole`, for the arm from `sh` to a wrist at `from`, laid square to that arm and turned with it, the
 * shortest way, to lie square to the arm with its wrist at `to` instead.
 */
function carriedWay(sh: V3, from: V3, pole: V3, to: V3): V3 {
  const a = unit([from[0] - sh[0], from[1] - sh[1], from[2] - sh[2]]), b = unit([to[0] - sh[0], to[1] - sh[1], to[2] - sh[2]]);
  const c = dot(pole, a), p = unit([pole[0] - a[0] * c, pole[1] - a[1] * c, pole[2] - a[2] * c]);
  const axis = cross(a, b), sn = Math.hypot(...axis), cs = dot(a, b);
  if (sn < 1e-6) return p;
  const n = unit(axis), th = Math.atan2(sn, cs), np = cross(n, p), nd = dot(n, p);
  return [0, 1, 2].map((j) => p[j] * Math.cos(th) + np[j] * Math.sin(th) + n[j] * nd * (1 - Math.cos(th))) as V3;
}

/**
 * Which way an elbow is out, for an arm from `sh` to the wrist at `wr`, `v` of the way from `a` to `b`: each laid square to the
 * line of the arm first and turned from the one to the other about it. Blended as they stood, the way between could come near
 * pointing along the arm, where the least change of it swings the elbow right round, and an elbow went one and a half units
 * in a frame.
 */
function swivel(sh: V3, wr: V3, a: V3, b: V3, v: number, most = 180): V3 {
  const n = unit([wr[0] - sh[0], wr[1] - sh[1], wr[2] - sh[2]]);
  const square = (q: V3): V3 => {
    const c = dot(q, n);
    return unit([q[0] - n[0] * c, q[1] - n[1] * c, q[2] - n[2] * c]);
  };
  const pa = square(a), pb = square(b), pn = cross(n, pa);
  const by = Math.max(-most * DEG, Math.min(most * DEG, Math.atan2(dot(n, cross(pa, pb)), dot(pa, pb)) * v));
  return [0, 1, 2].map((j) => pa[j] * Math.cos(by) + pn[j] * Math.sin(by)) as V3;
}

/**
 * The pose and facing to draw a known body in now, blended from how it was last drawn. The way it faces is worked out first, and
 * the pose (`rigAt`) asked for at that: posed at the way it was turning to, a carry or a wave set by facing went round in one
 * frame while the body was still drawn the old way.
 */
function settle(id: string, p: FigurePose, rigAt: (facing: number, left: boolean, kept: Kept) => Rig, now: number): { rig: Rig; facing: number; changing: boolean } {
  // One of the eight ways; or, sat in something, square along it however it is turned (`FigurePose.seat`).
  const goal = (((p.seat ? p.facing : Math.round(p.facing)) % 8) + 8) % 8;
  let h = held.get(id);
  // A body not drawn for a while -- off screen, or just arrived -- starts where it is.
  if (!h || now - h.seen > 0.5) {
    const left = lefty(goal), side = overLeft(goal) ? 0 : 1, wave = p.emote === 'wave' ? waveArm(goal, busyOf(p, goal, side)) : undefined;
    const target = rigAt(goal, left, { wave, side });
    h = { doing: doingAt(p, left, wave), rig: target, from: target, since: -1, facing: goal, goal, turnFrom: goal, turnSince: -1, seen: now, lead: 0, was: doing(p), gait: 0, left, far: 0, wave, waveFrom: goal, side };
    held.set(id, h);
    if (held.size > 256) for (const [k, v] of held) if (now - v.seen > 5) held.delete(k);
  }
  const dt = Math.max(0, Math.min(0.1, now - h.seen));
  h.seen = now;
  if (goal !== h.goal) {
    h.goal = goal;
    h.turnFrom = h.facing;
    h.turnSince = now;
  }
  // The short way round, at an eighth of a turn per TURN seconds; standing, more slowly, for the feet to step round under it.
  let d = h.goal - h.turnFrom;
  d -= 8 * Math.round(d / 8);
  const k = Math.min(1, Math.max(0, (now - h.turnSince) / ((p.moving ? TURN : TURN_STANDING) * Math.max(1, Math.abs(d)))));
  const was = h.facing;
  h.facing = k < 1 ? h.turnFrom + d * ease(k) : h.goal;
  /*
   * Work changes hands only as a blow lands, with the mallet down on the chisel and both hands together at the work, and blends
   * from one to the other there (see `mixRig`): changed whenever the way it faces said so, the mallet went from a hand raised over
   * the head to the other at the belt, and both arms swung across the chest getting there.
   */
  const wasLeft = h.left;
  if (!p.working || (((p.phase / TAU) % 1) + 1) % 1 < WORK_SWAP) h.left = lefty(h.facing);
  /*
   * And the mallet hand that has become the far one held down by time, from
   * the moment the turn is asked for, over `FAR_DOWN` seconds: by the way the
   * body faced as it came round, it came down from the cock at a unit a frame
   * across the brow while the body turned under it.
   */
  if (h.left !== wasLeft) h.far = 0;
  const farWant = +(lefty(h.goal) !== h.left);
  h.far += Math.max(-dt / FAR_DOWN, Math.min(dt / FAR_DOWN, farWant - h.far));
  /*
   * The arm a wave is made with is chosen as it starts and kept to the end: chosen afresh from the way the body faced, turning an
   * eighth in the middle of a wave changed the waving hand, which nobody does. Chosen again only if the body comes round more than
   * a quarter turn from where it started.
   */
  const over = overLeft(h.goal) ? 0 : 1, bound = h.side > 0 && h.side < 1 ? over : h.side;
  if (p.emote !== 'wave') h.wave = h.waveFacing = undefined;
  else {
    // The staging comes round after the body, an eighth in `WAVE_TURN` seconds (see `wave`).
    if (h.waveFacing === undefined) h.waveFacing = h.facing;
    let go = h.facing - h.waveFacing;
    go -= 8 * Math.round(go / 8);
    h.waveFacing += Math.max(-dt / WAVE_TURN, Math.min(dt / WAVE_TURN, go));
    let off = h.facing - (h.waveFrom ?? h.facing);
    off -= 8 * Math.round(off / 8);
    if (h.wave === undefined || Math.abs(off) > 2) {
      h.wave = waveArm(h.facing, busyOf(p, h.facing, bound));
      h.waveFrom = h.facing;
    }
  }
  // Something heavy goes over to the other shoulder as the way it is turning to says, starting as the turn does, over `SWAP`
  // seconds -- but not during an emote, where the hand it would go into may be waving; put away, it is taken up again on whichever.
  // Caught half way by one, it goes on to where it was going, and the emote is made with the hand that will be free there: frozen
  // there, the wave or the hop was made holding the maul out in front in both hands; and sent back to the shoulder it was nearer,
  // it was carried through the wave on the shoulder staged for the other side, its head over the face.
  // Nor while a spell is cast, which has the weapon in a hand from its first frame: turned to face what it is cast at, the
  // body set off on the swap with the cast, and the weapon was carried along it at arm's length while the arms struck, and
  // went over to the other hand half way through the blow. It goes over once the cast is done.
  if (p.working || p.swimming || p.driving) h.side = over;
  else if (!(p.emote || p.cast) || (h.side > 0 && h.side < 1)) h.side += Math.max(-dt / SWAP, Math.min(dt / SWAP, over - h.side));
  const kept: Kept = { wave: h.wave, waveFacing: h.waveFacing, side: h.side, bound: p.emote ? bound : undefined, far: p.working ? ease(h.far) : undefined, farLeft: h.left };
  const what = doingAt(p, h.left, h.wave);
  if (what !== h.doing) {
    /*
     * Work changing hands at a blow is blended from the blow landing in the hand it was in, as it is now, rather than from the
     * pose last drawn: drawn a dozen times a second, that could be the mallet half way down, and the blend swung the arm out
     * sideways from there for a sixth of a second.
     */
    const hands = p.working && h.left !== wasLeft && h.doing.split('|')[0] === 'work' && what.split('|')[0] === 'work';
    h.was = h.doing.split('|')[0];
    // Only a change between swimming and treading water: turning while doing either is blended as any turn is.
    h.water = p.swimming && (h.was === 'swim' || h.was === 'tread') && h.was !== doing(p);
    h.doing = what;
    h.from = hands ? rigAt(h.facing, wasLeft, kept) : h.rig;
    h.since = now;
  }
  const base = doing(p);
  if (base === 'walk') h.gait = Math.max(0, Math.min(1, p.gait ?? 0));
  // Stopping from a run takes longer than from a walk: the body brakes over a step rather than standing up out of the stride.
  const stopping = h.was === 'walk' && base === 'idle', starting = h.was === 'idle' && base === 'walk';
  const target = rigAt(h.facing, h.left, kept);
  // Into work or out of it with a weapon, which the hand puts away or takes out on the way (see `stowHand`).
  const arm = p.gear?.weapon && weaponOf(p.gear.weapon.id);
  const stowing = !!arm && h.from.stowed !== target.stowed && h.from.tool !== target.tool;
  const x = Math.min(1, Math.max(0, (now - h.since) / (h.water ? WATER_BLEND : stowing ? STOW_TIME : BLEND * (stopping ? 1 + 0.8 * h.gait : 1))));
  const w = ease(x);
  h.rig = x < 1 ? (h.water ? mixWater(h.from, target, x, frameOf(p.look ?? DEFAULT_LOOK)) : mixRig(h.from, target, w)) : target;
  if (x < 1 && stowing && arm) {
    const into = target.stowed;
    const kept = { pole: h.stowPole };
    h.rig = stowHand(h.rig, into ? h.from : target, into ? target : h.from, into ? x : 1 - x, frameOf(p.look ?? DEFAULT_LOOK), arm, h.facing, CHEST_FIT[p.gear?.chest?.id ?? ''] ?? 1, kept, STOW_SWIVEL * Math.max(dt, 1 / 60));
    h.stowPole = kept.pole;
  } else h.stowPole = undefined;
  if (w < 1 && stopping) {
    /*
     * Braking: the hips carried on forward over the leading foot and the
     * body leant back against it, sunk on the knees, and then stood back up
     * over both feet as the other comes up beside it -- out of a run hard
     * enough to see at the size the island is played at (five degrees at
     * the hips and three at the back was not), and out of a walk a little.
     */
    const brake = (0.3 + 0.7 * h.gait) * Math.sin(Math.PI * x), r = h.rig;
    h.rig = { ...r, at: [r.at[0], r.at[1] + 1.5 * brake * (1 - x), r.at[2] - 0.5 * brake], pelvis: [r.pelvis[0] + 10 * brake, r.pelvis[1], r.pelvis[2]], spine: [r.spine[0] + 6 * brake, r.spine[1], r.spine[2]], neck: [r.neck[0] - 8 * brake, r.neck[1], r.neck[2]], head: [r.head[0] - 4 * brake, r.head[1], r.head[2]] };
  } else if (w < 1 && starting) {
    /*
     * Setting off: the weight goes over onto the foot that stays down
     * before the other lifts -- the hips across to it and a little down --
     * and the body tips into the way of going; by enough to see, where a
     * third of a unit and two and a half degrees did not show.
     */
    const r = h.rig, on = target.plant ? (target.plant[1] > target.plant[0] ? 1 : -1) : 1, shift = Math.sin(Math.PI * Math.min(1, x * 1.6));
    h.rig = { ...r, at: [r.at[0] + 0.5 * on * shift, r.at[1], r.at[2] - 0.2 * shift], pelvis: [r.pelvis[0] - 5 * shift, r.pelvis[1] - 4 * on * shift, r.pelvis[2]], spine: [r.spine[0], r.spine[1] + 2 * on * shift, r.spine[2]] };
  }
  /*
   * Turned as a body turns rather than as a figure on a turntable: the head
   * goes round first, the shoulders after it and the hips last, and each
   * comes to rest a moment after the turn is done -- the head and
   * shoulders by how much of the turn is still to come, and the hips that
   * much behind. Followed rather than set, so a turn started, or changed, in
   * the middle of another does not snap the head round.
   */
  let togo = h.goal - h.facing;
  togo -= 8 * Math.round(togo / 8);
  const want = Math.max(-LEAD_MOST, Math.min(LEAD_MOST, togo * 45 * LEAD));
  h.lead += (want - h.lead) * Math.min(1, dt * LEAD_RATE);
  if (Math.abs(h.lead) < 0.05) h.lead = 0;
  const led = h.lead ? turnedAhead(h.rig, h.lead) : h.rig;
  // Everything on the ground goes round the other way in the body's frame as the body turns: a turn to the right, up the facings,
  // is the ground going round to the left.
  let turned = h.facing - was;
  turned -= 8 * Math.round(turned / 8);
  // And while something heavy is on its way between the shoulders: called settled once the turn was, a walk was put down from its
  // stride's pictures -- made with it already on the far shoulder -- and the swap jumped to its end, and standing it was drawn a
  // dozen times a second, which shows its last few tenths as one picture.
  const changing = w < 1 || k < 1 || h.lead !== 0 || !!target.swapping;
  const walking = p.moving && !p.swimming && !p.driving;
  const { rig, busy } = footed(h, led, walking ? target : undefined, stopping && w < 1 ? target : undefined, frameOf(p.look ?? DEFAULT_LOOK), changing, -turned * 45, -togo * 45, now, dt, starting && w < 1);
  /*
   * A blade in the fist is carried for each facing at its own angle out from the body (`FIST_OUT`), and came round to the next
   * with the body, in a tenth of a second: through pointing at whoever is looking, short on the screen, it swept from one side
   * to the other twenty-five degrees in a frame. It follows the body round no faster than an eighth of a turn in `BLADE_TURN`.
   */
  let bladeTurning = false;
  if (h.blade === undefined || !p.gear?.weapon) h.blade = h.facing;
  else {
    let d = h.facing - h.blade;
    d -= 8 * Math.round(d / 8);
    const most = dt / BLADE_TURN;
    h.blade = (((h.blade + Math.max(-most, Math.min(most, d))) % 8) + 8) % 8;
    bladeTurning = Math.abs(d) > most;
  }
  if (h.blade !== h.facing) rig.bladeFacing = h.blade;
  return { rig, facing: h.facing, changing: changing || busy || bladeTurning };
}

/** Seconds a blade in the fist takes to come round an eighth of a turn as the body turns: see `settle`. */
const BLADE_TURN = 0.3;

/** How far ahead of the body the head and shoulders turn, as a share of the turn still to come, and at most, in degrees; and how quickly they follow it, per second. */
const LEAD = 0.7;
const LEAD_MOST = 60;
const LEAD_RATE = 22;

/** A pose with the body turned `lead` degrees ahead of its facing, most at the head and least at the hips, which are behind it. */
function turnedAhead(r: Rig, lead: number): Rig {
  const yaw = (e: Euler, by: number): Euler => [e[0], e[1], e[2] + by * lead];
  // Of the lead: the hips -0.3, the chest +0.25 and the head +0.6 of it, from the ground.
  return { ...r, pelvis: yaw(r.pelvis, -0.3), spine: yaw(r.spine, 0.4), chest: yaw(r.chest, 0.15), neck: yaw(r.neck, 0.15), head: yaw(r.head, 0.2) };
}

type Bones = Record<string, Xf>;

/*
 * Feet that stay put through a change. Blending one pose into the next, or
 * turning, was done joint by joint, and whatever a foot on the ground was
 * doing went with it: stopping, both feet skated two or three tenths of a
 * metre into the standing pose in a fifth of a second; turning on the spot,
 * the body went round on its feet like a figure on a turntable; starting,
 * the legs scissored out of the stance with both feet sliding. Now each foot
 * is kept where it is on the ground for as long as the pose being drawn has
 * it on the ground, and the legs are solved to it from wherever the hips have
 * gone. A foot left more than a little way from where the pose wants it --
 * by a stop, a start, a turn -- takes a step there, one foot at a time and
 * never both off the ground at once; one turned far from its way pivots on
 * its ball. A foot the pose lifts, a walk's swing, goes where the pose takes
 * it, and comes down there.
 */

/** A foot as drawn: its ankle in the body's frame over the ground, which way it points, and a step it is taking. */
interface Foot {
  at: V3;
  yaw: number;
  /** Where the pose being drawn has it, last time, and whether that was on the ground; and where the walk being blended into has it. */
  want: V3;
  down: boolean;
  ground: V3;
  planted: boolean;
  /** How far it is held up off where a blend carries it, for being carried along the ground: see `footed`. */
  raise: number;
  step?: { since: number; from: V3; yaw: number; lift: number; time: number };
  /** Put down, by a step or out of a stride, since the body last walked: such a foot is let stand a little further out of place. */
  placed?: boolean;
}

/** How far a foot on the ground may be from where the pose wants it, along the ground and turned, while things are changing and once they have settled, before it steps there. */
const STEP_OFF = 0.55, STEP_TURNED = 18;
const SETTLED_OFF = 0.22, SETTLED_TURNED = 7;
/** How far a foot kept on the ground may be turned against the leg before it pivots on its ball, in degrees, and how fast it pivots then, in degrees a second. */
const PIVOT_FROM = 40, PIVOT_RATE = 600;
/**
 * Walking, in degrees: how far a foot is put down turned toward where the body is turning; how far behind that one on the
 * ground may be turned before it steps round when the other is down; and before it pivots on its ball when the other is in
 * the air -- the leg turning under the hips until then. And how far, in units, the hips may come down to reach a foot left
 * behind by a turn before it steps whether the other is down or not: see `footed`.
 */
const TURN_AHEAD = 60, TWIST_STEP = 20, PIVOT_WALKING = 90, KEPT_SINK = 0.5;
/** Where the ball of the foot is, from the ankle, along the ground: what a foot pivots on. */
const BALL = 1.15;

/** Which way an ankle's foot points along the ground, in degrees round to the left of straight ahead. */
const yawOf = (x: Xf): number => Math.atan2(-x.m[1], x.m[4]) / DEG;
const wrapDeg = (a: number): number => a - 360 * Math.round(a / 360);

/**
 * The pose `rig` with its feet kept on the ground (see above), for the body
 * `h` drawn now; `turned` is how far round to the left everything fixed on
 * the ground has gone in the body's frame since it was last drawn, by the
 * body turning, and `togo` how far it has still to go; and `walking` the
 * walk, while the ground is going by under it. Busy while a foot is
 * anywhere but where the pose has it.
 */
function footed(h: Held, rig: Rig, walking: Rig | undefined, goal: Rig | undefined, fr: Frame, changing: boolean, turned: number, togo: number, now: number, dt: number, starting = false): { rig: Rig; busy: boolean } {
  const moving = !!walking;
  // The ground carried under the body by a spell since it was last drawn (`Rig.ground`), which a foot on it goes with.
  const gr = rig.ground, gr0 = h.ground;
  h.ground = gr && [gr[0], gr[1]];
  const cx = gr && gr0 ? gr[0] - gr0[0] : 0, cy = gr && gr0 ? gr[1] - gr0[1] : 0;
  if (rig.sink > 0 || rig.sit || rig.lift > 0) {
    h.feet = undefined;
    h.hips = undefined;
    return { rig, busy: false };
  }
  const b = skeleton(fr, rig);
  const want = [0, 1].map((k) => {
    const a = b[`ankle${k}`];
    let low = Infinity;
    for (const p of SOLE) low = Math.min(low, place(a, p)[2]);
    // A blend into standing brings a foot down over its length, and it is as good as down well before the end of it.
    return { at: a.t, yaw: yawOf(a), down: low < (changing && !walking ? 0.3 : 0.08), low: low - a.t[2] };
  });
  // Where the walk itself has the feet, blended into or not, for how fast the ground is going by under it; walking, a foot is on
  // the ground while the walk has it planted, whatever the blend into it has.
  const wb = walking && walking !== rig ? skeleton(fr, walking) : b;
  const ground = [0, 1].map((k) => ({ at: wb[`ankle${k}`].t, planted: !!walking?.plant && walking.plant[k] > 0.5 }));
  if (walking) for (let k = 0; k < 2; k++) want[k].down = ground[k].planted;
  else if (rig.plant && rig.hover && rig.hover.w > 0.5) for (let k = 0; k < 2; k++) want[k].down = rig.plant[k] > 0.5;
  /*
   * Setting off, a foot in the air goes where the walk has it, not where the blend into the walk has it: half way between the
   * stance and the stride, it came down a unit and a half short of where the walk put the ground, was dragged back on it until
   * the walk lifted it, and the hips sank nine tenths of a unit to reach it and sprang back up in a frame as it went. (Put
   * between the two lines above, this took their `else` for its own inner `if`, and a stop from a run went by how low each
   * foot was rather than by the stride's own planting: a foot the stride had in the air stayed up most of half a second.)
   */
  // Setting off, the first moments both feet are kept down (see below): less of that the faster, since a run's stride has both
  // feet in the air from its first frame.
  const holding = !!walking && starting && now - h.since < START_HOLD * (1 - h.gait);
  if (walking && starting) {
    for (let k = 0; k < 2; k++) if (!ground[k].planted) want[k] = { ...want[k], at: wb[`ankle${k}`].t, yaw: yawOf(wb[`ankle${k}`]) };
    /*
     * And for the first `START_HOLD` seconds of a walk both feet are kept down where they stand while the hips go over onto the
     * one the walk has planted (see `settle`), so the weight is seen to shift before the first foot lifts: lifted in the first
     * frame, the foot went up as the hips began to move, and the start had no shift in it at all.
     */
    if (holding && h.feet) for (let k = 0; k < 2; k++) {
      const f = h.feet[k];
      if (!ground[k].planted && f.down && !f.step) want[k] = { ...want[k], at: [f.at[0], f.at[1], f.want[2]], yaw: f.yaw, down: true };
    }
  }
  if (!h.feet) {
    h.feet = want.map((w, k) => ({ at: w.at, yaw: w.yaw, want: w.at, down: w.down, ground: ground[k].at, planted: ground[k].planted, raise: 0 }));
    return { rig, busy: false };
  }
  const feet = h.feet;
  // How far each was out of place last time, for whether it still moves against the pose.
  const was = feet.map((f) => [f.at[0] - f.want[0], f.at[1] - f.want[1], f.at[2] - f.want[2], f.yaw]);
  // The ground going back under a walking body: as a foot the walk has planted goes back, both before and now -- its own, which
  // rolls over the heel and onto the toe as it goes, or the other's.
  const went = [0, 1].map((k) => (moving && feet[k].planted ? [ground[k].at[0] - feet[k].ground[0], ground[k].at[1] - feet[k].ground[1]] : undefined));
  const [gx, gy] = (ground[0].planted && went[0]) || (ground[1].planted && went[1]) || [0, 0];
  const c = Math.cos(turned * DEG), sn = Math.sin(turned * DEG);
  const round = (p: V3): V3 => [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
  /*
   * Where a foot is to step to: where the pose has it once the turn still to
   * come has gone round under it -- as far as a quarter turn of it, so that
   * a foot does not step round into the other's place -- so that a step
   * taken in the middle of a turn puts the foot down where it will be
   * wanted at the end of it, rather than where it is wanted now.
   */
  /*
   * And where the pose being blended into has it, not the blend: stopping,
   * a foot stepped toward the stance as the blend carried it there, then
   * again, and again, up to a second of shuffling and four or five units of
   * stepping a foot. Now each foot steps once, to where it will stand.
   */
  /*
   * Walking, a foot is put down where the walk has it, but turned toward where the body is turning by as much as `TURN_AHEAD`,
   * and one on the ground is stepped round once it is `TWIST_STEP` behind that: put down square to the body as it was and kept
   * there, it was pivoted flat on the ground fifty degrees and more through a half turn.
   */
  const most = moving ? TURN_AHEAD : 90, lead = Math.max(-most, Math.min(most, togo)) * DEG, lc = Math.cos(-lead), ls = Math.sin(-lead);
  const gb = goal && goal !== rig && !goal.sit && goal.sink <= 0 ? skeleton(fr, goal) : undefined;
  const aim = want.map((w, k) => {
    const at = gb ? gb[`ankle${k}`].t : w.at, yaw = gb ? yawOf(gb[`ankle${k}`]) : w.yaw;
    return { at: (moving ? w.at : [at[0] * lc - at[1] * ls, at[0] * ls + at[1] * lc, w.at[2]]) as V3, yaw: yaw - lead / DEG };
  });
  /*
   * How far foot `k` is turned against the leg beyond `by` degrees either way, counting as square to the leg anything between
   * that and the way it is put down for the turn still to come: a foot stepped round ahead of the body is not turned back to
   * the body on its ball (standing, a foot put down a quarter turn ahead was then pivoted back forty degrees, its heel sliding a
   * unit across the ground, and the body came round to where it had been put down after all).
   */
  const twisted = (k: number, by: number): number => {
    const t = wrapDeg(feet[k].yaw - want[k].yaw), a = wrapDeg(aim[k].yaw - want[k].yaw);
    return Math.min(0, t - Math.min(0, a) + by) + Math.max(0, t - Math.max(0, a) - by);
  };
  const pose = b.pelvis.t[2] - HIP * fr.tall, turning = Math.abs(togo) > 1 || Math.abs(turned) > 0.01;
  for (let k = 0; k < 2; k++) {
    const f = feet[k], w = want[k];
    if (moving) f.placed = false;
    // How far a foot on the ground is from where the walk had it there, last time -- the walk as drawn, turned with the head and
    // shoulders going round ahead of the hips (`turnedAhead`): the walk on its own has the hips square, and in a turn a foot just
    // put down was half a unit from its foot at once, and stepped again.
    const kept = Math.hypot(f.at[0] - f.want[0], f.at[1] - f.want[1]);
    // Fixed on the ground: round with the turn, and back with the ground going by if it is on it.
    const q = round(f.at);
    const g = went[k] ?? [gx, gy];
    f.at = f.down && w.down ? [q[0] + g[0] + cx, q[1] + g[1] + cy, q[2]] : q;
    f.yaw += turned;
    // Coming down out of a stride into a stop with the other foot already down, kept in the air until it is over where it is to
    // stand: put down short of there, it stepped again at once.
    if (gb && w.down && !f.down && !f.step && feet[1 - k].down && Math.hypot(f.at[0] - aim[k].at[0], f.at[1] - aim[k].at[1]) > STEP_OFF) w.down = false;
    if (f.step) {
      // Stepping: up off the ground and over to where the pose wants it now, and down; what it stepped from turned with the body.
      const s = f.step;
      s.from = round(s.from);
      s.yaw += turned;
      const t = Math.min(1, (now - s.since) / s.time), e = ease(t), to = aim[k];
      f.at = [s.from[0] + (to.at[0] - s.from[0]) * e, s.from[1] + (to.at[1] - s.from[1]) * e, s.from[2] + (to.at[2] - s.from[2]) * e + s.lift * Math.sin(Math.PI * t)];
      // Round the outside of the other foot, rather than through it, where it is in the way: stepping round in a turn.
      const o = feet[1 - k].at, dx = to.at[0] - s.from[0], dy = to.at[1] - s.from[1], L = Math.hypot(dx, dy);
      if (L > 0.3) {
        const along = Math.max(0, Math.min(1, ((o[0] - s.from[0]) * dx + (o[1] - s.from[1]) * dy) / (L * L)));
        const side = ((o[0] - s.from[0]) * dy - (o[1] - s.from[1]) * dx) / L;
        const clear = 1.5 - Math.abs(side);
        if (clear > 0 && along > 0 && along < 1) {
          const by = clear * Math.sin(Math.PI * t) * (side > 0 ? -1 : 1);
          f.at = [f.at[0] + (dy / L) * by, f.at[1] - (dx / L) * by, f.at[2]];
        }
      }
      f.yaw = s.yaw + wrapDeg(to.yaw - s.yaw) * e;
      if (t >= 1) {
        f.step = undefined;
        f.placed = !moving;
      }
    } else if (f.down && ((moving && f.planted ? kept > 0.5 : Math.hypot(f.at[0] - w.at[0], f.at[1] - w.at[1]) > (moving ? 0.9 : 0.3)) || (moving && w.down && twisted(k, TWIST_STEP))) && (!w.down || (moving && ((feet[1 - k].down && !feet[1 - k].step && want[1 - k].down) || (turning && hipsFor(rig, fr, k, f.at, 4) < pose - KEPT_SINK)))) && !holding) {
      /*
       * Lifted by the pose from somewhere else than the pose has it, or,
       * walking, kept so far from where the walk has it that the leg would
       * soon not reach it, the other foot being down: a quick step up off
       * the ground and over to it, rather than slid there low as a blend
       * carries it. One the walk has had on the ground goes by how far it
       * was kept from where the walk had it, not by where the walk's foot
       * has got to as it lifts: at a run that is most of a unit in a frame
       * off the toe, and a foot just put down in its place stepped again.
       */
      const off = Math.hypot(f.at[0] - w.at[0], f.at[1] - w.at[1]);
      // (And walking, one left so far behind by a turn that the hips would have to come down more than `KEPT_SINK` to reach it
      // goes even with the other foot still in the air: kept until that one came down, the body sank onto its heels, four and
      // six units, through a walking half turn.)
      f.step = { since: now - dt, from: f.at, yaw: f.yaw, lift: Math.min(0.9, 0.35 + 0.1 * off), time: 0.12 + 0.03 * Math.min(4, off) };
      const e = ease(dt / f.step.time);
      f.at = [f.at[0] + (w.at[0] - f.at[0]) * e, f.at[1] + (w.at[1] - f.at[1]) * e, f.at[2] + f.step.lift * Math.sin((Math.PI * dt) / f.step.time)];
    } else if (!w.down) {
      /*
       * Lifted by the pose: carried with it, and however far it was out of
       * place made up while it is in the air. While one pose is blended into
       * another, a foot the blend carries along low over the ground -- into
       * a walk's first stride, or round to the stance -- is lifted clear of
       * it by how fast it goes, rather than slid. Coming down into a stop, it
       * is carried over to where it is to stand as it comes down, rather than
       * to where the blend has it, which put it down a little short and then
       * stepped it the rest of the way.
       */
      const u = 1 - Math.min(1, dt * 14);
      const over = (p: V3): V3 => {
        if (!gb) return p;
        // And lifted by however far that takes it, so it goes over the ground rather than along it.
        const c = Math.max(0, Math.min(1, (1 - (p[2] - gb[`ankle${k}`].t[2])) / 0.8));
        const dx = (aim[k].at[0] - p[0]) * c, dy = (aim[k].at[1] - p[1]) * c;
        return [p[0] + dx, p[1] + dy, p[2] + Math.min(0.6, 0.5 * Math.hypot(dx, dy))];
      };
      const was = over(round(f.want)), to = over(w.at);
      const speed = dt > 0 ? Math.hypot(to[0] - was[0] - gx, to[1] - was[1] - gy) / dt : 0;
      const raised = f.raise;
      f.raise += ((changing ? Math.min(0.6, 0.035 * speed) : 0) - f.raise) * Math.min(1, dt * 20);
      f.at = [to[0] + (f.at[0] - was[0]) * u, to[1] + (f.at[1] - was[1]) * u, to[2] + (f.at[2] - raised - was[2]) * u + f.raise];
      const yaw = moving ? aim[k].yaw : w.yaw;
      f.yaw = yaw + wrapDeg(f.yaw - yaw) * u;
    } else if (moving && !f.down && Math.hypot(f.at[0] - round(f.want)[0], f.at[1] - round(f.want)[1]) > 0.3) {
      // Walking, a foot not yet back where the walk has it is not put down short of it. Where the walk had it last time, not now:
      // the ground goes by under a walking body about three tenths of a unit a frame, so the foot was always that far from where
      // the walk put it down, and turning a little further -- a walking turn held the foot in the air half a second, and the other
      // pivoted flat on the ground through a hundred degrees and more for want of it.
      w.down = false;
      const was = round(f.want), u = 1 - Math.min(1, dt * 20);
      f.at = [w.at[0] + (f.at[0] - was[0]) * u, w.at[1] + (f.at[1] - was[1]) * u, w.at[2] + (f.at[2] - was[2]) * u + (1 - u) * 0.25];
      f.yaw = aim[k].yaw + wrapDeg(f.yaw - aim[k].yaw) * u;
    } else {
      // On the ground: kept there, at the height and the roll the pose has it, and turned on its ball if it is twisted too far; and
      // just put down, put down where the pose puts it, less whatever it was still out of place by in the air.
      if (!f.down) {
        const was = round(f.want);
        f.at = [w.at[0] + f.at[0] - was[0], w.at[1] + f.at[1] - was[1], w.at[2]];
        f.placed = !moving;
      }
      f.at[2] = w.at[2];
      const twist = twisted(k, moving ? PIVOT_WALKING : PIVOT_FROM);
      if (twist) {
        const by = -Math.sign(twist) * Math.min(Math.abs(twist), PIVOT_RATE * dt);
        const a0 = f.yaw * DEG, a1 = (f.yaw + by) * DEG;
        const ball: Pt = [f.at[0] - Math.sin(a0) * BALL, f.at[1] + Math.cos(a0) * BALL];
        f.at = [ball[0] + Math.sin(a1) * BALL, ball[1] - Math.cos(a1) * BALL, f.at[2]];
        f.yaw += by;
      }
    }
  }
  // A foot too far from where the pose wants it, with the other on the ground to stand on, steps there: the further out of place
  // first. Not while walking, where the walk's own next step takes it.
  if (!moving && !feet[0].step && !feet[1].step) {
    const settled = !changing && Math.abs(turned) < 1e-3;
    const off = [0, 1].map((k) => Math.hypot(feet[k].at[0] - aim[k].at[0], feet[k].at[1] - aim[k].at[1]));
    /*
     * Once settled, one already put down since the body last walked is let stand twice as far out of place: coming down out of a
     * stride into a stop, a foot a quarter of a unit from where it stands was lifted again a quarter of a second after it had
     * come down, a shuffle that no one standing still makes.
     */
    const far = [0, 1].map((k) => {
      const m = feet[k].placed ? 2 : 1;
      return want[k].down && (settled ? off[k] > SETTLED_OFF * m || Math.abs(wrapDeg(feet[k].yaw - aim[k].yaw)) > SETTLED_TURNED * m : off[k] > STEP_OFF || Math.abs(wrapDeg(feet[k].yaw - aim[k].yaw)) > STEP_TURNED);
    });
    const k = far[0] && far[1] ? (off[0] >= off[1] ? 0 : 1) : far[0] ? 0 : far[1] ? 1 : -1;
    if (k >= 0 && want[1 - k].down) {
      const f = feet[k];
      f.step = { since: now, from: f.at, yaw: f.yaw, lift: Math.min(0.9, 0.3 + 0.12 * off[k]), time: 0.17 + 0.035 * Math.min(4, off[k]) };
    }
  }
  // Drawn otherwise than the pose has it while any foot is out of place; and changing, to be drawn again at once, while any is
  // stepping or still moving against the pose -- not for one left a little out of place, standing.
  let off = false, busy = false, lowest = Infinity;
  for (let k = 0; k < 2; k++) {
    const f = feet[k], w = want[k], o = was[k];
    f.want = w.at;
    f.down = w.down && !f.step;
    if (w.down || f.step) f.raise = 0;
    f.ground = ground[k].at;
    f.planted = ground[k].planted;
    const d: V3 = [f.at[0] - w.at[0], f.at[1] - w.at[1], f.at[2] - w.at[2]];
    if (f.step || Math.hypot(d[0], d[1], d[2]) > 0.01 || Math.abs(wrapDeg(f.yaw - w.yaw)) > 0.3) off = true;
    if (f.step || Math.hypot(d[0] - o[0], d[1] - o[1], d[2] - o[2]) > 0.003 || Math.abs(wrapDeg(f.yaw - o[3])) > 0.2) busy = true;
    lowest = Math.min(lowest, f.at[2] + w.low);
  }
  busy &&= off;
  /*
   * The legs solved to the feet from where the hips are, in the frame the
   * pose is stood in, which is the ground's once the hips are at the height
   * the pose put them: carried on its curve no longer, but let down if a leg
   * cannot reach a foot kept behind it, and held up off the ground where
   * the pose has both feet in the air.
   */
  const r: Rig = { ...rig, at: [rig.at[0], rig.at[1], pose], leg: [[...rig.leg[0]], [...rig.leg[1]]], knee: [rig.knee[0], rig.knee[1]], hover: undefined, plant: undefined };
  for (let k = 0; k < 2; k++) {
    r.leg[k][2] += (k ? 1 : -1) * wrapDeg(feet[k].yaw - want[k].yaw);
    if (off && !feet[k].step && want[k].down) r.at[2] = Math.min(r.at[2], hipsFor(r, fr, k, feet[k].at, 4));
  }
  if (off) {
    for (let k = 0; k < 2; k++) plant(r, fr, k, feet[k].at);
    r.lift = Math.max(0, lowest);
  }
  /*
   * Standing, the hips come up to where that leaves them over a few frames
   * rather than in one. Held down by a foot left behind, they sprang up four
   * tenths of a unit in a frame the moment that foot lifted to step; and the
   * body stood up on a foot the pose still had a little off the ground, left
   * as the only one down when the other lifted. Down they go at once, which
   * is what keeps a planted foot on the ground; and walking, they go as the
   * stride takes them.
   */
  const height = off ? skeleton(fr, r).pelvis.t[2] : b.pelvis.t[2], last = h.hips;
  if (moving || last === undefined || height <= last + HIPS_FREE * dt) {
    h.hips = height;
    return off ? { rig: r, busy } : { rig, busy };
  }
  h.hips = last + Math.min(HIPS_MOST * dt, Math.max(HIPS_FREE * dt, (height - last) * Math.min(1, dt * HIPS_RISE)));
  r.at[2] -= height - h.hips;
  for (let k = 0; k < 2; k++) plant(r, fr, k, feet[k].at);
  if (!off) r.lift = Math.max(0, lowest);
  return { rig: r, busy: true };
}

/**
 * How quickly standing hips come up to where the feet leave them, as a share of the way each second; how fast they may rise
 * without being held back at all, in units a second (more than breathing or a shift of the weight ever asks); and how fast
 * at most: see `footed`.
 */
const HIPS_RISE = 10, HIPS_FREE = 1.5, HIPS_MOST = 3.5;

/** Seconds both feet stay down when setting off, while the weight goes over onto the first stance foot: see `footed`. */
const START_HOLD = 0.08;

/** The sole's corners in the ankle's frame: what is stood on. */
const SOLE: V3[] = [[-0.37, -0.58, -0.75], [0.37, -0.58, -0.75], [0.35, 1.72, -0.75], [-0.35, 1.72, -0.75]];

/**
 * The pose put on the skeleton, and then the whole stood on the ground: the
 * lowest point of either sole goes down to it, which is what makes a stride
 * rise and fall and keeps a planted foot planted, whatever the angles above.
 */
function skeleton(fr: Frame, r: Rig): Bones {
  const T = fr.tall;
  const pelvis = joint(ROOT, [r.at[0], r.at[1], HIP * T + r.at[2]], ...r.pelvis);
  const spine = joint(pelvis, [0, 0, SPINE * T], ...r.spine);
  const chest = joint(spine, [0, 0, CHEST * T], ...r.chest);
  const neck = joint(chest, [0, -0.08, NECK * T], ...r.neck);
  const head = joint(neck, [0, 0.06, HEADJ], ...r.head);
  const b: Bones = { pelvis, spine, chest, neck, head };
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const [ap, aa, at] = r.arm[k];
    b[`arm${k}`] = joint(chest, [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]], ap, -s * aa, s * at);
    b[`elbow${k}`] = joint(b[`arm${k}`], [0, 0, -UPPER * T], r.elbow[k]);
    b[`wrist${k}`] = joint(b[`elbow${k}`], [0, 0, -LOWER * T], ...r.hand[k]);
    const [lp, la, lt] = r.leg[k];
    b[`hip${k}`] = joint(pelvis, [s * 1.0 * fr.hi, 0, -0.1], lp, -s * la, s * lt);
    b[`knee${k}`] = joint(b[`hip${k}`], [0, 0, -THIGH * T], -r.knee[k]);
    const level = r.flat[k] ? -(r.pelvis[0] + lp - r.knee[k]) : 0;
    b[`ankle${k}`] = joint(b[`knee${k}`], [0, 0, -SHIN * T], level + r.foot[k]);
  }
  let low = Infinity;
  for (let k = 0; k < 2; k++) for (const p of SOLE) low = Math.min(low, place(b[`ankle${k}`], p)[2]);
  // Kneeling, on the knee that is down as well as the feet (see `kneelDown`).
  if ((r.kneel ?? 0) > 0) for (let k = 0; k < 2; k++) low = Math.min(low, b[`knee${k}`].t[2] - KNEE_ROUND);
  // Stood on the lowest sole; or, a swimmer, let down into the water -- and part way between while going in or coming out.
  const wet = Math.min(1, r.sink / SINK);
  // A swimmer is held with the head at its height over the water, however the body is laid in it; and part way there going in or out.
  let dz = -low * (1 - wet) + wet * (r.float !== undefined ? r.float - b.head.t[2] : -SINK) + r.lift;
  if (r.sit) {
    /*
     * Sat: the underside of the thighs (`SEAT`, which is where a skirt lies
     * on the seat too) down on the seat, and each foot put down on the floor
     * by bending or straightening its knee, from where the pose has it. A
     * rider's feet hang in the stirrups instead, wherever the legs put them.
     */
    dz = r.sit.up - place(b.pelvis, [0, 0, SEAT])[2] + r.lift;
    if (!r.sit.astride) for (let k = 0; k < 2; k++) plantFoot(b, r, fr, k, dz, 1);
  }
  if (r.hover && r.hover.w > 0) {
    // Where the hips are at mid-stance, from the stance leg then: the thigh, the shin under the bent knee, the foot.
    const T = fr.tall, { h, w, thigh, knee } = r.hover;
    const stood = 0.1 + THIGH * T * Math.cos(thigh * DEG) + SHIN * T * Math.cos((thigh - knee) * DEG) + 0.75;
    const want = stood + h - HIP * T - r.at[2];
    if (r.plant) {
      /*
       * Carried on the curve exactly, and the foot that is on the ground
       * kept on it: its knee bent a little more where the leg is too long
       * for the body's height there, which is what would otherwise push the
       * body up off the curve in a jolt, and straightened where it is too
       * short, which would leave the foot standing on nothing.
       */
      dz += w * (want - dz);
      // A foot swinging through low enough to catch the ground folds its knee just enough to clear it.
      for (let k = 0; k < 2; k++) plantFoot(b, r, fr, k, dz, r.plant[k], r.plant[k] <= 0);
      // And never with a foot through the ground, planted or not.
      let under = Infinity;
      for (let k = 0; k < 2; k++) for (const p of SOLE) under = Math.min(under, place(b[`ankle${k}`], p)[2] + dz);
      if (under < 0) dz -= under;
    } else dz += w * Math.max(0, want - dz);
  }
  for (const key of Object.keys(b)) b[key] = { m: b[key].m, t: [b[key].t[0], b[key].t[1], b[key].t[2] + dz] };
  return b;
}

/**
 * A foot put down on the ground, `weight` of the way, by turning the leg at
 * the hip and the knee together so the foot goes straight down to it (or up)
 * and stays where it is along the ground: the body `dz` above where the
 * bones were built, and the foot kept level if it was being kept so. The knee
 * alone did it once, which swung the foot forward or back along the ground as
 * it bent -- a foot that should have been still slid under the body. Or,
 * `clear`, only lifted out of the ground if it is in it.
 */
function plantFoot(b: Bones, r: Rig, fr: Frame, k: number, dz: number, weight: number, clear = false): void {
  const T = fr.tall, A = THIGH * T, B = SHIN * T;
  const s = k ? 1 : -1, [, la, lt] = r.leg[k];
  // The hip's frame before its pitch, which the leg swings in.
  const F = joint(b.pelvis, [s * 1.0 * fr.hi, 0, -0.1], 0, -s * la, s * lt);
  const m = F.m;
  for (let q = 0; q < 2; q++) {
    let low = Infinity;
    for (const p of SOLE) low = Math.min(low, place(b[`ankle${k}`], p)[2]);
    // How far the sole is off the ground, to take out. A foot coming down or leaving is put part of the way down, but out of the
    // ground all the way: pushed into it, it stood the whole body up off the other foot.
    const off = clear || low + dz < 0 ? Math.min(0, low + dz) : (low + dz) * weight;
    if (Math.abs(off) < 1e-3) return;
    // The ankle moved straight down by that, in the hip's frame.
    const at = b[`ankle${k}`].t;
    const w: V3 = [at[0] - F.t[0], at[1] - F.t[1], at[2] - off - F.t[2]];
    const y = m[1] * w[0] + m[4] * w[1] + m[7] * w[2], z = m[2] * w[0] + m[5] * w[1] + m[8] * w[2];
    // The knee's bend from how far that is, never bent backward and never past straight; and the thigh's swing from which way.
    const d = Math.max(Math.abs(A - B) + 1e-3, Math.min(0.9995 * (A + B), Math.hypot(y, z)));
    const bend = Math.acos(Math.max(-1, Math.min(1, (d * d - A * A - B * B) / (2 * A * B))));
    const lp = (Math.atan2(y, -z) - Math.atan2(-B * Math.sin(bend), A + B * Math.cos(bend))) / DEG, deg = bend / DEG;
    b[`hip${k}`] = joint(b.pelvis, [s * 1.0 * fr.hi, 0, -0.1], lp, -s * la, s * lt);
    b[`knee${k}`] = joint(b[`hip${k}`], [0, 0, -A], -deg);
    const level = r.flat[k] ? -(r.pelvis[0] + lp - deg) : 0;
    b[`ankle${k}`] = joint(b[`knee${k}`], [0, 0, -B], level + r.foot[k]);
  }
}

/* ---- drawing ------------------------------------------------------------------ */

export type Palette = Record<Mat, RGB>;

/**
 * A piece of gear's colours before its own metal, wood and dye go in: iron,
 * oak, undyed linen and tanned hide, in the island's chalky range -- nothing
 * a pure grey or a pure black, the steel a shade toward blue and the shadows
 * of everything toward cool.
 */
export const GEAR_BASE: Record<GearMat, RGB> = {
  metal: [156, 160, 168], metalDark: [98, 102, 114], metalLit: [214, 218, 224], mail: [134, 139, 148],
  scale: [104, 138, 124], scaleDark: [66, 92, 86], leather: [158, 112, 92], leatherDark: [120, 90, 80], leatherLit: [198, 152, 126], lace: [210, 190, 152],
  cloth: [194, 178, 142], clothDark: [156, 140, 108], lining: [210, 196, 164], wood: [176, 146, 114], woodDark: [124, 100, 80],
  grip: [100, 78, 62], blade: [220, 224, 228], fitting: [200, 168, 96], gem: [124, 184, 204], string: [228, 216, 192],
  fletch: [228, 220, 202], rivet: [200, 202, 208], stone1: [200, 168, 96], stone2: [200, 168, 96], stone3: [200, 168, 96],
};

/**
 * A wildermon's colours before its coat and its own things go in: the coat
 * and its markings are its variant's (`./beasts`), and these are the horn,
 * hoof, leaf and ember any kind starts from. Nothing of a person is made of
 * them.
 */
export const BEAST_BASE: Record<BeastMat, RGB> = {
  coat: [150, 120, 96], coatDark: [118, 92, 76], coatLight: [184, 158, 134], mark: [214, 196, 170], belly: [200, 180, 154],
  muzzle: [226, 212, 190], nose: [70, 52, 58], inner: [232, 170, 170], eyeWhite: [246, 242, 234], lid: [96, 74, 66],
  claw: [96, 82, 76], pad: [92, 70, 72], horn: [226, 214, 188], hornDark: [196, 182, 152], membrane: [206, 160, 168], hoof: [88, 72, 64], tooth: [244, 236, 214], tongue: [220, 120, 128],
  leaf: [132, 178, 104], leafDark: [92, 142, 86], stem: [112, 148, 84], petal: [246, 196, 214], bloom: [250, 222, 120],
  moss: [124, 156, 92], bark: [132, 100, 76], stone: [168, 164, 156], stoneDark: [120, 118, 116], crystal: [170, 214, 236],
  crystalDark: [118, 164, 200], ember: [246, 150, 72], flame: [255, 214, 120], shell: [226, 196, 164], shellDark: [184, 148, 120],
  feather: [150, 120, 96], featherDark: [118, 92, 76], bill: [240, 176, 92], billDark: [206, 142, 70], water: [168, 214, 232], cap: [214, 92, 88],
  spot: [248, 240, 226],
};

function paletteOf(p: FigurePose, look: Look): Palette {
  const skin = hex(skinColour(look)), hair = hex(hairColour(look)), tunic = hex(p.tunic ?? shirtColour(look));
  return {
    skin,
    lip: mixRGB(skin, [150, 62, 60], 0.32),
    hair,
    brow: mixRGB(hair, [22, 16, 14], 0.3),
    eye: mixRGB(hex(eyeColour(look)), [10, 8, 8], 0.35),
    glint: [250, 246, 236],
    // The white of the eye, a little of it round the dark: what makes an eye read on the darkest skins.
    white: mixRGB(skin, [248, 244, 236], 0.62),
    tunic,
    trim: mixRGB(tunic, [30, 24, 22], 0.2),
    trousers: hex(p.trousers ?? trouserColour(look)),
    boot: [84, 62, 50],
    cuff: [150, 118, 86],
    // A shade under the boot, not black: near black, a foot peeling off the ground at a walk showed its sole as a black notch under
    // the heel at the size the island is played at.
    sole: [66, 50, 41],
    belt: [68, 48, 33],
    buckle: [214, 180, 98],
    // A shaved scalp is most of the way to the hair's colour; a shadow of beard on the jaw is most of the way to the skin's.
    shaved: mixRGB(mixRGB(skin, hair, 0.62), [40, 30, 28], 0.1),
    stubble: mixRGB(skin, mixRGB(hair, [40, 30, 28], 0.2), 0.3),
    edge: mixRGB(hair, [22, 16, 14], 0.15),
    rein: [74, 53, 36],
    haft: [158, 118, 76],
    iron: [128, 126, 132],
    // Nothing of the body is made of these; a piece of gear brings its own (`gearPalette`), and these are what it starts from.
    ...GEAR_BASE,
    ...BEAST_BASE,
  };
}

/** Every colour at what it starts from, for a palette built over it: a wildermon's, which has a body's eyes and a goblin's leather. */
export const PLAIN_PALETTE: Palette = paletteOf({ phase: 0, moving: false, facing: 0, swimming: false, working: false }, DEFAULT_LOOK);

/**
 * The metals and scale of a piece of gear, whose dark side leans cool as well
 * as going darker: a copper helm is a cooler brown in its shadow, not a
 * deeper orange, and iron goes blue-grey.
 */
const COOLS = new Set<Mat>(['metal', 'metalDark', 'metalLit', 'mail', 'blade', 'rivet', 'fitting', 'scale', 'scaleDark']);
const COOL_TINT: RGB = [118, 130, 160];
/**
 * Hide, and the lightest it goes in shadow: over a whole suit of it the shadow side at half its colour is most of the figure gone to
 * dark brown, where a suit of plate, held to three-fifths, keeps its value.
 */
const HIDE = new Set<Mat>(['leather', 'leatherDark', 'leatherLit', 'lace']);
const HIDE_LEAST = 0.64;
function toneOf(P: Palette, m: Mat, k: number, gear: boolean): string {
  // A rare piece: the tone its own colours give it, glazed toward its rarity's hue, further on its lit side than in its shadow.
  const glaze = GLAZES.get(P);
  if (glaze) return glazedTone(toneOf(glaze.base, m, k, gear), glaze, k);
  if (!gear) return shade(P[m], k);
  // Gear takes the same light as the body, harder, so its lit side and its shadow side are two planes whatever its colour: metal half as
  // much again between them, cloth and hide and wood well over a half, scale a third; and no metal goes darker than three-fifths lit.
  const cool = COOLS.has(m);
  // A lit edge or a blade's flat full in the light no further than a little over its own colour, which is pale already: past that it
  // goes to paper white and the blade is a gap in the picture.
  const kk = Math.min(m === 'metalLit' ? 1.02 : m === 'blade' ? 1.05 : Infinity, Math.max(cool ? 0.6 : HIDE.has(m) ? HIDE_LEAST : 0, 0.92 + (k - 0.92) * (m === 'scale' || m === 'scaleDark' ? 1.3 : cool ? 1.5 : 1.55)));
  // Hide in the light takes a sheen off its oiled face, toward the light's own colour: scaled up alone a red-brown goes to a hotter
  // red rather than a lighter one.
  if (HIDE.has(m) && kk > 1) {
    const c = mixRGB(P[m], WARM_LIGHT, kk - 1);
    return shade(c, Math.min(kk, 250 / Math.max(1, c[0], c[1], c[2])));
  }
  // Its shadow leans cool: blue-grey, or on copper the green it weathers to -- from further into the light and further, since copper's
  // own colour is near hide's, and a warm shadow on it is a leather one.
  const green = P.metal === METAL_TONE.copper || P.metal === METAL_TONE.bronze;
  const from = green ? 1.0 : 0.94;
  // Lit no further than its brightest channel will go: past that, a colour clips toward lemon or cyan instead of getting lighter.
  if (!cool || kk >= from) return shade(P[m], Math.min(kk, 250 / Math.max(1, P[m][0], P[m][1], P[m][2])));
  return shade(mixRGB(P[m], green ? VERDIGRIS : COOL_TINT, Math.min(green ? 0.6 : 0.32, (from - kk) * (green ? 2.0 : 1.1))), kk);
}
/** The ink round a piece of gear: the body's own warm dark, with a breath of the colour it is round. */
const gearInk = (c: RGB): RGB => {
  const m = mixRGB(INK, c, 0.14);
  // Never lighter than a little under half the colour it is round, darkened as a whole so it keeps the ink's warmth.
  const k = Math.min(1, (0.45 * Math.max(c[0], c[1], c[2])) / Math.max(1, m[0], m[1], m[2]));
  return [m[0] * k, m[1] * k, m[2] * k];
};

/** The ink round a colour: a dark, warm shade of it, and never lighter than a little over half of it, so black hair is not outlined in brown. */
const inkOf = (c: RGB): RGB => {
  const m = mixRGB(c, INK, 0.6);
  return [Math.min(m[0], c[0] * 0.55), Math.min(m[1], c[1] * 0.55), Math.min(m[2], c[2] * 0.55)];
};

/** A colour at a light level, as the canvas wants it, made once and kept. */
const shades = new Map<number, string>();
function shade(c: RGB, k: number): string {
  const r = Math.max(0, Math.min(255, Math.round(c[0] * k)));
  const gg = Math.max(0, Math.min(255, Math.round(c[1] * k)));
  const b = Math.max(0, Math.min(255, Math.round(c[2] * k)));
  const key = (r << 16) | (gg << 8) | b;
  let s = shades.get(key);
  if (!s) {
    if (shades.size > 8192) shades.clear();
    s = `rgb(${r},${gg},${b})`;
    shades.set(key, s);
  }
  return s;
}

export interface Part {
  mesh: Mesh;
  xf: Xf;
  /** Its own colours, for a piece of gear: its metal, its wood, its dye. The body's otherwise. */
  pal?: Palette;
  /** How rare the piece it belongs to is, 1 to 3, for the shine laid over it (`shineOn`); and where in its cycle. */
  rare?: number;
  seed?: number;
  /** Corners already bent, for a mesh that moves within itself. */
  v?: V3[];
  /** Pushed nearer in the drawing order than where it stands says. */
  bias: number;
  /**
   * Drawn just after this other part, whatever their middles say: hair lies
   * on the head, so it goes down after it from every side, and a belt goes
   * round the tunic.
   */
  after?: Part | Part[];
  /**
   * Only after it while this side of the part is toward the viewer, or not
   * far off square to them, and before it once it is turned well away: a
   * beard lies on the cheek seen side on, and from behind the head and the
   * neck are in front of it. Well away is past a third of the way from
   * square to straight away, so a head a little turned at either does not
   * flip it.
   */
  front?: V3;
  /**
   * Never drawn after this other part, or any of these: a neck goes under
   * the head it holds up, from in front where the chin comes over it and from
   * behind where the hair does, however far forward the head is bowed.
   */
  under?: Part | Part[];
  /** No facet of it can be in front of another, so its facets may go down in any order. */
  convex?: boolean;
  /**
   * Solids in the part's own frame, each `c` its middle and `r` its
   * half-sizes, that hide whatever of the part is behind them. Hair is drawn
   * after the head so that it lies on it; this is what keeps a bun or the end
   * of a crest out of sight when it is round the far side, and a beard when
   * it is round the far side of the jaw.
   */
  hide?: Array<{ c: V3; r: V3; in?: Xf }>;
  /**
   * The frame those solids are in, when not the part's own: a lock of hair swings from the head, and is hidden by the skull.
   * A solid that says its own frame (`in`) is in that one: a tiller is hidden by the hips, the thighs and the arm.
   */
  hideIn?: Xf;
  /**
   * A wildermon's piece (`./beasts`), lit its own way: from higher overhead
   * than a person is, in three steps rather than a slope, the shadow step
   * cooler as well as darker. A round mass is a lit top, a middle and a shade
   * rather than a flicker of facets.
   */
  toon?: boolean;
  /** Lines inside it or not: without, only the outline round the whole of it, for a fleece of puffs or a cloud. */
  lines?: boolean;
  /** Inked lightly, for what is airy: a seed head, a wisp. */
  airy?: boolean;
  /** Not inked at all, round the outside or in: what is too fine to carry a line. */
  rim?: boolean;
  /** Outlined at half the width, for what is thin enough that a full outline would be most of it: a wader's leg. */
  thin?: boolean;
  /** For a `toon` part, a rim of light in this colour where its top turns away from the viewer: a cloud's silver edge. */
  sheen?: Mat;
  /** Every facet lit as the darkest of them: one wet piece only just up out of the water (`waterline`), not a clump of facets. */
  flat?: boolean;
  /**
   * For a `toon` part made of separate pieces, a feather or a leaf each: every piece lit in one step, by the way the side of it
   * that is seen faces on the whole, rather than in steps across it. A cupped feather is one soft shade, not a wedge of light
   * and a wedge of shade (`evenSteps`).
   */
  even?: boolean;
  /**
   * One of the links of something in links -- a tail -- named for the whole
   * of it: the lines round every link that follows another in the drawing go
   * down together before any of them, fattened, so each link covers the
   * others' lines where they join and the whole is lined as one thing, with
   * no ring round it at every joint.
   */
  chain?: string;
}

/** A wildermon's light, in the steps a piece that is `toon` is lit in. */
const TOON_LIT = 1.07, TOON_MID = 0.97, TOON_SHADE = 0.84;
/** The light on a surface turned along `u`, before it is cut into steps: mostly from overhead, some from over the viewer's shoulder. */
const toonD = (u: V3, L: V3): number => (u[0] * L[0] + u[1] * L[1] + u[2] * L[2]) * 0.5 + u[2] * 0.65;
/** Where that light is cut into its steps. */
const TOON_CUTS = [-0.12, 0.5];
const toonStep = (d: number): number => (d > TOON_CUTS[1] ? TOON_LIT : d > TOON_CUTS[0] ? TOON_MID : TOON_SHADE);
/** The step a facet in a part's sheen is drawn in: its sheen colour, lit. */
const TOON_SHEEN = 2;
/** Which step a facet turned along `u` is in. */
const toonK = (u: V3, L: V3): number => toonStep(toonD(u, L));

/** Lightness as the eye has it, nought to a hundred (CIE L*), and back; in the light a screen gives out, not the numbers it is sent. */
const toLin = (v: number): number => { const x = Math.max(0, v) / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const fromLin = (y: number): number => 255 * (y <= 0.0031308 ? y * 12.92 : 1.055 * Math.max(0, y) ** (1 / 2.4) - 0.055);
const lumOf = (c: RGB): number => 0.2126 * toLin(c[0]) + 0.7152 * toLin(c[1]) + 0.0722 * toLin(c[2]);
const lightness = (c: RGB): number => { const y = lumOf(c); return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y; };
const lumAt = (l: number): number => (l > 8 ? ((l + 16) / 116) ** 3 : (l * 27) / 24389);
/** A colour taken to a lightness: darkened keeping its hue, or lightened toward `up`. */
function atLightness(c: RGB, l: number, up: RGB = [255, 255, 255]): RGB {
  const y = lumOf(c), want = lumAt(l);
  const lc: RGB = [toLin(c[0]), toLin(c[1]), toLin(c[2])];
  if (want <= y) {
    const k = want / Math.max(1e-6, y);
    return [fromLin(lc[0] * k), fromLin(lc[1] * k), fromLin(lc[2] * k)];
  }
  const lu: RGB = [toLin(up[0]), toLin(up[1]), toLin(up[2])];
  const a = Math.min(1, (want - y) / Math.max(1e-6, lumOf(up) - y));
  return [fromLin(lc[0] + (lu[0] - lc[0]) * a), fromLin(lc[1] + (lu[1] - lc[1]) * a), fromLin(lc[2] + (lu[2] - lc[2]) * a)];
}

/**
 * The steps a `toon` colour is lit in, a set way apart whatever the colour
 * is: the lit top eight lighter than the colour itself and the shade fourteen
 * darker and cooler, toward the island's lavender shadow. A colour too pale
 * for a lit step over it keeps its lit top by having its middle stepped down,
 * a breath of lavender, rather than its light pushed past white.
 */
const TOON_COOL: RGB = [104, 108, 168];
const TOON_LAVENDER: RGB = [214, 208, 240];
const TOON_STEP = 8, TOON_DROP = 14, TOON_TOP = 97;
const toonTones = new Map<number, string>();
function toonTone(c: RGB, k: number): string {
  const step = k >= TOON_LIT ? 2 : k >= TOON_MID ? 1 : 0;
  const key = (((Math.round(c[0]) & 255) << 16) | ((Math.round(c[1]) & 255) << 8) | (Math.round(c[2]) & 255)) * 3 + step;
  let s = toonTones.get(key);
  if (s) return s;
  const l = lightness(c);
  const lit = Math.min(l + TOON_STEP, TOON_TOP), mid = Math.min(l, lit - TOON_STEP);
  const out = step === 2 ? atLightness(mixRGB(c, WARM_LIGHT, 0.1), lit, WARM_LIGHT)
    : step === 1 ? (mid < l - 0.5 ? atLightness(mixRGB(c, TOON_LAVENDER, 0.12), mid) : c)
      : atLightness(mixRGB(c, TOON_COOL, 0.22), Math.max(4, mid - TOON_DROP));
  s = shade(out, 1);
  if (toonTones.size > 4096) toonTones.clear();
  toonTones.set(key, s);
  return s;
}

/** How dark a wildermon's outline is at the lightest, whatever it is round: dark enough to hold it off pale grass. */
const TOON_INK_MAX = 30;
const toonInk = (c: RGB): RGB => (lightness(c) > TOON_INK_MAX ? atLightness(c, TOON_INK_MAX) : c);
/** The ink round a `toon` part only a pixel or two across: a darker shade of its own colour, rather than the dark round the body. */
const toonThinInk = (c: RGB): RGB => atLightness(c, Math.min(lightness(c) * 0.55, 48));

/**
 * How wide a mesh is across, in its own units: the middle one of its three
 * extents, which for anything long -- a whisker, a stalk, a petal -- is how
 * wide it is rather than how long.
 */
const widths = new WeakMap<Mesh, number>();
function acrossOf(m: Mesh): number {
  let w = widths.get(m);
  if (w === undefined) {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const v of m.v) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], v[q]); hi[q] = Math.max(hi[q], v[q]); }
    w = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].sort((a, b) => a - b)[1];
    widths.set(m, w);
  }
  return w;
}
/**
 * Pixels across under which a `toon` part is lined only at half the width,
 * in a darker shade of its own colour and not along its folds (a leaf, a
 * horn's tip); and under which it is not lined at all, being narrower than
 * the line round it would be (a whisker, a spoke).
 */
const TOON_THIN_PX = 2, TOON_FLECK_PX = 0.8;

/* ---- gear ------------------------------------------------------------------------------ */

/**
 * What a body wears and holds, drawn on it.
 *
 * Every piece is a model of its own on the bones it covers -- a wool cap is
 * not a steel helm in another colour -- and every piece is cut to go on over
 * whatever else is worn: a mail coif and mail mittens sit with a breastplate
 * because each is a shell a set margin out from the body and each is drawn
 * after what it covers, the further out the later. What a piece is made of
 * comes with it: a copper helm is copper, an oak shield oak, a tunic the
 * colour it was dyed.
 */

/** A piece as a body wears it: which thing, how rare, the material it was made of and the colour it was dyed. */
export type { GearLook, GearPiece, GearSlot } from '../contract/gear';
/** The chain set's sculpted pieces (`src/sculpt/lowpoly.ts`: the coif, the hauberk and sleeves, the shawl, the leggings, the boots). */
export type ChainPiece = 'chainCoif' | 'chainChest' | 'chainShawl' | 'chainLegs' | 'chainBoots';
/** The plate and chain sets' sculpted pieces, each in its own metal (`FigurePose.outfit.metal`; the plate shawl's mantle its clasps and rim), and the scale set's, all in one material. */
export type PlatePiece = 'chest' | 'legs' | 'boots' | 'helm' | 'mantle' | ChainPiece | 'scale';
/** The cloth and leather sculpted pieces a dye colours (`FigurePose.outfit.dye`). */
export type DyedPiece = 'hood' | 'tunic' | 'shawl' | 'trousers' | 'boots' | 'leatherChest' | 'leatherShawl' | 'leatherLegs' | 'leatherBoots' | 'leatherHat';
/** The order a body is dressed in, inside out. */
const DRESSED: GearSlot[] = ['legs', 'feet', 'chest', 'shawl', 'head', 'belt', 'jewel', 'offhand', 'weapon'];

/** What a body has on, as a string: a kept drawing of it is drawn again when this changes. */
export const gearKey = (g?: GearLook): string =>
  g ? DRESSED.map((s) => { const p = g[s]; return p ? `${p.id}:${p.rare ?? 0}:${p.material ?? ''}:${p.dye ?? ''}` : ''; }).join(',') : '';
/** Whether anything on a body is rare enough to shine. */
export const gearShines = (g?: GearLook): boolean => !!g && DRESSED.some((s) => (g[s]?.rare ?? 0) > 0);

/*
 * The metals, worked, are `METAL_TONE` in materials.ts, where Runecut's
 * window frames take them from too.
 */

/** The woods, as the furniture is built of them. */
const WOOD_GEAR: Record<string, RGB> = {
  pine: [220, 192, 147], birch: [228, 210, 174], oak: [187, 143, 92], maple: [216, 180, 137], willow: [207, 190, 154],
  cedar: [191, 125, 94], apple: [191, 143, 114], cherry: [173, 106, 78], olive: [187, 162, 122], pear: [198, 158, 134],
  plum: [149, 95, 80], peach: [207, 166, 130], fig: [210, 187, 147], lemon: [220, 198, 146], pomegranate: [162, 110, 86],
  apricot: [204, 159, 103], quince: [202, 168, 125],
};
/** The stones a jewel is set with. */
const GEM_TONE: Record<string, RGB> = {
  diamond: [226, 240, 248], ruby: [226, 98, 120], sapphire: [108, 148, 228], emerald: [98, 192, 146], garnet: [168, 64, 82], topaz: [242, 198, 102],
  opal: [236, 222, 238], peridot: [176, 208, 96], amethyst: [168, 120, 208], jasper: [182, 92, 66], onyx: [58, 58, 66], amber: [232, 164, 64],
};
/** A stone as a jewel is set with it (`GEM_TONE`): the sculpted figures' rings, pendants and circlets take theirs from here; none for a stone we do not know. */
export const gemTone = (id?: string): RGB | undefined => GEM_TONE[(id ?? '').trim().toLowerCase()];
/** Dragon scale, off one kind of beast and one colour: a jade gone grey at the edges. */
const DRAGON: RGB = [98, 146, 128];
/** Dragon scale's colour, for the sculpted scale set (`../sculpt/lowpoly.ts` scaleMat). */
export const DRAGON_SCALE: Readonly<RGB> = DRAGON;
/** Whether a material names a metal the figure forges gear in (`METAL_TONE`). */
export const isMetalTone = (material?: string): boolean => !!material && Object.hasOwn(METAL_TONE, material.toLowerCase());
/** What a metal's shadow and its light lean toward. */
const COOL_SHADOW: RGB = [58, 64, 84];
/** What copper's shadow leans toward: the grey-green it weathers to, which keeps it off the colour of skin in the shade. */
const VERDIGRIS: RGB = [104, 132, 120];
const WARM_LIGHT: RGB = [255, 250, 238];
/** A colour made lighter or darker by `k` along its own hue: every channel scaled, none past white. */
const lift = (c: RGB, k: number): RGB => {
  const top = Math.max(c[0], c[1], c[2]) * k;
  const f = top > 255 ? 255 / Math.max(c[0], c[1], c[2]) : k;
  return [c[0] * f, c[1] * f, c[2] * f];
};
/**
 * A wood as gear is carved from it (`WOOD_GEAR`), or nothing where the material is not a wood: the sculpted figures' club,
 * bows and wooden shield take their wood from here (`src/sculpt/lowpoly.ts` metalTint, kitMat).
 */
export function woodTone(material?: string): RGB | undefined {
  return WOOD_GEAR[(material ?? '').toLowerCase()];
}
/**
 * A metal as gear is forged of it (`METAL_TONE`, iron where the material is not a metal): its colour, its shadow, its lit
 * edge and a blade's face, each along its own ramp. The sculpted figures' heads and blades take theirs from here too
 * (`src/sculpt/lowpoly.ts` metalTint).
 */
export function metalShades(material?: string): { metal: RGB; dark: RGB; lit: RGB; blade: RGB } {
  const metal = METAL_TONE[(material ?? '').toLowerCase()] ?? METAL_TONE.iron;
  return {
    metal,
    // The metal's own colour, lighter and darker along its own ramp: a lit edge that is still steel, a shadow that is still iron.
    dark: mixRGB(metal, COOL_SHADOW, 0.25),
    // Copper's lit edge further toward the light's own colour, a pale peach, where a lift of its own colour is a hotter pink.
    lit: mixRGB(lift(metal, 1.16), WARM_LIGHT, metal === METAL_TONE.copper ? 0.34 : 0.1),
    blade: mixRGB(lift(metal, 1.1), WARM_LIGHT, 0.12),
  };
}

/**
 * Every side facet of a mesh worked with a pattern, but for its seams (`Face.seam`): the folds at the back of a knee lie inside
 * the thigh when it bends, and the pattern, drawn over a part after all of its facets, showed through it in short strokes.
 */
const worn = (m: Mesh, pat: Pattern, only?: (face: Face) => boolean): Mesh =>
  ({ ...m, f: m.f.map((f) => (f.i.length === 4 && !f.seam && (!only || only(f)) ? { ...f, pat } : f)) });
/** The same mesh turned about its z by `deg`, its front toward its right. */
const spun = (m: Mesh, deg: number): Mesh => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return { ...m, v: m.v.map(([x, y, z]): V3 => [x * c + y * s, y * c - x * s, z]) };
};

/** A box, from `a` to `b` corner to corner, every face out. */
function box(a: V3, b: V3, m: Mat, top: Mat = m): Mesh {
  const [x0, y0, z0] = a, [x1, y1, z1] = b;
  const v: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  return mesh(v, [
    faceOut(v, [0, 1, 2, 3], [0, 0, -1], m), faceOut(v, [4, 5, 6, 7], [0, 0, 1], top),
    faceOut(v, [0, 1, 5, 4], [0, -1, 0], m), faceOut(v, [1, 2, 6, 5], [1, 0, 0], m),
    faceOut(v, [2, 3, 7, 6], [0, 1, 0], m), faceOut(v, [3, 0, 4, 7], [-1, 0, 0], m),
  ]);
}

/**
 * A flat piece cut to an outline in the y-z plane, each corner `h` either
 * side of it: an axe's head, a shield's face. The rim is `edge` where both
 * its ends are at least `edgeFrom` out along y -- an axe's bit.
 */
function slab(pts: Array<[number, number, number]>, m: Mat, edge?: Mat, edgeFrom = Infinity, back: Mat = m): Mesh {
  const n = pts.length;
  const v: V3[] = [...pts.map(([y, z, h]): V3 => [h, y, z]), ...pts.map(([y, z, h]): V3 => [-h, y, z])];
  const f: Face[] = [faceOut(v, pts.map((_, i) => i), [1, 0, 0], m), faceOut(v, pts.map((_, i) => n + i), [-1, 0, 0], back)];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  const o = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const sharp = edge && pts[i][0] >= edgeFrom && pts[j][0] >= edgeFrom;
    f.push(faceOut(v, [i, j, n + j, n + i], [0, o * (pts[j][1] - pts[i][1]), -o * (pts[j][0] - pts[i][0])], sharp ? edge : m));
  }
  return mesh(v, f);
}

/* -- what is worn ---------------------------------------------------------------------- */

/**
 * How much bigger round the body each chest piece is, heavier further out:
 * padding, hide, mail over its padding, scale and plate. What goes round the
 * waist over it goes round this.
 */
const CHEST_FIT: Record<string, number> = { cloth_tunic: 1.25, leather_jerkin: 1.14, chain_hauberk: 1.13, plate_breastplate: 1.2, scale_cuirass: 1.17 };
/** Where a body sat down sits, in the hips' frame: the underside of the thighs. */
const SEAT = -1.15;

/* -- what is held ------------------------------------------------------------------ */

/**
 * A weapon, in its own frame: the middle of where the fist closes on it at
 * the origin, and its business end up the z axis -- a blade's point, an axe's
 * head, a bow's upper limb. `grip` is what the fingers close round, drawn
 * under the hand; `head` is the rest.
 */
interface Weapon {
  grip: Mesh;
  head: Mesh;
  /**
   * How it is carried in the hands: in the right fist, point forward and
   * down; upright in the right fist, as a staff is; in the left fist, a bow;
   * or over the right shoulder, the right hand low on it and its head behind,
   * as anything too heavy to hold out in front is.
   */
  carry: 'fist' | 'staff' | 'bow' | 'shoulder';
  /**
   * Where it goes while the hands are wanted for something else: sheathed
   * at the left hip, a blade; through the belt at the right hip, a hatchet
   * or a club; or across the back on a strap.
   */
  stow: 'hip' | 'belt' | 'back';
  /** From its butt to its tip along z. */
  from: number;
  to: number;
  /** Slung head up over the right shoulder, rather than point down to the left hip; through the belt head up. */
  headUp?: boolean;
  /** A blade's scabbard, and what of the weapon shows out of the top of it: the guard and the pommel. */
  sheath?: Mesh;
  hilt?: Mesh;
  /** Where along it the scabbard's throat is. */
  throat?: number;
  /**
   * Shouldered: where along it the fist closes, how far along from there it
   * lies on the shoulder, how far back from upright, how far out from the
   * head, and turned how far about itself, in degrees.
   */
  fist?: number;
  reach?: number;
  tilt?: number;
  out?: number;
  spin?: number;
  /**
   * Shouldered, seen from behind: at each facing where the rest above would
   * lay it along the line of sight, [what share of its tilt back it keeps,
   * how much further out it leans, how much further it is turned about
   * itself], so its head or its blade shows beside the head rather than
   * behind it; and seen side on, how far back behind the neck it goes over
   * the shoulder, so it rises behind the jaw rather than across it; and seen
   * from in front, how much further out along the shoulder from the neck it
   * lies, so it rises past the cheek and the side of a helm rather than over
   * them.
   */
  stage?: Record<number, [number, number, number] | [number, number, number, number] | [number, number, number, number, number]>;
  /** Carried upright: how far its top leans forward, in degrees. */
  lean?: number;
  /** In the fist: how far down from level its point is, in degrees, if not `FIST_DOWN`; below nought, up from level. */
  down?: number;
  /** Across the back: how far from upright, in degrees. */
  slant?: number;
  /** Through the belt: how far along it the belt goes, from the middle of the grip. */
  belt?: number;
  /** Through the belt: how far its head leans out from the hip and forward, as parts of its length. */
  splay?: [number, number];
  /**
   * A bow: its `head` without the string, where the string is made fast at either end (lower, upper) in the bow's own frame,
   * where an arrow lies over the bow hand, and how long an arrow for it is: for a string drawn back (`Rig.draw`) and an arrow on it.
   */
  bare?: Mesh;
  tips?: [V3, V3];
  rest?: V3;
  arrow?: number;
}

/** A round shaft along z, from `a` to `b`, `r0` across at `a` and `r1` at `b`. */
const rod = (a: number, b: number, r0: number, r1: number, m: Mat, n = 5): Mesh => rings([[a, r0, r0], [b, r1, r1]], n, m);
/** A shaft in lengths, each ring `[z, r]`: so it can be cut where it lies on a shoulder without a facet crossing the cut. */
const shaft = (zr: Array<[number, number]>, m: Mat, n = 5): Mesh => rings(zr.map(([z, r]) => [z, r, r]), n, m);

/**
 * A blade along z from its root at `a` to its point at `b`: `w` from its
 * middle to either edge and `t` thick at the root, six-sided across so each
 * flat and each bevel takes its own light, narrowing over the last `point` of
 * its length. A single edge (`back` one) has its point drawn up to the back.
 */
function bladeOf(a: number, b: number, w: number, t: number, point = 0.24, m: Mat = 'blade', back = 0): Mesh {
  const p = b - (b - a) * point;
  return rings([[a, t, w], [p, t * 0.85, w * 0.94, 0, -back * w * 0.12], [b, 0.012, 0.012, 0, -back * w * 0.8]], 6, m, { top: false });
}
/** The fuller down each flat of a blade: a groove, painted on. */
const fullerOf = (a: number, b: number, w: number, t: number): Mesh =>
  decals([1, -1].map((s) => plate([s * (t * 0.87 + 0.006), 0, (a + b) / 2], [0, 0, (b - a) / 2], [0, w * 0.16, 0], [s, 0, 0], 'metalDark')));
/** A crossguard across the blade's edges, at `z`, `span` out either side. */
const guardOf = (z: number, span: number, m: Mat = 'fitting'): Mesh => box([-0.13, -span, z - 0.1], [0.13, span, z + 0.1], m);
/** A pommel, a knob on the end of the grip. */
const pommelOf = (z: number, r: number, m: Mat = 'fitting'): Mesh => ball([0, 0, z], [r, r, r * 0.85], 6, 4, m);

/**
 * A scabbard over a blade from `a` to `b`, `w` from its middle to either edge
 * and `t` thick, `cy` off its middle: leather a little bigger round than the
 * blade, narrowing to a metal chape at the tip, with a metal locket at the
 * throat.
 */
function sheathOf(a: number, b: number, w: number, t: number, cy = 0, end = 0.36): Mesh {
  const W = w + 0.1, K = t + 0.1, L = b - a;
  return join(
    rings([[a, K, W, 0, cy], [b - L * 0.16, K * 0.94, W * 0.9, 0, cy], [b + 0.16, K * 0.55, W * end, 0, cy * (end > 0.5 ? 1 : 0.5)]], 6, (band) => (band === 1 ? 'fitting' : 'leatherDark'), { top: false }),
    rings([[a - 0.05, K + 0.05, W + 0.05, 0, cy], [a + Math.min(0.5, L * 0.13), K + 0.05, W + 0.05, 0, cy]], 6, 'fitting'),
  );
}

/**
 * A weapon with a blade that goes into a scabbard: the hilt is what shows out of it, the blade what goes in, and the scabbard is cut
 * to the blade `fits` [root, point, half-width, thickness, off-middle, how wide its end is as a share of its mouth].
 */
const bladed = (w: Omit<Weapon, 'head' | 'sheath'> & { hilt: Mesh; blade: Mesh; fits: [number, number, number, number, number?, number?] }): Weapon =>
  ({ ...w, head: join(w.hilt, w.blade), sheath: sheathOf(...w.fits), throat: w.fits[0] });

const WEAPONS: Record<string, () => Weapon> = {
  // Knives: a hunting knife with its point swept up to the back, a butcher's cleaver of a blade, a long thin carving blade.
  hunting_knife: () => bladed({
    carry: 'fist', stow: 'hip', from: -0.7, to: 2.6,
    grip: rod(-0.55, 0.52, 0.16, 0.14, 'grip', 6),
    hilt: join(pommelOf(-0.62, 0.18), guardOf(0.6, 0.32)),
    blade: bladeOf(0.66, 2.6, 0.24, 0.065, 0.38, 'blade', 1.3), fits: [0.66, 2.6, 0.24, 0.065],
  }),
  butchering_knife: () => bladed({
    carry: 'fist', stow: 'hip', from: -0.7, to: 2.9,
    grip: rod(-0.55, 0.55, 0.16, 0.16, 'woodDark', 6),
    hilt: rings([[0.55, 0.17, 0.21], [0.68, 0.18, 0.22]], 6, 'fitting'),
    // A cleaver: a square slab of a blade, deep and straight-backed, for going through a joint.
    blade: box([-0.06, -0.2, 0.68], [0.06, 0.82, 2.9], 'blade'),
    // Its sheath as broad as the blade to the end, and square there, where a pointed one is any knife's.
    fits: [0.68, 2.9, 0.6, 0.06, 0.31, 0.9],
  }),
  carving_knife: () => bladed({
    carry: 'fist', stow: 'hip', from: -0.65, to: 4.0,
    grip: rod(-0.55, 0.52, 0.14, 0.14, 'grip', 6),
    hilt: join(rings([[0.52, 0.16, 0.18], [0.66, 0.13, 0.16]], 6, 'fitting'), box([-0.07, -0.08, 0.56], [0.07, 0.42, 0.68], 'fitting')),
    // Long and narrowing all the way from a deep heel to a needle of a point, for slicing, its edge ground bright.
    blade: slab([[-0.08, 0.66, 0.05], [0.26, 0.66, 0.05], [0.22, 1.9, 0.045], [0.13, 3.1, 0.035], [-0.02, 4.0, 0.01], [-0.07, 3.2, 0.03], [-0.09, 1.9, 0.045]], 'blade', 'metalLit', 0.1),
    fits: [0.66, 4.0, 0.2, 0.05, 0.08],
  }),
  // A short broad leaf of a blade, widest below its middle, with a round guard and a round pommel: a stabbing sword, not a small sword.
  short_sword: () => bladed({
    carry: 'fist', stow: 'hip', from: -0.8, to: 5.4,
    grip: rod(-0.52, 0.52, 0.16, 0.15, 'grip', 6),
    hilt: join(pommelOf(-0.7, 0.3), rings([[0.44, 0.22, 0.78], [0.7, 0.22, 0.78]], 8, 'fitting')),
    blade: rings([[0.7, 0.1, 0.36], [2.5, 0.12, 0.54], [4.1, 0.1, 0.4], [5.4, 0.012, 0.012]], 6, 'blade', { top: false }),
    fits: [0.7, 5.4, 0.54, 0.12],
  }),
  sword: () => bladed({
    carry: 'fist', stow: 'hip', from: -0.9, to: 7.6,
    grip: rod(-0.55, 0.55, 0.16, 0.15, 'grip', 6),
    // A wheel pommel, and a guard with its ends turned toward the point.
    hilt: join(
      rings([[-1.0, 0.32, 0.4], [-0.6, 0.32, 0.4]], 6, 'fitting'),
      box([-0.15, -1.05, 0.56], [0.15, 1.05, 0.78], 'fitting'), box([-0.12, -1.16, 0.7], [0.12, -0.88, 0.98], 'fitting'), box([-0.12, 0.88, 0.7], [0.12, 1.16, 0.98], 'fitting'),
    ),
    blade: join(bladeOf(0.76, 7.6, 0.42, 0.12, 0.18), fullerOf(1.0, 5.6, 0.42, 0.12)), fits: [0.76, 7.6, 0.42, 0.12],
  }),
  // Two-handed: a long grip, a long guard, and a blade to match, carried on the shoulder.
  long_sword: () => bladed({
    carry: 'shoulder', stow: 'back', from: -1.7, to: 10.6, fist: -0.2, reach: 3.1, tilt: 70, out: 28, spin: 90, slant: 42,
    // From behind: straight up off the shoulder and a little forward three-quarters away, and back at a slant square behind. Side on
    // and three-quarters on, more upright and further back over the shoulder, so the blade rises behind the jaw and not across it.
    // Side on it lay back from the fist at the chest by the shoulder across the front of the neck, and read as at the throat; leant
    // out toward whoever is looking instead, it lay level at the height of the neck and read as through it. So side on the fist is
    // further back and out at the shoulder's edge, and the blade keeps its slant -- 35 to 53 degrees on the screen -- clear of the
    // neck and the jaw by a unit and more, standing, walking and running, in every build.
    stage: { 0: [1, 16, 0, 0, 0.85], 1: [0.7, 0, 0, 1], 2: [0.7, 4, 0, 2.0, 0.6], 3: [0.4, 14, 0], 4: [0.35, 25, 0], 5: [0.4, 14, 0], 6: [0.7, 4, 0, 2.0, 0.6], 7: [0.7, 0, 0, 1] },
    grip: shaft([[-1.3, 0.17], [0.62, 0.16]], 'grip', 6),
    hilt: join(pommelOf(-1.48, 0.27), guardOf(0.7, 1.25), box([-0.16, -0.3, 0.6], [0.16, 0.3, 0.98], 'fitting')),
    blade: join(
      rings([[0.8, 0.095, 0.44], [2.4, 0.093, 0.43], [8.6, 0.08, 0.4], [10.6, 0.012, 0.012]], 6, 'blade', { top: false }),
      fullerOf(1.05, 8.0, 0.44, 0.095),
    ),
    fits: [0.8, 10.6, 0.44, 0.095],
  }),
  // Axes: a bearded hatchet, a francisca swept up at the bit, and a battle axe with a long crescent of an edge and a spike behind.
  hatchet: () => ({
    carry: 'fist', stow: 'belt', headUp: true, from: -1.2, to: 3.9, belt: 1.95,
    grip: rod(-1.1, 0.6, 0.16, 0.15, 'wood', 5),
    // A bearded bit, narrow at the eye and dropping to a beard below a straight top, and a hammer's poll behind it for driving pegs
    // and wedges: an axe's head, where a square one is a cleaver's.
    head: join(
      rod(0.6, 3.55, 0.15, 0.14, 'wood', 5),
      slab([
        [-0.3, 2.9, 0.26], [0.3, 2.9, 0.26], [0.9, 2.74, 0.14], [1.5, 2.26, 0.06], [1.8, 2.04, 0.03], [1.98, 2.2, 0.03],
        [2.04, 3.0, 0.03], [1.96, 3.66, 0.03], [1.2, 3.56, 0.08], [0.3, 3.47, 0.26], [-0.3, 3.47, 0.26],
      ], 'metal', 'blade', 1.85),
      box([-0.3, -1.0, 2.9], [0.3, -0.28, 3.47], 'metal', 'metalLit'),
      box([-0.34, -1.12, 2.86], [0.34, -0.96, 3.51], 'metalLit'),
    ),
  }),
  throwing_axe: () => ({
    // Leaning out from the hip through the belt, so its haft shows below the head and it is an axe there, not a flap of blue.
    // In the hand head up and back over the forearm, cocked for the throw, where a hatchet hangs from the fist head down: of a size and a
    // shape, the two are told apart by how they are held.
    carry: 'fist', stow: 'belt', headUp: true, from: -0.9, to: 3.7, belt: 1.5, splay: [0.34, 0.3], down: -58,
    grip: rod(-0.8, 0.5, 0.14, 0.13, 'woodDark', 5),
    // A francisca: a short dark haft bound in leather and bowed toward the bit, and a narrow head that sweeps up in an S from the
    // haft to a long upper horn standing well above the end of it.
    head: join(
      chain([[0, 0, 0.5], [0, 0.1, 1.3], [0, 0.08, 2.2]], [0.13, 0.12, 0.12], 5, 'woodDark'),
      rings([[-0.3, 0.16, 0.16], [0.1, 0.16, 0.16]], 5, 'leather'),
      slab([[-0.24, 1.86, 0.15], [0.22, 1.82, 0.15], [0.8, 1.68, 0.08], [1.3, 1.52, 0.05], [1.72, 1.6, 0.03], [1.98, 2.25, 0.03], [2.18, 3.05, 0.03], [2.3, 3.7, 0.03], [1.86, 3.3, 0.04], [1.2, 2.66, 0.06], [0.6, 2.36, 0.1], [0.22, 2.3, 0.15], [-0.24, 2.3, 0.15]], 'metal', 'blade', 1.7),
    ),
  }),
  battle_axe: () => ({
    carry: 'shoulder', stow: 'back', headUp: true, from: -4.2, to: 6.8, fist: -3.3, reach: 2.8, tilt: 34, out: 64, spin: 150, slant: 38,
    // Three-quarters away, all but upright with the bit turned to the viewer, where lying back it would be edge on beside the cheek;
    // side on, lying further back, so the haft goes over the shoulder below the jaw rather than across the throat; from behind,
    // standing up out from the shoulder, where lying back it points at the viewer and the bit sits on the shoulder with no haft; and
    // from in front, more upright and back over the shoulder, so the haft from the fist goes up beside the jaw rather than across it,
    // and out past the shoulder's edge only as far as keeps it a unit and a quarter off the head on the screen (carried steadier
    // through the stride -- see `CARRY_STEADY` -- it needs less, and sits nearer the shoulder). From in front, across the top of the
    // shoulder from a fist at the breastbone, the haft some thirty degrees off upright on the screen and the head out past the
    // shoulder: stood up at the shoulder's edge from a fist under the armpit, it was under twenty, and read as held up beside the
    // helm like a torch rather than resting there. That fist at the breastbone brought the haft in to the jaw, a tangent to it on the
    // screen with no air between, so it sits further out toward the carrying shoulder (`aside`), which keeps the haft eight tenths
    // of a unit or more off the head's outline from in front in every build, helmed or bare, and still across the shoulder's top.
    // Three-quarters on, lying a little further back.
    stage: { 0: [0.88, -20, 0, 0.3, 0.8], 1: [1.2, -30, 0, 0.6], 2: [1.15, -45, 0, 1.2], 3: [1.6, -44, 0], 4: [0.7, -16, 0], 5: [1.6, -44, 0], 6: [1.15, -45, 0, 1.2], 7: [1.2, -30, 0, 0.6] },
    grip: shaft([[-4.1, 0.19], [-0.7, 0.18], [0.6, 0.175]], 'grip', 5),
    head: join(
      shaft([[0.6, 0.175], [5.9, 0.16]], 'wood', 5),
      rings([[4.1, 0.21, 0.21], [4.35, 0.21, 0.21]], 5, 'metalDark', { top: false, bottom: false }),
      // A bearded bit, its edge a long crescent, and a spike behind.
      slab([[-0.36, 4.45, 0.24], [0.36, 4.4, 0.24], [1.3, 3.75, 0.09], [2.3, 3.05, 0.04], [2.72, 3.9, 0.03], [2.92, 5.0, 0.03], [2.7, 6.1, 0.03], [2.28, 6.75, 0.04], [1.25, 6.1, 0.1], [0.36, 5.6, 0.24], [-0.36, 5.6, 0.24]], 'metal', 'blade', 2.6),
      slab([[-0.36, 4.7, 0.18], [-1.6, 5.02, 0.05], [-0.36, 5.35, 0.18]], 'metalDark'),
    ),
  }),
  club: () => ({
    // Through the belt head up, caught at the swell under its knob so the knob stands on the hip rather than up under the arm, where
    // the arm hides all but a stick of it; hung the other way it is a bag.
    carry: 'fist', stow: 'belt', headUp: true, from: -0.9, to: 4.4, belt: 2.0, splay: [0.42, 0.34],
    grip: rod(-0.85, 0.6, 0.19, 0.21, 'woodDark', 6),
    // Swelling from the grip to the knob of the root it was cut from, dark with handling, bound in two bands of iron and studded.
    head: join(
      worn(rings([[0.6, 0.21, 0.21], [2.4, 0.4, 0.38], [3.7, 0.58, 0.55], [4.4, 0.36, 0.34]], 6, 'woodDark'), 'grain'),
      rings([[2.55, 0.46, 0.44], [2.8, 0.49, 0.47]], 6, 'metalDark', { top: false, bottom: false }),
      rings([[3.85, 0.58, 0.55], [4.1, 0.52, 0.5]], 6, 'metalDark', { top: false, bottom: false }),
      ...[0, 1, 2, 3, 4, 5].map((k) => { const a = ((k + 0.5) / 6) * TAU; return ball([Math.cos(a) * 0.56, Math.sin(a) * 0.53, 3.3], [0.1, 0.1, 0.1], 4, 3, 'rivet'); }),
    ),
  }),
  maul: () => ({
    // Slung head up, as a hammer is carried: head down on the back it is a spade, and at the hip a satchel.
    carry: 'shoulder', stow: 'back', headUp: true, from: -4.3, to: 5.9, fist: -3.4, reach: 2.8, tilt: 40, out: 64, spin: 90, slant: 36,
    // Staged as the battle axe is.
    stage: { 0: [0.75, -20, 0, 0.4, 0.6], 1: [1.2, -30, 0, 0.8], 2: [1, -45, 0, 1.2], 3: [1.6, -44, 0], 4: [0.7, -16, 0], 5: [1.6, -44, 0], 6: [1, -45, 0, 1.2], 7: [1.2, -30, 0, 0.8] },
    grip: shaft([[-4.2, 0.19], [-0.8, 0.18], [0.6, 0.175]], 'grip', 5),
    head: join(
      shaft([[0.6, 0.175], [4.9, 0.17]], 'wood', 5),
      // The head: a block of iron bound at either end, its striking faces bright.
      box([-0.66, -1.35, 4.25], [0.66, 1.35, 5.85], 'metal', 'metalLit'),
      box([-0.72, -1.47, 4.18], [0.72, -1.3, 5.92], 'metalLit'), box([-0.72, 1.3, 4.18], [0.72, 1.47, 5.92], 'metalLit'),
      box([-0.72, -0.9, 4.18], [0.72, -0.72, 5.92], 'metalDark'), box([-0.72, 0.72, 4.18], [0.72, 0.9, 5.92], 'metalDark'),
    ),
  }),
  spear: () => ({
    carry: 'staff', stow: 'back', headUp: true, from: -4.4, to: 14.4, lean: 7, slant: 58,
    grip: rod(-0.6, 0.6, 0.15, 0.15, 'grip', 5),
    head: join(
      rod(-4.2, -0.6, 0.13, 0.14, 'wood', 5), rod(0.6, 12.2, 0.14, 0.13, 'wood', 5),
      rings([[-4.4, 0.08, 0.08], [-4.05, 0.15, 0.15]], 5, 'metal'),
      rings([[11.9, 0.16, 0.16], [12.55, 0.13, 0.13]], 5, 'metal'),
      // A leaf-shaped head.
      rings([[12.55, 0.08, 0.16], [13.3, 0.07, 0.46], [14.4, 0.012, 0.012]], 6, 'blade', { top: false }),
    ),
  }),
  javelin: () => ({
    carry: 'staff', stow: 'back', headUp: true, from: -2.6, to: 10.8, lean: 22, slant: 48,
    grip: rod(-0.5, 0.5, 0.13, 0.13, 'grip', 5),
    head: join(
      rod(-2.6, -0.5, 0.1, 0.11, 'wood', 5), rod(0.5, 9.2, 0.11, 0.1, 'wood', 5),
      // Two pale vanes across each other at the butt, which is what says it is thrown: narrow, as a dart's are, or slung on the back
      // the four fins of them from behind are a broom head.
      ...[0, 90].map((a) => spun(slab([[-0.3, -2.6, 0.015], [0.3, -2.6, 0.015], [0.2, -1.2, 0.015], [-0.2, -1.2, 0.015]], 'fletch'), a)),
      rings([[9.1, 0.13, 0.13], [9.5, 0.1, 0.1]], 5, 'metal'),
      // A long thin head, for going in rather than cutting.
      rings([[9.5, 0.07, 0.11], [10.0, 0.06, 0.24], [10.8, 0.012, 0.012]], 6, 'blade', { top: false }),
    ),
  }),
  // Staves in the darker heart of the wood, so a bow seen edge on is still a line against the grass.
  short_bow: () => bowOf(11, 1.35, 'woodDark', 'deep'),
  medium_bow: () => bowOf(14, 1.0, 'woodDark', 'flat'),
  long_bow: () => bowOf(18, 0.9, 'woodDark', 'long'),
  composite_bow: () => bowOf(12, 0.95, 'leatherDark', 'recurve'),
};
// Restored gear (`ANCIENT_SWORD` in gear.ts): a short sword's own model.
WEAPONS.ancient_short_sword = WEAPONS.short_sword;

/**
 * A bow `L` long, standing along z, bellied `c` forward of its string at the
 * grip, in `m`, with the limbs of its kind, which are what tell one bow from
 * another at a glance: `deep`, a hunter's short bow bent into a round D in
 * thick round limbs; `flat`, limbs wider than they are thick, broadest a
 * third of the way out and narrowing to the handle and the tips; `long`,
 * tall and slender, tipped in pale horn; and `recurve`, the horseman's
 * shape, its tips turned forward again past where the string meets them, in
 * bone, with the string bearing on the limb where the turn begins.
 */
function bowOf(L: number, c: number, m: Mat, limbs: 'deep' | 'flat' | 'long' | 'recurve'): Weapon {
  const h = L / 2;
  const EAR = 0.78;
  const recurve = limbs === 'recurve';
  const at = (u: number): V3 => {
    // u from -1 at the lower tip to 1 at the upper: a bow bent into a flat arc, and a recurve's ears flicked forward.
    const a = Math.abs(u);
    const y = c * (1 - u * u) + (recurve && a > EAR ? Math.pow((a - EAR) / (1 - EAR), 1.3) * 1.05 * c : 0);
    return [0, y, u * h];
  };
  const [r0, r1] = limbs === 'deep' ? [0.11, 0.1] : limbs === 'long' ? [0.075, 0.07] : [0.09, 0.08];
  const r = (x: number): number => r0 + r1 * (1 - Math.abs(x));
  // A flat bow's limb spread across the bow (along x) and thinned from belly to back, most a third of the way out from the handle.
  const flat = (me: Mesh): Mesh => ({
    ...me,
    v: me.v.map(([x, y, z]): V3 => {
      const a = Math.min(1, Math.abs(z) / h);
      const k = a < 0.12 ? 1 : a < 0.35 ? 1 + (1.5 * (a - 0.12)) / 0.23 : 2.5 - (1.4 * (a - 0.35)) / 0.65;
      const mid = at(z / h)[1];
      return [x * k, mid + (y - mid) * (a < 0.12 ? 1 : 0.7), z];
    }),
  });
  const limb = (u: number[], mat: Mat): Mesh => {
    const me = chain(u.map(at), u.map(r), 5, mat, false);
    return limbs === 'flat' ? flat(me) : me;
  };
  // Slung across the back flatter the longer it is, so a long bow's lower tip stays off the ground while its upper one stops at the ear.
  const bow = { carry: 'bow' as const, stow: 'back' as const, headUp: true, from: -h, to: h, slant: L > 13 ? 56 : 40 };
  if (!recurve) {
    const us = [-1, -0.82, -0.6, -0.34, -0.12, 0.12, 0.34, 0.6, 0.82, 1];
    // A long bow's nocks in horn, pale at both ends of it; the others' cut in the stave.
    const nock = (u: number): Mesh => (limbs === 'long' ? ball(at(u), [0.11, 0.11, 0.26], 5, 3, 'fletch') : ball(at(u), [0.1, 0.1, 0.14], 5, 3, 'woodDark'));
    const bare = join(limb(us.slice(0, 5), m), limb(us.slice(5), m), nock(-1), nock(1));
    return {
      ...bow,
      grip: chain([at(-0.12), at(0.12)], [0.19, 0.19], 6, 'grip'),
      head: join(
        limb(us.slice(0, 5), m), limb(us.slice(5), m),
        nock(-1), nock(1),
        fine(chain([at(-0.985), at(0.985)], [0.05, 0.05], 4, 'string'), 0.1),
      ),
      bare, tips: [at(-0.985), at(0.985)], rest: arrowRest(at, 0.12, h), arrow: arrowFor(L),
    };
  }
  const inner = [0.14, 0.4, 0.62, EAR], ear = [EAR, 0.9, 1];
  const side = (s: number, us: number[]): number[] => us.map((u) => u * s);
  return {
    ...bow,
    grip: join(chain([at(-0.14), at(0.14)], [0.2, 0.2], 6, 'grip'), ...[-0.15, 0.15].map((u) => chain([at(u - 0.02), at(u + 0.02)], [0.22, 0.22], 6, 'fitting'))),
    head: join(
      limb(side(-1, inner).reverse(), m), limb(side(1, inner), m),
      limb(side(-1, ear).reverse(), 'lace'), limb(side(1, ear), 'lace'),
      fine(chain([at(-EAR), at(EAR)], [0.05, 0.05], 4, 'string'), 0.1),
    ),
    bare: join(limb(side(-1, inner).reverse(), m), limb(side(1, inner), m), limb(side(-1, ear).reverse(), 'lace'), limb(side(1, ear), 'lace')),
    tips: [at(-EAR), at(EAR)], rest: arrowRest(at, 0.14, h), arrow: arrowFor(L),
  };
}

/** Where an arrow lies over the bow hand: on the back of the bow just over the top of the grip, which reaches `grip` of the way up a limb `h` long. */
const arrowRest = (at: (u: number) => V3, grip: number, h: number): V3 => {
  const p = at(grip);
  return [0, p[1] + 0.1, p[2] + 0.12];
};
/** How long an arrow is for a bow `L` long, in units: as far as its string is drawn and a hand more, the longer the bow the longer the draw. */
const arrowFor = (L: number): number => Math.min(9.6, 0.36 * L + 3.4);

const weapons = new Map<string, Weapon | null>();
function weaponOf(id: string): Weapon | null {
  let h = weapons.get(id);
  if (h === undefined) {
    const make = WEAPONS[id];
    h = make ? make() : null;
    weapons.set(id, h);
  }
  return h;
}

/** A blade put away at the hip that reaches no further than this from the fist is a knife, and goes upright at the front of the belt. */
const KNIFE_TO = 4.5;

/**
 * How a weapon is carried in the hands and where it goes when they are wanted, as it is drawn -- `front` for a knife at the front of
 * the belt -- and nothing for one that is not drawn.
 */
export function weaponCarry(id: string): { carry: Weapon['carry']; stow: Weapon['stow']; front: boolean; headUp: boolean } | null {
  const w = weaponOf(id);
  return w && { carry: w.carry, stow: w.stow, front: w.stow === 'hip' && w.to < KNIFE_TO, headUp: !!w.headUp };
}

/**
 * A held weapon's measures in its own frame (z along it, nought where the fist closes): its butt and its point, where
 * a shouldering fist closes on it, and for a bow where its string is made fast (lower, upper), where an arrow lies over
 * the bow hand and how long an arrow is. For a spell that draws along a weapon without copying its numbers.
 */
export function weaponSpan(id: string): { from: number; to: number; fist: number; tips?: [V3, V3]; rest?: V3; arrow?: number } | null {
  const w = weaponOf(id);
  return w && { from: w.from, to: w.to, fist: w.fist ?? 0, tips: w.tips, rest: w.rest, arrow: w.arrow };
}

/**
 * A mesh cut in two across its own z at `z`: what is below, and what is
 * above. A facet that crosses is cut along the line, and the rim the cut
 * leaves either side is not inked, so the two drawn one after the other are
 * the one thing -- a haft in front of a shoulder and behind it.
 */
function cutAcross(m: Mesh, z: number): [Mesh, Mesh] {
  const halves = [0, 1].map(() => ({ v: [] as V3[], f: [] as Face[], at: new Map<string, number>() }));
  const vert = (h: (typeof halves)[number], key: string, p: V3): number => {
    let i = h.at.get(key);
    if (i === undefined) {
      i = h.v.length;
      h.v.push(p);
      h.at.set(key, i);
    }
    return i;
  };
  for (const face of m.f) {
    const zs = face.i.map((i) => m.v[i][2]);
    const lo = Math.min(...zs), hi = Math.max(...zs);
    if (hi <= z || lo >= z) {
      const h = halves[hi <= z ? 0 : 1];
      h.f.push({ ...face, i: face.i.map((i) => vert(h, `${i}`, m.v[i])) });
      continue;
    }
    halves.forEach((h, side) => {
      const keep = (i: number): boolean => (side ? m.v[i][2] >= z : m.v[i][2] <= z);
      const idx: number[] = [];
      face.i.forEach((a, k) => {
        const c = face.i[(k + 1) % face.i.length];
        if (keep(a)) idx.push(vert(h, `${a}`, m.v[a]));
        if (keep(a) !== keep(c)) {
          const pa = m.v[a], pc = m.v[c], t = (z - pa[2]) / (pc[2] - pa[2]);
          idx.push(vert(h, a < c ? `${a}-${c}` : `${c}-${a}`, [pa[0] + (pc[0] - pa[0]) * t, pa[1] + (pc[1] - pa[1]) * t, z]));
        }
      });
      if (idx.length >= 3) h.f.push({ ...face, i: idx, soft: true });
    });
  }
  return [mesh(halves[0].v, halves[0].f), mesh(halves[1].v, halves[1].f)];
}

/** What of a shouldered weapon is in front of the shoulder, from its butt up, and what is behind it; its whole, and a blade in its scabbard. */
const cuts = new WeakMap<Weapon, { fore: Mesh; aft: Mesh; whole: Mesh; sheathed?: Mesh }>();
function cutsOf(w: Weapon): { fore: Mesh; aft: Mesh; whole: Mesh; sheathed?: Mesh } {
  let c = cuts.get(w);
  if (!c) {
    const whole = join(w.grip, w.head);
    const [fore, aft] = cutAcross(whole, (w.fist ?? 0) + (w.reach ?? 2.7));
    c = { fore, aft, whole, sheathed: w.sheath && w.hilt && join(w.grip, w.hilt, w.sheath) };
    cuts.set(w, c);
  }
  return c;
}

/**
 * The left arm holding a bow upright at its side, the hand raised as far as
 * the bow's length needs for its lower tip to clear the ground by a margin --
 * a short bow hangs at arm's length, a long bow is held up at the hip -- and
 * kept there through a stride, as a bow is carried; `wide` units further
 * out, for keeping its lower limb off the leg (`clearOfLegs`).
 */
function bowArm(r: Rig, fr: Frame, w: Weapon, up: number, facing: number, wide = 0): void {
  const T = fr.tall, dir = bowUp(facing);
  // The fist's height over the hips that puts the lower tip over the ground, with a margin -- and more of one seen from behind and
  // the left, where the bow leans toward whoever is looking and its lower tip comes down the screen onto the feet.
  const fist = Math.max(-2.6, -w.from * dir[2] + BOW_CLEAR - HIP * T) + up + byFacing(BOW_LIFT, facing);
  // At a run, further forward seen from in front, where the body leaning into the run comes forward over the bow and hides its
  // lower limb behind the coat.
  // And swung fore and aft a little with the shoulders' turn, as the free arm swings with it, rather than held still as a prop.
  const at: V3 = [-2.15 * fr.sh - byFacing(BOW_WIDE, facing) - wide, byFacing(BOW_AHEAD, facing) + up * byFacing(BOW_RUN_AHEAD, facing) - BOW_SWING * r.chest[2], fist - GRIP];
  hold(r, fr, 0, at, [-0.4, -0.8, -0.4], dir);
}

/**
 * The right arm carrying `w` over the shoulder: the fist low in front of the
 * chest and the shaft from it back up over the top of the shoulder at the
 * weapon's slant, set in the chest's frame so it rides with the shoulders
 * whatever the hips are doing, with the elbow out and down.
 */
function onShoulder(r: Rig, fr: Frame, w: Weapon, k: number, facing: number): Xf {
  const T = fr.tall, s = k ? 1 : -1;
  /*
   * Not turned all the way with the shoulders as they turn against the
   * stride: a weight on the shoulder has its own inertia, and the haft went
   * with them, so that from in front its head swung from side to side
   * through twenty to thirty degrees over a running stride. It rolls on the
   * shoulder instead, the shoulders turning under it by `CARRY_STEADY` of
   * their turn.
   */
  const chest = joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], r.chest[0], r.chest[1], r.chest[2] * (1 - CARRY_STEADY));
  // Eased from one facing's staging to the next as the body comes round (see `byFacing`), rather than changed at the half way.
  const f = ((facing % 8) + 8) % 8, i = Math.floor(f), e = ease(f - i);
  const at = (j: number): number[] => { const s = w.stage?.[j % 8] ?? [1, 0, 0]; return [s[0], s[1], s[2], s[3] ?? 0, s[4] ?? 0]; };
  const [keep, wider, turn, back, aside] = at(i).map((v, j) => v + (at(i + 1)[j] - v) * e);
  /*
   * A weight on the shoulder is not welded to it: as the body drops onto
   * each foot it goes on down a little after it, tipping back over the
   * shoulder, and comes up again as the body rises -- a few degrees at a
   * walk, more at a run.
   */
  const sag = r.hover ? (-0.2 - r.hover.h) * (3 + 6 * r.hover.g) : 0;
  const tilt = ((w.tilt ?? 45) * keep + sag) * DEG, out = ((w.out ?? 12) + wider) * DEG;
  r.spin = turn;
  // Back from upright by the tilt, and leaning out from the head by `out`, so what is behind the shoulder clears the skull.
  const d = unit([s * Math.sin(out) * Math.cos(tilt), -Math.sin(tilt), Math.cos(out) * Math.cos(tilt)]);
  const top: V3 = [s * (2.0 * fr.sh + aside), -0.1 - back, ARM_AT * T + 0.8];
  const reach = w.reach ?? 2.7;
  const fist = place(chest, [top[0] - d[0] * reach, top[1] - d[1] * reach, top[2] - d[2] * reach]);
  const haft = mv(chest.m, d), pole = mv(chest.m, [s * 0.75, -0.25, -0.62]);
  // The wrist that puts the fist there, found by moving it by however far the fist misses, a few times over.
  let wrist = fist;
  for (let q = 0; q < 3; q++) {
    const at = place(hold(r, fr, k, wrist, pole, haft), [0, 0, GRIP]);
    wrist = [wrist[0] + fist[0] - at[0], wrist[1] + fist[1] - at[1], wrist[2] + fist[2] - at[2]];
  }
  const xf = hold(r, fr, k, wrist, pole, haft);
  r.carried = k;
  // The weapon's own frame, as `wield` hangs it from the fist.
  return joint(joint(xf, [0, 0, GRIP], -90), [0, 0, -(w.fist ?? 0)], 0, 0, s * ((w.spin ?? 0) + turn));
}

/** How much of the shoulders' turn a weight carried on one does not go round with: see `onShoulder`. */
const CARRY_STEADY = 0.6;

/** Seconds to take something heavy from one shoulder to the other. */
const SWAP = 1;

/*
 * Something heavy from one shoulder to the other, `side` of the way from the
 * left (nought) to the right (one), as [how far along, where the lower hand
 * is in the chest's frame, which way the haft runs from it]. Blended joint by
 * joint from the one carry to the other, the head of a maul went through the
 * back of the skull; then it was swung about the fist from the shoulder to
 * straight out in front in a twentieth of a second -- the head ten units
 * while the hand went one -- held out level at arm's length by its butt,
 * which nobody can hold a maul by, and swung back up the same way.
 *
 * Now it goes as a sledge does. Lifted off the shoulder by the haft, the
 * lower hand coming forward and down while the haft keeps its slant, so the
 * head comes up off the shoulder still behind the line of the head (see
 * `SWAP_LIFT`), the other hand having reached across to take it further up;
 * swung out past that shoulder and down, both hands on it, the head going
 * down past the knee on its own side -- out to the side, clear of the face
 * from wherever it is seen; hung from the hands at the waist, the head low
 * in front of the feet; swung across under the hands to the other side, up
 * past the knee and out past the other shoulder, and laid back on it. Taken at one pace along that way rather
 * than by the side's own easing (see `shoulder`), so the head never goes
 * faster than it does through the middle, about a unit in a sixtieth of a
 * second -- through the first and last hundredths of the way it went five.
 * Only the way off the left shoulder is given; the way onto the right is
 * the same mirrored.
 */
const SWAP_HALF: Array<[number, V3, V3]> = [
  // The swing out past the shoulder, the haft already falling away from the hands and the lower hand at the chest, so the weight
  // is seen swinging down: held level and a little up out at the side at shoulder height here, with both fists at the butt, it
  // read as a lever held out by its end.
  [0.26, [-0.4, 1.2, -0.6], [-0.62, 0.4, -0.68]],
  [0.4, [-0.5, 1.6, -0.15], [-0.55, 0.45, -0.75]],
  [0.5, [0, 1.65, 0.1], [0, 0.5, -0.87]],
];
const SWAP_WAY: Array<[number, V3, V3]> = [
  ...SWAP_HALF,
  ...SWAP_HALF.filter(([u]) => u < 0.5).reverse().map(([u, g, d]): [number, V3, V3] => [1 - u, [-g[0], g[1], g[2]], [-d[0], d[1], d[2]]]),
];
/**
 * The lift off the shoulder, `SWAP_LIFT` of the way along: the lower hand
 * forward and down from where it carries by `SWAP_LIFT_HAND`, out to its
 * own side, and the haft only tipped by `SWAP_LIFT_TIP` toward upright and
 * forward -- most of its slant kept, so the head rises off the shoulder and
 * comes forward over it rather than swinging out from it.
 */
const SWAP_LIFT = 0.12;
const SWAP_LIFT_HAND: V3 = [-0.3, 0.75, -0.8];
const SWAP_LIFT_TIP: V3 = [0.3, 0.2, 0.05];
/** How much of the swap's time the weapon takes to get up to its pace at the start, and to come to rest at the end. */
const SWAP_RAMP = 0.22;
/**
 * How far along the haft from the lower hand the other takes hold: half
 * way to the head of a hafted weapon, so it is carried between two hands a
 * forearm apart and not hung from one fist; and on a sword's grip, below
 * the first, the blade being no place for a hand.
 */
const swapReach = (w: Weapon): number => (w.headUp ? 2.6 : -0.9);
/**
 * The hands changing over at the bottom of the swing, by `side`: the right
 * comes along the haft to `SWAP_GAP` from the left while both hold it, the
 * left lets go and goes round the outside of the right, `SWAP_ROUND` off the
 * haft at most, taking hold again up it, and the right slides on to the butt
 * once the left is off -- hand over hand, never one fist through the other.
 * Paced by the time and not by the way, which goes fastest here: the fists
 * slid past each other in four frames, and an elbow went 47 degrees in one.
 */
const SWAP_CLOSE: [number, number] = [0.34, 0.46], SWAP_OFF: [number, number] = [0.42, 0.66], SWAP_SLIDE: [number, number] = [0.5, 0.64];
const SWAP_GAP = 0.9, SWAP_ROUND = 1.0;
/** How far bent, in degrees, the elbow of the hand further up the haft is kept at least: see `shoulder`. */
const SWAP_BEND = 35;
/** Over which share of a blend into or out of a cast a weapon carried in the hand goes to where it is put away or comes from there: see `wield`. */
const STOW_GO: [number, number] = [0.05, 0.65];
/** The part of a cast's `Rig.stow` over which what is in the hand is carried to where it is put away, and back: all of it, so it goes over the whole of the blend into the cast. */
const STOW_CAST: [number, number] = [0.02, 0.98];
/**
 * Which way the elbow of a hand on the haft is out, in the chest's frame for the right arm: lower on the haft, out and down; and
 * further up it, out and back. Out and up, as it was, pointed back along an arm reaching down and forward to the haft, which
 * leaves the elbow free to go any way round it, and it went right round in a frame, twice in every swap.
 */
const SWAP_POLE: [V3, V3] = [[0.75, -0.25, -0.62], [0.3, -1, 0]];
/** Over which of the swap the left elbow goes from down to back as its hand comes to be the further up the haft, and the right's the other way about, mirrored: see `shoulder`. */
const SWAP_UPPER: [number, number] = [0.56, 0.66];
/** How high off the ground a blade's point is kept, swung down between the hands: see `shoulder`. */
const SWAP_POINT = 3;
/** How much later in the swap a sword's second hand takes hold, and how much sooner it lets go: see `shoulder`. */
const SWAP_LATE = 0.16;
/** How much of the swap a hand takes to take hold of a haft, or to let go of it and hang free again: see `shoulder`. */
const SWAP_TAKE = 0.28;

/**
 * Carrying `w` over the shoulders, `side` of the way from the left to the
 * right (see `Kept`): on one, as `onShoulder` has it; between, held in both
 * hands on the way of `SWAP_WAY`, the weapon's frame put in `r.swapping` and the
 * hands on it -- the one it came off the shoulder in at the butt, the other
 * taking hold further up as it is stood up and sliding down to the butt as
 * it goes up onto the other shoulder, and the first letting go. Either way
 * round, the same way.
 */
function shoulder(r: Rig, fr: Frame, w: Weapon, side: number, facing: number): void {
  if (side <= 0 || side >= 1) {
    onShoulder(r, fr, w, side >= 1 ? 1 : 0, facing);
    return;
  }
  const T = fr.tall;
  const chest = joint(joint(ROOT, [0, 0, SPINE * T], ...r.spine), [0, 0, CHEST * T], ...r.chest);
  const copy = (): Rig => ({ ...r, arm: [[...r.arm[0]], [...r.arm[1]]], elbow: [...r.elbow], hand: [[...r.hand[0]], [...r.hand[1]]] });
  // Each end as it is carried there; the weapon's frame, and its lower hand and its haft in the chest's frame.
  const ends = [0, 1].map((k) => {
    const xf = onShoulder(copy(), fr, w, k, facing);
    const c = chest.m, d: V3 = [xf.m[2], xf.m[5], xf.m[8]], g = place(xf, [0, 0, w.fist ?? 0]);
    const into = (v: V3): V3 => [c[0] * v[0] + c[3] * v[1] + c[6] * v[2], c[1] * v[0] + c[4] * v[1] + c[7] * v[2], c[2] * v[0] + c[5] * v[1] + c[8] * v[2]];
    return { xf, g: into([g[0] - chest.t[0], g[1] - chest.t[1], g[2] - chest.t[2]]), d: into(d) };
  });
  // Lifted off each shoulder: from where it carries there, out to that side.
  const lift = (k: number): [number, V3, V3] => {
    const s = k ? 1 : -1, { g, d } = ends[k], H = SWAP_LIFT_HAND, P = SWAP_LIFT_TIP;
    return [k ? 1 - SWAP_LIFT : SWAP_LIFT, [g[0] + s * H[0], g[1] + H[1], g[2] + H[2]], unit([d[0] + s * P[0], d[1] + P[1], d[2] + P[2]])];
  };
  const keys: Array<[number, V3, V3]> = [[0, ends[0].g, ends[0].d], lift(0), ...SWAP_WAY, lift(1), [1, ends[1].g, ends[1].d]];
  // Along the way at `x` of it, curved smoothly through its keys: the lower hand, and the haft's way, of unit length.
  const along = (x: number): [V3, V3] => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] < x) i++;
    const v = (x - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), v2 = v * v, v3 = v2 * v;
    const at = (j: number, m: 1 | 2): V3 => keys[Math.max(0, Math.min(keys.length - 1, j))][m];
    const curve = (m: 1 | 2): V3 => {
      const a = at(i - 1, m), b = at(i, m), c = at(i + 1, m), d = at(i + 2, m);
      return [0, 1, 2].map((n) => 0.5 * (2 * b[n] + (c[n] - a[n]) * v + (2 * a[n] - 5 * b[n] + 4 * c[n] - d[n]) * v2 + (3 * b[n] - a[n] - 3 * c[n] + d[n]) * v3)) as V3;
    };
    return [curve(1), unit(curve(2))];
  };
  /*
   * How far along the way it is: at one pace by the distance the head goes,
   * and a little of the hand's, getting up to it over the first `SWAP_RAMP` of the
   * time and coming to rest over the last. Eased by the side alone, the
   * first and last tenths of the way, where the head swings furthest for
   * the least of the hand, went by in four frames.
   */
  const far = (w.to ?? 0) - (w.fist ?? 0), N = 24, gone = [0];
  let [pg, pd] = along(0);
  for (let j = 1; j <= N; j++) {
    const [g, d] = along(j / N);
    gone.push(gone[j - 1] + 0.3 * Math.hypot(g[0] - pg[0], g[1] - pg[1], g[2] - pg[2]) + Math.hypot(g[0] + far * d[0] - pg[0] - far * pd[0], g[1] + far * d[1] - pg[1] - far * pd[1], g[2] + far * d[2] - pg[2] - far * pd[2]));
    [pg, pd] = [g, d];
  }
  const A = SWAP_RAMP, top = 1 / (1 - A);
  const paced = side < A ? (top * side * side) / (2 * A) : side > 1 - A ? 1 - (top * (1 - side) * (1 - side)) / (2 * A) : top * (side - A / 2);
  const want = paced * gone[N];
  let j = 0;
  while (j < N - 1 && gone[j + 1] < want) j++;
  const u = (j + Math.max(0, Math.min(1, (want - gone[j]) / (gone[j + 1] - gone[j] || 1)))) / N;
  const [cg, cd] = along(u);
  const g = place(chest, cg);
  let d = unit(mv(chest.m, cd));
  // Never lower than a little off the ground; and a blade's point, which hangs further from the hands than a head does, never
  // below the shin (`SWAP_POINT`): at the ground in front of the feet, a long sword's point read from in front as through them.
  const low = g[2] + HIP * T - (w.headUp ? 0.6 : SWAP_POINT);
  if (d[2] * far < -low) {
    const flat = Math.hypot(d[0], d[1]) || 1, z = -low / far;
    d = [(d[0] / flat) * Math.sqrt(1 - z * z), (d[1] / flat) * Math.sqrt(1 - z * z), z];
  }
  // Turned about itself from the way it lay on the one shoulder to the way it lies on the other, through the middle of the way:
  // each end's turn carried round to here the shortest way, and the one eased into the other.
  const turned = (k: number): V3 => {
    const e = ends[k].xf.m, d0 = unit([e[2], e[5], e[8]]), x0: V3 = [e[0], e[3], e[6]];
    const axis = cross(d0, d), sn = Math.hypot(axis[0], axis[1], axis[2]), cs = dot(d0, d);
    if (sn < 1e-6) return x0;
    const n = unit(axis), a = Math.atan2(sn, cs);
    const nx = cross(n, x0), nd = dot(n, x0);
    return [0, 1, 2].map((j) => x0[j] * Math.cos(a) + nx[j] * Math.sin(a) + n[j] * nd * (1 - Math.cos(a))) as V3;
  };
  const x0 = turned(0), x1 = turned(1), y0 = cross(d, x0);
  const twist = Math.atan2(dot(x1, y0), dot(x1, x0)) * step(u, 0.25, 0.75);
  const ax = unit([0, 1, 2].map((j) => x0[j] * Math.cos(twist) + y0[j] * Math.sin(twist)) as V3);
  const ay = cross(d, ax), o: V3 = [g[0] - d[0] * (w.fist ?? 0), g[1] - d[1] * (w.fist ?? 0), g[2] - d[2] * (w.fist ?? 0)];
  r.swapping = { m: [ax[0], ay[0], d[0], ax[1], ay[1], d[1], ax[2], ay[2], d[2]], t: o };
  // The hands on it: the right reaching across to take hold up the haft by the left shoulder before it is lifted off, the two
  // changing over hand over hand while it hangs (see `SWAP_CLOSE`), the right to the butt and the left up the haft, and the left
  // letting go once it is down on the right shoulder -- and the other way about going the other way. Taken hold of over a fifth of
  // the time, not of the way: a hand reaching across the chest in the first frames of the way went five units a frame.
  const free = copy();
  const reach = swapReach(w), gap = Math.sign(reach) * Math.min(SWAP_GAP, Math.abs(reach));
  const round = Math.max(0, Math.min(1, (side - SWAP_OFF[0]) / (SWAP_OFF[1] - SWAP_OFF[0]))), off = SWAP_ROUND * Math.sin(Math.PI * round);
  const up = [reach * step(side, ...SWAP_OFF), reach + (gap - reach) * step(side, ...SWAP_CLOSE) - gap * step(side, ...SWAP_SLIDE)];
  // Off the haft, going round the other hand: out to its own side and forward of the haft.
  const out = mv(chest.m, [-1, 0.5, 0]), od = dot(out, d), round0 = unit([out[0] - d[0] * od, out[1] - d[1] * od, out[2] - d[2] * od]);
  // A sword's second hand takes hold later and lets go sooner: its grip is up by the shoulder out of the other hand's reach until it
  // is lifted off.
  const late = w.headUp ? 0 : SWAP_LATE, span = w.headUp ? SWAP_TAKE : 0.2, grip = [1 - step(side, 1 - late - span, 1 - late), step(side, late, late + span)];
  const upper = [step(side, ...SWAP_UPPER) * grip[0], (1 - step(side, 1 - SWAP_UPPER[1], 1 - SWAP_UPPER[0])) * grip[1]];
  const at = (k: number, x: number, o = k ? 0 : off): V3 => {
    return [g[0] + d[0] * x + round0[0] * o, g[1] + d[1] * x + round0[1] * o, g[2] + d[2] * x + round0[2] * o];
  };
  /*
   * The elbow out and down for the hand lower on the haft, as on the
   * shoulder; for the one further up it, reaching along the haft, out and
   * back (see `SWAP_POLE`), turned from the one to the other about the line
   * of the arm (`swivel`).
   */
  const poleOf = (k: number, wrist: V3): V3 => {
    const s = k ? 1 : -1, sh = place(chest, [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]]);
    const [a, b] = SWAP_POLE.map((q) => mv(chest.m, [s * q[0], q[1], q[2]]));
    return swivel(sh, wrist, a, b, upper[k]);
  };
  // Arm `k` with its fist at `fist`: the wrist found by moving it by however far the fist misses, a few times over.
  const seat = (k: number, fist: V3): void => {
    let wrist = fist;
    for (let q = 0; q < 4; q++) {
      const got = place(hold(r, fr, k, wrist, poleOf(k, wrist), d), [0, 0, GRIP]);
      wrist = [wrist[0] + fist[0] - got[0], wrist[1] + fist[1] - got[1], wrist[2] + fist[2] - got[2]];
    }
    hold(r, fr, k, wrist, poleOf(k, wrist), d);
  };
  /*
   * The hand further up the haft takes hold no further up than its arm
   * reaches with the elbow still bent by `SWAP_BEND`, sliding down toward
   * where the haft passes nearest its shoulder for as long as the haft is
   * out of reach -- but never nearer the other hand than `SWAP_GAP`; and
   * where even that is out of reach, it takes hold later and lets go sooner
   * by as much as it falls short. Held where the plan had it, the arm locked
   * straight for a third of a second with its fist a hand's width off the haft.
   */
  const fit = (k: number, want: number, other: number, o = k ? 0 : off): [number, number] => {
    const sh = place(chest, [(k ? 2.1 : -2.1) * fr.sh, -0.1, ARM_AT * T + r.shrug[k]]);
    const floor = Math.sign(reach) * Math.min(Math.abs(want), Math.abs(other) + Math.abs(gap));
    const nearest = dot([sh[0] - g[0], sh[1] - g[1], sh[2] - g[2]], d);
    let a = Math.max(Math.min(floor, want), Math.min(Math.max(floor, want), nearest)), b = want;
    const fist = at(k, a, o), short = step(Math.hypot(fist[0] - sh[0], fist[1] - sh[1], fist[2] - sh[2]) - (UPPER + LOWER) * T, 0.3, 1.5);
    if ((seat(k, at(k, want, o)), r.elbow[k] >= SWAP_BEND)) return [want, short];
    if ((seat(k, fist), r.elbow[k] >= SWAP_BEND)) for (let q = 0; q < 8; q++) {
      const m = (a + b) / 2;
      if ((seat(k, at(k, m, o)), r.elbow[k] >= SWAP_BEND)) a = m;
      else b = m;
    }
    return [a, short];
  };
  // The left going round toward where it can take hold, not toward where it was planned to and then stopped short by the clamp:
  // its elbow went seventy degrees in five frames.
  if (round > 0 && round < 1) up[0] = fit(0, reach, 0, 0)[0] * step(side, ...SWAP_OFF);
  const hi = Math.abs(up[1]) > Math.abs(up[0]) ? 1 : 0, [x, short] = fit(hi, up[hi], up[1 - hi]);
  up[hi] = x;
  grip[hi] *= 1 - short;
  /*
   * Taking hold and letting go, the upper arm turned from the way it hangs
   * free to the way it holds the shortest way round, and the elbow and hand
   * blended: blended angle by angle, the two could be half a turn apart in
   * yaw, and a hand part way there went round behind the shoulder in a frame.
   */
  for (let k = 0; k < 2; k++) {
    const m = Math.max(0, grip[k]);
    if (m <= 0) {
      [r.arm[k], r.hand[k], r.elbow[k]] = [free.arm[k], free.hand[k], free.elbow[k]];
      continue;
    }
    seat(k, at(k, up[k]));
    if (m >= 1) continue;
    r.arm[k] = turnArm(free.arm[k], r.arm[k], m, k ? 1 : -1);
    r.hand[k] = free.hand[k].map((v, j) => v + (r.hand[k][j] - v - 360 * Math.round((r.hand[k][j] - v) / 360)) * m) as Euler;
    r.elbow[k] = free.elbow[k] + (r.elbow[k] - free.elbow[k]) * m;
  }
  /*
   * Each arm's and hand's angles written the way nearest the free arm's: the same turn can be written two ways, and the two-bone
   * solve went from the one to the other half way through the swing, which is nothing on its own but a blend from or to this pose
   * (an emote begun mid-swap) went round the long way, a fist eight units in a frame.
   */
  for (let k = 0; k < 2; k++) [r.arm[k], r.hand[k]] = [nearTurn(r.arm[k], free.arm[k]), nearTurn(r.hand[k], free.hand[k])];
  // The hand going round open, closing again as it takes hold.
  r.open[0] = Math.max(+r.open[0], 0.7 * Math.sin(Math.PI * round));
  r.carried = u < 0.5 ? 0 : 1;
  r.spin = 0;
}

/** A turn as a unit quaternion [w, x, y, z], and back. */
function quatOf(m: M3): number[] {
  const w = Math.sqrt(Math.max(0, 1 + m[0] + m[4] + m[8])) / 2, x = Math.sqrt(Math.max(0, 1 + m[0] - m[4] - m[8])) / 2;
  const y = Math.sqrt(Math.max(0, 1 - m[0] + m[4] - m[8])) / 2, z = Math.sqrt(Math.max(0, 1 - m[0] - m[4] + m[8])) / 2;
  return [w, Math.sign(m[7] - m[5]) * x, Math.sign(m[2] - m[6]) * y, Math.sign(m[3] - m[1]) * z];
}
function matOf(q: number[]): M3 {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1, [w, x, y, z] = q.map((v) => v / l);
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
/** `v` of the way from turn `a` to turn `b`, the shortest way round. */
function turnBetween(a: M3, b: M3, v: number): M3 {
  const p = quatOf(a), q0 = quatOf(b), c0 = p.reduce((t, x, j) => t + x * q0[j], 0), q = c0 < 0 ? q0.map((x) => -x) : q0;
  const th = Math.acos(Math.min(1, Math.abs(c0))), sn = Math.sin(th);
  const f0 = sn < 1e-4 ? 1 - v : Math.sin((1 - v) * th) / sn, f1 = sn < 1e-4 ? v : Math.sin(v * th) / sn;
  return matOf(p.map((t, j) => t * f0 + q[j] * f1));
}

/** Angles `e` written the way nearest `to`, angle by angle: as they are, or as the same turn half a turn on in pitch and yaw. */
function nearTurn(e: Euler, to: Euler): Euler {
  const by = (q: number[]): Euler => q.map((x, j) => x - 360 * Math.round((x - to[j]) / 360)) as Euler;
  const one = by(e), two = by([e[0] + 180, 180 - e[1], e[2] + 180]), far = (q: Euler): number => q.reduce((t, x, j) => t + Math.abs(x - to[j]), 0);
  return far(two) < far(one) ? two : one;
}

/**
 * An upper arm's angles (as `Rig.arm` has them, on side `s`) `v` of the way
 * from `a` to `b`, turned rather than blended angle by angle: by way of the
 * arm hanging at the side (`ARM_HANG`), curved through it, so that from an
 * arm raised in a wave to one reaching across for a haft -- half a turn
 * apart, where the shortest way round is anyone's guess -- it comes down and
 * goes over, rather than going one way round and then, a frame later, the
 * other. Or, not `hang`, straight from the one to the other.
 */
const ARM_HANG: Euler = [3, 8, 18];
function turnArm(a: Euler, b: Euler, v: number, s: number, hang = true): Euler {
  const of = (e: Euler): M3 => mm(rz(s * e[2] * DEG), mm(ry(-s * e[1] * DEG), rx(e[0] * DEG)));
  const A = of(a), B = of(b), H = of(ARM_HANG);
  const m = hang ? turnBetween(turnBetween(A, H, v), turnBetween(H, B, v), v) : turnBetween(A, B, v);
  const out: Euler = [Math.atan2(m[7], m[8]) / DEG, (s * Math.asin(Math.max(-1, Math.min(1, m[6])))) / DEG, (s * Math.atan2(m[3], m[0])) / DEG];
  // The near way round from where it starts, angle by angle, for what blends it on from here.
  return out.map((x, j) => x - 360 * Math.round((x - a[j]) / 360)) as Euler;
}

/**
 * How far round from pointing forward to pointing out to the right a blade in
 * the fist is turned, in degrees, at each facing. Three-quarters on with the
 * right hand nearest, forward is at the viewer, and three-quarters away with
 * it furthest, forward is behind the body; from behind, forward is away. At
 * each the blade is turned out to where its length shows, and between them
 * it comes round smoothly as the body turns -- never more than about fifty
 * degrees from one facing to the next, where it was ninety, and turning the
 * body through an eighth swung the blade round in two frames.
 */
const FIST_OUT = [52, 100, 46, 40, 62, 100, 46, 42];
const fistOut = (facing: number): number => byFacing(FIST_OUT, facing);
/** How far down from level a blade in the fist points, and how much of the arm's swing it takes, in degrees and as a share. */
const FIST_DOWN = 30, FIST_SWING = 0.4;
/**
 * How much nearer level than `FIST_DOWN` a blade is carried at a run, in degrees, at each facing: less from behind, and none --
 * a little lower than walking -- three-quarters away to the left and side on to the left, where the fist is the far one and the
 * blade's turn out from the body goes up the screen: lifted there too, it pointed straight ahead at the height of the hip, a
 * couched lance.
 */
const FIST_RUN = [16, 16, 16, 16, 4, -6, -6, 10];

/** A value given for each of the eight facings, at `facing` as drawn: eased from one to the next as the body comes round. */
function byFacing(table: number[], facing: number): number {
  const f = ((facing % 8) + 8) % 8, i = Math.floor(f), u = f - i;
  return table[i % 8] + (table[(i + 1) % 8] - table[i % 8]) * u * u * (3 - 2 * u);
}

/**
 * Which way a bow in the left fist stands, in the hips' frame, at each
 * facing: all but upright, out from the body a little, and its top leaning
 * forward -- except side on and three-quarters away to the right, and
 * three-quarters on to the left, where forward is across the head on the
 * screen, and it leans back instead. Side on to the right, held out ahead
 * of the body (`BOW_AHEAD`) and leaning forward too: leant back from the hip,
 * the long bow's stave crossed the face on the screen and the short bow's top
 * limb ended at the jaw; leant back further, the stave came into line with
 * the forearm and the bow turned over in the fist.
 */
const BOW_FWD = [6, 6, 12, -16, 6, 6, 20, -4];
/** How far over the soles a bow's lower tip is held, so it clears the boots and the stride rather than standing on them. */
const BOW_CLEAR = 1.8;
/**
 * How far forward of the hip a bow is held at each facing: further out in front seen from the left, where the bow's side is toward
 * whoever is looking and an upright bow at the hip stands up across the face, and side on from the right, where the bow is
 * beyond the body and its top limb ended at the jaw (see `BOW_FWD`).
 */
const BOW_AHEAD = [0.45, 0.45, 2.5, -0.3, -0.35, 0.8, 1.7, 0.2];
/**
 * And how much further out to the left than the hip: three-quarters on from the left, the width is what takes it off the face; from
 * in front and three-quarters on from the right, it keeps the lower limb off the left shin and thigh. Three-quarters away to the
 * left a little out too, where with the shoulders' turn varied from stride to stride (`WALK_VARY`) a long bow came within three
 * units of the middle of the face on the screen, as it did three-quarters on from the left at a run with two units and a half.
 */
const BOW_WIDE = [0.9, 0.8, 0, 1.3, 1.0, 0.8, 0.3, 3.0];
/** How far a bow's hand goes forward for each degree the shoulders turn back on its side, walking and running: see `bowArm`. */
const BOW_SWING = 0.03;
/** How much further forward a bow is held at a run, at each facing, for each unit it is lifted: see `bowArm`. */
const BOW_RUN_AHEAD = [0.7, 0.7, 0.3, 0, 0, 0, 0.3, 0.7];
/** How much higher again a bow is held at each facing: see `bowArm`. */
const BOW_LIFT = [0, 0, 0, 0, 0.3, 0.9, 1.2, 0.9];
/**
 * How far out from the body the top of a bow leans at each facing: out past the head from in front, where upright it would stand
 * up across the cheek, and all but upright elsewhere, where out would bring its lower tip in under the stride.
 */
const BOW_OUT = [12, 12, -4, -4, -4, -4, -4, 12];
/**
 * How far a bow is turned about its stave at each facing, its bend swung from straight ahead toward the body's left: seen from in
 * front or behind, a bow bent straight ahead is its edge, a line.
 */
const BOW_TURN = [40, 0, 0, 30, 40, 0, 0, 20];
const bowUp = (facing: number): V3 => {
  const fwd = byFacing(BOW_FWD, facing) * DEG, out = byFacing(BOW_OUT, facing) * DEG;
  return unit([-Math.sin(out), Math.sin(fwd), Math.cos(out) * Math.cos(fwd)]);
};
/**
 * And a spear or a javelin upright in the right fist: leaning forward and out
 * past the face -- except three-quarters on to the right and three-quarters
 * away to the left, where the fist is in line with the head on the screen and
 * the shaft leans back and out instead, clear of it -- three-quarters away
 * to the left by more, where at a run it came within two units of the
 * middle of the face on the screen. (`./spells/pikeman` keeps a copy.)
 */
const STAFF_BACK = [0, 1, 0, 0, 0, 1, 0, 0];
const STAFF_BACK_BY = -8;
const STAFF_OUT = [10, 22, 10, 10, 10, 32, 10, 10];
/** And side on to the left, where the shaft in the far hand stands in front of the face, leaning forward at least this far, clear of it. */
const STAFF_LEAST = [0, 0, 22, 0, 0, 0, 22, 0];
const staffUp = (facing: number, lean: number): V3 => {
  const back = byFacing(STAFF_BACK, facing);
  const ahead = Math.max(lean, byFacing(STAFF_LEAST, facing));
  const fwd = (ahead + (STAFF_BACK_BY - ahead) * back) * DEG, out = byFacing(STAFF_OUT, facing) * DEG;
  return unit([Math.sin(out), Math.sin(fwd), Math.cos(out) * Math.cos(fwd)]);
};

/**
 * How far further down a blade in the fist dips, in degrees, at the middle of
 * a turn from each facing to the next. Turning from three-quarters on to the
 * left to side on, `FIST_OUT` brings the blade round through pointing at the
 * viewer: from down to the right on the screen to down to the left, short
 * in the middle, it swept sixty degrees across the screen in one frame.
 * Dipped toward the ground on the way, it goes round through pointing down
 * with its length showing.
 */
const FIST_DIP = [0, 0, 0, 0, 0, 40, 0, 0];

/**
 * A blade in the fist at `wrist` (in the body's frame): forward and down and
 * out from the body, set off the hips rather than the forearm so it keeps to
 * a line that shows its length whichever way the body is seen, and tipped
 * forward and back with the arm's swing by a share of it; at a run carried
 * nearer level, so its point goes along over the knees coming through rather
 * than down across them; and raised toward level wherever that would put its
 * point in the ground -- as far as keeps it out, worked out rather than tried
 * eight degrees at a time, which stepped.
 */
function fistHeld(r: Rig, b: Bones, w: Weapon, at: number, wrist: Xf): Xf {
  const facing = r.bladeFacing ?? at;
  const out = fistOut(facing) * DEG;
  const fist = place(wrist, [0, 0, GRIP]);
  const run = (r.hover?.w ?? 0) * (r.hover?.g ?? 0);
  const f = ((facing % 8) + 8) % 8, u = f - Math.floor(f);
  const dip = FIST_DIP[Math.floor(f) % 8] * 4 * u * (1 - u);
  let tip = ((w.down ?? FIST_DOWN - byFacing(FIST_RUN, facing) * run) + dip - FIST_SWING * (r.arm[1][0] - 3)) * DEG;
  tip = Math.min(tip, Math.asin(Math.max(-1, Math.min(1, (fist[2] - 0.5) / w.to))));
  const h: V3 = [Math.sin(out), Math.cos(out), 0];
  const dir: V3 = [h[0] * Math.cos(tip), h[1] * Math.cos(tip), -Math.sin(tip)];
  return { m: aimed(b.pelvis, [0, 0, 0], dir, [Math.cos(out), -Math.sin(out), 0]).m, t: fist };
}

/**
 * A spear or a staff upright in the right fist at `wrist`, or a bow in the
 * left, as `staffUp` and `bowUp` stand them; a bow turned about its stave
 * from where it is seen, so its bend shows rather than its edge (see
 * `BOW_TURN`).
 */
function uprightHeld(b: Bones, w: Weapon, facing: number, wrist: Xf, swung = 0): Xf {
  let up: V3 = w.carry === 'staff' ? staffUp(facing, w.lean ?? 0) : bowUp(facing);
  if (swung) {
    // Its lower end swung out from the body about the hips' forward axis, `swung` degrees, and its top in toward the middle.
    const a = (w.carry === 'bow' ? -swung : swung) * DEG, c = Math.cos(a), sn = Math.sin(a);
    up = [up[0] * c - up[2] * sn, up[1], up[2] * c + up[0] * sn];
  }
  const turn = w.carry === 'bow' ? byFacing(BOW_TURN, facing) * DEG : 0;
  return { m: aimed(b.pelvis, [0, 0, 0], up, [Math.cos(turn), -Math.sin(turn), 0]).m, t: place(wrist, [0, 0, GRIP]) };
}

/** How far clear of the legs, bare, what is carried is kept: as thick as plate makes them, and a little more. */
const LEG_CLEAR = 0.25;
/** How far the arm carrying it may be taken out from the side for that, in degrees; a bow's hand, in units for each of those. */
const CLEAR_OUT = 34, BOW_OUT_BY = 0.05;
/** How far an upright one may be swung out about the hand where the arm has not kept it clear, in degrees: see `wield`. */
const UPRIGHT_OUT = 12;
/** How far from the middle of the head, on the screen, a spear's shaft or a bow's stave is kept: past the hair and the ears. */
const FACE_CLEAR = 3.2;

/**
 * The least turn, from nought to `most` degrees, that leaves `room` at
 * nought or more: stepped toward from nought by how fast the room grows
 * with the turn, a few times, so that it changes smoothly as the pose does.
 * Halving to the edge of what clears jumped to the far end of the range
 * the moment nothing in it cleared, and the blade with it, a quarter turn
 * in a frame.
 */
function leastTurn(room: (by: number) => number, most: number): number {
  let by = 0, r = room(0);
  for (let q = 0; q < 3 && r < 0; q++) {
    const h = by + 2 <= most ? 2 : -2, slope = (room(by + h) - r) / h;
    by = Math.max(0, Math.min(most, by - (r * slope) / (slope * slope + 1e-4)));
    r = room(by);
  }
  return by;
}

/**
 * How far what is carried in hand at `xf` is clear of the legs as `b` has
 * them (see `legRoom`) -- a blade and the grip's end below the fist; a
 * spear's butt or a bow's lower limb -- less `LEG_CLEAR`.
 */
function legsRoom(b: Bones, w: Weapon, xf: Xf): number {
  const lower = legRoom(b, place(xf, [0, 0, w.from]), place(xf, [0, 0, -0.6]));
  return (w.carry === 'fist' ? Math.min(lower, legRoom(b, place(xf, [0, 0, 0.6]), place(xf, [0, 0, w.to]))) : lower) - LEG_CLEAR;
}

/**
 * And how far the length of a spear or a bow above the fist is clear of the
 * face on the screen, less `FACE_CLEAR`: all of it, where the old guard
 * looked at the top alone, and the shaft went across the face below it.
 * What is well behind the head is hidden by it, and not counted.
 */
function faceRoom(b: Bones, w: Weapon, xf: Xf, view: View): number {
  const c = place(b.head, [0, 0.1, 1.2]), cd = dot(c, view.T), cs = onScreen(view, c);
  let room = Infinity;
  for (let i = 0; i <= 8; i++) {
    const q = place(xf, [0, 0, 0.6 + ((w.to - 0.6) * i) / 8]);
    if (dot(q, view.T) < cd - 0.8) continue;
    const p = onScreen(view, q);
    room = Math.min(room, Math.hypot(p[0] - cs[0], p[1] - cs[1]) - FACE_CLEAR);
  }
  return room;
}

/**
 * The arm carrying a blade, a spear or a bow taken out from the side as far
 * as keeps what is in it clear of the legs, and no further. It was turned in
 * the fist instead, by trying a handful of ways round each frame and taking
 * the cheapest that cleared: from one frame to the next the choice jumped,
 * and the blade flicked ten to thirty degrees once a stride; and a spear's
 * butt swung out from the leg brought its shaft in across the face. Now the
 * arm is moved, by the least that does it, found by halving: as the leg
 * comes and goes the arm goes out and back with it smoothly, the weapon is
 * held in the hand as it always is, and a spear moved out with the hand
 * stays as far off the face as it was.
 */
/** How far the last `clearOfLegs` took the arm out, in degrees: what `clearAhead` reads. */
let clearedBy = 0;
function clearOfLegs(r: Rig, fr: Frame, w: Weapon, facing: number, g: number, least = 0): void {
  const bow = w.carry === 'bow', k = bow ? 0 : 1, s = k ? 1 : -1, T = fr.tall;
  const b = skeleton(fr, r);
  const [ap, aa, at] = r.arm[k];
  // Out from the side by `by` degrees; a bow, whose arm is put where the hand is wanted (`bowArm`), by its hand put further out.
  const set = (by: number): void => {
    if (bow) bowArm(r, fr, w, 1.3 * g, facing, by * BOW_OUT_BY);
    else r.arm[k] = [ap, aa + by, at];
  };
  const room = (by: number): number => {
    set(by);
    const arm = joint(b.chest, [s * 2.1 * fr.sh, -0.1, ARM_AT * T + r.shrug[k]], r.arm[k][0], -s * r.arm[k][1], s * r.arm[k][2]);
    const wrist = joint(joint(arm, [0, 0, -UPPER * T], r.elbow[k]), [0, 0, -LOWER * T], ...r.hand[k]);
    return legsRoom(b, w, w.carry === 'fist' ? fistHeld(r, b, w, facing, wrist) : uprightHeld(b, w, facing, wrist));
  };
  clearedBy = 0;
  if (room(0) >= 0) {
    if (least > 0) set((clearedBy = Math.min(CLEAR_OUT, least)));
    else set(0);
    return;
  }
  let lo = 0, hi = CLEAR_OUT;
  if (room(hi) >= 0) {
    for (let q = 0; q < 8; q++) {
      const mid = (lo + hi) / 2;
      if (room(mid) >= 0) hi = mid;
      else lo = mid;
    }
  }
  set((clearedBy = Math.max(hi, Math.min(CLEAR_OUT, least))));
}

/**
 * Which shoulder whatever is slung on the back goes up over, at each facing:
 * the left, along the strap and away from the right hand and whatever it
 * works with -- save side on to the left, where the left is the near
 * shoulder and anything going up over it comes toward whoever is looking,
 * end on and lost against the back. At work where the work is done
 * left-handed (see `lefty`), the whole body is the mirror of itself, and
 * what is on its back is mirrored with it, strap and all: over the left
 * shoulder there, a spear's point stands up beside the raised mallet, and
 * three-quarters on from the left what hangs to the right hip is behind the
 * body.
 *
 * Something long, a spear, a javelin, a bow or a long sword in its
 * scabbard, shows past the head or below the hips wherever it is seen. A
 * head that stops at the ear, an axe's or a maul's, is lost behind the head
 * over the far shoulder three-quarters on or away, and there it goes up over
 * the near one, where it stands out past the shoulder. Staged for the
 * camera, as a wave is.
 */
const SLUNG_LEFT = [1, 1, 1, 1, 1, 1, 0, 1];
const SLUNG_LEFT_HEAD = [1, 0, 1, 0, 1, 1, 0, 1];
/**
 * How far each is turned about itself at each facing, over the right
 * shoulder (and the mirror of it over the left): an axe's bit turned to show
 * its face, standing off behind the haft, rather than its edge; and a bow,
 * side on, turned back off the body to show the bend of it.
 */
const SLUNG_HEAD_TURN = [0, -38, -90, 45, 0, 45, -90, -38];
const SLUNG_BOW_TURN = [0, 0, -50, 0, 0, 0, -50, 0];

/**
 * Whether something heavy goes over the left shoulder from where it is seen:
 * turned three-quarters away to the left, or side on to the left, the right
 * shoulder is the far one, and whatever lies back over it is behind the head
 * however it is angled. Staged for the camera, as a wave is.
 */
const overLeft = (facing: number): boolean => {
  const f = ((Math.round(facing) % 8) + 8) % 8;
  return f === 3 || f === 6 || f === 7;
};

/**
 * A blow taken on the shield, `u` of the way through it (`FigurePose.block`): the shield arm brought up and in across
 * the chest as far as the sculpted body's block takes its arm (`COVER`), knocked in at the impact; the trunk leant in.
 */
const BLOCK_ARM: Euler = [52, 4, 58], BLOCK_ELBOW = 104;
function blocked(r: Rig, u: number): void {
  const t = Math.min(1, Math.max(0, u)) * BLOCK.length, w = sampleKey(COVER, t, BLOCK.length, false);
  // (the knock at the impact: a sharp bump there, gone by the settle)
  const k = Math.max(0, 1 - Math.abs(t - BLOCK_IMPACT) / 0.06);
  const a = r.arm[0];
  r.arm[0] = [a[0] + (BLOCK_ARM[0] - 8 * k - a[0]) * w, a[1] + (BLOCK_ARM[1] - a[1]) * w, a[2] + (BLOCK_ARM[2] - a[2]) * w];
  r.elbow[0] += (BLOCK_ELBOW + 10 * k - r.elbow[0]) * w;
  r.spine = [r.spine[0] - 3 * w + 3 * k, r.spine[1], r.spine[2]];
  r.loose[0] = false;
}

/**
 * A blow landing, `f.t` of the way through the flinch (`FigurePose.flinch`): the trunk jolted away from where it came
 * from and the head snapped back with it (further for a blow to the head), the knees dipping (buckling for one to the
 * legs), all at its snap (`FLINCH_SNAP`) and gone by its end.
 */
function flinched(r: Rig, f: NonNullable<FigurePose['flinch']>): void {
  const t = Math.min(1, Math.max(0, f.t)) * FLINCH_SECS;
  const k = t < FLINCH_SNAP ? t / FLINCH_SNAP : Math.max(0, 1 - (t - FLINCH_SNAP) / (FLINCH_SECS * 0.75 - FLINCH_SNAP));
  const a = f.from ?? 0, back = Math.cos(a) * k, side = Math.sin(a) * k;
  const head = f.where === 'head', legs = f.where === 'legs' || f.where === 'feet';
  // (pitch: above nought leans back)
  r.spine = [r.spine[0] + 6 * back, r.spine[1], r.spine[2] - 6 * side];
  r.chest = [r.chest[0] + (head ? 4 : 9) * back, r.chest[1], r.chest[2] - 5 * side];
  r.head = [r.head[0] + (head ? 20 : 10) * back, r.head[1], r.head[2] - 5 * side];
  const dip = (legs ? 26 : 8) * k;
  r.knee = [r.knee[0] + dip, r.knee[1] + dip];
}

/** A frame at `at` on a bone, its z along `dir` and its x as near `out` as square to that allows. */
function aimed(bone: Xf, at: V3, dir: V3, out: V3): Xf {
  const z = unit(dir);
  const d = dot(out, z);
  const x = unit([out[0] - z[0] * d, out[1] - z[1] * d, out[2] - z[2] * d]);
  const y = cross(z, x);
  return { m: mm(bone.m, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]), t: place(bone, at) };
}

/**
 * A weapon in the fist as the forearm carries it, `w` of the way from where the carry `xf` set it: its point
 * ahead of the knuckles and a little down the arm, as a sword is held out at the end of a blow, and its flat
 * square to the forearm. In the body's frame, from the fist.
 */
function wielded(xf: Xf, wrist: Xf, fist: V3, w: number, haft = 0): Xf {
  const n = (v: V3): V3 => unit(v);
  const mix = (a: V3, b: V3): V3 => n([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]);
  const col = (m: M3, i: number): V3 => [m[i], m[3 + i], m[6 + i]];
  // Turned further toward the line of the forearm by `haft`, or right round past it to point down out of the bottom of the fist.
  const a = Math.atan2(0.5, 0.87) + haft * DEG;
  const dir = mix(col(xf.m, 2), n(mv(wrist.m, haft ? [0, Math.cos(a), -Math.sin(a)] : [0, 0.87, -0.5])));
  const out = mix(col(xf.m, 0), n(mv(wrist.m, [1, 0, 0])));
  return { m: aimed(ROOT, [0, 0, 0], dir, out).m, t: fist };
}

/**
 * How far the length of something held, from `a` to `b`, is clear of the
 * legs as `b` has them -- the thighs and the shins, each as thick as it is,
 * and a little more -- in units: below nought, it goes through one.
 */
function legRoom(bones: Bones, a: V3, b: V3): number {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dd = dot(d, d) || 1;
  let least = Infinity;
  for (let k = 0; k < 2; k++) {
    // And the foot: running seen from in front, the boot comes up high enough in the air to meet a spear's butt or a bow's limb.
    const foot = bones[`ankle${k}`];
    for (const [p, q, r] of [[bones[`hip${k}`].t, bones[`knee${k}`].t, 1.15], [bones[`knee${k}`].t, foot.t, 0.95], [place(foot, [0, -0.5, -0.4]), place(foot, [0, 1.6, -0.5]), 0.7]] as Array<[V3, V3, number]>) {
      // Sampled along the held thing, the nearest point of the bone to each.
      const e: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], ee = dot(e, e) || 1;
      for (let i = 0; i <= 8; i++) {
        const x: V3 = [a[0] + (d[0] * i) / 8, a[1] + (d[1] * i) / 8, a[2] + (d[2] * i) / 8];
        const t = Math.max(0, Math.min(1, ((x[0] - p[0]) * e[0] + (x[1] - p[1]) * e[1] + (x[2] - p[2]) * e[2]) / ee));
        least = Math.min(least, Math.hypot(x[0] - p[0] - e[0] * t, x[1] - p[1] - e[1] * t, x[2] - p[2] - e[2] * t) - r);
      }
    }
  }
  return dd > 0 ? least : Infinity;
}

/**
 * Where what is held in the hands is, and in which: its frame -- z along it
 * from its butt (`from`) to its point (`to`), nought where the fist closes on
 * it -- in the body's frame, as the carry puts it and as far as a spell's
 * pose takes it into the arms (`wield`, `wieldStaff`, `wieldBow`, `haft`,
 * `slide`). Nothing while it is put away. What `wield` draws it by, and what
 * `figureJoint` finds its point and its tips by.
 */
function heldFrame(r: Rig, b: Bones, arm: Weapon, facing: number): { xf: Xf; hand: number } | null {
  if (r.stowed) return null;
  let xf: Xf, hand: number;
  if (arm.carry === 'shoulder') {
    // In the fist square across it, and turned in the fist toward the line of the forearm by `haft`.
    hand = r.carried;
    const k = hand;
    xf = joint(joint(b[`wrist${k}`], [0, 0, GRIP], -90 - (r.haft ?? 0)), [0, 0, -(arm.fist ?? 0)], 0, 0, (k ? 1 : -1) * ((arm.spin ?? 0) + r.spin));
  } else if (arm.carry === 'fist') {
    hand = 1;
    // Forward and down from the fist (see `fistHeld`); on the move the arm carrying it keeps it clear of the legs (`clearOfLegs`).
    const fist = place(b.wrist1, [0, 0, GRIP]);
    const base = fistHeld(r, b, arm, facing, b.wrist1);
    /*
     * Wherever it would still go through a leg -- part way through a
     * blend from one pose to another -- turned out from the body about
     * the fist by as little as clears it (`leastTurn`), rather than the
     * cheapest of a few ways round tried afresh every frame, so that it
     * turns out smoothly and back as the leg comes and goes rather than
     * jumping between them.
     */
    const turned = (by: number): Xf => (by ? { m: mm(rz(-by * DEG), base.m), t: fist } : base);
    xf = turned(leastTurn((by) => legsRoom(b, arm, turned(by)) + LEG_CLEAR, CLEAR_OUT));
    // A blow struck by a spell: carried by the forearm, `wield` of the way, so the swing of the arm swings it.
    if ((r.wield ?? 0) > 0) xf = wielded(xf, b.wrist1, fist, Math.min(1, r.wield ?? 0), r.haft ?? 0);
  } else {
    hand = arm.carry === 'bow' ? 0 : 1;
    // A staff leant out from the body as well as forward, so its shaft passes beside the face rather than across it (see
    // `uprightHeld`); the arm carrying it keeps its lower end clear of the legs (`clearOfLegs`).
    xf = uprightHeld(b, arm, facing, b[`wrist${hand}`]);
    /*
     * Wherever the lower end -- a spear's butt, a bow's lower limb --
     * would still go through a leg, blended between poses: swung out from
     * the body about the hand by as little as clears it (`leastTurn`), a
     * few degrees at most, and never so far that the length above the
     * hand comes in over the face on the screen. It was swung five degrees
     * at a time, which jumped, with only the top kept off the head, and
     * the shaft below the top went across the face.
     */
    const wrist = b[`wrist${hand}`], at = (by: number): Xf => uprightHeld(b, arm, facing, wrist, by);
    if (legsRoom(b, arm, xf) + LEG_CLEAR < 0) {
      const view = viewOf(facing);
      let most = UPRIGHT_OUT;
      if (faceRoom(b, arm, at(most), view) < 0) {
        let ok = 0;
        if (faceRoom(b, arm, xf, view) >= 0) {
          for (let q = 0; q < 6; q++) {
            const mid = (ok + most) / 2;
            if (faceRoom(b, arm, at(mid), view) >= 0) ok = mid;
            else most = mid;
          }
        }
        most = ok;
      }
      xf = at(leastTurn((by) => legsRoom(b, arm, at(by)) + LEG_CLEAR, most));
    }
    // Taken into the arms by a spell: see `heldByArms`.
    const w = arm.carry === 'staff' ? r.wieldStaff ?? 0 : r.wieldBow ?? 0;
    if (w > 0) xf = heldByArms(r, b, arm, xf, hand, Math.min(1, w));
  }
  // Slid through the fist toward its point.
  if (r.slide) xf = { m: xf.m, t: [xf.t[0] + xf.m[2] * r.slide, xf.t[1] + xf.m[5] * r.slide, xf.t[2] + xf.m[8] * r.slide] };
  return { xf, hand };
}

/**
 * A spear or a bow taken from its carry into the arms, `w` of the way: a
 * spear along the line of the right forearm, its point past the knuckles
 * (turned toward or away from that line by `haft`), or with `both` along the
 * line from the right fist through the left; a bow square across the left
 * fist, its back out past the knuckles, so the bow arm points it and the
 * hand's turn about the forearm cants it.
 */
function heldByArms(r: Rig, b: Bones, arm: Weapon, carried: Xf, hand: number, w: number): Xf {
  const wrist = b[`wrist${hand}`].m;
  const col = (m: M3, i: number): V3 => [m[i], m[3 + i], m[6 + i]];
  const mix = (a: V3, c: V3, u: number): V3 => unit([a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u]);
  let dir: V3;
  if (arm.carry === 'staff') {
    const h = (r.haft ?? 0) * DEG;
    dir = mv(wrist, [0, -Math.sin(h), -Math.cos(h)]);
    const both = Math.min(1, r.both ?? 0);
    if (both > 0) {
      const a = place(b.wrist1, [0, 0, GRIP]), c = place(b.wrist0, [0, 0, GRIP]);
      const d: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      // Hands too near together to say a line between them leave it to the right forearm.
      if (Math.hypot(d[0], d[1], d[2]) > 0.8) dir = mix(dir, unit(d), both);
    }
  } else dir = mv(wrist, [0, 1, 0]);
  return { m: aimed(ROOT, [0, 0, 0], mix(col(carried.m, 2), dir, w), mix(col(carried.m, 0), col(wrist, 0), w)).m, t: carried.t };
}

/** Where a bow's string is drawn to: from straight between its tips toward the right hand's fingers, `Rig.draw` of the way; or nothing, undrawn and with no arrow on it. */
function nockOf(r: Rig, b: Bones, arm: Weapon, xf: Xf): V3 | null {
  const draw = Math.max(0, Math.min(1, r.draw ?? 0));
  if (!arm.tips || (draw <= 0 && !r.nocked)) return null;
  const [lo, hi] = arm.tips.map((p) => place(xf, p));
  const mid: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const to = place(b.wrist1, [0, 0, GRIP]);
  return [mid[0] + (to[0] - mid[0]) * draw, mid[1] + (to[1] - mid[1]) * draw, mid[2] + (to[2] - mid[2]) * draw];
}

/** How far over the seat the low end of what is slung across the back is kept, sat; and the most it is tipped across for that. */
const SLUNG_CLEAR = 0.4;
const SLUNG_MOST = 80 * DEG;

/**
 * Where a weapon is put away, as `wield` draws it there, for a chest worn `fit` (see `CHEST_FIT`): in its scabbard at the hip,
 * through the belt, or slung across the back (`slungFrame`).
 */
function awayFrame(r: Rig, b: Bones, arm: Weapon, facing: number, fr: Frame, fit: number): Xf {
  if (arm.stow === 'hip' && cutsOf(arm).sheathed) {
    // The scabbard's throat at the belt on the left, forward of the hip, and the blade down and back behind the leg; a knife's
    // upright at the front of the belt, its handle standing up over it where it shows from either side.
    const side = 1.64 * fr.wa * fit + 0.3;
    const knife = arm.to < KNIFE_TO;
    // A knife on the right of the buckle, clear of the left hand wherever work holds it; a blade on the left, drawn across.
    const x = knife ? 1 : -1;
    // Seated, the scabbard swings back along the seat and a little out, rather than hanging down through it to below the feet.
    // Standing, a sword's hangs out from the leg enough to be seen past it from the front.
    const dir = unit(r.sit ? [0.3 * x, -0.9, -0.28] : knife ? [0.12, 0.1, -1] : [-0.3, -0.56, -0.78]);
    const at: V3 = knife ? [side * 0.84, 1.18 * fit, 1.25] : [-side * 1.06, 0.55, 1.15];
    const k = arm.throat ?? 0.7;
    return aimed(b.pelvis, [at[0] - dir[0] * k, at[1] - dir[1] * k, at[2] - dir[2] * k], dir, [x, 0, 0]);
  }
  if (arm.stow === 'belt') {
    // Through the belt at the right hip, head up: a hatchet by its haft with its head on the belt, a club by its grip under the knob;
    // an axe's bit turned out from the hip and a little back, so its profile shows from in front and behind, and three-quarters on
    // from the right and three-quarters away from the left, rather than its edge.
    const side = 1.64 * fr.wa * fit + 0.25;
    const [outward, ahead] = arm.splay ?? [0.12, 0.2];
    const dir = unit(arm.headUp ? [outward, ahead, 1] : [outward, ahead + 0.02, -1]);
    const k = arm.belt ?? 0;
    return aimed(b.pelvis, [side - dir[0] * k, 0.35 - dir[1] * k, 1.15 - dir[2] * k], dir, [-0.5, -1, 0]);
  }
  return slungFrame(r, b, arm, facing, slungBehind(fit)).xf;
}
/** How far out behind the chest, in its frame, a thing slung on the back is, over a chest worn `fit`: over the chest and whatever is on it. */
const slungBehind = (fit: number): number => -(1.3 * fit + 0.34);

/**
 * Where a weapon put away on the back hangs, as `wield` slings it, `behind` out behind the chest: its frame, and over which
 * shoulder (-1 the left). Put away for work, or on its way there or back in the hand (`stowHand`), slung as it is while the hands work.
 */
function slungFrame(r: Rig, b: Bones, arm: Weapon, facing: number, behind: number): { xf: Xf; lr: number } {
  // Across the back by its middle, head up over a shoulder or point down to the other hip: which, from where it is seen (see
  // `SLUNG_LEFT`).
  const f = ((Math.round(facing) % 8) + 8) % 8;
  // Something heavy slung head up is slung head down while the hands work, so its head is down by the hip and not up by the
  // shoulder beside the head of the hammer that is raised over it.
  const work = r.tool || r.stowTurn !== undefined, up = arm.headUp && !(work && arm.carry === 'shoulder');
  const left = (arm.carry === 'shoulder' && up ? SLUNG_LEFT_HEAD : SLUNG_LEFT)[f] === 1;
  const lr = left !== (work && r.lefty) ? -1 : 1;
  const mid = (arm.from + arm.to) / 2;
  /*
   * Seated, a long blade slung across the back went straight down through the seat behind the hips and out under it:
   * tipped further across the back, a few degrees at a time, as far as keeps its low end over the seat.
   */
  const seat = r.sit ? place(b.pelvis, [0, 0, SEAT])[2] + SLUNG_CLEAR : -Infinity;
  let sl = (arm.slant ?? 30) * DEG, dir: V3, z: number;
  for (;;) {
    dir = up ? [lr * Math.sin(sl), 0, Math.cos(sl)] : [-lr * Math.sin(sl), 0, -Math.cos(sl)];
    // Hung lower the longer it is, so whichever end is up stops at the ear rather than over the crown -- except a spear or a
    // javelin, whose head goes up over the head as a slung spear's does, so that its butt stops at the calf and not on the ground;
    // while the hands work, down behind the head, where over it the head of the spear stands beside the hammer raised there.
    const top = 0.85 + Math.max(dir[2] * (arm.to - mid), dir[2] * (arm.from - mid));
    z = 0.85 - Math.max(0, top - (arm.carry === 'staff' ? (work ? 3.1 : 4.6) : 3.1));
    const end = (e: number): number => place(b.chest, [dir[0] * (e - mid), behind, z + dir[2] * (e - mid)])[2];
    if (Math.min(end(arm.from), end(arm.to)) >= seat || sl >= SLUNG_MOST) break;
    sl = Math.min(SLUNG_MOST, sl + 5 * DEG);
  }
  // Turned about itself from where it is seen (see `SLUNG_HEAD_TURN`); over the left shoulder, turned half round as well, so that
  // it is the mirror of itself over the right, an axe's bit standing off the outside of the haft there too.
  const turn = arm.carry === 'shoulder' && up ? SLUNG_HEAD_TURN[f] : arm.carry === 'bow' ? SLUNG_BOW_TURN[f] : 0;
  const xf = joint(aimed(b.chest, [-dir[0] * mid, behind, z - dir[2] * mid], dir, [0, -1, 0]), [0, 0, 0], 0, 0, lr < 0 ? 180 - turn : turn);
  return { xf, lr };
}

export interface View {
  /** Where a step along the body's right and its front go on the screen. */
  ex: Pt;
  ey: Pt;
  /** Toward the viewer, and the light, in the body's own frame. */
  T: V3;
  L: V3;
  /** Toward the viewer along the ground. */
  H: Pt;
}

const SX = HALF_W / UNITS_PER_TILE;
const SY = HALF_H / UNITS_PER_TILE;
/**
 * The body turned to face one of the eight ways. Nought is straight at the
 * viewer and each step an eighth of a turn to screen right, which on the
 * island's ground is one of the eight compass steps; so a body walking
 * north-east faces the way it is walking at every one of the camera's turns.
 */
export function viewOf(facing: number): View {
  const th = Math.PI / 4 - (facing * Math.PI) / 4;
  const R: Pt = [-Math.sin(th), Math.cos(th)];
  const F: Pt = [Math.cos(th), Math.sin(th)];
  const ex: Pt = [(R[0] - R[1]) * SX, (R[0] + R[1]) * SY];
  const ey: Pt = [(F[0] - F[1]) * SX, (F[0] + F[1]) * SY];
  const T = unit([R[0] + R[1], F[0] + F[1], (2 * SY) / HEIGHT_SCALE]);
  // Over the viewer's left shoulder: to the left on the screen, a little toward the viewer, and high.
  const lu = -0.55 / Math.SQRT2 + 0.38 / Math.SQRT2, lv = 0.55 / Math.SQRT2 + 0.38 / Math.SQRT2;
  const L = unit([lu * R[0] + lv * R[1], lu * F[0] + lv * F[1], 0.78]);
  const h = Math.hypot(T[0], T[1]) || 1;
  return { ex, ey, T, L, H: [T[0] / h, T[1] / h] };
}

/** How far down from level a crease is lit as turned, whichever way it is (`Face.crease`), in degrees. */
const CREASE_DOWN = 30;
const creased = (n: V3): V3 => {
  const h = Math.hypot(n[0], n[1]) || 1, c = Math.cos(CREASE_DOWN * DEG) / h;
  return [n[0] * c, n[1] * c, -Math.sin(CREASE_DOWN * DEG)];
};
/** Light on a facet turned along `n`: wrapped, so a face turned from the light is shaded rather than black. */
function lightOn(n: V3, L: V3): number {
  const d = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
  return 0.62 + 0.44 * Math.pow(0.5 + 0.5 * d, 1.25) + (n[2] > 0.7 ? 0.03 : 0);
}

/**
 * Whether a point is out of sight behind a solid: inside it, or with it
 * between the point and the viewer. The solid is an egg in the frame `xf`,
 * so the test is a line against a ball once that frame is undone.
 */
function behind(xf: Xf, solid: { c: V3; r: V3 }, T: V3): (p: V3) => boolean {
  const m = xf.m;
  // The frame's turn undone is its transpose.
  const back = (v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const t = back(T);
  const d: V3 = [t[0] / solid.r[0], t[1] / solid.r[1], t[2] / solid.r[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  return (p: V3): boolean => {
    const q = back([p[0] - xf.t[0], p[1] - xf.t[1], p[2] - xf.t[2]]);
    const o: V3 = [(q[0] - solid.c[0]) / solid.r[0], (q[1] - solid.c[1]) / solid.r[1], (q[2] - solid.c[2]) / solid.r[2]];
    const oo = o[0] * o[0] + o[1] * o[1] + o[2] * o[2];
    if (oo < 1) return true;
    const od = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    // Toward the viewer the line only meets the ball if it is heading for it and passes within its radius.
    return od < 0 && od * od - dd * (oo - 1) > 0;
  };
}

interface Laid {
  part: Part;
  s: Pt[];
  vis: boolean[];
  k: number[];
  /** For a `toon` part, each facet the light's steps cut across, in its pieces: each piece's step and its corners on the screen. */
  split?: Map<number, Array<[number, Pt[]]>>;
  d: number[];
  /** How squarely each facet faces the viewer: near nought at the edge of the thing, turning away. */
  t: number[];
  key: number;
  /** For a `toon` part, how fine it is drawn: nought as anything else, one lined thinly (`TOON_THIN_PX`), two not lined at all. */
  fine: number;
}

/* ---- what is worked into a surface ------------------------------------------------ */

const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * How finely each pattern is cut, in tenths of a metre, and how close it is
 * ever drawn on the screen, in pixels: a mail ring is two centimetres across,
 * but a row of them two pixels apart is a grey smear, so at the sizes the
 * island is played at the rows go wider apart than life until they read as
 * rows. Under two of a pattern to a facet it is not drawn at all.
 */
const PATTERN: Record<Pattern, { a: number; b: number; px: number }> = {
  mail: { a: 0.2, b: 0.2, px: 3.0 },
  scale: { a: 0.9, b: 0.62, px: 5.0 },
  quilt: { a: 0.62, b: 9, px: 5.2 },
  lames: { a: 9, b: 0.5, px: 3.6 },
  grain: { a: 9, b: 0.35, px: 3 },
  studs: { a: 0.62, b: 0.62, px: 5.5 },
};

/**
 * The patterns on the facets of one part just filled: each clipped to its
 * facet and drawn through the facet's corners, so it lies on the surface and
 * turns with it -- a mail row runs round a sleeve, a lame across a skirt of
 * plate -- in a dark and a light shade of the facet's own colour at its own
 * light. A four-cornered facet only, which is every band of a ring or a
 * chain; the ends are left plain.
 */
function worked(g: CanvasRenderingContext2D, l: Laid, faces: number[], P: Palette, px: number, hs: number): void {
  const f = l.part.mesh.f;
  const v = l.part.mesh.v;
  // Mail's rows and rings, gathered by shade across the whole part and laid down together at the end.
  const mailRows = new Map<string, Path2D>(), mailRings = new Map<string, Path2D>();
  // Studs' shadows and heads, gathered the same way.
  const studShadows = new Map<string, Path2D>(), studHeads = new Map<string, Path2D>();
  // Scale's courses: the dark line under each row of feet, and the lit lip along them.
  const scaleUnders = new Map<string, Path2D>(), scaleLips = new Map<string, Path2D>();
  const pathIn = (m: Map<string, Path2D>, c: string): Path2D => {
    let path = m.get(c);
    if (!path) { path = new Path2D(); m.set(c, path); }
    return path;
  };
  for (const fi of faces) {
    const face = f[fi];
    if (!face.pat || face.i.length !== 4) continue;
    const [i0, i1, i2, i3] = face.i;
    let [s0, s1, s2, s3] = [l.s[i0], l.s[i1], l.s[i2], l.s[i3]];
    const across = (Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) + Math.hypot(s2[0] - s3[0], s2[1] - s3[1])) / 2 / px;
    const up = (Math.hypot(s3[0] - s0[0], s3[1] - s0[1]) + Math.hypot(s2[0] - s1[0], s2[1] - s1[1])) / 2 / px;
    const cut = PATTERN[face.pat];
    const W = (dist(v[i0], v[i1]) + dist(v[i3], v[i2])) / 2, H = (dist(v[i0], v[i3]) + dist(v[i1], v[i2])) / 2;
    // Up the facet is up the screen, whichever way round the mesh was cut: scales overlap downward.
    if ((s3[1] + s2[1]) / 2 > (s0[1] + s1[1]) / 2) [s0, s1, s2, s3] = [s3, s2, s1, s0];
    const at = (a: number, b: number): Pt => {
      const x0 = s0[0] + (s1[0] - s0[0]) * a, y0 = s0[1] + (s1[1] - s0[1]) * a;
      const x1 = s3[0] + (s2[0] - s3[0]) * a, y1 = s3[1] + (s2[1] - s3[1]) * a;
      return [x0 + (x1 - x0) * b, y0 + (y1 - y0) * b];
    };
    const k = l.k[fi];
    if (face.pat === 'mail') {
      /*
       * Mail as it reads at the size the island is played at: rows of rings,
       * each row a dark line where it hangs over the one below and a bead of
       * light on the top of every ring, every other row half a ring along.
       * The rows and the rings in them are counted off the facet's own size,
       * not off how turned it is to the viewer, so the rows run on unbroken
       * from one facet of a band to the next round the body.
       */
      const nr = Math.max(1, Math.min(Math.floor(H / cut.b), Math.round((H * HEIGHT_SCALE) / (px * cut.px))));
      const nc = Math.max(1, Math.min(Math.floor(W / cut.a), Math.round((W * hs) / (px * cut.px))));
      // In steps of light a twenty-fifth apart, so a part's rings go down in a few batches, not one for every facet.
      const kq = Math.round(k * 25) / 25;
      const dark = pathIn(mailRows, shade(mixRGB(P[face.m], COOL_SHADOW, 0.3), kq * 0.72));
      const beads = pathIn(mailRings, shade(mixRGB(P[face.m], WARM_LIGHT, 0.42), Math.min(1.25, kq * 1.08)));
      const r0 = px * 0.5;
      for (let r = 0; r < nr; r++) {
        const lo = at(0, (r + 0.12) / nr), hi = at(1, (r + 0.12) / nr);
        dark.moveTo(lo[0], lo[1]);
        dark.lineTo(hi[0], hi[1]);
        const b = (r + 0.62) / nr;
        for (let c = 0; c <= nc; c++) {
          const a = (c + (r % 2 ? 0 : 0.5)) / nc;
          if (a <= 0 || a > 1) continue;
          const p = at(a, b);
          beads.rect(p[0] - r0, p[1] - r0, 2 * r0, 2 * r0);
        }
      }
      continue;
    }
    if (face.pat === 'scale') {
      /*
       * Dragon scale as it reads at the size the island is played at: courses
       * of scales, each a row of rounded feet with a dark line under them where
       * they hang over the course below and a lit lip just inside it, every
       * other course half a scale along. Counted off the facet's own size as
       * mail's rows are, so the courses run on unbroken round the body from
       * one facet of a band to the next, and a scale cut by the edge of a
       * facet is finished on the next.
       */
      const nr = Math.max(1, Math.min(Math.floor(H / cut.b), Math.round((H * HEIGHT_SCALE) / (px * cut.px))));
      const nc = Math.max(1, Math.min(Math.floor(W / cut.a), Math.round((W * hs) / (px * cut.px))));
      const kq = Math.round(k * 25) / 25;
      const under = pathIn(scaleUnders, shade(mixRGB(P[face.m], COOL_SHADOW, 0.42), kq * 0.62));
      const lip = pathIn(scaleLips, shade(mixRGB(P[face.m], WARM_LIGHT, 0.32), Math.min(1.25, kq * 1.1)));
      const half = (path: Path2D, a0: number, a1: number, foot: number, notch: number, rising: boolean): void => {
        // Half a scale's foot: from its notch round down to the middle of its foot, or back up the other side.
        const [p0, c, p1] = rising ? [at(a0, foot), at(a1, foot), at(a1, notch)] : [at(a0, notch), at(a0, foot), at(a1, foot)];
        path.moveTo(p0[0], p0[1]);
        path.quadraticCurveTo(c[0], c[1], p1[0], p1[1]);
      };
      for (let r = 0; r < nr; r++) {
        const foot = (r + 0.08) / nr, notch = (r + 0.62) / nr, lipAt = (r + 0.2) / nr;
        const off = r % 2 ? 0.5 : 0;
        for (let c = -1; c <= nc; c++) {
          const a0 = (c + off) / nc, am = (c + off + 0.5) / nc, a1 = (c + off + 1) / nc;
          if (a0 >= 0 && am <= 1) half(under, a0, am, foot, notch, false);
          if (am >= 0 && a1 <= 1) half(under, am, a1, foot, notch, true);
          // The lit lip only where a scale is big enough on the screen to have one: at the size the island is played at, a lip of
          // light along each is a speckle over the course, which is what should read.
          const l0 = Math.max(0, a0 + 0.22 / nc), l1 = Math.min(1, a1 - 0.22 / nc);
          if (px < 0.22 && l1 > l0) {
            const p0 = at(l0, lipAt), p1 = at(l1, lipAt);
            lip.moveTo(p0[0], p0[1]);
            lip.lineTo(p1[0], p1[1]);
          }
        }
      }
      continue;
    }
    if (face.pat === 'studs') {
      // Hide studded with rivets: a head at each crossing of a coarse grid, lit on top with its shadow below and to the side, counted
      // off the facet as mail's rings are. It is what says leather armour rather than a coat, the shape of the two being alike.
      const nr = Math.max(1, Math.min(Math.floor(H / cut.b), Math.round((H * HEIGHT_SCALE) / (px * cut.px))));
      const nc = Math.max(1, Math.min(Math.floor(W / cut.a), Math.round((W * hs) / (px * cut.px))));
      const kq = Math.round(k * 25) / 25;
      const under = pathIn(studShadows, shade(mixRGB(P[face.m], COOL_SHADOW, 0.4), kq * 0.6));
      const heads = pathIn(studHeads, shade(mixRGB(P.rivet, P[face.m], 0.25), Math.min(1.2, kq * 1.06)));
      const r0 = px * 0.7;
      for (let r = 0; r < nr; r++) {
        for (let c = 0; c < nc; c++) {
          const p = at((c + (r % 2 ? 0.25 : 0.75)) / nc, (r + 0.5) / nr);
          under.rect(p[0] - r0 + px * 0.45, p[1] - r0 + px * 0.6, 2 * r0, 2 * r0);
          heads.rect(p[0] - r0, p[1] - r0, 2 * r0, 2 * r0);
        }
      }
      continue;
    }
    // Quilting's channels are counted off the facet's own width, as mail's rings are, so they run on from facet to facet round a coat.
    const quilt = face.pat === 'quilt';
    const cols = quilt ? Math.max(1, Math.min(Math.floor(W / cut.a), Math.round((W * hs) / (px * cut.px)))) : Math.floor(Math.min(W / cut.a, across / cut.px));
    const rows = Math.floor(Math.min(H / cut.b, up / cut.px));
    if ((!quilt && cut.a < 9 && cols < 2) || (cut.b < 9 && rows < 2)) continue;
    const dark = new Path2D(), lit = new Path2D();
    const seg = (path: Path2D, pts: Pt[]): void => {
      path.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < pts.length; q++) path.lineTo(pts[q][0], pts[q][1]);
    };
    if (face.pat === 'quilt') {
      // The channels a padded coat is stitched in, running down it -- one down each facet's edge as well -- each with the puff of its wadding beside it.
      for (let c = 0; c < cols; c++) {
        const a = c / cols;
        seg(dark, [at(a, 0), at(a, 1)]);
        seg(lit, [at(a + 0.3 / cols, 0), at(a + 0.3 / cols, 1)]);
      }
    } else if (face.pat === 'lames') {
      // Plates overlapping downward: each lame's lower edge a dark line with the lit lip of the one below it.
      for (let r = 1; r < rows; r++) {
        const b = r / rows;
        seg(dark, [at(0, b), at(1, b)]);
        seg(lit, [at(0, b - 0.14 / rows), at(1, b - 0.14 / rows)]);
      }
    } else if (face.pat === 'grain') {
      for (let r = 1; r < rows; r++) {
        const b = r / rows;
        seg(dark, [at(0, b), at(0.3, b + 0.04 / rows), at(0.62, b - 0.05 / rows), at(1, b + 0.02 / rows)]);
      }
    }
    g.save();
    const clip = new Path2D();
    seg(clip, [s0, s1, s2, s3]);
    clip.closePath();
    g.clip(clip);
    g.lineWidth = Math.max(px * 0.8, 0.12);
    g.lineCap = 'round';
    g.strokeStyle = shade(P[face.m], k * 0.68);
    g.stroke(dark);
    g.lineWidth = Math.max(px * 0.6, 0.09);
    g.strokeStyle = shade(P[face.m], Math.min(1.5, k * 1.22));
    g.stroke(lit);
    g.restore();
  }
  if (mailRows.size) {
    g.lineWidth = px * 0.75;
    g.lineCap = 'butt';
    for (const [c, path] of mailRows) { g.strokeStyle = c; g.stroke(path); }
    for (const [c, path] of mailRings) { g.fillStyle = c; g.fill(path); }
  }
  for (const [c, path] of studShadows) { g.fillStyle = c; g.fill(path); }
  for (const [c, path] of studHeads) { g.fillStyle = c; g.fill(path); }
  if (scaleUnders.size) {
    g.lineCap = 'round';
    g.lineWidth = Math.max(px * 1.3, 0.14);
    for (const [c, path] of scaleUnders) { g.strokeStyle = c; g.stroke(path); }
    g.lineWidth = Math.max(px * 0.6, 0.09);
    for (const [c, path] of scaleLips) { g.strokeStyle = c; g.stroke(path); }
  }
}

/* ---- rare gear --------------------------------------------------------------------- */

/**
 * The shine on rare gear, worn.
 *
 * On the ground a rare thing sheds motes and a bloom (`drawShine`); on a body
 * that would wash the whole figure in one colour and bury the pieces that are
 * rare under it. So what is rare carries its light on itself, inside its own
 * outline, in the colour its rarity is written in -- as light only: the piece
 * keeps its own steel, wood or dye, and the colour is a sheen on the side of
 * it the light falls on and the glint that crosses it, more of it the rarer
 * it is:
 *
 *   rare        a blue sheen, and a slow glint crossing it nearly always
 *   supreme     a violet sheen that breathes, and a quicker glint
 *   fantastic   a gold sheen that breathes, a glint quicker still and
 *               whiter, and stars that open on it here and there
 *
 * Everything of one rarity on a body shines as one: one tint, and one glint
 * that crosses all of it together, so a rare set reads as a set rather than
 * as a dozen things twinkling out of step. Each part takes its shine as it is
 * drawn, so a plain sleeve over a rare breastplate covers the breastplate's
 * shine as it covers the breastplate. The colours are read off `RARITIES`,
 * like the ground's, so the list, the ground and the body all say the same
 * colour for the same word.
 */
const GLINT = [
  null,
  { period: 3.2, sweep: 0.92, band: 0.22, core: 0.46, glow: 0, stars: 0, white: 0.2, dye: 0.7 },
  { period: 2.6, sweep: 0.9, band: 0.2, core: 0.5, glow: 0.03, stars: 0, white: 0.2, dye: 0.75 },
  { period: 2.2, sweep: 0.88, band: 0.18, core: 0.56, glow: 0.04, stars: 3, white: 0.15, dye: 0.85 },
] as const;
/** How saturated the colour of a rarity's light on a piece may be: the island's chalk, not a sign painter's. */
const SHINE_SAT = 0.55;
/** A colour with its saturation, as the eye reads it, held to at most `s`: pulled toward its own grey. */
const tamed = (c: RGB, s: number): RGB => {
  const top = Math.max(c[0], c[1], c[2]), low = Math.min(c[0], c[1], c[2]);
  const sat = top > 0 ? (top - low) / top : 0;
  if (sat <= s) return c;
  const k = s / sat;
  return [top - (top - c[0]) * k, top - (top - c[1]) * k, top - (top - c[2]) * k];
};
/** Seconds to one breath of a supreme or fantastic piece's light. */
const BREATH = 2.4;

const rarityRgb = (rare: number): RGB => hex(rarityOf({ rare }).colour);
/** A rarity's ink pushed away from grey, as the ground's shine does: the pastel blue a real blue, the lilac a violet. */
const deepened = (c: RGB, spread = 2): RGB => {
  const top = Math.max(c[0], c[1], c[2]);
  return [top - (top - c[0]) * spread, top - (top - c[1]) * spread, top - (top - c[2]) * spread].map((x) => Math.max(0, x)) as RGB;
};
/** A colour at full saturation for its hue, at middle lightness: what a 'color' blend takes the hue and saturation of. */
const saturated = (c: RGB): RGB => {
  const top = Math.max(c[0], c[1], c[2]), low = Math.min(c[0], c[1], c[2]);
  if (top - low < 1) return c;
  return c.map((x) => ((x - low) / (top - low)) * 255) as RGB;
};
const rgba = (k: RGB, a: number): string => `rgba(${Math.round(k[0])}, ${Math.round(k[1])}, ${Math.round(k[2])}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** A colour's hue in degrees, its saturation and its value, each of the last two nought to one. */
function hsvOf(c: RGB): [number, number, number] {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const top = Math.max(r, g, b), low = Math.min(r, g, b), d = top - low;
  let h = 0;
  if (d > 1e-6) h = top === r ? ((g - b) / d) % 6 : top === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, top > 0 ? d / top : 0, top];
}
function fromHsv(h: number, s: number, v: number): RGB {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * How far a rare piece is glazed toward its rarity's hue, in shadow and full in the light: every facet of it, so it reads as rare
 * whichever way it is turned, and never the whole way, so it reads as what it is made of -- steel still steel, a green scale still
 * green. The rarity's colour at full strength is kept for its glint and the rim round it.
 */
const RARE_GLAZE: Array<[number, number] | null> = [null, [0.2, 0.34], [0.22, 0.38], [0.34, 0.52]];
/**
 * The saturation a glaze raises a colour toward: the island's chalk, and gold a little past it, which paler is beige on steel --
 * whose own blue takes some of it away.
 */
const GLAZE_SAT = [0, 0.5, 0.5, 0.66];
interface Glaze { base: Palette; hue: number; sat: number; shadow: number; lit: number }
/** The palettes of rare pieces, each with what it glazes and how: see `rarePalette`. */
const GLAZES = new WeakMap<Palette, Glaze>();
const rarePalettes = new WeakMap<Palette, Map<number, Palette>>();

/**
 * A colour glazed toward a hue by `t`, at its own value, so what is lit stays lit. The two are mixed as colour and not as light:
 * the colour's own hue and saturation give way by `t` to the glaze's hue at the island's chalk, so a grey takes the glaze's hue
 * and nothing between -- steel toward gold goes warm, not through green -- and a colour keeps its own the more the stronger it is,
 * a coloured material by as little as half as much, so a green scale is still green under gold and not mud.
 */
function glazed(c: RGB, hue: number, t: number, to: number): RGB {
  const [h, sat, v] = hsvOf(c);
  const tt = t * (1 - 0.5 * Math.min(1, sat / 0.4));
  const x = sat * Math.cos(h * DEG) * (1 - tt) + to * Math.cos(hue * DEG) * tt;
  const y = sat * Math.sin(h * DEG) * (1 - tt) + to * Math.sin(hue * DEG) * tt;
  return fromHsv((Math.atan2(y, x) / DEG + 360) % 360, Math.min(1, Math.hypot(x, y)), v);
}

/**
 * A rare piece's colours, glazed toward its rarity's hue at the strength its shadow takes: what its patterns, its lines and its rim
 * are drawn in. Its facets are glazed from its own colours by `toneOf`, further where the light is on them. Made once a palette.
 */
function rarePalette(P: Palette, rare: number): Palette {
  const how = RARE_GLAZE[rare];
  if (!how) return P;
  let byRare = rarePalettes.get(P);
  if (!byRare) rarePalettes.set(P, (byRare = new Map()));
  let R = byRare.get(rare);
  if (!R) {
    const hue = hsvOf(rarityRgb(rare))[0], sat = GLAZE_SAT[rare];
    R = { ...P };
    for (const m of Object.keys(P) as Mat[]) R[m] = glazed(P[m], hue, how[0], sat);
    GLAZES.set(R, { base: P, hue, sat, shadow: how[0], lit: how[1] });
    byRare.set(rare, R);
  }
  return R;
}

/** A colour back out of the `rgb(r,g,b)` that `shade` makes of it. */
const rgbOfCss = (c: string): RGB => c.slice(4, -1).split(',').map(Number) as RGB;

/** A tone of a rare piece glazed by how much light is on it: its shadow's strength below three-quarters lit, the light's at full. */
const glazedTones = new Map<string, string>();
function glazedTone(tone: string, glaze: Glaze, k: number): string {
  const u = Math.max(0, Math.min(1, (k - 0.78) / 0.24));
  const t = glaze.shadow + (glaze.lit - glaze.shadow) * u * u * (3 - 2 * u);
  const key = `${tone}|${glaze.hue}|${glaze.sat}|${t.toFixed(2)}`;
  let out = glazedTones.get(key);
  if (!out) {
    const c = rgbOfCss(tone);
    out = shade(glazed(c, glaze.hue, t, glaze.sat), 1);
    glazedTones.set(key, out);
    if (glazedTones.size > 4000) glazedTones.delete(glazedTones.keys().next().value as string);
  }
  return out;
}

/** Everything of one rarity on a body, as it is laid on the screen: its extent, for the glint to cross all of it together, and where the stars open this time. */
interface Shine {
  rare: number;
  c: RGB;
  deep: RGB;
  /** The colour glazed into its lit side and the glint's own: its rarity's, deepened and held to the island's chalk. */
  tone: RGB;
  /** Its rarity's hue at full strength, whose hue and saturation are laid over what it shines on at that thing's own lightness. */
  hue: RGB;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The line the glint sweeps along, the long way of whatever shines: from `a` to `b` on the screen. */
  a: Pt;
  b: Pt;
  seed: number;
  stars: Array<{ li: number; at: Pt; life: number; k: number }>;
}

function shinesOf(laid: Laid[], now: number): Map<number, Shine> {
  const out = new Map<number, Shine>();
  const spots = new Map<number, Array<[number, Pt]>>();
  laid.forEach((l, li) => {
    const rare = l.part.rare;
    if (!rare || !GLINT[rare]) return;
    let s = out.get(rare);
    if (!s) {
      const c = rarityRgb(rare), deep = deepened(c);
      s = { rare, c, deep, tone: tamed(mixRGB(deep, c, 0.5), SHINE_SAT), hue: saturated(c), x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, a: [0, 0], b: [0, 0], seed: 0, stars: [] };
      out.set(rare, s);
      spots.set(rare, []);
    }
    s.seed += l.part.seed ?? 0;
    const f = l.part.mesh.f;
    for (let fi = 0; fi < f.length; fi++) {
      if (!l.vis[fi] || f[fi].decal) continue;
      let cx = 0, cy = 0;
      for (const i of f[fi].i) {
        const [x, y] = l.s[i];
        cx += x / f[fi].i.length;
        cy += y / f[fi].i.length;
        if (x < s.x0) s.x0 = x;
        if (y < s.y0) s.y0 = y;
        if (x > s.x1) s.x1 = x;
        if (y > s.y1) s.y1 = y;
      }
      spots.get(rare)?.push([li, [cx, cy]]);
    }
  });
  for (const s of out.values()) {
    // The long way of it, from how its facets lie: the glint sweeps along that, so it crosses a shield seen edge on or a blade
    // slanting across the body from end to end, rather than passing over it in a moment somewhere in the middle of its sweep.
    const at = spots.get(s.rare) ?? [];
    let mx = 0, my = 0;
    for (const [, [x, y]] of at) { mx += x / at.length; my += y / at.length; }
    let xx = 0, xy = 0, yy = 0;
    for (const [, [x, y]] of at) { xx += (x - mx) ** 2; xy += (x - mx) * (y - my); yy += (y - my) ** 2; }
    const th = 0.5 * Math.atan2(2 * xy, xx - yy);
    // Down the screen and to the right, as a light from over the left shoulder crosses a thing.
    let ux = Math.cos(th), uy = Math.sin(th);
    if (ux + uy < 0) { ux = -ux; uy = -uy; }
    let lo = Infinity, hi = -Infinity;
    for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y0], [s.x0, s.y1], [s.x1, s.y1]]) {
      const d = (x - mx) * ux + (y - my) * uy;
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    const pad = (hi - lo) * 0.25 + 1e-6;
    s.a = [mx + ux * (lo - pad), my + uy * (lo - pad)];
    s.b = [mx + ux * (hi + pad), my + uy * (hi + pad)];
    // The fantastic one's stars, each opening on a spot of it and closing again, a new spot each time round.
    const look = GLINT[s.rare];
    for (let k = 0; look && k < look.stars && at.length; k++) {
      const cyc = (now + s.seed * 0.13) / look.period + k / look.stars;
      const u = ((cyc % 1) + 1) % 1;
      if (u > 0.4) continue;
      const n = Math.floor(cyc) * 7919 + k * 104729 + s.seed * 31;
      const [li, p] = at[((n % at.length) + at.length) % at.length];
      s.stars.push({ li, at: p, life: Math.sin((u / 0.4) * Math.PI), k });
    }
  }
  return out;
}

/**
 * The rest of the shine on one rare part, laid on as soon as the part is
 * drawn so that whatever is drawn in front of it afterwards covers it too: a
 * breath of its rarity's colour over a supreme or fantastic one, the glint as
 * it crosses, and the stars that are open on it.
 */
function shineOn(g: CanvasRenderingContext2D, l: Laid, li: number, s: Shine, now: number): void {
  const look = GLINT[s.rare];
  if (!look) return;
  const f = l.part.mesh.f;
  // Its facets as one shape -- they all face the viewer, so wound alike, and filled once where they overlap -- which every layer of the shine is painted through.
  const face = new Path2D();
  let any = false;
  for (let fi = 0; fi < f.length; fi++) {
    if (!l.vis[fi] || f[fi].decal) continue;
    const idx = f[fi].i;
    face.moveTo(l.s[idx[0]][0], l.s[idx[0]][1]);
    for (let q = 1; q < idx.length; q++) face.lineTo(l.s[idx[q]][0], l.s[idx[q]][1]);
    face.closePath();
    any = true;
  }
  if (!any) return;
  const w = s.x1 - s.x0, h = s.y1 - s.y0;
  const breath = 0.5 + 0.5 * Math.sin((now * TAU) / BREATH + s.seed);
  // The piece keeps its own colour -- steel stays steel, a dye its dye -- and the rarity's colour is only ever light on it.
  // Its breath: a trace of the colour's light coming and going over a supreme or fantastic piece.
  g.globalCompositeOperation = 'lighter';
  if (look.glow) {
    g.fillStyle = rgba(tamed(s.c, SHINE_SAT), look.glow * breath);
    g.fill(face);
  }
  // The glint: along the long way of it over most of the cycle, and gone the rest.
  const t = ((((now + s.seed * 0.13) / look.period) % 1) + 1) % 1;
  if (t < look.sweep) {
    const u = t / look.sweep;
    const at = 0.08 + u * 0.84, hw = look.band / 2;
    const band = (c: RGB, mid: RGB, edge: number, core: number): CanvasGradient => {
      const grad = g.createLinearGradient(s.a[0], s.a[1], s.b[0], s.b[1]);
      grad.addColorStop(Math.max(0, at - hw), rgba(c, 0));
      grad.addColorStop(Math.max(0, at - hw * 0.3), rgba(c, edge));
      grad.addColorStop(at, rgba(mid, core));
      grad.addColorStop(Math.min(1, at + hw * 0.3), rgba(c, edge));
      grad.addColorStop(Math.min(1, at + hw), rgba(c, 0));
      return grad;
    };
    // It turns what it crosses to its colour first, keeping how light or dark each facet is, so that it is the rarity's colour going
    // over steel or green scale and not white, or lime where yellow light lands on green; then light in that colour over it.
    g.globalCompositeOperation = 'color';
    g.fillStyle = band(s.hue, s.hue, look.core * look.dye * 0.6, look.core * look.dye);
    g.fill(face);
    g.globalCompositeOperation = 'lighter';
    const c = tamed(mixRGB(s.tone, [255, 252, 244], look.white * 0.6), SHINE_SAT);
    g.fillStyle = band(c, mixRGB([255, 252, 244], s.tone, 1 - look.white), look.core * 0.45, look.core * 0.85);
    g.fill(face);
  }
  g.globalCompositeOperation = 'source-over';
  for (const st of s.stars) {
    if (st.li !== li) continue;
    // Big enough to be a star at the size the island is played at, and not a stray pixel.
    const r = Math.max(2, Math.min(3, Math.max(w, h) * 0.07)) * (0.55 + st.life * 0.45);
    g.save();
    g.translate(st.at[0], st.at[1]);
    g.rotate(now * 0.9 + st.k);
    g.globalCompositeOperation = 'screen';
    g.fillStyle = rgba(tamed(s.deep, SHINE_SAT + 0.1), 0.85 * st.life);
    fourPoint(g, r, r * 0.22);
    g.fill();
    g.fillStyle = rgba([255, 250, 236], 0.95 * st.life);
    fourPoint(g, r * 0.62, r * 0.14);
    g.fill();
    g.restore();
  }
}

/** A four-pointed star, tapered, round the origin. */
function fourPoint(g: CanvasRenderingContext2D, r: number, waist: number): void {
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(waist, -waist, r, 0);
  g.quadraticCurveTo(waist, waist, 0, r);
  g.quadraticCurveTo(-waist, waist, -r, 0);
  g.quadraticCurveTo(-waist, -waist, 0, -r);
  g.closePath();
}

/** Two canvases the shine on a picture is worked on, kept between frames: the picture glazed, and the light laid over it. */
let shineWork: [HTMLCanvasElement, HTMLCanvasElement] | null = null;

/**
 * A picture of something rare laid on the screen shining as a rare thing worn
 * does (`shineOn`): glazed toward its rarity's hue, the glint crossing it the
 * long way, and a supreme or fantastic one's breath and a fantastic one's
 * stars -- the same light, the same colours and the same timing, laid through
 * the picture's own ink rather than through a part's facets. For what is drawn
 * as a picture and not as parts: a wildermon still drawn by hand.
 *
 * The picture is the top left `W` by `H` of `pic`, drawn at `x`, `y`, `w` by
 * `h` on the screen, as `drawImage` would; `seed` sets it apart from anything
 * else of its rarity, so two rare ones side by side do not glint in step.
 */
export function shineOver(ctx: CanvasRenderingContext2D, pic: HTMLCanvasElement, W: number, H: number, x: number, y: number, w: number, h: number, rare: number, seed: number, now: number): void {
  const look = GLINT[rare];
  const how = RARE_GLAZE[rare];
  if (!look || !how || W < 1 || H < 1) {
    ctx.drawImage(pic, 0, 0, W, H, x, y, w, h);
    return;
  }
  if (!shineWork) shineWork = [document.createElement('canvas'), document.createElement('canvas')];
  const [glazedC, lightC] = shineWork;
  for (const c of shineWork) if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H); }
  const gz = glazedC.getContext('2d') as CanvasRenderingContext2D;
  const lt = lightC.getContext('2d') as CanvasRenderingContext2D;
  const c = rarityRgb(rare), deep = deepened(c), tone = tamed(mixRGB(deep, c, 0.5), SHINE_SAT), hue = saturated(c);
  // Glazed toward its rarity's hue as far as a rare piece is in shadow, keeping how light or dark each part of it is: a picture
  // has no facets to tell its light from its shade by, and a blend takes all of the glaze's colour where a part's glaze takes a
  // share of it, so the glaze a part keeps for its darkest facets is what a picture takes all over.
  gz.setTransform(1, 0, 0, 1, 0, 0);
  gz.globalCompositeOperation = 'source-over';
  gz.clearRect(0, 0, W, H);
  gz.drawImage(pic, 0, 0, W, H, 0, 0, W, H);
  gz.globalCompositeOperation = 'color';
  gz.fillStyle = rgba(fromHsv(hsvOf(hue)[0], GLAZE_SAT[rare], 1), how[0]);
  gz.fillRect(0, 0, W, H);
  gz.globalCompositeOperation = 'destination-in';
  gz.drawImage(pic, 0, 0, W, H, 0, 0, W, H);
  // Its light: the breath, and the glint crossing it the long way, down the screen and to the right, and gone for the rest of the cycle.
  lt.setTransform(1, 0, 0, 1, 0, 0);
  lt.globalCompositeOperation = 'source-over';
  lt.clearRect(0, 0, W, H);
  const breath = 0.5 + 0.5 * Math.sin((now * TAU) / BREATH + seed);
  if (look.glow) {
    lt.fillStyle = rgba(tamed(c, SHINE_SAT), look.glow * breath);
    lt.fillRect(0, 0, W, H);
  }
  const t = ((((now + seed * 0.13) / look.period) % 1) + 1) % 1;
  if (t < look.sweep) {
    const u = t / look.sweep, at = 0.08 + u * 0.84, hw = look.band / 2;
    const grad = lt.createLinearGradient(-W * 0.25, -H * 0.1, W * 1.25, H * 0.35);
    const lit = tamed(mixRGB(tone, [255, 252, 244], look.white * 0.6), SHINE_SAT);
    const mid = mixRGB([255, 252, 244], tone, 1 - look.white);
    grad.addColorStop(Math.max(0, at - hw), rgba(lit, 0));
    grad.addColorStop(Math.max(0, at - hw * 0.3), rgba(lit, look.core * 0.45));
    grad.addColorStop(at, rgba(mid, look.core * 0.85));
    grad.addColorStop(Math.min(1, at + hw * 0.3), rgba(lit, look.core * 0.45));
    grad.addColorStop(Math.min(1, at + hw), rgba(lit, 0));
    lt.fillStyle = grad;
    lt.fillRect(0, 0, W, H);
  }
  lt.globalCompositeOperation = 'destination-in';
  lt.drawImage(pic, 0, 0, W, H, 0, 0, W, H);
  gz.globalCompositeOperation = 'lighter';
  gz.drawImage(lightC, 0, 0, W, H, 0, 0, W, H);
  gz.globalCompositeOperation = 'source-over';
  ctx.drawImage(glazedC, 0, 0, W, H, x, y, w, h);
  // A fantastic one's stars, each opening on a spot of it and closing again, somewhere new each time round: spots near the middle
  // of the picture, where a body is, rather than out at its edges where there may be nothing.
  for (let k = 0; k < look.stars; k++) {
    const cyc = (now + seed * 0.13) / look.period + k / look.stars;
    const v = ((cyc % 1) + 1) % 1;
    if (v > 0.4) continue;
    const n = Math.floor(cyc) * 7919 + k * 104729 + Math.round(seed * 31);
    const fx = 0.25 + 0.5 * (((n * 0.6180339887) % 1 + 1) % 1), fy = 0.3 + 0.45 * (((n * 0.7548776662) % 1 + 1) % 1);
    const life = Math.sin((v / 0.4) * Math.PI);
    const r = Math.max(2, Math.min(4, Math.max(w, h) * 0.06)) * (0.55 + life * 0.45);
    ctx.save();
    ctx.translate(x + fx * w, y + fy * h);
    ctx.rotate(now * 0.9 + k);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(tamed(deep, SHINE_SAT + 0.1), 0.85 * life);
    fourPoint(ctx, r, r * 0.22);
    ctx.fill();
    ctx.fillStyle = rgba([255, 250, 236], 0.95 * life);
    fourPoint(ctx, r * 0.62, r * 0.14);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Put the parts on the screen. Each is sorted into place by how near its
 * middle is along the ground -- which is what puts the near arm in front of
 * the body and the far one behind it -- and its facets among themselves by
 * how near each is. The outside of the whole is inked first, fattened, so
 * only its rim shows; then each part in turn, and a line along every edge
 * of it that turns away from the viewer, which is what draws an arm over a
 * chest.
 */
/** Which facets meet at each corner of a mesh, worked out once for it. */
const cornersOf = new WeakMap<object, number[][]>();
function facetsAt(mesh: Mesh): number[][] {
  let at = cornersOf.get(mesh.f);
  if (!at) {
    at = mesh.v.map(() => [] as number[]);
    mesh.f.forEach((face, fi) => { for (const vi of face.i) at![vi].push(fi); });
    cornersOf.set(mesh.f, at);
  }
  return at;
}

/** The part of a polygon on one side of a level of what is known at its corners, with that at its new corners. */
function clipAt(pts: readonly Pt[], val: readonly number[], level: number, above: boolean): [Pt[], number[]] {
  const op: Pt[] = [], ov: number[] = [];
  const n = pts.length;
  for (let q = 0; q < n; q++) {
    const a = pts[q], b = pts[(q + 1) % n], va = val[q], vb = val[(q + 1) % n];
    const ina = above ? va >= level : va < level, inb = above ? vb >= level : vb < level;
    if (ina) { op.push(a); ov.push(va); }
    if (ina !== inb) {
      const r = (level - va) / (vb - va);
      op.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
      ov.push(level);
    }
  }
  return [op, ov];
}

/**
 * Where the light's steps cross a `toon` part: the light worked out at each
 * corner of each facet from the facets round it that turn the same way (not
 * across a crease), so a step runs as one smooth line over a round mass
 * rather than along the edges of its facets. A facet the line crosses is cut
 * along it, each piece in its own step; a facet it does not cross takes the
 * step of its corners.
 */
function toonSplit(mesh: Mesh, s: readonly Pt[], vis: readonly boolean[], k: number[], normals: readonly V3[], areas: readonly number[], L: V3, toward?: readonly number[]): Map<number, Array<[number, Pt[]]>> | undefined {
  const at = facetsAt(mesh);
  let out: Map<number, Array<[number, Pt[]]>> | undefined;
  const val: number[] = [];
  mesh.f.forEach((face, fi) => {
    if (!vis[fi] || face.decal) return;
    const u = normals[fi];
    // Along the top of the outline, where the surface turns away: the sheen, whole.
    if (toward && toward[fi] < 0.32 && u[2] > 0.3) { k[fi] = TOON_SHEEN; return; }
    val.length = 0;
    let lo = Infinity, hi = -Infinity;
    for (const vi of face.i) {
      let x = 0, y = 0, z = 0;
      for (const gi of at[vi]) {
        const w = normals[gi];
        if (w[0] * u[0] + w[1] * u[1] + w[2] * u[2] < 0.5) continue;
        x += w[0] * areas[gi]; y += w[1] * areas[gi]; z += w[2] * areas[gi];
      }
      const l = Math.sqrt(x * x + y * y + z * z);
      const d = l > 1e-9 ? toonD([x / l, y / l, z / l], L) : toonD(u, L);
      val.push(d);
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    const a = toonStep(lo), b = toonStep(hi);
    if (a === b) { k[fi] = a; return; }
    const pts = face.i.map((vi) => s[vi]);
    const pieces: Array<[number, Pt[]]> = [];
    const [top] = clipAt(pts, val, TOON_CUTS[1], true);
    const [rest, restV] = clipAt(pts, val, TOON_CUTS[1], false);
    const [mid] = clipAt(rest, restV, TOON_CUTS[0], true);
    const [low] = clipAt(rest, restV, TOON_CUTS[0], false);
    if (low.length > 2) pieces.push([TOON_SHADE, low]);
    if (mid.length > 2) pieces.push([TOON_MID, mid]);
    if (top.length > 2) pieces.push([TOON_LIT, top]);
    (out ??= new Map()).set(fi, pieces);
  });
  return out;
}

/** Which piece each facet of a mesh is in, pieces being facets joined by their corners, worked out once for it. */
const piecesOf = new WeakMap<object, Int32Array>();
function pieceOf(mesh: Mesh): Int32Array {
  let id = piecesOf.get(mesh.f);
  if (!id) {
    const up = mesh.v.map((_, q) => q);
    const root = (q: number): number => { while (up[q] !== q) q = up[q] = up[up[q]]; return q; };
    for (const face of mesh.f) for (let q = 1; q < face.i.length; q++) up[root(face.i[q])] = root(face.i[0]);
    id = Int32Array.from(mesh.f, (face) => root(face.i[0]));
    piecesOf.set(mesh.f, id);
  }
  return id;
}

/** A `toon` part lit a piece at a time (`Part.even`): each piece in the one step its seen facets face, on the whole. */
function evenSteps(mesh: Mesh, vis: readonly boolean[], k: number[], normals: readonly V3[], areas: readonly number[], L: V3): undefined {
  const id = pieceOf(mesh), sum = new Map<number, V3>();
  mesh.f.forEach((face, fi) => {
    if (!vis[fi] || face.decal) return;
    const u = normals[fi], a = areas[fi], m = sum.get(id[fi]);
    if (m) { m[0] += u[0] * a; m[1] += u[1] * a; m[2] += u[2] * a; } else sum.set(id[fi], [u[0] * a, u[1] * a, u[2] * a]);
  });
  const step = new Map<number, number>();
  for (const [p, m] of sum) {
    const l = Math.hypot(m[0], m[1], m[2]) || 1;
    step.set(p, toonStep(toonD([m[0] / l, m[1] / l, m[2] / l], L)));
  }
  mesh.f.forEach((face, fi) => { if (vis[fi] && !face.decal) k[fi] = step.get(id[fi]) ?? k[fi]; });
  return undefined;
}

/** Room for the outward squares of a facet's edges, kept between facets rather than made for each. */
let EDGE_X = new Float64Array(32), EDGE_Y = new Float64Array(32);
/** Room for a part's corners placed on its bone, three numbers each, kept between parts rather than made for each corner. */
let PLACED = new Float64Array(3 * 256);

export function render(g: CanvasRenderingContext2D, parts: Part[], pal: Palette, view: View, ink: number, px: number, now = 0): void {
  const { ex, ey, T, L, H } = view;
  const normals: V3[] = [], areas: number[] = [];
  // How far a step across the body goes on the screen, on the whole: what a pattern's rings are counted off.
  const hs = (Math.hypot(ex[0], ex[1]) + Math.hypot(ey[0], ey[1])) / 2;
  const laid: Laid[] = parts.map((part) => {
    const src = part.v ?? part.mesh.v, nv = src.length;
    if (PLACED.length < nv * 3) PLACED = new Float64Array(nv * 6);
    const pv = PLACED, xm = part.xf.m, xt = part.xf.t;
    const s: Pt[] = [];
    for (let q = 0; q < nv; q++) {
      const v = src[q];
      const x = xm[0] * v[0] + xm[1] * v[1] + xm[2] * v[2] + xt[0];
      const y = xm[3] * v[0] + xm[4] * v[1] + xm[5] * v[2] + xt[1];
      const z = xm[6] * v[0] + xm[7] * v[1] + xm[8] * v[2] + xt[2];
      pv[q * 3] = x; pv[q * 3 + 1] = y; pv[q * 3 + 2] = z;
      s.push([x * ex[0] + y * ey[0], x * ex[1] + y * ey[1] - z * HEIGHT_SCALE]);
    }
    const vis: boolean[] = [], k: number[] = [], d: number[] = [], t: number[] = [];
    const tests = (part.hide ?? []).map((solid) => behind(solid.in ?? part.hideIn ?? part.xf, solid, T));
    const hidden = tests.length ? (p: V3): boolean => tests.some((t) => t(p)) : undefined;
    for (const face of part.mesh.f) {
      // Its normal the long way round (Newell's), and its middle, straight off the corners.
      const idx = face.i, m = idx.length;
      let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
      for (let q = 0; q < m; q++) {
        const a = idx[q] * 3, b = idx[(q + 1) % m] * 3;
        nx += (pv[a + 1] - pv[b + 1]) * (pv[a + 2] + pv[b + 2]);
        ny += (pv[a + 2] - pv[b + 2]) * (pv[a] + pv[b]);
        nz += (pv[a] - pv[b]) * (pv[a + 1] + pv[b + 1]);
        cx += pv[a]; cy += pv[a + 1]; cz += pv[a + 2];
      }
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const u: V3 = l > 1e-9 ? [nx / l, ny / l, nz / l] : [0, 0, 0];
      const mx = cx / m, my = cy / m, mz = cz / m;
      const off = face.unless && mv(part.xf.m, face.unless);
      const toward = u[0] * T[0] + u[1] * T[1] + u[2] * T[2];
      vis.push(l > 1e-9 && toward > 1e-4 && !(hidden && hidden(face.at ? place(part.xf, face.at) : [mx, my, mz])) && !(off && off[0] * T[0] + off[1] * T[1] + off[2] * T[2] > 0.05));
      t.push(toward);
      k.push(part.toon ? toonK(u, L) : face.crease ? lightOn(creased(u), L) : lightOn(u, L));
      d.push(mx * T[0] + my * T[1] + mz * T[2]);
      if (part.toon) { normals.push(u); areas.push(l); }
    }
    if (part.flat) {
      let lo = Infinity;
      for (let q = 0; q < k.length; q++) if (vis[q]) lo = Math.min(lo, k[q]);
      if (lo < Infinity) k.fill(lo);
    }
    let cx = 0, cy = 0, cz = 0;
    for (let q = 0; q < nv * 3; q += 3) { cx += pv[q]; cy += pv[q + 1]; cz += pv[q + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    const split = part.toon && part.even ? evenSteps(part.mesh, vis, k, normals, areas, L) : part.toon ? toonSplit(part.mesh, s, vis, k, normals, areas, L, part.sheen ? t : undefined) : undefined;
    normals.length = 0;
    areas.length = 0;
    const across = part.toon ? acrossOf(part.mesh) / px : Infinity;
    return { part, s, vis, k, split, d, t, key: cx * H[0] + cy * H[1] + cz * 0.02 + part.bias, fine: across < TOON_FLECK_PX ? 2 : across < TOON_THIN_PX ? 1 : 0 };
  });
  // Each part goes after (or before) what it follows once that has itself been put in its place, whichever was made first: a
  // hand made with the body follows a grip made after it, and from behind the grip goes under the chest and the hand with it.
  const at = new Map<Part, Laid>();
  for (const l of laid) at.set(l.part, l);
  const settled = new Set<Laid>();
  const settle = (l: Laid): void => {
    if (settled.has(l)) return;
    settled.add(l);
    const leads = l.part.after ? (Array.isArray(l.part.after) ? l.part.after : [l.part.after]) : [];
    const keys: number[] = [];
    for (const p of leads) {
      const m = at.get(p);
      if (!m) continue;
      settle(m);
      keys.push(m.key);
    }
    if (!keys.length) return;
    const fw = l.part.front && mv(l.part.xf.m, l.part.front);
    if (!fw || fw[0] * T[0] + fw[1] * T[1] + fw[2] * T[2] > -1 / 3) l.key = Math.max(...keys) + l.part.bias;
    else l.key = Math.min(l.key, Math.min(...keys) - l.part.bias);
  };
  for (const l of laid) settle(l);
  for (const l of laid) {
    const tops = l.part.under ? (Array.isArray(l.part.under) ? l.part.under : [l.part.under]) : [];
    for (const p of tops) {
      const top = at.get(p);
      if (top) l.key = Math.min(l.key, top.key - 0.001);
    }
  }
  laid.sort((a, b) => a.key - b.key);
  /*
   * Drawn in batches of one colour, because a canvas pays by the call and
   * not by the corner: the ink round each part is one stroke per colour of
   * ink along its outline, a part whose facets cannot overlap is one fill
   * per shade, and the rest go down far to near, a run of one shade at a
   * time, each run followed by the lines along its own edges so that what
   * is nearer covers them too. Nothing is stroked facet by facet: each
   * facet is grown outward by half a pixel instead, every edge pushed out
   * square to itself, which closes the seams between neighbours that
   * anti-aliasing leaves.
   */
  // Worked out for the colours that are drawn, as they are drawn, rather than every colour the palette has.
  const inks: Partial<Record<Mat, string>> = {};
  // A piece of gear is in colours of its own, and inked in a dark shade of each of them.
  // A rare piece in its colours glazed toward its rarity's hue, and inked in a dark of them: its rim is its rarity's colour.
  // A rare piece is glazed over its own colours, or over the body's for a part that has none of its own: a rare wildermon's.
  const palOf = (l: Laid): Palette => (l.part.rare ? rarePalette(l.part.pal ?? pal, l.part.rare) : l.part.pal ?? pal);
  const partInks = new Map<Palette, Partial<Record<Mat, string>>>();
  const airyInks: Partial<Record<Mat, string>> = {};
  const inkIn = (l: Laid, m: Mat): string => {
    if (l.part.airy) return (airyInks[m] ??= shade(mixRGB((l.part.pal ?? pal)[m], INK, 0.3), 1));
    if (!l.part.pal) return (inks[m] ??= shade(inkOf(pal[m]), 1));
    const P = palOf(l);
    let c = partInks.get(P);
    if (!c) { c = {}; partInks.set(P, c); }
    // A rare piece's ink half a dark of its rarity's own hue, so the line round it is the one place its colour is at full strength.
    const glaze = GLAZES.get(P);
    return (c[m] ??= shade(glaze ? mixRGB(gearInk(P[m]), fromHsv(glaze.hue, 0.7, 0.36), 0.55) : gearInk(P[m]), 1));
  };
  const grow = 0.5 * px;
  const add = (path: Path2D, l: Laid, fi: number, fat = grow): void => {
    const idx = l.part.mesh.f[fi].i;
    addPts(path, idx.length, (q) => l.s[idx[q]], fat);
  };
  const addPts = (path: Path2D, n: number, pt: (q: number) => Pt, fat = grow): void => {
    if (!fat) {
      const p0 = pt(0);
      path.moveTo(p0[0], p0[1]);
      for (let q = 1; q < n; q++) { const p = pt(q); path.lineTo(p[0], p[1]); }
      path.closePath();
      return;
    }
    // Which way round it goes on the screen, so "out" is out.
    let area = 0;
    for (let q = 0; q < n; q++) {
      const a = pt(q), b = pt((q + 1) % n);
      area += a[0] * b[1] - b[0] * a[1];
    }
    const turn = area < 0 ? -1 : 1;
    // Each edge's outward square, once: edge q runs from corner q to the next.
    if (EDGE_X.length < n) { EDGE_X = new Float64Array(2 * n); EDGE_Y = new Float64Array(2 * n); }
    for (let q = 0; q < n; q++) {
      const a = pt(q), b = pt((q + 1) % n);
      const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.sqrt(dx * dx + dy * dy);
      if (dl > 1e-9) { EDGE_X[q] = (dy / dl) * turn; EDGE_Y[q] = (-dx / dl) * turn; } else { EDGE_X[q] = 0; EDGE_Y[q] = 0; }
    }
    for (let q = 0; q < n; q++) {
      const e = (q + n - 1) % n;
      let ax = EDGE_X[e], ay = EDGE_Y[e], bx = EDGE_X[q], by = EDGE_Y[q];
      if (!ax && !ay) { ax = bx; ay = by; }
      if (!bx && !by) { bx = ax; by = ay; }
      // The mitre: both neighbouring edges pushed out by `fat`, where they meet; never more than three times as far.
      const k = Math.min(3, 1 / Math.max(1e-3, 1 + ax * bx + ay * by)) * fat;
      const v = pt(q);
      const x = v[0] + (ax + bx) * k, y = v[1] + (ay + by) * k;
      if (q === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
  };
  // Something only a pixel or two across -- a flower, a leaf, a bead -- is lit and in its own colour, never in the cool shade: a
  // step of lavender on it is a smudge.
  const accent = (l: Laid, k: number): number => (l.fine && k < TOON_MID ? TOON_MID : k);
  /** A facet of a `toon` part the light's steps cut across, each piece into the path of its own shade. */
  const addSplit = (l: Laid, P: Palette, fi: number, pieces: Array<[number, Pt[]]>): void => {
    const c = P[l.part.mesh.f[fi].m];
    for (const [k, pts] of pieces) addPts(into(toonTone(c, accent(l, k))), pts.length, (q) => pts[q]);
  };
  // Where a facet that is seen meets one that is not, or nothing: the lines round a part, and along it where it turns away.
  // Each is [from, to, the facet seen, whether it is the open edge of the mesh rather than a fold where it turns away].
  const edgesOf = (l: Laid): Array<[number, number, number, boolean]> => {
    const f = l.part.mesh.f;
    const out: Array<[number, number, number, boolean]> = [];
    for (const [a, b, f1, f2] of l.part.mesh.e) {
      const v1 = l.vis[f1], v2 = f2 >= 0 ? l.vis[f2] : false;
      if (v1 === v2 || (f2 < 0 && f[f1].soft)) continue;
      // A shave or a shadow of beard is colour on the skin, not a thing on it, and is not inked; nor is a seam.
      const seen = f[v1 ? f1 : f2];
      if (seen.m === 'stubble' || seen.m === 'shaved' || seen.seam || (seen.fine && seen.fine * Math.SQRT2 * SX < Math.max(2 * ink, 4 * px))) continue;
      out.push([a, b, v1 ? f1 : f2, f2 < 0]);
    }
    return out;
  };
  const batch = new Map<string, Path2D>();
  const into = (c: string): Path2D => {
    let path = batch.get(c);
    if (!path) { path = new Path2D(); batch.set(c, path); }
    return path;
  };
  const flush = (width: number, fill: boolean): void => {
    g.lineWidth = width;
    for (const [c, path] of batch) {
      g.fillStyle = c;
      g.strokeStyle = c;
      if (fill) g.fill(path);
      if (width > 0) g.stroke(path);
    }
    batch.clear();
  };
  const line = (l: Laid, a: number, b: number, fi: number): void => {
    const to = into(inkIn(l, l.part.mesh.f[fi].m));
    to.moveTo(l.s[a][0], l.s[a][1]);
    to.lineTo(l.s[b][0], l.s[b][1]);
  };
  // The outline round the whole in the dark ink gear is drawn in, the body's own parts as well: in the body's lighter inks a bare
  // sleeve beside a coat of mail has half the line round it the mail has, and goes soft at the edge of the figure.
  const outlines: Partial<Record<Mat, string>> = {};
  const toonOutlines: Partial<Record<Mat, string>> = {};
  const thinOutlines: Partial<Record<Mat, string>> = {};
  const rimLine = (l: Laid, a: number, b: number, fi: number): void => {
    const m = l.part.mesh.f[fi].m;
    const to = into(l.part.pal || l.part.airy ? inkIn(l, m)
      : l.part.toon ? (l.fine ? (thinOutlines[m] ??= shade(toonThinInk(pal[m]), 1)) : (toonOutlines[m] ??= shade(toonInk(gearInk(pal[m])), 1)))
        : (outlines[m] ??= shade(gearInk(pal[m]), 1)));
    to.moveTo(l.s[a][0], l.s[a][1]);
    to.lineTo(l.s[b][0], l.s[b][1]);
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const edges = laid.map(edgesOf);
  // The outline: every part's own outline in its ink, fattened, so that only a rim shows round the outside once the facets go over it.
  laid.forEach((l, li) => { if (l.part.rim !== false && !l.part.thin && !l.fine) for (const [a, b, fi] of edges[li]) rimLine(l, a, b, fi); });
  flush(ink * 2, false);
  laid.forEach((l, li) => { if (l.part.rim !== false && (l.part.thin || l.fine === 1)) for (const [a, b, fi] of edges[li]) rimLine(l, a, b, fi); });
  flush(ink, false);
  const shines = laid.some((l) => l.part.rare) ? shinesOf(laid, now) : null;
  laid.forEach((l, li) => {
    const f = l.part.mesh.f;
    const shown: number[] = [];
    for (let fi = 0; fi < f.length; fi++) if (l.vis[fi] && !f[fi].decal) shown.push(fi);
    const P = palOf(l);
    const sh = shines && l.part.rare ? shines.get(l.part.rare) : undefined;
    const tone = (fi: number, k = l.k[fi]): string => (l.part.toon ? (k === TOON_SHEEN && l.part.sheen ? toonTone(P[l.part.sheen], TOON_LIT) : toonTone(P[f[fi].m], accent(l, k))) : toneOf(P, f[fi].m, k, P !== pal));
    // The links of a chain: the lines of this link and every one straight after it go down now, fattened, before any of them does.
    const chain = l.part.chain;
    if (chain !== undefined && (li === 0 || laid[li - 1].part.chain !== chain)) {
      for (let r = li; r < laid.length && laid[r].part.chain === chain; r++) {
        const m = laid[r];
        if (m.part.lines !== false && m.part.rim !== false && !m.fine) for (const [a, b, fi] of edges[r]) line(m, a, b, fi);
      }
      flush(ink * 1.2, false);
    }
    const lined = l.part.lines !== false && l.part.rim !== false && !l.fine && chain === undefined;
    if (l.part.convex) {
      for (const fi of shown) {
        const pieces = l.split?.get(fi);
        if (pieces) addSplit(l, P, fi, pieces);
        else add(into(tone(fi)), l, fi);
      }
      flush(0, true);
      worked(g, l, shown, P, px, hs);
      if (lined) for (const [a, b, fi] of edges[li]) line(l, a, b, fi);
      flush(ink * 0.6, false);
    } else {
      // Far to near, a run of one shade at a time, and after each run the lines along its edges.
      const mine = new Map<number, Array<[number, number, boolean]>>();
      for (const [a, b, fi, open] of edges[li]) {
        const list = mine.get(fi);
        if (list) list.push([a, b, open]);
        else mine.set(fi, [[a, b, open]]);
      }
      shown.sort((a, b) => l.d[a] - l.d[b]);
      let q = 0;
      while (q < shown.length) {
        // A facet the light's steps cut across goes down on its own, in its pieces, and its lines after it.
        const pieces = l.split?.get(shown[q]);
        if (pieces) {
          addSplit(l, P, shown[q], pieces);
          flush(0, true);
          if (lined) for (const [a, b] of mine.get(shown[q]) ?? []) line(l, a, b, shown[q]);
          flush(ink * 0.6, false);
          q++;
          continue;
        }
        const c = tone(shown[q]);
        let end = q;
        while (end < shown.length && !l.split?.has(shown[end]) && tone(shown[end]) === c) end++;
        for (let r = q; r < end; r++) add(into(c), l, shown[r]);
        flush(0, true);
        worked(g, l, shown.slice(q, end), P, px, hs);
        if (lined) for (let r = q; r < end; r++) for (const [a, b] of mine.get(shown[r]) ?? []) line(l, a, b, shown[r]);
        flush(ink * 0.6, false);
        q = end;
      }
    }
    // What is painted on: in the order it was laid on, so a glint goes on over its eye.
    for (let fi = 0; fi < f.length; fi++) {
      if (!l.vis[fi] || !f[fi].decal) continue;
      const path = new Path2D();
      add(path, l, fi, 0);
      // Painted on a wildermon, flat: an eye is the same dark whichever way the head is turned, and a glint is always lit.
      g.fillStyle = l.part.toon ? toonTone(P[f[fi].m], f[fi].lit ? TOON_LIT : TOON_MID) : toneOf(P, f[fi].m, f[fi].lit ? Math.max(l.k[fi], 1.06) : l.k[fi], P !== pal);
      g.fill(path);
    }
    // And if it is rare, the rest of its shine, before anything in front of it goes down.
    if (sh) shineOn(g, l, li, sh, now);
  });
}

export const onScreen = (view: View, p: V3): Pt => [p[0] * view.ex[0] + p[1] * view.ey[0], p[0] * view.ex[1] + p[1] * view.ey[1] - p[2] * HEIGHT_SCALE];

/**
 * For the sculpted bodies (`../sculpt`): the pose a body is in as its rig --
 * the same joint angles every poser here puts a body into, walking, working,
 * swimming, waving -- and the rig at rest, which is what a sculpt is modelled
 * in. The sculpt builds its own skeleton from these at its own proportions, so
 * every animation carries over to a body of any build.
 */
export function sculptRig(pose: FigurePose): { rig: Rig; rest: Rig } {
  return { rig: rigOf(pose, frameOf(pose.look ?? DEFAULT_LOOK)), rest: rest() };
}

/**
 * The sculpted bodies (`src/sculpt/sculpted.ts`), the only way a person is drawn: loaded as a chunk of their own the
 * first time a body is drawn or they are asked for (the renderer, every frame; the character creator), and drawn
 * wherever a body is drawn (`drawLive`). Until the chunk has loaded nothing is drawn, and with no WebGL2 (`glContext`)
 * nothing ever is: the game does not start there (`canDrawBodies`). Sat driving, the sculpted body is drawn among what it
 * holds and sits in: its reins, oars and tiller drawn round it, and what of it is down behind the near side of the box or
 * the hull hidden (`drawLive`). In the water, it is drawn in two, cut at the surface: what is under it faint and what is
 * over it among the rings on the water (`drawLive`).
 */
const SCULPT: { island: boolean; loading: boolean; draw: ((ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, water?: 'over' | 'under') => boolean) | null; gen: () => number; soft: boolean; fx: SculptFx | null } =
  { island: false, loading: false, draw: null, gen: () => 0, soft: false, fx: null };
/** The sculpted bodies' chunk, asked for once (and again if it failed to load). */
function loadSculpted(): void {
  if (SCULPT.draw || SCULPT.loading) return;
  SCULPT.loading = true;
  import('../sculpt/sculpted').then((m) => { SCULPT.draw = m.drawSculptLive; SCULPT.gen = m.sculptGen; SCULPT.soft = m.glSoftware(); SCULPT.fx = m.SCULPT_FX; }).catch(() => { SCULPT.loading = false; });
}
/**
 * The sculpted bodies asked for ahead of the first body drawn: by the island's renderer once a frame (`by` 'island'),
 * which is when its sculpted redraws are counted afresh (`sculptMay`), or by the character creator.
 */
export function sculptedFigures(by?: 'island'): void {
  if (by === 'island') {
    SCULPT.island = true;
    sculptLeft.left = SCULPT.soft ? SCULPT_REDRAWS_SOFT : SCULPT_REDRAWS;
  }
  loadSculpted();
}
/**
 * Whether this browser can draw a body at all: WebGL2 with float colour buffers, what the sculpted bodies are drawn with
 * (`glContext` in `../sculpt/gl.ts`). Asked once, on a context made for the asking and let go.
 */
export function canDrawBodies(): boolean {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return false;
  const can = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return can;
}
/** What the page says where it cannot (`canDrawBodies`): the boot card, and the character creator's mirror. */
export const NO_WEBGL = "Can't draw players: no WebGL2";
/**
 * Sculpted bodies the island draws again a frame, at most: each is a WebGL draw put down on a 2D canvas, which waits on
 * the GL (about 9 ms a body on a processor-drawn GL, `glSoftware`). Past it a body is put down from the picture it last
 * had, and drawn again in a later frame. Your own body and a body never drawn yet are drawn whatever is left.
 */
export const SCULPT_REDRAWS = 4, SCULPT_REDRAWS_SOFT = 1;
const sculptLeft = { left: SCULPT_REDRAWS };
/** Whether a sculpted redraw of body `id` may be made now (and counts it), or the last picture must stand. */
const sculptMay = (id?: string): boolean => {
  if (!SCULPT.draw || !SCULPT.island || id === 'player') return true;
  if (sculptLeft.left <= 0) return false;
  sculptLeft.left--;
  return true;
};
/** Whether the sculpted bodies have loaded, so a body drawn now is drawn at all. */
export const sculptedReady = (): boolean => !!SCULPT.draw;
/** The effect marks on the clips, followed per body (`../sculpt/fxmarks.ts`), once the sculpted bodies have loaded; and whether their GL is the processor's (`glSoftware`). */
export const sculptFx = (): SculptFx | null => SCULPT.fx;
export const sculptSoft = (): boolean => SCULPT.soft;
/** What of the sculpted bodies a kept picture depends on: which bakes have landed. */
const sculptKey = (): string => `s${SCULPT.gen()}`;
/** The sculpted body with its feet at (sx, sy); false where it cannot be drawn (no WebGL2). */
const drawSculpted = (ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, water?: 'over' | 'under'): boolean =>
  !!SCULPT.draw && SCULPT.draw(ctx, sx, sy, zoom, pose, water);

/**
 * A body's still pose with animations off (`animationsOff`): one pose for each broad state, at nought on its clock --
 * standing, sat on what it is sat on, in the water treading it, and lain asleep, sat meditating or knelt at prayer
 * (`STILL_JOBS`) -- and nothing played over it (no stride, work, fight, emote, cast, block or flinch). Moving, it is
 * glided. Any other job is stood.
 */
export function stillPose(p: FigurePose): FigurePose {
  const rest = p.working && !p.moving && !p.swimming && !p.driving && STILL_JOBS.has(p.job ?? '');
  return {
    ...p, phase: 0, moving: false, gait: 0, working: rest, job: rest ? p.job : undefined, emote: undefined, emoteT: undefined,
    act: undefined, cast: undefined, block: undefined, flinch: undefined, tool: undefined,
  };
}
/** The jobs held as they are with animations off, for a body lain, sat or knelt at them: asleep, meditating, at prayer. */
const STILL_JOBS = new Set(['sleep', MEDITATE, 'pray', 'pray_statue']);

/**
 * Pictures of bodies drawn afresh (`drawLive` into a kept picture, or straight onto the screen), counted since the page
 * opened: what a frame costs in bodies, for the measures (`supabase/test/animoff.ts`).
 */
export const figureStats = { redraws: 0 };

/**
 * A body with its feet at (sx, sy): the player, and everybody else on the island, drawn sculpted (`drawLive`), and
 * nothing at all until the sculpted bodies have loaded. Given `ink` (a figure drawn big: the creator's mirror, a
 * window's), it is drawn afresh rather than put down from a picture kept of it (`drawStill`), and what it holds and sits
 * in (reins, oars, a tiller) is outlined that wide in screen pixels.
 */
export function drawFigure(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, opts: { ink?: number } = {}): void {
  loadSculpted();
  if (!SCULPT.draw) return;
  const veil = pose.veil;
  if (veil && (veil.tint > 0.004 || veil.fade > 0.004)) {
    drawVeiled(ctx, sx, sy, zoom, veil, pose.id, (g) => drawFigure(g, 0, 0, zoom, { ...pose, veil: undefined }, opts));
    return;
  }
  // Animations off: the still pose, turned and changed in one frame rather than blended (`settle`).
  const still = animationsOff();
  if (still) pose = stillPose(pose);
  const fr = frameOf(pose.look ?? DEFAULT_LOOK);
  const now = performance.now() / 1000;
  const settled = pose.id && !still
    ? settle(pose.id, pose, (f, left, kept) => rigOf({ ...pose, facing: f }, fr, left, kept), now)
    : { rig: rigOf(pose, fr), facing: (((pose.seat ? pose.facing : Math.round(pose.facing)) % 8) + 8) % 8, changing: false };
  const { rig: r, facing } = settled;
  // A cast moves every frame it lasts, so it is drawn every frame, as a blend or a turn is, and never from a stride's pictures.
  const changing = settled.changing || !!pose.cast;
  // Most of a pixel however far out, and never more than three and a half however far in.
  const ink = opts.ink !== undefined ? opts.ink / zoom : Math.max(0.9 / zoom, 0.7);
  if (pose.id && opts.ink === undefined) {
    drawStill(ctx, sx, sy, zoom, pose, fr, r, facing, changing, ink, now, still);
    return;
  }
  figureStats.redraws++;
  drawLive(ctx, sx, sy, zoom, pose, fr, r, facing, ink, now);
}

/* ---- what a driver holds, and the water round a swimmer ------------------------ */

/** The reins: a dark line under a leather one, as the team's are drawn from their heads (`drawReins` in `./renderer`). */
const REIN_UNDER = 'rgba(46, 30, 22, 0.85)';
const REIN_OVER = 'rgb(112, 74, 46)';

/**
 * The reins, from each fist out to where they go (`Seat.grip`), a hand
 * apart there, where the team's take them on: the two are one line. They
 * hang between in a curve that sags as they are let slack and draws nearly
 * straight as they are taken up.
 *
 * They were drawn after the body from every side, so with the team away
 * from the viewer they ran over the driver's head and back; and a line and
 * a half wide, as thick as the forearm, so they read as two wooden bows. Now
 * each is drawn before the body or after it by whether it is further off than
 * the chest or nearer (`behind`), and is a strap's width, a third of a unit,
 * never under the most of a pixel a line needs to be seen.
 */
function reins(g: CanvasRenderingContext2D, b: Bones, view: View, r: Rig, px: number, behind: boolean): void {
  const to = (r.seat ?? BOX).grip, slack = r.slack ?? 0.5;
  const T = view.T, chest = dot(b.chest.t, T);
  g.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    const h = place(b[`wrist${k}`], [0, 0, GRIP]);
    const e: V3 = [to[0] + s * 0.45, to[1], to[2]];
    const span = Math.hypot(e[0] - h[0], e[1] - h[1], e[2] - h[2]);
    const mid: V3 = [(h[0] + e[0]) / 2, (h[1] + e[1]) / 2, (h[2] + e[2]) / 2 - span * (0.015 + 0.075 * slack)];
    // Which side of the body this one is on, by the first stretch of it out of the fist, which is what passes the body.
    const near: V3 = [h[0] + (mid[0] - h[0]) * 0.4, h[1] + (mid[1] - h[1]) * 0.4, h[2] + (mid[2] - h[2]) * 0.4];
    if ((dot(near, T) < chest) !== behind) continue;
    const a = onScreen(view, h), m = onScreen(view, mid), z = onScreen(view, e);
    for (const [ink, w] of [[REIN_UNDER, Math.max(0.5, 1.5 * px)], [REIN_OVER, Math.max(0.3, 0.8 * px)]] as Array<[string, number]>) {
      g.strokeStyle = ink;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      // Through the sagging middle: the control point that puts the curve's midpoint there.
      g.quadraticCurveTo(2 * m[0] - (a[0] + z[0]) / 2, 2 * m[1] - (a[1] + z[1]) / 2, z[0], z[1]);
      g.stroke();
    }
  }
  g.lineCap = 'butt';
}

/**
 * A tiller, from its pivot on the rudder's head to its end in the fist, of
 * the boat's wood, drawn over the body wherever no part of the body is in
 * front of it. Drawn whole under the body or whole over it, by which side of
 * the chest its swung middle was, it went from behind the torso to across
 * the forearm and back half a dozen times in ten seconds as it swung; drawn
 * under, its end was behind the body with the fist holding nothing, and
 * drawn over, it lay across the forearm and the belly. It passes beside the
 * hip, under the forearm and into the fist, so neither was right. Now it is
 * cut in lengths, and a length is left out wherever a part of the body --
 * the hips, a thigh, the arm, the fist round its end -- is between it and
 * the viewer, each part taken as the egg that fills its own box. So it goes
 * behind the body and comes out of the fist from every side, and swinging
 * cannot make it jump. Its section is wider than it is deep, as a tiller is
 * cut, which on the screen is about as wide as it is tall.
 *
 * Each egg is a little fatter than the part, and the lengths are a fist long,
 * so where it went behind the hip it stopped short of it, its cut end square
 * in the air by the thigh. So it is drawn whole under the body first as well:
 * what of it is behind the body shows up to the body's own outline, and out
 * through any gap in it, and the lengths over the body are drawn after it.
 */
const TILLER_SECTION: [number, number] = [0.32, 0.62];
/** Lengths a tiller is cut in, for leaving out what is behind the body: about a fist's width each. */
const TILLER_LENGTHS = 14;
/** How much of the tiller's end is inside the fist round it, from the middle of the fist. */
const TILLER_IN_FIST = 0.7;
const tillerMeshes = new Map<number, Mesh>();
type Egg = { c: V3; r: V3; in: Xf };
function tillerPart(t: { pivot: V3; end: V3; wood?: string }, body: Egg[], pal: Palette): Part {
  const d: V3 = [t.end[0] - t.pivot[0], t.end[1] - t.pivot[1], t.end[2] - t.pivot[2]];
  const L = Math.round(Math.hypot(d[0], d[1], d[2]) * 20) / 20;
  let m = tillerMeshes.get(L);
  if (!m) {
    m = rings(Array.from({ length: TILLER_LENGTHS + 1 }, (_, i) => [(i / TILLER_LENGTHS) * L, ...TILLER_SECTION]), 4, 'haft');
    tillerMeshes.set(L, m);
  }
  const hide: Egg[] = [...body];
  // And the end of it, inside the fist: the fist's own egg is narrow across the grip, and the end showed in it as a square of wood.
  hide.push({ c: t.end, r: [TILLER_IN_FIST, TILLER_IN_FIST, TILLER_IN_FIST], in: ROOT });
  return { mesh: m, xf: aimed(ROOT, t.pivot, d, [0, 0, 1]), bias: 0, convex: true, pal: { ...pal, haft: t.wood ? hex(t.wood) : OAR_WOOD }, hide };
}

/**
 * The body as the eggs a tiller goes behind (`tillerPart`), each in the frame of the bone it is on and a little fatter
 * than that part of the body: the hips, the belt, the belly, the chest (a woman's further forward over the bust), the
 * neck, the head; and on each side the upper arm, the forearm, the fist, the thigh, the knee, the shin and the foot.
 */
function bodyEggs(b: Bones, fr: Frame): Egg[] {
  const T = fr.tall, sw = (fr.sh + fr.wa) / 2;
  const eggs: Egg[] = [
    { c: [0, 0, -0.05], r: [1.83 * fr.hi, 1.48, 1.35], in: b.pelvis },
    { c: [0, 0.06, 1.2], r: [1.53 * fr.wa, 1.3, 0.27], in: b.pelvis },
    { c: [0, 0, 0.8], r: [1.53 * sw, 1.18, 1.2], in: b.spine },
    { c: [0, 0.05 + 0.23 * fr.fem, 1.07], r: [1.95 * fr.sh, 1.29 + 0.21 * fr.fem, 1.22], in: b.chest },
    { c: [0, 0, 0.57], r: [0.69, 0.75, 0.93], in: b.neck },
    { c: [0, 0.11, 1.82], r: [1.72, 1.84, 1.6], in: b.head },
  ];
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1;
    eggs.push(
      { c: [-s * 0.1, 0, -1.29 * T], r: [0.81, 0.85, 1.6 * T], in: b[`arm${k}`] },
      { c: [0, 0, -1.13], r: [0.55, 0.6, 1.22], in: b[`elbow${k}`] },
      { c: [0, 0.06, -0.57], r: [0.55, 0.45, 0.71], in: b[`wrist${k}`] },
      { c: [-s * (0.06 + 0.05 * fr.fem), 0, -2.38 * T], r: [0.84 + 0.05 * fr.fem, 0.98, 1.63 * T], in: b[`hip${k}`] },
      { c: [0, -0.01, -0.69], r: [0.75, 0.89, 0.76], in: b[`knee${k}`] },
      { c: [0, 0, -2.23], r: [0.71, 0.85, 0.97], in: b[`knee${k}`] },
      { c: [0, 0.61, -0.36], r: [0.65, 1.29, 0.43], in: b[`ankle${k}`] },
    );
  }
  return eggs;
}

/** An oar's blade: how long, and how wide, in the body's units. */
const BLADE: [number, number] = [3.2, 1.15];
const OAR_WOOD: RGB = [188, 150, 104];

/** A polygon cut to what of it is above the water (`up`) or below it, the water being level nought. */
function wet(ps: V3[], up: boolean): V3[] {
  const out: V3[] = [];
  const keep = (p: V3): boolean => (up ? p[2] >= 0 : p[2] < 0);
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    if (keep(a)) out.push(a);
    if (keep(a) !== keep(b)) {
      const t = a[2] / (a[2] - b[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0]);
    }
  }
  return out;
}

/**
 * One oar: the loom from the handle in the fist out through the rowlock,
 * and the blade, square to the water through the drive and turned flat to
 * skim it on the way back. What is in the water is drawn faint, as it is
 * seen through it, and the water rings the oar where it goes in.
 */
function oar(g: CanvasRenderingContext2D, view: View, ink: number, o: { lock: V3; out: V3; feather: number; splash?: number }): void {
  const L = Math.hypot(o.out[0], o.out[1], o.out[2]);
  const d: V3 = [o.out[0] / L, o.out[1] / L, o.out[2] / L];
  // Along it from the end of the handle.
  const inboard = L / OAR_OUT, whole = inboard + L, loom = whole - BLADE[0];
  const at = (u: number): V3 => [o.lock[0] + d[0] * (u - inboard), o.lock[1] + d[1] * (u - inboard), o.lock[2] + d[2] * (u - inboard)];
  const handle = at(0), neck = at(loom), tip = at(whole);
  // Where it goes into the water, if it does.
  const into = handle[2] > 0 && tip[2] < 0 ? (whole * handle[2]) / (handle[2] - tip[2]) : whole;
  // Across the blade: up and down it while it is square, flat across the water when feathered.
  const flat = unit(cross([0, 0, 1], d)), square = unit(cross(d, flat));
  const w = unit([square[0] * (1 - o.feather) + flat[0] * o.feather, square[1] * (1 - o.feather) + flat[1] * o.feather, square[2] * (1 - o.feather) + flat[2] * o.feather]);
  const half = BLADE[1] / 2;
  const blade: V3[] = [
    [neck[0] + w[0] * half * 0.35, neck[1] + w[1] * half * 0.35, neck[2] + w[2] * half * 0.35],
    [tip[0] + w[0] * half, tip[1] + w[1] * half, tip[2] + w[2] * half],
    [tip[0] - w[0] * half, tip[1] - w[1] * half, tip[2] - w[2] * half],
    [neck[0] - w[0] * half * 0.35, neck[1] - w[1] * half * 0.35, neck[2] - w[2] * half * 0.35],
  ];
  const wood = css(OAR_WOOD), dark = css(inkOf(OAR_WOOD));
  const line = (p: V3, q: V3, width: number, colour: string): void => {
    const a = onScreen(view, p), b = onScreen(view, q);
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  };
  const fill = (ps: V3[], colour: string): void => {
    if (ps.length < 3) return;
    g.beginPath();
    ps.forEach((p, i) => { const s = onScreen(view, p); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); });
    g.closePath();
    g.fillStyle = colour;
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = ink;
    g.stroke();
  };
  g.lineCap = 'round';
  // Under the water first, faint: the blade and the end of the loom, as much as is in.
  g.globalAlpha = 0.4;
  fill(wet(blade, false), wood);
  if (into < loom) line(at(into), neck, 0.55, wood);
  g.globalAlpha = 1;
  const dry = at(Math.min(into, loom));
  line(handle, dry, 0.62 + 2 * ink, dark);
  line(handle, dry, 0.62, wood);
  fill(wet(blade, true), wood);
  // The grip, darker with handling.
  line(handle, at(1.1), 0.78, dark);
  g.lineCap = 'butt';
  /*
   * And the water round it where it is in: a short wash either side of the
   * loom, and as the blade goes in, a splash that opens out round it into a
   * puddle of broken rings and settles. It was a crisp white ring the same
   * from the moment the blade went in to the moment it came out.
   */
  if (into < whole) {
    const c = onScreen(view, at(into));
    const arc = (r: number, from: number, to: number, a: number, w: number): void => {
      g.globalAlpha = a;
      g.lineWidth = w;
      g.beginPath();
      g.ellipse(c[0], c[1], r * 1.6, r * 0.75, 0, from, to);
      g.stroke();
    };
    g.strokeStyle = 'rgb(255, 255, 255)';
    g.lineCap = 'round';
    arc(0.9, 0.3, 1.3, 0.45, 0.5);
    arc(0.9, Math.PI + 0.3, Math.PI + 1.3, 0.45, 0.5);
    const u = o.splash ?? 1;
    if (u < 1) {
      // Coming up over the first quarter of its life, so the blade going in is not a bright closed ring; the inner ring only once it has opened.
      const R = 0.7 + 1.9 * Math.sqrt(u), a = 0.85 * Math.min(1, u / 0.25) * Math.pow(1 - u, 1.3), w = 0.75 - 0.4 * u;
      arc(R, 0.15, 1.35, a, w);
      arc(R * 0.92, 1.75, 2.9, a * 0.8, w);
      arc(R, Math.PI + 0.35, Math.PI + 1.6, a, w);
      arc(R * 0.85, Math.PI + 2.0, Math.PI + 2.85, a * 0.7, w);
      if (u >= 0.2) arc(R * 0.45, 0.6, 2.4, a * 0.6, w * 0.8);
    }
    g.globalAlpha = 1;
    g.lineCap = 'butt';
  }
}

/**
 * The rings a swimmer leaves on the water. Under way, one is set going as
 * each kick drives the body forward and is left behind as it goes on,
 * opening out and fading; treading water, they open out round the body with
 * every sweep of the hands.
 *
 * They were rings round the feet -- under the hips of a body laid forward in
 * the water -- set going at full size and full strength, with the near half
 * of each drawn over the body: a white hoop popped up round a swimmer's head
 * and cut across the face. Now each starts small and fades in as it opens
 * out, and the whole of it goes down on the water before what is over the
 * water is drawn: a ring on the surface is under whatever stands up out of
 * it, from any side.
 *
 * Under way, a closed ring left behind the head was, seen from in front, a
 * halo over it. Now what the kick leaves is a wake: two arcs, one either side
 * of the line the swimmer went along, opening out sideways from behind the
 * shoulders, with nothing across the line itself.
 *
 * Treading water, every ring went round one middle, two or three at a time:
 * a target. Now each is made by a hand, the left and the right in turn, and
 * goes round where that hand was when it made it, a little off from there
 * and a little early or late, so no two share a middle.
 *
 * Setting off or stopping, the rings of what the swimmer was doing were
 * dropped in a frame, and those of what they were now doing came up as if
 * they had been going all along. Now a ring once made lives out its own life
 * (`RingSet`): the ones left as the swimmer stops are left where they were
 * and open out and fade there, and the ones left treading water are left
 * behind as the swimmer sets off; and the new rings are only those made
 * since.
 */
interface RingSet {
  moving: boolean;
  /** The set's own clock: the walk's phase under way, the idle clock treading water. */
  phase: number;
  /** Only the rings made at or after this on its clock, and before that one. */
  after?: number;
  before?: number;
  /** Under way: when the swimmer stopped, after which a ring is no further behind them. */
  halt?: number;
  /** Treading water: how far the swimmer has gone on since setting off, which the rings are left that far behind. */
  drift?: number;
}
/** Whether the rings off a hand treading water are the action effects' (`./fx/water.ts` ripple, at the hands), and so not drawn here. */
let treadByFx = false;
export const treadRingsByFx = (on: boolean): void => { treadByFx = on; };
function ripple(g: CanvasRenderingContext2D, view: View, set: RingSet, at: V3, fr: Frame): void {
  const { moving, phase } = set;
  if (!moving && treadByFx) return;
  g.strokeStyle = 'rgb(255, 255, 255)';
  g.lineCap = 'round';
  const every = moving ? SWIM_STROKE : TAU / TREAD_RATE / 2;
  // Under way, from the kick; treading water, from each sweep of a hand.
  const shift = moving ? RIPPLE_KICK * every : 0;
  const from = phase - shift;
  const now = Math.floor(from / every);
  for (let k = 0; k < 4; k++) {
    const j = now - k;
    // A ring's own small differences, from which one it is.
    const h = (n: number): number => { const x = Math.sin(j * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const late = moving ? 0 : (h(1) - 0.5) * 0.7 * every;
    const born = j * every + late;
    if (set.after !== undefined && born + shift < set.after) continue;
    if (set.before !== undefined && born + shift >= set.before) continue;
    const age = from - born;
    const life = every * (moving ? 3 : 2 + 0.8 * h(2));
    const u = age / life;
    // Left where it was made, which the swimmer has gone on from at the pace the phase goes at, as far as the picture reaches.
    const back = moving ? Math.min(age, set.halt !== undefined ? set.halt - shift - born : age) * SWUM : set.drift ?? 0;
    if (u < 0 || u >= 1 || back > RIPPLE_REACH) continue;
    // Each comes up as it opens out, so none is ever a small bright ring by the head. Treading water makes small soft rings,
    // fainter than a stroke's: as bright and as wide, two of them crossing over the neck were most of the picture.
    const fade = (moving ? 0.6 : 0.42) * Math.min(1, u / 0.3) * Math.pow(1 - u, 1.5) * (1 - back / RIPPLE_REACH);
    g.lineWidth = 1 - 0.5 * u;
    // Opening fast and then slower, from about the width of the shoulders.
    const open = 1 - (1 - u) * (1 - u);
    g.globalAlpha = fade;
    g.beginPath();
    if (moving) {
      // A wake from behind the shoulders: either side of the line gone along, square out from it and a little back.
      const c: V3 = [at[0], at[1] - back - WAKE_BEHIND, 0];
      const R = 2.4 + 6 * open;
      for (const s of [-1, 1]) {
        for (let i = 0; i <= 6; i++) {
          const a = (70 + (55 * i) / 6) * DEG;
          const p = onScreen(view, [c[0] + s * R * Math.sin(a), c[1] + R * Math.cos(a) * 0.8, 0]);
          if (i) g.lineTo(p[0], p[1]);
          else g.moveTo(p[0], p[1]);
        }
      }
    } else {
      // Round where the hand was that made it: the left and the right in turn, out toward the reach of the sweep.
      const side = j & 1 ? 1 : -1, q = (born + shift) * TREAD_RATE;
      const reach = 2.1 * fr.sh + TREAD_REACH + 0.8 * Math.sin(q + (side > 0 ? 0.35 : 0));
      const c = onScreen(view, [
        at[0] + side * reach * 0.6 + 1.2 * (h(3) - 0.5),
        at[1] + 1.0 + 0.35 * Math.cos(q) + 1.2 * (h(4) - 0.5) - back,
        0,
      ]);
      const R = (0.8 + 3.7 * open) * (0.75 + 0.5 * h(5));
      // A level circle on the water is drawn twice as wide as it is deep.
      g.ellipse(c[0], c[1], R * 1.7, R * 0.85, 0, 0, TAU);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.lineCap = 'butt';
}
/** How far behind where the head breaks the water a wake opens out from: behind the shoulders. */
const WAKE_BEHIND = 1.6;
/** How far through a stroke the kick drives the body on, and the ring that goes with it is set going. */
const RIPPLE_KICK = 0.55;

/** Where the head and shoulders break the water, in the body's frame: the first of the trunk's bones, from the head down, that crosses it. */
function breakOf(b: Bones): V3 {
  const bones = [b.head.t, b.neck.t, b.chest.t, b.pelvis.t];
  for (let i = 0; i + 1 < bones.length; i++) {
    const p = bones[i], q = bones[i + 1];
    if ((p[2] >= 0) !== (q[2] >= 0)) {
      const t = p[2] / (p[2] - q[2]);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 0];
    }
  }
  return [b.neck.t[0], b.neck.t[1], 0];
}

/** Where a swimmer of each build breaks the water as the kick drives them on: the same in every stroke, so worked out once. */
const kicked = new WeakMap<Frame, V3>();
function kickAt(fr: Frame): V3 {
  let at = kicked.get(fr);
  if (!at) {
    const r = rest();
    swim(r, RIPPLE_KICK * SWIM_STROKE, true, fr);
    at = breakOf(skeleton(fr, r));
    kicked.set(fr, at);
  }
  return at;
}
/** Units of water covered to a radian of the walk's phase, which goes `CADENCE` radians to a walking pace's worth of tiles a second, at a swimmer's pace (`phasePerTile`). */
const SWUM = (UNITS_PER_TILE * BASE_SPEED) / CADENCE;
/** How far behind a swimmer its rings are drawn before they are let go: inside the picture a body is kept in. */
const RIPPLE_REACH = 22;
/**
 * And for the shoulders and the top of the chest, more: side on, the round top of the near shoulder came up whole under
 * the jaw, a ball of shirt in the foam round the neck, before the rest of it was let up.
 */
const SHOULDER_SLIVER = 0.55;

/** The colour of water a swimmer's body is seen through, and how much of the body comes through it. */
const UNDERWATER: RGB = [44, 92, 104];
const UNDERWATER_SHOWS = 0.32;
let underPad: HTMLCanvasElement | null = null;
/**
 * The box round the figure's feet (its units) that what of the body is under the water is drawn in (`../sculpt/gl.ts`
 * UNDER_BOX), down to the feet of one upright in the water; and how far down the picture it is let fade out over, from
 * where it is faint to where nothing is seen: what is deep in the water is not seen through it.
 */
const UNDER_SCULPT = { left: -42, right: 42, top: -30, bottom: 52 };
const UNDER_FADE: [number, number] = [6, 40];
/**
 * What of the body is under the water: whatever `draw` draws on a scratch picture, which is set to the figure's units
 * round its feet at the scale `k` of a unit to a pixel of it, as `ctx` is, washed with the water's colour and laid down
 * faint, so the stroke shows through the surface as a shape. False, with nothing laid down, where it draws nothing.
 */
function underwaterBy(ctx: CanvasRenderingContext2D, box: typeof UNDER_SCULPT, draw: (g: CanvasRenderingContext2D, k: number) => boolean, fade?: [number, number]): boolean {
  if (typeof document === 'undefined') return false;
  const t = ctx.getTransform();
  const k = Math.hypot(t.a, t.b);
  const w = Math.ceil((box.right - box.left) * k), h = Math.ceil((box.bottom - box.top) * k);
  underPad ??= document.createElement('canvas');
  if (underPad.width < w || underPad.height < h) {
    underPad.width = Math.max(underPad.width, w);
    underPad.height = Math.max(underPad.height, h);
  }
  const g = underPad.getContext('2d') as CanvasRenderingContext2D;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(k, 0, 0, k, -box.left * k, -box.top * k);
  if (!draw(g, k)) return false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = css(UNDERWATER, 1, 0.62);
  g.fillRect(0, 0, w, h);
  if (fade) {
    const f = g.createLinearGradient(0, (fade[0] - box.top) * k, 0, (fade[1] - box.top) * k);
    f.addColorStop(0, 'rgba(0, 0, 0, 1)');
    f.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = f;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = UNDERWATER_SHOWS;
  ctx.drawImage(underPad, 0, 0, w, h, t.e + box.left * k, t.f + box.top * k, w, h);
  ctx.restore();
  return true;
}

/**
 * What of the outline of something sat in is its near side, on the screen:
 * the outline cut off along the top of the far side of the rim, and below.
 * The whole outline less the rim was what hid the body, which took in the top
 * of the far side as well -- a thin band of a cart's far rail drawn across the
 * driver's back from behind, which read as a rein over him. Nothing of the
 * body is ever behind the far side; only the near side hides it.
 */
function nearSide(outline: Pt[], rim: Pt[]): Pt[] {
  // The rim's top edge on the screen, left to right: its outline's upper run between its leftmost and rightmost corners.
  const turn = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sorted = [...rim].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const top: Pt[] = [];
  for (const q of sorted) {
    while (top.length >= 2 && turn(top[top.length - 2], top[top.length - 1], q) <= 0) top.pop();
    top.push(q);
  }
  if (top.length < 2) return outline;
  const l = top[0], r = top[top.length - 1];
  // Everything under that edge, out to either side of it level with its ends.
  let cut: Pt[] = [[l[0] - 400, l[1]], ...top, [r[0] + 400, r[1]], [r[0] + 400, 400], [l[0] - 400, 400]];
  // Cut to the outline, which is convex: what of `cut` is inside each of its edges in turn.
  let area = 0;
  for (let i = 0; i < outline.length; i++) area += turn([0, 0], outline[i], outline[(i + 1) % outline.length]);
  const side = Math.sign(area);
  for (let i = 0; i < outline.length && cut.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const inside = (p: Pt): boolean => turn(a, b, p) * side >= 0;
    const out: Pt[] = [];
    for (let j = 0; j < cut.length; j++) {
      const p = cut[j], q = cut[(j + 1) % cut.length];
      if (inside(p)) out.push(p);
      if (inside(p) !== inside(q)) {
        const dp = turn(a, b, p), dq = turn(a, b, q), t = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    cut = out;
  }
  return cut;
}

/** Where treading water is done from, in the body's frame: under the head, a little ahead of the feet. */
const TREAD_AT: V3 = [0, 1.1, 0];

/**
 * What each swimmer was doing on the water and when it changed, so that the
 * rings made before the change live out their lives after it: the clock each
 * set of rings goes by (the walk's phase under way, the idle clock treading
 * water) where it was at the change and how fast it was going, and the clock
 * of what came next where it was then.
 */
interface Wash { moving: boolean; at: number; seen: number; rate: number; since: number; was: number; pace: number; from: number }
const washes = new Map<string, Wash>();
/** How long after setting off or stopping the rings made before it are still drawn: longer than any of them lives. */
const WASH_KEEP = 4;

/** The rings to draw for a swimmer now: of what they are doing, and of what they were doing if they changed lately. */
function ringSets(pose: FigurePose, now: number): RingSet[] {
  const id = pose.id;
  if (!id) return [{ moving: pose.moving, phase: pose.phase }];
  let w = washes.get(id);
  if (!w || now - w.seen > 0.5 || now < w.seen) {
    w = { moving: pose.moving, at: pose.phase, seen: now, rate: pose.moving ? 7 : 6, since: -Infinity, was: 0, pace: 6, from: 0 };
    washes.set(id, w);
    if (washes.size > 256) for (const [k, v] of washes) if (now - v.seen > 5) washes.delete(k);
  }
  if (pose.moving !== w.moving) {
    // Where the clock of what has stopped had got to, going on as it went; and where the new one starts from.
    w.was = w.at + (now - w.seen) * w.rate;
    w.pace = w.rate;
    w.since = now;
    w.from = pose.phase;
    w.moving = pose.moving;
    w.rate = pose.moving ? 7 : 6;
  } else if (now > w.seen && pose.phase > w.at) {
    // The walk's phase goes as fast as the swimmer does: how fast, from the last two frames, steadied.
    w.rate += ((pose.phase - w.at) / (now - w.seen) - w.rate) * 0.3;
  }
  w.at = pose.phase;
  w.seen = now;
  const ago = now - w.since;
  if (ago > WASH_KEEP) return [{ moving: pose.moving, phase: pose.phase }];
  // The clock of what was being done, as if it had gone on at the pace it went.
  const old = w.was + ago * w.pace;
  return [
    pose.moving
      ? { moving: false, phase: old, before: w.was, drift: Math.min(RIPPLE_REACH, (pose.phase - w.from) * SWUM) }
      : { moving: true, phase: old, before: w.was, halt: w.was },
    { moving: pose.moving, phase: pose.phase, after: w.from },
  ];
}

function drawLive(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, fr: Frame, r: Rig, facing: number, ink: number, now: number): void {
  // Sat driving, the sculpted body goes in among what it holds and sits in, and in the water among the rings on it, below;
  // anywhere else it is the whole of it.
  const sp = { ...pose, facing };
  if (!seatOf(pose) && !pose.swimming) {
    drawSculpted(ctx, sx, sy, zoom, sp);
    return;
  }
  const b = skeleton(fr, r);
  const view = viewOf(facing);
  const pal = paletteOf(pose, pose.look ?? DEFAULT_LOOK);
  const outer = ctx.getTransform();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(zoom, zoom);
  if (pose.swimming) {
    /*
     * In the water, cut at the surface on the GPU (`../sculpt/lowpoly.ts` lowScene): what of it is under the surface laid
     * down faint, the rings on the water over that, then what is over the surface with the foam round it where it goes
     * through.
     */
    const sculptUnder = (g: CanvasRenderingContext2D, k: number): boolean => {
      g.setTransform(k / zoom, 0, 0, k / zoom, -UNDER_SCULPT.left * k, -UNDER_SCULPT.top * k);
      return drawSculpted(g, 0, 0, zoom, sp, 'under');
    };
    if (underwaterBy(ctx, UNDER_SCULPT, sculptUnder, UNDER_FADE)) {
      for (const set of ringSets(pose, now)) ripple(ctx, view, set, set.moving ? kickAt(fr) : TREAD_AT, fr);
      const inner = ctx.getTransform();
      ctx.setTransform(outer);
      drawSculpted(ctx, sx, sy, zoom, sp, 'over');
      ctx.setTransform(inner);
    }
  } else {
    // A far oar goes under the body, a near one over it.
    const T = view.T;
    const near = (o: { lock: V3 }): boolean => o.lock[0] * T[0] + o.lock[1] * T[1] > 0;
    for (const o of r.oars ?? []) if (!near(o)) oar(ctx, view, ink, o);
    if (r.reins) reins(ctx, b, view, r, 1 / zoom, true);
    // The tiller whole under the body, and what of it is in front of the body over it (`tillerPart`).
    if (r.tiller) render(ctx, [tillerPart(r.tiller, [], pal)], pal, view, ink, 1 / zoom, now);
    const sides = r.seat?.sides;
    if (sides) {
      // Whatever of the body is down behind the near side of what it sits in: hidden, except where it is seen down into over the rim.
      ctx.save();
      const p = new Path2D();
      p.rect(-200, -200, 400, 400);
      for (const loop of [nearSide(sides.outline, sides.rim), sides.rim]) {
        loop.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        p.closePath();
      }
      ctx.clip(p, 'evenodd');
    }
    // The sculpted body sat there, its fists on what they hold (`../sculpt/anim` seatedLocal), drawn through the clip of the near side.
    const inner = ctx.getTransform();
    ctx.setTransform(outer);
    drawSculpted(ctx, sx, sy, zoom, sp);
    ctx.setTransform(inner);
    if (sides) ctx.restore();
    for (const o of r.oars ?? []) if (near(o)) oar(ctx, view, ink, o);
    // The tiller over the body, but for what of it the body is in front of (`tillerPart`); over the rim, as it is.
    if (r.tiller) render(ctx, [tillerPart(r.tiller, bodyEggs(b, fr), pal)], pal, view, ink, 1 / zoom, now);
    if (r.reins) reins(ctx, b, view, r, 1 / zoom, false);
  }
  ctx.restore();
}

/**
 * How far above the feet the top of a standing body's hair comes, in screen
 * units at zoom one: where a name or what somebody said goes over them. The
 * crown of the skeleton at rest, and the volume of a full head of hair on it.
 */
export const FIGURE_TOP: number = (() => {
  const b = skeleton(frameOf(DEFAULT_LOOK), rest());
  return Math.ceil(place(b.head, bigger([0, -0.1, CROWN + 0.6]))[2] * HEIGHT_SCALE);
})();

/* ---- bodies kept between frames -------------------------------------------------- */

/**
 * A body on the island is not drawn afresh every frame. It is drawn into a
 * picture of its own, and that picture put on the screen wherever the body
 * is; the picture is drawn again a dozen times a second while it stands and
 * thirty while it walks, which is more than a stride or a breath needs --
 * fewer in a crowd -- and every frame while it is blending from one thing to
 * another or turning. Standing about, those dozen a second are kept as the
 * pictures of a loop and drawn once each (`idleLoop`).
 * A few hundred facets a frame for every person in view is what the island
 * could not afford; a picture a frame is what it always drew.
 *
 * At every size. From `STILL_BELOW` in it is put down on a whole device
 * pixel, so it stays sharp. It was drawn again twice as often there too, which
 * at that size is a picture as big as a tree remade every frame of a walk:
 * seven milliseconds of a close view for one person standing in it. The rates
 * are the same at every zoom now.
 */
const STILL_BELOW = 2.5;

/** Redraws a second, by what the body is doing. */
const STILL_RATE: Record<string, number> = { idle: 12, work: 20, walk: 30, swim: 20, drive: 20 };
/** And never fewer than this for a body wearing something that shines. */
const SHINE_RATE = 24;

/**
 * With more people than this in view, none is drawn again more than
 * `CROWD_RATE` times a second: in a crowd no one person is watched closely
 * enough to see a stride at half the rate, and it holds the cost of a crowd
 * to what eight people cost at full rate.
 */
const CROWD = 8;
const CROWD_RATE = 15;

/** Who has been drawn lately, counted afresh every quarter of a second, and how many were last time. */
const lately = { since: 0, ids: new Set<string>(), count: 0 };

/** The picture's extent round the feet, in the figure's own screen units: reins, a raised arm, a hop, a blade held out to the side and a spear upright all inside it. */
const STILL_BOX = { left: -42, right: 42, top: -62, bottom: 14 };

interface Still {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** Everything that, changed, means drawing it again whatever the time. */
  key: string;
  at: number;
  /** Where the feet are in it, in its own pixels, and how many of those to a pixel of the screen it goes on. */
  ox: number;
  oy: number;
  dev: number;
  /** Where it was last put down: on what, and where in that one's own units. */
  put?: { ctx: CanvasRenderingContext2D; x: number; y: number; w: number; h: number };
  /** How many times it has been drawn, so whatever is made from it knows when to make it again (`figurePicture`). */
  drawn?: number;
  /** The picture of its loop standing it was last put down from instead (`idleLoop`), if it was. */
  shown?: HTMLCanvasElement;
  /** The zoom and device scale it was drawn at: a picture at another size is drawn again whatever the budget (`sculptMay`). */
  sized?: string;
}

const stills = new Map<string, Still>();

/**
 * The picture of a body as it was last put down, and where, while it is kept
 * as one (see `drawStill`): what a boat's sail in front of my own helmsman is
 * let fade over, so he shows through it (`seeThrough` in `./furniture`).
 */
export function figurePicture(id: string): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number; ver: number } | null {
  const st = stills.get(id);
  return st?.put ? { ...st.put, canvas: st.shown ?? st.canvas, ver: st.drawn ?? 0 } : null;
}

function drawStill(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, fr: Frame, r: Rig, facing: number, changing: boolean, ink: number, now: number, still = false): void {
  const id = pose.id as string;
  const t = ctx.getTransform();
  /*
   * Device pixels to a unit of the context it goes on, from the area the transform scales by and in sixteenths: under a
   * boat's or a cart's sway the transform is a shear and a turn that changes every frame, and its first column's length
   * went with it (by two per cent either way at sea), so the key never matched, and everybody aboard was drawn afresh and
   * the picture resized every frame. Kept at what it was while it is within a twentieth of that, for the root of the area
   * still goes by a per cent and a half either way at sea, which crossed from one sixteenth to the next at some sizes. That
   * much off, the picture is drawn that much larger or smaller, which nobody sees.
   */
  const seen = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1, was = stills.get(id)?.dev;
  const dev = was !== undefined && Math.abs(seen - was) < 0.05 * was ? was : Math.max(1, Math.round(seen * 16)) / 16;
  const look = pose.look ?? DEFAULT_LOOK;
  const key = [look.gender, look.skin, look.hair, look.hairColour, look.hairBright, pose.tunic, pose.trousers,
    Math.round(facing * 100), zoom.toFixed(3), dev, doing(pose), pose.working ? pose.job ?? '' : '', pose.emote ?? '', gearKey(pose.gear), sculptKey()].join('|');
  if (stride(ctx, sx, sy, zoom, pose, fr, facing, changing, ink, key, dev)) return;
  let st = stills.get(id);
  if (now - lately.since > 0.25 || now < lately.since) {
    lately.count = lately.ids.size;
    lately.ids.clear();
    lately.since = now;
  }
  lately.ids.add(id);
  if (idleLoop(ctx, sx, sy, zoom, pose, fr, r, facing, changing, ink, now, key, dev, id)) return;
  const close = zoom >= STILL_BELOW;
  // Something rare on them is drawn often enough for its glint to cross it smoothly.
  const rate = Math.min(Math.max(pose.emote ? 30 : STILL_RATE[doing(pose)] ?? 30, gearShines(pose.gear) ? SHINE_RATE : 0), lately.count > CROWD ? CROWD_RATE : Infinity);
  const sized = `${zoom.toFixed(3)}|${dev}`;
  /*
   * With animations off (`still`), nothing in the picture moves on its own: drawn again only when something in its key
   * changes (the look, what is worn, the way it faces, what it is doing, the size, the sculpted bakes), never for the
   * time. Kept fresh meanwhile, so a crowd's pictures are not let go while they are still in view.
   */
  const due = still ? st?.key !== key : st?.key !== key || changing || now - (st?.at ?? 0) >= 1 / rate || now < (st?.at ?? 0);
  if (!st || st.sized !== sized || (due && sculptMay(id))) {
    const k = zoom * dev;
    const w = Math.ceil((STILL_BOX.right - STILL_BOX.left) * k), h = Math.ceil((STILL_BOX.bottom - STILL_BOX.top) * k);
    if (!st) {
      const canvas = document.createElement('canvas');
      st = { canvas, g: canvas.getContext('2d') as CanvasRenderingContext2D, key: '', at: 0, ox: 0, oy: 0, dev };
      stills.set(id, st);
      if (stills.size > 96) for (const [k2, v] of stills) if (now - v.at > 5) stills.delete(k2);
    }
    if (st.canvas.width !== w || st.canvas.height !== h) {
      st.canvas.width = w;
      st.canvas.height = h;
    }
    st.ox = Math.round(-STILL_BOX.left * k);
    st.oy = Math.round(-STILL_BOX.top * k);
    st.dev = dev;
    st.sized = sized;
    st.key = key;
    st.at = now;
    st.drawn = (st.drawn ?? 0) + 1;
    st.shown = undefined;
    st.g.setTransform(1, 0, 0, 1, 0, 0);
    st.g.clearRect(0, 0, w, h);
    st.g.setTransform(dev, 0, 0, dev, st.ox, st.oy);
    figureStats.redraws++;
    drawLive(st.g, 0, 0, zoom, pose, fr, r, facing, ink, now);
  } else if (still) st.at = now;
  const x = sx - st.ox / st.dev, y = sy - st.oy / st.dev;
  const px = close ? Math.round(x * st.dev) / st.dev : x, py = close ? Math.round(y * st.dev) / st.dev : y;
  ctx.drawImage(st.canvas, px, py, st.canvas.width / st.dev, st.canvas.height / st.dev);
  st.put = { ctx, x: px, y: py, w: st.canvas.width / st.dev, h: st.canvas.height / st.dev };
}

/** The layer a veiled body is drawn into before it is tinted and put down (see `drawVeiled`): one, kept, for every veiled body in turn. */
let veilLayer: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;

/**
 * A body under a spell's veil (`FigurePose.veil`): drawn as it would be into a
 * layer of its own, the size of a still's picture, `tint` of the way to the
 * veil's colour over every pixel of it and nothing round it, and put down
 * `fade` of the way to nothing. Laid over the picture as it goes down rather
 * than into it, so a kept picture or a stride's is the same picture veiled or
 * not, and only a veiled body pays for the layer.
 */
function drawVeiled(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, veil: FigureVeil, id: string | undefined, draw: (g: CanvasRenderingContext2D) => void): void {
  const t = ctx.getTransform();
  const dev = Math.hypot(t.a, t.b) || 1, k = zoom * dev;
  const w = Math.ceil((STILL_BOX.right - STILL_BOX.left) * k), h = Math.ceil((STILL_BOX.bottom - STILL_BOX.top) * k);
  if (!veilLayer) {
    const canvas = document.createElement('canvas');
    veilLayer = { canvas, g: canvas.getContext('2d') as CanvasRenderingContext2D };
  }
  const { canvas, g } = veilLayer;
  if (canvas.width < w || canvas.height < h) {
    canvas.width = Math.max(canvas.width, w);
    canvas.height = Math.max(canvas.height, h);
  }
  const ox = Math.round(-STILL_BOX.left * k), oy = Math.round(-STILL_BOX.top * k);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.setTransform(dev, 0, 0, dev, ox, oy);
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (veil.tint > 0.004) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = Math.min(1, veil.tint);
    g.fillStyle = veil.colour;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  const x = sx - ox / dev, y = sy - oy / dev;
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * Math.max(0, 1 - veil.fade);
  ctx.drawImage(canvas, 0, 0, w, h, x, y, w / dev, h / dev);
  ctx.globalAlpha = was;
  // The picture as last put down is where it went on the screen, not in the layer (see `figurePicture`).
  const st = id ? stills.get(id) : undefined;
  if (st?.put && st.put.ctx === g) st.put = { ...st.put, ctx, x: st.put.x + sx, y: st.put.y + sy };
}

/*
 * A walk is a loop: the same sixteen pictures a stride, at each of the eight
 * ways round, over and over for as long as the body keeps walking. So a body
 * walking steadily, facing one way, is put down from a picture of that
 * sixteenth of its stride kept from the stride before, and only the first
 * stride at a size draws anything. Turning, starting or stopping, emoting, or
 * wearing something whose light moves across it, it is drawn as a still is.
 * The wildermon have kept theirs this way since they were made (`drawBeast`).
 */

/** Pictures to a stride, and the steps between a walk and a run they are kept at. */
export const WALK_FRAMES = 16;
const GAIT_STEPS = 10;
/** Device pixels of stride pictures kept, the longest unused going first: about forty-eight megabytes. */
const STRIDE_PIXELS = 12_000_000;

interface StrideFrame {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  dev: number;
}

const strides = new Map<string, StrideFrame>();
let stridePixels = 0;

/*
 * Standing about is a loop as well: everything a body does standing (`idle`)
 * comes round again in `IDLE_LOOP` seconds, and everybody standing is at the
 * same moment in it (the island's clock). It was drawn afresh as a still a
 * dozen times a second for as long as it stood, two or three milliseconds
 * each for the player alone, which made every fifth frame or so a long one.
 * So each of those twelfths of a second of the loop is kept as a picture the
 * first time it is drawn, and put down whenever the body is at that twelfth
 * again: after its first loop standing at a size, a body standing about draws
 * nothing, and two people dressed alike share the pictures. A picture is the
 * body as it was when that twelfth was first wanted, somewhere in it, which is
 * what the still drawn a dozen times a second showed. Kept only while a loop
 * for everybody drawn lately fits in `IDLE_PIXELS`: close in, where one loop
 * is a great many pixels, or with a crowd standing about, a body is drawn as
 * a still as before. Emoting, turning, blending, or wearing something whose
 * light moves across it, it is drawn as a still too.
 */
const IDLE_LOOP = 16;
/** Device pixels of standing pictures kept, the longest unused going first: about sixty-four megabytes. */
const IDLE_PIXELS = 16_000_000;
const idles = new Map<string, StrideFrame>();
let idlePixels = 0;

/** Put down a body standing about from its loop's pictures, making the one it needs if it is new; false when it is not to be. */
function idleLoop(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, fr: Frame, r: Rig, facing: number, changing: boolean,
  ink: number, now: number, still: string, dev: number, id: string): boolean {
  if (changing || doing(pose) !== 'idle' || pose.emote || pose.seat || !Number.isInteger(facing) || gearShines(pose.gear)) return false;
  const rate = STILL_RATE.idle, count = IDLE_LOOP * rate;
  const k = zoom * dev;
  const w = Math.ceil((STILL_BOX.right - STILL_BOX.left) * k), h = Math.ceil((STILL_BOX.bottom - STILL_BOX.top) * k);
  if (Math.max(1, lately.count, lately.ids.size) * count * w * h > IDLE_PIXELS) return false;
  // The same clock the pose is worked out from (`rigOf`).
  const t = (((pose.phase / 6) % IDLE_LOOP) + IDLE_LOOP) % IDLE_LOOP;
  const key = `${still}|${Math.min(count - 1, Math.floor(t * rate))}`;
  let f = idles.get(key);
  if (f) {
    idles.delete(key);
    idles.set(key, f);
  } else {
    if (!sculptMay(pose.id)) return false;
    while (idlePixels + w * h > IDLE_PIXELS && idles.size) {
      const [old, gone] = idles.entries().next().value as [string, StrideFrame];
      idles.delete(old);
      idlePixels -= gone.canvas.width * gone.canvas.height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    f = { canvas, ox: Math.round(-STILL_BOX.left * k), oy: Math.round(-STILL_BOX.top * k), dev };
    g.setTransform(dev, 0, 0, dev, f.ox, f.oy);
    figureStats.redraws++;
    drawLive(g, 0, 0, zoom, pose, fr, r, facing, ink, now);
    idles.set(key, f);
    idlePixels += w * h;
  }
  const x = sx - f.ox / f.dev, y = sy - f.oy / f.dev;
  const px = zoom >= STILL_BELOW ? Math.round(x * f.dev) / f.dev : x, py = zoom >= STILL_BELOW ? Math.round(y * f.dev) / f.dev : y;
  ctx.drawImage(f.canvas, px, py, f.canvas.width / f.dev, f.canvas.height / f.dev);
  // Where it went, as a still's is (`figurePicture`), and drawn again as far as anything made from it is concerned when it is another picture.
  let st = stills.get(id);
  if (!st) {
    const canvas = document.createElement('canvas');
    st = { canvas, g: canvas.getContext('2d') as CanvasRenderingContext2D, key: '', at: 0, ox: 0, oy: 0, dev };
    stills.set(id, st);
  }
  if (st.shown !== f.canvas) st.drawn = (st.drawn ?? 0) + 1;
  st.shown = f.canvas;
  st.key = '';
  st.at = now;
  st.put = { ctx, x: px, y: py, w: f.canvas.width / f.dev, h: f.canvas.height / f.dev };
  return true;
}

/** Put down a walking body from its stride's pictures, making the picture it needs if it is new; false when it is not walking steadily. */
function stride(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose, fr: Frame, facing: number, changing: boolean,
  ink: number, still: string, dev: number): boolean {
  if (changing || doing(pose) !== 'walk' || pose.emote || !Number.isInteger(facing) || gearShines(pose.gear) || !clearReady({ ...pose, facing }, fr)) return false;
  const turn = (((pose.phase / TAU) % 1) + 1) % 1;
  const i = Math.min(WALK_FRAMES - 1, Math.floor(turn * WALK_FRAMES));
  const gait = Math.round(Math.max(0, Math.min(1, pose.gait ?? 0)) * GAIT_STEPS) / GAIT_STEPS;
  // Which of the strides in `WALK_VARY` it is on, as the walk counts them (`rigOf`).
  const N = WALK_VARY.length, n = (((Math.floor(pose.phase / TAU) % N) + N) % N), v = (n + strideSeed(pose.id)) % N;
  const key = `${still}|${gait}|${v}|${i}`;
  let f = strides.get(key);
  if (f) {
    strides.delete(key);
    strides.set(key, f);
  } else {
    if (!sculptMay(pose.id)) return false;
    const k = zoom * dev;
    const w = Math.ceil((STILL_BOX.right - STILL_BOX.left) * k), h = Math.ceil((STILL_BOX.bottom - STILL_BOX.top) * k);
    while (stridePixels + w * h > STRIDE_PIXELS && strides.size) {
      const [old, gone] = strides.entries().next().value as [string, StrideFrame];
      strides.delete(old);
      stridePixels -= gone.canvas.width * gone.canvas.height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    f = { canvas, ox: Math.round(-STILL_BOX.left * k), oy: Math.round(-STILL_BOX.top * k), dev };
    g.setTransform(dev, 0, 0, dev, f.ox, f.oy);
    // The middle of its sixteenth, at its step of gait.
    const at: FigurePose = { ...pose, phase: (n + (i + 0.5) / WALK_FRAMES) * TAU, gait };
    figureStats.redraws++;
    drawLive(g, 0, 0, zoom, at, fr, rigOf(at, fr), facing, ink, 0);
    strides.set(key, f);
    stridePixels += w * h;
  }
  const x = sx - f.ox / f.dev, y = sy - f.oy / f.dev;
  if (zoom >= STILL_BELOW) ctx.drawImage(f.canvas, Math.round(x * f.dev) / f.dev, Math.round(y * f.dev) / f.dev, f.canvas.width / f.dev, f.canvas.height / f.dev);
  else ctx.drawImage(f.canvas, x, y, f.canvas.width / f.dev, f.canvas.height / f.dev);
  return true;
}
