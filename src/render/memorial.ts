import type { Side } from '../game/building';
import { rand } from './ivy';
import {
  add, aboveGround, area2, at, bakeGlow, boulder, canvasOf, css, cut, dot, drawFaces, drawGlows, drawPads, eyeOf, flowerClump,
  grassTuft, groundNear, hex, inset, mix, mul, newell, plate, proj, scaleFor, stoneSkin, strokesPath, TAU,
  toneOf, GLYPHS, type MossPalette, type Ctx, type Eye, type Face, type Glow, type Pad, type Painter, type Pt, type Stroke, type Thing, type Tone, type V3,
} from './runestone';

/**
 * A memorial stone (`game/memorial.ts`): a small carved stone a player sets
 * up and cuts a line of their own words into, cut by the same hands as the
 * five Runestones on the shore.
 *
 * It is built as a Runestone is (`runestone.ts`), out of that file's own kit:
 * a model of faceted solids in tenths of a metre -- across it, toward its
 * carved front, and up -- put on the screen through the camera's turn, so it
 * stands right at all eight viewpoints and from behind shows its back. A
 * headstone with a pointed, rounded head and a shoulder knocked off it,
 * leaning a little, chamfered and thinning as it rises (`plate`), bedded in
 * two hand-laid courses of stone on a patch of turf, with a mossy rock or two
 * at its back and flowers at its foot. Its face is the stones' face: their
 * skin (`stoneSkin`), lichen, moss up from the foot on one side and over the
 * shoulder, and ivy climbing that edge; a carved roundel at its head with a
 * star in it and a rune either side, lit pale gold and breathing as a
 * Runestone's runes do; and under them a sunk panel, ruled twice round, with
 * the line cut into it as rows of small rune-marks -- one mark to every two
 * letters of a word, so a short line is a short row and every stone's rows
 * are its own words' -- that catch the runes' light faintly after dark.
 *
 * Baked once for each way it is seen, each facing, each scale and each line,
 * and kept; a frame after that is a blit and the runes' light over it
 * (`drawGlows`). After dark its runes and its cut line take the night off
 * themselves, kept off whatever stands in front of them (`RunestoneNight.glows`),
 * and it throws a small pool of pale gold on the ground at its foot
 * (`memorialLight`).
 */

/** Which way a carved front faces as a heading: its width runs at this angle from east (`eyeOf`). */
const FACING_YAW: Record<Side, number> = { s: 0, e: -Math.PI / 2, n: Math.PI, w: Math.PI / 2 };
/**
 * And how far off that it was set: an eighth of a half turn, halfway between
 * two of the eight viewpoints, as the Runestones are -- so no viewpoint sees
 * it edge on, and it stands as a stone set by hand does, not ruled square.
 */
const SET_ASKEW = -Math.PI / 8;

/* ---- the stone ----------------------------------------------------------------- */

/** The stone's colour, the stones' own cream a step cooler, and the plinth's rougher rock under it. */
const STONE: Tone = toneOf('#f1e6d2', '#b2a4a8');
const ROCK: Tone = toneOf('#ddd2c0', '#a2979f');
const DRESSED: Tone = toneOf('#e9dfcc', '#a99da5');

/** How high the two courses stand, and where the stone stands on them: sunk a little into the upper. */
const LOWER_H = 1.7;
const UPPER_H = 1.25;
const FOOT = LOWER_H + UPPER_H - 0.02;
/** Its thickness through, at the foot and the top, and how far it leans across and back per unit up. */
const DEPTH: [number, number] = [4.2, 3.4];
const LEAN: [number, number] = [0.022, -0.012];
const SEED = 41;
/** The ink round every solid, in pixels at zoom one: a Runestone's, a little finer for a stone this size. */
const INK = 0.75;

/**
 * Its outline, across and up from the middle of its foot: sides tapering a
 * little and not quite straight, the left shoulder a step higher, a chip
 * knocked out of the right one, and a head rounded up to a blunt point,
 * walked round with a hand's wobble rather than a compass.
 */
const OUTLINE: Pt[] = (() => {
  const R = rand(SEED * 7 + 3);
  const w = (n: number): number => (R() - 0.5) * n;
  // Each side one straight cut from foot to shoulder: an edge that turns at every few units reads as courses, not one stone.
  const out: Pt[] = [[-4.45, 0], [4.45, 0], [4.08, 10.1],
    // The chip off its right shoulder.
    [3.9, 10.55], [3.35, 10.7], [3.15, 11.25], [3.42, 11.6]];
  // The head, from the chip round over the point to the left shoulder.
  const n = 13;
  for (let i = 1; i < n; i++) {
    const a = (i / n) * Math.PI;
    const x = Math.cos(a) * 3.95, lift = Math.sin(a);
    const point = Math.pow(lift, 6) * 0.75;
    if (x > 3.3) continue;
    out.push([x + w(0.12), 10.95 + lift * 3.4 + point + w(0.14) + (x < 0 ? 0.18 * (-x / 3.95) : 0)]);
  }
  out.push([-4.02, 11.1], [-4.14, 10.2]);
  return out;
})();
const T_TOP = Math.max(...OUTLINE.map((p) => p[1]));

/** How wide the stone is at height `z` up its face: its left and right. */
function widthAt(z: number, outline: readonly Pt[] = OUTLINE): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if ((a[1] - z) * (b[1] - z) > 0 || a[1] === b[1]) continue;
    const x = a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return lo < hi ? [lo, hi] : [0, 0];
}

/* ---- what is cut into it ----------------------------------------------------------- */

/** The roundel at its head and the panel the line is cut in: in the face, across and up. */
const ROUNDEL = { x: 0, z: 12.0, r: 1.95 };
/** How wide the roundel's lit strokes are: line-work, stone between them, never a lit disc. */
const ROUNDEL_W = 0.25;
/**
 * The roundel's figure: the Runestones' wheel (`roundelStrokes('wheel')`)
 * drawn in line-work for a stone a tenth their height -- one ring, a small
 * hub, and six spokes between them, stopped short of both.
 */
const wheel = (spokes: number): Stroke[] => {
  const circle = (r: number, n: number): Stroke => ({ pts: Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r] as Pt) });
  const out: Stroke[] = [circle(1, 36), circle(0.17, 10)];
  for (let i = 0; i < spokes; i++) {
    const a = Math.PI / 2 + (i / spokes) * TAU + Math.PI / spokes;
    out.push({ pts: [[Math.cos(a) * 0.32, Math.sin(a) * 0.32], [Math.cos(a) * 0.82, Math.sin(a) * 0.82]] });
  }
  return out;
};
const ROUNDEL_STROKES: Stroke[] = wheel(6);
const BACK_STROKES: Stroke[] = wheel(4);
/** And the smaller one cut on its back. */
const BACK_ROUNDEL = { x: 0, z: 11.7, r: 1.45 };
const PANEL = { x: 0, w: 5.5, z0: 1.55, z1: 8.65, arch: 1.15 };
/** The marks of the line: how high each is from its middle, how wide, how far apart, and the room a space takes. */
const MARK_H = 0.46;
const MARK_W = 0.22;
const MARK_STEP = 0.66;
const WORD_GAP = 0.5;
const LINE_STEP = 1.35;
const LINES_MOST = 4;
/** Where in the panel the rows go, and how wide they may run. */
const ROWS_MID = (PANEL.z0 + PANEL.z1) / 2 + 0.2;
const ROW_WIDE = PANEL.w - 1.3;

/**
 * The small rune-marks a line is cut as: a stave, a stave and a twig, an
 * arrow, a bow, an open angle, a crook, a zig, a thorn, an elk-fork, a
 * crossed pair -- a few strokes each, in a box a unit each way from its middle.
 */
const MARKS: Stroke[][] = [
  [{ pts: [[0, -1], [0, 1]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[0, 0.45], [0.7, -0.05]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[0, 0.95], [0.7, 0.4]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[-0.6, 0.45], [0, 1], [0.6, 0.45]] }],
  [{ pts: [[0.6, 1], [-0.5, 0], [0.6, -1]] }],
  [{ pts: [[-0.35, -1], [-0.35, 1], [0.5, 0.4]] }],
  [{ pts: [[-0.4, 1], [0.4, 0.25], [-0.4, -0.25], [0.4, -1]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[-0.6, -0.3], [0.6, 0.3]] }],
  [{ pts: [[-0.5, -1], [0.5, 1]] }],
  [{ pts: [[-0.4, -1], [0.3, 1]] }, { pts: [[0, 0], [0.6, -0.2]] }],
  // And the Runestones' own staves, at the size of a letter.
  GLYPHS.tiwaz, GLYPHS.algiz, GLYPHS.laguz, GLYPHS.sowilo, GLYPHS.othala, GLYPHS.cross,
];

/** One mark of a line: which of `MARKS`, and where in the face. */
interface Mark { k: number; x: number; z: number }

/**
 * A line laid out as rows of marks, off its own letters: every word one mark
 * for each two of its letters, its marks chosen by those letters; the words
 * set along a row as far as the panel is wide, then the next row; the rows
 * stood in the middle of the panel. Nothing for a blank stone.
 */
export function engravingMarks(text: string | undefined): Mark[][] {
  const words = (text ?? '').split(' ').filter((w) => w.length);
  if (!words.length) return [];
  // The hand's own unevenness, off the words themselves: the same line is cut the same way every time.
  let h = 0;
  for (const ch of text ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const H = rand(h % 100000 + 7);
  // Its marks, one to every two letters, chosen by those letters, run on as one stream.
  const stream: number[] = [];
  for (const word of words) {
    for (let i = 0; i < word.length; i += 2) {
      const a = word.charCodeAt(i), b = i + 1 < word.length ? word.charCodeAt(i + 1) : 0;
      stream.push((a * 7 + b * 13 + i) % MARKS.length);
    }
  }
  /*
   * Cut into rows as a hand cuts them: each its own length, its own one to
   * three breaks, and the last row short and set from the left. A break is
   * never put where one in a row above it stands, so no gap runs down
   * through the rows and the line does not stand in a grid.
   */
  const rows: Array<Array<{ k: number; x: number }>> = [];
  // Where the breaks in the row above fall.
  const breaksAt: number[] = [];
  let at = 0;
  const most = Math.floor(ROW_WIDE / MARK_STEP);
  while (at < stream.length && rows.length < LINES_MOST) {
    // A full row of four to six; what is left at the end, two to four, on a short last row; nothing past the fourth.
    const rem = stream.length - at;
    let n: number;
    if (rows.length === LINES_MOST - 1) n = Math.min(rem, 2 + Math.floor(H() * 3));
    else if (rem <= 4) n = rem;
    else if (rem <= most + 2) n = rem - 2 - Math.floor(H() * 2);
    else n = Math.min(rem - 2, most - 2 + Math.floor(H() * 3));
    const marks = stream.slice(at, at + n);
    at += n;
    const last = rows.length > 0 && (at >= stream.length || rows.length === LINES_MOST - 1);
    const want = marks.length < 4 ? (marks.length > 2 ? 1 : 0) : 1 + Math.floor(H() * 3);
    let best: { row: Array<{ k: number; x: number }>; mids: number[]; clash: number } | undefined;
    for (let tries = 0; tries < 24 && (!best || best.clash > 0); tries++) {
      const breaks = new Set<number>();
      // Fewer breaks the longer it takes to find a place for them.
      const most = tries > 12 ? Math.min(want, 1) : want;
      for (let t = 0; t < 12 && breaks.size < most; t++) breaks.add(1 + Math.floor(H() * (marks.length - 1)));
      // Its spacing wanders a little, mark to mark, and the row starts a little off the middle.
      const steps = marks.map(() => MARK_STEP * (0.82 + 0.36 * H()));
      const gaps = marks.map((_, i) => (breaks.has(i) ? WORD_GAP * (0.7 + 0.6 * H()) : 0));
      const span = steps.reduce((m, st) => m + st, 0) + gaps.reduce((m, g) => m + g, 0) - MARK_STEP + MARK_W * 2;
      // The last row starts where the others do, from the left, as a short line ends a verse.
      const room = Math.max(0, (ROW_WIDE + 0.5 - span) / 2);
      let x = last ? PANEL.x - ROW_WIDE / 2 + MARK_W + H() * 0.3 : PANEL.x - span / 2 + MARK_W + (H() - 0.5) * 2 * Math.min(room, 0.6);
      const row: Array<{ k: number; x: number }> = [];
      const mids: number[] = [];
      marks.forEach((k, i) => {
        if (gaps[i]) {
          x += gaps[i];
          mids.push(x - (gaps[i] + steps[i - 1]) / 2);
        }
        row.push({ k, x });
        x += steps[i];
      });
      const clash = mids.filter((m) => breaksAt.some((b) => Math.abs(b - m) < 1)).length;
      if (!best || clash < best.clash) best = { row, mids, clash };
    }
    rows.push(best!.row);
    breaksAt.splice(0, breaksAt.length, ...best!.mids);
  }
  // Rows a hand apart, give or take: the pitch wanders up to a sixth either way.
  const pitch = rows.map((_, j) => (j ? LINE_STEP * (0.85 + 0.3 * H()) : 0));
  const total = pitch.reduce((n, p) => n + p, 0);
  let z = ROWS_MID + total / 2;
  return rows.map((r, j) => {
    z -= pitch[j];
    return r.map(({ k, x }) => ({ k, x, z: z + (H() - 0.5) * 0.09 }));
  });
}

/** A row of marks as one path, in the face. */
function rowPath(g: Ctx, row: readonly Mark[]): void {
  g.beginPath();
  for (const m of row) {
    for (const st of MARKS[m.k]) {
      st.pts.forEach(([px, py], i) => (i ? g.lineTo(m.x + px * MARK_W, m.z + py * MARK_H) : g.moveTo(m.x + px * MARK_W, m.z + py * MARK_H)));
      if (st.closed) g.closePath();
    }
  }
}

/** The panel's outline, `d` in from its edge: straight sides and a pointed head, as a Runestone's panel is cut. */
function panelPath(g: Ctx, d: number): void {
  const hw = PANEL.w / 2;
  const l = PANEL.x - hw + d, r = PANEL.x + hw - d, top = PANEL.z1 + PANEL.arch - d * 0.4;
  g.beginPath();
  g.moveTo(l, PANEL.z0 + d);
  g.lineTo(l, PANEL.z1);
  g.quadraticCurveTo(l, PANEL.z1 + (top - PANEL.z1) * 0.7, PANEL.x, top);
  g.quadraticCurveTo(r, PANEL.z1 + (top - PANEL.z1) * 0.7, r, PANEL.z1);
  g.lineTo(r, PANEL.z0 + d);
  g.closePath();
}

/* ---- the model ------------------------------------------------------------------ */

interface Model {
  things: Thing[];
  /** The stone and its plinth: what it is clicked by. */
  solid: Face[];
  /** The frames of its two broad faces, the runes are drawn in, and which way each looks. */
  frames: { front: { o: V3; a: V3; b: V3 }; back: { o: V3; a: V3; b: V3 } };
  normals: { front: V3; back: V3 };
  rows: Mark[][];
  turf: Pt[];
}

const models = new Map<string, Model>();

/** Moss as cushions at points of a face, drawn over it on the screen (`drawPads`): its frame's transform now, and its base. */
const padsOn = (g: Ctx, base: DOMMatrix, e: Eye, pts: ReadonlyArray<[number, number, number]>, squat = 0.9, lit = true): void => {
  const tr = g.getTransform(), inv = base.inverse();
  const across = Math.hypot(e.ux, e.uy) * 0.9;
  const ps: Pad[] = pts.map(([x, z, r]) => {
    const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x, z)));
    return [q.x, q.y, r * across, r * across * squat] as Pad;
  });
  g.save();
  g.setTransform(base);
  drawPads(g, ps, MOSS_GREENS);
  // And a lit lip on the upper half of each cushion big enough to have one: the moss's top catching the light.
  if (lit) {
    g.fillStyle = MOSS_GREENS.lit;
    g.beginPath();
    for (const [x, y, rx, ry] of ps) {
      if (rx < 0.45) continue;
      g.moveTo(x - rx * 0.22 + rx * 0.5, y - ry * 0.42);
      g.ellipse(x - rx * 0.22, y - ry * 0.42, rx * 0.5, ry * 0.32, 0, 0, TAU);
    }
    g.fill();
  }
  g.restore();
};

/**
 * A cushion of moss: a dozen or two pads gathered in a ragged mound `w`
 * across and `h` high round (cx, cz), thickest and biggest at its foot and
 * breaking up toward a ragged top -- so drawn together their dark under-edge
 * runs round the whole of it, and the lit lips sit along its top.
 */
function clump(R: () => number, cx: number, cz: number, w: number, h: number, size = 1): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const n = Math.round(5 + w * h * 4.5);
  for (let i = 0; i < n; i++) {
    const u = (R() - 0.5) * 2, v = Math.pow(R(), 1.4);
    // Narrower toward its top, and not every pad up there.
    const wide = 1 - 0.55 * v;
    if (v > 0.6 && R() < 0.45) continue;
    out.push([cx + u * wide * w * 0.5, cz + v * h - h * 0.2, (0.42 + 0.62 * R()) * size * (1.15 - 0.5 * v)]);
  }
  return out;
}

/** A run of moss along a joint: from (x0, y0) to (x1, y1) in a face's own plane, spreading `d` off it toward (nx, ny). */
type Mat = [number, number, number, number, number, number, number];

/**
 * Moss as it lies in a joint: a flat mat in the face's own plane, so it is
 * foreshortened with it and lies down rather than standing up. Thickest
 * mid-run and spreading furthest there, tattered to nothing at its ends and
 * along its outer edge; a dark rim round it, its body, and light speckled
 * over its top.
 */
function mat(g: Ctx, R: () => number, [x0, y0, x1, y1, d, nx, ny]: Mat): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const blobs: Array<[number, number, number, number]> = [];
  const n = Math.ceil(len / 0.22) + 6;
  for (let i = 0; i < n; i++) {
    const t = R();
    const thick = Math.pow(Math.sin(Math.PI * t), 0.7);
    // Most of it hugging the joint, now and then a tongue of it out across the stone.
    const off = Math.pow(R(), 1.15) * d * thick * (R() < 0.15 ? 1.5 : 1);
    const rr = (0.28 + R() * 0.38) * (0.45 + 0.75 * thick);
    blobs.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off, rr, R()]);
  }
  const pass = (fill: string, k: number, dx: number, dy: number, every = 1, min = 0): void => {
    g.beginPath();
    for (const [x, y, rr, q] of blobs) {
      if (q * every > 1 || rr < min) continue;
      g.moveTo(x + dx + rr * k, y + dy);
      g.ellipse(x + dx, y + dy, rr * k, rr * k * 0.8, 0, 0, TAU);
    }
    g.fillStyle = fill;
    g.fill();
  };
  pass(MOSS_GREENS.line, 1.18, 0, 0);
  pass(MOSS_GREENS.under, 1.06, 0, 0);
  pass(MOSS_GREENS.fill, 0.92, nx * 0.04, ny * 0.04);
  pass(MOSS_GREENS.lit, 0.5, nx * 0.08, ny * 0.08, 2.2, 0.3);
  pass(MOSS_GREENS.top, 0.24, nx * 0.1, ny * 0.1, 4, 0.36);
}

/** Lichen as the Runestones' rocks wear it, here soft: a few grey-green blots, uneven, faint, no rim. */
function blot(g: Ctx, R: () => number, x: number, z: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 4 + Math.floor(R() * 3); i++) {
    const a = R() * TAU, d = R() * r * 0.6, rr = r * (0.35 + R() * 0.4);
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d * 0.8;
    g.moveTo(bx + rr, bz);
    g.ellipse(bx, bz, rr, rr * (0.7 + R() * 0.3), R() * TAU, 0, TAU);
  }
  g.fillStyle = 'rgba(200, 205, 180, 0.32)';
  g.fill();
}

/** The ivy's own greens (`ivy.ts`): a leaf in the light, in shade, its rim, and the vine. */
/**
 * The moss's greens on a stone this small: the ivy's own deep greens rather
 * than the Runestones' paler cushions, so a few small ones read as moss in
 * the joints and not as lime beads -- a cool under-edge, a body, and a lit lip.
 */
const MOSS_GREENS: MossPalette = { line: '#44614f', dark: '#4b6c58', under: '#557a64', fill: '#608870', lit: '#78a283', top: '#86ad8e' };

const LEAF = { lit: '#74ba87', shade: '#65957a', top: '#93d9a2', line: '#4b6c57', stem: '#5d6b4c' };

/**
 * A strand of ivy painted on a face in its own units, from (x0, z0), `len`
 * long, up (`dir` 1) or hanging down (-1): a thin stem wandering as it goes,
 * leaves off it to left and right by turns, each its own size and set at its
 * own angle, a gap now and then where the stem shows, and a short shoot or
 * two off it. Kept between `x0 - lo` and `x0 + hi` across.
 */
function ivy(g: Ctx, R: () => number, x0: number, z0: number, len: number, dir: 1 | -1, lo: number, hi: number, leaf = 0.5): void {
  const stems: Pt[][] = [];
  const leaves: Array<{ x: number; z: number; a: number; s: number; lit: boolean }> = [];
  const grow = (sx: number, sz: number, a0: number, l: number, shoots: number): void => {
    const pts: Pt[] = [[sx, sz]];
    let a = a0, x = sx, z = sz, side = R() < 0.5 ? -1 : 1;
    for (let d = 0; d < l; d += 0.3) {
      a += (R() - 0.5) * 0.5 + (Math.PI / 2 * dir - a) * 0.15;
      x = Math.max(x0 - lo, Math.min(x0 + hi, x + Math.cos(a) * 0.3));
      z += Math.sin(a) * 0.3;
      pts.push([x, z]);
      if (Math.floor((d + 0.3) / 0.42) > Math.floor(d / 0.42)) {
        side = -side;
        if (R() < 0.2) continue;
        const la = a + side * (0.9 + R() * 0.6) - (dir < 0 ? Math.PI : 0) * 0;
        leaves.push({ x: x + Math.cos(la) * 0.12, z: z + Math.sin(la) * 0.12, a: la, s: leaf * (0.6 + 0.7 * R()), lit: side < 0 });
      }
      if (shoots > 0 && R() < 0.12 && d > l * 0.25) {
        shoots--;
        grow(x, z, a + (R() < 0.5 ? -1 : 1) * (0.7 + R() * 0.4), l * (0.2 + R() * 0.15), 0);
      }
    }
    stems.push(pts);
  };
  grow(x0, z0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, len, 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = LEAF.stem;
  g.lineWidth = 0.09;
  for (const st of stems) {
    g.beginPath();
    st.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
    g.stroke();
  }
  // A heart-shaped leaf on its stalk, its point away from the stem: the notch at (0, 0), the tip `s` out along its angle.
  for (const lf of leaves) {
    g.save();
    g.translate(lf.x, lf.z);
    g.rotate(lf.a - Math.PI / 2);
    const L = lf.s;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-0.72 * L, -0.18 * L, -0.48 * L, 0.42 * L);
    g.quadraticCurveTo(-0.24 * L, 0.82 * L, 0, L);
    g.quadraticCurveTo(0.24 * L, 0.82 * L, 0.48 * L, 0.42 * L);
    g.quadraticCurveTo(0.72 * L, -0.18 * L, 0, 0);
    g.closePath();
    g.fillStyle = lf.lit ? LEAF.lit : LEAF.shade;
    g.fill();
    g.strokeStyle = LEAF.line;
    g.lineWidth = 0.05;
    g.stroke();
    // The pale of it where the light lands, and its middle vein.
    g.beginPath();
    g.ellipse(-0.14 * L, 0.5 * L, 0.18 * L, 0.12 * L, 0.5, 0, TAU);
    g.fillStyle = LEAF.top;
    g.globalAlpha = lf.lit ? 0.7 : 0.35;
    g.fill();
    g.globalAlpha = 1;
    g.restore();
  }
}

function modelOf(text: string, facing: Side): Model {
  const key = `${facing}|${text}`;
  const had = models.get(key);
  if (had) return had;
  const R = rand(SEED * 13 + 1);
  const things: Thing[] = [];
  const rows = engravingMarks(text);
  const half0 = DEPTH[0] / 2, half1 = DEPTH[1] / 2;
  const f = (half1 - half0) / T_TOP;
  const W: V3 = [LEAN[0], LEAN[1], 1];
  const O: V3 = [0, -0.55, FOOT];
  const mossSide = -1;

  /* -- the plinth: two courses of rough-dressed stone, the upper set a little askew on the lower -- */
  const course = (hw: number, hd: number, z0: number, h: number, turn: number, dx: number, dy: number, tone: Tone, seed: number, top: Painter,
    chips: { fr?: number; fl?: number; br?: number; bl?: number } = {}, tilt: [number, number] = [0, 0]): Face[] => {
    const C = rand(seed);
    const c = Math.cos(turn), s = Math.sin(turn);
    // Its corners, a chip knocked off one or two of them: front right, front left, back right.
    const corner = (x: number, y: number, k: number | undefined, sx: number, sy: number): Pt[] => (k ? [[x, y - sy * k * 0.8], [x - sx * k, y]] : [[x, y]]);
    const raw: Pt[] = [...corner(-hw, -hd, chips.bl, -1, -1), [-hw * 0.35, -hd - 0.12], [hw * 0.4, -hd + 0.08], ...corner(hw, -hd, chips.br, 1, -1).reverse(), [hw + 0.1, 0],
      ...corner(hw, hd, chips.fr, 1, 1), [0, hd + 0.14], ...corner(-hw, hd, chips.fl, -1, 1).reverse(), [-hw - 0.08, 0]];
    const outline = raw.map(([x, y]) => [x + (C() - 0.5) * 0.22, y + (C() - 0.5) * 0.18] as Pt);
    return plate({
      o: [dx, dy, z0 + h / 2], U: [c, s, 0], W: [-s, c, 0], A: [tilt[0], tilt[1], 1], outline, half: [h / 2, h / 2], tTop: 1, bevel: 0.32, tone,
      front: top,
      edge: (i) => (i % 2 ? { paint: (g, k) => {
        const T = rand(seed * 5 + i);
        // The coursed face: a joint or two down it and grit.
        g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.3);
        for (let j = 0; j < 14; j++) g.fillRect(T() * hw * 2, (T() - 0.5) * h, 0.12, 0.12);
        cut(g, k.fill, 0.12, () => { g.beginPath(); const x = (0.3 + T() * 0.4) * hw * 2; g.moveTo(x, -h / 2); g.lineTo(x + 0.05, h / 2); });
      } } : undefined),
    });
  };
  const plinthTop = (hw: number, hd: number, seed: number, mats: Mat[]): Painter => (g, k) => {
    const T = rand(seed);
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse((T() - 0.5) * hw * 1.8, (T() - 0.5) * hd * 1.8, 0.5 + T() * 1.4, 0.3 + T() * 0.8, (T() - 0.5) * 0.6, 0, TAU);
      g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.38) : css(mix(k.fill, hex('#9c94a4'), 0.32), 0.28);
      g.fill();
    }
    g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.32);
    for (let i = 0; i < 40; i++) g.fillRect((T() - 0.5) * hw * 2, (T() - 0.5) * hd * 2, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
    for (let i = 0; i < 2; i++) blot(g, T, (T() - 0.2) * hw, (T() - 0.5) * hd, 0.4 + T() * 0.3);
    // Moss in the joints on its mossy side, where the damp lies longest: flat, along the foot of what stands on it.
    for (const m of mats) mat(g, T, m);
  };
  /*
   * The lower course sunk into the turf, so it rises out of the ground with
   * no ruled foot, a different chip off each corner; the upper laid as two
   * stones of unequal length, set a little off line, as a hand lays them.
   */
  /*
   * Where the moss lies, in each course's own plane: on the lower, along the
   * foot of the short upper stone, in front of it and down its far end, and
   * a tatter into the joint of the two; on the short stone, along the foot of
   * the memorial, at its end and in front.
   */
  const lowerMoss: Mat[] = [
    [-6.7, 2.15, -1.5, 2.25, 2.1, 0, 1], [-5.8, 2.3, -5.75, -3.1, 1.4, -1, 0], [-1.95, 2.3, -0.1, 2.35, 0.9, 0, 1],
  ];
  const upperMoss: Mat[] = [[-0.85, 2.4, -0.8, -2.5, 1.1, -1, 0], [-1.7, 2.05, 1.75, 2.0, 0.75, 0, 1]];
  const lower = course(7.3, 4.3, -0.4, LOWER_H + 0.4, 0.035, 0.1, 0.25, ROCK, SEED * 3 + 1, plinthTop(7.3, 4.3, SEED * 3 + 2, lowerMoss),
    { fr: 0.9, fl: 0.35, br: 0.55, bl: 1.2 });
  // The joint a third of the way across, the short stone a hair lower and the long one tipped a hair back.
  const upperL = course(1.85, 2.72, LOWER_H, UPPER_H - 0.06, -0.05, -3.68, -0.42, DRESSED, SEED * 3 + 5, plinthTop(1.85, 2.72, SEED * 3 + 6, upperMoss), { fl: 0.5 });
  const upperR = course(3.62, 2.68, LOWER_H, UPPER_H + 0.04, -0.02, 1.86, -0.26, DRESSED, SEED * 3 + 9, plinthTop(3.62, 2.68, SEED * 3 + 10, []), { fr: 0.4, br: 0.25 }, [0, -0.018]);
  const upper = [...upperL, ...upperR];

  /* -- the stone's faces -- */
  const carved = (which: 'front' | 'back'): { paint: Painter; over: Painter } => {
    const outline = which === 'front' ? OUTLINE : OUTLINE.map(([x, z]) => [-x, z] as Pt);
    const xs = (z: number): [number, number] => widthAt(z, outline);
    const sideK = which === 'front' ? mossSide : -mossSide;
    const seed = SEED * 31 + (which === 'front' ? 1 : 2);
    const paint: Painter = (g, k) => {
      const T = rand(seed);
      const fill = k.fill;
      // The Runestones' own skin, its marks laid smaller and fewer for a stone a tenth of their height.
      stoneSkin(g, T, fill, T_TOP, xs, seed, { size: 0.3, patches: 26, grit: 80, pits: 12, hairs: 4, streaks: 5 });
      if (which === 'front') {
        /* -- the panel: a field sunk a step into the face, ruled twice round, its pointed head under the roundel -- */
        panelPath(g, 0.32);
        g.fillStyle = css(mix(fill, hex('#a39aac'), 0.4), 0.5);
        g.fill();
        // Its floor dressed smoother than the face round it: one pale field.
        panelPath(g, 0.6);
        g.fillStyle = css(mix(fill, [255, 252, 244], 0.3), 0.32);
        g.fill();
        cut(g, fill, 0.2, () => panelPath(g, 0));
        cut(g, fill, 0.13, () => panelPath(g, 0.32));
        // A row of drilled dots down each side between the two rules, as a Runestone's panel has.
        for (let z = PANEL.z0 + 0.55; z < PANEL.z1 - 0.1; z += 0.62) {
          for (const sx of [-1, 1]) {
            const x = PANEL.x + sx * (PANEL.w / 2 - 0.16);
            cut(g, fill, 0.1, () => { g.beginPath(); g.moveTo(x, z + 0.02); g.lineTo(x, z - 0.02); });
          }
        }
        // A moulding cut round the head, a hand in from its edge, shoulder to shoulder.
        {
          const ring = inset(area2(OUTLINE) < 0 ? OUTLINE.slice().reverse() : OUTLINE, 0.5).filter(([, z]) => z > 9.9);
          ring.sort((a, b) => b[0] - a[0]);
          cut(g, fill, 0.15, () => { g.beginPath(); ring.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); });
        }
        // The line, row by row, cut into its floor.
        // The line, row by row, cut into its floor: each groove with a cool lavender shadow down its lower right.
        for (const row of rows) {
          g.save();
          g.translate(0.07, -0.07);
          rowPath(g, row);
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.strokeStyle = css(mix(fill, hex('#7d7499'), 0.55), 0.75);
          g.lineWidth = 0.15;
          g.stroke();
          g.restore();
          cut(g, fill, 0.13, () => rowPath(g, row));
        }
        /* -- the roundel, cut, under the light it will have: bare stone between its strokes -- */
        cut(g, fill, 0.22, () => strokesPath(g, ROUNDEL_STROKES, ROUNDEL.x, ROUNDEL.z, ROUNDEL.r));
        // A crack in from the chipped shoulder, its lit lip under it.
        const C = rand(seed * 3 + 7);
        const pts: Pt[] = [[3.3, 11.1]];
        let a = 3.6, x = 3.3, z = 11.1;
        for (let i = 0; i < 5; i++) {
          a += (C() - 0.5) * 0.9;
          x += Math.cos(a) * 0.45;
          z += Math.sin(a) * 0.45;
          pts.push([x, z]);
        }
        cut(g, fill, 0.11, () => { g.beginPath(); pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz))); });
      } else {
        // The back: dressed plain, a smaller wheel cut at its head, and a rule across under it.
        cut(g, fill, 0.24, () => strokesPath(g, BACK_STROKES, BACK_ROUNDEL.x, BACK_ROUNDEL.z, BACK_ROUNDEL.r));
        cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(-2.4, 9.1); g.lineTo(2.4, 9.05); });
      }
      /* -- lichen: a few soft grey-green blots on its upper half, away from the moss and off the carving -- */
      for (let i = 0; i < 4; i++) {
        const z = T_TOP * (0.35 + 0.6 * T()), [a, b] = xs(z);
        const u = sideK > 0 ? Math.pow(T(), 1.6) : 1 - Math.pow(T(), 1.6);
        const x = a + 0.3 + u * (b - a - 0.6);
        if (which === 'front' && Math.abs(x - PANEL.x) < PANEL.w / 2 + 0.3 && z < PANEL.z1 + PANEL.arch + 0.2) continue;
        if (Math.hypot(x - ROUNDEL.x, z - ROUNDEL.z) < ROUNDEL.r + 0.3) continue;
        blot(g, T, x, z, 0.3 + T() * 0.3);
      }
      /*
       * Moss in cushions, each its own size and height, in the corner where
       * the stone meets its plinth on the mossy side.
       */
      const [fa, fb] = xs(0.5);
      const foot = sideK > 0 ? fb : fa;
      mat(g, T, [foot + sideK * 0.2, 0.05, foot - sideK * 3.6, 0.05, 2.1, 0, 1]);
    };
    const over: Painter = (g, k) => {
      /* -- ivy up the mossy edge, kept to the stone and off the carving -- */
      const V = rand(seed * 11 + 5);
      const halo: Pt[] = inset(area2(outline) < 0 ? outline.slice().reverse() : outline, -0.18);
      g.save();
      g.beginPath();
      halo.forEach(([hx, hz], i) => (i ? g.lineTo(hx, hz) : g.moveTo(hx, hz)));
      g.closePath();
      g.clip();
      const [fa, fb] = xs(0.3);
      const edge = sideK > 0 ? fb : fa;
      // Across, it keeps between the stone's edge and the panel's.
      const lo = sideK > 0 ? (which === 'front' ? 0.55 : 1.6) : 0.5, hi = sideK > 0 ? 0.5 : (which === 'front' ? 0.55 : 1.6);
      ivy(g, V, edge - sideK * 1.05, 0.1, which === 'front' ? 4.2 : 5.2, 1, lo, hi, 0.95);
      g.restore();
    };
    return { paint, over };
  };
  const front = carved('front');
  const back = carved('back');

  /* -- the edges of the stone: its skin, and moss along the tops -- */
  const edgePaint = (i: number, up: number): { paint?: Painter; over?: Painter } | undefined => {
    const p = OUTLINE[i], q = OUTLINE[(i + 1) % OUTLINE.length];
    const mx = (p[0] + q[0]) / 2;
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const len = Math.hypot(dx + LEAN[0] * dz, LEAN[1] * dz, dz);
    const G = half0 + f * ((p[1] + q[1]) / 2) - 0.4;
    return {
      paint: (g, k) => {
        const T = rand(SEED * 101 + i);
        for (let j = 0; j < Math.ceil(len / 1.6); j++) {
          g.beginPath();
          g.ellipse(T() * len, (T() - 0.5) * 2 * G, 0.3 + T() * 0.55, 0.2 + T() * 0.3, (T() - 0.5) * 0.6, 0, TAU);
          g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.4) : css(mix(k.fill, hex('#9c94a4'), 0.32), 0.3);
          g.fill();
        }
        g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.35);
        for (let j = 0; j < len * 3; j++) g.fillRect(T() * len, (T() - 0.5) * 2 * G, 0.09 + T() * 0.07, 0.09 + T() * 0.07);
      },
      /*
       * Moss on the edge, laid over it after every face so a mass runs on
       * across the joins of the strips: on the tops of the head on its
       * mossy side, and up the mossy side from the foot. Where it is, off
       * noise at the very place on the stone, not on the strip.
       */
      over: (g, k) => {
        /*
         * Moss on the edge in a cushion at the foot of its mossy side, where
         * it meets the plinth, laid over it after every face so it runs on
         * across the join of two strips. It belongs to the strip its middle is on.
         */
        const T = rand(SEED * 103 + i);
        const spots: Array<[number, number, number, number]> = [[0.25, 1.6, 0.5, 0.95]];
        const pts: Array<[number, number, number]> = [];
        if (Math.sign(mx) === mossSide) {
          for (const [z, w, h, size] of spots) {
            const lo = Math.min(p[1], q[1]), hiZ = Math.max(p[1], q[1]);
            if (z < lo || z >= hiZ) continue;
            const s0 = ((z - p[1]) / (dz || 1)) * len;
            // Across the edge's thickness, and along it: a cushion on its side, nearer the front it grows from.
            for (const [y, sa, rr] of clump(T, 0.25 * G, s0, w * G * 0.9, h * 2.2, size)) pts.push([sa, y, rr]);
          }
        }
        if (pts.length) padsOn(g, k.base, k.e, pts, 0.85);
      },
    };
  };
  const stone = plate({
    o: O, U: [1, 0, 0], W, A: [0, 1, 0], outline: OUTLINE, half: [half0, half1], tTop: T_TOP, bevel: 0.42, tone: STONE,
    front: front.paint, frontOver: front.over, back: back.paint, backOver: back.over, edge: edgePaint, sunk: true,
    // One rounded edge, not a stack of strips: the lines between them barely there.
    edgeCrease: 0.1,
  });
  /*
   * The plinth and the stone on it are one thing in the order: the lower
   * course, the upper, then the stone standing on it, whichever way it is
   * seen -- what grows round it is kept off the plinth, so the order is only
   * ever asked between whole things.
   */
  const solid = [upperL, upperR, stone];
  // Turf and moss grown up over the foot of the lower course where it is seen, so it goes into the ground and does not stand on it.
  const skirt: Array<[number, number, number]> = [];
  const skirtZ: number[] = [];
  {
    const K = rand(SEED * 29 + 3);
    // Cushions along its foot, each its own size, the grass rising up its lip between them.
    const along: Array<[number, number, number]> = [[-5.6, 4.45, 1.5], [3.2, 4.5, 1.1], [7.4, 2.2, 0.9], [-7.4, -2.6, 1.2], [2.0, -4.1, 1.0]];
    for (const [x, y, w] of along) {
      const flat = Math.abs(y) > 4;
      for (const pt of clump(K, flat ? x : y, 0.15, w, 0.75 + K() * 0.6, 0.95)) {
        skirt.push(flat ? [pt[0], y + (K() - 0.5) * 0.3, pt[2]] : [x + (K() - 0.5) * 0.3, pt[0], pt[2]]);
        skirtZ.push(pt[1]);
      }
    }
    /*
     * And on its mossy corner the moss of its top spilling over the lip and
     * a little way down its faces, ragged, thickest at the corner: so the
     * plinth's foot on that side is green, as a Runestone's outcrop is.
     */
    const lip: Array<[number, number, number, number, number]> = [[-7.0, 4.5, -2.6, 4.55, 0], [-7.15, 4.2, -7.1, -1.2, 1]];
    for (const [x0, y0, x1, y1, side] of lip) {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) * 2.6);
      for (let i = 0; i < n; i++) {
        const t = Math.pow(K(), 1.3);
        const down = Math.pow(K(), 1.8) * (1.1 - t) * 1.1;
        skirt.push([x0 + (x1 - x0) * t + (side ? -0.1 : 0), y0 + (y1 - y0) * t + (side ? 0 : 0.1), (0.55 + 0.5 * K()) * (1.15 - 0.5 * t)]);
        skirtZ.push(LOWER_H - 0.05 - down);
      }
    }
  }
  const drawSkirt = (g: Ctx, e: Eye): void => {
    const across = Math.hypot(e.ux, e.uy);
    const ps: Pad[] = [];
    skirt.forEach(([x, y, rr], i) => {
      // Only on the side of it the eye sees, climbing its face from the ground.
      if (x * e.toward[0] + y * e.toward[1] <= 1.5) return;
      const [px, py] = proj(e, [x, y, Math.max(0.05, skirtZ[i])]);
      ps.push([px, py, rr * across * 1.1, rr * across * 0.8]);
    });
    drawPads(g, ps, MOSS_GREENS);
    g.fillStyle = MOSS_GREENS.lit;
    g.beginPath();
    for (const [x, y, rx, ry] of ps) {
      if (rx < 0.45) continue;
      g.moveTo(x - rx * 0.22 + rx * 0.5, y - ry * 0.42);
      g.ellipse(x - rx * 0.22, y - ry * 0.42, rx * 0.5, ry * 0.32, 0, 0, TAU);
    }
    g.fill();
  };
  things.push({
    x: 0, y: 0, reach: [...lower, ...solid.flat()].flatMap((fc) => fc.pts),
    draw: (g, e) => {
      drawFaces(g, e, lower, INK);
      drawSkirt(g, e);
      for (const fs of solid) drawFaces(g, e, fs, INK);
    },
  });

  /* -- a rock or two at its back, mossed over, and pebbles -- */
  // Kept inside a circle that fits its footprint, since it is set askew in it.
  const rocks: Array<[number, number, number, number, number]> = [[-5.5, -6.1, 1.65, 1.5, 0.3], [6.1, -5.7, 1.2, 1.05, 0.22], [-8.1, -2.9, 0.55, 0.4, 0.15], [3.6, 7.2, 0.48, 0.34, 0.1]];
  rocks.forEach(([x, y, r, h, moss], i) => {
    things.push({ x, y, faces: boulder(x, y, r, r * (0.72 + R() * 0.2), h, R() * TAU, SEED * 17 + i, ROCK, moss) });
  });

  /* -- flowers laid at its foot and grown up round the plinth, and grass -- */
  /*
   * Five clumps, larger than a Runestone's to be seen at a stone this size:
   * one either side of it, two in front, one behind. The sides always hold
   * the dusk spike and the faded rose, in whichever order the way it was set
   * gives, so some of each is seen from every side; the rest chalk and cream.
   */
  const Fv = rand(SEED * 53 + ['s', 'e', 'n', 'w'].indexOf(facing) * 101);
  const [left, right] = Fv() < 0.5 ? ['dusk', 'rose'] : ['rose', 'dusk'];
  const flowers: Array<[number, number, number, string]> = [
    [-8.5, -2.7, 0.56, left], [8.5, -1.0, 0.54, right],
    [2.6, 5.7, 0.55, Fv() < 0.5 ? 'chalk' : 'cream'], [0.1, 6.4, 0.5, Fv() < 0.5 ? 'rose' : 'chalk'],
  ];
  flowers.forEach(([x, y, big, colour], i) => {
    // Each clump its own: its seed off where it is and the way the stone was set, so no two spikes stand alike.
    const seed = (SEED * 7919 + i * 104729 + ['s', 'e', 'n', 'w'].indexOf(facing) * 1299709) % 1000003;
    const size = big * (0.88 + 0.24 * Fv());
    things.push({
      x, y, reach: [[x, y, 12]],
      draw: (g, e) => {
        // Not one the stone stands in front of: only its heads would show, on stalks over the slab.
        const [sx] = proj(e, [0, -0.55, 0]);
        const [px, py] = proj(e, [x, y, 0]);
        if (groundNear(e, x, y) < groundNear(e, 0, -0.55) - 1 && Math.abs(px - sx) < 9) return;
        flowerClump(g, px, py, colour, seed, size);
      },
    });
  });
  for (let i = 0; i < 22; i++) {
    const a = R() * TAU + Fv() * 0.4, d = 5.2 + R() * 4.1;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (Math.abs(x) < 7.9 && Math.abs(y) < 4.9) continue;
    const seed = SEED * 77 + i;
    things.push({ x, y, draw: (g, e) => { const [px, py] = proj(e, [x, y, 0]); grassTuft(g, px, py, seed, 0.5); } });
  }

  /* -- the turf: a patch a little inside its footprint -- */
  const turf: Pt[] = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU;
    const r = 8.3 + R() * 1.1;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });

  const frontFrame = { o: at(O, [half0, [0, 1, 0]]), a: [1, 0, 0] as V3, b: at(W, [f, [0, 1, 0]]) };
  const backFrame = { o: at(O, [-half0, [0, 1, 0]]), a: [-1, 0, 0] as V3, b: at(W, [-f, [0, 1, 0]]) };
  let nf = newell([frontFrame.o, add(frontFrame.o, frontFrame.a), add(add(frontFrame.o, frontFrame.a), frontFrame.b)]);
  if (nf[1] < 0) nf = mul(nf, -1);
  let nb = newell([backFrame.o, add(backFrame.o, backFrame.a), add(add(backFrame.o, backFrame.a), backFrame.b)]);
  if (nb[1] > 0) nb = mul(nb, -1);
  const model: Model = { things, solid: [...stone, ...upper, ...lower], frames: { front: frontFrame, back: backFrame }, normals: { front: nf, back: nb }, rows, turf };
  models.set(key, model);
  return model;
}

/* ---- baking ----------------------------------------------------------------------- */

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What the stone and its plinth cover from the footprint's middle, in pixels at zoom one: what it is clicked by. */
  hit: [number, number, number, number];
  glows: Glow[];
}

const BUDGET = 6e6;
const baked = new Map<string, Baked>();
let bakedArea = 0;

/** The stone's shade on the ground, from under its foot on the screen at zoom one: how far off the light, and how wide and deep. */
const SHADE = { dx: 6, dy: 2.5, rx: 21, ry: 8 };

function measure(model: Model, e: Eye): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p: V3): void => {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const t of model.things) {
    for (const f of t.faces ?? []) for (const p of f.pts) take(p);
    for (const p of t.reach ?? []) take(p);
  }
  for (const [x, y] of model.turf) take([x, y, 0]);
  // And the shade it throws, all of its feathered edge.
  const [sx, sy] = proj(e, [0, -0.5, 0]);
  x1 = Math.max(x1, sx + SHADE.dx + SHADE.rx);
  y1 = Math.max(y1, sy + SHADE.dy + SHADE.ry);
  x0 = Math.min(x0, sx + SHADE.dx - SHADE.rx);
  const pad = 6;
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function bake(facing: Side, rotation: number, scale: number, text: string): Baked {
  const model = modelOf(text, facing);
  const e = eyeOf(FACING_YAW[facing] + SET_ASKEW, rotation);
  const [x0, y0, x1, y1] = measure(model, e);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);

  /* -- the turf, a flat field of moss green with a ragged edge, and the stone's shade thrown off the light -- */
  const turfPath = (k: number): void => {
    g.beginPath();
    model.turf.forEach(([x, y], i) => {
      const [px, py] = proj(e, [x * k, y * k, 0]);
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    });
    g.closePath();
  };
  turfPath(0.84);
  g.fillStyle = 'rgba(118, 156, 122, 0.36)';
  g.fill();
  {
    const F = rand(SEED * 991 + 7);
    const across = Math.hypot(e.ux, e.uy);
    for (let i = 0; i < 40; i++) {
      const j = Math.floor(F() * model.turf.length), q = model.turf[j];
      const a = Math.atan2(q[1], q[0]) + (F() - 0.5) * 0.4, rr = Math.hypot(q[0], q[1]) * (0.78 + F() * 0.28);
      const [px, py] = proj(e, [Math.cos(a) * rr, Math.sin(a) * rr, 0]);
      const out = (rr / Math.hypot(q[0], q[1]) - 0.78) / 0.28;
      const r = (0.5 + F() * 0.9) * across * (1.1 - 0.5 * out);
      g.fillStyle = `rgba(118, 156, 122, ${(0.36 * (1 - 0.7 * out)).toFixed(3)})`;
      g.beginPath();
      g.ellipse(px, py, r, r * 0.5, 0, 0, TAU);
      g.fill();
    }
    // Its shade, thrown off the light: the island's cool teal, one soft field fading out to nothing at its rim.
    const [sx, sy] = proj(e, [0, -0.5, 0]);
    g.save();
    g.translate(sx + SHADE.dx, sy + SHADE.dy);
    g.rotate(0.1);
    g.scale(1, SHADE.ry / SHADE.rx);
    const shade = g.createRadialGradient(0, 0, 0, 0, 0, SHADE.rx);
    shade.addColorStop(0, 'rgba(44, 74, 78, 0.2)');
    shade.addColorStop(0.55, 'rgba(44, 74, 78, 0.14)');
    shade.addColorStop(1, 'rgba(44, 74, 78, 0)');
    g.fillStyle = shade;
    g.beginPath();
    g.arc(0, 0, SHADE.rx, 0, TAU);
    g.fill();
    g.restore();
  }

  /* -- everything standing, in order: the lower course first, the rest by where it stands -- */
  const things = model.things.slice().sort((a, b) => (a.first ? -1 : b.first ? 1 : groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y)));
  for (const t of things) {
    if (t.draw) t.draw(g, e);
    else if (t.faces) drawFaces(g, e, t.faces, INK);
  }

  /* -- the runes' light, and the line's, baked to be laid at their strength each frame -- */
  const glows: Glow[] = [];
  for (const which of ['front', 'back'] as const) {
    if (dot(model.normals[which], e.toward) <= 1e-6) continue;
    const fr = model.frames[which];
    const [ox, oy] = proj(e, fr.o), [ax, ay] = proj(e, fr.a), [bx, by] = proj(e, fr.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    if (which === 'front') {
      // The roundel: its lit strokes only by day, so bare stone shows between them; glowing lines after dark.
      glows.push(bakeGlow(M, scale, (h) => strokesPath(h, ROUNDEL_STROKES, ROUNDEL.x, ROUNDEL.z, ROUNDEL.r), ROUNDEL.x, ROUNDEL.z, ROUNDEL.r, 4, true,
        { w: ROUNDEL_W, noDayHalo: true, tight: true, fine: true }));
      // The line: its rows catch the light after dark, faintly, the lowest first.
      model.rows.slice().reverse().forEach((row, j) => {
        if (!row.length) return;
        const x0r = Math.min(...row.map((m) => m.x)), x1r = Math.max(...row.map((m) => m.x));
        const half = (x1r - x0r) / 2 + MARK_W;
        glows.push(bakeGlow(M, scale, (h) => rowPath(h, row), (x0r + x1r) / 2, row[0].z, half, j, false, { w: 0.11, faint: 0.38, nightOnly: true, tight: true }));
      });
    } else {
      glows.push(bakeGlow(M, scale, (h) => strokesPath(h, BACK_STROKES, BACK_ROUNDEL.x, BACK_ROUNDEL.z, BACK_ROUNDEL.r), BACK_ROUNDEL.x, BACK_ROUNDEL.z, BACK_ROUNDEL.r, 0, true,
        { w: ROUNDEL_W * 0.85, faint: 0.8, noDayHalo: true, tight: true, fine: true }));
    }
  }

  // What it is clicked by: the stone and its plinth.
  let h0 = Infinity, h1 = Infinity, h2 = -Infinity, h3 = -Infinity;
  for (const fc of model.solid) {
    for (const p of aboveGround(fc.pts)) {
      const [x, y] = proj(e, p);
      h0 = Math.min(h0, x); h1 = Math.min(h1, y); h2 = Math.max(h2, x); h3 = Math.max(h3, y);
    }
  }
  return { canvas, scale, ox: -x0 * scale, oy: -y0 * scale, hit: [h0 - 2, h1 - 2, h2 + 2, h3 + 2], glows };
}

function bakedFor(facing: Side, rotation: number, zoom: number, text: string): Baked {
  const scale = scaleFor(zoom);
  const key = `${facing}|${((rotation % 8) + 8) % 8}|${scale}|${text}`;
  let b = baked.get(key);
  if (b) {
    baked.delete(key);
    baked.set(key, b);
    return b;
  }
  b = bake(facing, rotation, scale, text);
  baked.set(key, b);
  bakedArea += b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= old.canvas.width * old.canvas.height;
  }
  return b;
}

/**
 * Draw a memorial stone whose footprint's middle is at (sx, sy) on the
 * screen, set facing `facing`, from viewpoint `rotation`, with `text` cut into
 * it (nothing, blank), under a night `night` dark, at `t` seconds. Returns
 * what its stone and plinth cover from (sx, sy) in screen pixels -- left,
 * top, right, bottom -- the box it is clicked by.
 */
export function drawMemorial(ctx: Ctx, sx: number, sy: number, zoom: number, facing: Side, rotation: number, text: string | undefined, night = 0,
  t = performance.now() / 1000): [number, number, number, number] {
  const b = bakedFor(facing, rotation, zoom, text ?? '');
  const k = zoom / b.scale;
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  drawGlows(ctx, b.glows, sx, sy, zoom, night, t);
  const [l, tp, r, bt] = b.hit;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** Its runes' and its line's light, baked, for the night to be taken off in their shapes (`RunestoneNight.glows`). */
export const memorialGlows = (facing: Side, rotation: number, zoom: number, text: string | undefined): Glow[] =>
  bakedFor(facing, rotation, zoom, text ?? '').glows;
