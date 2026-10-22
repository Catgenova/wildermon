import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The wind line: the Zephlet, a small serpentine wind-dragon pup sitting up
 * with its long tail coiled round in front of it, a cream belly in scaled
 * plates under a powder-blue back, big amber eyes, tiny fore paws held at its
 * chest and a crest of peach, blue and pink feathers on its head and cheeks;
 * which grows into the Galecrest, a slim four-legged dragon that stalks
 * crouched, its long neck low, a mane of big layered feathers -- peach over
 * blue over lilac -- from its head down its neck and along its back, lilac
 * legs with dark claws and a long feathered tail on the ground; and then the
 * Tempestwyrm, a great long-bodied feathered wyrm in an S down its length, a
 * feathered crest and mane, clawed legs, a long tail tufted with feathers, and
 * two big wings of layered feathers, blue and peach, with small stars in them.
 * The species is still `stona` underneath, as saves and the database know it:
 * a guard, whose ability is its Stoneskin (`warder_stoneskin`).
 *
 * A serpent is not a barrel on legs, so its body here is one long tube down a
 * spine of evenly spaced rings, tail tip to the back of the head, posed every
 * frame from two angles at each ring -- how steeply it climbs and which way it
 * heads -- added up from a ring it is held by (`spineOf`). Its skin and every
 * feather along it are carried by the ring they are on, so the whole of it
 * bends as one: a coil, an S, a wave running down it as it goes. A walk is a
 * wave sent back down its body and tail as its legs step, each foot put on
 * the ground and kept there while its leg is bent to reach it (`legOf`).
 *
 * Its feathers are in a breeze: each turns on its root, out from the body and
 * back, flutters a little standing, lies back as it goes and flares when it
 * strikes or wards. Standing it breathes, tilts its head, looks about and
 * ruffles its crest; at its post it stands up alert, crest raised, and looks
 * one way and the other. Its Stoneskin (`cast`): every feather flares and a
 * ward of shimmering wind wraps round it, three bright bands spinning round
 * its body, glinting, and fades.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Keys along the spine: (where along it, a value), smoothly between. */
type Keys = ReadonlyArray<readonly [number, number]>;

/** A feather's colour: its face, and its back. */
type Hue = 'blue' | 'peach' | 'lilac' | 'pink' | 'cream';
const HUES: Record<Hue, readonly [Mat, Mat, Mat]> = {
  blue: ['feather', 'feather', 'featherDark'],
  peach: ['petal', 'petal', 'bloom'],
  lilac: ['cap', 'cap', 'stem'],
  pink: ['bloom', 'bloom', 'inner'],
  cream: ['shell', 'shell', 'shellDark'],
};

/** What moves a feather: the crest on its head, its cheeks, the mane down its neck, the crest along its back, its tail, its wings. */
const G_CREST = 0, G_CHEEK = 1, G_MANE = 2, G_BACK = 3, G_TAIL = 4, G_WING = 5;
const GROUPS = 6;

/**
 * One feather: rooted at `root`, going `dir` for `len` and `w` across at its widest, its top facing `face`, bowed toward that by
 * `bow` of its length (negative, away) -- in the frame of the bone or the ring it is carried by. `gain` is how far it turns with its
 * group's flare.
 */
interface Plume { root: V3; dir: V3; face: V3; len: number; w: number; hue: Hue; bow?: number; group: number; gain?: number; fan?: number; stars?: number }

/** A leg: the ring it hangs from and where on that ring (across, along, up), its two lengths, how thick, and its paw. */
interface Leg {
  at: number;
  hip: V3;
  len: [number, number];
  w: [number, number];
  /** The paw: how wide, how long its claws are, how many. */
  paw: number; claw: number; claws: number;
  /** Where the foot stands going, from under the hip: out and forward. */
  stand: [number, number];
  /** A hind leg's third bone, from the hock down to the paw, as a cat's or a dragon's is: how long. */
  meta?: number;
}

/** Standing: where its hips are held, its spine's climb and heading along it, how much of its tail lies on the ground, its head's pitch. */
interface Still { at: V3; th: Keys; ps: Keys; ground: Keys; head: number }
/**
 * Going: where its hips are carried, its spine's climb and how much of its tail lies on the ground; how far the wave down it swings
 * it at each place along it, and its length; how far a foot reaches either way of its stride at a walk and a run, how much of the
 * stride it is down, how high it is lifted; how much the body bobs.
 */
interface Going {
  at: V3; th: Keys; ground: Keys; wave: Keys; length: number; amp: [number, number]; duty: [number, number]; lift: [number, number]; bob: number;
  /** A wave up and down it as well, as a caterpillar's (degrees at each place along it), and how far its hips swing side to side. */
  heave?: Keys; sway?: number;
}

interface Zeph {
  stage: 0 | 1 | 2;
  size: number;
  /** How long the spine is, tail tip to the back of the head, and how many rings down it. */
  len: number;
  N: number;
  /** Where along it the tail ends (the hips), and where the shoulders and the neck's root are. */
  hips: number; shoulders: number; neck: number;
  /** Half its width and half its depth down the spine. */
  w: Keys; h: Keys;
  /** Its head, in the head's own frame from the end of the neck: the skull's middle and half-sizes, the snout's, the eyes. */
  head: { c: V3; r: V3; snout: { at: V3; r: V3 }; jaw: { at: V3; r: V3 }; eye: { dir: V3; size: number; lid: number }; blush: number; scale?: number };
  fore: Leg;
  hind: Leg;
  plumes: (s: Zeph) => { head: Plume[]; spine: Array<Plume & { k: number }> };
  wings?: { at: number; arm: number; hand: number };
  still: Still;
  going: Going;
  /** Its shadow's half length and half width. */
  shadow: [number, number];
}

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

/** The value at `x` along keys, smoothly between them and held past either end. */
function keyed(keys: Keys, x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [x0, v0] = keys[q], [x1, v1] = keys[q + 1];
    if (x <= x1) return lerp(v0, v1, smooth((x - x0) / Math.max(1e-6, x1 - x0)));
  }
  return keys[keys.length - 1][1];
}
/** The value at `x` along keys, straight between them: for angles down a spine, so a coil bends evenly. */
function linear(keys: Keys, x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [x0, v0] = keys[q], [x1, v1] = keys[q + 1];
    if (x <= x1) return lerp(v0, v1, (x - x0) / Math.max(1e-6, x1 - x0));
  }
  return keys[keys.length - 1][1];
}
/** Keys sampled at every ring of a spine `len` long in `N` rings, once: smoothly between them, or straight (`lin`). */
const sampledKeys = new WeakMap<Keys, Map<string, Float64Array>>();
function atRings(keys: Keys, len: number, N: number, lin = false): Float64Array {
  let byLen = sampledKeys.get(keys);
  if (!byLen) sampledKeys.set(keys, (byLen = new Map()));
  const key = `${len}|${N}|${lin}`;
  let out = byLen.get(key);
  if (!out) {
    out = new Float64Array(N);
    for (let k = 0; k < N; k++) out[k] = (lin ? linear : keyed)(keys, (k / (N - 1)) * len);
    byLen.set(key, out);
  }
  return out;
}
/** How much of `x` is inside `a`..`b`, eased in over `e` at either end. */
const within = (x: number, a: number, b: number, e: number): number => ramp(x, a - e, a + e) * (1 - ramp(x, b - e, b + e));

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** `v` turned about the unit axis `k` by `a` radians. */
function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

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

/** A thin flat thing along a line of points, `widths` across, its top along `face`, folded a little down its middle: a feather. */
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
  // Its edges are found once the feathers it goes into are put together (`plumage`).
  return { v, f: woundTo(v, f, want), e: [] };
}

/** A feather's mesh: a long pointed blade, widest a third of the way out, bowed along its length. */
function plumeMesh(p: Plume, K: number): Mesh {
  const d = unit(p.dir), f = unit(sub(p.face, scale(d, dot(p.face, d))));
  const tip = add(p.root, scale(d, p.len)), mid = add(add(p.root, scale(d, p.len * 0.5)), scale(f, p.len * (p.bow ?? 0.12)));
  // Narrow at its root, broad through its middle, rounded to a point.
  const widths = Array.from({ length: K }, (_, k) => {
    const x = k / (K - 1);
    return Math.max(0.006, p.w * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(0.999, x ** 0.75)) ** 0.55) * (x > 0.999 ? 0 : 1));
  });
  const pts = curve(p.root, mid, tip, K - 1), blade = sheet(pts, widths, f, 0.2, HUES[p.hue]);
  if (!p.stars) return blade;
  // Small stars painted on it, two thirds of the way out and toward its tip.
  const side = unit(cross(d, f)), out: Disc[] = [];
  for (let q = 0; q < p.stars; q++) {
    const u = 0.5 + 0.3 * q, c = add(add(add(p.root, scale(d, p.len * u)), scale(f, p.len * (p.bow ?? 0.12) * 0.9 + 0.012)), scale(side, (q % 2 ? -0.3 : 0.25) * p.w));
    const r = p.w * (0.42 - 0.08 * q), v: V3[] = [];
    for (let e = 0; e < 8; e++) {
      const a = (e / 8) * TAU, k = e % 2 ? 0.32 : 1;
      v.push(add(c, add(scale(side, Math.cos(a) * r * k), scale(d, Math.sin(a) * r * k * 1.2))));
    }
    out.push({ v: dot(cross(sub(v[1], v[0]), sub(v[2], v[0])), f) < 0 ? v.reverse() : v, m: 'spot', lit: true });
  }
  return merge(blade, paint(out));
}

/**
 * Feathers as one mesh, and for each corner which feather it is of, so each can be turned on its root: lifted off what it lies on
 * (about `axis`), and a wing's fanned shut along its bone as the wing folds (about `face`, by `fan`).
 */
interface Plumage { mesh: Mesh; of: Int16Array; root: V3[]; axis: V3[]; face: V3[]; group: number[]; gain: number[]; fan: number[]; ring: Int16Array }
function plumage(list: ReadonlyArray<Plume & { k?: number }>, K: number): Plumage {
  const meshes: Mesh[] = [], of: number[] = [], ring: number[] = [];
  const root: V3[] = [], axis: V3[] = [], face: V3[] = [], group: number[] = [], gain: number[] = [], fan: number[] = [];
  list.forEach((p, q) => {
    const m = plumeMesh(p, K);
    meshes.push(m);
    for (let c = 0; c < m.v.length; c++) { of.push(q); ring.push(p.k ?? -1); }
    root.push(p.root);
    // Turned about the line square to it and to its top, so a positive turn lifts it off whatever it lies on.
    axis.push(unit(cross(unit(p.dir), unit(p.face))));
    face.push(unit(p.face));
    group.push(p.group);
    gain.push(p.gain ?? 1);
    fan.push(p.fan ?? 0);
  });
  return { mesh: merge(...meshes), of: Int16Array.from(of), root, axis, face, group, gain, fan, ring: Int16Array.from(ring) };
}

/** The turn by `a` radians about the unit axis `k`, as a matrix, rows first. */
function turning(k: V3, a: number): number[] {
  const c = Math.cos(a), s1 = Math.sin(a), t = 1 - c, [x, y, z] = k;
  return [t * x * x + c, t * x * y - s1 * z, t * x * z + s1 * y, t * x * y + s1 * z, t * y * y + c, t * y * z - s1 * x, t * x * z - s1 * y, t * y * z + s1 * x, t * z * z + c];
}
const times = (m: readonly number[], v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
function product(a: readonly number[], b: readonly number[]): number[] {
  const o = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}

/* ---- the three, as numbers ------------------------------------------------------------- */

/** A feather rooted on the spine's ring `k`, `phi` round from the top of it (toward its right, positive), going back and out. */
function onRing(s: Zeph, k: number, phi: number, o: { len: number; w: number; hue: Hue; back?: number; out?: number; up?: number; group: number; bow?: number; gain?: number; sink?: number }): Plume & { k: number } {
  const S = sOf(s, k), w = keyed(s.w, S), h = keyed(s.h, S), sink = o.sink ?? 0.18;
  const root: V3 = [Math.sin(phi) * w * (1 - sink), 0, Math.cos(phi) * h * (1 - sink)];
  const n = unit([Math.sin(phi) * h, 0, Math.cos(phi) * w]);
  const dir = unit(add(add(scale([0, -1, 0], o.back ?? 1), scale(n, o.up ?? 0.5)), scale([Math.sign(phi), 0, 0], o.out ?? 0)));
  return { k, root, dir, face: n, len: o.len, w: o.w, hue: o.hue, group: o.group, bow: o.bow ?? 0.1, gain: o.gain };
}
/** The ring nearest to `S` along the spine. */
const ringAt = (s: Zeph, S: number): number => Math.max(0, Math.min(s.N - 1, Math.round((S / s.len) * (s.N - 1))));

/**
 * A mane down the spine: a row of feathers at each place in `rows` (where along the spine, how long its middle feather is), each a
 * feather up the middle swept back, a pair either side fanned out over the flanks and, where `low` says, a pair lower still over the
 * shoulders like a cape -- each layer its own colour, the rows' colours turning over so the whole is layered peach over blue over
 * lilac and cream.
 */
function maneOf(s: Zeph, o: { rows: ReadonlyArray<readonly [number, number]>; w: number; group: number; hues: readonly Hue[]; low: Keys; up?: number; bow?: number }): Array<Plume & { k: number }> {
  const out: Array<Plume & { k: number }> = [];
  o.rows.forEach(([S, L], r) => {
    const k = ringAt(s, S), lo = keyed(o.low, S), up = o.up ?? 1, bow = o.bow ?? 0.1;
    const hue = (q: number): Hue => o.hues[(r + q) % o.hues.length];
    if (lo > 0.05) for (const sd of [-1, 1]) out.push(onRing(s, k, sd * 1.25, { len: L * 0.7 * lo, w: o.w * 0.9, hue: hue(2), back: 1, up: 0.15, out: 0.55, group: o.group, bow: bow * 0.5, gain: 0.6, sink: 0.25 }));
    for (const sd of [-1, 1]) out.push(onRing(s, k, sd * 0.6, { len: L * 0.85, w: o.w * 0.95, hue: hue(1), back: 1, up: 0.75 * up, out: 0.45, group: o.group, bow, gain: 0.85 }));
    out.push(onRing(s, k, 0, { len: L, w: o.w, hue: hue(0), back: 1, up: 1.05 * up, group: o.group, bow, gain: 1 }));
  });
  return out;
}

/** A tuft on the tail at `S`: `count` feathers fanned about it, going on the way the tail goes, `len` long. */
function tuftOf(s: Zeph, S: number, count: number, len: number, w: number, hues: readonly Hue[], spread = 0.9): Array<Plume & { k: number }> {
  const k = ringAt(s, S), out: Array<Plume & { k: number }> = [];
  for (let q = 0; q < count; q++) {
    const phi = count > 1 ? (q / (count - 1) - 0.5) * 2 * spread : 0;
    out.push(onRing(s, k, phi === 0 ? 0 : phi, { len: len * (1 - 0.18 * Math.abs(phi)), w, hue: hues[q % hues.length], back: 1, up: 0.32, out: 0.3, group: G_TAIL, bow: -0.05, sink: 0.3 }));
  }
  return out;
}

/**
 * A wing's feathers, in the wing's own frame (out along the arm, its leading edge forward, its top up), for the right wing: on the
 * arm two rows of coverts, peach over blue, over the long secondaries; on the hand the primaries fanned out from it and a row of
 * peach coverts over their roots. Each a little star or two painted on it.
 */
function wingOf(arm: number, hand: number): { arm: Plume[]; hand: Plume[] } {
  const A: Plume[] = [], H: Plume[] = [];
  const up: V3 = [0, 0, 1];
  const SEC: Hue[] = ['blue', 'lilac', 'blue', 'peach', 'lilac', 'blue', 'lilac'];
  for (let q = 0; q < 7; q++) {
    const u = q / 6, x = 0.15 + u * (arm - 0.15);
    A.push({ root: [x, -0.05, 0], dir: [0.12 + 0.35 * u, -1, 0], face: up, len: (0.9 + 0.5 * u) * arm * 0.5, w: 0.3, hue: SEC[q], bow: 0.05, group: G_WING, gain: 0.35 });
  }
  // The coverts over the roots of the flight feathers on both sides of the wing, which is seen from under as much as from over.
  for (const z of [1, -1]) {
    const face: V3 = [0, 0, z];
    for (let q = 0; q < 6; q++) {
      const u = q / 5, x = 0.1 + u * (arm - 0.1);
      A.push({ root: [x, 0.06, 0.04 * z], dir: [0.25 + 0.3 * u, -1, 0.02 * z], face, len: (0.8 + 0.2 * u) * arm * 0.42, w: 0.28, hue: q % 3 === 2 ? 'pink' : 'peach', bow: 0.05, group: G_WING, gain: 0.45 });
    }
    for (let q = 0; q < 4; q++) {
      const u = q / 3, x = 0.12 + u * (arm - 0.25);
      A.push({ root: [x, 0.15, 0.08 * z], dir: [0.35 + 0.2 * u, -1, 0.03 * z], face, len: 0.2 * arm + 0.05, w: 0.2, hue: q % 2 ? 'cream' : 'blue', bow: 0.05, group: G_WING, gain: 0.5 });
    }
  }
  for (let q = 0; q < 7; q++) {
    const u = q / 6, x = 0.05 + u * hand * 0.85, ang = lerp(-0.95, -0.04, u);
    H.push({ root: [x, -0.02, -0.03 + 0.006 * q], dir: [Math.cos(ang), Math.sin(ang), 0], face: up, len: (1.2 + 0.8 * Math.sin(u * Math.PI * 0.8)) * hand * 0.8, w: 0.32, hue: q === 1 || q === 4 ? 'peach' : 'blue', bow: 0.05, group: G_WING, gain: 0.3 + 0.2 * u });
  }
  for (const z of [1, -1]) {
    for (let q = 0; q < 5; q++) {
      const u = q / 4, x = 0.05 + u * hand * 0.75, ang = lerp(-1.1, -0.25, u);
      H.push({ root: [x, 0.07, 0.04 * z], dir: [Math.cos(ang), Math.sin(ang), 0.03 * z], face: [0, 0, z], len: 0.35 * hand + 0.05, w: 0.24, hue: q % 2 ? 'pink' : 'peach', bow: 0.05, group: G_WING, gain: 0.45 });
    }
  }
  return { arm: A, hand: H };
}

/** A Zephlet: a pup sitting up, its tail coiled round in front of it, a big round head with a crest and cheek frills, tiny paws. */
const ZEPHLET_LOOK: Zeph = {
  stage: 0, size: 2.8,
  len: 4.35, N: 38, hips: 3.0, shoulders: 3.55, neck: 3.62,
  w: [[0, 0.035], [0.4, 0.09], [1.2, 0.2], [2.3, 0.31], [3.0, 0.42], [3.25, 0.39], [3.55, 0.27], [3.8, 0.17], [4.35, 0.15]],
  h: [[0, 0.035], [0.4, 0.09], [1.2, 0.19], [2.3, 0.29], [3.0, 0.4], [3.25, 0.37], [3.55, 0.26], [3.8, 0.17], [4.35, 0.15]],
  head: {
    c: [0, 0.14, 0.14], r: [0.36, 0.38, 0.33],
    snout: { at: [0, 0.38, 0.0], r: [0.25, 0.27, 0.2] }, jaw: { at: [0, 0.38, -0.1], r: [0.17, 0.24, 0.06] },
    eye: { dir: [0.64, 0.6, 0.26], size: 0.1, lid: 0.1 }, blush: 0.065,
  },
  fore: { at: 3.4, hip: [0.17, 0, -0.17], len: [0.15, 0.14], w: [0.07, 0.055], paw: 0.065, claw: 0.035, claws: 3, stand: [0.05, 0.05] },
  hind: { at: 3.1, hip: [0.27, 0, -0.12], len: [0.2, 0.18], w: [0.1, 0.075], paw: 0.09, claw: 0.04, claws: 3, stand: [0.06, 0.02] },
  plumes: (s) => ({
    head: [
      // The crest: long feathers back off the crown and up, peach in the middle, blue either side, short pink ones ahead.
      { root: [0, 0.06, 0.4], dir: [0, -1, 0.6], face: [0, 0.65, 0.75], len: 0.66, w: 0.195, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [0.11, 0.04, 0.38], dir: [0.3, -0.95, 0.5], face: [0.3, 0.6, 0.75], len: 0.58, w: 0.169, hue: 'blue', bow: 0.12, group: G_CREST },
      { root: [-0.11, 0.04, 0.38], dir: [-0.3, -0.95, 0.5], face: [-0.3, 0.6, 0.75], len: 0.58, w: 0.169, hue: 'blue', bow: 0.12, group: G_CREST },
      { root: [0.06, 0.2, 0.38], dir: [0.15, -0.75, 0.75], face: [0.1, 0.8, 0.6], len: 0.36, w: 0.13, hue: 'pink', bow: 0.1, group: G_CREST },
      { root: [-0.06, 0.2, 0.38], dir: [-0.15, -0.75, 0.75], face: [-0.1, 0.8, 0.6], len: 0.36, w: 0.13, hue: 'peach', bow: 0.1, group: G_CREST },
      { root: [0.15, -0.08, 0.32], dir: [0.45, -0.9, 0.3], face: [0.4, 0.2, 1], len: 0.5, w: 0.156, hue: 'peach', bow: 0.1, group: G_CREST },
      { root: [-0.15, -0.08, 0.32], dir: [-0.45, -0.9, 0.3], face: [-0.4, 0.2, 1], len: 0.5, w: 0.156, hue: 'peach', bow: 0.1, group: G_CREST },
      { root: [0, -0.16, 0.3], dir: [0, -1, 0.3], face: [0, 0.3, 1], len: 0.5, w: 0.169, hue: 'lilac', bow: 0.1, group: G_CREST },
      // A frill back off each cheek: peach over pink, a blue one over them.
      ...[1, -1].flatMap((sd): Plume[] => [
        { root: [sd * 0.3, 0.08, 0.04], dir: [sd * 0.55, -0.85, 0.15], face: [sd * 0.3, 0.2, 1], len: 0.4, w: 0.143, hue: 'peach', bow: 0.08, group: G_CHEEK },
        { root: [sd * 0.29, 0.06, -0.07], dir: [sd * 0.6, -0.8, -0.2], face: [sd * 0.2, 0.1, 1], len: 0.32, w: 0.13, hue: 'pink', bow: 0.08, group: G_CHEEK },
        { root: [sd * 0.3, 0.02, 0.15], dir: [sd * 0.45, -0.85, 0.35], face: [sd * 0.3, 0.2, 1], len: 0.36, w: 0.117, hue: 'blue', bow: 0.08, group: G_CHEEK },
      ]),
    ],
    spine: [
      // A few small feathers down the back of its neck, and a tuft at its tail's tip.
      ...maneOf(s, { rows: [[4.15, 0.34], [3.95, 0.3], [3.75, 0.26]], w: 0.12, group: G_MANE, hues: ['blue', 'peach', 'lilac'], low: [[0, 0]], up: 0.45 }),
      ...tuftOf(s, 0.12, 3, 0.36, 0.11, ['peach', 'blue', 'pink'], 0.7),
    ],
  }),
  still: {
    // Sitting up: the body upright off its hips, chest out, the long neck curving back and then forward; the tail going back and
    // round in front of it on the ground, its tip curled up.
    at: [0, -0.12, 0.36],
    th: [[0, -50], [0.25, -20], [0.5, 0], [2.5, 0], [2.75, 40], [3.0, 80], [3.25, 88], [3.5, 100], [3.85, 100], [4.1, 78], [4.35, 50]],
    ps: [[0, 345], [0.5, 285], [1.6, 186], [2.65, 92], [2.9, 30], [3.0, 0], [4.35, 0]],
    ground: [[0, 0], [0.45, 1], [2.5, 1], [2.8, 0]],
    head: -6,
  },
  going: {
    // Lying along the ground going, its neck up and forward and its head level.
    at: [0, -0.55, 0.42], th: [[0, -4], [2.7, -3], [3.0, 4], [3.55, 6], [3.75, 38], [4.35, 46]], ground: [[0, 0.7], [2.4, 0.7], [2.9, 0]],
    wave: [[0, 60], [1.2, 46], [2.6, 22], [3.0, 16], [3.55, 12], [4.35, 4]], length: 2.6, amp: [0.16, 0.22], duty: [0.6, 0.42], lift: [0.08, 0.12], bob: 0.04,
    heave: [[0, 4], [1.5, 8], [2.8, 14], [3.4, 12], [3.8, 4], [4.35, 0]], sway: 0.09,
  },
  shadow: [0.85, 0.75],
};

/** A Galecrest: slim on long legs in a wide crouched stride, its neck held low, a mane of big layered feathers swept back, a long feathered tail. */
const GALECREST_LOOK: Zeph = {
  stage: 1, size: 2.5,
  len: 6.5, N: 46, hips: 3.2, shoulders: 5.0, neck: 5.15,
  w: [[0, 0.03], [0.6, 0.07], [1.5, 0.12], [2.5, 0.19], [3.2, 0.3], [3.7, 0.34], [4.4, 0.35], [5.0, 0.31], [5.3, 0.22], [5.9, 0.18], [6.5, 0.17]],
  h: [[0, 0.03], [0.6, 0.07], [1.5, 0.12], [2.5, 0.2], [3.2, 0.31], [3.7, 0.36], [4.4, 0.4], [5.0, 0.37], [5.3, 0.25], [5.9, 0.2], [6.5, 0.18]],
  head: {
    c: [0, 0.2, 0.11], r: [0.35, 0.39, 0.3],
    snout: { at: [0, 0.6, 0], r: [0.22, 0.4, 0.17] }, jaw: { at: [0, 0.53, -0.12], r: [0.17, 0.37, 0.06] },
    eye: { dir: [0.66, 0.6, 0.32], size: 0.105, lid: 0.35 }, blush: 0, scale: 1.15,
  },
  fore: { at: 4.8, hip: [0.2, 0, -0.26], len: [0.74, 0.7], w: [0.15, 0.08], paw: 0.11, claw: 0.11, claws: 3, stand: [0.06, 0.5] },
  hind: { at: 3.4, hip: [0.22, 0, -0.2], len: [0.68, 0.64], w: [0.22, 0.1], paw: 0.12, claw: 0.11, claws: 3, stand: [0.08, -0.5], meta: 0.48 },
  plumes: (s) => ({
    head: [
      { root: [0, 0.06, 0.3], dir: [0, -0.9, 0.55], face: [0, 0.5, 0.85], len: 1.062, w: 0.213, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [0.1, 0.04, 0.28], dir: [0.3, -0.9, 0.45], face: [0.3, 0.5, 0.8], len: 0.9, w: 0.188, hue: 'blue', bow: 0.12, group: G_CREST },
      { root: [-0.1, 0.04, 0.28], dir: [-0.3, -0.9, 0.45], face: [-0.3, 0.5, 0.8], len: 0.9, w: 0.188, hue: 'blue', bow: 0.12, group: G_CREST },
      { root: [0.07, 0.2, 0.27], dir: [0.2, -0.6, 0.9], face: [0.2, 0.9, 0.4], len: 0.688, w: 0.163, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [-0.07, 0.2, 0.27], dir: [-0.2, -0.6, 0.9], face: [-0.2, 0.9, 0.4], len: 0.688, w: 0.163, hue: 'pink', bow: 0.12, group: G_CREST },
      { root: [0, -0.1, 0.26], dir: [0, -1, 0.3], face: [0, 0.3, 1], len: 0.875, w: 0.188, hue: 'lilac', bow: 0.1, group: G_CREST },
      ...[1, -1].flatMap((sd): Plume[] => [
        { root: [sd * 0.26, 0.12, 0], dir: [sd * 0.5, -0.85, 0.15], face: [sd * 0.3, 0.2, 1], len: 0.625, w: 0.15, hue: 'peach', bow: 0.08, group: G_CHEEK },
        { root: [sd * 0.25, 0.08, -0.1], dir: [sd * 0.5, -0.85, 0.02], face: [sd * 0.2, 0.1, 1], len: 0.525, w: 0.125, hue: 'pink', bow: 0.08, group: G_CHEEK },
      ]),
    ],
    spine: [
      ...maneOf(s, { rows: [[6.3, 0.8], [6.0, 1.0], [5.7, 1.2], [5.4, 1.35], [5.1, 1.5]], w: 0.34, group: G_MANE, hues: ['peach', 'blue', 'peach', 'lilac'], low: [[5.1, 1], [6.3, 0.6]], up: 1.6, bow: 0.16 }),
      ...maneOf(s, { rows: [[4.8, 1.8], [4.45, 1.7], [4.1, 1.5], [3.75, 1.25], [3.4, 0.95]], w: 0.36, group: G_BACK, hues: ['peach', 'blue', 'peach', 'cream'], low: [[3.5, 0.3], [4.2, 0.8], [4.8, 1]], up: 1.9, bow: 0.16 }),
      // The tail a long plume: feathers down both sides of its last half and along its top, lying back along it.
      ...[0.3, 0.7, 1.1, 1.5, 1.9, 2.3].flatMap((S, q) => [-1, 0, 1].map((sd) => onRing(s, ringAt(s, S), sd * 1.05, { len: (sd ? 1.35 : 1.0) - 0.1 * q, w: sd ? 0.14 : 0.12, hue: (['peach', 'blue', 'lilac', 'cream'] as const)[(q + sd + 1) % 4], back: 1, up: sd ? 0.22 : 0.35, out: 0.4, group: G_TAIL, bow: 0.08, sink: 0.3 }))),
      ...tuftOf(s, 0.1, 3, 1.0, 0.15, ['peach', 'blue', 'cream'], 0.6),
    ],
  }),
  still: {
    // Crouched to stalk in a long stride: its shoulders a little under its hips, the neck forward and the head low, the tail along the
    // ground in a long S, its tip up off it.
    at: [0, -0.95, 1.18],
    th: [[0, -14], [0.4, -4], [0.8, 0], [2.0, 0], [2.6, 28], [3.0, 18], [3.2, 4], [5.0, -7], [5.2, 12], [5.6, 18], [6.0, 2], [6.5, -14]],
    ps: [[0, -40], [0.8, -14], [1.6, 10], [2.4, 8], [3.2, 0], [6.5, 0]],
    ground: [[0, 0.6], [0.3, 1], [2.0, 1], [2.7, 0]],
    head: -8,
  },
  going: {
    at: [0, -0.95, 1.24], th: [[0, -6], [0.5, -2], [2.2, 0], [2.8, 22], [3.2, 4], [5.0, -2], [5.2, 22], [5.7, 30], [6.1, 12], [6.5, -4]], ground: [[0, 0.75], [1.6, 0.8], [2.8, 0]],
    wave: [[0, 40], [1.5, 28], [2.8, 10], [3.3, 5], [5.0, 4], [6.5, 0]], length: 3.6, amp: [0.34, 0.48], duty: [0.62, 0.4], lift: [0.18, 0.26], bob: 0.04,
  },
  shadow: [1.9, 0.8],
};

/** A Tempestwyrm: long and great, an S down its body, a tall neck, a crest and mane, clawed legs, a long tufted tail, two big feathered wings. */
const TEMPESTWYRM_LOOK: Zeph = {
  stage: 2, size: 2.3,
  len: 10.6, N: 64, hips: 4.4, shoulders: 7.8, neck: 7.95,
  w: [[0, 0.05], [1, 0.12], [2.1, 0.22], [3.3, 0.35], [4.4, 0.58], [5.4, 0.66], [7.0, 0.68], [7.8, 0.58], [8.2, 0.38], [9.4, 0.29], [10.6, 0.27]],
  h: [[0, 0.05], [1, 0.12], [2.1, 0.23], [3.3, 0.37], [4.4, 0.62], [5.4, 0.74], [7.0, 0.76], [7.8, 0.66], [8.2, 0.42], [9.4, 0.31], [10.6, 0.29]],
  head: {
    c: [0, 0.24, 0.13], r: [0.42, 0.5, 0.37],
    snout: { at: [0, 0.76, -0.02], r: [0.26, 0.48, 0.21] }, jaw: { at: [0, 0.68, -0.18], r: [0.22, 0.46, 0.08] },
    eye: { dir: [0.72, 0.55, 0.34], size: 0.115, lid: 0.4 }, blush: 0, scale: 1.25,
  },
  fore: { at: 7.5, hip: [0.4, 0, -0.46], len: [0.78, 0.74], w: [0.26, 0.15], paw: 0.18, claw: 0.17, claws: 3, stand: [0.12, 0.75] },
  hind: { at: 4.7, hip: [0.42, 0, -0.38], len: [0.66, 0.62], w: [0.32, 0.17], paw: 0.19, claw: 0.16, claws: 3, stand: [0.14, -0.5], meta: 0.46 },
  plumes: (s) => ({
    head: [
      { root: [0, 0.04, 0.42], dir: [0, -0.9, 0.55], face: [0, 0.5, 0.85], len: 1.44, w: 0.264, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [0.14, 0.08, 0.38], dir: [0.3, -0.85, 0.6], face: [0.3, 0.5, 0.8], len: 1.26, w: 0.24, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [-0.14, 0.08, 0.38], dir: [-0.3, -0.85, 0.6], face: [-0.3, 0.5, 0.8], len: 1.26, w: 0.24, hue: 'peach', bow: 0.12, group: G_CREST },
      { root: [0.2, -0.04, 0.34], dir: [0.5, -0.85, 0.3], face: [0.4, 0.3, 1], len: 1.14, w: 0.228, hue: 'blue', bow: 0.1, group: G_CREST },
      { root: [-0.2, -0.04, 0.34], dir: [-0.5, -0.85, 0.3], face: [-0.4, 0.3, 1], len: 1.14, w: 0.228, hue: 'blue', bow: 0.1, group: G_CREST },
      { root: [0.08, 0.26, 0.36], dir: [0.2, -0.5, 1], face: [0.2, 1, 0.3], len: 0.84, w: 0.18, hue: 'cream', bow: 0.12, group: G_CREST },
      { root: [-0.08, 0.26, 0.36], dir: [-0.2, -0.5, 1], face: [-0.2, 1, 0.3], len: 0.84, w: 0.18, hue: 'pink', bow: 0.12, group: G_CREST },
      { root: [0, -0.16, 0.34], dir: [0, -1, 0.25], face: [0, 0.3, 1], len: 1.2, w: 0.228, hue: 'lilac', bow: 0.1, group: G_CREST },
      ...[1, -1].flatMap((sd): Plume[] => [
        { root: [sd * 0.36, 0.15, 0], dir: [sd * 0.55, -0.82, 0.12], face: [sd * 0.3, 0.2, 1], len: 0.84, w: 0.192, hue: 'peach', bow: 0.08, group: G_CHEEK },
        { root: [sd * 0.35, 0.1, -0.12], dir: [sd * 0.6, -0.78, 0.02], face: [sd * 0.2, 0.1, 1], len: 0.696, w: 0.18, hue: 'pink', bow: 0.08, group: G_CHEEK },
        { root: [sd * 0.37, 0.12, 0.12], dir: [sd * 0.45, -0.85, 0.35], face: [sd * 0.3, 0.2, 1], len: 0.72, w: 0.168, hue: 'blue', bow: 0.08, group: G_CHEEK },
      ]),
    ],
    spine: [
      ...maneOf(s, { rows: [[10.4, 0.9], [10.05, 1.15], [9.7, 1.35], [9.35, 1.5], [9.0, 1.55], [8.65, 1.5], [8.3, 1.4]], w: 0.4, group: G_MANE, hues: ['peach', 'cream', 'peach', 'blue'], low: [[8.2, 1], [10.4, 0.7]], up: 0.9, bow: 0.15 }),
      ...maneOf(s, { rows: [[7.5, 0.9], [7.0, 0.82], [6.5, 0.74], [6.0, 0.66], [5.5, 0.58], [5.0, 0.5]], w: 0.36, group: G_BACK, hues: ['blue', 'peach', 'lilac'], low: [[0, 0]], up: 0.75, bow: 0.12 }),
      ...tuftOf(s, 2.4, 3, 0.7, 0.2, ['peach', 'blue', 'cream'], 1.2),
      ...tuftOf(s, 1.3, 4, 0.85, 0.21, ['blue', 'peach', 'lilac', 'cream'], 1.2),
      ...tuftOf(s, 0.1, 4, 1.05, 0.23, ['peach', 'blue', 'cream', 'lilac'], 0.8),
    ],
  }),
  wings: { at: 7.45, arm: 2.8, hand: 2.5 },
  still: {
    // Long and level, the chest held up and the neck high in an S; the tail down off its hips and round its near side, forward along
    // it and out past its fore feet.
    at: [0, -1.7, 1.3],
    th: [[0, -16], [0.4, -6], [0.8, 0], [2.7, 0], [3.6, 24], [4.2, 14], [4.4, 6], [6.0, 6], [7.8, 14], [8.1, 62], [8.9, 82], [9.7, 50], [10.2, 0], [10.6, -26]],
    ps: [[0, 205], [0.6, 192], [1.3, 178], [2.1, 140], [2.8, 80], [3.8, 22], [4.4, 0], [6.0, 7], [7.6, 8], [8.6, -6], [10.6, -8]],
    ground: [[0, 0.5], [0.4, 1], [2.7, 1], [3.9, 0]],
    head: -16,
  },
  going: {
    at: [0, -1.7, 1.34], th: [[0, -6], [0.6, -2], [2.9, 0], [3.9, 14], [4.4, 6], [7.8, 4], [8.1, 42], [8.9, 54], [9.8, 18], [10.6, -12]], ground: [[0, 0.8], [2.4, 0.85], [3.9, 0]],
    wave: [[0, 32], [2, 24], [3.7, 10], [4.6, 5], [7.8, 4], [10.6, 0]], length: 5.0, amp: [0.42, 0.58], duty: [0.62, 0.42], lift: [0.22, 0.32], bob: 0.05,
  },
  shadow: [3.0, 1.4],
};

/* ---- its moves, in time -------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Zephlet's snap, the Galecrest's pounce, the Tempestwyrm's buffet. */
export const ZEPHYR_HITS: readonly number[] = [0.5, 0.52, 0.5];
/** Its Stoneskin, as shares of the cast: drawing the wind in, the ward wrapping round it, and the ward gone. */
export const ZEPHYR_WARD = { gather: 0.3, wrap: 0.42, gone: 1 } as const;

/* ---- its pose ---------------------------------------------------------------------------------- */

/** A pose: where its anchor ring is, its spine's climb and heading at every ring, its head, its feathers, its legs and its wings. */
interface Pose {
  at: V3;
  th: Float64Array;
  ps: Float64Array;
  /** How much of the way down to the ground each ring of its tail is let. */
  ground: Float64Array;
  /** The head: nose up (degrees, against level), turned left past the neck's heading, tilted; the jaw open, nought to one. */
  head: [number, number, number];
  jaw: number;
  /** Each group's flare (radians), and how much the breeze moves them. */
  flare: number[];
  flutter: number;
  breath: number;
  /** Where each foot is to be (fl, fr, hl, hr) and how far its toes are curled under. */
  feet: V3[];
  curl: number[];
  wing: { open: number; flap: number };
}

/** The ring a pose holds still and adds the rest up from: the hips. */
const anchorOf = (s: Zeph): number => ringAt(s, s.hips);

function blank(s: Zeph): Pose {
  return {
    at: [0, 0, 0], th: new Float64Array(s.N), ps: new Float64Array(s.N), ground: new Float64Array(s.N), head: [0, 0, 0], jaw: 0, flare: new Array(GROUPS).fill(0),
    flutter: 1, breath: 0.5, feet: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], curl: [0, 0, 0, 0], wing: { open: 0.5, flap: 0 },
  };
}
function mixPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const out = blank({ N: a.th.length } as Zeph);
  out.at = [lerp(a.at[0], b.at[0], k), lerp(a.at[1], b.at[1], k), lerp(a.at[2], b.at[2], k)];
  for (let q = 0; q < a.th.length; q++) { out.th[q] = lerp(a.th[q], b.th[q], k); out.ps[q] = lerp(a.ps[q], b.ps[q], k); out.ground[q] = lerp(a.ground[q], b.ground[q], k); }
  out.head = [lerp(a.head[0], b.head[0], k), lerp(a.head[1], b.head[1], k), lerp(a.head[2], b.head[2], k)];
  out.jaw = lerp(a.jaw, b.jaw, k);
  out.flare = a.flare.map((f, q) => lerp(f, b.flare[q], k));
  out.flutter = lerp(a.flutter, b.flutter, k);
  out.breath = lerp(a.breath, b.breath, k);
  out.feet = a.feet.map((f, q) => [lerp(f[0], b.feet[q][0], k), lerp(f[1], b.feet[q][1], k), lerp(f[2], b.feet[q][2], k)] as V3);
  out.curl = a.curl.map((c, q) => lerp(c, b.curl[q], k));
  out.wing = { open: lerp(a.wing.open, b.wing.open, k), flap: lerp(a.wing.flap, b.wing.flap, k) };
  return out;
}
/** Each ring's place along the spine. */
const sOf = (s: Zeph, k: number): number => (k / (s.N - 1)) * s.len;
/** Climb and heading at every ring from keys along the spine, in degrees. */
function profile(s: Zeph, P: Pose, th: Keys, ps: Keys, ground: Keys): void {
  const TH = atRings(th, s.len, s.N, true), PS = atRings(ps, s.len, s.N, true), GR = atRings(ground, s.len, s.N);
  for (let k = 0; k < s.N; k++) {
    P.th[k] = TH[k] * DEG;
    P.ps[k] = PS[k] * DEG;
    P.ground[k] = GR[k];
  }
}
/** Added to the climb (or the heading) of every ring between `a` and `b` along the spine, eased in over `e`. */
function bendBy(s: Zeph, arr: Float64Array, a: number, b: number, e: number, deg: number): void {
  if (!deg) return;
  for (let k = 0; k < s.N; k++) arr[k] += within(sOf(s, k), a, b, e) * deg * DEG;
}

/* ---- the Zephlet's poses ------------------------------------------------------------ */

/** Where each hip and shoulder is along the ground, standing and going, worked out once from the spine at rest in each. */
const hipsAt = new Map<Zeph, [number[], number[]]>();
function footRest(s: Zeph, i: number, going: boolean): V3 {
  let at = hipsAt.get(s);
  if (!at) {
    const along = (th: Keys, ps: Keys, ground: Keys, hips: V3): number[] => {
      const P = blank(s);
      profile(s, P, th, ps, ground);
      P.at = hips;
      const S = spineOf(s, P);
      return [s.fore, s.fore, s.hind, s.hind].map((L) => S.P[ringAt(s, L.at)][1]);
    };
    at = [along(s.still.th, s.still.ps, s.still.ground, s.still.at), along(s.going.th, [[0, 0]], s.going.ground, s.going.at)];
    hipsAt.set(s, at);
  }
  const L = i < 2 ? s.fore : s.hind;
  return [SIDE[i] * (L.hip[0] + L.stand[0]), at[going ? 1 : 0][i] + L.stand[1], 0];
}

/** A foot through a stride: on the ground sweeping back for `duty` of it, then lifted forward. */
function stepOf(u: number, duty: number, amp: number, high: number): [number, number, number] {
  const p = frac(u);
  if (p < duty) return [amp * (1 - (2 * p) / duty), 0, 0];
  const q = (p - duty) / (1 - duty);
  return [-amp + 2 * amp * smooth(q), high * Math.sin(Math.PI * q), Math.sin(Math.PI * q)];
}

const WALK_AT = [0.5, 0, 0, 0.5];
const RUN_AT = [0.5, 0, 0.1, 0.6];

/** Its pose standing, for a stage: breathing, looking about, its head tilting, its crest ruffling; at its post, up and alert. */
function stillPose(s: Zeph, a: Anim): Pose {
  const P = blank(s), St = s.still, t = a.t;
  profile(s, P, St.th, St.ps, St.ground);
  P.at = [...St.at] as V3;
  P.breath = a.breath;
  const look = drift(t, s.stage);
  const tilt = beat(t, [3.2, 14.6], 1.6) - beat(t, [9.1, 20.2], 1.4);
  const ruffle = beat(t, [5.4, 12.2, 18.8], 0.7);
  P.head = [St.head + 4 * cyc(t, 3, 1) + 6 * beat(t, [9.1], 1.4), 18 * look, 16 * tilt];
  // The neck follows the look a little.
  bendBy(s, P.ps, s.neck, s.len, 0.3, 8 * look);
  // The tail's tip lifts and flicks now and then, and sways.
  const flick = beat(t, [7.3, 16.4, 22.1], 0.9);
  bendBy(s, P.ps, 0, s.len * 0.25, 0.4, 10 * cyc(t, 4) + 18 * flick * Math.sin(t * 9));
  bendBy(s, P.th, 0, s.len * 0.12, 0.25, -14 * flick);
  P.flare[G_CREST] = 0.08 + 0.25 * ruffle * (0.5 + 0.5 * Math.sin(t * 22));
  P.flare[G_CHEEK] = 0.05 + 0.15 * ruffle * Math.sin(t * 20 + 1);
  P.flare[G_MANE] = 0.04 + 0.12 * ruffle;
  P.flutter = 1;
  for (let i = 0; i < 4; i++) P.feet[i] = footRest(s, i, false);
  if (s.stage === 0) {
    // Sitting: its hind feet out in front of its hips, its fore paws held at its chest.
    P.feet[2] = [-0.24, 0.12, 0];
    P.feet[3] = [0.24, 0.12, 0];
  }
  // The wings held up and half open, rising and settling with its breath, and now and then opened wide and beaten slowly.
  const stretch = beat(t, [6.0, 18.0], 3.6);
  P.wing = { open: 0.7 + 0.04 * cyc(t, 6) + 0.2 * smooth(stretch * 1.6), flap: -0.04 + 0.04 * cyc(t, 6) + 0.22 * stretch * Math.sin(Math.max(0, t % 12 - 6) * 2.2) };
  // At its post (`graze`, the island's word for at its task, standing): up, crest raised, looking one way and the other.
  const gz = a.graze;
  if (gz > 0) alert(s, P, gz, Math.sin((t / LOOP_SCAN) * TAU), 0);
  return P;
}
/** Seconds to a look round, at its post. */
const LOOP_SCAN = 4;

/** Up and alert, by `k`: taller, the head high and turned by `scan`, the crest raised and the tail lifted. */
function alert(s: Zeph, P: Pose, k: number, scan: number, snap: number): void {
  P.head[0] = lerp(P.head[0], 6 + 4 * snap, k);
  P.head[1] = lerp(P.head[1], 32 * scan, k);
  P.head[2] *= 1 - k;
  bendBy(s, P.th, s.neck, s.len, 0.3, k * (s.stage ? 14 : 8));
  bendBy(s, P.ps, s.neck, s.len, 0.3, k * 10 * scan);
  if (s.stage === 0) bendBy(s, P.th, s.hips, s.neck, 0.2, -k * 6);
  else P.at[2] += k * 0.06 * (1 + s.stage);
  bendBy(s, P.th, 0, s.len * 0.15, 0.3, -k * 12);
  P.flare[G_CREST] += k * (0.55 + 0.2 * snap);
  P.flare[G_CHEEK] += k * 0.3;
  P.flare[G_MANE] += k * (0.35 + 0.15 * snap);
  P.flare[G_BACK] += k * 0.3;
  P.flare[G_TAIL] += k * 0.2;
  P.wing.open = lerp(P.wing.open, 0.7, k);
  P.wing.flap = lerp(P.wing.flap, 0.05, k);
}

/** Its pose going: a wave sent back down it, its legs stepping, its head steady, its feathers laid back. */
function goingPose(s: Zeph, a: Anim): Pose {
  const P = blank(s), G = s.going, g = a.gait, u = a.u, w = frac(u);
  const TH = atRings(G.th, s.len, s.N, true), GR = atRings(G.ground, s.len, s.N), WV = atRings(G.wave, s.len, s.N), HV = G.heave && atRings(G.heave, s.len, s.N);
  for (let k = 0; k < s.N; k++) {
    const S = sOf(s, k);
    P.th[k] = TH[k] * DEG;
    P.ground[k] = GR[k];
    // The wave: once down its length a stride, going back, biggest down the tail; the head kept looking where it goes.
    P.ps[k] = WV[k] * (1 + 0.4 * g) * DEG * Math.sin(TAU * (u - S / G.length));
    // And humped up and down along it, the humps going back as the side-to-side wave does, a quarter of a turn behind it.
    if (HV) P.th[k] += HV[k] * (1 + 0.3 * g) * DEG * Math.sin(TAU * (u - S / (G.length * 0.8)) - Math.PI / 2);
  }
  const amp = lerp(G.amp[0], G.amp[1], g), duty = lerp(G.duty[0], G.duty[1], g), lift = lerp(G.lift[0], G.lift[1], g);
  const at = g < 0.5 ? WALK_AT : RUN_AT;
  let low = 0;
  for (let i = 0; i < 4; i++) {
    const [y, z, sw] = stepOf(u + at[i], duty, amp, lift);
    const r = footRest(s, i, true);
    P.feet[i] = [r[0], r[1] + y, z];
    P.curl[i] = sw;
    low += z;
  }
  P.at = [G.at[0], G.at[1], G.at[2] + G.bob * (Math.sin(w * TAU * 2) * (1 - g) + g * 1.6 * Math.max(0, Math.sin(w * TAU * 2)))];
  void low;
  // The hips swung side to side with the wave, and the head turned against it, so it keeps looking where it goes.
  const sway = (G.sway ?? 0) * Math.sin(w * TAU);
  P.at[0] += sway;
  P.head = [-4 + 3 * Math.sin(w * TAU * 2), -keyed(G.wave, s.len) * Math.sin(TAU * (u - s.len / G.length)) - 140 * sway, -60 * sway];
  P.flare[G_CREST] = -0.12 - 0.12 * g;
  P.flare[G_CHEEK] = -0.1 - 0.1 * g;
  P.flare[G_MANE] = -0.1 - 0.1 * g;
  P.flare[G_BACK] = -0.08;
  P.flare[G_TAIL] = -0.05;
  P.flutter = 1.4 + g;
  P.breath = 0.5;
  // The wings folded up along its back walking, half open and beating to keep its balance running.
  P.wing = { open: lerp(0.02, 0.5, g), flap: g * 0.35 * Math.sin(w * TAU * 2) };
  return P;
}

/* ---- its acts ------------------------------------------------------------------------------- */

/**
 * A strike. The Zephlet draws its head back and snaps forward, jaw wide, crest up; the Galecrest crouches, springs forward with its
 * mane flared and bites; the Tempestwyrm rears with its wings high and brings them down and forward in a buffet as it bites.
 */
function strikePose(s: Zeph, P: Pose, t: number): void {
  const hit = ZEPHYR_HITS[s.stage];
  const back = ramp(t, 0.05, hit - 0.15) * (1 - ramp(t, hit - 0.15, hit - 0.02));
  const lunge = ramp(t, hit - 0.15, hit) * (1 - ramp(t, hit + 0.12, 0.95));
  const open = hump(t, hit - 0.06, 0.12);
  P.jaw = Math.max(P.jaw, open);
  P.flare[G_CREST] += 0.5 * back + 0.7 * lunge;
  P.flare[G_CHEEK] += 0.4 * lunge;
  P.flare[G_MANE] += 0.3 * back + 0.6 * lunge;
  P.flare[G_BACK] += 0.4 * lunge;
  P.flare[G_TAIL] += 0.3 * lunge;
  if (s.stage === 0) {
    // Back and up, then the whole body thrown forward off its coil, neck out, and a snap.
    bendBy(s, P.th, s.hips + 0.2, s.len, 0.3, 12 * back - 34 * lunge);
    bendBy(s, P.th, s.neck, s.len, 0.2, 22 * back - 26 * lunge);
    P.head[0] += 14 * back - 4 * lunge;
    P.at[1] += 0.16 * lunge - 0.04 * back;
  } else if (s.stage === 1) {
    // Down on its haunches, then a spring forward off its hind legs, fore feet up and reaching, the neck out, and a bite.
    const air = hump(t, hit - 0.04, 0.12);
    P.at[2] += -0.18 * back + 0.22 * air;
    P.at[1] += -0.15 * back + 0.85 * lunge;
    bendBy(s, P.th, s.hips, s.shoulders, 0.3, -6 * back + 12 * air);
    bendBy(s, P.th, s.neck, s.len, 0.3, 8 * back - 30 * lunge);
    P.head[0] += 10 * back - 4 * lunge;
    for (const i of [0, 1]) P.feet[i] = add(P.feet[i], [0, 0.95 * lunge, 0.45 * air]);
    for (const i of [2, 3]) P.feet[i] = add(P.feet[i], [0, 0.35 * lunge, 0.1 * air]);
  } else {
    // Rearing, its wings raised high and wide, then brought down hard in a buffet as it lunges and bites.
    const rear = ramp(t, 0.05, hit - 0.12) * (1 - ramp(t, hit - 0.1, hit + 0.02));
    const beatDown = hump(t, hit + 0.02, 0.14);
    bendBy(s, P.th, s.hips, s.shoulders, 0.3, 18 * rear - 4 * lunge);
    bendBy(s, P.th, s.neck, s.len, 0.3, 16 * rear - 30 * lunge);
    P.at[1] += 0.45 * lunge - 0.15 * rear;
    P.head[0] += 12 * rear - 4 * lunge;
    for (const i of [0, 1]) P.feet[i] = add(P.feet[i], [0, 0.5 * lunge - 0.1 * rear, 0.55 * rear]);
    const spread = ramp(t, 0.05, 0.3) * (1 - ramp(t, 0.72, 1));
    P.wing.open = lerp(P.wing.open, 0.92, spread);
    P.wing.flap = lerp(P.wing.flap, 0.3 * rear - 0.12 * beatDown, spread);
  }
}

/** A go at its task, keeping watch, a second long and over and over: up and alert, a look one way and the other, its crest pulsing. */
function workPose(s: Zeph, P: Pose, t: number): void {
  alert(s, P, 1, 0.6 * Math.sin(t * TAU), 0.5 + 0.5 * Math.sin(t * TAU * 2));
}

/**
 * Its Stoneskin: it draws itself up and in as the wind gathers, then every feather flares and stands while the ward wraps round
 * it, and settles as the ward fades.
 */
function castPose(s: Zeph, P: Pose, t: number): void {
  const W = ZEPHYR_WARD;
  const draw = ramp(t, 0, W.gather) * (1 - ramp(t, W.gather, W.wrap));
  const flare = ramp(t, W.gather - 0.05, W.wrap) * (1 - ramp(t, 0.7, 1));
  bendBy(s, P.th, s.neck, s.len, 0.3, 10 * draw + 8 * flare);
  P.head[0] += 14 * flare - 6 * draw;
  P.head[1] *= 1 - flare;
  if (s.stage === 0) bendBy(s, P.th, s.hips, s.neck, 0.3, -8 * flare);
  else P.at[2] += 0.08 * flare * (1 + s.stage) - 0.06 * draw;
  for (let q = 0; q < GROUPS; q++) P.flare[q] += -0.15 * draw + (q === G_WING ? 0.3 : 0.95) * flare;
  P.jaw = Math.max(P.jaw, 0.35 * hump(t, W.wrap, 0.12));
  P.wing.open = lerp(P.wing.open, 0.88, flare);
  P.wing.flap = lerp(P.wing.flap, 0.1, flare) - 0.15 * draw;
  P.flutter += 2 * flare;
}

/** Evolving: drawn up tall as the light gathers round it, every feather out at the turn, and shaken down after. */
function evolvePose(s: Zeph, P: Pose, t: number): void {
  const up = ramp(t, 0.05, 0.45) * (1 - ramp(t, 0.6, 0.95));
  bendBy(s, P.th, s.neck, s.len, 0.3, 14 * up);
  P.head[0] += 18 * up;
  for (let q = 0; q < GROUPS; q++) P.flare[q] += 0.6 * hump(t, 0.5, 0.2);
  P.wing.open = lerp(P.wing.open, 0.9, up);
}

function poseOf(s: Zeph, a: Anim): Pose {
  const act = a.act;
  // An act is played where it stands.
  const go = act && act.kind !== 'work' ? 0 : a.go;
  let P = go < 1 ? stillPose(s, a) : goingPose(s, a);
  if (go > 0 && go < 1) P = mixPose(P, goingPose(s, a), smooth(go));
  if (act?.kind === 'strike') strikePose(s, P, act.t);
  else if (act?.kind === 'work') workPose(s, P, frac(act.t));
  else if (act?.kind === 'cast') castPose(s, P, act.t);
  else if (act?.kind === 'evolve') evolvePose(s, P, act.t);
  return P;
}

/* ---- its spine ------------------------------------------------------------------------------- */

/** Every ring of the spine posed: where it is, and its right, along and up. */
interface Spine { P: V3[]; X: V3[]; T: V3[]; Z: V3[]; pose: Pose }

function spineOf(s: Zeph, Q: Pose): Spine {
  const N = s.N, ds = s.len / (N - 1), A = anchorOf(s);
  const dirOf = (th: number, ps: number): V3 => [-Math.sin(ps) * Math.cos(th), Math.cos(ps) * Math.cos(th), Math.sin(th)];
  const P: V3[] = new Array(N);
  P[A] = Q.at;
  for (let k = A + 1; k < N; k++) P[k] = add(P[k - 1], scale(dirOf((Q.th[k] + Q.th[k - 1]) / 2, (Q.ps[k] + Q.ps[k - 1]) / 2), ds));
  const H = atRings(s.h, s.len, N), floorOf = (k: number): number => H[k] * Math.cos(Q.th[k]) * 0.92 + 0.01;
  // Its tail let down onto the ground as it goes back from the hips, as much as the pose says, so it lies along the ground however
  // high its hips are carried, and what is past that (a tip curling up) goes on from there.
  for (let k = A - 1; k >= 0; k--) {
    const p = sub(P[k + 1], scale(dirOf((Q.th[k] + Q.th[k + 1]) / 2, (Q.ps[k] + Q.ps[k + 1]) / 2), ds));
    P[k] = [p[0], p[1], lerp(p[2], floorOf(k), Q.ground[k] * 0.5)];
  }
  // Nothing of it under the ground: a ring lying along it is lifted to rest on it.
  for (let k = 0; k < N; k++) if (P[k][2] < floorOf(k)) P[k] = [P[k][0], P[k][1], floorOf(k)];
  const X: V3[] = new Array(N), T: V3[] = new Array(N), Z: V3[] = new Array(N);
  for (let k = 0; k < N; k++) {
    const t = unit(sub(P[Math.min(N - 1, k + 1)], P[Math.max(0, k - 1)]));
    let x: V3 = [Math.cos(Q.ps[k]), Math.sin(Q.ps[k]), 0];
    x = unit(sub(x, scale(t, dot(x, t))));
    T[k] = t;
    X[k] = x;
    Z[k] = cross(x, t);
  }
  return { P, X, T, Z, pose: Q };
}

/** A point given in ring `k`'s frame, placed. */
const onSpine = (S: Spine, k: number, v: V3): V3 =>
  add(add(add(S.P[k], scale(S.X[k], v[0])), scale(S.T[k], v[1])), scale(S.Z[k], v[2]));
/** Ring `k`'s frame as a bone. */
const ringXf = (S: Spine, k: number): Xf => xfOf(S.X[k], S.T[k], S.Z[k], S.P[k]);

/** Its spine as worked out for an `Anim`, kept, so its skin and its feathers are bent to it without working it out again. */
const posed = new WeakMap<Anim, { s: Zeph; S: Spine }>();
function spineNow(s: Zeph, a: Anim): Spine {
  const had = posed.get(a);
  if (had && had.s === s) return had.S;
  const S = spineOf(s, poseOf(s, a));
  posed.set(a, { s, S });
  return S;
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its ankle at `ankle`: two bones from the hip, the knee bent the way `hint` says, and the foot flat on the ground
 * heading the way the body does, its toes curled under by `curl` as it swings.
 */
function legOf(hip: V3, ankle: V3, l0: number, l1: number, hint: V3, heading: V3, curl: number): [Xf, Xf, Xf] {
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), heading), [X1, Y1, Z1] = frameOf(sub(knee, at), heading);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -40 * curl)];
}

const IDENTITY: Xf = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

function zephBones(s: Zeph): (a: Anim) => Bones {
  return (a) => {
    const S = spineNow(s, a), Q = S.pose, N = s.N;
    const b: Bones = { root: IDENTITY };
    const mid = ringAt(s, (s.hips + s.shoulders) / 2);
    b.body = ringXf(S, mid);
    b.trunk = b.body;
    // The head carried at its own pitch, turned with the end of the neck and past it as it looks.
    const end = S.P[N - 1], hd = Math.atan2(-S.T[N - 1][0], S.T[N - 1][1]) / DEG;
    const hk = s.head.scale ?? 1, head = joint({ m: IDENTITY.m, t: end }, [0, 0, 0], Q.head[0], Q.head[2], hd + Q.head[1]);
    b.head = hk === 1 ? head : { m: head.m.map((x) => x * hk), t: head.t };
    b.jaw = joint(b.head, s.head.jaw.at.map((x, q) => (q === 1 ? x - s.head.jaw.r[1] * 0.9 : x)) as V3, -34 * Q.jaw);
    // Legs: each hangs from its ring, and is bent to reach where its foot is to be.
    // The way its body heads along the ground, which is not the way its spine goes where that stands upright.
    const fwd: V3 = [-Math.sin(Q.ps[mid]), Math.cos(Q.ps[mid]), 0];
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? s.fore : s.hind, k = ringAt(s, L.at), sd = SIDE[i];
      const hip = onSpine(S, k, [sd * L.hip[0], L.hip[1], L.hip[2]]);
      let ankle: V3 = [Q.feet[i][0], Q.feet[i][1], Q.feet[i][2] + L.paw * 0.55];
      // Its fore paws held at its chest, sitting.
      if (s.stage === 0 && i < 2) ankle = held(s, S, i, ankle, a.act && a.act.kind !== 'work' ? 0 : a.go);
      // Elbows back and out; knees forward, out and up.
      const hint = i < 2 ? add(add(scale(S.X[k], sd * 0.5), scale(S.T[k], -0.8)), scale(S.Z[k], 0.1)) : add(add(scale(S.X[k], sd * 0.5), scale(S.T[k], 0.8)), scale(S.Z[k], 0.3));
      if (L.meta) {
        // The hock up and back of the paw, the more as the paw is lifted, and the leg bent to reach it.
        const up = unit(add(scale(fwd, -0.42 - 0.35 * Q.curl[i]), [0, 0, 0.9]));
        const hock = add(ankle, scale(up, L.meta));
        const [u, l] = legOf(hip, hock, L.len[0], L.len[1], hint, fwd, 0);
        const at = l.t, end = place(l, [0, 0, -L.len[1]]);
        const [X, Y, Z] = frameOf(sub(end, ankle), fwd), [X2, Y2, Z2] = frameOf([0, 0, 1], fwd);
        b[`${LEGS4[i]}0`] = u;
        b[`${LEGS4[i]}1`] = l;
        b[`${LEGS4[i]}m`] = xfOf(X, Y, Z, end);
        b[`${LEGS4[i]}2`] = joint(xfOf(X2, Y2, Z2, ankle), [0, 0, 0], -40 * Q.curl[i]);
        void at;
        continue;
      }
      const [u, l, f] = legOf(hip, ankle, L.len[0], L.len[1], hint, fwd, Q.curl[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    if (s.wings) wingBones(s, S, b);
    // The shadow under the middle of everything that is on or near the ground.
    let cx = 0, cy = 0;
    for (let k = 0; k < N; k++) { cx += S.P[k][0]; cy += S.P[k][1]; }
    b.shadow = { m: IDENTITY.m, t: [cx / N, cy / N, 0] };
    return b;
  };
}

/** The Zephlet's fore paw: held at its chest sitting, put down as it goes (`go`). */
function held(s: Zeph, S: Spine, i: number, down: V3, go: number): V3 {
  const k = ringAt(s, s.fore.at), sd = SIDE[i];
  const up = onSpine(S, k, [sd * 0.1, -0.2, -0.32]);
  return [lerp(up[0], down[0], go), lerp(up[1], down[1], go), lerp(up[2], down[2], go)];
}

/** The wings: each from the top of its shoulder, its arm and its hand, folded back along the body or opened up and out, beating. */
function wingBones(s: Zeph, S: Spine, b: Bones): void {
  const W = s.wings!, Q = S.pose, k = ringAt(s, W.at), o = clamp(Q.wing.open), f = Q.wing.flap;
  const w = keyed(s.w, W.at), h = keyed(s.h, W.at);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    // In the shoulder ring's frame, the way out along the arm and the way its top faces: folded, back along the body and a little
    // up, its top in against the body; raised, up and back, its top facing the other wing's, as a bird's are over its back;
    // open, out and up, its top up.
    const key = (a: V3, b: V3, c: V3): V3 => (o < 0.5 ? mixV(a, b, smooth(o * 2)) : mixV(b, c, smooth(o * 2 - 1)));
    let D = unit(key([sd * 0.42, -0.88, 0.14], [sd * 0.34, -0.66, 0.68], [sd * 0.86, -0.12, 0.5]));
    let Nn = unit(key([-sd * 0.9, 0.1, 0.35], [-sd * 0.9, 0.12, 0.3], [-sd * 0.45, 0.05, 0.9]));
    // The beat, raising them for a positive `flap`: about the line along the body.
    D = about(D, [0, 1, 0], -sd * f);
    Nn = about(Nn, [0, 1, 0], -sd * f);
    const dW = unit([S.X[k][0] * D[0] + S.T[k][0] * D[1] + S.Z[k][0] * D[2], S.X[k][1] * D[0] + S.T[k][1] * D[1] + S.Z[k][1] * D[2], S.X[k][2] * D[0] + S.T[k][2] * D[1] + S.Z[k][2] * D[2]]);
    const nW = unit([S.X[k][0] * Nn[0] + S.T[k][0] * Nn[1] + S.Z[k][0] * Nn[2], S.X[k][1] * Nn[0] + S.T[k][1] * Nn[1] + S.Z[k][1] * Nn[2], S.X[k][2] * Nn[0] + S.T[k][2] * Nn[1] + S.Z[k][2] * Nn[2]]);
    // The wing's own frame: out along the arm (its x, for the right wing; the left is its mirror), its leading edge, its top.
    const n2 = unit(sub(nW, scale(dW, dot(nW, dW))));
    const lead = cross(n2, dW);
    const X: V3 = scale(dW, sd), Y: V3 = sd > 0 ? lead : scale(lead, -1);
    const root = onSpine(S, k, [sd * w * 0.5, 0, h * 0.92]);
    const A = xfOf(X, Y, n2, root);
    b[`wA${q}`] = A;
    // The hand folds back along the arm as it closes.
    b[`wB${q}`] = joint(A, [sd * W.arm, 0, 0], 0, 0, sd * (o < 0.5 ? lerp(165, -28, smooth(o * 2)) : lerp(-28, -8, smooth(o * 2 - 1))));
  }
}

/* ---- what it is made of ------------------------------------------------------------------------- */

/** The body: one tube down the spine, blue over a cream belly in plates, rounded off at the tail's tip. */
function bodyMesh(s: Zeph, n: number): { mesh: Mesh; ring: Int16Array; loc: V3[] } {
  const N = s.N, v: V3[] = [], f: Face[] = [], ring: number[] = [], loc: V3[] = [];
  for (let k = 0; k < N; k++) {
    const S = sOf(s, k), w = keyed(s.w, S), h = keyed(s.h, S);
    for (let j = 0; j < n; j++) {
      const t = ((j + 0.5) / n) * TAU;
      // Round from its left, as `tube` goes, so its facets face out.
      loc.push([-Math.cos(t) * w, 0, Math.sin(t) * h]);
      ring.push(k);
      v.push([-Math.cos(t) * w, S, Math.sin(t) * h]);
    }
  }
  // The underside cream from the chin to the tail's tip, in plates: every other ring a shade warmer.
  const matOf = (k: number, j: number): Mat => {
    const t = ((j + 1) / n) * TAU;
    // Blue along the top of the back only, as on a dolphin; cream from the flanks down.
    if (Math.sin(t) > 0.3) return 'coat';
    return k % 2 ? 'belly' : 'muzzle';
  };
  for (let k = 0; k < N - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j], m: matOf(k, j) });
    }
  }
  f.push({ i: Array.from({ length: n }, (_, j) => n - 1 - j), m: 'coat' });
  f.push({ i: Array.from({ length: n }, (_, j) => (N - 1) * n + j), m: 'coat' });
  return { mesh: mesh(v, f), ring: Int16Array.from(ring), loc };
}

/** Radii as (across, along, up) for `orbAlong`, which takes them across, up, and along its axis. */
const along3 = (r: V3): V3 => [r[0], r[2], r[1]];

/** The head: a round skull, a snout cream underneath, big amber eyes, two nostrils, and on the pup a blush. */
function headMesh(s: Zeph, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, E = H.eye, R = H.snout.r;
  const eyeMesh = shut
    ? paint([1, -1].map((sd) => { const { p, n: out } = onEgg(H.c, H.r, [E.dir[0] * sd, E.dir[1], E.dir[2]]); return disc(add(p, scale(out, 0.03)), out, E.size * 1.05, E.size * 0.32, 8, 'lid'); }))
    : eyesOf(H.c, H.r, E.dir, E.size, E.lid);
  const cheeks = H.blush ? paint([1, -1].map((sd) => { const { p, n: out } = onEgg(H.c, H.r, [sd * 0.62, 0.55, -0.42]); return disc(add(p, scale(out, 0.03)), out, H.blush, H.blush * 0.6, 8, 'inner'); })) : null;
  if (!s.stage) {
    // The pup's head is one soft egg, cut fine so it shades round, drawn out at the front into a short round muzzle; cream from under
    // its eyes down -- cheeks, muzzle and chin -- and blue over its crown and the bridge of its nose.
    // Coloured before it is drawn out, the cream's edge along the ring of corners round the egg's middle, so it is a clean line.
    const bands = k + 3, edge = H.c[2] - H.r[2] * Math.cos((Math.ceil(bands / 2) / bands) * Math.PI) + 1e-6;
    const egg = merge(creamBelow(orb(H.c, H.r, n + 4, bands, 'coat'), edge), cheeks);
    const v = egg.v.map((p) => muzzled(H, p));
    const tip = muzzled(H, add(H.c, [0, H.r[1], -H.r[2] * 0.12]));
    const nostrils = paint([1, -1].map((sd) => disc(add(tip, [sd * H.r[0] * 0.13, 0.012, H.r[2] * 0.06]), [sd * 0.3, 0.8, 0.5], H.r[0] * 0.05, H.r[0] * 0.03, 6, 'nose')));
    return merge({ ...egg, v }, nostrils, eyeMesh);
  }
  const skull = creamBelow(orb(H.c, H.r, n + 1, k + 1, 'coat'), H.c[2] - H.r[2] * 0.45);
  const snout = creamUnder(orbAlong(H.snout.at, [0, 1, 0.04], along3(R), n, k, 'coat'), -0.25);
  const tip = add(H.snout.at, [0, R[1] * 0.9, R[2] * 0.35]);
  const nostrils = paint([1, -1].map((sd) => disc(add(tip, [sd * R[0] * 0.4, 0, 0.02]), [sd * 0.35, 0.75, 0.55], R[0] * 0.14, R[0] * 0.08, 6, 'nose')));
  return merge(skull, snout, nostrils, eyeMesh, cheeks);
}

/**
 * A point of the pup's round head drawn out into its muzzle: the front of the egg, below its eyes, pushed forward and a little in,
 * the more the further forward it is, so the muzzle is a smooth swell of the same surface rather than a second egg through it.
 */
function muzzled(H: Zeph['head'], p: V3): V3 {
  const q: V3 = [(p[0] - H.c[0]) / H.r[0], (p[1] - H.c[1]) / H.r[1], (p[2] - H.c[2]) / H.r[2]];
  const f = smooth((q[1] - 0.15) / 0.85) * (1 - smooth((q[2] + 0.12) / 0.24));
  return [p[0] * (1 - 0.22 * f), p[1] + H.r[1] * 0.62 * f, p[2] - H.r[2] * 0.12 * f];
}

/** A mesh with every facet turned down further than `up` (its way out's height) turned cream: the underside of something long. */
function creamUnder(m: Mesh, up: number): Mesh {
  return {
    ...m, f: m.f.map((f) => {
      const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], n = unit(cross(sub(b, a), sub(c, a)));
      return n[2] < up ? { ...f, m: 'belly' as Mat } : f;
    }),
  };
}

/** A mesh with every facet whose middle is under `z` turned cream. */
function creamBelow(m: Mesh, z: number): Mesh {
  return { ...m, f: m.f.map((f) => (!f.decal && f.m === 'coat' && f.i.reduce((t, i) => t + m.v[i][2], 0) / f.i.length < z ? { ...f, m: 'belly' as Mat } : f)) };
}

/** Big amber eyes, each with a dark pupil and a glint; on the grown a lid down over the top of each, for a keener look. */
function eyesOf(c: V3, r: V3, dir: V3, size: number, lid: number): Mesh {
  const out: Disc[] = [];
  for (const sd of [1, -1]) {
    const { p, n } = onEgg(c, r, [dir[0] * sd, dir[1], dir[2]]);
    const on = add(p, scale(n, 0.025)), up = unit(sub([0, 0, 1], scale(n, n[2])));
    // On the grown the eye is narrower, a lid's dark edge across its top and a brow over it.
    const tall = 1.1 * (1 - 0.4 * lid);
    out.push(disc(add(p, scale(n, 0.015)), n, size * 1.16, size * (tall + 0.16), 10, 'eye'));
    out.push(disc(on, n, size, size * tall, 10, 'crystal'));
    out.push(disc(add(on, scale(n, 0.006)), n, size * 0.62, size * tall * 0.62, 8, 'crystalDark'));
    out.push(disc(add(on, scale(n, 0.01)), n, size * 0.36, size * tall * 0.6, 8, 'eye'));
    if (lid > 0) out.push(disc(add(add(on, scale(n, 0.012)), scale(up, size * (tall + 0.32))), n, size * 1.3, size * 0.16, 8, 'lid', { spin: -sd * 0.12 }));
    const side = unit(cross([0, 0, 1], n));
    const g = add(add(on, scale(up, size * tall * 0.4)), scale(side, size * 0.32));
    out.push(disc(add(g, scale(n, 0.02)), n, size * 0.28, size * 0.28, 6, 'glint', { lit: true }));
  }
  return paint(out);
}

/** The lower jaw: cream under, the inside of the mouth pink on top, and on the grown a pair of small fangs. */
function jawMesh(s: Zeph, n: number, k: number): Mesh {
  const J = s.head.jaw, back = J.r[1] * 0.9;
  const c: V3 = [J.at[0], back, 0];
  return merge(
    orbAlong(c, [0, 1, 0.02], along3(J.r), n, k, 'belly'),
    paint([disc(add(c, [0, J.r[1] * 0.1, J.r[2] * 0.9]), [0, 0, 1], J.r[0] * 0.7, J.r[1] * 0.75, 8, 'inner', { up: [0, 1, 0] })]),
    s.stage ? merge(...[1, -1].map((sd) => taper([[sd * J.r[0] * 0.55, back + J.r[1] * 0.6, J.r[2] * 0.6], [sd * J.r[0] * 0.5, back + J.r[1] * 0.62, J.r[2] * 0.6 + 0.07 * s.stage]], 0.025 * s.stage, 0.004, 4, 'tooth'))) : null,
  );
}

/** A paw: a soft rounded pad heading forward, and its claws, dark. */
function pawMesh(L: Leg, n: number, k: number, mat: Mat, clawMat: Mat = 'claw'): Mesh {
  const r = L.paw;
  const pad = orbAlong([0, r * 0.4, -r * 0.3], [0, 1, 0], [r, r * 0.6, r * 1.35], n, k, mat);
  const claws = Array.from({ length: L.claws }, (_, q) => {
    const x = (q / Math.max(1, L.claws - 1) - 0.5) * r * 1.3;
    return taper(curve([x, r * 1.4, -r * 0.3], [x * 1.15, r * 1.4 + L.claw * 0.7, -r * 0.3], [x * 1.2, r * 1.4 + L.claw, -r * 0.75], 2), r * 0.24, r * 0.03, 4, clawMat);
  });
  return merge(pad, ...claws);
}

/* ---- a stage's pieces ------------------------------------------------------------------------- */

const REST: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };

/** How each feather turns this moment, as a matrix: its group's flare and a flutter of its own in the breeze, and a wing's fanned shut as it folds. */
function turnsOf(P: Plumage, Q: Pose, a: Anim): number[][] {
  const t = a.t + (a.act ? a.act.t * 2 : 0) + a.u * 0.7, shut = 1 - clamp(Q.wing.open);
  return P.root.map((_, q) => {
    const g = P.group[q], ph = jitter(q + g * 31) * TAU;
    const lift = Q.flare[g] * P.gain[q] + 0.045 * Q.flutter * Math.sin(t * (5 + 3 * jitter(q + 7)) + ph);
    if (!P.fan[q] || shut <= 0) return turning(P.axis[q], lift);
    const F = turning(P.face[q], P.fan[q] * shut);
    return product(turning(times(F, P.axis[q]), lift), F);
  });
}

/** A feathered piece bent to its pose: each feather turned on its root, and carried by its ring when it is on the spine. */
function feathered(s: Zeph, P: Plumage, spined: boolean): (v: readonly V3[], a: Anim) => V3[] {
  // Its corners as they are bent, kept from one frame to the next and written over: a body is drawn as soon as it is posed, and
  // nothing keeps them past that.
  const held: V3[] = new Array(P.mesh.v.length);
  const bend = (a: Anim, only?: readonly number[]): V3[] => {
    const S = spineNow(s, a), M = turnsOf(P, S.pose, a), mv = P.mesh.v;
    const count = only ? only.length : mv.length, out: V3[] = only ? new Array(count) : held;
    // Worked out in place, every frame for every corner: no vectors made on the way.
    for (let o = 0; o < count; o++) {
      const i = only ? only[o] : o;
      const q = P.of[i], R = P.root[q], m = M[q], v = mv[i];
      const dx = v[0] - R[0], dy = v[1] - R[1], dz = v[2] - R[2];
      const x = R[0] + m[0] * dx + m[1] * dy + m[2] * dz, y = R[1] + m[3] * dx + m[4] * dy + m[5] * dz, z = R[2] + m[6] * dx + m[7] * dy + m[8] * dz;
      const r = out[o] ?? (out[o] = [0, 0, 0]);
      if (!spined) { r[0] = x; r[1] = y; r[2] = z; continue; }
      const k = P.ring[i], O = S.P[k], X = S.X[k], T = S.T[k], Z = S.Z[k];
      r[0] = O[0] + X[0] * x + T[0] * y + Z[0] * z;
      r[1] = O[1] + X[1] * x + T[1] * y + Z[1] * z;
      r[2] = O[2] + X[2] * x + T[2] * y + Z[2] * z;
    }
    return out;
  };
  const fn = (_v: readonly V3[], a: Anim): V3[] => bend(a);
  // Its reach measured from the tip and the root of each feather only.
  const far = new Int32Array(P.root.length).fill(-1), best = new Float64Array(P.root.length).fill(-1);
  P.mesh.v.forEach((v, i) => {
    const q = P.of[i], R = P.root[q], d = (v[0] - R[0]) ** 2 + (v[1] - R[1]) ** 2 + (v[2] - R[2]) ** 2;
    if (d > best[q]) { best[q] = d; far[q] = i; }
  });
  const ends = Array.from(far).filter((i) => i >= 0);
  probes.set(fn, (a) => bend(a, ends));
  return fn;
}

/** For a piece bent every frame, a few of its corners bent, to measure where it reaches without bending all of it (`reachOf`). */
const probes = new WeakMap<(v: readonly V3[], a: Anim) => V3[], (a: Anim) => V3[]>();

/** The hand's feathers bent as the rest are, and its bone, which comes after them in its mesh, carried as it is. */
function wingHand(s: Zeph, P: Plumage): (v: readonly V3[], a: Anim) => V3[] {
  const bend = feathered(s, P, false);
  const fn = (v: readonly V3[], a: Anim): V3[] => { const out = bend(v, a); for (let i = P.mesh.v.length; i < v.length; i++) out[i] = v[i] as V3; return out; };
  probes.set(fn, probes.get(bend)!);
  return fn;
}

/** Feathers are lined round the outside of the whole of them only: each one inked was a heap of shards, and they are told apart by their colours. */
const FEATHER_LINES = false;
function zephBuild(s: Zeph, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), K = lod ? 5 : 4;
  const pieces: Piece[] = [];
  // The body: its corners kept in each ring's own frame, and placed on the spine as it is posed.
  const B = bodyMesh(s, n);
  const trunkLo = ringAt(s, s.hips - 0.3), trunkHi = ringAt(s, s.shoulders);
  // Written over every frame, as a feather's are (`feathered`).
  const bodyHeld: V3[] = B.loc.map(() => [0, 0, 0]);
  const bodyBent = (_v: readonly V3[], a: Anim): V3[] => {
    const S = spineNow(s, a), br = 1 + 0.035 * (S.pose.breath - 0.5) * 2;
    const out = bodyHeld;
    for (let i = 0; i < out.length; i++) {
      const r = B.ring[i], kk = r >= trunkLo && r <= trunkHi ? br : 1, p = B.loc[i], x = p[0] * kk, z = p[2] * kk;
      const O = S.P[r], X = S.X[r], Z = S.Z[r], q = out[i];
      q[0] = O[0] + X[0] * x + Z[0] * z;
      q[1] = O[1] + X[1] * x + Z[1] * z;
      q[2] = O[2] + X[2] * x + Z[2] * z;
    }
    return out;
  };
  const bodyRest = bodyBent(B.mesh.v, REST).map((v) => [...v] as V3);
  pieces.push({ key: 'body', mesh: { ...B.mesh, v: bodyRest }, bone: 'root', bias: 0, bent: bodyBent });
  // The head and its jaw.
  const H = s.head;
  const hide = [{ c: H.c, r: scale(H.r, 0.98) }, { c: H.snout.at, r: scale(H.snout.r, 0.95) }];
  pieces.push({ key: 'head', mesh: headMesh(s, n, k, false), shut: headMesh(s, n, k, true), bone: 'head', bias: 0.2, after: ['body'] });
  pieces.push({ key: 'jaw', mesh: jawMesh(s, n, k), bone: 'jaw', bias: 0.19, after: ['body'], under: ['head'] });
  // Its feathers: those on its head, and those down its spine, each side apart so the far side's go under the body.
  const F = s.plumes(s);
  if (F.head.length) {
    const hp = plumage(F.head, K);
    pieces.push({ key: 'crest', mesh: hp.mesh, bone: 'head', bias: 0.22, after: ['head', 'jaw'], hide, bent: feathered(s, hp, false), lines: FEATHER_LINES });
  }
  if (F.spine.length) {
    for (const [key, pick, front] of [['maneL', (p: V3) => p[0] < -1e-3, [-1, 0, 0.3]], ['maneR', (p: V3) => p[0] > 1e-3, [1, 0, 0.3]], ['maneC', (p: V3) => Math.abs(p[0]) <= 1e-3, undefined]] as const) {
      const list = F.spine.filter((p) => pick(p.root));
      if (!list.length) continue;
      const sp = plumage(list, K);
      const bent = feathered(s, sp, true);
      pieces.push({ key, mesh: { ...sp.mesh, v: bent(sp.mesh.v, REST).map((v) => [...v] as V3) }, bone: 'root', bias: 0.05, after: ['body'], under: ['head'], front: front as V3 | undefined, bent, lines: FEATHER_LINES });
    }
  }
  // The wings: on each its arm and its hand, the feathers on each, the left the right's mirror.
  if (s.wings) {
    const W = wingOf(s.wings.arm, s.wings.hand);
    // The wings' many feathers a row coarser than the rest, at either fineness: they are most of its corners.
    const Kw = K - 1;
    // Folded, each feather fanned round to lie back along its bone: the arm's along the arm, the hand's back along the hand
    // folded over it.
    const armF = W.arm.map((p) => ({ ...p, fan: -Math.atan2(p.dir[1], p.dir[0]) * 0.92, stars: p.hue === 'blue' && p.len > 1 ? 1 : 0 }));
    const handF = W.hand.map((p) => ({ ...p, fan: -(Math.PI + Math.atan2(p.dir[1], p.dir[0])) * 0.94, stars: p.len > 1.2 ? 2 : 0 }));
    const flip = (p: Plume): Plume => ({ ...p, root: [-p.root[0], p.root[1], p.root[2]], dir: [-p.dir[0], p.dir[1], p.dir[2]], face: [-p.face[0], p.face[1], p.face[2]], fan: -(p.fan ?? 0) });
    const bone = taper([[0, 0, 0], [s.wings.arm * 0.5, 0.02, 0.02], [s.wings.arm, 0, 0]], 0.09, 0.05, n - 2, 'coat');
    const hand = taper([[-0.05, 0, 0], [s.wings.hand * 0.55, 0, 0]], 0.08, 0.03, n - 2, 'coat');
    for (let q = 0; q < 2; q++) {
      // Before the body or after it by which side of it it is on: out along the arm when open, and away from its top raised or folded.
      const sd = q ? 1 : -1, front: V3 = [sd * 0.6, 0, -0.8];
      const after = ['body', 'maneL', 'maneR', 'maneC'];
      const pa = plumage(q ? armF : armF.map(flip), Kw), ph = plumage(q ? handF : handF.map(flip), Kw);
      pieces.push({ key: `wingBone${q}`, mesh: q ? bone : mirroredMesh(bone), bone: `wA${q}`, bias: 0.06, after, front, convex: true });
      pieces.push({ key: `wingArm${q}`, mesh: pa.mesh, bone: `wA${q}`, bias: 0.07, after: [...after, `wingBone${q}`], front, bent: feathered(s, pa, false), lines: FEATHER_LINES });
      pieces.push({ key: `wingHand${q}`, mesh: merge(ph.mesh, q ? hand : mirroredMesh(hand)), bone: `wB${q}`, bias: 0.065, after, front, bent: wingHand(s, ph), lines: FEATHER_LINES });
    }
  }
  // Legs: the near side's over the body, the far side's under it.
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], L = i < 2 ? s.fore : s.hind, sd = SIDE[i];
    const mat: Mat = s.stage ? 'hoof' : 'coat';
    const upper = tube([[0, 0, 0.04], [0, 0, -L.len[0] * 0.5], [0, 0, -L.len[0]]], [L.w[0], L.w[0] * 0.9, L.w[1] * 1.1], [L.w[0] * 1.1, L.w[0], L.w[1] * 1.1], n - 2, mat, { seam: 'start' });
    const lower = tube([[0, 0, L.w[1] * 0.6], [0, 0, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n - 2, mat);
    // The pup's toes soft and peach; the grown's claws dark.
    const paw = pawMesh(L, n - 2, k - 1, mat, s.stage ? 'claw' : 'petal');
    // Over the body from its own side; the pup's, sitting, from in front of it, where its paws are held and its feet set.
    const front: V3 = s.stage ? [sd, i < 2 ? 0.3 : -0.1, 0] : [sd * 0.4, 1, 0];
    if (L.meta) pieces.push({ key: `${key}m`, mesh: tube([[0, 0, L.w[1] * 0.5], [0, 0, -L.meta]], [L.w[1] * 0.95, L.w[1] * 0.8], [L.w[1] * 0.95, L.w[1] * 0.8], n - 2, mat), bone: `${key}m`, bias: 0.025, after: 'body', front, convex: true });
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, under: 'body', convex: true },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirroredMesh(paw) : paw, bone: `${key}2`, bias: 0.03, after: 'body', front },
    );
  }
  // Where it reaches in any pose and at any act: corners and no facets, so its pictures are cut big enough for all of it.
  let box = reaches.get(s);
  if (!box) reaches.set(s, (box = reachOf(s, pieces)));
  pieces.push({ key: 'reach', mesh: mesh(box, []), bone: 'root', bias: 0 });
  return pieces;
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** The corners of a box round everything of it, through its loop standing, a stride walking and running, and every act. */
const reaches = new Map<Zeph, V3[]>();
function reachOf(s: Zeph, pieces: Piece[]): V3[] {
  const bones = zephBones(s);
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  const take = (p: V3): void => { for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q]); hi[q] = Math.max(hi[q], p[q]); } };
  const anims: Anim[] = [];
  // Standing, its wings stretched (seven seconds into its loop), up at its post, walking and running; rearing to strike and at
  // the blow; and warded, with every feather out. Evolving is drawn for itself as it happens, and not cut to a picture.
  anims.push({ ...REST, t: 0.7 }, { ...REST, t: 7.2 }, { ...REST, t: 3, graze: 1 }, { ...REST, go: 1, u: 0.3 }, { ...REST, go: 1, gait: 1, u: 0.3 });
  for (const t of [0.4, 0.54]) anims.push({ ...REST, act: { kind: 'strike', t } });
  anims.push({ ...REST, act: { kind: 'cast', t: 0.6 } });
  for (const a of anims) {
    const b = bones(a);
    for (const pc of pieces) {
      const xf = b[pc.bone];
      if (!xf) continue;
      const probe = pc.bent && probes.get(pc.bent);
      const v = probe ? probe(a) : pc.bent ? pc.bent(pc.mesh.v, a) : pc.mesh.v;
      for (let i = 0; i < v.length; i += probe ? 1 : 2) take(place(xf, v[i]));
    }
    // The ward round it.
    const c = b.shadow.t, R = wardRadius(s);
    take([c[0] - R, c[1] - R, 0]);
    take([c[0] + R, c[1] + R, WARDS[s.stage].high * 1.1]);
  }
  const out: V3[] = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) out.push([x, y, z]);
  return out;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const WIND: RGB = [236, 246, 255], WIND_EDGE: RGB = [150, 180, 232], WARD_LILAC: RGB = [200, 178, 246], STAR: RGB = [255, 244, 206];

/** Its ward, for a stage: how far it stands out across it and along it, and from how high to how high round it. */
const WARDS: ReadonlyArray<{ across: number; along: number; low: number; high: number }> = [
  { across: 0.85, along: 0.9, low: 0.12, high: 1.7 },
  { across: 1.15, along: 2.1, low: 0.25, high: 1.9 },
  { across: 1.8, along: 3.1, low: 0.35, high: 3.0 },
];
/** How far its ward reaches from its middle at most, for the size of its pictures. */
const wardRadius = (s: Zeph): number => Math.max(WARDS[s.stage].across, WARDS[s.stage].along) * 1.15;
/** How strong its ward is, `t` through its cast: grown by the time it wraps round it, fading at the end. */
const wardOn = (t: number): number => ramp(t, ZEPHYR_WARD.gather - 0.08, ZEPHYR_WARD.wrap + 0.06) * (1 - ramp(t, 0.72, ZEPHYR_WARD.gone));

/** A four-pointed star, `r` across, at a point on the screen. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  g.fillStyle = css(STAR, al);
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/**
 * The ward: three bands of wind wrapped round it low, in the middle and high, each a bright ribbon swept round it as it spins, the
 * half behind it drawn under the body and the half before it over, a wider faint shimmer along each; glints of light along them;
 * fading as it ends.
 */
function wardOf(g: CanvasRenderingContext2D, view: View, s: Zeph, b: Bones, t: number, front: boolean): void {
  const Wd = WARDS[s.stage], c = b.shadow.t, mid: V3 = [c[0], c[1], (Wd.low + Wd.high) / 2];
  const grow = ramp(t, ZEPHYR_WARD.gather - 0.08, ZEPHYR_WARD.wrap + 0.06), al = wardOn(t);
  if (al <= 0.01) return;
  const spin = t * TAU * 1.4, K = 22, thick = 0.12 * Math.min(Wd.across, Wd.along);
  g.lineCap = 'round';
  for (let q = 0; q < 3; q++) {
    const z = lerp(Wd.low, Wd.high, 0.12 + 0.38 * q) * (0.75 + 0.25 * grow), tilt = (q - 1) * 0.12;
    const k = (0.55 + 0.45 * grow) * (1 - 0.08 * Math.abs(q - 1));
    const from = spin * (q % 2 ? -1 : 1) + q * 2.1, span = TAU * 0.8;
    const pts: Array<[number, number, boolean]> = [];
    for (let e = 0; e <= K; e++) {
      const th = from + (e / K) * span;
      const p: V3 = [c[0] + Math.cos(th) * Wd.across * k, c[1] + Math.sin(th) * Wd.along * k, z + Math.sin(th) * tilt * Wd.high];
      const [x, y] = onScreen(view, p);
      pts.push([x, y, nearSide(p, mid, view)]);
    }
    // A wide faint shimmer, then the bright ribbon down the middle of it, swelling to its middle and thinning to nothing at its ends.
    for (const [col, wk, a0] of [[WIND_EDGE, 3.2, 0.3], [q === 1 ? WARD_LILAC : WIND, 1, 0.95]] as const) {
      g.strokeStyle = css(col, al * a0);
      for (let e = 0; e < K; e++) {
        if (pts[e][2] !== front) continue;
        g.lineWidth = Math.max(0.01, thick * wk * Math.sin(Math.PI * (e + 0.5) / K));
        g.beginPath();
        g.moveTo(pts[e][0], pts[e][1]);
        g.lineTo(pts[e + 1][0], pts[e + 1][1]);
        g.stroke();
      }
    }
  }
  if (!front) return;
  // Glints round it, each its own moment.
  for (let q = 0; q < 8; q++) {
    const th = q * 2.4 + spin * 0.5, k = hump(t, ZEPHYR_WARD.wrap + 0.05 * q, 0.16);
    if (k <= 0) continue;
    const p: V3 = [c[0] + Math.cos(th) * Wd.across * 0.95, c[1] + Math.sin(th) * Wd.along * 0.95, lerp(Wd.low, Wd.high, jitter(q + 3))];
    const [x, y] = onScreen(view, p);
    star(g, x, y, thick * 2.2 * (0.6 + 0.4 * jitter(q)), k * al);
  }
}

/**
 * A gust off it at a strike: bright curved streaks of wind thrown forward in a cone from its jaws as they snap, and on the
 * Tempestwyrm a sweep of them down and forward off each wing as it beats.
 */
function gustOf(g: CanvasRenderingContext2D, view: View, s: Zeph, b: Bones, t: number, front: boolean): void {
  const since = (t - ZEPHYR_HITS[s.stage]) * ACT_SECS.strike;
  if (since < -0.03 || since > 0.3 || !front) return;
  const al = (1 - ramp(since, 0.04, 0.3)) * ramp(since, -0.03, 0.02), u = clamp(since / 0.22 + 0.15);
  const big = [0.45, 0.75, 1.15][s.stage];
  const streaks = (from: V3, fwd: V3, side: V3, n: number, reach: number, spread: number): void => {
    for (let q = 0; q < n; q++) {
      const f = n > 1 ? q / (n - 1) - 0.5 : 0, d = unit(add(fwd, scale(side, f * spread)));
      const a0 = add(from, scale(d, reach * (0.15 + 0.5 * u))), a1 = add(from, scale(d, reach * (0.45 + 0.75 * u)));
      const bow = add(add(a0, a1).map((x) => x / 2) as V3, scale(side, 0.12 * big * (q % 2 ? 1 : -1)));
      const [x0, y0] = onScreen(view, a0), [x1, y1] = onScreen(view, a1), [xm, ym] = onScreen(view, bow);
      g.strokeStyle = css(WIND, al * (0.95 - 0.3 * Math.abs(f)));
      g.lineWidth = 0.07 * big * (1 - 0.4 * Math.abs(f));
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(xm, ym, x1, y1);
      g.stroke();
    }
  };
  g.lineCap = 'round';
  const S = s.head.snout, mouth = place(b.head, [0, S.at[1] + S.r[1] * 0.8, S.at[2] - S.r[2] * 0.4]);
  const fwd = unit(turn(b.head, [0, 1, 0])), side = unit(turn(b.head, [1, 0, 0])), up = unit(turn(b.head, [0, 0, 1]));
  streaks(mouth, fwd, side, 3, 2.3 * big, 0.9);
  streaks(mouth, fwd, up, 2, 2.0 * big, 0.7);
  if (s.wings) for (const q of [0, 1]) {
    const tip = place(b[`wB${q}`], [(q ? 1 : -1) * s.wings.hand * 0.9, -0.6, 0]);
    streaks(tip, unit(add(turn(b.body, [0, 0.8, 0]), [0, 0, -0.6])), turn(b.body, [1, 0, 0]), 3, 2.2, 0.8);
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function zephKind(s: Zeph): Kind {
  return {
    bones: zephBones(s),
    build: (lod) => zephBuild(s, lod),
    // The variant's coat is its back and its blue feathers; its markings, its peach feathers; the lilac between the two. Its cream
    // belly, its amber eyes and its dark claws are the same on every one.
    palette: (coat, mark) => {
      const blue = coat, peach = mark;
      const lilac = mix(mix(coat, [176, 150, 222], 0.62), mark, 0.1);
      return coatPalette(coat, mark, {
        coat: blue,
        coatDark: mix(blue, [60, 70, 120], 0.22),
        coatLight: mix(blue, [246, 248, 255], 0.3),
        lid: mix(blue, [50, 50, 90], 0.45),
        belly: [252, 240, 220],
        muzzle: [246, 226, 202],
        mark: peach,
        feather: mix(blue, [236, 244, 255], 0.06),
        featherDark: mix(blue, [70, 90, 150], 0.14),
        petal: mix(peach, [226, 128, 104], 0.12),
        bloom: mix(peach, [222, 112, 132], 0.28),
        cap: lilac,
        stem: mix(lilac, [90, 70, 130], 0.16),
        shell: [248, 232, 212],
        shellDark: [232, 208, 192],
        hoof: mix(lilac, [150, 140, 170], 0.25),
        claw: [70, 54, 82],
        inner: [226, 124, 136],
        tooth: [252, 248, 236],
        nose: mix(blue, [40, 50, 90], 0.5),
        crystal: [236, 160, 62],
        crystalDark: [196, 108, 40],
        eye: [50, 30, 34],
        spot: [255, 248, 222],
      } as Partial<ReturnType<Kind['palette']>>, 230);
    },
    shadow: s.shadow,
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work', 'cast'],
    motes: [[200, 222, 250], [250, 200, 180]],
    // Its ward lights it from within as it wraps round it: a pale blue shimmer over the body.
    glow: (b, a) => {
      if (a.act?.kind !== 'cast') return [];
      const k = wardOn(a.act.t), Wd = WARDS[s.stage], c = b.shadow.t;
      return k > 0.01 ? [{ p: [c[0], c[1], (Wd.low + Wd.high) * 0.45], r: Math.max(Wd.across, Wd.along) * 1.3, c: [190, 220, 255], a: 0.4 * k }] : [];
    },
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      if (act.kind === 'cast') wardOf(g, view, s, b, act.t, !under);
      else if (act.kind === 'strike') gustOf(g, view, s, b, act.t, !under);
    },
  };
}

export const ZEPHLET = zephKind(ZEPHLET_LOOK);
export const GALECREST = zephKind(GALECREST_LOOK);
export const TEMPESTWYRM = zephKind(TEMPESTWYRM_LOOK);
