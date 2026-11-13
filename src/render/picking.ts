import type { Camera } from '../engine/camera';
import { WALL_HEIGHT, roofShapeOf, ROOF_PITCH, roofShapeDef, TOP_LEVELS, FLOOR_DEEP, isDone, WALL_TYPE_BY_ID, type Building, type FloorTile, floorKind, WALL_THICK } from '../game/building';
import type { Game } from '../game/game';
import { storeyTileAt, storeyHeight } from '../game/storeyview';
import { UNSEEN } from '../game/vision';
import { type AqueductPainter, type AqueductShape, hullOf } from './aqueducts';
import { cellarFloorHeight } from './cellar';
import { HALF_W, HALF_H, HEIGHT_SCALE } from './iso';
import { PICK_SLACK_TOUCH, PICK_SLACK } from './pickslack';
import { covering } from './roofing';
import { type RoofPt, FALLS, type RoofModel } from './roofshape';
import { depthOf } from './view';

/** Result of picking a screen point: the tile, the approximate world position and the nearest corner. */
export interface Pick {
  x: number;
  y: number;
  wx: number;
  wy: number;
  cx: number;
  cy: number;
  /** A creature under the cursor, when one is. */
  creature?: number;
  /**
   * Somebody else under the cursor, by the uid the island knows them by.
   *
   * Everything else on this list is picked by a number that means something to
   * this browser. A person has to be picked by something that means something
   * to the *island*, because what you do with one — invite them home, ask to be
   * their friend, write to them — is a door and not a drawing.
   */
  peer?: string;
  /** A crate under the cursor, when one is. */
  crate?: number;
  /** A campfire under the cursor, when one is. */
  fire?: number;
  /** A smelter under the cursor, when one is. */
  smelter?: number;
  /** An anvil under the cursor, when one is. */
  anvil?: number;
  /** A work post under the cursor, when one is. */
  post?: number;
  /** A trap under the cursor, when one is. */
  trap?: number;
  /** A bridge under the cursor, when one is. */
  bridge?: number;
  /** A kiln under the cursor, when one is. */
  kiln?: number;
  /** A piece of furniture under the cursor, when one is. */
  furniture?: number;
  /** Picked on the floor of a cellar, looking into it, rather than on the ground over it. */
  down?: boolean;
  /**
   * The storey picked on, while one is pinned on the storey control (`storeyview.ts`): its floor, or 0 for the
   * ground. Undefined on Auto, where a click is on the ground and a walk arrives wherever it first can.
   */
  level?: number;
  /**
   * For a thing set down on the ground (a wagon, a crate, a fire...): the ground the cursor is over behind it, as it
   * would have been picked were the thing not there, so the tile under or behind a thing can still be got at.
   */
  ground?: Pick;
}

export interface HitRect {
  x: number;
  y: number;
  left: number;
  top: number;
  w: number;
  h: number;
  creature?: number;
  peer?: string;
  crate?: number;
  fire?: number;
  smelter?: number;
  kiln?: number;
  furniture?: number;
  anvil?: number;
  post?: number;
  trap?: number;
  bridge?: number;
  /** An aqueduct's bay: its outline in the box, which is what a click has to land on (`./aqueducts`). */
  aq?: AqueductShape;
  /** Or the outlines in the box a click has to land on one of, each as x, y pairs: a bridge's deck and its lips. */
  poly?: Float64Array[];
  /** Its place in the drawing order: the one drawn last over a point is the one picked there. */
  seq?: number;
  /** What it was drawn as: a point picks it only on those pixels (`PICK_SLACK`). */
  shapes?: HitShape[];
}

/** Whether a screen point is inside a polygon of screen points. */
export function inOutline(p: ReadonlyArray<readonly [number, number]>, sx: number, sy: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > sy !== yj > sy && sx < ((xj - xi) * (sy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How often a still cursor is told again what it is over, in milliseconds. */
const PICK_EVERY = 90;

const pickSlack = (): number => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? PICK_SLACK_TOUCH : PICK_SLACK);
/**
 * Alpha a drawn pixel needs to pick its thing, out of 255: `PICK_SOLID`, or
 * `PICK_ALPHA` and lighter than `PICK_SHADE` in its brightest channel. A
 * shadow is dark and see-through (black at 0.2 to 0.34, a piece's at 0.17)
 * and picks nothing.
 */
const PICK_ALPHA = 40;
const PICK_SOLID = 150;
const PICK_SHADE = 100;

/** One drawing of a thing, kept to test a point against its pixels (`Picker.shapeHas`). */
export interface HitShape {
  draw: (g: CanvasRenderingContext2D, px: number, py: number) => void;
  sx: number;
  sy: number;
  /** The transform it was drawn under, relative to the screen's: a boat's roll (`swayIn`). */
  m: DOMMatrix | null;
  /** How opaque it was drawn (`footOver` draws it again so). */
  alpha: number;
}

/** Scratch for the outlines `coveredAfter` tests a point against. */
const COVER_PTS = new Float64Array(8);

/** Whether a point is inside a closed outline of `n` numbers, x, y pairs, by the crossings of a ray from it. */
function inPolygon(p: ArrayLike<number>, n: number, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = p[i];
    const yi = p[i + 1];
    const xj = p[j];
    const yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point is within `r` of the segment from `ax, ay` to `bx, by`. */
function nearSegment(ax: number, ay: number, bx: number, by: number, x: number, y: number, r: number): boolean {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r;
}

/** Whether a point is inside the convex hull of some points, x, y pairs. */
function inHull(pts: number[], x: number, y: number): boolean {
  const hull = hullOf(pts);
  return hull.length >= 6 && inPolygon(hull, hull.length, x, y);
}

/** What Picker needs of the renderer (`renderer.ts` builds it). */
export interface PickHost {
  readonly anvilHits: HitRect[];
  readonly aqueducts: AqueductPainter;
  readonly camera: Camera;
  readonly cellarHulls: Array<{ x: number; y: number; hull: Array<[number, number]>; floor: Array<[number, number]> }>;
  readonly crateHits: HitRect[];
  readonly creatureHits: HitRect[];
  readonly deckHits: HitRect[];
  readonly fireHits: HitRect[];
  readonly furnitureHits: HitRect[];
  readonly game: Game;
  readonly kilnHits: HitRect[];
  readonly peerHits: HitRect[];
  readonly postHits: HitRect[];
  readonly pts: Float64Array<ArrayBuffer>;
  roofFrame(b: Building): { roofs: FloorTile[]; model: RoofModel; eave: number } | null;
  readonly roofQueue: Map<number, Building[]>;
  readonly roofShapes: Map<number, { sig: string; model: RoofModel }>;
  readonly smelterHits: HitRect[];
  readonly stoneHits: HitRect[];
  readonly trapHits: HitRect[];
}

/**
 * What is under a point on the screen: a person, a creature, a thing set down (by its own pixels),
 * a bridge's deck, a stone, a cellar's floor, a storey's floor or roof, or the ground. Reads the hit boxes
 * the renderer laid this frame (`PickHost`); draws nothing.
 */
export class Picker {
  /** What the cursor was last told it was over, and when. */
  private picked: Pick | null = null;
  private pickedAt = -1e9;
  private pickX = NaN;
  private pickY = NaN;
  /** The few pixels a pick is tested on (`shapeHas`). */
  private hitPad: HTMLCanvasElement | null = null;

  constructor(private readonly r: PickHost) {}

  /**
   * What is under the cursor, asked no oftener than it can have changed.
   *
   * `pick` walks eleven lists of hit boxes and then searches back along the
   * lattice for the tile under the point, and it was being asked on every
   * frame whether or not anything had moved — including while the cursor sat
   * still on a menu-less screen. A cursor that has not moved is re-asked a few
   * times a second, which is quicker than anything on the island can walk out
   * from under it and a sixth of the work.
   */
  hoverPick(sx: number, sy: number): Pick | null {
    const now = performance.now();
    if (sx === this.pickX && sy === this.pickY && now - this.pickedAt < PICK_EVERY) return this.picked;
    this.pickX = sx;
    this.pickY = sy;
    this.pickedAt = now;
    this.picked = this.pick(sx, sy);
    return this.picked;
  }

  /** The cursor has left the canvas: what was under it is not under it now. */
  forgetPick(): void {
    this.pickX = NaN;
    this.picked = null;
  }

  /** What is under the cursor, and for a thing set down there, the ground behind it too (`Pick.ground`). */
  pick(sx: number, sy: number): Pick | null {
    const p = this.pickTop(sx, sy);
    const pinned = this.r.game.pinnedStorey();
    if (p && p.peer === undefined && p.creature === undefined && p.bridge === undefined && !p.down
      && (p.crate ?? p.fire ?? p.smelter ?? p.kiln ?? p.anvil ?? p.post ?? p.trap ?? p.furniture) !== undefined) {
      const up = pinned ? this.storeyPick(sx, sy, pinned) : null;
      const ground = up ? null : this.groundPick(sx, sy);
      p.ground = up ?? (ground && pinned !== null ? { ...ground, level: 0 } : ground) ?? undefined;
    }
    // Pinned on a storey, whatever is picked is on it: only what stands on it is drawn (`storeyview.ts`).
    if (p && pinned !== null && p.level === undefined && !p.down) p.level = pinned;
    return p;
  }

  /**
   * What is under a screen point. Things standing on the ground are picked by
   * their sprite; a tree is not, because a tree is the tile rather than a thing
   * on it — its canopy leans over the tiles behind it, and catching clicks with
   * it put the cursor on a tile a long way from where it was pointing.
   */
  private pickTop(sx: number, sy: number): Pick | null {
    for (let i = this.r.peerHits.length - 1; i >= 0; i--) {
      const h = this.r.peerHits[i];
      if (sx >= h.left && sx <= h.left + h.w && sy >= h.top && sy <= h.top + h.h) return { ...this.makePick(h.x, h.y, sx, sy), peer: h.peer };
    }
    for (let i = this.r.creatureHits.length - 1; i >= 0; i--) {
      const h = this.r.creatureHits[i];
      if (sx >= h.left && sx <= h.left + h.w && sy >= h.top && sy <= h.top + h.h) return { ...this.makePick(h.x, h.y, sx, sy), creature: h.creature };
    }
    /*
     * A thing set down -- a crate, a wagon, a furnace, a chest -- by its own
     * pixels, give or take `PICK_SLACK`, and the one drawn last over the
     * point first: a wagon's box no longer takes the crates beside it.
     */
    const things: HitRect[] = [];
    const slack = pickSlack();
    for (const list of [this.r.crateHits, this.r.smelterHits, this.r.furnitureHits, this.r.kilnHits, this.r.postHits, this.r.trapHits, this.r.anvilHits, this.r.fireHits]) {
      for (const h of list) {
        if (sx >= h.left - slack && sx <= h.left + h.w + slack && sy >= h.top - slack && sy <= h.top + h.h + slack) things.push(h);
      }
    }
    things.sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0));
    for (const h of things) {
      if (!this.shapeHas(h, sx, sy, slack)) continue;
      const at = this.makePick(h.x, h.y, sx, sy);
      if (h.crate !== undefined) return { ...at, crate: h.crate };
      if (h.smelter !== undefined) return { ...at, smelter: h.smelter };
      if (h.furniture !== undefined) return { ...at, furniture: h.furniture };
      if (h.kiln !== undefined) return { ...at, kiln: h.kiln };
      if (h.post !== undefined) return { ...at, post: h.post };
      if (h.trap !== undefined) return { ...at, trap: h.trap };
      if (h.anvil !== undefined) return { ...at, anvil: h.anvil };
      return { ...at, fire: h.fire };
    }
    /*
     * Pinned on a storey over the ground, a building's own floor under the point is that storey's: a bridge piece's
     * hit is the box round its balustrades and arches, which reaches over the floor its end meets, and took every
     * click on the edge between them.
     */
    const aloft = this.r.deckHits.length ? this.r.game.pinnedStorey() : null;
    const floorUp = aloft !== null && aloft > 0 ? this.storeyPick(sx, sy, aloft) : null;
    if (floorUp && this.r.game.buildings.buildingAt(floorUp.x, floorUp.y)) return floorUp;
    for (let i = this.r.deckHits.length - 1; i >= 0; i--) {
      const h = this.r.deckHits[i];
      if (sx < h.left || sx > h.left + h.w || sy < h.top || sy > h.top + h.h) continue;
      if (h.poly && !h.poly.some((o) => inPolygon(o, o.length, sx, sy))) continue;
      // An aqueduct's bay takes the click where its masonry is drawn and nothing drawn after it stands over that point.
      if (h.aq && (!this.r.aqueducts.hits(h.aq, sx, sy) || this.coveredAfter(sx, sy, h.x, h.y, h.bridge))) continue;
      // Where on the tile, at the deck's height: the side nearest the click is the side under it (`nearestSide`).
      return { ...this.makePick(h.x, h.y, sx, sy, this.r.game.deckAt(h.x, h.y) ?? undefined), bridge: h.bridge };
    }
    // A Runestone or a settlement's token, by the stone standing up off its footprint: its centre tile, whose hover and Examine name it.
    for (let i = this.r.stoneHits.length - 1; i >= 0; i--) {
      const h = this.r.stoneHits[i];
      if (sx >= h.left && sx <= h.left + h.w && sy >= h.top && sy <= h.top + h.h) return this.makePick(h.x, h.y, sx, sy);
    }
    // Looking into a cellar: its floor, nearest first; and a side of the dig is nothing to click on.
    if (this.r.cellarHulls.length) {
      const hulls = this.r.cellarHulls;
      for (let i = hulls.length - 1; i >= 0; i--) {
        if (inOutline(hulls[i].floor, sx, sy)) {
          const { x, y } = hulls[i];
          return { ...this.makePick(x, y, sx, sy, cellarFloorHeight(this.r.game, x, y)), down: true };
        }
      }
      for (const h of hulls) if (inOutline(h.hull, sx, sy)) return null;
    }
    // Pinned on a storey over the ground: its floor, and where none of it is under the cursor, the ground.
    const pinned = this.r.game.pinnedStorey();
    if (pinned !== null && pinned > 0) {
      const up = this.storeyPick(sx, sy, pinned);
      if (up) return up;
      const ground = this.groundPick(sx, sy);
      return ground && { ...ground, level: 0 };
    }
    return this.groundPick(sx, sy);
  }

  /**
   * The tile of a storey under a point on the screen (`storeyview.ts`): of
   * those that answer on the storey (`storeyTileAt`), the first whose floor,
   * laid flat at its height (`storeyHeight`), is under the point, from the
   * nearest line back.
   */
  private storeyPick(sx: number, sy: number, level: number): Pick | null {
    // A pitched roof on its own level is picked on its slopes, where it is drawn, not on the flat of its eaves.
    const roof = this.roofPick(sx, sy, level);
    if (roof) return roof;
    const cam = this.r.camera;
    const world = this.r.game.world;
    const iso = cam.screenToIso(sx, sy);
    const V = cam.view;
    const stepW = HALF_W * V.unit;
    const stepH = HALF_H * V.unit;
    const eF = iso.x / stepW;
    const dF = iso.y / stepH;
    const up = Math.ceil(((world.maxHeight + (level + 1) * WALL_HEIGHT) * HEIGHT_SCALE) / stepH) + 1;
    const down = Math.ceil((-world.minHeight * HEIGHT_SCALE) / stepH) + 3;
    for (let d = Math.floor(dF) + up; d >= Math.floor(dF) - down; d--) {
      for (let e = Math.floor(eF) - 1; e <= Math.ceil(eF) + 1; e++) {
        if (V.staggered && ((e + d) & 1) !== 0) continue;
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (!world.inBounds(x, y) || !storeyTileAt(this.r.game, x, y, level)) continue;
        const h = storeyHeight(this.r.game, x, y, level);
        if (!this.pointInTile(x, y, sx, sy, h)) continue;
        return this.r.game.vision.state(x, y) === UNSEEN ? null : { ...this.makePick(x, y, sx, sy, h), level };
      }
    }
    return null;
  }

  /**
   * The roof tile under a point on the screen, on the level a pitched roof
   * sits on (`storeyview.ts`): of the faces of every such roof drawn there
   * (`roofFrame`), the nearest the eye that the point is in, picked at the
   * face's own height; null where none is.
   */
  private roofPick(sx: number, sy: number, level: number): Pick | null {
    const cam = this.r.camera;
    const V = cam.view;
    let best: { x: number; y: number; h: number; d: number } | null = null;
    for (const b of this.r.game.buildings.list.values()) {
      if (b.levels !== level || roofShapeOf(b) === 'flat') continue;
      const frame = this.r.roofFrame(b);
      if (!frame) continue;
      const pitch = ROOF_PITCH * roofShapeDef(b).rise;
      for (const face of frame.model.faces) {
        const n = face.pts.length;
        const poly = new Float64Array(n * 2);
        let mx = 0, my = 0, md = 0;
        face.pts.forEach((q, i) => {
          poly[i * 2] = cam.worldToScreenX(q[0], q[1]);
          poly[i * 2 + 1] = cam.worldToScreenY(q[0], q[1], frame.eave + pitch * q[2]);
          mx += q[0] / n;
          my += q[1] / n;
          md += q[2] / n;
        });
        if (!inPolygon(poly, n * 2, sx, sy)) continue;
        const d = depthOf(V, mx, my);
        if (best && best.d >= d) continue;
        const f = frame.roofs[face.tile];
        best = { x: f.x, y: f.y, h: frame.eave + pitch * md, d };
      }
    }
    if (!best) return null;
    return this.r.game.vision.state(best.x, best.y) === UNSEEN ? null : { ...this.makePick(best.x, best.y, sx, sy, best.h), level };
  }

  /** The ground under a point on the screen, whatever stands on it: the first tile it hits, from the nearest line back. */
  private groundPick(sx: number, sy: number): Pick | null {
    const cam = this.r.camera;
    const world = this.r.game.world;
    const iso = cam.screenToIso(sx, sy);
    const V = cam.view;
    const stepW = HALF_W * V.unit;
    const stepH = HALF_H * V.unit;
    const eF = iso.x / stepW;
    const dF = iso.y / stepH;
    // A hill in front stands between the cursor and the ground it is over, so
    // the search runs from the nearest line that could reach this high back to
    // the furthest that could reach this low, and takes the first tile it hits.
    const up = Math.ceil((world.maxHeight * HEIGHT_SCALE) / stepH) + 1;
    const down = Math.ceil((-world.minHeight * HEIGHT_SCALE) / stepH) + 3;
    const eLo = Math.floor(eF) - 1;
    const eHi = Math.ceil(eF) + 1;
    for (let d = Math.floor(dF) + up; d >= Math.floor(dF) - down; d--) {
      for (let e = eLo; e <= eHi; e++) {
        if (V.staggered && ((e + d) & 1) !== 0) continue;
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (!world.inBounds(x, y)) continue;
        // Ground nobody has seen is not there to be clicked on.
        if (this.pointInTile(x, y, sx, sy)) return this.r.game.vision.state(x, y) === UNSEEN ? null : this.makePick(x, y, sx, sy);
      }
    }
    return null;
  }

  /**
   * Whether something drawn after the bay of an aqueduct on tile `bx, by`
   * stands over a screen point: the ground or the water of a line of the
   * ground nearer the camera, a foundation or a deck on piers on one, a wall
   * a nearer line draws, or the roof of a building laid after it. A click
   * there is on that, not on the masonry behind it.
   */
  private coveredAfter(sx: number, sy: number, bx: number, by: number, bridge: number | undefined): boolean {
    const cam = this.r.camera;
    const world = this.r.game.world;
    const V = cam.view;
    const d0 = depthOf(V, bx, by);
    const iso = cam.screenToIso(sx, sy);
    const stepW = HALF_W * V.unit;
    const stepH = HALF_H * V.unit;
    const eF = iso.x / stepW;
    const dF = iso.y / stepH;
    const bld = this.r.game.buildings;
    // As high as anything on a line can stand: the ground, and the storeys and the roof of a building on it.
    const up = Math.ceil(((world.maxHeight + (TOP_LEVELS + 2) * WALL_HEIGHT) * HEIGHT_SCALE) / stepH) + 1;
    const down = Math.ceil((-world.minHeight * HEIGHT_SCALE) / stepH) + 3;
    const p = COVER_PTS;
    const corner = (cx: number, cy: number, h: number, i: number): void => {
      p[i * 2] = cam.worldToScreenX(cx, cy);
      p[i * 2 + 1] = cam.worldToScreenY(cx, cy, h);
    };
    for (let d = Math.floor(dF) + up; d > d0 && d >= Math.floor(dF) - down; d--) {
      for (let e = Math.floor(eF) - 1; e <= Math.ceil(eF) + 1; e++) {
        if (V.staggered && ((e + d) & 1) !== 0) continue;
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (!world.inBounds(x, y)) continue;
        // The ground, or the water over it.
        const water = world.surfaceAt(x, y);
        corner(x, y, Math.max(world.getHeight(x, y), water), 0);
        corner(x + 1, y, Math.max(world.getHeight(x + 1, y), water), 1);
        corner(x + 1, y + 1, Math.max(world.getHeight(x + 1, y + 1), water), 2);
        corner(x, y + 1, Math.max(world.getHeight(x, y + 1), water), 3);
        if (inPolygon(p, 8, sx, sy)) return true;
        // A poured foundation, as the box it stands in. (A bridge's deck drawn after the bay is before it in `deckHits`.)
        const slab = this.r.game.foundations.size ? this.r.game.slabAt(x, y) : undefined;
        if (slab && this.boxHas(x, y, null, slab.top, sx, sy)) return true;
        // A finished deck on piers, as thick as it is laid (`slabOutline`).
        const deck = bld.pierTiles.size ? this.r.game.pierDeckAt(x, y) : null;
        if (deck !== null && this.boxHas(x, y, deck - FLOOR_DEEP, deck, sx, sy)) return true;
        // The walls this line draws: the borders of the tile facing away from the camera, every storey of them.
        for (const side of V.back) {
          for (let level = 0; level < TOP_LEVELS; level++) {
            const w = bld.walls.size ? bld.wall(level, x, y, side) : undefined;
            if (!w) break;
            if (!isDone(w) || WALL_TYPE_BY_ID.get(w.type)?.low) continue;
            const owner = bld.list.get(w.building);
            const [ax, ay, bx2, by2] = side === 'n' ? [x, y, x + 1, y] : side === 's' ? [x, y + 1, x + 1, y + 1] : side === 'w' ? [x, y, x, y + 1] : [x + 1, y, x + 1, y + 1];
            // On the ground at the corner of the tile drawing it, or on the deck of a building on piers (`drawStructures`).
            const base = owner?.deck ?? world.getHeight(x, y);
            corner(ax, ay, base + level * WALL_HEIGHT, 0);
            corner(bx2, by2, base + level * WALL_HEIGHT, 1);
            corner(bx2, by2, base + (level + 1) * WALL_HEIGHT, 2);
            corner(ax, ay, base + (level + 1) * WALL_HEIGHT, 3);
            if (owner && inPolygon(p, 8, sx, sy)) return true;
          }
        }
      }
    }
    // A roof laid after it, unless the bay stands in front of that building and is cut out of its roof (`AqueductPainter.before`).
    for (const [row, list] of this.r.roofQueue) {
      if (row <= d0) continue;
      for (const b of list) {
        if (this.r.aqueducts.before(b.tiles, row, V).some((c) => c.b.id === bridge && c.b.spans[c.k].x === bx && c.b.spans[c.k].y === by)) continue;
        if (this.roofCovers(b, sx, sy)) return true;
      }
    }
    return false;
  }

  /** Whether a screen point is in the box over a tile from `bottom` (its ground where null) up to `top`, as the eye sees it. */
  private boxHas(x: number, y: number, bottom: number | null, top: number, sx: number, sy: number): boolean {
    const cam = this.r.camera;
    const w = this.r.game.world;
    const pts: number[] = [];
    for (const [cx, cy] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
      const px = cam.worldToScreenX(cx, cy);
      pts.push(px, cam.worldToScreenY(cx, cy, top), px, cam.worldToScreenY(cx, cy, bottom ?? w.getHeight(cx, cy)));
    }
    return inHull(pts, sx, sy);
  }

  /**
   * Whether a screen point is on a building's pitched roof as `drawPitchedRoof`
   * lays it: a face, a hair past its edges as it is outlined; the cap along a
   * ridge or a hip, as wide as it is stroked; the fascia under an eave on the
   * near side; or a gable end on the near side (`drawGable`).
   */
  private roofCovers(b: Building, sx: number, sy: number): boolean {
    const kept = this.r.roofShapes.get(b.id);
    if (!kept) return false;
    const cam = this.r.camera;
    const zoom = cam.zoom;
    const world = this.r.game.world;
    const bld = this.r.game.buildings;
    const roofs: FloorTile[] = [];
    for (const k of b.tiles) {
      const [x, y] = k.split(',').map(Number);
      const f = bld.floor(b.levels, x, y);
      if (f && floorKind(f) === 'roof') roofs.push(f);
    }
    if (!roofs.length) return false;
    let eave = -Infinity;
    for (const f of roofs) eave = Math.max(eave, world.getHeight(f.x, f.y));
    // A building on piers stands on its deck, whatever the ground under it does.
    if (b.deck != null) eave = b.deck;
    eave += b.levels * WALL_HEIGHT;
    const pitch = ROOF_PITCH * roofShapeDef(b).rise;
    const model = kept.model;
    const X = (q: RoofPt): number => cam.worldToScreenX(q[0], q[1]);
    const Y = (q: RoofPt, drop = 0): number => cam.worldToScreenY(q[0], q[1], eave + pitch * q[2] - drop);
    for (const face of model.faces) {
      const n = face.pts.length;
      const poly = new Float64Array(n * 2);
      let cx = 0, cy = 0;
      face.pts.forEach((q, i) => {
        poly[i * 2] = X(q);
        poly[i * 2 + 1] = Y(q);
        cx += poly[i * 2] / n;
        cy += poly[i * 2 + 1] / n;
      });
      for (let i = 0; i < n * 2; i += 2) {
        const l = Math.hypot(poly[i] - cx, poly[i + 1] - cy) || 1;
        poly[i] += ((poly[i] - cx) / l) * 0.5;
        poly[i + 1] += ((poly[i + 1] - cy) / l) * 0.5;
      }
      if (inPolygon(poly, n * 2, sx, sy)) return true;
    }
    for (const c of model.creases) {
      if (c.kind === 'valley' || !isDone(roofs[c.tile])) continue;
      const w = Math.max(1.5, covering(roofs[c.tile].material).cap.w * zoom);
      const reach = (w + Math.max(1.2, 1.4 * zoom)) / 2 + Math.max(0.5, 0.5 * zoom);
      if (nearSegment(X(c.a), Y(c.a), X(c.b), Y(c.b), sx, sy, reach)) return true;
    }
    const p = COVER_PTS;
    for (const e of model.edges) {
      if (!isDone(roofs[e.tile])) continue;
      const [ox, oy] = FALLS[e.out];
      if (cam.nearSide(ox, oy) < 0) continue;
      const dp = covering(roofs[e.tile].material).fascia.deep;
      p[0] = X(e.a); p[1] = Y(e.a); p[2] = X(e.b); p[3] = Y(e.b);
      p[4] = X(e.b); p[5] = Y(e.b, dp); p[6] = X(e.a); p[7] = Y(e.a, dp);
      if (inPolygon(p, 8, sx, sy)) return true;
    }
    for (const g of model.gables) {
      const [ox, oy] = FALLS[g.out];
      if (cam.nearSide(ox, oy) < 0) continue;
      const out: number[] = [];
      const at = (q: RoofPt, h: number): void => {
        const wx = q[0] + ox * WALL_THICK, wy = q[1] + oy * WALL_THICK;
        out.push(cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, eave + h));
      };
      at(g.line[0], 0);
      for (const q of g.line) at(q, pitch * q[2]);
      at(g.line[g.line.length - 1], 0);
      if (inPolygon(out, out.length, sx, sy)) return true;
    }
    return false;
  }

  /**
   * Whether a point lands on what a hit box's thing was drawn as, or within
   * `PICK_SLACK` of it (`PICK_SLACK_TOUCH` by finger): its drawings again on a few pixels round the point,
   * and any of them covered. A box with no drawing kept is all box.
   */
  private shapeHas(h: HitRect, sx: number, sy: number, slack: number): boolean {
    if (!h.shapes?.length) return sx >= h.left && sx <= h.left + h.w && sy >= h.top && sy <= h.top + h.h;
    const n = slack * 2 + 1;
    const pad = (this.hitPad ??= document.createElement('canvas'));
    if (pad.width !== n) pad.width = pad.height = n;
    const g = pad.getContext('2d', { willReadFrequently: true });
    if (!g) return true;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, n, n);
    for (const d of h.shapes) {
      g.save();
      const at = new DOMMatrix([1, 0, 0, 1, slack - sx, slack - sy]);
      g.setTransform(d.m ? at.multiply(d.m) : at);
      try {
        d.draw(g, d.sx, d.sy);
      } catch {
        g.restore();
        return true;
      }
      g.restore();
    }
    const px = g.getImageData(0, 0, n, n).data;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a >= PICK_SOLID || (a >= PICK_ALPHA && Math.max(px[i], px[i + 1], px[i + 2]) >= PICK_SHADE)) return true;
    }
    return false;
  }

  /** Whether a screen point is on a tile: on its ground, or laid flat at height `flat` (a storey's floor). */
  private pointInTile(x: number, y: number, sx: number, sy: number, flat?: number): boolean {
    const w = this.r.game.world;
    const cam = this.r.camera;
    const p = this.r.pts;
    const h = (cx: number, cy: number): number => flat ?? w.getHeight(cx, cy);
    p[0] = cam.worldToScreenX(x, y);
    p[1] = cam.worldToScreenY(x, y, h(x, y));
    p[2] = cam.worldToScreenX(x + 1, y);
    p[3] = cam.worldToScreenY(x + 1, y, h(x + 1, y));
    p[4] = cam.worldToScreenX(x + 1, y + 1);
    p[5] = cam.worldToScreenY(x + 1, y + 1, h(x + 1, y + 1));
    p[6] = cam.worldToScreenX(x, y + 1);
    p[7] = cam.worldToScreenY(x, y + 1, h(x, y + 1));
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const xi = p[i * 2];
      const yi = p[i * 2 + 1];
      const xj = p[j * 2];
      const yj = p[j * 2 + 1];
      if (yi > sy !== yj > sy && sx < ((xj - xi) * (sy - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  private makePick(x: number, y: number, sx: number, sy: number, h?: number): Pick {
    const w = this.r.game.world;
    const approx = this.r.camera.screenToWorld(sx, sy, h ?? w.centerHeight(x, y));
    const wx = Math.min(x + 0.999, Math.max(x, approx.x));
    const wy = Math.min(y + 0.999, Math.max(y, approx.y));
    return { x, y, wx, wy, cx: Math.round(wx), cy: Math.round(wy) };
  }
}
