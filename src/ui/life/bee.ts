import { SIZE, clamp01, ease, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * A bumblebee going round the market stall by day: it darts from place to place
 * along the band and just outside it, stopping to hover between darts, and lands
 * on the flowers (to feed), the barrel's lid, the top beam and the crate (to walk
 * about), the banner's knob, the finials, the cloth and the sack (to sit and look
 * round). Now and then it loops the loop as it arrives. One round of the stall takes
 * `LAP` seconds plus the time its darts take; which way round, where it lands and
 * how long it stays change from round to round. Drawn facing +x, in units of
 * `SIZE` pixels, from the point under its feet.
 */

/** Seconds a round of the stall spends at its stops, besides the darts between them. */
const LAP = 50;

/** How much bigger than `SIZE` it is drawn: a plump bee, read at a glance. */
const PLUMP = 1.12;

/** Seconds a loop the loop takes. */
const LOOP = 0.8;

/** How high it hovers over a place it can land on, in pixels. */
const OVER = 8;

/** What it does when it lands at a stop: feed, walk about, or sit; null where it only hovers. */
type Kind = 'sip' | 'walk' | 'sit' | null;

/** A place on its round: where (under its feet), what it does there, how far it may walk either way, and whether there is room round it for a loop on arriving. */
interface Stop {
  x: number;
  y: number;
  kind: Kind;
  walk: number;
  loop: boolean;
}

/** How it is at one moment. */
interface Pose {
  x: number;
  y: number;
  /** Facing: 1 right, -1 left, between while it turns. */
  f: number;
  /** Turned from level, radians, besides its tilt in flight. */
  rot: number;
  /** Squashed (positive) or stretched (negative), share of its height. */
  sq: number;
  /** Wings buzzing (1) or folded on its back (0). */
  wing: number;
  /** Legs hanging (1) or stood on (0). */
  legs: number;
  /** Where its feet are in their stepping, radians. */
  step: number;
  /** How dark its shadow is on the surface under it, and that surface's height. */
  shade: number;
  ground: number;
  /** How far through a loop the loop it is, radians (0 outside one), and which way it turns. */
  loop: number;
  spin: number;
  /** How far through a puff of pollen off a flower it lands on or leaves it is, 0 to 1 (outside that, none), and where the flower is. */
  puff: number;
  fx: number;
  fy: number;
}

/** The stops of a round, clockwise from the flowers at the foot of the left post. */
function stopsOf(w: number, h: number, F: number): Stop[] {
  const s = (x: number, y: number, kind: Kind = null, walk = 0, loop = false): Stop => ({ x, y, kind, walk, loop });
  const finial = -F * 0.45 - F * 0.55 * 1.25 - 0.5;
  return [
    s(F * 0.42, h - F * 1.05, 'sip'),
    s(-F, h - F * 1.2, null, 0, true),
    s(-F * 0.18, h + 10.5 - F * 2, 'walk', 5, true),
    s(-F * 0.8, h * 0.52, null, 0, true),
    s(F * 0.5, h * 0.33),
    s(-F * 0.62 - 5, F * 0.95 - 2.6, 'sit', 0, true),
    s(F * 0.46, finial, 'sit', 0, true),
    s(w * 0.3, -F * 1.05, null, 0, true),
    s(w * 0.52, -F * 0.45, 'walk', Math.min(24, w * 0.1), true),
    s(w * 0.72, F * 0.38, null, 0, true),
    s(w - F * 0.46, finial, 'sit', 0, true),
    s(w - F * 0.25, F * 0.5, 'sit', 0, true),
    s(w + F * 0.65, h * 0.46, null, 0, true),
    s(w - F * 0.6, h - F * 2.32, 'sip'),
    s(w + F * 0.08, h - F * 2.25, 'walk', 7, true),
    s(w + F * 0.5, h - F * 0.5, null, 0, true),
    s(w - F * 2.15, h - F * 0.05, 'sit'),
    s(w * 0.45, h + F * 0.4, null, 0, true),
    s(F * 1.3, h + F * 0.25),
  ];
}

/** Where it hovers at a stop: over it if it can land there. */
const over = (s: Stop): [number, number] => [s.x, s.kind ? s.y - OVER : s.y];

/** Which way it faces on a dart from `a` to `b`: the way it goes, or in towards the window on a dart straight up or down. */
const facing = (a: [number, number], b: [number, number], w: number): number =>
  Math.abs(b[0] - a[0]) > 6 ? Math.sign(b[0] - a[0]) : a[0] < w / 2 ? 1 : -1;

/** 0 to 1 with a little overshoot near the end: a dart that brakes. */
const dart = (u: number): number => u * u * (3 - 2 * u) + 6 * u * u * (1 - u) * (1 - u);

/** 0 at `a`, 1 by `a + d`, eased. */
const by = (s: number, a: number, d: number): number => ease(clamp01((s - a) / d));

/** A rise and fall over `d` seconds from `a`, 0 outside it. */
const bump = (s: number, a: number, d: number): number => (s < a || s > a + d ? 0 : Math.sin(Math.PI * (s - a) / d) ** 2);

/** One visit in a round: the stop, whether it lands, when it arrives, how long it stays, and the dart on. */
interface Visit {
  i: number;
  land: boolean;
  t0: number;
  stay: number;
  go: number;
  loop: boolean;
  inF: number;
  outF: number;
}

/** Which way round the stall round `k` goes. */
const wayOf = (s: number, k: number): number => (rnd(s, k * 3.1) < 0.35 ? -1 : 1);

/** Seconds a round lasts: the darts round the stall without loops, and `LAP`. */
function lapOf(S: Stop[]): number {
  let len = LAP;
  S.forEach((st, i) => {
    const a = over(st), b = over(S[(i + 1) % S.length]);
    len += 0.3 + Math.hypot(b[0] - a[0], b[1] - a[1]) / 220;
  });
  return len;
}

/** Round `k`, `len` seconds long: its visits in order, timed so every round lasts the same. */
function roundOf(S: Stop[], w: number, s: number, k: number, len: number): Visit[] {
  const n = S.length, way = wayOf(s, k);
  const order = S.map((_, j) => (way > 0 ? j : (n - j) % n));
  const v: Visit[] = [];
  let darts = 0, stays = 0;
  for (let j = 0; j < n; j++) {
    const i = order[j], next = order[(j + 1) % n], a = over(S[i]), b = over(S[next]);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const loop = S[next].loop && rnd(s + 2, k * 37 + i) < 0.2;
    const land = S[i].kind !== null && (i === 0 || rnd(s + 1, k * 31 + i) < 0.72);
    const r = rnd(s + 3, k * 29 + i);
    const stay = !S[i].kind ? 0.6 + 0.7 * r : !land ? 1.1 + 0.7 * r : (S[i].kind === 'sit' ? 3.6 : 4.8) * (0.75 + 0.6 * r);
    const go = 0.3 + d / 220;
    darts += go + (loop ? LOOP : 0);
    stays += stay;
    v.push({ i, land, t0: 0, stay, go: go + (loop ? LOOP : 0), loop, inF: 0, outF: facing(a, b, w) });
  }
  const k2 = (len - darts) / stays;
  let t = 0;
  const pw = wayOf(s, k - 1), last = pw > 0 ? n - 1 : 1;
  for (let j = 0; j < n; j++) {
    v[j].stay *= k2;
    // Too short a stay to come down, bumble and spring up again: it only hovers there.
    if (v[j].stay < 2.2) v[j].land = false;
    v[j].t0 = t;
    t += v[j].stay + v[j].go;
    v[j].inF = j ? v[j - 1].outF : facing(over(S[last]), over(S[0]), w);
  }
  return v;
}

/** Its pose at time `t`, with no hover drift or loops when `bare` (for reading which way it is going). */
function poseAt(p: LifePiece, S: Stop[], s: number, len: number, t: number, bare: boolean): Pose {
  const { w, h } = p;
  const k = Math.floor(t / len), v = roundOf(S, w, s, k, len);
  const lt = t - k * len;
  let j = v.length - 1;
  while (j > 0 && v[j].t0 > lt) j--;
  const V = v[j], st = S[V.i], q = lt - V.t0;
  const P: Pose = { x: 0, y: 0, f: V.inF, rot: 0, sq: 0, wing: 1, legs: 1, step: 0, shade: 0, ground: st.y, loop: 0, spin: 0, puff: -1, fx: st.x, fy: st.y };
  let amp = 1;
  const [hx, hy] = over(st);
  const r1 = rnd(s + 4, k * 41 + V.i), r2 = rnd(s + 5, k * 43 + V.i), r3 = rnd(s + 6, k * 47 + V.i);
  // Where it lands: hovering over the stop, coming down, on it, crouching, springing up, and hovering again before the dart on.
  const a = 0.3 + 0.3 * r3, b = 0.4, c = 0.16, d = 0.28, e = 0.25 + 0.2 * r2;
  const L = Math.max(0.3, V.stay - a - b - c - d - e);
  if (V.land && st.kind === 'sip') {
    const down = (q - a - b) / 0.7, up = (q - a - b - L - c) / 0.9;
    P.puff = down >= 0 && down < 1 ? down : up >= 0 && up < 1 ? up : -1;
  }
  if (q >= V.stay) {
    // The dart on to the next stop: an arc bowed away from the window, braking at its end.
    const q1 = q - V.stay, T = V.go - (V.loop ? LOOP : 0), u = clamp01(q1 / T), b = over(S[v[(j + 1) % v.length].i]);
    const dx = b[0] - hx, dy = b[1] - hy, d = Math.hypot(dx, dy) || 1;
    let ox = -dy / d, oy = dx / d;
    if (ox * ((hx + b[0]) / 2 - w / 2) + oy * ((hy + b[1]) / 2 - h / 2) < 0) [ox, oy] = [-ox, -oy];
    const bow = Math.min(12, d * 0.22) * (r1 < 0.5 ? 1 : 0.4);
    const e = dart(u), cx = (hx + b[0]) / 2 + ox * bow, cy = (hy + b[1]) / 2 + oy * bow, m = 1 - e;
    P.x = m * m * hx + 2 * m * e * cx + e * e * b[0];
    P.y = m * m * hy + 2 * m * e * cy + e * e * b[1];
    P.f = V.outF;
    amp = 1 - 0.65 * Math.sin(Math.PI * u);
    if (V.loop && !bare) {
      // The loop as it arrives: on the way it faces, up and over, and down to where it was.
      const a = Math.PI * 2 * ease(clamp01((q1 - T * 0.8) / LOOP)), r = 8;
      P.x += r * Math.sin(a) * V.outF;
      P.y -= r * (1 - Math.cos(a));
      P.loop = a;
      P.spin = -V.outF;
      amp *= 1 - Math.sin(a / 2) * 0.7;
    }
  } else if (!V.land) {
    // Hovering: it turns to face the next dart halfway, and over a flower it does not land on it dips to smell it.
    P.x = hx;
    P.y = hy + (st.kind ? 4 * bump(q, 0.15, Math.max(0.3, V.stay - 0.35)) : 0);
    P.f = lerp(V.inF, V.outF, by(q, V.stay * 0.5 - 0.09, 0.18));
  } else {
    // Landing, a while on the stop, and off again.
    P.x = hx;
    P.y = hy;
    if (q < a) {
      // Hovering over it.
    } else if (q < a + b) {
      const u = clamp01((q - a) / b);
      P.y = hy + OVER * u * u * (2 - u);
      amp = 1 - u;
      P.legs = 1 - u;
    } else {
      const s0 = q - a - b, u = s0 / L;
      amp = 0;
      P.legs = 0;
      P.y = st.y;
      // The touch down, and its wings stopping and folding.
      P.sq = s0 < 0.06 ? 0.16 * s0 / 0.06 : 0.16 * Math.exp(-(s0 - 0.06) * 8) * Math.cos((s0 - 0.06) * 16);
      P.wing = 1 - clamp01(s0 / 0.15);
      P.wing = Math.max(P.wing, 0.8 * bump(s0, (0.25 + 0.5 * r1) * L, 0.35));
      let f = V.inF;
      if (st.kind === 'walk') {
        // Walks a little way, looks about, turns and walks back.
        const W = st.walk * (0.55 + 0.45 * r2) * V.inF, out = by(u, 0.12, 0.3), back = by(u, 0.58, 0.3);
        P.x = hx + W * (out - back);
        P.step = Math.abs(W) * (out + back) * 1.3;
        P.y -= 0.45 * Math.abs(Math.sin(P.step));
        f += -2 * V.inF * by(s0, 0.47 * L, 0.18);
      } else if (st.kind === 'sip') {
        // Head down in the flower, sipping; now and then it shuffles round to the other side.
        const lean = by(s0, 0, 0.4) * (1 - by(s0, L - 0.35, 0.35));
        const flip = r2 < 0.5 ? -1 : 1;
        if (flip < 0) {
          f += -2 * V.inF * by(s0, 0.45 * L, 0.18);
          P.x = hx - V.inF * 1.6 * by(u, 0.42, 0.15) * (1 - by(u, 0.85, 0.12));
          P.step = 4 * by(u, 0.42, 0.15);
        }
        P.rot = (0.36 + 0.06 * Math.sin(s0 * 10)) * lean;
        P.rot *= Math.sign(f) || 1;
      } else {
        // Sits up and looks round, and gives a happy wiggle.
        f += -2 * V.inF * by(s0, 0.3 * L, 0.18);
        if (r2 < 0.6) f += 2 * V.inF * by(s0, 0.62 * L, 0.18);
        P.rot = 0.13 * Math.sin(s0 * 15) * bump(u, 0.72, 0.16);
        P.sq += 0.025 * Math.sin(s0 * 3.5) * (1 - by(s0, L - 0.3, 0.3));
      }
      P.f = f;
      if (s0 > L) {
        // The crouch, and the spring up into the air.
        const s1 = s0 - L, end = Math.sign(f) || 1;
        P.f = lerp(end, V.outF, by(s1, 0, 0.3));
        P.rot = 0;
        P.wing = by(s1, 0, c);
        if (s1 < c) P.sq = 0.1 * by(s1, 0, c);
        else {
          const u2 = clamp01((s1 - c) / d);
          P.y = st.y - OVER * (1 - (1 - u2) ** 2);
          P.sq = 0.1 - 0.18 * by(u2, 0, 0.5) + 0.08 * by(u2, 0.5, 0.5);
          P.legs = u2;
          amp = u2;
        }
        if (s1 > c + d) {
          P.sq = 0;
          P.legs = 1;
          P.y = hy;
          amp = 1;
        }
      }
    }
    if (st.kind === 'walk') P.shade = 0.22 * clamp01(1 - (st.y - P.y) / OVER);
  }
  if (!bare) {
    // The drift of a hover: never quite still.
    P.x += amp * (1.2 * Math.sin(t * 3.1) + 0.5 * Math.sin(t * 7.7));
    P.y += amp * (1.4 * Math.sin(t * 9.4) + 0.6 * Math.sin(t * 4.3));
  }
  return P;
}

/** Its outline. */
const INK = '#5a3a20';
/** Its stripes, legs, feelers and eye. */
const DARK = '#3e2b1f';

/** Its body's half width and half height, and the height of its middle over its feet. */
const RX = 3.45, RY = 3.0, CY = -3.6;

/** Adds to the path a wing from its root on the back, at angle `a`, `l` long. */
function wing(g: Ctx, a: number, l: number): void {
  const c = Math.cos(a), s = Math.sin(a);
  g.moveTo(-0.3 + c * l * 1.05, CY - 2.3 + s * l * 1.05);
  g.ellipse(-0.3 + c * l * 0.5, CY - 2.3 + s * l * 0.5, l * 0.55, l * 0.32, a, 0, Math.PI * 2);
}

/** Fills the wings added by `add`, `alpha` strong, and edges them if `edge`. */
function wings(g: Ctx, alpha: number, edge: boolean, add: () => void): void {
  if (alpha < 0.02) return;
  g.globalAlpha = alpha;
  g.beginPath();
  add();
  g.fillStyle = '#eef6ff';
  g.fill();
  if (edge) {
    g.lineWidth = 0.3;
    g.strokeStyle = 'rgba(90, 120, 150, 0.8)';
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Adds to the path the part of the body between `x0` and `x1` across it, its edges bowed forward like the stripes round a ball. */
function band(g: Ctx, x0: number, x1: number): void {
  const t0 = Math.acos(Math.max(-1, x0 / RX)), t1 = Math.acos(Math.min(1, x1 / RX)), bow = 0.8;
  g.moveTo(x1, CY - RY * Math.sin(t1));
  g.ellipse(0, CY, RX, RY, 0, -t1, -t0, true);
  if (x0 > -RX) g.quadraticCurveTo(x0 + bow, CY, x0, CY + RY * Math.sin(t0));
  g.ellipse(0, CY, RX, RY, 0, t0, t1, true);
  g.quadraticCurveTo(x1 + bow, CY, x1, CY - RY * Math.sin(t1));
}

/** The bee at the origin under its feet, facing +x: legs and feelers, its round striped body and face, and wings. */
function drawBee(g: Ctx, P: Pose, t: number, sway: number): void {
  // Legs (three on this side, stood on or hanging back) and feelers (trailing behind its moves).
  const tips: Array<[number, number]> = [];
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const lx = -1.3 + k * 1.35, swing = Math.sin(P.step + k * 2.1) * 0.5;
    g.moveTo(lx, CY + 2.4);
    g.lineTo(lx - 0.9 * P.legs + swing * (1 - P.legs), -0.1 + 0.2 * P.legs + Math.sin(t * 5 + k) * 0.2 * P.legs);
  }
  for (const [bx, tx, ty] of [[1.3, 1.9, -4.5], [2.0, 3.3, -4.0]]) {
    const ex = tx - sway * 0.6, ey = CY + ty + Math.abs(sway) * 0.3;
    g.moveTo(bx, CY - 2.4);
    g.quadraticCurveTo(bx + 0.2, CY - 3.6, ex, ey);
    tips.push([ex, ey]);
  }
  g.strokeStyle = DARK;
  g.lineWidth = 0.45;
  g.lineCap = 'round';
  g.stroke();
  // The body.
  g.beginPath();
  g.ellipse(0, CY, RX, RY, 0, 0, Math.PI * 2);
  g.fillStyle = '#f4c046';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.55;
  g.stroke();
  // Its stripes and the tip of its tail, sting, the knobs of its feelers and its eye (shut for a blink now and then).
  g.beginPath();
  band(g, -0.2, 0.75);
  band(g, -2.05, -1.25);
  band(g, -RX, -3.1);
  g.moveTo(-3.38, CY + 0.35);
  g.lineTo(-4.2, CY + 0.8);
  g.lineTo(-3.3, CY + 1.05);
  for (const [x, y] of tips) {
    g.moveTo(x + 0.42, y);
    g.arc(x, y, 0.42, 0, Math.PI * 2);
  }
  const blink = (t * 0.37 + 0.2) % 1 < 0.035;
  if (blink) g.rect(1.55, CY - 0.45, 1.1, 0.3);
  else {
    g.moveTo(2.78, CY - 0.35);
    g.arc(2.1, CY - 0.35, 0.68, 0, Math.PI * 2);
  }
  g.fillStyle = DARK;
  g.fill();
  // The light in its eye and on its fur, and its blush.
  g.beginPath();
  if (!blink) {
    g.moveTo(2.56, CY - 0.62);
    g.arc(2.32, CY - 0.62, 0.24, 0, Math.PI * 2);
  }
  g.ellipse(0.7, CY - 1.8, 1.4, 0.65, -0.25, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 252, 235, 0.75)';
  g.fill();
  g.beginPath();
  g.ellipse(2.45, CY + 0.85, 0.6, 0.38, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(240, 130, 115, 0.75)';
  g.fill();
  // Wings: buzzing to a blur, or folded down its back.
  const buzz = Math.sin(t * 47) * 0.18 + Math.sin(t * 71) * 0.1;
  wings(g, 0.55 * P.wing, false, () => {
    wing(g, -2.3 + buzz, 4.1);
    wing(g, -1.4 - buzz, 4.2);
  });
  wings(g, 0.85 * (1 - P.wing), true, () => {
    wing(g, -2.7, 3.6);
    wing(g, -2.95, 3.9);
  });
}

export function bee(g: Ctx, p: LifePiece, t: number): void {
  const S = stopsOf(p.w, p.h, p.F), s = p.seed * 0.29 + 3;
  const tt = t + (p.seed % 97) * 1.7;
  const len = lapOf(S), P = poseAt(p, S, s, len, tt, false);
  const a = poseAt(p, S, s, len, tt - 1 / 30, true), b = poseAt(p, S, s, len, tt + 1 / 30, true);
  const vx = (b.x - a.x) * 15, vy = (b.y - a.y) * 15, speed = Math.hypot(vx, vy);
  if (P.shade > 0.01) {
    g.beginPath();
    g.ellipse(P.x, P.ground + 0.5, 5.5, 1.4, 0, 0, Math.PI * 2);
    g.fillStyle = `rgba(50, 30, 15, ${P.shade})`;
    g.fill();
  }
  if (P.puff >= 0) {
    // Pollen knocked off the flower: specks thrown up and out, falling and fading.
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const sx = (i - 1.5) * (3 + 2 * rnd(i, p.seed)) * P.puff, sy = -6 * P.puff + 9 * P.puff * P.puff - 2;
      g.moveTo(P.fx + sx + 0.7, P.fy + sy + i % 2);
      g.arc(P.fx + sx, P.fy + sy + i % 2, 0.7, 0, Math.PI * 2);
    }
    g.globalAlpha = 1 - P.puff * P.puff;
    g.fillStyle = '#ffd95a';
    g.fill();
    g.globalAlpha = 1;
  }
  // Nose down as it speeds along, up as it climbs; round and round in a loop.
  const tilt = Math.max(-0.5, Math.min(0.5, vx / 260 + P.f * vy / 420));
  const st = Math.min(speed / 1400, 0.12);
  const u = SIZE * PLUMP, sx = (1 + P.sq + st) * u, sy = (1 - P.sq - st * 0.6) * u;
  g.save();
  g.translate(P.x, P.y - 3.6 * u * (1 - P.sq));
  g.rotate(tilt + P.rot + P.loop * P.spin);
  g.translate(0, 3.6 * u * (1 - P.sq));
  g.scale(Math.sign(P.f) * Math.sqrt(Math.abs(P.f)) * sx, sy);
  drawBee(g, P, tt, Math.max(-1, Math.min(1, vx / 200 * Math.sign(P.f || 1))));
  g.restore();
}
