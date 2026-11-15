import { HEIGHT_SCALE } from '../iso';
import { rand } from '../ivy';
import { lessMotion } from '../../engine/motion';
import {
  css, deeper, hex, lathe, mix, prism, slab, TAU, toneOf,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { rod } from './woodwork';
import { glow } from './hearthstone';
import { bust, BUST_PLINTH } from './fittings';
import { hollow, still } from './fountain';
import { FOUNT, FOUNT_RIM } from '../fountain';
import { vaseOf, vaseTrim } from './furnish';
import { LAVA_RISE } from '../../game/obsidiandefs';

/**
 * The obsidian pieces (`obsidian.ts`), in the kit: a black glass lantern, an
 * obsidian throne, an obsidian obelisk, a dragon-glass fountain, a shard
 * garden, an obsidian vase, a lava lamp column, an obsidian bust, a glass
 * shard path and an ember orb on a stand (the obsidian wind chime hangs with
 * the wind chime, `garden.ts`).
 *
 * All of one glass: volcanic glass in the kit's pastel, a deep smoky violet
 * glossed pale along its tops, with a faint ember edge where its arrises
 * catch. What glows glows ember red: a lantern's candle through smoked panes,
 * a lava lamp's melt, an orb. Trims are worked out by the renderer off what
 * the island keeps (`obsidianTrim` in `render/obsidianlook.ts`).
 */

const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
const shadeRound = (r: number, n = 12): V3[] => Array.from({ length: n }, (_, i): V3 => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r, 0]);
const onScreen = (sx: number, sy: number, zoom: number, v: KitView, p: V3): [number, number] =>
  [sx + (p[0] * v.ux + p[1] * v.vx) * zoom, sy + (p[0] * v.uy + p[1] * v.vy - p[2] * HEIGHT_SCALE) * zoom];
const loose = (a: V3, b: V3, draw: (g: Ctx, e: import('../runestone').Eye) => void, solid = false, pad = 0): KitPart => ({
  reach: [0, 1, 2, 3, 4, 5, 6, 7].map((i): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]), draw, solid, ...(pad ? { pad } : {}),
});
const said = (t: number | undefined): number => Math.max(0, Math.floor(t ?? 0));

/* ---- the glass ------------------------------------------------------------------------------------- */

/** Volcanic glass in the kit: a smoky violet in the light, a deep plum turned from it. */
export const GLASS: Tone = toneOf('#8c84a8', '#3e3654');
/** A step deeper, for a foot or a plinth. */
const GLASS_DEEP: Tone = deeper(GLASS, 0.22);
/** Its ink: a deep plum, never black. */
const GLASS_INK: RGB = hex('#2e2440');
/** The ember along its edges, and its glow. */
export const EMBER: RGB = hex('#ff7a50');
const EMBER_HOT: RGB = hex('#ffc070');
const EMBER_GLOW = '255, 120, 72';
/** Grey ash gravel. */
const ASH: Tone = toneOf('#cfc8c8', '#8a8090');

/** A face of glass: its gloss, a pale streak across it, and an ember hairline along its top where it catches. */
const glassy = (seed: number, ember = true) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
  const T = rand(seed);
  // The gloss: a pale band slanting up the face, and a thinner one beside it.
  g.fillStyle = css(mix(k.fill, [236, 228, 255], 0.42), 0.55);
  const x0 = s.w * (0.18 + T() * 0.3);
  g.beginPath(); g.moveTo(x0, s.h); g.lineTo(x0 + s.w * 0.12, s.h); g.lineTo(x0 + s.w * 0.22, 0); g.lineTo(x0 + s.w * 0.1, 0); g.closePath(); g.fill();
  g.fillStyle = css(mix(k.fill, [236, 228, 255], 0.3), 0.4);
  g.fillRect(x0 + s.w * 0.27, 0, Math.max(0.08, s.w * 0.03), s.h);
  if (ember) { g.fillStyle = css(EMBER, 0.7); g.fillRect(0, 0, s.w, Math.min(0.14, s.h * 0.08)); }
};
const glassSides = (seed: number, ember = true) => ({ front: glassy(seed, ember), back: glassy(seed + 1, ember), left: glassy(seed + 2, ember), right: glassy(seed + 3, ember), top: glassy(seed + 4, false) });
const lathed = (seed: number) => (_k: number, i: number, s: Side): Partial<Face> => ({ crease: 0.2, paint: (g: Ctx, kk: PaintCtx) => glassy(seed + i, false)(g, kk, s) });
/** A shard: a three- or four-sided spike of glass from a ring at the foot to a point, leaning. */
function shard(x: number, y: number, r: number, h: number, lean: [number, number], sides: number, turn: number, seed: number): Face[] {
  const foot = Array.from({ length: sides }, (_, i): V3 => {
    const a = turn + (i / sides) * TAU;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, 0];
  });
  const tip: V3 = [x + lean[0], y + lean[1], h];
  return prism([foot, foot.map(() => tip)], GLASS, (_k, i, s) => ({ crease: 0.3, paint: (g: Ctx, kk: PaintCtx) => glassy(seed + i)(g, kk, s) }));
}

/* ---- 1. the black glass lantern ------------------------------------------------------------------- */

/** A lantern's trim: whether its candle burns. */
export const blackLanternTrim = (lit: boolean): number => (lit ? 1 : 0);
/** The lanterns whose candle burns, by the piece's id (`obsidianTrim`): what the halo is drawn round. */
export const LANTERNS_LIT = new Set<number>();
const PANE_Z0 = 7.2, PANE_Z1 = 11.6, PANE_R = 1.9;
const LANTERN_AT: V3 = [0, 0, (PANE_Z0 + PANE_Z1) / 2];

function blackLanternOf(look: KitLook): KitModel {
  const lit = said(look.trim) > 0;
  const parts: KitPart[] = [];
  const foot: KitPart = { faces: slab(-2.6, 2.6, -2.6, 2.6, 0, 1.0, GLASS_DEEP, { corner: 0.3, bevel: 0.3, paint: glassSides(3101) }), edges: true, inkColour: GLASS_INK };
  parts.push(foot);
  const post: KitPart = { faces: slab(-0.9, 0.9, -0.9, 0.9, 1.0, PANE_Z0 - 0.4, GLASS, { corner: 0.2, taper: -0.25, paint: glassSides(3111) }), edges: true, inkColour: GLASS_INK };
  parts.push(post);
  parts.push({ faces: slab(-2.3, 2.3, -2.3, 2.3, PANE_Z0 - 0.4, PANE_Z0, GLASS_DEEP, { corner: 0.2, paint: glassSides(3121) }), edges: true, inkColour: GLASS_INK });
  // Four panes of smoked glass, a candle's ember through them lit; dark slips of glass at the corners.
  const pane: Tone = lit ? { lit: mix(EMBER, EMBER_HOT, 0.35), shade: mix(EMBER, hex('#b04a3a'), 0.3) } : toneOf('#6e6488', '#2e2840');
  parts.push({
    faces: slab(-PANE_R, PANE_R, -PANE_R, PANE_R, PANE_Z0, PANE_Z1, pane, {
      paint: Object.fromEntries((['front', 'back', 'left', 'right'] as const).map((f, i) => [f, (g: Ctx, k: PaintCtx, s: Side) => {
        g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
        // The candle's flame in the middle of each pane, lit; a smoky sheen across it out.
        if (lit) { g.fillStyle = css(EMBER_HOT, 0.9); g.beginPath(); g.ellipse(s.w / 2, s.h * 0.55, s.w * 0.12, s.h * 0.2, 0, 0, TAU); g.fill(); }
        else { g.fillStyle = css(mix(k.fill, [236, 228, 255], 0.35), 0.5); g.fillRect(s.w * (0.2 + i * 0.05), 0, s.w * 0.1, s.h); }
      }])),
    }),
    edges: true, inkColour: GLASS_INK,
  });
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    parts.push({ faces: slab(x * PANE_R - 0.35, x * PANE_R + 0.35, y * PANE_R - 0.35, y * PANE_R + 0.35, PANE_Z0, PANE_Z1, GLASS_DEEP, { paint: glassSides(3131 + x * 3 + y) }), inkColour: GLASS_INK });
  }
  // A pointed cap cut as a pyramid of four facets, and a ring over it.
  const capFoot: V3[] = [[-2.6, -2.6, PANE_Z1], [2.6, -2.6, PANE_Z1], [2.6, 2.6, PANE_Z1], [-2.6, 2.6, PANE_Z1]];
  const capEave: V3[] = capFoot.map(([x, y]): V3 => [x, y, PANE_Z1 + 0.5]);
  const cap: KitPart = { faces: prism([capFoot, capEave, capFoot.map((): V3 => [0, 0, PANE_Z1 + 3.4])], GLASS, (_k, i, s) => ({ crease: 0.3, paint: (g: Ctx, k: PaintCtx) => glassy(3141 + i)(g, k, s) })), edges: true, inkColour: GLASS_INK };
  parts.push(cap);
  parts.push({ faces: lathe(0, 0, [[PANE_Z1 + 3.2, 0.25], [PANE_Z1 + 3.6, 0.55], [PANE_Z1 + 4.1, 0.25]], 6, GLASS_DEEP), after: [cap], inkColour: GLASS_INK });
  return { parts, shade: shadeOf(-2.6, 2.6, -2.6, 2.6) };
}

export const BLACK_LANTERN: KitPiece = {
  model: (look) => blackLanternOf(look), uses: { trim: true },
  states: [{ trim: blackLanternTrim(false), label: 'out' }, { trim: blackLanternTrim(true), label: 'lit' }],
  holesLit: true,
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, LANTERN_AT);
    return [{ x, y, r: 2.6 * zoom, a: 0.95 }, { x, y, r: 7 * zoom, a: 0.3 }];
  },
  live: (ctx, sx, sy, zoom, view, night, _t, air) => {
    if (night <= 0.02 || !LANTERNS_LIT.has(air?.seed ?? -1)) return;
    const [x, y] = onScreen(sx, sy, zoom, view, LANTERN_AT);
    glow(ctx, x, y, 7 * zoom, 0.55 * night, EMBER_GLOW);
  },
};

/* ---- 2. the obsidian throne ----------------------------------------------------------------------- */

const CUSHION: Tone = toneOf('#e0705c', '#8a3a48');

function throneOf(): KitModel {
  const parts: KitPart[] = [];
  const g = (seed: number) => glassSides(seed);
  // A dais, the seat's block, two arms, and a tall back with three shards over it; a red cushion on the seat.
  const dais: KitPart = { faces: slab(-9.4, 9.4, -9.4, 9.4, 0, 1.2, GLASS_DEEP, { corner: 0.4, bevel: 0.35, paint: g(3201) }), edges: true, inkColour: GLASS_INK, first: true };
  parts.push(dais);
  const seat: KitPart = { faces: slab(-6.6, 6.6, -5.6, 7.2, 1.2, 5.0, GLASS, { corner: 0.3, bevel: 0.3, paint: g(3211) }), edges: true, inkColour: GLASS_INK };
  parts.push(seat);
  const back: KitPart = { faces: slab(-7.4, 7.4, -8.6, -5.6, 1.2, 17.0, GLASS, { corner: 0.4, paint: g(3221) }), edges: true, inkColour: GLASS_INK };
  parts.push(back);
  for (const s of [-1, 1]) {
    parts.push({ faces: slab(s * 6.6 - (s > 0 ? 0 : 1.8), s * 6.6 + (s > 0 ? 1.8 : 0), -5.6, 6.8, 1.2, 9.2, GLASS, { corner: 0.3, bevel: 0.4, paint: g(3231 + s) }), edges: true, inkColour: GLASS_INK });
  }
  // The shards over the back: a tall one in the middle and two leaning out.
  parts.push({ faces: shard(0, -7.1, 1.9, 25.5, [0, 0.2], 4, TAU / 8, 3241), edges: true, inkColour: GLASS_INK, after: [back] });
  parts.push({ faces: shard(-4.6, -7.1, 1.5, 21.6, [-1.2, 0.2], 4, TAU / 8, 3251), edges: true, inkColour: GLASS_INK, after: [back] });
  parts.push({ faces: shard(4.6, -7.1, 1.5, 21.6, [1.2, 0.2], 4, TAU / 8, 3261), edges: true, inkColour: GLASS_INK, after: [back] });
  parts.push({ faces: slab(-5.8, 5.8, -5.0, 6.4, 5.0, 5.9, CUSHION, { corner: 0.8, bevel: 0.4 }), after: [seat] });
  return { parts, shade: shadeOf(-9.4, 9.4, -9.4, 9.4) };
}

export const OBSIDIAN_THRONE: KitPiece = { model: () => throneOf(), uses: {} };

/* ---- 3. the obsidian obelisk ---------------------------------------------------------------------- */

/** Where an obelisk's glint is, nought to one, by the island clock (`obeliskGlint`): set by the renderer each frame (`obsidianTrim`). */
export const OBSIDIAN_FX = { glint: 0 };
const OB_TOP = 30, OB_TIP = 35;
/** Half its shaft across at its head, and at its foot (`taper`). */
const OB_HEAD = 2.2, OB_FOOT = 3.4;

function obeliskOf(): KitModel {
  const parts: KitPart[] = [];
  parts.push({ faces: slab(-7, 7, -7, 7, 0, 1.6, GLASS_DEEP, { corner: 0.3, bevel: 0.4, paint: glassSides(3301) }), edges: true, inkColour: GLASS_INK, first: true });
  parts.push({ faces: slab(-5, 5, -5, 5, 1.6, 3.4, GLASS_DEEP, { corner: 0.2, bevel: 0.3, paint: glassSides(3311) }), edges: true, inkColour: GLASS_INK });
  const shaft: KitPart = {
    faces: slab(-OB_HEAD, OB_HEAD, -OB_HEAD, OB_HEAD, 3.4, OB_TOP, GLASS, {
      corner: 0.15, taper: OB_HEAD - OB_FOOT,
      paint: {
        ...glassSides(3321),
        // The name's band on its front: a line of cut marks, pale in the glass.
        front: (g2: Ctx, k: PaintCtx, s: Side) => {
          glassy(3321)(g2, k, s);
          g2.fillStyle = css(mix(k.fill, [255, 236, 220], 0.45), 0.75);
          const T = rand(3329);
          for (let i = 0; i < 6; i++) g2.fillRect(s.w * 0.22, s.h * (0.62 + i * 0.045), s.w * (0.35 + T() * 0.25), Math.max(0.12, s.h * 0.012));
        },
      },
    }),
    edges: true, inkColour: GLASS_INK,
  };
  parts.push(shaft);
  const top: V3[] = [[-OB_HEAD, -OB_HEAD, OB_TOP], [OB_HEAD, -OB_HEAD, OB_TOP], [OB_HEAD, OB_HEAD, OB_TOP], [-OB_HEAD, OB_HEAD, OB_TOP]];
  parts.push({ faces: prism([top, top.map((): V3 => [0, 0, OB_TIP])], GLASS, (_k, i, s) => ({ crease: 0.3, paint: (g: Ctx, k: PaintCtx) => glassy(3331 + i)(g, k, s) })), edges: true, inkColour: GLASS_INK, after: [shaft] });
  // Room for its glint, drawn over it (`live`).
  parts.push(loose([-OB_FOOT, -OB_FOOT, 0], [OB_FOOT, OB_FOOT, OB_TIP + 2], () => undefined));
  return { parts, shade: shadeOf(-7, 7, -7, 7) };
}

/** A four-pointed star of light at (x, y), `r` across, `a` strong. */
function star(ctx: Ctx, x: number, y: number, r: number, a: number, colour = '255, 246, 228'): void {
  if (a <= 0.01) return;
  ctx.fillStyle = `rgba(${colour}, ${a.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.18, y - r * 0.18); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.18, y + r * 0.18);
  ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.18, y + r * 0.18); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.18, y - r * 0.18);
  ctx.closePath(); ctx.fill();
}

export const OBSIDIAN_OBELISK: KitPiece = {
  model: () => obeliskOf(), uses: {},
  live: (ctx, sx, sy, zoom, view, _night, t) => {
    const k = OBSIDIAN_FX.glint;
    if (k <= 0) return;
    // At dawn and dusk the low sun runs down its edge: a star of light sliding from the tip down the arris nearest the eye.
    const run = lessMotion() ? 0.2 : (t / 4) % 1;
    const z = OB_TIP - run * (OB_TIP - 8);
    const edge = z > OB_TOP ? ((OB_TIP - z) / (OB_TIP - OB_TOP)) * OB_HEAD : OB_HEAD + ((OB_TOP - z) / (OB_TOP - 3.4)) * (OB_FOOT - OB_HEAD);
    const near: V3 = [view.vx > 0 ? edge : -edge, view.vy > 0 ? edge : -edge, z];
    const [x, y] = onScreen(sx, sy, zoom, view, near);
    star(ctx, x, y, 3.2 * zoom * (0.6 + 0.4 * k), 0.95 * k);
    glow(ctx, x, y, 3 * zoom, 0.5 * k, '255, 214, 170');
  },
};

/* ---- 4. the dragon-glass fountain ------------------------------------------------------------------ */

const { low, mid, top, spout } = FOUNT;

/**
 * A dragon-glass fountain (three subtiles by three): the tiered fountain's
 * three basins at its own heights and reaches (`FOUNT`), so its water is the
 * same water (`drawFountain`), cut in facets of the glass with an ember line
 * round each rim. In three layers as the tiered one, `trim` saying which.
 */
function dragonFountainOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], layer: number, more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, layer, inkColour: GLASS_INK, ...more };
    parts.push(p);
    return p;
  };
  const rimTop = (r: number, inner: number) => (g: Ctx, k: PaintCtx): void => {
    g.fillStyle = css(k.fill); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = css(EMBER, 0.8); g.lineWidth = 0.22;
    g.beginPath(); g.arc(0, 0, (r + inner) / 2, 0, TAU); g.stroke();
  };
  /* -- layer 0: a faceted plinth and the lowest basin -- */
  add(lathe(0, 0, [[0, low.lip + 0.6], [0.7, low.lip + 0.6]], 16, GLASS_DEEP, 0.5, lathed(3401)), 0, { edges: true });
  const basin = add(lathe(0, 0, [[0.7, low.r], [low.rim - 0.75, low.r], [low.rim - 0.65, low.lip], [low.rim, low.lip]], 16, GLASS, 0.5, lathed(3411))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, paint: rimTop(low.lip, low.inner) } : f)), 0, { edges: true });
  const lowHollow = hollow(low.inner, low.rim, low.rim - 1, 0);
  lowHollow.after = [basin];
  parts.push(lowHollow, still(low.inner, low.water, 0, lowHollow));
  /* -- layer 1: the column, cut in eight, and the middle bowl -- */
  add(lathe(0, 0, [[low.water, 2.3], [low.water + 1.1, 2], [6.4, 1.6], [7.6, 1.9], [8.3, 2.4], [mid.under, 2.7]], 8, GLASS, 0.5, lathed(3421)), 1, { edges: true });
  const midBowl = add(lathe(0, 0, [[mid.under, 2.7], [9.5, 4.4], [10.3, 6], [10.9, 7], [mid.rim, mid.r]], 16, GLASS, 0.5, lathed(3431))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, paint: rimTop(mid.r, mid.r - FOUNT_RIM) } : f)), 1, { edges: true });
  const midHollow = hollow(mid.r - FOUNT_RIM, mid.rim, 1.6, 1);
  midHollow.after = [midBowl];
  parts.push(midHollow, still(mid.r - FOUNT_RIM, mid.rim - 0.2, 1, midHollow));
  /* -- layer 2: the column over it, the top bowl and a spout of three shards -- */
  add(lathe(0, 0, [[mid.rim, 1.4], [12.4, 1.15], [13.6, 1.1], [14.1, 1.35], [top.under, 1.7]], 8, GLASS, 0.5, lathed(3441)), 2, { edges: true });
  const topBowl = add(lathe(0, 0, [[top.under, 1.7], [14.9, 2.6], [15.6, 3.4], [top.rim, top.r]], 12, GLASS, 0.5, lathed(3451))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, paint: rimTop(top.r, top.r - FOUNT_RIM) } : f)), 2, { edges: true });
  const topHollow = hollow(top.r - FOUNT_RIM, top.rim, 1, 2);
  topHollow.after = [topBowl];
  const topStill = still(top.r - FOUNT_RIM, top.rim - 0.2, 2, topHollow);
  parts.push(topHollow, topStill);
  add(lathe(0, 0, [[top.rim - 0.4, 1.05], [16.9, 0.72], [17.7, 0.82], [18.4, 1.08], [18.9, 0.88], [spout, 0.55]], 6, GLASS, 0.5, lathed(3461))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, paint: (g: Ctx) => { g.beginPath(); g.arc(0, 0, 0.32, 0, TAU); g.fillStyle = '#4a6a78'; g.fill(); } } : f)), 2, { edges: true, after: [topHollow, topStill] });
  const R = low.lip + 0.6;
  return { parts, shade: shadeRound(R, 16) };
}

export const DRAGON_FOUNTAIN: KitPiece = { model: () => dragonFountainOf(), uses: {}, layers: 3 };

/**
 * The shimmer on a dragon-glass fountain's glass, over its water: a glint
 * running round each rim, held still with animations off or less motion.
 */
export function dragonShimmer(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, t: number, night: number): void {
  const still = lessMotion();
  for (const [i, [r, z]] of ([[low.lip, low.rim], [mid.r, mid.rim], [top.r, top.rim]] as Array<[number, number]>).entries()) {
    for (let j = 0; j < 2; j++) {
      const a = (still ? 0.6 : t * (0.5 + i * 0.17)) + j * Math.PI + i * 1.3;
      const [x, y] = onScreen(sx, sy, zoom, view, [Math.cos(a) * r, Math.sin(a) * r, z]);
      const k = 0.5 + 0.5 * Math.sin(still ? 1 : t * 2.1 + i + j * 2);
      star(ctx, x, y, (1.4 + i * 0.2) * zoom, 0.75 * k, night > 0.4 ? '255, 196, 160' : '255, 248, 236');
    }
  }
}

/* ---- 5. the shard garden --------------------------------------------------------------------------- */

const SPIKES: Array<[number, number, number, number, [number, number], number]> = [
  [-3.2, -2.4, 2.2, 11, [0.4, 0.3], 4], [1.8, -3.4, 1.7, 8.4, [0.9, -0.2], 3], [3.6, 2.2, 1.6, 7.0, [0.6, 0.8], 4], [-1.0, 2.6, 1.3, 5.6, [-0.5, 0.6], 3],
  [-5.2, 3.8, 1.0, 4.2, [-0.7, 0.2], 3], [5.6, -4.8, 1.0, 4.6, [0.6, -0.4], 3], [0.6, 0.0, 1.0, 3.6, [0.2, 0.2], 3],
];

function shardGardenOf(): KitModel {
  const parts: KitPart[] = [];
  // A low bed of ash gravel, edged in rough glass, and the shards up out of it.
  const bed: KitPart = {
    faces: slab(-8.6, 8.6, -8.6, 8.6, 0, 0.8, ASH, {
      corner: 1.6, bevel: 0.3,
      paint: {
        top: (g: Ctx, k: PaintCtx, s: Side) => {
          g.fillStyle = css(k.fill); g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
          const T = rand(3501);
          for (let i = 0; i < 160; i++) {
            g.fillStyle = css(mix(k.fill, T() < 0.5 ? [90, 80, 104] : [250, 246, 244], 0.25 + T() * 0.2), 0.8);
            g.fillRect((T() - 0.5) * s.w, (T() - 0.5) * s.h, 0.35, 0.3);
          }
          // Raked lines round the shards, as a gravel garden is.
          g.strokeStyle = css(mix(k.fill, [110, 100, 120], 0.25), 0.6); g.lineWidth = 0.12;
          for (let r = 2.6; r < 8; r += 1.4) { g.beginPath(); g.ellipse(-1.4, -0.4, r, r * 0.9, 0, 0, TAU); g.stroke(); }
        },
      },
    }),
    first: true,
  };
  parts.push(bed);
  const T = rand(3511);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r = 8.6;
    parts.push({ faces: slab(-0.7, 0.7, -0.5, 0.5, 0, 1.3 + T() * 0.5, GLASS_DEEP, { corner: 0.2, bevel: 0.3 }).map((f) => ({ ...f, pts: f.pts.map(([x, y, z]): V3 => [x * Math.cos(a + Math.PI / 2) - y * Math.sin(a + Math.PI / 2) + Math.cos(a) * r * 0.92, x * Math.sin(a + Math.PI / 2) + y * Math.cos(a + Math.PI / 2) + Math.sin(a) * r * 0.92, z]) })), inkColour: GLASS_INK });
  }
  SPIKES.forEach(([x, y, r, h, lean, n], i) => parts.push({ faces: shard(x, y, r, h, lean, n, i * 0.7, 3521 + i * 7), edges: true, inkColour: GLASS_INK, after: [bed] }));
  return { parts, shade: shadeOf(-8.6, 8.6, -8.6, 8.6) };
}

export const SHARD_GARDEN: KitPiece = { model: () => shardGardenOf(), uses: {} };

/* ---- 6. the obsidian vase -------------------------------------------------------------------------- */

export const OBSIDIAN_VASE: KitPiece = {
  model: (look) => vaseOf(look, GLASS), uses: { trim: true },
  states: [{ trim: vaseTrim(0, false), label: 'empty' }, { trim: vaseTrim(3, false), label: 'full, fresh' }, { trim: vaseTrim(3, true), label: 'full, wilted' }],
};

/* ---- 7. the lava lamp column ----------------------------------------------------------------------- */

const COL_Z0 = 3.2, COL_Z1 = 15.2, COL_R = 1.7;
const MELT: Tone = toneOf('#f6c0a4', '#c47878');

function lavaLampOf(): KitModel {
  const parts: KitPart[] = [];
  const base: KitPart = { faces: lathe(0, 0, [[0, 2.8], [0.8, 2.8], [1.6, 2.2], [COL_Z0 - 0.4, 2.0], [COL_Z0, 2.3]], 8, GLASS_DEEP, 0.5, lathed(3601)), edges: true, inkColour: GLASS_INK };
  parts.push(base);
  // The glass column, a warm amber full of melt, the melt itself drawn over it (`live`).
  const col: KitPart = {
    faces: lathe(0, 0, [[COL_Z0, COL_R], [COL_Z1, COL_R]], 12, MELT, 0.5, (_k, i, s) => ({
      crease: 0.1,
      paint: (g: Ctx, k: PaintCtx) => {
        g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
        g.fillStyle = css(mix(k.fill, [255, 236, 210], 0.5), 0.45);
        if (i % 3 === 0) g.fillRect(s.w * 0.3, 0, s.w * 0.25, s.h);
      },
    })),
    edges: true, inkColour: hex('#8a3a40'), after: [base],
  };
  parts.push(col);
  parts.push({ faces: lathe(0, 0, [[COL_Z1, 2.3], [COL_Z1 + 0.6, 2.0], [COL_Z1 + 1.6, 1.2], [COL_Z1 + 2.4, 0.3]], 8, GLASS, 0.5, lathed(3611)), edges: true, inkColour: GLASS_INK, after: [col] });
  parts.push(loose([-COL_R, -COL_R, COL_Z0], [COL_R, COL_R, COL_Z1], () => undefined));
  return { parts, shade: shadeRound(2.8, 8) };
}

/** The blobs of melt in a column: where each is up it, nought to one, at `t` seconds; held at their still frame with less motion or animations off. */
export const lavaBlobs = (t: number): number[] => [0, 0.37, 0.71].map((o) => ((t / LAVA_RISE + o) % 1));

export const LAVA_LAMP: KitPiece = {
  model: () => lavaLampOf(), uses: {},
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, (COL_Z0 + COL_Z1) / 2]);
    return [{ x, y, r: 3 * zoom, a: 0.9 }, { x, y, r: 8 * zoom, a: 0.3 }];
  },
  live: (ctx, sx, sy, zoom, view, night, t) => {
    const clock = lessMotion() ? 0 : t;
    for (const [i, k] of lavaBlobs(clock).entries()) {
      // Each rises swelling and sinks back thin: rounder in the middle of its rise.
      const z = COL_Z0 + 1 + k * (COL_Z1 - COL_Z0 - 2);
      const sw = Math.sin(k * Math.PI);
      const off = Math.sin(clock * 0.7 + i * 2) * 0.4;
      const [x, y] = onScreen(sx, sy, zoom, view, [off, 0, z]);
      ctx.fillStyle = css(mix(EMBER_HOT, [255, 250, 230], 0.3), 0.92);
      ctx.beginPath(); ctx.ellipse(x, y, (0.6 + sw * 0.6) * zoom, (0.9 + sw * 1.1) * zoom * HEIGHT_SCALE * 0.5, 0, 0, TAU); ctx.fill();
    }
    const [cx, cy] = onScreen(sx, sy, zoom, view, [0, 0, (COL_Z0 + COL_Z1) / 2]);
    glow(ctx, cx, cy, (night > 0.02 ? 9 : 4) * zoom, night > 0.02 ? 0.5 * night : 0.18, EMBER_GLOW);
  },
};

/* ---- 9. the obsidian bust -------------------------------------------------------------------------- */

function glassBustOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  parts.push({ faces: slab(-3, 3, -3, 3, 0, 1.0, GLASS_DEEP, { corner: 0.2, bevel: 0.3, paint: glassSides(3701) }), edges: true, inkColour: GLASS_INK });
  parts.push({ faces: slab(-2.3, 2.3, -2.3, 2.3, 1.0, BUST_PLINTH - 1.0, GLASS, { corner: 0.2, paint: glassSides(3711) }), edges: true, inkColour: GLASS_INK });
  parts.push({ faces: slab(-2.8, 2.8, -2.8, 2.8, BUST_PLINTH - 1.0, BUST_PLINTH, GLASS_DEEP, { corner: 0.2, bevel: 0.3, paint: glassSides(3721) }), edges: true, inkColour: GLASS_INK });
  if (!said(look.trim)) parts.push({ faces: slab(-2.0, 2.0, -1.7, 1.7, BUST_PLINTH, BUST_PLINTH + 5.2, GLASS, { corner: 0.5, taper: 0.3, paint: glassSides(3731) }), edges: true, inkColour: GLASS_INK });
  parts.push(loose([-3.4, -2.4, 0], [3.4, 2.4, BUST_PLINTH + 7.4], () => undefined));
  return { parts, shade: shadeOf(-3, 3, -3, 3) };
}

export const OBSIDIAN_BUST: KitPiece = {
  model: (look) => glassBustOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'uncarved' }, { trim: 1, label: 'carved' }],
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, BUST_PLINTH]);
    bust.draw?.(ctx, x, y, zoom, view, air?.seed ?? -1, true);
  },
};

/* ---- 10. the glass shard path ---------------------------------------------------------------------- */

/** Shards along a path's length, each its own, from its left end to its right. */
const PATH_SHARDS = 9;
const PATH_Y = 1.4;

function shardPathOf(): KitModel {
  const parts: KitPart[] = [];
  const bed: KitPart = { faces: slab(-19.6, 19.6, PATH_Y - 2.2, PATH_Y + 2.2, 0, 0.35, ASH, { corner: 0.6 }), first: true };
  parts.push(bed);
  const T = rand(3801);
  for (let i = 0; i < PATH_SHARDS; i++) {
    const x = -17.6 + (i * 35.2) / (PATH_SHARDS - 1) + (T() - 0.5) * 1.2;
    parts.push({ faces: shard(x, PATH_Y + (T() - 0.5) * 0.8, 0.9 + T() * 0.4, 2.2 + T() * 1.8, [(T() - 0.5) * 0.8, (T() - 0.5) * 0.6], 3, T() * TAU, 3811 + i * 5), edges: true, inkColour: GLASS_INK, after: [bed] });
  }
  parts.push(loose([-19.6, PATH_Y - 2.2, 0], [19.6, PATH_Y + 2.2, 4.6], () => undefined));
  return { parts, shade: null };
}

export const SHARD_PATH: KitPiece = {
  model: () => shardPathOf(), uses: {},
  live: (ctx, sx, sy, zoom, view, night, t) => {
    if (night <= 0.05) return;
    // At night the shards catch what light there is: a glint now on one, now on another.
    const T = rand(3801), clock = lessMotion() ? 0 : t;
    for (let i = 0; i < PATH_SHARDS; i++) {
      const x = -17.6 + (i * 35.2) / (PATH_SHARDS - 1) + (T() - 0.5) * 1.2;
      T(); T(); T(); T(); T(); T();
      const k = Math.max(0, Math.sin(clock * 0.9 + i * 2.3));
      const [px, py] = onScreen(sx, sy, zoom, view, [x, PATH_Y, 2.6]);
      star(ctx, px, py, 1.5 * zoom, 0.85 * night * k * k, '236, 226, 255');
    }
  },
};

/* ---- 11. the ember orb on a stand ------------------------------------------------------------------ */

const ORB_Z = 11.2, ORB_R = 2.4;
const ORB: Tone = toneOf('#fcc4a0', '#d07a74');

function emberOrbOf(): KitModel {
  const parts: KitPart[] = [];
  const stand: KitPart = { faces: lathe(0, 0, [[0, 3.0], [0.9, 3.0], [1.6, 1.4], [6.5, 0.9], [7.4, 1.4], [8.6, 1.8], [9.2, 2.2]], 6, GLASS, 0.5, lathed(3901)), edges: true, inkColour: GLASS_INK };
  parts.push(stand);
  // Three claws of glass holding it, and the orb.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    parts.push({ faces: rod([Math.cos(a) * 1.8, Math.sin(a) * 1.8, 9.0], [Math.cos(a) * 2.3, Math.sin(a) * 2.3, 11.2], 0.32, GLASS_DEEP, 4), inkColour: GLASS_INK, after: [stand] });
  }
  const prof: Array<[number, number]> = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 6) * Math.PI;
    return [ORB_Z - Math.cos(a) * ORB_R, Math.max(0.01, Math.sin(a) * ORB_R)];
  });
  parts.push({ faces: lathe(0, 0, prof, 12, ORB, 0.5, () => ({ crease: 0.05 })), edges: true, inkColour: hex('#a8484c'), after: [stand] });
  return { parts, shade: shadeRound(3, 8) };
}

export const EMBER_ORB: KitPiece = {
  model: () => emberOrbOf(), uses: {},
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, ORB_Z]);
    return [{ x, y, r: 3 * zoom, a: 0.95 }, { x, y, r: 9 * zoom, a: 0.32 }];
  },
  live: (ctx, sx, sy, zoom, view, night, t) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, ORB_Z]);
    const breath = lessMotion() ? 0 : Math.sin(t * 1.4) * 0.06;
    // Dim by day, a small warmth round it; bright by night, out as far as its light.
    glow(ctx, x, y, (3.6 + night * 7) * zoom * (1 + breath), 0.22 + 0.45 * night, EMBER_GLOW);
    ctx.fillStyle = css(mix(EMBER_HOT, [255, 250, 236], 0.4), 0.55 + 0.35 * night);
    ctx.beginPath(); ctx.ellipse(x - 0.7 * zoom, y - 0.8 * zoom, 0.7 * zoom, 0.5 * zoom, -0.5, 0, TAU); ctx.fill();
  },
};

