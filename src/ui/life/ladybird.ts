import { SIZE, clamp01, ease, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/**
 * The ladybird on the palisade's foot beam, seen from above as it crawls on
 * the face of the oak: it walks the beam on six stepping legs, stops to look
 * about and groom its feelers, turns round, now and then lifts its shell and
 * buzzes its wings, hops a short way by air, flies over the blue gem to get
 * to the other side of it, and sometimes climbs a little way up the left post.
 *
 * Time is cut into outings of `OUTING` seconds. Each starts and ends at a
 * resting place drawn off the outing's number (`anchor`), and what happens in
 * between is planned afresh from that number (`plan`), so nothing carries over
 * from one frame to the next and one outing hands over to the next unseen.
 */

/** Seconds in one outing. */
const OUTING = 30;

/** Walking pace, interface px per second. */
const PACE = 11;

/** Climbing pace up and down the post, interface px per second. */
const CLIMB = 9;

/** How big it is drawn, against the units its shapes are written in. */
const U = SIZE * 0.85;

/** Ground covered in one full step of the six legs, in interface px (a tripod gait: two strides of 1.4 units). */
const STRIDE = 2.8 * U;

/** Seconds to get up to pace from standing, and down again. */
const RAMP = 0.25;

/** Kinds of act in an outing. */
const REST = 0, WALK = 1, TURN = 2, FLY = 3;

/** Kinds of outing. */
const WANDER = 0, FLUTTER = 1, HOP = 2, CROSS = 3, CLIMBS = 4;

/** One act of an outing: from (x0, y0) facing a0 to (x1, y1) facing a1 over `d` seconds. */
interface Act {
  kind: number;
  d: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  a0: number;
  a1: number;
  /** Walk: pace in px per second. Rest: share of the spare time. */
  v: number;
  /** A number in 0..1 for this act's own choices. */
  r: number;
}

/** Where on the drawing it is at one moment, and what its parts are doing. */
interface Pose {
  x: number;
  y: number;
  /** Heading, radians, 0 facing right. */
  a: number;
  /** Turn of the whole body on top of its heading (looking about, wiggling the wings in). */
  yaw: number;
  /** Legs: steps taken, and how far through their stride (0 standing). */
  gait: number;
  amp: number;
  /** Turning on the spot: the legs of each side step opposite ways, this way round. */
  spin: number;
  /** Head turned to one side, radians. */
  look: number;
  /** Front legs up to the head, cleaning the feelers, 0..1. */
  groom: number;
  /** Wing cases lifted (0..1), wings unfolded (0..1), wings beating (0..1). */
  open: number;
  wing: number;
  buzz: number;
  /** Off the wood, 0..1; below 0, a crouch or the give of landing. */
  lift: number;
}

/** The two stretches of the foot beam it walks: left of the gem, and right of it up to the fence (or null if too short). */
function lanes(p: LifePiece): [[number, number], [number, number] | null] {
  const { w, F } = p;
  const left: [number, number] = [F * 1.5, Math.max(F * 1.6, w / 2 - F * 0.75)];
  const end = w > F * 10 ? w - F * 3.95 : w - F * 1.5;
  const right: [number, number] = [w / 2 + F * 0.75, end];
  return [left, right[1] - right[0] > F * 0.8 ? right : null];
}

/** The beam as an outing is planned on: its two stretches, its walking height, the frame's band and the window's seed. */
interface Beam {
  lanes: [[number, number], [number, number] | null];
  y: number;
  F: number;
  h: number;
  seed: number;
}

/** Which side of the gem outing `k` starts on: 0 left, 1 right (the shorter stretch, so less often); kept for two outings at a time. */
function side(b: Beam, k: number): number {
  return b.lanes[1] && rnd(Math.floor(k / 2) * 1.37 + 0.2, b.seed) < 0.4 ? 1 : 0;
}

/** What kind of outing `k` is, before the rule against climbing twice running. */
function drawn(b: Beam, k: number): number {
  const s0 = side(b, k), s1 = side(b, k + 1);
  if (s0 !== s1) return CROSS;
  const r = rnd(k * 2.71 + 0.5, b.seed);
  const lane = b.lanes[s0]!;
  const roomy = lane[1] - lane[0] > b.F * 2;
  if (s0 === 0 && r < 0.3) return CLIMBS;
  if (r < 0.45) return FLUTTER;
  if (r < 0.6 && roomy) return HOP;
  return WANDER;
}

/** What kind of outing `k` is: never a climb straight after a climb. */
function story(b: Beam, k: number): number {
  const kind = drawn(b, k);
  return kind === CLIMBS && drawn(b, k - 1) === CLIMBS ? FLUTTER : kind;
}

/** Where outing `k` starts (and outing k - 1 ends): a point on the beam and a heading. */
function anchor(b: Beam, k: number): [number, number, number] {
  const s = side(b, k), lane = b.lanes[s]!;
  const nearPost = s === 0 && (story(b, k) === CLIMBS || story(b, k - 1) === CLIMBS);
  const hi = nearPost ? Math.min(lane[1], lane[0] + b.F * 2.2) : lane[1];
  const x = lerp(lane[0], hi, rnd(k * 3.11 + 0.9, b.seed));
  return [x, b.y, rnd(k * 4.07 + 0.3, b.seed) < 0.5 ? 0 : Math.PI];
}

/** The height it walks the beam at: across the upper part of the foot beam's face, clear of the rocks. */
const beamY = (p: LifePiece): number => p.h - p.F * 0.52;

/** Seconds a flight takes: lifting the cases and unfolding (0.75), in the air, folding away (0.9). */
const flightTime = (dist: number): number => 0.75 + (dist > 0 ? Math.max(0.9, 0.55 + dist / 30) : 1.15) + 0.9;

/** Seconds of rest it is planned to have at least, on average, between one thing and the next. */
const BREATHER = 2.3;

/** Outing `k`, act by act, with the rests stretched to fill it to `OUTING` seconds. */
function plan(b: Beam, k: number): Act[] {
  const { F, h } = b;
  const acts: Act[] = [];
  const [sx, sy, sa] = anchor(b, k), [ex, ey, ea] = anchor(b, k + 1);
  let x = sx, y = sy, a = sa, n = 0, busy = 0, rests = 0, walks = 0;
  const r = (): number => rnd(k * 5.3 + n++ * 0.731, b.seed + 11);
  const push = (kind: number, d: number, x1: number, y1: number, a1: number, v: number): void => {
    acts.push({ kind, d, x0: x, y0: y, x1, y1, a0: a, a1, v, r: r() });
    if (kind === REST) rests++;
    if (kind === WALK) walks++;
    busy += kind === WALK ? Math.hypot(x1 - x, y1 - y) / v + RAMP : d;
    x = x1;
    y = y1;
    a = a1;
  };
  const rest = (share: number): void => push(REST, 0, x, y, a, share * (0.65 + 0.7 * r()));
  const face = (to: number, way = 0): void => {
    let d = Math.atan2(Math.sin(to - a), Math.cos(to - a));
    if (Math.abs(d) < 0.05) return;
    if (way && Math.abs(Math.abs(d) - Math.PI) < 0.05) d = Math.PI * way;
    push(TURN, 0.4 + 0.5 * Math.abs(d) / Math.PI, x, y, a + d, 0);
  };
  const walk = (x1: number, y1: number, pace = PACE): void => {
    if (Math.hypot(x1 - x, y1 - y) < 4) return;
    const to = Math.atan2(y1 - y, x1 - x), last = acts[acts.length - 1];
    if (last && last.kind === WALK && Math.abs(Math.sin(to - a)) < 0.01 && Math.cos(to - a) > 0) {
      // On the same way: the walk before carries on, without a stop between.
      busy += Math.hypot(x1 - x, y1 - y) / last.v;
      last.x1 = x = x1;
      last.y1 = y = y1;
      return;
    }
    face(to);
    push(WALK, 0, x1, y1, a, pace * (0.85 + 0.3 * r()));
  };
  const fly = (x1: number): void => {
    if (Math.abs(x1 - x) > 1) face(x1 > x ? 0 : Math.PI);
    push(FLY, flightTime(Math.abs(x1 - x)), x1, y, a, 0);
  };
  let lane = b.lanes[side(b, k)]!;
  // Somewhere else along its stretch, at least a body or two from where it stands if there is room.
  const elsewhere = (): number => {
    const u = lerp(lane[0], lane[1], r()), gap = Math.min(F * 0.8, (lane[1] - lane[0]) / 2);
    if (Math.abs(u - x) >= gap) return u;
    return u >= x ? (x + gap <= lane[1] ? x + gap : x - gap) : x - gap >= lane[0] ? x - gap : x + gap;
  };
  const kind = story(b, k);
  let fluttered = kind === FLUTTER || kind === HOP;
  rest(1);
  if (kind === CROSS) {
    const there = b.lanes[side(b, k + 1)]!;
    const leftward = side(b, k) === 1;
    walk(leftward ? lane[0] : lane[1], y);
    rest(1.2);
    fly(leftward ? there[1] : there[0]);
    rest(0.8);
    lane = there;
    fluttered = true;
  } else if (kind === CLIMBS) {
    const postX = F * 0.48, top = h - F * (2.25 + 0.3 * r());
    walk(lane[0], y);
    walk(postX, y);
    rest(0.5);
    walk(postX, top, CLIMB);
    rest(1.6);
    if (r() < 0.3) {
      fly(postX);
      rest(0.6);
      fluttered = true;
    }
    face(Math.PI / 2, r() < 0.5 ? 1 : -1);
    walk(postX, sy, CLIMB);
    rest(0.4);
    walk(lane[0], sy);
  } else {
    walk(elsewhere(), y);
    rest(1.4);
    if (kind === FLUTTER) {
      fly(x);
      rest(1);
    } else if (kind === HOP) {
      const hop = F * (0.9 + 0.7 * r()) * (x - lane[0] > lane[1] - x ? -1 : 1);
      fly(Math.max(lane[0], Math.min(lane[1], x + hop)));
      rest(1);
    }
  }
  // More pottering while the outing has room for it: a stroll, a turn about, a stretch of the wings.
  for (let extra = 0; extra < 5; extra++) {
    if (busy + Math.abs(ex - x) / PACE + 1.4 + 2.5 + (rests + 2) * BREATHER > OUTING) break;
    const q = r(), turned = acts.length > 1 && acts[acts.length - 2].kind === TURN;
    if (q < 0.6 || turned) walk(elsewhere(), y);
    else if (q < 0.85 || fluttered) face(a + Math.PI, r() < 0.5 ? 1 : -1);
    else {
      fly(x);
      fluttered = true;
    }
    rest(1);
  }
  walk(ex, ey);
  face(ea, r() < 0.5 ? 1 : -1);
  rest(1);
  // Walks' own times, sped up if the moving alone would leave too little rest; then the rests share what is left.
  let walking = 0, other = 0, shares = 0;
  for (const c of acts) {
    if (c.kind === WALK) walking += Math.hypot(c.x1 - c.x0, c.y1 - c.y0) / c.v;
    else if (c.kind === REST) shares += c.v;
    else other += c.d;
  }
  const room = OUTING - other - rests * 0.8 - walks * RAMP;
  const quick = walking > room ? walking / Math.max(1, room) : 1;
  let spare = OUTING - other;
  for (const c of acts) {
    if (c.kind !== WALK) continue;
    c.v *= quick;
    c.d = Math.hypot(c.x1 - c.x0, c.y1 - c.y0) / c.v + RAMP;
    spare -= c.d;
  }
  for (const c of acts) if (c.kind === REST) c.d = (Math.max(0, spare) * c.v) / shares;
  return acts;
}

/** Distance along a walk of `len` px at `v` px/s, `s` seconds in: up to pace over `RAMP`, down again at the end. */
function along(len: number, v: number, d: number, s: number): number {
  const q = Math.min(RAMP, d / 2);
  if (s <= 0) return 0;
  if (s >= d) return len;
  if (s < q) return (v * s * s) / (2 * q);
  if (s > d - q) return len - (v * (d - s) * (d - s)) / (2 * q);
  return v * (s - q / 2);
}

/** A bump 0 → 1 → 0 over [a, b], eased in over `e` seconds and out over `e`. */
const bump = (s: number, a: number, b: number, e: number): number => ease(clamp01((s - a) / e)) * ease(clamp01((b - s) / e));

/** Where it is and what it does at `s` seconds into an act. */
function pose(c: Act, s: number): Pose {
  const P: Pose = { x: c.x0, y: c.y0, a: c.a0, yaw: 0, gait: 0, amp: 0, spin: 0, look: 0, groom: 0, open: 0, wing: 0, buzz: 0, lift: 0 };
  if (c.kind === WALK) {
    const len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0), d = along(len, c.v, c.d, s), u = d / len;
    P.x = lerp(c.x0, c.x1, u);
    P.y = lerp(c.y0, c.y1, u);
    P.gait = d / STRIDE;
    P.amp = clamp01(Math.min(d, len - d) / (STRIDE * 0.35));
    P.yaw = 0.05 * Math.sin(P.gait * Math.PI * 2) * P.amp;
  } else if (c.kind === TURN) {
    const u = ease(clamp01(s / c.d)), turned = (c.a1 - c.a0) * u;
    P.a = c.a0 + turned;
    P.gait = (Math.abs(turned) * 3.2 * U) / STRIDE;
    P.amp = Math.sin(Math.PI * u) * 1.2;
    P.spin = Math.sign(c.a1 - c.a0);
  } else if (c.kind === REST) {
    // A look to each side in turn and a clean of the feelers, as many as the rest has room for, each finished before it ends.
    const dir = c.r < 0.5 ? 1 : -1, lookFirst = c.r * 7 % 1 < 0.5;
    const both = c.d >= 3.3, lone = !both && c.d >= 1.9 ? 1 : !both && c.d >= 1.4 ? 2 : 0;
    const t0 = (c.d - (both ? 3.1 : lone === 1 ? 1.75 : 1.2)) * (c.r * 13 % 1);
    const lookAt = both ? (lookFirst ? t0 : t0 + 1.35) : lone === 1 ? t0 : -9;
    const groomAt = both ? (lookFirst ? t0 + 1.9 : t0) : lone === 2 ? t0 : -9;
    const v = s - lookAt;
    P.look = 0.55 * dir * (bump(v, 0, 0.75, 0.22) - bump(v, 0.95, 1.75, 0.25));
    P.yaw = P.look * 0.3;
    P.groom = bump(s, groomAt, groomAt + 1.2, 0.25);
  } else {
    // Lift the cases, unfold, beat; up, across and down if going anywhere; fold away and wiggle them home.
    const air = c.d - 1.65, far = Math.abs(c.x1 - c.x0) > 1;
    P.open = ease(clamp01((s - 0.1) / 0.32)) * (1 - ease(clamp01((s - air - 1.15) / 0.38)));
    P.open *= 1 + 0.12 * Math.sin(clamp01((s - 0.1) / 0.45) * Math.PI);
    P.wing = ease(clamp01((s - 0.3) / 0.45)) * (1 - ease(clamp01((s - air - 0.75) / 0.42)));
    P.buzz = bump(s, 0.62, 0.75 + air + 0.1, 0.12);
    const v = clamp01((s - 0.75) / air);
    if (far) {
      const m = ease(v);
      P.x = lerp(c.x0, c.x1, m);
      P.y = lerp(c.y0, c.y1, m) - 3 * Math.sin(Math.PI * m);
      P.lift = bump(v, 0, 1, 0.3);
    } else {
      P.lift = 0.22 * Math.sin(Math.PI * v) * (s > 0.75 ? 1 : 0);
    }
    if (s > 0.75 + air) P.x = c.x1;
    const tuck = s - air - 1.15;
    if (tuck > 0) P.yaw = 0.07 * Math.sin(tuck * Math.PI * 2 * 5) * clamp01(1 - tuck / 0.5);
    // A crouch before it goes, and a little give as it lands.
    if (s < 0.25) P.lift = -0.16 * Math.sin((s / 0.25) * Math.PI);
    const down = s - 0.75 - air;
    if (far && down > 0 && down < 0.3) P.lift = -0.12 * Math.sin((down / 0.3) * Math.PI);
  }
  return P;
}

/** The ladybird's colours, opaque, as #rrggbb. */
interface Palette {
  shadow: string; leg: string; under: string; film: string; vein: string; redLit: string; red: string; redDeep: string;
  rim: string; spot: string; shine: string; shield: string; cheek: string;
}

/** By day. */
const DAY: Palette = {
  shadow: '#28140a', leg: '#241815', under: '#2a1c18', film: '#eedebe', vein: '#785434', redLit: '#f46a4e', red: '#d9362a',
  redDeep: '#94201a', rim: '#5e1611', spot: '#241815', shine: '#fff6ec', shield: '#211614', cheek: '#f6f1e6',
};

/** After dark: each colour under the night, as the palisade is (`underNight`). */
const NIGHT = Object.fromEntries(Object.entries(DAY).map(([k, v]) => [k, underNight(v)])) as unknown as Palette;

/** A #rrggbb colour at opacity `a`, as css. */
function fade(hex: string, a: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;
}

/** Foot and hip of each leg on the left side (front, middle, back), in units; the right side mirrors them. */
const FEET: Array<[number, number, number, number]> = [
  [3.0, 3.65, 1.6, 1.0],
  [0.4, 4.3, 0.4, 1.2],
  [-2.4, 3.95, -0.7, 1.1],
];

/** The ladybird in pose `P`, `t` seconds on (for its feelers). */
function draw(g: Ctx, P: Pose, t: number, seed: number, c: Palette): void {
  const big = 1 + 0.3 * P.lift;
  const head = P.a + P.yaw;
  // Its shadow on the wood: close under it standing, further off and fainter in the air.
  g.save();
  g.translate(P.x + 0.6 + 4 * P.lift, P.y + 1.3 + 6 * Math.max(0, P.lift));
  g.rotate(head);
  g.scale(U * (1 + 0.15 * P.lift), U * (1 + 0.15 * P.lift));
  g.fillStyle = fade(c.shadow, 0.3 - 0.15 * P.lift);
  g.beginPath();
  g.ellipse(-0.2, 0, 4.2, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.save();
  g.translate(P.x, P.y);
  g.rotate(head);
  g.scale(U * big, U * big);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Legs: a tripod gait, three feet planted pushing back while the other three swing forward.
  g.strokeStyle = c.leg;
  g.lineWidth = 0.55;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const [fx, fy, hx, hy] = FEET[i];
      const q = (((P.gait + ((i + (sd > 0 ? 1 : 0)) % 2) * 0.5) % 1) + 1) % 1;
      const swing = q >= 0.5 ? (q - 0.5) * 2 : 0;
      let off = q < 0.5 ? 0.7 * (1 - 4 * q) : 0.7 * (-1 + 2 * ease(swing));
      off *= P.amp * (P.spin ? -P.spin * sd : 1);
      const up = Math.sin(Math.PI * swing) * Math.min(1, P.amp);
      let footX = fx + off, footY = fy - 0.55 * up - 0.4 * P.lift;
      if (i === 0 && P.groom > 0) {
        footX = lerp(footX, 3.5 + 0.35 * Math.sin(t * 22 + sd), P.groom);
        footY = lerp(footY, 1.7, P.groom);
      }
      const kx = lerp(hx, footX, 0.5) + (i === 0 ? 0.3 : i === 2 ? -0.3 : 0), ky = lerp(hy, footY, 0.5) + 0.75;
      g.moveTo(hx, sd * hy);
      g.lineTo(kx, sd * ky);
      g.lineTo(footX, sd * footY);
    }
  }
  g.stroke();

  // The black underside, seen when the cases lift.
  if (P.open > 0.02) {
    g.fillStyle = c.under;
    g.beginPath();
    g.ellipse(-0.5, 0, 3.1, 2.5, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Wings: amber film unfolding from under the cases; beating, a faint fan with the wing flicking across it.
  if (P.wing > 0.02) {
    const L = 6.2 * P.wing, wd = 0.25 + 1.35 * P.wing, beat = 0.48 * P.buzz;
    const flick = Math.sin(t * Math.PI * 15 + seed);
    for (const sd of [-1, 1]) {
      const sg = 0.28 + 0.75 * P.wing;
      if (beat > 0.02) {
        g.fillStyle = fade(c.film, 0.17 * P.buzz);
        g.beginPath();
        g.moveTo(1.2, sd * 0.5);
        g.arc(1.2, sd * 0.5, L * 0.95, sd > 0 ? Math.PI - sg - beat : Math.PI + sg - beat, sd > 0 ? Math.PI - sg + beat : Math.PI + sg + beat);
        g.closePath();
        g.fill();
      }
      const sw = sg + beat * flick, dx = -Math.cos(sw), dy = sd * Math.sin(sw);
      g.fillStyle = fade(c.film, 0.72);
      g.strokeStyle = fade(c.vein, 0.6);
      g.lineWidth = 0.22;
      g.beginPath();
      g.ellipse(1.2 + dx * L * 0.5, sd * 0.5 + dy * L * 0.5, L * 0.5, wd, Math.atan2(dy, dx), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // The wing cases: glossy red, lit from the top left of the screen whichever way it faces.
  const lx = -0.55, ly = -0.83, ca = Math.cos(-head), sa = Math.sin(-head);
  const hx = -0.5 + 1.5 * (lx * ca - ly * sa), hy = 1.5 * (lx * sa + ly * ca);
  const red = g.createRadialGradient(hx, hy, 0.3, hx, hy, 5.2);
  red.addColorStop(0, c.redLit);
  red.addColorStop(0.45, c.red);
  red.addColorStop(1, c.redDeep);
  for (const sd of [-1, 1]) {
    g.save();
    if (P.open > 0) {
      g.translate(1.8, sd * 0.2);
      g.rotate(sd * P.open * 0.8);
      g.scale(1, 1 - 0.3 * Math.min(1, P.open));
      g.translate(-1.8, -sd * 0.2);
    }
    g.beginPath();
    g.ellipse(-0.4, 0, 3.55, 3.2, 0, sd > 0 ? 0 : Math.PI, sd > 0 ? Math.PI : Math.PI * 2);
    g.closePath();
    g.fillStyle = red;
    g.fill();
    g.strokeStyle = c.rim;
    g.lineWidth = 0.38;
    g.stroke();
    g.fillStyle = c.spot;
    g.beginPath();
    g.arc(0.9, sd * 1.55, 0.6, 0, Math.PI * 2);
    g.moveTo(-1.1 + 0.62, sd * 2.05);
    g.arc(-1.1, sd * 2.05, 0.62, 0, Math.PI * 2);
    g.moveTo(-2.5 + 0.5, sd * 0.95);
    g.arc(-2.5, sd * 0.95, 0.5, 0, Math.PI * 2);
    g.moveTo(1.6, 0);
    g.arc(1.6, 0, 0.6, sd > 0 ? Math.PI : 0, sd > 0 ? 0 : Math.PI, true);
    g.fill();
    g.restore();
  }
  // The shine on the dome, fading as the cases lift.
  const shine = 1 - clamp01(P.open);
  if (shine > 0.02) {
    g.fillStyle = fade(c.shine, 0.6 * shine);
    g.beginPath();
    g.ellipse(hx, hy, 1.05, 0.55, Math.atan2(ly * ca + lx * sa, lx * ca - ly * sa) + Math.PI / 2, 0, Math.PI * 2);
    g.fill();
  }

  // The black shield behind the head with its white patches, then the head, turned to look, and its feelers.
  g.fillStyle = c.shield;
  g.beginPath();
  g.ellipse(2.4, 0, 1.15, 2.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c.cheek;
  g.beginPath();
  for (const sd of [-1, 1]) {
    g.moveTo(2.65 + 0.6, sd * 1.35);
    g.ellipse(2.65, sd * 1.35, 0.6, 0.55, sd * 0.4, 0, Math.PI * 2);
  }
  g.fill();
  g.save();
  g.translate(3.2, 0);
  g.rotate(P.look);
  g.strokeStyle = c.shield;
  g.fillStyle = c.shield;
  g.lineWidth = 0.3;
  const club: number[] = [];
  g.beginPath();
  for (const sd of [-1, 1]) {
    const wig = 0.16 * Math.sin(t * 3.1 + sd * 1.7 + seed) + 0.1 * Math.sin(t * 7.7 + sd) - 0.5 * P.groom * (Math.sin(t * 22 + sd) * 0.5 + 0.5);
    const ang = sd * (0.55 + wig) + P.look * 0.5, ex = 0.9 + 1.5 * Math.cos(ang), ey = 0.35 * sd + 1.5 * Math.sin(ang);
    g.moveTo(0.85, sd * 0.4);
    g.quadraticCurveTo(1.35, sd * 0.45, ex, ey);
    club.push(ex, ey);
  }
  g.stroke();
  g.beginPath();
  g.ellipse(0.35, 0, 0.75, 1.05, 0, 0, Math.PI * 2);
  for (let i = 0; i < 4; i += 2) {
    g.moveTo(club[i] + 0.26, club[i + 1]);
    g.arc(club[i], club[i + 1], 0.26, 0, Math.PI * 2);
  }
  g.fill();
  g.fillStyle = c.cheek;
  g.beginPath();
  for (const sd of [-1, 1]) {
    g.moveTo(0.77, sd * 0.62);
    g.arc(0.5, sd * 0.62, 0.27, 0, Math.PI * 2);
  }
  g.fill();
  g.restore();
  g.restore();
}

export function ladybird(g: Ctx, p: LifePiece, t: number, night = false): void {
  const tt = t + (p.seed % 17), k = Math.floor(tt / OUTING);
  let s = tt - k * OUTING;
  const acts = plan({ lanes: lanes(p), y: beamY(p), F: p.F, h: p.h, seed: p.seed }, k);
  let c = acts[acts.length - 1];
  for (const a of acts) {
    if (s < a.d) {
      c = a;
      break;
    }
    s -= a.d;
  }
  draw(g, pose(c, Math.min(s, c.d)), tt, p.seed, night ? NIGHT : DAY);
}
