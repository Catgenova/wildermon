import type { Camera } from '../engine/camera';
import type { FullscreenCanvas } from '../engine/canvas';
import { type Side, type StairHand, type FloorTile, WALL_HEIGHT, isSpiral, isDone, MATERIAL_BY_ID, type Border, floorKind, WALL_THICK, FLOOR_DEEP, borderOf, CELLAR_DEPTH, type MaterialDef } from '../game/building';
import { jettyBase } from '../game/frame';
import type { Game } from '../game/game';
import { spiralTurn, spiralSpot, SPIRAL_TREADS, spiralRise } from '../game/spiral';
import { hash2 } from '../world/noise';
import { PLAN_COLOR, FLIGHT_STEPS, rgb, type Entity } from './drawshared';
import { UNITS_PER_TILE, HEIGHT_SCALE } from './iso';
import type { Masonry } from './masonry';
import { type SpiralFrame, type SpiralFlight, spiralShade, spiralPieces, spiralOutline, spiralKey, drawSpiralWhole } from './spiralkit';
import type { Sprite } from './sprites';
import { stairStyle, LADDER } from './stairing';
import { depthOf } from './view';

/** How much of a spiral staircase still planned is drawn: the kit's ghost of it. */
const PLANNED_SPIRAL = 0.5;

/** What StairPainter needs of the renderer (`renderer.ts` builds it). */
export interface StairHost {
  readonly camera: Camera;
  readonly canvas: FullscreenCanvas;
  readonly cut: Set<number>;
  faceLight(ux: number, uy: number): number;
  readonly game: Game;
  masonryOf(wall: { material: string; dye?: string }): Masonry | undefined;
  painted(mat: MaterialDef, dye: string | undefined): MaterialDef;
  seeThroughCtx(box?: [number, number, number, number]): CanvasRenderingContext2D;
  take(kind: Entity['kind'], x: number, y: number, sx: number, sy: number, spr: Sprite | null): Entity;
}

/**
 * Staircases (wide and single), spiral staircases and ladders as the renderer lays them in the lines of the
 * ground: their flights, rails and treads, cut round whoever stands on them (`StairHost`).
 */
export class StairPainter {
  constructor(private readonly r: StairHost) {}

  /** Where a flight's foot and its head are, in the world: the middle of the tile's edge it is climbed from, and of the far one. */
  static wayEnds(x: number, y: number, facing: Side, ladder: boolean): [[number, number], [number, number]] {
    const s0 = ladder ? 0.4 : 0, s1 = ladder ? 0.985 : 1;
    return [StairPainter.stairPoint(x, y, facing, 0.5, s0), StairPainter.stairPoint(x, y, facing, 0.5, s1)];
  }

  /**
   * The stretch across its tile a flight takes, in `stairPoint`'s coordinate
   * across: the whole of it for the wide one, and for a single one the half
   * on the hand it names as you climb -- which end of the run across that is
   * turns with the side it is climbed from.
   */
  static stairSpan(facing: Side, hand?: StairHand): [number, number] {
    if (!hand) return [0, 1];
    const [ox, oy] = StairPainter.stairPoint(0, 0, facing, 0, 0);
    const [ux, uy] = StairPainter.stairPoint(0, 0, facing, 0, 1);
    const [cx, cy] = StairPainter.stairPoint(0, 0, facing, 1, 0);
    // Your left as you climb, with y running south: the climb turned a quarter.
    const highIsLeft = (cx - ox) * (uy - oy) - (cy - oy) * (ux - ox) > 0;
    return (hand === 'l') === highIsLeft ? [0.5, 1] : [0, 0.5];
  }

  /** World point on a tile from a coordinate across (t) and away from the climbing side (s). */
  private static stairPoint(x: number, y: number, facing: Side, t: number, s: number): [number, number] {
    switch (facing) {
      case 'n':
        return [x + t, y + s];
      case 's':
        return [x + t, y + 1 - s];
      case 'w':
        return [x + s, y + t];
      default:
        return [x + 1 - s, y + t];
    }
  }

  /** The camera as a spiral staircase's pieces are laid out by (`spiralkit.ts`). */
  private spiralFrame(): SpiralFrame {
    const cam = this.r.camera;
    return { rotation: cam.rotation, sx: (wx, wy) => cam.worldToScreenX(wx, wy), sy: (wx, wy, h) => cam.worldToScreenY(wx, wy, h) };
  }

  /** A spiral staircase on a tile as it is drawn: its foot a storey under its floor slot over `base`, and the spirals over and under it on the tile. */
  private spiralFlight(floor: FloorTile, x: number, y: number, base: number, headOnly = false): SpiralFlight {
    const bld = this.r.game.buildings;
    return {
      material: floor.material, dye: floor.dye, x, y, level: floor.level, foot: base + (floor.level - 1) * WALL_HEIGHT,
      stack: { below: isSpiral(bld.floor(floor.level - 1, x, y)), above: isSpiral(bld.floor(floor.level + 1, x, y)) },
      turn: this.spiralTurnAt(x, y, floor.building), headOnly,
    };
  }

  /** How a spiral staircase on a tile is turned (`spiralTurn`): out past a footprint, its head toward the building's tile beside it. */
  private spiralTurnAt(x: number, y: number, building: number): number {
    const bld = this.r.game.buildings;
    if (bld.tileIndex.has(`${x},${y}`)) return 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as Array<[number, number]>) {
      if (bld.tileIndex.get(`${x + dx},${y + dy}`) === building) return spiralTurn([dx, dy]);
    }
    return 0;
  }

  /**
   * A spiral staircase taken into its line in pieces, each sorted among
   * whatever stands there by its own key (`spiralPieces`), so a body climbing
   * the far side of the turn is behind the near side's treads and rail. One
   * still planned is its ghost, ringed round its head as a plan is.
   */
  takeSpiral(floor: FloorTile, x: number, y: number, base: number, alpha: number, headOnly: boolean): void {
    const fl = this.spiralFlight(floor, x, y, base, headOnly);
    const done = isDone(floor);
    // At the foot of a stack, its shade on the floor, under its pieces.
    if (!fl.stack.below && !headOnly && done) {
      const ctx = this.r.canvas.ctx;
      ctx.save();
      ctx.globalAlpha *= alpha;
      spiralShade(ctx, fl, this.spiralFrame(), this.r.camera.zoom);
      ctx.restore();
    }
    for (const p of spiralPieces(fl, this.spiralFrame(), base)) {
      const e = this.r.take('spiral', x, y, p.sx, p.sy, null);
      e.sp = p;
      e.key = p.key;
      e.spAlpha = done ? alpha : alpha * PLANNED_SPIRAL;
    }
    if (!done) this.spiralPlanRing(this.r.canvas.ctx, fl);
  }

  /** The dashed ring round a planned spiral staircase's head, as a planned flight's head is marked out. */
  private spiralPlanRing(ctx: CanvasRenderingContext2D, fl: SpiralFlight): void {
    const ring = spiralOutline(fl, this.spiralFrame());
    ctx.save();
    ctx.beginPath();
    ring.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.strokeStyle = PLAN_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Where a body on a spiral staircase's tile is drawn, storeys `v` up (its
   * eased storey, so a climb goes round with it): on the tread under it,
   * round the post, as far up the storey as it has climbed (`spiralSpot`,
   * `spiralRise`), coming onto that spot from where it stepped onto the tile;
   * and what it sorts by among the stair's pieces (`spiralKey`): after the
   * tread it stands on, before the ones over its head. Null off one.
   */
  spiralBody(px: number, py: number, v: number): { x: number; y: number; h: number; key: number; turn: number; t: number } | null {
    const bld = this.r.game.buildings;
    if (!bld.list.size || v < 0) return null;
    const tx = Math.floor(px), ty = Math.floor(py);
    const lo = Math.floor(v + 1e-6), frac = v - lo;
    let flight: number, t: number;
    if (frac > 1e-3) {
      if (!isSpiral(bld.floor(lo + 1, tx, ty))) return null;
      flight = lo + 1;
      t = frac;
    } else if (isSpiral(bld.floor(lo + 1, tx, ty))) {
      flight = lo + 1;
      t = 0;
    } else if (lo > 0 && isSpiral(bld.floor(lo, tx, ty))) {
      flight = lo;
      t = 1;
    } else return null;
    const building = bld.buildingAt(tx, ty);
    const jetty = building ? undefined : bld.jettyAt(tx, ty);
    const base = building?.deck ?? (jetty ? jettyBase(this.r.game, jetty, tx, ty) : null) ?? this.r.game.world.getHeight(tx, ty);
    const cx = tx + 0.5, cy = ty + 0.5;
    const turn = this.spiralTurnAt(tx, ty, bld.floor(flight, tx, ty)?.building ?? -1);
    // On the tread under it, and sorted by that tread's middle: the one the climb has reached.
    const [sx, sy] = spiralSpot(t, turn);
    const tread = Math.max(-1, Math.min(SPIRAL_TREADS - 1, Math.floor(t * SPIRAL_TREADS - 0.5)));
    const [kx, ky] = spiralSpot((tread + 1) / SPIRAL_TREADS, turn);
    // Onto its spot from the edge of the tile it stepped on across.
    const w = 1 - Math.min(1, Math.hypot(px - cx, py - cy) / 0.5);
    const x = px + (cx + sx - px) * w, y = py + (cy + sy - py) * w;
    const h = base + (flight - 1 + spiralRise(t)) * WALL_HEIGHT;
    const on = t <= 0 ? flight - 1 : flight;
    const key = spiralKey(this.spiralFrame(), px + (cx + kx - px) * w, py + (cy + ky - py) * w, base, on + 0.5);
    return { x, y, h, key, turn, t };
  }

  /**
   * A flight of stairs up from the storey below to this one: see
   * `stairing.ts` for what each material builds one as.
   *
   * It was six quads in two flat colours with nothing at either side, so a
   * flight seen from the side was a stack of boards floating in the room.
   * Each step is a riser and a tread now, the tread standing a nosing proud
   * of the riser; the flight has sides -- the wall it is built of cut to the
   * steps, or its strings -- and a side open to the room is railed. It
   * stands clear of a wall it runs up beside, against the wall's face, not
   * in it.
   */
  drawStairs(floor: FloorTile, x: number, y: number, base: number, alpha: number, part: 'whole' | 'over' = 'whole',
    into?: CanvasRenderingContext2D): void {
    const main = into ?? this.r.canvas.ctx;
    // A spiral one all at once, where nobody stands among its pieces: a ghost, a way down to a cellar (`spiralkit.ts`).
    if (isSpiral(floor)) {
      main.save();
      main.globalAlpha *= isDone(floor) ? alpha : alpha * PLANNED_SPIRAL;
      drawSpiralWhole(main, this.spiralFlight(floor, x, y, base), this.spiralFrame(), this.r.camera.zoom);
      main.restore();
      if (!isDone(floor)) this.spiralPlanRing(main, this.spiralFlight(floor, x, y, base));
      return;
    }
    const cam = this.r.camera;
    const bld = this.r.game.buildings;
    const bare = MATERIAL_BY_ID.get(floor.material);
    if (!bare) return;
    const facing = floor.facing ?? 's';
    const h0 = base + (floor.level - 1) * WALL_HEIGHT;
    const h1 = base + floor.level * WALL_HEIGHT;
    const N = FLIGHT_STEPS;
    const rise = (h1 - h0) / N;
    const done = isDone(floor);
    const zoom = cam.zoom;
    const st = stairStyle(floor.material);
    /*
     * A painted flight is its paint all over, as a painted wall is -- each
     * part of it a step lighter or darker in the paint as it was in the
     * wood, so a tread still reads against its riser.
     */
    const paint = floor.dye ? this.r.painted(bare, floor.dye).color : null;
    const lum = (c: readonly [number, number, number]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const C = (c: readonly [number, number, number], k: number, a = 1): string => {
      if (!paint) return rgb(c, k, a);
      const f = Math.max(0.6, Math.min(1.3, lum(c) / Math.max(1, lum(st.riser))));
      return rgb(paint, k * f, a);
    };
    const lw = (k: number): number => Math.max(0.8, k * zoom);
    const W = (t: number, s: number): [number, number] => StairPainter.stairPoint(x, y, facing, t, s);
    const P = (t: number, s: number, h: number): [number, number] => {
      const [wx, wy] = W(t, s);
      return [cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, h)];
    };
    /*
     * Seen through -- in a room of its own under the storey you are standing
     * on -- it is laid whole on a layer and put over the room once, over the
     * box it stands in, rails and all.
     */
    let box: [number, number, number, number] | null = null;
    if (alpha < 1 && !into) {
      const dpr = this.r.canvas.dpr;
      const xs: number[] = [], ys: number[] = [];
      for (const t of [-0.2, 1.2]) for (const u of [-0.2, 1.2]) for (const h of [h0, h1 + 20]) {
        const [qx, qy] = P(t, u, h);
        xs.push(qx);
        ys.push(qy);
      }
      const bx = Math.max(0, Math.floor(Math.min(...xs) * dpr)), by = Math.max(0, Math.floor(Math.min(...ys) * dpr));
      box = [bx, by, Math.ceil(Math.max(...xs) * dpr) - bx + 1, Math.ceil(Math.max(...ys) * dpr) - by + 1];
    }
    const ctx = box ? this.r.seeThroughCtx(box) : main;
    const poly = (pts: Array<[number, number]>): void => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    };
    const line = (a: [number, number], b: [number, number], ink: string, width: number): void => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    };
    // Up the flight and across it, in the world.
    const [ox, oy] = W(0, 0);
    const ux = W(0, 1)[0] - ox, uy = W(0, 1)[1] - oy;
    const cx = W(1, 0)[0] - ox, cy = W(1, 0)[1] - oy;
    // Lit as a wall is: a tread looks at the sky, a riser and the flight's end as a wall across it, its side as a wall along it.
    const treadLit = 1.12, riserLit = this.r.faceLight(cx, cy), sideLit = this.r.faceLight(ux, uy);
    const risersShow = cam.nearSide(-ux, -uy) > 0;
    const near: 0 | 1 = cam.nearSide(cx, cy) > 0 ? 1 : 0;
    /*
     * The stretch of the tile it takes across: all of it, or for a single
     * staircase the half it runs up, its other side open on the stairwell
     * beside it in the middle of the tile, where no wall and no flight is.
     */
    const span = StairPainter.stairSpan(facing, floor.hand);
    const atEdge = (t: 0 | 1): boolean => span[t] === t;
    /** The border a side of the flight runs along. */
    const sideBorder = (t: 0 | 1): Border => {
      const [a, b] = [W(t, 0), W(t, 1)];
      return Math.abs(a[0] - b[0]) < 1e-9 ? { dir: 'v', x: a[0], y: Math.min(a[1], b[1]) } : { dir: 'h', x: Math.min(a[0], b[0]), y: a[1] };
    };
    const walled = (t: 0 | 1): boolean => {
      if (!atEdge(t)) return false;
      const w = bld.wallOnBorder(floor.level - 1, sideBorder(t));
      return !!w && isDone(w);
    };
    /** Whether a flight beside it on side `t` goes up the same way and runs up against it, making one wider flight with it. */
    const joined = (t: 0 | 1): boolean => {
      if (!atEdge(t)) return false;
      const [nx, ny] = t ? [cx, cy] : [-cx, -cy];
      const f = bld.floor(floor.level, x + Math.round(nx), y + Math.round(ny));
      if (!f || floorKind(f) !== 'stairs' || (f.facing ?? 's') !== facing) return false;
      const theirs = StairPainter.stairSpan(facing, f.hand);
      return t ? theirs[0] === 0 : theirs[1] === 1;
    };
    /** Whether a side stands open to the room: no wall along it, and no flight beside it. */
    const open = (t: 0 | 1): boolean => !walled(t) && !joined(t);
    // Against a wall, the flight stops at the wall's face.
    const tLo = walled(0) ? WALL_THICK : span[0], tHi = walled(1) ? 1 - WALL_THICK : span[1];
    const tNear = near ? tHi : tLo, tFar = near ? tLo : tHi;
    const NOSE = st.proud ? 0.03 : 0, NOSE_H = st.proud ? 1.3 : 0;
    const hTop = (i: number): number => h0 + (i + 1) * rise;
    /** The top edge of a closed string at `s` up the flight: a hand over the nosings, level with the landing at its head. */
    const closedTop = (s: number): number => Math.min(h0 + rise + (h1 - h0) * s + 2, h1 + 2);
    /** The steps' outline up the side at `t`, from the foot of the first riser to the back of the top tread. */
    const profile = (t: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [P(t, 0, h0)];
      for (let i = 0; i < N; i++) {
        out.push(P(t, i / N, hTop(i)));
        out.push(P(t, (i + 1) / N, hTop(i)));
      }
      return out;
    };
    /**
     * A masonry's own wall picture laid up a vertical face of the flight: the
     * face from `a` to `b` along the ground, the field of a storey of it from
     * the floor to the landing -- without the band at the head of the storey,
     * which cut to the steps was a scrap of cornice under the top one -- cut
     * to whatever path is set as the clip, and lit as a face that way is.
     * False where the flight's material has no picture.
     */
    const cob = this.r.masonryOf(floor);
    const pictured = (a: [number, number], b: [number, number], lit: number): boolean => {
      if (!cob || st.build !== 'solid') return false;
      const img = cob.face[Math.abs(x * 31 + y * 17 + floor.level * 7) % cob.face.length];
      const S = (w: [number, number], k: number): [number, number] => [cam.worldToScreenX(w[0], w[1]), cam.worldToScreenY(w[0], w[1], h0 + WALL_HEIGHT * k)];
      const turned = !!cob.handed && S(b, 0)[0] < S(a, 0)[0];
      const [pa, pb] = turned ? [b, a] : [a, b];
      const [tlx, tly] = S(pa, 1), [trx, try_] = S(pb, 1), [blx, bly] = S(pa, 0);
      const fh = img.height - cob.head;
      ctx.save();
      ctx.clip();
      ctx.save();
      ctx.transform((trx - tlx) / img.width, (try_ - tly) / img.width, (blx - tlx) / fh, (bly - tly) / fh, tlx, tly);
      ctx.drawImage(img, 0, cob.head, img.width, fh, 0, 0, img.width, fh);
      ctx.restore();
      const [sr, sg, sb] = cob.shade;
      ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${cob.shadow(lit).toFixed(3)})`;
      ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
      ctx.restore();
      return true;
    };
    /** A face of the flight along one side, cut to the steps -- or, on adobe, carried up as a parapet over them. */
    const side = (t: number, parapet: boolean): void => {
      const pts = profile(t);
      if (parapet) {
        pts.splice(1, pts.length - 1, P(t, 0, h0 + rise + 8), P(t, 0.93, h1 + 8), P(t, 1, h1 + 8));
      }
      pts.push(P(t, 1, h0));
      poly(pts);
      if (!pictured(W(t, 0), W(t, 1), sideLit)) {
        ctx.fillStyle = C(st.string, sideLit);
        ctx.fill();
      }
      poly(pts);
      ctx.strokeStyle = C(st.line, sideLit, 0.55);
      ctx.lineWidth = lw(1);
      ctx.stroke();
      if (parapet) line(P(t, 0, h0 + rise + 8), P(t, 0.93, h1 + 8), C(st.barHi, 1.08), lw(2));
    };
    /** A timber string up the side at `t`: cut to the steps, or closed over them. */
    const string = (t: number): void => {
      const D = 4;
      const bottom = (s: number): number => Math.max(h0, h0 + (h1 - h0) * s - D);
      const pts: Array<[number, number]> = [];
      if (st.build === 'closed') {
        pts.push(P(t, 0, h0), P(t, 0, closedTop(0)));
        const knee = 1 - 1 / N;
        pts.push(P(t, knee, closedTop(knee)), P(t, 1, closedTop(1)));
      } else {
        pts.push(...profile(t));
      }
      pts.push(P(t, 1, bottom(1)), P(t, D / (h1 - h0), h0));
      poly(pts);
      ctx.fillStyle = C(st.string, sideLit);
      ctx.fill();
      ctx.strokeStyle = C(st.line, sideLit, 0.7);
      ctx.lineWidth = lw(1);
      ctx.stroke();
      if (st.build === 'closed') line(P(t, 0, closedTop(0)), P(t, 1, closedTop(1)), C(st.stringHi, 1.05), lw(1.4));
    };
    /** A log laid up the side at `t` for the split logs to rest on. */
    const stringer = (t: number): void => {
      const a = P(t, 0.02, h0 + 1.5), b = P(t, 1, h1 - 2.5), w = Math.max(3, 8 * zoom);
      ctx.lineCap = 'round';
      line(a, b, C(st.line, 1), w + lw(1.6));
      line(a, b, C(st.string, sideLit), w);
      line([a[0], a[1] - w * 0.25], [b[0], b[1] - w * 0.25], C(st.stringHi, 1.05), Math.max(1, w * 0.3));
      ctx.lineCap = 'butt';
    };
    /** The rail along an open side at `t`, as its material rails one. */
    const rail = (t: number): void => {
      const R = st.rail === 'stone' ? 9 : 10;
      const s0 = 0.06, s1 = 0.95, b0 = h0 + rise, b1 = h1;
      const at = (s: number): number => b0 + R + ((b1 - b0) * (s - s0)) / (s1 - s0);
      const ink = (c: readonly [number, number, number], k = 1, a = 1): string => (st.rail === 'iron' ? rgb(c, k, a) : C(c, k, a));
      const postW = st.rail === 'stone' ? 4.2 : st.rail === 'pole' ? 3.6 : st.rail === 'wood' ? 3 : 1.8;
      const barW = st.rail === 'stone' ? 3.2 : st.rail === 'pole' ? 3 : st.rail === 'wood' ? 2.4 : 1.8;
      const balW = st.rail === 'stone' ? 2.6 : st.rail === 'wood' ? 1.3 : 1;
      if (st.rail !== 'pole') {
        // The balusters: one to a step, two on carpentry and stone.
        const per = st.rail === 'wood' || st.rail === 'stone' ? 2 : 1;
        for (let i = 0; i < N; i++) {
          for (let k = 0; k < per; k++) {
            const s = (i + (k + 0.5) / per) / N;
            if (s < s0 + 0.03 || s > s1 - 0.03) continue;
            const foot = st.build === 'closed' ? closedTop(s) : hTop(i);
            line(P(t, s, foot), P(t, s, at(s)), ink(st.bar, 0.95), lw(balW));
            if (st.rail === 'stone') line(P(t, s, hTop(i) + R * 0.45), P(t, s, hTop(i) + R * 0.62), ink(st.barHi, 1), lw(balW + 1.4));
          }
        }
      }
      // The newels at its foot and head, and the rail between them.
      for (const [s, b] of [[s0, b0], [s1, b1]] as Array<[number, number]>) {
        line(P(t, s, b), P(t, s, b + R + 2), ink(st.line, 1), lw(postW + 1.2));
        line(P(t, s, b), P(t, s, b + R + 2), ink(st.post, 1.05), lw(postW));
        if (st.rail === 'gilt' || st.rail === 'wood') {
          const [fx, fy] = P(t, s, b + R + 3.4);
          ctx.beginPath();
          ctx.arc(fx, fy, lw(postW * 0.62), 0, Math.PI * 2);
          ctx.fillStyle = ink(st.barHi, 1.05);
          ctx.fill();
          ctx.strokeStyle = ink(st.line, 1, 0.8);
          ctx.lineWidth = lw(0.8);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'round';
      line(P(t, s0, at(s0)), P(t, s1, at(s1)), ink(st.line, 1), lw(barW + 1.2));
      line(P(t, s0, at(s0)), P(t, s1, at(s1)), ink(st.bar, 1.05), lw(barW));
      line(P(t, s0, at(s0) + barW * 0.2), P(t, s1, at(s1) + barW * 0.2), ink(st.barHi, 1.1), lw(Math.max(0.8, barW * 0.35)));
      ctx.lineCap = 'butt';
    };
    /** One step: its riser where the camera sees it, and its tread. */
    const step = (i: number): void => {
      const sF = i / N, sB = (i + 1) / N, hb = h0 + i * rise, ht = hTop(i);
      const salt = x * 131 + y * 71 + floor.level * 13 + i * 7;
      if (st.build === 'log') {
        // A split log across the flight, its flat face up and its round under it.
        const sm = (sF + sB) / 2, r = rise * 0.55;
        poly([P(tLo, sF + 0.01, ht), P(tHi, sF + 0.01, ht), P(tHi, sB - 0.01, ht), P(tLo, sB - 0.01, ht)]);
        ctx.fillStyle = C(st.tread, treadLit);
        ctx.fill();
        ctx.strokeStyle = C(st.line, treadLit, 0.6);
        ctx.lineWidth = lw(1);
        ctx.stroke();
        if (risersShow) {
          poly([P(tLo, sF + 0.01, ht), P(tHi, sF + 0.01, ht), P(tHi, sm - 0.04, ht - r), P(tLo, sm - 0.04, ht - r)]);
          ctx.fillStyle = C(st.string, riserLit);
          ctx.fill();
          ctx.stroke();
        } else {
          // Seen from its head: the round back of the log under the tread, each one a step higher than the one beyond it.
          poly([P(tLo, sB - 0.01, ht), P(tHi, sB - 0.01, ht), P(tHi, sm + 0.04, ht - r), P(tLo, sm + 0.04, ht - r)]);
          ctx.fillStyle = C(st.string, riserLit * 0.84);
          ctx.fill();
          ctx.stroke();
        }
        // Its end, where the saw cut it: rings in a half round.
        const [ex, ey] = P(tNear, sm, ht - 0.2);
        const e2 = P(tNear, sF + 0.01, ht), rr = Math.max(2, Math.hypot(e2[0] - ex, e2[1] - ey));
        ctx.beginPath();
        ctx.ellipse(ex, ey, rr, rr * 0.75, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = C(st.nose, sideLit * 1.05);
        ctx.fill();
        ctx.strokeStyle = C(st.line, 1, 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(ex, ey, rr * 0.55, rr * 0.4, 0, 0, Math.PI);
        ctx.strokeStyle = C(st.joint, 1, 0.8);
        ctx.stroke();
        return;
      }
      if (!risersShow && st.build !== 'solid') {
        // Seen from behind: the back of its riser board, under the tread over it.
        poly([P(tLo, sF, hb), P(tHi, sF, hb), P(tHi, sF, ht - NOSE_H), P(tLo, sF, ht - NOSE_H)]);
        ctx.fillStyle = C(st.riser, riserLit * 0.86);
        ctx.fill();
        ctx.strokeStyle = C(st.line, riserLit, 0.45);
        ctx.lineWidth = lw(0.9);
        ctx.stroke();
      }
      if (risersShow) {
        const rt = ht - NOSE_H;
        poly([P(tLo, sF, hb), P(tHi, sF, hb), P(tHi, sF, rt), P(tLo, sF, rt)]);
        ctx.fillStyle = C(st.riser, riserLit);
        ctx.fill();
        // Its courses and the joints between its units, broken course to course.
        const n = Math.max(1, st.courses);
        for (let k = 0; k < st.courses; k++) {
          const k0 = hb + ((rt - hb) * k) / n, k1 = hb + ((rt - hb) * (k + 1)) / n;
          if (k) line(P(tLo, sF, k0), P(tHi, sF, k0), C(st.joint, riserLit, 0.9), lw(1));
          for (let j = 0; j < st.across; j++) {
            const tj = tLo + (tHi - tLo) * ((j + 0.5 * ((k + i) % 2) + 0.25 * hash2(salt, k * 5 + j, 29)) / st.across);
            if (tj <= tLo + 0.04 || tj >= tHi - 0.04) continue;
            line(P(tj, sF, k0), P(tj, sF, k1), C(st.joint, riserLit, 0.9), lw(1));
          }
        }
        // The shade under the nosing.
        if (NOSE) {
          poly([P(tLo, sF, rt), P(tHi, sF, rt), P(tHi, sF, rt - 1.4), P(tLo, sF, rt - 1.4)]);
          ctx.fillStyle = C(st.line, 1, 0.28);
          ctx.fill();
        }
        poly([P(tLo, sF, hb), P(tHi, sF, hb), P(tHi, sF, rt), P(tLo, sF, rt)]);
        ctx.strokeStyle = C(st.line, riserLit, 0.45);
        ctx.lineWidth = lw(0.9);
        ctx.stroke();
      }
      // The tread, a nosing proud of the riser, and the face of the nosing.
      const sN = sF - NOSE;
      if (NOSE && risersShow) {
        poly([P(tLo, sN, ht - NOSE_H), P(tHi, sN, ht - NOSE_H), P(tHi, sN, ht), P(tLo, sN, ht)]);
        ctx.fillStyle = C(st.nose, riserLit * 1.04);
        ctx.fill();
      }
      poly([P(tLo, sN, ht), P(tHi, sN, ht), P(tHi, sB, ht), P(tLo, sB, ht)]);
      ctx.fillStyle = C(st.tread, treadLit);
      ctx.fill();
      // Where one slab or board of it ends and the next begins.
      for (let j = 1; j < st.slabs; j++) {
        const tj = tLo + (tHi - tLo) * ((j + (hash2(salt, j, 31) - 0.5) * 0.4) / st.slabs);
        line(P(tj, sN, ht), P(tj, sB, ht), C(st.joint, treadLit, 0.85), lw(1));
      }
      if (st.build !== 'solid') line(P(tLo, (sN + sB) / 2, ht), P(tHi, (sN + sB) / 2, ht), C(st.joint, treadLit, 0.5), lw(0.8));
      line(P(tLo, sN, ht), P(tHi, sN, ht), C(st.nose, treadLit * 1.05), lw(1.6));
      poly([P(tLo, sN, ht), P(tHi, sN, ht), P(tHi, sB, ht), P(tLo, sB, ht)]);
      ctx.strokeStyle = C(st.line, treadLit, 0.4);
      ctx.lineWidth = lw(0.9);
      ctx.stroke();
    };
    ctx.globalAlpha = box ? (done ? 1 : 0.45) : alpha * (done ? 1 : 0.45);
    ctx.lineJoin = 'round';
    // What stands beyond the steps from the camera: the far string, the far rail.
    const far: 0 | 1 = near ? 0 : 1;
    const farOpen = open(far), nearOpen = open(near);
    // Only what stands up over the ground floor, for a flight down whose hole is laid already (`drawOpening`).
    const whole = part === 'whole';
    if (whole && (st.build === 'string' || st.build === 'closed') && !joined(far)) string(tFar);
    /*
     * Under the split logs, between the stringers, the backs of the logs in
     * their own shade, laid along the pitch of the flight: through the gaps
     * between its steps a log flight shows the underside of the steps beyond,
     * and not the floor and the wall behind it, which is what a ladder shows.
     */
    if (whole && st.build === 'log') {
      poly([P(tLo, 0.02, h0), P(tHi, 0.02, h0), P(tHi, 1, h1 - rise * 0.55), P(tLo, 1, h1 - rise * 0.55)]);
      ctx.fillStyle = C(st.string, sideLit * 0.46);
      ctx.fill();
    }
    if (whole && st.build === 'log' && !joined(far)) stringer(tFar + (near ? 0.08 : -0.08));
    // And the near one under the split logs too: they lie across the two and stand out past them, so each step's end,
    // stacked up the flight, is laid over its stringer -- which seen from the head end is what says it climbs.
    if (whole && st.build === 'log' && !joined(near)) stringer(tNear + (near ? -0.08 : 0.08));
    if (farOpen) {
      if (st.rail === 'parapet') side(tFar, true);
      else rail(tFar);
    }
    // The steps, back to front.
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => {
      const [ax, ay] = W((tLo + tHi) / 2, (a + 0.5) / N);
      const [bx, by] = W((tLo + tHi) / 2, (b + 0.5) / N);
      return cam.rotateX(ax, ay) + cam.rotateY(ax, ay) - (cam.rotateX(bx, by) + cam.rotateY(bx, by));
    });
    if (whole) for (const i of order) step(i);
    // A solid flight seen from behind shows the end of it under the landing.
    if (whole && st.build === 'solid' && !risersShow) {
      const pts: Array<[number, number]> = [P(tLo, 1, h0), P(tHi, 1, h0), P(tHi, 1, h1), P(tLo, 1, h1)];
      poly(pts);
      if (!pictured(W(tLo, 1), W(tHi, 1), riserLit)) {
        ctx.fillStyle = C(st.string, riserLit);
        ctx.fill();
      }
      poly(pts);
      ctx.strokeStyle = C(st.line, riserLit, 0.5);
      ctx.lineWidth = lw(1);
      ctx.stroke();
    }
    // Then the side toward the camera, and its rail.
    if (!joined(near)) {
      if (st.build === 'solid') {
        if (whole || (st.rail === 'parapet' && nearOpen)) side(tNear, st.rail === 'parapet' && nearOpen);
      } else if (!whole || st.build === 'log') {
        // Nothing of a string or a stringer stands over the ground floor, and a log flight's stringers went in under its steps.
      } else string(tNear);
    }
    if (nearOpen && st.rail !== 'parapet') rail(tNear + (near ? -0.05 : 0.05));
    if (!done && whole) {
      poly([P(span[0], 0, h1), P(span[1], 0, h1), P(span[1], 1, h1), P(span[0], 1, h1)]);
      ctx.strokeStyle = PLAN_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    if (box) {
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = alpha;
      main.drawImage(ctx.canvas, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
      main.restore();
    }
  }

  /**
   * A hatch in this storey's floor and a ladder up to it from the storey
   * below, climbed from the facing side.
   *
   * It was a dark square laid on the floor and two lines standing upright
   * beside it, which from half the turns of the view stood out in the yard.
   * The hatch is a hole now: the floor round it shows its cut edges on the
   * far side, lit as the edge of a deck is, with the dark of the room below
   * under them. And the ladder leans: its foot out on the floor below toward
   * the side it is climbed from, its head against the far edge of the hatch
   * -- clear of a wall standing there -- and its stiles running on up past
   * the floor as handholds, the way you get off one at the top.
   *
   * Over your head, the hatch is dimmed with the ceiling it is cut in; the
   * ladder is not, because it stands in the room with you and is too thin to
   * hide you.
   */
  drawLadder(floor: FloorTile, x: number, y: number, base: number, alpha: number, hatch = true, into?: CanvasRenderingContext2D): void {
    const main = into ?? this.r.canvas.ctx;
    const cam = this.r.camera;
    const bld = this.r.game.buildings;
    const facing = floor.facing ?? 's';
    const h0 = base + (floor.level - 1) * WALL_HEIGHT;
    const h1 = base + floor.level * WALL_HEIGHT;
    const done = isDone(floor);
    const zoom = cam.zoom;
    const lw = (k: number): number => Math.max(0.8, k * zoom);
    const W = (t: number, s: number): [number, number] => StairPainter.stairPoint(x, y, facing, t, s);
    const P = (t: number, s: number, h: number): [number, number] => {
      const [wx, wy] = W(t, s);
      return [cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, h)];
    };
    /*
     * What is laid faint is laid whole on a layer and put over once, as a
     * flight seen through is: a piece at a time, every place two pieces of it
     * overlap would come out darker than either.
     */
    const lay = (a: number, draw: (g: CanvasRenderingContext2D) => void): void => {
      if (a >= 1 || into) {
        main.globalAlpha = Math.min(1, a);
        draw(main);
        main.globalAlpha = 1;
        return;
      }
      const dpr = this.r.canvas.dpr;
      const xs: number[] = [], ys: number[] = [];
      for (const t of [-0.2, 1.2]) for (const s of [-0.2, 1.2]) for (const h of [h0, h1 + 12]) {
        const [qx, qy] = P(t, s, h);
        xs.push(qx);
        ys.push(qy);
      }
      const bx = Math.max(0, Math.floor(Math.min(...xs) * dpr)), by = Math.max(0, Math.floor(Math.min(...ys) * dpr));
      const box: [number, number, number, number] = [bx, by, Math.ceil(Math.max(...xs) * dpr) - bx + 1, Math.ceil(Math.max(...ys) * dpr) - by + 1];
      const g = this.r.seeThroughCtx(box);
      draw(g);
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = a;
      main.drawImage(g.canvas, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
      main.restore();
    };
    const poly = (g: CanvasRenderingContext2D, pts: Array<[number, number]>): void => {
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
    };
    const line = (g: CanvasRenderingContext2D, a: [number, number], b: [number, number], ink: string, width: number): void => {
      g.strokeStyle = ink;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    };
    /*
     * The hole. What shows through it is the room below, in the shade of the
     * floor over it; round it, the edges of the floor that are cut to it, on
     * the side of it away from the camera, where their cut face looks back.
     */
    if (hatch) lay(alpha, (g) => {
      poly(g, [P(0, 0, h1), P(1, 0, h1), P(1, 1, h1), P(0, 1, h1)]);
      g.fillStyle = 'rgba(34, 26, 22, 0.42)';
      g.fill();
      // The four edges: along each, the way out of the hatch and the tile there.
      const edges: Array<[number, number, number, number, number, number]> = [
        [0, 0, 1, 0, 0, -1], [1, 0, 1, 1, 1, 0], [1, 1, 0, 1, 0, 1], [0, 1, 0, 0, -1, 0],
      ];
      for (const [t0, s0, t1, s1, dt, ds] of edges) {
        const [ax, ay] = W(t0 + dt * 0.5 + 0.5 * (t1 - t0), s0 + ds * 0.5 + 0.5 * (s1 - s0));
        const nx = ax - (x + 0.5), ny = ay - (y + 0.5);
        // Only the far edges: their cut face looks back into the hatch, at the camera. One seen edge on is nothing.
        if (cam.rotateX(-nx, -ny) + cam.rotateY(-nx, -ny) < 1e-6) continue;
        const beyond = bld.floor(floor.level, x + Math.round(nx), y + Math.round(ny));
        if (!beyond || floorKind(beyond) === 'ladder' || floorKind(beyond) === 'stairs') continue;
        const mat = MATERIAL_BY_ID.get(beyond.material);
        if (!mat) continue;
        const trim = this.r.painted(mat, beyond.dye).trim;
        const lit = Math.abs(cam.rotateX(nx, ny)) > Math.abs(cam.rotateY(nx, ny)) ? 0.95 : 0.76;
        poly(g, [P(t0, s0, h1), P(t1, s1, h1), P(t1, s1, h1 - FLOOR_DEEP), P(t0, s0, h1 - FLOOR_DEEP)]);
        g.fillStyle = rgb(trim, lit);
        g.fill();
        // And the shade it throws down into the room, under its lip.
        poly(g, [P(t0, s0, h1 - FLOOR_DEEP), P(t1, s1, h1 - FLOOR_DEEP), P(t1, s1, h1 - FLOOR_DEEP - 5), P(t0, s0, h1 - FLOOR_DEEP - 5)]);
        const shade = g.createLinearGradient(0, P(0.5, 0.5, h1 - FLOOR_DEEP)[1], 0, P(0.5, 0.5, h1 - FLOOR_DEEP - 5)[1]);
        shade.addColorStop(0, 'rgba(34, 26, 22, 0.4)');
        shade.addColorStop(1, 'rgba(34, 26, 22, 0)');
        g.fillStyle = shade;
        g.fill();
        line(g, P(t0, s0, h1), P(t1, s1, h1), rgb(trim, lit * 1.12), lw(1));
      }
      if (!done) {
        poly(g, [P(0, 0, h1), P(1, 0, h1), P(1, 1, h1), P(0, 1, h1)]);
        g.strokeStyle = PLAN_COLOR;
        g.lineWidth = 1;
        g.setLineDash([4, 3]);
        g.stroke();
        g.setLineDash([]);
      }
    });
    /*
     * The ladder: a stile either side and a rung to every three units of
     * height, leaning at the angle a ladder is safe at -- a quarter of its
     * height out at the foot -- its head against the far edge of the hatch,
     * or against the face of a wall standing there. Where three units of
     * height come to less than six pixels of screen, the rungs would run
     * together, so they go in at six units, or nine, instead.
     */
    const headWall = bld.wallOnBorder(floor.level - 1, borderOf(x, y, ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[facing]));
    const sHead = headWall && isDone(headWall) ? 1 - WALL_THICK - 0.02 : 0.985;
    const sFoot = sHead - ((h1 - h0) / UNITS_PER_TILE) * 0.26;
    const top = h1 + 7;
    const sAt = (h: number): number => sFoot + ((sHead - sFoot) * (h - h0)) / (h1 - h0);
    const pitch = 3 * Math.ceil(6 / (3 * HEIGHT_SCALE * zoom));
    const bare = MATERIAL_BY_ID.get(floor.material) ?? MATERIAL_BY_ID.get('plank');
    const paint = floor.dye && bare ? this.r.painted(bare, floor.dye).color : null;
    const wood = (c: readonly [number, number, number], k: number): string => {
      if (!paint) return rgb(c, k);
      const lum = (q: readonly [number, number, number]): number => 0.299 * q[0] + 0.587 * q[1] + 0.114 * q[2];
      return rgb(paint, k * Math.max(0.6, Math.min(1.3, lum(c) / lum(LADDER.stile))));
    };
    const T0 = 0.36, T1 = 0.64;
    // The stile further from the camera, the rungs, then the nearer stile.
    const nearT = cam.nearSide(W(1, 0)[0] - W(0, 0)[0], W(1, 0)[1] - W(0, 0)[1]) > 0 ? T1 : T0;
    const farT = nearT === T1 ? T0 : T1;
    const lit = this.r.faceLight(W(0, 1)[0] - W(0, 0)[0], W(0, 1)[1] - W(0, 0)[1]);
    lay(done ? 1 : 0.45, (g) => {
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const ws = Math.max(2.2, 4 * zoom), edge = (ws + lw(1.4)) / 2;
      const stile = (t: number): void => {
        const a = P(t, sFoot, h0), b = P(t, sAt(top), top);
        line(g, a, b, wood(LADDER.line, 1), ws + lw(1.4));
        line(g, a, b, wood(LADDER.stile, lit), ws);
        line(g, [a[0] - ws * 0.18, a[1]], [b[0] - ws * 0.18, b[1]], wood(LADDER.stileHi, 1.02), Math.max(0.8, ws * 0.3));
      };
      stile(farT);
      /*
       * A rung butts against the inside of the stile behind it, cut along
       * that stile's edge whatever the angle, and the stile in front covers
       * its other end.
       */
      const fa = P(farT, sFoot, h0), fb = P(farT, sAt(top), top);
      const along = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) || 1;
      const ox = (-(fb[1] - fa[1]) / along) * edge, oy = ((fb[0] - fa[0]) / along) * edge;
      g.save();
      g.beginPath();
      g.rect(-1e5, -1e5, 2e5, 2e5);
      g.moveTo(fa[0] + ox, fa[1] + oy);
      g.lineTo(fb[0] + ox, fb[1] + oy);
      g.lineTo(fb[0] - ox, fb[1] - oy);
      g.lineTo(fa[0] - ox, fa[1] - oy);
      g.closePath();
      g.clip('evenodd');
      g.lineCap = 'butt';
      for (let h = h0 + pitch; h <= h1 - 1; h += pitch) {
        const s = sAt(h), a = P(farT, s, h), b = P(nearT, s, h), w = Math.max(1.6, 2.6 * zoom);
        line(g, a, b, wood(LADDER.line, 1), w + lw(1.2));
        line(g, a, b, wood(LADDER.rung, 1.02), w);
        line(g, [a[0], a[1] - w * 0.2], [b[0], b[1] - w * 0.2], wood(LADDER.rungHi, 1.05), Math.max(0.7, w * 0.3));
      }
      g.restore();
      g.lineCap = 'round';
      stile(nearT);
      g.lineCap = 'butt';
      g.lineWidth = 1;
    });
  }

  /**
   * Looking into a cellar, take off with the building over it every building
   * that stands between a cellar and the eye and whose box on the screen falls
   * over the cellar's: the cellar is laid over the country round it, and a
   * house in front of it laid under it would read as a house behind it. Asked
   * of the buildings within a few tiles of a cellar, and only while one is
   * being looked into.
   */
  cutInFront(): void {
    const g = this.r.game;
    const bld = g.buildings;
    const cam = this.r.camera;
    const V = cam.view;
    type Box = { x0: number; x1: number; y0: number; y1: number; front: number; tx0: number; tx1: number; ty0: number; ty1: number };
    const boxes = new Map<number, Box>();
    const grow = (b: Box, px: number, py: number, hTop: number, hLow: number): void => {
      const sx = cam.worldToScreenX(px, py);
      b.x0 = Math.min(b.x0, sx);
      b.x1 = Math.max(b.x1, sx);
      b.y0 = Math.min(b.y0, cam.worldToScreenY(px, py, hTop));
      b.y1 = Math.max(b.y1, cam.worldToScreenY(px, py, hLow));
    };
    const fresh = (): Box => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, front: -Infinity, tx0: Infinity, tx1: -Infinity, ty0: Infinity, ty1: -Infinity });
    for (const c of bld.cellars.values()) {
      let b = boxes.get(c.building);
      if (!b) boxes.set(c.building, (b = fresh()));
      const top = g.world.getHeight(c.x, c.y);
      for (const [px, py] of [[c.x, c.y], [c.x + 1, c.y], [c.x + 1, c.y + 1], [c.x, c.y + 1]]) grow(b, px, py, top, top - CELLAR_DEPTH);
      b.front = Math.max(b.front, depthOf(V, c.x, c.y));
      b.tx0 = Math.min(b.tx0, c.x);
      b.tx1 = Math.max(b.tx1, c.x);
      b.ty0 = Math.min(b.ty0, c.y);
      b.ty1 = Math.max(b.ty1, c.y);
    }
    const NEAR = 8;
    for (const b of bld.list.values()) {
      if (this.r.cut.has(b.id) || !b.tiles.length) continue;
      const [fx, fy] = b.tiles[0].split(',').map(Number);
      const near = [...boxes.values()].filter((c) => fx >= c.tx0 - NEAR && fx <= c.tx1 + NEAR && fy >= c.ty0 - NEAR && fy <= c.ty1 + NEAR);
      if (!near.length) continue;
      const box = fresh();
      for (const k of b.tiles) {
        const [x, y] = k.split(',').map(Number);
        const ground = g.world.getHeight(x, y);
        for (const [px, py] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) grow(box, px, py, ground + b.levels * WALL_HEIGHT + 24, ground);
        box.front = Math.max(box.front, depthOf(V, x, y));
        // Its jetties too, a tile out, at its floor's height (`frame.ts`): one of them can stand over the cellar's box.
        for (const [jx, jy] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
          if (bld.jettyAt(jx, jy)?.id !== b.id) continue;
          const floor = jettyBase(g, b, jx, jy) ?? ground;
          for (const [px, py] of [[jx, jy], [jx + 1, jy], [jx + 1, jy + 1], [jx, jy + 1]]) grow(box, px, py, floor + b.levels * WALL_HEIGHT + 24, g.world.getHeight(px, py));
          box.front = Math.max(box.front, depthOf(V, jx, jy));
        }
      }
      if (near.some((c) => box.front >= c.front && box.x0 < c.x1 && box.x1 > c.x0 && box.y0 < c.y1 && box.y1 > c.y0)) this.r.cut.add(b.id);
    }
  }
}
