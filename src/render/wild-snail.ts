import {
  ACT_SECS, add, clamp, coatPalette, cross, cyc, disc, dot, drift, eyes, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint, scale, smile,
  smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The compost snail line: the Snaileaf, a small round snail whose
 * caramel spiral shell is heaped with fallen leaves, green and autumn orange,
 * a sprig standing up out of the top and dark compost showing between; the
 * Middunsnail, bigger and greener, its shell become a compost bin: the
 * spiral a wheel on each side with a cream mushroom on its hub, a slatted
 * crate over it full of dark soil, mushrooms and leaves; and the Hearthsnail,
 * large and old and mossy green, a huge moss-grown shell crowned with a small
 * leafy tree, pink and cream mushrooms and white flowers, moss and vines
 * hanging from it, and a shaggy cream beard of moss under its chin. The
 * species is still `middun` underneath, as saves and the database know it:
 * the settlement worker that turns what is rotting into compost.
 *
 * Each is a soft body on one long foot, spotted brown and caramel, a tall
 * front with the head on it, big dark eyes, and two eyestalks with peach
 * tips, the longer the older. All three are built by one set of functions
 * from a description of the stage (`Snail`), so a stage is its numbers.
 *
 * It glides: no legs, the foot along the ground swelling in waves that go
 * back along it, its flanks rippling, the shell riding on it, the eyestalks
 * bobbing, a faint sheen of slime under and behind it. At its task it bows
 * to something rotting on the ground before it and takes it in, rocks its
 * shell from side to side to turn the heap on its back -- soil and leaves
 * tumbling off, the mushrooms bobbing -- and leaves a little pile of dark
 * compost behind its tail.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Snail {
  stage: 0 | 1 | 2;
  /** The foot behind the front: how far back its tail tip is, its half-width at its widest and the height of its back. */
  foot: { tail: number; w: number; h: number };
  /** The front: where it stands on the ground (y), how tall to the top, its half-width and half-depth at the ground and at the top, and how far forward its top is. */
  neck: { y: number; tall: number; w: [number, number]; d: [number, number]; lean: number };
  head: { r: V3; eye: number };
  /** The eyestalks: how long, how thick, the tip's radius, how far each is splayed out and raked back (degrees), and how far its tip curls forward. */
  tent: { len: number; w: number; bulb: number; splay: number; rake: number; curl: number };
  /** The shell: its middle along the back (y) and over the ground (z), its radius, its half-thickness across, and how many turns its spiral has. */
  shell: { y: number; z: number; R: number; X: number; turns: number };
  /** How many clusters of spots on its foot. */
  spots: number;
  /**
   * How it glides: how many waves along its foot at once, how much of a stride a patch of sole is in a wave, how high a wave lifts
   * its back at a walk and at a run, how far its head nods and its shell rocks (degrees).
   */
  gait: { waves: number; q: number; hump: [number, number]; nod: number; rock: number };
  /** Strides to a turn of the island's walk phase (`Kind.stride`). */
  stride: number;
  size: number;
}

/** A Snaileaf: small and round, a modest shell heaped with leaves, short eyestalks, big eyes. */
const SNAILEAF_LOOK: Snail = {
  stage: 0,
  foot: { tail: 2.0, w: 0.62, h: 0.44 },
  neck: { y: 0.95, tall: 1.38, w: [0.74, 0.52], d: [0.7, 0.5], lean: 0.42 },
  head: { r: [0.6, 0.62, 0.54], eye: 0.19 },
  tent: { len: 0.62, w: 0.075, bulb: 0.11, splay: 20, rake: -6, curl: 0.06 },
  shell: { y: -0.55, z: 1.28, R: 1.08, X: 0.96, turns: 2.4 },
  spots: 7,
  gait: { waves: 2, q: 0.45, hump: [0.1, 0.14], nod: 9, rock: 4 },
  stride: 1.15,
  size: 1.8,
};

/** A Middunsnail: bigger and greener, its shell a wheel under a crate of soil, mushrooms and leaves; longer eyestalks. */
const MIDDUNSNAIL_LOOK: Snail = {
  stage: 1,
  foot: { tail: 2.7, w: 0.84, h: 0.56 },
  neck: { y: 1.3, tall: 2.15, w: [0.88, 0.56], d: [0.82, 0.54], lean: 0.42 },
  head: { r: [0.62, 0.66, 0.56], eye: 0.16 },
  tent: { len: 1.2, w: 0.085, bulb: 0.13, splay: 17, rake: -4, curl: 0.12 },
  shell: { y: -0.75, z: 1.5, R: 1.3, X: 1.08, turns: 2.6 },
  spots: 10,
  gait: { waves: 2, q: 0.45, hump: [0.11, 0.15], nod: 7, rock: 3.5 },
  stride: 0.95,
  size: 1.85,
};

/** A Hearthsnail: large and old, a huge mossy shell crowned with a tree, the longest eyestalks and a beard of moss. */
const HEARTH_LOOK: Snail = {
  stage: 2,
  foot: { tail: 3.4, w: 1.08, h: 0.72 },
  neck: { y: 1.7, tall: 2.8, w: [1.1, 0.68], d: [1.02, 0.66], lean: 0.5 },
  head: { r: [0.74, 0.8, 0.64], eye: 0.15 },
  tent: { len: 1.85, w: 0.1, bulb: 0.15, splay: 15, rake: 2, curl: 0.22 },
  shell: { y: -0.95, z: 2.0, R: 1.85, X: 1.55, turns: 2.8 },
  spots: 12,
  gait: { waves: 1, q: 0.5, hump: [0.13, 0.17], nod: 5, rock: 3 },
  stride: 0.8,
  size: 1.85,
};

/** A number of its own for each thing, nought to one, so a scatter is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/* ---- the strike and the task, in time ---------------------------------------------------- */

/** When each stage's blow lands, as a share of its strike. The voice lands on these (`../audio/voice-snail`). */
export const SNAIL_HITS: readonly number[] = [0.48, 0.5, 0.54];
/**
 * A go at its task, as shares of the go: bowed down to the rotting thing by `down`, taking it in from `gulp` until `gone`, rocking
 * its shell to turn the heap between `churn`, and its compost dropped behind it at `drop`. The same for every stage, so the voice
 * is where the pictures are.
 */
export const SNAIL_WORK = { down: 0.24, gulp: 0.3, gone: 0.42, churn: [0.46, 0.8] as const, drop: 0.84 } as const;
/** How many times it rocks its shell from side to side in a go. */
export const SNAIL_ROCKS = 2;

/* ---- where everything is ------------------------------------------------------------------- */

interface Geo {
  /** The foot from its tail tip to its front, which is inside the front. */
  yt: number; yf: number;
  /** The front's rings, ground up: how high, where along, how wide and how deep. */
  nz: number[]; ny: number[]; nw: number[]; nd: number[];
  /** The head's middle over the top ring. */
  headUp: number;
}
/** Each ring of the front, as a share of its height. */
const NECK_F = [0, 0.07, 0.18, 0.32, 0.47, 0.62, 0.76, 0.89, 1];
/** How much of a bend each joint takes, from the bottom: none at the ground. */
const NECK_BEND = [0, 0, 0.04, 0.1, 0.15, 0.18, 0.19, 0.18, 0.16];

const geos = new Map<Snail, Geo>();
function geoOf(s: Snail): Geo {
  const had = geos.get(s);
  if (had) return had;
  const N = s.neck;
  const nz: number[] = [], ny: number[] = [], nw: number[] = [], nd: number[] = [];
  for (const f of NECK_F) {
    // Flared where it meets the ground, as the foot runs into it.
    const flare = 1 + 0.16 * (1 - smooth(f / 0.3));
    nz.push(N.tall * f);
    // A chest a little forward of the line up to the head.
    ny.push(N.y + N.lean * f ** 1.6 + 0.14 * N.d[0] * Math.sin(Math.PI * clamp(f / 0.75)));
    nw.push(lerp(N.w[0], N.w[1], smooth(f)) * flare);
    nd.push(lerp(N.d[0], N.d[1], smooth(f)) * flare);
  }
  const g: Geo = { yt: -s.foot.tail, yf: N.y + N.d[0] * 0.2, nz, ny, nw, nd, headUp: s.head.r[2] * 0.42 };
  geos.set(s, g);
  return g;
}

/** The foot's half-width and the height of its back at `y` along it: drawn to a point at its tail, full from the middle on. */
function footAt(s: Snail, G: Geo, y: number): { w: number; h: number } {
  const f = clamp((y - G.yt) / (G.yf - G.yt)), t = smooth(f / 0.5);
  return { w: s.foot.w * (0.14 + 0.86 * Math.sqrt(t)), h: s.foot.h * (0.22 + 0.78 * t) };
}
/** A point on the foot, `y` along it and `ph` round it from its right edge on the ground (nought) over its back to its left (pi). */
function footPoint(s: Snail, G: Geo, y: number, ph: number): V3 {
  const { w, h } = footAt(s, G, y), p = clamp(ph, 0, Math.PI), sn = Math.sin(p);
  // The sole spreading a little where it meets the ground.
  return [w * Math.cos(p) * (1 + 0.08 * (1 - sn)), y, h * sn ** 0.7];
}
function neckAt(G: Geo, z: number): { y: number; w: number; d: number; k: number; f: number } {
  let k = 0;
  while (k < G.nz.length - 2 && G.nz[k + 1] < z) k++;
  const f = clamp((z - G.nz[k]) / (G.nz[k + 1] - G.nz[k]));
  return { y: lerp(G.ny[k], G.ny[k + 1], f), w: lerp(G.nw[k], G.nw[k + 1], f), d: lerp(G.nd[k], G.nd[k + 1], f), k, f };
}
const neckPoint = (G: Geo, z: number, ph: number): V3 => { const R = neckAt(G, z); return [R.w * Math.cos(ph), R.y + R.d * Math.sin(ph), z]; };

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
/** A decal of corners `v` wound to face along `n`. */
function facing(v: V3[], m: Mat, n: V3, lit?: boolean): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v, m, lit };
}

/**
 * A disc laid on a curved surface `S(a, b)`, round `(a0, b0)`, `rad` across: each corner on the surface a hair out from it, so a
 * spot follows the curve of a back. `inside` gives a point inside, for which way is out.
 */
function patch(S: (a: number, b: number) => V3, inside: (a: number, b: number) => V3, a0: number, b0: number, rad: number, sides: number, m: Mat,
  o: { aspect?: number; spin?: number; lift?: number; ragged?: number } = {}): Disc {
  const e = 1e-3, p0 = S(a0, b0);
  const sa = Math.hypot(...sub(S(a0 + e, b0), p0)) / e || 1, sb = Math.hypot(...sub(S(a0, b0 + e), p0)) / e || 1;
  const out = (a: number, b: number): V3 => {
    const p = S(a, b), n = unit(cross(sub(S(a + e, b), p), sub(S(a, b + e), p)));
    return dot(n, sub(p, inside(a, b))) < 0 ? scale(n, -1) : n;
  };
  const v: V3[] = [];
  for (let q = 0; q < sides; q++) {
    const t = ((q + 0.5) / sides) * TAU + (o.spin ?? 0), r = rad * (1 + (o.ragged ?? 0) * (jitter(q * 3.1 + a0 * 7 + b0 * 13) - 0.5));
    const a = a0 + (r * Math.cos(t)) / sa, b = b0 + (r * (o.aspect ?? 1) * Math.sin(t)) / sb;
    v.push(add(S(a, b), scale(out(a, b), o.lift ?? 0.018)));
  }
  return facing(v, m, out(a0, b0));
}

/* ---- small things it is made of ------------------------------------------------------------- */

/** A box `half` across, along and up, round `c`: a plank, a post. */
function box(c: V3, half: V3, mat: Mat): Mesh {
  const k = Math.SQRT2, across = half[0] > half[1];
  const d: V3 = across ? [half[0], 0, 0] : [0, half[1], 0];
  return tube([sub(c, d), add(c, d)], (across ? half[1] : half[0]) * k, half[2] * k, 4, mat);
}

/**
 * A leaf lying from `base` along `dir`, its face toward `up`: two halves either side of its midrib, folded up a little along it,
 * each a single flat face seen from either side. `lobes` gives it the bumps of an oak leaf's edge.
 */
function leaf(base: V3, dir: V3, up: V3, len: number, wid: number, mat: Mat, lobes = 0, fold = 0.35): Mesh {
  const d = unit(dir), n = unit(sub(up, scale(d, dot(up, d)))), side = unit(cross(d, n));
  const T = lobes ? [0.12, 0.26, 0.4, 0.54, 0.68, 0.82] : [0.15, 0.38, 0.62, 0.84];
  const hw = (t: number, q: number): number => wid * Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.7 * (lobes && q % 2 ? 0.72 : 1);
  const tip = add(base, scale(d, len));
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const sd of [1, -1]) {
    const at = v.length;
    v.push(base);
    T.forEach((t, q) => v.push(add(add(add(base, scale(d, len * t)), scale(side, sd * hw(t, q))), scale(n, fold * hw(t, q)))));
    v.push(tip);
    // Its underside on corners of its own, so the light worked out at each corner is not the mean of its two sides.
    const half = v.slice(at);
    v.push(...half);
    const idx = Array.from({ length: half.length }, (_, q) => at + q), under = idx.map((q) => q + half.length);
    const face = unit(add(n, scale(side, -sd * fold)));
    f.push({ i: idx, m: mat }, { i: under.reverse(), m: mat });
    want.push(face, scale(face, -1));
  }
  return mesh(v, wound(v, f, want));
}

/** A mushroom from `base` standing along `up`: a pale stalk, its cap `r` across, `h` up. */
function mushroom(base: V3, up: V3, h: number, r: number, cap: Mat, stalk: Mat = 'cloth', n = 7): Mesh {
  const u = unit(up), top = add(base, scale(u, h));
  return merge(
    tube([add(base, scale(u, -0.05)), add(base, scale(u, h * 0.55)), top], [r * 0.3, r * 0.26, r * 0.24], [r * 0.3, r * 0.26, r * 0.24], 5, stalk, { seam: 'start' }),
    orbAlong(add(top, scale(u, r * 0.12)), u, [r, r, r * 0.52], n, 4, cap),
  );
}

/** A small white flower facing `up`: five petals round a yellow heart. */
function flower(c: V3, up: V3, r: number): Mesh {
  const n = unit(up), u = unit(cross(Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], n)), w = cross(n, u);
  const pts: V3[] = [];
  for (let q = 0; q < 10; q++) {
    const a = (q / 10) * TAU, rr = q % 2 ? r * 0.45 : r;
    pts.push(add(c, add(scale(u, Math.cos(a) * rr), scale(w, Math.sin(a) * rr))));
  }
  const v = [...pts, ...pts.map((p) => add(p, scale(n, -0.01)))];
  const f = wound(v, [{ i: pts.map((_, q) => q), m: 'petal' }, { i: pts.map((_, q) => q + pts.length).reverse(), m: 'petal' }], [n, scale(n, -1)]);
  return merge(mesh(v, f), paint([disc(add(c, scale(n, 0.02)), n, r * 0.32, r * 0.32, 6, 'bloom')]));
}

/* ---- its body ------------------------------------------------------------------------------- */

/** How many of each kind of spot, by its colour: brown and caramel. */
const SPOT_MATS: readonly Mat[] = ['mark', 'spot', 'mark'];

/** The foot: a long low dome along the ground, flat under, drawn to a point at its tail and running into the front; spotted. */
function footMesh(s: Snail, G: Geo, K: number, n: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const y = lerp(G.yt, G.yf, (k / K) ** 0.9);
    for (let j = 0; j < n; j++) v.push(footPoint(s, G, y, (Math.PI * j) / (n - 1)));
  }
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j];
      const c = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25);
      f.push({ i: idx, m: j === n - 1 ? 'coatDark' : j < 1 || j > n - 3 ? 'belly' : 'coat', soft: k === K - 1 || undefined });
      want.push(j === n - 1 ? [0, 0, -1] : unit([c[0], 0, c[2] + 0.2]));
    }
  }
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: 'coat' });
  want.push([0, -1, 0]);
  const body = mesh(v, wound(v, f, want));
  const S = (y: number, ph: number): V3 => footPoint(s, G, y, ph);
  const inside = (y: number): V3 => [0, y, footAt(s, G, y).h * 0.2];
  const spots: Disc[] = [];
  const big = s.foot.w * 0.3;
  for (let q = 0; q < s.spots; q++) {
    const side = q % 2 ? 1 : -1;
    const y0 = lerp(G.yt + 0.25, G.yf - s.neck.d[0] * 0.5, (q + 0.5) / s.spots + 0.05 * (jitter(q) - 0.5));
    const ph0 = Math.PI / 2 + side * (0.5 + 0.55 * jitter(q + 3));
    const cluster = 1 + Math.floor(jitter(q + 7) * 3);
    for (let e = 0; e <= cluster; e++) {
      const r = (e ? 0.4 + 0.25 * jitter(q * 7 + e) : 1) * big * (0.8 + 0.4 * jitter(q + 11));
      const a = e * 2.3 + q, off = e ? big * 1.3 : 0;
      const y = y0 + off * Math.cos(a), ph = clamp(ph0 + (off * Math.sin(a)) / Math.max(0.2, s.foot.h), 0.4, Math.PI - 0.4);
      if (y < G.yt + 0.15 || y > G.yf - 0.1) continue;
      spots.push(patch(S, inside, y, ph, r, 8, SPOT_MATS[(q + e) % 3], { spin: jitter(q + e) }));
    }
  }
  // A gloss of slime along each flank, low down.
  for (const ph of [0.42, Math.PI - 0.42]) {
    for (let q = 0; q < 3; q++) spots.push(patch(S, inside, lerp(G.yt + 0.5, G.yf - 0.3, (q + 0.5) / 3), ph, s.foot.w * 0.22, 6, 'glint', { aspect: 0.3, lift: 0.02 }));
  }
  return merge(body, paint(spots));
}

/**
 * The ripple along the foot's flank: a run of short darker bands low down each side, each drawn only while a wave is under it,
 * so the wave is seen going back along the foot. Each band's corners' middle, for drawing it in and out.
 */
function rippleBand(s: Snail, G: Geo): { mesh: Mesh; mid: V3[] } {
  const S = (y: number, ph: number): V3 => footPoint(s, G, y, ph);
  const inside = (y: number): V3 => [0, y, footAt(s, G, y).h * 0.2];
  const bands: Disc[] = [], mid: V3[] = [];
  const y0 = G.yt + s.foot.tail * 0.12, y1 = G.yf - s.neck.d[0] * 0.6;
  const count = Math.max(6, Math.round((y1 - y0) / (0.2 * s.foot.w)));
  for (let q = 0; q < count; q++) {
    const yc = lerp(y0, y1, (q + 0.5) / count);
    for (const ph of [0.55, Math.PI - 0.55]) {
      const d = patch(S, inside, yc, ph, ((y1 - y0) / count) * 0.55, 6, 'coatDark', { aspect: 0.8 / Math.max(0.3, s.foot.h), lift: 0.022 });
      bands.push(d);
      for (const _ of d.v) mid.push(S(yc, ph));
    }
  }
  return { mesh: paint(bands), mid };
}

/** The front: a tall soft column from the ground up to the head, paler in front, spotted up its back; mossy on the Hearthsnail. */
function neckMesh(s: Snail, G: Geo, n: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], K = G.nz.length;
  for (let k = 0; k < K; k++) for (let j = 0; j < n; j++) v.push(neckPoint(G, G.nz[k], ((j + 0.5) / n) * TAU));
  for (let k = 0; k < K - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j];
      const ph = ((j + 1) / n) * TAU, fr = Math.sin(ph);
      f.push({ i: idx, m: k >= 1 && fr > 0.5 ? 'coatLight' : 'coat' });
      want.push([Math.cos(ph), fr, 0]);
    }
  }
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: 'coat' });
  want.push([0, 0, -1]);
  f.push({ i: Array.from({ length: n }, (_, j) => (K - 1) * n + j), m: 'coat' });
  want.push([0, 0, 1]);
  const body = mesh(v, wound(v, f, want));
  const S = (z: number, ph: number): V3 => neckPoint(G, z, ph);
  const inside = (z: number): V3 => [0, neckAt(G, z).y, z];
  const spots: Disc[] = [];
  const count = 5 + 2 * s.stage;
  for (let q = 0; q < count; q++) {
    const z = s.neck.tall * (0.15 + 0.62 * ((q + 0.5) / count)), side = q % 2 ? 1 : -1;
    const ph = -Math.PI / 2 + side * (0.3 + 0.75 * jitter(q + 21));
    const r = neckAt(G, z).w * (0.2 - 0.05 * (z / s.neck.tall)) * (0.8 + 0.4 * jitter(q + 22));
    spots.push(patch(S, inside, z, ph, r, 8, SPOT_MATS[q % 3]));
  }
  // The Hearthsnail's moss, in ragged patches over its back and shoulders.
  if (s.stage === 2) {
    for (let q = 0; q < 9; q++) {
      const z = s.neck.tall * (0.2 + 0.6 * jitter(q + 51)), ph = -Math.PI / 2 + (q % 2 ? 1 : -1) * (0.2 + 1.1 * jitter(q + 52));
      spots.push(patch(S, inside, z, ph, neckAt(G, z).w * (0.26 + 0.14 * jitter(q + 53)), 9, q % 3 ? 'moss' : 'leafDark', { ragged: 0.7, lift: 0.024 }));
    }
  }
  return merge(body, paint(spots));
}

/** The head: a round egg, big dark eyes with a glint high in each, and a small smile. In its own frame. */
function headMesh(s: Snail, n: number, k: number, shut: boolean): Mesh {
  const R = s.head.r, c: V3 = [0, 0, 0];
  const look = eyes(c, R, [0.5, 0.78, 0.2], s.head.eye * (R[0] / 0.5), { tall: 1.25, shut, glint: 0.4, at: true });
  const m = onEgg(c, R, [0, 1, -0.34]);
  const marks: Disc[] = [];
  // A few freckles over its crown.
  for (let q = 0; q < 4; q++) {
    const p = onEgg(c, R, [(q % 2 ? 1 : -1) * (0.3 + 0.3 * jitter(q + 61)), -0.2 + 0.5 * jitter(q + 62), 0.9]);
    marks.push(disc(add(p.p, scale(p.n, 0.02)), p.n, R[0] * 0.1, R[0] * 0.1, 6, q % 2 ? 'spot' : 'mark'));
  }
  return merge(orb(c, R, n + 2, k + 1, 'coat'), paint(marks), smile(m.p, m.n, R[0] * 0.24, 'nose'), look);
}

/** An eyestalk: a soft tube tapering a little, curving forward at its tip, and its peach tip. In its own frame, up along z. */
function tentMesh(s: Snail, n: number): Mesh {
  const T = s.tent, L = T.len;
  const pts: V3[] = [[0, 0, -0.08], [0, -0.02 * L, 0.35 * L], [0, T.curl * 0.3, 0.72 * L], [0, T.curl, L]];
  const w = [T.w * 1.35, T.w * 1.05, T.w * 0.92, T.w * 0.86];
  const stalk = tube(pts, w, w, Math.max(6, n - 2), (ring) => (ring >= 2 ? 'featherDark' : 'feather'), { seam: 'start' });
  const tip: V3 = [0, T.curl + 0.02, L + T.bulb * 0.5];
  return merge(stalk, orb(tip, [T.bulb, T.bulb, T.bulb * 1.15], n, 4, 'bill'));
}

/** The beard of the Hearthsnail: shaggy cream locks of moss hanging from its chin and throat. In the head's frame. */
function beardMesh(s: Snail): Mesh {
  const R = s.head.r, locks: Mesh[] = [];
  for (let q = 0; q < 11; q++) {
    const x = (q / 10 - 0.5) * R[0] * 1.5, mid = 1 - Math.abs(q / 10 - 0.5) * 2;
    const root = onEgg([0, 0, 0], R, [x / R[0], 0.75, -0.75]).p;
    const len = (1.0 + 1.0 * mid) * R[2] * (0.85 + 0.3 * jitter(q + 71));
    const tip: V3 = [x * 1.2, root[1] + 0.18 + 0.12 * jitter(q + 72), root[2] - len];
    const mat: Mat = q % 3 === 1 ? 'clothDark' : 'lining';
    locks.push(taper([add(root, [0, -0.1, 0.1]), add(lerpV(root, tip, 0.45), [0, 0.16, 0]), tip], 0.27 * R[0] * (0.75 + 0.35 * mid), 0.03, 5, mat));
  }
  return merge(...locks);
}
const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ---- its shell ---------------------------------------------------------------------------- */

/**
 * The shell: a round fat wheel, its spiral on each flank, seen as the seam between one turn and the next going in from the rim at
 * its front, low down, to its middle, each turn paler along its middle as a round thing is. In the shell's frame, its middle at
 * the origin, the spiral in the plane of the body's length and height.
 */
const SPIRAL_IN = 0.13;
function spiralOf(s: Snail): { rho: (th: number) => number; phi: (th: number) => number; at: (side: number, phi: number, rho: number, lift: number) => V3; out: (p: V3) => V3 } {
  const { R, X, turns } = s.shell, R0 = R * 0.94, b = Math.log(1 / SPIRAL_IN) / (turns * TAU);
  const rho = (th: number): number => Math.min(R0, R0 * Math.exp(-b * th));
  const phi = (th: number): number => -0.36 * Math.PI + th;
  const at = (side: number, ph: number, r: number, lift: number): V3 => {
    const x = X * Math.sqrt(Math.max(0, 1 - (r / R) ** 2));
    const p: V3 = [side * x, r * Math.cos(ph), r * Math.sin(ph)];
    return add(p, scale(unit([p[0] / (X * X), p[1] / (R * R), p[2] / (R * R)]), lift));
  };
  const out = (p: V3): V3 => unit([p[0] / (X * X), p[1] / (R * R), p[2] / (R * R)]);
  return { rho, phi, at, out };
}

function shellMesh(s: Snail, lod: number): Mesh {
  const { R, X, turns } = s.shell, st = s.stage;
  const ball = orbAlong([0, 0, 0], [1, 0, 0], [R, R, X], cut(lod, 14, 18), cut(lod, 7, 9), 'shell');
  const S = spiralOf(s), decals: Disc[] = [];
  const steps = cut(lod, 10, 14), N = Math.round((turns + 1) * steps);
  // Each turn's middle paler and its seam dark, from the outermost turn (between the rim and the first seam) inward.
  for (let i = 0; i < N; i++) {
    const t0 = ((i - steps) / steps) * TAU, t1 = ((i + 1 - steps) / steps) * TAU;
    if (t1 > (turns - 1) * TAU + TAU * 0.5) break;
    for (const side of [1, -1]) {
      const band = (f0: number, f1: number, m: Mat, lift: number): void => {
        const r = (th: number, f: number): number => lerp(S.rho(th + TAU), S.rho(th), f);
        const q = [S.at(side, S.phi(t0), r(t0, f0), lift), S.at(side, S.phi(t1), r(t1, f0), lift), S.at(side, S.phi(t1), r(t1, f1), lift), S.at(side, S.phi(t0), r(t0, f1), lift)];
        decals.push(facing(q, m, S.out(scale(add(q[0], q[2]), 0.5))));
      };
      band(0.3, 0.72, 'horn', 0.02);
      if (t0 >= 0) band(0.88, 1.0, 'shellDark', 0.025);
      if (st === 1) band(0.02, 0.12, 'hornDark', 0.024);
    }
  }
  // The middle of the spiral.
  for (const side of [1, -1]) {
    const c = S.at(side, 0, 0, 0.03);
    decals.push(disc(c, [side, 0, 0], R * SPIRAL_IN * 1.1, R * SPIRAL_IN * 1.1, 8, 'shellDark'));
  }
  // Blotches of brown along its turns.
  for (let q = 0; q < 10 - 2 * st; q++) {
    const th = (0.15 + (turns - 0.8) * jitter(q + 81)) * TAU, f = 0.25 + 0.5 * jitter(q + 82), side = q % 2 ? 1 : -1;
    const r = lerp(S.rho(th + TAU), S.rho(th), f), rad = (S.rho(th) - S.rho(th + TAU)) * 0.22;
    const c = S.at(side, S.phi(th), r, 0.03);
    decals.push(disc(c, S.out(c), rad, rad * 0.8, 7, 'hornDark', { spin: jitter(q) }));
  }
  // The Hearthsnail's shell is grown over with moss, thickest over its top.
  if (st === 2) {
    const Sf = (a: number, b: number): V3 => [X * Math.sin(a) * Math.cos(b), R * Math.cos(a), R * Math.sin(a) * Math.sin(b)];
    for (let q = 0; q < 44; q++) {
      const a = 0.2 + 2.7 * jitter(q + 91), b = (q % 2 ? 0 : Math.PI) + (q % 2 ? 1 : -1) * 1.5 * jitter(q + 92);
      if (Math.sin(a) * Math.sin(b) < -0.25) continue;
      decals.push(patch(Sf, () => [0, 0, 0], a, b, R * (0.12 + 0.12 * jitter(q + 93)), 9, q % 4 ? 'moss' : 'leafDark', { ragged: 0.8, lift: 0.04 }));
    }
  }
  return merge(ball, paint(decals));
}

/* ---- what it carries on its shell --------------------------------------------------------- */

/** A dome of points over the top of the shell, `a` round from its left over its top to its right, `b` along it from back to front. */
interface Dome { c: V3; r: V3 }
const domeAt = (D: Dome, a: number, b: number): { p: V3; n: V3 } => {
  const cb = Math.sqrt(Math.max(0, 1 - b * b)), p: V3 = add(D.c, [D.r[0] * Math.sin(a) * cb, D.r[1] * b, D.r[2] * Math.cos(a) * cb]);
  return { p, n: unit([(p[0] - D.c[0]) / D.r[0] ** 2, (p[1] - D.c[1]) / D.r[1] ** 2, (p[2] - D.c[2]) / D.r[2] ** 2]) };
};
/** A leaf laid on a dome, its stalk up toward its top and its tip hanging out and down over it. */
function domeLeaf(D: Dome, a: number, b: number, len: number, mat: Mat, lobes = 0, lift = 0.25): Mesh {
  const { p, n } = domeAt(D, a, b);
  const down = unit(sub([p[0] - D.c[0], p[1] - D.c[1], -0.4], scale(n, dot([p[0] - D.c[0], p[1] - D.c[1], -0.4], n))));
  return leaf(add(p, scale(n, 0.03)), add(down, scale(n, lift)), n, len, len * (lobes ? 0.42 : 0.36), mat, lobes);
}
/**
 * A leaf lying over a dome, `pol` down from its top and `az` round it from its right: its stalk toward the top and its tip out and
 * a little down, lying nearly flat on it, so a ring of them is a heap of leaves.
 */
function heapLeaf(D: Dome, pol: number, az: number, len: number, mat: Mat, lobes = 0, droop = 0.35): Mesh {
  const s = Math.sin(pol), c = Math.cos(pol), ca = Math.cos(az), sa = Math.sin(az);
  const p: V3 = add(D.c, [D.r[0] * s * ca, D.r[1] * s * sa, D.r[2] * c]);
  const n = unit([(p[0] - D.c[0]) / D.r[0] ** 2, (p[1] - D.c[1]) / D.r[1] ** 2, (p[2] - D.c[2]) / D.r[2] ** 2]);
  const out: V3 = [ca, sa, 0], tan = unit(sub(out, scale(n, dot(out, n))));
  const dir = unit(add(add(tan, scale(out, 0.55)), [0, 0, -droop * s]));
  return leaf(add(p, scale(n, 0.04)), add(dir, scale(n, 0.12)), n, len, len * (lobes ? 0.52 : 0.46), mat, lobes, 0.22);
}
/** The colours fallen leaves come in: green, autumn orange, gold, and a darker green. */
const LEAF_MATS: readonly Mat[] = ['ember', 'leaf', 'flame', 'ember', 'leafDark', 'flame'];

/** A sprig standing up out of the top: a stalk with leaves along it, and a clover at its foot. */
function sprig(at: V3, h: number, lean: V3): Mesh {
  const top = add(at, add([0, 0, h * 0.35], scale(lean, h * 0.1)));
  const parts: Mesh[] = [tube([add(at, [0, 0, -0.1]), top], 0.06 * h, 0.06 * h, 5, 'stem')];
  // Broad leaves fanned out and up from the top of a short stalk.
  for (const [yaw, up, l, m] of [[0.3, 1.1, 0.95, 'leaf'], [2.3, 0.9, 0.9, 'leafDark'], [4.0, 1.0, 0.85, 'leaf'], [1.3, 1.8, 0.8, 'leaf'], [5.2, 0.7, 0.75, 'leafDark']] as Array<[number, number, number, Mat]>) {
    const d: V3 = [Math.cos(yaw), Math.sin(yaw), up];
    parts.push(leaf(top, d, [-Math.cos(yaw) * up, -Math.sin(yaw) * up, 1], l * h, l * h * 0.5, m, 0, 0.3));
  }
  // A clover at its foot.
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + 0.9, d: V3 = [Math.cos(a), Math.sin(a), 0.5], c = add(at, add(scale(d, h * 0.35), [h * 0.25, h * 0.15, 0.05]));
    parts.push(orbAlong(c, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1], [h * 0.16, h * 0.16, h * 0.05], 6, 3, 'leaf'));
  }
  return merge(...parts);
}

/** The Snaileaf's heap: dark compost over the top of the shell, leaves lying over it, a sprig standing up out of the top. */
function leafletHeap(s: Snail, lod: number): Mesh {
  const { R, X } = s.shell;
  const D: Dome = { c: [0, -0.06, R * 0.22], r: [X * 1.04, R * 1.02, R * 0.92] };
  const soil = orbAlong([0, -0.06, R * 0.5], [0, 0, 1], [X * 0.92, R * 0.88, R * 0.6], cut(lod, 10, 12), 5, 'grip');
  const parts: Mesh[] = [soil];
  // Rings of leaves from low on the shell up over its top, autumn below and green above, lapped like shingles.
  const AUTUMN: readonly Mat[] = ['ember', 'flame', 'ember', 'horn', 'flame', 'ember'];
  const rows: Array<[number, number, number]> = [[0.9, 8, 0.82], [0.55, 6, 0.78], [0.22, 4, 0.7]];
  rows.forEach(([pol, count, len], r) => {
    for (let q = 0; q < count; q++) {
      const az = ((q + 0.5 * r) / count) * TAU + 0.25 * (jitter(q + r * 11) - 0.5);
      const mat = r === 2 ? (q % 2 ? 'leaf' : 'leafDark') : r === 1 && q % 3 === 1 ? 'leaf' : AUTUMN[(q + r) % AUTUMN.length];
      parts.push(heapLeaf(D, pol + 0.12 * (jitter(q * 5 + r) - 0.5), az, len * R * (0.85 + 0.3 * jitter(q * 3 + r)), mat, mat === 'leaf' || mat === 'leafDark' ? 0 : 1, r ? 0.1 : 0.2));
    }
  });
  parts.push(sprig([0, 0.05, R * 1.08], R * 0.62, [0, 0.2, 0]));
  // Fallen leaves tucked in round the foot of the shell.
  for (const sd of [1, -1]) {
    for (let q = 0; q < 3; q++) {
      const a = -0.5 * Math.PI + (q - 1) * 0.8 + (sd > 0 ? 0.3 : -0.2), p: V3 = [sd * X * 0.6, R * 0.92 * Math.cos(a), R * 0.92 * Math.sin(a)];
      parts.push(leaf(p, [sd * 0.6, Math.cos(a) * 1.2, -0.3], [sd, 0, 0.7], R * 0.5, R * 0.24, q === 1 ? 'leaf' : LEAF_MATS[(q + (sd > 0 ? 0 : 2)) % LEAF_MATS.length], q === 1 ? 0 : 1));
    }
  }
  return merge(...parts);
}

/**
 * The Middunsnail's bin: a slatted crate over the top of the shell, its corner posts dark, its slats pale, dark soil heaped up out
 * of it and spilling between its slats, mushrooms and leaves growing out of the soil, and a cream mushroom on each hub.
 */
function middenHeap(s: Snail, lod: number): Mesh {
  const { R, X } = s.shell;
  const cw = X * 0.92, y0 = -R * 1.25, y1 = R * 0.7, z0 = R * 0.32, z1 = R * 1.02, ym = (y0 + y1) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
  const parts: Mesh[] = [];
  // The soil inside it, heaped up over its rim, and showing between its slats.
  parts.push(box([0, ym, (z0 + z1) / 2], [cw * 0.95, hy * 0.95, hz * 0.97], 'grip'));
  parts.push(orbAlong([0, ym + 0.05, z1 - 0.1], [0, 0, 1], [cw * 1.08, hy * 1.04, R * 0.58], cut(lod, 10, 12), 5, 'grip'));
  for (let q = 0; q < 8; q++) parts.push(orb([(jitter(q + 1) - 0.5) * cw * 1.3, ym + (jitter(q + 2) - 0.5) * hy * 1.6, z1 + R * 0.22 + 0.1 * jitter(q + 3)], R * (0.1 + 0.05 * jitter(q + 4)), 5, 3, q % 2 ? 'leather' : 'grip'));
  // Corner posts.
  for (const x of [-cw, cw]) for (const y of [y0, y1]) parts.push(box([x, y, (z0 + z1) / 2 + 0.08], [0.12, 0.12, hz + 0.14], 'woodDark'));
  // Slats: two along each side and two across each end, the top one along each side a little askew.
  const slat = 0.1, th = 0.07;
  for (const [f, tilt] of [[0.25, 0], [0.72, 4]] as Array<[number, number]>) {
    const z = lerp(z0, z1, f);
    for (const x of [-cw - th, cw + th]) parts.push(moved3(box([0, 0, 0], [th, hy + 0.06, slat * 1.7], 'wood'), [x, ym, z], 0, tilt * Math.sign(x)));
    for (const y of [y0 - th, y1 + th]) parts.push(box([0, y, z], [cw + 0.06, th, slat * 1.7], 'wood'));
  }
  // Leaves standing up out of the soil and lying over its edges; mushrooms up out of it.
  const top = z1 + R * 0.45;
  const stand: Array<[number, number, number, Mat]> = [
    [0.6, -0.6, 0.72, 'leaf'], [-0.55, -0.25, 0.8, 'leafDark'], [0.35, 0.45, 0.62, 'flame'], [-0.25, -0.85, 0.6, 'leaf'],
    [0.7, 0.1, 0.55, 'leafDark'], [-0.65, 0.5, 0.62, 'ember'], [0.05, 0.85, 0.5, 'leaf'], [-0.75, -0.7, 0.55, 'flame'],
  ];
  for (const [x, y, l, m] of stand) {
    const p: V3 = [x * cw, ym + y * hy, top - 0.25], d: V3 = [x * 0.9, y * 0.6, 1];
    parts.push(leaf(p, d, [-x, -y * 0.3, 0.5], l * R, l * R * 0.46, m, m === 'ember' || m === 'flame' ? 1 : 0));
  }
  for (let q = 0; q < 8; q++) {
    const sd = q % 2 ? 1 : -1, y = lerp(y0 + 0.2, y1 - 0.1, (q + 0.5) / 8);
    parts.push(leaf([sd * cw * 0.9, y, z1 + 0.05], [sd, (jitter(q + 41) - 0.5) * 0.8, -0.7], [sd * 0.8, 0, 0.6], R * 0.5, R * 0.23, LEAF_MATS[q % LEAF_MATS.length], q % 3 ? 0 : 1));
  }
  parts.push(mushroom([0.1, ym + hy * 0.3, top - 0.3], [0.08, 0.15, 1], R * 0.62, R * 0.46, 'tooth', 'cloth', cut(lod, 8, 10)));
  parts.push(mushroom([-cw * 0.55, ym - hy * 0.2, top - 0.3], [-0.35, -0.1, 1], R * 0.4, R * 0.25, 'billDark'));
  parts.push(mushroom([cw * 0.6, ym + hy * 0.6, top - 0.35], [0.4, 0.25, 1], R * 0.3, R * 0.19, 'billDark'));
  parts.push(mushroom([cw * 0.45, ym - hy * 0.65, top - 0.3], [0.3, -0.25, 1], R * 0.34, R * 0.21, 'cap'));
  parts.push(mushroom([-cw * 0.3, ym + hy * 0.75, top - 0.35], [-0.2, 0.35, 1], R * 0.22, R * 0.14, 'tooth'));
  // A cream mushroom on each hub of the wheel, and a small one by it; leaves tucked in round its foot.
  for (const sd of [1, -1]) {
    parts.push(mushroom([sd * X * 0.97, 0, 0], [sd, 0, 0.12], R * 0.22, R * 0.3, 'tooth', 'cloth', cut(lod, 8, 10)));
    parts.push(mushroom([sd * X * 0.72, -R * 0.55, -R * 0.42], [sd, -0.3, 0.3], R * 0.14, R * 0.1, 'billDark', 'cloth', 6));
    for (let q = 0; q < 3; q++) {
      const a = -0.5 * Math.PI + (q - 1) * 0.7 - 0.5, p: V3 = [sd * X * 0.55, R * 0.95 * Math.cos(a), R * 0.95 * Math.sin(a)];
      parts.push(leaf(p, [sd * 0.5, Math.cos(a) * 1.2, -0.4], [sd, 0, 0.6], R * 0.45, R * 0.2, LEAF_MATS[(q + (sd > 0 ? 1 : 4)) % LEAF_MATS.length], q === 1 ? 1 : 0));
    }
  }
  return merge(...parts);
}
/** A mesh turned about its own z (yaw) and x (pitch) by degrees, then moved. */
function moved3(m: Mesh, by: V3, yaw = 0, roll = 0): Mesh {
  const cy = Math.cos(yaw * Math.PI / 180), sy = Math.sin(yaw * Math.PI / 180), cr = Math.cos(roll * Math.PI / 180), sr = Math.sin(roll * Math.PI / 180);
  return mesh(m.v.map((p) => {
    const q: V3 = [p[0], p[1] * cr - p[2] * sr, p[1] * sr + p[2] * cr];
    return [q[0] * cy - q[1] * sy + by[0], q[0] * sy + q[1] * cy + by[1], q[2] + by[2]];
  }), m.f);
}

/**
 * The Hearthsnail's crown: a mound of moss and compost over the top of its shell, a small leafy tree growing out of it, pink and
 * cream mushrooms, white flowers, a wooden frame showing the compost at its front, and moss and vines hanging down its sides.
 */
function hearthHeap(s: Snail, lod: number): { heap: Mesh; tree: Mesh } {
  const { R, X } = s.shell;
  const parts: Mesh[] = [];
  const D: Dome = { c: [0, -0.04, R * 0.14], r: [X * 1.02, R * 1.0, R * 0.95] };
  parts.push(orbAlong([0, -0.1, R * 0.5], [0, 0, 1], [X * 0.86, R * 0.82, R * 0.55], cut(lod, 10, 12), 5, 'grip'));
  // Lumps of moss over the mound and the top of the shell.
  for (let q = 0; q < 14; q++) {
    const a = (q % 2 ? 1 : -1) * (0.15 + 0.85 * jitter(q + 101)), b = -0.8 + 1.5 * jitter(q + 102);
    const { p, n } = domeAt(D, a, b);
    parts.push(orbAlong(add(p, scale(n, -0.06)), n, [0.42, 0.42, 0.17].map((x) => x * R / 1.85 * (0.8 + 0.5 * jitter(q + 103))) as V3, 7, 3, q % 3 ? 'moss' : 'leafDark'));
  }
  // Moss grown thick over the upper flanks of the shell, in soft lumps.
  for (let q = 0; q < 16; q++) {
    const sd = q % 2 ? 1 : -1, pol = 0.55 + 0.75 * jitter(q + 141), az = (jitter(q + 142) - 0.5) * 2.2;
    const d = unit([sd * Math.sin(pol) * Math.cos(az * 0.5), Math.sin(az) * 0.8, Math.cos(pol)]);
    const c: V3 = [d[0] * X, d[1] * R, d[2] * R], n = unit([c[0] / (X * X), c[1] / (R * R), c[2] / (R * R)]);
    const r = R * (0.2 + 0.1 * jitter(q + 143));
    parts.push(orbAlong(add(c, scale(n, r * 0.12)), n, [r, r * 0.9, r * 0.3], 7, 3, q % 3 ? 'moss' : 'leafDark'));
  }
  // The wooden frame at its front: two posts and a rail, the compost showing behind.
  const fy = R * 0.62, fz = R * 0.55;
  for (const x of [-X * 0.55, X * 0.55]) parts.push(box([x, fy, fz + 0.35], [0.1, 0.1, 0.62], 'woodDark'));
  parts.push(box([0, fy + 0.04, fz + 0.75], [X * 0.62, 0.08, 0.08], 'wood'));
  parts.push(box([0, fy + 0.04, fz + 0.25], [X * 0.62, 0.07, 0.07], 'wood'));
  parts.push(orbAlong([0, fy - 0.05, fz + 0.4], [0, 1, 0], [X * 0.5, 0.45, 0.25], 7, 3, 'leather'));
  // Mushrooms: a big pink one and a cream one, small ones round them.
  parts.push(mushroom([X * 0.25, R * 0.2, R * 0.95], [0.15, 0.1, 1], R * 0.5, R * 0.32, 'cap', 'cloth', cut(lod, 8, 10)));
  parts.push(mushroom([X * 0.5, R * 0.48, R * 0.75], [0.35, 0.25, 1], R * 0.3, R * 0.2, 'tooth', 'cloth', 8));
  parts.push(mushroom([-X * 0.55, R * 0.35, R * 0.8], [-0.4, 0.2, 1], R * 0.24, R * 0.16, 'cap'));
  parts.push(mushroom([-X * 0.3, -R * 0.62, R * 0.8], [-0.2, -0.3, 1], R * 0.22, R * 0.15, 'tooth'));
  parts.push(mushroom([X * 0.62, -R * 0.4, R * 0.7], [0.4, -0.2, 1], R * 0.18, R * 0.12, 'cap'));
  // White flowers over the moss.
  for (let q = 0; q < 6; q++) {
    const { p, n } = domeAt(D, (q % 2 ? 1 : -1) * (0.3 + 0.6 * jitter(q + 111)), -0.6 + 1.3 * jitter(q + 112));
    parts.push(flower(add(p, scale(n, 0.14)), add(n, [0, 0, 0.5]), R * 0.09));
  }
  // Leaves round its foot, green and autumn.
  for (let q = 0; q < 6; q++) {
    const sd = q % 2 ? 1 : -1;
    parts.push(domeLeaf(D, sd * (0.95 + 0.15 * jitter(q + 121)), -0.75 + 1.5 * ((q >> 1) / 3), R * 0.36, LEAF_MATS[q % LEAF_MATS.length], q % 3 ? 0 : 1, 0.3));
  }
  // Moss and vines hanging down its sides.
  for (let q = 0; q < 10; q++) {
    const sd = q % 2 ? 1 : -1, b = -0.75 + 1.4 * ((q >> 1) / 4) + 0.1 * jitter(q + 131);
    const { p, n } = domeAt(D, sd * (0.85 + 0.15 * jitter(q + 132)), b);
    const len = R * (0.45 + 0.4 * jitter(q + 133)), end = add(p, [n[0] * 0.18, n[1] * 0.1, -len]);
    parts.push(taper([add(p, scale(n, -0.05)), add(lerpV(p, end, 0.5), scale(n, 0.12)), end], q % 3 ? 0.11 : 0.06, 0.03, 4, q % 3 ? 'moss' : 'stem'));
    if (q % 3 === 0) parts.push(leaf(end, [sd * 0.3, 0.2, -1], [sd, 0, 0], R * 0.14, R * 0.07, 'leaf', 0, 0.2));
  }
  const heap = merge(...parts);
  // The tree: a crooked trunk out of the top, two boughs, and its crown in clumps of leaves.
  const base: V3 = [-X * 0.05, -R * 0.2, R * 0.85], H = R * 0.85, sp = R * 0.72;
  const top: V3 = add(base, [0.08, -0.12, H]);
  const tree: Mesh[] = [taper([add(base, [0, 0, -0.3]), add(base, [-0.12, 0.06, H * 0.45]), top], R * 0.14, R * 0.08, 7, 'bark')];
  const boughs: V3[] = [[0.9, 0.25, 0.1], [-0.85, -0.2, 0.15], [0.1, 0.8, 0.25], [-0.15, -0.85, 0.2]].map((d) => add(top, scale(d as V3, sp)));
  boughs.forEach((e, q) => tree.push(taper([lerpV(base, top, 0.6 + 0.08 * q), lerpV(lerpV(base, top, 0.8), e, 0.5), e], R * 0.06, R * 0.03, 5, 'bark')));
  const clumps: Array<[V3, number, Mat]> = [
    [[0, 0, 0.55], 0.62, 'leaf'], [[0.95, 0.3, 0.15], 0.5, 'leafDark'], [[-0.92, -0.2, 0.2], 0.52, 'leaf'],
    [[0.15, 0.9, 0.3], 0.46, 'leafDark'], [[-0.1, -0.95, 0.3], 0.48, 'leafDark'], [[0.55, -0.45, 0.62], 0.44, 'leaf'],
    [[-0.55, 0.45, 0.62], 0.44, 'leaf'], [[0.6, 0.65, 0.4], 0.38, 'leaf'], [[-0.6, -0.6, 0.5], 0.38, 'leaf'],
  ];
  for (const [o, r0, m] of clumps) {
    const c = add(top, scale(o, sp)), r = r0 * R * 0.62;
    tree.push(orb(c, [r * 1.1, r * 1.1, r * 0.82], 7, 4, m));
    // Leaves along its edge, so the crown is leafy and not a row of balls.
    for (let q = 0; q < 3; q++) {
      const a = (q / 3) * TAU + o[0] * 3 + o[1], d: V3 = [Math.cos(a), Math.sin(a), -0.15];
      tree.push(leaf(add(c, scale(d, r * 0.8)), d, [0, 0, 1], r * 0.8, r * 0.36, m === 'leaf' ? 'leafDark' : 'leaf', 1, 0.3));
    }
  }
  return { heap, tree: merge(...tree) };
}

/* ---- how it moves ------------------------------------------------------------------------- */

/** How far a wave has a patch of its foot up, nought to one, `x` through its stride: a soft swell while carried, flat while down. */
function swell(x: number, q: number): number {
  const p = frac(x);
  return p < q ? Math.sin((Math.PI * p) / q) ** 2 : 0;
}

/** Everything a stage's pose says this moment. */
interface SnailPose {
  /** How high a wave has its back at `y` along it, and how far through the swell of one it is, nought to one. */
  lift: (y: number) => number;
  wave: (y: number) => number;
  rings: Xf[];
  across: number[];
  head: Xf; shell: Xf; crown: Xf; tent: [Xf, Xf];
}

/** What a stage does this moment, as numbers over its rest. */
interface Moves {
  /** The front bent back (positive) or bowed forward, degrees; stretched up (positive) or squashed; swayed to its right. */
  bend: number; stretch: number; sway: number;
  nod: number; turn: number;
  /** Each stalk: pitched back and splayed out (degrees), left then right. */
  tent: [[number, number], [number, number]];
  shellPitch: number; shellRoll: number; shellLift: number; shellY: number;
  /** What is heaped on the shell, rocking and bobbing on it. */
  crownPitch: number; crownRoll: number; crownLift: number;
  /** How far the front above the ground is thrust forward, its foot staying where it is. */
  lunge: number;
}

/** A damped wobble set going at `at`: nought before, then swinging `n` times a second and dying away. */
const wobble = (t: number, at: number, secs: number, n: number, die: number): number => (t > at ? Math.exp(-(t - at) * secs * die) * Math.sin((t - at) * secs * n * TAU) : 0);

/** Its strike: drawn back on its foot, its shell tipped back, then thrown forward, the head and the shell's weight into the blow. */
function strikeMoves(s: Snail, m: Moves, t: number): void {
  const hit = SNAIL_HITS[s.stage], T = ACT_SECS.strike;
  const u = clamp((t - hit - 0.04) / (0.99 - hit - 0.04)), keep = 1 - (0.4 * u + 0.6 * smooth(u));
  const rear = ramp(t, 0.03, hit - 0.14), blow = clamp((t - (hit - 0.14)) / 0.14) ** 1.7;
  const heavy = [0.8, 1, 1.15][s.stage];
  m.bend += (34 * rear - 80 * blow) * keep;
  m.stretch += (0.2 * rear - 0.2 * blow) * keep;
  m.nod += (14 * rear - 18 * blow) * keep;
  m.lunge += (-0.2 * rear + 0.6 * blow) * keep * heavy;
  m.shellPitch += (9 * rear - 15 * blow) * keep * heavy;
  m.shellY += (-0.12 * rear + 0.3 * blow) * keep * heavy;
  m.shellLift += 0.12 * rear * (1 - blow) * heavy;
  // Its stalks drawn back as it rears, flung forward with the blow, and quivering after.
  for (const k of [0, 1] as const) {
    m.tent[k][0] += (22 * rear - 30 * blow) * keep + 10 * wobble(t, hit, T, 6, 1.2);
    m.tent[k][1] += 8 * rear * keep;
  }
  // The heap on its back jolted by the blow and rocking after it.
  m.crownPitch += -8 * wobble(t, hit, T, 3.2, 0.9) * heavy;
  m.crownRoll += 5 * wobble(t, hit + 0.04, T, 2.6, 0.8);
  m.crownLift += 0.1 * hump(t, hit + 0.03, 0.08) * heavy;
}

/** How far through a go it is bowed down to the rotting thing on the ground. */
const downOf = (t: number): number => ramp(t, 0.02, SNAIL_WORK.down) * (1 - ramp(t, SNAIL_WORK.gone, 0.6));
/** How far through a go it is rocking its shell, nought to one. */
const churnOf = (t: number): number => { const [a, b] = SNAIL_WORK.churn; return ramp(t, a, a + 0.05) * (1 - ramp(t, b - 0.06, b)); };
/** Where it is in its rocking, as an angle: `SNAIL_ROCKS` turns over the churn. */
const rockAt = (t: number): number => { const [a, b] = SNAIL_WORK.churn; return ((t - a) / (b - a)) * SNAIL_ROCKS * TAU; };

/** How far each stage bows its front and draws it down, and nods its head, to take in what is on the ground. */
const WORK_BOW = [-58, -62, -64], WORK_LOW = [-0.32, -0.36, -0.38], WORK_NOD = [-22, -24, -26];

/** A go at its task: down to the rotting thing, taking it in in gulps, up again rocking its shell from side to side, and a push as its compost drops. */
function workMoves(s: Snail, m: Moves, t: number): void {
  const W = SNAIL_WORK, st = s.stage, d = downOf(t);
  m.bend += d * WORK_BOW[st];
  m.stretch += d * WORK_LOW[st];
  m.lunge += d * 0.12;
  // Gulps: three nods as it takes the thing in.
  const gulp = ramp(t, W.gulp - 0.02, W.gulp + 0.02) * (1 - ramp(t, W.gone - 0.03, W.gone + 0.02));
  m.nod += d * WORK_NOD[st] + 9 * gulp * Math.sin(((t - W.gulp) / (W.gone - W.gulp)) * 3 * TAU);
  m.turn *= 1 - d;
  // Rocking its shell from side to side to turn the heap, what is on it swinging after it and bobbing.
  const c = churnOf(t), w = rockAt(t);
  m.shellRoll += c * [11, 10, 8][st] * Math.sin(w);
  m.shellPitch += c * 3 * Math.sin(2 * w + 0.6);
  m.shellLift += c * 0.06 * Math.abs(Math.sin(w));
  m.crownRoll += c * 9 * Math.sin(w - 0.9);
  m.crownPitch += c * 4 * Math.sin(2 * w - 0.3);
  m.crownLift += c * 0.07 * Math.abs(Math.sin(w - 0.5));
  m.sway += c * -4 * Math.sin(w);
  m.nod += c * 4 * Math.sin(2 * w);
  // Its stalks swaying with the rocking, out of step with each other.
  m.tent[0][1] += c * 10 * Math.sin(w - 0.6);
  m.tent[1][1] -= c * 10 * Math.sin(w - 1.1);
  // A push as the compost drops behind it: its shell tipped forward and down a moment.
  const push = hump(t, W.drop, 0.07);
  m.shellPitch -= 4 * push;
  m.shellLift -= 0.04 * push;
  m.stretch -= 0.04 * push;
}

/** Evolving: drawn up tall, its stalks spread, the heap on its back shaken, and settling. */
function evolveMoves(m: Moves, t: number): void {
  const up = ramp(t, 0.08, 0.45) * (1 - ramp(t, 0.6, 0.92));
  m.stretch += 0.14 * up;
  m.bend += 6 * up;
  m.nod += 12 * up;
  m.tent[0][1] += 12 * up;
  m.tent[1][1] += 12 * up;
  m.tent[0][0] -= 10 * up;
  m.tent[1][0] -= 10 * up;
  m.crownRoll += 6 * wobble(t, 0.5, ACT_SECS.evolve, 2, 0.8);
  m.crownLift += 0.12 * hump(t, 0.5, 0.08);
}

/**
 * The pose of a stage. A wave starts at the front and goes back along the foot (`waves` of them along it at once), lifting its
 * back as it passes; the front over it bobs with each, the shell rides the back and rocks a little, and the stalks bob.
 */
function snailPose(s: Snail, a: Anim): SnailPose {
  const G = geoOf(s), g = smooth(a.go), gait = clamp(a.gait), t = a.t, Ga = s.gait;
  const H = lerp(Ga.hump[0], Ga.hump[1], gait), q = lerp(Ga.q, 0.7, gait);
  const front = G.ny[0], c = (front - G.yt) / Ga.waves;
  const phase = (y: number): number => a.u + (Math.min(y, front) - front) / c;
  const lift = (y: number): number => (g ? g * H * swell(phase(y), q) : 0);
  const m: Moves = {
    bend: 2 * cyc(t, 3), stretch: 0.015 * cyc(t, 2, 1.1), sway: 1.5 * cyc(t, 2, 0.4), nod: 3 * cyc(t, 4, 0.6), turn: 14 * drift(t),
    tent: [[4 * cyc(t, 3, 0.3) + 3 * cyc(t, 7, 1.9), 5 * cyc(t, 2, 0.8)], [4 * cyc(t, 3, 2.1) + 3 * cyc(t, 7, 0.2), 5 * cyc(t, 2, 2.9)]],
    shellPitch: 0.6 * cyc(t, 2, 0.5), shellRoll: 0, shellLift: 0.01 * cyc(t, 4), shellY: 0,
    crownPitch: 0, crownRoll: 0.8 * cyc(t, 3, 1.3), crownLift: 0, lunge: 0,
  };
  if (g > 0) {
    // Going: the head looks where it goes and bobs with each surge of the front; the shell rocks fore and aft as a wave goes under
    // it; the stalks bob after the head.
    const w = TAU * phase(front);
    m.turn *= 1 - g;
    m.bend += g * (-4 - 8 * gait + Ga.nod * 0.2 * Math.sin(w - 1.2));
    m.nod += g * Ga.nod * (1 - 0.4 * gait) * Math.sin(w - 0.6);
    m.stretch += g * 0.03 * Math.sin(w - 0.3);
    m.sway *= 1 - g;
    const ws = TAU * phase(s.shell.y);
    m.shellPitch += g * Ga.rock * Math.sin(ws - 0.8);
    m.shellRoll += g * 1.2 * Math.sin(TAU * a.u * 0.5);
    m.shellLift += lift(s.shell.y) * 0.9;
    m.crownPitch += g * 2 * Math.sin(ws - 1.6);
    m.crownLift += g * 0.03 * Math.sin(2 * ws - 1);
    for (const k of [0, 1] as const) {
      m.tent[k][0] += g * (4 + 8 * gait + (9 + 3 * gait) * Math.sin(w - 1.9 - k * 0.5));
      m.tent[k][1] += g * 2 * Math.sin(w - 2 + k);
    }
  } else if (a.graze > 0) {
    // Head down at the ground, nibbling.
    const gz = smooth(a.graze);
    m.bend += gz * WORK_BOW[s.stage] * 0.85;
    m.stretch += gz * WORK_LOW[s.stage] * 0.8;
    m.nod += gz * (WORK_NOD[s.stage] * 0.8 + 5 * Math.max(0, Math.sin(t * TAU * 1.5)) * (cyc(t, 3) > -0.2 ? 1 : 0));
    m.turn *= 1 - gz;
  }
  const act = a.act;
  const bend0 = m.bend, nod0 = m.nod;
  if (act?.kind === 'strike') strikeMoves(s, m, act.t);
  else if (act?.kind === 'work') {
    // At its task the go is the whole of what it does; it does not graze over it.
    const gz = smooth(a.graze);
    m.bend -= gz * WORK_BOW[s.stage] * 0.85;
    m.stretch -= gz * WORK_LOW[s.stage] * 0.8;
    m.nod = nod0 - gz * (nod0 - 3 * cyc(t, 4, 0.6));
    workMoves(s, m, act.t);
  } else if (act?.kind === 'evolve') evolveMoves(m, act.t);
  // The stalks held nearer upright than the head they are on as it bows and rears.
  const tilt = 0.5 * (m.bend - bend0) + 0.8 * (m.nod - nod0);
  for (const k of [0, 1] as const) m.tent[k][0] -= 0.7 * tilt;
  const rings: Xf[] = [], across: number[] = [];
  const off = (k: number): number => m.lunge * clamp((k - 1) / 4);
  for (let k = 0; k < G.nz.length; k++) {
    if (k === 0) rings.push({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, G.ny[0], G.nz[0]] });
    else {
      const st = m.stretch * clamp((k - 1) / 4);
      rings.push(joint(rings[k - 1], [0, G.ny[k] - G.ny[k - 1] + off(k) - off(k - 1), (G.nz[k] - G.nz[k - 1]) * (1 + st)], m.bend * NECK_BEND[k], m.sway * NECK_BEND[k], 0));
    }
    // Drawn in as it stretches, let out as it squashes, so it keeps its bulk.
    across.push(k >= 2 ? 1 - 0.4 * m.stretch * Math.min(1, (k - 1) / 3) : 1);
  }
  const top = rings[rings.length - 1];
  const head = joint(top, [0, 0.06, G.headUp], -m.bend * 0.4 + m.nod, 0, m.turn);
  const R = s.head.r, T = s.tent;
  const tent = [-1, 1].map((sd, k) => {
    const root = onEgg([0, 0, 0], R, [sd * 0.4, -0.05, 0.92]).p;
    return joint(head, [root[0] * 0.9, root[1], root[2] * 0.9], T.rake + 5 * sd + m.tent[k][0], sd * (T.splay + m.tent[k][1]), 0);
  }) as [Xf, Xf];
  const shell = joint(ROOT, [0, s.shell.y + m.shellY, s.shell.z + m.shellLift], m.shellPitch, m.shellRoll, 0);
  // What is heaped on it pivots about the top of the shell, not its middle.
  const pivot = s.shell.R * 0.6;
  const crown = joint(joint(shell, [0, 0, pivot + m.crownLift], m.crownPitch, m.crownRoll, 0), [0, 0, -pivot], 0, 0, 0);
  const wave = (y: number): number => (g ? g * swell(phase(y), q) : 0);
  return { lift, wave, rings, across, head, shell, crown, tent };
}

/** The last pose worked out, for the pieces that bend within themselves, which are asked for it once each after the bones. */
let lastPose: { s: Snail; key: string; p: SnailPose } | null = null;
function poseFor(s: Snail, a: Anim): SnailPose {
  const key = `${a.t}|${a.u}|${a.go}|${a.gait}|${a.graze}|${a.act?.kind ?? ''}|${a.act?.t ?? ''}`;
  if (lastPose && lastPose.s === s && lastPose.key === key) return lastPose.p;
  const p = snailPose(s, a);
  lastPose = { s, key, p };
  return p;
}

function snailBones(s: Snail): (a: Anim) => Bones {
  const G = geoOf(s);
  return (a) => {
    const p = poseFor(s, a);
    const b: Bones = { body: ROOT, trunk: ROOT, head: p.head, shell: p.shell, crown: p.crown, tent0: p.tent[0], tent1: p.tent[1] };
    p.rings.forEach((x, k) => { b[`ring${k}`] = x; });
    b.neck = p.rings[1];
    b.shadow = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, (G.yt + G.ny[0] + s.neck.d[0]) / 2, 0] };
    return b;
  };
}

/* ---- its pieces --------------------------------------------------------------------------- */

function snailBuild(s: Snail, lod: number): Piece[] {
  const G = geoOf(s), n = cut(lod, 8, 10), k = cut(lod, 5, 6), { R, X } = s.shell;
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.9) };
  const baseSolid = { c: [0, 0, 0] as V3, r: [G.nw[1] * 0.95, G.nd[1] * 0.95, s.neck.tall * 0.4] as V3 };
  const shellSolid = { c: [0, 0, 0] as V3, r: [X * 0.96, R * 0.96, R * 0.96] as V3 };
  const footSolids = [-0.7, 0, 0.7].map((f) => {
    const y = clamp(s.shell.y + f * R, G.yt + 0.1, G.yf);
    const { w, h } = footAt(s, G, y);
    return { c: [0, y, 0] as V3, r: [w * 0.97, R * 0.45, h * 0.95] as V3 };
  });
  const footBody = footMesh(s, G, cut(lod, 12, 16), cut(lod, 7, 9)), ripple = rippleBand(s, G), rippleAt = footBody.v.length;
  const neck = neckMesh(s, G, n + 2);
  const ringOf = neck.v.map((p) => { const Rn = neckAt(G, p[2]); return Rn.k + Rn.f; });
  const pieces: Piece[] = [
    { key: 'foot', mesh: merge(footBody, ripple.mesh), bone: 'trunk', bias: 0, hide: [baseSolid], hideIn: 'ring1', sheen: 'glint', bent: (v, a) => {
      const P = poseFor(s, a);
      const moved = (p: V3): V3 => {
        const h = footAt(s, G, p[1]).h, up = clamp(p[2] / h);
        return [p[0], p[1], p[2] + P.lift(p[1]) * 4.2 * (h / s.foot.h) * up ** 0.7];
      };
      return v.map((p, i) => {
        if (i < rippleAt) return moved(p);
        // A ripple band drawn in while the wave is under it, and gone to nothing between.
        const c = ripple.mid[i - rippleAt], kk = P.wave(c[1]);
        const pc = moved(c), pv = moved(p);
        return [lerp(pc[0], pv[0], kk), lerp(pc[1], pv[1], kk), lerp(pc[2], pv[2], kk)] as V3;
      });
    } },
    { key: 'shell', mesh: shellMesh(s, lod), bone: 'shell', bias: 0.02, after: 'foot', hide: footSolids, hideIn: 'trunk' },
    { key: 'neck', mesh: neck, bone: 'trunk', bias: 0.05, after: ['shell', 'heap'], front: [0, 1, 0], hide: [headSolid], hideIn: 'head', bent: (v, a) => {
      const P = poseFor(s, a);
      return v.map((p, i) => {
        const r = ringOf[i], k0 = Math.min(G.nz.length - 2, Math.floor(r)), f = r - k0;
        const at = (kk: number): V3 => {
          const sc = P.across[kk], local: V3 = [p[0] * sc, (p[1] - G.ny[kk]) * sc, p[2] - G.nz[kk]];
          return place(P.rings[kk], local);
        };
        const A = at(k0), B = at(k0 + 1);
        return [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)] as V3;
      });
    } },
    { key: 'head', mesh: headMesh(s, n, k, false), shut: headMesh(s, n, k, true), bone: 'head', bias: 0.12, after: ['neck', 'shell', 'heap'], front: [0, 1, 0], hide: [{ c: [0, 0, 0], r: scale(s.head.r, 0.5) }] },
  ];
  for (const [q, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    pieces.push({ key: `tent${q}`, mesh: tentMesh(s, n), bone: `tent${q}`, bias: 0.13, after: 'head', hide: [headSolid], hideIn: 'head', front: [sd * 0.3, 0.2, 1] });
  }
  if (s.stage === 0) {
    pieces.push({ key: 'heap', mesh: leafletHeap(s, lod), bone: 'crown', bias: 0.04, after: 'shell', hide: [shellSolid], hideIn: 'shell', thin: true });
  } else if (s.stage === 1) {
    pieces.push({ key: 'heap', mesh: middenHeap(s, lod), bone: 'crown', bias: 0.04, after: 'shell', hide: [{ c: [0, 0, 0], r: [X * 0.9, R * 0.9, R * 0.9] }], hideIn: 'shell', thin: true });
  } else {
    const H = hearthHeap(s, lod);
    pieces.push({ key: 'heap', mesh: H.heap, bone: 'crown', bias: 0.04, after: 'shell', hide: [shellSolid], hideIn: 'shell', thin: true });
    pieces.push({ key: 'tree', mesh: H.tree, bone: 'crown', bias: 0.06, after: ['shell', 'heap'], thin: true });
    pieces.push({ key: 'beard', mesh: beardMesh(s), bone: 'head', bias: 0.125, after: ['head', 'neck'], front: [0, 1, 0], hide: [{ c: [0, 0, 0], r: scale(s.head.r, 0.85) }], hideIn: 'head', thin: true });
  }
  return pieces;
}

/* ---- what it does with its hands full ------------------------------------------------------- */

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const SOIL: RGB = [74, 52, 40];
const SOIL_LIT: RGB = [116, 84, 60];
const ROT: RGB = [150, 128, 64];
const ROT_DARK: RGB = [98, 80, 44];
const LEAF_BITS: readonly RGB[] = [[132, 178, 84], [226, 132, 52], [236, 178, 70], [92, 142, 70]];
/** How big a stage's crumbs, bits and things are drawn, against the Snaileaf's. */
const bigness = (s: Snail): number => [1, 1.25, 1.6][s.stage];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const midOf = (s: Snail, b: Bones): V3 => [0, (b.shell.t[1] + b.ring2.t[1]) / 2, s.shell.R * 0.6];
/** Where something thrown from `p` with velocity `v` is `t` seconds on; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.03, p[2] + v[2] * t - 0.5 * fall * t * t)];
/** Its mouth, at the front of its head, low. */
const mouthOf = (s: Snail, b: Bones): V3 => place(b.head, [0, s.head.r[1] * 0.92, -s.head.r[2] * 0.45]);

/** How far a unit straight up goes on the screen: what a crumb's size, in units, is drawn at. */
const unitPx = (view: View): number => Math.abs(onScreen(view, [0, 0, 1])[1] - onScreen(view, [0, 0, 0])[1]);
/** A crumb of soil: a small dark lump with a lighter top. */
function crumb(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0.01) return;
  g.fillStyle = css(SOIL);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = css(SOIL_LIT);
  g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU); g.fill();
}
/** A bit of leaf, turning as it falls. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, c: RGB): void {
  if (r <= 0.01) return;
  g.fillStyle = css(c);
  g.strokeStyle = css(mix(c, [40, 30, 30], 0.5));
  g.lineWidth = r * 0.25;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.45 * Math.abs(Math.cos(spin)) + r * 0.1, spin * 0.7, 0, TAU);
  g.fill(); g.stroke();
}
/** A soft puff of dust, thickest in its middle. */
function dust(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([206, 182, 144], al));
  grad.addColorStop(0.5, css([196, 170, 132], al * 0.6));
  grad.addColorStop(1, css([196, 170, 132], 0));
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** A rotting apple on the ground, `size` of the whole: brown and spotted, its stalk up. */
function rotten(g: CanvasRenderingContext2D, view: View, c: V3, r: number, size: number): void {
  if (size <= 0.02) return;
  const rr = r * size, [x, y] = onScreen(view, add(c, [0, 0, rr * 0.8]));
  const px = Math.abs(onScreen(view, [0, 0, rr])[1] - onScreen(view, [0, 0, 0])[1]);
  g.fillStyle = css(ROT_DARK);
  g.beginPath(); g.ellipse(x, y, px * 1.12, px * 0.98, 0, 0, TAU); g.fill();
  g.fillStyle = css(ROT);
  g.beginPath(); g.ellipse(x - px * 0.08, y - px * 0.1, px * 0.92, px * 0.8, 0, 0, TAU); g.fill();
  g.fillStyle = css([70, 52, 34]);
  for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(x + px * (0.4 * Math.cos(q * 2.2)), y + px * (0.35 * Math.sin(q * 2.2)), px * 0.18, 0, TAU); g.fill(); }
  g.strokeStyle = css([70, 52, 34]);
  g.lineWidth = px * 0.18;
  g.beginPath(); g.moveTo(x, y - px * 0.8); g.lineTo(x + px * 0.2, y - px * 1.25); g.stroke();
  // A wilted brown leaf still on its stalk.
  leafBit(g, x + px * 0.6, y - px * 1.2, px * 0.6, 0.6, [150, 112, 56]);
}

/** A pile of dark compost on the ground at `c`, `size` of the whole: a low mound, lighter crumbs on its top. */
function pile(g: CanvasRenderingContext2D, view: View, c: V3, r: number, size: number): void {
  if (size <= 0.02) return;
  const rr = r * size, ring = (z: number, k: number): Array<[number, number]> => Array.from({ length: 12 }, (_, q) => {
    const a = (q / 12) * TAU;
    return onScreen(view, add(c, [Math.cos(a) * rr * k, Math.sin(a) * rr * k, z]));
  });
  const fill = (pts: Array<[number, number]>, col: RGB): void => {
    g.fillStyle = css(col);
    g.beginPath();
    pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
  };
  fill(ring(0.02, 1), [52, 36, 30]);
  fill(ring(rr * 0.25, 0.75), SOIL);
  fill(ring(rr * 0.42, 0.42), [92, 66, 48]);
  for (let q = 0; q < 4; q++) {
    const [x, y] = onScreen(view, add(c, [Math.cos(q * 1.7) * rr * 0.5, Math.sin(q * 1.7) * rr * 0.5, rr * 0.3]));
    crumb(g, x, y, rr * 0.14 * unitPx(view));
  }
}

/**
 * At its task: the rotting thing before it, taken in as it gulps; soil crumbs and bits of leaf tumbling off its back as it rocks its
 * shell; and its compost dropped behind its tail, crumbs falling onto a small dark pile. A go kept at, over and over, finds a pile
 * already there and a new thing before it each time.
 */
function workSpray(g: CanvasRenderingContext2D, view: View, s: Snail, b: Bones, a: Anim, t: number, front: boolean, bonesAt: (t: number) => Bones): void {
  const W = SNAIL_WORK, big = bigness(s), mid = midOf(s, b), loop = a.graze >= 0.5, G = geoOf(s), pu = unitPx(view) * big;
  // The thing before it: where its mouth comes down to.
  const low = mouthOf(s, bonesAt(W.down)), r = 0.3 * big;
  const at: V3 = [low[0], low[1] + r * 0.4, 0];
  const gone = ramp(t, W.gulp, W.gone);
  const grow = loop ? ramp(t, 0, 0.08) : 1;
  if (gone < 1 && nearSide(at, mid, view) === front) {
    // Drawn toward its mouth and in as it gulps.
    const m = mouthOf(s, b), c = lerpV(at, [m[0], m[1], Math.max(0, m[2] - r)], gone * 0.7);
    rotten(g, view, c, r, grow * (1 - gone));
  }
  // What tumbles off its back as it rocks.
  const [c0, c1] = W.churn, T = ACT_SECS.work, R = s.shell.R;
  const topZ = R * [1.1, 1.25, 1.05][s.stage];
  for (let q = 0; q < 12; q++) {
    const start = lerp(c0 + 0.02, c1 - 0.08, q / 11), age = (t - start) * T;
    if (age < 0 || age > 0.5) continue;
    // Off whichever side the shell is swinging down to as it goes.
    const sd = Math.sin(rockAt(start)) >= 0 ? 1 : -1, x = sd * s.shell.X * (0.5 + 0.3 * jitter(q + 1));
    const from = place(b.crown, [x, (jitter(q + 2) - 0.5) * R, topZ * (0.75 + 0.2 * jitter(q + 3))]);
    const p = thrown(from, [sd * (1.2 + 1.2 * jitter(q + 4)) * big, (jitter(q + 5) - 0.5) * 1.5, 1.4 + 1.2 * jitter(q + 6)], age, 14);
    if (nearSide(p, mid, view) !== front) continue;
    const [x2, y2] = onScreen(view, p), fade = 1 - ramp(age, 0.38, 0.5);
    if (q % 3 === 1) leafBit(g, x2, y2, 0.2 * pu * fade, age * 14 + q, LEAF_BITS[q % 4]);
    else crumb(g, x2, y2, 0.12 * pu * fade);
  }
  // Its compost, dropped behind its tail.
  const pileAt: V3 = [0, G.yt - 0.4 * big, 0];
  const size = loop ? 1 : ramp(t, W.drop - 0.01, W.drop + 0.08);
  if (nearSide(add(pileAt, [0, 0, 0.3]), mid, view) === front) pile(g, view, pileAt, 0.5 * big, size);
  for (let q = 0; q < 6; q++) {
    const age = (t - W.drop + 0.04 - q * 0.012) * T;
    if (age < 0 || age > 0.22) continue;
    const from = place(b.shell, [(jitter(q + 21) - 0.5) * 0.3, -R * 0.82, -R * 0.45]);
    const p = thrown(from, [(jitter(q + 22) - 0.5) * 0.8, (pileAt[1] - from[1]) / 0.2, 0], age, 30);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    crumb(g, x, y, 0.1 * pu);
  }
}

/** The strike: soil and leaves thrown up off the ground where its head and its shell's weight come down, and a puff of dust. */
function strikeSpray(g: CanvasRenderingContext2D, view: View, s: Snail, b: Bones, atHit: Bones, t: number, front: boolean): void {
  const hit = SNAIL_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (since < 0) return;
  const big = bigness(s), mid = midOf(s, b), m = mouthOf(s, atHit), pu = unitPx(view) * big;
  const at: V3 = [m[0], m[1] + 0.1 * big, 0.1];
  const count = [10, 14, 18][s.stage];
  for (let q = 0; q < count; q++) {
    const a = (q / count) * TAU + jitter(q) * 0.5, sp = (3 + 3 * jitter(q + 1)) * big;
    const p = thrown(at, [Math.cos(a) * sp, Math.sin(a) * sp * 0.7 + 1.5, (4 + 3 * jitter(q + 2)) * Math.sqrt(big)], since, 26);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), fade = 1 - ramp(since, 0.18, 0.26);
    if (q % 3 === 0) leafBit(g, x, y, 0.2 * pu * fade, since * 20 + q, LEAF_BITS[q % 4]);
    else crumb(g, x, y, 0.12 * pu * fade);
  }
  if (front) {
    const [x, y] = onScreen(view, add(at, [0, 0, 0.3 + since * 1.5]));
    dust(g, x, y, (0.4 + 2.2 * since) * pu, 0.6 * (1 - ramp(since, 0.04, 0.25)));
  }
}

/** A sheen of slime on the ground under and behind its foot as it goes: pale and glossy, drying as it is left behind. */
function slime(g: CanvasRenderingContext2D, view: View, s: Snail, go: number): void {
  if (go <= 0.01) return;
  const G = geoOf(s), len = s.foot.tail * 0.6, pts: Array<[number, number]> = [];
  const half = (y: number): number => (y > G.yt ? footAt(s, G, y).w * 0.95 : footAt(s, G, G.yt).w * (1 - (G.yt - y) / len) + 0.02);
  const ys = Array.from({ length: 9 }, (_, q) => lerp(G.yt - len, G.yf - 0.2, q / 8));
  for (const y of ys) pts.push(onScreen(view, [half(y), y, 0.01]));
  for (const y of [...ys].reverse()) pts.push(onScreen(view, [-half(y), y, 0.01]));
  const [ax, ay] = onScreen(view, [0, G.yt - len, 0]), [bx, by] = onScreen(view, [0, G.yf, 0]);
  const grad = g.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, css([236, 240, 226], 0));
  grad.addColorStop(0.3, css([236, 240, 226], 0.45 * go));
  grad.addColorStop(1, css([244, 248, 236], 0.6 * go));
  g.fillStyle = grad;
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** How green each stage's body is gone: cream, greenish cream, mossy green. */
const GREEN = [0, 0.34, 0.66];
const MOSS: RGB = [146, 176, 96];

function snailKind(s: Snail): Kind {
  const bones = snailBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: SNAIL_HITS[s.stage] } });
  const G = geoOf(s), st = s.stage;
  return {
    bones,
    build: (lod) => snailBuild(s, lod),
    // The variant's coat for its body, a soft cream going green as it grows; its markings for its spots, with a caramel beside
    // them. Its shell, its heap and the tips of its stalks are the same on every variant.
    palette: (coat, mark) => {
      const body = mix(mix(coat, [218, 172, 120], 0.5), MOSS, GREEN[st]);
      const spot = mix(mix(mark, [130, 84, 50], 0.15), [120, 120, 60], GREEN[st] * 0.6);
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: mix(body, [120, 100, 80], 0.3),
        coatLight: mix(body, [255, 246, 222], 0.45),
        belly: mix(body, [255, 240, 210], 0.25),
        mark: spot,
        spot: mix(spot, [226, 160, 90], 0.5),
        nose: [96, 58, 48],
        lid: [86, 60, 46],
        eye: [34, 24, 26],
        glint: [255, 253, 246],
        feather: mix([242, 206, 160], MOSS, GREEN[st] * 0.5),
        featherDark: mix([236, 190, 140], MOSS, GREEN[st] * 0.4),
        bill: [246, 158, 100],
        shell: st === 1 ? [216, 168, 112] : st === 2 ? [196, 140, 98] : [214, 150, 84],
        horn: st === 1 ? [236, 200, 146] : st === 2 ? [220, 160, 116] : [238, 186, 112],
        shellDark: [116, 72, 44],
        hornDark: [158, 98, 56],
        grip: [72, 50, 38],
        leather: [108, 78, 54],
        leaf: [132, 180, 86],
        leafDark: [88, 140, 72],
        stem: [104, 140, 70],
        ember: [232, 122, 34],
        flame: [236, 170, 44],
        bark: [124, 90, 62],
        wood: [196, 150, 98],
        woodDark: [132, 94, 62],
        moss: [124, 164, 74],
        cap: st === 2 ? [232, 140, 150] : [212, 92, 66],
        billDark: [230, 142, 72],
        tooth: [244, 230, 202],
        cloth: [240, 228, 204],
        clothDark: [214, 200, 168],
        lining: [244, 236, 214],
        petal: [252, 250, 244],
        bloom: [246, 206, 90],
      }, 30);
    },
    shadow: [(G.ny[0] + s.neck.d[0] - G.yt) * 0.55, Math.max(s.foot.w, s.shell.X) * 1.05],
    stride: s.stride,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are leaves: green and autumn orange.
    motes: [[150, 196, 96], [232, 150, 64]],
    extra: (g, view, b, a, under) => {
      const front = !under, act = a.act;
      if (under) slime(g, view, s, a.go);
      if (!act) return;
      if (act.kind === 'strike') strikeSpray(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workSpray(g, view, s, b, a, act.t, front, (u) => bones({ ...a, act: { kind: 'work', t: u } }));
    },
  };
}

export const SNAILEAF = snailKind(SNAILEAF_LOOK);
export const MIDDUNSNAIL = snailKind(MIDDUNSNAIL_LOOK);
export const HEARTHSNAIL = snailKind(HEARTH_LOOK);
