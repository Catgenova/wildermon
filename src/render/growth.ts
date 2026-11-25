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
  /** Ivy takes on it (a wall's side): climbing from its foot, hanging from its open head; how vigorous the ground is (0 to 1). */
  ivy?: boolean;
  climb?: boolean;
  hang?: boolean;
  vigour?: number;
  /** Paving: what grows keeps to its joints, every `joint` metres; how trodden it is (0 to 1), the middle of an open square the most. */
  paving?: boolean;
  joint?: number;
  trodden?: number;
  /** Ivy alone (an ivy wall panel's wall that is not of stone). */
  ivyOnly?: boolean;
  /**
   * Its point in the world in metres (x east, y up, z north, as Unity's), at
   * (u, v): the carpets' field is the world's, so it runs on across the edges
   * of faces.
   */
  world?: (u: number, v: number) => readonly number[];
  /** The carpets' cover at its corners, (0,0), (w,0), (w,h), (0,h): blended across it, so paving shares its neighbours'. */
  coverAt?: readonly [number, number, number, number];
}

/* ---- the stages --------------------------------------------------------------------------------------- */

/**
 * The days each stage of overgrowth is reached at, bare (0) to wholly
 * overgrown (15): quick at first, then slower, six months to the last. As
 * Unity's `Growth.StageDays`.
 */
export const STAGE_DAYS = [0, 2, 4, 7, 10, 14, 20, 27, 35, 45, 57, 72, 90, 112, 140, 180] as const;
export const LAST_STAGE = STAGE_DAYS.length - 1;

/** The stage a face has reached after so many days (0 to 15, between stages a share of the way). */
export function stageOf(days: number): number {
  if (days <= 0) return 0;
  for (let i = 1; i < STAGE_DAYS.length; i++) if (days < STAGE_DAYS[i]) return i - 1 + (days - STAGE_DAYS[i - 1]) / (STAGE_DAYS[i] - STAGE_DAYS[i - 1]);
  return LAST_STAGE;
}
/** How far on a face is, 0 (bare) to 1 (wholly overgrown). */
const ripe = (f: GrowthFace): number => stageOf(f.days) / LAST_STAGE;
/** How much of a face its carpets cover, by its stage: none before about the fifth, all of it by the last; trodden the less. */
const cover = (f: GrowthFace): number => (f.coverAt ? (f.coverAt[0] + f.coverAt[1] + f.coverAt[2] + f.coverAt[3]) / 4 : coverOf(f.days, f.trodden ?? 0));
/** The carpets' cover after so many days, as trodden: none before about the fifth stage, all by the last. */
export const coverOf = (days: number, trodden: number): number => clamp01((stageOf(days) / LAST_STAGE - 0.33) / 0.55) * (1 - 0.7 * trodden);
/** How far on after so many days, 0 to 1. */
export const ripeOf = (days: number): number => stageOf(days) / LAST_STAGE;

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
    // a coping holds the rain down its middle; paving all over
    const mid = f.paving ? 0.5 : 1 - Math.abs(v / Math.max(0.01, f.height) - 0.5) * 2;
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

const suit = (k: Kind, f: GrowthFace, u: number, v: number, season: GrowthSeason): number => suitHere(k, f, u, v, season) * (1 - 0.55 * (f.trodden ?? 0));

function suitHere(k: Kind, f: GrowthFace, u: number, v: number, season: GrowthSeason): number {
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

/** Metres at least between a kind's roots on a face, so it takes in more than one place (a wall's foot and its drips). */
export const ROOTS_APART = 0.9;
/** Metres a day ivy climbs from a foot, and hangs from an open head (at its most vigorous, times 1.4; at its least, 0.6). */
export const IVY_CLIMB = 0.12, IVY_HANG = 0.09;
/** Metres a day moss spreads out from where it took root. */
export const MOSS_SPREAD = 0.08;

interface Habit { spacing: number; settle: number; speed: number; grow: number; nuclei: number; most: number; salt: number }
const HABITS: Record<Kind, Habit> = {
  moss: { spacing: 0.09, settle: 5, speed: MOSS_SPREAD, grow: 5, nuclei: 4, most: 60, salt: 301 },
  lichen: { spacing: 0.22, settle: 16, speed: 0.06, grow: 14, nuclei: 4, most: 16, salt: 307 },
  fern: { spacing: 0.4, settle: 8, speed: 0.1, grow: 8, nuclei: 3, most: 6, salt: 311 },
  grass: { spacing: 0.15, settle: 4, speed: 0.2, grow: 4, nuclei: 4, most: 12, salt: 313 },
  flower: { spacing: 0.22, settle: 7, speed: 0.14, grow: 4, nuclei: 3, most: 10, salt: 317 },
};
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
  // paving carries a third of a wall's: a few clumps in its joints
  if (f.paving) most = Math.max(1, Math.round(most * 0.6));
  // and the further on, the more: four times as many at the last stage
  // less again where a carpet has covered it: what is under the carpet need not be drawn
  most = Math.round(most * (1 + 3 * Math.pow(ripe(f), 1.5)) * (1 - 0.75 * cover(f)));
  const out: Array<Taken & { root: number }> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = r * 1000 + c;
    let u = ((c + 0.15 + 0.7 * H(f.seed, id, 7, h.salt)) / cols) * f.width;
    let v = footOnly ? 0 : ((r + 0.15 + 0.7 * H(f.seed, id, 8, h.salt)) / rows) * f.height;
    // in paving, only in its joints: on the nearer of the joint lines either way
    if (f.paving) {
      const j = f.joint ?? 1;
      const ju = Math.round(u / j) * j, jv = Math.round(v / j) * j;
      if (Math.abs(u - ju) < Math.abs(v - jv)) u = Math.max(0.03, Math.min(f.width - 0.03, ju)); else v = Math.max(0.03, Math.min(f.height - 0.03, jv));
    }
    if (!onStone(f, u, footOnly ? 0.02 : v)) continue;
    const s = suit(k, f, u, v, season);
    if (s <= 0.08) continue;
    if (k === 'moss' && s < 0.18 * (1 - ripe(f))) continue;
    let near = Infinity, root = 0;
    roots.forEach((p, i) => { const d = Math.hypot(p.u - u, p.v - v); if (d < near) { near = d; root = i; } });
    const reached = (1 - s) * h.settle + near / h.speed + 2.5 * H(f.seed, id, 9, h.salt);
    if (f.days <= reached) continue;
    out.push({ u, v, grown: clamp01((f.days - reached) / h.grow), suit: s, id, root });
  }
  if (out.length <= most) return out;
  // the most a face carries, shared between its colonies, each a spread of what it has reached (not only its heart)
  const pick = (t: Taken): number => t.grown * 0.6 + t.suit * 0.4 + (f.paving ? 1.2 : 0.45) * H(t.id, f.seed, 13, h.salt);
  const by = roots.map((_, i) => out.filter((t) => t.root === i).sort((a, b) => pick(b) - pick(a)));
  const kept: Taken[] = [];
  for (let k = 0; kept.length < most; k++) {
    let any = false;
    for (const l of by) if (k < l.length && kept.length < most) { kept.push(l[k]); any = true; }
    if (!any) break;
  }
  return kept;
}

/* ---- ivy ----------------------------------------------------------------------------------------------- */

/** A strand of ivy on a face: its points (u, v in metres) from its root, the main stem or a branch. */
export interface IvyStem { pts: Array<[number, number]>; branch: boolean }
const IVY_STEP = 0.08;

/**
 * The ivy on a face (as Unity's `Growth.IvyOn`): stems as many and as
 * spread as the ground's vigour, the shade and the wet ask, rooted along its
 * foot to climb or along its open head to hang, each from its own day; each
 * grows a few centimetres a day, wandering, branching every so often,
 * stopping short of an opening.
 */
export function ivyOn(f: GrowthFace): IvyStem[] {
  const o: IvyStem[] = [];
  if (!f.ivy || f.days <= 0 || (!f.climb && !f.hang)) return o;
  const rp = ripe(f);
  const density = clamp01(-0.3 + 2.1 * (f.vigour ?? 0.5) + 0.3 * (1 - f.sun) + 0.25 * f.wet + 0.6 * rp);
  const low = f.height < 2.2;
  const n = Math.round(density * (low ? 5 : 7) * (1 + 0.5 * rp) + (H(f.seed, 0, 1, 601) - 0.5) * 1.2);
  if (n <= 0) return o;
  const spread = ((low ? 0.15 : 0.13) + H(f.seed, 0, 2, 601) * 0.05) * (0.7 + 0.9 * density);
  const centre = 0.18 + H(f.seed, 0, 3, 601) * 0.64;
  for (let i = 0; i < n; i++) {
    const rank = Math.abs(i - (n - 1) / 2) / Math.max(1, n / 2);
    const t = Math.max(0.07, Math.min(0.93, centre + (i - (n - 1) / 2) * spread + (H(f.seed, i, 4, 601) - 0.5) * 0.05));
    const hang = f.climb && f.hang ? (i + (H(f.seed, i, 5, 601) < 0.5 ? 0 : 1)) % 2 === 0 : !!f.hang;
    const birth = (rank * 0.45 + H(f.seed, i, 6, 601) * 0.12 + (1 - density) * 0.2) * 10;
    const rate = (hang ? IVY_HANG : IVY_CLIMB) * (0.6 + 0.8 * density);
    let len = (f.days - birth) * rate;
    if (len <= 0.05) continue;
    let room = (hang ? 0.8 : 0.95) * f.height;
    let blocked = false;
    for (const k of f.keep ?? []) {
      if (t + 0.06 < k.t0 || t - 0.06 > k.t1) continue;
      if (hang) room = Math.min(room, (1 - k.k1) * f.height - 0.05);
      else if (k.k0 <= 0.02) blocked = true;
      else room = Math.min(room, k.k0 * f.height - 0.08);
    }
    if (blocked || room < 0.15) continue;
    len = Math.min(len, room);
    walk(o, f, i, t * f.width, hang ? f.height - 0.02 : 0.02, hang ? -1 : 1, 0, len, false);
  }
  return o;
}

function walk(into: IvyStem[], f: GrowthFace, no: number, u: number, v: number, way: number, lean: number, len: number, branch: boolean): void {
  const s: IvyStem = { pts: [[u, v]], branch };
  const steps = Math.floor(len / IVY_STEP);
  let ang = lean;
  for (let k = 1; k <= steps; k++) {
    ang = Math.max(lean - 0.55, Math.min(lean + 0.55, ang + (H(f.seed, wrap(Math.imul(no, 97) + k), 7, 601) - 0.5) * 0.45));
    u = Math.max(0.02, Math.min(f.width - 0.02, u + Math.sin(ang) * IVY_STEP));
    v += way * Math.cos(ang) * IVY_STEP;
    if (v < 0.01 || v > f.height - 0.01) break;
    s.pts.push([u, v]);
    if (!branch && k > 2 && k % 4 === 0 && H(f.seed, wrap(Math.imul(no, 97) + k), 8, 601) < 0.5) {
      const side = H(f.seed, wrap(Math.imul(no, 97) + k), 9, 601) < 0.5 ? -1 : 1;
      walk(into, f, wrap(Math.imul(no, 31) + k), u, v, way, side * 0.8, (steps - k) * IVY_STEP * 0.45, true);
    }
  }
  if (s.pts.length > 1) into.push(s);
}

const IVY_OLD = [0.19, 0.36, 0.21], IVY_MID = [0.26, 0.47, 0.26], IVY_YOUNG = [0.46, 0.67, 0.33], IVY_STEM = [0.33, 0.27, 0.19];

function ivyLeafColour(age: number, id: number, season: GrowthSeason): number[] {
  let c = age > 0.5 ? mix(IVY_MID, IVY_OLD, (age - 0.5) * 2) : mix(IVY_YOUNG, IVY_MID, age * 2);
  c = mix(c, c.map((x) => x * 0.88), H(id, 1, 0, 611));
  switch (season) {
    case 'spring': return age < 0.35 ? mix(c, [0.56, 0.76, 0.36], 0.5) : c;
    case 'autumn': return H(id, 2, 0, 611) < 0.12 ? mix(c, [0.52, 0.28, 0.2], 0.6) : c;
    case 'winter': return mix(c, [0.24, 0.26, 0.2], 0.35);
    default: return c;
  }
}

/** The ivy on a face, painted: each stem a thin line, a leaf at every step, alternate sides -- three lobes and a point, a vein down it. */
function paintIvy(g: Ctx, f: GrowthFace, season: GrowthSeason): number {
  const rp = ripe(f);
  // more leaves to a step, and bigger, the further on it is, till the stems are lost under them
  const leaves = 1 + (rp > 0.45 ? 1 : 0);
  const stems = ivyOn(f);
  let si = 0;
  for (const s of stems) {
    si++;
    g.strokeStyle = css(IVY_STEM);
    g.lineWidth = s.branch ? 0.006 : 0.009;
    g.lineCap = 'round';
    g.beginPath();
    s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    const last = s.pts.length - 1;
    s.pts.forEach(([x, y], k) => {
      const [nx, ny] = k < last ? s.pts[k + 1] : [x + (x - s.pts[k - 1][0]), y + (y - s.pts[k - 1][1])];
      const dl = Math.hypot(nx - x, ny - y) || 1;
      const dx = (nx - x) / dl, dy = (ny - y) / dl;
      const age = 1 - k / Math.max(1, last);
      for (let lf = 0; lf < leaves; lf++) {
      const id = wrap(f.seed + Math.imul(si, 1009) + k + Math.imul(lf, 7919));
      const side = (k + lf) % 2 === 0 ? 1 : -1;
      const turn = side * (0.8 + 0.4 * H(id, 3, 0, 611)) * (lf === 0 ? 1 : 0.5 + 0.9 * H(id, 5, 0, 611));
      const lx = dx * Math.cos(turn) - dy * Math.sin(turn), ly = dx * Math.sin(turn) + dy * Math.cos(turn);
      const size = (0.08 + 0.05 * H(id, 4, 0, 611)) * (0.6 + 0.4 * age) * (s.branch ? 0.85 : 1) * (1 + 0.5 * rp);
      const col = ivyLeafColour(age, id, season);
      // the leaf: a point and two side lobes round its middle, turned along (lx, ly)
      const cx = x + lx * size * 0.55, cy = y + ly * size * 0.55;
      const px = -ly, py = lx;
      g.fillStyle = css(col);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(cx + px * size * 0.7, cy + py * size * 0.7, x + lx * size * 1.1, y + ly * size * 1.1);
      g.quadraticCurveTo(cx - px * size * 0.7, cy - py * size * 0.7, x, y);
      g.fill();
      g.strokeStyle = css(col.map((v) => v * 0.75));
      g.lineWidth = size * 0.08;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + lx * size * 0.9, y + ly * size * 0.9); g.stroke();
      }
    });
  }
  return stems.length;
}

/* ---- carpets and shrubs: what the late stages bring ------------------------------------------------------ */

/** Value noise in three dimensions, nought to one, smooth: the same at a place whatever face asks it (as Unity's `Growth.Noise3`). */
export function noise3(x: number, y: number, z: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a: number, b: number, c: number): number => H(ix + a, iy + b, wrap(Math.imul(iz, 7919) + Math.imul(c, 7919) + salt), salt);
  const lerp = (p: number, q: number, t: number): number => p + (q - p) * t;
  const x00 = lerp(L(0, 0, 0), L(1, 0, 0), fx), x10 = lerp(L(0, 1, 0), L(1, 1, 0), fx);
  const x01 = lerp(L(0, 0, 1), L(1, 0, 1), fx), x11 = lerp(L(0, 1, 1), L(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}
/** Two octaves of it at a place in the world (metres), a stride of 1.6 m and of 0.55 m: where a carpet runs. */
const patchy = (w: readonly number[], salt: number): number =>
  0.62 * noise3(w[0] / 1.6, w[1] / 1.6, w[2] / 1.6, salt) + 0.38 * noise3(w[0] / 0.55, w[1] / 0.55, w[2] / 0.55, salt + 1);

/** A face's point in the world, in metres (x east, y up, z north, as Unity's): its own `world`, or its own terms when it has none. */
const worldOf = (f: GrowthFace, u: number, v: number): readonly number[] => (f.world ? f.world(u, v) : [u, v, f.seed % 997]);

/** A carpet's cover at a point of a face: the face's own, or blended from its corners' (paving: its neighbours' share). */
function coverHere(f: GrowthFace, u: number, v: number): number {
  const c = f.coverAt;
  if (!c) return cover(f);
  const s = clamp01(u / f.width), t = clamp01(v / f.height);
  return (c[0] + (c[1] - c[0]) * s) * (1 - t) + (c[3] + (c[2] - c[3]) * s) * t;
}

/**
 * The carpet field at a point of a face: over `EDGE` it is carpeted. The
 * cover there, the place's own patchiness in the world (so a carpet runs on
 * across a tile's edge or round a wall's corner as though there were none),
 * and how damp it is; none in an opening. `late` holds it back (a grass
 * sward comes after the moss). As Unity's `Growth.Field`.
 */
function field(f: GrowthFace, u: number, v: number, salt: number, late: number): number {
  if (!onStone(f, Math.max(0.001, Math.min(f.width - 0.001, u)), Math.max(0.001, Math.min(f.height - 0.001, v)))) return -1;
  const c = coverHere(f, u, v) - late;
  return c * 1.3 - 0.15 + 0.55 * (patchy(worldOf(f, u, v), salt) - 0.5) + 0.35 * (damp(f, u, v) - 0.45);
}
const EDGE = 0.5;
/** Samples a metre the field is painted at, smoothed up to the picture: soft edges, and cheap. */
const FIELD_PER_M = 12;

/** A canvas to paint the field into: the page's own, or the one `setCanvasMaker` was given (Node, the tools). */
let canvasMaker: ((w: number, h: number) => HTMLCanvasElement) | null = null;
export function setCanvasMaker(make: (w: number, h: number) => HTMLCanvasElement): void { canvasMaker = make; }
function newCanvas(w: number, h: number): HTMLCanvasElement {
  if (canvasMaker) return canvasMaker(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * A carpet on a face from the field, painted a sample at a time and laid
 * over it smoothed: dark where it thins out, light where it runs high,
 * mottled. `palette` gives the colours at a point (ivy over a wall's face,
 * moss at its foot). Returns whether any of it showed.
 */
function fieldCarpet(g: Ctx, f: GrowthFace, salt: number, late: number, palette: (u: number, v: number) => [number[], number[]]): boolean {
  const cols = Math.max(2, Math.ceil(f.width * FIELD_PER_M)), rows = Math.max(2, Math.ceil(f.height * FIELD_PER_M));
  const cv = newCanvas(cols, rows);
  const cg = cv.getContext('2d') as Ctx;
  const img = cg.createImageData(cols, rows);
  let any = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = ((c + 0.5) / cols) * f.width, v = ((rows - r - 0.5) / rows) * f.height;
    const val = field(f, u, v, salt, late);
    const a = clamp01((val - (EDGE - 0.05)) / 0.1);
    if (a <= 0) continue;
    any = true;
    const [lo, hi] = palette(u, v);
    const w = worldOf(f, u, v);
    const mott = 0.9 + 0.2 * noise3(w[0] * 3.1, w[1] * 3.1, w[2] * 3.1, salt + 5);
    const col = mix(lo, hi, clamp01((val - EDGE) * 2.5)).map((x) => Math.min(1, x * mott));
    const i = (r * cols + c) * 4;
    img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = a * 255;
  }
  if (!any) return false;
  cg.putImageData(img, 0, 0);
  g.save();
  g.translate(0, f.height);
  g.scale(1, -1);
  g.imageSmoothingEnabled = true;
  g.drawImage(cv, 0, 0, f.width, f.height);
  g.restore();
  return true;
}

/**
 * The carpets a face has grown by its stage, from one field over the world
 * (as Unity's `Growth.Carpets`): moss sheets on a top or paving and ivy
 * mats on a wall's face (moss low on it, where it meets the ground), coming
 * in from the damp and running on across the edges of tiles and faces, till
 * by the last the whole face is under them; a grass sward over paving and
 * tops late on.
 */
/** The most cover at any of a face's corners: what creeps in from round it. */
const spill = (f: GrowthFace): number => (f.coverAt ? Math.max(...f.coverAt) : 0);

function carpets(g: Ctx, f: GrowthFace, season: GrowthSeason): number {
  const p = ripe(f);
  if (p < 0.05 && spill(f) < 0.05) return 0;
  const moss: [number[], number[]] = [seasoned(MOSS_DARK, season, 'moss'), seasoned(mix(MOSS_FILL, MOSS_LIT, 0.3), season, 'moss')];
  const ivy: [number[], number[]] = [seasoned(IVY_OLD, season, 'moss'), seasoned(IVY_MID, season, 'moss')];
  const walled = !!f.ivy && !f.top;
  let n = fieldCarpet(g, f, 811, 0, (_u, v) => (walled && !(f.foot && v < 0.45) ? ivy : moss)) ? 1 : 0;
  if ((f.paving || f.top) && p > 0.6) {
    const sward: [number[], number[]] = [seasoned([0.42, 0.6, 0.3], season, 'grass'), seasoned([0.58, 0.72, 0.38], season, 'grass')];
    if (fieldCarpet(g, f, 823, 0.35, () => sward)) n++;
  }
  return n;
}

/** The shrubs a late stage brings: low bushes on a top, in paving and at a wall's foot; leafy, turning in autumn, bare twigs in winter. */
function shrubs(g: Ctx, f: GrowthFace, season: GrowthSeason): number {
  const p = ripe(f);
  if (p < 0.55 || (!f.top && !f.foot)) return 0;
  const count = Math.round(((p - 0.55) / 0.45) * 4 * Math.max(0.5, f.width / 4) * (1 - 0.8 * (f.trodden ?? 0)) + H(f.seed, 0, 1, 731) * 0.8);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const u = H(f.seed, i, 2, 731) * f.width, v = f.top ? H(f.seed, i, 3, 731) * f.height : 0;
    if (!onStone(f, u, Math.max(0.02, v))) continue;
    const size = (0.25 + 0.35 * H(f.seed, i, 5, 731)) * (0.5 + (0.5 * (p - 0.55)) / 0.45) * (f.top ? 0.7 : 1);
    const id = wrap(f.seed + Math.imul(i, 53));
    n++;
    if (season === 'winter') {
      g.strokeStyle = css([0.42, 0.33, 0.24]); g.lineWidth = 0.012; g.lineCap = 'round';
      for (let t = 0; t < 5; t++) {
        const ang = (H(id, t, 1, 741) - 0.5) * 1.6;
        g.beginPath(); g.moveTo(u, v);
        if (f.top) g.lineTo(u + Math.cos(ang * 4) * size * 0.5, v + Math.sin(ang * 4) * size * 0.5);
        else g.lineTo(u + Math.sin(ang) * size * 0.6, v + Math.cos(ang) * size);
        g.stroke();
      }
      continue;
    }
    const balls = 3 + Math.floor(3 * H(id, 0, 1, 741));
    for (let b = 0; b < balls; b++) {
      const ang = H(id, b, 2, 741) * Math.PI * 2;
      const off = size * 0.35 * H(id, b, 3, 741);
      const cx = u + Math.cos(ang) * off, cy = f.top ? v + Math.sin(ang) * off : v + size * (0.35 + 0.35 * H(id, b, 4, 741));
      const rr = size * (0.3 + 0.2 * H(id, b, 5, 741));
      let leaf = season === 'autumn' ? mix([0.78, 0.46, 0.18], [0.72, 0.28, 0.16], H(id, b, 6, 741)) : mix([0.3, 0.5, 0.24], [0.45, 0.64, 0.3], H(id, b, 6, 741));
      if (season === 'spring') leaf = mix(leaf, [0.55, 0.75, 0.35], 0.4);
      g.fillStyle = css(leaf.map((c) => c * 0.82)); g.beginPath(); g.arc(cx, cy - rr * 0.12, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = css(leaf); g.beginPath(); g.arc(cx - rr * 0.1, cy + rr * 0.08, rr * 0.82, 0, Math.PI * 2); g.fill();
      g.fillStyle = css(leaf.map((c) => Math.min(1, c * 1.15))); g.beginPath(); g.arc(cx - rr * 0.3, cy + rr * 0.3, rr * 0.32, 0, Math.PI * 2); g.fill();
    }
  }
  return n;
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
  if (f.width < 0.05 || f.height < 0.05) return 0;
  // kept clear itself, but what grows round it creeps in over its edges (fresh paving at an old wall's foot)
  if (f.days <= 0.5) return spill(f) >= 0.05 && !f.ivyOnly ? carpets(g, f, season) : 0;
  let n = 0;
  if (f.ivyOnly) return paintIvy(g, f, season);
  // the carpets under everything
  n += carpets(g, f, season);
  // lichen first, under the moss
  for (const t of taken('lichen', f, season)) n++, crust(g, t.u, t.v, (0.03 + 0.06 * t.suit) * (0.3 + 0.7 * t.grown), wrap(Math.imul(t.id, 37) + f.seed), f.sun, season);
  for (const t of taken('moss', f, season)) {
    const r = (0.03 + 0.05 * t.suit) * (0.35 + 0.65 * t.grown);
    const key = wrap(Math.imul(t.id, 31) + f.seed);
    n++;
    cushion(g, t.u, t.v, r, key, season);
    if (t.grown > 0.75 && H(key, 0, 0, 451) < 0.3) cushion(g, t.u + r * 1.1, t.v + r * (H(key, 1, 0, 451) - 0.5), r * 0.55, key + 7, season);
  }
  // the ivy, over the moss
  if (f.ivy) n += paintIvy(g, f, season);
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
  // and the shrubs a late stage brings, over the rest
  n += shrubs(g, f, season);
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
  if (w > 0 && h > 0 && (f.days > 0.5 || spill(f) >= 0.05)) {
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
