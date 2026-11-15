/**
 * The page `freeroof.ts` opens: the Southern Greenhouse as it was reported, a
 * building of two storeys, 6 by 5, with storey 2 over a 4 by 3 block of it
 * and a single-storey tier round it on the west, east and south, in a game
 * run as the island runs it, the renderer that draws it and the menus.
 * Bundled for the browser by `freeroof.ts`, which drives it through
 * `window.freeroof`: the menu on the tier with no roof (Plan roof, over storey
 * 1) and on storey 2 (over storey 2); then a hipped roof over each tier, each
 * at its own height, drawn by day and by night.
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
import type { RoofPart } from '../../src/render/roofdraw';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 12;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
const day0 = 1000 * DAY_SECONDS;
let hour = 13;
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.inventory.add('mallet', { ql: 30 });

/* The greenhouse: 6 by 5 from (gx, gy); storey 2 over (gx + 1 .. gx + 4, gy .. gy + 2), the tier round it. */
const [gx, gy, gw, gh] = [cx - 3, cy - 2, 6, 5];
const upper = (x: number, y: number): boolean => x > gx && x < gx + 5 && y >= gy && y < gy + 3;
game.putBody(gx + 2.5, gy + 1.5, 1);
const tiles: string[] = [];
const floors: Array<Record<string, unknown>> = [];
const walls: Array<Record<string, unknown>> = [];
for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
  tiles.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  if (upper(x, y)) floors.push({ building: 1, level: 1, x, y, material: 'plank', needed: {}, total: {} });
}
const wall = (level: number, x: number, y: number, dir: 'h' | 'v', type: string, material = 'stone_brick'): void => {
  walls.push({ building: 1, level, x, y, dir, type, material, needed: {}, total: {} });
};
// The ground storey all round the footprint; storey 2 round its own block, its south side over the tier.
for (let x = gx; x < gx + gw; x++) {
  wall(0, x, gy, 'h', 'solid');
  wall(0, x, gy + gh, 'h', x === gx + 2 ? 'door' : 'window');
}
for (let y = gy; y < gy + gh; y++) {
  wall(0, gx, y, 'v', y === gy + 2 ? 'window' : 'solid');
  wall(0, gx + gw, y, 'v', y === gy + 2 ? 'window' : 'solid');
}
for (let x = gx + 1; x < gx + 5; x++) {
  wall(1, x, gy, 'h', 'solid', 'plank');
  wall(1, x, gy + 3, 'h', 'window', 'plank');
}
for (let y = gy; y < gy + 3; y++) {
  wall(1, gx + 1, y, 'v', 'window', 'plank');
  wall(1, gx + 5, y, 'v', 'window', 'plank');
}

/** The ground as the island would send it: roofs over the tier at level 1 and over storey 2 at level 2, or none. */
function send(roofed: boolean): void {
  const roofs: Array<Record<string, unknown>> = [];
  if (roofed) {
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
      roofs.push({ building: 1, level: upper(x, y) ? 2 : 1, x, y, material: upper(x, y) ? 'slate' : 'plank', kind: 'roof', needed: {}, total: {} });
    }
  }
  game.sawGround({
    placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: {
      nextId: 2,
      list: [{ id: 1, name: 'Southern Greenhouse', tiles, levels: 2, workLevel: 1, ...(roofed ? { roof: 'hip' } : {}) }],
      walls, floors: [...floors, ...roofs],
    },
    deed: { name: 'Vinyard', x: cx, y: cy, radius: 10, level: 1, mine: true, role: 'mayor' }, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
}
send(false);

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
  renderer.camera.focus(gx + 3, gy + 2.5, game.playerHeight(), null);
  renderer.render(1 / 60);
}

/** The screen point over the middle of a tile's floor on a storey. */
function at(x: number, y: number, level: number): [number, number] {
  const h = world.getHeight(x, y) + level * WALL_HEIGHT;
  return [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, h)];
}

/** A menu row as the test reads it: its path of labels, its note, and whether it is greyed and why. */
export interface RoofRow { path: string; note: string; disabled: boolean; hint: string }
function rows(items: MenuItem[], into: RoofRow[] = [], path = ''): RoofRow[] {
  for (const it of items) {
    const here = path ? `${path} > ${it.label}` : it.label;
    into.push({ path: here, note: it.note ?? '', disabled: !!it.disabled, hint: it.hint ?? '' });
    if (it.children) rows(it.children, into, here);
  }
  return into;
}

/** The menu for a tile of a storey, clicked where it is drawn, two frames in; opened on the screen with `open`. */
function menu(view: number | null, x: number, y: number, level: number, open = false): { title: string; pick: { x: number; y: number; level?: number } | null; rows: RoofRow[] } {
  frame(view);
  frame(view);
  const [px, py] = at(x, y, level);
  const p = renderer.pick(px, py);
  if (!p) return { title: '', pick: null, rows: [] };
  const m = ui.menuFor(p);
  if (open) ui.showTileMenu(p, px, py);
  return { title: m.title, pick: { x: p.x, y: p.y, level: p.level }, rows: rows(m.entries) };
}

/** What the renderer laid this frame: every roof part queued (its level and tiles) and the height of its eaves. */
function drawn(view: number | null): Array<{ level: number; tiles: number; eave: number }> {
  frame(view);
  const r = renderer as unknown as {
    roofQueue: Map<number, RoofPart[]>;
    roofs: { roofFrame(b: unknown, level: number): { roofs: unknown[]; eave: number } | null };
  };
  const out: Array<{ level: number; tiles: number; eave: number }> = [];
  for (const line of r.roofQueue.values()) {
    for (const part of line) {
      const f = r.roofs.roofFrame(part.b, part.level);
      out.push({ level: part.level, tiles: f?.roofs.length ?? 0, eave: f?.eave ?? NaN });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

/** The pick a click on a tier's roof slope lands on, pinned on that roof's level: the tile under it and its level. */
function roofClick(view: number, x: number, y: number): { x: number; y: number; level?: number } | null {
  frame(view);
  frame(view);
  const [px, py] = at(x, y, view);
  const p = renderer.pick(px, py - 6);
  return p ? { x: p.x, y: p.y, level: p.level } : null;
}

const setHour = (h: number): void => { hour = h; };
/** Whoever is looking stands here: out on the ground, so no roof is lifted off over their head. */
const stand = (x: number, y: number, level: number): void => game.putBody(x, y, level);
const base = h0;

(window as unknown as { freeroof: unknown }).freeroof = { game, ui, renderer, frame, menu, at, send, drawn, roofClick, setHour, stand, gx, gy, gw, gh, base };
