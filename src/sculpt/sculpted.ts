/**
 * The sculpted bodies on the island: the door the figure comes through
 * (`drawLive` in `src/render/figure.ts`) when the "Sculpted figures" setting
 * is on and there is WebGL2. Loaded only then, as a chunk of its own, so the
 * game as it ships carries none of this.
 *
 * A look's body is baked off the frame: asked for, it goes on a queue that
 * idle time works through a band at a time (the far band first, so a crowd
 * is sculpted soon and sharpened as time allows), and until a band of it is
 * ready the flat figure is drawn as it always was. The pictures the island
 * keeps of a body (`drawStill` and the stride and idle loops) carry
 * `sculptGen`, which steps whenever a bake lands, so a body kept flat is drawn
 * again sculpted. Looks are kept least-recently-used, so many strangers
 * passing through cost what `MAX_LOOKS` bodies cost and no more; a look put
 * out has its bakes and their buffers on the graphics chip let go.
 */
import { DEFAULT_LOOK, type Look } from '../game/look';
import type { FigurePose } from '../render/figure';
import { bandOf, STRIDE } from './bake';
import type { Band } from './sdf';
import { drawSculptGL, forgetBuffers, glContext } from './gl';
import { bakedAt, built, forgetBuilt, proportionsOf, sculptScene, type Built } from './index';
import { hasLowBody, lowScene } from './lowpoly';

/** Looks kept baked at once, and the bytes of bakes kept for them, before the least recently drawn goes. */
const MAX_LOOKS = 12;
const MAX_BYTES = 24 << 20;
/** Milliseconds an idle slice needs left to start a band's bake, and how long a slice may wait before it runs regardless. */
const SLICE_MS = 14;
const SLICE_WAIT_MS = 120;

interface Entry { key: string; b: Built; ready: Set<Band>; queued: Set<Band>; bytes: number; used: number }
const LOOKS = new Map<string, Entry>();
let bytes = 0;
let gen = 0;
const queue: Array<{ e: Entry; band: Band }> = [];
let pumping = false;

const lookKey = (l: Look): string => `${l.gender}|${l.skin}|${l.hair}|${l.hairColour}|${l.eyes}|${l.beard}`;

/** Steps whenever a bake lands or a look goes, so pictures kept of bodies know to be made again. */
export const sculptGen = (): number => gen;

/** What the sculpted bodies hold: looks kept, bakes among them, their bytes, and bakes still to do. */
export function sculptMemory(): { looks: number; bakes: number; bytes: number; queued: number } {
  let bakes = 0;
  for (const e of LOOKS.values()) bakes += e.ready.size;
  return { looks: LOOKS.size, bakes, bytes, queued: queue.length };
}

function entryOf(look: Look, now: number): Entry {
  const key = lookKey(look);
  let e = LOOKS.get(key);
  if (e) {
    LOOKS.delete(key);
    LOOKS.set(key, e);
  } else {
    e = { key, b: built(proportionsOf(look), look, 'base', 'human'), ready: new Set(), queued: new Set(), bytes: 0, used: now };
    LOOKS.set(key, e);
    evict(now);
  }
  e.used = now;
  return e;
}

/** The least recently drawn looks let go while there are too many or their bakes too big, never one drawn this second. */
function evict(now: number): void {
  for (const [key, e] of LOOKS) {
    if (LOOKS.size <= MAX_LOOKS && bytes <= MAX_BYTES) return;
    if (now - e.used < 1000) return;
    LOOKS.delete(key);
    bytes -= e.bytes;
    for (const k of e.b.bakes.values()) forgetBuffers(k);
    forgetBuilt(e.b);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].e === e) queue.splice(i, 1);
    gen++;
  }
}

function want(e: Entry, band: Band): void {
  if (e.ready.has(band) || e.queued.has(band)) return;
  e.queued.add(band);
  queue.push({ e, band });
  pump();
}

type Idle = (f: (d: { timeRemaining(): number; didTimeout: boolean }) => void, o?: { timeout: number }) => number;

/** The queue worked through in idle time, a band a slice: the most recently drawn look's lowest band first. */
function pump(): void {
  if (pumping || !queue.length) return;
  pumping = true;
  const w = globalThis as unknown as { requestIdleCallback?: Idle };
  const run = (left: () => number, forced: boolean): void => {
    pumping = false;
    let first = true;
    while (queue.length && (first && forced ? true : left() >= SLICE_MS)) {
      first = false;
      // The most recently drawn look, its lowest band.
      let at = 0;
      for (let i = 1; i < queue.length; i++) {
        const a = queue[i], b = queue[at];
        if (a.e.used > b.e.used || (a.e.used === b.e.used && a.band < b.band)) at = i;
      }
      const [{ e, band }] = queue.splice(at, 1);
      e.queued.delete(band);
      if (!LOOKS.has(e.key)) continue;
      const k = bakedAt(e.b, band);
      const size = k.nVerts * STRIDE * 4 + k.nTris * 3 * 4;
      e.ready.add(band);
      e.bytes += size;
      bytes += size;
      gen++;
    }
    if (queue.length) pump();
  };
  if (w.requestIdleCallback) w.requestIdleCallback((d) => run(() => d.timeRemaining(), d.didTimeout), { timeout: SLICE_WAIT_MS });
  else setTimeout(() => run(() => SLICE_MS, true), 0);
}

/**
 * A body drawn sculpted with its feet at (sx, sy), in place of the flat
 * figure; false when it cannot be yet (no WebGL2, or the look's bake not
 * landed), and the flat figure is drawn instead. Drawn at the band the zoom
 * wants if that is baked, else at the nearest band that is, the wanted one
 * queued.
 */
export function drawSculptLive(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, pose: FigurePose): boolean {
  if (!glContext()) return false;
  // A man or a woman: the low-poly male or female on their own rig (`./lowpoly`), nothing to bake; neither keeps the base.
  if (hasLowBody(pose.look ?? DEFAULT_LOOK)) {
    const t = ctx.getTransform();
    return drawSculptGL(ctx, sx, sy, zoom, lowScene(pose), { dpr: Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1 });
  }
  const now = performance.now();
  const e = entryOf(pose.look ?? DEFAULT_LOOK, now);
  const wanted = bandOf(zoom);
  let band: Band | undefined;
  for (const b of [wanted, wanted - 1, wanted + 1, wanted - 2, wanted + 2] as Band[]) if (b >= 0 && b <= 2 && e.ready.has(b)) { band = b; break; }
  if (band === undefined) {
    want(e, 0);
    if (wanted !== 0) want(e, wanted);
    return false;
  }
  if (band !== wanted) want(e, wanted);
  // Device pixels to a unit of the context, so the body is drawn at the picture's own resolution.
  const t = ctx.getTransform();
  const dpr = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1;
  const scene = sculptScene(pose, zoom, undefined, now / 1000, band, { bake: e.b.bakes.get(band) });
  return drawSculptGL(ctx, sx, sy, zoom, scene, { dpr });
}
