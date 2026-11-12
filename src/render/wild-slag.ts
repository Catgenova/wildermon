import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, darker, disc, dot, frac, lerp, merge, mix, orb, orbAlong, paint, pastel,
  scale, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { css, cut, hump, jitter, nearSide, ramp } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The slag line: the Slaglet, a little crab carrying a brick crucible of
 * swirling molten metal with two copper chimneys puffing steam, its face on
 * the front of the crucible; which grows into the Alloyster, a crab under a
 * domed furnace of stone and copper with a cupola on top and a glowing mouth
 * on its front, and then the Moltenex, a great crab under an open ring of a
 * crucible, a copper tower standing in its pool with two stirring pipes
 * arcing down into it, four chimney stacks, a copper crest and massive
 * riveted claws. The species is still `scorcha` underneath, as saves and the
 * database know it.
 *
 * Each is a cream crab with copper-orange joints and cracks, four jointed
 * legs a side and cream claws; the crucible is cream stone in blocks, its
 * metal bright. All three are built by one set of functions from a
 * description of the stage (`Slag`), on the Sandpip's crab (`wild-sand.ts`):
 * its body, legs, claws and their moves are worked out the same way. At its
 * task it scoops lumps off the ground and tosses them into its crucible,
 * which flares, throws sparks and puffs steam.
 *
 * Its front is `y`, its right `x`, up `z`, as every kind's; it walks forward,
 * its legs fanned out to either side of it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along the body, rear to front: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A chimney: where it stands round the crucible (degrees from the front toward its right), how far in from the wall's middle, how thick and how tall. */
interface Chimney { az: number; r: number; h: number; inset?: number }

interface Slag {
  /** The body under the crucible: its rings, in the body's frame, whose root is `high` over the ground standing. */
  body: Rings;
  high: number;
  /** Kept for the bones (a crab's face and eyes are worked out from them): its face's middle and half-sizes. */
  face: { at: V3; r: V3 };
  eye: { root: V3; len: number; r: number; out: number; lean: number; stagger: number };
  /**
   * The crucible on its back: the middle of its foot on the body, how far it is tipped forward (degrees), its outside from
   * foot to rim as [height, radius] pairs, how many blocks round it, how thick its wall is, how far under the rim the metal
   * stands, and how far the metal swells in the middle. With what is on it: a copper band (how far up, nought to one) with
   * rivets; a dome over it (how tall) with a strap over the top; a glowing mouth in front (how many degrees round it is each side of the front, how tall, how far up); a
   * cupola on the dome; a tower standing in the metal with two stirring pipes; glowing slots round the top of the wall; a
   * copper crest on its front; and a face on its front (eyes, mouth, blush).
   */
  bowl: {
    at: V3; tilt: number; prof: Array<[number, number]>; segs: number; wall: number; sand: number; heap: number;
    band?: number; dome?: number; mouth?: { w: number; h: number; f: number }; cupola?: { r: number; h: number };
    tower?: { r: number; h: number }; slots?: number; crest?: { r: number; f: number }; face?: boolean;
  };
  chimneys: Chimney[];
  /** Four legs a side, front to back, as the Sandpip's; with `root`, how much farther in past the hip its upper part reaches. */
  legs: { x: number; z: number; ys: number[]; fan: number[]; upper: number; lower: number; reach: number; thick: number; arch: number; root?: number };
  /** The claws, as the Sandpip's; with `hub`, a copper rivet hub at each wrist. */
  claw: { at: V3; arm: [number, number]; hand: [number, number]; rest: { fwd: number; out: [number, number]; pitch: number; open: number; yaw?: number; roll?: number }; thick: number; hub?: boolean };
  /** How it goes: as the Sandpip's; `trickle` is how hard its metal sloshes and sparks as it goes. */
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; bob: number; sway: number; rock: number; trickle: number };
  /** How it strikes: a quick pinch, a big-claw snap with a lunge, or both claws raised and brought down in a crush. */
  strike: 0 | 1 | 2;
  size: number;
}

/** A Slaglet: small and round, a brick crucible bowl of molten metal on it with its face on the front, two little copper chimneys, little claws. */
const SLAGLET_LOOK: Slag = {
  body: { y: [-0.4, -0.24, 0.0, 0.24, 0.38, 0.46, 0.5], z: [0.1, 0.06, 0.02, 0.02, 0.04, 0.04, 0.04], w: [0.18, 0.3, 0.38, 0.4, 0.36, 0.28, 0.1], h: [0.1, 0.15, 0.18, 0.18, 0.17, 0.13, 0.05] },
  high: 0.3,
  face: { at: [0, 0.6, 0.15], r: [0.36, 0.15, 0.3] },
  eye: { root: [0.16, 0.5, 0.3], len: 0.2, r: 0.13, out: 30, lean: 22, stagger: 10 },
  bowl: { at: [0, 0.04, -0.12], tilt: 0, prof: [[0, 0.42], [0.08, 0.62], [0.18, 0.74], [0.28, 0.79], [0.36, 0.78], [0.42, 0.75]], segs: 11, wall: 0.1, sand: 0.07, heap: 0.04, face: true },
  chimneys: [{ az: 145, r: 0.075, h: 0.26 }, { az: -145, r: 0.07, h: 0.2 }],
  legs: { x: 0.54, z: -0.14, ys: [0.3, 0.1, -0.1, -0.3], fan: [50, 17, -17, -50], upper: 0.34, lower: 0.36, reach: 0.54, thick: 0.11, arch: 0.12 },
  claw: { at: [0.38, 0.5, -0.16], arm: [0.22, 0.2], hand: [0.34, 0.34], rest: { fwd: 0.56, out: [0.56, 0.56], pitch: -20, open: 20, yaw: 22 }, thick: 0.08 },
  gait: { sweep: [0.3, 0.38], duty: [0.6, 0.52], lift: [0.14, 0.18], bob: 0.085, sway: 2, rock: 1.5, trickle: 0 },
  strike: 0,
  size: 2.2,
};

/** An Alloyster: a domed furnace of stone and copper with a riveted band, a cupola with a finial, a wide glowing mouth in front, two copper chimneys and chunky claws. */
const ALLOYSTER_LOOK: Slag = {
  body: { y: [-0.7, -0.42, 0.0, 0.42, 0.66, 0.78, 0.84], z: [0.12, 0.06, 0.0, 0.0, 0.03, 0.04, 0.04], w: [0.28, 0.48, 0.6, 0.62, 0.58, 0.46, 0.16], h: [0.12, 0.2, 0.24, 0.24, 0.22, 0.18, 0.07] },
  high: 0.62,
  face: { at: [0, 0.92, 0.2], r: [0.46, 0.2, 0.4] },
  eye: { root: [0.2, 0.8, 0.4], len: 0.26, r: 0.18, out: 30, lean: 22, stagger: 10 },
  bowl: {
    at: [0, 0.0, -0.26], tilt: 0, prof: [[0, 0.5], [0.14, 0.82], [0.36, 1.02], [0.6, 1.08], [0.8, 1.06]], segs: 12, wall: 0.12, sand: 0.12, heap: 0.06,
    band: 0.97, dome: 0.46, mouth: { w: 46, h: 0.56, f: 0.62 }, cupola: { r: 0.2, h: 0.16 },
  },
  chimneys: [{ az: 112, r: 0.11, h: 0.5, inset: 0.32 }, { az: 146, r: 0.1, h: 0.38, inset: 0.28 }],
  legs: { x: 0.8, z: -0.24, ys: [0.42, 0.14, -0.14, -0.42], fan: [50, 17, -17, -50], upper: 0.54, lower: 0.56, reach: 0.76, thick: 0.17, arch: 0.12 },
  claw: { at: [0.64, 0.74, -0.28], arm: [0.46, 0.42], hand: [0.8, 0.8], rest: { fwd: 0.6, out: [0.36, 0.36], pitch: -18, open: 24, yaw: 26 }, thick: 0.15, hub: true },
  gait: { sweep: [0.42, 0.52], duty: [0.62, 0.52], lift: [0.18, 0.24], bob: 0.12, sway: 2.5, rock: 3, trickle: 0 },
  strike: 1,
  size: 2.3,
};

/** A Moltenex: a great open ring of a crucible in riveted blocks with glowing slots, a copper tower in its molten pool with two stirring pipes, four chimney stacks, a copper crest, massive riveted claws. */
const MOLTENEX_LOOK: Slag = {
  body: { y: [-0.9, -0.52, 0.0, 0.54, 0.92, 1.14, 1.22], z: [0.16, 0.08, 0.0, 0.0, 0.04, 0.06, 0.06], w: [0.36, 0.62, 0.76, 0.78, 0.74, 0.6, 0.2], h: [0.16, 0.26, 0.3, 0.3, 0.28, 0.24, 0.1] },
  high: 0.74,
  face: { at: [0, 1.2, 0.24], r: [0.6, 0.24, 0.5] },
  eye: { root: [0.26, 1.06, 0.5], len: 0.34, r: 0.22, out: 30, lean: 22, stagger: 10 },
  bowl: {
    at: [0, 0.0, -0.3], tilt: 0, prof: [[0, 0.8], [0.14, 1.3], [0.38, 1.64], [0.64, 1.76], [0.82, 1.76]], segs: 14, wall: 0.2, sand: 0.14, heap: 0.06,
    band: 0.95, tower: { r: 0.3, h: 0.66 }, slots: 14, crest: { r: 0.5, f: 0.52 },
  },
  chimneys: [{ az: -54, r: 0.13, h: 0.62 }, { az: 54, r: 0.13, h: 0.62 }, { az: -138, r: 0.15, h: 0.86 }, { az: 138, r: 0.15, h: 0.86 }],
  legs: { x: 1.24, z: -0.34, ys: [0.6, 0.2, -0.2, -0.6], fan: [50, 17, -17, -50], upper: 0.9, lower: 0.7, reach: 1.1, thick: 0.24, arch: 0.12, root: 0.3 },
  claw: { at: [1.0, 1.0, -0.34], arm: [0.7, 0.66], hand: [1.2, 1.2], rest: { fwd: 0.6, out: [0.44, 0.44], pitch: -18, open: 28, yaw: 30 }, thick: 0.22, hub: true },
  gait: { sweep: [0.6, 0.72], duty: [0.66, 0.54], lift: [0.2, 0.26], bob: 0.15, sway: 3, rock: 3, trickle: 1 },
  strike: 2,
  size: 2.5,
};

/* ---- helpers --------------------------------------------------------------------------- */

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

/* ---- the crucible ------------------------------------------------------------------------- */

/** The crucible's outside `f` of the way up it (nought its foot, one its rim), and the slope of it there. */
function profAt(B: Slag['bowl'], f: number): { z: number; r: number; dr: number } {
  const P = B.prof, H = P[P.length - 1][0], z = clamp(f) * H;
  let k = 0;
  while (k < P.length - 2 && P[k + 1][0] < z) k++;
  const u = clamp((z - P[k][0]) / (P[k + 1][0] - P[k][0]));
  return { z, r: lerp(P[k][1], P[k + 1][1], u), dr: (P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]) };
}

/** A point on the outside of the crucible, `az` degrees round from its front toward its right and `f` up it, and the way out of it there. */
function onBowl(B: Slag['bowl'], az: number, f: number): { p: V3; n: V3 } {
  const a = az * DEG, q = profAt(B, f), d: V3 = [Math.sin(a), Math.cos(a), 0];
  return { p: [d[0] * q.r, d[1] * q.r, q.z], n: unit([d[0], d[1], -q.dr]) };
}

/** The rim's height and its outside radius. */
const rimOf = (B: Slag['bowl']): { H: number; R: number } => ({ H: B.prof[B.prof.length - 1][0], R: B.prof[B.prof.length - 1][1] });

/** A point on the dome over the crucible, `az` round and `up` of the way from its foot (the rim) to its top, and the way out of it there. */
function onDome(B: Slag['bowl'], az: number, up: number): { p: V3; n: V3 } {
  const { H, R } = rimOf(B), D = B.dome ?? 0, ph = clamp(up) * Math.PI / 2, a = az * DEG;
  const r = R * Math.cos(ph), z = H + D * Math.sin(ph);
  return { p: [Math.sin(a) * r, Math.cos(a) * r, z], n: unit([Math.sin(a) * Math.cos(ph) / R, Math.cos(a) * Math.cos(ph) / R, Math.sin(ph) / Math.max(0.01, D)]) };
}

/**
 * The crucible as solids that hide what is inside it or behind it (`Piece.hide`), in its own frame: a stack of eggs, each wholly
 * inside its outside, from its foot to the top of its metal (or of its dome), so that a leg or an arm going in under it is hidden
 * where it is inside the wall and not drawn over it, out to the swell of its sides, which one egg could not follow.
 */
function bowlSolids(B: Slag['bowl']): Array<{ c: V3; r: V3 }> {
  const { H, R } = rimOf(B), D = B.dome ?? 0, top = D ? H : H - B.sand, out: Array<{ c: V3; r: V3 }> = [];
  const n = 5;
  for (let q = 0; q < n; q++) {
    const zc = top * (q + 0.5) / n, hz = Math.min(zc, top - zc + (D ? D * 0.5 : 0), top * 0.34);
    // As wide as it can be with every height of it inside the outside there.
    let r = Infinity;
    for (let j = -20; j <= 20; j++) {
      const z = zc + hz * j / 20.5, f = 1 - ((z - zc) / hz) ** 2;
      if (z < 0 || f <= 0) continue;
      const wall = z <= H ? profAt(B, z / H).r : R;
      r = Math.min(r, wall * 0.97 / Math.sqrt(f));
    }
    out.push({ c: [0, 0, zc], r: [r, r, hz] });
  }
  if (D) out.push({ c: [0, 0, H], r: [R * 0.96, R * 0.96, D * 0.96] });
  return out;
}

/**
 * How far a point is inside the crucible's outside, with `th` round it, and the way out of it there, in the crucible's frame:
 * the wall's outward normal at that height. Nothing for a point under its foot or over its top, where there is no wall.
 */
function intoBowl(B: Slag['bowl'], q: V3, th: number): { pen: number; n: V3 } | null {
  const { H, R } = rimOf(B), D = B.dome ?? 0, z = q[2], d = Math.hypot(q[0], q[1]);
  if (z < 0 || z > H + D) return null;
  const a: V3 = d > 1e-6 ? [q[0] / d, q[1] / d, 0] : [0, 1, 0];
  if (z <= H) {
    const w = profAt(B, z / H);
    return { pen: w.r + th - d, n: unit([a[0], a[1], -w.dr]) };
  }
  const s = (z - H) / D, r = R * Math.sqrt(Math.max(0, 1 - s * s));
  return { pen: r + th - d, n: unit([a[0] * Math.sqrt(Math.max(0, 1 - s * s)) / R, a[1] * Math.sqrt(Math.max(0, 1 - s * s)) / R, s / D]) };
}

/** The point in the world frame of a frame whose turn is square (the transpose undoes it). */
const local = (x: Xf, p: V3): V3 => {
  const m = x.m, d = sub(p, x.t);
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
};
/** A way in a frame, in the world. */
const turned = (x: Xf, v: V3): V3 => sub(place(x, v), x.t);

/**
 * How far to move something `th` thick at `p` so it is clear of the crucible's outside, along the wall's outward normal: nought
 * well clear of it, and easing in over the last `soft` of the way, so a knee or a claw coming up to the wall slides off it
 * smoothly rather than stopping dead on it.
 */
function clearOf(B: Slag['bowl'], shell: Xf, p: V3, th: number, soft: number): V3 {
  let at = p;
  for (let i = 0; i < 3; i++) {
    const hit = intoBowl(B, local(shell, at), th);
    if (!hit) break;
    const pen = 0.5 * (hit.pen + Math.sqrt(hit.pen * hit.pen + soft * soft)) - 0.5 * soft;
    if (pen <= 1e-4) break;
    at = add(at, scale(turned(shell, hit.n), pen));
  }
  return sub(at, p);
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** A frame with its `y` (the length of the bone) stretched by `k`: a leg or an arm part reaching a joint moved off the wall. */
const stretched = (x: Xf, k: number): Xf => ({ m: [x.m[0], x.m[1] * k, x.m[2], x.m[3], x.m[4] * k, x.m[5], x.m[6], x.m[7] * k, x.m[8]], t: x.t });

/** The top of its metal, in the crucible's frame: the middle of the pool, or the middle of the mouth where it is domed over. */
function poolTopLocal(B: Slag['bowl']): V3 {
  const { H } = rimOf(B);
  if (B.dome) {
    const m = B.mouth!, at = onBowl(B, 0, m.f);
    return add(at.p, scale(at.n, -0.05));
  }
  return [0, 0, H - B.sand + B.heap];
}

/**
 * The crucible: a thick-walled pot of cream stone laid in blocks, course on
 * course, a flat rim of blocks round its top, its inside darker, and its
 * metal filling it to a little under the rim, swelling in the middle,
 * glowing gold to orange, a bright swirl drawn on it; or, on an Alloyster,
 * a dome of stone tiles over it in place of the open top. With it, for each
 * corner, how much of the swell it is (so the metal can rise).
 */
function bowlOf(s: Slag, n0: number): { mesh: Mesh; heap: number[] } {
  const B = s.bowl, P = B.prof, { H, R } = rimOf(B), segs = B.segs;
  const n = Math.max(segs, Math.round(n0 / segs) * segs);
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], heap: number[] = [];
  // Which of the two creams a block is, course by course, half a block on from the one under it.
  const blockMat = (course: number, j: number): Mat => ((Math.floor(((j + (course % 2) * 0.5 * (n / segs)) / n) * segs) + course) % 2 ? 'stone' : 'shell');
  const ring = (z: number, r: number, hk = 0): number => {
    const base = v.length;
    for (let j = 0; j < n; j++) {
      const th = (j / n) * TAU;
      v.push([Math.sin(th) * r, Math.cos(th) * r, z]);
      heap.push(hk);
    }
    return base;
  };
  const band = (a: number, b: number, m: (j: number) => Mat, out: (c: V3) => V3): void => {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [a + j, a + j2, b + j2, b + j];
      const c = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25);
      f.push({ i: idx, m: m(j) });
      want.push(out(c));
    }
  };
  const outward = (c: V3): V3 => unit([c[0], c[1], 0.15]);
  const inward = (c: V3): V3 => unit([-c[0], -c[1], 0.4]);
  // The outside, course by course from its foot.
  const outer = P.map(([z, r]) => ring(z, r));
  const foot = v.length;
  v.push([0, 0, -0.02]);
  heap.push(0);
  for (let j = 0; j < n; j++) {
    f.push({ i: [foot, outer[0] + ((j + 1) % n), outer[0] + j], m: 'stoneDark' });
    want.push([0, 0, -1]);
  }
  for (let k = 0; k < outer.length - 1; k++) band(outer[k], outer[k + 1], (j) => blockMat(k, j), outward);
  if (B.dome) {
    // A dome of stone tiles over it, in courses up to a cap, the tiles' joints half a tile on course by course.
    let last = outer[outer.length - 1];
    const steps = 4;
    for (let q = 1; q <= steps; q++) {
      const ph = (q / steps) * (Math.PI / 2) * 0.86, r = R * Math.cos(ph), z = H + B.dome * Math.sin(ph);
      const next = ring(z, r);
      band(last, next, (j) => (blockMat(outer.length + q, j) === 'stone' ? 'feather' : 'featherDark'), (c) => unit([c[0], c[1], 0.6 + q * 0.3]));
      last = next;
    }
    const cap = v.length;
    v.push([0, 0, H + B.dome]);
    heap.push(0);
    for (let j = 0; j < n; j++) {
      f.push({ i: [last + j, last + ((j + 1) % n), cap], m: 'featherDark' });
      want.push([0, 0, 1]);
    }
  } else {
    // A flat rim of blocks round the top, and down the inside to the metal.
    const rIn = R - B.wall;
    const topOut = ring(H + 0.02, R * 1.015), topIn = ring(H + 0.02, rIn);
    band(outer[outer.length - 1], topOut, (j) => blockMat(outer.length, j), outward);
    band(topOut, topIn, (j) => blockMat(outer.length + 1, j), () => [0, 0, 1]);
    const zs = H - B.sand, rs = profAt(B, zs / H).r - B.wall;
    const edge = ring(zs, rs);
    band(topIn, edge, () => 'stoneDark', inward);
    // The metal, swelling from the wall to the middle: orange at the wall, gold, and white-gold in the middle.
    let last = edge;
    const mats: Mat[] = ['ember', 'ember', 'flame', 'bloom'];
    [0.8, 0.55, 0.3].forEach((rho, q) => {
      const k = 1 - rho * rho, hz = zs + B.heap * k;
      const next = ring(hz, rs * rho, k);
      band(last, next, () => mats[q], () => [0, 0, 1]);
      last = next;
    });
    const top = v.length;
    v.push([0, 0, zs + B.heap]);
    heap.push(1);
    for (let j = 0; j < n; j++) {
      f.push({ i: [last + j, last + ((j + 1) % n), top], m: 'bloom' });
      want.push([0, 0, 1]);
    }
  }
  const m = mesh(v, wound(v, f, want));
  // Painted on: the swirl on the metal, the mouth, the face, the slots and the crest.
  const d: Disc[] = [];
  if (!B.dome) {
    const zs = H - B.sand, rs = profAt(B, zs / H).r - B.wall;
    // A swirl: two unbroken ribbons winding in to the middle, each orange-gold under a narrower bright gold, and the middle white-hot.
    const zOf = (r: number, lift: number): number => zs + B.heap * (1 - (Math.min(r, rs) / rs) ** 2) + lift;
    for (let arm = 0; arm < 2; arm++) {
      for (const [m, wk, lift] of [['flame', 2.1, 0.01], ['bloom', 0.9, 0.016]] as Array<[Mat, number, number]>) {
        const outer: V3[] = [], inner: V3[] = [];
        for (let q = 0; q <= 40; q++) {
          const u = q / 40, th = arm * Math.PI + u * TAU * 1.3, r = rs * (0.92 - 0.8 * u), w = rs * 0.055 * wk * (1 - 0.55 * u);
          const sn = Math.sin(th), cs = Math.cos(th);
          outer.push([sn * (r + w), cs * (r + w), zOf(r + w, lift)]);
          inner.push([sn * Math.max(0, r - w), cs * Math.max(0, r - w), zOf(r - w, lift)]);
        }
        d.push({ v: [...inner, ...outer.reverse()], m });
      }
    }
    d.push(disc([0, 0, zs + B.heap + 0.02], [0, 0, 1], rs * 0.2, rs * 0.2, 12, 'bloom', { lit: true }));
    d.push(disc([0, 0, zs + B.heap + 0.024], [0, 0, 1], rs * 0.09, rs * 0.09, 10, 'glint', { lit: true }));
  }
  if (B.mouth) {
    // The mouth of the furnace: a copper frame, its glow orange at the edge and white-gold in the middle, lumps glowing in it.
    // Each a shape laid round the wall, so it follows the curve of it however wide it is: a wide rounded oblong.
    const M = B.mouth, { H } = rimOf(B);
    const layers: Array<[Mat, number, number, boolean]> = [['billDark', 1, 1, false], ['ember', 0.9, 0.82, true], ['flame', 0.74, 0.6, true], ['bloom', 0.46, 0.34, true]];
    layers.forEach(([m, ka, kh, lit], k) => {
      const A = M.w * ka, hh = M.h * 0.5 * kh, top: V3[] = [], bot: V3[] = [];
      for (let q = 0; q <= 20; q++) {
        const az = -A + (2 * A * q) / 20, e = Math.cbrt(Math.max(0, 1 - Math.abs(az / A) ** 3));
        for (const [sd, list] of [[1, top], [-1, bot]] as const) {
          const at = onBowl(B, az, M.f + (sd * e * hh) / H);
          list.push(add(at.p, scale(at.n, 0.012 + 0.005 * k)));
        }
      }
      d.push({ v: [...top, ...bot.reverse()], m, lit });
    });
    // Lumps in the glow, along its bottom.
    for (let q = 0; q < 7; q++) {
      const az = (q - 3) * M.w * 0.2, at = onBowl(B, az, M.f), z = -M.h * (0.2 + 0.08 * jitter(q + 2));
      d.push(disc(add(add(at.p, scale(at.n, 0.034)), [0, 0, z]), at.n, 0.06 + 0.04 * jitter(q), 0.045, 6, q % 2 ? 'bloom' : 'ember', { up: [0, 0, 1], lit: true, spin: jitter(q + 5) }));
    }
  }
  if (B.face) {
    // Its face on the front of the crucible: two big brown eyes with glints, an open smile with a pink tongue, rosy cheeks.
    const fz = 0.6;
    for (const sd of [-1, 1]) {
      const e = onBowl(B, sd * 18, fz), r = 0.125;
      d.push(disc(add(e.p, scale(e.n, 0.012)), e.n, r * 0.92, r, 12, 'eye', { up: [0, 0, 1] }));
      const g1 = add(e.p, add(scale(e.n, 0.02), [0, 0, r * 0.38]));
      d.push(disc(add(g1, [sd * -0.02, 0, 0]), e.n, r * 0.36, r * 0.36, 8, 'glint', { up: [0, 0, 1], lit: true }));
      d.push(disc(add(e.p, add(scale(e.n, 0.02), [sd * 0.03, 0, -r * 0.42])), e.n, r * 0.16, r * 0.16, 6, 'glint', { up: [0, 0, 1], lit: true }));
      const c = onBowl(B, sd * 30, 0.36);
      d.push(disc(add(c.p, scale(c.n, 0.011)), c.n, 0.08, 0.05, 10, 'petal', { up: [0, 0, 1] }));
    }
    // An open smile: a dark half-round, flat side up, a pink tongue in its bottom.
    const mo = onBowl(B, 0, 0.3), smile: V3[] = [];
    for (let q = 0; q <= 12; q++) {
      const t = Math.PI * (q / 12), az = -Math.cos(t) * 7, at = onBowl(B, az, 0.36 - Math.sin(t) * 0.17);
      smile.push(add(at.p, scale(at.n, 0.012)));
    }
    d.push({ v: smile.reverse(), m: 'nose' });
    d.push(disc(add(mo.p, add(scale(mo.n, 0.018), [0, 0, -0.012])), mo.n, 0.045, 0.026, 10, 'tongue', { up: [0, 0, 1] }));
  }
  if (B.slots) {
    // Glowing slots round the top of the wall, one in each block.
    for (let q = 0; q < B.slots; q++) {
      const az = (q + 0.5) * (360 / B.slots), at = onBowl(B, az, 0.64);
      if (B.crest && Math.abs(((az + 180) % 360) - 180) < 20) continue;
      d.push(disc(add(at.p, scale(at.n, 0.012)), at.n, 0.045, 0.1, 4, 'flame', { up: [0, 0, 1], lit: true, spin: Math.PI / 4 }));
    }
  }
  if (B.crest) {
    // A shield of copper on its front, its point down, a flame on it.
    // Each outline laid on the wall point by point, so it follows its curve: across in degrees round it, up in fractions of it.
    const C = B.crest, R0 = profAt(B, C.f).r;
    const laid = (pts: ReadonlyArray<readonly [number, number]>, k: number, dv: number, lift: number): V3[] => pts.map(([u, v]) => {
      const at = onBowl(B, ((u * C.r * k) / R0) / DEG, C.f + (dv + v * C.r * k) / H);
      return add(at.p, scale(at.n, lift));
    });
    const SHIELD = [[-1, 0.85], [-0.5, 1], [0, 0.88], [0.5, 1], [1, 0.85], [1, 0.1], [0.62, -0.55], [0, -1.05], [-0.62, -0.55], [-1, 0.1]] as const;
    const FLAME = [[0, 0.95], [0.22, 0.45], [0.42, 0.05], [0.38, -0.35], [0.18, -0.55], [0, -0.6], [-0.18, -0.55], [-0.38, -0.35], [-0.42, 0.05], [-0.1, 0.3]] as const;
    d.push({ v: laid(SHIELD, 1.14, 0, 0.012), m: 'billDark' });
    d.push({ v: laid(SHIELD, 1, 0, 0.02), m: 'bill' });
    d.push({ v: laid(FLAME, 0.62, 0, 0.028), m: 'flame', lit: true });
    d.push({ v: laid(FLAME, 0.34, -C.r * 0.1, 0.034), m: 'bloom', lit: true });
    for (const [u, v] of [[-0.78, 0.7], [0.78, 0.7], [-0.72, 0.0], [0.72, 0.0]] as const) {
      const at = onBowl(B, ((u * C.r) / R0) / DEG, C.f + (v * C.r) / H);
      d.push(disc(add(at.p, scale(at.n, 0.03)), at.n, C.r * 0.07, C.r * 0.07, 6, 'billDark', { up: [0, 0, 1] }));
    }
  }
  const sp = paint(d);
  return { mesh: merge(m, sp), heap: [...heap, ...sp.v.map(() => 0)] };
}

/* ---- what is on the crucible ----------------------------------------------------------- */

/** A ring of copper round the crucible `f` up it, its rivets a block apart. */
function bandOf(B: Slag['bowl'], f: number, n: number): Mesh {
  const pts: V3[] = [], q = profAt(B, f), R = q.r + 0.012, th = 0.045 + 0.02 * (R - 0.6);
  for (let j = 0; j <= n * 2; j++) {
    const a = (j / (n * 2)) * TAU;
    pts.push([Math.sin(a) * R, Math.cos(a) * R, q.z]);
  }
  const ring = tube(pts, th * 0.6, th, 5, 'bill', { up: [0, 0, 1], start: false, end: false });
  const rivets: Mesh[] = [];
  for (let j = 0; j < B.segs; j++) {
    const a = ((j + 0.5) / B.segs) * TAU, p: V3 = [Math.sin(a) * (R + th * 0.55), Math.cos(a) * (R + th * 0.55), q.z];
    rivets.push(orb(p, th * 0.42, 6, 3, 'billDark'));
  }
  return merge(ring, ...rivets);
}

/** A copper chimney, from `root` straight up `h`: a pipe, a collar round its foot and a wider lip at its top, dark in its mouth. */
function chimneyOf(root: V3, r: number, h: number): Mesh {
  const top = add(root, [0, 0, h]);
  return merge(
    tube([add(root, [0, 0, -0.04]), add(root, [0, 0, h * 0.5]), top], [r, r * 0.96, r * 0.94], [r, r * 0.96, r * 0.94], 8, (ring) => (ring === 1 ? 'billDark' : 'bill')),
    tube([add(root, [0, 0, -0.02]), add(root, [0, 0, 0.05])], r * 1.3, r * 1.3, 8, 'billDark'),
    tube([add(top, [0, 0, -0.07]), add(top, [0, 0, 0.005])], r * 1.32, r * 1.32, 8, 'bill', { end: false }),
    paint([disc(add(top, [0, 0, 0.004]), [0, 0, 1], r * 1.05, r * 1.05, 8, 'billDark')]),
  );
}

/** Where a chimney stands: on the rim's blocks, or up the dome as far in as `inset` says. */
function chimneyRoot(B: Slag['bowl'], c: Chimney): V3 {
  const { H, R } = rimOf(B);
  return B.dome ? onDome(B, c.az, c.inset ?? 0.3).p : [Math.sin(c.az * DEG) * (R - B.wall * 0.5), Math.cos(c.az * DEG) * (R - B.wall * 0.5), H + 0.02];
}

/**
 * Everything standing on the crucible, each a piece of its own grown in from its root as it evolves: its chimneys, the band,
 * the strap and cupola of a dome, the tower in a Moltenex's pool with its two stirring pipes.
 */
function fixturesOf(s: Slag, n: number, k: number): Array<{ mesh: Mesh; front: V3; anchor: V3 }> {
  const B = s.bowl, { H, R } = rimOf(B), out: Array<{ mesh: Mesh; front: V3; anchor: V3 }> = [];
  for (const c of s.chimneys) {
    const root = chimneyRoot(B, c);
    out.push({ mesh: chimneyOf(sub(root, [0, 0, 0.02]), c.r, c.h), front: unit([Math.sin(c.az * DEG), Math.cos(c.az * DEG), 0]), anchor: root });
  }
  if (B.band !== undefined) out.push({ mesh: bandOf(B, B.band, B.segs), front: [0, 1, 0], anchor: [0, 0, profAt(B, B.band).z] });
  if (B.dome) {
    // A copper strap over the top from front to back, and the cupola on the top of it with its finial.
    const pts: V3[] = [];
    for (let q = 0; q <= 10; q++) {
      const u = q / 10, az = u < 0.5 ? 0 : 180, up = u < 0.5 ? u * 2 : (1 - u) * 2, at = onDome(B, az, up * 0.97);
      pts.push(add(at.p, scale(at.n, 0.025)));
    }
    const strap = tube(pts, 0.03, 0.15, 5, 'bill', { up: [1, 0, 0] });
    const C = B.cupola!, top: V3 = [0, 0, H + B.dome - 0.03];
    const cup = merge(
      tube([add(top, [0, 0, -0.04]), add(top, [0, 0, C.h])], C.r, C.r, 10, 'bill'),
      tube([add(top, [0, 0, C.h * 0.45]), add(top, [0, 0, C.h * 0.62])], C.r * 1.06, C.r * 1.06, 10, 'billDark'),
      orb(add(top, [0, 0, C.h]), [C.r * 1.08, C.r * 1.08, C.r * 0.7], n, k, 'bill'),
      tube([add(top, [0, 0, C.h + C.r * 0.6]), add(top, [0, 0, C.h + C.r * 1.0])], C.r * 0.14, C.r * 0.14, 6, 'billDark'),
      orb(add(top, [0, 0, C.h + C.r * 1.1]), C.r * 0.22, 6, 3, 'bill'),
    );
    out.push({ mesh: merge(strap, cup), front: [0, 0.2, 1], anchor: top });
  }
  if (B.tower) {
    // A tower of stone standing in the middle of the pool, a copper band and dome on it with a finial, glowing windows round it;
    // two copper pipes arcing out of it and down into the metal either side.
    const T = B.tower, base: V3 = [0, 0, H - B.sand - 0.05], top = add(base, [0, 0, T.h]);
    const body = tube([base, add(base, [0, 0, T.h * 0.55]), top], [T.r * 1.1, T.r, T.r], [T.r * 1.1, T.r, T.r], 10, (ring) => (ring === 1 ? 'shell' : 'stone'));
    const collar = tube([add(top, [0, 0, -0.06]), add(top, [0, 0, 0.04])], T.r * 1.35, T.r * 1.35, 10, 'bill');
    const brim = tube([add(top, [0, 0, 0.04]), add(top, [0, 0, 0.08])], T.r * 1.6, T.r * 1.6, 12, 'billDark');
    const dome = orb(add(top, [0, 0, 0.08]), [T.r * 1.2, T.r * 1.2, T.r * 0.85], n, k, 'bill');
    const fin = merge(tube([add(top, [0, 0, 0.08 + T.r * 0.8]), add(top, [0, 0, 0.08 + T.r * 1.2])], T.r * 0.12, T.r * 0.12, 6, 'billDark'), orb(add(top, [0, 0, 0.1 + T.r * 1.3]), T.r * 0.2, 6, 3, 'bill'));
    const slitBand = tube([add(top, [0, 0, -0.3]), add(top, [0, 0, -0.08])], T.r * 1.08, T.r * 1.08, 12, 'billDark');
    const wins: Disc[] = [];
    for (let q = 0; q < 10; q++) {
      const a = (q / 10) * TAU, nn: V3 = [Math.sin(a), Math.cos(a), 0];
      wins.push(disc(add(add(top, [0, 0, -0.19]), scale(nn, T.r * 1.08 + 0.012)), nn, 0.026, 0.085, 8, 'flame', { up: [0, 0, 1], lit: true }));
    }
    const pipes: Mesh[] = [];
    for (const sd of [-1, 1]) {
      const from = add(top, [sd * T.r * 0.85, 0, -0.1]), into: V3 = [sd * (R - B.wall) * 0.62, 0.1, H - B.sand - 0.02];
      const ctl: V3 = [sd * (R - B.wall) * 0.55, 0.05, top[2] + 0.22];
      const pts: V3[] = [];
      for (let q = 0; q <= 10; q++) {
        const u = q / 10, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
        pts.push([a * from[0] + b * ctl[0] + c * into[0], a * from[1] + b * ctl[1] + c * into[1], a * from[2] + b * ctl[2] + c * into[2]]);
      }
      pipes.push(tube(pts, 0.085, 0.085, 7, (ring) => (ring === 0 || ring === 9 ? 'billDark' : 'bill')));
    }
    out.push({ mesh: merge(body, slitBand, collar, brim, dome, fin, paint(wins), ...pipes), front: [0, 0.3, 1], anchor: base });
  }
  return out;
}

/** Where steam comes out of it, in the crucible's frame: each chimney's mouth, and how big a chimney it is. */
const ventsOf = (s: Slag): Array<{ at: V3; r: number }> => s.chimneys.map((c) => ({ at: add(chimneyRoot(s.bowl, c), [0, 0, c.h - 0.02]), r: c.r }));

/* ---- the crab --------------------------------------------------------------------------- */

/**
 * The body: cream, in segments with a copper crease between each, from
 * the back of the crucible to its front, all but hidden under it; its face is
 * on the crucible.
 */
/** The body's half-width, half-depth or height of its middle `y` along it. */
function ringAt(R: Rings, y: number, q: 'w' | 'h' | 'z'): number {
  let i = 0;
  while (i < R.y.length - 2 && R.y[i + 1] < y) i++;
  return lerp(R[q][i], R[q][i + 1], clamp((y - R.y[i]) / (R.y[i + 1] - R.y[i])));
}

function bodyOf(s: Slag, n: number): Mesh {
  const R = s.body, y0 = R.y[0], y1 = R.y[R.y.length - 1];
  const at = (y: number, q: 'w' | 'h' | 'z'): number => ringAt(R, y, q);
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
  return trunk;
}

/** Where on a hand its fixed finger's tip is, in the hand's frame: what is put on the ground or at what it pinches. */
const tipOf = (h: number): V3 => [0, h * 1.35, -h * 0.06];
/** Where on a hand the movable finger is hinged. */
const hingeOf = (h: number): V3 => [0, h * 0.6, h * 0.22];

/**
 * A hand, along the bone's `y` from the wrist with its movable finger on
 * top: a broad flat palm, deep from top to bottom and thin from side to
 * side, cream; and the fixed finger, long and curved, out of the bottom of
 * its end and sweeping up, copper from its root to its tip.
 */
function handOf(h: number, n: number, k: number): Mesh {
  const c: V3 = [0, h * 0.36, 0], r: V3 = [h * 0.2, h * 0.42, h * 0.38];
  const palm = orbAlong(c, [0, 1, 0], [r[0], r[2], r[1]], n, k, 'horn');
  const wrist = tube([[0, -h * 0.06, 0], [0, h * 0.1, 0]], h * 0.15, h * 0.2, 6, 'horn');
  const finger = tube([[0, h * 0.58, -h * 0.18], [0, h * 0.86, -h * 0.25], [0, h * 1.12, -h * 0.22], [0, h * 1.27, -h * 0.13], tipOf(h)],
    [h * 0.16, h * 0.14, h * 0.1, h * 0.06, h * 0.015], [h * 0.19, h * 0.15, h * 0.1, h * 0.06, h * 0.015], 6, (ring) => (ring >= 1 ? 'hornDark' : 'horn'));
  // Teeth along the inside of the fixed finger, pointing up at the movable one.
  const teeth = [[0.72, -0.045], [0.9, -0.09], [1.06, -0.11], [1.2, -0.09]].map(([y, z]) =>
    tube([[0, h * y, h * (z - 0.02)], [0, h * (y + 0.03), h * (z + 0.08)]], [h * 0.05, h * 0.004], [h * 0.04, h * 0.004], 4, 'horn'));
  return merge(wrist, palm, finger, ...teeth);
}

/** The movable finger, from its hinge along `y`: thick at the hinge, curving down to a peach tip that meets the fixed one shut. */
function nipOf(h: number): Mesh {
  return tube([[0, -h * 0.05, 0], [0, h * 0.28, h * 0.04], [0, h * 0.54, -h * 0.07], [0, h * 0.75, -h * 0.28]], [h * 0.15, h * 0.13, h * 0.08, h * 0.015], [h * 0.17, h * 0.13, h * 0.08, h * 0.015], 6,
    (ring) => (ring >= 1 ? 'hornDark' : 'horn'));
}

/** The movable finger with teeth along its inside, pointing down at the fixed one. */
function nipToothed(h: number): Mesh {
  const teeth = [[0.34, -0.1], [0.5, -0.15], [0.63, -0.21]].map(([y, z]) =>
    tube([[0, h * y, h * (z + 0.02)], [0, h * (y + 0.03), h * (z - 0.07)]], [h * 0.045, h * 0.004], [h * 0.035, h * 0.004], 4, 'horn'));
  return merge(nipOf(h), ...teeth);
}

/** A copper rivet hub on the outside of a hand by its wrist, a dark boss in its middle: a Moltenex's. */
function hubOf(h: number): Mesh {
  return merge(...[1, -1].map((sd) => merge(
    orbAlong([sd * h * 0.19, h * 0.16, h * 0.02], [sd, 0, 0], [h * 0.15, h * 0.15, h * 0.06], 10, 3, 'bill'),
    orbAlong([sd * h * 0.25, h * 0.16, h * 0.02], [sd, 0, 0], [h * 0.06, h * 0.06, h * 0.03], 8, 3, 'billDark'),
  )));
}

/** A leg's upper part, along `y` from its hip into the body to its knee: peach, chunky, a cream band at the knee. */
function upperOf(s: Slag): Mesh {
  const L = s.legs.upper, w = s.legs.thick;
  // Its root reaching in past the hip, under the crucible, as far as the body's side.
  return tube([[0, -w * 1.2 - (s.legs.root ?? 0), 0], [0, L * 0.2, 0], [0, L * 0.82, 0], [0, L + w * 0.3, 0]], [w, w * 1.05, w * 0.95, w * 0.85], [w, w * 1.05, w * 0.95, w * 0.85], 6,
    (ring) => (ring === 2 ? 'coatDark' : 'horn'), { seam: 'start' });
}

/**
 * A leg's lower part, from the knee along `y` to the tip of its foot,
 * arched up between them (along `z`): two segments of cream shell with a
 * peach crease between them, and a peach tip.
 */
function lowerOf(s: Slag): Mesh {
  const L = s.legs.lower, w = s.legs.thick * 0.9, A = s.legs.arch * L;
  const pts: V3[] = [[0, -w * 0.4, 0], [0, L * 0.3, A * 0.8], [0, L * 0.5, A], [0, L * 0.56, A * 0.97], [0, L * 0.82, A * 0.55], [0, L - 0.012, 0.016]];
  const ws = [w * 0.95, w, w * 0.84, w * 0.82, w * 0.55, 0.008];
  return tube(pts, ws, ws, 6, (ring) => (ring === 2 ? 'coatDark' : ring >= 4 ? 'hornDark' : 'horn'));
}

/* ---- its moves --------------------------------------------------------------------------- */

/** The strike: when it is gathered, when the claw lands, and when it lets go. */
export const SLAG_STRIKE = { gather: 0.46, hit: 0.58, hold: 0.68 };
const STRIKE = SLAG_STRIKE;
/**
 * A go at its task: the claws at the ground ahead, dragged back along it
 * gathering lumps of ore, lifted up over its front, the lumps tossed into
 * its metal (or its furnace's mouth), landing with a flare, sparks and a
 * puff of steam, and the claws back down to the ground ahead.
 */
export const SLAG_WORK = { dig: 0.12, scoop: 0.26, lift: 0.52, toss: 0.56, land: 0.68, back: 1 };
const WORK = SLAG_WORK;

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
const kOf = (s: Slag): number => s.high / SLAGLET_LOOK.high;

/** How far a claw reaches: its arm and its big hand to the tip of the finger. Every move of a claw is posed in this, so it is in reach whatever the stage. */
const clawLen = (s: Slag, sd = 1): number => s.claw.arm[0] + s.claw.arm[1] + 1.35 * s.claw.hand[sd > 0 ? 1 : 0];
/**
 * A claw put down on the ground: its wrist `fwd` of the arm's length ahead
 * of the shoulder and `out` to its side, let down until the tip of its
 * finger, its hand tipped down by `pitch`, is on the ground. Within reach by
 * how it is made, whatever the size of the hand.
 */
function groundAt(s: Slag, sd: number, fwd: number, out: number, pitch: number, open: number, yaw = 0, roll = 12): Claw {
  const C = s.claw.at, A = s.claw.arm[0] + s.claw.arm[1], h = s.claw.hand[sd > 0 ? 1 : 0];
  const tip = place(joint(ROOT, [0, 0, 0], pitch, sd * roll, sd * yaw), tipOf(h));
  return { tip: [sd * (C[0] + out * A) + tip[0], C[1] + fwd * A + tip[1], 0], pitch, yaw: sd * yaw, roll: sd * roll, open };
}

/** A claw at rest: its finger's tip on the ground ahead and out to its side, the hand stood up on it. */
const restClaw = (s: Slag, sd: number): Claw => groundAt(s, sd, s.claw.rest.fwd, s.claw.rest.out[sd > 0 ? 1 : 0], s.claw.rest.pitch, s.claw.rest.open, s.claw.rest.yaw ?? 8, s.claw.rest.roll ?? 12);

/**
 * A claw posed by where its wrist goes: `fwd` and `up` of the arm's length
 * from the shoulder as the body stands, `out` further to its side, the hand
 * tipped up by `pitch` from there. What a raised claw is posed by, so its arm
 * is never folded up against its shoulder however big its hand.
 */
function wristAt(s: Slag, sd: number, fwd: number, up: number, out: number, pitch: number, open: number, yaw = 0, roll = 12): Claw {
  const C = s.claw.at, A = s.claw.arm[0] + s.claw.arm[1], h = s.claw.hand[sd > 0 ? 1 : 0];
  const hand = joint(ROOT, [0, 0, 0], pitch, sd * roll, sd * yaw), tip = place(hand, tipOf(h));
  return { tip: [sd * (C[0] + out * A) + tip[0], C[1] + fwd * A + tip[1], s.high + C[2] + up * A + tip[2]], pitch, yaw: sd * yaw, roll: sd * roll, open };
}

/** The pose standing, before anything else: breathing, its eyes wandering, now and then a claw opened and shut. */
function standPose(s: Slag, a: Anim): Pose {
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
function goPose(s: Slag, p: Pose, a: Anim): void {
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
function strikePose(s: Slag, p: Pose, t: number): void {
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
function workPose(s: Slag, p: Pose, t: number, graze: number): void {
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
function evolvePose(s: Slag, p: Pose, t: number): void {
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
function poseOf(s: Slag, a: Anim): Pose {
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
const hipOf = (s: Slag, i: number, sd: number): V3 => [sd * s.legs.x, s.legs.ys[i], s.legs.z];
/** Which of the two sets of four a leg is in: the front and third on one side with the second and back on the other. */
const setOf = (i: number, sd: number): number => (i + (sd > 0 ? 0 : 1)) % 2;

/**
 * Where a foot is on the ground: standing, out from its hip by `reach` and
 * fanned round; going, swept back evenly under the body while it is down and
 * lifted and brought forward again while it is not, its set of four by turns
 * with the other -- so four feet are always down, and each stays where it
 * was put while it is.
 */
function footOf(s: Slag, i: number, sd: number, a: Anim): V3 {
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
function slagBones(s: Slag): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [0, p.y, p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    const B = s.bowl, k = kOf(s);
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
      // Never into the crucible either: the hand moved off its wall along the wall's normal by however far its wrist, palm or
      // fingers would go into it (claws held up as it goes, or lifted over its face, come up under the swell of a big crucible).
      let push: V3 = [0, 0, 0];
      for (const [pt, th] of [[[0, 0, 0], h * 0.2], [[0, h * 0.36, 0], h * 0.38], [[0, h * 0.9, -h * 0.2], h * 0.15], [tipOf(h), h * 0.05]] as Array<[V3, number]>) {
        const off = clearOf(B, b.shell, add(wrist, turned(hand0, pt)), th, SOFT * k);
        if (len(off) > len(push)) push = off;
      }
      wrist[0] += push[0]; wrist[1] += push[1]; wrist[2] += push[2];
      const dz = FLOOR - lowOf({ m: hand0.m, t: [0, 0, 0] }, h, c.open) - wrist[2];
      wrist[2] += 0.5 * (dz + Math.sqrt(dz * dz + SOFT * SOFT));
      // Its shoulders, like its hips, go with the crucible as it rocks, so it never comes down onto its arms.
      const sh = place(b.shell, sub([sd * s.claw.at[0], s.claw.at[1], s.claw.at[2]], B.at));
      // The elbow out to the side and back, which is the one way the wrist never goes from the shoulder, so it cannot flip.
      const pole = sub(place(ground, [sd * 0.8, -1, 0]), ground.t);
      const [A1, A2] = s.claw.arm, T = s.claw.thick * 1.1;
      // The elbow off the crucible's wall, each part of the arm stretched a little to meet it there.
      const elbowOf = (): V3 => {
        const e = kneeOf(sh, wrist, A1, A2, pole);
        return add(e, clearOf(B, b.shell, e, T, SOFT * k));
      };
      let el = elbowOf();
      // And the arm itself clear of it: a claw raised high, or brought down in front, from a shoulder under the swell of a big
      // crucible would have its arm through the wall, so the hand is taken out from the crucible, level, until it is not.
      for (let i = 0; i < 6; i++) {
        let most = 0;
        for (const [from, to] of [[sh, el], [el, wrist]]) {
          for (const f of [0.3, 0.55, 0.8]) most = Math.max(most, len(clearOf(B, b.shell, lerp3(from, to, f), T, SOFT * k)));
        }
        if (most < 1e-3) break;
        const q0 = local(b.shell, wrist), r = Math.hypot(q0[0], q0[1]) || 1;
        const way = turned(b.shell, [q0[0] / r, q0[1] / r, 0]);
        wrist[0] += way[0] * most; wrist[1] += way[1] * most; wrist[2] += way[2] * most;
        el = elbowOf();
      }
      const hand: Xf = { m: hand0.m, t: wrist };
      // Each part rolled to the plane the arm bends in, which turns smoothly with it.
      const plane = cross(sub(wrist, sh), pole), roll = cross(plane, sub(el, sh));
      b[`arm${q}0`] = stretched(aim(sh, sub(el, sh), roll), len(sub(el, sh)) / A1);
      b[`arm${q}1`] = stretched(aim(el, sub(wrist, el), cross(plane, sub(wrist, el))), len(sub(wrist, el)) / A2);
      b[`claw${q}`] = hand;
      b[`nip${q}`] = joint(hand, hingeOf(h), c.open, 0, 0);
      // Its legs.
      for (let i = 0; i < 4; i++) {
        // Its hips go with the crucible as it rocks on the body, so the crucible never comes down onto its legs as it rears,
        // lurches or sways: where they are on the body standing, carried round with it.
        const hip = place(b.shell, sub(hipOf(s, i, sd), B.at)), foot = footOf(s, i, sd, a);
        const kn0 = kneeOf(hip, foot, s.legs.upper, s.legs.lower, up);
        // The knee kept off the crucible's wall, out under its swell, where a leg folding as it steps would put it up into it;
        // each part of the leg stretched a little to meet it there.
        const LT = s.legs.thick * 1.05;
        const kn = add(kn0, clearOf(B, b.shell, kn0, LT, SOFT * k));
        // Each part rolled to the plane the leg is in, by that plane's own level normal, which turns smoothly as the foot swings
        // round: rolled by the world's up instead, a part passing through upright turned half round in a moment.
        const N = cross(sub(foot, hip), up);
        const upper = stretched(inPlane(hip, sub(kn, hip), N), len(sub(kn, hip)) / s.legs.upper);
        const lower = stretched(inPlane(kn, sub(foot, kn), N), len(sub(foot, kn)) / s.legs.lower);
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

function slagBuild(s: Slag, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), nb = cut(lod, 18, 27);
  const bowl = bowlOf(s, nb), solids = bowlSolids(s.bowl);
  // How far the metal has risen and the fixtures grown this moment, from the act it is in (the pose works the same out for the bones).
  const heapOf = (a: Anim): number => (a.act?.kind === 'work' ? poseOf(s, a).heap : 0);
  const crownOf = (a: Anim): number => (a.act?.kind === 'evolve' ? poseOf(s, a).crown : 1);
  const pieces: Piece[] = [
    {
      key: 'shell', mesh: bowl.mesh, bone: 'shell', bias: 0,
      bent: (v, a) => {
        const hp = heapOf(a);
        if (!hp || s.bowl.dome) return v as V3[];
        const grow = s.bowl.heap * 1.6 * hp;
        return v.map((p, i) => [p[0], p[1], p[2] + grow * bowl.heap[i]] as V3);
      },
    },
  ];
  fixturesOf(s, n, k).forEach((d, q) => {
    pieces.push({
      key: `fix${q}`, mesh: d.mesh, bone: 'shell', bias: 0.02, after: 'shell', front: d.front,
      bent: (v, a) => {
        const g = crownOf(a);
        if (g >= 1) return v as V3[];
        return v.map((p) => add(d.anchor, scale(sub(p, d.anchor), Math.max(0.001, g))));
      },
    });
  });
  pieces.push({ key: 'body', mesh: bodyOf(s, n), bone: 'body', bias: 0.01, after: 'shell', front: [0, 1, 0], hide: solids, hideIn: 'shell' });
  const up = upperOf(s), low = lowerOf(s), knee = orb([0, 0, 0], s.legs.thick * 0.95, 6, 3, 'coatDark');
  const upS = up, lowS = merge(low, knee);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, h = s.claw.hand[q], T = s.claw.thick * (0.75 + 0.35 * h / s.claw.hand[1]);
    const front: V3 = [sd * 0.5, 1, 0];
    pieces.push(
      { key: `arm${q}0`, mesh: tube([[0, -T, 0], [0, s.claw.arm[0] + T * 0.3, 0]], T, T, 6, 'horn', { seam: 'start' }), bone: `arm${q}0`, bias: 0.02, after: 'body', front, convex: true, hide: solids, hideIn: 'shell' },
      // The forearm narrowing to the wrist, into the hand's own wrist and no wider than its palm is thick, so its end never stands
      // out of the side of the hand as a flat cap.
      { key: `arm${q}1`, mesh: merge(orb([0, 0, 0], T * 1.05, 6, 3, 'coatDark'), tube([[0, 0, 0], [0, s.claw.arm[1] * 0.55, 0], [0, s.claw.arm[1] + h * 0.04, 0]], [T * 1.05, T, Math.min(T, h * 0.17)], [T * 1.05, T, Math.min(T, h * 0.17)], 6, 'horn')), bone: `arm${q}1`, bias: 0.025, after: 'body', front, hide: solids, hideIn: 'shell' },
      { key: `claw${q}`, mesh: merge(handOf(h, n, k), s.claw.hub ? hubOf(h) : null), bone: `claw${q}`, bias: 0.03, after: [`arm${q}1`, 'body'], front, hide: solids, hideIn: 'shell' },
      { key: `nip${q}`, mesh: nipToothed(h), bone: `nip${q}`, bias: 0.035, after: `claw${q}`, front: [sd, 0.3, 0.3], hide: solids, hideIn: 'shell' },
    );
    for (let i = 0; i < 4; i++) {
      const lf: V3 = [sd, 0, 0];
      pieces.push(
        { key: `leg${i}${q}0`, mesh: upS, bone: `leg${i}${q}0`, bias: 0.01, after: 'body', front: lf, hide: solids, hideIn: 'shell' },
        { key: `leg${i}${q}1`, mesh: lowS, bone: `leg${i}${q}1`, bias: 0.015, after: `leg${i}${q}0`, front: lf, thin: s.strike === 0, hide: solids, hideIn: 'shell' },
      );
    }
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Ash and grit knocked up off the ground, warm grey; a darker grain of it. */
const ASH: RGB = [214, 194, 178];
const ASH_DARK: RGB = [176, 150, 132];
/** Sparks, white-gold to orange; the lumps it tosses in, copper and tin; and its steam, a pale pink cream. */
const SPARKS: RGB[] = [[255, 244, 196], [255, 214, 110], [255, 166, 72]];
const LUMPS: RGB[] = [[204, 128, 80], [176, 176, 184], [160, 98, 62]];
const STEAM: RGB = [246, 226, 218];
const STEAM_LIT: RGB = [255, 248, 244];
const STEAM_SHADE: RGB = [226, 196, 190];

/** Where something thrown from `p` with velocity `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A grain of grit or a lump of metal: a round dot, full strength, lit on top. */
function grain(g: CanvasRenderingContext2D, view: View, p: V3, r: number, c: RGB, al = 1): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, p);
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = css(mix(c, [255, 255, 255], 0.45), al);
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU);
  g.fill();
}

/** A spark: a bright core with a soft glow round it, never dimmer for being small. */
function spark(g: CanvasRenderingContext2D, view: View, p: V3, r: number, c: RGB, al = 1): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, p), grad = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
  grad.addColorStop(0, css([255, 252, 236], al));
  grad.addColorStop(0.3, css(c, al));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r * 2.4, 0, TAU);
  g.fill();
}

/**
 * A puff: a soft round cloud with no edge, of grit or of steam, made smaller
 * and lighter as it goes rather than fainter, so two of them over each other
 * are one cloud and not two bubbles.
 */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, life: number, dense = 0.7, flat = 0.75, col: RGB = ASH): void {
  if (life <= 0 || r <= 0) return;
  const [x, y] = onScreen(view, at), c = mix(col, [255, 248, 240], 0.4 * (1 - life)), rr = r * (0.4 + 0.6 * life);
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
 * A puff of steam, as drawn: three or four soft rounds run together into
 * one lumpy cloud, pale pink cream, lit on its upper side and a shade darker
 * under, growing as it rises and thinning to nothing at the last.
 */
function steamPuff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number, seed: number): void {
  if (al <= 0.01 || r <= 0) return;
  const [x, y] = onScreen(view, at);
  const lumps: Array<[number, number, number]> = [[0, 0, 1], [-0.62, 0.22, 0.72], [0.6, 0.18, 0.76], [0.12 * (jitter(seed) - 0.5), -0.5, 0.7]];
  for (const [dx, dy, k] of lumps) {
    const cx = x + dx * r, cy = y + dy * r, rr = r * k;
    const grad = g.createRadialGradient(cx - rr * 0.25, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
    grad.addColorStop(0, css(STEAM_LIT, al));
    grad.addColorStop(0.55, css(STEAM, al * 0.95));
    grad.addColorStop(0.85, css(STEAM_SHADE, al * 0.6));
    grad.addColorStop(1, css(STEAM_SHADE, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.fill();
  }
}

/**
 * A ring of grit going out over the ground from `c`, `r` across and `w`
 * thick: one soft band lying flat on the ground, densest along its middle and
 * fading to nothing either side. Its half on the viewer's side of the body is
 * drawn over the body and the rest under it.
 */
function dustRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, w: number, al: number, mid: V3, front: boolean): void {
  if (al <= 0.01 || r <= 0 || w <= 0) return;
  const [ox, oy] = onScreen(view, c), T = view.T;
  g.save();
  g.transform(view.ex[0], view.ex[1], view.ey[0], view.ey[1], ox, oy);
  const nl = Math.hypot(T[0], T[1]) || 1, n: [number, number] = [T[0] / nl, T[1] / nl], perp: [number, number] = [-n[1], n[0]];
  const d = -((c[0] - mid[0]) * T[0] + (c[1] - mid[1]) * T[1] + (0.03 - mid[2]) * T[2]) / nl, L = r + w + 1, side = front ? 1 : -1;
  g.beginPath();
  g.moveTo(n[0] * d + perp[0] * L, n[1] * d + perp[1] * L);
  g.lineTo(n[0] * d - perp[0] * L, n[1] * d - perp[1] * L);
  g.lineTo(n[0] * (d + side * 2 * L) - perp[0] * L, n[1] * (d + side * 2 * L) - perp[1] * L);
  g.lineTo(n[0] * (d + side * 2 * L) + perp[0] * L, n[1] * (d + side * 2 * L) + perp[1] * L);
  g.closePath();
  g.clip();
  const inner = Math.max(0, r - w), col = mix(ASH, ASH_DARK, 0.45);
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

/** How big a lump or a grain in the air is, on a Slaglet: big enough to be a speck at the size it is played at. */
const CLUMP = 0.1;
/** How big a stage's things in the air are drawn, against the Slaglet's. */
const bigness = (s: Slag): number => Math.sqrt(kOf(s));
/** The top of its metal, over the ground: the pool's middle, or the mouth of a dome. */
const heapTop = (s: Slag, b: Bones): V3 => place(b.shell, poolTopLocal(s.bowl));
/** The tip of a claw's fixed finger, where it is. */
const tipAt = (s: Slag, b: Bones, q: number): V3 => place(b[`claw${q}`], tipOf(s.claw.hand[q]));
/** Whether a point is inside the crucible under its rim (or inside its dome), where nothing thrown into it is seen. */
function inBowl(s: Slag, b: Bones, p: V3): boolean {
  const x = b.shell, m = x.m, d = sub(p, x.t), l: V3 = [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
  const { H } = rimOf(s.bowl);
  return l[2] < H && l[2] > 0 && Math.hypot(l[0], l[1]) < profAt(s.bowl, l[2] / H).r;
}

/** Sparks jumping off the metal, `count` of them from `since` seconds ago, each from its own place on the pool or out of the mouth. */
function sparkle(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, since: number, count: number, seed: number, front: boolean, al = 1, life = 0.7): void {
  if (since < 0 || since > life) return;
  const B = s.bowl, mid = b.shell.t, big = bigness(s), { R } = rimOf(B), top = heapTop(s, b);
  const fwd = sub(place(b.shell, [0, 1, 0]), b.shell.t);
  for (let q = 0; q < count; q++) {
    const t = since - 0.08 * jitter(q * 3 + seed);
    if (t < 0) continue;
    const a = jitter(q + seed) * TAU, rr = (B.dome ? 0.3 : 0.7) * (R - B.wall) * Math.sqrt(jitter(q + 11 + seed));
    const from: V3 = B.dome ? add(top, scale(fwd, 0.06)) : add(top, [Math.cos(a) * rr, Math.sin(a) * rr, 0]);
    const v: V3 = B.dome ? add(scale(fwd, (1 + jitter(q + 2)) * big), [Math.cos(a) * 0.7 * big, Math.sin(a) * 0.7 * big, (1.6 + 1.6 * jitter(q + 7 + seed)) * big])
      : [Math.cos(a) * 0.6 * big, Math.sin(a) * 0.6 * big, (2 + 2 * jitter(q + 7 + seed)) * big];
    const p = thrown(from, v, t, 7);
    if ((nearSide(p, mid, view) || p[2] > top[2] + 0.15) !== front || (!B.dome && inBowl(s, b, p))) continue;
    spark(g, view, p, CLUMP * big * (0.45 + 0.3 * jitter(q + seed * 2)), SPARKS[q % 3], al * (1 - ramp(since, life * 0.6, life)));
  }
}

/**
 * Its steam: out of each chimney an unbroken plume of soft pink-cream lobes,
 * the first sat on the chimney's mouth, each rising, growing and drifting
 * as it goes and thinning away at the top, the next coming up under it;
 * thicker and quicker for a moment after something goes into its metal
 * (`boost`). Drawn top first, so each lobe's lit top rounds over the one
 * above it, as a cloud's lumps do; a far chimney's behind the body.
 */
function steam(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, a: Anim, front: boolean, boost = 0): void {
  const big = bigness(s), mid = b.shell.t;
  ventsOf(s).forEach((vt, i) => {
    const mouth = place(b.shell, vt.at);
    // A chimney on the far side steams behind the body, one on the near side in front of it.
    if (nearSide(mouth, mid, view) !== front) return;
    const n = 7, tall = (0.8 + 4 * vt.r) * big * (1 + 0.3 * boost);
    const lobes: Array<[V3, number, number, number]> = [[add(mouth, [0, 0, vt.r * 0.5]), vt.r * 1.15, 0.92, 99 + i]];
    for (let q = 0; q < n; q++) {
      const u = frac(a.t * (0.3 + 0.25 * boost) + q / n + jitter(i + 3));
      const sway = Math.sin(i * 1.7 + a.t * 0.6 + u * 3) * 0.1 * big * u;
      const lean = 0.4 * big * u * u, out = Math.hypot(vt.at[0], vt.at[1]) || 1;
      // Leaning out away from the middle as it rises, so a plume never stands over the crucible's own middle.
      const at = add(mouth, [sway + (lean * vt.at[0]) / out, (lean * vt.at[1]) / out, vt.r * 0.5 + tall * u]);
      lobes.push([at, vt.r * (1.3 + 9 * u * (1.4 - 0.4 * u)) * (1 + 0.25 * boost), 0.92 * ramp(u, 0, 0.06) * (1 - ramp(u, 0.7, 1)), i * 7 + q]);
    }
    lobes.sort((p, q) => q[0][2] - p[0][2]);
    for (const [at, r, al, seed] of lobes) steamPuff(g, view, at, r, al, seed);
  });
}

/**
 * The strike landing: a ring of grit going out over the ground under the
 * blow, a puff where it hit, grit and flecks of copper thrown up and out, and
 * sparks jumping off its metal as the crucible lurches.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, hit: Bones, t: number, front: boolean): void {
  const since = (t - STRIKE.hit) * ACT_SECS.strike;
  if (since < 0) return;
  const big = bigness(s), mid = b.body.t, crush = s.strike === 2;
  const froms: V3[] = crush ? [0, 1].map((q) => { const p = tipAt(s, hit, q); return [p[0], p[1] + 0.1, 0.05] as V3; }) : [tipAt(s, hit, 1)];
  const fade = 1 - ramp(since, 0.18, 0.3);
  for (const [fi, from] of froms.entries()) {
    const ground: V3 = [from[0], from[1], 0];
    dustRing(g, view, ground, (0.35 + 3.2 * since) * big * (crush ? 1.5 : 1), (0.22 + 0.9 * since) * big * (crush ? 1.4 : 1), 0.8 * (1 - smooth(since / 0.32)), mid, front);
    if (nearSide(from, mid, view) === front) puff(g, view, add(from, [0, 0, 0.15 * big + 1.5 * since]), (0.7 + 2.6 * since) * big * (crush ? 1.6 : 1), 1 - since / 0.3);
    const count = crush ? 22 : s.strike ? 18 : 12;
    for (let q = 0; q < count; q++) {
      const id = q + fi * 31, a = jitter(id) * TAU, sp = (1.2 + 1.6 * jitter(id + 3)) * big;
      const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp + 0.6 * big, (3.5 + 3.5 * jitter(id + 5)) * big];
      const p = thrown(from, v, since, 12);
      if (nearSide(p, mid, view) !== front) continue;
      if (q % 3 === 1) spark(g, view, p, CLUMP * big * 0.5, SPARKS[q % 3], fade);
      else grain(g, view, p, CLUMP * big * (0.8 + 0.5 * jitter(id + 1)), q % 2 ? ASH : ASH_DARK, fade);
    }
  }
  sparkle(g, view, s, b, since - 0.02, crush ? 14 : s.strike ? 10 : 7, 40, front);
}

/**
 * Its task: lumps scooped up off the ground in front of its claws, tossed
 * up and over into its metal (or into its furnace's mouth), and as they land
 * the metal flares, sparks jump off it and its chimneys puff the harder.
 */
function digSpray(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, toss: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, d = downOf(t, a.graze);
  if (d < 0.05) return;
  if (t > WORK.dig && t < WORK.scoop + 0.06) {
    const k = ramp(t, WORK.dig, WORK.dig + 0.05) * (1 - ramp(t, WORK.scoop, WORK.scoop + 0.06));
    for (let q = 0; q < 2; q++) {
      const tip = tipAt(s, b, q);
      for (let e = 0; e < 3; e++) {
        const u = frac(t * 8 + e / 3 + q * 0.17);
        const p: V3 = [tip[0] + 0.1 * big * (e - 1), tip[1] + 0.12 * big, 0.06 + 0.18 * big * Math.sin(Math.PI * u)];
        if (nearSide(p, mid, view) === front) grain(g, view, p, CLUMP * big * (0.7 + 0.3 * (e % 2)), e % 2 ? ASH : ASH_DARK, d * k);
      }
    }
  }
  const fly = (WORK.land - WORK.toss) * ACT_SECS.work, since = (t - WORK.toss) * ACT_SECS.work;
  const top = heapTop(s, toss), R = rimOf(s.bowl).R * 0.4;
  if (since >= 0 && since <= fly + 0.1) {
    for (let q = 0; q < 2; q++) {
      const from = tipAt(s, toss, q);
      for (let e = 0; e < 3; e++) {
        const lag = 0.06 * jitter(e + q * 9), u = clamp((since - lag) / fly);
        if (since < lag || u >= 1) continue;
        const goal: V3 = add(top, [(jitter(e * 3 + q) - 0.5) * R, (jitter(e * 5 + q) - 0.5) * R * 0.6, 0]);
        const arc = (0.6 + 0.4 * jitter(e + 2)) * (Math.max(0, top[2] - from[2]) + 0.7 * big);
        const across = s.bowl.dome ? u : u * u;
        const p: V3 = [lerp(from[0], goal[0], across), lerp(from[1], goal[1], across), lerp(from[2], goal[2], Math.sqrt(u)) + arc * 4 * u * (1 - u)];
        if ((nearSide(p, mid, view) || p[2] > top[2] + 0.05) !== front || (!s.bowl.dome && inBowl(s, b, p))) continue;
        grain(g, view, p, CLUMP * big * (1 + 0.4 * jitter(e + q)), LUMPS[(e + q) % 3], d);
      }
    }
  }
  const after = (t - WORK.land) * ACT_SECS.work;
  // A flare over the metal where they went in, and sparks off it.
  if (front && after > -0.02 && after < 0.35) {
    const fl = 1 - after / 0.35, [x, y] = onScreen(view, top), rr = (0.25 + 0.9 * after) * big;
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    grad.addColorStop(0, css([255, 240, 180], 0.75 * fl * d));
    grad.addColorStop(1, css([255, 170, 70], 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fill();
  }
  sparkle(g, view, s, b, after, 8 + 3 * s.strike, 70, front, d, 0.8);
}

/** Going, a Moltenex's metal sloshes and throws a few sparks with each rock of its crucible. */
function trickle(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, a: Anim, front: boolean): void {
  if (!s.gait.trickle || a.go < 0.5) return;
  for (const off of [0, 0.5]) sparkle(g, view, s, b, frac(a.u - 0.2 - off) * 0.6, 3, 90 + off * 10, front, smooth(a.go), 0.6);
}

/**
 * Evolving: at the start a great puff of steam over the whole of it, which
 * covers the moment it changes into its new body, and sparks thrown out of
 * it; then embers swirling in round it from wide at its feet and drawn up
 * into its metal, gone in by the flash, its chimneys grown in.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Slag, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = t * ACT_SECS.evolve, k = kOf(s);
  const top = heapTop(s, b);
  const burst = 1 - ramp(t, 0.1, 0.24);
  if (burst > 0) {
    if (front) {
      const B = s.bowl, { H } = rimOf(B), R = Math.max(...B.prof.map((q) => q[1])), rise = since * 0.6;
      const al = 1 - ramp(t, 0.08, 0.22);
      const lumps: Array<[V3, number]> = [
        [place(b.shell, [0, 0, H * 0.4]), R * 1.25], [place(b.shell, [R * 0.9, 0, H * 0.5]), R * 0.8], [place(b.shell, [-R * 0.9, 0, H * 0.5]), R * 0.8],
        [place(b.shell, [0, R * 0.8, H * 0.2]), R * 0.85], [place(b.shell, [0, 0, H + (B.dome ?? 0) + 0.2]), R * 0.95],
      ];
      for (let q = 0; q < 2; q++) lumps.push([place(b[`claw${q}`], [0, 0.6 * s.claw.hand[q], 0]), 0.75 * s.claw.hand[q]]);
      for (const [i, [p, r]] of lumps.entries()) steamPuff(g, view, add(p, [0, 0, rise]), r * 1.05, al, i);
    }
    for (let q = 0; q < 28; q++) {
      const th = (q / 28) * TAU * 2.6 + jitter(q) * 0.7, el = 0.3 + 0.7 * jitter(q + 40);
      const dir = unit([Math.cos(th), Math.sin(th), el]), R = rimOf(s.bowl).R * 1.5;
      const from: V3 = add(place(b.shell, [0, 0, rimOf(s.bowl).H * 0.5]), [dir[0] * R, dir[1] * R, dir[2] * 0.4 * k]);
      const go = since - 0.05;
      if (go < 0) continue;
      const p = thrown(from, scale(add(dir, [0, 0, 0.5]), (2.5 + 2.5 * jitter(q + 3)) * big), go, 6);
      if (nearSide(p, mid, view) !== front) continue;
      spark(g, view, p, CLUMP * big * 0.6, SPARKS[q % 3], burst);
    }
  }
  const fade = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.47, 0.52));
  if (fade <= 0) return;
  const wide = 1.6 * k;
  for (let q = 0; q < 24; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / (0.32 + 0.06 * jitter(q + 2)));
    const ang = (q / 24) * TAU + u * TAU * (1.2 + 0.5 * jitter(q + 5));
    const r = wide * (1 - u) ** 1.2;
    const p: V3 = add(scale(top, u ** 0.8), [Math.cos(ang) * r, Math.sin(ang) * r, (1 - u) * 0.2 * k * jitter(q + 21)]);
    if (nearSide(p, mid, view) !== front) continue;
    spark(g, view, p, CLUMP * big * 0.55, SPARKS[q % 3], fade * ramp(u, 0, 0.12) * (1 - ramp(u, 0.9, 1)));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works, goes and evolves. */
function slagKind(s: Slag): Kind {
  const bones = slagBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: STRIKE.hit } });
  const atToss = (a: Anim): Bones => bones({ ...a, act: { kind: 'work', t: WORK.toss } });
  return {
    bones,
    build: (lod) => slagBuild(s, lod),
    // The variant's coat is its shell, cream to peach; its markings are the copper-orange of its joints and the cracks on its
    // claws. Its crucible is cream stone, its fittings copper and its metal gold on every variant, and its eyes brown.
    palette: (coat, mark) => {
      const body = mix(pastel(coat, 12), coat, 0.85), copper = mix(pastel(mark, 10), mark, 0.8);
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: copper,
        coatLight: mix(body, [255, 246, 232], 0.4),
        mark: copper,
        muzzle: mix(body, [255, 244, 226], 0.18),
        horn: mix(body, [255, 242, 224], 0.45),
        hornDark: mix(copper, body, 0.2),
        spot: mix(copper, [255, 210, 160], 0.2),
        crystal: darker(copper, 0.12),
        // The crucible: cream stone in two creams, darker in its joints and inside.
        stone: [214, 170, 128],
        shell: [188, 140, 102],
        stoneDark: [104, 70, 52],
        // A dome's tiles: a greyer brown stone.
        feather: [170, 134, 110],
        featherDark: [138, 104, 84],
        // Copper, and its darker shade for rivets, collars and mouths.
        bill: [208, 114, 56],
        billDark: [118, 60, 36],
        // The metal: orange at the wall, gold, white-gold in the middle.
        ember: [246, 104, 22],
        flame: [255, 164, 36],
        bloom: [255, 222, 96],
        eye: [92, 50, 34],
        glint: [255, 255, 255],
        nose: [96, 38, 34],
        tongue: [240, 120, 120],
        petal: [246, 150, 140],
        lid: darker(body, 0.45),
      });
    },
    shadow: [s.legs.ys[0] - s.legs.ys[3] + s.legs.reach * 0.9, s.legs.x + s.legs.reach * 0.9],
    stride: 1.5,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are gold and copper sparks.
    motes: [[255, 214, 110], [236, 140, 72]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      // Its chimneys steam always, the harder just after something has gone into its metal.
      const boost = act?.kind === 'work' ? hump(act.t, WORK.land + 0.1, 0.25) : 0;
      if (!act) trickle(g, view, s, b, a, front);
      else if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') digSpray(g, view, s, b, atToss(a), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
      if (act?.kind !== 'evolve' || act.t > 0.25) steam(g, view, s, b, a, front, boost);
    },
  };
}

export const SLAGLET = slagKind(SLAGLET_LOOK);
export const ALLOYSTER = slagKind(ALLOYSTER_LOOK);
export const MOLTENEX = slagKind(MOLTENEX_LOOK);
