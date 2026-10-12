import { rnd, type Ctx, type LifePiece } from './kit';

/** How steeply the sun comes down from the top left, in radians below the level. */
const SLANT = 0.98;
/** Seconds in one round of the sky: in most rounds one cloud crosses the sun. */
const SKY = 17;
/** Specks of dust adrift in the beam. */
const MOTES = 24;
/** Seconds between glints on the spine's gold, when the sun is out to strike them. */
const GLINT = 5.5;
/** Seconds a glint lasts. */
const GLINT_FOR = 0.9;
/** How far the light runs on past where it lands, onto the leather, in bands (F). */
const ON = 0.85;

/** How far up toward the sun the beam reaches, in bands (F). */
const TOP = 3.1;
/** How far up the brighter light starts, in bands (F): above it only the faint haze is drawn. */
const RISE = 2.2;

/**
 * The faint haze the whole beam stands in, as [bands up from where it lands, half width in
 * bands]: a long taper from a fine tip up toward the sun, full width over the last stretch
 * of air, narrowing again to a blunt foot on the leather. One flat fill.
 */
const HAZE: Array<[number, number]> = [[TOP, 0.06], [TOP * 0.42, 0.66], [0, 0.76], [-ON * 0.6, 0.72], [-ON, 0.34]];
/** How strong the haze is at full sun. */
const HAZE_K = 0.085;

/**
 * The brighter rays inside the haze, in bands (F): `v` across from the beam's middle line,
 * `half` their half width where they land, and which fill they are drawn in, `fill`: 0 the
 * broad one, a gradient down the beam from nothing at `RISE` to brightest just above the
 * leather and out to nothing on it; 1 the two fine ones together, flat and tapered.
 */
const RAYS: Array<{ v: number; half: number; fill: number }> = [
  { v: 0, half: 0.56, fill: 0 },
  { v: -0.22, half: 0.24, fill: 1 },
  { v: 0.62, half: 0.12, fill: 1 },
];
/** Each fill's strength at full sun. */
const FILLS = [0.32, 0.13];

/** The rays' strength down the beam, as [bands up from where it lands, share of full]; the gradient's stops too. */
const ALONG: Array<[number, number]> = [[RISE, 0], [RISE * 0.5, 0.45], [0.1, 1], [-ON, 0]];

/** A piecewise line through `pts` (first coordinate falling) at `s`, or 0 past its ends. */
function through(pts: Array<[number, number]>, s: number): number {
  if (s > pts[0][0] || s < pts[pts.length - 1][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [s0, a0] = pts[i - 1], [s1, a1] = pts[i];
    if (s >= s1) return a0 + ((a1 - a0) * (s0 - s)) / (s0 - s1);
  }
  return 0;
}

/**
 * Add a ray to the path, in the beam's own frame (x down the beam): centred `c` across, `hw`
 * half wide where it lands, `F` the band. The broad ray is square-ended from `RISE` down to
 * `ON` past where it lands, its gradient fading both ends; a fine one (`fine`), drawn flat,
 * closes instead to a point up at `RISE` and to another a little way onto the leather.
 */
function ray(g: Ctx, c: number, hw: number, F: number, fine: boolean): void {
  if (!fine) {
    const ht = hw * spread(RISE) * F, he = hw * spread(-ON) * F;
    g.moveTo(-RISE * F, c - ht);
    g.lineTo(ON * F, c - he);
    g.lineTo(ON * F, c + he);
    g.lineTo(-RISE * F, c + ht);
  } else {
    const hm = hw * spread(RISE * 0.5) * F;
    g.moveTo(-RISE * F, c);
    g.lineTo(-RISE * 0.5 * F, c - hm);
    g.lineTo(0, c - hw * F);
    g.lineTo(ON * 0.6 * F, c);
    g.lineTo(0, c + hw * F);
    g.lineTo(-RISE * 0.5 * F, c + hm);
  }
  g.closePath();
}

/** How wide a ray is `s` bands up from where it lands, as a share of its width there: a little narrower toward the sun. */
const spread = (s: number): number => 1 - (0.28 * s) / TOP;

/**
 * The sun's strength now, about 0.3..1: a slow shimmer, and in most rounds of `SKY` a cloud
 * that dims it for a few seconds and lets it back. `lag` seconds later for a ray further
 * along the cloud's path, so the shadow sweeps across the beam rather than blinking it.
 */
function sun(t: number, seed: number, lag: number): number {
  const s = t - lag, n = Math.floor(s / SKY), u = s / SKY - n;
  const deep = rnd(seed + n, 3) < 0.8 ? 0.3 + 0.35 * rnd(seed + n, 4) : 0;
  const at = 0.38 + 0.24 * rnd(seed + n, 5), span = 0.12 + 0.1 * rnd(seed + n, 6);
  const d = Math.abs(u - at) / span;
  const cloud = d < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * d) : 0;
  const shimmer = 0.05 * Math.sin(t * 0.83 + seed) + 0.04 * Math.sin(t * 1.61 + seed * 2.3);
  return 0.9 + shimmer - deep * cloud;
}

/** Strength steps the dust is drawn in, each speck rounded to the nearest, so each step is one fill. */
const SHADES = 4;

/**
 * A shaft of afternoon sun falling across the journal's top left corner: a faint haze and
 * three rays slanting down onto the spine's head, a warm pool on the leather where they
 * land, the light breathing with the sky and dimming as a cloud's shadow sweeps across it. Dust
 * drifts and turns through it, seen only where the light catches it and flashing a tiny
 * cross as a speck turns its face to the sun; now and then the gold on the spine glints.
 * It lands on the band, never reaching the page. Kept to a handful of fills, one gradient
 * among them, since it is on every journal window every frame.
 */
export function sunbeam(g: Ctx, p: LifePiece, t: number): void {
  const { F, h, seed } = p;
  const ax = Math.cos(SLANT), ay = Math.sin(SLANT);
  // Where the beam lands: the spine's head, over its first gilt band.
  const ex = F * 0.3, ey = F * 0.3;
  // Each fill's strength: the cloud reaches the fine rays a little after the broad one, so its
  // shadow sweeps across the beam, and they wax and wane on their own as well. Where each ray
  // lies across the beam, the fine ones swaying a little.
  const lit = [sun(t, seed, 0), sun(t, seed, 0.8) * (0.75 + 0.25 * Math.sin(t * 0.37 + seed))];
  const mid: number[] = [];
  for (let i = 0; i < RAYS.length; i++) mid.push((RAYS[i].v + (i ? 0.07 * Math.sin(t * (0.21 + 0.08 * i) + seed * 1.7 + i) : 0)) * F);

  // Laid along the slant (x down the beam, y across it): the haze, then the rays over it.
  g.save();
  g.translate(ex, ey);
  g.rotate(SLANT);
  g.fillStyle = `rgba(255, 200, 106, ${HAZE_K * lit[0]})`;
  g.beginPath();
  for (const [s, w] of HAZE) g.lineTo(-s * F, w * F);
  for (let k = HAZE.length - 1; k >= 0; k--) g.lineTo(-HAZE[k][0] * F, -HAZE[k][1] * F);
  g.fill();
  const f = g.createLinearGradient(-RISE * F, 0, ON * F, 0);
  for (const [s, k] of ALONG) f.addColorStop((RISE - s) / (RISE + ON), `rgba(255, ${Math.round(200 + 40 * k)}, ${Math.round(100 + 82 * k)}, ${k})`);
  g.fillStyle = f;
  // The broad ray: the one fill with a gradient.
  g.globalAlpha = FILLS[0] * lit[0];
  g.beginPath();
  ray(g, mid[0], RAYS[0].half, F, false);
  g.fill();
  g.globalAlpha = 1;
  // The fine rays and the pool where the beam lands, spread along the leather, in one flat
  // fill; then the pool's brighter middle.
  g.fillStyle = `rgba(255, 224, 144, ${FILLS[1] * lit[1]})`;
  g.beginPath();
  for (let i = 1; i < RAYS.length; i++) ray(g, mid[i], RAYS[i].half, F, true);
  g.moveTo(F * 0.71, 0);
  g.ellipse(F * 0.05, 0, F * 0.66, F * 0.38, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(255, 232, 170, ${0.1 * lit[0]})`;
  g.beginPath();
  g.ellipse(F * 0.05, 0, F * 0.4, F * 0.23, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  /** How lit a point is, about 0..1: `s` up the beam from where it lands, `v` across it, both in px. */
  const light = (s: number, v: number): number => {
    const u = s / F;
    let sum = Math.abs(v) < through(HAZE, u) * F ? HAZE_K * lit[0] : 0;
    const a = through(ALONG, u);
    if (a > 0) for (let i = 0; i < RAYS.length; i++) if (Math.abs(v - mid[i]) < RAYS[i].half * spread(u) * F) sum += FILLS[RAYS[i].fill] * lit[RAYS[i].fill] * a;
    return sum / 0.3;
  };

  // The dust: each speck sinks slowly down the beam and drifts across it, wandering on slow
  // sines. Specks the light misses are skipped before anything is drawn; the rest are sorted
  // into strength steps, each step one colour: a small blob each, and a tiny cross while one
  // turns to the sun. A speck is two crossed bars, so it reads round, brighter at its middle.
  const lo = -(ON + 0.2) * F, hi = (TOP + 0.2) * F, tall = hi - lo, wide = F * 2.4;
  const dots: number[][] = [], arms: number[][] = [];
  for (let k = 0; k < SHADES; k++) {
    dots.push([]);
    arms.push([]);
  }
  /** The strength step for `k` (0..1), or -1 if too faint to draw. */
  const shade = (k: number): number => Math.min(SHADES - 1, Math.round(k * SHADES) - 1);
  for (let i = 0; i < MOTES; i++) {
    const a = rnd(seed, i * 7 + 1), b = rnd(seed, i * 7 + 2), c = rnd(seed, i * 7 + 3), e = rnd(seed, i * 7 + 4);
    const sink = F * (0.03 + 0.05 * b), drift = F * (0.02 + 0.04 * c) * (e < 0.5 ? 1 : -1);
    const s = hi - ((((e * tall + sink * t) % tall) + tall) % tall) + Math.sin(t * (0.23 + 0.17 * a) + i * 2.1) * F * 0.14;
    const v = ((((a * wide + drift * t) % wide) + wide) % wide) - wide * 0.45
      + Math.sin(t * (0.31 + 0.2 * c) + i) * F * 0.08 + Math.sin(t * 0.67 + i * 3.3) * F * 0.03;
    const shine = light(s, v);
    if (shine < 0.05) continue;
    const face = Math.pow(Math.abs(Math.cos(t * (0.6 + 1.2 * c) + i * 1.9)), 10);
    const k = Math.min(1, shine * 1.2) * (0.55 + 0.45 * face);
    const x = ex - ax * s - ay * v, y = ey - ay * s + ax * v, r = 0.5 + 0.7 * a * a * a;
    const d = shade(k), f = shade(k * face * 0.55);
    if (d >= 0) dots[d].push(x, y, r);
    if (f >= 0) arms[f].push(x, y, r * (1.3 + 1.3 * face));
  }
  for (let k = 0; k < SHADES; k++) {
    if (!dots[k].length && !arms[k].length) continue;
    g.fillStyle = `rgba(255, 248, 222, ${(k + 1) / SHADES})`;
    for (let m = 0; m < dots[k].length; m += 3) {
      const x = dots[k][m], y = dots[k][m + 1], r = dots[k][m + 2];
      g.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
      g.fillRect(x - r * 0.6, y - r, r * 1.2, r * 2);
    }
    for (let m = 0; m < arms[k].length; m += 3) {
      const x = arms[k][m], y = arms[k][m + 1], r = arms[k][m + 2];
      g.fillRect(x - r, y - 0.3, r * 2, 0.6);
      g.fillRect(x - 0.3, y - r, 0.6, r * 2);
    }
  }

  // A glint on the spine's gold, where `PAINTERS.book` lays it: its first band's gilt lines or the star under them.
  const n = Math.floor((t + seed * 3) / GLINT), u = (t + seed * 3) / GLINT - n;
  const q = ((u - (0.25 + 0.5 * rnd(seed + n, 13))) * GLINT) / GLINT_FOR;
  if (q <= 0 || q >= 1) return;
  const len = h + F * 0.56, y0 = -F * 0.28, band = y0 + len * 0.06, gilt = F * 0.42 * 0.22;
  const pick = rnd(seed + n, 11), side = rnd(seed + n, 12) - 0.5;
  const gx = pick < 0.3 ? F * 0.1 : ex + side * F * 0.9;
  const gy = pick < 0.3 ? y0 + len * 0.11 : band + (pick < 0.65 ? -gilt : gilt);
  const gs = (ey - gy) * ay + (ex - gx) * ax, gv = (gy - ey) * ax - (gx - ex) * ay;
  const on = Math.min(1, light(gs, gv) * 1.6) * (q < 0.25 ? q / 0.25 : (1 - q) / 0.75);
  if (on > 0.05) sparkle(g, gx, gy, F * 0.3 * (0.5 + 0.5 * Math.sin(q * Math.PI)), q * 0.5, on);
}

/** A four-pointed sparkle at (x, y), `r` long, turned `a`, `k` strong, on a faint round of light. */
function sparkle(g: Ctx, x: number, y: number, r: number, a: number, k: number): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = `rgba(255, 236, 170, ${0.22 * k})`;
  g.beginPath();
  g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  g.fill();
  g.rotate(a);
  g.fillStyle = `rgba(255, 252, 232, ${k})`;
  g.beginPath();
  const n = r * 0.16;
  g.moveTo(0, -r);
  g.lineTo(n, -n);
  g.lineTo(r, 0);
  g.lineTo(n, n);
  g.lineTo(0, r);
  g.lineTo(-n, n);
  g.lineTo(-r, 0);
  g.lineTo(-n, -n);
  g.closePath();
  g.fill();
  g.restore();
}
