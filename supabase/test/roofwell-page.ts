/**
 * The page `roofwell.ts` opens: a greenhouse of two storeys, 5 by 3, closed
 * in, whose storey 2 has its floor taken up over the three middle tiles of its
 * south row, with no wall over them, in a game run as the island runs it, the
 * renderer that draws it and the menus. Bundled for the browser by
 * `roofwell.ts`, which drives it through `window.roofwell`: the menu over the
 * well, pinned on storey 2 and on Auto, with and without walls planned round
 * the well.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { WALL_HEIGHT } from '../../src/game/building';
import type { MenuItem } from '../../src/ui/contextmenu';

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
game.inventory.add('mallet', { ql: 30 });

/* The greenhouse: 5 by 3 from (gx, gy), two storeys; storey 2's floor gone over (gx + 1 .. gx + 3, gy + 2). */
const [gx, gy, gw, gh] = [cx - 2, cy - 1, 5, 3];
const well = (x: number, y: number): boolean => y === gy + 2 && x > gx && x < gx + 4;
game.putBody(gx + 2.5, gy + 1.5, 1);
const walls: unknown[] = [];
const floors: unknown[] = [];
const tiles: string[] = [];
for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
  tiles.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  if (!well(x, y)) floors.push({ building: 1, level: 1, x, y, material: 'plank', needed: {}, total: {} });
}
const wall = (level: number, x: number, y: number, dir: 'h' | 'v', type: string): void => {
  walls.push({ building: 1, level, x, y, dir, type, material: 'plank', needed: {}, total: {} });
};
for (const level of [0, 1]) {
  for (let x = gx; x < gx + gw; x++) {
    wall(level, x, gy, 'h', 'solid');
    // Over the well, storey 2 has no south wall: none can be planned with no floor under it.
    if (level === 0 || !well(x, gy + 2)) wall(level, x, gy + gh, 'h', level === 0 && x === gx + 2 ? 'door' : 'window');
  }
  for (let y = gy; y < gy + gh; y++) { wall(level, gx, y, 'v', 'solid'); wall(level, gx + gw, y, 'v', 'window'); }
}
game.sawGround({
  placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 2, list: [{ id: 1, name: 'Southern Greenhouse', tiles, levels: 2, workLevel: 1 }], walls, floors },
  deed: { name: 'Vinyard', x: cx, y: cy, radius: 10, level: 1, mine: true, role: 'mayor' }, deeds: [],
} as unknown as IslandGround, undefined, 'me');

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 1.8;

/** A frame, as the loop draws it, on the view given: Auto (null) or a storey pinned. */
function frame(view: number | null): void {
  game.settings.viewLevel = view;
  game.update(1 / 60);
  renderer.camera.focus(gx + 2.5, gy + 1.5, game.playerHeight(), null);
  renderer.render(1 / 60);
}

/** The screen point over the middle of a tile's floor on a storey. */
function at(x: number, y: number, level: number): [number, number] {
  const h = world.getHeight(x, y) + level * WALL_HEIGHT;
  return [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, h)];
}

/** A menu row as the test reads it: its path of labels, and whether it is greyed and why. */
export interface WellRow { path: string; disabled: boolean; hint: string }
function rows(items: MenuItem[], into: WellRow[] = [], path = ''): WellRow[] {
  for (const it of items) {
    const here = path ? `${path} > ${it.label}` : it.label;
    into.push({ path: here, disabled: !!it.disabled, hint: it.hint ?? '' });
    if (it.children) rows(it.children, into, here);
  }
  return into;
}

/** The menu for a tile of a storey, clicked where it is drawn, two frames in; opened on the screen with `open`. */
function menu(view: number | null, x: number, y: number, level: number, open = false): { title: string; pick: { x: number; y: number; level?: number } | null; rows: WellRow[] } {
  frame(view);
  frame(view);
  const [px, py] = at(x, y, level);
  const p = renderer.pick(px, py);
  if (!p) return { title: '', pick: null, rows: [] };
  const m = ui.menuFor(p);
  if (open) ui.showTileMenu(p, px, py);
  return { title: m.title, pick: { x: p.x, y: p.y, level: p.level }, rows: rows(m.entries) };
}

/** Four walls planned round the well and not built: its north sides and its west side. */
function planRound(): void {
  const b = game.buildings.list.get(1);
  if (!b) return;
  for (let x = gx + 1; x < gx + 4; x++) game.buildings.setWall(b, 1, x, gy + 2, 'n', 'solid', 'plank');
  game.buildings.setWall(b, 1, gx + 1, gy + 2, 'w', 'solid', 'plank');
}

(window as unknown as { roofwell: unknown }).roofwell = { game, ui, renderer, frame, menu, at, planRound, gx, gy, gw, gh };
