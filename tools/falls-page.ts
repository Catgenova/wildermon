/**
 * The page `tools/falls-shot.mjs` opens to look at the waterfalls: the game's
 * own renderer over a small island built for them, with every kind of fall
 * the falls painter (`src/render/falls.ts`) draws standing in it --
 *
 *   * `stream`: a spring's bowl going over a three-corner sill onto a terrace,
 *     the stream down it over a short ledge, then over a tall one into a
 *     catch pond (`ledge` and `tall` are the two ledges, closer);
 *   * `spill`: a wide pond going over nine corners of its rim, a tall drop
 *     onto rock;
 *   * `fountain`: a tiered fountain, running;
 *   * `aqueduct`: an aqueduct off a spring's bowl, its spout pouring into a
 *     hollow it fills.
 *
 * Driven through `window.falls`: `shot({ scene, zoom, turn, hour, t })` puts
 * the camera there and draws one frame at drawing clock `t`, for the script
 * to take a picture of; `bench(...)` draws frames there and times them; and
 * `painter(...)` times the falls painter alone on a few sheets, off screen.
 *
 * A tool and nothing else: the game it draws is a local copy of the rules
 * (`Game.create`), as the boot check's pages are, never a game of its own for
 * anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { packTreeData, TileType } from '../src/world/tiles';
import { drawFoot, drawLip, drawSheet, place, type FallView, type Sheet } from '../src/render/falls';
import { HALF_H, HALF_W, HEIGHT_SCALE } from '../src/render/iso';

interface Shot {
  scene: string;
  zoom: number;
  turn: number;
  hour: number;
  t: number;
}

interface FallsPage {
  ready: boolean;
  error: string;
  shot(s: Shot): Promise<void>;
  bench(s: Shot, frames: number): Promise<{ median: number; mean: number }>;
  painter(zoom: number, reps: number): { ms: number; sheet: number; foot: number; lip: number };
}

const page: FallsPage = {
  ready: false, error: '',
  shot: async () => {}, bench: async () => ({ median: 0, mean: 0 }), painter: () => ({ ms: 0, sheet: 0, foot: 0, lip: 0 }),
};
(window as unknown as { falls: FallsPage }).falls = page;

/* ---- The island --------------------------------------------------------------------------- */

const SIZE = 64;

/** The aqueduct scene, as `supabase/test/aqueduct.ts` builds it, moved 24 east and 6 south. */
function aqueductHeight(x: number, y: number): number {
  if (x <= 16) {
    if (x >= 12 && x <= 14 && y >= 39 && y <= 41) return x === 13 && y === 40 ? 120 : 135;
    if (x === 15 && y === 40) return 136;
    if (x === 16 && y === 40) return 138;
    return 150;
  }
  if (x >= 18 && x <= 20 && y >= 45 && y <= 47) return 20;
  if (x >= 23 && x <= 25 && y >= 39 && y <= 41) return x === 24 && y === 40 ? 40 : 46;
  return 60 - Math.max(0, y - 36) * 2;
}

function height(x: number, y: number): number {
  if (y >= 58) return -8;
  // The stream: a bowl on a plateau at 150, its sill three corners wide, a terrace, a short ledge, a tall one, a catch pond.
  if (x >= 2 && x <= 22 && y <= 34) {
    if (y <= 10) {
      if (x >= 11 && x <= 13 && y >= 7 && y <= 9) return x === 12 && y === 8 ? 122 : 134;
      if (x >= 11 && x <= 13 && y === 10) return 140;
      return 150;
    }
    if (y <= 14) return 112 - 2 * (y - 11) + 3 * Math.abs(x - 12);
    if (y <= 18) return 86 - 2 * (y - 15) + 3 * Math.abs(x - 12);
    if (x >= 10 && x <= 14 && y >= 19 && y <= 21) return 14;
    return Math.max(-8, 28 - 2 * (y - 19));
  }
  // The spill: a wide pond on a plateau at 120 going over nine corners of its rim onto rock 58 below.
  if (x >= 28 && x <= 60 && y <= 34) {
    if (y <= 13) {
      if (x >= 36 && x <= 54 && y >= 5 && y <= 12) return 100;
      if (x >= 40 && x <= 48 && y === 13) return 110;
      return 120;
    }
    return Math.max(-8, 52 - 3 * (y - 14));
  }
  if (x >= 30 && x <= 54 && y >= 36) return aqueductHeight(x - 24, y - 6);
  return 30;
}

/** Where each scene is looked at from: the tile and the height. */
const SCENES: Record<string, [number, number, number]> = {
  stream: [12, 15, 80],
  ledge: [12, 14.5, 95],
  tall: [12, 18.5, 50],
  spill: [44, 14, 80],
  fountain: [10.5, 46.5, 32],
  aqueduct: [46.5, 46.5, 75],
};

const params = new URLSearchParams(location.search);

document.getElementById('boot')?.remove();
let canvasEl = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvasEl) {
  canvasEl = document.createElement('canvas');
  canvasEl.id = 'game';
  document.body.appendChild(canvasEl);
}
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

try {
  const game = Game.create(Number(params.get('seed') ?? 4242), SIZE);
  let hour = 13;
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  const w = game.world;
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, height(x, y));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const hs = [w.getHeight(x, y), w.getHeight(x + 1, y), w.getHeight(x, y + 1), w.getHeight(x + 1, y + 1)];
      const lo = Math.min(...hs);
      const hi = Math.max(...hs);
      let t: number = lo < 0 ? TileType.Sand : TileType.Grass;
      if (hi - lo > 10) t = TileType.Rock;
      w.setTile(x, y, t as TileType, 0);
    }
  }
  // Rock round the foot of the spill, where it lands, and a few trees by each scene.
  for (let y = 14; y <= 16; y++) for (let x = 38; x <= 50; x++) w.setTile(x, y, TileType.Rock);
  const trees: Array<[number, number, number]> = [
    [6, 4, 1], [18, 5, 5], [16, 24, 3], [7, 26, 2], [33, 6, 1], [57, 8, 5], [34, 20, 2], [56, 22, 3],
    [7, 42, 2], [14, 50, 3], [52, 40, 1], [33, 52, 3],
  ];
  for (const [x, y, sp] of trees) w.setTile(x, y, TileType.Tree, packTreeData(sp, (x * 7 + y) & 7));
  game.springs.lay();
  const ago = Date.now() - 3600 * 1000;
  // The aqueduct first, so the bowl's water goes along it.
  const aq = game.addBridge('aqueduct', 39, 46, 48, 46, 138);
  for (const sp of aq.spans) for (const k of Object.keys(sp.needed)) sp.needed[k] = 0;
  game.springs.dig(12, 8, null, ago);
  game.springs.dig(44, 8, null, ago);
  game.springs.dig(37, 46, null, ago);
  const fountain = game.addFurniture('fountain', 10, 46, 0, 0, 80);
  fountain.litres = 50;
  game.update(0.01);

  const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
  const cam = renderer.camera;
  const look = (s: Shot): void => {
    const [x, y, h] = SCENES[s.scene] ?? SCENES.stream;
    hour = s.hour;
    cam.zoom = s.zoom;
    cam.rotation = s.turn;
    game.player.x = 62.5;
    game.player.y = 62.5;
    cam.focus(x, y, h, null);
  };
  page.shot = async (s) => {
    look(s);
    // Let what is made over frames (the ground's pictures, the trees) be made, then the frame at `t`.
    for (let i = 0; i < 24; i++) {
      game.update(1 / 60);
      renderer.time = s.t - 1 + i / 24;
      renderer.render(0);
      await nextFrame();
    }
    renderer.time = s.t;
    renderer.render(0);
    await nextFrame();
  };
  page.bench = async (s, frames) => {
    look(s);
    // Long enough for the ground's pictures and the trees' bakes to be made, then timed.
    for (let i = 0; i < 180; i++) {
      game.update(1 / 60);
      renderer.render(1 / 60);
      await nextFrame();
    }
    const ms: number[] = [];
    for (let i = 0; i < frames; i++) {
      const t0 = performance.now();
      renderer.render(1 / 60);
      ms.push(performance.now() - t0);
      await nextFrame();
    }
    ms.sort((a, b) => a - b);
    return { median: ms[ms.length >> 1], mean: ms.reduce((a, b) => a + b, 0) / ms.length };
  };

  /*
   * The painter alone: a stream's fall over one corner, a pond's nine corners
   * wide in pieces a tile each, a short one onto the ground, and a fountain's
   * ring in two halves, drawn whole `reps` times at a zoom, off screen.
   */
  const off = document.createElement('canvas');
  off.width = 1200;
  off.height = 900;
  const g = off.getContext('2d')!;
  page.painter = (zoom, reps) => {
    const v: FallView = {
      ox: 600, oy: 300, xx: HALF_W * zoom, xy: -HALF_W * zoom, yx: HALF_H * zoom, yy: HALF_H * zoom,
      hs: HEIGHT_SCALE * zoom, zoom, t: 0, width: 1200, height: 900,
    };
    const land = (n: number, h: number): Float64Array => new Float64Array(n).fill(h);
    const sheets: Sheet[] = [
      { axis: 0, line: 2, from: -3, to: -3, half: 0.24, way: 1, reach: 1, curl: 1, top: 80, landFrom: -3, land: land(1, 20), wet: true, grow: 1, feed: 0.1 },
      { axis: 0, line: 0, from: 0, to: 8, half: 0.32, way: 1, reach: 1, curl: 1, top: 110, landFrom: 0, land: land(9, 52), wet: false, grow: 1 },
      { axis: 1, line: 6, from: 2, to: 2, half: 0.22, way: 1, reach: 1, curl: 1, top: 40, landFrom: 2, land: land(1, 20), wet: false, grow: 1, feed: 0.1 },
      {
        axis: 0, line: 99, from: 0, to: Math.PI * 2 * 0.185, half: 0, way: 1, reach: 0.055, curl: 0.4, top: 41, landFrom: 0, land: land(1, 33.6),
        wet: true, grow: 1, ring: { x: 4, y: 4, r: 0.185 }, back: 0.045, flow: 0.3,
      },
    ];
    const parts = [0, 0, 0];
    const once = (r: number): void => {
      v.t = r / 60;
      g.clearRect(0, 0, 1200, 900);
      for (const s of sheets) {
        const p = place(v, s);
        const lo = s.from - s.half;
        const hi = s.to + s.half;
        // In pieces a tile of the lip each, as a pond's sill is drawn.
        const cuts = s.ring ? [0, s.to / 2, s.to] : [lo, ...Array.from({ length: Math.max(0, s.to - s.from - 1) }, (_, i) => s.from + 1 + i), hi];
        for (let k = 0; k + 1 < cuts.length; k++) {
          const t0 = performance.now();
          drawSheet(g, v, p, cuts[k], cuts[k + 1]);
          const t1 = performance.now();
          drawFoot(g, v, p, cuts[k], cuts[k + 1], null);
          const t2 = performance.now();
          drawLip(g, v, p, cuts[k], cuts[k + 1]);
          parts[0] += t1 - t0;
          parts[1] += t2 - t1;
          parts[2] += performance.now() - t2;
        }
      }
    };
    // Warmed first; then the best of five runs of `reps`, as the least disturbed.
    for (let r = 0; r < reps; r++) once(r);
    let best = Infinity;
    parts.fill(0);
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) once(r);
      best = Math.min(best, (performance.now() - t0) / reps);
    }
    return { ms: best, sheet: parts[0] / reps / 5, foot: parts[1] / reps / 5, lip: parts[2] / reps / 5 };
  };
  page.ready = true;
} catch (e) {
  page.error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  page.ready = true;
}
