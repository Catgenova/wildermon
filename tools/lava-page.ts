/**
 * The page `tools/lava-shot.mjs` opens to look at Volcano Isle's labyrinth of lava (`src/game/lava.ts`): the game's own
 * renderer, map and hud over an island 1024 a side with land where the chart puts Volcano Isle's and a cone over it, bare
 * rock to the shore; and, off the game, the ten designs at the live island's size and the heart's
 * seryll on its generated ground.
 *
 * Driven through `window.lava`: `shot({ day, hour, zoom, x, y, t })` puts the camera there on that day and draws a
 * frame at drawing clock `t`; `entrance(k)` is where the day's way in `k` is; `map({ day })` draws the map window;
 * `hud({ heat })` the hud with the heat meter at a share; `sheet()` the ten designs at 4096, each true path in its
 * colour; `seryll()` the heart at 4096 with its seryll seams marked. The page's stylesheets are put in by the script.
 * A tool and nothing else: the game it draws is a local copy of the rules, as the boot check's pages are, never a game
 * of its own for anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { World } from '../src/world/world';
import { ROCK_VARIANTS, TileType, TREE_DAWN_UTC } from '../src/world/tiles';
import { MinimapPanel } from '../src/ui/panels/minimap';
import { Hud } from '../src/ui/hud';
import { Keybinds } from '../src/game/keybinds';
import { generateAtlasWindow, loadAtlas } from '../src/world/atlas-world';
import {
  inLavaHeart, LAVA_CELL, LAVA_DESIGNS, LAVA_HEART, LAVA_RADIUS, LB_LAVA, lavaChartAt, lavaDesign, lavaDesignOf, lavaGeometry, ROOM_HEART, ROOM_IN, ROOM_LAND,
} from '../src/game/lava';

interface Shot {
  day: number;
  hour: number;
  zoom: number;
  x: number;
  y: number;
  t: number;
}

interface LavaPage {
  ready: boolean;
  error: string;
  today: number;
  shot(s: Shot): Promise<void>;
  entrance(k: number): [number, number];
  map(day: number): Promise<void>;
  hud(heat: number): Promise<void>;
  sheet(): Promise<{ width: number; height: number }>;
  seryll(): Promise<{ width: number; height: number; seams: number }>;
  clear(): void;
}

const page: LavaPage = {
  ready: false, error: '', today: 0, shot: async () => {}, entrance: () => [0, 0], map: async () => {}, hud: async () => {},
  sheet: async () => ({ width: 0, height: 0 }), seryll: async () => ({ width: 0, height: 0, seams: 0 }), clear: () => {},
};
(window as unknown as { lava: LavaPage }).lava = page;

const SIZE = 1024;
const G = lavaGeometry(SIZE);
const H = (cx: number, cy: number): number =>
  lavaChartAt(cx, cy, SIZE) >= 1 ? 20 + Math.max(0, 640 - Math.floor(5 * Math.sqrt((cx - G.cx) ** 2 + (cy - G.cy) ** 2))) : -40;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));
const overlays: HTMLElement[] = [];
page.clear = () => {
  for (const e of overlays.splice(0)) e.remove();
};

try {
  const heights = new Int16Array((SIZE + 1) * (SIZE + 1));
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) heights[y * (SIZE + 1) + x] = H(x, y);
  const tiles = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = H(x, y);
      tiles[y * SIZE + x] = h < 4 ? TileType.Sand : h > 40 ? TileType.Rock : TileType.Steppe;
    }
  }
  const world = new World(SIZE, SIZE, heights, tiles, new Uint8Array(SIZE * SIZE), new Uint8Array((SIZE + 1) * (SIZE + 1)), new Uint8Array(SIZE * SIZE));
  world.seed = 4242;
  const game = new Game({ seed: 4242, world, spawn: { x: G.cx, y: G.cy + 20 } });
  let hour = 13;
  let wall = Date.now() / 1000;
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.wallClock = () => wall;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  game.settings.grid = false;
  page.today = game.lavaToday();
  const dayAt = (day: number): number => day * 86400 + TREE_DAWN_UTC * 3600 + 5 * 3600;
  game.update(0.01);
  const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
  const cam = renderer.camera;

  page.entrance = (k) => {
    const D = lavaDesign(SIZE, lavaDesignOf(4242, page.today));
    const e = D.entrances[k];
    return [e[0] * LAVA_CELL + 1, e[1] * LAVA_CELL + 1];
  };

  page.shot = async (s) => {
    wall = dayAt(s.day);
    hour = s.hour;
    cam.zoom = s.zoom;
    cam.rotation = 0;
    game.player.x = s.x + 0.5;
    game.player.y = s.y + 0.5;
    cam.focus(s.x, s.y, world.heightAt(s.x, s.y), null);
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

  page.map = async (day) => {
    wall = dayAt(day);
    page.clear();
    const panel = document.createElement('div');
    panel.className = 'win';
    panel.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:640px;z-index:10;background:var(--t-panel,#1d1915);display:flex;flex-direction:column';
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
    panel.append(body);
    document.body.append(panel);
    overlays.push(panel);
    const map = new MinimapPanel({ body } as unknown as ConstructorParameters<typeof MinimapPanel>[0], game, renderer);
    (map as unknown as { hold(at: { cx: number; cy: number; span: number }): void }).hold({ cx: G.cx, cy: G.cy + 20, span: 2 * G.radius + 40 });
    const view = body.querySelector('canvas') as HTMLCanvasElement;
    view.style.cssText = 'width:520px;height:520px;image-rendering:pixelated';
    map.update();
    await nextFrame();
  };

  let hudRoot: HTMLDivElement | null = null;
  let hud: Hud | null = null;
  page.hud = async (heat) => {
    page.clear();
    wall = dayAt(page.today);
    game.player.x = G.cx + 15.5;
    game.player.y = G.cy + 0.5;
    game.heat = heat;
    game.cooledUntil = wall + 420;
    if (!hud) {
      hudRoot = document.createElement('div');
      hudRoot.id = 'ui';
      hudRoot.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none';
      document.body.append(hudRoot);
      hud = new Hud(hudRoot, game, {
        toggle: () => {}, toggleGrid: () => {}, center: () => {}, windows: () => {}, turn: () => {}, useLoop: () => {}, numbersTaken: () => false,
        keys: new Keybinds(),
      });
    }
    (hud as unknown as { lastAt: number }).lastAt = -1e9;
    hud.update(renderer, 60);
    await nextFrame();
  };

  // The ten designs at the live island's size, block by block: lava, the labyrinth's corridors, the heart, the land
  // outside and the sea; each true path in its colour, its way in ringed.
  const PATH_INK = ['#36d1ff', '#ffe14d', '#ff5fd2'];
  page.sheet = async () => {
    page.clear();
    const S = 4096;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:30;background:#120e0b;color:#f3dcb6;font:13px system-ui;display:grid;grid-template-columns:repeat(5,auto);gap:10px;padding:10px';
    document.body.append(wrap);
    overlays.push(wrap);
    for (let d = 0; d < LAVA_DESIGNS; d++) {
      const D = lavaDesign(S, d);
      const cv = document.createElement('canvas');
      cv.width = D.nbx;
      cv.height = D.nby;
      const c = cv.getContext('2d')!;
      const img = c.createImageData(D.nbx, D.nby);
      const put = (u: number, v: number, rgb: [number, number, number]): void => {
        const i = (v * D.nbx + u) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
      };
      for (let v = 0; v < D.nby; v++) {
        for (let u = 0; u < D.nbx; u++) {
          const r = D.room[(v >> 1) * D.nrx + (u >> 1)];
          const lava = (D.bytes[v * D.nbx + u] & LB_LAVA) !== 0;
          put(u, v, lava ? [236, 92, 26] : r === ROOM_IN ? [70, 62, 60] : r === ROOM_HEART ? [196, 186, 160] : r === ROOM_LAND ? [104, 126, 82] : [40, 70, 110]);
        }
      }
      D.paths.forEach((p, k) => {
        const ink = PATH_INK[k];
        const rgb: [number, number, number] = [parseInt(ink.slice(1, 3), 16), parseInt(ink.slice(3, 5), 16), parseInt(ink.slice(5, 7), 16)];
        for (let i = 0; i < p.length; i++) {
          const [bx, by] = p[i];
          put(bx - D.bxa, by - D.bya, rgb);
          if (i + 1 < p.length) put((bx + p[i + 1][0]) / 2 - D.bxa, (by + p[i + 1][1]) / 2 - D.bya, rgb);
        }
        for (const w of [D.entrances[k], D.exits[k]]) put(w[0] - D.bxa, w[1] - D.bya, rgb);
      });
      c.putImageData(img, 0, 0);
      const fig = document.createElement('figure');
      fig.style.cssText = 'margin:0';
      const cap = document.createElement('figcaption');
      cap.textContent = `Design ${d + 1}: true paths ${D.paths.map((p) => p.length).join(' / ')} rooms`;
      cv.style.cssText = `width:${D.nbx}px;height:${D.nby}px;image-rendering:pixelated;display:block`;
      fig.append(cv, cap);
      wrap.append(fig);
      const ctx = cv.getContext('2d')!;
      D.entrances.forEach((e, k) => {
        ctx.strokeStyle = PATH_INK[k];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e[0] - D.bxa + 0.5, e[1] - D.bya + 0.5, 7, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    const key = document.createElement('div');
    key.style.cssText = 'grid-column:1/-1';
    key.textContent = `Ten designs at 4096: ${LAVA_RADIUS} tiles round the caldera, heart ${LAVA_HEART}; a pixel a ${LAVA_CELL}-tile block. Orange lava, grey corridors, pale heart, green land outside, blue sea; the three true paths in cyan, yellow and pink, each way in ringed.`;
    wrap.append(key);
    await nextFrame();
    const r = wrap.getBoundingClientRect();
    return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
  };

  // The heart at the live island's size, seed 7, on its generated ground: shaded by height, the sea and the crater lake
  // blue, the heart's edge ringed, every seryll seam a red mark.
  page.seryll = async () => {
    page.clear();
    const S = 4096;
    const g = lavaGeometry(S);
    const atlas = await loadAtlas();
    const half = g.heart + 30;
    const x0 = g.cx - half, y0 = g.cy - half, w = 2 * half, h = 2 * half;
    const win = generateAtlasWindow(7, atlas, x0, y0, w, h, S);
    const SER = ROCK_VARIANTS.findIndex((r) => r.yields === 'seryll_ore');
    const k = 3;
    const cv = document.createElement('canvas');
    cv.width = w * k;
    cv.height = h * k;
    const c = cv.getContext('2d')!;
    let seams = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const hh = win.heights[y * (w + 1) + x];
        const s = Math.max(0, Math.min(1, (hh - 300) / 400));
        c.fillStyle = hh < 0 ? '#2d5a8a' : inLavaHeart(x0 + x, y0 + y, S) ? `rgb(${150 + 70 * s},${140 + 60 * s},${120 + 50 * s})` : `rgb(${90 + 60 * s},${84 + 50 * s},${80 + 40 * s})`;
        c.fillRect(x * k, y * k, k, k);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (win.rock[y * w + x] !== SER) continue;
        seams++;
        c.fillStyle = '#e8203a';
        c.strokeStyle = '#000';
        c.beginPath();
        c.arc(x * k + k / 2, y * k + k / 2, 3.2, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
    c.strokeStyle = '#ffb000';
    c.lineWidth = 2;
    c.beginPath();
    c.arc((g.cx - x0) * k, (g.cy - y0) * k, g.heart * k, 0, Math.PI * 2);
    c.stroke();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:30;background:#120e0b;color:#f3dcb6;font:13px system-ui;padding:10px';
    const cap = document.createElement('div');
    cap.textContent = `The heart, seed 7 at 4096: ${g.heart} tiles round (${g.cx}, ${g.cy}), ringed; ${seams} seryll seams (red), none outside it.`;
    wrap.append(cv, cap);
    document.body.append(wrap);
    overlays.push(wrap);
    await nextFrame();
    const r = wrap.getBoundingClientRect();
    return { width: Math.ceil(r.width), height: Math.ceil(r.height), seams };
  };
  page.ready = true;
} catch (e) {
  page.error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  page.ready = true;
}
