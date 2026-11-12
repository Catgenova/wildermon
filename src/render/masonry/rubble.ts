import { COPE, LEVEL, LEVEL_SEAM, LOW_STRADDLE, LOW_TONE } from './coping';
import { BAND, CH, COURSES, EDGE, STRADDLE, STRADDLE_TONE, TH, TW, hexA, rand } from './draw';
import type { Kit } from './kit';
import { LAID_LAY, fieldTone } from './laid';
import { pickTone, slabs, stone, weather } from './stone';
import type { Block, Ctx, Lay, Pt, Rand } from './types';

/**
 * Cobblestone: field stone laid by eye in four courses, on a levelling course under a dry cope.
 */

/** The band and the courses, the same contract in every variant, then `extras` marks each on a stone
 *  of its own. Returns the stones that are this variant's to mark, with the course each is on. */
function rubbleCourses(kit: Kit, g: Ctx, R: Rand, crests: Pt[]): Block[] {
  const { PASTEL, MORTAR } = kit;
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, TW, TH);
  slabs(kit, g, 0, BAND, R);
  const own: Block[] = [];   // not the seam stones, not near the seam
  for (let i = 0; i < COURSES; i++) {
    const y = BAND + i * CH + MORTAR / 2, h = CH - MORTAR;
    let lo: number, hi: number;
    const st = STRADDLE[i];
    if (st) {
      // the seam stone: same shape, same tone, same place, in every variant
      const w = st[1] - st[0] - MORTAR;
      stone(kit, g, TW + st[0] + MORTAR / 2, y, w, h, rand(777 + i), STRADDLE_TONE[i]);
      stone(kit, g, st[0] + MORTAR / 2, y, w, h, rand(777 + i), STRADDLE_TONE[i]);
      lo = st[1]; hi = TW + st[0];               // so the joints either side of it are as wide as any other
    } else { lo = 0; hi = TW; }                  // and the seam falls in the middle of a joint of the usual width
    const L = hi - lo, n = Math.max(2, Math.round(L / (CH * 1.5)) + (R() < 0.35 ? 1 : 0));
    const ws: number[] = []; let sum = 0;
    for (let k = 0; k < n; k++) { const w = 0.5 + 1.2 * R(); ws.push(w); sum += w; }
    let x = lo; const run = { tone: '', left: 0 };
    // a novice's courses wander: each has a slow wave of its own, dying out at the section's edges
    const kw = 1 + Math.floor(R() * 2), aw = CH * 0.06 * (R() < 0.5 ? -1 : 1);
    for (let k = 0; k < n; k++) {
      // no two blocks sit quite alike: each drifts up or down, is shorter by a little, has a joint of
      // its own width, and one in five on the lower courses reaches up into the joint above; a third
      // tilt a degree or two
      const w = (ws[k] / sum) * L, mid = x + w / 2;
      const priv = x + MORTAR / 2 > EDGE && x + w - MORTAR / 2 < TW - EDGE;
      const wave = priv ? Math.sin(Math.PI * kw * (mid - EDGE) / (TW - 2 * EDGE)) * aw : 0;
      const drift = (R() - 0.5) * CH * 0.14 + wave, shrink = h * 0.14 * R(), jw = MORTAR + (priv ? R() * 3 : 0);
      const reach = i > 0 && R() < 0.2 ? CH * 0.05 : 0;
      const under = (crests || []).some(([a, b]) => mid > a && mid < b);
      const tone = pickTone(kit, R, i, run, under);
      let sy = y + drift + shrink / 2 - reach, sh = h - shrink + reach;
      // the top course keeps under the band and the lowest above the storey line, whatever it does
      if (i === 0) { const top = BAND + MORTAR / 2; if (sy < top) { sh -= top - sy; sy = top; } }
      if (i === COURSES - 1) { const bot = TH - MORTAR / 2; if (sy + sh > bot) sh = bot - sy; }
      const tilt = priv && R() < 0.4 ? (R() - 0.5) * 0.08 : 0;
      if (priv && sh > 30 && R() < 0.08) {
        // a slot a novice had to pack: two thin stones one over the other
        const hh = (sh - MORTAR) / 2;
        for (const [yy, tn] of [[sy, tone], [sy + hh + MORTAR, pickTone(kit, R, i, run, under)]] as Array<[number, string]>) {
          const s: Block = { x: x + jw / 2, y: yy, w: w - jw, h: hh, course: i, pts: [] };
          s.pts = stone(kit, g, s.x, s.y, s.w, s.h, R, tn, 'laid', 0);
          if (s.w > 40) own.push(s);
        }
      } else {
        const s: Block = { x: x + jw / 2, y: sy, w: w - jw, h: sh, course: i, pts: [] };
        s.pts = stone(kit, g, s.x, s.y, s.w, s.h, R, tone, 'laid', tilt);
        if (s.x > EDGE && s.x + s.w < TW - EDGE && s.w > 40) own.push(s);
      }
      x += w;
    }
  }
  weather(kit, g, own, R);
  g.fillStyle = 'rgba(110,100,80,0.16)'; g.fillRect(0, BAND, TW, 9);
  // a handful of dark flecks, the grain of the stone
  g.fillStyle = hexA(PASTEL.line, 0.5);
  for (let k = 0; k < 8; k++) { const s = own[Math.floor(R() * own.length)]; if (!s) break; g.beginPath(); g.arc(s.x + (R() < 0.5 ? 3 : s.w - 3), s.y + (R() < 0.5 ? 3 : s.h - 3), 1 + R(), 0, 7); g.fill(); }
  return own;
}

/**
 * The levelling course: a run of thin flat stones under the coping.
 *
 * It is the thing that makes a wall level enough to cope, and it is also
 * what stops the eye reading the cope as tiles laid on blocks -- two
 * scales with nothing between them is a join, three is a wall.
 *
 * Drawn thinner than anything else in the picture. A stone nine pixels deep
 * with the body's outline on it is nearly half outline, so a course of them
 * came out as a zipper: the course is meant to be the quietest thing on the
 * wall, a line of packing you notice only because the cope sits on it.
 */
/**
 * The levelling course under a dry cope. A length of cut cope is bedded
 * straight on the top course of brick; the packing under a dry cope is how a
 * field wall makes a level bed out of what it has. Brick is already level,
 * so the bond runs up to the cope and has none.
 */
function rubbleLevelling(kit: Kit, g: Ctx, R: Rand): void {
  const J = 2, ink = 0.8, room = LEVEL - J;
  /**
   * One of them. Its depth is what the stone happened to be and it sits
   * where it sits in the bed -- because nine stones all 5.5 px deep with
   * their tops on one line and their bottoms on another is a strip of
   * pills, which is what the first attempt at fixing this produced: the
   * outline came down but every stone was still the same stone.
   */
  const pack = (x: number, w: number, RR: Rand, tone: string): void => {
    const sh = room * (0.52 + 0.48 * RR());
    const sy = COPE + J / 2 + (room - sh) * RR();
    stone(kit, g, x + J / 2, sy, w - J, sh, RR, tone, 'laid', (RR() - 0.5) * 0.12, ink);
  };
  const w0 = LEVEL_SEAM[1] - LEVEL_SEAM[0];
  for (const x of [LEVEL_SEAM[0], TW + LEVEL_SEAM[0]]) pack(x, w0, rand(229), '');
  // Twenty-five centimetres of rubble, not forty-five of lozenge.
  const lo = LEVEL_SEAM[1], hi = TW + LEVEL_SEAM[0], L = hi - lo;
  const n = Math.max(2, Math.round(L / 32));
  const ws: number[] = []; let sum = 0;
  for (let k = 0; k < n; k++) { const w = 0.5 + 1.1 * R(); ws.push(w); sum += w; }
  let x = lo;
  for (let k = 0; k < n; k++) {
    const w = (ws[k] / sum) * L;
    // Weathered and dark for the most part. A bed of packing lies in the
    // shade of the cope that oversails it, and rolling two in five of them
    // bleached turned the quietest course on the wall into a pale stripe.
    pack(x, w, R, R() < 0.2 ? 'weather' : R() < 0.34 ? 'dark' : R() < 0.54 ? 'brown' : '');
    x += w;
  }
}

/**
 * The body under them: stones the size the tall wall's are.
 *
 * They were half that, and eight or ten to a course, which read as
 * brickwork -- the one thing a field wall is not. Two courses of five or
 * six, at eighty pixels by fifty, is the same masonry as the house.
 */
function rubbleLow(kit: Kit, g: Ctx, R: Rand, fh: number, rows: number): Block[] {
  const { MORTAR } = kit;
  const top = COPE + LEVEL;
  /*
   * Courses of unequal depth, the deepest at the bottom.
   *
   * Two bands of the same height read as two rows of bricks whatever is in
   * them. They are unequal for the reason they are unequal in any wall
   * built off the ground: the biggest stones go in first because that is
   * where they are easiest to put, and what is left goes on top of them.
   */
  const wts: number[] = [];
  for (let i = 0; i < rows; i++) wts.push(1 + i * 0.32);
  const tot = wts.reduce((a, b) => a + b, 0);
  const own: Block[] = [];
  let y0 = top;
  for (let i = 0; i < rows; i++) {
    const ch = ((fh - top) * wts[i]) / tot;
    const y = y0 + MORTAR / 2, h = ch - MORTAR;
    y0 += ch;
    let lo: number, hi: number;
    const st = LOW_STRADDLE[i];
    if (st) {
      const w = st[1] - st[0] - MORTAR;
      stone(kit, g, TW + st[0] + MORTAR / 2, y, w, h, rand(553 + i), LOW_TONE[i]);
      stone(kit, g, st[0] + MORTAR / 2, y, w, h, rand(553 + i), LOW_TONE[i]);
      lo = st[1]; hi = TW + st[0];
    } else { lo = 0; hi = TW; }
    const L = hi - lo, n = Math.max(2, Math.round(L / (ch * 1.5)) + (R() < 0.35 ? 1 : 0));
    /*
     * One through-stone to the bottom two courses.
     *
     * A dry wall is built as two skins with the small stuff packed between
     * them, and what stops it from being two thin walls leaning on each
     * other is a stone every yard or so long enough to reach from face to
     * face. It shows: it is half again the length of its neighbours and it
     * is darker, because it came out of the ground rather than off the top
     * of the heap. It is in the same place in every variant, because on a
     * real wall you can sight along them.
     */
    const thru = i >= rows - 2 ? Math.floor(rand(97 + i * 13)() * n) : -1;
    const ws: number[] = []; let sum = 0;
    for (let k = 0; k < n; k++) { const w = k === thru ? 2.4 : 0.5 + 1.2 * R(); ws.push(w); sum += w; }
    let x = lo; const run = { tone: '', left: 0 };
    const kw = 1 + Math.floor(R() * 2), aw = ch * 0.06 * (R() < 0.5 ? -1 : 1);
    for (let k = 0; k < n; k++) {
      const w = (ws[k] / sum) * L, mid = x + w / 2;
      const priv = x + MORTAR / 2 > EDGE && x + w - MORTAR / 2 < TW - EDGE;
      const wave = priv ? Math.sin(Math.PI * kw * (mid - EDGE) / (TW - 2 * EDGE)) * aw : 0;
      const drift = (R() - 0.5) * ch * 0.13 + wave, shrink = h * 0.14 * R(), jw = MORTAR + (priv ? R() * 3 : 0);
      // A field wall is built of whatever the field gave up, so it carries
      // more colour than a house wall the mason picked stone for.
      const tone = k === thru ? 'weather' : R() < 0.3 ? fieldTone(kit, R) : pickTone(kit, R, i + COURSES - rows, run, false);
      let sy = y + drift + shrink / 2, sh = h - shrink;
      if (i === 0) { const t0 = top + MORTAR / 2; if (sy < t0) { sh -= t0 - sy; sy = t0; } }
      /*
       * The bottom course runs past the picture and the canvas edge cuts
       * it, the way the hedge at its foot already does. Clipping every
       * stone flush to `fh` put 87% of the base on one ruled line, and a
       * wall a metre and a quarter high is mostly its ground line.
       */
      if (i === rows - 1) sh += 3 + R() * 5;
      // The slot he had to pack: two thin stones one over the other, which
      // is the most dry-stone thing a wall does and the tall one already did.
      if (priv && sh > 34 && R() < 0.16) {
        const hh = (sh - MORTAR) / 2;
        for (const [yy, tn] of [[sy, tone], [sy + hh + MORTAR, pickTone(kit, R, i, run, false)]] as Array<[number, string]>) {
          const b: Block = { x: x + jw / 2, y: yy, w: w - jw, h: hh, course: i, pts: [] };
          b.pts = stone(kit, g, b.x, b.y, b.w, b.h, R, tn, 'laid', 0);
          if (b.w > 40) own.push(b);
        }
      } else {
        const b: Block = { x: x + jw / 2, y: sy, w: w - jw, h: sh, course: i, pts: [] };
        b.pts = stone(kit, g, b.x, b.y, b.w, b.h, R, tone, 'laid', priv && R() < 0.4 ? (R() - 0.5) * 0.08 : 0);
        if (priv && b.w > 40) own.push(b);
      }
      x += w;
    }
  }
  return own;
}

/** Cobblestone: field stone laid by eye, on a levelling course under a dry cope. */
export const RUBBLE_LAY: Lay = {
  ...LAID_LAY,
  courses: rubbleCourses,
  levelling: rubbleLevelling,
  lowCourses: rubbleLow,
};
