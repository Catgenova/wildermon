import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, hex, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The relic line: the Kintsu, a small round beetle whose turquoise shell is
 * broken and mended in gold (kintsugi), cream patches let into it, two gold
 * horns, a big dark eye either side and short gold-tipped legs, with a little
 * wicker basket on its back holding carved rune stones and turquoise pebbles;
 * which grows into the Relicrawler, bigger and longer, long sweeping horns,
 * more gold in its shell, a wicker crate on its back with brushes, a jar and
 * a cream cloth banner with a gold sun on it, and gold claws, the right one
 * holding a stone tablet; and then the Aureliax, large, a winged gold crest
 * over its head with a glowing turquoise gem set in it, a gold-banded relic
 * chest on its back hung with banners and stacked with tablets, and stone
 * fragments floating by its right claw. The species is still `relka`
 * underneath, as saves and the database know it: the restorer, that puts
 * relics back together out of their pieces.
 *
 * All three are built by one set of functions from a description of the
 * stage (`Relic`). Its front is `y`, its right `x`, up `z`. Six legs, three a
 * side, go in two sets of three by turns, as a beetle's do; each foot stays
 * where it was put while it is down.
 *
 * At its task it mends, as its shell was mended: the Kintsu bows over a
 * cracked tablet lying in front of it, taps it with its horns and forelegs
 * while the crack fills with gold, and flips it up into its basket; the
 * Relicrawler holds its tablet up and runs its other claw along the crack,
 * the gold following it; the Aureliax draws the floating fragments in round
 * its claw in golden rings until they are a statue's head, seamed in gold,
 * and sends it up into its chest.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Three legs a side, front to back: hips across, up and along; each foot's turn from straight out (degrees, forward positive); the leg's two parts; how far out a foot stands; how thick. */
interface Legs { x: number; z: number; ys: number[]; fan: number[]; upper: number; lower: number; reach: number; thick: number }

/**
 * Claws, the two bigger ones': the right shoulder on the body, the arm's two parts, the hand's length and how thick the arm is,
 * and where each wrist rests (body frame, right side), how its hand is tipped and how far its fingers are open.
 */
interface Claws { at: V3; arm: [number, number]; hand: number; thick: number; rest: { w: V3; pitch: number; yaw: number; roll: number; open: number } }

/** What it carries on its back: a round wicker basket, a wicker crate, or a gold-banded chest. */
type Cargo = 'basket' | 'crate' | 'chest';

interface Relic {
  stage: 0 | 1 | 2;
  /** How high its middle is carried, standing. */
  high: number;
  /** The shell: a dome, the top of an egg (middle and half-sizes), cut off at `lo` (radians under its waist); how many gold cracks over it and cream patches let into it. */
  shell: { c: V3; r: V3; lo: number; cracks: number; patches: number };
  /** The underside, gold-brown, in rings. */
  belly: { c: V3; r: V3 };
  /** The head: its middle on the body, its half-sizes; the right eye's way out of it and its size. */
  head: { at: V3; r: V3; eye: V3; size: number };
  /** Two gold horns off the top of the head, each from its root through its bend to its tip (right one; head frame), and how thick. */
  horns: { root: V3; mid: V3; tip: V3; w: number } | null;
  /** The Aureliax's winged crest and the gem in its brow. */
  crest: boolean;
  legs: Legs;
  claws: Claws | null;
  cargo: Cargo;
  /** Where its cargo sits on its back (the middle of its foot), its half-width, half-length and height, and how far it leans back (degrees). */
  pack: { at: V3; w: number; l: number; h: number; tilt: number };
  /** How long a banner hangs from the cargo's sides (and back, on the chest); nought for none. */
  banner: number;
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; bob: number; sway: number };
  /** How big the relic it mends is (a tablet's half-height, or the statue head's). */
  item: number;
  size: number;
}

/** A Kintsu: small and round, a basket of rune stones and turquoise pebbles on its back, two short curled horns, big dark eyes, short legs. */
const KINTSU_LOOK: Relic = {
  stage: 0,
  high: 0.17,
  shell: { c: [0, -0.04, 0.03], r: [0.45, 0.5, 0.3], lo: -0.32, cracks: 6, patches: 3 },
  belly: { c: [0, 0.02, 0.0], r: [0.36, 0.44, 0.1] },
  head: { at: [0, 0.52, 0.06], r: [0.29, 0.25, 0.21], eye: [0.7, 0.52, 0.12], size: 0.11 },
  horns: { root: [0.1, 0.03, 0.12], mid: [0.22, 0.0, 0.25], tip: [0.2, -0.19, 0.3], w: 0.055 },
  crest: false,
  legs: { x: 0.3, z: -0.02, ys: [0.26, 0.0, -0.26], fan: [58, 8, -50], upper: 0.2, lower: 0.24, reach: 0.31, thick: 0.08 },
  claws: null,
  cargo: 'basket',
  pack: { at: [0, -0.24, 0.28], w: 0.31, l: 0.25, h: 0.14, tilt: -10 },
  banner: 0,
  gait: { sweep: [0.22, 0.3], duty: [0.6, 0.52], lift: [0.07, 0.09], bob: 0.02, sway: 3 },
  item: 0.2,
  size: 5.4,
};

/** A Relicrawler: longer, long sweeping horns, a wicker crate of brushes and a jar under a sun banner, gold claws, a tablet in the right one. */
const RELICRAWLER_LOOK: Relic = {
  stage: 1,
  high: 0.22,
  shell: { c: [0, -0.1, 0.04], r: [0.52, 0.74, 0.34], lo: -0.32, cracks: 9, patches: 4 },
  belly: { c: [0, -0.02, -0.01], r: [0.42, 0.66, 0.11] },
  head: { at: [0, 0.72, 0.06], r: [0.29, 0.26, 0.2], eye: [0.72, 0.5, 0.12], size: 0.095 },
  horns: { root: [0.12, 0.04, 0.14], mid: [0.33, 0.18, 0.36], tip: [0.17, -0.08, 0.52], w: 0.082 },
  crest: false,
  legs: { x: 0.38, z: -0.03, ys: [0.3, -0.08, -0.44], fan: [56, 4, -52], upper: 0.27, lower: 0.31, reach: 0.4, thick: 0.09 },
  claws: { at: [0.26, 0.74, -0.05], arm: [0.3, 0.32], hand: 0.31, thick: 0.075, rest: { w: [0.3, 1.08, 0.1], pitch: -6, yaw: 18, roll: 10, open: 14 } },
  cargo: 'crate',
  pack: { at: [0, -0.34, 0.33], w: 0.34, l: 0.28, h: 0.13, tilt: -6 },
  banner: 0.22,
  gait: { sweep: [0.3, 0.4], duty: [0.62, 0.52], lift: [0.08, 0.11], bob: 0.025, sway: 2.5 },
  item: 0.14,
  size: 5.6,
};

/** An Aureliax: large, a winged crest with a gem in its brow, a banded relic chest under banners on its back, big claws. */
const AURELIAX_LOOK: Relic = {
  stage: 2,
  high: 0.27,
  shell: { c: [0, -0.14, 0.05], r: [0.66, 0.92, 0.42], lo: -0.32, cracks: 12, patches: 5 },
  belly: { c: [0, -0.04, -0.01], r: [0.54, 0.84, 0.13] },
  head: { at: [0, 0.96, 0.08], r: [0.4, 0.36, 0.27], eye: [0.76, 0.46, 0.08], size: 0.1 },
  horns: null,
  crest: true,
  legs: { x: 0.48, z: -0.04, ys: [0.38, -0.1, -0.58], fan: [56, 4, -52], upper: 0.36, lower: 0.4, reach: 0.52, thick: 0.12 },
  claws: { at: [0.34, 0.94, -0.05], arm: [0.38, 0.4], hand: 0.36, thick: 0.085, rest: { w: [0.5, 1.4, -0.06], pitch: -12, yaw: 12, roll: 12, open: 18 } },
  cargo: 'chest',
  pack: { at: [0, -0.44, 0.41], w: 0.56, l: 0.46, h: 0.27, tilt: -4 },
  banner: 0.3,
  gait: { sweep: [0.38, 0.5], duty: [0.66, 0.54], lift: [0.09, 0.12], bob: 0.03, sway: 2 },
  item: 0.36,
  size: 6.6,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** A frame from its three axes, as columns, at `t`. */
const frame = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A bone at `o` whose length runs along `dir`, its up as near `up` as is square to that. */
function aim(o: V3, dir: V3, up: V3): Xf {
  const Y = unit(dir);
  let Z = sub(up, scale(Y, dot(up, Y)));
  if (len3(Z) < 1e-5) Z = sub([0, 1, 0], scale(Y, Y[1]));
  Z = unit(Z);
  return frame(cross(Y, Z), Y, Z, o);
}
/** A bone at `o` whose length runs along `dir`, lying in the plane square to `normal`. */
function inPlane(o: V3, dir: V3, normal: V3): Xf {
  const Y = unit(dir), Z = unit(cross(normal, Y));
  return frame(cross(Y, Z), Y, Z, o);
}
/** Where the joint between two parts `a` and `b` long goes so the second ends at `goal`: always out on `pole`'s side. */
function kneeOf(root: V3, goal: V3, a: number, b: number, pole: V3): V3 {
  const d = sub(goal, root), L0 = Math.max(1e-6, len3(d)), u = scale(d, 1 / L0);
  const L = clamp(L0, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const along = (a * a - b * b + L * L) / (2 * L), up = Math.sqrt(Math.max(0, a * a - along * along));
  const p = unit(sub(pole, scale(u, dot(pole, u))));
  return add(add(root, scale(u, along)), scale(p, up));
}
/** Each face wound so it faces the way it is meant to, whichever way round it was listed. */
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
/** A flat painted shape from its corners, wound to face along `n`. */
function facing(pts: V3[], n: V3, m: Mat, lit?: boolean): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit };
}
/** A thin painted strip from `a` to `b` on a surface facing `n`: a seam, a groove, a rune's stroke. */
function strip(a: V3, b: V3, n: V3, w: number, m: Mat, lit?: boolean): Disc {
  const d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w);
  return facing([add(a, side), add(b, side), sub(b, side), sub(a, side)], n, m, lit);
}
/** A point on an egg `az` round from its front toward its right and `el` up from its waist, and the way out of it there. */
function eggAt(c: V3, r: V3, az: number, el: number): { p: V3; n: V3 } {
  const p: V3 = [c[0] + r[0] * Math.cos(el) * Math.sin(az), c[1] + r[1] * Math.cos(el) * Math.cos(az), c[2] + r[2] * Math.sin(el)];
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
}
const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/** A mesh put into a frame: each corner taken through it. */
const into = (x: Xf, m: Mesh): Mesh => mesh(m.v.map((p) => place(x, p)), m.f);

/* ---- the shell ------------------------------------------------------------------------- */

/**
 * The shell: the top of an egg, its rings closer at the rim, cut off flat under its waist; the lowest band a gold lip, the rest
 * turquoise; the underside gold-brown.
 */
function domeOf(s: Relic, n: number, k: number): Mesh {
  const { c, r, lo } = s.shell;
  const els = [lo, lo + 0.09, ...Array.from({ length: k }, (_, q) => lerp(lo + 0.09, Math.PI / 2, (q + 1) / (k + 1)))];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], rows: number[] = [];
  for (const el of els) {
    rows.push(v.length);
    for (let j = 0; j < n; j++) v.push(eggAt(c, r, (j / n) * TAU, el).p);
  }
  const top = v.length;
  v.push([c[0], c[1], c[2] + r[2]]);
  const out = (idx: number[]): V3 => {
    const m = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / idx.length);
    return [(m[0] - c[0]) / (r[0] * r[0]), (m[1] - c[1]) / (r[1] * r[1]), (m[2] - c[2]) / (r[2] * r[2])];
  };
  for (let q = 0; q < els.length - 1; q++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [rows[q] + j, rows[q] + j2, rows[q + 1] + j2, rows[q + 1] + j];
      f.push({ i: idx, m: q === 0 ? 'metal' : 'coat' });
      want.push(out(idx));
    }
  }
  const last = rows[rows.length - 1];
  for (let j = 0; j < n; j++) {
    const idx = [last + j, last + ((j + 1) % n), top];
    f.push({ i: idx, m: 'coat' });
    want.push(out(idx));
  }
  f.push({ i: Array.from({ length: n }, (_, j) => rows[0] + j), m: 'belly' });
  want.push([0, 0, -1]);
  return mesh(v, wound(v, f, want));
}

/**
 * Its mending, painted on the shell: a gold seam down the middle between its wing cases, and seams down its sides parting it into
 * plates; gold cracks wandering over the turquoise, branching; cream patches of stone let into it, each edged in gold; and a few
 * plates a shade lighter.
 */
function shellMarks(s: Relic): Mesh {
  const { c, r, lo, cracks, patches } = s.shell, out: Disc[] = [];
  const w = 0.019 * (1 + s.stage * 0.3);
  const lift = (q: { p: V3; n: V3 }, h: number): V3 => add(q.p, scale(q.n, h));
  const line = (pts: Array<[number, number]>, k = 1, taper = 0.35): void => {
    for (let q = 0; q < pts.length - 1; q++) {
      const A = eggAt(c, r, pts[q][0], pts[q][1]), B = eggAt(c, r, pts[q + 1][0], pts[q + 1][1]);
      const ww = w * k * (1 - taper * (q / pts.length));
      out.push(strip(lift(A, 0.012), lift(B, 0.012), unit(add(A.n, B.n)), ww, 'metal'));
      out.push(strip(lift(A, 0.014), lift(B, 0.014), unit(add(A.n, B.n)), ww * 0.45, 'metalLit', true));
    }
    for (let q = 1; q < pts.length - 1; q++) {
      const P = eggAt(c, r, pts[q][0], pts[q][1]), ww = w * k * (1 - taper * (q / pts.length));
      out.push(disc(lift(P, 0.013), P.n, ww * 1.02, ww * 1.02, 6, 'metal'));
    }
  };
  // Plates a shade lighter, under everything else.
  for (let q = 0; q < 4 + s.stage * 2; q++) {
    const az = jitter(q * 7 + 60) * TAU, el = lerp(lo + 0.35, 1.05, jitter(q * 7 + 61)), R = 0.24 + 0.1 * jitter(q + 62);
    const pts: V3[] = [];
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU, rr = R * (0.75 + 0.4 * jitter(q * 11 + j));
      pts.push(lift(eggAt(c, r, az + (Math.cos(a) * rr) / Math.max(0.35, Math.cos(el)), clamp(el + Math.sin(a) * rr * 0.8, lo + 0.12, 1.4)), 0.009));
    }
    out.push(facing(pts, eggAt(c, r, az, el).n, 'coatLight'));
  }
  // Cream patches, each in a gold border, a crack across it.
  for (let q = 0; q < patches; q++) {
    const az = (q / patches) * TAU + 0.5 + 0.7 * jitter(q * 5 + 1), el = lerp(lo + 0.35, 0.95, jitter(q * 5 + 2));
    const R = 0.26 + 0.12 * jitter(q * 5 + 3);
    const ring = (k: number, h: number): V3[] => Array.from({ length: 9 }, (_, j) => {
      const a = (j / 9) * TAU, rr = R * k * (0.72 + 0.4 * jitter(q * 13 + j));
      return lift(eggAt(c, r, az + (Math.cos(a) * rr) / Math.max(0.35, Math.cos(el)), clamp(el + Math.sin(a) * rr * 0.85, lo + 0.1, 1.45)), h);
    });
    const nn = eggAt(c, r, az, el).n;
    out.push(facing(ring(1.0, 0.013), nn, 'metal'), facing(ring(0.82, 0.016), nn, 'stone'));
    const a0 = jitter(q + 30) * Math.PI, cw = Math.max(0.35, Math.cos(el));
    out.push(strip(lift(eggAt(c, r, az - (Math.cos(a0) * R * 0.55) / cw, el - Math.sin(a0) * R * 0.5), 0.018), lift(eggAt(c, r, az + (Math.cos(a0) * R * 0.5) / cw, el + Math.sin(a0) * R * 0.45), 0.018), nn, w * 0.55, 'metal'));
  }
  // The seam down the middle, between its wing cases, from the back of its head to its tail.
  const mid: Array<[number, number]> = [];
  for (let q = 0; q <= 12; q++) {
    const u = q / 12, el = lerp(0.3, Math.PI - lo - 0.04, u);
    mid.push(el <= Math.PI / 2 ? [0, el] : [Math.PI, Math.PI - el]);
  }
  line(mid.map(([az, el], q) => [az + (q % 2 ? 0.03 : -0.03) / Math.max(0.3, Math.cos(el)), el] as [number, number]), 1.3, 0);
  // Seams down either side parting the shell into plates: from its rim up toward the middle seam, wavering.
  for (const sd of [1, -1]) {
    for (const [az0, top] of [[0.95, 0.95], [2.15, 0.9]] as Array<[number, number]>) {
      const pts: Array<[number, number]> = [];
      for (let q = 0; q <= 6; q++) {
        const u = q / 6, el = lerp(lo + 0.06, top, u);
        pts.push([sd * (az0 + 0.1 * Math.sin(u * 7 + az0 * 3) + 0.15 * u * (az0 < 1.5 ? -1 : 1)), el]);
      }
      line(pts, 0.95, 0.2);
    }
  }
  // The cracks: each wandering off from somewhere on the shell, turning as it goes, now and then branching.
  for (let q = 0; q < cracks; q++) {
    let az = (q / cracks) * TAU + 0.8 * jitter(q * 3 + 7), el = lerp(lo + 0.08, 1.1, jitter(q * 3 + 8)), th = jitter(q * 3 + 9) * TAU;
    const pts: Array<[number, number]> = [[az, el]];
    const steps = 3 + Math.floor(jitter(q + 40) * 3);
    for (let e = 0; e < steps; e++) {
      th += (jitter(q * 17 + e) - 0.5) * 1.5;
      const st = 0.14 + 0.06 * jitter(q * 19 + e);
      az += (Math.cos(th) * st) / Math.max(0.3, Math.cos(el));
      el = clamp(el + Math.sin(th) * st, lo + 0.06, 1.42);
      pts.push([az, el]);
      if (e === 1 && jitter(q + 90) > 0.45) {
        const b = th + (jitter(q + 91) > 0.5 ? 1 : -1) * 1.1;
        const bp: Array<[number, number]> = [[az, el]];
        let baz = az, bel = el;
        for (let g = 0; g < 2; g++) {
          baz += (Math.cos(b) * 0.12) / Math.max(0.3, Math.cos(bel));
          bel = clamp(bel + Math.sin(b) * 0.12, lo + 0.06, 1.42);
          bp.push([baz, bel]);
        }
        line(bp, 0.6);
      }
    }
    line(pts, 0.8);
  }
  return paint(out);
}

/** The underside: gold-brown, its rings creased, with the stubs of its legs. */
function bellyOf(s: Relic, n: number, k: number): Mesh {
  const B = s.belly;
  const m = orb(B.c, B.r, n + 2, k, 'belly');
  const out: Disc[] = [];
  for (let q = 0; q < 4; q++) {
    const y = B.c[1] + B.r[1] * lerp(-0.6, 0.55, q / 3);
    const e = onEgg(B.c, B.r, [0, (y - B.c[1]) / B.r[1], -1]);
    out.push(disc(add(e.p, scale(e.n, 0.01)), e.n, B.r[0] * 0.75, 0.012, 8, 'bark'));
  }
  return merge(m, paint(out));
}

/* ---- the head ------------------------------------------------------------------------- */

/**
 * The head: a gold helmet of a head, a turquoise plate over its crown and brow edged in gold, a cream patch on one cheek; a
 * big dark eye either side ringed in gold with a glint in it; little gold mandibles under its face.
 */
function headOf(s: Relic, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, r = H.r, c: V3 = [0, 0, 0];
  const skull = orb(c, r, n + 2, k + 1, 'metal');
  // The turquoise plate over its crown: an egg a little smaller, up and back, so its front edge is a gold brow.
  const plate = orbAlong([0, -r[1] * 0.1, r[2] * 0.22], [0, 0.35, 1], [r[0] * 0.93, r[1] * 0.92, r[2] * 0.82], n + 2, k, 'coat');
  const marks: Disc[] = [];
  // A gold seam down the middle of the plate, and one across it.
  for (let q = 0; q < 4; q++) {
    const a = onEgg([0, -r[1] * 0.1, r[2] * 0.22], [r[0] * 0.93, r[1] * 0.92, r[2] * 0.82], [0, lerp(0.75, -0.6, q / 4), 1]);
    const b = onEgg([0, -r[1] * 0.1, r[2] * 0.22], [r[0] * 0.93, r[1] * 0.92, r[2] * 0.82], [0, lerp(0.75, -0.6, (q + 1) / 4), 1]);
    marks.push(strip(add(a.p, scale(a.n, 0.008)), add(b.p, scale(b.n, 0.008)), a.n, 0.012 + 0.004 * s.stage, 'metalLit', true));
  }
  const ch = onEgg(c, r, [-0.75, 0.45, -0.25]);
  marks.push(disc(add(ch.p, scale(ch.n, 0.012)), ch.n, r[0] * 0.3, r[2] * 0.22, 7, 'metalLit', { lit: true }), disc(add(ch.p, scale(ch.n, 0.016)), ch.n, r[0] * 0.24, r[2] * 0.17, 7, 'stone'));
  // The eyes: a gold ring, then the dark eye with its glints.
  const eyes: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg(c, r, [sd * H.eye[0], H.eye[1], H.eye[2]]), nn = e.n, p = add(e.p, scale(nn, 0.012)), sz = H.size;
    if (shut) {
      eyes.push(disc(p, nn, sz * 1.15, sz * 0.3, 8, 'metalDark', { up: [0, 0, 1] }));
      continue;
    }
    eyes.push(disc(p, nn, sz * 1.3, sz * 1.12, 12, 'metalDark', { up: [0, 0, 1] }));
    eyes.push(disc(add(p, scale(nn, 0.004)), nn, sz, sz * 0.9, 12, 'eye', { up: [0, 0, 1] }));
    eyes.push(disc(add(p, scale(nn, 0.006)), nn, sz * 0.66, sz * 0.6, 10, 'crystalDark', { up: [0, 0, 1] }));
    eyes.push(disc(add(p, scale(nn, 0.008)), nn, sz * 0.42, sz * 0.38, 8, 'eye', { up: [0, 0, 1] }));
    const side = unit(cross([0, 0, 1], nn));
    eyes.push(disc(add(add(add(p, scale(nn, 0.011)), [0, 0, sz * 0.42]), scale(side, sz * 0.3)), nn, sz * 0.34, sz * 0.34, 6, 'glint', { lit: true, up: [0, 0, 1] }));
    eyes.push(disc(add(add(add(p, scale(nn, 0.011)), [0, 0, -sz * 0.4]), scale(side, -sz * 0.32)), nn, sz * 0.13, sz * 0.13, 5, 'glint', { lit: true, up: [0, 0, 1] }));
  }
  // Mandibles: two little gold hooks under the front of its face, curving in.
  const jaws = merge(...[1, -1].map((sd) => tube(curve([sd * r[0] * 0.3, r[1] * 0.7, -r[2] * 0.45], [sd * r[0] * 0.42, r[1] * 1.12, -r[2] * 0.55], [sd * r[0] * 0.08, r[1] * 1.22, -r[2] * 0.6], 3),
    [r[0] * 0.16, r[0] * 0.12, r[0] * 0.08, 0.008], [r[0] * 0.13, r[0] * 0.1, r[0] * 0.07, 0.008], 5, (ring) => (ring >= 2 ? 'metalDark' : 'metal'))));
  return merge(skull, plate, paint(marks), jaws, paint(eyes));
}

/** The horns: two gold horns curving up off the top of its head and back at their tips, a turquoise plate up the front of each. */
function hornsOf(s: Relic, n: number): Mesh {
  const H = s.horns!, w = H.w;
  const one = (): Mesh => {
    const pts = curve(H.root, H.mid, H.tip, 6);
    const ws = pts.map((_, q) => w * (1 - 0.8 * (q / 6) ** 1.3));
    const horn = tube(pts, ws, ws.map((x) => x * 0.85), n, (ring) => (ring >= 5 ? 'metalLit' : 'metal'));
    // A turquoise plate on the front of its lower half, edged by the gold round it, and a ring of gold where it leaves the head.
    const plates: Disc[] = [];
    for (let q = 1; q < 4; q++) {
      const a = pts[q], b = pts[q + 1], d = unit(sub(b, a));
      const fwd = unit(sub([0, 1, 0.2], scale(d, dot([0, 1, 0.2], d))));
      plates.push(strip(add(a, scale(fwd, ws[q] * 0.98)), add(b, scale(fwd, ws[q + 1] * 0.98)), fwd, ws[q] * 0.55, 'coat'));
    }
    return merge(horn, paint(plates), orb(H.root, w * 1.25, 6, 3, 'metalDark'));
  };
  const right = one();
  return merge(right, mirroredMesh(right));
}

/**
 * The Aureliax's crest: a wing of long gold feathers swept up, back and out off either side of its head, the front ones longest,
 * each with a darker rib; three short ones standing up over its brow; and the gem in its brow, turquoise in a gold setting.
 */
function crestOf(s: Relic, n: number): { crest: Mesh; gem: Mesh } {
  const r = s.head.r, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 5; q++) {
      const u = q / 4;
      const root: V3 = [sd * r[0] * (0.42 - 0.08 * u), -r[1] * (0.0 + 0.45 * u), r[2] * (0.72 - 0.3 * u)];
      const L = r[0] * (2.3 - 0.95 * u);
      const dir = unit([sd * (0.55 + 0.3 * u), -(0.12 + 0.6 * u), 1.0 - 0.25 * u]);
      const tip = add(root, scale(dir, L));
      const mid = add(add(root, scale(dir, L * 0.5)), [sd * r[0] * 0.25, r[1] * 0.12, 0]);
      const pts = curve(root, mid, tip, 6);
      const wid = [0.03, 0.14, 0.18, 0.18, 0.15, 0.1, 0.012].map((x) => x * r[0] * (1 - 0.2 * u));
      out.push(blade(pts, wid, unit([sd * 0.7, 0.6 - 0.35 * u, 0.25]), { mat: q % 2 ? 'metalLit' : 'metal', rib: 'metalDark', fold: 0.28, thick: 0.02 }));
    }
  }
  // Three short feathers over the brow, the middle one tallest.
  for (const q of [-1, 0, 1]) {
    const root: V3 = [q * r[0] * 0.2, r[1] * 0.3, r[2] * 0.82];
    const tip = add(root, [q * r[0] * 0.28, -r[1] * 0.3, r[2] * (q ? 0.9 : 1.3)]);
    out.push(blade(curve(root, add(mixV(root, tip, 0.5), [0, r[1] * 0.15, 0]), tip, 4), [0.03, 0.13, 0.13, 0.08, 0.01].map((x) => x * r[0] * 1.6), [0, 1, 0.1], { mat: 'metal', rib: 'metalDark', fold: 0.3, thick: 0.02 }));
  }
  // The gem: a gold setting on its brow and the turquoise stone in it, a glint on it.
  const at = onEgg([0, 0, 0], r, [0, 0.8, 0.45]);
  const g = merge(
    orbAlong(at.p, at.n, [r[0] * 0.34, r[0] * 0.34, r[0] * 0.1], n, 3, 'metalDark'),
    orbAlong(add(at.p, scale(at.n, 0.02)), at.n, [r[0] * 0.26, r[0] * 0.26, r[0] * 0.13], n, 3, 'gem'),
    paint([disc(add(add(at.p, scale(at.n, 0.075)), [r[0] * 0.07, 0, r[0] * 0.08]), at.n, r[0] * 0.08, r[0] * 0.08, 6, 'glint', { lit: true })]),
  );
  return { crest: merge(...out), gem: g };
}

/** Where the crest is hinged on the head, which it is lifted about. */
const crestPivot = (s: Relic): V3 => [0, -s.head.r[1] * 0.2, s.head.r[2] * 0.4];
/** Where the gem is, in the head's frame. */
const gemAt = (s: Relic): V3 => { const e = onEgg([0, 0, 0], s.head.r, [0, 0.8, 0.45]); return add(e.p, scale(e.n, 0.05)); };

/* ---- legs and claws --------------------------------------------------------------------- */

/** A leg's upper part, along `y` from its hip to its knee: gold, with a turquoise plate over its top edged in gold, a cream fleck on the bigger ones'. */
function upperOf(s: Relic): Mesh {
  const L = s.legs.upper, w = s.legs.thick;
  const bone = tube([[0, -w, 0], [0, L * 0.5, 0], [0, L + w * 0.2, 0]], [w * 0.9, w, w * 0.85], [w * 0.9, w, w * 0.85], 6, 'metal', { seam: 'start' });
  const plate = orbAlong([0, L * 0.5, w * 0.35], [0, 1, 0], [w * 1.15, w * 0.85, L * 0.46], 7, 3, 'coat');
  const marks: Disc[] = [];
  const e = onEgg([0, L * 0.5, w * 0.35], [w * 1.15, L * 0.46, w * 0.85], [0.2, 0.3, 1]);
  marks.push(strip(add(e.p, [0, -L * 0.18, 0.01]), add(e.p, [0, L * 0.2, 0.012]), e.n, w * 0.12, 'metalLit', true));
  if (s.stage > 0) marks.push(disc(add(onEgg([0, L * 0.5, w * 0.35], [w * 1.15, L * 0.46, w * 0.85], [0.6, -0.4, 0.8]).p, [0, 0, 0.012]), [0.4, -0.2, 1], w * 0.32, w * 0.26, 6, 'stone'));
  return merge(bone, plate, paint(marks), orb([0, L, 0], w * 0.95, 6, 3, 'metalDark'));
}
/** A leg's lower part, from the knee along `y` to the tip of its foot: gold, a turquoise plate on its upper half, a dark tip. */
function lowerOf(s: Relic): Mesh {
  const L = s.legs.lower, w = s.legs.thick * 0.85;
  const shin = tube([[0, -w * 0.3, 0], [0, L * 0.3, w * 0.35], [0, L * 0.62, w * 0.25], [0, L * 0.86, 0.02], [0, L - 0.01, 0.006]],
    [w * 0.9, w, w * 0.8, w * 0.42, 0.008], [w * 0.9, w, w * 0.8, w * 0.42, 0.008], 6, (ring) => (ring >= 3 ? 'claw' : 'metal'));
  const plate = orbAlong([0, L * 0.34, w * 0.75], [0, 1, 0.12], [w * 0.95, w * 0.6, L * 0.26], 7, 3, 'coat');
  return merge(shin, plate);
}

/** Where on a hand its fixed finger's tip is, in the hand's frame. */
const tipOf = (h: number): V3 => [0, h * 1.32, -h * 0.04];
/** Where on a hand the movable finger is hinged. */
const hingeOf = (h: number): V3 => [0, h * 0.62, h * 0.2];

/** A hand, along `y` from the wrist with its movable finger on top: a gold palm with a turquoise plate on it seamed in gold, the fixed finger curving to a dark tip. */
function handOf(s: Relic, h: number, n: number, k: number): Mesh {
  const c: V3 = [0, h * 0.38, 0], r: V3 = [h * 0.24, h * 0.42, h * 0.34];
  const palm = orbAlong(c, [0, 1, 0], [r[0], r[2], r[1]], n, k, 'metal');
  const plate = orbAlong(add(c, [0, -h * 0.02, h * 0.12]), [0, 1, 0.15], [r[0] * 0.92, r[2] * 0.72, r[1] * 0.86], n, k, 'coat');
  const finger = tube([[0, h * 0.6, -h * 0.16], [0, h * 0.86, -h * 0.22], [0, h * 1.1, -h * 0.18], [0, h * 1.24, -h * 0.1], tipOf(h)],
    [h * 0.16, h * 0.13, h * 0.09, h * 0.05, h * 0.012], [h * 0.18, h * 0.14, h * 0.09, h * 0.05, h * 0.012], 6, (ring) => (ring >= 3 ? 'claw' : 'metal'));
  const seamA = onEgg(add(c, [0, -h * 0.02, h * 0.12]), [r[0] * 0.92, r[1] * 0.86, r[2] * 0.72], [0.1, -0.6, 1]);
  const seamB = onEgg(add(c, [0, -h * 0.02, h * 0.12]), [r[0] * 0.92, r[1] * 0.86, r[2] * 0.72], [-0.2, 0.5, 1]);
  const marks = paint([
    strip(add(seamA.p, scale(seamA.n, 0.01)), add(seamB.p, scale(seamB.n, 0.01)), unit(add(seamA.n, seamB.n)), h * 0.035, 'metalLit', true),
    ...(s.stage === 2 ? [disc(add(onEgg(c, r, [1, -0.3, -0.3]).p, [0.012, 0, 0]), [1, 0, 0], h * 0.12, h * 0.09, 6, 'stone')] : []),
  ]);
  const wrist = tube([[0, -h * 0.08, 0], [0, h * 0.1, 0]], h * 0.15, h * 0.17, 6, 'metalDark');
  return merge(wrist, palm, plate, marks, finger);
}
/** The movable finger, from its hinge along `y`: gold, curving down to a dark tip that meets the fixed one shut. */
function nipOf(h: number): Mesh {
  return tube([[0, -h * 0.05, 0], [0, h * 0.28, h * 0.04], [0, h * 0.52, -h * 0.07], [0, h * 0.72, -h * 0.26]], [h * 0.14, h * 0.12, h * 0.07, h * 0.012], [h * 0.16, h * 0.12, h * 0.07, h * 0.012], 6,
    (ring) => (ring >= 2 ? 'claw' : 'metal'));
}

/* ---- what it carries ---------------------------------------------------------------------- */

/**
 * A slab of stone from its outline across it (x) and up it (z), `t` thick along y: a rune stone, a tablet, a fragment. Its
 * faces cream, its edges a shade darker.
 */
function slabOf(outline: Array<[number, number]>, t: number, m: Mat = 'stone', edge: Mat = 'stoneDark'): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], n = outline.length;
  for (const [x, z] of outline) v.push([x, t / 2, z]);
  for (const [x, z] of outline) v.push([x, -t / 2, z]);
  f.push({ i: Array.from({ length: n }, (_, j) => j), m });
  want.push([0, 1, 0]);
  f.push({ i: Array.from({ length: n }, (_, j) => n + j), m });
  want.push([0, -1, 0]);
  const cx = outline.reduce((a, p) => a + p[0], 0) / n, cz = outline.reduce((a, p) => a + p[1], 0) / n;
  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    f.push({ i: [j, j2, n + j2, n + j], m: edge });
    const mx = (outline[j][0] + outline[j2][0]) / 2 - cx, mz = (outline[j][1] + outline[j2][1]) / 2 - cz;
    want.push([mx, 0, mz]);
  }
  return mesh(v, wound(v, f, want));
}
/** A tablet's outline: a rounded top over straight sides, `w` half-wide and `h` tall from its foot. */
function tabletOutline(w: number, h: number, chip = 0): Array<[number, number]> {
  const out: Array<[number, number]> = [[-w, 0], [w, 0], [w, h - w * 0.7]];
  for (let q = 1; q < 6; q++) {
    const a = (q / 6) * Math.PI;
    out.push([w * Math.cos(a), h - w * 0.7 + w * 0.7 * Math.sin(a) * (q === 2 && chip ? 1 - chip : 1)]);
  }
  out.push([-w, h - w * 0.7]);
  return out;
}
/** Runes cut into a face of a slab facing `+y` at `y`, in rows across it: short strokes and ticks, dark. */
function runes(w: number, h: number, y: number, rows: number, seed: number, m: Mat = 'stoneDark', k = 1): Disc[] {
  const out: Disc[] = [], n: V3 = [0, 1, 0], th = w * 0.07 * k;
  for (let row = 0; row < rows; row++) {
    const z = h * (0.22 + (0.56 * (row + 0.5)) / rows);
    for (let q = 0; q < 2; q++) {
      const x = w * (q ? 0.32 : -0.32), id = seed + row * 5 + q, a = jitter(id) * TAU, L = h * 0.09 * (0.7 + 0.5 * jitter(id + 1));
      const c: V3 = [x, y, z];
      out.push(strip(add(c, [-Math.cos(a) * L, 0, -Math.sin(a) * L]), add(c, [Math.cos(a) * L, 0, Math.sin(a) * L]), n, th, m));
      out.push(strip(c, add(c, [Math.cos(a + 1.9) * L, 0, Math.sin(a + 1.9) * L]), n, th, m));
    }
  }
  return out;
}
/** A rune stone: a tablet with runes on both faces, its foot at the origin, standing up `z`, its faces along `y`. */
function runeStone(w: number, h: number, t: number, seed: number): Mesh {
  const out = tabletOutline(w, h, 0.25);
  return merge(slabOf(out, t), paint(runes(w, h, t / 2 + 0.004, 2, seed)), paint(runes(w, h, -t / 2 - 0.004, 2, seed + 50).map((d) => ({ ...d, v: [...d.v].reverse() }))));
}

/** A wicker weave over a surface, given a way to a point on it (`u` round, `v` up, each nought to one) and the way out there. */
function weave(at: (u: number, v: number) => { p: V3; n: V3 }, cols: number, rows: number, w: number): Disc[] {
  const out: Disc[] = [];
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = at(c / cols, r / rows), b = at((c + 1) / cols, r / rows);
      out.push(strip(add(a.p, scale(a.n, 0.006)), add(b.p, scale(b.n, 0.006)), a.n, w * 0.5, 'woodDark'));
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if ((r + c) % 2) continue;
      const a = at((c + 0.5) / cols, r / rows), b = at((c + 0.5) / cols, (r + 1) / rows);
      out.push(strip(add(a.p, scale(a.n, 0.007)), add(b.p, scale(b.n, 0.007)), a.n, w * 0.35, 'bark'));
    }
  }
  return out;
}

/** What it carries, as the thing itself and what is in it: each a piece of its own, so what is in it goes over the weave. */
interface Load { box: Mesh; load: Mesh }

/** The Kintsu's basket: round, wicker, open at the top, a thick rim; two rune stones standing in it and turquoise pebbles round them. */
function basketOf(s: Relic, n: number): Load {
  const P = s.pack, prof: Array<[number, number]> = [[0, 0.76], [0.35, 0.92], [0.75, 1], [1, 1.03]];
  const pts = prof.map(([z]) => [0, 0, z * P.h] as V3);
  const body = tube(pts, prof.map(([, k]) => P.w * k), prof.map(([, k]) => P.l * k), n + 4, 'wood', { up: [0, 1, 0], end: false });
  // What it holds, heaped dark inside the rim.
  const fill = tube([[0, 0, P.h * 0.9], [0, 0, P.h * 0.94]], [P.w * 0.98, P.w * 0.6], [P.l * 0.98, P.l * 0.6], n + 4, 'woodDark', { up: [0, 1, 0], start: false });
  const rimPts = Array.from({ length: 19 }, (_, q) => { const a = (q / 18) * TAU; return [Math.sin(a) * P.w * 1.04, Math.cos(a) * P.l * 1.04, P.h] as V3; });
  const rim = tube(rimPts, 0.034, 0.03, 5, 'bark');
  const at = (u: number, v: number): { p: V3; n: V3 } => {
    const a = u * TAU, k = lerp(0.76, 1.03, smooth(v));
    return { p: [Math.sin(a) * P.w * k, Math.cos(a) * P.l * k, v * P.h], n: unit([Math.sin(a) / P.w, Math.cos(a) / P.l, -0.15]) };
  };
  const wv = paint(weave(at, 18, 4, 0.034));
  // Two rune stones standing in it, leant apart, and pebbles round them.
  const stones = merge(
    into(joint(ROOT, [-P.w * 0.34, -P.l * 0.05, P.h * 0.45], -8, -16, 22), runeStone(P.w * 0.36, P.h * 2.3, 0.07, 3)),
    into(joint(ROOT, [P.w * 0.36, P.l * 0.18, P.h * 0.45], 8, 18, -26), runeStone(P.w * 0.32, P.h * 1.9, 0.07, 11)),
  );
  const pebbles: Mesh[] = [];
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * TAU + 0.4, rr = 0.6 + 0.25 * jitter(q);
    pebbles.push(orb([Math.sin(a) * P.w * rr * 0.75, Math.cos(a) * P.l * rr * 0.75, P.h * (0.98 + 0.12 * jitter(q + 3))], [0.065 + 0.02 * jitter(q + 5), 0.06, 0.045], 6, 3, q === 2 ? 'stone' : q % 2 ? 'coatLight' : 'crystal'));
  }
  return { box: merge(body, wv, fill, rim), load: merge(stones, ...pebbles) };
}

/** A brush: a wooden handle with a gold ferrule and a tuft of bristles, standing up along `z` from its foot. */
function brushOf(L: number, w: number, n: number): Mesh {
  return merge(
    tube([[0, 0, 0], [0, 0, L * 0.62]], w, w, n, 'wood'),
    tube([[0, 0, L * 0.62], [0, 0, L * 0.74]], w * 1.3, w * 1.3, n, 'metal'),
    tube([[0, 0, L * 0.74], [0, 0, L * 0.88], [0, 0, L]], [w * 1.25, w * 1.35, w * 0.3], [w * 1.25, w * 1.35, w * 0.3], n, 'bark'),
  );
}

/** A jar: a cream glazed pot with a brown band and a stopper, standing along `z` from its foot. */
function jarOf(h: number, n: number): Mesh {
  const prof: Array<[number, number]> = [[0, 0.55], [0.2, 0.95], [0.5, 1], [0.78, 0.75], [0.88, 0.5], [1, 0.55]];
  const r = h * 0.45;
  return merge(
    tube(prof.map(([z]) => [0, 0, z * h] as V3), prof.map(([, k]) => k * r), prof.map(([, k]) => k * r), n, (ring) => (ring === 2 ? 'shellDark' : 'shell')),
    tube([[0, 0, h * 0.98], [0, 0, h * 1.14]], r * 0.45, r * 0.45, n, 'cap'),
  );
}

/** The Relicrawler's crate: square, wicker, a rim of thicker withy, dark inside; brushes, a jar and a tablet standing up in it. */
function crateOf(s: Relic, n: number): Load {
  const P = s.pack, W = P.w, L = P.l, H = P.h;
  const v: V3[] = [[-W, -L, 0], [W, -L, 0], [W, L, 0], [-W, L, 0], [-W * 1.06, -L * 1.06, H], [W * 1.06, -L * 1.06, H], [W * 1.06, L * 1.06, H], [-W * 1.06, L * 1.06, H]];
  const f: Face[] = [], want: V3[] = [];
  const quad = (i: number[], m: Mat, w: V3): void => { f.push({ i, m }); want.push(w); };
  quad([0, 1, 2, 3], 'wood', [0, 0, -1]);
  quad([0, 1, 5, 4], 'wood', [0, -1, 0]);
  quad([1, 2, 6, 5], 'wood', [1, 0, 0]);
  quad([2, 3, 7, 6], 'wood', [0, 1, 0]);
  quad([3, 0, 4, 7], 'wood', [-1, 0, 0]);
  // Its top: the dark of what is packed in it, a little in from the rim.
  quad([4, 5, 6, 7], 'woodDark', [0, 0, 1]);
  const box = mesh(v, wound(v, f, want));
  // The weave down each side, and thick withies at its corners and round its rim.
  const sides: Array<[V3, V3, V3]> = [[[-W, -L, 0], [W, -L, 0], [0, -1, 0]], [[W, -L, 0], [W, L, 0], [1, 0, 0]], [[W, L, 0], [-W, L, 0], [0, 1, 0]], [[-W, L, 0], [-W, -L, 0], [-1, 0, 0]]];
  const wv: Disc[] = [];
  for (const [a, b, nn] of sides) {
    const at = (u: number, vv: number): { p: V3; n: V3 } => {
      const k = 1 + 0.06 * vv, p = mixV(a, b, u);
      return { p: [p[0] * k, p[1] * k, vv * H], n: nn };
    };
    wv.push(...weave(at, 7, 4, 0.034));
  }
  const rim = tube([...v.slice(4), v[4]].map((p) => add(p, [0, 0, 0.012])), 0.036, 0.036, 5, 'bark');
  const posts = merge(...[0, 1, 2, 3].map((q) => tube([add(v[q], [0, 0, 0.02]), v[q + 4]], 0.032, 0.032, 5, 'bark')));
  // What stands in it: three brushes at the back, a jar at the front right, a tablet at the front left, a turquoise pebble.
  const load = merge(
    into(joint(ROOT, [-W * 0.5, -L * 0.5, H * 0.5], -10, -10, 0), brushOf(H * 2.6, 0.028, 5)),
    into(joint(ROOT, [-W * 0.18, -L * 0.6, H * 0.5], -14, 4, 0), brushOf(H * 2.9, 0.032, 5)),
    into(joint(ROOT, [W * 0.15, -L * 0.55, H * 0.5], -8, 12, 0), brushOf(H * 2.3, 0.026, 5)),
    into(joint(ROOT, [W * 0.48, L * 0.3, H * 0.6], 0, 0, 0), jarOf(H * 1.7, n)),
    into(joint(ROOT, [-W * 0.42, L * 0.38, H * 0.6], 8, -6, 10), runeStone(W * 0.34, H * 2.2, 0.06, 23)),
    orb([W * 0.05, L * 0.45, H * 1.04], [0.06, 0.055, 0.04], 6, 3, 'crystal'),
  );
  return { box: merge(box, paint(wv), rim, posts), load };
}

/** The Aureliax's chest: a wooden box with its lower edges rounded, bound in gold bands, a gold rim and gold corners; tablets stacked up out of it and gold among them. */
function chestOf(s: Relic, n: number): Load {
  const P = s.pack, W = P.w, L = P.l, H = P.h, rr = H * 0.22;
  // Its outline across it in (x, z), square with its lower corners rounded, run along it from back to front.
  const prof: Array<[number, number]> = [[-W, H], [-W, rr], [-W + rr * 0.3, rr * 0.3], [-W + rr, 0], [W - rr, 0], [W - rr * 0.3, rr * 0.3], [W, rr], [W, H]];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], m = prof.length;
  for (const y of [-L, L]) for (const [x, z] of prof) v.push([x, y, z]);
  for (let j = 0; j < m; j++) {
    const j2 = (j + 1) % m, top = j === m - 1;
    f.push({ i: [j, j2, m + j2, m + j], m: top ? 'woodDark' : 'wood' });
    want.push(top ? [0, 0, 1] : [(prof[j][0] + prof[j2][0]) / 2, 0, (prof[j][1] + prof[j2][1]) / 2 - H * 0.5]);
  }
  f.push({ i: Array.from({ length: m }, (_, j) => j), m: 'wood' });
  want.push([0, -1, 0]);
  f.push({ i: Array.from({ length: m }, (_, j) => m + j), m: 'wood' });
  want.push([0, 1, 0]);
  const box = mesh(v, wound(v, f, want));
  // Gold bands round it, front and back of its middle; a gold rim round its top; gold corner posts.
  const band = (y: number): Mesh => tube([...prof, prof[0]].map(([x, z]) => [x * 1.05 + Math.sign(x) * 0.004, y, z === H ? H + 0.012 : Math.max(-0.012, z - 0.012)] as V3), 0.04, 0.024, 4, 'metal', { up: [0, 1, 0] });
  const parts: Mesh[] = [band(-L * 0.5), band(L * 0.5)];
  parts.push(tube([[-W * 1.04, -L * 1.04, H], [W * 1.04, -L * 1.04, H], [W * 1.04, L * 1.04, H], [-W * 1.04, L * 1.04, H], [-W * 1.04, -L * 1.04, H]], 0.045, 0.04, 5, 'metal'));
  for (const sx of [1, -1]) for (const sy of [1, -1]) parts.push(tube([[sx * W * 1.03, sy * L * 1.03, rr], [sx * W * 1.03, sy * L * 1.03, H]], 0.04, 0.04, 5, 'metalDark'));
  const marks: Disc[] = [];
  // Studs on the bands, planks along it, and a gold plate with a keyhole on its back.
  for (const sd of [1, -1]) for (const y of [-L * 0.5, L * 0.5]) for (const z of [H * 0.35, H * 0.72]) marks.push(disc([sd * (W * 1.05 + 0.03), y, z], [sd, 0, 0], 0.024, 0.02, 6, 'metalLit', { lit: true }));
  for (const sd of [1, -1]) for (const z of [H * 0.4, H * 0.72]) marks.push(strip([sd * (W + 0.006), -L * 0.97, z], [sd * (W + 0.006), L * 0.97, z], [sd, 0, 0], 0.008, 'woodDark'));
  marks.push(disc([0, -L - 0.008, H * 0.52], [0, -1, 0], W * 0.2, H * 0.24, 8, 'metal'), disc([0, -L - 0.014, H * 0.52], [0, -1, 0], W * 0.05, H * 0.1, 6, 'inner'));
  // Tablets standing up out of it, gold and a turquoise stone among them.
  const load = merge(
    into(joint(ROOT, [-W * 0.42, -L * 0.25, H * 0.55], -6, -10, 8), runeStone(W * 0.3, H * 1.9, 0.075, 31)),
    into(joint(ROOT, [W * 0.02, -L * 0.45, H * 0.55], -12, 4, -4), runeStone(W * 0.36, H * 2.3, 0.085, 37)),
    into(joint(ROOT, [W * 0.46, -L * 0.1, H * 0.55], 4, 14, -16), runeStone(W * 0.26, H * 1.6, 0.065, 43)),
    // Gold heaped in it, round the tablets.
    orb([0, L * 0.1, H * 0.98], [W * 0.9, L * 0.85, 0.06], 9, 3, 'metal'),
    orb([W * 0.25, L * 0.4, H * 1.03], [0.11, 0.09, 0.06], 7, 3, 'bloom'),
    orb([-W * 0.3, L * 0.45, H * 1.03], [0.09, 0.08, 0.055], 6, 3, 'crystal'),
    orb([W * 0.6, L * 0.6, H * 1.04], [0.07, 0.065, 0.05], 6, 3, 'bloom'),
    orb([-W * 0.6, L * 0.05, H * 1.03], [0.07, 0.06, 0.05], 6, 3, 'stone'),
  );
  return { box: merge(box, ...parts, paint(marks)), load };
}

/** A banner: cream cloth hanging from its top edge along `y` down `-z`, `L` long, a gold sun on it (a ring, a dot and eight rays), its foot cut in two tails. */
function bannerOf(w: number, L: number): Mesh {
  const rows = 4, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const pt = (u: number, k: number, back: boolean): V3 => {
    const y = lerp(-w, w, u), z = -L * k + (k === 1 && Math.abs(u - 0.5) < 0.01 ? L * 0.14 : 0);
    // A gentle fold across it.
    const x = 0.012 * Math.sin(u * Math.PI * 3) * k + (back ? -0.008 : 0);
    return [x, y, z];
  };
  const cols = 6;
  for (const back of [false, true]) for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) v.push(pt(c / cols, r / rows, back));
  const id = (back: boolean, r: number, c: number): number => (back ? (rows + 1) * (cols + 1) : 0) + r * (cols + 1) + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    f.push({ i: [id(false, r, c), id(false, r, c + 1), id(false, r + 1, c + 1), id(false, r + 1, c)], m: 'cloth' });
    want.push([1, 0, 0]);
    f.push({ i: [id(true, r, c), id(true, r, c + 1), id(true, r + 1, c + 1), id(true, r + 1, c)], m: 'clothDark' });
    want.push([-1, 0, 0]);
  }
  const cloth = mesh(v, wound(v, f, want));
  // The sun, gold, on its outer face.
  const sun: Disc[] = [], c: V3 = [0.016, 0, -L * 0.45], n: V3 = [1, 0, 0], R = w * 0.5;
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU;
    sun.push(strip(add(c, [0, Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75]), add(c, [0, Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25]), n, R * 0.09, 'metal'));
  }
  sun.push(disc(c, n, R * 0.72, R * 0.72, 12, 'metal', { up: [0, 0, 1] }), disc(add(c, [0.003, 0, 0]), n, R * 0.5, R * 0.5, 12, 'cloth', { up: [0, 0, 1] }), disc(add(c, [0.006, 0, 0]), n, R * 0.24, R * 0.24, 8, 'metal', { up: [0, 0, 1] }));
  // A gold hem along its foot.
  sun.push(strip([0.014, -w * 0.95, -L * 0.82], [0.014, w * 0.95, -L * 0.82], n, 0.012, 'metal'));
  // And a gold bar it hangs from.
  return merge(cloth, paint(sun), tube([[0.01, -w * 1.1, 0.01], [0.01, w * 1.1, 0.01]], 0.022, 0.022, 5, 'metal'));
}

/* ---- the relics it mends ----------------------------------------------------------------- */

/** The cracked tablet the two smaller ones mend: a tablet lying on its back (`z` up its face), a crack across it, and the crack again in gold, shown as it fills. */
function crackedTablet(s: Relic, gold: boolean): Mesh {
  const h = s.item, w = h * 0.62, t = h * 0.22;
  const slab = into(joint(ROOT, [0, h * 0.5, t * 0.5], 90, 0, 0), merge(slabOf(tabletOutline(w, h), t), paint(runes(w, h, t / 2 + 0.004, 2, 71, 'stoneDark', 1.4))));
  // The crack, a zigzag across its face: dark, or gold.
  const pts: V3[] = [[-w * 1.0, -h * 0.05, t + 0.006], [-w * 0.45, h * 0.08, t + 0.006], [-w * 0.1, -h * 0.1, t + 0.006], [w * 0.35, h * 0.12, t + 0.006], [w * 1.0, -h * 0.02, t + 0.006]];
  const crack: Disc[] = [];
  for (let q = 0; q < pts.length - 1; q++) crack.push(strip(pts[q], pts[q + 1], [0, 0, 1], h * (gold ? 0.045 : 0.03), gold ? 'metalLit' : 'eye', gold));
  return merge(slab, paint(crack));
}

/** The tablet the Relicrawler carries in its right claw: upright along `z`, its face along `+y`, a crack down it in gold that the gold fills. */
function heldTablet(s: Relic, gold: boolean): Mesh {
  const h = s.item * 2.2, w = h * 0.42, t = h * 0.1;
  const base = merge(slabOf(tabletOutline(w, h, 0.3), t), paint(runes(w, h, t / 2 + 0.004, 3, 81, 'stoneDark', 1.2)));
  const pts: V3[] = [[w * 0.1, t / 2 + 0.008, h * 0.98], [-w * 0.2, t / 2 + 0.008, h * 0.72], [w * 0.15, t / 2 + 0.008, h * 0.5], [-w * 0.1, t / 2 + 0.008, h * 0.26], [w * 0.2, t / 2 + 0.008, 0.01]];
  const crack: Disc[] = [];
  for (let q = 0; q < pts.length - 1; q++) crack.push(strip(pts[q], pts[q + 1], [0, 1, 0], h * (gold ? 0.03 : 0.018), gold ? 'metalLit' : 'eye', gold));
  // Centred on its middle, so a claw holds it there.
  return into(joint(ROOT, [0, 0, -h * 0.5], 0, 0, 0), merge(base, paint(crack)));
}

/**
 * The Aureliax's statue head, in three pieces that float apart and come together: the crown of the head, curled; the face (brow,
 * eyes, nose and lips); and the jaw and neck. Each a lump of cream stone, its broken faces darker, a gold seam along each break.
 */
function statuePieces(s: Relic): Mesh[] {
  const h = s.item, n = 6;
  const seam = (z: number, k: number): Disc[] => Array.from({ length: 10 }, (_, q) => {
    const a0 = (q / 10) * TAU, a1 = ((q + 1) / 10) * TAU, rx = h * 0.5 * k, ry = h * 0.48 * k;
    return strip([Math.sin(a0) * rx, Math.cos(a0) * ry + h * 0.04, z + 0.015 * Math.sin(a0 * 3)], [Math.sin(a1) * rx, Math.cos(a1) * ry + h * 0.04, z + 0.015 * Math.sin(a1 * 3)], unit([Math.sin(a0), Math.cos(a0), 0]), h * 0.035, 'metal');
  });
  const crown = merge(
    orb([0, -h * 0.06, h * 0.34], [h * 0.52, h * 0.56, h * 0.34], n, 2, 'stone'),
    // Curls of hair over it.
    ...[-1, 0, 1].map((q) => orb([q * h * 0.28, h * 0.12 - Math.abs(q) * h * 0.08, h * 0.52], [h * 0.16, h * 0.16, h * 0.1], 6, 3, 'stone')),
    paint([disc([0, -h * 0.04, h * 0.06], [0, 0, -1], h * 0.44, h * 0.48, 8, 'stoneDark'), ...seam(h * 0.16, 1.02)]),
  );
  const face = merge(
    orb([0, h * 0.08, 0], [h * 0.48, h * 0.42, h * 0.26], n, 2, 'stone'),
    tube([[0, h * 0.42, h * 0.1], [0, h * 0.56, -h * 0.08], [0, h * 0.5, -h * 0.12]], [h * 0.07, h * 0.1, h * 0.06], [h * 0.06, h * 0.09, h * 0.05], 5, 'stone'),
    paint([
      ...[1, -1].map((sd) => disc([sd * h * 0.2, h * 0.44, h * 0.05], [sd * 0.3, 1, 0.1], h * 0.1, h * 0.05, 7, 'stoneDark')),
      ...[1, -1].map((sd) => strip([sd * h * 0.06, h * 0.47, h * 0.15], [sd * h * 0.34, h * 0.38, h * 0.17], [0, 1, 0.2], h * 0.028, 'stoneDark')),
      strip([-h * 0.14, h * 0.47, -h * 0.17], [h * 0.14, h * 0.47, -h * 0.17], [0, 1, 0], h * 0.022, 'stoneDark'),
    ]),
  );
  const jaw = merge(
    orb([0, h * 0.06, -h * 0.3], [h * 0.4, h * 0.36, h * 0.2], n, 2, 'stone'),
    tube([[0, -h * 0.04, -h * 0.34], [0, -h * 0.08, -h * 0.74]], [h * 0.27, h * 0.25], [h * 0.27, h * 0.25], 6, 'stone'),
    paint([disc([0, -h * 0.08, -h * 0.75], [0, 0, -1], h * 0.24, h * 0.22, 7, 'stoneDark'), ...seam(-h * 0.2, 0.98)]),
  );
  // Its heights drawn a little short, as every upright thing here is, so a head reads round.
  return [crown, face, jaw].map((m) => mesh(m.v.map((v) => [v[0], v[1], v[2] * 0.75] as V3), m.f));
}
/** Where each statue piece floats apart from the whole head, as it hovers by the claw, in the item's sizes. */
const STATUE_APART: V3[] = [[-0.55, 0.15, 0.75], [0.6, 0.5, 0.15], [-0.2, 0.25, -0.75]];

/* ---- its moves, in time ------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it: the Kintsu's butt, the Relicrawler's pinch, the Aureliax's crush. */
export const RELIC_HITS: readonly number[] = [0.5, 0.56, 0.6];
/** When it is gathered for the blow, as a share of the strike. */
export const RELIC_STRIKE = { gather: 0.36 } as const;
/**
 * A go at its task, as shares of it: its taps at the crack (the Kintsu's), the strokes of its claw along it (the Relicrawler's),
 * when the gold has filled it, the flash, and when the mended thing goes up into what it carries and is gone; the Aureliax's
 * pieces drawn in from `gather` and together at `join`. It loops, so a go and the next are one.
 */
export const RELIC_WORK = { taps: [0.16, 0.28, 0.4] as const, strokes: [0.2, 0.36] as const, gather: 0.12, join: 0.48, flash: 0.55, toss: 0.7, gone: 0.86 } as const;
/** When it looks itself over, standing about, in seconds into its loop. */
export const RELIC_LOOKS: readonly number[] = [4.6, 15.2];

/* ---- its pose ------------------------------------------------------------------------------- */

/** A claw's pose: where its wrist is (body frame), how its hand is turned, how far open. */
interface Claw { w: V3; pitch: number; yaw: number; roll: number; open: number }
const mixClaw = (a: Claw, b: Claw, t: number): Claw => ({
  w: mixV(a.w, b.w, t), pitch: lerp(a.pitch, b.pitch, t), yaw: lerp(a.yaw, b.yaw, t), roll: lerp(a.roll, b.roll, t), open: lerp(a.open, b.open, t),
});
/** A claw at rest, on its side (`sd` one the right). */
function restClaw(s: Relic, sd: number): Claw {
  const R = s.claws!.rest;
  return { w: [sd * R.w[0], R.w[1], R.w[2]], pitch: R.pitch, yaw: sd * R.yaw, roll: sd * R.roll, open: R.open };
}
/** A claw at `w` (right side's), turned so, on its side. */
const clawAt = (sd: number, w: V3, pitch: number, yaw: number, roll: number, open: number): Claw => ({ w: [sd * w[0], w[1], w[2]], pitch, yaw: sd * yaw, roll: sd * roll, open });

interface Pose {
  /** The body over the ground: along, up, and its turns (degrees). */
  y: number; z: number; pitch: number; roll: number; yaw: number;
  /** The head's own turns on the body: pitch, yaw, roll. */
  head: [number, number, number];
  /** The cargo's rock on its back: pitch and roll. */
  pack: [number, number];
  claws: [Claw, Claw] | null;
  /** The crest spread, nought at rest. */
  crest: number;
  /** How far forward the front feet are put, for a lunge, in leg lengths. */
  reach: number;
}

/** The standing pose: breathing, looking about, now and then looking itself over; the Relicrawler peering at its tablet. */
function standPose(s: Relic, a: Anim): Pose {
  const t = a.t, still = 1 - a.go;
  const look = beat(t, RELIC_LOOKS as number[], 1.6) * still;
  const p: Pose = {
    y: 0, z: s.high + 0.008 * cyc(t, 6) + 0.006 * (a.breath - 0.5), pitch: 0.8 * cyc(t, 6, 1), roll: 0.6 * cyc(t, 3), yaw: 4 * drift(t) * still,
    head: [4 * cyc(t, 5) * still - 14 * look, 18 * drift(t, 1.3) * still * (1 - look) + 26 * look * Math.sin((t - RELIC_LOOKS[0]) * 2.4), 5 * drift(t, 2) * still],
    pack: [0.8 * cyc(t, 6, 0.6), 0.6 * cyc(t, 3, 1.2)],
    claws: s.claws ? [restClaw(s, -1), restClaw(s, 1)] : null,
    crest: 0.08 * (0.5 + 0.5 * cyc(t, 4)),
    reach: 0,
  };
  if (p.claws) {
    // Now and then it lifts its tablet (or its claw, by the floating pieces) up before its face and turns it over.
    const lift = beat(t, [9.6, 20.4], 2.2) * still;
    const up = s.stage === 1 ? clawAt(1, [0.22, 0.98, 0.18], 10, -36, 30, 14) : clawAt(1, [0.42, 1.28, 0.26], 6, -20, 18, 26);
    p.claws[1] = mixClaw(p.claws[1], { ...up, roll: up.roll + 14 * Math.sin((t - 9.6) * 3) * lift }, lift);
    p.head[0] -= 10 * lift;
    p.head[1] -= 8 * lift;
    p.claws[0] = { ...p.claws[0], open: p.claws[0].open + 16 * beat(t, [3.2, 13.1, 18.2], 0.6) * still };
  }
  return p;
}

/** Going: bobbing a little at each set of three coming down, rolling over them, the cargo rocking after; claws held in, the head forward. */
function goPose(s: Relic, p: Pose, a: Anim): void {
  const g = smooth(a.go), G = s.gait, w = frac(a.u), run = a.gait;
  if (g <= 0) return;
  p.z -= g * (G.bob * (0.5 + 0.5 * Math.cos(TAU * 2 * w - 0.6)) * (1 + 0.3 * run) + 0.02 * run);
  p.pitch += g * (-1.5 * run + 1 * Math.sin(TAU * 2 * w - 1.2));
  p.roll += g * G.sway * Math.sin(TAU * w);
  p.pack[0] += g * 3 * Math.sin(TAU * 2 * w - 1.8) * (1 + run);
  p.pack[1] += g * 4 * Math.sin(TAU * w - 0.9) * (1 + 0.5 * run);
  p.head = [lerp(p.head[0], -4 + 3 * Math.sin(TAU * 2 * w), g), lerp(p.head[1], 0, g), lerp(p.head[2], -3 * Math.sin(TAU * w), g)];
  if (p.claws) {
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, c = p.claws[q];
      const held: Claw = { ...c, w: add(c.w, [-sd * 0.04 * run, -0.08 * run + 0.03 * Math.sin(TAU * w + q * Math.PI), 0.06 + 0.04 * run]), pitch: c.pitch + 8 };
      p.claws[q] = mixClaw(c, held, g);
    }
  }
}

/** A strike, by stage: a butt with its horns; a lunge and a pinch of its claw; reared up with its crest spread, both claws brought down. */
function strikePose(s: Relic, p: Pose, t: number): void {
  const hit = RELIC_HITS[s.stage], G = RELIC_STRIKE.gather;
  const gather = ramp(t, 0.02, G) * (1 - ramp(t, G, hit));
  const thrust = ramp(t, G, hit) * (1 - ramp(t, hit + 0.12, 0.98));
  const jolt = hump(t, hit + 0.03, 0.06);
  if (s.stage === 0) {
    // Drawn back and down, head low; then forward with its head swung up, the horns into what is in front of it.
    p.y += -0.06 * gather + 0.12 * thrust;
    p.z += -0.03 * gather + 0.02 * thrust;
    p.pitch += -6 * gather + 6 * thrust;
    p.head[0] += -22 * gather + 26 * thrust - 8 * jolt;
    p.pack[0] += 8 * gather - 10 * jolt;
    p.reach = 0.2 * thrust;
    return;
  }
  if (s.stage === 1) {
    // Rocked back with its left claw raised and open; thrown forward, the claw snapping shut on what is before it, its horns down.
    p.y += -0.05 * gather + 0.12 * thrust;
    p.pitch += 7 * gather - 4 * thrust;
    p.yaw += 8 * gather - 6 * thrust;
    p.head[0] += 8 * gather - 18 * thrust;
    p.pack[0] += 6 * gather - 8 * jolt;
    p.reach = 0.12 * thrust;
    const c = p.claws!;
    const raised = clawAt(-1, [0.42, 0.9, 0.42], 30, 10, 20, 48), shut = clawAt(-1, [0.18, 1.38, 0.0], -6, 22, 8, -2);
    c[0] = t < G ? mixClaw(c[0], raised, gather) : t < hit ? mixClaw(raised, shut, ramp(t, G, hit) ** 1.5) : mixClaw(shut, c[0], ramp(t, hit + 0.12, 0.98));
    c[1] = mixClaw(c[1], clawAt(1, [0.36, 0.96, 0.08], 0, -26, 16, 10), gather + thrust * 0.6);
    return;
  }
  // The Aureliax rears, crest spread and both claws high and open; then brings them down together on the ground before it.
  p.y += -0.04 * gather + 0.08 * thrust;
  p.z += 0.08 * gather - 0.03 * thrust;
  p.pitch += 12 * gather - 5 * thrust;
  p.head[0] += 12 * gather - 10 * thrust;
  p.crest = Math.max(p.crest, gather + 0.6 * thrust);
  p.pack[0] += 7 * gather - 9 * jolt;
  p.reach = 0.08 * thrust;
  const c = p.claws!;
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    const up = clawAt(sd, [0.46, 1.0, 0.62], 46, -10, 24, 40), down = clawAt(sd, [0.34, 1.52, -0.28], -36, 6, 8, -2);
    c[q] = t < G ? mixClaw(c[q], up, gather) : t < hit ? mixClaw(up, down, ramp(t, G, hit) ** 1.6) : mixClaw(down, c[q], ramp(t, hit + 0.12, 0.98));
  }
}

/** How far into its task it is: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));

/**
 * A go at its task. The Kintsu bows over the cracked tablet in front of it and taps it three times with its horns, its forelegs
 * stamping, as the crack fills with gold; at the flash it rocks back and flips it up into its basket. The Relicrawler holds its
 * tablet up before its face and strokes the crack twice with its other claw, the gold following; at the flash it lifts it up to
 * look, and lowers it. The Aureliax raises its claw and draws the floating pieces in round it, together into a head, and at the
 * flash sends it back up over its shoulder into its chest.
 */
function workPose(s: Relic, p: Pose, t: number, graze: number): void {
  const d = downOf(t, graze), W = RELIC_WORK;
  if (s.stage === 0) {
    const bow = ramp(t, 0.02, 0.12) * (1 - ramp(t, W.flash - 0.04, W.flash + 0.04)) + ramp(t, W.gone, 1);
    const tap = W.taps.reduce((k, c) => k + hump(t, c, 0.05), 0);
    const flip = hump(t, W.flash + 0.06, 0.08);
    p.pitch += d * (-8 * bow - 3 * tap + 8 * flip);
    p.z -= d * 0.03 * bow;
    p.y += d * 0.03 * bow;
    p.head[0] += d * (-16 * bow - 9 * tap + 26 * flip);
    p.head[1] *= 1 - d;
    p.pack[0] += d * (-6 * flip + 4 * hump(t, W.toss + 0.06, 0.06));
    return;
  }
  if (s.stage === 1) {
    const c = p.claws!, up = ramp(t, 0.02, 0.12) * (1 - ramp(t, 0.9, 1));
    const look = hump(t, W.flash + 0.08, 0.12);
    const hold = clawAt(1, [0.26, 1.0, 0.2], 4, 25, 16, 12), raised = clawAt(1, [0.26, 1.0, 0.32], 18, 25, 22, 12);
    c[1] = mixClaw(c[1], mixClaw(hold, raised, look), d * up);
    // The stroke: the left claw's tip run down the face of the tablet, top to foot, twice.
    const stroke = (k: number): number => ramp(t, W.strokes[k] - 0.07, W.strokes[k] + 0.07);
    const along = t < W.strokes[0] + 0.07 ? stroke(0) : t < (W.strokes[0] + W.strokes[1]) / 2 ? 1 - ramp(t, W.strokes[0] + 0.07, W.strokes[1] - 0.07) : stroke(1);
    const top = clawAt(-1, [0.0, 1.04, 0.33], 0, 40, -10, 6), foot = clawAt(-1, [0.0, 1.04, 0.1], -10, 40, -10, 6);
    const back = clawAt(-1, [0.3, 0.98, 0.06], -10, 14, 12, 20);
    const working = t < W.strokes[1] + 0.1 ? mixClaw(top, foot, along) : mixClaw(foot, back, ramp(t, W.strokes[1] + 0.1, W.flash));
    c[0] = mixClaw(c[0], working, d * up);
    p.head[0] += d * (-12 * up + 10 * look);
    p.head[1] += d * (-10 * up);
    p.pitch += d * (2 * up);
    return;
  }
  const c = p.claws!, up = ramp(t, 0.0, W.gather) * (1 - ramp(t, 0.92, 1));
  const swirl = ramp(t, W.gather, W.join), send = hump(t, W.toss, 0.08);
  const raised = clawAt(1, [0.4, 1.3, 0.36], 14, -18, 22, 34 + 10 * Math.sin(t * 20));
  c[1] = mixClaw(c[1], { ...raised, w: add(raised.w, [0, -0.1 * send, 0.12 * send]), pitch: raised.pitch + 30 * send }, d * up);
  c[0] = mixClaw(c[0], clawAt(-1, [0.42, 1.2, 0.0], 4, 0, 16, 22), d * up * 0.6);
  p.crest = Math.max(p.crest, d * (0.35 * swirl + 0.5 * hump(t, W.flash, 0.1)));
  p.head[0] += d * (-6 * up + 14 * send);
  p.head[1] += d * -14 * up * (1 - send);
  p.pitch += d * (3 * up);
}

/** Evolving: crouched under the burst, drawn up tall at the turn with its horns or crest up and its claws raised, a shake, and settled. */
function evolvePose(s: Relic, p: Pose, t: number): void {
  const crouch = ramp(t, 0, 0.1) * (1 - ramp(t, 0.14, 0.32)), up = ramp(t, 0.16, 0.46) * (1 - ramp(t, 0.62, 0.88)), shake = hump(t, 0.54, 0.1);
  p.z += -0.05 * crouch + 0.06 * up;
  p.pitch += 9 * up;
  p.roll += 3 * shake * Math.sin(t * 60);
  p.head[0] += -12 * crouch + 18 * up;
  p.pack[1] += 3 * shake * Math.sin(t * 60 + 1);
  p.crest = Math.max(p.crest, up);
  if (p.claws) for (let q = 0; q < 2; q++) p.claws[q] = mixClaw(p.claws[q], clawAt(q ? 1 : -1, [0.44, 1.0, 0.5], 20, -10, 24, 40), up);
}

function poseOf(s: Relic, a: Anim): Pose {
  const p = standPose(s, a);
  goPose(s, p, a);
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
  else if (a.graze > 0 && a.go < 1) workPose(s, p, 0.05, a.graze * (1 - a.go));
  return p;
}

/* ---- its bones ---------------------------------------------------------------------------- */

const hipOf = (s: Relic, i: number, sd: number): V3 => [sd * s.legs.x, s.legs.ys[i], s.legs.z];
/** Which of the two sets of three a leg is in: the front and back on one side with the middle on the other. */
const setOf = (i: number, sd: number): number => (i + (sd > 0 ? 0 : 1)) % 2;
/** How far over the ground the lowest of a claw put down is: touching it, never in it; and over how far the ground takes it. */
const FLOOR = 0.004;
const SOFT = 0.04;

/** Where a foot is on the ground: out from its hip and fanned round standing; going, swept back while down and brought forward while up. */
function footOf(s: Relic, i: number, sd: number, a: Anim, reach: number): V3 {
  const L = s.legs, fan = L.fan[i] * DEG, h = hipOf(s, i, sd);
  const rest: V3 = [h[0] + sd * Math.cos(fan) * L.reach, h[1] + Math.sin(fan) * L.reach + (i === 0 ? reach * (L.upper + L.lower) : 0), 0];
  if (a.go <= 0 || a.act) return rest;
  const G = s.gait, run = a.gait, g = smooth(a.go);
  const duty = lerp(G.duty[0], G.duty[1], run), sweep = lerp(G.sweep[0], G.sweep[1], run), high = lerp(G.lift[0], G.lift[1], run);
  const ph = frac(a.u + setOf(i, sd) * 0.5);
  let dy = 0, up = 0;
  if (ph < duty) dy = sweep * (0.5 - ph / duty);
  else {
    const u = (ph - duty) / (1 - duty);
    dy = sweep * (smooth(u) - 0.5);
    up = high * Math.sin(Math.PI * u);
  }
  return [rest[0], rest[1] + g * dy, g * up];
}

/** The lowest point of a hand and its finger, posed so, under its wrist. */
function lowOf(hand: Xf, h: number, open: number): number {
  let lo = Infinity;
  for (const [p, r] of [[[0, h * 0.38, 0], h * 0.32], [[0, h * 0.86, -h * 0.22], h * 0.14], [[0, h * 1.1, -h * 0.18], h * 0.09], [tipOf(h), h * 0.012]] as Array<[V3, number]>) lo = Math.min(lo, place(hand, p)[2] - r);
  const nip = joint(hand, hingeOf(h), open, 0, 0);
  for (const [p, r] of [[[0, h * 0.28, h * 0.04], h * 0.14], [[0, h * 0.72, -h * 0.26], h * 0.012]] as Array<[V3, number]>) lo = Math.min(lo, place(nip, p)[2] - r);
  return lo - hand.t[2];
}

/** Where the relic it mends lies, in front of it, on the ground (the Kintsu's). */
const itemSpot = (s: Relic): V3 => [0, s.head.at[1] + s.head.r[1] * 1.3 + s.item * 1.3, 0];
/** The statue head's middle while it is together, by the raised claw (body frame). */
const statueSpot = (s: Relic): V3 => [s.claws!.rest.w[0] * 1.0, s.claws!.rest.w[1] + 0.25, s.high + 0.62];

function relicBones(s: Relic): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [0, p.y, p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    b.head = joint(body, s.head.at, p.head[0], p.head[2], p.head[1]);
    b.pack = joint(body, s.pack.at, s.pack.tilt + p.pack[0], p.pack[1], 0);
    // The crest rides the head, lifted as it rears, evolves or works.
    if (s.crest) b.crest = joint(b.head, crestPivot(s), 12 * p.crest, 0, 0);
    b.shadow = shadowOf(body, Math.max(0, p.z - s.high) * 2);
    const up: V3 = [0, 0, 1];
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const hip = place(body, hipOf(s, i, sd)), foot = footOf(s, i, sd, a, p.reach);
        const kn = kneeOf(hip, foot, s.legs.upper, s.legs.lower, up);
        const N = cross(sub(foot, hip), up);
        const upper = inPlane(hip, sub(kn, hip), N), lower = inPlane(kn, sub(foot, kn), N);
        b[`leg${i}${q}0`] = upper;
        b[`leg${i}${q}1`] = lower;
        const tip: Xf = { m: lower.m, t: foot };
        if (i === 0) b[`f${sd > 0 ? 'r' : 'l'}2`] = tip;
        if (i === 2) b[`h${sd > 0 ? 'r' : 'l'}2`] = tip;
      }
      if (p.claws && s.claws) {
        const C = s.claws, c = p.claws[q], h = C.hand;
        const hand0 = joint({ m: body.m, t: [0, 0, 0] }, [0, 0, 0], c.pitch, c.roll, c.yaw);
        const wrist = place(body, c.w);
        const dz = FLOOR - lowOf({ m: hand0.m, t: [0, 0, 0] }, h, c.open) - wrist[2];
        wrist[2] += 0.5 * (dz + Math.sqrt(dz * dz + SOFT * SOFT));
        const hand: Xf = { m: hand0.m, t: wrist };
        const sh = place(body, [sd * C.at[0], C.at[1], C.at[2]]);
        const pole = sub(place(body, [sd * 1.0, -0.4, 0.5]), body.t);
        const [A1, A2] = C.arm, el = kneeOf(sh, wrist, A1, A2, pole);
        const plane = cross(sub(wrist, sh), pole);
        b[`arm${q}0`] = aim(sh, sub(el, sh), cross(plane, sub(el, sh)));
        b[`arm${q}1`] = aim(el, sub(wrist, el), cross(plane, sub(wrist, el)));
        b[`claw${q}`] = hand;
        b[`nip${q}`] = joint(hand, hingeOf(h), c.open, 0, 0);
      }
    }
    // What it mends.
    const act = a.act, W = RELIC_WORK;
    const working = act?.kind === 'work' ? act.t : a.graze > 0 && a.go < 1 ? 0.05 : -1;
    const d = act?.kind === 'work' ? downOf(act.t, a.graze) : a.graze;
    if (s.stage === 0 && working >= 0) {
      // The cracked tablet lying in front of it, nudged at each tap, flipped up over its head at the flash in an arc into the
      // basket and gone; the next lying where the last was.
      const t = working, there = smooth((d - 0.05) / 0.4);
      const spot = itemSpot(s);
      const gone = t > W.toss + 0.08 && t < W.gone;
      if (there > 0.01 && !gone) {
        const u = clamp((t - W.flash) / (W.toss + 0.08 - W.flash));
        let pos: V3 = add(spot, [0, 0, 0.004 + 0.015 * W.taps.reduce((k, c) => k + hump(t, c + 0.02, 0.03), 0)]);
        let spin = 0;
        if (u > 0) {
          const top = place(b.pack, [0, 0, s.pack.h * 0.8]);
          const peak: V3 = [(pos[0] + top[0]) / 2, (pos[1] + top[1]) / 2, Math.max(pos[2], top[2]) + 0.45];
          const e = u, f = 1 - e;
          pos = [f * f * pos[0] + 2 * f * e * peak[0] + e * e * top[0], f * f * pos[1] + 2 * f * e * peak[1] + e * e * top[1], f * f * pos[2] + 2 * f * e * peak[2] + e * e * top[2]];
          spin = -260 * u;
        }
        const k = there * (t >= W.gone ? ramp(t, W.gone, W.gone + 0.08) : 1) * (1 - 0.5 * ramp(u, 0.7, 1));
        b.item = joint({ m: [k, 0, 0, 0, k, 0, 0, 0, k], t: pos }, [0, 0, 0], spin, 0, 0);
      }
    }
    if (s.stage === 1 && p.claws) {
      // The tablet held in the right claw, between its fingers, upright before it.
      b.held = joint({ m: body.m, t: place(b.claw1, [0, s.claws!.hand * 0.95, -s.claws!.hand * 0.04]) }, [0, 0, 0], 0, 0, -30);
    }
    if (s.stage === 2) {
      // The floating pieces by its right claw: bobbing apart while it stands, drawn in round the claw in rings at its task and
      // together into a head, which is sent up into its chest and gone; and then floating apart again where they were.
      const t = a.t;
      const mid = statueSpot(s);
      const k = working >= 0 ? d : 0;
      const u = working >= 0 ? working : 0;
      const join = ramp(u, W.gather, W.join) * k;
      const sent = clamp((u - W.toss) / (W.gone - W.toss)) * k;
      const back = working >= 0 ? ramp(u, W.gone, 1) : 1;
      const around = place(body, [mid[0], mid[1], mid[2] - s.high]);
      const top = place(b.pack, [0, 0, s.pack.h * 1.1]);
      for (let q = 0; q < 3; q++) {
        const apart = STATUE_APART[q], sp = 0.9 + 0.2 * q;
        const spin = TAU * (cyc(t, 1, q * 2.1) * 0.08 + join * (1.2 + 0.3 * q));
        const r = 1 - join;
        const off: V3 = [
          (apart[0] * Math.cos(spin) - apart[1] * Math.sin(spin)) * s.item * 1.5 * r,
          (apart[0] * Math.sin(spin) + apart[1] * Math.cos(spin)) * s.item * 1.5 * r,
          apart[2] * s.item * 1.2 * r + 0.03 * cyc(t, 3 + q, q * 1.7) * (1 - join),
        ];
        let pos = add(around, off);
        if (sent > 0) {
          const e = sent, f = 1 - e, peak: V3 = [(pos[0] + top[0]) / 2, (pos[1] + top[1]) / 2, Math.max(pos[2], top[2]) + 0.4];
          pos = [f * f * pos[0] + 2 * f * e * peak[0] + e * e * top[0], f * f * pos[1] + 2 * f * e * peak[1] + e * e * top[1], f * f * pos[2] + 2 * f * e * peak[2] + e * e * top[2]];
        }
        const g = (sent > 0.85 ? 1 - ramp(sent, 0.85, 1) : 1) * (working >= 0 && u >= W.gone ? back : 1) * (1 - 0.4 * sent);
        const tumble = (1 - join) * (20 * cyc(t, 2, q) + 30 * sp * cyc(t, 1, q + 0.5));
        b[`frag${q}`] = joint({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t: pos }, [0, 0, 0], tumble, tumble * 0.6, 20 + 90 * sent + q * 40 * (1 - join));
      }
      b.statue = b.frag1;
    }
    return b;
  };
}

/* ---- its pieces --------------------------------------------------------------------------- */

function relicBuild(s: Relic, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), nb = cut(lod, 16, 22);
  const pieces: Piece[] = [];
  const shellSolid = { c: s.shell.c, r: [s.shell.r[0] * 0.92, s.shell.r[1] * 0.92, s.shell.r[2] * 0.9] as V3 };
  pieces.push({ key: 'shell', mesh: merge(domeOf(s, nb, cut(lod, 5, 7)), shellMarks(s)), bone: 'body', bias: 0 });
  pieces.push({ key: 'belly', mesh: bellyOf(s, n, k), bone: 'body', bias: -0.02, under: ['shell'] });
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.9) };
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.04, front: [0, 1, 0], after: ['belly'] });
  if (s.horns) pieces.push({ key: 'horns', mesh: hornsOf(s, Math.max(6, n - 2)), bone: 'head', bias: 0.05, after: ['head'], hide: [headSolid], hideIn: 'head' });
  if (s.crest) {
    const C = crestOf(s, n);
    const pv = crestPivot(s);
    pieces.push({ key: 'crest', mesh: mesh(C.crest.v.map((v) => sub(v, pv)), C.crest.f), bone: 'crest', bias: 0.05, after: ['head'], hide: [headSolid], hideIn: 'head' });
    pieces.push({ key: 'gem', mesh: C.gem, bone: 'head', bias: 0.06, after: ['head'], front: [0, 1, 0.4] });
  }
  // What it carries, sat on its back over the shell.
  const cargo = s.cargo === 'basket' ? basketOf(s, n) : s.cargo === 'crate' ? crateOf(s, n) : chestOf(s, n);
  pieces.push({ key: 'pack', mesh: cargo.box, bone: 'pack', bias: 0.03, after: ['shell'] });
  pieces.push({ key: 'load', mesh: cargo.load, bone: 'pack', bias: 0.031, after: ['pack'] });
  if (s.banner) {
    const P = s.pack, B = bannerOf(P.l * 0.62, s.banner);
    for (const sd of [1, -1]) {
      const m = sd > 0 ? B : mirroredMesh(B);
      pieces.push({ key: `banner${sd > 0 ? 'r' : 'l'}`, mesh: into(joint(ROOT, [sd * P.w * 1.08, -P.l * 0.1, P.h * 0.92], 0, 0, 0), m), bone: 'pack', bias: 0.035, after: ['pack', 'shell'], front: [sd, 0, 0] });
    }
    if (s.cargo === 'chest') {
      const back = into(joint(ROOT, [0, -P.l * 1.06, P.h * 0.92], 0, 0, -90), bannerOf(P.w * 0.55, s.banner * 0.9));
      pieces.push({ key: 'bannerb', mesh: back, bone: 'pack', bias: 0.035, after: ['pack', 'shell'], front: [0, -1, 0] });
    }
  }
  // Legs.
  const up = upperOf(s), low = lowerOf(s);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const lf: V3 = [sd, 0, 0];
      pieces.push(
        { key: `leg${i}${q}0`, mesh: up, bone: `leg${i}${q}0`, bias: 0.01, after: 'belly', front: lf, hide: [shellSolid], hideIn: 'body' },
        { key: `leg${i}${q}1`, mesh: low, bone: `leg${i}${q}1`, bias: 0.015, after: [`leg${i}${q}0`, 'belly'], front: lf, hide: [shellSolid], hideIn: 'body', thin: s.stage === 0 },
      );
    }
  }
  if (s.claws) {
    const C = s.claws, T = C.thick;
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, front: V3 = [sd * 0.5, 1, 0];
      pieces.push(
        { key: `arm${q}0`, mesh: merge(tube([[0, -T, 0], [0, C.arm[0] + T * 0.3, 0]], T, T, 6, 'metal', { seam: 'start' }), orbAlong([0, C.arm[0] * 0.5, T * 0.4], [0, 1, 0], [T * 1.1, T * 0.7, C.arm[0] * 0.42], 6, 3, 'coat')), bone: `arm${q}0`, bias: 0.02, after: 'belly', front, hide: [shellSolid], hideIn: 'body' },
        { key: `arm${q}1`, mesh: merge(orb([0, 0, 0], T * 1.1, 6, 3, 'metalDark'), tube([[0, 0, 0], [0, C.arm[1] + T * 0.3, 0]], T * 1.05, T * 1.05, 6, 'metal'), orbAlong([0, C.arm[1] * 0.5, T * 0.5], [0, 1, 0], [T * 1.1, T * 0.7, C.arm[1] * 0.4], 6, 3, 'coat')), bone: `arm${q}1`, bias: 0.025, after: ['belly', `arm${q}0`], front },
        { key: `claw${q}`, mesh: handOf(s, C.hand, n, k), bone: `claw${q}`, bias: 0.03, after: [`arm${q}1`, 'belly'], front },
        { key: `nip${q}`, mesh: nipOf(C.hand), bone: `nip${q}`, bias: 0.035, after: `claw${q}`, front: [sd, 0.3, 0.3], convex: true },
      );
    }
  }
  // What it mends.
  if (s.stage === 0) {
    const plain = crackedTablet(s, false), gold = crackedTablet(s, true);
    const goldOf = (a: Anim): boolean => a.act?.kind === 'work' && a.act.t > RELIC_WORK.taps[1] && a.act.t < RELIC_WORK.gone;
    pieces.push({ key: 'item', mesh: plain, bone: 'item', bias: 0.06, shown: (a) => !goldOf(a) });
    pieces.push({ key: 'itemGold', mesh: gold, bone: 'item', bias: 0.06, shown: goldOf });
  }
  if (s.stage === 1) {
    const plain = heldTablet(s, false), gold = heldTablet(s, true);
    const goldOf = (a: Anim): boolean => a.act?.kind === 'work' && a.act.t > RELIC_WORK.strokes[0] && a.act.t < 0.96;
    pieces.push({ key: 'held', mesh: plain, bone: 'held', bias: 0.05, after: ['claw1'], under: ['nip1'], shown: (a) => !goldOf(a) });
    pieces.push({ key: 'heldGold', mesh: gold, bone: 'held', bias: 0.05, after: ['claw1'], under: ['nip1'], shown: goldOf });
  }
  if (s.stage === 2) {
    const parts = statuePieces(s);
    const whole = (a: Anim): boolean => a.act?.kind === 'work' && a.act.t >= RELIC_WORK.join && a.act.t < RELIC_WORK.gone + 0.02;
    parts.forEach((m, q) => pieces.push({ key: `frag${q}`, mesh: m, bone: `frag${q}`, bias: 0.08, shown: (a) => !whole(a) }));
    pieces.push({ key: 'statue', mesh: merge(...parts), bone: 'statue', bias: 0.08, shown: whole });
  }
  return pieces;
}

/* ---- what it throws about ----------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [196, 182, 156];
const GOLD: readonly RGB[] = [[250, 214, 110], [255, 236, 160], [226, 172, 70]];
const TURQ: RGB = [96, 206, 200];
const STONE: RGB = [236, 226, 204];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A puff of dust off the ground. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(DUST, [252, 246, 236], 0.2 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + jitter(id) * TAU, dd = q ? rr * 0.42 : 0, lr = rr * (q ? 0.72 : 1);
    const cx = x + Math.cos(a) * dd, cy = y + Math.sin(a) * dd * 0.6 - rr * 0.18 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, css(c, al * (q ? 0.7 : 1)));
    grad.addColorStop(0.55, css(c, al * 0.45 * (q ? 0.7 : 1)));
    grad.addColorStop(1, css(c, 0));
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
}

/** A four-pointed glint, `r` across, white with a gold rim. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, spin: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 4 * px * (0.4 + 0.6 * al));
  const path = (R: number, w: number): void => {
    g.beginPath();
    for (let q = 0; q < 8; q++) {
      const a = spin + (q / 8) * TAU, k = q % 2 ? w : R;
      const X = x + Math.cos(a) * k, Y = y + Math.sin(a) * k;
      if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.closePath();
  };
  path(r, r * 0.22);
  g.fillStyle = css(GOLD[0], al * 0.9);
  g.fill();
  path(r * 0.62, r * 0.14);
  g.fillStyle = css([255, 252, 240], al);
  g.fill();
}

/** A fleck of gold or a chip of stone in the air: a small inked lozenge. */
function fleck(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(0, -r * 0.6);
  g.lineTo(r, 0);
  g.lineTo(0, r * 0.6);
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = Math.max(0.5 * px, r * 0.2);
  g.strokeStyle = css(mix(c, [80, 56, 30], 0.6), al * 0.9);
  g.stroke();
  g.restore();
}

/**
 * Golden rings of restoring light round a point: ellipses lying round it at a slant, each a bright gold stroke fading along its
 * length behind its head, turning; drawn in two halves, the far half under the body and the near half over it.
 */
function swirl(g: CanvasRenderingContext2D, view: View, c: V3, R: number, t: number, al: number, front: boolean, mid: V3, rings = 3): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  g.save();
  g.lineCap = 'round';
  for (let q = 0; q < rings; q++) {
    const tilt = 0.5 + q * 0.7, r = R * (0.75 + 0.22 * q), spin = t * (2.6 + 0.7 * q) + q * 2.1;
    const steps = 22;
    let last: [number, number] | null = null;
    for (let e = 0; e <= steps; e++) {
      const u = e / steps, a = spin + u * TAU * 0.8;
      const p: V3 = add(c, [Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt) * 0.7 + Math.cos(a) * r * 0.15 * q]);
      const [x, y] = onScreen(view, p);
      const near = nearSide(p, mid, view);
      if (last && near === front) {
        const k = u ** 1.4;
        g.strokeStyle = css(mix(GOLD[2], GOLD[1], k), al * k);
        g.lineWidth = Math.max(1.1 * px, R * 0.07 * (0.4 + 0.6 * k));
        g.beginPath();
        g.moveTo(last[0], last[1]);
        g.lineTo(x, y);
        g.stroke();
      }
      last = [x, y];
    }
    // Its head, a bright spark.
    const a = spin + TAU * 0.8, p: V3 = add(c, [Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt) * 0.7 + Math.cos(a) * r * 0.15 * q]);
    if (nearSide(p, mid, view) === front) {
      const [x, y] = onScreen(view, p);
      star(g, x, y, R * 0.16, al, t * 4 + q);
    }
  }
  g.restore();
}

/** A soft round glow of light, gold or turquoise. */
function glowAt(g: CanvasRenderingContext2D, view: View, p: V3, r: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const [x, y] = onScreen(view, p);
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

/** Its task: sparks of gold off the crack at each tap or stroke, the crack's glow as it fills, the flash, and sparks trailing the mended thing up into its cargo. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Relic, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = RELIC_WORK, T = ACT_SECS.work, mid = b.body.t, big = 0.7 + 0.35 * s.stage;
  const d = downOf(t, a.graze);
  if (d < 0.05) return;
  if (s.stage === 0) {
    if (!b.item) return;
    const c = b.item.t;
    W.taps.forEach((at, q) => {
      const since = (t - at) * T;
      if (since < 0 || since > 0.35) return;
      for (let e = 0; e < 5; e++) {
        const ang = jitter(q * 9 + e) * TAU, sp = 0.5 + 0.6 * jitter(q * 7 + e);
        const p = thrown(add(c, [0, 0, s.item * 0.25]), [Math.cos(ang) * sp * big, Math.sin(ang) * sp * big, 1.4 * big], since, 7);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        fleck(g, x, y, 0.035 * big, ang + since * 9, GOLD[e % 3], 1 - since / 0.35);
      }
      if (front && since < 0.2) {
        const [x, y] = onScreen(view, add(c, [0, 0, s.item * 0.3]));
        star(g, x, y, 0.09 * big, 1 - since / 0.2, at * 7);
      }
    });
    const fill = ramp(t, W.taps[1], W.flash) * (1 - ramp(t, W.toss, W.toss + 0.08));
    if (front) glowAt(g, view, add(c, [0, 0, s.item * 0.3]), s.item * (1.2 + 1.4 * hump(t, W.flash, 0.06)), GOLD[0], 0.35 * fill + 0.6 * hump(t, W.flash, 0.06));
    if (front && hump(t, W.flash, 0.06) > 0) {
      const [x, y] = onScreen(view, add(c, [0, 0, s.item * 0.4]));
      star(g, x, y, s.item * 1.4 * hump(t, W.flash, 0.06), hump(t, W.flash, 0.06), 0.3);
    }
    // Sparks trailing it up into the basket.
    const up = (t - W.flash) / (W.toss + 0.08 - W.flash);
    if (up > 0 && up < 1.2) {
      for (let e = 0; e < 4; e++) {
        const lag = e * 0.08, p = add(b.item.t, [0, 0, 0]);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, add(p, [0.05 * Math.sin(e * 2 + t * 30), -lag * 0.6, -lag * 0.5]));
        star(g, x, y, 0.05 * big, (1 - lag * 2.5) * (1 - ramp(up, 0.9, 1.2)), e + t * 10);
      }
    }
    return;
  }
  if (s.stage === 1) {
    if (!b.held || !b.claw0) return;
    // Sparks off the left claw's tip as it runs down the crack; the tablet's glow; the flash.
    const tip = place(b.claw0, tipOf(s.claws!.hand));
    const stroking = W.strokes.reduce((k, c) => k + hump(t, c, 0.08), 0);
    if (stroking > 0.05) {
      for (let e = 0; e < 4; e++) {
        const since = frac(t * 9 + e * 0.25) * 0.25, ang = jitter(e + Math.floor(t * 9) * 3) * TAU;
        const p = thrown(tip, [Math.cos(ang) * 0.6 * big, Math.sin(ang) * 0.6 * big, 1.1 * big], since, 7);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        fleck(g, x, y, 0.03 * big, ang + since * 9, GOLD[e % 3], stroking * (1 - since / 0.25));
      }
      if (front) {
        const [x, y] = onScreen(view, tip);
        star(g, x, y, 0.07 * big, stroking, t * 12);
      }
    }
    const c = b.held.t;
    const fill = ramp(t, W.strokes[0], W.flash) * (1 - ramp(t, 0.86, 0.98));
    if (front) glowAt(g, view, c, s.item * (1.8 + 1.6 * hump(t, W.flash, 0.06)), GOLD[0], 0.3 * fill + 0.55 * hump(t, W.flash, 0.06));
    if (front && hump(t, W.flash, 0.06) > 0) {
      const [x, y] = onScreen(view, c);
      star(g, x, y, s.item * 1.6 * hump(t, W.flash, 0.06), hump(t, W.flash, 0.06), 0.3);
    }
    return;
  }
  // The Aureliax: golden rings round the pieces as they come together, the flash, and sparks trailing the head up into the chest.
  if (!b.statue) return;
  const c = b.statue.t;
  const rings = ramp(t, W.gather - 0.04, W.gather + 0.08) * (1 - ramp(t, W.toss, W.toss + 0.08));
  swirl(g, view, c, s.item * (2.6 - 1.0 * ramp(t, W.gather, W.join)), t * T, rings * d, front, mid, 3);
  if (front) {
    glowAt(g, view, c, s.item * (2 + 2 * hump(t, W.flash, 0.06)), GOLD[0], 0.25 * rings + 0.6 * hump(t, W.flash, 0.06));
    if (hump(t, W.flash, 0.06) > 0) {
      const [x, y] = onScreen(view, c);
      star(g, x, y, s.item * 1.8 * hump(t, W.flash, 0.06), hump(t, W.flash, 0.06), 0.3);
    }
  }
  const up = (t - W.toss) / (W.gone - W.toss);
  if (up > 0 && up < 1.1) {
    for (let e = 0; e < 5; e++) {
      const p = add(c, [0.06 * Math.sin(e * 2 + t * 30), 0, -e * 0.06]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      star(g, x, y, 0.06 * big, (1 - e * 0.18) * (1 - ramp(up, 0.85, 1.1)), e + t * 10);
    }
  }
}

/** Standing about, the Aureliax's pieces float with a faint ring of gold and a few motes round them. */
function floatBits(g: CanvasRenderingContext2D, view: View, s: Relic, b: Bones, a: Anim, front: boolean): void {
  if (s.stage !== 2 || !b.statue || a.act) return;
  const c = b.statue.t, mid = b.body.t;
  swirl(g, view, c, s.item * 2.4, a.t * 0.8, 0.35, front, mid, 2);
  for (let q = 0; q < 5; q++) {
    const u = frac(a.t / 6 + q / 5), ang = q * 1.3 + a.t * 0.4;
    const p = add(c, [Math.cos(ang) * s.item * 1.6, Math.sin(ang) * s.item * 1.6, (u - 0.5) * s.item * 3]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    fleck(g, x, y, 0.025, ang, GOLD[q % 3], Math.sin(Math.PI * u) * 0.9);
  }
}

/** A strike landing: dust where it comes down, gold and stone chips off the blow, and the Aureliax's ring of gold over the ground. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Relic, b: Bones, t: number, front: boolean): void {
  const since = (t - RELIC_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.5) return;
  const big = 0.7 + 0.35 * s.stage, mid = b.body.t;
  const at: V3 = s.stage === 0 ? place(b.head, [0, s.head.r[1] * 1.2, s.head.r[2] * 0.5]) : s.stage === 1 ? place(b.claw0, tipOf(s.claws!.hand)) : mixV(place(b.claw0, tipOf(s.claws!.hand)), place(b.claw1, tipOf(s.claws!.hand)), 0.5);
  const ground: V3 = [at[0], at[1], 0.03];
  if (nearSide(ground, mid, view) === front) puff(g, view, ground, 0.22 * big, since / 0.45, s.stage);
  for (let q = 0; q < 6 + 3 * s.stage; q++) {
    const ang = jitter(q + 11) * TAU, sp = (0.6 + 0.9 * jitter(q + 3)) * big;
    const p = thrown(at, [Math.cos(ang) * sp, Math.sin(ang) * sp + 0.4, (1.6 + jitter(q + 5)) * big], since, 9);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    fleck(g, x, y, 0.04 * big, ang + since * 12, q % 3 ? GOLD[q % 3] : q % 2 ? STONE : TURQ, 1 - smooth((since - 0.3) / 0.2));
  }
  if (front && since < 0.15) {
    const [x, y] = onScreen(view, at);
    star(g, x, y, 0.16 * big, 1 - since / 0.15, since * 9);
  }
  if (s.stage === 2) {
    // A ring of gold out over the ground from where both claws came down.
    const R = 0.3 + 2.4 * since, al = 0.8 * (1 - smooth(since / 0.4));
    const [ox, oy] = onScreen(view, ground);
    g.save();
    g.transform(view.ex[0], view.ex[1], view.ey[0], view.ey[1], ox, oy);
    g.strokeStyle = css(GOLD[1], al);
    g.lineWidth = Math.max(pxOf(g) * 1.2, 0.06 * (1 - since * 2));
    g.beginPath();
    const T = view.T, ah = Math.atan2(T[1], T[0]);
    // The half toward the viewer over the body, the rest under it.
    if (front) g.arc(0, 0, R, ah - Math.PI / 2, ah + Math.PI / 2);
    else g.arc(0, 0, R, ah + Math.PI / 2, ah + (3 * Math.PI) / 2);
    g.stroke();
    g.restore();
  }
}

/** Evolving: gold flakes, turquoise chips and cream stone swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Relic, b: Bones, t: number, front: boolean): void {
  const big = 0.7 + 0.35 * s.stage, mid = b.body.t, S = s.shell.r;
  const al = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (al <= 0) return;
  const rx = S[0] * 1.6 + 0.25 * big, ry = S[1] * 1.5 + 0.25 * big, high = (S[2] + s.high) * 1.8 + 0.4 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.body, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.6 - s.high * 0.5]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    fleck(g, x, y, 0.05 * big * (1 - 0.4 * u), ang * 2, q % 3 === 0 ? TURQ : q % 3 === 1 ? STONE : GOLD[q % 2], al * ramp(u, 0, 0.15));
  }
  if (front) swirl(g, view, add(mid, [0, 0, S[2] * 0.6]), (S[0] + S[1]) * 0.7, t * 6, al * 0.7, true, mid, 2);
  else swirl(g, view, add(mid, [0, 0, S[2] * 0.6]), (S[0] + S[1]) * 0.7, t * 6, al * 0.7, false, mid, 2);
}

/** The gem in the Aureliax's brow, glowing while its face is toward the viewer, brighter as it works and at the flash. */
function gemGlow(g: CanvasRenderingContext2D, view: View, s: Relic, b: Bones, a: Anim): void {
  if (!s.crest) return;
  const at = gemAt(s), p = place(b.head, at), out = sub(place(b.head, add(at, onEgg([0, 0, 0], s.head.r, [0, 0.8, 0.45]).n)), p);
  const facingUs = dot(out, view.T);
  if (facingUs < -0.1) return;
  const W = RELIC_WORK, t = a.act?.kind === 'work' ? a.act.t : -1;
  const k = 0.42 + 0.1 * cyc(a.t, 6) + (t >= 0 ? 0.25 * ramp(t, W.gather, W.join) + 0.4 * hump(t, W.flash, 0.08) : 0);
  glowAt(g, view, p, s.head.r[0] * 0.8, [120, 240, 230], k * clamp((facingUs + 0.1) / 0.4));
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function relicKind(s: Relic): Kind {
  const bones = relicBones(s);
  return {
    bones,
    build: (lod) => relicBuild(s, lod),
    // The variant's coat is its shell's turquoise and its markings its gold; its stone cream, its wicker brown and its eyes dark on
    // every variant.
    palette: (coat, mark) => {
      const shell = mix(coat, [255, 255, 255], 0.06), gold = mix(mark, [255, 240, 200], 0.08);
      return coatPalette(coat, mark, {
        coat: shell,
        coatDark: mix(shell, [20, 50, 60], 0.35),
        coatLight: mix(shell, [220, 250, 240], 0.28),
        metal: gold,
        metalDark: mix(gold, [70, 44, 20], 0.42),
        metalLit: mix(gold, [255, 228, 130], 0.4),
        belly: mix(gold, [120, 76, 40], 0.45),
        bark: mix(gold, [90, 56, 30], 0.6),
        stone: hex('#e8dcc4'),
        stoneDark: [176, 158, 130],
        wood: [156, 108, 62],
        woodDark: [104, 68, 40],
        hornDark: [92, 62, 40],
        claw: [96, 64, 38],
        eye: [30, 26, 34],
        glint: [255, 254, 248],
        crystal: [104, 200, 192],
        crystalDark: [46, 112, 120],
        cloth: [240, 230, 206],
        clothDark: [206, 190, 158],
        shell: [236, 224, 196],
        shellDark: [150, 104, 62],
        cap: [120, 80, 50],
        bloom: [252, 214, 110],
        gem: [110, 228, 218],
        inner: [60, 40, 30],
        lid: mix(gold, [70, 44, 20], 0.42),
      } as Partial<ReturnType<Kind['palette']>>, 190);
    },
    shadow: [(s.legs.ys[0] - s.legs.ys[2]) * 0.5 + s.legs.reach * 0.9 + 0.1, s.legs.x + s.legs.reach * 0.9],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[252, 214, 110], [104, 200, 192]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
      floatBits(g, view, s, b, a, front);
      if (front) gemGlow(g, view, s, b, a);
    },
  };
}

export const KINTSU = relicKind(KINTSU_LOOK);
export const RELICRAWLER = relicKind(RELICRAWLER_LOOK);
export const AURELIAX = relicKind(AURELIAX_LOOK);
