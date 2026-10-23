import { FACINGS, furnitureDef } from '../game/furniture';
import type { Side } from '../game/building';
import { HALF_H, HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { VIEWS } from './view';
import { aboveGround, BAKE_STEPS, canvasOf, CREASE_INK, css, dot, eyeOfView, faceColour, lightOf, mix, proj, scaleFor, type Ctx, type Eye, type Face, type PaintCtx, type Pt, type RGB, type V3 } from './runestone';
import { centre, KIT_INK, KIT_INK_W, litEdges, type KitAir, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView } from './kit/core';
import { KIT_PIECES } from './kit/index';

/**
 * Furniture drawn in the runestones' kit, whatever the piece: the generic half
 * of it. A piece says what it is made of (`KitPiece` in `kit/core.ts`,
 * registered in `kit/index.ts`); this builds its model once for each look it
 * depends on, lays its parts back to front from where they stand, bakes them
 * for each way it is seen and each scale (`BAKE_STEPS`), keeps so many pixels
 * of bakes and lets the least lately drawn go, bakes the turns either side
 * and the next scale up while the browser is idle, and lays the bake with
 * one `drawImage` a frame.
 *
 * `drawFurniture` (furniture.ts) sends every registered kind here before it
 * looks at `MODELS`, so nothing else in the renderer changes: the same click
 * box comes back (left, top, right, bottom in screen pixels from the floor
 * contact, round the solids), a piece drawn in layers (`KitPiece.layers`)
 * lays the layer its `trim` names, and what moves on it is drawn by
 * `drawFurnitureLive`, which asks `drawKitLive`.
 */

/* ---- the switches a harness wants ------------------------------------------------ */

/** Whether the kit is passed over, so the old model is drawn: for setting old beside new (`tools/piece-sheet.mjs`). The island never asks. */
let bypass = false;
export const kitBypass = (on: boolean): void => { bypass = on; };
/** Whether every bake is made the moment it is wanted, as a harness wants: the island never asks. */
let sync = false;
export const kitSync = (on: boolean): void => { sync = on; };

/** Whether a kind of piece is drawn in the kit. */
export const isKit = (kind: string): boolean => !bypass && Object.prototype.hasOwnProperty.call(KIT_PIECES, kind);

/* ---- models ------------------------------------------------------------------------ */

const sizeOf = (kind: string): { hw: number; hd: number } => {
  const def = furnitureDef(kind);
  return { hw: def.w * 5, hd: def.h * 5 };
};

/** What of a look a piece's model is built from, as a key: what it does not use is left out, so it shares its bakes. */
function lookKey(piece: KitPiece, look: KitLook): string {
  const u = piece.uses ?? { lit: true, tint: true, trim: true, material: true };
  const trim = piece.layers || !u.trim || look.trim === undefined ? '' : Number.isInteger(look.trim) ? look.trim : Math.round(look.trim * 20) / 20;
  const key = `${u.lit && look.lit ? 1 : 0}|${u.tint ? look.tint?.colour ?? '' : ''}|${trim}|${u.material ? (look.material ?? '').toLowerCase() : ''}`;
  // A burning piece's flicker, only when it is lit and flickers: every other look keeps the one key it always had.
  return look.frame === undefined ? key : `${key}|f${look.frame}`;
}

/**
 * Models built, by kind and look, the least lately wanted let go past
 * `MODELS_KEPT`: one is shared by every view and scale it is baked at, but
 * the looks a settlement can ask for -- every crate mask, rose day, flicker,
 * dye and wood -- are without end.
 */
const MODELS_KEPT = 600;
const models = new Map<string, KitModel>();
function modelOf(kind: string, look: KitLook): KitModel {
  const piece = KIT_PIECES[kind];
  const key = `${kind}|${lookKey(piece, look)}`;
  let m = models.get(key);
  if (m) { models.delete(key); models.set(key, m); return m; }
  // What it is built for: a layered piece's trim is the layer, never the model's.
  m = piece.model(piece.layers ? { ...look, trim: undefined } : look, sizeOf(kind));
  models.set(key, m);
  if (models.size > MODELS_KEPT) models.delete(models.keys().next().value as string);
  return m;
}

/** How tall a piece stands, in pixels at zoom one, as it is drawn plain: `FURNITURE_HEIGHT` for a kit piece. */
export function kitHeight(kind: string): number {
  const piece = KIT_PIECES[kind];
  const m = piece.model({ lit: false }, sizeOf(kind));
  let z = 0;
  for (const p of m.parts) if (p.solid ?? !!p.faces) for (const q of [...(p.faces ?? []).flatMap((f) => f.pts), ...(p.reach ?? [])]) z = Math.max(z, q[2]);
  return Math.ceil(z * HEIGHT_SCALE);
}

/* ---- laying the parts in order ------------------------------------------------------ */

type Box6 = [number, number, number, number, number, number];
function boxOf3(p: KitPart): Box6 {
  const b: Box6 = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  const take = (q: V3): void => {
    b[0] = Math.min(b[0], q[0]); b[1] = Math.max(b[1], q[0]);
    b[2] = Math.min(b[2], q[1]); b[3] = Math.max(b[3], q[1]);
    b[4] = Math.min(b[4], Math.max(0, q[2])); b[5] = Math.max(b[5], Math.max(0, q[2]));
  };
  for (const f of p.faces ?? []) for (const q of f.pts) take(q);
  for (const q of p.reach ?? []) take(q);
  if (b[0] === Infinity) return [0, 0, 0, 0, 0, 0];
  return b;
}

/**
 * The parts in the order they are laid, from this eye: what says it goes
 * first, then the rest by their boxes -- of two whose pictures overlap, the
 * one wholly behind the other along some axis goes first (`Scene.flush` in
 * furniture.ts, from the eye's own way in) -- and `after` where a part says
 * so, the ones furthest back first where nothing says.
 */
function laid(parts: readonly KitPart[], e: Eye, loops?: (left: KitPart[]) => void): KitPart[] {
  const first = parts.filter((p) => p.first);
  const ps = parts.filter((p) => !p.first);
  const n = ps.length;
  const boxes = ps.map(boxOf3);
  const rects = boxes.map((b) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) {
      const [sx, sy] = proj(e, [x, y, z]);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return [x0, y0, x1, y1];
  });
  const depth = boxes.map((b) => centre([[b[0], b[2], b[4]], [b[1], b[3], b[5]]]).reduce((s, v, i) => s + v * e.toward[i], 0));
  const E = 1e-3;
  const [tx, ty] = e.toward;
  /**
   * Less than nought when `a` goes before `b`, more when after, nought when
   * the boxes do not say; two for a box wholly under the other, which is
   * never wrong whichever way it is seen from.
   */
  const before = (a: Box6, b: Box6): number => {
    if (tx > E) { if (a[1] <= b[0] + E) return -1; if (b[1] <= a[0] + E) return 1; }
    else if (tx < -E) { if (a[0] >= b[1] - E) return -1; if (b[0] >= a[1] - E) return 1; }
    if (ty > E) { if (a[3] <= b[2] + E) return -1; if (b[3] <= a[2] + E) return 1; }
    else if (ty < -E) { if (a[2] >= b[3] - E) return -1; if (b[2] >= a[3] - E) return 1; }
    if (a[5] <= b[4] + E) return -2;
    if (b[5] <= a[4] + E) return 2;
    return 0;
  };
  const after: number[][] = ps.map(() => []);
  // What each waits for, and of that what it must wait for: a part said to come after it (`after`), or one wholly under it.
  const need = new Array<number>(n).fill(0);
  const must = new Array<number>(n).fill(0);
  const hard = ps.map(() => new Set<number>());
  const index = new Map(ps.map((p, i) => [p, i]));
  const told = new Set<string>();
  for (let j = 0; j < n; j++) for (const q of ps[j].after ?? []) {
    const i = index.get(q);
    if (i === undefined) continue;
    after[i].push(j); need[j]++; must[j]++; hard[i].add(j); told.add(`${i},${j}`); told.add(`${j},${i}`);
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (told.has(`${i},${j}`)) continue;
    const a = rects[i], b = rects[j];
    if (a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]) continue;
    const o = before(boxes[i], boxes[j]);
    const [x, y] = o < 0 ? [i, j] : [j, i];
    if (!o) continue;
    after[x].push(y); need[y]++;
    if (Math.abs(o) === 2) { must[y]++; hard[x].add(y); }
  }
  const done = new Array<boolean>(n).fill(false);
  const out = first.slice();
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && need[i] === 0 && (pick < 0 || depth[i] < depth[pick])) pick = i;
    if (pick < 0) {
      /*
       * A ring of parts each in front of the next, which boxes can say of
       * parts that reach round each other: broken at the one furthest back
       * of those waiting on nothing they must -- never at a top over what it
       * stands on, or a part told to come after another.
       */
      loops?.(ps.filter((_, i) => !done[i]));
      for (let i = 0; i < n; i++) if (!done[i] && must[i] === 0 && (pick < 0 || depth[i] < depth[pick])) pick = i;
      if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || depth[i] < depth[pick])) pick = i;
    }
    done[pick] = true;
    for (const j of after[pick]) { need[j]--; if (hard[pick].has(j)) must[j]--; }
    out.push(ps[pick]);
  }
  return out;
}

/**
 * For a harness: how many times laying a piece's parts from a view had to
 * break a ring of parts each in front of the next (`laid`), and which parts
 * were left in the ring each time, by their index in the model.
 */
export function kitLoops(kind: string, look: KitLook, view: KitView): { rings: number[][]; order: number[]; parts: readonly KitPart[]; e: Eye } {
  const m = modelOf(kind, look);
  const rings: number[][] = [];
  const e = eyeOfView(view);
  const order = laid(m.parts, e, (left) => rings.push(left.map((p) => m.parts.indexOf(p)))).map((p) => m.parts.indexOf(p));
  return { rings, order, parts: m.parts, e };
}

/* ---- baking ------------------------------------------------------------------------- */

/** A picture and where it goes, in pixels at zoom one from the footprint's middle. */
interface Sheet { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }
type Box = [number, number, number, number];

interface KitBake {
  scale: number;
  /** Its picture: layer `L`, or all of it for less than nought (made when first wanted); and whether it is made. */
  sheet: (L: number) => Sheet;
  has: (L: number) => boolean;
  /** What it covers and what it is clicked by, from the footprint's middle in pixels at zoom one: all of it, and each layer's. */
  bounds: Box;
  hit: Box;
  hits: Box[];
  area: number;
}

/** A picture's box grown to take in what its loose drawings run past their reach (`KitPart.pad`). */
function grownBy(box: Box, parts: readonly KitPart[], e: Eye): Box {
  for (const p of parts) {
    if (!p.pad || !p.reach?.length) continue;
    const [x0, y0, x1, y1] = screenBox(e, p.reach, p.pad);
    box[0] = Math.min(box[0], x0); box[1] = Math.min(box[1], y0); box[2] = Math.max(box[2], x1); box[3] = Math.max(box[3], y1);
  }
  return box;
}

function screenBox(e: Eye, pts: readonly V3[], pad: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x0 === Infinity) return [0, 0, 1, 1];
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function sheetOf(box: Box, scale: number): [Sheet, Ctx] {
  const [x0, y0, x1, y1] = box;
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  return [{ canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, g];
}

const ptsOf = (p: KitPart): V3[] => [...(p.faces ?? []).flatMap((f) => f.pts.map((q) => [q[0], q[1], Math.max(0, q[2])] as V3)), ...(p.reach ?? [])];

/** Its soft shade on the floor, thrown toward the bottom right of the screen as every piece's is. */
function floorShade(g: Ctx, e: Eye, foot: readonly V3[]): void {
  for (const [k, a, dx, dy] of [[1.14, 0.05, 2.2, 1.1], [1.06, 0.07, 1.6, 0.8], [1, 0.09, 0.8, 0.4]] as Array<[number, number, number, number]>) {
    const c = centre(foot as V3[]);
    g.beginPath();
    foot.forEach((q, i) => {
      const [x, y] = proj(e, [c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k, 0]);
      if (i) g.lineTo(x + dx, y + dy); else g.moveTo(x + dx, y + dy);
    });
    g.closePath();
    g.fillStyle = `rgba(44, 74, 78, ${a})`;
    g.fill();
  }
}

/** A face smaller than this on its bake, in its pixels, is filled and ruled but not painted: nothing painted on it would be seen. */
const PAINT_LEAST = 6;
/** And a face smaller than this, in pixels of its bake, is not drawn at all: a sliver of a chamfer seen edge on, a facet of a knob at zoom one. */
const FACE_LEAST = 0.5;
/** How far past its edges a face is filled, in pixels of its bake; and how big a face must be there to be creased. */
const GROW = 0.3;
const CREASE_LEAST = 12;
/** An outline on the screen pushed out by `d` all round (in for less than nought, as it winds), its corners mitred and never more than twice `d` out. */
function grown(pts: readonly Pt[], d: number): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const n1x = (p[1] - a[1]) / l1, n1y = -(p[0] - a[0]) / l1, n2x = (b[1] - p[1]) / l2, n2y = -(b[0] - p[0]) / l2;
    let mx = n1x + n2x, my = n1y + n2y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) return [p[0], p[1]] as Pt;
    mx /= ml; my /= ml;
    const k = Math.min(2, 1 / Math.max(0.5, mx * n1x + my * n1y));
    return [p[0] - mx * d * k, p[1] - my * d * k] as Pt;
  });
}

/**
 * A solid's faces, back to front, each lit, painted and creased, ruled round
 * in ink (`drawFaces` in runestone.ts, which this is drawn as), in fewer
 * calls: the ink round all of it one stroke, each face's own colour and its
 * crease one stroke, and a face too small to show what is painted on it left
 * unpainted. A bake is a hundred-odd faces, and every call on the canvas is
 * paid twice, once to record and once to lay down.
 */
function kitFaces(g: Ctx, e: Eye, faces0: readonly Face[], ink: number, inkColour: RGB): void {
  const base = g.getTransform();
  const px2 = Math.abs(base.a * base.d - base.b * base.c);
  const seen: Array<{ f: Face; pts: V3[]; d: number }> = [];
  for (const f of faces0) {
    if (dot(f.n, e.toward) <= 1e-6) continue;
    // What stands under the floor is not drawn.
    const pts = aboveGround(f.pts);
    if (pts.length < 3) continue;
    let cx = 0, cy = 0, cz = 0;
    for (const q of pts) { cx += q[0]; cy += q[1]; cz += q[2]; }
    seen.push({ f, pts, d: (cx * e.toward[0] + cy * e.toward[1] + cz * e.toward[2]) / pts.length });
  }
  seen.sort((a, b) => a.d - b.d);
  const scr = seen.map(({ pts }) => pts.map((q) => proj(e, q)));
  const trace = (P: Path2D | Ctx, pts: readonly Pt[]): void => {
    pts.forEach(([x, y], i) => (i ? P.lineTo(x, y) : P.moveTo(x, y)));
    P.closePath();
  };
  g.lineJoin = 'round';
  // The ink round the whole solid: every face it shows stroked twice the ink wide, the faces filled over so only its rim is left.
  const rim = new Path2D();
  for (const pts of scr) trace(rim, pts);
  g.strokeStyle = css(inkColour);
  g.lineWidth = ink * 2 + 2 * GROW / Math.sqrt(px2);
  g.stroke(rim);
  // Each face filled a hair past its edges, so two faces of it meet with no seam of the ink under them, and only its larger faces creased.
  const grow = GROW / Math.sqrt(px2);
  const overs: Array<() => void> = [];
  seen.forEach(({ f }, i) => {
    const pts = scr[i];
    let a = 0;
    for (let j = 0; j < pts.length; j++) { const p = pts[j], q = pts[(j + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    const area = Math.abs(a) * 0.5 * px2;
    // A face edge on, or too small to be a pixel on its bake: the ink round it is all that would be seen of it.
    if (area < FACE_LEAST && !f.over) return;
    const L = lightOf(e, f.n);
    const fill = faceColour(f.tone, L);
    g.beginPath();
    trace(g, grown(pts, a > 0 ? grow : -grow));
    g.fillStyle = css(fill);
    g.fill();
    const frame = f.frame;
    const k: PaintCtx = { e, L, fill, base };
    if (f.paint && frame) {
      if (area >= PAINT_LEAST) {
        g.save();
        g.clip();
        const [ox, oy] = proj(e, frame.o), [ax, ay] = proj(e, frame.a), [bx, by] = proj(e, frame.b);
        g.transform(ax, ay, bx, by, ox, oy);
        f.paint(g, k);
        g.restore();
        g.beginPath();
        trace(g, pts);
      }
    }
    if (f.over && frame) {
      const over = f.over;
      overs.push(() => {
        g.save();
        const [ox, oy] = proj(e, frame.o), [ax, ay] = proj(e, frame.a), [bx, by] = proj(e, frame.b);
        g.transform(ax, ay, bx, by, ox, oy);
        over(g, k);
        g.restore();
      });
    }
    // Its edge in its own colour taken toward the crease ink as far as it says, where it is big enough for a crease to be seen.
    if (area >= CREASE_LEAST) {
      if (!f.paint || !frame || area < PAINT_LEAST) { g.beginPath(); trace(g, pts); }
      else { g.beginPath(); trace(g, pts); }
      g.strokeStyle = css(mix(fill, CREASE_INK, 0.6 * (f.crease ?? 0.35)));
      g.lineWidth = 0.55;
      g.stroke();
    }
  });
  for (const o of overs) o();
}

function layPart(g: Ctx, e: Eye, p: KitPart, salt: number): void {
  if (p.faces) {
    kitFaces(g, e, p.faces, p.ink ?? KIT_INK_W, p.inkColour ?? KIT_INK);
    if (p.edges) litEdges(g, e, p.faces, salt);
  }
  p.draw?.(g, e);
}

function bake(kind: string, look: KitLook, view: KitView, scale: number): KitBake {
  const piece = KIT_PIECES[kind];
  const m = modelOf(kind, look);
  const e = eyeOfView(view);
  const order = laid(m.parts, e);
  const layers = Math.max(1, piece.layers ?? 1);
  const layerOf = (p: KitPart): number => Math.max(0, Math.min(layers - 1, Math.round(typeof p.layer === 'function' ? p.layer(e) : p.layer ?? 0)));
  // The floor it shades: what the model says, or the box of its solids.
  let foot = m.shade;
  if (foot === undefined) {
    const b = m.parts.filter((p) => p.solid ?? !!p.faces).map(boxOf3);
    const x0 = Math.min(...b.map((q) => q[0])), x1 = Math.max(...b.map((q) => q[1])), y0 = Math.min(...b.map((q) => q[2])), y1 = Math.max(...b.map((q) => q[3]));
    foot = [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
  }
  const pad = 3 + KIT_INK_W * 2;
  const footPts = foot ? foot.map((q) => [q[0] * 1.14, q[1] * 1.14, 0] as V3) : [];
  const hits: Box[] = [];
  const boxes: Box[] = [];
  const all: V3[] = [...footPts];
  const solidAll: V3[] = [];
  const mine = Array.from({ length: layers }, (_, L) => order.filter((p) => !(layers > 1 && p.wholeOnly) && layerOf(p) === L));
  mine.forEach((ps, L) => {
    const pts = ps.flatMap(ptsOf);
    all.push(...pts);
    const box = grownBy(screenBox(e, L === 0 ? [...pts, ...footPts] : pts, pad), ps, e);
    // The shade's offset toward the bottom right, and room for it.
    if (L === 0 && foot) { box[2] += 3; box[3] += 2; }
    boxes.push(box);
    const solid = ps.filter((p) => p.solid ?? !!p.faces).flatMap(ptsOf);
    solidAll.push(...solid);
    hits.push(screenBox(e, solid, 1));
  });
  for (const p of order) if (layers > 1 && p.wholeOnly) all.push(...ptsOf(p));
  const bounds = grownBy(screenBox(e, all, pad), order, e);
  bounds[2] += 3; bounds[3] += 2;
  /*
   * Each picture made the first time it is wanted: a piece drawn in layers
   * (a fountain, a crate with a wildermon in it) is drawn by its layers and
   * seldom whole, one drawn whole never by its layers.
   */
  const made: Array<Sheet | undefined> = [];
  const sheet = (L: number): Sheet => {
    const at = L < 0 ? layers : L;
    let sh = made[at];
    if (sh) return sh;
    const whole = L < 0;
    const [s2, g] = sheetOf(whole ? bounds : boxes[L], scale);
    if ((whole || L === 0) && foot) floorShade(g, e, foot);
    for (const p of whole ? order : mine[L]) layPart(g, e, p, order.indexOf(p) * 31 + 5);
    made[at] = sh = s2;
    const px = s2.canvas.width * s2.canvas.height;
    out.area += px;
    grew(out, px);
    return sh;
  };
  const one = (L: number): number => (layers > 1 ? L : 0);
  const out: KitBake = { scale, sheet: (L) => sheet(one(L)), has: (L) => !!made[one(L) < 0 ? layers : one(L)], bounds, hit: screenBox(e, solidAll, 1), hits, area: 0 };
  return out;
}

/* ---- keeping them --------------------------------------------------------------------- */

/*
 * A bake is cheap to make and dear to draw: its model, order and boxes are
 * worked out at once (`bake`), and each of its pictures is drawn the first
 * time it is wanted (`KitBake.sheet`). What is kept is counted by the pixels
 * of the pictures made.
 */

/**
 * Pixels of pictures kept before the least lately drawn is let go: the old
 * models' sixteen million, more on a big screen, which shows more pieces at
 * once (never past forty).
 */
let budget = 0;
function BUDGET(): number {
  if (!budget) {
    const w = globalThis as unknown as { innerWidth?: number; innerHeight?: number; devicePixelRatio?: number };
    const screen = (w.innerWidth ?? 1600) * (w.innerHeight ?? 1000) * (w.devicePixelRatio ?? 1) ** 2;
    budget = Math.min(40e6, Math.max(16e6, screen * 8));
  }
  return budget;
}
/** A bake kept, and the frame it was last drawn in (never, for one made ahead). */
interface Kept { b: KitBake; used: number }
const kept = new Map<string, Kept>();
const keptBakes = new WeakSet<KitBake>();
let keptArea = 0;
/** The frame it is (`kitFrame`); whether the zoom has settled; and the milliseconds spent in it drawing new pictures. */
let frame = 0;
let settled = true;
let frameMs = 0;
/**
 * Milliseconds a frame may spend drawing new pictures of pieces once the
 * zoom has settled, and while it moves for a piece with no other picture of
 * itself to stand in: past that a piece is drawn by another picture of
 * itself, or waits for the browser to be idle. The old models baked every
 * piece new to the screen in the frame it came on: a settlement's worth was
 * one frame of a second.
 */
const FRAME_MS = 10;
const MOVING_MS = 4;
/** Once a frame, from `piecesFrame`: whether the zoom has settled. */
export function kitFrame(still: boolean): void {
  frame++;
  settled = still;
  frameMs = 0;
}
/** Whether a bake drawn in frame `used` is still on the screen: drawn in this frame or the last. */
const onScreen = (used: number): boolean => used >= frame - 1;

/**
 * Let go of the bakes least lately drawn till the rest fit the budget, what
 * was made ahead and never drawn first -- but never one drawn in this frame
 * or the last, which would only be drawn again in the next: when what is on
 * the screen is more than the budget, the budget is let run over rather than
 * draw the same pieces anew every frame.
 */
function trim(): void {
  for (const ahead of [true, false]) for (const [k, old] of kept) {
    if (keptArea <= BUDGET()) return;
    if (onScreen(old.used) || (ahead && old.used !== -Infinity)) continue;
    kept.delete(k);
    keptBakes.delete(old.b);
    keptArea -= old.b.area;
  }
}
/** A picture of a bake has been drawn: counted, if the bake is kept, and the least lately drawn let go past the budget. */
function grew(b: KitBake, px: number): void {
  if (!keptBakes.has(b)) return;
  keptArea += px;
  trim();
}

const viewKey = (v: KitView): string => `${v.ux.toFixed(3)},${v.uy.toFixed(3)},${v.vx.toFixed(3)},${v.vy.toFixed(3)}`;
const pieceKey = (kind: string, look: KitLook, view: KitView): string => `${kind}|${lookKey(KIT_PIECES[kind], look)}|${viewKey(view)}`;

/** The bake of a piece at a scale, kept or made: drawn in this frame unless it is wanted `ahead`. */
function baked(kind: string, look: KitLook, view: KitView, scale: number, ahead = false): KitBake {
  const key = `${pieceKey(kind, look, view)}|${scale}`;
  const k = kept.get(key);
  if (k) {
    kept.delete(key);
    kept.set(key, k);
    if (!ahead) k.used = frame;
    return k.b;
  }
  const t0 = performance.now();
  const b = bake(kind, look, view, scale);
  if (!ahead) frameMs += performance.now() - t0;
  keptBakes.add(b);
  kept.set(key, { b, used: ahead ? -Infinity : frame });
  return b;
}
/**
 * A kept bake of the piece whose picture `L` is drawn, to stand in for this
 * one: at another scale, the nearest first and the smaller before the
 * bigger; or, for a fire, another flicker of it at any scale (`flickers`).
 */
function standIn(piece: string, scale: number, L: number, flickers: readonly string[] = []): KitBake | undefined {
  for (const p of [piece, ...flickers]) for (const s2 of BAKE_STEPS.slice().sort((a, c) => Math.abs(a - scale) - Math.abs(c - scale) || a - c)) {
    if (p === piece && s2 === scale) continue;
    const k = kept.get(`${p}|${s2}`);
    if (k?.b.has(L)) { k.used = frame; return k.b; }
  }
  return undefined;
}
/** A burning piece's other flickers, as pieces (`pieceKey`): what can stand in for the one it is at. */
function otherFlickers(kind: string, look: KitLook, view: KitView): string[] {
  const n = KIT_PIECES[kind].flicker ?? 0;
  if (look.frame === undefined || n < 2) return [];
  return Array.from({ length: n - 1 }, (_, i) => pieceKey(kind, { ...look, frame: (look.frame! + 1 + i) % n }, view));
}

/*
 * Pictures drawn while the browser is idle (`prewarmDen` in dens.ts): first
 * the ones a frame had no time for, and then, while there is room in the
 * budget, a piece seen from one way for the camera's turns either side of
 * it, so turning the camera finds them drawn.
 */
const ahead: Array<() => void> = [];
const queued = new Set<string>();
let idling = false;
function idle(): void {
  if (idling || !ahead.length) return;
  idling = true;
  const run = (left: () => number, late: boolean): void => {
    idling = false;
    if (late && ahead.length) ahead.shift()?.();
    while (ahead.length && left() > 8) ahead.shift()?.();
    if (ahead.length) idle();
  };
  const w = globalThis as unknown as { requestIdleCallback?: (f: (d: { timeRemaining(): number; didTimeout: boolean }) => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback((d) => run(() => d.timeRemaining(), d.didTimeout), { timeout: 150 });
  else setTimeout(() => { const t0 = performance.now(); run(() => 24 - (performance.now() - t0), true); }, 60);
}
function later(key: string, make: () => void, now = false): void {
  if (queued.has(key)) return;
  queued.add(key);
  const job = (): void => { queued.delete(key); make(); };
  if (now) ahead.unshift(job); else ahead.push(job);
  idle();
}

/** The turns of a piece standing the way a view says, for drawing the camera's turns either side ahead: by facing and turn. */
const ACROSS: Record<Side, [number, number]> = { s: [1, 0], e: [0, -1], n: [-1, 0], w: [0, 1] };
const FRONT: Record<Side, [number, number]> = { s: [0, 1], e: [1, 0], n: [0, -1], w: [-1, 0] };
function viewOf(facing: Side, rotation: number): KitView {
  const { cos, sin } = VIEWS[((rotation % 8) + 8) % 8];
  const scr = (dx: number, dy: number): [number, number] => {
    const u = dx * cos + dy * sin, v = dy * cos - dx * sin;
    return [((u - v) * HALF_W) / UNITS_PER_TILE, ((u + v) * HALF_H) / UNITS_PER_TILE];
  };
  const [ux, uy] = scr(...ACROSS[facing]);
  const [vx, vy] = scr(...FRONT[facing]);
  return { ux, uy, vx, vy };
}
let turns: Map<string, [Side, number]> | null = null;
function neighbours(view: KitView): KitView[] {
  if (!turns) {
    turns = new Map();
    for (const f of FACINGS) for (let r = 0; r < 8; r++) turns.set(viewKey(viewOf(f, r)), [f, r]);
  }
  const at = turns.get(viewKey(view));
  return at ? [viewOf(at[0], at[1] + 1), viewOf(at[0], at[1] - 1)] : [];
}

/** How full the budget may be for a turn either side to be drawn ahead: never so full that drawing ahead lets go of what is on the screen. */
const AHEAD_FILL = 0.7;

/** Picture `L` of a bake, its drawing counted against the frame's share. */
function drawn(b: KitBake, L: number): Sheet {
  if (b.has(L)) return b.sheet(L);
  const t0 = performance.now();
  const sh = b.sheet(L);
  frameMs += performance.now() - t0;
  return sh;
}

/**
 * The picture to draw a piece by this frame, and the bake it belongs to: its
 * own if it is drawn, or if this frame has time left to draw it
 * (`FRAME_MS`); else, while it is drawn when the browser is next idle,
 * another picture of the piece at another scale drawn to size; else, if the
 * frame has a little time left, its own after all; else none this frame.
 */
function pictureOf(kind: string, look: KitLook, view: KitView, zoom: number, L: number): { b: KitBake | null; sh: Sheet | null } {
  const scale = scaleFor(zoom), piece = pieceKey(kind, look, view);
  // A piece new to the screen when the frame's share is spent: not even its model this frame, unless another picture of it stands in.
  if (!sync && !kept.has(`${piece}|${scale}`) && frameMs >= (settled ? FRAME_MS : MOVING_MS)) {
    const other = standIn(piece, scale, L, otherFlickers(kind, look, view));
    later(`${piece}|${scale}|${L}`, () => baked(kind, look, view, scale).sheet(L), true);
    return { b: other ?? null, sh: other ? other.sheet(L) : null };
  }
  const b = baked(kind, look, view, scale);
  let sh: Sheet | null = null;
  if (b.has(L) || sync || frameMs < (settled ? FRAME_MS : 0)) sh = drawn(b, L);
  else {
    const other = standIn(piece, scale, L, otherFlickers(kind, look, view));
    if (other) sh = other.sheet(L);
    else if (frameMs < MOVING_MS) sh = drawn(b, L);
    if (!sh || other) later(`${piece}|${scale}|${L}`, () => { if (kept.get(`${piece}|${scale}`)?.b === b) b.sheet(L); }, true);
  }
  // The turns either side, drawn ahead while there is room for them.
  if (!sync && sh) {
    const px = b.area || sh.canvas.width * sh.canvas.height;
    if (keptArea + 2 * px < BUDGET() * AHEAD_FILL) {
      for (const v of neighbours(view)) {
        const vk = `${pieceKey(kind, look, v)}|${scale}`;
        if (kept.get(vk)?.b.has(L)) continue;
        later(`${vk}|${L}`, () => { if (keptArea + px < BUDGET() * AHEAD_FILL) baked(kind, look, v, scale, true).sheet(L); });
      }
    }
  }
  return { b, sh };
}

/* ---- drawing ---------------------------------------------------------------------------- */

const lay = (ctx: Ctx, s: Sheet, sx: number, sy: number, zoom: number): void => {
  ctx.drawImage(s.canvas, sx + s.x * zoom, sy + s.y * zoom, s.w * zoom, s.h * zoom);
};
/** Pictures laid already: a canvas is drawn for good the first time it is laid, which is when its frame pays for it. */
const laidOnce = new WeakSet<HTMLCanvasElement>();

/**
 * Draw a kit piece of `kind` whose floor contact is at (sx, sy), turned as
 * `view` says (`pieceView`), as `look` says: all of it, or for a piece drawn
 * in layers the layer `look.trim` names (all of them when it names none).
 * Unless `live` is false, what moves on it is drawn over it too. Returns the
 * box it is clicked by, left, top, right and bottom in screen pixels from
 * (sx, sy), as `drawFurniture` does: the same whether or not its picture
 * has been drawn yet.
 */
export function drawKit(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, look0: KitLook, view: KitView, live = true, night = 0, air?: KitAir): [number, number, number, number] {
  const piece = KIT_PIECES[kind];
  const look = flickering(piece, look0);
  const layer = piece.layers && look.trim !== undefined ? Math.max(0, Math.min(piece.layers - 1, Math.round(look.trim))) : -1;
  const { b, sh } = pictureOf(kind, look, view, zoom, layer);
  if (sh) {
    if (laidOnce.has(sh.canvas)) lay(ctx, sh, sx, sy, zoom);
    else {
      const t0 = performance.now();
      lay(ctx, sh, sx, sy, zoom);
      laidOnce.add(sh.canvas);
      frameMs += performance.now() - t0;
    }
  }
  if (live && (layer < 0 || layer === (piece.layers ?? 1) - 1)) drawKitLive(ctx, sx, sy, zoom, kind, view, night, air);
  // Not drawn yet, its model not yet built: no box of its own, and the renderer clicks it by its footprint.
  if (!b) return [0, 0, 0, 0];
  const [l, t, r, bt] = layer < 0 ? b.hit : b.hits[layer][2] > b.hits[layer][0] + 2 ? b.hits[layer] : b.hit;
  return [l * zoom, t * zoom, r * zoom, bt * zoom];
}

/** How long a burning piece holds each flicker of its fire, in milliseconds: the old models' (`bakedFor` in furniture.ts). */
const FLICKER_MS = 150;
/** A look with the flicker its fire is at now, when it is lit and flickers (`KitPiece.flicker`); any other look as it is. */
function flickering(piece: KitPiece, look: KitLook): KitLook {
  if (!piece.flicker || !look.lit) return look.frame === undefined ? look : { ...look, frame: undefined };
  return { ...look, frame: Math.floor(performance.now() / FLICKER_MS) % piece.flicker };
}

/** What moves on a kit piece, over its bake: whatever the piece draws live (`KitPiece.live`). */
export function drawKitLive(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, view: KitView, night = 0, air?: KitAir, t = performance.now() / 1000): void {
  KIT_PIECES[kind]?.live?.(ctx, sx, sy, zoom, view, night, t, air);
}

/** Where a kit piece takes the night back off itself this frame, if it does. */
export const kitHoles = (sx: number, sy: number, zoom: number, kind: string, view: KitView, t = performance.now() / 1000): Array<{ x: number; y: number; r: number; a: number }> =>
  KIT_PIECES[kind]?.holes?.(sx, sy, zoom, view, t) ?? [];
/** Whether a kit piece has a live drawing that wants the wind, and whether it takes the night off itself. */
export const kitWind = (kind: string): boolean => isKit(kind) && !!KIT_PIECES[kind].wind;
export const kitGlows = (kind: string): boolean => isKit(kind) && !!KIT_PIECES[kind].holes;

/** What a kit piece covers and what it is clicked by, from its floor contact in pixels at zoom one: for a harness. */
export function kitBoxes(kind: string, look: KitLook, view: KitView, zoom = 1): { bounds: Box; hit: Box } {
  const b = baked(kind, flickering(KIT_PIECES[kind], look), view, scaleFor(zoom));
  return { bounds: b.bounds, hit: b.hit };
}
