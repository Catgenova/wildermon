import { WALL_THICK } from '../../game/building';
import { HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import { rand } from '../ivy';
import {
  clothTone, css, deeper, grain, halfOf, hex, lathe, mix, paler, prism, proj, slab, TAU, toneOf, turned, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { leg, rod, woodSides, woodSide } from './woodwork';
import { DRESSED, mossCushion, mossOf, stoneSkin, strut, type Mossed } from './outdoor';
import { glow } from './hearthstone';

/**
 * The fittings (`fitting.ts`), in the kit: a paper lantern pole, a moss
 * boulder, a tree bench, a spice shelf, a window seat, a training dummy, an
 * archery target, a mooring post and a stone bust.
 *
 * Each piece's `trim` is what it holds and how it stands, worked out by the
 * renderer off what the island keeps (`fittingTrim` in `render/fittinglook.ts`)
 * and read back here; a boulder's is its moss (`mossTrim`). A bust's citizen
 * is drawn over its bake each frame by the figure's own code (`bust`), as an
 * armour stand's mannequin is.
 */

const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
const onScreen = (sx: number, sy: number, zoom: number, v: KitView, p: V3): [number, number] =>
  [sx + (p[0] * v.ux + p[1] * v.vx) * zoom, sy + (p[0] * v.uy + p[1] * v.vy - p[2] * HEIGHT_SCALE) * zoom];
const across = (e: { ux: number; vx: number }): number => Math.hypot(e.ux, e.vx);
const loose = (a: V3, b: V3, draw: (g: Ctx, e: import('../runestone').Eye) => void, solid = true, pad = 0): KitPart => ({
  reach: [0, 1, 2, 3, 4, 5, 6, 7].map((i): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]), draw, solid, ...(pad ? { pad } : {}),
});
/** Where a wall's face is, from the middle of the row of spots along it (the fish mount's). */
const FACE_Y = UNITS_PER_TILE / 8 - WALL_THICK * UNITS_PER_TILE;
const DUSK: RGB = hex('#5a4660');
const CREAM: RGB = [255, 250, 240];
const toneFrom = (c: RGB, k = 0.42): Tone => ({ lit: mix(c, CREAM, 0.12), shade: mix(c, DUSK, k) });
/** A colour packed in fifteen bits, nought for none: a dye on the trim. */
const colourCode = (h: string | undefined | null): number => {
  if (!h || !/^#[0-9a-f]{6}$/i.test(h)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) >> 3);
  return 1 + ((r << 10) | (g << 5) | b);
};
const colourOf = (c: number): RGB | null => (c <= 0 ? null : [(((c - 1) >> 10) & 31) * 8.2, (((c - 1) >> 5) & 31) * 8.2, ((c - 1) & 31) * 8.2]);
const COLOUR_BASE = 32769;
const STRAW: Tone = toneOf('#f0dfa8', '#ab9478');
const ROPE: Tone = toneOf('#e9d3a6', '#a88a74');
/** A quadrilateral block from its four corners at the foot, straight up: a bench's trapezoid seat. */
const block = (corners: Array<[number, number]>, z0: number, z1: number, tone: Tone, paint?: (g: Ctx, k: PaintCtx, s: Side) => void): Face[] =>
  prism([z0, z1].map((z) => corners.map(([x, y]): V3 => [x, y, z])), tone, (_k, _i, s) => (paint ? { paint: (g: Ctx, k: PaintCtx) => paint(g, k, s) } : undefined),
    paint ? (s) => ({ paint: (g: Ctx, k: PaintCtx) => { g.save(); g.translate(-s.w / 2, -s.h / 2); paint(g, k, s); g.restore(); } }) : undefined);

/* ---- 1. the paper lantern pole ------------------------------------------------------------------- */

/** A pole's trim: whether its candles burn, and each lantern's colour (nought, plain paper). */
export const poleTrim = (lit: boolean, colours: readonly string[]): number =>
  1 + (lit ? 1 : 0) + 2 * (colourCode(colours[0]) + COLOUR_BASE * (colourCode(colours[1]) + COLOUR_BASE * colourCode(colours[2])));
function poleOf(trim: number | undefined): { lit: boolean; colours: Array<RGB | null> } {
  const t = trim && trim > 0 ? Math.floor(trim) - 1 : 0;
  let c = Math.floor(t / 2);
  const colours: Array<RGB | null> = [];
  for (let i = 0; i < 3; i++) { colours.push(colourOf(c % COLOUR_BASE)); c = Math.floor(c / COLOUR_BASE); }
  return { lit: t % 2 === 1, colours };
}
const PAPER: RGB = hex('#f7ead2');
/** The poles whose candles burn, by the piece's id, as the renderer last worked it out (`fittingTrim`): what the halo is drawn round. */
export const POLES_LIT = new Set<number>();
const POLE_TOP = 25, ARM_Z = 23.6, ARM_R = 4.4;
/** Each lantern: its bearing off the pole and the height of its foot. */
const LANTERNS: Array<[number, number]> = [[0.5, 17.6], [2.6, 18.6], [4.7, 17.1]];
const lanternAt = (i: number): V3 => {
  const [a, z] = LANTERNS[i];
  return [Math.cos(a) * ARM_R, Math.sin(a) * ARM_R, z + 1.5];
};

function lanternPoleOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.6);
  const { lit, colours } = poleOf(look.trim);
  const parts: KitPart[] = [];
  // A cross foot, the pole, and three arms out from its head with a lantern hung off each.
  parts.push({ faces: slab(-2.6, 2.6, -0.5, 0.5, 0, 0.7, deeper(W, 0.15), { corner: 0.2, paint: woodSides(601, 'x') }), edges: true });
  parts.push({ faces: slab(-0.5, 0.5, -2.6, 2.6, 0, 0.7, deeper(W, 0.15), { corner: 0.2, paint: woodSides(605, 'y') }), edges: true });
  const pole: KitPart = { faces: lathe(0, 0, [[0.7, 0.5], [POLE_TOP, 0.36], [POLE_TOP + 0.4, 0.55], [POLE_TOP + 1.1, 0.05]], 6, W, 0.5, (_k, i, s) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 611 + i, 'y', 0.5) })), edges: true };
  parts.push(pole);
  LANTERNS.forEach(([a, z], i) => {
    const tip: V3 = [Math.cos(a) * ARM_R, Math.sin(a) * ARM_R, ARM_Z];
    parts.push({ faces: rod([Math.cos(a) * 0.3, Math.sin(a) * 0.3, ARM_Z + 0.8], [tip[0], tip[1], ARM_Z + 0.1], 0.2, deeper(W, 0.1), 5), after: [pole] });
    parts.push({ faces: rod([tip[0], tip[1], ARM_Z], [tip[0], tip[1], z + 3.2], 0.06, ROPE, 4) });
    const base = colours[i] ?? PAPER;
    // Lit, the paper glows its own colour through from inside, alike on its lit side and its turned one.
    const tone: Tone = lit ? { lit: mix(base, [255, 244, 200], 0.55), shade: mix(base, [255, 214, 140], 0.4) } : toneFrom(base, 0.32);
    const body: KitPart = {
      faces: lathe(tip[0], tip[1], [[z + 0.2, 0.55], [z + 0.55, 1.35], [z + 1.5, 1.75], [z + 2.45, 1.35], [z + 2.8, 0.55]], 10, tone, 0.5, (_k, j, s) => ({
        crease: 0.12,
        paint: (g: Ctx, k: PaintCtx) => {
          g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
          // The paper's ribs: a fine line round it every little way.
          g.strokeStyle = css(mix(k.fill, DUSK, lit ? 0.18 : 0.32), 0.7); g.lineWidth = 0.08;
          for (let y = 0.25; y < s.h; y += 0.42) { g.beginPath(); g.moveTo(0, y); g.lineTo(s.w, y); g.stroke(); }
          void j;
        },
      })),
      edges: true,
    };
    parts.push(body);
    for (const [z0, z1] of [[z, z + 0.25], [z + 2.75, z + 3.2]]) parts.push({ faces: lathe(tip[0], tip[1], [[z0, 0.6], [z1, 0.6]], 8, deeper(W, 0.25)), after: [body] });
  });
  return { parts, shade: shadeOf(-2.6, 2.6, -2.6, 2.6) };
}

export const LANTERN_POLE: KitPiece = {
  model: (look) => lanternPoleOf(look), uses: { trim: true, material: true },
  states: [
    { trim: poleTrim(false, []), label: 'plain, out' },
    { trim: poleTrim(false, ['#e05a5a', '#5a8ae0', '#f0c040']), label: 'dyed, out' },
    { trim: poleTrim(true, ['#e05a5a', '#5a8ae0', '#f0c040']), label: 'dyed, lit' },
  ],
  holesLit: true,
  holes: (sx, sy, zoom, view) => [0, 1, 2].flatMap((i) => {
    const [x, y] = onScreen(sx, sy, zoom, view, lanternAt(i));
    return [{ x, y, r: 2.4 * zoom, a: 0.95 }, { x, y, r: 7 * zoom, a: 0.3 }];
  }),
  live: (ctx, sx, sy, zoom, view, night, _t, air) => {
    // Lit, a warm halo round each lantern at night (`holesLit` takes the night off; this is the glow on the air).
    if (night <= 0.02 || !POLES_LIT.has(air?.seed ?? -1)) return;
    for (let i = 0; i < 3; i++) {
      const [x, y] = onScreen(sx, sy, zoom, view, lanternAt(i));
      glow(ctx, x, y, 6 * zoom, 0.5 * night, '255, 210, 140');
    }
  },
};

/* ---- 2. the moss boulder ----------------------------------------------------------------------- */

const BOULDER: Tone = toneOf('#d6ccc0', '#8a7a88');
const MOSS_GREEN: RGB = hex('#8fb06a');
const MOSS_DEEP: RGB = hex('#5f8a58');

/** Moss over a face of a boulder: more on what faces up and on the shady side, more the further on it is. */
const mossPaint = (m: Mossed | null, seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  stoneSkin(g, k.fill, s.w, s.h, seed, 1.15);
  if (!m) return;
  const up = Math.max(0, s.n[2]) / Math.max(1e-6, Math.hypot(...s.n));
  const amount = Math.min(1, m.k * (0.4 + 1.4 * up + 0.6 * m.shade(s.n[0], s.n[1])));
  if (amount <= 0.04) return;
  const T = rand(seed * 7 + 3);
  const n = Math.round(6 + 34 * amount);
  for (let i = 0; i < n; i++) {
    const x = T() * s.w, y = s.h * (1 - Math.pow(T(), 1 + up * 2)), r = 0.45 + T() * 1.2 * (0.4 + amount);
    g.fillStyle = css(mix(i % 3 ? MOSS_GREEN : MOSS_DEEP, k.fill, 0.15), 0.85);
    g.beginPath(); g.ellipse(x, y, r * 1.3, r * 0.8, T() * 3, 0, TAU); g.fill();
  }
};

function boulderOf(look: KitLook): KitModel {
  const m = mossOf(look.trim);
  const parts: KitPart[] = [];
  // A big weathered stone, out of round and flat-faced here and there, and a smaller one bedded against its foot.
  const lump = (cx: number, cy: number, r: number, h: number, sx: number, sy: number, seed: number): Face[] => {
    const T = rand(seed);
    const N = 7;
    const jag = Array.from({ length: N * 6 }, () => 0.78 + T() * 0.4);
    const faces = lathe(0, 0, [[0, r * 0.86], [h * 0.22, r * 1.0], [h * 0.55, r * 0.9], [h * 0.82, r * 0.58], [h, r * 0.2]], N, BOULDER, 0.2, (_k, i, s) => ({
      crease: 0.1, paint: (g: Ctx, k: PaintCtx) => mossPaint(m, seed + i)(g, k, s),
    }));
    // Each corner pushed in or out on its own, the top tipped over a little: no two stones alike.
    return warped(faces, ([x, y, z]) => {
      const a = Math.atan2(y, x), ring = Math.min(5, Math.round((z / h) * 4));
      const b = jag[(Math.round(((a + Math.PI) / TAU) * N) % N) + N * ring];
      return [cx + x * sx * b + z * 0.12, cy + y * sy * b - z * 0.05, z * (0.9 + 0.12 * b)];
    });
  };
  const big: KitPart = { faces: lump(-1, -0.5, 6.4, 8.4, 1.15, 0.9, 701), edges: true };
  parts.push(big);
  parts.push({ faces: lump(5.6, 3.6, 2.6, 3.6, 1, 0.9, 721), edges: true });
  if (m && m.k > 0.4) {
    parts.push({ ...mossCushion([-0.6, -0.8, 8.0], 0.9 + 0.8 * m.k), after: [big] });
    parts.push({ ...mossCushion([2.2, 1.6, 6.8], 0.6 + 0.6 * m.k), after: [big] });
  }
  return { parts, shade: shadeOf(-8.5, 8.6, -6.5, 6.6) };
}

export const MOSS_BOULDER: KitPiece = {
  model: (look) => boulderOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'bare' }, { trim: 3, label: 'moss 3' }, { trim: 7, label: 'moss 7' }],
};

/* ---- 3. the tree bench -------------------------------------------------------------------------- */

const TB_IN = 4.6, TB_OUT = 8.8, TB_SEAT = 4.4, TB_BACK = 7.8;
/** How far off the bark of its trunk a tree bench's back stands. */
const TB_GAP = 0.8;
/** The heights a tree bench is built round its trunk between (`tree3dGirth`): over the roots on the ground, to the top of its back. */
export const BENCH_BAND: readonly [number, number] = [1, TB_BACK];
/**
 * A tree bench's round, as its look carries it (`KitLook.round`): its seat's inside, out from the middle, for a trunk
 * `girth` out at its widest between `BENCH_BAND`'s heights, to a quarter of a unit; never under its own.
 */
export const benchRound = (girth: number | null | undefined): number | undefined =>
  (girth === null || girth === undefined ? undefined : Math.max(TB_IN, Math.ceil((girth + TB_GAP) * 4) / 4));

function treeBenchOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  const at = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  // Built round the trunk it stands round: its seat out from the bark, as deep as ever.
  const rin = Math.max(TB_IN, look.round ?? TB_IN), rout = rin + TB_OUT - TB_IN;
  // Six sides of seat round the trunk, each a trapezoid of boards, its back against the tree and its legs under it. Each
  // side is in the far half of the ring or the near half by which way it is seen (`halfOf`): the renderer draws the tree
  // between the two, so the trunk stands up through the ring.
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU + TAU / 12, a1 = ((i + 1) / 6) * TAU + TAU / 12, mid = (a0 + a1) / 2;
    const layer = halfOf(...at(rout, mid));
    const add = (faces: Face[], edges = true): void => { parts.push({ faces, edges, layer }); };
    const r0 = rin / Math.cos(TAU / 12), r1 = rout / Math.cos(TAU / 12);
    add(block([at(r0, a0), at(r0, a1), at(r1, a1), at(r1, a0)], TB_SEAT - 0.7, TB_SEAT, paler(W, 0.05), (g, k, s) => grain(g, k.fill, s.w, s.h, 801 + i, 'x', 0.6)));
    // The back: two rails against the trunk on short posts, open between, so the tree shows through.
    const rb = (rin - 0.5) / Math.cos(TAU / 12);
    for (const [z0, z1] of [[TB_BACK - 1.0, TB_BACK], [TB_SEAT + 1.6, TB_SEAT + 2.4]]) {
      add(block([at(rb, a0), at(rb, a1), at(rb + 0.45, a1), at(rb + 0.45, a0)], z0, z1, W, (g, k, s) => grain(g, k.fill, s.w, s.h, 821 + i, 'x', 0.6)));
    }
    const [px, py] = at((rin - 0.3) / Math.cos(TAU / 12), a0);
    add(slab(px - 0.3, px + 0.3, py - 0.3, py + 0.3, TB_SEAT, TB_BACK, deeper(W, 0.08)));
    for (const r of [rin + 0.6, rout - 0.7]) {
      const [x, y] = at(r, mid);
      add(leg(x, y, 0, TB_SEAT - 0.7, deeper(W, 0.12), 841 + i, 0.7), false);
    }
  }
  // Its shade the ring's own six sides, not a square round it.
  const shade = Array.from({ length: 6 }, (_, i): V3 => [...at(rout / Math.cos(TAU / 12), (i / 6) * TAU + TAU / 12), 0]);
  return { parts, shade };
}

/** A tree bench in two layers, its far half and its near half, the tree drawn between them (`Renderer`, `TREE_BENCH`). */
export const TREE_BENCH: KitPiece = { model: (look) => treeBenchOf(look), uses: { material: true, tint: true }, layers: 2 };

/* ---- 4. the spice shelf --------------------------------------------------------------------------- */

/** The herbs a shelf's jars are drawn as, by their place in `SHELF_HERBS`: the green of each. */
export const JAR_HERBS: readonly RGB[] = [hex('#a6b89a'), hex('#6fa65a'), hex('#8a9a5a'), hex('#7cc48a'), hex('#6a9a8a'), hex('#9aa070')];
/** A shelf's trim: each of its twelve jars, one more than the herb in it (`JAR_HERBS`), nought empty, three bits a jar. */
export const shelfTrim = (jars: readonly number[]): number => jars.slice(0, 12).reduce((n, h, i) => n + (h < 0 ? 0 : Math.min(7, h + 1)) * 8 ** i, 0);
const SH_X = 9, SH_D = 3.4, SH_Z = 12, SH_TIER = 4.6;

function spiceShelfOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.55);
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - SH_D;
  // A back board on the wall, two boards across it and the ends, a little rail along the front of each.
  const back: KitPart = { faces: slab(-SH_X, SH_X, y1 - 0.5, y1, SH_Z - 0.6, SH_Z + SH_TIER * 2 + 0.6, deeper(W, 0.1), { paint: woodSides(901, 'x') }), edges: true };
  parts.push(back);
  const boards: KitPart[] = [];
  for (let t = 0; t < 2; t++) {
    const z = SH_Z + t * SH_TIER;
    const b: KitPart = { faces: slab(-SH_X, SH_X, y0, y1 - 0.5, z - 0.5, z, paler(W, 0.05), { corner: 0.1, paint: woodSides(911 + t, 'x') }), edges: true, after: [back] };
    parts.push(b);
    boards.push(b);
  }
  for (const x of [-SH_X, SH_X - 0.6]) parts.push({ faces: slab(x, x + 0.6, y0, y1 - 0.5, SH_Z - 0.6, SH_Z + SH_TIER * 2 + 0.6, W, { paint: woodSides(921, 'y') }), edges: true, after: [back] });
  // The jars: six a board, a glass belly of the herb's green, a cork in its neck.
  const t = Math.max(0, Math.floor(look.trim ?? 0));
  for (let i = 0; i < 12; i++) {
    const h = Math.floor(t / 8 ** i) % 8;
    if (!h) continue;
    const row = Math.floor(i / 6), col = i % 6;
    const x = -SH_X + 2.0 + col * ((SH_X * 2 - 4) / 5), y = (y0 + y1 - 0.5) / 2, z = SH_Z + row * SH_TIER;
    const herb = JAR_HERBS[(h - 1) % JAR_HERBS.length];
    const glass: Tone = { lit: mix(herb, [240, 248, 240], 0.3), shade: mix(herb, DUSK, 0.35) };
    const jar: KitPart = { faces: lathe(x, y, [[z, 0.75], [z + 0.25, 0.95], [z + 1.9, 0.95], [z + 2.3, 0.6], [z + 2.55, 0.55]], 8, glass, 0.5, (_k, j, s) => ({
      crease: 0.14, paint: (g: Ctx, k: PaintCtx) => { g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h); if (j === 1) { g.fillStyle = css(mix(k.fill, CREAM, 0.6), 0.6); g.fillRect(s.w * 0.2, 0, s.w * 0.15, s.h); } },
    })), edges: true, after: [boards[row]] };
    parts.push(jar);
    parts.push({ faces: lathe(x, y, [[z + 2.55, 0.5], [z + 3.0, 0.45]], 8, toneOf('#d8b48a', '#9a7460')), after: [jar] });
  }
  return { parts, shade: null };
}

export const SPICE_SHELF: KitPiece = {
  model: (look) => spiceShelfOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: 0, label: 'empty' }, { trim: shelfTrim([0, 0, 0, 1, 1, 2, 3, 3, 4, 4, 4, 4]), label: 'full' }],
};

/* ---- 5. the window seat ------------------------------------------------------------------------- */

const WS_X = 9.2, WS_D = 4.6, WS_Z = 4.2;

function windowSeatOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const C = look.tint ? clothTone(look.tint) : toneOf('#c9a0b4', '#86627a');
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - WS_D;
  // A panelled box under the sill, a cushion along it, a bolster at either end.
  const panel = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    grain(g, k.fill, s.w, s.h, seed, 'x', 0.5);
    g.strokeStyle = css(mix(k.fill, DUSK, 0.35), 0.8); g.lineWidth = 0.14;
    for (let x = 0.6; x + 3.4 < s.w; x += s.w / 3) g.strokeRect(x, s.h * 0.2, s.w / 3 - 1.2, s.h * 0.6);
  };
  const box: KitPart = { faces: slab(-WS_X, WS_X, y0, y1, 0, WS_Z, W, { corner: 0.2, paint: { front: panel(1001), back: panel(1002), left: woodSide(1003, 'y'), right: woodSide(1004, 'y') } }), edges: true };
  parts.push(box);
  const cushion: KitPart = {
    faces: slab(-WS_X + 0.2, WS_X - 0.2, y0 + 0.1, y1 - 0.1, WS_Z, WS_Z + 1.3, C, {
      corner: 0.8, bevel: 0.5,
      paint: { top: (g, k, s) => {
        g.fillStyle = css(k.fill); g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
        g.fillStyle = css(mix(k.fill, DUSK, 0.4));
        for (let x = -s.w / 2 + 2.2; x < s.w / 2 - 1; x += 3) { g.beginPath(); g.arc(x, 0, 0.22, 0, TAU); g.fill(); }
      } },
    }),
    edges: true,
  };
  parts.push(cushion);
  for (const x of [-WS_X + 1.6, WS_X - 1.6]) parts.push({ faces: turned(lathe(x, y0 + WS_D / 2, [[-1.4, 0.3], [-1.2, 1.05], [1.2, 1.05], [1.4, 0.3]], 10, paler(C, 0.06)), [x, y0 + WS_D / 2, 0], [0, 1, 0], Math.PI / 2).map((f) => ({ ...f, pts: f.pts.map(([px, py, pz]): V3 => [px, py, pz + WS_Z + 2.2]) })), edges: true, after: [cushion] });
  return { parts, shade: null };
}

export const WINDOW_SEAT: KitPiece = { model: (look) => windowSeatOf(look), uses: { tint: true, material: true } };

/* ---- 6. the training dummy ------------------------------------------------------------------------ */

/** Straw, bound: a bundle's stalks along it and a cord round it every so often. */
const strawPaint = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.fillStyle = css(k.fill); g.fillRect(0, 0, s.w, s.h);
  const T = rand(seed);
  g.strokeStyle = css(mix(k.fill, hex('#8a6a40'), 0.35), 0.6); g.lineWidth = 0.07;
  for (let i = 0; i < s.w * 3; i++) { const x = T() * s.w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (T() - 0.5) * 0.4, s.h); g.stroke(); }
};

function dummyOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const parts: KitPart[] = [];
  // A cross foot, a post, a straw body bound with cord, a straw head, and a straw-bound arm across it.
  parts.push({ faces: slab(-4.4, 4.4, -0.6, 0.6, 0, 0.9, deeper(W, 0.12), { corner: 0.2, paint: woodSides(1101, 'x') }), edges: true });
  parts.push({ faces: slab(-0.6, 0.6, -4.4, 4.4, 0, 0.9, deeper(W, 0.12), { corner: 0.2, paint: woodSides(1105, 'y') }), edges: true });
  const post: KitPart = { faces: slab(-0.6, 0.6, -0.6, 0.6, 0.9, 16.5, W, { corner: 0.15, paint: woodSides(1111, 'y') }), edges: true };
  parts.push(post);
  const body: KitPart = { faces: lathe(0, 0, [[6.4, 1.6], [7.2, 2.5], [10.5, 2.7], [13.4, 2.3], [14.2, 1.3]], 10, STRAW, 0.5, (_k, i, s) => ({ crease: 0.16, paint: (g: Ctx, k: PaintCtx) => strawPaint(1121 + i)(g, k, s) })), edges: true };
  parts.push(body);
  for (const z of [8.0, 12.4]) parts.push({ faces: lathe(0, 0, [[z, 2.62], [z + 0.35, 2.62]], 10, ROPE), after: [body] });
  const arm: KitPart = { faces: lathe(0, 0, [[-5.4, 0.7], [-5.0, 0.9], [5.0, 0.9], [5.4, 0.7]], 8, STRAW, 0.5, (_k, i, s) => ({ crease: 0.16, paint: (g: Ctx, k: PaintCtx) => strawPaint(1141 + i)(g, k, s) })), edges: true };
  parts.push({ ...arm, faces: turned(arm.faces ?? [], [0, 0, 0], [0, 1, 0], Math.PI / 2).map((f) => ({ ...f, pts: f.pts.map(([x, y, z]): V3 => [x, y, z + 12.2]) })) });
  parts.push({ faces: lathe(0, 0, [[14.4, 1.0], [15.0, 1.7], [16.6, 1.8], [17.8, 1.2], [18.3, 0.3]], 10, paler(STRAW, 0.05), 0.5, (_k, i, s) => ({ crease: 0.16, paint: (g: Ctx, k: PaintCtx) => strawPaint(1161 + i)(g, k, s) })), edges: true });
  // A target painted on its chest: rings to aim the blade at.
  parts.push({
    ...loose([-2.8, 2.4, 9], [2.8, 2.9, 12], (g, e) => {
      const [x, y] = proj(e, [0, 2.75, 10.8]);
      const u = across(e);
      for (const [r, c] of [[1.1, '#d05a5a'], [0.7, '#f4ead8'], [0.32, '#d05a5a']] as Array<[number, string]>) {
        g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * u, r * u * 1.1, 0, 0, TAU); g.fill();
      }
    }, false, 1),
    after: [body],
  });
  return { parts, shade: shadeOf(-4.4, 4.4, -4.4, 4.4) };
}

export const TRAINING_DUMMY: KitPiece = { model: (look) => dummyOf(look), uses: { material: true } };

/* ---- 7. the archery target ------------------------------------------------------------------------ */

/** A target's trim: the arrows stuck in it, up to its room. */
export const targetTrim = (stuck: number): number => Math.max(0, Math.min(12, Math.floor(stuck)));
const TG_R = 6.2, TG_Z = 10, TG_Y = 0.6;
const RINGS = ['#f4ead8', '#5a6a8a', '#7ab0e0', '#e06a5a', '#f2c84a'];

function targetOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const parts: KitPart[] = [];
  // An easel of three legs, leaned back; the straw butt on its pegs, its face painted in rings.
  for (const x of [-4.6, 4.6]) parts.push({ faces: strut([x, TG_Y + 1.6, 0], [x * 0.8, TG_Y - 0.4, TG_Z + TG_R + 0.6], 0.8, 0.8, W, woodSide(1201, 'y')), edges: true });
  parts.push({ faces: strut([0, -4.6, 0], [0, TG_Y - 1.6, TG_Z + TG_R - 0.6], 0.7, 0.7, deeper(W, 0.1), woodSide(1205, 'y')), edges: true });
  const butt: Face[] = turned(lathe(0, 0, [[-1.3, TG_R - 0.4], [-1.0, TG_R], [1.0, TG_R], [1.3, TG_R - 0.4]], 18, STRAW, 0.5, (_k, i, s) => ({ crease: 0.12, paint: (g: Ctx, k: PaintCtx) => strawPaint(1211 + i)(g, k, s) })), [0, 0, 0], [1, 0, 0], -Math.PI / 2)
    .map((f) => ({ ...f, pts: f.pts.map(([x, y, z]): V3 => [x, y + TG_Y, z + TG_Z]) }));
  const face: KitPart = { faces: butt, edges: true };
  parts.push(face);
  parts.push({ faces: slab(-5.6, 5.6, TG_Y - 0.4, TG_Y + 0.4, TG_Z - TG_R - 0.6, TG_Z - TG_R + 0.4, W, { paint: woodSides(1231, 'x') }), edges: true });
  const n = Math.max(0, Math.floor(look.trim ?? 0));
  parts.push({
    ...loose([-TG_R, TG_Y + 1.3, TG_Z - TG_R], [TG_R, TG_Y + 5, TG_Z + TG_R], (g, e) => {
      const u = across(e);
      const c = proj(e, [0, TG_Y + 1.35, TG_Z]);
      // The rings, drawn as the face is seen: each a circle in the face's plane.
      const ringPath = (r: number): void => {
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * TAU;
          const [x, y] = proj(e, [Math.cos(a) * r, TG_Y + 1.35, TG_Z + Math.sin(a) * r]);
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
      };
      if (e.toward[1] < -0.05) return;
      RINGS.forEach((col, i) => { g.fillStyle = col; ringPath(TG_R * (1 - i * 0.19) - 0.3); g.fill(); });
      g.strokeStyle = css(mix(hex('#5a4660'), CREAM, 0.1), 0.5); g.lineWidth = 0.6; ringPath(TG_R - 0.3); g.stroke();
      // And the arrows in it, shafts out of the face toward the archer, fletched.
      const T = rand(1251);
      for (let i = 0; i < n; i++) {
        const a = T() * TAU, r = Math.sqrt(T()) * (TG_R - 1.2);
        const at: V3 = [Math.cos(a) * r, TG_Y + 1.35, TG_Z + Math.sin(a) * r];
        const [x0, y0] = proj(e, at);
        const [x1, y1] = proj(e, [at[0] + (T() - 0.5) * 1.2, at[1] + 4.2, at[2] - 0.4 + (T() - 0.5) * 0.8]);
        g.strokeStyle = '#8a6a50'; g.lineWidth = Math.max(0.7, 0.14 * u);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.fillStyle = i % 2 ? '#e8e0d0' : '#d06a5a';
        g.beginPath(); g.ellipse(x1, y1, 0.35 * u, 0.2 * u, Math.atan2(y1 - y0, x1 - x0), 0, TAU); g.fill();
      }
      void c;
    }, false, 2),
    after: [face],
  });
  return { parts, shade: shadeOf(-5, 5, -4.6, 2.2) };
}

export const ARCHERY_TARGET: KitPiece = {
  model: (look) => targetOf(look), uses: { trim: true, material: true },
  states: [{ trim: targetTrim(0), label: 'no arrows' }, { trim: targetTrim(5), label: '5 arrows' }, { trim: targetTrim(12), label: 'full' }],
};

/* ---- 8. the mooring post ---------------------------------------------------------------------- */

/** Where a post's rope comes off it, in the post's frame: the height of its turns, and how far out from its middle they lie. The rope to a boat tied to it is the renderer's (`Renderer.drawMooring`). */
export const POST_ROPE: readonly [number, number] = [6.2, 1.95];

function mooringPostOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.65);
  const parts: KitPart[] = [];
  // A short thick log, its top rounded and weathered, a rope wound round it twice.
  const post: KitPart = { faces: lathe(0, 0, [[0, 1.75], [7.6, 1.6], [8.6, 1.3], [9.2, 0.6], [9.4, 0.1]], 10, W, 0.5, (_k, i, s) => ({ crease: 0.18, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 1301 + i, 'y', 0.8) })), edges: true };
  parts.push(post);
  // Each turn its outside only: its top, a disc as wide as the post, is inside the log.
  for (const z of [5.6, 6.3]) parts.push({ faces: lathe(0, 0, [[z, 1.65], [z + 0.25, 1.95], [z + 0.55, 1.65]], 10, ROPE).filter((f) => f.pts.some((p) => p[2] !== f.pts[0][2])), after: [post] });
  return { parts, shade: shadeOf(-1.8, 1.8, -1.8, 1.8) };
}

export const MOORING_POST: KitPiece = { model: (look) => mooringPostOf(look), uses: { material: true } };

/* ---- 9. the stone bust -------------------------------------------------------------------------- */

/** How high the plinth stands that the bust is set on. */
export const BUST_PLINTH = 8.2;
/**
 * What draws a bust's citizen over its bake, their head and hair and the top
 * of their shoulders in stone: set by `render/fittinglook.ts`, which brings in
 * the figure. `seed` is the piece's id.
 */
export const bust: { draw: ((ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, seed: number) => void) | null } = { draw: null };
const PLINTH: Tone = toneOf('#ece0d0', '#a8969a');

function bustOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 0.8);
  const sides = (seed: number) => ({ front: skin(seed), back: skin(seed + 1), left: skin(seed + 2), right: skin(seed + 3) });
  // A moulded foot, a squared shaft, a cap: the plinth; uncarved, a rough block of the stone on it.
  parts.push({ faces: slab(-3, 3, -3, 3, 0, 1.0, PLINTH, { corner: 0.2, bevel: 0.3, paint: sides(1401) }), edges: true });
  parts.push({ faces: slab(-2.3, 2.3, -2.3, 2.3, 1.0, BUST_PLINTH - 1.0, DRESSED, { corner: 0.2, paint: sides(1411) }), edges: true });
  parts.push({ faces: slab(-2.8, 2.8, -2.8, 2.8, BUST_PLINTH - 1.0, BUST_PLINTH, PLINTH, { corner: 0.2, bevel: 0.3, paint: sides(1421) }), edges: true });
  if (!(look.trim ?? 0)) parts.push({ faces: slab(-2.0, 2.0, -1.7, 1.7, BUST_PLINTH, BUST_PLINTH + 5.2, toneOf('#e6d8c8', '#9c8c92'), { corner: 0.5, taper: 0.3, paint: sides(1431) }), edges: true });
  // The bust's height, which is drawn over the bake (`bust`).
  parts.push(loose([-3.4, -2.4, 0], [3.4, 2.4, BUST_PLINTH + 7.4], () => undefined));
  return { parts, shade: shadeOf(-3, 3, -3, 3) };
}

export const STONE_BUST: KitPiece = {
  model: (look) => bustOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'uncarved' }, { trim: 1, label: 'carved' }],
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, BUST_PLINTH]);
    bust.draw?.(ctx, x, y, zoom, view, air?.seed ?? -1);
  },
};
