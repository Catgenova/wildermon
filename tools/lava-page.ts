/**
 * The page `tools/lava-shot.mjs` opens to look at Volcano Isle's lava (`src/game/lava.ts`): the game's own renderer,
 * map and hud over a cone on Volcano Isle's place on the chart, 1024 tiles a side, as `supabase/test/lava.ts` builds
 * it, its ground bare slate rock above the tree line.
 *
 * Driven through `window.lava`: `shot({ day, hour, zoom, x, y, t })` puts the camera there on that day of the maze and
 * draws a frame at drawing clock `t`; `map({ day })` draws the map window round the cone; `hud({ heat })` draws the
 * hud with the heat meter at a share. The page's stylesheets are put in by the script. A tool and nothing else: the game it draws is a local copy of the rules, as the
 * boot check's pages are, never a game of its own for anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { World } from '../src/world/world';
import { TileType, TREE_DAWN_UTC } from '../src/world/tiles';
import { MinimapPanel } from '../src/ui/panels/minimap';
import { Hud } from '../src/ui/hud';
import { Keybinds } from '../src/game/keybinds';

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
  map(day: number): Promise<void>;
  hud(heat: number): Promise<void>;
}

const page: LavaPage = { ready: false, error: '', today: 0, shot: async () => {}, map: async () => {}, hud: async () => {} };
(window as unknown as { lava: LavaPage }).lava = page;

const SIZE = 1024;
const PX = 520;
const PY = 105;
const H = (cx: number, cy: number): number => 100 + Math.max(0, 560 - Math.floor(4 * Math.sqrt((cx - PX) ** 2 + (cy - PY) ** 2)));

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

try {
  const heights = new Int16Array((SIZE + 1) * (SIZE + 1));
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) heights[y * (SIZE + 1) + x] = H(x, y);
  const tiles = new Uint8Array(SIZE * SIZE);
  const rock = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) tiles[y * SIZE + x] = H(x, y) > 330 ? TileType.Rock : H(x, y) > 250 ? TileType.Steppe : TileType.Grass;
  const world = new World(SIZE, SIZE, heights, tiles, new Uint8Array(SIZE * SIZE), new Uint8Array((SIZE + 1) * (SIZE + 1)), rock);
  world.seed = 4242;
  const game = new Game({ seed: 4242, world, spawn: { x: 499, y: 64 } });
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

  page.shot = async (s) => {
    wall = dayAt(s.day);
    hour = s.hour;
    cam.zoom = s.zoom;
    cam.rotation = 0;
    game.player.x = s.x + 0.5;
    game.player.y = s.y + 8.5;
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

  let panel: HTMLDivElement | null = null;
  page.map = async (day) => {
    wall = dayAt(day);
    panel?.remove();
    panel = document.createElement('div');
    panel.className = 'win';
    panel.style.cssText = 'position:fixed;left:0;top:0;width:520px;height:640px;z-index:10;background:var(--t-panel,#1d1915);display:flex;flex-direction:column';
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
    panel.append(body);
    document.body.append(panel);
    const map = new MinimapPanel({ body } as unknown as ConstructorParameters<typeof MinimapPanel>[0], game, renderer);
    (map as unknown as { hold(at: { cx: number; cy: number; span: number }): void }).hold({ cx: PX, cy: PY, span: 190 });
    const view = body.querySelector('canvas') as HTMLCanvasElement;
    view.style.cssText = 'width:520px;height:520px;image-rendering:pixelated';
    map.update();
    await nextFrame();
  };

  let hudRoot: HTMLDivElement | null = null;
  let hud: Hud | null = null;
  page.hud = async (heat) => {
    wall = dayAt(page.today);
    game.player.x = 499.5;
    game.player.y = 64.5;
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
  page.ready = true;
} catch (e) {
  page.error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  page.ready = true;
}
