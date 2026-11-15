/**
 * The page `tools/obsidian-shot.mjs` opens to look at obsidian glass (`src/game/building.ts` OBSIDIAN_GLASS): the
 * game's own renderer over a small flat island with one building on it, two storeys of two tiles by three --
 *
 *   * the ground storey walled in obsidian glass on the two sides toward the camera at the first turn and in stone
 *     brick on the two away from it, a bed, a chest, a banner and a lit brazier inside;
 *   * the storey over it floored in obsidian glass on every tile, walled in obsidian glass at the front and stone
 *     brick at the back, with no roof, so the floor is seen from above with the room under it;
 *   * a stone brick wall of the same height beside it, the same scene in an opaque masonry to set it against, and a
 *     tree behind the building.
 *
 * Driven through `window.obsidian`: `shot({ scene, zoom, turn, hour })` puts the camera there and draws a frame.
 *
 * A tool and nothing else: the game it draws is a local copy of the rules (`Game.create`), as the boot check's pages
 * are, never a game of its own for anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { OBSIDIAN_GLASS, type Side } from '../src/game/building';
import { packTreeData, TileType } from '../src/world/tiles';

interface Shot { scene: string; zoom: number; turn: number; hour: number }
interface ObsidianPage { ready: boolean; error: string; shot(s: Shot): Promise<void> }
const page: ObsidianPage = { ready: false, error: '', shot: async () => {} };
(window as unknown as { obsidian: ObsidianPage }).obsidian = page;

const SIZE = 40;
const SCENES: Record<string, [number, number, number]> = {
  house: [21, 21, 46],
  close: [21, 21.5, 40],
  upstairs: [21, 21, 70],
};

document.getElementById('boot')?.remove();
let canvasEl = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvasEl) {
  canvasEl = document.createElement('canvas');
  canvasEl.id = 'game';
  document.body.appendChild(canvasEl);
}
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

try {
  const game = Game.create(4242, SIZE);
  let hour = 13;
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  const w = game.world;
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, 40);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) w.setTile(x, y, TileType.Grass, 0);
  for (const [x, y, sp] of [[19, 17, 1], [23, 17, 3], [16, 19, 2], [26, 20, 5]] as Array<[number, number, number]>) {
    w.setTile(x, y, TileType.Tree, packTreeData(sp, (x * 7 + y) & 7));
  }

  const bld = game.buildings;
  const b = bld.create('Obsidian house', 20, 20);
  for (const [x, y] of [[21, 20], [20, 21], [21, 21], [20, 22], [21, 22]]) bld.addTile(b, x, y);
  b.levels = 2;
  const done = <T extends { needed: Record<string, number> }>(p: T): T => { for (const k of Object.keys(p.needed)) p.needed[k] = 0; return p; };
  const tiles: Array<[number, number]> = [[20, 20], [21, 20], [20, 21], [21, 21], [20, 22], [21, 22]];
  const edge = (x: number, y: number, side: Side): boolean => {
    const [dx, dy] = side === 'n' ? [0, -1] : side === 's' ? [0, 1] : side === 'e' ? [1, 0] : [-1, 0];
    return !tiles.some(([tx, ty]) => tx === x + dx && ty === y + dy);
  };
  for (const level of [0, 1]) {
    for (const [x, y] of tiles) {
      for (const side of ['n', 'e', 's', 'w'] as Side[]) {
        if (!edge(x, y, side)) continue;
        const glass = side === 's' || side === 'e';
        done(bld.setWall(b, level, x, y, side, 'solid', glass ? OBSIDIAN_GLASS : 'stone_brick'));
      }
      done(bld.setFloor(b, level, x, y, level === 0 ? (x === 21 && y === 22 ? OBSIDIAN_GLASS : 'stone_brick') : OBSIDIAN_GLASS));
    }
  }
  // Beside it, a wall of stone brick as tall, to set the glass against.
  const shed = bld.create('Brick wall', 24, 21);
  done(bld.setWall(shed, 0, 24, 21, 's', 'solid', 'stone_brick'));
  done(bld.setFloor(shed, 0, 24, 21, 'stone_brick'));
  // Inside: a bed, a chest, a banner and a lit brazier.
  for (const [kind, x, y, sx, sy] of [['bed', 20, 21, 0, 0], ['chest', 21, 20, 1, 1], ['banner', 21, 22, 2, 1], ['brazier', 20, 22, 2, 2], ['barrel', 21, 21, 3, 3]] as Array<[string, number, number, number, number]>) {
    try {
      const f = game.addFurniture(kind, x, y, sx, sy, 60);
      if (kind === 'brazier') f.lit = true;
    } catch (e) { console.error(`${kind}: ${(e as Error).message}`); }
  }
  bld.changed();
  game.update(0.01);

  const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
  const cam = renderer.camera;
  page.shot = async (s) => {
    const [x, y, h] = SCENES[s.scene] ?? SCENES.house;
    hour = s.hour;
    cam.zoom = s.zoom;
    cam.rotation = s.turn;
    game.player.x = 26.5;
    game.player.y = 26.5;
    cam.focus(x, y, h, null);
    for (let i = 0; i < 30; i++) {
      game.update(1 / 60);
      renderer.time = 20 - 1 + i / 30;
      renderer.render(0);
      await nextFrame();
    }
    renderer.time = 20;
    renderer.render(0);
    await nextFrame();
  };
  page.ready = true;
} catch (e) {
  page.error = `${(e as Error).message}\n${(e as Error).stack ?? ''}`;
  page.ready = true;
}
