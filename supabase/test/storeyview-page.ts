/**
 * The page `storeyview.ts` opens: a hall of two storeys with a staircase up
 * inside it and a jetty off storey 2, a shed of one storey beside it, a chest
 * on the ground floor and a bed on storey 2, in a game run as the island runs
 * it, the renderer that draws it and the menus. Bundled for the browser by
 * `storeyview.ts`, which drives it through `window.storeyview`.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { WALL_HEIGHT, type Wall } from '../../src/game/building';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 12;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 1.5, cy + 2.5, 0);

/* The hall: 4 by 3 from (hx, hy), two storeys, a staircase up on (hx + 3, hy + 1), a jetty west of (hx, hy + 1). */
const [hx, hy, hw, hh] = [cx - 2, cy - 2, 4, 3];
const walls: unknown[] = [];
const floors: unknown[] = [];
const hall: string[] = [];
const shed: string[] = [];
for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
  hall.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  const stair = x === hx + 3 && y === hy + 1;
  floors.push({ building: 1, level: 1, x, y, material: 'plank', ...(stair ? { kind: 'stairs', facing: 's' } : {}), needed: {}, total: {} });
  floors.push({ building: 1, level: 2, x, y, material: 'thatch', kind: 'roof', needed: {}, total: {} });
}
floors.push({ building: 1, level: 1, x: hx - 1, y: hy + 1, material: 'plank', needed: {}, total: {} });
const wall = (b: number, level: number, x: number, y: number, dir: 'h' | 'v', type: string): void => {
  walls.push({ building: b, level, x, y, dir, type, material: 'plank', needed: {}, total: {} });
};
for (const level of [0, 1]) {
  for (let x = hx; x < hx + hw; x++) { wall(1, level, x, hy, 'h', 'solid'); wall(1, level, x, hy + hh, 'h', x === hx + 1 ? 'door' : 'window'); }
  for (let y = hy; y < hy + hh; y++) { wall(1, level, hx, y, 'v', level === 1 && y === hy + 1 ? 'door' : 'solid'); wall(1, level, hx + hw, y, 'v', 'window'); }
}
const [sx, sy] = [cx + 4, cy - 2];
for (let y = sy; y < sy + 2; y++) for (let x = sx; x < sx + 2; x++) {
  shed.push(`${x},${y}`);
  floors.push({ building: 2, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  floors.push({ building: 2, level: 1, x, y, material: 'thatch', kind: 'roof', needed: {}, total: {} });
}
for (let x = sx; x < sx + 2; x++) { wall(2, 0, x, sy, 'h', 'solid'); wall(2, 0, x, sy + 2, 'h', 'window'); }
for (let y = sy; y < sy + 2; y++) { wall(2, 0, sx, y, 'v', 'solid'); wall(2, 0, sx + 2, y, 'v', 'solid'); }
let id = 1000;
const placed: IslandPlaced[] = [];
const put = (sub: string, x: number, y: number, level: number): number => {
  placed.push({
    id: id, kind: 'furniture', sub, x, y, sx: 0, sy: 0, ql: 40, fuel: null, ash: null, lit: null, dmg: null, name: null, material: 'oak',
    litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's', level,
  });
  return id++;
};
const CHEST = put('chest', hx + 1, hy + 1, 0);
const BED = put('bed', hx + 1, hy, 1);
game.sawGround({
  placed, crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 3, list: [{ id: 1, name: 'Hall', tiles: hall, levels: 2, roof: 'gable' }, { id: 2, name: 'Shed', tiles: shed, levels: 1, roof: 'hip' }], walls, floors },
  deed: { name: 'Hallmark', x: cx, y: cy, radius: 10, level: 1, mine: true, role: 'mayor' }, deeds: [],
} as unknown as IslandGround, undefined, 'me');

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 1.5;

/** The storeys of the walls drawn in the last frame, by building: every way a wall is put down (`drawWall`, `guardedWall`). */
const drawn: Array<{ building: number; level: number }> = [];
{
  const own = renderer as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const name of ['drawWall', 'guardedWall']) {
    const fn = own[name];
    own[name] = function (this: unknown, ...a: unknown[]): unknown {
      const w = a[0] as Wall;
      drawn.push({ building: w.building, level: w.level });
      return fn.apply(this, a);
    };
  }
}

/** A frame, as the loop draws it, on the view given: Auto (null) or a storey pinned. */
function frame(view: number | null): void {
  game.settings.viewLevel = view;
  drawn.length = 0;
  game.update(1 / 60);
  renderer.camera.focus(cx, cy, game.playerHeight(), null);
  renderer.render(1 / 60);
}

/** The screen point over the middle of a tile's floor on a storey. */
function at(x: number, y: number, level: number): [number, number] {
  const h = world.getHeight(x, y) + level * WALL_HEIGHT;
  return [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, h)];
}

export interface StoreyLook {
  walls: Array<{ building: number; level: number }>;
  pieces: number[];
  pick: { x: number; y: number; level?: number; furniture?: number } | null;
  title: string;
  rows: string[];
  ground: string[];
}

/**
 * Drawn on `view`, two frames so that what the last one drew is what can be clicked: the walls drawn and by which
 * storey, the pieces that can be clicked, what a click over tile (x, y)'s floor on storey `level` picks, the menu
 * for it, and the rows of the menu Auto gives on the ground of that tile that are the ground's own jobs.
 */
function look(view: number | null, x: number, y: number, level: number): StoreyLook {
  frame(view);
  frame(view);
  const pieces = (renderer as unknown as { furnitureHits: Array<{ furniture?: number }> }).furnitureHits.map((h) => h.furniture ?? -1);
  const [px, py] = at(x, y, level);
  const p = renderer.pick(px, py);
  const menu = p ? ui.menuFor(p) : { title: '', entries: [] };
  const target = { kind: 'tile' as const, x, y, cx: x, cy: y };
  const ground = game.actionsFor(target).map((a) => a.def.labelFor?.(target, game) ?? a.def.label);
  return {
    walls: [...drawn], pieces, pick: p && { x: p.x, y: p.y, level: p.level, furniture: p.furniture },
    title: menu.title, rows: menu.entries.map((e) => e.label), ground,
  };
}

(window as unknown as { storeyview: unknown }).storeyview = { look, hx, hy, hw, hh, CHEST, BED, cx, cy };
