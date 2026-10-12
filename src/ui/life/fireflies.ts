import { clamp01, ease, glow, lerp, rnd, SIZE, type Ctx, type LifePiece } from './kit';

/** How many fireflies live on the mossy frame after dark. */
export const FIREFLIES = 5;

/**
 * The line the fireflies keep to: a rounded rectangle down the middle of the
 * band, measured by arc length `s` from the start of the top's straight run,
 * clockwise, with `d` px outward from it. The perches are on it: the moss,
 * the grass tips, the pebbles on the top edge and the corner stones.
 */
interface Track {
  w: number;
  h: number;
  c: number;
  rc: number;
  a: number;
  b: number;
  q: number;
  L: number;
  /** Perches in order round the frame: arc length and how far out the firefly sits. */
  spots: Array<[number, number]>;
  /** The window's seed folded small, so `rnd` is fed small whole numbers. */
  seed: number;
  /** How fast the homes creep round, in perches a second, and where they stand at nought. */
  creep: number;
  base: number;
}

/** The track for this window, from the same places the turf painter puts its moss, grass and pebbles. */
function track(p: LifePiece): Track {
  const { w, h, F } = p;
  const c = F / 2, rc = Math.max(1, Math.min(F * 1.2, w / 2 - c, h / 2 - c));
  const a = w - 2 * c - 2 * rc, b = h - 2 * c - 2 * rc, q = (Math.PI / 2) * rc;
  const top = (x: number): number => Math.min(a, Math.max(0, x - c - rc));
  const right = (y: number): number => a + q + Math.min(b, Math.max(0, y - c - rc));
  const foot = (x: number): number => a + b + 2 * q + Math.min(a, Math.max(0, w - c - rc - x));
  const left = (y: number): number => 2 * a + b + 3 * q + Math.min(b, Math.max(0, h - c - rc - y));
  // On a pebble's back, clinging to grass blades, on a corner stone, on the moss, on the wood.
  const pebble = c + F * 0.31 + 1.5, grass = c - F * 0.2 + F * 0.65, stone = F * 0.7, moss = F * 0.45, wood = F * 0.3;
  const spots: Array<[number, number]> = [
    [top(w * 0.18), pebble], [top(w * 0.32), grass], [top(w * 0.46), wood], [top(w * 0.6), grass], [top(w * 0.74), pebble],
    [a + q / 2, stone],
    [right(h * 0.22), moss], [right(h * 0.48), moss], [right(h * 0.72), moss],
    [a + b + q * 1.5, stone],
    [foot(w * 0.82), wood], [foot(w * 0.66), wood], [foot(w * 0.48), wood], [foot(w * 0.3), wood], [foot(w * 0.14), wood],
    [2 * a + b + q * 2.5, stone],
    [left(h * 0.8), moss], [left(h * 0.58), moss], [left(h * 0.3), moss],
    [2 * a + 2 * b + q * 3.5, stone],
  ];
  const seed = p.seed % 997;
  const creep = (1 / 50 + rnd(seed, 4) / 75) * (rnd(seed, 5) < 0.5 ? -1 : 1);
  return { w, h, c, rc, a, b, q, L: 2 * a + 2 * b + 4 * q, spots, seed, creep, base: rnd(seed, 6) * spots.length };
}

/** The point `s` along the track, `d` out from it. */
function at(T: Track, s: number, d: number): [number, number] {
  const { w, h, c, rc, a, b, q, L } = T;
  let u = ((s % L) + L) % L;
  if (u < a) return [c + rc + u, c - d];
  u -= a;
  if (u >= q) {
    u -= q;
    if (u < b) return [w - c + d, c + rc + u];
    u -= b;
    if (u >= q) {
      u -= q;
      if (u < a) return [w - c - rc - u, h - c + d];
      u -= a;
      if (u >= q) {
        u -= q;
        if (u < b) return [c - d, h - c - rc - u];
        u -= b;
        // Round the top left corner.
        const th = Math.PI + u / rc;
        return [c + rc + (rc + d) * Math.cos(th), c + rc + (rc + d) * Math.sin(th)];
      }
      // Round the bottom left corner.
      const th = Math.PI / 2 + u / rc;
      return [c + rc + (rc + d) * Math.cos(th), h - c - rc + (rc + d) * Math.sin(th)];
    }
    // Round the bottom right corner.
    const th = u / rc;
    return [w - c - rc + (rc + d) * Math.cos(th), h - c - rc + (rc + d) * Math.sin(th)];
  }
  // Round the top right corner.
  const th = -Math.PI / 2 + u / rc;
  return [w - c - rc + (rc + d) * Math.cos(th), c + rc + (rc + d) * Math.sin(th)];
}

/** Which way is out from the frame at `s`, as a unit vector. */
function outward(T: Track, s: number): [number, number] {
  const [x0, y0] = at(T, s, 0), [x1, y1] = at(T, s, 1);
  return [x1 - x0, y1 - y0];
}

/**
 * Each firefly's home, in perches round the frame from the first. Fireflies
 * 0 and 1 keep company, and so do 2 and 3, so their answering flashes are
 * seen together; 4 goes round alone. Each wanders up to `ROAM` perches either
 * way of its home, and all the homes creep round the frame together. The two
 * of a pair may share a perch, one sat each side of it; no others ever do.
 */
const HOME = [0, 1.5, 8.5, 10, 15];
const ROAM = [0.8, 0.8, 0.8, 0.8, 1.3];

/** The perch firefly `i` sits on at the start of leg `k`, which starts at `t0`, as [s, d]: never more than one perch from the last. */
function perch(T: Track, i: number, k: number, t0: number): [number, number] {
  const n = T.spots.length;
  const j = Math.floor(HOME[i] + T.base + t0 * T.creep + ROAM[i] * Math.sin(k * 0.45 + i * 2.6) + 0.5);
  const [s, d] = T.spots[((j % n) + n) % n];
  return [s + (i & 1 ? 4 : -4) + (rnd(i * 13 + 1, k) - 0.5) * 2, d + rnd(i * 13 + 2, k) * 1.5];
}

/** When leg `k` of firefly `i` starts: legs of `period` seconds, give or take 20%, in order. */
const legStart = (i: number, k: number, period: number, phase: number): number => period * (k + 0.2 * Math.sin(k * 1.7 + i * 2.3)) + phase;

/** One leg of a firefly's night: sat on perch `A`, then flown to perch `B`. */
interface Leg {
  i: number;
  k: number;
  /** When it starts, how long it sits, how long it flies. */
  t0: number;
  sit: number;
  fly: number;
  A: [number, number];
  B: [number, number];
  /** Along the track from A to B, the short way round. */
  ds: number;
  /** Which way it faces sat (the way it came in), and flying to B. */
  came: number;
  goes: number;
  /** It turns round half way through the sit. */
  turns: boolean;
}

/** The leg firefly `i` is on at `t`. */
function legAt(T: Track, i: number, t: number): Leg {
  const period = 8.5 + rnd(T.seed + i, 1) * 3.5, phase = -rnd(T.seed + i, 2) * period * 40;
  let k = Math.floor((t - phase) / period);
  while (legStart(i, k, period, phase) > t) k--;
  while (legStart(i, k + 1, period, phase) <= t) k++;
  const t0 = legStart(i, k, period, phase), t1 = legStart(i, k + 1, period, phase), len = t1 - t0;
  const A = perch(T, i, k, t0), B = perch(T, i, k + 1, t1), Z = perch(T, i, k - 1, legStart(i, k - 1, period, phase));
  let ds = B[0] - A[0];
  if (ds > T.L / 2) ds -= T.L;
  if (ds < -T.L / 2) ds += T.L;
  const fly = Math.min(len * 0.85, (3 + Math.abs(ds) / 16) * (0.85 + rnd(i * 7 + 3, k) * 0.3));
  const ax = at(T, A[0], A[1])[0], zx = at(T, Z[0], Z[1])[0], bx = at(T, B[0], B[1])[0];
  const came = Math.sign(ax - zx) || (rnd(i, k) < 0.5 ? -1 : 1);
  const sit = len - fly;
  return { i, k, t0, sit, fly, A, B, ds, came, goes: Math.sign(bx - ax) || came, turns: sit > 3 && rnd(i * 7 + 4, k) < 0.4 };
}

/** Where a firefly is at `t` on its leg. */
interface Pose {
  x: number;
  y: number;
  /** Which way it faces, -1 left to 1 right (it turns round through 0, end-on). */
  face: number;
  /** Wings: 0 folded, 1 open. */
  wings: number;
  /** Glowing where it sits: 0 to 1. */
  rest: number;
}

/** Where a firefly on leg `L` is at `t`: sat on A until its sit is up, then on the wing to B. */
function place(T: Track, L: Leg, t: number): Pose {
  const { i, k, sit, fly, A, B, ds } = L, tau = t - L.t0;
  if (tau < sit) {
    // Sat: wings folding after landing and opening before take-off; sometimes turns round, sometimes glows.
    const [x, y] = at(T, A[0], A[1]);
    const turn = L.turns ? ease(clamp01((tau - sit * 0.5) / 0.45)) : 0;
    const rest = sit > 2.6 && rnd(i * 7 + 5, k) < 0.6 ? ease(clamp01((tau - 0.5) / 0.9)) * ease(clamp01((sit - 0.4 - tau) / 1.1)) : 0;
    const wings = Math.max(clamp01(1 - tau / 0.45), clamp01((tau - sit + 0.4) / 0.4));
    return { x, y, face: L.came * (1 - 2 * turn), wings, rest };
  }
  // In the air: straight up off the perch, a lazy curling drift, and down onto the next. Out and
  // along are taken between the two perches' own, so rounding a corner does not fling it wide.
  const u = Math.min(1, (tau - sit) / fly), e = ease(u), hump = Math.sin(Math.PI * u);
  // Short hops rise less and curl less than long flights.
  const span = clamp01(fly / 5);
  const lift = (5 + rnd(i * 7 + 6, k) * 11) * span, sway = (3 + rnd(i * 7 + 7, k) * 7) * span;
  const n1 = fly > 4.5 && rnd(i * 7 + 8, k) < 0.5 ? 2 : 1, ph = rnd(i * 7 + 9, k) * 6.3;
  const [nax, nay] = outward(T, A[0]), [nbx, nby] = outward(T, B[0]);
  let nx = lerp(nax, nbx, e), ny = lerp(nay, nby, e);
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  const out = lift * hump + 3 * hump * Math.sin(2 * Math.PI * u * (n1 + 1) + ph * 1.7);
  const along = sway * hump * Math.sin(2 * Math.PI * u * n1 + ph);
  const [x, y] = at(T, A[0] + ds * e, lerp(A[1], B[1], e));
  // Turns from the way it sat to the way it is going over the first part of the flight.
  const sat = L.turns ? -L.came : L.came, face = lerp(sat, L.goes, ease(clamp01(u * 3)));
  return { x: x + nx * out - ny * along, y: y + ny * out + nx * along + 1.2 * hump * Math.sin(t * 2.3 + i), face, wings: 1, rest: 0 };
}

/** A firefly's flash at `tau` seconds after it starts: a soft swell, a bright top, a slow fade. */
function flash(tau: number, rise = 0.3, fall = 0.85): number {
  if (tau < 0) return 0;
  if (tau < rise) return ease(tau / rise);
  const v = 1 - (tau - rise) / fall;
  return v > 0 ? v * v : 0;
}

/** Firefly `i`'s own flashes at `t`: one every 2.8 to 4.6 s, uneven, some missed, some doubled. */
function ownLight(seed: number, i: number, t: number): number {
  const P = 2.8 + rnd(seed + i, 8) * 1.8, off = rnd(seed + i, 9) * P;
  const n = Math.floor((t + off) / P);
  let b = 0;
  for (let m = n - 1; m <= n; m++) {
    if (rnd(i * 11 + 1, m) < 0.25) continue;
    const t0 = m * P - off + rnd(i * 11 + 2, m) * 0.8, amp = 0.7 + 0.3 * rnd(i * 11 + 3, m);
    b = Math.max(b, amp * flash(t - t0));
    if (rnd(i * 11 + 4, m) < 0.25) b = Math.max(b, amp * 0.75 * flash(t - t0 - 0.55, 0.22, 0.6));
  }
  return b;
}

/** A call and its answer between the two of a pair: one flashes, the other answers, now and then the first again. */
function talk(seed: number, i: number, t: number): number {
  if (i > 3) return 0;
  const pair = i >> 1, P = 6.8 + pair * 1.9, off = rnd(seed + pair, 10) * P;
  const n = Math.floor((t + off) / P);
  let b = 0;
  for (let m = n - 1; m <= n; m++) {
    if (rnd(pair * 5 + 20, m) > 0.55) continue;
    const call = m * P - off + rnd(pair * 5 + 21, m) * 1.5, reply = call + 0.85 + rnd(pair * 5 + 22, m) * 0.35;
    const caller = (pair * 2 + (rnd(pair * 5 + 23, m) < 0.5 ? 0 : 1)) === i;
    if (caller) {
      b = Math.max(b, flash(t - call));
      if (rnd(pair * 5 + 24, m) < 0.4) b = Math.max(b, 0.8 * flash(t - reply - 0.9));
    } else b = Math.max(b, 0.92 * flash(t - reply));
  }
  return b;
}

/** Warm greenish gold: the halo, the light round the lantern, the lantern's heart. */
const HALO = '176, 222, 64', WARM = '236, 244, 120', HEART = '255, 252, 196';

/**
 * Fireflies on the mossy frame after dark. Each goes from perch to perch
 * round the band (moss, grass tips, the pebbles on top, the corner stones),
 * sitting a while, then lifting straight off and drifting in a slow curl to
 * the next. Each flashes on its own uneven beat; a pair now and then flashes
 * in answer to each other; one sat on a perch sometimes glows there a while.
 * The little dark body shows only against its own light.
 */
export function fireflies(g: Ctx, p: LifePiece, t: number): void {
  const T = track(p);
  const k = SIZE;
  for (let i = 0; i < FIREFLIES; i++) {
    const L = legAt(T, i, t), o = place(T, L, t);
    // A flash as it lifts off, most legs; its own beat, softer while sat; the pair's talk; the glow where it sits.
    const up = rnd(i * 7 + 10, L.k) < 0.65 ? flash(t - L.t0 - L.sit - 0.1, 0.35, 1) : 0;
    const own = ownLight(T.seed, i, t) * (t - L.t0 < L.sit ? 0.6 : 1);
    const b = Math.min(1, Math.max(up, own, talk(T.seed, i, t), o.rest * (0.44 + 0.1 * Math.sin(t * 1.7 + i) + 0.04 * Math.sin(t * 4.3 + i * 2))));
    if (b < 0.012) continue;
    // Facing and hang come from how it is moving: it turns round through end-on, and hangs its tail in flight.
    const h = 0.12, still = t - L.t0 < L.sit - h;
    const a = still ? o : place(T, L, t - h), z = still ? o : place(T, L, t + h);
    const vx = (z.x - a.x) / (2 * h), vy = (z.y - a.y) / (2 * h), speed = Math.hypot(vx, vy);
    const air = clamp01(speed / 5);
    const f = lerp(o.face, Math.max(-1, Math.min(1, vx / 4 + o.face * 0.6)), air);
    const droop = lerp(0.12, 0.55 - clamp01(-vy / 20) * 0.35, air);
    // The lantern, at the tail's tip.
    const lx = o.x - f * 1.9 * k * Math.cos(droop), ly = o.y + 1.9 * k * Math.sin(droop);
    const lit = clamp01(b * 1.7);
    g.save();
    g.globalCompositeOperation = 'lighter';
    // The halo is kept short of the window's room, where it would be cut off square.
    const room = Math.hypot(Math.max(0, p.F - lx, lx - p.w + p.F), Math.max(0, p.F - ly, ly - p.h + p.F));
    glow(g, lx, ly, Math.min(7 + 9 * b, 3 + room * 1.1), HALO, 0.58 * b);
    glow(g, lx, ly, 3.5 + 2.5 * b, WARM, 0.75 * b);
    g.restore();
    if (lit > 0.03) {
      g.save();
      g.translate(o.x, o.y);
      g.scale(f, 1);
      g.rotate(-droop);
      g.globalAlpha = lit * 0.95;
      // Wings, a pale shimmer above the back while open.
      if (o.wings > 0.02) {
        g.fillStyle = `rgba(230, 240, 210, ${0.35 * o.wings * (0.65 + 0.35 * Math.sin(t * 47 + i * 3))})`;
        for (const r of [-0.45, -0.95]) {
          g.beginPath();
          g.ellipse(-0.2 * k, -0.7 * k, 1.35 * k, 0.55 * k, r * o.wings, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Body: a dark abdomen, the head shield dull red with a dark spot on it.
      g.fillStyle = '#2b2620';
      g.beginPath();
      g.ellipse(-0.6 * k, 0, 1.25 * k, 0.75 * k, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6e3a30';
      g.beginPath();
      g.ellipse(0.75 * k, -0.05 * k, 0.6 * k, 0.6 * k, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1d1a16';
      g.beginPath();
      g.arc(0.85 * k, -0.1 * k, 0.32 * k, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // The lantern's heart, over the tail.
    g.save();
    g.globalCompositeOperation = 'lighter';
    glow(g, lx, ly, 1.8 * k, HEART, b);
    g.restore();
  }
}
