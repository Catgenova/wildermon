import { FOUNT, FOUNT_RIM } from '../fountain';
import { SPRING_EDGE, SPRING_SHALLOW, SPRING_WATER } from '../water';
import { DRESSED, FOOTING, lilac, ringCourses, speckle, STONE } from './hearthstone';
import {
  css, faceColour, hex, lathe, mix, proj, TAU,
  type Ctx, type Eye, type Face, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type V3,
} from './core';

/**
 * A tiered fountain (`fountain`, three subtiles by three), in the kit: three
 * basins of the forge's stone one over another on a turned column, each
 * smaller than the one under it -- a broad coursed basin with a dressed
 * coping on a round plinth, a flared bowl, a small bowl -- and an urn of a
 * spout over the top one. Its water is not the model's: the renderer draws
 * it live between the layers (`drawFountain` in fountain.ts, at the heights
 * of `FOUNT`), so the model is in three layers, `trim` saying which -- 0 the
 * plinth and the lowest basin, 1 the column up out of it and the middle
 * bowl, 2 the column over that, the top bowl and the spout. Drawn whole, as
 * it is set down or shown, still water stands in its basins.
 */

const { low, mid, top, spout } = FOUNT;
/** Sides round, for the big basin and for the bowls. */
const BIG = 32, BOWL = 24;

/** A level ring of `n` points on the screen, `r` out at height `z`. */
const ringOn = (e: Eye, r: number, z: number, n = 32): Pt[] => Array.from({ length: n }, (_, i) => proj(e, [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r, z]));
const path = (g: Ctx, p: readonly Pt[]): void => {
  g.beginPath();
  p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

/**
 * A basin's hollow, `inner` across inside its rim at `rim`, `deep` deep: the
 * opening in the rim's top, and inside it the far wall going down in three
 * bands, a step deeper each, to its floor.
 */
function hollow(inner: number, rim: number, deep: number, layer: number): KitPart {
  return {
    layer,
    reach: [[-inner, -inner, rim - deep], [inner, inner, rim]],
    draw: (g, e) => {
      const hole = ringOn(e, inner, rim);
      path(g, hole);
      g.fillStyle = css(faceColour(FOOTING, 0.62));
      g.fill();
      g.save();
      path(g, hole);
      g.clip();
      for (let d = 0; d < 3; d++) {
        g.beginPath();
        const a = ringOn(e, inner, rim - (d * deep) / 3), b = ringOn(e, inner, rim - ((d + 1) * deep) / 3);
        a.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        b.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fillStyle = css(faceColour(DRESSED, 0.86 - d * 0.07));
        g.fill('evenodd');
      }
      g.restore();
      path(g, hole);
      g.strokeStyle = css(mix(faceColour(DRESSED, 0.8), hex('#5f5148'), 0.55));
      g.lineWidth = 0.5;
      g.stroke();
    },
  };
}

/** Still water standing in a basin `inner` across at height `z`: shown only when the fountain is drawn whole, its live water being the renderer's. */
function still(inner: number, z: number, layer: number, under: KitPart): KitPart {
  return {
    layer, wholeOnly: true, after: [under],
    reach: [[-inner, -inner, z], [inner, inner, z]],
    draw: (g, e) => {
      const p = ringOn(e, inner, z);
      path(g, p);
      g.fillStyle = css(SPRING_WATER as [number, number, number]);
      g.fill();
      g.save();
      path(g, p);
      g.clip();
      // A paler band of sky along its far side, and its rim a step deeper.
      const far = ringOn(e, inner * 0.82, z).map(([x, y]): Pt => [x, y + inner * 0.08]);
      g.beginPath();
      p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      far.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = css(SPRING_SHALLOW as [number, number, number], 0.55);
      g.fill('evenodd');
      g.restore();
      path(g, p);
      g.strokeStyle = css(SPRING_EDGE as [number, number, number], 0.6);
      g.lineWidth = 0.4;
      g.stroke();
    },
  };
}

/** A turned side of dressed stone: a hair of grit, and lilac turned from the light. */
const dressedSide = (seed: number, s: Side) => (g: Ctx, k: PaintCtx): void => {
  speckle(g, k.fill, s.w, s.h, seed, 0.5);
  lilac(g, k.L, s.w, s.h);
};

/** A bowl's top in its frame from its middle: the rim's dressed stone round it, a joint cut every so often across it. */
const rimTop = (r: number, inner: number) => (g: Ctx, k: PaintCtx): void => {
  g.strokeStyle = css(mix(k.fill, hex('#9a8ea4'), 0.55), 0.6);
  g.lineWidth = 0.12;
  const n = Math.max(6, Math.round(r * 1.2));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.2;
    g.beginPath();
    g.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.stroke();
  }
};

function fountainOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], layer: number, more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, layer, ...more };
    parts.push(p);
    return p;
  };

  /* -- layer 0: the plinth and the lowest basin, its wall coursed and its coping dressed -- */
  add(lathe(0, 0, [[0, low.lip + 0.6], [0.7, low.lip + 0.6]], BIG, FOOTING, 0.5, (_k, i, s) => ({ paint: (g: Ctx, kk: PaintCtx) => { speckle(g, kk.fill, s.w, s.h, 3 + i, 0.5); lilac(g, kk.L, s.w, s.h); } })), 0, { edges: true });
  const basin = add(lathe(0, 0, [[0.7, low.r], [low.rim - 0.75, low.r], [low.rim - 0.65, low.lip], [low.rim, low.lip]], BIG, STONE, 0.5, (k, i, s) => (k === 0
    ? { crease: 0.12, paint: (g: Ctx, kk: PaintCtx) => { speckle(g, kk.fill, s.w, s.h, 10 + i, 0.5); ringCourses(g, kk.fill, s, i, 20 + i, (low.rim - 1.45) / 3); lilac(g, kk.L, s.w, s.h); } }
    : { tone: DRESSED, crease: 0.12, paint: dressedSide(60 + i, s) }))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, tone: DRESSED, paint: rimTop(low.lip, low.inner) } : f)), 0, { edges: true });
  const lowHollow = hollow(low.inner, low.rim, low.rim - 1, 0);
  lowHollow.after = [basin];
  parts.push(lowHollow, still(low.inner, low.water, 0, lowHollow));

  /* -- layer 1: the column up out of it, and the middle bowl -- */
  add(lathe(0, 0, [[low.water, 2.3], [low.water + 1.1, 2], [6.4, 1.6], [7.6, 1.9], [8.3, 2.4], [mid.under, 2.7]], 16, DRESSED, 0.5, (_k, i, s) => ({ paint: dressedSide(80 + i, s) })), 1, { edges: true });
  const midBowl = add(lathe(0, 0, [[mid.under, 2.7], [9.5, 4.4], [10.3, 6], [10.9, 7], [mid.rim, mid.r]], BOWL, STONE, 0.5, (k, i, s) => ({
    crease: 0.12,
    paint: (g: Ctx, kk: PaintCtx) => {
      speckle(g, kk.fill, s.w, s.h, 100 + k * 31 + i, 0.5);
      // A string course round the bowl's belly.
      if (k === 2) { g.fillStyle = css(mix(kk.fill, [255, 250, 240], 0.3), 0.6); g.fillRect(-1, 0, s.w + 2, 0.25); }
      lilac(g, kk.L, s.w, s.h);
    },
  })).map((f, j, all) => (j === all.length - 1 ? { ...f, tone: DRESSED, paint: rimTop(mid.r, mid.r - FOUNT_RIM) } : f)), 1, { edges: true });
  const midHollow = hollow(mid.r - FOUNT_RIM, mid.rim, 1.6, 1);
  midHollow.after = [midBowl];
  parts.push(midHollow, still(mid.r - FOUNT_RIM, mid.rim - 0.2, 1, midHollow));

  /* -- layer 2: the column over it, the top bowl and the spout -- */
  add(lathe(0, 0, [[mid.rim, 1.4], [12.4, 1.15], [13.6, 1.1], [14.1, 1.35], [top.under, 1.7]], 14, DRESSED, 0.5, (_k, i, s) => ({ paint: dressedSide(140 + i, s) })), 2, { edges: true });
  const topBowl = add(lathe(0, 0, [[top.under, 1.7], [14.9, 2.6], [15.6, 3.4], [top.rim, top.r]], 18, STONE, 0.5, (k, i, s) => ({ crease: 0.12, paint: dressedSide(160 + k * 19 + i, s) }))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, tone: DRESSED, paint: rimTop(top.r, top.r - FOUNT_RIM) } : f)), 2, { edges: true });
  const topHollow = hollow(top.r - FOUNT_RIM, top.rim, 1, 2);
  topHollow.after = [topBowl];
  const topStill = still(top.r - FOUNT_RIM, top.rim - 0.2, 2, topHollow);
  parts.push(topHollow, topStill);
  // The spout: a small urn the water wells up out of, a dark mouth in its top.
  add(lathe(0, 0, [[top.rim - 0.4, 1.05], [16.9, 0.72], [17.7, 0.82], [18.4, 1.08], [18.9, 0.88], [spout, 0.55]], 12, DRESSED, 0.5, (_k, i, s) => ({ paint: dressedSide(200 + i, s) }))
    .map((f, j, all) => (j === all.length - 1 ? { ...f, paint: (g: Ctx) => { g.beginPath(); g.arc(0, 0, 0.32, 0, TAU); g.fillStyle = '#4a6a78'; g.fill(); } } : f)), 2, { edges: true, after: [topHollow, topStill] });

  const R = low.lip + 0.6;
  const shade: V3[] = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * TAU) * R, Math.sin((i / 16) * TAU) * R, 0]);
  return { parts, shade };
}

export const FOUNTAIN: KitPiece = {
  model: () => fountainOf(),
  uses: {},
  layers: 3,
};
