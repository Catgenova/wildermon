import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The kiln line: the Kilnlet, a small low chubby salamander of terracotta,
 * speckled with darker clay, a big round head with big amber eyes, a soft
 * smile and a cream throat and belly, a row of small flat clay tiles along
 * its head, back and tail, each glowing ember-orange at its root, and a
 * curling tail that ends in a few loose tile flakes floating free; which
 * grows into the Terrabrick, bigger, standing taller on straighter legs, its
 * neck raised, a crest of larger tiles behind its head, a ridge of big ones
 * down its back and tiles overlapping on its shoulders and haunches; and then
 * the Kilnspire, large and regal, its neck and chest upright, a mane of big
 * tiles fanning round the back of its head and down its neck, a row of tall
 * tiles along its back like a kiln's chimney, glowing between them, and a
 * very long tail swept up high and breaking into flakes. The species is still
 * `potta` underneath, as saves and the database know it: it empties the kilns
 * into the settlement's stores and loads them with unfired pottery.
 *
 * Each is its variant's coat on its skin and its tiles and its markings on
 * the cream of its throat and belly and the light of its speckles; the ember
 * between its tiles, its claws and amber eyes, and the kiln it works are the
 * same on every variant. All three are built by one set of functions from a
 * description of the stage (`Kiln`), and walk the way the brick line does
 * (`./wild-brick`): every foot is given a point to be at and its leg bent to
 * reach it, a lizard's sprawl, the diagonals together, its spine waving from
 * side to side and its tail swinging against it.
 *
 * Every tile is a rounded rhombus of fired clay, bevelled, with the ember
 * painted lit on both its faces at its root and a strip of it along the skin
 * between, and a soft light over it that breathes (`emberLights`).
 *
 * At its task a small stone kiln stands in front of it: it takes an unfired
 * pot from the ground in its jaws, the kiln's door swings open and the light
 * flares, it pushes the pot into the glowing mouth, reaches in again and draws
 * a fired pot out, the door shuts, and it sets the fired pot down on the other
 * side (`KILN_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Kiln {
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
  /**
   * The neck: where it comes out of the body, how long, how wide at its root and at the head, how far forward of upright
   * (degrees), and how far forward its line bows at a third, two thirds and the top of it: the Kilnspire's an S, its chest
   * swelling out under it.
   */
  neck: { at: V3; len: number; w: [number, number]; lean: number; curve: [number, number, number] };
  /** The skull's half-sizes; the snout's (across, up, along); how far up the skull sits from the neck; the head's pitch, nose up. */
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number; tall: number };
  /**
   * The tiles behind its head: how many in the outer fan and the inner, how long the longest, how wide against long, and how far
   * round from straight up toward straight back the fan goes, from and to (degrees).
   */
  crest: { count: number; inner: number; len: number; wide: number; arc: readonly [number, number] };
  /** The tiles down the back of its neck: how many, how long. */
  nape: { count: number; len: number };
  /** The ridge of tiles down its back: how many, the shortest and the longest, how wide against long, and where along the back the longest stand (nought rump, one shoulders). */
  ridge: { count: number; len: [number, number]; wide: number; peak: number };
  /** Flat tiles laid overlapping on its flanks, shoulders and haunches: how many down each flank, and how big. */
  armour: { count: number; size: number };
  tail: {
    at: V3;
    links: number[];
    w: number[];
    /** How it carries its tail: lifted at the root (degrees up from straight back), curled up at each link, curled further at the last three. */
    lift: number; curl: number; tip: number;
    /** How far it is carried round to its left, in degrees. */
    side?: number;
    /** How long the tile on its first link is. */
    tile: number;
  };
  /** The tile flakes floating off the tip of its tail: how many, how long the first, how far apart. */
  flakes: { count: number; len: number; gap: number };
  /** How many dark clay speckles on its skin. */
  spots: number;
  /** The kiln it works: its radius, and the pots' radius and height. */
  kiln: { r: number; pot: [number, number] };
  gait: {
    /** How much of a stride a foot is down at a walk and at a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the body goes down at a footfall; how far it rolls (degrees). */
    step: number; bob: number; roll: number;
    /** How far its spine bends from side to side at a walk and at a run, in degrees at either end of it. */
    wave: [number, number];
  };
  size: number;
}

/** A Kilnlet: small, low and chubby on short splayed legs, a big round head, a row of small tiles down its head, back and tail. */
const KILNLET_LOOK: Kiln = {
  stage: 0,
  body: { y: [-0.84, -0.7, -0.38, 0, 0.36, 0.62, 0.74], z: [0.0, -0.01, -0.01, 0.0, 0.03, 0.07, 0.1], w: [0.24, 0.45, 0.56, 0.58, 0.55, 0.44, 0.22], h: [0.15, 0.26, 0.31, 0.32, 0.31, 0.27, 0.15] },
  len: 1.04, hip: 0.72, drop: 0.5,
  fore: [0.36, 0.24, 0.07], hind: [0.38, 0.24, 0.07], thick: 0.135, spread: 1.5, knee: 1.5, reachOut: [0.1, 0.08],
  high: 0.3,
  neck: { at: [0, 0.62, 0.06], len: 0.16, w: [0.34, 0.32], lean: 64, curve: [0, 0, 0] },
  head: { r: [0.42, 0.39, 0.31], snout: [0.31, 0.18, 0.23], up: 0.1, pitch: 6 },
  eye: { dir: [0.84, 0.42, 0.38], size: 0.112, tall: 1.1 },
  crest: { count: 2, inner: 3, len: 0.26, wide: 0.78, arc: [70, 120] },
  nape: { count: 1, len: 0.24 },
  ridge: { count: 7, len: [0.24, 0.34], wide: 0.74, peak: 0.6 },
  armour: { count: 0, size: 0.12 },
  tail: { at: [0, -0.8, 0.05], links: [0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13], w: [0.19, 0.17, 0.155, 0.14, 0.125, 0.11, 0.095, 0.08, 0.065], lift: -8, curl: 9, tip: 30, side: 28, tile: 0.22 },
  flakes: { count: 3, len: 0.15, gap: 0.15 },
  spots: 40,
  kiln: { r: 0.54, pot: [0.14, 0.28] },
  gait: { duty: [0.62, 0.42], swing: [0.34, 0.35], step: 0.2, bob: 0.025, roll: 2.5, wave: [12, 16] },
  size: 2.75,
};

/** A Terrabrick: longer, standing taller on straighter legs, its neck raised, a crest of tiles behind its head and a ridge of big ones down its back. */
const TERRABRICK_LOOK: Kiln = {
  stage: 1,
  body: { y: [-1.5, -1.3, -0.72, 0, 0.7, 1.12, 1.3], z: [0.02, 0.0, 0.0, 0.02, 0.06, 0.13, 0.2], w: [0.32, 0.58, 0.68, 0.7, 0.68, 0.56, 0.34], h: [0.26, 0.42, 0.49, 0.51, 0.5, 0.45, 0.29] },
  len: 1.9, hip: 0.62, drop: 0.55,
  fore: [0.5, 0.42, 0.08], hind: [0.54, 0.42, 0.08], thick: 0.18, spread: 1.05, knee: 1.15, reachOut: [0.08, 0.06],
  high: 0.66,
  neck: { at: [0, 1.1, 0.3], len: 1.4, w: [0.5, 0.28], lean: 12, curve: [0.14, 0.0, 0.16] },
  head: { r: [0.42, 0.48, 0.35], snout: [0.29, 0.2, 0.35], up: 0.08, pitch: 4 },
  eye: { dir: [0.72, 0.52, 0.44], size: 0.17, tall: 1.06 },
  crest: { count: 3, inner: 5, len: 0.64, wide: 0.74, arc: [70, 140] },
  nape: { count: 3, len: 0.5 },
  ridge: { count: 7, len: [0.5, 0.98], wide: 0.66, peak: 0.66 },
  armour: { count: 0, size: 0.3 },
  tail: { at: [0, -1.44, 0.06], links: [0.29, 0.28, 0.27, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19], w: [0.28, 0.25, 0.23, 0.21, 0.19, 0.17, 0.15, 0.13, 0.115, 0.1, 0.085], lift: -16, curl: 7, tip: 40, side: 32, tile: 0.36 },
  flakes: { count: 4, len: 0.2, gap: 0.2 },
  spots: 60,
  kiln: { r: 0.85, pot: [0.19, 0.4] },
  gait: { duty: [0.64, 0.44], swing: [0.32, 0.34], step: 0.2, bob: 0.03, roll: 2, wave: [11, 15] },
  size: 2.6,
};

/** A Kilnspire: large and regal, its neck and chest upright, a mane of big tiles round its head and down its neck, tall tiles along its back, a very long tail swept up high. */
const KILNSPIRE_LOOK: Kiln = {
  stage: 2,
  body: { y: [-2.0, -1.76, -1.0, 0, 0.9, 1.36, 1.56], z: [0.02, 0.0, 0.0, 0.05, 0.18, 0.36, 0.52], w: [0.48, 0.86, 1.02, 1.06, 1.06, 0.92, 0.56], h: [0.36, 0.6, 0.72, 0.78, 0.82, 0.78, 0.5] },
  len: 2.5, hip: 0.6, drop: 0.55,
  fore: [0.7, 0.58, 0.12], hind: [0.76, 0.58, 0.12], thick: 0.28, spread: 1.02, knee: 1.1, reachOut: [0.1, 0.07],
  high: 0.94,
  neck: { at: [0, 1.28, 0.62], len: 2.5, w: [1.0, 0.42], lean: 8, curve: [0.44, -0.06, 0.52] },
  head: { r: [0.64, 0.74, 0.52], snout: [0.42, 0.28, 0.5], up: 0.08, pitch: 0 },
  eye: { dir: [0.72, 0.52, 0.44], size: 0.23, tall: 1.02 },
  crest: { count: 9, inner: 9, len: 1.7, wide: 0.64, arc: [18, 165] },
  nape: { count: 6, len: 1.5 },
  ridge: { count: 7, len: [0.9, 1.9], wide: 0.64, peak: 0.6 },
  armour: { count: 0, size: 0.44 },
  tail: { at: [0, -1.94, 0.1], links: [0.4, 0.39, 0.38, 0.37, 0.36, 0.35, 0.34, 0.33, 0.32, 0.31, 0.3, 0.29, 0.28, 0.27, 0.26], w: [0.42, 0.39, 0.36, 0.33, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.18, 0.16, 0.14, 0.12, 0.1], lift: -4, curl: 7, tip: 18, side: 30, tile: 0.5 },
  flakes: { count: 5, len: 0.34, gap: 0.3 },
  spots: 80,
  kiln: { r: 1.4, pot: [0.27, 0.56] },
  gait: { duty: [0.68, 0.48], swing: [0.27, 0.31], step: 0.17, bob: 0.05, roll: 3.2, wave: [9, 12] },
  size: 2.0,
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
/** A frame standing upright at `t`, scaled by `g`: what is set on the ground, grown in from nothing as the act starts. */
const upright = (t: V3, g = 1): Xf => ({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t });

/** Each face wound so it faces away from `mid`, whichever way round it was listed. */
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

/* ---- a tile ---------------------------------------------------------------------------- */

/** Where a tile stands: its root, the way it points from its root to its tip, the way its face is turned, and its size. */
interface Tile { root: V3; dir: V3; face: V3; len: number; wide: number; thick: number; mat: Mat }

/** The outline of a tile, `n` points round: a broad rhombus with its corners well rounded, a slab, widest a little under half way up, in (across, along). */
function tileOutline(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    // A superellipse between a diamond and an oval, its upper half longer than its lower: a rounded rhombus.
    const e = 2 / 1.3, u = Math.sign(c) * Math.abs(c) ** e, v = Math.sign(s) * Math.abs(s) ** e;
    out.push([u, 0.45 + v * (v > 0 ? 0.55 : 0.45)]);
  }
  return out;
}
const OUTLINE_FINE = tileOutline(10), OUTLINE_COARSE = tileOutline(6);

/**
 * A tile of fired clay: a flat rounded rhombus `len` long and `wide` across, `thick` thick, bevelled round its front face when
 * drawn big; the ember painted lit on both its faces at its root, a bright heart in it.
 */
function tileMesh(T: Tile, fine: boolean, glow = true): Mesh {
  const D = unit(T.dir), N = unit(sub(T.face, scale(D, dot(T.face, D)))), U = cross(D, N);
  const pts = fine ? OUTLINE_FINE : OUTLINE_COARSE, w = T.len * T.wide * 0.5, th = T.thick;
  const at = (u: number, v: number, k: number, o: number): V3 => {
    const mid = 0.45;
    return add(T.root, add(add(scale(U, u * w * k), scale(D, (mid + (v - mid) * k) * T.len)), scale(N, o)));
  };
  const rings: Array<[number, number]> = fine ? [[1, -th * 0.5], [1, th * 0.15], [0.8, th * 0.5]] : [[1, -th * 0.5], [1, th * 0.5]];
  const v: V3[] = [];
  for (const [k, o] of rings) for (const [u, vv] of pts) v.push(at(u, vv, k, o));
  const n = pts.length, f: Face[] = [];
  f.push({ i: pts.map((_, j) => j), m: T.mat });
  f.push({ i: pts.map((_, j) => (rings.length - 1) * n + j), m: T.mat });
  // Its edge and its bevel lighter than its face, so each tile is drawn round and stands apart from the next and from the skin.
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < n; j++) f.push({ i: [r * n + j, r * n + ((j + 1) % n), (r + 1) * n + ((j + 1) % n), (r + 1) * n + j], m: T.mat === 'hornDark' ? 'horn' : T.mat });
  }
  const body = mesh(v, wound(v, f, add(T.root, scale(D, T.len * 0.42))));
  if (!glow) return body;
  // The ember at its root, on both faces: a lit rhombus a third of the way up, and a brighter one inside it.
  const decals: Disc[] = [];
  for (const sd of [1, -1]) {
    const o = sd * (th * 0.5 + 0.004) + (sd > 0 && fine ? 0 : 0);
    for (const [k, m, up] of [[0.72, 'ember', 0.28], [0.3, 'flame', 0.1]] as Array<[number, Mat, number]>) {
      const q = [[0, -0.02], [k, up * 0.45], [0, up], [-k, up * 0.45]].map(([u, vv]) => add(T.root, add(add(scale(U, u * w * (sd > 0 && fine ? 0.8 : 1)), scale(D, vv * T.len)), scale(N, o))));
      decals.push(facingDisc(q, scale(N, sd), m, true));
    }
  }
  return merge(body, paint(decals));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Kilnlet's headbutt, the Terrabrick's tail swipe, the Kilnspire's stamp. */
export const KILN_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** When the Kilnspire's tail comes down after its stamp, as a share of the strike. */
export const KILNSPIRE_SLAM = 0.7;
/**
 * A go at its task, as shares of it: the unfired pot taken up from the ground; the kiln's door swinging open; the pot pushed into
 * the kiln's mouth; the fired pot taken from it; the door shut; and the fired pot set down.
 */
export const KILN_WORK = { pick: 0.16, open: 0.24, push: 0.42, grab: 0.6, shut: 0.74, set: 0.86 } as const;

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
}

interface Rest {
  /** Each hip and shoulder, in the body's frame; each ankle standing, along the ground. */
  hip: V3[]; ankle: V3[];
  reach: number[];
}

const rests = new Map<Kiln, Rest>();
function restOf(s: Kiln): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], ankle: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    // Each foot well out to the side of its hip, a lizard's sprawl, ahead of a shoulder and behind a hip.
    const dy = (fore ? 1 : -1) * s.reachOut[fore ? 0 : 1] * (B.y[B.y.length - 1] - B.y[0]);
    ankle.push([SIDE[i] * r.w * s.spread, y + dy, L[2]]);
    reach.push(L[0] + L[1]);
  }
  const R = { hip, ankle, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Kiln, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], jaw: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])], jaw: m(a.jaw, b.jaw),
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
    jaw: d(p.jaw, to.jaw, from.jaw),
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

/** The diagonals together, as a lizard walks: the left fore with the right hind, and the right fore with the left hind. */
const BEATS = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Going: a lizard's sprawling walk, the diagonals together. Each foot down for its share of a stride and swept back under the
 * body at the ground's own speed, then brought round and forward through the air; the body twisting from side to side over its
 * feet and the tail swinging against it, the head held steady against the twist; sinking a little onto each pair of feet as they
 * come down. The Kilnspire sinks and rolls further onto each pair, its weight on them.
 */
function goingPlan(s: Kiln, R: Rest, a: Anim): Plan {
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
    // Swung round in an arc out from the body as it comes forward, as a lizard's foot is, and lifted.
    const outward = 0.07 * L * Math.sin(Math.PI * u);
    p.at[i] = [A[0] + SIDE[i] * outward, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = (i < 2 ? -14 : -20) * Math.sin(Math.PI * u) ** 2;
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - duty * 0.15));
  p.H += s.len * (-G.bob * (1 - 0.4 * g) * down + g * (0.03 + 0.02 * Math.max(0, Math.sin(2 * TAU * (w - 0.1)))));
  const wave = waveOf(s, a);
  p.neck[1] = -wave * 0.7;
  p.head[1] = -wave * 0.3;
  p.roll = G.roll * Math.sin(TAU * w);
  p.tail = [g * 20, -wave * 1.2, g * -4];
  p.neck[0] = 8 * g;
  // The head bobbed against the shoulders, more on the little one so it reads at the size the island is played at.
  p.head[0] = [7, 4, 2.5][s.stage] * (2 * down - 1) - 4 * g;
  // The Kilnspire's chest pitched down onto each pair of feet as they land: a heavy, deliberate tread.
  p.pitch = g * (2 + 2 * Math.sin(2 * TAU * w)) + (s.stage === 2 ? -1.6 * down : 0);
  return p;
}

/**
 * How far its spine is bent from side to side this moment, in degrees at either end of it: as it goes, a wave once a stride,
 * concave on the side whose fore foot is back; nought standing and at its acts.
 */
function waveOf(s: Kiln, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return -smooth(Math.min(1, a.go)) * lerp(s.gait.wave[0], s.gait.wave[1], a.gait) * Math.cos(TAU * frac(a.u));
}
/** How far the spine is turned at `y` along it, bent `deg` at either end: by as much of it as how far from the middle it is. */
const bendAt = (s: Kiln, y: number, deg: number): number => deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
/** A point in the trunk's frame where the spine's bend puts it. */
function bendPt(s: Kiln, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = bendAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
}

/** How far its tongue is out this moment, nought to one: a quick flick now and then as it stands. */
const tongueOf = (a: Anim): number => (a.act || a.go > 0 ? 0 : Math.max(beat(a.t, [3.1, 3.5, 14.2, 20.6, 21], 0.32)));

/**
 * Standing about: breathing, looking about, its tail swaying and curling; now and then its head tilted to one side, curious, and a
 * flick of its tongue.
 */
function stillPlan(s: Kiln, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [2 * cyc(t, 5), 8 * look, 4 * drift(t, 2)];
  p.tail = [3 * cyc(t, 3, 1), 9 * cyc(t, 4), 5 * cyc(t, 2, 0.6)];
  p.H += 0.012 * s.len * (a.breath - 0.5);
  // A curious tilt of the head, held a while.
  const tilt = beat(t, [8.4, 17.2], 1.8);
  p.head[2] += 18 * tilt;
  p.head[0] += 6 * tilt;
  p.neck[0] -= 4 * tilt;
  // A look back over its shoulder at its tail.
  const over = beat(t, [12.5], 2.4);
  p.neck[1] += 30 * over;
  p.head[1] += 28 * over;
  p.tail[1] -= 14 * over;
  p.jaw = 4 * tongueOf(a);
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Kilnlet's headbutt: rocked back on its haunches with its head tucked, then thrown forward onto its fore feet, and back. */
function headbutt(s: Kiln, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = KILN_HITS[0];
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
  p.tail = [14 * back + 6 * jolt, 0, 6 * back];
  return p;
}

/** How far round the Terrabrick's tail is through its swipe: drawn round one way, then whipped round the other, and back. */
function swipeOf(t: number): number {
  const hit = KILN_HITS[1];
  if (t < 0.22) return -0.45 * smooth(t / 0.22);
  if (t < 0.4) return -0.45;
  if (t < hit) return lerp(-0.45, 1, ((t - 0.4) / (hit - 0.4)) ** 1.4);
  return 1 - ramp(t, hit + 0.1, 1);
}
/** The Terrabrick's tail swipe: braced on its fore feet, its hindquarters swung round and its tail whipped across in front of it. */
function swipe(s: Kiln, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), k = swipeOf(t), hit = KILN_HITS[1];
  const jolt = hump(t, hit + 0.02, 0.06);
  p.yaw = 26 * k;
  p.surge = s.len * 0.05 * Math.abs(k);
  p.side = s.len * 0.5 * Math.sin(26 * k * DEG);
  p.neck = [6 * Math.abs(k), -22 * k];
  p.head = [4 * jolt, -20 * k, -6 * k];
  const engage = ramp(t, 0, 0.2) * (1 - ramp(t, 0.8, 1));
  p.tail = [engage * (10 + 8 * Math.sin(Math.PI * clamp(t / hit))), 62 * k, engage * (4 * jolt - 8)];
  p.roll = -5 * k;
  p.squash = 0.06 * jolt;
  for (const i of [2, 3]) {
    const A = R.ankle[i], yaw = 26 * k * DEG, piv: V3 = [0, R.ankle[0][1], 0];
    const d = sub(A, piv), turned: V3 = [piv[0] + d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), piv[1] + d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw), A[2]];
    const lift = R.reach[i] * 0.2 * Math.max(hump(t, 0.16, 0.12), hump(t, hit - 0.06, 0.08), hump(t, 0.82, 0.12));
    p.at[i] = [turned[0], turned[1], A[2] + lift];
  }
  return p;
}

/** The Kilnspire's stamp: it rears its forequarters up and brings both fore feet down together, its tail lifted and slammed down after. */
function stamp(s: Kiln, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = KILN_HITS[2];
  const top = hit - 0.12, peak = top - 0.18;
  const rear = t < peak ? smooth(t / peak) : t < top ? 1 : 1 - clamp((t - top) / (hit - top)) ** 2;
  const land = hump(t, hit + 0.04, 0.1), shake = t > hit ? Math.sin((t - hit) * 34) * (1 - ramp(t, hit, 0.9)) : 0;
  p.pitch = 20 * rear - 2 * land;
  p.H += s.len * (0.06 * rear - 0.03 * land) + 0.02 * shake;
  p.surge = -s.len * 0.05 * rear;
  p.neck = [-12 * rear + 12 * land, 0];
  p.head = [10 * rear - 10 * land, 0, 3 * shake];
  p.squash = 0.07 * land;
  p.roll = 1.5 * shake;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 1.05, A[1] + R.reach[i] * 0.15, A[2] + R.reach[i] * 0.6];
    if (t < top) p.at[i] = mixV(A, high, smooth(Math.min(1, t / peak)));
    else if (t < hit) p.at[i] = mixV(high, A, ((t - top) / (hit - top)) ** 2);
    p.foot[i] = 16 * rear;
  }
  const slam = KILNSPIRE_SLAM;
  const up = ramp(t, 0.05, peak) * (1 - ramp(t, slam - 0.08, slam));
  p.tail = [24 * up - 10 * hump(t, slam + 0.03, 0.06), 0, 6 * up];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** Numbers its task needs, worked out the first time it is posed: how far it bows to the ground for a pot and to the kiln's mouth, and where they are. */
interface Work {
  ready: boolean;
  /** How far down it is bowed to take a pot from the ground and to reach into the kiln's mouth (`bowed`). */
  pick: number; push: number;
  /** Where the unfired pot stands at the start, where the fired one is set down, and the kiln, all on the ground. */
  potIn: V3; potOut: V3; kiln: V3;
  /** Where in the kiln's frame a pot stands inside its mouth. */
  inside: V3;
}
const works = new Map<Kiln, Work>();
const workOf = (s: Kiln): Work => {
  let W = works.get(s);
  if (!W) { W = { ready: false, pick: 0.6, push: 0.4, potIn: [0, 0, 0], potOut: [0, 0, 0], kiln: [0, 0, 0], inside: [0, 0, 0] }; works.set(s, W); }
  return W;
};
/** How far it turns to its left to take the unfired pot from the ground, and to its right to set the fired one down, in degrees. */
const TURN = [52, 48, 44];

/**
 * Bowed `b` of the way down (one, about as far as it goes): the neck bent forward, the head pitched down and the body tipped onto
 * its fore legs, by stage -- the Kilnspire, upright, bending its long neck the most.
 */
function bowed(s: Kiln, p: Plan, b: number, yaw: number): void {
  const N = [26, 46, 62][s.stage], Hd = [22, 30, 36][s.stage], P = [8, 9, 7][s.stage];
  p.neck[0] += N * b;
  p.head[0] -= Hd * b;
  p.pitch -= P * b;
  p.H -= s.len * 0.03 * b;
  p.neck[1] += yaw * 0.6;
  p.head[1] += yaw * 0.35;
  p.yaw += yaw * 0.12;
}

/**
 * A go at its task: the unfired pot taken up from the ground on its left; a look to the kiln as its door swings open; the pot
 * pushed into the mouth, its head lunging in; drawn back; in again for the fired pot and out with it; and the fired pot set down
 * on its right as the door shuts.
 */
function workPlan(s: Kiln, R: Rest, t: number): Plan {
  const p = restPlan(s, R), W = workOf(s), K = KILN_WORK, turnBy = TURN[s.stage];
  // Keys through the go: when, how far it is turned to its left, how far bowed, how far it lunges forward.
  const keys: Array<[number, number, number, number]> = [
    [0, 0, 0, 0], [0.06, turnBy * 0.5, W.pick * 0.4, 0], [K.pick, turnBy, W.pick, 0], [0.28, 0, W.push * 0.5, 0],
    [K.push - 0.04, 0, W.push, 0.8], [K.push, 0, W.push, 1], [0.5, 0, W.push * 0.7, 0.2], [K.grab, 0, W.push, 1],
    [0.7, 0, W.push * 0.55, 0], [K.set, -turnBy, W.pick, 0], [0.95, -turnBy * 0.3, W.pick * 0.2, 0], [1, 0, 0, 0],
  ];
  let q = 0;
  while (q < keys.length - 2 && keys[q + 1][0] <= t) q++;
  const a0 = keys[q], a1 = keys[q + 1], k = smooth((t - a0[0]) / (a1[0] - a0[0]));
  const yaw = lerp(a0[1], a1[1], k), b = lerp(a0[2], a1[2], k), lunge = lerp(a0[3], a1[3], k);
  bowed(s, p, b, yaw);
  p.surge += s.len * 0.14 * lunge;
  p.neck[0] += 6 * lunge;
  // Its jaws open as it takes a pot and lets one go.
  p.jaw = 10 * Math.max(hump(t, K.pick - 0.03, 0.05), hump(t, K.push + 0.02, 0.05), hump(t, K.grab - 0.03, 0.05), hump(t, K.set + 0.02, 0.05));
  // The tail swaying with the turns, and lifted as it reaches in, eagerly.
  p.tail = [6 * lunge, -0.4 * yaw, 4 * lunge];
  // A fore foot shifted under it as it turns to each side.
  const i = yaw > 0 ? 0 : 1, A = R.ankle[i], step = Math.abs(yaw) / turnBy;
  p.at[i] = [A[0], A[1] + s.len * 0.04 * step, A[2] + R.reach[i] * 0.12 * Math.sin(Math.PI * step)];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Kiln, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.64, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += s.len * (-0.03 * hunch + 0.015 * up);
  p.pitch = -3 * hunch + 3 * up;
  p.neck = [12 * hunch - 12 * up, 0];
  p.head = [-10 * hunch + 16 * up, 0, 9 * shake];
  p.roll = 3 * shake;
  p.tail = [-6 * hunch + 16 * up, 10 * shake, 8 * up];
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Kiln, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([headbutt, swipe, stamp][s.stage](s, R, a, act.t));
  // At its task it looks where it works and not about, so its jaws come to the pot and the kiln's mouth.
  if (act?.kind === 'work') return mixPlan(stillPlan(s, R, a), workPlan(s, R, act.t), downOf(act.t, a.graze));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, R, a), workPlan(s, R, 0.5), a.graze);
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** The middle of the snout, in the head's frame: out of the lower front of the skull, rounded and forward. */
const snoutAt = (s: Kiln): V3 => { const H = s.head; return [0, H.r[1] * 0.55 + H.snout[2] * 0.3, H.up - H.r[2] * 0.3]; };
const snoutTip = (s: Kiln): V3 => { const c = snoutAt(s); return [0, c[1] + s.head.snout[2] * 0.92, c[2] - s.head.snout[1] * 0.2]; };
/** The middle of the skull, in the head's frame. */
const skullAt = (s: Kiln): V3 => [0, 0, s.head.up];

/**
 * A leg bent to put its ankle at `ankle`: the knee out and up from the body, always the same way round -- the Kilnlet's well out
 * to the side, a sprawl; the bigger ones' tucked in under them, standing upright.
 */
function legOf(s: Kiln, body: Xf, i: number, hipLocal: V3, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const hip = place(body, hipLocal), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = Math.hypot(d[0], d[1], d[2]);
  const most = (l0 + l1) * 0.985, least = Math.abs(l0 - l1) + 0.08 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit([SIDE[i] * [1, 0.35, 0.3][s.stage], fore ? -1.2 : 0.4, s.knee]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const frame = (from: V3, to: V3): [V3, V3, V3] => frameOf(sub(from, to), fwd);
  const [X0, Y0, Z0] = frame(hip, knee), [X1, Y1, Z1] = frame(knee, at);
  const head = unit([fwd[0] + SIDE[i] * 0.45 * fwd[1], fwd[1] - SIDE[i] * 0.45 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the body, each link on from the one before it, curled up and swung. */
function tailBones(s: Kiln, body: Xf, lift: number, yaw: number, curl: number, wave = 0, lag = 0): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, bendPt(s, T.at, wave), -(T.lift + lift), 0, yaw * 0.4 + bendAt(s, T.at[1], wave) + (T.side ?? 0));
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl * (0.35 + 1.3 * (q / n)) + curl + (q >= n - 3 ? T.tip : 0)), 0, (yaw * 0.6) / (n - 1) + (q >= n - 3 ? lag / 3 : 0));
    out.push(prev);
  }
  return out;
}

/**
 * The flakes floating off the end of its tail: each on from the last, carrying on the tail's curl, a gap between, each bobbing
 * and turning on its own a little, and trailing as it goes.
 */
function flakeBones(s: Kiln, last: Xf, a: Anim, lag: number): Xf[] {
  const T = s.tail, F = s.flakes, out: Xf[] = [];
  let prev = joint(last, [0, -T.links[T.links.length - 1], 0], 0);
  for (let q = 0; q < F.count; q++) {
    prev = joint(prev, [0, -F.gap * (q ? 1 : 0.7), 0], -(T.curl + T.tip * 0.45), 0, lag * 0.5);
    const bob = F.len * 0.35 * cyc(a.t, 3 + q, q * 1.9), sway = 14 * cyc(a.t, 2 + q, q * 2.6);
    out.push(joint(prev, [F.len * 0.12 * cyc(a.t, 4, q), 0, bob], 8 * cyc(a.t, 3, q + 1), sway, 10 * cyc(a.t, 5, q * 0.7)));
  }
  return out;
}

/** The kiln's door: how far open it is through a go, nought shut to one. */
const doorOf = (t: number): number => ramp(t, KILN_WORK.open - 0.06, KILN_WORK.open + 0.04) * (1 - ramp(t, KILN_WORK.shut - 0.04, KILN_WORK.shut + 0.04));

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, every leg bent to put its foot where the pose
 * says, the neck and head carried on the body, the tail in links and its flakes, and at its task the kiln, its door and the two
 * pots, where each is through the go.
 */
function kilnBones(s: Kiln): (a: Anim) => Bones {
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
    flakeBones(s, tail[tail.length - 1], a, lag).forEach((x, q) => { b[`flake${q}`] = x; });
    for (let i = 0; i < 4; i++) {
      const g = P.at[i];
      const [u, l, f] = legOf(s, body, i, bendPt(s, R.hip[i], wave), [g[0], g[1], Math.max(g[2], (i < 2 ? s.fore : s.hind)[2])], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    // Its tongue, out of the front of its mouth as far as it is flicked.
    const tk = tongueOf(a);
    if (tk > 0.01) {
      const tip = snoutTip(s), h = b.head, m = h.m;
      b.tongue = { m: [m[0], m[1] * tk, m[2], m[3], m[4] * tk, m[5], m[6], m[7] * tk, m[8]], t: place(h, [0, tip[1] - s.head.snout[2] * 0.2, tip[2] - s.head.snout[1] * 0.25]) };
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  const W = workOf(s), K = KILN_WORK, [potR, potH] = s.kiln.pot;
  /** Where a pot held in its jaws hangs: its rim at the tip of its snout, upright. */
  const heldAt = (b: Bones): V3 => { const p = place(b.head, snoutTip(s)); return [p[0], p[1], p[2] + potR * 0.15]; };
  const prepare = (): void => {
    W.ready = true;
    const tipAt = (t: number): V3 => {
      const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t } };
      return heldAt(pose(workPlan(s, R, t), a));
    };
    // How far it bows to take a pot from the ground: as far as brings its jaws down to a pot's rim, found by halving.
    let lo = 0, hi = 1.8;
    for (let q = 0; q < 18; q++) {
      W.pick = (lo + hi) / 2;
      if (tipAt(K.pick)[2] > potH) lo = W.pick; else hi = W.pick;
    }
    W.pick = (lo + hi) / 2;
    const pin = tipAt(K.pick), pout = tipAt(K.set);
    W.potIn = [pin[0], pin[1], potH];
    W.potOut = [pout[0], pout[1], potH];
    // How far it bows to the kiln: as far as brings a pot in its jaws to the middle of the kiln's mouth; and the kiln put in front
    // of it there, its mouth facing it.
    const mouthZ = s.kiln.r * MOUTH[1] + potH;
    lo = -0.6; hi = 1.6;
    for (let q = 0; q < 18; q++) {
      W.push = (lo + hi) / 2;
      if (tipAt(K.push)[2] > mouthZ) lo = W.push; else hi = W.push;
    }
    W.push = (lo + hi) / 2;
    const at = tipAt(K.push);
    W.kiln = [0, at[1] + s.kiln.r * 0.82, 0];
    W.inside = [at[0], -s.kiln.r * 0.82 + potR * 0.6, s.kiln.r * MOUTH[1]];
  };
  return (a) => {
    if (!W.ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go }), wave = waveOf(s, a);
    const lag = a.act || a.go <= 0 ? 0 : -7 * smooth(Math.min(1, a.go)) * Math.cos(TAU * (frac(a.u) - 0.18));
    const b = pose(P, a, wave, lag);
    if (a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
      const t = a.act?.kind === 'work' ? a.act.t : 0.5;
      const g = Math.max(0.001, a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze);
      b.kiln = upright(W.kiln, g);
      b.door = joint(b.kiln, [s.kiln.r * MOUTH[0] * 1.05, -s.kiln.r * 0.93, 0], 0, 0, -105 * doorOf(t));
      const held = upright(heldAt(b));
      // The unfired pot: on the ground on its left, grown in as the go starts; in its jaws from when they close on it; pushed into
      // the kiln's mouth and on in out of sight.
      const into = upright(place(b.kiln, add(W.inside, [0, s.kiln.r * 0.5 * ramp(t, K.push + 0.02, K.push + 0.1), 0])));
      b.pot0 = t < K.pick ? upright(W.potIn, ramp(t, 0.0, 0.07)) : t < K.push ? held : into;
      // The fired pot: in its jaws from when it takes it from the kiln, set down on its right, and taken away to the stores.
      b.pot1 = t < K.set ? held : upright(W.potOut, 1 - ramp(t, 0.93, 1));
    }
    return b;
  };
}

/** Where the kiln's mouth is, as shares of its radius: how wide either side of its middle, and how high its middle and its top. */
const MOUTH = [0.36, 0.34, 0.62] as const;

/* ---- where its tiles go ------------------------------------------------------------------------ */

/** A tile on a bone. */
interface Placed extends Tile { bone: 'trunk' | 'head' | 'neck' | 'tail'; link?: number; small?: boolean }

/** Every tile on a stage, worked out once: the crest or mane on its head, the nape of its neck, its back's ridge, its armour and its tail. */
const layouts = new Map<Kiln, Placed[]>();
function tilesOf(s: Kiln): Placed[] {
  const had = layouts.get(s);
  if (had) return had;
  const out: Placed[] = [];
  const B = s.body, H = s.head, C = skullAt(s), Cr = s.crest;
  const th = (len: number): number => Math.max(0.028, Math.min(0.09, len * 0.075));
  // The crest: a fan of broad tiles out of the back of the skull, from up and back over the crown round to pointing back down the
  // nape, a sunburst seen from the side, every one leaning back so none stands up over the brow like a horn and none comes forward
  // of the eyes; each tipped out a little to one side and the next to the other.
  const fan = (count: number, len: number, arc: readonly [number, number], splay: number): void => {
    for (let q = 0; q < count; q++) {
      const u = count > 1 ? q / (count - 1) : 0.5, phi = lerp(arc[0], arc[1], u) * DEG, sd = q % 2 ? -1 : 1;
      const dir = unit([sd * splay, -Math.sin(phi), Math.cos(phi)]), sweep: V3 = [0, -Math.cos(phi), -Math.sin(phi)];
      const e = onEgg(C, H.r, unit([sd * 0.3, -Math.sin(phi) - 0.45, Math.cos(phi) * 0.85]));
      const L = len * (1 - 0.7 * Math.abs(u - 0.4)) * (0.92 + 0.16 * jitter(q + count * 7));
      out.push({ bone: 'head', root: add(e.p, scale(e.n, -L * 0.08)), dir, face: unit(cross(sweep, dir)), len: L, wide: Cr.wide, thick: th(L), mat: 'hornDark' });
    }
  };
  fan(Cr.count, Cr.len, Cr.arc, [0.2, 0.12, 0.16][s.stage]);
  // And a ring of broad tiles round the back of its head, radiating out and back from behind its eyes, so from in front they frame
  // the face rather than standing over it edge on: on the Kilnlet a few over the crown, on the Terrabrick round its crown and down
  // to its cheeks, and on the Kilnspire all the way round under its jaw, a mane, a fan from in front and a ruff from the side.
  const span = [42, 72, 118][s.stage];
  for (let q = 0; q < Cr.inner; q++) {
    const u = q / Math.max(1, Cr.inner - 1), a = lerp(-span, span, u) * DEG, radial: V3 = [Math.sin(a), 0, Math.cos(a)];
    const e = onEgg(C, H.r, unit([radial[0] * 0.7, -0.62, radial[2] * 0.7 + 0.05]));
    const dir = unit(add(scale(radial, 0.9), [0, -0.75, 0])), tangent: V3 = [Math.cos(a), 0, -Math.sin(a)];
    const L = Cr.len * [0.9, 0.8, 0.82][s.stage] * (1 - 0.3 * Math.abs(u - 0.5)) * (0.92 + 0.16 * jitter(q + 31));
    out.push({ bone: 'head', root: add(e.p, scale(e.n, -L * 0.1)), dir, face: unit(cross(dir, tangent)), len: L, wide: Cr.wide, thick: th(L), mat: 'hornDark', small: s.stage === 2 && Math.abs(u - 0.5) > 0.42 });
  }
  // Down the back of its neck: the Kilnlet's one small tile; the Terrabrick's a short row; the Kilnspire's mane going on down it in
  // a pair of rows fanned out either side, longest at the top.
  const N = s.neck;
  for (let q = 0; q < s.nape.count; q++) {
    const f = s.nape.count > 1 ? q / (s.nape.count - 1) : 0.5, z = lerp(N.len * 0.85, N.len * 0.05, f), w = lerp(N.w[1], N.w[0], z / N.len < 0 ? 1 : 1 - z / N.len);
    const L = s.nape.len * (1 - 0.35 * f);
    const sides = s.stage === 2 ? [-1, 1] : [q % 2 ? -1 : 1];
    for (const sd of sides) {
      const ang = sd * (s.stage === 2 ? 44 : 8) * DEG, root: V3 = [Math.sin(ang) * w * 0.8, -Math.cos(ang) * w * 0.85, z];
      const dir = unit([Math.sin(ang) * 1.1, -1, 0.3]);
      out.push({ bone: 'neck', root, dir, face: unit([1, sd * 0.35, 0]), len: L, wide: s.ridge.wide, thick: th(L), mat: 'hornDark' });
    }
  }
  // The ridge: broad tiles along its spine, overlapping like shingles, each leaning back -- further toward the rump -- and tipped out a
  // little to one side and the next to the other, longest where the stage carries them highest and shorter at the rump and shoulders.
  const Rg = s.ridge, y0 = B.y[5] - 0.02, y1 = B.y[0] + 0.12;
  for (let q = 0; q < Rg.count; q++) {
    const f = q / Math.max(1, Rg.count - 1), y = lerp(y0, y1, f), sd = q % 2 ? -1 : 1;
    const at = onRings(B, y, Math.PI / 2 + sd * 0.1);
    const k = 1 - Math.abs(1 - f - Rg.peak) / Math.max(Rg.peak, 1 - Rg.peak);
    const L = lerp(Rg.len[0], Rg.len[1], smooth(clamp(k * 1.1))) * (0.94 + 0.12 * jitter(q + 40));
    const back = lerp(0.2, 1.3, f) + 0.12 * (jitter(q + 60) - 0.5), dir = unit([sd * 0.16, -back, 1]);
    out.push({ bone: 'trunk', root: add(at.p, scale(at.n, -L * 0.08)), dir, face: [1, 0, sd * -0.2], len: L, wide: Rg.wide, thick: th(L), mat: 'hornDark' });
  }
  // Flat tiles overlapping over its shoulders and down its upper flanks behind them, shingled back in two rows, as armour.
  const Ar = s.armour;
  for (let q = 0; q < Ar.count; q++) {
    for (const sd of [1, -1]) {
      const row = q % 2, y = lerp(B.y[5] + 0.05, B.y[4] - 0.2 * s.len, Math.floor(q / 2) / Math.max(1, Math.ceil(Ar.count / 2) - 1)) - row * Ar.size * 0.5;
      const at = onRings(B, y, sd > 0 ? 0.7 - row * 0.38 : Math.PI - (0.7 - row * 0.38));
      const L = Ar.size * (0.9 + 0.2 * jitter(q * 3 + sd));
      const dir = unit(sub([0, -1, -0.2], scale(at.n, dot([0, -1, -0.2], at.n))));
      out.push({ bone: 'trunk', root: add(at.p, scale(at.n, L * 0.08)), dir, face: at.n, len: L, wide: 0.7, thick: th(L) * 0.8, mat: 'hornDark', small: true });
    }
  }
  // A tile standing on the top of each link of the tail, smaller toward its tip.
  const T = s.tail;
  T.links.forEach((L0, q) => {
    const k = 1 - q / T.links.length, L = T.tile * (0.45 + 0.55 * k);
    out.push({ bone: 'tail', link: q, root: [0, -L0 * 0.35, T.w[q] * 0.75], dir: unit([0, -0.8, 0.75]), face: [1, 0, 0], len: L, wide: 0.72, thick: th(L), mat: 'hornDark', small: q % 2 === 1 });
  });
  layouts.set(s, out);
  return out;
}

/* ---- what it is made of ------------------------------------------------------------------------- */

/** Whether a point on the barrel is in the cream: under a line a little below the middle of its flank, rising toward the chest. */
const creamAt = (s: Kiln, c: V3): boolean => { const r = ringAt(s.body, c[1]); return c[2] < r.z + r.h * lerp(0.08, 0.4, clamp((c[1] - s.body.y[4]) / (s.body.y[6] - s.body.y[4]))) && c[1] > s.body.y[0] + 0.02; };

/** The barrel: its skin, the cream of its belly and chest, a chest swell under the throat, and its speckles. */
function barrelOf(s: Kiln, n: number, lod: number): Mesh {
  const B = s.body;
  const skin = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(skin.v, skin.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, skin.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return creamAt(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  // The chest: a cream swell at the front of the barrel under the throat, down between the fore legs.
  const cy = lerp(B.y[5], B.y[6], 0.7), cr = ringAt(B, B.y[5]);
  const chestC: V3 = [0, cy, cr.z - cr.h * 0.3], chestR: V3 = [cr.w * 0.92, (B.y[6] - B.y[5]) * 1.5, cr.h * 0.8];
  const chest = orb(chestC, chestR, n, 5, 'belly');
  return merge(body, chest, paint(speckles(s, lod)), paint(seams(s)));
}

/**
 * Its speckles: blotches of darker clay over its back and flanks, of every size, and a few of its skin's red out on the cream of
 * its belly's edge, as the reference has; each laid on the barrel's own curve.
 */
function speckles(s: Kiln, lod: number): Disc[] {
  const B = s.body, out: Disc[] = [], count = lod ? s.spots : Math.round(s.spots * 0.5);
  for (let q = 0; q < count; q++) {
    const y = lerp(B.y[1] + 0.05, B.y[5], jitter(q * 3 + 1));
    const sd = q % 2 ? 1 : -1, round = lerp(-0.75, 1.35, jitter(q * 3 + 2));
    const at = onRings(B, y, sd > 0 ? round : Math.PI - round);
    const inCream = creamAt(s, at.p);
    const r = B.w[3] * (0.05 + 0.07 * jitter(q * 3 + 3)) * (inCream ? 0.8 : 1);
    out.push(disc(add(at.p, scale(at.n, 0.012)), at.n, r, r * (0.7 + 0.3 * jitter(q + 9)), 6, inCream ? 'coat' : jitter(q + 5) < 0.75 ? 'coatDark' : 'coatLight', { spin: jitter(q) * 3, up: [0, 1, 0] }));
  }
  return out;
}

/** The ember along its spine: a lit strip on the skin under the ridge, from its shoulders to the root of its tail, glowing between the tiles. */
function seams(s: Kiln): Disc[] {
  const B = s.body, out: Disc[] = [], y0 = B.y[5], y1 = B.y[0] + 0.08, n = 8;
  const half = B.w[3] * [0.14, 0.12, 0.11][s.stage];
  const pt = (y: number, sd: number, w: number): V3 => { const e = onRings(B, y, Math.PI / 2 + sd * w); return add(e.p, scale(e.n, 0.008)); };
  for (let q = 0; q < n; q++) {
    const a = lerp(y0, y1, q / n), b = lerp(y0, y1, (q + 1) / n);
    const w0 = half / B.w[3] * 1.6, n0 = onRings(B, (a + b) / 2, Math.PI / 2).n;
    out.push(facingDisc([pt(a, -1, w0), pt(b, -1, w0), pt(b, 1, w0), pt(a, 1, w0)], n0, 'ember', true));
    out.push(facingDisc([pt(a, -1, w0 * 0.45), pt(b, -1, w0 * 0.45), pt(b, 1, w0 * 0.45), pt(a, 1, w0 * 0.45)], n0, 'flame', true));
  }
  return out;
}

/** A mesh with every face that `under` says is in the cream painted cream, judged by its highest corner so the line is a ring. */
function creamUnder(m: Mesh, under: (p: V3) => boolean): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const top = f.i.reduce((t, i) => (m.v[i][2] > t[2] ? m.v[i] : t), m.v[f.i[0]]);
    return under(top) ? { ...f, m: 'belly' as Mat } : f;
  }));
}

/**
 * The head: a round skull, wide and a little flat, a size too big on the little one; a rounded snout out of the front of it; the
 * cream of the face under a line from the corner of the mouth back under the eye, running back under the jaw and down the throat;
 * a few speckles on the crown; the crest or mane; the eyes; and a soft smile.
 */
function headOf(s: Kiln, n: number, k: number, lod: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const sn = H.snout, snoutC = snoutAt(s), snoutR: V3 = [sn[0], sn[2], sn[1]];
  const eyeLow = onEgg(C, H.r, s.eye.dir).p[2] - C[2] - s.eye.size * 0.75;
  const faceLine = (y: number): number => lerp(-H.r[2] * 0.3, eyeLow, clamp(((y - C[1]) / H.r[1] + 0.55) / 0.8));
  const skull = creamUnder(orb(C, H.r, n + 4, k + 3, 'coat'), (p) => p[2] - C[2] < faceLine(p[1]));
  const snout = creamUnder(orb(snoutC, snoutR, n + 2, k + 2, 'coat'), (p) => p[2] < snoutC[2] + sn[1] * 0.45);
  // The tiles of its crest, on the head's own bone.
  const tiles = tilesOf(s).filter((T) => T.bone === 'head' && (lod || !T.small)).map((T) => tileMesh(T, !!lod));
  // A soft smile: a thin line round the front of the snout, turned up at its corners and run back along the jaw.
  const reachBack = [0.7, 0.85, 0.9][s.stage];
  const mouth = paint([lineOn(Array.from({ length: 9 }, (_, q) => {
    const x = (q / 8 - 0.5) * 2;
    return onEgg(snoutC, snoutR, [x * reachBack, 1 - 0.55 * Math.abs(x) * reachBack, -0.12 + 0.3 * x * x]);
  }), sn[0] * 0.035, 'lid')]);
  const nostrils = paint([1, -1].map((sd) => disc(add(onEgg(snoutC, snoutR, [sd * 0.3, 0.88, 0.5]).p, [0, 0.01, 0]), [sd * 0.2, 1, 0.5], sn[0] * 0.06, sn[0] * 0.045, 5, 'lid')));
  // Speckles of darker clay over its crown and the top of its snout.
  const spots: Disc[] = [];
  for (let q = 0; q < (lod ? 9 : 5); q++) {
    const sd = q % 2 ? 1 : -1, e = onEgg(C, H.r, unit([sd * (0.15 + 0.5 * jitter(q + 70)), -0.3 + 0.7 * jitter(q + 71), 0.85]));
    if (Math.abs(e.p[0]) > H.r[0] * 0.5 && e.p[1] > H.r[1] * 0.1) continue;
    const r = H.r[0] * (0.05 + 0.05 * jitter(q + 72));
    spots.push(disc(add(e.p, scale(e.n, 0.012)), e.n, r, r * 0.8, 6, 'coatDark', { spin: q }));
  }
  return merge(skull, snout, ...tiles, mouth, nostrils, paint(spots), eyesOf(s, shut));
}

/**
 * The eyes, set on the front of the skull and looking forward as much as out: each a dark rim, a big amber iris, a darker ring,
 * a dark middle and two glints, laid onto the skull's own curve. All of an eye goes out of sight together when the head is between
 * it and the viewer (`at`).
 */
function eyesOf(s: Kiln, shut: boolean): Mesh {
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
    out.push(onto(disc(p, n, r * 1.18, r * 1.18 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(add(p, scale(up, -r * 0.08)), n, r * 0.68, r * 0.7 * tall, 10, 'crystalDark', o), 0.02));
    const pu = 1;
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * 0.4 * pu, r * 0.5 * tall * pu, 8, 'eye', o), 0.024));
    // The bigger ones' lid: a line of its skin over the top of the eye, calm rather than wide.
    if (s.stage) out.push(onto(disc(add(p, scale(up, r * tall * 0.98)), n, r * 1.2, r * 0.3, 8, 'coat', o), 0.028));
    out.push(onto(disc(add(add(p, scale(up, r * 0.34 * tall)), scale(across, side * r * 0.3)), n, r * 0.3, r * 0.3, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.38 * tall)), scale(across, -side * r * 0.3)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the snout. */
function headSolids(s: Kiln): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.9) }, { c: snoutAt(s), r: [sn[0] * 0.85, sn[2] * 0.85, sn[1] * 0.85] }];
}

/** The neck: its skin, cream down its front from the throat to the chest, a few speckles, and its tiles down its back. */
function neckOf(s: Kiln, n: number, lod: number): Mesh {
  const N = s.neck, [w0, w1] = N.w;
  const m = tube([[0, 0, -0.3], [0, N.curve[0], N.len * 0.35], [0, N.curve[1], N.len * 0.7], [0, N.curve[2], N.len + 0.05]], [w0 * 1.04, lerp(w0, w1, 0.4), lerp(w0, w1, 0.75), w1], [w0 * 0.96, lerp(w0, w1, 0.4) * 0.94, lerp(w0, w1, 0.75) * 0.92, w1 * 0.92], n,
    'coat', { seam: 'both' });
  // Its throat cream down the front of it, the half toward its chin, and its skin down the back.
  const skin = mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length), w = lerp(w0, w1, clamp(c[2] / N.len));
    return c[1] > -w * 0.25 ? { ...f, m: 'belly' as Mat } : f;
  }));
  // The Kilnspire's down the sides of its neck have no ember painted on them, which seen from in front ran in two lines down its
  // throat; their light is the glow over them (`emberLights`).
  const tiles = tilesOf(s).filter((T) => T.bone === 'neck').map((T) => tileMesh(T, !!lod, s.stage < 2));
  const spots: Disc[] = [];
  for (let q = 0; q < (lod ? 2 + 3 * s.stage : 1 + s.stage); q++) {
    const z = N.len * (0.1 + 0.8 * jitter(q + 90)), ang = (q % 2 ? 1 : -1) * (0.5 + 0.7 * jitter(q + 91)), w = lerp(w0, w1, z / N.len);
    const nrm: V3 = [Math.sin(ang), -Math.cos(ang), 0];
    spots.push(disc([nrm[0] * w * 1.01, nrm[1] * w * 0.93, z], nrm, w * 0.12, w * 0.09, 6, 'coatDark', { spin: q }));
  }
  return merge(skin, ...tiles, paint(spots));
}

/** A foot: a broad flat paw of its skin, its toes splayed forward and out, a dark hooked claw on each. */
function footOf(s: Kiln, fore: boolean, n: number, k: number): Mesh {
  const L = fore ? s.fore : s.hind, w = s.thick * 0.85, drop = L[2];
  const pad = orbAlong([0, w * 0.3, -drop + w * 0.32], [0, 1, 0], [w * 0.95, w * 0.44, w * 1.05], n, k, 'belly');
  const toes: Mesh[] = [];
  const count = 4, len = w * [0.95, 1.0, 1.1][s.stage], thick = w * [0.2, 0.2, 0.22][s.stage];
  for (let q = 0; q < count; q++) {
    const a = ((q - (count - 1) / 2) / Math.max(1, count - 1)) * 1.25;
    const dir = unit([Math.sin(a), Math.cos(a), 0]), root: V3 = [Math.sin(a) * w * 0.62, w * 0.55 + Math.cos(a) * w * 0.45, -drop + w * 0.26];
    toes.push(taper([root, add(root, add(scale(dir, len * 0.45), [0, 0, len * 0.06])), add(root, add(scale(dir, len * 0.68), [0, 0, 0]))], thick, thick * 0.8, 5, 'belly'));
    // Its claw: dark, hooked down to a point off the end of the toe.
    const c0 = add(root, scale(dir, len * 0.62));
    toes.push(taper([c0, add(c0, add(scale(dir, len * 0.26), [0, 0, -len * 0.02])), add(c0, add(scale(dir, len * 0.4), [0, 0, -len * 0.2]))], thick * 0.75, w * 0.02, 4, 'claw'));
  }
  return merge(pad, ...toes);
}

/**
 * The tiles on a leg: on the bigger ones a few lying flat and overlapping over the shoulder or the haunch and down the upper leg,
 * as armour, and one down the front of the lower leg. In each part's own frame, where `[side, 0, 0]` is the top of a sprawled upper
 * leg and the outside of a lower one, and the bone runs down `-z`.
 */
function legTiles(s: Kiln, side: number, w: number, L: readonly number[], lowerPart: boolean, fine: boolean): Mesh[] {
  if (!s.stage) return [];
  const out: Mesh[] = [];
  const put = (root: V3, dir: V3, face: V3, len: number, mat: Mat): void => { out.push(tileMesh({ root, dir, face, len, wide: 0.8, thick: Math.max(0.02, len * 0.06), mat }, fine, false)); };
  if (!lowerPart) {
    const rows = 2;
    for (let q = 0; q < rows; q++) {
      const z = -L[0] * (0.1 + 0.3 * q), out3: V3 = unit([side, 0, 0.35 - 0.1 * q]);
      put(add([0, 0, z + w * 0.4], scale(out3, w * 1.08)), [0, 0, -1], out3, w * (2.0 - 0.25 * q), 'hornDark');
    }
    return out;
  }
  const front = unit([side * 0.5, 0.85, 0]);
  put(add([0, 0, -L[1] * 0.05], scale(front, w * 0.95)), [0, 0, -1], front, L[1] * 0.42, 'hornDark');
  return out;
}

/** The tail's links: each a tube of its skin, cream under its root, speckled, with its tile standing on top. */
function tailOf(s: Kiln, lod: number): Mesh[] {
  const T = s.tail, tiles = tilesOf(s).filter((P) => P.bone === 'tail');
  return T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)] * (q === T.links.length - 1 ? 0.55 : 1);
    const core = tube([[0, 0.04, 0], [0, -L * 0.5, 0], [0, -L - 0.02, 0]], [w0, (w0 + w1) / 2, w1], [w0 * 0.92, (w0 + w1) * 0.45, w1 * 0.92], 7,
      (ring, j) => (q < 4 && Math.abs(((j + 1) / 7) * TAU - Math.PI * 1.5) < 1.2 ? 'belly' : 'coat'), { seam: q === T.links.length - 1 ? 'start' : 'both' });
    const tile = tiles.find((P) => P.link === q);
    const spots = q % 2 === 0 ? paint([1, -1].map((sd) => disc([sd * w0 * 0.97, -L * 0.6, w0 * 0.1], [sd, 0, 0.3], w0 * 0.22, w0 * 0.16, 6, 'coatDark', { spin: q }))) : null;
    return merge(core, tile && (lod || !tile.small) ? tileMesh(tile, !!lod) : null, lod ? spots : null);
  });
}

/** A flake floating off the end of its tail: a little loose tile, glowing at its root. */
function flakeOf(s: Kiln, q: number, fine: boolean): Mesh {
  const F = s.flakes, L = F.len * (1 - 0.14 * q);
  return tileMesh({ root: [0, L * 0.4, 0], dir: [0, -1, 0.15], face: unit([0.6, 0, 1]), len: L, wide: 0.72, thick: Math.max(0.022, L * 0.12), mat: 'hornDark' }, fine);
}

/* ---- the kiln and its pots ------------------------------------------------------------------------ */

/**
 * A small beehive kiln of stone, built in its own frame on the ground, its mouth facing `-y`: a drum of fieldstone, a dome over
 * it, a stub of a chimney, courses painted round it, and the mouth an arch of darker stones with the fire glowing in it.
 */
function kilnOf(s: Kiln, n: number): Mesh {
  const R = s.kiln.r, wall = R * 0.68;
  const drum = tube([[0, 0, 0], [0, 0, wall * 0.5], [0, 0, wall]], [R * 1.02, R, R * 0.98], [R * 1.02, R, R * 0.98], n + 4, 'stone', { up: [0, 1, 0] });
  const dome = orb([0, 0, wall], [R * 0.98, R * 0.98, R * 0.82], n + 4, 5, 'stone');
  const chimney = tube([[0, R * 0.1, wall + R * 0.6], [0, R * 0.12, wall + R * 1.0]], R * 0.2, R * 0.2, 7, 'stoneDark', { up: [0, 1, 0] });
  // Courses of stone painted round the drum and the dome.
  const courses: Disc[] = [];
  const onDrum = (a: number, z: number, lift = 0.012): V3 => [Math.sin(a) * (R + lift), -Math.cos(a) * (R + lift), z];
  for (const z of [wall * 0.33, wall * 0.66]) {
    for (let q = 0; q < 16; q++) {
      const a0 = (q / 16) * TAU, a1 = ((q + 1) / 16) * TAU;
      if (Math.abs(Math.sin((a0 + a1) / 2)) < MOUTH[0] * 1.3 && Math.cos((a0 + a1) / 2) > 0) continue;
      courses.push(facingDisc([onDrum(a0, z - R * 0.012), onDrum(a1, z - R * 0.012), onDrum(a1, z + R * 0.012), onDrum(a0, z + R * 0.012)], [Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2), 0], 'stoneDark'));
    }
  }
  // The mouth: a dark arch, the fire inside it, and a bright heart low in it.
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

/** The kiln's door: an iron plate the shape of its mouth, hinged at its right edge, a ring for a handle. */
function doorOf3(s: Kiln): Mesh {
  const R = s.kiln.r, mw = R * MOUTH[0] * 1.1, mt = R * MOUTH[2] * 1.06, th = R * 0.05;
  const pts: V3[] = [];
  for (let q = 0; q <= 6; q++) { const a = Math.PI * (q / 6); pts.push([-mw + Math.cos(a) * mw, 0, mt - mw + Math.sin(a) * mw]); }
  pts.push([-2 * mw, 0, 0.02], [0, 0, 0.02]);
  const v: V3[] = [...pts.map((p) => [p[0], p[1] - th, p[2]] as V3), ...pts.map((p) => [p[0], p[1] + th * 0.2, p[2]] as V3)];
  const n = pts.length, f: Face[] = [{ i: pts.map((_, j) => j), m: 'metal' }, { i: pts.map((_, j) => n + j), m: 'metal' }];
  for (let j = 0; j < n; j++) f.push({ i: [j, (j + 1) % n, n + ((j + 1) % n), n + j], m: 'metal' });
  const plate = mesh(v, wound(v, f, [-mw, 0, mt * 0.5]));
  const ring = orb([-mw * 1.6, -th * 1.6, mt * 0.45], R * 0.05, 6, 3, 'metalDark');
  return merge(plate, ring);
}

/** A pot, in its own frame with its rim's middle at the origin and its foot `h` under it: unfired pale clay, or fired terracotta with a darker rim. */
function potOf(r: number, h: number, fired: boolean, n: number): Mesh {
  const z = [0, 0.18, 0.45, 0.74, 0.9, 1].map((f) => f * h - h);
  const w = [0.62, 0.92, 1, 0.74, 0.56, 0.64].map((f) => f * r);
  const body = tube(z.map((zz) => [0, 0, zz] as V3), w, w, n, (ring) => (fired ? (ring >= 4 ? 'shellDark' : 'shell') : ring >= 4 ? 'spot' : 'cap'), { up: [0, 1, 0] });
  const mouth = paint([disc([0, 0, 0.004], [0, 0, 1], r * 0.5, r * 0.5, 8, 'stoneDark')]);
  return merge(body, mouth);
}

/* ---- a stage's pieces ------------------------------------------------------------------------------ */

function kilnBuild(s: Kiln, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 2, lod), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  const back = tilesOf(s).filter((T) => T.bone === 'trunk' && (lod || !T.small)).map((T) => tileMesh(T, !!lod));
  pieces.push({ key: 'back', mesh: merge(...back), bone: 'trunk', bias: 0.08, after: ['body'] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n + 3, lod), bone: 'neck', bias: 0, under: 'head' });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, lod, false), shut: headOf(s, n, k, lod, true), bone: 'head', bias: 0.2, hide });
  pieces.push({
    key: 'tongue', bone: 'tongue', bias: 0.19, after: ['head'], shown: (a) => tongueOf(a) > 0.01,
    mesh: merge(taper([[0, 0, 0], [0, s.head.snout[2] * 0.35, -s.head.snout[1] * 0.05], [0, s.head.snout[2] * 0.55, -s.head.snout[1] * 0.12]], s.head.snout[0] * 0.18, s.head.snout[0] * 0.1, 5, 'tongue', 0.5)),
  });
  tailOf(s, lod).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.01 }));
  for (let q = 0; q < (lod ? s.flakes.count : Math.min(s.flakes.count, 2 + s.stage)); q++) pieces.push({ key: `flake${q}`, mesh: flakeOf(s, q, !!lod), bone: `flake${q}`, bias: 0.02 });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const side3: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The shoulder or the haunch a round mass at the root of the upper leg, the upper leg out sideways from it to a round elbow or
    // knee, cream on its inside; then the lower leg down to the foot.
    const inner = (c: V3): boolean => c[0] * side < -w * 0.35 && c[2] < w * 0.2;
    const hw = !fore ? w * (s.stage ? 1.15 : 1.05) : w;
    const upperSkin = merge(orb([0, 0, hw * 0.1], scale([1.25, 1.3, 1.15], hw * (s.stage ? 1 : 0.88)), n + 1, k + 1, 'coat'), tube([[0, 0, 0], [0, 0, -L[0]]], [hw * 1.2, w * 0.95], [hw * 1.2, w * 0.95], n, 'coat', { seam: 'start' }), orb([0, 0, -L[0]], w * 0.98, n, k, 'coat'));
    const upper = merge(mesh(upperSkin.v, upperSkin.f.map((f) => (inner(scale(f.i.reduce((t, j) => add(t, upperSkin.v[j]), [0, 0, 0] as V3), 1 / f.i.length)) ? { ...f, m: 'belly' as Mat } : f))),
      lod ? paint([0, 1].map((q) => disc([side * hw * 1.18, (q - 0.5) * hw * 0.6, -L[0] * (0.25 + 0.35 * q)], [side, 0, 0.2], hw * 0.22, hw * 0.16, 6, 'coatDark', { spin: q + i }))) : null,
      ...legTiles(s, side, hw, L, false, !!lod));
    // The lower leg its skin down the outside and cream down the inside and the front, speckled with red, as its belly is.
    const shin = tube([[0, 0, w * 0.7], [0, 0.02, -L[1]]], [w * 0.95, w * 0.8], [w * 0.95, w * 0.8], n, 'coat', { seam: 'start' });
    const lower = merge(mesh(shin.v, shin.f.map((f) => {
      const c = scale(f.i.reduce((t, j) => add(t, shin.v[j]), [0, 0, 0] as V3), 1 / f.i.length);
      return c[0] * side < w * 0.25 ? { ...f, m: 'belly' as Mat } : f;
    })), ...legTiles(s, side, w, L, true, !!lod),
      paint([0, 1, 2].slice(0, lod ? 3 : 1).map((q) => { const a = (q * 2.1 + i) % TAU, d: V3 = [Math.cos(a), Math.sin(a), 0]; return disc([d[0] * w * 0.92, d[1] * w * 0.92, -L[1] * (0.25 + 0.25 * q)], d, w * 0.3, w * 0.24, 6, 'coat', { spin: q }); })));
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, after: ['body', 'back'], front: side3 },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}2`, mesh: footOf(s, fore, n, k), bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front: out3 },
    );
  }
  const working = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
  const workT = (a: Anim): number => (a.act?.kind === 'work' ? a.act.t : 0.5);
  const [pr, ph] = s.kiln.pot;
  pieces.push({ key: 'kiln', mesh: kilnOf(s, n), bone: 'kiln', bias: 0, shown: working });
  pieces.push({ key: 'door', mesh: doorOf3(s), bone: 'door', bias: 0.02, shown: working });
  // The unfired pot out of sight once it is well in; the fired one from when it is taken out.
  pieces.push({ key: 'pot0', mesh: potOf(pr, ph, false, n), bone: 'pot0', bias: 0.04, shown: (a) => working(a) && workT(a) < KILN_WORK.push + 0.1 });
  pieces.push({ key: 'pot1', mesh: potOf(pr, ph, true, n), bone: 'pot1', bias: 0.04, shown: (a) => working(a) && workT(a) >= KILN_WORK.grab - 0.01 });
  // Everything on the trunk bends with its spine as it goes (`waveOf`), as the legs, the neck and the tail come out of it.
  const bend = (v: readonly V3[], a: Anim): V3[] => { const w = waveOf(s, a); return w ? v.map((p) => bendPt(s, p, w)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/* ---- its light ------------------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** The ember's light, the same on every variant, and its hotter heart. */
const EMBER: RGB = [255, 132, 36];
const HOT: RGB = [255, 206, 110];

/** A soft light added over what is under it, `r` across at `al`. */
function light(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(0.45, css(c, al * 0.35));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * How brightly its ember glows this moment, one as it stands: breathing slowly brighter and dimmer, a turn every four seconds or
 * so; flaring as a blow lands, as the kiln's door opens on it, and to its height as it evolves.
 */
function glowOf(s: Kiln, a: Anim): number {
  let k = 1 + 0.28 * cyc(a.t, 6) + 0.08 * cyc(a.t, 17, 1.3);
  const act = a.act;
  if (act?.kind === 'strike') k += 0.9 * hump(act.t, KILN_HITS[s.stage] + 0.03, 0.18);
  if (act?.kind === 'work') k += 0.5 * doorOf(act.t);
  if (act?.kind === 'evolve') k += 1.4 * ramp(act.t, 0.1, 0.5) * (1 - ramp(act.t, 0.55, 0.9));
  return k;
}

/**
 * The light of its ember over its body: a soft glow at the root of every tile on the side toward the viewer, over its spine
 * between them, and round each flake -- all breathing with `glowOf`.
 */
function emberLights(g: CanvasRenderingContext2D, view: View, s: Kiln, b: Bones, a: Anim): void {
  const k = glowOf(s, a), wave = waveOf(s, a), T = view.T;
  g.save();
  g.globalCompositeOperation = 'lighter';
  // The tiles of its back are on top of it, and seen from every side the iso view has; the crest's and the nape's only from the
  // side they stand on, never through its head or its neck.
  // Nor through its neck from in front: a light behind the neck where the neck is drawn over it is hidden.
  const head = place(b.head, skullAt(s)), neck = place(b.neck, [0, 0, s.neck.len * 0.5]);
  const n0 = onScreen(view, place(b.neck, [0, 0, 0])), n1 = onScreen(view, place(b.neck, [0, s.neck.curve[2], s.neck.len]));
  const behindNeck = (p: V3): boolean => {
    if (dot(sub(p, neck), T) >= 0) return false;
    const [x, y] = onScreen(view, p), dx = n1[0] - n0[0], dy = n1[1] - n0[1];
    const u = clamp(((x - n0[0]) * dx + (y - n0[1]) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x - n0[0] - dx * u, y - n0[1] - dy * u) < lerp(s.neck.w[0], s.neck.w[1], u) * 0.9;
  };
  const show = (p: V3, n: V3, r: number, al: number, strict = false): void => {
    if ((strict && dot(sub(p, head), T) < 0) || behindNeck(p)) return;
    const face = strict ? clamp((dot(n, T) + 0.2) / 0.5) : clamp((dot(n, T) + 0.8) / 0.8);
    if (face <= 0) return;
    const [x, y] = onScreen(view, p);
    light(g, x, y, r * (0.85 + 0.15 * k), EMBER, clamp(al * face * k, 0, 0.7));
  };
  for (const P of tilesOf(s)) {
    if (P.small) continue;
    const xf = P.bone === 'tail' ? b[`tail${P.link}`] : b[P.bone];
    if (!xf) continue;
    const root = P.bone === 'trunk' ? bendPt(s, P.root, wave) : P.root;
    const p = place(xf, add(root, scale(unit(P.dir), P.len * 0.12)));
    show(p, turn(xf, unit(P.dir)), P.len * (P.bone === 'trunk' ? 0.6 : 0.32), P.bone === 'trunk' ? 0.26 : 0.08, P.bone === 'head' || P.bone === 'neck');
  }
  for (let q = 0; q < s.flakes.count; q++) {
    const xf = b[`flake${q}`];
    if (!xf) continue;
    show(place(xf, [0, 0, 0]), [0, 0, 1], s.flakes.len * 1.3, 0.24);
  }
  g.restore();
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Ash and dust; the colours of the chips of clay that fly off it. */
const DUST: RGB = [196, 178, 160];
const CHIP_RGB: readonly RGB[] = [[200, 104, 76], [238, 216, 186], [168, 82, 60]];

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Terrabrick's: less than in proportion on the small one, so they still read. */
const bigness = (s: Kiln): number => 0.5 + 0.5 * (s.len / 1.7);

/** A flake of clay tile in the air: a small rhombus, lit on its top half, dark-edged, never under a pixel and a half. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(mix(c, [60, 40, 36], 0.15), al);
  g.strokeStyle = css(mix(c, [50, 30, 26], 0.6), al);
  g.lineWidth = Math.max(r * 0.2, 0.1);
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(r * 0.6, 0);
  g.lineTo(0, r);
  g.lineTo(-r * 0.6, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = css(mix(c, [255, 248, 236], 0.3), al);
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(r * 0.6, 0);
  g.lineTo(-r * 0.6, 0);
  g.closePath();
  g.fill();
  g.restore();
}

/** A spark: a hot point with a soft light round it, gone by shrinking. */
function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, 1 / px);
  g.save();
  g.globalCompositeOperation = 'lighter';
  light(g, x, y, r * 4, EMBER, 0.5 * al);
  g.restore();
  g.fillStyle = css(HOT, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** A puff of dust or ash: a soft cloud of three lobes, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(base, [252, 246, 236], 0.2 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.42 : 0, lr = rr * (q ? 0.72 : 1);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6 - rr * 0.18 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, css(c, al * (q ? 0.7 : 1)));
    grad.addColorStop(0.55, css(c, al * 0.45 * (q ? 0.7 : 1)));
    grad.addColorStop(1, css(c, 0));
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
}

/** Sparks thrown from `from`, `since` seconds after, up and out; each drawn in front of the body or behind it. */
function sparks(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.5): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.6 + 0.6 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.7 + 0.6 * jitter(k + 2))];
    const p = thrown(from, v, since, 4);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    spark(g, x, y, size * (0.6 + 0.6 * jitter(k + 3)) * (1 - since / life), 1 - smooth((since - life * 0.5) / (life * 0.5)));
  }
}

/** Chips of clay thrown from `from`, falling. */
function spray(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.5): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.6 + 0.6 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.7 + 0.6 * jitter(k + 2))];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    chip(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (10 + 6 * jitter(k + 4)), CHIP_RGB[q % 3], 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/**
 * What a strike throws: sparks off its tiles as the blow lands, and the Kilnlet's a puff off its crown; the Terrabrick's dust off
 * the ground where its tail sweeps and flakes off its end; the Kilnspire's stamp a ring of dust and sparks thrown up from its
 * feet, and its tail's slam a second puff behind it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Kiln, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - KILN_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  if (s.stage === 0) {
    const crown = place(b.head, [0, s.head.r[1] * 0.4, s.head.up + s.head.r[2] * 0.7]);
    if (front) puff(g, view, crown, 0.36 * big, since / 0.32, 3);
    sparks(g, view, mid, crown, since, front, 8, 40, 2.2 * big, 3, 0.05 * big);
    return;
  }
  if (s.stage === 1) {
    const n = s.tail.links.length - 1, end = place(b[`tail${n}`], [0, -s.tail.links[n] * 0.6, 0]), ground: V3 = [end[0], end[1], 0.1];
    if (nearSide(ground, mid, view) === front) puff(g, view, ground, 0.5 * big, since / 0.36, 5);
    spray(g, view, mid, end, since, front, 6, 60, 2.6 * big, 3.5, 0.08 * big);
    sparks(g, view, mid, end, since, front, 7, 90, 2.4 * big, 3.5, 0.05 * big);
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
  for (const [q, f] of feet.entries()) sparks(g, view, mid, [f[0], f[1], 0.2], since, front, 8, 700 + q * 50, 2.4 * big, 5, 0.06 * big, 0.6);
  const ts = (t - KILNSPIRE_SLAM) * ACT_SECS.strike;
  if (ts > 0 && ts < 0.4) {
    const tb = place(b.tail0, [0, 0, 0]);
    if (nearSide(tb, mid, view) === front) puff(g, view, [tb[0], tb[1], 0.3 * big], big * 0.8, ts / 0.4, 8);
  }
}

/**
 * At its task: the kiln's mouth glowing, flaring as its door opens and dimming as it shuts, sparks out of it as it opens and as the
 * fired pot is drawn out; the fired pot glowing hot in its jaws and cooling; and a puff of dust as each pot is set down or taken up.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Kiln, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = workOf(s), K = KILN_WORK, big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5;
  if (!b.kiln) return;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const R = s.kiln.r, mouth = place(b.kiln, [0, -R * 1.02, R * MOUTH[1]]);
  const g0 = b.kiln.m[0], open = doorOf(t);
  if (front && g0 > 0.2) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const [x, y] = onScreen(view, mouth);
    const toward = clamp(-dot([0, 1, 0], view.T) + 0.6);
    light(g, x, y, R * (0.7 + 0.6 * open) * g0, EMBER, (0.18 + 0.4 * open) * toward * g0);
    light(g, x, y, R * 0.35 * g0, HOT, (0.1 + 0.35 * open) * toward * g0);
    // The fired pot hot from the kiln, cooling as it comes out.
    if (t >= K.grab && b.pot1) {
      const hot = 1 - ramp(t, K.grab, K.set + 0.08), p = place(b.pot1, [0, 0, -s.kiln.pot[1] * 0.5]);
      const [px, py] = onScreen(view, p);
      light(g, px, py, s.kiln.pot[0] * 3, EMBER, 0.45 * hot);
    }
    g.restore();
  }
  for (const [t0, n] of [[K.open, 7], [K.grab + 0.02, 5]] as const) sparks(g, view, mid, mouth, since(t0), front, n, 300 + n * 13, 1.0 * big, 2.4, 0.04 * big, 0.5);
  for (const [t0, at] of [[K.pick, W.potIn], [K.set, W.potOut]] as const) {
    const dt = since(t0);
    if (dt < 0 || dt > 0.4) continue;
    const p: V3 = [at[0], at[1], 0.06];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.22 * big, dt / 0.4, t0 * 10);
  }
}

/** Evolving: a burst of flakes and sparks off it at the start, then flakes and embers swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Kiln, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], B = s.body;
  const burst = 1 - ramp(t, 0.1, 0.26);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 24; q++) {
      const th = (q / 24) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * B.w[3] * 0.6, Math.sin(th) * s.len * 0.45, B.h[3] * 0.7]);
      const v: V3 = [Math.cos(th) * (2 + 2 * jitter(q + 3)), Math.sin(th) * (2 + 2 * jitter(q + 5)), 3 + 3 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 6);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 2) chip(g, x, y, 0.1 * big, q * 1.3 + since * 8, CHIP_RGB[q % 3], burst * ramp(t, 0, 0.03));
      else spark(g, x, y, 0.05 * big, burst * ramp(t, 0, 0.03));
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
      if (q % 3) chip(g, x, y, 0.11 * big * (1 - 0.4 * u), ang * 2 + q, CHIP_RGB[q % 3], swirl * ramp(u, 0, 0.15));
      else spark(g, x, y, 0.05 * big, swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, its ember's light, and what it throws about as it strikes, works and evolves. */
function kilnKind(s: Kiln): Kind {
  const bones = kilnBones(s);
  return {
    bones,
    build: (lod) => kilnBuild(s, lod),
    // The variant's coat its skin and its tiles, its markings the cream of its throat and belly; the ember, its claws, its amber
    // eyes, the kiln and the pots the same on every variant.
    palette: (coat, mark) => {
      const skin = mix(coat, pastel(coat, 24), 0.14), cream = mix(mark, [236, 186, 146], 0.1);
      return coatPalette(coat, mark, {
        coat: skin,
        coatDark: mix(skin, [96, 28, 20], 0.36),
        // Its tiles: fired a shade darker and redder than its skin, their edges lighter.
        hornDark: mix(skin, [150, 34, 22], 0.36),
        horn: mix(skin, [255, 232, 204], 0.2),
        coatLight: mix(skin, cream, 0.55),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 242], 0.5),
        inner: [226, 120, 112],
        tongue: [236, 128, 130],
        lid: [86, 44, 36],
        nose: [86, 44, 36],
        eye: [40, 22, 18],
        glint: [255, 253, 246],
        crystal: [242, 156, 40],
        crystalDark: [190, 96, 30],
        claw: [60, 38, 34],
        ember: [255, 124, 26],
        flame: [255, 206, 84],
        stone: [178, 170, 160],
        stoneDark: [116, 106, 100],
        metal: [104, 98, 102],
        metalDark: [62, 56, 60],
        cap: [214, 202, 186],
        spot: [186, 172, 156],
        shell: [214, 114, 72],
        shellDark: [164, 78, 52],
      } as Partial<ReturnType<Kind['palette']>>, 24);
    },
    shadow: [s.len * 0.8 + s.tail.links.reduce((x, y) => x + y, 0) * 0.15, s.body.w[3] * 1.35],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are ember and its cream.
    motes: [[255, 146, 52], [246, 226, 196]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (front) emberLights(g, view, s, b, a);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const KILNLET = kilnKind(KILNLET_LOOK);
export const TERRABRICK = kilnKind(TERRABRICK_LOOK);
export const KILNSPIRE = kilnKind(KILNSPIRE_LOOK);
