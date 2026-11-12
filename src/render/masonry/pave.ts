import { blob, cnv, ctxOf, hexA, rand, shape, solid } from './draw';
import type { Kit } from './kit';
import type { Ctx, Pt, Rand } from './types';

/**
 * The road: squared pictures of setts laid on the ground, in light and shade rather than colour.
 */

/**
 * Cobbles laid on the ground, which is not the same job as cobbles laid in a
 * wall and does not look like one.
 *
 * A sett is smaller than a building stone and squarer, because it is bedded
 * on sand and has to be walked and carted over; it is laid in courses with
 * every course shoved along, and the courses are struck off a string by a
 * man kneeling on the last one, so they wander. What was there before was a
 * grid of six by six rectangles tinted light and dark, which is a pattern on
 * a lozenge rather than a road.
 *
 * Painted in light and shade rather than in colour, and laid over the tile
 * with `overlay`. The ground already carries the hour's sun, the slope it
 * lies on and the cold wash over land you only remember: a road painted in
 * its own colours would have to be told all three a second time and would
 * still be wrong at dusk. Mid grey changes nothing, lighter lightens the
 * ground and darker darkens it, so a sett comes out as a shape cut in the
 * tile's own colour, whatever that colour is.
 */
const PAVE_TILE = 256;                 // px to a four-metre tile: sixty-four to the metre

export const PAVE_N = 3;                      // tiles to a side, so the run repeats every twelve metres

const PAVE_W = PAVE_TILE * PAVE_N;

/*
 * How big a sett is. Forty centimetres was true of a real road and wrong in
 * this picture: a tile is ninety-six pixels across on screen and squashed by
 * half again going the other way, so ten stones to a tile came out as crumbs
 * and the road read as grit. Sixty still did, laid beside slabs cut a metre
 * or more: seven stones to a tile each way at the zoom people play at is a
 * texture, not a road. Seventy-five, five to a tile, is a stone you can
 * pick out, and about the size the same stone is laid in indoors.
 */
const SETT = 48;

const SETT_INK = 1.8;                  // the outline, at this scale

/** Nothing, and the earth packed between the stones. */
export const NEUTRAL = '#808080';

const BED = '#7a7a7a';

/**
 * What a sett is made of. Five stones out of the same field the walls are
 * built from: the run of them, one darker, one bleached, one with moss in
 * its face and one with iron in it. The last two carry a hue, which in
 * `overlay` tints the ground under them rather than painting over it.
 */
const SETTS: Array<{ lit: string; shade: string; hi: string }> = [
    { lit: '#9c9c9c', shade: '#868686', hi: '#b6b6b6' },
    { lit: '#8a8a8a', shade: '#767676', hi: '#a0a0a0' },
    { lit: '#adadad', shade: '#959595', hi: '#c4c4c4' },
    { lit: '#8f978b', shade: '#7b8378', hi: '#a5ac9f' },
    { lit: '#9d9690', shade: '#87817b', hi: '#b5aea7' },
  ];

const SETT_LINE = '#5b5b5b';

/** The green in a joint, which is darker than nothing so it darkens as it tints. */
const WEED = { lit: '#7f9070', line: '#5f6f55' };

/** One sett: a squarish stone, bedded, with the light on its upper edge. */
function sett(g: Ctx, x: number, y: number, w: number, h: number, R: Rand, t: number): Pt[] {
  const cx = x + w / 2, cy = y + h / 2;
  // Squarer than a building stone and less alike from one to the next: a
  // sett is split off the block with a hammer, not picked up off a field.
  const pts = blob(cx, cy, w / 2, h / 2, 12, R, 0.21, 0.3, 0.1);
  const T = SETTS[t];
  solid(g, pts, T.lit, T.shade, SETT_LINE, SETT_INK, -w * 0.12, -h * 0.18);
  g.save(); shape(g, pts); g.clip();
  g.beginPath(); g.rect(x - 3, y - 3, w + 6, h * 0.5); g.clip();
  g.globalAlpha = 0.5;
  g.translate(1, 1.2); shape(g, pts); g.strokeStyle = T.hi; g.lineWidth = 1.2; g.lineJoin = 'round'; g.stroke();
  g.restore();
  return pts;
}

/** The crown of a stone a cart has been over: rubbed pale, and off centre. */
function polish(g: Ctx, pts: Pt[], x: number, y: number, w: number, h: number, R: Rand): void {
  g.save(); shape(g, pts); g.clip();
  g.beginPath();
  g.ellipse(x + w * (0.35 + R() * 0.3), y + h * (0.3 + R() * 0.25), w * (0.2 + R() * 0.14), h * (0.16 + R() * 0.12), (R() - 0.5) * 0.7, 0, 7);
  g.fillStyle = hexA('#ffffff', 0.09 + R() * 0.07);
  g.fill();
  g.restore();
}

/** And one that has gone down into its bed: a shadow round the high side of it. */
function sunk(g: Ctx, pts: Pt[], R: Rand): void {
  g.save();
  g.globalAlpha = 0.34 + R() * 0.16;
  shape(g, pts); g.strokeStyle = SETT_LINE; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

/** A corner off it, which is what a shod hoof does to a sett. */
function knock(g: Ctx, pts: Pt[], R: Rand): void {
  const k = Math.floor(R() * pts.length);
  const a = pts[k], b = pts[(k + 2) % pts.length];
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(a[0] + (b[0] - a[0]) * 0.4 + (R() - 0.5) * 3, a[1] + (b[1] - a[1]) * 0.4 + (R() - 0.5) * 3);
  g.closePath();
  g.fillStyle = hexA(BED, 0.8);
  g.fill();
  g.strokeStyle = SETT_LINE; g.lineWidth = 1; g.lineJoin = 'round'; g.stroke();
}

/** What has seeded in a joint: a few short blades, no mound under them. */
function joint(g: Ctx, x: number, y: number, r: number, R: Rand): void {
  const n = 3 + Math.floor(R() * 4);
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n - 0.5) * 2.1 + (R() - 0.5) * 0.4;
    const len = r * (0.7 + R() * 0.9);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.sin(a) * len * 0.4, y - Math.cos(a) * len * 0.7,
      x + Math.sin(a) * len * 1.2, y - Math.cos(a) * len);
    g.strokeStyle = i < n / 2 ? WEED.line : WEED.lit;
    g.lineWidth = 1.5 - 0.4 * (i / n);
    g.stroke();
  }
  g.restore();
}

/**
 * The whole sheet: three tiles by three, laid as one road and cut up after,
 * so nothing repeats inside twelve metres.
 *
 * Every stone is drawn again at each wrap it reaches, off its own seed, so
 * the sheet butts itself on all four sides and a tile butts its neighbour
 * whichever way round the camera has them.
 */
function paveSheet(): HTMLCanvasElement {
  const c = cnv(PAVE_W, PAVE_W), g = ctxOf(c);
  g.fillStyle = BED;
  g.fillRect(0, 0, PAVE_W, PAVE_W);
  const rows = Math.max(4, Math.round(PAVE_W / SETT));
  /*
   * How deep each course is. All of them at one depth was the tell: a road
   * of stones that vary in every way but one still reads as ruled, because
   * the eye finds the one thing that repeats. They are unequal and they sum
   * to the sheet, which is what lets the sheet still wrap.
   */
  const HR = rand(3313);
  const depths: number[] = []; let dsum = 0;
  for (let r = 0; r < rows; r++) { const v = 0.78 + HR() * 0.52; depths.push(v); dsum += v; }
  const junctions: Array<[number, number]> = [];
  const lay = (x: number, y: number, w: number, h: number, seed: number, t: number): void => {
    for (const dx of [-PAVE_W, 0, PAVE_W]) {
      if (x + dx + w < -4 || x + dx > PAVE_W + 4) continue;
      for (const dy of [-PAVE_W, 0, PAVE_W]) {
        if (y + dy + h < -4 || y + dy > PAVE_W + 4) continue;
        const R = rand(seed);
        const sx = x + dx, sy = y + dy;
        const pts = sett(g, sx, sy, w, h, R, t);
        const q = R();
        if (q < 0.14) knock(g, pts, R);
        if (R() < 0.17) polish(g, pts, sx, sy, w, h, R);
        if (R() < 0.15) sunk(g, pts, R);
      }
    }
  };
  let top = 0;
  for (let r = 0; r < rows; r++) {
    const rh = (depths[r] / dsum) * PAVE_W;
    const y0 = top;
    top += rh;
    const R = rand(4801 + r * 131);
    const n = Math.max(4, Math.round(PAVE_W / (rh * (0.9 + R() * 0.34))));
    const ws: number[] = []; let sum = 0;
    for (let k = 0; k < n; k++) { const w = 0.6 + R() * 1.25; ws.push(w); sum += w; }
    /*
     * Where this course was started and how far it wanders. A road is
     * struck off a string by a man kneeling on the course below it, so no
     * two courses start in the same place and none of them is straight.
     * The wander is a whole number of waves across the sheet, which is what
     * lets it wrap.
     */
    const start = R() * PAVE_W;
    const kw = 1 + Math.floor(R() * 2), amp = rh * (0.08 + R() * 0.13), ph = R() * Math.PI * 2;
    let x = start;
    for (let k = 0; k < n; k++) {
      const w = (ws[k] / sum) * PAVE_W;
      const dy = Math.sin(((x + w / 2) / PAVE_W) * Math.PI * 2 * kw + ph) * amp;
      // The joint, which is packed sand and not mortar: a sett road is laid
      // tight. At four pixels of dark between every pair the road came out
      // as pale chips in grey grout, which is a mosaic floor.
      const gap = 1.2 + R() * 1.1;
      const shrink = rh * 0.12 * R();
      const y = y0 + dy + shrink / 2;
      // Mostly the run of the field, a sixth darker and a sixth bleached, and
      // one in twenty with moss in it or iron: at one in five of each, the
      // road was a mosaic of green and pink rather than a grey road.
      const tone = R() < 0.14 ? 1 : R() < 0.2 ? 2 : R() < 0.075 ? 3 : R() < 0.065 ? 4 : 0;
      lay(x + gap / 2, y + gap / 2, w - gap, rh - gap - shrink, 7001 + r * 977 + k * 31, tone);
      if (R() < 0.13) junctions.push([x, y0 + rh + dy]);
      x += w;
    }
  }
  // What has seeded where three or four of them meet, which is where the
  // sand washes out and a seed can get down to the bed.
  const JR = rand(6151);
  for (const [jx, jy] of junctions) {
    const r = 3.5 + JR() * 4;
    for (const dx of [-PAVE_W, 0, PAVE_W]) {
      for (const dy of [-PAVE_W, 0, PAVE_W]) {
        if (jx + dx < -12 || jx + dx > PAVE_W + 12 || jy + dy < -12 || jy + dy > PAVE_W + 12) continue;
        joint(g, jx + dx, jy + dy, r, rand(Math.floor(jx * 7 + jy * 13) + 3));
      }
    }
  }
  /*
   * And the lie of the whole road. Ground laid on ground settles into it:
   * there are hollows where the carts run and crowns where they do not, and
   * without them a few hundred setts of equal brightness read as a printed
   * pattern however varied each one is. Soft pools rather than waves -- a
   * sine sampled on a grid came out as banding, which is a worse pattern
   * than the one it was put there to break. Each is drawn again at every
   * wrap it reaches, like the stones.
   */
  const LR = rand(2287);
  for (let i = 0; i < 9; i++) {
    const cx = LR() * PAVE_W, cy = LR() * PAVE_W;
    const r = PAVE_W * (0.1 + LR() * 0.16);
    const ink = LR() < 0.55 ? '0, 0, 0' : '255, 255, 255';
    const a = 0.05 + LR() * 0.05;
    for (const dx of [-PAVE_W, 0, PAVE_W]) {
      for (const dy of [-PAVE_W, 0, PAVE_W]) {
        if (cx + dx + r < 0 || cx + dx - r > PAVE_W || cy + dy + r < 0 || cy + dy - r > PAVE_W) continue;
        const grad = g.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, r);
        grad.addColorStop(0, `rgba(${ink}, ${a.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${ink}, 0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx + dx, cy + dy, r, 0, 7);
        g.fill();
      }
    }
  }
  return c;
}

/** Painted once, the first time a road comes into view, and cut into its tiles. */
export function pave(kit: Kit): HTMLCanvasElement[] {
  if (kit.paveTiles) return kit.paveTiles;
  const sheet = paveSheet();
  const out: HTMLCanvasElement[] = [];
  for (let j = 0; j < PAVE_N; j++) {
    for (let i = 0; i < PAVE_N; i++) {
      const c = cnv(PAVE_TILE, PAVE_TILE), g = ctxOf(c);
      g.drawImage(sheet, -i * PAVE_TILE, -j * PAVE_TILE);
      out.push(c);
    }
  }
  kit.paveTiles = out;
  return out;
}
