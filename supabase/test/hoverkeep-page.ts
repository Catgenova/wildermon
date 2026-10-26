/**
 * The page `hoverkeep.ts` opens: the world drawn as the game draws it, the
 * pointer read by the game's own `Input` and the world under it said by the
 * frame's own `UI.hoverFrame`, as `main.ts` does every frame; with the pack
 * open on a mallet and two logs, and the Tile window on the ground. Driven
 * through `window.hoverkeep`: the test moves the real mouse, and `read` draws
 * a frame and says what the tooltip says.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { Input } from '../../src/engine/input';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { followScreen } from '../../src/ui/screen';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 24;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
game.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);
// Nothing else in the pack, so the logs' row is its last and nothing slides in under the pointer when they go.
game.inventory.items = [];
game.inventory.add('mallet', { ql: 30 });
game.inventory.add('log', { count: 2, ql: 20 });

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
const input = new Input(canvasEl);
renderer.camera.zoom = 1.5;
followScreen(uiRoot);
ui.windows.windows.get('inventory')?.open();

/** A frame, as the loop draws it: the world under the pointer last. */
function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(60);
  ui.hoverFrame(input.pointer, input.dragging, null);
}
for (let i = 0; i < 4; i++) frame();
ui.selectTile(renderer.pick(innerWidth / 2, innerHeight / 2));
ui.windows.windows.get('tile')?.open();
frame();

export interface Read {
  /** What the tooltip says, its lines joined by `|`, or null when it is not up. */
  tip: string | null;
}

function read(): Read {
  frame();
  const el = uiRoot.querySelector<HTMLElement>('.tooltip:not(.rtree)');
  return { tip: el && !el.hidden ? [...el.children].map((c) => c.textContent).join('|') : null };
}

type Box = { x: number; y: number } | null;
const middle = (el: Element | null | undefined): Box => {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

/** The middle of the pack's row for a thing named `name`. */
function row(name: string): Box {
  return middle([...uiRoot.querySelectorAll('.inv-row')].find((r) => r.textContent?.startsWith(name)));
}

/** The Tile window's `i`. */
function info(): Box {
  return middle(uiRoot.querySelector('.tile-info'));
}

/** A point on the world with no window over it, as far from the windows as can be found. */
function ground(): Box {
  for (const [fx, fy] of [[0.45, 0.5], [0.4, 0.6], [0.5, 0.7], [0.35, 0.45]]) {
    const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
    if (document.elementFromPoint(x, y) === canvasEl && renderer.pick(x, y)) return { x, y };
  }
  return null;
}

/** All of a thing goes from the pack, as the island's word on it would take it: eaten, used up, dragged off. */
function take(id: string): void {
  const it = game.inventory.find(id);
  if (it) game.inventory.remove(it.uid, it.count);
  game.events.emit('inventory');
  frame();
}

export interface Driven {
  read: () => Read;
  row: (name: string) => Box;
  info: () => Box;
  ground: () => Box;
  take: (id: string) => void;
}
(window as unknown as { hoverkeep: Driven }).hoverkeep = { read, row, info, ground, take };
