import { WALL_THICK } from '../../game/building';
import { UNITS_PER_TILE, HEIGHT_SCALE } from '../iso';
import { rand } from '../ivy';
import {
  BRASS, clothTone, css, deeper, extrude, grain, hex, inlay, lathe, mix, paler, proj, slab, TAU, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { rod, woodSides } from './woodwork';
import { BLOCK, DRESSED, mossAt, mossCushion, mossOf, mossSide, mossTop, overlaid, stoneSkin, type Mossed } from './outdoor';
import { glow } from './hearthstone';

/**
 * The home pieces (`decor.ts`), in the kit: a sundial, a compost bin, a stone
 * lantern, a woven rug, curtains and an armour stand.
 *
 * Each piece's `trim` is what it holds and how it stands, worked out by the
 * renderer off what the island keeps (`decorTrim` in `render/decorlook.ts`)
 * and read back here; an armour stand's mannequin is a body drawn over its
 * bake every frame by the figure's own code (`mannequin`).
 */

/** The shade a piece throws, a box on the floor. */
const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
/** Where on the screen a point of a piece standing at (sx, sy) is (`KitView`). */
const onScreen = (sx: number, sy: number, zoom: number, v: KitView, p: V3): [number, number] =>
  [sx + (p[0] * v.ux + p[1] * v.vx) * zoom, sy + (p[0] * v.uy + p[1] * v.vy - p[2] * HEIGHT_SCALE) * zoom];
/** Moss on whichever of a solid's upright sides and its top a rule says (the statue's). */
function mossed(faces: Face[], m: Mossed | null, salt: number, top?: [number, number, number, number, number]): Face[] {
  if (!m) return faces;
  return overlaid(faces, (f) => {
    if (Math.abs(f.n[2]) < 0.2 && Math.max(Math.abs(f.n[0]), Math.abs(f.n[1])) > 0.9) return mossSide(m, salt + Math.round(f.n[0] * 3 + f.n[1] * 7))(f);
    if (top && f.n[2] > 0.95) return mossTop(m, salt + 50, ...top);
    return undefined;
  });
}
/** A part drawn loose that reaches these points: what declares a piece's box where nothing solid does. */
const reach = ([a, b]: [V3, V3]): KitPart => ({
  reach: [0, 1, 2, 3, 4, 5, 6, 7].map((i): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]), solid: true, draw: () => undefined,
});

/* ---- 1. the sundial ---------------------------------------------------------------------------- */

const DIAL_Z = 9.6, DIAL_R = 2.25;

function sundialOf(): KitModel {
  const parts: KitPart[] = [];
  const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 1);
  // A stepped octagonal foot, a turned column, a square cap with the brass dial let into it.
  parts.push({ faces: lathe(0, 0, [[0, 3.8], [0.9, 3.8], [0.9, 3.15], [1.45, 2.9]], 8, DRESSED, 0.5, (_, i, s) => ({ crease: 0.22, paint: (g: Ctx, k: PaintCtx) => skin(11 + i)(g, k, s) })), edges: true });
  parts.push({ faces: lathe(0, 0, [[1.45, 1.55], [2.1, 1.2], [4.6, 0.98], [7.2, 1.04], [8.4, 1.38], [8.9, 1.6]], 8, BLOCK, 0.5, (_, i, s) => ({ crease: 0.16, paint: (g: Ctx, k: PaintCtx) => skin(31 + i)(g, k, s) })), edges: true });
  const dial = (g: Ctx, _k: PaintCtx): void => {
    // The brass face, its ring of hour marks, and the noon line.
    g.fillStyle = css(BRASS.lit);
    g.beginPath(); g.arc(0, 0, DIAL_R, 0, TAU); g.fill();
    g.strokeStyle = css(mix(BRASS.shade, hex('#5a3a30'), 0.35), 0.95);
    g.lineWidth = 0.14;
    g.beginPath(); g.arc(0, 0, DIAL_R - 0.05, 0, TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, DIAL_R * 0.72, 0, TAU); g.stroke();
    for (let h = 0; h <= 12; h++) {
      const a = Math.PI + (h / 12) * Math.PI;
      const r0 = DIAL_R * (h % 3 === 0 ? 0.55 : 0.74), r1 = DIAL_R * 0.94;
      g.lineWidth = h % 3 === 0 ? 0.14 : 0.08;
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
    g.fillStyle = css(mix(BRASS.lit, [255, 250, 236], 0.5), 0.6);
    g.beginPath(); g.ellipse(-DIAL_R * 0.35, -DIAL_R * 0.35, DIAL_R * 0.35, DIAL_R * 0.18, -0.7, 0, TAU); g.fill();
  };
  parts.push({ faces: slab(-2.7, 2.7, -2.7, 2.7, 8.9, DIAL_Z, DRESSED, { corner: 0.7, bevel: 0.22, paint: { top: (g, k) => { stoneSkin(g, k.fill, 6, 6, 41, 1); g.save(); g.translate(0, 0); dial(g, k); g.restore(); } } }), edges: true });
  // The gnomon: a brass blade standing up the noon line, its edge sloped to the north.
  const blade = extrude([0, 0, DIAL_Z], [0, 1, 0], [0, 0, 1], [1, 0, 0], [[-DIAL_R * 0.9, 0], [DIAL_R * 0.55, 0], [DIAL_R * 0.55, 0.25], [-DIAL_R * 0.9, 2.2]], -0.12, 0.12, BRASS, 0.04);
  const cap = parts[parts.length - 1];
  parts.push({ faces: blade, edges: true, after: [cap] });
  return { parts, shade: shadeOf(-3.8, 3.8, -3.8, 3.8) };
}

export const SUNDIAL: KitPiece = { model: () => sundialOf(), uses: {} };

/* ---- 2. the compost bin ------------------------------------------------------------------------- */

/** A bin's trim: one more than how full it is in quarters, nought to three, and four more once it is compost. Unsaid: full, still rotting. */
export const binTrim = (n: number, holds: number, ready: boolean): number => 1 + Math.min(3, Math.ceil((n / holds) * 3)) + (ready ? 4 : 0);
const BIN = 3.8, BIN_H = 7.2;
/** Fresh stuff rotting, and compost ready: their tops. */
const ROTTING: RGB[] = [hex('#9a8a58'), hex('#7c9a5c'), hex('#b0905c'), hex('#6e5a44')];
const READY: RGB[] = [hex('#5e4636'), hex('#6e5442'), hex('#4c3a30'), hex('#7a624c')];

function compostBinOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const t = look.trim && look.trim > 0 ? Math.floor(look.trim) - 1 : 3;
  const level = t % 4, ready = t >= 4;
  const parts: KitPart[] = [];
  // Slats with gaps between for the air, nailed to four corner posts.
  const slats = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    const n = 5, gap = 0.32;
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * s.h, y1 = ((i + 1) / n) * s.h - gap;
      g.fillStyle = css(k.fill);
      g.fillRect(0, y0, s.w, y1 - y0);
      grain(g, k.fill, s.w, y1 - y0, seed + i, 'x', 0.5);
      g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.6), 0.9);
      g.fillRect(0, y1, s.w, gap);
    }
  };
  const posts: KitPart[] = [];
  for (const [x, y] of [[-BIN, -BIN], [BIN, -BIN], [BIN, BIN], [-BIN, BIN]] as Array<[number, number]>) {
    posts.push({ faces: slab(x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0, BIN_H + 0.4, deeper(W, 0.1), { corner: 0.1, bevel: 0.12, paint: woodSides(201 + x + y, 'y') }), edges: true });
  }
  // Four walls of slats, open at the top: what is in it seen over them.
  const T = 0.35, all = (seed: number) => ({ front: slats(seed), back: slats(seed + 1), left: slats(seed + 2), right: slats(seed + 3) });
  parts.push({ faces: slab(-BIN, BIN, BIN - T, BIN, 0.3, BIN_H, W, { paint: all(211) }), edges: true });
  parts.push({ faces: slab(-BIN, BIN, -BIN, -BIN + T, 0.3, BIN_H, W, { paint: all(221) }), edges: true });
  parts.push({ faces: slab(-BIN, -BIN + T, -BIN + T, BIN - T, 0.3, BIN_H, W, { paint: all(231) }), edges: true });
  parts.push({ faces: slab(BIN - T, BIN, -BIN + T, BIN - T, 0.3, BIN_H, W, { paint: all(241) }), edges: true });
  // The floor inside: bare earth.
  parts.push({ faces: slab(-BIN + T, BIN - T, -BIN + T, BIN - T, 0.05, 0.3, { lit: hex('#7a6050'), shade: hex('#4a3a44') }), solid: false });
  if (level > 0) {
    const z = 0.4 + (BIN_H - 1) * (level / 3);
    const tones = ready ? READY : ROTTING;
    const heap = (g: Ctx, k: PaintCtx, s: Side): void => {
      g.fillStyle = css(tones[0]);
      g.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      const R = rand(251 + level);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = css(tones[1 + (i % 3)], 0.85);
        g.beginPath();
        g.ellipse((R() - 0.5) * s.w, (R() - 0.5) * s.h, 0.2 + R() * 0.3, 0.12 + R() * 0.2, R() * TAU, 0, TAU);
        g.fill();
      }
      if (!ready) {
        // A few green leaves and a stalk on the top of what is still rotting.
        g.strokeStyle = css(hex('#5c8a4c'));
        g.lineWidth = 0.18;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo((R() - 0.5) * s.w, (R() - 0.5) * s.h); g.lineTo((R() - 0.5) * s.w, (R() - 0.5) * s.h); g.stroke(); }
      }
      void k;
    };
    parts.push({ faces: slab(-BIN + T, BIN - T, -BIN + T, BIN - T, 0.3, z, { lit: tones[0], shade: mix(tones[0], hex('#3e3040'), 0.4) }, { paint: { top: heap } }), solid: false });
  }
  parts.push(...posts);
  return { parts, shade: shadeOf(-BIN - 0.5, BIN + 0.5, -BIN - 0.5, BIN + 0.5) };
}

export const COMPOST_BIN: KitPiece = {
  model: (look) => compostBinOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: 1, label: 'empty' }, { trim: 2, label: 'a third' }, { trim: 4, label: 'full' }, { trim: 8, label: 'compost' }],
};

/* ---- 3. the stone lantern ----------------------------------------------------------------------- */

/** Its light box's middle, where it glows from at night. */
const LIGHT_AT: V3 = [0, 0, 9.1];
/** The pale gold the runes throw (`RUNESTONE_CAST`). */
const RUNE_LIGHT = '255, 214, 140';

function stoneLanternOf(look: KitLook): KitModel {
  const m = mossOf(look.trim);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 1.1);
  const RUNES = ['ingwaz', 'dagaz', 'ansuz', 'kenaz', 'sowilo', 'algiz'];
  // A hexagonal foot; a shaft with a rune cut in each face; a square platform; the light box; a wide roof; a jewel on top.
  add(mossed(lathe(0, 0, [[0, 3.3], [0.75, 3.3], [1.15, 2.6]], 6, BLOCK, 0.5, (_, i, s) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => skin(301 + i)(g, k, s) })), m, 301), { edges: true });
  add(lathe(0, 0, [[1.15, 1.25], [6.4, 1.05]], 6, BLOCK, 0.5, (_, i, s) => ({
    crease: 0.2,
    paint: (g: Ctx, k: PaintCtx) => { skin(311 + i)(g, k, s); inlay(g, k.fill, RUNES[i % RUNES.length], s.w / 2, s.h * 0.55, 0.3, 0.1); },
  })), { edges: true });
  add(mossed(slab(-2.5, 2.5, -2.5, 2.5, 6.4, 7.5, DRESSED, { corner: 0.6, bevel: 0.24, paint: { front: skin(321), back: skin(322), left: skin(323), right: skin(324) } }), m, 321, [-2.5, 2.5, -2.5, 2.5, 7.5]), { edges: true });
  // The light box: a square of stone, a round window in each face with the runes' gold behind it.
  const windowed = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    stoneSkin(g, k.fill, s.w, s.h, seed, 1);
    const cx = s.w / 2, cy = s.h * 0.5, r = Math.min(s.w, s.h) * 0.3;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255, 244, 206, 1)');
    gr.addColorStop(0.6, 'rgba(250, 210, 132, 1)');
    gr.addColorStop(1, 'rgba(214, 150, 84, 1)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = css(mix(k.fill, hex('#3e3040'), 0.55));
    g.lineWidth = 0.16;
    g.stroke();
  };
  add(slab(-1.65, 1.65, -1.65, 1.65, 7.5, 10.7, DRESSED, { corner: 0.25, paint: { front: windowed(331), back: windowed(332), left: windowed(333), right: windowed(334) } }), { edges: true });
  // The roof: four sloped faces flaring out over the box, their eaves turned up at the corners.
  const roof = add(mossed(lathe(0, 0, [[10.7, 3.6], [10.95, 4.35], [11.3, 4.2], [12.05, 2.6], [12.75, 1.25], [13.05, 0.6]], 4, DRESSED, 0, (_, i, s) => ({
    crease: 0.3, paint: (g: Ctx, k: PaintCtx) => skin(341 + i)(g, k, s),
  })), m, 341), { edges: true });
  add(lathe(0, 0, [[13.0, 0.55], [13.45, 0.8], [13.95, 0.62], [14.3, 0.22], [14.55, 0.02]], 8, paler(DRESSED, 0.1), 0.5, () => ({ crease: 0.2 })), { edges: true, after: [roof] });
  if (m && m.k > 0.45) parts.push({ ...mossCushion([0.9, 0.9, 12.2], 0.5 + 0.3 * m.k), after: [roof] });
  return { parts, shade: shadeOf(-3.4, 3.4, -3.4, 3.4) };
}

export const STONE_LANTERN: KitPiece = {
  model: (look) => stoneLanternOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'bare' }, { trim: mossAt(3), label: 'moss 3' }, { trim: mossAt(7), label: 'moss 7' }],
  // Its windows' gold, alive at night, over the bake; and the night taken off it there.
  live: (ctx, sx, sy, zoom, view, night) => {
    if (night <= 0.02) return;
    const [x, y] = onScreen(sx, sy, zoom, view, LIGHT_AT);
    glow(ctx, x, y, 7 * zoom, 0.55 * night, RUNE_LIGHT);
  },
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, LIGHT_AT);
    return [{ x, y, r: 3.2 * zoom, a: 0.95 }, { x, y, r: 9 * zoom, a: 0.3 }];
  },
};

/* ---- 4. the woven rug ---------------------------------------------------------------------------- */

/**
 * A rug's trim: its pattern (nought to two) and up to three colours, each
 * five bits a channel and nought for none -- every combination its own bake.
 */
const COLOUR_BASE = 32769;
const code = (hexStr: string | undefined): number => {
  if (!hexStr || !/^#[0-9a-f]{6}$/i.test(hexStr)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexStr.slice(i, i + 2), 16) >> 3);
  return 1 + ((r << 10) | (g << 5) | b);
};
const uncode = (c: number): RGB | null => (c <= 0 ? null : [(((c - 1) >> 10) & 31) * 8.2, (((c - 1) >> 5) & 31) * 8.2, ((c - 1) & 31) * 8.2]);
export const rugTrim = (pattern: number, colours: readonly string[]): number =>
  1 + pattern + 4 * (code(colours[0]) + COLOUR_BASE * (code(colours[1]) + COLOUR_BASE * code(colours[2])));
function rugOf(trim: number | undefined): { pattern: number; colours: Array<RGB | null> } {
  const t = trim && trim > 0 ? Math.floor(trim) - 1 : 0;
  const pattern = t % 4;
  let c = Math.floor(t / 4);
  const out: Array<RGB | null> = [];
  for (let i = 0; i < 3; i++) { out.push(uncode(c % COLOUR_BASE)); c = Math.floor(c / COLOUR_BASE); }
  return { pattern: Math.min(2, pattern), colours: out };
}
/** Undyed wool, and its natural shade: what a rug of one colour or none is woven in besides. */
const WOOL: RGB = hex('#ecdcbf');
const WOOL_DARK: RGB = hex('#a98d70');
const RUG_X = 8.6, RUG_Y = 6.4;

function wovenRugOf(look: KitLook): KitModel {
  const { pattern, colours } = rugOf(look.trim);
  const [a, b, c] = colours;
  // A field, a second colour and a third: the dyes, with the wool's own shades where there are fewer.
  const c1 = a ?? WOOL, c2 = b ?? (a ? WOOL : WOOL_DARK), c3 = c ?? (b ? WOOL : a ? mix(a, hex('#3e3040'), 0.45) : hex('#c27a62'));
  const top = (g: Ctx, _k: PaintCtx, s: Side): void => {
    const w = s.w, h = s.h, x0 = -w / 2, y0 = -h / 2;
    const fill = (col: RGB, x: number, y: number, ww: number, hh: number): void => { g.fillStyle = css(col); g.fillRect(x, y, ww, hh); };
    fill(c1, x0, y0, w, h);
    if (pattern === 0) {
      // Stripes across it: wide bands of the second colour, narrow of the third.
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) / n) * w;
        fill(i % 2 ? c3 : c2, x - (i % 2 ? 0.25 : 0.7), y0, i % 2 ? 0.5 : 1.4, h);
      }
    } else if (pattern === 1) {
      // A border of the second colour, a line of the third inside it, and a medallion.
      const bw = 1.3;
      fill(c2, x0, y0, w, bw); fill(c2, x0, y0 + h - bw, w, bw); fill(c2, x0, y0, bw, h); fill(c2, x0 + w - bw, y0, bw, h);
      g.strokeStyle = css(c3); g.lineWidth = 0.32;
      g.strokeRect(x0 + bw + 0.45, y0 + bw + 0.45, w - 2 * bw - 0.9, h - 2 * bw - 0.9);
      g.fillStyle = css(c3);
      g.beginPath(); g.ellipse(0, 0, w * 0.13, h * 0.16, 0, 0, TAU); g.fill();
      g.fillStyle = css(c2);
      g.beginPath(); g.ellipse(0, 0, w * 0.07, h * 0.09, 0, 0, TAU); g.fill();
    } else {
      // A row of diamonds, the middle one the largest, outlined in the third colour, and a thin border.
      g.strokeStyle = css(c3); g.lineWidth = 0.3;
      g.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      for (const [cx, k] of [[-w * 0.3, 0.55], [0, 1], [w * 0.3, 0.55]] as Array<[number, number]>) {
        const rx = w * 0.13 * k, ry = h * 0.36 * k;
        g.beginPath(); g.moveTo(cx - rx, 0); g.lineTo(cx, -ry); g.lineTo(cx + rx, 0); g.lineTo(cx, ry); g.closePath();
        g.fillStyle = css(c2); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(cx - rx * 0.4, 0); g.lineTo(cx, -ry * 0.4); g.lineTo(cx + rx * 0.4, 0); g.lineTo(cx, ry * 0.4); g.closePath();
        g.fillStyle = css(c3); g.fill();
      }
    }
    // The weave: a faint grain along it.
    g.strokeStyle = 'rgba(62, 48, 64, 0.08)';
    g.lineWidth = 0.08;
    for (let y = y0 + 0.3; y < y0 + h; y += 0.45) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
  };
  const T: Tone = { lit: mix(c1, [255, 250, 240], 0.12), shade: mix(c1, hex('#5a4660'), 0.4) };
  const body = slab(-RUG_X, RUG_X, -RUG_Y, RUG_Y, 0, 0.22, T, { corner: 0.15, paint: { top } });
  const parts: KitPart[] = [{ faces: body, edges: true, ink: 0.7 }];
  // A fringe at either end.
  parts.push({
    reach: [[-RUG_X - 0.9, -RUG_Y, 0], [RUG_X + 0.9, RUG_Y, 0.1]], solid: false,
    draw: (g, e) => {
      g.strokeStyle = css(mix(WOOL, hex('#8a7464'), 0.25));
      g.lineWidth = Math.max(0.5, 0.12 * Math.hypot(e.ux, e.vx));
      for (const sgn of [-1, 1]) {
        for (let y = -RUG_Y + 0.35; y < RUG_Y; y += 0.7) {
          const [ax, ay] = proj(e, [sgn * RUG_X, y, 0.1]), [bx, by] = proj(e, [sgn * (RUG_X + 0.8), y, 0.02]);
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
      }
    },
  });
  return { parts, shade: null };
}

export const WOVEN_RUG: KitPiece = {
  model: (look) => wovenRugOf(look), uses: { trim: true },
  states: [
    { trim: rugTrim(0, []), label: 'stripes, undyed' },
    { trim: rugTrim(1, ['#b8423a']), label: 'border, 1 colour' },
    { trim: rugTrim(2, ['#2f5e9e', '#e2b34a']), label: 'diamond, 2 colours' },
    { trim: rugTrim(0, ['#6a2f6e', '#e8c26a', '#3f8a6a']), label: 'stripes, 3 colours' },
    { trim: rugTrim(1, ['#3d6b4a', '#d9b98a', '#9a3a2e']), label: 'border, 3 colours' },
  ],
};

/* ---- 5. the curtains ----------------------------------------------------------------------------- */

/** Where a wall's face is, from the middle of the row of spots along it: toward the piece's front (the window box's). */
const FACE_Y = UNITS_PER_TILE / 8 - WALL_THICK * UNITS_PER_TILE;
/** The rod, the hem, and how far either side of the window's middle they reach: the window is 9 to 21 up, 6.8 either side. */
const ROD_Z = 22.3, HEM_Z = 8.4, ROD_X = 8.6;
/** Curtains' trim: one open, two drawn. Unsaid: open. */
export const curtainTrim = (shut: boolean): number => (shut ? 2 : 1);

function curtainsOf(look: KitLook): KitModel {
  const C = clothTone(look.tint);
  const shut = Math.floor(look.trim ?? 1) === 2;
  const y1 = FACE_Y - 0.25, y0 = y1 - 0.4;
  const parts: KitPart[] = [];
  const folds = (seed: number, n: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
    g.fillStyle = css(k.fill);
    g.fillRect(0, 0, s.w, s.h);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * s.w;
      g.fillStyle = css(mix(k.fill, hex('#5a4660'), 0.32), 0.7);
      g.fillRect(x - s.w / n * 0.16, 0, s.w / n * 0.32, s.h);
      g.fillStyle = css(mix(k.fill, [255, 250, 240], 0.25), 0.6);
      g.fillRect(x + s.w / n * 0.22, 0, s.w / n * 0.12, s.h);
    }
    void seed;
  };
  // Two panels: drawn, meeting in the middle; open, gathered at either side and tied back.
  const panels: Array<[number, number]> = shut ? [[-ROD_X, 0], [0, ROD_X]] : [[-ROD_X, -5.6], [5.6, ROD_X]];
  panels.forEach(([x0, x1], i) => {
    const paint = { front: folds(401 + i, shut ? 9 : 4), back: folds(411 + i, shut ? 9 : 4) };
    if (shut) {
      parts.push({ faces: slab(x0 + 0.05, x1 - 0.05, y0, y1, HEM_Z, ROD_Z - 0.2, C, { paint }), edges: true });
      return;
    }
    // Gathered at a tie: wide under the rod, drawn in to the tie, and falling out again to the hem.
    const TIE = 13.6, xc = (x0 + x1) / 2, k = (z: number): number => (z >= TIE ? 0.45 + 0.55 * ((z - TIE) / (ROD_Z - TIE)) : 0.45 + 0.3 * ((TIE - z) / (TIE - HEM_Z)));
    const gather = (f: Face[]): Face[] => warped(f, (p) => [xc + (p[0] - xc) * k(p[2]), p[1], p[2]]);
    parts.push({ faces: gather(slab(x0 + 0.05, x1 - 0.05, y0, y1, TIE, ROD_Z - 0.2, C, { paint })), edges: true });
    parts.push({ faces: gather(slab(x0 + 0.05, x1 - 0.05, y0, y1, HEM_Z, TIE, C, { paint })), edges: true });
    const w = (x1 - x0) * 0.25;
    parts.push({ faces: slab(xc - w, xc + w, y0 - 0.2, y1 + 0.05, TIE - 0.35, TIE + 0.35, deeper(C, 0.35), { corner: 0.1 }), edges: true });
  });
  // The rod across, on two brackets, a knob at either end.
  const W = woodTone(undefined, undefined);
  parts.push({ faces: rod([-ROD_X - 0.6, y0 + 0.2, ROD_Z], [ROD_X + 0.6, y0 + 0.2, ROD_Z], 0.24, W, 6), edges: true });
  for (const x of [-ROD_X - 0.6, ROD_X + 0.6]) parts.push({ faces: lathe(x, y0 + 0.2, [[ROD_Z - 0.4, 0.15], [ROD_Z - 0.1, 0.42], [ROD_Z + 0.35, 0.42], [ROD_Z + 0.6, 0.12]], 6, W), edges: true });
  return { parts, shade: null };
}

export const CURTAINS: KitPiece = {
  model: (look) => curtainsOf(look), uses: { trim: true, tint: true },
  states: [{ trim: 1, label: 'open' }, { trim: 2, label: 'drawn' }],
};

/* ---- 6. the armour stand ------------------------------------------------------------------------- */

/** How high the plinth stands that the mannequin's feet are on. */
export const STAND_FOOT = 1.4;
/**
 * What draws an armour stand's mannequin, wearing what the stand holds, over
 * its bake: set by `render/decorlook.ts`, which brings in the figure (the
 * player's own body and gear). `seed` is the piece's id.
 */
export const mannequin: { draw: ((ctx: Ctx, sx: number, sy: number, zoom: number, view: KitView, seed: number) => void) | null } = { draw: null };

function standOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.5);
  const parts: KitPart[] = [];
  // Two feet crossed, a round plinth over them, and the post up into the mannequin.
  parts.push({ faces: slab(-3.4, 3.4, -0.55, 0.55, 0, 0.75, deeper(W, 0.1), { corner: 0.2, bevel: 0.15, paint: woodSides(501, 'x') }), edges: true });
  parts.push({ faces: slab(-0.55, 0.55, -3.4, 3.4, 0, 0.75, deeper(W, 0.1), { corner: 0.2, bevel: 0.15, paint: woodSides(505, 'y') }), edges: true });
  parts.push({ faces: lathe(0, 0, [[0.75, 2.2], [1.1, 2.2], [STAND_FOOT, 1.9]], 10, W, 0.5, (_, i, s) => ({ crease: 0.18, paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 511 + i, 'x', 0.6) })), edges: true });
  parts.push({ faces: lathe(0, 0, [[STAND_FOOT, 0.32], [STAND_FOOT + 3, 0.3]], 6, deeper(W, 0.2)), edges: true });
  // The mannequin's height, which is drawn over the bake (`mannequin`).
  parts.push(reach([[-4, -3, 0], [4, 3, STAND_FOOT + 18.5]]));
  return { parts, shade: shadeOf(-3.4, 3.4, -3.4, 3.4) };
}

export const ARMOUR_STAND: KitPiece = {
  model: (look) => standOf(look), uses: { material: true, tint: true },
  live: (ctx, sx, sy, zoom, view, _night, _t, air) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, STAND_FOOT]);
    mannequin.draw?.(ctx, x, y, zoom, view, air?.seed ?? -1);
  },
};
