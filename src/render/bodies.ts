/**
 * Where the pictures of bodies are kept, and the frame's list of bodies to draw (`../render/figure.ts` drawStill and the
 * loops, `drawBodies`).
 *
 * A body's picture is a slot on a page: one canvas holding a grid of pictures all of one size, so the pictures kept are a
 * few large canvases rather than hundreds of small ones. A small canvas is drawn by the processor in a browser that draws
 * a large one on the graphics chip (Chrome's least is about 128 by 128), and a sculpted body copied onto one is read back
 * off the chip; on a page it stays on the chip, and putting it down on the screen is a copy from chip to chip.
 *
 * A body to draw is asked for while the frame is drawn (`ask`), the picture it had put down meanwhile, and the bodies
 * asked for are drawn together at the end of the frame.
 */

/** The clock bodies are timed by: the page's own, but for a test whose page clock is driven (`bodyKnobs`). */
const clock = { now: (): number => performance.now() };

/** What the measures read and set (`supabase/test/bodies.ts`): the clock, the running totals, the quality held. */
export const bodyKnobs = {
  clock,
  /** Since the page opened: milliseconds spent drawing bodies, bodies drawn, bodies asked for and left for a later frame; the quality step now. */
  stats: { ms: 0, drawn: 0, deferred: 0, step: 0 },
  /** Hold the quality at a step (0 the best), or let it go again (null). */
  pin: (step: number | null): void => {
    pinned = step;
  },
};
let pinned: number | null = null;
/** Read by the quality (`qualityStep`) once it is in. */
export const pinnedStep = (): number | null => pinned;

/* ---- pages ---------------------------------------------------------------------------------------------------- */

/** Clear device pixels round each slot, so a picture put down scaled never takes in its neighbour's edge. */
const GUTTER = 2;
/** Slots a page holds, at most, and the side of a page, at most. */
const SLOTS = 1;
const PAGE_SIDE = 2048;

interface Page { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; cols: number; rows: number; free: number[]; used: number; size: Size }
interface Size { w: number; h: number; pages: Page[] }
const sizes = new Map<string, Size>();
/** Device pixels of pages held, for the line (`bodiesLine`). */
let pagePixels = 0;

/**
 * A picture of a body: its slot on its page (`x`, `y`, `w`, `h`, device pixels), where the feet are in it (`ox`, `oy`), the
 * device pixels to a unit of the context it was drawn for and the zoom it was drawn at, whether it is still there (a
 * picture let go has its slot given to another), and a number that changes whenever it is drawn.
 */
export interface Pic {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  x: number; y: number; w: number; h: number;
  ox: number; oy: number; dev: number; zoom: number;
  live: boolean;
  ver: number;
  page: Page;
  slot: number;
}
let vers = 0;

/** A slot `w` by `h` for a picture, on a page of that size with one free or a new one. */
export function picNew(w: number, h: number, ox: number, oy: number, dev: number, zoom: number): Pic {
  const id = `${w}x${h}`;
  let size = sizes.get(id);
  if (!size) sizes.set(id, (size = { w, h, pages: [] }));
  let page = size.pages.find((p) => p.free.length);
  if (!page) {
    const cw = w + 2 * GUTTER, ch = h + 2 * GUTTER;
    const cols = Math.max(1, Math.min(SLOTS, Math.floor(PAGE_SIDE / cw)));
    const rows = Math.max(1, Math.min(Math.ceil(SLOTS / cols), Math.floor(PAGE_SIDE / ch)));
    const canvas = document.createElement('canvas');
    canvas.width = cols * cw;
    canvas.height = rows * ch;
    page = { canvas, g: canvas.getContext('2d') as CanvasRenderingContext2D, cols, rows, free: [], used: 0, size };
    for (let i = cols * rows - 1; i >= 0; i--) page.free.push(i);
    size.pages.push(page);
    pagePixels += canvas.width * canvas.height;
  }
  const slot = page.free.pop() as number;
  page.used++;
  const cw = w + 2 * GUTTER, ch = h + 2 * GUTTER;
  return { canvas: page.canvas, g: page.g, x: (slot % page.cols) * cw + GUTTER, y: Math.floor(slot / page.cols) * ch + GUTTER, w, h, ox, oy, dev, zoom, live: true, ver: ++vers, page, slot };
}

/** Let a picture go: its slot to the next asked for, and its page with it once the page is empty. */
export function picDrop(p: Pic | null | undefined): void {
  if (!p?.live) return;
  p.live = false;
  const page = p.page;
  page.free.push(p.slot);
  page.used--;
  if (page.used > 0) return;
  const size = page.size;
  size.pages.splice(size.pages.indexOf(page), 1);
  pagePixels -= page.canvas.width * page.canvas.height;
  page.canvas.width = page.canvas.height = 0;
  if (!size.pages.length) sizes.delete(`${size.w}x${size.h}`);
}

/** Ready a picture's slot to be drawn into: cleared, held to the slot, the feet at the context's nought. Undone by `g.restore()`. */
export function picBegin(p: Pic): CanvasRenderingContext2D {
  const g = p.g;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(p.x - GUTTER, p.y - GUTTER, p.w + 2 * GUTTER, p.h + 2 * GUTTER);
  g.beginPath();
  g.rect(p.x, p.y, p.w, p.h);
  g.clip();
  g.setTransform(p.dev, 0, 0, p.dev, p.x + p.ox, p.y + p.oy);
  return g;
}

/**
 * Put a picture down with the feet at (sx, sy) on `ctx`, at `zoom`: at the zoom it was drawn at, on a whole device pixel
 * when `snap`; at another, stretched to it about the feet. Where it went, in `ctx`'s units.
 */
export function picPut(ctx: CanvasRenderingContext2D, p: Pic, sx: number, sy: number, zoom: number, snap: boolean): { x: number; y: number; w: number; h: number } {
  const k = zoom / p.zoom, s = k / p.dev;
  let x = sx - p.ox * s, y = sy - p.oy * s;
  if (snap && Math.abs(k - 1) < 1e-6) {
    x = Math.round(x * p.dev) / p.dev;
    y = Math.round(y * p.dev) / p.dev;
  }
  const w = p.w * s, h = p.h * s;
  ctx.drawImage(p.canvas, p.x, p.y, p.w, p.h, x, y, w, h);
  return { x, y, w, h };
}

/** Mark a picture drawn afresh. */
export const picDrawn = (p: Pic): void => {
  p.ver = ++vers;
};

/* ---- the frame's bodies to draw ---------------------------------------------------------------------------------- */

/**
 * A body to draw: `key` names what it is drawn into (a body's own picture, or a frame of a loop), so a body asked for twice
 * in a frame is drawn once; `prio` how much it is wanted (0 your own body, 1 a body with nothing to put down, 2 one put
 * down at another size, 3 one due again), `late` how overdue it is among those; its size (`k`, device pixels to a figure
 * unit; its picture `w` by `h` with the feet at `ox`, `oy`); how many GL drawings it makes (`tiles`: two in the water);
 * `draw`, which draws it into a context whose nought is its feet; and `done`, given its picture once it is drawn.
 */
export interface Job {
  key: string;
  prio: number;
  late: number;
  k: number;
  w: number; h: number; ox: number; oy: number; dev: number; zoom: number;
  tiles: number;
  draw: (g: CanvasRenderingContext2D) => void;
  done: (p: Pic) => void;
}

const queue = new Map<string, Job>();
/** Ask for a body to be drawn at the end of the frame; asked again under the same key, the last ask is the one drawn. */
export function ask(job: Job): void {
  queue.set(job.key, job);
}
/** Whether a body under `key` has been asked for this frame. */
export const asked = (key: string): boolean => queue.has(key);

/** The bodies asked for this frame, most wanted first, the queue emptied. */
export function takeAsked(): Job[] {
  const all = [...queue.values()].sort((a, b) => a.prio - b.prio || b.late - a.late);
  queue.clear();
  return all;
}

/** A frame's bodies drawn: `ms` it took, `n` drawn, `left` asked for and not drawn. */
export function spent(ms: number, n: number, left: number): void {
  const st = bodyKnobs.stats;
  st.ms += ms;
  st.drawn += n;
  st.deferred += left;
}

export const bodyClock = (): number => clock.now();
export const pagesHeld = (): number => pagePixels;

/* ---- pictures kept for a loop ------------------------------------------------------------------------------------- */

/**
 * Pictures shared between bodies (the frames of a loop: a stride, standing about), by key, up to `most` device pixels of
 * them, the longest unused let go first.
 */
export class KeptPics {
  private map = new Map<string, Pic>();
  private px = 0;
  constructor(readonly most: number) {}
  /** The picture under `key`, marked used. */
  get(key: string): Pic | undefined {
    const p = this.map.get(key);
    if (!p) return undefined;
    this.map.delete(key);
    if (!p.live) {
      this.px -= p.w * p.h;
      return undefined;
    }
    this.map.set(key, p);
    return p;
  }
  /** The picture under `key`, not marked used. */
  peek(key: string): Pic | undefined {
    const p = this.map.get(key);
    return p?.live ? p : undefined;
  }
  /** Keep `p` under `key`, letting the longest unused go while it would not fit. */
  set(key: string, p: Pic): void {
    const old = this.map.get(key);
    if (old) {
      this.map.delete(key);
      this.px -= old.w * old.h;
      picDrop(old);
    }
    while (this.px + p.w * p.h > this.most && this.map.size) {
      const [k, gone] = this.map.entries().next().value as [string, Pic];
      this.map.delete(k);
      this.px -= gone.w * gone.h;
      picDrop(gone);
    }
    this.map.set(key, p);
    this.px += p.w * p.h;
  }
  /** Device pixels held. */
  get pixels(): number {
    return this.px;
  }
}
