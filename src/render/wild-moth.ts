import {
  ACT_SECS, add, beat, clamp, coatPalette, curve, cyc, darker, DEG, dot, drift, eyes, frac, lerp, lighter, LOOP, merge, mirrored, mix, moved, onEgg, orb,
  orbAlong, paint, pastel, scale, smile, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The moth line: the Glimmoth, a small fuzzy moth with mossy wings patterned
 * green and brown, a pair of branching antlers for feelers, a small furry face
 * with dark eyes and a lantern for an abdomen, glowing warm yellow; which
 * grows into the Lurewing, bigger, its broader wings veined like leaves and
 * lobed at their edges, a leaf or two hanging under each hindwing, bigger
 * antlers and a brighter lantern; and then the Noctilure, large, its great
 * wings layered and fringed with leaves, vines hanging from them, big antlers
 * and a big bright lantern of a belly. The species is still `wicka`
 * underneath, as saves and the database know it: the lamplighter, that puts
 * candles from the stores in the lantern posts and pillars, lights them after
 * dark and puts them out by day.
 *
 * All three are built by one set of functions from a description of the stage
 * (`Moth`), so a stage is its numbers. It never lands: its body hangs in the
 * air tilted up, head high and lantern low, and its wings beat in a stroke
 * that lifts it a little at each downstroke, the hindwings a beat behind the
 * forewings. Each wing is a flat plate cut to its outline with its pattern
 * painted on both faces. A beat is four pictures, standing or going, so it
 * reads as a flutter at the six pictures a second a body standing is kept at.
 *
 * Its lantern is lit from inside: a light added over it (`Kind.glow`) that
 * swells and fades slowly. It strikes with its wings, raised high and brought
 * down hard in a buffet that throws a puff of scale dust. At its task it holds
 * a candle up in its forelegs, curls its lantern under it to light the wick,
 * and pushes the lit candle forward into the lantern it is at.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/**
 * A wing: how far it reaches out from its root and how deep it is root to
 * edge, how far it is turned toward the head (degrees, the hindwing's
 * negative: toward the tail), its edge -- how many lobes along its outer
 * margin, how deep, and whether each lobe is pointed as a leaf is or round as
 * a scallop -- and how thick the plate is.
 */
interface Wing { span: number; chord: number; rake: number; lobes: number; lobe: number; leafy: boolean }

interface Moth {
  stage: 0 | 1 | 2;
  /** How big it is drawn against how it is built (`Kind.size`). */
  size: number;
  /** How high its thorax hovers over the ground, and how far its body is tilted up from level, in degrees. */
  hover: number;
  tilt: number;
  /** The thorax's half-sizes: across, along the body, and back to front (its back is the side its wings are on). */
  thorax: V3;
  /** The head's half-sizes, and its eyes' size. */
  head: { r: V3; eye: number };
  /** The lantern: how long it hangs, and how wide at its widest. */
  abd: { len: number; r: number };
  fore: Wing;
  hind: Wing;
  /** An antler: how long its beam, how thick at the root; and its tines, each where along the beam, how long, and how far out (a share of a turn about the beam). */
  antler: { len: number; w: number; tines: ReadonlyArray<readonly [number, number, number]> };
  /** Leaves hanging under each hindwing; vines hanging from each, and how many leaves on each vine. */
  leaves: number;
  vines: number;
  /** How far the wings beat standing and at a run, in degrees either side of where they are held; how far a beat lifts the body. */
  beat: [number, number];
  bob: number;
  /** The pattern its forewings are painted in: a moth's bands and spots, a leaf's veins, or both and more. */
  look: 0 | 1 | 2;
}

/** A Glimmoth: small and fuzzy, round mossy wings, little antlers and a small bright lantern. */
const GLIMMOTH_LOOK: Moth = {
  stage: 0,
  size: 1.9,
  hover: 2.3,
  tilt: 58,
  thorax: [0.4, 0.42, 0.38],
  head: { r: [0.36, 0.33, 0.33], eye: 0.13 },
  abd: { len: 1.05, r: 0.38 },
  fore: { span: 1.95, chord: 1.2, rake: -16, lobes: 4, lobe: 0.035, leafy: false },
  hind: { span: 1.4, chord: 1.02, rake: -14, lobes: 4, lobe: 0.04, leafy: false },
  antler: { len: 0.58, w: 0.06, tines: [[0.45, 0.2, 0.0], [0.72, 0.16, 0.5]] },
  leaves: 0,
  vines: 0,
  beat: [30, 40],
  bob: 0.07,
  look: 0,
};

/** A Lurewing: bigger, broader wings veined like leaves and lobed at the edge, a leaf or two under each hindwing, bigger antlers. */
const LUREWING_LOOK: Moth = {
  stage: 1,
  size: 2.2,
  hover: 3.0,
  tilt: 56,
  thorax: [0.52, 0.55, 0.5],
  head: { r: [0.44, 0.4, 0.4], eye: 0.15 },
  abd: { len: 1.4, r: 0.52 },
  fore: { span: 2.95, chord: 1.72, rake: -16, lobes: 6, lobe: 0.05, leafy: true },
  hind: { span: 2.15, chord: 1.5, rake: -16, lobes: 5, lobe: 0.06, leafy: true },
  antler: { len: 0.9, w: 0.075, tines: [[0.35, 0.3, 0.0], [0.58, 0.26, 0.5], [0.8, 0.2, 0.05]] },
  leaves: 2,
  vines: 0,
  beat: [28, 38],
  bob: 0.09,
  look: 1,
};

/** A Noctilure: large, great layered wings fringed with leaves, vines hanging from them, big antlers and a big bright lantern belly. */
const NOCTILURE_LOOK: Moth = {
  stage: 2,
  size: 2.4,
  hover: 4.0,
  tilt: 60,
  thorax: [0.7, 0.72, 0.66],
  head: { r: [0.54, 0.5, 0.5], eye: 0.17 },
  abd: { len: 1.95, r: 0.8 },
  fore: { span: 3.95, chord: 2.3, rake: -16, lobes: 8, lobe: 0.06, leafy: true },
  hind: { span: 3.0, chord: 2.3, rake: -18, lobes: 7, lobe: 0.09, leafy: true },
  antler: { len: 1.55, w: 0.11, tines: [[0.22, 0.4, 0.0], [0.42, 0.38, 0.55], [0.62, 0.34, 0.05], [0.82, 0.26, 0.6]] },
  leaves: 4,
  vines: 2,
  beat: [24, 34],
  bob: 0.11,
  look: 2,
};

/* ---- its moves, in time ---------------------------------------------------------------- */

/** When each stage's buffet lands, as a share of its strike: the wings at the bottom of their stroke. */
export const MOTH_HITS: readonly number[] = [0.48, 0.5, 0.52];
/**
 * A go at its task, as shares of the go: the candle taken up in its forelegs by `take`, held low in front of it; its lantern
 * swung forward under it to the wick from `curl`, the wick catching at `catch`; the lit candle lifted from `lift` up to the
 * lantern it is at, pushed in and let go at `place`, gone into it by `gone`.
 */
export const MOTH_WORK = { take: 0.06, curl: 0.18, catch: 0.4, lift: 0.5, place: 0.72, gone: 0.86 } as const;

/* ---- small things -------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a fringe is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** Faces wound so each looks the way it should, whichever way round its corners were listed. */
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
    const w = want[q];
    if (nx * w[0] + ny * w[1] + nz * w[2] < 0) idx.reverse();
  });
  return f;
}

/* ---- a wing ----------------------------------------------------------------------------- */

type P2 = [number, number];

/** A closed smooth line through points (Catmull-Rom), `per` steps from each to the next. */
function closedSpline(pts: readonly P2[], per: number): P2[] {
  const out: P2[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const at = (k: 0 | 1): number => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

/** Wound anticlockwise, seen from its upper face. */
function ccw(pts: P2[]): P2[] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a < 0 ? [...pts].reverse() : pts;
}

/**
 * An outline's margin cut into lobes between shares `a` and `b` of the way round it: each lobe pointed at its tip as a leaf
 * is (`leafy`) or round as a scallop, notched between, `depth` deep.
 */
function lobed(pts: P2[], a: number, b: number, lobes: number, depth: number, leafy: boolean): P2[] {
  if (lobes <= 0 || depth <= 0) return pts;
  const n = pts.length, i0 = Math.round(a * n), i1 = Math.round(b * n);
  return pts.map((p, i) => {
    if (i < i0 || i > i1) return p;
    const u = (i - i0) / Math.max(1, i1 - i0), s = Math.abs(Math.sin(Math.PI * lobes * u));
    const d = depth * (leafy ? s ** 0.8 : (1 - s) ** 1.6);
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
    const tx = next[0] - prev[0], ty = next[1] - prev[1], tl = Math.hypot(tx, ty) || 1;
    // Anticlockwise, in is to the left of the way round.
    return [p[0] - (ty / tl) * d, p[1] + (tx / tl) * d];
  });
}

/** A forewing's outline, reaching out along x from its root, its leading edge toward +y: in shares of its span and chord. */
const FORE: readonly P2[] = [[0, 0.1], [0.25, 0.3], [0.55, 0.42], [0.84, 0.42], [1.0, 0.24], [1.02, 0.0], [0.94, -0.28], [0.78, -0.48], [0.54, -0.55], [0.3, -0.45], [0.1, -0.24], [0, -0.06]];
/** A hindwing's: a rounded fan out and down. */
const HIND: readonly P2[] = [[0, 0.06], [0.35, 0.14], [0.75, 0.06], [1.0, -0.2], [1.02, -0.52], [0.86, -0.82], [0.58, -0.98], [0.3, -0.9], [0.1, -0.6], [0, -0.26]];

/** How far a wing's surface is bowed out of flat at a point on it: cupped toward its tip and arched across its chord. */
type Warp = (x: number, y: number) => number;
const flatWarp: Warp = () => 0;

/** A shape painted on both faces of a plate `th` thick, bowed as the plate is: its corners (x, y) on the upper face and, mirrored through, the lower. */
function both(pts: readonly P2[], th: number, m: Mat, warp: Warp = flatWarp): Disc[] {
  const up: V3[] = pts.map(([x, y]) => [x, y, warp(x, y) + th / 2 + 0.004]);
  const down: V3[] = pts.map(([x, y]) => [x, y, warp(x, y) - th / 2 - 0.004]);
  const f = (v: V3[], nz: number): Disc => {
    let a = 0;
    for (let i = 0; i < v.length; i++) a += v[i][0] * v[(i + 1) % v.length][1] - v[(i + 1) % v.length][0] * v[i][1];
    return { v: (a > 0) === (nz > 0) ? v : [...v].reverse(), m };
  };
  return [f(up, 1), f(down, -1)];
}
/** An ellipse in the plate's plane: middle, half-sizes, turned by `rot` radians. */
function oval(c: P2, rx: number, ry: number, rot: number, sides = 8): P2[] {
  return Array.from({ length: sides }, (_, q) => {
    const t = (q / sides) * TAU, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    return [c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)] as P2;
  });
}
/** A vein: a narrowing line from `a` to `b`, `w0` wide (half) at its root and `w1` at its end, bowed `bow` of its length to its left. */
function vein(a: P2, b: P2, w0: number, w1: number, bow = 0): P2[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const K = 5, left: P2[] = [], right: P2[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, w = lerp(w0, w1, u), off = bow * l * Math.sin(Math.PI * u);
    const x = a[0] + dx * u + nx * off, y = a[1] + dy * u + ny * off;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  }
  return [...left, ...right.reverse()];
}
/** A band across a wing from `a` to `b`, `w` wide (half), waved `wave` either side `n` times. */
function band(a: P2, b: P2, w: number, wave: number, n: number): P2[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const K = 4 * n, left: P2[] = [], right: P2[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, off = wave * Math.sin(u * n * TAU), ww = w * (0.7 + 0.3 * Math.sin(Math.PI * u));
    const x = a[0] + dx * u + nx * off, y = a[1] + dy * u + ny * off;
    left.push([x + nx * ww, y + ny * ww]);
    right.push([x - nx * ww, y - ny * ww]);
  }
  return [...left, ...right.reverse()];
}

/**
 * A plate cut to an outline and bowed by `warp`: its upper face and its lower, each a fan of facets from a hub in its middle so
 * it can bow, and its edge. Bowed, a wing turned edge on is still a sliver of wing rather than a stick; its pattern goes on as
 * paint (`both`), bowed with it.
 */
function plate(outline: readonly P2[], th: number, top: Mat, under: Mat, edge: Mat, warp: Warp = flatWarp): Mesh {
  const n = outline.length, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const hub: P2 = [outline.reduce((t, p) => t + p[0], 0) / n, outline.reduce((t, p) => t + p[1], 0) / n];
  for (const [x, y] of outline) v.push([x, y, warp(x, y) + th / 2]);
  for (const [x, y] of outline) v.push([x, y, warp(x, y) - th / 2]);
  v.push([hub[0], hub[1], warp(hub[0], hub[1]) + th / 2], [hub[0], hub[1], warp(hub[0], hub[1]) - th / 2]);
  const H0 = 2 * n, H1 = 2 * n + 1;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n, a = outline[k], b = outline[k2];
    f.push({ i: [H0, k, k2], m: top });
    want.push([0, 0, 1]);
    f.push({ i: [H1, n + k, n + k2], m: under });
    want.push([0, 0, -1]);
    f.push({ i: [k, k2, n + k2, n + k], m: edge });
    want.push([b[1] - a[1], a[0] - b[0], 0]);
  }
  return mesh(v, woundTo(v, f, want));
}

/** Where on a wing's outline a share of the way round it is: for what hangs off its edge. */
const alongEdge = (pts: readonly P2[], u: number): P2 => pts[Math.min(pts.length - 1, Math.max(0, Math.round(frac(u) * pts.length)))];

/** A wing's bow: its tip cupped up over its back by a tenth of its span, and its middle arched up across its chord, about `mid` of it. */
const wingWarp = (L: number, C: number, mid: number): Warp => (x, y) => {
  const u = clamp(x / L), v = clamp(Math.abs(y / C - mid) / 0.6);
  return 0.17 * L * u * u + 0.06 * C * (1 - v * v);
};

/**
 * A right forewing, built reaching out along x from its root with its upper face up, turned toward the head by its rake: its
 * plate, and its pattern painted on both faces. The Glimmoth's is a moth's -- a brown patch at its root, a dark wavy band across
 * it, pale moss toward its tip and two brown spots, fine dark veins; the Lurewing's a leaf's -- a dark midrib out to its tip and
 * veins off it either side, brown blotches along its trailing edge; the Noctilure's both, with a pale band and a dark edge.
 */
function foreWing(s: Moth, lod: number): Mesh {
  const W = s.fore, L = W.span, C = W.chord, th = 0.035 + 0.01 * s.stage;
  const at = (p: readonly P2[]): P2[] => p.map(([x, y]) => [x * L, y * C]);
  const out = lobed(ccw(closedSpline(at(FORE), cut(lod, 4, 6))), 0.28, 0.72, W.lobes, W.lobe * C * 1.4, W.leafy);
  const P = (x: number, y: number): P2 => [x * L, y * C];
  const warp = wingWarp(L, C, -0.05);
  const paints: Disc[] = [];
  const add2 = (pts: P2[], m: Mat): void => { paints.push(...both(pts, th, m, warp)); };
  if (s.look === 0) {
    add2(at([[0.02, 0.08], [0.2, 0.26], [0.32, 0.12], [0.28, -0.26], [0.12, -0.24], [0.02, -0.06]]), 'bark');
    add2(band(P(0.6, 0.4), P(0.48, -0.5), 0.05 * C, 0.04 * C, 2), 'leafDark');
    add2(oval(P(0.82, 0.16), 0.13 * L, 0.11 * C, 0.3), 'moss');
    add2(oval(P(0.72, -0.22), 0.06 * L, 0.07 * C, 0.2), 'bark');
    add2(oval(P(0.88, -0.08), 0.045 * L, 0.05 * C, 0.2), 'bark');
    for (const [x, y] of [[0.96, 0.18], [0.9, -0.2], [0.68, -0.44], [0.38, -0.46]] as P2[]) add2(vein(P(0.04, 0), P(x, y), 0.012 * C, 0.006 * C, 0.04), 'leafDark');
    add2(vein(P(0.05, 0.12), P(0.8, 0.39), 0.02 * C, 0.012 * C, 0.04), 'moss');
  } else {
    // A leaf's veins: the midrib from the root out to the tip, the veins off it either side, leaning out.
    const tip = P(0.98, 0.08), root = P(0.03, 0.0);
    if (s.look === 2) {
      add2(at([[0.02, 0.08], [0.18, 0.28], [0.3, 0.12], [0.26, -0.3], [0.1, -0.26], [0.02, -0.06]]), 'bark');
      add2(band(P(0.66, 0.42), P(0.56, -0.52), 0.045 * C, 0.035 * C, 3), 'moss');
      add2(oval(P(0.86, 0.22), 0.07 * L, 0.06 * C, 0.3), 'bloom');
    }
    add2(oval(P(0.62, -0.36), 0.1 * L, 0.07 * C, -0.3), 'bark');
    add2(oval(P(0.84, -0.22), 0.07 * L, 0.06 * C, -0.5), 'bark');
    add2(oval(P(0.4, 0.22), 0.1 * L, 0.06 * C, 0.2), 'moss');
    add2(vein(root, tip, 0.03 * C, 0.008 * C, 0.05), 'leafDark');
    for (const u of [0.22, 0.4, 0.58, 0.76]) {
      const m: P2 = [lerp(root[0], tip[0], u), lerp(root[1], tip[1], u) + 0.05 * C * Math.sin(Math.PI * u)];
      add2(vein(m, [m[0] + 0.2 * L, m[1] + 0.3 * C * (1 - u * 0.4)], 0.014 * C, 0.004 * C, 0.08), 'leafDark');
      add2(vein(m, [m[0] + 0.16 * L, m[1] - 0.36 * C * (1 - u * 0.35)], 0.014 * C, 0.004 * C, -0.08), 'leafDark');
    }
  }
  // Its leading edge pale, as a moth's costa is.
  if (s.look !== 0) add2(vein(P(0.05, 0.12), P(0.82, 0.4), 0.022 * C, 0.012 * C, 0.04), 'moss');
  const m = merge(plate(out, th, 'leaf', 'feather', 'leafDark', warp), paint(paints));
  return moved(m, [0, 0, 0], W.rake);
}

/**
 * A right hindwing: a fan out and down, browner than the forewing, veined from its root; the Lurewing's and the Noctilure's
 * lobed into leaves at the edge with leaves hanging from it, and the Noctilure's with a second layer of leaves under it.
 */
function hindWing(s: Moth, lod: number): Mesh {
  const W = s.hind, L = W.span, C = W.chord, th = 0.035 + 0.01 * s.stage;
  const at = (p: readonly P2[]): P2[] => p.map(([x, y]) => [x * L, y * C]);
  const out = lobed(ccw(closedSpline(at(HIND), cut(lod, 4, 6))), 0.22, 0.82, W.lobes, W.lobe * C * 1.4, W.leafy);
  const P = (x: number, y: number): P2 => [x * L, y * C];
  const warp = wingWarp(L, C, -0.45);
  const paints: Disc[] = [];
  const add2 = (pts: P2[], m: Mat): void => { paints.push(...both(pts, th, m, warp)); };
  add2(oval(P(0.55, -0.45), 0.26 * L, 0.2 * C, -0.6), 'moss');
  add2(oval(P(0.2, -0.2), 0.14 * L, 0.18 * C, -0.4), 'bark');
  for (const [x, y] of [[0.95, -0.3], [0.86, -0.7], [0.55, -0.92], [0.25, -0.8]] as P2[]) add2(vein(P(0.03, -0.04), P(x, y), 0.012 * C, 0.005 * C, -0.05), 'leafDark');
  if (s.stage === 2) add2(band(P(0.98, -0.42), P(0.36, -0.9), 0.04 * C, 0.03 * C, 3), 'bark');
  const parts: Mesh[] = [plate(out, th, 'membrane', 'featherDark', 'leafDark', warp), paint(paints)];
  // Leaves hanging from its lower edge, pointing down and out, each its own green.
  for (let q = 0; q < s.leaves; q++) {
    const u = s.leaves === 1 ? 0.6 : lerp(0.5, 0.78, q / (s.leaves - 1));
    const [x, y] = alongEdge(out, u);
    const len = (0.42 + 0.14 * jitter(q + s.stage * 7)) * C * (s.stage === 2 ? 0.8 : 0.7);
    const dir = unit([0.25 + 0.3 * (q / Math.max(1, s.leaves - 1)), -1, 0]);
    const root: V3 = [x, y, warp(x, y) - th * 0.6];
    parts.push(blade(curve(root, add(root, scale(dir, len * 0.5)), add(root, add(scale(dir, len), [0.06 * len, 0, -0.02])), 4), [0.02, len * 0.2, len * 0.24, len * 0.14, 0.01], [0, 0, 1],
      { mat: q % 2 ? 'membrane' : 'leaf', rib: 'leafDark', fold: 0.2, thick: 0.03 }));
  }
  // The Noctilure's: a second layer of leaf lobes under the hindwing, longer, out past its lower edge.
  if (s.stage === 2) {
    for (let q = 0; q < 3; q++) {
      const u = q / 2, len = (0.62 + 0.12 * jitter(q + 31)) * C;
      const rx = lerp(0.2, 0.62, u) * L, ry = lerp(-0.62, -0.78, u) * C, root: V3 = [rx, ry, warp(rx, ry) - th * 1.2];
      const dir = unit([lerp(-0.1, 0.5, u), -1, 0]);
      parts.push(blade(curve(root, add(root, scale(dir, len * 0.5)), add(root, scale(dir, len)), 4), [0.05, len * 0.3, len * 0.32, len * 0.18, 0.01], [0, 0, 1],
        { mat: q % 2 ? 'membrane' : 'leaf', rib: 'leafDark', fold: 0.22, thick: 0.035 }));
    }
  }
  return moved(merge(...parts), [0, 0, 0], W.rake);
}

/* ---- the body ------------------------------------------------------------------------------ */

/** A tuft of fur: a short cone out from a point along a way, `w` across at its root. */
const tuft = (p: V3, d: V3, len: number, w: number, m: Mat): Mesh => taper([p, add(p, scale(unit(d), len))], w, w * 0.12, 4, m);

/**
 * The thorax: a round furry body, its back the side its wings are on, a ruff of pale fur round the neck where the head sits, and
 * tufts over its back and under it. In the thorax's own frame: along y to the head, its back toward z.
 */
function thoraxMesh(s: Moth, n: number, k: number): Mesh {
  const R = s.thorax, c: V3 = [0, 0, 0];
  const parts: Mesh[] = [orb(c, R, n, k, 'coat')];
  // The ruff: a thick collar of pale fur round the neck, scalloped into locks, and a bib of it down the chest.
  const K = 14 + 2 * s.stage, ring: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= K; q++) {
    const a = (q / K) * TAU, on = onEgg(c, R, [Math.cos(a), 0.62, Math.sin(a)]);
    ring.push(add(on.p, scale(on.n, R[0] * 0.04)));
    ws.push(R[0] * (q % 2 ? 0.2 : 0.28));
  }
  parts.push(tube(ring, ws, ws, 6, 'coatLight', { seam: 'both' }));
  for (let q = 0; q < 3 + s.stage; q++) {
    const a = -Math.PI / 2 + (q - (2 + s.stage) / 2) * 0.42;
    const on = onEgg(c, R, [Math.cos(a) * 0.9, 0.2 - 0.12 * (q % 2), Math.sin(a)]);
    const r = R[0] * (0.34 + 0.06 * jitter(q + 2));
    parts.push(orb(add(on.p, scale(on.n, -r * 0.1)), r, 7, 4, 'coatLight'));
  }
  // Puffs over its back and its sides in the coat's own colours.
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU + 0.4;
    const on = onEgg(c, R, [Math.cos(a), -0.3 + 0.3 * jitter(q + 3), Math.sin(a) * 0.9]);
    const r = R[0] * (0.22 + 0.06 * jitter(q + 9));
    parts.push(orb(add(on.p, scale(on.n, r * 0.25)), r, 6, 3, Math.sin(a) < -0.3 ? 'coatLight' : q % 2 ? 'coatDark' : 'coat'));
  }
  return merge(...parts);
}

/** Its head, upright and looking along y: a round furry face, big dark eyes, a pale muzzle with a small mouth, furred cheeks. */
function headMesh(s: Moth, n: number, k: number, shut: boolean): Mesh {
  const R = s.head.r, c: V3 = [0, 0, 0];
  const muzzle = onEgg(c, R, [0, 1, -0.55]);
  const parts: Mesh[] = [
    orb(c, R, n, k, 'coat'),
    orbAlong(add(muzzle.p, scale(muzzle.n, -R[1] * 0.12)), muzzle.n, [R[0] * 0.42, R[0] * 0.32, R[1] * 0.26], n, 4, 'muzzle'),
    eyes(c, R, [0.5, 0.82, 0.12], s.head.eye * (1 + 0.1 * s.stage) / 1, { tall: 1.12, shut, glint: 0.34 }),
    smile(add(muzzle.p, scale(muzzle.n, R[1] * 0.08)), muzzle.n, R[0] * 0.26),
  ];
  // Fur round the face: cheeks out to the sides, and a crest between the antlers.
  for (const sd of [1, -1]) {
    for (let q = 0; q < 3; q++) {
      const on = onEgg(c, R, [sd * 1, 0.1 - 0.15 * q, -0.15 - 0.35 * q]);
      parts.push(tuft(on.p, add(on.n, [0, 0, -0.3]), R[0] * (0.36 - 0.06 * q), R[0] * 0.2, 'coat'));
    }
  }
  for (let q = 0; q < 3; q++) {
    const on = onEgg(c, R, [(q - 1) * 0.3, -0.1, 1]);
    parts.push(tuft(on.p, add(on.n, [0, -0.3, 0.2]), R[0] * 0.3, R[0] * 0.2, 'coatDark'));
  }
  return merge(...parts);
}

/** A right antler, up out of the top of its head and out: a beam curving up and back, its tines up off it, each a little turned out. */
function antlerMesh(s: Moth): Mesh {
  const A = s.antler, L = A.len;
  // The beam up and out from its root, bowed outward and swept back; each tine up and forward off it, the inner ones leaning
  // in, the outer out, so it branches seen from in front and from the side.
  const pts = curve([0, 0, 0], [0.12 * L, -0.06 * L, 0.5 * L], [0.5 * L, -0.3 * L, 0.84 * L], 6);
  const parts: Mesh[] = [taper(pts, A.w, A.w * 0.45, 5, 'horn')];
  for (const [u, len, out] of A.tines) {
    const i = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))), f = u * (pts.length - 1) - i;
    const p: V3 = [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f), lerp(pts[i][2], pts[i + 1][2], f)];
    const d = unit([-0.35 + out * 0.9, 0.5, 1]);
    const tip = add(p, scale(d, len * L));
    parts.push(taper(curve(p, add(p, scale(unit([d[0] + 0.25, d[1], d[2] * 0.6]), len * L * 0.5)), tip, 3), A.w * 0.8, A.w * 0.35, 4, 'horn'));
  }
  return merge(...parts);
}

/** The lantern: an egg hanging down along -y from its waist, fur at the waist, glowing segments ringed in amber, its tip amber. */
function abdMesh(s: Moth, n: number): Mesh {
  const L = s.abd.len, R = s.abd.r;
  const r = (u: number): number => R * Math.max(0.12, Math.sin(Math.PI * clamp(0.13 + 0.85 * u)) ** 0.62);
  // Rings in pairs close together where a segment meets the next, so each meeting is a thin amber line round it.
  const us = [0, 0.1, 0.2, 0.3, 0.33, 0.48, 0.51, 0.66, 0.69, 0.82, 0.85, 0.93, 1.0];
  const mat = (ring: number): Mat => (ring < 2 ? 'coat' : ring === 3 || ring === 5 || ring === 7 || ring === 9 || ring >= 11 ? 'ember' : 'flame');
  const body = tube(us.map((u) => [0, -u * L, 0] as V3), us.map(r), us.map(r), n, (ring) => mat(ring), { up: [0, 0, 1] });
  // A soft fur collar at the waist, where it hangs from the thorax.
  const parts: Mesh[] = [body];
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU + 0.3;
    parts.push(orb([Math.cos(a) * r(0.12) * 0.9, -0.14 * L, Math.sin(a) * r(0.12) * 0.9], R * (0.3 + 0.06 * jitter(q + 21)), 6, 3, q % 2 ? 'coat' : 'coatLight'));
  }
  return merge(...parts);
}

/**
 * A foreleg: a thin dark insect's leg, a little bent at its knee, with a small foot. Built a unit long along y, from its hip on
 * the thorax, and stretched along its bone to whatever it reaches for (`aimed`).
 */
function armMesh(s: Moth, n: number): Mesh {
  const w = 0.035 + 0.012 * s.stage;
  return merge(
    tube([[0, 0, 0], [0, 0.48, -0.1], [0, 0.96, 0]], [w * 1.2, w, w * 0.8], [w * 1.2, w, w * 0.8], n, 'coatDark', { seam: 'start' }),
    orb([0, 0.98, 0], [w * 1.2, 0.06, w * 1.2], 5, 3, 'hornDark'),
  );
}

/** How big its candle is against the Glimmoth's. */
const candleK = (s: Moth): number => [1.25, 1.55, 1.9][s.stage];
/** How tall its candle is to the top of its wax, and where on it the flame sits. */
const waxTop = (s: Moth): number => 0.42 * candleK(s);
const flameAt = (s: Moth): number => waxTop(s) + 0.13 * candleK(s);

/** A candle, upright: white wax with a run of wax down one side, a dark wick. Its foot at the origin. */
function candleMesh(s: Moth): Mesh {
  const k = candleK(s), r = 0.085 * k, h = waxTop(s);
  return merge(
    tube([[0, 0, 0], [0, 0, h * 0.96], [0, 0, h]], [r, r, r * 0.84], [r, r, r * 0.84], 8, 'shell'),
    orbAlong([r * 0.82, 0.02, h * 0.74], [0, 0, 1], [r * 0.3, r * 0.3, h * 0.2], 5, 3, 'shellDark'),
    taper([[0, 0, h], [0.006, 0, h + 0.07 * k]], 0.016 * k, 0.012 * k, 4, 'claw'),
  );
}
/** The candle's flame: a teardrop of gold with a pale heart, on the wick. Its middle at `flameAt`. */
function flameMesh(s: Moth): Mesh {
  const k = candleK(s), z = flameAt(s);
  return merge(
    orbAlong([0, 0, z], [0, 0, 1], [0.065 * k, 0.065 * k, 0.13 * k], 7, 4, 'ember'),
    orbAlong([0, 0.03 * k, z - 0.02 * k], [0, 0, 1], [0.038 * k, 0.03 * k, 0.075 * k], 6, 3, 'bloom'),
  );
}

/** A vine's link: a stem along -z, and a leaf off it, to one side or the other by its place in the vine. */
function vineLink(len: number, q: number): Mesh {
  const sd = q % 2 ? 1 : -1, w = 0.035;
  const leafRoot: V3 = [0, 0, -len * 0.7];
  const dir = unit([sd * 0.8, 0.2, -0.6]), ll = 0.34 + 0.08 * jitter(q + 40);
  return merge(
    tube([[0, 0, 0.02], [sd * 0.03, 0, -len * 0.5], [0, 0, -len]], [w, w * 0.9, w * 0.8], [w, w * 0.9, w * 0.8], 4, 'stem', { seam: 'both' }),
    blade(curve(leafRoot, add(leafRoot, scale(dir, ll * 0.5)), add(leafRoot, add(scale(dir, ll), [0, 0, -0.06])), 4), [0.015, ll * 0.24, ll * 0.26, ll * 0.14, 0.01], [0, 1, 0.3],
      { mat: q % 3 === 1 ? 'moss' : 'leaf', rib: 'leafDark', fold: 0.22, thick: 0.025 }),
  );
}

/** How many links a vine hangs in, and how long each. */
const VINE_LINKS = 4, VINE_LINK = 0.42;

function mothBuild(s: Moth, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7);
  const T = s.thorax, H = s.head.r;
  const fore = foreWing(s, lod), hind = hindWing(s, lod), antler = antlerMesh(s), arm = armMesh(s, cut(lod, 5, 6));
  const headHide = [{ c: [0, 0, 0] as V3, r: H }];
  const pieces: Piece[] = [
    { key: 'thorax', mesh: thoraxMesh(s, n, k), bone: 'thorax', bias: 0, lines: false },
    { key: 'abd', mesh: abdMesh(s, n), bone: 'abd', bias: -0.02, under: 'thorax' },
    { key: 'head', mesh: headMesh(s, n, k, false), shut: headMesh(s, n, k, true), bone: 'head', bias: 0.12 },
    { key: 'ant0', mesh: mirrored(antler), bone: 'ant0', bias: 0.13, after: 'head', hide: headHide, hideIn: 'head', thin: true },
    { key: 'ant1', mesh: antler, bone: 'ant1', bias: 0.13, after: 'head', hide: headHide, hideIn: 'head', thin: true },
    { key: 'fw0', mesh: mirrored(fore), bone: 'fw0', bias: 0.01 },
    { key: 'fw1', mesh: fore, bone: 'fw1', bias: 0.01 },
    { key: 'hw0', mesh: mirrored(hind), bone: 'hw0', bias: 0 },
    { key: 'hw1', mesh: hind, bone: 'hw1', bias: 0 },
    // Its forelegs, folded away in its fur but for when it holds a candle: hidden where the thorax is in front of them.
    { key: 'arm0', mesh: mirrored(arm), bone: 'arm0', bias: 0.05, hide: [{ c: [0, 0, 0], r: T }], hideIn: 'thorax', thin: true, shown: holding },
    { key: 'arm1', mesh: arm, bone: 'arm1', bias: 0.05, hide: [{ c: [0, 0, 0], r: T }], hideIn: 'thorax', thin: true, shown: holding },
    // The candle, only while it has one, grown into its hands and gone into the lantern by `bent`.
    { key: 'candle', mesh: candleMesh(s), bone: 'candle', bias: 0.08, shown: (a) => a.act?.kind === 'work' && workOf(a).candle > 0.35, bent: (v, a) => grown(v, workOf(a).candle) },
    { key: 'flame', mesh: flameMesh(s), bone: 'candle', bias: 0.09, after: 'candle', rim: false, shown: (a) => a.act?.kind === 'work' && workOf(a).lit > 0.05 && workOf(a).candle > 0.35, bent: (v, a) => flicker(v, s, a) },
  ];
  for (let sd = 0; sd < 2; sd++) {
    for (let q = 0; q < s.vines; q++) {
      for (let l = 0; l < VINE_LINKS; l++) {
        const key = `vine${sd}${q}_${l}`;
        pieces.push({ key, mesh: vineLink(VINE_LINK * (1 - 0.12 * l), l + q * 3 + sd * 7), bone: key, bias: -0.01, chain: `vine${sd}${q}`, thin: true });
      }
    }
  }
  return pieces;
}

/** Whether it is holding a candle, or reaching for one, this moment. */
const holding = (a: Anim): boolean => a.act?.kind === 'work' && workOf(a).candle > 0.2 && workOf(a).place < 0.9;
/** A mesh grown from its origin by `k`. */
const grown = (v: readonly V3[], k: number): V3[] => v.map((p) => scale(p, Math.max(0.001, k)));
/** The flame grown from the wick with how far it has caught, and flickering: taller and thinner, then shorter and broader. */
function flicker(v: readonly V3[], s: Moth, a: Anim): V3[] {
  const w = workOf(a), base = waxTop(s) + 0.02 * candleK(s), f = 1 + 0.16 * Math.sin((a.act?.t ?? 0) * TAU * 7);
  return v.map((p): V3 => {
    const z = p[2] - base;
    return scale([(p[0] * w.lit) / f, (p[1] * w.lit) / f, base + z * w.lit * f], Math.max(0.001, w.candle));
  });
}

/* ---- the pose ----------------------------------------------------------------------------- */

/** Everything its bones are turned by, this moment. */
interface Pose {
  /** The body moved from where it hovers (ground's frame), and turned: degrees, nose up, roll to its right, yaw to its left. */
  x: number; y: number; z: number; pitch: number; roll: number; yaw: number;
  /** Tilted up from level past how it hangs, degrees. */
  tilt: number;
  /** The forewings' and hindwings' lift (degrees, up over its back), and how far they are swept forward. */
  fore: number; hind: number; sweep: number;
  /** The head's nod, turn and tilt; the antlers' twitch; the lantern's swing forward under it, and to its right. */
  head: [number, number, number]; ant: number; abd: [number, number];
  /** How bright its lantern is, one as it hangs. */
  glow: number;
}

/**
 * Where in its beat it is at the start of its loop and of a stride: a quarter of a beat to a picture standing and going, so each
 * picture of a beat is a different height of the wings -- high, half up, low, half down -- and the first, which a portrait
 * is, has them spread nearly level.
 */
const BEAT_AT = 15 * DEG;
/** The phase of its wingbeat, in radians (see `BEAT_AT`). */
function beatPhase(a: Anim): number {
  if (a.act && (a.act.kind === 'work' || a.act.kind === 'evolve')) return a.act.t * TAU * (a.act.kind === 'work' ? 4 : 6);
  if (a.go > 0.5) return frac(a.u) * TAU * 3 + BEAT_AT;
  return (a.t * TAU * 36) / LOOP + BEAT_AT;
}

/** Hovering: wings beating, the body lifted at each downstroke, swaying a little, looking about, antlers twitching now and then. */
function hoverPose(s: Moth, a: Anim): Pose {
  const t = a.t, go = smooth(a.go), g = a.gait;
  const ph = beatPhase(a), amp = lerp(s.beat[0], s.beat[1], go * (0.5 + 0.5 * g));
  const flap = Math.sin(ph), still = 1 - go;
  const p: Pose = {
    x: 0.06 * cyc(t, 2) * still, y: 0.05 * cyc(t, 3, 1) * still, z: -s.bob * flap * (1 + 0.4 * go),
    pitch: 0, roll: 3 * cyc(t, 3, 0.4) * still, yaw: 0,
    tilt: -go * (12 + 10 * g) + 2 * cyc(t, 4, 1.1) * still,
    fore: 2 + amp * flap, hind: 4 + amp * 0.85 * Math.sin(ph - 0.7), sweep: 9 * Math.cos(ph),
    head: [4 * cyc(t, 5, 0.6) * still, 14 * drift(t, 0.7) * still, 4 * cyc(t, 3, 2) * still],
    ant: 10 * beat(t, [5.2, 13.6, 20.1], 0.7) * Math.sin(t * TAU * 3) * still,
    abd: [3 * cyc(t, 4, 1) * still - 6 * go * (1 + g) - 3 * flap, 2 * cyc(t, 2, 0.3) * still],
    glow: 1 + 0.14 * cyc(t, 4) * still + 0.08 * go,
  };
  return p;
}

/** The strike: wings raised high over its back as it draws up and back, then brought down and forward in a buffet as it lunges. */
function strikePose(s: Moth, t: number, p: Pose): void {
  const hit = MOTH_HITS[s.stage];
  // How far through: drawn back (one), the buffet (minus one at the blow), and back to hovering.
  const w = keysAt([[0, 0], [hit - 0.16, 1], [hit, -1], [hit + 0.14, -0.6], [1, 0]], t);
  const k = smooth(t / 0.12) * (1 - ramp(t, 0.8, 1));
  const up = Math.max(0, w), down = Math.max(0, -w);
  p.fore = lerp(p.fore, 70 * up - 16 * down + 6 * (1 - up - down), k);
  p.hind = lerp(p.hind, 56 * up - 14 * down, k);
  p.sweep = lerp(p.sweep, -18 * up + 40 * down, k);
  p.y += (-0.28 * up + 0.5 * down) * (1 + 0.3 * s.stage);
  p.z += 0.18 * up - 0.06 * down;
  p.tilt += 10 * up - 18 * down;
  p.head[0] += -8 * up + 10 * down;
  p.abd[0] += -10 * up + 14 * down;
  p.ant += 12 * down;
  p.glow += 0.25 * down;
}

/** How far through each part of a go at its task it is: the candle held (grown in), lit, lifted, placed; the lantern curled under. */
interface Work { candle: number; lit: number; lift: number; place: number; curl: number; spark: number }
const works = new WeakMap<Anim, Work>();
function workOf(a: Anim): Work {
  const had = works.get(a);
  if (had) return had;
  const t = a.act?.kind === 'work' ? a.act.t : 0, W = MOTH_WORK;
  const w: Work = {
    candle: ramp(t, 0, W.take) * (1 - ramp(t, W.place + 0.04, W.gone)),
    lit: ramp(t, W.catch - 0.02, W.catch + 0.06),
    lift: ramp(t, W.lift, W.place - 0.04),
    place: ramp(t, W.place - 0.04, W.gone),
    curl: keysAt([[0, 0], [W.curl, 0], [W.catch - 0.06, 1], [W.catch + 0.04, 1], [W.lift + 0.06, 0], [1, 0]], t),
    spark: ramp(t, W.catch - 0.08, W.catch - 0.02) * (1 - ramp(t, W.catch + 0.02, W.catch + 0.1)),
  };
  works.set(a, w);
  return w;
}

/** At its task: gentler wingbeats, its lantern swung forward under it to the wick, then leaning back to lift the candle up and in. */
function workPose(s: Moth, a: Anim, p: Pose): void {
  const w = workOf(a);
  const ph = beatPhase(a), flap = Math.sin(ph);
  p.fore = 10 + 24 * flap;
  p.hind = 0 + 20 * Math.sin(ph - 0.7);
  p.sweep = 6 * Math.cos(ph);
  p.z = -s.bob * 0.7 * flap + 0.06 * w.lift;
  p.tilt += 6 * w.curl + 8 * w.lift * (1 - w.place);
  p.head = [-14 * w.curl + 6 * w.lift, 0, 0];
  p.abd = [58 * w.curl, 0];
  p.glow = 1 + 0.5 * w.spark + 0.2 * w.curl;
}

/** Where its candle stands, in its body's frame: held low in front of it, its wick where its lantern's tip comes to; lifted up and forward. */
function candleAt(s: Moth, w: Work): V3 {
  const T = s.thorax, k = candleK(s);
  const low: V3 = [0, T[1] * 0.75 + s.abd.r * 1.05 + 0.08 * k, -T[2] * 0.95 - waxTop(s) * 0.85];
  const high: V3 = [0, T[1] * 1.7 + 0.12 * k, -T[2] * 0.15];
  const into: V3 = [0, 0.32 * k * w.place, 0.06 * k * w.place];
  return add(add(scale(low, 1 - w.lift), scale(high, w.lift)), into);
}

/** A bone from `from` reaching to `to`: its y along the way there, stretched to reach, its z as near `up` as that allows. */
function aimed(from: V3, to: V3, up: V3): Xf {
  const d = sub(to, from), l = Math.hypot(d[0], d[1], d[2]) || 1e-6, y = scale(d, 1 / l);
  let x: V3 = [y[1] * up[2] - y[2] * up[1], y[2] * up[0] - y[0] * up[2], y[0] * up[1] - y[1] * up[0]];
  if (Math.hypot(x[0], x[1], x[2]) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const z: V3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return { m: [x[0], y[0] * l, z[0], x[1], y[1] * l, z[1], x[2], y[2] * l, z[2]], t: from };
}

/** Evolving: wings folded up over its back as the light gathers, flung open wide at the flash, and settling. */
function evolvePose(s: Moth, t: number, p: Pose): void {
  const fold = ramp(t, 0.05, 0.42) * (1 - ramp(t, 0.46, 0.52)), open = ramp(t, 0.46, 0.52) * (1 - ramp(t, 0.62, 0.9));
  p.fore = lerp(lerp(p.fore, 84, fold), -8, open);
  p.hind = lerp(lerp(p.hind, 74, fold), -24, open);
  p.sweep = lerp(p.sweep, 20, open);
  p.z += 0.25 * fold + 0.15 * open;
  p.glow += 0.6 * fold + 0.9 * open;
  p.head[0] += -12 * fold + 8 * open;
  p.abd[0] += 18 * fold;
}

function poseOf(s: Moth, a: Anim): Pose {
  const p = hoverPose(s, a), act = a.act;
  if (act?.kind === 'strike') strikePose(s, act.t, p);
  else if (act?.kind === 'work') workPose(s, a, p);
  else if (act?.kind === 'evolve') evolvePose(s, act.t, p);
  return p;
}

/* ---- the bones ------------------------------------------------------------------------------ */

/** Where a wing's root is on the thorax: out to its side, toward the head and up on its back. Right side. */
const foreRoot = (s: Moth): V3 => [s.thorax[0] * 0.42, s.thorax[1] * 0.2, s.thorax[2] * 0.62];
const hindRoot = (s: Moth): V3 => [s.thorax[0] * 0.4, -s.thorax[1] * 0.22, s.thorax[2] * 0.58];
/** A right side's point on the left, for `sd` minus one. */
const sided = (p: V3, sd: number): V3 => [sd * p[0], p[1], p[2]];
/** A wing's bone: at its root (in the body's frame), beaten up by `lift` about the level line along the body, tilted with the thorax, swept by `sweep` within it. */
const wingXf = (body: Xf, root: V3, tilt: number, lift: number, sweep: number): Xf =>
  joint(joint(joint(body, root, 0, -lift, 0), [0, 0, 0], tilt, 0, 0), [0, 0, 0], 0, 0, sweep);

function mothBones(s: Moth): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [p.x, p.y, s.hover + p.z], p.pitch, p.roll, p.yaw);
    const tilt = s.tilt + p.tilt;
    const thorax = joint(body, [0, 0, 0], tilt, 0, 0);
    // The tilt alone, for where a point on the thorax is in the body's frame.
    const lean = joint(ROOT, [0, 0, 0], tilt, 0, 0);
    const T = s.thorax, H = s.head.r;
    const b: Bones = { body, thorax };
    // The head on the front of the thorax, turned back level so it looks ahead whatever the tilt.
    b.head = joint(thorax, [0, T[1] * 0.92 + H[1] * 0.35, T[2] * 0.2], -tilt + p.head[0], p.head[2], p.head[1]);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1;
      const top = onEgg([0, 0, 0], H, [sd * 0.42, -0.05, 0.9]).p;
      b[`ant${k}`] = joint(b.head, [top[0], top[1], top[2] - 0.02], p.ant * (k ? 1 : 0.7), -sd * 4, sd * 6);
      // Each wing lies along the thorax, tilted with it, and beats up and down about the level line through its root, so that
      // seen from in front it rises and falls and seen from the side it swings out toward the viewer and back. Roll lifts a
      // left wing and lowers a right one; yaw sweeps a right wing forward and a left one back.
      b[`fw${k}`] = wingXf(body, place(lean, sided(foreRoot(s), sd)), tilt, sd * p.fore, sd * p.sweep);
      b[`hw${k}`] = wingXf(body, place(lean, sided(hindRoot(s), sd)), tilt, sd * p.hind, sd * p.sweep * 0.6);
    }
    b.abd = joint(thorax, [0, -T[1] * 0.62, -T[2] * 0.08], p.abd[0], p.abd[1], 0);
    // The candle, while it has one, upright in front of it; once let go, carried on forward and up into the lantern.
    const working = a.act?.kind === 'work';
    if (working) b.candle = joint(body, candleAt(s, workOf(a)), 0, 0, 0);
    // The forelegs from under the front of the thorax: tucked up under its ruff, or reaching to the candle either side of it.
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1;
      const hip = place(thorax, [sd * T[0] * 0.32, T[1] * 0.5, -T[2] * 0.72]);
      const w = working ? workOf(a) : undefined;
      const reach = w ? Math.min(w.candle * 4, 1) * (1 - w.place) : 0;
      const tuck = place(thorax, [sd * T[0] * 0.42, T[1] * 0.95, -T[2] * 1.05]);
      const grip = b.candle ? place(b.candle, [sd * 0.09 * candleK(s), 0, waxTop(s) * 0.35]) : tuck;
      b[`arm${k}`] = aimed(hip, [lerp(tuck[0], grip[0], reach), lerp(tuck[1], grip[1], reach), lerp(tuck[2], grip[2], reach)], [0, 0, 1]);
    }
    if (s.vines) vineBones(s, a, b, p);
    // Its shadow on the ground under it, smaller the higher it is.
    const sk = 0.82 - 0.25 * clamp(p.z / 0.5);
    b.shadow = { m: [sk, 0, 0, 0, sk, 0, 0, 0, 1], t: [body.t[0], body.t[1], 0] };
    return b;
  };
}

/**
 * The Noctilure's vines, hanging from the trailing corners of its forewings: each link turned in the ground's frame, so the vine hangs straight
 * down whatever the wing is doing, swinging a little and trailing behind as it goes, each link a little after the one above.
 */
function vineBones(s: Moth, a: Anim, b: Bones, p: Pose): void {
  const L = s.fore.span, C = s.fore.chord, go = smooth(a.go), t = a.t;
  for (let sd = 0; sd < 2; sd++) {
    for (let q = 0; q < s.vines; q++) {
      // Where on the (right) forewing it hangs from, by its trailing corner, turned by the wing's rake as its mesh is, and
      // mirrored for the left.
      const x = L * (0.7 - 0.22 * q), y = -C * (0.5 - 0.02 * q), r = (s.fore.rake * Math.PI) / 180;
      const rx = x * Math.cos(r) - y * Math.sin(r), ry = x * Math.sin(r) + y * Math.cos(r);
      const root = place(b[`fw${sd}`], [sd ? rx : -rx, ry, wingWarp(L, C, -0.05)(x, y)]);
      let prev: Xf | null = null;
      let swing = 0, side = 0;
      for (let l = 0; l < VINE_LINKS; l++) {
        swing += -(4 + 16 * go) + 7 * Math.sin(t * TAU * 4 / LOOP * 6 - l * 0.8 + q + sd) * (1 - go) * 0.6 + 3 * Math.sin(beatPhase(a) - l * 0.9);
        side += 4 * Math.sin(t * TAU * 3 / LOOP * 4 - l * 0.7 + sd * 2 + q);
        const pos: V3 = prev ? place(prev, [0, 0, -VINE_LINK * (1 - 0.12 * (l - 1))]) : root;
        prev = joint(ROOT, pos, swing + p.abd[0] * 0.2, side, 0);
        b[`vine${sd}${q}_${l}`] = prev;
      }
    }
  }
}

/* ---- what it throws about --------------------------------------------------------------- */

const DUST: RGB = [236, 228, 168];
const DUST_GREEN: RGB = [196, 214, 130];
const SPARK: RGB = [255, 236, 170];

/** A soft light added over what is under it: bright in the middle, gone at its edge. */
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

/** The buffet's scale dust: a puff thrown forward off its wingtips at the blow, spreading and settling as it fades. */
function dustPuff(g: CanvasRenderingContext2D, view: View, s: Moth, b: Bones, t: number, front: boolean): void {
  const since = (t - MOTH_HITS[s.stage]) * ACT_SECS.strike;
  if (since < -0.03 || since > 0.32) return;
  const big = 1 + 0.5 * s.stage, mid = b.thorax.t, px = pxOf(g);
  const age = clamp(since / 0.32), al = (1 - age) ** 1.2;
  for (let k = 0; k < 2; k++) {
    const tip = place(b[`fw${k}`], [(k ? 1 : -1) * s.fore.span * 0.75, -s.fore.chord * 0.1, 0]);
    // A soft cloud of it first, where the wing came down.
    const cloud: V3 = [tip[0] * (1 - 0.3 * age), tip[1] + (0.4 + 0.8 * age) * big, tip[2] - 0.2 * big * age];
    if (nearSide(cloud, mid, view) === front) {
      const [x, y] = onScreen(view, cloud), r = (0.35 + 0.5 * age) * big;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, css(DUST, 0.7 * al));
      grad.addColorStop(1, css(DUST, 0));
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let q = 0; q < 11; q++) {
      const j = k * 11 + q, sp = (0.7 + 1.3 * jitter(j)) * big;
      const p: V3 = add(tip, [(jitter(j + 3) - 0.5) * 1.1 * big * age, (0.15 + sp) * age, (jitter(j + 5) - 0.65) * 0.9 * big * age]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const r = Math.max(1.4 * px, (0.06 + 0.06 * jitter(j + 7)) * big);
      g.fillStyle = css(q % 3 ? DUST : DUST_GREEN, 0.95 * al);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
}

/** Lighting the wick: sparks along the way from the tip of its lantern up to the wick, and a burst of light at the wick as it catches. */
function wickSpark(g: CanvasRenderingContext2D, view: View, s: Moth, b: Bones, a: Anim): void {
  const w = workOf(a);
  if (w.spark <= 0.02 || !b.candle) return;
  const kk = candleK(s), wick = place(b.candle, [0, 0, (waxTop(s) + 0.05 * kk) * w.candle]), tip = place(b.abd, [0, -s.abd.len * 0.96, 0]);
  const px = pxOf(g), t = a.act?.t ?? 0;
  for (let q = 0; q < 5; q++) {
    const u = frac(q / 5 + t * 4);
    const p: V3 = [lerp(tip[0], wick[0], u), lerp(tip[1], wick[1], u), lerp(tip[2], wick[2], u) + 0.12 * kk * Math.sin(Math.PI * u)];
    const [x, y] = onScreen(view, p);
    g.fillStyle = css(SPARK, w.spark * (0.5 + 0.5 * u));
    g.beginPath();
    g.arc(x, y, Math.max(1.2 * px, 0.04 * kk), 0, TAU);
    g.fill();
  }
  // The burst: a star of short rays round the wick, and light.
  const [x, y] = onScreen(view, wick), r = 0.32 * kk * (0.6 + 0.4 * w.spark);
  g.strokeStyle = css(SPARK, 0.9 * w.spark);
  g.lineWidth = Math.max(px, 0.035 * kk);
  g.lineCap = 'round';
  g.beginPath();
  for (let q = 0; q < 6; q++) {
    const an = (q / 6) * TAU + 0.3;
    g.moveTo(x + Math.cos(an) * r * 0.35, y + Math.sin(an) * r * 0.35);
    g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
  }
  g.stroke();
  light(g, x, y, 0.75 * kk, SPARK, 0.8 * w.spark);
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function mothKind(s: Moth): Kind {
  const bones = mothBones(s);
  return {
    bones,
    build: (lod) => mothBuild(s, lod),
    // The variant's coat tints its fur and the moss of its wings; its markings are the colour of its lantern's light. Its
    // antlers, its candle and its leaves' darks are the same on every variant.
    palette: (coat, mark) => {
      // Its wings' moss from the variant's own coat, not paled, so a bark-brown one and a lichen-grey one are told apart.
      const fur = mix(pastel(coat, 90), [104, 82, 58], 0.6), moss = mix(coat, [116, 146, 58], 0.35);
      const lamp = mix(mark, [255, 200, 80], 0.3);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: darker(fur, 0.25),
        coatLight: mix(mix(fur, [240, 228, 192], 0.55), lamp, 0.08),
        muzzle: [226, 208, 168],
        nose: [66, 46, 40],
        lid: darker(fur, 0.45),
        eye: [32, 22, 28],
        glint: [255, 253, 246],
        leaf: moss,
        feather: mix(lighter(moss, 0.14), [200, 214, 120], 0.12),
        leafDark: mix(moss, [52, 56, 30], 0.6),
        moss: mix(lighter(moss, 0.32), [222, 214, 120], 0.35),
        bark: mix([146, 104, 64], fur, 0.2),
        membrane: mix(moss, [150, 116, 72], 0.38),
        featherDark: mix(lighter(moss, 0.16), [176, 150, 96], 0.28),
        stem: [92, 104, 52],
        horn: [160, 122, 86],
        hornDark: [112, 82, 58],
        flame: lamp,
        bloom: mix(lamp, [255, 248, 200], 0.55),
        ember: mix(lamp, [226, 132, 40], 0.55),
        shell: [244, 234, 210],
        shellDark: [214, 198, 164],
        claw: [74, 58, 50],
      }, 90);
    },
    shadow: [s.thorax[1] * 1.6 + 0.2, s.fore.span * 0.8 + 0.2],
    stride: [1.1, 0.9, 0.75][s.stage],
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are lantern gold and moss.
    motes: [[255, 214, 110], [170, 190, 110]],
    // Its lantern, lit from inside, swelling and fading slowly; the candle's flame once it has caught.
    glow: (b, a) => {
      const p = poseOf(s, a), mid = place(b.abd, [0, -s.abd.len * 0.55, 0]), R = s.abd.r;
      const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [
        { p: mid, r: R * 4.2, c: [255, 196, 90], a: 0.2 * p.glow },
        { p: mid, r: R * 1.7, c: [255, 240, 190], a: 0.32 * p.glow },
      ];
      if (a.act?.kind === 'work' && b.candle) {
        const w = workOf(a), kk = candleK(s);
        if (w.lit > 0.05) out.push({ p: place(b.candle, [0, 0, flameAt(s) * w.candle]), r: 0.8 * kk * w.candle, c: [255, 210, 120], a: 0.45 * w.lit * w.candle });
      }
      return out;
    },
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      if (act.kind === 'strike') dustPuff(g, view, s, b, act.t, !under);
      else if (act.kind === 'work' && !under) wickSpark(g, view, s, b, a);
    },
  };
}

export const GLIMMOTH = mothKind(GLIMMOTH_LOOK);
export const LUREWING = mothKind(LUREWING_LOOK);
export const NOCTILURE = mothKind(NOCTILURE_LOOK);
