import {
  add, beat, bipedBones, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, eyes, frac, lerp, lighter, merge, mirrored, mix, orb, orbAlong,
  paint, pastel, scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BipedPose, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { cut } from './beastkit';
import { GLYPHS } from './runestone';
import { glower, MONSTER_GROWTH, OGRE_SPEC } from './wild-upright';

/**
 * The ogre's three subspecies (`SpeciesDef.subspecies`), one for each of its
 * variants, which the island rolls evenly among: each a `Kind` on the ogre's
 * own bones (`OGRE_SPEC`), size, shadow and stride, and each striking.
 *
 *   0, the Menhir Ogre: a standing stone for a club, its broad faces cut
 *      with runes that glow, carried on the shoulder and brought down over
 *      the head;
 *   1, the Gatebreaker Ogre: iron cuffs riveted with runes, their chains
 *      snapped, a chain across its chest, a broken gate strapped to its back
 *      for a shield, and both fists brought down together;
 *   2, the Barrowback Ogre: a hill of moss for a back, standing stones grown
 *      up out of its shoulders and spine, a root-club dragged in one fist and
 *      swung round across its front.
 *
 * All three are made of the same stuff as the revamped wildermon: soft
 * chunky masses lit in three steps, inked, hewn stone in the runestones'
 * cream and mauve, the runes in the runestones' gold.
 */

/** Every ogre's shadow, stride, size and blinks. */
const OGRE_SHAPE = { shadow: [2.1, 1.7] as [number, number], stride: 1.3, size: 6.0 * MONSTER_GROWTH, blinks: 6 };

/* ---- small sums -------------------------------------------------------------------- */

const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** The corners of a flat shape, in the order that makes it face out along `n`. */
function outward(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}
/** A way in a bone's frame, from the frame it is in. */
const toLocal = (x: Xf, d: V3): V3 => {
  const m = x.m;
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
};
/** A mesh laid along a frame: its x across, y, and z along. */
const laid = (m: Mesh, o: V3, X: V3, Y: V3, Z: V3): Mesh =>
  mesh(m.v.map((p) => add(o, add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2])))), m.f);
/** A mesh with every corner knocked a little off true, `k` of a unit at most, as hewn stone is. */
const hewn = (m: Mesh, k: number, seed: number): Mesh =>
  mesh(m.v.map((p, i) => [p[0] + k * (jitter(seed + i * 3.1) - 0.5), p[1] + k * (jitter(seed + i * 5.7) - 0.5), p[2] + k * 0.6 * (jitter(seed + i * 7.3) - 0.5)] as V3), m.f);

/**
 * A rune, one of the runestones' glyphs (`GLYPHS`), cut into a flat face: each
 * stroke a band `w` wide, `s` from the glyph's middle to its top, laid at `c`
 * across `U` and up `V`, lifted `lift` off the face along `N`. Cut twice, the
 * groove in its dark and the light in it narrower and lit.
 */
function rune(glyph: string, c: V3, U: V3, V: V3, N: V3, s: number, w: number, lift: number, groove: Mat, light: Mat | null): Disc[] {
  const out: Disc[] = [];
  const layers = [[w, groove, lift, false], ...(light ? [[w * 0.48, light, lift * 1.6, true]] : [])] as Array<[number, Mat, number, boolean]>;
  for (const [ww, m, up, lit] of layers) {
    for (const st of GLYPHS[glyph] ?? []) {
      const pts = st.pts, segs = st.closed ? pts.length : pts.length - 1;
      for (let q = 0; q < segs; q++) {
        const [x0, y0] = pts[q], [x1, y1] = pts[(q + 1) % pts.length];
        let dx = (x1 - x0) * s, dy = (y1 - y0) * s;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        const e = ww * 0.45, a: [number, number] = [x0 * s - dx * e, y0 * s - dy * e], b: [number, number] = [x1 * s + dx * e, y1 * s + dy * e];
        const px = -dy * ww * 0.5, py = dx * ww * 0.5;
        const v = [[a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py]]
          .map(([x, y]) => add(add(c, scale(N, up)), add(scale(U, x), scale(V, y))));
        out.push({ v: outward(v, N), m, lit });
      }
    }
  }
  return out;
}

/**
 * A lump of stone: a block of `n` sides standing along `up`, `r` across,
 * along and high, its edges cut back by `bevel`, every corner knocked off
 * true; with `point`, narrowing from its foot to a point, a shard.
 */
function stone(c: V3, r: V3, o: { up?: V3; fwd?: V3; n?: number; bevel?: number; rough?: number; seed: number; mat: Mat; point?: boolean; blunt?: boolean }): Mesh {
  const n = o.n ?? 5, bv = o.bevel ?? 0.3, rough = o.rough ?? 0.14, sd = o.seed;
  const Z = unit(o.up ?? [0, 0, 1]);
  let X = cross(o.fwd ?? [0, 1, 0], Z);
  if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = cross([0, 1, 0.3], Z);
  X = unit(X);
  const Y = cross(Z, X);
  const rings: Array<[number, number]> = o.blunt ? [[-0.15, 0.92], [0.15, 1], [0.95, 0.9], [1.4, 0.68], [1.62, 0.34]] : o.point ? [[-0.15, 0.9], [0.15, 1], [0.95, 0.72], [1.7, 0.3], [2.1, 0]] : [[-1, 1 - bv], [-1 + bv * 0.9, 1], [1 - bv * 0.9, 1], [1, 1 - bv]];
  const v: V3[] = [], f: Face[] = [];
  const spin = jitter(sd + 0.5) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x * r[0]), scale(Y, y * r[1])), scale(Z, z * r[2])));
  rings.forEach(([z, k], q) => {
    if (k === 0) {
      v.push(at(0.3 * (jitter(sd + 9) - 0.5), 0.3 * (jitter(sd + 11) - 0.5), z));
      return;
    }
    for (let j = 0; j < n; j++) {
      const id = sd * 7.3 + q * 13 + j;
      const a = spin + ((j + 0.3 * (jitter(id) - 0.5)) / n) * TAU, kk = k * (1 + rough * (jitter(id + 3) - 0.5) * 2);
      v.push(at(Math.cos(a) * kk, Math.sin(a) * kk, z + rough * (jitter(id + 5) - 0.5)));
    }
  });
  const mid = o.point || o.blunt ? at(0, 0, 0.6) : c;
  const centroid = (idx: number[]): V3 => scale(idx.reduce((s, i) => add(s, v[i]), [0, 0, 0] as V3), 1 / idx.length);
  const push = (idx: number[], want?: V3): void => {
    const w = want ?? sub(centroid(idx), mid);
    const pts = idx.map((i) => v[i]);
    f.push({ i: outward(pts, w) === pts ? idx : [...idx].reverse(), m: o.mat });
  };
  push(Array.from({ length: n }, (_, j) => j), scale(Z, -1));
  for (let q = 0; q < rings.length - 1; q++) {
    const A = q * n, top = rings[q + 1][1] === 0;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      if (top) push([A + j, A + j2, A + n]);
      else push([A + j, A + j2, A + n + j2, A + n + j]);
    }
  }
  if (!o.point || o.blunt) push(Array.from({ length: n }, (_, j) => (rings.length - 1) * n + j), Z);
  return mesh(v, f);
}

/** A link of chain: a flat loop `l` long and `w` wide round the line from `a` toward `b`, its flat turned to face `face`. */
function link(a: V3, b: V3, face: V3, l: number, w: number, r: number, mat: Mat): Mesh {
  const d = unit(sub(b, a)), F = unit(sub(face, scale(d, dot(face, d)))), s = cross(d, F);
  const pts = Array.from({ length: 6 }, (_, q) => {
    const t = (q / 6) * TAU;
    return add(a, add(scale(d, (0.5 - 0.5 * Math.cos(t)) * l), scale(s, Math.sin(t) * w * 0.5)));
  });
  return tube([...pts, pts[0]], r, r, 3, mat, { up: F, start: false, end: false });
}

/* ---- the rig ----------------------------------------------------------------------- */

const S = OGRE_SPEC;
/** A hand's frame in the chest's, the arm held as `arm` says (forward, out, elbow, on its rest). */
function handAt(k: 0 | 1, arm: readonly [number, number, number]): Xf {
  const sd = k ? 1 : -1;
  const up = joint(ROOT, [sd * S.arm.at[0], S.arm.at[1], S.arm.at[2]], S.arm.rest[0] + arm[0], -sd * (S.arm.rest[1] + arm[1]), 0);
  return joint(joint(up, [0, 0, -S.arm.len[0]], S.arm.rest[2] + arm[2]), [0, 0, -S.arm.len[1]]);
}
/** Where in the right hand's frame the grip is: in the middle of the fist. */
const GRIP_AT: V3 = [0, 0.12, -0.34];

/**
 * How far to bend and turn the right wrist (degrees: bent, turned) so that a
 * club gripped along `Z` (in the grip's frame) points `want` in the chest's
 * frame, the arm held as `arm` says: the best of every five degrees, bent
 * either way and turned up to a right angle either way.
 */
function wristFor(arm: readonly [number, number, number], Z: V3, want: V3): [number, number] {
  const h = handAt(1, arm), w = unit(want);
  let best: [number, number] = [0, 0], score = -Infinity;
  for (let d = -180; d < 180; d += 5) {
    for (let y = -90; y <= 90; y += 5) {
      const g = joint(h, GRIP_AT, d, 0, y);
      // A little for the least turn, so of two as good the straighter wrist wins.
      const s = dot(sub(place(g, Z), g.t), w) - 0.0004 * Math.abs(y);
      if (s > score) { score = s; best = [d, y]; }
    }
  }
  return best;
}

/** Breathing, the weight rolled from foot to foot and the scratch at the head, as the live ogre stands (`OGRE`). */
function standing(p: BipedPose, t: number, scratchArm: 0 | 1 = 0): void {
  p.chest[0] += 6 * cyc(t, 4);
  p.roll += 4 * cyc(t, 4, 1);
  const scratch = beat(t, [9.2], 2.0);
  const arm = p.arms[scratchArm];
  p.arms[scratchArm] = [arm[0] + 130 * scratch, arm[1] + 10 * scratch, arm[2] + 100 * scratch + 15 * scratch * Math.sin(t * TAU * 3)];
  p.head[2] += 10 * scratch;
}

/** Legs bent at the knee by `k` (nought standing tall), the body let down on them. */
function crouch(p: BipedPose, k: number): void {
  p.legs = p.legs.map((l) => [l[0] + 14 * k, l[1] + k, l[2]] as [number, number, number]);
  p.chest[0] += 6 * k;
}

/* ---- the body every proposal is built on -------------------------------------------- */

interface Body {
  /** The hill of shoulder: height, half its width, half its depth, how far forward. */
  hill: Array<[number, number, number, number]>;
  head: { c: V3; r: V3 };
  /** Arms: upper and forearm, root and end widths; legs the same. */
  arm: [number, number, number, number];
  leg: [number, number, number];
  /** A belt buckle's look. */
  buckle: (n: number) => Mesh;
  /** Left hand and right, in the hand's frame (the right one in the grip's frame, if it holds something). */
  hands: [Mesh, Mesh];
  /** The skirt's hem, ragged by this much. */
  rag: number;
  /** Anything painted on or grown out of the hill, in the chest's frame. */
  over?: Mesh;
  /** A rune painted on the outside of each upper arm, in a dark of the hide. */
  brands?: [string, string];
}

/** A hand: a palm and four thick fingers fanned forward and down, the thumb in. */
function openHand(r: number, n: number): Mesh {
  return merge(
    orbAlong([0, r * 0.3, -r * 0.45], [0, 0.4, -1], [r * 0.95, r * 0.8, r], n - 2, 3, 'coat'),
    ...[0, 1, 2, 3].map((q) => {
      const a = (q / 3 - 0.5) * 0.9;
      const root: V3 = [Math.sin(a) * r * 0.62, r * 0.6, -r * 0.95];
      return taper(curve(root, add(root, [Math.sin(a) * 0.12, 0.16, -0.16]), add(root, [Math.sin(a) * 0.18, 0.18, -0.38]), 2), r * 0.27, r * 0.19, 4, 'coat');
    }),
    taper([[-r * 0.7, r * 0.45, -r * 0.35], [-r * 0.98, r * 0.85, -r * 0.6]], r * 0.27, r * 0.18, 4, 'coat'),
    // Dark nails at the fingertips, painted on.
    paint([0, 1, 2, 3].map((q) => {
      const a = (q / 3 - 0.5) * 0.9;
      return disc([Math.sin(a) * (r * 0.62 + 0.18), r * 0.6 + 0.18 + r * 0.19, -r * 0.95 - 0.38], [0, 1, -0.2], r * 0.13, r * 0.11, 5, 'claw');
    })),
  );
}

/** A clenched fist in the hand's frame: the back of it, four knuckles forward and a roll of curled fingers under them. */
function clenched(r: number, n: number, iron = false): Mesh {
  const out: Mesh[] = [
    orbAlong([0, r * 0.1, -r * 0.55], [0, 0.35, -1], [r * 1.0, r * 0.82, r * 0.92], n - 2, 3, 'coat'),
    tube([[-r * 0.72, r * 0.62, -r * 1.05], [r * 0.72, r * 0.62, -r * 1.05]], r * 0.38, r * 0.34, 6, 'coat', { up: [0, 0.6, -1] }),
    ...[-0.54, -0.18, 0.18, 0.54].map((x) => orb([x * r, r * 0.42, -r * 1.32], [r * 0.24, r * 0.26, r * 0.22], 5, 3, 'coat')),
    taper([[-r * 0.8, r * 0.3, -r * 0.6], [-r * 0.6, r * 0.92, -r * 0.92]], r * 0.3, r * 0.22, 5, 'coat'),
  ];
  if (iron) out.push(tube([[-r * 0.92, r * 0.2, -r * 1.3], [r * 0.92, r * 0.2, -r * 1.3]], r * 0.3, r * 0.42, 6, 'metal', { up: [0, 0.8, -0.6] }));
  return merge(...out);
}

/** A bare foot: a broad lump forward of the ankle, three blunt toes with nails. */
function foot(r: number, len: number, n: number): Mesh {
  return merge(
    orbAlong([0, len * 0.3, -r * 0.55], [0, 1, 0], [r, len * 0.6, r * 0.6], n - 2, 3, 'coat'),
    ...[-1, 0, 1].map((q) => orbAlong([q * r * 0.6, len * 0.82, -r * 0.82], [0, 1, -0.2], [r * 0.32, r * 0.36, r * 0.28], 5, 3, 'coat')),
    paint([-1, 0, 1].map((q) => disc([q * r * 0.6, len * 0.82 + r * 0.37, -r * 0.8], [0, 1, 0.2], r * 0.18, r * 0.13, 5, 'claw'))),
  );
}

/**
 * The ogre every proposal starts from: the hill of shoulder on short legs,
 * a small head sunk in it with a great underbite and two tusks, glowering
 * eyes that glow, a hide skirt with a ragged hem on a belt with a buckle;
 * the hands are the proposal's.
 */
function body(o: Body, lod: number): Piece[] {
  const n = cut(lod, 9, 11), k = cut(lod, 5, 6);
  const hill = o.hill;
  const bulk = merge(
    tube(hill.map(([z, , , y]) => [0, y, z] as V3), hill.map(([, w]) => w), hill.map(([, , h]) => h), n + 1, 'coat', { up: [0, 1, 0] }),
    // The belly, paler, and the chest over it.
    orbAlong([0, 0.78, 0.45], [0, 1, -0.15], [1.0, 0.58, 0.95], n, k, 'belly'),
    ...[1, -1].map((s) => orbAlong([s * 0.62, 0.88, 1.32], [s * 0.2, 1, -0.3], [0.62, 0.36, 0.42], n - 2, k - 1, 'coat')),
    o.over,
  );
  const skirt = (): Mesh => {
    const N = n + 3;
    const m = tube([[0, 0, 0.1], [0, 0.04, -0.1], [0, 0.07, -0.56]], [1.02, 1.14, 1.26], [0.88, 0.98, 1.08], N, (ring) => (ring === 0 ? 'leatherDark' : 'leather'), { up: [0, 1, 0], start: false });
    // The hem cut ragged: every other corner of its last ring a tongue of hide hanging lower.
    return mesh(m.v.map((p, i) => (i >= 2 * N ? [p[0], p[1], p[2] - (i % 2 ? o.rag : 0) - o.rag * 0.4 * jitter(i)] as V3 : p)), m.f);
  };
  const belt = tube([[0, 0.02, 0.04], [0, 0.02, 0.26]], [1.14, 1.06], [1.0, 0.94], n + 3, 'leatherDark', { up: [0, 1, 0], start: false, end: false });
  const H = o.head;
  const skull = orb(H.c, H.r, n, k, 'coat');
  const eyeDir: V3 = [0.42, 0.84, 0.32], eyeSize = 0.15;
  const { lids, brows } = glower(H.c, H.r, eyeDir, eyeSize, { tall: 0.95, drop: 0.38, slope: 0.4, brow: 0.12 });
  const face = merge(
    // The underbite: a jaw out past the face in a darker hide, its lip turned up.
    orbAlong(add(H.c, [0, H.r[1] * 0.8, -H.r[2] * 0.62]), [0, 1, -0.2], [H.r[0] * 1.0, H.r[1] * 0.7, H.r[2] * 0.6], n, k, 'coatDark'),
    // Two tusks up out of it past the lip, and two little teeth between.
    ...[1, -1].map((s) => taper(curve(add(H.c, [s * H.r[0] * 0.5, H.r[1] * 1.28, -H.r[2] * 0.5]), add(H.c, [s * H.r[0] * 0.62, H.r[1] * 1.46, -H.r[2] * 0.1]), add(H.c, [s * H.r[0] * 0.66, H.r[1] * 1.36, H.r[2] * 0.34]), 3), 0.14, 0.035, 5, 'tooth')),
    ...[1, -1].map((s) => taper([add(H.c, [s * H.r[0] * 0.18, H.r[1] * 1.42, -H.r[2] * 0.42]), add(H.c, [s * H.r[0] * 0.19, H.r[1] * 1.5, -H.r[2] * 0.2])], 0.06, 0.02, 4, 'tooth')),
    // A broad flat nose.
    orbAlong(add(H.c, [0, H.r[1] * 0.98, H.r[2] * 0.05]), [0, 1, 0.15], [0.22, 0.15, 0.17], 6, 3, 'coat'),
  );
  const look = (shut: boolean): Mesh => merge(eyes(H.c, H.r, eyeDir, eyeSize, { tall: 0.95, shut, iris: 'bloom', pupil: 0.3, rim: 0 }), lids);
  const ear = (s: number): Mesh => tube(curve(add(H.c, [s * H.r[0] * 0.9, -0.02, 0.06]), add(H.c, [s * H.r[0] * 1.14, -0.1, 0.12]), add(H.c, [s * H.r[0] * 1.3, -0.2, 0.24]), 3), [0.17, 0.14, 0.08, 0.01], 0.07, n, 'coat', { up: [s * 0.5, 0.8, 0.3] });
  const hide = [{ c: H.c, r: H.r }];
  const [a0, a1, f0, f1] = o.arm, [l0, l1, fr] = o.leg;
  const out: Piece[] = [
    { key: 'hips', mesh: orb([0, 0, 0], [1.05, 0.85, 0.7], n, k, 'coat'), bone: 'body', bias: 0 },
    { key: 'cloth', mesh: merge(skirt(), belt), bone: 'body', bias: 0.02, after: ['ll0', 'lr0', 'hips'] },
    // The buckle over the belt in front, and under the body and the hips from behind.
    { key: 'buckle', mesh: o.buckle(n), bone: 'body', bias: 0.03, after: 'cloth', front: [0, 1, 0] },
    { key: 'body', mesh: bulk, bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.9], k: 0.06 } },
    { key: 'head', mesh: merge(skull, face, look(false)), shut: merge(skull, face, look(true)), bone: 'head', bias: 0.2 },
    { key: 'brows', mesh: brows, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear0', mesh: ear(-1), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ear(1), bone: 'head', bias: 0.21, after: 'head', hide },
  ];
  for (const [kk, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    out.push(
      { key: `arm${kk}`, mesh: merge(tube([[0, 0, a0 * 0.95], [0, 0, a0 * 0.45], [0, 0, 0], [0, 0, -S.arm.len[0] * 0.5], [0, 0, -S.arm.len[0]]], [a0 * 0.5, a0 * 0.9, a0, a0 * 1.06, a1], [a0 * 0.5, a0 * 0.86, a0 * 0.95, a0, a1 * 0.95], n, 'coat', { seam: 'end' }),
        o.brands && paint(rune(o.brands[kk], [sd * a0 * 1.0, 0.08, -S.arm.len[0] * 0.48], [0, -sd, 0], [0, 0, 1], [sd, 0, 0], a0 * 0.42, a0 * 0.16, 0.05, 'mark', null))), bone: `arm${kk}`, bias: 0.03, after: 'body', front, convex: true },
      { key: `fore${kk}`, mesh: tube([[0, 0, f0 * 0.8], [0, 0, f0 * 0.35], [0, 0, -0.05], [0, 0, -S.arm.len[1] * 0.55], [0, 0, -S.arm.len[1]]], [f0 * 0.5, f0 * 0.9, f0, f1 * 1.04, f1 * 0.86], [f0 * 0.48, f0 * 0.86, f0 * 0.94, f1, f1 * 0.82], n, 'coat', { seam: 'end' }), bone: `elbow${kk}`, bias: 0.035, after: 'body', front, convex: true },
      { key: `hand${kk}`, mesh: o.hands[kk], bone: `hand${kk}`, bias: 0.04, after: 'body', front },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    out.push(
      { key: `${key}0`, mesh: tube([[0, 0, 0.12], [0, 0, -S.leg.len[0]]], [l0, l0 * 0.92], [l0, l0 * 0.9], n, 'coat', { seam: 'both' }), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front, convex: true },
      { key: `${key}1`, mesh: tube([[0, 0, l1 * 0.75], [0, 0, l1 * 0.3], [0, 0, -0.05], [0, 0, -S.leg.len[1]]], [l1 * 0.5, l1 * 0.9, l1, l1 * 0.95], [l1 * 0.5, l1 * 0.9, l1, l1 * 0.92], n, 'coat', { seam: 'end' }), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(foot(fr, 0.95, n)) : foot(fr, 0.95, n), bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** The live ogre's hill, a little broader at the shoulder and deeper in the chest. */
const HILL: Array<[number, number, number, number]> = [
  [-0.55, 1.0, 0.92, 0.02], [-0.25, 1.26, 1.1, 0.08], [0.1, 1.4, 1.2, 0.16], [0.5, 1.48, 1.26, 0.16], [0.9, 1.54, 1.22, 0.12],
  [1.25, 1.68, 1.14, 0.02], [1.55, 1.76, 1.1, -0.08], [1.85, 1.66, 1.02, -0.12], [2.1, 1.34, 0.82, -0.12], [2.26, 0.84, 0.52, -0.12], [2.33, 0.14, 0.1, -0.12],
];
const HEAD = { c: [0, 0.22, 0.32] as V3, r: [0.7, 0.66, 0.62] as V3 };

/** A point on a hill `z` up it and `th` round from its right side toward its front, the way out of it there, and across it. */
function onHill(hill: Array<[number, number, number, number]>, z: number, th: number): { p: V3; n: V3; u: V3 } {
  let q = 0;
  while (q < hill.length - 2 && hill[q + 1][0] < z) q++;
  const f = clamp((z - hill[q][0]) / (hill[q + 1][0] - hill[q][0]));
  const w = lerp(hill[q][1], hill[q + 1][1], f), h = lerp(hill[q][2], hill[q + 1][2], f), y = lerp(hill[q][3], hill[q + 1][3], f);
  const c = Math.cos(th), s = Math.sin(th);
  const n = unit([c / w, s / h, 0]);
  return { p: [w * c, y + h * s, z], n, u: unit(cross([0, 0, 1], n)) };
}

/**
 * Stripes painted across the hide, each `z` up the hill and round it from
 * `th0` to `th1`, `w` wide at its middle and tapering to its ends, bent into
 * a chevron by `chev` (how much higher its ends are than its middle).
 */
function stripes(hill: Array<[number, number, number, number]>, list: Array<[number, number, number, number, number]>, mat: Mat): Mesh {
  const out: Disc[] = [];
  for (const [z, th0, th1, w, chev] of list) {
    const N = 8, mid = (th0 + th1) / 2, half = (th1 - th0) / 2;
    const at = (q: number, side: number): V3 => {
      const th = lerp(th0, th1, q / N), k = Math.sin((Math.PI * q) / N) ** 0.6;
      const zz = z + chev * Math.abs(th - mid) / half + side * w * 0.5 * Math.max(0.12, k);
      const o = onHill(hill, zz, th);
      return add(o.p, scale(o.n, 0.035));
    };
    for (let q = 0; q < N; q++) {
      const o = onHill(hill, z, lerp(th0, th1, (q + 0.5) / N));
      out.push({ v: outward([at(q, -1), at(q + 1, -1), at(q + 1, 1), at(q, 1)], o.n), m: mat });
    }
  }
  return paint(out);
}

/** Runes painted on the hide, in a dark of it, at heights and ways round the hill. */
function tattoos(hill: Array<[number, number, number, number]>, marks: Array<[string, number, number, number]>, light: Mat | null = null): Mesh {
  return paint(marks.flatMap(([gl, z, th, s]) => {
    const o = onHill(hill, z, th);
    return rune(gl, o.p, o.u, [0, 0, 1], o.n, s, s * 0.34, 0.05, 'mark', light);
  }));
}

/** A palette on the live ogre's lines: the hide taken most of the way from the variant's beige to `hide`, and the rest as given. */
function hidePalette(hideTo: RGB, own: Record<string, RGB>, belly: RGB): Kind['palette'] {
  return (coat, mark) => {
    const c = mix(pastel(coat, 30), hideTo, 0.9);
    return coatPalette(coat, mark, {
      coat: c, coatDark: darker(c, 0.26), coatLight: lighter(c, 0.2), lid: darker(c, 0.5), belly: mix(c, belly, 0.55),
      leather: [156, 118, 96], leatherDark: [116, 88, 76], tooth: [248, 240, 216], claw: [120, 100, 104], bloom: [255, 196, 84],
      // The runestones' stone, its shade, and the gold of a rune's light and the amber at its edge.
      shell: [244, 232, 208], shellDark: [188, 170, 166], flame: [255, 217, 140], ember: [214, 140, 52],
      ...own,
    }, 30);
  };
}

/* ---- the strike's light ------------------------------------------------------------- */

/** When the blow lands, as a share of the strike: drawn at fifteen frames a second, the 0.56 frame is the blow. */
const HIT = 0.5;

/**
 * At the blow: a ring of dust going out over the ground from where it lands,
 * under the body, and over it chips of stone and sparks of rune-light thrown
 * up and falling.
 */
function impact(g: CanvasRenderingContext2D, view: View, at: V3, t: number, under: boolean, sparks: RGB, chips: RGB, big = 1): void {
  const u = (t - HIT) / (1 - HIT);
  if (u <= 0) return;
  const fade = 1 - smooth(u);
  const [x, y] = onScreen(view, [at[0], at[1], 0]);
  if (under) {
    g.save();
    g.lineWidth = 0.16 * big;
    for (const [r0, al] of [[0.6, 0.55], [1.1, 0.35]]) {
      const r = (r0 + 2.2 * Math.sqrt(u)) * big;
      g.strokeStyle = `rgba(236,224,196,${(al * fade).toFixed(3)})`;
      g.beginPath();
      g.ellipse(x, y, r * 1.2, r * 0.6, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
    return;
  }
  g.save();
  g.lineCap = 'round';
  const s = u * 0.55;
  for (let q = 0; q < 9; q++) {
    const th = (q / 9) * TAU + jitter(q) * 0.5, sp = (1.6 + 1.6 * jitter(q + 3)) * big;
    const p: V3 = [at[0] + Math.cos(th) * sp * s, at[1] + Math.sin(th) * sp * s, Math.max(0.05, (2.6 + 2 * jitter(q + 7)) * big * s - 9 * s * s)];
    const [px, py] = onScreen(view, p);
    if (q % 3 === 0) {
      g.fillStyle = `rgba(${chips[0]},${chips[1]},${chips[2]},${fade.toFixed(3)})`;
      g.fillRect(px - 0.12 * big, py - 0.12 * big, 0.24 * big, 0.24 * big);
    } else {
      g.strokeStyle = `rgba(${sparks[0]},${sparks[1]},${sparks[2]},${(0.95 * fade).toFixed(3)})`;
      g.lineWidth = 0.1 * big;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - Math.cos(th) * 0.25 * big, py + 0.3 * big);
      g.stroke();
    }
  }
  g.restore();
}

/** A rune's soft light at `p` on a bone, facing `n` there: drawn only while that face is turned toward the viewer. */
function runeLight(g: CanvasRenderingContext2D, view: View, x: Xf, p: V3, n: V3, r: number, al: number): void {
  const w = sub(place(x, n), x.t);
  if (dot(w, view.T) < 0.1) return;
  const [cx, cy] = onScreen(view, place(x, p));
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(255,214,140,${al})`);
  grad.addColorStop(1, 'rgba(255,214,140,0)');
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = grad;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore();
}

/** A rune's soft light at a point, drawn only while the point is on the viewer's side of the middle of the body. */
function runeLightNear(g: CanvasRenderingContext2D, view: View, b: Bones, p: V3, r: number, al: number): void {
  const mid = place(b.chest, [0, 0.1, 1.0]);
  if (dot(sub(p, mid), view.T) < -0.3) return;
  runeLight(g, view, { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, p, view.T, r, al);
}

/* ---- A: the Menhir-bearer ----------------------------------------------------------- */

/** The right arm with the menhir on its shoulder, and the club's line and broad face in the chest's frame there. */
const A_HOLD: [number, number, number] = [24, 54, 92];
/** The menhir's rings from its butt up: how far along, how wide, how thick. */
const MENHIR: Array<[number, number, number]> = [
  [-0.42, 0.13, 0.12], [-0.3, 0.17, 0.15], [0.42, 0.19, 0.16], [0.62, 0.3, 0.2], [1.2, 0.46, 0.27], [2.0, 0.52, 0.3], [2.65, 0.48, 0.28], [3.0, 0.36, 0.22], [3.18, 0.12, 0.1],
];

/** The grip's frame in the hand's, at the hold: the club's line along its z, its broad face along its y. */
function aGrip(): { X: V3; Y: V3; Z: V3 } {
  const h = handAt(1, A_HOLD);
  // Up and back over the shoulder, a little out; its broad face out to its right.
  const Z = unit(toLocal(h, unit([0.3, -1.0, 0.38]))), F = toLocal(h, unit([1, 0.1, 0.4]));
  const Y = unit(sub(F, scale(Z, dot(F, Z))));
  return { X: cross(Y, Z), Y, Z };
}

const A_RUNES = ['algiz', 'ingwaz', 'tiwaz'];

function menhirMesh(n: number): Mesh {
  const rings = MENHIR;
  const wrap = (ring: number): Mat => (ring <= 1 ? 'leatherDark' : ring === 2 ? 'leather' : 'shell');
  const body = hewn(tube(rings.map(([z]) => [0, 0, z] as V3), rings.map((r) => r[1]), rings.map((r) => r[2]), 6, wrap, { turn: 0 }), 0.05, 31);
  const out: Mesh[] = [body];
  // A rope lashed round where the stone narrows to the grip, and a pommel knot.
  out.push(tube([[0, 0, 0.36], [0, 0, 0.56]], 0.24, 0.2, 6, 'lace', { turn: 0 }));
  out.push(tube([[0, 0, 0.06], [0, 0, 0.16]], 0.21, 0.18, 6, 'lace', { turn: 0 }));
  // Moss over its top, and a patch of it down one edge.
  out.push(orbAlong([0.02, 0, 3.0], [0, 0, 1], [0.34, 0.24, 0.16], n - 2, 3, 'moss'));
  // Its runes down both broad faces, gold in their grooves.
  const decals: Disc[] = [];
  for (const sy of [1, -1]) {
    A_RUNES.forEach((gl, q) => {
      const z = 1.25 + q * 0.58, r = MENHIR.find((x) => x[0] >= z)!;
      decals.push(...rune(gl, [0, sy * r[2] * 0.87, z], [sy, 0, 0], [0, 0, 1], [0, sy, 0], 0.2, 0.085, 0.03, 'shellDark', 'flame'));
    });
  }
  decals.push(disc([0.3, 0.2, 2.3], [0.5, 0.86, 0], 0.11, 0.08, 6, 'spot'), disc([-0.24, -0.24, 1.65], [-0.5, -0.86, 0], 0.09, 0.07, 6, 'spot'));
  out.push(paint(decals));
  return merge(...out);
}

function aBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 11), k = cut(lod, 5, 6);
  const G = aGrip();
  const club = laid(menhirMesh(n), [0, 0, 0], G.X, G.Y, G.Z);
  // The fist round the grip: the back of the hand toward the wrist, four fingers round the far side.
  const wrist = unit(sub(scale(GRIP_AT, -1), scale(G.Z, dot(scale(GRIP_AT, -1), G.Z))));
  const round = cross(G.Z, wrist), R = 0.19, fr = 0.14;
  const ring = (along: number, deg: number, r: number): V3 => {
    const a = deg * (Math.PI / 180);
    return add(scale(G.Z, along), add(scale(wrist, Math.cos(a) * r), scale(round, Math.sin(a) * r)));
  };
  const fist = merge(
    orbAlong(ring(0, 0, R + 0.2), G.Z, [0.42, 0.34, 0.5], n, k, 'coat'),
    ...[-0.28, -0.09, 0.1, 0.29].map((along) => tube([0, 60, 125, 190, 250].map((deg) => ring(along, deg, R + fr * 0.75)), fr, fr * 0.95, 4, 'coat')),
  );
  const hide = [-0.5, -0.33, -0.17, 0, 0.17, 0.33, 0.5].map((along) => ({ c: scale(G.Z, along), r: [R, R, R] as V3 }));
  // A rune-stone hung at the belt for a buckle.
  const buckle = (nn: number): Mesh => merge(
    stone([0, 1.08, 0.12], [0.24, 0.12, 0.24], { up: [0, 1, 0.1], fwd: [0, 0, 1], n: 6, bevel: 0.35, rough: 0.08, seed: 4, mat: 'shell' }),
    paint(rune('othala', [0, 1.21, 0.12], [1, 0, 0], [0, 0, 1], [0, 1, 0], 0.13, 0.06, 0.02, 'shellDark', 'flame')),
    tube([[0, 1.0, 0.36], [0, 1.08, 0.3]], 0.05, 0.05, Math.min(nn, 5), 'lace'),
  );
  const base = body({ hill: HILL, head: HEAD, arm: [0.52, 0.46, 0.48, 0.56], leg: [0.52, 0.46, 0.46], buckle, hands: [openHand(0.48, n), fist], rag: 0.16, brands: ['sowilo', 'algiz'],
    over: merge(stripes(HILL, [[0.75, -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1, 0.16, 0.22], [1.15, -Math.PI / 2 - 1.15, -Math.PI / 2 + 1.15, 0.18, 0.24], [1.95, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9, 0.16, 0.12]], 'mark'),
      tattoos(HILL, [['kenaz', 1.5, -0.25, 0.26], ['kenaz', 1.5, Math.PI + 0.25, 0.26], ['tiwaz', 1.56, -Math.PI / 2, 0.24]])) }, lod);
  return [
    ...base.map((pc): Piece => (pc.key === 'hand1' ? { ...pc, bone: 'grip', bias: 0.06, after: ['body', 'club'], front: [1, 0.6, 0.2], hide } : pc)),
    // Over the body and the arm holding it from in front and to its right; from behind, under them.
    { key: 'club', mesh: club, bone: 'grip', bias: 0.05, after: ['body', 'arm1', 'fore1', 'head'], front: toLocal(handAt(1, A_HOLD), [0.7, 0.7, 0]) },
  ];
}

/** How the club is swung: the right arm and the wrist through the strike, from the shoulder, up over the head and down. */
function aStrike(p: BipedPose, t: number): number {
  const raise = ramp(t, 0.02, 0.36) * (1 - ramp(t, 0.36, HIT));
  const slam = ramp(t, 0.36, HIT) * (1 - ramp(t, 0.72, 1));
  const lerp3 = (x: readonly number[], y: readonly number[], k: number): [number, number, number] => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)];
  let arm = lerp3(A_HOLD, [168, -14, 58], raise);
  arm = lerp3(arm, [92, -16, 6], slam);
  p.arms[1] = arm;
  // The other arm out for balance as it comes down.
  p.arms[0] = lerp3(p.arms[0], [40, 30, 30], slam + raise * 0.5);
  p.chest[0] += -14 * raise + 30 * slam;
  p.chest[2] += 8 * raise - 6 * slam;
  p.head[0] += 10 * raise - 16 * slam;
  crouch(p, 0.32 * slam - 0.05 * raise);
  // The wrist: cocked back as it goes up, flung forward into the blow.
  return -40 * raise + 110 * slam;
}

const aBones = (a: Anim): Bones => {
  let wrist = 0;
  const b = bipedBones(S, a, (p) => {
    p.arms[1] = [...A_HOLD];
    if (a.act?.kind === 'strike') {
      wrist = aStrike(p, a.act.t);
      return;
    }
    if (a.go > 0) return;
    standing(p, a.t);
    // Every so often the stone shifted on the shoulder: lifted a little and let settle.
    const shift = beat(a.t, [4.1, 17.3], 1.4);
    p.arms[1] = [p.arms[1][0] + 14 * shift, p.arms[1][1], p.arms[1][2] - 10 * shift];
    wrist = -8 * shift;
  });
  b.grip = joint(b.hand1, GRIP_AT, wrist);
  return b;
};

const A_TIP: V3 = (() => {
  const G = aGrip();
  return scale(G.Z, 2.9);
})();

const MENHIR_BEARER: Kind = {
  bones: aBones,
  build: aBuild,
  palette: hidePalette([194, 172, 206], { moss: [146, 182, 104], lace: [222, 196, 146], spot: [232, 222, 160], mark: [138, 104, 150] }, [240, 218, 204]),
  ...OGRE_SHAPE,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    // The runes' light, while the stone is on the viewer's side of the body.
    if (!under) runeLightNear(g, view, b, place(b.grip, scale(aGrip().Z, 1.85)), 1.3, 0.22);
    if (a.act?.kind === 'strike') impact(g, view, place(b.grip, A_TIP), a.act.t, under, [255, 217, 140], [214, 200, 186], 1.2);
  },
};

/* ---- B: the Gatebreaker ------------------------------------------------------------- */

const B_REST: [number, number, number] = [12, 6, 20];

/** An iron cuff round a forearm, `z0` to `z1` down it, riveted, a rune on its outside; and a broken chain hanging off it. */
function cuff(r: number, z0: number, z1: number, sd: number, n: number, glyph: string, links: number): Mesh {
  const out: Mesh[] = [
    tube([[0, 0, z0], [0, 0, z1]], [r * 1.04, r * 0.96], [r * 1.0, r * 0.92], 8, 'metal', { turn: 0 }),
    tube([[0, 0, z0 - 0.03], [0, 0, z0 + 0.08]], r * 1.09, r * 1.04, 8, 'metalDark', { turn: 0, start: false, end: false }),
    tube([[0, 0, z1 - 0.08], [0, 0, z1 + 0.03]], r * 1.09, r * 1.04, 8, 'metalDark', { turn: 0, start: false, end: false }),
  ];
  const decals: Disc[] = [];
  for (let q = 0; q < 8; q++) {
    const a = ((q + 0.5) / 8) * TAU, c: V3 = [Math.cos(a), Math.sin(a), 0];
    for (const z of [(z0 + z1) / 2 + (q % 2 ? 0.16 : -0.16)]) decals.push(disc(add(scale(c, r * 1.0), [0, 0, z]), c, 0.05, 0.05, 5, 'fitting', { lit: true }));
  }
  // The rune on the outer face.
  const N: V3 = [sd, 0, 0];
  decals.push(...rune(glyph, [sd * r * 0.97, 0, (z0 + z1) / 2], [0, -sd, 0], [0, 0, 1], N, Math.min(0.16, (z0 - z1) * 0.28), 0.075, 0.025, 'metalDark', 'flame'));
  out.push(paint(decals));
  // A broken chain off the cuff's underside.
  let at: V3 = [0, -r * 0.85, z1 + 0.08];
  for (let q = 0; q < links; q++) {
    const nx: V3 = add(at, [sd * 0.04, -0.06, -0.24]);
    out.push(link(at, nx, q % 2 ? [1, 0, 0] : [0, 1, 0], 0.3, 0.17, 0.035, 'metal'));
    at = add(at, [sd * 0.035, -0.05, -0.21]);
  }
  void n;
  return merge(...out);
}

/** The broken gate on its back: four planks, two iron straps across them riveted, its top corner split. */
function gate(n: number): Mesh {
  const out: Mesh[] = [];
  const decals: Disc[] = [];
  const back = -1.4, tilt = 0.02;
  const planks = [[-0.84, 0.9, 1], [-0.28, 1.0, 0], [0.28, 0.82, 2], [0.84, 0.6, 1]];
  planks.forEach(([x, top, s], q) => {
    const z0 = -0.15, z1 = 2.3 + top * 0.6;
    const y0 = back + 0.24 * x * x;
    const pts: V3[] = [[x, y0 + tilt * z0 * -0.4, z0], [x, y0 - tilt * (z1 - z0) * 0.4, z1]];
    out.push(hewn(tube(pts, 0.27, 0.08, 4, q % 2 ? 'wood' : 'woodDark', { up: [0, 1, 0.15], turn: 0.5 }), 0.03, 50 + q * 9));
    // A split end.
    out.push(stone([x + 0.08 * (s - 1), pts[1][1], z1 + 0.06], [0.14, 0.06, 0.12], { up: [0.1 * (s - 1), 0, 1], fwd: [0, 1, 0], n: 4, seed: q + 20, mat: q % 2 ? 'wood' : 'woodDark', point: true, rough: 0.2 }));
  });
  for (const z of [0.55, 1.95]) {
    const y = back - tilt * (z + 0.15) * 0.4 - 0.11;
    out.push(tube([-1.14, -0.6, 0, 0.6, 1.14].map((x): V3 => [x, y + 0.04 + 0.24 * x * x, z]), 0.16, 0.05, 4, 'metal', { up: [0, 1, 0.15] }));
    for (const x of [-0.84, -0.28, 0.28, 0.84]) decals.push(disc([x, y - 0.03 + 0.24 * x * x, z], [0, -1, 0.15], 0.05, 0.05, 5, 'fitting', { lit: true }));
  }
  // A rune on the upper strap's middle, burnt into the wood under it.
  decals.push(...rune('dagaz', [0, back - tilt * 1.4 * 0.4 - 0.08, 1.25], [-1, 0, 0], [0, 0.15, 1], [0, -1, 0.15], 0.24, 0.1, 0.04, 'woodDark', 'flame'));
  out.push(paint(decals));
  void n;
  return merge(...out);
}

/**
 * Its chains: a length of heavy chain worn across it from the left shoulder to
 * the right hip, and a padlock on it at the chest, broken open, with a rune.
 */
function bandolier(): Mesh {
  const path: V3[] = [[-1.18, -0.2, 2.18], [-1.12, 0.62, 2.02], [-0.62, 1.34, 1.56], [0.08, 1.5, 1.0], [0.72, 1.4, 0.45], [1.12, 0.98, -0.05]];
  const out: Mesh[] = [];
  let k = 0;
  for (let q = 0; q < path.length - 1; q++) {
    const a = path[q], b = path[q + 1], d = sub(b, a), len = Math.hypot(d[0], d[1], d[2]), dir = unit(d);
    const out0 = unit([a[0] * 0.5, 1, 0.25]);
    for (let u = 0; u < len - 0.05; u += 0.34, k++) {
      const p = add(a, scale(dir, u));
      out.push(link(p, add(p, dir), k % 2 ? out0 : cross(dir, out0), 0.38, 0.22, 0.05, 'metal'));
    }
  }
  // The padlock: an iron body, its shackle sprung open, a rune on its face.
  const c: V3 = [0.12, 1.66, 0.82];
  out.push(stone(c, [0.26, 0.12, 0.22], { up: [0, 0.3, 1], fwd: [0, 1, -0.3], n: 4, bevel: 0.25, rough: 0.03, seed: 77, mat: 'metal' }));
  out.push(tube(curve(add(c, [-0.16, -0.02, 0.2]), add(c, [-0.05, -0.04, 0.6]), add(c, [0.2, -0.02, 0.42]), 4), 0.05, 0.05, 4, 'metalDark'));
  out.push(paint(rune('thurisaz', add(c, [0, 0.12, -0.02]), [1, 0, 0], [0, -0.3, 1], [0, 1, 0.3], 0.14, 0.065, 0.02, 'metalDark', 'flame')));
  return merge(...out);
}

function bBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 11);
  const buckle = (): Mesh => merge(
    stone([0, 1.1, 0.14], [0.26, 0.1, 0.22], { up: [0, 1, 0], fwd: [0, 0, 1], n: 4, bevel: 0.2, rough: 0.03, seed: 9, mat: 'metal' }),
    paint([[-0.18, 0.06], [0.18, 0.06], [-0.18, 0.24], [0.18, 0.24]].map(([x, z]) => disc([x, 1.22, z], [0, 1, 0], 0.045, 0.045, 5, 'fitting', { lit: true }))),
  );
  const base = body({
    hill: HILL.map(([z, w, d, y]) => [z, w * (z > 1 ? 1.04 : 1), d, y] as [number, number, number, number]), head: HEAD,
    arm: [0.52, 0.46, 0.5, 0.6], leg: [0.54, 0.48, 0.48], buckle, hands: [mirrored(clenched(0.5, n, true)), clenched(0.5, n, true)], rag: 0.14, brands: ['dagaz', 'dagaz'],
    // War paint: three slashes down each flank.
    over: stripes(HILL, [0.7, 1.05, 1.4].flatMap((z): Array<[number, number, number, number, number]> => [[z, -0.75, 0.55, 0.13, -0.2], [z, Math.PI - 0.55, Math.PI + 0.75, 0.13, -0.2]]), 'mark'),
  }, lod);
  return [
    ...base,
    // The cuffs on the forearms, over them from every side; the gate on the back, under the arms and head from in front.
    { key: 'cuff0', mesh: cuff(0.56, -0.38, -0.86, -1, n, 'kenaz', 3), bone: 'elbow0', bias: 0.045, after: ['fore0', 'body'], front: [-1, 0.35, 0] },
    { key: 'cuff1', mesh: cuff(0.56, -0.38, -0.86, 1, n, 'sowilo', 2), bone: 'elbow1', bias: 0.045, after: ['fore1', 'body'], front: [1, 0.35, 0] },
    { key: 'chain', mesh: bandolier(), bone: 'chest', bias: 0.03, after: 'body', front: [0, 1, 0], under: 'head' },
    { key: 'gate', mesh: gate(n), bone: 'chest', bias: 0.02, front: [0, -1, 0], after: ['body', 'cloth'] },
  ];
}

/** Both fists raised over the head and brought down together. */
function bStrike(p: BipedPose, t: number): void {
  const raise = ramp(t, 0.02, 0.34) * (1 - ramp(t, 0.36, HIT));
  const slam = ramp(t, 0.36, HIT) * (1 - ramp(t, 0.74, 1));
  for (const k of [0, 1] as const) {
    const a = p.arms[k];
    const up: [number, number, number] = [172, -16, 46], down: [number, number, number] = [96, -14, 8];
    p.arms[k] = [lerp(lerp(a[0], up[0], raise), down[0], slam), lerp(lerp(a[1], up[1], raise), down[1], slam), lerp(lerp(a[2], up[2], raise), down[2], slam)];
  }
  p.chest[0] += -16 * raise + 34 * slam;
  p.head[0] += 14 * raise - 16 * slam;
  crouch(p, 0.36 * slam - 0.06 * raise);
}

const GATEBREAKER: Kind = {
  bones: (a) => bipedBones(S, a, (p) => {
    p.arms = [[...B_REST], [...B_REST]];
    if (a.go > 0) {
      p.arms = [[p.arms[0][0], 4, 26], [p.arms[1][0], 4, 26]];
      return;
    }
    if (a.act?.kind === 'strike') {
      bStrike(p, a.act.t);
      return;
    }
    standing(p, a.t);
    // The fists knocked together in front of it, twice, now and then.
    const knock = beat(a.t, [15.4], 1.6), tap = Math.abs(Math.sin(a.t * TAU * 1.6)) * knock;
    for (const k of [0, 1] as const) p.arms[k] = [p.arms[k][0] + 62 * knock, p.arms[k][1] - 30 * knock - 6 * tap, p.arms[k][2] + 40 * knock];
  }),
  build: bBuild,
  palette: hidePalette([184, 120, 110], {
    mark: [122, 70, 68],
    metal: [138, 147, 164], metalDark: [96, 102, 122], fitting: [222, 188, 112], wood: [196, 150, 100], woodDark: [158, 116, 82],
  }, [240, 210, 190]),
  ...OGRE_SHAPE,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    // The light of the runes on the cuffs, on whichever is turned toward the viewer.
    if (!under) for (const [bone, sd] of [['elbow0', -1], ['elbow1', 1]] as Array<[string, number]>) runeLight(g, view, b[bone], [sd * 0.6, 0, -0.62], [sd, 0, 0], 0.8, 0.18);
    if (a.act?.kind === 'strike') {
      const l = place(b.hand0, [0, 0.4, -0.7]), r = place(b.hand1, [0, 0.4, -0.7]);
      impact(g, view, scale(add(l, r), 0.5), a.act.t, under, [255, 217, 140], [214, 190, 170], 1.3);
    }
  },
};

/* ---- C: the Barrowback -------------------------------------------------------------- */

const C_HANG: [number, number, number] = [-6, 20, 14];

/** The standing stones grown out of it, in the chest's frame: foot, which way it leans up, how big, its rune. */
const C_STONES: Array<{ at: V3; up: V3; r: V3; glyph: string; seed: number }> = [
  { at: [1.22, -0.2, 1.86], up: [0.55, -0.25, 1], r: [0.42, 0.28, 0.5], glyph: 'algiz', seed: 1 },
  { at: [-1.2, -0.25, 1.8], up: [-0.6, -0.2, 1], r: [0.4, 0.26, 0.46], glyph: 'tiwaz', seed: 2 },
  { at: [0.0, -0.8, 1.9], up: [0, -0.55, 1], r: [0.5, 0.3, 0.6], glyph: 'ingwaz', seed: 3 },
  { at: [0.55, -1.0, 1.25], up: [0.4, -1, 0.7], r: [0.32, 0.22, 0.36], glyph: 'staff', seed: 4 },
  { at: [-0.6, -1.0, 1.2], up: [-0.45, -1, 0.65], r: [0.3, 0.2, 0.34], glyph: 'laguz', seed: 5 },
];

/** The moss over its back: soft cushions along the top of the hill behind the shoulders, and a tuft or two of flowers. */
function mossBack(n: number): Mesh {
  const out: Mesh[] = [];
  const pads: Array<[number, number, number, number]> = [
    [0, -0.55, 2.1, 0.7], [0.75, -0.5, 1.85, 0.55], [-0.75, -0.5, 1.85, 0.55], [0.45, -0.9, 1.55, 0.5], [-0.45, -0.9, 1.55, 0.5],
    [0, -1.02, 1.2, 0.5], [0.95, -0.7, 1.2, 0.42], [-0.95, -0.7, 1.2, 0.42], [0.3, -0.15, 2.22, 0.45], [-0.35, -0.2, 2.22, 0.42],
  ];
  pads.forEach(([x, y, z, r], q) => out.push(orbAlong([x, y, z], [x * 0.4, y * 0.9, 0.7], [r, r * 0.92, r * 0.3], 7, 3, q % 3 === 0 ? 'leaf' : 'moss')));
  const decals: Disc[] = [];
  for (const [x, y, z] of [[0.55, -0.62, 2.12], [-0.3, -0.95, 1.72], [0.9, -0.85, 1.4], [-0.85, -0.55, 2.0]] as V3[]) {
    const nn = unit([x * 0.4, y * 0.9, 0.7]);
    decals.push(disc(add([x, y, z], scale(nn, 0.04)), nn, 0.13, 0.13, 5, 'petal', { lit: true }), disc(add([x, y, z], scale(nn, 0.06)), nn, 0.05, 0.05, 5, 'bloom', { lit: true }));
  }
  out.push(paint(decals));
  return merge(...out);
}

function stones(): Mesh {
  const out: Mesh[] = [];
  const decals: Disc[] = [];
  for (const s of C_STONES) {
    const up = unit(s.up);
    out.push(stone(s.at, s.r, { up, fwd: [0, 1, 0], n: 6, rough: 0.08, seed: s.seed, mat: 'shell', point: true, blunt: true }));
    // The rune on the face of it turned most to the front and out, a little up its length.
    let F = sub([s.at[0] * 0.8, 0.8, 0], scale(up, dot([s.at[0] * 0.8, 0.8, 0], up)));
    if (Math.hypot(F[0], F[1], F[2]) < 0.2) F = sub([0, 0, 1], scale(up, up[2]));
    F = unit(F);
    const U = unit(cross(up, F));
    const c = add(add(s.at, scale(up, s.r[2] * 0.7)), scale(F, Math.min(s.r[0], s.r[1]) * 0.8));
    decals.push(...rune(s.glyph, c, U, up, F, s.r[2] * 0.3, 0.075, 0.03, 'shellDark', 'flame'));
  }
  out.push(paint(decals));
  return merge(...out);
}

/** The root-club: a gnarled log, a ball of roots at its far end with a stone held in them, held by its thin end. */
function rootClub(n: number): Mesh {
  const out: Mesh[] = [
    hewn(tube([[0, 0, -0.3], [0.05, 0.02, 0.9], [-0.05, 0.0, 1.9], [0, 0, 2.5]], [0.16, 0.24, 0.36, 0.44], [0.15, 0.22, 0.34, 0.42], 6, 'bark', { turn: 0 }), 0.06, 7),
    stone([0.02, 0.02, 2.82], [0.56, 0.52, 0.5], { n: 6, bevel: 0.35, rough: 0.12, seed: 12, mat: 'shell' }),
  ];
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * TAU + 0.3, c = Math.cos(a), s = Math.sin(a);
    out.push(taper(curve([c * 0.3, s * 0.3, 2.25], [c * 0.72, s * 0.72, 2.7], [c * 0.5, s * 0.5, 3.36 + 0.1 * (q % 2)], 3), 0.13, 0.04, 4, 'bark'));
  }
  // Knots, and moss on the log.
  out.push(orbAlong([0.27, 0.1, 1.3], [1, 0.3, 0], [0.12, 0.1, 0.12], 5, 3, 'bark'), orbAlong([-0.06, -0.3, 1.9], [0, -1, 0.3], [0.22, 0.12, 0.3], 6, 3, 'moss'));
  out.push(tube([[0, 0, 0.0], [0, 0, 0.42]], 0.19, 0.18, 6, 'lace', { turn: 0 }));
  out.push(paint(rune('kenaz', [0, -0.56, 2.82], [-1, 0, 0], [0, 0, 1], [0, -1, 0], 0.2, 0.08, 0.03, 'shellDark', 'flame')));
  out.push(paint(rune('kenaz', [0, 0.56, 2.82], [1, 0, 0], [0, 0, 1], [0, 1, 0], 0.2, 0.08, 0.03, 'shellDark', 'flame')));
  return merge(...out);
}

/** The root-club's size against the model it is built from. */
const C_CLUB = 0.76;

/** The club's line in the hand's frame: hanging down out of the fist and a little forward, so its head trails by the right foot. */
function cGrip(): { X: V3; Y: V3; Z: V3 } {
  const h = handAt(1, C_HANG);
  const Z = unit(toLocal(h, unit([0.25, -0.8, -0.75]))), F = toLocal(h, [1, 0, 0]);
  const Y = unit(sub(F, scale(Z, dot(F, Z))));
  return { X: cross(Y, Z), Y, Z };
}

function cBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 11), k = cut(lod, 5, 6);
  const G = cGrip();
  const club = laid(rootClub(n), [0, 0, 0], scale(G.X, C_CLUB), scale(G.Y, C_CLUB), scale(G.Z, C_CLUB));
  const wrist = unit(sub(scale(GRIP_AT, -1), scale(G.Z, dot(scale(GRIP_AT, -1), G.Z))));
  const round = cross(G.Z, wrist), R = 0.17, fr = 0.14;
  const ring = (along: number, deg: number, r: number): V3 => {
    const a = deg * (Math.PI / 180);
    return add(scale(G.Z, along), add(scale(wrist, Math.cos(a) * r), scale(round, Math.sin(a) * r)));
  };
  const fist = merge(
    orbAlong(ring(0, 0, R + 0.2), G.Z, [0.42, 0.34, 0.5], n, k, 'coat'),
    ...[-0.28, -0.09, 0.1, 0.29].map((along) => tube([0, 60, 125, 190, 250].map((deg) => ring(along, deg, R + fr * 0.75)), fr, fr * 0.95, 4, 'coat')),
  );
  const hide = [-0.5, -0.33, -0.17, 0, 0.17, 0.33, 0.5].map((along) => ({ c: scale(G.Z, along), r: [R, R, R] as V3 }));
  const buckle = (): Mesh => merge(
    orbAlong([0, 1.1, 0.16], [0, 1, 0], [0.26, 0.12, 0.22], 6, 3, 'shell'),
    paint(rune('ring', [0, 1.22, 0.16], [1, 0, 0], [0, 0, 1], [0, 1, 0], 0.13, 0.05, 0.02, 'shellDark', 'flame')),
  );
  const hill = HILL.map(([z, w, d, y]) => [z, w, d * (z > 1 ? 1.08 : 1), y - (z > 1.2 ? 0.08 : 0)] as [number, number, number, number]);
  const base = body({
    hill, head: HEAD, arm: [0.54, 0.48, 0.5, 0.58], leg: [0.54, 0.48, 0.48], buckle, hands: [openHand(0.5, n), fist], rag: 0.2, brands: ['laguz', 'othala'],
    // The moss creeping down over its shoulders from its back.
    over: stripes(hill, [[1.82, 0.05, 1.2, 0.36, 0.3], [1.82, Math.PI - 1.2, Math.PI - 0.05, 0.36, 0.3], [1.5, -0.2, 0.55, 0.22, 0.1], [1.5, Math.PI - 0.55, Math.PI + 0.2, 0.22, 0.1]], 'moss'),
  }, lod);
  return [
    ...base.map((pc): Piece => (pc.key === 'hand1' ? { ...pc, bone: 'grip', bias: 0.06, after: ['body', 'club'], front: [1, 0.4, 0], hide } : pc)),
    { key: 'moss', mesh: mossBack(n), bone: 'chest', bias: 0.02, after: 'body', front: [0, -1, 0.6], lines: false },
    { key: 'stones', mesh: stones(), bone: 'chest', bias: 0.03, after: ['body', 'moss'] },
    { key: 'club', mesh: club, bone: 'grip', bias: 0.04, after: ['ll2', 'lr2'], front: toLocal(handAt(1, C_HANG), [1, 0.3, 0]) },
  ];
}

/** The club swung up from the ground behind it, round and over in front, the body turning into it. */
/** The arm wound up and out behind, and at the blow across the front; the club up and back behind it, then out across the front and down. */
const C_WIND: [number, number, number] = [30, 80, 12], C_BLOW: [number, number, number] = [72, -42, 10];
const C_WRIST: [[number, number], [number, number]] = (() => {
  const G = cGrip();
  return [wristFor(C_WIND, G.Z, [0.6, -0.5, 0.6]), wristFor(C_BLOW, G.Z, [-0.85, 0.45, -0.15])];
})();

function cStrike(p: BipedPose, t: number): [number, number] {
  const back = ramp(t, 0.02, 0.32) * (1 - ramp(t, 0.32, HIT));
  const sweep = ramp(t, 0.32, HIT) * (1 - ramp(t, 0.76, 1));
  const a = p.arms[1];
  const wind = C_WIND, blow = C_BLOW;
  p.arms[1] = [lerp(lerp(a[0], wind[0], back), blow[0], sweep), lerp(lerp(a[1], wind[1], back), blow[1], sweep), lerp(lerp(a[2], wind[2], back), blow[2], sweep)];
  p.chest[2] += -30 * back + 36 * sweep;
  p.chest[0] += 4 * back + 16 * sweep;
  p.yaw += -10 * back + 12 * sweep;
  p.head[1] += 16 * back - 10 * sweep;
  crouch(p, 0.16 * back + 0.26 * sweep);
  return [C_WRIST[0][0] * back + C_WRIST[1][0] * sweep, C_WRIST[0][1] * back + C_WRIST[1][1] * sweep];
}

const cBones = (a: Anim): Bones => {
  let wrist: [number, number] = [0, 0];
  const b = bipedBones(S, a, (p) => {
    const sw = a.go > 0 ? p.arms[1][0] * 0.35 : 0;
    p.arms[1] = [C_HANG[0] + sw, C_HANG[1], C_HANG[2]];
    if (a.act?.kind === 'strike') {
      wrist = cStrike(p, a.act.t);
      return;
    }
    if (a.go > 0) return;
    standing(p, a.t);
    // The club's head lifted off the ground and let thump down again, now and then.
    const thump = beat(a.t, [5.6, 18.4], 1.2);
    p.arms[1] = [p.arms[1][0] + 22 * thump, p.arms[1][1], p.arms[1][2] + 8 * thump];
  });
  b.grip = joint(b.hand1, GRIP_AT, wrist[0], 0, wrist[1]);
  return b;
};

const BARROWBACK: Kind = {
  bones: cBones,
  build: cBuild,
  palette: hidePalette([146, 160, 128], {
    moss: [118, 160, 88], leaf: [146, 184, 100], mark: [98, 118, 86], petal: [250, 214, 226], bloom: [255, 222, 120], bark: [138, 104, 82], lace: [210, 186, 138],
    shell: [200, 192, 180], shellDark: [150, 138, 154],
  }, [226, 220, 196]),
  ...OGRE_SHAPE,
  acts: ['strike'],
  extra: (g, view, b, a, under) => {
    if (!under) runeLightNear(g, view, b, place(b.chest, [0, -0.6, 2.6]), 1.4, 0.18);
    if (a.act?.kind === 'strike') impact(g, view, place(b.grip, scale(cGrip().Z, 2.9 * C_CLUB)), a.act.t, under, [255, 217, 140], [150, 120, 96], 1.2);
  },
};

/* ---- the proposals ------------------------------------------------------------------ */

/** The ogre's subspecies by variant, in `SpeciesDef.subspecies`'s order. */
export const OGRES: readonly Kind[] = [MENHIR_BEARER, GATEBREAKER, BARROWBACK];

/** Each subspecies as the look-over pages show it (`tools/ogre`): what it is, and the moments of its standing loop worth seeing. */
export interface OgreLook { name: string; concept: string; kind: Kind; idle: number[] }

export const OGRE_LOOKS: Record<string, OgreLook> = {
  A: {
    name: 'Menhir Ogre', kind: MENHIR_BEARER, idle: [0, 3, 4.1, 6, 9.2, 12, 17.3, 21],
    concept: 'Lilac hide; a hewn standing stone carried on its shoulder for a club, three runes cut down both broad faces glowing gold, '
      + 'moss on its crown and a rope lashing at the grip; plum chevrons down its back and runes on its arms. Strike: heaved up over its head and brought down in front, dust and rune sparks at the blow.',
  },
  B: {
    name: 'Gatebreaker Ogre', kind: GATEBREAKER, idle: [0, 3, 6, 9.2, 12, 15.4, 16, 21],
    concept: 'Clay-red hide in rune-riveted iron: a cuff on each forearm with its chain snapped and hanging, a length of chain across its chest with a '
      + 'sprung padlock on it, iron over its knuckles, war paint down its flanks, and a broken gate strapped to its back for a shield. '
      + 'Strike: both fists raised over its head and slammed down together.',
  },
  C: {
    name: 'Barrowback Ogre', kind: BARROWBACK, idle: [0, 3, 5.6, 9.2, 12, 15, 18.4, 21],
    concept: 'Sage hide; a mossy barrow for a back, five standing stones grown up out of its shoulders and spine, each with a glowing rune, '
      + 'flowers in the moss and moss over its shoulders, and a root-club with a rune-cut stone in its roots dragged behind it. '
      + 'Strike: wound up and out behind, then swung round across its front and out to its left.',
  },
};
