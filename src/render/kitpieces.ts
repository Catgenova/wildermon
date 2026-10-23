import { FACINGS, furnitureDef } from '../game/furniture';
import type { Side } from '../game/building';
import { HALF_H, HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { VIEWS } from './view';
import { BAKE_STEPS, canvasOf, drawFaces, eyeOfView, proj, scaleFor, type Ctx, type Eye, type V3 } from './runestone';
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

const models = new Map<string, KitModel>();
function modelOf(kind: string, look: KitLook): KitModel {
  const piece = KIT_PIECES[kind];
  const key = `${kind}|${lookKey(piece, look)}`;
  let m = models.get(key);
  if (!m) {
    // What it is built for: a layered piece's trim is the layer, never the model's.
    m = piece.model(piece.layers ? { ...look, trim: undefined } : look, sizeOf(kind));
    models.set(key, m);
  }
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
function laid(parts: readonly KitPart[], e: Eye): KitPart[] {
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
  /** Less than nought when `a` goes before `b`, more when after, nought when the boxes do not say. */
  const before = (a: Box6, b: Box6): number => {
    if (tx > E) { if (a[1] <= b[0] + E) return -1; if (b[1] <= a[0] + E) return 1; }
    else if (tx < -E) { if (a[0] >= b[1] - E) return -1; if (b[0] >= a[1] - E) return 1; }
    if (ty > E) { if (a[3] <= b[2] + E) return -1; if (b[3] <= a[2] + E) return 1; }
    else if (ty < -E) { if (a[2] >= b[3] - E) return -1; if (b[2] >= a[3] - E) return 1; }
    if (a[5] <= b[4] + E) return -1;
    if (b[5] <= a[4] + E) return 1;
    return 0;
  };
  const after: number[][] = ps.map(() => []);
  const need = new Array<number>(n).fill(0);
  const index = new Map(ps.map((p, i) => [p, i]));
  const told = new Set<string>();
  for (let j = 0; j < n; j++) for (const q of ps[j].after ?? []) {
    const i = index.get(q);
    if (i === undefined) continue;
    after[i].push(j); need[j]++; told.add(`${i},${j}`); told.add(`${j},${i}`);
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (told.has(`${i},${j}`)) continue;
    const a = rects[i], b = rects[j];
    if (a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]) continue;
    const o = before(boxes[i], boxes[j]);
    if (o < 0) { after[i].push(j); need[j]++; }
    else if (o > 0) { after[j].push(i); need[i]++; }
  }
  const done = new Array<boolean>(n).fill(false);
  const out = first.slice();
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && need[i] === 0 && (pick < 0 || depth[i] < depth[pick])) pick = i;
    // A ring of parts each behind the next: broken at the one furthest back.
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || depth[i] < depth[pick])) pick = i;
    done[pick] = true;
    for (const j of after[pick]) need[j]--;
    out.push(ps[pick]);
  }
  return out;
}

/* ---- baking ------------------------------------------------------------------------- */

/** A picture and where it goes, in pixels at zoom one from the footprint's middle. */
interface Sheet { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }
type Box = [number, number, number, number];

interface KitBake {
  scale: number;
  /** One for each layer, and all of them as one. */
  sheets: Sheet[];
  whole: Sheet;
  /** What it covers and what it is clicked by, from the footprint's middle in pixels at zoom one: all of it, and each layer's. */
  bounds: Box;
  hit: Box;
  hits: Box[];
  area: number;
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

function layPart(g: Ctx, e: Eye, p: KitPart, salt: number): void {
  if (p.faces) {
    drawFaces(g, e, p.faces, p.ink ?? KIT_INK_W, p.inkColour ?? KIT_INK);
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
  const sheets: Sheet[] = [];
  const hits: Box[] = [];
  const all: V3[] = [...footPts];
  const solidAll: V3[] = [];
  for (let L = 0; L < layers; L++) {
    const mine = order.filter((p) => !(layers > 1 && p.wholeOnly) && layerOf(p) === L);
    const pts = mine.flatMap(ptsOf);
    all.push(...pts);
    const box = screenBox(e, L === 0 ? [...pts, ...footPts] : pts, pad);
    // The shade's offset toward the bottom right, and room for it.
    if (L === 0 && foot) { box[2] += 3; box[3] += 2; }
    const [sh, g] = sheetOf(box, scale);
    if (L === 0 && foot) floorShade(g, e, foot);
    for (const p of mine) layPart(g, e, p, order.indexOf(p) * 31 + 5);
    sheets.push(sh);
    const solid = mine.filter((p) => p.solid ?? !!p.faces).flatMap(ptsOf);
    solidAll.push(...solid);
    hits.push(screenBox(e, solid, 1));
  }
  const bounds = screenBox(e, all, pad);
  bounds[2] += 3; bounds[3] += 2;
  let whole = sheets[0];
  if (layers > 1) {
    // Drawn whole: every part in its order, with what is shown only whole (still water), over its shade.
    for (const p of order) if (p.wholeOnly) all.push(...ptsOf(p));
    const wb = screenBox(e, all, pad);
    wb[2] += 3; wb[3] += 2;
    bounds.splice(0, 4, ...wb);
    const [w, gw] = sheetOf(bounds, scale);
    if (foot) floorShade(gw, e, foot);
    order.forEach((p, i) => layPart(gw, e, p, i * 31 + 5));
    whole = w;
  }
  const px = (s: Sheet): number => s.canvas.width * s.canvas.height;
  return { scale, sheets, whole, bounds, hit: screenBox(e, solidAll, 1), hits, area: sheets.reduce((n, s) => n + px(s), 0) + (layers > 1 ? px(whole) : 0) };
}

/* ---- keeping them --------------------------------------------------------------------- */

/** Pixels of bakes kept before the least lately drawn is let go. */
const BUDGET = 10e6;
const kept = new Map<string, KitBake>();
let keptArea = 0;
function keep(key: string, make: () => KitBake): KitBake {
  let b = kept.get(key);
  if (b) { kept.delete(key); kept.set(key, b); return b; }
  b = make();
  kept.set(key, b);
  keptArea += b.area;
  for (const [k, old] of kept) {
    if (keptArea <= BUDGET || k === key) break;
    kept.delete(k);
    keptArea -= old.area;
  }
  return b;
}

const viewKey = (v: KitView): string => `${v.ux.toFixed(3)},${v.uy.toFixed(3)},${v.vx.toFixed(3)},${v.vy.toFixed(3)}`;
const pieceKey = (kind: string, look: KitLook, view: KitView): string => `${kind}|${lookKey(KIT_PIECES[kind], look)}|${viewKey(view)}`;

function baked(kind: string, look: KitLook, view: KitView, scale: number): KitBake {
  return keep(`${pieceKey(kind, look, view)}|${scale}`, () => bake(kind, look, view, scale));
}

/*
 * Bakes made ahead while the browser is idle (`prewarmDen` in dens.ts): a
 * piece seen from one way is baked for the camera's turns either side of it,
 * and a bake wanted at a scale not yet made is made there while a smaller
 * one stands in, so turning the camera or zooming in never costs a frame a
 * big bake.
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
  if (kept.has(key) || queued.has(key)) return;
  queued.add(key);
  const job = (): void => { queued.delete(key); make(); };
  if (now) ahead.unshift(job); else ahead.push(job);
  idle();
}

/** The turns of a piece standing the way a view says, for baking the camera's turns either side ahead: by facing and turn. */
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

/**
 * The bake to draw a piece by this frame: the one at its scale if it is made;
 * else, while that one is made when the browser is next idle, the nearest
 * smaller one of the same view drawn up to size, or failing any the smallest,
 * made now. Either way the turns either side are baked ahead.
 */
function soon(kind: string, look: KitLook, view: KitView, zoom: number): KitBake {
  const scale = scaleFor(zoom), piece = pieceKey(kind, look, view);
  const key = `${piece}|${scale}`;
  let b: KitBake | undefined;
  if (sync || kept.has(key) || scale === BAKE_STEPS[0]) b = baked(kind, look, view, scale);
  else {
    later(key, () => baked(kind, look, view, scale), true);
    for (let i = BAKE_STEPS.indexOf(scale) - 1; i > 0 && !b; i--) if (kept.has(`${piece}|${BAKE_STEPS[i]}`)) b = baked(kind, look, view, BAKE_STEPS[i]);
    b ??= baked(kind, look, view, BAKE_STEPS[0]);
  }
  if (!sync) for (const v of neighbours(view)) later(`${pieceKey(kind, look, v)}|${scale}`, () => baked(kind, look, v, scale));
  return b;
}

/* ---- drawing ---------------------------------------------------------------------------- */

const lay = (ctx: Ctx, s: Sheet, sx: number, sy: number, zoom: number): void => {
  ctx.drawImage(s.canvas, sx + s.x * zoom, sy + s.y * zoom, s.w * zoom, s.h * zoom);
};

/**
 * Draw a kit piece of `kind` whose floor contact is at (sx, sy), turned as
 * `view` says (`pieceView`), as `look` says: all of it, or for a piece drawn
 * in layers the layer `look.trim` names (all of them when it names none).
 * Unless `live` is false, what moves on it is drawn over it too. Returns the
 * box it is clicked by, left, top, right and bottom in screen pixels from
 * (sx, sy), as `drawFurniture` does.
 */
export function drawKit(ctx: Ctx, sx: number, sy: number, zoom: number, kind: string, look0: KitLook, view: KitView, live = true, night = 0, air?: KitAir): [number, number, number, number] {
  const piece = KIT_PIECES[kind];
  const look = flickering(piece, look0);
  const b = soon(kind, look, view, zoom);
  const layer = piece.layers && look.trim !== undefined ? Math.max(0, Math.min(piece.layers - 1, Math.round(look.trim))) : -1;
  lay(ctx, layer < 0 ? b.whole : b.sheets[layer], sx, sy, zoom);
  if (live && (layer < 0 || layer === (piece.layers ?? 1) - 1)) drawKitLive(ctx, sx, sy, zoom, kind, view, night, air);
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
  const b = soon(kind, flickering(KIT_PIECES[kind], look), view, zoom);
  return { bounds: b.bounds, hit: b.hit };
}
