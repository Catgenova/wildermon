import type { Bill, Buildings } from '../game/building';

/**
 * What the renderer knows has changed about the buildings since the last
 * frame, and where.
 *
 * A wall's or a roof's picture (`Renderer.baked`) used to be made again
 * every half second whatever happened, because nothing said when a wall or
 * anything it reads had changed: its neighbours, the floor over it, its
 * paint, whether it is finished. A fifth of a village's pictures were being
 * drawn afresh every frame to find out. And every tile on the screen went
 * through the whole of the building drawing once a single building stood
 * anywhere on the island, though only the tiles near one have anything of
 * one to draw.
 *
 * So once a frame this looks over every wall, floor, column, cellar and
 * building, compares each with what it was last frame, and where one has
 * changed -- come, gone, been painted, finished, glazed, padlocked, let down
 * -- puts up the count of the patch of the island it stands in and the
 * patches `REACH` round it (`version`). A picture keeps the count of the
 * patches it was made in, and is made again when that has gone up. Nothing
 * that draws a building has to name what it reads: a change to anything
 * near enough to be read is enough.
 *
 * Looking over a wall is a handful of comparisons, the same strings as last
 * frame compared by reference; a village of a thousand walls is a fraction
 * of a millisecond. The game changes its buildings in a great many places
 * and on the island's word, so this asks rather than being told.
 */

/** How many tiles across a patch is. */
const PATCH = 8;
/**
 * How far a change reaches, in tiles: the furthest anything drawn for a
 * building reads round it. A wall reads the walls either end of it and the
 * floor over it; the shade on a tile is thrown by walls up to a tile past
 * it; a column is claimed by the tile on its corner. Two is enough for all
 * of them, and for the ground under them.
 */
export const REACH = 2;

/**
 * How many frames at most go by without a look over the buildings when they
 * have not said they changed: something set on a wall in place, as a padlock
 * or a coat of paint is, is drawn within a second whether it says so or not.
 */
const LOOK_ANYWAY = 60;

/** A patch, or a tile, as one number: no island is 32768 tiles across. */
const patchKey = (px: number, py: number): number => (px + 4096) * 65536 + (py + 4096);
const tileNumber = (x: number, y: number): number => (x + 4096) * 65536 + (y + 4096);

/** Whether a bill is paid: `isDone`, without the array it makes, since this asks it of every wall every frame. */
const finished = (b: Bill): boolean => {
  for (const k in b.needed) if (b.needed[k] > 0) return false;
  return true;
};

interface WallSeen {
  frame: number;
  level: number; x: number; y: number; dir: string;
  type: string; material: string; dye?: string; glass?: string;
  building: number; done: boolean; lowered?: boolean; lock?: number; greenSince?: number; seen: string;
}
interface FloorSeen {
  frame: number;
  level: number; x: number; y: number;
  material: string; kind?: string; facing?: string; hand?: string; dye?: string; building: number; done: boolean;
}
interface ColumnSeen { frame: number; level: number; x: number; y: number; material: string; dye?: string; building: number; done: boolean }
interface CellarSeen { frame: number; x: number; y: number; dug: number; building: number }
interface BuildingSeen {
  frame: number;
  levels: number; roof?: string; deck?: number | null; tiles: number; first?: string; last?: string; piers: number;
  /** Its footprint's box, worked out again only when its tiles change. */
  x0: number; y0: number; x1: number; y1: number;
}

export class StructureWatch {
  /** Put up whenever anything about any building, or the ground under one, has changed. */
  stamp = 0;
  private frame = 0;
  private readonly patches = new Map<number, number>();
  /** Every tile within `REACH` of a wall, a floor, a column, a cellar or a building's tile. */
  private readonly near = new Set<number>();
  /** Whether something has come or gone, or a building's footprint changed, so `near` is to be made again. */
  private moved = true;
  /**
   * What was seen, by the key the buildings keep each under (`Buildings.walls`
   * and the rest, a building by its number) rather than by the object: every
   * ground read the island sends brings every wall and floor as a new one,
   * and by the object every picture in sight was made again each time.
   */
  private readonly walls = new Map<string, WallSeen>();
  private readonly floors = new Map<string, FloorSeen>();
  private readonly columns = new Map<string, ColumnSeen>();
  private readonly cellars = new Map<string, CellarSeen>();
  private readonly buildings = new Map<number, BuildingSeen>();
  /** The buildings' count of changes (`Buildings.revision`) at the last look, and the frame of the last look. */
  private revision = -1;
  private looked = 0;

  /** Put up the count of every patch within `REACH` of the tiles from (x0, y0) to (x1, y1). */
  touch(x0: number, y0: number, x1: number, y1: number): void {
    const px0 = Math.floor((x0 - REACH) / PATCH), px1 = Math.floor((x1 + REACH) / PATCH);
    const py0 = Math.floor((y0 - REACH) / PATCH), py1 = Math.floor((y1 + REACH) / PATCH);
    for (let px = px0; px <= px1; px++) {
      for (let py = py0; py <= py1; py++) {
        const k = patchKey(px, py);
        this.patches.set(k, (this.patches.get(k) ?? 0) + 1);
      }
    }
    this.stamp++;
  }

  /**
   * The count of the patches the tiles from (x0, y0) to (x1, y1) are in. It
   * only ever goes up, so a picture made at one count is out of date at any
   * other.
   */
  version(x0: number, y0: number, x1: number, y1: number): number {
    let v = 0;
    const px1 = Math.floor(x1 / PATCH), py1 = Math.floor(y1 / PATCH);
    for (let px = Math.floor(x0 / PATCH); px <= px1; px++) {
      for (let py = Math.floor(y0 / PATCH); py <= py1; py++) v += this.patches.get(patchKey(px, py)) ?? 0;
    }
    return v;
  }

  /** Whether anything built stands within `REACH` of a tile, so that drawing what is built there can draw anything at all. */
  nearAny(x: number, y: number): boolean {
    return this.near.has(tileNumber(x, y));
  }

  /**
   * Look the buildings over for what has changed since the last frame: only
   * when they say they have changed (`Buildings.revision`), or once in
   * `LOOK_ANYWAY` frames for what is changed on them without saying.
   */
  update(bld: Buildings): void {
    this.frame++;
    if (bld.revision === this.revision && this.frame - this.looked < LOOK_ANYWAY) return;
    this.revision = bld.revision;
    this.looked = this.frame;
    const f = this.frame;
    // Walls: a wall stands on the border between two tiles.
    for (const [k, w] of bld.walls) {
      const done = finished(w);
      const seen = w.type === 'hidden_door' ? bld.seenType(w) : w.type;
      const r = this.walls.get(k);
      if (r && r.level === w.level && r.x === w.x && r.y === w.y && r.dir === w.dir && r.type === w.type && r.material === w.material
        && r.dye === w.dye && r.glass === w.glass && r.building === w.building && r.done === done && r.lowered === w.lowered
        && r.lock === w.lock && r.greenSince === w.greenSince && r.seen === seen) {
        r.frame = f;
        continue;
      }
      if (r) this.wallTouch(r);
      if (!r || r.x !== w.x || r.y !== w.y || r.dir !== w.dir || r.level !== w.level) this.moved = true;
      const n: WallSeen = {
        frame: f, level: w.level, x: w.x, y: w.y, dir: w.dir, type: w.type, material: w.material, dye: w.dye, glass: w.glass,
        building: w.building, done, lowered: w.lowered, lock: w.lock, greenSince: w.greenSince, seen,
      };
      this.walls.set(k, n);
      this.wallTouch(n);
    }
    if (this.walls.size !== bld.walls.size) this.sweep(this.walls, (r) => this.wallTouch(r));
    for (const [k, fl] of bld.floors) {
      const done = finished(fl);
      const r = this.floors.get(k);
      if (r && r.level === fl.level && r.x === fl.x && r.y === fl.y && r.material === fl.material && r.kind === fl.kind
        && r.facing === fl.facing && r.hand === fl.hand && r.dye === fl.dye && r.building === fl.building && r.done === done) {
        r.frame = f;
        continue;
      }
      if (r) this.touch(r.x, r.y, r.x, r.y);
      if (!r || r.x !== fl.x || r.y !== fl.y || r.level !== fl.level) this.moved = true;
      this.floors.set(k, {
        frame: f, level: fl.level, x: fl.x, y: fl.y, material: fl.material, kind: fl.kind, facing: fl.facing, hand: fl.hand,
        dye: fl.dye, building: fl.building, done,
      });
      this.touch(fl.x, fl.y, fl.x, fl.y);
    }
    if (this.floors.size !== bld.floors.size) this.sweep(this.floors, (r) => this.touch(r.x, r.y, r.x, r.y));
    // A column stands on the corner of four tiles, the one at its own x and y and the three up and left of it.
    for (const [k, c] of bld.columns) {
      const done = finished(c);
      const r = this.columns.get(k);
      if (r && r.level === c.level && r.x === c.x && r.y === c.y && r.material === c.material && r.dye === c.dye
        && r.building === c.building && r.done === done) {
        r.frame = f;
        continue;
      }
      if (r) this.touch(r.x - 1, r.y - 1, r.x, r.y);
      if (!r || r.x !== c.x || r.y !== c.y || r.level !== c.level) this.moved = true;
      this.columns.set(k, { frame: f, level: c.level, x: c.x, y: c.y, material: c.material, dye: c.dye, building: c.building, done });
      this.touch(c.x - 1, c.y - 1, c.x, c.y);
    }
    if (this.columns.size !== bld.columns.size) this.sweep(this.columns, (r) => this.touch(r.x - 1, r.y - 1, r.x, r.y));
    for (const [k, c] of bld.cellars) {
      const r = this.cellars.get(k);
      if (r && r.x === c.x && r.y === c.y && r.dug === c.dug && r.building === c.building) {
        r.frame = f;
        continue;
      }
      if (r) this.touch(r.x, r.y, r.x, r.y);
      if (!r || r.x !== c.x || r.y !== c.y) this.moved = true;
      this.cellars.set(k, { frame: f, x: c.x, y: c.y, dug: c.dug, building: c.building });
      this.touch(c.x, c.y, c.x, c.y);
    }
    if (this.cellars.size !== bld.cellars.size) this.sweep(this.cellars, (r) => this.touch(r.x, r.y, r.x, r.y));
    // A building: what all its walls and its roof read of it -- its storeys, its roof, its deck, its footprint.
    for (const [k, b] of bld.list) {
      const t = b.tiles;
      const r = this.buildings.get(k);
      if (r && r.levels === b.levels && r.roof === b.roof && r.deck === b.deck && r.tiles === t.length && r.first === t[0]
        && r.last === t[t.length - 1] && r.piers === (b.piers?.length ?? 0)) {
        r.frame = f;
        continue;
      }
      if (r && r.x0 <= r.x1) this.touch(r.x0, r.y0, r.x1, r.y1);
      if (!r || r.tiles !== t.length || r.first !== t[0] || r.last !== t[t.length - 1]) this.moved = true;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const key of t) {
        const i = key.indexOf(',');
        const x = +key.slice(0, i), y = +key.slice(i + 1);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const n: BuildingSeen = {
        frame: f, levels: b.levels, roof: b.roof, deck: b.deck, tiles: t.length, first: t[0], last: t[t.length - 1],
        piers: b.piers?.length ?? 0, x0, y0, x1, y1,
      };
      this.buildings.set(k, n);
      if (x0 <= x1) this.touch(x0, y0, x1, y1);
    }
    if (this.buildings.size !== bld.list.size) this.sweep(this.buildings, (r) => { if (r.x0 <= r.x1) this.touch(r.x0, r.y0, r.x1, r.y1); });
    if (this.moved) this.index(bld);
  }

  /** The ground under a tile has changed (`World.onChange`): what stands on it, or near it, is drawn again. */
  ground(x: number, y: number): void {
    if (this.near.has(tileNumber(x, y))) this.touch(x, y, x, y);
  }

  private wallTouch(r: { x: number; y: number; dir: string }): void {
    this.touch(r.dir === 'v' ? r.x - 1 : r.x, r.dir === 'h' ? r.y - 1 : r.y, r.x, r.y);
  }

  /** What was there last frame and is not now: gone, and the patches it stood in changed. */
  private sweep<K, R extends { frame: number }>(seen: Map<K, R>, gone: (r: R) => void): void {
    for (const [k, r] of seen) {
      if (r.frame === this.frame) continue;
      gone(r);
      seen.delete(k);
      this.moved = true;
    }
  }

  /** Every tile within `REACH` of anything built, made again when something has come, gone or moved. */
  private index(bld: Buildings): void {
    this.moved = false;
    const near = this.near;
    near.clear();
    const mark = (x0: number, y0: number, x1: number, y1: number): void => {
      for (let x = x0 - REACH; x <= x1 + REACH; x++) for (let y = y0 - REACH; y <= y1 + REACH; y++) near.add(tileNumber(x, y));
    };
    for (const w of bld.walls.values()) mark(w.dir === 'v' ? w.x - 1 : w.x, w.dir === 'h' ? w.y - 1 : w.y, w.x, w.y);
    for (const fl of bld.floors.values()) mark(fl.x, fl.y, fl.x, fl.y);
    for (const c of bld.columns.values()) mark(c.x - 1, c.y - 1, c.x, c.y);
    for (const c of bld.cellars.values()) mark(c.x, c.y, c.x, c.y);
    for (const b of bld.list.values()) {
      for (const key of b.tiles) {
        const i = key.indexOf(',');
        const x = +key.slice(0, i), y = +key.slice(i + 1);
        mark(x, y, x, y);
      }
    }
  }
}
