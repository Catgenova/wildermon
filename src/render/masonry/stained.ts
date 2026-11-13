import { STAINED_OPACITY } from '../flooring';
import { oversail } from './bond';
import { COPE } from './coping';
import { BAND, TH, TW } from './draw';
import type { Kit } from './kit';
import { SLAB_LAY, marbleBand } from './marble';
import { stone } from './stone';
import type { Block, Ctx, Lay, Rand } from './types';

/**
 * Stained glass: leaded panes under the marble's band, in the marble's openings.
 */

/** The colours of stained glass, in the order a pane is offered them. */
const GLASSES = ['glassPink', 'glassPeach', 'glassLemon', 'glassMint', 'glassAqua', 'glassSky', 'glassLilac', 'glassRose', 'glassSage', 'glassCream'];

/** How wide a marble pilaster stands at each end of a section, half of it in each of the two sections it parts. */
const PILASTER = 28;

/**
 * One pane of glass: its own colour, paler toward the light, clouded as a
 * sheet of cathedral glass is, a faint ream run through one pane in two,
 * never straight, and now and then a fleck where the light catches a seed
 * in it.
 */
function pane(g: Ctx, x: number, y: number, w: number, h: number, hex: string, R: Rand): void {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = hex; g.fillRect(x, y, w, h);
  const lit = g.createLinearGradient(x, y, x + w * 0.8, y + h);
  lit.addColorStop(0, 'rgba(255, 253, 246, 0.38)');
  lit.addColorStop(0.55, 'rgba(255, 253, 246, 0.06)');
  lit.addColorStop(1, 'rgba(70, 58, 92, 0.1)');
  g.fillStyle = lit; g.fillRect(x, y, w, h);
  // A cloud or two of paler glass, where the sheet ran thin.
  for (let i = 0; i < 1 + Math.floor((w * h) / 2500); i++) {
    const cx = x + R() * w, cy = y + R() * h, rad = Math.max(w, h) * (0.3 + R() * 0.4);
    const cloud = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    cloud.addColorStop(0, 'rgba(255, 253, 246, 0.3)');
    cloud.addColorStop(1, 'rgba(255, 253, 246, 0)');
    g.fillStyle = cloud; g.fillRect(x, y, w, h);
  }
  // A ream in the sheet, now and then, and faint: drawn every time and strongly, the streaks read as wood grain.
  const streaks = R() < 0.5 ? 1 : 0;
  for (let i = 0; i < streaks; i++) {
    g.strokeStyle = `rgba(255, 253, 246, ${0.08 + R() * 0.07})`;
    g.lineWidth = 1.2 + R() * 0.8;
    const across = w >= h;
    const a = across ? y + R() * h : x + R() * w;
    const b = across ? y + R() * h : x + R() * w;
    g.beginPath();
    if (across) {
      g.moveTo(x - 4, a);
      g.bezierCurveTo(x + w * 0.33, a + (R() - 0.5) * h * 0.8, x + w * 0.66, b + (R() - 0.5) * h * 0.8, x + w + 4, b);
    } else {
      g.moveTo(a, y - 4);
      g.bezierCurveTo(a + (R() - 0.5) * w * 0.8, y + h * 0.33, b + (R() - 0.5) * w * 0.8, y + h * 0.66, b, y + h + 4);
    }
    g.stroke();
  }
  for (let i = 0; i < Math.floor(R() * 2); i++) {
    g.fillStyle = 'rgba(255, 255, 250, 0.45)';
    g.beginPath(); g.arc(x + 3 + R() * (w - 6), y + 3 + R() * (h - 6), 0.8 + R() * 1.0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // The came's own light: a hair of it along the top of the pane, where the lead turns to the sky.
  g.fillStyle = 'rgba(255, 255, 255, 0.28)';
  g.fillRect(x, y, w, 1.2);
}

/**
 * A panel of leaded glass from `y0` down to `y1`, between a marble
 * pilaster at each end of the section.
 *
 * Panes of no set size, packed on a lattice the way a glazier cuts them
 * from what the sheets give: a cell is taken by a pane one or two wide
 * and one to three tall, whatever fits, so the leads run long in places and
 * break short in others. No pane takes the colour of the one beside it or
 * over it. Every section is a panel of its own, so nothing in the glass
 * comes near a seam; the pilaster is what two sections share.
 */
function glassField(kit: Kit, g: Ctx, y0: number, y1: number, R: Rand): void {
  const { TONES, PASTEL } = kit;
  const F = 6, x0 = PILASTER / 2 + 4, x1 = TW - PILASTER / 2 - 4, gy0 = y0 + F, gy1 = y1 - F;
  // The fillet of marble the panel is set in, and nothing where the panel goes: it is seen through.
  g.fillStyle = TONES.dress.lit; g.fillRect(0, y0, TW, y1 - y0);
  g.clearRect(x0, gy0, x1 - x0, gy1 - gy0);
  /*
   * The glass on a sheet of its own, laid in at the opacity stained glass is
   * drawn at, and the lead between the panes on another, laid in whole:
   * whatever stands behind the wall shows through the colour and not
   * through the cames.
   */
  const sheet = (): [HTMLCanvasElement, Ctx] => {
    const c = document.createElement('canvas');
    c.width = TW; c.height = Math.ceil(y1) + 1;
    return [c, c.getContext('2d') as Ctx];
  };
  const [glass, gl] = sheet(), [cames, cm] = sheet();
  cm.fillStyle = PASTEL.lead; cm.fillRect(x0, gy0, x1 - x0, gy1 - gy0);
  // Few panes and big ones, in a lead heavy enough to read at play size: a sliver of a pane is a barcode at a quarter scale.
  const cols = 8, rows = Math.max(2, Math.round((gy1 - gy0) / 48));
  const cw = (x1 - x0) / cols, rh = (gy1 - gy0) / rows, lead = 2.7;
  const taken: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (taken[r][c] >= 0) continue;
      let w = 1 + Math.floor(R() * 2), h = 1 + Math.floor(R() * 3);
      while (w > 1 && taken[r].slice(c, c + w).some((t, i) => t >= 0 || c + i >= cols)) w--;
      if (c + w > cols) w = cols - c;
      h = Math.min(h, rows - r);
      while (h > 1 && taken.slice(r, r + h).some((row) => row.slice(c, c + w).some((t) => t >= 0))) h--;
      const near = new Set<number>();
      for (let i = 0; i < w; i++) if (r > 0) near.add(taken[r - 1][c + i]);
      for (let j = 0; j < h; j++) if (c > 0) near.add(taken[r + j][c - 1]);
      let k = Math.floor(R() * GLASSES.length);
      for (let t = 0; t < GLASSES.length && near.has(k); t++) k = (k + 1) % GLASSES.length;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken[r + j][c + i] = k;
      const [px, py, pw, ph] = [x0 + c * cw + lead, gy0 + r * rh + lead, w * cw - lead * 2, h * rh - lead * 2];
      pane(gl, px, py, pw, ph, PASTEL[GLASSES[k]], R);
      cm.clearRect(px, py, pw, ph);
    }
  }
  g.globalAlpha = STAINED_OPACITY;
  g.drawImage(glass, 0, 0);
  g.globalAlpha = 1;
  g.drawImage(cames, 0, 0);
  // The pilasters: a half at each end, cut and veined as the band is, so two sections meet on one pier of marble.
  stone(kit, g, 0, y0, PILASTER / 2 + 4, y1 - y0, R, 'dress', 'unit', 0, 1.2);
  stone(kit, g, TW - PILASTER / 2 - 4, y0, PILASTER / 2 + 4, y1 - y0, R, 'dress', 'unit', 0, 1.2);
}

/** A garden wall of stained glass: a panel of leaded glass under the coping. */
function lowStained(kit: Kit, g: Ctx, R: Rand, fh: number): Block[] {
  glassField(kit, g, COPE, fh, R);
  return [];
}

/** A storey of a stained glass wall: the marble's band over a panel of leaded glass. */
function paintStained(kit: Kit, g: Ctx, R: Rand): Block[] {
  const { PASTEL } = kit;
  g.fillStyle = PASTEL.joint;
  g.fillRect(0, 0, TW, TH);
  marbleBand(kit, g, R);
  glassField(kit, g, BAND, TH, R);
  oversail(kit, g, 0, BAND, 12);
  return [];
}

/** Stained glass: leaded panes under the marble's band, in the marble's openings. Seen through, so nothing is laid under it. */
export const STAINED_LAY: Lay = {
  ...SLAB_LAY,
  courses: paintStained,
  lowCourses: (kit, g, R, fh) => lowStained(kit, g, R, fh),
  under: undefined,
};
