import { WALL_THICK } from '../../game/building';
import { COPE, COPE_INK, COPE_MEAN, COPE_MIN, COPE_RISE, LEVEL, PROUD, copeSeed } from './coping';
import { BAND, CAP_H, CH, COURSES, EDGE, TH, TW, bbox, cnv, ctxOf, hexA, poly, rand, roughen, shape, solid } from './draw';
import { MOSS, mossLens } from './growth';
import type { Kit } from './kit';
import { A_CX, A_CY, A_R, CORBEL_H, IMPOST_H, LINTEL, OVER, lintelTop } from './openings';
import { abrade, chipCorner, crack, pits, slabs, slop, spall, stone } from './stone';
import type { Ctx, Lay, Pt, Rand, Variant } from './types';

/**
 * What every wall of laid stone or brick shares, whatever its field: the openings cut in it, its
 * plinth, the cap and the end of a storey, and a garden wall's coping, piers and ends.
 */

/**
 * The plinth: the cut stone a brick wall is stood on at the ground.
 *
 * It is the one thing a wall of one material cannot have, and it is where
 * the weight of the picture is -- twelve courses of brick sitting on
 * nothing read as wallpaper hung to the grass. Two courses of big blocks
 * and a chamfered course over them, which is the course that throws the
 * rain off the brick above and out past the face; without it a plinth is
 * just the bottom of the wall painted a different colour.
 *
 * It goes on with the damp, which means it is only ever seen out of doors
 * and stops at a doorway, and both of those are where a plinth stops.
 */
function plinthOf(kit: Kit, g: Ctx, R: Rand): void {
  const { S, PASTEL, MORTAR } = kit;
  const h = S.plinth, cap = 21, y0 = TH - h;
  g.fillStyle = PASTEL.ringJoint;
  g.fillRect(0, y0, TW, h);
  /** One course of it, `lap` of a block over so the joints stagger at the seam. */
  const course = (y: number, bh: number, bn: number, lap: number, seed: number, ink: number): void => {
    const bw = TW / bn;
    for (let k = lap ? -1 : 0; k < bn; k++) {
      const x = (k + lap) * bw;
      const seam = x < 0 || x + bw > TW;
      const RR = seam ? rand(seed) : R;
      // No two out of the same bed: a plinth is four stones to the section
      // and four of one tone is a painted skirting rather than masonry.
      const t = RR();
      stone(kit, g, x + MORTAR / 2, y, bw - MORTAR, bh, RR, t < 0.38 ? S.base[0] : S.base[1], 'unit', 0, ink);
    }
  };
  /*
   * One course, not two. Two courses of the band's own depth read as the
   * band again, at the bottom of the wall instead of the top; a plinth is a
   * bigger stone than anything above it, and one metre by two thirds is the
   * size it has to be before the brick reads as standing on something.
   */
  course(y0 + cap + MORTAR / 2, h - cap - MORTAR, 4, 0, 331, 2.2);
  course(y0 + MORTAR / 2, cap - MORTAR, 5, 0.5, 457, 1.7);
  /*
   * And the chamfer read as a slope rather than as a stripe: it is a face
   * turned up at the sky, so it goes from near its own lit tone at the top
   * to the shade at the bottom, over the stones rather than instead of
   * them. The brick above it stands back, and the line of shade under that
   * setback is the whole of what says the plinth stands proud.
   */
  const sl = g.createLinearGradient(0, y0, 0, y0 + cap);
  sl.addColorStop(0, hexA(PASTEL.dressHi, 0.78));
  sl.addColorStop(0.55, hexA(PASTEL.dressHi, 0.24));
  sl.addColorStop(1, 'rgba(44, 36, 42, 0.3)');
  g.fillStyle = sl;
  g.fillRect(0, y0, TW, cap);
  g.fillStyle = 'rgba(42, 34, 40, 0.42)';
  g.fillRect(0, y0 - 5, TW, 5);
  /*
   * And the damp up the foot of it. A plinth is the part of a wall the rain
   * lands on twice -- once falling and once off the ground -- and it is the
   * one place on a building where that is worth drawing, because it is the
   * line where the wall stops and the grass starts.
   */
  const wet = g.createLinearGradient(0, TH, 0, TH - h * 0.55);
  wet.addColorStop(0, 'rgba(40, 34, 40, 0.34)');
  wet.addColorStop(1, 'rgba(40, 34, 40, 0)');
  g.fillStyle = wet;
  g.fillRect(0, TH - h * 0.55, TW, h * 0.55);
  /*
   * And moss on the chamfer, which is the one ledge of the wall the rain
   * sits on before it runs off: a lens or two along it, and a fleck in the
   * joints of the course under it, so the wall grows out of the grass
   * rather than being stood on it. On a masonry that carries the island's
   * planting; the rest stand bare.
   */
  if (!S.growth) return;
  const n = 1 + (R() < 0.55 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const w = 90 + R() * 110;
    mossLens(g, { x: EDGE + R() * (TW - 2 * EDGE - w), y: y0, w, h: cap, course: 0, pts: [] }, y0 + 3, R);
  }
  for (let i = 0; i < 4; i++) {
    const x = EDGE + 8 + R() * (TW - 2 * EDGE - 16);
    g.beginPath(); g.arc(x, y0 + cap + 1 + R() * 2, 1.4 + R() * 1.2, 0, 7);
    g.fillStyle = hexA(MOSS.fleck, 0.75); g.fill();
  }
}

/** One stone of the ring or a jamb: the same two tones, line and bevel every block has. */
export function dressed(kit: Kit, g: Ctx, pts: Pt[], tone: string, dx = -3.5, dy = -4.5, ink = 2.4): void {
  const { TONES, PASTEL } = kit;
  const T = TONES[tone] || TONES[''];
  solid(g, pts, T.lit, T.shade, PASTEL.line, ink, dx, dy);
  g.save(); shape(g, pts); g.clip();
  g.globalAlpha = 0.45; g.translate(1.5, 2);
  shape(g, pts); g.strokeStyle = T.hi; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

/** What a hammer and the weather have had off one stone of an arch. Never `missing`: a ring is
 *  only standing while every wedge in it is. */
function wearOne(kit: Kit, g: Ctx, pts: Pt[], R: Rand): void {
  const s = bbox(pts);
  const t = R();
  if (t < 0.20) chipCorner(kit, g, s, R);
  else if (t < 0.34) crack(kit, g, s, R);
  else if (t < 0.40) spall(kit, g, s, R);
  if (R() < 0.28) abrade(kit, g, s, R);
  if (R() < 0.24) pits(kit, g, s, R);
  if (R() < 0.18) slop(kit, g, s, R);
}

/**
 * The reveal: a column of stone up each side of the opening, from the
 * springing down to the ground.
 *
 * These are the stones a novice takes trouble over, because they are the
 * ones a cart scrapes and a hand rests on, so they run squarer and a shade
 * warmer than the field they sit in. Their inner edge overhangs into the
 * opening and is taken off by the cut, which is what leaves the jamb dead
 * straight while every other edge of every one of them wanders.
 */
function jamb(kit: Kit, g: Ctx, R: Rand, side: number): void {
  const { MORTAR } = kit;
  const line = A_CX + side * A_R;
  let y = A_CY + IMPOST_H, course = side < 0 ? 0 : 1;
  while (y < TH + 20) {
    const h = 36 + R() * 22;
    // Long and short about, so the outer end of the stack is toothed into
    // the field. Even widths give a dead straight joint the length of the
    // reveal, which reads as the seam between two wall tiles.
    const w = (course++ % 2 ? 46 : 74) + R() * 16;
    const x = side < 0 ? line + OVER - w : line - OVER;
    const pts = stone(kit, g, x, y, w, h, R, pickDressed(kit, R), 'laid', (R() - 0.5) * 0.035);
    wearOne(kit, g, pts, R);
    y += h + MORTAR + R() * 3;
  }
}

/**
 * The impost: the one flat stone at the springing that the ring comes down
 * on and the jamb carries.
 *
 * Without it the lowest wedge sits straight on whatever course of the jamb
 * happened to end there, and the ring and the reveal run into each other in
 * a muddle. It is the one piece of an arch that even a bad mason gets
 * right, because it is the piece that tells him where to start the curve.
 * It reaches a little further out than the ring does, the way a ledge does.
 */
function impost(kit: Kit, g: Ctx, R: Rand, side: number): void {
  const line = A_CX + side * A_R;
  // Past where the deepest wedge can reach, so it is a ledge and not the
  // last course of the jamb: this is the stone that says where the curve
  // begins, and a mason who can lay nothing else lays this one square.
  const deep = A_R * 0.48;
  const x = side < 0 ? line - deep : line - OVER;
  const pts = stone(kit, g, x, A_CY - 3, deep + OVER, IMPOST_H + 3, R, 'dress', 'laid', (R() - 0.5) * 0.015);
  wearOne(kit, g, pts, R);
}

/**
 * The stone of the opening, jamb, impost and ring alike.
 *
 * All of it is stone that was picked over rather than picked up, so it runs
 * warmer than the field it is set in and the eye reads the whole doorway as
 * one piece of work instead of as a hole with a fringe.
 */
function pickDressed(kit: Kit, R: Rand): string {
  const { S } = kit;
  const t = R();
  // On a bond both of the odd ones are the cut stone's own, so the only
  // question a voussoir asks is which of the dressings' tones it takes.
  return S.lay === 'bond' ? (t < 0.3 ? 'plinth' : 'dress') : t < 0.18 ? 'green' : t < 0.28 ? 'dark' : 'dress';
}

/** An archway in laid stone: a jamb and an impost each side, and the ring over them. */
function stoneArch(kit: Kit, g: Ctx, R: Rand): void {
  jamb(kit, g, R, -1);
  jamb(kit, g, R, 1);
  impost(kit, g, R, -1);
  impost(kit, g, R, 1);
  voussoirs(kit, g, R);
}

/** The ring: wedges of no two depths, on joints that are not quite radial. */
function voussoirs(kit: Kit, g: Ctx, R: Rand): void {
  const { PASTEL } = kit;
  // Odd, so one stone caps the crown rather than a joint splitting it.
  const n = 9 + 2 * Math.floor(R() * 2);
  const cut: number[] = [];
  /*
   * A joint wanders by up to a quarter of a wedge either way, and no
   * further. Loose enough that no two wedges are the same width; tight
   * enough that none of them comes out a splinter, and that two joints
   * never cross -- a ring with a crossed joint is not a rough ring, it is a
   * ring that has fallen down.
   */
  for (let i = 0; i <= n; i++) cut.push(i / n + (i > 0 && i < n ? (R() - 0.5) * 0.36 / n : 0));
  const crown = (n - 1) / 2;
  /*
   * And the crown stone is the big one.
   *
   * It was the last wedge in, jammed against a ring that was already
   * standing, so it is the one he chose a lump for: half again the width of
   * its neighbours and reaching a good deal further out. It is also the
   * stone the eye goes to on an arch, and when the widest stone in the ring
   * was over at two o'clock the ring had no top.
   */
  cut[crown] -= 0.35 / n;
  cut[crown + 1] += 0.35 / n;
  /*
   * How far past the curve each joint reaches, and how far off true it
   * leans. The depth is held under half the radius because the crown of the
   * ring has to stay below the band: the extrados there is the springing
   * less the radius and its depth, and the band starts an eighth of the way
   * down the section.
   */
  const out = cut.map(() => 0.25 + R() * 0.11);
  const lean = cut.map(() => (R() - 0.5) * 0.10);
  /** A point on the ring: `c` along the half circle, `r` out from the curve. */
  const pt = (c: number, ln: number, r: number): Pt => {
    const a = Math.PI * (1 + c) + ln * r;
    return [A_CX + Math.cos(a) * A_R * (1 + r), A_CY + Math.sin(a) * A_R * (1 + r)];
  };
  const at = (j: number, r: number): Pt => pt(cut[j], lean[j], r);
  /*
   * The joint between one wedge and the next: shut at the face and open at
   * the back, which is what a joint cut by eye does. Taking it off the outer
   * corners only leaves the intrados solid stone the whole way round -- a
   * gap there shows as mortar on the line the compass struck, and a ring of
   * crescents round the opening is worse than no ring.
   */
  const GAP = 0.005;
  /*
   * First the pocket: the mortar behind the ring.
   *
   * The field was laid before anybody thought about a doorway, and the way
   * through was made by breaking stone out of it. What is left round the
   * ring is a ragged line of mortar and chips, a few pixels of it here and
   * a finger's width there, and it is the one thing that tells the eye at a
   * distance that there is a ring at all: without it the wedges are pale
   * stone butting pale stone, and at a hundred yards the arch is a hole.
   *
   * It is drawn out to a little past where the deepest wedge will reach and
   * in past the curve, so the wedges bury all of it but the ragged edge and
   * the cut takes the rest.
   */
  const lip = (j: number): number => out[j] + (j === crown || j === crown + 1 ? 0.09 : 0);
  const foot = A_CY - 1;
  const hem: Pt[] = [[A_CX - A_R * (1 + lip(0)), foot]];
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < 3; k++) {
      const u = k / 3;
      const a = Math.PI * (1 + cut[j] + (cut[j + 1] - cut[j]) * u);
      // Flush with the wedges two thirds of the way round and a bite of
      // mortar the rest, so what shows is a broken line and not a rim.
      const r = lip(j) + (lip(j + 1) - lip(j)) * u + (R() < 0.38 ? 0.02 + R() * 0.05 : -0.004);
      hem.push([A_CX + Math.cos(a) * A_R * (1 + r), A_CY + Math.sin(a) * A_R * (1 + r)]);
    }
  }
  hem.push([A_CX + A_R * (1 + lip(n)), foot]);
  hem.push([A_CX + A_R * 0.93, foot]);
  for (let j = n; j >= 0; j--) hem.push(at(j, -0.06));
  hem.push([A_CX - A_R * 0.93, foot]);
  g.beginPath();
  g.moveTo(hem[0][0], hem[0][1]);
  for (const q of hem) g.lineTo(q[0], q[1]);
  g.closePath();
  g.fillStyle = PASTEL.ringJoint; g.fill();
  for (let i = 0; i < n; i++) {
    const deep = (j: number): number => out[j] + (i === crown ? 0.09 : 0);
    // The inner pair sit well inside the opening, so the cut is what shapes
    // them; the outer pair come in by the joint.
    const wedge: Pt[] = [
      at(i, -0.12), at(i + 1, -0.12),
      pt(cut[i + 1] - GAP, lean[i + 1], deep(i + 1)), pt(cut[i] + GAP, lean[i], deep(i)),
    ];
    const pts = roughen(wedge, R, 3, 2.2);
    dressed(kit, g, pts, i === crown ? 'dress' : pickDressed(kit, R));
    // Not the crown: two or three pits at the top of an arch are two eyes
    // and a nose, and the top of an arch is where the eye lands.
    if (i !== crown) wearOne(kit, g, pts, R);
    else if (R() < 0.5) crack(kit, g, bbox(pts), R);
  }
  /*
   * And the chips: what was jammed into the gaps when the broken field
   * would not meet the ring. They are the evidence that the wall was opened
   * rather than built with a hole in it, and they cost nothing.
   */
  for (let j = 0; j <= n; j++) {
    // Not at the crown: anything standing over the keystone is a chimney.
    if (R() > 0.45 || j === crown || j === crown + 1) continue;
    const w = 7 + R() * 5, h = w * (0.6 + 0.3 * R());
    const [cx, cy] = at(j, lip(j) + 0.012 + R() * 0.025);
    wearOne(kit, g, stone(kit, g, cx - w / 2, cy - h / 2, w, h, R, R() < 0.35 ? 'dark' : 'dress', 'laid', (R() - 0.5) * 0.6), R);
  }
}

/** The mortar the field was broken out for, ragged all round and buried by what goes over it. */
function winPocket(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, top: number, sill: number): void {
  const { PASTEL } = kit;
  const box: Pt[] = [[x0 - 24, top], [x1 + 24, top], [x1 + 24, sill + 26], [x0 - 24, sill + 26]];
  shape(g, roughen(box, R, 6, 4.5));
  g.fillStyle = PASTEL.ringJoint;
  g.fill();
}

/**
 * A column of stone up one side of the opening, built from the sill and
 * overhanging into it. `wide` is how big a stone he could spare for it: a
 * window gets the long ones, a bay the short ones, because a bay is already
 * most of the section across and a long jamb stone would reach the courses
 * that straddle the seam.
 */
function winJamb(kit: Kit, g: Ctx, R: Rand, side: number, x0: number, x1: number, head: number, sill: number, wide: number): void {
  const { MORTAR } = kit;
  const line = side < 0 ? x0 : x1;
  let y = sill - 2, course = side < 0 ? 0 : 1;
  while (y > head - 4) {
    const h = 34 + R() * 20;
    const w = (course++ % 2 ? wide * 0.68 : wide) + R() * 14;
    const x = side < 0 ? line + OVER - w : line - OVER;
    wearOne(kit, g, stone(kit, g, x, y - h, w, h, R, pickDressed(kit, R), 'laid', (R() - 0.5) * 0.03), R);
    y -= h + MORTAR + R() * 3;
  }
}

/**
 * The relieving arch: a flat curve of small wedges over the lintel.
 *
 * Its rise is a tenth of its span, which is what makes it look like work
 * rather than ornament -- it is there to throw the load out to the jambs,
 * and a mason who wanted it to look like an arch would have given it more.
 */
function relieving(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number): void {
  const half = (x1 - x0) / 2 + 20, cx = (x0 + x1) / 2;
  const rise = 15 + R() * 7;
  const rad = (half * half + rise * rise) / (2 * rise);
  const cy = lintelTop(head) + rad - rise;
  const a0 = Math.asin(Math.min(1, half / rad));
  // Five or seven, so the stones are lumps rather than tally marks, and odd
  // so one of them caps the middle.
  const n = 5 + 2 * Math.floor(R() * 2);
  const cut: number[] = [];
  for (let i = 0; i <= n; i++) cut.push(-a0 + (2 * a0 * i) / n + (i > 0 && i < n ? (R() - 0.5) * 0.36 * (2 * a0) / n : 0));
  const crown = (n - 1) / 2;
  cut[crown] -= 0.35 * (2 * a0) / n;
  cut[crown + 1] += 0.35 * (2 * a0) / n;
  // In pixels rather than in radii: the flatter the curve the longer the
  // radius, and a depth taken as a fraction of it would put the crown of a
  // shallow one through the band.
  const out = cut.map(() => (17 + R() * 7) / rad);
  const pt = (a: number, r: number): Pt => [cx + Math.sin(a) * rad * (1 + r), cy - Math.cos(a) * rad * (1 + r)];
  // The joint is shut at the face and open at the back, as on the ring.
  const gap = 0.16 * (2 * a0) / n;
  for (let i = 0; i < n; i++) {
    const deep = (j: number): number => out[j] + (i === crown ? 0.02 : 0);
    const wedge: Pt[] = [
      pt(cut[i], -0.03), pt(cut[i + 1], -0.03),
      pt(cut[i + 1] - gap, deep(i + 1)), pt(cut[i] + gap, deep(i)),
    ];
    const pts = roughen(wedge, R, 3, 1.8);
    dressed(kit, g, pts, i === crown ? 'dress' : pickDressed(kit, R));
    if (i !== crown) wearOne(kit, g, pts, R);
  }
}

/** A window or a bay in laid stone: the pocket, the sill, the jambs, the relieving wedges and the lintel. */
function stoneSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, wide: number, shelf: number): void {
  const { S } = kit;
  const top = lintelTop(head);
  winPocket(kit, g, R, x0, x1, top - 46, sill);
  // The sill first, because everything either side of the hole stands on it.
  wearOne(kit, g, stone(kit, g, x0 - 16 - shelf, sill - 4, x1 - x0 + 32 + shelf * 2, 24 + shelf, R, 'dress', 'laid', (R() - 0.5) * 0.012), R);
  if (S.lay === 'bond') {
    // A sill on brick is cut stone standing out to throw the rain clear,
    // and it throws a shade on the brick below it as the band does.
    const sx = x0 - 16 - shelf, sw = x1 - x0 + 32 + shelf * 2, sy = sill + 20 + shelf;
    const sh = g.createLinearGradient(0, sy, 0, sy + 9);
    sh.addColorStop(0, 'rgba(40, 32, 62, 0.42)');
    sh.addColorStop(1, 'rgba(40, 32, 62, 0)');
    g.fillStyle = sh;
    g.fillRect(sx + 3, sy, sw - 6, 9);
    // Rain stands on a sill as it does on a plinth, and moss comes after it.
    if (S.growth && R() < 0.6) {
      const w = sw * (0.3 + 0.3 * R());
      mossLens(g, { x: sx + (sw - w) * R(), y: sill - 4, w, h: 20, course: 0, pts: [] }, sill - 2, R);
    }
  }
  winJamb(kit, g, R, -1, x0, x1, head, sill, wide);
  winJamb(kit, g, R, 1, x0, x1, head, sill, wide);
  relieving(kit, g, R, x0, x1, head);
  // And the lintel over the jambs, under the wedges: one lump if he was
  // lucky with the quarry, two meeting over the middle if he was not.
  if (R() < 0.42 && x1 - x0 < 250) {
    wearOne(kit, g, stone(kit, g, x0 - 18, top, x1 - x0 + 36, LINTEL, R, 'dress', 'laid', (R() - 0.5) * 0.008), R);
  } else {
    const mid = (x0 + x1) / 2 + (R() - 0.5) * 30;
    wearOne(kit, g, stone(kit, g, x0 - 18, top, mid - x0 + 18, LINTEL, R, 'dress', 'laid', (R() - 0.5) * 0.01), R);
    wearOne(kit, g, stone(kit, g, mid, top, x1 + 18 - mid, LINTEL, R, 'dress', 'laid', (R() - 0.5) * 0.01), R);
  }
}

/** The jamb: long and short about, from under the beam to the ground. */
function doorJamb(kit: Kit, g: Ctx, R: Rand, side: number, x0: number, x1: number, head: number): void {
  const { MORTAR } = kit;
  const line = side < 0 ? x0 : x1;
  let y = head + 1, tall = true;
  while (y < TH + 20) {
    const h = tall ? 70 + R() * 24 : 26 + R() * 12;
    const w = (tall ? 44 : 62) + R() * 14;
    const x = side < 0 ? line + OVER - w : line - OVER;
    wearOne(kit, g, stone(kit, g, x, y, w, h, R, pickDressed(kit, R), 'laid', (R() - 0.5) * 0.022), R);
    y += h + MORTAR + R() * 3;
    tall = !tall;
  }
}

/**
 * The beam: a squared baulk with the saw still on it, bedded a hand into the
 * wall at each end and sagging the width of a finger in the middle, because
 * it has been carrying a storey of rubble for some years.
 */
export function baulk(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, bTop: number, deep: number): void {
  const { PASTEL } = kit;
  const sag = 2.5 + R() * 2.5;
  const top = (t: number): number => bTop + Math.sin(Math.PI * t) * sag;
  const pts: Pt[] = [];
  for (let i = 0; i <= 8; i++) pts.push([x0 + (x1 - x0) * (i / 8), top(i / 8) + (R() - 0.5) * 1.2]);
  for (let i = 8; i >= 0; i--) pts.push([x0 + (x1 - x0) * (i / 8), top(i / 8) + deep + (R() - 0.5) * 1.2]);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts) g.lineTo(q[0], q[1]);
  g.closePath();
  g.fillStyle = PASTEL.beamShade;
  g.fill();
  g.save(); g.clip();
  g.translate(-2, -3.5);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts) g.lineTo(q[0], q[1]);
  g.closePath();
  g.fillStyle = PASTEL.beam;
  g.fill();
  // The grain: two or three long lines that wander the way a sawn face does.
  g.strokeStyle = hexA(PASTEL.beamLine, 0.35);
  g.lineWidth = 1.2;
  for (let k = 0; k < 2 + Math.floor(R() * 2); k++) {
    const off = deep * (0.25 + 0.5 * R());
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = x0 + (x1 - x0) * t, y = top(t) + off + Math.sin(t * 7 + k) * 1.6;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  // The lit edge along the top, and the line round the whole of it.
  g.strokeStyle = hexA(PASTEL.beamHi, 0.75);
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 8; i++) { const t = i / 8, x = x0 + (x1 - x0) * t; if (i === 0) g.moveTo(x, top(t) + 1.4); else g.lineTo(x, top(t) + 1.4); }
  g.stroke();
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts) g.lineTo(q[0], q[1]);
  g.closePath();
  g.strokeStyle = PASTEL.beamLine;
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  g.stroke();
}

/**
 * Pocket, jambs, corbels, beam: the order a doorway goes up in.
 *
 * `reach` is how far a corbel comes in under the end of the beam, and it is
 * nought for a doorway and a hand's breadth for a gate. That is the whole
 * difference between the two, and it is the right one: the beam over a
 * doorway spans the doorway, and the beam over a gate would not, so the
 * last course either side steps out to meet it and shortens what the timber
 * has to carry. It sits above the head of the opening, which is why the cut
 * leaves it and takes everything under it.
 */
function stoneDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number, reach: number): void {
  const { PASTEL } = kit;
  const bTop = head - (reach ? CORBEL_H : 0) - deep + 3;
  const box: Pt[] = [[x0 - 26, bTop - 10], [x1 + 26, bTop - 10], [x1 + 26, TH + 8], [x0 - 26, TH + 8]];
  shape(g, roughen(box, R, 6, 4.5));
  g.fillStyle = PASTEL.ringJoint;
  g.fill();
  doorJamb(kit, g, R, -1, x0, x1, head);
  doorJamb(kit, g, R, 1, x0, x1, head);
  if (reach) {
    for (const side of [-1, 1]) {
      const line = side < 0 ? x0 : x1;
      const a = side < 0 ? line - 20 : line - reach;
      wearOne(kit, g, stone(kit, g, a, head - CORBEL_H, reach + 20, CORBEL_H + 3, R, 'dress', 'laid', (R() - 0.5) * 0.01), R);
    }
  }
  baulk(kit, g, R, x0 - 22 + reach * 0.8, x1 + 22 - reach * 0.8, bTop, deep);
}

/**
 * A tone for a stone of a field wall, which carries more colour than a house
 * wall because nobody picked it over: one in five with the weather in it,
 * one in eight bleached, and the rest off the wall's own four.
 */
export function fieldTone(kit: Kit, R: Rand): string {
  const { S } = kit;
  let t = R();
  for (const [name, share] of S.field) { if (t < share) return name; t -= share; }
  return '';
}

/**
 * The widths of a coping, from a seed of their own.
 *
 * The same at every height and, within a variant, the same on the face of
 * the coping and on the top of it, because those are two pictures of the
 * same stones and they have to line up along the whole run. Across variants
 * they differ: one run of widths for all five repeated exactly every four
 * metres, which along a field boundary is the comb again at a larger scale.
 * The two seam stones stay fixed, because those are what butt.
 *
 * One in five is a packer less than half the mean, which is what breaks it.
 */
function copeWidths(kit: Kit, seed: number): number[] {
  const { CSEAM, S } = kit;
  const R = rand(seed), L = TW + CSEAM[0] - CSEAM[1];
  if (S.lay === 'bond') {
    // Four lengths across what the straddler leaves, cut to what the quarry
    // gave rather than to a rule: a metre, give or take a hand.
    const ws: number[] = []; let sum = 0;
    for (let k = 0; k < 4; k++) { const w = 0.82 + R() * 0.36; ws.push(w); sum += w; }
    return ws.map((w) => (w / sum) * L);
  }
  const n = Math.max(2, Math.round(L / COPE_MEAN));
  const ws: number[] = []; let sum = 0;
  for (let k = 0; k < n; k++) { const w = R() < 0.22 ? 0.42 + R() * 0.16 : 0.85 + R() * 0.8; ws.push(w); sum += w; }
  return ws.map((w) => (w / sum) * L);
}

/** Their tones, drawn up front so the face and the top take them in step. */
function copeTones(kit: Kit, seed: number, n: number): string[] {
  const { S } = kit;
  const R = rand(seed + 41);
  // A brick wall's coping is cut stone, like every other dressing on it. A
  // dry field wall's is whatever came off the same heap as the rest of it.
  if (S.lay === 'bond') return Array.from({ length: n }, () => (R() < 0.32 ? 'plinth' : 'dress'));
  return Array.from({ length: n }, () => fieldTone(kit, R));
}

/**
 * One stone of a coping: upright, leaning with its neighbours because a
 * whole cope is laid one way up a wall, and not quite with them because
 * nothing here is laid twice the same.
 */
function copeStone(kit: Kit, g: Ctx, x: number, w: number, R: Rand, tone: string, tip: number): void {
  const { S, MORTAR, PASTEL } = kit;
  if (S.lay === 'bond') {
    /*
     * Dressed, and bedded level. A length of cut cope is laid to a line
     * like the brick under it; what it has of the hand is a pixel or two of
     * settling and the arris knocked here and there, not a stone stood on
     * end in the run.
     */
    const rise = 1 + R() * (S.master ? 0.6 : 3);
    const pts = stone(kit, g, x + MORTAR / 2, rise, w - MORTAR, COPE - MORTAR / 2 - rise, R, tone, 'unit', (R() - 0.5) * (S.master ? 0 : 0.01), 1.6);
    // Its top, turned at the sky and a step lighter than its face.
    g.save();
    if (S.slab) { g.beginPath(); poly(g, pts); } else shape(g, pts);
    g.clip();
    if (S.slab) {
      // A marble cope's top is weathered pale, a flat band of it along the arris.
      g.fillStyle = '#d6d9e0'; g.fillRect(x, rise, w, 4.5);
    } else {
      const lit = g.createLinearGradient(0, rise, 0, rise + 9);
      lit.addColorStop(0, hexA(PASTEL.dressHi, 0.6));
      lit.addColorStop(1, hexA(PASTEL.dressHi, 0));
      g.fillStyle = lit;
      g.fillRect(x, rise, w, 9);
    }
    g.restore();
    return;
  }
  const packer = w < COPE_MIN * 1.6;
  /*
   * How proud this one stands, and it is the point of the whole function.
   * A cope is laid off the ground by eye: a stone is as tall as it is and
   * the man puts it in. So one in six is a big one left standing over the
   * run, and a packer -- a stone driven down between two that would not
   * meet -- sits low, because that is what driving it down means.
   *
   * The ones that stand proudest lean least, which is the one liberty taken
   * here: a stone tilted hard at the top of the run would be drawn off the
   * top edge of the picture, and the picture is the wall.
   */
  const rise = packer ? COPE_RISE * (0.55 + R() * 0.45) : R() < 0.19 ? -(3 + R() * 6) : COPE_RISE * (0.2 + R() * 0.8);
  const lean = tip + (R() - 0.5) * (rise > 5 ? 0.3 : 0.1);
  const gap = packer ? 0.8 : MORTAR - 1.8;
  wearOne(kit, g, stone(kit, g, x + gap / 2, rise, Math.max(4, w - gap), COPE - MORTAR / 2 - rise, R, tone, 'laid', lean, COPE_INK), R);
}

/** The coping of a low wall of laid stone: a run of cope stones on edge, the one across the seam the same in every variant. */
function stoneCoping(kit: Kit, g: Ctx, seed: number): void {
  const { CSEAM, S } = kit;
  // Which way the whole run leans, settled once and kept, so a cope reads as
  // one job rather than as a row of stones that fell that way.
  const tip = (rand(431)() - 0.5) * 0.12;
  const w0 = CSEAM[1] - CSEAM[0];
  // The one across the seam is cope like the rest: on a bond that is cut
  // stone, and the field's own tone there is a brick laid on top of it.
  const t0 = S.lay === 'bond' ? 'dress' : '';
  copeStone(kit, g, CSEAM[0], w0, rand(313), t0, tip);
  copeStone(kit, g, TW + CSEAM[0], w0, rand(313), t0, tip);
  const ws = copeWidths(kit, seed), tones = copeTones(kit, seed, ws.length), R = rand(seed + 137);
  let x = CSEAM[1];
  for (let k = 0; k < ws.length; k++) { copeStone(kit, g, x, ws[k], R, tones[k], tip); x += ws[k]; }
  /*
   * And the shadow it throws on the course under it, because a cope
   * oversails: without it the cope is a pattern printed on the wall.
   *
   * Stone by stone, not as one bar across the section. A cope oversails by
   * however much each stone happens to stick out, and a rectangle of even
   * shadow four metres long was one of four ruled lines inside the top
   * third of the wall -- which is what made the top of it read flatter than
   * the bottom at the zoom people play at.
   */
  if (S.slab) {
    // A cope cut true oversails by the same hand the whole run, so its drip is one line.
    g.fillStyle = hexA('#969aa6', 0.85); g.fillRect(0, COPE, TW, 3);
    return;
  }
  const SH = rand(seed + 271);
  g.fillStyle = S.lay === 'bond' ? 'rgba(40, 32, 62, 0.38)' : 'rgba(96, 86, 66, 0.26)';
  let sx = CSEAM[0];
  for (const w of [CSEAM[1] - CSEAM[0], ...ws, CSEAM[1] - CSEAM[0]]) {
    g.fillRect(sx, COPE, w + 1, 1.5 + SH() * 5);
    sx += w;
  }
}

/**
 * The top of laid stone. On a bond the top is the band course seen from
 * above, and a face turned up at the sky is a step lighter than the same
 * stone on the side.
 */
function stoneCap(kit: Kit, g: Ctx): void {
  const { PASTEL, S } = kit;
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, TW, CAP_H);
  slabs(kit, g, 0, CAP_H, rand(99), S.lay === 'bond' ? 'top' : 'flat');
}

/** The stone at a corner (`Masonry.corner`): as deep as the cap, as long as a wall is thick, cut as the cap's are. */
function stoneCorner(kit: Kit): HTMLCanvasElement {
  const { PASTEL, MORTAR, S } = kit;
  const CW = Math.round(2 * WALL_THICK * TW), c = cnv(CW, CAP_H), g = ctxOf(c);
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, CW, CAP_H);
  stone(kit, g, MORTAR / 2, MORTAR / 2, CW - MORTAR, CAP_H - MORTAR, rand(97), S.lay === 'bond' ? 'top' : 'flat', S.lay === 'bond' ? 'unit' : 'sawn');
  return c;
}

/** The end of laid stone: the band's stone over the courses, or on a bond over its quoins. */
function stoneEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  const { PASTEL, MORTAR, S } = kit;
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, Wc, TH);
  stone(kit, g, MORTAR / 2, MORTAR / 2, Wc - MORTAR, BAND - MORTAR, R, 'flat', 'sawn');
  if (S.lay === 'bond') {
    /*
     * Quoins. Where a brick wall stops -- a corner of a house, the end of a
     * run -- it is finished in cut stone, because an arris of brick is the
     * first thing a cart takes off and the corner is what carries the two
     * walls into each other. Five stones to the storey, each two courses
     * of brick deep, in the dressings' two tones turn about.
     */
    const n = 5, ch = (TH - BAND) / n;
    for (let i = 0; i < n; i++) {
      stone(kit, g, MORTAR / 2, BAND + i * ch + MORTAR / 2, Wc - MORTAR, ch - MORTAR, R, i % 2 ? 'plinth' : 'dress', 'unit', 0, 1.8);
    }
    return;
  }
  for (let i = 0; i < COURSES; i++) {
    stone(kit, g, MORTAR / 2, BAND + i * CH + MORTAR / 2, Wc - MORTAR, CH - MORTAR, R, ['', 'brown', 'green', ''][i]);
  }
}

/** The foot of a ground storey of laid stone: its plinth, where it has one. */
function stoneFoot(kit: Kit, g: Ctx, R: Rand): void {
  const { S } = kit;
  if (S.plinth) plinthOf(kit, g, R);
}

/** The coping of laid stone from above: the same run of stones, laid across the thickness. */
function stoneLowCap(kit: Kit, g: Ctx, v: Variant): void {
  const { CSEAM, S, PASTEL, MORTAR } = kit;
  const w0 = CSEAM[1] - CSEAM[0];
  /*
   * Not `flat`: a flat stone takes the flat tone and nothing else, and a
   * coping seen from above that is all one colour is the comb again. In
   * the coping's own ink, though, and -- the thing that matters here --
   * with its own length.
   *
   * Every comber ran the full sixty-four pixels of the wall's thickness
   * with its ends on two ruled lines, and every one of them carried the
   * lit rim that makes a block read as a block, so the top of the wall
   * was a row of keycaps. A comber is a stone: it is as long as it is,
   * it is set square to the wall by eye, one in four does not reach
   * across and gets a second stone behind it, and no stone in a thing
   * two pixels deep on screen has a highlight on its own edge.
   */
  const top = (x: number, w: number, RR: Rand, tone: string): void => {
    if (S.lay === 'bond') {
      // A length of dressed cope seen from above is a slab across the
      // wall's whole thickness, set square to it. The hand shows in a
      // pixel of overhang at one end and not in a stone skewed across it.
      g.fillStyle = PASTEL.joint;
      g.fillRect(x - 1, 0, w + 2, CAP_H);
      const j0 = RR() * 3, j1 = RR() * 3;
      void stone(kit, g, x + MORTAR / 2, j0, w - MORTAR, CAP_H - j0 - j1, RR, tone === 'plinth' ? 'dress' : 'top', 'unit', (RR() - 0.5) * 0.01, 1.2, false);
      return;
    }
    // One end jitters hard and the other a little, so the two arrises of
    // the run are ragged independently rather than both nearly straight.
    const far = RR() < 0.5;
    const j0 = -5 + RR() * (far ? 25 : 10), j1 = 1 + RR() * (far ? 5 : 20);
    /*
     * The hearting between the combers, laid stone by stone rather than
     * as one rectangle behind the lot. A cap that opens with a filled
     * rectangle has a ruled far edge whatever the stones on it do, and at
     * four of the eight rotations that edge is the wall's whole outline
     * against the sky.
     */
    g.fillStyle = PASTEL.joint;
    g.fillRect(x - 1, Math.min(j0, 0) + 2, w + 2, CAP_H - Math.min(j0, 0) - 2);
    const tilt = (RR() - 0.5) * 0.55;
    // Lighter again than the face of the coping. This strip is two or
    // three pixels deep at the zoom people play at, so an outline that
    // reads as a joint up close reads as a dashed line along the top of
    // the wall from a field away -- which is a painted kerb, not stone.
    const run = CAP_H - j0 - j1;
    if (RR() < 0.26) {
      const a = run * (0.4 + RR() * 0.2);
      void stone(kit, g, x + MORTAR / 2, j0, w - MORTAR, a, RR, tone, 'laid', tilt, 1.05, false);
      void stone(kit, g, x + MORTAR / 2, j0 + a + 2, w - MORTAR, run - a - 2, RR, RR() < 0.5 ? 'weather' : '', 'laid', -tilt, 1.05, false);
      return;
    }
    void stone(kit, g, x + MORTAR / 2, j0, w - MORTAR, run, RR, tone, 'laid', tilt, 1.05, false);
  };
  top(CSEAM[0], w0, rand(313), S.lay === 'bond' ? 'dress' : '');
  top(TW + CSEAM[0], w0, rand(313), S.lay === 'bond' ? 'dress' : '');
  // The same widths and the same tones as the face of it, taken from the
  // same two lists rather than from a roll of its own, because these are
  // the tops of those stones and not a second row of them.
  const seed = copeSeed(v.seed), ws = copeWidths(kit, seed), tones = copeTones(kit, seed, ws.length), R = rand(seed + 577);
  let x = CSEAM[1];
  for (let k = 0; k < ws.length; k++) { top(x, ws[k], R, tones[k]); x += ws[k]; }
}

/** The end of a low wall of laid stone: the cope's ends over the levelling course and the courses, or on a bond over its quoins. */
function stoneLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number, rows: number): void {
  const { PASTEL, S, MORTAR } = kit;
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, Wc, fh);
  let cx = 0, ex = 0;
  // A bond's cope is cut stone, so its end is too.
  const heads: Array<[number, string, number]> = S.lay === 'bond'
    ? [[0.52, 'dress', 2], [0.48, 'plinth', 3]]
    : [[0.36, '', 5], [0.34, 'weather', 1], [0.3, 'bleach', 7]];
  for (const [f, tone, up] of heads) {
    const w = f * Wc;
    stone(kit, g, cx + 1, up, w - 2, COPE - MORTAR / 2 - up, R, tone, 'laid', (R() - 0.5) * 0.06, COPE_INK);
    cx += w;
  }
  // Not `flat`: a flat stone takes `TONES.flat` and nothing else, which is
  // the lightest tone in the table, so the quietest course in the wall
  // came out as the brightest thing on its head -- one pale pill where
  // the run shows a course of packing.
  if (S.lay === 'bond') {
    // Where a brick garden wall stops it is finished in cut stone, the
    // same quoins a house's corner is: two to the height of the wall.
    const qh = (fh - COPE) / 2;
    for (let i = 0; i < 2; i++) {
      stone(kit, g, MORTAR / 2, COPE + i * qh + MORTAR / 2, Wc - MORTAR, qh - MORTAR, R, i ? 'plinth' : 'dress', 'unit', 0, 1.8);
    }
    return;
  }
  for (const [f, tn] of [[0.38, 'weather'], [0.34, 'dark'], [0.28, 'brown']] as Array<[number, string]>) {
    const w = f * Wc;
    stone(kit, g, ex + 1, COPE + 1 + R() * 2, w - 2, LEVEL - 3, R, tn, 'laid', (R() - 0.5) * 0.08, 0.9);
    ex += w;
  }
  const ch = (fh - COPE - LEVEL) / rows;
  for (let i = 0; i < rows; i++) {
    const y = COPE + LEVEL + i * ch + MORTAR / 2, h = ch - MORTAR;
    const split = Wc * (i % 2 ? 0.42 : 0.6);
    stone(kit, g, MORTAR / 2, y, split - MORTAR, h, R, ['', 'brown', 'green', ''][i % 4]);
    stone(kit, g, split + MORTAR / 2, y, Wc - split - MORTAR, h, R, i === rows - 1 ? 'weather' : 'dark');
  }
}

/** A pier of laid stone either side of a gate in a low wall, and a flat stone over it. */
function stonePier(kit: Kit, g: Ctx, R: Rand, side: number, line: number, fh: number): void {
  const { MORTAR } = kit;
  let y = fh - 2;
  while (y > COPE + LEVEL - 4) {
    const h = 28 + R() * 16, w = 34 + R() * 14;
    wearOne(kit, g, stone(kit, g, side < 0 ? line + OVER - w : line - OVER, y - h, w, h, R, pickDressed(kit, R), 'laid', (R() - 0.5) * 0.02), R);
    y -= h + MORTAR + R() * 2;
  }
  wearOne(kit, g, stone(kit, g, side < 0 ? line + OVER - 52 : line - OVER, MORTAR / 2, 52, COPE + LEVEL - MORTAR, R, 'dress', 'laid', (R() - 0.5) * 0.015), R);
  // A pier stands proud of the wall it interrupts, so it throws a line
  // of shadow down the field side of itself. Without one it is a paler
  // patch of the same wall in the same plane, and the step up at the
  // gateway reads as the wall changing height for no reason.
  g.fillStyle = 'rgba(96, 86, 66, 0.3)';
  g.fillRect(side < 0 ? line + OVER - 56 : line - OVER + 52, 0, 4, fh);
}

/** The flat stone a pier is finished with. */
export function stoneCapPier(kit: Kit, g: Ctx, R: Rand, x: number): void {
  wearOne(kit, g, stone(kit, g, x, 2, 52, CAP_H - 4, R, 'dress', 'laid', (R() - 0.5) * 0.02, 1.2, false), R);
}

/** The cope stone over a corner or a junction of a low wall of laid stone (`Low.corner`), laid across the run's thickness as the cap's are. */
function stoneLowCorner(kit: Kit): HTMLCanvasElement {
  const { PASTEL, S, MORTAR } = kit;
  const CW = Math.round(2 * WALL_THICK * 1.25 * TW), c = cnv(CW, CAP_H + PROUD), g = ctxOf(c), R = rand(331);
  g.translate(0, PROUD);
  g.fillStyle = PASTEL.joint; g.fillRect(0, 0, CW, CAP_H);
  if (S.lay === 'bond') void stone(kit, g, MORTAR / 2, MORTAR / 2, CW - MORTAR, CAP_H - MORTAR, R, 'dress', 'unit', 0, 1.2, false);
  else void stone(kit, g, MORTAR / 2, MORTAR / 2, CW - MORTAR, CAP_H - MORTAR, R, '', 'laid', (R() - 0.5) * 0.1, 1.05, false);
  return c;
}

/**
 * What every wall of laid stone or brick shares, whatever its field is laid
 * in: the openings cut in it, its plinth, the cap and the end of a storey,
 * the coping, piers and ends of a garden wall.
 */
export const LAID_LAY: Omit<Lay, 'courses' | 'lowCourses'> = {
  arch: stoneArch,
  surround: stoneSurround,
  doorway: stoneDoorway,
  foot: stoneFoot,
  cap: stoneCap,
  corner: stoneCorner,
  ends: stoneEnds,
  coping: stoneCoping,
  lowCap: stoneLowCap,
  lowEnds: stoneLowEnds,
  gatePier: stonePier,
  gateCapPier: stoneCapPier,
  lowCorner: stoneLowCorner,
  head: BAND,
};
