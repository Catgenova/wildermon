import { DISH_R, DISH_Z, drawSky, SKY_REACH, SKY_TOP, skyHoles } from '../altarsky';
import { cut, RUNE_GOLD } from '../runestone';
import { star } from '../star';
import { ashlar, DRESSED, FOOTING, room, speckle, STONE } from './hearthstone';
import {
  BRASS, css, faceColour, hex, lathe, mix, paler, slab, TAU,
  type Ctx, type Face, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side,
} from './core';

/**
 * An altar (`altar`, two subtiles by two), in the kit: a pedestal of the
 * kiln's cream stone -- a coursed plinth and a dressed step all round it to
 * kneel on, a coursed shaft with a gold figure let into a sunk panel on each
 * face (a sun on the front, a crescent on the back, a four-pointed star each
 * side), a moulded capital and a slab bedded on it -- and on the slab a gold
 * chalice holding a pool of night with the first of the stars in it.
 *
 * Over the dish a figure of stars stands turning, drawn live (`altarsky.ts`)
 * and taken off the night after dark; the model keeps room for it, so the
 * altar is as tall as it stands and is clicked there.
 */

/** The shaft's half width and its foot and head; the slab's top. */
const SHAFT = 3.5, SHAFT_Z0 = 2.8, SHAFT_Z1 = 9.6, SLAB_Z = 11.2;
/** The chalice: the top of its stem, where the bowl begins. */
const BOWL = DISH_Z - 1.35;
/** The gold of the chalice and the figures: the kit's brass. */
const GOLD = BRASS;
/** The night in the dish. */
const POOL = '#3f3572';

/* ---- the gold let into the shaft ----------------------------------------------------------- */

type Shape = Pt[];
const round = (r: number, n = 20): Shape => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r]);
/** The sun: eight rays standing past a disc. */
const sun = (): Shape[] => [
  ...Array.from({ length: 8 }, (_, i): Shape => {
    const a = ((i + 0.5) / 8) * TAU, half = 0.3;
    return [[Math.cos(a - half) * 1.15, Math.sin(a - half) * 1.15], [Math.cos(a) * 2.5, Math.sin(a) * 2.5], [Math.cos(a + half) * 1.15, Math.sin(a + half) * 1.15]];
  }),
  round(1.25),
];
/** The crescent: a disc with a bite out of one side. */
const crescent = (): Shape[] => {
  const R = 2.1, r = 1.75, ox = 0.95, oy = 0.3, N = 48, edge: Shape = [];
  for (let i = 0; i <= N; i++) { const a = (i / N) * TAU, x = Math.cos(a) * R, y = Math.sin(a) * R; if (Math.hypot(x - ox, y - oy) >= r) edge.push([x, y]); }
  for (let i = N; i >= 0; i--) { const a = (i / N) * TAU, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r; if (Math.hypot(x, y) < R) edge.push([x, y]); }
  return [edge];
};
/** A four-pointed star, its arms across seven tenths of its arms up and down. */
const fourStar = (): Shape[] => [Array.from({ length: 8 }, (_, i): Pt => {
  const a = (i / 8) * TAU, r = i % 2 ? 0.8 : i % 4 ? 2.3 : 1.6;
  return [Math.cos(a) * r, Math.sin(a) * r];
})];

/**
 * A face of the shaft: its stone in courses, a dressed panel sunk into it,
 * and the gold figure on the panel, edged in a darker gold, a white glint
 * along its upper left. Drawn at two thirds of its height, since a unit up a
 * face is twice as far on the screen as a unit across it.
 */
function shaftFace(shapes: () => Shape[], seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const fill = k.fill;
    speckle(g, fill, s.w, s.h, seed);
    ashlar(g, fill, s.w, s.h, seed + 1, 1.15, (x0, x1, z0, z1) => x1 > 0.7 && x0 < s.w - 0.7 && z1 > 1.3 && z0 < s.h - 1.3);
    // The sunk panel: a step into shade along its top and left, lit along its foot and right.
    const px0 = 0.75, px1 = s.w - 0.75, pz0 = 1.3, pz1 = s.h - 1.3;
    g.fillStyle = css(mix(fill, hex('#9a8ea4'), 0.28));
    g.fillRect(px0, pz0, px1 - px0, pz1 - pz0);
    cut(g, fill, 0.2, () => { g.beginPath(); g.rect(px0, pz0, px1 - px0, pz1 - pz0); });
    const cx = s.w / 2, cz = s.h / 2;
    const gold = mix(faceColour(GOLD, Math.min(1, k.L + 0.1)), hex(RUNE_GOLD), 0.35);
    const path = (shape: Shape, d = 0): void => {
      g.beginPath();
      shape.forEach(([u, v], i) => (i ? g.lineTo(cx + u + d, cz + v * 0.62 - d) : g.moveTo(cx + u + d, cz + v * 0.62 - d)));
      g.closePath();
    };
    g.lineJoin = 'round';
    for (const shape of shapes()) {
      // Its channel, then the gold in it, then its rim in a darker gold.
      path(shape, 0.08);
      g.fillStyle = 'rgba(112, 84, 74, 0.7)';
      g.fill();
      path(shape);
      g.fillStyle = css(gold);
      g.fill();
      g.strokeStyle = css(mix(gold, hex('#7a5a30'), 0.55));
      g.lineWidth = 0.12;
      g.stroke();
    }
  };
}

/** The pool of night in the dish, on the bowl's top in its frame from its middle: a rim of gold round it, and stars in it. */
function pool(g: Ctx, k: PaintCtx): void {
  g.beginPath();
  g.arc(0, 0, DISH_R - 0.75, 0, TAU);
  g.fillStyle = css(mix(k.fill, hex('#7a5a30'), 0.45));
  g.fill();
  g.beginPath();
  g.arc(0, 0, DISH_R - 0.9, 0, TAU);
  const gr = g.createRadialGradient(0, 0, 0.3, 0, 0, DISH_R - 0.9);
  gr.addColorStop(0, '#5a4c9a');
  gr.addColorStop(1, POOL);
  g.fillStyle = gr;
  g.fill();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + 0.5, r = 0.6 + ((i * 7) % 5) * 0.55;
    g.save();
    g.translate(Math.cos(a) * r, Math.sin(a) * r);
    star(g, i % 3 ? 0.42 : 0.55, i % 3 ? 0.2 : 0.26);
    g.fillStyle = i % 3 ? '#f4e4b4' : '#d6c4f4';
    g.fill();
    g.restore();
  }
}

/** A dressed course: its stones' head joints and a hair of grit. */
const dressed = (seed: number, course: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  speckle(g, k.fill, s.w, s.h, seed, 0.6);
  ashlar(g, k.fill, s.w, s.h, seed + 1, course);
};
const sides = (f: (i: number) => (g: Ctx, k: PaintCtx, s: Side) => void) => ({ front: f(0), back: f(1), left: f(2), right: f(3) });

function altarOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The plinth, and the step up all round it.
  add(slab(-8.6, 8.6, -8.6, 8.6, 0, 1.4, FOOTING, { corner: 0.3, bevel: 0.25, paint: sides((i) => dressed(11 + i * 3, 1.4)) }), { edges: true });
  add(slab(-6, 6, -6, 6, 1.4, 2.8, DRESSED, { corner: 0.25, bevel: 0.25, paint: sides((i) => dressed(31 + i * 3, 1.4)) }), { edges: true });
  // The shaft and its gold.
  add(slab(-SHAFT, SHAFT, -SHAFT, SHAFT, SHAFT_Z0, SHAFT_Z1, STONE, {
    corner: 0.2,
    paint: { front: shaftFace(sun, 51), back: shaftFace(crescent, 53), left: shaftFace(fourStar, 55), right: shaftFace(fourStar, 57) },
  }));
  // The capital, and the slab bedded on it.
  add(slab(-4.45, 4.45, -4.45, 4.45, SHAFT_Z1, 10.3, DRESSED, { corner: 0.25, bevel: 0.25 }), { edges: true });
  add(slab(-5.6, 5.6, -5.6, 5.6, 10.3, SLAB_Z, paler(DRESSED, 0.08), {
    corner: 0.35, bevel: 0.3,
    paint: { ...sides((i) => (g: Ctx, k: PaintCtx, s: Side) => speckle(g, k.fill, s.w, s.h, 71 + i, 0.6)), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); speckle(g, k.fill, s.w, s.h, 77, 0.5); g.restore(); } },
  }), { edges: true });
  // The chalice: a foot, a waist and a knop, and the bowl holding the pool.
  const stem = add(lathe(0, 0, [[SLAB_Z, 1.8], [SLAB_Z + 0.25, 1.7], [11.55, 0.9], [11.8, 0.72], [11.95, 0.98], [12.1, 0.72], [BOWL, 1.5]], 14, GOLD), { edges: true });
  add(lathe(0, 0, [[BOWL, 2.2], [BOWL + 0.35, 3.1], [BOWL + 0.95, 4], [DISH_Z, DISH_R]], 18, GOLD, 0.5, () => ({ crease: 0.12 }))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, tone: { lit: mix(GOLD.lit, [255, 246, 214], 0.25), shade: GOLD.shade }, paint: pool } : f)), { edges: true, after: [stem] });
  // Room for the stars over the dish.
  parts.push(room(-SKY_REACH, SKY_REACH, -SKY_REACH, SKY_REACH, DISH_Z, SKY_TOP));
  return { parts, shade: [[-8.6, -8.6, 0], [8.6, -8.6, 0], [8.6, 8.6, 0], [-8.6, 8.6, 0]] };
}

export const ALTAR: KitPiece = {
  model: () => altarOf(),
  uses: {},
  live: (ctx, sx, sy, zoom, view, night, t) => drawSky(ctx, sx, sy, zoom, view, t, night),
  holes: (sx, sy, zoom, view, t) => skyHoles(sx, sy, zoom, view, t),
};

