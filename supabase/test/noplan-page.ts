/**
 * The page `noplan.ts` opens: a tower two tiles long and two storeys high,
 * walled all round on the ground floor and floored but bare on storey 2, in
 * a game run as the island runs it, the renderer that draws it and the menus.
 * Bundled for the browser by `noplan.ts`, which drives it through
 * `window.noplan`: each look lays the tower in from a ground read with the
 * sides given marked No plan, draws it, and says which borders a plan model
 * was drawn on and what the wall rows of a side's menu are.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer, type Pick } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { borderOf, type Border, type Side } from '../../src/game/building';
import type { MenuItem } from '../../src/ui/contextmenu';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 10;
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
game.putBody(cx - 2.5, cy + 3.5, 0);

/* The tower: (tx, ty) and (tx + 1, ty), two storeys, the ground floor walled all round, storey 2 floored and bare. */
const [tx, ty] = [cx, cy];
const TILES: Array<[number, number]> = [[tx, ty], [tx + 1, ty]];
/** Its six outside sides, as tile and side. */
const OUTSIDE: Array<[number, number, Side]> = [[tx, ty, 'n'], [tx + 1, ty, 'n'], [tx + 1, ty, 'e'], [tx + 1, ty, 's'], [tx, ty, 's'], [tx, ty, 'w']];
const walls: unknown[] = [];
const floors: unknown[] = [];
for (const [x, y] of TILES) {
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  floors.push({ building: 1, level: 1, x, y, material: 'plank', needed: {}, total: {} });
}
for (const [x, y, side] of OUTSIDE) walls.push({ building: 1, level: 0, ...borderOf(x, y, side), type: 'solid', material: 'plank', needed: {}, total: {} });

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 1.5;

/** Every plan model put down in the last frame, as `level:dir:x,y`. */
const drawn: string[] = [];
{
  const own = renderer as unknown as Record<string, (...a: unknown[]) => unknown>;
  const fn = own.drawScaffold;
  own.drawScaffold = function (this: unknown, ...a: unknown[]): unknown {
    const b = a[0] as Border;
    drawn.push(`${a[2] as number}:${b.dir}:${b.x},${b.y}`);
    return fn.apply(this, a);
  };
}

/** The tower as a ground read hands it over, with these sides of storey 2 marked No plan. */
function lay(marked: Array<[number, number, Side]>): void {
  game.sawGround({
    placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: {
      nextId: 2, list: [{ id: 1, name: 'Tower', tiles: TILES.map(([x, y]) => `${x},${y}`), levels: 2, roof: 'hip' }], walls, floors,
      noPlan: marked.map(([x, y, side]) => ({ building: 1, level: 1, ...borderOf(x, y, side) })),
    },
    deed: { name: 'Hallmark', x: cx, y: cy, radius: 10, level: 1, mine: true, role: 'mayor' }, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
}

function frame(): void {
  drawn.length = 0;
  game.update(1 / 60);
  renderer.camera.focus(cx, cy, game.playerHeight(), null);
  renderer.render(1 / 60);
}

export interface NoPlanLook {
  /** Plan models drawn on storey 2, as `dir:x,y`. */
  models: string[];
  /** Every outside side of storey 2, as `dir:x,y`. */
  outside: string[];
  /** The wall rows of the menu, storey by storey and side by side: `level|x,y,side` to its rows' labels. */
  rows: Record<string, string[]>;
  /** Whether the browser holds each outside side marked. */
  held: boolean[];
}

const WALL_ROW = /^(Plan wall|No plan|Mark out|Build wall|Remove wall) \(/;

/** The menu's wall rows for a side of a tile on a storey, as a storey's own menu gives them. */
function rowsFor(x: number, y: number, side: Side, level: number): string[] {
  const wx = x + (side === 'w' ? 0.05 : side === 'e' ? 0.95 : 0.5);
  const wy = y + (side === 'n' ? 0.05 : side === 's' ? 0.95 : 0.5);
  const pick: Pick = { x, y, wx, wy, cx: x, cy: y };
  const entries = (ui as unknown as { buildingEntries: (p: Pick, storey?: number) => MenuItem[] }).buildingEntries(pick, level);
  return entries.map((e) => e.label + (e.disabled ? ` [${e.hint ?? 'disabled'}]` : '')).filter((l) => WALL_ROW.test(l));
}

/** Laid in with `marked` marked No plan, drawn twice, and what was drawn and offered. */
function look(marked: Array<[number, number, Side]>): NoPlanLook {
  lay(marked);
  frame();
  frame();
  const models = drawn.filter((d) => d.startsWith('1:')).map((d) => d.slice(2)).sort();
  const outside = OUTSIDE.map(([x, y, side]) => { const b = borderOf(x, y, side); return `${b.dir}:${b.x},${b.y}`; }).sort();
  const rows: Record<string, string[]> = {};
  for (const level of [0, 1]) {
    for (const [x, y, side] of [...OUTSIDE, [tx, ty, 'e'] as [number, number, Side]]) rows[`${level}|${x},${y},${side}`] = rowsFor(x, y, side, level);
  }
  const held = OUTSIDE.map(([x, y, side]) => game.buildings.noPlan(1, borderOf(x, y, side)));
  return { models, outside, rows, held };
}

(window as unknown as { noplan: unknown }).noplan = { look, tx, ty };
