import { WALL_THICK } from '../../game/building';
import { HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import { rand } from '../ivy';
import { eyeOfView } from '../runestone';
import {
  BRASS, clothTone, css, deeper, grain, hex, lathe, mix, paler, proj, slab, TAU, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { leg, rod, woodSides, woodSide } from './woodwork';
import { BLOCK, DRESSED, stoneSkin, strut } from './outdoor';
import { flame, glow } from './hearthstone';
import { bedOf } from './beds';
import { gardenFx } from './garden';

/**
 * The furnishings (`furnish.ts`), in the kit: a birdbath, a stone bench, a
 * garden swing in its own frame, a gazebo, a hay bale stack, a water trough,
 * a signpost, a cairn, a fireplace, a four-poster bed, a vase, a side table,
 * a footstool and a trophy fish mount.
 *
 * Each piece's `trim` is what it holds and how it stands, worked out by the
 * renderer off what the island keeps (`furnishTrim` in `render/furnishlook.ts`)
 * and read back here. A birdbath's songbirds are drawn over its bake each
 * frame, as a birdhouse's are.
 */

const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
const said = (trim: number | undefined): number => (trim && trim > 0 ? Math.floor(trim) - 1 : -1);
const across = (e: { ux: number; vx: number }): number => Math.hypot(e.ux, e.vx);
const skin = (seed: number, k = 1) => (g: Ctx, kk: PaintCtx, s: Side): void => stoneSkin(g, kk.fill, s.w, s.h, seed, k);
const stoneSides = (seed: number) => ({ front: skin(seed), back: skin(seed + 1), left: skin(seed + 2), right: skin(seed + 3) });
/** Water seen from above: pale, deeper toward its middle, a glint of sky. */
const WATER: Tone = toneOf('#bfe3ea', '#6f9cb2');
const waterTop = (g: Ctx, _k: PaintCtx, s: Side): void => {
  const gr = g.createRadialGradient(-s.w * 0.15, -s.h * 0.1, 0, 0, 0, Math.max(s.w, s.h) * 0.6);
  gr.addColorStop(0, '#e4f6f6');
  gr.addColorStop(1, '#86b8c8');
  g.fillStyle = gr;
  g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
  g.strokeStyle = 'rgba(250, 252, 255, 0.7)';
  g.lineWidth = 0.18;
  g.beginPath(); g.ellipse(s.w * 0.12, s.h * 0.05, s.w * 0.16, s.h * 0.08, 0, 0.2, 2.6); g.stroke();
};
/** A loose drawing's box, from two corners. */
const loose = (a: V3, b: V3, draw: (g: Ctx, e: import('../runestone').Eye) => void, solid = true, pad = 0): KitPart => ({
  reach: [0, 1, 2, 3, 4, 5, 6, 7].map((i): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]), draw, solid, ...(pad ? { pad } : {}),
});

/* ---- 1. the birdbath -------------------------------------------------------------------------- */

const BATH_Z = 8.2, BATH_R = 3.6;

function birdbathOf(): KitModel {
  const parts: KitPart[] = [];
  parts.push({ faces: lathe(0, 0, [[0, 2.6], [0.6, 2.6], [0.9, 1.9], [1.3, 1.25]], 8, BLOCK, 0.5, (_k, i, s) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => skin(11 + i)(g, k, s) })), edges: true });
  parts.push({ faces: lathe(0, 0, [[1.3, 1.05], [3.5, 0.82], [5.6, 0.9], [6.6, 1.2]], 8, DRESSED, 0.5, (_k, i, s) => ({ crease: 0.18, paint: (g: Ctx, k: PaintCtx) => skin(21 + i, 0.8)(g, k, s) })), edges: true });
  // The basin: a shallow round of dressed stone, its rim rolled, the water in it a hand down.
  const basin: KitPart = {
    faces: lathe(0, 0, [[6.6, 1.2], [7.2, 2.6], [7.8, 3.4], [BATH_Z, BATH_R]], 12, DRESSED, 0.5, (_k, i, s) => ({ crease: 0.16, paint: (g: Ctx, k: PaintCtx) => skin(31 + i, 0.7)(g, k, s) }))
      .map((f, j, all) => (j === all.length - 1 ? { ...f, tone: WATER, paint: (g: Ctx, k: PaintCtx) => {
        // The rim's top, and the water inside it.
        g.fillStyle = css(DRESSED.lit);
        g.beginPath(); g.arc(0, 0, BATH_R, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(0, 0, BATH_R - 0.5, 0, TAU); g.clip();
        waterTop(g, k, { w: BATH_R * 2, h: BATH_R * 2 } as Side);
        g.restore();
        g.strokeStyle = css(mix(DRESSED.shade, hex('#5a4660'), 0.3), 0.8); g.lineWidth = 0.14;
        g.beginPath(); g.arc(0, 0, BATH_R - 0.5, 0, TAU); g.stroke();
      } } : f)),
    edges: true,
  };
  parts.push(basin);
  // Room for the songbirds on the rim, drawn over the bake (`songbirds`).
  parts.push(loose([-BATH_R - 4, -BATH_R - 4, BATH_Z], [BATH_R + 4, BATH_R + 4, BATH_Z + 5], () => undefined));
  return { parts, shade: shadeOf(-2.6, 2.6, -2.6, 2.6) };
}

/**
 * Songbirds at a birdbath, drawn each frame: by day and out of winter, as a
 * birdhouse's (`birdsAbout`); one or two at a time on the rim, each landing,
 * dipping to drink a few times, and flying off, on a beat of its own.
 */
function songbirds(ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, night: number, t: number, seed: number): void {
  if (!gardenFx.birds || night >= 0.5 || gardenFx.season === 'winter' || zoom < 0.6) return;
  const e = eyeOfView(view);
  const n = Math.max(1, Math.round(2 * gardenFx.share));
  for (let i = 0; i < n; i++) {
    const period = 9 + i * 3.7, ph = ((t + seed * 1.3 + i * 4.1) % period) / period;
    const a = i * 2.4 + seed;
    const [rx, ry] = proj(e, [Math.cos(a) * (BATH_R - 0.2), Math.sin(a) * (BATH_R - 0.2), BATH_Z]);
    // In from above for the first tenth, on the rim drinking until nine tenths, off again after.
    const air = ph < 0.1 ? 1 - ph / 0.1 : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;
    const x = sx + (rx + air * 8 * (i ? 1 : -1)) * zoom, y = sy + (ry - air * 6) * zoom;
    const dip = air === 0 && Math.sin(t * 5 + i * 3) > 0.6 ? 1 : 0;
    const flap = air > 0 ? (Math.sin(t * 24 + i) > 0 ? 1 : -1) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(zoom, zoom);
    ctx.fillStyle = i % 2 ? '#7d8fa8' : '#a0705a';
    ctx.beginPath(); ctx.ellipse(0, -0.9, 1.25, 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = i % 2 ? '#e6eef0' : '#f0c890';
    ctx.beginPath(); ctx.ellipse(0.25, -0.65, 0.75, 0.45, 0, 0, TAU); ctx.fill();
    // The head, down at the water or up.
    ctx.fillStyle = i % 2 ? '#5e6e88' : '#7a4e40';
    ctx.beginPath(); ctx.arc(1.05, dip ? -0.35 : -1.6, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b04a';
    ctx.beginPath(); ctx.moveTo(1.5, dip ? -0.3 : -1.65); ctx.lineTo(2.05, dip ? 0 : -1.5); ctx.lineTo(1.5, dip ? -0.1 : -1.45); ctx.fill();
    ctx.strokeStyle = '#4e3a44'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(-1.2, -1); ctx.lineTo(-2, -1.4); ctx.stroke();
    if (flap) { ctx.beginPath(); ctx.moveTo(-1.4, -1.2 - flap * 0.8); ctx.lineTo(0, -1); ctx.lineTo(1.4, -1.2 - flap * 0.8); ctx.stroke(); }
    ctx.restore();
  }
}

export const BIRDBATH: KitPiece = {
  model: () => birdbathOf(), uses: {}, wind: true,
  live: (ctx, sx, sy, zoom, view, night, t, air) => songbirds(ctx, sx, sy, zoom, view, night, air?.t ?? t, air?.seed ?? 0),
};

/* ---- 2. the stone bench ------------------------------------------------------------------------ */

function stoneBenchOf(): KitModel {
  const parts: KitPart[] = [];
  // Two slab ends, cut with a notch under, and the long slab over them.
  for (const [i, x] of [-6.6, 6.6].entries()) {
    parts.push({ faces: slab(x - 1.1, x + 1.1, -2.2, 2.2, 0, 3.6, BLOCK, { corner: 0.3, bevel: 0.15, paint: stoneSides(41 + i * 4) }), edges: true });
    parts.push({ faces: slab(x - 1.5, x + 1.5, -2.6, 2.6, 0, 0.5, deeper(BLOCK, 0.12), { corner: 0.3, paint: stoneSides(61 + i * 4) }), edges: true });
  }
  parts.push({ faces: slab(-9.2, 9.2, -2.9, 2.9, 3.6, 4.7, DRESSED, { corner: 0.5, bevel: 0.3, paint: { ...stoneSides(51), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); stoneSkin(g, k.fill, s.w, s.h, 55, 0.8); g.restore(); } } }), edges: true });
  return { parts, shade: shadeOf(-9.2, 9.2, -2.9, 2.9) };
}

export const STONE_BENCH: KitPiece = { model: () => stoneBenchOf(), uses: {} };

/* ---- 3. the garden swing -------------------------------------------------------------------------- */

/** A swing's trim: nought hanging still, else one more than the frame of its sway (`SWING_FRAMES` round). */
export const SWING_FRAMES = 8;
export const swingTrim = (frame: number | null): number => (frame === null ? 0 : 1 + (((Math.floor(frame) % SWING_FRAMES) + SWING_FRAMES) % SWING_FRAMES));
const SW_X = 12.4, SW_TOP = 22, SW_SEAT = 4.6, SW_SPLAY = 6.2;
const ROPE: Tone = toneOf('#e9d3a6', '#a88a74');

function swingOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  // The frame: an A of two legs at either end and the beam across their heads.
  for (const [i, x] of [-SW_X, SW_X].entries()) {
    for (const y of [-SW_SPLAY, SW_SPLAY]) parts.push({ faces: strut([x, y, 0], [x, 0, SW_TOP], 1.0, 1.0, W, woodSide(71 + i, 'x')), edges: true });
    parts.push({ faces: strut([x, -SW_SPLAY * 0.55, 6.5], [x, SW_SPLAY * 0.55, 6.5], 0.6, 0.6, deeper(W, 0.1)) });
  }
  parts.push({ faces: slab(-SW_X - 1.2, SW_X + 1.2, -0.7, 0.7, SW_TOP - 0.4, SW_TOP + 1.0, W, { corner: 0.2, bevel: 0.2, paint: woodSides(81, 'x') }), edges: true });
  // The seat on its ropes, swung forward and back about the beam by its frame.
  const f = said(look.trim);
  const ang = f < 0 ? 0 : 0.3 * Math.sin((f / SWING_FRAMES) * TAU);
  const swung = (p: V3): V3 => {
    const dz = SW_TOP - p[2], dy = p[1];
    return [p[0], dy * Math.cos(ang) + dz * Math.sin(ang), SW_TOP - (dz * Math.cos(ang) - dy * Math.sin(ang))];
  };
  const seatFaces = (faces: Face[]): Face[] => faces.map((fc) => ({ ...fc, pts: fc.pts.map(swung), frame: fc.frame ? { ...fc.frame, o: swung(fc.frame.o) } : undefined }));
  for (const x of [-7.6, 7.6]) {
    for (const y of [-1.6, 1.6]) parts.push({ faces: rod(swung([x, y * 0.4, SW_TOP - 0.2]), swung([x, y, SW_SEAT + 0.6]), 0.16, ROPE, 4) });
  }
  parts.push({ faces: seatFaces(slab(-8.2, 8.2, -2.2, 2.2, SW_SEAT, SW_SEAT + 0.6, paler(W, 0.08), { corner: 0.3, bevel: 0.15, paint: woodSides(91, 'x') })), edges: true });
  parts.push({ faces: seatFaces(slab(-8.2, 8.2, -2.4, -1.8, SW_SEAT + 0.6, SW_SEAT + 4.2, W, { corner: 0.2, bevel: 0.15, paint: woodSides(93, 'x') })), edges: true });
  return { parts, shade: shadeOf(-SW_X - 1.2, SW_X + 1.2, -SW_SPLAY - 0.6, SW_SPLAY + 0.6) };
}

export const GARDEN_SWING: KitPiece = {
  model: (look) => swingOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: swingTrim(null), label: 'still' }, { trim: swingTrim(2), label: 'swung forward' }, { trim: swingTrim(6), label: 'swung back' }],
};

/* ---- 4. the gazebo ------------------------------------------------------------------------------ */

const GZ_R = 11.4, GZ_FLOOR = 1.4, GZ_EAVE = 21, GZ_PEAK = 30;
const THATCH: Tone = toneOf('#ecd398', '#a88a64');

function gazeboOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  const frame: KitPart[] = [];
  const n = 6, at = (i: number, r: number): [number, number] => [Math.cos(((i + 0.5) / n) * TAU) * r, Math.sin(((i + 0.5) / n) * TAU) * r];
  // A floor of boards on a low hexagon.
  parts.push({ faces: lathe(0, 0, [[0, GZ_R + 0.6], [GZ_FLOOR, GZ_R + 0.6]], n, deeper(W, 0.15), 0.5, (k, i, s) => ({ crease: 0.25, paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, s.w, s.h, 101 + i, 'x', 0.6) })), edges: true, first: true });
  // Posts at the corners; rails between them, all round but the front.
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i, GZ_R - 0.4);
    const post: KitPart = { faces: slab(x - 0.6, x + 0.6, y - 0.6, y + 0.6, GZ_FLOOR, GZ_EAVE, W, { corner: 0.15, bevel: 0.1, paint: woodSides(111 + i, 'y') }), edges: true };
    parts.push(post);
    frame.push(post);
    const [x2, y2] = at(i + 1, GZ_R - 0.4);
    const front = (y + y2) / 2 > GZ_R * 0.6;
    if (!front) {
      for (const z of [GZ_FLOOR + 3.2, GZ_FLOOR + 7.4]) parts.push({ faces: strut([x, y, z], [x2, y2, z], 0.5, 0.5, paler(W, 0.06), woodSide(121 + i, 'x')) });
      // A bench round the inside of the rails.
      const [bx, by] = at(i, GZ_R - 2.6), [bx2, by2] = at(i + 1, GZ_R - 2.6);
      parts.push({ faces: strut([bx, by, GZ_FLOOR + 4.3], [bx2, by2, GZ_FLOOR + 4.3], 2.2, 0.5, paler(W, 0.1), woodSide(131 + i, 'x')) });
    }
    const plate: KitPart = { faces: strut([x, y, GZ_EAVE - 0.6], [x2, y2, GZ_EAVE - 0.6], 0.8, 1.2, deeper(W, 0.08), woodSide(141 + i, 'x')) };
    parts.push(plate);
    frame.push(plate);
  }
  // The roof: six faces of thatch up to a finial, out past the posts at the eaves.
  const thatch = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
    const T = rand(seed);
    for (let i = 0; i < 70; i++) {
      const x = T() * s.w, y = T() * s.h;
      g.strokeStyle = css(T() < 0.5 ? mix(k.fill, hex('#7a5e44'), 0.4) : mix(k.fill, [255, 246, 214], 0.35), 0.7);
      g.lineWidth = 0.12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (T() - 0.5) * 0.4, y + 1.2 + T() * 1.2); g.stroke();
    }
    for (let y = 1.6; y < s.h; y += 2.2) { g.fillStyle = css(mix(k.fill, hex('#5a4248'), 0.35), 0.5); g.fillRect(0, y, s.w, 0.25); }
  };
  parts.push({ faces: lathe(0, 0, [[GZ_EAVE - 0.4, GZ_R + 2.2], [GZ_EAVE + 0.6, GZ_R + 2.0], [GZ_PEAK - 2.2, 2.2], [GZ_PEAK - 1.2, 0.9]], n, THATCH, 0.5, (_k, i, s) => ({ crease: 0.25, paint: (g: Ctx, kk: PaintCtx) => thatch(151 + i)(g, kk, s) })), edges: true, after: frame });
  parts.push({ faces: lathe(0, 0, [[GZ_PEAK - 1.3, 1.0], [GZ_PEAK - 0.4, 1.2], [GZ_PEAK + 0.6, 0.7], [GZ_PEAK + 1.6, 0.05]], 8, W), edges: true });
  return { parts, shade: shadeOf(-GZ_R - 1, GZ_R + 1, -GZ_R - 1, GZ_R + 1) };
}

export const GAZEBO: KitPiece = { model: (look) => gazeboOf(look), uses: { material: true, tint: true } };

/* ---- 5. the hay bale stack --------------------------------------------------------------------- */

/** A stack's trim: one more than how many bales of `HAY_BALES` it shows, by the grass left. */
export const HAY_BALES = 6;
export const hayTrim = (left: number, holds: number): number => 1 + Math.max(0, Math.min(HAY_BALES, Math.ceil((left / holds) * HAY_BALES)));
const STRAW: Tone = toneOf('#ece0b4', '#ab9a7c');
const straw = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
  const T = rand(seed);
  for (let i = 0; i < 40; i++) {
    const x = T() * s.w, y = T() * s.h;
    g.strokeStyle = css(T() < 0.5 ? mix(k.fill, hex('#9a7c48'), 0.5) : mix(k.fill, [255, 250, 220], 0.5), 0.75);
    g.lineWidth = 0.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.9 + T(), y + (T() - 0.5) * 0.5); g.stroke();
  }
  // Two twines round it.
  g.fillStyle = css(mix(k.fill, hex('#6a4e3a'), 0.55));
  for (const u of [0.3, 0.7]) g.fillRect(u * s.w - 0.12, 0, 0.24, s.h);
};

function hayOf(look: KitLook): KitModel {
  const t = said(look.trim);
  const shown = t < 0 ? HAY_BALES : t;
  const parts: KitPart[] = [];
  // Three on the ground, two on them, one on top: the top ones go first as it is eaten.
  const spots: Array<[number, number, number]> = [[-5.6, 0, 0], [0, 0.2, 0], [5.6, -0.2, 0], [-2.8, 0, 1], [2.8, 0.1, 1], [0, 0, 2]];
  for (let i = 0; i < Math.min(shown, spots.length); i++) {
    const [x, y, row] = spots[i];
    const z = row * 3.4;
    parts.push({ faces: slab(x - 2.7, x + 2.7, y - 5.4, y + 5.4, z, z + 3.4, i % 2 ? paler(STRAW, 0.06) : STRAW, {
      corner: 0.5, bevel: 0.35, paint: { front: straw(161 + i), back: straw(171 + i), left: straw(181 + i), right: straw(191 + i), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); straw(201 + i)(g, k, s); g.restore(); } },
    }), edges: true });
  }
  if (!shown) parts.push({ faces: slab(-8, 8, -5.4, 5.4, 0, 0.3, deeper(STRAW, 0.2), { paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); straw(211)(g, k, s); g.restore(); } } }) });
  return { parts, shade: shadeOf(-8.4, 8.4, -5.6, 5.6) };
}

export const HAY_BALE: KitPiece = {
  model: (look) => hayOf(look), uses: { trim: true },
  states: [{ trim: hayTrim(20, 20), label: 'full' }, { trim: hayTrim(9, 20), label: 'half' }, { trim: hayTrim(0, 20), label: 'eaten' }],
};

/* ---- 6. the water trough ------------------------------------------------------------------------ */

/** A trough's trim: one more than its water in quarters, nought to four. */
export const troughTrim = (litres: number, holds: number): number => 1 + Math.max(0, Math.min(4, Math.ceil((litres / holds) * 4)));
const TR_X = 9, TR_Y = 3.2, TR_Z0 = 2.2, TR_Z1 = 6.6, TR_T = 0.55;

function troughOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  // Two trestles, and the trough on them: staves bound with two iron hoops, a barrel's.
  for (const [i, x] of [-6.2, 6.2].entries()) {
    parts.push({ faces: leg(x, -TR_Y + 0.8, 0, TR_Z0, deeper(W, 0.12), 211 + i) });
    parts.push({ faces: leg(x, TR_Y - 0.8, 0, TR_Z0, deeper(W, 0.12), 215 + i) });
    parts.push({ faces: slab(x - 0.5, x + 0.5, -TR_Y, TR_Y, TR_Z0 - 0.6, TR_Z0, deeper(W, 0.1)) });
  }
  const staves = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    grain(g, k.fill, s.w, s.h, seed, 'x', 0.6);
    g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.5), 0.7);
    for (let y = s.h / 4; y < s.h; y += s.h / 4) g.fillRect(0, y - 0.06, s.w, 0.12);
    for (const u of [0.18, 0.82]) {
      g.fillStyle = css(mix(hex('#8a92a8'), k.fill, 0.2)); g.fillRect(u * s.w - 0.35, 0, 0.7, s.h);
    }
  };
  const sides = { front: staves(221), back: staves(222), left: staves(223), right: staves(224) };
  parts.push({ faces: slab(-TR_X, TR_X, TR_Y - TR_T, TR_Y, TR_Z0, TR_Z1, W, { paint: sides }), edges: true });
  parts.push({ faces: slab(-TR_X, TR_X, -TR_Y, -TR_Y + TR_T, TR_Z0, TR_Z1, W, { paint: sides }), edges: true });
  parts.push({ faces: slab(-TR_X, -TR_X + TR_T, -TR_Y + TR_T, TR_Y - TR_T, TR_Z0, TR_Z1, W, { paint: sides }), edges: true });
  parts.push({ faces: slab(TR_X - TR_T, TR_X, -TR_Y + TR_T, TR_Y - TR_T, TR_Z0, TR_Z1, W, { paint: sides }), edges: true });
  const level = said(look.trim) < 0 ? 3 : said(look.trim);
  parts.push({ faces: slab(-TR_X + TR_T, TR_X - TR_T, -TR_Y + TR_T, TR_Y - TR_T, TR_Z0, TR_Z0 + 0.4, deeper(W, 0.3)), solid: false });
  if (level > 0) {
    const z = TR_Z0 + 0.4 + (TR_Z1 - TR_Z0 - 1.1) * (level / 4);
    parts.push({ faces: slab(-TR_X + TR_T, TR_X - TR_T, -TR_Y + TR_T, TR_Y - TR_T, TR_Z0 + 0.4, z, WATER, { paint: { top: waterTop } }), solid: false });
  }
  return { parts, shade: shadeOf(-TR_X, TR_X, -TR_Y, TR_Y) };
}

export const WATER_TROUGH: KitPiece = {
  model: (look) => troughOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: troughTrim(0, 40), label: 'empty' }, { trim: troughTrim(15, 40), label: 'half' }, { trim: troughTrim(40, 40), label: 'full' }],
};

/* ---- 7. the signpost ---------------------------------------------------------------------------- */

/**
 * A post's trim: each of up to four arms, top down, the way it points in the
 * post's own frame in sixteenths of a turn from its right (`x`) toward its
 * front, one more than that, five bits an arm; nought for none.
 */
export const SIGN_STEPS = 16;
export const signTrim = (angles: readonly number[]): number =>
  angles.slice(0, 4).reduce((n, a, i) => n + (1 + ((Math.round((a / TAU) * SIGN_STEPS) % SIGN_STEPS) + SIGN_STEPS) % SIGN_STEPS) * 32 ** i, 0);
const SP_TOP = 22;

function signpostOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  const t = Math.max(0, Math.floor(look.trim ?? 0));
  parts.push({ faces: slab(-1.2, 1.2, -1.2, 1.2, 0, 0.8, deeper(W, 0.2), { corner: 0.3 }), edges: true });
  const post: KitPart = { faces: slab(-0.65, 0.65, -0.65, 0.65, 0, SP_TOP, W, { corner: 0.18, bevel: 0.25, paint: woodSides(231, 'y') }), edges: true };
  parts.push(post);
  parts.push({ faces: lathe(0, 0, [[SP_TOP, 0.8], [SP_TOP + 0.5, 0.95], [SP_TOP + 1.2, 0.5], [SP_TOP + 1.5, 0.05]], 8, deeper(W, 0.1)), edges: true });
  const board = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    grain(g, k.fill, s.w, s.h, seed, 'x', 0.6);
    // Letters painted along it: a row of short dark strokes.
    g.fillStyle = css(mix(k.fill, hex('#3a2c36'), 0.75), 0.85);
    for (let x = s.w * 0.12; x < s.w * 0.72; x += 0.75) g.fillRect(x, s.h * 0.35, 0.45, s.h * 0.3);
  };
  for (let i = 0; i < 4; i++) {
    const code = Math.floor(t / 32 ** i) % 32;
    if (!code) continue;
    const a = ((code - 1) / SIGN_STEPS) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const z = SP_TOP - 2.2 - i * 2.6, len = 8.6, h = 2.0;
    // A board out from the post, pointed at its far end, turned to its bearing.
    const pts = (y: number): V3[] => [[0.4, y, z - h / 2], [len - 1, y, z - h / 2], [len, y, z], [len - 1, y, z + h / 2], [0.4, y, z + h / 2]];
    const turn = (p: V3): V3 => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca, p[2]];
    const front = pts(0.22).map(turn), back = pts(-0.22).map(turn);
    const faces: Face[] = [
      { pts: front, n: turn([0, 1, 0]), tone: paler(W, 0.1), crease: 0.4, frame: { o: turn([0.4, 0.22, z - h / 2]), a: turn([1, 0, 0]), b: [0, 0, 1] }, paint: (g: Ctx, k: PaintCtx) => board(241 + i)(g, k, { w: len, h } as Side) },
      { pts: back.slice().reverse(), n: turn([0, -1, 0]), tone: paler(W, 0.1), crease: 0.4 },
    ];
    for (let j = 0; j < 5; j++) {
      const k2 = (j + 1) % 5;
      const mid: V3 = [(front[j][0] + front[k2][0]) / 2, (front[j][1] + front[k2][1]) / 2, (front[j][2] + front[k2][2]) / 2];
      const outward: V3 = [mid[0] - ca * len * 0.5, mid[1] - sa * len * 0.5, mid[2] - z];
      const m = Math.hypot(...outward) || 1;
      faces.push({ pts: [front[j], front[k2], back[k2], back[j]], n: [outward[0] / m, outward[1] / m, outward[2] / m], tone: W, crease: 0.4 });
    }
    parts.push({ faces, edges: true, after: [post] });
  }
  parts.push(loose([-8, -8, 0], [8, 8, SP_TOP + 1.5], () => undefined));
  return { parts, shade: shadeOf(-1.2, 1.2, -1.2, 1.2) };
}

export const SIGNPOST: KitPiece = {
  model: (look) => signpostOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: 0, label: 'no arms' },
    { trim: signTrim([0.6]), label: 'one arm' },
    { trim: signTrim([0.3, 2.4, 4.1, 5.5]), label: 'four arms' },
  ],
};

/* ---- 8. the cairn ------------------------------------------------------------------------------- */

const CAIRN_STONE: RGB[] = [hex('#e2d4c4'), hex('#d6cabc'), hex('#ead8c2'), hex('#cfc4c0')];

function cairnOf(): KitModel {
  const parts: KitPart[] = [];
  const T = rand(251);
  // Rough stones heaped and stacked, the biggest at the foot: five rings of them to a capstone.
  const rows: Array<[number, number, number]> = [[2.9, 6, 1.6], [2.0, 5, 1.5], [1.2, 4, 1.4], [0.6, 3, 1.3], [0.3, 2, 1.2], [0, 1, 1.3]];
  let z = 0;
  rows.forEach(([r, n, h], ri) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ri * 0.7, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const w = 1.3 + T() * 0.7 - ri * 0.12, d = 1.1 + T() * 0.5;
      const tone: Tone = { lit: CAIRN_STONE[(i + ri) % 4], shade: mix(CAIRN_STONE[(i + ri) % 4], hex('#7a6878'), 0.42) };
      parts.push({
        faces: lathe(x, y, [[z, w * 0.75], [z + h * 0.35, w], [z + h * 0.8, w * 0.85], [z + h, w * 0.4]], 6, tone, T(), (_k, j, s) => ({ crease: 0.25, paint: (g: Ctx, k: PaintCtx) => skin(261 + ri * 10 + i + j, 1.1)(g, k, s) })),
        edges: true,
      });
      void d;
    }
    z += h * 0.9;
  });
  return { parts, shade: shadeOf(-4.4, 4.4, -4.4, 4.4) };
}

export const CAIRN: KitPiece = { model: () => cairnOf(), uses: {} };

/* ---- 9. the fireplace ---------------------------------------------------------------------------- */

/** Where a wall's face is, from the middle of the row of spots along it: toward the piece's front (the window box's). */
const FACE_Y = UNITS_PER_TILE / 8 - WALL_THICK * UNITS_PER_TILE;
const BRICK: Tone = toneOf('#eab8a0', '#a8787e');
const FP_X = 8.6, FP_D = 3.4, FP_MANTEL = 12.4, FP_TOP = 26, FB_X = 4.6, FB_Z = 8.4;

function fireplaceOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - FP_D;
  const bricks = (seed: number, opening = false) => (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
    const T = rand(seed);
    const joint = css(mix(k.fill, hex('#f4e6dc'), 0.55), 0.85);
    for (let r = 0, y = 0; y < s.h; r++, y += 0.9) {
      g.fillStyle = joint; g.fillRect(0, y, s.w, 0.12);
      for (let x = r % 2 ? -0.9 : 0; x < s.w; x += 1.8) { g.fillRect(x, y, 0.12, 0.9); g.fillStyle = css(mix(k.fill, T() < 0.5 ? hex('#c06a5a') : hex('#f2cdb4'), 0.25), 0.5); g.fillRect(x + 0.15, y + 0.15, 1.6, 0.7); g.fillStyle = joint; }
    }
    if (opening) {
      // The firebox's mouth, an arch, black inside with the back's soot.
      const cx = s.w / 2;
      g.fillStyle = '#3a2a32';
      g.beginPath(); g.moveTo(cx - FB_X, 0); g.lineTo(cx - FB_X, FB_Z - 2); g.quadraticCurveTo(cx, FB_Z + 1.2, cx + FB_X, FB_Z - 2); g.lineTo(cx + FB_X, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120, 80, 70, 0.5)';
      g.fillRect(cx - FB_X + 0.6, 0, FB_X * 2 - 1.2, 1.2);
      // Two logs on the hearth.
      g.fillStyle = '#7a5242';
      g.fillRect(cx - 2.6, 0.4, 5.2, 0.9); g.fillRect(cx - 2.0, 1.2, 4.0, 0.8);
    }
  };
  // The breast: brick up from the floor against the wall to the ceiling, the firebox in it.
  const breast: KitPart = { faces: slab(-FP_X, FP_X, y0, y1, 0, FP_MANTEL, BRICK, { paint: { front: bricks(271, true), left: bricks(272), right: bricks(273) } }), edges: true };
  parts.push(breast);
  parts.push({ faces: slab(-FP_X + 3.2, FP_X - 3.2, y0 + 1.2, y1, FP_MANTEL + 0.9, FP_TOP, BRICK, { paint: { front: bricks(274), left: bricks(275), right: bricks(276) } }), edges: true });
  // The hearthstone out on the floor, and the mantel shelf.
  parts.push({ faces: slab(-FP_X - 0.6, FP_X + 0.6, y0 - 2.4, y0, 0, 0.5, DRESSED, { corner: 0.2, paint: { top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); stoneSkin(g, k.fill, s.w, s.h, 277, 0.8); g.restore(); } } }), edges: true, first: true });
  parts.push({ faces: slab(-FP_X - 0.8, FP_X + 0.8, y0 - 0.9, y1, FP_MANTEL, FP_MANTEL + 0.9, DRESSED, { corner: 0.2, bevel: 0.2, paint: stoneSides(278) }), edges: true });
  if (look.lit) {
    const at: V3 = [0, y0 - 0.1, 1.4];
    parts.push({
      reach: [[-FB_X, y0 - 0.5, 0.5], [FB_X, y0, FB_Z]], after: [breast],
      draw: (g, e) => {
        const [x, y] = proj(e, at);
        const w = FB_X * across(e) * 0.75, h = (FB_Z - 3) * HEIGHT_SCALE;
        glow(g, x, y - h * 0.3, w * 2.2, 0.45);
        flame(g, x, y, w, h, 7, look.frame ?? 0);
      },
    });
  }
  return { parts, shade: null };
}

export const FIREPLACE: KitPiece = {
  model: (look) => fireplaceOf(look), uses: { lit: true }, flicker: 4, holesLit: true,
  holes: (sx, sy, zoom, view) => {
    const e = eyeOfView(view);
    const [x, y] = proj(e, [0, FACE_Y - FP_D - 0.1, 3]);
    return [{ x: sx + x * zoom, y: sy + y * zoom, r: 4 * zoom, a: 0.95 }, { x: sx + x * zoom, y: sy + y * zoom, r: 14 * zoom, a: 0.35 }];
  },
  states: [{ trim: 0, label: 'cold' }],
};

/* ---- 10. the four-poster bed ------------------------------------------------------------------ */

const FPB_L = 13.6, FPB_W = 8.6, FPB_TOP = 22;

function fourPosterOf(look: KitLook): KitModel {
  const base = bedOf({ ...look, tint: undefined });
  const W = woodTone(look.material);
  const C = clothTone(look.tint);
  const parts: KitPart[] = [...base.parts];
  // Four tall turned posts, the frame of rails over them, the canopy on it and a valance hung round.
  for (const x of [-FPB_L, FPB_L]) {
    for (const y of [-FPB_W, FPB_W]) parts.push({ faces: lathe(x, y, [[0, 0.75], [2, 0.75], [2.4, 0.95], [3, 0.6], [FPB_TOP - 1, 0.55], [FPB_TOP, 0.7]], 8, W, 0.5, (_k, i, s) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 281 + i, 'y', 0.5) })), edges: true });
  }
  parts.push({ faces: slab(-FPB_L - 0.7, FPB_L + 0.7, -FPB_W - 0.7, FPB_W + 0.7, FPB_TOP, FPB_TOP + 0.7, deeper(W, 0.1), { paint: woodSides(291, 'x') }), edges: true });
  const pleats = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
    for (let x = 0.6, i = 0; x < s.w; x += 1.2, i++) {
      g.fillStyle = css(mix(k.fill, hex('#5a4660'), 0.3), 0.6); g.fillRect(x, 0, 0.3, s.h);
      g.fillStyle = css(mix(k.fill, [255, 250, 240], 0.3), 0.5); g.fillRect(x + 0.4, 0, 0.15, s.h);
    }
    // A scalloped hem.
    g.fillStyle = css(mix(k.fill, hex('#5a4660'), 0.4), 0.8);
    for (let x = 0; x < s.w; x += 1.2) { g.beginPath(); g.arc(x + 0.6, 0.15, 0.55, 0, Math.PI); g.fill(); }
    void seed;
  };
  parts.push({ faces: slab(-FPB_L - 0.9, FPB_L + 0.9, -FPB_W - 0.9, FPB_W + 0.9, FPB_TOP - 2.6, FPB_TOP + 0.9, C, {
    paint: { front: pleats(301), back: pleats(302), left: pleats(303), right: pleats(304), top: (g, k, s) => { g.fillStyle = css(mix(k.fill, [255, 250, 240], 0.15)); g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); } },
  }), edges: true });
  // Curtains tied back at the head posts.
  for (const y of [-FPB_W, FPB_W]) parts.push({ faces: slab(-FPB_L - 0.4, -FPB_L + 1.9, y - 0.5, y + 0.5, 3, FPB_TOP - 2.6, C, { paint: { front: pleats(311), back: pleats(312) } }), edges: true });
  return { parts, shade: shadeOf(-FPB_L - 0.9, FPB_L + 0.9, -FPB_W - 0.9, FPB_W + 0.9) };
}

export const FOUR_POSTER: KitPiece = { model: (look) => fourPosterOf(look), uses: { tint: true, material: true } };

/* ---- 11. the vase ------------------------------------------------------------------------------ */

/** A vase's trim: one more than its wildflowers, and four more wilted. */
export const vaseTrim = (n: number, wilted: boolean): number => 1 + Math.max(0, Math.min(3, n)) + (wilted && n > 0 ? 4 : 0);
const BLOOMS: RGB[] = [hex('#f2a6c8'), hex('#fbf3e6'), hex('#f6d660'), hex('#9ab8f0')];

function vaseOf(look: KitLook): KitModel {
  const G = look.tint ? clothTone(look.tint) : toneOf('#9fc2c6', '#5a7488');
  const parts: KitPart[] = [];
  const t = said(look.trim);
  const n = t < 0 ? 3 : t % 4, wilted = t >= 4;
  const body: KitPart = {
    faces: lathe(0, 0, [[0, 1.1], [0.4, 1.5], [2.2, 2.1], [4.0, 1.5], [5.4, 0.8], [6.0, 0.95], [6.4, 1.15]], 12, G, 0.5, (_k, i, s) => ({
      crease: 0.16,
      paint: (g: Ctx, k: PaintCtx) => {
        g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
        // The glaze's sheen up its belly, and a band round its shoulder.
        g.fillStyle = css(mix(k.fill, [255, 252, 246], 0.45), 0.5); g.fillRect(s.w * 0.25, 0, s.w * 0.12, s.h);
        if (i % 2 === 0) { g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.3), 0.35); g.fillRect(0, s.h * 0.6, s.w, s.h * 0.08); }
      },
    })),
    edges: true,
  };
  parts.push(body);
  if (n > 0) {
    // Stems up out of its neck, a flower on each, drooped and browned once wilted.
    parts.push({
      ...loose([-3.5, -3.5, 6], [3.5, 3.5, 11.5], (g, e) => {
        const u = across(e);
        for (let i = 0; i < n * 2; i++) {
          const a = (i / (n * 2)) * TAU + 0.4, lean = 0.35 + (i % 3) * 0.12;
          const [bx, by] = proj(e, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 6.2]);
          const top: V3 = wilted ? [Math.cos(a) * 2.6, Math.sin(a) * 2.6, 7.6] : [Math.cos(a) * 2.4 * lean, Math.sin(a) * 2.4 * lean, 9.6 + (i % 2) * 0.9];
          const [tx, ty] = proj(e, top);
          g.strokeStyle = wilted ? '#8a8058' : '#5e8a54';
          g.lineWidth = Math.max(0.6, 0.16 * u);
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + tx) / 2, ty - (wilted ? -1 : 1.5), tx, ty); g.stroke();
          const col = wilted ? mix(BLOOMS[i % 4], hex('#8a6a50'), 0.6) : BLOOMS[i % 4];
          g.fillStyle = css(col);
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * TAU;
            g.beginPath(); g.ellipse(tx + Math.cos(pa) * 0.32 * u, ty + Math.sin(pa) * 0.22 * u, 0.3 * u, 0.2 * u, pa, 0, TAU); g.fill();
          }
          g.fillStyle = wilted ? '#7a5a40' : '#e8b04a';
          g.beginPath(); g.arc(tx, ty, 0.16 * u, 0, TAU); g.fill();
        }
      }, true, 2),
      after: [body],
    });
  }
  return { parts, shade: shadeOf(-2, 2, -2, 2) };
}

export const VASE: KitPiece = {
  model: (look) => vaseOf(look), uses: { trim: true, tint: true },
  states: [{ trim: vaseTrim(0, false), label: 'empty' }, { trim: vaseTrim(3, false), label: 'full, fresh' }, { trim: vaseTrim(3, true), label: 'full, wilted' }],
};

/* ---- 12. the side table ------------------------------------------------------------------------- */

/** What a thing on a table is drawn as, by its kind. */
export const TABLE_SHAPES = ['box', 'loaf', 'pot', 'blade', 'book', 'stack'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
const COLOUR_BASE = 32768;
const colourCode = (h: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) >> 3);
  return (r << 10) | (g << 5) | b;
};
const colourOf = (c: number): RGB => [((c >> 10) & 31) * 8.2, ((c >> 5) & 31) * 8.2, (c & 31) * 8.2];
/** A table's trim: each of its two things, a shape and a colour (`#rrggbb`), nought for none. */
export const tableTrim = (on: ReadonlyArray<{ shape: TableShape; colour: string }>): number =>
  on.slice(0, 2).reduce((n, o, i) => n + (1 + TABLE_SHAPES.indexOf(o.shape) + 7 * colourCode(o.colour)) * (7 * COLOUR_BASE) ** i, 0);
const ST_Z = 7.2;

function thingOn(shape: TableShape, c: RGB, x: number, y: number, z: number, seed: number): KitPart[] {
  const tone: Tone = { lit: mix(c, [255, 250, 240], 0.15), shade: mix(c, hex('#4a3a50'), 0.45) };
  switch (shape) {
    case 'loaf': return [{ faces: lathe(x, y, [[z, 1.4], [z + 0.6, 1.5], [z + 1.2, 1.1], [z + 1.5, 0.3]], 10, tone), edges: true }];
    case 'pot': return [{ faces: lathe(x, y, [[z, 0.9], [z + 1.2, 1.25], [z + 2.0, 0.85], [z + 2.4, 0.95]], 10, tone), edges: true }];
    case 'blade': return [{ faces: slab(x - 2.2, x + 2.2, y - 0.35, y + 0.35, z, z + 0.3, tone, { corner: 0.1 }), edges: true }, { faces: slab(x + 1.4, x + 2.4, y - 0.5, y + 0.5, z, z + 0.45, deeper(tone, 0.3)) }];
    case 'book': return [{ faces: slab(x - 1.3, x + 1.3, y - 1.0, y + 1.0, z, z + 0.6, tone, { corner: 0.08, paint: { top: (g, k, s) => { g.fillStyle = css(mix(k.fill, hex('#f8eedc'), 0.2)); g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); } } }), edges: true }];
    case 'stack': return [0, 1, 2].map((i) => ({ faces: slab(x - 1.2 + i * 0.1, x + 1.2 + i * 0.1, y - 0.8, y + 0.8, z + i * 0.45, z + (i + 1) * 0.45, i % 2 ? paler(tone, 0.08) : tone, { corner: 0.08 }), edges: true }));
    default: return [{ faces: slab(x - 1, x + 1, y - 0.8, y + 0.8, z, z + 1.3, tone, { corner: 0.12, bevel: 0.1 }), edges: true }];
  }
  void seed;
}

function sideTableOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  for (const [i, [x, y]] of ([[-3, -3], [3, -3], [3, 3], [-3, 3]] as Array<[number, number]>).entries()) parts.push({ faces: leg(x, y, 0, ST_Z - 0.6, W, 321 + i, 0.7) });
  parts.push({ faces: slab(-3.2, 3.2, -3.2, 3.2, ST_Z - 1.6, ST_Z - 0.6, deeper(W, 0.1), { paint: woodSides(331, 'x') }) });
  const top: KitPart = { faces: slab(-4, 4, -4, 4, ST_Z - 0.6, ST_Z, paler(W, 0.06), { corner: 0.6, bevel: 0.2, paint: { ...woodSides(341, 'x'), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 343, 'x', 0.6); g.restore(); } } }), edges: true };
  parts.push(top);
  const t = Math.max(0, Math.floor(look.trim ?? 0));
  for (let i = 0; i < 2; i++) {
    const code = Math.floor(t / (7 * COLOUR_BASE) ** i) % (7 * COLOUR_BASE);
    if (!code) continue;
    const shape = TABLE_SHAPES[(code - 1) % 7] ?? 'box';
    for (const p of thingOn(shape, colourOf(Math.floor((code - 1) / 7)), i ? 1.8 : -1.8, i ? -0.8 : 0.8, ST_Z, 351 + i)) parts.push({ ...p, after: [top] });
  }
  parts.push(loose([-4, -4, 0], [4, 4, ST_Z + 3], () => undefined));
  return { parts, shade: shadeOf(-4, 4, -4, 4) };
}

export const SIDE_TABLE: KitPiece = {
  model: (look) => sideTableOf(look), uses: { trim: true, material: true, tint: true },
  states: [
    { trim: 0, label: 'empty' },
    { trim: tableTrim([{ shape: 'loaf', colour: '#d8a868' }]), label: 'a loaf' },
    { trim: tableTrim([{ shape: 'pot', colour: '#3366aa' }, { shape: 'book', colour: '#8a3a3a' }]), label: 'a pot and a book' },
  ],
};

/* ---- 13. the footstool --------------------------------------------------------------------------- */

function footstoolOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.5);
  const C = look.tint ? clothTone(look.tint) : toneOf('#c98a7a', '#8a5a62');
  const parts: KitPart[] = [];
  for (const [i, [x, y]] of ([[-2.6, -2.2], [2.6, -2.2], [2.6, 2.2], [-2.6, 2.2]] as Array<[number, number]>).entries()) {
    parts.push({ faces: lathe(x, y, [[0, 0.3], [0.4, 0.5], [1.4, 0.35], [2.2, 0.45]], 8, W, 0.5, (_k, j, s) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 361 + i + j, 'y', 0.5) })), edges: true });
  }
  parts.push({ faces: slab(-3.2, 3.2, -2.8, 2.8, 2.2, 2.9, W, { corner: 0.3, paint: woodSides(371, 'x') }), edges: true });
  parts.push({
    faces: slab(-3.3, 3.3, -2.9, 2.9, 2.9, 4.2, C, {
      corner: 0.9, bevel: 0.5,
      paint: { top: (g, k, s) => {
        g.fillStyle = css(k.fill); g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
        // Buttoned: four tufts and the creases out from them.
        g.fillStyle = css(mix(k.fill, hex('#4a3448'), 0.4));
        for (const [bx, by] of [[-1.2, -0.9], [1.2, -0.9], [1.2, 0.9], [-1.2, 0.9]]) { g.beginPath(); g.arc(bx, by, 0.22, 0, TAU); g.fill(); }
      } },
    }),
    edges: true,
  });
  return { parts, shade: shadeOf(-3.3, 3.3, -2.9, 2.9) };
}

export const FOOTSTOOL: KitPiece = { model: (look) => footstoolOf(look), uses: { tint: true, material: true } };

/* ---- 14. the trophy fish mount -------------------------------------------------------------------- */

/** How each kind of fish is drawn on a mount: its length and depth on the board, its back and belly, and its marks. */
export const MOUNT_FISH: Readonly<Record<string, { len: number; deep: number; back: string; belly: string; marks: 'bars' | 'spots' | 'plain' | 'stripe' }>> = {
  minnow: { len: 3.4, deep: 0.9, back: '#8a9a7a', belly: '#e4e2cc', marks: 'stripe' },
  perch: { len: 4.4, deep: 1.7, back: '#7a9a4a', belly: '#f0d48a', marks: 'bars' },
  trout: { len: 5.6, deep: 1.5, back: '#7a8a6a', belly: '#f0c8b0', marks: 'spots' },
  pike: { len: 7.0, deep: 1.3, back: '#5a7a4a', belly: '#e8e0b0', marks: 'spots' },
  sturgeon: { len: 7.6, deep: 1.5, back: '#6a6a72', belly: '#d8d4c8', marks: 'plain' },
  cod: { len: 6.0, deep: 1.7, back: '#8a7a5a', belly: '#ece4d0', marks: 'spots' },
  halibut: { len: 6.6, deep: 2.6, back: '#7a6a5a', belly: '#f0ece0', marks: 'spots' },
  bluefin: { len: 7.4, deep: 2.1, back: '#2f4a7a', belly: '#d8e0e8', marks: 'stripe' },
};
const MOUNT_KINDS = Object.keys(MOUNT_FISH);
/** A mount's trim: one more than its fish's place among `MOUNT_FISH`, nought empty. */
export const mountTrim = (def: string | null): number => (def && MOUNT_FISH[def] ? 1 + MOUNT_KINDS.indexOf(def) : 0);
const MT_Z = 14, MT_H = 5.2, MT_W = 4.6;

function fishMountOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.6);
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - 0.6;
  // An oval board, its edge moulded, a brass plate under the fish.
  const oval: Face[] = [];
  const N = 16;
  const rim = (y: number): V3[] => Array.from({ length: N }, (_, i) => [Math.cos((i / N) * TAU) * MT_W, y, MT_Z + MT_H / 2 + Math.sin((i / N) * TAU) * MT_H / 2] as V3);
  const f0 = rim(y0), f1 = rim(y1);
  oval.push({ pts: f0.slice().reverse(), n: [0, -1, 0], tone: W, crease: 0.4, frame: { o: [-MT_W, y0, MT_Z], a: [1, 0, 0], b: [0, 0, 1] }, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, MT_W * 2, MT_H, 381, 'x', 0.6) });
  oval.push({ pts: f1.slice(), n: [0, 1, 0], tone: deeper(W, 0.1), crease: 0.4 });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = ((i + 0.5) / N) * TAU;
    oval.push({ pts: [f0[i], f0[j], f1[j], f1[i]], n: [Math.cos(a), 0, Math.sin(a)], tone: deeper(W, 0.12), crease: 0.3 });
  }
  const plate: KitPart = { faces: oval, edges: true };
  parts.push(plate);
  parts.push({ faces: slab(-1.4, 1.4, y0 - 0.12, y0, MT_Z + 0.4, MT_Z + 1.1, BRASS), edges: true, after: [plate] });
  const t = said(look.trim);
  const kind = t >= 0 ? MOUNT_FISH[MOUNT_KINDS[t]] : undefined;
  if (kind) {
    const c: V3 = [0, y0 - 0.7, MT_Z + MT_H / 2 + 0.5];
    parts.push({
      ...loose([-MT_W, y0 - 1.2, MT_Z], [MT_W, y0, MT_Z + MT_H], (g, e) => {
        const [x, y] = proj(e, c);
        const u = across(e);
        const L = kind.len * u * 0.8, D = kind.deep * u * 0.8;
        g.save();
        g.translate(x, y);
        g.rotate(-0.12);
        g.lineJoin = 'round';
        // The fish: the catch's lozenge and tail (`catchFish`), its belly under its back, inked round.
        const body = (): void => {
          g.beginPath();
          g.ellipse(0, 0, L * 0.5, D * 0.5, 0, 0, TAU);
          g.moveTo(-L * 0.42, 0); g.lineTo(-L * 0.68, -D * 0.6); g.lineTo(-L * 0.6, 0); g.lineTo(-L * 0.68, D * 0.6); g.closePath();
        };
        body(); g.strokeStyle = 'rgba(62, 46, 56, 0.9)'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = kind.belly; body(); g.fill();
        g.fillStyle = kind.back;
        g.beginPath(); g.ellipse(0, -D * 0.12, L * 0.47, D * 0.36, 0, Math.PI, TAU); g.fill();
        g.beginPath(); g.moveTo(-L * 0.42, 0); g.lineTo(-L * 0.68, -D * 0.6); g.lineTo(-L * 0.6, 0); g.lineTo(-L * 0.68, D * 0.6); g.closePath(); g.fill();
        // The dorsal fin, the marks, the eye.
        g.beginPath(); g.moveTo(-L * 0.1, -D * 0.45); g.lineTo(L * 0.05, -D * 0.85); g.lineTo(L * 0.18, -D * 0.42); g.fill();
        g.fillStyle = css(mix(hex(kind.back), hex('#2e2430'), 0.45), 0.7);
        if (kind.marks === 'bars') for (let i = -2; i <= 2; i++) g.fillRect(i * L * 0.12 - L * 0.02, -D * 0.4, L * 0.04, D * 0.6);
        if (kind.marks === 'spots') { const T = rand(t + 401); for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((T() - 0.5) * L * 0.7, (T() - 0.7) * D * 0.5, 0.14 * u, 0, TAU); g.fill(); } }
        if (kind.marks === 'stripe') g.fillRect(-L * 0.4, -D * 0.05, L * 0.8, D * 0.1);
        g.fillStyle = '#fbf3e2'; g.beginPath(); g.arc(L * 0.36, -D * 0.1, 0.32 * u, 0, TAU); g.fill();
        g.fillStyle = '#2e2430'; g.beginPath(); g.arc(L * 0.37, -D * 0.1, 0.16 * u, 0, TAU); g.fill();
        g.restore();
      }, true, 3),
      after: [plate],
    });
  }
  return { parts, shade: null };
}

export const FISH_MOUNT: KitPiece = {
  model: (look) => fishMountOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: mountTrim(null), label: 'empty' }, ...['perch', 'pike', 'bluefin'].map((d) => ({ trim: mountTrim(d), label: d }))],
};
