/**
 * Water thrown up and left on the surface by the body: what a swimmer's stroke, a hand treading water, a net lifted out,
 * an oar's blade and a fishing float do to it. In the water's own whites (`../water.ts` FOAM, the foam on the shores and
 * the wakes) and its blues (`WATER_TURQUOISE`, `WATER_TEAL`), let down toward the night's blue after dark.
 *
 *   - `splash`: drops off a swimmer's hand at the catch and as it comes forward again (`../../sculpt/anim/clips/swim.ts`),
 *     and a ring on the water where it went in.
 *   - `flick`: drops off a hand at the breath.
 *   - `ripple`: two soft rings, one inside the other, opening out where a hand treading water reached the end of its sweep.
 *   - `netdrops`: a sheet of drops falling from a net's bag (`../../sculpt/anim/clips/net.ts`) to the water under it, and
 *     rings where they land.
 *   - `oar`: drops off a blade going in (`./rowing.ts`); the rings round it are the oar's own (`../figure.ts` oar).
 *   - `swirl`: the pair of small whirls a blade leaves where it pulled, turning and fading.
 *   - `plop`, `bob`, `pop`, `catch`: a fishing float landing, a ring off it as it bobs, it jerked up at the strike, and a
 *     fish brought out: a splash, the fish flipping over on its way to the angler, and a spray of drops after it catching
 *     the light (`./fishing.ts`).
 *
 * Every ring lies on the water at the height it was fired at (a swimmer's level, a boat's waterline, the surface under a
 * float), sorted with the body it is by just before the body, so it goes down under whatever of the body is over it.
 */
import { FOAM, WATER_TEAL, WATER_TURQUOISE } from '../water';
import { TAU, arcAt, type P3 } from '../spells/kit';
import { hexOf, mixHex } from './material';
import type { ActionKit } from './kit';
import type { ActionFxFn } from './registry';
import type { FxEvent } from './types';

/** A number from an effect's params, or the default. */
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Drops a swimmer's catch throws up, before the level of detail; and those flicked off a hand at the breath. */
export const SPLASH_DROPS = 7;
export const FLICK_DROPS = 4;
/** Drops falling off a net's bag lifted clear of the water. */
export const NET_DROPS = 16;
/** Drops off an oar's blade going in. */
export const OAR_DROPS = 5;
/** Seconds a whirl left by an oar lasts. */
export const SWIRL_SECS = 1.5;
/** Seconds a ring on the water lasts: a splash's, a ring off a hand treading water, a float's. */
export const SPLASH_RING_SECS = 0.8;
export const TREAD_RING_SECS = 1.6;
export const FLOAT_RING_SECS = 1.2;
/** Seconds a caught fish takes from the water to the angler. */
export const CATCH_SECS = 0.75;
/** Drops a fish brought out throws up at the float. */
export const CATCH_DROPS = 12;

/** The night's blue the water's whites are let down toward after dark, and how far at the dead of night. */
const NIGHT_WATER = '#1c2c40', NIGHT_DIM = 0.55;
const WHITE = hexOf(FOAM), PALE = mixHex(WHITE, hexOf(WATER_TURQUOISE), 0.35), BLUE = mixHex(WHITE, hexOf(WATER_TEAL), 0.55);
/** A caught fish's back and its belly. */
const FISH_BACK = '#56707c', FISH_BELLY = '#c9d4d6';

/** The water's colours of drops, at this hour. */
function dropsOf(k: ActionKit): string[] {
  const d = k.night * NIGHT_DIM;
  return [WHITE, PALE, BLUE].map((c) => (d > 0.01 ? mixHex(c, NIGHT_WATER, d) : c));
}
/** The water's white, at this hour, as 'rgb()' with an alpha, for a ring. */
function whiteAt(k: ActionKit, alpha: number): string {
  const c = mixHex(WHITE, NIGHT_WATER, k.night * NIGHT_DIM), n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(3)})`;
}

/**
 * Rings lying on the water round `c` (its z the water's height): each `r` tiles across, `alpha`, `width` pixels at zoom
 * one; sorted with the body the event is at (just before it, under what of it is over the water), else where they are.
 */
function rings(k: ActionKit, e: FxEvent, c: P3, rs: ReadonlyArray<{ r: number; alpha: number; width: number }>, near = true): void {
  const live = rs.filter((q) => q.r > 0.002 && q.alpha > 0.01);
  if (!live.length) return;
  const eye = k.eye, N = 18, paths: Array<{ pts: number[]; alpha: number; width: number }> = [];
  for (const q of live) {
    const pts: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, x = c.x + Math.cos(a) * q.r, y = c.y + Math.sin(a) * q.r;
      pts.push(eye.worldToScreenX(x, y), eye.worldToScreenY(x, y, c.z));
    }
    paths.push({ pts, alpha: q.alpha, width: q.width });
  }
  // sorted as the body it is by stands (or as itself at the water's height), a pixel before
  const at = near ? { x: e.body.x, y: e.body.y, z: e.body.z } : c;
  const bias = eye.worldToScreenY(at.x, at.y, at.z) - eye.worldToScreenY(at.x, at.y, k.ground(at.x, at.y)) - 1;
  const zoom = k.zoom, colour = whiteAt(k, 1);
  k.worldDraw(at, (g) => {
    g.strokeStyle = colour;
    g.lineCap = 'round';
    for (const p of paths) {
      g.globalAlpha = p.alpha;
      g.lineWidth = Math.max(0.6, p.width * zoom);
      g.beginPath();
      for (let i = 0; i < p.pts.length; i += 2) (i ? g.lineTo(p.pts[i], p.pts[i + 1]) : g.moveTo(p.pts[i], p.pts[i + 1]));
      g.closePath();
      g.stroke();
    }
    g.globalAlpha = 1;
    g.lineCap = 'butt';
  }, bias);
}

/** A ring opening out from `r0` to `r1` tiles over its life, coming up over the first fifth and fading after. */
const opening = (u: number, r0: number, r1: number, alpha: number, width: number): { r: number; alpha: number; width: number } => ({
  r: r0 + (r1 - r0) * (1 - (1 - u) * (1 - u)),
  alpha: alpha * Math.min(1, u / 0.2) * Math.pow(Math.max(0, 1 - u), 1.4),
  width: width * (1 - 0.5 * u),
});

/** The way along the ground a point was going (`FxEvent.way`), or none. */
function heading(e: FxEvent): { x: number; y: number } | undefined {
  const w = e.way;
  if (!w) return undefined;
  const l = Math.hypot(w.x, w.y);
  return l > 1e-6 ? { x: w.x / l, y: w.y / l } : undefined;
}

const splash: ActionFxFn = (e, k) => {
  const n = num(e.params.n, SPLASH_DROPS), big = n / SPLASH_DROPS;
  k.burst(e.at, n, { kind: 'drop', colour: dropsOf(k), size: 1.3, sizeEnd: 0.9, life: [0.2, 0.36], speed: [0.06, 0.24], up: [7, 15], gravity: 80, drag: 0.5, heading: heading(e), cone: 2.6, jitter: 0.02 });
  return { secs: SPLASH_RING_SECS, draw: (kk, u) => rings(kk, e, e.at, [opening(u, 0.02, 0.07 + 0.05 * big, 0.55, 0.55)]) };
};

const flick: ActionFxFn = (e, k) => {
  // off the hand over the water, a little up and out the way it was going
  const at: P3 = { x: e.at.x, y: e.at.y, z: e.at.z + 1.5 };
  k.burst(at, num(e.params.n, FLICK_DROPS), { kind: 'drop', colour: dropsOf(k), size: 1, sizeEnd: 0.7, life: [0.18, 0.3], speed: [0.1, 0.25], up: [3, 9], gravity: 80, drag: 0.6, heading: heading(e), cone: 1.4, small: true });
};

const ripple: ActionFxFn = (e) => ({
  secs: TREAD_RING_SECS,
  // two, one inside the other, the inner a quarter of the ring's life behind
  draw: (k, u) => rings(k, e, e.at, [opening(u, 0.02, 0.17, 0.32, 0.5), ...(u > 0.25 ? [opening((u - 0.25) / 0.75, 0.01, 0.1, 0.26, 0.45)] : [])]),
});

const netdrops: ActionFxFn = (e, k) => {
  // from across the bag, down to the water under it: as long as a drop takes to fall that far
  const w = k.water(e.at.x, e.at.y), fall = w === null ? 6 : Math.max(1, e.at.z - w), secs = Math.sqrt((2 * fall) / 70);
  k.burst(e.at, num(e.params.n, NET_DROPS), { kind: 'drop', colour: dropsOf(k), size: 1.1, sizeEnd: 0.9, life: [secs * 0.8, secs], speed: [0, 0.04], up: [-3, 0], gravity: 70, drag: 0.8, jitter: 0.1, jitterZ: 0.6 });
  if (w === null) return;
  // three rings where the most of them land, about under the bag
  const spots: P3[] = [0, 1, 2].map(() => ({ x: e.at.x + (k.rand() - 0.5) * 0.18, y: e.at.y + (k.rand() - 0.5) * 0.18, z: w }));
  return {
    secs: secs + SPLASH_RING_SECS,
    draw: (kk, u) => {
      const t = u * (secs + SPLASH_RING_SECS) - secs;
      if (t < 0) return;
      spots.forEach((c, i) => rings(kk, e, c, [opening(Math.min(1, (t / SPLASH_RING_SECS) * (1 + 0.2 * i)), 0.01, 0.06, 0.4, 0.45)], false));
    },
  };
};

const oar: ActionFxFn = (e, k) => {
  k.burst(e.at, num(e.params.n, OAR_DROPS), { kind: 'drop', colour: dropsOf(k), size: 1.1, sizeEnd: 0.8, life: [0.2, 0.32], speed: [0.05, 0.2], up: [6, 12], gravity: 80, drag: 0.5, jitter: 0.03 });
};

const swirl: ActionFxFn = (e, k) => {
  // a pair, at either end of the blade along the oar (`FxEvent.way`, outboard), turning opposite ways
  const h = heading(e) ?? { x: 1, y: 0 }, half = 0.07, turn = k.rand() * TAU;
  const zoom = k.zoom;
  return {
    secs: SWIRL_SECS,
    draw: (kk, u) => {
      const a = 0.42 * Math.min(1, u / 0.12) * Math.pow(1 - u, 1.3);
      if (a < 0.01) return;
      const eye = kk.eye, paths: number[][] = [];
      for (const s of [-1, 1]) {
        const cx = e.at.x + h.x * half * s, cy = e.at.y + h.y * half * s, pts: number[] = [];
        // a spiral of a turn and a quarter, opening out and turned on as it goes
        for (let i = 0; i <= 14; i++) {
          const f = i / 14, th = turn + s * (f * 1.25 * TAU + u * 3), r = (0.012 + 0.05 * f) * (1 + 0.6 * u);
          pts.push(eye.worldToScreenX(cx + Math.cos(th) * r, cy + Math.sin(th) * r), eye.worldToScreenY(cx + Math.cos(th) * r, cy + Math.sin(th) * r, e.at.z));
        }
        paths.push(pts);
      }
      const bias = eye.worldToScreenY(e.at.x, e.at.y, e.at.z) - eye.worldToScreenY(e.at.x, e.at.y, kk.ground(e.at.x, e.at.y)) - 1;
      const colour = whiteAt(kk, 1);
      kk.worldDraw(e.at, (g) => {
        g.strokeStyle = colour;
        g.globalAlpha = a;
        g.lineWidth = Math.max(0.6, 0.5 * zoom * (1 - 0.4 * u));
        g.lineCap = 'round';
        for (const p of paths) {
          g.beginPath();
          for (let i = 0; i < p.length; i += 2) (i ? g.lineTo(p[i], p[i + 1]) : g.moveTo(p[i], p[i + 1]));
          g.stroke();
        }
        g.globalAlpha = 1;
        g.lineCap = 'butt';
      }, bias);
    },
  };
};

const plop: ActionFxFn = (e, k) => {
  k.burst(e.at, 4, { kind: 'drop', colour: dropsOf(k), size: 1, sizeEnd: 0.7, life: [0.18, 0.3], speed: [0.03, 0.12], up: [5, 10], gravity: 80, drag: 0.5 });
  return { secs: FLOAT_RING_SECS, draw: (kk, u) => rings(kk, e, e.at, [opening(u, 0.02, 0.14, 0.5, 0.5), ...(u > 0.2 ? [opening((u - 0.2) / 0.8, 0.01, 0.08, 0.35, 0.45)] : [])], false) };
};

const bob: ActionFxFn = (e) => ({ secs: FLOAT_RING_SECS, draw: (k, u) => rings(k, e, e.at, [opening(u, 0.015, 0.08, 0.3, 0.4)], false) });

const pop: ActionFxFn = (e, k) => {
  k.burst(e.at, 4, { kind: 'drop', colour: dropsOf(k), size: 1, sizeEnd: 0.7, life: [0.2, 0.32], speed: [0.02, 0.1], up: [8, 13], gravity: 80, drag: 0.5 });
  return { secs: SPLASH_RING_SECS, draw: (kk, u) => rings(kk, e, e.at, [opening(u, 0.02, 0.1, 0.45, 0.5)], false) };
};

const catchFish: ActionFxFn = (e, k) => {
  const to = e.to ?? { x: e.body.x, y: e.body.y, z: e.body.z + 12 };
  k.burst(e.at, CATCH_DROPS, { kind: 'drop', colour: dropsOf(k), size: 1.4, sizeEnd: 0.9, life: [0.28, 0.45], speed: [0.06, 0.25], up: [10, 20], gravity: 80, drag: 0.5, jitter: 0.03 });
  const zoom = k.zoom, lift = 10 + 0.4 * Math.hypot(to.x - e.at.x, to.y - e.at.y) * 10, spin = (k.rand() < 0.5 ? -1 : 1) * 2.5 * TAU;
  // the glints: the sun on the drops by day, faint at night
  const glint = 1 - 0.75 * k.night;
  return {
    secs: CATCH_SECS + SPLASH_RING_SECS,
    draw: (kk, u) => {
      const t = u * (CATCH_SECS + SPLASH_RING_SECS);
      rings(kk, e, e.at, [opening(Math.min(1, t / (SPLASH_RING_SECS + 0.3)), 0.03, 0.2, 0.55, 0.6)], false);
      const f = t / CATCH_SECS;
      if (f >= 1) return;
      const p = arcAt(e.at, to, f, lift), q = arcAt(e.at, to, Math.min(1, f + 0.03), lift);
      // the spray after it, a few drops a frame off its tail
      kk.emit(p, 40 * (1 - f), { kind: 'drop', colour: dropsOf(kk), size: 1, sizeEnd: 0.6, life: [0.2, 0.35], speed: [0.01, 0.06], up: [-2, 4], gravity: 60, drag: 0.6, small: true });
      if (glint > 0.05 && kk.rand() < 0.5) kk.flare({ x: p.x + (kk.rand() - 0.5) * 0.06, y: p.y + (kk.rand() - 0.5) * 0.06, z: p.z - kk.rand() * 3 }, 2.2, glint * (0.6 + 0.4 * kk.rand()), '#ffffff', kk.rand() * Math.PI, '#fff8e0');
      // the fish: a lozenge and a tail, along the way it goes on the screen, flipping over as it flies
      const sx = kk.sx(p), sy = kk.sy(p), ang = Math.atan2(kk.sy(q) - sy, kk.sx(q) - sx), flip = Math.cos(spin * f), L = 2.4 * zoom, W = 0.75 * zoom * Math.max(0.25, Math.abs(flip));
      const back = flip > 0 ? FISH_BACK : FISH_BELLY, belly = flip > 0 ? FISH_BELLY : FISH_BACK;
      kk.worldDraw(p, (g) => {
        g.save();
        g.translate(sx, sy);
        g.rotate(ang);
        g.fillStyle = belly;
        g.beginPath();
        g.ellipse(0, 0, L * 0.5, W, 0, 0, TAU);
        g.fill();
        g.fillStyle = back;
        g.beginPath();
        g.ellipse(0, -W * 0.25, L * 0.45, W * 0.6, 0, 0, TAU);
        g.moveTo(-L * 0.45, 0);
        g.lineTo(-L * 0.8, -W * 1.1);
        g.lineTo(-L * 0.8, W * 1.1);
        g.closePath();
        g.fill();
        g.restore();
      }, 4);
    },
  };
};

export const WATER_FX: Readonly<Record<string, ActionFxFn>> = { splash, flick, ripple, netdrops, oar, swirl, plop, bob, pop, catch: catchFish };
