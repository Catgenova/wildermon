import { SIZE, clamp01, ease, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/**
 * The hedgehog on the Health window's foot: curled up asleep in its spines,
 * breathing, with a small "z" going up now and then; and every so often it
 * uncurls, trundles a little way along the birch on pattering feet, stops to
 * sniff with its nose going, and trundles back to curl up again. By day it
 * mostly sleeps; after dark, as hedgehogs do, it is up and about more.
 *
 * Time is cut into rounds of `ROUND` seconds, each planned from its own
 * number, so it is wherever it would be at that moment however often it is
 * drawn, and nothing is kept between frames.
 */

/** Seconds in one round: asleep, waking, out, sniffing, back and curling up. */
const ROUND = 36;

/** How big it is drawn, against the units its shapes are written in. */
const U = SIZE * 0.95;

/** Walking pace, interface px per second, and steps a second. */
const PACE = 7;
const STEPS = 6;

/** Seconds to uncurl, and to curl up again. */
const UNCURL = 1.1;

interface Pose {
  x: number;
  /** Facing: 1 right, -1 left. */
  dir: number;
  /** Curled, 0 (out and about) to 1 (a ball). */
  curl: number;
  /** Steps taken, for the feet. */
  gait: number;
  /** Nose going, 0..1. */
  sniff: number;
  /** Breath, -1..1. */
  breath: number;
  /** How far up a "z" is, 0..1, or below 0 for none. */
  z: number;
}

/** Where it sleeps and how far it goes: a stretch of the foot beam left of the medallion. */
function beat(p: LifePiece): [number, number] {
  const { w, F } = p;
  const lo = F * 2.6, hi = Math.max(lo + F, w / 2 - F * 2.2);
  return [lo, hi];
}

function pose(p: LifePiece, t: number, night: boolean): Pose {
  const [lo, hi] = beat(p);
  const k = Math.floor(t / ROUND), s = t - k * ROUND;
  const home = lerp(lo, hi, 0.15 + 0.2 * rnd(k * 1.7, p.seed));
  // Out in most rounds after dark; in one round in three by day.
  const out = rnd(k * 2.3 + 0.4, p.seed) < (night ? 0.85 : 0.35);
  const far = Math.min(hi, home + (hi - lo) * (0.35 + 0.45 * rnd(k * 3.1, p.seed)));
  const walk = (far - home) / PACE;
  const wake = 12 + 6 * rnd(k * 4.9, p.seed);
  const breath = Math.sin(t * 1.6 + p.seed);
  const P: Pose = { x: home, dir: 1, curl: 1, gait: 0, sniff: 0, breath, z: -1 };
  const zz = ((t + p.seed) % 4.5) / 4.5;
  if (!out || s < wake) {
    P.z = zz;
    return P;
  }
  let u = s - wake;
  if (u < UNCURL) {
    P.curl = 1 - ease(u / UNCURL);
    return P;
  }
  u -= UNCURL;
  P.curl = 0;
  if (u < walk) {
    P.x = lerp(home, far, u / walk);
    P.gait = u * STEPS;
    return P;
  }
  u -= walk;
  P.x = far;
  const sniffFor = 3 + 2 * rnd(k * 5.3, p.seed);
  if (u < sniffFor) {
    P.sniff = Math.sin(clamp01(u / sniffFor) * Math.PI);
    return P;
  }
  u -= sniffFor;
  P.dir = -1;
  if (u < walk) {
    P.x = lerp(far, home, u / walk);
    P.gait = u * STEPS;
    return P;
  }
  u -= walk;
  P.x = home;
  P.curl = ease(clamp01(u / UNCURL));
  if (u > UNCURL) P.z = zz;
  return P;
}

const DAY = { spine: '#7a5a3e', spineDeep: '#4e3826', spineTip: '#d8c6a4', face: '#e8d3b0', faceDeep: '#c4a882', nose: '#2a1d16', eye: '#1e1510', ink: '#3a2a1e', z: '#6d6a8a' };
const NIGHT = Object.fromEntries(Object.entries(DAY).map(([k, v]) => [k, underNight(v)])) as typeof DAY;

function draw(g: Ctx, p: LifePiece, P: Pose, t: number, c: typeof DAY): void {
  const y = p.h - p.F * 0.42;
  g.save();
  g.translate(P.x, y);
  g.scale(P.dir * U, U);
  const breathe = 1 + 0.035 * P.breath * (0.4 + 0.6 * P.curl);
  // Its shadow on the bark.
  g.fillStyle = 'rgba(40, 28, 20, 0.22)';
  g.beginPath();
  g.ellipse(0, 0.6, 6.5, 1.4, 0, 0, Math.PI * 2);
  g.fill();
  // Feet, pattering while it walks, tucked away when curled.
  if (P.curl < 0.6) {
    g.fillStyle = c.faceDeep;
    for (const [fx, ph] of [[-3, 0], [-1.2, 0.5], [2.2, 0.25], [3.8, 0.75]] as const) {
      const lift = P.gait ? Math.max(0, Math.sin((P.gait + ph) * Math.PI * 2)) * 0.8 : 0;
      g.beginPath();
      g.ellipse(fx, -0.4 - lift, 0.9, 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // The body: a mound of spines, rounder the more it is curled.
  const bw = lerp(7.2, 5.6, P.curl) * breathe, bh = lerp(4.6, 5.6, P.curl) * breathe;
  const by = -bh * 0.92;
  g.beginPath();
  g.ellipse(-0.6 * (1 - P.curl), by, bw, bh, 0, Math.PI, Math.PI * 2);
  g.ellipse(-0.6 * (1 - P.curl), by, bw, bh * (0.55 + 0.45 * P.curl), 0, 0, Math.PI);
  const f = g.createRadialGradient(-2, by - bh * 0.5, 0.5, 0, by, bw * 1.2);
  f.addColorStop(0, c.spine);
  f.addColorStop(1, c.spineDeep);
  g.fillStyle = f;
  g.fill();
  // The spines: short strokes over the back, pale at their tips.
  g.lineCap = 'round';
  for (let i = 0; i < 15; i++) {
    const a = Math.PI + (i / 14) * Math.PI * (0.92 + 0.08 * P.curl) + (P.curl ? -0.05 : 0);
    const r0x = bw * 0.82, r0y = bh * 0.82;
    const sx = -0.6 * (1 - P.curl) + Math.cos(a) * r0x, sy = by + Math.sin(a) * r0y;
    const ex = sx + Math.cos(a - 0.35) * 1.9, ey = sy + Math.sin(a - 0.35) * 1.9;
    g.strokeStyle = c.spineDeep;
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.stroke();
    g.strokeStyle = c.spineTip;
    g.lineWidth = 0.45;
    g.beginPath();
    g.moveTo(lerp(sx, ex, 0.55), lerp(sy, ey, 0.55));
    g.lineTo(ex, ey);
    g.stroke();
  }
  // The face: out in front while it is about, tucked in to a peeping nose when curled.
  const out = 1 - P.curl;
  const hx = lerp(bw * 0.55, bw * 0.95, out), hy = by + bh * lerp(0.35, 0.15, out);
  g.save();
  g.translate(hx, hy);
  g.rotate(-0.1 * P.sniff * Math.sin(t * 18));
  g.beginPath();
  g.moveTo(-1.8, -2.2);
  g.quadraticCurveTo(3.8 * (0.6 + 0.4 * out), -1.4, 4.4 * (0.55 + 0.45 * out), 0.2);
  g.quadraticCurveTo(1.4, 1.8, -1.8, 1.6);
  g.closePath();
  g.fillStyle = c.face;
  g.fill();
  g.strokeStyle = c.ink;
  g.lineWidth = 0.4;
  g.stroke();
  // Its nose, going while it sniffs, and an eye, shut while it is asleep.
  const nx = 4.4 * (0.55 + 0.45 * out), twitch = 0.25 * P.sniff * Math.sin(t * 22);
  g.fillStyle = c.nose;
  g.beginPath();
  g.arc(nx, 0.15 + twitch, 0.75, 0, Math.PI * 2);
  g.fill();
  if (out > 0.3) {
    g.beginPath();
    g.arc(1.4, -0.9, 0.5, 0, Math.PI * 2);
    g.fillStyle = c.eye;
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(0.9, -0.9);
    g.quadraticCurveTo(1.4, -0.5, 1.9, -0.9);
    g.strokeStyle = c.eye;
    g.lineWidth = 0.4;
    g.stroke();
  }
  g.restore();
  g.restore();
  // A little "z" floating up off it while it sleeps.
  if (P.z >= 0) {
    const zx = P.x + P.dir * 5 * U + P.z * 3, zy = y - 9 * U - P.z * 8;
    g.save();
    g.globalAlpha = Math.sin(Math.PI * P.z) * 0.85;
    g.fillStyle = c.z;
    g.font = `italic 700 ${(4 + P.z * 2.5) * U}px serif`;
    g.fillText('z', zx, zy);
    g.restore();
  }
}

export function hedgehog(g: Ctx, p: LifePiece, t: number, night = false): void {
  draw(g, p, pose(p, t + (p.seed % 23), night), t, night ? NIGHT : DAY);
}
