/**
 * The page `saddle.ts` opens: somebody else on the island, up on a wildermon,
 * at a wagon's reins, or both at once, as the island had catgenova -- in the
 * saddle of Thistlekit and at the reins of wagon 275 -- and the renderer that
 * draws them. Bundled for the browser by `saddle.ts`; the clock is put in
 * before it by the driver.
 *
 * `saddle.frames` draws frames and says how many times their name was written
 * in each, which is how many bodies were drawn: a name and a bubble go with
 * every one.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import type { PeerState } from '../../src/net/protocol';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';

const driven = (window as unknown as { driven: { tick: (ms: number) => void } }).driven;

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 10;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);

// The island's seams, as `play.ts` sets them.
const opened = performance.now();
game.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);

const NAME = 'catgenova';
const UID = '77d7c70d-d4e5-454e-8a60-d05b7d4c31dd';
// Two tiles off, at a tile's middle, as the island had them; doing something, as they were.
const at = { x: cx + 2.5, y: cy + 1.5 };
const body = (): PeerState => ({
  id: 777, uid: UID, name: NAME, x: at.x, y: at.y, dirX: 0, dirY: 1, level: 0, moving: false, swimming: false, working: true, act: 'flatten',
});
const mount = (): IslandCreature => ({
  id: 7538, species: 'orse', name: 'Thistlekit', variant: 0, mode: 'active', stance: 'passive', x: at.x, y: at.y, health: 1, max: 1,
  mine: false, sex: 'female', traits: [], tacked: true, ridden: false, rider: UID,
});
const wagon = (): IslandPlaced => ({
  id: 275, kind: 'furniture', sub: 'wagon', x: Math.floor(at.x), y: Math.floor(at.y), sx: 0, sy: 0, ql: 40, fuel: null, ash: null, lit: null,
  dmg: null, name: null, material: 'oak', litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null,
  mine: false, facing: 's', driver: UID,
});

/** What the island says: the body, and the mount under it and the wagon it has the reins of, as the scene has them. */
function told(scene: { mounted: boolean; reins: boolean }): void {
  game.roster.sawAll([body()]);
  game.creatures.sawAll(scene.mounted ? [mount()] : [], game.time);
  game.sawGround({
    placed: scene.reins ? [wagon()] : [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: { nextId: 1, list: [], walls: [], floors: [] }, deed: null, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
}

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

// Every time the name is written: once for every body drawn.
let names = 0;
const fill = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, w?: number): void {
  if (text === NAME) names++;
  if (w === undefined) fill.call(this, text, x, y);
  else fill.call(this, text, x, y, w);
};

/**
 * `n` frames a tenth of a second apart, at `zoom` and turned `turn` eighths, the body walked
 * east a little every third one when `walk`: how many times the name was written in each.
 */
function frames(scene: { mounted: boolean; reins: boolean }, n: number, zoom: number, turn: number, walk: boolean): number[] {
  at.x = cx + 2.5;
  at.y = cy + 1.5;
  told(scene);
  renderer.camera.zoom = zoom;
  renderer.camera.rotation = turn;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    driven.tick(100);
    if (walk && i % 3 === 0) {
      at.x += 0.15;
      told(scene);
    }
    game.update(0.1);
    renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), 0.1);
    names = 0;
    renderer.render(0.1);
    out.push(names);
  }
  return out;
}

(window as unknown as { saddle: unknown }).saddle = { frames };
