/**
 * The page `lairchest.ts` opens: a goblin warren standing, and a cleared one beside it with its hoard chest in its
 * place, holding the shares the island put in it; in a game run as the island runs it, with the renderer that draws
 * it and the menus. Bundled for the browser by `lairchest.ts`, which drives it through `window.lairchest`.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { LAIR_CHEST } from '../../src/game/lairs';
import { storedThing } from '../../src/net/rows/stored';
import type { StoredThing } from '../../src/contract/ground';

const game = Game.create(4343, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 14;
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
game.putBody(cx - 0.5, cy + 2.5, 0);

/** The standing warren, right; the cleared one, left, its chest on its tile; on one row of the screen. */
const WARREN = { x: cx + 1, y: cy - 1 };
const CLEARED = { x: cx - 1, y: cy + 1 };
const piece = (id: number, sub: string, x: number, y: number, sx: number, extra: object = {}): IslandPlaced => ({
  id, kind: 'furniture', sub, x, y, sx, sy: sx, ql: 50, fuel: null, ash: null, lit: null, dmg: null, name: null, material: null,
  litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: false, facing: 's', ...extra,
} as unknown as IslandPlaced);
/** What the island puts in it for two shares: the trophy with each slayer's name, and a treasure map. */
const things = [
  { id: 77001, def: 'chief_ear', ql: 44, dmg: 0, count: 1, extra: null },
  { id: 77002, def: 'chief_ear', ql: 44, dmg: 0, count: 1, extra: null },
  { id: 77003, def: 'treasure_map', ql: 44, dmg: 0, count: 1, extra: 'worn' },
];
game.sawGround({
  placed: [piece(9001, 'goblin_warren', WARREN.x, WARREN.y, 0), piece(9002, LAIR_CHEST, CLEARED.x, CLEARED.y, 1, { things })],
  crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 1, list: [], walls: [], floors: [] }, deeds: [],
  lairs: [{ id: 1, kind: 'goblin_warren', x: WARREN.x, y: WARREN.y }, { id: 2, kind: 'goblin_warren', x: CLEARED.x, y: CLEARED.y }],
} as unknown as IslandGround, undefined, 'me');

const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
document.getElementById('boot')?.remove();
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 2.4;
// The ground clear: every window shut but the Event log, wide enough for the island's Examine line on one row.
for (const w of ui.windows.windows.values()) if (w.isOpen) w.close();
const events = ui.windows.get('events');
events?.open();
events?.put({ x: 16, y: window.innerHeight - 236, w: 968, h: 220 });

let running = true;
const tick = (): void => {
  if (!running) return;
  game.update(1 / 60);
  renderer.camera.focus(cx + 0.5, cy + 0.5, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(60);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

/** The screen point over the middle of a tile. */
const at = (x: number, y: number): [number, number] =>
  [renderer.camera.worldToScreenX(x + 0.5, y + 0.5), renderer.camera.worldToScreenY(x + 0.5, y + 0.5, world.getHeight(x, y))];

export interface LairMenu { picked: string | null; title: string; rows: string[] }

const api = {
  /** The menu for the piece on a tile, put up where it stands: what was picked, its title and its rows. */
  async menu(which: 'warren' | 'chest'): Promise<LairMenu> {
    ui.menu.hide();
    await rest(200);
    const t = which === 'warren' ? WARREN : CLEARED;
    const [px, py] = at(t.x, t.y);
    const p = renderer.pick(px, py - 6);
    const piece = p?.furniture !== undefined ? game.furniture.get(p.furniture) : undefined;
    if (p) ui.showTileMenu(p, px + 30, py - 40);
    await rest(300);
    const m = p ? ui.menuFor(p) : { title: '', entries: [] };
    return { picked: piece?.kind ?? null, title: m.title, rows: m.entries.map((e) => e.label) };
  },
  /** What the island's run put in its chest: def, maker and count, as `lairchest.ts` read them. */
  fill(rows: Array<[string, number]>): void {
    const chest = game.furniture.get(9002);
    if (chest) chest.items = rows.map(([def, count], i) => storedThing({ id: 78000 + i, def, ql: 44, dmg: 0, count, extra: def === 'treasure_map' ? 'worn' : null } as StoredThing));
  },
  /** Said in the log, as the island's answer to Examine is. */
  say(text: string): void {
    game.logMsg(text, 'event');
  },
  hide(): void {
    ui.menu.hide();
  },
  wait: rest,
};

(window as unknown as { lairchest: typeof api }).lairchest = api;
