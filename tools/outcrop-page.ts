/**
 * The page `tools/outcrop-shot.mjs` opens to look the outcroppings over where they stand (`outcrops.ts`,
 * `src/render/kit/outcropping.ts`): a few of each kind set down on the grass of a Runestone's safe ring, at their
 * stages of being mined down, drawn by the game's own renderer at a zoom and an hour.
 *
 * Driven through `window.outc`: `scene(zoom, hour, uses)` sets them down with the uses given, one for each, and draws.
 *
 * A tool and nothing else: the island it draws is a local copy of the rules (`Game.create`), as the goblin page's is,
 * never a game for anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { TileType } from '../src/world/tiles';
import { RUNESTONES, stoneCentre } from '../src/game/runestones';

interface OutcPage {
  ready: boolean;
  error: string;
  scene(zoom: number, hour: number, uses: number[]): Promise<{ x: number; y: number }>;
}
const page: OutcPage = { ready: false, error: '', scene: async () => ({ x: 0, y: 0 }) };
(window as unknown as { outc: OutcPage }).outc = page;

const SIZE = 1024;
let game: Game;
let renderer: Renderer;
let hour = 13;
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

/** Where each is set down, off the stone's centre, and its kind. */
const SPOTS: Array<[number, number, string]> = [
  [-10, 9, 'iron_outcrop'], [-4, 11, 'rock_outcrop'], [3, 10, 'iron_outcrop'], [9, 9, 'rock_outcrop'],
  [11, 3, 'rock_outcrop'], [-11, 2, 'iron_outcrop'], [0, 14, 'rock_outcrop'], [7, 13, 'iron_outcrop'],
];

page.scene = async (zoom, h, uses) => {
  hour = h;
  const c = stoneCentre(RUNESTONES[0], SIZE);
  for (const f of [...game.furniture.values()]) game.furniture.delete(f.id);
  SPOTS.forEach(([dx, dy, kind], i) => {
    const f = game.addFurniture(kind, c.x + dx, c.y + dy, 0, 0, 5, [], undefined, (['s', 'e', 'n', 'w'] as const)[i % 4]);
    f.uses = uses[i % uses.length];
  });
  const cam = renderer.camera;
  cam.zoom = zoom;
  cam.rotation = 0;
  // At zoom one the stone and all of them; closer, the four nearest the player, who stands among them (the camera follows).
  const at = zoom > 1 ? { x: c.x - 1, y: c.y + 10.5 } : { x: c.x + 0.5, y: c.y + 6.5 };
  game.player.x = at.x;
  game.player.y = at.y;
  for (let i = 0; i < 20; i++) {
    game.time += 1 / 30;
    cam.focus(at.x, at.y, 20, null);
    renderer.render(1 / 30);
    await nextFrame();
  }
  return at;
};

try {
  const canvas = document.createElement('canvas');
  canvas.id = 'game';
  document.body.appendChild(canvas);
  document.body.style.margin = '0';
  game = Game.create(4242, SIZE);
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  game.settings.grid = false;
  // The stone's ring flat and grassed, so what is drawn is the outcroppings and the stone.
  const c = stoneCentre(RUNESTONES[0], SIZE);
  const w = game.world;
  for (let y = c.y - 24; y <= c.y + 24; y++) for (let x = c.x - 24; x <= c.x + 24; x++) w.setHeight(x, y, 30);
  for (let y = c.y - 24; y < c.y + 24; y++) for (let x = c.x - 24; x < c.x + 24; x++) {
    if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) > 1) w.setTile(x, y, TileType.Grass, 0);
  }
  for (const cr of [...game.creatures.list.values()]) game.creatures.remove(cr.id);
  game.update(0.01);
  renderer = new Renderer(new FullscreenCanvas(canvas), game);
  page.ready = true;
} catch (e) {
  page.error = String((e as Error).stack ?? e);
  page.ready = true;
}
