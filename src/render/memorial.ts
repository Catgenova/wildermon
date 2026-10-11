import type { Side } from '../game/building';
import { rand, strandPic, STAGES, PPM } from './ivy';
import {
  add, aboveGround, area2, at, bakeGlow, boulder, canvasOf, css, cut, dot, drawFaces, drawGlows, drawPads, eyeOf, flowerClump,
  glyphPath, grassTuft, groundNear, hex, inset, lichen, mix, mul, newell, noise2, plate, proj, scaleFor, stoneSkin, strokesPath, TAU,
  toneOf, type Ctx, type Eye, type Face, type Glow, type Pad, type Painter, type Pt, type Stroke, type Thing, type Tone, type V3,
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
const LICHENS: [string, string] = ['#e6e2bc', '#d3dcb4'];
const FLOWERS = ['white', 'yellow', 'white', 'blue', 'white', 'yellow'];

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
/** How high it stands at `x` across its face. */
function headAt(x: number, outline: readonly Pt[] = OUTLINE): number {
  let top = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    top = Math.max(top, a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
  }
  return top;
}

/* ---- what is cut into it ----------------------------------------------------------- */

/** The roundel at its head and the panel the line is cut in: in the face, across and up. */
const ROUNDEL = { x: 0, z: 12.0, r: 1.95 };
/** How wide the roundel's lit strokes are: fine line-work, stone between them, never a lit disc. */
const ROUNDEL_W = 0.16;
/**
 * The roundel's figure: one ring, and a star of six points inside it, its
 * arms long and short by turns and kept well in from the ring -- the
 * Runestones' line-work, sparser, for a stone a tenth their height.
 */
const ROUNDEL_STROKES: Stroke[] = (() => {
  const ring: Pt[] = Array.from({ length: 37 }, (_, i) => [Math.cos((i / 36) * TAU), Math.sin((i / 36) * TAU)] as Pt);
  const star: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 + (i / 12) * TAU, k = i % 2 ? 0.22 : i % 4 === 0 ? 0.72 : 0.5;
    star.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  return [{ pts: ring }, { pts: star, closed: true }];
})();
const PANEL = { x: 0, w: 5.5, z0: 1.55, z1: 8.65, arch: 1.15 };
/** The marks of the line: how high each is from its middle, how wide, how far apart, and the room a space takes. */
const MARK_H = 0.4;
const MARK_W = 0.24;
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
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[-0.6, 0.35], [0.6, -0.3]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[-0.65, 0.35], [0, 1], [0.65, 0.35]] }],
  [{ pts: [[-0.55, -1], [-0.55, 0.85], [0.55, 0.45], [0.55, -1]] }],
  [{ pts: [[0.6, 1], [-0.5, 0], [0.6, -1]] }],
  [{ pts: [[-0.4, -1], [-0.4, 1], [0.55, 0.4]] }],
  [{ pts: [[-0.5, 1], [0.45, 0.3], [-0.45, -0.3], [0.5, -1]] }],
  [{ pts: [[-0.5, -1], [-0.5, 1]] }, { pts: [[-0.5, 0.95], [0.55, 0.45], [-0.5, -0.05]] }],
  [{ pts: [[0, -1], [0, 1]] }, { pts: [[-0.6, 1], [0, 0.3], [0.6, 1]] }],
  [{ pts: [[-0.55, -1], [-0.55, 1]] }, { pts: [[0.55, -1], [0.55, 1]] }, { pts: [[-0.55, 0.55], [0.55, -0.15]] }],
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
  const rows: Array<Array<number[]>> = [];
  let row: Array<number[]> = [];
  let wide = 0;
  for (const word of words) {
    const marks: number[] = [];
    for (let i = 0; i < word.length; i += 2) {
      const a = word.charCodeAt(i), b = i + 1 < word.length ? word.charCodeAt(i + 1) : 0;
      marks.push((a * 7 + b * 13 + i) % MARKS.length);
    }
    const len = marks.length * MARK_STEP;
    if (row.length && wide + WORD_GAP + len > ROW_WIDE) {
      rows.push(row);
      row = [];
      wide = 0;
    }
    // A word longer than the row is cut short at the row's end.
    const fit = Math.max(1, Math.min(marks.length, Math.floor((ROW_WIDE - (row.length ? wide + WORD_GAP : 0)) / MARK_STEP)));
    row.push(marks.slice(0, fit));
    wide += (row.length > 1 ? WORD_GAP : 0) + fit * MARK_STEP;
  }
  if (row.length) rows.push(row);
  const kept = rows.slice(0, LINES_MOST);
  const top = ROWS_MID + ((kept.length - 1) * LINE_STEP) / 2;
  return kept.map((r, j) => {
    const span = r.reduce((n, w) => n + w.length * MARK_STEP, 0) + (r.length - 1) * WORD_GAP - (MARK_STEP - MARK_W * 2);
    let x = PANEL.x - span / 2 + MARK_W;
    const z = top - j * LINE_STEP;
    const out: Mark[] = [];
    r.forEach((w, i) => {
      if (i) x += WORD_GAP;
      for (const k of w) {
        out.push({ k, x, z });
        x += MARK_STEP;
      }
    });
    return out;
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
const padsOn = (g: Ctx, base: DOMMatrix, e: Eye, pts: ReadonlyArray<[number, number, number]>, squat = 0.9): void => {
  const tr = g.getTransform(), inv = base.inverse();
  const across = Math.hypot(e.ux, e.uy) * 0.9;
  const ps: Pad[] = pts.map(([x, z, r]) => {
    const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x, z)));
    return [q.x, q.y, r * across, r * across * squat] as Pad;
  });
  g.save();
  g.setTransform(base);
  drawPads(g, ps);
  g.restore();
};

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
    chips: { fr?: number; fl?: number; br?: number } = {}): Face[] => {
    const C = rand(seed);
    const c = Math.cos(turn), s = Math.sin(turn);
    // Its corners, a chip knocked off one or two of them: front right, front left, back right.
    const corner = (x: number, y: number, k: number | undefined, sx: number, sy: number): Pt[] => (k ? [[x, y - sy * k * 0.8], [x - sx * k, y]] : [[x, y]]);
    const raw: Pt[] = [[-hw, -hd], [-hw * 0.35, -hd - 0.12], [hw * 0.4, -hd + 0.08], ...corner(hw, -hd, chips.br, 1, -1).reverse(), [hw + 0.1, 0],
      ...corner(hw, hd, chips.fr, 1, 1), [0, hd + 0.14], ...corner(-hw, hd, chips.fl, -1, 1).reverse(), [-hw - 0.08, 0]];
    const outline = raw.map(([x, y]) => [x + (C() - 0.5) * 0.22, y + (C() - 0.5) * 0.18] as Pt);
    return plate({
      o: [dx, dy, z0 + h / 2], U: [c, s, 0], W: [-s, c, 0], A: [0, 0, 1], outline, half: [h / 2, h / 2], tTop: 1, bevel: 0.32, tone,
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
  const plinthTop = (hw: number, hd: number, seed: number, moss: number, inner: [number, number, number], ox = 0): Painter => (g, k) => {
    const T = rand(seed);
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse((T() - 0.5) * hw * 1.8, (T() - 0.5) * hd * 1.8, 0.5 + T() * 1.4, 0.3 + T() * 0.8, (T() - 0.5) * 0.6, 0, TAU);
      g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.38) : css(mix(k.fill, hex('#9c94a4'), 0.32), 0.28);
      g.fill();
    }
    g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.32);
    for (let i = 0; i < 40; i++) g.fillRect((T() - 0.5) * hw * 2, (T() - 0.5) * hd * 2, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
    for (let i = 0; i < 2; i++) lichen(g, T, (T() - 0.2) * hw, (T() - 0.5) * hd, 0.32 + T() * 0.22, LICHENS);
    /*
     * Moss gathered round the stone's foot, thickest on its mossy side and
     * behind it, and in the back corner on that side: where the damp lies
     * longest. Close enough that the cushions run together into masses.
     */
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 600; i++) {
      const x = (T() - 0.5) * hw * 2, y = (T() - 0.5) * hd * 2;
      const [ix, iy, icy] = inner;
      const fx = Math.max(0, Math.abs(x + ox) - ix), fy = Math.max(0, Math.abs(y - icy) - iy);
      const foot = Math.max(0, 1 - Math.hypot(fx, fy) / 1.8) * (0.55 + 0.45 * Math.max(0, ((x + ox) * mossSide) / ix)) * (y < icy + iy * 0.5 ? 1 : 0.6);
      const corner = Math.max(0, ((x + ox) * mossSide) / (hw + Math.abs(ox))) * 0.6 + Math.max(0, -y / hd) * 0.5;
      const share = Math.max(foot * 1.15, corner * 0.85);
      const nz = noise2(x / 1.4, y / 1.4, seed);
      if (moss * share * 1.4 + (nz - 0.5) * 1.1 < 0.6) continue;
      pts.push([x, y, (0.18 + 0.55 * T() * T()) * (0.6 + 0.6 * Math.min(1, share))]);
    }
    padsOn(g, k.base, k.e, pts, 0.62);
  };
  /*
   * The lower course sunk into the turf, so it rises out of the ground with
   * no ruled foot; the upper laid as two stones, the right one a hair taller
   * and set a little forward and off line, as a hand lays them.
   */
  const lower = course(7.3, 4.3, -0.4, LOWER_H + 0.4, 0.035, 0.1, 0.25, ROCK, SEED * 3 + 1, plinthTop(7.3, 4.3, SEED * 3 + 2, 1, [5.5, 2.75, -0.6]), { fr: 0.9, br: 0.5 });
  const upperL = course(2.72, 2.75, LOWER_H, UPPER_H, -0.03, -2.78, -0.38, DRESSED, SEED * 3 + 5, plinthTop(2.72, 2.75, SEED * 3 + 6, 0.95, [4.45, 1.65, -0.2], -2.78), { fl: 0.55 });
  const upperR = course(2.68, 2.66, LOWER_H, UPPER_H + 0.1, -0.075, 2.74, -0.2, DRESSED, SEED * 3 + 9, plinthTop(2.68, 2.66, SEED * 3 + 10, 0.8, [4.45, 1.65, -0.2], 2.74), { fr: 0.45 });
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
        for (const row of rows) cut(g, fill, 0.17, () => rowPath(g, row));
        /* -- the roundel, cut, under the light it will have: bare stone between its strokes -- */
        cut(g, fill, 0.17, () => strokesPath(g, ROUNDEL_STROKES, ROUNDEL.x, ROUNDEL.z, ROUNDEL.r));
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
        // The back: dressed plain, a ring cut at its head with a six-pointed star in it, and a rule across under it.
        cut(g, fill, 0.16, () => { g.beginPath(); g.arc(ROUNDEL.x, ROUNDEL.z - 0.3, ROUNDEL.r * 0.75, 0, TAU); });
        cut(g, fill, 0.16, () => glyphPath(g, 'star6', ROUNDEL.x, ROUNDEL.z - 0.3, ROUNDEL.r * 0.45));
        cut(g, fill, 0.14, () => { g.beginPath(); g.moveTo(-2.4, 9.1); g.lineTo(2.4, 9.05); });
      }
      /* -- lichen on its upper half, away from the moss -- */
      for (let i = 0; i < 5; i++) {
        const z = T_TOP * (0.35 + 0.6 * T()), [a, b] = xs(z);
        const u = sideK > 0 ? Math.pow(T(), 1.6) : 1 - Math.pow(T(), 1.6);
        const x = a + u * (b - a);
        if (which === 'front' && Math.abs(x - PANEL.x) < PANEL.w / 2 + 0.3 && z < PANEL.z1 + PANEL.arch + 0.2) continue;
        if (which === 'front' && Math.hypot(x - ROUNDEL.x, z - ROUNDEL.z) < ROUNDEL.r + 0.3) continue;
        lichen(g, T, x, z, 0.24 + T() * 0.28, LICHENS);
      }
      /* -- moss: up from the foot on the mossy side, and over that shoulder of the head -- */
      const pts: Array<[number, number, number]> = [];
      for (let i = 0; i < 2400; i++) {
        const z = 0.1 + T() * T_TOP, [a, b] = xs(z);
        if (b - a < 0.4) continue;
        const x = a + 0.1 + T() * (b - a - 0.2);
        const side = (x * sideK) / 4.4;
        const d = sideK > 0 ? b - x : x - a;
        const inFoot = 1 - z / (4.2 * (0.3 + 0.9 * Math.max(0, side + 0.35)));
        const inEdge = 1 - d / (1.5 * Math.max(0, 1 - z / 11.5));
        const inHead = 0.95 * Math.max(0, side + 0.15) * (1 - (headAt(x, outline) - z) / 1.1);
        const share = Math.max(inFoot, inEdge, inHead);
        if (share <= 0) continue;
        if (which === 'front' && Math.abs(x - PANEL.x) < PANEL.w / 2 && z > PANEL.z0 + 0.6 && inFoot < 0.6) continue;
        if (which === 'front' && Math.hypot(x - ROUNDEL.x, z - ROUNDEL.z) < ROUNDEL.r) continue;
        // A ragged top to every mass: coarse noise for where it has got to, fine noise and a throw of the hand for its edge.
        const n = noise2(x / 1.3, z / 1.3, seed) * 0.55 + noise2(x / 0.45, z / 0.45, seed + 1) * 0.45;
        if (share * 1.3 + (n - 0.5) * 1.7 + (T() - 0.5) * 0.35 < 0.66) continue;
        pts.push([x, z, (0.16 + 0.5 * T() * T()) * (0.6 + 0.6 * Math.min(1, share))]);
      }
      padsOn(g, k.base, k.e, pts);
    };
    const over: Painter = (g, k) => {
      /* -- ivy up the mossy edge, kept to the stone and off the carving -- */
      const strands: Array<{ kind: 'climb' | 'vine' | 'hang'; x: number; z: number; v: number; k: number }> = which === 'front'
        ? [{ kind: 'climb', x: -3.45, z: 0.1, v: 0, k: 0.85 }, { kind: 'vine', x: -2.9, z: 0.6, v: 0, k: 0.55 }, { kind: 'hang', x: -3.0, z: headAt(-3.0, outline) - 0.2, v: 0, k: 0.45 }]
        : [{ kind: 'vine', x: 3.3, z: 0.4, v: 0, k: 0.62 }, { kind: 'hang', x: 3.1, z: headAt(3.1, outline) - 0.2, v: 0, k: 0.42 }];
      const halo: Pt[] = inset(area2(outline) < 0 ? outline.slice().reverse() : outline, -0.18);
      const tr0 = g.getTransform();
      const sprays: Array<[number, number]> = [];
      for (const iv of strands) {
        const pic = strandPic(iv.kind, iv.v, STAGES, true);
        if (!pic) continue;
        const sc = (iv.k * 10) / PPM;
        g.save();
        g.beginPath();
        halo.forEach(([hx, hz], i) => (i ? g.lineTo(hx, hz) : g.moveTo(hx, hz)));
        g.closePath();
        g.clip();
        if (which === 'front') {
          // Not over the panel: a ragged line down its mossy side.
          const edge = PANEL.x - PANEL.w / 2 - 0.25;
          g.beginPath();
          g.moveTo(edge, -1);
          for (let z = -1; z <= T_TOP + 1; z += 0.5) g.lineTo(edge - 0.2 - 0.2 * Math.sin(z * 2.3), z);
          g.lineTo(-20, T_TOP + 1);
          g.lineTo(-20, -1);
          g.closePath();
          g.clip();
        }
        g.translate(iv.x, iv.z);
        g.scale(sc, -sc);
        g.drawImage(pic.img, -pic.ax, -pic.ay);
        g.restore();
        sprays.push([iv.x + 0.35, iv.z + STRAND_REACH_M(iv.kind, iv.v) * 10 * iv.k * 0.55]);
      }
      // A spray of small flowers on the climbing strand, in the colours at its foot.
      const B = rand(seed * 5 + 3);
      const inv = k.base.inverse();
      g.save();
      g.setTransform(k.base);
      for (const [x, z] of sprays.slice(0, 1)) {
        const q = inv.transformPoint(tr0.transformPoint(new DOMPoint(x, z)));
        blossomSmall(g, q.x, q.y, 'white', B);
      }
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
        const T = rand(SEED * 103 + i);
        const pts: Array<[number, number, number]> = [];
        const at = (s0: number): Pt => [p[0] + (dx * s0) / len, p[1] + (dz * s0) / len];
        if (up > 0.35) {
          const n = Math.round(len * 2 * G * 7);
          for (let j = 0; j < n; j++) {
            const s0 = T() * len, y = -G + T() * 2 * G;
            const [x, z] = at(s0);
            const cover = 0.5 + 0.75 * Math.max(0, (x * mossSide) / 4) - 0.25 * Math.max(0, (-x * mossSide) / 4);
            const nz = noise2(x / 1.1, y / 1.1 + z / 3, SEED * 7 + 3) * 0.6 + noise2(x / 0.45, y / 0.45, SEED * 7 + 4) * 0.4;
            if (cover * 1.2 + (nz - 0.5) * 1.6 + (T() - 0.5) * 0.3 < 0.72) continue;
            pts.push([s0, y, 0.15 + 0.42 * T() * T()]);
          }
        } else if (Math.sign(mx) === mossSide && Math.min(p[1], q[1]) < 4) {
          const n = Math.round(len * 2 * G * 6);
          for (let j = 0; j < n; j++) {
            const s0 = T() * len, y = -G + T() * 2 * G;
            const [, z] = at(s0);
            const nz = noise2(z / 1.1, y / 1.1, SEED * 7 + 11) * 0.6 + noise2(z / 0.45, y / 0.45, SEED * 7 + 12) * 0.4;
            if ((1 - z / 4) * 1.3 + (nz - 0.5) * 1.6 + (T() - 0.5) * 0.3 < 0.64) continue;
            pts.push([s0, y, (0.16 + 0.45 * T() * T()) * (0.7 + 0.5 * (1 - z / 4))]);
          }
        }
        if (pts.length) padsOn(g, k.base, k.e, pts, up > 0.5 ? 0.62 : 0.9);
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
  {
    const K = rand(SEED * 29 + 3);
    for (let i = 0; i < 200; i++) {
      const u = K() * 4 - 2, side = Math.floor(K() * 4);
      const t = u / 2;
      const [x, y] = side === 0 ? [t * 7.4, 4.45] : side === 1 ? [t * 7.4, -4.0] : side === 2 ? [7.5, t * 4.3] : [-7.35, t * 4.3];
      const nz = noise2(x / 1.7, y / 1.7, SEED + 77);
      if (nz < 0.38) continue;
      skirt.push([x + (K() - 0.5) * 0.5, y + 0.25 + (K() - 0.5) * 0.4, (0.18 + 0.45 * K() * K()) * (0.6 + nz)]);
    }
  }
  const drawSkirt = (g: Ctx, e: Eye): void => {
    const across = Math.hypot(e.ux, e.uy);
    const ps: Pad[] = [];
    for (const [x, y, rr] of skirt) {
      // Only on the side of it the eye sees, and up the face a little, at its foot.
      if (x * e.toward[0] + y * e.toward[1] <= 1.5) continue;
      const [px, py] = proj(e, [x, y, 0.15 + rr * 0.3]);
      ps.push([px, py, rr * across * 1.15, rr * across * 0.75]);
    }
    drawPads(g, ps);
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
  const flowers: Array<[number, number, number, number]> = [[2.3, 5.5, 0.34, 0], [-1.7, 5.85, 0.3, 2], [-8.5, -1.9, 0.3, 1], [8.6, -1.4, 0.28, 3], [5.4, 5.1, 0.26, 4], [-5.3, 5.3, 0.27, 0]];
  // Which clumps are up, and their colours, off the way it was set: no two facings of it are dressed alike.
  const Fv = rand(SEED * 53 + ['s', 'e', 'n', 'w'].indexOf(facing) * 101);
  flowers.forEach(([x, y, big, c0], i) => {
    if (i > 1 && Fv() < 0.35) return;
    const c = c0 + Math.floor(Fv() * 3);
    things.push({
      x, y, reach: [[x, y, 7]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0]);
        flowerClump(g, px, py, FLOWERS[c % FLOWERS.length], SEED * 1000 + i * 7, big);
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

/** How far a strand of ivy reaches at its full growth, in metres: the ivy's own table, the few this stone uses. */
const STRAND_REACH_M = (kind: 'climb' | 'vine' | 'hang', v: number): number => ({ climb: [0.6, 0.9, 1.25], vine: [1.2, 1.8, 2.6], hang: [0.45, 0.7, 1.0] }[kind][v] ?? 1);

/** A small spray of flowers on ivy, at a stone this size: the Runestones' sprays, smaller. */
function blossomSmall(g: Ctx, x: number, y: number, colour: string, R: () => number): void {
  const col = { white: ['#fbf8ef', '#7f988a', '#efc23f'], pink: ['#f0a3b7', '#a85f75', '#f6d467'] }[colour === 'pink' ? 'pink' : 'white'];
  for (let i = 0; i < 3; i++) {
    const cx = x + (R() - 0.5) * 2.2, cy = y + (R() - 0.5) * 1.8, r = 0.6 + R() * 0.2;
    g.beginPath();
    g.arc(cx, cy, r + 0.3, 0, TAU);
    g.fillStyle = col[1];
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = col[0];
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r * 0.38, 0, TAU);
    g.fillStyle = col[2];
    g.fill();
  }
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
        { w: ROUNDEL_W, noDayHalo: true, gold: true }));
      // The line: its rows catch the light after dark, faintly, the lowest first.
      model.rows.slice().reverse().forEach((row, j) => {
        if (!row.length) return;
        const x0r = Math.min(...row.map((m) => m.x)), x1r = Math.max(...row.map((m) => m.x));
        const half = (x1r - x0r) / 2 + MARK_W;
        glows.push(bakeGlow(M, scale, (h) => rowPath(h, row), (x0r + x1r) / 2, row[0].z, half, j, false, { w: 0.17, faint: 0.6, nightOnly: true }));
      });
    } else {
      glows.push(bakeGlow(M, scale, (h) => glyphPath(h, 'star6', ROUNDEL.x, ROUNDEL.z - 0.3, ROUNDEL.r * 0.45), ROUNDEL.x, ROUNDEL.z - 0.3, ROUNDEL.r * 0.45, 0, false,
        { w: ROUNDEL_W, faint: 0.8, noDayHalo: true, gold: true }));
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
