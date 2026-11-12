import { WALL_HEIGHT } from '../../game/building';
import { HEIGHT_SCALE, TILE_H } from '../iso';
import { COPE } from './coping';
import { BAND, CAP_H, EDGE, TH, TW, blob, channels, clamp, cnv, ctxOf, hexA, lighten, poly, rand, shape, softRect } from './draw';
import type { Kit } from './kit';
import { baulk } from './laid';
import { pillowsOf } from './low';
import { A_CX, A_CY, A_R, CORBEL_H, OVER } from './openings';
import type { Block, Ctx, Lay, Masonry, Pt, Rand, Variant } from './types';
import { VARIANTS } from './variants';

/**
 * Adobe: mud brick under a coat of mud. Its field, its openings rolled round in the coat, the
 * places the coat has come away, the beam ends of its floors, its garden wall.
 */

/** A centre for something `r` across that keeps clear of the section's seams. */
const inField = (r: number, R: Rand): number => EDGE + 14 + r + R() * (TW - 2 * (EDGE + 14 + r));

/**
 * The field of a render: a coat of mud laid on by hand over mud brick.
 *
 * Nothing on it is a unit, so what there is to paint is the coat and what
 * the weather has done to it. The coat goes on a trowel's sweep at a time
 * and a day's mix never dries quite the tone of the last, so the field
 * carries a pass or two a step either side of the coat's own tone: wide,
 * flat, crisp at the edge, and never so far off the coat that the eye
 * lands on one before it lands on a beam end or an opening. Then a crack
 * from the drying, on one section in two.
 *
 * All of it keeps well clear of the section's seams, so the coat is its own
 * plain tone at both edges of every section and any section butts any
 * other. Nothing that depends on where the section stands is in it: the
 * beam ends, which only the two walls a floor's joists rest on carry, and
 * the places the coat has come away, which the weather takes at corners,
 * at the foot, under a sill and under the head, and never inside a room,
 * are laid over it by the renderer.
 *
 * `open` is a section an opening will be cut in, which is left to its own
 * cracks off the corners of the opening.
 */
function paintRender(kit: Kit, g: Ctx, R: Rand, open: boolean): Block[] {
  const { PASTEL, S } = kit;
  g.fillStyle = PASTEL.stone;
  g.fillRect(0, 0, TW, TH);
  passes(kit, g, R, BAND + 22, TH - S.plinth - 22);
  if (!open && R() < 0.5) fissure(kit, g, inField(20, R), BAND + 40 + R() * 110, 40 + R() * 60, R);
  return [];
}

/**
 * A trowel's passes: one to three wide swathes a step either side of the
 * coat, each a shallow arc, fat in the middle and thin at its ends, the
 * edge it was pushed along ragged and the other smooth. Wider than they
 * are tall, because an arm sweeps sideways.
 */
function passes(kit: Kit, g: Ctx, R: Rand, top: number, bottom: number): void {
  const { PASTEL } = kit;
  const tones = [lighten(PASTEL.stone, 2.3), lighten(PASTEL.stone, -2.1), lighten(PASTEL.stone, 1.1)];
  const n = 1 + Math.floor(R() * 2.6);
  for (let i = 0; i < n; i++) {
    const w = 150 + R() * 170, h = Math.min(30 + R() * 34, (bottom - top) * 0.6);
    const x0 = EDGE + 20 + R() * Math.max(1, TW - 2 * (EDGE + 20) - w);
    const y0 = top + R() * Math.max(1, bottom - top - h);
    const bow = (R() - 0.5) * h * 1.1, tilt = (R() - 0.5) * h * 0.9;
    const upper: Pt[] = [], lower: Pt[] = [];
    const steps = 14;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, x = x0 + w * t;
      const cy = y0 + h / 2 + Math.sin(Math.PI * t) * bow + (t - 0.5) * tilt;
      const th = (h / 2) * Math.pow(Math.sin(Math.PI * t), 0.55);
      upper.push([x, cy - th + (R() - 0.5) * 6]);
      lower.push([x, cy + th * (0.92 + R() * 0.08)]);
    }
    shape(g, [...upper, ...lower.reverse()]);
    g.fillStyle = tones[i % tones.length];
    g.fill();
  }
}

/** How far over a loss's top edge its picture reaches, for the lit arris of the coat that stands over it. */
const LOSS_LIP = 6;

/**
 * A loss: the coat come away and the brick showing, as a picture for the
 * renderer to lay where the weather would have taken it -- at a corner, out
 * of the foot, under a sill, under the head of the wall -- and never inside
 * a room. Painted into the field of the sections, two losses in five
 * sections were the same two stamps wherever those sections fell, inside
 * and out, and the sections could be counted by them.
 *
 * It is laid out course by course from the top, `runs[i]` the left and
 * right of course `i`, because a coat lets go along the bed joints of the
 * brick under it: what is left is a stair, ragged where it tore. Its
 * courses start on the picture's own line LOSS_LIP down, so laid on one of
 * the wall's course lines they run level with the wall's. It is lit as a
 * hole is lit, from above: the arris of the coat over it catches the light,
 * and its broken edge throws a band of shade down onto the brick.
 */
function lossPicture(kit: Kit, runs: Array<[number, number]>, R: Rand): HTMLCanvasElement {
  const { MUD_CH, PASTEL } = kit;
  const w = Math.max(...runs.map(([, b]) => b)) + 4, h = runs.length * MUD_CH;
  const c = cnv(Math.ceil(w), Math.ceil(h + LOSS_LIP + 2)), g = ctxOf(c);
  g.translate(0, LOSS_LIP);
  const hole = stair(kit, runs, R);
  g.save();
  g.beginPath(); g.rect(-4, -LOSS_LIP, w + 8, h + LOSS_LIP + 6); poly(g, hole); g.clip('evenodd');
  g.beginPath(); poly(g, hole, 0, -2.5); g.fillStyle = hexA(PASTEL.stoneHi, 0.8); g.fill();
  g.restore();
  g.save();
  g.beginPath(); poly(g, hole); g.clip();
  mudBrick(kit, g, -4, -4, w + 4, h + 4, R, 0);
  g.beginPath(); g.rect(-4, -4, w + 8, h + 8); poly(g, hole, 0, 7); g.clip('evenodd');
  g.fillStyle = 'rgba(58, 44, 72, 0.26)'; g.fillRect(-4, -4, w + 8, h + 8);
  g.restore();
  return c;
}

/**
 * The outline of a stack of runs: across the top of the first, down the
 * right ends course by course, back along the bottom of the last and up
 * the left ends -- each corner a hand off true and each riser leaning,
 * and the long edges torn rather than ruled.
 */
function stair(kit: Kit, runs: Array<[number, number]>, R: Rand): Pt[] {
  const { MUD_CH } = kit;
  const j = (k: number): number => (R() - 0.5) * k;
  const edge = (a: number, b: number, y: number): Pt[] => {
    const out: Pt[] = [];
    const n = Math.max(1, Math.floor(Math.abs(b - a) / 22));
    for (let i = 1; i < n; i++) out.push([a + ((b - a) * i) / n + j(6), y + j(3.5)]);
    return out;
  };
  const pts: Pt[] = [];
  const [a0, b0] = runs[0];
  pts.push([a0 + j(3), j(2)], ...edge(a0, b0, 0), [b0 + j(3), j(2)]);
  for (let i = 0; i < runs.length; i++) {
    const y1 = (i + 1) * MUD_CH, b = runs[i][1], nb = i + 1 < runs.length ? runs[i + 1][1] : null;
    pts.push([b + j(5), y1 + j(2)]);
    if (nb !== null) pts.push([nb + j(5), y1 + j(2)]);
  }
  const [al, bl] = runs[runs.length - 1], yb = runs.length * MUD_CH;
  pts.push(...edge(bl, al, yb));
  for (let i = runs.length - 1; i >= 0; i--) {
    const y0 = i * MUD_CH, a = runs[i][0], pa = i > 0 ? runs[i - 1][0] : null;
    pts.push([a + j(5), y0 + MUD_CH + j(2)]);
    if (pa !== null) pts.push([a + j(5), y0 + j(2)]);
  }
  return pts;
}

/**
 * The mud brick where the coat is off: courses of it on the storey's own
 * lines in a half lap, each brick a flat tone a step either side of the
 * brick's own and the joint a step under that -- and no more, because the
 * brick is the same earth as the coat and the joints are mud too.
 */
function mudBrick(kit: Kit, g: Ctx, x0: number, y0: number, x1: number, y1: number, R: Rand, from = BAND): void {
  const { MUD_CH, S, PASTEL, MORTAR } = kit;
  const ch = MUD_CH, uw = TW / S.across;
  g.fillStyle = PASTEL.joint;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const tones = [PASTEL.mud, PASTEL.mudHi, PASTEL.mudShade, PASTEL.mud];
  for (let i = Math.floor((y0 - from) / ch) - 1; i <= Math.ceil((y1 - from) / ch); i++) {
    const cy0 = from + i * ch;
    const lap = (((i % 2) + 2) % 2) * 0.5;
    for (let k = Math.floor(x0 / uw) - 1; k <= Math.ceil(x1 / uw); k++) {
      const x = (k + lap) * uw;
      if (x > x1 || x + uw < x0) continue;
      const pts = blob(x + uw / 2, cy0 + ch / 2 + (R() - 0.5) * 1.5, uw / 2 - MORTAR / 2 - 0.5, ch / 2 - MORTAR / 2 - 0.5, 14, R, 0.3, 0.22, 0.03);
      shape(g, pts);
      g.fillStyle = tones[Math.floor(R() * tones.length)];
      g.fill();
    }
  }
}

/** A crack from the drying: a thin line that wanders down, and a short fork off it. */
function fissure(kit: Kit, g: Ctx, x: number, y: number, len: number, R: Rand, dir = 1): void {
  const { PASTEL } = kit;
  g.strokeStyle = hexA(PASTEL.line, 0.6);
  g.lineWidth = 1.3;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const steps = 5 + Math.floor(R() * 3);
  let cx = x, cy = y;
  g.beginPath(); g.moveTo(cx, cy);
  let fork: Pt | null = null;
  for (let i = 0; i < steps; i++) {
    cx += (R() - 0.5) * 11 + (dir < 0 ? 2.5 * Math.sign(x - TW / 2) : 0); cy += (dir * len) / steps;
    g.lineTo(cx, cy);
    if (i === 2 && R() < 0.65) fork = [cx, cy];
  }
  g.stroke();
  if (fork) {
    g.beginPath(); g.moveTo(fork[0], fork[1]);
    const d = R() < 0.5 ? -1 : 1;
    g.lineTo(fork[0] + d * (8 + R() * 8), fork[1] + dir * (8 + R() * 6));
    g.lineTo(fork[0] + d * (14 + R() * 10), fork[1] + dir * (18 + R() * 8));
    g.lineWidth = 1; g.stroke();
  }
}

/* ---- the beam ends ------------------------------------------------------ */
/**
 * A beam end: where the log goes into the wall, how thick it is, how far it
 * stands out in tiles and how much it droops doing it, how long a streak
 * the rain has left under it, and whether the drip off it has taken the
 * coat at the foot of the streak.
 */
interface Viga { x: number; y: number; r: number; d: number; droop: number; streak: number; drip: boolean; seed: number }

/** How deep, from the head of a storey down, the beam ends and their streaks are painted; and their shade. */
const VIGA_H = 300, VIGA_SH = 100;

/**
 * Where a variant's beams go into the wall.
 *
 * Four to a section at one pitch, a metre apart -- the span the boards
 * laid across them will take -- and half a metre in from each seam, so a
 * floor runs along a street at that pitch through every join. Shifted
 * about or left out, a gap across a join was two metres and the sections
 * could be counted by it. The hand shows in the logs instead of in where
 * they are: each a little thicker or thinner than the next, standing out
 * further or less and drooping a little as it does, one in seven sawn off
 * nearly flush.
 */
function vigaRow(v: Variant): Viga[] {
  const R = rand(v.seed * 613 + 29);
  const out: Viga[] = [];
  for (let k = 0; k < 4; k++) {
    const x = (k + 0.5) * (TW / 4) + (R() - 0.5) * 6;
    const r = 16 * (0.87 + R() * 0.26);
    const d = R() < 0.14 ? 0.015 + R() * 0.012 : 0.04 + R() * 0.035;
    const droop = 0.8 + R() * 0.45;
    const streak = R() < 0.5 ? 70 + R() * 160 : 0;
    out.push({ x, y: 24, r, d, droop, streak, drip: !!streak && R() < 0.3, seed: v.seed * 17 + k });
  }
  return out;
}

/**
 * The row's logs, and the rain off them, for a face whose outward direction
 * runs (ax, ay) picture pixels to a tile. On a face seen from a diagonal
 * that is mostly sideways: the end of a log a foot out of the wall stands
 * well to one side of where it goes in, and not far below it.
 */
function vigaLogs(kit: Kit, row: Viga[], ax: number, ay: number, drips: HTMLCanvasElement[]): HTMLCanvasElement {
  const { PASTEL, MUD_CH } = kit;
  const c = cnv(TW, VIGA_H), g = ctxOf(c);
  // The rain down the coat under each, darker where it runs and fading as
  // it dries, with an edge that wanders because water does not run down a
  // wall in a ruled line.
  for (const s of row) {
    if (!s.streak) continue;
    const R = rand(s.seed * 7 + 1);
    const w = 8 + R() * 10, y0 = s.y + s.r * 0.5, len = s.streak;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, hexA(PASTEL.stoneDark, 0.17 + R() * 0.07));
    gr.addColorStop(1, hexA(PASTEL.stoneDark, 0));
    g.fillStyle = gr;
    g.beginPath();
    const steps = 8;
    for (let i = 0; i <= steps; i++) { const t = i / steps; g.lineTo(s.x - w / 2 - t * 3 + (R() - 0.5) * 3, y0 + len * t); }
    for (let i = steps; i >= 0; i--) { const t = i / steps; g.lineTo(s.x + w / 2 + t * 2 + (R() - 0.5) * 3, y0 + len * t); }
    g.closePath();
    g.fill();
    // Where the drip has fallen on the same place for years, the coat has
    // gone at the foot of the streak -- laid on a course line, as every
    // loss is, so its brick runs with the wall's.
    if (s.drip) {
      const p = drips[s.seed % drips.length];
      const line = BAND + Math.round((y0 + len * 0.8 - BAND) / MUD_CH) * MUD_CH;
      g.drawImage(p, Math.round(s.x - p.width / 2), line - LOSS_LIP);
    }
  }
  for (const s of row) log(kit, g, s, ax * s.d, ay * s.d * s.droop);
  return c;
}

/**
 * One log: the mud packed round it where it goes into the wall, its side
 * from there to its end -- lit along the top and dark along the underside,
 * as anything round is under a sky -- and the end itself, the end grain
 * paler than the side, with the darker rim where the bark was, a ring or
 * two, and the check every log end opens once it has dried. (ox, oy) is
 * where the end stands in the picture from where the log goes in.
 */
function log(kit: Kit, g: Ctx, s: Viga, ox: number, oy: number): void {
  const { PASTEL } = kit;
  const R = rand(s.seed);
  const ex = s.x, ey = s.y, fx = ex + ox, fy = ey + oy, r = s.r;
  g.beginPath(); g.ellipse(ex, ey, r + 3.5, r + 3, 0, 0, Math.PI * 2);
  g.fillStyle = hexA(PASTEL.stoneShade, 0.5); g.fill();
  g.lineCap = 'round';
  for (const [w, lift, col] of [[2 * r, 0, PASTEL.vigaShade], [1.48 * r, r * 0.2, PASTEL.viga], [0.6 * r, r * 0.56, PASTEL.vigaHi]] as Array<[number, number, string]>) {
    g.beginPath(); g.moveTo(ex, ey - lift); g.lineTo(fx, fy - lift);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  g.lineCap = 'butt';
  const tilt = (R() - 0.5) * 0.3, ry = r * 0.97, rim = 2.4;
  g.beginPath(); g.ellipse(fx, fy, r, ry, tilt, 0, Math.PI * 2);
  g.fillStyle = PASTEL.vigaRing; g.fill();
  g.save();
  g.beginPath(); g.ellipse(fx, fy, r - rim, ry - rim, tilt, 0, Math.PI * 2); g.clip();
  g.fillStyle = PASTEL.vigaEnd; g.fillRect(fx - r, fy - r, 2 * r, 2 * r);
  // Its lower edge, turned from the sky.
  g.beginPath(); g.rect(fx - r, fy - r, 2 * r, 2 * r); g.ellipse(fx, fy - 3.5, r - rim, ry - rim, tilt, 0, Math.PI * 2);
  g.fillStyle = 'rgba(70, 52, 62, 0.22)'; g.fill('evenodd');
  g.strokeStyle = hexA(PASTEL.vigaRing, 0.45); g.lineWidth = 1;
  for (const f of [0.55, 0.28]) { g.beginPath(); g.ellipse(fx - 0.5, fy - 0.5, r * f, ry * f, R() * 3, 0, Math.PI * 2); g.stroke(); }
  const a = R() * Math.PI * 2;
  g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * r * 0.8, fy + Math.sin(a) * ry * 0.8);
  g.strokeStyle = hexA(PASTEL.vigaRing, 0.75); g.lineWidth = 1.3; g.stroke();
  g.restore();
}

/**
 * The shade the row throws on a face that has the sun on it: from where
 * each log goes in, down and to the right, as long as the log stands out.
 * A face already in shade takes none of it, which is the renderer's to say.
 */
function vigaShade(row: Viga[]): HTMLCanvasElement {
  const c = cnv(TW, VIGA_SH), g = ctxOf(c);
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(46, 34, 62, 0.3)';
  for (const s of row) {
    g.beginPath(); g.moveTo(s.x + 2, s.y + 3); g.lineTo(s.x + 2 + 256 * s.d, s.y + 3 + 460 * s.d);
    g.lineWidth = 1.84 * s.r; g.stroke();
  }
  g.lineCap = 'butt';
  return c;
}

/**
 * The foot of a mud wall, where the rain that splashes off the ground has
 * eaten the coat back.
 *
 * A band `h` px deep at the seams, its top edge a run of shallow scoops,
 * each an arch the splash has eaten up into the coat and each overlapping
 * the next, some a good deal higher than others -- not a wave, whose humps
 * came out all alike, and not a stair of flat flakes, which read as paper
 * torn along a rule. The coat thins to a feathered lip over it, a step
 * between the two tones rather than a line drawn round. The bottom third,
 * where it never dries, is a step darker again, and in a place or two the
 * coat has gone from the band entirely and the courses of the brick show.
 * The edge comes in at `h` at both ends, so the foot runs along a street
 * without a step at the seams.
 */
function erosionOf(kit: Kit, g: Ctx, R: Rand, h: number, bottom: number): void {
  const { PASTEL, MUD_CH } = kit;
  const scoops: Array<{ c: number; w: number; top: number }> = [];
  for (let x = -30; x < TW + 30;) {
    const w = 44 + R() * 76;
    scoops.push({ c: x + w / 2, w, top: h * (0.72 + R() * 0.55) });
    x += w * (0.5 + R() * 0.3);
  }
  const reach = (x: number): number => {
    let best = h * 0.6;
    for (const s of scoops) {
      const u = (x - s.c) / (s.w / 2);
      if (Math.abs(u) < 1) best = Math.max(best, s.top * (0.8 + 0.2 * Math.sqrt(1 - u * u)));
    }
    const e = Math.min(1, Math.min(x, TW - x) / 56);
    return h + (best - h) * e;
  };
  const pts: Pt[] = [];
  for (let x = 0; x <= TW; x += 4) pts.push([x, bottom - reach(x)]);
  const zone = (dy: number): void => {
    g.moveTo(-2, bottom + 4);
    for (const [px, py] of pts) g.lineTo(px, py + dy);
    g.lineTo(TW + 2, bottom + 4);
    g.closePath();
  };
  g.save();
  g.beginPath(); zone(0);
  g.fillStyle = PASTEL.erode; g.fill();
  g.clip();
  // Where the coat is gone from the band altogether: a course or two of brick.
  for (let i = 0; i < (R() < 0.6 ? 1 : 2); i++) {
    const w = 60 + R() * 70, x0 = EDGE + 20 + R() * (TW - 2 * EDGE - 40 - w);
    const n = h > 50 ? 2 : 1, y0 = bottom - n * MUD_CH - 4 - R() * 6;
    const runs: Array<[number, number]> = [];
    for (let k = 0; k < n; k++) runs.push([x0 + R() * 16, x0 + w - R() * 16]);
    g.save();
    g.translate(0, y0);
    g.beginPath(); poly(g, stair(kit, runs, R)); g.clip();
    mudBrick(kit, g, x0 - 8, -4, x0 + w + 8, n * MUD_CH + 4, R, 0);
    g.restore();
  }
  // Where it never dries: the bottom third, a step darker, its top edge as ragged as damp is.
  g.beginPath(); g.moveTo(-2, bottom + 4);
  for (let x = 0; x <= TW; x += 8) g.lineTo(x, bottom - h * 0.34 + Math.sin(x * 0.05 + R()) * 1.6);
  g.lineTo(TW + 2, bottom + 4); g.closePath();
  g.fillStyle = hexA(PASTEL.damp, 0.34); g.fill();
  // The coat's lip, feathered: a band between its tone and the foot's.
  g.beginPath(); g.rect(-4, bottom - h * 2 - 20, TW + 8, h * 2 + 30); zone(4); g.clip('evenodd');
  g.fillStyle = hexA(PASTEL.stone, 0.5); g.fillRect(-4, bottom - h * 2 - 20, TW + 8, h * 2 + 30);
  g.restore();
}

/**
 * Sill, jambs, lintel and the wedges over it, in the order they went up.
 *
 * `shelf` is how far the sill stands proud and how deep it is. A window's
 * is a sill and a bay's is a shelf, because a bay is a box of glass standing
 * on it, and a stone that is only a sill under a bay is a stone that comes
 * out of the wall one winter with the bay on top of it.
 */
/**
 * The edge of an opening in a coat of mud, which is not an edge: the coat
 * is rolled into the hole by the hand that laid it, so round every opening
 * there is an arris that turns up toward the sky along the sill and down
 * away from it along the head. The hole's own outline, pushed down, lies
 * outside it along the bottom -- the lit side -- and pushed up, along the
 * top, in the shade. Up and down only: a picture laid the other way round
 * on the far face of a corner is still lit from above.
 */
function rollRim(kit: Kit, g: Ctx, hole: (c: Ctx) => void): void {
  const { PASTEL } = kit;
  g.save();
  g.beginPath(); g.rect(-60, -60, TW + 120, TH + 120); hole(g); g.clip('evenodd');
  g.save(); g.translate(0, 6); g.beginPath(); hole(g); g.fillStyle = hexA(PASTEL.stoneHi, 0.9); g.fill(); g.restore();
  g.save(); g.translate(0, -6); g.beginPath(); hole(g); g.fillStyle = hexA(PASTEL.stoneShade, 0.8); g.fill(); g.restore();
  g.restore();
}

/** The shade a board throws on the coat under it, cool, as every shadow here is. */
function shadeUnder(g: Ctx, x0: number, x1: number, y: number, deep: number): void {
  const sh = g.createLinearGradient(0, y, 0, y + deep);
  sh.addColorStop(0, 'rgba(46, 34, 62, 0.4)');
  sh.addColorStop(1, 'rgba(46, 34, 62, 0)');
  g.fillStyle = sh;
  g.fillRect(x0 + 3, y, x1 - x0 - 6, deep);
}

/**
 * A window in a coat of mud: the coat rolled into it, a length of timber
 * over it run well into the wall either side, and a board under it for a
 * sill. And where the wall has moved, a crack from each end of the lintel,
 * because that is where an adobe wall always cracks first.
 */
function renderSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, shelf: number): void {
  rollRim(kit, g, (c) => softRect(c, x0, head, x1 - x0, sill - head, 7));
  baulk(kit, g, R, x0 - 28, x1 + 28, head - 22, 22);
  shadeUnder(g, x0 - 28, x1 + 28, head, 7);
  baulk(kit, g, R, x0 - 14 - shelf, x1 + 14 + shelf, sill - 3, 11 + shelf * 0.6);
  shadeUnder(g, x0 - 14 - shelf, x1 + 14 + shelf, sill + 8 + shelf * 0.6, 10);
  if (R() < 0.7) fissure(kit, g, x1 + 24, head - 22, 26 + R() * 30, R, -1);
  if (R() < 0.45) fissure(kit, g, x0 - 24, head - 22, 20 + R() * 26, R, -1);
  if (R() < 0.5) fissure(kit, g, x0 - 8 + R() * 16, sill + 12 + shelf, 26 + R() * 30, R);
}

/**
 * A doorway in it: the same, with the lintel over the way in. A gate is the
 * doorway twice as wide, and its lintel sits on a short timber on each
 * jamb -- the corbel a stone gate has, in wood.
 */
function renderDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number, reach: number): void {
  rollRim(kit, g, (c) => softRect(c, x0, head, x1 - x0, TH - head + 30, 7));
  const bTop = head - (reach ? CORBEL_H : 0) - deep + 3;
  if (reach) {
    for (const side of [-1, 1]) {
      const a = side < 0 ? x0 - 14 : x1 - reach + 2;
      baulk(kit, g, R, a, a + reach + 12, head - CORBEL_H, CORBEL_H);
    }
  }
  baulk(kit, g, R, x0 - 28 + reach * 0.8, x1 + 28 - reach * 0.8, bTop, deep);
  shadeUnder(g, x0 - 28 + reach * 0.8, x1 + 28 - reach * 0.8, bTop + deep, 8);
  if (R() < 0.7) fissure(kit, g, x1 + 24 - reach * 0.8, bTop, 24 + R() * 30, R, -1);
  if (R() < 0.45) fissure(kit, g, x0 - 24 + reach * 0.8, bTop, 20 + R() * 26, R, -1);
}

/** An archway in it: the coat rolled round the curve, and a crack off the crown. */
function renderArch(kit: Kit, g: Ctx, R: Rand): void {
  rollRim(kit, g, (c) => {
    c.moveTo(A_CX - A_R, TH + 30);
    c.lineTo(A_CX - A_R, A_CY);
    c.arc(A_CX, A_CY, A_R, Math.PI, Math.PI * 2);
    c.lineTo(A_CX + A_R, TH + 30);
    c.closePath();
  });
  if (R() < 0.7) fissure(kit, g, A_CX + (R() - 0.5) * A_R * 0.8, A_CY - A_R - 4, 26 + R() * 24, R, -1);
}

/**
 * A garden wall of mud: the same coat, a pass or two of the trowel on it,
 * and a foot the splash has eaten -- which on a wall a metre and a quarter
 * high is a good part of it. Where its coat has come away is the
 * renderer's to lay, as it is on a house.
 */
function lowRender(kit: Kit, g: Ctx, R: Rand, fh: number): Block[] {
  const { PASTEL } = kit;
  g.fillStyle = PASTEL.stone;
  g.fillRect(0, COPE - 6, TW, fh - COPE + 12);
  passes(kit, g, R, COPE + 12, fh - 36);
  if (R() < 0.4) fissure(kit, g, inField(20, R), COPE + 10, 26 + R() * 30, R);
  erosionOf(kit, g, R, Math.min(38, (fh - COPE) * 0.35), fh);
  return [];
}

/**
 * The cap of a mud garden wall: not a coping of anything, but the coat
 * itself laid thick over the top and rounded off by hand, a pillow at a
 * time. What is painted here is its front, rolled down from the head of
 * the wall to a lip that throws a shade on the face under it: pale where
 * it turns up to the sky, a crease where one armful was pressed onto the
 * last. The humps of the pillows rise over the head itself, and the renderer
 * cuts them into the top edge of the wall, where they are its outline.
 */
function renderCope(kit: Kit, g: Ctx, seed: number): void {
  const { TONES, PASTEL } = kit;
  const p = pillowsOf(seed);
  const R = rand(seed + 23);
  const taper = (x: number): number => Math.min(1, Math.min(x, TW - x) / 40);
  const a = R() * 6, b = R() * 6;
  const lip = (x: number): number => COPE + 1 + (Math.sin(x * 0.037 + a) * 1.4 + Math.sin(x * 0.091 + b) * 0.9) * taper(x);
  const path = (): void => {
    g.beginPath(); g.moveTo(0, 0); g.lineTo(TW, 0);
    for (let x = TW; x >= 0; x -= 4) g.lineTo(x, lip(x));
    g.closePath();
  };
  const sh = g.createLinearGradient(0, COPE, 0, COPE + 12);
  sh.addColorStop(0, 'rgba(46, 34, 62, 0.4)'); sh.addColorStop(1, 'rgba(46, 34, 62, 0)');
  g.fillStyle = sh; g.fillRect(0, COPE, TW, 12);
  path(); g.fillStyle = TONES.top.lit; g.fill();
  g.save(); path(); g.clip();
  const under = g.createLinearGradient(0, COPE * 0.45, 0, COPE + 3);
  under.addColorStop(0, hexA(PASTEL.stoneShade, 0)); under.addColorStop(1, hexA(PASTEL.stoneShade, 0.75));
  g.fillStyle = under; g.fillRect(0, 0, TW, COPE + 4);
  // Where one armful was pressed onto the last: a crease down the roll.
  g.strokeStyle = hexA(PASTEL.stoneShade, 0.55); g.lineWidth = 2.2; g.lineCap = 'round';
  for (const x of p.joints.slice(1, -1)) {
    const lean = (R() - 0.5) * 6;
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + lean, COPE * 0.5, x + lean * 0.4, lip(x) - 2); g.stroke();
  }
  g.lineCap = 'butt';
  g.restore();
  if (R() < 0.6) fissure(kit, g, inField(10, R), 6, 10 + R() * 12, R);
}

/**
 * The top of a wall that is one flat tone turned up at the sky: a mud
 * coat, a step paler for it (plain: one picture over every section, its
 * cracks were a mark repeating every four metres down the run); the
 * topmost log, or the head band, which the renderer lays flat.
 */
export function flatCap(kit: Kit, g: Ctx): void {
  const { TONES } = kit;
  g.fillStyle = TONES.top.lit; g.fillRect(0, 0, TW, CAP_H);
}

/**
 * The end of a mud wall is the coat come round the corner; the roll of
 * it round the arris is the renderer's, in the light of both faces.
 */
function renderEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  const { PASTEL } = kit;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, Wc, TH);
  g.fillStyle = hexA(PASTEL.stoneHi, 0.5); g.fillRect(0, 0, Wc, 6);
}

/** A low wall's cap seen from above that is one pale band: a mud cap, with nothing in it to count; a log's, a plank's, silver's. */
export function flatLowCap(kit: Kit, g: Ctx): void {
  const { TONES } = kit;
  g.fillStyle = TONES.top.lit; g.fillRect(0, -2, TW, CAP_H + 2);
}

/** The end of a low mud wall: the coat come round the end of it, under the cap's paler band. */
function renderLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number): void {
  const { PASTEL, TONES } = kit;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, Wc, fh);
  g.fillStyle = TONES.top.lit; g.fillRect(0, 0, Wc, COPE + 1);
  g.fillStyle = 'rgba(46, 34, 62, 0.3)'; g.fillRect(0, COPE + 1, Wc, 4);
}

/**
 * A pier of the same mud as the wall and in the same coat, built up
 * a hand higher than the wall it interrupts and domed over -- the
 * dome is the renderer's, cut into the head of the wall -- its coat
 * rolled round its arrises, its foot eaten as the wall's is, and a
 * shade thrown down the wall on its field side, because it stands
 * out of it. Cream and square, it was a planed post.
 */
function renderPier(kit: Kit, g: Ctx, R: Rand, side: number, line: number, fh: number): void {
  const { PASTEL, TONES } = kit;
  const x = side < 0 ? line + OVER - 52 : line - OVER, w = 52;
  g.beginPath(); softRect(g, x, 0, w, fh + 6, 6);
  g.fillStyle = PASTEL.stone; g.fill();
  g.save(); g.clip();
  g.fillStyle = hexA(PASTEL.stoneHi, 0.45); g.fillRect(x, 0, 6, fh);
  g.fillStyle = hexA(PASTEL.stoneShade, 0.5); g.fillRect(x + w - 7, 0, 7, fh);
  const head = g.createLinearGradient(0, 0, 0, 16);
  head.addColorStop(0, TONES.top.lit); head.addColorStop(1, hexA(TONES.top.lit, 0));
  g.fillStyle = head; g.fillRect(x, 0, w, 16);
  erosionOf(kit, g, R, Math.min(34, fh * 0.3), fh);
  g.restore();
  g.fillStyle = 'rgba(46, 34, 62, 0.26)';
  g.fillRect(side < 0 ? x - 4 : x + w, 0, 4, fh);
}

/** The top of a mud pier, rounded over and paler for facing the sky. */
function renderCapPier(kit: Kit, g: Ctx, R: Rand, x: number): void {
  const { TONES, PASTEL } = kit;
  g.beginPath(); softRect(g, x, 2, 52, CAP_H - 4, 12);
  g.fillStyle = lighten(TONES.top.lit, 3); g.fill();
  g.strokeStyle = hexA(PASTEL.line, 0.4); g.lineWidth = 1; g.stroke();
}

/** Under a coat of mud or a log wall, the coat's own stone. */
export function stoneUnder(kit: Kit): [number, number, number] { const { PASTEL } = kit; return channels(PASTEL.stone); }

/** How many lengths a head's rise is given in, along a section. */
const CREST_N = 16;

/**
 * How far the head of a wall that nothing stands on rises over the line, by
 * variant, in picture pixels at CREST_N + 1 points along the section: a
 * hump or two where the last armfuls of mud were heaped and smoothed off,
 * as much as fourteen pixels, which is two or three on screen, and nothing
 * at either end, so a head runs on into the next section's. A mud wall
 * laid to a line was a box with a lid on it.
 */
function renderCrest(kit: Kit): number[][] {
  return VARIANTS.map((v) => {
    const R = rand(v.seed * 131 + 71);
    const humps = Array.from({ length: 1 + Math.floor(R() * 2.4) }, () => ({ c: 0.18 + R() * 0.64, w: 0.16 + R() * 0.24, a: 4 + R() * 10 }));
    return Array.from({ length: CREST_N + 1 }, (_, i) => {
      const x = i / CREST_N, taper = Math.min(1, x / 0.1, (1 - x) / 0.1);
      let r = 0;
      for (const h of humps) { const u = (x - h.c) / h.w; if (Math.abs(u) < 1) r += h.a * (1 - u * u) ** 2; }
      return r * taper;
    });
  });
}

/**
 * The head of a wall that nothing stands on: the coat laid over the top and
 * rounded off by the hand that laid it, a roll of it paler for turning up
 * toward the sky, its lower edge wandering as a hand's does. The face
 * turns into the top through it rather than meeting it on a ruled line. It
 * comes in at one depth at both ends, so any section's meets any other's.
 */
const BROW_H = 24;

function renderBrow(kit: Kit): HTMLCanvasElement[] {
  const { TONES, PASTEL } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, BROW_H), g = ctxOf(c), R = rand(v.seed * 5 + 3);
    const a = R() * 6, b = R() * 6, cc = R() * 6;
    const edge = (x: number): number => {
      const e = Math.min(1, Math.min(x, TW - x) / 48);
      return 12 + (Math.sin(x * 0.029 + a) * 2.4 + Math.sin(x * 0.083 + b) * 1.5 + Math.sin(x * 0.21 + cc) * 0.8) * e;
    };
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= TW; x += 6) g.lineTo(x, edge(x));
    g.lineTo(TW, 0); g.closePath();
    const roll = g.createLinearGradient(0, 0, 0, 16);
    roll.addColorStop(0, TONES.top.lit); roll.addColorStop(1, lighten(PASTEL.stone, 3));
    g.fillStyle = roll; g.fill();
    return c;
  });
}

/**
 * The beam ends of the floor over a storey, per variant, for a wall the
 * joists rest on: the logs painted for each way they can stand off a face
 * at the camera's angles, and the shade the row throws.
 *
 * Where a log's end stands in the picture, per tile it stands out of the
 * wall: the picture's rows run down the screen, so what comes off a face
 * comes down the screen by the projection's drop for a tile -- its whole
 * depth at a diagonal, that over the root of two when the view is square
 * on -- and at a diagonal it also comes a whole tile back along the face.
 * The face round the corner has its picture laid mirrored, which puts its
 * logs the right way for it without a second set.
 */
/**
 * The places the coat has come away, for the renderer to lay where the
 * weather would have taken it, each a stack of courses from the top:
 *
 * `corner` off an arris, three to five courses deep, each course back from
 * the corner by a different length -- painted with the corner on the
 * right; `foot` a mound out of the eroded foot, widest at the bottom, with
 * two courses more under it for the foot to cover; `sill` two courses
 * under the end of a sill board, where the water off it runs; `head` a
 * long course or two just under the head, where the rain comes over it,
 * the top straight along a joint.
 */
function renderLosses(kit: Kit): NonNullable<Masonry['losses']> {
  const { S, MUD_CH } = kit;
  return (() => {
    const R = rand(4127);
    const uq = TW / S.across / 4;
    // A coat that lets go along the joints stops at a brick's end more often than not.
    const q = (x: number): number => Math.round(x / uq) * uq + (R() - 0.5) * 8;
    const corner = [0, 1, 2, 3].map(() => {
      const n = 3 + Math.floor(R() * 3), w = 120;
      const runs: Array<[number, number]> = [];
      let d = 34 + R() * 40;
      for (let i = 0; i < n; i++) {
        d = clamp(d + (R() - 0.45) * 56, 26, w - 10);
        runs.push([w - q(d), w + 4]);
      }
      return lossPicture(kit, runs, R);
    });
    /*
     * Each course of a loss is let go at each end by its own amount: a stack
     * that grows the same on both sides course by course was a ziggurat, and
     * a small one a cross, stamped on the wall.
     */
    const grow = (a: number, b: number, lo: number, hi: number): [number, number] =>
      [clamp(q(a - (R() - 0.3) * 34), lo, b - 30), clamp(q(b + (R() - 0.3) * 34), a + 30, hi)];
    const foot = [0, 1, 2, 3].map(() => {
      const n = 2 + Math.floor(R() * 2), w = 150 + R() * 40;
      const runs: Array<[number, number]> = [];
      let [a, b] = [q(w * (0.15 + R() * 0.35)), 0];
      b = q(a + 30 + R() * 40);
      for (let i = 0; i < n + 2; i++) {
        runs.push([a, b]);
        [a, b] = grow(a, b, 2, w - 2);
      }
      return lossPicture(kit, runs, R);
    });
    const sill = [0, 1, 2].map(() => {
      // Under the end of the board, the lower course carried off to one side by the water's run.
      const w = 90 + R() * 30, a = q(8 + R() * 16), b = q(a + 50 + R() * 26);
      const side = R() < 0.5;
      return lossPicture(kit, [[a, b], side ? [q(a + 18 + R() * 16), q(b + 6 + R() * 14)] : [q(a - 6 - R() * 10), q(b - 18 - R() * 16)]].map(([x, y]) => [clamp(x, 2, w - 32), clamp(y, x + 26, w - 2)] as [number, number]), R);
    });
    const head = [0, 1, 2].map(() => {
      const w = 170 + R() * 80;
      const runs: Array<[number, number]> = [[4, w - 4]];
      if (R() < 0.7) {
        const a = q(10 + R() * (w * 0.5)), b = q(a + 40 + R() * (w * 0.35));
        runs.push([a, Math.min(w - 4, b)]);
      }
      return lossPicture(kit, runs, R);
    });
    return { corner, foot, sill, head, lip: LOSS_LIP, ch: MUD_CH, from: BAND };
  })();
}

const perPx = TH / (WALL_HEIGHT * HEIGHT_SCALE);

function renderVigas(kit: Kit, losses: NonNullable<Masonry['losses']>): NonNullable<Masonry['vigas']> {
  return (() => {
    const rows = VARIANTS.map(vigaRow);
    return {
      iso: rows.map((r) => vigaLogs(kit, r, -TW, TILE_H * perPx, losses.sill)),
      square: rows.map((r) => vigaLogs(kit, r, 0, (TILE_H / Math.SQRT2) * perPx, losses.sill)),
      shade: rows.map(vigaShade),
      h: VIGA_H,
      sh: VIGA_SH,
    };
  })();
}

/** Adobe: mud brick under a coat of mud. */
export const RENDER_LAY: Lay = {
  courses: (kit, g, R, crests, open) => paintRender(kit, g, R, open),
  arch: renderArch,
  surround: (kit, g, R, x0, x1, head, sill, wide, shelf) => renderSurround(kit, g, R, x0, x1, head, sill, shelf),
  doorway: renderDoorway,
  foot: (kit, g, R) => erosionOf(kit, g, R, kit.S.plinth, TH),
  cap: flatCap,
  ends: renderEnds,
  coping: renderCope,
  lowCourses: (kit, g, R, fh) => lowRender(kit, g, R, fh),
  lowCap: flatLowCap,
  lowEnds: renderLowEnds,
  gatePier: renderPier,
  gateCapPier: renderCapPier,
  under: stoneUnder,
  crest: renderCrest,
  brow: renderBrow,
  losses: renderLosses,
  vigas: renderVigas,
  head: BAND,
  soft: true,
  wrap: true,
  scatter: true,
};
