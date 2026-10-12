import { frameCrystals } from '../runecut-frames';
import { clamp01, ease, lerp, rnd, underNight, type Ctx, type LifePiece } from './kit';

/** Snowflakes drifting down past the sides of each window in winter. */
export const FLAKES = 6;

/** Flakes, besides `FLAKES`, that fall from above the window and settle on its cap. */
const SETTLE = 2;

/** The snow's colours: its lit crest, its body, the blue under the lip, the ice, its outline, and white for flakes and glints (as "r, g, b"). */
interface Pal {
  top: string;
  mid: string;
  shade: string;
  ice: string;
  ink: string;
  white: string;
}

/** "r, g, b" of a `#rrggbb` colour. */
const rgbOf = (hex: string): string => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

/** After dark: under the night wash as the animals are, then 30% of the way back to white, as moonlit snow. */
function moonlit(hex: string): string {
  const n = rgbOf(underNight(hex)).split(', ').map(Number);
  return '#' + n.map((v) => Math.round(v + (255 - v) * 0.3).toString(16).padStart(2, '0')).join('');
}

function palette(night: boolean): Pal {
  const c = night ? moonlit : (hex: string): string => hex;
  return {
    top: c('#ffffff'),
    mid: c('#e9f0fa'),
    shade: c('#afc1de'),
    ice: `rgba(${rgbOf(c('#d4e6fa'))}, 0.95)`,
    ink: `rgba(${rgbOf(night ? underNight('#465a84') : '#465a84')}, 0.6)`,
    white: rgbOf(c('#ffffff')),
  };
}

const DAY = palette(false);
const NIGHT = palette(true);

/**
 * A stretch of a frame's top that snow lies on: from x `a` to `b`, its
 * surface at y, or at y plus `bow(x)` where the surface curves.
 */
interface Run {
  a: number;
  b: number;
  y: number;
  bow?: (x: number) => number;
}

/** The runs left of [a, b] at y once the stretches in `cut` (each [from, to]) are taken out. */
function between(a: number, b: number, y: number, cut: Array<[number, number]>): Run[] {
  const out: Run[] = [];
  let x = a;
  for (const [c, d] of cut.sort((p, q) => p[0] - q[0])) {
    if (c - x > 12) out.push({ a: x, b: c, y });
    x = Math.max(x, d);
  }
  if (b - x > 12) out.push({ a: x, b, y });
  return out;
}

/**
 * Where snow lies on each frame's top, from the geometry its painter draws in
 * `runecut-frames.ts`: along the top edge, clear of what stands up out of it
 * (gems, cards, a crest), and on the tops of what stands higher (capitals,
 * merlons, a plaque, a book's spine, a rolled map). Any frame not named here,
 * and the plain stone rim, take the edge between any crystals set in it.
 */
const TOPS: Partial<Record<string, (w: number, F: number) => Run[]>> = {
  stall: (w, F) => [{ a: F * 0.95, b: w - F * 0.95, y: -F * 0.45 }],
  scroll: (w, F) => {
    // The crest's arch, about as its painter's curve: half as wide as 3.1 bands, 1.25 bands high, its feet 0.55 down.
    const A = F * 3.1, top = F * 1.25, foot = F * 0.55, cx = w / 2;
    const bow = (x: number): number => foot - (top + foot) * Math.sqrt(Math.max(0, 1 - ((x - cx) / A) ** 2));
    return [
      { a: -F * 0.27, b: F * 1.15, y: -F * 0.56 },
      { a: w - F * 1.15, b: w + F * 0.27, y: -F * 0.56 },
      { a: cx - A * 0.8, b: cx - A * 0.4, y: 0, bow },
      { a: cx + A * 0.4, b: cx + A * 0.8, y: 0, bow },
      ...between(F * 1.2, w - F * 1.2, 0, [[cx - A, cx + A]]),
    ];
  },
  runestone: (w, F) => [
    { a: -7.5, b: F * 0.7 + 5.5, y: -8 },
    { a: w - F * 0.7 - 5.5, b: w + 7.5, y: -8 },
    ...between(F * 0.7 + 6, w - F * 0.7 - 6, -1.5, [[w / 2 - F * 0.5, w / 2 + F * 0.5]]),
  ],
  palisade: (w, F) => {
    const mw = F * 0.72, gap = F * 0.48, n = Math.floor((w - F * 2.2 + gap) / (mw + gap)), x0 = (w - (n * (mw + gap) - gap)) / 2;
    const out: Run[] = [{ a: w / 2 - F * 0.8, b: w / 2 + F * 0.8, y: -F * 0.95 }];
    for (let k = 0; k < n; k++) {
      const x = x0 + k * (mw + gap);
      if (Math.abs(x + mw / 2 - w / 2) >= F * 1.75) out.push({ a: x + 0.5, b: x + mw - 0.5, y: -F * 0.78 });
    }
    return out;
  },
  letter: (w, F) => between(F * 0.6, w - F * 0.6, -2, w > F * 10 ? [[w - F * 6.4, w - F * 2.2]] : []),
  book: (w, F) => [{ a: -F * 0.62, b: F * 0.82, y: -F * 0.28 }, { a: F * 0.95, b: w - F * 0.8, y: 0 }],
  treasure: (w, F) => [{ a: -9, b: F * 2.6 - 2, y: F * 0.24 - F * 0.33 + 0.5 }, { a: F * 2.6 + 2, b: w - 4, y: 1 }],
  toolbelt: (w, F) => {
    // Over its marble arches (as `marbleArch` draws them: 0.62 of a bay wide, 0.8 of a band high), between their crystals.
    const n = Math.max(2, Math.round(w / 110)), step = w / n, half = step * 0.31, ht = F * 0.8;
    const bow = (x: number): number => {
      const s = 1 - Math.abs(((x % step) + step) % step - step / 2) / half;
      return s <= 0 ? 0 : Math.min(0, F * 0.5 - (F * 0.5 + ht) * (1 - (1 - s) ** 2.4));
    };
    const gems = Array.from({ length: n }, (_, k): [number, number] => [step * (k + 0.5) - F * 0.6, step * (k + 0.5) + F * 0.6]);
    return between(3, w - 3, 0, gems).map((r) => ({ ...r, bow }));
  },
  parchment: (w, F) => [{ a: 3, b: w - F * 1.5, y: 0 }],
  altar: (w, F) => between(3, w - 3, 0, [[w / 2 - F * 0.5, w / 2 + F * 0.5]]),
  ironbound: (w, F) => between(3, w - 3, 0, [[w / 2 - F * 0.8, w / 2 + F * 0.8]]),
};

/** A smooth bump in 0..1 along x, knots `s` apart, the same for the same seed. */
function lumpy(x: number, s: number, seed: number): number {
  const k = Math.floor(x / s), f = x / s - k, e = f * f * (3 - 2 * f);
  return lerp(rnd(seed, k), rnd(seed, k + 1), e);
}

/** 0 to 1 as x comes `e` in from either end of [a, b], round like a pillow's end. */
function rounded(x: number, a: number, b: number, e: number): number {
  const d = Math.min(x - a, b - x);
  return d >= e ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d / e) ** 2));
}

/**
 * One run of the cap as drawn: its run, its thickness and lip, how far the
 * clump at either end has crept out past it (`ea`, `eb`), and its lumps' seed.
 */
interface Cap {
  r: Run;
  H: number;
  L: number;
  ea: number;
  eb: number;
  seed: number;
}

/** How thick the cap stands at x: lumps, a clump at either end, rounded off at both. */
function height(c: Cap, x: number): number {
  const a = c.r.a - c.ea, b = c.r.b + c.eb, H = c.H;
  let k = 0.32 + 0.62 * lumpy(x, 24, c.seed) ** 1.3 + 0.2 * lumpy(x, 8, c.seed + 7);
  if (c.ea > 0) k += (c.ea / H) * 0.5 * Math.max(0, 1 - Math.abs(x - a) / (H * 2.4));
  if (c.eb > 0) k += (c.eb / H) * 0.5 * Math.max(0, 1 - Math.abs(x - b) / (H * 2.4));
  return H * k * rounded(x, a, b, Math.min(H * 1.6, (b - a) / 2));
}

/** How far the cap's lip hangs over the frame's face at x. */
function lip(c: Cap, x: number): number {
  const a = c.r.a - c.ea, b = c.r.b + c.eb;
  return c.L * (0.4 + 0.8 * lumpy(x, 9, c.seed + 3)) * rounded(x, a, b, Math.min(c.L * 3, (b - a) / 2));
}

/** Where the cap rests at x: its run's surface, curling down where a clump has crept out past the end. */
function base(c: Cap, x: number): number {
  const d = Math.max(0, c.r.a - x, x - c.r.b);
  return c.r.y + (c.r.bow ? c.r.bow(x) : 0) + (0.3 * d * d) / c.H;
}

/** The cap's outline, worked out once a frame: x along it every few px, its top and its lip at each. */
interface Shape {
  xs: number[];
  top: number[];
  lip: number[];
}

function shape(c: Cap, lo = -Infinity, hi = Infinity): Shape {
  const a = Math.max(lo, c.r.a - c.ea), b = Math.min(hi, c.r.b + c.eb), n = Math.max(4, Math.ceil((b - a) / 3.5));
  const out: Shape = { xs: [], top: [], lip: [] };
  for (let i = 0; i <= n; i++) {
    const x = lerp(a, b, i / n), y = base(c, x);
    out.xs.push(x);
    out.top.push(y - height(c, x));
    out.lip.push(y + lip(c, x));
  }
  return out;
}

/**
 * Trace a run of the cap, `dy` lower than it lies: its top, then back along a
 * lower edge `trim` px above the lip, or, with `share` under 1, only that
 * share of the way down from the top; closed, or `open` at its first end (for
 * outlining a piece of it cut from the rest).
 */
function trace(g: Ctx, s: Shape, dy: number, trim = 0, share = 1, open = false): void {
  const n = s.xs.length - 1;
  g.moveTo(s.xs[0], (open ? s.top[0] : (s.top[0] + s.lip[0]) / 2) + dy);
  for (let i = 1; i <= n; i++) g.lineTo(s.xs[i], s.top[i] + dy);
  for (let i = n - 1; i >= (open ? 0 : 1); i--) g.lineTo(s.xs[i], s.top[i] + dy + Math.max(0, s.lip[i] - s.top[i] - trim) * share);
  if (!open) g.closePath();
}

/** The cap's runs filled in their tones, blue under the lip, the body, the lit crest, and outlined; with its shadow on the frame unless `cut`. */
function paintCap(g: Ctx, shapes: Shape[], L: number, pal: Pal, cut: boolean): void {
  if (!cut) {
    g.fillStyle = 'rgba(36, 50, 92, 0.22)';
    g.beginPath();
    for (const s of shapes) trace(g, s, 1.4);
    g.fill();
  }
  g.fillStyle = pal.shade;
  g.beginPath();
  for (const s of shapes) trace(g, s, 0);
  g.fill();
  g.fillStyle = pal.mid;
  g.beginPath();
  for (const s of shapes) trace(g, s, 0, L * 0.5 + 1);
  g.fill();
  g.fillStyle = pal.top;
  g.beginPath();
  for (const s of shapes) trace(g, s, 0, L + 1, 0.45);
  g.fill();
  g.strokeStyle = pal.ink;
  g.lineWidth = 0.8;
  g.beginPath();
  for (const s of shapes) trace(g, s, 0, 0, 1, cut);
  g.stroke();
}

/** Add a six-armed flake at (x, y) to the path, as three crossed bars `wd` thick: `r` along each arm, turned `a`, squashed across by `sx` as it tumbles. */
function crystal(g: Ctx, x: number, y: number, r: number, a: number, sx: number, wd: number): void {
  for (let i = 0; i < 3; i++) {
    const c = Math.cos(a + (i * Math.PI) / 3) * r * sx, s = Math.sin(a + (i * Math.PI) / 3) * r;
    const l = Math.hypot(c, s) || 1, nx = (-s / l) * wd * 0.5, ny = (c / l) * wd * 0.5;
    g.moveTo(x - c - nx, y - s - ny);
    g.lineTo(x + c - nx, y + s - ny);
    g.lineTo(x + c + nx, y + s + ny);
    g.lineTo(x - c + nx, y - s + ny);
    g.closePath();
  }
}

/** A four-pointed glint at (x, y), `r` long, `a` strong. */
function glint(g: Ctx, x: number, y: number, r: number, a: number, white: string): void {
  if (a <= 0.02) return;
  g.fillStyle = `rgba(${white}, ${a})`;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r * 0.7, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/** Icicles, each [x, y, len] hanging from (x, y): pale ice, outlined, a lit streak down the left of each. */
function icicles(g: Ctx, all: Array<[number, number, number]>, pal: Pal): void {
  g.fillStyle = pal.ice;
  g.strokeStyle = pal.ink;
  g.lineWidth = 0.6;
  g.beginPath();
  for (const [x, y, len] of all) {
    const wd = 0.8 + len * 0.13;
    g.moveTo(x - wd, y);
    g.quadraticCurveTo(x - wd * 0.35, y + len * 0.55, x, y + len);
    g.quadraticCurveTo(x + wd * 0.35, y + len * 0.55, x + wd, y);
    g.closePath();
  }
  g.fill();
  g.stroke();
  g.strokeStyle = `rgba(${pal.white}, 0.9)`;
  g.beginPath();
  for (const [x, y, len] of all) {
    const wd = 0.8 + len * 0.13;
    g.moveTo(x - wd * 0.35, y + 0.6);
    g.lineTo(x - wd * 0.08, y + len * 0.6);
  }
  g.stroke();
}

/** Circles at the given [x, y, r], filled as one shape so they do not darken where they overlap. */
function blobs(g: Ctx, parts: Array<[number, number, number]>, grow: number, dy: number): void {
  g.beginPath();
  for (const [x, y, r] of parts) {
    g.moveTo(x + r + grow, y + dy);
    g.arc(x, y + dy, r + grow, 0, Math.PI * 2);
  }
  g.fill();
}

/** A clump of snow, three lumps of it about (x, y), `H` across: outlined, blue underneath, lit on top. */
function clump(g: Ctx, x: number, y: number, H: number, pal: Pal): void {
  const parts: Array<[number, number, number]> = [[x, y, H * 0.62], [x + H * 0.55, y + H * 0.18, H * 0.45], [x - H * 0.5, y + H * 0.2, H * 0.42]];
  g.fillStyle = pal.ink;
  blobs(g, parts, 0.8, 0);
  g.fillStyle = pal.shade;
  blobs(g, parts, 0, 0);
  g.fillStyle = pal.mid;
  blobs(g, parts, -H * 0.12, -H * 0.14);
  g.fillStyle = pal.top;
  blobs(g, parts, -H * 0.3, -H * 0.24);
}

/** The clump-and-fall cycle at a corner, in seconds, and the share of cycles that have one. */
const SLIP = 10;
const SLIP_ODDS = 0.45;

/** What never moves on a window's snow: its runs, the cap and icicles painted once, and where the drops form. */
interface Still extends Plate {
  caps: Cap[];
  /** Each icicle a drop can form on: [x, its tip's y, room below it, its index]. */
  drips: Array<[number, number, number, number]>;
  /** A corner's growing clump at each quarter px it creeps out, painted as it is first needed. */
  ends: Map<string, Plate>;
}

/** A piece of snow painted once: its canvas, and the box it is laid in. */
interface Plate {
  img: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Paint `shapes` into a canvas of their own at `k` device px to the px: as a whole cap, or as an end `cut` from one. */
function plate(shapes: Shape[], L: number, pal: Pal, k: number, cut: boolean, ice: Array<[number, number, number]> = []): Plate {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of shapes) {
    for (const x of s.xs) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x));
    for (const y of s.top) y0 = Math.min(y0, y);
    for (const y of s.lip) y1 = Math.max(y1, y);
  }
  for (const [, y, len] of ice) y1 = Math.max(y1, y + len);
  if (!(x1 > x0 && y1 > y0)) x0 = x1 = y0 = y1 = 0;
  // Room for the outline and the shadow.
  x0 = Math.floor(x0 - 3);
  y0 = Math.floor(y0 - 3);
  const w = Math.max(1, Math.ceil(x1 + 3 - x0)), h = Math.max(1, Math.ceil(y1 + 4 - y0));
  const { cv, g } = canvas(w, h, k);
  if (g) {
    g.translate(-x0, -y0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    paintCap(g, shapes, L, pal, cut);
    icicles(g, ice, pal);
  }
  return { img: cv, x: x0, y: y0, w: Math.ceil(w * k) / k, h: Math.ceil(h * k) / k };
}

/** A cache, not animation state: each window's still snow, painted once and kept for the 24 most recently drawn. */
const STILL = new Map<string, Still>();

/** A canvas `w` × `h` CSS px drawn at `k` device px to the px, an OffscreenCanvas where there is one. */
function canvas(w: number, h: number, k: number): { cv: OffscreenCanvas | HTMLCanvasElement; g: Ctx | null } {
  const W = Math.ceil(w * k), H = Math.ceil(h * k);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = cv.getContext('2d') as Ctx | null;
  g?.setTransform(k, 0, 0, k, 0, 0);
  return { cv, g };
}

/** A cache, not animation state: the flake, crystal and glint sprites, one sheet for each light and pixel ratio. */
const SHEETS = new Map<string, CanvasImageSource>();

/**
 * The sprites the moving snow is drawn from, side by side in 12-px cells
 * with room round each: a flake (radius 3), a crystal (arms 4 long) and a
 * glint (points 4 long), and a plain flake for those resting on the snow; the flake and crystal edged in faint blue so they
 * show on a pale frame as well as the dark.
 */
function sheetOf(pal: Pal, k: number): CanvasImageSource {
  const key = `${pal.top}|${k}`;
  const got = SHEETS.get(key);
  if (got) return got;
  const { cv, g } = canvas(48, 12, k);
  if (g) {
    g.fillStyle = 'rgba(70, 90, 132, 0.28)';
    g.beginPath();
    g.arc(6, 6.3, 3.5, 0, Math.PI * 2);
    crystal(g, 18, 6, 3.9, 0, 1, 2);
    g.fill();
    g.fillStyle = pal.top;
    g.beginPath();
    g.arc(6, 6, 3, 0, Math.PI * 2);
    g.moveTo(45, 6);
    g.arc(42, 6, 3, 0, Math.PI * 2);
    crystal(g, 18, 6, 3.5, 0, 1, 0.9);
    g.moveTo(19, 6);
    g.arc(18, 6, 1, 0, Math.PI * 2);
    g.fill();
    glint(g, 30, 6, 4, 1, pal.white);
  }
  SHEETS.set(key, cv);
  return cv;
}

/** One of the sheet's sprites (`cell` 0 flake, 1 crystal, 2 glint, 3 plain flake) at (x, y), `r` across, turned `a`, squashed across by `sx`, `alpha` strong. */
function sprite(g: Ctx, sheet: CanvasImageSource, k: number, cell: number, x: number, y: number, r: number, alpha = 1, a = 0, sx = 1): void {
  const s = r / (cell === 0 || cell === 3 ? 3 : 4);
  if (a === 0 && sx === 1) {
    g.globalAlpha = alpha;
    g.drawImage(sheet, cell * 12 * k, 0, 12 * k, 12 * k, x - 6 * s, y - 6 * s, 12 * s, 12 * s);
    g.globalAlpha = 1;
    return;
  }
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(sx, 1);
  g.rotate(a);
  g.drawImage(sheet, cell * 12 * k, 0, 12 * k, 12 * k, -6 * s, -6 * s, 12 * s, 12 * s);
  g.restore();
}

/** A window's runs of snow: along its top, clear of crystals and ornaments, from `TOPS`. */
function capsOf(p: LifePiece, sd: number): Cap[] {
  const H = Math.min(8.5, Math.max(4.5, 3.5 + p.F * 0.16));
  const L = Math.min(2.6, Math.max(1.2, p.F * 0.1));
  // Clear of any crystal set in the top (the status panel's, the toolbar's).
  const gems = frameCrystals(p.kind, p.w, p.h, p.F).filter((q) => q.y < p.F).map((q): [number, number] => [q.x - q.r * 0.8, q.x + q.r * 0.8]);
  const rs = TOPS[p.kind]?.(p.w, p.F) ?? between(3, p.w - 3, 0, gems);
  return rs.map((r, i) => ({ r, H: Math.min(H, (r.b - r.a) * 0.3), L, ea: 0, eb: 0, seed: sd + i * 31 }));
}

/** Paint a window's still snow (its cap and icicles) at `k` device px to the px, into a canvas of its own. */
function still(p: LifePiece, sd: number, pal: Pal, k: number): Still {
  const caps = capsOf(p, sd);
  const shapes = caps.map((c) => shape(c));
  // Icicles under the lip where it hangs over the band, a few to a run, some with a little one beside.
  const ice: Array<[number, number, number]> = [];
  const drips: Array<[number, number, number, number]> = [];
  caps.forEach((c, ci) => {
    const room = p.F - c.r.y - c.L - 2;
    const n = Math.min(8, Math.floor((c.r.b - c.r.a) / 40));
    for (let i = 0; i < n; i++) {
      const x = lerp(c.r.a, c.r.b, (i + 0.2 + rnd(c.seed, i) * 0.6) / n);
      const len = Math.min(room, Math.max(2.5, p.F * 0.3) * (0.35 + 0.75 * rnd(c.seed, i + 9)));
      if (len < 2 || x < 2 || x > p.w - 2 || c.r.bow?.(x)) continue;
      const ly = base(c, x) + lip(c, x) - 0.5;
      ice.push([x, ly, len]);
      if (rnd(c.seed, i + 12) < 0.5) {
        const x2 = x + (rnd(c.seed, i + 13) < 0.5 ? -1 : 1) * (2.5 + len * 0.25);
        ice.push([x2, base(c, x2) + lip(c, x2) - 0.5, Math.max(1.6, len * 0.45)]);
      }
      if (room - len >= 3) drips.push([x, ly + len, room - len, c.seed * 13 + i + ci]);
    }
  });
  return { caps, drips, ends: new Map(), ...plate(shapes, caps[0]?.L ?? 2, pal, k, false, ice) };
}

/**
 * Snow in the island's winter: a lumpy cap along each window's top, its lip
 * over the frame's face with icicles under it, glints on its crest; flakes
 * drifting down past the sides and a couple settling on the cap; and now and
 * then a clump grows at a corner, creeps out over it, trembles, tips and
 * falls away, crumbling into a puff. After dark in the night's light, a
 * little brighter than the frame, as moonlit snow.
 */
export function snow(g: Ctx, p: LifePiece, t: number, night = false): void {
  const sd = p.seed % 1000, pal = night ? NIGHT : DAY;
  const m = g.getTransform(), dpr = Math.round(Math.hypot(m.a, m.b) * 100) / 100 || 1;
  const key = `${p.kind}|${p.w}|${p.h}|${p.F}|${p.R}|${p.seed}|${night}|${dpr}`;
  let st = STILL.get(key);
  if (st) STILL.delete(key);
  else st = still(p, sd, pal, dpr);
  STILL.set(key, st);
  if (STILL.size > 24) STILL.delete(STILL.keys().next().value as string);
  const caps = st.caps.map((c) => ({ ...c, ea: 0, eb: 0 }));
  const sheet = sheetOf(pal, dpr);

  // A clump at each end of the cap that reaches a corner of the window: where it is in its cycle.
  const slips: Array<{ c: Cap; dir: number; u: number; k: number }> = [];
  for (const dir of [-1, 1]) {
    const c = caps.find((q) => (dir < 0 ? q.r.a <= 6 : q.r.b >= p.w - 6) && !q.r.bow?.(dir < 0 ? q.r.a : q.r.b));
    if (!c) continue;
    const tt = t + rnd(sd, dir + 40) * SLIP, kk = Math.floor(tt / SLIP), u = tt / SLIP - kk;
    if (rnd(sd + kk, dir + 41) > SLIP_ODDS) continue;
    // Grows and creeps out over the corner, trembles a moment, then breaks away.
    const E = c.H * 1.1, sh = clamp01((u - 0.62) / 0.12);
    const ex = u < 0.62 ? E * ease(u / 0.62) : u < 0.74 ? E + sh * 0.8 + Math.sin(u * 350) * 0.3 * sh : 0;
    if (dir < 0) c.ea = ex;
    else c.eb = ex;
    slips.push({ c, dir, u, k: kk });
  }

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.drawImage(st.img, st.x, st.y, st.w, st.h);
  // Where a clump is growing, its end of the cap laid over the still one, cut where the two are the same.
  for (const { c, dir } of slips) {
    const q = Math.round((dir < 0 ? c.ea : c.eb) * 4) / 4, key = `${dir}|${caps.indexOf(c)}|${q}`;
    if (q <= 0) continue;
    let end = st.ends.get(key);
    if (!end) {
      // Traced from the cut, so its outline leaves the cut open.
      const e: Cap = dir < 0 ? { ...c, ea: q } : { ...c, eb: q };
      const s = dir > 0 ? shape(e, c.r.b - c.H * 3, Infinity) : shape(e, -Infinity, c.r.a + c.H * 3);
      if (dir < 0) [s.xs, s.top, s.lip].forEach((a) => a.reverse());
      end = plate([s], c.L, pal, dpr, true);
      st.ends.set(key, end);
    }
    g.drawImage(end.img, end.x, end.y, end.w, end.h);
  }

  // Flakes and drops, gathered so all are drawn at once: dots [x, y, r], crystals [x, y, r, turn, squash], and flakes settling on the cap.
  const dots: Array<[number, number, number]> = [];
  const stars: Array<[number, number, number, number, number]> = [];
  const rest: Array<[number, number, number]> = [];
  // A drop gathers at an icicle's tip now and then, swells, then falls, shrinking away before it reaches the window's content.
  for (const [x, y, room, i] of st.drips) {
    const C = 6 + rnd(i, 20) * 5, tt = t + rnd(i, 21) * C, kk = Math.floor(tt / C), u = tt / C - kk;
    if (rnd(i + kk, 22) > 0.4) continue;
    const fall = u < 0.85 ? 0 : (u - 0.85) * C, dy = fall * fall * 70;
    const dr = (0.35 + 0.5 * ease(Math.min(1, u / 0.85))) * (1 - clamp01(dy / room));
    if (dr > 0.1) dots.push([x, y + dr * 0.6 + dy, dr * 0.85]);
  }

  // Glints winking along the crest.
  for (const c of caps) {
    const n = Math.ceil((c.r.b - c.r.a) / 70);
    for (let i = 0; i < n; i++) {
      const C = 2.6 + rnd(c.seed, i + 60) * 2, tt = t + rnd(c.seed, i + 61) * C, k = Math.floor(tt / C), u = tt / C - k;
      const x = lerp(c.r.a + 4, c.r.b - 4, rnd(c.seed + k, i + 62));
      const f = u < 0.16 ? Math.sin((u / 0.16) * Math.PI) : 0;
      if (f > 0.02) sprite(g, sheet, dpr, 2, x, base(c, x) - height(c, x) + 1.3, 1.2 + f * 1.5, f);
    }
  }

  // The clumps once they break away: tipping over the corner, dropping and spinning, crumbling into a puff.
  for (const { c, dir, u, k } of slips) {
    if (u < 0.74) continue;
    const E = c.H * 1.1 + 0.8, end = dir < 0 ? c.r.a : c.r.b;
    const tip = clamp01((u - 0.74) / 0.03), fall = Math.max(0, (u - 0.77) * SLIP);
    // It turns about the corner it hung over, then drops, spinning on, and crumbles a quarter second into the drop.
    const px = end + dir * 1.5, py = c.r.y + c.L, ox = E * 0.1, oy = -c.H * 0.5, s0 = 0.85, vx = 10 + p.R * 1.2;
    const at = (f: number, q: number): [number, number, number] => {
      const x = px + dir * (q * q * 1.5 + f * vx), y = py + q * q * 1.2 + 80 * f * f, rot = dir * (q * q * 0.8 + f * 2.4);
      return [x + dir * (ox * Math.cos(rot) - oy * Math.sin(rot)) * s0, y + (ox * Math.sin(rot) + oy * Math.cos(rot)) * s0, rot];
    };
    const crumble = clamp01((fall - 0.25) / 0.35);
    if (crumble < 1) {
      const [x, y, rot] = at(fall, tip), k2 = s0 * (1 - crumble);
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(dir * k2, k2);
      clump(g, 0, 0, c.H, pal);
      g.restore();
    }
    if (fall > 0.25) {
      // Where it crumbles: soft puffs spreading and drifting, and crumbs falling on from it.
      const v = fall - 0.25, [x0, y0] = at(0.25, 1);
      const puff: Array<[number, number, number]> = [];
      for (let i = 0; i < 4; i++) {
        const dx = (rnd(sd + k, i + 53) - 0.4) * c.H * 1.2 * dir, dy = (rnd(sd + k, i + 54) - 0.5) * c.H;
        puff.push([x0 + dx * (1 + v * 2.5) + dir * v * vx * 0.5, y0 + dy * (1 + v) + v * 14, c.H * (0.3 + v * 0.9)]);
      }
      g.fillStyle = `rgba(${pal.white}, ${0.42 * clamp01(1 - v / 0.6) * Math.min(1, v * 10)})`;
      blobs(g, puff, 0, 0);
      g.fillStyle = `rgba(${pal.white}, ${0.95 * clamp01(1 - v / 0.9)})`;
      g.beginPath();
      for (let i = 0; i < 7; i++) {
        const sx = (vx + (rnd(sd + k, i + 50) - 0.4) * 22) * dir, vy = 40 + (rnd(sd + k, i + 51) - 0.6) * 30;
        const x = x0 + (rnd(sd + k, i + 55) - 0.5) * c.H + sx * v, y = y0 + (rnd(sd + k, i + 56) - 0.5) * c.H * 0.8 + vy * v + 70 * v * v;
        const r = (0.6 + rnd(sd + k, i + 52) * 0.9) * (1 - v * 0.4);
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, Math.PI * 2);
      }
      g.fill();
    }
  }

  // Drifting down past the sides, swaying; growing in at the top and shrinking out at the foot.
  for (let i = 0; i < FLAKES; i++) {
    const v = 9 + rnd(sd, i + 20) * 7, span = p.h + 60, C = span / v;
    const tt = t + rnd(sd, i) * C, k = Math.floor(tt / C), u = tt / C - k;
    const side = rnd(sd + k, i + 1) < 0.5;
    const d = lerp(-p.F * 0.35, p.R + 7, rnd(sd + k, i + 2));
    const sw = 2 + rnd(sd + k, i + 3) * 3, ph = rnd(sd + k, i + 4) * 6.28, om = 1.2 + rnd(sd + k, i + 5) * 0.9;
    const x = (side ? -d : p.w + d) + Math.sin(tt * om + ph) * sw, y = -30 + u * span;
    const a = Math.min(1, u * 12, (1 - u) * 12);
    const r = (1 + rnd(sd + k, i + 6) ** 1.5 * 2) * a;
    if (r < 0.2) continue;
    if (rnd(sd + k, i + 7) < 0.5) {
      // A crystal, tumbling (turning, and squashed across as it tips), catching the light now and then.
      stars.push([x, y, r * 1.3, tt * 0.8 + ph, 0.55 + 0.45 * Math.abs(Math.cos(tt * 1.1 + ph))]);
      const spark = Math.max(0, Math.sin(tt * 2.1 + ph * 3)) ** 12 * a;
      if (spark > 0.06) sprite(g, sheet, dpr, 2, x, y, 1.6 + r, spark);
    } else dots.push([x, y, r]);
  }
  // Falling from above onto the cap, resting on it a moment and melting in.
  for (let i = 0; i < SETTLE && caps.length; i++) {
    const v = 8 + rnd(sd, i + 70) * 5, C = 7 + rnd(sd, i + 71) * 4, tt = t + rnd(sd, i + 72) * C, k = Math.floor(tt / C), u = tt - k * C;
    const c = caps[Math.floor(rnd(sd + k, i + 73) * caps.length)];
    const x = lerp(c.r.a + 5, c.r.b - 5, rnd(sd + k, i + 74)), land = base(c, x) - height(c, x);
    const drop = 34, T = drop / v, fallen = Math.min(u, T);
    const sway = Math.sin(fallen * 1.8 + i * 2) * 3 * (1 - fallen / T);
    const r = (1 + rnd(sd + k, i + 75) * 0.8) * Math.min(1, u / 0.6) * (1 - clamp01((u - T - 0.8) / 2.2));
    if (r < 0.2) continue;
    rest.push([x + sway, land - drop + fallen * v - Math.min(r, 1) * 0.3, r]);
  }
  for (const [x, y, r] of dots) sprite(g, sheet, dpr, 0, x, y, r);
  for (const [x, y, r] of rest) sprite(g, sheet, dpr, 3, x, y, r);
  for (const [x, y, r, a, sx] of stars) sprite(g, sheet, dpr, 1, x, y, r, 1, a, sx);
  g.restore();
}
