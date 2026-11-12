import { BOND_LAY, oversail } from './bond';
import { COPE } from './coping';
import { BAND, TH, TW, bbox, blob, channels, cnv, ctxOf, hexA, lighten, poly, rectPts, shape } from './draw';
import type { Kit } from './kit';
import { A_CX, A_CY, A_R, OVER } from './openings';
import { dressTone, dressing } from './ornate';
import { bleed, crinkle, run, stone, veinOf, wire } from './stone';
import type { Block, Ctx, Lay, Pt, Rand } from './types';

/**
 * Marble: a storey faced in great veined slabs, its openings in architraves under a cornice.
 */

/**
 * One column of slabs, `w` across and `h` down: both courses of it at
 * once, so a vein that leaves the upper slab runs on into the lower.
 *
 * The white, a step either way of the field's own, never warmer; calm
 * clouds of cool grey laid flat into it; and a web rather than a set of
 * strokes -- two or three primary veins crossing it at wide angles to one
 * another, each opening into a lens where it splits and rejoins, lesser
 * threads leaving them at a slant, and a hairline of gold going its own
 * way in three columns in five. Everything is pale and wide: the reference's
 * veins stand a few steps under its white, and a thread under five pixels
 * across, shrunk to a face at the zoom the game is played at, is sampled
 * into dashes. So the threads are five to nine pixels, soft-edged, and it
 * is the crinkle along their edges that carries the drawing.
 */
function slabLeaf(kit: Kit, w: number, h: number, R: Rand): HTMLCanvasElement {
  const { PASTEL } = kit;
  const c = cnv(w, h), g = ctxOf(c);
  const t = R();
  g.fillStyle = t < 0.33 ? lighten(PASTEL.stone, 1.2) : t < 0.66 ? lighten(PASTEL.stone, -1.2) : PASTEL.stone;
  g.fillRect(0, 0, w, h);
  const cloud = (cx: number, cy: number, rx: number, ry: number, rot: number): void => {
    g.save(); g.translate(cx, cy); g.rotate(rot);
    for (const [f, al] of [[1, 0.18], [0.6, 0.16]]) {
      shape(g, blob(0, 0, rx * f, ry * f, 14, R, 0.85, 0.45, 0.4));
      g.fillStyle = hexA(PASTEL.veinSoft, al); g.fill();
    }
    g.restore();
  };
  for (let k = 0; k < 6 + Math.floor(R() * 4); k++) cloud(R() * w, R() * h, 50 + R() * 70, 20 + R() * 30, R() * Math.PI);
  // The primaries: two or three, crossing at fifty degrees and more.
  const th = R() * Math.PI, turn = (0.9 + R() * 0.6) * (R() < 0.5 ? 1 : -1);
  const heads = [th, th + turn];
  if (R() < 0.55) heads.push(th + turn / 2 + Math.PI / 2);
  const primaries = heads.map((a): Pt[] => {
    const cx = w * (0.2 + R() * 0.6), cy = h * (0.15 + R() * 0.7), L = 460;
    return crinkle(cx - (Math.cos(a) * L) / 2, cy - (Math.sin(a) * L) / 2, a, L, R, 6, 0.8);
  });
  for (let k = 0; k < 3; k++) {
    const p = primaries[Math.floor(R() * primaries.length)], [cx, cy] = p[Math.floor(R() * p.length)];
    cloud(cx, cy, 30 + R() * 40, 10 + R() * 12, R() * Math.PI);
  }
  g.lineJoin = 'round';
  for (const p of primaries) bleed(g, p, PASTEL.veinSoft, 22 + R() * 10);
  // The lesser threads, and the lens where a primary splits and rejoins, under the primaries.
  for (let k = 0, m = 4 + Math.floor(R() * 5); k < m; k++) {
    const p = primaries[Math.floor(R() * primaries.length)], i = 2 + Math.floor(R() * (p.length - 4));
    const local = Math.atan2(p[i + 1][1] - p[i - 1][1], p[i + 1][0] - p[i - 1][0]);
    wire(g, crinkle(p[i][0], p[i][1], local + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.35), 40 + R() * 110, R, 6, 0.8), PASTEL.veinFaint, 5 + R(), R);
  }
  for (const p of primaries) {
    if (R() > 0.7) continue;
    const i0 = Math.floor(R() * p.length * 0.6), span = 8 + Math.floor(R() * 14), d = (R() < 0.5 ? -1 : 1) * (10 + R() * 16), q: Pt[] = [];
    for (let k = 0; k <= span && i0 + k + 1 < p.length; k++) {
      const [px, py] = p[i0 + k], [nx, ny] = p[i0 + k + 1], [bx, by] = p[Math.max(0, i0 + k - 1)];
      const dx = nx - bx, dy = ny - by, l = Math.hypot(dx, dy) || 1, s = Math.sin((Math.PI * k) / span) * d;
      q.push([px - (dy / l) * s + (R() - 0.5) * 2, py + (dx / l) * s + (R() - 0.5) * 2]);
    }
    if (q.length > 3) wire(g, q, PASTEL.veinEdge, 5.5, R);
  }
  // The primaries: a soft edge, the core, and a knot or two where the thread runs darker.
  for (const p of primaries) {
    wire(g, p, PASTEL.veinEdge, 8.5 + R() * 1.5, R);
    wire(g, p, PASTEL.vein, 4.8 + R(), R);
    for (let k = 0, m = 1 + Math.floor(R() * 2); k < m; k++) {
      const i0 = Math.floor(R() * (p.length - 8));
      wire(g, p.slice(i0, i0 + 3 + Math.floor(R() * 5)), PASTEL.veinDeep, 4.4, R);
    }
  }
  // And the gold.
  for (let k = 0, m = R() < 0.4 ? 0 : 1 + (R() < 0.3 ? 1 : 0); k < m; k++) {
    const a = R() * Math.PI, cx = w * (0.2 + R() * 0.6), cy = h * (0.2 + R() * 0.6), L = 300;
    g.strokeStyle = PASTEL.veinGold; g.lineWidth = 3.4; g.lineCap = 'round';
    run(g, crinkle(cx - (Math.cos(a) * L) / 2, cy - (Math.sin(a) * L) / 2, a, L, R, 6, 0.9)); g.stroke();
    g.lineCap = 'butt';
  }
  return c;
}

/**
 * The band at the head of a storey of marble: two stones of the dove grey
 * to a section, on the joints of the slabs under them, moulded -- a nosing
 * along the top turned up at the sky with a line of shade under it, the
 * fascia, and a bead along its foot.
 */
export function marbleBand(kit: Kit, g: Ctx, R: Rand): void {
  const { TONES, PASTEL } = kit;
  for (const x of [0, TW / 2]) stone(kit, g, x + 1, 1, TW / 2 - 2, BAND - 2, R, 'flat', 'unit', 0, 1.2);
  g.fillStyle = hexA(TONES.top.lit, 0.92); g.fillRect(0, 1, TW, 7);
  g.fillStyle = hexA(TONES.flat.shade, 0.9); g.fillRect(0, 8, TW, 4);
  g.fillStyle = hexA(TONES.flat.hi, 0.85); g.fillRect(0, BAND - 12, TW, 3);
  g.fillStyle = hexA(PASTEL.line, 0.45); g.fillRect(0, BAND - 8, TW, 3);
  g.fillStyle = PASTEL.joint;
  g.fillRect(0, 0, 1, BAND); g.fillRect(TW / 2 - 1, 0, 2, BAND); g.fillRect(TW - 1, 0, 1, BAND);
}

/**
 * A storey of a marble house wall: the band, and under it the slabs -- two
 * columns across, each from its own block and two courses down, the veins
 * running on over the bed joint between them and breaking at the joint
 * between the columns as they do at the section's seams, so no seam is
 * any different from any other joint -- on joints a hair wide, each
 * slab's arris catching the light along its top and its left and the
 * shade along the others, which is the whole of what shows the joint at
 * a distance. Each variant's pair is painted once and kept: the
 * openings are cut in the same field six times over.
 */
function paintSlabs(kit: Kit, g: Ctx, R: Rand): Block[] {
  const { PASTEL, COLUMNS } = kit;
  g.fillStyle = PASTEL.joint;
  g.fillRect(0, 0, TW, TH);
  marbleBand(kit, g, R);
  const SW = TW / 2, FH = TH - BAND, bed = BAND + FH / 2;
  const key = R();
  let cols = COLUMNS.get(key);
  if (!cols) { cols = [slabLeaf(kit, SW, FH, R), slabLeaf(kit, SW, FH, R)]; COLUMNS.set(key, cols); }
  g.drawImage(cols[0], 0, BAND);
  g.drawImage(cols[1], SW, BAND);
  /*
   * The joints: a hair wide on the stone, and still three or four pixels
   * of the picture, in a grey only a little under the white. A line one
   * or two pixels deep, shrunk to a face at the zoom the game is played
   * at, is sampled on one row and missed on the next, and a bed joint came
   * out as a dotted line across every storey.
   */
  // One whole joint at the left of each column and along the bed, each
  // with the arris beside it catching the light, so the seam at a
  // section's end is drawn once, in full, the same as the joint between
  // the columns -- two halves of it, one at each end of the picture, were
  // lost by the renderer, and the module could be counted by the joints
  // that were not.
  const HI = hexA(PASTEL.stoneHi, 0.9);
  for (const x0 of [0, SW]) { g.fillStyle = PASTEL.slabJoint; g.fillRect(x0, BAND, 3, FH); g.fillStyle = HI; g.fillRect(x0 + 3, BAND, 1.5, FH); }
  g.fillStyle = PASTEL.slabJoint; g.fillRect(0, bed - 1.5, TW, 3); g.fillStyle = HI; g.fillRect(0, bed + 1.5, TW, 1.5);
  oversail(kit, g, 0, BAND, 12);
  return [];
}

/* ---- the openings of a marble wall ------------------------------------- */
/*
 * On marble every opening is framed as a master frames it: an architrave
 * of the dove grey round the jambs and the head, in three pieces mitred
 * where they meet, moulded -- a bead along the outer arris, lit where it
 * faces the light and in shade where it does not, and a fillet where it
 * steps back to the opening -- and over the head a cornice standing proud,
 * its top turned up at the sky and its shade thrown down the architrave;
 * under a window, a sill of the same. An archway takes a moulded ring on
 * imposts, locked by a keystone that stands proud of it.
 */
/** How wide an architrave is. */
const ARCHI = 22;

/** One piece of the dove grey, cut straight round `pts`, veined, with its line. */
function marblePiece(kit: Kit, g: Ctx, R: Rand, pts: Pt[], tone = 'dress', ink = 1.5): void {
  const { TONES, PASTEL } = kit;
  const T = TONES[tone] || TONES.dress, bb = bbox(pts);
  g.beginPath(); poly(g, pts); g.fillStyle = T.lit; g.fill();
  veinOf(kit, g, () => { g.beginPath(); poly(g, pts); }, bb.x, bb.y, bb.w, bb.h, R, T);
  g.beginPath(); poly(g, pts); g.strokeStyle = PASTEL.line; g.lineWidth = ink; g.lineJoin = 'round'; g.stroke();
}

/** An architrave round an opening from `x0` to `x1`, from its head at `head` down to `foot`. */
function architrave(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, foot: number): void {
  const { TONES } = kit;
  const A = ARCHI, X0 = x0 - A, X1 = x1 + A, H = head - A, T = TONES.dress;
  marblePiece(kit, g, R, [[X0, H], [x0, head], [x0, foot], [X0, foot]]);
  marblePiece(kit, g, R, [[x1, head], [X1, H], [X1, foot], [x1, foot]]);
  marblePiece(kit, g, R, [[X0, H], [X1, H], [x1, head], [x0, head]]);
  g.lineWidth = 2.6;
  g.strokeStyle = T.hi;
  g.beginPath(); g.moveTo(X0 + 5, foot); g.lineTo(X0 + 5, H + 5); g.lineTo(X1 - 5, H + 5); g.stroke();
  g.strokeStyle = T.shade;
  g.beginPath(); g.moveTo(X1 - 5, H + 5); g.lineTo(X1 - 5, foot); g.stroke();
  g.fillStyle = T.shade;
  g.fillRect(x0 - 5, head - 5, x1 - x0 + 10, 5);
  g.fillRect(x0 - 5, head, 5, foot - head);
  g.fillStyle = T.hi;
  g.fillRect(x1, head, 5, foot - head);
}

/** A cornice over a head, `deep` deep with its foot at `y`: its top turned to the sky, a drip along its foot, and its shade down what is under it. */
function hood(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, y: number, deep: number): void {
  const { TONES, PASTEL } = kit;
  const top = y - deep;
  const sh = g.createLinearGradient(0, y, 0, y + 10);
  sh.addColorStop(0, 'rgba(58, 50, 84, 0.36)');
  sh.addColorStop(1, 'rgba(58, 50, 84, 0)');
  g.fillStyle = sh; g.fillRect(x0 + 2, y, x1 - x0 - 4, 10);
  marblePiece(kit, g, R, rectPts(x0, top, x1, y));
  g.fillStyle = TONES.top.lit; g.fillRect(x0 + 1, top + 1, x1 - x0 - 2, 5);
  g.fillStyle = TONES.dress.shade; g.fillRect(x0 + 1, y - 5, x1 - x0 - 2, 4);
  g.strokeStyle = PASTEL.line; g.lineWidth = 1.5; g.strokeRect(x0, top, x1 - x0, deep);
}

/** A window or a bay in marble: the architrave, a sill standing proud under it, and a cornice over it. */
function marbleSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, shelf: number): void {
  const { TONES } = kit;
  architrave(kit, g, R, x0, x1, head, sill);
  const s0 = x0 - ARCHI - 8, s1 = x1 + ARCHI + 8, sy = sill + 12 + shelf;
  const sh = g.createLinearGradient(0, sy, 0, sy + 9);
  sh.addColorStop(0, 'rgba(58, 50, 84, 0.36)');
  sh.addColorStop(1, 'rgba(58, 50, 84, 0)');
  g.fillStyle = sh; g.fillRect(s0 + 3, sy, s1 - s0 - 6, 9);
  marblePiece(kit, g, R, rectPts(s0, sill - 2, s1, sy));
  g.fillStyle = TONES.top.lit; g.fillRect(s0 + 1, sill - 1, s1 - s0 - 2, 4);
  hood(kit, g, R, x0 - ARCHI - 10, x1 + ARCHI + 10, head - ARCHI, 16);
}

/** A doorway or a gate in marble: the architrave to the ground, and a cornice over it. */
function marbleDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number): void {
  architrave(kit, g, R, x0, x1, head, TH + 20);
  hood(kit, g, R, x0 - ARCHI - 12, x1 + ARCHI + 12, head - ARCHI, 18);
}

/** An archway in marble: pilaster strips for jambs, an impost on each, the moulded ring over them, and the keystone. */
function marbleArch(kit: Kit, g: Ctx, R: Rand): void {
  const { TONES } = kit;
  const A = ARCHI, r0 = A_R, r1 = A_R + A, T = TONES.dress;
  for (const side of [-1, 1]) {
    const inner = A_CX + side * r0, outer = A_CX + side * r1;
    marblePiece(kit, g, R, rectPts(Math.min(inner, outer), A_CY, Math.max(inner, outer), TH + 20));
  }
  const n = 7, crown = (n - 1) / 2;
  const pt = (a: number, r: number): Pt => [A_CX + Math.cos(a) * r, A_CY - Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    if (i === crown) continue;
    const a0 = Math.PI - (Math.PI * i) / n, a1 = Math.PI - (Math.PI * (i + 1)) / n, pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) pts.push(pt(a0 + ((a1 - a0) * k) / 6, r1));
    for (let k = 6; k >= 0; k--) pts.push(pt(a0 + ((a1 - a0) * k) / 6, r0 - 6));
    marblePiece(kit, g, R, pts);
  }
  g.lineWidth = 1.8;
  g.strokeStyle = T.hi; g.beginPath(); g.arc(A_CX, A_CY, r1 - 4.5, Math.PI, Math.PI * 1.5); g.stroke();
  g.strokeStyle = T.shade; g.beginPath(); g.arc(A_CX, A_CY, r1 - 4.5, Math.PI * 1.5, Math.PI * 2); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.arc(A_CX, A_CY, r0 + 2.5, Math.PI, Math.PI * 2); g.stroke();
  const kh = (Math.PI / n) * 0.36;
  const kp: Pt[] = [pt(Math.PI / 2 + kh * 1.12, r1 + 14), pt(Math.PI / 2 - kh * 1.12, r1 + 14), pt(Math.PI / 2 - kh, r0 - 6), pt(Math.PI / 2 + kh, r0 - 6)];
  marblePiece(kit, g, R, kp, 'dress', 1.6);
  g.fillStyle = TONES.top.lit;
  g.beginPath(); poly(g, [kp[0], kp[1], [kp[1][0], kp[1][1] + 5], [kp[0][0], kp[0][1] + 5]]); g.fill();
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? A_CX - r1 - 6 : A_CX + r0 - 2, x1 = side < 0 ? A_CX - r0 + 2 : A_CX + r1 + 6;
    marblePiece(kit, g, R, rectPts(x0, A_CY - 10, x1, A_CY + 4));
    g.fillStyle = TONES.top.lit; g.fillRect(x0 + 1, A_CY - 9, x1 - x0 - 2, 3);
  }
}

/**
 * A marble gate hangs between two piers as wide as what is left of
 * the wall either side of it, which stand over the wall they end
 * (see `Masonry.piers`): blocks of the dove grey the pier's whole
 * width, the odd course of two, and a cap with its top weathered
 * pale.
 */
function slabPier(kit: Kit, g: Ctx, R: Rand, side: number, line: number, fh: number): void {
  const { MORTAR } = kit;
  const x0 = side < 0 ? -2 : line - OVER, x1 = side < 0 ? line + OVER : TW + 2;
  const n = Math.max(2, Math.round((fh - COPE) / 58)), qh = (fh + 6 - COPE) / n;
  for (let k = 0; k < n; k++) {
    const y = COPE + k * qh + MORTAR / 2;
    if (k % 2) {
      const mid = x0 + (x1 - x0) * (0.42 + R() * 0.16);
      dressing(kit, g, x0, y, mid - x0 - MORTAR / 2, qh - MORTAR, R, dressTone(R));
      dressing(kit, g, mid + MORTAR / 2, y, x1 - mid - MORTAR / 2, qh - MORTAR, R, dressTone(R));
    } else dressing(kit, g, x0, y, x1 - x0, qh - MORTAR, R, dressTone(R));
  }
  dressing(kit, g, x0, MORTAR / 2, x1 - x0, COPE - MORTAR, R, 'dress');
  g.fillStyle = '#d6d9e0'; g.fillRect(x0 + 1, MORTAR / 2 + 1, x1 - x0 - 2, 4.5);
  g.fillStyle = hexA('#969aa6', 0.85); g.fillRect(x0, COPE, x1 - x0, 3);
}

/** Under marble, the slabs' joint. */
function slabUnder(kit: Kit): [number, number, number] { const { PASTEL } = kit; return channels(PASTEL.slabJoint); }

/** Marble: great slabs, its openings in architraves, its gates between piers. */
export const SLAB_LAY: Lay = {
  ...BOND_LAY,
  courses: paintSlabs,
  arch: marbleArch,
  surround: (kit, g, R, x0, x1, head, sill, wide, shelf) => marbleSurround(kit, g, R, x0, x1, head, sill, shelf),
  doorway: marbleDoorway,
  gatePier: slabPier,
  under: slabUnder,
  scatter: true,
  piers: 0.1,
};
