import { frameCrystals } from '../runecut-frames';
import { clamp01, glow, lerp, rnd, type Ctx, type LifePiece } from './kit';

/**
 * Starlight on the crystals of the blue marble frames, after dark. Time runs
 * in slots of `SLOT` seconds; each slot holds at most one event, picked by the
 * slot's number: a four-pointed star blooming on one crystal (sometimes
 * answered by a smaller one on another), a soft sheen running over every
 * crystal's facets in turn, or a spark hopping from crystal to crystal along
 * the band that blooms where it lands last. Some slots stay dark.
 */

type Gem = { x: number; y: number; r: number };

/** Seconds per slot: one event at most in each. */
const SLOT = 4.2;
/** Seconds a star takes from first light to gone. */
const BLOOM = 1.35;
/** The halo's blue-white, and the rays' paler edge. */
const HALO = '168, 204, 255';
const EDGE = '214, 232, 255';

/** Eases out past 1 and back: the rays shoot out and settle. */
const outBack = (u: number): number => {
  const v = u - 1;
  return 1 + 2.2 * v * v * v + 1.2 * v * v;
};
const inQuad = (u: number): number => u * u;
const outCubic = (u: number): number => 1 - (1 - u) ** 3;

/** Where on a crystal a star sits: on one of its four facets, `f` 0..3 (top left, clockwise). */
function facet(c: Gem, f: number): [number, number] {
  const q = c.r * 0.24;
  const at: Array<[number, number]> = [[-0.62, -0.7], [0.62, -0.7], [0.62, 0.7], [-0.62, 0.7]];
  const [dx, dy] = at[((f % 4) + 4) % 4];
  return [c.x + dx * q * 0.78, c.y + dy * q];
}

/** A needle of light through (x, y) along `a`, `L` to each tip, `b` wide at its waist, added to the path. */
function needle(g: Ctx, x: number, y: number, a: number, L: number, b: number): void {
  const dx = Math.cos(a), dy = Math.sin(a);
  g.moveTo(x + dx * L, y + dy * L);
  g.lineTo(x - dy * b, y + dx * b);
  g.lineTo(x - dx * L, y - dy * L);
  g.lineTo(x + dy * b, y - dx * b);
  g.closePath();
}

/**
 * A four-pointed star at (x, y), rays `L` long, turned `rot`: a blue-white
 * halo, long pale rays with a white inner length, a smaller diagonal cross
 * `d` (0..1) of the way out, and a white core `k` (0..1) bright.
 */
function star(g: Ctx, x: number, y: number, L: number, rot: number, d: number, k: number, halo: number): void {
  glow(g, x, y, L * 0.95, HALO, 0.3 * halo);
  if (L > 0.6) {
    g.beginPath();
    needle(g, x, y, rot, L, 1.05);
    needle(g, x, y, rot + Math.PI / 2, L, 1.05);
    g.fillStyle = `rgba(${EDGE}, ${0.55 * k})`;
    g.fill();
    g.beginPath();
    needle(g, x, y, rot, L * 0.62, 0.62);
    needle(g, x, y, rot + Math.PI / 2, L * 0.62, 0.62);
    g.fillStyle = `rgba(255, 255, 255, ${0.95 * k})`;
    g.fill();
  }
  if (d > 0.02) {
    g.beginPath();
    needle(g, x, y, rot + Math.PI / 4, L * 0.46 * d, 0.6);
    needle(g, x, y, rot - Math.PI / 4, L * 0.46 * d, 0.6);
    g.fillStyle = `rgba(${EDGE}, ${0.7 * k})`;
    g.fill();
  }
  glow(g, x, y, Math.max(2.2, L * 0.3), '255, 255, 255', 0.9 * k);
}

/** How long a crystal's star reaches at full bloom: longer for a bigger crystal, never too small to read. */
const reach = (c: Gem): number => Math.min(18, Math.max(9.5, c.r * 1.55 + 3.5));

/**
 * A star on crystal `c`, `u` (0..1) through its bloom, at `s` of its full
 * size: the halo swells first, the rays shoot out past their length and
 * settle, hold breathing while they turn a little, then draw in, the core
 * last.
 */
function bloom(g: Ctx, c: Gem, u: number, s: number, f: number, turn: number): void {
  if (u <= 0 || u >= 1) return;
  const ray = u < 0.14 ? 0
    : u < 0.4 ? outBack((u - 0.14) / 0.26)
    : u < 0.62 ? 1 + 0.05 * Math.sin((u - 0.4) / 0.22 * Math.PI)
    : u < 0.93 ? 1 - inQuad((u - 0.62) / 0.31) : 0;
  const diag = u < 0.22 ? 0 : u < 0.46 ? outCubic((u - 0.22) / 0.24) : u < 0.58 ? 1 : u < 0.82 ? 1 - (u - 0.58) / 0.24 : 0;
  const core = u < 0.16 ? outCubic(u / 0.16) : u < 0.7 ? 1 : 1 - inQuad((u - 0.7) / 0.3);
  const halo = u < 0.3 ? outCubic(u / 0.3) : 1 - inQuad((u - 0.3) / 0.7);
  const [x, y] = facet(c, f);
  star(g, x, y, reach(c) * s * ray, turn * (u - 0.4) * 0.5, diag, core, halo);
}

/** The crystals in order along the band: round the window by angle, so each one's neighbours are along its edge. */
function ring(at: Gem[], w: number, h: number): Gem[] {
  return [...at].sort((a, b) => Math.atan2(a.y - h / 2, a.x - w / 2) - Math.atan2(b.y - h / 2, b.x - w / 2));
}

/** Two crystals on the same edge of the band, so a hop between them never crosses the window. */
const sameEdge = (a: Gem, b: Gem, F: number): boolean => Math.abs(a.x - b.x) < F * 2 || Math.abs(a.y - b.y) < F * 2;

/** A point `u` along a hop from `a` to `b` bulging `lift` away from the window's middle. */
function hop(a: Gem, b: Gem, u: number, w: number, h: number): [number, number] {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let nx = -(b.y - a.y), ny = b.x - a.x;
  const n = Math.hypot(nx, ny) || 1;
  nx /= n;
  ny /= n;
  if (nx * (mx - w / 2) + ny * (my - h / 2) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const lift = Math.min(10, n * 0.08);
  const cx = mx + nx * lift * 2, cy = my + ny * lift * 2, v = 1 - u;
  return [v * v * a.x + 2 * v * u * cx + u * u * b.x, v * v * a.y + 2 * v * u * cy + u * u * b.y];
}

/** Seconds a cascade takes: per hop, and the last bloom. */
const HOP = 0.42;

/**
 * A spark leaving `run[0]` with a small star, hopping along the band to each
 * next crystal with a short tail, each landing a small star, the last one a
 * full bloom. `e` is seconds since it began.
 */
function cascade(g: Ctx, run: Gem[], e: number, w: number, h: number, seed: number): void {
  const hops = run.length - 1;
  for (let i = 0; i <= hops; i++) {
    const last = i === hops;
    const at = i * HOP + (i === 0 ? 0 : 0.06);
    const dur = last ? BLOOM : 0.72;
    bloom(g, run[i], (e - at + 0.18) / dur, last ? 1 : 0.5, last ? 0 : 1, rnd(seed, i) < 0.5 ? -1 : 1);
  }
  for (let i = 0; i < hops; i++) {
    const u = (e - i * HOP - 0.12) / (HOP * 0.86);
    if (u <= 0 || u >= 1.3) continue;
    const head = Math.min(1, u), fade = Math.min(1, u * 5) * (1 - clamp01((u - 1) / 0.3));
    const at = (v: number): [number, number] => hop(run[i], run[i + 1], v * v * (3 - 2 * v), w, h);
    // The tail: a streak back along the hop, thinning and fading.
    g.lineCap = 'round';
    let [px, py] = at(head);
    for (let j = 1; j <= 6; j++) {
      const v = Math.max(0, head - j * 0.045);
      const [x, y] = at(v);
      g.strokeStyle = `rgba(${EDGE}, ${0.7 * fade * (1 - j / 7)})`;
      g.lineWidth = 1.5 * (1 - j / 8);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(x, y);
      g.stroke();
      [px, py] = [x, y];
    }
    const [x, y] = at(head);
    glow(g, x, y, 5, HALO, 0.5 * fade);
    g.fillStyle = `rgba(255, 255, 255, ${0.95 * fade})`;
    g.beginPath();
    g.arc(x, y, 1.1, 0, Math.PI * 2);
    g.fill();
  }
}

/** The inner gem of a crystal set as `gemLozenge` cuts it, as a path. */
function gemPath(g: Ctx, c: Gem): void {
  const k = c.r * 0.66;
  g.beginPath();
  g.moveTo(c.x, c.y - k);
  g.lineTo(c.x + k * 0.78, c.y);
  g.lineTo(c.x, c.y + k);
  g.lineTo(c.x - k * 0.78, c.y);
  g.closePath();
}

/** Seconds a sheen takes to cross the frame, and to cross one crystal. */
const SWEEP = 1.5;
const SHEEN = 0.75;
/** The sheen's band leans this way off its travel: cos and sin of 35 degrees. */
const TILT = [Math.cos(0.61), Math.sin(-0.61)] as const;

/**
 * A soft sheen crossing the frame in direction (dx, dy): as it reaches each
 * crystal a pale band runs over its facets with a faint halo, and the crystal
 * it reaches last gives a small star. `e` is seconds since it began.
 */
function shimmer(g: Ctx, at: Gem[], e: number, dx: number, dy: number, w: number, h: number): void {
  const span = Math.abs(dx) * w + Math.abs(dy) * h || 1;
  const o = (c: Gem): number => ((c.x - w / 2) * dx + (c.y - h / 2) * dy) / span + 0.5;
  let end = at[0];
  for (const c of at) if (o(c) > o(end)) end = c;
  for (const c of at) {
    const u = (e - o(c) * SWEEP) / SHEEN;
    if (u <= 0 || u >= 1) continue;
    const s = Math.sin(Math.PI * u);
    glow(g, c.x, c.y, c.r * 1.5 + 3, HALO, 0.32 * s);
    // On a crystal too small for its band to show, a faint twinkle stands in for it.
    const small = clamp01((9 - c.r) / 4);
    if (small > 0) star(g, c.x, c.y - c.r * 0.1, reach(c) * 0.5 * s, 0, 0, 0.7 * s * small, 0);
    if (small >= 1) continue;
    const k = c.r * 0.66, p = lerp(-1.4, 1.4, u);
    const bx = c.x + dx * k * p, by = c.y + dy * k * p;
    // Across the band, slanted off its way of travel.
    const sx = dx * TILT[0] - dy * TILT[1], sy = dx * TILT[1] + dy * TILT[0];
    const f = g.createLinearGradient(bx - sx * k * 0.55, by - sy * k * 0.55, bx + sx * k * 0.55, by + sy * k * 0.55);
    f.addColorStop(0, 'rgba(255, 255, 255, 0)');
    f.addColorStop(0.5, `rgba(255, 255, 255, ${0.85 * s})`);
    f.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.save();
    gemPath(g, c);
    g.clip();
    g.fillStyle = f;
    g.fillRect(c.x - k, c.y - k, k * 2, k * 2);
    g.restore();
  }
  bloom(g, end, (e - (o(end) * SWEEP + SHEEN * 0.45)) / (BLOOM * 0.8), 0.6, 2, 1);
}

/** One event's kind for slot `k`, and when in the slot it starts. */
function event(seed: number, k: number): { kind: number; start: number } {
  const r = rnd(seed * 1.37 + 5.1, k);
  const kind = r < 0.12 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : 3;
  return { kind, start: 0.2 + rnd(seed + 9.7, k) * 0.9 };
}

/** The crystal slot `k` picks, never the one the slot before it picked. */
function pick(seed: number, k: number, n: number): number {
  const raw = (j: number): number => Math.floor(rnd(seed * 0.71 + 2.3, j) * n);
  const i = raw(k);
  return i === raw(k - 1) ? (i + 1 + Math.floor(rnd(seed, k + 0.5) * (n - 1))) % n : i;
}

/** The glints on a blue marble frame's crystals at `t` seconds: whatever its slot holds now. */
export function glints(g: Ctx, p: LifePiece, t: number): void {
  const at: Gem[] = frameCrystals(p.kind, p.w, p.h, p.F);
  const n = at.length;
  if (!n) return;
  const k = Math.floor(t / SLOT);
  const { kind, start } = event(p.seed, k);
  const e = t - k * SLOT - start;
  if (kind === 0 || e <= 0) return;
  const turn = rnd(p.seed + 3.3, k) < 0.5 ? -1 : 1;
  if (kind === 1) {
    // One star; sometimes a smaller one answers on another crystal.
    const i = pick(p.seed, k, n), f = Math.floor(rnd(p.seed + 1.9, k) * 4);
    const s = 0.85 + 0.2 * rnd(p.seed + 4.4, k);
    bloom(g, at[i], e / BLOOM, s, f, turn);
    if (n > 1 && rnd(p.seed + 6.6, k) < 0.4) {
      const j = (i + 1 + Math.floor(rnd(p.seed + 7.7, k) * (n - 1))) % n;
      bloom(g, at[j], (e - 0.55) / (BLOOM * 0.8), 0.55, f + 2, -turn);
    }
  } else if (kind === 2) {
    // A sheen across the frame: left to right or back, or corner to corner.
    const r = rnd(p.seed + 8.8, k), w = p.w, h = p.h;
    const [dx, dy] = r < 0.35 ? [1, 0] : r < 0.7 ? [-1, 0] : [0.83 * (r < 0.85 ? 1 : -1), 0.55];
    shimmer(g, at, e, dx, dy, w, h);
  } else {
    // A spark hopping two or three crystals along the band.
    const order = ring(at, p.w, p.h);
    const from = pick(p.seed, k, n), hops = Math.min(n - 1, 2 + Math.floor(rnd(p.seed + 2.2, k) * 2));
    const along = (dir: number): Gem[] => {
      const run = [order[from]];
      for (let i = 1; i <= hops; i++) {
        const c = order[(((from + dir * i) % n) + n) % n];
        if (!sameEdge(run[i - 1], c, p.F)) break;
        run.push(c);
      }
      return run;
    };
    const a = along(turn), b = along(-turn), run = b.length > a.length ? b : a;
    if (run.length > 1) cascade(g, run, e, p.w, p.h, p.seed + k);
    else bloom(g, run[0], e / BLOOM, 1, 0, turn);
  }
}
