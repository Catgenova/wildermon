/**
 * Which of the water below nought is the sea's: joined, corner to corner
 * under the water, to the open sea round the island. A pool dug in the sand
 * fills to the sea's level but is not the sea, and nothing breaks on it: the
 * sea's shore -- its wet band, its foam, its swell -- is drawn only on water
 * this says is the sea's (`shore.ts`, `Renderer.drawSea`).
 *
 * The water is followed a body at a time, the first time a corner of it is
 * asked about, out from that corner over every corner under the water beside
 * it. A body that reaches the edge of the map, or runs on past `OPEN` corners,
 * is the open sea; one that runs out of water first is walled in. Ground the
 * world has not worked out yet (`World.streamFrom`) is not followed into: a
 * body that comes to some is taken for the sea, and followed on from where it
 * stopped once that ground is worked out (`settle`), so a lake is found to be
 * one as the ground round it comes in, and the open sea is never followed
 * across ground nobody has needed yet.
 *
 * Ground changing under the water (`touched`) undoes the bodies it touches,
 * which are followed again when next asked; what each turned out to be is
 * told on (`settle`), so a pool dug through to the sea takes on the sea's
 * shore all round it, and one cut off from it loses it.
 */
import { CHUNK, type World } from '../world/world';

/** Corners a side in one block of the labels. */
const BLOCK = 64;
/** The most blocks of labels kept before all are let go and worked out again as asked. */
const KEEP = 600;
/** How many corners a body is followed through before it is taken for the open sea. */
const OPEN = 1 << 16;

interface Body {
  /** The sea's water: joined to the open sea, or taken to be while it runs into ground not worked out yet. */
  sea: boolean;
  /** Settled for good: the open sea, or walled in. */
  done: boolean;
  count: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Corners at the edge of ground not worked out yet, by the square they are in: where to follow it on from. */
  waits: Map<number, number[]> | null;
  /** Its corners, while it may yet turn out walled in; and the tiles its still water is on, as runs along a row (`stillIn`), once asked. */
  corners: number[] | null;
  runs: Int32Array | null;
}

/** A box of tiles whose water has changed what it is. */
export type ReachBox = readonly [number, number, number, number];

export class SeaReach {
  private readonly labels = new Map<number, Int32Array>();
  private readonly bodies = new Map<number, Body>();
  private next = 1;
  private readonly stack: number[] = [];
  /** How much of the world was worked out when last looked (`settle`). */
  private grown = -1;
  /** Corners whose ground changed since `settle`, and what the bodies undone there were. */
  private readonly moved: number[] = [];
  private readonly undone: Body[] = [];
  /** Changes with every body that turns from the sea's to walled in or back. */
  stamp = 0;

  constructor(private readonly world: World) {}

  private get cw(): number {
    return this.world.w + 1;
  }

  /** The block of labels last asked for: asked a corner at a time, mostly the same block as the last. */
  private lastKey = -1;
  private last: Int32Array | null = null;

  /** The block of labels a corner is in; made if `make`. */
  private block(cx: number, cy: number, make: boolean): Int32Array | null {
    const key = ((cy / BLOCK) | 0) * 65536 + ((cx / BLOCK) | 0);
    if (key === this.lastKey && this.last) return this.last;
    let b = this.labels.get(key) ?? null;
    if (!b && make) this.labels.set(key, (b = new Int32Array(BLOCK * BLOCK)));
    if (b) {
      this.lastKey = key;
      this.last = b;
    }
    return b;
  }

  private label(k: number): number {
    const cw = this.cw;
    const cx = k % cw, cy = (k - cx) / cw;
    const b = this.block(cx, cy, false);
    return b ? b[(cy % BLOCK) * BLOCK + (cx % BLOCK)] : 0;
  }

  private setLabel(k: number, id: number): void {
    const cw = this.cw;
    const cx = k % cw, cy = (k - cx) / cw;
    (this.block(cx, cy, true) as Int32Array)[(cy % BLOCK) * BLOCK + (cx % BLOCK)] = id;
  }

  /** Whether the sea's water is on a corner. */
  sea(cx: number, cy: number): boolean {
    if (this.world.getHeight(cx, cy) >= 0) return false;
    return this.body(cx, cy).sea;
  }

  /** Whether water below nought that is not the sea's is on a corner: a pool, a pond dug below the sea's level, a lake. */
  inland(cx: number, cy: number): boolean {
    if (this.world.getHeight(cx, cy) >= 0) return false;
    return !this.body(cx, cy).sea;
  }

  /** The body of water on a corner under it, followed out if it has not been. */
  private body(cx: number, cy: number): Body {
    const w = this.world;
    const x = cx < 0 ? 0 : cx > w.w ? w.w : cx, y = cy < 0 ? 0 : cy > w.h ? w.h : cy;
    const k = y * this.cw + x;
    const was = this.bodies.get(this.label(k));
    if (was) return was;
    if (this.labels.size > KEEP) this.clear();
    const id = this.next++;
    const b: Body = { sea: false, done: false, count: 0, x0: x, y0: y, x1: x, y1: y, waits: null, corners: [], runs: null };
    this.bodies.set(id, b);
    this.stack.length = 0;
    this.stack.push(k);
    this.follow(b, id);
    return b;
  }

  /** Follow a body on over the corners on the stack. */
  private follow(b: Body, id: number): void {
    const w = this.world;
    const cw = this.cw;
    const st = this.stack;
    while (st.length) {
      const k = st.pop() as number;
      const cx = k % cw, cy = (k - cx) / cw;
      const l = this.label(k);
      if (l === id) continue;
      if (!w.grownAt(cx, cy)) {
        const sq = Math.floor(Math.min(cy, w.h - 1) / CHUNK) * 65536 + Math.floor(Math.min(cx, w.w - 1) / CHUNK);
        const waits = (b.waits ??= new Map());
        const list = waits.get(sq);
        if (list) list.push(k);
        else waits.set(sq, [k]);
        continue;
      }
      if (w.heights[k] >= 0) continue;
      const other = l ? this.bodies.get(l) : undefined;
      // Joined to water already known to be the open sea, or at the map's edge, or past any pool's size: the sea.
      if ((other && other.done && other.sea) || cx === 0 || cy === 0 || cx === w.w || cy === w.h || b.count >= OPEN) {
        this.setLabel(k, id);
        b.sea = true;
        b.done = true;
        b.waits = null;
        b.corners = null;
        st.length = 0;
        return;
      }
      this.setLabel(k, id);
      b.corners?.push(k);
      b.count++;
      if (cx < b.x0) b.x0 = cx;
      if (cx > b.x1) b.x1 = cx;
      if (cy < b.y0) b.y0 = cy;
      if (cy > b.y1) b.y1 = cy;
      if (cx > 0) st.push(k - 1);
      if (cx < w.w) st.push(k + 1);
      if (cy > 0) st.push(k - cw);
      if (cy < w.h) st.push(k + cw);
    }
    if (b.waits && b.waits.size === 0) b.waits = null;
    b.sea = b.waits !== null;
    b.done = !b.sea;
  }

  /** The ground of a tile changed (`World.onChange`): a body that gains or loses a corner there is undone. */
  touched(x: number, y: number): void {
    const w = this.world;
    const cw = this.cw;
    for (let cy = y; cy <= y + 1; cy++) {
      for (let cx = x; cx <= x + 1; cx++) {
        if (!w.cornerInBounds(cx, cy)) continue;
        const k = cy * cw + cx;
        const wet = w.heights[k] < 0;
        const own = this.bodies.get(this.label(k));
        if (own && !wet) this.undo(this.label(k));
        else if (!own && wet) {
          // Water where there was none: the bodies beside it are one now.
          for (const n of [k - 1, k + 1, k - cw, k + cw]) {
            if (n < 0 || n >= w.heights.length) continue;
            const l = this.label(n);
            if (this.bodies.has(l)) this.undo(l);
          }
        } else continue;
        this.moved.push(cx, cy);
      }
    }
  }

  private undo(id: number): void {
    const b = this.bodies.get(id);
    if (!b) return;
    this.bodies.delete(id);
    this.undone.push(b);
  }

  /**
   * Once a frame: follow on into ground worked out since, and work out again
   * the water where the ground changed. Gives the boxes of tiles whose water
   * turned from the sea's to walled in or back, for the shore drawn there to
   * be drawn again.
   */
  settle(): ReachBox[] {
    const out: ReachBox[] = [];
    const w = this.world;
    if (w.grown !== this.grown) {
      this.grown = w.grown;
      for (const [id, b] of this.bodies) {
        if (!b.waits) continue;
        const st = this.stack;
        st.length = 0;
        for (const [sq, list] of b.waits) {
          const k = list[0];
          const cx = k % this.cw;
          if (!w.grownAt(cx, (k - cx) / this.cw)) continue;
          for (const q of list) st.push(q);
          b.waits.delete(sq);
        }
        if (!st.length) continue;
        this.follow(b, id);
        if (!b.sea) out.push(this.flip(b));
      }
    }
    if (this.moved.length) {
      const m = this.moved;
      const now = new Set<Body>();
      for (let i = 0; i < m.length; i += 2) {
        for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const cx = m[i] + dx, cy = m[i + 1] + dy;
          if (!w.cornerInBounds(cx, cy) || w.heights[cy * this.cw + cx] >= 0) continue;
          now.add(this.body(cx, cy));
        }
      }
      // A pool that was walled in is the sea's now, or the other way about: its shore is drawn again all round it.
      for (const b of this.undone) if (!b.sea) out.push(this.flip(b));
      for (const b of now) if (!b.sea && this.undone.some((u) => u.sea)) out.push(this.flip(b));
      m.length = 0;
      this.undone.length = 0;
    }
    return out;
  }

  private flip(b: Body): ReachBox {
    this.stamp++;
    return [b.x0 - 1, b.y0 - 1, b.x1, b.y1];
  }

  /**
   * The tiles of still water in a box of tiles -- any of a walled-in body's
   * water on them and none of the sea's -- as runs along a row: `fn(y, x0, x1)`.
   * Worked out once a body.
   */
  stillIn(x0: number, y0: number, x1: number, y1: number, fn: (y: number, xa: number, xb: number) => void): void {
    // A body's tiles ask after the water round them, which may follow out another body: not while going through them.
    for (const b of [...this.bodies.values()]) {
      if (b.sea || b.x1 < x0 || b.y1 < y0 || b.x0 - 1 > x1 || b.y0 - 1 > y1) continue;
      const runs = (b.runs ??= this.runsOf(b));
      for (let i = 0; i < runs.length; i += 3) {
        const y = runs[i];
        if (y < y0 || y > y1 || runs[i + 2] < x0 || runs[i + 1] > x1) continue;
        fn(y, Math.max(x0, runs[i + 1]), Math.min(x1, runs[i + 2]));
      }
    }
  }

  private runsOf(b: Body): Int32Array {
    const w = this.world;
    const cw = this.cw;
    const tiles = new Set<number>();
    for (const k of b.corners ?? []) {
      const cx = k % cw, cy = (k - cx) / cw;
      for (let ty = cy - 1; ty <= cy; ty++) {
        for (let tx = cx - 1; tx <= cx; tx++) if (w.inBounds(tx, ty)) tiles.add(ty * w.w + tx);
      }
    }
    const list: number[] = [];
    for (const t of tiles) {
      const tx = t % w.w, ty = (t - tx) / w.w;
      let sea = false;
      for (let q = 0; q < 4 && !sea; q++) sea = this.sea(tx + (q & 1), ty + (q >> 1));
      if (!sea) list.push(t);
    }
    list.sort((p, q) => p - q);
    const runs: number[] = [];
    for (let i = 0; i < list.length; i++) {
      const tx = list[i] % w.w, ty = (list[i] - tx) / w.w;
      const n = runs.length;
      if (n && runs[n - 3] === ty && runs[n - 1] === tx - 1) runs[n - 1] = tx;
      else runs.push(ty, tx, tx);
    }
    return Int32Array.from(runs);
  }

  clear(): void {
    this.labels.clear();
    this.last = null;
    this.lastKey = -1;
    this.bodies.clear();
    this.moved.length = 0;
    this.undone.length = 0;
    this.grown = -1;
    this.stamp++;
  }
}
