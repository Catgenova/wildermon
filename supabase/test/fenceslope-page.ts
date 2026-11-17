/**
 * The page `fenceslope.ts` opens: a slope rising along x, and on it, on demand, a fence or a half wall of four borders
 * running up it with no building, in a game run as the island runs it and the renderer that draws it. Bundled for the
 * browser by `fenceslope.ts`, which drives it through `window.fenceslope`.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';

const game = Game.create(4243, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 10;
const h0 = Math.max(6, world.getHeight(cx, cy));
/** The rise of the ground a tile along x (heights are whole: a gentle one rises a step every few tiles). */
export const STEP = 3;
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0 + (x - cx) * STEP);
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
game.putBody(cx - 6.5, cy + 6.5, 0);

/** The fence's first border and how many, along x at y = FY. */
const FX = cx - 2, FY = cy, N = 4;

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
renderer.camera.zoom = 2;

function lay(type: string | null): void {
  const walls = type ? Array.from({ length: N }, (_, i) => ({ building: 0, level: 0, x: FX + i, y: FY, dir: 'h', type, material: 'stone_brick', needed: {}, total: {} })) : [];
  game.sawGround({
    placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: { nextId: 1, list: [], walls, floors: [] }, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
}

function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(cx, cy, h0, null);
  renderer.render(1 / 60);
}

/** The screen point of a corner of the ground. */
function corner(x: number, y: number): [number, number] {
  return [renderer.camera.worldToScreenX(x, y), renderer.camera.worldToScreenY(x, y, world.getHeight(x, y))];
}

/** Drawn with what is asked for along the slope (null for nothing), three frames: the canvas's pixels. */
function draw(type: string | null): { w: number; h: number; px: number[] } {
  lay(type);
  frame();
  frame();
  frame();
  const c = canvasEl;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, px: Array.from(d) };
}

export interface FenceSlope { a: [number, number]; b: [number, number]; rise: number; dpr: number }
function ends(): FenceSlope {
  const dpr = canvasEl.width / canvasEl.clientWidth || 1;
  return { a: corner(FX, FY), b: corner(FX + N, FY), rise: world.getHeight(FX + N, FY) - world.getHeight(FX, FY), dpr };
}

(window as unknown as { fenceslope: unknown }).fenceslope = { draw, ends };
