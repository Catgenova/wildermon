import { PROUD } from './coping';
import { EDGE, TH, TW, blob, channels, cnv, ctxOf, hexA, hexOf, lighten, poly, rand } from './draw';
import { LOW_FOOT, PROUD_INK, PROUD_SH, PROUD_SIDE, footing } from './frame';
import type { Kit } from './kit';
import { stoneCapPier } from './laid';
import { A_CX, A_CY, A_R } from './openings';
import { flatCap, flatLowCap, stoneUnder } from './render';
import type { Block, Ctx, Lay, Low, Masonry, Pt, Rand } from './types';

/**
 * Log: round logs laid on one another, chinked, their ends crossing at the corners; and the sawn
 * boards an opening in a log or plank wall is framed in.
 */

/**
 * How many logs to a storey, and so how tall a course is -- a log and the
 * chinking under it -- and how deep the chinking is. Eight to a storey is
 * a log of a little under forty centimetres, which is a house log; at a
 * dozen, thin ones, the wall read as boards.
 */
export const LOGS = 8;

const LOG_CH = TH / LOGS;

const CHINK = 7;

/** How far a log's edges wander off true along a section: a log is a tree, not a baulk. */
const LOG_WANDER = 2.4;

/**
 * One log, from `x0` to `x1` between `y0` and `y1`: round, so lit along its
 * top a third of its depth and in shade along its underside, each edge of
 * the light cut by hand; its own shade laid on the chinking under it. Its
 * edges wander a little along it and come true at both ends, so it meets the
 * next section's log at the seam. Along it, away from the seams, what the
 * weather has done to this one: a patch gone silver or dark with damp, a
 * knot or two, a check where it split as it dried.
 */
function logRun(kit: Kit, g: Ctx, y0: number, y1: number, tone: string, R: Rand, x0 = -2, x1 = TW + 2): void {
  const { PASTEL } = kit;
  const h = y1 - y0, n = 8;
  const wob = (i: number, a: number): number => (i === 0 || i === n ? 0 : (R() - 0.5) * 2 * a);
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  // The top of the topmost log is the head of the wall, which runs true.
  const top: Pt[] = xs.map((x, i): Pt => [x, y0 + (y0 > 0 ? wob(i, LOG_WANDER) : 0)]);
  const bot: Pt[] = xs.map((x, i): Pt => [x, y1 + wob(i, LOG_WANDER)]);
  const outline: Pt[] = [...top, ...bot.slice().reverse()];
  g.beginPath(); poly(g, outline.map(([x, y]): Pt => [x, y + CHINK * 0.6])); g.fillStyle = PROUD_INK; g.fill();
  g.save();
  g.beginPath(); poly(g, outline); g.fillStyle = tone; g.fill(); g.clip();
  const lit: Pt[] = xs.map((x, i): Pt => [x, y0 + h * 0.34 + wob(i, 3.5)]);
  g.beginPath(); poly(g, [...top.map(([x, y]): Pt => [x, y - 4]), ...lit.slice().reverse()]);
  g.fillStyle = hexA(lighten(tone, 9), 0.95); g.fill();
  const dim: Pt[] = xs.map((x, i): Pt => [x, y0 + h * 0.7 + wob(i, 3.5)]);
  g.beginPath(); poly(g, [...dim, ...bot.map(([x, y]): Pt => [x, y + 4]).reverse()]);
  g.fillStyle = lighten(tone, -9); g.fill();
  // Weather, away from the seams: a long patch gone silver, or dark.
  const lo = Math.max(x0, EDGE + 10), hi = Math.min(x1, TW - EDGE - 10);
  for (let i = 0, k = R() < 0.6 ? 1 : 0; i < k; i++) {
    const len = 50 + R() * 90, cx = lo + len / 2 + R() * Math.max(0, hi - lo - len), cy = y0 + h * (0.42 + R() * 0.16);
    const [r, gg, b] = channels(tone), silver = R() < 0.6;
    g.beginPath(); poly(g, blob(cx, cy, len / 2, h * (0.14 + R() * 0.1), 12, R, 0.8, 0.3, 0.2));
    g.fillStyle = silver ? hexOf([r + 9, gg + 10, b + 13]) : lighten(tone, -5); g.fill();
  }
  // A knot or two: dark, with the light on its upper rim.
  for (let i = 0, k = Math.floor(R() * 2.4); i < k; i++) {
    const kx = lo + R() * (hi - lo), ky = y0 + h * (0.4 + R() * 0.25), rx = 4 + R() * 3, ry = 3 + R() * 2;
    g.beginPath(); g.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = lighten(tone, -16); g.fill();
    g.beginPath(); g.ellipse(kx, ky, rx + 1.5, ry + 1.5, 0, Math.PI * 1.05, Math.PI * 1.75); g.strokeStyle = hexA(lighten(tone, 14), 0.9); g.lineWidth = 1.6; g.stroke();
  }
  // A check along it, where it split as it dried.
  if (R() < 0.7) {
    const len = 40 + R() * 90, cx = lo + R() * Math.max(0, hi - lo - len), cy = y0 + h * (0.46 + R() * 0.14);
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + len / 2, cy + (R() - 0.5) * 4, cx + len, cy + (R() - 0.5) * 3);
    g.strokeStyle = hexA(PASTEL.line, 0.6); g.lineWidth = 2; g.lineCap = 'round'; g.stroke(); g.lineCap = 'butt';
  }
  g.restore();
  g.beginPath(); poly(g, outline);
  g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.7; g.lineJoin = 'round'; g.stroke();
}

/**
 * The cut end of a log, seen end on: a disc of pale end grain inside its
 * bark, lit on its upper left, its rings round a heart a little off centre,
 * and a check running out from the heart to the bark.
 */
function endGrain(kit: Kit, g: Ctx, cx: number, cy: number, rx: number, ry: number, R: Rand): void {
  const { PASTEL } = kit;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = PASTEL.dressShade; g.fill();
  g.save();
  g.beginPath(); g.ellipse(cx, cy, rx - 3, ry - 3, 0, 0, Math.PI * 2); g.fillStyle = PASTEL.grain; g.fill(); g.clip();
  g.beginPath(); g.ellipse(cx + rx * 0.34, cy + ry * 0.34, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = hexA(PASTEL.grainRing, 0.5); g.fill();
  const px = cx + (R() - 0.5) * rx * 0.3, py = cy + (R() - 0.5) * ry * 0.3;
  g.strokeStyle = hexA(PASTEL.grainRing, 0.9); g.lineWidth = 1.3;
  for (const f of [0.74, 0.5, 0.26]) { g.beginPath(); g.ellipse(px, py, rx * f, ry * f, 0, 0, Math.PI * 2); g.stroke(); }
  const a = R() * Math.PI * 2;
  g.beginPath(); g.moveTo(px, py); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  g.strokeStyle = hexA(PASTEL.line, 0.7); g.lineWidth = 1.6; g.stroke();
  g.restore();
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.6; g.stroke();
}

/**
 * The field of a log wall: eight logs one on another, the chinking between
 * them, and the top of the topmost at the head of the storey, so storeys
 * meet on a line of chinking. On a variant in two, a log that did not run
 * the length of the wall is butted to the next where the section's middle
 * falls, and that joint is the only upright line in it.
 */
function paintLogs(kit: Kit, g: Ctx, R: Rand, open: boolean, vi: number): Block[] {
  const { PASTEL, LOG_TONES } = kit;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, TW, TH);
  const joint = !open && vi >= 0 && vi % 2 === 1 ? 1 + Math.floor(R() * (LOGS - 2)) : -1;
  for (let k = 0; k < LOGS; k++) {
    const y0 = k * LOG_CH, y1 = (k + 1) * LOG_CH - CHINK;
    if (k !== joint) { logRun(kit, g, y0, y1, LOG_TONES[k], R); continue; }
    const at = TW * (0.3 + R() * 0.4);
    logRun(kit, g, y0, y1, LOG_TONES[k], R, -2, at);
    logRun(kit, g, y0, y1, lighten(LOG_TONES[k], (R() - 0.5) * 5), R, at, TW + 2);
    // The end of the right-hand log, catching the light where it meets the other.
    g.fillStyle = hexA(PASTEL.grain, 0.8); g.fillRect(at + 1, y0 + 3, 3, y1 - y0 - 6);
  }
  return [];
}

/** How wide the sawn boards an opening is framed in are. */
const BOARD = 24;

/**
 * A sawn board: flat, a step paler than the logs, lit down its left edge
 * or along its top and dark down its right or along its underside, the
 * saw's grain along it, and its shade on what it stands proud of.
 */
function board(kit: Kit, g: Ctx, x0: number, y0: number, x1: number, y1: number, R: Rand): void {
  const { PASTEL } = kit;
  const w = x1 - x0, h = y1 - y0, flat = w > h;
  const j = (): number => (R() - 0.5) * 1.6;
  const pts: Pt[] = [[x0 + j(), y0 + j()], [x1 + j(), y0 + j()], [x1 + j(), y1 + j()], [x0 + j(), y1 + j()]];
  g.fillStyle = PROUD_INK;
  if (flat) g.fillRect(x0, y1 - 1, w, PROUD_SH); else g.fillRect(x1 - 1, y0, PROUD_SIDE * 0.8, h);
  g.save();
  g.beginPath(); poly(g, pts); g.fillStyle = PASTEL.beam; g.fill(); g.clip();
  g.fillStyle = hexA(PASTEL.beamHi, 0.9);
  if (flat) g.fillRect(x0 - 2, y0 - 2, w + 4, 7); else g.fillRect(x0 - 2, y0 - 2, 7, h + 4);
  g.fillStyle = PASTEL.beamShade;
  if (flat) g.fillRect(x0 - 2, y1 - 5, w + 4, 7); else g.fillRect(x1 - 5, y0 - 2, 7, h + 4);
  g.strokeStyle = hexA(PASTEL.beamShade, 0.7); g.lineWidth = 1.2;
  for (const f of [0.38, 0.66]) {
    g.beginPath();
    if (flat) { g.moveTo(x0 + 6 + R() * 20, y0 + h * f); g.lineTo(x1 - 6 - R() * 20, y0 + h * f + (R() - 0.5) * 2); }
    else { g.moveTo(x0 + w * f, y0 + 6 + R() * 20); g.lineTo(x0 + w * f + (R() - 0.5) * 2, y1 - 6 - R() * 20); }
    g.stroke();
  }
  g.restore();
  g.beginPath(); poly(g, pts); g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
}

/**
 * A window in a wall of logs or of planks: the wall cut back and the
 * opening framed in sawn boards, a board either side from over the head to
 * under the sill, a head board over it, and a sill board standing out to
 * throw the rain clear.
 */
function boardSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, shelf: number): void {
  board(kit, g, x0 - BOARD, head - BOARD - 4, x0, sill + BOARD, R);
  board(kit, g, x1, head - BOARD - 4, x1 + BOARD, sill + BOARD, R);
  board(kit, g, x0 - BOARD - 6, head - BOARD, x1 + BOARD + 6, head, R);
  board(kit, g, x0 - BOARD - 10 - shelf, sill, x1 + BOARD + 10 + shelf, sill + 16 + shelf * 0.6, R);
}

/** A doorway in it: a board either side down to the ground, and a squared head over the way through, a gate's the deeper. */
function boardDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number): void {
  board(kit, g, x0 - BOARD, head - deep, x0, TH, R);
  board(kit, g, x1, head - deep, x1 + BOARD, TH, R);
  board(kit, g, x0 - BOARD - 8, head - deep, x1 + BOARD + 8, head, R);
}

/** An archway in it: the boards either side, and a head of boards bent round the curve. */
function boardArch(kit: Kit, g: Ctx, R: Rand): void {
  const { PASTEL } = kit;
  board(kit, g, A_CX - A_R - BOARD, A_CY, A_CX - A_R, TH, R);
  board(kit, g, A_CX + A_R, A_CY, A_CX + A_R + BOARD, TH, R);
  const w = BOARD;
  const ring = (): void => {
    g.beginPath();
    g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2);
    g.lineTo(A_CX + A_R, A_CY);
    g.arc(A_CX, A_CY, A_R, Math.PI * 2, Math.PI, true);
    g.closePath();
  };
  g.save(); g.translate(0, PROUD_SH); ring(); g.fillStyle = PROUD_INK; g.fill(); g.restore();
  ring(); g.fillStyle = PASTEL.beam; g.fill();
  g.save(); ring(); g.clip();
  g.beginPath(); g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2); g.lineWidth = 7; g.strokeStyle = hexA(PASTEL.beamHi, 0.9); g.stroke();
  g.beginPath(); g.arc(A_CX, A_CY, A_R, Math.PI, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = PASTEL.beamShade; g.stroke();
  g.restore();
  ring(); g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.6; g.stroke();
}

/**
 * The corner of a log wall, over the face carried round it: in every other
 * course, where this wall's log is notched over the crossing wall's, the
 * crossing log's cut end, ringed, in a notch of chinking. `odd` picks the
 * courses, and the two walls of a corner take them the other way round, so
 * where one wall shows a log end the other's log runs out to meet it.
 */
function logCorner(kit: Kit, h: number, n: number, odd: boolean): HTMLCanvasElement {
  const { PASTEL } = kit;
  const w = 64, c = cnv(w, h), g = ctxOf(c), ch = h / n, R = rand(odd ? 2411 : 2417);
  for (let k = 0; k < n; k++) {
    if ((k % 2 === 1) !== odd) continue;
    const y0 = k * ch, y1 = (k + 1) * ch - CHINK;
    g.fillStyle = PASTEL.stone; g.fillRect(0, Math.max(0, y0 - CHINK), w, y1 - y0 + 2 * CHINK);
    endGrain(kit, g, w / 2, (y0 + y1) / 2, w * 0.46, (y1 - y0) / 2 + 2, R);
  }
  return c;
}

/** The ground storey's foot: the footing, which the bottom log stands on. */
function logFootingOf(kit: Kit, g: Ctx, R: Rand): void {
  const { S } = kit;
  footing(kit, g, R, TH - S.plinth, TH);
}

/** How many logs a low wall `fh` px tall is laid in, over its footing: a log about the house's. */
const lowLogCount = (fh: number): number => Math.max(2, Math.round((fh - LOW_FOOT) / 46));

/**
 * A garden wall of it, or a fence: three or four logs on a course of the
 * footing, the same logs as the house's, the top of the topmost at the head
 * of the wall.
 */
function lowLogs(kit: Kit, g: Ctx, R: Rand, fh: number): Block[] {
  const { PASTEL, LOG_TONES } = kit;
  const sole = fh - LOW_FOOT, n = lowLogCount(fh), ch = sole / n;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, TW, sole);
  for (let k = 0; k < n; k++) logRun(kit, g, k * ch, (k + 1) * ch - CHINK, LOG_TONES[(k + 2) % LOGS], R);
  footing(kit, g, R, sole, fh);
  return [];
}

/**
 * A post of round log standing on end, from `y0` to `y1`: lit down its left
 * side and in shade down its right, as the logs are along their top and
 * underside.
 */
function logPost(kit: Kit, g: Ctx, x0: number, x1: number, y0: number, y1: number, R: Rand): void {
  const { LOG_TONES, PASTEL } = kit;
  const w = x1 - x0;
  const pts: Pt[] = [[x0 + (R() - 0.5) * 2, y0], [x1 + (R() - 0.5) * 2, y0], [x1 + (R() - 0.5) * 2, y1], [x0 + (R() - 0.5) * 2, y1]];
  g.fillStyle = PROUD_INK; g.fillRect(x1 - 2, y0, PROUD_SIDE, y1 - y0);
  g.save();
  g.beginPath(); poly(g, pts); g.fillStyle = LOG_TONES[3]; g.fill(); g.clip();
  g.fillStyle = hexA(lighten(LOG_TONES[3], 9), 0.95); g.fillRect(x0 - 2, y0, w * 0.36, y1 - y0);
  g.fillStyle = lighten(LOG_TONES[3], -9); g.fillRect(x1 - w * 0.3, y0, w * 0.3 + 2, y1 - y0);
  g.restore();
  g.beginPath(); poly(g, pts); g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.7; g.stroke();
}

/** The end of a log wall is its logs' cut ends, one over another. */
function logEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  const { PASTEL } = kit;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, Wc, TH);
  for (let k = 0; k < LOGS; k++) endGrain(kit, g, Wc / 2, k * LOG_CH + (LOG_CH - CHINK) / 2, Wc * 0.47, (LOG_CH - CHINK) / 2 + 1, R);
}

/** A log wall's ground storey at its end: its logs' ends, on the footing. */
function logEndsFoot(kit: Kit, g: Ctx, R: Rand, Wc: number, y0: number, ends: HTMLCanvasElement): void {
  g.drawImage(ends, 0, 0);
  footing(kit, g, R, y0, TH);
}

/** The end of a low log wall: the cut ends of its logs, one over another, on the footing. */
function logLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number): void {
  const { PASTEL } = kit;
  const sole = fh - LOW_FOOT, n = lowLogCount(fh), ch = sole / n;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, Wc, sole);
  for (let k = 0; k < n; k++) endGrain(kit, g, Wc / 2, k * ch + (ch - CHINK) / 2, Wc * 0.47, (ch - CHINK) / 2 + 1, R);
  footing(kit, g, R, sole, fh);
}

/**
 * A post of round log either side of the way through, the logs of the
 * wall run into it, standing on the footing -- after the gap is cut,
 * and cut to the wall, so the shade it throws falls on the logs and
 * not across the gateway.
 */
function logGate(kit: Kit, g: Ctx, R: Rand, fh: number, gx0: number, gx1: number): void {
  const sole = fh - LOW_FOOT;
  g.save();
  g.beginPath(); g.rect(0, -PROUD, gx0, fh + PROUD); g.rect(gx1, -PROUD, TW - gx1, fh + PROUD); g.clip();
  logPost(kit, g, gx0 - 40, gx0, 0, sole, R);
  logPost(kit, g, gx1, gx1 + 40, 0, sole, R);
  g.restore();
}

function logPostOf(kit: Kit): NonNullable<Masonry['post']> {
  return { img: logCorner(kit, TH, LOGS, true), alt: logCorner(kit, TH, LOGS, false), reach: 28, free: false };
}

function logLowPost(kit: Kit, fh: number): NonNullable<Low['post']> {
  return { img: logCorner(kit, fh - LOW_FOOT, lowLogCount(fh), true), alt: logCorner(kit, fh - LOW_FOOT, lowLogCount(fh), false), foot: LOW_FOOT };
}

/** Log: round logs laid on one another, chinked, their ends crossing at the corners. */
export const LOG_LAY: Lay = {
  courses: (kit, g, R, crests, open, vi) => paintLogs(kit, g, R, open, vi),
  arch: boardArch,
  surround: (kit, g, R, x0, x1, head, sill, wide, shelf) => boardSurround(kit, g, R, x0, x1, head, sill, shelf),
  doorway: boardDoorway,
  foot: logFootingOf,
  cap: flatCap,
  ends: logEnds,
  endsFoot: logEndsFoot,
  lowCourses: (kit, g, R, fh) => lowLogs(kit, g, R, fh),
  lowCap: flatLowCap,
  lowEnds: logLowEnds,
  gateAfter: logGate,
  gateCapPier: stoneCapPier,
  lowPost: logLowPost,
  post: logPostOf,
  under: stoneUnder,
  head: 0,
  wrap: true,
  scatter: true,
  handed: true,
};
