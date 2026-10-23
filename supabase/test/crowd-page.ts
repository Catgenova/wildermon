/**
 * The page `crowd.ts` opens: Solara as the island counted it (look.yml, the
 * 23rd of October), in a game run as the island runs it, and the renderer
 * that draws it. Bundled for the browser by `crowd.ts`; the clock and the
 * count of canvases made are put in before it by the driver, and
 * `crowdScene.following` with it when the body is to have more than Solara's
 * one wildermon following.
 *
 * Within its radius of thirteen: thirty wildermon of twenty-two kinds shut in
 * crates, five at work and one following; 110 walls and 87 floor tiles, all
 * on the ground, in four open buildings and a pen of fence; 21 crates; 33
 * other pieces, the altar and one lamp lit among them; three smelters, two
 * anvils, two kilns (one lit) and two campfires (both lit); 26 crops; and 70
 * things on the ground over six tiles.
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
const R = 16;
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

// One following -- or the nine that followed the body when Solara would not draw ten frames a second -- and five at work: three cobbe, a whispet sparring a sparra.
const scene = (window as unknown as { crowdScene?: { following?: number } }).crowdScene ?? {};
const following: Array<[string, number]> = (scene.following ?? 1) > 1
  ? [['roxxen', 30], ['roxxen', 30], ['roxxen', 30], ['seavic', 30], ['woola', 5], ['quarra', 60], ['orse', 5], ['mola', 5], ['tinka', 5]]
  : [['orse', 5]];
following.forEach(([sp, skill], i) => beast(sp, 'active', cx + 0.5 + Math.cos(i * 0.7) * 2, cy + 0.5 + Math.sin(i * 0.7) * 2, skill));
for (let i = 0; i < 3; i++) beast('cobbe', 'deed', cx - 2 + i * 2 + 0.5, cy + 3.5, 30);
beast('whispet', 'deed', cx + 6.5, cy + 6.5, 30);
beast('sparra', 'deed', cx + 7.5, cy + 6.5, 30);
// Thirty shut in crates, twenty-two kinds, in two rows of fifteen.
const stored = ['quarra', 'quarra', 'quarra', 'quarra', 'orse', 'seavic', 'seavic', 'mola', 'mola', 'rabba', 'rabba', 'tinka', 'tinka', 'warda', 'warda',
  'chissa', 'marka', 'noot', 'leecha', 'woola', 'holla', 'grazza', 'dowse', 'crawler', 'sheela', 'testa', 'ulva', 'simma', 'snedda', 'rippa'];
stored.forEach((sp, i) => {
  const x = cx - 12 + (i % 15), y = cy - 6 + Math.floor(i / 15);
  put('furniture', 'creature_crate', x, y, { creature: beast(sp, 'stored', x + 0.5, y + 0.5, 30) });
});
// Three smelters, two anvils, two kilns (one lit), two campfires (both lit).
for (const [k, dx, dy, lit] of [['smelter', 4, 0, false], ['smelter', 6, 0, false], ['smelter', 8, 0, false], ['anvil', 4, 2, false], ['anvil', 6, 2, false],
  ['kiln', 8, 2, true], ['kiln', 10, 2, false], ['campfire', -2, 1, true], ['campfire', 10, 5, true]] as const) {
  put(k, k === 'anvil' ? 'iron' : null, cx + dx, cy + dy, { lit, fuel: lit ? 9999 : 0 });
}

// Four open buildings, eighty-seven floor tiles and seventy-six walls between them, and a pen of thirty-four fence.
const walls: unknown[] = [];
const floors: unknown[] = [];
const list: unknown[] = [];
const wall = (building: number, x: number, y: number, dir: 'h' | 'v', type: string, material: string): void => {
  walls.push({ building, level: 0, x, y, dir, type, material, needed: {}, total: {} });
};
const house = (bid: number, x0: number, y0: number, w: number, h: number, material: string, floor: string): string[] => {
  const tiles: string[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    tiles.push(`${x},${y}`);
    floors.push({ building: bid, level: 0, x, y, material: floor, needed: {}, total: {} });
  }
  for (let x = x0; x < x0 + w; x++) {
    wall(bid, x, y0, 'h', x === x0 + 1 ? 'window' : 'solid', material);
    wall(bid, x, y0 + h, 'h', x === x0 + (w >> 1) ? 'door' : x === x0 + 1 ? 'window' : 'solid', material);
  }
  for (let y = y0; y < y0 + h; y++) {
    wall(bid, x0, y, 'v', y === y0 + 1 ? 'window' : 'solid', material);
    wall(bid, x0 + w, y, 'v', 'solid', material);
  }
  list.push({ id: bid, name: `House ${bid}`, tiles, levels: 1 });
  return tiles;
};
const store = house(1, cx - 12, cy - 13, 6, 5, 'stone_brick', 'stone_brick');
house(2, cx - 5, cy - 13, 5, 4, 'plank', 'plank');
house(3, cx + 1, cy - 13, 4, 4, 'cobblestone', 'cobblestone');
house(4, cx + 7, cy - 13, 3, 7, 'marble', 'marble');
for (let x = cx - 12; x < cx + 10; x++) wall(0, x, cy + 10, 'h', x === cx ? 'fence_gate' : 'fence', 'plank');
for (let y = cy + 4; y < cy + 10; y++) { wall(0, cx - 12, y, 'v', 'fence', 'plank'); wall(0, cx + 10, y, 'v', 'fence', 'plank'); }
// Twenty-one crates in the stone store, and what else stands about: thirty-three pieces, one lamp lit.
const crates = Array.from({ length: 21 }, (_, i) => {
  const [x, y] = store[i].split(',').map(Number);
  return { id: id++, kind: i % 3 ? 'plank' : 'log', x, y, sx: 0, sy: 0, material: 'oak', ql: 30, name: null, deed: true, mine: true, units: (i * 7) % 40 };
});
const pieces: Array<[string, number, number]> = [
  ['altar', 2, -1], ['lamp_post', 1, 3], ['banner', -1, -3], ['flagpole', 3, -3], ['statue', -8, 2], ['well', -6, 2], ['fountain', -4, 2],
  ['chest', -5, -12], ['chest', -4, -12], ['barrel', -3, -12], ['barrel', -2, -12], ['larder', -5, -10], ['shelves', -2, -10], ['table', -4, -11],
  ['bed', 1, -12], ['bench', 3, -11], ['wardrobe', 1, -10], ['coffer', 4, -12], ['bookshelf', 7, -12], ['desk', 8, -10], ['lectern', 7, -8],
  ['loom', 8, -8], ['oven', 7, -10], ['brazier', 9, -11], ['bulk_bin', 11, 0], ['craft_bin', 11, 1], ['seed_bin', 11, 2], ['firewood_rack', 12, 0],
  ['firewood_rack', 12, 2], ['cart', 12, 5], ['hive', -10, 8], ['planter', -8, 8], ['sign', 0, 9],
];
for (const [k, dx, dy] of pieces) put('furniture', k, cx + dx, cy + dy, { lit: k === 'lamp_post' ? true : null, fuel: 9999 });

// Twenty-six crops in two rows inside the pen.
const crops: NonNullable<IslandGround['crops']> = [];
for (let i = 0; i < 26; i++) {
  const x = cx - 11 + (i % 13), y = cy + 6 + Math.floor(i / 13);
  world.setTile(x, y, TileType.Field);
  crops.push({ x, y, id: ['wheat', 'carrot', 'onion'][i % 3], stage: i % 5, ago: 10, tended: 1, tendedNow: false, ql: 30 });
}
// Seventy things on the ground, two hundred and fifty-four units, over six tiles.
const lying = Array.from({ length: 70 }, (_, i) => ({
  id: id++, def: ['log', 'plank', 'rock_shards', 'iron_lump', 'clay', 'shaft', 'nail'][i % 7], ql: 30, dmg: 0, count: 1 + (i % 6), extra: null, holder: 'ground',
  charges: null, locked: false, issued: false, rare: null, dye: null, bless: null, maker: null, piece: null, gx: cx + 1 + (i % 3), gy: cy + 1 + Math.floor((i % 6) / 3),
}));

const deed = { name: 'Solara', x: cx, y: cy, radius: 13, level: 5, mine: true, role: 'mayor' };
game.sawGround({
  placed, crates, lying, crops, now: Date.now() / 1000,
  buildings: { nextId: 5, list, walls, floors },
  deed, deeds: [{ ...deed, holder: 'me' }],
} as unknown as IslandGround, undefined, 'me');
game.creatures.sawAll(mobs, game.time);
game.teamsFromCreatures();

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

/**
 * Walls, floor tiles and tiles' shade drawn afresh, rather than laid from
 * their pictures, since the page opened: counted on the renderer's own
 * drawing of each (`drawWallNow`, `drawFloorNow`, `groundShadeNow`).
 */
const afresh = { walls: 0, floors: 0, shades: 0 };
{
  const own = renderer as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const [name, n] of [['drawWallNow', 'walls'], ['drawFloorNow', 'floors'], ['groundShadeNow', 'shades']] as const) {
    const fn = own[name];
    own[name] = function (this: unknown, ...a: unknown[]): unknown {
      afresh[n]++;
      return fn.apply(this, a);
    };
  }
}

/**
 * What `frames` measured: real milliseconds a frame (the mean, the median, the
 * worst, and each in turn) and a step of the game's; canvases made, in all and
 * in each frame; walls, floors and shade drawn afresh a frame; over the frames
 * counted.
 */
export interface Measured {
  frame: number; median: number; worst: number; series: number[]; made: number[]; update: number; canvases: number; frames: number; night: number;
  afresh: { walls: number; floors: number; shades: number };
}

/**
 * `n` frames `step` milliseconds of the page's clock apart, at `zoom` and the
 * island's `at` o'clock, as the loop draws them: the game's turn, the camera
 * on the body, the frame. `move.pan` walks the camera across the settlement
 * and back at so many tiles a second; `move.zoomTo` wheels the zoom out or in
 * to it over the frames, evenly in octaves.
 */
function frames(n: number, step: number, zoom: number, at: number, move: { pan?: number; zoomTo?: number } = {}): Measured {
  hour = at;
  renderer.camera.zoom = zoom;
  let ox = 0;
  const made = driven.canvases();
  const was = { ...afresh };
  let frame = 0, update = 0;
  const each: number[] = [];
  const madeEach: number[] = [];
  for (let i = 0; i < n; i++) {
    const before = driven.canvases();
    driven.tick(step);
    const a = driven.realNow();
    game.update(step / 1000);
    // Panned across the settlement and back, `pan` tiles a second; and the zoom drawn out to `zoomTo` over the frames.
    if (move.pan) ox = (move.pan * (i * step) / 1000) % 24 - 12;
    if (move.zoomTo !== undefined) renderer.camera.zoom = zoom * (move.zoomTo / zoom) ** ((i + 1) / n);
    renderer.camera.focus(game.player.x + ox, game.player.y + ox * 0.3, game.playerHeight(), step / 1000);
    const b = driven.realNow();
    renderer.render(step / 1000);
    // What was drawn, put down on the canvas's pixels as a screen would: the canvas otherwise keeps the orders and throws them away at the next frame's sky.
    canvas.ctx.getImageData(0, 0, 1, 1);
    const took = driven.realNow() - a;
    each.push(took);
    madeEach.push(driven.canvases() - before);
    frame += took;
    update += b - a;
  }
  // How many pixels across the night was mixed at, the last time it was laid: the screen's, or the lights' share of them.
  const night = (renderer as unknown as { night?: HTMLCanvasElement }).night?.width ?? 0;
  const series = [...each];
  each.sort((p, q) => p - q);
  return { frame: frame / n, median: each[n >> 1], worst: each[n - 1], series, made: madeEach, update: update / n, canvases: driven.canvases() - made, frames: n, night: night / canvas.width,
    afresh: { walls: (afresh.walls - was.walls) / n, floors: (afresh.floors - was.floors) / n, shades: (afresh.shades - was.shades) / n } };
}

(window as unknown as { crowd: unknown }).crowd = { frames, renderer };
