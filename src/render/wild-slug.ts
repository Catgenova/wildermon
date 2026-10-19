import {
  ACT_SECS, add, clamp, coatPalette, cross, cyc, darker, disc, dot, drift, eyes, frac, lerp, merge, mix, onEgg, orb, paint, scale, smile,
  smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The slug line: the Sluglow, a small cream snail with a spiral shell flecked
 * with embers; the Slugember, bigger, the cracks along its shell's bands
 * glowing and its sides hung with two egg sacs a side; and the Slugferno, a
 * great heavy snail under a huge pocked shell with a molten core showing
 * through its spiral. The species is still `embra` underneath, as saves and
 * the database know it.
 *
 * Each is a soft cream body: a flat foot with a frilled, scalloped skirt
 * along the ground, dotted along its back and flanks with peach, orange and
 * grey-brown; a tall upright front, round black eyes and a small smile; two
 * peach eye-stalks ending in glowing amber bulbs; amber honeycomb sacs bulging
 * from its shoulders, lit from inside; and the shell on its back, cream banded
 * with grey-brown, orange and amber, its cracks and pits glowing like embers.
 * All three are built by one set of functions from a description of the stage
 * (`Slug`), so a stage is its numbers.
 *
 * It glides. There are no legs: the sole stays on the ground and is carried
 * by waves going back along it, each patch of it set down and left where it
 * is until a wave lifts it a little and carries it forward (`slugPose`). It
 * stokes: it noses a piece of fuel forward, breathes on it until it catches,
 * and it flares.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Slug {
  stage: 0 | 1 | 2;
  /** The foot behind the front: how far back its tail tip is, its half-width at its widest and the height of its back. */
  foot: { tail: number; w: number; h: number };
  /** The upright front: where it stands on the ground (y), how tall to the top of the neck, its half-width and half-depth at the chest and at the top, and how far forward its top is. */
  neck: { y: number; tall: number; w: [number, number]; d: [number, number]; lean: number };
  head: { r: V3; eye: number };
  /** The eye-stalks: how long, how thick, the bulb's radius, how far each is splayed out and raked back (degrees). */
  tent: { len: number; w: number; bulb: number; splay: number; rake: number };
  /**
   * The shell: the middle of its coil along the back (y), its radius, how many turns, how wide it is across against its height, how
   * many glowing flecks, cracks and pits it has and how big the pits are, and how many of its inner turns are molten.
   */
  shell: { y: number; R: number; turns: number; xr: number; flecks: number; cracks: number; pits: number; pit: number; core: number };
  /** The sacs at each shoulder: how high up the front (a share of it), how far forward of its middle, and how big. */
  sacs: ReadonlyArray<readonly [number, number, number]>;
  /** How far the frill of its skirt spreads out past its foot, and how long each scallop of it is. */
  skirt: [number, number];
  /** How many clusters of spots on its back and flanks. */
  spots: number;
  /**
   * How it glides: how far a wave carries it at a walk and at a run (its own units a stride), how many waves along its foot at once,
   * how much of a stride a patch of sole is in a wave, how high the wave lifts the edge of its skirt at a walk and at a run, how far
   * its head bobs, its shell rocks fore and aft and sways side to side (degrees).
   */
  gait: { D: [number, number]; waves: number; q: number; hump: [number, number]; nod: number; rock: number; sway: number };
  size: number;
}

/** A Sluglow: small and round, a modest shell with a few glowing flecks, small sacs and short stalks. */
const SLUGLOW_LOOK: Slug = {
  stage: 0,
  foot: { tail: 2.0, w: 0.62, h: 0.46 },
  neck: { y: 0.6, tall: 1.7, w: [0.66, 0.44], d: [0.62, 0.4], lean: 0.14 },
  head: { r: [0.52, 0.5, 0.46], eye: 0.11 },
  tent: { len: 0.72, w: 0.11, bulb: 0.2, splay: 20, rake: 6 },
  shell: { y: -0.62, R: 1.0, turns: 2.6, xr: 1.1, flecks: 14, cracks: 0, pits: 0, pit: 0, core: 0 },
  sacs: [[0.5, 0.08, 0.4]],
  skirt: [0.2, 0.3],
  spots: 6,
  gait: { D: [0.36, 0.56], waves: 2, q: 0.45, hump: [0.09, 0.14], nod: 7, rock: 1.5, sway: 0 },
  size: 1.75,
};

/** A Slugember: bigger, a bigger shell with glowing cracks along its bands and pitted holes, two sacs a side and taller stalks. */
const SLUGEMBER_LOOK: Slug = {
  stage: 1,
  foot: { tail: 2.75, w: 0.85, h: 0.6 },
  neck: { y: 0.8, tall: 2.45, w: [0.76, 0.44], d: [0.74, 0.42], lean: 0.16 },
  head: { r: [0.56, 0.54, 0.5], eye: 0.115 },
  tent: { len: 1.28, w: 0.13, bulb: 0.26, splay: 18, rake: 6 },
  shell: { y: -0.8, R: 1.62, turns: 2.9, xr: 1.12, flecks: 10, cracks: 8, pits: 12, pit: 0.36, core: 0 },
  sacs: [[0.48, 0.1, 0.5], [0.36, -0.52, 0.34]],
  skirt: [0.28, 0.34],
  spots: 9,
  gait: { D: [0.46, 0.72], waves: 2, q: 0.44, hump: [0.1, 0.16], nod: 3.5, rock: 3, sway: 0 },
  size: 1.88,
};

/** A Slugferno: large and heavy, a huge deeply pocked shell with a molten core, very large sacs, the tallest stalks and a wide skirt. */
const SLUGFERNO_LOOK: Slug = {
  stage: 2,
  foot: { tail: 3.5, w: 1.12, h: 0.8 },
  neck: { y: 1.0, tall: 2.95, w: [0.98, 0.54], d: [0.94, 0.5], lean: 0.2 },
  head: { r: [0.66, 0.63, 0.58], eye: 0.125 },
  tent: { len: 1.62, w: 0.16, bulb: 0.32, splay: 17, rake: 6 },
  shell: { y: -1.0, R: 2.45, turns: 3.2, xr: 1.14, flecks: 4, cracks: 8, pits: 16, pit: 0.4, core: 1 },
  sacs: [[0.48, 0.12, 0.74], [0.34, -0.72, 0.5]],
  skirt: [0.42, 0.4],
  spots: 13,
  gait: { D: [0.56, 0.86], waves: 1, q: 0.5, hump: [0.12, 0.18], nod: 2.5, rock: 2, sway: 3 },
  size: 2.12,
};

/** A number of its own for each thing, nought to one, so a scatter is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/**
 * A value through a loop of a go, by keys of [where in the go, what], the first at nought: eased from each to the next, and from
 * the last back round to the first, so a go played over and over has no seam.
 */
function keyed(t: number, keys: ReadonlyArray<readonly [number, number]>): number {
  const u = frac(t);
  for (let i = 0; i < keys.length; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = i + 1 < keys.length ? keys[i + 1] : [keys[0][0] + 1, keys[0][1]];
    if (u >= t0 && u < t1) return lerp(v0, v1, smooth((u - t0) / (t1 - t0)));
  }
  return keys[0][1];
}

/* ---- the strike and the task, in time ---------------------------------------------------- */

/**
 * When each stage's blow lands, as a share of its strike: the Sluglow's head on what it butts, the Slugember's front on the ground,
 * the Slugferno's after its flame. The voice lands on these (`../audio/voice-slug`).
 */
export const SLUG_HITS: readonly number[] = [0.5, 0.46, 0.62];
/** When the Slugferno's flame comes out of it and when it stops, as shares of its strike. */
export const SLUG_FLAME: readonly [number, number] = [0.24, 0.39];
/**
 * A go at its task, as shares of the go: down at the fuel by `down`, nosing it forward until `push`, breathing on it from
 * `breathe` until it catches at `light`. The same for every stage, so the voice is where the pictures are.
 */
export const SLUG_WORK = { down: 0.38, push: 0.5, breathe: 0.51, light: 0.63 } as const;

/** How far through a go it is down at its fuel: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, SLUG_WORK.down) * (1 - ramp(t, 0.58, 1)));
/** How bright its stalks and sacs are with what it breathes, through a go: up as it breathes, brightest as the fuel catches. */
const kindleOf = (t: number): number => keyed(t, [[0, 0], [SLUG_WORK.breathe, 0.05], [SLUG_WORK.light, 1], [0.88, 0.35]]);

/* ---- its shape --------------------------------------------------------------------------- */

/**
 * The shell: a round globe of a shell coiled in the plane of the body's
 * length and height, each turn of it `SHELL_E` the size of the next one out.
 * It is built as what is seen of a coil: the rim of its outermost turn going
 * round the back of it, and on each flank the turns inside it, gently domed,
 * each going into the next at a groove; so it is round from every side and
 * the spiral is its seams and its bands. A point on it is `th` round the
 * spiral (the outermost turn's mouth at `th1`, low at the front), `lw` turns
 * in from its rim (nought on the rim, `turns` at the middle of the spiral) and
 * on its right flank or its left.
 */
interface Globe { R: number; th1: number; turns: number; X: number }
const SHELL_E = 0.6, SHELL_LW = -Math.log(SHELL_E);
const globeOf = (s: Slug): Globe => ({ R: s.shell.R, th1: -Math.PI * 0.22, turns: s.shell.turns, X: s.shell.R * s.shell.xr });
/** How far out from the middle of the spiral its outermost seam is at `th` (from a turn back from its mouth, `th1`, to it). */
const rimAt = (C: Globe, th: number): number => C.R * Math.exp((-SHELL_LW * (C.th1 - th)) / TAU);
/** How far out its outline is at `th`: a circle a little off the middle of the spiral, toward its mouth, so the whole is round. */
function edgeAt(C: Globe, th: number): number {
  const o = C.R * 0.16, r = C.R * 0.97, uc = o * Math.cos(th - C.th1);
  return uc + Math.sqrt(uc * uc - o * o + r * r);
}
/** How many turns in from the outermost seam its outline is at `th` (less than nought: outside it). */
const lwEdge = (C: Globe, th: number): number => Math.log(rimAt(C, th) / edgeAt(C, th)) / SHELL_LW;
/** A point on the shell, `th` in the turn back from its mouth; `lw` past `turns + 1` is the very middle of the spiral. */
function shellPoint(C: Globe, th: number, lw: number, side: number): V3 {
  const E = edgeAt(C, th), d = lw > C.turns + 1 ? 0 : Math.min(E, rimAt(C, th) * Math.exp(-SHELL_LW * lw)), t = d / E;
  // Round as an egg across: fullest at the middle of the spiral, curving over to nothing at its outline; a soft groove at each seam.
  const rim = Math.sqrt(Math.max(0, 1 - t ** 2.2));
  const f = frac(lw), near = Math.min(f, 1 - f);
  const groove = lw > 0.4 && lw <= C.turns ? 0.07 * Math.exp(-((near / 0.16) ** 2)) * Math.min(1, d / (C.R * 0.3)) : 0;
  return [side * C.X * Math.max(0, (1 - 0.06 * t * t - groove) * rim), d * Math.cos(th), d * Math.sin(th)];
}
/** A point on the shell where its angle is taken round into the turn it is on, for things laid on it anywhere. */
function shellAt(C: Globe, th: number, lw: number, side: number): V3 {
  let a = th, l = lw;
  while (a > C.th1) { a -= TAU; l -= 1; }
  while (a <= C.th1 - TAU) { a += TAU; l += 1; }
  return shellPoint(C, a, Math.max(lwEdge(C, a), l), side);
}

/** Where everything is on a stage, worked out once from its numbers. */
interface Geo {
  /** The foot from its tail tip to its front, which is inside the chest. */
  yt: number; yf: number;
  /** The front's rings, ground up: how high, where along, how wide and how deep. */
  nz: number[]; ny: number[]; nw: number[]; nd: number[];
  /** How much of a bend each joint between the front's rings takes, from its bottom. */
  bend: number[];
  /** The ring the sacs hang from. */
  chest: number;
  /** The head's middle over the top ring. */
  headUp: number;
  coil: Globe;
  /** How high the middle of the spiral is over the ground. */
  shellZ: number;
}
/** Each ring of the front, as a share of its height. */
const NECK_F = [0, 0.05, 0.16, 0.3, 0.45, 0.6, 0.74, 0.87, 1];
/** How much of a bend each joint takes, from the bottom: none in the two at the ground, so the chest stays where it is. */
const NECK_BEND = [0, 0, 0.03, 0.09, 0.15, 0.19, 0.2, 0.18, 0.16];

const geos = new Map<Slug, Geo>();
function geoOf(s: Slug): Geo {
  const had = geos.get(s);
  if (had) return had;
  const N = s.neck;
  const nz: number[] = [], ny: number[] = [], nw: number[] = [], nd: number[] = [];
  NECK_F.forEach((f, k) => {
    const chest = 1 + 0.1 * Math.sin(Math.PI * clamp(f / 0.55));
    nz.push(N.tall * f);
    ny.push(N.y + N.lean * f + 0.14 * N.d[0] * Math.sin(Math.PI * clamp(f / 0.7)));
    nw.push(lerp(N.w[0], N.w[1], smooth(f * 1.1)) * chest * (k === 0 ? 0.97 : 1));
    nd.push(lerp(N.d[0], N.d[1], smooth(f * 1.1)) * chest * (k === 0 ? 0.97 : 1));
  });
  const coil = globeOf(s);
  let zmin = Infinity;
  for (let i = 0; i <= 60; i++) { const th = lerp(coil.th1 - TAU, coil.th1, i / 60); zmin = Math.min(zmin, shellPoint(coil, th, lwEdge(coil, th), 1)[2]); }
  const yt = -s.foot.tail, yf = N.y - N.d[0] * 0.45;
  const g: Geo = { yt, yf, nz, ny, nw, nd, bend: NECK_BEND, chest: 0, headUp: s.head.r[2] * 0.5, coil, shellZ: 0 };
  g.shellZ = footAt(s, g, s.shell.y).h * 0.9 - zmin;
  let best = Infinity;
  nz.forEach((z, k) => { const d = Math.abs(z - s.sacs[0][0] * N.tall); if (d < best) { best = d; g.chest = k; } });
  geos.set(s, g);
  return g;
}

/** The foot's half-width and the height of its back at `y` along it: drawn to a point at its tail, rising to the front. */
function footAt(s: Slug, G: { yt: number; yf: number }, y: number): { w: number; h: number } {
  const F = s.foot, f = clamp((y - G.yt) / (G.yf - G.yt)), tail = smooth(f / 0.42);
  return { w: F.w * (0.16 + 0.84 * Math.sqrt(tail)), h: F.h * (0.24 + 0.76 * tail) * (1 + 0.2 * smooth((f - 0.55) / 0.45)) };
}
/** A point on the foot's back, `y` along it and `ph` round it from its right edge on the ground (nought) over its top to its left (pi). */
function footPoint(s: Slug, G: Geo, y: number, ph: number): V3 {
  const { w, h } = footAt(s, G, y), p = clamp(ph, 0, Math.PI);
  return [w * Math.cos(p), y, h * Math.sin(p) ** 0.7];
}

/** The front's ring at a height: where along, how wide and how deep, between the rings. */
function neckAt(G: Geo, z: number): { y: number; w: number; d: number; k: number; f: number } {
  let k = 0;
  while (k < G.nz.length - 2 && G.nz[k + 1] < z) k++;
  const f = clamp((z - G.nz[k]) / (G.nz[k + 1] - G.nz[k]));
  return { y: lerp(G.ny[k], G.ny[k + 1], f), w: lerp(G.nw[k], G.nw[k + 1], f), d: lerp(G.nd[k], G.nd[k + 1], f), k, f };
}
const neckPoint = (G: Geo, z: number, ph: number): V3 => { const R = neckAt(G, z); return [R.w * Math.cos(ph), R.y + R.d * Math.sin(ph), z]; };

/**
 * A disc laid on a curved surface, `S(a, b)`, round `(a0, b0)`, `rad` across in its own units and `aspect` as tall as it is wide:
 * each of its corners on the surface itself, a hair out along it, so a spot follows the curve of a back rather than standing off
 * it as a flat card. Wound to face out (`out` gives a point inside).
 */
function patch(S: (a: number, b: number) => V3, inside: (a: number, b: number) => V3, a0: number, b0: number, rad: number, sides: number, m: Mat,
  o: { aspect?: number; spin?: number; lift?: number; lit?: boolean } = {}): Disc {
  const e = 1e-3, p0 = S(a0, b0);
  const sa = Math.hypot(...sub(S(a0 + e, b0), p0)) / e || 1, sb = Math.hypot(...sub(S(a0, b0 + e), p0)) / e || 1;
  const normal = (a: number, b: number): V3 => {
    const p = S(a, b), n = unit(cross(sub(S(a + e, b), p), sub(S(a, b + e), p)));
    return dot(n, sub(p, inside(a, b))) < 0 ? scale(n, -1) : n;
  };
  const v: V3[] = [];
  for (let q = 0; q < sides; q++) {
    const t = ((q + 0.5) / sides) * TAU + (o.spin ?? 0);
    const a = a0 + (rad * Math.cos(t)) / sa, b = b0 + (rad * (o.aspect ?? 1) * Math.sin(t)) / sb;
    v.push(add(S(a, b), scale(normal(a, b), o.lift ?? 0.018)));
  }
  // Wound so it faces out of the surface.
  const n0 = normal(a0, b0);
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const p = v[q], r = v[(q + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  if (nx * n0[0] + ny * n0[1] + nz * n0[2] < 0) v.reverse();
  return { v, m, lit: o.lit };
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

/* ---- how it moves ------------------------------------------------------------------------- */

/**
 * A patch of sole through a stride, by where in the stride it is (`x`): set down and still while it is not in a wave, and carried
 * forward smoothly by it while it is, for `q` of the stride. What is returned is how far it is ahead of where it would be going at
 * the body's even pace, over a stride's travel, about nought; so a patch on the ground goes back under the body exactly as fast as
 * the body goes forward over it.
 */
function surge(x: number, q: number): number {
  // Lifted a little before it moves and set down a little after it stops, so it never moves while it is on the ground.
  const p = frac(x);
  return (p < q ? smooth((p / q - 0.1) / 0.8) : 1) - p - (0.5 - q / 2);
}
/** How far a wave has the edge of its skirt up, nought to one: a soft swell while a patch is carried, flat while it is down. */
function swell(x: number, q: number): number {
  const p = frac(x);
  return p < q ? Math.sin((Math.PI * p) / q) ** 2 : 0;
}

/** Everything a stage's pose says this moment: where its sole is, its front ring by ring, its head, stalks, sacs and shell, and how brightly it glows. */
interface SlugPose {
  /** How far a patch of sole `y` along it is ahead of its place at rest, and how high the wave has its skirt there. */
  dy: (y: number) => number;
  /** How far through the swell of a wave a patch of sole is, nought to one. */
  wave: (y: number) => number;
  lift: (y: number) => number;
  /** The front's rings, ground up, and how much each is drawn in across as the front stretches. */
  rings: Xf[];
  across: number[];
  head: Xf; chest: Xf; shell: Xf; tent: [Xf, Xf];
  /** How bright: the shell, the sacs and the bulbs; and how far through a flare of the shell it is. */
  glow: { shell: number; sac: number; bulb: number; flare: number };
}

/** What a stage does this moment, as numbers over its rest. */
interface Moves {
  /** The front bent back (positive) or bowed forward, degrees; stretched up (positive) or squashed; swayed to its right. */
  bend: number; stretch: number; sway: number;
  /** The head's own nod (nose up positive) and turn. */
  nod: number; turn: number;
  /** Each stalk: pitched back, splayed out (degrees), left then right. */
  tent: [[number, number], [number, number]];
  shellPitch: number; shellRoll: number; shellLift: number;
  /** How far the front above the ground is thrust forward, its foot staying where it is. */
  lunge: number;
  /** How much the stalks are held upright against the head's bow (one: not bowed at all). */
  upright: number;
  glow: { shell: number; sac: number; bulb: number; flare: number };
}

/** Its strike, by stage: how far it rears, how far it comes down, and its head's nod with it. */
function strikeMoves(s: Slug, m: Moves, t: number): void {
  const hit = SLUG_HITS[s.stage];
  // Back up from the blow by the end, eased all the way so it never snaps up.
  // Partly at an even pace and partly eased, so it never comes back faster than a little over its average.
  const u = clamp((t - hit - 0.04) / (0.99 - hit - 0.04)), back = 0.4 * u + 0.6 * smooth(u), keep = 1 - back;
  // The blow itself: from the top of the wind-up to the hit, quickening all the way.
  const blow = (from: number): number => clamp((t - from) / (hit - from)) ** 1.7;
  if (s.stage === 0) {
    // The headbutt: the head drawn back, then popped forward into what it butts, and eased back up.
    const rear = ramp(t, 0.04, hit - 0.12), pop = blow(hit - 0.12);
    m.bend += (28 * rear - 62 * pop) * keep;
    m.stretch += (-0.08 * rear + 0.32 * pop) * keep;
    m.nod += (12 * rear - 18 * pop) * keep;
    m.lunge += (-0.06 * rear + 0.25 * pop) * keep;
    m.upright = lerp(0.45, 0.65, back);
    m.glow.bulb += 0.4 * hump(t, hit, 0.15);
    m.glow.flare = Math.max(m.glow.flare, 0.4 * hump(t, hit, 0.15));
    return;
  }
  if (s.stage === 1) {
    // Up tall, leaning back, then slammed down forward; the chest squashes as it lands.
    const rear = ramp(t, 0.04, hit - 0.13), slam = blow(hit - 0.13);
    m.bend += (10 * rear - 76 * slam) * keep;
    m.stretch += (0.2 * rear - 0.3 * slam) * keep;
    m.lunge += 0.12 * slam * keep;
    m.upright = lerp(0.45, 0.65, back);
    m.glow.flare = Math.max(m.glow.flare, 0.55 * hump(t, hit, 0.14));
    m.nod += (10 * rear - 12 * slam) * keep;
    m.glow.shell += 0.6 * hump(t, hit + 0.04, 0.22);
    m.glow.sac += 0.5 * hump(t, hit, 0.2);
    m.shellPitch += -4 * slam * keep;
    return;
  }
  // Up and back, the shell flaring bright; the head brought forward to throw its flame; then down onto the ground.
  const [f0, f1] = SLUG_FLAME;
  const rear = ramp(t, 0.02, f0 + 0.02), aim = ramp(t, 0.1, f0 + 0.08);
  void f1;
  const slam = blow(hit - 0.12);
  m.upright = lerp(0.5, 0.65, back);
  m.bend += (10 * rear - 8 * aim - 31 * slam) * keep;
  m.stretch += (0.16 * rear - 0.04 * aim - 0.34 * slam) * keep;
  m.nod += (8 * rear - 12 * aim - 6 * slam) * keep;
  const flare = ramp(t, 0.1, f0) * (1 - ramp(t, hit + 0.05, 0.96));
  m.glow.flare = Math.max(m.glow.flare, flare);
  m.glow.shell += 1.3 * flare;
  m.glow.sac += 0.6 * flare;
  m.glow.bulb += 0.5 * flare;
  m.shellPitch += -3 * slam * keep;
}

/** How far each stage bows its front, draws it down and nods its head to put its chin on the fuel, at the bottom of a go. */
const WORK_BOW = [-64, -68, -70], WORK_LOW = [-0.5, -0.56, -0.58], WORK_NOD = [-24, -26, -28];

/** A go at its task: down to the fuel, nosing it forward, holding over it breathing, a start back as it catches. */
function workMoves(s: Slug, m: Moves, t: number, graze: number): void {
  const d = downOf(t, graze), W = SLUG_WORK, st = s.stage;
  // Bowed forward and drawn down so its chin is at the fuel on the ground before its chest; nosing forward, then held over it.
  const nose = keyed(t, [[0, 0], [W.down - 0.06, 0], [W.push, 1], [W.light - 0.01, 0.55], [W.light + 0.15, -0.25], [0.97, 0]]);
  m.bend += d * (WORK_BOW[st] - 30 * nose);
  m.stretch += d * (WORK_LOW[st] + 0.1 * nose);
  // Its face turned up to the fuel as it breathes on it, rather than into the ground.
  const look = ramp(t, W.breathe - 0.04, W.breathe + 0.06) * (1 - ramp(t, W.light, W.light + 0.14));
  m.nod += d * (WORK_NOD[st] + 4 * nose + 12 * look);
  // Leaning over the fuel while it is down at it; held upright again as it rises from a go played once.
  m.upright = graze >= 0.5 ? 0.5 : 0.85;
  m.turn *= 1 - d;
  const kindle = d * kindleOf(t);
  m.glow.bulb += 1.1 * kindle;
  m.glow.sac += 0.9 * kindle;
  m.glow.shell += 0.9 * kindle;
  m.glow.flare = Math.max(m.glow.flare, (st ? 0.85 : 0.5) * d * hump(frac(t - W.light + 0.5), 0.5, st ? 0.18 : 0.12));
}

/** Evolving: drawn up tall to the light, its stalks spread, glowing ever brighter to the flash, and settling. */
function evolveMoves(m: Moves, t: number): void {
  const up = ramp(t, 0.08, 0.45) * (1 - ramp(t, 0.6, 0.92));
  m.stretch += 0.14 * up;
  m.bend += 6 * up;
  m.nod += 14 * up;
  m.tent[0][1] += 10 * up;
  m.tent[1][1] += 10 * up;
  const k = 1.6 * ramp(t, 0.04, 0.5) * (1 - ramp(t, 0.58, 0.96)) + 1.2 * hump(t, 0.5, 0.06);
  m.glow.shell += k;
  m.glow.sac += 0.7 * k;
  m.glow.bulb += 0.7 * k;
  m.glow.flare = Math.max(m.glow.flare, hump(t, 0.5, 0.08));
}

/**
 * The pose of a stage: the sole carried by its waves, the front over it, and what it does.
 *
 * A wave starts at the front and goes back along the foot (`waves` of them along it at once): the front goes forward first,
 * stretching the foot, and the rear follows. Each patch of sole is down and still on the ground for most of a stride and carried
 * forward in the swell of a wave for `q` of it; so whatever is down goes back under the body exactly as fast as the body goes over
 * it, and nothing slides. Everything in front of the middle of the chest goes with the front.
 */
function slugPose(s: Slug, a: Anim): SlugPose {
  const G = geoOf(s), g = smooth(a.go), gait = clamp(a.gait), t = a.t, Ga = s.gait;
  // At a run each patch of sole is in its wave for longer, so the front is carried further without being flung.
  const D = lerp(Ga.D[0], Ga.D[1], gait), H = lerp(Ga.hump[0], Ga.hump[1], gait), q = lerp(Ga.q, 0.75, gait);
  const front = G.ny[0], c = (front - G.yt) / Ga.waves;
  const phase = (y: number): number => a.u + (Math.min(y, front) - front) / c;
  const dy = (y: number): number => (g ? g * D * surge(phase(y), q) : 0);
  const lift = (y: number): number => (g ? g * H * swell(phase(y), q) : 0);
  const m: Moves = {
    bend: 2 * cyc(t, 3), stretch: 0.012 * cyc(t, 2, 1.1), sway: 1.5 * cyc(t, 2, 0.4), nod: 3 * cyc(t, 4, 0.6), turn: 12 * drift(t),
    tent: [[3 * cyc(t, 3, 0.3) + 2 * cyc(t, 5, 1.9), 4 * cyc(t, 2, 0.8)], [3 * cyc(t, 3, 2.1) + 2 * cyc(t, 5, 0.2), 4 * cyc(t, 2, 2.9)]],
    shellPitch: 0, shellRoll: 0, shellLift: 0, lunge: 0, upright: 0.75,
    // Its glow breathing slowly, a turn every six seconds.
    glow: { shell: 1 + 0.12 * cyc(t, 4), sac: 1 + 0.1 * cyc(t, 4, 1.2), bulb: 1 + 0.12 * cyc(t, 4, 2.2), flare: 0 },
  };
  if (g > 0) {
    // Going: the head looks where it goes; the front leans into it and bobs with each surge of the front, the shell rocks fore and aft
    // as the wave goes under it, and the Slugferno's sways from side to side.
    const w = TAU * phase(front);
    m.turn *= 1 - g;
    m.bend += g * (-3 - 9 * gait + Ga.nod * 0.15 * Math.sin(w - 1.2));
    m.nod += g * Ga.nod * (1 - 0.45 * gait) * Math.sin(w - 0.6);
    m.stretch += g * Ga.nod * 0.006 * Math.sin(w - 0.3);
    m.sway *= 1 - g;
    const ws = TAU * phase(s.shell.y);
    m.shellPitch += g * Ga.rock * (1 - 0.45 * gait) * Math.sin(ws - 0.8);
    m.shellRoll += g * Ga.sway * (1 - 0.4 * gait) * Math.sin(TAU * a.u - 0.5);
    m.shellLift += lift(s.shell.y) * 0.8;
    for (const k of [0, 1] as const) {
      m.tent[k][0] += g * (4 + 10 * gait + (3 + 2 * gait) * Math.sin(w - 1.8 - k * 0.4));
      m.tent[k][1] += g * 1.5 * Math.sin(w - 2 + k);
    }
  }
  const act = a.act;
  const bend0 = m.bend, nod0 = m.nod;
  if (act?.kind === 'strike') strikeMoves(s, m, act.t);
  else if (act?.kind === 'work') workMoves(s, m, act.t, a.graze);
  else if (act?.kind === 'evolve') evolveMoves(m, act.t);
  // The stalks held nearer upright than the head they are on as it bows and rears, so their bulbs trail rather than whip.
  const tilt = 0.55 * (m.bend - bend0) + (m.nod - nod0);
  for (const k of [0, 1] as const) m.tent[k][0] -= m.upright * tilt;
  // The front, ring by ring from the ground: the two at the ground where they are, the rest bent and stretched by their shares.
  const rings: Xf[] = [], across: number[] = [];
  // Its foot at the ground goes with the sole; the front over it takes only a little of the surge, so it glides on at an even pace.
  const dn = dy(front);
  const off = (k: number): number => dn * lerp(1, 0.15, smooth(k / 3)) + m.lunge * clamp((k - 1) / 3);
  for (let k = 0; k < G.nz.length; k++) {
    if (k === 0) rings.push({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, G.ny[0] + off(0), G.nz[0]] });
    else {
      const st = m.stretch * clamp((k - 1) / 4);
      rings.push(joint(rings[k - 1], [0, G.ny[k] - G.ny[k - 1] + off(k) - off(k - 1), (G.nz[k] - G.nz[k - 1]) * (1 + st)], m.bend * G.bend[k], m.sway * G.bend[k], 0));
    }
    // Drawn in as it stretches, let out as it squashes, so it keeps its bulk.
    across.push(k >= 2 ? 1 - 0.4 * m.stretch * Math.min(1, (k - 1) / 3) : 1);
  }
  const top = rings[rings.length - 1];
  // The head kept nearer level than the front under it, and its own nod and look on that.
  const head = joint(top, [0, 0.04, G.headUp], -m.bend * 0.45 + m.nod, 0, m.turn);
  const R = s.head.r, T = s.tent;
  const tent = [-1, 1].map((sd, k) => {
    const root = onEgg([0, 0, 0], R, [sd * 0.42, -0.16, 0.9]).p;
    // One raked a little forward of the other, so seen side on the two bulbs stand apart.
    return joint(head, [root[0] * 0.92, root[1], root[2] * 0.92], T.rake + 7 * sd + m.tent[k][0], sd * (T.splay + m.tent[k][1]), 0);
  }) as [Xf, Xf];
  // The shell rides the back, which goes at the body's pace; the wave under it only nudges it.
  const shell = joint(ROOT, [0, s.shell.y + 0.12 * dy(s.shell.y), G.shellZ + m.shellLift], m.shellPitch, m.shellRoll, 0);
  const wave = (y: number): number => (g ? g * swell(phase(y), q) : 0);
  return { dy, lift, wave, rings, across, head, chest: rings[G.chest], shell, tent, glow: m.glow };
}

/** The last pose worked out, for the pieces that bend within themselves, which are asked for it once each after the bones. */
let lastPose: { s: Slug; key: string; p: SlugPose } | null = null;
function poseFor(s: Slug, a: Anim): SlugPose {
  const key = `${a.t}|${a.u}|${a.go}|${a.gait}|${a.graze}|${a.act?.kind ?? ''}|${a.act?.t ?? ''}`;
  if (lastPose && lastPose.s === s && lastPose.key === key) return lastPose.p;
  const p = slugPose(s, a);
  lastPose = { s, key, p };
  return p;
}

/** The bones of a stage: its head, stalks, chest, shell, the front's rings, and four points on the edge of its skirt where it meets the ground. */
function slugBones(s: Slug): (a: Anim) => Bones {
  const G = geoOf(s);
  return (a) => {
    const p = poseFor(s, a);
    const b: Bones = { body: ROOT, trunk: ROOT, head: p.head, chest: p.chest, shell: p.shell, tent0: p.tent[0], tent1: p.tent[1] };
    p.rings.forEach((x, k) => { b[`ring${k}`] = x; });
    b.neck = p.rings[1];
    b.shadow = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, (G.yt + G.ny[0] + s.neck.d[0]) / 2, 0] };
    // Where the skirt's edge meets the ground at its front and back on either side: down and still while no wave is under them.
    for (const [key, sd, y] of [['fl2', -1, G.ny[0] - s.neck.d[0] * 0.3], ['fr2', 1, G.ny[0] - s.neck.d[0] * 0.3], ['hl2', -1, G.yt + 0.6 * s.foot.w], ['hr2', 1, G.yt + 0.6 * s.foot.w]] as Array<[string, number, number]>) {
      const w = footAt(s, G, y).w + s.skirt[0] * 0.8;
      // Off the ground the whole time a wave has it, however little: so a stride is measured off only what is down.
      const up = p.lift(y);
      b[key] = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [sd * w, y + p.dy(y), up > 1e-4 ? 0.25 : 0] };
    }
    return b;
  };
}

/* ---- its pieces --------------------------------------------------------------------------- */

/** How many of each kind of spot, by its colour: peach, orange and grey-brown. */
const SPOT_MATS: readonly Mat[] = ['mark', 'spot', 'stone'];

/**
 * The foot: a long low dome along the ground, flat under, drawn to a point at its tail and rising into the chest at its front;
 * dotted along its back and flanks with clusters of spots. In the body's frame; a wave going back along it lifts its back a
 * little where it passes.
 */
function footMesh(s: Slug, G: Geo, K: number, n: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const y = lerp(G.yt, G.yf, (k / K) ** 0.9);
    for (let j = 0; j < n; j++) v.push(footPoint(s, G, y, (Math.PI * j) / (n - 1)));
  }
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, idx = [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j];
      const c = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25);
      // The flat underside closes each ring; its front end, inside the chest, is left open.
      f.push({ i: idx, m: 'coat', soft: k === K - 1 || undefined });
      want.push(j === n - 1 ? [0, 0, -1] : unit([c[0], 0, c[2] + 0.2]));
    }
  }
  // Its tail tip closed.
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: 'coat' });
  want.push([0, -1, 0]);
  const body = mesh(v, wound(v, f, want));
  // The spots, in clusters: a big one with smaller ones round it, of the three colours, along the back and down the flanks, most
  // of them behind the chest and round the shell where they show.
  const S = (y: number, ph: number): V3 => footPoint(s, G, y, ph);
  const inside = (y: number): V3 => [0, y, footAt(s, G, y).h * 0.2];
  const spots: Disc[] = [];
  const big = s.foot.w * 0.34;
  for (let q = 0; q < s.spots; q++) {
    const side = q % 2 ? 1 : -1;
    const y0 = lerp(G.yt + 0.25 * s.foot.tail * 0.3, G.yf - s.neck.d[0] * 0.2, (q + 0.5) / s.spots + 0.06 * (jitter(q) - 0.5));
    // From the edge of the back down onto the flank, never at the ground or across the very top.
    const ph0 = Math.PI / 2 + side * (0.45 + 0.6 * jitter(q + 3));
    const cluster = 1 + Math.floor(jitter(q + 7) * 3);
    for (let e = 0; e <= cluster; e++) {
      const r = (e ? 0.42 + 0.25 * jitter(q * 7 + e) : 1) * big * (0.85 + 0.3 * jitter(q + 11));
      const a = e * 2.3 + q, off = e ? big * 1.25 : 0;
      const y = y0 + off * Math.cos(a), ph = clamp(ph0 + (off * Math.sin(a)) / Math.max(0.2, s.foot.h), 0.35, Math.PI - 0.35);
      if (y < G.yt + 0.12 || y > G.yf - 0.05) continue;
      spots.push(patch(S, inside, y, ph, r, 9, SPOT_MATS[(q + e) % 3], { aspect: 1, spin: jitter(q + e) }));
    }
  }
  return merge(body, paint(spots));
}

/**
 * The ripple on the foot's flank: a run of short darker bands low down each side, each painted on only while a wave is under it,
 * so the wave is seen going back along the foot as a moving line. Each band's corners and its middle, for drawing it in and out.
 */
function rippleBand(s: Slug, G: Geo): { mesh: Mesh; mid: V3[] } {
  const S = (y: number, ph: number): V3 => footPoint(s, G, y, ph);
  const inside = (y: number): V3 => [0, y, footAt(s, G, y).h * 0.2];
  const bands: Disc[] = [], mid: V3[] = [];
  const len = 0.16 * s.foot.w, y0 = G.yt + s.foot.tail * 0.12, y1 = G.yf - s.neck.d[0] * 0.15;
  const count = Math.max(6, Math.round((y1 - y0) / len));
  for (let q = 0; q < count; q++) {
    const yc = lerp(y0, y1, (q + 0.5) / count);
    for (const ph of [0.5, Math.PI - 0.5]) {
      const d = patch(S, inside, yc, ph, ((y1 - y0) / count) * 0.62, 6, 'coatDark', { aspect: 0.75 / Math.max(0.3, s.foot.h), lift: 0.02 });
      bands.push(d);
      for (const _ of d.v) mid.push(S(yc, ph));
    }
  }
  return { mesh: paint(bands), mid };
}

/**
 * The skirt: a thin frill round the whole of the sole, foot and chest, spreading out over the ground past it in a run of scallops,
 * its rim dropping to the ground, with a few spots on it. Built round the outline of the sole from the tail tip up the right side,
 * round the front of the chest and back down the left.
 */
function skirtMesh(s: Slug, G: Geo, lobeLen: number): { mesh: Mesh; out: number[] } {
  const [spread] = s.skirt;
  // The outline: the wider of the foot and the chest's foot at each place along, rounded off at the tail and the front.
  const yMin = G.yt - footAt(s, G, G.yt).w * 0.7, yMax = G.ny[0] + G.nd[0];
  const half = (y: number): number => {
    let x = 0;
    if (y >= G.yt && y <= G.yf) x = footAt(s, G, y).w;
    else if (y < G.yt) { const r = footAt(s, G, G.yt).w; x = r * Math.sqrt(Math.max(0, 1 - ((G.yt - y) / (r * 0.7)) ** 2)); }
    const e = (y - G.ny[0]) / G.nd[0];
    if (Math.abs(e) <= 1) x = Math.max(x, G.nw[0] * Math.sqrt(1 - e * e));
    return x;
  };
  const dense: Array<[number, number]> = [];
  const steps = 400;
  for (let q = 0; q <= steps; q++) { const y = lerp(yMin, yMax, q / steps); dense.push([half(y), y]); }
  for (let q = steps; q >= 0; q--) { const y = lerp(yMin, yMax, q / steps); dense.push([-half(y), y]); }
  // Even along its length.
  const len: number[] = [0];
  for (let q = 1; q < dense.length; q++) len.push(len[q - 1] + Math.hypot(dense[q][0] - dense[q - 1][0], dense[q][1] - dense[q - 1][1]));
  const total = len[len.length - 1], lobes = Math.max(8, Math.round(total / lobeLen)), M = lobes * 4;
  const at = (d: number): [number, number] => {
    let q = 1;
    while (q < len.length - 1 && len[q] < d) q++;
    const f = (d - len[q - 1]) / Math.max(1e-6, len[q] - len[q - 1]);
    return [lerp(dense[q - 1][0], dense[q][0], f), lerp(dense[q - 1][1], dense[q][1], f)];
  };
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], out: number[] = [];
  const pts = Array.from({ length: M }, (_, i) => at((i / M) * total));
  const rise = 0.08 * (0.6 + 0.4 * s.stage);
  for (let i = 0; i < M; i++) {
    const [x, y] = pts[i], [x0, y0] = pts[(i + M - 1) % M], [x1, y1] = pts[(i + 1) % M];
    const tx = x1 - x0, ty = y1 - y0, tl = Math.hypot(tx, ty) || 1;
    // Out of the outline, square to it: the outline goes up the right and back down the left, so out is to its right.
    const nx = ty / tl, ny = -tx / tl;
    const lobe = Math.abs(Math.sin((Math.PI * i) / 4));
    const o = spread * (0.5 + 0.5 * Math.sqrt(lobe));
    // In under the body, out over the ground at the frill's top, and its rim down on the ground.
    v.push([x - nx * 0.12, y - ny * 0.12, rise * 1.5], [x + nx * o, y + ny * o, rise * (0.4 + 0.2 * lobe)], [x + nx * o * 1.04, y + ny * o * 1.04, 0.004]);
    out.push(0, o / spread, o / spread);
  }
  for (let i = 0; i < M; i++) {
    const a = i * 3, b = ((i + 1) % M) * 3;
    f.push({ i: [a, b, b + 1, a + 1], m: 'belly', soft: true });
    want.push([0, 0, 1]);
    const [x, y] = pts[i];
    f.push({ i: [a + 1, b + 1, b + 2, a + 2], m: 'coat' });
    want.push(unit([x, y - (G.yt + G.ny[0]) / 2, 0.3]));
  }
  // A few spots on the frill, out toward its edge, where the foot's run on to it.
  const spots: Disc[] = [];
  for (let q = 0; q < 6 + 3 * s.stage; q++) {
    const i = Math.floor(jitter(q + 40) * M), [x, y] = pts[i], [x1, y1] = pts[(i + 1) % M];
    const tl = Math.hypot(x1 - x, y1 - y) || 1, nx = (y1 - y) / tl, ny = -(x1 - x) / tl;
    if (y > G.ny[0] - G.nd[0] * 0.2) continue;
    const c: V3 = [x + nx * spread * 0.35, y + ny * spread * 0.35, rise * 1.05 + 0.012];
    const r = spread * (0.2 + 0.12 * jitter(q + 41));
    const vs: V3[] = Array.from({ length: 8 }, (_, e) => { const th = (e / 8) * TAU; return [c[0] + Math.cos(th) * r, c[1] + Math.sin(th) * r * 1.2, c[2]]; });
    spots.push({ v: vs, m: SPOT_MATS[q % 3] });
  }
  const sk = mesh(v, wound(v, f, want));
  return { mesh: merge(sk, paint(spots)), out: [...out, ...spots.flatMap((d) => d.v.map(() => 0.3))] };
}

/**
 * The front: a tall soft column from the ground up to the head, a broad chest low on it, its front paler, a few spots on its back.
 * In horizontal rings, ground up, each bent and stretched with the front (`SlugPose.rings`).
 */
function neckMesh(s: Slug, G: Geo, n: number): Mesh {
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
  // Spots up the back of the neck and its shoulders, bigger low down.
  const S = (z: number, ph: number): V3 => neckPoint(G, z, ph);
  const inside = (z: number): V3 => [0, neckAt(G, z).y, z];
  const spots: Disc[] = [];
  const count = 4 + 2 * s.stage;
  for (let q = 0; q < count; q++) {
    const z = s.neck.tall * (0.28 + 0.55 * ((q + 0.5) / count)), side = q % 2 ? 1 : -1;
    const ph = -Math.PI / 2 + side * (0.35 + 0.5 * jitter(q + 21));
    const r = neckAt(G, z).w * (0.2 - 0.06 * (z / s.neck.tall)) * (0.8 + 0.4 * jitter(q + 22));
    spots.push(patch(S, inside, z, ph, r, 8, SPOT_MATS[q % 3]));
  }
  return merge(body, paint(spots));
}

/** The head: a round egg, small round black eyes with a glint high in each, and a tiny smile. In its own frame. */
function headMesh(s: Slug, n: number, k: number, shut: boolean): Mesh {
  const R = s.head.r, c: V3 = [0, 0, 0];
  const look = eyes(c, R, [0.5, 0.82, 0.12], s.head.eye, { tall: 1.1, shut, glint: 0.42, at: true });
  const m = onEgg(c, R, [0, 1, -0.32]);
  return merge(orb(c, R, n + 2, k + 1, 'coat'), smile(m.p, m.n, R[0] * 0.26, 'nose'), look);
}

/** An eye-stalk: a soft peach tube, tapering a little and curving forward, and the glowing amber bulb at its end. In its own frame, up along z. */
function tentMesh(s: Slug, n: number): Mesh {
  const T = s.tent, L = T.len;
  const pts: V3[] = [[0, 0, -0.06], [0, 0.02 * L, 0.35 * L], [0, 0.05 * L, 0.7 * L], [0, 0.08 * L, L]];
  const stalk = tube(pts, [T.w * 1.25, T.w * 1.05, T.w * 0.92, T.w * 0.86], [T.w * 1.25, T.w * 1.05, T.w * 0.92, T.w * 0.86], Math.max(6, n - 2), (ring) => (ring >= 2 ? 'featherDark' : 'feather'), { seam: 'start' });
  const tip: V3 = [0, 0.09 * L, L + T.bulb * 0.55];
  // A peach-amber bulb, its glowing yellow heart showing on its front.
  const bulb = orb(tip, [T.bulb, T.bulb, T.bulb * 1.12], n, 5, 'bill');
  const glint = paint([disc(add(tip, [0, T.bulb * 0.8, T.bulb * 0.12]), [0, 1, 0.25], T.bulb * 0.48, T.bulb * 0.5, 8, 'bloom', { lit: true }), disc(add(tip, [0, -T.bulb * 0.8, T.bulb * 0.12]), [0, -1, 0.25], T.bulb * 0.42, T.bulb * 0.44, 8, 'bloom', { lit: true })]);
  return merge(stalk, bulb, glint);
}

/** Points spread evenly over a sphere: the cells of a honeycomb. */
const fibonacci = (count: number): V3[] => Array.from({ length: count }, (_, q) => {
  const z = 1 - (2 * (q + 0.5)) / count, r = Math.sqrt(1 - z * z), a = q * 2.39996;
  return [Math.cos(a) * r, Math.sin(a) * r, z];
});

/**
 * A sac: a glowing amber egg, a honeycomb of paler gold cells over it, each a little hexagon laid on the egg with the deep amber
 * showing between them. `c` its middle, `r` its radius.
 */
function sacMesh(c: V3, r: number, n: number, k: number, cells: number): Mesh {
  const R: V3 = [r, r * 0.95, r * 1.1];
  const egg = orb(c, R, n + 2, k + 1, 'petal');
  const across = Math.sqrt((4 * Math.PI) / cells) * 0.52;
  const hexes: Disc[] = fibonacci(cells).map((d, q) => {
    const { p, n: nn } = onEgg(c, R, d);
    const u = unit(cross(Math.abs(nn[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], nn)), w = cross(nn, u);
    // Small cells with plenty of the egg between, so it is a glowing egg with a honeycomb in it rather than a pinecone.
    const v = Array.from({ length: 6 }, (_, e) => {
      const a = (e / 6) * TAU + 0.3, off = add(scale(u, Math.cos(a) * across * r * 0.75), scale(w, Math.sin(a) * across * r * 0.75));
      return add(onEgg(c, R, sub(add(p, off), c)).p, scale(nn, 0.012));
    });
    return { v: v.reverse(), m: (q % 3 ? 'membrane' : 'moss') as Mat, lit: true };
  });
  // Wound to face out of the egg.
  for (const h of hexes) {
    const mid = scale(h.v.reduce((t, p) => add(t, p), [0, 0, 0] as V3), 1 / h.v.length);
    let nx = 0, ny = 0, nz = 0;
    for (let q = 0; q < h.v.length; q++) {
      const p = h.v[q], o = h.v[(q + 1) % h.v.length];
      nx += (p[1] - o[1]) * (p[2] + o[2]); ny += (p[2] - o[2]) * (p[0] + o[0]); nz += (p[0] - o[0]) * (p[1] + o[1]);
    }
    if (nx * (mid[0] - c[0]) + ny * (mid[1] - c[1]) + nz * (mid[2] - c[2]) < 0) h.v.reverse();
  }
  return merge(egg, paint(hexes));
}

/** Where each sac is, in the chest's frame, right side: its middle and radius. Mirrored for the left. */
function sacsOf(s: Slug, G: Geo): Array<{ c: V3; r: number }> {
  const cz = G.nz[G.chest];
  return s.sacs.map(([h, y, r]) => {
    const z = h * s.neck.tall, R = neckAt(G, z);
    // Rooted in the shoulder: two thirds of it out of the side.
    return { c: [R.w * 0.86 + r * 0.42, R.y - G.ny[G.chest] + y, z - cz], r };
  });
}

/**
 * The shell: cream, banded along its turns -- grey-brown blotched with umber, orange, cream, amber -- each turn's seam umber; and
 * where the fire inside shows through, painted lit: flecks, cracks along the bands, pits with a dark rim round a glowing middle,
 * and on a grown one its inner turns molten. In the shell's frame, the middle of the spiral at its origin. `M` round the spiral,
 * `k` rows to a turn.
 */
function shellMesh(s: Slug, M: number, k: number): { mesh: Mesh; lights: Array<{ p: V3; n: V3; r: number; k: number }> } {
  const C = geoOf(s).coil, S = s.shell, turns = C.turns, molten = S.core;
  // Round each angle a run of rows from the outline in to the middle of the spiral, as many to a turn; the innermost going a turn
  // further in by the time it comes round, so the spiral closes on itself with no seam.
  const J = Math.round((turns + 1.3) * k);
  const thAt = (i: number): number => C.th1 - TAU + (TAU * i) / M;
  const lwAt = (i: number, j: number): number => { const th = thAt(i); return lerp(lwEdge(C, th), turns + (th - (C.th1 - TAU)) / TAU, j / J); };
  // Up the right flank from its middle to the outline, and down the left to its middle.
  const col: Array<{ j: number; side: number }> = [{ j: -1, side: 1 }];
  for (let j = J; j >= 0; j--) col.push({ j, side: 1 });
  for (let j = 1; j <= J; j++) col.push({ j, side: -1 });
  col.push({ j: -1, side: -1 });
  const Ncol = col.length;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let i = 0; i < M; i++) for (const c of col) v.push(shellPoint(C, thAt(i), c.j < 0 ? turns + 2 : lwAt(i, c.j), c.side));
  const at = (i: number, c: number): number => (i % M) * Ncol + c;
  for (let i = 0; i < M; i++) {
    for (let c = 0; c < Ncol - 1; c++) {
      const j = Math.max(col[c].j, col[c + 1].j) < 0 ? J : (Math.max(col[c].j, 0) + Math.max(col[c + 1].j, 0)) / 2;
      const lw = lwAt(i + 0.5, Math.min(J, col[c].j < 0 || col[c + 1].j < 0 ? J : j));
      const fr = frac(lw);
      const inner = turns + (thAt(i + 0.5) - (C.th1 - TAU)) / TAU;
      const m: Mat = lw > inner - molten ? (lw > inner - molten * 0.45 && s.stage === 2 ? 'bloom' : (i + c) % 2 ? 'flame' : 'ember')
        : 'shell';
      void fr;
      const idx = [at(i, c), at(i, c + 1), at(i + 1, c + 1), at(i + 1, c)];
      f.push({ i: idx, m });
      want.push(scale(idx.reduce((t, q) => add(t, v[q]), [0, 0, 0] as V3), 0.25));
    }
  }
  const body = mesh(v, wound(v, f, want));
  const decals: Disc[] = [], lights: Array<{ p: V3; n: V3; r: number; k: number }> = [];
  // The bands along each turn, painted on so they follow the spiral smoothly: grey-brown blotched with umber, orange, amber, and the
  // umber seam between one turn and the next.
  const BANDS: Array<[number, number, Mat]> = [[0.14, 0.44, 'shellDark'], [0.52, 0.62, 'horn'], [0.74, 0.84, 'crystal'], [0.94, 1.06, 'hornDark']];
  const seg = Math.max(18, Math.round(M * 0.9));
  for (let m = -1; m < turns; m++) {
    BANDS.forEach(([w0, w1, mat], bi) => {
      // The thin amber stripe on every other turn only, on the small ones.
      if (mat === 'crystal' && s.stage < 2 && (m + 2) % 2) return;
      // Each band's edges wander gently along it, so the turns are not rings.
      const wob = (e: number, edge: number): number => 0.08 * Math.sin((TAU * 3 * e) / seg + 1.7 * m + 2.1 * edge + bi) + 0.04 * Math.sin((TAU * 7 * e) / seg + m + edge * 1.3);
      // The grey-brown broken by gaps three to five segments long, its edges drawing in to nothing over two segments either side.
      const gap = new Array<boolean>(seg).fill(false);
      if (mat === 'shellDark') {
        for (let e = Math.floor(jitter(m * 17 + 3) * 6); e < seg; ) {
          const len = 3 + Math.floor(jitter(e * 5 + m * 13) * 3);
          for (let q = 0; q < len && e + q < seg; q++) gap[e + q] = true;
          e += len + 6 + Math.floor(jitter(e * 3 + m * 7 + 1) * 6);
        }
      }
      const thick = (e: number): number => {
        if (mat !== 'shellDark') return 1;
        let d = 3;
        for (let q = -2; q <= 2; q++) {
          const a = e + q, b = e + q - 1;
          if ((a >= 0 && a < seg && gap[a]) || (b >= 0 && b < seg && gap[b])) d = Math.min(d, Math.abs(q));
        }
        return smooth(d / 2);
      };
      for (let e = 0; e < seg; e++) {
        const a0 = C.th1 - TAU + (TAU * e) / seg, a1 = C.th1 - TAU + (TAU * (e + 1)) / seg;
        if (m + w1 > turns + e / seg - molten) continue;
        if (gap[e]) continue;
        const mm: Mat = mat;
        const edges = (q: number, a: number): [number, number] => {
          const top = m + w1 + wob(q, 0), lo = Math.max(m + w0 + wob(q, 1), lwEdge(C, a) + 0.06), c = (top + lo) / 2, h = ((top - lo) / 2) * thick(q);
          return [c - h, c + h];
        };
        const [lo0, top0] = edges(e, a0), [lo1, top1] = edges(e + 1, a1);
        if (top0 <= lo0 + 1e-4 && top1 <= lo1 + 1e-4) continue;
        if (top0 < lo0 || top1 < lo1) continue;
        for (const side of [1, -1]) {
          const pt = (a: number, l: number): V3 => { const p = shellPoint(C, a, l, side); return add(p, scale(unit([p[0] * 1.6, p[1], p[2]]), 0.012)); };
          const q4 = [pt(a0, lo0), pt(a1, lo1), pt(a1, top1), pt(a0, top0)];
          const mid = scale(q4.reduce((t, p) => add(t, p), [0, 0, 0] as V3), 0.25);
          let nx = 0, ny = 0, nz = 0;
          for (let c = 0; c < 4; c++) { const p = q4[c], o = q4[(c + 1) % 4]; nx += (p[1] - o[1]) * (p[2] + o[2]); ny += (p[2] - o[2]) * (p[0] + o[0]); nz += (p[0] - o[0]) * (p[1] + o[1]); }
          if (nx * mid[0] + ny * mid[1] + nz * mid[2] < 0) q4.reverse();
          decals.push({ v: q4, m: mm });
        }
      }
    });
  }
  const surfOf = (side: number) => (th: number, lw: number): V3 => shellAt(C, th, lw, side);
  const inside = (): V3 => [0, 0, 0];
  const normal = (side: number, th: number, lw: number): V3 => {
    const e = 1e-3, Sf = surfOf(side), p = Sf(th, lw), nn = unit(cross(sub(Sf(th + e, lw), p), sub(Sf(th, lw + e), p)));
    return dot(nn, p) < 0 ? scale(nn, -1) : nn;
  };
  /** How big a thing of size `k` is laid on the turn at `lw` there: the inner turns are smaller. */
  const sizeAt = (th: number, lw: number): number => rimAt(C, th) * Math.exp(-SHELL_LW * lw) * (1 - SHELL_E);
  // Blotches of umber and grey-brown over the grey-brown bands: soft round patches rather than squares.
  for (let m = 0; m < turns - molten - 0.3; m++) {
    const count = Math.round(7 + 3 * (turns - m));
    for (let q = 0; q < count; q++) {
      const id = q * 19 + m * 101, th = C.th1 - 0.3 - (TAU - 0.6) * ((q + 0.5 * jitter(id)) / count);
      const lw = m + 0.29 + 0.14 * (jitter(id + 1) - 0.5);
      if (lw < lwEdge(C, th) + 0.1) continue;
      const r = sizeAt(th, lw) * (0.18 + 0.12 * jitter(id + 2));
      for (const side of [1, -1]) decals.push(patch(surfOf(side), inside, th, lw, r, 9, jitter(id + 3 + side) < 0.55 ? 'hornDark' : 'shellDark', { aspect: 0.8, spin: jitter(id + 4), lift: 0.015 }));
    }
  }
  // Somewhere on a flank or the rim, clear of the mouth, and on the inner turns not right in at the middle.
  const spot = (q: number, salt: number, inner: number): [number, number, number] => {
    const th = C.th1 - 0.45 - jitter(q * 3 + salt) * (TAU - 1.1);
    const lw = 0.12 + jitter(q * 5 + salt) * Math.max(0.3, inner);
    return [th, lw, q % 2 ? 1 : -1];
  };
  const reach = Math.max(0.5, turns - molten - 0.6);
  for (let q = 0; q < S.flecks; q++) {
    const [th, lw, side] = spot(q, 3, reach), r = sizeAt(th, lw) * (0.13 + 0.05 * jitter(q + 1));
    decals.push(patch(surfOf(side), inside, th, lw, r, 6, 'flame', { lit: true, lift: 0.02 }));
    lights.push({ p: shellAt(C, th, lw, side), n: normal(side, th, lw), r: r * 5, k: 0.6 });
  }
  for (let q = 0; q < S.cracks; q++) {
    // A jagged seam along a band, glowing, with a paler core.
    const side = q % 2 ? 1 : -1, th0 = C.th1 - 0.6 - (q >> 1) * 1.9 - jitter(q) * 0.5, run = 1.2 + 0.5 * jitter(q + 2);
    const band = Math.floor(jitter(q + 6) * Math.min(2, reach)) + 0.62, steps = 5;
    // A zig-zag with uneven steps, so it is a crack and not a stripe.
    const at = (e: number): number => th0 - (run * (e + (e > 0 && e < steps ? 0.35 * (jitter(q * 11 + e) - 0.5) : 0))) / steps;
    const jag = (e: number): number => band + 0.16 * (e % 2 ? 1 : -1) * (0.6 + 0.4 * jitter(q * 5 + e));
    for (let e = 0; e < steps; e++) {
      const a0 = at(e), a1 = at(e + 1);
      const l0 = jag(e), l1 = jag(e + 1);
      for (const [hw, m, lift] of [[0.08, 'ember', 0.02], [0.035, s.stage === 2 ? 'bloom' : 'flame', 0.026]] as Array<[number, Mat, number]>) {
        const Sf = surfOf(side);
        const pt = (a: number, l: number): V3 => add(Sf(a, l), scale(normal(side, a, l), lift));
        const q4 = [pt(a0, l0 - hw), pt(a1, l1 - hw), pt(a1, l1 + hw), pt(a0, l0 + hw)];
        const nn = normal(side, a0, l0);
        let nx = 0, ny = 0, nz = 0;
        for (let c = 0; c < 4; c++) { const p = q4[c], o = q4[(c + 1) % 4]; nx += (p[1] - o[1]) * (p[2] + o[2]); ny += (p[2] - o[2]) * (p[0] + o[0]); nz += (p[0] - o[0]) * (p[1] + o[1]); }
        if (nx * nn[0] + ny * nn[1] + nz * nn[2] < 0) q4.reverse();
        decals.push({ v: q4, m, lit: true });
      }
      if (e % 2 === 1) lights.push({ p: shellAt(C, a0, l0, side), n: normal(side, a0, l0), r: sizeAt(a0, l0) * 0.9, k: 1 });
    }
  }
  for (let q = 0; q < S.pits; q++) {
    // A pit: a dark rim, the ember in it, and a bright heart.
    const [th, lw, side] = spot(q, 17, reach), r = sizeAt(th, lw) * S.pit * (1.6 + 1.1 * jitter(q + 9));
    const Sf = surfOf(side);
    decals.push(patch(Sf, inside, th, lw, r, 12, 'hornDark', { lift: 0.018, spin: jitter(q) }));
    decals.push(patch(Sf, inside, th, lw, r * 0.6, 12, 'ember', { lift: 0.022, lit: true, spin: jitter(q) }));
    decals.push(patch(Sf, inside, th, lw, r * 0.3, 7, s.stage === 2 && q % 3 === 0 ? 'bloom' : 'flame', { lift: 0.026, lit: true }));
    lights.push({ p: shellAt(C, th, lw, side), n: normal(side, th, lw), r: r * 2, k: 1 });
  }
  if (molten > 0) {
    // The molten heart, seen through the spiral on either flank.
    for (const sd of [1, -1]) lights.push({ p: [sd * C.X, 0, 0], n: [sd, 0, 0], r: C.R * (0.3 + 0.2 * molten), k: 0.9 + 0.4 * molten });
  }
  return { mesh: merge(body, paint(decals)), lights };
}

/** A stage's pieces. */
function slugBuild(s: Slug, lod: number): Piece[] {
  const G = geoOf(s);
  const n = cut(lod, 9, 12), k = cut(lod, 5, 6);
  // Solids things are hidden behind or inside: the chest, the head, the foot's back.
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.82) };
  const chestSolid = { c: [0, 0, 0] as V3, r: [G.nw[G.chest] * 0.92, G.nd[G.chest] * 0.92, s.neck.tall * 0.25] as V3 };
  const baseSolid = { c: [0, 0, 0] as V3, r: [G.nw[1] * 0.95, G.nd[1] * 0.95, s.neck.tall * 0.42] as V3 };
  const footSolids = [-0.8, 0, 0.8].map((f) => {
    const y = clamp(s.shell.y + f * s.shell.R, G.yt + 0.1, G.yf);
    const { w, h } = footAt(s, G, y);
    return { c: [0, y, 0] as V3, r: [w * 0.97, s.shell.R * 0.5, h * 0.95] as V3 };
  });
  const footBody = footMesh(s, G, cut(lod, 12, 18), cut(lod, 7, 9)), ripple = rippleBand(s, G), rippleAt = footBody.v.length;
  const foot = merge(footBody, ripple.mesh);
  const skirt = skirtMesh(s, G, s.skirt[1] * (lod ? 1 : 1.4));
  const neck = neckMesh(s, G, n + 2);
  const shell = shellMesh(s, cut(lod, 30, 48), cut(lod, 5, 6));
  // Each of the front's corners, as how far up its rings it is.
  const ringOf = neck.v.map((p) => { const R = neckAt(G, p[2]); return R.k + R.f; });
  const pieces: Piece[] = [
    { key: 'skirt', mesh: skirt.mesh, bone: 'trunk', bias: -0.3, under: ['foot', 'neck'], bent: (v, a) => {
      const P = poseFor(s, a);
      return v.map((p, i) => [p[0], p[1] + P.dy(p[1]), p[2] + P.lift(p[1]) * (skirt.out[i] ?? 0)] as V3);
    } },
    { key: 'foot', mesh: foot, bone: 'trunk', bias: 0, hide: [baseSolid], hideIn: 'ring1', bent: (v, a) => {
      const P = poseFor(s, a);
      const moved = (p: V3): V3 => {
        // Its back swells as the wave goes under it, more than the edge of its skirt lifts: the ripple seen along it. The sole goes
        // with the waves, its back at the body's even pace, so the flank shears into ripples between them.
        const h = footAt(s, G, p[1]).h, up = clamp(p[2] / h);
        // As much higher as the foot is tall there: a swell, not a lump, where it thins to its tail.
        return [p[0], p[1] + P.dy(p[1]) * (1 - smooth(up)) ** 1.5, p[2] + P.lift(p[1]) * 3.5 * (h / s.foot.h) * up ** 0.7];
      };
      return v.map((p, i) => {
        if (i < rippleAt) return moved(p);
        // A ripple band drawn in while the wave is under it, and gone to nothing between.
        const c = ripple.mid[i - rippleAt], k = P.wave(c[1]);
        const pc = moved(c), pv = moved(p);
        return [lerp(pc[0], pv[0], k), lerp(pc[1], pv[1], k), lerp(pc[2], pv[2], k)] as V3;
      });
    } },
    { key: 'shell', mesh: shell.mesh, bone: 'shell', bias: 0.02, after: 'foot', hide: footSolids, hideIn: 'trunk' },
    { key: 'neck', mesh: neck, bone: 'trunk', bias: 0.05, after: 'shell', front: [0, 1, 0], hide: [headSolid], hideIn: 'head', bent: (v, a) => {
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
    { key: 'head', mesh: headMesh(s, n, k, false), shut: headMesh(s, n, k, true), bone: 'head', bias: 0.12, after: ['neck', 'shell'], front: [0, 1, 0], hide: [{ c: [0, 0, 0], r: scale(s.head.r, 0.5) }] },
  ];
  for (const [q, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    pieces.push({ key: `tent${q}`, mesh: tentMesh(s, n), bone: `tent${q}`, bias: 0.13, after: 'head', hide: [headSolid], hideIn: 'head', front: [sd * 0.3, 0.2, 1] });
  }
  const cells = [22, 30, 40][s.stage];
  sacsOf(s, G).forEach((sac, q) => {
    for (const sd of [1, -1]) {
      const c: V3 = [sd * sac.c[0], sac.c[1], sac.c[2]];
      pieces.push({ key: `sac${q}${sd > 0 ? 'r' : 'l'}`, mesh: sacMesh(c, sac.r, n, k, Math.round(cells * (q ? 0.7 : 1))), bone: 'chest', bias: 0.06 - 0.01 * q, convex: true,
        after: 'neck', front: [sd, 0.25, 0], hide: [chestSolid], hideIn: 'chest' });
    }
  });
  void shell.lights;
  return pieces;
}

/* ---- its light ------------------------------------------------------------------------------ */

/** Where the fire shows through it, in the shell's frame, worked out once a stage. */
const lightsOf = new Map<Slug, Array<{ p: V3; n: V3; r: number; k: number }>>();
const shellLights = (s: Slug): Array<{ p: V3; n: V3; r: number; k: number }> => {
  let l = lightsOf.get(s);
  if (!l) { l = shellMesh(s, 8, 4).lights; lightsOf.set(s, l); }
  return l;
};

const AMBER: RGB = [255, 168, 60];
const GOLD: RGB = [255, 206, 104];
const MOLTEN: RGB = [255, 120, 36];
const WHITE_HOT: RGB = [255, 244, 210];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Turned by an `Xf`'s turn alone. */
const turn = (x: Xf, v: V3): V3 => [x.m[0] * v[0] + x.m[1] * v[1] + x.m[2] * v[2], x.m[3] * v[0] + x.m[4] * v[1] + x.m[5] * v[2], x.m[6] * v[0] + x.m[7] * v[1] + x.m[8] * v[2]];

/** Whether something round, at `c` and `r` across, is between a point and the viewer. */
function blocked(p: V3, T: V3, balls: ReadonlyArray<{ c: V3; r: number }>): boolean {
  for (const b of balls) {
    const d = sub(b.c, p), along = dot(d, T);
    if (along <= 0) continue;
    if (dot(d, d) - along * along < b.r * b.r) return true;
  }
  return false;
}

/** A soft light added over what is under it: brightest in its middle, gone at its edge. */
function light(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(0.4, css(c, al * 0.4));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** The round solids its lights are hidden behind: the front ring by ring, its head, its shell. */
function solidsOf(s: Slug, b: Bones, withShell: boolean): Array<{ c: V3; r: number }> {
  const G = geoOf(s), out: Array<{ c: V3; r: number }> = [];
  for (let k = 1; k < G.nz.length; k += 2) out.push({ c: b[`ring${k}`].t, r: (G.nw[k] + G.nd[k]) * 0.46 });
  out.push({ c: b.head.t, r: (s.head.r[0] + s.head.r[2]) * 0.46 });
  if (withShell) out.push({ c: b.shell.t, r: s.shell.R * 0.82 });
  return out;
}

/**
 * Its glow: the light of the fire inside it, added over its body where it shows -- round each pit, crack and fleck of the shell
 * turned toward the viewer, over each sac on the near side, and round each bulb -- and hidden where its front or its head or its
 * shell is in the way. Breathing slowly; brighter as it stokes, flares or evolves.
 */
function slugGlow(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, P: SlugPose): void {
  const T = view.T, G = geoOf(s);
  const front = solidsOf(s, b, false), all = solidsOf(s, b, true);
  const facing = (n: V3): number => clamp((dot(n, T) - 0.05) / 0.35);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const shine = P.glow.shell;
  // Brighter than ever only as it evolves, when its fire is at its height.
  const cap = 0.42 + 0.28 * clamp((shine - 1.6) / 1.0);
  for (const L of shellLights(s)) {
    const p = place(b.shell, L.p), n = turn(b.shell, L.n), k = facing(n);
    if (k <= 0 || blocked(p, T, front)) continue;
    const [x, y] = onScreen(view, p);
    light(g, x, y, L.r * (0.8 + 0.2 * Math.min(2.5, shine)), L.k > 0.85 ? AMBER : MOLTEN, clamp(0.15 * L.k * k * shine, 0, cap));
  }
  // The shell flaring as a whole, over its back.
  if (P.glow.flare > 0) {
    const top = place(b.shell, [0, 0, s.shell.R * 0.25]);
    const [x, y] = onScreen(view, top);
    light(g, x, y, s.shell.R * 1.5, AMBER, 0.62 * P.glow.flare);
    light(g, x, y, s.shell.R * 0.75, GOLD, 0.38 * P.glow.flare);
  }
  sacsOf(s, G).forEach((sac) => {
    for (const sd of [1, -1]) {
      const c = place(b.chest, [sd * sac.c[0], sac.c[1], sac.c[2]]), n = turn(b.chest, [sd, 0.2, 0.1]);
      const k = 0.35 + 0.65 * facing(n);
      if (blocked(add(c, scale(T, sac.r * 0.8)), T, all)) continue;
      const [x, y] = onScreen(view, c);
      light(g, x, y, sac.r * 1.8, GOLD, clamp(0.35 * k * P.glow.sac, 0, 0.6));
    }
  });
  for (const tk of ['tent0', 'tent1']) {
    const p = place(b[tk], [0, 0.09 * s.tent.len, s.tent.len + s.tent.bulb * 0.55]);
    if (blocked(add(p, scale(T, s.tent.bulb)), T, all)) continue;
    const [x, y] = onScreen(view, p);
    light(g, x, y, s.tent.bulb * 3.2, GOLD, clamp(0.36 * P.glow.bulb, 0, 0.75));
  }
  g.restore();
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling by `fall`; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's sparks and flame are drawn, against the Slugember's. */
const bigness = (s: Slug): number => [0.9, 1.15, 1.5][s.stage];

/** The colour of something burning as hot as `h`: white-gold, through gold and orange, to a dull red. */
function heat(h: number): RGB {
  const k = clamp(h);
  return k > 0.66 ? mix(GOLD, WHITE_HOT, (k - 0.66) / 0.34) : k > 0.33 ? mix(MOLTEN, GOLD, (k - 0.33) / 0.33) : mix([170, 60, 34], MOLTEN, k / 0.33);
}

/** A spark: a short bright streak from where it was to where it is, with a white-hot head, shrinking as it cools. */
function spark(g: CanvasRenderingContext2D, from: [number, number], to: [number, number], w: number, h: number): void {
  if (w <= 0.01) return;
  g.lineCap = 'round';
  g.strokeStyle = css(heat(h * 0.8), 1);
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(from[0], from[1]);
  g.lineTo(to[0], to[1]);
  g.stroke();
  g.fillStyle = css(heat(Math.min(1, h + 0.3)), 1);
  g.beginPath();
  g.arc(to[0], to[1], w * 0.62, 0, TAU);
  g.fill();
}

/** An ember: a small round coal, its colour by how hot it still is, with a soft light round it; it goes by shrinking, not fading. */
function ember(g: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, rim = true): void {
  if (r <= 0.01) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  light(g, x, y, r * 3.2, heat(h), 0.35);
  g.restore();
  // A darker rim, so it reads against a pale body as well as against the grass; none while they are still bunched together at
  // where they were thrown from, where rims over each other would be a cluster of bubbles.
  if (rim) {
    g.fillStyle = css(heat(h * 0.45), 1);
    g.beginPath();
    g.arc(x, y, r * 1.22, 0, TAU);
    g.fill();
  }
  g.fillStyle = css(heat(h * 0.85), 1);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = css(heat(Math.min(1, h + 0.25)), 1);
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU);
  g.fill();
}

/**
 * A tongue of flame: a soft ball of fire, its heart the hottest, cooling to red and to nothing at its edge, so a gout of them
 * overlapping is one fire with no line round any of them; and a little light added at its heart.
 */
function flame(g: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, al = 1): void {
  if (r <= 0.01 || al <= 0.004) return;
  const grad = g.createRadialGradient(x, y + r * 0.12, 0, x, y, r);
  grad.addColorStop(0, css(heat(Math.min(1, h + 0.15)), 0.95 * al));
  grad.addColorStop(0.35, css(heat(h), 0.8 * al));
  grad.addColorStop(0.7, css(heat(Math.max(0, h - 0.35)), 0.35 * al));
  grad.addColorStop(1, css(heat(0), 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  if (h > 0.5) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    light(g, x, y, r * 0.45, GOLD, 0.35 * al * (h - 0.5) * 2);
    g.restore();
  }
}

/** Smoke: a soft warm grey cloud, thickest in its middle and gone at its edge, so where two meet there is no line; `dark` deepens it. */
function smoke(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, dark = 0): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(mix([150, 132, 124], [120, 108, 104], dark), al));
  grad.addColorStop(0.5, css(mix([168, 152, 144], [132, 120, 116], dark), al * 0.55));
  grad.addColorStop(1, css(mix([180, 166, 158], [142, 130, 126], dark), 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * Its outline's top across the screen as it stands this moment, in strips: what something on its far side must be over to be seen
 * past it, from points high on its head, stalks and shell.
 */
function crestOf(s: Slug, b: Bones, view: View): (x: number, y: number) => boolean {
  const strip = 0.25 * bigness(s), top = new Map<number, number>();
  let x0 = Infinity, x1 = -Infinity;
  const C = geoOf(s).coil, mark = (p: V3): void => {
    const [x, y] = onScreen(view, p), i = Math.round(x / strip);
    top.set(i, Math.min(top.get(i) ?? Infinity, y));
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  };
  for (let q = 0; q < 24; q++) {
    const th = C.th1 - (q / 24) * TAU;
    for (const [lw, sd] of [[-1, 1], [0.4, 1], [0.4, -1]]) mark(place(b.shell, shellAt(C, th, lw, sd)));
  }
  for (let q = 0; q < 10; q++) { const a = (q / 10) * TAU; mark(place(b.head, [Math.cos(a) * s.head.r[0], Math.sin(a) * s.head.r[1], s.head.r[2] * 0.7])); }
  for (const tk of ['tent0', 'tent1']) for (const f of [0.5, 1]) mark(place(b[tk], [0, 0.08 * s.tent.len * f, (s.tent.len + s.tent.bulb) * f]));
  for (let k = 0; k < geoOf(s).nz.length; k++) for (const sd of [1, -1]) mark(place(b[`ring${k}`], [sd * geoOf(s).nw[k], 0, 0]));
  return (x, y) => {
    if (x < x0 - strip || x > x1 + strip) return true;
    const i = Math.round(x / strip);
    return y < Math.min(top.get(i - 1) ?? Infinity, top.get(i) ?? Infinity, top.get(i + 1) ?? Infinity) - strip * 0.3;
  };
}

/** The middle of its body, over the ground: what the near and far sides of it are sides of. */
const midOf = (s: Slug, b: Bones): V3 => [0, (b.shell.t[1] + b.chest.t[1]) / 2, b.chest.t[2] * 0.8];
/** Where its mouth would be, at the front of its head, a little low: where it breathes out and where its flame comes from. */
const mouthOf = (s: Slug, b: Bones): V3 => place(b.head, [0, s.head.r[1] * 1.02, -s.head.r[2] * 0.25]);
/** The front of its chin, which noses the fuel along. */
const chinOf = (s: Slug, b: Bones): V3 => place(b.head, [0, s.head.r[1] * 0.95, -s.head.r[2] * 0.45]);

/**
 * Embers going up off the top of its shell, slowly, wavering: how it is seen to burn from behind, where the shell hides its head.
 * `n` of them, each `life` seconds rising, through `since` seconds; `hot` how bright.
 */
function shellEmbers(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, since: number, n: number, life: number, hot: number, front: boolean, salt = 0, rate = 1): void {
  if (since < 0) return;
  const big = bigness(s), C = geoOf(s).coil, mid = midOf(s, b);
  for (let q = 0; q < n; q++) {
    const start = q * life * 0.18 * jitter(q + salt), age = since - start;
    if (age < 0 || age > life) continue;
    const th = C.th1 - TAU * (0.3 + 0.55 * jitter(q + salt + 3));
    const from = place(b.shell, shellAt(C, th, -0.4 + 0.5 * jitter(q + salt + 5), q % 2 ? 1 : -1));
    const k = age / life, sway = Math.sin(age * 9 + q) * 0.25 * big;
    const p: V3 = [from[0] + sway, from[1] + 0.2 * Math.cos(q), from[2] + age * rate * (1.6 + 0.8 * jitter(q + salt)) * big];
    if ((nearSide(p, mid, view) || p[2] > b.shell.t[2] + s.shell.R * 0.9) !== front) continue;
    const [x, y] = onScreen(view, p);
    ember(g, x, y, 0.15 * big * (1 - k * 0.8), hot * (1 - k * 0.7));
  }
}

/** A flash where a blow lands: light added over the ground and the air round it. */
function flash(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const [x, y] = onScreen(view, at);
  light(g, x, y, r, MOLTEN, 0.5 * al);
  light(g, x, y, r * 0.5, GOLD, 0.45 * al);
  g.restore();
}

/** Whether a point is in sight, not round behind its front, its head or its shell: where a flash there may be drawn over it. */
const seenAt = (s: Slug, b: Bones, view: View, p: V3): boolean => !blocked(p, view.T, solidsOf(s, b, true));

/** A ring of light going out over the ground from where it came down. */
function groundRing(g: CanvasRenderingContext2D, view: View, at: V3, r: number, w: number, al: number): void {
  if (al <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = css(AMBER, al);
  g.lineWidth = w;
  g.beginPath();
  for (let q = 0; q <= 28; q++) {
    const a = (q / 28) * TAU, [x, y] = onScreen(view, [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, 0.03]);
    if (q) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
  g.restore();
}

/**
 * A burst of sparks and embers thrown up and out of `from`, `since` seconds after: some low and out, some high, up past the top of
 * it so they are seen from behind it too; each drawn over the body when it is on the near side of it or clear of its outline.
 */
function burst(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, clear: (x: number, y: number) => boolean, from: V3, fwd: V3, since: number, count: number, speed: number, front: boolean, salt: number,
  tall?: { n: number; k: number; lo: number; hi: number }): void {
  const big = bigness(s), mid = midOf(s, b);
  for (let q = 0; q < count; q++) {
    // With `tall`, that many of them thrown that much harder, each going out at a height between `lo` and `hi` over the ground.
    const id = q * 7 + salt, high = tall ? (q * tall.n) % count < tall.n : q % 3 === 0;
    const a = (q / count) * TAU + jitter(id) * 0.6, sp = speed * (0.6 + 0.6 * jitter(id + 1));
    const up = high ? speed * ((tall?.k ?? 2.6) + jitter(id + 2)) : speed * (1 + 1.2 * jitter(id + 2));
    const v: V3 = [Math.cos(a) * sp + fwd[0] * sp * 0.6, Math.sin(a) * sp * 0.7 + fwd[1] * sp * 0.6, up];
    const climb = tall ? lerp(tall.lo, tall.hi, jitter(id + 3)) - from[2] : 0;
    const life = tall && high ? (up - Math.sqrt(Math.max(0, up * up - 14 * climb))) / 7 : 0.36 + 0.24 * jitter(id + 3), age = since - 0.03 * jitter(id + 5);
    if (age < 0 || age > life) continue;
    // Each from a little way out from where they were thrown from, the way it goes, and a moment after the last.
    const start = add(from, scale(unit(v), 0.15 * big));
    const p = thrown(start, v, age, 7), was = thrown(start, v, Math.max(0, age - 0.035), 7);
    const [x, y] = onScreen(view, p);
    if ((nearSide(p, mid, view) || clear(x, y)) !== front) continue;
    const k = age / life;
    if (q % 2) spark(g, onScreen(view, was), [x, y], 0.12 * big * (1 - k * 0.7), 1 - k);
    else ember(g, x, y, 0.17 * big * (1 - k * 0.75), 1 - k * 0.8, age > 0.06);
  }
}

/**
 * The strike. The Sluglow's head pops into what it butts in a puff of sparks. The Slugember comes down in a burst of embers off the
 * ground before it and a ring of light over it. The Slugferno throws a gout of flame out ahead of it before it comes down, and the
 * ground flashes bright where it lands. Embers go up off every shell as it strikes, which is what is seen of it from behind.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, atHit: Bones, atFlame: Bones, t: number, front: boolean): void {
  const hit = SLUG_HITS[s.stage], big = bigness(s), since = (t - hit) * ACT_SECS.strike, mid = midOf(s, b);
  const clear = crestOf(s, b, view), G = geoOf(s);
  shellEmbers(g, view, s, b, t * ACT_SECS.strike - 0.1, 10 + 3 * s.stage, 0.42, 0.9, front, 11);
  if (s.stage === 2) {
    // The gout of flame: a stream out of it from the start of its flame to its end, each tongue going out ahead and up, swelling and
    // cooling to smoke.
    const [f0, f1] = SLUG_FLAME, mouth = mouthOf(s, atFlame), fw = unit(turn(atFlame.head, [0, 1, -0.12]));
    const N = 44;
    for (let q = 0; q < N; q++) {
      const te = lerp(f0, f1, q / (N - 1)), age = (t - te) * ACT_SECS.strike, life = 0.09 + 0.02 * jitter(q);
      if (age < 0 || age > life) continue;
      const k = age / life, d = 34 * age * (1 - 0.35 * k);
      const p: V3 = add(mouth, add(scale(fw, d), [Math.sin(q * 2.1) * 0.2 * k * big, 0, 20 * age * age + 0.15 * k]));
      const [x, y] = onScreen(view, p);
      if ((nearSide(p, mid, view) || clear(x, y)) !== front) continue;
      const r = (0.26 + 0.75 * k) * big;
      // Cooling into soft grey smoke at its end, never a dull red ball.
      const cool = ramp(k, 0.55, 0.8);
      if (cool > 0) smoke(g, x, y - r * 0.3, r * 1.3, 0.3 * cool * (1 - ramp(k, 0.85, 1)));
      flame(g, x, y, r, Math.max(0.25, 1 - 0.8 * k), (1 - 0.45 * k) * (1 - cool));
    }
    // Sparks thrown off the gout.
    const flaming = (t - f0) * ACT_SECS.strike;
    if (flaming > 0 && t < f1 + 0.2) burst(g, view, s, b, clear, add(mouth, scale(fw, 0.6)), fw, flaming, 10, 3.2, front, 50);
  }
  if (since < 0) return;
  const fade = 1 - ramp(t, 0.8, 1);
  if (s.stage === 0) {
    // Sparks off the front of its head, where it butts.
    const at = add(mouthOf(s, atHit), [0, 0.12, 0.1]), fw = unit(turn(atHit.head, [0, 1, 0.2]));
    if (front && seenAt(s, b, view, at)) flash(g, view, at, 1.5 * big, hump(since, 0.04, 0.14));
    burst(g, view, s, b, clear, at, fw, since, 24, 3.2, front, 3);
    const [x, y] = onScreen(view, add(at, [0, 0.1, since * 2]));
    if (front) smoke(g, x, y, (0.3 + 1.6 * since) * big, 0.35 * fade * (1 - ramp(since, 0.05, 0.3)));
    return;
  }
  // Where its front comes down: on the ground just before its chest.
  const ground: V3 = [0, G.ny[0] + G.nd[0] * 1.05, 0.05];
  const k = ramp(since, 0, 0.28);
  if (!front) groundRing(g, view, ground, (0.4 + 2.6 * k) * big, 0.14 * big, 0.8 * (1 - k));
  if (front && seenAt(s, b, view, add(ground, [0, 0, 0.4]))) flash(g, view, add(ground, [0, 0, 0.4]), (2.2 + 1.0 * s.stage) * big, hump(since, 0.04, s.stage === 2 ? 0.18 : 0.14));
  burst(g, view, s, b, clear, ground, [0, 0.6, 0], since, s.stage === 2 ? 30 : 22, s.stage === 2 ? 3.6 : 3, front, 7);
  for (let q = 0; q < 4 + s.stage * 2; q++) {
    const a = (q / (4 + s.stage * 2)) * TAU + 0.4, kk = since * (0.8 + 0.4 * jitter(q));
    const p: V3 = add(ground, [Math.cos(a) * (0.5 + 3 * kk) * big, Math.sin(a) * (0.5 + 2 * kk) * big, 0.3 + kk * 2.2]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    smoke(g, x, y, (0.4 + 1.8 * kk) * big, 0.3 * fade * (1 - ramp(since, 0.1, 0.32)));
  }
}

/** How big a stage's piece of fuel is: its half-length across, and its radius. */
/**
 * How high over the ground the catch's smoke and sparks may go and still be inside the picture a stage is kept in (`reachOf` in
 * beasts.ts), seen from behind it with the fuel beyond it.
 */
const ROOF = [5.0, 6.7, 8.0];

const fuelSize = (s: Slug): [number, number] => [0.6 * bigness(s), [0.28, 0.48, 0.57][s.stage]];

/**
 * Where a piece of fuel is this moment of a go, along the ground before it, and how much of it is left: lying just before its chin
 * as it comes down to it, nosed forward by its chin as far as its chin goes, and burnt down after it catches; and, going on, how
 * much is left of the last piece.
 */
function fuelOf(s: Slug, t: number, graze: number, chin: (t: number) => number, now: number): { y: number; left: number; next: number } {
  const W = SLUG_WORK, r = fuelSize(s)[1];
  const y0 = chin(W.down) + r, y1 = chin(W.push) + r;
  const y = t < W.down ? y0 : t < W.push ? clamp(now + r, y0, y1) : y1;
  const left = ramp(t, 0.06, 0.2) * (1 - 0.85 * ramp(t, W.light + 0.04, 1));
  return { y, left, next: graze >= 0.5 ? 1 - ramp(t, 0.1, 0.32) : 0 };
}

/** A piece of fuel on the ground: a short dark log of peat, lying across, its end rings paler; glowing as it heats. */
function fuel(g: CanvasRenderingContext2D, view: View, s: Slug, y: number, size: number, glow: number): void {
  if (size <= 0.02) return;
  const [len, rad] = fuelSize(s), half = len * size, r = rad * (0.4 + 0.6 * size);
  // Lying across the view, whichever way the body is turned, so it is a log on the ground and not a post.
  const ax: V3 = [-view.H[1], view.H[0], 0];
  const c: V3 = [0, y, r], a = onScreen(view, add(c, scale(ax, -half))), b = onScreen(view, add(c, scale(ax, half)));
  g.lineCap = 'round';
  g.strokeStyle = css(mix([62, 42, 34], [150, 60, 30], glow), 1);
  g.lineWidth = r * 2.2;
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  g.strokeStyle = css(mix([104, 74, 56], [255, 150, 60], glow), 1);
  g.lineWidth = r * 0.8;
  g.beginPath(); g.moveTo(a[0], a[1] - r * 0.5); g.lineTo(b[0], b[1] - r * 0.5); g.stroke();
  // Its paler cut end, at the end nearer the viewer.
  const near = onScreen(view, a[1] > b[1] ? add(c, scale(ax, -half)) : add(c, scale(ax, half)));
  g.fillStyle = css(mix([104, 74, 56], [255, 170, 80], glow), 1);
  g.beginPath();
  g.ellipse(near[0], near[1], r * 0.8 * 0.6, r * 0.8, 0, 0, TAU);
  g.fill();
  if (glow > 0.02) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    light(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, half * 2.2, MOLTEN, 0.45 * glow);
    g.restore();
  }
}

/**
 * One flame leaping up from `base`, `tall` high: a single tapering tongue, its edge smooth, its middle swaying, hottest at its foot
 * and gone at its tip, with a little light about its foot.
 */
function leapFlame(g: CanvasRenderingContext2D, view: View, base: V3, tall: number, big: number, since: number, al: number, crest?: number): void {
  if (tall <= 0.05 || al <= 0.004) return;
  const ax: V3 = [-view.H[1], view.H[0], 0], N = 14, left: Array<[number, number]> = [], right: Array<[number, number]> = [];
  // Seen over its crest from behind (`crest`: how far up it the crest crosses it): wider there, and its tip flickering.
  const fc = crest === undefined ? 0 : clamp(crest, 0, 0.9);
  for (let k = 0; k <= N; k++) {
    const f = k / N, z = base[2] + tall * f;
    const sway = 0.12 * big * Math.sin(since * 20 + z * 1.5) * f + (crest === undefined ? 0 : 0.15 * big * Math.sin(since * TAU * 6) * f * f);
    const half = crest === undefined ? lerp(0.28, 0.06, f) * big * (1 - 0.15 * f * f) : lerp(0.36, 0.06, clamp((f - fc) / (1 - fc))) * big;
    const c = add(add(base, [0, 0, tall * f]), scale(ax, sway));
    left.push(onScreen(view, add(c, scale(ax, -half))));
    right.push(onScreen(view, add(c, scale(ax, half))));
  }
  const [bx, by] = onScreen(view, base), [tx, ty] = onScreen(view, add(base, [0, 0, tall]));
  const grad = g.createLinearGradient(bx, by, tx, ty);
  if (crest === undefined) {
    grad.addColorStop(0, css(heat(0.95), 0.9 * al));
    grad.addColorStop(0.5, css(heat(0.6), 0.7 * al));
  } else {
    // Warm orange over the crest, not the near-white of its hottest, which is lost against a pale shell.
    grad.addColorStop(0, css(heat(0.6), 0.95 * al));
    grad.addColorStop(fc, css(heat(0.6), 0.95 * al));
    grad.addColorStop(0.5 * (fc + 1), css(heat(0.42), 0.8 * al));
  }
  grad.addColorStop(1, css(heat(0.2), 0));
  g.fillStyle = grad;
  g.beginPath();
  // Its edge drawn through the middles of the steps, so it is a smooth curve and not a row of corners.
  const pts = [...left, ...right.reverse()];
  const mid2 = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid2(pts[pts.length - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let q = 0; q < pts.length; q++) {
    const m = mid2(pts[q], pts[(q + 1) % pts.length]);
    g.quadraticCurveTo(pts[q][0], pts[q][1], m[0], m[1]);
  }
  g.closePath();
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  light(g, bx, by, 0.9 * big, GOLD, 0.35 * al);
  g.restore();
}

/**
 * At its task: the fuel before it, nosed forward along the ground; its breath on it, a warm haze; the fuel glowing up and, as it
 * catches, a flare, little flames on it, sparks going up and a wisp of soft smoke; and embers up off its shell as it catches, seen
 * from behind. A go played once, from standing, throws nothing until it catches.
 */
function workSpray(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, a: Anim, t: number, front: boolean, bonesAt: (t: number) => Bones): void {
  const W = SLUG_WORK, big = bigness(s), mid = midOf(s, b), d = downOf(t, a.graze);
  const chin = (u: number): number => chinOf(s, bonesAt(u))[1];
  const F = fuelOf(s, t, a.graze, chin, chinOf(s, b)[1]), heatUp = ramp(t, W.breathe, W.light);
  const loop = a.graze >= 0.5;
  // Where a piece catches: where it was nosed to. Last go's piece still burning down there as the next is laid down, its flames going
  // on from the last go's into this one, so a go kept at runs on without a break.
  const yc = fuelOf(s, W.push, 1, chin, chin(W.push)).y;
  if (loop && F.next > 0 && nearSide([0, yc, 0.1], mid, view) === front) fuel(g, view, s, yc, 0.15 * F.next, 0.8 * F.next);
  const clear = crestOf(s, b, view);
  const fp: V3 = [0, F.y, 0.1];
  if (nearSide(fp, mid, view) === front) fuel(g, view, s, F.y, F.left, heatUp * (1 - (loop ? 0.2 : 1) * ramp(t, 0.96, 1)));
  // Its breath: a warm haze from its mouth down to the fuel.
  const breath = ramp(t, W.breathe, W.breathe + 0.06) * (1 - ramp(t, W.light - 0.04, W.light + 0.02)) * d;
  if (breath > 0 && front) {
    const m = mouthOf(s, b);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 5; q++) {
      const f = frac(t * 6 + q / 5), p: V3 = [m[0] + Math.sin(q * 2.3 + t * 9) * 0.06, lerp(m[1], F.y, f), lerp(m[2], 0.2, f)];
      if (!seenAt(s, b, view, p)) continue;
      const [x, y] = onScreen(view, p);
      light(g, x, y, (0.18 + 0.3 * f) * big, MOLTEN, 0.22 * breath * Math.sin(Math.PI * f));
    }
    g.restore();
  }
  if (t < W.light && !loop) return;
  const since = frac(t - W.light) * ACT_SECS.work;
  const at: V3 = [0, yc, 0.18], top = fuelSize(s)[1] * 2, shellTop = b.shell.t[2] + 0.87 * s.shell.R;
  // Smoke going up off it, soft and dark enough to read against the grass, shooting up over the top of its shell and slowing to hang
  // there, under the top of its picture: what is seen of the catch from behind it. Going on into the next go's, when it is kept at it.
  const hang = ROOF[s.stage] - 0.6 * big - 0.5;
  for (const ago of loop ? [since, since + ACT_SECS.work] : [since]) {
    for (let q = 0; q < 3; q++) {
      const age = ago - 0.1 - q * 0.08;
      if (age < 0 || age > 1.2) continue;
      const p: V3 = [Math.sin(q * 2 + age * 3) * 0.25 * big, yc - 0.1 * q, 0.5 + hang * (1 - Math.exp(-3.5 * age))];
      const [x, y] = onScreen(view, p);
      if ((nearSide(p, mid, view) || clear(x, y)) !== front) continue;
      smoke(g, x, y, (0.5 + 1.4 * age) * big, 0.42 * ramp(age, 0, 0.06) * (1 - ramp(age, 0.6, 1.2)), 1);
    }
  }
  // The flare, the flames on it, sparks up.
  if (front && seenAt(s, b, view, add(at, [0, 0, 0.2]))) flash(g, view, add(at, [0, 0, 0.2]), 1.1 * big, hump(since, 0.05, 0.14));
  const burn = (1 - ramp(since, 0.4, 0.75)) * ramp(since, 0, 0.04);
  for (let q = 0; q < 6; q++) {
    const fl = 0.7 + 0.3 * Math.sin(since * 38 + q * 1.9);
    const p: V3 = [(q - 2.5) * 0.17 * big, yc, top + 0.6 * big * fl * burn * (1 - 0.25 * Math.abs(q - 2.5) / 2.5)];
    const [x, y] = onScreen(view, p);
    if ((nearSide(p, mid, view) || clear(x, y)) !== front) continue;
    flame(g, x, y, (0.3 + 0.12 * fl) * big * burn, 0.75 * fl, burn);
  }
  // Tongues licking up off it, one after another, shrinking as they go: three small ones, 0.9 of a spark's size up off it.
  for (let q = 0; q < 3; q++) {
    const u = frac(since / 0.24 + q / 3), p: V3 = [Math.sin(q * 2.4 + since * 20) * 0.1 * big, yc, top + 0.3 * big + 0.9 * big * u];
    const [x, y] = onScreen(view, p);
    if ((nearSide(p, mid, view) || clear(x, y)) !== front) continue;
    flame(g, x, y, (0.34 - 0.1 * u) * big * burn, 0.85 - 0.4 * u, burn * (1 - u ** 4));
  }
  // As it catches, the whoomp of it: one flame leaping up off it, as high as it must be to show 0.6 of a spark's size over its
  // crest from where it is seen, and no higher; from where the fuel is in sight, no leap at all.
  const leap = 1 - ramp(since, 0.15, 0.45);
  if (leap > 0 && burn > 0) {
    const near = nearSide([0, yc, top], mid, view);
    let need = 0;
    if (!near) {
      need = ROOF[s.stage] - top;
      for (let h = 0; h <= ROOF[s.stage] - top; h += 0.25) {
        const [x, y] = onScreen(view, [0, yc, top + h]);
        if (clear(x, y)) { need = h; break; }
      }
    }
    // Drawn with the body when the fuel is before it. Behind it when beyond it, so it is seen only where it is over its crest; and
    // then only its top is drawn, from a little under the crest, so what is seen over it is the full body of a flame, not a faint tip.
    const z0 = near ? top * 0.6 : top + Math.max(0, need - 0.4 * big), zt = top + lerp(0.9 * big, need + 0.6 * big, leap);
    const tall = (zt - z0) * (0.4 + 0.6 * ramp(since, 0, 0.08));
    if (near === front) leapFlame(g, view, [0, yc, z0], tall, big, since, burn * Math.min(1, 2 * leap), near ? undefined : (top + need - z0) / tall);
  }
  // Sparks, four of them thrown high, up well over the top of its shell, so the catch is seen from behind it.
  burst(g, view, s, b, clear, at, [0, 0.2, 0], since, 14, 2.4 + 0.6 * s.stage, front, 21, { n: 4, k: 3.4, lo: shellTop + 1.2, hi: Math.min(shellTop + 2.2, ROOF[s.stage]) });
  shellEmbers(g, view, s, b, since, 6 + 2 * s.stage, 1.0, 0.9, front, 31, 1.8);
}

/**
 * Evolving: at the start a burst of glowing smoke and embers out of it, thick enough to cover the change of body, thinning by a
 * quarter of the way through; then embers going up round it in a spiral, wide at its feet and gathering in as they rise; at the
 * flash sparks popping off the top of its shell, whose fire has been growing all the while.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Slug, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(s, b), since = t * ACT_SECS.evolve;
  const tall = b.head.t[2] + s.head.r[2] + s.tent.len;
  const cloud = (1 - ramp(t, 0.06, 0.24)) * ramp(t, 0, 0.015);
  if (cloud > 0) {
    for (let q = 0; q < 11; q++) {
      const a = (q / 11) * TAU + 0.3, h = tall * (0.12 + 0.6 * jitter(q + 2));
      const r = (0.5 + 0.6 * jitter(q + 5)) * s.foot.tail * 0.6 + since * 1.2;
      const c: V3 = [Math.cos(a) * r * 0.6, mid[1] + Math.sin(a) * r, h + since * 1.4];
      if (nearSide(c, mid, view) !== front) continue;
      const [x, y] = onScreen(view, c);
      const rr = (1.3 + 0.7 * jitter(q)) * big * (1 + 0.6 * s.stage) + since * 2;
      const grad = g.createRadialGradient(x, y, 0, x, y, rr);
      grad.addColorStop(0, css(q % 2 ? [255, 214, 150] : [250, 150, 80], 0.92 * cloud));
      grad.addColorStop(0.55, css(q % 2 ? [252, 196, 132] : [240, 136, 70], 0.6 * cloud));
      grad.addColorStop(1, css([240, 140, 80], 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.fill();
    }
    for (let q = 0; q < 24; q++) {
      const th = (q / 24) * TAU * 2.3 + jitter(q) * 0.7;
      const from: V3 = [Math.cos(th) * 0.4, mid[1] + Math.sin(th) * 0.4, tall * (0.2 + 0.5 * jitter(q + 40))];
      const p = thrown(from, [Math.cos(th) * (2.4 + 2 * jitter(q + 3)), Math.sin(th) * (2.4 + 2 * jitter(q + 5)), 1.8 + 2.4 * jitter(q + 7)], since, 3);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      ember(g, x, y, 0.08 * big * (0.5 + 0.5 * cloud), cloud);
    }
  }
  // The swirl of embers.
  const fade = ramp(t, 0.1, 0.22) * (1 - ramp(t, 0.74, 0.96));
  const wide = s.foot.tail * 0.55 + 0.6;
  for (let q = 0; q < 18; q++) {
    const rise = frac(t * 1.2 + q / 18), ang = (q / 18) * TAU * 3 + t * TAU * 1.5;
    const r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r * 0.8, mid[1] + Math.sin(ang) * r, rise * tall * 1.05];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    ember(g, x, y, 0.08 * big * Math.sin(rise * Math.PI) * fade, 0.5 + 0.5 * Math.sin(rise * Math.PI));
  }
  // At the flash, sparks popping off the top of the shell, up and out past it.
  const pop = (t - 0.5) * ACT_SECS.evolve;
  if (pop > 0) burst(g, view, s, b, crestOf(s, b, view), place(b.shell, [0, 0, s.shell.R * 0.9]), [0, 0, 0], pop, 18, 2.4, front, 61);
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A colour pushed further from its own grey: a spot that reads as orange at the size it is played at, and not as a smudge. */
const richer = (c: RGB, k = 1.2): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, its glow, and what it throws about as it strikes, stokes and evolves. */
function slugKind(s: Slug): Kind {
  const bones = slugBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: SLUG_HITS[s.stage] } });
  const atFlame = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: (SLUG_FLAME[0] + SLUG_FLAME[1]) / 2 } });
  const G = geoOf(s);
  return {
    bones,
    build: (lod) => slugBuild(s, lod),
    // The variant's coat for its body, a soft cream; its markings for its spots, as rich as they go, with an orange and a grey-brown
    // beside them. Its shell's bands, its sacs, its bulbs and its fire are the same on every variant.
    palette: (coat, mark) => {
      // Warm, and a little under the lightest a lit face is drawn at, so its shade is a warm cream and not a lavender grey.
      const body = mix(coat, [246, 200, 150], 0.5), spot = richer(mix(mark, [255, 240, 220], 0.06), 1.15);
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: darker(body, 0.18),
        coatLight: mix(body, [252, 226, 194], 0.35),
        belly: mix(body, [255, 226, 196], 0.35),
        mark: spot,
        spot: richer(mix(spot, [236, 118, 52], 0.55), 1.1),
        stone: mix(mix(spot, [140, 118, 104], 0.7), body, 0.1),
        nose: [96, 56, 50],
        lid: [80, 50, 46],
        eye: [28, 20, 24],
        glint: [255, 253, 246],
        shell: [248, 222, 186],
        shellDark: [152, 122, 104],
        hornDark: [110, 76, 58],
        horn: [240, 132, 58],
        crystal: [246, 178, 72],
        ember: [255, 124, 36],
        flame: [255, 196, 70],
        bloom: [255, 238, 168],
        feather: [246, 168, 120],
        featherDark: [240, 146, 96],
        petal: [240, 150, 60],
        membrane: [255, 176, 82],
        moss: [255, 198, 112],
        bill: [255, 170, 90],
      }, 30);
    },
    shadow: [(G.ny[0] + G.nd[0] - G.yt) * 0.55, s.foot.w + s.skirt[0] * 0.8],
    stride: 1,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are embers: amber and ember orange.
    motes: [[255, 184, 72], [255, 116, 40]],
    extra: (g, view, b, a, under) => {
      const front = !under, act = a.act;
      if (front) slugGlow(g, view, s, b, poseFor(s, a));
      // The Slugferno's shell smoulders as it goes and as it stands: an ember now and then going up off it.
      if (s.stage === 2 && !act) {
        // Rising slowly and not far, so they stay inside the picture it is kept as.
        const clock = a.go > 0 ? frac(a.u) : frac(a.t / 2) * 2;
        shellEmbers(g, view, s, b, clock, 3, a.go > 0 ? 1 : 2, 0.7, front, 91, a.go > 0 ? 0.5 : 0.25);
      }
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), atFlame(a), act.t, front);
      else if (act.kind === 'work') workSpray(g, view, s, b, a, act.t, front, (u) => bones({ ...a, act: { kind: 'work', t: u } }));
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SLUGLOW = slugKind(SLUGLOW_LOOK);
export const SLUGEMBER = slugKind(SLUGEMBER_LOOK);
export const SLUGFERNO = slugKind(SLUGFERNO_LOOK);
