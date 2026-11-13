import type { Camera } from '../engine/camera';
import type { FullscreenCanvas } from '../engine/canvas';
import { type Bridge, bridgeDone } from '../game/bridges';
import { type Wall, type Border, borderPoints, isDone, WALL_TYPE_BY_ID, FENCE_THICK, WALL_THICK, WALL_HEIGHT, MATERIAL_BY_ID, borderOf, progressOf, type MaterialDef } from '../game/building';
import { counterHeld, counterSeat, streetOf, COUNTER_HOLDS } from '../game/counters';
import type { Game } from '../game/game';
import { hingeKey } from '../game/gates';
import { GLASS } from '../game/glasshouse';
import { wallGreen, greenShows, GREEN_WET_REACH, wetFrom } from '../game/greening';
import type { LightSource } from '../game/light';
import { isRuneGate, gateMiddle, runeGateLit, RUNE_GATE_RISE, gateTiles } from '../game/runegate';
import { hash2 } from '../world/noise';
import { counterWares, type CounterLook, stripeOf, counterHole, drawCounterInside, drawCounterReveal, drawCounterFrontKept, drawCounterDaylight } from './counter';
import { type Entity, rgb, PLAN_COLOR, scatterOf, LAMP_DARK, type BakeAs } from './drawshared';
import { type RailEnds, PILASTER_PROUD, drawRailing } from './framing';
import { type Motion, gatewayArch, drawGrooves, gatewayPicture, GATEWAY, gatewayClear, drawHiddenMark, moveTo, type WallFace, type ArchShape, PORTCULLIS_DROP, PORTCULLIS_RISE, drawGrille, DRAWBRIDGE_RISE, DRAWBRIDGE_FALL, type DrawbridgeGeom, drawStandingDeck, drawHingeCrib, drawGallows, drawChains, gallowsTop, drawLandingCrib, drawGatewayDressing } from './gates';
import { drawGlassWall } from './glasswall';
import { UNITS_PER_TILE } from './iso';
import { capMoss, hashOf, PAVE_STAGES, CAP_W, CAP_D, type Keep, ivyLayout, vigour, PPM, strandPic } from './ivy';
import { WINDOW, FENCE_GAP, DOOR, DOUBLE, BAY, ARCH, type Masonry } from './masonry';
import type { HitRect } from './picking';
import { gateVariant, drawRuneGate, RUNE_GATE_OPENING } from './runegate';
import type { RunestoneNight } from './runestone';
import type { StructureWatch } from './structwatch';
import { type View, depthOf } from './view';

/*
 * How much of the hour's light the inside of an archway keeps.
 *
 * A reveal is a face turned away from the light, not a hole in the daylight.
 * At a little over half it came out near black against a pale wall and read as
 * a slot rather than a passage. The jambs keep three quarters, because the sky
 * still reaches down the sides of a way through; the soffit keeps half again
 * of that, because nothing reaches the underside of an arch.
 */
const JAMB_LIT = 0.86;
/** The timber of a shop counter's board on a wall drawn in flat colours, and its ink (`counter.ts`). */
const COUNTER_OAK: readonly [number, number, number] = [178, 138, 84];
const COUNTER_OAK_INK: readonly [number, number, number] = [112, 82, 46];
const SOFFIT_LIT = 0.7;
/** The inside of a sill is the one surface in a wall turned up at the sky. */
const SILL_LIT = 1.02;
/** And so is a threshold, which is walked on as well, so it is paler still. */
const STEP_LIT = 1.06;
const IRON: readonly [number, number, number] = [0x7b, 0x81, 0x88];
/** Its own shade, so a bar of it reads as round stock rather than as a painted line. */
const IRON_DARK: readonly [number, number, number] = [0x44, 0x4a, 0x51];

/** Four whole numbers to one in [0, 1), the same every time: where a thing falls, by where it is. */
function hash4(a: number, b: number, c: number, d: number): number {
  let k = (a * 374761393 + b * 668265263 + c * 1442695041 + d * 2246822519) | 0;
  k = Math.imul(k ^ (k >>> 13), 1274126177);
  k = Math.imul(k ^ (k >>> 16), 2654435761);
  return ((k ^ (k >>> 15)) >>> 0) / 4294967296;
}
/**
 * A wall's face in the two coordinates that mean anything on it: `t` along the
 * border and `k` up the height, with `s` choosing the face the camera is on or
 * the one behind. Handed to whatever draws on a wall so that it never has to
 * know where the wall is or which way the view is turned.
 */
interface WallGeom {
  px: (t: number, k: number, s?: number) => number;
  py: (t: number, k: number, s?: number) => number;
  quad: (t0: number, t1: number, k0: number, k1: number, s?: number) => void;
}
/** What nothing that grows on a wall goes over on a shop counter's face: its opening, the board under it and the awning over it. */
const COUNTER_KEEP = { t0: BAY.t0 - 0.06, t1: BAY.t1 + 0.06, k0: BAY.k0 - 0.2, k1: BAY.k1 + 0.14 } as const;

/** What WallPainter needs of the renderer (`renderer.ts` builds it). */
export interface WallHost {
  atSize(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement;
  baked(key: string, ax: number, ay: number, box: [number, number, number, number], draw: () => void, ver: number, opts?: BakeAs): void;
  readonly bloom: boolean;
  readonly camera: Camera;
  readonly canvas: FullscreenCanvas;
  readonly deckHits: HitRect[];
  readonly drawbridges: Map<string, Bridge>;
  edgeOn(border: Border): boolean;
  engagedIn(level: number, cx: number, cy: number): number;
  readonly ents: Entity[];
  faceLight(ux: number, uy: number): number;
  readonly frameNo: number;
  readonly game: Game;
  readonly gateDeferred: Map<number, Entity[]>;
  readonly gateIn: Entity[];
  readonly gateLate: Array<() => void>;
  readonly greenAt: number;
  readonly landings: Map<string, Bridge>;
  liftWall(px: (t: number, k: number, s?: number) => number, py: (t: number, k: number, s?: number) => number): void;
  readonly lightsNow: LightSource[];
  masonryOf(wall: { material: string; dye?: string }): Masonry | undefined;
  occludeLine(box: [number, number, number, number] | null, draw: () => void): void;
  painted(mat: MaterialDef, dye: string | undefined): MaterialDef;
  readonly project: (x: number, y: number, h: number) => [number, number];
  readonly runeNight: RunestoneNight;
  standing(wall: Wall, border: Border): number;
  storeyHidden(level: number): boolean;
  readonly structs: StructureWatch;
  readonly time: number;
  wallLift: Path2D | null;
}

/**
 * Walls as the renderer lays them (`WallHost`): a wall's body in its material and grain, its ivy and its wet foot,
 * its openings (windows, bays, doors, arches, counters), fences and their gates, iron gates, portcullises, rune gates
 * and drawbridges, and their landings.
 */
export class WallPainter {
  /** Per building, which way its floor joists run, and how many tiles it had when that was worked out. */
  private joists = new Map<number, { n: number; h: boolean }>();

  /** The front pictures of the rune gates drawn on this line, over whoever this line drew in their openings. */
  private gateFront: Array<() => void> = [];

  /**
   * The colour of the glass in the window or bay being drawn, if it was
   * glazed with dyed panes (`Wall.glass`): set for the length of one wall, so
   * every pane drawn in it, outside or in, is tinted (`pane`).
   */
  private paneTint: [number, number, number] | null = null;

  /** How near water a tile stands, nought to one, for what greens beside it: kept a few seconds, so a pond dug is seen. */
  private wetCache = new Map<number, number>();
  private wetKept = -Infinity;

  // ---- Gates: a portcullis's grille and a drawbridge (`gates.ts`). ----

  /** Where each gate is in its travel, by the border or the bridge. */
  private gateMotion = new Map<string, Motion>();

  /** The light in each room this frame (`lampBehind`), by storey and tile, and the frame it is for. */
  private roomLit = new Map<string, number>();
  private roomLitFrame = -1;

  constructor(private readonly r: WallHost) {}

  /**
   * What stands at each end of a section of railing: a post, drawn once at
   * each corner by the first finished railing round it, or a wall or a column
   * that is the post there and that the rails stop at. A section still going
   * up stands its own post where no finished railing has one.
   */
  private railEnds(wall: Wall, border: Border): RailEnds {
    const bld = this.r.game.buildings;
    const ends: RailEnds = { post: [false, false], cut: [0, 0] };
    const [ax, ay, bx, by] = borderPoints(border);
    ([[ax, ay], [bx, by]] as Array<[number, number]>).forEach(([cx, cy], i) => {
      const round: Border[] = [{ dir: 'h', x: cx, y: cy }, { dir: 'v', x: cx, y: cy }, { dir: 'h', x: cx - 1, y: cy }, { dir: 'v', x: cx, y: cy - 1 }];
      let owner: Border | undefined;
      let stop = -1;
      for (const b of round) {
        const w = bld.wallOnBorder(wall.level, b);
        if (!w || !isDone(w)) continue;
        if (w.type === 'railing') {
          owner ??= b;
          continue;
        }
        // A wall meeting it: in line, the rails run to its end; square to it, to its face.
        const half = WALL_TYPE_BY_ID.get(w.type)?.railed ? FENCE_THICK : WALL_THICK * (WALL_TYPE_BY_ID.get(w.type)?.thick ?? 1);
        stop = Math.max(stop, b.dir === border.dir ? 0 : half);
      }
      const col = bld.column(wall.level, cx, cy);
      // A column the rails stop at: at its shaft, or at a pilaster's face.
      if (col && isDone(col)) {
        const engaged = this.r.engagedIn(wall.level, cx, cy);
        stop = Math.max(stop, engaged > 0 ? engaged + PILASTER_PROUD : 0.05);
      }
      if (stop >= 0) ends.cut[i] = stop;
      else if (!isDone(wall)) ends.post[i] = !owner;
      else ends.post[i] = !!owner && owner.dir === border.dir && owner.x === border.x && owner.y === border.y;
    });
    return ends;
  }

  /**
   * The masonry a wall -- or a flight of stairs, or anything else built of a
   * material -- is painted in, or none: the others are ruled in flat colours,
   * and a coat of paint over any of them would be two walls at once, so a
   * dyed one goes down to the flat colours with everything else.
   */
  /**
   * Whether a finished wall's top is covered by the storey stood on it, and so
   * draws no cap of its own, as `drawWallBody` has it (`lidded`): a painted
   * masonry's under a wall of the storey over it at least as thick and not a
   * railing; one whose coat goes over its head under any. A storey that is
   * not drawn (`storeyHidden`) covers nothing.
   */
  private capHidden(w: Wall, b: Border): boolean {
    const kind = WALL_TYPE_BY_ID.get(w.type);
    if (kind?.low || kind?.railed) return false;
    const cob = this.r.masonryOf(w);
    if (!cob) return false;
    /*
     * Reported: "some wall tops still glitched." Looking at one storey lifts
     * the one over it off, and a wall that storey stood on was left with no
     * cap at all -- its head an open slot, the cap of a partition coming up
     * to it standing in the slot as a slab of its own. Its top is in sight,
     * so it is capped, and its corners and junctions laid, as a wall with
     * nothing on it is.
     */
    if (this.r.storeyHidden(w.level + 1)) return false;
    const up = this.r.game.buildings.wallOnBorder(w.level + 1, b);
    if (!up || !isDone(up)) return false;
    if (cob.wrap) return true;
    const k2 = WALL_TYPE_BY_ID.get(up.type);
    return (k2?.thick ?? 1) >= (kind?.thick ?? 1) && !k2?.railed;
  }

  private bearsJoists(id: number, border: Border): boolean {
    const b = this.r.game.buildings.list.get(id);
    if (!b) return false;
    let had = this.joists.get(id);
    if (!had || had.n !== b.tiles.length) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const key of b.tiles) {
        const i = key.indexOf(',');
        const x = +key.slice(0, i), y = +key.slice(i + 1);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      had = { n: b.tiles.length, h: x1 - x0 >= y1 - y0 };
      this.joists.set(id, had);
    }
    return had.h === (border.dir === 'h');
  }

  /**
   * A wall, with a thickness to it.
   *
   * Reported: "walls are paper thin and have no character." They were exactly
   * paper: one quad standing on the border line, one flat colour, and a few
   * lines ruled across it. Nothing in that says how thick a thing is or what
   * it is made of, and a village of it reads as folded card.
   *
   * So a wall is a box now rather than a curtain. It is centred on its border
   * and carries three faces: the one the camera is on, the cap along its top —
   * which catches the sky and is the whole of what says "thick" in a view from
   * above — and, at an end with nothing carrying on from it, the end grain.
   * The three are lit apart: the top brightest, the face by its angle to the
   * light as before, the end in shadow.
   *
   * What it is made of is drawn on the face by `wallGrain`, and only when you
   * are near enough to see it; from far off a wall is its three faces and
   * that is the right amount of a wall.
   */
  drawWall(wall: Wall, border: Border, base: number, alpha: number): void {
    // A rune gate, finished, is a model of its own, its runes' light laid over it each frame (`runegate.ts`).
    if (isRuneGate(wall) && isDone(wall)) {
      this.drawRuneGateWall(wall, border, base, alpha);
      return;
    }
    const cam = this.r.camera;
    const [ax, ay, bx, by] = borderPoints(border);
    const dx = bx - ax, dy = by - ay;
    // The box it can reach: half a tile past either end and either face, from under its foot to well over its top.
    const lo = base + (wall.level - 0.3) * WALL_HEIGHT, hi = base + (wall.level + 1.6) * WALL_HEIGHT;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of [-0.5, 1.5]) for (const s of [-0.5, 0.5]) for (const z of [lo, hi]) {
      const wx = ax + dx * t - dy * s, wy = ay + dy * t + dx * s;
      const sx = cam.worldToScreenX(wx, wy), sy = cam.worldToScreenY(wx, wy, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    // Seen through, half built, or a portcullis on its way up or down: as it always was.
    if (alpha < 1 || !isDone(wall) || this.gateMoving(wall, border)) {
      this.drawWallNow(wall, border, base, alpha);
      // Kept off a runestone's runes in front of it too -- all but one seen through, which the runes show through.
      if (alpha >= 1) this.r.occludeLine([x0, y0, x1, y1], () => this.drawWallNow(wall, border, base, alpha));
      return;
    }
    /*
     * Taking the wash off remembered ground behind it, it does from its
     * picture what drawing it would have done (`liftBaked`). It used to be
     * drawn afresh instead, and once the first wall in sight in front of
     * remembered ground had been, so was every wall after it in the frame.
     */
    const lift = this.r.wallLift;
    if (lift) this.liftBaked(wall, border, base);
    /*
     * With a lamp in the room behind it after dark, its glass is warmed by it
     * (`lampBehind`): the light in the room is in its key, and the dark it is
     * seen in is the light it is made again for (`bakeLight`). Such a wall
     * used to be drawn afresh every frame of the night.
     */
    let key = `w|${wall.level}|${border.dir}${border.x},${border.y}|${wall.type}|${wall.material}|${wall.dye ?? ''}|${wall.glass ?? ''}|${wall.building}|${base}|${this.roomLight(wall, border)}`;
    // A shop counter shows what is on it (`drawCounterPart`), which is no part of the building.
    if (wall.type === 'counter') {
      const c = this.r.game.counters.onBorder(border);
      if (c) key += `|${counterWares(c).join(',')}|${counterHeld(c)}`;
    }
    // What it reads round it is the two tiles either side of it, and `REACH` round those (`StructureWatch`).
    const ver = this.r.structs.version(border.dir === 'v' ? border.x - 1 : border.x, border.dir === 'h' ? border.y - 1 : border.y, border.x, border.y);
    // And not again by drawing it, when its picture is made: once is the outline, and the picture is the same either way.
    this.r.wallLift = null;
    try {
      this.r.baked(key, cam.worldToScreenX(ax, ay), cam.worldToScreenY(ax, ay, base), [x0, y0, x1, y1],
        () => this.drawWallNow(wall, border, base, alpha), ver);
    } finally {
      this.r.wallLift = lift;
    }
  }

  /**
   * `liftWall` for a wall laid from its picture, which is not drawn and so
   * does not take the wash off as it is: the same points on it as
   * `drawWallBody` works out -- its two faces, from its foot to its top.
   */
  private liftBaked(wall: Wall, border: Border, base: number): void {
    const kind = WALL_TYPE_BY_ID.get(wall.type);
    // A railing hides nothing behind it, and takes nothing off (`drawWallBody`).
    if (kind?.railed || !MATERIAL_BY_ID.get(wall.material)) return;
    const cam = this.r.camera;
    const [ax, ay, bx, by] = borderPoints(border);
    const dx = bx - ax, dy = by - ay;
    const half = WALL_THICK * (kind?.thick ?? 1);
    const nx = -dy * half, ny = dx * half;
    const toward = cam.nearSide(nx, ny);
    const h0 = base + wall.level * WALL_HEIGHT;
    const h1 = h0 + WALL_HEIGHT * this.r.standing(wall, border);
    this.r.liftWall(
      (t, _k, s = 1) => cam.worldToScreenX(ax + dx * t + nx * s * toward, ay + dy * t + ny * s * toward),
      (t, k, s = 1) => cam.worldToScreenY(ax + dx * t + nx * s * toward, ay + dy * t + ny * s * toward, h0 + (h1 - h0) * k));
  }

  /**
   * Whether a portcullis is on its way up or down (`grille`), or has been
   * let down or taken up since it was last drawn: its picture would hold
   * the grille where it was when the picture was made.
   */
  private gateMoving(wall: Wall, border: Border): boolean {
    if (wall.type !== 'portcullis') return false;
    const m = this.gateMotion.get(`p:${wall.level}:${border.dir}:${border.x},${border.y}`);
    return !m || m.to !== (wall.lowered ? 1 : 0) || (m.secs > 0 && (this.r.time - m.at < m.secs || this.r.time < m.at));
  }

  /**
   * A finished rune gate, standing on the middle of its border at `base`
   * (`runegate.ts`): its picture, its runes as lit as a citizen in its
   * opening has them (`runeGateLit`), and after dark, from here on in the
   * order, its runes' light kept off whatever stands in front of it
   * (`RunestoneNight.light`) -- and its own picture kept off the light of a
   * runestone or another gate behind it.
   */
  private drawRuneGateWall(wall: Wall, border: Border, base: number, alpha: number): void {
    const cam = this.r.camera;
    const m = gateMiddle(border);
    const sx = cam.worldToScreenX(m.x, m.y), sy = cam.worldToScreenY(m.x, m.y, base);
    const { lit, since } = runeGateLit(this.r.game, wall, performance.now() / 1000);
    const zoom = cam.zoom, turn = cam.rotation, variant = gateVariant(border.dir, border.x, border.y), dark = this.r.game.darkness(), t = this.r.time;
    const layer = (which: 'back' | 'front'): void => {
      const ctx = this.r.canvas.ctx;
      const was = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      const d = drawRuneGate(ctx, sx, sy, zoom, border.dir, turn, variant, lit, since, RUNE_GATE_RISE, dark, t, which);
      ctx.globalAlpha = was;
      if (alpha < 1) return;
      if (this.r.runeNight.keeping) this.r.runeNight.occlude(ctx, d.img, d.x, d.y, d.w, d.h);
      // Its runes take the night off themselves through the one night the runestones use, their shapes given as drawn at (sx, sy) moved by (dx, dy).
      if (d.lightBox) this.r.runeNight.glowing(ctx, ...d.lightBox, (dx, dy) => d.holes(sx + dx, sy + dy), (dx, dy) => d.masks(sx + dx, sy + dy));
    };
    // What stands behind the opening now; what stands in front of it once this line's bodies are drawn (`flushGateFront`).
    layer('back');
    this.gateFront.push(() => layer('front'));
  }
  flushGateFront(): void {
    if (!this.gateFront.length) return;
    for (const lay of this.gateFront) lay();
    this.gateFront.length = 0;
  }
  /**
   * Sorts out this line's bodies -- people, peers, and every creature: beasts,
   * wildermon, workers, mounts and their riders -- that stand inside a rune
   * gate's opening (`gateSpotOf`). One on the tile behind it is put off to the
   * line of the tile in front, where the gate is drawn; one on that line is
   * taken out of the line's run into `gateIn`, with those put off to it, to
   * be drawn between the gate's two pictures: over its threshold, the far
   * pillar and what grows behind, under the near pillar, what grows in front
   * and the lintel. Anyone standing anywhere else is drawn as before: behind
   * a pillar, before the gate; in front of it, after both pictures. Whether
   * there is anybody in `gateIn`.
   */
  gateBodies(d: number, V: View): boolean {
    const had = this.r.gateDeferred.get(d);
    if (had) this.r.gateDeferred.delete(d);
    if (!this.r.game.buildings.walls.size && !had) return false;
    const inn = this.r.gateIn;
    inn.length = 0;
    for (let i = this.r.ents.length - 1; i >= 0; i--) {
      const e = this.r.ents[i];
      const at = this.bodyAt(e);
      if (!at) continue;
      const to = this.gateSpotOf(at[0], at[1], V);
      if (to === null || to < d) continue;
      if (to > d) {
        // Pooled entities are lent for this line only: the one put off is a copy.
        const list = this.r.gateDeferred.get(to) ?? [];
        list.push({ ...e });
        this.r.gateDeferred.set(to, list);
      } else inn.push(e);
      this.r.ents.splice(i, 1);
    }
    if (had) inn.push(...had);
    return inn.length > 0;
  }

  /** Where on the ground a body this line took stands, if it is one that can walk through a gate, on the ground floor; else null. */
  private bodyAt(e: Entity): [number, number] | null {
    switch (e.kind) {
      // Not a driver on a box, whose cart is drawn where it stands; a rider is drawn with the mount.
      case 'player':
        return this.r.game.player.level === 0 && !(e.lift && e.seat === undefined) ? [this.r.game.player.x, this.r.game.player.y] : null;
      case 'peer':
        return e.peer && e.peer.level === 0 && !(e.lift && e.seat === undefined) ? this.r.game.roster.drawnAt(e.peer) : null;
      case 'creature': {
        const cr = e.creature;
        // Not one in a wagon's traces, which goes with the wagon.
        return cr && cr.hitchedTo === null ? [cr.x, cr.y] : null;
      }
      default:
        return null;
    }
  }

  /**
   * The line of the front tile of a finished rune gate whose opening a point
   * stands inside, or null: between its pillars' inner faces, less a body's
   * breadth, and no further through it either way than its pillars and the
   * planting at their feet stand (`RUNE_GATE_OPENING`).
   */
  private gateSpotOf(x: number, y: number, V: View): number | null {
    const tx = Math.floor(x), ty = Math.floor(y);
    const bld = this.r.game.buildings;
    for (const side of ['n', 's', 'w', 'e'] as const) {
      const b = borderOf(tx, ty, side);
      const w = bld.wallOnBorder(0, b);
      if (!w || !isRuneGate(w) || !isDone(w)) continue;
      const m = gateMiddle(b);
      const along = b.dir === 'h' ? x - m.x : y - m.y, through = b.dir === 'h' ? y - m.y : x - m.x;
      if (Math.abs(along) >= RUNE_GATE_OPENING.half - RUNE_GATE_OPENING.body || Math.abs(through) >= RUNE_GATE_OPENING.depth) continue;
      return Math.max(...gateTiles(b).map(([gx, gy]) => depthOf(V, gx, gy)));
    }
    return null;
  }

  private drawWallNow(wall: Wall, border: Border, base: number, alpha: number): void {
    const was = this.paneTint;
    this.paneTint = wall.glass && /^#[0-9a-f]{6}$/i.test(wall.glass)
      ? [parseInt(wall.glass.slice(1, 3), 16), parseInt(wall.glass.slice(3, 5), 16), parseInt(wall.glass.slice(5, 7), 16)] : null;
    try {
      this.drawWallBody(wall, border, base, alpha);
    } finally {
      this.paneTint = was;
    }
  }

  private drawWallBody(wall: Wall, border: Border, base: number, alpha: number): void {
    const ctx = this.r.canvas.ctx;
    const cam = this.r.camera;
    const bare = MATERIAL_BY_ID.get(wall.material);
    if (!bare) return;
    const mat = this.r.painted(bare, wall.dye);
    const [ax, ay, bx, by] = borderPoints(border);
    const kind = WALL_TYPE_BY_ID.get(wall.type);
    const cob = this.r.masonryOf(wall);
    const tall = this.r.standing(wall, border);
    const h0 = base + wall.level * WALL_HEIGHT;
    const h1 = h0 + WALL_HEIGHT * tall;
    const dx = bx - ax;
    const dy = by - ay;
    /*
     * Across the border, and which way of the two is the camera's.
     *
     * Everything further down the screen is nearer in this projection, and a
     * step across the wall moves down the screen by `u + v`, so the sign of
     * that is the side we can see. It is worked out per wall rather than per
     * building: turn the view and the other face comes round.
     */
    const half = (kind?.railed ? FENCE_THICK : WALL_THICK) * (kind?.thick ?? 1);
    const nx = -dy * half;
    const ny = dx * half;
    const toward = cam.nearSide(nx, ny);
    /** A point on the wall: `t` along it, `k` up it, `s` the near face or the far one. */
    const px = (t: number, k: number, s = 1): number =>
      cam.worldToScreenX(ax + dx * t + nx * s * toward, ay + dy * t + ny * s * toward);
    const py = (t: number, k: number, s = 1): number =>
      cam.worldToScreenY(ax + dx * t + nx * s * toward, ay + dy * t + ny * s * toward, h0 + (h1 - h0) * k);
    // In sight in front of remembered ground, it takes the wash off it -- finished and solid: not one seen through, half built or a railing.
    if (this.r.wallLift && alpha >= 1 && !kind?.railed && isDone(wall)) this.r.liftWall(px, py);
    const quad = (t0: number, t1: number, k0: number, k1: number, s = 1): void => {
      ctx.beginPath();
      ctx.moveTo(px(t0, k0, s), py(t0, k0, s));
      ctx.lineTo(px(t1, k0, s), py(t1, k0, s));
      ctx.lineTo(px(t1, k1, s), py(t1, k1, s));
      ctx.lineTo(px(t0, k1, s), py(t0, k1, s));
      ctx.closePath();
    };
    /** The cap across the top of a run, front edge to back edge. */
    const cap = (t0: number, t1: number, k: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(t0, k, 1), py(t0, k, 1));
      ctx.lineTo(px(t1, k, 1), py(t1, k, 1));
      ctx.lineTo(px(t1, k, -1), py(t1, k, -1));
      ctx.lineTo(px(t0, k, -1), py(t0, k, -1));
      ctx.closePath();
    };
    /** And the end of a run, where the thickness shows as end grain: all of it, or from `s0` to `s1` across it. */
    const endOf = (t: number, k0: number, k1: number, s0 = -1, s1 = 1): void => {
      ctx.beginPath();
      ctx.moveTo(px(t, k0, s1), py(t, k0, s1));
      ctx.lineTo(px(t, k0, s0), py(t, k0, s0));
      ctx.lineTo(px(t, k1, s0), py(t, k1, s0));
      ctx.lineTo(px(t, k1, s1), py(t, k1, s1));
      ctx.closePath();
    };
    // The face running along the view's x axis catches the light. How much of
    // it does is a matter of degree rather than a choice between two: turning
    // the view an eighth would otherwise jump a wall between the two tones,
    // and at a diagonal it is neither.
    const litOf = (ux: number, uy: number): number => {
      const vx = cam.rotateX(ux, uy);
      const along = Math.abs(vx);
      const into = Math.abs(cam.rotateY(ux, uy));
      const face = along / (along + into || 1);
      return 0.72 * (1 - face) + (vx > 0 ? 1 : 0.8) * face;
    };
    const lit = litOf(dx, dy);
    // A cap looks at the sky.
    const topLit = Math.min(1.3, lit * 1.24);
    /*
     * An end of a wall is a face turned square to it, and it is lit as that
     * face is -- as the face of a wall running the other way, or the face
     * round the corner it carries on. A quarter under the wall's own light,
     * it was a post of a darker colour than either face down every free end,
     * and where a fence stepped up to a half wall the step was a dark rule.
     */
    const endLit = litOf(border.dir === 'h' ? 0 : 1, border.dir === 'h' ? 1 : 0);
    const done = isDone(wall);
    const zoom = cam.zoom;
    /**
     * Whether a wall of the same storey carries on past this one's end, and
     * covers it.
     *
     * A neighbour that is lower or thinner does not. Where a garden wall
     * steps up from a fence to a half wall the taller one's end stood open --
     * nothing carried on at its full height or thickness, but something was
     * there, so no end was drawn and the grass showed through the step.
     */
    const on = (i: number): boolean => {
      const b: Border = border.dir === 'h'
        ? { dir: 'h', x: border.x + i, y: border.y }
        : { dir: 'v', x: border.x, y: border.y + i };
      const w = this.r.game.buildings.wallOnBorder(wall.level, b);
      if (!w || !isDone(w)) return false;
      const k2 = WALL_TYPE_BY_ID.get(w.type);
      const half2 = (k2?.railed ? FENCE_THICK : WALL_THICK) * (k2?.thick ?? 1);
      return this.r.standing(w, b) >= tall - 1e-6 && half2 >= half - 1e-9;
    };
    /*
     * What this wall meets at each end, and so where its face and its top
     * stop.
     *
     * A section is a box one border long and a wall's thickness deep, and two
     * boxes meeting at a corner neither cover the square the corner is nor
     * leave it alone: each overlaps the other in one quarter of it and the
     * quarter at the arris is left open, with the end grain of one of them
     * showing in the notch -- a post of another colour down every corner. So
     * each end looks at the walls square to it there, finished and standing
     * at least as tall as this one: one on the camera's side (`near`) is a
     * wall this one's face runs into, and the face stops at its face; one
     * only on the far side is a corner this face turns, and it runs on to the
     * arris. The top is one wall's at a corner: the one running east and west
     * carries its top over the corner and the other's stops at it; at a T it
     * is the through wall's, at a cross the east-west run's. A lower wall that
     * meets a taller one square stops at its face, top and all, whatever
     * else is there. And an end shows only where nothing covers it and it
     * faces the camera: turned away it lies behind the face, and drawn after
     * it, it was a strip of end grain laid over the face's end.
     */
    const crossAt = (i: -1 | 1, near: boolean): { h: number; st: number; lid: boolean } | null => {
      const t = i < 0 ? 0 : 1;
      const cx = border.dir === 'h' ? border.x + t : border.x;
      const cy = border.dir === 'h' ? border.y : border.y + t;
      const mine = near === toward > 0;
      const b: Border = border.dir === 'h'
        ? { dir: 'v', x: cx, y: mine ? cy : cy - 1 }
        : { dir: 'h', x: mine ? cx - 1 : cx, y: cy };
      const w = this.r.game.buildings.wallOnBorder(wall.level, b);
      if (!w || !isDone(w)) return null;
      const k2 = WALL_TYPE_BY_ID.get(w.type);
      return { h: (k2?.railed ? FENCE_THICK : WALL_THICK) * (k2?.thick ?? 1), st: this.r.standing(w, b), lid: this.capHidden(w, b) };
    };
    /** Whether this wall's own top is under the storey stood on it, and so carries no cap. */
    const hidden = this.capHidden(wall, border);
    /** And the finished wall carrying on in line past the `i` end, of whatever size. */
    const lineAt = (i: -1 | 1): { h: number; st: number } | null => {
      const b: Border = border.dir === 'h'
        ? { dir: 'h', x: border.x + i, y: border.y }
        : { dir: 'v', x: border.x, y: border.y + i };
      const w = this.r.game.buildings.wallOnBorder(wall.level, b);
      if (!w || !isDone(w)) return null;
      const k2 = WALL_TYPE_BY_ID.get(w.type);
      return { h: (k2?.railed ? FENCE_THICK : WALL_THICK) * (k2?.thick ?? 1), st: this.r.standing(w, b) };
    };
    /*
     * Walls of two heights. A lower wall that comes up to a taller one stops
     * at its face, wherever it meets it. And where a taller wall's end has
     * nothing as tall at it and nothing carrying on from it, but lower walls
     * come up to it square -- a half wall at the corner of a fence, or into
     * the side of a run of one -- its body goes on past the end through
     * their thickness (`past`), so that it is the taller one that fills the
     * angle. It stopped on the lower wall's centre line, and with the lower
     * one stopped at its face that left a slot half a fence thick with the
     * grass showing through it.
     */
    const joins = ([-1, 1] as const).map((i) => {
      const near = crossAt(i, true), far = crossAt(i, false), line = lineAt(i);
      const big = (j: { h: number; st: number; lid: boolean } | null): { h: number; up: boolean; lid: boolean } | null =>
        j && j.st >= tall - 1e-6 ? { h: j.h, up: j.st > tall + 1e-6, lid: j.lid } : null;
      const P = big(near), Q = big(far), n = on(i);
      const past = !n && !P && !Q && !line ? Math.max(near?.h ?? 0, far?.h ?? 0) : 0;
      const up = Math.max(P?.up ? P.h : 0, Q?.up ? Q.h : 0);
      /*
       * Which of the two walls at a plain corner -- one wall square to this
       * one and nothing carrying on past either -- carries the top over the
       * square the corner is: the one running east and west, unless a storey
       * stands on it and none on the other, when the other does. Left to the
       * one whose top the storey over it covers, the square was covered by
       * neither: a hole in the head of the wall at every corner of a storey
       * set back from the one under it.
       */
      const R = !past && !up && !n && !(P && Q) ? P ?? Q : null;
      const owns = !!R && (border.dir === 'h' ? !(hidden && !R.lid) : R.lid && !hidden);
      /*
       * And the half-length of the stone over the square at this end, where
       * this wall's top covers it: at a corner it owns, the corner's; where
       * it runs on through a T, or east and west through a cross, the
       * junction's, which the cap of the wall coming into it stops at. Each
       * section of a run through lays the same stone in the same place.
       */
      const stone = owns && R ? R.h
        : n && !past && !up && (P || Q) && (!(P && Q) || border.dir === 'h') ? Math.max(P?.h ?? 0, Q?.h ?? 0) : 0;
      return { i, n, P, Q, line, past, up, R, owns, stone };
    });
    const joinAt = (i: -1 | 1): (typeof joins)[number] => joins[i < 0 ? 0 : 1];
    /** Where the face on the camera's side stops at the `i` end, along the run. */
    const faceEnd = (i: -1 | 1): number => {
      const edge = i < 0 ? 0 : 1, { n, P, Q, up, past } = joinAt(i);
      if (past) return edge + i * past;
      if (up) return edge - i * up;
      if (n) return edge;
      if (P) return edge - i * P.h;
      if (Q) return edge + i * Q.h;
      return edge;
    };
    /** And where the top stops. */
    const capEnd = (i: -1 | 1): number => {
      const edge = i < 0 ? 0 : 1, { n, P, Q, up, past } = joinAt(i);
      if (past) return edge + i * past;
      if (up) return edge - i * up;
      if (P && Q) return n && border.dir === 'h' ? edge : edge - i * Math.max(P.h, Q.h);
      const { R, owns } = joinAt(i);
      if (!R) return edge;
      return owns ? edge + i * R.h : edge - i * R.h;
    };
    /** Whether the `i` end turns toward the camera. */
    const facing = (i: -1 | 1): boolean => (cam.rotateX(dx, dy) + cam.rotateY(dx, dy)) * i > 1e-6;
    /** Whether the end grain at the `i` end is there to be seen. */
    const endShows = (i: -1 | 1): boolean => {
      const { n, P, Q, up } = joinAt(i);
      return !n && !P && !Q && !up && facing(i);
    };
    /**
     * The part of an end still to be seen where it stops at the face of a
     * taller wall that meets it from one side only, beside a taller but
     * thinner wall carrying on in line -- a half wall run on from the corner
     * of a house, which is thicker than the house's wall: the edge of its end
     * stands out past the house's corner, and left undrawn it was a slit of
     * grass. As a span across the end, or null.
     */
    const proud = (i: -1 | 1): [number, number] | null => {
      const { P, Q, up, line } = joinAt(i);
      if (!up || (P && Q) || !line || line.st <= tall + 1e-6 || line.h >= half - 1e-9 || !facing(i)) return null;
      return P ? [-1, -line.h / half] : [line.h / half, 1];
    };
    ctx.globalAlpha = alpha;
    /*
     * Glass let go in front of the room you are in is a breath of its colour
     * and the line of its frame. Drawn faint in full, its lead and its marble
     * were a cage laid over everything in the room.
     */
    if (done && alpha < 1 && bare.seeThrough) {
      quad(0, 1, 0, 1);
      ctx.fillStyle = rgb(mat.color, lit, 0.4);
      ctx.fill();
      ctx.strokeStyle = rgb(mat.trim, lit, 0.9);
      ctx.lineWidth = Math.max(0.75, 0.75 * zoom);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      return;
    }
    if (!done && wall.type === 'railing') {
      /*
       * A railing going up: inside the outline of the whole of it, at its
       * height, its posts go in first, with the first quarter of the
       * materials, and then its rails and balusters from one end along to
       * the other as the rest go in.
       */
      quad(0, 1, 0, 1);
      ctx.fillStyle = rgb(mat.color, lit, 0.08);
      ctx.fill();
      ctx.strokeStyle = PLAN_COLOR;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const progress = progressOf(wall);
      if (progress > 0) {
        const ends = this.railEnds(wall, border);
        const along = Math.max(0, (progress - 0.25) / 0.75);
        const c0 = ends.cut[0], c1 = 1 - ends.cut[1];
        ends.cut = [c0, 1 - (c0 + (c1 - c0) * along)];
        drawRailing(ctx, cam, border, h0, wall.material, ends, alpha, wall.dye ? mat.color : undefined, this.r.canvas.dpr);
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (!done) {
      /*
       * A plan, and then a plan filling. It keeps the thickness — a wall that
       * grew a body the moment its last plank went in would jump — but the
       * body is only drawn as far up as the materials have reached.
       */
      const progress = progressOf(wall);
      if (progress > 0) {
        quad(0, 1, 0, progress);
        ctx.fillStyle = rgb(mat.color, lit, 0.9);
        ctx.fill();
        cap(0, 1, progress);
        ctx.fillStyle = rgb(mat.color, topLit, 0.9);
        ctx.fill();
      }
      quad(0, 1, progress, 1);
      ctx.fillStyle = rgb(mat.color, lit, 0.18);
      ctx.fill();
      quad(0, 1, 0, 1);
      ctx.strokeStyle = PLAN_COLOR;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }
    // A railing is a run of rail and balusters on posts, in a drawing of its own (`framing.ts`).
    if (wall.type === 'railing') {
      drawRailing(ctx, cam, border, h0, wall.material, this.railEnds(wall, border), alpha, wall.dye ? mat.color : undefined, this.r.canvas.dpr);
      ctx.globalAlpha = 1;
      return;
    }
    if (kind?.railed && !cob) {
      /*
       * Posts and rails, each of them a piece of timber with a top to it: a
       * fence drawn flat is a comb, and a comb is what this was.
       *
       * A fence in paint only: every masonry has a garden wall of its own,
       * drawn below, and a stone fence is not posts and rails -- it is a wall
       * you can see over.
       *
       * A post stands at each end of a section and one halfway along, square
       * and a tenth of a tile across, the ones at the ends centred on the
       * corner of the tile. Where sections meet -- in a run, at a corner, at a
       * T -- each of them draws the same post in the same place, and the
       * joint has one post. Each section's end posts stood a hand's breadth
       * in from its own ends, and every joint was a pair of posts side by
       * side. Where the fence runs into a wall, the wall is the post: the
       * rails stop at its face and no post is drawn inside it.
       */
      const P = 0.05, S = P / half;
      const bld = this.r.game.buildings;
      const rail = (w: Wall): boolean => !!WALL_TYPE_BY_ID.get(w.type)?.railed && !this.r.masonryOf(w);
      /** Whether anything but more of this fence meets the `i` end. */
      const walled = (i: -1 | 1): boolean => {
        const t = i < 0 ? 0 : 1, cx = ax + dx * t, cy = ay + dy * t;
        const round = [
          { dir: 'h', x: cx - 1, y: cy }, { dir: 'h', x: cx, y: cy }, { dir: 'v', x: cx, y: cy - 1 }, { dir: 'v', x: cx, y: cy },
        ] as Border[];
        return round.some((b) => {
          if (b.dir === border.dir && b.x === border.x && b.y === border.y) return false;
          const w = bld.wallOnBorder(wall.level, b);
          return !!w && isDone(w) && !rail(w);
        });
      };
      // Which end of a post turns toward the camera, lit as a face running the other way.
      const toCam = cam.rotateX(dx, dy) + cam.rotateY(dx, dy);
      const post = (t: number): void => {
        const t0 = t - P, t1 = t + P;
        quad(t0, t1, 0, 1, S);
        ctx.fillStyle = rgb(mat.color, lit);
        ctx.fill();
        ctx.strokeStyle = rgb(mat.trim, lit * 0.9);
        ctx.stroke();
        if (Math.abs(toCam) > 1e-6) {
          const te = toCam > 0 ? t1 : t0;
          ctx.beginPath();
          ctx.moveTo(px(te, 0, S), py(te, 0, S));
          ctx.lineTo(px(te, 0, -S), py(te, 0, -S));
          ctx.lineTo(px(te, 1, -S), py(te, 1, -S));
          ctx.lineTo(px(te, 1, S), py(te, 1, S));
          ctx.closePath();
          ctx.fillStyle = rgb(mat.color, endLit);
          ctx.fill();
          ctx.strokeStyle = rgb(mat.trim, endLit * 0.9);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(px(t0, 1, S), py(t0, 1, S));
        ctx.lineTo(px(t1, 1, S), py(t1, 1, S));
        ctx.lineTo(px(t1, 1, -S), py(t1, 1, -S));
        ctx.lineTo(px(t0, 1, -S), py(t0, 1, -S));
        ctx.closePath();
        ctx.fillStyle = rgb(mat.color, topLit);
        ctx.fill();
        ctx.strokeStyle = rgb(mat.trim, lit * 0.9);
        ctx.stroke();
      };
      const R0 = faceEnd(-1), R1 = faceEnd(1);
      for (const [k0, k1] of [[0.3, 0.45], [0.7, 0.85]] as Array<[number, number]>) {
        quad(R0, R1, k0, k1);
        ctx.fillStyle = rgb(mat.color, lit * 0.92);
        ctx.fill();
        ctx.strokeStyle = rgb(mat.trim, lit * 0.85);
        ctx.stroke();
        cap(R0, R1, k1);
        ctx.fillStyle = rgb(mat.color, topLit * 0.94);
        ctx.fill();
      }
      if (!walled(-1)) post(0);
      post(0.5);
      if (!walled(1)) post(1);
      if (wall.type === 'fence_gate' || wall.type === 'iron_gate') {
        // The leaf hangs behind the posts, which is what the recess says.
        const iron = wall.type === 'iron_gate';
        quad(0.07, 0.43, 0.06, 0.94, -0.4);
        ctx.fillStyle = rgb(iron ? [72, 74, 80] : mat.floor, lit, 0.9);
        ctx.fill();
        ctx.strokeStyle = rgb(iron ? [40, 42, 48] : mat.trim, lit);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px(0.09, 0.1, -0.4), py(0.09, 0.1, -0.4));
        ctx.lineTo(px(0.41, 0.9, -0.4), py(0.41, 0.9, -0.4));
        ctx.stroke();
        if (iron) {
          // Two straps across it, which is where the iron actually is.
          ctx.lineWidth = Math.max(1.5, 2.4 * zoom);
          ctx.strokeStyle = rgb([54, 56, 62], lit);
          for (const k of [0.24, 0.76]) {
            ctx.beginPath();
            ctx.moveTo(px(0.07, k, -0.4), py(0.07, k, -0.4));
            ctx.lineTo(px(0.43, k, -0.4), py(0.43, k, -0.4));
            ctx.stroke();
          }
          ctx.lineWidth = 1;
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    /*
     * Cobblestone is painted rather than ruled. It is the cheap masonry and the
     * first a novice lays, so its picture is of a wall that shows it: blocks of
     * no two sizes, joints of no two widths, courses that wander, and the
     * chips, cracks and damp of a thing that has stood a while. What grows on
     * it depends on where in the wall the face is, which is why it is three
     * pictures and not one -- the hedge and the damp belong to the storey that
     * meets the ground, the ivy to the one with nothing above it, and neither
     * belongs to a face looking into somebody's room.
     *
     * A painted wall is left to the flat colours below: the picture has its own
     * stone in it, and a coat of paint over that would be two walls at once.
     */
    if (cob) {
      const bld = this.r.game.buildings;
      /** Which of the five, by where the wall is: neighbours differ, and a wall keeps its own. */
      const v = cob.scatter ? scatterOf(border, wall.level, cob.face.length)
        : Math.abs(border.x * 31 + border.y * 17 + wall.level * 7) % cob.face.length;
      const up = bld.wallOnBorder(wall.level + 1, border);
      const roofed = !!up && isDone(up);
      /**
       * And that storey's wall where it is drawn over this one's head: not
       * where looking at one storey lifts it off (`storeyHidden`), which
       * leaves the top in sight to be capped (`capHidden`). What grows on the
       * head and how the head is shaped go by `roofed`, the wall as built.
       */
      const over = roofed && !this.r.storeyHidden(wall.level + 1) ? up : undefined;
      /*
       * The tile the camera is on this side of. A border runs along the top of
       * its own tile or down its left, so which tile that is depends on the
       * side, and that is what `toward` already worked out.
       */
      const seenX = border.dir === 'h' ? border.x : (toward > 0 ? border.x - 1 : border.x);
      const seenY = border.dir === 'h' ? (toward > 0 ? border.y : border.y - 1) : border.y;
      const indoors = !!bld.buildingAt(seenX, seenY);
      // A ground-floor wall standing on the deck of a tile on piers is out of reach of the ground: nothing grows up it from there, and no damp.
      const aloft = wall.level === 0 && bld.pierTiles.size > 0
        && (bld.onPiers(border.x, border.y) || bld.onPiers(border.dir === 'h' ? border.x : border.x - 1, border.dir === 'h' ? border.y - 1 : border.y));
      /**
       * A finished wall of the same kind standing square to this one at its
       * `i` end, on the camera's side of it (`near`) or the far side, and as
       * tall and as thick as this one. A fence square to the end of a half
       * wall does not bury the end: it stands lower and thinner, and the end
       * left undrawn over it showed the grass under the half wall's cap.
       */
      const square = (i: -1 | 1, near: boolean): boolean => {
        const t = i < 0 ? 0 : 1;
        const cx = border.dir === 'h' ? border.x + t : border.x;
        const cy = border.dir === 'h' ? border.y : border.y + t;
        const mine = near === toward > 0;
        const b: Border = border.dir === 'h'
          ? { dir: 'v', x: cx, y: mine ? cy : cy - 1 }
          : { dir: 'h', x: mine ? cx - 1 : cx, y: cy };
        const w = bld.wallOnBorder(wall.level, b);
        if (!w || !isDone(w)) return false;
        const k2 = WALL_TYPE_BY_ID.get(w.type);
        if (!!k2?.low !== !!kind?.low) return false;
        const half2 = (k2?.railed ? FENCE_THICK : WALL_THICK) * (k2?.thick ?? 1);
        return this.r.standing(w, b) >= tall - 1e-6 && half2 >= half - 1e-9;
      };
      /*
       * Where the run turns a corner away from the camera the face is carried
       * on past its end by the thickness of the wall that turns there, to meet
       * that wall's own face carried on the same way, and the picture goes
       * round with it; where it runs into a wall on the camera's side it stops
       * at that wall's face (see `faceEnd`). Stopped at the border, the two
       * left the angle between their ends showing -- a notch the depth of the
       * wall, which with its end grain in it was a post of another colour
       * down every corner.
       */
      const T0 = faceEnd(-1), T1 = faceEnd(1);
      const e0 = Math.max(0, -T0), e1 = Math.max(0, T1 - 1);
      /** Where the top stops, at either end. */
      const C0 = capEnd(-1), C1 = capEnd(1);
      /** A garden wall's pictures, at the height it stands to, and whether a gate hangs in it. */
      const lw = kind?.low ? cob.low(tall) : undefined;
      const hung = wall.type === 'fence_gate' || wall.type === 'iron_gate';
      /*
       * The head of the wall, on a masonry laid by hand, where nothing stands
       * on it: how far it rises over its line at `t`, as a share of the
       * height the picture is painted to -- the variant's crest, or on a
       * garden wall its pillows and the domes of a gate's piers -- and
       * nothing at either end, so a head runs on into the next section's.
       */
      const topTones = cob.top ?? { lit: cob.hi, hi: cob.hi, shade: cob.hi };
      const heads = !cob.soft || roofed ? undefined
        : lw ? (hung ? lw.gateCrest : lw.crest)?.[v] : cob.crest?.[v];
      const headPx = lw ? lw.h : cob.h;
      const rise = (t: number): number => {
        if (!heads || t <= 0 || t >= 1) return 0;
        const f = t * (heads.length - 1), i = Math.floor(f), u = f - i;
        return (heads[i] * (1 - u) + heads[Math.min(i + 1, heads.length - 1)] * u) / headPx;
      };
      /** The points from `a` to `b` a head is drawn through: the two ends, and every point its crest is given at between. */
      const ticks = (a: number, b: number): number[] => {
        const out = [a];
        if (heads) {
          const n = heads.length - 1;
          for (let i = 1; i < n; i++) if (i / n > a && i / n < b) out.push(i / n);
        }
        out.push(b);
        return out;
      };
      /** A picture, between three of its corners: top left, top right, bottom left. */
      const dpr = this.r.canvas.dpr;
      /** A point's distance along the face on whole device pixels: a face's ends are true verticals on screen. */
      const snapX = (t: number): number => Math.round(px(t, 0) * dpr) / dpr;
      /** A device pixel, as a share of the section's length on screen. */
      const hair = 1 / Math.max(1, Math.abs(px(1, 0) - px(0, 0)) * dpr);
      /**
       * Whether this face's pictures go on the other way round: on a masonry
       * painted with its light on the left, a face that runs right to left on
       * screen, which is the face turned from the light.
       */
      const turned = !!cob.handed && px(1, 0) < px(0, 0);
      /**
       * A picture laid from `shift` to `shift + 1` along the run: `flip` lays
       * it the other way round, and `spread` runs it a hair past both ends.
       */
      const lay = (img: HTMLCanvasElement, k0: number, k1: number, s: number, across: boolean, over: number, spread: number, shift = 0, flip = false): void => {
        // `over` hangs the far edge of an `across` picture past the back arris,
        // which is where a cope stone standing proud of the run has to go.
        const far = -(1 + 2 * over);
        // `spread` runs a face picture a hair past both ends of the section, for
        // a picture whose ends are not the coat's own flat tone: its half-drawn
        // edge would otherwise show the paler face under it down every seam.
        const t0 = shift + (flip ? 1 + spread : -spread), t1 = shift + (flip ? -spread : 1 + spread);
        const [a0, a1] = flip ? [shift + 1, shift] : [shift, shift + 1];
        const [tlx, tly] = across ? [px(a0, k1, far), py(a0, k1, far)] : [px(t0, k1, s), py(t0, k1, s)];
        const [trx, try_] = across
          ? [px(a1, k1, far), py(a1, k1, far)]
          : [px(t1, k1, s), py(t1, k1, s)];
        const [blx, bly] = across ? [px(a0, k1, 1), py(a0, k1, 1)] : [px(t0, k0, s), py(t0, k0, s)];
        ctx.save();
        /*
         * Reported: "some wall tops still glitched." A dotted edge down the
         * back of a cap and a ladder of dots for every joint across it: a
         * cap's picture is `capH` pixels from its back edge to its front,
         * put down in a few pixels of the screen, its joints a pixel or two
         * wide, and sampled straight off the picture that far down a joint
         * came out on one pixel in two. Laid over the top, a picture is
         * taken down with every pixel of it counted, as a shrunk picture is.
         */
        if (across) ctx.imageSmoothingQuality = 'high';
        ctx.transform(
          (trx - tlx) / img.width, (try_ - tly) / img.width,
          (blx - tlx) / img.height, (bly - tly) / img.height,
          tlx, tly,
        );
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      };
      /** Everything on screen between two points along the face, for a clip. */
      const strip = (x0: number, x1: number): void => {
        ctx.beginPath();
        ctx.rect(Math.min(x0, x1), -1e5, Math.abs(x1 - x0), 2e5);
      };
      /** The top of the wall between two points along it, out to `far` past the back arris. */
      const lid = (t0: number, t1: number, far: number): void => {
        ctx.beginPath();
        ctx.moveTo(px(t0, 1, 1), py(t0, 1, 1));
        ctx.lineTo(px(t1, 1, 1), py(t1, 1, 1));
        ctx.lineTo(px(t1, 1, far), py(t1, 1, far));
        ctx.lineTo(px(t0, 1, far), py(t0, 1, far));
        ctx.closePath();
      };
      /** A picture laid flat over the top from `a` to `b` along it, back edge at its top, front edge at its bottom. */
      const capStone = (img: HTMLCanvasElement, a: number, b: number, far = -1): void => {
        const tlx = px(a, 1, far), tly = py(a, 1, far);
        ctx.save();
        // Taken down with every pixel of it counted, as a cap's picture is (`lay`).
        ctx.imageSmoothingQuality = 'high';
        ctx.transform((px(b, 1, far) - tlx) / img.width, (py(b, 1, far) - tly) / img.width,
          (px(a, 1, 1) - tlx) / img.height, (py(a, 1, 1) - tly) / img.height, tlx, tly);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      };
      /**
       * A picture over the section.
       *
       * On a masonry laid under a flat colour it goes on between the face's
       * two ends on whole device pixels, a device pixel past both so nothing
       * of the colour under it shows along an end, and not a hair past them
       * into the section beside it. Drawn anywhere else its ends are half
       * covered: the section drawn second lays a half pixel of unlit picture
       * over the lit one before it, and down a shaded face that is a pale
       * line every four metres. Where the face is carried round a corner the
       * same picture is laid again past that end, cut to it -- the seams
       * already promise that a section's own edges run on into each other.
       * `round` says whether a picture goes round: a beam end does not.
       */
      const blit = (img: HTMLCanvasElement, k0: number, k1: number, s = 1, across = false, over = 0, spread = 0, flip = false, round = true): void => {
        // A section whose ends are whole, on a masonry laid with no colour
        // under it, goes on as it always has. Anything stopped short or
        // carried round at a junction is cut to it.
        const junction = across ? C0 !== 0 || C1 !== 1 : T0 !== 0 || T1 !== 1;
        if (!cob.under && !junction) { lay(img, k0, k1, s, across, over, spread, 0, flip); return; }
        if (across) {
          const far = -(1 + 2 * over);
          ctx.save(); lid(Math.max(C0, 0), Math.min(C1, 1), far); ctx.clip();
          lay(img, k0, k1, s, true, over, 0);
          ctx.restore();
          for (const [a, b, shift] of [[C0, 0, -1], [1, C1, 1]] as Array<[number, number, number]>) {
            if (b - a <= 1e-9 || !round) continue;
            ctx.save(); lid(a, b, far); ctx.clip();
            lay(img, k0, k1, s, true, over, 0, shift);
            ctx.restore();
          }
          return;
        }
        const sp = Math.max(spread, hair);
        ctx.save(); strip(snapX(T0), snapX(T1)); ctx.clip();
        lay(img, k0, k1, s, false, 0, sp, 0, flip);
        ctx.restore();
        for (const [e, a, b, shift] of [[e0, T0, 0, -1], [e1, 1, T1, 1]] as Array<[number, number, number, number]>) {
          if (!e || !round) continue;
          ctx.save(); strip(snapX(a), snapX(b)); ctx.clip();
          lay(img, k0, k1, s, false, 0, sp, shift, flip);
          ctx.restore();
        }
      };
      /** And the hour's light over it, laid the way the flat colours take it. */
      /*
       * The face again, with its two ends on whole device pixels.
       *
       * A face's ends are true verticals on screen -- a point's height moves
       * it up the screen and never across -- so on a whole pixel two sections
       * meet with nothing between them and nothing doubled. Drawn anywhere
       * else each end is half-covered, and the hour's shade laid over two of
       * them leaves a pale hairline down the seam: nothing on stone or brick,
       * where the joints swallow it, and a ruled line every four metres down
       * a coat of mud. Only the masonries that ask for an under-colour take
       * this path, so the others draw exactly as they did.
       */
      const flush = (t0: number, t1: number, k0: number, k1: number): void => {
        const sx = (t: number): number => (t === 0 || t === 1 || t === T0 || t === T1 ? snapX(t) : px(t, 0));
        const x0 = sx(t0), x1 = sx(t1);
        ctx.beginPath();
        ctx.moveTo(x0, py(t0, k0)); ctx.lineTo(x1, py(t1, k0));
        ctx.lineTo(x1, py(t1, k1)); ctx.lineTo(x0, py(t0, k1));
        ctx.closePath();
      };
      /*
       * And the foot of a storey stood on another is laid a device pixel down
       * over the head of the one under it. The floor line is not a vertical
       * and cannot be put on whole pixels, so each storey half covers the
       * row it falls in and the hour's shade over the two leaves that row
       * paler than either: a ruled line across a coat of mud at every floor.
       * The lower storey is drawn first, so the upper one's colour and shade
       * cover the row outright and only its own edge, a row lower, is shared.
       */
      const below = wall.level > 0 ? bld.wallOnBorder(wall.level - 1, border) : undefined;
      const sunk = cob.under && below && isDone(below) ? 1 / Math.max(1, (py(0, 0) - py(0, 1)) * dpr) : 0;
      /** The face, with its ends on whole device pixels and its head along the crest. */
      const hull = (k0: number): void => {
        const sx = (t: number): number => (t === T0 || t === T1 ? snapX(t) : px(t, 0));
        const ts = ticks(T0, T1);
        ctx.beginPath();
        ctx.moveTo(sx(T0), py(T0, k0)); ctx.lineTo(sx(T1), py(T1, k0));
        for (let i = ts.length - 1; i >= 0; i--) ctx.lineTo(sx(ts[i]), py(ts[i], 1 + rise(ts[i])));
        ctx.closePath();
      };
      // From end to end of the face as drawn: carried round a corner past the
      // section's own end, the strip past it was left out of the hour's shade,
      // a pale post down every corner of a face turned from the light.
      const face = (): void => { if (cob.under) hull(-sunk); else flush(T0, T1, 0, 1); };
      /** The head where it rises over its line: the coat rolled over the top, in the top's own tone. */
      const crown = (): void => {
        if (!heads) return;
        const ts = ticks(0, 1);
        ctx.beginPath();
        for (const t of ts) ctx.lineTo(px(t, 0), py(t, 1 + rise(t)));
        for (let i = ts.length - 1; i >= 0; i--) ctx.lineTo(px(ts[i], 0), py(ts[i], 1));
        ctx.closePath();
        ctx.fillStyle = rgb(topTones.lit, 1);
        ctx.fill();
      };
      /** A colour as the hour lights a face at `k`, laid flat rather than shaded over. */
      const tint = (c: readonly [number, number, number], k: number, a = 1): string => {
        const f = cob.shadow(k), [sr, sg, sb] = cob.shade;
        return `rgba(${(c[0] * (1 - f) + sr * f) | 0},${(c[1] * (1 - f) + sg * f) | 0},${(c[2] * (1 - f) + sb * f) | 0},${a})`;
      };
      /**
       * The top of a wall laid by hand, between `a` and `b` along its head: the
       * coat turned up at the sky, its far slope a step down from its crown and
       * a line of light along the crown itself. Laid in the hour's light rather
       * than shaded over, and a device pixel past each end, so two tops meet
       * with nothing showing between them and nothing doubled. A device pixel
       * down the screen as well as across it: on a wall seen end on, which is
       * no width across, a pixel across was the whole of a section, and the
       * top of each side wall stood up past the back of the house like a pole.
       */
      const top = (a: number, b: number, k: number): void => {
        const over = Math.min(hair, 1 / Math.max(1, Math.abs(py(1, 0) - py(0, 0)) * dpr));
        const ts = [a - over, ...ticks(a, b).slice(1, -1), b + over];
        const at = (t: number, s: number): [number, number] => [px(t, 1 + rise(t), s), py(t, 1 + rise(t), s)];
        const band = (s0: number, s1: number): void => {
          ctx.beginPath();
          for (const t of ts) ctx.lineTo(...at(t, s0));
          for (let i = ts.length - 1; i >= 0; i--) ctx.lineTo(...at(ts[i], s1));
          ctx.closePath();
        };
        band(1, -1); ctx.fillStyle = tint(topTones.lit, k); ctx.fill();
        band(-0.2, -1); ctx.fillStyle = tint(topTones.shade, k, 0.8); ctx.fill();
        ctx.beginPath();
        for (const t of ts) ctx.lineTo(...at(t, 0.25));
        ctx.strokeStyle = tint(topTones.hi, k, 0.9); ctx.lineWidth = Math.max(0.6, 0.9 * zoom); ctx.stroke();
        ctx.lineWidth = 1;
      };
      /**
       * The coat rolled round an arris, on this face's side of it: nearest the
       * corner a step between this face's light and the light of the face
       * round it, and on the lighter of the two a line of light beside that,
       * wandering a little up the height and swelling where it meets the
       * ground and where it goes over the head. A ruled strip of light down a
       * corner was the edge of a box.
       */
      const roll = (T: number, other: number): void => {
        const aT = cob.shadow(lit), aO = cob.shadow(other), mid = (aT + aO) / 2;
        const x0 = snapX(T), dir = Math.sign(px(0.5, 0) - px(T, 0)) || 1;
        const w = Math.max(0.75, zoom);
        // It swells where it meets the ground and where it goes over the head,
        // and nowhere between storeys, where it runs on up the next.
        const foot = wall.level === 0 ? 1 : 0, head = roofed ? 0 : 1;
        const wob = (k: number): number => 1 + 0.6 * (foot * (1 - k) ** 8 + head * k ** 8) + 0.25 * Math.sin(k * 11 + (border.x + border.y) * 1.7 + T * 5);
        const band = (o0: number, o1: number, fill: string): void => {
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) ctx.lineTo(x0 + dir * o1 * wob(i / 12), py(T, i / 12));
          for (let i = 12; i >= 0; i--) ctx.lineTo(x0 + dir * o0 * wob(i / 12), py(T, i / 12));
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
        };
        const [sr, sg, sb] = cob.shade;
        if (aT < aO - 1e-3) {
          band(0, w, `rgba(${sr}, ${sg}, ${sb}, ${((mid - aT) / (1 - aT)).toFixed(3)})`);
          band(w, 2 * w, rgb(cob.hi, 1, 0.35));
        } else if (aT > aO + 1e-3) {
          band(0, w, rgb(cob.under ?? cob.hi, 1, Math.max(0, 1 - mid / aT)));
        }
      };
      /** And the end's own side of it, on the end grain nearest the face. */
      const endRoll = (t: number): void => {
        const aE = cob.shadow(endLit), aM = cob.shadow(lit), mid = (aE + aM) / 2;
        ctx.beginPath();
        ctx.moveTo(px(t, 0, 1), py(t, 0, 1)); ctx.lineTo(px(t, 0, 0.3), py(t, 0, 0.3));
        ctx.lineTo(px(t, 1, 0.3), py(t, 1, 0.3)); ctx.lineTo(px(t, 1, 1), py(t, 1, 1));
        ctx.closePath();
        const [sr, sg, sb] = cob.shade;
        ctx.fillStyle = aE > aM ? rgb(cob.under ?? cob.hi, 1, Math.max(0, 1 - mid / aE))
          : `rgba(${sr}, ${sg}, ${sb}, ${((mid - aE) / (1 - aE)).toFixed(3)})`;
        ctx.fill();
      };
      /**
       * A room with no roof on it is still in the shade of its own walls: an
       * inside face is a step under the same face outside, and deeper toward
       * the floor, where the far wall's shadow lies across it. Lit as the
       * outside was, the house read as one card with a line across it.
       */
      const inside = (): void => {
        const [sr, sg, sb] = cob.shade;
        const g = ctx.createLinearGradient(0, py(0.5, 1), 0, py(0.5, 0));
        g.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, 0.06)`);
        g.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0.2)`);
        hull(-sunk);
        ctx.fillStyle = g;
        ctx.fill();
      };
      /** A picture laid on the face with its top left `u`, `v` picture px into a section `H` px tall, turned round if `flip`. */
      const patch = (img: HTMLCanvasElement, u: number, v0: number, H: number, flip = false): void => {
        const ta = u / cob.w, tb = (u + img.width) / cob.w;
        const k1 = 1 - v0 / H, k0 = 1 - (v0 + img.height) / H;
        const [a, b] = flip ? [tb, ta] : [ta, tb];
        const tlx = px(a, k1), tly = py(a, k1);
        ctx.save();
        // Cut to the face, top and bottom as well as at its ends: the courses
        // a loss at the foot has under it for the foot to cover went on down
        // past the bottom of the wall onto the grass.
        hull(0); ctx.clip();
        ctx.transform((px(b, k1) - tlx) / img.width, (py(b, k1) - tly) / img.width, (px(a, k0) - tlx) / img.height, (py(a, k0) - tly) / img.height, tlx, tly);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      };
      /**
       * A frame's post at each end of the section that turns a corner or
       * stops, or a log wall's crossing at a corner, its picture laid from
       * `k0` to `k1` up the face and shown only above `from`: over the face
       * carried round the corner and the half of the end post the section has
       * of its own, its outer edge on the corner. Without it the corner was
       * the ends of two sections' posts with a strip of the limewash they were
       * painted on between them -- a pale line down the one place a frame is
       * heaviest. A wall running the other way takes `alt`, where there is
       * one: the logs of the two walls at a corner cross turn about.
       */
      const posts = (post: { img: HTMLCanvasElement; alt?: HTMLCanvasElement }, k0: number, k1: number, from: number): void => {
        if (!cob.post || indoors) return;
        const img = post.alt && border.dir === 'v' ? post.alt : post.img;
        const w = half + cob.post.reach / cob.w;
        for (const [i, e, T] of [[-1, e0, T0], [1, e1, T1]] as Array<[-1 | 1, number, number]>) {
          if (on(i) || (!e && (!cob.post.free || square(i, true) || square(i, false)))) continue;
          // From the outer edge in, a device pixel past the corner so the
          // edge is oak however the corner falls on the pixels.
          const [a, b] = i < 0 ? [T - hair, T + w] : [T + hair, T - w];
          ctx.save();
          strip(snapX(T0), snapX(T1)); ctx.clip();
          ctx.beginPath();
          ctx.moveTo(px(a, from), py(a, from)); ctx.lineTo(px(b, from), py(b, from));
          ctx.lineTo(px(b, 1), py(b, 1)); ctx.lineTo(px(a, 1), py(a, 1));
          ctx.closePath(); ctx.clip();
          const tlx = px(a, k1), tly = py(a, k1);
          ctx.transform((px(b, k1) - tlx) / img.width, (py(b, k1) - tly) / img.width, (px(a, k0) - tlx) / img.height, (py(a, k0) - tly) / img.height, tlx, tly);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }
      };
      /**
       * On polished metal, the brightest of a picture laid again over the
       * shade, from `from` up the face -- but not where a post stands over
       * the face at a corner or a free end, nor over the foot of a ground
       * storey: laid over those, the face's own lights came through them.
       */
      const gleamed = (img: HTMLCanvasElement, from: number, flip: boolean, spread = 0, H = 1): void => {
        if (!cob.gleam) return;
        let a = T0, b = T1;
        if (cob.post && !indoors) {
          const w = half + cob.post.reach / cob.w;
          for (const [i, e] of [[-1, e0], [1, e1]] as Array<[-1 | 1, number]>) {
            if (on(i) || (!e && (!cob.post.free || square(i, true) || square(i, false)))) continue;
            if (i < 0) a = T0 + w; else b = T1 - w;
          }
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px(a, from), py(a, from)); ctx.lineTo(px(b, from), py(b, from));
        ctx.lineTo(px(b, H + 0.3), py(b, H + 0.3)); ctx.lineTo(px(a, H + 0.3), py(a, H + 0.3));
        ctx.closePath(); ctx.clip();
        blit(cob.gleam(img), 0, H, 1, false, 0, spread, flip);
        ctx.restore();
      };
      /**
       * Where the weather has taken the coat off this section, out of doors.
       *
       * Not everywhere: on a section in two or three, and where the water
       * and the wear go. Off a corner, where both walls that meet there agree
       * on it by the corner itself; out of the foot of a ground storey; under
       * the end of a sill; under the head of a top storey that has no beam
       * ends to drip -- the ones under the beam ends come with the beams.
       * `H` is how tall the section's picture is, `keep` a stretch along it
       * a loss at the foot must stay out of (a doorway, a gateway), and
       * `sill` the height of a sill in the picture, where there is one.
       */
      const wear = (H: number, keep: [number, number] | null, sill: number | null, bare: boolean): void => {
        const L = cob.losses;
        if (!L || indoors) return;
        const q = (salt: number): number => hash4(border.x, border.y, wall.level * 2 + (border.dir === 'h' ? 0 : 1), salt);
        const pick = (xs: HTMLCanvasElement[], r: number): HTMLCanvasElement => xs[Math.floor(r * xs.length) % xs.length];
        const courses = (img: HTMLCanvasElement): number => Math.round((img.height - L.lip - 2) / L.ch);
        const bottom = Math.round((H - (lw ? 34 : cob.plinth) - L.from) / L.ch);
        let laid = false;
        for (const [e, i] of [[e0, -1], [e1, 1]] as Array<[number, number]>) {
          if (!e) continue;
          const t = i < 0 ? 0 : 1;
          const cx = border.dir === 'h' ? border.x + t : border.x, cy = border.dir === 'h' ? border.y : border.y + t;
          if (hash4(cx, cy, wall.level, 17) > 0.45) continue;
          const img = pick(L.corner, hash4(cx, cy, wall.level, 18)), n = courses(img);
          const line = wall.level === 0 ? bottom - n + 1 : 1 + Math.floor(hash4(cx, cy, wall.level, 19) * Math.max(1, bottom - n - 1));
          patch(img, i > 0 ? T1 * cob.w - img.width : T0 * cob.w, L.from + line * L.ch - L.lip, H, i < 0);
          laid = true;
        }
        if (laid) return;
        if (sill !== null && q(21) < 0.4) {
          const img = pick(L.sill, q(23)), left = q(22) < 0.5;
          const x = (left ? WINDOW.t0 : WINDOW.t1) * cob.w + (left ? -18 : 18) - img.width / 2;
          patch(img, x, L.from + Math.ceil((sill + 18 - L.from) / L.ch) * L.ch - L.lip, H);
          return;
        }
        if (wall.level === 0 && q(31) < (lw ? 0.22 : 0.32)) {
          const img = pick(L.foot, q(33)), n = courses(img) - 2;
          const room = cob.w - 2 * 26 - img.width;
          let x = 26 + q(32) * room;
          if (keep && x + img.width > keep[0] * cob.w && x < keep[1] * cob.w) {
            x = q(34) < 0.5 ? Math.max(18, keep[0] * cob.w - img.width - 10) : Math.min(cob.w - img.width - 18, keep[1] * cob.w + 10);
            if (x + img.width > keep[0] * cob.w && x < keep[1] * cob.w) return;
          }
          patch(img, x, L.from + (bottom - n) * L.ch - L.lip, H);
          return;
        }
        if (bare && !lw && !roofed && q(41) < 0.3) {
          const img = pick(L.head, q(43));
          patch(img, 30 + q(42) * (cob.w - 60 - img.width), L.from - L.ch - L.lip, H);
        }
      };
      const light = (k: number): void => {
        if (k >= 0.999) return;
        const [sr, sg, sb] = cob.shade;
        ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${cob.shadow(k).toFixed(3)})`;
        ctx.fill();
      };
      /**
       * The end grain, at each end where it shows (see `endShows`, and `proud`
       * for the edge of one left standing out), with its picture laid across
       * the whole end whatever part of the end is drawn.
       */
      const endGrain = (img: HTMLCanvasElement): void => {
        for (const i of [-1, 1] as const) {
          const cut = proud(i);
          if (!cut && !endShows(i)) continue;
          const t = i < 0 ? T0 : T1, [s0, s1] = cut ?? [-1, 1];
          endOf(t, 0, 1, s0, s1);
          ctx.fillStyle = rgb(mat.color, endLit);
          ctx.fill();
          ctx.save();
          ctx.clip();
          const [ex, ey] = [px(t, 1, 1), py(t, 1, 1)];
          ctx.transform(
            (px(t, 1, -1) - ex) / img.width, (py(t, 1, -1) - ey) / img.width,
            (px(t, 0, 1) - ex) / img.height, (py(t, 0, 1) - ey) / img.height,
            ex, ey,
          );
          ctx.drawImage(img, 0, 0);
          ctx.restore();
          endOf(t, 0, 1, s0, s1);
          light(endLit);
          if (cob.soft && !cut) { endRoll(t); roll(t, endLit); }
        }
      };
      /*
       * A field wall is its own picture, not the house wall squashed.
       *
       * A fence section is a fraction of a storey tall, so blitting the
       * wall's three metres into it flattened every stone by two and a half
       * and put the band course -- which is the string course at a floor line
       * -- along the top of something that has no floors. What it gets is a
       * coping, painted at the height the wall type actually asks for, with
       * everything it carries in the one picture: a fence has no openings to
       * clip growth out of and no storey above it to belong to.
       *
       * Every low wall takes it, not only the fences -- a half wall was the
       * same three metres squashed into one and a half, and a half wall in
       * cobblestone is a garden wall, which is what this draws.
       */
      if (lw) {
        // What it throws on the ground it stands on is laid with the ground: see `groundShade`.
        if (cob.under) {
          ctx.fillStyle = rgb(cob.under, 1);
          for (const [a, b] of (hung ? [[T0, FENCE_GAP.t0], [FENCE_GAP.t1, T1]] : [[T0, T1]]) as Array<[number, number]>) {
            flush(a, b, 0, 0.8);
            ctx.fill();
          }
        }
        blit(hung ? lw.gate[v] : lw.face[v], 0, 1 + lw.proud / lw.h, 1, false, 0, cob.under ? 0.004 : 0, turned);
        if (lw.post) posts(lw.post, lw.post.foot / lw.h, 1, lw.post.foot / lw.h);
        wear(lw.h, hung ? [FENCE_GAP.t0 - 0.12, FENCE_GAP.t1 + 0.12] : null, null, false);
        if (hung) this.fenceGate(cob, { px, py, quad }, zoom, wall.type === 'iron_gate');
        crown();
        face();
        light(lit);
        // Polished metal keeps its brightest light on a face turned from the sun.
        if (cob.gleam && cob.shadow(lit) > 0.05) gleamed(hung ? lw.gate[v] : lw.face[v], 0, turned, cob.under ? 0.004 : 0, 1 + lw.proud / lw.h);
        /*
         * The top of a fence, at nine tenths of the light a wall's top gets.
         *
         * It is the same stone turned at the sky, so it is lighter than the
         * face -- but on three metres of wall that top is a surface and on a
         * fence it is a line three pixels deep, and a line a quarter brighter
         * than everything around it, running dead straight for as far as the
         * wall runs, is the brightest thing in the picture. It still reads as
         * lit. It no longer reads as paint.
         */
        const capLit = topLit * 0.9;
        /*
         * In two pieces over a gate, because there is nothing over a gateway.
         * The blit is cut to the opening but the flat colour under it is what
         * shows through the joints, and laid across the whole section it came
         * out as a grey bar hanging in the air above the gate.
         */
        const capRuns: Array<[number, number]> = hung
          ? [[C0, FENCE_GAP.t0], [FENCE_GAP.t1, C1]]
          : [[C0, C1]];
        if (cob.wrap) {
          for (const [a, b] of capRuns) top(a, b, capLit);
        } else {
          for (const [a, b] of capRuns) {
            cap(a, b, 1);
            ctx.fillStyle = rgb(mat.color, capLit);
            ctx.fill();
          }
          blit(hung ? lw.gateCap[v] : lw.cap[v], 1, 1, 1, true, lw.proud / cob.capH);
          // A garden wall's corner and junctions take one cope stone of their own, as a house wall's do.
          if (lw.corner) {
            for (const i of [-1, 1] as const) {
              const { stone } = joinAt(i);
              if (stone) capStone(lw.corner, (i < 0 ? 0 : 1) - stone, (i < 0 ? 0 : 1) + stone, -(1 + 2 * lw.proud / cob.capH));
            }
          }
          for (const [a, b] of capRuns) { cap(a, b, 1); light(capLit); }
        }
        endGrain(lw.ends);
        if (cob.soft && e0) roll(T0, endLit);
        if (cob.soft && e1) roll(T1, endLit);
        // And the ivy it has grown since it was built (`greening.ts`), over everything.
        this.wallIvy(wall, px, py, tall, nx * toward, ny * toward, false, indoors);
        ctx.globalAlpha = 1;
        return;
      }
      /*
       * An archway is the same section with a hole in it, so it is the same
       * blit with a different picture -- not a shape drawn over the stone.
       * The picture's hole and the clip below both come out of `ARCH`, so
       * there is one statement about where a doorway is.
       */
      // gates: a portcullis is a gateway as wide as a double door, under a segmental head, with its grille hung in it
      // (`gatewayArch`, `drawGrille`): the face's own picture with that hole cut out of it and dressed (`gatewayPicture`).
      const gateway = wall.type === 'portcullis';
      const arched = wall.type === 'arch' || gateway;
      const windowed = wall.type === 'window';
      const doored = wall.type === 'door';
      const gated = wall.type === 'double_door';
      // A shop counter is cut and dressed as a bay is, and is a shop rather than a window (`counter.ts`).
      const countered = wall.type === 'counter';
      const bayed = wall.type === 'bay' || countered;
      const cut = arched || windowed || doored || gated || bayed;
      /** Whichever hole this section has, added to the path that is open. */
      const hole = (s: number): void => {
        if (gateway) { gatewayArch(ctx, { px, py }, zoom, WALL_HEIGHT).hole(s); return; }
        if (arched) { this.archGeom({ px, py, quad }, zoom).hole(s); return; }
        const [t0, t1, k0, k1] = doored
          ? [DOOR.t0, DOOR.t1, 0, DOOR.k1]
          : gated
            ? [DOUBLE.t0, DOUBLE.t1, 0, DOUBLE.k1]
            : bayed
              ? [BAY.t0, BAY.t1, BAY.k0, BAY.k1]
              : [WINDOW.t0, WINDOW.t1, WINDOW.k0, WINDOW.k1];
        ctx.moveTo(px(t0, k0, s), py(t0, k0, s));
        ctx.lineTo(px(t1, k0, s), py(t1, k0, s));
        ctx.lineTo(px(t1, k1, s), py(t1, k1, s));
        ctx.lineTo(px(t0, k1, s), py(t0, k1, s));
        ctx.closePath();
      };
      /*
       * Everything but the opening. Moss is the one green thing that always
       * has to be clipped to the stone, because moss grows on stone: a lens of
       * it is drawn on a block of the field, and the blocks the hole was
       * broken out of are not there any more.
       *
       * The outer boundary is not the face. The overlay sits over the ground
       * line, so the boundary is drawn wide enough to hold anything a section
       * carries and only the hole is taken out of it -- the two paths in one,
       * clipped even-odd.
       */
      const onStone = (): void => {
        if (!cut) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px(-1, -1), py(-1, -1));
        ctx.lineTo(px(2, -1), py(2, -1));
        ctx.lineTo(px(2, 3), py(2, 3));
        ctx.lineTo(px(-1, 3), py(-1, 3));
        ctx.closePath();
        hole(1);
        ctx.clip('evenodd');
      };
      const offStone = (): void => { if (cut) ctx.restore(); };
      // What a plinth throws on the ground it stands on is laid with the ground: see `groundShade`.
      /*
       * Under the picture, where the masonry asks for it, its own flat colour
       * a hair wider than the section: two pictures meeting on one line leave
       * a hairline of whatever is behind, and on a coat of mud that is a
       * ruled line down the wall at every seam.
       */
      /*
       * gates: a portcullis's gateway, its way through laid first and unclipped -- the threshold, the shade,
       * the wall's thickness, the grooves and the grille, each kept to the opening by its own shape -- and its
       * picture, with the hole cut and the dressing laid, over the lot (`gates.ts`). The hedge does not turn
       * the corner into it, as it does into an archway: what grows on the face stops at the jambs, as the ivy
       * stops round the head (`gatewayClear`), so nothing stands in the grille's way.
       */
      const gw = gateway ? gatewayArch(ctx, { px, py }, zoom, WALL_HEIGHT) : undefined;
      if (gw) {
        // A wall drawn faint, in front of the room you are in, is seen through: there it is kept to the opening.
        const faint = alpha < 1;
        if (faint) { ctx.save(); gw.outline(1); ctx.clip(); }
        this.threshold(cob, { px, py, quad }, gw.t0, gw.t1, zoom);
        this.archShade({ px, py, quad }, zoom, gw, () => gw.outline(1));
        this.archDepth(cob.reveal, 1, { px, py, quad }, zoom, gw);
        drawGrooves(ctx, { px, py }, zoom, gw);
        this.grille(wall, border, { px, py }, lit, gw);
        if (faint) ctx.restore();
      }
      if (cob.under) {
        if (gw) {
          // Round the opening rather than clipped to it.
          flush(T0, T1, -sunk, 1);
          gw.hole(1);
          ctx.fillStyle = rgb(cob.under, 1);
          ctx.fill('evenodd');
        } else {
          onStone();
          flush(T0, T1, -sunk, 1);
          ctx.fillStyle = rgb(cob.under, 1);
          ctx.fill();
          offStone();
        }
      }
      /** gates: the face's picture with a portcullis's gateway in it. */
      const gatePic = (img: HTMLCanvasElement): HTMLCanvasElement =>
        gatewayPicture(img, WALL_HEIGHT, cob.reveal.map((c) => c * 1.3) as unknown as [number, number, number], cob.line);
      blit(gateway ? gatePic(cob.face[v])
        : arched ? cob.arch[v]
        : windowed ? cob.window[v]
        : doored ? cob.door[v]
        : gated ? cob.gate[v]
        : bayed ? cob.bay[v]
        : cob.face[v], 0, 1, 1, false, 0, 0, turned);
      /*
       * Quoins, where the run stops or turns a corner: the masonry's own
       * dressing of a free end, toothed into the face. Out of doors only --
       * the end of a partition inside a room is plaster and furniture.
       */
      if (!indoors) {
        for (const [img, i] of [[cob.quoinL, -1], [cob.quoinR, 1]] as Array<[HTMLCanvasElement | undefined, -1 | 1]>) {
          const { n, P, up } = joinAt(i);
          // Not where the run carries on, nor in an angle the face runs into.
          if (!img || n || P || up) continue;
          // At an arris a corner has carried the face out to, the stones go out with it.
          ctx.save(); strip(snapX(T0), snapX(T1)); ctx.clip();
          lay(img, 0, 1, 1, false, 0, 0, i < 0 ? T0 : T1 - 1);
          ctx.restore();
        }
      }
      wear(
        cob.h,
        gateway ? [GATEWAY.t0 - 0.12, GATEWAY.t1 + 0.12] : arched ? [ARCH.t0, ARCH.t1] : doored ? [DOOR.t0, DOOR.t1] : gated ? [DOUBLE.t0, DOUBLE.t1] : null,
        windowed ? cob.h * (1 - WINDOW.k0) : bayed ? cob.h * (1 - BAY.k0) : null,
        !(cob.vigas && this.bearsJoists(wall.building, border)),
      );
      /*
       * The way through goes in before anything that grows, and unlit,
       * because the wash below takes the whole face at once: a bush that has
       * got into a doorway stands in front of the reveal, not behind it, and
       * the hour has to reach the stone and the bush in one pass or the bush
       * is cut in half along the edge of the opening.
       */
      if (arched && !gw) {
        const geom = this.archGeom({ px, py, quad }, zoom);
        ctx.save();
        geom.outline(1);
        ctx.clip();
        /*
         * The hedge again, and this time round the corner.
         *
         * A bush at the foot of a wall that meets a doorway does not stop and
         * it does not stand across the gap like a hoarding: it turns the
         * arris and goes on growing down the inside of the passage. So the
         * same picture is laid twice -- on the face of the wall, clipped to
         * the stone, and on the far side of the wall's thickness, clipped to
         * the opening. The step between the two at the jamb is the corner it
         * turned, and the reveal drawn over it is the jamb standing in front
         * of it.
         */
        this.threshold(cob, { px, py, quad }, ARCH.t0, ARCH.t1, zoom);
        if (cob.growth && wall.level === 0 && !indoors && !aloft) blit(cob.base[v], 0, 1, -1);
        this.archShade({ px, py, quad }, zoom);
        this.archDepth(cob.reveal, 1, { px, py, quad }, zoom);
        ctx.restore();
        /*
         * And a line round the edge of it, in the same ink the picture draws
         * every block with. Every stone in the wall is outlined and the one
         * hole in it was not, so the opening read as a gap between stones
         * rather than as an edge somebody cut.
         */
        geom.rim(1);
        ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      // gates: and the same line round a portcullis's gateway, whose way through went in under its picture.
      if (gw) {
        gw.rim(1);
        ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      /*
       * A window is the same idea with glass in it, so it is the same picture
       * with a smaller hole and the same reveal round it. There is no wrapping
       * the hedge through this one: a bush does not grow through a pane.
       */
      if (windowed || doored || gated) {
        ctx.save();
        ctx.beginPath();
        hole(1);
        ctx.clip();
        if (doored || gated) this.paintedDoor(cob, { px, py, quad }, zoom, gated ? 2 : 1);
        else this.paintedGlass(cob, { px, py, quad }, zoom, this.lampBehind(wall, border));
        ctx.restore();
        ctx.beginPath();
        hole(1);
        ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      /*
       * A bay sticks out of one side of a wall, and from the other side of
       * that wall it is a hole with glass across the back of it. So from
       * inside a room it is drawn as the window it is from in there, and only
       * from out of doors is the box drawn -- which is also why a bay is not
       * clipped to the hole out there: what fills the hole is the inside of
       * the box, and the box stands in front of the stone.
       */
      if (countered) this.drawCounterPart('inside', wall, border, { px, py, quad }, zoom, lit, { line: cob.line, reveal: cob.reveal, wood: cob.beam, woodLine: cob.beamLine });
      if (bayed && !countered) {
        ctx.save();
        ctx.beginPath();
        hole(1);
        ctx.clip();
        if (indoors) this.paintedGlass(cob, { px, py, quad }, zoom, this.lampBehind(wall, border), BAY);
        else { ctx.fillStyle = rgb(cob.reveal, 0.42); ctx.fill(); }
        ctx.restore();
        ctx.beginPath();
        hole(1);
        ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      if (wall.level === 0 && !indoors && !aloft) {
        onStone();
        blit(cob.foot[v], 0, 1, 1, false, 0, cob.under ? 0.004 : 0, turned);
        // The face's half of the hedge, where a doorway took the other half
        // round the corner with it.
        if (cob.growth && arched) blit(cob.base[v], 0, 1);
        offStone();
        // Anywhere else it is one picture and goes on whole: a bush that has
        // grown up in front of a window stands in front of it, glass and all --
        // but not up into a shop counter's opening, where the board and the
        // goods stand (`counter.ts`).
        if (cob.growth && !arched) {
          if (countered) this.counterCut({ px, py });
          blit(cob.base[v], 0, 1);
          if (countered) ctx.restore();
        }
        // gates: a portcullis's gateway takes a cart gate's tussocks, kept off its opening as its ivy is (`gatewayClear`).
        if (cob.growth && arched) blit(gateway ? gatewayClear(cob.gateWeed[v], WALL_HEIGHT) : cob.archWeed[v], 0, 1);
      }
      // After the foot, and down to it: the sole it lays along the footing runs into the post.
      if (cob.post) posts(cob.post, 0, 1, wall.level === 0 ? cob.plinth / cob.h : -sunk);
      // Nothing grows on a masonry that is bare: those pictures are empty, and
      // there is no call to lay an empty picture across a whole wall.
      if (cob.growth) {
        if (windowed) blit(cob.winWeed[v], 0, 1);
        if (doored) blit(cob.doorWeed[v], 0, 1);
        if (gated) blit(cob.gateWeed[v], 0, 1);
      }
      /*
       * The beam ends of the floor over this storey, where this is one of the
       * two walls of the house its joists rest on, and out of doors: inside,
       * the beams are the ceiling of the room. They are painted leaning out
       * to one side, which is the side a log a foot out of the wall stands to
       * from a diagonal, and square on it stands straight below; the face
       * that shows its picture laid the other way round takes them the other
       * way round. The shade they throw falls on a face with the sun on it
       * and on no other, and the rain off them runs down to the head of an
       * opening and no further.
       */
      if (cob.vigas && !indoors && !kind?.low && this.bearsJoists(wall.building, border)) {
        const V = cob.vigas;
        const ux = px(1, 0) - px(0, 0);
        if (Math.abs(ux) > 0.5) {
          const a = (px(0, 0, 1) - px(0, 0, 0)) / half / ux;
          const iso = Math.abs(a) > 0.5;
          const k0 = 1 - V.h / cob.h;
          const sun = cam.rotateX(dx, dy) > 0 && ux > 0 ? Math.min(1, Math.max(0, (lit - 0.72) / 0.28)) : 0;
          if (sun > 0.02) {
            ctx.globalAlpha = alpha * sun;
            blit(V.shade[v], 1 - V.sh / cob.h, 1, 1, false, 0, 0, false, false);
            ctx.globalAlpha = alpha;
          }
          const zone = gateway ? [GATEWAY.t0, GATEWAY.t1, GATEWAY.crown + 0.16] : arched ? [ARCH.t0, ARCH.t1, 0.76] : windowed ? [WINDOW.t0, WINDOW.t1, 0.78]
            : doored ? [DOOR.t0, DOOR.t1, 0.8] : gated ? [DOUBLE.t0, DOUBLE.t1, 0.8] : bayed ? [BAY.t0, BAY.t1, 0.8] : null;
          ctx.save();
          if (zone) {
            const [z0, z1, zk] = zone;
            ctx.beginPath();
            ctx.rect(-1e5, -1e5, 2e5, 2e5);
            ctx.moveTo(px(z0 - 0.07, -0.2), py(z0 - 0.07, -0.2));
            ctx.lineTo(px(z1 + 0.07, -0.2), py(z1 + 0.07, -0.2));
            ctx.lineTo(px(z1 + 0.07, zk), py(z1 + 0.07, zk));
            ctx.lineTo(px(z0 - 0.07, zk), py(z0 - 0.07, zk));
            ctx.closePath();
            ctx.clip('evenodd');
          }
          blit(iso ? V.iso[v] : V.square[v], k0, 1, 1, false, 0, 0, iso && a > 0, false);
          ctx.restore();
        }
      }
      // The coat rolled over the head of a wall nothing stands on.
      if (cob.brow && !roofed) blit(cob.brow[v], 1 - cob.brow[v].height / cob.h, 1);
      /*
       * The hour's light, and only that. A flat wall takes a wash down its
       * face as well -- dark where the ground throws shade back up it, light
       * where the sky catches the last of it -- and this one must not: the
       * wash runs top to bottom of a storey, so at every floor line the lit
       * top of one storey would meet the shaded foot of the next and draw a
       * band across a wall that was built to stack without one. The shade at
       * the ground is painted into `foot` instead, on the storey that has a
       * ground to be shaded by.
       */
      crown();
      face();
      light(lit);
      /*
       * Polished metal keeps its brightest light whichever way it is turned:
       * a mirror turned from the sun still shows the sky. So on a masonry
       * that is, what is brightest in its pictures goes on again over the
       * shade, and a face away from the light keeps its white edges on a
       * darker body. A face the shade barely touches keeps them anyway.
       */
      if (cob.gleam && cob.shadow(lit) > 0.05) {
        const ground = wall.level === 0 && !indoors && !aloft;
        gleamed(gateway ? gatePic(cob.face[v]) : arched ? cob.arch[v] : windowed ? cob.window[v] : doored ? cob.door[v] : gated ? cob.gate[v] : bayed ? cob.bay[v] : cob.face[v], ground ? (cob.plinth + 8) / cob.h : 0, turned);
        if (ground) { onStone(); gleamed(cob.foot[v], 0, turned, cob.under ? 0.004 : 0); offStone(); }
      }
      if (cob.soft && indoors) inside();
      if (cob.soft && e0) roll(T0, endLit);
      if (cob.soft && e1) roll(T1, endLit);
      // A wall whose face goes round its corners has its top laid flat as
      // well: a picture over it seamed at every section. And where a storey
      // stands on it, it is under that storey -- carried round a corner, it
      // came out past the face above. So is the cope of any other masonry
      // under a storey as thick as it is: drawn from a tile later than the
      // storey over the corner, its end came out over that storey's foot.
      // Only under a storey that is drawn (`over`), as `capHidden` has it.
      const lidded = !!over && (WALL_TYPE_BY_ID.get(over.type)?.thick ?? 1) >= (kind?.thick ?? 1) && !WALL_TYPE_BY_ID.get(over.type)?.railed;
      if (cob.wrap) { if (!over) top(C0, C1, topLit); } else if (!lidded) {
        cap(C0, C1, 1);
        ctx.fillStyle = rgb(mat.color, topLit);
        ctx.fill();
        blit(cob.cap, 1, 1, 1, true);
        // At a corner this wall carries the top over, the corner's own stone, which the cap of the wall square to it stops at.
        const corner = cob.corner;
        if (corner) {
          for (const i of [-1, 1] as const) {
            const { stone } = joinAt(i);
            if (stone) capStone(corner, (i < 0 ? 0 : 1) - stone, (i < 0 ? 0 : 1) + stone);
          }
        }
        cap(C0, C1, 1);
        light(topLit);
      }
      // The ground storey's end, where the masonry's foot goes round it.
      endGrain(wall.level === 0 && cob.endsFoot ? cob.endsFoot : cob.ends);
      /*
       * The ivy last, and unlit: it stands proud of the cap, so it has to go on
       * over it, and a leaf in the sun is in the sun whichever way the wall
       * behind it is turned.
       */
      if (cob.growth && !roofed && !indoors) {
        // Round a shop counter's opening, board and awning, as its hedge goes (`counterCut`).
        if (countered) this.counterCut({ px, py });
        // gates: kept off a portcullis's gateway, to the stone round its head (`gatewayClear`).
        blit(gateway ? gatewayClear(cob.spill[v], WALL_HEIGHT, 1 + cob.pad / cob.h) : cob.spill[v], 0, 1 + cob.pad / cob.h);
        if (countered) ctx.restore();
        // And the tongue of it that hangs into the opening, on the variants
        // whose curtain reaches that far along the wall.
        // gates: and over a portcullis's gateway, kept to the stone round its head (`gatewayClear`).
        if (arched) blit(gateway ? gatewayClear(cob.gateIvy[v], WALL_HEIGHT) : cob.archIvy[v], 0, 1);
        if (windowed) blit(cob.winIvy[v], 0, 1);
        if (doored) blit(cob.doorIvy[v], 0, 1);
        if (gated) blit(cob.gateIvy[v], 0, 1);
      }
      // And the ivy it has grown since it was built (`greening.ts`): after the painted ivy, and unlit, as that is.
      this.wallIvy(wall, px, py, tall, nx * toward, ny * toward, roofed, indoors);
      if (bayed && !indoors && !countered) this.paintedBay(cob, { px, py, quad }, zoom, this.lampBehind(wall, border));
      if (countered) this.drawCounterPart('front', wall, border, { px, py, quad }, zoom, lit, { line: cob.line, reveal: cob.reveal, wood: cob.beam, woodLine: cob.beamLine });
      if (!cut) this.wallOpenings(wall, mat, lit, { px, py, quad }, zoom, border);
      if (wall.type === 'hidden_door' && this.r.game.buildings.seenType(wall) === 'hidden_door') drawHiddenMark(ctx, { px, py }, zoom, cob.line);
      ctx.globalAlpha = 1;
      return;
    }
    /*
     * A solid wall of glass is a slab between a timber sill and head
     * (`glasswall.ts`): drawn in the same box as any wall -- its near face, its
     * top and its ends stopping where this wall's do -- and its far face too,
     * which is seen through it, stopping where the near face would on the far
     * side of the wall.
     */
    if (wall.material === GLASS) {
      const backEnd = (i: -1 | 1): number => {
        const edge = i < 0 ? 0 : 1, { n, P, Q, up, past } = joinAt(i);
        if (past) return edge + i * past;
        if (up) return edge - i * up;
        if (n) return edge;
        if (Q) return edge - i * Q.h;
        if (P) return edge + i * P.h;
        return edge;
      };
      /** Glass carrying on in line past the `i` end, finished and as tall: a joint between two panes there. */
      const pane = (i: -1 | 1): boolean => {
        const b: Border = border.dir === 'h' ? { dir: 'h', x: border.x + i, y: border.y } : { dir: 'v', x: border.x, y: border.y + i };
        const w = this.r.game.buildings.wallOnBorder(wall.level, b);
        return !!w && w.material === GLASS && isDone(w) && this.r.standing(w, b) >= tall - 1e-6;
      };
      /** Glass turning the corner at the `i` end, square to this wall on either side of it. */
      const turns = (i: -1 | 1): boolean => {
        const t = i < 0 ? 0 : 1;
        const cx = border.dir === 'h' ? border.x + t : border.x, cy = border.dir === 'h' ? border.y : border.y + t;
        const round: Border[] = border.dir === 'h'
          ? [{ dir: 'v', x: cx, y: cy }, { dir: 'v', x: cx, y: cy - 1 }]
          : [{ dir: 'h', x: cx, y: cy }, { dir: 'h', x: cx - 1, y: cy }];
        return round.some((b) => {
          const w = this.r.game.buildings.wallOnBorder(wall.level, b);
          return !!w && w.material === GLASS && isDone(w);
        });
      };
      drawGlassWall(ctx, { px, py }, {
        near: [faceEnd(-1), faceEnd(1)], far: [backEnd(-1), backEnd(1)], top: [capEnd(-1), capEnd(1)],
        ends: [endShows(-1), endShows(1)], joints: [pane(-1), pane(1)], corners: [turns(-1), turns(1)], capped: true,
        lit, topLit, endLit, zoom, glow: this.lampBehind(wall, border), seed: border.x * 31 + border.y * 17 + wall.level * 7,
      });
      ctx.globalAlpha = 1;
      return;
    }
    /* The face, then what it is made of, then the top and the end. */
    const T0 = faceEnd(-1), T1 = faceEnd(1), C0 = capEnd(-1), C1 = capEnd(1);
    quad(T0, T1, 0, 1);
    ctx.fillStyle = rgb(mat.color, lit);
    ctx.fill();
    // The grain is ruled across the whole section, so it is cut to the face:
    // past a face stopped short at a corner it was ruled over the wall there.
    if (zoom >= 0.5) {
      ctx.save();
      quad(T0, T1, 0, 1);
      ctx.clip();
      this.wallGrain(mat, lit, border.x * 31 + border.y * 17 + wall.level, { px, py, quad }, zoom);
      ctx.restore();
    }
    /*
     * And the light down the face of it. Nothing out of doors is one flat
     * tone from top to bottom: the ground throws shade back up the first foot
     * of a wall and the sky picks out the last of it, and without that a wall
     * of however good a masonry sits on the grass like a decal.
     */
    quad(T0, T1, 0, 1);
    const wash = ctx.createLinearGradient(px(0.5, 0), py(0.5, 0), px(0.5, 1), py(0.5, 1));
    wash.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
    wash.addColorStop(0.3, 'rgba(0, 0, 0, 0.05)');
    wash.addColorStop(0.82, 'rgba(255, 255, 255, 0.03)');
    wash.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = wash;
    ctx.fill();
    ctx.strokeStyle = rgb(mat.trim, lit * 0.9);
    ctx.stroke();
    cap(C0, C1, 1);
    ctx.fillStyle = rgb(mat.color, topLit);
    ctx.fill();
    ctx.stroke();
    /*
     * And the end grain, at an end that nothing carries on from. A run of
     * wall down a street is one wall to look at; it is only where a run stops
     * that the thickness of it should be on show.
     */
    for (const i of [-1, 1] as const) {
      const cut = proud(i);
      if (!cut && !endShows(i)) continue;
      endOf(i < 0 ? T0 : T1, 0, 1, ...(cut ?? [-1, 1]));
      ctx.fillStyle = rgb(mat.color, endLit);
      ctx.fill();
      ctx.strokeStyle = rgb(mat.trim, endLit);
      ctx.stroke();
    }
    this.wallOpenings(wall, mat, lit, { px, py, quad }, zoom, border);
    // A painted wall of stone grows ivy as a bare one does (`greening.ts`).
    {
      const up = this.r.game.buildings.wallOnBorder(wall.level + 1, border);
      const seenX = border.dir === 'h' ? border.x : (toward > 0 ? border.x - 1 : border.x);
      const seenY = border.dir === 'h' ? (toward > 0 ? border.y : border.y - 1) : border.y;
      this.wallIvy(wall, px, py, tall, nx * toward, ny * toward, !!up && isDone(up), !!this.r.game.buildings.buildingAt(seenX, seenY));
    }
    if (wall.type === 'hidden_door' && this.r.game.buildings.seenType(wall) === 'hidden_door') drawHiddenMark(ctx, { px, py }, zoom, mat.trim);
    ctx.globalAlpha = 1;
  }

  /** Whether a wall's top is open to the sky: no finished floor, deck or roof of the storey over it on the tile either side of it. */
  private openOver(wall: Wall): boolean {
    const bld = this.r.game.buildings;
    const [ox, oy] = wall.dir === 'h' ? [wall.x, wall.y - 1] : [wall.x - 1, wall.y];
    for (const [tx, ty] of [[wall.x, wall.y], [ox, oy]]) {
      const f = bld.floor(wall.level + 1, tx, ty);
      if (f && isDone(f)) return false;
    }
    return true;
  }

  /**
   * The ivy a wall has grown (`greening.ts`), on the face the camera is on.
   *
   * Laid out by `ivyLayout` off where the face is and which side of its wall,
   * so each face grows its own and grows the same ones as it ages: trails off
   * the head of a wall nothing stands on, clumps and stems from the foot of
   * one on the ground, clear of its openings. How far it has got is the days
   * since the wall was finished or cleared, more on a face turned from the sun
   * -- the light comes from the south-east -- and on one by water. Out of
   * doors only; the inside of a room grows nothing.
   *
   * `ox`, `oy` is which way the face looks, in the world.
   */
  private wallIvy(wall: Wall, px: (t: number, k: number, s?: number) => number, py: (t: number, k: number, s?: number) => number,
    tall: number, ox: number, oy: number, roofed: boolean, indoors: boolean): void {
    // Too far out to see a leaf, it is not drawn at all: shapes and colours only.
    if (this.r.camera.zoom < 0.6) return;
    const days = wallGreen(this.r.game, wall, this.r.greenAt);
    if (!days) return;
    /*
     * Moss along its coping first, where nothing stands on it, so the clumps
     * of any trail over the top lie over the moss: seen from indoors as well,
     * since a top is a top from either side.
     *
     * Reported: "some wall tops still glitched." Green specks on the cap of
     * every partition of a house with a storey over it, its floor lifted off
     * to look into the room. Out of the weather under a floor, a deck or a
     * roof of the storey over it, on either side, a top grows none
     * (`openOver`).
     */
    if (!roofed && this.openOver(wall)) {
      const g = greenShows(days, 0, this.wetness(wall.x, wall.y));
      const cm = capMoss(Math.floor(hashOf(wall.x, wall.y, wall.level, wall.dir === 'h' ? 3 : 4) * 3), Math.round(g * PAVE_STAGES));
      if (cm) {
        const ctx = this.r.canvas.ctx;
        const x0 = px(0, 1, 1), y0 = py(0, 1, 1);
        ctx.save();
        ctx.transform((px(1, 1, 1) - x0) / CAP_W, (py(1, 1, 1) - y0) / CAP_W, (px(0, 1, -1) - x0) / CAP_D, (py(0, 1, -1) - y0) / CAP_D, x0, y0);
        ctx.drawImage(cm, 0, 0);
        ctx.restore();
      }
    }
    if (indoors) return;
    const kind = WALL_TYPE_BY_ID.get(wall.type);
    // Turned from the sun, which stands in the south-east: a north or a west face is the shady one (`greenShows`).
    const shade = ox + oy < 0 ? 1 : 0;
    const tx = wall.dir === 'h' ? wall.x : wall.x - (ox < 0 ? 1 : 0);
    const ty = wall.dir === 'h' ? wall.y - (oy < 0 ? 1 : 0) : wall.y;
    const wet = this.wetness(tx, ty);
    const keep: Keep[] = [];
    switch (wall.type) {
      case 'arch': keep.push({ t0: ARCH.t0, t1: ARCH.t1, k0: 0, k1: 0.8 }); break;
      case 'portcullis': keep.push({ t0: GATEWAY.t0 - 0.06, t1: GATEWAY.t1 + 0.06, k0: 0, k1: GATEWAY.crown + 0.16 }); break;
      case 'window': keep.push({ t0: WINDOW.t0, t1: WINDOW.t1, k0: WINDOW.k0 - 0.05, k1: WINDOW.k1 + 0.1 }); break;
      case 'bay': keep.push({ t0: BAY.t0, t1: BAY.t1, k0: BAY.k0 - 0.05, k1: BAY.k1 + 0.08 }); break;
      // A counter's opening, its board and the awning over it (`counter.ts`).
      case 'counter': keep.push(COUNTER_KEEP); break;
      case 'door': keep.push({ t0: DOOR.t0, t1: DOOR.t1, k0: 0, k1: DOOR.k1 + 0.08 }); break;
      case 'double_door': keep.push({ t0: DOUBLE.t0, t1: DOUBLE.t1, k0: 0, k1: DOUBLE.k1 + 0.08 }); break;
      case 'fence_gate': case 'iron_gate': keep.push({ t0: FENCE_GAP.t0, t1: FENCE_GAP.t1, k0: 0, k1: 1 }); break;
    }
    const low = !!kind?.low;
    const height = (WALL_HEIGHT * tall) / 10;
    const strands = ivyLayout({
      seed: Math.floor(hashOf(wall.x, wall.y, wall.dir === 'h' ? 0 : 1, (ox + oy > 0 ? 1 : 0) + wall.level * 2) * 2 ** 31),
      grown: greenShows(days, shade, wet),
      vigour: vigour(wall.x + (wall.dir === 'h' ? 0.5 : 0), wall.y + (wall.dir === 'v' ? 0.5 : 0)),
      shade, wet, height,
      top: low || !roofed,
      ground: wall.level === 0,
      below: wall.level > 0,
      keep,
    });
    if (!strands.length) return;
    const ctx = this.r.canvas.ctx;
    /*
     * And on a shop counter, never over its opening, its board or the awning
     * over it: a strand rooted clear of `keep` still spreads its picture
     * across them, so the face is cut to everything but that box.
     */
    const cutOut = wall.type === 'counter';
    if (cutOut) this.counterCut({ px, py });
    // The face's two axes on the screen: a metre along it, and a metre up it.
    const ax = (px(1, 0) - px(0, 0)) / 4, ay = (py(1, 0) - py(0, 0)) / 4;
    const kx = (px(0, 1) - px(0, 0)) / height, ky = (py(0, 1) - py(0, 0)) / height;
    // A face that runs right to left on the screen takes its pictures the other way round, so their light stays on the left.
    const flip = ax < 0 ? -1 : 1;
    const a = (flip * ax) / PPM, b = (flip * ay) / PPM, c = -kx / PPM, d = -ky / PPM;
    /*
     * Each picture taken down once to about the size it is drawn at (`atSize`),
     * by the larger of its two scales on the face: sixty-four pixels to the
     * metre skewed straight down to a fraction of that costs several times the
     * same blit at its own size.
     */
    const scale = Math.max(Math.hypot(a, b), Math.hypot(c, d));
    // In device pixels: a close view on a sharp screen draws them at their own size or more, and takes them as they are.
    const smaller = scale * this.r.canvas.dpr < 0.9;
    for (const s of strands) {
      const pic = strandPic(s.kind, s.v, s.stage, this.r.bloom);
      if (!pic) continue;
      const k = s.kind === 'hang' ? 1 : 0;
      const ox0 = px(s.t, k), oy0 = py(s.t, k);
      const img = smaller ? this.r.atSize(pic.img, pic.img.width * scale, pic.img.height * scale) : pic.img;
      const sx = img.width / pic.img.width, sy = img.height / pic.img.height;
      ctx.save();
      ctx.transform(a / sx, b / sx, c / sy, d / sy, ox0 - a * pic.ax - c * pic.ay, oy0 - b * pic.ax - d * pic.ay);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    if (cutOut) ctx.restore();
  }

  /**
   * Clip what is drawn next to a shop counter's face to everything but its
   * opening, its board and its awning (`COUNTER_KEEP`): what grows on the
   * wall goes round a shop, not across it. Saves the context; the caller
   * restores it.
   */
  private counterCut(g: { px: (t: number, k: number, s?: number) => number; py: (t: number, k: number, s?: number) => number }): void {
    const ctx = this.r.canvas.ctx;
    const quadAt = (t0: number, t1: number, k0: number, k1: number): void => {
      ctx.moveTo(g.px(t0, k0), g.py(t0, k0));
      ctx.lineTo(g.px(t1, k0), g.py(t1, k0));
      ctx.lineTo(g.px(t1, k1), g.py(t1, k1));
      ctx.lineTo(g.px(t0, k1), g.py(t0, k1));
      ctx.closePath();
    };
    ctx.save();
    ctx.beginPath();
    quadAt(-1, 2, -1, 2);
    quadAt(COUNTER_KEEP.t0, COUNTER_KEEP.t1, COUNTER_KEEP.k0, COUNTER_KEEP.k1);
    ctx.clip('evenodd');
  }
  wetness(x: number, y: number): number {
    if (Math.abs(this.r.time - this.wetKept) > 5) {
      this.wetCache.clear();
      this.wetKept = this.r.time;
    }
    const key = y * 65536 + x;
    const had = this.wetCache.get(key);
    if (had !== undefined) return had;
    const w = this.r.game.world;
    const reach = GREEN_WET_REACH - 1;
    let near = GREEN_WET_REACH;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      if (w.inBounds(x + dx, y + dy) && w.hasWater(x + dx, y + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
    }
    const v = wetFrom(near);
    this.wetCache.set(key, v);
    return v;
  }

  /**
   * A shop counter in its wall (`counter.ts`), a half at a time: `inside`,
   * the opening, in the hole before the hour's light goes over the wall --
   * the shop from the street, or the reveal from within it; `front`, the
   * board, the goods and the awning, over everything on the face once the
   * wall is done -- from within, only as far as they are seen through the
   * opening; and `flat`, both on a wall drawn in flat colours, which has no
   * hole to see through.
   *
   * At the four turns where a wall runs straight away from the camera its
   * face has no width on the screen and neither has the opening, so nothing
   * is clipped to it: the board and the awning stand out of the wall to the
   * street's side, and are seen from either side of it.
   */
  private drawCounterPart(stage: 'inside' | 'front' | 'flat', wall: Wall, border: Border, g: WallGeom, zoom: number, lit: number,
    paint: { line: CounterLook['line']; reveal: CounterLook['reveal']; wood: CounterLook['wood']; woodLine: CounterLook['woodLine'] }): void {
    const ctx = this.r.canvas.ctx;
    const game = this.r.game;
    const cam = this.r.camera;
    const c = game.counters.onBorder(border);
    const seat = c ?? counterSeat(game, wall);
    const st = streetOf(seat);
    // The tile on the camera's side of the border, as `drawWall` works it out.
    const [bx, by] = border.dir === 'h' ? [1, 0] : [0, 1];
    const toward = cam.nearSide(-by, bx);
    const edgeOn = this.r.edgeOn(border);
    const seenX = border.dir === 'h' ? border.x : (toward > 0 ? border.x - 1 : border.x);
    const seenY = border.dir === 'h' ? (toward > 0 ? border.y : border.y - 1) : border.y;
    // A room with a floor or a roof over it is dim behind the opening; one open to the sky is daylit.
    const over = game.buildings.floor(wall.level + 1, seat.x, seat.y);
    const look: CounterLook = {
      zoom, lit, ...paint,
      street: seenX === st.x && seenY === st.y ? 1 : -1,
      stripe: stripeOf(seat.x, seat.y, seat.side),
      wares: c ? counterWares(c) : [],
      full: c ? Math.min(1, counterHeld(c) / COUNTER_HOLDS) : 0,
      // Only the room behind the opening is lit from within, and only from the street is it seen.
      alight: stage !== 'front' ? this.lampBehind(wall, border) : 0,
      sky: !over || !isDone(over),
    };
    /** From within, what lies beyond the wall is seen through the far side of the opening and no further: edge on, there is no opening to see it through. */
    const beyond = look.street < 0 && !edgeOn;
    const dpr = this.r.canvas.dpr;
    if (stage === 'inside') {
      ctx.save();
      counterHole(ctx, g, 1);
      ctx.clip();
      if (look.street > 0) drawCounterInside(ctx, g, look);
      else drawCounterReveal(ctx, g, look);
      ctx.restore();
    } else if (stage === 'front') {
      drawCounterFrontKept(ctx, g, look, beyond, dpr);
    } else if (look.street > 0) {
      drawCounterInside(ctx, g, look);
      drawCounterFrontKept(ctx, g, look, false, dpr);
    } else {
      drawCounterDaylight(ctx, g, look);
      drawCounterFrontKept(ctx, g, look, beyond, dpr);
    }
  }

  /** The hole in a wall, whatever the wall is made of. */
  private wallOpenings(wall: Wall, mat: MaterialDef, lit: number, g: WallGeom, zoom: number, border: Border): void {
    switch (wall.type) {
      case 'window':
        this.wallOpening(mat, lit, g, WINDOW.t0, WINDOW.t1, WINDOW.k0, WINDOW.k1, 'glass', zoom, this.lampBehind(wall, border));
        break;
      case 'bay':
        this.wallOpening(mat, lit, g, BAY.t0, BAY.t1, BAY.k0, BAY.k1, 'glass', zoom, this.lampBehind(wall, border));
        break;
      case 'counter':
        this.drawCounterPart('flat', wall, border, g, zoom, lit, { line: mat.trim, reveal: mat.color, wood: COUNTER_OAK, woodLine: COUNTER_OAK_INK });
        break;
      case 'door':
        this.wallOpening(mat, lit, g, DOOR.t0, DOOR.t1, 0, DOOR.k1, 'door', zoom);
        break;
      case 'double_door':
        this.wallOpening(mat, lit, g, DOUBLE.t0, DOUBLE.t1, 0, DOUBLE.k1, 'double', zoom);
        break;
      case 'arch':
        this.wallArch(mat, lit, g, zoom);
        break;
      case 'portcullis':
        this.wallGateway(wall, border, mat, lit, g, zoom);
        break;
      default:
        break;
    }
  }

  /** How far a thing that moves between two ends is along its way now: nought at one, one at the other. */
  private travel(key: string, to: number, up: number, down: number): number {
    const { m, at } = moveTo(this.gateMotion.get(key), to, this.r.time, up, down);
    this.gateMotion.set(key, m);
    return at;
  }

  /** A portcullis's grille in its arch, as far down as it has dropped. */
  private grille(wall: Wall, border: Border, g: WallFace, lit: number, a: ArchShape): void {
    // The grille goes in with the last of the wall's bill: until then it is an archway being built.
    if (!isDone(wall)) return;
    const down = this.travel(`p:${wall.level}:${border.dir}:${border.x},${border.y}`, wall.lowered ? 1 : 0, PORTCULLIS_DROP, PORTCULLIS_RISE);
    drawGrille(this.r.canvas.ctx, g, a, this.r.camera.zoom, down, lit, WALL_HEIGHT);
  }

  /** How far a drawbridge stands up now: nought lying on the far bank, one on end. */
  drawbridgeUp(b: Bridge): number {
    return this.travel(`b:${b.id}`, b.raised ? 1 : 0, DRAWBRIDGE_RISE, DRAWBRIDGE_FALL);
  }

  /** Where everything about a drawbridge is, and how far up it stands. */
  drawbridgeGeom(b: Bridge): DrawbridgeGeom {
    const ux = Math.sign(b.bx - b.ax), uy = Math.sign(b.by - b.ay);
    return {
      hx: b.ax + 0.5 + ux * 0.5, hy: b.ay + 0.5 + uy * 0.5, ux, uy, nx: -uy, ny: ux,
      len: b.spans.length, h: b.height, up: this.drawbridgeUp(b), groundAt: (x, y) => this.r.game.world.heightAt(x, y),
    };
  }

  /** The light on a drawbridge's planks, as a floor's: a face running across it. */
  deckLit(b: Bridge): number {
    return this.r.faceLight(-Math.sign(b.by - b.ay), Math.sign(b.bx - b.ax));
  }

  /**
   * A drawbridge's gallows and winch, and its deck whenever it is not lying on
   * the far bank, drawn by the tile that has the hinge for a back border --
   * the one in front of it -- as a wall on that border is, but after the
   * roofs that line lays (`gateLate`): a roof is laid a line in front of its
   * own walls, and a gallows a tile in front of a gatehouse stood under its
   * eaves. Seen from the winch side the deck stands behind the gallows; from
   * the far side, in front.
   */
  drawGateAt(x: number, y: number, V: View): void {
    for (const side of V.back) {
      const border = borderOf(x, y, side);
      const key = hingeKey(0, border);
      const landing = this.r.landings.get(key);
      if (landing) this.drawLandingAt(landing);
      const b = this.r.drawbridges.get(key);
      if (!b) continue;
      const zoom = this.r.camera.zoom;
      const g = this.drawbridgeGeom(b);
      const P = this.r.project;
      const lit = this.deckLit(b);
      const done = bridgeDone(b);
      const near = (dx: number, dy: number): boolean => this.r.camera.nearSide(dx, dy) > 0;
      // A face of timber is lit as a wall facing the same way is.
      const faceLit = (ox: number, oy: number): number => this.r.faceLight(-oy, ox);
      // Which side of the hinge the camera is on: the winch's, or the far bank's.
      const winchSide = this.r.camera.nearSide(-g.ux, -g.uy) > 0;
      // A drawbridge set out from a building's floor before that was refused has no gallows in there, nor a crib.
      const open = !this.r.game.buildings.buildingAt(b.ax, b.ay);
      const deck = (): void => {
        if (!done || g.up <= 0) return;
        drawStandingDeck(this.r.canvas.ctx, P, g, zoom, lit, faceLit);
      };
      const crib = (): void => {
        if (open && isDone(b.spans[0])) drawHingeCrib(this.r.canvas.ctx, P, g, zoom, near, faceLit, lit);
      };
      const gallows = (): void => {
        if (!done || !open) return;
        const ctx = this.r.canvas.ctx;
        drawGallows(ctx, P, g, zoom, near, faceLit);
        // The chains: whole when it is off the bank, and the length over the winch end when it lies on it.
        if (g.up > 0) drawChains(ctx, P, g, zoom, lit);
        else drawChains(ctx, P, g, zoom, lit, { d0: -0.2, d1: 0 });
      };
      this.r.gateLate.push(winchSide ? () => { deck(); crib(); gallows(); } : () => { crib(); gallows(); deck(); });
      if (done) {
        // What is clicked for it, standing: the gallows and the deck on end.
        const [lx, ly] = P(g.hx - g.nx * 0.6, g.hy - g.ny * 0.6, Math.max(gallowsTop(g), g.h + g.len * UNITS_PER_TILE * g.up));
        const [rx, ry] = P(g.hx + g.nx * 0.6, g.hy + g.ny * 0.6, g.groundAt(g.hx, g.hy));
        const left = Math.min(lx, rx), top = Math.min(ly, ry);
        this.r.deckHits.push({ x: b.ax, y: b.ay, left, top, w: Math.abs(rx - lx), h: Math.abs(ry - ly), bridge: b.id });
      }
    }
  }

  /** The crib a drawbridge's far end comes down on, laid with the rest of the line its border is the back of. */
  private drawLandingAt(b: Bridge): void {
    const last = b.spans[b.spans.length - 1];
    if (!last || !isDone(last) || this.r.game.buildings.buildingAt(b.bx, b.by)) return;
    const g = this.drawbridgeGeom(b);
    const near = (dx: number, dy: number): boolean => this.r.camera.nearSide(dx, dy) > 0;
    const faceLit = (ox: number, oy: number): number => this.r.faceLight(-oy, ox);
    const lit = this.deckLit(b);
    this.r.gateLate.push(() => drawLandingCrib(this.r.canvas.ctx, this.r.project, g, this.r.camera.zoom, near, faceLit, lit));
  }

  /**
   * What a wall is made of, drawn on its face.
   *
   * Reported as "no character", and the word is fair: every wall on the
   * island was one flat colour with at most a few ruled lines on it, so a log
   * wall and a slate one differed by hue alone. A wall should say what it is
   * from across the deed — logs by the round of them, boarding by the run of
   * the boards, half-timber by its frame, and stone by the size and lie of its
   * blocks. All of it is drawn off the wall's own coordinates, so nothing
   * crawls when the view turns, and none of it is drawn at all from far off.
   */
  private wallGrain(mat: MaterialDef, lit: number, seed: number, g: WallGeom, zoom: number): void {
    const ctx = this.r.canvas.ctx;
    const { px, py, quad } = g;
    /** A band across the face, filled flat. */
    const band = (t0: number, t1: number, k0: number, k1: number, k: number): void => {
      quad(t0, t1, k0, k1);
      ctx.fillStyle = rgb(mat.color, lit * k);
      ctx.fill();
    };
    /** A rule across or up the face, for a joint or a seam. */
    const rule = (t0: number, k0: number, t1: number, k1: number, k: number, a: number): void => {
      ctx.strokeStyle = rgb(mat.trim, lit * k, a);
      ctx.beginPath();
      ctx.moveTo(px(t0, k0), py(t0, k0));
      ctx.lineTo(px(t1, k1), py(t1, k1));
      ctx.stroke();
    };
    /**
     * Courses of blocks, which is most of what masonry is to look at: the
     * mortar showing between them, every other course set half a block over,
     * and no two blocks quite the same colour.
     */
    /** A stone with the corners knocked off it, for anything not cut square. */
    const blob = (t0: number, t1: number, k0: number, k1: number): void => {
      const mt = (t0 + t1) / 2;
      const mk = (k0 + k1) / 2;
      ctx.beginPath();
      ctx.moveTo(px(t0, mk), py(t0, mk));
      ctx.quadraticCurveTo(px(t0, k1), py(t0, k1), px(mt, k1), py(mt, k1));
      ctx.quadraticCurveTo(px(t1, k1), py(t1, k1), px(t1, mk), py(t1, mk));
      ctx.quadraticCurveTo(px(t1, k0), py(t1, k0), px(mt, k0), py(mt, k0));
      ctx.quadraticCurveTo(px(t0, k0), py(t0, k0), px(t0, mk), py(t0, mk));
      ctx.closePath();
    };
    const courses = (rows0: number, cols0: number, jitter: number, gap: number, rough = false): void => {
      /*
       * Half as many blocks from twice as far off. A brick wall is fifty-four
       * little quads at the zoom where you can count them, and a village of
       * that is a lot of paths for a difference nobody can see from there.
       */
      const rows = zoom >= 0.9 ? rows0 : Math.max(2, Math.round(rows0 / 2));
      const cols = zoom >= 0.9 ? cols0 : Math.max(2, Math.round(cols0 / 2));
      quad(0, 1, 0, 1);
      // The mortar showing between. A cut joint is a dark line; rubble is
      // bedded in a pale lime that shows as much as the stone does.
      ctx.fillStyle = rgb(mat.trim, lit * (rough ? 0.92 : 0.82));
      ctx.fill();
      const kh = 1 / rows;
      for (let r = 0; r < rows; r++) {
        const k0 = r * kh + gap * kh;
        const k1 = (r + 1) * kh - gap * kh;
        const off = (r % 2) * 0.5;
        for (let c = -1; c <= cols; c++) {
          // Rubble comes off the field in whatever size it comes off in, so a
          // course of it is not a course of equal stones.
          const w = rough ? 0.62 + hash2(seed + c, r, 29) * 0.38 : 1;
          const t0 = Math.max(0, (c + off) / cols + gap / cols);
          const t1 = Math.min(1, t0 + ((c + 1 + off) / cols - gap / cols - t0) * w);
          if (t1 <= t0) continue;
          const j = hash2(seed + c, r, 19);
          quad(t0, t1, k0, k1);
          // Rubble is picked out against its bedding; ashlar is nearly one tone.
          ctx.fillStyle = rgb(mat.color, lit * ((rough ? 1.05 : 1) + (j - 0.5) * jitter));
          ctx.fill();
        }
      }
    };
    switch (mat.id) {
      case 'log': {
        /*
         * Logs laid one on another. Each is a cylinder, so the light on it
         * runs from a shadow at the bottom through a crown just above the
         * middle to a softer top where it turns away — which is the whole
         * difference between a log wall and a brown rectangle.
         */
        const n = 5;
        for (let i = 0; i < n; i++) {
          const k0 = i / n;
          const k1 = (i + 1) / n;
          quad(0, 1, k0, k1);
          const gr = ctx.createLinearGradient(px(0.5, k0), py(0.5, k0), px(0.5, k1), py(0.5, k1));
          gr.addColorStop(0, rgb(mat.color, lit * 0.7));
          gr.addColorStop(0.55, rgb(mat.color, lit * 1.12));
          gr.addColorStop(1, rgb(mat.color, lit * 0.88));
          ctx.fillStyle = gr;
          ctx.fill();
          if (i) rule(0, k0, 1, k0, 0.8, 0.75);
        }
        break;
      }
      case 'plank': {
        // Boarding: upright boards of slightly different woods, a sill under
        // them and a head over, which is how boarding is actually held on.
        const n = 7;
        for (let i = 0; i < n; i++) {
          const j = hash2(seed, i, 23);
          band(i / n, (i + 1) / n, 0.06, 0.94, 0.9 + j * 0.2);
          if (i) rule(i / n, 0.06, i / n, 0.94, 0.85, 0.5);
        }
        band(0, 1, 0, 0.06, 0.78);
        band(0, 1, 0.94, 1, 0.86);
        break;
      }
      case 'timbercraft': {
        /*
         * Half-timbering: pale daub between dark timbers. The braces are what
         * make it read at a glance — a frame with no braces in it is a window
         * frame, and a frame with them is a house.
         */
        const frame = (t0: number, t1: number, k0: number, k1: number, k: number): void => {
          quad(t0, t1, k0, k1);
          ctx.fillStyle = rgb(mat.trim, lit * k);
          ctx.fill();
        };
        frame(0, 1, 0, 0.08, 0.95);
        frame(0, 1, 0.92, 1, 1.05);
        frame(0, 0.08, 0, 1, 1);
        frame(0.92, 1, 0, 1, 1);
        frame(0.46, 0.54, 0, 1, 1);
        frame(0, 1, 0.47, 0.55, 0.98);
        if (zoom >= 0.7) {
          ctx.strokeStyle = rgb(mat.trim, lit);
          ctx.lineWidth = Math.max(1.5, 3.2 * zoom);
          for (const [a, b] of [[0.08, 0.46], [0.92, 0.54]] as Array<[number, number]>) {
            ctx.beginPath();
            ctx.moveTo(px(a, 0.08), py(a, 0.08));
            ctx.lineTo(px(b, 0.47), py(b, 0.47));
            ctx.stroke();
          }
          ctx.lineWidth = 1;
        }
        break;
      }
      case 'cobblestone':
        // Field stone: round, uneven, and laid in courses only roughly.
        courses(5, 6, 0.3, 0.045, true);
        break;
      case 'stone_brick':
        courses(6, 4, 0.14, 0.055);
        break;
      case 'slate':
        // Thin beds, because that is how slate comes off the hill.
        courses(9, 3, 0.16, 0.05);
        break;
      case 'sandstone':
        courses(5, 3, 0.2, 0.05);
        break;
      case 'clay_bricks':
        courses(9, 6, 0.16, 0.07);
        break;
      case 'marble': {
        // Great ashlar blocks and hardly any joint, and a vein or two.
        courses(3, 2, 0.05, 0.02);
        if (zoom >= 0.9) {
          ctx.strokeStyle = rgb(mat.trim, lit, 0.35);
          for (let i = 0; i < 3; i++) {
            const t = 0.15 + hash2(seed, i, 41) * 0.7;
            const k = 0.15 + hash2(seed, i, 43) * 0.6;
            ctx.beginPath();
            ctx.moveTo(px(t - 0.12, k - 0.06), py(t - 0.12, k - 0.06));
            ctx.quadraticCurveTo(px(t, k + 0.05), py(t, k + 0.05), px(t + 0.13, k - 0.02), py(t + 0.13, k - 0.02));
            ctx.stroke();
          }
        }
        break;
      }
      case 'clay_adobe': {
        /*
         * No joints at all: mud rendered on by hand and left. What says adobe
         * is that nothing about it is straight — patches where one day's
         * render met the next, a heavy dark foot where the rain splashes up
         * it, and a crack or two from the drying.
         */
        if (zoom >= 0.6) {
          for (let i = 0; i < 9; i++) {
            const t = hash2(seed, i, 53);
            const k = hash2(seed, i, 59);
            blob(Math.max(0, t - 0.17), Math.min(1, t + 0.17), Math.max(0, k - 0.13), Math.min(1, k + 0.13));
            ctx.fillStyle = rgb(mat.color, lit * (0.9 + hash2(seed, i, 61) * 0.22));
            ctx.fill();
          }
        }
        // The foot of it, dark where the ground throws the wet back up.
        quad(0, 1, 0, 0.14);
        const foot = ctx.createLinearGradient(px(0.5, 0), py(0.5, 0), px(0.5, 0.14), py(0.5, 0.14));
        foot.addColorStop(0, rgb(mat.trim, lit * 0.82));
        foot.addColorStop(1, rgb(mat.color, lit, 0));
        ctx.fillStyle = foot;
        ctx.fill();
        if (zoom >= 0.9) {
          ctx.strokeStyle = rgb(mat.trim, lit * 0.8, 0.5);
          for (let i = 0; i < 2; i++) {
            const t = 0.22 + hash2(seed, i, 67) * 0.55;
            ctx.beginPath();
            ctx.moveTo(px(t, 0.95), py(t, 0.95));
            ctx.lineTo(px(t + 0.04, 0.68), py(t + 0.04, 0.68));
            ctx.lineTo(px(t - 0.02, 0.42), py(t - 0.02, 0.42));
            ctx.stroke();
          }
        }
        break;
      }
      case 'ornate_silver':
      case 'ornate_gold': {
        // Ashlar with a band of worked metal across it, which is the whole
        // reason anybody spends the silver.
        courses(5, 3, 0.08, 0.04);
        quad(0.04, 0.96, 0.42, 0.6);
        const gr = ctx.createLinearGradient(px(0.04, 0.6), py(0.04, 0.6), px(0.04, 0.42), py(0.04, 0.42));
        gr.addColorStop(0, rgb(mat.trim, lit * 0.9));
        gr.addColorStop(0.45, rgb(mat.color, lit * 1.3));
        gr.addColorStop(1, rgb(mat.trim, lit));
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.strokeStyle = rgb(mat.trim, lit * 0.8);
        ctx.stroke();
        if (zoom >= 0.8) for (let i = 1; i < 6; i++) rule(i / 6, 0.42, i / 6, 0.6, 0.75, 0.6);
        break;
      }
      default:
        break;
    }
  }

  /**
   * An archway: a doorway with nothing hung in it.
   *
   * Asked for as a new doorway type in every material, and it is the one
   * opening whose shape is the point of it. A door is a rectangle with a leaf
   * in it and the leaf is what you look at; an arch is a hole, so the hole has
   * to be worth looking at — which means a true round head, the wall's own
   * thickness carried round the curve as a soffit, and the stones or the
   * timbers that hold the head up drawn as the things that actually hold it up.
   *
   * The head is a real semicircle rather than a squashed one: a tile is forty
   * terrain units across and a storey is thirty up, so a rise of four thirds
   * of the half-width in `k` is a rise equal to it on the ground.
   */
  /**
   * The way through an archway, and the outline of it.
   *
   * Split out of `wallArch` because a cobblestone one is a painted picture
   * with a hole in it rather than a shape drawn over a flat colour, and the
   * two want the same geometry and nothing else in common. The numbers come
   * from `ARCH`, which the texture that cuts the hole reads as well, so the
   * clip and the hole are one statement.
   */
  private archGeom(g: WallGeom, zoom: number): {
    t0: number; t1: number; spring: number; steps: number;
    headT: (u: number) => number; headK: (u: number) => number;
    hole: (s: number) => void; outline: (s: number) => void; rim: (s: number) => void;
  } {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    const { t0, t1, spring } = ARCH;
    const mid = (t0 + t1) / 2;
    const halfW = (t1 - t0) / 2;
    // A true semicircle: the rise above the springing is the half span, said
    // in the units the wall is measured in rather than in fractions of two
    // different things.
    const rise = (halfW * UNITS_PER_TILE) / WALL_HEIGHT;
    const steps = zoom >= 0.9 ? 12 : 6;
    const headT = (u: number): number => mid - halfW * Math.cos(Math.PI * u);
    const headK = (u: number): number => spring + rise * Math.sin(Math.PI * u);
    /** The way through, added to whatever path is open: one shape, several uses. */
    const hole = (s: number): void => {
      ctx.moveTo(px(t0, 0, s), py(t0, 0, s));
      ctx.lineTo(px(t0, spring, s), py(t0, spring, s));
      for (let i = 1; i <= steps; i++) ctx.lineTo(px(headT(i / steps), headK(i / steps), s), py(headT(i / steps), headK(i / steps), s));
      ctx.lineTo(px(t1, 0, s), py(t1, 0, s));
      ctx.closePath();
    };
    const outline = (s: number): void => { ctx.beginPath(); hole(s); };
    /**
     * The same edge, left open at the threshold, for stroking.
     *
     * The closed shape ends by running back along the ground from one jamb to
     * the other, and a line drawn there is a doorstep across a doorway that
     * has not got one.
     */
    const rim = (s: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(t0, 0, s), py(t0, 0, s));
      ctx.lineTo(px(t0, spring, s), py(t0, spring, s));
      for (let i = 1; i <= steps; i++) ctx.lineTo(px(headT(i / steps), headK(i / steps), s), py(headT(i / steps), headK(i / steps), s));
      ctx.lineTo(px(t1, 0, s), py(t1, 0, s));
    };
    return { t0, t1, spring, steps, headT, headK, hole, outline, rim };
  }

  /**
   * What you see through an archway: the far side of the opening, and the
   * wall's own thickness seen edge on all the way round it.
   *
   * Drawn as one strip from the near outline to the far one, which is what
   * makes an arch look cut through something rather than painted on it. It is
   * bounded by the near hole because that is what you are looking through.
   */
  /**
   * The shade under an archway.
   *
   * What you see through one has already been drawn -- the grass, the floor
   * of whatever it lets into, whoever is walking towards you -- and it was
   * drawn in full daylight, because nothing that drew it knew there was three
   * metres of wall standing over it. So the ground inside the opening came
   * out brighter than the ground in front of the opening, and an arch with no
   * shade in it is not a way through: it is a shape painted on a wall.
   *
   * Two washes. One flat over the whole opening, for standing under a wall;
   * one along the head, for standing under the part of it that leans over
   * you. Called clipped to the hole, so neither reaches the stone -- or
   * handed the hole as `region` to lay them in, unclipped.
   */
  private archShade(g: WallGeom, zoom: number, geom: ArchShape | ReturnType<WallPainter['archGeom']> = this.archGeom(g, zoom),
    region: () => void = () => g.quad(0, 1, 0, 1)): void {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    // gates: under a portcullis's gateway too, whose head is its own (`gatewayArch`), laid in the opening's own shape.
    const { spring, headK } = geom;
    region();
    ctx.fillStyle = 'rgba(38, 34, 22, 0.18)';
    ctx.fill();
    // From the crown down to the springing, where the head stops overhanging.
    const top = headK(0.5);
    const wash = ctx.createLinearGradient(px(0.5, top), py(0.5, top), px(0.5, spring), py(0.5, spring));
    wash.addColorStop(0, 'rgba(38, 34, 22, 0.20)');
    wash.addColorStop(1, 'rgba(38, 34, 22, 0)');
    region();
    ctx.fillStyle = wash;
    ctx.fill();
  }

  private archDepth(ink: readonly [number, number, number], lit: number, g: WallGeom, zoom: number,
    geom: ArchShape | ReturnType<WallPainter['archGeom']> = this.archGeom(g, zoom)): void {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    // gates: round a portcullis's gateway too (`gatewayArch`).
    const { t0, t1, spring, steps, headT, headK } = geom;
    /*
     * Nothing is painted on the far side of it.
     *
     * It used to be: a dark gradient over the whole opening, standing in for a
     * room beyond. But an arch is a way through, and what is on the other side
     * of it has already been drawn -- the ground, the floor of whatever it
     * lets into, whoever is walking towards you through it -- because
     * everything further off is drawn first. Painting over that put a black
     * slab in a doorway you can walk through, which on a free-standing wall
     * with nothing behind it but grass is a hole in the world.
     *
     * So only the wall's own thickness is drawn, which is the part that is
     * really there.
     */
    /*
     * Each strip, and the joint at the leading edge of it.
     *
     * Without the joints the reveal is the one surface in the whole wall with
     * no line on it anywhere, and a featureless band of grey in a doorway
     * reads as a sheet of metal taped inside the opening rather than as the
     * broken ends of the courses. Round the head they are the voussoirs seen
     * edge on; down a jamb they are the jamb's own coursing.
     */
    const seam = rgb(ink, lit * 0.52, 0.55);
    const strip = (ta: number, ka: number, tb: number, kb: number, k: number, joint: boolean): void => {
      ctx.fillStyle = rgb(ink, lit * k);
      ctx.beginPath();
      ctx.moveTo(px(ta, ka, 1), py(ta, ka, 1));
      ctx.lineTo(px(tb, kb, 1), py(tb, kb, 1));
      ctx.lineTo(px(tb, kb, -1), py(tb, kb, -1));
      ctx.lineTo(px(ta, ka, -1), py(ta, ka, -1));
      ctx.closePath();
      ctx.fill();
      if (!joint || zoom < 0.55) return;
      ctx.strokeStyle = seam;
      ctx.lineWidth = Math.max(1, 1.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(px(ta, ka, 1), py(ta, ka, 1));
      ctx.lineTo(px(ta, ka, -1), py(ta, ka, -1));
      ctx.stroke();
    };
    /*
     * The jambs stand on edge and the soffit hangs over you, so they do not
     * take the same light: the sky reaches down the sides of a passage and
     * not into the top of it. One step between them is what gives the way
     * through a shape rather than a flat band of grey round a hole, and it
     * darkens the head of the arch, which is where the eye reads the curve.
     */
    // Three courses up each jamb, drawn bottom up so each one lays its joint
    // on the one below it.
    const COURSES = 3;
    for (const t of [t0, t1]) {
      for (let i = 0; i < COURSES; i++) {
        strip(t, (spring * i) / COURSES, t, (spring * (i + 1)) / COURSES, JAMB_LIT, i > 0);
      }
    }
    for (let i = 0; i < steps; i++) {
      // Down the two ends of the head, up to the crown: what is nearly
      // vertical there is still a jamb, what is nearly level is soffit.
      const u = (i + 0.5) / steps;
      const k = JAMB_LIT + (SOFFIT_LIT - JAMB_LIT) * Math.sin(Math.PI * u);
      strip(headT(i / steps), headK(i / steps), headT((i + 1) / steps), headK((i + 1) / steps), k, i % 2 === 1);
    }
  }

  /**
   * A portcullis on a wall drawn in its flat colour (`gates.ts`): the gateway
   * as `wallArch` draws an archway -- its shade, the wall's thickness round
   * it, the edge of it -- with the voussoirs and jamb stones in the
   * material's trim, the grooves, and the grille hung in them.
   */
  private wallGateway(wall: Wall, border: Border, mat: MaterialDef, lit: number, g: WallGeom, zoom: number): void {
    const ctx = this.r.canvas.ctx;
    const geom = gatewayArch(ctx, g, zoom, WALL_HEIGHT);
    ctx.save();
    geom.outline(1);
    ctx.clip();
    this.archShade(g, zoom, geom);
    this.archDepth(mat.color, lit, g, zoom, geom);
    drawGrooves(ctx, g, zoom, geom);
    this.grille(wall, border, g, lit, geom);
    ctx.restore();
    drawGatewayDressing(ctx, g, geom, mat.color.map((c) => c * lit) as unknown as [number, number, number], mat.trim,
      { detail: zoom >= 0.6, line: Math.max(0.8, 1.1 * zoom) });
    geom.rim(1);
    ctx.strokeStyle = rgb(mat.trim, lit * 0.85);
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    ctx.stroke();
  }

  private wallArch(mat: MaterialDef, lit: number, g: WallGeom, zoom: number): void {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    const { t0, t1 } = ARCH;
    const mid = (t0 + t1) / 2;
    const { spring, steps, headT, headK, rim, outline } = this.archGeom(g, zoom);
    ctx.save();
    outline(1);
    ctx.clip();
    this.archShade(g, zoom);
    ctx.restore();
    this.archDepth(mat.color, lit, g, zoom);
    // And the edge of the hole, so the face reads as cut rather than shaded.
    rim(1);
    ctx.strokeStyle = rgb(mat.trim, lit * 0.85);
    ctx.stroke();
    if (zoom < 0.7) return;
    /*
     * And what holds the head up, which is the whole of how an arch is built
     * and differs by what it is built of. Stone is cut into wedges that lean
     * on each other, with a keystone at the crown; timber is bent or built up
     * in a ring and pegged, so it reads as a band rather than as courses.
     */
    if (mat.kind === 'stone') {
      ctx.strokeStyle = rgb(mat.trim, lit * 0.9);
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      const ring = 0.3;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const t = headT(u);
        const k = headK(u);
        // Out along the radius: the joint between one wedge and the next.
        ctx.beginPath();
        ctx.moveTo(px(t, k), py(t, k));
        ctx.lineTo(px(mid + (t - mid) * (1 + ring), spring + (k - spring) * (1 + ring)),
                   py(mid + (t - mid) * (1 + ring), spring + (k - spring) * (1 + ring)));
        ctx.stroke();
      }
      // The keystone, a shade lighter because it is the one that was cut last.
      ctx.beginPath();
      const key = 0.5 / steps;
      for (const [u, r] of [[0.5 - key, 0], [0.5 + key, 0], [0.5 + key, ring], [0.5 - key, ring]] as Array<[number, number]>) {
        const t = mid + (headT(u) - mid) * (1 + r);
        const k = spring + (headK(u) - spring) * (1 + r);
        if (u === 0.5 - key && r === 0) ctx.moveTo(px(t, k), py(t, k));
        else ctx.lineTo(px(t, k), py(t, k));
      }
      ctx.closePath();
      ctx.fillStyle = rgb(mat.color, lit * 1.1);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      // A timber ring, pegged where it meets the jambs.
      ctx.strokeStyle = rgb(mat.trim, lit);
      ctx.lineWidth = Math.max(2, 4.5 * zoom);
      ctx.beginPath();
      ctx.moveTo(px(t0, spring - 0.06), py(t0, spring - 0.06));
      for (let i = 0; i <= steps; i++) ctx.lineTo(px(headT(i / steps), headK(i / steps), 1), py(headT(i / steps), headK(i / steps), 1));
      ctx.lineTo(px(t1, spring - 0.06), py(t1, spring - 0.06));
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  /**
   * A hole in a wall, with the wall's own thickness showing round it.
   *
   * The leaf or the glass sits on the back plane rather than on the face, so
   * the reveal — the jamb and the head — is the wall itself seen edge on, and
   * comes out of the projection rather than out of a drawn line. A window that
   * was painted on the front of a sheet is a window on a sheet.
   */
  /**
   * How much of a light is burning in the room this wall shuts in.
   *
   * Only asked after dark, and only of a window, so the flood fill behind it
   * runs on a handful of walls in the few frames that want it. Something on
   * one of the room's own tiles is inside; a fire in the yard is not, however
   * near the glass it stands.
   */
  private lampBehind(wall: Wall, border: Border): number {
    return this.roomLight(wall, border) * this.r.game.darkness();
  }

  /** The brightest light burning in the room a wall shuts in, after dark (`LAMP_DARK`); none before. */
  private roomLight(wall: Wall, border: Border): number {
    const dark = this.r.game.darkness();
    if (dark < LAMP_DARK) return 0;
    const near = this.r.game.buildings.buildingAt(border.x, border.y)
      ? { x: border.x, y: border.y }
      : border.dir === 'h' ? { x: border.x, y: border.y - 1 } : { x: border.x - 1, y: border.y };
    // Each room's light is found once a frame, for every wall of it: the room is a flood fill, and it was one a wall.
    if (this.roomLitFrame !== this.r.frameNo) {
      this.roomLitFrame = this.r.frameNo;
      this.roomLit.clear();
    }
    const known = this.roomLit.get(`${wall.level}|${near.x},${near.y}`);
    if (known !== undefined) return known;
    const room = this.r.game.buildings.room(wall.level, near.x, near.y);
    if (!room) {
      this.roomLit.set(`${wall.level}|${near.x},${near.y}`, 0);
      return 0;
    }
    const inside = new Set(room.tiles);
    let most = 0;
    // The frame's own (`lightsNow`): gathered once a frame, not once a wall.
    for (const l of this.r.lightsNow) {
      if (!inside.has(`${Math.floor(l.x)},${Math.floor(l.y)}`)) continue;
      most = Math.max(most, l.strength);
    }
    for (const t of room.tiles) this.roomLit.set(`${wall.level}|${t}`, most);
    return most;
  }

  /**
   * A pane, and a window with something burning behind it.
   *
   * Glass was drawn in every window on the island from the first day and
   * never made, never paid for and never once lit: a window at midnight was
   * the same cold blue pane as a window at noon, in a room with a fire in it.
   * `alight` is how much of a light is in the room behind this wall, and it
   * warms the pane and takes the sky out of it.
   */
  private pane(g: WallGeom, t0: number, t1: number, k0: number, k1: number, alight: number): CanvasGradient {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    const gr = ctx.createLinearGradient(px(t0, k1, -1), py(t0, k1, -1), px(t1, k0, -1), py(t1, k0, -1));
    /*
     * Glass stained through with a dye (`Wall.glass`): the dye's own colour
     * with the sky's glint along the top of it, warmed toward the light when
     * something burns behind it, and a touch more solid than clear glass.
     */
    const tint = this.paneTint;
    if (tint) {
      const k = Math.min(1, Math.max(0, alight));
      const at = (lift: number, warm: number, a: number): string => {
        const ch = (v: number, glow: number): number => Math.round(Math.min(255, v + (255 - v) * lift + glow * k * warm));
        return `rgba(${ch(tint[0], 70)}, ${ch(tint[1], 40)}, ${ch(tint[2], 0)}, ${a})`;
      };
      gr.addColorStop(0, at(0.45, 1, 0.88));
      gr.addColorStop(0.55, at(0.05, 1.2, 0.86));
      gr.addColorStop(1, at(0.25, 1, 0.88));
      return gr;
    }
    if (alight > 0) {
      const k = Math.min(1, alight);
      gr.addColorStop(0, `rgba(${(198 + 52 * k) | 0}, ${(226 - 26 * k) | 0}, ${(244 - 110 * k) | 0}, 0.9)`);
      gr.addColorStop(0.55, `rgba(${(126 + 124 * k) | 0}, ${(170 + 20 * k) | 0}, ${(205 - 110 * k) | 0}, ${0.8 + 0.15 * k})`);
      gr.addColorStop(1, `rgba(${(158 + 82 * k) | 0}, ${(198 - 10 * k) | 0}, ${(226 - 120 * k) | 0}, 0.9)`);
    } else {
      gr.addColorStop(0, 'rgba(198, 226, 244, 0.85)');
      gr.addColorStop(0.55, 'rgba(126, 170, 205, 0.8)');
      gr.addColorStop(1, 'rgba(158, 198, 226, 0.85)');
    }
    return gr;
  }

  /**
   * The leaf hung between the piers of a field wall.
   *
   * Five bars and a brace across them, which is what a gate is when it has to
   * be light enough to swing and stiff enough not to drop on its hinges. In
   * oak it is the same timber as the beam over a doorway; in iron it is the
   * same bars with two straps across them and no wood in it at all.
   *
   * It hangs behind the piers rather than between them, because a gate in a
   * gap is a gate that jams the first time the wall settles.
   */
  private fenceGate(cob: Masonry, g: WallGeom, zoom: number, iron: boolean): void {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    const { t0, t1 } = FENCE_GAP;
    const S = -0.55, k0 = 0.06, k1 = 0.9;
    const a = t0 + 0.015, b = t1 - 0.015;
    /*
     * The side of the pier the gap was cut from, whichever one faces us.
     *
     * The leaf hangs back in the wall's thickness, behind the face, so from
     * any angle there is a strip between the pier's edge on the face and the
     * leaf's stile where what shows is the pier's own side. Nothing drew it,
     * and the grass showed through a slit down the whole height of the gate.
     *
     * Which of the two jambs is towards us is the question a face's winding
     * answers: the face of the wall is drawn on the side the camera is on, so
     * a jamb whose outline turns the same way round on screen is facing us
     * and the other is facing away, behind the pier it belongs to.
     */
    const at = (t: number, k: number, s: number): [number, number] => [px(t, k, s), py(t, k, s)];
    const turn = (pts: Array<[number, number]>): number => {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const [xa, ya] = pts[i], [xb, yb] = pts[(i + 1) % pts.length];
        sum += xa * yb - xb * ya;
      }
      return Math.sign(sum);
    };
    const face = turn([at(0, 0, 1), at(1, 0, 1), at(1, 1, 1), at(0, 1, 1)]);
    for (const [t, out] of [[t0, 1], [t1, -1]] as Array<[number, number]>) {
      // Round the jamb the way that makes its outward side +t or -t, as the
      // face is laid round so that its outward side is the camera's.
      const ring = [at(t, 0, -1), at(t, 1, -1), at(t, 1, 1), at(t, 0, 1)];
      if (out < 0) ring.reverse();
      if (turn(ring) !== face) continue;
      ctx.beginPath();
      for (const [x, y] of ring) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = rgb(cob.reveal, 0.86);
      ctx.fill();
      ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
      ctx.lineWidth = Math.max(1, 1.2 * zoom);
      ctx.stroke();
    }
    /**
     * One member of it, drawn as timber is drawn everywhere else in the game:
     * the dark of the wood laid down wide and the wood itself laid on top of
     * it, so a rail crossing a field has an outline and reads as a rail. Iron
     * is one stroke, because a bar of iron is a line.
     */
    const seg = (ta: number, ka: number, tb: number, kb: number, ink: readonly [number, number, number], lw: number): void => {
      ctx.strokeStyle = rgb(ink, 1);
      ctx.lineWidth = Math.max(1, lw * zoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px(ta, ka, S), py(ta, ka, S));
      ctx.lineTo(px(tb, kb, S), py(tb, kb, S));
      ctx.stroke();
    };
    const bar = (ta: number, ka: number, tb: number, kb: number, w: number): void => {
      // Iron gets the same two strokes the timber does. A bar drawn once in
      // one flat near-black is the only thing in the asset with no value in
      // it, and a gate made of thirteen of them is a drain grate.
      if (iron) { seg(ta, ka, tb, kb, IRON_DARK, w + 0.9); seg(ta, ka, tb, kb, IRON, w); return; }
      seg(ta, ka, tb, kb, cob.beamLine, w + 1.4);
      seg(ta, ka, tb, kb, cob.beam, w);
    };
    /*
     * A gate in a field wall is a frame with the field showing through it.
     *
     * The oak one was a filled leaf with its bars drawn on the face of it,
     * which is a door -- and a door is the one thing that cannot be hung in a
     * dry wall. A field gate is open because a man swings it one-handed and
     * because a gale has to go through it rather than take it away. So both
     * of them are open now, and what tells them apart is what they are made
     * of: five heavy bars and a brace in oak, a grid in iron.
     */
    /*
     * And they are not the same gate in two colours.
     *
     * The iron one was the oak one painted grey: the same five rails, the
     * same lapped brace, the same weight of member. Iron is not laid up like
     * timber -- a smith sets uprights in a top and a bottom rail, because
     * that is what he can forge and weld -- so the iron gate is uprights and
     * two rails, at a third of the oak's weight, and its tone is cold where
     * the oak's is warm.
     */
    const heavy = iron ? 1 : 1.38;
    /*
     * Two of the eight rotations look along the wall, and a shut gate lies in
     * the wall's plane: what you see of it then is its edge. Drawn as a gate
     * anyway, its five bars land on top of each other inside four pixels and
     * come out as one fat brown pill. So at that angle it is what it is --
     * one member, the thickness of a stile.
     */
    const span = Math.hypot(px(b, k0, S) - px(a, k0, S), py(b, k0, S) - py(a, k0, S));
    if (span < 14) {
      const m = (a + b) / 2;
      bar(m, k0, m, k1, 2.6 * heavy);
      return;
    }
    for (const k of iron ? [k0, k1] : [k0, 0.28, 0.5, 0.71, k1]) bar(a, k, b, k, 2.1 * heavy);
    bar(a, k0, a, k1, 2.6 * heavy);
    bar(b, k0, b, k1, 2.6 * heavy);
    if (iron) {
      if (zoom >= 0.5) for (let i = 1; i < 6; i++) bar(a + (b - a) * (i / 6), k0, a + (b - a) * (i / 6), k1, 1.1);
      bar(a, k0 + 0.04, b, k1 - 0.04, 1.5);
    } else {
      // The brace, rising from the foot of the hinge stile to the head of the
      // latch stile, which is the way round it has to go if it is to carry the
      // gate's weight instead of hanging off it. It ran from the head of the
      // hinge stile down, the one way round a brace in wood does nothing.
      bar(a, k0 + 0.03, b, k1 - 0.03, 2.3 * heavy);
    }
    /*
     * And the straps it swings on, which are iron on either gate.
     *
     * Tapered, because a strap is wide where it is bolted to the hinge and
     * narrow where it runs out along the rail. A bar of one width with round
     * ends, three times the weight of anything else on the gate, is a cable
     * tie.
     */
    if (zoom >= 0.5) {
      for (const k of [0.24, 0.76]) {
        seg(a, k, a + (b - a) * 0.14, k, IRON_DARK, 1.9);
        seg(a + (b - a) * 0.14, k, a + (b - a) * 0.3, k, IRON_DARK, 1.1);
        seg(a, k, a, k, IRON, 2.2);
      }
    }
    ctx.lineWidth = 1;
  }

  /**
   * The threshold: the one stone in a wall that gets walked on.
   *
   * It is the floor of the opening, seen in plan, and it is the lightest
   * surface in the whole of it because it is the only one lying face up at
   * the sky. The hollow worn down its middle is the part that says a doorway
   * is used rather than drawn: nothing else on the wall has anybody's boots
   * in it.
   */
  private threshold(cob: Masonry, g: WallGeom, t0: number, t1: number, zoom: number): void {
    const ctx = this.r.canvas.ctx;
    const { px, py, quad } = g;
    const slab = (a: number, b: number, s: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(a, 0, s), py(a, 0, s));
      ctx.lineTo(px(b, 0, s), py(b, 0, s));
      ctx.lineTo(px(b, 0, -s), py(b, 0, -s));
      ctx.lineTo(px(a, 0, -s), py(a, 0, -s));
      ctx.closePath();
    };
    slab(t0, t1, 1);
    ctx.fillStyle = rgb(cob.reveal, STEP_LIT);
    ctx.fill();
    ctx.strokeStyle = rgb(cob.line, 0.9, 0.5);
    ctx.lineWidth = Math.max(1, 1.2 * zoom);
    ctx.stroke();
    if (zoom < 0.7) return;
    const w = (t1 - t0) * 0.16;
    slab(t0 + w, t1 - w, 0.62);
    ctx.fillStyle = rgb(cob.reveal, STEP_LIT * 0.88);
    ctx.fill();
    void quad;
  }

  /**
   * A painted wall's doorway: the threshold, the reveal, and the leaf.
   *
   * The head of the reveal is the underside of the beam rather than stone,
   * which is the whole of what makes this opening different from the window
   * over it -- you are looking at the one piece of timber in the wall, from
   * below, and it is holding up two and a quarter metres of rubble.
   */
  private paintedDoor(cob: Masonry, g: WallGeom, zoom: number, leaves: 1 | 2): void {
    const ctx = this.r.canvas.ctx;
    const { px, py, quad } = g;
    const { t0, t1, k1 } = leaves === 2 ? DOUBLE : DOOR;
    this.threshold(cob, g, t0, t1, zoom);
    const strip = (ax: number, ak: number, bx: number, bk: number, k: number, ink: readonly [number, number, number]): void => {
      ctx.fillStyle = rgb(ink, k);
      ctx.beginPath();
      ctx.moveTo(px(ax, ak, 1), py(ax, ak, 1));
      ctx.lineTo(px(bx, bk, 1), py(bx, bk, 1));
      ctx.lineTo(px(bx, bk, -1), py(bx, bk, -1));
      ctx.lineTo(px(ax, ak, -1), py(ax, ak, -1));
      ctx.closePath();
      ctx.fill();
    };
    strip(t0, 0, t0, k1, JAMB_LIT, cob.reveal);
    strip(t1, 0, t1, k1, JAMB_LIT, cob.reveal);
    strip(t0, k1, t1, k1, SOFFIT_LIT, cob.beam);
    // And the leaf, hung on the back plane: boards up and down, two ledges
    // across them, and the straps that hold it to the wall.
    quad(t0, t1, 0, k1, -1);
    ctx.fillStyle = rgb(cob.beam, 0.96);
    ctx.fill();
    if (zoom < 0.7) {
      ctx.strokeStyle = rgb(cob.beamLine, 0.9);
      ctx.stroke();
      return;
    }
    const board = (t: number, a: number, b: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(t, a, -1), py(t, a, -1));
      ctx.lineTo(px(t, b, -1), py(t, b, -1));
      ctx.stroke();
    };
    ctx.strokeStyle = rgb(cob.beamLine, 0.95, 0.6);
    ctx.lineWidth = Math.max(1, 1.3 * zoom);
    const planks = leaves === 2 ? 10 : 5;
    for (let i = 1; i < planks; i++) board(t0 + ((t1 - t0) * i) / planks, 0.03, k1 - 0.03);
    /*
     * Which stile of the leaf you can see.
     *
     * The leaf hangs on the back plane and the opening is cut in the front
     * one, so the wall's own thickness hides about a third of it, off one
     * edge or the other depending which way the section is turned. Both the
     * straps and the ring go in the part that shows: the straps anchored on
     * the stile you can see and running two fifths of the way over, the ring
     * just inside where the jamb starts cutting the leaf off. A strap whose
     * anchored end is behind the wall is a dash floating on a door.
     */
    const at = (u: number): number => t0 + (t1 - t0) * u;
    /*
     * How much of the leaf you can actually see, as a fraction of it.
     *
     * The leaf hangs on the back plane and the opening is cut in the front
     * one, so the wall's thickness hides a third of it off one edge -- which
     * edge, and how much, depends on which way the section is turned. This was
     * a guess at first: a sign test on which way the back plane moves, and a
     * ring placed a fixed distance in from the end it decided was showing.
     * Turn the view a quarter and the guess was wrong and the ring came out
     * half over the jamb.
     *
     * So it is measured instead. The near opening runs between two screen
     * points and so does the leaf; where they overlap is what you can see, and
     * everything hung on the leaf is placed inside that.
     */
    const a = px(t0, 0, 1), b = px(t1, 0, 1);
    const a2 = px(t0, 0, -1), b2 = px(t1, 0, -1);
    const uOf = (x: number): number => (x - a2) / (b2 - a2 || 1);
    const ends = [uOf(Math.max(Math.min(a, b), Math.min(a2, b2))), uOf(Math.min(Math.max(a, b), Math.max(a2, b2)))];
    const u0 = Math.max(0, Math.min(ends[0], ends[1]));
    const u1 = Math.min(1, Math.max(ends[0], ends[1]));
    const span = Math.max(0.2, u1 - u0);
    // The straps are anchored on the stile that shows, because a strap whose
    // anchored end is behind the wall is a dash floating on a door; the ring
    // goes as far the other way as the opening lets it.
    const hinge = u0 <= 0.02 ? 0 : 1;
    /*
     * A gate is two leaves and the line where they meet, and they hang the
     * way a pair of gates hangs: each on the stile at its own outer edge,
     * each pulled by a ring at the middle. So the straps run outward-in from
     * both ends and the rings sit either side of the meeting line, which is
     * the one part of a wide opening the wall's thickness never hides.
     */
    // Where the two leaves meet: a shadow the width of a finger, not a line
    // like the ones between boards, or a gate reads as one wide door.
    if (leaves === 2) {
      quad(at(0.487), at(0.513), 0.02, k1 - 0.02, -1);
      ctx.fillStyle = rgb(cob.beamLine, 0.85, 0.6);
      ctx.fill();
    }
    for (const k of [k1 * 0.24, k1 * 0.76]) {
      quad(t0 + 0.006, t1 - 0.006, k - 0.045, k + 0.045, -1);
      ctx.fillStyle = rgb(cob.beam, 1.12);
      ctx.fill();
      ctx.strokeStyle = rgb(cob.beamLine, 0.9, 0.55);
      ctx.stroke();
      // The strap runs out of the ledge over the boards and stops short of
      // the far stile. Thin: a band of iron the depth of the ledge is a black
      // bar across the door and reads as a gap, not as ironwork.
      const bands: Array<[number, number]> = leaves === 2
        ? [[0.02, 0.30], [0.70, 0.98]]
        : [hinge ? [u1 - span * 0.72, u1] : [u0, u0 + span * 0.72]];
      for (const [a, b] of bands) {
        quad(at(a), at(b), k - 0.015, k + 0.015, -1);
        ctx.fillStyle = rgb(IRON, 1);
        ctx.fill();
      }
    }
    // And a ring to pull it by -- one on a door, one to each leaf on a gate.
    const rings = leaves === 2 ? [0.5 - 0.125, 0.5 + 0.125] : [hinge ? u0 + span * 0.26 : u1 - span * 0.26];
    ctx.strokeStyle = rgb(IRON, 1);
    ctx.lineWidth = Math.max(1, 1.1 * zoom);
    for (const u of rings) {
      const cx = px(at(u), k1 * 0.5, -1), cy = py(at(u), k1 * 0.5, -1);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, 3.6 * zoom * (leaves === 2 ? 0.72 : 1)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  /**
   * The bay, which is the only part of a wall that is not in it.
   *
   * Everything else an opening is made of lies between the two faces of the
   * wall and comes out of `px` with an `s` of one or minus one. A bay is a box
   * of glass standing on a shelf, three sides of it out in the weather, and it
   * is drawn where it actually is: `OUT` past the near face, canted back to
   * the jambs so the two cheeks look along the wall.
   *
   * Which cheek you can see depends on which way the section is turned, and
   * there is no depth buffer here to work it out, so each face is wound the
   * same way round and one whose projected area comes out with the wrong sign
   * is facing away and is not drawn. That is the whole of it: a bay is four
   * quads and a rule about which of them are yours to look at.
   */
  private paintedBay(cob: Masonry, g: WallGeom, zoom: number, alight: number): void {
    const ctx = this.r.canvas.ctx;
    const { px, py } = g;
    const { t0, t1, k0, k1 } = BAY;
    /** How far the box stands off the near face, in half-thicknesses of wall. */
    const OUT = 3.4;
    /** How far in the cheeks come, so they look along the wall and not across it. */
    const CANT = 0.1;
    /** The lid falls away from the wall, because a flat one would hold the rain. */
    const kLid = k1 - 0.045;
    const a0 = t0 + CANT, a1 = t1 - CANT;
    type P = [number, number, number];
    const pt = ([t, k, s]: P): [number, number] => [px(t, k, s), py(t, k, s)];
    /** Twice the signed area of a projected face: negative means it is turned away. */
    const facing = (q: Array<[number, number]>): number => {
      let a = 0;
      for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p[0] * r[1] - r[0] * p[1]; }
      return a;
    };
    const path = (q: Array<[number, number]>): void => {
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
      ctx.closePath();
    };
    const front: P[] = [[a0, k1, OUT], [a1, k1, OUT], [a1, k0, OUT], [a0, k0, OUT]];
    const sign = Math.sign(facing(front.map(pt)));
    /** A light of the bay: the glass, the frame round it and the bars across it. */
    const light = (face: P[], bars: number): void => {
      const q = face.map(pt);
      if (Math.sign(facing(q)) !== sign) return;
      path(q);
      ctx.fillStyle = this.pane({ px, py, quad: g.quad }, t0, t1, k0, k1, alight);
      ctx.fill();
      ctx.strokeStyle = rgb(cob.line, 0.95, 0.8);
      ctx.lineWidth = Math.max(1, 1.6 * zoom);
      ctx.stroke();
      if (zoom < 0.7) return;
      // The bars: `bars` up the light and one across it, struck between the
      // corners of the face itself so they follow it however it is turned.
      const lerp = (p: [number, number], r: [number, number], u: number): [number, number] =>
        [p[0] + (r[0] - p[0]) * u, p[1] + (r[1] - p[1]) * u];
      ctx.lineWidth = Math.max(1, 1.2 * zoom);
      ctx.beginPath();
      for (let i = 1; i <= bars; i++) {
        const u = i / (bars + 1);
        const a = lerp(q[0], q[1], u), b = lerp(q[3], q[2], u);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      const l = lerp(q[0], q[3], 0.5), r = lerp(q[1], q[2], 0.5);
      ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]);
      ctx.stroke();
    };
    // The apron under it, so the box is standing on something rather than
    // hanging: the shelf's own edge, following the bay's plan.
    const apron: P[] = [[t0, k0, 1], [a0, k0, OUT], [a1, k0, OUT], [t1, k0, 1]];
    const skirt = apron.map(pt).concat(apron.slice().reverse().map(([t, , s]) => pt([t, k0 - 0.05, s])));
    /*
     * And the two brackets under it, before the apron, so the apron sits on
     * their heads. A box of glass a metre off the ground with nothing under
     * it is a box of glass floating, and the eye says so before it has
     * worked out why.
     */
    ctx.strokeStyle = rgb(cob.line, 0.95, 0.6);
    ctx.lineWidth = Math.max(1, 1.4 * zoom);
    for (const t of [t0 + 0.07, t1 - 0.07]) {
      const wedge: P[] = [[t, k0, 1], [t, k0, OUT * 0.85], [t, k0 - 0.19, 1]];
      path(wedge.map(pt));
      ctx.fillStyle = rgb(cob.reveal, 0.74);
      ctx.fill();
      ctx.stroke();
    }
    path(skirt);
    ctx.fillStyle = rgb(cob.reveal, 0.82);
    ctx.fill();
    ctx.stroke();
    light([[t0, k1, 1], [a0, kLid, OUT], [a0, k0, OUT], [t0, k0, 1]], 1);
    light([[a1, kLid, OUT], [t1, k1, 1], [t1, k0, 1], [a1, k0, OUT]], 1);
    light([[a0, kLid, OUT], [a1, kLid, OUT], [a1, k0, OUT], [a0, k0, OUT]], 2);
    // And the lid over the lot, which is the same slab the wall is capped with.
    const lid: P[] = [[t0, k1, 1], [t1, k1, 1], [a1, kLid, OUT], [a0, kLid, OUT]];
    path(lid.map(pt));
    ctx.fillStyle = rgb(cob.reveal, 1.1);
    ctx.fill();
    ctx.strokeStyle = rgb(cob.line, 0.95, 0.7);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  /**
   * A painted wall's window: the reveal, the pane on the back plane, and the
   * bars across it.
   *
   * The same three surfaces an archway has and the same reason for each of
   * them -- the jambs keep most of the light because the sky reaches down the
   * sides of a hole, the head keeps least because nothing reaches the
   * underside of a lintel -- and one more, the inside of the sill, which is
   * the only surface in a wall turned up at the sky and so the lightest thing
   * in the opening. Drawn unlit: the wash over the whole face takes the hour.
   */
  private paintedGlass(cob: Masonry, g: WallGeom, zoom: number, alight: number,
                   rect: { t0: number; t1: number; k0: number; k1: number } = WINDOW): void {
    const ctx = this.r.canvas.ctx;
    const { px, py, quad } = g;
    const { t0, t1, k0, k1 } = rect;
    const strip = (ax: number, ak: number, bx: number, bk: number, k: number): void => {
      ctx.fillStyle = rgb(cob.reveal, k);
      ctx.beginPath();
      ctx.moveTo(px(ax, ak, 1), py(ax, ak, 1));
      ctx.lineTo(px(bx, bk, 1), py(bx, bk, 1));
      ctx.lineTo(px(bx, bk, -1), py(bx, bk, -1));
      ctx.lineTo(px(ax, ak, -1), py(ax, ak, -1));
      ctx.closePath();
      ctx.fill();
    };
    strip(t0, k0, t0, k1, JAMB_LIT);
    strip(t1, k0, t1, k1, JAMB_LIT);
    strip(t0, k1, t1, k1, SOFFIT_LIT);
    strip(t0, k0, t1, k0, SILL_LIT);
    quad(t0, t1, k0, k1, -1);
    ctx.fillStyle = this.pane(g, t0, t1, k0, k1, alight);
    ctx.fill();
    if (zoom < 0.7) return;
    ctx.strokeStyle = rgb(cob.line, 0.9, 0.75);
    ctx.lineWidth = Math.max(1, 1.6 * zoom);
    // One bar up and one across, which is what a small pane looks like.
    ctx.beginPath();
    ctx.moveTo(px((t0 + t1) / 2, k0, -1), py((t0 + t1) / 2, k0, -1));
    ctx.lineTo(px((t0 + t1) / 2, k1, -1), py((t0 + t1) / 2, k1, -1));
    ctx.moveTo(px(t0, (k0 + k1) / 2, -1), py(t0, (k0 + k1) / 2, -1));
    ctx.lineTo(px(t1, (k0 + k1) / 2, -1), py(t1, (k0 + k1) / 2, -1));
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  private wallOpening(mat: MaterialDef, lit: number, g: WallGeom,
                      t0: number, t1: number, k0: number, k1: number,
                      what: 'glass' | 'door' | 'double', zoom: number, alight = 0): void {
    const ctx = this.r.canvas.ctx;
    const { px, py, quad } = g;
    // The reveal: the sides and head of the hole, which are in shadow because
    // they face across the wall rather than along it.
    ctx.fillStyle = rgb(mat.color, lit * 0.6);
    for (const [a, b] of [[t0, t0], [t1, t1]] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.moveTo(px(a, k0, 1), py(a, k0, 1));
      ctx.lineTo(px(b, k0, -1), py(b, k0, -1));
      ctx.lineTo(px(b, k1, -1), py(b, k1, -1));
      ctx.lineTo(px(a, k1, 1), py(a, k1, 1));
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(px(t0, k1, 1), py(t0, k1, 1));
    ctx.lineTo(px(t1, k1, 1), py(t1, k1, 1));
    ctx.lineTo(px(t1, k1, -1), py(t1, k1, -1));
    ctx.lineTo(px(t0, k1, -1), py(t0, k1, -1));
    ctx.closePath();
    ctx.fillStyle = rgb(mat.color, lit * 0.48);
    ctx.fill();
    // And what is hung in it, on the back plane.
    quad(t0, t1, k0, k1, -1);
    if (what === 'glass') {
      ctx.fillStyle = this.pane(g, t0, t1, k0, k1, alight);
    } else {
      ctx.fillStyle = rgb(mat.floor, lit * 0.5, 0.95);
    }
    ctx.fill();
    ctx.strokeStyle = rgb(mat.trim, lit * 0.8);
    ctx.stroke();
    const line = (t: number, a: number, b: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(t, a, -1), py(t, a, -1));
      ctx.lineTo(px(t, b, -1), py(t, b, -1));
      ctx.stroke();
    };
    if (zoom < 0.7) return;
    ctx.lineWidth = Math.max(1, 1.6 * zoom);
    if (what === 'glass') {
      // Bars: one up and one across, which is what a small pane looks like.
      ctx.strokeStyle = rgb(mat.trim, lit);
      line((t0 + t1) / 2, k0, k1);
      ctx.beginPath();
      ctx.moveTo(px(t0, (k0 + k1) / 2, -1), py(t0, (k0 + k1) / 2, -1));
      ctx.lineTo(px(t1, (k0 + k1) / 2, -1), py(t1, (k0 + k1) / 2, -1));
      ctx.stroke();
    } else {
      // Boards down the leaf, and the gap where a double door meets.
      ctx.strokeStyle = rgb(mat.trim, lit * 0.7);
      const leaves = what === 'double' ? 2 : 1;
      for (let i = 1; i < leaves * 3; i++) line(t0 + ((t1 - t0) * i) / (leaves * 3), k0 + 0.03, k1 - 0.03);
      if (what === 'double') {
        ctx.strokeStyle = rgb(mat.trim, lit);
        line((t0 + t1) / 2, k0, k1);
      }
    }
    ctx.lineWidth = 1;
  }
}
