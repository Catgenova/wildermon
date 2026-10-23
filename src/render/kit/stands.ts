import {
  clothTone, css, extrude, grain, hex, lathe, mix, prism, slab, stud, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tone, type V3,
} from './core';
import { FELT, LEATHER, PAPER, round, rod, woodSides, woodTones, writing } from './woodwork';

/**
 * The lectern and the coat rack (`lectern`, `coat_rack`, a subtile each), in
 * the kit.
 *
 * A lectern is a turned column on a cross of four feet, their ends cut away,
 * under a slant-topped box, a lip along its low edge with a gold stud in its
 * front, and a book lying open on the slope: leather boards and two blocks of
 * written pages. Of wood alone, so a dye is a paint over the wood.
 *
 * A coat rack is a turned pole on four splayed feet with a peg each way near
 * its top, a knob on each, a cloak hung by its hood from the front one and a
 * felt hat on the left one. The cloak is linen, or the dye; the wood is
 * left as it is.
 */

/* ---- the lectern ----------------------------------------------------------------------- */

/** The desk: half its width, its back and front, its floor, and the slope's high and low edges. */
const LX = 3.8, YB = -3, YF = 2.8, BASE = 8.4, ZB = 11.4, ZF = 9.2;

function lecternOf(look: KitLook): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The feet: one across, and one each way from it front and back, their ends cut away.
  const footSide = (seed: number) => (g: Ctx, k: PaintCtx): void => { g.save(); g.translate(-3.7, 0); grain(g, k.fill, 7.4, 0.85, seed, 'x', 0.5); g.restore(); };
  const foot = (U: V3, A: V3, outline: Pt[], seed: number): Face[] => extrude([0, 0, 0], U, [0, 0, 1], A, outline, -0.55, 0.55, END, 0.12, { front: footSide(seed), back: footSide(seed + 1) });
  add(foot([1, 0, 0], [0, 1, 0], [[-3.7, 0], [3.7, 0], [3.7, 0.35], [2.8, 0.85], [-2.8, 0.85], [-3.7, 0.35]], 3));
  add(foot([0, 1, 0], [1, 0, 0], [[0.55, 0], [3.7, 0], [3.7, 0.35], [2.8, 0.85], [0.55, 0.85]], 5));
  add(foot([0, 1, 0], [1, 0, 0], [[-3.7, 0], [-0.55, 0], [-0.55, 0.85], [-2.8, 0.85], [-3.7, 0.35]], 7));
  // The column, turned: a collar on the feet, a long shaft, and the cup the desk sits in.
  add(lathe(0, 0, [[0.85, 1.15], [1.25, 1.1], [1.55, 0.78], [2.1, 0.62], [7.5, 0.52], [7.75, 0.7], [8.05, 0.9], [BASE, 1.05]], 10, WOOD, 0.5, (kk, i, s) => (kk === 3 ? { paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 11 + i, 'y', 0.4) } : undefined)), { edges: true });
  // The desk: a box seen end on as its slope, pushed across.
  const outline: Pt[] = [[YB, BASE], [YF, BASE], [YF, ZF], [YB, ZB]];
  const sideOf = (seed: number) => (g: Ctx, k: PaintCtx): void => {
    g.save();
    g.translate(YB, BASE);
    grain(g, k.fill, YF - YB, ZB - BASE, seed, 'x', 0.8);
    g.restore();
  };
  const desk = add(extrude([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, -LX, LX, WOOD, 0.16, {
    front: sideOf(21), back: sideOf(22),
    edge: (i) => (i === 2 ? { paint: (g: Ctx, k: PaintCtx) => { g.save(); g.translate(0, -LX); grain(g, k.fill, 6.3, LX * 2, 23, 'x', 0.8); g.restore(); } }
      : i === 3 ? { paint: (g: Ctx, k: PaintCtx) => { g.save(); g.translate(0, -LX); grain(g, k.fill, ZB - BASE, LX * 2, 24, 'y', 0.6); g.restore(); } } : undefined),
  }), { edges: true });
  // A gallery rail along its high edge, behind the book.
  add(slab(-LX, LX, YB - 0.45, YB, ZB - 1.4, ZB + 0.55, TOP, { corner: 0.1, bevel: 0.12, paint: woodSides(27, 'x', 0.5) }), { edges: true });
  // The lip the book rests against, a stud in its front.
  add(slab(-LX, LX, YF, YF + 0.5, ZF - 0.55, ZF + 0.45, TOP, {
    corner: 0.1, bevel: 0.1,
    paint: { ...woodSides(31, 'x', 0.5), front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 31, 'x', 0.5); stud(g, s.w / 2, s.h / 2, 0.36); } },
  }), { edges: true });
  // The book, open on the slope: in the slope's own frame, x across, down it, and up off it.
  const run = Math.hypot(YF - YB, ZB - ZF);
  const d: V3 = [0, (YF - YB) / run, (ZF - ZB) / run], n: V3 = [0, (ZB - ZF) / run, (YF - YB) / run];
  const onSlope = (p: V3): V3 => [p[0], YB + d[1] * p[1] + n[1] * p[2], ZB + d[2] * p[1] + n[2] * p[2]];
  const cover = add(warped(slab(-3.3, 3.3, 0.45, run - 0.3, 0, 0.16, LEATHER, { corner: 0.1 }), onSlope), { after: [desk] });
  const page = (x0: number, x1: number, seed: number): Face[] => warped(slab(x0, x1, 0.6, run - 0.45, 0.16, 0.44, PAPER, {
    bevel: 0.1, crease: 0.25,
    paint: {
      top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); writing(g, k.fill, s.w, s.h, 7, seed); g.restore(); },
      front: (g, k, s) => leaves(g, k, s), back: (g, k, s) => leaves(g, k, s), left: (g, k, s) => leaves(g, k, s), right: (g, k, s) => leaves(g, k, s),
    },
  }), onSlope);
  add(page(-3.1, -0.06, 3), { after: [cover] });
  add(page(0.06, 3.1, 4), { after: [cover] });
  return { parts, shade: [[-3.7, -3.7, 0], [3.7, -3.7, 0], [3.7, 3.7, 0], [-3.7, 3.7, 0]] };
}

/** The edges of a block of pages: fine lines along it. */
function leaves(g: Ctx, k: PaintCtx, s: Side): void {
  g.strokeStyle = css(mix(k.fill, hex('#8a7468'), 0.45), 0.55);
  g.lineWidth = 0.04;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (i * s.h) / 4); g.lineTo(s.w, (i * s.h) / 4); g.stroke(); }
}

/* ---- the coat rack --------------------------------------------------------------------- */

/** The pole's top, where the pegs leave it and reach, and the hat on the left one. */
const PEG_Z0 = 14.5, PEG_Z1 = 15.5, PEG_R = 2.3;

function coatRackOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material);
  const TOP: Tone = { lit: mix(WOOD.lit, [255, 250, 240], 0.08), shade: mix(WOOD.shade, WOOD.lit, 0.08) };
  const CLOTH = clothTone(look.tint);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The feet, splayed out from the foot of the pole, their toes on the floor.
  const footSide = (seed: number) => (g: Ctx, k: PaintCtx): void => grain(g, k.fill, 4, 2.7, seed, 'x', 0.5);
  for (const [i, [dx, dy]] of ([[1, 0], [-1, 0], [0, 1], [0, -1]] as Pt[]).entries()) {
    const U: V3 = [dx, dy, 0], A: V3 = [-dy, dx, 0];
    add(extrude([0, 0, 0], U, [0, 0, 1], A, [[0.5, 0], [3.8, 0], [3.8, 0.42], [0.5, 2.1]], -0.42, 0.42, WOOD, 0.12, { front: footSide(41 + i), back: footSide(45 + i) }));
  }
  // The pole, turned: a collar over the feet, the long shaft, a collar under the pegs and a finial.
  add(lathe(0, 0, [[0, 0.82], [1.2, 0.78], [2.8, 0.62], [3.15, 0.72], [3.45, 0.5], [PEG_Z0 - 0.3, 0.44], [PEG_Z1 + 0.35, 0.46], [PEG_Z1 + 0.55, 0.74], [PEG_Z1 + 1.05, 0.7], [PEG_Z1 + 1.5, 0.4], [PEG_Z1 + 2.0, 0.08]], 10, WOOD, 0.5,
    (kk, i, s) => (kk === 4 ? { paint: (g: Ctx, k: PaintCtx) => grain(g, k.fill, s.w, s.h, 51 + i, 'y', 0.4) } : undefined)), { edges: true });
  // The pegs, rising a little as they leave it, each with a knob.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Pt[]) {
    add(rod([dx * 0.3, dy * 0.3, PEG_Z0], [dx * PEG_R, dy * PEG_R, PEG_Z1], 0.24, WOOD, 6));
    add(lathe(dx * (PEG_R + 0.05), dy * (PEG_R + 0.05), [[PEG_Z1 - 0.15, 0.2], [PEG_Z1, 0.36], [PEG_Z1 + 0.2, 0.38], [PEG_Z1 + 0.35, 0.22], [PEG_Z1 + 0.4, 0.04]], 8, TOP), { edges: true });
  }
  // The cloak, hung by its hood from the front peg: gathered at the top, falling open in folds to its hem.
  const fold = (i: number): number => (i % 2 ? 0.9 : 1.06);
  const N = 16;
  const rings: V3[][] = [
    round(0, 3.3, 5.8, 2.35, 0.95, N, 0.5, fold),
    round(0, 3.2, 10, 1.95, 0.85, N, 0.5, fold),
    round(0, 3.05, 14.1, 1.45, 0.7, N, 0.5),
    round(0, 2.95, 15.35, 0.6, 0.42, N, 0.5),
  ];
  add(prism(rings, CLOTH, (k, i, s) => ({
    crease: 0.22,
    paint: (g: Ctx, c: PaintCtx) => {
      // Darker down in the folds, and the hem turned up.
      if (k === 0) { g.fillStyle = css(mix(c.fill, hex('#5a4458'), 0.3), 0.6); g.fillRect(-0.5, 0, s.w + 1, 0.28); }
      if (i % 2 && k < 2) { g.fillStyle = css(mix(c.fill, hex('#5a4458'), 0.25), 0.35); g.fillRect(s.w * 0.3, 0, s.w * 0.4, s.h); }
    },
  }), { crease: 0.3 }));
  // The hat, felt, on the left peg, its band a step darker.
  const hz = PEG_Z1 + 0.42;
  add(lathe(-PEG_R - 0.35, 0, [[hz, 1.5], [hz + 0.18, 1.56], [hz + 0.24, 0.98], [hz + 1.45, 0.9], [hz + 1.72, 0.62], [hz + 1.8, 0.16]], 12, FELT, 0.5, (kk, _i, s) => (kk === 2 ? {
    paint: (g: Ctx, c: PaintCtx) => { g.fillStyle = css(mix(c.fill, hex('#2e2230'), 0.4)); g.fillRect(-0.5, 0, s.w + 1, 0.32); },
  } : undefined)));
  return { parts, shade: [[-3.4, -3.4, 0], [3.4, -3.4, 0], [3.4, 3.8, 0], [-3.4, 3.8, 0]] };
}

export const LECTERN: KitPiece = { model: (look) => lecternOf(look), uses: { tint: true, material: true } };
export const COAT_RACK: KitPiece = { model: (look) => coatRackOf(look), uses: { tint: true, material: true } };
