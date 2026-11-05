import {
  ACT_SECS, add, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint, scale, smile,
  smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The butter-churn snail line: the Creamlet, a small round cream snail,
 * blush-mottled, beaming with its eyes shut, whose shell is a little churn
 * barrel lying on its side -- a cream disc with a tan spiral on each end, iron
 * bands round it -- with an upright churn on top, full of cream, its plunger
 * standing up out of it; the Churnsnail, bigger and longer, its barrel big
 * and its churn tall; and the Butterwhorl, large and tall in front, its body
 * flowing out round it in soft folds, its shell a cluster of churns: a great
 * barrel with a smaller one behind it, a tall churn on top and two small ones
 * either side of it, each with its plunger, riveted bands over the lot, and a
 * gold leaf crest at the front of the shell. The species is still `whirla`
 * underneath, as saves and the database know it: the settlement worker that
 * churns butter at your butter churns.
 *
 * Each is a soft body on one long foot, cream and peach with blush-pink
 * mottling, a tall front with the head on it, a gentle smile, and two
 * eyestalks with a dark round eye at each tip, the longer the older. All
 * three are built by one set of functions from a description of the stage
 * (`Churn`), so a stage is its numbers. The body is the Snaileaf's
 * (`./wild-snail`), worked out the same way; only its shell is its own.
 *
 * It glides: no legs, the foot along the ground swelling in waves that go
 * back along it, the shell riding on it, the plungers jiggling, the eyestalks
 * bobbing, a faint sheen of slime behind. At its task it works its plungers
 * up and down, rocking a little with each stroke, cream splashing up out of
 * the churns, and sets a pat of butter down behind its tail.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** An upright churn on its back: where its foot is (in the shell's frame), how wide at its foot and its rim, how tall, and how far its plunger stands up out of it. */
interface Upright { at: V3; r: [number, number]; h: number; stick: number; lean?: [number, number] }
/** A barrel lying across its back, its spiral ends to the sides: where its middle is (in the shell's frame), its radius and half-length. */
interface Drum { at: V3; R: number; X: number }

interface Churn {
  stage: 0 | 1 | 2;
  /** The foot behind the front: how far back its tail tip is, its half-width at its widest and the height of its back. */
  foot: { tail: number; w: number; h: number };
  /** The front: where it stands on the ground (y), how tall to the top, its half-width and half-depth at the ground and at the top, and how far forward its top is. */
  neck: { y: number; tall: number; w: [number, number]; d: [number, number]; lean: number };
  head: { r: V3; eye: number };
  /** The eyestalks: how long, how thick, the tip's radius, how far each is splayed out and raked back (degrees), and how far its tip curls forward. */
  tent: { len: number; w: number; bulb: number; splay: number; rake: number; curl: number };
  /** The shell's middle along the back (y) and over the ground (z); its barrels, the first the shell itself; its upright churns. */
  shell: { y: number; z: number; drums: Drum[]; churns: Upright[] };
  /** How many blushes of pink on its foot. */
  spots: number;
  gait: { waves: number; q: number; hump: [number, number]; nod: number; rock: number };
  stride: number;
  size: number;
}

/** A Creamlet: small and round, a big head, a little barrel and a little churn on it, short eyestalks. */
const CREAMLET_LOOK: Churn = {
  stage: 0,
  foot: { tail: 1.75, w: 0.6, h: 0.42 },
  neck: { y: 0.92, tall: 1.2, w: [0.74, 0.56], d: [0.7, 0.54], lean: 0.36 },
  head: { r: [0.66, 0.66, 0.58], eye: 0.2 },
  tent: { len: 0.58, w: 0.075, bulb: 0.11, splay: 22, rake: -6, curl: 0.06 },
  shell: {
    y: -0.42, z: 0.95,
    drums: [{ at: [0, 0, 0], R: 0.8, X: 0.74 }],
    churns: [{ at: [0, 0.08, 0.6], r: [0.5, 0.44], h: 0.66, stick: 0.34 }],
  },
  spots: 6,
  gait: { waves: 2, q: 0.45, hump: [0.1, 0.14], nod: 9, rock: 4 },
  stride: 1.15,
  size: 1.8,
};

/** A Churnsnail: bigger and longer, a big barrel lying across its back and a tall churn on it; longer eyestalks. */
const CHURNSNAIL_LOOK: Churn = {
  stage: 1,
  foot: { tail: 2.8, w: 0.82, h: 0.54 },
  neck: { y: 1.3, tall: 2.05, w: [0.86, 0.56], d: [0.8, 0.54], lean: 0.5 },
  head: { r: [0.6, 0.64, 0.54], eye: 0.16 },
  tent: { len: 1.15, w: 0.085, bulb: 0.13, splay: 17, rake: -4, curl: 0.12 },
  shell: {
    y: -0.78, z: 1.3,
    drums: [{ at: [0, 0, 0], R: 1.18, X: 1.0 }],
    churns: [{ at: [0, 0.12, 0.88], r: [0.74, 0.64], h: 0.98, stick: 0.46 }],
  },
  spots: 10,
  gait: { waves: 2, q: 0.45, hump: [0.11, 0.15], nod: 7, rock: 3.5 },
  stride: 0.95,
  size: 1.85,
};

/** A Butterwhorl: large and tall in front, its body flowing out round it; a cluster of churns on its back and a gold crest. */
const BUTTERWHORL_LOOK: Churn = {
  stage: 2,
  foot: { tail: 3.4, w: 1.12, h: 0.7 },
  neck: { y: 1.75, tall: 3.0, w: [1.14, 0.7], d: [1.04, 0.68], lean: 0.62 },
  head: { r: [0.74, 0.8, 0.64], eye: 0.15 },
  tent: { len: 1.75, w: 0.1, bulb: 0.15, splay: 15, rake: 2, curl: 0.22 },
  shell: {
    y: -0.95, z: 1.8,
    drums: [{ at: [0, 0.1, 0], R: 1.55, X: 1.18 }, { at: [0, -1.55, -0.32], R: 1.0, X: 0.86 }],
    churns: [
      { at: [0, -0.18, 1.18], r: [0.86, 0.76], h: 1.12, stick: 0.56 },
      { at: [0, 1.15, 0.92], r: [0.46, 0.4], h: 0.6, stick: 0.32, lean: [-14, 0] },
      { at: [0, -1.5, 0.78], r: [0.48, 0.42], h: 0.62, stick: 0.32, lean: [12, 0] },
    ],
  },
  spots: 14,
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

/** When each stage's blow lands, as a share of its strike. The voice lands on these (`../audio/voice-churn`). */
export const CHURN_HITS: readonly number[] = [0.48, 0.5, 0.54];
/**
 * A go at its task, as shares of the go: working its plungers between `work`, `STROKES` strokes of them, each pushed down at the
 * share `STROKE_DOWN` of its stroke; and a pat of butter set down behind it at `drop`. The same for every stage, so the voice is
 * where the pictures are.
 */
export const CHURN_WORK = { work: [0.08, 0.78] as const, drop: 0.86 } as const;
/** How many strokes of its plungers in a go. */
export const CHURN_STROKES = 5;
/** How far through a stroke the plunger is pushed home: up first, then down hard. */
export const STROKE_DOWN = 0.62;
/** When, as a share of the go, each stroke's plunger goes home: for the voice's thumps and the picture's splashes. */
export const strokeTimes = (): number[] => {
  const [a, b] = CHURN_WORK.work;
  return Array.from({ length: CHURN_STROKES }, (_, k) => a + ((k + STROKE_DOWN) / CHURN_STROKES) * (b - a));
};

/* ---- where everything is ------------------------------------------------------------------- */

interface Geo {
  yt: number; yf: number;
  nz: number[]; ny: number[]; nw: number[]; nd: number[];
  headUp: number;
}
const NECK_F = [0, 0.07, 0.18, 0.32, 0.47, 0.62, 0.76, 0.89, 1];
const NECK_BEND = [0, 0, 0.04, 0.1, 0.15, 0.18, 0.19, 0.18, 0.16];

const geos = new Map<Churn, Geo>();
function geoOf(s: Churn): Geo {
  const had = geos.get(s);
  if (had) return had;
  const N = s.neck;
  const nz: number[] = [], ny: number[] = [], nw: number[] = [], nd: number[] = [];
  for (const f of NECK_F) {
    // Flared where it meets the ground, as the foot runs into it; the Butterwhorl's front more, its body flowing out round it.
    const flare = 1 + (s.stage === 2 ? 0.3 : 0.16) * (1 - smooth(f / 0.3));
    nz.push(N.tall * f);
    ny.push(N.y + N.lean * f ** 1.6 + 0.14 * N.d[0] * Math.sin(Math.PI * clamp(f / 0.75)));
    nw.push(lerp(N.w[0], N.w[1], smooth(f)) * flare);
    nd.push(lerp(N.d[0], N.d[1], smooth(f)) * flare);
  }
  const g: Geo = { yt: -s.foot.tail, yf: N.y + N.d[0] * 0.2, nz, ny, nw, nd, headUp: s.head.r[2] * 0.42 };
  geos.set(s, g);
  return g;
}

function footAt(s: Churn, G: Geo, y: number): { w: number; h: number } {
  const f = clamp((y - G.yt) / (G.yf - G.yt)), t = smooth(f / 0.5);
  return { w: s.foot.w * (0.14 + 0.86 * Math.sqrt(t)), h: s.foot.h * (0.22 + 0.78 * t) };
}
function footPoint(s: Churn, G: Geo, y: number, ph: number): V3 {
  const { w, h } = footAt(s, G, y), p = clamp(ph, 0, Math.PI), sn = Math.sin(p);
  // The sole spreading where it meets the ground; the Butterwhorl's spread out into a skirt that ripples along its edge.
  const skirt = s.stage === 2 ? 0.34 + 0.12 * Math.sin(y * 4.2) : 0.1;
  return [w * Math.cos(p) * (1 + skirt * (1 - sn) ** 2), y, h * sn ** 0.7];
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

/** A disc laid on a curved surface `S(a, b)`, round `(a0, b0)`, `rad` across, a hair out from it. */
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

/* ---- its body ------------------------------------------------------------------------------- */

/** Its mottling: blush pink and peach, in soft ragged patches. */
const SPOT_MATS: readonly Mat[] = ['mark', 'spot', 'mark'];

/** The foot: a long low dome along the ground, flat under, drawn to a point at its tail and running into the front; mottled pink. */
function footMesh(s: Churn, G: Geo, K: number, n: number): Mesh {
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
  const big = s.foot.w * 0.44;
  for (let q = 0; q < s.spots; q++) {
    const side = q % 2 ? 1 : -1;
    const y0 = lerp(G.yt + 0.25, G.yf - s.neck.d[0] * 0.5, (q + 0.5) / s.spots + 0.05 * (jitter(q) - 0.5));
    const ph0 = Math.PI / 2 + side * (0.35 + 0.6 * jitter(q + 3));
    const cluster = 1 + Math.floor(jitter(q + 7) * 3);
    for (let e = 0; e <= cluster; e++) {
      const r = (e ? 0.45 + 0.3 * jitter(q * 7 + e) : 1) * big * (0.8 + 0.4 * jitter(q + 11));
      const a = e * 2.3 + q, off = e ? big * 1.2 : 0;
      const y = y0 + off * Math.cos(a), ph = clamp(ph0 + (off * Math.sin(a)) / Math.max(0.2, s.foot.h), 0.35, Math.PI - 0.35);
      if (y < G.yt + 0.15 || y > G.yf - 0.1) continue;
      spots.push(patch(S, inside, y, ph, r, 9, SPOT_MATS[(q + e) % 3], { spin: jitter(q + e), ragged: 0.45 }));
    }
  }
  // A gloss of slime along each flank, low down.
  for (const ph of [0.42, Math.PI - 0.42]) {
    for (let q = 0; q < 3; q++) spots.push(patch(S, inside, lerp(G.yt + 0.5, G.yf - 0.3, (q + 0.5) / 3), ph, s.foot.w * 0.22, 6, 'glint', { aspect: 0.3, lift: 0.02 }));
  }
  return merge(body, paint(spots));
}

/** The ripple along the foot's flank: short darker bands low down each side, each drawn only while a wave is under it. */
function rippleBand(s: Churn, G: Geo): { mesh: Mesh; mid: V3[] } {
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

/** The front: a tall soft column from the ground up to the head, paler in front, mottled pink up its back. */
function neckMesh(s: Churn, G: Geo, n: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], K = G.nz.length;
  for (let k = 0; k < K; k++) for (let j = 0; j < n; j++) v.push(neckPoint(G, G.nz[k], ((j + 0.5) / n) * TAU));
  for (let k = 0; k < K - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j];
      const ph = ((j + 1) / n) * TAU, fr = Math.sin(ph);
      f.push({ i: idx, m: k >= 1 && fr > 0.45 ? 'coatLight' : 'coat' });
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
  const count = 5 + 3 * s.stage;
  for (let q = 0; q < count; q++) {
    const z = s.neck.tall * (0.12 + 0.6 * ((q + 0.5) / count)), side = q % 2 ? 1 : -1;
    const ph = -Math.PI / 2 + side * (0.25 + 0.85 * jitter(q + 21));
    const r = neckAt(G, z).w * (0.24 - 0.06 * (z / s.neck.tall)) * (0.8 + 0.4 * jitter(q + 22));
    spots.push(patch(S, inside, z, ph, r, 9, SPOT_MATS[q % 3], { ragged: 0.45 }));
  }
  return merge(body, paint(spots));
}

/** Eyes shut in a smile: two arcs curving up, each a band a line thick, painted on the face along `n` at `at`. */
function happyEye(at: V3, n: V3, w: number, m: Mat): Disc {
  const d = unit(n);
  let u = cross([0, 0, 1], d);
  if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = [1, 0, 0];
  u = unit(u);
  const up = cross(d, u);
  const pts: Array<[number, number]> = [];
  for (let q = 0; q <= 8; q++) {
    const a = Math.PI * (q / 8);
    pts.push([-Math.cos(a), Math.sin(a) * 0.62 - 0.2]);
  }
  const th = 0.2;
  const band = [...pts.map(([x, y]) => [x * (1 + th * 0.5), y + th] as [number, number]), ...[...pts].reverse().map(([x, y]) => [x * (1 - th * 0.5), y - th * 0.3] as [number, number])];
  const v = band.map(([x, y]) => add(add(at, scale(d, 0.03)), add(scale(u, x * w * 0.5), scale(up, y * w * 0.5))));
  return facing(v, m, d);
}

/** The head: a round egg, its eyes shut in a smile, a smile under them; the Creamlet's mouth open and its cheeks pink. */
function headMesh(s: Churn, n: number, k: number): Mesh {
  const R = s.head.r, c: V3 = [0, 0, 0];
  const marks: Disc[] = [];
  const w = s.head.eye * (R[0] / 0.5) * 1.9;
  for (const sd of [1, -1]) {
    const e = onEgg(c, R, [sd * 0.46, 0.84, 0.18]);
    marks.push(happyEye(e.p, e.n, w, 'lid'));
    // Pink cheeks under each eye.
    const ch = onEgg(c, R, [sd * 0.6, 0.72, -0.12]);
    marks.push(disc(add(ch.p, scale(ch.n, 0.025)), ch.n, R[0] * (s.stage ? 0.13 : 0.18), R[0] * (s.stage ? 0.08 : 0.11), 8, 'inner'));
  }
  // A few freckles over its crown.
  for (let q = 0; q < 4; q++) {
    const p = onEgg(c, R, [(q % 2 ? 1 : -1) * (0.3 + 0.3 * jitter(q + 61)), -0.2 + 0.5 * jitter(q + 62), 0.9]);
    marks.push(disc(add(p.p, scale(p.n, 0.02)), p.n, R[0] * 0.1, R[0] * 0.1, 6, q % 2 ? 'spot' : 'mark'));
  }
  const m = onEgg(c, R, [0, 1, -0.32]);
  const parts: Mesh[] = [orb(c, R, n + 2, k + 1, 'coat'), paint(marks)];
  if (s.stage === 0) {
    // A wide open smile: a dark mouth, its tongue pink at the bottom of it.
    const mo = onEgg(c, R, [0, 1, -0.36]);
    const right = unit(cross([0, 0, 1], mo.n)), down = scale(cross(mo.n, right), -1);
    const v: V3[] = [];
    for (let q = 0; q <= 10; q++) {
      const a = Math.PI * (q / 10);
      v.push(add(add(mo.p, scale(mo.n, 0.035)), add(scale(right, -Math.cos(a) * R[0] * 0.24), scale(down, Math.sin(a) * R[0] * 0.2))));
    }
    const tongue: V3 = add(add(mo.p, scale(mo.n, 0.045)), scale(down, R[0] * 0.12));
    parts.push(paint([facing(v, 'nose', mo.n), disc(tongue, mo.n, R[0] * 0.11, R[0] * 0.07, 7, 'tongue')]));
  } else {
    parts.push(smile(m.p, m.n, R[0] * 0.26, 'nose'));
  }
  return merge(...parts);
}

/** An eyestalk: a soft tube tapering a little, curving forward at its tip, and its round tip with a dark eye looking forward. */
function tentMesh(s: Churn, n: number): Mesh {
  const T = s.tent, L = T.len;
  const pts: V3[] = [[0, 0, -0.08], [0, -0.02 * L, 0.35 * L], [0, T.curl * 0.3, 0.72 * L], [0, T.curl, L]];
  const w = [T.w * 1.35, T.w * 1.05, T.w * 0.92, T.w * 0.86];
  const stalk = tube(pts, w, w, Math.max(6, n - 2), (ring) => (ring >= 2 ? 'featherDark' : 'feather'), { seam: 'start' });
  const tip: V3 = [0, T.curl + 0.02, L + T.bulb * 0.5];
  const fwd = unit([0, 1, 0.15]), eyeAt = add(tip, scale(fwd, T.bulb * 0.98));
  const side = unit(cross([0, 0, 1], fwd));
  const glint = add(add(eyeAt, scale([0, 0, 1], T.bulb * 0.28)), scale(side, T.bulb * 0.2));
  return merge(
    stalk,
    orb(tip, [T.bulb, T.bulb, T.bulb * 1.1], n, 4, 'bill'),
    paint([disc(eyeAt, fwd, T.bulb * 0.62, T.bulb * 0.7, 9, 'eye'), disc(add(glint, scale(fwd, 0.02)), fwd, T.bulb * 0.2, T.bulb * 0.2, 6, 'glint', { lit: true })]),
  );
}

/* ---- its shell: churns ---------------------------------------------------------------------- */

/** A barrel stave's swell: how much wider than its ends a barrel is across its middle. */
const BULGE = 0.14;

/**
 * A barrel lying across the back, its ends to the sides: staves round it, each a shade of its own, an iron band near each end
 * and one round its middle, rivets on the bands, and on each end a cream disc in a wooden rim with a tan spiral on it.
 */
function drumMesh(d: Drum, lod: number, rivets: boolean): Mesh {
  const { R, X } = d, c = d.at, N = cut(lod, 16, 20), K = 6;
  const rAt = (x: number): number => R * (1 - BULGE * (x / X) ** 2);
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const x = lerp(-X, X, k / K);
    for (let j = 0; j < N; j++) {
      const a = ((j + 0.5) / N) * TAU, r = rAt(x);
      v.push([c[0] + x, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)]);
    }
  }
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, idx = [k * N + j, k * N + j2, (k + 1) * N + j2, (k + 1) * N + j];
      const a = ((j + 1) / N) * TAU;
      f.push({ i: idx, m: j % 3 === 1 ? 'woodDark' : j % 3 === 2 ? 'bark' : 'wood' });
      want.push([0, Math.cos(a), Math.sin(a)]);
    }
  }
  // Its ends: the rim of the staves, and the head set in it.
  for (const [sd, k] of [[-1, 0], [1, K]] as Array<[number, number]>) {
    f.push({ i: Array.from({ length: N }, (_, j) => k * N + j), m: 'woodDark' });
    want.push([sd, 0, 0]);
  }
  const body = mesh(v, wound(v, f, want));
  const decals: Disc[] = [];
  const re = rAt(X);
  for (const sd of [1, -1]) {
    const x = c[0] + sd * (X + 0.012), n: V3 = [sd, 0, 0];
    const ringAt = (r: number, a: number, lift = 0): V3 => [x + sd * lift, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)];
    decals.push(disc(ringAt(0, 0, 0.004), n, re * 0.86, re * 0.86, 18, 'lining'));
    // The spiral: a tan band winding in from near the rim to the middle, two and a half turns.
    const turns = 2.3, steps = 48, r0 = re * 0.74, r1 = re * 0.08, wid = re * 0.085;
    for (let q = 0; q < steps; q++) {
      const t0 = q / steps, t1 = (q + 1) / steps;
      const a0 = -t0 * turns * TAU * sd + 0.6, a1 = -t1 * turns * TAU * sd + 0.6;
      const p0 = lerp(r0, r1, t0), p1 = lerp(r0, r1, t1), w0 = wid * (1 - 0.45 * t0), w1 = wid * (1 - 0.45 * t1);
      decals.push(facing([ringAt(p0 - w0, a0, 0.008), ringAt(p1 - w1, a1, 0.008), ringAt(p1 + w1, a1, 0.008), ringAt(p0 + w0, a0, 0.008)], 'horn', n));
    }
    decals.push(disc(ringAt(0, 0, 0.01), n, re * 0.1, re * 0.1, 8, 'horn'));
  }
  const parts: Mesh[] = [body, paint(decals)];
  // The bands: a strip standing a little proud of the staves, darker at its edges, with rivets along it.
  for (const xf of [-0.72, 0, 0.72]) {
    const x0 = xf * X - 0.07 * R, x1 = xf * X + 0.07 * R, M = N * 2;
    const bv: V3[] = [], bf: Face[] = [], bw: V3[] = [];
    for (const x of [x0, x1]) for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU, r = rAt(x) + 0.035 * R;
      bv.push([c[0] + x, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)]);
    }
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M, a = ((j + 0.5) / M) * TAU;
      bf.push({ i: [j, j2, M + j2, M + j], m: 'metal' });
      bw.push([0, Math.cos(a), Math.sin(a)]);
    }
    parts.push(mesh(bv, wound(bv, bf, bw)));
    if (rivets) {
      for (let q = 0; q < 10; q++) {
        const a = (q / 10) * TAU + 0.3, r = rAt(xf * X) + 0.05 * R;
        parts.push(orb([c[0] + xf * X, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)], 0.04 * R, 4, 3, 'rivet'));
      }
    }
  }
  return merge(...parts);
}

/**
 * An upright churn: staves round it, wider at its foot, an iron band near its foot and one under its rim, a dark rim, and the
 * cream inside it up near the top with a butter-yellow swirl in it. Its plunger is a piece of its own (`dasherMesh`).
 */
function churnMesh(u: Upright, lod: number): Mesh {
  const { r, h } = u, N = cut(lod, 14, 18), K = 5;
  const rAt = (z: number): number => lerp(r[0], r[1], z / h) * (1 + 0.05 * Math.sin(Math.PI * z / h));
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const z = (h * k) / K;
    for (let j = 0; j < N; j++) {
      const a = ((j + 0.5) / N) * TAU;
      v.push([rAt(z) * Math.cos(a), rAt(z) * Math.sin(a), z]);
    }
  }
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, a = ((j + 1) / N) * TAU;
      f.push({ i: [k * N + j, k * N + j2, (k + 1) * N + j2, (k + 1) * N + j], m: j % 3 === 1 ? 'woodDark' : j % 3 === 2 ? 'bark' : 'wood' });
      want.push([Math.cos(a), Math.sin(a), 0]);
    }
  }
  f.push({ i: Array.from({ length: N }, (_, j) => j), m: 'woodDark' });
  want.push([0, 0, -1]);
  // The cream, a little down from the rim, and the wall inside above it.
  const top = h - 0.06 * h, rIn = rAt(h) * 0.86;
  const at = v.length;
  for (let j = 0; j < N; j++) {
    const a = ((j + 0.5) / N) * TAU;
    v.push([rAt(h) * Math.cos(a), rAt(h) * Math.sin(a), h], [rIn * Math.cos(a), rIn * Math.sin(a), h]);
  }
  for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N;
    f.push({ i: [at + 2 * j, at + 2 * j2, at + 2 * j2 + 1, at + 2 * j + 1], m: 'woodDark' });
    want.push([0, 0, 1]);
  }
  const cream: V3[] = Array.from({ length: N }, (_, j) => { const a = ((j + 0.5) / N) * TAU; return [rIn * Math.cos(a), rIn * Math.sin(a), top]; });
  const cv = v.length;
  v.push(...cream);
  f.push({ i: cream.map((_, j) => cv + j), m: 'cloth' });
  want.push([0, 0, 1]);
  const body = mesh(v, wound(v, f, want));
  // The butter-yellow swirl on the cream.
  const swirl: Disc[] = [];
  const steps = 26, turns = 1.6;
  for (let q = 0; q < steps; q++) {
    const t0 = q / steps, t1 = (q + 1) / steps, a0 = t0 * turns * TAU, a1 = t1 * turns * TAU;
    const p0 = lerp(rIn * 0.82, rIn * 0.12, t0), p1 = lerp(rIn * 0.82, rIn * 0.12, t1), w0 = rIn * 0.07, w1 = rIn * 0.07;
    const pt = (rr: number, a: number): V3 => [rr * Math.cos(a), rr * Math.sin(a), top + 0.012];
    swirl.push(facing([pt(p0 - w0, a0), pt(p1 - w1, a1), pt(p1 + w1, a1), pt(p0 + w0, a0)], 'bloom', [0, 0, 1]));
  }
  const parts: Mesh[] = [body, paint(swirl)];
  for (const zf of [0.16, 0.8]) {
    const z0 = zf * h - 0.05 * h, z1 = zf * h + 0.05 * h, M = N * 2;
    const bv: V3[] = [], bf: Face[] = [], bw: V3[] = [];
    for (const z of [z0, z1]) for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU, rr = rAt(z) + 0.03 * r[0];
      bv.push([rr * Math.cos(a), rr * Math.sin(a), z]);
    }
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M, a = ((j + 0.5) / M) * TAU;
      bf.push({ i: [j, j2, M + j2, M + j], m: 'metal' });
      bw.push([Math.cos(a), Math.sin(a), 0]);
    }
    parts.push(mesh(bv, wound(bv, bf, bw)));
  }
  return merge(...parts);
}

/** A churn's plunger, in its own frame, its foot on the cream: a wooden handle standing up out of it, a knob on its top. */
function dasherMesh(u: Upright): Mesh {
  const L = u.stick, w = u.r[1] * 0.15;
  return merge(
    tube([[0, 0, -0.04], [0, 0, L * 0.5], [0, 0, L]], [w, w * 0.95, w * 0.92], [w, w * 0.95, w * 0.92], 7, 'leather', { seam: 'start' }),
    tube([[0, 0, L - w * 0.4], [0, 0, L + w * 1.5]], [w * 1.9, w * 1.9], [w * 1.9, w * 1.9], 8, 'leatherDark'),
    orbAlong([0, 0, L + w * 1.5], [0, 0, 1], [w * 1.9, w * 1.9, w * 0.5], 8, 3, 'leatherDark'),
    // A collar of cream round its foot, where it goes in.
    orbAlong([0, 0, 0.01], [0, 0, 1], [w * 2.1, w * 2.1, w * 0.6], 8, 3, 'cloth'),
  );
}

/** A leaf shape a gold crest is made of: flat, pointed, its face toward `up`, both sides drawn. */
function goldLeaf(base: V3, dir: V3, up: V3, len: number, wid: number): Mesh {
  const d = unit(dir), n = unit(sub(up, scale(d, dot(up, d)))), side = unit(cross(d, n));
  const T = [0.15, 0.38, 0.62, 0.84];
  const hw = (t: number): number => wid * Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.7;
  const tip = add(base, scale(d, len));
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const sd of [1, -1]) {
    const at = v.length;
    v.push(base);
    T.forEach((t) => v.push(add(add(add(base, scale(d, len * t)), scale(side, sd * hw(t))), scale(n, 0.3 * hw(t)))));
    v.push(tip);
    const half = v.slice(at);
    v.push(...half);
    const idx = Array.from({ length: half.length }, (_, q) => at + q), under = idx.map((q) => q + half.length);
    const face = unit(add(n, scale(side, -sd * 0.3)));
    f.push({ i: idx, m: sd > 0 ? 'fitting' : 'flame' }, { i: under.reverse(), m: 'flame' });
    want.push(face, scale(face, -1));
  }
  return mesh(v, wound(v, f, want));
}

/** The Butterwhorl's crest on one end (`sd`) of its great barrel: under the spiral, three gold leaves fanned up from a gold boss. */
function crestMesh(d: Drum, sd: number): Mesh {
  const { R, X } = d, re = R * (1 - BULGE), parts: Mesh[] = [];
  {
    const c: V3 = add(d.at, [sd * (X + 0.05), re * 0.12, -re * 0.8]), n: V3 = [sd, 0, 0];
    parts.push(orbAlong(c, n, [R * 0.14, R * 0.14, R * 0.08], 8, 3, 'fitting'));
    for (const [ang, l] of [[0, 0.5], [-50, 0.4], [50, 0.4], [-100, 0.3], [100, 0.3]] as Array<[number, number]>) {
      const a = (ang * Math.PI) / 180, dir: V3 = [sd * 0.15, Math.sin(a), Math.cos(a)];
      parts.push(goldLeaf(add(c, scale(n, 0.02)), dir, n, R * l, R * l * 0.38));
    }
  }
  return merge(...parts);
}

/* ---- how it moves ------------------------------------------------------------------------- */

function swell(x: number, q: number): number {
  const p = frac(x);
  return p < q ? Math.sin((Math.PI * p) / q) ** 2 : 0;
}

interface ChurnPose {
  lift: (y: number) => number;
  wave: (y: number) => number;
  rings: Xf[];
  across: number[];
  head: Xf; shell: Xf; tent: [Xf, Xf];
  /** Each upright churn's frame, and its plunger's. */
  churns: Xf[]; dashers: Xf[];
}

interface Moves {
  bend: number; stretch: number; sway: number;
  nod: number; turn: number;
  tent: [[number, number], [number, number]];
  shellPitch: number; shellRoll: number; shellLift: number; shellY: number;
  /** How far each plunger is drawn up out of its churn, as a share of its handle, and the churns' own wobble. */
  pump: number[]; churnRoll: number; churnPitch: number;
  lunge: number;
}

const wobble = (t: number, at: number, secs: number, n: number, die: number): number => (t > at ? Math.exp(-(t - at) * secs * die) * Math.sin((t - at) * secs * n * TAU) : 0);

function strikeMoves(s: Churn, m: Moves, t: number): void {
  const hit = CHURN_HITS[s.stage], T = ACT_SECS.strike;
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
  for (const k of [0, 1] as const) {
    m.tent[k][0] += (22 * rear - 30 * blow) * keep + 10 * wobble(t, hit, T, 6, 1.2);
    m.tent[k][1] += 8 * rear * keep;
  }
  // The plungers jolted up by the blow and dropping back, the churns rocking after it.
  m.pump = m.pump.map((p, i) => p + 0.35 * Math.max(0, wobble(t, hit + 0.02 * i, T, 2.4, 1.4)));
  m.churnPitch += -6 * wobble(t, hit, T, 3.2, 0.9) * heavy;
  m.churnRoll += 4 * wobble(t, hit + 0.04, T, 2.6, 0.8);
}

/** How far through a go it is at its churning, nought to one. */
const workOf = (t: number): number => { const [a, b] = CHURN_WORK.work; return ramp(t, a - 0.04, a + 0.02) * (1 - ramp(t, b - 0.02, b + 0.04)); };
/** How far a plunger is drawn up, nought to one, at `t` through the go: drawn up slowly, pushed home hard. */
function strokeAt(t: number): number {
  const [a, b] = CHURN_WORK.work;
  const x = clamp((t - a) / (b - a)) * CHURN_STROKES, p = frac(x);
  if (t <= a || t >= b) return 0;
  return p < STROKE_DOWN ? smooth(p / STROKE_DOWN) : 1 - ((p - STROKE_DOWN) / (1 - STROKE_DOWN)) ** 1.6;
}

/** A go at its task: drawing its plungers up and pushing them home, its front bobbing with each stroke, and a push as it sets its butter down. */
function workMoves(s: Churn, m: Moves, t: number): void {
  const c = workOf(t), up = strokeAt(t);
  // Each churn a moment after the one before it, so the Butterwhorl's are not all as one.
  m.pump = m.pump.map((p, i) => p + c * strokeAt(t - 0.035 * i));
  const [a, b] = CHURN_WORK.work, w = ((t - a) / (b - a)) * CHURN_STROKES * TAU;
  m.bend += c * (-6 - 6 * up);
  m.stretch += c * 0.05 * up;
  m.nod += c * (-8 + 10 * up);
  m.shellLift += c * 0.05 * up;
  m.shellPitch += c * 2.5 * Math.sin(w);
  m.shellRoll += c * [5, 4, 3][s.stage] * Math.sin(w * 0.5);
  m.churnRoll += c * 3 * Math.sin(w * 0.5 - 0.6);
  m.sway += c * -3 * Math.sin(w * 0.5);
  m.tent[0][1] += c * 8 * Math.sin(w - 0.6);
  m.tent[1][1] -= c * 8 * Math.sin(w - 1.1);
  m.tent[0][0] += c * 6 * up;
  m.tent[1][0] += c * 6 * up;
  // A push as the butter goes down behind it.
  const push = hump(t, CHURN_WORK.drop, 0.07);
  m.shellPitch -= 4 * push;
  m.shellLift -= 0.04 * push;
  m.stretch -= 0.04 * push;
}

function evolveMoves(m: Moves, t: number): void {
  const up = ramp(t, 0.08, 0.45) * (1 - ramp(t, 0.6, 0.92));
  m.stretch += 0.14 * up;
  m.bend += 6 * up;
  m.nod += 12 * up;
  m.tent[0][1] += 12 * up;
  m.tent[1][1] += 12 * up;
  m.tent[0][0] -= 10 * up;
  m.tent[1][0] -= 10 * up;
  m.churnRoll += 5 * wobble(t, 0.5, ACT_SECS.evolve, 2, 0.8);
  m.pump = m.pump.map((p) => p + 0.5 * hump(t, 0.5, 0.1));
}

function churnPose(s: Churn, a: Anim): ChurnPose {
  const G = geoOf(s), g = smooth(a.go), gait = clamp(a.gait), t = a.t, Ga = s.gait;
  const H = lerp(Ga.hump[0], Ga.hump[1], gait), q = lerp(Ga.q, 0.7, gait);
  const front = G.ny[0], c = (front - G.yt) / Ga.waves;
  const phase = (y: number): number => a.u + (Math.min(y, front) - front) / c;
  const lift = (y: number): number => (g ? g * H * swell(phase(y), q) : 0);
  const m: Moves = {
    bend: 2 * cyc(t, 3), stretch: 0.015 * cyc(t, 2, 1.1), sway: 1.5 * cyc(t, 2, 0.4), nod: 3 * cyc(t, 4, 0.6), turn: 14 * drift(t),
    tent: [[4 * cyc(t, 3, 0.3) + 3 * cyc(t, 7, 1.9), 5 * cyc(t, 2, 0.8)], [4 * cyc(t, 3, 2.1) + 3 * cyc(t, 7, 0.2), 5 * cyc(t, 2, 2.9)]],
    shellPitch: 0.6 * cyc(t, 2, 0.5), shellRoll: 0, shellLift: 0.01 * cyc(t, 4), shellY: 0,
    pump: s.shell.churns.map((_, i) => 0.03 * (1 + cyc(t, 3, i * 1.3))), churnRoll: 0.6 * cyc(t, 3, 1.3), churnPitch: 0, lunge: 0,
  };
  if (g > 0) {
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
    // The plungers jiggling in their churns as it goes.
    m.pump = m.pump.map((p, i) => p + g * 0.06 * (1 + Math.sin(2 * ws - 1 - i)));
    m.churnPitch += g * 1.5 * Math.sin(ws - 1.6);
    for (const k of [0, 1] as const) {
      m.tent[k][0] += g * (4 + 8 * gait + (9 + 3 * gait) * Math.sin(w - 1.9 - k * 0.5));
      m.tent[k][1] += g * 2 * Math.sin(w - 2 + k);
    }
  } else if (a.graze > 0) {
    const gz = smooth(a.graze);
    m.bend += gz * -50;
    m.stretch += gz * -0.25;
    m.nod += gz * (-18 + 5 * Math.max(0, Math.sin(t * TAU * 1.5)) * (cyc(t, 3) > -0.2 ? 1 : 0));
    m.turn *= 1 - gz;
  }
  const act = a.act;
  const bend0 = m.bend, nod0 = m.nod;
  if (act?.kind === 'strike') strikeMoves(s, m, act.t);
  else if (act?.kind === 'work') {
    const gz = smooth(a.graze);
    m.bend -= gz * -50;
    m.stretch -= gz * -0.25;
    m.nod = nod0 - gz * (nod0 - 3 * cyc(t, 4, 0.6));
    workMoves(s, m, act.t);
  } else if (act?.kind === 'evolve') evolveMoves(m, act.t);
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
  const churns = s.shell.churns.map((u, i) => joint(shell, u.at, (u.lean?.[0] ?? 0) + m.churnPitch * (1 + 0.3 * i), (u.lean?.[1] ?? 0) + m.churnRoll * (1 - 0.2 * i), 0));
  const dashers = s.shell.churns.map((u, i) => joint(churns[i], [0, 0, u.h * 0.94 + clamp(m.pump[i], 0, 1.2) * u.stick * 0.55], 0, 0, 0));
  const wave = (y: number): number => (g ? g * swell(phase(y), q) : 0);
  return { lift, wave, rings, across, head, shell, tent, churns, dashers };
}

let lastPose: { s: Churn; key: string; p: ChurnPose } | null = null;
function poseFor(s: Churn, a: Anim): ChurnPose {
  const key = `${a.t}|${a.u}|${a.go}|${a.gait}|${a.graze}|${a.act?.kind ?? ''}|${a.act?.t ?? ''}`;
  if (lastPose && lastPose.s === s && lastPose.key === key) return lastPose.p;
  const p = churnPose(s, a);
  lastPose = { s, key, p };
  return p;
}

function churnBones(s: Churn): (a: Anim) => Bones {
  const G = geoOf(s);
  return (a) => {
    const p = poseFor(s, a);
    const b: Bones = { body: ROOT, trunk: ROOT, head: p.head, shell: p.shell, tent0: p.tent[0], tent1: p.tent[1] };
    p.rings.forEach((x, k) => { b[`ring${k}`] = x; });
    p.churns.forEach((x, k) => { b[`churn${k}`] = x; });
    p.dashers.forEach((x, k) => { b[`dasher${k}`] = x; });
    b.neck = p.rings[1];
    b.shadow = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, (G.yt + G.ny[0] + s.neck.d[0]) / 2, 0] };
    return b;
  };
}

/* ---- its pieces --------------------------------------------------------------------------- */

function churnBuild(s: Churn, lod: number): Piece[] {
  const G = geoOf(s), n = cut(lod, 8, 10), k = cut(lod, 5, 6), main = s.shell.drums[0];
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.9) };
  const baseSolid = { c: [0, 0, 0] as V3, r: [G.nw[1] * 0.95, G.nd[1] * 0.95, s.neck.tall * 0.4] as V3 };
  const drumSolids = s.shell.drums.map((d) => ({ c: d.at, r: [d.X * 0.96, d.R * 0.9, d.R * 0.9] as V3 }));
  const footSolids = [-0.7, 0, 0.7].map((f) => {
    const y = clamp(s.shell.y + f * main.R, G.yt + 0.1, G.yf);
    const { w, h } = footAt(s, G, y);
    return { c: [0, y, 0] as V3, r: [w * 0.97, main.R * 0.45, h * 0.95] as V3 };
  });
  const footBody = footMesh(s, G, cut(lod, 12, 16), cut(lod, 7, 9)), ripple = rippleBand(s, G), rippleAt = footBody.v.length;
  const neck = neckMesh(s, G, n + 2);
  const ringOf = neck.v.map((p) => { const Rn = neckAt(G, p[2]); return Rn.k + Rn.f; });
  const shellParts: Mesh[] = s.shell.drums.map((d, i) => drumMesh(d, lod, s.stage > 0 || i === 0));
  const pieces: Piece[] = [
    { key: 'foot', mesh: merge(footBody, ripple.mesh), bone: 'trunk', bias: 0, hide: [baseSolid], hideIn: 'ring1', sheen: 'glint', bent: (v, a) => {
      const P = poseFor(s, a);
      const moved = (p: V3): V3 => {
        const h = footAt(s, G, p[1]).h, up = clamp(p[2] / h);
        return [p[0], p[1], p[2] + P.lift(p[1]) * 4.2 * (h / s.foot.h) * up ** 0.7];
      };
      return v.map((p, i) => {
        if (i < rippleAt) return moved(p);
        const c = ripple.mid[i - rippleAt], kk = P.wave(c[1]);
        const pc = moved(c), pv = moved(p);
        return [lerp(pc[0], pv[0], kk), lerp(pc[1], pv[1], kk), lerp(pc[2], pv[2], kk)] as V3;
      });
    } },
    { key: 'shell', mesh: merge(...shellParts), bone: 'shell', bias: 0.02, after: 'foot', hide: footSolids, hideIn: 'trunk' },
    { key: 'neck', mesh: neck, bone: 'trunk', bias: 0.05, after: ['shell', 'churn0'], front: [0, 1, 0], hide: [headSolid], hideIn: 'head', bent: (v, a) => {
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
    { key: 'head', mesh: headMesh(s, n, k), bone: 'head', bias: 0.12, after: ['neck', 'shell', 'churn0'], front: [0, 1, 0], hide: [{ c: [0, 0, 0], r: scale(s.head.r, 0.5) }] },
  ];
  for (const [q, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    pieces.push({ key: `tent${q}`, mesh: tentMesh(s, n), bone: `tent${q}`, bias: 0.13, after: 'head', hide: [headSolid], hideIn: 'head', front: [sd * 0.3, 0.2, 1] });
  }
  // The crest over the end of the barrel, after the paint on it.
  // Each under the barrel once its end is turned away.
  if (s.stage === 2) for (const [q, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) pieces.push({ key: `crest${q}`, mesh: crestMesh(main, sd), bone: 'shell', bias: 0.03, after: 'shell', front: [sd, 0, 0], thin: true });
  s.shell.churns.forEach((u, i) => {
    // Its foot sits down in the barrel under it, out of sight.
    pieces.push({ key: `churn${i}`, mesh: churnMesh(u, lod), bone: `churn${i}`, bias: 0.04 + 0.005 * i, after: 'shell', hide: drumSolids, hideIn: 'shell' });
    pieces.push({ key: `dasher${i}`, mesh: dasherMesh(u), bone: `dasher${i}`, bias: 0.05 + 0.005 * i, after: `churn${i}`, thin: true });
  });
  return pieces;
}

/* ---- what it does with its hands full ------------------------------------------------------- */

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const CREAM: RGB = [252, 244, 214];
const CREAM_DARK: RGB = [226, 210, 168];
const BUTTER: RGB = [250, 222, 112];
const BUTTER_DARK: RGB = [222, 184, 74];
const bigness = (s: Churn): number => [1, 1.25, 1.6][s.stage];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const midOf = (s: Churn, b: Bones): V3 => [0, (b.shell.t[1] + b.ring2.t[1]) / 2, s.shell.drums[0].R * 0.6];
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.03, p[2] + v[2] * t - 0.5 * fall * t * t)];
const mouthOf = (s: Churn, b: Bones): V3 => place(b.head, [0, s.head.r[1] * 0.92, -s.head.r[2] * 0.45]);
const unitPx = (view: View): number => Math.abs(onScreen(view, [0, 0, 1])[1] - onScreen(view, [0, 0, 0])[1]);

/** A drop of cream: a round white blob with a lit top. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0.01) return;
  g.fillStyle = css(CREAM_DARK);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = css(CREAM);
  g.beginPath(); g.arc(x - r * 0.2, y - r * 0.25, r * 0.7, 0, TAU); g.fill();
}
function dust(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([206, 182, 144], al));
  grad.addColorStop(0.5, css([196, 170, 132], al * 0.6));
  grad.addColorStop(1, css([196, 170, 132], 0));
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** A pat of butter on the ground at `c`, `size` of the whole: a soft yellow block on a scrap of cloth, a swirl pressed in its top. */
function pat(g: CanvasRenderingContext2D, view: View, c: V3, r: number, size: number): void {
  if (size <= 0.02) return;
  const rr = r * size;
  const quad = (z: number, k: number, kz = 1): Array<[number, number]> => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => onScreen(view, add(c, [x * rr * k, y * rr * k * kz, z])));
  const fill = (pts: Array<[number, number]>, col: RGB): void => {
    g.fillStyle = css(col);
    g.beginPath();
    pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fill();
  };
  fill(quad(0.01, 1.35), [236, 228, 210]);
  // Its sides, then its top.
  const lo = quad(0.02, 0.8, 0.7), hi = quad(rr * 0.7, 0.75, 0.65);
  for (let q = 0; q < 4; q++) fill([lo[q], lo[(q + 1) % 4], hi[(q + 1) % 4], hi[q]], BUTTER_DARK);
  fill(hi, BUTTER);
  const [x, y] = onScreen(view, add(c, [0, 0, rr * 0.72]));
  g.strokeStyle = css(BUTTER_DARK);
  g.lineWidth = Math.max(0.6, rr * 0.08 * unitPx(view));
  g.beginPath();
  g.ellipse(x, y, rr * 0.3 * unitPx(view), rr * 0.18 * unitPx(view), 0, 0.3, 5.6);
  g.stroke();
}

/**
 * At its task: cream splashing up out of each churn as its plunger goes home, and a pat of butter set down behind its tail. A go
 * kept at, over and over, finds a pat already there each time.
 */
function workSpray(g: CanvasRenderingContext2D, view: View, s: Churn, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(s, b), loop = a.graze >= 0.5, G = geoOf(s), pu = unitPx(view) * big, T = ACT_SECS.work;
  s.shell.churns.forEach((u, i) => {
    for (const home of strokeTimes()) {
      const at = home + 0.035 * i, age = (t - at) * T;
      if (age < 0 || age > 0.42) continue;
      for (let q = 0; q < 5; q++) {
        const a0 = (q / 5) * TAU + jitter(q + i * 7 + home * 31) * 1.2, sp = (0.6 + 0.6 * jitter(q + 3)) * u.r[1] * 3;
        const from = place(b[`churn${i}`], [Math.cos(a0) * u.r[1] * 0.5, Math.sin(a0) * u.r[1] * 0.5, u.h]);
        const p = thrown(from, [Math.cos(a0) * sp, Math.sin(a0) * sp, 2.2 + 1.2 * jitter(q + 5)], age, 16);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p), fade = 1 - ramp(age, 0.3, 0.42);
        drop(g, x, y, 0.07 * pu * fade * (0.7 + 0.6 * jitter(q + 9)));
      }
    }
  });
  const patAt: V3 = [0.15 * big, G.yt - 0.35 * big, 0];
  const size = loop ? 1 : ramp(t, CHURN_WORK.drop - 0.01, CHURN_WORK.drop + 0.08);
  if (nearSide(add(patAt, [0, 0, 0.3]), mid, view) === front) pat(g, view, patAt, 0.32 * big, size);
}

/** The strike: cream thrown up out of its churns by the blow, and a puff of dust where its head comes down. */
function strikeSpray(g: CanvasRenderingContext2D, view: View, s: Churn, b: Bones, atHit: Bones, t: number, front: boolean): void {
  const hit = CHURN_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (since < 0) return;
  const big = bigness(s), mid = midOf(s, b), m = mouthOf(s, atHit), pu = unitPx(view) * big;
  const at: V3 = [m[0], m[1] + 0.1 * big, 0.1];
  s.shell.churns.forEach((u, i) => {
    for (let q = 0; q < 6; q++) {
      const a0 = (q / 6) * TAU + jitter(q + i) * 0.8, sp = (1 + jitter(q + 1)) * u.r[1] * 2.5;
      const from = place(atHit[`churn${i}`], [0, 0, u.h]);
      const p = thrown(from, [Math.cos(a0) * sp, Math.sin(a0) * sp + 0.8, 2.6 + 1.4 * jitter(q + 2)], since, 18);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      drop(g, x, y, 0.08 * pu * (1 - ramp(since, 0.3, 0.45)));
    }
  });
  if (front) {
    const [x, y] = onScreen(view, add(at, [0, 0, 0.3 + since * 1.5]));
    dust(g, x, y, (0.4 + 2.2 * since) * pu, 0.55 * (1 - ramp(since, 0.04, 0.25)));
  }
}

/** A sheen of slime on the ground under and behind its foot as it goes. */
function slime(g: CanvasRenderingContext2D, view: View, s: Churn, go: number): void {
  if (go <= 0.01) return;
  const G = geoOf(s), len = s.foot.tail * 0.6, pts: Array<[number, number]> = [];
  const half = (y: number): number => (y > G.yt ? footAt(s, G, y).w * 0.95 : footAt(s, G, G.yt).w * (1 - (G.yt - y) / len) + 0.02);
  const ys = Array.from({ length: 9 }, (_, q) => lerp(G.yt - len, G.yf - 0.2, q / 8));
  for (const y of ys) pts.push(onScreen(view, [half(y), y, 0.01]));
  for (const y of [...ys].reverse()) pts.push(onScreen(view, [-half(y), y, 0.01]));
  const [ax, ay] = onScreen(view, [0, G.yt - len, 0]), [bx, by] = onScreen(view, [0, G.yf, 0]);
  const grad = g.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, css([248, 240, 226], 0));
  grad.addColorStop(0.3, css([248, 240, 226], 0.45 * go));
  grad.addColorStop(1, css([252, 246, 236], 0.6 * go));
  g.fillStyle = grad;
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** How rosy each stage's body is gone: palest cream, peach, a warm blush. */
const ROSY = [0.26, 0.34, 0.4];
const PEACH: RGB = [244, 190, 160];

function churnKind(s: Churn): Kind {
  const bones = churnBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: CHURN_HITS[s.stage] } });
  const G = geoOf(s), st = s.stage, main = s.shell.drums[0];
  return {
    bones,
    build: (lod) => churnBuild(s, lod),
    // The variant's coat for its body, a soft cream warming to peach as it grows; its markings for its blush. Its churns, its
    // cream and the tips of its stalks are the same on every variant.
    palette: (coat, mark) => {
      const body = mix(coat, PEACH, ROSY[st]);
      const spot = mark;
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: mix(body, [200, 150, 130], 0.3),
        coatLight: mix(body, [255, 248, 232], 0.35),
        belly: mix(body, [255, 244, 224], 0.25),
        mark: spot,
        spot: mix(spot, [246, 196, 160], 0.55),
        inner: [244, 150, 150],
        tongue: [236, 120, 120],
        nose: [112, 66, 58],
        lid: [96, 60, 52],
        eye: [40, 28, 30],
        glint: [255, 253, 246],
        feather: mix(body, [255, 240, 222], 0.2),
        featherDark: mix(body, [236, 190, 160], 0.3),
        bill: [252, 238, 220],
        wood: [196, 128, 80],
        bark: [178, 112, 70],
        woodDark: [140, 86, 56],
        metal: [112, 84, 92],
        rivet: [168, 140, 140],
        lining: [252, 240, 208],
        horn: [214, 150, 98],
        cloth: [254, 244, 212],
        bloom: [248, 218, 112],
        leather: [176, 110, 64],
        leatherDark: [128, 78, 46],
        fitting: [238, 192, 74],
        flame: [206, 154, 54],
      }, 30);
    },
    shadow: [(G.ny[0] + s.neck.d[0] - G.yt) * 0.55, Math.max(s.foot.w * (st === 2 ? 1.3 : 1), main.X) * 1.08],
    stride: s.stride,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are cream and butter.
    motes: [[252, 244, 214], [248, 218, 112]],
    extra: (g, view, b, a, under) => {
      const front = !under, act = a.act;
      if (under) slime(g, view, s, a.go);
      if (!act) return;
      if (act.kind === 'strike') strikeSpray(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workSpray(g, view, s, b, a, act.t, front);
    },
  };
}

export const CREAMLET = churnKind(CREAMLET_LOOK);
export const CHURNSNAIL = churnKind(CHURNSNAIL_LOOK);
export const BUTTERWHORL = churnKind(BUTTERWHORL_LOOK);
