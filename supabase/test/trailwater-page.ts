/**
 * The page `trailwater.ts` opens: a meadow with a spring's pond in a hollow
 * and the sea along its south side, a trail worn west to east through the
 * pond and one south down the beach into the sea, in a game run as the island
 * runs it and the renderer that draws it. Bundled for the browser by
 * `trailwater.ts`, which drives it through `window.trailwater`.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';

/** A tile on the screen: the mean colour round the middle of its ground, under whatever water is over it. */
export interface TrailSample { x: number; y: number; on: boolean; rgb: [number, number, number] }

const SIZE = 40;
/** The pond's spring, in the bottom of a hollow five tiles across; the beach shelves 7 a tile from y 28 to the sea. */
const SPRING: [number, number] = [14, 14];
function height(x: number, y: number): number {
  if (y >= 34) return -6;
  if (y >= 28) return 30 - (y - 27) * 7;
  const d = Math.hypot(x - SPRING[0], y - SPRING[1]);
  return d < 5 ? Math.round(30 - (5 - d) * 3) : 30;
}

const game = Game.create(4242, SIZE);
const world = game.world;
game.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.settings.fog = false;
for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) world.setHeight(x, y, height(x, y));
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) world.setTile(x, y, TileType.Grass, 0);
/** The trails: west to east through the pond, and south from it down the beach into the sea. */
const TRAIL: Array<[number, number]> = [];
for (let x = 2; x <= 26; x++) TRAIL.push([x, 14]);
for (let y = 15; y <= 37; y++) TRAIL.push([22, y]);
game.springs.lay();
game.springs.dig(SPRING[0], SPRING[1], null, Date.now() - 3600 * 1000);
game.update(0.01);
game.player.x = SIZE - 1.5;
game.player.y = 1.5;

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const screen = new FullscreenCanvas(canvas);
const renderer = new Renderer(screen, game);
const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));

const page = {
  trail: TRAIL,
  /** Whether a tile is all under the pond: every corner of it in its water. */
  underPond(x: number, y: number): boolean {
    const cw = world.w + 1;
    return (world.water?.pondsAt(x, y) ?? []).some((p) => [0, 1].every((dy) => [0, 1].every((dx) => p.wet.has((y + dy) * cw + x + dx))));
  },
  /** How deep the pond over a tile is at its middle, or the sea; nought on dry ground. */
  depth(x: number, y: number): number {
    const bed = (world.getHeight(x, y) + world.getHeight(x + 1, y) + world.getHeight(x, y + 1) + world.getHeight(x + 1, y + 1)) / 4;
    const ponds = world.water?.pondsAt(x, y) ?? [];
    const top = Math.max(0, ...ponds.map((p) => p.level));
    return Math.max(0, top - bed);
  },
  /** The heights of a tile's four corners. */
  corners(x: number, y: number): number[] {
    return [world.getHeight(x, y), world.getHeight(x + 1, y), world.getHeight(x, y + 1), world.getHeight(x + 1, y + 1)];
  },
  /** Worn or not: the trail tiles as trails worn out of grass, or as the grass. */
  wear(worn: boolean): void {
    for (const [x, y] of TRAIL) world.setTile(x, y, worn ? TileType.Trail : TileType.Grass, worn ? TileType.Grass : 0);
  },
  /** One frame looking at (fx, fy, fh), and the colour round the middle of each tile asked. */
  async look(fx: number, fy: number, fh: number, zoom: number, tiles: Array<[number, number]>): Promise<TrailSample[]> {
    const cam = renderer.camera;
    cam.zoom = zoom;
    cam.rotation = 0;
    cam.focus(fx, fy, fh, null);
    for (let i = 0; i < 8; i++) {
      renderer.time = 20;
      renderer.render(0);
      await nextFrame();
    }
    const ctx = screen.ctx;
    const dpr = ctx.getTransform().a;
    return tiles.map(([x, y]) => {
      const bed = (world.getHeight(x, y) + world.getHeight(x + 1, y) + world.getHeight(x, y + 1) + world.getHeight(x + 1, y + 1)) / 4;
      const sx = Math.round(cam.worldToScreenX(x + 0.5, y + 0.5) * dpr), sy = Math.round(cam.worldToScreenY(x + 0.5, y + 0.5, bed) * dpr);
      const on = sx >= 2 && sy >= 2 && sx < ctx.canvas.width - 2 && sy < ctx.canvas.height - 2;
      const px = ctx.getImageData(sx - 2, sy - 2, 5, 5).data;
      const rgb: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += px[i + c] / 25;
      return { x, y, on, rgb };
    });
  },
};
(window as unknown as { trailwater: typeof page }).trailwater = page;
