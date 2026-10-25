/**
 * The page `plantools.ts` opens: a hall of two storeys whose storey 2 is
 * floored and not yet walled, and a shed of one storey walled and not yet
 * roofed, in a game run as the island runs it, with the renderer that draws
 * it and the menus. Bundled for the browser by `plantools.ts`, which drives it
 * through `window.plantools`: a whole-storey plan's ghost and its totals
 * (`planarea.ts`), an undo offered after it, and a roof pinned as its own
 * storey (`storeyview.ts`).
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer, type Pick } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { ROOF_PITCH, WALL_HEIGHT } from '../../src/game/building';
import { pitchedRoofAt } from '../../src/game/storeyview';
import type { MenuItem } from '../../src/ui/contextmenu';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 12;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
for (let y = cy + 3; y <= cy + 5; y++) for (let x = cx - 6; x <= cx - 3; x++) world.setTile(x, y, TileType.PackedDirt);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
/** Every job the page asked the island for, in order. */
const asks: Array<{ action: string; target: unknown }> = [];
game.ask = (def, target) => { asks.push({ action: def.id, target }); };
game.putBody(cx + 1.5, cy + 1.5, 0);
game.inventory.add('mallet', { ql: 30 });
game.inventory.add('log', { count: 20, ql: 30 });
game.inventory.add('plank', { count: 12, ql: 30 });
game.inventory.add('thatch', { count: 6, ql: 30 });

/* The hall: 4 by 3 from (hx, hy), two storeys, storey 2 floored and bare. The shed: 2 by 2, walled, no roof. */
const [hx, hy, hw, hh] = [cx - 2, cy - 2, 4, 3];
const walls: unknown[] = [];
const floors: unknown[] = [];
const hall: string[] = [];
const shed: string[] = [];
for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
  hall.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  floors.push({ building: 1, level: 1, x, y, material: 'plank', needed: {}, total: {} });
}
const wall = (b: number, level: number, x: number, y: number, dir: 'h' | 'v', type: string): void => {
  walls.push({ building: b, level, x, y, dir, type, material: 'plank', needed: {}, total: {} });
};
for (let x = hx; x < hx + hw; x++) { wall(1, 0, x, hy, 'h', 'solid'); wall(1, 0, x, hy + hh, 'h', x === hx + 1 ? 'door' : 'window'); }
for (let y = hy; y < hy + hh; y++) { wall(1, 0, hx, y, 'v', 'solid'); wall(1, 0, hx + hw, y, 'v', 'window'); }
const [sx, sy] = [cx + 4, cy - 2];
for (let y = sy; y < sy + 2; y++) for (let x = sx; x < sx + 2; x++) {
  shed.push(`${x},${y}`);
  floors.push({ building: 2, level: 0, x, y, material: 'plank', needed: {}, total: {} });
}
for (let x = sx; x < sx + 2; x++) { wall(2, 0, x, sy, 'h', 'solid'); wall(2, 0, x, sy + 2, 'h', 'window'); }
for (let y = sy; y < sy + 2; y++) { wall(2, 0, sx, y, 'v', 'solid'); wall(2, 0, sx + 2, y, 'v', 'solid'); }
game.sawGround({
  placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 3, list: [{ id: 1, name: 'Hall', tiles: hall, levels: 2, workLevel: 1 }, { id: 2, name: 'Shed', tiles: shed, levels: 1 }], walls, floors },
  deed: { name: 'Hallmark', x: cx, y: cy, radius: 10, level: 1, mine: true, role: 'mayor' }, deeds: [],
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
renderer.camera.zoom = 1.6;

/** Where the camera looks: the middle of the two buildings, or wherever a scene puts it. */
const look = { x: cx + 1, y: cy };
/** A frame, as the loop draws it, on the view given: Auto (null) or a storey pinned. */
function frame(view: number | null): void {
  game.settings.viewLevel = view;
  game.update(1 / 60);
  ui.syncGhost?.(renderer.hover);
  renderer.camera.focus(look.x, look.y, game.playerHeight(), null);
  renderer.render(1 / 60);
}

/** The screen point over the middle of a tile's floor on a storey. */
function at(x: number, y: number, level: number): [number, number] {
  const h = world.getHeight(x, y) + level * WALL_HEIGHT;
  return [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, h)];
}

/** Every label of a menu, folds opened, as `a > b > c`. */
function labels(items: MenuItem[], into: string[] = [], path = ''): string[] {
  for (const it of items) {
    const here = path ? `${path} > ${it.label}` : it.label;
    into.push(here);
    if (it.children) labels(it.children, into, here);
  }
  return into;
}
/** The row of a menu at a path of labels, each matched by its start. */
function row(items: MenuItem[], path: string[]): MenuItem | undefined {
  let list = items;
  let found: MenuItem | undefined;
  for (const step of path) {
    found = list.find((it) => it.label.startsWith(step));
    if (!found) return undefined;
    list = found.children ?? [];
  }
  return found;
}

/** What a click on a tile of a storey picks, two frames in so the frame drawn is the one clicked. */
function pickAt(view: number | null, x: number, y: number, level: number): Pick | null {
  frame(view);
  frame(view);
  const [px, py] = at(x, y, level);
  return renderer.pick(px, py);
}

/** The menu for a tile of a storey, opened on the screen where it was clicked. */
function menu(view: number | null, x: number, y: number, level: number, open = true): { title: string; rows: string[]; pick: Pick | null } {
  const p = pickAt(view, x, y, level);
  if (!p) return { title: '', rows: [], pick: null };
  const m = ui.menuFor(p);
  if (open) {
    const [px, py] = at(x, y, level);
    ui.showTileMenu(p, px, py);
  }
  return { title: m.title, rows: labels(m.entries), pick: p };
}

/** Choose a row of the menu for a tile, by its path of labels: what it was, or null where there is none. */
function choose(view: number | null, x: number, y: number, level: number, path: string[]): string | null {
  const p = pickAt(view, x, y, level);
  if (!p) return null;
  const it = row(ui.menuFor(p).entries, path);
  if (!it || !it.onSelect || it.disabled) return null;
  it.onSelect();
  frame(view);
  return it.label;
}

/** The shed roofed, as planned: a gabled log roof on its four tiles, on its roof's level. */
function roofOn(): void {
  const shedB = game.buildings.list.get(2);
  if (!shedB) return;
  shedB.roof = 'gable';
  for (let y = sy; y < sy + 2; y++) for (let x = sx; x < sx + 2; x++) if (!game.buildings.floor(1, x, y)) game.buildings.setFloor(shedB, 1, x, y, 'log', 'roof');
}
/** A point on the screen on the shed's roof, halfway up its near slope. */
function ridge(): [number, number] {
  const h = world.getHeight(sx, sy) + WALL_HEIGHT + ROOF_PITCH * 0.5;
  return [renderer.camera.worldToScreenX(sx + 0.5, sy + 1), renderer.camera.worldToScreenY(sx + 0.5, sy + 1, h)];
}
/** What the pointer says at a point on the screen. */
function hoverAt(px: number, py: number): string {
  const p = renderer.pick(px, py);
  if (!p) return '';
  ui.setHover(p, px, py);
  return ui.tooltip.el.textContent ?? '';
}

(window as unknown as { plantools: unknown }).plantools = {
  roofOn, ridge, hoverAt, pitched: (x: number, y: number, level: number) => !!pitchedRoofAt(game, x, y, level),
  game, ui, renderer, asks, frame, menu, choose, pickAt, at, hx, hy, hw, hh, sx, sy, cx, cy, look,
  hide: () => ui.menu.hide(),
  /** What is laid out just now: the ghost's pieces, passing and refused, and the bar's words. */
  state: () => ({
    placing: ui.placing?.kind ?? null,
    ghost: (renderer.planGhost ?? []).map((q) => `${q.kind}:${q.x},${q.y}${q.side ?? ''}:${q.level}:${q.ok ? 'ok' : 'no'}`),
    bar: ui.planBar.el.hidden ? '' : ui.planBar.el.textContent ?? '',
    undo: ui.planBar.undoing,
  }),
};
