import { hash2 } from '../../world/noise';
import { ROCK_VARIANTS } from '../../world/tiles';
import { GLYPHS, type Stroke } from '../runestone';
import { READ_BACK } from '../ink';

/**
 * The seams in the rock, cut into the tile: one recess on each tile of ore
 * or stone, and nothing that runs on into the next tile. The tile's wash
 * (`seamWash`, mixed into the ground's colour by `oreWash`) says there is ore
 * from too far out to draw the recess (`SEAM_FROM`).
 *
 * Each recess is a negative: an opening in the face, its back and side walls
 * seen inside it, a floor lower down, the lip of the opening inked and its
 * near edge lit. The family is the shape of the cut:
 *
 *   stone     stepped quarry cut   2-3 square steps down, a mason's mark cut in the floor
 *   fuel      stepped coal cut     2 steps, the lower in coal, ember cracks, its rune lit on the floor
 *   base      rounded pocket       ore chips in its walls, its sign inlaid in the floor, a band of the ore round the lip
 *   precious  lined pocket         wider and deeper, lined with crystals or nuggets, its sign lit, glints
 *   rare      rune fissure         the rune itself cut deep and lit from inside, ore crystals at its ends, glints
 *   unknown   empty pocket         plain stone, three cut dots
 *
 * How it is drawn. Each kind is painted once per zoom step into a picture of
 * the tile as it lies flat (`bake`), in two layers: its body, and what of it
 * lights (`emit`). A tile is then one `drawImage` of the body, laid through
 * the tile's corners so it tilts with the slope (`lay`). The picture is in
 * the screen's frame, not the world's, so its depth always runs down the
 * screen and its mark reads upright: the four cardinal turns share the
 * diamond picture and the four diagonal turns, where a tile is a rectangle,
 * have their own (`DIAMOND`, `RECT`).
 *
 * What moves or lights is drawn per frame over the baked ground: the glints
 * on a precious or rare seam (`veinGlints`), and by night its lit layer and
 * a pool of its light laid over the night's wash (`VeinNight`).
 *
 * Units: the tile at zoom one in screen pixels, its middle at (0, 0); down
 * the screen is down into the rock.
 */

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];
type P = [number, number];

const TAU = Math.PI * 2;
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const css = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The kit's ink, a shade toward violet; its light, a warm cream; and where shade goes, violet-grey (`runestone.ts`). */
const INK: RGB = hex('#4d4258');
const CREAM: RGB = hex('#fff8ea');
const DUSK: RGB = hex('#6a5f7a');

/** A generator off one number, so a picture painted twice comes out the same. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/* ---- the kinds ---------------------------------------------------------------- */

type Family = 'stone' | 'fuel' | 'base' | 'precious' | 'rare' | 'unknown';

export interface VeinLook {
  name: string;
  family: Family;
  /** The rock the cut is in. */
  body: string;
  /** The ore in it. */
  ore: string;
  /** What lights: its mark, its glints, the prospector's mark. */
  light: string;
  /** Its mark, y down, a unit each way; and what it is called. */
  mark: Stroke[];
  markName: string;
  /** How much of it shows through the night, nought to one. */
  emit: number;
  /** The colour a whole tile of it is washed toward (`oreWash`). */
  wash: RGB;
}

const flipY = (m: Stroke[]): Stroke[] => m.map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [x, -y] as [number, number]) }));
const dot = (x: number, y: number): Stroke => ({ pts: [[x, y - 0.06], [x, y + 0.06]] });
const ring = (cx: number, cy: number, r: number, n = 18, a0 = 0, a1 = TAU): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + ((a1 - a0) * i) / n) * r, cy + Math.sin(a0 + ((a1 - a0) * i) / n) * r]);

/** The marks, y down. Tin, lead, silver and gold keep their planets' signs; the rest take the island's runes. */
const MARKS = {
  slate: [{ pts: [[0, -0.9], [0, 0.9]] }, { pts: [[-0.55, -0.35], [0.55, -0.35]] }, { pts: [[-0.55, 0.3], [0.55, 0.3]] }] as Stroke[],
  marble: GLYPHS.diamond,
  sandstone: GLYPHS.wave,
  coal: GLYPHS.kenaz,
  copper: flipY(GLYPHS.othala),
  iron: flipY(GLYPHS.tiwaz),
  tin: [{ pts: [[-0.6, -0.5], [-0.3, -0.85], [0.1, -0.7], [0.05, -0.3], [-0.6, 0.35], [0.75, 0.35]] }, { pts: [[0.35, -0.35], [0.35, 0.95]] }] as Stroke[],
  zinc: [{ pts: [[-0.6, -0.75], [0.6, -0.75], [-0.6, 0.75], [0.6, 0.75]] }, { pts: [[-0.4, 0], [0.4, 0]] }] as Stroke[],
  lead: [{ pts: [[-0.2, -0.95], [-0.2, 0.25], [0.2, -0.05], [0.55, 0.2], [0.35, 0.6], [0.55, 0.92]] }, { pts: [[-0.6, -0.55], [0.2, -0.55]] }] as Stroke[],
  silver: [{ pts: [...ring(0, 0, 0.85, 16, 1.0 + Math.PI / 2, TAU - 1.0 + Math.PI / 2), ...ring(-0.36, 0, 0.62, 12, Math.PI / 2 + TAU - 1.3, Math.PI / 2 + 1.3).slice(1, -1)], closed: true }] as Stroke[],
  gold: [{ pts: ring(0, 0, 0.72, 20), closed: true }, dot(0, 0)] as Stroke[],
  adamantine: flipY(GLYPHS.algiz),
  glimmersteel: GLYPHS.star8,
  mithril: GLYPHS.sowilo,
  seryll: GLYPHS.ingwaz,
  unknown: [dot(0, -0.55), dot(-0.55, 0.4), dot(0.55, 0.4)],
};

const BASE_ROCK = '#c9c2d0';
const RARE_ROCK = '#b9b3c6';

/** By place in `ROCK_VARIANTS`, which is storage and never reordered. Plain rock has none: it is drawn as the stone it is. */
export const VEIN_LOOKS: ReadonlyArray<VeinLook | null> = [
  null,
  { name: 'Slate', family: 'stone', body: '#9ea9bc', ore: '#7f8ba3', light: '#b6c6e0', mark: MARKS.slate, markName: "mason's mark", emit: 0, wash: hex('#8a97b0') },
  { name: 'Marble', family: 'stone', body: '#f0e5d6', ore: '#b9bfd0', light: '#f4ecdc', mark: MARKS.marble, markName: 'diamond', emit: 0, wash: hex('#e6ddd8') },
  { name: 'Sandstone', family: 'stone', body: '#e6c49c', ore: '#c99a76', light: '#f2d7b0', mark: MARKS.sandstone, markName: 'wave', emit: 0, wash: hex('#dcc2a8') },
  { name: 'Copper', family: 'base', body: BASE_ROCK, ore: '#e08a5a', light: '#ff9b62', mark: MARKS.copper, markName: 'othala', emit: 0.25, wash: hex('#d4957a') },
  { name: 'Coal', family: 'fuel', body: '#968ca6', ore: '#685e7c', light: '#ff7f5a', mark: MARKS.coal, markName: 'kenaz', emit: 0.45, wash: hex('#6f6878') },
  { name: 'Tin', family: 'base', body: BASE_ROCK, ore: '#ece7d4', light: '#fff1c4', mark: MARKS.tin, markName: '♃', emit: 0.25, wash: hex('#c4bdb2') },
  { name: 'Zinc', family: 'base', body: BASE_ROCK, ore: '#93b8d0', light: '#9fdcff', mark: MARKS.zinc, markName: 'barred Z', emit: 0.25, wash: hex('#9fc4c0') },
  { name: 'Lead', family: 'base', body: BASE_ROCK, ore: '#8b84a6', light: '#b7a8e8', mark: MARKS.lead, markName: '♄', emit: 0.25, wash: hex('#868aa6') },
  { name: 'Silver', family: 'precious', body: BASE_ROCK, ore: '#e3eaf4', light: '#a8ecff', mark: MARKS.silver, markName: '☽', emit: 0.55, wash: hex('#c8d0e2') },
  { name: 'Gold', family: 'precious', body: BASE_ROCK, ore: '#f3c24f', light: '#ffd04a', mark: MARKS.gold, markName: '☉', emit: 0.6, wash: hex('#e8cf88') },
  { name: 'Adamantine', family: 'rare', body: RARE_ROCK, ore: '#4f9cb8', light: '#2ee6d2', mark: MARKS.adamantine, markName: 'algiz', emit: 1, wash: hex('#8a90b8') },
  { name: 'Glimmersteel', family: 'rare', body: RARE_ROCK, ore: '#d2e6fa', light: '#8ff4ff', mark: MARKS.glimmersteel, markName: 'eight-point star', emit: 1, wash: hex('#d4d0e6') },
  { name: 'Mithril', family: 'rare', body: RARE_ROCK, ore: '#a5acee', light: '#a785ff', mark: MARKS.mithril, markName: 'sowilo', emit: 1, wash: hex('#a8b8e2') },
  { name: 'Seryll', family: 'rare', body: RARE_ROCK, ore: '#eab49e', light: '#ff6fd0', mark: MARKS.seryll, markName: 'ingwaz', emit: 1, wash: hex('#e4c2b6') },
  { name: 'Iron', family: 'base', body: BASE_ROCK, ore: '#b25e58', light: '#ff8a6e', mark: MARKS.iron, markName: 'tiwaz', emit: 0.25, wash: hex('#b88880') },
];

/**
 * A seam the island would not name to this reader: the rock kind it sends
 * for one (`UNIDENTIFIED_ROCK`, where the island gates veins by skill). An
 * empty pocket in plain stone and a neutral wash, nothing of its metal.
 */
export const UNIDENTIFIED_FACE = 255;
const UNIDENTIFIED_LOOK: VeinLook = {
  name: 'Unidentified metal', family: 'unknown', body: '#c3bbd0', ore: '#aaa3b6', light: '#c8f4ff', mark: MARKS.unknown, markName: 'three dots', emit: 0, wash: [178, 172, 186],
};

/** A rock kind's look: its own, the unidentified one, or none for plain rock. */
export const veinLook = (kind: number): VeinLook | null => (kind === UNIDENTIFIED_FACE ? UNIDENTIFIED_LOOK : VEIN_LOOKS[kind] ?? null);
/** Its place in the bakes. */
const slot = (kind: number): number => (kind === UNIDENTIFIED_FACE ? VEIN_LOOKS.length : kind);

/** The colour a whole tile of kind `kind` is washed toward (`oreWash`): its look's, or the table's for plain rock. */
export function seamWash(kind: number): readonly number[] {
  return veinLook(kind)?.wash ?? ROCK_VARIANTS[kind]?.color ?? ROCK_VARIANTS[0].color;
}

/* ---- the frames a picture is painted in ----------------------------------------- */

interface Frame {
  /** The tile's own square, (0, 0) at its topmost (diamond) or top-left (rectangle) screen corner, to the picture; `z` down the screen. */
  Q(u: number, v: number, z?: number): P;
  /** A mark's (x, y) to the tile's square, `s` across, upright on the screen. */
  mk(x: number, y: number, s: number): P;
  /** The picture's box, the tile and a margin. */
  box: { x: number; y: number; w: number; h: number };
  /** The flat picture's (u, v) to screen, inverted: what `lay` needs to map the picture's corners onto the tile's. */
  inv: [number, number, number, number];
  c0: P;
}

function frame(Q: Frame['Q'], mk: Frame['mk'], box: Frame['box']): Frame {
  const c0 = Q(0, 0), c1 = Q(1, 0), c3 = Q(0, 1);
  const ax = c1[0] - c0[0], ay = c1[1] - c0[1], bx = c3[0] - c0[0], by = c3[1] - c0[1];
  const det = ax * by - bx * ay;
  return { Q, mk, box, c0, inv: [by / det, -bx / det, -ay / det, ax / det] };
}

/** The four cardinal turns: a 96 by 48 diamond. A mark is turned an eighth so its up is up the screen. */
const DIAMOND = frame(
  (u, v, z = 0) => [48 * (u - v), 24 * (u + v) - 24 + z],
  (x, y, s) => { const k = s / Math.SQRT2; return [(x + y) * k, (-x + y) * k]; },
  { x: -50, y: -26, w: 100, h: 54 },
);
/** The four diagonal turns: the same ground as a rectangle, 48√2 by 24√2 (`view.ts`). */
const RW = 48 * Math.SQRT2, RH = 24 * Math.SQRT2;
const RECT = frame(
  (u, v, z = 0) => [RW * (u - 0.5), RH * (v - 0.5) + z],
  (x, y, s) => [x * s, y * s],
  { x: -36, y: -19, w: 72, h: 40 },
);
const FRAMES = [DIAMOND, RECT];
/** Which frame a tile's screen corners are in: a diamond's top and bottom corners stand one over the other, a rectangle's left two. */
const frameOf = (pts: ArrayLike<number>): number => (Math.abs(pts[0] - pts[4]) < Math.abs(pts[0] - pts[6]) ? 0 : 1);

/** The frame the picture being painted is in. */
let F: Frame = DIAMOND;
const Q = (u: number, v: number, z = 0): P => F.Q(u, v, z);

/* ---- pieces ------------------------------------------------------------------ */

interface Pal { rim: RGB; dark: RGB; body: RGB; lit: RGB; shine: RGB }
/** A palette off one colour, the kit's way: shade toward dusk, light toward cream, line in ink. */
function palOf(b: RGB, o: { rim?: number; dark?: number; lit?: number; shine?: number } = {}): Pal {
  return { rim: mix(b, INK, o.rim ?? 0.62), dark: mix(b, DUSK, o.dark ?? 0.32), body: b, lit: mix(b, CREAM, o.lit ?? 0.42), shine: mix(b, CREAM, o.shine ?? 0.85) };
}

/** A tone off its lit and shade ends, the runestones' way. */
function shadeOf(base: RGB, L: number): RGB {
  const lit = mix(base, CREAM, 0.38);
  // The shade mostly its own colour deeper, a little turned toward violet, the rest toward dusk: a warm stone keeps its warmth, a grey one some colour.
  const [h, sat, l] = toHsl(base);
  const own = fromHsl(h + (((265 - h + 540) % 360) - 180) * 0.06, Math.min(1, sat + 0.06), l * 0.64);
  const shade = mix(own, mix(mix(base, DUSK, 0.45), hex('#6c86b0'), 0.14), 0.25);
  return mix(lit, shade, Math.max(0, Math.min(1, (1 - L) / 0.9)));
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function polyPath(g: Ctx, pts: readonly P[]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** Broken colour in a facet: dabs of two close values of it, about one to every `per` square pixels of its box, the world's mottle. */
function mottle(g: Ctx, pts: readonly P[], c: RGB, R: () => number, per: number, r: number): void {
  g.save();
  polyPath(g, pts);
  g.clip();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const n = Math.min(200, Math.ceil(((x1 - x0) * (y1 - y0)) / per));
  for (let i = 0; i < n; i++) {
    // Paler dabs turned a little toward lilac, so broken colour shows on a pale stone too.
    g.fillStyle = css(R() < 0.4 ? mix(mix(c, CREAM, 0.2), hex('#c4aee0'), 0.14) : mix(c, DUSK, 0.18), 0.5);
    g.beginPath();
    g.ellipse(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), r * (0.6 + R()), r * 0.5 * (0.6 + R()), 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** An irregular round lump: `k` bumps on a ring of radius `r`, squashed by `sq` along `ang`. */
function lump(p: Path2D, x: number, y: number, r: number, R: () => number, k: number, rough: number, sq: number, ang: number): void {
  const pts: number[] = [];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + (R() - 0.5) * 0.5;
    const rr = r * (1 - rough / 2 + R() * rough);
    const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * sq;
    pts.push(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
  }
  const mx = (i: number): number => (pts[(i * 2) % pts.length] + pts[((i + 1) * 2) % pts.length]) / 2;
  const my = (i: number): number => (pts[(i * 2 + 1) % pts.length] + pts[((i + 1) * 2 + 1) % pts.length]) / 2;
  p.moveTo(mx(k - 1), my(k - 1));
  for (let i = 0; i < k; i++) p.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  p.closePath();
}

/** A lump of ore: its line, its body, a dome of light toward its top and a fleck of shine. */
function nugget(g: Ctx, x: number, y: number, r: number, pal: Pal, R: () => number, o: { sq?: number; line?: number } = {}): void {
  const p = new Path2D();
  lump(p, x, y, r, R, 7, 0.28, o.sq ?? 0.82, R() * TAU);
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
  g.fillStyle = css(pal.shine, 0.95);
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.42, r * 0.2, r * 0.13, -0.4, 0, TAU);
  g.fill();
  g.restore();
}

/** A crystal seen end on: a polygon of `sides` cut into facets, alternate facets in light and shade, inside its line. */
function gem(g: Ctx, x: number, y: number, r: number, pal: Pal, R: () => number, o: { sides?: number; sq?: number; line?: number } = {}): void {
  const k = o.sides ?? 6;
  const ang = R() * TAU;
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
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.lineWidth = r * (o.line ?? 0.24);
  g.strokeStyle = css(pal.rim);
  g.stroke();
  g.fillStyle = css(pal.body);
  g.fill();
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
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
  g.fillStyle = css(pal.shine);
  g.beginPath();
  g.ellipse(hx - r * 0.05, hy - r * 0.08, r * 0.2, r * 0.14, ang, 0, TAU);
  g.fill();
  g.restore();
}

/** A soft round glow, the runes' halo. */
function glow(g: Ctx, x: number, y: number, r: number, c: RGB, a = 0.5): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, css(c, a));
  gr.addColorStop(0.45, css(c, a * 0.45));
  gr.addColorStop(1, css(c, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

const centroid = (ps: readonly P[]): P => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];

/** An opening in the tile's square: a square with its corners cut, as the runecut slabs are cut. */
function cutSquare(u0: number, u1: number, k: number, z: number): P[] {
  return [
    Q(u0 + k, u0, z), Q(u1 - k, u0, z), Q(u1, u0 + k, z), Q(u1, u1 - k, z),
    Q(u1 - k, u1, z), Q(u0 + k, u1, z), Q(u0, u1 - k, z), Q(u0, u0 + k, z),
  ];
}

/** An opening in the tile's square: a rough round, `n` corners. */
function roundel(r: number, n: number, R: () => number): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + 0.2;
    const rr = r * (0.9 + R() * 0.18);
    return Q(0.5 + Math.cos(a) * rr, 0.5 + Math.sin(a) * rr);
  });
}

interface Pit { walls: Array<{ pts: P[]; mid: P; back: boolean }> }

/**
 * A recess: the opening `open`, its floor the opening drawn in by `shrink`
 * about its middle and `depth` down. Inside the opening the far walls show
 * (a wall on the right of the hole faces left, toward the key, and is pale;
 * one on the left is in shade), the floor below with the left wall's shadow
 * across it; round it, the lip inked and its near edge lit.
 */
function pit(g: Ctx, open: P[], depth: number, shrink: number, body: RGB, line: number, R: () => number, floorTone = 0.42): Pit {
  const [cx, cy] = centroid(open);
  let rx = 0;
  for (const [x] of open) rx = Math.max(rx, Math.abs(x - cx));
  const floor: P[] = open.map(([x, y]) => [cx + (x - cx) * shrink, cy + (y - cy) * shrink + depth]);
  const walls: Pit['walls'] = [];
  g.save();
  polyPath(g, open);
  g.fillStyle = css(shadeOf(body, 0.3));
  g.fill();
  g.clip();
  const n = open.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pts: P[] = [open[i], open[j], floor[j], floor[i]];
    const mx = (open[i][0] + open[j][0]) / 2, my = (open[i][1] + open[j][1]) / 2;
    const back = my < cy + 0.5;
    const side = (mx - cx) / (rx || 1);
    // Darker than the face round it, always: that is what says it goes in rather than up.
    const c = shadeOf(body, back ? 0.3 + side * 0.2 : 0.12);
    polyPath(g, pts);
    g.fillStyle = css(c);
    g.fill();
    g.strokeStyle = css(c);
    g.lineWidth = line * 0.4;
    g.stroke();
    mottle(g, pts, c, R, 2, 0.8);
    polyPath(g, pts);
    g.strokeStyle = css(mix(c, INK, 0.4), 0.45);
    g.lineWidth = line * 0.4;
    g.stroke();
    walls.push({ pts, mid: [(open[i][0] + open[j][0] + floor[i][0] + floor[j][0]) / 4, (open[i][1] + open[j][1] + floor[i][1] + floor[j][1]) / 4], back });
  }
  const fc = shadeOf(body, floorTone);
  polyPath(g, floor);
  g.fillStyle = css(fc);
  g.fill();
  mottle(g, floor, fc, R, 2, 0.9);
  // The left wall's shadow across the floor.
  const gr = g.createLinearGradient(cx - rx, 0, cx + rx * 0.2, 0);
  gr.addColorStop(0, css(hex('#544c8a'), 0.38));
  gr.addColorStop(1, css(DUSK, 0));
  polyPath(g, floor);
  g.fillStyle = gr;
  g.fill();
  // And the shadow the far lip throws down the inside: darkest under it.
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of open) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const sh = g.createLinearGradient(0, y0, 0, y0 + (y1 - y0 + depth) * 0.6);
  sh.addColorStop(0, css(hex('#3a2f66'), 0.5));
  sh.addColorStop(1, css(hex('#3a2f66'), 0));
  polyPath(g, open);
  g.fillStyle = sh;
  g.fill();
  g.restore();
  // The lip: inked round, and its near edge catching the light as a cut does.
  g.save();
  g.lineJoin = 'round';
  polyPath(g, open);
  g.strokeStyle = css(mix(body, hex('#4a3d70'), 0.78));
  g.lineWidth = line * 1.5;
  g.stroke();
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if ((open[i][1] + open[j][1]) / 2 < cy + 0.5) continue;
    g.moveTo(open[i][0], open[i][1] + line * 1.1);
    g.lineTo(open[j][0], open[j][1] + line * 1.1);
  }
  g.strokeStyle = css(mix(body, CREAM, 0.7), 0.9);
  g.lineWidth = line * 0.8;
  g.stroke();
  g.restore();
  return { walls };
}

/** A mark's strokes laid flat in the tile's square, its middle at the tile's, `s` across, `z` down the screen. */
function flatPath(g: Ctx, m: readonly Stroke[], s: number, z = 0, dx = 0, dy = 0): void {
  g.beginPath();
  for (const st of m) {
    st.pts.forEach(([px, py], i) => {
      const [du, dv] = F.mk(px, py, s);
      const [X, Y] = Q(0.5 + du, 0.5 + dv, z);
      if (i) g.lineTo(X + dx, Y + dy);
      else g.moveTo(X + dx, Y + dy);
    });
    if (st.closed) g.closePath();
  }
}

/** A mark cut into a floor: the groove a step deeper, its far lip lit. */
function cutFlat(g: Ctx, m: readonly Stroke[], s: number, z: number, face: RGB, w: number): void {
  g.save();
  flatPath(g, m, s, z);
  g.strokeStyle = css(mix(face, hex('#4a3d70'), 0.55));
  g.lineWidth = w;
  g.stroke();
  flatPath(g, m, s, z, 0, w * 0.35);
  g.strokeStyle = css(mix(face, CREAM, 0.6), 0.8);
  g.lineWidth = w * 0.35;
  g.stroke();
  g.restore();
}

/** A mark inlaid with metal in a floor: the groove inked, the metal in it, a lit hairline. */
function inlayFlat(g: Ctx, m: readonly Stroke[], s: number, z: number, ore: RGB, w: number): void {
  g.save();
  flatPath(g, m, s, z);
  g.strokeStyle = css(mix(ore, INK, 0.7));
  g.lineWidth = w * 1.6;
  g.stroke();
  g.strokeStyle = css(ore);
  g.lineWidth = w;
  g.stroke();
  flatPath(g, m, s, z, -w * 0.15, -w * 0.2);
  g.strokeStyle = css(mix(ore, CREAM, 0.7), 0.9);
  g.lineWidth = w * 0.3;
  g.stroke();
  g.restore();
}

/** A mark lit from inside: halo, coloured stroke, pale core. */
function litFlat(g: Ctx, m: readonly Stroke[], s: number, z: number, light: RGB, w: number, k = 1): void {
  g.save();
  flatPath(g, m, s, z);
  g.strokeStyle = css(light, 0.25 * k);
  g.lineWidth = w * 3.2;
  g.stroke();
  g.strokeStyle = css(light, 0.8 * k);
  g.lineWidth = w * 1.5;
  g.stroke();
  g.strokeStyle = css(mix(light, CREAM, 0.75), 0.95 * k);
  g.lineWidth = w * 0.6;
  g.stroke();
  g.restore();
}

/* ---- the recesses ------------------------------------------------------------ */

type Layer = 0 | 1;
const BODY: Layer = 0, EMIT: Layer = 1;

/** Stone and coal: a quarry cut, square steps down, each a little in from the last and back toward the far corner. */
function drawQuarry(g: Ctx, look: VeinLook, R: () => number, line: number, layer: Layer, v: number): void {
  const body = hex(look.body), vein = hex(look.ore), light = hex(look.light);
  const coal = look.family === 'fuel';
  const steps: Array<[number, number, number]> = look.name === 'Slate'
    ? [[0.17, 0.83, 3], [0.27, 0.75, 3], [0.37, 0.67, 3]]
    : look.name === 'Marble' ? [[0.18, 0.82, 5], [0.32, 0.7, 5]]
      : coal ? [[0.18, 0.82, 4], [0.3, 0.72, 5]] : [[0.18, 0.82, 4], [0.3, 0.72, 4]];
  // Each step sits back up the screen, so the near ledge of the one above shows.
  const back = (v ? 0.03 : 0.015) * 48;
  let z = 0;
  let lastOpen: P[] = [];
  let firstOpen: P[] = [];
  steps.forEach(([a, b, d], i) => {
    const open = cutSquare(a, b, look.name === 'Marble' ? 0.08 : 0.05, z - back * i);
    lastOpen = open;
    if (!i) firstOpen = open;
    if (layer === BODY) {
      const p = pit(g, open, d, 1, coal && i ? vein : body, line, R, 0.5);
      if (look.name === 'Sandstone' || look.name === 'Slate' || coal) {
        // Bedding lines along the back walls; in coal, the cleat between its blocks.
        for (const w of p.walls) if (w.back) {
          g.save();
          polyPath(g, w.pts);
          g.clip();
          g.strokeStyle = css(coal ? mix(vein, INK, 0.5) : vein, 0.6);
          g.lineWidth = line * 0.6;
          g.beginPath();
          const [p0, p1, p2, p3] = w.pts;
          for (const f of coal ? [0.5] : [0.4, 0.75]) {
            g.moveTo(p0[0] + (p3[0] - p0[0]) * f, p0[1] + (p3[1] - p0[1]) * f);
            g.lineTo(p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f);
          }
          g.stroke();
          g.restore();
        }
      }
    }
    z += d;
  });
  const floorZ = z - back * (steps.length - 1);
  if (look.name === 'Marble' && layer === BODY) {
    // A grey vein over the floor.
    g.save();
    g.strokeStyle = css(vein, 0.85);
    g.lineWidth = line * 0.8;
    g.beginPath();
    const [x0, y0] = Q(0.35, 0.55, floorZ), [x1, y1] = Q(0.62, 0.38, floorZ);
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2 + 3, x1, y1);
    g.stroke();
    g.restore();
  }
  // What is cut in the floor stays inside the deepest opening.
  g.save();
  polyPath(g, lastOpen);
  g.clip();
  if (!coal) {
    if (layer === BODY) cutFlat(g, look.mark, look.name === 'Slate' ? 0.07 : 0.1, floorZ, shadeOf(body, 0.5), line * 1.2);
    g.restore();
    return;
  }
  litFlat(g, look.mark, 0.1, floorZ, light, line * 0.8, layer === EMIT ? 1 : 0.85);
  g.restore();
  // Coal: ember in the cracks of its far walls.
  const R2 = seeded(911 + v);
  g.save();
  polyPath(g, firstOpen);
  g.clip();
  g.lineCap = 'round';
  g.strokeStyle = css(light, 0.9);
  g.lineWidth = line * 0.8;
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = Q(0.28 + R2() * 0.4, 0.18, 0.4);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 + 1.2, y0 + 1.6);
    g.lineTo(x0 + 0.6, y0 + 3.4);
    g.stroke();
  }
  g.restore();
}

/** The glints on a precious pocket, in the picture's units round its middle: x, y, size. */
const POCKET_GLINTS: ReadonlyArray<readonly [number, number, number]> = [[-12, -6, 3.2], [14, -2, 2.4]];

/** Base metals, precious metals and the unknown: a rounded pocket. */
function drawPocket(g: Ctx, look: VeinLook, R: () => number, line: number, layer: Layer, v: number): void {
  const body = hex(look.body), ore = hex(look.ore), light = hex(look.light);
  const precious = look.family === 'precious', base = look.family === 'base';
  const r = precious ? 0.35 : look.family === 'unknown' ? 0.3 : 0.32;
  const depth = precious ? 7 : 6;
  const open = roundel(r, 12, seeded(17 + v * 3));
  const [cx, cy] = centroid(open);
  if (layer === BODY) {
    const p = pit(g, open, depth, 0.72, body, line, R);
    g.save();
    polyPath(g, open);
    g.clip();
    if (base) {
      // Chips of the ore showing in the walls.
      const pal = palOf(ore, { lit: 0.45, dark: 0.32, rim: 0.62 });
      p.walls.filter((w) => w.back).forEach((w, i) => {
        if (i % 2 !== v % 2) return;
        nugget(g, w.mid[0], w.mid[1], 2.6 + seeded(i + 5)() * 1.6, pal, seeded(i * 31 + v), { line: 0.32, sq: 0.7 });
      });
    }
    if (precious) {
      // Lined: crystals or nuggets crowded over its far walls, two rows.
      // Gold's nuggets toward cream in the light and dusk in the shade, so the gold reads without flooding the pocket.
      const pal = look.name === 'Gold' ? palOf(ore, { lit: 0.72, dark: 0.42, rim: 0.6 }) : palOf(ore, { lit: 0.55, dark: 0.3, rim: 0.6 });
      const backs = p.walls.filter((w) => w.back);
      for (const t of [0.3, 0.72]) {
        backs.forEach((w, i) => {
          const [a, b, c2, d] = w.pts;
          const x = ((a[0] + b[0]) / 2) * (1 - t) + ((c2[0] + d[0]) / 2) * t, y = ((a[1] + b[1]) / 2) * (1 - t) + ((c2[1] + d[1]) / 2) * t;
          const rr = (t < 0.5 ? 3.4 : 2.7) * (0.85 + seeded(i * 7 + t * 10)() * 0.3);
          if (look.name === 'Gold') nugget(g, x, y, rr, pal, seeded(i * 13 + t * 100), { line: 0.3, sq: 0.8 });
          else gem(g, x, y, rr, pal, seeded(i * 13 + t * 100), { sides: 6, sq: 0.75, line: 0.26 });
        });
      }
    }
    g.restore();
    if (base) {
      // A band of the ore's own colour stained round the lip, on the face.
      const outer = open.map(([x, y]) => [cx + (x - cx) * 1.14, cy + (y - cy) * 1.14] as P);
      g.save();
      polyPath(g, outer);
      g.strokeStyle = css(ore, 0.9);
      g.lineWidth = line * 3.2;
      g.stroke();
      polyPath(g, outer);
      g.strokeStyle = css(mix(ore, INK, 0.62), 0.9);
      g.lineWidth = line * 0.8;
      g.stroke();
      g.restore();
    }
  }
  // The mark in the floor, inside the opening.
  g.save();
  polyPath(g, open);
  g.clip();
  if (look.family === 'unknown') {
    if (layer === BODY) cutFlat(g, look.mark, 0.09, depth, shadeOf(body, 0.42), line * 1.3);
    else litFlat(g, look.mark, 0.09, depth, light, line * 0.8);
  } else if (base) {
    if (layer === BODY) inlayFlat(g, look.mark, 0.1, depth, ore, line * 1.2);
    else litFlat(g, look.mark, 0.1, depth, light, line * 0.8);
  } else {
    if (layer === BODY) inlayFlat(g, look.mark, 0.1, depth, ore, line * 1.2);
    litFlat(g, look.mark, 0.1, depth, light, line * 0.7, layer === EMIT ? 1 : 0.6);
  }
  g.restore();
}

/** The size of a rare rune's cut: across, wide, deep. */
const FISSURE = { s: 0.27, w: 7.5, d: 7 };

/** Where a rare rune's strokes end, in the picture: where its crystals stand. */
function fissureEnds(look: VeinLook): P[] {
  const ends: P[] = [];
  const at = ([x, y]: [number, number]): P => { const [du, dv] = F.mk(x, y, FISSURE.s); return Q(0.5 + du, 0.5 + dv); };
  for (const st of look.mark) {
    ends.push(at(st.pts[0]));
    if (!st.closed) ends.push(at(st.pts[st.pts.length - 1]));
  }
  return ends;
}

/** Rare ores: the rune cut deep into the rock, lit from inside, crystals of the ore at its ends. */
function drawFissure(g: Ctx, look: VeinLook, line: number, layer: Layer, v: number): void {
  const body = hex(look.body), ore = hex(look.ore), light = hex(look.light);
  const { s: S, w: W, d: D } = FISSURE;
  // The fissure is drawn on a layer of its own, so its depth is kept inside its own opening.
  const c = document.createElement('canvas');
  c.width = g.canvas.width;
  c.height = g.canvas.height;
  const f = c.getContext('2d')!;
  f.setTransform(g.getTransform());
  f.lineCap = 'round';
  f.lineJoin = 'round';
  flatPath(f, look.mark, S, 0);
  // Its walls in shade, tinged with what lights them from below.
  f.strokeStyle = css(mix(shadeOf(body, layer === EMIT ? 0.2 : 0.35), light, 0.2));
  f.lineWidth = W;
  f.stroke();
  f.globalCompositeOperation = 'source-atop';
  // The far wall lit by what is down there, then the light itself, deeper.
  flatPath(f, look.mark, S, D * 0.5);
  f.strokeStyle = css(mix(shadeOf(body, 0.4), light, 0.35));
  f.lineWidth = W * 0.9;
  f.stroke();
  flatPath(f, look.mark, S, D);
  f.strokeStyle = css(light);
  f.lineWidth = W * 0.7;
  f.stroke();
  flatPath(f, look.mark, S, D + 1.2);
  f.strokeStyle = css(mix(light, CREAM, 0.75));
  f.lineWidth = W * 0.48;
  f.stroke();
  // Broken colour down the cut and in its light: dabs a little paler and a little deeper than what they fall on.
  const R = seeded(523 + v);
  for (let i = 0; i < 420; i++) {
    f.fillStyle = R() < 0.5 ? css(mix(light, CREAM, 0.6), 0.22) : css(mix(light, INK, 0.55), 0.18);
    f.beginPath();
    f.ellipse(-30 + R() * 60, -20 + R() * 44, 0.6 + R() * 0.8, 0.4 + R() * 0.5, 0, 0, TAU);
    f.fill();
  }
  f.globalCompositeOperation = 'source-over';
  if (layer === EMIT) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(c, 0, 0);
    g.restore();
    return;
  }
  // A faint stain of its light on the rock round it.
  glow(g, 0, 2, 30, light, 0.16);
  // The lip inked: a wider stroke under the opening.
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  flatPath(g, look.mark, S, 0);
  g.strokeStyle = css(mix(mix(body, INK, 0.7), light, 0.22));
  g.lineWidth = W + line * 3;
  g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(c, 0, 0);
  g.restore();
  // Crystals of the ore at its ends, leaning out of the cut.
  const pal = palOf(ore, { lit: 0.55, dark: 0.32, rim: 0.66, shine: 0.9 });
  fissureEnds(look).slice(0, 3 + v).forEach(([x, y], i) => gem(g, x, y + 1, 3.2, pal, seeded(i * 17 + v), { sides: 6, sq: 0.7, line: 0.26 }));
}

/* ---- baking ----------------------------------------------------------------- */

/** The zoom steps a picture is painted at; between them the next one up is drawn down. */
const STEPS = [1, 1.5, 2, 3, 4, 5];
const stepOf = (zoom: number): number => {
  for (let i = 0; i < STEPS.length; i++) if (STEPS[i] >= zoom - 1e-6) return i;
  return STEPS.length - 1;
};
/** A baked picture, trimmed to what is drawn in it, and where it lies in its frame's units. */
interface Pic { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number }
/** The pictures, by `keyOf`, for the screen's pixels they were painted at; and the two steps kept, the one in use and the last. */
const baked = new Map<number, Pic | null>();
let bakedDpr = 0;
const keptSteps: number[] = [];
const keyOf = (s: number, frameId: number, layer: Layer, v: number, step: number): number => ((((s * 2 + frameId) * 2 + layer) * 2 + v) * 8 + step);

function bake(kind: number, frameId: number, layer: Layer, v: number, step: number, dpr: number): Pic | null {
  const look = veinLook(kind);
  if (!look) return null;
  if (dpr !== bakedDpr) {
    baked.clear();
    bakedDpr = dpr;
  }
  const key = keyOf(slot(kind), frameId, layer, v, step);
  const had = baked.get(key);
  if (had !== undefined) return had;
  if (keptSteps[0] !== step) {
    // A new step in use: the one before it kept for a zoom going back and forth across a step, the rest let go.
    const last = keptSteps[0];
    keptSteps.length = 0;
    keptSteps.push(step);
    if (last !== undefined) keptSteps.push(last);
    for (const k of [...baked.keys()]) if (!keptSteps.includes(k % 8)) baked.delete(k);
  }
  F = FRAMES[frameId];
  const box = F.box;
  const px = STEPS[step] * dpr;
  const c = document.createElement('canvas');
  c.width = Math.ceil(box.w * px);
  c.height = Math.ceil(box.h * px);
  // Painted in memory, not on the graphics chip: it is read back once to be trimmed (`trim`).
  const g = c.getContext('2d', READ_BACK)!;
  g.setTransform(px, 0, 0, px, -box.x * px, -box.y * px);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Kept to its own tile: nothing of it falls on the next.
  polyPath(g, [Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)]);
  g.clip();
  const line = Math.max(0.55, 1.1 / px);
  const R = seeded(slot(kind) * 7919 + v * 104729 + 3);
  // What lights much throws a soft pool of its light on the stone round it, inside its own tile.
  if (layer === EMIT && pooled(look)) {
    g.save();
    g.scale(1, F === RECT ? RH / RW : 0.5);
    glow(g, 0, 0, F === RECT ? RW * 0.3 : 28, hex(look.light), 0.4);
    g.restore();
  }
  if (look.family === 'stone' || look.family === 'fuel') drawQuarry(g, look, R, line, layer, v);
  else if (look.family === 'rare') drawFissure(g, look, line, layer, v);
  else drawPocket(g, look, R, line, layer, v);
  const pic = trim(c, box, px);
  baked.set(key, pic);
  return pic;
}

/**
 * A picture cut down to the box round what was drawn in it: a recess fills a
 * half of its tile's box or less, and every pixel of the box would be drawn
 * again on every tile. Nothing drawn: none.
 */
function trim(c: HTMLCanvasElement, box: Frame['box'], px: number): Pic | null {
  const { width: W, height: H } = c;
  const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!d[(y * W + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  t.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { cv: t, x: box.x + x0 / px, y: box.y + y0 / px, w: w / px, h: h / px };
}

/** Which of a kind's two cuts a tile has. */
const variantOf = (x: number, y: number): number => (hash2(x, y, 719) < 0.5 ? 0 : 1);

/** The map that lays a frame's flat picture on a tile through its screen corners `pts`: a, b, c, d, e, f. */
const AFF: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
function affine(pts: ArrayLike<number>, fr: Frame, out = AFF): typeof AFF {
  const sx = pts[2] - pts[0], sy = pts[3] - pts[1], tx = pts[6] - pts[0], ty = pts[7] - pts[1];
  const [i0, i1, i2, i3] = fr.inv;
  // [S T] times the inverse of the picture's own corner vectors.
  const a = sx * i0 + tx * i2, c = sx * i1 + tx * i3;
  const b = sy * i0 + ty * i2, d = sy * i1 + ty * i3;
  out[0] = a; out[1] = b; out[2] = c; out[3] = d;
  out[4] = pts[0] - (a * fr.c0[0] + c * fr.c0[1]);
  out[5] = pts[1] - (b * fr.c0[0] + d * fr.c0[1]);
  return out;
}

/** Lay a flat picture on a tile: one `drawImage` under the tile's map, so it leans with the slope. */
function lay(g: Ctx, pic: Pic, pts: ArrayLike<number>, frameId: number): void {
  const m = affine(pts, FRAMES[frameId]);
  g.save();
  g.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  g.drawImage(pic.cv, pic.x, pic.y, pic.w, pic.h);
  g.restore();
}

/** Below this zoom the tile's wash alone says it. */
export const SEAM_FROM = 0.9;

/**
 * The recess on one tile of rock of kind `kind`, over the stone already drawn
 * there. `pts` is the tile's four screen corners clockwise from the topmost;
 * `rot`, which of them is the tile's own (0, 0), is not wanted: the picture
 * is in the screen's frame. `dpr` is the screen's pixels per canvas pixel,
 * which the pictures are painted at. Plain rock draws nothing.
 */
export function seam(g: Ctx, x: number, y: number, kind: number, pts: ArrayLike<number>, _rot: number, zoom: number, dpr: number): void {
  if (zoom < SEAM_FROM) return;
  const fid = frameOf(pts);
  const img = bake(kind, fid, BODY, variantOf(x, y), stepOf(zoom), dpr);
  if (img) lay(g, img, pts, fid);
}

/* ---- what moves: the glints ----------------------------------------------------- */

/** Where a kind's glints are in its picture, if it has any: precious ones on the lining, rare ones at the rune's first end. */
const glintsKept = new Map<number, ReadonlyArray<readonly [number, number, number]>>();
function glintsOf(kind: number, look: VeinLook, fid: number): ReadonlyArray<readonly [number, number, number]> {
  const key = slot(kind) * 2 + fid;
  let gl = glintsKept.get(key);
  if (gl) return gl;
  if (look.family === 'precious') gl = POCKET_GLINTS;
  else if (look.family === 'rare') {
    F = FRAMES[fid];
    const [e] = fissureEnds(look);
    gl = [[e[0] - 2, e[1] - 4, 3], [2, 0, 2.2]];
  } else gl = [];
  glintsKept.set(key, gl);
  return gl;
}

/** A four-pointed glint in a kind's light, painted once per step: a thin cross with a bright heart. */
let sparkDpr = 0;
const sparkles = new Map<number, HTMLCanvasElement>();
const SPARK = 4;
function sparkleOf(kind: number, light: string, step: number, dpr: number): HTMLCanvasElement {
  // By kind and step, for the screen's pixels they were painted at: all let go when those change.
  if (dpr !== sparkDpr) {
    sparkles.clear();
    sparkDpr = dpr;
  }
  const key = slot(kind) * STEPS.length + step;
  const px = STEPS[step] * dpr;
  let c = sparkles.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = Math.ceil(SPARK * 2 * px);
  const g = c.getContext('2d')!;
  g.setTransform(px, 0, 0, px, SPARK * px, SPARK * px);
  const col = mix(hex(light), CREAM, 0.6), r = SPARK, t = r * 0.16;
  g.fillStyle = css(col, 1);
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(t, -t, r, 0);
  g.quadraticCurveTo(t, t, 0, r);
  g.quadraticCurveTo(-t, t, -r, 0);
  g.quadraticCurveTo(-t, -t, 0, -r);
  g.fill();
  glow(g, 0, 0, r * 0.55, col, 0.7);
  sparkles.set(key, c);
  return c;
}

/** Below this zoom a glint is a pixel or two, and is left out. */
const GLINT_FROM = 1.5;
/** How far a glint's light dips and comes back. */
const TWINKLE = 0.45;

/**
 * The glints on one tile of a precious or rare seam, each frame over its
 * baked picture: each dips and comes back on a beat of its own. `t` is the
 * drawing clock in seconds, held at nought while animations are off.
 */
export function veinGlints(g: Ctx, x: number, y: number, kind: number, pts: ArrayLike<number>, zoom: number, dpr: number, t: number): void {
  if (zoom < GLINT_FROM) return;
  const look = veinLook(kind);
  if (!look || (look.family !== 'precious' && look.family !== 'rare')) return;
  const fid = frameOf(pts);
  const gl = glintsOf(kind, look, fid);
  const m = affine(pts, FRAMES[fid]);
  const img = sparkleOf(kind, look.light, stepOf(zoom), dpr);
  const alpha = g.globalAlpha;
  for (let i = 0; i < gl.length; i++) {
    const [gx, gy, r] = gl[i];
    const beat = 0.5 + 0.5 * Math.sin(t * 1.7 + hash2(x, y * 7 + i, 653) * 40);
    g.globalAlpha = alpha * (1 - TWINKLE * beat * beat);
    const s = (r / SPARK) * zoom;
    g.drawImage(img, m[0] * gx + m[2] * gy + m[4] - SPARK * s, m[1] * gx + m[3] * gy + m[5] - SPARK * s, SPARK * 2 * s, SPARK * 2 * s);
  }
  g.globalAlpha = alpha;
}

/* ---- what lights ----------------------------------------------------------------- */

/** A pool of a light on the ground, painted once per light: full at its middle, nothing at its edge. */
const pools = new Map<string, HTMLCanvasElement>();
function poolOf(light: string): HTMLCanvasElement {
  let c = pools.get(light);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, css(hex(light), 1));
  gr.addColorStop(1, css(hex(light), 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  pools.set(light, c);
  return c;
}

/** How far a seam's pool of light reaches at zoom one, across; up and down it is a little over half that. */
const poolReach = (look: VeinLook): number => (look.family === 'rare' ? 38 : 26);
const POOL_FLAT = 0.55;
/** A seam lit this much or more throws a pool of its light round it, inside its tile; one lit less shows its lit layer alone. */
const POOL_FROM = 0.5;
const pooled = (look: VeinLook): boolean => look.emit >= POOL_FROM;

/** The middle of a tile from its corners. */
const midOf = (pts: ArrayLike<number>): P => [(pts[0] + pts[2] + pts[4] + pts[6]) / 4, (pts[1] + pts[3] + pts[5] + pts[7]) / 4];

/** A pool of a seam's light on the ground round the middle of its tile, laid `lighter`, `a` strong. */
function veinPool(g: Ctx, kind: number, pts: ArrayLike<number>, zoom: number, a: number): void {
  const look = veinLook(kind);
  if (!look || a <= 0) return;
  const [sx, sy] = midOf(pts);
  const r = zoom * poolReach(look);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha *= a;
  g.drawImage(poolOf(look.light), sx - r, sy - r * POOL_FLAT, r * 2, r * 2 * POOL_FLAT);
  g.restore();
}

/** A seam's lit layer -- its mark, its fissure, its embers -- laid on its tile: what of it shows through the night. */
function veinShine(g: Ctx, x: number, y: number, kind: number, pts: ArrayLike<number>, zoom: number, dpr: number): void {
  if (zoom < SEAM_FROM) return;
  const fid = frameOf(pts);
  const img = bake(kind, fid, EMIT, variantOf(x, y), stepOf(zoom), dpr);
  if (img) lay(g, img, pts, fid);
}

/**
 * A seam's lit layer and a pool of its light laid straight over whatever is
 * there, `k` strong: the prospector's mark lighting a bare seam it read.
 */
export function veinLit(g: Ctx, x: number, y: number, kind: number, pts: ArrayLike<number>, zoom: number, dpr: number, k = 1): void {
  if (zoom < SEAM_FROM) return;
  veinPool(g, kind, pts, zoom, 0.3 * k);
  const a = g.globalAlpha;
  g.globalAlpha = a * Math.min(1, k * 1.1);
  veinShine(g, x, y, kind, pts, zoom, dpr);
  g.globalAlpha = a;
}

/**
 * The seams in sight that light the night, gathered as the ground is drawn
 * and laid over the night's wash, as the lava's glow is (`glowLava`): each
 * one's lit layer, with the pool of its light round it baked in where it
 * throws one (`pooled`), as strong as it lights and as dark as it is.
 *
 * Laid over rather than cut out of the wash round it, as a runestone's runes
 * are (`RunestoneNight`): a seam is the ground, a hillside of them is a
 * thousand, and the wash mixed with a hole for each, and each lit layer cut
 * out of it at the screen's pixels, cost a hillside of ore more by night than
 * the old seams cost in all. So what stands on a lit seam is lit with it.
 */
export class VeinNight {
  /** x, y, kind and the eight corner coordinates of each, eleven numbers a seam. */
  private seen: number[] = [];
  private n = 0;
  private on = false;
  private readonly pts = new Float64Array(8);

  /** A new frame: nothing gathered, and nothing at all unless it is dark enough for anything to light. */
  begin(dark: boolean): void {
    this.n = 0;
    this.on = dark;
  }

  /** A tile of seam in sight was drawn with its corners at `pts`: kept if it lights. */
  add(x: number, y: number, kind: number, pts: ArrayLike<number>): void {
    if (!this.on) return;
    const look = veinLook(kind);
    if (!look || look.emit <= 0) return;
    const o = this.n * 11;
    const s = this.seen;
    s[o] = x; s[o + 1] = y; s[o + 2] = kind;
    for (let k = 0; k < 8; k++) s[o + 3 + k] = pts[k];
    this.n++;
  }

  /** Over the wash: each seam's lit layer, its pool baked into it, under one transform set a seam. */
  glow(ctx: Ctx, zoom: number, dpr: number, dark: number): void {
    if (!this.n || zoom < SEAM_FROM || dark <= 0.02) return;
    const s = this.seen;
    const pts = this.pts;
    const step = stepOf(zoom);
    ctx.save();
    const m0 = ctx.getTransform();
    const a0 = m0.a, b0 = m0.b, c0 = m0.c, d0 = m0.d, e0 = m0.e, f0 = m0.f;
    for (let i = 0; i < this.n; i++) {
      const o = i * 11;
      for (let k = 0; k < 8; k++) pts[k] = s[o + 3 + k];
      const fid = frameOf(pts);
      const pic = bake(s[o + 2], fid, EMIT, variantOf(s[o], s[o + 1]), step, dpr);
      if (!pic) continue;
      // The tile's map after the screen's, set outright rather than saved and put back a seam at a time.
      const [a, b, c, d, e, f] = affine(pts, FRAMES[fid]);
      ctx.setTransform(a0 * a + c0 * b, b0 * a + d0 * b, a0 * c + c0 * d, b0 * c + d0 * d, a0 * e + c0 * f + e0, b0 * e + d0 * f + f0);
      ctx.globalAlpha = Math.min(1, veinLook(s[o + 2])!.emit * dark * 1.1);
      ctx.drawImage(pic.cv, pic.x, pic.y, pic.w, pic.h);
    }
    ctx.restore();
  }
}

/* ---- the prospector's mark --------------------------------------------------------- */

/**
 * The prospector's mark on a tile it read: four cut brackets at its corners
 * in the kind's light (unidentified: a pale cyan) and, where the seam is
 * buried, its mark laid flat in a ring on the ground. On bare ore the
 * recess's own mark lights instead (`veinLit`). `pts` is the tile's corners
 * clockwise from the topmost; `pulse` how strongly it is lit, nought to one.
 */
export function prospectMark(g: Ctx, pts: ArrayLike<number>, zoom: number, kind: number, bare: boolean, pulse: number): void {
  const look = veinLook(kind) ?? UNIDENTIFIED_LOOK;
  const light = hex(look.light);
  const at = (u: number, v: number): P => [
    (pts[0] * (1 - u) + pts[2] * u) * (1 - v) + (pts[6] * (1 - u) + pts[4] * u) * v,
    (pts[1] * (1 - u) + pts[3] * u) * (1 - v) + (pts[7] * (1 - u) + pts[5] * u) * v,
  ];
  const lw = Math.max(1.2, 1.6 * zoom);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const k = 0.16, e = 0.1;
  const brackets: Array<[P, P, P]> = [
    [at(e + k, e), at(e, e), at(e, e + k)],
    [at(1 - e - k, e), at(1 - e, e), at(1 - e, e + k)],
    [at(1 - e, 1 - e - k), at(1 - e, 1 - e), at(1 - e - k, 1 - e)],
    [at(e, 1 - e - k), at(e, 1 - e), at(e + k, 1 - e)],
  ];
  for (const [a, b, c] of brackets) {
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.strokeStyle = css(mix(light, INK, 0.75), 0.9);
    g.lineWidth = lw * 2.4;
    g.stroke();
    g.strokeStyle = css(light, pulse);
    g.lineWidth = lw * 1.3;
    g.stroke();
    g.strokeStyle = css(mix(light, CREAM, 0.7), pulse);
    g.lineWidth = lw * 0.5;
    g.stroke();
  }
  if (!bare) {
    g.beginPath();
    for (let i = 0; i <= 32; i++) {
      const [x, y] = at(0.5 + Math.cos((i / 32) * TAU) * 0.27, 0.5 + Math.sin((i / 32) * TAU) * 0.27);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = css(light, 0.16 * pulse);
    g.fill();
    g.strokeStyle = css(mix(light, INK, 0.6), 0.6);
    g.lineWidth = lw * 2;
    g.stroke();
    g.strokeStyle = css(light, 0.95 * pulse);
    g.lineWidth = lw;
    g.stroke();
    g.beginPath();
    for (const st of look.mark) {
      st.pts.forEach(([px, py], i) => {
        const [X, Y] = at(0.5 + px * 0.15, 0.5 + py * 0.15);
        if (i) g.lineTo(X, Y);
        else g.moveTo(X, Y);
      });
      if (st.closed) g.closePath();
    }
    g.strokeStyle = css(light, 0.35 * pulse);
    g.lineWidth = lw * 3;
    g.stroke();
    g.strokeStyle = css(light, pulse);
    g.lineWidth = lw * 1.3;
    g.stroke();
    g.strokeStyle = css(mix(light, CREAM, 0.75), pulse);
    g.lineWidth = lw * 0.5;
    g.stroke();
  }
  g.restore();
}
