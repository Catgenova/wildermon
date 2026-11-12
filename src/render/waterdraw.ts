import type { Camera } from '../engine/camera';
import type { FullscreenCanvas } from '../engine/canvas';
import { furnitureDef, furnitureCentre } from '../game/furniture';
import type { Game } from '../game/game';
import { KNOWN } from '../game/vision';
import type { PondWater, WaterField } from '../world/springs';
import type { TileType } from '../world/tiles';
import { FOG_COLOR } from './fog';
import { furnitureSpan } from './furniture';
import { HALF_W, HALF_H, UNITS_PER_TILE } from './iso';
import type { ColourPages } from './pages';
import { pondWaterOn, WATER_ON, type SpringWater } from './ponds';
import type { SeaReach } from './seareach';
import type { ShorePainter, ShoreField } from './shore';
import { type View, depthOf } from './view';
import { Wakes } from './wake';
import { SWELL_RATE, LONG_WAVE, CREST_ALPHA, SHORT_WAVE, TROUGH_ALPHA, swellShow, SWELL_SPEED, WAKE_ALPHA, SHORE_FAR, WAKE_ARM, WAKE_TRACK, FOAM } from './water';
import type { WaterTint } from './watertint';

/** A tile's corners in the world's order, north, east, south and west (`World.corners`), as steps from its own. */
const SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
/** The share of the screen's pixels the sea's colour and swell are worked out at, across and down (`drawSea`). */
const SWELL_RES = 0.5;
/** How far round the sea on the screen its picture is made, past the screen's edge too, in pixels, for the view to move into before it is made again (`drawSea`). */
const SEA_MARGIN = 96;
/** And remembered sea: a little more, being little else but its colour (`seaStill`). */
const MEMORY_SEA = 0.35;

/** Whether two sets of numbers hold the same ones, nothing counting as empty. */
function sameSet(a: ReadonlySet<number> | null, b: ReadonlySet<number> | null): boolean {
  if ((a?.size ?? 0) !== (b?.size ?? 0)) return false;
  for (const v of a ?? []) if (!b!.has(v)) return false;
  return true;
}

/** What WaterPainter needs of the renderer (`renderer.ts` builds it). */
export interface WaterHost {
  readonly bankColours: Map<number, { pages: ColourPages; level: number; h: number[]; gx: number; gy: number; colour: string }>;
  bankGx: number;
  bankGy: number;
  bankLevel: number;
  readonly camera: Camera;
  readonly canvas: FullscreenCanvas;
  readonly colors: ColourPages;
  computeColor(x: number, y: number, type: TileType, data: number, light: [number, number, number], lit?: boolean, own?: boolean, heights?: readonly number[]): string;
  readonly fast: boolean;
  readonly frameNo: number;
  readonly game: Game;
  readonly memColors: ColourPages;
  pondPath: Path2D | null;
  pondTop: number;
  seaPath: Path2D | null;
  readonly seaReach: SeaReach;
  readonly shore: ShorePainter;
  readonly shoreField: ShoreField;
  readonly springWater: SpringWater;
  readonly sunNow: [number, number, number];
  readonly surf: { dirX: number; dirY: number; force: number };
  readonly time: number;
  readonly tint: WaterTint;
  readonly wakes: Wakes;
  wetPierBuildings: Set<number> | null;
  wetPierLines: Set<number> | null;
}

/**
 * The sea (its still picture and its swell), the ponds and their banks, the shore's wet band and foam, the water
 * round piers, and the wakes, as the renderer lays them line by line (`WaterHost`).
 */
export class WaterPainter {
  private waterPoly = new Float64Array(16);
  /**
   * Those buildings as they were last worked out: again only when the tiles
   * on piers change (`Buildings.pierStamp`), or a second on for the water,
   * which can rise under a deck; and their lines again only for a new view.
   */
  private wetPierCache: { stamp: number; at: number; buildings: Set<number> | null; view: View | null; lines: Set<number> | null } | null = null;
  /** The ponds with water on the tile being drawn: the level each stands at, and which of the tile's corners it covers, one bit each. */
  private pondsHere: PondWater[] = [];
  private pondsHereLevel: number[] = [];
  private pondsHereMask: number[] = [];
  private pondsHereN = 0;

  /** The sea as last made (`drawSea`): its picture, the view it was made for, when, where the world's corner was on the screen, and the part of it made. */
  private seaPic: { cv: HTMLCanvasElement; half: HTMLCanvasElement; fit: string; at: number; frame: number; ax: number; ay: number; box: [number, number, number, number] } | null = null;
  /** A trail's sideways step and spread at each point, reused: across x, across y, half-width. */
  private wakeSide = new Float64Array(3 * 32);
  private readonly bankBuf = [0, 0, 0, 0];
  private readonly bankSlope = [0, 0, 0, 0];
  private readonly bankPts = new Float64Array(24);

  constructor(private readonly r: WaterHost) {}

  markWakes(): void {
    const w = this.r.game.world;
    const now = this.r.time;
    // Nobody on stepping stones is in the water, however deep it is round them.
    const afloat = (x: number, y: number): boolean => w.heightAt(x, y) < w.surfaceAt(Math.floor(x), Math.floor(y)) - 0.5 && !w.stonesAt(Math.floor(x), Math.floor(y))
      && !this.r.game.onPierDeck(Math.floor(x), Math.floor(y));
    const player = this.r.game.player;
    const boat = this.r.game.driving();
    const hull = boat && furnitureDef(boat.kind).boat ? boat : null;
    if (hull) {
      const [bx, by] = furnitureCentre(hull);
      const [sw, sd] = furnitureSpan(hull.kind);
      if (afloat(bx, by)) this.r.wakes.mark('hull', bx, by, now, Math.max(sw, sd) * 0.42);
    } else if (afloat(player.x, player.y)) {
      this.r.wakes.mark('player', player.x, player.y, now, 0.3);
    }
    if (this.r.game.creatures.list.size) {
      for (const cr of this.r.game.creatures.list.values()) {
        if (afloat(cr.x, cr.y)) this.r.wakes.mark('c' + cr.id, cr.x, cr.y, now, 0.26);
      }
    }
  }

  /**
   * The sea, laid first, under everything: its floor as much as the water
   * lets it show, the water's colour by its depth blended a corner at a time
   * (`watertint.ts`), the swell, and the water's side of the foam along its
   * shores (`ShorePainter.lace`). The ground is then drawn over it as ever,
   * except that a tile of sea draws nothing and a tile the shore crosses draws
   * only the part of it above the water (`seaLand`): the sea's surface is flat
   * at nought and lower than any land, so whatever is drawn over this is in
   * front of it, and what is left of it is the water seen.
   *
   * The picture is made `SWELL_RATE` times a second, as far round the screen
   * as the sea can be and a margin past that, and copied on, moved with the
   * view, in between: it is worked out at `SWELL_RES` of the pixels, having
   * no edge of its own to keep sharp. Says whether there was any sea to lay.
   */
  drawSea(ctx: CanvasRenderingContext2D, zoom: number): boolean {
    const cam = this.r.camera;
    const W = this.r.canvas.width, H = this.r.canvas.height;
    // Where on the screen the sea can be: round the blocks of the world under it with any sea.
    const reach = this.r.tint.seaWithin(cam, -SEA_MARGIN, -SEA_MARGIN, W + SEA_MARGIN, H + SEA_MARGIN);
    if (!reach) return false;
    const t = ctx.getTransform();
    const dev = t.a;
    const CW = ctx.canvas.width, CH = ctx.canvas.height;
    // The picture reaches this far past the screen on every side, for the view to move into.
    const M = Math.round(SEA_MARGIN * dev);
    const rx0 = Math.max(-M, Math.floor(t.a * reach[0] + t.e)), ry0 = Math.max(-M, Math.floor(t.d * reach[1] + t.f));
    const rx1 = Math.min(CW + M, Math.ceil(t.a * reach[2] + t.e)), ry1 = Math.min(CH + M, Math.ceil(t.d * reach[3] + t.f));
    // And the part of that on the screen.
    const vx0 = Math.max(0, rx0), vy0 = Math.max(0, ry0), vx1 = Math.min(CW, rx1), vy1 = Math.min(CH, ry1);
    if (vx1 <= vx0 || vy1 <= vy0) return false;
    const ax = cam.worldToScreenX(0, 0), ay = cam.worldToScreenY(0, 0, 0);
    // Remembered sea is drawn as it was, and changes as the sight does.
    const fog = this.r.game.settings.fog;
    const fit = `${zoom}|${cam.rotation}|${W}|${H}|${dev}|${t.e}|${t.f}|${this.r.fast}|${this.r.tint.stamp}|${this.r.seaReach.stamp}|${fog ? this.r.game.vision.revision : -1}|${this.r.game.buildings.pierStamp}`;
    let pic = this.seaPic;
    let mx = pic ? Math.round((ax - pic.ax) * dev) : 0, my = pic ? Math.round((ay - pic.ay) * dev) : 0;
    // The picture covers the sea where it is now, moved with the view since it was made.
    const covers = !!pic && vx0 - mx >= pic.box[0] && vy0 - my >= pic.box[1] && vx1 - mx <= pic.box[0] + pic.box[2] && vy1 - my <= pic.box[1] + pic.box[3];
    /*
     * The waves cross the screen a zoom's worth as fast as they would close
     * up, so the picture is made that much less often for the same step
     * between one and the next. Never two frames running, so a slow machine
     * is not painting it afresh every frame it draws; drawn fast, nothing in
     * it moves, and it is made again only when the view needs it.
     */
    const rate = SWELL_RATE * Math.min(1, Math.max(0.25, zoom));
    const due = !this.r.fast && (this.r.time - (pic?.at ?? 0) >= 1 / rate || this.r.time < (pic?.at ?? 0)) && this.r.frameNo - (pic?.frame ?? -2) > 1;
    if (!pic || pic.fit !== fit || !covers || due) {
      const full = pic?.cv ?? document.createElement('canvas');
      const half = pic?.half ?? document.createElement('canvas');
      if (full.width !== CW + 2 * M || full.height !== CH + 2 * M) {
        full.width = CW + 2 * M;
        full.height = CH + 2 * M;
      }
      const sw = Math.max(1, Math.ceil(full.width * SWELL_RES)), sh = Math.max(1, Math.ceil(full.height * SWELL_RES));
      if (half.width !== sw || half.height !== sh) {
        half.width = sw;
        half.height = sh;
      }
      // All the sea can reach, on the screen's pixels: the picture's are `M` on.
      const box: [number, number, number, number] = [rx0, ry0, rx1 - rx0, ry1 - ry0];
      const qx = Math.max(0, Math.floor((rx0 + M) * SWELL_RES) - 2), qy = Math.max(0, Math.floor((ry0 + M) * SWELL_RES) - 2);
      const qw = Math.min(sw, Math.ceil((rx1 + M) * SWELL_RES) + 2) - qx, qh = Math.min(sh, Math.ceil((ry1 + M) * SWELL_RES) + 2) - qy;
      const h = half.getContext('2d') as CanvasRenderingContext2D;
      h.save();
      h.setTransform(1, 0, 0, 1, 0, 0);
      h.beginPath();
      h.rect(qx, qy, qw, qh);
      h.clip();
      h.clearRect(qx, qy, qw, qh);
      h.setTransform(t.a * SWELL_RES, 0, 0, t.d * SWELL_RES, (t.e + M) * SWELL_RES, (t.f + M) * SWELL_RES);
      // The sea from above, from the world's corners under that part of the screen.
      const ix0 = (qx / SWELL_RES - M - t.e) / t.a, iy0 = (qy / SWELL_RES - M - t.f) / t.d;
      const ix1 = ix0 + qw / SWELL_RES / t.a, iy1 = iy0 + qh / SWELL_RES / t.d;
      this.r.tint.paint(h, cam, ix0, iy0, ix1, iy1);
      if (!this.r.fast) {
        // The swell over it, and the water's side of the foam.
        this.swellBand(h, zoom, 0, LONG_WAVE, CREST_ALPHA, 1, null);
        this.swellBand(h, zoom, 0.55, SHORT_WAVE, TROUGH_ALPHA * 0.7, 0.62, null);
        this.r.shore.lace(h, this.r.shoreField, this.r.game.world, ix0, iy0, ix1, iy1);
      }
      this.seaStill(h, cam, ix0, iy0, ix1, iy1);
      h.restore();
      const g = full.getContext('2d') as CanvasRenderingContext2D;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.beginPath();
      g.rect(rx0 + M, ry0 + M, rx1 - rx0, ry1 - ry0);
      g.clip();
      g.drawImage(half, 0, 0, sw / SWELL_RES, sh / SWELL_RES);
      g.restore();
      pic = this.seaPic = { cv: full, half, fit, at: this.r.time, frame: this.r.frameNo, ax, ay, box };
      mx = 0;
      my = 0;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pic.cv, vx0 - mx + M, vy0 - my + M, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.restore();
    return true;
  }

  /**
   * The parts of the sea's picture with no swell and no foam on them, its
   * colour laid back over them as it is with nothing moving: under a deck on
   * piers, which is in its shade; water below nought walled in from the sea
   * (`SeaReach`), which is still; and the sea only remembered rather than in
   * sight, which keeps as little of its colour as remembered ground does
   * (`MEMORY_SATURATION`) and nothing that moves on it.
   */
  private seaStill(h: CanvasRenderingContext2D, cam: Camera, sx0: number, sy0: number, sx1: number, sy1: number): void {
    const game = this.r.game;
    const world = game.world;
    const piers = game.buildings.pierTiles;
    const fog = game.settings.fog;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) {
      const p = cam.screenToWorld(sx, sy, 0);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(world.w - 1, Math.ceil(x1));
    y1 = Math.min(world.h - 1, Math.ceil(y1));
    const tile = (path: Path2D, x: number, y: number): void => {
      path.moveTo(cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, 0));
      path.lineTo(cam.worldToScreenX(x + 1, y), cam.worldToScreenY(x + 1, y, 0));
      path.lineTo(cam.worldToScreenX(x + 1, y + 1), cam.worldToScreenY(x + 1, y + 1, 0));
      path.lineTo(cam.worldToScreenX(x, y + 1), cam.worldToScreenY(x, y + 1, 0));
      path.closePath();
    };
    let calm: Path2D | null = null;
    for (const key of piers) {
      const [x, y] = key.split(',').map(Number);
      if (x < x0 || x > x1 || y < y0 || y > y1 || !world.hasSea(x, y)) continue;
      tile((calm ??= new Path2D()), x, y);
    }
    // Still water, a run of tiles along a row at a time.
    this.r.seaReach.stillIn(x0, y0, x1, y1, (y, xa, xb) => {
      const path = (calm ??= new Path2D());
      path.moveTo(cam.worldToScreenX(xa, y), cam.worldToScreenY(xa, y, 0));
      path.lineTo(cam.worldToScreenX(xb + 1, y), cam.worldToScreenY(xb + 1, y, 0));
      path.lineTo(cam.worldToScreenX(xb + 1, y + 1), cam.worldToScreenY(xb + 1, y + 1, 0));
      path.lineTo(cam.worldToScreenX(xa, y + 1), cam.worldToScreenY(xa, y + 1, 0));
      path.closePath();
    });
    let mem: Path2D | null = null;
    let memFog: Path2D | null = null;
    if (fog) {
      /*
       * The sea only remembered, a run of tiles along a row at a time: one
       * piece of the path for each run rather than one for each tile.
       * Reported: "frame rate in the ocean while sailing has plummeted ...
       * better on refresh, may have been a leak". It was the remembered sea:
       * every tile of it in the picture's reach was its own square in this
       * path, thousands of them once the sea round a long sail was all
       * remembered, and the picture clipped to all of them and painted again
       * each time it was made -- 3 ms grown to 30 on a sail of a minute. Runs
       * cut the path to a few dozen pieces.
       */
      const vision = game.vision;
      const run = (y: number, xa: number, xb: number, into: 'mem' | 'fog'): void => {
        const path = into === 'mem' ? (mem ??= new Path2D()) : (memFog ??= new Path2D());
        path.moveTo(cam.worldToScreenX(xa, y), cam.worldToScreenY(xa, y, 0));
        path.lineTo(cam.worldToScreenX(xb + 1, y), cam.worldToScreenY(xb + 1, y, 0));
        path.lineTo(cam.worldToScreenX(xb + 1, y + 1), cam.worldToScreenY(xb + 1, y + 1, 0));
        path.lineTo(cam.worldToScreenX(xa, y + 1), cam.worldToScreenY(xa, y + 1, 0));
        path.closePath();
      };
      /*
       * And the wash over the remembered sea where the tile is all under water,
       * laid here in the picture rather than gathered a tile at a time with
       * the ground (`drawWater`'s `fogInto`), which was the other half of that
       * cost. A tile the shore crosses keeps its own outline there, so the
       * wash meets the land's where the water does.
       */
      for (let y = y0; y <= y1; y++) {
        let from = -1, fogFrom = -1;
        for (let x = x0; x <= x1 + 1; x++) {
          const on = x <= x1 && vision.state(x, y) === KNOWN && world.hasSea(x, y);
          const under = on && world.getHeight(x, y) < 0 && world.getHeight(x + 1, y) < 0 && world.getHeight(x + 1, y + 1) < 0 && world.getHeight(x, y + 1) < 0;
          if (on && from < 0) from = x;
          else if (!on && from >= 0) {
            run(y, from, x - 1, 'mem');
            from = -1;
          }
          if (under && fogFrom < 0) fogFrom = x;
          else if (!under && fogFrom >= 0) {
            run(y, fogFrom, x - 1, 'fog');
            fogFrom = -1;
          }
        }
      }
    }
    for (const path of [calm, mem]) {
      if (!path) continue;
      h.save();
      h.clip(path);
      this.r.tint.paint(h, cam, sx0, sy0, sx1, sy1);
      if (path === mem) {
        h.globalCompositeOperation = 'saturation';
        h.fillStyle = `rgba(128,128,128,${(1 - MEMORY_SEA).toFixed(3)})`;
        h.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
      h.restore();
    }
    if (memFog) {
      h.save();
      h.fillStyle = FOG_COLOR;
      h.fill(memFog);
      h.restore();
    }
  }

  /**
   * Which lines of the ground this frame have a tile of a building standing
   * on piers in the water (`piers.ts`), and which buildings those are.
   */
  wetPiers(V: View): void {
    this.r.wetPierLines = null;
    this.r.wetPierBuildings = null;
    const bld = this.r.game.buildings;
    if (!bld.pierTiles.size) return;
    let c = this.wetPierCache;
    if (!c || c.stamp !== bld.pierStamp || this.r.time - c.at > 1 || this.r.time < c.at) {
      const world = this.r.game.world;
      let wet: Set<number> | null = null;
      for (const key of bld.pierTiles) {
        const [x, y] = key.split(',').map(Number);
        const b = bld.buildingAt(x, y);
        if (b && world.hasWater(x, y)) (wet ??= new Set()).add(b.id);
      }
      // The lines are kept while the buildings are the same, whatever the water does.
      const same = !!c && c.stamp === bld.pierStamp && sameSet(c.buildings, wet);
      c = this.wetPierCache = { stamp: bld.pierStamp, at: this.r.time, buildings: wet, view: same ? c!.view : null, lines: same ? c!.lines : null };
    }
    if (!c.buildings) return;
    if (c.view !== V || !c.lines) {
      c.lines = new Set();
      c.view = V;
      for (const id of c.buildings) {
        for (const key of bld.list.get(id)?.tiles ?? []) {
          const [x, y] = key.split(',').map(Number);
          c.lines.add(depthOf(V, x, y));
        }
      }
    }
    this.r.wetPierBuildings = c.buildings;
    this.r.wetPierLines = c.lines;
  }

  /**
   * The wakes laid over the water drawn so far, which is then done with:
   * before a building standing on piers in the water is drawn in front of it,
   * so none is laid over the building; the sea's colour and swell go under
   * it anyway (`drawSea`). The water under its
   * own decks is never in it (`drawWater`, `drawPonds`): that is in their
   * shade, and the piers stand in it.
   */
  layWater(ctx: CanvasRenderingContext2D, zoom: number): void {
    this.drawWakes(ctx, zoom);
    if (this.r.seaPath) this.r.seaPath = new Path2D();
    if (this.r.pondPath) this.r.pondPath = new Path2D();
  }

  /** One train of waves: a wavelength, a lean off the wind, and a speed. */
  /** One train of waves as a gradient, over `area` or over the whole screen. */
  private swellBand(ctx: CanvasRenderingContext2D, zoom: number, lean: number, waveTiles: number, amp: number, rate: number, area: Path2D | null): void {
    const cam = this.r.camera;
    const a = Math.atan2(this.r.surf.dirY, this.r.surf.dirX) + lean;
    const wdx = Math.cos(a);
    const wdy = Math.sin(a);
    // Where one tile lands on screen, along the wind and across it. The
    // projection squashes one axis and not the other, so the line a crest runs
    // along is not square to the direction it travels — the gradient has to be
    // laid out across the crests, not down the wind.
    const shift = (dx: number, dy: number): [number, number] => {
      const du = cam.rotateX(dx, dy);
      const dv = cam.rotateY(dx, dy);
      return [(du - dv) * HALF_W * zoom, (du + dv) * HALF_H * zoom];
    };
    const [pwx, pwy] = shift(wdx, wdy);
    const [pnx, pny] = shift(-wdy, wdx);
    const nlen = Math.hypot(pnx, pny);
    if (nlen < 0.001) return;
    let gx = pny / nlen;
    let gy = -pnx / nlen;
    let k = pwx * gx + pwy * gy;
    if (k < 0) {
      gx = -gx;
      gy = -gy;
      k = -k;
    }
    if (k < 2) return;
    const W = this.r.canvas.width;
    const H = this.r.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const q = ((i & 1 ? W : 0) - cx) * gx + ((i & 2 ? H : 0) - cy) * gy;
      if (q < lo) lo = q;
      if (q > hi) hi = q;
    }
    const lenPx = waveTiles * k;
    const show = swellShow(this.r.surf.force);
    // Which bit of sea is under the middle of the screen, so the swell stays
    // on the water as you walk along the beach rather than travelling with
    // the view. The gradient is in screen space; this is what pins it down.
    const mid = cam.screenToWorld(cx, cy, 0);
    const drift = (this.r.time * SWELL_SPEED * (0.3 + 0.7 * this.r.surf.force) * rate - (mid.x * wdx + mid.y * wdy)) * k;
    const g = ctx.createLinearGradient(cx + gx * lo, cy + gy * lo, cx + gx * hi, cy + gy * hi);
    const span = hi - lo;
    const steps = Math.max(8, Math.min(140, Math.ceil((span / lenPx) * 9)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w = Math.sin(((lo + t * span - drift) / lenPx) * Math.PI * 2);
      const alpha = amp * Math.abs(w) * show;
      g.addColorStop(t, w >= 0 ? `rgba(226,242,252,${alpha.toFixed(3)})` : `rgba(4,22,52,${alpha.toFixed(3)})`);
    }
    ctx.fillStyle = g;
    if (area) ctx.fill(area);
    else ctx.fillRect(0, 0, W, H);
  }

  /**
   * What crossed the water, clipped to the water so a wake never washes up
   * over a beach standing in front of it. Each trail is drawn as a ribbon
   * that widens and fades behind whatever left it: one quad per pair of
   * points, which is what gives the spread its taper without anything having
   * to work out the shape of a wake.
   */
  drawWakes(ctx: CanvasRenderingContext2D, zoom: number): void {
    const trails = this.r.wakes.live(this.r.time);
    if (!trails.length) return;
    const cam = this.r.camera;
    const w = this.r.game.world;
    ctx.save();
    // The sea and every pond: a swimmer in a pond leaves a wake on it too.
    const sea = this.r.seaPath ?? new Path2D();
    if (this.r.pondPath) {
      const both = new Path2D(sea);
      both.addPath(this.r.pondPath);
      ctx.clip(both);
    } else ctx.clip(sea);
    const strength = WAKE_ALPHA * (SHORE_FAR + (1 - SHORE_FAR) * Math.min(1, Math.max(0, zoom - 1)));
    for (const trail of trails) {
      /*
       * Foam like the shore's: the same flecks, laid in two arms spreading
       * out behind whatever left them, the outer edges of the water it has
       * pushed aside, and a narrower track of broken water down the middle.
       * Each step of the trail is its own piece, as strong as that bit of
       * water is fresh.
       */
      const head = trail[trail.length - 1];
      const level = w.surfaceAt(Math.floor(head.x), Math.floor(head.y));
      const sx = (x: number, y: number): number => cam.worldToScreenX(x, y);
      const sy = (x: number, y: number): number => cam.worldToScreenY(x, y, level);
      const side = this.wakeSide;
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const a = trail[Math.max(0, i - 1)];
        const b = trail[Math.min(trail.length - 1, i + 1)];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        side[i * 3] = -(b.y - a.y) / len;
        side[i * 3 + 1] = (b.x - a.x) / len;
        side[i * 3 + 2] = Wakes.spread(p, this.r.time).width;
      }
      ctx.fillStyle = this.r.shore.fleckFill(ctx, level);
      const piece = (i: number, from: number, to: number): void => {
        const p = trail[i], q = trail[i + 1];
        const pw = side[i * 3 + 2], qw = side[i * 3 + 5];
        ctx.beginPath();
        ctx.moveTo(sx(p.x + side[i * 3] * pw * from, p.y + side[i * 3 + 1] * pw * from), sy(p.x + side[i * 3] * pw * from, p.y + side[i * 3 + 1] * pw * from));
        ctx.lineTo(sx(q.x + side[i * 3 + 3] * qw * from, q.y + side[i * 3 + 4] * qw * from), sy(q.x + side[i * 3 + 3] * qw * from, q.y + side[i * 3 + 4] * qw * from));
        ctx.lineTo(sx(q.x + side[i * 3 + 3] * qw * to, q.y + side[i * 3 + 4] * qw * to), sy(q.x + side[i * 3 + 3] * qw * to, q.y + side[i * 3 + 4] * qw * to));
        ctx.lineTo(sx(p.x + side[i * 3] * pw * to, p.y + side[i * 3 + 1] * pw * to), sy(p.x + side[i * 3] * pw * to, p.y + side[i * 3 + 1] * pw * to));
        ctx.closePath();
        ctx.fill();
      };
      // Each band drawn twice, the second inside the first, so its edge is soft but still clean.
      const soft = (i: number, from: number, to: number, alpha: number): void => {
        for (let k = 0; k < 2; k++) {
          const f = k * 0.25 * (to - from);
          ctx.globalAlpha = alpha / 2;
          piece(i, from + f, to - f);
        }
      };
      for (let i = 0; i + 1 < trail.length; i++) {
        const fresh = Wakes.spread(trail[i + 1], this.r.time).alpha / 0.3;
        if (fresh <= 0.02) continue;
        // The two arms.
        soft(i, 1 - WAKE_ARM, 1, strength * fresh);
        soft(i, -1, -(1 - WAKE_ARM), strength * fresh);
        // The track down the middle, narrower than the hull and gone sooner.
        soft(i, -WAKE_TRACK, WAKE_TRACK, strength * 0.8 * fresh * fresh);
      }
      // And the arms' outer edges drawn whole, which is what makes them read as lines.
      ctx.fillStyle = `rgb(${FOAM.join(',')})`;
      for (let i = 0; i + 1 < trail.length; i++) {
        const fresh = Wakes.spread(trail[i + 1], this.r.time).alpha / 0.3;
        if (fresh <= 0.02) continue;
        ctx.globalAlpha = strength * 0.45 * fresh;
        piece(i, 1 - WAKE_ARM * 0.3, 1);
        piece(i, -1, -(1 - WAKE_ARM * 0.3));
      }
      // And broken water round where the thing is now, soft at its edge.
      const hx = sx(head.x, head.y), hy = sy(head.x, head.y);
      const rx = head.beam * 0.8 * HALF_W * zoom;
      ctx.globalAlpha = strength * 0.7;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(1, HALF_H / HALF_W);
      const curl = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      curl.addColorStop(0, `rgba(${FOAM.join(',')},0.8)`);
      curl.addColorStop(0.6, `rgba(${FOAM.join(',')},0.45)`);
      curl.addColorStop(1, `rgba(${FOAM.join(',')},0)`);
      ctx.fillStyle = curl;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Where the ground crosses zero on a tile, into `waterPoly`, walked round in the order its corners are drawn: its numbers' count, under six for none. */
  private waterOutline(V: View, x: number, y: number, c: readonly number[]): number {
    const poly = this.waterPoly;
    const cs = V.corners;
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      const ax = x + cs[i][0];
      const ay = y + cs[i][1];
      const ha = c[i];
      const hb = c[j];
      if (ha < 0) {
        poly[n++] = ax;
        poly[n++] = ay;
      }
      if (ha < 0 !== hb < 0) {
        const t = ha / (ha - hb);
        poly[n++] = ax + (x + cs[j][0] - ax) * t;
        poly[n++] = ay + (y + cs[j][1] - ay) * t;
      }
    }
    return n;
  }

  /**
   * A tile's sea, the shape the ground crossing zero cuts it to: laid already,
   * under everything (`drawSea`), so only gathered here -- into the outline a
   * wake is kept to, and remembered ground's wash.
   */
  drawWater(V: View, x: number, y: number, c: number[], fogInto?: Path2D): void {
    // The water under a deck on piers is in its shade, and no wake runs there (`layWater`).
    const sea = this.r.wetPierLines && this.r.game.buildings.onPiers(x, y) ? null : this.r.seaPath;
    if (!sea && !fogInto) return;
    const n = this.waterOutline(V, x, y, c);
    if (n < 6) return;
    const poly = this.waterPoly;
    const cam = this.r.camera;
    for (let k = 0; k < n; k += 2) {
      const sx = cam.worldToScreenX(poly[k], poly[k + 1]);
      const sy = cam.worldToScreenY(poly[k], poly[k + 1], 0);
      if (k === 0) {
        fogInto?.moveTo(sx, sy);
        sea?.moveTo(sx, sy);
      } else {
        fogInto?.lineTo(sx, sy);
        sea?.lineTo(sx, sy);
      }
    }
    fogInto?.closePath();
    sea?.closePath();
  }

  /**
   * The part of a tile the shore crosses that is above the sea, in its own
   * colour and edged in it, which is all of the tile drawn over the sea laid
   * under it (`drawSea`): the ground where it crosses nought, walked round the
   * other way from the water's. Whether there was any, its outline left as
   * the path for a path worn across it to be cut to.
   */
  seaLand(ctx: CanvasRenderingContext2D, V: View, x: number, y: number, c: readonly number[], color: string): boolean {
    if (c[0] < 0 && c[1] < 0 && c[2] < 0 && c[3] < 0) return false;
    const cs = V.corners;
    const cam = this.r.camera;
    let n = 0;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      const ax = x + cs[i][0], ay = y + cs[i][1];
      const ha = c[i], hb = c[j];
      if (ha >= 0) {
        const sx = cam.worldToScreenX(ax, ay), sy = cam.worldToScreenY(ax, ay, ha);
        if (n++ === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      if (ha < 0 !== hb < 0) {
        const tt = ha / (ha - hb);
        const px = ax + (x + cs[j][0] - ax) * tt, py = ay + (y + cs[j][1] - ay) * tt;
        const sx = cam.worldToScreenX(px, py), sy = cam.worldToScreenY(px, py, 0);
        if (n++ === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
    }
    if (n < 3) return false;
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
    return true;
  }


  /**
   * Which of the ponds on a tile have water on it this frame, into
   * `pondsHereLevel` and `pondsHereMask`: a pond still rising has not got to
   * every corner it will cover, and one only just dug has got to none. True
   * when any has.
   */
  pondsOn(water: WaterField, x: number, y: number, c: number[], co: View['corners']): boolean {
    const cw = this.r.game.world.w + 1;
    let n = 0;
    this.r.pondTop = -Infinity;
    for (const p of water.pondsAt(x, y)) {
      const level = this.r.springWater.levelOf(p);
      let mask = 0;
      for (let i = 0; i < 4; i++) {
        if (c[i] < level && p.wet.has((y + co[i][1]) * cw + x + co[i][0])) mask |= 1 << i;
      }
      if (!mask) continue;
      // Two springs filling the same pond are one pond's water: laid once, not once for each.
      let twice = false;
      for (let k = 0; k < n && !twice; k++) twice = this.pondsHereLevel[k] === level && this.pondsHereMask[k] === mask;
      if (twice) continue;
      this.pondsHere[n] = p;
      this.pondsHereLevel[n] = level;
      this.pondsHereMask[n] = mask;
      n++;
      if (level > this.r.pondTop) this.r.pondTop = level;
    }
    this.pondsHereN = n;
    return n > 0;
  }

  /**
   * The ground each pond's water on a tile leaves, laid before its water
   * (`pondBank`), so none of it is laid over another pond's water, and a path
   * on the tile goes down between the two (`drawTrail`).
   */
  pondBanks(V: View, x: number, y: number, c: number[], lit: boolean): void {
    this.r.bankLevel = -Infinity;
    for (let q = 0; q < this.pondsHereN; q++) this.pondBank(V, x, y, c, q, lit);
  }

  /**
   * A pond's water on a tile, the way the sea's is drawn but at the pond's own
   * surface, and only over the corners it covers: cut where the ground comes
   * up through the surface, which is its shore, and halfway along an edge that
   * runs from its water to a corner lower than the surface but not in the
   * pond, which is the far side of its lip. Coloured by depth off spring
   * water's own ramp, turquoise and not the sea's blue, and edged at the bank
   * with a thin line of darker teal rather than the sea's foam: nothing
   * breaks on a pond.
   */
  drawPonds(V: View, x: number, y: number, c: number[], lit: boolean, fogInto?: Path2D): void {
    const ctx = this.r.canvas.ctx;
    const cam = this.r.camera;
    const cs = V.corners;
    const poly = this.waterPoly;
    // The water under a deck on piers is in its shade, and no wake runs there (`layWater`).
    const wakes = this.r.pondPath && this.r.wetPierLines && this.r.game.buildings.onPiers(x, y) ? null : this.r.pondPath;
    const bare = this.shoreBare(x, y);
    for (let q = 0; q < this.pondsHereN; q++) {
      const level = this.pondsHereLevel[q];
      const n = pondWaterOn(x, y, c, this.pondsHereMask[q], level, cs, poly);
      if (n < 6) continue;
      // A corner lower than the surface but not in the pond is past its lip: no shore is drawn there.
      const lip = WATER_ON.lip;
      const mask = this.pondsHereMask[q];
      // Where its bank comes into the tile, the still water's edge (`shore.ts`).
      const banked = lit && !lip && !bare && !this.r.fast && mask !== 15;
      // Coloured a corner at a time by its depth under the pond's own surface (`watertint.ts`).
      ctx.fillStyle = this.r.tint.pond(ctx, this.pondsHere[q], level);
      ctx.beginPath();
      for (let k = 0; k < n; k += 2) {
        const sx = cam.worldToScreenX(poly[k], poly[k + 1]);
        const sy = cam.worldToScreenY(poly[k], poly[k + 1], level);
        if (k === 0) {
          ctx.moveTo(sx, sy);
          fogInto?.moveTo(sx, sy);
          wakes?.moveTo(sx, sy);
        } else {
          ctx.lineTo(sx, sy);
          fogInto?.lineTo(sx, sy);
          wakes?.lineTo(sx, sy);
        }
      }
      ctx.closePath();
      fogInto?.closePath();
      wakes?.closePath();
      ctx.fill();
      if (banked) this.r.shore.calm(ctx, x, y, cs, c, level);
      // The water drawn into a lip it goes over, on this tile's water and laid with it (`SpringWater.tongue`).
      if (this.r.springWater.tongued(x, y)) this.r.springWater.tongue(ctx, x, y, level, poly, n);
    }
  }

  /**
   * The ground of a tile a pond's edge crosses that its water leaves bare,
   * laid again in the colour of that ground (`bankColour`) rather than the
   * tile's: a tile with a corner at the bottom of a deep pond is shaded as a
   * cliff, bare rock, and the strip of it beside the water was a dark wedge
   * between the water and the land. The ground where the water is cut,
   * walked round the other way from the water's (`drawPonds`).
   */
  private pondBank(V: View, x: number, y: number, c: number[], q: number, lit: boolean): void {
    const level = this.pondsHereLevel[q];
    const mask = this.pondsHereMask[q];
    if (mask === 15) return;
    const ctx = this.r.canvas.ctx;
    const cam = this.r.camera;
    const cs = V.corners;
    ctx.beginPath();
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      const wa = (mask >> i) & 1;
      const ax = x + cs[i][0], ay = y + cs[i][1];
      if (!wa) {
        const sx = cam.worldToScreenX(ax, ay), sy = cam.worldToScreenY(ax, ay, c[i]);
        if (n++ === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      if (wa !== ((mask >> j) & 1)) {
        const t = (wa ? c[j] : c[i]) >= level ? (level - c[i]) / (c[j] - c[i]) : 0.5;
        const px = ax + (x + cs[j][0] - ax) * t, py = ay + (y + cs[j][1] - ay) * t;
        const sx = cam.worldToScreenX(px, py), sy = cam.worldToScreenY(px, py, level);
        if (n++ === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
    }
    ctx.closePath();
    const colour = this.bankColour(x, y, this.pondsHere[q], level, lit);
    ctx.fillStyle = colour;
    ctx.fill();
    // Edged a pixel out all round, over the half pixel the tile's own colour was laid out past its edge (`outsetTile`).
    const edge = ctx.lineWidth;
    ctx.lineWidth = 2;
    ctx.strokeStyle = colour;
    ctx.stroke();
    ctx.lineWidth = edge;
    if (level > this.r.bankLevel) this.r.bankLevel = level;
  }

  /**
   * The colour of a tile's ground beside a pond's water, shaded by the slope
   * that ground has: the mean of it over the part the water leaves (its
   * corners clear of the water and where the water is cut on its sides), not
   * the tile's from corner to corner. Kept with the slope, for its dressing
   * (`dressFace`), in `bankGx` and `bankGy`.
   */
  private bankColour(x: number, y: number, p: PondWater, level: number, lit: boolean): string {
    const w = this.r.game.world;
    const cw = w.w + 1;
    const h = w.corners(x, y, this.bankBuf);
    const pages = lit ? this.r.colors : this.r.memColors;
    const key = y * w.w + x;
    const had = this.r.bankColours.get(key);
    if (had && had.pages === pages && had.level === level && had.h[0] === h[0] && had.h[1] === h[1] && had.h[2] === h[2] && had.h[3] === h[3]) {
      this.r.bankGx = had.gx;
      this.r.bankGy = had.gy;
      return had.colour;
    }
    // Round the part the water leaves, in the tile's own square, by Green's theorem: its area, and its height's rise along x and along y.
    let area = 0, rx = 0, ry = 0;
    let n = 0;
    const pt = this.bankPts;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      const ui = SQUARE[i][0], vi = SQUARE[i][1];
      const wi = h[i] < level && p.wet.has((y + vi) * cw + x + ui);
      const wj = h[j] < level && p.wet.has((y + SQUARE[j][1]) * cw + x + SQUARE[j][0]);
      if (!wi) {
        pt[n++] = ui;
        pt[n++] = vi;
        pt[n++] = h[i];
      }
      if (wi !== wj) {
        const t = (wi ? h[j] : h[i]) >= level ? (level - h[i]) / (h[j] - h[i]) : 0.5;
        pt[n++] = ui + (SQUARE[j][0] - ui) * t;
        pt[n++] = vi + (SQUARE[j][1] - vi) * t;
        pt[n++] = level;
      }
    }
    for (let a = 0; a < n; a += 3) {
      const b = (a + 3) % n;
      const z = (pt[a + 2] + pt[b + 2]) / 2;
      area += pt[a] * pt[b + 1] - pt[b] * pt[a + 1];
      rx += z * (pt[b + 1] - pt[a + 1]);
      ry -= z * (pt[b] - pt[a]);
    }
    area /= 2;
    // A sliver with no width to speak of is as steep as its tile.
    const gu = Math.abs(area) > 1e-3 ? rx / area : (h[1] + h[2] - h[0] - h[3]) / 2;
    const gv = Math.abs(area) > 1e-3 ? ry / area : (h[2] + h[3] - h[0] - h[1]) / 2;
    // Four corners with that slope, for the shading (`computeColor`).
    const m = level - (gu + gv) / 2;
    const slope = this.bankSlope;
    slope[0] = m;
    slope[1] = m + gu;
    slope[2] = m + gu + gv;
    slope[3] = m + gv;
    const colour = this.r.computeColor(x, y, w.viewTile(x, y, lit), w.viewData(x, y, lit), this.r.sunNow, lit, false, slope);
    this.r.bankGx = gu / UNITS_PER_TILE;
    this.r.bankGy = gv / UNITS_PER_TILE;
    if (this.r.bankColours.size > 16384) this.r.bankColours.clear();
    this.r.bankColours.set(key, { pages, level, h: [h[0], h[1], h[2], h[3]], gx: this.r.bankGx, gy: this.r.bankGy, colour });
    return colour;
  }


  /** Whether a tile is kept clear of the shore's wet band and foam: a slab poured over it, or a deck on piers. */
  shoreBare(x: number, y: number): boolean {
    return (this.r.game.foundations.size > 0 && this.r.game.foundationAt(x, y) !== undefined)
      || (this.r.game.buildings.pierTiles.size > 0 && this.r.game.buildings.onPiers(x, y));
  }

  /**
   * The sea's shore on a tile, if any of it is there: its wet band (not where
   * its block's picture has it), and the land's side of its foam where it is in
   * sight, gathered for its line (`ShorePainter.flush`). Water below nought
   * walled in from the sea has neither: only still water's edge, in sight.
   */
  seaShore(V: View, x: number, y: number, c: number[], wet: boolean, foam: boolean): void {
    if ((!wet && !foam) || this.shoreBare(x, y)) return;
    if (this.r.shoreField.on(x, y) && this.r.shore.load(this.r.game.world, this.r.shoreField, x, y, V.corners, c, 0)) {
      if (wet) this.r.shore.wetLand(this.r.canvas.ctx);
      if (foam) this.r.shore.foamLand(this.r.canvas.ctx);
    }
    if (foam && this.stillShore(V, x, y, c)) this.r.shore.calm(this.r.canvas.ctx, x, y, V.corners, c, 0);
  }

  /** Whether a tile is on the edge of water below nought walled in from the sea (`SeaReach`). */
  private stillShore(V: View, x: number, y: number, c: number[]): boolean {
    if (!(c[0] < 0 || c[1] < 0 || c[2] < 0 || c[3] < 0) || (c[0] < 0 && c[1] < 0 && c[2] < 0 && c[3] < 0)) return false;
    for (let i = 0; i < 4; i++) if (c[i] < 0 && this.r.seaReach.inland(x + V.corners[i][0], y + V.corners[i][1])) return true;
    return false;
  }
}
