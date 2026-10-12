/**
 * The grid the interface is laid on, in interface pixels.
 *
 * Every window, the status panel and the toolbar sit on whole cells and are
 * whole cells big, so their edges line up and two of them can share one. None
 * may cover another, and none may cover the clear patch round your character
 * in the middle of the screen. Pure geometry here; the dragging, the drawing of
 * the grid and the seams are in `src/ui/windows.ts` and
 * `src/ui/runecut-dress.ts`.
 */

/** One cell of the grid, across and down. */
export const CELL = 24;
/** Every this many cells a grid line is drawn heavier, for counting by eye. */
export const CELL_MAJOR = 4;
/** The clear patch round your character, in cells across and down, at most. */
export const CLEAR_CELLS = 14;
/** Nor more than this share of the shorter side of the screen. */
const CLEAR_SHARE = 0.4;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const snap = (v: number): number => Math.round(v / CELL) * CELL;
/** Up to a whole number of cells. */
export const cells = (v: number): number => Math.ceil(v / CELL - 1e-6) * CELL;

/** Two boxes overlap only if they share more than an edge: pieces may touch, never cover one another. */
export const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The clear patch for a screen `w` by `h`: square, on grid lines, round the middle, where the camera keeps your character. */
export function clearPatch(w: number, h: number): Box {
  const n = Math.max(4, Math.min(CLEAR_CELLS, Math.floor((Math.min(w, h) * CLEAR_SHARE) / CELL)));
  const side = n * CELL;
  return { x: snap(w / 2 - side / 2), y: snap(h / 2 - side / 2), w: side, h: side };
}

/** Kept wholly on a screen `w` by `h`: up to its far edges, which are seldom on a whole cell. */
export function onScreen(r: Box, w: number, h: number): Box {
  return {
    ...r,
    x: Math.max(0, Math.min(w - r.w, r.x)),
    y: Math.max(0, Math.min(h - r.h, r.y)),
  };
}

/**
 * Where something `size` long lands along a screen `span` long, asked to be at
 * `v`: on the nearest whole cell, or against the screen's far edge where that
 * is nearer. A screen is seldom a whole number of cells, and without the edge
 * the last strip of it, up to a cell less a pixel wide, could not be reached.
 */
export function snapAt(v: number, size: number, span: number): number {
  const flush = Math.max(0, span - size);
  const cell = Math.max(0, Math.min(Math.floor(flush / CELL) * CELL, snap(v)));
  return Math.abs(flush - v) < Math.abs(cell - v) ? flush : cell;
}

/** A length that lands on a whole number of cells, or that reaches from `at` to the far edge of a screen `span` long. */
export const fits = (at: number, size: number, span: number): boolean => size % CELL === 0 || at + size === span;

/** Every place along one axis something `size` long can land: each whole cell, and against the far edge. */
function stops(size: number, span: number): number[] {
  const flush = Math.max(0, span - size), out: number[] = [];
  for (let v = 0; v <= flush; v += CELL) out.push(v);
  if (out[out.length - 1] !== flush) out.push(flush);
  return out;
}

const free = (r: Box, walls: Box[]): boolean => !walls.some((b) => overlap(r, b));

/**
 * Where a box asked to go at `r` lands: snapped to cells and kept on the
 * screen; and if that spot covers one of `walls`, the nearest free spot of the
 * same size, cell for cell. Null when there is no free spot of that size
 * anywhere.
 */
export function placeFor(r: Box, walls: Box[], w: number, h: number): { r: Box; bumped: boolean } | null {
  const s = onScreen({ x: snapAt(r.x, r.w, w), y: snapAt(r.y, r.h, h), w: r.w, h: r.h }, w, h);
  if (free(s, walls)) return { r: s, bumped: false };
  let best: Box | null = null;
  let bestD = Infinity;
  const xs = stops(r.w, w);
  for (const y of stops(r.h, h)) {
    for (const x of xs) {
      const c = { x, y, w: r.w, h: r.h };
      const d = (c.x - r.x) ** 2 + (c.y - r.y) ** 2;
      if (d < bestD && free(c, walls)) {
        best = c;
        bestD = d;
      }
    }
  }
  return best ? { r: best, bumped: true } : null;
}

/**
 * A new size for a box at `at`, asked to be `w` by `h`: snapped, no smaller
 * than `min`, on the screen; and if it would cover one of `walls`, stopped at
 * that edge: the biggest it can be, no wider or taller than asked. Its top
 * left corner stays put.
 */
export function sizeFor(at: Box, w: number, h: number, min: { w: number; h: number }, walls: Box[], sw: number, sh: number): { r: Box; bumped: boolean } {
  // Whole cells, or out to the screen's far edge when asked to within half a cell of it.
  const length = (asked: number, from: number, span: number, least: number): number => {
    const room = span - from;
    return Math.max(least, asked >= room - CELL / 2 ? room : Math.min(snap(asked), Math.floor(room / CELL) * CELL));
  };
  const r = { x: at.x, y: at.y, w: length(w, at.x, sw, min.w), h: length(h, at.y, sh, min.h) };
  if (free(r, walls)) return { r, bumped: false };
  // The biggest box no bigger than asked that fits: for each width, the tallest height that does.
  const down = (from: number, least: number): number[] => {
    const out = [from];
    for (let v = Math.floor((from - 1) / CELL) * CELL; v >= least; v -= CELL) out.push(v);
    return out;
  };
  let best: Box | null = null;
  for (const cw of down(r.w, min.w)) {
    for (const ch of down(r.h, min.h)) {
      const c = { ...r, w: cw, h: ch };
      if (!free(c, walls)) continue;
      if (!best || c.w * c.h > best.w * best.h) best = c;
      break;
    }
  }
  return { r: best ?? { ...at }, bumped: true };
}

/** A shared edge: `a` is left of or above `b`; `at` is the line, `s0`..`s1` the stretch along it. */
export interface Seam {
  a: string;
  b: string;
  vertical: boolean;
  at: number;
  s0: number;
  s1: number;
}

/** Every stretch of edge two of the pieces share. */
export function seamsOf(pieces: Array<{ id: string; box: Box }>): Seam[] {
  const out: Seam[] = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let k = i + 1; k < pieces.length; k++) {
      for (const [p, q] of [[pieces[i], pieces[k]], [pieces[k], pieces[i]]]) {
        const a = p.box, b = q.box;
        if (a.x + a.w === b.x) {
          const s0 = Math.max(a.y, b.y), s1 = Math.min(a.y + a.h, b.y + b.h);
          if (s1 > s0) out.push({ a: p.id, b: q.id, vertical: true, at: b.x, s0, s1 });
        }
        if (a.y + a.h === b.y) {
          const s0 = Math.max(a.x, b.x), s1 = Math.min(a.x + a.w, b.x + b.w);
          if (s1 > s0) out.push({ a: p.id, b: q.id, vertical: false, at: b.y, s0, s1 });
        }
      }
    }
  }
  return out;
}

export const seamKey = (s: Seam): string => `${s.a}|${s.b}|${s.vertical ? 'v' : 'h'}|${s.at}|${s.s0}|${s.s1}`;

/** A stretch of one of a piece's own sides that touches a neighbour, measured along that side from the piece's own corner. */
export interface Join {
  side: 'left' | 'right' | 'top' | 'bottom';
  s0: number;
  s1: number;
}

/** The stretches of a piece's sides that touch a neighbour. */
export function joinsOf(id: string, box: Box, seams: Seam[]): Join[] {
  const out: Join[] = [];
  for (const s of seams) {
    if (s.a !== id && s.b !== id) continue;
    const off = s.vertical ? box.y : box.x;
    const side = s.vertical ? (s.a === id ? 'right' : 'left') : (s.a === id ? 'bottom' : 'top');
    out.push({ side, s0: s.s0 - off, s1: s.s1 - off });
  }
  return out;
}
