/**
 * The page `scripts/boot-check.mjs` opens for the frames of a walk through a
 * wood: the game as the island runs it and the renderer, the camera carried at
 * a steady pace along the row of the island with the most trees beside it,
 * every frame drawn as the loop draws it (`Renderer.render`), the timings on.
 *
 * Reported: "Getting a lot of 2000ms drawing <5fps while travelling near
 * trees". On a browser that draws on the graphics chip, a canvas there read
 * back (`getImageData`, `toBlob`) holds the page until the chip has drawn
 * everything asked of it before: every solid tree baked on the way was read
 * back for where its ink is (`inkOf`) and again for the browser's store, and
 * the ferns at its foot made even a bake in memory one. So this counts every
 * read-back of a canvas that is not kept in memory (`READ_BACK`), by who asked,
 * and the canvases made in each frame (ground edge pictures, up to 315 in one
 * frame on the move, before `HEMS_A_FRAME`).
 *
 * Read back through `window.treewalk` once `done` is set. Query parameters for
 * a bench by hand: `seconds`, `speed` (tiles a second), `zoom`, `size` (of the
 * island), `hour`, and `open` for the row with the fewest trees instead.
 *
 * A test harness and nothing else: the game it draws is a local copy of the
 * rules (`Game.create`), as the boot check's other pages are, never a game of
 * its own for anybody to play.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { TileType } from '../../src/world/tiles';
import { tree3dStats } from '../../src/render/trees3d';

export interface TreeWalk {
  /** The walk: from, to, tiles a second, and the trees within three tiles of it. */
  from: [number, number];
  to: [number, number];
  speed: number;
  trees: number;
  /** Each frame's drawing, in ms (`Renderer.render`). */
  frames: number[];
  /** The time from each frame to the next the page drew, in ms: the drawing and what the browser does with it after. */
  gaps: number[];
  /** Of each frame's drawing, the ms that went on the solid trees' bakes and shades. */
  bakeMs: number[];
  /** Ms of drawing per layer over the walk (`Timings`' layers, with the bakes their own; the ground what is left). */
  layers: Record<string, number>;
  /** Canvases made in each frame. */
  canvases: number[];
  /** Read-backs of canvases on the graphics chip over the walk, by caller: how many, and their ms. */
  chipReads: Array<[string, number, number]>;
  /** Read-backs of canvases in memory over the walk: how many, and their ms. */
  memReads: [number, number];
  /** What the solid trees made on the way (`tree3dStats`). */
  stats: Record<string, number>;
  error: string;
  done: boolean;
}

const seen: TreeWalk = { from: [0, 0], to: [0, 0], speed: 0, trees: 0, frames: [], gaps: [], bakeMs: [], layers: {}, canvases: [], chipReads: [], memReads: [0, 0], stats: {}, error: '', done: false };
(window as unknown as { treewalk: TreeWalk }).treewalk = seen;

const params = new URLSearchParams(location.search);
/** How long the walk lasts, in seconds, and how fast it goes, in tiles a second. */
const SECONDS = Number(params.get('seconds') ?? 8);
const SPEED = Number(params.get('speed') ?? 6);
const ZOOM = Number(params.get('zoom') ?? 1);
const SIZE = Number(params.get('size') ?? 256);
const HOUR = Number(params.get('hour') ?? 13);

document.getElementById('boot')?.remove();
let canvasEl = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvasEl) {
  canvasEl = document.createElement('canvas');
  canvasEl.id = 'game';
  document.body.appendChild(canvasEl);
}
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

/* ---- read-backs and canvases, counted ---------------------------------------------------- */

let counting = false;
let made = 0;
const chip = new Map<string, [number, number]>();
/** Whether a canvas is kept in memory, where a read is a copy. */
const inMemory = (g: CanvasRenderingContext2D | null): boolean => !!(g?.getContextAttributes() as { willReadFrequently?: boolean } | undefined)?.willReadFrequently;
/** A read-back, timed: counted against the canvas's caller when it is on the chip. */
function counted<T>(g: CanvasRenderingContext2D | null, read: () => T): T {
  if (!counting) return read();
  const t0 = performance.now();
  try {
    return read();
  } finally {
    const ms = performance.now() - t0;
    if (inMemory(g)) {
      seen.memReads[0]++;
      seen.memReads[1] += ms;
    } else {
      const by = (new Error().stack ?? '').split('\n').slice(3, 5).map((l) => l.trim().replace(/\(.*\)|https?:\S+|^at /g, '').trim()).join(' < ');
      const was = chip.get(by) ?? [0, 0];
      chip.set(by, [was[0] + 1, was[1] + ms]);
    }
  }
}
{
  const proto = CanvasRenderingContext2D.prototype;
  const getImageData = proto.getImageData;
  proto.getImageData = function (this: CanvasRenderingContext2D, ...a: Parameters<typeof getImageData>): ImageData {
    return counted(this, () => getImageData.apply(this, a));
  };
  const toBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, ...a: Parameters<typeof toBlob>): void {
    // The context it already has: asked again with no settings, a canvas hands back the one it was made with.
    return counted(this.getContext('2d'), () => toBlob.apply(this, a));
  };
  const make = document.createElement.bind(document);
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    if (tag === 'canvas') made++;
    return make(tag, o);
  }) as typeof document.createElement;
}

/* ---- the walk ------------------------------------------------------------------------------- */

try {
  const game = Game.create(4242, SIZE);
  game.islandClock = () => 1000 * DAY_SECONDS + (HOUR / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.springs.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  const world = game.world;

  // The row with the most trees within three tiles of it, `SECONDS * SPEED` long, across x; with `open`, the fewest, on dry land.
  const len = Math.ceil(SECONDS * SPEED);
  const open = params.has('open');
  const isTree = (x: number, y: number): number => (world.inBounds(x, y) && world.getTile(x, y) === TileType.Tree ? 1 : 0);
  const wet = (x: number, y: number): boolean => world.getHeight(x, y) <= 0 || world.hasWater(x, y);
  let best = { n: open ? Infinity : -1, x: 0, y: 0 };
  for (let y = 8; y < world.h - 8; y += 2) {
    for (let x = 8; x + len < world.w - 8; x += 4) {
      let n = 0;
      let dry = true;
      for (let i = 0; i <= len; i++) {
        for (let d = -3; d <= 3; d++) {
          n += isTree(x + i, y + d);
          if (open && wet(x + i, y + d)) dry = false;
        }
      }
      if (open ? dry && n < best.n : n > best.n) best = { n, x, y };
    }
  }
  seen.from = [best.x, best.y];
  seen.to = [best.x + len, best.y];
  seen.speed = SPEED;
  seen.trees = best.n;
  game.putBody(best.x + 0.5, best.y + 0.5, 0);

  const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
  game.settings.timings = true;
  const cam = renderer.camera;
  cam.zoom = ZOOM;
  const at = (x: number, y: number): void => {
    game.player.x = x;
    game.player.y = y;
    cam.focus(x, y, Math.max(-4, game.playerHeight()), null);
  };
  // Where the walk starts, a while: the trees there made, as on coming ashore.
  at(best.x + 0.5, best.y + 0.5);
  for (let i = 0; i < 40; i++) {
    game.update(1 / 60);
    renderer.render(1 / 60);
    await nextFrame();
  }
  const stats0 = { ...tree3dStats } as Record<string, number>;
  // Each layer's own time this frame, off the timings' sums before and after: kept whole rather than cleared each half second.
  const sums = (renderer.timings as unknown as { sums: Map<string, number> }).sums;
  sums.clear = (): void => {};
  const layerMs = new Map<string, number>();
  const add = (k: string, ms: number): void => {
    layerMs.set(k, (layerMs.get(k) ?? 0) + ms);
  };

  counting = true;
  const t0 = performance.now();
  let last = t0;
  for (;;) {
    const now = await nextFrame();
    const s = (performance.now() - t0) / 1000;
    if (s > SECONDS) break;
    if (seen.frames.length) seen.gaps.push(now - last);
    last = now;
    at(best.x + 0.5 + s * SPEED, best.y + 0.5);
    game.update(1 / 60);
    const before = new Map(sums);
    const baked0 = tree3dStats.ms + tree3dStats.shadeMs;
    const made0 = made;
    const f0 = performance.now();
    renderer.render(1 / 60);
    const ms = performance.now() - f0;
    seen.frames.push(ms);
    seen.canvases.push(made - made0);
    // The solid trees' bakes and shades, made inside whichever layer asked for them, as a layer of their own.
    const baked = tree3dStats.ms + tree3dStats.shadeMs - baked0;
    seen.bakeMs.push(baked);
    add('tree bakes', baked);
    let claimed = baked;
    for (const [k, v] of sums) {
      const d = v - (before.get(k) ?? 0);
      if (k === 'frame' || d <= 0) continue;
      add(k, d);
      claimed += d;
    }
    add('ground', Math.max(0, ms - claimed));
  }
  counting = false;
  seen.layers = Object.fromEntries([...layerMs].map(([k, v]) => [k, Math.round(v)]));
  const st = tree3dStats as unknown as Record<string, number>;
  seen.stats = Object.fromEntries(Object.keys(st).map((k) => [k, Math.round((st[k] - stats0[k]) * 10) / 10]));
  seen.chipReads = [...chip].sort((a, b) => b[1][1] - a[1][1]).map(([k, [n, ms]]) => [k, n, Math.round(ms)]);
  seen.memReads = [seen.memReads[0], Math.round(seen.memReads[1])];
} catch (e) {
  seen.error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
}
seen.done = true;
