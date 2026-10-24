import type { View } from './view';

/**
 * The ground, kept as pictures a block of the drawing at a time
 * (`Renderer.renderFrame`).
 *
 * The ground is drawn a line down the screen at a time, each line's ground
 * and then whatever stands on that line, so the line in front comes down over
 * the feet of what stands behind it. A block is a run of lines and a stretch
 * across them, and its picture keeps each line's ground on its own: laid down
 * where that line's ground was drawn, it comes in the same order as ever.
 *
 * Inside a line the tiles are laid in runs. A tile drawn as it always was --
 * one with water on it, flowers nodding on it, a flight of steps, ground
 * nobody has seen, a face folded over a cliff -- ends the run before it, and a
 * tile something is built on ends the run it is in, so what is built is drawn
 * over the ground of its own run and under the next. Each run is one blit.
 *
 * A picture is for one view, one zoom and one screen, and is put down on
 * whole device pixels (`Renderer.render`). It is out of date when any tile in
 * it or near enough to be read changes (`touch`), when what is remembered of
 * the ground in it changes (`forgetBox`), and its tiles are checked each frame
 * against what it was made of; under a new sun it is kept until it is made
 * again.
 */

/** A tile laid from the picture: ground in sight rather than remembered; something drawn on it after its ground. */
export const BAKED = 1;
export const LIT = 2;
export const AFTER = 4;
/** Ground nobody has seen, laid flat in the void's colour. */
export const VOID = 8;

/** One run of a line's tiles in a block's picture. */
export interface GroundRun {
  /** The block's picture, and where the run is in it and its size, in device pixels. */
  cv: HTMLCanvasElement;
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Where it goes on the screen in device pixels, less the camera's whole pixels. */
  dx: number;
  dy: number;
  /** The frame it was last laid in, and the last it could not be. */
  laid: number;
  refused: number;
  /**
   * The line width, join and cap its first tile found the canvas left with,
   * which the grid is stroked in, and those its tiles left it with: laid only
   * where the canvas is as it was, and left as they would have left it:
   * null where they did not change it.
   */
  width0: number;
  join0: CanvasLineJoin;
  cap0: CanvasLineCap;
  width: number | null;
  join: CanvasLineJoin | null;
  cap: CanvasLineCap | null;
}

/** One line of a block. */
export interface GroundLine {
  /** Each step across the block: nought for a tile drawn as it always was, or `BAKED` and the rest. */
  cls: Uint8Array;
  /** The moss in each paved tile in sight's joints when it was made, or -1 (`Renderer.mossStage`). */
  moss: Int8Array;
  /** The run each step is in, or -1. */
  run: Int16Array;
  runs: GroundRun[];
  /** The top and bottom of its runs on the screen, as `GroundRun.dy` is. */
  y0: number;
  y1: number;
  /** What it was last found as it was made under (`Renderer.groundSig`), and the sight then. */
  sig: string;
  vis: number;
}

export interface GroundChunk {
  cd: number;
  ce: number;
  lines: GroundLine[];
  cv: HTMLCanvasElement | null;
  pixels: number;
  /** The colours it was made in (`Renderer.sunEpoch`). */
  sun: number;
  /** Something in it changed: not to be laid again until made again. */
  dead: boolean;
  /** Its tiles were not what it was made of, on some line: to be made again. */
  stale: boolean;
  /** Whether any of it is remembered ground. */
  mem: boolean;
  /** The frame it was last asked for. */
  used: number;
  /** The colour its unseen ground was laid in, or null for none. */
  voidInk: string | null;
  /** The sight (`Vision.revision`) when what is seen in it last changed: each line is checked again past it. */
  vis: number;
  /**
   * When it was made (`performance.now`), and how long one found out of date
   * soon after it was made waits to be made again, doubled each time: ground
   * whose sight or whose grid comes and goes frame to frame is drawn as it
   * always was rather than made again every frame.
   */
  made: number;
  holdFor: number;
  hold: number;
}

/** How soon after it was made a block out of date is held off being made again; and the least and most it is held. */
export const HOLD_WITHIN = 1000;
export const HOLD_LEAST = 500;
export const HOLD_MOST = 8000;

/** A block found out of date: to be made again, after a wait if it was made only just now. */
export function staled(c: GroundChunk, now: number): void {
  if (c.stale) return;
  c.stale = true;
  if (now - c.made < HOLD_WITHIN) {
    c.holdFor = Math.min(HOLD_MOST, Math.max(HOLD_LEAST, c.holdFor * 2));
    c.hold = now + c.holdFor;
  }
}

const chunkId = (cd: number, ce: number): number => (cd + 32768) * 65536 + (ce + 32768);

/** Tiles touched before the list gives up and says all of them. */
const TOUCHED_MOST = 4096;
/** How far a change reaches, in tiles: a tile's edges and colour read its neighbours, and a wood's ground theirs. */
const REACH = 2;

export class GroundChunks {
  /** What the pictures are for: the view, the zoom, the screen's fraction of a pixel and the block's size. */
  key = '';
  /** Lines down and lattice steps across a block. */
  lines = 16;
  across = 24;
  readonly map = new Map<number, GroundChunk>();
  pixels = 0;
  private touched: number[] = [];
  private touchedAll = false;

  get(cd: number, ce: number): GroundChunk | undefined {
    return this.map.get(chunkId(cd, ce));
  }

  set(c: GroundChunk): void {
    const id = chunkId(c.cd, c.ce);
    const had = this.map.get(id);
    if (had) this.pixels -= had.pixels;
    this.map.set(id, c);
    this.pixels += c.pixels;
  }

  /** Everything gone: another view, zoom or screen. */
  reset(key: string, lines: number, across: number): void {
    this.key = key;
    this.lines = lines;
    this.across = across;
    this.map.clear();
    this.pixels = 0;
    this.touched.length = 0;
    this.touchedAll = false;
  }

  /** A tile of the world changed (`World.onChange`): the blocks round it are out of date, worked out next frame (`forgetTouched`). */
  touch(x: number, y: number): void {
    if (this.touchedAll || !this.map.size) return;
    if (this.touched.length >= TOUCHED_MOST * 2) {
      this.touchedAll = true;
      this.touched.length = 0;
      return;
    }
    this.touched.push(x, y);
  }

  /** The blocks the tiles touched since the last frame are in, out of date. */
  forgetTouched(V: View): void {
    if (this.touchedAll) {
      for (const c of this.map.values()) c.dead = true;
      this.touchedAll = false;
      return;
    }
    const t = this.touched;
    for (let i = 0; i < t.length; i += 2) this.forgetBox(V, t[i] - REACH, t[i + 1] - REACH, t[i] + REACH, t[i + 1] + REACH, false);
    t.length = 0;
  }

  /** Every block with any of the tiles from (x0, y0) to (x1, y1) in it, out of date; or only those with remembered ground in them. */
  forgetBox(V: View, x0: number, y0: number, x1: number, y1: number, memOnly: boolean): void {
    if (!this.map.size) return;
    for (const c of this.inBox(V, x0, y0, x1, y1)) if (!memOnly || c.mem) c.dead = true;
  }

  /** What is in sight changed from (x0, y0) to (x1, y1), or everywhere: the blocks there are to be checked again. */
  sightBox(V: View, x0: number, y0: number, x1: number, y1: number, revision: number): void {
    for (const c of this.inBox(V, x0, y0, x1, y1)) c.vis = revision;
  }

  sightAll(revision: number): void {
    for (const c of this.map.values()) c.vis = revision;
  }

  /** The blocks with any of the tiles from (x0, y0) to (x1, y1) in them. */
  private *inBox(V: View, x0: number, y0: number, x1: number, y1: number): Iterable<GroundChunk> {
    let dLo = Infinity, dHi = -Infinity, eLo = Infinity, eHi = -Infinity;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const d = V.d[0] + V.d[1] * x + V.d[2] * y;
      const e = V.e[0] + V.e[1] * x + V.e[2] * y;
      dLo = Math.min(dLo, d); dHi = Math.max(dHi, d);
      eLo = Math.min(eLo, e); eHi = Math.max(eHi, e);
    }
    const cd0 = Math.floor(dLo / this.lines), cd1 = Math.floor(dHi / this.lines);
    const ce0 = Math.floor(eLo / this.across), ce1 = Math.floor(eHi / this.across);
    if ((cd1 - cd0 + 1) * (ce1 - ce0 + 1) > this.map.size) {
      for (const c of this.map.values()) if (c.cd >= cd0 && c.cd <= cd1 && c.ce >= ce0 && c.ce <= ce1) yield c;
      return;
    }
    for (let cd = cd0; cd <= cd1; cd++) {
      for (let ce = ce0; ce <= ce1; ce++) {
        const c = this.map.get(chunkId(cd, ce));
        if (c) yield c;
      }
    }
  }

  /** Every block with remembered ground in it, out of date. */
  forgetMem(): void {
    for (const c of this.map.values()) if (c.mem) c.dead = true;
  }

  /** Put away what has gone longest unasked for, down to `most` pixels, and never what this frame has asked for. */
  evict(most: number, frame: number): void {
    if (this.pixels <= most) return;
    const old = [...this.map.values()].filter((c) => c.used !== frame).sort((a, b) => a.used - b.used);
    for (const c of old) {
      if (this.pixels <= most) break;
      this.map.delete(chunkId(c.cd, c.ce));
      this.pixels -= c.pixels;
    }
  }
}
