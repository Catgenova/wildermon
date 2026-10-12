import { FRAMES, frameCrystals, frameLamps } from './runecut-frames';

/**
 * Small life on Runecut's frames: animals and lights that go about each
 * frame's band, drawn over the windows on one canvas (`RunecutArt`), with
 * nothing kept between frames. Every one is a function of the clock and the
 * window's seed, so it is wherever it would be at that moment however often
 * it is drawn, and a window opened late joins in where the rest are.
 *
 * Kept to the band and what stands past it, never over what is inside a
 * window; taking no clicks; not drawn at all on a phone's screen, with Fast
 * graphics, with the setting off, or when the system asks for less motion.
 */

/** What the island says, for the ones that answer to it. */
export interface LifeWorld {
  /** Runecut's stone after dark. */
  night: boolean;
  /** The island's season is winter. */
  winter: boolean;
  /** Something is being made from a recipe now. */
  crafting: boolean;
  /** Favour held, as a share of what can be held, 0 to 1. */
  favour: number;
  /** A treasure map is in the pack: its hoard is still in the ground. */
  map: boolean;
}

/** One piece to draw on: its frame, its box in interface pixels, its band and reach. */
export interface LifePiece {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  F: number;
  R: number;
  seed: number;
}

/** How big the animals are drawn, against the sizes their shapes are written at. */
const SIZE = 1.6;
/** Fireflies on the mossy frame after dark. */
export const FIREFLIES = 5;
/** Motes off the altar's sea glass: this many with no favour, and up to this many more at a full store. */
export const MOTES_LEAST = 2;
export const MOTES_MORE = 8;
/** Sparks off the bench while something is made. */
export const EMBERS = 6;
/** Snowflakes past each window in winter. */
export const FLAKES = 3;

/** What lives on which frame, and when: for the setting's words, under the frames' own names. */
export const LIFE: Array<{ kind: string | null; what: string }> = [
  { kind: 'wicker', what: 'two butterflies by day' },
  { kind: 'turf', what: `${FIREFLIES} fireflies after dark` },
  { kind: 'bench', what: 'a moth round the lantern after dark, and sparks while something is being made' },
  { kind: 'stall', what: 'a bee by day' },
  { kind: 'palisade', what: 'a ladybird on the foot beam' },
  { kind: 'burlap', what: 'a mouse looking out over the top' },
  { kind: 'crate', what: 'a spider on its thread' },
  { kind: 'runestone', what: 'a snail climbing a pillar' },
  { kind: 'letter', what: 'a songbird by day' },
  { kind: 'parchment', what: 'a dragonfly by day' },
  { kind: 'altar', what: `${MOTES_LEAST} motes, and up to ${MOTES_MORE} more as your favour fills` },
  { kind: 'treasure', what: 'a wisp, brighter while a treasure map is in your pack' },
  { kind: 'book', what: 'dust in a sunbeam by day' },
  { kind: 'strap', what: 'glints on the crystals after dark' },
  { kind: 'toolbelt', what: 'glints on the crystals after dark' },
  { kind: null, what: 'snow on every window in the island\'s winter' },
];

/** The life on each frame in words: "pale wood and wildflowers, two butterflies by day; …". */
export function lifeWords(): string {
  return LIFE.map((l) => (l.kind ? `${FRAMES.find((f) => f.kind === l.kind)?.label.toLowerCase() ?? l.kind}, ${l.what}` : l.what)).join('; ');
}

type Ctx = CanvasRenderingContext2D;

/** A number in 0..1 for a pair of numbers, the same every time. */
const rnd = (a: number, b = 0): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (u: number): number => u * u * (3 - 2 * u);
const clamp01 = (u: number): number => Math.max(0, Math.min(1, u));
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** A point `u` (0..1) of the way round a w × h box from its top left, clockwise, `d` out past its edge. */
function round(u: number, w: number, h: number, d: number): [number, number] {
  const L = 2 * (w + h);
  let s = ((u % 1) + 1) % 1 * L;
  if (s < w) return [s, -d];
  s -= w;
  if (s < h) return [w + d, s];
  s -= h;
  if (s < w) return [w - s, h + d];
  s -= w;
  return [-d, h - s];
}

function glow(g: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  if (a <= 0.01) return;
  const f = g.createRadialGradient(x, y, 0, x, y, r);
  f.addColorStop(0, `rgba(${rgb}, ${a})`);
  f.addColorStop(0.35, `rgba(${rgb}, ${a * 0.45})`);
  f.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = f;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A flight from `a` to `b` over an arc `lift` high, `u` of the way along. */
function arc(a: [number, number], b: [number, number], lift: number, u: number): [number, number] {
  const cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - lift;
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]];
}

/** Wings `open` (0 folded, 1 flat) on a body at the origin facing up. */
function butterfly(g: Ctx, open: number, fill: string, edge: string): void {
  const s = Math.max(0.12, open);
  for (const side of [-1, 1]) {
    g.save();
    g.scale(side * s, 1);
    g.beginPath();
    g.ellipse(3, -1.6, 3.4, 2.6, -0.5, 0, Math.PI * 2);
    g.ellipse(2.4, 2, 2.4, 1.8, 0.5, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = 0.7;
    g.stroke();
    g.restore();
  }
  g.fillStyle = '#3b2f2a';
  g.fillRect(-0.5, -3, 1, 6);
}

function butterflies(g: Ctx, p: LifePiece, t: number): void {
  const { w, h, F } = p;
  const perches: Array<[number, number]> = [
    [F * 1.2, F * 0.35], [w - F * 1.2, F * 0.35], [F * 1.5, h - F * 0.5], [w - F * 1.5, h - F * 0.5],
    [w / 2 + F * 1.6, h - F * 0.6], [F * 0.5, h * 0.4], [w - F * 0.5, h * 0.6],
  ];
  const at = (i: number, k: number): [number, number] => {
    let n = Math.floor(rnd(p.seed + i * 7, k) * perches.length);
    if (k > 0 && n === Math.floor(rnd(p.seed + i * 7, k - 1) * perches.length)) n = (n + 1) % perches.length;
    return perches[n];
  };
  [['#f3e3a0', '#b8963a'], ['#a9cbea', '#5d86b8']].forEach(([fill, edge], i) => {
    const C = 9 + i * 1.7, tt = t + i * 4.1 + p.seed % 7, k = Math.floor(tt / C), u = tt / C - k;
    const rest = 0.72;
    let x: number, y: number, open: number;
    if (u < rest) {
      [x, y] = at(i, k);
      open = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(tt * 1.3));
    } else {
      [x, y] = arc(at(i, k), at(i, k + 1), F * 2 + 20 * rnd(p.seed, k), ease((u - rest) / (1 - rest)));
      open = Math.abs(Math.sin(tt * 28));
    }
    g.save();
    g.translate(x, y - 3);
    g.scale(SIZE, SIZE);
    butterfly(g, open, fill, edge);
    g.restore();
  });
}

function fireflies(g: Ctx, p: LifePiece, t: number): void {
  for (let i = 0; i < FIREFLIES; i++) {
    const u = rnd(p.seed, i) + t * (0.004 + rnd(i, 3) * 0.004) + Math.sin(t * 0.7 + i) * 0.01;
    const [x, y] = round(u, p.w, p.h, -p.F * 0.2 + Math.sin(t * 0.9 + i * 2) * p.R * 0.7);
    const b = Math.max(0, Math.sin(t * (1.1 + rnd(i, 5)) + i * 1.7)) ** 3;
    glow(g, x, y, 7, '214, 240, 120', 0.8 * b);
    glow(g, x, y, 2, '255, 255, 200', b);
  }
}

function moth(g: Ctx, p: LifePiece, t: number): void {
  const lamp = frameLamps('bench', p.w, p.h, p.F)[0];
  if (!lamp) return;
  const C = 16, tt = t + p.seed % 5, u = (tt % C) / C * C;
  const perch: [number, number] = [lamp.x + p.F * 2.2, p.F * 0.45];
  const orbit = (s: number): [number, number] => {
    const r = p.F * 0.9 + p.F * 0.4 * Math.sin(s * 1.7) - Math.max(0, Math.sin(s * 0.9)) ** 12 * p.F * 0.6;
    return [lamp.x + Math.cos(s * 2.6) * r, lamp.y + Math.sin(s * 2.6) * r * 0.7];
  };
  let x: number, y: number, flying = true;
  if (u < 11) [x, y] = orbit(tt);
  else if (u < 12) [x, y] = arc(orbit(tt - (u - 11)), perch, 6, ease(u - 11));
  else if (u < 15.5) {
    [x, y] = perch;
    flying = false;
  } else [x, y] = arc(perch, orbit(tt), 6, ease((u - 15.5) / 0.5));
  g.save();
  g.translate(x, y);
  g.scale(SIZE, SIZE);
  if (flying) {
    butterfly(g, Math.abs(Math.sin(tt * 40)), '#b4a68f', '#6d604f');
  } else {
    g.beginPath();
    g.moveTo(0, -3);
    g.lineTo(4, 3);
    g.lineTo(-4, 3);
    g.closePath();
    g.fillStyle = '#a8997f';
    g.fill();
    g.strokeStyle = '#6d604f';
    g.lineWidth = 0.7;
    g.stroke();
  }
  g.restore();
}

function bee(g: Ctx, p: LifePiece, t: number): void {
  const { w, h, F } = p;
  const stops: Array<[number, number]> = [[w * 0.2, F * 0.5], [w * 0.5, F * 0.4], [w * 0.78, F * 0.5], [F * 0.5, h * 0.3], [w - F * 0.5, h * 0.35]];
  const at = (k: number): [number, number] => stops[Math.floor(rnd(p.seed + 3, k) * stops.length)];
  const C = 5, tt = t + p.seed % 3, k = Math.floor(tt / C), u = tt / C - k;
  let [x, y] = u < 0.6 ? at(k) : arc(at(k), at(k + 1), 14, ease((u - 0.6) / 0.4));
  if (u < 0.6) {
    x += Math.sin(tt * 5) * 2;
    y += Math.sin(tt * 7.3) * 1.5 - 4;
  }
  g.save();
  g.translate(x, y);
  g.scale(SIZE, SIZE);
  g.globalAlpha = 0.55 + 0.25 * Math.sin(tt * 60);
  g.fillStyle = '#eef4ff';
  g.beginPath();
  g.ellipse(-1.5, -2.6, 2, 1.3, -0.4, 0, Math.PI * 2);
  g.ellipse(1.5, -2.6, 2, 1.3, 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.beginPath();
  g.ellipse(0, 0, 3.2, 2.2, 0, 0, Math.PI * 2);
  g.fillStyle = '#e8b43a';
  g.fill();
  g.fillStyle = '#3a2b1c';
  g.fillRect(-1.2, -2, 0.9, 4);
  g.fillRect(0.6, -2, 0.9, 4);
  g.restore();
}

function ladybird(g: Ctx, p: LifePiece, t: number): void {
  const { w, h, F } = p;
  const lo = F * 2, span = Math.max(1, w - F * 4);
  const spot = (k: number): number => lo + span * (0.5 + 0.5 * Math.sin(k * 1.3 + p.seed));
  const C = 14, k = Math.floor(t / C), u = t - k * C;
  const a = spot(k), b = spot(k + 1);
  const x = u < 9 ? lerp(a, b, u / 9) : b;
  const open = u > 10.5 && u < 11.7 ? Math.sin(((u - 10.5) / 1.2) * Math.PI) : 0;
  const dir = b >= a ? 1 : -1;
  g.save();
  g.translate(x, h - F * 0.45);
  g.scale(dir * SIZE, SIZE);
  if (open > 0) {
    g.globalAlpha = 0.5 * open;
    g.fillStyle = '#f0f4f8';
    g.beginPath();
    g.ellipse(-1, -3, 4, 1.6, -0.6, 0, Math.PI * 2);
    g.ellipse(-1, 3, 4, 1.6, 0.6, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  for (const s of [-1, 1]) {
    g.save();
    g.rotate(s * open * 0.7);
    g.beginPath();
    g.ellipse(0, s * 1.3, 3.2, 1.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#c8322b';
    g.fill();
    g.fillStyle = '#231a18';
    g.beginPath();
    g.arc(-0.8, s * 1.5, 0.6, 0, Math.PI * 2);
    g.arc(1.2, s * 1.2, 0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#231a18';
  g.beginPath();
  g.arc(3.2, 0, 1.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function mouse(g: Ctx, p: LifePiece, t: number): void {
  const C = 22, tt = t + p.seed % 11, u = tt % C;
  if (u > 4.4) return;
  const up = u < 0.6 ? ease(u / 0.6) : u > 3.8 ? 1 - ease((u - 3.8) / 0.6) : 1;
  const x = p.w - p.F * 2.6;
  g.save();
  // Out from behind the sack's top edge: nothing of it below that edge.
  g.beginPath();
  g.rect(x - 14 * SIZE, -40, 28 * SIZE, 40.5);
  g.clip();
  g.translate(x, (8 - up * 13 + (u > 0.6 && u < 3.8 ? Math.sin(tt * 3) * 0.6 : 0)) * SIZE);
  g.scale(SIZE, SIZE);
  g.fillStyle = '#8d8178';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * 3.4, -3.6, 2.3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#e3b6b0';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * 3.4, -3.6, 1.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#9b8f85';
  g.beginPath();
  g.ellipse(0, 0, 4.2, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1d1715';
  g.beginPath();
  g.arc(-1.5, -0.6, 0.6, 0, Math.PI * 2);
  g.arc(1.5, -0.6, 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d68f8a';
  g.beginPath();
  g.arc(0, 1.6, 0.8, 0, Math.PI * 2);
  g.fill();
  const twitch = Math.sin(tt * 18) * 0.6;
  g.strokeStyle = 'rgba(60, 50, 45, 0.6)';
  g.lineWidth = 0.4;
  for (const s of [-1, 1]) {
    for (const d of [-0.6, 0.6]) {
      g.beginPath();
      g.moveTo(s * 1, 1.6);
      g.lineTo(s * 6, 1.2 + d * 2 + twitch);
      g.stroke();
    }
  }
  g.restore();
}

function spider(g: Ctx, p: LifePiece, t: number): void {
  const C = 26, tt = t + p.seed % 13, u = tt % C;
  if (u > 17) return;
  const D = Math.min(p.h * 0.35, 90), top = p.F * 0.2;
  const down = u < 6 ? ease(u / 6) : u < 11 ? 1 : 1 - ease((u - 11) / 6);
  const x = p.w - p.F * 0.5 + (u > 6 && u < 11 ? Math.sin(tt * 1.6) * 1.5 : 0), y = top + down * D;
  g.strokeStyle = 'rgba(235, 235, 240, 0.7)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(p.w - p.F * 0.5, -p.R * 0.3);
  g.lineTo(x, y);
  g.stroke();
  g.save();
  g.translate(x, y + 2.5 * SIZE);
  g.scale(SIZE, SIZE);
  g.strokeStyle = '#2a2224';
  g.lineWidth = 0.7;
  const kick = Math.sin(tt * 6) * 0.2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = (-0.9 + i * 0.6 + kick) * s;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(s * 3.5, -2 + i * 1.4, s * (4.6 + Math.cos(a)), -3 + i * 2.6);
      g.stroke();
    }
  }
  g.fillStyle = '#2a2224';
  g.beginPath();
  g.arc(0, 1.4, 2.3, 0, Math.PI * 2);
  g.arc(0, -1.2, 1.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function snail(g: Ctx, p: LifePiece, t: number): void {
  const C = 160, u = ((t + p.seed % 37) % C) / C;
  const x = p.F * 0.5, y0 = p.h - p.F * 1.5, y1 = p.h * 0.35;
  const climb = clamp01(u / 0.875), y = lerp(y0, y1, climb);
  const fade = u < 0.04 ? u / 0.04 : u > 0.875 ? 1 - (u - 0.875) / 0.125 : 1;
  const trail = g.createLinearGradient(0, y0, 0, y);
  trail.addColorStop(0, 'rgba(230, 236, 240, 0)');
  trail.addColorStop(1, `rgba(230, 236, 240, ${0.45 * fade})`);
  g.strokeStyle = trail;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x, y0);
  g.lineTo(x, y + 3);
  g.stroke();
  g.save();
  g.globalAlpha = fade;
  g.translate(x, y);
  g.scale(SIZE, SIZE);
  g.fillStyle = '#b8ad9e';
  g.beginPath();
  g.ellipse(0, 0, 1.8, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a8073';
  g.lineWidth = 0.6;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 0.5, -4);
    g.lineTo(s * 1.6, -6.6);
    g.stroke();
  }
  g.fillStyle = '#9a6a3c';
  g.beginPath();
  g.arc(0.6, 1.4, 3.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#5f3f22';
  g.lineWidth = 0.7;
  g.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.3) {
    const r = 3.2 * (1 - a / (Math.PI * 4.4));
    const px = 0.6 + Math.cos(a) * r, py = 1.4 + Math.sin(a) * r;
    if (a === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  g.restore();
}

function bird(g: Ctx, flap: number, flying: boolean): void {
  g.fillStyle = '#8a5a3c';
  g.beginPath();
  g.ellipse(0, 0, 4.6, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d99a6c';
  g.beginPath();
  g.ellipse(1.6, 1, 2.6, 2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7a4c32';
  g.beginPath();
  g.moveTo(-4, -0.6);
  g.lineTo(-8, -2.6);
  g.lineTo(-7.4, 1);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(3.8, -2.4, 2.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e0b04a';
  g.beginPath();
  g.moveTo(5.8, -2.6);
  g.lineTo(7.8, -2);
  g.lineTo(5.8, -1.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#1b1412';
  g.beginPath();
  g.arc(4.4, -2.9, 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6b422b';
  g.beginPath();
  if (flying) g.ellipse(-0.6, -1.6, 3.6, 1.4 + 2.4 * flap, -0.3 - flap, 0, Math.PI * 2);
  else g.ellipse(-0.8, -0.2, 3.4, 1.6, 0.15, 0, Math.PI * 2);
  g.fill();
}

function songbird(g: Ctx, p: LifePiece, t: number): void {
  const C = 34, tt = t + p.seed % 17, k = Math.floor(tt / C), u = tt - k * C;
  if (u < 26 || u > 33.2) return;
  const fromLeft = rnd(p.seed, k) < 0.5;
  const perch = p.w * (0.3 + 0.4 * rnd(p.seed + 1, k));
  const hop = (u > 28.5 ? 6 : 0) + (u > 30 ? 6 : 0);
  const stand: [number, number] = [perch + (fromLeft ? hop : -hop), -4 * SIZE];
  const off = (left: boolean): [number, number] => [left ? -p.R - 30 : p.w + p.R + 30, -p.R - 20];
  let x: number, y: number, flying = true;
  if (u < 27.2) [x, y] = arc(off(fromLeft), [perch, -4 * SIZE], 10, ease((u - 26) / 1.2));
  else if (u < 32) {
    [x, y] = stand;
    flying = false;
    const near = (at: number): number => Math.max(0, 1 - Math.abs(u - at) / 0.2);
    y -= 3 * Math.max(near(28.5), near(30));
  } else [x, y] = arc(stand, off(!fromLeft), 10, ease((u - 32) / 1.2));
  const face = flying ? (u < 27.2 ? (fromLeft ? 1 : -1) : fromLeft ? 1 : -1) : fromLeft ? 1 : -1;
  g.save();
  g.translate(x, y);
  g.scale(face * SIZE, SIZE);
  if (!flying) g.rotate(Math.sin(tt * 2.1) > 0.85 ? -0.25 : 0);
  bird(g, Math.abs(Math.sin(tt * 22)), flying);
  g.restore();
}

function dragonfly(g: Ctx, p: LifePiece, t: number): void {
  const C = 24, tt = t + p.seed % 9, k = Math.floor(tt / C), u = tt - k * C;
  if (u > 6) return;
  const ltr = rnd(p.seed, k) < 0.5;
  const at = (j: number): [number, number] => {
    const s = j / 6;
    return [p.F + (p.w - p.F * 2) * (ltr ? s : 1 - s) + (rnd(p.seed + j, k) - 0.5) * 20, -p.F * 0.3 - rnd(j, k + 1) * p.R * 0.8];
  };
  const j = Math.floor(u), f = u - j;
  const a = at(j), b = at(j + 1);
  const m = f < 0.25 ? ease(f / 0.25) : 1;
  const x = lerp(a[0], b[0], m) + (f >= 0.25 ? Math.sin(tt * 9) * 0.8 : 0), y = lerp(a[1], b[1], m);
  const fade = u < 0.3 ? u / 0.3 : u > 5.7 ? (6 - u) / 0.3 : 1;
  g.save();
  g.globalAlpha = fade;
  g.translate(x, y);
  g.scale((b[0] >= a[0] ? 1 : -1) * SIZE, SIZE);
  g.fillStyle = `rgba(225, 240, 250, ${0.45 + 0.3 * Math.sin(tt * 50)})`;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(1.2, s * 3, 4.2, 1.1, s * 0.25, 0, Math.PI * 2);
    g.ellipse(-0.6, s * 3, 3.8, 1, -s * 0.25, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#2f8f8a';
  g.fillRect(-8, -0.6, 10, 1.2);
  g.beginPath();
  g.arc(2.6, 0, 1.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function motes(g: Ctx, p: LifePiece, t: number, favour: number): void {
  const n = MOTES_LEAST + Math.round(clamp01(favour) * MOTES_MORE);
  for (let i = 0; i < n; i++) {
    const C = 4 + rnd(i, 2) * 2, tt = t + rnd(p.seed, i) * C, k = Math.floor(tt / C), u = tt / C - k;
    // Up off the sides and the foot, from just past the sea glass, where they show against the ground.
    const [x0, y0] = round(0.3 + rnd(i, k) * 0.7, p.w, p.h, p.R * 0.4);
    const x = x0 + Math.sin(tt * 1.3 + i) * 3, y = y0 - u * 28;
    // Gold round a pearl core: favour's colour, and one that shows on pale stone and dark ground alike.
    const a = Math.sin(u * Math.PI);
    glow(g, x, y, 8, '236, 178, 72', 0.8 * a);
    glow(g, x, y, 2.4, '255, 252, 236', a);
  }
}

function wisp(g: Ctx, p: LifePiece, t: number, map: boolean): void {
  const u = t / 40 + rnd(p.seed);
  const [x, y] = round(u, p.w, p.h, p.R * 0.2 + Math.sin(t * 0.8) * p.F * 0.3);
  const a = (map ? 0.85 : 0.3) * (0.75 + 0.25 * Math.sin(t * 2.3));
  glow(g, x, y, 15, '90, 160, 235', a);
  glow(g, x, y, 3, '235, 248, 255', a);
}

function sunbeam(g: Ctx, p: LifePiece, t: number): void {
  const { F, R } = p;
  const A: [number, number] = [-R * 0.5, -R], B: [number, number] = [F * 1.6, -R], C: [number, number] = [F * 2.6, F * 1.6], D: [number, number] = [F * 0.6, F * 1.6];
  const breathe = 0.65 + 0.35 * Math.sin(t * 0.35);
  g.save();
  g.beginPath();
  g.moveTo(...A);
  g.lineTo(...B);
  g.lineTo(...C);
  g.lineTo(...D);
  g.closePath();
  const f = g.createLinearGradient(0, -R, F * 0.8, F * 1.6);
  f.addColorStop(0, `rgba(255, 206, 120, ${0.6 * breathe})`);
  f.addColorStop(1, `rgba(255, 206, 120, ${0.12 * breathe})`);
  g.fillStyle = f;
  g.fill();
  g.clip();
  for (let i = 0; i < 8; i++) {
    const s = rnd(p.seed, i), v = rnd(i, 9);
    const x = lerp(-R * 0.2, F * 2, (s + t * 0.01 * (0.5 + v)) % 1) + Math.sin(t * 0.6 + i) * 3;
    const y = lerp(-R * 0.8, F * 1.4, (v + t * 0.015 * (0.4 + s)) % 1);
    // Gold motes, which catch the eye on pale stone and on the dark ground alike.
    g.fillStyle = `rgba(214, 160, 70, ${0.55 + 0.4 * Math.sin(t * 2 + i * 1.7)})`;
    g.beginPath();
    g.arc(x, y, 1.4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function embers(g: Ctx, p: LifePiece, t: number): void {
  for (let i = 0; i < EMBERS; i++) {
    const C = 1.6, tt = t + rnd(p.seed, i) * C, k = Math.floor(tt / C), u = tt / C - k;
    const x = p.F + (p.w - p.F * 2) * rnd(i, k) + Math.sin(tt * 4 + i) * 3, y = p.h - p.F * 0.5 - u * 36;
    glow(g, x, y, 5, u < 0.5 ? '255, 196, 90' : '240, 110, 50', 0.9 * (1 - u));
    glow(g, x, y, 1.6, '255, 240, 200', 1 - u);
  }
}

function glints(g: Ctx, p: LifePiece, t: number): void {
  const at = frameCrystals(p.kind, p.w, p.h, p.F);
  if (!at.length) return;
  const C = 2.5, k = Math.floor(t / C), u = (t - k * C) / 0.9;
  if (u > 1) return;
  const c = at[Math.floor(rnd(p.seed, k) * at.length)];
  const s = Math.sin(u * Math.PI), L = c.r * 1.8 * s;
  g.strokeStyle = `rgba(255, 255, 255, ${0.9 * s})`;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(c.x - L, c.y);
  g.lineTo(c.x + L, c.y);
  g.moveTo(c.x, c.y - L);
  g.lineTo(c.x, c.y + L);
  g.stroke();
  glow(g, c.x, c.y, c.r * 1.2, '220, 236, 255', 0.6 * s);
}

function snow(g: Ctx, p: LifePiece, t: number): void {
  // A dusting along the top edge, lumpy, the same lumps every frame.
  g.fillStyle = 'rgba(250, 252, 255, 0.92)';
  g.beginPath();
  g.moveTo(p.F * 0.3, 0.5);
  for (let x = p.F * 0.3; x <= p.w - p.F * 0.3; x += 4) g.lineTo(x, -1.2 - rnd(p.seed + x) * 1.8);
  g.lineTo(p.w - p.F * 0.3, 0.5);
  g.closePath();
  g.fill();
  for (let i = 0; i < FLAKES; i++) {
    const C = 9, tt = t + rnd(p.seed, i) * C, k = Math.floor(tt / C), u = tt / C - k;
    const side = rnd(i, k) < 0.5;
    const x = (side ? -p.R * 0.6 : p.w + p.R * 0.6) + Math.sin(tt * 1.4 + i) * 4;
    const y = lerp(-p.R, p.h + p.R, u);
    g.fillStyle = 'rgba(250, 252, 255, 0.85)';
    g.beginPath();
    g.arc(x, y, 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** Whatever lives on this piece's frame now, drawn in the piece's own place. */
export function paintLife(g: Ctx, p: LifePiece, t: number, world: LifeWorld): void {
  g.save();
  g.translate(p.x, p.y);
  const day = !world.night;
  switch (p.kind) {
    case 'wicker':
      if (day) butterflies(g, p, t);
      break;
    case 'turf':
      if (!day) fireflies(g, p, t);
      break;
    case 'bench':
      if (!day) moth(g, p, t);
      if (world.crafting) embers(g, p, t);
      break;
    case 'stall':
      if (day) bee(g, p, t);
      break;
    case 'palisade':
      ladybird(g, p, t);
      break;
    case 'burlap':
      mouse(g, p, t);
      break;
    case 'crate':
      spider(g, p, t);
      break;
    case 'runestone':
      snail(g, p, t);
      break;
    case 'letter':
      if (day) songbird(g, p, t);
      break;
    case 'parchment':
      if (day) dragonfly(g, p, t);
      break;
    case 'altar':
      motes(g, p, t, world.favour);
      break;
    case 'treasure':
      wisp(g, p, t, world.map);
      break;
    case 'book':
      if (day) sunbeam(g, p, t);
      break;
    case 'strap':
    case 'toolbelt':
      if (!day) glints(g, p, t);
      break;
  }
  if (world.winter) snow(g, p, t);
  g.restore();
}
