import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, darker, disc, dot, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint, pastel,
  scale, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The sand line: the Sandpip, a little hermit crab carrying a cream bowl of a
 * shell heaped with sand, which grows into the Sandpincher, its bowl taller
 * and hung with spiral shells, coral and plates of shell and one claw grown
 * far bigger than the other, and then the Sandpinnacle, a heavy crab under a
 * crown of shells round a great bowl of sand. The species is still `crawler`
 * underneath, as saves and the database know it.
 *
 * Each is a peach crab with a cream face plate, black eyes up on short
 * stalks, four thin jointed legs a side, and ivory claws speckled coral, peach
 * and pale blue; on its back a bowl of a shell with a scalloped rim, open at
 * the top and full of golden sand. All three are built by one set of
 * functions from a description of the stage (`Sand`), so a stage is its
 * numbers. It digs: its claws scoop sand off the ground and toss it up over
 * its head into the bowl on its back.
 *
 * Its front is `y`, its right `x`, up `z`, as every kind's; it walks forward,
 * as a hermit crab does, its legs fanned out to either side of it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along the body, rear to front: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/**
 * Something stuck on the outside of the bowl: a spiral shell, a knob of
 * porous coral or sponge, or a fan-shaped plate of shell. Where it is round
 * the bowl (degrees from the front toward its right) and how far up it
 * (nought its foot, one its rim), how big, and its colours; a plate's flare
 * off the bowl and its turn on it, in degrees, and how far its face is
 * swung round toward its right, so it does not stand edge-on to a side view.
 */
interface Deco { kind: 'spiral' | 'coral' | 'plate'; az: number; f: number; r: number; m?: Mat; m2?: Mat; flare?: number; spin?: number; swing?: number }

interface Sand {
  /** The body under the front of the shell: its rings, in the body's frame, whose root is `high` over the ground standing. */
  body: Rings;
  high: number;
  /** The cream plate over the front of its head: its middle and half-sizes across, along and up. */
  face: { at: V3; r: V3 };
  /**
   * The right eye's stalk: its root on the head, its length, the eye's radius, how far the stalk leans out and forward
   * (degrees), and how much further forward the right one leans than the left, and the left back, so that in profile they stand apart.
   */
  eye: { root: V3; len: number; r: number; out: number; lean: number; stagger: number };
  /**
   * The bowl on its back: the middle of its foot on the body, how far it is tipped forward (degrees), its outside from foot to
   * rim as [height, radius] pairs, the scallops of its rim (how many, how high, and how pointed: under one round, over one
   * a crown's points), how thick its wall is, how far under the rim the sand meets the wall, how high the heap stands over that,
   * and how many clusters of speckles are on it.
   */
  bowl: { at: V3; tilt: number; prof: Array<[number, number]>; lobes: number; lobe: number; sharp: number; wall: number; sand: number; heap: number; spots: number };
  deco: Deco[];
  /**
   * Four legs a side, front to back: where the hips are (across, up, and along for each), how far round from straight out
   * each foot is put down (degrees, forward positive), the leg's two parts, how far out from its hip a foot stands, how thick
   * the leg is at the hip, and how far its lower part arches up.
   */
  legs: { x: number; z: number; ys: number[]; fan: number[]; upper: number; lower: number; reach: number; thick: number; arch: number };
  /**
   * The claws: the right shoulder on the body, the arm's two parts, each hand's length (left, right), and where each rests,
   * its wrist ahead of the shoulder and out to its side, each side its own, with its finger's tip on the ground (`groundAt`),
   * how far its fingers are tipped down and how far open they are held (degrees).
   */
  claw: { at: V3; arm: [number, number]; hand: [number, number]; rest: { fwd: number; out: [number, number]; pitch: number; open: number }; thick: number };
  /**
   * How it goes: how far a foot sweeps back while it is down, at a walk and at a run; how much of a stride each is down; how
   * high a foot is lifted; how far the body bobs and rolls; how far the shell sways and rocks behind it; and how much sand it
   * spills off the top of its heap as it goes.
   */
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; bob: number; sway: number; rock: number; trickle: number };
  /** How it strikes: a quick pinch, a big-claw snap with a lunge, or both claws raised and brought down in a crush. */
  strike: 0 | 1 | 2;
  size: number;
}

/** A Sandpip: small, a single scalloped bowl of sand tipped back on it with one spiral shell on its side, two small pincers and short chunky legs. */
const SANDPIP_LOOK: Sand = {
  body: { y: [-0.62, -0.36, 0.0, 0.38, 0.66, 0.86, 0.95], z: [0.3, 0.16, 0.05, 0.06, 0.1, 0.12, 0.12], w: [0.22, 0.38, 0.46, 0.48, 0.45, 0.38, 0.14], h: [0.18, 0.3, 0.36, 0.36, 0.34, 0.29, 0.1] },
  high: 0.52,
  face: { at: [0, 0.88, 0.15], r: [0.4, 0.17, 0.34] },
  eye: { root: [0.18, 0.78, 0.32], len: 0.24, r: 0.15, out: 30, lean: 22, stagger: 10 },
  bowl: { at: [0, -0.46, 0.24], tilt: -14, prof: [[0, 0.32], [0.1, 0.52], [0.26, 0.66], [0.44, 0.71], [0.56, 0.72]], lobes: 9, lobe: 0.22, sharp: 0.6, wall: 0.07, sand: 0.12, heap: 0.26, spots: 5 },
  deco: [{ kind: 'spiral', az: -100, f: 0.45, r: 0.21, m: 'shell', m2: 'mark' }],
  legs: { x: 0.28, z: -0.12, ys: [0.36, 0.14, -0.08, -0.3], fan: [46, 16, -14, -44], upper: 0.34, lower: 0.48, reach: 0.45, thick: 0.14, arch: 0.2 },
  claw: { at: [0.22, 0.66, -0.2], arm: [0.36, 0.34], hand: [0.6, 0.66], rest: { fwd: 0.5, out: [0.2, 0.2], pitch: -40, open: 16 }, thick: 0.1 },
  gait: { sweep: [0.3, 0.38], duty: [0.6, 0.52], lift: [0.14, 0.18], bob: 0.085, sway: 2, rock: 1.5, trickle: 0 },
  strike: 0,
  size: 2.35,
};

/** A Sandpincher: a taller bowl heaped with sand, hung with spiral shells, a coral knob and plates of shell, and one claw far bigger than the other, carried out wide and open. */
const SANDPINCHER_LOOK: Sand = {
  body: { y: [-0.86, -0.5, 0.0, 0.5, 0.88, 1.12, 1.24], z: [0.4, 0.22, 0.06, 0.08, 0.13, 0.16, 0.16], w: [0.3, 0.52, 0.62, 0.64, 0.6, 0.5, 0.18], h: [0.24, 0.42, 0.48, 0.48, 0.45, 0.38, 0.14] },
  high: 0.72,
  face: { at: [0, 1.16, 0.2], r: [0.5, 0.21, 0.44] },
  eye: { root: [0.2, 1.02, 0.42], len: 0.3, r: 0.21, out: 30, lean: 22, stagger: 10 },
  bowl: {
    at: [0, -0.62, 0.26], tilt: -10, prof: [[0, 0.44], [0.18, 0.78], [0.5, 1.02], [0.9, 1.1], [1.14, 1.13]], lobes: 10, lobe: 0.3, sharp: 0.8, wall: 0.09, sand: 0.15, heap: 0.38, spots: 6,
  },
  deco: [
    { kind: 'spiral', az: 66, f: 0.66, r: 0.32, m: 'shell', m2: 'mark' },
    { kind: 'spiral', az: 92, f: 0.36, r: 0.27, m: 'shell', m2: 'crystal' },
    { kind: 'coral', az: 128, f: 0.5, r: 0.32, m: 'petal', m2: 'cap' },
    { kind: 'plate', az: -52, f: 0.5, r: 0.8, m: 'petal', m2: 'coatLight', flare: 22, spin: 200 },
    { kind: 'plate', az: 50, f: 0.48, r: 0.76, m: 'feather', m2: 'shell', flare: 22, spin: 160 },
    { kind: 'plate', az: -92, f: 0.22, r: 0.8, m: 'shell', m2: 'spot', flare: 4, spin: 0 },
    { kind: 'plate', az: 132, f: 0.2, r: 0.8, m: 'feather', m2: 'shell', flare: 0, spin: 0 },
    { kind: 'plate', az: -146, f: 0.24, r: 0.76, m: 'petal', m2: 'coatLight', flare: 4, spin: 0 },
  ],
  legs: { x: 0.4, z: -0.17, ys: [0.52, 0.2, -0.12, -0.44], fan: [46, 16, -14, -44], upper: 0.48, lower: 0.66, reach: 0.6, thick: 0.19, arch: 0.2 },
  claw: { at: [0.3, 0.92, -0.26], arm: [0.64, 0.6], hand: [0.62, 1.22], rest: { fwd: 0.45, out: [0.16, 0.3], pitch: -38, open: 18 }, thick: 0.14 },
  gait: { sweep: [0.42, 0.52], duty: [0.62, 0.52], lift: [0.18, 0.24], bob: 0.12, sway: 2.5, rock: 4, trickle: 0 },
  strike: 1,
  size: 2.3,
};

/** A Sandpinnacle: a heavy crab under a tall crown of shells round a great bowl of sand, two hood plates over its broad face, massive blotched claws, and thick legs. */
const SANDPINNACLE_LOOK: Sand = {
  body: { y: [-1.06, -0.6, 0.0, 0.62, 1.12, 1.46, 1.6], z: [0.5, 0.28, 0.07, 0.1, 0.16, 0.19, 0.19], w: [0.38, 0.66, 0.78, 0.8, 0.76, 0.62, 0.22], h: [0.3, 0.52, 0.6, 0.6, 0.56, 0.47, 0.17] },
  high: 0.9,
  face: { at: [0, 1.52, 0.24], r: [0.68, 0.26, 0.54] },
  eye: { root: [0.28, 1.26, 0.52], len: 0.38, r: 0.25, out: 30, lean: 22, stagger: 10 },
  bowl: {
    at: [0, -0.76, 0.32], tilt: -8, prof: [[0, 0.6], [0.22, 1.08], [0.66, 1.42], [1.2, 1.54], [1.56, 1.57]], lobes: 7, lobe: 0.6, sharp: 1.6, wall: 0.12, sand: 0.18, heap: 0.5, spots: 7,
  },
  deco: [
    // Two big spiral shells and two big knobs of coral and sponge, pink and yellow.
    { kind: 'spiral', az: 66, f: 0.6, r: 0.5, m: 'shell', m2: 'mark' },
    { kind: 'spiral', az: -108, f: 0.62, r: 0.46, m: 'shell', m2: 'crystal' },
    { kind: 'coral', az: 122, f: 0.46, r: 0.5, m: 'petal', m2: 'cap' },
    { kind: 'coral', az: -152, f: 0.42, r: 0.44, m: 'flame', m2: 'ember' },
    // Two great plates hanging from the front of the bowl and flared forward over its head, a hood, as drawn.
    { kind: 'plate', az: -20, f: 0.36, r: 1.0, m: 'petal', m2: 'coatLight', flare: 40, spin: 186 },
    { kind: 'plate', az: 22, f: 0.34, r: 0.96, m: 'feather', m2: 'shell', flare: 40, spin: 174 },
    // Fan plates lying low round its sides and back.
    { kind: 'plate', az: -84, f: 0.16, r: 1.08, m: 'shell', m2: 'spot', flare: 4, spin: 4 },
    { kind: 'plate', az: 92, f: 0.12, r: 1.04, m: 'petal', m2: 'coatLight', flare: 4, spin: -6 },
    { kind: 'plate', az: 172, f: 0.14, r: 1.06, m: 'feather', m2: 'shell', flare: 4, spin: -4 },
    // And standing up round its rim, the points of its crown: four, big.
    // The front left one leant in over the sand and swung a little toward the front, so from the left behind it shows its face and not its edge.
    { kind: 'plate', az: -58, f: 0.76, r: 1.16, m: 'feather', m2: 'shell', flare: -24, spin: 24, swing: -6 },
    { kind: 'plate', az: 56, f: 0.78, r: 1.12, m: 'shell', m2: 'spot', flare: 16, spin: -4 },
    { kind: 'plate', az: 138, f: 0.8, r: 1.1, m: 'petal', m2: 'coatLight', flare: 16, spin: 0 },
    { kind: 'plate', az: -140, f: 0.8, r: 1.12, m: 'shell', m2: 'spot', flare: 16, spin: 0 },
  ],
  legs: { x: 0.52, z: -0.2, ys: [0.66, 0.24, -0.18, -0.6], fan: [46, 16, -14, -44], upper: 0.62, lower: 0.84, reach: 0.76, thick: 0.26, arch: 0.18 },
  claw: { at: [0.38, 1.16, -0.3], arm: [0.92, 0.88], hand: [1.6, 1.8], rest: { fwd: 0.38, out: [0.24, 0.26], pitch: -40, open: 18 }, thick: 0.24 },
  gait: { sweep: [0.6, 0.72], duty: [0.66, 0.54], lift: [0.2, 0.26], bob: 0.15, sway: 3, rock: 5, trickle: 1 },
  strike: 2,
  size: 2.5,
};

/* ---- helpers --------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a heap of shells is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const DEG = Math.PI / 180;
const len = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

/** A frame from its three axes, as columns, at `t`. */
const frame = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A bone at `o` whose length runs along `dir`, its up as near `up` as is square to that. */
function aim(o: V3, dir: V3, up: V3): Xf {
  const Y = unit(dir);
  let Z = sub(up, scale(Y, dot(up, Y)));
  if (len(Z) < 1e-5) Z = sub([0, 1, 0], scale(Y, Y[1]));
  Z = unit(Z);
  return frame(cross(Y, Z), Y, Z, o);
}

/** A bone at `o` whose length runs along `dir`, lying in the plane square to `normal`, its up the way in that plane from `normal` round past its length. */
function inPlane(o: V3, dir: V3, normal: V3): Xf {
  const Y = unit(dir), Z = unit(cross(normal, Y));
  return frame(cross(Y, Z), Y, Z, o);
}

/**
 * Where the joint between two parts `a` and `b` long goes so the second ends
 * at `goal` from `root`: always out on the side `pole` is, which is fixed for
 * each limb, so a knee never flips from one side to the other.
 */
function kneeOf(root: V3, goal: V3, a: number, b: number, pole: V3): V3 {
  const d = sub(goal, root), L0 = Math.max(1e-6, len(d)), u = scale(d, 1 / L0);
  const L = clamp(L0, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const along = (a * a - b * b + L * L) / (2 * L), up = Math.sqrt(Math.max(0, a * a - along * along));
  const p = unit(sub(pole, scale(u, dot(pole, u))));
  return add(add(root, scale(u, along)), scale(p, up));
}

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

/** The ground's frame under the body: where it stands and the way it faces, but level. */
const heading = (x: number, y: number, yaw: number): Xf => joint(ROOT, [x, y, 0], 0, 0, yaw);
/** How far over the ground the lowest point of a claw put down on it is: touching it, never in it. */
const FLOOR = 0.002;
/** Over how far the ground takes a claw's weight, rather than all at once. */
const SOFT = 0.06;

/* ---- the bowl --------------------------------------------------------------------------- */

/** How high a scallop of the rim stands `th` round the bowl: nought in each notch, one at each crest. */
function scallop(B: Sand['bowl'], th: number): number {
  const u = frac((th / TAU) * B.lobes + 0.5);
  const s = Math.sin(Math.PI * u);
  return B.sharp < 1 ? s ** B.sharp : (1 - Math.abs(2 * u - 1)) ** B.sharp;
}

/** The bowl's outside `f` of the way up it (nought its foot, one the rim's notches), and the slope of it there. */
function profAt(B: Sand['bowl'], f: number): { z: number; r: number; dr: number } {
  const P = B.prof, H = P[P.length - 1][0], z = clamp(f) * H;
  let k = 0;
  while (k < P.length - 2 && P[k + 1][0] < z) k++;
  const u = clamp((z - P[k][0]) / (P[k + 1][0] - P[k][0]));
  return { z, r: lerp(P[k][1], P[k + 1][1], u), dr: (P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]) };
}

/** A point on the outside of the bowl, `az` degrees round from its front toward its right and `f` up it, and the way out of it there. */
function onBowl(B: Sand['bowl'], az: number, f: number): { p: V3; n: V3 } {
  const a = az * DEG, q = profAt(B, f), d: V3 = [Math.sin(a), Math.cos(a), 0];
  return { p: [d[0] * q.r, d[1] * q.r, q.z], n: unit([d[0], d[1], -q.dr]) };
}

/** The bowl as a solid that hides what is inside it or behind it, in its own frame: an egg a little inside its outside. */
function bowlSolid(B: Sand['bowl']): { c: V3; r: V3 } {
  const H = B.prof[B.prof.length - 1][0], R = Math.max(...B.prof.map((p) => p[1]));
  return { c: [0, 0, H * 0.56], r: [R * 0.9, R * 0.9, H * 0.52] };
}

/**
 * The bowl: a thick-walled pot of shell, narrow at its foot and swelling to
 * a scalloped rim, its wall darker inside, and golden sand filling it to a
 * little under the rim and heaped up in the middle; speckles of coral,
 * peach and pale blue on its outside in little clusters. With it, for each
 * corner, how much of the heap it is (so the heap can grow) and how much of
 * a scallop (so the rim can grow in as it evolves).
 */
function bowlOf(s: Sand, n: number): { mesh: Mesh; heap: number[]; lobe: number[] } {
  const B = s.bowl, P = B.prof, H = P[P.length - 1][0];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], heap: number[] = [], lobe: number[] = [];
  const ring = (z: (th: number) => number, r: (th: number) => number, hk: number, lk: (th: number) => number): number => {
    const base = v.length;
    for (let j = 0; j < n; j++) {
      const th = (j / n) * TAU;
      v.push([Math.sin(th) * r(th), Math.cos(th) * r(th), z(th)]);
      heap.push(hk);
      lobe.push(lk(th));
    }
    return base;
  };
  const band = (a: number, b: number, m: Mat, out: (c: V3) => V3): void => {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [a + j, a + j2, b + j2, b + j];
      const c = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25);
      f.push({ i: idx, m });
      want.push(out(c));
    }
  };
  const outward = (c: V3): V3 => unit([c[0], c[1], 0.15]);
  const inward = (c: V3): V3 => unit([-c[0], -c[1], 0.4]);
  // The outside, ring by ring from its foot, the top two rings lifted into the scallops and flared out at each crest.
  const outer: number[] = [];
  P.forEach(([z, r], k) => {
    const top = k === P.length - 1, next = k === P.length - 2;
    const lift = (th: number): number => (top ? 1 : next ? 0.3 : 0) * B.lobe * scallop(B, th);
    outer.push(ring((th) => z + lift(th), (th) => r + (top ? 0.06 * B.lobe * scallop(B, th) : 0), 0, lift));
  });
  // Its foot: a fan in to a point under it.
  const foot = v.length;
  v.push([0, 0, -0.02]);
  heap.push(0);
  lobe.push(0);
  for (let j = 0; j < n; j++) {
    f.push({ i: [foot, outer[0] + ((j + 1) % n), outer[0] + j], m: 'shell' });
    want.push([0, 0, -1]);
  }
  for (let k = 0; k < outer.length - 1; k++) band(outer[k], outer[k + 1], 'shell', outward);
  // Over the lip, and down the inside to the sand.
  const r1 = P[P.length - 1][1], lip = B.wall * 0.35;
  const inTop = ring((th) => H + B.lobe * scallop(B, th) - lip, (th) => r1 - B.wall + 0.06 * B.lobe * scallop(B, th), 0, (th) => B.lobe * scallop(B, th));
  band(outer[outer.length - 1], inTop, 'shell', (c) => unit([c[0] * 0.3, c[1] * 0.3, 1]));
  const zs = H - B.sand, rs = profAt(B, zs / H).r - B.wall;
  const inMid = ring(() => lerp(H - lip, zs, 0.5), () => lerp(r1 - B.wall, rs, 0.5), 0, () => 0);
  const edge = ring(() => zs, () => rs, 0, () => 0);
  band(inTop, inMid, 'shellDark', inward);
  band(inMid, edge, 'shellDark', inward);
  // The sand, heaped up from the wall to the middle, a few of its facets a darker gold.
  let last = edge;
  for (const rho of [0.78, 0.5, 0.24]) {
    const k = 1 - rho * rho, hz = zs + B.heap * k ** 0.85;
    const next = ring((th) => hz + 0.02 * B.heap * Math.sin(th * 3 + rho * 9), () => rs * rho, k, () => 0);
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [last + j, last + j2, next + j2, next + j], m: 'bloom' });
      want.push([0, 0, 1]);
    }
    last = next;
  }
  const top = v.length;
  v.push([0, 0, zs + B.heap]);
  heap.push(1);
  lobe.push(0);
  for (let j = 0; j < n; j++) {
    f.push({ i: [last + j, last + ((j + 1) % n), top], m: 'bloom' });
    want.push([0, 0, 1]);
  }
  // Blotches on the outside, big and soft, each three overlapping patches of one pale colour: coral, peach or blue.
  const spots: Disc[] = [];
  const mats: Mat[] = ['membrane', 'pad', 'water'];
  for (let q = 0; q < B.spots; q++) {
    const az = (q / B.spots) * 360 + 50 * (jitter(q + 3) - 0.5), ff = 0.28 + 0.4 * jitter(q + 11), r = B.wall * (3 + 1.2 * jitter(q * 5));
    for (let e = 0; e < 3; e++) {
      const at = onBowl(B, az + (e - 1) * (r / profAt(B, ff).r) * 30 * (0.6 + 0.6 * jitter(q * 3 + e)), ff + (e === 1 ? 0.06 : -0.04) * (0.5 + jitter(q + e)));
      const rr = r * (e === 1 ? 1 : 0.62 + 0.25 * jitter(q + e * 7));
      spots.push(disc(add(at.p, scale(at.n, 0.012 + 0.002 * e)), at.n, rr, rr * (0.6 + 0.25 * jitter(q * 7 + e)), 8, mats[q % 3], { spin: jitter(q + e) * 3 }));
    }
  }
  const m = mesh(v, wound(v, f, want));
  const sp = paint(spots);
  return { mesh: merge(m, sp), heap: [...heap, ...sp.v.map(() => 0)], lobe: [...lobe, ...sp.v.map(() => 0)] };
}

/* ---- what is on the bowl ----------------------------------------------------------------- */

/** A spiral shell, a whelk of four whorls banded in its two colours, standing out of the bowl along `z`, `r` across its mouth. */
function spiralOf(r: number, m: Mat, m2: Mat, n: number): Mesh {
  const rows: Array<[number, number]> = [[-0.2, 0.9], [0.1, 1], [0.42, 0.86], [0.55, 0.74], [0.8, 0.66], [0.92, 0.5], [1.12, 0.44], [1.22, 0.3], [1.38, 0.22], [1.5, 0.05]];
  const pts = rows.map(([z]) => [0, 0, z * r] as V3);
  const w = rows.map(([, k]) => k * r);
  return tube(pts, w, w, n, (ring) => (ring === 2 || ring === 5 || ring === 7 ? m2 : m), { up: [0, 1, 0] });
}

/** A knob of coral or sponge: a lumpy ball standing out of the bowl along `z`, pitted all over with dark holes. */
function coralOf(r: number, m: Mat, m2: Mat, n: number, k: number, seed: number): Mesh {
  const c: V3 = [0, 0, r * 0.75];
  const lumps = [orb(c, [r, r, r * 0.92], n, k, m)];
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + seed;
    lumps.push(orb(add(c, [Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.25]), r * 0.5, Math.max(5, n - 2), Math.max(3, k - 1), m));
  }
  const holes: Disc[] = [];
  for (let q = 0; q < 9; q++) {
    const d: V3 = [Math.cos(q * 2.4 + seed) * 0.8, Math.sin(q * 2.4 + seed) * 0.8, 0.35 + 0.6 * jitter(q + seed)];
    const at = onEgg(c, [r * 1.02, r * 1.02, r * 0.94], d);
    const h = r * (0.16 + 0.1 * jitter(q * 3 + seed));
    holes.push(disc(add(at.p, scale(at.n, 0.01)), at.n, h, h * 0.9, 6, m2));
  }
  return merge(...lumps, paint(holes));
}

/**
 * A fan of shell: a plate spread from its hinge at the foot like a scallop,
 * `r` from the hinge to its scalloped edge, ribbed in its two colours by
 * turns and cupped out a little, thin, and seen from either side.
 */
function plateOf(r: number, m: Mat, m2: Mat, ribs = 7): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const spread = 56 * DEG, thick = r * 0.07;
  const pt = (j: number, rho: number, back: boolean): V3 => {
    const a = -spread + (2 * spread * j) / ribs;
    // The edge scalloped: each rib's end a little further out than the notch between it and the next.
    const rr = r * rho * (rho >= 1 ? 1 + 0.05 * Math.cos(TAU * j / 2) : 1);
    // Cupped well out, as a scallop is, so seen edge on it is still a curve with a face to it and not a stick.
    const cup = r * 0.3 * Math.sin(Math.PI * rho * 0.9) * Math.cos(a * 0.8) + (j % 2 ? r * 0.03 * rho : 0);
    return [Math.sin(a) * rr, Math.cos(a) * rr, cup - (back ? thick : 0)];
  };
  const side = (back: boolean): { hinge: number; rows: number[][] } => {
    v.push([0, 0, back ? -thick : 0]);
    const hinge = v.length - 1, rows: number[][] = [];
    for (const rho of [0.5, 1]) {
      const row: number[] = [];
      for (let j = 0; j <= ribs; j++) { v.push(pt(j, rho, back)); row.push(v.length - 1); }
      rows.push(row);
    }
    const out: V3 = [0, 0, back ? -1 : 1];
    for (let j = 0; j < ribs; j++) {
      const mat = j % 2 ? m2 : m;
      f.push({ i: [hinge, rows[0][j], rows[0][j + 1]], m: mat });
      want.push(out);
      f.push({ i: [rows[0][j], rows[1][j], rows[1][j + 1], rows[0][j + 1]], m: mat });
      want.push(out);
    }
    return { hinge, rows };
  };
  const F = side(false), Bk = side(true);
  // Its rim, joining front and back round the edge and down the two sides.
  for (let j = 0; j < ribs; j++) {
    const a0 = F.rows[1][j], a1 = F.rows[1][j + 1], b0 = Bk.rows[1][j], b1 = Bk.rows[1][j + 1];
    f.push({ i: [a0, a1, b1, b0], m });
    want.push(unit([v[a0][0] + v[a1][0], v[a0][1] + v[a1][1], 0]));
  }
  for (const [j, sgn] of [[0, -1], [ribs, 1]] as Array<[number, number]>) {
    const a = -spread + (2 * spread * j) / ribs, out: V3 = [sgn * Math.cos(a), -sgn * Math.sin(a), 0];
    f.push({ i: [F.hinge, F.rows[0][j], Bk.rows[0][j], Bk.hinge], m });
    want.push(out);
    f.push({ i: [F.rows[0][j], F.rows[1][j], Bk.rows[1][j], Bk.rows[0][j]], m });
    want.push(out);
  }
  return mesh(v, wound(v, f, want));
}

/**
 * Everything stuck on the bowl, each in its place on the outside of it, in
 * the bowl's frame: grouped by which way round the bowl it is, each group a
 * piece that goes over the bowl while it is on the near side and under it
 * once it is round the far side. With each corner, the point it grows from.
 */
function decoOf(s: Sand, n: number, k: number): Array<{ mesh: Mesh; front: V3; anchor: V3[] }> {
  const B = s.bowl, groups = new Map<number, Array<{ mesh: Mesh; at: V3; n: V3 }>>();
  s.deco.forEach((d, q) => {
    const at = onBowl(B, d.az, d.f), sw = (d.swing ?? 0) * DEG;
    const nn: V3 = sw ? unit([at.n[0] * Math.cos(sw) + at.n[1] * Math.sin(sw), at.n[1] * Math.cos(sw) - at.n[0] * Math.sin(sw), at.n[2]]) : at.n;
    // Its own frame: out of the bowl along z, up the bowl along y.
    const Y0 = unit(sub([0, 0, 1], scale(nn, nn[2])));
    let local: Mesh;
    let Z = nn, Y = Y0;
    if (d.kind === 'plate') {
      // A plate lies along the bowl, its fan up and its edge flared out off it.
      const fl = (d.flare ?? 12) * DEG, sp = (d.spin ?? 0) * DEG;
      const X0 = cross(Y0, nn);
      const Ys = unit(add(scale(Y0, Math.cos(sp)), scale(X0, Math.sin(sp))));
      Y = unit(add(scale(Ys, Math.cos(fl)), scale(nn, Math.sin(fl))));
      Z = unit(sub(nn, scale(Y, dot(nn, Y))));
      local = plateOf(d.r, d.m ?? 'shell', d.m2 ?? 'spot');
    } else if (d.kind === 'spiral') {
      // A spiral shell's point turned up off square to the bowl, as one stuck on at a slant.
      Z = unit(add(nn, [0, 0, 0.5]));
      Y = unit(sub(Y0, scale(Z, dot(Y0, Z))));
      local = spiralOf(d.r, d.m ?? 'shell', d.m2 ?? 'mark', Math.max(6, n - 2));
    } else local = coralOf(d.r, d.m ?? 'petal', d.m2 ?? 'cap', Math.max(6, n - 2), k, q * 1.7);
    const X = cross(Y, Z);
    // Set into the bowl a little, so it sits on it and never floats.
    const root = sub(at.p, scale(nn, d.kind === 'plate' ? -0.01 : d.r * 0.12));
    const placed = mesh(local.v.map((p) => add(root, add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2])))), local.f);
    const key = Math.round((((d.az % 360) + 360) % 360) / 60) % 6;
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push({ mesh: placed, at: root, n: nn });
  });
  return [...groups.values()].map((list) => {
    const anchor: V3[] = [];
    for (const it of list) for (let q = 0; q < it.mesh.v.length; q++) anchor.push(it.at);
    const nn = unit(list.reduce((t, it) => add(t, it.n), [0, 0, 0] as V3));
    return { mesh: merge(...list.map((it) => it.mesh)), front: [nn[0], nn[1], 0], anchor };
  });
}

/* ---- the crab --------------------------------------------------------------------------- */

/**
 * The body: peach, in segments with a darker crease between each, from
 * inside the shell out to its head, with the cream plate over its face and a
 * pair of little mouthparts under it.
 */
function bodyOf(s: Sand, n: number, k: number): Mesh {
  const R = s.body, y0 = R.y[0], y1 = R.y[R.y.length - 1];
  const at = (y: number, q: 'w' | 'h' | 'z'): number => {
    let i = 0;
    while (i < R.y.length - 2 && R.y[i + 1] < y) i++;
    return lerp(R[q][i], R[q][i + 1], clamp((y - R.y[i]) / (R.y[i + 1] - R.y[i])));
  };
  // Three segments along it, each with a crease: two rings a little in at each.
  const ys: number[] = [], pinch: boolean[] = [];
  const segs = 3;
  for (let q = 0; q <= segs; q++) {
    const y = lerp(y0, y1 - (y1 - y0) * 0.18, q / segs);
    ys.push(y - 0.025, y + 0.025);
    pinch.push(true, true);
    if (q < segs) { ys.push(y + (y1 - y0) * 0.13); pinch.push(false); }
  }
  ys.push(y1 - (y1 - y0) * 0.06, y1);
  pinch.push(false, false);
  const pts = ys.map((y) => [0, y, at(y, 'z')] as V3);
  const ws = ys.map((y, q) => at(y, 'w') * (pinch[q] ? 0.9 : 1)), hs = ys.map((y, q) => at(y, 'h') * (pinch[q] ? 0.9 : 1));
  const trunk = tube(pts, ws, hs, n, (ring) => (pinch[ring] && pinch[ring + 1] ? 'coatDark' : 'coat'), { up: [0, 0, 1] });
  // The cream plate over its face, in three: a broad brow plate and two cheeks under it.
  const F = s.face;
  const plate = merge(
    // A rounded shield over the front of the head, turned a little up so it shows from above.
    orbAlong(F.at, [0, 1, 0.3], [F.r[0], F.r[2], F.r[1]], n, k, 'muzzle'),
    // And a smaller plate either side under it, the cheeks.
    ...[1, -1].map((sd) => orbAlong(add(F.at, [sd * F.r[0] * 0.62, -F.r[1] * 0.4, -F.r[2] * 0.55]), [sd * 0.4, 1, 0], [F.r[0] * 0.42, F.r[2] * 0.42, F.r[1] * 0.8], Math.max(6, n - 2), Math.max(3, k - 1), 'muzzle')),
  );
  // A dark seam down the middle of the shield and one across it, so it reads as plates and not as a cream ball.
  const seam = onEgg(F.at, [F.r[0], F.r[1], F.r[2]], [0, 1, 0.1]);
  const lines = paint([
    disc(add(seam.p, scale(seam.n, 0.01)), seam.n, F.r[0] * 0.05, F.r[2] * 0.62, 6, 'coatDark', { up: [0, 0, 1] }),
  ]);
  // The little mouthparts under the plate, peach.
  const mouth = merge(...[1, -1].map((sd) => tube([add(F.at, [sd * F.r[0] * 0.22, 0, -F.r[2] * 0.8]), add(F.at, [sd * F.r[0] * 0.3, F.r[1] * 1.2, -F.r[2] * 1.15])],
    [F.r[0] * 0.18, F.r[0] * 0.1], [F.r[0] * 0.18, F.r[0] * 0.1], 5, 'coatDark')));
  return merge(trunk, plate, lines, mouth);
}

/**
 * An eye on its stalk, along the bone's `z`: a peach stalk with a peach
 * collar under a big glossy black eye, a glint on its front, a small one on
 * its side and one on its crown, so it is lit from behind too.
 */
function eyeOf(s: Sand, n: number, k: number): Mesh {
  const E = s.eye, r = E.r;
  const c: V3 = [0, 0.02, E.len + r * 0.75];
  const stalk = tube([[0, 0, -0.06], [0, 0, E.len * 0.5], [0, 0.01, E.len + r * 0.2]], [r * 0.44, r * 0.36, r * 0.42], [r * 0.44, r * 0.36, r * 0.42], 6, 'coat');
  // The collar: a flat peach ring round the bottom of the ball where the stalk meets it, so from any side the eye is a black ball on
  // a peach stalk.
  const cup = orb(add(c, [0, 0, -r * 0.85]), [r * 0.7, r * 0.7, r * 0.3], n, k, 'coat');
  const ball = orb(c, [r * 0.95, r, r], n, k, 'eye');
  const R: V3 = [r * 0.95, r, r];
  const g1 = onEgg(c, R, [0, 0.85, 0.5]), g2 = onEgg(c, R, [0.35, 0.9, -0.15]), g3 = onEgg(c, R, [-0.2, -0.35, 1]);
  const glints = paint([
    disc(add(g1.p, scale(g1.n, 0.01)), g1.n, r * 0.4, r * 0.34, 7, 'glint', { lit: true }),
    disc(add(g2.p, scale(g2.n, 0.01)), g2.n, r * 0.15, r * 0.15, 5, 'glint', { lit: true }),
    disc(add(g3.p, scale(g3.n, 0.01)), g3.n, r * 0.24, r * 0.2, 6, 'glint', { lit: true }),
  ]);
  return merge(stalk, cup, ball, glints);
}

/** Where on a hand its fixed finger's tip is, in the hand's frame: what is put on the ground or at what it pinches. */
const tipOf = (h: number): V3 => [0, h * 1.35, -h * 0.06];
/** Where on a hand the movable finger is hinged. */
const hingeOf = (h: number): V3 => [0, h * 0.6, h * 0.22];

/** Blotches of colour on a claw: each two or three soft overlapping discs of one colour, irregular, laid onto an egg. */
function blotches(c: V3, r: V3, list: ReadonlyArray<[V3, number, Mat]>, seed: number): Mesh {
  const out: Disc[] = [];
  list.forEach(([dir, size, m], q) => {
    for (let e = 0; e < 3; e++) {
      const d = add(dir, [0, 0.25 * (jitter(seed + q * 7 + e) - 0.5), 0.3 * (jitter(seed + q * 5 + e + 3) - 0.5)]);
      const at = onEgg(c, r, d), sz = size * (e ? 0.6 + 0.2 * jitter(seed + q + e) : 1);
      out.push(disc(add(at.p, scale(at.n, 0.008 + 0.002 * e)), at.n, sz, sz * (0.7 + 0.25 * jitter(seed + q * 3 + e)), 7, m, { spin: jitter(seed + q + e * 2) * 3 }));
    }
  });
  return paint(out);
}

/**
 * A hand, along the bone's `y` from the wrist with its movable finger on
 * top: a broad flat palm, deep from top to bottom and thin from side to
 * side, cream with big coral and peach blotches; and the fixed finger, long
 * and curved, out of the bottom of its end and sweeping up to a peach tip.
 */
function handOf(h: number, n: number, k: number, seed: number): Mesh {
  const c: V3 = [0, h * 0.36, 0], r: V3 = [h * 0.2, h * 0.42, h * 0.38];
  const palm = orbAlong(c, [0, 1, 0], [r[0], r[2], r[1]], n, k, 'horn');
  const wrist = tube([[0, -h * 0.06, 0], [0, h * 0.1, 0]], h * 0.15, h * 0.2, 6, 'horn');
  const finger = tube([[0, h * 0.58, -h * 0.18], [0, h * 0.86, -h * 0.25], [0, h * 1.12, -h * 0.22], [0, h * 1.27, -h * 0.13], tipOf(h)],
    [h * 0.16, h * 0.14, h * 0.1, h * 0.06, h * 0.015], [h * 0.19, h * 0.15, h * 0.1, h * 0.06, h * 0.015], 6, (ring) => (ring >= 2 ? 'hornDark' : 'horn'));
  const marks = blotches(c, r, [
    [[1, -0.2, 0.35], h * 0.15, 'mark'], [[1, 0.45, -0.25], h * 0.12, 'spot'], [[0.8, -0.55, -0.45], h * 0.1, 'crystal'],
    [[-1, 0.1, 0.3], h * 0.15, 'mark'], [[-1, -0.5, -0.3], h * 0.12, 'spot'], [[0.25, 0.05, 1], h * 0.11, 'mark'],
  ], seed);
  return merge(wrist, palm, finger, marks);
}

/** The movable finger, from its hinge along `y`: thick at the hinge, curving down to a peach tip that meets the fixed one shut. */
function nipOf(h: number): Mesh {
  return tube([[0, -h * 0.05, 0], [0, h * 0.28, h * 0.04], [0, h * 0.54, -h * 0.07], [0, h * 0.75, -h * 0.28]], [h * 0.15, h * 0.13, h * 0.08, h * 0.015], [h * 0.17, h * 0.13, h * 0.08, h * 0.015], 6,
    (ring) => (ring >= 2 ? 'hornDark' : 'horn'));
}

/** A leg's upper part, along `y` from its hip into the body to its knee: peach, chunky, a cream band at the knee. */
function upperOf(s: Sand): Mesh {
  const L = s.legs.upper, w = s.legs.thick;
  return tube([[0, -w * 1.2, 0], [0, L * 0.2, 0], [0, L * 0.82, 0], [0, L + w * 0.3, 0]], [w, w * 1.05, w * 0.95, w * 0.85], [w, w * 1.05, w * 0.95, w * 0.85], 6,
    (ring) => (ring === 2 ? 'muzzle' : 'coat'), { seam: 'start' });
}

/**
 * A leg's lower part, from the knee along `y` to the tip of its foot,
 * arched up between them (along `z`): two segments of cream shell with a
 * peach crease between them, and a peach tip.
 */
function lowerOf(s: Sand): Mesh {
  const L = s.legs.lower, w = s.legs.thick * 0.9, A = s.legs.arch * L;
  const pts: V3[] = [[0, -w * 0.4, 0], [0, L * 0.3, A * 0.8], [0, L * 0.5, A], [0, L * 0.56, A * 0.97], [0, L * 0.82, A * 0.55], [0, L - 0.012, 0.016]];
  const ws = [w * 0.95, w, w * 0.84, w * 0.82, w * 0.55, 0.008];
  return tube(pts, ws, ws, 6, (ring) => (ring === 2 ? 'coatDark' : ring >= 4 ? 'hornDark' : 'muzzle'));
}

/** How high a leg's lower part arches `f` of the way down it, against its full arch (`lowerOf`). */
function archAt(f: number): number {
  const P: Array<[number, number]> = [[0, 0], [0.3, 0.8], [0.5, 1], [0.56, 0.97], [0.82, 0.55], [1, 0]];
  let k = 0;
  while (k < P.length - 2 && P[k + 1][0] < f) k++;
  return lerp(P[k][1], P[k + 1][1], clamp((f - P[k][0]) / (P[k + 1][0] - P[k][0])));
}

/** Blotches on the legs, coral pink on the cream of the lower parts and sandy on the peach of the upper, round the outside, painted. */
function legSpots(s: Sand, part: 'upper' | 'lower'): Mesh {
  const L = part === 'upper' ? s.legs.upper : s.legs.lower, w = s.legs.thick * (part === 'upper' ? 1 : 0.9), out: Disc[] = [];
  const spots: Array<[number, number]> = part === 'upper' ? [[0.45, Math.PI / 2]] : [[0.28, Math.PI / 2 + 0.3], [0.66, Math.PI / 2 - 0.5]];
  spots.forEach(([f, a], q) => {
    const y = L * f, n: V3 = [Math.cos(a), 0, Math.sin(a)];
    const arch = part === 'lower' ? s.legs.arch * L * archAt(f) : 0;
    const sz = w * (0.5 + 0.12 * (q % 2));
    out.push(disc(add([0, y, arch], scale(n, w * 1.04)), n, sz, sz * 1.25, 7, part === 'upper' ? 'spot' : q % 3 === 2 ? 'spot' : 'mark', { spin: q }));
  });
  return paint(out);
}

/* ---- its moves --------------------------------------------------------------------------- */

/** The strike: when it is gathered, when the claw lands, and when it lets go. */
const STRIKE = { gather: 0.46, hit: 0.58, hold: 0.68 };
/**
 * A go at its task: the claws at the ground ahead, dragged back along it
 * full of sand, lifted up over its face, the sand tossed back into the bowl,
 * landing on the heap, and the claws back down to the ground ahead.
 */
const WORK = { dig: 0.12, scoop: 0.26, lift: 0.52, toss: 0.56, land: 0.68, back: 1 };

/** How far into its task it is: eased in and out of a go played once, and held while it works on (the real `graze`). */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.74, 1)));

/** A claw's pose: where its fixed finger's tip is, in the ground's frame under the body; how its hand is turned; how far open it is. */
interface Claw { tip: V3; pitch: number; yaw: number; roll: number; open: number }
const mixClaw = (a: Claw, b: Claw, t: number): Claw => ({
  tip: [lerp(a.tip[0], b.tip[0], t), lerp(a.tip[1], b.tip[1], t), lerp(a.tip[2], b.tip[2], t)],
  pitch: lerp(a.pitch, b.pitch, t), yaw: lerp(a.yaw, b.yaw, t), roll: lerp(a.roll, b.roll, t), open: lerp(a.open, b.open, t),
});

/** Everything that is posed, before the bones are worked out from it. */
interface Pose {
  /** The body over the ground: along, up, and its turns (degrees). */
  y: number; z: number; pitch: number; roll: number; yaw: number;
  /** The shell's own rock on the body. */
  rockP: number; rockR: number;
  claws: [Claw, Claw];
  /** Each eye stalk's own turn: forward, out. */
  eyes: [[number, number], [number, number]];
  /** How much higher the heap stands, and how far the shell's things have grown in (one, all grown). */
  heap: number; crown: number;
}

/** How big a stage is against the Sandpip, for what is posed in lengths. */
const kOf = (s: Sand): number => s.high / SANDPIP_LOOK.high;

/** How far a claw reaches: its arm and its big hand to the tip of the finger. Every move of a claw is posed in this, so it is in reach whatever the stage. */
const clawLen = (s: Sand, sd = 1): number => s.claw.arm[0] + s.claw.arm[1] + 1.35 * s.claw.hand[sd > 0 ? 1 : 0];
/**
 * A claw put down on the ground: its wrist `fwd` of the arm's length ahead
 * of the shoulder and `out` to its side, let down until the tip of its
 * finger, its hand tipped down by `pitch`, is on the ground. Within reach by
 * how it is made, whatever the size of the hand.
 */
function groundAt(s: Sand, sd: number, fwd: number, out: number, pitch: number, open: number, yaw = 0, roll = 12): Claw {
  const C = s.claw.at, A = s.claw.arm[0] + s.claw.arm[1], h = s.claw.hand[sd > 0 ? 1 : 0];
  const tip = place(joint(ROOT, [0, 0, 0], pitch, sd * roll, sd * yaw), tipOf(h));
  return { tip: [sd * (C[0] + out * A) + tip[0], C[1] + fwd * A + tip[1], 0], pitch, yaw: sd * yaw, roll: sd * roll, open };
}

/** A claw at rest: its finger's tip on the ground ahead and out to its side, the hand stood up on it. */
const restClaw = (s: Sand, sd: number): Claw => groundAt(s, sd, s.claw.rest.fwd, s.claw.rest.out[sd > 0 ? 1 : 0], s.claw.rest.pitch, s.claw.rest.open, 8, 12);

/**
 * A claw posed by where its wrist goes: `fwd` and `up` of the arm's length
 * from the shoulder as the body stands, `out` further to its side, the hand
 * tipped up by `pitch` from there. What a raised claw is posed by, so its arm
 * is never folded up against its shoulder however big its hand.
 */
function wristAt(s: Sand, sd: number, fwd: number, up: number, out: number, pitch: number, open: number, yaw = 0, roll = 12): Claw {
  const C = s.claw.at, A = s.claw.arm[0] + s.claw.arm[1], h = s.claw.hand[sd > 0 ? 1 : 0];
  const hand = joint(ROOT, [0, 0, 0], pitch, sd * roll, sd * yaw), tip = place(hand, tipOf(h));
  return { tip: [sd * (C[0] + out * A) + tip[0], C[1] + fwd * A + tip[1], s.high + C[2] + up * A + tip[2]], pitch, yaw: sd * yaw, roll: sd * roll, open };
}

/** The pose standing, before anything else: breathing, its eyes wandering, now and then a claw opened and shut. */
function standPose(s: Sand, a: Anim): Pose {
  const t = a.t, k = kOf(s), still = 1 - a.go;
  const click = beat(t, [3.1, 9.6, 15.3, 21.2], 0.7) * still, wave = beat(t, [6.6, 18.4], 1.4) * still;
  const claws = [restClaw(s, -1), restClaw(s, 1)] as [Claw, Claw];
  claws[1] = { ...claws[1], open: claws[1].open + 26 * click };
  // Now and then the big claw lifted off the ground and waved a little, opening and shutting.
  claws[1] = mixClaw(claws[1], wristAt(s, 1, 0.5, 0.32, 0.24, -6, 22 + 14 * Math.sin(t * TAU * 2), 0, 12), wave);
  return {
    y: 0, z: s.high + 0.012 * k * cyc(t, 7), pitch: 0.6 * cyc(t, 7, 1), roll: 0, yaw: 0,
    rockP: 0, rockR: 0.6 * cyc(t, 3) * still,
    claws,
    eyes: [[6 * cyc(t, 5, 0.4) * still, 8 * cyc(t, 4, 1.1) * still], [6 * cyc(t, 5, 2.1) * still, 8 * cyc(t, 3, 0.3) * still]],
    heap: 0, crown: 1,
  };
}

/**
 * Going: the body carried over its feet, dipping each time a set of four
 * comes down and rolling a little over them; the shell swaying behind it
 * and rocking, a little after the body; the claws held up off the ground and
 * swinging a little; the eyes forward. A Sandpip skitters, a Sandpincher's
 * shell sways, a Sandpinnacle marches heavily, its crown rocking.
 */
function goPose(s: Sand, p: Pose, a: Anim): void {
  const g = smooth(a.go), G = s.gait, w = frac(a.u), run = a.gait, k = kOf(s);
  if (g <= 0) return;
  const bob = G.bob * (1 + 0.15 * run);
  // Lowest just after each set of four comes down, at nought and half a stride.
  p.z -= g * (bob * (0.5 + 0.5 * Math.cos(TAU * 2 * w - 0.6)) + 0.04 * k * run);
  p.pitch += g * (-2 * run + 1.2 * Math.sin(TAU * 2 * w - 1.2));
  p.roll += g * G.sway * Math.sin(TAU * w);
  p.rockR += g * G.rock * Math.sin(TAU * w - 0.9);
  p.rockP += g * G.rock * 0.5 * Math.sin(TAU * 2 * w - 1.6);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, c = p.claws[q];
    // Held up off the ground before it, swinging with the stride; tucked in at a run.
    const held: Claw = { ...c, tip: add(c.tip, [-sd * 0.04 * k * run, (-0.1 - 0.12 * run) * k + 0.05 * k * Math.sin(TAU * w + q * Math.PI), (0.14 + 0.1 * run) * k + 0.03 * k * Math.sin(TAU * 2 * w + q)]), pitch: c.pitch + 18 + 10 * run, open: 4 };
    p.claws[q] = mixClaw(c, held, g);
    p.eyes[q] = [lerp(p.eyes[q][0], -10 - 8 * run, g), lerp(p.eyes[q][1], 4, g)];
  }
}

/**
 * A claw's keypose at a moment of an act. A key that `stops` is held still
 * there (the ends of a go, the top of a hold); a key that `lands` is a blow,
 * reached at full speed and left from rest, the one place a claw's speed may
 * jump.
 */
interface Key { t: number; c: Claw; stops?: boolean; lands?: boolean }
/** Where a claw posed so has its wrist, for a hand `h` long: the tip less the hand turned as it is. */
const wristOf = (c: Claw, h: number): V3 => sub(c.tip, place(joint(ROOT, [0, 0, 0], c.pitch, c.roll, c.yaw), tipOf(h)));
/** A claw as numbers to be eased between, by its wrist rather than its tip, so a hand turns about its wrist and its arm is not folded up through its shoulder as it does. */
const fieldsOf = (c: Claw, h: number): number[] => [...wristOf(c, h), c.pitch, c.yaw, c.roll, c.open];
function clawOf(v: number[], h: number): Claw {
  const c: Claw = { tip: [0, 0, 0], pitch: v[3], yaw: v[4], roll: v[5], open: v[6] };
  return { ...c, tip: add([v[0], v[1], v[2]], place(joint(ROOT, [0, 0, 0], c.pitch, c.roll, c.yaw), tipOf(h))) };
}

/**
 * A claw `t` through an act: a monotone Hermite spline through its
 * keyposes, so it passes through each without stopping and its speed never
 * jumps between them (and never overshoots one, which a claw on the ground
 * would put through it).
 */
function along(keys: readonly Key[], t: number, h: number): Claw {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].c;
  if (t >= keys[n - 1].t) return keys[n - 1].c;
  let i = 0;
  while (i < n - 2 && keys[i + 1].t <= t) i++;
  const P = keys.map((k) => fieldsOf(k.c, h));
  const slope = (j: number, f: number): number => (P[j + 1][f] - P[j][f]) / (keys[j + 1].t - keys[j].t);
  // The way each key is passed: still at an end or a hold; at the speed it came in at, on a blow; and otherwise the mean of the
  // two sides, nought where it turns back, and never so fast it overshoots.
  const tangent = (j: number, f: number, leaving: boolean): number => {
    const K = keys[j];
    if (K.stops || j === 0 || j === n - 1) return 0;
    if (K.lands) return leaving ? 0 : 1.5 * slope(j - 1, f);
    const a = slope(j - 1, f), b = slope(j, f);
    if (a * b <= 0) return 0;
    const m = (a * (keys[j + 1].t - keys[j].t) + b * (keys[j].t - keys[j - 1].t)) / (keys[j + 1].t - keys[j - 1].t);
    return Math.sign(m) * Math.min(Math.abs(m), 3 * Math.abs(a), 3 * Math.abs(b));
  };
  const u = (t - keys[i].t) / (keys[i + 1].t - keys[i].t), u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d = keys[i + 1].t - keys[i].t;
  return clawOf(P[i].map((p0, f) => h00 * p0 + h10 * d * tangent(i, f, true) + h01 * P[i + 1][f] + h11 * d * tangent(i + 1, f, false)), h);
}

/** A strike, by stage: a quick pinch; a big-claw snap with a lunge, thrown wide and sideways; both claws raised high beside the crown and brought down in a crush, the shell rearing. */
function strikePose(s: Sand, p: Pose, t: number): void {
  const k = kOf(s), R = [restClaw(s, -1), restClaw(s, 1)];
  const gather = ramp(t, 0, STRIKE.gather) * (1 - ramp(t, STRIKE.gather, STRIKE.hit));
  const thrust = ramp(t, STRIKE.gather, STRIKE.hit) * (1 - ramp(t, STRIKE.hold, 1));
  // The jolt of the blow: in over the last moment before it lands, and dying away after.
  const land = ramp(t, STRIKE.hit - 0.05, STRIKE.hit + 0.06) * (1 - ramp(t, STRIKE.hit + 0.06, 0.95));
  // The shell's own rock: back as it gathers, let go more slowly than the claw comes over, and thrown forward by the blow.
  const rear = ramp(t, 0, STRIKE.gather) * (1 - ramp(t, STRIKE.gather, STRIKE.hit + 0.08));
  if (s.strike < 2) {
    const big = s.strike === 1;
    // Drawn back, the claw raised high and out past the bowl and opened wide; thrown forward and snapped shut at the blow -- the
    // Sandpincher's swung in from the side -- held a moment, tugging; and back. The shell rocked back as it gathers and thrown
    // forward at the blow, which with the claw up beside the bowl is what shows of it from behind.
    p.y += k * ((big ? -0.08 : -0.06) * gather + (big ? 0.16 : 0.12) * thrust);
    p.z += k * (0.03 * gather - 0.03 * thrust);
    p.pitch += (big ? 8 : 6) * gather - (big ? 5 : 3) * thrust;
    p.roll += (big ? -5 : -3) * gather;
    p.yaw += (big ? 8 : 6) * gather - (big ? 6 : 4) * thrust;
    p.rockP += 14 * rear - 7 * land;
    p.rockR += (big ? 6 : 5) * rear - (big ? 4 : 3) * land;
    const raised = big ? wristAt(s, 1, 0.1, 0.5, 0.74, -16, 50, -16, 14) : wristAt(s, 1, 0.1, 0.74, 0.5, 22, 44, -22, 14);
    const shut = wristAt(s, 1, 0.66, 0.12, -0.04, big ? -16 : 4, -4, big ? -24 : -10, 4);
    const tug = { ...shut, tip: add(shut.tip, [0, -0.04 * clawLen(s), 0.01 * clawLen(s)]) };
    p.claws[1] = along([{ t: 0, c: R[1] }, { t: STRIKE.gather, c: raised }, { t: STRIKE.hit, c: shut, lands: true }, { t: STRIKE.hold, c: tug, stops: true }, { t: 1, c: R[1] }], t, s.claw.hand[1]);
    // The other claw lifted a little, ready.
    p.claws[0] = mixClaw(R[0], wristAt(s, -1, 0.45, 0.3, 0.15, 10, 24, 4, 10), gather + 0.6 * thrust);
  } else {
    // Reared up, both claws raised high beside the crown and opened; the shell rocked back; then both brought down together on
    // the ground before it, the body pitched down over them, the shell lurching forward and bouncing.
    p.y += k * (-0.06 * gather + 0.08 * thrust);
    p.z += k * (0.06 * gather - 0.04 * thrust);
    p.pitch += 9 * gather - 4 * thrust;
    p.rockP += 12 * rear - 6 * land;
    p.rockR += 2.5 * land * Math.sin((t - STRIKE.hit) * 40);
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1;
      const up = wristAt(s, sd, 0.05, 0.48, 0.68, -34, 20, -12, 12);
      const crush = groundAt(s, sd, 0.42, 0.08, -40, -2, -4, 10);
      p.claws[q] = along([{ t: 0, c: R[q] }, { t: STRIKE.gather, c: up }, { t: STRIKE.hit, c: crush, lands: true }, { t: STRIKE.hold, c: crush, stops: true }, { t: 1, c: R[q] }], t, s.claw.hand[q]);
    }
  }
  // The eyes drawn back on their stalks at the blow, so they stay up over the front of the rim as the shell comes forward.
  for (const e of p.eyes) e[0] += -10 * gather - 6 * thrust + 14 * land;
}

/**
 * A go at its task: the claws reached out to the ground ahead and dragged
 * back along it scooping up sand, lifted up over its face, the sand tossed
 * back over its head into the bowl, the heap there growing as it lands and
 * settling again, and the claws down to the ground ahead for the next. Each
 * claw goes along one spline through all of it (`along`).
 */
function workPose(s: Sand, p: Pose, t: number, graze: number): void {
  const d = downOf(t, graze), k = kOf(s), R = [restClaw(s, -1), restClaw(s, 1)];
  const lift = ramp(t, WORK.scoop, WORK.lift) * (1 - ramp(t, WORK.land, WORK.back));
  p.pitch += d * (-7 + 10 * lift);
  p.z -= d * 0.05 * k * (1 - lift);
  p.y += d * 0.04 * k * (1 - lift);
  // The toss and the sand landing: the shell rocked back as the sand goes over, and shaken as it lands.
  p.rockP += d * (3 * hump(t, WORK.toss + 0.02, 0.08) - 2.5 * hump(t, WORK.land + 0.03, 0.08));
  p.rockR += d * 2 * Math.sin((t - WORK.land) * 40) * hump(t, WORK.land + 0.06, 0.08);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    // Out on the ground ahead, opened; dragged back along it full of sand, the hand tipped flat to hold it; lifted over its face,
    // fingers up; flicked open at the toss; and down, out round beside its face and onto the ground ahead again. Played once, it
    // starts from where the claw stands and ends there; working on, it starts and ends on the ground ahead.
    const reach = groundAt(s, sd, 0.42, 0.14, -36, 30, 6, 8);
    const scooped = groundAt(s, sd, 0.4, 0.1, -22, 8, -6, 18);
    // Rolled outward over its face, so seen from behind the tips lean out rather than standing up like horns.
    const over = wristAt(s, sd, 0.36, 0.47, 0.04, 18, 12, -8, 28);
    const flick = wristAt(s, sd, 0.34, 0.49, 0.04, 24, 24, -8, 28);
    const end = mixClaw(R[q], reach, graze);
    const down = mixClaw(over, end, 0.5);
    p.claws[q] = along([
      { t: 0, c: end }, { t: WORK.dig, c: reach }, { t: WORK.scoop, c: scooped }, { t: WORK.lift, c: over }, { t: (WORK.lift + WORK.land) / 2, c: flick },
      { t: WORK.land, c: over }, { t: (WORK.land + WORK.back) / 2, c: { ...down, tip: add(down.tip, [sd * 0.08 * clawLen(s), 0, 0]) } }, { t: WORK.back, c: end },
    ], t, s.claw.hand[q]);
  }
  // The heap grows as the sand lands on it, and settles slowly back.
  p.heap += d * ramp(t, WORK.land - 0.02, WORK.land + 0.1) * (1 - ramp(t, 0.8, 1));
  for (const e of p.eyes) { e[0] += d * (14 - 20 * lift); }
}

/**
 * Evolving: crouched low under the burst it changes in, drawn up tall with
 * its claws raised and opened as the light gathers, shaken at the flash, and
 * settled with a clack of its claws; its crown of shells growing in on its
 * bowl until the flash.
 */
function evolvePose(s: Sand, p: Pose, t: number): void {
  const k = kOf(s);
  const crouch = ramp(t, 0, 0.08) * (1 - ramp(t, 0.12, 0.3)), up = ramp(t, 0.14, 0.45) * (1 - ramp(t, 0.6, 0.85)), shake = hump(t, 0.52, 0.1);
  p.z += k * (-0.06 * crouch + 0.08 * up);
  p.pitch += 8 * up;
  p.roll += 3 * shake * Math.sin(t * 60);
  p.rockP += 4 * up - 4 * hump(t, 0.82, 0.06);
  p.rockR += 2.5 * shake * Math.sin(t * 60 + 1);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, c = p.claws[q];
    const raised = wristAt(s, sd, 0.4, 0.55, 0.25, 10, 36, 20, 22);
    p.claws[q] = mixClaw(c, raised, up);
  }
  p.crown = ramp(t, 0.06, 0.5);
}

/** A stage's pose this moment: standing, going, and whatever it is doing. */
function poseOf(s: Sand, a: Anim): Pose {
  const p = standPose(s, a);
  goPose(s, p, a);
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
  else if (a.graze > 0 && a.go < 1) workPose(s, p, 0, a.graze * (1 - a.go));
  return p;
}

/* ---- its bones -------------------------------------------------------------------------- */

/** Where the right of each leg's hip is on the body, front to back. */
const hipOf = (s: Sand, i: number, sd: number): V3 => [sd * s.legs.x, s.legs.ys[i], s.legs.z];
/** Which of the two sets of four a leg is in: the front and third on one side with the second and back on the other. */
const setOf = (i: number, sd: number): number => (i + (sd > 0 ? 0 : 1)) % 2;

/**
 * Where a foot is on the ground: standing, out from its hip by `reach` and
 * fanned round; going, swept back evenly under the body while it is down and
 * lifted and brought forward again while it is not, its set of four by turns
 * with the other -- so four feet are always down, and each stays where it
 * was put while it is.
 */
function footOf(s: Sand, i: number, sd: number, a: Anim): V3 {
  const L = s.legs, fan = L.fan[i] * DEG, h = hipOf(s, i, sd);
  const rest: V3 = [h[0] + sd * Math.cos(fan) * L.reach, h[1] + Math.sin(fan) * L.reach, 0];
  if (a.go <= 0) return rest;
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

/**
 * How far under the wrist the lowest of a hand and its movable finger is,
 * posed so: the bottom of the palm's egg, and of each joint of its fingers
 * as a ball of its thickness. What keeps a claw on the ground and never in it.
 */
function lowOf(hand: Xf, h: number, open: number): number {
  const m = hand.m, w = hand.t[2];
  let lo = hand.t[2] - Math.hypot(m[6] * h * 0.2, m[7] * h * 0.42, m[8] * h * 0.38) + m[7] * h * 0.36;
  for (const [p, r] of [[[0, h * 0.58, -h * 0.18], h * 0.19], [[0, h * 0.86, -h * 0.25], h * 0.15], [[0, h * 1.12, -h * 0.22], h * 0.1], [[0, h * 1.27, -h * 0.13], h * 0.06], [tipOf(h), h * 0.015]] as Array<[V3, number]>) {
    lo = Math.min(lo, place(hand, p)[2] - r);
  }
  const nip = joint(hand, hingeOf(h), open, 0, 0);
  for (const [p, r] of [[[0, h * 0.28, h * 0.04], h * 0.17], [[0, h * 0.54, -h * 0.07], h * 0.08], [[0, h * 0.75, -h * 0.28], h * 0.015]] as Array<[V3, number]>) {
    lo = Math.min(lo, place(nip, p)[2] - r);
  }
  return lo - w;
}

/** The bones of a stage, worked out from its pose: body, shell, eyes, claws by reaching for their tips, legs by reaching for their feet. */
function sandBones(s: Sand): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [0, p.y, p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    const B = s.bowl;
    b.shell = joint(body, B.at, B.tilt + p.rockP, p.rockR, 0);
    const ground = heading(0, p.y, p.yaw), up: V3 = [0, 0, 1];
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, E = s.eye;
      b[`eye${q}`] = joint(body, [sd * E.root[0], E.root[1] + sd * 0.12 * E.r, E.root[2]], -(E.lean + sd * E.stagger) + p.eyes[q][0], sd * (E.out + p.eyes[q][1]), 0);
      // A claw: its hand turned as it is posed and put where its tip is to be; the arm reaching from the shoulder to its wrist, the
      // elbow always out to the side and up.
      const c = p.claws[q], h = s.claw.hand[q];
      const hand0 = joint(ground, [0, 0, 0], c.pitch, c.roll, c.yaw);
      const tipW = place(ground, c.tip), wrist = sub(tipW, sub(place(hand0, tipOf(h)), hand0.t));
      // Never into the ground: lifted by however far its lowest point would go under it.
      // Smoothly, so a claw settling onto the ground and leaving it again never jerks as the ground starts or stops holding it up.
      const dz = FLOOR - lowOf({ m: hand0.m, t: [0, 0, 0] }, h, c.open) - wrist[2];
      wrist[2] += 0.5 * (dz + Math.sqrt(dz * dz + SOFT * SOFT));
      const hand: Xf = { m: hand0.m, t: wrist };
      const sh = place(body, [sd * s.claw.at[0], s.claw.at[1], s.claw.at[2]]);
      // The elbow out to the side and back, which is the one way the wrist never goes from the shoulder, so it cannot flip.
      const pole = sub(place(ground, [sd * 0.8, -1, 0]), ground.t);
      const [A1, A2] = s.claw.arm, el = kneeOf(sh, wrist, A1, A2, pole);
      // Each part rolled to the plane the arm bends in, which turns smoothly with it.
      const plane = cross(sub(wrist, sh), pole), roll = cross(plane, sub(el, sh));
      b[`arm${q}0`] = aim(sh, sub(el, sh), roll);
      b[`arm${q}1`] = aim(el, sub(wrist, el), cross(plane, sub(wrist, el)));
      b[`claw${q}`] = hand;
      b[`nip${q}`] = joint(hand, hingeOf(h), c.open, 0, 0);
      // Its legs.
      for (let i = 0; i < 4; i++) {
        const hip = place(body, hipOf(s, i, sd)), foot = footOf(s, i, sd, a);
        const kn = kneeOf(hip, foot, s.legs.upper, s.legs.lower, up);
        // Each part rolled to the plane the leg is in, by that plane's own level normal, which turns smoothly as the foot swings
        // round: rolled by the world's up instead, a part passing through upright turned half round in a moment.
        const N = cross(sub(foot, hip), up);
        const upper = inPlane(hip, sub(kn, hip), N), lower = inPlane(kn, sub(foot, kn), N);
        b[`leg${i}${q}0`] = upper;
        b[`leg${i}${q}1`] = lower;
        const tip: Xf = { m: lower.m, t: foot };
        b[`leg${i}${q}2`] = tip;
        // The front feet and the back, under the names the island measures a stride by.
        if (i === 0) b[`f${sd > 0 ? 'r' : 'l'}2`] = tip;
        if (i === 3) b[`h${sd > 0 ? 'r' : 'l'}2`] = tip;
      }
    }
    return b;
  };
}

/* ---- its pieces ------------------------------------------------------------------------- */

function sandBuild(s: Sand, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), nb = cut(lod, 18, 27);
  const bowl = bowlOf(s, nb), solid = bowlSolid(s.bowl);
  // How far the heap and the crown are grown this moment, from the act it is in (the pose works the same out for the bones).
  const heapOf = (a: Anim): number => (a.act?.kind === 'work' ? poseOf(s, a).heap : 0);
  const crownOf = (a: Anim): number => (a.act?.kind === 'evolve' ? poseOf(s, a).crown : 1);
  const pieces: Piece[] = [
    {
      key: 'shell', mesh: bowl.mesh, bone: 'shell', bias: 0,
      bent: (v, a) => {
        const hp = heapOf(a), cr = crownOf(a);
        if (!hp && cr >= 1) return v as V3[];
        const grow = s.bowl.heap * 1.12 * hp;
        return v.map((p, i) => [p[0], p[1], p[2] + grow * bowl.heap[i] - (1 - cr) * 0.7 * bowl.lobe[i]] as V3);
      },
    },
  ];
  decoOf(s, n, k).forEach((d, q) => {
    pieces.push({
      key: `deco${q}`, mesh: d.mesh, bone: 'shell', bias: 0.02, after: 'shell', front: d.front, hide: [solid],
      bent: (v, a) => {
        const g = crownOf(a);
        if (g >= 1) return v as V3[];
        return v.map((p, i) => add(d.anchor[i], scale(sub(p, d.anchor[i]), Math.max(0.001, g))));
      },
    });
  });
  pieces.push({ key: 'body', mesh: bodyOf(s, n, k), bone: 'body', bias: 0.01, after: 'shell', front: [0, 1, 0], hide: [solid], hideIn: 'shell' });
  const eye = eyeOf(s, n, k);
  const up = upperOf(s), low = lowerOf(s), knee = orb([0, 0, 0], s.legs.thick * 0.95, 6, 3, 'coatDark');
  const upS = merge(up, legSpots(s, 'upper')), lowS = merge(low, knee, legSpots(s, 'lower'));
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, h = s.claw.hand[q], T = s.claw.thick * (0.75 + 0.35 * h / s.claw.hand[1]);
    const front: V3 = [sd * 0.5, 1, 0];
    pieces.push(
      { key: `eye${q}`, mesh: eye, bone: `eye${q}`, bias: 0.03, after: 'body', front: [0, 1, 0] },
      { key: `arm${q}0`, mesh: tube([[0, -T, 0], [0, s.claw.arm[0] + T * 0.3, 0]], T, T, 6, 'coat', { seam: 'start' }), bone: `arm${q}0`, bias: 0.02, after: 'body', front, convex: true },
      { key: `arm${q}1`, mesh: merge(orb([0, 0, 0], T * 1.05, 6, 3, 'coatDark'), tube([[0, 0, 0], [0, s.claw.arm[1] + T * 0.3, 0]], T * 1.05, T * 1.05, 6, 'horn')), bone: `arm${q}1`, bias: 0.025, after: 'body', front },
      { key: `claw${q}`, mesh: handOf(h, n, k, q * 13), bone: `claw${q}`, bias: 0.03, after: [`arm${q}1`, 'body'], front },
      { key: `nip${q}`, mesh: nipOf(h), bone: `nip${q}`, bias: 0.035, after: `claw${q}`, front: [sd, 0.3, 0.3], convex: true },
    );
    for (let i = 0; i < 4; i++) {
      const lf: V3 = [sd, 0, 0];
      pieces.push(
        { key: `leg${i}${q}0`, mesh: upS, bone: `leg${i}${q}0`, bias: 0.01, after: 'body', front: lf, hide: [solid], hideIn: 'shell' },
        { key: `leg${i}${q}1`, mesh: lowS, bone: `leg${i}${q}1`, bias: 0.015, after: `leg${i}${q}0`, front: lf, thin: s.strike === 0, hide: [solid], hideIn: 'shell' },
      );
    }
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Sand in the air, gold; a darker grain of it; and the colours of the bits of shell knocked off, the same on every variant. */
const SAND: RGB = [232, 180, 86];
const SAND_DARK: RGB = [208, 150, 64];
const CHIPS: RGB[] = [[250, 238, 220], [240, 140, 150], [160, 196, 232], [246, 176, 132]];

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** Where something thrown from `p` with velocity `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A grain of sand, or a little clump of it: a round dot, full strength, lit on top. */
function grain(g: CanvasRenderingContext2D, view: View, p: V3, r: number, c: RGB, al = 1): void {
  if (al <= 0.02 || r <= 0) return;
  const [x, y] = onScreen(view, p);
  g.fillStyle = css(mix(c, [120, 84, 50], 0.35), al);
  g.beginPath();
  g.arc(x, y, r * 1.2, 0, TAU);
  g.fill();
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x - r * 0.15, y - r * 0.2, r * 0.9, 0, TAU);
  g.fill();
}

/** A bit of shell knocked off: a small curved chip, lit on one face, at full strength. */
function chip(g: CanvasRenderingContext2D, view: View, p: V3, r: number, ang: number, c: RGB, al = 1): void {
  if (al <= 0.02) return;
  const [x, y] = onScreen(view, p);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-r, r * 0.3);
  g.quadraticCurveTo(0, -r * 1.1, r, r * 0.3);
  g.quadraticCurveTo(0, -r * 0.2, -r, r * 0.3);
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = Math.max(0.1, r * 0.14);
  g.strokeStyle = css(mix(c, [110, 80, 90], 0.3), al);
  g.stroke();
  g.restore();
}

/**
 * A puff of sand dust: a soft round cloud with no edge, made smaller and
 * lighter as it goes rather than fainter, so two of them over each other are
 * one cloud and not two bubbles.
 */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, life: number, dense = 0.7, flat = 0.75, gold = false): void {
  if (life <= 0 || r <= 0) return;
  const base = gold ? SAND : mix(SAND, [255, 236, 200], 0.35);
  const [x, y] = onScreen(view, at), c = mix(base, [255, 248, 230], (gold ? 0.2 : 0.5) * (1 - life)), rr = r * (0.4 + 0.6 * life);
  const grad = g.createRadialGradient(x, y, 0, x, y, rr);
  grad.addColorStop(0, css(c, dense * Math.min(1, life * 2)));
  grad.addColorStop(0.55, css(c, dense * 0.6 * Math.min(1, life * 2)));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.save();
  g.translate(x, y);
  g.scale(1, flat);
  g.translate(-x, -y);
  g.beginPath();
  g.arc(x, y, rr, 0, TAU);
  g.fill();
  g.restore();
}

/**
 * A cloud of sand dust: one lumpy shape of overlapping rounds -- a pale
 * fringe round it filled once, and a solid core with its top lumps shaded
 * lighter, drawn whole and laid down once, so it is one cloud and never a
 * cluster of bubbles and never tinted by the grass under it. Shrunk and
 * lightened as it goes rather than faded, till at the last it thins.
 */
function cloud(g: CanvasRenderingContext2D, view: View, lumps: ReadonlyArray<[V3, number]>, life: number): void {
  if (life <= 0) return;
  // Shrunk away rather than faded, so it stays one solid cloud till it is nearly gone.
  const k = 0.12 + 0.88 * life, al = Math.min(1, life * 4);
  const col = mix(mix(SAND, [255, 238, 204], 0.4), [255, 250, 236], 0.4 * (1 - life)), light = mix(col, [255, 252, 244], 0.45);
  // The whole of it drawn in toward its own middle as it shrinks, so its lumps stay run together and it never breaks into bubbles.
  const at = lumps.map(([p, r]) => [...onScreen(view, p), r] as [number, number, number]);
  const w = at.reduce((t, q) => t + q[2] * q[2], 0) || 1;
  const cx = at.reduce((t, q) => t + q[0] * q[2] * q[2], 0) / w, cy = at.reduce((t, q) => t + q[1] * q[2] * q[2], 0) / w;
  const rounds = at.map(([x, y, r]) => [cx + (x - cx) * k, cy + (y - cy) * k, r * k] as [number, number, number]);
  const union = (grow: number): Path2D => {
    const path = new Path2D();
    for (const [x, y, r] of rounds) { path.moveTo(x + r * grow, y); path.arc(x, y, r * grow, 0, TAU); }
    return path;
  };
  // The fringe: the core's own colour gone toward white, thin.
  g.fillStyle = css(mix(col, [255, 255, 255], 0.5), 0.4 * al);
  g.fill(union(1.2));
  // The core, with the upper lumps lit: drawn at full strength where it is to be laid down at less, onto a canvas of its own.
  const paintCore = (c: CanvasRenderingContext2D): void => {
    const core = union(1);
    c.fillStyle = css(col, 1);
    c.fill(core);
    c.save();
    c.clip(core);
    const top = Math.min(...rounds.map((q) => q[1]));
    for (const [x, y, r] of rounds) {
      if (y > top + (Math.max(...rounds.map((q) => q[1])) - top) * 0.55) continue;
      const hx = x - r * 0.25, hy = y - r * 0.35, grad = c.createRadialGradient(hx, hy, 0, hx, hy, r * 0.8);
      // Light fading to nothing, so where two overlap they blend and neither cuts a circle out of the other.
      grad.addColorStop(0, css(light, 0.85));
      grad.addColorStop(1, css(light, 0));
      c.fillStyle = grad;
      c.beginPath();
      c.arc(hx, hy, r * 0.8, 0, TAU);
      c.fill();
    }
    c.restore();
  };
  if (al >= 0.999 || typeof document === 'undefined') {
    paintCore(g);
    return;
  }
  const T = g.getTransform();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, r] of rounds) {
    for (const [px, py] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const dx = T.a * px + T.c * py + T.e, dy = T.b * px + T.d * py + T.f;
      x0 = Math.min(x0, dx); y0 = Math.min(y0, dy); x1 = Math.max(x1, dx); y1 = Math.max(y1, dy);
    }
  }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2;
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.ceil(x1 - x0) + 4);
  off.height = Math.max(1, Math.ceil(y1 - y0) + 4);
  const o = off.getContext('2d');
  if (!o) return;
  o.setTransform(T.a, T.b, T.c, T.d, T.e - x0, T.f - y0);
  paintCore(o);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = al;
  g.drawImage(off, x0, y0);
  g.restore();
}

/**
 * A ring of sand dust going out over the ground from `c`, `r` across and
 * `w` thick: one soft band lying flat on the ground, densest along its middle
 * and fading to nothing either side, filled once. Its half on the viewer's
 * side of the body is drawn over the body and the rest under it.
 */
function dustRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, w: number, al: number, mid: V3, front: boolean): void {
  if (al <= 0.01 || r <= 0 || w <= 0) return;
  const [ox, oy] = onScreen(view, c), T = view.T;
  g.save();
  // The ground's own axes on the screen, so the band lies on it.
  g.transform(view.ex[0], view.ex[1], view.ey[0], view.ey[1], ox, oy);
  // The line across the ground between the halves before and behind the body, and the half this pass draws.
  const nl = Math.hypot(T[0], T[1]) || 1, n: [number, number] = [T[0] / nl, T[1] / nl], perp: [number, number] = [-n[1], n[0]];
  const d = -((c[0] - mid[0]) * T[0] + (c[1] - mid[1]) * T[1] + (0.03 - mid[2]) * T[2]) / nl, L = r + w + 1, side = front ? 1 : -1;
  g.beginPath();
  g.moveTo(n[0] * d + perp[0] * L, n[1] * d + perp[1] * L);
  g.lineTo(n[0] * d - perp[0] * L, n[1] * d - perp[1] * L);
  g.lineTo(n[0] * (d + side * 2 * L) - perp[0] * L, n[1] * (d + side * 2 * L) - perp[1] * L);
  g.lineTo(n[0] * (d + side * 2 * L) + perp[0] * L, n[1] * (d + side * 2 * L) + perp[1] * L);
  g.closePath();
  g.clip();
  const inner = Math.max(0, r - w), col = mix(SAND, SAND_DARK, 0.45);
  const grad = g.createRadialGradient(0, 0, inner, 0, 0, r + w);
  grad.addColorStop(0, css(col, 0));
  grad.addColorStop((r - inner) / (r + w - inner), css(col, al));
  grad.addColorStop(1, css(col, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r + w, 0, TAU);
  g.arc(0, 0, inner, 0, TAU, true);
  g.fill();
  g.restore();
}

/** How big a clump of sand in the air is, on a Sandpip: big enough to be a speck at the size it is played at. */
const CLUMP = 0.12;
/** How big a stage's things in the air are drawn, against the Sandpip's. */
const bigness = (s: Sand): number => Math.sqrt(kOf(s));
/** The top of its heap, over the ground. */
const heapTop = (s: Sand, b: Bones): V3 => place(b.shell, [0, 0, s.bowl.prof[s.bowl.prof.length - 1][0] - s.bowl.sand + s.bowl.heap]);
/** The tip of a claw's fixed finger, where it is. */
const tipAt = (s: Sand, b: Bones, q: number): V3 => place(b[`claw${q}`], tipOf(s.claw.hand[q]));
/** Whether a point is inside the bowl, under its rim, where nothing thrown into it is seen. */
function inBowl(s: Sand, b: Bones, p: V3): boolean {
  const x = b.shell, m = x.m, d = sub(p, x.t), l: V3 = [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
  const H = s.bowl.prof[s.bowl.prof.length - 1][0];
  return l[2] < H && l[2] > 0 && Math.hypot(l[0], l[1]) < profAt(s.bowl, l[2] / H).r;
}

/** Grains spilling over the rim and down the outside of the bowl, `count` of them from `t0` seconds ago, each from its own place round it. */
function spill(g: CanvasRenderingContext2D, view: View, s: Sand, b: Bones, since: number, count: number, seed: number, front: boolean, al = 1): void {
  if (since < 0 || since > 0.9) return;
  const B = s.bowl, mid = b.shell.t, big = bigness(s);
  for (let q = 0; q < count; q++) {
    const az = (jitter(q + seed) * 360);
    const rim = onBowl(B, az, 1), from = place(b.shell, add(rim.p, [0, 0, B.lobe * 0.5 + 0.02]));
    const out = sub(place(b.shell, add(rim.p, rim.n)), place(b.shell, rim.p));
    const t = since - 0.06 * jitter(q * 3 + seed);
    if (t < 0) continue;
    const p = thrown(from, [out[0] * 0.8 * big, out[1] * 0.8 * big, 0.6 + 0.8 * jitter(q + 7 + seed)], t);
    if (p[2] <= 0.03 || nearSide(p, mid, view) !== front) continue;
    grain(g, view, p, CLUMP * big * (0.7 + 0.4 * jitter(q + seed * 2)), q % 3 ? SAND : SAND_DARK, al * (1 - ramp(since, 0.6, 0.9)));
  }
}

/**
 * The strike landing: a ring of sand dust going out over the ground under
 * the blow; a burst of sand and a few chips of shell off the claws -- a
 * pinch's off the tip of the claw, a crush's a fountain off the ground under
 * both -- thrown up and out, a good share of it high enough to show over the
 * bowl from behind; a puff of sand where it hit; and sand shaken off the top
 * of the heap as the shell lurches.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Sand, b: Bones, hit: Bones, t: number, front: boolean): void {
  const since = (t - STRIKE.hit) * ACT_SECS.strike;
  if (since < 0) return;
  const big = bigness(s), mid = b.body.t, crush = s.strike === 2;
  const H = heapTop(s, hit)[2];
  const froms: V3[] = crush ? [0, 1].map((q) => { const p = tipAt(s, hit, q); return [p[0], p[1] + 0.1, 0.05] as V3; }) : [tipAt(s, hit, 1)];
  const fade = 1 - ramp(since, 0.18, 0.3);
  for (const [fi, from] of froms.entries()) {
    // The ring of dust out over the ground under it, flat on the ground, going out and thinning.
    const ground: V3 = [from[0], from[1], 0];
    dustRing(g, view, ground, (0.35 + 3.2 * since) * big * (crush ? 1.5 : 1), (0.22 + 0.9 * since) * big * (crush ? 1.4 : 1), 0.8 * (1 - smooth(since / 0.32)), mid, front);
    // The puff where it hit, on whichever side of the body that is.
    if (nearSide(from, mid, view) === front) puff(g, view, add(from, [0, 0, 0.15 * big + 1.5 * since]), (0.7 + 2.6 * since) * big * (crush ? 1.6 : 1), 1 - since / 0.3);
    const count = crush ? 26 : s.strike ? 22 : 14;
    for (let q = 0; q < count; q++) {
      const id = q + fi * 31, a = jitter(id) * TAU, sp = (1.2 + 1.6 * jitter(id + 3)) * big;
      // Most thrown up and out; every other one straight up, to well over the top of the bowl and its crown, so it shows over it
      // from behind.
      const high = q % 2 === 0 && q < 16;
      const peak = H + (0.5 + s.bowl.lobe + 0.6 * jitter(id + 7)) * big - from[2];
      // The high ones close together, a column of sand going up, so it reads as one flick over the crown and not a scatter.
      const v: V3 = high ? [Math.cos(a) * 0.25, Math.sin(a) * 0.25 + 0.15, Math.sqrt(2 * 12 * Math.max(0.2, peak))] : [Math.cos(a) * sp, Math.sin(a) * sp + 0.6 * big, (4 + 4 * jitter(id + 5)) * big];
      const p = thrown(from, v, since, 12);
      if ((nearSide(p, mid, view) || p[2] > H + 0.3) !== front) continue;
      if (q % 4 === 1) chip(g, view, p, (0.2 + 0.08 * jitter(id)) * big * (crush ? 1.3 : 1), id + since * 20, CHIPS[q % 4], fade);
      else {
        // A grain that goes over the crown never smaller than half a pixel at the size it is played at, or from behind it is not there.
        const r = CLUMP * big * (0.8 + 0.5 * jitter(id + 1)) * (s.strike ? 1.3 : 1);
        grain(g, view, p, high ? Math.max(r, 0.55 / s.size) : r, q % 2 ? SAND : SAND_DARK, fade);
      }
    }
  }
  // And a flick of gold dust over the crown at the blow, which is what shows of it from straight behind.
  // Never under about a pixel and a half across at the size it is played at.
  const flick = (since - 0.02) / 0.2;
  if (front && flick > 0 && flick < 1) {
    const r = Math.max((0.3 + 0.25 * s.strike) * big, 1.3 / s.size) * (0.8 + 0.6 * flick);
    puff(g, view, add(heapTop(s, b), [0, 0, (s.bowl.lobe + 0.25) * big + 1.6 * (since - 0.02)]), r, 1 - flick, 0.9, 0.75, true);
  }
  // Sand shaken off the top of the heap as the shell lurches, over the rim and down its sides, before and behind.
  spill(g, view, s, b, since - 0.02, crush ? 14 : s.strike ? 10 : 8, 40, front);
}

/**
 * Digging: sand pushed up in front of the claws as they scoop along the
 * ground; tossed out of them at the top of the lift in a spray of clumps
 * trailing a thin haze, arcing back over its head and up over the rim into
 * the bowl, landing on the heap with a little puff; and a few grains spilling
 * over the rim as it lands. Each from the moment it starts in a go, so a go
 * played once throws nothing before its first scoop.
 */
function digSpray(g: CanvasRenderingContext2D, view: View, s: Sand, b: Bones, toss: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, d = downOf(t, a.graze);
  if (d < 0.05) return;
  // Scooping: sand heaped up and spilling in front of each claw's tip as it drags.
  if (t > WORK.dig && t < WORK.scoop + 0.06) {
    const k = ramp(t, WORK.dig, WORK.dig + 0.05) * (1 - ramp(t, WORK.scoop, WORK.scoop + 0.06));
    for (let q = 0; q < 2; q++) {
      const tip = tipAt(s, b, q);
      for (let e = 0; e < 4; e++) {
        const u = frac(t * 8 + e / 4 + q * 0.17);
        const p: V3 = [tip[0] + 0.1 * big * (e - 1.5), tip[1] + 0.12 * big, 0.06 + 0.22 * big * Math.sin(Math.PI * u)];
        if (nearSide(p, mid, view) === front) grain(g, view, p, CLUMP * big * (0.8 + 0.3 * (e % 2)), e % 2 ? SAND : SAND_DARK, d * k);
      }
    }
  }
  // Tossed: from each claw's tip at the toss, up and back over the head, coming down on the heap.
  const fly = (WORK.land - WORK.toss) * ACT_SECS.work, since = (t - WORK.toss) * ACT_SECS.work;
  const top = heapTop(s, toss), R = s.bowl.prof[2][1];
  if (since >= 0 && since <= fly + 0.1) {
    for (let q = 0; q < 2; q++) {
      const from = tipAt(s, toss, q);
      const path = (u: number, e: number): V3 => {
        const goal: V3 = add(top, [(jitter(e * 3 + q) - 0.5) * R * 0.8, (jitter(e * 5 + q) - 0.5) * R * 0.6, 0]);
        const arc = (0.7 + 0.5 * jitter(e + 2)) * (Math.max(0, top[2] - from[2]) + 0.8 * big);
        // Up first and over after, so it rises clear of the rim before it comes across it.
        const across = u * u;
        return [lerp(from[0], goal[0], across), lerp(from[1], goal[1], across), lerp(from[2], goal[2], Math.sqrt(u)) + arc * 4 * u * (1 - u)];
      };
      // A thin haze along the way, the trail of the spray: soft, no edge, behind the clumps.
      const head = clamp(since / fly);
      for (let e = 0; e < 4; e++) {
        const u = head - 0.12 * e;
        if (u <= 0 || u >= 1) continue;
        const p = path(u, 0);
        if ((nearSide(p, mid, view) || p[2] > top[2] + 0.05) !== front) continue;
        puff(g, view, p, (0.22 + 0.06 * e) * big, d * 0.55 * (1 - e / 4) * (1 - ramp(since, fly * 0.8, fly + 0.1)));
      }
      for (let e = 0; e < 10; e++) {
        // Each clump to its own place on the heap, leaving a little after the last.
        const lag = 0.06 * jitter(e + q * 9), u = clamp((since - lag) / fly);
        if (since < lag || u >= 1) continue;
        const p = path(u, e);
        // Over the rim it is in front of whatever of the bowl is behind it; inside the bowl under the rim, it is not seen.
        if ((nearSide(p, mid, view) || p[2] > top[2] + 0.05) !== front || inBowl(s, b, p)) continue;
        grain(g, view, p, CLUMP * big * (0.75 + 0.5 * jitter(e + q)), e % 3 ? SAND : SAND_DARK, d);
      }
    }
  }
  // Landing on the heap: a little puff over it, and grains spilling over the rim.
  const after = (t - WORK.land) * ACT_SECS.work;
  // Gold and low over the heap, no wider than a third of the bowl.
  if (front && after > -0.02 && after < 0.3) puff(g, view, add(top, [0, 0, 0.06 * big + after * 0.5]), Math.min(0.35 * R, (0.25 + 1.2 * after) * big), d * (1 - after / 0.3), 0.8, 0.4, true);
  spill(g, view, s, b, after, 5 + 2 * s.strike, 70, front, d);
}

/** Going, a Sandpinnacle spills a little sand off the top of its heap with each rock of its crown. */
function trickle(g: CanvasRenderingContext2D, view: View, s: Sand, b: Bones, a: Anim, front: boolean): void {
  if (!s.gait.trickle || a.go < 0.5) return;
  for (const off of [0, 0.5]) {
    const since = frac(a.u - 0.2 - off) * 0.6;
    spill(g, view, s, b, since, 3, 90 + off * 10, front, smooth(a.go));
  }
}

/**
 * Evolving: at the start a cloud of sand and a burst of sand and shell
 * thrown out of it, which covers the moment it changes into its new body;
 * then sand and little shells swirling in round it from wide at its feet and
 * drawn up into the bowl, gone into it by the flash, its crown grown in.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Sand, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = t * ACT_SECS.evolve, k = kOf(s);
  const top = heapTop(s, b);
  const burst = 1 - ramp(t, 0.1, 0.24);
  if (burst > 0) {
    if (front) {
      // One cloud, solid at its core, over the whole of it from the ground to over the rim: what hides the change of body. It
      // holds for the first moment and then shrinks away, gone by a quarter of the way through.
      const B = s.bowl, H = B.prof[B.prof.length - 1][0], R = Math.max(...B.prof.map((q) => q[1]));
      const bowlMid = place(b.shell, [0, 0, H * 0.5]), rise = since * 0.6;
      const lumps: Array<[V3, number]> = [
        [[0, 0.1 * k, 0.35 * k], 0.95 * k], [[0.75 * k, 0.4 * k, 0.3 * k], 0.62 * k], [[-0.75 * k, 0.4 * k, 0.3 * k], 0.62 * k], [[0, 0.95 * k, 0.45 * k], 0.62 * k],
        [add(b.body.t, [0, 0, rise]), 0.7 * k], [add(bowlMid, [0, 0, rise]), R * 1.15], [add(bowlMid, [R * 0.85, 0, rise]), R * 0.7], [add(bowlMid, [-R * 0.85, 0, rise]), R * 0.7],
        [add(top, [0, 0, 0.15 * k + rise]), R * 0.95], [add(top, [R * 0.6, -R * 0.3, 0.35 * k + rise]), R * 0.55], [add(top, [-R * 0.55, R * 0.25, 0.4 * k + rise]), R * 0.5],
      ];
      // And over each claw and each eye of the new body, wherever they reach.
      for (let q = 0; q < 2; q++) {
        const h = s.claw.hand[q];
        lumps.push([add(place(b[`claw${q}`], [0, 0.6 * h, 0]), [0, 0, rise]), 0.62 * h], [add(place(b[`claw${q}`], [0, 1.1 * h, -0.1 * h]), [0, 0, rise]), 0.45 * h]);
        lumps.push([add(place(b[`eye${q}`], [0, 0, s.eye.len + s.eye.r]), [0, 0, rise]), 3.2 * s.eye.r]);
        lumps.push([add(b[`arm${q}1`].t, [0, 0, rise]), 0.5 * s.claw.arm[0] + s.claw.thick]);
        for (let i = 0; i < 4; i++) lumps.push([add(b[`leg${i}${q}1`].t, [0, 0, rise]), 0.75 * s.legs.upper]);
        // And the corners of the rim, which stand out past the round of the bowl.
        lumps.push([add(place(b.shell, [(q ? 1 : -1) * R * 0.85, 0, H * 0.95]), [0, 0, rise]), R * 0.55]);
      }
      cloud(g, view, lumps, 1 - ramp(t, 0.06, 0.2));
    }
    // Sand and bits of shell thrown out of it, from outside the bowl and a moment after it bursts, so none is a mark on the bowl.
    const B = s.bowl, R = Math.max(...B.prof.map((q) => q[1])) * 1.6;
    for (let q = 0; q < 32; q++) {
      const th = (q / 32) * TAU * 2.6 + jitter(q) * 0.7, el = 0.3 + 0.7 * jitter(q + 40);
      const dir = unit([Math.cos(th), Math.sin(th), el]);
      const from: V3 = add(place(b.shell, [0, 0, B.prof[B.prof.length - 1][0] * 0.5]), [dir[0] * R, dir[1] * R, dir[2] * 0.4 * k]);
      const go = since - 0.05;
      if (go < 0) continue;
      const p = thrown(from, scale(add(dir, [0, 0, 0.5]), (2.5 + 2.5 * jitter(q + 3)) * big), go, 6);
      if (nearSide(p, mid, view) !== front) continue;
      if (q % 3 === 0) chip(g, view, p, 0.22 * big, q + since * 9, CHIPS[q % 4], burst);
      else grain(g, view, p, CLUMP * big, q % 2 ? SAND : SAND_DARK, burst);
    }
  }
  // Swirling in: sand and little spiral shells round and round and up into the bowl, rising as they go, in by the flash.
  const fade = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.47, 0.52));
  if (fade <= 0) return;
  const wide = 1.6 * k;
  for (let q = 0; q < 26; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / (0.32 + 0.06 * jitter(q + 2)));
    const ang = (q / 26) * TAU + u * TAU * (1.2 + 0.5 * jitter(q + 5));
    const r = wide * (1 - u) ** 1.2;
    const p: V3 = add(scale(top, u ** 0.8), [Math.cos(ang) * r, Math.sin(ang) * r, (1 - u) * 0.2 * k * jitter(q + 21)]);
    if (nearSide(p, mid, view) !== front) continue;
    const al = fade * ramp(u, 0, 0.12) * (1 - ramp(u, 0.9, 1));
    if (q % 4 === 0) {
      // A tiny spiral shell: a cream dot with a pink curl in it.
      const [x, y] = onScreen(view, p), rr = 0.2 * big;
      g.fillStyle = css(CHIPS[0], al);
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.fill();
      g.strokeStyle = css(CHIPS[1], al);
      g.lineWidth = rr * 0.35;
      g.beginPath();
      g.arc(x, y, rr * 0.5, ang, ang + 4.5);
      g.stroke();
    } else grain(g, view, p, CLUMP * big, q % 3 ? SAND : SAND_DARK, al);
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, digs, goes and evolves. */
function sandKind(s: Sand): Kind {
  const bones = sandBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: STRIKE.hit } });
  const atToss = (a: Anim): Bones => bones({ ...a, act: { kind: 'work', t: WORK.toss } });
  return {
    bones,
    build: (lod) => sandBuild(s, lod),
    // The variant's coat is its body and legs; its markings are the main colour of the speckles on its claws and its bowl, among
    // a peach and a pale blue that are its own. Its bowl is cream and its sand gold on every variant, and its eyes black.
    palette: (coat, mark) => {
      const body = mix(pastel(coat, 20), coat, 0.8), speck = mix(pastel(mark, 20), mark, 0.6);
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: darker(body, 0.24),
        coatLight: mix([250, 214, 206], speck, 0.25),
        mark: speck,
        muzzle: [250, 236, 210],
        shell: [255, 234, 198],
        shellDark: [230, 186, 140],
        horn: [250, 228, 202],
        // The bowl's blotches: its speckle colours half faded into the cream of the shell.
        membrane: mix(speck, [255, 234, 198], 0.45),
        pad: [250, 196, 160],
        water: [190, 210, 232],
        hornDark: mix(body, [226, 132, 92], 0.45),
        spot: [246, 168, 120],
        crystal: [148, 190, 232],
        petal: [240, 126, 142],
        cap: [190, 76, 98],
        flame: [248, 210, 104],
        ember: [200, 150, 60],
        feather: [168, 196, 228],
        bloom: [234, 178, 74],
        bark: [192, 136, 52],
        eye: [24, 20, 28],
        glint: [255, 255, 255],
        lid: darker(body, 0.45),
      });
    },
    shadow: [s.legs.ys[0] - s.legs.ys[3] + s.legs.reach * 0.9, s.legs.x + s.legs.reach * 0.9],
    stride: 1.5,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are coral pink and sand gold.
    motes: [[240, 126, 142], [236, 198, 112]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (!act) {
        trickle(g, view, s, b, a, front);
        return;
      }
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') digSpray(g, view, s, b, atToss(a), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SANDPIP = sandKind(SANDPIP_LOOK);
export const SANDPINCHER = sandKind(SANDPINCHER_LOOK);
export const SANDPINNACLE = sandKind(SANDPINNACLE_LOOK);
