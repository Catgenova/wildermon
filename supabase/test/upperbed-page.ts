/**
 * The page `upperbed.ts` opens: a greenhouse of two storeys, five tiles by
 * three, walled and roofed in glass, every tile of both storeys a garden bed
 * but for a staircase up; crops at every stage on the beds of storey 2 and
 * one standing still on a bed of storey 1 under them; in a game run as the
 * island runs it, with the renderer that draws it and the menus. Bundled for
 * the browser by `upperbed.ts`, which drives it through `window.upperbed`.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { WALL_HEIGHT } from '../../src/game/building';
import { BED } from '../../src/game/gardenbed';

const game = Game.create(4243, 256);
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
game.putBody(cx + 0.5, cy + 3.5, 0);
game.inventory.add('wheat_seed', { count: 10, ql: 40 });

/* The greenhouse: 5 by 3 from (gx, gy), two storeys of garden beds, a staircase up on its east end, glass all round and over. */
const [gx, gy, gw, gh] = [cx - 2, cy - 1, 5, 3];
const STAIR: [number, number] = [gx + 4, gy + 1];
const tiles: string[] = [];
const floors: unknown[] = [];
const walls: unknown[] = [];
for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
  tiles.push(`${x},${y}`);
  world.setTile(x, y, TileType.PackedDirt);
  const stair = x === STAIR[0] && y === STAIR[1];
  floors.push({ building: 1, level: 0, x, y, material: stair ? 'plank' : BED, needed: {}, total: {} });
  floors.push({ building: 1, level: 1, x, y, material: stair ? 'plank' : BED, ...(stair ? { kind: 'stairs', facing: 'w' } : {}), needed: {}, total: {} });
  floors.push({ building: 1, level: 2, x, y, material: 'glass', kind: 'roof', needed: {}, total: {} });
}
const wall = (level: number, x: number, y: number, dir: 'h' | 'v', type: string): void => {
  walls.push({ building: 1, level, x, y, dir, type, material: type === 'door' ? 'plank' : 'glass', needed: {}, total: {} });
};
for (const level of [0, 1]) {
  for (let x = gx; x < gx + gw; x++) { wall(level, x, gy, 'h', 'solid'); wall(level, x, gy + gh, 'h', level === 0 && x === gx + 4 ? 'door' : 'solid'); }
  for (let y = gy; y < gy + gh; y++) { wall(level, gx, y, 'v', 'solid'); wall(level, gx + gw, y, 'v', 'solid'); }
}

/* Crops on storey 2 at every stage, and one on storey 1 under them, covered and standing still. */
const crop = (x: number, y: number, id: string, stage: number, level: number, still = false): unknown =>
  ({ x, y, id, stage, grown: 20, tended: stage, tendedNow: false, ql: 40, glass: true, level, ...(still ? { still: true } : {}) });
const crops: unknown[] = [];
const kinds = ['wheat', 'cabbage', 'corn', 'carrot'];
for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + 4; x++) {
  if (x === gx + 1 && y === gy + 1) continue; // an empty bed to sow
  crops.push(crop(x, y, kinds[(x - gx) % kinds.length], (x - gx + y - gy) % 4, 1));
}
crops.push(crop(gx, gy + 1, 'potato', 1, 0, true));
game.sawGround({
  placed: [], crates: [], lying: [], crops, now: Date.now() / 1000,
  buildings: { nextId: 2, list: [{ id: 1, name: 'Southern Greenhouse', tiles, levels: 2, roof: 'gable' }], walls, floors },
  deed: { name: 'Vinyard', x: cx, y: cy, radius: 10, level: 5, mine: true, role: 'mayor' }, deeds: [],
} as unknown as IslandGround, undefined, 'me');

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 2;

/** A frame, as the loop draws it, on the view given: Auto (null) or a storey pinned. */
function frame(view: number | null): void {
  game.settings.viewLevel = view;
  game.update(1 / 60);
  renderer.camera.focus(cx, cy, game.playerHeight(), null);
  renderer.render(1 / 60);
}

/** The screen point over the middle of a tile's floor on a storey. */
function at(x: number, y: number, level: number): [number, number] {
  const h = world.getHeight(x, y) + level * WALL_HEIGHT;
  return [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, h)];
}

export interface UpperLook {
  pick: { x: number; y: number; level?: number } | null;
  tip: string[];
  title: string;
  rows: string[];
}

/**
 * Drawn on `view`, two frames so that what the last one drew is what can be picked: what the pointer over tile
 * (x, y)'s floor on storey `level` picks, the lines of the tooltip it puts up there, and the menu for it.
 */
function look(view: number | null, x: number, y: number, level: number): UpperLook {
  frame(view);
  frame(view);
  const [px, py] = at(x, y, level);
  const p = renderer.pick(px, py);
  ui.setHover(p, px + 12, py + 12);
  const el = uiRoot.querySelector<HTMLElement>('.tooltip:not(.rtree)');
  const tip = el && !el.hidden ? [...el.children].map((c) => c.textContent ?? '') : [];
  const menu = p ? ui.menuFor(p) : { title: '', entries: [] };
  return { pick: p && { x: p.x, y: p.y, level: p.level }, tip, title: menu.title, rows: menu.entries.map((e) => e.label) };
}

(window as unknown as { upperbed: unknown }).upperbed = { look, gx, gy, gw, gh };
