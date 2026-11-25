/**
 * What grows on old stone: moss in domed cushions, lichen in lobed crusts,
 * ferns in arching fronds, grass in tufts and wildflowers on their stems --
 * each kind painted as a thing of its own, laid where it would take, spread
 * from where it took root, and dressed for the season. The Unity client grows
 * the same (its `Growth.cs`, number for number: the same faces grow the same
 * growth there).
 *
 * **Where it would take.** Every point of a face is as damp and as lit as
 * where it is: water near it, a face turned from the sun (the south-east) or
 * shut in an alley, the splash at a wall's foot, the drips down from a
 * covered head and under a window's sill, the shelter of an inside corner.
 * Moss takes the damp and the shade; lichen the dry and the sun; ferns a damp
 * foot; grass and flowers a foot or an open top with some light.
 *
 * **Spread from where it took root.** Each kind roots first at a few of the
 * face's best places and spreads out from them day by day: a spot is reached
 * the later the worse it suits and the further it is from a root, and grows
 * to its size over the days after. A day only adds to the last.
 *
 * **Dressed for the season.** Fresh in spring, dry-tipped in summer, bronze
 * ferns, straw grass and asters in autumn, dark moss and withered fronds in
 * winter, no flowers.
 *
 * Everything here is in metres on the face, `u` along it and `v` up it (or
 * across a top), `v` growing upward: the caller sets the context so a metre
 * of the face is where it is on the screen or in a picture.
 */
import type { Keep } from './ivy';

type Ctx = CanvasRenderingContext2D;
export type GrowthSeason = 'spring' | 'summer' | 'autumn' | 'winter';

/** A face growth can take on: a wall's side, its top, a part of a bridge. */
export interface GrowthFace {
  /** Metres along it and up it (across a top). */
  width: number;
  height: number;
  /** Days since it was built or scrubbed (not capped), its sun (0 to 1), how wet its ground is (0 to 1). */
  days: number;
  sun: number;
  wet: number;
  /** It stands on the ground; it is a top; its head is covered (drips run down from it). */
  foot: boolean;
  top: boolean;
  drip: boolean;
  /** An inside corner's shelter at its start and its end. */
  cornerA: number;
  cornerB: number;
  /** Openings, as shares of its width and height. */
  keep?: readonly Keep[];
  /** Its outline in metres (u, v), when it is not the whole rectangle. */
  outline?: ReadonlyArray<[number, number]>;
  seed: number;
}

/* ---- the numbers -------------------------------------------------------------------------------------- */

/** The hash both clients share (ivy.ts `hashOf`, exact in 32 bits for any whole numbers, as Unity's `WallIvy.HashOf`). */
export function hashI(a: number, b: number, c: number, salt: number): number {
  let k = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(salt | 0, 1442695041)) | 0;
  k = Math.imul(k ^ (k >>> 13), 1274126177);
  k = Math.imul(k ^ (k >>> 16), 2654435761 | 0);
  return ((k ^ (k >>> 15)) >>> 0) / 4294967296;
}
const H = hashI;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);
const css = (c: number[]): string => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
/** An int's wrap, as Unity's unchecked `int` arithmetic. */
const wrap = (x: number): number => x | 0;

// ivy.ts MOSS: dark, underside, body, light
const MOSS_DARK = [0x4a / 255, 0x71 / 255, 0x56 / 255];
const MOSS_UNDER = [0x61 / 255, 0x8f / 255, 0x6a / 255];
const MOSS_FILL = [0x7d / 255, 0xad / 255, 0x7d / 255];
const MOSS_LIT = [0xa2 / 255, 0xcd / 255, 0x93 / 255];

type Kind = 'moss' | 'lichen' | 'fern' | 'grass' | 'flower';

/** A season's turn on a colour: spring fresher, summer as it is, autumn warmer, winter darker and dulled. */
function seasoned(c: number[], season: GrowthSeason, k: Kind): number[] {
  switch (season) {
    case 'spring': return mix(c, [c[0] * 0.95, Math.min(1, c[1] * 1.1), c[2] * 0.85], 0.6);
    case 'summer': return c;
    case 'autumn':
      if (k === 'fern') return mix(c, [0.72, 0.48, 0.22], 0.75);
      if (k === 'grass') return mix(c, [0.74, 0.66, 0.38], 0.6);
      return mix(c, [c[0] * 1.05, c[1] * 0.95, c[2] * 0.8], 0.5);
    default:
      if (k === 'fern') return mix(c, [0.46, 0.36, 0.24], 0.85);
      if (k === 'grass') return mix(c, [0.66, 0.6, 0.44], 0.75);
      if (k === 'lichen') return c.map((v) => v * 0.92);
      return mix(c, [c[0] * 0.8, c[1] * 0.82, c[2] * 0.75], 0.7);
  }
}

/* ---- where it would take ------------------------------------------------------------------------------ */

function damp(f: GrowthFace, u: number, v: number): number {
  if (f.top) {
    const mid = 1 - Math.abs(v / Math.max(0.01, f.height) - 0.5) * 2;
    return clamp01(0.3 + 0.3 * f.wet + 0.35 * (1 - f.sun) + 0.1 * mid);
  }
  const splash = f.foot ? clamp01(1 - v / 0.7) : 0;
  let drip = 0;
  if (f.drip) {
    const col = Math.floor(u / 0.32);
    const reach = 0.3 + 1.4 * H(col, f.seed, 3, 211);
    if (H(col, f.seed, 4, 211) > 0.45) drip = clamp01(1 - (f.height - v) / reach);
  }
  for (const k of f.keep ?? []) {
    if (k.k0 < 0.08) continue;
    const sill = k.k0 * f.height;
    if (u < k.t0 * f.width || u > k.t1 * f.width || v > sill) continue;
    const col = Math.floor(u / 0.18);
    if (H(col, f.seed, 5, 223) > 0.4) drip = Math.max(drip, clamp01(1 - (sill - v) / (0.4 + 0.6 * H(col, f.seed, 6, 223))));
  }
  const corner = Math.max(f.cornerA * clamp01(1 - u / 0.45), f.cornerB * clamp01(1 - (f.width - u) / 0.45));
  return clamp01(0.18 * f.wet + 0.4 * (1 - f.sun) + 0.55 * splash + 0.6 * drip + 0.45 * corner);
}

function suit(k: Kind, f: GrowthFace, u: number, v: number, season: GrowthSeason): number {
  const d = damp(f, u, v);
  switch (k) {
    case 'moss': return clamp01((d - 0.22) / 0.6);
    case 'lichen': {
      const high = f.top ? 1 : clamp01(v / Math.max(0.5, f.height));
      return clamp01((0.25 + 0.75 * f.sun) * (1 - 0.8 * d) * (0.5 + 0.5 * high));
    }
    case 'fern':
      if (f.top || !f.foot) return 0;
      return clamp01((d - 0.4) / 0.4) * clamp01(1 - f.sun * 0.6);
    case 'grass':
      if (f.top) return 0.3 + 0.5 * f.sun;
      return f.foot ? 0.35 + 0.4 * f.sun : 0;
    default:
      if (season === 'winter') return 0;
      if (f.top) return f.sun * 0.9;
      return f.foot ? f.sun * 0.75 : 0;
  }
}

function onStone(f: GrowthFace, u: number, v: number): boolean {
  if (u < 0 || u > f.width || v < 0 || v > f.height) return false;
  for (const k of f.keep ?? []) {
    if (u > k.t0 * f.width - 0.03 && u < k.t1 * f.width + 0.03 && v > k.k0 * f.height - 0.03 && v < k.k1 * f.height + 0.03) return false;
  }
  const o = f.outline;
  if (o && o.length >= 3) {
    let inside = false;
    for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
      const [ax, ay] = o[i], [bx, by] = o[j];
      if ((ay > v) !== (by > v) && u < ((bx - ax) * (v - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (!inside) return false;
  }
  return true;
}

/* ---- how each kind spreads ----------------------------------------------------------------------------- */

interface Habit { spacing: number; settle: number; speed: number; grow: number; nuclei: number; most: number; salt: number }
const HABITS: Record<Kind, Habit> = {
  moss: { spacing: 0.1, settle: 6, speed: 0.05, grow: 6, nuclei: 3, most: 34, salt: 301 },
  lichen: { spacing: 0.3, settle: 22, speed: 0.04, grow: 20, nuclei: 3, most: 8, salt: 307 },
  fern: { spacing: 0.55, settle: 10, speed: 0.08, grow: 9, nuclei: 2, most: 4, salt: 311 },
  grass: { spacing: 0.22, settle: 5, speed: 0.15, grow: 5, nuclei: 3, most: 6, salt: 313 },
  flower: { spacing: 0.3, settle: 9, speed: 0.1, grow: 4, nuclei: 2, most: 6, salt: 317 },
};
/** Metres at least between a kind's roots on a face, so it takes in more than one place (a wall's foot and its drips). */
const ROOTS_APART = 0.9;
/** A tile's side, in metres, and a storey: what a face's share of the most is reckoned against. */
const TILE_M = 4;

export interface Taken { u: number; v: number; grown: number; suit: number; id: number }

/** The places a kind has taken on a face, and how grown each is (0 to 1). */
function taken(k: Kind, f: GrowthFace, season: GrowthSeason): Taken[] {
  const h = HABITS[k];
  const footOnly = (k === 'fern' || k === 'grass' || k === 'flower') && !f.top;
  const rows = footOnly ? 1 : Math.max(1, Math.round(f.height / h.spacing));
  const cols = Math.max(1, Math.round(f.width / h.spacing));
  const tries: Array<{ s: number; u: number; v: number }> = [];
  for (let i = 0; i < 12; i++) {
    const u = H(f.seed, i, 1, h.salt) * f.width;
    const v = footOnly ? 0.05 : H(f.seed, i, 2, h.salt) * f.height;
    if (!onStone(f, u, Math.max(0.01, v))) continue;
    tries.push({ s: suit(k, f, u, v, season) + 0.15 * H(f.seed, i, 3, h.salt), u, v });
  }
  tries.sort((a, b) => b.s - a.s);
  // the roots spread over the face: the best place, then the next best at least ROOTS_APART from any taken
  const roots: Array<{ s: number; u: number; v: number }> = [];
  for (const t of tries) {
    if (roots.length >= h.nuclei || t.s <= 0.15) break;
    if (roots.every((p) => Math.hypot(p.u - t.u, p.v - t.v) >= ROOTS_APART)) roots.push(t);
  }
  if (!roots.length) return [];
  let most = Math.round(h.most * Math.max(0.5, (f.width * f.height) / (TILE_M * 3)) * (f.top ? 0.5 : 1));
  if (footOnly) most = Math.round(h.most * Math.max(0.5, f.width / TILE_M));
  const out: Array<Taken & { root: number }> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = r * 1000 + c;
    const u = ((c + 0.15 + 0.7 * H(f.seed, id, 7, h.salt)) / cols) * f.width;
    const v = footOnly ? 0 : ((r + 0.15 + 0.7 * H(f.seed, id, 8, h.salt)) / rows) * f.height;
    if (!onStone(f, u, footOnly ? 0.02 : v)) continue;
    const s = suit(k, f, u, v, season);
    if (s <= 0.08) continue;
    if (k === 'moss' && s < 0.25) continue;
    let near = Infinity, root = 0;
    roots.forEach((p, i) => { const d = Math.hypot(p.u - u, p.v - v); if (d < near) { near = d; root = i; } });
    const reached = (1 - s) * h.settle + near / h.speed + 2.5 * H(f.seed, id, 9, h.salt);
    if (f.days <= reached) continue;
    out.push({ u, v, grown: clamp01((f.days - reached) / h.grow), suit: s, id, root });
  }
  if (out.length <= most) return out;
  // the most a face carries, shared between its colonies: each its best grown, in turn
  const by = roots.map((_, i) => out.filter((t) => t.root === i).sort((a, b) => b.grown + b.suit - (a.grown + a.suit)));
  const kept: Taken[] = [];
  for (let k = 0; kept.length < most; k++) {
    let any = false;
    for (const l of by) if (k < l.length && kept.length < most) { kept.push(l[k]); any = true; }
    if (!any) break;
  }
  return kept;
}

/* ---- the painting -------------------------------------------------------------------------------------- */

/** A cushion of moss, in the web's four passes -- its underside a step down, its body, a fleck of the light -- in the season's greens. */
function cushion(g: Ctx, u: number, v: number, r: number, id: number, season: GrowthSeason): void {
  const lit = season === 'summer' && H(id, 3, 0, 401) > 0.6 ? mix(MOSS_LIT, [0.78, 0.78, 0.5], 0.45) : MOSS_LIT;
  const body = mix(MOSS_UNDER, MOSS_FILL, 0.5 + 0.4 * H(id, 2, 0, 401));
  const passes: Array<[number[], number, number, number, number]> = [
    [MOSS_DARK, 1.1, 0.1, -0.35, 0], [MOSS_UNDER, 1, 0, -0.12, 0], [body, 0.86, -0.08, 0.1, 0], [lit, 0.42, -0.3, 0.36, 0.06],
  ];
  for (const [col, k, dx, dy, min] of passes) {
    if (r < min) continue;
    g.fillStyle = css(seasoned(col, season, 'moss'));
    g.beginPath();
    g.ellipse(u + r * dx, v + r * dy, r * k, r * k * 0.82, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** A crust of lichen: a lobed rosette, paler at its rim. */
function crust(g: Ctx, u: number, v: number, r: number, id: number, sun: number, season: GrowthSeason): void {
  const pick = H(id, 1, 0, 411);
  const tone = pick < 0.45 ? [0.7, 0.75, 0.62] : pick < 0.75 ? [0.62, 0.67, 0.6] : sun > 0.55 && pick > 0.9 ? [0.88, 0.58, 0.26] : [0.84, 0.76, 0.4];
  const lobed = (scale: number): void => {
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const lobe = 0.82 + 0.14 * Math.sin(ang * 5 + id) + 0.1 * H(id, i % 16, 2, 411);
      const x = u + Math.cos(ang) * r * lobe * scale, y = v + Math.sin(ang) * r * lobe * scale;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = css(seasoned(mix(tone, [1, 1, 1], 0.18), season, 'lichen'));
  lobed(1);
  g.fillStyle = css(seasoned(tone.map((x) => x * 0.86), season, 'lichen'));
  lobed(0.55);
}

/** A fern seen against its wall: fronds fanning up from its crown and arching over, toothed into leaflets. */
function fern(g: Ctx, u: number, v: number, size: number, id: number, season: GrowthSeason): void {
  const fronds = season === 'winter' ? 3 : 4 + Math.floor(3 * H(id, 1, 0, 421));
  const base = season === 'spring' ? [0.5, 0.76, 0.38] : [0.33, 0.56, 0.27];
  const tip = season === 'spring' ? [0.66, 0.86, 0.46] : [0.44, 0.66, 0.32];
  const droop = season === 'winter' ? 1.6 : season === 'autumn' ? 1.15 : 1;
  const len = size * (season === 'spring' ? 0.75 : season === 'winter' ? 0.7 : 1);
  for (let f = 0; f < fronds; f++) {
    // fanned out from upright, either side
    const lean = ((f + 0.5) / fronds - 0.5) * 2.2 + (H(id, f, 2, 421) - 0.5) * 0.3;
    const l = len * (0.7 + 0.45 * H(id, f, 3, 421));
    const S = 6;
    const left: Array<[number, number]> = [], right: Array<[number, number]> = [];
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const x = u + Math.sin(lean) * l * t * 0.9;
      const y = v + l * (Math.cos(lean) * 0.95 * t - 0.6 * droop * t * t);
      const nx = Math.cos(lean), ny = -Math.sin(lean) - droop * t * 0.5;
      const nl = Math.hypot(nx, ny) || 1;
      let w = l * 0.13 * Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - 0.35 * t);
      w *= s % 2 === 0 ? 1 : 0.45;
      left.push([x - (nx / nl) * w, y - (ny / nl) * w]);
      right.push([x + (nx / nl) * w, y + (ny / nl) * w]);
    }
    g.fillStyle = css(seasoned(mix(base, tip, 0.45), season, 'fern'));
    g.beginPath();
    [...left, ...right.reverse()].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    // its stalk, a shade darker
    g.strokeStyle = css(seasoned(base.map((x) => x * 0.8), season, 'fern'));
    g.lineWidth = Math.max(0.004, l * 0.015);
    g.beginPath();
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const x = u + Math.sin(lean) * l * t * 0.9, y = v + l * (Math.cos(lean) * 0.95 * t - 0.6 * droop * t * t);
      if (s) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
}

/** A tuft of grass against its wall, or seen from above on a top. */
function tuft(g: Ctx, u: number, v: number, size: number, id: number, season: GrowthSeason, above: boolean): void {
  const blades = 4 + Math.floor(3 * H(id, 1, 0, 431));
  const base = seasoned([0.36, 0.56, 0.28], season, 'grass');
  const tip = seasoned(season === 'summer' ? [0.68, 0.72, 0.4] : [0.56, 0.76, 0.38], season, 'grass');
  g.lineCap = 'round';
  for (let i = 0; i < blades; i++) {
    const h = size * (0.55 + 0.6 * H(id, i, 3, 431));
    const ang = above ? H(id, i, 2, 431) * Math.PI * 2 : (H(id, i, 2, 431) - 0.5) * 1.1;
    const bend = (H(id, i, 4, 431) - 0.5) * 0.5;
    g.strokeStyle = css(mix(base, tip, 0.55));
    g.lineWidth = Math.max(0.006, h * 0.06);
    g.beginPath();
    g.moveTo(u, v);
    if (above) {
      // from above a blade is a short stroke out from the tuft's heart
      g.lineTo(u + Math.cos(ang) * h * 0.45, v + Math.sin(ang) * h * 0.45);
    } else {
      const ex = u + Math.sin(ang) * h * 0.6, ey = v + Math.cos(ang) * h * 0.95;
      g.quadraticCurveTo(u + Math.sin(ang + bend) * h * 0.2, v + h * 0.55, ex, ey);
    }
    g.stroke();
  }
}

/** A wildflower: a stem and a five-petalled head with its eye; from above, the head alone. */
function flower(g: Ctx, u: number, v: number, size: number, id: number, season: GrowthSeason, above: boolean): void {
  const pick = H(id, 1, 0, 441);
  const petal = season === 'autumn' ? [0.68, 0.54, 0.86]
    : pick < 0.35 ? [0.97, 0.96, 0.92] : pick < 0.6 ? [0.98, 0.84, 0.32] : pick < 0.8 ? [0.96, 0.64, 0.74] : [0.58, 0.68, 0.96];
  const eye = season === 'autumn' || pick < 0.35 ? [0.98, 0.82, 0.25] : [0.92, 0.62, 0.2];
  const h = size * (0.7 + 0.5 * H(id, 2, 0, 441));
  let hx = u, hy = v;
  if (!above) {
    hx = u + (H(id, 4, 0, 441) - 0.5) * h * 0.3; hy = v + h;
    g.strokeStyle = css(seasoned([0.36, 0.58, 0.3], season, 'grass'));
    g.lineWidth = Math.max(0.005, h * 0.04);
    g.beginPath(); g.moveTo(u, v); g.quadraticCurveTo(u, v + h * 0.6, hx, hy); g.stroke();
  }
  const pr = 0.022 + 0.016 * H(id, 3, 0, 441);
  g.fillStyle = css(petal);
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2 + id;
    g.beginPath();
    g.ellipse(hx + Math.cos(ang) * pr * 0.6, hy + Math.sin(ang) * pr * (above ? 0.6 : 0.4), pr * 0.5, pr * (above ? 0.5 : 0.35), ang, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = css(eye);
  g.beginPath(); g.arc(hx, hy, pr * 0.32, 0, Math.PI * 2); g.fill();
}

/**
 * Everything a face has grown, painted onto `g` in the face's metres (`u`
 * along, `v` up it or across a top). A wall's foot plants stand on its foot
 * line; a top's are seen from above.
 */
export function paintGrowth(g: Ctx, f: GrowthFace, season: GrowthSeason): number {
  if (f.days <= 0.5 || f.width < 0.05 || f.height < 0.05) return 0;
  let n = 0;
  // lichen first, under the moss
  for (const t of taken('lichen', f, season)) n++, crust(g, t.u, t.v, (0.03 + 0.06 * t.suit) * (0.3 + 0.7 * t.grown), wrap(Math.imul(t.id, 37) + f.seed), f.sun, season);
  for (const t of taken('moss', f, season)) {
    const r = (0.03 + 0.05 * t.suit) * (0.35 + 0.65 * t.grown);
    const key = wrap(Math.imul(t.id, 31) + f.seed);
    n++;
    cushion(g, t.u, t.v, r, key, season);
    if (t.grown > 0.75 && H(key, 0, 0, 451) < 0.3) cushion(g, t.u + r * 1.1, t.v + r * (H(key, 1, 0, 451) - 0.5), r * 0.55, key + 7, season);
  }
  const above = f.top;
  for (const t of taken('fern', f, season)) n++, fern(g, t.u, t.v, (0.28 + 0.22 * t.suit) * (0.4 + 0.6 * t.grown), wrap(Math.imul(t.id, 41) + f.seed), season);
  for (const t of taken('grass', f, season)) n++, tuft(g, t.u, t.v, (0.1 + 0.12 * t.suit) * (0.4 + 0.6 * t.grown), wrap(Math.imul(t.id, 43) + f.seed), season, above);
  if (season !== 'winter') {
    for (const t of taken('flower', f, season)) {
      if (season === 'autumn' && H(t.id, f.seed, 0, 471) > 0.4) continue;
      if (t.grown < 0.5) continue;
      n++;
      flower(g, t.u, t.v, 0.12 + 0.1 * t.suit, wrap(Math.imul(t.id, 47) + f.seed), season, above);
    }
  }
  return n;
}

/** How much sun a face looking along (ox, oy) in tiles (x east, y south) gets: the most turned to the south-east. */
export function sunOf(ox: number, oy: number): number {
  const l = Math.hypot(ox, oy);
  if (l < 1e-6) return 0.9;
  return clamp01(0.5 + 0.45 * ((ox + oy) / (l * Math.SQRT2)));
}

/** A face's seed as Unity reckons it: a hash's share of the largest int, whole. */
export const seedOf = (a: number, b: number, c: number, salt: number): number => Math.floor(hashI(a, b, c, salt) * 2147483647);

/* ---- a face's picture, kept -------------------------------------------------------------------------- */

/** Pixels a metre a face's growth is painted at. */
export const GROWTH_PPM = 48;
const pictures = new Map<string, HTMLCanvasElement | null>();
const MOST_PICTURES = 360;

/**
 * A face's growth as a picture, kept by `key` (its place, days and season):
 * `GROWTH_PPM` pixels to the metre, its top-left the face's top-left (its
 * `v` up, the picture's y down), or null when nothing has grown.
 */
export function growthPicture(key: string, f: GrowthFace, season: GrowthSeason): HTMLCanvasElement | null {
  const had = pictures.get(key);
  if (had !== undefined) {
    pictures.delete(key);
    pictures.set(key, had);
    return had;
  }
  const w = Math.ceil(f.width * GROWTH_PPM), h = Math.ceil(f.height * GROWTH_PPM);
  let out: HTMLCanvasElement | null = null;
  if (w > 0 && h > 0 && f.days > 0.5) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d') as Ctx;
    g.setTransform(GROWTH_PPM, 0, 0, -GROWTH_PPM, 0, h);
    // a face nothing has grown on keeps no picture
    if (paintGrowth(g, f, season) > 0) out = c;
  }
  pictures.set(key, out);
  if (pictures.size > MOST_PICTURES) pictures.delete(pictures.keys().next().value as string);
  return out;
}
