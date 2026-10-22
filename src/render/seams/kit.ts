import { GLYPHS } from '../runestone';
import type { Ctx, RGB } from './types';

/**
 * The pieces every kind's look is drawn from, so fifteen kinds of ore come
 * out as one set: the same ink round everything, the same cream in the
 * light, the same soft dome on a lump and the same two-tone facets on a
 * crystal, and the island's runes for what is rare.
 *
 * The set is the rune pastel kit's (`runestone.ts`, `forge.ts`): an outline in
 * a mauve ink rather than black, a body in a chalky pastel, its shade taken
 * toward violet-grey rather than toward black, and its light toward a warm
 * cream. Glow is the runes' own: a soft halo and a pale core.
 *
 * Everything here works in whatever units the canvas is set up in; a strip's
 * are tiles (see `types.ts`). Nothing here is drawn per frame -- it paints the
 * pictures that are -- so it is written to read, not to be fast.
 */

export const TAU = Math.PI * 2;

export const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
export const css = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The ink every outline is drawn in: the kit's stone ink, a shade toward violet. */
export const INK: RGB = hex('#4d4258');
/** The light on everything: a warm cream. */
export const CREAM: RGB = hex('#fff8ea');
/** Where shade goes: violet-grey, never black. */
export const DUSK: RGB = hex('#6a5f7a');
/** The rock the ore is in, as the ground draws it (`ROCK_VARIANTS[0]`). */
export const STONE: RGB = [168, 166, 178];

/** A body colour and the tones the kit draws it in. */
export interface Pal {
  /** The line round it. */
  rim: RGB;
  /** Its side away from the light. */
  dark: RGB;
  body: RGB;
  /** Its side in the light. */
  lit: RGB;
  /** The brightest point on it. */
  shine: RGB;
}

/** A palette off one body colour, the kit's way: shade toward dusk, light toward cream, line in ink. */
export function palOf(body: RGB | string, o: { rim?: number; dark?: number; lit?: number; shine?: number } = {}): Pal {
  const b = typeof body === 'string' ? hex(body) : body;
  return {
    rim: mix(b, INK, o.rim ?? 0.62),
    dark: mix(b, DUSK, o.dark ?? 0.32),
    body: b,
    lit: mix(b, CREAM, o.lit ?? 0.42),
    shine: mix(b, CREAM, o.shine ?? 0.85),
  };
}

/* ---- repeating along a strip ------------------------------------------------ */

/**
 * A wobble that comes back to where it started after `L`: a sum of sines
 * whose wavelengths all divide `L`. A strip is repeated end to end, so a
 * band's edge drawn with one of these runs on through the join.
 */
export function periodic(R: () => number, L: number, amp: number, terms: ReadonlyArray<[number, number]> = [[1, 0.6], [2, 0.3], [3, 0.18]]): (t: number) => number {
  const ph = terms.map(() => R() * TAU);
  return (t: number) => {
    let s = 0;
    for (let i = 0; i < terms.length; i++) s += Math.sin((terms[i][0] * TAU * t) / L + ph[i]) * terms[i][1];
    return s * amp;
  };
}

/** Call `fn` at `x`, and again a strip's length either way if anything within `r` of `x` would cross an end. */
export function wrap(L: number, x: number, r: number, fn: (x: number) => void): void {
  fn(x);
  if (x - r < 0) fn(x + L);
  if (x + r > L) fn(x - L);
}

/**
 * A ribbon along the strip: its middle at `mid(t)` and its half-width at
 * `w(t)`, as one closed path from a little before 0 to a little past `L`.
 * Where `w` goes to nothing the ribbon pinches out to a point and starts
 * again: a vein that thins away and picks up.
 */
export function ribbon(L: number, mid: (t: number) => number, w: (t: number) => number, step = 0.04): Path2D {
  const p = new Path2D();
  const n = Math.ceil((L + 0.6) / step);
  const top: number[] = [];
  const bot: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = -0.3 + i * step;
    const m = mid(t), h = Math.max(0, w(t));
    top.push(t, m - h);
    bot.push(t, m + h);
  }
  p.moveTo(top[0], top[1]);
  for (let i = 2; i < top.length; i += 2) p.lineTo(top[i], top[i + 1]);
  for (let i = bot.length - 2; i >= 0; i -= 2) p.lineTo(bot[i], bot[i + 1]);
  p.closePath();
  return p;
}

/** An irregular round lump: `k` bumps on a ring of radius `r`, squashed by `sq` along `ang`. */
export function lump(p: Path2D | Ctx, x: number, y: number, r: number, R: () => number, k = 7, rough = 0.22, sq = 1, ang = 0): void {
  const pts: number[] = [];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + (R() - 0.5) * 0.5;
    const rr = r * (1 - rough / 2 + R() * rough);
    const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
    pts.push(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
  }
  // Round it off: a quadratic through the midpoints of each side, the corners as handles.
  const mx = (i: number): number => (pts[(i * 2) % pts.length] + pts[((i + 1) * 2) % pts.length]) / 2;
  const my = (i: number): number => (pts[(i * 2 + 1) % pts.length] + pts[((i + 1) * 2 + 1) % pts.length]) / 2;
  p.moveTo(mx(k - 1), my(k - 1));
  for (let i = 0; i < k; i++) p.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  p.closePath();
}

/** A polygon through flat corner pairs. */
export function poly(p: Path2D | Ctx, pts: readonly number[]): void {
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  p.closePath();
}

/**
 * The bed a vein lies in: the ribbon drawn as a channel in the stone, a
 * shadow of ink just wider than it, so what sits in it reads as set into the
 * face rather than painted on it.
 */
export function channel(g: Ctx, path: Path2D, grow: number, a = 0.35, ink: RGB = INK): void {
  g.save();
  g.strokeStyle = css(ink, a);
  g.lineWidth = grow * 2;
  g.stroke(path);
  g.restore();
}

/**
 * A lump of ore in the kit's way: its line, its body, a dome of light toward
 * the top of it and a fleck of shine. `r` is its radius; the lump itself is
 * `lump`'s, from `R`.
 */
export function nugget(g: Ctx, x: number, y: number, r: number, pal: Pal, R: () => number, o: { k?: number; rough?: number; sq?: number; ang?: number; line?: number; shine?: boolean } = {}): void {
  const p = new Path2D();
  lump(p, x, y, r, R, o.k ?? 7, o.rough ?? 0.28, o.sq ?? 0.82, o.ang ?? R() * TAU);
  g.save();
  g.lineWidth = r * (o.line ?? 0.32);
  g.strokeStyle = css(pal.rim);
  g.stroke(p);
  g.fillStyle = css(pal.dark);
  g.fill(p);
  g.clip(p);
  g.fillStyle = css(pal.body);
  g.beginPath();
  g.ellipse(x - r * 0.12, y - r * 0.16, r * 0.86, r * 0.74, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(pal.lit);
  g.beginPath();
  g.ellipse(x - r * 0.22, y - r * 0.32, r * 0.52, r * 0.38, -0.3, 0, TAU);
  g.fill();
  if (o.shine !== false) {
    g.fillStyle = css(pal.shine, 0.95);
    g.beginPath();
    g.ellipse(x - r * 0.3, y - r * 0.42, r * 0.2, r * 0.13, -0.4, 0, TAU);
    g.fill();
  }
  g.restore();
}

/**
 * A crystal lying in the face, seen end on: a polygon of `sides` cut into
 * facets from a point a little off its middle, alternate facets in light and
 * shade, inside its line. What a rare ore is made of.
 */
export function gem(g: Ctx, x: number, y: number, r: number, pal: Pal, R: () => number, o: { sides?: number; ang?: number; sq?: number; line?: number } = {}): void {
  const k = o.sides ?? 6;
  const ang = o.ang ?? R() * TAU;
  const sq = o.sq ?? 0.8;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pts: number[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + (R() - 0.5) * 0.35;
    const rr = r * (0.82 + R() * 0.3);
    const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
    pts.push(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
  }
  const hx = x - r * 0.12, hy = y - r * 0.14;
  g.save();
  g.beginPath();
  poly(g, pts);
  g.lineWidth = r * (o.line ?? 0.24);
  g.strokeStyle = css(pal.rim);
  g.stroke();
  g.fillStyle = css(pal.body);
  g.fill();
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
    // Light falls on the facets that face up the strip, shade on those that face down.
    const fy = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2 - y;
    const fx = (pts[i * 2] + pts[j * 2]) / 2 - x;
    const lit = -fy * 0.8 - fx * 0.35;
    g.fillStyle = lit > r * 0.25 ? css(pal.lit) : lit < -r * 0.25 ? css(pal.dark) : css(pal.body);
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(pts[i * 2], pts[i * 2 + 1]);
    g.lineTo(pts[j * 2], pts[j * 2 + 1]);
    g.closePath();
    g.fill();
  }
  // The table: a small facet of shine at the high point.
  g.fillStyle = css(pal.shine);
  g.beginPath();
  g.ellipse(hx - r * 0.05, hy - r * 0.08, r * 0.2, r * 0.14, ang, 0, TAU);
  g.fill();
  g.restore();
}

/**
 * A soft halo round a shape, out to about `reach` beyond its edge: the shape
 * filled in the light with a blurred shadow of it. `px` is the canvas's
 * pixels per unit, as a shadow's blur is in pixels whatever the transform.
 * The shape itself is filled too, so draw what goes in it afterwards. The
 * halo has to have faded to nothing inside the strip's `half`, or the band's
 * fill shows as a ruled edge.
 */
export function halo(g: Ctx, path: Path2D, c: RGB, reach: number, a: number, px: number): void {
  g.save();
  g.shadowColor = css(c, Math.min(1, a));
  g.shadowBlur = reach * px;
  g.fillStyle = css(c, Math.min(1, a));
  g.fill(path);
  g.fill(path);
  g.restore();
}

/** A soft round glow: the runes' halo. */
export function glow(g: Ctx, x: number, y: number, r: number, c: RGB, a = 0.5): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, css(c, a));
  gr.addColorStop(0.45, css(c, a * 0.45));
  gr.addColorStop(1, css(c, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * One of the island's runes, cut into the face and lit: a halo of `light`
 * under a stroke of it, and a pale core. `s` is from its middle to its top.
 */
export function rune(g: Ctx, name: string, x: number, y: number, s: number, light: RGB, core: RGB = CREAM, ang = 0): void {
  const strokes = GLYPHS[name];
  if (!strokes) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const path = new Path2D();
  for (const st of strokes) {
    st.pts.forEach(([px, py], i) => (i ? path.lineTo(px * s, py * s) : path.moveTo(px * s, py * s)));
    if (st.closed) path.closePath();
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = css(light, 0.22);
  g.lineWidth = s * 0.62;
  g.stroke(path);
  g.strokeStyle = css(light, 0.5);
  g.lineWidth = s * 0.34;
  g.stroke(path);
  g.strokeStyle = css(core, 0.95);
  g.lineWidth = s * 0.13;
  g.stroke(path);
  g.restore();
}

/** A four-pointed glint: a thin cross of light with a bright heart. */
export function sparkle(g: Ctx, x: number, y: number, r: number, c: RGB = CREAM, a = 1): void {
  g.save();
  g.fillStyle = css(c, a);
  g.beginPath();
  const t = r * 0.16;
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + t, y - t, x + r, y);
  g.quadraticCurveTo(x + t, y + t, x, y + r);
  g.quadraticCurveTo(x - t, y + t, x - r, y);
  g.quadraticCurveTo(x - t, y - t, x, y - r);
  g.fill();
  glow(g, x, y, r * 0.55, c, a * 0.7);
  g.restore();
}

/**
 * An upright crystal, for a stud: a prism standing from its foot at (x, y),
 * `w` across and `h` tall, leaning by `lean`, its point a pyramid. Lit from
 * the upper left, as the kit lights everything: the left face in the light,
 * the right in shade, the point's left facet brightest.
 */
export function prism(g: Ctx, x: number, y: number, w: number, h: number, lean: number, pal: Pal, line = 0.06): void {
  const tipH = w * 0.9;
  const dx = lean * h;
  // Corners: foot left, foot middle (the front arris), foot right; the same at the shoulder; the tip.
  const fl = [x - w / 2, y], fm = [x + w * 0.08, y + w * 0.16], fr = [x + w / 2, y];
  const sl = [fl[0] + dx, y - h], sm = [fm[0] + dx, y - h + w * 0.16], sr = [fr[0] + dx, y - h];
  const tip = [x + dx * 1.18 + w * 0.02, y - h - tipH];
  g.save();
  g.lineJoin = 'round';
  // The outline of the whole first, so each face's fill sits inside one line.
  g.beginPath();
  poly(g, [fl[0], fl[1], fm[0], fm[1], fr[0], fr[1], sr[0], sr[1], tip[0], tip[1], sl[0], sl[1]]);
  g.strokeStyle = css(pal.rim);
  g.lineWidth = line;
  g.stroke();
  g.fillStyle = css(pal.lit);
  g.beginPath();
  poly(g, [fl[0], fl[1], fm[0], fm[1], sm[0], sm[1], sl[0], sl[1]]);
  g.fill();
  g.fillStyle = css(pal.dark);
  g.beginPath();
  poly(g, [fm[0], fm[1], fr[0], fr[1], sr[0], sr[1], sm[0], sm[1]]);
  g.fill();
  g.fillStyle = css(pal.shine);
  g.beginPath();
  poly(g, [sl[0], sl[1], sm[0], sm[1], tip[0], tip[1]]);
  g.fill();
  g.fillStyle = css(pal.body);
  g.beginPath();
  poly(g, [sm[0], sm[1], sr[0], sr[1], tip[0], tip[1]]);
  g.fill();
  // A gleam up the front arris.
  g.strokeStyle = css(pal.shine, 0.8);
  g.lineWidth = line * 0.8;
  g.beginPath();
  g.moveTo(fm[0] + (sm[0] - fm[0]) * 0.15, fm[1] + (sm[1] - fm[1]) * 0.15);
  g.lineTo(fm[0] + (sm[0] - fm[0]) * 0.8, fm[1] + (sm[1] - fm[1]) * 0.8);
  g.stroke();
  g.restore();
}

/** An upright nugget for a stud: a lump sitting on its foot at (x, y), lit from above. */
export function boss(g: Ctx, x: number, y: number, r: number, pal: Pal, R: () => number, line = 0.06): void {
  const p = new Path2D();
  lump(p, x, y - r * 0.62, r, R, 8, 0.24, 0.72, 0);
  g.save();
  g.lineWidth = line;
  g.strokeStyle = css(pal.rim);
  g.stroke(p);
  g.fillStyle = css(pal.dark);
  g.fill(p);
  g.clip(p);
  g.fillStyle = css(pal.body);
  g.beginPath();
  g.ellipse(x - r * 0.1, y - r * 0.8, r * 0.9, r * 0.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(pal.lit);
  g.beginPath();
  g.ellipse(x - r * 0.25, y - r * 0.98, r * 0.55, r * 0.32, -0.2, 0, TAU);
  g.fill();
  g.fillStyle = css(pal.shine);
  g.beginPath();
  g.ellipse(x - r * 0.35, y - r * 1.05, r * 0.2, r * 0.11, -0.3, 0, TAU);
  g.fill();
  g.restore();
}

/** A small shadow on the ground under a stud, so it stands on the face and does not float over it. */
export function footShadow(g: Ctx, x: number, y: number, rx: number, a = 0.3): void {
  g.save();
  g.fillStyle = css(INK, a);
  g.beginPath();
  g.ellipse(x, y, rx, rx * 0.42, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** Scatter along a strip: `n` points spread evenly along 0..L with a jitter, each with a place across within `across`. */
export function along(R: () => number, L: number, n: number, across: number, jitter = 0.7): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) out.push([((i + 0.5 + (R() - 0.5) * jitter) / n) * L, (R() - 0.5) * 2 * across]);
  return out;
}

/** A generator off one number, so a piece painted twice (at both ends of a strip) comes out the same both times. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * A lode of a rare ore, the way all four of them are drawn: a halo of its
 * light along the band, a dark bed, crystals of it end-on crowded along the
 * bed with a glow round the best, and every so often one of the island's
 * runes cut into the stone beside it and lit. Returns where along it the
 * clusters that stand up off the face (studs) belong.
 */
export function lode(g: Ctx, R: () => number, L: number, px: number, o: {
  bed: Pal;
  ore: Pal;
  light: RGB;
  glyph: string;
  /** Half-width of the bed, in tiles. */
  width?: number;
  /** How strong the light round the band is, nought to one. */
  halo?: number;
  /** One crystal in this many stands up off the face as a stud. */
  every?: number;
  sides?: number;
  /** How elongated a crystal is across the band: 1 is round. */
  sq?: number;
  /** Kinds of stud picture. */
  kinds?: number;
  /** Paint a crystal; `gem` by default. */
  crystal?: (x: number, y: number, r: number, rr: () => number) => void;
}): Array<{ t: number; n: number; kind: number }> {
  const width = o.width ?? 0.11;
  const mid = periodic(R, L, 0.07, [[1, 0.6], [2, 0.3], [4, 0.12]]);
  const wob = periodic(R, L, 0.035, [[2, 0.6], [3, 0.3], [6, 0.12]]);
  const w = (t: number): number => width + wob(t);
  const body = ribbon(L, mid, w);
  const line = Math.max(1.2 / px, 0.013);
  halo(g, body, o.light, 0.17, o.halo ?? 0.6, px);
  channel(g, body, 0.03, 0.3);
  g.fillStyle = css(o.bed.dark);
  g.fill(body);
  g.strokeStyle = css(o.bed.rim);
  g.lineWidth = line;
  g.stroke(body);
  const studs: Array<{ t: number; n: number; kind: number }> = [];
  const every = o.every ?? 9;
  // The rune: one a strip, in a gap between crystals, beside the bed.
  const runeAt = R() * L;
  const runeSide = R() < 0.5 ? -1 : 1;
  const near = (t: number): boolean => Math.abs(t - runeAt) < 0.2 || Math.abs(t - runeAt - L) < 0.2 || Math.abs(t - runeAt + L) < 0.2;
  // The crust: crystals packed end to end along the bed in two rows, the
  // later over the earlier, so the bed shows only between them.
  const crust: Array<{ t: number; dy: number; r: number; s: number; lit: boolean }> = [];
  let t = R() * 0.1;
  let i = 0;
  while (t < L - 0.04) {
    const ww = Math.max(0.04, w(t));
    const r = Math.min(0.13, 0.06 + ww * 0.45) * (0.7 + R() * 0.45);
    if (!near(t)) {
      const lit = i % every === 0;
      crust.push({ t, dy: (R() - 0.5) * ww * 0.9, r, s: R() * 1e9, lit });
      if (lit) studs.push({ t, n: 0, kind: Math.floor(R() * (o.kinds ?? 3)) });
      i++;
    }
    t += r * (1.05 + R() * 0.5);
  }
  for (const c of crust) if (c.lit) wrap(L, c.t, 0.3, (x) => glow(g, x, mid(x), 0.26, o.light, 0.5));
  for (const c of crust) {
    wrap(L, c.t, c.r * 1.5, (x) => {
      const y = mid(x) + c.dy;
      const rr = seeded(c.s);
      if (o.crystal) o.crystal(x, y, c.r, rr);
      else gem(g, x, y, c.r, o.ore, rr, { sides: o.sides ?? 6, sq: o.sq ?? 0.75, ang: (rr() - 0.5) * 0.8 });
    });
  }
  wrap(L, runeAt, 0.2, (x) => {
    const y = mid(x) + runeSide * (w(x) + 0.07);
    glow(g, x, y, 0.13, o.light, 0.4);
    rune(g, o.glyph, x, y, 0.065, o.light, CREAM, runeSide * 0.15);
  });
  return studs;
}

/**
 * An upright cluster of crystals for a stud, its foot at (0, 0): two to four
 * prisms leaning out of a common root, the tallest in the middle, with a halo
 * of the ore's light behind them.
 */
export function cluster(g: Ctx, R: () => number, ore: Pal, light: RGB, o: { n?: number; h?: number; w?: number; line?: number } = {}): void {
  const n = o.n ?? 3;
  const h = o.h ?? 0.24;
  const w = o.w ?? 0.1;
  g.save();
  g.translate(0, -h * 0.45);
  g.scale(1, 0.8);
  glow(g, 0, 0, h * 1.15, light, 0.26);
  g.restore();
  footShadow(g, 0, 0, w * 1.6, 0.32);
  // The side ones first, so the middle one stands in front of them.
  const order = n === 2 ? [0, 1] : n === 3 ? [0, 2, 1] : [0, 3, 1, 2];
  for (const i of order) {
    const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const tall = h * (1 - Math.abs(f) * 0.4) * (0.85 + R() * 0.3);
    prism(g, f * w * 0.75, Math.abs(f) * w * 0.1, w * (1 - Math.abs(f) * 0.3), tall, f * 0.38 + (R() - 0.5) * 0.08, ore, o.line ?? 0.022);
  }
}
