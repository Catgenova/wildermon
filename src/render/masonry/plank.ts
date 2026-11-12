import { PROUD } from './coping';
import { TH, TW, channels, cnv, ctxOf, hexA, hexOf, lighten, poly, rand } from './draw';
import { COATS, LOW_FOOT, PROUD_INK, dressUnder, footing, member, proud } from './frame';
import type { Kit } from './kit';
import { LOG_LAY } from './log';
import type { Block, Ctx, Lay, Low, Masonry, Pt, Rand } from './types';

/**
 * Plank: boards on end with a batten over every joint, in a trim of darker boards.
 */

/**
 * How many boards to a section, how wide the batten over the joint between
 * two is, and how deep the band along the head of a storey and the skirt
 * along the foot of the ground one.
 */
const BOARDS = 8, BOARD_W = TW / BOARDS, BATTEN = 14, HEAD_BAND = 26, SKIRT = 22;

/**
 * The boards of a wall between `y0` and `y1`: each a pale pine a step off
 * the next in value and in warmth, so none is the one beside it, its
 * grain two or three strokes down it and here and there a knot; the odd
 * one fresher, where a board was put in new. The joints fall on the
 * section's seams and every eighth of the way between, under the battens.
 */
function boards(kit: Kit, g: Ctx, R: Rand, y0: number, y1: number): void {
  const { PASTEL } = kit;
  let last = -1;
  for (let i = 0; i < BOARDS; i++) {
    const x0 = i * BOARD_W;
    let c = Math.floor(R() * COATS.length);
    if (c === last) c = (c + 1 + Math.floor(R() * (COATS.length - 1))) % COATS.length;
    last = c;
    const [dl, warm] = COATS[c];
    const fresh = R() < 0.1;
    const [r, gg, b] = channels(lighten(PASTEL.stone, dl * 1.4 + (fresh ? 5 : 0)));
    const tone = hexOf([r + warm * 1.4, gg, b - warm * 1.4]);
    g.fillStyle = tone; g.fillRect(x0, y0, BOARD_W, y1 - y0);
    g.strokeStyle = hexA(lighten(tone, -9), 0.8); g.lineWidth = 1.4; g.lineCap = 'round';
    for (let k = 0, n = 2 + (R() < 0.5 ? 1 : 0); k < n; k++) {
      const x = x0 + BATTEN / 2 + 4 + R() * (BOARD_W - BATTEN - 8);
      let y = y0 + R() * 30;
      while (y < y1) {
        const e = Math.min(y1, y + 50 + R() * 110);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, e); g.stroke();
        y = e + 12 + R() * 40;
      }
    }
    g.lineCap = 'butt';
    if (R() < 0.35) {
      const kx = x0 + BATTEN / 2 + 8 + R() * (BOARD_W - BATTEN - 16), ky = y0 + 30 + R() * (y1 - y0 - 60);
      g.beginPath(); g.ellipse(kx, ky, 3 + R() * 2, 4.5 + R() * 2.5, 0, 0, Math.PI * 2); g.fillStyle = lighten(tone, -15); g.fill();
      g.beginPath(); g.ellipse(kx, ky, 5, 7, 0, Math.PI * 1.1, Math.PI * 1.7); g.strokeStyle = hexA(lighten(tone, 10), 0.9); g.lineWidth = 1.4; g.stroke();
    }
  }
}

/**
 * The battens over the joints, from `y0` to `y1`: a sawn strip standing
 * proud of the boards, lit down its left edge and dark down its right, with
 * its shade on the board beside it. The two on a section's seams are one
 * batten, half in each section, laid from one seed.
 */
function battens(kit: Kit, g: Ctx, R: Rand, y0: number, y1: number): void {
  const { PASTEL } = kit;
  const one = (cx: number, RR: Rand): void => {
    const x0 = cx - BATTEN / 2, x1 = cx + BATTEN / 2, j = (): number => (RR() - 0.5) * 1.4;
    const pts: Pt[] = [[x0 + j(), y0], [x1 + j(), y0], [x1 + j(), y1], [x0 + j(), y1]];
    g.fillStyle = PROUD_INK; g.fillRect(x1 - 1, y0, 9, y1 - y0);
    g.save();
    g.beginPath(); poly(g, pts); g.fillStyle = PASTEL.batten; g.fill(); g.clip();
    g.fillStyle = hexA(PASTEL.battenHi, 0.95); g.fillRect(x0 - 1, y0, 5, y1 - y0);
    g.fillStyle = PASTEL.battenShade; g.fillRect(x1 - 4, y0, 5, y1 - y0);
    g.restore();
    g.beginPath(); poly(g, pts); g.strokeStyle = hexA(PASTEL.line, 0.75); g.lineWidth = 1.5; g.stroke();
  };
  one(0, rand(2503)); one(TW, rand(2503));
  for (let i = 1; i < BOARDS; i++) one(i * BOARD_W, R);
}

/**
 * The field of a plank wall: the boards, the battens over their joints, and
 * the band along the head of the storey, which the storey over it stands
 * on, so a floor is one board across the wall. The ground storey's skirt,
 * on the footing, is the foot's.
 */
function paintPlanks(kit: Kit, g: Ctx, R: Rand): Block[] {
  boards(kit, g, R, 0, TH);
  battens(kit, g, R, HEAD_BAND - 2, TH + 2);
  proud(g, -6, 0, TW + 6, HEAD_BAND);
  member(kit, g, -6, 0, TW + 6, HEAD_BAND, rand(2521), true);
  return [];
}

/** The ground storey's foot: the footing, and the skirt board along it that the boards stand on. */
function plankFootingOf(kit: Kit, g: Ctx, R: Rand): void {
  const { S } = kit;
  const y0 = TH - S.plinth;
  footing(kit, g, R, y0, TH);
  member(kit, g, -6, y0 - SKIRT, TW + 6, y0, rand(2531), true);
}

/**
 * The board a plank wall is finished with at a corner or a stopped end,
 * over the face carried round it and the half of the seam's batten the
 * section has of its own: sawn trim, its outer edge off the picture so the
 * two faces of a corner meet on it.
 */
function plankCorner(kit: Kit, h: number): HTMLCanvasElement {
  const w = 64, c = cnv(w, h), g = ctxOf(c);
  member(kit, g, -8, 0, w - 1, h, rand(2539), false, false);
  return c;
}

/**
 * A garden wall of it, or a fence: boards and battens at the height it
 * stands to, a cap board along its head and a bottom rail on a course of
 * the footing.
 */
function lowPlanks(kit: Kit, g: Ctx, R: Rand, fh: number): Block[] {
  const sole = fh - LOW_FOOT, cap = 20;
  boards(kit, g, R, 0, sole);
  battens(kit, g, R, cap - 2, sole - SKIRT + 2);
  proud(g, -6, 0, TW + 6, cap);
  member(kit, g, -6, 0, TW + 6, cap, rand(2543), true);
  member(kit, g, -6, sole - SKIRT, TW + 6, sole, rand(2531), true);
  footing(kit, g, R, sole, fh);
  return [];
}

/** The end of a plank wall is the side of its corner board, the band over it. */
function plankEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  member(kit, g, -2, 0, Wc + 2, TH, R, false, false);
  member(kit, g, -2, 0, Wc + 2, HEAD_BAND, R);
}

/** A plank wall's ground storey at its end: the corner board, the skirt and the footing. */
function plankEndsFoot(kit: Kit, g: Ctx, R: Rand, Wc: number, y0: number, ends: HTMLCanvasElement): void {
  g.drawImage(ends, 0, 0);
  member(kit, g, -2, y0 - SKIRT, Wc + 2, y0, R);
  footing(kit, g, R, y0, TH);
}

/** The end of a low plank wall: the side of its corner board, the cap and the bottom rail, on the footing. */
function plankLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number): void {
  const sole = fh - LOW_FOOT;
  member(kit, g, -2, 0, Wc + 2, sole, R, false, false);
  member(kit, g, -2, 0, Wc + 2, 20, R);
  member(kit, g, -2, sole - SKIRT, Wc + 2, sole, R);
  footing(kit, g, R, sole, fh);
}

/**
 * A squared post either side of the way through a low plank wall, the boards
 * run into it and the cap and the rail run on over it, cut to the wall.
 */
function plankGate(kit: Kit, g: Ctx, R: Rand, fh: number, gx0: number, gx1: number): void {
  const sole = fh - LOW_FOOT;
  g.save();
  g.beginPath(); g.rect(0, -PROUD, gx0, fh + PROUD); g.rect(gx1, -PROUD, TW - gx1, fh + PROUD); g.clip();
  for (const [a, b] of [[gx0 - 38, gx0], [gx1, gx1 + 38]]) { proud(g, a, 0, b, sole); member(kit, g, a, 0, b, sole, R); }
  member(kit, g, -6, 0, TW + 6, 20, rand(2543), true);
  member(kit, g, -6, sole - SKIRT, TW + 6, sole, rand(2531), true);
  g.restore();
}

function plankPost(kit: Kit): NonNullable<Masonry['post']> {
  return { img: plankCorner(kit, TH), reach: BATTEN / 2, free: true };
}

function plankLowPost(kit: Kit, fh: number): NonNullable<Low['post']> {
  return { img: plankCorner(kit, fh - LOW_FOOT), foot: LOW_FOOT };
}

/** Plank: boards on end with a batten over every joint, in a trim of darker boards. */
export const PLANK_LAY: Lay = {
  ...LOG_LAY,
  courses: (kit, g, R) => paintPlanks(kit, g, R),
  foot: plankFootingOf,
  ends: plankEnds,
  endsFoot: plankEndsFoot,
  lowCourses: (kit, g, R, fh) => lowPlanks(kit, g, R, fh),
  lowEnds: plankLowEnds,
  gateAfter: plankGate,
  lowPost: plankLowPost,
  post: plankPost,
  under: dressUnder,
  head: HEAD_BAND,
};
