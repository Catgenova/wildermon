import { SIZE, clamp01, ease, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * The robin on the oak board (Social): once every `CYCLE` seconds it flies in
 * on a flap-and-glide arc, brakes and lands on the board's top edge, and
 * spends a while there (hopping along, turning about, looking round and out
 * at the viewer, cocking its head, preening, flicking its tail, singing a few
 * notes) before it crouches and flies off the way it faces.
 *
 * Each cycle is planned afresh off its own number (`plan`), so nothing
 * carries over from one visit to the next. Drawn by day only.
 */

/** Seconds from one visit's start to the next. */
const CYCLE = 56;

/** Pixels per unit the bird's shapes are written in. */
const U = SIZE;

/** The top of the board's top plank, where its feet go. */
const EDGE = -1.5;

/** Feet below the body's middle when standing, in units. */
const LEGS = 5.9;

/** Seconds of the flight in, and of the flight out. */
const TIN = 1.9;
const TOUT = 1.8;

/** Seconds of the braking flaps at the end of the flight in. */
const FLARE = 0.36;

const INK = '#3a2a20';
const BACK = '#9a7450';
const TAIL = '#7c5a3c';
const WING = '#87633f';
const WING_FAR = '#634830';
const WING_LIT = '#c7a47c';
const BREAST = '#ef8a4e';
const BREAST_LIT = '#f8b07c';
const GREY = '#c9c3b8';
const BELLY = '#f7eedd';
const LEG = '#9a5e4a';
const BEAK = '#3b2c24';
const MOUTH = '#a8483a';
const EYE = '#1d1410';

/** What it is doing, one beat of a visit. */
const SETTLE = 0, IDLE = 1, HOP = 2, TURN = 3, LOOK = 4, COCK = 5, PREEN = 6, SING = 7, BOB = 8, CROUCH = 9, HOPS = 10;

/** One beat: what, from when, for how long, where (and where to, for a hop), facing which way, and a number of its own. */
interface Act {
  k: number;
  t0: number;
  d: number;
  x0: number;
  x1: number;
  f: number;
  r: number;
}

/** One visit: where it comes from and lands, its beats on the edge, and where it leaves from. */
interface Visit {
  /** When the flight in starts, in seconds into the cycle. */
  t0: number;
  dir: number;
  perch: number;
  /** How far off to the side, and how far up, it comes from and goes to. */
  far: number;
  high: number;
  acts: Act[];
  /** When it takes off, where from, and which way. */
  out: number;
  x: number;
  f: number;
}

/** The bird's pose at one moment. */
interface Pose {
  /** Its body's middle, in px. */
  x: number;
  y: number;
  /** 1 facing right, -1 left. */
  face: number;
  /** The body turned toward the viewer: 0 side on, π/2 facing out, π turned round. */
  yaw: number;
  /** Nose down, in radians (negative is nose up). */
  pitch: number;
  /** Squash and stretch. */
  sx: number;
  sy: number;
  /** The head turned on the body, as `yaw`. */
  head: number;
  /** Beak down, in radians, and the head rolled toward its shoulder. */
  tilt: number;
  roll: number;
  /** Head shifted forward and down, in units. */
  hx: number;
  hy: number;
  /** Wings: 1 folded on the back, 0 spread; a spread wing's height, 1 up to -0.9 down; swung forward. */
  fold: number;
  lift: number;
  sweep: number;
  /** Feet below the body's middle in units; under 3.6 they are tucked away. */
  feet: number;
  /** Tail cocked up in radians, and spread 0..1. */
  tail: number;
  fan: number;
  beak: number;
  blink: number;
  alpha: number;
  /** How dark its shadow on the edge is, 0..1. */
  shade: number;
}

/** 0 to 1 and back over `w` seconds from `at`: a soft bump. */
const bump = (s: number, at: number, w: number): number => (s > at && s < at + w ? Math.sin((Math.PI * (s - at)) / w) : 0);

/** 0 to 1, quickly, from `at` over `d` seconds: how a bird snaps its head from one hold to the next. */
const snap = (s: number, at: number, d = 0.09): number => ease(clamp01((s - at) / d));

/** 0 to 1 from `a` and back to 0 from `b`, each over `e` seconds: a pose taken up and let go. */
const held = (s: number, a: number, b: number, e = 0.2): number => ease(clamp01((s - a) / e)) - ease(clamp01((s - b) / e));

/** Wing height through one beat, `q` 0..1: a quick downstroke and a slower recovery. */
const beat = (q: number): number => (q < 0.42 ? 1 - 1.9 * ease(q / 0.42) : -0.9 + 1.9 * ease((q - 0.42) / 0.58));

/** Seconds per wingbeat in level flight. */
const BEAT = 0.16;

/** Flap and glide: three beats and then a glide on raised wings, over and over; wing height, and the body's rise in px. */
function flapGlide(s: number): [number, number] {
  const B = BEAT * 3, G = 0.24, m = ((s % (B + G)) + B + G) % (B + G);
  if (m < B) return [beat((m % BEAT) / BEAT), -2.2 * ease(m / B)];
  const q = (m - B) / G;
  return [1 - 0.6 * Math.sin(Math.PI * q), -2.2 * (1 - ease(q))];
}

/** A point `s` along a cubic curve, and its heading. */
function bez(a: number[], b: number[], c: number[], d: number[], s: number): [number, number, number, number] {
  const v = 1 - s;
  const x = v * v * v * a[0] + 3 * v * v * s * b[0] + 3 * v * s * s * c[0] + s * s * s * d[0];
  const y = v * v * v * a[1] + 3 * v * v * s * b[1] + 3 * v * s * s * c[1] + s * s * s * d[1];
  const dx = 3 * v * v * (b[0] - a[0]) + 6 * v * s * (c[0] - b[0]) + 3 * s * s * (d[0] - c[0]);
  const dy = 3 * v * v * (b[1] - a[1]) + 6 * v * s * (c[1] - b[1]) + 3 * s * s * (d[1] - c[1]);
  return [x, y, dx, dy];
}

/** Nose down for a flight heading (dx, dy), kept within reason. */
const heading = (dx: number, dy: number): number => Math.max(-0.5, Math.min(0.45, Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.7));

/** How long each beat on the edge lasts, off its own number. */
const LENGTH: Record<number, (r: number) => number> = {
  [LOOK]: (r) => 1.9 + 0.6 * r,
  [COCK]: (r) => 1.3 + 0.4 * r,
  [PREEN]: (r) => 2.8 + 0.6 * r,
  [SING]: (r) => 2.6 + 0.8 * r,
  [BOB]: () => 1.1,
};

/** Cycle `k`'s visit: where it lands and what it does there, the same every time it is asked. */
function plan(p: LifePiece, k: number): Visit {
  const s = p.seed % 9973;
  const r = (i: number): number => rnd(s + i * 7.31, k);
  const F = p.F;
  const lo = F * 1.7;
  // Clear of the brass corners, and of the sketches pinned at the top right when the board is wide enough for them.
  const hi = Math.max(lo, p.w > F * 10 ? p.w - F * 6.7 : p.w - F * 1.7);
  const dir = r(1) < 0.5 ? 1 : -1;
  let x = lerp(lo, hi, 0.2 + 0.6 * r(2)), f = dir, t = 1 + 3 * r(3) + TIN;
  const v: Visit = { t0: t - TIN, dir, perch: x, far: 200 + 60 * r(4), high: 90 + 50 * r(5), acts: [], out: 0, x: 0, f: 0 };
  const add = (kind: number, d: number, dx = 0): void => {
    v.acts.push({ k: kind, t0: t, d, x0: x, x1: x + dx, f, r: r(40 + v.acts.length) });
    t += d;
    x += dx;
    if (kind === TURN) f = -f;
  };
  add(SETTLE, 0.8);
  // Four or five of these, in an order of its own; nearly always a song among them.
  const pool = [LOOK, SING, PREEN, BOB, COCK, HOPS].map((b, i) => [b, r(10 + i)]).sort((a, b) => a[1] - b[1]);
  const n = 4 + (r(6) < 0.5 ? 1 : 0);
  const beats = pool.slice(0, n).map((b) => b[0]);
  if (!beats.includes(SING) && r(7) < 0.85) beats[n - 1] = SING;
  beats.forEach((b, i) => {
    add(IDLE, 0.6 + 0.9 * r(20 + i));
    if (b === HOPS) {
      const hops = 1 + Math.floor(r(30 + i) * 3);
      for (let j = 0; j < hops; j++) {
        let dx = f * (6 + 4 * r(50 + i * 4 + j));
        if (x + dx < lo || x + dx > hi) {
          add(TURN, 0.5);
          add(IDLE, 0.25);
          dx = x - dx < lo || x - dx > hi ? 0 : -dx;
        }
        add(HOP, 0.42, dx);
        add(IDLE, 0.12 + 0.3 * r(60 + i * 4 + j));
      }
    } else add(b, LENGTH[b](r(70 + i)));
    if (r(80 + i) < 0.25) {
      add(IDLE, 0.4);
      add(TURN, 0.5);
    }
  });
  add(IDLE, 0.5 + 0.6 * r(8));
  add(CROUCH, 0.3);
  v.out = t;
  v.x = x;
  v.f = f;
  return v;
}

/** Standing still on the edge at `x`, facing `f`. */
function rest(x: number, f: number): Pose {
  return { x, y: 0, face: f, yaw: 0, pitch: 0, sx: 1, sy: 1, head: 0, tilt: 0, roll: 0, hx: 0, hy: 0, fold: 1, lift: 1, sweep: 0, feet: LEGS, tail: 0.18, fan: 0, beak: 0, blink: 0, alpha: 1, shade: 1 };
}

/** When each note of a song comes, off the song's own number. */
function notesOf(a: Act): number[] {
  const n = a.r < 0.5 ? 3 : 4, out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a.t0 + a.d * (0.22 + (0.6 * i) / (n - 1)) + 0.08 * (rnd(a.r * 91, i) - 0.5));
  return out;
}

/** Its pose `s` seconds into a beat on the edge. */
function onEdge(a: Act, s: number): Pose {
  const P = rest(a.x0, a.f), D = a.d, c = s / D;
  let air = 0;
  switch (a.k) {
    case SETTLE: {
      // Touching down: legs give and spring back, the body rocks forward and back, the wings fold with a flutter, the tail swings.
      P.feet = LEGS + Math.exp(-7 * s) * (0.4 * Math.cos((2 * Math.PI * s) / 0.36) - 1.4 * Math.sin((2 * Math.PI * s) / 0.36));
      P.pitch = -0.6 * Math.exp(-6 * s) * Math.cos((2 * Math.PI * s) / 0.5);
      P.fold = ease(clamp01(s / 0.34)) * (1 - 0.28 * bump(s, 0.42, 0.22));
      P.sweep = 0.35 * (1 - P.fold) + 0.22 * Math.sin(2 * Math.PI * 9 * s) * (1 - P.fold);
      P.tail = 0.18 - 0.63 * Math.exp(-5 * s) * Math.cos((2 * Math.PI * s) / 0.5);
      P.fan = 1 - ease(clamp01(s / 0.35));
      P.tilt = -P.pitch * 0.5;
      break;
    }
    case IDLE: {
      // Looks about in quick snaps, held between, and now and then flicks its tail.
      if (a.r > 0.45) P.tail += 0.4 * bump(s, D * 0.55, 0.2);
      if (D > 0.6) {
        const tl = (a.r - 0.5) * 0.6, hd = a.r > 0.7 ? 0.5 : 0;
        P.tilt = tl * (snap(s, D * 0.25) - snap(s, D * 0.8));
        P.head = hd * (snap(s, D * 0.3, 0.12) - snap(s, D * 0.78, 0.12));
      }
      break;
    }
    case HOP:
    case TURN: {
      // Crouch, spring, land and give: along the edge, or about on the spot.
      const q = clamp01((s - 0.1) / 0.2);
      P.x = lerp(a.x0, a.x1, ease(q));
      air = (a.k === HOP ? 5 : 4) * Math.sin(Math.PI * q) * (s > 0.1 && s < 0.3 ? 1 : 0);
      P.feet = LEGS - 0.75 * bump(s, 0, 0.14) - 0.6 * bump(s, 0.28, 0.14) - 0.5 * Math.sin(Math.PI * q);
      P.pitch = 0.14 * bump(s, 0, 0.2) - 0.08 * bump(s, 0.22, 0.16);
      P.fold = 1 - 0.3 * Math.sin(Math.PI * q);
      P.tail = 0.18 - 0.22 * Math.sin(Math.PI * q) + 0.35 * bump(s, 0.27, 0.15);
      P.hy = 0.35 * bump(s, 0.04, 0.12) + 0.3 * bump(s, 0.28, 0.12);
      if (a.k === TURN) P.yaw = Math.PI * ease(q);
      break;
    }
    case LOOK: {
      // Turns its head to look out at the viewer, cocks it, blinks, and turns back.
      const side = a.r < 0.5 ? 1 : -1;
      P.head = (Math.PI / 2) * (snap(s, D * 0.08, 0.14) - snap(s, D * 0.86, 0.14));
      P.roll = side * 0.32 * (snap(s, D * 0.38, 0.12) - snap(s, D * 0.72, 0.12));
      P.blink = bump(s, D * 0.55, 0.16) > 0.3 ? 1 : 0;
      break;
    }
    case COCK: {
      // Snaps its head up at the sky, or down at the board, in small jerks, and back.
      const up = a.r < 0.55 ? -1 : 1;
      P.tilt = up * (0.5 * snap(s, D * 0.08) - 0.1 * snap(s, D * 0.4) + 0.14 * snap(s, D * 0.6) - 0.54 * snap(s, D * 0.84));
      P.head = 0.25 * (snap(s, D * 0.08) - snap(s, D * 0.84));
      break;
    }
    case PREEN: {
      // Dips its beak into its breast and nibbles, then turns it back into its wing, then shakes itself out.
      const chest = held(s, 0.1, D * 0.42), back = held(s, D * 0.48, D * 0.8);
      const nib = Math.sin(2 * Math.PI * 7 * s);
      P.head = Math.PI * 0.88 * back;
      P.hx = -0.3 * chest - 1.1 * back;
      P.hy = (0.9 + 0.15 * nib) * chest + (1.4 + 0.15 * nib) * back;
      P.tilt = (0.85 + 0.12 * nib) * chest + (0.55 + 0.12 * nib) * back;
      P.sweep = (0.4 + 0.08 * nib) * back;
      P.fold = 1 - 0.2 * back;
      const shake = bump(s, D * 0.86, D * 0.14), wob = Math.sin(2 * Math.PI * 13 * s);
      P.sx = 1 + 0.06 * shake + 0.07 * shake * wob;
      P.sy = 1 + 0.06 * shake;
      P.roll = 0.22 * shake * wob;
      P.tail = 0.18 + 0.2 * shake;
      break;
    }
    case SING: {
      // Lifts its head, puffs its chest, and opens its beak for each note.
      const up = snap(s, D * 0.06, 0.14) - snap(s, D * 0.9, 0.16);
      let open = 0;
      for (const n of notesOf(a)) open = Math.max(open, bump(s, n - a.t0 - 0.04, 0.24));
      P.tilt = -0.5 * up - 0.12 * open;
      P.beak = open;
      P.sx = 1 + 0.03 * up;
      P.sy = 1 + 0.04 * up + 0.03 * open;
      P.tail = 0.18 + 0.12 * open;
      break;
    }
    case BOB: {
      // Two quick flicks of the tail, dipping its body to each.
      const k1 = bump(s, 0.12, 0.22), k2 = bump(s, 0.55, 0.22);
      P.tail = 0.18 + 0.65 * k1 + 0.5 * k2 - 0.12 * (bump(s, 0.34, 0.16) + bump(s, 0.77, 0.16));
      P.pitch = 0.12 * (k1 + k2);
      P.feet = LEGS - 0.45 * (k1 + 0.8 * k2);
      P.sweep = 0.1 * (k1 + k2);
      break;
    }
    case CROUCH: {
      // Gathers itself: legs bend, it leans forward, the tail goes up and the wings come up ready.
      const e = ease(c);
      P.feet = LEGS - 1.0 * e;
      P.pitch = 0.18 * e;
      P.tail = 0.18 + 0.35 * e;
      P.fold = 1 - ease(clamp01((c - 0.35) / 0.65));
      P.tilt = -0.1 * e;
      break;
    }
  }
  // Breathing, all the while it stands.
  const breath = Math.sin(2 * Math.PI * 0.8 * (a.t0 + s));
  P.sy *= 1 + 0.07 * (P.feet - LEGS) + 0.022 * breath;
  P.sx *= 1 - 0.008 * breath;
  P.sx *= 1 - 0.05 * (P.feet - LEGS);
  P.y = EDGE - P.feet * U * P.sy - air;
  P.shade = 1 - air / 10;
  return P;
}

/** Its pose `s` seconds into the flight in, from off to the side and above, down to the edge. */
function flyIn(v: Visit, s: number): Pose {
  const P = rest(v.perch, v.dir), d = v.dir;
  const end = [v.perch, EDGE - (LEGS + 0.4) * U];
  const from = [v.perch - d * v.far, -v.high];
  const u = s / TIN, w = u * (1.45 - 0.45 * u);
  const [x, y, dx, dy] = bez(from, [from[0] + d * v.far * 0.35, from[1] + v.high * 0.75], [v.perch - d * v.far * 0.22, end[1] + 6], end, w);
  const fl = ease(clamp01((s - (TIN - FLARE)) / FLARE));
  const [lift, rise] = flapGlide(s);
  const brake = beat((Math.max(0, s - (TIN - FLARE)) / 0.12) % 1);
  const into = ease(clamp01((s - (TIN - FLARE)) / 0.08));
  P.x = x;
  P.y = y + rise * (1 - fl);
  P.pitch = lerp(heading(dx * d, dy), -0.6, fl);
  P.fold = 0;
  P.lift = lerp(lift, brake, into);
  P.sweep = 0.22 * ((1 - P.lift) / 1.9) + 0.35 * fl;
  P.feet = lerp(0, LEGS + 0.4, fl);
  P.tail = lerp(0, -0.45, fl);
  P.fan = fl;
  P.sx = lerp(1.08, 1, fl);
  P.sy = lerp(0.93, 1, fl);
  P.tilt = -P.pitch * 0.5;
  P.alpha = ease(clamp01(s / 0.3));
  P.shade = clamp01(1 - (end[1] - y) / 16);
  return P;
}

/** Its pose `s` seconds into the flight out, from the crouch on the edge, up and away the way it faces. */
function flyOut(v: Visit, s: number): Pose {
  const P = rest(v.x, v.f), d = v.f;
  const from = [v.x, EDGE - (LEGS - 1) * U * (1 - 0.07)];
  const to = [v.x + d * v.far, -v.high];
  const u = s / TOUT, w = u * (0.6 + 0.4 * u);
  const [x, y, dx, dy] = bez(from, [from[0] + d * 25, from[1] - 22], [to[0] - d * v.far * 0.4, to[1] + 25], to, w);
  const go = ease(clamp01(s / 0.15));
  const [lift, rise] = s < BEAT * 4 ? [beat((s / BEAT) % 1), 0] : flapGlide(s - BEAT * 4);
  P.x = x;
  P.y = y + rise * clamp01((s - BEAT * 4) / 0.3);
  P.pitch = lerp(0.18, heading(dx * d, dy), go);
  P.fold = 0;
  P.lift = lift;
  P.sweep = 0.22 * ((1 - lift) / 1.9);
  P.feet = s < 0.08 ? lerp(LEGS - 1, LEGS + 0.4, ease(s / 0.08)) : lerp(LEGS + 0.4, 0, ease(clamp01((s - 0.08) / 0.22)));
  P.tail = lerp(0.53, 0, ease(clamp01(s / 0.3)));
  const st = bump(s, 0, 0.3);
  P.sx = lerp(1.05, 1.08, go) + 0.08 * st;
  P.sy = lerp(0.93, 0.93, go) - 0.06 * st;
  P.tilt = -P.pitch * 0.5;
  P.alpha = 1 - ease(clamp01((s - (TOUT - 0.4)) / 0.4));
  P.shade = clamp01(1 - (from[1] - y) / 16);
  return P;
}

/** One wing from its shoulder: folded along the back, or spread, beating. */
function wing(g: Ctx, P: Pose, c: number, far: boolean): void {
  const sp = 1 - P.fold;
  const L = lerp(5.4, 10, sp), C = lerp(2.5, 4.3, sp);
  g.save();
  g.scale(c, 1);
  g.translate(far ? 0.2 : 1.1, far ? -2.4 : -1.5);
  g.rotate(lerp(-1.75, -0.25, sp) + P.sweep - (far ? 0.28 : 0));
  g.scale(far ? 0.9 : 1, lerp(1, P.lift, sp));
  g.beginPath();
  g.moveTo(0.9, 0.3);
  g.bezierCurveTo(1.5, -L * 0.45, 0.8, -L * 0.85, -0.1, -L);
  g.bezierCurveTo(-C * 0.75, -L * 0.82, -C, -L * 0.45, -C * 0.85, -L * 0.1);
  g.quadraticCurveTo(-C * 0.5, 1.0, 0.9, 0.3);
  g.fillStyle = far ? WING_FAR : WING;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.42;
  g.stroke();
  // The flight feathers' edges toward the tip, and a pale bar of coverts near the shoulder.
  g.strokeStyle = far ? WING : WING_FAR;
  g.lineWidth = 0.3;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const e = 0.52 + i * 0.13;
    g.moveTo(-C * (0.98 - i * 0.12), -L * e);
    g.lineTo(-C * 0.3, -L * (e + 0.12));
  }
  g.stroke();
  g.strokeStyle = WING_LIT;
  g.lineWidth = 0.32;
  g.beginPath();
  g.moveTo(-C * 0.75, -L * 0.22);
  g.quadraticCurveTo(-C * 0.1, -L * 0.3, 0.6, -L * 0.18);
  g.stroke();
  g.restore();
}

/** The bird in pose `P`. */
function bird(g: Ctx, P: Pose): void {
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
  g.save();
  g.globalAlpha = P.alpha;
  g.translate(P.x, P.y);
  g.scale(P.face * U, U);
  g.rotate(P.pitch);
  g.scale(P.sx, P.sy);
  if (P.fold < 0.9) wing(g, P, c, true);
  // The tail, cocked from the rump.
  g.save();
  g.scale(c, 1);
  g.translate(-2.5, -0.2);
  g.rotate(P.tail);
  g.beginPath();
  g.moveTo(0.4, -1.1);
  g.lineTo(-4.4, -1.4 - P.fan * 0.8);
  g.quadraticCurveTo(-5.5, -0.2, -4.6, 1.0 + P.fan * 0.8);
  g.lineTo(0.4, 1.0);
  g.closePath();
  g.fillStyle = TAIL;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.45;
  g.stroke();
  g.strokeStyle = WING_FAR;
  g.lineWidth = 0.3;
  g.beginPath();
  g.moveTo(-0.5, -0.05);
  g.lineTo(-4.6, -0.2);
  g.stroke();
  g.restore();
  // Legs: from the hips to the feet, bent at the heel when it crouches, toes along the edge.
  if (P.feet > 3.6) {
    const bend = clamp01((LEGS + 0.2 - P.feet) / 1.4);
    g.strokeStyle = LEG;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [fw, lat] of [[0.55, -0.75], [-0.35, 0.75]]) {
      const lx = fw * c + lat * s, hip = 2.0, ft = P.feet / P.sy;
      g.lineWidth = 0.55;
      g.beginPath();
      g.moveTo(lx, hip);
      g.lineTo(lx - 0.8 * c * bend - 0.15, (hip + ft) / 2 + 0.2);
      g.lineTo(lx + 0.2 * c, ft);
      g.stroke();
      g.lineWidth = 0.42;
      g.beginPath();
      g.moveTo(lx - 0.7 * c, ft);
      g.lineTo(lx + 1.5 * c + 0.4 * s * Math.sign(lat), ft);
      g.moveTo(lx + 0.2 * c, ft);
      g.lineTo(lx + 1.1 * c - 0.3 * s * Math.sign(lat), ft + 0.25);
      g.stroke();
    }
  }
  // Head: where it sits, turned and tipped about the neck.
  const psi = P.yaw + P.head, cp = Math.cos(psi), sinp = Math.sin(psi), r = 2.75;
  const nx = 1.3 * c, ny = -1.9;
  const headAt = (): void => {
    g.translate(nx, ny);
    g.rotate(P.tilt * cp + P.roll);
    g.translate(-nx, -ny);
  };
  const hx = (2.2 + P.hx) * c, hy = -3.5 + P.hy;
  const rx = 3.0 + 0.8 * Math.abs(c);
  // One outline round body and head together, under both.
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  g.beginPath();
  g.ellipse(0, 0, rx, 3.4, 0, 0, Math.PI * 2);
  g.stroke();
  g.save();
  headAt();
  g.beginPath();
  g.arc(hx, hy, r, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // The body: brown back, cream belly, orange breast edged in grey.
  g.save();
  g.beginPath();
  g.ellipse(0, 0, rx, 3.4, 0, 0, Math.PI * 2);
  g.fillStyle = BACK;
  g.fill();
  g.clip();
  g.fillStyle = BELLY;
  g.beginPath();
  g.ellipse(0.3 * c, 2.1, 3.1, 2.0, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = GREY;
  g.beginPath();
  g.ellipse(2.2 * c, -0.7, 2.95, 2.95, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = BREAST;
  g.beginPath();
  g.ellipse(2.45 * c, -0.55, 2.6, 2.65, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = BREAST_LIT;
  g.globalAlpha = P.alpha * 0.6;
  g.beginPath();
  g.ellipse(2.9 * c, -1.4, 1.2, 0.85, -0.3 * c, 0, Math.PI * 2);
  g.fill();
  g.restore();
  wing(g, P, c, false);
  // The head: brown crown, orange face edged in grey, eyes, beak.
  g.save();
  headAt();
  g.save();
  g.beginPath();
  g.arc(hx, hy, r, 0, Math.PI * 2);
  g.fillStyle = BACK;
  g.fill();
  g.clip();
  g.fillStyle = GREY;
  g.beginPath();
  g.arc(hx + 0.55 * r * cp, hy + 0.36 * r, 0.95 * r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = BREAST;
  g.beginPath();
  g.arc(hx + 0.62 * r * cp, hy + 0.42 * r, 0.82 * r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255, 246, 228, 0.35)';
  g.beginPath();
  g.ellipse(hx - 0.35 * r * cp, hy - 0.62 * r, 0.42 * r, 0.2 * r, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Eyes on the sides of the head, nearer the front as it looks out.
  const ea = 1.25 - 0.5 * sinp;
  for (const side of [1, -1]) {
    const b = psi + side * ea, vis = Math.sin(b);
    if (vis < 0.08) continue;
    const ex = hx + 0.9 * r * Math.cos(b), ey = hy - 0.18 * r, er = 0.85;
    if (P.blink > 0.5) {
      g.strokeStyle = EYE;
      g.lineWidth = 0.4;
      g.beginPath();
      g.ellipse(ex, ey - 0.2, er * (0.4 + 0.6 * vis), 0.55, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      continue;
    }
    g.fillStyle = EYE;
    g.beginPath();
    g.ellipse(ex, ey, er * (0.4 + 0.6 * vis), er, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(ex + 0.25 * Math.cos(psi) + 0.1, ey - 0.32, 0.3, 0, Math.PI * 2);
    g.fill();
  }
  // The beak: from the front of the face, its two halves parting when it sings.
  const bx = hx + 0.95 * r * cp, by = hy + 0.15, tx = bx + 1.8 * cp, ty = by + 0.2 + 0.45 * sinp, op = P.beak;
  if (op > 0.02) {
    g.fillStyle = MOUTH;
    g.beginPath();
    g.moveTo(bx, by - 0.1);
    g.lineTo(tx, ty - op * 0.8);
    g.lineTo(tx - 0.2 * cp, ty + op * 1.5);
    g.closePath();
    g.fill();
  }
  g.fillStyle = BEAK;
  g.beginPath();
  g.moveTo(bx - 0.1 * cp, by - 0.55);
  g.lineTo(tx, ty - op * 0.8);
  g.lineTo(bx, by + 0.05 * (1 - op) - 0.05);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(bx, by + 0.05);
  g.lineTo(tx - 0.2 * cp * op, ty + op * 1.5);
  g.lineTo(bx - 0.1 * cp, by + 0.5);
  g.closePath();
  g.fill();
  if (sinp > 0.2) {
    const hw = 0.6 * sinp;
    g.beginPath();
    g.moveTo(bx, by - 0.5);
    g.lineTo(bx + hw, by);
    g.lineTo(tx, ty + op * 0.4);
    g.lineTo(bx - hw, by);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.restore();
}

/** A sung note rising off the beak: a quaver, or two beamed. */
function note(g: Ctx, x: number, y: number, a: number, k: number, two: boolean): void {
  g.save();
  g.globalAlpha = a;
  g.translate(x, y);
  g.scale(k * U * 0.85, k * U * 0.85);
  const heads = (): void => {
    g.beginPath();
    g.ellipse(0, 0, 1.15, 0.82, -0.4, 0, Math.PI * 2);
    if (two) {
      g.moveTo(2.9 + 1.15 * Math.cos(0.4), -0.5 - 1.15 * Math.sin(0.4));
      g.ellipse(2.9, -0.5, 1.15, 0.82, -0.4, 0, Math.PI * 2);
    }
  };
  const stems = (): void => {
    g.beginPath();
    g.moveTo(0.95, -0.2);
    g.lineTo(0.95, -3.8);
    if (two) {
      g.lineTo(3.85, -4.3);
      g.lineTo(3.85, -0.7);
    } else g.quadraticCurveTo(1.4, -2.4, 2.4, -1.9);
  };
  // Cream, edged in ink like the bird, so it reads over the dark board and the bright sky alike.
  g.strokeStyle = INK;
  g.lineWidth = 0.95;
  heads();
  g.stroke();
  stems();
  g.stroke();
  g.fillStyle = '#fff3dc';
  heads();
  g.fill();
  g.strokeStyle = '#fff3dc';
  g.lineWidth = 0.42;
  stems();
  g.stroke();
  g.restore();
}

export function songbird(g: Ctx, p: LifePiece, t: number): void {
  const tt = t + rnd(p.seed % 9973, 0.5) * CYCLE, k = Math.floor(tt / CYCLE), u = tt - k * CYCLE;
  const v = plan(p, k);
  if (u < v.t0 || u > v.out + TOUT + 2) return;
  let P: Pose | null = null;
  if (u < v.t0 + TIN) P = flyIn(v, u - v.t0);
  else if (u >= v.out) {
    if (u < v.out + TOUT) P = flyOut(v, u - v.out);
  } else {
    for (const a of v.acts) if (u < a.t0 + a.d) {
      P = onEdge(a, u - a.t0);
      break;
    }
    // A blink every few seconds, wherever it is.
    if (P && P.blink === 0) {
      const per = 2.4 + 0.9 * rnd(p.seed % 9973, k + 0.3), m = (u + per * rnd(k, 1.7)) % per;
      if (m < 0.13) P.blink = 1;
    }
  }
  // Its notes, rising and drifting off ahead of it.
  for (const a of v.acts) {
    if (a.k !== SING) continue;
    notesOf(a).forEach((n, i) => {
      const age = u - n;
      if (age < 0 || age > 1.6) return;
      const nx = a.x0 + a.f * U * (6 + 5 * age) + 1.6 * Math.sin(age * 5 + i);
      const ny = EDGE - U * (LEGS + 5.2) - U * (1 + 7 * age);
      const al = Math.min(1, age / 0.1) * (1 - ease(clamp01((age - 0.9) / 0.7)));
      const kk = 0.7 + 0.3 * Math.min(1, age / 0.18) + 0.08 * bump(age, 0.1, 0.25);
      note(g, nx, ny, al * 0.9, kk, i % 3 === 1);
    });
  }
  if (!P) return;
  // Its shadow on the edge as it nears and stands.
  if (P.shade > 0.02) {
    g.fillStyle = `rgba(30, 18, 10, ${0.28 * P.shade * P.alpha})`;
    g.beginPath();
    g.ellipse(P.x + P.face * 0.3 * U, EDGE + 1.4, 4.4 * U * (0.6 + 0.4 * P.shade), 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  bird(g, P);
}
