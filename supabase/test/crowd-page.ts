/**
 * The page `crowd.ts` opens: a settlement as Solara stood when it would not
 * draw ten frames a second, in a game run as the island runs it, and the
 * renderer that draws it. Bundled for the browser by `crowd.ts`; the clock
 * and the count of canvases made are put in before it by the driver.
 *
 * Round the token, within a few tiles of the body: nine wildermon following,
 * three deed workers, six wildermon shut in crates, the altar, a lit smelter,
 * kiln and campfire, a house, crops and a pile on the ground.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';

/** What the driver put in before this: the clock it moves, and the canvases made since the page opened. */
interface Driven {
  tick: (ms: number) => void;
  realNow: () => number;
  canvases: () => number;
}
const driven = (window as unknown as { driven: Driven }).driven;

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 14;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);

// The island's seams, as `play.ts` sets them.
let hour = 13;
const day0 = 1000 * DAY_SECONDS;
const opened = performance.now();
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);

let id = 1000;
const placed: IslandPlaced[] = [];
const put = (kind: string, sub: string | null, x: number, y: number, more: Partial<IslandPlaced> = {}): void => {
  placed.push({
    id: id++, kind, sub, x, y, sx: 0, sy: 0, ql: 40, fuel: null, ash: null, lit: null, dmg: null, name: null, material: 'oak',
    litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's', ...more,
  });
};
const mobs: IslandCreature[] = [];
const beast = (species: string, mode: string, x: number, y: number, skill: number): number => {
  const cid = id++;
  mobs.push({ id: cid, species, name: `${species} ${cid}`, variant: cid % 3, mode, stance: 'passive', x, y, health: 1, max: 1, mine: true,
    sex: cid % 2 ? 'male' : 'female', traits: [], skills: { haul: skill } });
  return cid;
};

// Nine following, about the body; three workers; six in crates.
const following: Array<[string, number]> = [['roxxen', 30], ['roxxen', 30], ['roxxen', 30], ['seavic', 30], ['woola', 5], ['quarra', 60], ['orse', 5], ['mola', 5], ['tinka', 5]];
following.forEach(([sp, skill], i) => beast(sp, 'active', cx + 0.5 + Math.cos(i * 0.7) * 2, cy + 0.5 + Math.sin(i * 0.7) * 2, skill));
for (let i = 0; i < 3; i++) beast('cobbe', 'deed', cx - 2 + i * 2 + 0.5, cy + 3.5, 30);
const crated: Array<[string, number]> = [['quarra', 30], ['quarra', 60], ['mola', 30], ['seavic', 30], ['tinka', 30], ['woola', 5]];
crated.forEach(([sp, skill], i) => put('furniture', 'creature_crate', cx - 3 + i, cy - 3, { creature: beast(sp, 'stored', cx - 2.5 + i, cy - 2.5, skill) }));
put('furniture', 'altar', cx + 2, cy - 1);
put('smelter', null, cx + 3, cy + 2, { lit: true, fuel: 9999 });
put('kiln', null, cx - 4, cy + 1, { lit: true, fuel: 9999 });
put('campfire', null, cx - 2, cy + 1, { lit: true, fuel: 9999 });
put('anvil', null, cx + 4, cy - 2, { sub: 'iron' });
for (const [k, dx, dy] of [['chest', -4, -1], ['barrel', 4, 0], ['lamp_post', 1, 3], ['banner', -1, -4], ['bed', 3, -4]] as const) put('furniture', k, cx + dx, cy + dy, { lit: k === 'lamp_post' ? true : null, fuel: 9999 });

// A house of plank, five by four, and crops in front of it.
const walls: unknown[] = [];
const floors: unknown[] = [];
const tiles: string[] = [];
const [hx, hy, hw, hh] = [cx - 9, cy - 8, 5, 4];
for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
  tiles.push(`${x},${y}`);
  floors.push({ building: 1, level: 0, x, y, material: 'plank', needed: {}, total: {} });
  floors.push({ building: 1, level: 1, x, y, material: 'thatch', kind: 'roof', needed: {}, total: {} });
}
const wall = (x: number, y: number, dir: 'h' | 'v', type: string): void => {
  walls.push({ building: 1, level: 0, x, y, dir, type, material: 'plank', needed: {}, total: {} });
};
for (let x = hx; x < hx + hw; x++) { wall(x, hy, 'h', 'solid'); wall(x, hy + hh, 'h', x === hx + 2 ? 'door' : 'window'); }
for (let y = hy; y < hy + hh; y++) { wall(hx, y, 'v', 'solid'); wall(hx + hw, y, 'v', 'window'); }
const crops: NonNullable<IslandGround['crops']> = [];
for (let i = 0; i < 12; i++) {
  const x = cx + 5 + (i % 4), y = cy + 4 + Math.floor(i / 4);
  world.setTile(x, y, TileType.Field);
  crops.push({ x, y, id: ['wheat', 'carrot', 'onion'][i % 3], stage: i % 5, ago: 10, tended: 1, tendedNow: false, ql: 30 });
}
const lying = Array.from({ length: 20 }, (_, i) => ({
  id: id++, def: ['log', 'plank', 'rock_shards', 'iron_lump', 'clay'][i % 5], ql: 30, dmg: 0, count: 1 + (i % 4), extra: null, holder: 'ground',
  charges: null, locked: false, issued: false, rare: null, dye: null, bless: null, maker: null, piece: null, gx: cx + 1 + (i % 2), gy: cy + 1,
}));

const deed = { name: 'Solara', x: cx, y: cy, radius: 13, level: 5, mine: true, role: 'mayor' };
game.sawGround({
  placed, crates: [], lying, crops, now: Date.now() / 1000,
  buildings: { nextId: 2, list: [{ id: 1, name: 'House', tiles, levels: 1, roof: 'gable' }], walls, floors },
  deed, deeds: [{ ...deed, holder: 'me' }],
} as unknown as IslandGround, undefined, 'me');
game.creatures.sawAll(mobs, game.time);
game.teamsFromCreatures();

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

/** What `frames` measured: real milliseconds a frame and a step of the game's, and canvases made, over the frames counted. */
export interface Measured { frame: number; update: number; canvases: number; frames: number; night: number }

/**
 * `n` frames `step` milliseconds of the page's clock apart, at `zoom` and the
 * island's `at` o'clock, as the loop draws them: the game's turn, the camera
 * on the body, the frame.
 */
function frames(n: number, step: number, zoom: number, at: number): Measured {
  hour = at;
  renderer.camera.zoom = zoom;
  const made = driven.canvases();
  let frame = 0, update = 0;
  for (let i = 0; i < n; i++) {
    driven.tick(step);
    const a = driven.realNow();
    game.update(step / 1000);
    renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), step / 1000);
    const b = driven.realNow();
    renderer.render(step / 1000);
    frame += driven.realNow() - a;
    update += b - a;
  }
  // How many pixels across the night was mixed at, the last time it was laid: the screen's, or the lights' share of them.
  const night = (renderer as unknown as { night?: HTMLCanvasElement }).night?.width ?? 0;
  return { frame: frame / n, update: update / n, canvases: driven.canvases() - made, frames: n, night: night / canvas.width };
}

(window as unknown as { crowd: unknown }).crowd = { frames };
