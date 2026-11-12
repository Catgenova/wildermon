import {
  ACT_SECS, add, beat, bend, birdBones, clamp, coatPalette, cross, curve, cyc, DEG, dot, eyes, frac, lerp, merge, mix, orb, orbAlong,
  scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BirdPose, type BirdSpec, type Bones, type Kind, type Piece,
} from './beasts';
import { birdLegPieces, cut, jitter, ramp } from './beastkit';
import { joint, mesh, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type Xf } from './figure';
import { patch } from './wild-birds';

/**
 * The peafowl line (the species is `quill`, as saves and the database know
 * it: the bird kept for its feathers). The Peachick: a small peafowl, a royal
 * blue head and neck, a cream-white face, a short gold beak, a crest of a few
 * long stalks each ending in an eye-spot, a cream body, blue and teal wing
 * coverts, a short raised fan of eye-spot tail feathers, gold legs; a few of
 * its feathers shed on the ground round it. The Plumecrest: taller and longer
 * in the neck, a fuller crest, and a long train of layered eye-spot feathers
 * trailing behind it to the ground. The Featherbourne: large, a huge train
 * fanned up and out behind it like a wall, cupped forward so that it reads as
 * a fan from either front corner; a gold crown-ornament and eye-spot plumes on
 * its head, gold filigree armour on its chest and shoulders, and a long cream
 * underplume sweeping back along the ground. Feathers drift off the two
 * bigger ones as they stand.
 *
 * An eye-spot is bold and simple so it reads at the island's zoom: a dark blue
 * middle, a teal ring and a gold ring, on a teal, blue or cream vane. Each is
 * built into its vane as rings of facets in the vane's own plane, so a feather
 * in front covers the eye of one behind it.
 *
 * Standing, its train sways and shimmers, and now and then it shows: the
 * Peachick's fan raised and spread, the Plumecrest's train lifted off the
 * ground into a fan, the Featherbourne's spread wider and shivered. Plucked,
 * its train is short: the longer rows of it grow back with its regrowth
 * (`Anim.fleece`). It walks with a bob and a thrust of the head; it strikes
 * with a peck, the bigger two showing first; evolving, it spreads all of it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/**
 * A row of a wing's feathers, folded along the right flank: rooted from `from` to `to` of the body's half-length along it
 * (front to back) at `z` of its half-height, how many, how long and wide, how far they point down from straight back
 * (degrees), how far out from the flank they lie, their colours by turns and their shape.
 */
interface WingRow { from: number; to: number; z: number; n: number; len: number; w: number; drop: number; layer: number; mats: Mat[]; shape: Shape }

/** A crest stalk: how long, how far back from upright (degrees) and out to the side (degrees), its paddle's length and half-width. */
type Stalk = [number, number, number, number, number];

/** A row of the train: its feathers, and the regrowth (`Anim.fleece`) it is grown back by. */
interface Row { plumes: PlumeSpec[]; grown: number }

interface Pea {
  stage: 0 | 1 | 2;
  spec: BirdSpec;
  /** The body's egg, and how far its front is tipped up (degrees). */
  body: { c: V3; r: V3; pitch: number };
  /** The neck: how thick at the root and under the head, how long, and how far its middle bows back (an S). */
  neck: { w: [number, number]; len: number; bow: number };
  head: { c: V3; r: V3 };
  eye: { dir: V3; size: number };
  beak: { len: number; w: number };
  /** The crest: its root on the crown, its stalks, and cream wisps among them. */
  crest: { at: V3; stalks: Stalk[]; wisps: number };
  wing: WingRow[];
  /** The train, row by row from the back. */
  train: (s: Pea) => Row[];
  /** How it shows its train: the Peachick's fan up, the Plumecrest's lifted, the Featherbourne's spread and shivered. */
  show: { lift: number; spread: number; shiver: number };
  /** The Featherbourne's: gold armour, a gold crown, and a cream underplume along the ground. */
  regal: boolean;
  leg: { shank: number; w: number };
  /** Feathers it sheds: lying on the ground round it, and drifting down from it. */
  shed: { lying: number; drifting: number };
  size: number;
}

/* ---- helpers ------------------------------------------------------------------------- */

/** A ringing that dies away, `since` seconds after a blow. */
const ringOut = (since: number, k: number, f = 2.4, damp = 4): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
/** `v` turned about the unit axis `d` by `a` radians. */
const turned = (v: V3, d: V3, a: number): V3 => add(add(scale(v, Math.cos(a)), scale(cross(d, v), Math.sin(a))), scale(d, dot(d, v) * (1 - Math.cos(a))));
/** A direction `up` degrees back from straight up toward straight back, and `out` degrees round to the side. */
const aim = (up: number, out: number, fwd = 0): V3 => {
  const a = up * DEG, b = out * DEG;
  return unit([Math.sin(b) * Math.max(0.05, Math.sin(a) + 0.3), -Math.sin(a) * Math.cos(b) + fwd, Math.cos(a)]);
};

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

/* ---- a feather ----------------------------------------------------------------------- */

/** A vane's outline: half its width at each share of the way along it, root to tip. */
type Shape = 'leaf' | 'lance' | 'round';
const SHAPES: Record<Shape, ReadonlyArray<readonly [number, number]>> = {
  leaf: [[0, 0.14], [0.12, 0.5], [0.3, 0.82], [0.5, 0.97], [0.66, 1], [0.8, 0.9], [0.9, 0.68], [0.97, 0.36], [1, 0]],
  lance: [[0, 0.12], [0.18, 0.62], [0.4, 0.92], [0.58, 0.88], [0.78, 0.55], [0.92, 0.24], [1, 0]],
  round: [[0, 0.4], [0.2, 0.86], [0.45, 1], [0.7, 0.92], [0.88, 0.62], [1, 0]],
};
const halfAt = (shape: Shape, y: number): number => {
  const S = SHAPES[shape];
  for (let q = 0; q < S.length - 1; q++) {
    const [y0, h0] = S[q], [y1, h1] = S[q + 1];
    if (y <= y1) return h0 + ((h1 - h0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return 0;
};

/**
 * A plume: a shaft along a curve from `root` drawn toward `mid` to `tip`, and from `from` of the way along it a vane `w`
 * either side, its face turned along `face`, cupped by `fold`. An eye-spot, if it has one, built into the vane as rings
 * round a middle short of its tip: the dark middle, a teal ring and a gold ring (`spot`, `water`, `bloom`), its vane
 * beyond them, and a rim of `edge` round the outside if it has one.
 */
interface PlumeSpec {
  root: V3; mid: V3; tip: V3; face: V3; w: number; from: number;
  vane: Mat; edge?: Mat; eye?: boolean; shape?: Shape; fold?: number; shaft?: number; stem?: Mat;
  /** Where it goes when it is shown: the direction from its root to its tip then. */
  shown?: V3;
}

/** The point and frame `u` of the way along a plume's curve. */
function plumeFrame(P: PlumeSpec, u: number): { p: V3; t: V3; n: V3; s: V3 } {
  const p = bend(P.root, P.mid, P.tip, u);
  const t = unit(add(scale(sub(P.mid, P.root), 2 * (1 - u)), scale(sub(P.tip, P.mid), 2 * u)));
  const n = unit(sub(P.face, scale(t, dot(P.face, t))));
  return { p, t, n, s: cross(t, n) };
}

/** A plume's mesh, both faces; `fine` for more rings round an eye. */
function plumeMesh(P: PlumeSpec, fine: boolean): Mesh {
  const shape = P.shape ?? 'leaf', fold = P.fold ?? 0.12, from = P.from;
  // The vane's points, at `y` of the way along the vane and `x` across it (half-widths).
  const at = (y: number, x: number): V3 => {
    const u = from + (1 - from) * y, F = plumeFrame(P, u);
    return add(add(F.p, scale(F.s, x * P.w)), scale(F.n, fold * Math.abs(x) * P.w));
  };
  const want = (y: number): V3 => plumeFrame(P, from + (1 - from) * y).n;
  const v: V3[] = [];
  const f: Face[] = [];
  const wants: V3[] = [];
  // Corners shared between the facets that meet at them, so a side of a feather is one piece (lit as one, lined round its edge).
  const index = new Map<string, number>();
  const pt = ([y, x]: readonly [number, number]): number => {
    const key = `${y.toFixed(5)},${x.toFixed(5)}`;
    let i = index.get(key);
    if (i === undefined) {
      i = v.length;
      v.push(at(y, x));
      index.set(key, i);
    }
    return i;
  };
  const face = (pts: Array<readonly [number, number]>, m: Mat): void => {
    f.push({ i: pts.map(pt), m });
    wants.push(want(pts.reduce((s, p) => s + p[0], 0) / pts.length));
  };
  if (!P.eye) {
    // A strip of quads root to tip.
    const S = SHAPES[shape];
    for (let q = 0; q < S.length - 1; q++) {
      const [y0, h0] = S[q], [y1, h1] = S[q + 1];
      face([[y0, -h0], [y1, -h1], [y1, h1], [y0, h0]], P.vane);
    }
  } else {
    // Rings round the eye, in the vane's (x across, y along) measured in lengths: each ring a fraction of the gold one.
    const N = fine ? 14 : 10, ey = shape === 'round' ? 0.5 : 0.64;
    const gx = 0.72, gy = 0.27;
    const rings: Array<[number, Mat]> = [[0.44, 'spot'], [0.68, 'water'], [1, 'bloom']];
    // The outline's reach from the eye's middle along a ray, found by stepping out until past the vane's edge.
    const reach = (dx: number, dy: number): number => {
      let lo = 0, hi = 3;
      for (let q = 0; q < 24; q++) {
        const mid = (lo + hi) / 2, y = ey + dy * mid, x = dx * mid;
        if (y < 0 || y > 1 || Math.abs(x) > halfAt(shape, y)) hi = mid;
        else lo = mid;
      }
      return lo;
    };
    const ring = (k: number, j: number): [number, number] => {
      const a = ((j % N) / N) * TAU, dx = Math.cos(a) * gx, dy = Math.sin(a) * gy;
      const out = reach(dx, dy);
      const r = Math.min(rings[k][0], out * 0.86);
      return [ey + dy * r, dx * r];
    };
    const rim = (j: number, k: number): [number, number] => {
      const a = ((j % N) / N) * TAU, dx = Math.cos(a) * gx, dy = Math.sin(a) * gy, out = reach(dx, dy);
      return [ey + dy * out * k, dx * out * k];
    };
    // The middle, a dark blue drop.
    face(Array.from({ length: N }, (_, j) => ring(0, j)), rings[0][1]);
    for (let k = 1; k < rings.length; k++) {
      for (let j = 0; j < N; j++) face([ring(k - 1, j), ring(k - 1, j + 1), ring(k, j + 1), ring(k, j)], rings[k][1]);
    }
    // The vane round the gold, out to its edge, and its rim.
    const band = P.edge ? 0.86 : 1;
    for (let j = 0; j < N; j++) face([ring(2, j), ring(2, j + 1), rim(j + 1, band), rim(j, band)], P.vane);
    if (P.edge) for (let j = 0; j < N; j++) face([rim(j, band), rim(j + 1, band), rim(j + 1, 1), rim(j, 1)], P.edge);
  }
  // Both faces: the one listed, and its back, on corners of its own.
  const n0 = f.length, nv = v.length;
  v.push(...v.slice(0, nv));
  for (let q = 0; q < n0; q++) {
    f.push({ i: f[q].i.map((i) => i + nv), m: f[q].m });
    wants.push(scale(wants[q], -1));
  }
  const vane = mesh(v, woundTo(v, f, wants));
  if (from <= 0.02) return vane;
  // The shaft, a fine round stem up to the vane.
  const stem = Array.from({ length: 5 }, (_, q) => plumeFrame(P, (from * q) / 4).p);
  return merge(vane, taper(stem, P.shaft ?? P.w * 0.12, (P.shaft ?? P.w * 0.12) * 0.7, 4, P.stem ?? 'stem'));
}

/** Plumes put together, and each one's run of corners with its root and how it turns to be shown. */
interface Spray { mesh: Mesh; spans: Array<{ s: number; e: number; root: V3; axis: V3; turn: number; id: number }> }
function spray(list: readonly PlumeSpec[], fine: boolean): Spray {
  const parts: Mesh[] = [];
  const spans: Spray['spans'] = [];
  let count = 0;
  list.forEach((P, id) => {
    const m = plumeMesh(P, fine);
    const d0 = unit(sub(P.tip, P.root));
    const d1 = P.shown ? unit(P.shown) : d0;
    const c = cross(d0, d1), sn = Math.hypot(c[0], c[1], c[2]);
    spans.push({ s: count, e: count + m.v.length, root: P.root, axis: sn > 1e-5 ? scale(c, 1 / sn) : [1, 0, 0], turn: Math.atan2(sn, dot(d0, d1)), id });
    parts.push(m);
    count += m.v.length;
  });
  return { mesh: merge(...parts), spans };
}

/* ---- the train ----------------------------------------------------------------------- */

/** The rump, where the train comes out of, in the body's frame. */
const rumpOf = (s: Pea): V3 => [0, s.body.c[1] - s.body.r[1] * 0.8, s.body.c[2] + s.body.r[2] * 0.3];
/**
 * How high in the body's egg (before it is tipped, `tiltPt`) a point `y` along it must be to lie on the ground when it
 * stands: the ground is further down the egg's frame behind it, the egg being tipped up at the front.
 */
const groundAt = (s: Pea, y: number): number => {
  const a = s.body.pitch * DEG, c = s.body.c;
  return (-s.spec.high + 0.05 - c[2] - (y - c[1]) * Math.sin(a)) / Math.cos(a) + c[2];
};

/**
 * A fan of a row of feathers out from `root`, round from one side to the other across `spread` degrees either way: up and
 * back at its middle (`rise` degrees up from straight back), out to the sides at its ends, and the sides brought forward
 * (`cup`) so that it is a dish rather than a flat board. Each faced to the front, toward its head.
 */
function fanRow(root: V3, n: number, len: number, spread: number, w: number, rise: number, cup: number, from: number, vanes: Mat[], edge: Mat | undefined, k: number, open = 1.12): PlumeSpec[] {
  const dir = (phi: number, c: number, up: number): V3 => {
    const e = up * DEG;
    // The middle's way, up and back; round it toward the side by `phi`, and forward at the side by the cup.
    const mid: V3 = [0, -Math.cos(e), Math.sin(e)];
    const side: V3 = [Math.sign(phi) || 1, 0, 0];
    const d = add(scale(mid, Math.cos(phi)), scale(side, Math.abs(Math.sin(phi))));
    return unit(add(d, [0, c * (1 - Math.cos(phi)), 0]));
  };
  return Array.from({ length: n }, (_, q) => {
    const u = n > 1 ? q / (n - 1) - 0.5 : 0, phi = u * spread * 2 * DEG;
    const d = dir(phi, cup, rise);
    const r = add(root, [Math.sin(phi) * 0.15, 0, 0]);
    const L = len * (1 - 0.12 * Math.abs(u)) * (0.94 + 0.12 * jitter(q + k * 7));
    const tip = add(r, scale(d, L));
    // Bowed back a little along its length, so the fan is a shallow bowl front to back as well as round.
    const mid = add(add(r, scale(d, L * 0.5)), scale(dir(phi, 0, rise - 90), L * 0.06));
    // Its face toward the front: square to the way it points and to the way round the fan.
    const across = sub(dir(phi + 0.01, cup, rise), dir(phi - 0.01, cup, rise));
    let face = unit(cross(across, d));
    if (face[1] < 0) face = scale(face, -1);
    return { root: r, mid, tip, face, w: w * (0.92 + 0.12 * jitter(q + 3 + k)), from, eye: true, vane: vanes[q % vanes.length], edge, fold: 0.16, stem: 'leafDark', shown: dir(phi * open, cup * 0.8, Math.min(88, rise + 14)) };
  });
}

/** The Peachick's short fan: eye-spot feathers raised behind it and spread, and blue coverts over their roots. */
function chickTrain(s: Pea): Row[] {
  const R = rumpOf(s);
  const coverts = [-36, -12, 12, 36].map((out, q): PlumeSpec => {
    const d = aim(64, out);
    const len = 0.7 - Math.abs(out) * 0.003, r = add(R, [0, 0.16, 0.06]);
    return { root: r, mid: add(add(r, scale(d, len * 0.5)), [0, 0, 0.06]), tip: add(r, scale(d, len)), face: [0, -0.2, 1], w: 0.2, from: 0, shape: 'round', vane: q % 2 ? 'featherDark' : 'coatDark', shown: aim(36, out * 1.3) };
  });
  return [
    { plumes: fanRow(R, 7, 1.55, 62, 0.3, 40, 0.5, 0.3, ['feather', 'leaf'], undefined, 0, 1.2), grown: 0.5 },
    { plumes: fanRow(add(R, [0, 0.1, 0.02]), 4, 1.05, 40, 0.26, 34, 0.4, 0.22, ['featherDark', 'feather'], undefined, 1, 1.2), grown: 0 },
    { plumes: coverts, grown: 0 },
  ];
}

/**
 * The Plumecrest's train: rows of long eye-spot feathers rising off its back and rump, arching over and falling behind it
 * to the ground, spread wide, so that it is a mantle heaped up behind it and cascading down; the longest underneath. Each
 * faced up and out, the way the mantle faces.
 */
function trailTrain(s: Pea): Row[] {
  const R = rumpOf(s);
  const row = (n: number, len: number, spread: number, w: number, fwd: number, up: number, low: number, arch: number, from: number, k: number): PlumeSpec[] =>
    Array.from({ length: n }, (_, q) => {
      const u = n > 1 ? q / (n - 1) - 0.5 : 0, b = u * spread * 2 * DEG;
      const root = add(R, [u * 0.6, fwd - Math.abs(u) * 0.25, up - Math.abs(u) * 0.2]);
      const L = len * (1 - 0.12 * Math.abs(u)) * (0.95 + 0.1 * jitter(q + k * 4));
      // How far back it reaches, and down to how far off the ground, found by trying: the ground is further down behind.
      let reach = L * 0.8, dz = 0;
      for (let it = 0; it < 4; it++) {
        dz = Math.min(L * 0.85, root[2] - (groundAt(s, root[1] - reach * Math.cos(b)) + low));
        reach = Math.sqrt(Math.max(0.1, L * L - dz * dz)) * 0.92;
      }
      const tip: V3 = [root[0] + Math.sin(b) * reach, root[1] - Math.cos(b) * reach, root[2] - dz];
      // Up off its back first, then over and down.
      const mid: V3 = [lerp(root[0], tip[0], 0.32), lerp(root[1], tip[1], 0.34), Math.max(root[2], tip[2]) + L * arch];
      // Faced out to its side and up, so the mantle shows its feathers' faces from either front corner, not their edges.
      const face: V3 = unit([Math.sin(b) * 1.6 + (q % 2 ? 0.25 : -0.25), 0.35, 0.7]);
      const vane: Mat = (q + k) % 3 === 0 ? 'leaf' : (q + k) % 3 === 1 ? 'feather' : 'featherDark';
      return { root, mid, tip, face, w: w * (1 - 0.1 * Math.abs(u)), from, eye: true, vane, fold: 0.16, stem: 'leafDark', shown: aim(22 + Math.abs(u) * 54, u * 150, 0.15) };
    });
  return [
    { plumes: row(11, 3.2, 66, 0.56, 0.1, 0.1, 0.02, 0.42, 0.2, 0), grown: 0.6 },
    { plumes: row(9, 2.6, 54, 0.52, 0.45, 0.32, 0.22, 0.5, 0.18, 1), grown: 0.3 },
    { plumes: row(7, 1.9, 40, 0.46, 0.85, 0.52, 0.55, 0.56, 0.14, 2), grown: 0 },
    // Over the rump, short broad coverts, each with its eye, where the train comes out from under the wings.
    { plumes: row(6, 1.15, 34, 0.42, 1.15, 0.66, 0.95, 0.5, 0, 3), grown: 0 },
  ];
}

/**
 * The Featherbourne's train, a fan standing up behind it like a wall: rows of feathers out from its rump, each round from
 * one side to the other, cupped forward toward its head at the sides so that it is a dish rather than a flat board, and
 * reads as a fan from either front corner and from the side. Its outer row teal and green edged in gold, the next cream,
 * the inner teal and blue; every one with its eye.
 */
function fanTrain(s: Pea): Row[] {
  const R = rumpOf(s);
  return [
    { plumes: fanRow(R, 15, 3.7, 100, 0.42, 66, 0.55, 0.5, ['feather', 'leaf'], 'bloom', 0), grown: 0.6 },
    { plumes: fanRow(add(R, [0, 0.14, 0]), 12, 2.9, 84, 0.38, 66, 0.5, 0.34, ['petal'], 'bloom', 1), grown: 0.3 },
    { plumes: fanRow(add(R, [0, 0.28, 0]), 9, 2.0, 70, 0.3, 64, 0.45, 0.32, ['featherDark', 'feather', 'leaf'], undefined, 2), grown: 0 },
  ];
}

/** The Featherbourne's underplume: long cream feathers from under its rump sweeping back and out along the ground. */
function underplume(s: Pea): PlumeSpec[] {
  const R = rumpOf(s);
  const root = add(R, [0, 0.3, -s.body.r[2] * 0.6]);
  return [-22, -13, -4, 4, 13, 22].map((out, q): PlumeSpec => {
    const b = out * DEG, len = 3.0 - Math.abs(out) * 0.015 + 0.3 * jitter(q);
    const ty = root[1] - Math.cos(b) * len, my = root[1] - Math.cos(b) * len * 0.45;
    const tip: V3 = [root[0] + Math.sin(b) * len, ty, groundAt(s, ty) + 0.03 * (q % 2)];
    const mid: V3 = [root[0] + Math.sin(b) * len * 0.45, my, groundAt(s, my) + 0.3];
    return { root, mid, tip, face: [Math.sin(b) * 0.3, 0.2, 1], w: 0.38 - Math.abs(out) * 0.003, from: 0.12, shape: 'leaf', vane: q % 2 ? 'petal' : 'belly', edge: 'bloom', fold: 0.22 };
  });
}

/* ---- the stages ---------------------------------------------------------------------- */

/** A wing in rows, scaled to a stage: its primaries, the blue under the coverts, and the cream coverts. */
const wingRows = (k: number): WingRow[] => [
  { from: -0.05, to: -0.3, z: -0.02, n: 3, len: 1.25 * k, w: 0.2 * k, drop: 6, layer: 0, mats: ['featherDark', 'feather'], shape: 'lance' },
  { from: 0.35, to: -0.25, z: -0.1, n: 4, len: 0.85 * k, w: 0.26 * k, drop: 16, layer: 0.03, mats: ['coatDark'], shape: 'leaf' },
  { from: 0.5, to: -0.25, z: 0.26, n: 5, len: 0.62 * k, w: 0.22 * k, drop: 26, layer: 0.06, mats: ['mark', 'belly'], shape: 'leaf' },
  { from: 0.62, to: -0.05, z: 0.52, n: 4, len: 0.48 * k, w: 0.21 * k, drop: 32, layer: 0.09, mats: ['belly', 'mark'], shape: 'leaf' },
];

/** A Peachick: small and round, a royal blue head and neck, a cream body, a crest of five eye-spot stalks, a short raised fan. */
const PEACHICK_LOOK: Pea = {
  stage: 0,
  spec: {
    high: 0.98,
    leg: { at: [0.3, -0.05, -0.46], len: [0.3, 0.4, 0.07], rest: [12, -28] },
    neck: { at: [0, 0.8, 0.34], len: 0.66, lean: 4 },
    head: { pitch: 0 },
    wing: { at: [0.5, 0.5, 0.3] },
    tail: { at: [0, -0.9, 0.3], lift: 0 },
    swing: [26, 38],
    thrust: 10,
    waddle: 3,
    peck: 100, tip: 40, nose: 16, crouch: 0.4, stance: 1.2,
  },
  body: { c: [0, 0, 0], r: [0.68, 1.1, 0.64], pitch: 6 },
  neck: { w: [0.32, 0.25], len: 0.66, bow: 0.1 },
  head: { c: [0, 0.1, 0.1], r: [0.4, 0.46, 0.4] },
  eye: { dir: [0.7, 0.52, 0.32], size: 0.12 },
  beak: { len: 0.32, w: 0.1 },
  crest: { at: [0, -0.06, 0.38], stalks: [[0.98, -4, 4, 0.42, 0.17], [0.94, 16, -8, 0.4, 0.16], [0.9, 34, 8, 0.38, 0.16], [0.8, 52, -6, 0.36, 0.15], [0.7, 70, 6, 0.32, 0.14]], wisps: 0 },
  wing: wingRows(1),
  train: chickTrain,
  show: { lift: 1, spread: 1, shiver: 0.4 },
  regal: false,
  leg: { shank: 0.4, w: 0.095 },
  shed: { lying: 2, drifting: 0 },
  size: 2.4,
};

/** A Plumecrest: taller, a long neck in an S, a fuller crest, and a long train trailing behind it to the ground. */
const PLUMECREST_LOOK: Pea = {
  stage: 1,
  spec: {
    high: 1.75,
    leg: { at: [0.34, -0.08, -0.54], len: [0.56, 0.74, 0.08], rest: [12, -30] },
    neck: { at: [0, 0.92, 0.4], len: 1.3, lean: 12 },
    head: { pitch: -8 },
    wing: { at: [0.55, 0.6, 0.34] },
    tail: { at: [0, -1.1, 0.3], lift: 0 },
    swing: [24, 34],
    thrust: 9,
    waddle: 2,
    peck: 105, tip: 46, nose: 18, crouch: 0.45, stance: 1.2,
  },
  body: { c: [0, 0, 0], r: [0.74, 1.22, 0.72], pitch: 10 },
  neck: { w: [0.38, 0.25], len: 1.3, bow: 0.26 },
  head: { c: [0, 0.1, 0.1], r: [0.38, 0.46, 0.38] },
  eye: { dir: [0.7, 0.52, 0.3], size: 0.11 },
  beak: { len: 0.34, w: 0.09 },
  crest: {
    at: [0, -0.08, 0.36],
    stalks: [[1.1, -6, 4, 0.42, 0.16], [1.06, 10, -10, 0.4, 0.15], [1.02, 24, 10, 0.4, 0.15], [0.96, 38, -8, 0.38, 0.15], [0.9, 52, 8, 0.36, 0.14], [0.82, 66, -4, 0.34, 0.13], [0.74, 80, 4, 0.3, 0.12]],
    wisps: 4,
  },
  wing: wingRows(1.15),
  train: trailTrain,
  show: { lift: 1, spread: 1, shiver: 0.5 },
  regal: false,
  leg: { shank: 0.74, w: 0.11 },
  shed: { lying: 2, drifting: 2 },
  size: 2.5,
};

/** A Featherbourne: large, a huge fan of a train standing behind it, a gold crown, gold armour, and a cream underplume. */
const FEATHERBOURNE_LOOK: Pea = {
  stage: 2,
  spec: {
    high: 2.1,
    leg: { at: [0.42, -0.04, -0.68], len: [0.68, 0.86, 0.1], rest: [12, -30] },
    neck: { at: [0, 1.12, 0.5], len: 1.5, lean: 12 },
    head: { pitch: -8 },
    wing: { at: [0.7, 0.72, 0.42] },
    tail: { at: [0, -1.3, 0.36], lift: 0 },
    swing: [22, 30],
    thrust: 7,
    waddle: 1.5,
    peck: 105, tip: 40, nose: 18, crouch: 0.4, stance: 1.2,
  },
  body: { c: [0, 0, 0], r: [0.94, 1.42, 0.9], pitch: 10 },
  neck: { w: [0.48, 0.3], len: 1.5, bow: 0.3 },
  head: { c: [0, 0.1, 0.1], r: [0.42, 0.5, 0.42] },
  eye: { dir: [0.7, 0.52, 0.3], size: 0.11 },
  beak: { len: 0.38, w: 0.1 },
  crest: {
    at: [0, -0.12, 0.38],
    stalks: [[1.2, 0, 6, 0.44, 0.17], [1.14, 14, -10, 0.42, 0.16], [1.1, 28, 10, 0.42, 0.16], [1.02, 42, -8, 0.4, 0.15], [0.94, 56, 8, 0.38, 0.15], [0.86, 70, -4, 0.34, 0.14], [0.78, 84, 4, 0.32, 0.13]],
    wisps: 6,
  },
  wing: wingRows(1.35),
  train: fanTrain,
  show: { lift: 0.5, spread: 1, shiver: 1 },
  regal: true,
  leg: { shank: 0.86, w: 0.13 },
  shed: { lying: 2, drifting: 3 },
  size: 2.7,
};

/* ---- the moves, in time -------------------------------------------------------------- */

/** The strike: when the peck lands, a stage at a time. */
export const PEA_HITS: readonly number[] = [0.5, 0.54, 0.56];
/** When it shows its train standing: seconds into the loop, and how long for. */
export const PEA_SHOWS: readonly number[] = [7.5, 19.2];
export const PEA_SHOW_LEN = 3.2;

/** How far it is showing its train this moment, nought to one: standing now and then, at a strike, and evolving. */
function showOf(a: Anim, stage: number): number {
  const act = a.act;
  if (act?.kind === 'strike') return ramp(act.t, 0.02, 0.3) * (1 - ramp(act.t, PEA_HITS[stage] + 0.2, 1));
  if (act?.kind === 'evolve') return ramp(act.t, 0.1, 0.4) * (1 - ramp(act.t, 0.7, 1));
  if (act) return 0;
  return beat(a.t, PEA_SHOWS, PEA_SHOW_LEN) ** 0.5 * (1 - a.go) * (1 - a.graze);
}

/** Its train's shiver while it is shown: a quick rattle, in radians. */
const shiverOf = (a: Anim, k: number, id: number): number => k * 0.035 * Math.sin(a.t * TAU * 11 + id * 1.7);

/** Each wing: how far open and how far up, this moment. */
function wingsOf(s: Pea, a: Anim): [number, number] {
  const act = a.act;
  if (act?.kind === 'evolve') { const k = ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.62, 0.95)); return [k, 0.7 * k]; }
  if (act?.kind === 'strike') {
    const hit = PEA_HITS[s.stage];
    const k = ramp(act.t, 0.05, hit - 0.1) * (1 - ramp(act.t, hit + 0.1, 0.95));
    return [0.55 * k, 0.4 * k];
  }
  if (act) return [0, 0];
  // Showing, a peafowl lowers its wings and quivers them; walking, held a little out.
  const show = showOf(a, s.stage);
  return [0.18 * show + 0.15 * a.go * a.gait, -0.18 * show + 0.1 * a.go * a.gait];
}

/** Its own moves over the pose a bird has (`birdBones`). */
function posePea(s: Pea, p: BirdPose, a: Anim): void {
  const act = a.act, t = a.t;
  const [open, up] = wingsOf(s, a);
  p.wings = [[open, up], [open, up]];
  if (act) {
    const k = 1 - ramp(act.t, 0, 0.12) * (1 - ramp(act.t, 0.9, 1));
    p.head[1] *= k;
    p.head[2] *= k;
  }
  if (!act && a.go < 1) {
    const st = 1 - a.go;
    // A cock of the head now and then, and its looks kept small so its face stays to whoever looks at it.
    p.head[1] *= 0.55;
    p.head[2] += st * 18 * (beat(t, [3.1, 12.4], 1.3) - beat(t, [9.0, 21.6], 1.2));
    // Showing: stood up tall, the neck drawn back and the breast out.
    const show = showOf(a, s.stage);
    p.neck[0] -= 10 * show;
    p.head[0] += 6 * show;
    p.pitch += 4 * show;
  }
  if (a.go > 0 && !act) {
    // The walk's bob, and the train following.
    const g = a.go, w = frac(a.u);
    p.lift += g * 0.04 * Math.cos(w * TAU * 2);
    p.pitch += g * (-3 + 2 * Math.sin(w * TAU * 2));
  }
  if (act?.kind === 'strike') {
    const hit = PEA_HITS[s.stage], since = (act.t - hit) * ACT_SECS.strike;
    const gather = ramp(act.t, 0.04, hit - 0.16) * (1 - ramp(act.t, hit - 0.14, hit));
    const thrust = ramp(act.t, hit - 0.14, hit) * (1 - ramp(act.t, hit + 0.1, 0.95));
    if (s.stage === 0) p.lift += 0.3 * Math.max(0, Math.sin(Math.PI * clamp((act.t - hit + 0.16) / 0.22)));
    p.pitch += 8 * gather - 10 * thrust + ringOut(since, 4);
    p.neck[0] += -24 * gather + 40 * thrust;
    p.head[0] += 14 * gather + 22 * thrust;
    for (const l of p.legs) { l[0] += 10 * gather + 8 * thrust; l[1] += 0.35 * gather; }
    p.jaw = Math.max(p.jaw, 0.8 * Math.max(0, 1 - Math.abs(act.t - hit + 0.06) / 0.1));
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.65, 0.95));
    p.neck[0] -= 16 * k;
    p.head[0] += 18 * k;
    p.lift += 0.2 * k;
  }
}

/** How far its strike carries it forward this moment, in its own units. */
function surgeOf(s: Pea, a: Anim): number {
  if (a.act?.kind !== 'strike') return 0;
  const t = a.act.t, hit = PEA_HITS[s.stage];
  return [0.6, 0.5, 0.45][s.stage] * ramp(t, hit - 0.16, hit) * (1 - ramp(t, hit + 0.12, 0.96));
}

/** Where its shed feathers lie round it, in its own units (x, y, turn in degrees), and the paths the drifting ones fall on. */
const LYING: ReadonlyArray<readonly [number, number, number]> = [[1.25, 0.9, 30], [-1.1, 0.35, 150], [1.4, -1.0, 80]];
const DRIFTS: ReadonlyArray<readonly [number, number, number]> = [[-1.6, 0.8, 0.3], [1.7, -0.6, 0.6], [-1.2, -2.0, 0.85]];
/** Seconds a drifting feather takes to come down: a whole number of them to the loop. */
const DRIFT_SECS = 8;

function peaBones(s: Pea): (a: Anim) => Bones {
  return (a) => {
    const b = birdBones(s.spec, a.act ? { ...a, go: 0 } : a, (p) => posePea(s, p, a));
    b.crest = joint(b.head, s.crest.at, 0, 0, 0);
    const fwd = surgeOf(s, a);
    if (fwd) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + fwd, b[k].t[2]] };
    const big = [0.8, 1, 1.25][s.stage];
    for (let q = 0; q < s.shed.lying; q++) {
      const [x, y, yaw] = LYING[q];
      b[`lie${q}`] = joint(ROOT, [x * big, y * big, 0.015], 0, 0, yaw);
    }
    for (let q = 0; q < s.shed.drifting; q++) {
      // Falling from over its back, swinging from side to side and turning as it comes down, lying a moment, and gone.
      const [x, y, at] = DRIFTS[q], u = frac(a.t / DRIFT_SECS + at);
      const fall = smooth(u / 0.8), top = s.spec.high * 1.9 + 0.5 * s.stage;
      const sw = Math.sin(u * TAU * 2.5) * (1 - fall);
      const p: V3 = [x * big + 0.5 * sw, y * big + 0.2 * Math.cos(u * TAU * 2), 0.03 + top * (1 - fall)];
      const k = Math.min(ramp(u, 0, 0.06), 1 - ramp(u, 0.9, 1));
      const xf = joint(ROOT, p, 40 * sw * (1 - fall), 30 * Math.sin(u * TAU * 1.5) * (1 - fall), u * 300 + q * 90);
      b[`drift${q}`] = { m: xf.m.map((v) => v * Math.max(0.02, k)) as Xf['m'], t: xf.t };
    }
    return b;
  };
}

/* ---- its pieces ---------------------------------------------------------------------- */

/** A point on the right flank, `out` off the body's egg, at `y` along it and `z` up it (in the egg's own frame); the way out there. */
function flank(s: Pea, y: number, z: number, out: number): { p: V3; n: V3 } {
  const B = s.body;
  const k = 1 - ((y - B.c[1]) / B.r[1]) ** 2 - ((z - B.c[2]) / B.r[2]) ** 2;
  const x = B.r[0] * Math.sqrt(Math.max(0.06, k));
  const n = unit([x / (B.r[0] * B.r[0]), (y - B.c[1]) / (B.r[1] * B.r[1]), (z - B.c[2]) / (B.r[2] * B.r[2])]);
  return { p: add([x, y, z], scale(n, out)), n };
}

/**
 * A wing's feathers, folded along the right flank: rows from the long primaries underneath out to the cream coverts over
 * them, each feather laid on the body's egg so the wing hugs it, in the wing's own frame (its shoulder at `spec.wing.at`).
 */
function wingMesh(s: Pea, fine: boolean): Mesh {
  const B = s.body, at = s.spec.wing.at, out: Mesh[] = [];
  s.wing.forEach((W, r) => {
    for (let q = 0; q < W.n; q++) {
      const u = W.n > 1 ? q / (W.n - 1) : 0;
      const y = B.r[1] * lerp(W.from, W.to, u), z = B.r[2] * W.z;
      const d: V3 = [0, -Math.cos(W.drop * DEG), -Math.sin(W.drop * DEG)];
      const tipY = y + d[1] * W.len, tipZ = z + d[2] * W.len;
      const root = flank(s, y, z, W.layer), tip = flank(s, tipY, tipZ, W.layer + 0.02);
      const mid = flank(s, (y + tipY) / 2, (z + tipZ) / 2, W.layer + 0.05);
      const pl = (p: V3): V3 => sub(tiltPt(B, p), at);
      out.push(plumeMesh({
        root: pl(root.p), mid: pl(mid.p), tip: pl(tip.p), face: tiltDir(B, add(mid.n, [0.3, 0, 0.2])), w: W.w * (0.92 + 0.12 * jitter(q + r * 5)),
        from: 0, shape: W.shape, vane: W.mats[q % W.mats.length], fold: 0.1,
      }, fine));
    }
  });
  return merge(...out);
}

/** A loose feather lying along +y from its quill at the origin, face up: what it sheds. */
function looseMesh(len: number, fine: boolean, m: Mat): Mesh {
  return plumeMesh({ root: [0, -len * 0.5, 0], mid: [0.04, 0, 0.02], tip: [0, len * 0.5, 0.05], face: [0, 0, 1], w: len * 0.24, from: 0.3, eye: true, vane: m, fold: 0.15, shaft: 0.018 }, fine);
}

/** A spiral of gold, for a curl of filigree: `turns` round, out from its middle to `r`, in the plane square to `n`. */
function curl(c: V3, n: V3, up: V3, r: number, turns: number, w: number, m: Mat = 'metal'): Mesh {
  const d = unit(n), x = unit(sub(up, scale(d, dot(up, d)))), y = cross(d, x);
  const K = Math.round(turns * 10);
  const pts = Array.from({ length: K + 1 }, (_, q) => {
    const u = q / K, a = u * turns * TAU, rr = r * (0.18 + 0.82 * u);
    return add(c, add(scale(x, Math.cos(a) * rr), scale(y, Math.sin(a) * rr)));
  });
  return tube(pts, pts.map((_, q) => w * (0.45 + 0.55 * (q / K))), pts.map((_, q) => w * (0.45 + 0.55 * (q / K))), 5, m);
}

function peaBuild(s: Pea, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7), fine = lod > 0;
  const B = s.body, H = s.head;
  // The body: an egg tipped up at the front, cream, the blue of the neck down over the breast.
  const rings = k + 3, around = n + 3;
  const egg = tube(Array.from({ length: rings + 1 }, (_, q) => [B.c[0], B.c[1] - B.r[1] * Math.cos((Math.PI * q) / rings), B.c[2]] as V3),
    Array.from({ length: rings + 1 }, (_, q) => B.r[0] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    Array.from({ length: rings + 1 }, (_, q) => B.r[2] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    around, (ring, j) => {
      const ang = (((j + 0.5) / around) * TAU) % TAU;
      // The breast: the front rings, all but underneath; and the ring behind it up its front.
      const top = Math.sin(ang);
      if (ring >= rings - 1 && top > -0.45) return 'coat';
      if (ring === rings - 2 && top > 0.1) return 'coat';
      return top < -0.6 ? 'belly' : 'mark';
    });
  const tilt = (m: Mesh): Mesh => mesh(m.v.map((p) => {
    const a = B.pitch * DEG, y = p[1] - B.c[1], z = p[2] - B.c[2];
    return [p[0], B.c[1] + y * Math.cos(a) - z * Math.sin(a), B.c[2] + y * Math.sin(a) + z * Math.cos(a)] as V3;
  }), m.f);
  // Scales down the blue breast: darker drops in rows.
  const scales = merge(...Array.from({ length: fine ? 8 : 4 }, (_, q) => {
    const row = Math.floor(q / 4), col = (q % 4) - 1.5;
    return patch(B.c, B.r, [col * 0.3 + (row % 2) * 0.15, 1, 0.55 - row * 0.28], 0.06, 0.08, 'coatDark', { sides: 5 });
  }));
  const body = tilt(merge(egg, scales));
  // The neck: up from the shoulders, bowed back in its middle for an S.
  const N = s.neck;
  const P0: V3 = [0, 0, -0.32], P1: V3 = [0, N.bow * 0.6, N.len * 0.35], P2: V3 = [0, -N.bow, N.len * 0.68], P3: V3 = [0, 0.03, N.len + 0.04];
  const links = N.bow > 0.1 ? 8 : 4;
  const neckPts: V3[] = Array.from({ length: links }, (_, q) => {
    const u = q / (links - 1), v = 1 - u;
    return add(add(scale(P0, v * v * v), scale(P1, 3 * v * v * u)), add(scale(P2, 3 * v * u * u), scale(P3, u * u * u)));
  });
  const neckW = neckPts.map((_, q) => lerp(N.w[0], N.w[1], smooth(q / (neckPts.length - 1))));
  const neck = tube(neckPts, neckW, neckW, n, 'coat', { seam: 'both', up: [0, 1, 0] });
  // The head: royal blue, a cream-white patch from the beak back under the eye and a cream stripe over it, a clear eye.
  const skull = orb(H.c, H.r, n + 2, k + 1, 'coat');
  const face = (sd: number): Mesh => merge(
    patch(H.c, H.r, [sd * 0.6, 0.66, -0.3], 0.7, 0.46, 'muzzle', { sides: 14 }),
    patch(H.c, H.r, [sd * 0.5, 0.42, 0.62], 0.5, 0.1, 'muzzle', { sides: 8 }),
    // A dark line along the top of the eye, and on to the back of the head.
    patch(H.c, H.r, [sd * 0.74, 0.36, 0.38], 0.36, 0.05, 'coatDark', { sides: 8 }),
  );
  const look = (shut: boolean): Mesh => eyes(H.c, H.r, s.eye.dir, s.eye.size, { shut, tall: 1.12, rim: 0.3, iris: 'leaf', pupil: 0.55, glint: 0.42 });
  // The beak: short, gold, a little hooked; the lower half on the jaw.
  const bk = s.beak, root: V3 = [0, H.c[1] + H.r[1] * 0.86, H.c[2] - H.r[2] * 0.12];
  const upper = taper(curve(root, add(root, [0, bk.len * 0.55, 0.02]), add(root, [0, bk.len, -bk.len * 0.3]), 4), bk.w, bk.w * 0.12, 6, 'bill', 0.85);
  const lower = taper(curve(add(root, [0, -0.02, -bk.w * 0.55]), add(root, [0, bk.len * 0.45, -bk.w * 0.6]), add(root, [0, bk.len * 0.78, -bk.len * 0.26]), 3), bk.w * 0.7, bk.w * 0.12, 5, 'billDark', 0.7);
  const headMesh = (shut: boolean): Mesh => merge(skull, face(1), face(-1), look(shut));
  // The crest: fine cream stalks up and back off the crown, each with its paddle and eye; and cream wisps among them.
  const C = s.crest;
  const stalks = merge(...C.stalks.map(([len, up, out, pl, pw], q) => {
    const d = aim(up, out);
    const tip = scale(d, len);
    const mid = add(scale(d, len * 0.5), [0, -len * 0.08, len * 0.04]);
    const big = [1.25, 1.45, 1.5][s.stage], from = clamp(1 - (pl * big) / len, 0.2, 0.9);
    const sd = out < 0 ? -1 : out > 0 ? 1 : q % 2 ? 1 : -1;
    return plumeMesh({ root: [0, 0, 0], mid, tip, face: unit([sd * 0.85, 0.35, 0.2]), w: pw * big, from, eye: true, vane: q % 2 ? 'feather' : 'leaf', fold: 0.08, shaft: 0.022 }, fine);
  }));
  const wisps = merge(...Array.from({ length: C.wisps }, (_, q) => {
    const out = (q - (C.wisps - 1) / 2) * 16, d = aim(30 + 12 * (q % 3), out);
    const len = 0.7 + 0.2 * jitter(q + 30);
    return plumeMesh({ root: [0, 0.02, 0], mid: add(scale(d, len * 0.5), [0, -0.1, 0.05]), tip: add(scale(d, len), [0, -0.12, -0.08]), face: unit([out < 0 ? -1 : 1, 0.2, 0.3]), w: 0.07, from: 0.05, shape: 'lance', vane: 'belly', fold: 0.2 }, fine);
  }));
  const wing = wingMesh(s, fine);
  const L0 = s.spec.leg.len[0];
  const thigh = orbAlong([0, 0.02, -L0 * 0.45], [0, 0, 1], [s.leg.w * 2.8, s.leg.w * 3.0, L0 * 0.62], n, k, 'mark');
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } },
    { key: 'neck', mesh: neck, bone: 'neck', bias: 0, under: 'head', convex: true, lines: false },
    { key: 'head', mesh: headMesh(false), shut: headMesh(true), bone: 'head', bias: 0.2 },
    { key: 'beak', mesh: upper, bone: 'head', bias: 0.205, thin: true },
    { key: 'jaw', mesh: lower, bone: 'jaw', bias: 0.19, under: 'head', thin: true },
    { key: 'crest', mesh: merge(stalks, wisps), bone: 'crest', bias: 0.21, after: 'head', hide: [{ c: H.c, r: scale(H.r, 0.86) }], hideIn: 'head', lines: false, even: true },
    ...[0, 1].map((q): Piece => {
      const sd = q ? 1 : -1;
      return { key: `wing${q}`, mesh: q ? wing : mirror(wing), bone: `wing${q}`, bias: 0.04, after: 'body', front: [sd, 0, 0], even: true };
    }),
    ...[0, 1].map((q): Piece => ({
      key: `thigh${q}`, mesh: thigh, bone: `${['bl', 'br'][q]}0`, bias: 0.015, after: 'body', front: [q ? 1 : -1, 0.3, 0], lines: false,
    })),
    ...birdLegPieces('bl', -1, s.leg.shank, s.leg.w, 5),
    ...birdLegPieces('br', 1, s.leg.shank, s.leg.w, 5),
  ];
  // The train, a piece a row, each grown back with its regrowth; swaying, shown and shivered (`trainBent`).
  s.train(s).forEach((row, r) => {
    const sp = spray(row.plumes.map((P) => ({ ...P, root: tiltPt(B, P.root), mid: tiltPt(B, P.mid), tip: tiltPt(B, P.tip), face: tiltDir(B, P.face), shown: P.shown && tiltDir(B, P.shown) })), fine);
    pieces.push({
      key: `train${r}`, mesh: sp.mesh, bone: 'body', bias: -0.12 + r * 0.01, lines: false, even: true,
      shown: row.grown > 0 ? (a) => a.fleece >= row.grown : undefined,
      bent: (v, a) => trainBent(s, v, sp.spans, a, r),
    });
  });
  if (s.regal) {
    const under = spray(underplume(s), fine);
    pieces.push({ key: 'under', mesh: under.mesh, bone: 'body', bias: -0.1, lines: false, even: true, bent: (v, a) => trainBent(s, v, under.spans, a, 9, 0.4) });
    pieces.push(...regalia(s, n, fine));
  }
  // What it sheds: feathers on the ground round it standing, and drifting down off it.
  const loose = (q: number): Mesh => looseMesh([0.8, 0.95, 1.15][s.stage], fine, q % 2 ? 'feather' : 'leaf');
  for (let q = 0; q < s.shed.lying; q++) pieces.push({ key: `lie${q}`, mesh: loose(q), bone: `lie${q}`, bias: -0.3, lines: false, even: true, shown: (a) => a.go < 0.5 && !a.act });
  for (let q = 0; q < s.shed.drifting; q++) pieces.push({ key: `drift${q}`, mesh: loose(q + 1), bone: `drift${q}`, bias: 0, lines: false, even: true, shown: (a) => a.go < 0.5 && !a.act });
  return pieces;
}

/** A point of the body's, tipped with the body's egg, so the train comes out of the rump where the egg puts it. */
const tiltPt = (B: Pea['body'], p: V3): V3 => {
  const a = B.pitch * DEG, y = p[1] - B.c[1], z = p[2] - B.c[2];
  return [p[0], B.c[1] + y * Math.cos(a) - z * Math.sin(a), B.c[2] + y * Math.sin(a) + z * Math.cos(a)];
};
const tiltDir = (B: Pea['body'], d: V3): V3 => sub(tiltPt(B, d), tiltPt(B, [0, 0, 0]));

/** A mesh mirrored left for right, its faces turned back the right way out. */
function mirror(m: Mesh): Mesh {
  return mesh(m.v.map(([x, y, z]) => [-x, y, z] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
}

/**
 * The train's corners this moment: each feather turned about its root toward where it goes shown, by how far it is shown;
 * a slow sway, a feather at a time out of step; and while it is shown, a shiver. Walking, it trails a little behind.
 */
function trainBent(s: Pea, v: readonly V3[], spans: Spray['spans'], a: Anim, row: number, sway = 1): V3[] {
  const show = row === 9 ? 0 : showOf(a, s.stage);
  const out = v.slice() as V3[];
  const k = show * s.show.lift;
  for (const S of spans) {
    // The sway: about the up axis and across, slow, out of step from feather to feather; more on a long one.
    const ph = S.id * 0.9 + row * 0.6;
    const yaw = sway * (0.035 * cyc(a.t, 3, ph) + 0.02 * cyc(a.t, 7, ph * 1.3)) * (1 - 0.6 * show);
    const nod = sway * (0.025 * cyc(a.t, 4, ph + 1) - 0.06 * a.go * (0.5 + 0.5 * Math.sin(frac(a.u) * TAU * 2 + ph)));
    const shiver = shiverOf(a, show * s.show.shiver, S.id + row * 5);
    const turn = S.turn * k;
    if (Math.abs(turn) < 1e-4 && Math.abs(yaw) < 1e-4 && Math.abs(nod) < 1e-4 && Math.abs(shiver) < 1e-4) continue;
    for (let i = S.s; i < S.e; i++) {
      let p = sub(v[i], S.root);
      if (turn) p = turned(p, S.axis, turn);
      p = turned(p, [0, 0, 1], yaw + shiver);
      p = turned(p, [1, 0, 0], nod + shiver * 0.6);
      out[i] = add(S.root, p);
    }
  }
  return out;
}

/** The Featherbourne's gold: a breastplate with a teal gem, a plate and a curl of filigree on each shoulder, a collar, and its crown. */
function regalia(s: Pea, n: number, fine: boolean): Piece[] {
  const B = s.body, H = s.head;
  const R: V3 = scale(B.r, 1.05);
  const dirAt = (a: number, b: number): V3 => [Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b)];
  /**
   * A shell of gold on the body's egg, round `a0` (radians round from the front toward its right) and up `b0`, `sa` and
   * `sb` either way; its lower edge cut into points, and a lighter rim along its top.
   */
  const shell = (a0: number, b0: number, sa: number, sb: number, cols: number, rows: number, point: number): Mesh => {
    const v: V3[] = [];
    const f: Face[] = [];
    const wants: V3[] = [];
    const at = (c: number, r: number): { p: V3; n: V3 } => {
      const u = c / (cols - 1) - 0.5, a = a0 + u * 2 * sa;
      // Points along its lower edge: every other column reaches lower.
      const low = b0 - sb - (c % 2 ? 0 : point) * (1 - Math.abs(u));
      return onEggOut(B.c, R, dirAt(a, lerp(low, b0 + sb, r / (rows - 1))));
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) v.push(at(c, r).p);
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      f.push({ i: [r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c], m: r === rows - 2 ? 'metalLit' : r === 0 ? 'metalDark' : 'metal' });
      wants.push(at(c + 0.5, r + 0.5).n);
    }
    const top = Array.from({ length: cols }, (_, c) => add(at(c, rows - 1).p, scale(at(c, rows - 1).n, 0.02)));
    return merge(mesh(v, woundTo(v, f, wants)), tube(top, 0.045, 0.045, 4, 'metalLit'));
  };
  // The breastplate: a gorget round the front of the neck's root and down over the breast, its lower edge in points, a
  // teal gem in the middle of it; in the neck's frame, so it goes where the neck goes.
  const gorget = ((): Mesh => {
    const cols = fine ? 13 : 9, rows = 3, w0 = s.neck.w[0];
    const v: V3[] = [];
    const f: Face[] = [];
    const wants: V3[] = [];
    const at = (c: number, r: number): V3 => {
      const u = c / (cols - 1) - 0.5, a = Math.PI / 2 + u * 2 * 1.9;
      const low = -0.42 - (c % 2 ? 0 : 0.22) * (1 - Math.abs(u) * 1.4);
      const k = r / (rows - 1), z = lerp(low, 0.14, k), rad = w0 * lerp(1.62, 1.04, Math.sqrt(k));
      return [Math.cos(a) * rad, Math.sin(a) * rad, z];
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) v.push(at(c, r));
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      f.push({ i: [r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c], m: r === 0 ? 'metal' : 'metalLit' });
      const m = at(c + 0.5, r + 0.5);
      wants.push(unit([m[0], m[1], 0.6]));
    }
    const top = Array.from({ length: cols }, (_, c) => at(c, rows - 1));
    const front = at((cols - 1) / 2, 0.8);
    return merge(mesh(v, woundTo(v, f, wants)), tube(top, 0.03, 0.03, 4, 'metalDark'),
      orbAlong(add(front, [0, 0.06, 0]), [0, 1, 0], [0.13, 0.08, 0.18], 4, 3, 'gem'));
  })();
  // A plate on each shoulder over the wing's root, a curl of filigree on it.
  const shoulder = (sd: number): Mesh => {
    const p = onEggOut(B.c, R, dirAt(sd * 1.05, 0.5));
    return merge(
      shell(sd * 1.05, 0.5, 0.32, 0.22, fine ? 7 : 5, 3, 0.16),
      curl(add(p.p, scale(p.n, 0.06)), p.n, [0, 0.4, 1], 0.13, 1.6, 0.035, 'metalLit'),
    );
  };
  const tl = (m: Mesh): Mesh => mesh(m.v.map((p) => tiltPt(B, p)), m.f);
  // A collar of gold round the neck's root.
  const collar = tube(Array.from({ length: 13 }, (_, q) => {
    const a = (q / 12) * TAU;
    return [Math.cos(a) * s.neck.w[0] * 1.02, Math.sin(a) * s.neck.w[0] * 0.95, 0.02 + 0.06 * Math.cos(a - Math.PI / 2)] as V3;
  }), 0.05, 0.05, 5, 'metal');
  // The crown on its brow: a gold curl standing up off the forehead, a band round the crown, a teal gem in it.
  const brow: V3 = [0, H.c[1] + H.r[1] * 0.35, H.c[2] + H.r[2] * 0.82];
  const crown = merge(
    curl(add(brow, [0, -0.02, 0.26]), [1, 0, 0], [0, 1, 0.3], 0.18, 1.5, 0.045),
    taper(curve(brow, add(brow, [0, -0.06, 0.14]), add(brow, [0, -0.02, 0.3]), 3), 0.06, 0.04, 5, 'metal'),
    tube(Array.from({ length: 9 }, (_, q) => {
      const a = (q / 8 - 0.5) * 2.4;
      const d = unit([Math.sin(a), Math.cos(a) * 0.9, 0.55]);
      const p = onEggOut(H.c, scale(H.r, 1.04), d).p;
      return p;
    }), 0.035, 0.035, 4, 'metalLit'),
    orbAlong(add(brow, [0, 0.03, 0.02]), [0, 1, 0.3], [0.06, 0.05, 0.08], 4, 3, 'gem'),
  );
  return [
    { key: 'plate', mesh: gorget, bone: 'neck', bias: 0.06, after: ['body', 'neck'] },
    { key: 'pauldron0', mesh: tl(shoulder(-1)), bone: 'body', bias: 0.07, after: ['body', 'wing0'], front: [-1, 0.3, 0], thin: true },
    { key: 'pauldron1', mesh: tl(shoulder(1)), bone: 'body', bias: 0.07, after: ['body', 'wing1'], front: [1, 0.3, 0], thin: true },
    { key: 'collar', mesh: collar, bone: 'neck', bias: 0.05, after: ['neck', 'plate'], thin: true },
    { key: 'crown', mesh: crown, bone: 'head', bias: 0.215, after: ['head', 'crest'], thin: true, hide: [{ c: H.c, r: scale(H.r, 0.9) }] },
  ];
}

/** A point on an egg, `c` its middle and `r` its half-sizes, out along `dir`, and the way out of it there. */
function onEggOut(c: V3, r: V3, dir: V3): { p: V3; n: V3 } {
  const d = unit(dir);
  const k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = add(c, scale(d, k));
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
}

/* ---- the kinds ----------------------------------------------------------------------- */

/** Its eye-spots and train the same on every variant: teal, a deeper blue, a green-teal, the gold and the dark middle. */
const TEAL: RGB = [28, 146, 150];
const GREEN: RGB = [58, 150, 98];
const BLUE: RGB = [34, 76, 168];
const GOLD: RGB = [238, 176, 44];
const SPOT: RGB = [36, 28, 112];
const RING: RGB = [34, 168, 196];
const CREAM: RGB = [244, 218, 166];

function peaKind(s: Pea): Kind {
  return {
    bones: peaBones(s),
    build: (lod) => peaBuild(s, lod),
    // The variant's coat is its head, neck and breast, its markings its body's cream.
    palette: (coat, mark) => {
      const cream = mix(CREAM, mark, 0.25);
      return coatPalette(coat, mark, {
        coat,
        coatDark: mix(coat, [20, 30, 80], 0.35),
        coatLight: mix(coat, [255, 255, 255], 0.3),
        mark: cream,
        belly: mix(cream, [255, 250, 240], 0.4),
        muzzle: [252, 248, 238],
        feather: TEAL,
        featherDark: BLUE,
        leaf: GREEN,
        leafDark: mix(GREEN, [20, 60, 60], 0.4),
        spot: SPOT,
        water: RING,
        bloom: GOLD,
        petal: mix(CREAM, [246, 222, 170], 0.3),
        stem: [236, 214, 160],
        bill: [236, 178, 60],
        billDark: [206, 146, 46],
        claw: [222, 158, 62],
        eye: [24, 28, 40],
        eyeWhite: [250, 246, 232],
        lid: mix(coat, [20, 20, 50], 0.4),
        glint: [255, 253, 246],
        metal: [232, 178, 60],
        metalLit: [252, 214, 110],
        metalDark: [176, 122, 36],
        gem: [60, 200, 186],
      });
    },
    shadow: [[1.2, 1.9, 2.6][s.stage], [0.85, 1.05, 1.6][s.stage]],
    stride: 1.15,
    size: s.size,
    blinks: 5,
    acts: ['strike'],
    motes: [[64, 196, 214], [240, 186, 64]],
  };
}

export const PEACHICK = peaKind(PEACHICK_LOOK);
export const PLUMECREST = peaKind(PLUMECREST_LOOK);
export const FEATHERBOURNE = peaKind(FEATHERBOURNE_LOOK);
