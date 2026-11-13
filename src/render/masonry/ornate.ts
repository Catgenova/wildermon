import { BOND_LAY, bedTops } from './bond';
import { COPE } from './coping';
import { TH, poly, roughen } from './draw';
import type { Kit } from './kit';
import { dressed } from './laid';
import { A_CX, A_CY, A_R, IMPOST_H, OVER } from './openings';
import { stone } from './stone';
import type { Ctx, Lay, Pt, Rand } from './types';

/**
 * Slate: a bond laid for show, its openings in flat arches, its gate piers square and true.
 */

/*
 * On slate the openings are laid for show like the field round them. Every
 * dressing is cut square and set true: the jambs long and short in the pale
 * slate, two courses of brick to a stone so the brick runs into the notches
 * between them, and over every head a flat arch of gauged voussoirs, pale
 * and violet turn about -- the diaper's violet carried into the dressings --
 * locked by a pale keystone that stands proud of it. No oak: a wall laid
 * for show was built by somebody who could cut a voussoir.
 */
/** A dressing: its bed of mortar, then the stone on it, square and true. */
export function dressing(kit: Kit, g: Ctx, x: number, y: number, w: number, h: number, R: Rand, tone: string): Pt[] {
  const { PASTEL, MORTAR } = kit;
  g.fillStyle = PASTEL.ringJoint;
  g.fillRect(x - MORTAR, y - MORTAR, w + 2 * MORTAR, h + 2 * MORTAR);
  return stone(kit, g, x, y, w, h, R, tone, 'unit', 0, 1.8);
}

/**
 * A stone cut to a line: the same shade, lit face, bevel and ink as any
 * block, round a polygon drawn straight from corner to corner rather than
 * curved through it, because an arris a mason has cut is a corner.
 */
function cutStone(kit: Kit, g: Ctx, pts: Pt[], tone: string): void {
  const { TONES, PASTEL } = kit;
  const T = TONES[tone] || TONES[''];
  g.beginPath(); poly(g, pts); g.fillStyle = T.shade; g.fill();
  g.save(); g.clip();
  g.beginPath(); poly(g, pts, -2, -2.5); g.fillStyle = T.lit; g.fill();
  g.globalAlpha = 0.45;
  g.beginPath(); poly(g, pts, 1.5, 2); g.strokeStyle = T.hi; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
  g.restore();
  g.beginPath(); poly(g, pts); g.strokeStyle = PASTEL.line; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
}

/** Which of its two tones a dressing takes: the pale slate, and one in eight the step darker. */
export const dressTone = (R: Rand): string => (R() < 0.12 ? 'plinth' : 'dress');

/**
 * One jamb of an opening laid for show, on the jamb `line` from `top` down
 * to `bottom`: stones laid to the brick's own beds, two courses to a
 * stone, short and long turn about from the head down and in step on both
 * sides, the way a surround is set out -- short at the head, so the end of
 * the arch over it covers it.
 */
function ornateJamb(kit: Kit, g: Ctx, R: Rand, side: number, line: number, top: number, bottom: number, long: number, short: number): void {
  const { MORTAR } = kit;
  const beds = bedTops(kit).filter((y, i) => i % 2 === 0 && y > top + 12 && y < bottom - 12);
  const ys = [top, ...beds, bottom];
  for (let k = 0; k + 1 < ys.length; k++) {
    const w = (k % 2 ? long : short) + (R() - 0.5) * 4;
    const x = side < 0 ? line + OVER - w : line - OVER;
    dressing(kit, g, x, ys[k] + MORTAR / 2, w, ys[k + 1] - ys[k] - MORTAR, R, dressTone(R));
  }
}

/**
 * A flat arch over a head from `x0` to `x1`, `deep` deep: an odd number of
 * voussoirs on joints that all point at one centre under the opening, so
 * the arch is wider at its top than at its soffit and its end joints are
 * the skewbacks it springs from; pale and violet turn about out from the
 * keystone, which is a size wider than the rest and stands proud above.
 */
function flatArch(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number): void {
  const { MORTAR, PASTEL } = kit;
  const span = x1 - x0, cx = (x0 + x1) / 2;
  let n = Math.max(5, Math.round(span / 32));
  if (n % 2 === 0) n++;
  const crown = (n - 1) / 2;
  // The centre the joints point at: far enough under the soffit that each
  // skewback leans out by a third of the arch's depth over the whole of it.
  const cy = head + (span / 2) * 3;
  const at = (xb: number, y: number): Pt => [cx + ((xb - cx) * (cy - y)) / (cy - head), y];
  const bs: number[] = [];
  for (let i = 0; i <= n; i++) bs.push(x0 + (span * i) / n);
  bs[crown] -= (span / n) * 0.2;
  bs[crown + 1] += (span / n) * 0.2;
  const top = head - deep, rise = 8, foot = head - 1;
  g.beginPath(); poly(g, [at(x0, foot + MORTAR), at(x1, foot + MORTAR), at(x1, top - MORTAR), at(x0, top - MORTAR)]);
  g.fillStyle = PASTEL.ringJoint; g.fill();
  const j = MORTAR / 2;
  for (let i = 0; i < n; i++) {
    if (i === crown) continue;
    const wedge: Pt[] = [at(bs[i] + j, foot), at(bs[i + 1] - j, foot), at(bs[i + 1] - j, top), at(bs[i] + j, top)];
    cutStone(kit, g, roughen(wedge, R, 4, 0.35), (i - crown) % 2 ? 'vous' : 'dress');
  }
  // The keystone last, over the joints either side of it: standing proud
  // above the arch, and flaring a little, as a keystone is cut.
  const k0 = at(bs[crown] + j - 3, top - rise), k1 = at(bs[crown + 1] - j + 3, top - rise);
  g.fillStyle = PASTEL.ringJoint;
  g.fillRect(k0[0] - MORTAR, top - rise - MORTAR, k1[0] - k0[0] + 2 * MORTAR, rise + MORTAR + 2);
  cutStone(kit, g, roughen([at(bs[crown] + j, foot + 4), at(bs[crown + 1] - j, foot + 4), k1, k0], R, 4, 0.35), 'dress');
}

/** A window or a bay laid for show: a sill standing proud, the jambs, and a flat arch over the head. */
function ornateSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, wide: number, shelf: number): void {
  const { MORTAR } = kit;
  const sx = x0 - 16 - shelf, sw = x1 - x0 + 32 + shelf * 2, sy = sill + 20 + shelf;
  dressing(kit, g, sx, sill - 4, sw, 24 + shelf, R, 'dress');
  const sh = g.createLinearGradient(0, sy, 0, sy + 9);
  sh.addColorStop(0, 'rgba(40, 32, 62, 0.42)');
  sh.addColorStop(1, 'rgba(40, 32, 62, 0)');
  g.fillStyle = sh;
  g.fillRect(sx + 3, sy, sw - 6, 9);
  const short = wide * 0.62;
  for (const side of [-1, 1]) ornateJamb(kit, g, R, side, side < 0 ? x0 : x1, head, sill - 4 - MORTAR, wide, short);
  flatArch(kit, g, R, x0 + OVER - short, x1 - OVER + short, head, Math.min(40, head - bedTops(kit)[1] - 2 * MORTAR));
}

/**
 * A doorway or a gate laid for show: the jambs to the ground, and the flat
 * arch over the head. A doorway's head is higher than a window's, so its
 * arch is let up into the dogtooth, which stops against it.
 */
function ornateDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number): void {
  for (const side of [-1, 1]) ornateJamb(kit, g, R, side, side < 0 ? x0 : x1, head, TH + 20, 62, 40);
  flatArch(kit, g, R, x0 + OVER - 40, x1 - OVER + 40, head, 38);
}

/**
 * An archway laid for show: the jambs, an impost at the springing, and a
 * ring of voussoirs cut true to one depth, pale and violet turn about out
 * from a keystone that stands proud of the ring.
 */
function ornateArch(kit: Kit, g: Ctx, R: Rand): void {
  const { PASTEL, MORTAR } = kit;
  for (const side of [-1, 1]) ornateJamb(kit, g, R, side, A_CX + side * A_R, A_CY + IMPOST_H, TH + 20, 74, 46);
  for (const side of [-1, 1]) {
    const line = A_CX + side * A_R, deep = A_R * 0.4;
    dressing(kit, g, side < 0 ? line - deep : line - OVER, A_CY - 3, deep + OVER, IMPOST_H + 3, R, 'dress');
  }
  const n = 13, crown = (n - 1) / 2, depth = 0.3, key = 0.42, GAP = 0.006;
  const cut: number[] = [];
  for (let i = 0; i <= n; i++) cut.push(i / n);
  cut[crown] -= 0.2 / n;
  cut[crown + 1] += 0.2 / n;
  const pt = (c: number, r: number): Pt => {
    const a = Math.PI * (1 + c);
    return [A_CX + Math.cos(a) * A_R * (1 + r), A_CY + Math.sin(a) * A_R * (1 + r)];
  };
  // The mortar the ring is bedded in, which shows in its joints.
  g.beginPath();
  for (let k = 0; k <= 48; k++) { const [x, y] = pt(k / 48, depth + 0.035); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
  for (let k = 48; k >= 0; k--) { const [x, y] = pt(k / 48, -0.1); g.lineTo(x, y); }
  g.closePath();
  g.fillStyle = PASTEL.ringJoint; g.fill();
  const wedgeOf = (i: number, r: number): Pt[] => {
    const a = cut[i] + GAP, b = cut[i + 1] - GAP, out: Pt[] = [];
    for (let k = 0; k <= 3; k++) out.push(pt(a + ((b - a) * k) / 3, -0.12));
    for (let k = 3; k >= 0; k--) out.push(pt(a + ((b - a) * k) / 3, r));
    return out;
  };
  for (let i = 0; i < n; i++) if (i !== crown) dressed(kit, g, roughen(wedgeOf(i, depth), R, 2, 0.5), (i - crown) % 2 ? 'vous' : 'dress', -2, -2.5, 1.8);
  const kp = wedgeOf(crown, key);
  g.beginPath(); poly(g, kp.map(([x, y]): Pt => [x + (x < A_CX ? -MORTAR : MORTAR), y - MORTAR]));
  g.fillStyle = PASTEL.ringJoint; g.fill();
  dressed(kit, g, roughen(kp, R, 2, 0.5), 'dress', -2, -2.5, 1.8);
}

/**
 * A pier laid for show, square and true, in the dressings' stone: stones as
 * deep as the wall divides into, long and short turn about, and a cap over the lot.
 */
function ornatePier(kit: Kit, g: Ctx, R: Rand, side: number, line: number, fh: number): void {
  const { MORTAR } = kit;
  const n = Math.max(2, Math.round((fh - COPE) / 52)), qh = (fh + 6 - COPE) / n;
  for (let k = 0; k < n; k++) {
    const w = k % 2 ? 40 : 54;
    dressing(kit, g, side < 0 ? line + OVER - w : line - OVER, COPE + k * qh + MORTAR / 2, w, qh - MORTAR, R, dressTone(R));
  }
  dressing(kit, g, side < 0 ? line + OVER - 60 : line - OVER, MORTAR / 2, 60, COPE - MORTAR, R, 'dress');
  g.fillStyle = 'rgba(40, 32, 62, 0.3)';
  g.fillRect(side < 0 ? line + OVER - 64 : line - OVER + 60, 0, 4, fh);
}

/** Slate: a bond laid for show, its openings in flat arches and its gate piers square and true. */
export const ORNATE_LAY: Lay = {
  ...BOND_LAY,
  arch: ornateArch,
  surround: ornateSurround,
  doorway: ornateDoorway,
  gatePier: ornatePier,
};
