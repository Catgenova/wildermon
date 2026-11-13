import type { Camera } from '../engine/camera';
import type { FullscreenCanvas } from '../engine/canvas';
import { roofShapeOf, floorKind, type FloorTile, WALL_HEIGHT, isDone, WALL_THICK, type Building, ROOF_PITCH, roofShapeDef, type Border, borderPoints, MATERIAL_BY_ID, type MaterialDef } from '../game/building';
import type { Game } from '../game/game';
import { GLASS } from '../game/glasshouse';
import type { LightSource } from '../game/light';
import { PLAN_COLOR, LAMP_DARK, rgb, scatterOf, type BakeAs } from './drawshared';
import { glassFace, glassBack, glass, glassReflects } from './glazing';
import { HALF_W, HALF_H, UNITS_PER_TILE, HEIGHT_SCALE } from './iso';
import type { Masonry } from './masonry';
import { COVER_PPT, covering } from './roofing';
import { type RoofModel, roofModel, type RoofPt, type Fall, FALLS, type RoofGable } from './roofshape';
import type { StructureWatch } from './structwatch';
import { type View, depthOf } from './view';

/** How far in from the eaves a roof goes on rising, in tiles: past that it is a flat top. */
const ROOF_CAP = 2.5;
/** How far the eaves hang out past the wall's line, and the verge past a gable end, in tiles. */
const ROOF_OVER = 0.14;
const ROOF_VERGE = 0.1;
/** How far down the wall under an eave its shade reaches, in height units: further than any eave's board is deep (`EAVE_DEEP`). */
const EAVE_SHADE = 10;

/** What RoofPainter needs of the renderer (`renderer.ts` builds it). */
export interface RoofHost {
  readonly bakeEpoch: number;
  baked(key: string, ax: number, ay: number, box: [number, number, number, number], draw: () => void, ver: number, opts?: BakeAs): void;
  buildingBase(id: number): number;
  readonly camera: Camera;
  readonly canvas: FullscreenCanvas;
  readonly cut: Set<number>;
  faceLight(ux: number, uy: number): number;
  readonly game: Game;
  readonly glassNight: Array<{ faces: Array<{ path: Path2D; m: DOMMatrix }>; lights: Array<{ x: number; y: number; r: number; a: number }>; box: [number, number, number, number]; dx: number; dy: number }>;
  readonly lightsNow: LightSource[];
  masonryOf(wall: { material: string; dye?: string }): Masonry | undefined;
  occludeLine(box: [number, number, number, number] | null, draw: () => void): void;
  painted(mat: MaterialDef, dye: string | undefined): MaterialDef;
  readonly roofQueue: Map<number, Building[]>;
  readonly roofShapes: Map<number, { sig: string; model: RoofModel }>;
  readonly roomTiles: Set<string> | null;
  seeThroughCtx(box?: [number, number, number, number]): CanvasRenderingContext2D;
  storeyHidden(level: number): boolean;
  readonly structs: StructureWatch;
  readonly sunNow: [number, number, number];
}

/**
 * Roofs as the renderer lays them (`RoofHost`): a building's pitched roof (its faces, ridges, hips, fascia and gables)
 * queued by the line it is laid after, a flat roof's deck, and roofs and gables of glass with the glow of the lights
 * under them.
 */
export class RoofPainter {
  /** The layer a glass roof's glow is made on, at half the screen's size (`drawGlassGlow`). */
  private glowLayer: CanvasRenderingContext2D | null = null;
  /** A covering with the hour's light for one face laid into it, as a pattern: see `drawPitchedRoof`. */
  private roofPatterns = new Map<string, CanvasPattern>();

  /**
   * A roof's faces of glass turned to the eye, as its picture was last made
   * (`drawPitchedRoof`), for the glow of a light under it: its picture's key,
   * the view it was made in and the point it hangs on.
   */
  private roofGlass = new Map<number, { key: string; epoch: number; ax: number; ay: number; faces: Array<{ path: Path2D; m: DOMMatrix }>; box: [number, number, number, number]; height: number }>();

  constructor(private readonly r: RoofHost) {}

  /**
   * Which pitched roofs are laid this frame, and when.
   *
   * A roof is one surface over its building, and it goes on after every wall
   * under it: its eaves hang out over the walls' heads. Laid a tile at a time
   * with the tiles, as it was, the walls of the next line of the ground came
   * out over the roof behind them. So each is laid once, after the line of the
   * ground that holds the building's front walls -- the line in front of its
   * front tiles -- and before anything standing on that line.
   */
  queueRoofs(V: View, dLo: number, dHi: number): void {
    this.r.roofQueue.clear();
    const bld = this.r.game.buildings;
    // A building pulled down takes its roof's shape with it.
    for (const id of this.r.roofShapes.keys()) if (!bld.list.has(id)) this.r.roofShapes.delete(id);
    for (const b of bld.list.values()) {
      if (roofShapeOf(b) === 'flat') continue;
      // Looking at one storey lifts everything over it off, the roof with it; and looking into a cellar, the building over it.
      // Pinned on a storey, a roof is shown only from its own level (`storeyview.ts`).
      if (this.r.storeyHidden(b.levels)) continue;
      if (this.r.cut.has(b.id)) continue;
      let front = -Infinity;
      // Its jetties' tiles too, where the roof goes out over them (`roofTiles`).
      for (const [x, y] of bld.roofTiles(b)) {
        const f = bld.floor(b.levels, x, y);
        if (f && floorKind(f) === 'roof') front = Math.max(front, depthOf(V, x, y));
      }
      if (front === -Infinity || front + 1 < dLo) continue;
      const d = Math.min(front + 1, dHi);
      const line = this.r.roofQueue.get(d);
      if (line) line.push(b);
      else this.r.roofQueue.set(d, [b]);
    }
  }

  /**
   * Which of a covering's three pictures to lay, or a floor's, painted at
   * `ppt` pixels to the tile: the coarsest that still has a pixel of it for
   * every pixel of screen a tile's side covers. The finest shrunk to a
   * quarter was sampled, not shrunk, and a roof of courses shimmered into
   * stripes as the camera moved.
   */
  roofMip(ppt = COVER_PPT): number {
    const side = Math.hypot(HALF_W, HALF_H) * this.r.camera.zoom * this.r.canvas.dpr;
    return ppt / 4 >= side * 0.9 ? 2 : ppt / 2 >= side * 0.9 ? 1 : 0;
  }

  /**
   * A tile of a flat roof: the covering's deck, laid across the building in
   * one piece, from the inner face of the wall round it -- the wall's own top
   * is the rim of it -- and marked out where it is only planned.
   */
  drawDeck(floor: FloorTile, x: number, y: number, base: number, alpha: number): void {
    const ctx = this.r.canvas.ctx;
    const cam = this.r.camera;
    const bld = this.r.game.buildings;
    const h = base + floor.level * WALL_HEIGHT;
    const done = isDone(floor);
    const decked = (tx: number, ty: number): boolean => {
      const f = bld.floor(floor.level, tx, ty);
      return !!f && floorKind(f) === 'roof';
    };
    const u0 = decked(x - 1, y) ? 0 : WALL_THICK, u1 = decked(x + 1, y) ? 1 : 1 - WALL_THICK;
    const v0 = decked(x, y - 1) ? 0 : WALL_THICK, v1 = decked(x, y + 1) ? 1 : 1 - WALL_THICK;
    const pts = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]): [number, number] => [cam.worldToScreenX(x + u, y + v), cam.worldToScreenY(x + u, y + v, h)]);
    const cx = (pts[0][0] + pts[2][0]) / 2, cy = (pts[0][1] + pts[2][1]) / 2;
    ctx.globalAlpha = alpha * (done ? 1 : 0.4);
    // A hair past its own edges, so nothing shows between it and the next tile of it.
    ctx.beginPath();
    for (const [px, py] of pts) {
      const l = Math.hypot(px - cx, py - cy) || 1;
      ctx.lineTo(px + ((px - cx) / l) * 0.5, py + ((py - cy) / l) * 0.5);
    }
    ctx.closePath();
    const cov = covering(floor.material);
    if (done) {
      const mip = this.roofMip(), k = 1 / (COVER_PPT >> mip);
      const key = `deck:${floor.material}:${mip}`;
      let pat = this.roofPatterns.get(key);
      if (!pat) {
        pat = ctx.createPattern(cov.deck[mip], 'repeat') ?? undefined;
        if (pat) this.roofPatterns.set(key, pat);
      }
      if (pat) {
        const sx = cam.worldToScreenX(0, 0), sy = cam.worldToScreenY(0, 0, h);
        pat.setTransform(new DOMMatrix([
          cam.worldToScreenX(k, 0) - sx, cam.worldToScreenY(k, 0, h) - sy,
          cam.worldToScreenX(0, k) - sx, cam.worldToScreenY(0, k, h) - sy,
          sx, sy,
        ]));
        ctx.fillStyle = pat;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = `rgba(${cov.fascia.body[0]}, ${cov.fascia.body[1]}, ${cov.fascia.body[2]}, 0.5)`;
      ctx.fill();
      ctx.beginPath();
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.closePath();
      ctx.strokeStyle = PLAN_COLOR;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A pitched roof, whole: see `roofshape.ts` for its shape and `roofing.ts`
   * for what covers it.
   *
   * Everything on it -- its faces, the capping along its ridges and hips, the
   * line down its valleys, the board along its eaves and up its verges, and
   * its gable ends -- goes into one list and is laid back to front. A roof is
   * a surface never over itself seen from above, so of two pieces of it the
   * one standing further down the screen is the one in front. The shade its
   * eaves throw on the walls under them goes on first, under all of it.
   */
  drawPitchedRoof(b: Building): void {
    const bld = this.r.game.buildings;
    const level = b.levels;
    // Standing under it: as it always was.
    const roofTiles = bld.roofTiles(b);
    if (this.r.roomTiles && roofTiles.some(([x, y]) => this.r.roomTiles?.has(`${x},${y}`))) {
      this.drawPitchedRoofNow(b);
      this.r.occludeLine(null, () => this.drawPitchedRoofNow(b));
      return;
    }
    const cam = this.r.camera;
    const world = this.r.game.world;
    let sig = '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let lowest = Infinity;
    let fx = Infinity, fy = Infinity, gx = -Infinity, gy = -Infinity;
    for (const [x, y] of roofTiles) {
      const f = bld.floor(level, x, y);
      if (!f || floorKind(f) !== 'roof') continue;
      sig += `${x},${y},${f.material},${f.dye ?? ''},${isDone(f) ? 1 : 0};`;
      lowest = Math.min(lowest, world.getHeight(x, y));
      fx = Math.min(fx, x); fy = Math.min(fy, y);
      gx = Math.max(gx, x); gy = Math.max(gy, y);
    }
    if (!sig) return;
    if (b.deck != null) lowest = Math.min(lowest, b.deck);
    /*
     * What it is drawn over (`drawPitchedRoofNow`): the box round its faces,
     * a wall's thickness out for the gable ends and the shade under the
     * eaves, from `EAVE_SHADE` under the eaves to the top of the ridge; and
     * past that on the screen by as much as the widest ridge cap and the
     * tallest cresting stand off their line. It was a tile and a half past
     * every eave, up to as high as the widest roof of its footprint could
     * stand: most of a roof's picture was nothing, and made and copied the same.
     */
    const frame = this.roofFrame(b);
    if (!frame) return;
    let wx0 = Infinity, wy0 = Infinity, wx1 = -Infinity, wy1 = -Infinity, rise = 0;
    for (const f of frame.model.faces) {
      for (const p of f.pts) {
        wx0 = Math.min(wx0, p[0]); wx1 = Math.max(wx1, p[0]);
        wy0 = Math.min(wy0, p[1]); wy1 = Math.max(wy1, p[1]);
        rise = Math.max(rise, p[2]);
      }
    }
    const out = WALL_THICK * 2;
    const ridge = frame.eave + ROOF_PITCH * roofShapeDef(b).rise * rise;
    for (const cx of [wx0 - out, wx1 + out]) {
      for (const cy of [wy0 - out, wy1 + out]) {
        for (const z of [frame.eave - EAVE_SHADE, ridge]) {
          const sx = cam.worldToScreenX(cx, cy), sy = cam.worldToScreenY(cx, cy, z);
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
      }
    }
    const cap = 4 + 12 * cam.zoom;
    x0 -= cap; y0 -= cap; x1 += cap; y1 += cap;
    const key = `r|${b.id}|${level}|${b.deck ?? ''}|${roofShapeOf(b)}|${sig}`;
    const ax = cam.worldToScreenX(fx, fy), ay = cam.worldToScreenY(fx, fy, lowest);
    // What it reads is its own building and what stands round it: `REACH` round the tiles it covers (`StructureWatch`).
    this.r.baked(key, ax, ay, [x0, y0, x1, y1], () => this.drawPitchedRoofNow(b, { key, ax, ay }), this.r.structs.version(fx, fy, gx, gy));
    /*
     * With a light burning under it after dark, its glass glows over the
     * night (`drawGlassGlow`): from the faces of glass kept when its picture
     * was made, where it lands now. A roof with a lamp under it used to be
     * drawn afresh every frame of the night for that.
     */
    if (this.r.game.darkness() < LAMP_DARK) return;
    const burning = this.lightsUnder(b);
    if (!burning.length) return;
    const kept = this.roofGlass.get(b.id);
    if (kept && kept.key === key && kept.epoch === this.r.bakeEpoch) {
      if (kept.faces.length) this.noteGlassGlow(kept.faces, kept.box, burning, kept.height, false, ax - kept.ax, ay - kept.ay);
    } else {
      this.drawPitchedRoofNow(b, { key, ax, ay }, true);
      const now = this.roofGlass.get(b.id);
      if (now?.faces.length) this.noteGlassGlow(now.faces, now.box, burning, now.height, false);
    }
  }

  /** A building's roof tiles, its roof's shape (kept while its tiles are the same) and the height of its eaves; null with no roof. */
  roofFrame(b: Building): { roofs: FloorTile[]; model: RoofModel; eave: number } | null {
    const bld = this.r.game.buildings;
    const world = this.r.game.world;
    const level = b.levels;
    const roofs: FloorTile[] = [];
    // Over its jetties as well as its footprint (`roofTiles`).
    for (const [x, y] of bld.roofTiles(b)) {
      const f = bld.floor(level, x, y);
      if (f && floorKind(f) === 'roof') roofs.push(f);
    }
    if (!roofs.length) return null;
    const shape = roofShapeOf(b) === 'gable' ? 'gable' : 'hip';
    const sig = `${shape}:${roofs.map((f) => `${f.x},${f.y}`).join(';')}`;
    let kept = this.r.roofShapes.get(b.id);
    if (!kept || kept.sig !== sig) {
      kept = { sig, model: roofModel(roofs.map((f): [number, number] => [f.x, f.y]), shape, ROOF_OVER, ROOF_VERGE, ROOF_CAP) };
      this.r.roofShapes.set(b.id, kept);
    }
    let eave = -Infinity;
    // A jetty's ground is not the building's: the eaves are over the footprint's.
    for (const f of roofs) if (bld.buildingAt(f.x, f.y)) eave = Math.max(eave, world.getHeight(f.x, f.y));
    if (eave === -Infinity) eave = this.r.buildingBase(b.id);
    // A building on piers stands on its deck, whatever the ground under it does.
    if (b.deck != null) eave = b.deck;
    eave += level * WALL_HEIGHT;
    return { roofs, model: kept.model, eave };
  }

  /**
   * `keep`: drawn for its picture, which keeps its faces of glass for the glow
   * (`roofGlass`) rather than laying it on this frame's night; `glassOnly`
   * finds those faces and draws nothing.
   */
  private drawPitchedRoofNow(b: Building, keep?: { key: string; ax: number; ay: number }, glassOnly = false): void {
    const main = this.r.canvas.ctx;
    const cam = this.r.camera;
    const bld = this.r.game.buildings;
    const zoom = cam.zoom;
    const level = b.levels;
    const frame = this.roofFrame(b);
    if (!frame) return;
    const { roofs, model, eave } = frame;
    const pitch = ROOF_PITCH * roofShapeDef(b).rise;
    const X = (p: RoofPt): number => cam.worldToScreenX(p[0], p[1]);
    const Y = (p: RoofPt, drop = 0): number => cam.worldToScreenY(p[0], p[1], eave + pitch * p[2] - drop);
    const deep = (x: number, y: number): number => cam.worldToScreenY(x, y, 0);
    /*
     * Standing under it, you see through it. It is laid on a layer of its own
     * and the layer put over the room at a third: laid straight on at a third,
     * every place two of its pieces overlap came out darker than the rest.
     */
    const under = !!this.r.roomTiles && roofs.some((f) => this.r.roomTiles?.has(`${f.x},${f.y}`));
    /*
     * Glass is seen through already (`glazing.ts`), so out of doors a roof of
     * it is laid straight on. Standing under one it goes on that layer as any
     * roof over you does: the frame and the panes of all of it ghosted over the
     * room at a third, so you can see where the glass is without it hiding
     * what you are working on.
     */
    const glassy = (f: FloorTile): boolean => f.material === GLASS;
    const ctx = under ? this.r.seeThroughCtx() : main;
    /*
     * How a face of it is lit, on the scale the walls are: the light from the
     * camera's left and from above that makes a wall facing down the screen
     * to the left the bright one, taken on a face tilted at the pitch.
     */
    const slope = pitch / UNITS_PER_TILE;
    const lightOf = (fall: Fall): number => {
      let nx = 0, ny = 0;
      if (fall !== 4) {
        const [fx, fy] = FALLS[fall];
        nx = cam.rotateX(fx, fy) * slope;
        ny = cam.rotateY(fx, fy) * slope;
      }
      const l = Math.hypot(nx, ny, 1);
      return 0.55 + 0.55 * ((-0.249 * nx + 0.498 * ny + 0.83) / l);
    };
    const mip = this.roofMip();
    const ppt = COVER_PPT >> mip;
    /** The covering with a face's light laid into it. Laid over, two faces of one plane overlapping at a seam would take it twice. */
    const patternOf = (material: string, lit: number): CanvasPattern | null => {
      const q = Math.round(lit * 50) / 50;
      const k = `${material}:${mip}:${q}`;
      let pat = this.roofPatterns.get(k);
      if (pat) {
        this.roofPatterns.delete(k);
        this.roofPatterns.set(k, pat);
        return pat;
      }
      const cov = covering(material);
      const img = cov.mips[mip];
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.drawImage(img, 0, 0);
      // The hour's light on what is there and not over it: a covering seen through keeps the opacity it was painted at.
      g.globalCompositeOperation = 'source-atop';
      const a = cov.shadow(q);
      if (a > 0.001) {
        g.fillStyle = `rgba(${cov.shade[0]}, ${cov.shade[1]}, ${cov.shade[2]}, ${a.toFixed(3)})`;
        g.fillRect(0, 0, c.width, c.height);
      } else if (q > 1) {
        g.fillStyle = `rgba(255, 250, 240, ${Math.min(0.24, (q - 1) * 0.8).toFixed(3)})`;
        g.fillRect(0, 0, c.width, c.height);
      }
      pat = ctx.createPattern(c, 'repeat') ?? undefined;
      if (!pat) return null;
      this.roofPatterns.set(k, pat);
      // A camera turned all the way round asks for forty of them; the oldest go.
      while (this.roofPatterns.size > 48) {
        const first = this.roofPatterns.keys().next().value;
        if (first === undefined) break;
        this.roofPatterns.delete(first);
      }
      return pat;
    };
    /*
     * The items to lay, back to front. A run of faces of one plane next to
     * each other in that order is laid as one path, with one fill: it is
     * the same picture in the same place, and a fill is what a roof costs.
     */
    const items: Array<{ d: number; draw: () => void; plane?: string; face?: number }> = [];
    const faceDepth = model.faces.map((f) => {
      let x = 0, y = 0;
      for (const p of f.pts) { x += p[0]; y += p[1]; }
      return deep(x / f.pts.length, y / f.pts.length);
    });
    /*
     * Whether a way of falling faces the camera. A roof is one surface over
     * the ground, so a slope falling away from the camera more steeply than
     * the camera looks down is under the slopes in front of it everywhere it
     * shows: drawn, it only cost a fill and was covered.
     */
    const [gx, gy] = [cam.unrotateX(1, 1), cam.unrotateY(1, 1)];
    const gl = Math.hypot(gx, gy) || 1;
    const down = (HALF_H * Math.SQRT2) / (HEIGHT_SCALE * UNITS_PER_TILE);
    const facing = (fall: Fall): boolean => {
      if (fall === 4) return true;
      const [fx, fy] = FALLS[fall];
      return slope * ((fx * gx + fy * gy) / gl) + down > 0;
    };
    /** Whether a slope turned away is turned far enough to show at all, through the glass in front of it: edge on, it is a hairline. */
    const showsBehind = (fall: Fall): boolean => {
      if (fall === 4) return false;
      const [fx, fy] = FALLS[fall];
      return slope * ((fx * gx + fy * gy) / gl) + down < -0.05;
    };
    /*
     * The far slopes seen through glass, and the glint on it, are detail: none
     * below the level-of-detail line at 0.6, all of it from 0.7, and faded in
     * between, so zooming across the line does not switch them on in a frame.
     */
    const behind = Math.max(0, Math.min(1, (zoom - 0.6) / 0.1));
    /**
     * How much of a face is laid: one turned to the eye, all of it; a far slope
     * of finished glass, seen through the near one, as much as `behind` gives;
     * anything else, none. The creases go by the same answer, so none is drawn
     * without a face beside it.
     */
    const shown = (f: (typeof model.faces)[number]): number => {
      if (facing(f.fall)) return 1;
      const tile = roofs[f.tile];
      return glassy(tile) && isDone(tile) && showsBehind(f.fall) ? behind : 0;
    };
    const planeOf = (f: (typeof model.faces)[number]): string => {
      const tile = roofs[f.tile];
      if (!isDone(tile)) return `plan:${tile.material}`;
      if (f.fall === 4) return `${tile.material}:4:${f.pts[0][2]}`;
      const [nx, ny] = FALLS[f.fall];
      const p0 = f.pts[0];
      return `${tile.material}:${f.fall}:${(p0[2] + nx * p0[0] + ny * p0[1]).toFixed(4)}`;
    };
    /** A face's outline, a hair past its own edges, so nothing shows between two faces of one plane. */
    const outlineOf = (f: (typeof model.faces)[number]): void => {
      const pts = f.pts.map((p): [number, number] => [X(p), Y(p)]);
      let cx = 0, cy = 0;
      for (const [x, y] of pts) { cx += x; cy += y; }
      cx /= pts.length;
      cy /= pts.length;
      pts.forEach(([x, y], i) => {
        const l = Math.hypot(x - cx, y - cy) || 1;
        const qx = x + ((x - cx) / l) * 0.5, qy = y + ((y - cy) / l) * 0.5;
        if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy);
      });
      ctx.closePath();
    };
    /*
     * The picture laid on a face's plane: across it along the eave, and down
     * it from the eave's edge, so a course's tail lies along every eave.
     */
    const planeMatrix = (f: (typeof model.faces)[number]): DOMMatrix => {
      const [nx, ny] = FALLS[f.fall === 4 ? 1 : f.fall];
      const ex = -ny, ey = nx;
      const k = 1 / ppt;
      let ox: number, oy: number, h0: number, rise: number;
      if (f.fall === 4) {
        ox = 0; oy = 0; h0 = eave + pitch * f.pts[0][2]; rise = 0;
      } else {
        const p0 = f.pts[0];
        const c = p0[2] + nx * p0[0] + ny * p0[1];
        ox = nx * (c + ROOF_OVER); oy = ny * (c + ROOF_OVER); h0 = eave - pitch * ROOF_OVER; rise = 1;
      }
      const sx = cam.worldToScreenX(ox, oy), sy = cam.worldToScreenY(ox, oy, h0);
      return new DOMMatrix([
        cam.worldToScreenX(ox + ex * k, oy + ey * k) - sx, cam.worldToScreenY(ox + ex * k, oy + ey * k, h0) - sy,
        cam.worldToScreenX(ox + nx * k, oy + ny * k) - sx, cam.worldToScreenY(ox + nx * k, oy + ny * k, h0 - pitch * rise * k) - sy,
        sx, sy,
      ]);
    };
    /*
     * How hard a slope of glass throws the sun back into the eye: the sun off
     * the face's plane, against the way the camera looks down, as a specular
     * glint that moves from slope to slope with the hour and the turn of the
     * view, and nothing in the dark.
     */
    const sun = this.r.sunNow;
    const upward = Math.sin(Math.atan(down));
    const across = Math.cos(Math.atan(down));
    const eye: [number, number, number] = [(gx / gl) * across, (gy / gl) * across, upward];
    const glintOf = (fall: Fall): number => {
      const [fx, fy] = fall === 4 ? [0, 0] : FALLS[fall];
      const nl = Math.hypot(slope * fx, slope * fy, 1);
      const n = [(slope * fx) / nl, (slope * fy) / nl, 1 / nl];
      const sn = sun[0] * n[0] + sun[1] * n[1] + sun[2] * n[2];
      if (sn <= 0 || sun[2] <= 0) return 0;
      const rv = (2 * sn * n[0] - sun[0]) * eye[0] + (2 * sn * n[1] - sun[1]) * eye[1] + (2 * sn * n[2] - sun[2]) * eye[2];
      return rv <= 0 ? 0 : Math.min(1, rv ** 6 * 1.2) * (1 - this.r.game.darkness());
    };
    // A light burning under the glass, for the glow the night lays on it.
    const burning = this.lightsUnder(b);
    /** Fill what has been outlined with the face's picture, laid on its plane. */
    const fillAs = (f: (typeof model.faces)[number]): void => {
      const tile = roofs[f.tile];
      if (!isDone(tile)) {
        const cov = covering(tile.material);
        ctx.fillStyle = `rgba(${cov.fascia.body[0]}, ${cov.fascia.body[1]}, ${cov.fascia.body[2]}, 0.28)`;
        ctx.fill();
        return;
      }
      if (glassy(tile)) {
        this.glaze(ctx, planeMatrix(f), lightOf(f.fall), facing(f.fall), glintOf(f.fall), behind);
        return;
      }
      const pat = patternOf(tile.material, lightOf(f.fall));
      if (!pat) return;
      pat.setTransform(planeMatrix(f));
      ctx.fillStyle = pat;
      ctx.fill();
    };
    const plan: FloorTile[] = [];
    // The faces of glass a light burns under, for the glow the night lays on them, and the box round them: see `drawGlassGlow`.
    const glowing: Array<{ path: Path2D; m: DOMMatrix }> = [];
    const glowBox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    model.faces.forEach((f, i) => {
      const tile = roofs[f.tile];
      // Glass shows the slopes beyond it, from under them; anything else only what faces the eye.
      if (shown(f) <= 0) return;
      items.push({ d: faceDepth[i], plane: planeOf(f), face: i, draw: () => { ctx.beginPath(); outlineOf(f); fillAs(f); } });
      if ((keep || burning.length) && facing(f.fall) && glassy(tile) && isDone(tile)) {
        const path = new Path2D();
        f.pts.forEach((p, k) => {
          const px = X(p), py = Y(p);
          if (k) path.lineTo(px, py); else path.moveTo(px, py);
          glowBox[0] = Math.min(glowBox[0], px); glowBox[1] = Math.min(glowBox[1], py);
          glowBox[2] = Math.max(glowBox[2], px); glowBox[3] = Math.max(glowBox[3], py);
        });
        path.closePath();
        glowing.push({ path, m: planeMatrix(f) });
      }
    });
    if (keep) {
      this.roofGlass.set(b.id, { ...keep, epoch: this.r.bakeEpoch, faces: glowing, box: glowBox, height: eave + pitch * 0.5 });
      if (glassOnly) return;
    } else if (glowing.length) this.noteGlassGlow(glowing, glowBox, burning, eave + pitch * 0.5, under);
    for (const f of roofs) if (!isDone(f)) plan.push(f);
    // The creases and the edges go on after the faces they lie along.
    const byPoint = new Map<string, number[]>();
    model.faces.forEach((f, i) => {
      for (const p of f.pts) {
        const k = `${p[0]},${p[1]}`;
        const at = byPoint.get(k);
        if (at) at.push(i);
        else byPoint.set(k, [i]);
      }
    });
    const after = (a: RoofPt, bq: RoofPt): number => {
      const A = byPoint.get(`${a[0]},${a[1]}`) ?? [];
      const B = new Set(byPoint.get(`${bq[0]},${bq[1]}`) ?? []);
      let m = -Infinity;
      for (const i of A) if (B.has(i)) m = Math.max(m, faceDepth[i]);
      return m === -Infinity ? deep((a[0] + bq[0]) / 2, (a[1] + bq[1]) / 2) : m;
    };
    /** Points at every `every` tiles along a crease from `a` to `b`, counted from the world's own origin so they run on from one piece of it to the next. */
    const marks = (a: RoofPt, bq: RoofPt, every: number): RoofPt[] => {
      const out: RoofPt[] = [];
      const along = Math.abs(bq[0] - a[0]) > 1e-9 ? 0 : 1;
      const u0 = a[along], u1 = bq[along];
      if (Math.abs(u1 - u0) < 1e-9) return out;
      const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
      for (let u = Math.ceil(lo / every - 1e-9) * every; u <= hi + 1e-9; u += every) {
        const t = (u - u0) / (u1 - u0);
        if (t <= 1e-6 || t >= 1 - 1e-6) continue;
        out.push([a[0] + (bq[0] - a[0]) * t, a[1] + (bq[1] - a[1]) * t, a[2] + (bq[2] - a[2]) * t]);
      }
      return out;
    };
    /** How much of the faces along a crease from `a` to `b` is laid (`shown`): a crease is drawn as strongly as the most of them, and not at all with none. */
    const seen = (a: RoofPt, bq: RoofPt): number => {
      const B = new Set(byPoint.get(`${bq[0]},${bq[1]}`) ?? []);
      let most = 0;
      for (const i of byPoint.get(`${a[0]},${a[1]}`) ?? []) if (B.has(i)) most = Math.max(most, shown(model.faces[i]));
      return most;
    };
    /*
     * On a roof with no valley every ridge and hip is on top of everything
     * else of it, so they go on after all its faces: laid after only the two
     * faces either side, the next tile's face along the hip went on over the
     * end of the piece before it, and every joint of the ridge was a notch of
     * the covering cut into the cap.
     */
    const ridgedLast = !model.creases.some((c) => c.kind === 'valley');
    for (const c of model.creases) {
      const strength = isDone(roofs[c.tile]) ? seen(c.a, c.b) : 0;
      if (strength <= 0) continue;
      items.push({ d: (ridgedLast ? 1e9 : 0) + after(c.a, c.b) + 0.001, draw: () => {
        const was = ctx.globalAlpha;
        ctx.globalAlpha = was * strength;
        drawCrease();
        ctx.globalAlpha = was;
      } });
      const drawCrease = (): void => {
        const cov = covering(roofs[c.tile].material);
        let ax = X(c.a), ay = Y(c.a), bx = X(c.b), by = Y(c.b);
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.01) return;
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        if (c.kind === 'valley') {
          ctx.strokeStyle = cov.valley;
          ctx.lineWidth = Math.max(1, 1.6 * zoom);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          ctx.lineCap = 'butt';
          ctx.lineWidth = 1;
          return;
        }
        // A hair longer at both ends, so two pieces of one ridge meet with nothing between them.
        ax -= ux * 0.5; ay -= uy * 0.5; bx += ux * 0.5; by += uy * 0.5;
        const cap = cov.cap, w = Math.max(1.5, cap.w * zoom);
        const run = (width: number, ink: string, oy = 0): void => {
          ctx.strokeStyle = ink;
          ctx.lineWidth = width;
          ctx.beginPath(); ctx.moveTo(ax, ay + oy); ctx.lineTo(bx, by + oy); ctx.stroke();
        };
        run(w + Math.max(1.2, 1.4 * zoom), cap.dark, Math.max(0.5, 0.5 * zoom));
        run(w, cap.body);
        run(Math.max(0.8, w * 0.28), cap.hi, -w * 0.22);
        // Across it: the joints of its ridge tiles, the spars pegging a straw ridge down.
        const tick = (p: RoofPt, dx: number, dy: number, width: number, ink: string): void => {
          const px = X(p), py = Y(p);
          ctx.strokeStyle = ink;
          ctx.lineWidth = width;
          ctx.beginPath(); ctx.moveTo(px - dx, py - dy); ctx.lineTo(px + dx, py + dy); ctx.stroke();
        };
        const nX = -uy * w * 0.5, nY = ux * w * 0.5;
        if (cap.kind === 'straw') {
          for (const p of marks(c.a, c.b, cap.joint)) {
            tick(p, nX + ux * w * 0.35, nY + uy * w * 0.35, Math.max(0.8, 1.1 * zoom), cap.dark);
            tick(p, nX - ux * w * 0.35, nY - uy * w * 0.35, Math.max(0.8, 1.1 * zoom), cap.dark);
          }
        } else if (cap.joint > 0) {
          for (const p of marks(c.a, c.b, cap.joint)) tick(p, nX, nY, Math.max(0.8, 1 * zoom), cap.dark);
        }
        // And on polished metal, a cresting of finials along the ridge itself.
        if (cap.kind === 'crest' && c.kind === 'ridge') {
          for (const p of marks(c.a, c.b, 0.25)) {
            const px = X(p), py = Y(p) - w * 0.4, h = Math.max(2, 4.5 * zoom);
            ctx.strokeStyle = cap.dark;
            ctx.lineWidth = Math.max(1, 1.2 * zoom);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - h); ctx.stroke();
            ctx.beginPath(); ctx.arc(px, py - h, Math.max(1, 1.4 * zoom), 0, Math.PI * 2);
            ctx.fillStyle = cap.hi; ctx.fill(); ctx.stroke();
          }
        }
        ctx.lineWidth = 1;
      };
    }
    for (const e of model.edges) {
      if (!isDone(roofs[e.tile])) continue;
      const [ox, oy] = FALLS[e.out];
      if (cam.nearSide(ox, oy) < 0) continue;
      const cov = covering(roofs[e.tile].material);
      /*
       * Where glass stops at a hole in the roof -- the next tile of the
       * building has no finished roof yet, or none at all -- it is a cut edge,
       * not an eave: its last bar along it, and no gutter.
       */
      const edgeTile = roofs[e.tile];
      if (glassy(edgeTile) && bld.buildingAt(edgeTile.x + ox, edgeTile.y + oy)?.id === b.id) {
        items.push({ d: after(e.a, e.b) + 0.002, draw: () => {
          ctx.lineCap = 'round';
          ctx.strokeStyle = cov.cap.dark;
          ctx.lineWidth = Math.max(1.4, 2 * zoom);
          ctx.beginPath(); ctx.moveTo(X(e.a), Y(e.a) + 0.5); ctx.lineTo(X(e.b), Y(e.b) + 0.5); ctx.stroke();
          ctx.strokeStyle = cov.cap.body;
          ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
          ctx.beginPath(); ctx.moveTo(X(e.a), Y(e.a)); ctx.lineTo(X(e.b), Y(e.b)); ctx.stroke();
          ctx.lineCap = 'butt';
          ctx.lineWidth = 1;
        } });
        continue;
      }
      const fl = this.r.faceLight(-oy, ox);
      // The shade the eave throws down the wall under it, under everything: glass lets the light through.
      if (e.wall && !glassy(roofs[e.tile])) {
        const [wa, wb] = e.wall;
        const off = (p: RoofPt): RoofPt => [p[0] + ox * WALL_THICK, p[1] + oy * WALL_THICK, 0];
        const A = off(wa), B = off(wb);
        items.push({ d: -Infinity, draw: () => {
          const top = Y(A, pitch * WALL_THICK), bottom = Y(A, EAVE_SHADE);
          ctx.beginPath();
          ctx.moveTo(X(A), Y(A, pitch * WALL_THICK)); ctx.lineTo(X(B), Y(B, pitch * WALL_THICK));
          ctx.lineTo(X(B), Y(B, EAVE_SHADE)); ctx.lineTo(X(A), Y(A, EAVE_SHADE));
          ctx.closePath();
          const g = ctx.createLinearGradient(0, top, 0, bottom);
          g.addColorStop(0, 'rgba(44, 34, 56, 0.3)');
          g.addColorStop(1, 'rgba(44, 34, 56, 0)');
          ctx.fillStyle = g;
          ctx.fill();
        } });
      }
      items.push({ d: after(e.a, e.b) + 0.002, draw: () => {
        const F = cov.fascia, dp = F.deep;
        ctx.beginPath();
        ctx.moveTo(X(e.a), Y(e.a));
        ctx.lineTo(X(e.b), Y(e.b));
        ctx.lineTo(X(e.b), Y(e.b, dp));
        ctx.lineTo(X(e.a), Y(e.a, dp));
        ctx.closePath();
        if (F.kind === 'straw') {
          const g = ctx.createLinearGradient(0, Math.min(Y(e.a), Y(e.b)), 0, Math.max(Y(e.a, dp), Y(e.b, dp)));
          g.addColorStop(0, rgb(F.body, fl * 1.08));
          g.addColorStop(1, rgb(F.edge, fl));
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = rgb(F.body, fl);
        }
        ctx.fill();
        // Its foot, and on a gutter the light along its round.
        ctx.strokeStyle = rgb(F.edge, fl);
        ctx.lineWidth = Math.max(1, 1.1 * zoom);
        ctx.beginPath(); ctx.moveTo(X(e.a), Y(e.a, dp)); ctx.lineTo(X(e.b), Y(e.b, dp)); ctx.stroke();
        if (F.kind === 'gutter' || F.kind === 'cornice') {
          ctx.strokeStyle = rgb(F.body, Math.min(1.35, fl * 1.25));
          ctx.beginPath(); ctx.moveTo(X(e.a), Y(e.a, dp * 0.4)); ctx.lineTo(X(e.b), Y(e.b, dp * 0.4)); ctx.stroke();
        }
        // Along a marble eave, the ends of its covers stand up in a row of palmettes.
        if (F.kind === 'cornice' && e.kind === 'eave') {
          for (const p of marks(e.a, e.b, 1 / 8)) {
            const px = X(p), py = Y(p), r = Math.max(1.2, 2.4 * zoom);
            ctx.beginPath();
            ctx.moveTo(px - r, py);
            ctx.arc(px, py, r, Math.PI, 0);
            ctx.closePath();
            ctx.fillStyle = rgb(F.body, Math.min(1.3, fl * 1.12));
            ctx.fill();
            ctx.strokeStyle = rgb(F.edge, fl);
            ctx.lineWidth = Math.max(0.7, 0.8 * zoom);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 1;
      } });
    }
    for (const g of model.gables) {
      const [ox, oy] = FALLS[g.out];
      // A gable end under a glass roof is glazed, and seen through from either side.
      const glazed = g.borders.every((bb) => glassy(roofs[bb.tile]));
      if (cam.nearSide(ox, oy) < 0 && !glazed) continue;
      // Before everything along its edge: the verge over it stands further out.
      const d = Math.min(...g.line.map((p) => deep(p[0], p[1]))) - 0.001;
      // It goes up with the roof over it: under a roof only planned, it is only planned too.
      const built = g.borders.every((bb) => isDone(roofs[bb.tile]));
      items.push({ d, draw: () => {
        const was = ctx.globalAlpha;
        if (!built) ctx.globalAlpha = was * 0.3;
        if (glazed) this.drawGlassGable(ctx, g, eave, pitch);
        else this.drawGable(ctx, g, level, eave, pitch, roofs);
        ctx.globalAlpha = was;
      } });
    }
    items.sort((p, q) => p.d - q.d);
    ctx.globalAlpha = 1;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.plane === undefined || it.face === undefined) { it.draw(); continue; }
      ctx.beginPath();
      outlineOf(model.faces[it.face]);
      while (i + 1 < items.length && items[i + 1].plane === it.plane && items[i + 1].face !== undefined) {
        outlineOf(model.faces[items[i + 1].face as number]);
        i++;
      }
      fillAs(model.faces[it.face]);
    }
    // What is only planned yet is marked out where it will go.
    if (plan.length) {
      ctx.strokeStyle = PLAN_COLOR;
      ctx.setLineDash([5, 4]);
      for (const f of plan) {
        ctx.beginPath();
        for (const [cx, cy] of [[f.x, f.y], [f.x + 1, f.y], [f.x + 1, f.y + 1], [f.x, f.y + 1]]) ctx.lineTo(cam.worldToScreenX(cx, cy), cam.worldToScreenY(cx, cy, eave));
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    if (under && ctx !== main) {
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = 0.35;
      main.drawImage(ctx.canvas, 0, 0);
      main.restore();
    }
  }

  /**
   * Lay a face of glass (`glazing.ts`) over what has been outlined: its panes
   * as thick as its light lays them and its frame in that light; a slope seen
   * from under it, through the glass in front, as its frame alone in shade;
   * and over a face that throws the sun at the eye, the glint, as strongly as
   * it does.
   */
  private glaze(ctx: CanvasRenderingContext2D, m: DOMMatrix, lit: number, front: boolean, shine: number, detail: number): void {
    const mip = this.roofMip();
    const pat = this.glassPattern(front ? 'face' : 'back', lit, mip, ctx);
    if (!pat) return;
    pat.setTransform(m);
    const was = ctx.globalAlpha;
    if (!front) ctx.globalAlpha = was * 0.4 * detail;
    ctx.fillStyle = pat;
    ctx.fill();
    ctx.globalAlpha = was;
    // No glint where a face is a few pixels across: from that far off a roof is its shape and its colour. It fades in with `detail`.
    if (front && shine > 0.02 && detail > 0) {
      const glint = this.glassPattern('glint', 1, mip, ctx);
      if (glint) {
        // The band of sun slides along the slope as the hours go, a picture's width over a third of a day.
        glint.setTransform(m.translate(((this.r.game.hourOfDay() / 8) % 1) * (COVER_PPT >> mip) * 2, 0));
        ctx.globalAlpha = was * shine * detail;
        ctx.fillStyle = glint;
        ctx.fill();
        ctx.globalAlpha = was;
      }
    }
  }

  /** Glass's patterns, made once for each size and each step of light, and kept with the roofs'. */
  private glassPattern(kind: 'face' | 'back' | 'glint' | 'glow', lit: number, mip: number, ctx: CanvasRenderingContext2D): CanvasPattern | null {
    const q = Math.round(lit * 50) / 50;
    const k = `glass:${kind}:${mip}${kind === 'face' || kind === 'back' ? `:${q}` : ''}`;
    let pat = this.roofPatterns.get(k);
    if (pat) {
      this.roofPatterns.delete(k);
      this.roofPatterns.set(k, pat);
      return pat;
    }
    const src = kind === 'face' ? glassFace(q, mip) : kind === 'back' ? glassBack(q, mip) : kind === 'glint' ? glass().glint[mip] : glass().glow[mip];
    pat = ctx.createPattern(src, 'repeat') ?? undefined;
    if (!pat) return null;
    this.roofPatterns.set(k, pat);
    while (this.roofPatterns.size > 48) {
      const first = this.roofPatterns.keys().next().value;
      if (first === undefined) break;
      this.roofPatterns.delete(first);
    }
    return pat;
  }

  /**
   * What is burning under a building's roof after dark with nothing finished
   * between it and the roof: the lights a glass roof glows with. A fire on the
   * ground floor of a house of two storeys has a ceiling over it.
   */
  private lightsUnder(b: Building): LightSource[] {
    if (!this.r.lightsNow.length) return [];
    const bld = this.r.game.buildings;
    return this.r.lightsNow.filter((l) => {
      const x = Math.floor(l.x), y = Math.floor(l.y);
      if (bld.buildingAt(x, y)?.id !== b.id) return false;
      for (let k = l.level ?? 0; k < b.levels - 1; k++) if (bld.coveredAt(k, x, y)) return false;
      return true;
    });
  }

  /**
   * A roof's faces of glass with lights under them, kept for the night to lay
   * the glow on after the dark has gone over everything: the faces' outlines
   * and pictures, and each light where it stands under the roof, how far its
   * glow carries across the glass -- half again its own reach, falling to
   * nothing there -- and how strong it is. Over your head, at the third the
   * roof itself is laid at.
   */
  private noteGlassGlow(faces: Array<{ path: Path2D; m: DOMMatrix }>, box: [number, number, number, number], lights: LightSource[], height: number, under: boolean,
    dx = 0, dy = 0): void {
    const cam = this.r.camera;
    const zoom = cam.zoom;
    const [x0, y0, x1, y1] = box;
    const lit = lights.map((l) => ({
      x: cam.worldToScreenX(l.x, l.y),
      y: cam.worldToScreenY(l.x, l.y, height),
      r: Math.max(8, 1.5 * l.radius * HALF_W * zoom),
      a: l.strength * (under ? 0.35 : 1),
    }));
    this.r.glassNight.push({ faces, lights: lit, box: [x0 + dx - 2, y0 + dy - 2, x1 + dx + 2, y1 + dy + 2], dx, dy });
  }

  /**
   * The glow of glass with a light under it, over the night: its panes warm
   * and bright, its bars dark across them, brightest over a light and gone at
   * half again its reach. One pass a roof, however many lights burn under it,
   * on one layer at half the screen's size -- a glow is soft, and half the size
   * is a quarter of the work:
   *
   *   * every light's reach is added into the layer as a mask, each drawn over
   *     its own reach and no further;
   *   * the lit faces are laid in the glow's picture over that mask, `source-atop`,
   *     so a face takes the picture as strongly as the lights reach it, and
   *     what lies between faces keeps only the mask, which is black and adds
   *     nothing to the night;
   *   * and the lot goes onto the night once, as light is, so the dark under it
   *     is lifted rather than painted over.
   *
   * All of it in the part of the roof's box some light reaches: for a big roof
   * with one lamp in a corner, the corner.
   */
  drawGlassGlow(ctx: CanvasRenderingContext2D, dark: number): void {
    const layer = this.glowCtx();
    const pat = this.glassPattern('glow', 1, this.roofMip(), layer);
    if (!pat) return;
    const t = layer.getTransform();
    const k = layer.canvas.width / Math.max(1, ctx.canvas.width);
    for (const roof of this.r.glassNight) {
      let bx0 = roof.box[0], by0 = roof.box[1], bx1 = roof.box[2], by1 = roof.box[3];
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (const l of roof.lights) {
        rx0 = Math.min(rx0, l.x - l.r); ry0 = Math.min(ry0, l.y - l.r);
        rx1 = Math.max(rx1, l.x + l.r); ry1 = Math.max(ry1, l.y + l.r);
      }
      bx0 = Math.max(bx0, rx0); by0 = Math.max(by0, ry0); bx1 = Math.min(bx1, rx1); by1 = Math.min(by1, ry1);
      if (bx1 <= bx0 || by1 <= by0) continue;
      // The box on the layer, in its own pixels, and where that lands on the screen.
      const p0 = t.transformPoint(new DOMPoint(bx0, by0));
      const p1 = t.transformPoint(new DOMPoint(bx1, by1));
      const lx = Math.max(0, Math.floor(Math.min(p0.x, p1.x))), ly = Math.max(0, Math.floor(Math.min(p0.y, p1.y)));
      const lw = Math.min(layer.canvas.width, Math.ceil(Math.max(p0.x, p1.x))) - lx;
      const lh = Math.min(layer.canvas.height, Math.ceil(Math.max(p0.y, p1.y))) - ly;
      if (lw <= 0 || lh <= 0) continue;
      layer.save();
      layer.setTransform(1, 0, 0, 1, 0, 0);
      layer.clearRect(lx, ly, lw, lh);
      layer.restore();
      layer.save();
      layer.beginPath();
      layer.rect(bx0, by0, bx1 - bx0, by1 - by0);
      layer.clip();
      // Every light's reach, added together.
      layer.globalCompositeOperation = 'lighter';
      for (const l of roof.lights) {
        const reach = layer.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        reach.addColorStop(0, `rgba(0, 0, 0, ${l.a.toFixed(3)})`);
        reach.addColorStop(0.45, `rgba(0, 0, 0, ${(l.a * 0.62).toFixed(3)})`);
        reach.addColorStop(1, 'rgba(0, 0, 0, 0)');
        layer.fillStyle = reach;
        layer.fillRect(l.x - l.r, l.y - l.r, 2 * l.r, 2 * l.r);
      }
      // The lit faces over it, as strongly as it reaches them.
      layer.globalCompositeOperation = 'source-atop';
      layer.fillStyle = pat;
      layer.translate(roof.dx, roof.dy);
      for (const f of roof.faces) {
        pat.setTransform(f.m);
        layer.fill(f.path);
      }
      layer.restore();
      // And onto the night, once.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, dark * 0.55);
      ctx.drawImage(layer.canvas, lx, ly, lw, lh, lx / k, ly / k, lw / k, lh / k);
      ctx.restore();
    }
  }

  /** The layer a glass roof's glow is made on (`drawGlassGlow`): half the screen's size each way, kept. */
  private glowCtx(): CanvasRenderingContext2D {
    const el = this.r.canvas.el;
    const w = Math.max(1, Math.ceil(el.width / 2)), h = Math.max(1, Math.ceil(el.height / 2));
    if (!this.glowLayer || this.glowLayer.canvas.width !== w || this.glowLayer.canvas.height !== h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      this.glowLayer = c.getContext('2d') as CanvasRenderingContext2D;
    }
    const g = this.glowLayer;
    const m = this.r.canvas.ctx.getTransform();
    const k = w / el.width;
    g.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return g;
  }

  /**
   * A gable end under a roof of glass: glazed, the wall carried up in panes
   * between mullions a sixth of a tile apart with a transom across, pale where
   * the light takes it -- and seen through, so a far one shows past the near
   * side of the roof. The verge over it is the roof's.
   */
  private drawGlassGable(ctx: CanvasRenderingContext2D, gable: RoofGable, eave: number, pitch: number): void {
    const cam = this.r.camera;
    const zoom = cam.zoom;
    const [ox, oy] = FALLS[gable.out];
    const along = gable.out === 0 || gable.out === 2 ? 'y' : 'x';
    const at = (x: number, y: number, h: number): [number, number] => [
      cam.worldToScreenX(x + ox * WALL_THICK, y + oy * WALL_THICK),
      cam.worldToScreenY(x + ox * WALL_THICK, y + oy * WALL_THICK, eave + h),
    ];
    const line = gable.line;
    const first = line[0], last = line[line.length - 1];
    const outline = (): void => {
      ctx.beginPath();
      ctx.moveTo(...at(first[0], first[1], 0));
      for (const p of line) ctx.lineTo(...at(p[0], p[1], pitch * p[2]));
      ctx.lineTo(...at(last[0], last[1], 0));
      ctx.closePath();
    };
    const lit = this.r.faceLight(along === 'x' ? 1 : 0, along === 'y' ? 1 : 0);
    outline();
    ctx.fillStyle = `rgba(214, 238, 236, ${(glassReflects(lit) * 0.9).toFixed(3)})`;
    ctx.fill();
    ctx.save();
    outline();
    ctx.clip();
    /** The roof's height over the eaves at a place along the end, off its line. */
    const riseAt = (u: number): number => {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const ua = along === 'x' ? a[0] : a[1], ub = along === 'x' ? b[0] : b[1];
        if ((u - ua) * (u - ub) <= 0 && ua !== ub) return pitch * (a[2] + ((u - ua) / (ub - ua)) * (b[2] - a[2]));
      }
      return 0;
    };
    const u0 = along === 'x' ? Math.min(first[0], last[0]) : Math.min(first[1], last[1]);
    const u1 = along === 'x' ? Math.max(first[0], last[0]) : Math.max(first[1], last[1]);
    const fixed = along === 'x' ? first[1] : first[0];
    const pt = (u: number, h: number): [number, number] => (along === 'x' ? at(u, fixed, h) : at(fixed, u, h));
    const ink = rgb([112, 116, 112], lit);
    const body = rgb([239, 236, 227], lit);
    const bar = (a: [number, number], b: [number, number], w: number): void => {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = ink;
      ctx.lineWidth = w + Math.max(0.8, 0.9 * zoom);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      ctx.strokeStyle = body;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    };
    const top = Math.max(...line.map((p) => p[2])) * pitch;
    // A transom a third of the way up, then a mullion every sixth of a tile.
    bar(pt(u0 - 0.1, top / 3), pt(u1 + 0.1, top / 3), Math.max(1, 1.6 * zoom));
    for (let u = Math.ceil(u0 * 6) / 6; u <= u1 + 1e-9; u += 1 / 6) {
      const h = riseAt(u);
      if (h <= 0.5) continue;
      bar(pt(u, 0), pt(u, h + 1), Math.max(1, 1.8 * zoom));
    }
    ctx.restore();
    ctx.lineWidth = 1;
  }

  /**
   * A gable end: the wall carried up in a triangle under the roof's line, in
   * the wall's own picture -- the field of it, without the head of the storey
   * under it -- laid on over the top storey's a border at a time, and lit as
   * the wall is. Over a wall with no picture, in its colour.
   */
  private drawGable(ctx: CanvasRenderingContext2D, gable: RoofGable, level: number, eave: number, pitch: number, roofs: FloorTile[]): void {
    const cam = this.r.camera;
    const bld = this.r.game.buildings;
    const [ox, oy] = FALLS[gable.out];
    const dir: 'h' | 'v' = gable.out === 0 || gable.out === 2 ? 'v' : 'h';
    const dx = dir === 'h' ? 1 : 0, dy = dir === 'h' ? 0 : 1;
    /** A point on the outer face of the wall: a world point on its line, `h` height units over the eaves. */
    const at = (x: number, y: number, h: number): [number, number] => [
      cam.worldToScreenX(x + ox * WALL_THICK, y + oy * WALL_THICK),
      cam.worldToScreenY(x + ox * WALL_THICK, y + oy * WALL_THICK, eave + h),
    ];
    const first = gable.line[0], last = gable.line[gable.line.length - 1];
    const outline = (): void => {
      ctx.beginPath();
      ctx.moveTo(...at(first[0], first[1], 0));
      for (const p of gable.line) ctx.lineTo(...at(p[0], p[1], pitch * p[2]));
      ctx.lineTo(...at(last[0], last[1], 0));
      ctx.closePath();
    };
    const lit = this.r.faceLight(dx, dy);
    const top = Math.max(...gable.line.map((p) => p[2])) * pitch;
    ctx.save();
    outline();
    ctx.clip();
    let shaded: Masonry | undefined;
    for (const b of gable.borders) {
      const border: Border = { dir, x: b.x, y: b.y };
      const wall = bld.wallOnBorder(level - 1, border);
      // Over two columns and no wall, the gable is laid in the columns' stuff, on their beam (`framing.ts`).
      const face = wall && isDone(wall) ? wall : bld.carried(level - 1, border) ? bld.column(level - 1, border.x, border.y) : undefined;
      const cob = face ? this.r.masonryOf(face) : undefined;
      const [ax, ay] = borderPoints(border);
      const P = (t: number, h: number): [number, number] => at(ax + dx * t, ay + dy * t, h);
      if (!cob) {
        const mat = MATERIAL_BY_ID.get(face?.material ?? wall?.material ?? roofs[b.tile].material);
        ctx.beginPath();
        ctx.moveTo(...P(-0.01, -1)); ctx.lineTo(...P(1.01, -1)); ctx.lineTo(...P(1.01, top + 2)); ctx.lineTo(...P(-0.01, top + 2));
        ctx.closePath();
        ctx.fillStyle = rgb(mat ? this.r.painted(mat, face?.dye ?? wall?.dye).color : [180, 160, 140], lit);
        ctx.fill();
        continue;
      }
      shaded = shaded ?? cob;
      const n = cob.face.length;
      const v = cob.scatter ? scatterOf(border, level, n) : Math.abs(border.x * 31 + border.y * 17 + level * 7) % n;
      const img = cob.face[v];
      const head = cob.head, fh = img.height - head;
      const turned = !!cob.handed && P(1, 0)[0] < P(0, 0)[0];
      const [t0, t1] = turned ? [1.01, -0.01] : [-0.01, 1.01];
      // A storey's field at a time, from the head of the top storey up.
      const step = (WALL_HEIGHT * fh) / img.height;
      for (let h = 0; h < top; h += step) {
        const [tlx, tly] = P(t0, h + step), [trx, try_] = P(t1, h + step), [blx, bly] = P(t0, h);
        ctx.save();
        ctx.transform((trx - tlx) / img.width, (try_ - tly) / img.width, (blx - tlx) / fh, (bly - tly) / fh, tlx, tly);
        ctx.drawImage(img, 0, head, img.width, fh, 0, 0, img.width, fh);
        ctx.restore();
      }
    }
    if (shaded) {
      const [sr, sg, sb] = shaded.shade;
      outline();
      ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${shaded.shadow(lit).toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
  }
}
