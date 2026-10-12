import { rand } from '../../render/ivy';
import { SIZE, clamp01, ease, rnd, type Ctx, type LifePiece } from './kit';

type Pt = [number, number];

/**
 * Where the white flowers on the wildermon's frame (`PAINTERS.wicker`) are, w × h, band F, seed:
 * the painter's own draws replayed off the same seed and in the same order (the grain's three a
 * line, each twig's leaves along its curves about 2 px a step, each clump's leaves), keeping only
 * the flowers. A twig is given as its points flat, each pair after the first a bend and an end.
 */
function flowers(w: number, h: number, F: number, seed: number): Pt[] {
  const R = rand(seed * 7 + 3);
  const out: Pt[] = [];
  const lines = Math.max(2, Math.round((F * 0.72 - F * 0.08) / 3.2));
  for (let k = 0; k < 4 * lines * 3; k++) R();
  const twig = (...c: number[]): void => {
    let run = 0, next = F * 0.4, side = 1, n = 0, px = c[0], py = c[1];
    for (let j = 0; j + 5 < c.length; j += 4) {
      const ax = c[j], ay = c[j + 1], cx = c[j + 2], cy = c[j + 3], bx = c[j + 4], by = c[j + 5];
      const steps = Math.max(4, Math.ceil((Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2) + Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2)) / 2));
      for (let q = 1; q <= steps; q++) {
        const t = q / steps, u = 1 - t;
        const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
        const dx = x - px, dy = y - py;
        px = x;
        py = y;
        run += Math.sqrt(dx * dx + dy * dy);
        if (run < next) continue;
        const ang = Math.atan2(dy, dx);
        R();
        R();
        if (n % 3 === 2) out.push([x + Math.cos(ang + side * 1.6) * F * 0.25, y + Math.sin(ang + side * 1.6) * F * 0.25]);
        side = -side;
        n++;
        next = run + F * (0.55 + R() * 0.3);
      }
    }
  };
  const clump = (x: number, y: number, r: number, n: number): void => {
    for (let k = 0; k < 18; k++) R();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R();
      out.push([x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45]);
    }
  };
  twig(F * 0.2, F * 3.6, -F * 0.05, F * 0.3, F * 1.2, F * 0.15, F * 3.2, -F * 0.2, F * 5.4, F * 0.15);
  twig(w - F * 4.6, F * 0.15, w - F * 1.6, -F * 0.25, w - F * 0.25, F * 0.5, w + F * 0.1, F * 2, w - F * 0.2, F * 3.8);
  clump(F * 0.3, F * 0.3, F * 0.85, 3);
  clump(w - F * 0.35, F * 0.35, F * 0.75, 2);
  twig(F * 0.3, h * 0.36 + F * 1.5, F * 0.05, h * 0.36, F * 0.35, h * 0.36 - F * 1.6);
  twig(w - F * 0.3, h * 0.36 + F * 1.6, w - F * 0.05, h * 0.36, w - F * 0.35, h * 0.36 - F * 1.5);
  twig(F * 0.35, h - F * 0.2, F * 0.1, h - F * 1.6, F * 0.4, h - F * 3);
  twig(w - F * 0.35, h - F * 0.2, w - F * 0.1, h - F * 1.6, w - F * 0.4, h - F * 3);
  clump(F * 0.35, h - F * 0.4, F, 3);
  clump(w - F * 0.35, h - F * 0.4, F, 3);
  for (const d of [-1, 1]) out.push([w / 2 + d * F * 0.92 * 1.25, h - F * 0.2 - F * 0.3]);
  return out;
}

/**
 * A rounded loop round the band, `a` in from the window's edge with corners `r` round, `P` long:
 * places on it are (s along it clockwise from the top's left end, d out from it), so a flight
 * between two flowers can follow the band round a corner and never cross the window.
 */
interface Rim { w: number; h: number; a: number; r: number; W: number; H: number; Q: number; P: number }

function rim(w: number, h: number, F: number): Rim {
  const a = F * 0.35, r = F * 1.1, W = Math.max(0, w - 2 * (a + r)), H = Math.max(0, h - 2 * (a + r)), Q = (r * Math.PI) / 2;
  return { w, h, a, r, W, H, Q, P: 2 * (W + H) + 4 * Q };
}

/** The point `d` out from `s` along the loop. */
function rimAt(m: Rim, s: number, d: number): Pt {
  const { w, h, a, r, W, H, Q } = m;
  let u = ((s % m.P) + m.P) % m.P;
  const sides: Array<[number, number, number, number, number]> = [
    // start x, start y, its length, the corner's centre x, y after it
    [a + r, a, W, w - a - r, a + r],
    [w - a, a + r, H, w - a - r, h - a - r],
    [w - a - r, h - a, W, a + r, h - a - r],
    [a, h - a - r, H, a + r, a + r],
  ];
  for (let i = 0; i < 4; i++) {
    const [x0, y0, len, cx, cy] = sides[i], th = -Math.PI / 2 + (i * Math.PI) / 2;
    const dx = Math.cos(th + Math.PI / 2), dy = Math.sin(th + Math.PI / 2);
    if (u <= len) return [x0 + dx * u + Math.cos(th) * d, y0 + dy * u + Math.sin(th) * d];
    u -= len;
    if (u <= Q || i === 3) {
      const ph = th + u / r;
      return [cx + Math.cos(ph) * (r + d), cy + Math.sin(ph) * (r + d)];
    }
    u -= Q;
  }
  return [0, 0];
}

/** Where (x, y) is on the loop: [s, d]. */
function rimOf(m: Rim, x: number, y: number): Pt {
  const { w, h, a, r, W, H, Q } = m;
  const cx = Math.min(w - a - r, Math.max(a + r, x)), cy = Math.min(h - a - r, Math.max(a + r, y));
  const d = Math.hypot(x - cx, y - cy) - r;
  let ph = Math.atan2(y - cy, x - cx);
  const inX = x > a + r && x < w - a - r, inY = y > a + r && y < h - a - r;
  if (inX && y <= a + r) return [x - a - r, d];
  if (inY && x >= w - a - r) return [W + Q + y - a - r, d];
  if (inX && y >= h - a - r) return [W + H + 2 * Q + w - a - r - x, d];
  if (inY && x <= a + r) return [2 * W + H + 3 * Q + h - a - r - y, d];
  if (ph < -Math.PI / 2 - 1e-9) ph += Math.PI * 2;
  // The corner whose quarter it is in, by its angle from the corner's centre.
  if (ph < 0) return [W + r * (ph + Math.PI / 2), d];
  if (ph < Math.PI / 2) return [W + Q + H + r * ph, d];
  if (ph < Math.PI) return [2 * W + H + 2 * Q + r * (ph - Math.PI / 2), d];
  return [2 * W + 2 * H + 3 * Q + r * (ph - Math.PI), d];
}

/** A butterfly's colours: wing face, its pale base, the dark of its tips and spots, the pale dots on them, its underside, its outline, its body. */
interface Look { fill: string; lit: string; tip: string; dot: string; under: string; ink: string; body: string; beat: number }

/** An apricot one and a powder-blue one; `beat` is its wingbeats a second in flight. */
const LOOKS: Look[] = [
  { fill: '#f7b46e', lit: '#fde0b4', tip: '#8a5236', dot: '#fff6e2', under: '#f1dcb6', ink: '#5b3826', body: '#4e3a30', beat: 7.2 },
  { fill: '#93bdf0', lit: '#d6e8fc', tip: '#46679f', dot: '#ffffff', under: '#e4e8ef', ink: '#34476f', body: '#3c3a48', beat: 6.6 },
];

/*
 * The right wings as cubic curves, flat (start, then three points a curve), their roots on the body
 * at the origin, the head toward -y; and on the forewing its dark tip, as a curve of its own along
 * the wing's edge from a point on the leading edge round the apex and back.
 */
const FORE = [0.24, -1.12, 1.28, -3.12, 3.2, -4.24, 4.32, -3.68, 4.8, -2.72, 4.32, -1.04, 3.44, -0.32, 2.4, 0.24, 1.12, 0.24, 0.24, 0];
const HIND = [0.24, -0.16, 1.92, -0.48, 3.68, 0, 3.52, 1.52, 3.36, 2.88, 2.08, 3.68, 1.04, 3.36, 0.48, 3.04, 0.24, 1.92, 0.24, 0.96];
const TIP = [3.14, -3.75, 3.55, -4.0, 4.0, -3.95, 4.32, -3.68, 4.62, -3.3, 4.6, -2.95, 4.51, -2.67, 4.0, -2.55, 3.4, -2.9, 3.14, -3.75];

/** Adds a shape of cubic curves to the path, its x times `sx`, so one path holds both sides. */
function shape(g: Ctx, c: readonly number[], sx: number): void {
  g.moveTo(c[0] * sx, c[1]);
  for (let j = 2; j < c.length; j += 6) g.bezierCurveTo(c[j] * sx, c[j + 1], c[j + 2] * sx, c[j + 3], c[j + 4] * sx, c[j + 5]);
  g.closePath();
}

/** Adds a round spot at (x, y), `rx` by `ry`, to the path, on its own. */
function spot(g: Ctx, x: number, y: number, rx: number, ry: number): void {
  g.moveTo(x + rx, y);
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

/**
 * A butterfly at (x, y), its head toward `ang`, wings `open` (1 flat, near 0 folded up so the
 * pale underside shows), antennae swept `ant` from their rest. Each colour is one path for both
 * sides: wings, their pale roots, dark tips and spots, pale dots, the outlines with the
 * antennae, then the body.
 */
function draw(g: Ctx, x: number, y: number, ang: number, open: number, look: Look, ant: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang + Math.PI / 2);
  g.scale(SIZE, SIZE);
  const o = Math.max(0.07, Math.min(1, open)), under = o < 0.28;
  const wings = (): void => {
    g.beginPath();
    for (const sx of [o, -o]) {
      shape(g, HIND, sx);
      shape(g, FORE, sx);
    }
  };
  wings();
  g.fillStyle = under ? look.under : look.fill;
  g.fill();
  if (!under) {
    g.beginPath();
    for (const sx of [o, -o]) spot(g, 1.0 * sx, -1.0, 0.8 * o, 0.75);
    g.fillStyle = look.lit;
    g.fill();
    g.beginPath();
    for (const sx of [o, -o]) {
      shape(g, TIP, sx);
      spot(g, 2.2 * sx, 2.2, 0.62 * o, 0.62);
    }
    g.fillStyle = look.tip;
    g.fill();
    g.beginPath();
    for (const sx of [o, -o]) {
      spot(g, 3.75 * sx, -3.2, 0.34 * o, 0.34);
      spot(g, 4.3 * sx, -2.95, 0.26 * o, 0.26);
      spot(g, 2.25 * sx, 2.12, 0.24 * o, 0.24);
    }
    g.fillStyle = look.dot;
    g.fill();
  }
  wings();
  for (const side of [-1, 1]) {
    const a = side * (0.42 + ant), ex = Math.sin(a) * 2.3, ey = -1.9 - Math.cos(a) * 2.3;
    g.moveTo(side * 0.2, -1.95);
    g.quadraticCurveTo(side * 0.25 + ex * 0.2, ey + 0.6, ex, ey);
  }
  g.lineJoin = 'round';
  g.lineWidth = 0.38;
  g.strokeStyle = look.ink;
  g.stroke();
  // The body: clubs on the antennae, abdomen, furry thorax, head.
  g.beginPath();
  for (const side of [-1, 1]) {
    const a = side * (0.42 + ant);
    spot(g, Math.sin(a) * 2.3, -1.9 - Math.cos(a) * 2.3, 0.36, 0.36);
  }
  spot(g, 0, 1.25, 0.5, 1.75);
  spot(g, 0, -0.55, 0.68, 0.85);
  spot(g, 0, -1.6, 0.55, 0.55);
  g.fillStyle = look.body;
  g.fill();
  g.restore();
}

/** One wildermon's two butterflies' rhythm: a beat in which each sits a while and then flies on, in seconds. */
const BEAT = 7.5;

/** 0 below a, 1 above b, eased between. */
const smooth = (a: number, b: number, u: number): number => ease(clamp01((u - a) / (b - a)));

/** A perch: a flower's place, and where it is on the loop round the band. */
interface Perch { x: number; y: number; s: number; d: number }

/**
 * One butterfly's move in one beat: from a perch to a perch, off at `tau` into the beat, `D` long;
 * in a chase or not; and, where it stays on its flower, whether it only turns about on it.
 */
interface Flight { a: Perch; b: Perch; tau: number; D: number; chase: boolean; ds: number; turn: boolean }

/**
 * Two butterflies on the wildermon's frame by day, an apricot one and a blue one, each with
 * flowers of its own among the frame's white ones. Each beat each sits on its flower, fanning its
 * wings, and then crouches and flies on round the band to another, turns about where it sits, or
 * hops up and settles again; now and then, when the two are near, they take off together and
 * circle each other on the way and land side by side.
 */
export function butterflies(g: Ctx, p: LifePiece, t: number): void {
  const { w, h, F, R } = p;
  const m = rim(w, h, F);
  // The flowers clear of the window by a few px, inside the reach, one to a cluster, in order round the band.
  const perches: Perch[] = [];
  for (const [x, y] of flowers(w, h, F, p.seed)) {
    if (x > F - 4 && x < w - F + 4 && y > F - 4 && y < h - F + 4) continue;
    if (x < 4 - R || x > w + R - 4 || y < 4 - R || y > h + R - 4) continue;
    if (perches.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < 81)) continue;
    const [s, d] = rimOf(m, x, y);
    perches.push({ x, y, s, d });
  }
  if (perches.length < 2) return;
  perches.sort((a, b) => a.s - b.s);
  const N = perches.length, P = m.P, sd = p.seed % 997;
  const wrap = (s: number): number => s - P * Math.round(s / P);
  // The perch nearest `s` of butterfly i's own (every other one round the band), so the two never share a flower.
  const near = (i: number, s: number): number => {
    let best = 0, bd = Infinity;
    for (let n = 0; n < N; n++) {
      if (N >= 4 && n % 2 !== i) continue;
      const dd = Math.abs(wrap(perches[n].s - s));
      if (dd < bd) { bd = dd; best = n; }
    }
    return best;
  };
  // Where on the band each drifts to in beat k: both slowly clockwise, each wandering either side, now near, now apart.
  const roam = (i: number, k: number): number => P * (i === 0
    ? 0.05 * k + 0.12 * Math.sin(0.83 * k + sd) + 0.07 * Math.sin(2.1 * k + sd * 1.7)
    : 0.05 * k + 0.3 + 0.14 * Math.sin(0.37 * k + sd * 1.3) + 0.12 * Math.sin(0.61 * k + sd * 0.4) + 0.06 * Math.sin(1.3 * k + sd * 2.3) + 0.04 * Math.sin(2.9 * k + sd * 0.9));
  // A chase starts on an even beat when the two sit near each other; the blue one follows and lands by the other.
  const chase = (k: number): boolean => k % 2 === 0 && rnd(sd + 11, k) < 0.7
    && Math.abs(wrap(perches[near(0, roam(0, k))].s - perches[near(1, roam(1, k))].s)) < P * 0.2;
  const pick = (i: number, k: number): number => (i === 1 && k % 2 !== 0 && chase(k - 1) ? near(1, perches[pick(0, k)].s) : near(i, roam(i, k)));
  // Each butterfly's move in a beat, worked out once a call: the beat before, this one and the next are asked for again and again.
  const known = new Map<number, Flight>();
  const flight = (i: number, k: number): Flight => {
    let f = known.get(k * 2 + i);
    if (!f) known.set(k * 2 + i, (f = plan(i, k)));
    return f;
  };
  const plan = (i: number, k: number): Flight => {
    const a = perches[pick(i, k)], b = perches[pick(i, k + 1)], ch = chase(k);
    const ds = wrap(b.s - a.s);
    const turn = a === b && !ch && rnd(sd + 17 + i, k) < 0.6;
    let D = turn ? 0.7 : a === b ? 1.3 : Math.min(4.2, Math.max(1.2, 0.9 + Math.abs(ds) / 55));
    let tau: number;
    if (ch) {
      const a0 = perches[pick(0, k)], b0 = perches[pick(0, k + 1)], a1 = perches[pick(1, k)], b1 = perches[pick(1, k + 1)];
      D = Math.min(4.6, Math.max(2.6, 1.8 + Math.max(Math.abs(wrap(b0.s - a0.s)), Math.abs(wrap(b1.s - a1.s))) / 55));
      tau = 0.5 + rnd(sd + 3, k) * (BEAT - D - 1.4) + i * 0.3;
    } else tau = 0.5 + rnd(sd + 3 + i * 5, k) * Math.max(0, BEAT - D - 1.2);
    return { a, b, tau, D, chase: ch, ds, turn };
  };
  // Its head's way on the perch it reaches in beat k: up the frame, give or take 40 degrees.
  const perched = (i: number, k: number): number => -Math.PI / 2 + (rnd(sd + 7 + i * 13, k) - 0.5) * 1.4;
  // Its place in flight `f`, `l` into the beat, before the bob of its wingbeats, and how high it is.
  const base = (i: number, f: Flight, l: number, tt: number): [number, number, number] => {
    const u = clamp01((l - f.tau) / f.D), e = ease(u), env = Math.sin(Math.PI * u);
    const lift = f.a === f.b ? 8 : Math.min(F * 0.5, 5 + Math.abs(f.ds) * 0.05);
    const s = f.a.s + f.ds * e + env * 5 * Math.sin(tt * 2.3 + i * 2);
    const up = lift * env + env * (2.5 * Math.sin(tt * 3.1 + i) + 1.5 * Math.sin(tt * 5.3 + i * 3));
    const [x, y] = rimAt(m, s, f.a.d + (f.b.d - f.a.d) * e + up);
    return [x, y, up];
  };
  // In a chase: the apricot one's own path, and the two circling each other about it.
  const place = (i: number, k: number, f: Flight, l: number, tt: number): [number, number, number] => {
    const own = base(i, f, l, tt);
    if (!f.chase) return own;
    const lead = i === 0 ? own : base(0, flight(0, k), l, tt);
    const u = clamp01((l - f.tau) / f.D), env = Math.sin(Math.PI * u) ** (i === 0 ? 2 : 1.3);
    const sp = tt * Math.PI * 2 * 1.25, r = 6 * env * (i === 0 ? 1 : -1);
    const cx = lead[0] + Math.cos(sp) * r, cy = lead[1] + Math.sin(sp) * r * 0.8;
    return i === 0 ? [cx, cy, own[2]] : [own[0] + (cx - own[0]) * env, own[1] + (cy - own[1]) * env, own[2]];
  };
  for (let i = 0; i < 2; i++) {
    const look = LOOKS[i];
    const tt = t + sd * 3.1;
    const k = Math.floor(tt / BEAT), l = tt - k * BEAT;
    const f = flight(i, k);
    let x: number, y: number, ang: number, open: number, ant = 0, alt = 0;
    if (f.turn && l >= f.tau && l < f.tau + f.D) {
      // Turning about on its flower: wings half shut, a little step round.
      const u = (l - f.tau) / f.D, e = ease(u), h0 = perched(i, k), h1 = perched(i, k + 1);
      x = f.a.x;
      y = f.a.y - 0.6 * Math.sin(Math.PI * u);
      ang = h0 + Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) * e;
      open = 0.55 + 0.35 * e - 0.2 * Math.sin(Math.PI * u);
      ant = 0.1 * Math.sin(Math.PI * u);
    } else if (l >= f.tau && l < f.tau + f.D) {
      // In flight: fast wingbeats, the body lifted on each downstroke, its head the way it goes.
      const u = (l - f.tau) / f.D, q = l - f.tau;
      let ph = Math.PI * 2 * look.beat * (f.chase ? 1.15 : 1) * q;
      ph += 0.35 * Math.sin(ph);
      const flap = 0.5 - 0.5 * Math.cos(ph);
      const glide = Math.max(smooth(0.8, 1, u), smooth(0.8, 0.97, Math.sin(tt * 1.3 + i * 2)) * Math.sin(Math.PI * u) * 0.8);
      open = 0.1 + 0.9 * flap + (0.9 - (0.1 + 0.9 * flap)) * glide;
      const [bx, by, up] = place(i, k, f, l, tt);
      const a0 = place(i, k, f, l - 0.07, tt - 0.07), a1 = place(i, k, f, l + 0.07, tt + 0.07);
      const fly = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
      const h0 = perched(i, k), h1 = perched(i, k + 1);
      // Its head from the perch's way round to the next, and toward where it goes while it goes fast enough to show it.
      const hb = smooth(0.15, 0.85, u), speed = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 0.14;
      const wf = smooth(12, 45, speed) * smooth(0, 0.22, u) * (1 - smooth(0.75, 1, u));
      const hx = Math.cos(h0) * (1 - hb) + Math.cos(h1) * hb, hy = Math.sin(h0) * (1 - hb) + Math.sin(h1) * hb;
      ang = Math.atan2(hy * (1 - wf) + Math.sin(fly) * wf * 1.2, hx * (1 - wf) + Math.cos(fly) * wf * 1.2);
      const bob = (1 - glide) * Math.min(1, Math.sin(Math.PI * u) * 3);
      x = bx;
      y = by - 1.1 * Math.sin(ph) * bob;
      ant = 0.18 * Math.sin(Math.PI * u);
      alt = up;
    } else {
      // Perched: wings fanned slowly open and shut, a settle on landing, a crouch with wings up before taking off.
      const landed = l < f.tau;
      const prev = landed ? flight(i, k - 1) : f;
      const since = landed ? l + BEAT - prev.tau - prev.D : l - f.tau - f.D;
      const next = landed ? f : flight(i, k + 1), until = landed ? f.tau - l : BEAT - l + next.tau;
      const at = landed ? f.a : f.b;
      const ph = Math.PI * 2 * (0.3 * tt + 0.07 * Math.sin(0.9 * tt + i)) + i * 2.1;
      const fan = 1 - (0.6 + 0.3 * Math.sin(0.23 * tt + i * 1.7) ** 2) * (0.5 - 0.5 * Math.cos(ph)) ** 2;
      const settle = 0.9 + 0.1 * smooth(0, 0.25, since) - 0.4 * Math.exp(-2.2 * since) * Math.sin(Math.PI * 2.6 * since) ** 2;
      open = settle + (fan - settle) * smooth(0.6, 2.4, since);
      const crouch = smooth(0.55, 0.05, until) * (next.turn ? 0.5 : 1);
      open += (0.1 - open) * crouch;
      x = at.x;
      y = at.y + 0.5 * crouch - 0.4 * Math.exp(-6 * since) * Math.sin(since * 18);
      ang = perched(i, landed ? k : k + 1) + 0.1 * Math.sin(0.5 * tt + i * 3) * smooth(0.5, 2, since) * smooth(0, 0.6, until);
      ant = 0.22 * Math.exp(-4 * since) * Math.sin(since * 14) + 0.05 * Math.sin(tt * 1.7 + i);
    }
    // Its shadow on the frame below it, fainter and further off the higher it is.
    const sa = 0.16 * clamp01(1 - alt / 22);
    if (sa > 0.01) {
      g.beginPath();
      g.ellipse(x + 1 + alt * 0.25, y + 2 + alt * 0.45, 1.2 + 4.2 * Math.max(0.15, open), 1.6, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(60, 40, 25, ${sa})`;
      g.fill();
    }
    draw(g, x, y, ang, open, look, ant);
  }
}
