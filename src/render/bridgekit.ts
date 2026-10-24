import { bridgeBays, bridgeDone, bridgeWidth, BRIDGES, deckHeight, isMaterialBridge, laneOffsets, laneStep, rampDeck, type Bridge } from '../game/bridges';
import { isDone } from '../game/building';
import { HALF_H, HALF_W, UNITS_PER_TILE } from './iso';
import { kitBaked, kitIsSync, kitMayBake } from './kitpieces';
import { canvasOf, eyeOfView, proj, scaleFor, BAKE_STEPS, type Eye, type NightHole, type NightMask } from './runestone';
import { VIEWS } from './view';
import { buildSlice, layGlowMask, layPiece, piecePoints, planOf, type Part3, type PieceModel, type Plan, type Slice } from './kit/bridge/core';
import { BRIDGE_STYLES } from './kit/bridge/index';

/**
 * A bridge of a wall material on the screen: its plan, its slices and their
 * pictures (`kit/bridge/core.ts` builds them).
 *
 * Every tile of deck of every lane is three pieces (`Part3`), each taken into
 * the line of its tile with a sort key of its own (`BridgePieceAt.key`): the
 * back of it a hair in front of the tile's far corner, so it is laid behind
 * anything standing under the deck there; the front of it just short of the
 * tile's near corner, in front of anything under the deck and behind anybody
 * on it (`deckKey`); and the near parapet after both. A rope bridge's deck is
 * sorted the same way (`ropeKey`).
 *
 * Pictures are baked once for each view and scale, counted against the same
 * share of a frame as the kit's furniture (`kitMayBake`), kept by their
 * pixels and the least lately drawn let go, and drawn with one `drawImage`.
 */

export interface BridgePieceAt {
  b: Bridge;
  i: number;
  o: number;
  part: Part3;
  /** Where its middle is on the screen, at the plan's base. */
  sx: number;
  sy: number;
  /** What it sorts by among what stands on its line. */
  key: number;
}

/** What the renderer gives: its camera and the ground. */
export interface BridgeFrame {
  rotation: number;
  sx: (wx: number, wy: number) => number;
  sy: (wx: number, wy: number, h: number) => number;
  heightAt: (wx: number, wy: number) => number;
  greenStage: (b: Bridge) => number;
}

/* ---- the view ---------------------------------------------------------------------------- */

const views = new Map<number, { view: { ux: number; uy: number; vx: number; vy: number }; e: Eye; key: string }>();
/** The kit's eye on the world's own axes at a camera turn, and a key for it: what a spiral staircase is drawn by too (`spiralkit.ts`). */
export const kitEyeOfTurn = (rotation: number): { e: Eye; key: string } => viewOfTurn(rotation);
/** The kit's view of the world's own axes from a camera turn: a unit of x and a unit of y, in pixels at zoom one. */
function viewOfTurn(rotation: number): { e: Eye; key: string } {
  let v = views.get(rotation);
  if (!v) {
    const { cos, sin } = VIEWS[((rotation % 8) + 8) % 8];
    const scr = (dx: number, dy: number): [number, number] => {
      const u = dx * cos + dy * sin, w = dy * cos - dx * sin;
      return [((u - w) * HALF_W) / UNITS_PER_TILE, ((u + w) * HALF_H) / UNITS_PER_TILE];
    };
    const [ux, uy] = scr(1, 0), [vx, vy] = scr(0, 1);
    const view = { ux, uy, vx, vy };
    v = { view, e: eyeOfView(view), key: `r${rotation}` };
    views.set(rotation, v);
  }
  return v;
}

/* ---- plans ---------------------------------------------------------------------------------- */

interface Planned {
  key: string;
  /** A short name for this plan, for its pictures' keys. */
  uid: number;
  plan: Plan;
  A: [number, number];
  P: [number, number];
  /** Slices built for a view, by `i|o`. */
  slices: Map<string, Map<string, Record<Part3, PieceModel> & { box: Record<Part3, [number, number, number, number]> }>>;
}
const plans = new Map<number, Planned>();
let planUid = 0;

/** A bridge's frame on the island: which way along, which way across, and the middle of end a's tile. */
function axes(b: Bridge): { A: [number, number]; P: [number, number] } {
  const A: [number, number] = [Math.sign(b.bx - b.ax), Math.sign(b.by - b.ay)];
  return { A, P: laneStep(b) };
}

/** The world point of a point in a bridge's frame. */
const worldOf = (b: Bridge, A: [number, number], P: [number, number], s: number, t: number): [number, number] =>
  [b.ax + 0.5 + A[0] * (s + 0.5) + P[0] * t, b.ay + 0.5 + A[1] * (s + 0.5) + P[1] * t];

/** The plan of a bridge as it stands now, made again only when what it is built from changes. */
/** Plans looked at this frame, by the frame: a bridge's ground is read once a frame, not once a tile. */
const thisFrame = new WeakMap<BridgeFrame, Map<number, Planned | null>>();
export function planFor(b: Bridge, f: BridgeFrame): Planned | null {
  let seen = thisFrame.get(f);
  if (!seen) { seen = new Map(); thisFrame.set(f, seen); }
  if (seen.has(b.id)) return seen.get(b.id)!;
  const p = planAnew(b, f);
  seen.set(b.id, p);
  return p;
}
function planAnew(b: Bridge, f: BridgeFrame): Planned | null {
  const style = BRIDGE_STYLES[b.kind];
  if (!style) return null;
  const { A, P } = axes(b);
  const n = b.spans.length;
  const lanes = laneOffsets(bridgeWidth(b), b.side);
  const ground = (s: number, t: number): number => {
    const [wx, wy] = worldOf(b, A, P, s, t);
    return f.heightAt(wx, wy);
  };
  const done = b.spans.map((s) => isDone(s));
  const moss = style.family === 'stone' ? f.greenStage(b) : 0;
  // What it is built from, as a key: the ground under it read at its piers and its middles, coarsely.
  let gk = '';
  for (let s = 0; s <= n; s += 0.5) for (const t of [Math.min(...lanes) - 0.5, Math.max(...lanes) + 0.5]) gk += `${Math.round(ground(s, t))},`;
  const key = `${b.kind}|${n}|${b.height}|${b.rise ?? 0}|${lanes.join(',')}|${done.map((d) => (d ? 1 : 0)).join('')}|${moss}|${gk}`;
  const had = plans.get(b.id);
  if (had && had.key === key) return had;
  const plan = planOf({
    n, lanes, ground, done, rise: b.rise ?? 0, width: bridgeWidth(b), moss, style,
    deck: (s) => rampDeck(b.height, b.rise ?? 0, n, s),
    bays: drawnBays(n, BRIDGES[b.kind].bay, !!b.rise),
  });
  const p: Planned = { key, uid: ++planUid, plan, A, P, slices: new Map() };
  plans.set(b.id, p);
  return p;
}

/**
 * The arches a bridge is drawn with: its bays (`bridgeBays`); and under a
 * ramp, each of them split into arches of about `RAMP_ARCH` tiles -- wide
 * enough to be seen through across a lane's depth -- each springing at
 * its own height under the slope, a run of small arches stepping up with
 * the deck. Only how it is drawn: its piers and its bill are its bays'.
 */
export function drawnBays(n: number, bay: number | undefined, ramp: boolean): number[] {
  const bays = bridgeBays(n, bay);
  return ramp ? bays.flatMap((len) => { const m = Math.max(1, Math.round(len / RAMP_ARCH)); return new Array<number>(m).fill(len / m); }) : bays;
}
const RAMP_ARCH = 2;

/** Forget the plans of bridges no longer standing. */
export function forgetBridges(keep: (id: number) => boolean): void {
  for (const id of [...plans.keys()]) if (!keep(id)) plans.delete(id);
}

function sliceOf(pl: Planned, i: number, o: number, rotation: number): (Record<Part3, PieceModel> & { box: Record<Part3, [number, number, number, number]> }) {
  const { e, key } = viewOfTurn(rotation);
  let byView = pl.slices.get(key);
  if (!byView) { byView = new Map(); pl.slices.set(key, byView); }
  const k = `${i}|${o}`;
  let got = byView.get(k);
  if (!got) {
    const plan = pl.plan;
    const tLo = plan.tLo, tHi = plan.tHi;
    const edges: number[] = [];
    if (o - 0.5 <= tLo + 1e-6) edges.push(-1);
    if (o + 0.5 >= tHi - 1e-6) edges.push(1);
    // The outer edge that looks toward the eye, of those this lane has.
    const facing = (edge: number): number => edge * (pl.P[0] * e.toward[0] + pl.P[1] * e.toward[1]);
    const near = edges.length ? edges.reduce((a, c) => (facing(c) > facing(a) ? c : a)) : null;
    const sl: Slice = { i, o, s0: i, s1: i + 1, t0: o - 0.5, t1: o + 0.5, edges, near: near !== null && facing(near) > 0 ? near : null };
    const built = buildSlice(plan, sl, e, pl.A, pl.P);
    const box = {} as Record<Part3, [number, number, number, number]>;
    for (const part of ['back', 'front', 'rail'] as Part3[]) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of piecePoints(built[part])) {
        const [x, y] = proj(e, q);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      box[part] = x0 === Infinity ? [0, 0, 0, 0] : [Math.floor(x0 - 3), Math.floor(y0 - 3), Math.ceil(x1 + 3), Math.ceil(y1 + 3)];
    }
    got = { ...built, box };
    byView.set(k, got);
  }
  return got;
}

/* ---- the pieces on a tile ----------------------------------------------------------------------- */

/** The tile's corners on the screen at a height: the furthest and the nearest, for sorting by. */
function cornersSy(f: BridgeFrame, x: number, y: number, h: number): [number, number] {
  let far = Infinity, near = -Infinity;
  for (const [cx, cy] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
    const v = f.sy(cx, cy, h);
    far = Math.min(far, v);
    near = Math.max(near, v);
  }
  return [far, near];
}

/** The pieces of a material bridge on a tile of its deck, any lane's: none for a tile it does not cover. */
export function piecesAt(b: Bridge, x: number, y: number, f: BridgeFrame): BridgePieceAt[] {
  const T0 = performance.now();
  try {
    return piecesOn(b, x, y, f);
  } finally {
    bridgeBakes.takeMs += performance.now() - T0;
  }
}
function piecesOn(b: Bridge, x: number, y: number, f: BridgeFrame): BridgePieceAt[] {
  if (!isMaterialBridge(b.kind)) return [];
  const pl = planFor(b, f);
  if (!pl) return [];
  const { A, P } = pl;
  let o: number | null = null;
  let i = -1;
  for (const lo of laneOffsets(bridgeWidth(b), b.side)) {
    const cx = x - lo * P[0], cy = y - lo * P[1];
    const k = b.spans.findIndex((s) => s.x === cx && s.y === cy);
    if (k >= 0) { o = lo; i = k; break; }
  }
  if (o === null) return [];
  const [wx, wy] = worldOf(b, A, P, i + 0.5, o);
  const sx = f.sx(wx, wy), sy = f.sy(wx, wy, pl.plan.base);
  const [far, near] = cornersSy(f, x, y, f.heightAt(x + 0.5, y + 0.5));
  return [
    { b, i, o, part: 'back', sx, sy, key: far + 0.5 },
    { b, i, o, part: 'front', sx, sy, key: near - 0.5 },
    { b, i, o, part: 'rail', sx, sy, key: near - 0.3 },
  ];
}

/** What anybody standing on the deck of a bridge on this tile sorts by: after the deck's front, before its near parapet. */
export function deckKey(f: BridgeFrame, x: number, y: number): number {
  return cornersSy(f, x, y, f.heightAt(x + 0.5, y + 0.5))[1] - 0.4;
}
/** And a rope bridge's deck, in front of anybody under it. */
export function ropeKey(f: BridgeFrame, x: number, y: number): number {
  return cornersSy(f, x, y, f.heightAt(x + 0.5, y + 0.5))[1] - 0.5;
}

/* ---- baking -------------------------------------------------------------------------------------- */

interface Sheet { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }
const kept = new Map<string, Sheet>();
let keptArea = 0;
/** Pixels of bridge pictures kept before the least lately drawn is let go. */
const BUDGET = 14e6;
const area = (s: Sheet): number => s.canvas.width * s.canvas.height;

function keep(key: string, s: Sheet): void {
  kept.set(key, s);
  keptArea += area(s);
  for (const [k, old] of kept) {
    if (keptArea <= BUDGET) break;
    if (k === key) continue;
    kept.delete(k);
    keptArea -= area(old);
  }
}

function bake(pm: PieceModel, box: [number, number, number, number], e: Eye, scale: number, draw: (g: CanvasRenderingContext2D) => void): Sheet {
  const [x0, y0, x1, y1] = box;
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  draw(g);
  void pm; void e;
  return { canvas, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Pictures waiting for the browser to be idle. */
const waiting = new Map<string, () => void>();
let idling = false;
function later(key: string, make: () => void): void {
  if (waiting.has(key)) return;
  waiting.set(key, make);
  if (idling) return;
  idling = true;
  const run = (left: () => number): void => {
    idling = false;
    for (const [k, job] of waiting) {
      if (left() < 4) break;
      waiting.delete(k);
      job();
    }
    if (waiting.size) { idling = true; schedule(); }
  };
  const w = globalThis as unknown as { requestIdleCallback?: (f: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number };
  const schedule = (): void => {
    if (w.requestIdleCallback) w.requestIdleCallback((d) => run(() => d.timeRemaining()), { timeout: 120 });
    else setTimeout(() => { const t0 = performance.now(); run(() => 16 - (performance.now() - t0)); }, 30);
  };
  schedule();
}

/** Bake statistics, for a harness: how many pictures and how long they took. */
export const bridgeBakes = { count: 0, ms: 0, drawMs: 0, takeMs: 0, px: 0 };

/**
 * Draw a piece at its middle (`sx`, `sy`): its picture at this scale, made
 * now if the frame has time left for it (`kitMayBake`), else another scale's
 * stood in while it is made when the browser is idle. The box it is clicked
 * by comes back, left, top, right and bottom on the screen.
 */
export function drawBridgePiece(ctx: CanvasRenderingContext2D, p: BridgePieceAt, zoom: number, rotation: number): [number, number, number, number] | null {
  const T0 = performance.now();
  try {
    return drawPiece(ctx, p, zoom, rotation);
  } finally {
    bridgeBakes.drawMs += performance.now() - T0;
  }
}
function drawPiece(ctx: CanvasRenderingContext2D, p: BridgePieceAt, zoom: number, rotation: number): [number, number, number, number] | null {
  const pl = plans.get(p.b.id);
  if (!pl) return null;
  const sl = sliceOf(pl, p.i, p.o, rotation);
  const pm = sl[p.part];
  if (!pm.parts.length) return null;
  const { e, key: vk } = viewOfTurn(rotation);
  const scale = scaleFor(zoom);
  const base = `${pl.uid}|${vk}|${p.i}|${p.o}|${p.part}`;
  const key = `${base}|${scale}`;
  let sh = kept.get(key);
  const make = (): Sheet => {
    const t0 = performance.now();
    const s = bake(pm, sl.box[p.part], e, scale, (g) => layPiece(g, e, pm, pl.plan.style, 0.7, pl.plan.moss));
    bridgeBakes.count++;
    bridgeBakes.ms += performance.now() - t0;
    keep(key, s);
    return s;
  };
  if (sh) { kept.delete(key); kept.set(key, sh); }
  else if (kitIsSync() || kitMayBake()) {
    const t0 = performance.now();
    sh = make();
    kitBaked(performance.now() - t0);
  } else {
    for (const s2 of BAKE_STEPS) {
      const other = kept.get(`${base}|${s2}`);
      if (other) { sh = other; break; }
    }
    later(key, () => { if (!kept.has(key)) make(); });
  }
  if (sh) bridgeBakes.px += sh.w * sh.h * zoom * zoom;
  if (sh) ctx.drawImage(sh.canvas, p.sx + sh.x * zoom, p.sy + sh.y * zoom, sh.w * zoom, sh.h * zoom);
  const [x0, y0, x1, y1] = sl.box[p.part];
  return [p.sx + x0 * zoom, p.sy + y0 * zoom, p.sx + x1 * zoom, p.sy + y1 * zoom];
}

/**
 * A piece's light at night: its rune line, its keystones' runes and its
 * lamps, as the night is taken off it (`RunestoneNight.glowing`): the box
 * they cover, their soft light and their shapes, each moved by (dx, dy).
 * Null for a piece with none.
 */
export function bridgeNight(p: BridgePieceAt, zoom: number, rotation: number): { box: [number, number, number, number]; holes: (dx: number, dy: number) => NightHole[]; masks: (dx: number, dy: number) => NightMask[] } | null {
  const pl = plans.get(p.b.id);
  if (!pl || p.part === 'back') return null;
  const sl = sliceOf(pl, p.i, p.o, rotation);
  // The slice's light goes with its last piece: the near parapet where it has one, else the front.
  const owner: Part3 = sl.rail.parts.length ? 'rail' : 'front';
  if (p.part !== owner) return null;
  const g = sl[p.part].glow;
  if (!g.lines.length && !g.runes.length && !g.lamps.length) return null;
  const { e, key: vk } = viewOfTurn(rotation);
  const pts = [...g.lines.flat(), ...g.runes.map((r) => r.at), ...g.lamps].map((q) => proj(e, q));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = g.lamps.length ? 40 : 16;
  const box: [number, number, number, number] = [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
  const scale = scaleFor(zoom);
  const mkey = `${pl.uid}|${vk}|${p.i}|${p.o}|glow|${scale}`;
  return {
    box: [p.sx + box[0] * zoom, p.sy + box[1] * zoom, p.sx + box[2] * zoom, p.sy + box[3] * zoom],
    holes: (dx, dy) => [
      ...g.lamps.map((q) => { const [x, y] = proj(e, q); return { x: p.sx + dx + x * zoom, y: p.sy + dy + y * zoom, r: 34 * zoom, a: 0.75 }; }),
      ...lineHoles(g.lines.map((l) => [proj(e, l[0]), proj(e, l[1])])).map(([x, y]) => ({ x: p.sx + dx + x * zoom, y: p.sy + dy + y * zoom, r: 12 * zoom, a: 0.28 })),
    ],
    masks: (dx, dy) => {
      let sh = kept.get(mkey);
      if (!sh) {
        sh = bake(sl[p.part], box, e, scale, (gg) => layGlowMask(gg, e, g));
        keep(mkey, sh);
      }
      return [{ canvas: sh.canvas, x: p.sx + dx + sh.x * zoom, y: p.sy + dy + sh.y * zoom, w: sh.w * zoom, h: sh.h * zoom, a: 0.9 }];
    },
  };
}

/**
 * Where a rune line's soft light falls, along its pieces of line on the
 * screen (pixels at zoom one): one every `LINE_LIGHT` of their length,
 * however finely a style has cut the line, so every kind glows as strongly.
 */
const LINE_LIGHT = 20;
function lineHoles(lines: Array<[[number, number], [number, number]]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let at = LINE_LIGHT / 2;
  for (const [[x0, y0], [x1, y1]] of lines) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    while (at <= len) {
      out.push([x0 + ((x1 - x0) * at) / len, y0 + ((y1 - y0) * at) / len]);
      at += LINE_LIGHT;
    }
    at -= len;
  }
  return out;
}

/** Whether a bridge is drawn by this kit. */
export const kitBridge = (b: Bridge): boolean => isMaterialBridge(b.kind) && !!BRIDGE_STYLES[b.kind];

/** The deck's height at the middle of a tile of a bridge, any lane's (`deckHeight`). */
export const deckMid = (b: Bridge, x: number, y: number): number => deckHeight(b, x + 0.5, y + 0.5);
export { bridgeDone };

/** Let go of every plan and picture: for a harness timing them cold. */
export function forgetBridgeBakes(): void {
  plans.clear();
  kept.clear();
  keptArea = 0;
}
