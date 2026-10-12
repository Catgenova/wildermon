import { frameLamps } from '../runecut-frames';
import { SIZE, clamp01, ease, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * A moth at Crafting's lantern after dark: it loops round the flame in
 * fluttering, wandering circles, now and then darts at the glass and bounces
 * off it in a puff of wing dust, and most rounds settles on the hood, the beam
 * beside the lantern, the beam under it or the top beam, folds its wings into
 * a triangle, twitches its antennae, shivers its wings warm and takes off again.
 */

type P2 = [number, number];

/** Seconds in one round of the moth's plan; each round is planned afresh from its number. */
const C = 14;
/** Seconds to fly in and land, and to take off and rejoin the loops. */
const APP = 1.3, TAKE = 1.1;
/** Moth units to interface px. */
const S = SIZE * 0.95;
const TAU = Math.PI * 2;

/** One wing as four corners (root front, tip, back corner, root back) and the curves' three middles. */
type Wing = [P2, P2, P2, P2, P2, P2, P2];
// Right-hand wings, body facing up: spread in flight, and folded back at rest.
const FORE_OPEN: Wing = [[0.6, -2.4], [5.3, -3.5], [4.4, 0.7], [0.8, 0.3], [2.6, -3.9], [6.3, -1.2], [2.6, 1.4]];
const FORE_SHUT: Wing = [[0.5, -2.6], [3.6, 3.4], [0.15, 4.7], [0.05, -0.6], [2.8, -1.5], [2.5, 5.0], [0.1, 2]];
const HIND_OPEN: Wing = [[0.6, -0.2], [3.9, 0.6], [2.8, 3.4], [0.5, 1.6], [2.6, -0.6], [4.5, 2.6], [1.4, 3.5]];
const HIND_SHUT: Wing = [[0.3, 0], [2.4, 2.6], [0.6, 3.8], [0.2, 1.8], [1.6, 0.6], [2, 3.8], [0.3, 3]];

const mixWing = (a: Wing, b: Wing, f: number, sx: number): Wing =>
  a.map((q, i) => [lerp(q[0], b[i][0], f) * sx, lerp(q[1], b[i][1], f)]) as Wing;

/** The point `u` along the wing from root to edge and `v` from its front to its back. */
const on = (w: Wing, u: number, v: number): P2 => [
  lerp(lerp(w[0][0], w[1][0], u), lerp(w[3][0], w[2][0], u), v),
  lerp(lerp(w[0][1], w[1][1], u), lerp(w[3][1], w[2][1], u), v),
];

/** Adds a wing's outline to the path, mirrored to the left when `side` is -1. */
function wingPath(g: Ctx, w: Wing, side: number): void {
  const [a, b, c, d, ab, bc, cd] = w;
  g.moveTo(a[0] * side, a[1]);
  g.quadraticCurveTo(ab[0] * side, ab[1], b[0] * side, b[1]);
  g.quadraticCurveTo(bc[0] * side, bc[1], c[0] * side, c[1]);
  g.quadraticCurveTo(cd[0] * side, cd[1], d[0] * side, d[1]);
  g.closePath();
}

/** A line across a wing through three of its (u, v) points. */
function wingLine(g: Ctx, w: Wing, side: number, p0: P2, p1: P2, p2: P2): void {
  const a = on(w, ...p0), b = on(w, ...p1), c = on(w, ...p2);
  g.moveTo(a[0] * side, a[1]);
  g.quadraticCurveTo(b[0] * side, b[1], c[0] * side, c[1]);
}

/** How the moth is drawn this frame. */
interface Pose {
  /** Wings folded into the resting triangle, 0 spread to 1 folded. */
  fold: number;
  /** Across-scale of the wings from the wingbeat: 1 flat out, smaller as they rise. */
  beat: number;
  /** Squash on landing or striking the glass, 0 to 1. */
  squash: number;
  /** Each antenna's turn off its rest angle, in radians. */
  antL: number;
  antR: number;
  /** Seated on wood (casts a shadow), 0 to 1. */
  seated: number;
}

/**
 * The moth at (x, y) turned `ang` (0 = head up), lit from `lamp`: warm on the
 * side facing it, dimmer and bluer the further it is from it.
 */
function drawMoth(g: Ctx, x: number, y: number, ang: number, pose: Pose, lamp: P2, reach: number): void {
  const dx = lamp[0] - x, dy = lamp[1] - y, dist = Math.hypot(dx, dy) || 1;
  const c = Math.cos(ang), s = Math.sin(ang);
  const lx = (dx * c + dy * s) / dist, ly = (-dx * s + dy * c) / dist;
  const near = clamp01(1 - dist / reach), q = clamp01(dist / (8 * S));
  // Lamp side: night blue far off, warming to amber close in; the far side stays in shade unless right by the flame.
  const lit = clamp01(near * 1.7);
  const side = (r: number, g2: number, b: number, a: number): string => `rgba(${Math.round(r)}, ${Math.round(g2)}, ${Math.round(b)}, ${a.toFixed(3)})`;
  const near2 = side(lerp(36, 255, lit), lerp(40, 196, lit), lerp(70, 112, lit), lerp(0.45, 0.1 + 0.62 * near * near, lit));
  const far2 = side(lerp(255, 26, q), lerp(196, 28, q), lerp(112, 56, q), lerp(0.5, lerp(0.55, 0.3, lit), q));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(S * (1 + pose.squash * 0.1), S * (1 - pose.squash * 0.14));
  // Its shadow on the wood, thrown away from the lamp.
  if (pose.seated > 0) {
    g.save();
    g.translate(-lx * 1.1, -ly * 1.1);
    g.beginPath();
    g.moveTo(0, -3.4);
    g.quadraticCurveTo(3.4, 0.5, 3.7, 4.6);
    g.quadraticCurveTo(0, 5.6, -3.7, 4.6);
    g.quadraticCurveTo(-3.4, 0.5, 0, -3.4);
    g.fillStyle = `rgba(28, 14, 6, ${0.3 * pose.seated})`;
    g.fill();
    g.restore();
  }
  const light = g.createLinearGradient(lx * 4.5, ly * 4.5, -lx * 4.5, -ly * 4.5);
  light.addColorStop(0, near2);
  light.addColorStop(1, far2);
  const sx = pose.beat, open = pose.fold < 0.97;
  const fore = mixWing(FORE_OPEN, FORE_SHUT, pose.fold, sx), hind = mixWing(HIND_OPEN, HIND_SHUT, pose.fold, sx);
  const both = (draw: (side: number) => void): void => {
    g.beginPath();
    draw(-1);
    draw(1);
  };
  if (open) {
    // The abdomen with soft stripes, and the hind wings: both hidden under the fore wings at rest.
    g.beginPath();
    g.ellipse(0, 1.9, 1.25, 2.6, 0, 0, TAU);
    g.fillStyle = '#b6a284';
    g.fill();
    g.beginPath();
    for (const yy of [1.2, 2.4]) {
      g.moveTo(-1.1, yy);
      g.quadraticCurveTo(0, yy + 0.6, 1.1, yy);
    }
    g.strokeStyle = 'rgba(120, 100, 78, 0.8)';
    g.lineWidth = 0.35;
    g.stroke();
    both((side) => wingPath(g, hind, side));
    g.fillStyle = '#b09c82';
    g.fill();
    g.strokeStyle = 'rgba(104, 86, 66, 0.75)';
    g.lineWidth = 0.4;
    g.stroke();
  }
  both((side) => wingPath(g, fore, side));
  g.fillStyle = '#c7b69c';
  g.fill();
  g.strokeStyle = 'rgba(104, 86, 66, 0.75)';
  g.lineWidth = 0.4;
  g.stroke();
  // Markings on the fore wings: two wavy cross-lines, a spot, and a pale band by the edge.
  both((side) => {
    wingLine(g, fore, side, [0.36, 0.1], [0.46, 0.5], [0.34, 0.9]);
    wingLine(g, fore, side, [0.68, 0.08], [0.58, 0.5], [0.7, 0.92]);
  });
  g.strokeStyle = 'rgba(122, 101, 80, 0.5)';
  g.lineWidth = 0.38;
  g.stroke();
  both((side) => wingLine(g, fore, side, [0.88, 0.1], [0.84, 0.5], [0.87, 0.9]));
  g.strokeStyle = 'rgba(238, 226, 204, 0.6)';
  g.lineWidth = 0.45;
  g.stroke();
  const spot = on(fore, 0.54, 0.4);
  both((side) => {
    g.moveTo(spot[0] * side + 0.42, spot[1]);
    g.arc(spot[0] * side, spot[1], 0.42, 0, TAU);
  });
  g.fillStyle = 'rgba(110, 90, 70, 0.8)';
  g.fill();
  // The lamp's light over the wings.
  both((side) => {
    if (open) wingPath(g, hind, side);
    wingPath(g, fore, side);
  });
  g.fillStyle = light;
  g.fill();
  // Feathery antennae: a shaft curling outward, fringed both sides like a fern.
  const ant = (side: number, fringe: boolean): void => {
    const a = side * (0.62 + (side < 0 ? pose.antL : pose.antR));
    const ux = Math.sin(a), uy = -Math.cos(a), nx = -uy * side, ny = ux * side;
    const bx = side * 0.45, by = -4.6, L = 3;
    const tx = bx + ux * L + nx * 0.5, ty = by + uy * L + ny * 0.5;
    const mx = bx + ux * L * 0.5 + nx * 0.55, my = by + uy * L * 0.5 + ny * 0.55;
    g.moveTo(bx, by);
    if (!fringe) {
      g.quadraticCurveTo(mx + nx * 1.15, my + ny * 1.15, tx, ty);
      g.quadraticCurveTo(mx - nx * 1.0, my - ny * 1.0, bx, by);
      return;
    }
    g.quadraticCurveTo(mx, my, tx, ty);
    for (let k = 1; k < 4; k++) {
      const f = k / 4, sx0 = lerp(lerp(bx, mx, f), lerp(mx, tx, f), f), sy0 = lerp(lerp(by, my, f), lerp(my, ty, f), f);
      const bl = 0.55 * Math.sin(Math.PI * (f * 0.8 + 0.1));
      g.moveTo(sx0 + nx * bl + ux * bl * 0.6, sy0 + ny * bl + uy * bl * 0.6);
      g.lineTo(sx0, sy0);
      g.lineTo(sx0 - nx * bl + ux * bl * 0.6, sy0 - ny * bl + uy * bl * 0.6);
    }
  };
  both((side) => ant(side, false));
  g.fillStyle = 'rgba(184, 160, 126, 0.9)';
  g.fill();
  both((side) => ant(side, true));
  g.strokeStyle = 'rgba(105, 84, 64, 0.85)';
  g.lineWidth = 0.24;
  g.stroke();
  // A fluffy collar over the thorax, the head in front of it, both in the lamp's light; then two round eyes.
  g.beginPath();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    g.moveTo(Math.cos(a) * 1.2 + 0.7, -1.7 + Math.sin(a) * 1.1);
    g.arc(Math.cos(a) * 1.2, -1.7 + Math.sin(a) * 1.1, 0.7, 0, TAU);
  }
  g.moveTo(1.3, -1.7);
  g.arc(0, -1.7, 1.3, 0, TAU);
  g.fillStyle = '#e4d6bc';
  g.fill();
  g.beginPath();
  g.arc(0, -3.75, 1.2, 0, TAU);
  g.fillStyle = '#d5c3a5';
  g.fill();
  g.beginPath();
  g.arc(0, -3.75, 1.2, 0, TAU);
  g.moveTo(1.9, -1.7);
  g.arc(0, -1.7, 1.9, 0, TAU);
  g.fillStyle = light;
  g.fill();
  g.beginPath();
  g.arc(-1.0, -4.0, 0.55, 0, TAU);
  g.moveTo(1.55, -4.0);
  g.arc(1.0, -4.0, 0.55, 0, TAU);
  g.fillStyle = '#2a211c';
  g.fill();
  g.beginPath();
  g.arc(-1.1, -4.18, 0.18, 0, TAU);
  g.moveTo(1.08, -4.18);
  g.arc(0.9, -4.18, 0.18, 0, TAU);
  g.fillStyle = 'rgba(255, 246, 225, 0.9)';
  g.fill();
  g.restore();
}

/** Where one of the four resting places is, and how the moth sits there. */
function perch(n: number, lamp: P2, F: number, r: number): [number, number, number] {
  if (n === 0) return [lamp[0] + F * 0.12, lamp[1] - F * 0.78, -0.25];
  if (n === 1) return [lamp[0] + F * 0.66, lamp[1] - F * 0.08, -0.12];
  if (n === 2) return [F * 0.48, lamp[1] + F * 1.2, (r - 0.5) * 0.3];
  return [F * (1.3 + 0.7 * r), F * 0.48, (r < 0.5 ? -1 : 1) * (0.35 + 0.5 * r)];
}

/** One round's plan: where it lands (or -1) and how it sits there, and when it flies in and takes off. */
interface Plan {
  spot: number;
  at: [number, number, number];
  land: number;
  off: number;
}

function plan(seed: number, k: number, lamp: P2, F: number): Plan {
  const r = (n: number): number => rnd(seed + k * 13.7, n);
  let spot = r(1) < 0.82 ? Math.floor(r(2) * 4) : -1;
  // Never the same spot twice running.
  if (spot >= 0 && rnd(seed + (k - 1) * 13.7, 1) < 0.82 && Math.floor(rnd(seed + (k - 1) * 13.7, 2) * 4) === spot) spot = (spot + 1 + Math.floor(r(8) * 3)) % 4;
  const rest = 2.6 + r(3) * 2.4;
  const land = 2.3 + r(4) * (C - APP - rest - TAKE - 4.4), off = land + APP + rest;
  return { spot, at: perch(Math.max(0, spot), lamp, F, r(7)), land, off };
}

/** Seconds into a strike that it meets the glass, and again on a double strike. */
const HIT1 = 0.55, HIT2 = 1.0;
/** Seconds a strike takes, single or twice over. */
const bumpLen = (double: boolean): number => (double ? 1.85 : 1.5);

/** Where a strike starting at `t0` aims at time `t0 + v`: the loops followed round at a third of their pace. */
const aim = (t0: number, v: number, lamp: P2, F: number, ph: number): P2 => orbit(t0 + HIT1 + (v - HIT1) * 0.35, lamp, F, ph);

/**
 * A round's strikes at the lantern, by when they start in it: one or two in
 * its free flying, each put at the first of a few times where the loops pass
 * outside the lantern's left, foot or hood (its right is over the window).
 */
function strikes(seed: number, k: number, pl: Plan, lamp: P2, F: number, ph: number): Array<{ at: number; double: boolean }> {
  const r = (n: number): number => rnd(seed + k * 13.7, n);
  const out: Array<{ at: number; double: boolean }> = [];
  const one = (i: number, from: number, to: number): void => {
    const double = r(10 + i) < 0.35, D = bumpLen(double), room = to - from - D;
    if (room < 0) return;
    for (let j = 0; j < 6; j++) {
      const at = from + ((r(20 + i) + j / 6) % 1) * room, t0 = k * C + at;
      const o = aim(t0, HIT1, lamp, F, ph), h = hull(o, lamp, F);
      if (!h || Math.hypot(o[0] - lamp[0], o[1] - lamp[1]) < h[1] + 4) continue;
      if ([0, D / 2, D].some((v) => !hull(aim(t0, v, lamp, F, ph), lamp, F))) continue;
      out.push({ at, double });
      return;
    }
  };
  if (pl.spot < 0) {
    one(0, 0.4, C * 0.45);
    one(1, C * 0.5, C - 0.3);
  } else {
    if (r(5) < 0.8) one(0, 0.3, pl.land - 0.2);
    if (r(6) < 0.6) one(1, pl.off + TAKE + 0.2, C - 0.3);
  }
  return out;
}

/** The wandering loops round the flame at time `tt`, kept off the window's inside. */
function orbit(tt: number, lamp: P2, F: number, ph: number): P2 {
  const th = 2.3 * tt + 2.6 * Math.sin(0.53 * tt + ph) + 0.5 * Math.sin(1.37 * tt);
  const fling = Math.max(0, Math.sin(0.71 * tt + ph * 2)) ** 8;
  const r = F * (0.74 + 0.2 * Math.sin(0.9 * tt + ph) + 0.08 * Math.sin(2.3 * tt + 1) + 0.45 * fling);
  let x = lamp[0] - F * 0.2 + Math.cos(th) * r, y = lamp[1] - F * 0.12 + Math.sin(th) * r * 0.9;
  // Squeeze the loops' right side so they never reach past the beam into the window.
  const xs = F - 15, xm = F - 9;
  if (x > xs) x = xs + (xm - xs) * Math.tanh((x - xs) / (xm - xs));
  if (y < -F * 1.2) y = -F * 1.2;
  return [x, y];
}

/** Where the moth is at `tt` without its flutter and strikes, and how far it is into landing. */
function course(tt: number, lamp: P2, F: number, seed: number, ph: number): { at: P2; sit: number; pl: Plan; u: number } {
  const k = Math.floor(tt / C), u = tt - k * C, pl = plan(seed, k, lamp, F), o = orbit(tt, lamp, F, ph);
  if (pl.spot < 0 || u < pl.land || u >= pl.off + TAKE) return { at: o, sit: 0, pl, u };
  const [px, py] = pl.at;
  if (u < pl.land + APP) {
    // In from above, hovering down the last bit onto the spot.
    const s = (u - pl.land) / APP, w = ease(Math.min(1, s / 0.72));
    const tx = px + Math.sin(s * 9) * 2 * (1 - s), ty = py - F * 0.3 * (1 - s) ** 1.5;
    return { at: [lerp(o[0], tx, w), lerp(o[1], ty, w)], sit: ease(clamp01((s - 0.55) / 0.45)), pl, u };
  }
  if (u < pl.off) return { at: [px, py], sit: 1, pl, u };
  // Off with a hop straight up, then away into the loops.
  const s = (u - pl.off) / TAKE, up = 1 - (1 - clamp01((s - 0.18) / 0.5)) ** 2;
  const w = ease(clamp01((s - 0.3) / 0.7));
  const tx = px, ty = py - F * 0.35 * up;
  return { at: [lerp(tx, o[0], w), lerp(ty, o[1], w)], sit: 1 - ease(clamp01(s / 0.35)), pl, u };
}

/** Angle from `a` to `b`, `u` of the way, the short way round. */
const turn = (a: number, b: number, u: number): number => a + ((((b - a) % TAU) + TAU * 1.5) % TAU - Math.PI) * u;

/** A quick twitch of one antenna now and then, back to rest by the end of its slot. */
function twitch(tt: number, seed: number, side: number): number {
  const v = tt * 1.7 + side * 0.37, j = Math.floor(v), f = v - j;
  if (rnd(seed + side * 3.1, j) > 0.42) return 0;
  const amp = (rnd(seed + side * 5.3, j) - 0.35) * 0.9;
  return amp * (f < 0.12 ? ease(f / 0.12) : 1 - ease(clamp01((f - 0.12) / 0.5)));
}

/**
 * Which way a point lies from the flame and how far out the lantern's side
 * reaches that way: or null where that way is the lantern's right, over the beam.
 */
function hull(o: P2, lamp: P2, F: number): [P2, number] | null {
  const dx = o[0] - lamp[0], dy = o[1] - lamp[1], r = Math.hypot(dx, dy);
  if (r < 1 || dx / r > 0.3) return null;
  const n: P2 = [dx / r, dy / r];
  const side = F * 0.46 + 1, up = F * 0.62, down = F * 0.5 + 2;
  return [n, Math.min(n[0] < 0 ? side / -n[0] : 1e9, n[1] < 0 ? up / -n[1] : down / Math.max(1e-6, n[1]))];
}

export function moth(g: Ctx, p: LifePiece, t: number): void {
  const L = frameLamps('bench', p.w, p.h, p.F)[0];
  if (!L) return;
  const F = p.F, lamp: P2 = [L.x, L.y], seed = p.seed % 97, ph = seed * 0.61;
  const tt = t + seed * 1.37;
  const here = course(tt, lamp, F, seed, ph), { pl, u } = here;
  let [x, y] = here.at;
  const sit = here.sit;
  // Heading from the smooth course, turned to the perch's set as it lands.
  const a0 = course(tt - 0.07, lamp, F, seed, ph).at, a1 = course(tt + 0.07, lamp, F, seed, ph).at;
  const vx = a1[0] - a0[0], vy = a1[1] - a0[1], speed = Math.hypot(vx, vy);
  // Wing pose through the round's beats.
  let fold = 0, amp = 1, hz = 7.5, squash = 0;
  const restIn = u - (pl.land + APP), restLeft = pl.off - u, restLen = pl.off - pl.land - APP;
  // Half way through a rest, sometimes a small shuffle round to a new set.
  const set = pl.at[2] + (rnd(seed + pl.land, 5) < 0.5 ? (rnd(seed + pl.land, 6) - 0.5) * 0.7 * ease(clamp01((restIn - restLen * 0.55) / 0.35)) : 0);
  let ang = turn(speed > 0.05 ? Math.atan2(vx, -vy) : set, set, sit);
  if (pl.spot >= 0 && u >= pl.land + APP * 0.7 && u < pl.off + TAKE) {
    if (u < pl.land + APP) {
      hz = 10;
    } else if (u < pl.off) {
      // Touch down, fold with a little overshoot, then sit and breathe.
      const f = clamp01(restIn / 0.5);
      fold = f < 1 ? 1 - (1 - f) ** 3 * Math.cos(f * 5) : 1;
      amp = Math.max(0, 1 - restIn / 0.3);
      hz = 11;
      squash = restIn < 0.3 ? Math.sin((restIn / 0.3) * Math.PI) * 0.8 : 0;
      // A wing shiver part way through, and the warm-up shiver before it flies.
      const mid = restLen * (0.35 + rnd(seed + pl.land, 3) * 0.3);
      const sh = rnd(seed + pl.land, 4) < 0.6 ? Math.sin(Math.PI * clamp01((restIn - mid) / 0.5)) : 0;
      const warm = Math.sin(Math.PI * clamp01((0.75 - restLeft) / 0.75)) ** 0.7 * (restLeft < 0.75 ? 1 : 0);
      const lift = Math.max(sh * 0.25, warm * 0.4);
      if (restIn > 0.5) {
        fold = 1 - lift - 0.04 * (0.5 + 0.5 * Math.sin(tt * 2.4)) * clamp01((restIn - 0.5) / 0.6);
        amp = Math.max(sh * 0.22, warm * 0.35);
        hz = 13;
      }
    } else {
      // Take off: a crouch, wings open, a spring up.
      const s = (u - pl.off) / TAKE;
      fold = 0.6 * (1 - ease(clamp01(s / 0.2)));
      amp = clamp01(s / 0.15);
      squash = s < 0.18 ? Math.sin((s / 0.18) * Math.PI) * 0.6 : 0;
      ang = turn(ang, set, 1 - ease(clamp01((s - 0.15) / 0.4)));
    }
  }
  // Strikes at the lantern: a dart in along the line from the flame, a bounce off, a wobble, sometimes once more.
  const dust: Array<{ E: P2; n: P2; age: number }> = [];
  let still = 0;
  const t0k = Math.floor(tt / C) * C;
  for (const b of strikes(seed, Math.floor(tt / C), pl, lamp, F, ph)) {
    const s = u - b.at, D = bumpLen(b.double), c1 = HIT1, c2 = HIT2, t0 = t0k + b.at;
    if (s < 0 || s > D) continue;
    const h1 = hull(aim(t0, c1, lamp, F, ph), lamp, F);
    if (!h1) continue;
    const [n, edge] = hull(aim(t0, s, lamp, F, ph), lamp, F) ?? h1;
    const reach = 4.4 * S;
    let d: number;
    if (s < c1) d = 16 * (1 - (s / c1) ** 2);
    else if (!b.double || s < c2 - 0.22) d = 8 * (1 - (1 - clamp01((s - c1) / 0.25)) ** 2);
    else if (s < c2) d = 8 * (1 - ((s - (c2 - 0.22)) / 0.22) ** 2);
    else d = 10 * (1 - (1 - clamp01((s - c2) / 0.28)) ** 2);
    const w = ease(clamp01(s / 0.4)) * (1 - ease(clamp01((s - (D - 0.65)) / 0.65)));
    const E: P2 = [lamp[0] + n[0] * edge, lamp[1] + n[1] * edge];
    x = lerp(x, E[0] + n[0] * (reach + d), w);
    y = lerp(y, E[1] + n[1] * (reach + d), w);
    still = w;
    const hit = b.double && s >= c2 ? s - c2 : s - c1;
    const wob = hit > 0 ? Math.sin(hit * 20) * Math.exp(-hit * 4.5) * 0.6 : 0;
    ang = turn(ang, Math.atan2(-n[0], n[1]) + wob, w);
    if (hit > 0 && hit < 0.22) squash = Math.max(squash, Math.sin((hit / 0.22) * Math.PI));
    for (const c of b.double ? [c1, c2] : [c1]) {
      if (s <= c) continue;
      const [n1, e1] = hull(aim(t0, c, lamp, F, ph), lamp, F) ?? h1;
      dust.push({ E: [lamp[0] + n1[0] * e1, lamp[1] + n1[1] * e1], n: n1, age: s - c });
    }
  }
  // The flutter: little darts off the course, and a bob with every wingbeat.
  const fly = (1 - sit) * (1 - 0.75 * still);
  // Now and then a short glide on held wings.
  const glide = 1 - 0.75 * fly * Math.max(0, Math.sin(0.83 * tt + ph * 3)) ** 10;
  const ph1 = TAU * hz * tt + 1.2 * Math.sin(2.3 * tt);
  x += fly * (1.4 * Math.sin(9 * tt) + 0.9 * Math.sin(14 * tt + 1) + 0.5 * Math.sin(19 * tt + 2));
  y += fly * (1.3 * Math.sin(8 * tt + 2) + 0.8 * Math.sin(13 * tt) + 0.6 * Math.sin(Math.max(0, amp) * ph1));
  // Antennae: twitches at rest, swept back by turns in flight.
  const sweep = clamp01(speed / 6) * 0.25 * fly;
  const pose: Pose = {
    fold,
    beat: 1 - amp * glide * 0.64 * (0.5 - 0.5 * Math.cos(ph1)),
    squash,
    antL: twitch(tt, seed, -1) * sit + sweep,
    antR: twitch(tt, seed, 1) * sit + sweep,
    seated: sit,
  };
  drawMoth(g, x, y, ang, pose, lamp, F * 2.8);
  // Wing dust shaken off at the strike, drifting down in the lamplight.
  for (const { E, n, age } of dust) {
    if (age > 0.9) continue;
    for (let i = 0; i < 4; i++) {
      const r1 = rnd(seed + pl.land + i, 8), r2 = rnd(seed + i, pl.land + E[1]);
      const vx2 = n[0] * (7 + 6 * r1) + n[1] * (r2 - 0.5) * 12, vy2 = n[1] * (7 + 6 * r1) - n[0] * (r2 - 0.5) * 12 - 4;
      const px = E[0] + vx2 * age, py = E[1] + vy2 * age + 9 * age * age;
      g.beginPath();
      g.arc(px, py, 0.55 + 0.35 * r1, 0, TAU);
      g.fillStyle = `rgba(255, 228, 176, ${0.85 * (1 - age / 0.9) ** 1.5})`;
      g.fill();
    }
  }
}
