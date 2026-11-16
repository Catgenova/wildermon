/**
 * The page `keepershown.ts` opens: the game as it is drawn, with the island's own creature rows (`rpc_creatures`,
 * read off the database by the test) standing round you. Every name plate handed to the frame's names is kept
 * (`labels`), with its ink, for the test to read.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { NameLabels, type NameLabel } from '../../src/render/namelabels';
import type { IslandCreature } from '../../src/game/creatures';

/** Every name plate handed in since the last `world`, as the frame's names had it. */
const labels: Array<{ text: string; ink: string }> = [];
const add = NameLabels.prototype.add;
NameLabels.prototype.add = function (this: NameLabels, l: NameLabel): void {
  labels.push({ text: l.text, ink: l.ink });
  add.call(this, l);
};

const game = Game.create(4242, 128);
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
game.putBody(cx + 0.5, cy + 0.5, 0);
game.settings.motion = 'less';
game.settings.uiLife = false;
game.settings.fog = false;

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

/** Where each creature stands, from you, in the order the island's rows come. */
const SPOTS: Array<[number, number]> = [[2.2, -0.4], [-2.2, 0.6], [0.4, 2.4], [-0.6, -2.4]];
let rows: IslandCreature[] = [];

function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(cx + 0.5, cy + 0.5, game.playerHeight(), null);
  renderer.render(1 / 60);
}
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

/** The island's rows, each stood still at a spot round you. */
const placed = (): IslandCreature[] => rows.map((r, i) => {
  const x = cx + 0.5 + SPOTS[i % SPOTS.length][0], y = cy + 0.5 + SPOTS[i % SPOTS.length][1];
  return { ...r, x, y, fromX: x, fromY: y, toX: x, toY: y, legFor: 0, legLeft: 0 };
});

const api = {
  /** The island's rows in, and your own name as the island has your body. */
  load(rs: IslandCreature[], me: string): void {
    rows = rs;
    game.player.name = me;
    game.creatures.sawAll(placed());
    for (let i = 0; i < 3; i++) frame();
  },
  /** The world at this zoom; the plates handed in for that frame. */
  async world(zoom: number): Promise<Array<{ text: string; ink: string }>> {
    renderer.camera.zoom = zoom;
    // Long enough for the bodies' pictures to come in, which are made off the frame; told again where each is.
    for (let i = 0; i < 80; i++) {
      if (i % 5 === 0) game.creatures.sawAll(placed());
      frame();
      await rest(50);
    }
    labels.length = 0;
    frame();
    return labels.slice();
  },
};
(window as unknown as { keeperShown: typeof api }).keeperShown = api;
