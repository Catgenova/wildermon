/**
 * The colour of the sea, a corner at a time, blended between corners.
 *
 * A tile of sea used to be one colour, picked by the depth under its middle,
 * so a shelving floor came out as a staircase of flat diamonds. Here the sea
 * as seen from above -- its floor, as much of it as the water lets show, under
 * the depth ramp's colour (`waterRgb`, `waterVeil`) -- is worked out at every
 * corner and kept as a tiny picture, one pixel a corner; stretched over the
 * screen, the browser's smoothing blends between the four corners of every
 * tile, so the colour runs on smoothly from one tile to the next.
 *
 * The sea's surface is flat at nought, so the stretch from the picture to the
 * screen is one plain affine map for the whole view (`paint`, for
 * `Renderer.drawSea`). A pond's is the same map raised to its level, its
 * water laid over its floor a tile at a time (`pond`).
 *
 * The sea's pictures are kept a block at a time and made again when the ground
 * under a block changes (`touched`). A pond's is made for its corners and
 * level, and made again while it is still rising.
 */
import type { Camera } from '../engine/camera';
import type { PondWater } from '../world/springs';
import { TILE_DEFS, TileType } from '../world/tiles';
import type { World } from '../world/world';
import { WATER_LIT, waterRgb, waterVeil } from './water';

/** Tiles a side in one block of the sea's picture. */
const BLOCK = 32;
/** The most blocks kept: enough for a far view of open water several times over. */
const KEEP = 400;
/** How far past its corners a block is laid over the next, in tiles: a hair. */
const SEAM = 0.05;
/** The deepest the ramp is worked out to, and the table it is read from, one entry a height unit. */
const TABLE_DEEP = 128;

/** A block's picture, a pixel a corner, and whether the sea is on any of it. */
interface Block {
  cv: HTMLCanvasElement;
  sea: boolean;
}

interface PondPicture {
  pattern: CanvasPattern;
  level: number;
  x0: number;
  y0: number;
  frame: number;
}

/** A pixel's colour and veil for each whole depth, premade: the sea's floor is at whole heights. */
const TABLE: Uint8ClampedArray = (() => {
  const t = new Uint8ClampedArray((TABLE_DEEP + 1) * 4);
  for (let d = 0; d <= TABLE_DEEP; d++) {
    const [r, g, b] = waterRgb(d);
    t.set([r, g, b, Math.round(waterVeil(d) * 255)], d * 4);
  }
  return t;
})();

function putDepth(px: Uint8ClampedArray, i: number, depth: number): void {
  if (depth >= TABLE_DEEP) {
    px.set(TABLE.subarray(TABLE_DEEP * 4, TABLE_DEEP * 4 + 4), i);
    return;
  }
  const d = depth > 0 ? depth : 0;
  const k = Math.floor(d);
  const f = d - k;
  for (let c = 0; c < 4; c++) px[i + c] = TABLE[k * 4 + c] + (TABLE[k * 4 + 4 + c] - TABLE[k * 4 + c]) * f;
}

/**
 * The sea from above at a corner, into `px` at `i`: the ground round the
 * corner as the water lets it show -- the red taken out of it first and the
 * blue last, darker the deeper (as `Renderer.computeColor` has the floor) --
 * under the water's colour at its depth, solid.
 */
function putSea(w: World, cx: number, cy: number, px: Uint8ClampedArray, i: number): void {
  const depth = Math.max(0, -w.getHeight(cx, cy));
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = 0; k < 4; k++) {
    const tx = cx - (k & 1), ty = cy - (k >> 1);
    if (!w.inBounds(tx, ty)) continue;
    const c = (TILE_DEFS[w.getTile(tx, ty)] ?? TILE_DEFS[TileType.Sand]).color;
    r += c[0];
    g += c[1];
    b += c[2];
    n++;
  }
  if (!n) [r, g, b, n] = [...TILE_DEFS[TileType.Sand].color, 1] as [number, number, number, number];
  const under = Math.min(1, depth / WATER_LIT), keep = 1 - under, fade = Math.max(0.3, 1 - depth / 80);
  const d0 = Math.min(TABLE_DEEP, depth), k0 = Math.floor(d0) * 4, f = d0 - Math.floor(d0);
  const at = (c: number): number => TABLE[k0 + c] + ((TABLE[Math.min(TABLE_DEEP * 4, k0 + 4) + c] ?? TABLE[k0 + c]) - TABLE[k0 + c]) * f;
  const v = at(3) / 255;
  px[i] = (r / n) * (keep + under * 0.72) * fade * (1 - v) + at(0) * v;
  px[i + 1] = (g / n) * (keep + under * 0.86) * fade * (1 - v) + at(1) * v;
  px[i + 2] = (b / n) * (keep + under * 0.95) * fade * (1 - v) + at(2) * v;
  px[i + 3] = 255;
}

export class WaterTint {
  private blocks = new Map<number, Block>();
  private ponds = new WeakMap<PondWater, PondPicture>();
  private frame = 0;
  /** The view's map from the ground at height nought to the screen, this frame: a, b, c, d, e, f. */
  private m = [1, 0, 0, 1, 0, 0];
  private zoomHs = 0;
  private scratch: HTMLCanvasElement | null = null;
  private readonly at = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  constructor(private readonly world: World) {}

  /** Counts the changes to the ground under the sea, for a picture made of it to know it is out of date. */
  stamp = 0;

  /** The ground under a tile changed: the blocks holding its corners are made again when next drawn. */
  touched(x: number, y: number): void {
    for (let by = Math.floor((y - 1) / BLOCK); by <= Math.floor((y + 1) / BLOCK); by++) {
      for (let bx = Math.floor((x - 1) / BLOCK); bx <= Math.floor((x + 1) / BLOCK); bx++) {
        const key = by * 65536 + bx;
        if (this.blocks.get(key)?.sea) this.stamp++;
        this.blocks.delete(key);
      }
    }
  }

  /** Everything made again: a new world. */
  clear(): void {
    this.stamp++;
    this.blocks.clear();
    this.ponds = new WeakMap();
  }

  /** The view this frame is drawn from. */
  begin(cam: Camera, frame: number, heightScale: number): void {
    this.frame = frame;
    const ox = cam.worldToScreenX(0, 0), oy = cam.worldToScreenY(0, 0, 0);
    this.m[0] = cam.worldToScreenX(1, 0) - ox;
    this.m[1] = cam.worldToScreenY(1, 0, 0) - oy;
    this.m[2] = cam.worldToScreenX(0, 1) - ox;
    this.m[3] = cam.worldToScreenY(0, 1, 0) - oy;
    this.m[4] = ox;
    this.m[5] = oy;
    this.zoomHs = heightScale * cam.zoom;
  }

  /** Lay a picture whose pixel (0, 0) is the corner (x0, y0), at height `h`, onto the screen. */
  private place(p: CanvasPattern, x0: number, y0: number, h: number): void {
    const m = this.m;
    // The middle of a pixel is its corner: the picture starts half a pixel before the first.
    const ux = x0 - 0.5, uy = y0 - 0.5;
    const at = this.at;
    at.a = m[0];
    at.b = m[1];
    at.c = m[2];
    at.d = m[3];
    at.e = m[4] + m[0] * ux + m[2] * uy;
    at.f = m[5] + m[1] * ux + m[3] * uy - h * this.zoomHs;
    p.setTransform(at);
  }

  private canvas(w: number, h: number): CanvasRenderingContext2D {
    const cv = (this.scratch ??= document.createElement('canvas'));
    if (cv.width < w || cv.height < h) {
      cv.width = Math.max(cv.width, w);
      cv.height = Math.max(cv.height, h);
    }
    return cv.getContext('2d') as CanvasRenderingContext2D;
  }

  /** A picture of `w` by `h` corners, from their colours. */
  private picture(ctx: CanvasRenderingContext2D, px: ImageData): CanvasPattern {
    const cv = document.createElement('canvas');
    cv.width = px.width;
    cv.height = px.height;
    (cv.getContext('2d') as CanvasRenderingContext2D).putImageData(px, 0, 0);
    return ctx.createPattern(cv, 'no-repeat') as CanvasPattern;
  }

  /** A block's picture, made if it is not kept. */
  private block(bx: number, by: number): Block {
    const key = by * 65536 + bx;
    let b = this.blocks.get(key);
    if (b) return b;
    // The oldest made goes first.
    if (this.blocks.size >= KEEP) this.blocks.delete(this.blocks.keys().next().value as number);
    const n = BLOCK + 1;
    const px = this.canvas(n, n).createImageData(n, n);
    const w = this.world;
    const x0 = bx * BLOCK, y0 = by * BLOCK;
    let sea = false;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        putSea(w, x0 + i, y0 + j, px.data, (j * n + i) * 4);
        if (!sea && w.getHeight(x0 + i, y0 + j) < 0) sea = true;
      }
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    (cv.getContext('2d') as CanvasRenderingContext2D).putImageData(px, 0, 0);
    b = { cv, sea };
    this.blocks.set(key, b);
    return b;
  }

  /** The blocks under a rectangle of the screen at the sea's surface, as block coordinates: x0, y0, x1, y1. */
  private under(cam: Camera, sx0: number, sy0: number, sx1: number, sy1: number): [number, number, number, number] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) {
      const p = cam.screenToWorld(sx, sy, 0);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return [Math.floor(x0 / BLOCK), Math.floor(y0 / BLOCK), Math.floor(x1 / BLOCK), Math.floor(y1 / BLOCK)];
  }

  /**
   * Where on the screen the sea can be, within a rectangle of it: round the
   * blocks under it that have any sea, as left, top, right, bottom in the
   * screen's units; null where none has.
   */
  seaWithin(cam: Camera, sx0: number, sy0: number, sx1: number, sy1: number): [number, number, number, number] | null {
    const [bx0, by0, bx1, by1] = this.under(cam, sx0, sy0, sx1, sy1);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        if (!this.block(bx, by).sea) continue;
        for (const [cx, cy] of [[bx, by], [bx + 1, by], [bx, by + 1], [bx + 1, by + 1]]) {
          const x = cam.worldToScreenX(cx * BLOCK, cy * BLOCK), y = cam.worldToScreenY(cx * BLOCK, cy * BLOCK, 0);
          l = Math.min(l, x);
          t = Math.min(t, y);
          r = Math.max(r, x);
          b = Math.max(b, y);
        }
      }
    }
    if (!(l <= r)) return null;
    return [Math.max(sx0, l), Math.max(sy0, t), Math.min(sx1, r), Math.min(sy1, b)];
  }

  /**
   * The sea from above over a rectangle of the screen (in `g`'s own units, the
   * screen's), at its surface: each block of corners under it with any sea on
   * it stretched out from corner to corner, smoothed between them as it is
   * stretched.
   */
  paint(g: CanvasRenderingContext2D, cam: Camera, sx0: number, sy0: number, sx1: number, sy1: number): void {
    const [bx0, by0, bx1, by1] = this.under(cam, sx0, sy0, sx1, sy1);
    const m = this.m;
    const was = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const b = this.block(bx, by);
        if (!b.sea) continue;
        const ox = bx * BLOCK, oy = by * BLOCK;
        g.save();
        g.transform(m[0], m[1], m[2], m[3], m[4] + m[0] * ox + m[2] * oy, m[5] + m[1] * ox + m[3] * oy);
        // From the middle of its first pixel to the middle of its last: corner to corner, and a hair over, so the blocks meet with no seam.
        g.drawImage(b.cv, 0.5 - SEAM, 0.5 - SEAM, BLOCK + 2 * SEAM, BLOCK + 2 * SEAM, -SEAM, -SEAM, BLOCK + 2 * SEAM, BLOCK + 2 * SEAM);
        g.restore();
      }
    }
    g.imageSmoothingEnabled = was;
  }

  /** What a pond's water is filled with, standing at `level`: the colour of each of its corners by its depth there. */
  pond(ctx: CanvasRenderingContext2D, p: PondWater, level: number): CanvasPattern {
    let pic = this.ponds.get(p);
    // A pond still rising is made again each quarter unit it rises.
    if (!pic || Math.abs(pic.level - level) > 0.25) {
      const cw = this.world.w + 1;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of p.wet) {
        const x = k % cw, y = (k - x) / cw;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      // One corner more all round, for the tiles at its edge.
      x0--; y0--; x1++; y1++;
      const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
      const px = this.canvas(nw, nh).createImageData(nw, nh);
      for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) putDepth(px.data, (j * nw + i) * 4, level - this.world.getHeight(x0 + i, y0 + j));
      pic = { pattern: this.picture(ctx, px), level, x0, y0, frame: -1 };
      this.ponds.set(p, pic);
    }
    if (pic.frame !== this.frame) {
      this.place(pic.pattern, pic.x0, pic.y0, level);
      pic.frame = this.frame;
    }
    return pic.pattern;
  }
}
