import type { Camera } from '../engine/camera';
import type { FullscreenCanvas } from '../engine/canvas';
import { type CellarTile, floorKind, CELLAR_DEPTH, type Side, isSpiral, CELLAR_LEVEL, WALL_HEIGHT, type FloorTile, isDone, WALL_THICK } from '../game/building';
import { crateCentre } from '../game/crates';
import { furnitureCentre, type PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import { VISIBLE } from '../game/vision';
import type { Season } from '../world/calendar';
import { CELLAR_VEIL, cellarOrder, sidesOf, KERB, UNDER, OUT, cellarFloor, flightShade, earthFace, faceOn, cutFace, earthEnd, cellarFloorHeight, type CellarCanvas, CELLAR_DARK_INK, CELLAR_DARK, CELLAR_FALL, shaftAlpha, shaftShade, SHAFT_STOPS } from './cellar';
import type { Ghost, Entity } from './drawshared';
import { FOG_COLOR } from './fog';
import type { PieceView } from './furniture';
import { HALF_W, HALF_H } from './iso';
import type { NameLabels } from './namelabels';
import { inOutline, type HitRect } from './picking';
import { lyingSprite, crateSprite, type Sprite } from './sprites';
import { StairPainter } from './stairdraw';
import type { TreeView } from './trees3d';
import { depthOf } from './view';

/** A piece of a cellar's drawing laid into a canvas of its own (`layOut`), and where it was laid against. */
type CellarLaid = { cv: HTMLCanvasElement; x0: number; y0: number; ax: number; ay: number; w: number; h: number };

/** What CellarPainter needs of the renderer (`renderer.ts` builds it). */
export interface CellarHost {
  readonly anvilHits: HitRect[];
  readonly camera: Camera;
  readonly canvas: FullscreenCanvas;
  readonly cellarHulls: Array<{ x: number; y: number; hull: Array<[number, number]>; floor: Array<[number, number]> }>;
  readonly crateHits: HitRect[];
  readonly creatureHits: HitRect[];
  readonly deckHits: HitRect[];
  drawEntities(ctx: CanvasRenderingContext2D, zoom: number): void;
  drawGhost(ctx: CanvasRenderingContext2D, zoom: number, ghost: Ghost): void;
  entN: number;
  readonly ents: Entity[];
  faceLight(ux: number, uy: number): number;
  readonly fireHits: HitRect[];
  flicker(l: { x: number; y: number; steady?: boolean }): number;
  footAt(x: number, y: number): number;
  readonly furnitureHits: HitRect[];
  readonly game: Game;
  readonly ghost: Ghost | null;
  inCellarPass: boolean;
  readonly kilnHits: HitRect[];
  logsAt(x: number, y: number): TreeView | undefined;
  readonly names: NameLabels;
  nightLayer(res?: number): HTMLCanvasElement;
  readonly peerHits: HitRect[];
  readonly postHits: HitRect[];
  readonly smelterHits: HitRect[];
  readonly stairs: StairPainter;
  take(kind: Entity['kind'], x: number, y: number, sx: number, sy: number, spr: Sprite | null): Entity;
  readonly trapHits: HitRect[];
  viewOf(piece: PlacedFurniture): PieceView;
  readonly year: { season: Season; day: number };
}

/**
 * Cellars as the renderer draws them (`CellarHost`): the view down into one from its own storey, its walls, floor
 * and dark, what lies in it, and the opening of a flight or a ladder down cut into the floor over it.
 */
export class CellarPainter {
  private cellarTiles: CellarTile[] = [];
  /** Names and what is said, held back while a cellar is laid line by line and put over it after (`overCellar`). */
  private cellarWords: Array<() => void> = [];
  /**
   * Each cellar tile's own drawing -- its floor and the sides of the dig
   * round it, and the cut across its near sides -- laid once into a canvas
   * of its own and put down again every frame after (`cellarLayer`), until
   * the view turns or zooms or a cellar changes (`cellarStamp`).
   */
  private cellarCache = new Map<string, CellarLaid>();
  private cellarStamp = '';
  /**
   * The inside of each hole a flight or a ladder goes down through, seen from
   * up top -- the dark, the far sides, the floor at the bottom, the way down
   * as far as the ground floor, each shaded by how deep it is -- laid once
   * and put down every frame after (`drawOpening`), until something it was
   * laid from changes: the view's turn or zoom, the dig, the flight, a wall
   * on its edge. Each keeps the stamp it was laid at.
   */
  private holeCache = new Map<string, CellarLaid & { stamp: string }>();

  constructor(private readonly r: CellarHost) {}

  overCellar(draw: () => void): void {
    if (this.r.inCellarPass) this.cellarWords.push(draw);
    else draw();
  }

  /**
   * The cellar, from down in it, over everything: the country laid back
   * under a veil, then every tile of every cellar a line at a time, back to
   * front -- its floor, the far sides of the dig, the way up, the near sides
   * cut down to a kerb, and what is down there, standing and lying -- and
   * the cellar's own dark over the lot, with what burns down there and the
   * daylight down the way in taken out of it. What the eye down there does
   * not reach (`Vision.cellarState`) is drawn as it is remembered: the room,
   * and nothing in it.
   */
  drawCellarView(ctx: CanvasRenderingContext2D, zoom: number): void {
    const g = this.r.game;
    const bld = g.buildings;
    const cam = this.r.camera;
    const V = cam.view;
    const W = this.r.canvas.width;
    const H = this.r.canvas.height;
    ctx.fillStyle = CELLAR_VEIL;
    ctx.fillRect(0, 0, W, H);
    const tiles = cellarOrder(g, V, this.cellarTiles);
    const { back, front } = sidesOf(V);
    const fogged = g.settings.fog;
    this.r.cellarHulls.length = 0;
    // What the cellars' own drawing was laid for: the view, and every tile of every cellar as it is dug.
    let stamp = `${cam.rotation}|${zoom}|${this.r.canvas.dpr}`;
    for (const t of tiles) {
      stamp += `;${t.x},${t.y},${t.dug},${t.building}`;
      // And the flight standing in it, for the shade it throws on the floor.
      const f = bld.floor(0, t.x, t.y);
      if (f && floorKind(f) === 'stairs') stamp += (f.facing ?? 's') + (f.hand ?? '');
    }
    if (stamp !== this.cellarStamp) {
      this.cellarStamp = stamp;
      this.cellarCache.clear();
    }
    /*
     * Ground standing in front of any of a cellar, within the three lines of
     * the screen a storey of it covers, is cut down to the cellar's floor and
     * a hand over it, so the room behind it shows: its sides there are drawn
     * cut (`cutFace`). Ground with nothing of a cellar behind it keeps its
     * full height, the dig's far sides standing up to the ground floor.
     */
    const eOf = (x: number, y: number): number => V.e[0] + V.e[1] * x + V.e[2] * y;
    const span = V.staggered ? 2 : 1;
    const cuts = new Map<string, number | null>();
    const cutTo = (ex: number, ey: number, building: number): number | null => {
      const key = `${ex},${ey},${building}`;
      const had = cuts.get(key);
      if (had !== undefined) return had;
      let out: number | null = null;
      if (!bld.cellar(ex, ey)) {
        const d0 = depthOf(V, ex, ey);
        const e0 = eOf(ex, ey);
        for (let dy = -3; dy <= 3 && out === null; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            // Only the same cellar: another one behind is another room, and its own sides are its own.
            const behind = bld.cellar(ex + dx, ey + dy);
            if (!behind || behind.building !== building) continue;
            const dd = d0 - depthOf(V, behind.x, behind.y);
            if (dd > 0 && dd <= 3 && Math.abs(eOf(behind.x, behind.y) - e0) < span) {
              out = g.world.getHeight(behind.x, behind.y) - CELLAR_DEPTH + KERB;
              break;
            }
          }
        }
      }
      cuts.set(key, out);
      return out;
    };
    // What was hit-boxed up top before the cellar went over it: whatever the cellar covers is not there to click.
    const hitLists = [this.r.creatureHits, this.r.peerHits, this.r.crateHits, this.r.fireHits, this.r.smelterHits, this.r.kilnHits,
      this.r.furnitureHits, this.r.anvilHits, this.r.postHits, this.r.trapHits, this.r.deckHits];
    const upTop = hitLists.map((l) => l.length);
    this.r.inCellarPass = true;
    // The names up top are under the veil with their bodies: only those down here are drawn over the cellar.
    this.r.names.clear();
    for (let i = 0; i < tiles.length;) {
      const d = depthOf(V, tiles[i].x, tiles[i].y);
      this.r.ents.length = 0;
      this.r.entN = 0;
      for (; i < tiles.length && depthOf(V, tiles[i].x, tiles[i].y) === d; i++) {
        const t = tiles[i];
        const { x, y } = t;
        const top = g.world.getHeight(x, y);
        const F = top - t.dug;
        // The floor of the dig at its deepest: what a tile only part dug stands on, cut.
        const deep = Math.min(F, top - CELLAR_DEPTH);
        const sx = cam.worldToScreenX(x + 0.5, y + 0.5);
        if (sx < -HALF_W * 2 * zoom || sx > W + HALF_W * 2 * zoom) continue;
        if (cam.worldToScreenY(x + 0.5, y + 0.5, deep) < -HALF_H * 2 * zoom || cam.worldToScreenY(x + 0.5, y + 0.5, top + 12) > H + HALF_H * 2 * zoom) continue;
        const hull = this.cellarHull(x, y, deep - UNDER, top);
        const floor = ([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]] as Array<[number, number]>)
          .map(([px, py]): [number, number] => [cam.worldToScreenX(px, py), cam.worldToScreenY(px, py, F)]);
        this.r.cellarHulls.push({ x, y, hull, floor });
        // Which sides are the ground, and which go on into more of the same cellar.
        const same = (side: Side): CellarTile | undefined => {
          const n = bld.cellar(x + OUT[side][0], y + OUT[side][1]);
          return n && n.building === t.building ? n : undefined;
        };
        const against = (['n', 'e', 's', 'w'] as Side[]).filter((side) => !same(side));
        const anchor: [number, number] = [cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, top)];
        const flight = bld.floor(0, x, y);
        this.cellarLayer(`${x},${y}:under`, hull, anchor, (c) => {
          cellarFloor(c, g, x, y, F, against);
          // Under a staircase, the floor in its shade: a flight seen from its head end stands up off the floor and not on it.
          if (flight && floorKind(flight) === 'stairs' && !isSpiral(flight)) flightShade(c, x, y, F, flight.facing ?? 's');
          for (const side of back) {
            const n = same(side);
            if (!n) {
              const cut = cutTo(x + OUT[side][0], y + OUT[side][1], t.building);
              if (cut === null) earthFace(c, faceOn(g, x, y, side, F, 1, true));
              else cutFace(c, g, x, y, side, F, cut, false);
              // The next building's cellar across it: square on, the earth between the two is edge on.
              if (bld.cellar(x + OUT[side][0], y + OUT[side][1])) earthEnd(c, x, y, side, F, top);
              continue;
            }
            // More of the cellar, not dug so deep: the face of what is left standing, up to its floor.
            const nF = cellarFloorHeight(g, x + OUT[side][0], y + OUT[side][1]);
            if (nF > F + 0.01) {
              const face = faceOn(g, x, y, side, F, 1, false);
              face.hi0 = nF;
              face.hi1 = nF;
              earthFace(c, face);
            }
          }
        });
        // The way up out of it, from its floor to the ground floor, standing in this tile: cut where everything over
        // the ground floor is, its rails and a ladder's head with it.
        if (flight && (floorKind(flight) === 'stairs' || floorKind(flight) === 'ladder')) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(hull[0][0], hull[0][1]);
          for (let k = 1; k < hull.length; k++) ctx.lineTo(hull[k][0], hull[k][1]);
          ctx.closePath();
          ctx.clip();
          if (floorKind(flight) === 'ladder') this.r.stairs.drawLadder(flight, x, y, top, 1, false);
          else this.r.stairs.drawStairs(flight, x, y, top, 1);
          ctx.restore();
        }
        const cutNear = front.filter((side) => !same(side));
        if (cutNear.length) this.cellarLayer(`${x},${y}:over`, hull, anchor, (c) => {
          for (const side of cutNear) cutFace(c, g, x, y, side, deep - UNDER, F + KERB, true);
        });
        // A tile only part dug is seen when the room beside it is: its face and its top are what you see of it.
        const seen = !fogged || g.vision.cellarState(x, y) === VISIBLE
          || (t.dug < CELLAR_DEPTH && (['n', 'e', 's', 'w'] as Side[]).some((side) => !!same(side) && g.vision.cellarState(x + OUT[side][0], y + OUT[side][1]) === VISIBLE));
        if (seen) this.takeCellarThings(x, y, F);
        else {
          // Remembered: the room as it was, and nothing in it -- its floor under the cold wash remembered ground has.
          ctx.beginPath();
          ctx.moveTo(floor[0][0], floor[0][1]);
          for (let k = 1; k < 4; k++) ctx.lineTo(floor[k][0], floor[k][1]);
          ctx.closePath();
          ctx.fillStyle = FOG_COLOR;
          ctx.fill();
        }
      }
      if (this.r.ents.length) this.r.drawEntities(ctx, zoom);
    }
    // The names over everybody down here, over everything in the cellar.
    for (const draw of this.cellarWords) draw();
    this.cellarWords.length = 0;
    // What is being set down down here, over the whole of it, once.
    if (this.r.ghost) this.r.drawGhost(ctx, zoom, this.r.ghost);
    this.r.inCellarPass = false;
    hitLists.forEach((list, n) => {
      let k = 0;
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        if (i < upTop[n] && this.r.cellarHulls.some((c) => inOutline(c.hull, h.left + h.w / 2, h.top + h.h / 2))) continue;
        list[k++] = h;
      }
      list.length = k;
    });
    this.cellarDark(ctx, zoom);
  }

  /**
   * Lay a cellar tile's own drawing through the cache: drawn into a canvas
   * of its own the first time it is wanted, over the box of the tile's
   * outline, and put down every frame after at the same place against the
   * tile's corner, on a whole pixel so it stays sharp. What a cellar costs a
   * frame is then a few blits and what moves in it.
   */
  private cellarLayer(key: string, hull: Array<[number, number]>, anchor: [number, number], draw: (c: CellarCanvas) => void): void {
    let had = this.cellarCache.get(key);
    if (!had) {
      had = this.layOut(hull, anchor, draw);
      this.cellarCache.set(key, had);
    }
    this.putDown(had, anchor, 1);
  }

  /** A drawing laid into a canvas of its own, over the box round `hull` and a margin, against `anchor`. */
  private layOut(hull: Array<[number, number]>, anchor: [number, number], draw: (c: CellarCanvas) => void): CellarLaid {
    const dpr = this.r.canvas.dpr;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [hx, hy] of hull) {
      if (hx < x0) x0 = hx;
      if (hx > x1) x1 = hx;
      if (hy < y0) y0 = hy;
      if (hy > y1) y1 = hy;
    }
    x0 = Math.floor(x0) - 4;
    y0 = Math.floor(y0) - 4;
    const w = Math.ceil(x1) + 4 - x0, h = Math.ceil(y1) + 4 - y0;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr));
    cv.height = Math.max(1, Math.ceil(h * dpr));
    const lay = cv.getContext('2d') as CanvasRenderingContext2D;
    lay.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
    lay.lineJoin = 'round';
    draw({ ctx: lay, cam: this.r.camera, zoom: this.r.camera.zoom, light: (ux, uy) => this.r.faceLight(ux, uy) });
    return { cv, x0, y0, ax: anchor[0], ay: anchor[1], w, h };
  }

  /** Put a laid drawing down where its anchor has gone since, as the camera moved: on a whole pixel, so it stays sharp. */
  private putDown(had: CellarLaid, anchor: [number, number], alpha: number): void {
    const dpr = this.r.canvas.dpr;
    const dx = Math.round((anchor[0] - had.ax) * dpr) / dpr;
    const dy = Math.round((anchor[1] - had.ay) * dpr) / dpr;
    const ctx = this.r.canvas.ctx;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(had.cv, had.x0 + dx, had.y0 + dy, had.w, had.h);
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  /**
   * A cellar tile's outline on the screen, from its floor to the ground
   * floor over it: the box it is, a hair wider than the tile so the kerb
   * round it is in it too, as the hull of its eight corners.
   */
  private cellarHull(x: number, y: number, floor: number, top: number): Array<[number, number]> {
    const cam = this.r.camera;
    const pts: Array<[number, number]> = [];
    for (const [u, v] of [[-0.1, -0.1], [1.1, -0.1], [1.1, 1.1], [-0.1, 1.1]]) pts.push([cam.worldToScreenX(x + u, y + v), cam.worldToScreenY(x + u, y + v, floor - 0.6)]);
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) pts.push([cam.worldToScreenX(x + u, y + v), cam.worldToScreenY(x + u, y + v, top + 1)]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Array<[number, number]> = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Array<[number, number]> = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  }

  /** What is down in a cellar on one tile, stood on its floor at `floor`: things lying, pieces, crates, people. */
  private takeCellarThings(x: number, y: number, floor: number): void {
    const g = this.r.game;
    const cam = this.r.camera;
    const pile = g.groundAt(x, y, CELLAR_LEVEL);
    if (pile.length) {
      const e = this.r.take('pile', x, y, cam.worldToScreenX(x + 0.5, y + 0.5), cam.worldToScreenY(x + 0.5, y + 0.5, floor), lyingSprite(pile, x, y, this.r.logsAt(x, y), this.r.year.season));
      let best = 0;
      for (const it of pile) if ((it.rare ?? 0) > best) best = it.rare ?? 0;
      if (best) e.rare = best;
    }
    if (g.anythingPlaced(x, y)) {
      for (const fu of g.furnitureOnTile(x, y)) {
        if ((fu.level ?? 0) >= 0) continue;
        const [wx, wy] = furnitureCentre(fu);
        const fe = this.r.take('furniture', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, floor), null);
        fe.piece = fu;
        fe.view = this.r.viewOf(fu);
        if (fu.rare) fe.rare = fu.rare;
      }
      for (const crate of g.cratesOnTile(x, y)) {
        if ((crate.level ?? 0) >= 0 || g.rackAt(crate.x, crate.y, crate.sx, crate.sy, crate.level)) continue;
        const [wx, wy] = crateCentre(crate);
        const ce = this.r.take('crate', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, floor), crateSprite(crate.kind));
        ce.crateId = crate.id;
        if (crate.rare) ce.rare = crate.rare;
      }
    }
    if (g.roster.size) {
      for (const peer of g.roster.atTile(x, y)) {
        if (peer.level >= 0) continue;
        const [px, py] = g.roster.drawnAt(peer);
        this.r.take('peer', x, y, cam.worldToScreenX(px, py), cam.worldToScreenY(px, py, this.r.footAt(px, py) + peer.level * WALL_HEIGHT), null).peer = peer;
      }
    }
    const p = g.player;
    if (p.level < 0 && p.tileX === x && p.tileY === y) {
      this.r.take('player', x, y, cam.worldToScreenX(p.x, p.y), cam.worldToScreenY(p.x, p.y, this.r.footAt(p.x, p.y) + p.visualLevel * WALL_HEIGHT), null);
    }
  }

  /**
   * A cellar's dark: laid over every tile of it that was drawn, at every
   * hour, with what burns down there and the daylight down the way in taken
   * out of it, as the night's wash has the lights taken out of it up top,
   * and a warm cast where a flame's light falls.
   */
  private cellarDark(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.r.cellarHulls.length) return;
    const g = this.r.game;
    const cam = this.r.camera;
    const room = new Path2D();
    // And the box round all of it on the screen: the dark is laid in that and no more, so it costs what the cellar covers.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { hull } of this.r.cellarHulls) {
      room.moveTo(hull[0][0], hull[0][1]);
      for (let k = 1; k < hull.length; k++) room.lineTo(hull[k][0], hull[k][1]);
      room.closePath();
      for (const [hx, hy] of hull) {
        if (hx < x0) x0 = hx;
        if (hx > x1) x1 = hx;
        if (hy < y0) y0 = hy;
        if (hy > y1) y1 = hy;
      }
    }
    const lights = g.cellarLights();
    const at = (l: { x: number; y: number }): [number, number] => {
      const h = cellarFloorHeight(g, Math.floor(l.x), Math.floor(l.y)) + 8;
      return [cam.worldToScreenX(l.x, l.y), cam.worldToScreenY(l.x, l.y, h)];
    };
    const layer = this.r.nightLayer();
    const bx = Math.max(0, Math.floor(x0) - 2), by = Math.max(0, Math.floor(y0) - 2);
    const bw = Math.min(layer.width, Math.ceil(x1) + 2) - bx, bh = Math.min(layer.height, Math.ceil(y1) + 2) - by;
    if (bw <= 0 || bh <= 0) return;
    const nc = layer.getContext('2d') as CanvasRenderingContext2D;
    nc.setTransform(1, 0, 0, 1, 0, 0);
    nc.globalCompositeOperation = 'source-over';
    nc.clearRect(bx, by, bw, bh);
    nc.save();
    nc.beginPath();
    nc.rect(bx, by, bw, bh);
    nc.clip();
    nc.fillStyle = `rgba(${CELLAR_DARK_INK}, ${CELLAR_DARK})`;
    nc.fill(room, 'nonzero');
    nc.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const [sx, sy] = at(l);
      const r = Math.max(8, l.radius * HALF_W * zoom * this.r.flicker(l));
      // Falling off fast from the flame: what you carry lights what is round you, and leaves the far side of a room in the dark.
      const grad = nc.createRadialGradient(sx, sy, 0, sx, sy, r);
      for (const [at, k] of CELLAR_FALL) grad.addColorStop(at, `rgba(0,0,0,${(l.strength * k).toFixed(3)})`);
      nc.fillStyle = grad;
      nc.beginPath();
      nc.arc(sx, sy, r, 0, Math.PI * 2);
      nc.fill();
    }
    nc.restore();
    nc.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, bx, by, bw, bh, bx, by, bw, bh);
    if (!lights.length) return;
    ctx.save();
    ctx.clip(room);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const [sx, sy] = at(l);
      const r = Math.max(8, l.radius * HALF_W * zoom * this.r.flicker(l));
      const cast = l.cast ?? '255, 186, 92';
      const warm = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      warm.addColorStop(0, `rgba(${cast}, ${(l.castAlpha ?? 0.16 * l.strength).toFixed(3)})`);
      warm.addColorStop(1, `rgba(${cast}, 0)`);
      ctx.fillStyle = warm;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * A way down into a cellar, from up top: a hole in the ground floor, and
   * what can be seen down it -- the far sides of the hole going down out of
   * the light, the cellar floor at the bottom where it shows, and the flight
   * or the ladder going down. Everything below the ground floor shows only
   * through the hole; what stands up out of it, a rail or a ladder's head,
   * shows over it.
   */
  drawOpening(floor: FloorTile, x: number, y: number, base: number, alpha: number): void {
    const ctx = this.r.canvas.ctx;
    const cam = this.r.camera;
    const g = this.r.game;
    const w = g.world;
    const bld = g.buildings;
    const hole: Array<[number, number]> = ([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]] as Array<[number, number]>)
      .map(([cx, cy]) => [cam.worldToScreenX(cx, cy), cam.worldToScreenY(cx, cy, w.getHeight(cx, cy))]);
    const holePath = (): void => {
      ctx.beginPath();
      ctx.moveTo(hole[0][0], hole[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(hole[i][0], hole[i][1]);
      ctx.closePath();
    };
    // The sides of the hole that are the ground, and the walls standing on its edges.
    const own = bld.cellar(x, y)?.building;
    const against: Side[] = [];
    let walls = '';
    for (const side of ['n', 'e', 's', 'w'] as Side[]) {
      const [ox, oy] = OUT[side];
      if (!bld.sameCellar(own, x + ox, y + oy)) against.push(side);
      const wall = bld.wall(0, x, y, side);
      walls += wall && isDone(wall) ? side : '-';
      const next = bld.floor(0, x + ox, y + oy);
      if (next && floorKind(next) === 'stairs') walls += (next.facing ?? 's') + (next.hand ?? '');
    }
    // Inside the hole, laid once: everything under the ground floor's plane, each part shaded by how deep it is.
    const stamp = `${cam.rotation}|${cam.zoom}|${this.r.canvas.dpr}|${bld.cellar(x, y)?.dug}|${floor.kind}${floor.facing}${floor.hand ?? ''}${floor.material}`
      + `${floor.dye ?? ''}${isDone(floor) ? 1 : 0}|${against.join('')}|${walls}`;
    const key = `${x},${y}`;
    const anchor: [number, number] = hole[0];
    let had = this.holeCache.get(key);
    if (!had || had.stamp !== stamp) {
      if (this.holeCache.size > 256) this.holeCache.clear();
      had = { ...this.layOut(hole, anchor, (c) => this.holeInside(c, floor, x, y, base, hole, against)), stamp };
      this.holeCache.set(key, had);
    }
    this.putDown(had, anchor, alpha);
    // What stands up out of it, over the screen above the hole and not in it: the rails, and a ladder's head.
    // The hole's upper edges: from its leftmost corner over its top one to its rightmost, the higher of two level with each other.
    let hi = 0, left = 0, right = 0;
    for (let i = 1; i < 4; i++) {
      const [hx, hy] = hole[i];
      if (hy < hole[hi][1]) hi = i;
      if (hx < hole[left][0] - 1e-6 || (Math.abs(hx - hole[left][0]) <= 1e-6 && hy < hole[left][1])) left = i;
      if (hx > hole[right][0] + 1e-6 || (Math.abs(hx - hole[right][0]) <= 1e-6 && hy < hole[right][1])) right = i;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hole[left][0], -1e5);
    ctx.lineTo(hole[left][0], hole[left][1]);
    ctx.lineTo(hole[hi][0], hole[hi][1]);
    ctx.lineTo(hole[right][0], hole[right][1]);
    ctx.lineTo(hole[right][0], -1e5);
    ctx.closePath();
    ctx.clip();
    if (floorKind(floor) === 'ladder') this.r.stairs.drawLadder(floor, x, y, base, alpha, false);
    else this.r.stairs.drawStairs(floor, x, y, base, alpha, 'over');
    ctx.restore();
    // And the rim of the hole.
    holePath();
    ctx.strokeStyle = 'rgba(40, 30, 32, 0.85)';
    ctx.lineWidth = Math.max(0.8, cam.zoom);
    ctx.stroke();
  }

  /**
   * The inside of a hole down to a cellar, laid into `c` (`drawOpening`): the
   * dark, the floor at the bottom, the far sides going down, and the way down
   * as far as the ground floor -- each darker the deeper it is
   * (`shaftShade`), by its height under the ground floor rather than by where
   * it falls on the screen, so the top of a flight is in the light at every
   * turn of the view, whichever way it goes down.
   */
  private holeInside(c: CellarCanvas, floor: FloorTile, x: number, y: number, base: number, hole: Array<[number, number]>, against: readonly Side[]): void {
    const g = this.r.game;
    const bld = g.buildings;
    const cam = this.r.camera;
    const lay = c.ctx;
    const bottom = cellarFloorHeight(g, x, y);
    const deep = Math.max(1, base - bottom);
    const { back } = sidesOf(cam.view);
    const P = (wx: number, wy: number, h: number): [number, number] => [cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, h)];
    lay.save();
    lay.beginPath();
    lay.moveTo(hole[0][0], hole[0][1]);
    for (let i = 1; i < 4; i++) lay.lineTo(hole[i][0], hole[i][1]);
    lay.closePath();
    lay.clip();
    lay.fillStyle = 'rgb(26, 20, 22)';
    lay.fillRect(-1e5, -1e5, 2e5, 2e5);
    // The floor at the bottom, as deep as the hole goes.
    cellarFloor(c, g, x, y, bottom, against, true);
    lay.save();
    lay.beginPath();
    const fl = [P(x, y, bottom), P(x + 1, y, bottom), P(x + 1, y + 1, bottom), P(x, y + 1, bottom)];
    lay.moveTo(fl[0][0], fl[0][1]);
    for (let i = 1; i < 4; i++) lay.lineTo(fl[i][0], fl[i][1]);
    lay.closePath();
    lay.fillStyle = `rgba(12, 9, 12, ${shaftAlpha((base - bottom) / deep).toFixed(3)})`;
    lay.fill();
    lay.restore();
    // The far sides, each shaded down its own height.
    for (const side of back) {
      const [ox, oy] = OUT[side];
      const open = !against.includes(side);
      const face = faceOn(g, x, y, side, bottom, 0.7, true);
      face.plain = true;
      // The cellar going on under the floor beside the hole: dark, with the floor's timbers over it.
      if (open) {
        face.lo0 = face.hi0 - 3.6;
        face.lo1 = face.hi1 - 3.6;
        face.rock0 = face.lo0 - 1;
        face.rock1 = face.lo1 - 1;
      }
      // A wall standing on the edge of the hole stands on the ground floor's edge: the hole's side is its inner face.
      const wall = bld.wall(0, x, y, side);
      if (wall && isDone(wall)) {
        face.ax -= ox * WALL_THICK;
        face.bx -= ox * WALL_THICK;
        face.ay -= oy * WALL_THICK;
        face.by -= oy * WALL_THICK;
      }
      earthFace(c, face);
      // Shaded by depth: along the face's own up and down, from its head at the ground floor to the floor of the hole.
      const a0 = P(face.ax, face.ay, face.hi0), a1 = P(face.bx, face.by, face.hi1), b0 = P(face.ax, face.ay, bottom);
      lay.save();
      lay.beginPath();
      lay.moveTo(a0[0], a0[1]);
      lay.lineTo(a1[0], a1[1]);
      const b1 = P(face.bx, face.by, Math.min(face.lo1, face.hi1));
      const b0f = P(face.ax, face.ay, Math.min(face.lo0, face.hi0));
      lay.lineTo(b1[0], b1[1]);
      lay.lineTo(b0f[0], b0f[1]);
      lay.closePath();
      lay.fillStyle = shaftShade(lay, a0, a1, b0);
      lay.fill();
      lay.restore();
    }
    // The way down, as far as the ground floor, laid on a sheet of its own and shaded from its foot to its head.
    const sheet = document.createElement('canvas');
    sheet.width = lay.canvas.width;
    sheet.height = lay.canvas.height;
    const way = sheet.getContext('2d') as CanvasRenderingContext2D;
    way.setTransform(lay.getTransform());
    way.lineJoin = 'round';
    const ladder = floorKind(floor) === 'ladder';
    if (ladder) this.r.stairs.drawLadder(floor, x, y, base, 1, false, way);
    else this.r.stairs.drawStairs(floor, x, y, base, 1, 'whole', way);
    const [foot, head] = StairPainter.wayEnds(x, y, floor.facing ?? 's', ladder);
    const f0 = P(foot[0], foot[1], bottom), f1 = P(head[0], head[1], base);
    const grad = way.createLinearGradient(f0[0], f0[1], f1[0], f1[1]);
    for (const [k, at] of SHAFT_STOPS) grad.addColorStop(1 - at, `rgba(12, 9, 12, ${k})`);
    way.globalCompositeOperation = 'source-atop';
    way.fillStyle = grad;
    way.fillRect(-1e5, -1e5, 2e5, 2e5);
    lay.setTransform(1, 0, 0, 1, 0, 0);
    lay.drawImage(sheet, 0, 0);
    lay.restore();
  }
}
