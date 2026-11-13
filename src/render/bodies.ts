/**
 * Where the pictures of bodies are kept, and the frame's list of bodies to draw (`../render/figure.ts` drawStill and the
 * loops, `drawBodies`).
 *
 * A body's picture is a bitmap: drawn on an offscreen canvas kept for its size and handed over whole
 * (`transferToImageBitmap`), no copy made, where it was a canvas of its own. A small canvas is drawn by the processor in a
 * browser that draws a large one on the graphics chip (Chrome's least is about 128 by 128), so a sculpted body copied onto
 * one was read back off the chip, and sent up again every time it was put down; a bitmap is made where the canvas it came
 * off was, and put down from there. Pages of many pictures on one large canvas were tried: drawing one picture again on a
 * page that had been put down from copied the whole page first, which cost more than it saved.
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

/* ---- pictures ------------------------------------------------------------------------------------------------- */

/**
 * A picture of a body: what it is put down from (`src`, its `w` by `h` device pixels at `x`, `y`), where the feet are in
 * it (`ox`, `oy`), the device pixels to a unit of the context it was drawn for and the zoom it was drawn at, whether it is
 * still kept (`live`: one let go is not put down again), and a number that changes whenever it is drawn.
 */
export interface Pic {
  src: CanvasImageSource & { width: number; height: number };
  x: number; y: number; w: number; h: number;
  ox: number; oy: number; dev: number; zoom: number;
  live: boolean;
  ver: number;
}
let vers = 0;

/** Whether pictures are made as bitmaps (`OffscreenCanvas.transferToImageBitmap`), as wherever there is an offscreen canvas. */
const BITMAPS = typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.transferToImageBitmap === 'function';
/** The canvas each size of picture is drawn on before it is handed over as a bitmap: one a size, kept. */
const pads = new Map<string, { c: OffscreenCanvas | HTMLCanvasElement; g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; at: number }>();
/** Device pixels of pictures held, for the line (`bodiesLine`). */
let held = 0;

/** A picture `w` by `h`, not yet drawn: nothing to put down until it is (`picBegin`, `picEnd`). */
export function picNew(w: number, h: number, ox: number, oy: number, dev: number, zoom: number): Pic {
  return { src: EMPTY, x: 0, y: 0, w, h, ox, oy, dev, zoom, live: true, ver: ++vers };
}
const EMPTY = { width: 0, height: 0 } as unknown as Pic['src'];

/** Let a picture go: its bitmap closed, so the memory goes back at once. */
export function picDrop(p: Pic | null | undefined): void {
  if (!p?.live) return;
  p.live = false;
  if (p.src !== EMPTY) held -= p.w * p.h;
  if (typeof ImageBitmap !== 'undefined' && p.src instanceof ImageBitmap) p.src.close();
  p.src = EMPTY;
}

/**
 * The context to draw picture `p` on: cleared, held to its size, the feet at its nought. Then `picEnd`, which takes what
 * was drawn as the picture.
 */
export function picBegin(p: Pic): CanvasRenderingContext2D {
  const id = `${p.w}x${p.h}`;
  let pad = pads.get(id);
  if (!pad) {
    const c = BITMAPS ? new OffscreenCanvas(p.w, p.h) : document.createElement('canvas');
    c.width = p.w;
    c.height = p.h;
    pad = { c, g: c.getContext('2d') as CanvasRenderingContext2D, at: 0 };
    pads.set(id, pad);
  }
  pad.at = performance.now();
  if (pads.size > 4) for (const [k, v] of pads) if (k !== id && pad.at - v.at > 5000) pads.delete(k);
  const g = pad.g as CanvasRenderingContext2D;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, p.w, p.h);
  g.setTransform(p.dev, 0, 0, p.dev, p.ox, p.oy);
  return g;
}
/** What was drawn since `picBegin(p)` taken as `p`'s picture (unless not to `keep`, a batch's first go): the pad's own bitmap, handed over without a copy; or, with no offscreen canvas, a copy. */
export function picEnd(p: Pic, keep = true): void {
  const pad = pads.get(`${p.w}x${p.h}`);
  if (!pad) return;
  (pad.g as CanvasRenderingContext2D).restore();
  if (!p.live || !keep) return;
  if (p.src !== EMPTY) held -= p.w * p.h;
  if (typeof ImageBitmap !== 'undefined' && p.src instanceof ImageBitmap) p.src.close();
  if (BITMAPS) p.src = (pad.c as OffscreenCanvas).transferToImageBitmap();
  else {
    const c = document.createElement('canvas');
    c.width = p.w;
    c.height = p.h;
    c.getContext('2d')?.drawImage(pad.c as HTMLCanvasElement, 0, 0);
    p.src = c;
  }
  held += p.w * p.h;
  p.ver = ++vers;
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
  if (p.src !== EMPTY) ctx.drawImage(p.src, p.x, p.y, p.w, p.h, x, y, w, h);
  return { x, y, w, h };
}

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
export const picturesHeld = (): number => held;

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
