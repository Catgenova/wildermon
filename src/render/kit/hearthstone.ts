import { rand } from '../ivy';
import { cut } from '../runestone';
import {
  css, hex, mix, sub, TAU, toneOf,
  type Ctx, type KitPart, type RGB, type Side, type Tone, type V3,
} from './core';

/**
 * What the pieces that burn and the pieces of ceremony share in the kit: the
 * forge's stones, dressed stone laid in courses on a flat side or round a
 * turned one, a fire's tongues and its glow, and room kept for what is drawn
 * live over a piece (an altar's stars, a banner's cloth) so it is measured
 * and clicked as tall as it stands.
 */

/* ---- the forge's stones ------------------------------------------------------ */

/** The smelter's and kiln's cream stone: a body laid in courses. */
export const STONE: Tone = toneOf('#ecd6c0', '#a68f94');
/** The paler dressings: jambs, voussoirs, a capital, a slab. */
export const DRESSED: Tone = toneOf('#f3e2cc', '#b29da0');
/** A step deeper, for a plinth or a footing. */
export const FOOTING: Tone = toneOf('#d9c8b5', '#978690');
/** The kiln's dome stone, a hair cooler. */
export const DOME: Tone = toneOf('#eedecb', '#aa9eac');
/** A fire, from its white heart out to its dark red edge (the smelter's). */
export const FIRE: Array<[number, string]> = [[0, '#fff7d6'], [0.22, '#ffdc86'], [0.5, '#ffa252'], [0.8, '#e0663c'], [1, '#97384a']];

/* ---- dressed stone ------------------------------------------------------------- */

/** The grit and pits of a stone side `w` by `h`: soft pale and lilac flecks, sparse (`skin` in forge.ts). */
export function speckle(g: Ctx, fill: RGB, w: number, h: number, seed: number, k = 1): void {
  const T = rand(seed);
  for (let i = 0; i < Math.round(w * h * 0.12 * k) + 1; i++) {
    g.beginPath();
    g.ellipse(T() * w, T() * h, 0.4 + T() * 1.1, 0.25 + T() * 0.6, (T() - 0.5) * 0.8, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.32) : css(mix(fill, hex('#9c94a4'), 0.3), 0.24);
    g.fill();
  }
  g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.28);
  for (let i = 0; i < Math.round(w * h * 0.35 * k); i++) g.fillRect(T() * w, Math.pow(T(), 1.5) * h, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
}

/**
 * Dressed stone laid in courses up a flat side `w` by `h` (`ashlar` in
 * forge.ts): each course its own height, each stone its own length and a
 * hair its own tint, the joints cut in. `skip` leaves out a stone (where an
 * opening is).
 */
export function ashlar(g: Ctx, fill: RGB, w: number, h: number, seed: number, course: number, skip?: (x0: number, x1: number, z0: number, z1: number) => boolean): void {
  const T = rand(seed);
  let z = 0, row = 0;
  while (z < h - 0.25) {
    const ch = Math.min(h - z, course * (0.86 + 0.28 * T()));
    const quoin = row % 2 ? 1.4 + 0.4 * T() : 2.4 + 0.5 * T();
    const stones: Array<[number, number]> = [[0, Math.min(w, quoin)]];
    let x = quoin;
    while (x < w - 1.4) {
      const len = Math.min(w - x, 2.2 + T() * 2.6);
      stones.push([x, x + len]);
      x += len;
    }
    if (x < w) stones[stones.length - 1][1] = w + 1;
    stones.forEach(([a0, a1], j) => {
      if (skip?.(a0, a1, z, z + ch)) return;
      g.fillStyle = j === 0 || j === stones.length - 1 ? css(mix(fill, [255, 250, 240], 0.18), 0.55)
        : T() < 0.5 ? css(mix(fill, [255, 250, 240], 0.08 + 0.12 * T()), 0.5) : css(mix(fill, hex('#9a8ea4'), 0.08 + 0.12 * T()), 0.42);
      g.fillRect(a0 + 0.13, z + 0.13, a1 - a0 - 0.26, ch - 0.26);
      if (j > 0) cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(a0, z + 0.1); g.lineTo(a0, z + ch - 0.1); });
    });
    z += ch;
    row++;
    if (z < h - 0.2) cut(g, fill, 0.16, () => { g.beginPath(); g.moveTo(-1, z); g.lineTo(w + 1, z); });
  }
}

/**
 * Stone in courses round a turned solid, on side `i` of it (`coursed` in
 * forge.ts): the bed joints at the same heights all the way round, every
 * `course` up from the floor, and a stone to a side, each course set half a
 * side round from the one under it, as a running bond. `soft`: a brick
 * dome's joints, a line a step into the stone's shade with no lit lip.
 */
export function ringCourses(g: Ctx, fill: RGB, s: Side, i: number, seed: number, course: number, joint = 0.13, soft = false): void {
  const T = rand(seed);
  const z0 = s.o[2];
  // How wide the side is at its head, from its corners: a turned side narrows (or widens) as it rises.
  const [p0, p1, p2, p3] = s.poly;
  const topW = Math.hypot(...sub(p2, p3));
  const wAt = (z: number): number => s.w + (topW - s.w) * Math.max(0, Math.min(1, z / Math.max(1e-6, s.h)));
  const xAt = (f: number, z: number): number => (s.w - wAt(z)) / 2 + f * wAt(z);
  void p0; void p1;
  const line = (path: () => void, w: number): void => {
    if (!soft) { cut(g, fill, w, path); return; }
    path();
    g.strokeStyle = css(mix(fill, hex('#8a7e98'), 0.6), 0.7);
    g.lineWidth = w;
    g.stroke();
  };
  for (let n = Math.floor(z0 / course); n * course < z0 + s.h; n++) {
    const a = Math.max(0, n * course - z0), b = Math.min(s.h, (n + 1) * course - z0);
    if (b - a < 0.08) continue;
    const zm = (a + b) / 2;
    const cuts = (n + i) % 2 ? [0, 0.5, 1] : [0, 1];
    for (let j = 0; j + 1 < cuts.length; j++) {
      const x0 = xAt(cuts[j], zm), x1 = xAt(cuts[j + 1], zm);
      const r = T();
      g.fillStyle = r < 0.5 ? css(mix(fill, [255, 250, 240], 0.08 + 0.12 * T()), 0.45) : css(mix(fill, hex('#9a8ea4'), 0.06 + 0.1 * T()), 0.4);
      g.fillRect(x0 + 0.1, a + 0.1, x1 - x0 - 0.2, b - a - 0.2);
    }
    if (b < s.h - 0.05) line(() => { g.beginPath(); g.moveTo(-1, b); g.lineTo(s.w + 1, b); }, joint);
    const heads = (n + i) % 2 ? [0.5] : [0];
    for (const f of heads) line(() => { g.beginPath(); g.moveTo(xAt(f, a), a + 0.06); g.lineTo(xAt(f, b), b - 0.06); }, joint * 0.9);
  }
}

/** A turned side away from the light washed in the kit's lilac, as the kiln's dome is, so its round turns. */
export function lilac(g: Ctx, L: number, w: number, h: number): void {
  const away = Math.max(0, Math.min(1, (0.97 - L) / 0.2));
  if (away <= 0.02) return;
  g.fillStyle = css(hex('#aa9eac'), 0.3 * away);
  g.fillRect(-1, -1, w + 2, h + 2);
}

/* ---- fire ------------------------------------------------------------------------- */

/** A warm glow round (x, y), `r` across, `a` strong at its heart: the light a fire throws on what is round it. */
export function glow(g: Ctx, x: number, y: number, r: number, a: number, colour = '255, 196, 120'): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${colour}, ${a})`);
  gr.addColorStop(0.45, `rgba(${colour}, ${a * 0.35})`);
  gr.addColorStop(1, `rgba(${colour}, 0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * A fire's tongues standing up off (x, y), `w` across and `h` high, in
 * whatever units the context is in: five licks, the outer ones the deep
 * orange and the middle ones paler up to a white heart, each with a soft
 * darker edge so it holds on pale stone.
 */
export function flame(g: Ctx, x: number, y: number, w: number, h: number, seed = 1): void {
  const T = rand(seed);
  const tongue = (dx: number, hw: number, hh: number, lean: number, fill: string): void => {
    const bx = x + dx * w;
    g.beginPath();
    g.moveTo(bx - hw * w, y);
    g.bezierCurveTo(bx - hw * w, y - hh * h * 0.55, bx + (lean - hw * 0.35) * w, y - hh * h * 0.72, bx + lean * w, y - hh * h);
    g.bezierCurveTo(bx + (lean + hw * 0.3) * w, y - hh * h * 0.62, bx + hw * w, y - hh * h * 0.45, bx + hw * w, y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const j = (): number => 0.85 + 0.3 * T();
  g.save();
  g.lineJoin = 'round';
  // The deep red rim of the whole of it, under the licks.
  g.globalAlpha = 0.9;
  tongue(-0.4, 0.46, 0.7 * j(), -0.2, '#c9503c');
  tongue(0.38, 0.46, 0.78 * j(), 0.16, '#c9503c');
  g.globalAlpha = 1;
  tongue(-0.4, 0.4, 0.66 * j(), -0.2, '#ee7f3a');
  tongue(0.38, 0.4, 0.74 * j(), 0.16, '#ee7f3a');
  tongue(0, 0.58, 0.98, -0.04, '#f6a44a');
  tongue(-0.05, 0.36, 0.64, 0.06, '#ffd27e');
  tongue(0.02, 0.18, 0.34, 0, '#fff2cc');
  g.restore();
}

/* ---- room for what is drawn live ----------------------------------------------- */

/**
 * Room kept for what is drawn over a piece each frame: a solid of two faces
 * turned straight down, so never seen, at the foot and head of the box --
 * counted in how tall the piece stands and where it is clicked, and laid
 * first so it never comes into the order of the rest.
 */
export function room(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): KitPart {
  const quad = (z: number): V3[] => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  const none: Tone = { lit: [0, 0, 0], shade: [0, 0, 0] };
  return { faces: [{ pts: quad(z0), n: [0, 0, -1], tone: none }, { pts: quad(z1), n: [0, 0, -1], tone: none }], first: true, solid: true, ink: 0 };
}
