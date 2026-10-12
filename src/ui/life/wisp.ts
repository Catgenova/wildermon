import { SIZE, clamp01, ease, glow, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * The treasure map's wisp: a little blue light with a face that wanders the
 * band. It goes from stop to stop round the frame, mostly clockwise, now and
 * then doubling back, swooping out past the torn edge or looping on the way,
 * and leaves sparkles behind it that fade. With a treasure map in the pack it
 * stops over the map's red X's and compasses, nods at them and sparkles; with
 * none it is dimmer and slower, its eyes shut.
 */

/** Seconds from one stop to the next (on the wisp's own clock, which runs slower when it is drowsy). */
const STEP = 4.5;
/** How far round the band it goes on an average step, in px. */
const STRIDE = 78;
/** How long a sparkle it leaves lasts, in seconds, and how often it leaves one. */
const SPARK_LIFE = 1.4, SPARK_EVERY = 0.075;

/** A point on the band's middle line: where, and the way out from the window. */
type Edge = [x: number, y: number, nx: number, ny: number];

/** The line the wisp follows: a rounded box down the middle of the band. */
interface Track {
  /** How far in from the window's edge the line runs, and the radius of its corners. */
  m: number;
  rc: number;
  /** Lengths of the top and side straights, of one corner, and of the whole way round. */
  a: number;
  b: number;
  q: number;
  L: number;
  w: number;
  h: number;
}

function track(p: LifePiece): Track {
  const m = p.F * 0.5, rc = Math.max(2, Math.min(p.F * 1.2, (p.w - 2 * m) / 2 - 1, (p.h - 2 * m) / 2 - 1));
  const a = p.w - 2 * m - 2 * rc, b = p.h - 2 * m - 2 * rc, q = (rc * Math.PI) / 2;
  return { m, rc, a, b, q, L: 2 * a + 2 * b + 4 * q, w: p.w, h: p.h };
}

/** The point `s` px round the track, clockwise from the top left corner's end. */
function edgeAt(k: Track, s: number): Edge {
  const { m, rc, a, b, q, w, h } = k;
  s = ((s % k.L) + k.L) % k.L;
  const corner = (cx: number, cy: number, a0: number, d: number): Edge => {
    const an = a0 + (d / q) * (Math.PI / 2), c = Math.cos(an), n = Math.sin(an);
    return [cx + c * rc, cy + n * rc, c, n];
  };
  if (s < a) return [m + rc + s, m, 0, -1];
  if ((s -= a) < q) return corner(w - m - rc, m + rc, -Math.PI / 2, s);
  if ((s -= q) < b) return [w - m, m + rc + s, 1, 0];
  if ((s -= b) < q) return corner(w - m - rc, h - m - rc, 0, s);
  if ((s -= q) < a) return [w - m - rc - s, h - m, 0, 1];
  if ((s -= a) < q) return corner(m + rc, h - m - rc, Math.PI / 2, s);
  if ((s -= q) < b) return [m, h - m - rc - s, -1, 0];
  return corner(m + rc, m + rc, Math.PI, s - b);
}

/** Something drawn on the map that the wisp stops over: where on the track, how far out it hovers, and the thing's own middle. */
interface Mark {
  s: number;
  d: number;
  x: number;
  y: number;
}

/** The red X's and compasses on the treasure map's band, where its painter puts them. */
function marks(k: Track, p: LifePiece): Mark[] {
  const { F, w, h } = p, { m, rc, a, b, q } = k;
  const top = (x: number): number => clamp01((x - m - rc) / Math.max(1, a)) * a;
  const right = (y: number): number => a + q + clamp01((y - m - rc) / Math.max(1, b)) * b;
  const left = (y: number): number => 2 * a + b + 3 * q + clamp01((h - m - rc - y) / Math.max(1, b)) * b;
  const coin = Math.min(h * 0.3, F * 6) + F * 1.15;
  return [
    { s: top(w * 0.4), d: 10, x: w * 0.4, y: F * 0.5 },
    { s: right(coin), d: 14, x: w - F * 0.5, y: coin },
    { s: right(h * 0.6), d: 10, x: w - F * 0.5, y: h * 0.6 },
    { s: a + q + b + q / 2, d: 10, x: w - F * 0.55, y: h - F * 0.55 },
    { s: left(F * 2.5), d: 15, x: F * 0.48, y: F * 2.5 },
  ];
}

/** Stop `i`: how far round the track, how far out from its line, and the mark it is over if any. */
interface Stop {
  s: number;
  d: number;
  mark: Mark | null;
}

function stop(i: number, seed: number, k: Track, ms: Mark[], lively: boolean): Stop {
  const base = seed * k.L + i * STRIDE;
  if (lively && rnd(i, seed + 7) < 0.85) {
    for (const mk of ms) {
      const s = mk.s + k.L * Math.round((base - mk.s) / k.L);
      if (Math.abs(s - base) <= STRIDE / 2) return { s, d: mk.d, mark: mk };
    }
  }
  // Mostly onward, now and then back a way for another look.
  const back = rnd(i, seed + 16) < 0.15 ? -STRIDE * 1.2 : 0;
  return { s: base + back + (rnd(i, seed + 1) - 0.5) * STRIDE * 1.2, d: lerp(-3, 12, rnd(i, seed + 2)), mark: null };
}

/** Out-and-back easing with a little wind-up before and a settle past the end. */
function travel(u: number): number {
  const c = 1.1, v = u * 2;
  return v < 1 ? (v * v * ((c + 1) * v - c)) / 2 : ((v - 2) * (v - 2) * ((c + 1) * (v - 2) + c) + 2) / 2;
}

/** When step `i`'s flight starts and how long it lasts, in seconds into the step. */
function flight(i: number, seed: number, from: Stop, to: Stop): [start: number, len: number] {
  const start = from.mark ? lerp(1.7, 2.2, rnd(i, seed + 3)) : lerp(0.15, 1.3, rnd(i, seed + 3));
  // Some flights are quick darts, some lazy drifts.
  const lazy = rnd(i, seed + 4) < 0.4 ? 1.7 : 1;
  const len = Math.min(STEP - start - 0.25, (0.9 + Math.abs(to.s - from.s) / 100) * lazy + rnd(i, seed + 15) * 0.4);
  return [start, len];
}

/** The stops and flights for one drawing, each worked out once however often it is asked for. */
interface Plan {
  stop(i: number): Stop;
  flight(i: number): [start: number, len: number];
}

function plan(seed: number, k: Track, ms: Mark[], lively: boolean): Plan {
  const stops = new Map<number, Stop>(), flights = new Map<number, [number, number]>();
  const p: Plan = {
    stop(i) {
      let st = stops.get(i);
      if (!st) stops.set(i, (st = stop(i, seed, k, ms, lively)));
      return st;
    },
    flight(i) {
      let f = flights.get(i);
      if (!f) flights.set(i, (f = flight(i, seed, p.stop(i), p.stop(i + 1))));
      return f;
    },
  };
  return p;
}

/** A soft bump: 0 at both ends of `u` in 0..1, 1 in its middle. */
const bump = (u: number): number => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));

/** Where the wisp is at time `T` on its own clock; and, while it is over a mark, the mark, how long since it came and how long till it goes. */
function where(T: number, seed: number, k: Track, pl: Plan): [x: number, y: number, mark: Mark | null, arrived: number, stay: number] {
  const i = Math.floor(T / STEP), tau = T - i * STEP;
  const from = pl.stop(i), to = pl.stop(i + 1);
  const [start, len] = pl.flight(i);
  const u = clamp01((tau - start) / len);
  // Now and then a loop-the-loop out over the edge: the flight slows to a stop at its middle while the loop goes round.
  const loop = Math.abs(to.s - from.s) > 50 && rnd(i, seed + 6) < 0.3 ? 8.5 : 0;
  const lu = loop ? clamp01((u - 0.25) / 0.5) : 0;
  const e = travel(loop ? (u - 0.25 * (lu - Math.sin(Math.PI * 2 * lu) / (Math.PI * 2))) / 0.75 : u);
  let s = lerp(from.s, to.s, e);
  // On the way it swoops out over the edge or dips in across the band.
  const swoop = loop ? 0 : lerp(-6, 9, rnd(i, seed + 5)) * bump(u);
  let d = lerp(from.d, to.d, ease(u)) + swoop;
  if (loop) {
    const an = ease(lu) * Math.PI * 2;
    s += Math.sin(an) * loop * Math.sign(to.s - from.s);
    d += (1 - Math.cos(an)) * loop;
  }
  // A nod at the mark it has just reached: two dips toward it, the second smaller.
  let nod = 0, mark: Mark | null = null, arrived = -1, stay = 0;
  const linger = (st: Stop, came: number, goes: number): void => {
    if (!st.mark || T < came || T > goes) return;
    mark = st.mark;
    arrived = T - came;
    stay = goes - T;
    const n = (arrived - 0.25) / 0.9;
    nod = n > 0 && n < 1 ? Math.sin(n * Math.PI * 2) ** 2 * (n < 0.5 ? 1 : 0.6) : 0;
  };
  if (to.mark) {
    const [a1] = pl.flight(i + 1);
    linger(to, i * STEP + start + len * 0.8, (i + 1) * STEP + a1);
  }
  if (from.mark) {
    const [a0, l0] = pl.flight(i - 1);
    linger(from, (i - 1) * STEP + a0 + l0 * 0.8, i * STEP + start);
  }
  const [ex, ey, nx, ny] = edgeAt(k, s);
  d -= nod * 4;
  return [ex + nx * d, ey + ny * d, mark, arrived, stay];
}

/** The always-on float on top of where it is going: a slow bob and a little drift. */
function float(t: number, seed: number, slow: number): [number, number] {
  const f = seed * 40;
  return [Math.sin(t * 1.3 * slow + f) * 1.4 + Math.sin(t * 0.53 * slow + f * 2) * 1.1, Math.sin(t * 2.2 * slow + f) * 1.7];
}

/** A four-pointed twinkle at (x, y), `r` to its tips. */
function twinkle(g: Ctx, x: number, y: number, r: number): void {
  const n = r * 0.28;
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + n, y - n, x + r, y);
  g.quadraticCurveTo(x + n, y + n, x, y + r);
  g.quadraticCurveTo(x - n, y + n, x - r, y);
  g.quadraticCurveTo(x - n, y - n, x, y - r);
}

/** The flame's outline: a round head of radius `r` at the origin, its tail `len` radii long along +x, its tip `curl` px aside. */
function flame(g: Ctx, r: number, len: number, curl: number): void {
  const a0 = Math.PI * 0.4, w1 = curl * 0.35, w2 = -curl * 0.55;
  g.beginPath();
  g.arc(0, 0, r, a0, Math.PI * 2 - a0);
  g.bezierCurveTo(r * 1.15, -r * 0.8 - w1, r * len * 0.62, -r * 0.2 + w2, r * len, curl);
  g.bezierCurveTo(r * len * 0.55, r * 0.3 + w2, r * 1.15, r * 0.8 - w1, Math.cos(a0) * r, Math.sin(a0) * r);
  g.closePath();
}

export function wisp(g: Ctx, p: LifePiece, t: number, map: boolean): void {
  const k = track(p), seed = rnd(p.seed, 3), pl = plan(seed, k, marks(k, p), map);
  // Drowsy, with no map, it lives on a slower clock: longer rests, slower flights.
  const slow = map ? 1 : 0.42, T = t * slow + seed * 97;
  const at = (tt: number): [number, number] => {
    const [x, y] = where(tt * slow + seed * 97, seed, k, pl), [fx, fy] = float(tt, seed, slow);
    return [x + fx, y + fy];
  };
  const [bx, by, mark, arrived, stay] = where(T, seed, k, pl);
  const [fx, fy] = float(t, seed, slow);
  const x = bx + fx, y = by + fy;
  const [px, py] = at(t - 1 / 30);
  const vx = (x - px) * 30, vy = (y - py) * 30, speed = Math.hypot(vx, vy);

  // Brightness: a faint shimmer, and now and then a quick double flicker.
  const slot = Math.floor(T / 3.1), fu = (T - slot * 3.1 - rnd(slot, seed + 8) * 2.4) / 0.4;
  const flick = rnd(slot, seed + 9) < 0.4 && fu > 0 && fu < 1 ? 0.55 * Math.abs(Math.sin(fu * Math.PI * 2)) : 0;
  const shimmer = 1 + 0.07 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
  const lit = (map ? 1 : 0.5) * shimmer * (1 - flick);

  // The sparkles it leaves: each stays where it was left, rises a touch and fades.
  const n0 = Math.floor(t / SPARK_EVERY), many = Math.ceil(SPARK_LIFE / SPARK_EVERY);
  let [qx, qy] = at((n0 + 1) * SPARK_EVERY);
  for (let j = 0; j <= many; j++) {
    const n = n0 - j, te = n * SPARK_EVERY, age = (t - te) / SPARK_LIFE, [sx, sy] = at(te);
    // How fast it was going when it left this one: none are left while it hovers.
    const moving = clamp01((Math.hypot(sx - qx, sy - qy) / SPARK_EVERY - 10) / 50);
    [qx, qy] = [sx, sy];
    if (age >= 1 || rnd(n, seed + 10) < (map ? 0.1 : 0.55)) continue;
    const a = moving * (1 - age) ** 1.6 * (map ? 0.95 : 0.5);
    if (a < 0.03) continue;
    const cx = sx + (rnd(n, seed + 11) - 0.5) * 6, cy = sy + (rnd(n, seed + 12) - 0.5) * 6 - age * 5;
    const size = (1.5 + rnd(n, seed + 13) * 1.6) * (1 - age * 0.6) * (0.75 + 0.25 * Math.sin(age * 20 + n));
    // Fresh ones pale, older ones the wisp's deeper blue.
    g.globalAlpha = a;
    g.fillStyle = age < 0.3 ? 'rgb(160, 210, 255)' : map ? 'rgb(95, 160, 235)' : 'rgb(130, 165, 210)';
    g.beginPath();
    twinkle(g, cx, cy, size);
    g.fill();
  }
  // Over a mark, as its nod dips: a ring of its own sparkles opening off the mark.
  if (mark && arrived > 0.4 && arrived < 1.7) {
    const u = (arrived - 0.4) / 1.3, rr = 5 + ease(u) * 10;
    g.globalAlpha = (1 - u) ** 1.2 * Math.min(1, lit * 1.4);
    for (const [col, size] of [['rgb(110, 175, 245)', 2.4], ['rgb(240, 250, 255)', 1.2]] as const) {
      g.fillStyle = col;
      g.beginPath();
      for (let j = 0; j < 6; j++) {
        const an = (j / 6) * Math.PI * 2 + seed * 6 + u * 0.8;
        twinkle(g, mark.x + Math.cos(an) * rr, mark.y + Math.sin(an) * rr * 0.85, size * (1 - u * 0.5));
      }
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // The light it gives off.
  glow(g, x, y, (map ? 15 : 10) * (0.9 + 0.1 * shimmer), '120, 185, 255', 0.55 * lit);

  // The flame: its tail streams back from where it is going and stands up when it is still.
  const tx = -vx * 0.03, ty = -1 - vy * 0.03, tl = Math.hypot(tx, ty) || 1;
  // Asleep, it breathes: slowly swells and settles.
  const stretch = 1 + Math.min(0.22, speed / 300), r = (map ? 3.1 : 2.8 * (1 + 0.06 * Math.sin(t * 1.5))) * SIZE;
  const va = speed > 1 ? Math.atan2(vy, vx) : 0;
  g.save();
  g.translate(x, y);
  g.rotate(va);
  g.scale(stretch, 1 / stretch);
  g.rotate(Math.atan2(ty, tx) - va);
  // The tail waves, the aura round it a beat behind the flame.
  const curlAt = (tt: number): number => (Math.sin(tt * 5.3 + seed * 9) + 0.4 * Math.sin(tt * 8.9)) * r * 0.5;
  const curl = curlAt(t) * (map ? 1 : 0.6), len = (map ? 2.2 : 1.9) + Math.min(1, tl * 0.25) + 0.15 * Math.sin(t * 7.7);
  g.globalAlpha = 0.3 * lit + 0.12;
  flame(g, r * 1.45, len * 0.95, curlAt(t - 0.12) * 1.3);
  g.fillStyle = '#5d9be6';
  g.fill();
  g.globalAlpha = Math.min(1, 0.55 + 0.5 * lit);
  flame(g, r, len, curl);
  g.fillStyle = map ? '#9fd2ff' : '#94bde6';
  g.fill();
  g.globalAlpha = Math.min(1, 0.6 + 0.4 * lit);
  flame(g, r * 0.66, len * 0.8, curl * 0.7);
  g.fillStyle = map ? '#f2fbff' : '#d6e8f7';
  g.fill();
  g.restore();
  g.globalAlpha = 1;

  // The face: two dots, looking where it goes, or down at the mark it is over.
  const go = clamp01((speed - 4) / 25), sp = speed || 1;
  let lx = lerp(Math.sin(t * 0.7 + seed * 5) * 0.6, vx / sp, go), ly = lerp(0.25, vy / sp, go);
  const over = mark ? clamp01(arrived / 0.25) * clamp01(stay / 0.3) : 0;
  if (mark && over > 0) {
    const dx = mark.x - x, dy = mark.y - y, dl = Math.hypot(dx, dy) || 1;
    lx = lerp(lx, dx / dl, over);
    ly = lerp(ly, dy / dl, over);
  }
  // The face is drawn in units of `f`, which grows with the flame (1 at a 4.5 px radius).
  const f = r / 4.5, ex = x + lx * 0.9 * f, ey = y + (0.4 + ly * 0.7) * f, gap = 1.45 * f;
  g.strokeStyle = g.fillStyle = '#22355f';
  g.lineWidth = 0.75 * f;
  g.lineCap = 'round';
  const happy = mark !== null && arrived > 0.2 && arrived < 1.9;
  const bslot = Math.floor(t / 2.7), bu = t - bslot * 2.7 - rnd(bslot, seed + 14) * 2.4;
  const blink = bu > 0 && bu < 0.14;
  for (const side of [-1, 1]) {
    const cx = ex + side * gap;
    g.beginPath();
    if (!map) {
      // Asleep: closed, curved down.
      g.arc(cx, ey - 0.6 * f, 0.85 * f, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
    } else if (happy) {
      // Delighted: closed, curved up.
      g.arc(cx, ey + 0.5 * f, 0.85 * f, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
    } else if (blink) {
      g.moveTo(cx - 0.7 * f, ey);
      g.lineTo(cx + 0.7 * f, ey);
      g.stroke();
    } else {
      g.ellipse(cx, ey, 0.7 * f, 0.85 * f, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Cheeks, very faint.
  g.fillStyle = 'rgba(255, 150, 180, 0.35)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(ex + side * gap * 1.75, ey + 1.1 * f, 0.75 * f, 0, Math.PI * 2);
    g.fill();
  }
  // Asleep: now and then a little z drifts up off it and fades.
  if (!map) {
    const zu = ((t + seed * 9) % 4.6) / 2.4;
    if (zu < 1) {
      const zs = 1 + zu * 0.8, zx = x + 4 + zu * 4 + Math.sin(zu * 6) * 0.8, zy = y - 6 - zu * 9;
      g.globalAlpha = Math.sin(Math.PI * zu) * 0.85;
      g.strokeStyle = '#5a7fb3';
      g.lineWidth = 0.8;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(zx - zs, zy - zs);
      g.lineTo(zx + zs, zy - zs);
      g.lineTo(zx - zs, zy + zs);
      g.lineTo(zx + zs, zy + zs);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
}
