import { CAP_H, CH, TH, TW, clamp, cnv, ctxOf, rand, shadowOf } from './draw';
import { MARGIN, drapeLayout, footMoss, hedge, mass, tongueLobes, tussock } from './growth';
import type { Kit } from './kit';
import { A_CX, A_CY, A_R, BEAM, CORBEL, D_HEAD, D_X0, D_X1, GATE_BEAM, V_HEAD, V_X0, V_X1, W_HEAD, W_SILL, W_X0, W_X1, Y_HEAD, Y_SILL, Y_X0, Y_X1, openingPath } from './openings';
import type { Lobe, Pt } from './types';
import { VARIANTS } from './variants';

/**
 * The pictures of a storey, assembled the same way for every lay through its hooks: the face,
 * each opening cut through it and what grows in it, the ivy over the top, the foot, the cap and the end.
 */

/** A picture of nothing, one per variant, for what does not grow on a bare masonry. */
const bare = (): HTMLCanvasElement[] => VARIANTS.map(() => cnv(1, 1));

/**
 * The pixels of a picture at a luma of 235 or over and nothing else, once
 * per picture: what stays lit on polished metal whichever way it is turned.
 */
export function gleamOf(kit: Kit, img: HTMLCanvasElement): HTMLCanvasElement {
  const { GLEAMS } = kit;
  const had = GLEAMS.get(img);
  if (had) return had;
  const c = cnv(img.width, img.height), g = ctxOf(c);
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) if (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] < 235) p[i + 3] = 0;
  g.putImageData(d, 0, 0);
  GLEAMS.set(img, c);
  return c;
}

export function facePictures(kit: Kit): HTMLCanvasElement[] {
  const { STONES, LAY, S } = kit;
  return VARIANTS.map((v, i) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    STONES[i] = LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, c = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [c - h2, c + h2]; }), false, i);
    return c;
  });
}

/**
 * And the same section with a way through it.
 *
 * The field is painted first, off the variant's own seed, so an arch butts
 * its neighbours on the same straddling stones every other section does --
 * the opening is a long way inside the margin and never touches a seam. Then
 * the pocket, the jambs and the ring, and then the hole out of the lot in
 * one pass: the curve belongs to the compass and the stones to the hammer.
 */
export function archPictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, m = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [m - h2, m + h2]; }), true, -1);
    LAY.arch(kit, g, rand(v.seed * 131 + 17));
    // Opaque, deliberately: `destination-out` takes away as much as the source
    // puts down, so a fill left over at 0.55 from the last pitted stone would
    // leave the field ghosting through the opening at 0.45.
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    openingPath(g);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

/**
 * The ivy that hangs into the opening, one tongue per curtain that reaches
 * over it. It is rooted six pixels above the curve, so it comes out from
 * under the ring rather than out of the air.
 */
export function archIvyPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 991 + 43);
    for (const d of v.drapes) {
      if (!d.fall) continue;
      const half = d.w / 2, dcx = clamp(d.cx, MARGIN + half, TW - MARGIN - half);
      if (dcx - half > A_CX + A_R * 0.85 || dcx + half < A_CX - A_R * 0.85) continue;
      const x = clamp(dcx, A_CX - A_R * 0.76, A_CX + A_R * 0.76);
      const y0 = A_CY - Math.sqrt(Math.max(0, A_R * A_R - (x - A_CX) ** 2)) - 6;
      const cs: Lobe[] = [];
      tongueLobes(cs, x, y0, 13 + 11 * R(), CH * (0.7 + 0.9 * R()), R);
      shadowOf(g, cs, 5, 6);
      mass(g, cs, R, { r: 8.5, lobe: R() < 0.4 ? 1 : 0 });
    }
    return c;
  });
}

/** And what has seeded itself in the gap: grass in the threshold, a tuft on an impost. */
export function archWeedPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 557 + 29);
    for (const side of [-1, 1]) {
      if (R() < 0.4) continue;
      tussock(g, A_CX + side * A_R * (0.42 + R() * 0.42), TH + 3, 34 + R() * 30, 26 + R() * 26, R);
    }
    // The impost is a ledge, and rain that runs off the ring stands on it.
    for (const side of [-1, 1]) {
      if (R() < 0.55) continue;
      tussock(g, A_CX + side * (A_R - 6 + R() * 14), A_CY + 1, 22 + R() * 14, 14 + R() * 10, R);
    }
    return c;
  });
}

/** And the same section with a window in it, drawn and cut the same way. */
export function windowPictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, m = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [m - h2, m + h2]; }), true, -1);
    LAY.surround(kit, g, rand(v.seed * 197 + 61), W_X0, W_X1, W_HEAD, W_SILL, 66, 0);
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.rect(W_X0, W_HEAD, W_X1 - W_X0, W_SILL - W_HEAD);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

/**
 * What grows at a window: ivy over the head of it, and whatever has seeded
 * in the joint behind the sill, which is where the rain that runs off the
 * glass ends up.
 */
export function winIvyPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 883 + 19);
    for (const d of v.drapes) {
      if (!d.fall) continue;
      const half = d.w / 2, dcx = clamp(d.cx, MARGIN + half, TW - MARGIN - half);
      if (dcx - half > W_X1 - 10 || dcx + half < W_X0 + 10) continue;
      const x = clamp(dcx, W_X0 + 18, W_X1 - 18);
      const cs: Lobe[] = [];
      tongueLobes(cs, x, W_HEAD - 8, 11 + 9 * R(), (W_SILL - W_HEAD) * (0.35 + 0.5 * R()), R);
      shadowOf(g, cs, 5, 6);
      mass(g, cs, R, { r: 8.5, lobe: R() < 0.4 ? 1 : 0 });
    }
    return c;
  });
}

export function winWeedPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 419 + 83);
    for (const side of [-1, 1]) {
      if (R() < 0.45) continue;
      const x = (W_X0 + W_X1) / 2 + side * (W_X1 - W_X0) * (0.18 + R() * 0.28);
      tussock(g, x, W_SILL - 2, 22 + R() * 18, 14 + R() * 12, R);
    }
    return c;
  });
}

/** And with a bay: the same hole and surround, on a shelf rather than a sill. */
export function bayPictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, m = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [m - h2, m + h2]; }), true, -1);
    LAY.surround(kit, g, rand(v.seed * 251 + 13), Y_X0, Y_X1, Y_HEAD, Y_SILL, 46, 10);
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.rect(Y_X0, Y_HEAD, Y_X1 - Y_X0, Y_SILL - Y_HEAD);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

/** And the same section with a doorway in it. */
export function doorPictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, m = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [m - h2, m + h2]; }), true, -1);
    LAY.doorway(kit, g, rand(v.seed * 311 + 29), D_X0, D_X1, D_HEAD, BEAM, 0);
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.rect(D_X0, D_HEAD, D_X1 - D_X0, TH - D_HEAD);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

/** And the gate: the same drawing at twice the span, on corbels. */
export function gatePictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.courses(kit, g, rand(v.seed), (S.growth ? v.drapes : []).map((d): Pt => { const h2 = d.w / 2, m = clamp(d.cx, MARGIN + h2, TW - MARGIN - h2); return [m - h2, m + h2]; }), true, -1);
    LAY.doorway(kit, g, rand(v.seed * 373 + 41), V_X0, V_X1, V_HEAD, GATE_BEAM, CORBEL);
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.rect(V_X0, V_HEAD, V_X1 - V_X0, TH - V_HEAD);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
  });
}

/**
 * What grows at a doorway, which is less than anywhere else on the wall,
 * because a doorway is the one part of it somebody walks through every day.
 * Ivy over the head where the curtain reaches that far, and a tuft in each
 * bottom corner where a boot never goes.
 */
export function doorIvyPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 733 + 37);
    for (const d of v.drapes) {
      if (!d.fall) continue;
      const half = d.w / 2, dcx = clamp(d.cx, MARGIN + half, TW - MARGIN - half);
      if (dcx - half > D_X1 - 10 || dcx + half < D_X0 + 10) continue;
      const x = clamp(dcx, D_X0 + 16, D_X1 - 16);
      const cs: Lobe[] = [];
      tongueLobes(cs, x, D_HEAD - 7, 12 + 10 * R(), CH * (0.4 + 0.7 * R()), R);
      shadowOf(g, cs, 5, 6);
      mass(g, cs, R, { r: 8.5, lobe: R() < 0.4 ? 1 : 0 });
    }
    return c;
  });
}

export function doorWeedPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 617 + 53);
    for (const side of [-1, 1]) {
      if (R() < 0.5) continue;
      tussock(g, (side < 0 ? D_X0 : D_X1) + side * (R() * 12 - 4), TH + 2, 26 + R() * 18, 18 + R() * 14, R);
    }
    return c;
  });
}

/**
 * And the gate's, which is thinner again: a cart wheel goes closer to a
 * jamb than a boot does, so only the ivy over the head is sure of itself
 * and there is nothing in the corners but a wisp.
 */
export function gateIvyPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 541 + 71);
    for (const d of v.drapes) {
      if (!d.fall) continue;
      const half = d.w / 2, dcx = clamp(d.cx, MARGIN + half, TW - MARGIN - half);
      if (dcx - half > V_X1 - 10 || dcx + half < V_X0 + 10) continue;
      const x = clamp(dcx, V_X0 + 20, V_X1 - 20);
      const cs: Lobe[] = [];
      tongueLobes(cs, x, V_HEAD - 7, 12 + 10 * R(), CH * (0.4 + 0.7 * R()), R);
      shadowOf(g, cs, 5, 6);
      mass(g, cs, R, { r: 8.5, lobe: R() < 0.4 ? 1 : 0 });
    }
    return c;
  });
}

export function gateWeedPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    const R = rand(v.seed * 467 + 97);
    for (const side of [-1, 1]) {
      if (R() < 0.62) continue;
      tussock(g, (side < 0 ? V_X0 : V_X1) + side * (R() * 10 - 3), TH + 2, 20 + R() * 14, 14 + R() * 10, R);
    }
    return c;
  });
}

/** The growth over the top is painted PAD px taller than the face, the extra above the top edge: the
 *  crest of each drape, standing above the cap, is part of the same silhouette. */
export const PAD = 64;

export function spillPictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH + PAD), g = ctxOf(c);
    g.translate(0, PAD);
    for (const m of v.drapes) {
      const lay = drapeLayout(m, rand(m.seed)), R = rand(m.seed + 1);
      shadowOf(g, lay.cs, 6, 7);
      mass(g, lay.cs, R, { r: lay.r, lobe: R() < 0.33 ? 0 : 1 });
    }
    return c;
  });
}

export function basePictures(kit: Kit): HTMLCanvasElement[] {
  const { S } = kit;
  return !S.growth ? bare() : VARIANTS.map((v) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    for (const b of v.foot.hedges) hedge(kit, g, b, rand(b.seed));
    return c;
  });
}

export function footPictures(kit: Kit): HTMLCanvasElement[] {
  const { LAY, S, STONES } = kit;
  return VARIANTS.map((v, i) => {
    const c = cnv(TW, TH), g = ctxOf(c);
    LAY.foot(kit, g, rand(v.seed * 23 + 11));
    // Moss grows on what is there to grow on: a unit the plinth now covers is
    // not, so it does not get a lens of it hanging in front of cut stone.
    const on = S.plinth ? STONES[i].filter((b) => b.y + b.h < TH - S.plinth) : STONES[i].slice();
    if (S.growth) footMoss(kit, g, on, v.extras.moss, rand(v.seed * 19 + 7));
    return c;
  });
}

/** The cap's stone, the same for every variant, drawn under the island's light. */
export function capPicture(kit: Kit): HTMLCanvasElement {
  const { LAY } = kit;
  return (() => {
    const c = cnv(TW, CAP_H), g = ctxOf(c);
    LAY.cap(kit, g);
    return c;
  })();
}

/** The stone at a corner (`Masonry.corner`): as deep as the cap, as long as a wall is thick, cut as the cap's are. */
export function endsPicture(kit: Kit): HTMLCanvasElement {
  const { LAY } = kit;
  return (() => {
    const Wc = 64, c = cnv(Wc, TH), g = ctxOf(c), R = rand(7);
    LAY.ends(kit, g, R, Wc);
    return c;
  })();
}

/**
 * On a frame, the end of the ground storey: the side of its end post on the
 * sole, and the footing going round the end as it runs along the face. The
 * post ran down into the grass, beside a face that stood on a footing.
 */
export function endsFootPicture(kit: Kit, ENDS: HTMLCanvasElement): HTMLCanvasElement {
  const { S, LAY } = kit;
  return (() => {
    const Wc = 64, c = cnv(Wc, TH), g = ctxOf(c), R = rand(13), y0 = TH - S.plinth;
    LAY.endsFoot?.(kit, g, R, Wc, y0, ENDS);
    return c;
  })();
}
