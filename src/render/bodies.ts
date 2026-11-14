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

import { BODY_BUDGET_MS } from './bodybudget';

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
const pads = new Map<string, { c: OffscreenCanvas | HTMLCanvasElement; g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D }>();
/** Sizes of pad kept, at most: the longest unused let go first. A size is one zoom and screen, so a few are all a view uses. */
const PADS = 6;
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
    pad = { c, g: c.getContext('2d') as CanvasRenderingContext2D };
  }
  pads.delete(id);
  pads.set(id, pad);
  if (pads.size > PADS) pads.delete(pads.keys().next().value as string);
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

/** The bodies asked for this frame and the most of them its share of the budget allows, most wanted first; the queue emptied. */
export function takeAsked(soft: boolean): { take: Job[]; left: number } {
  const all = [...queue.values()].sort((a, b) => a.prio - b.prio || b.late - a.late);
  queue.clear();
  if (!perUnit) perUnit = soft ? FIRST_SOFT : FIRST_CARD;
  allow = Math.min(allow + BODY_BUDGET_MS, 2 * BODY_BUDGET_MS);
  const take: Job[] = [];
  let est = 0;
  for (const j of all) {
    if (j.prio > 0 && est >= allow) continue;
    take.push(j);
    est += costOf(j);
  }
  return { take, left: all.length - take.length };
}

/*
 * The budget. A frame may spend `BODY_BUDGET_MS` on bodies, on average: a quarter of a frame at sixty a second, leaving the
 * rest for the ground, the trees, the wildermon and the browser. What it does not spend carries to the next (up to a
 * second frame's), and a frame that spends more than it had is paid back by the frames after it, so a body that costs more
 * than a frame's share (on a processor-drawn GL a body is several frames' worth) is drawn every few frames rather than
 * never, and no frame draws more than one body past its share. Your own body is drawn whatever is left, and charged. What
 * a body costs is learnt as they are drawn: milliseconds for every device pixel of the pictures and a fixed share each
 * (`FIXED_PIXELS`), an average over the last few frames.
 */
let allow = 0;
let perUnit = 0;
/** A body's cost that is not its pixels, as pixels: setting up its draw, and its share of the wait for the GL. */
const FIXED_PIXELS = 40_000;
/** What a body is taken to cost before any is timed: about 30 ms on a processor-drawn GL, 1.5 ms on a card, at the zoom played at. */
const FIRST_SOFT = 30 / 65_000, FIRST_CARD = 1.5 / 65_000;
/** How far each frame's timing moves the cost learnt: further when bodies cost more than thought, so one dear frame is not followed by another. */
const LEARN = 0.25, LEARN_UP = 0.75;
const unitsOf = (w: number, h: number, tiles: number): number => (w * h + FIXED_PIXELS) * tiles;
const costOf = (j: Job): number => perUnit * unitsOf(j.w, j.h, j.tiles);
/** Milliseconds a body `w` by `h` device pixels is expected to take, from what bodies have taken so far. */
export const bodyCost = (w: number, h: number, tiles = 1): number => (perUnit || FIRST_CARD) * unitsOf(w, h, tiles);
/** Whether the bodies are over their budget: drawn more than their share lately, the frames after paying it back. */
export const bodiesBehind = (): boolean => allow < 0;

/** A frame's bodies drawn: `ms` it took for `jobs`, and `left` asked for and not drawn. */
export function spent(ms: number, jobs: Job[], left: number): void {
  const st = bodyKnobs.stats;
  st.ms += ms;
  st.drawn += jobs.length;
  st.deferred += left;
  lineFrame(ms, jobs.length, left);
  allow = Math.max(-20 * BODY_BUDGET_MS, allow - ms);
  const units = jobs.reduce((p, j) => p + unitsOf(j.w, j.h, j.tiles), 0);
  bodiesThisFrame += ms;
  if (units > 0 && ms > 0) perUnit += (ms / units - perUnit) * (ms / units > perUnit ? LEARN_UP : LEARN);
}

/*
 * The quality. Where frames run long and the bodies are a good part of why -- the middle frame over the last two seconds
 * longer than `SLOW_MS`, with the bodies a quarter of the time or more -- bodies are drawn a step smaller (their pictures
 * at `STEPS[n].scale` of the screen's pixels, stretched to size) and less often (`STEPS[n].rate` of their rates). Back a
 * step once the middle frame has been under `QUICK_MS` for `UP_AFTER` ms, and only if the bodies' time a frame grown by the
 * larger pictures (as their pixels: the square of the step in scale) would still leave it under `SLOW_MS`; and a step is
 * held `HOLD_MS` at least either way: so it does not go up and down from one moment to the next. Only how bodies are
 * drawn: nothing of the game.
 */
const STEPS = [{ scale: 1, rate: 1 }, { scale: 0.75, rate: 0.75 }, { scale: 0.5, rate: 0.5 }];
/** How many quality steps there are. */
export const QUALITY_STEPS = STEPS.length;
const SLOW_MS = 40, QUICK_MS = 28, WINDOW_MS = 2000, UP_AFTER = 4000, HOLD_MS = 2000, LOOK_EVERY = 500;
/** What What's new says of the quality (`src/ui/panels/news.ts`). */
export const QUALITY = { scales: STEPS.map((q) => q.scale), slow: SLOW_MS, quick: QUICK_MS, over: WINDOW_MS, up: UP_AFTER };
let step = 0, stepAt = -Infinity, quickSince = Infinity, lookedAt = 0, frameAt = 0;
/** The frames of the last `WINDOW_MS`: when each began, how long it was, and what of it went on the bodies. */
const lately: Array<{ at: number; ms: number; bodies: number }> = [];
let bodiesThisFrame = 0;

/** The step the quality is at (0 the best), and the share of the screen's pixels bodies are drawn at and of their rates. */
export const qualityStep = (): number => step;
export const qualityScale = (): number => STEPS[step].scale;
export const qualityRate = (): number => STEPS[step].rate;

/** A frame begins: the last one's length counted, and the quality looked at again twice a second. */
function frameBegins(): void {
  const now = clock.now();
  if (frameAt && now - frameAt < 1000) lately.push({ at: now, ms: now - frameAt, bodies: bodiesThisFrame });
  frameAt = now;
  bodiesThisFrame = 0;
  while (lately.length && now - lately[0].at > WINDOW_MS) lately.shift();
  if (pinned !== null) {
    step = Math.max(0, Math.min(STEPS.length - 1, pinned));
    bodyKnobs.stats.step = step;
    return;
  }
  if (now - lookedAt < LOOK_EVERY || lately.length < 10) return;
  lookedAt = now;
  const sorted = lately.map((f) => f.ms).sort((a, b) => a - b), middle = sorted[sorted.length >> 1];
  const all = lately.reduce((p, f) => p + f.ms, 0), bodies = lately.reduce((p, f) => p + f.bodies, 0);
  const held = now - stepAt < HOLD_MS;
  if (middle >= QUICK_MS) quickSince = Infinity;
  else if (quickSince === Infinity) quickSince = now;
  if (!held && step < STEPS.length - 1 && middle > SLOW_MS && bodies >= all / 4) {
    step++;
    stepAt = now;
    quickSince = Infinity;
  } else if (!held && step > 0 && now - quickSince >= UP_AFTER) {
    const up = STEPS[step - 1].scale / STEPS[step].scale;
    if (middle + (bodies / lately.length) * (up * up - 1) < SLOW_MS) {
      step--;
      stepAt = now;
      quickSince = now;
    }
  }
  bodyKnobs.stats.step = step;
}

/** Whether the zoom has stayed put long enough to make pictures at it (`Renderer.zoomSettled`): told every frame. */
let settled = true;
export function bodiesFrame(zoomSettled: boolean): void {
  settled = zoomSettled;
  frameBegins();
}
export const zoomSettled = (): boolean => settled;

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

/* ---- the line under the frame rate -------------------------------------------------------------------------------- */

/** The bodies' line under the frame rate (`Settings.timings`), and what it is made of since it was last written. */
const line = { text: '', frames: 0, ms: 0, drawn: 0, waiting: 0, at: 0 };
/** Seconds the line is averaged over: the layers' own (`TIMING_WINDOW` in `./timings.ts`). */
const LINE_WINDOW = 0.5;
/**
 * The bodies a frame, averaged over half a second: milliseconds drawing them, how many were drawn, how many asked for and
 * left for a later frame, and the quality step (the best the highest).
 */
export function bodiesLine(): string {
  return line.text;
}
function lineFrame(ms: number, drawn: number, waiting: number): void {
  line.frames++;
  line.ms += ms;
  line.drawn += drawn;
  line.waiting += waiting;
  const now = clock.now();
  if (now - line.at < LINE_WINDOW * 1000 && now >= line.at) return;
  const n = Math.max(1, line.frames);
  line.text = `bodies ${(line.ms / n).toFixed(1)} ms · ${(line.drawn / n).toFixed(1)} drawn · ${(line.waiting / n).toFixed(1)} waiting · quality ${STEPS.length - step}/${STEPS.length}`;
  line.frames = line.ms = line.drawn = line.waiting = 0;
  line.at = now;
}
