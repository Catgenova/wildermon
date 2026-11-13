/**
 * The page `animoff.ts` opens: a busy stretch of the island in the real game and renderer, drawn with Animations On and
 * Off in turn. Thirty other people in view, fifteen at work (mining, digging, planting, meditating, praying) and fifteen
 * in a fight (one-handed and two-handed weapons, bows), blows landing on them in turn; eight wildermon of eight kinds about
 * them, three of them walking legs back and forth; a wood of trees and bushes to the north, the sea along the south with
 * a man swimming in it, and a lit campfire. Bundled for the browser by `animoff.ts`; the clock is put in before it by the
 * driver.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import type { PeerState } from '../../src/net/protocol';
import { Renderer } from '../../src/render/renderer';
import { loadAllWildermon } from '../../src/render/wildermon';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType, packTreeData, TREE_DEFS } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { HAIRSTYLES } from '../../src/game/look';
import type { Animations } from '../../src/game/settings';
import { figureStats } from '../../src/render/figure';
import { beastStats } from '../../src/render/beasts';

interface Driven { tick: (ms: number) => void; realNow: () => number }
const driven = (window as unknown as { driven: Driven }).driven;

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 14;
const h0 = 8;
// Flat grass, a wood to the north, the sea along the south: a beach from four tiles out, under the water from seven, and the
// water on out to the island's edge, so it is the sea's.
const shore = (dy: number): number => (dy <= 3 ? h0 : dy >= 7 ? -20 : h0 + ((-20 - h0) * (dy - 3)) / 4);
for (let y = cy - R; y <= world.h; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, Math.round(shore(y - cy)));
for (let y = cy - R; y < world.h; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, y - cy > 3 ? TileType.Sand : TileType.Grass);
for (let y = cy - 8; y <= cy - 5; y++) for (let x = cx - 6; x <= cx + 6; x++) {
  if ((x * 7 + y * 3) % 3) continue;
  world.setTile(x, y, (x + y) % 4 ? TileType.Tree : TileType.Bush, packTreeData((x * 5 + y) % Math.min(8, TREE_DEFS.length), 2 + ((x + y) % 3)));
}

let hour = 13;
const day0 = 1000 * DAY_SECONDS, opened = performance.now();
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
// The whole stretch seen, as with Fog of war off.
game.settings.fog = false;
game.putBody(cx + 0.5, cy + 0.5, 0);

let id = 1000;
const placed: IslandPlaced[] = [{
  id: id++, kind: 'campfire', sub: null, x: cx - 6, y: cy + 1, sx: 0, sy: 0, ql: 40, fuel: 9999, ash: null, lit: true, dmg: null, name: null, material: 'oak',
  litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's',
}];
game.sawGround({ placed, crates: [], lying: [], crops: [], now: Date.now() / 1000, buildings: { nextId: 1, list: [], walls: [], floors: [] } } as unknown as IslandGround, undefined, 'me');

// Eight wildermon about the people, the first three walking legs of three seconds back and forth.
const KINDS = ['orse', 'woola', 'quarra', 'seavic', 'mola', 'rabba', 'tinka', 'cobbe'];
const mobs: IslandCreature[] = KINDS.map((species, i) => ({
  id: id++, species, name: species, variant: i % 3, mode: i < 3 ? 'deed' : 'active', stance: 'passive',
  x: cx + (i % 2 ? 6.5 : -6.5), y: cy - 3.5 + i, health: 1, max: 1, mine: true, sex: i % 2 ? 'male' : 'female', traits: [], skills: { haul: 30 },
} as IslandCreature));
const LEG = 3;
const creatureRows = (): IslandCreature[] => {
  const t = performance.now() / 1000, k = (t % (2 * LEG)) / LEG, there = k < 1, u = there ? k : k - 1;
  return mobs.map((m, i) => {
    if (i >= 3) return m;
    const fx = there ? m.x : m.x + 3, tx = there ? m.x + 3 : m.x;
    return { ...m, x: fx + (tx - fx) * u, y: m.y, fromX: fx, fromY: m.y, toX: tx, toY: m.y, legFor: LEG, legLeft: LEG * (1 - u) };
  });
};

const JOBS = ['mine', 'dig', 'plant', 'meditate', 'pray'];
const TOOLS: Record<string, string> = { mine: 'pickaxe', dig: 'shovel' };
const ARMS = ['sword', 'long_sword', 'short_bow', 'maul', 'hatchet'];
const METALS = ['iron', 'steel', 'copper', 'bronze', 'silver'];
/** Thirty people on a grid of six by five round the body, a tile and a half apart: the even ones at work, the odd in a fight; and one swimming. */
const peers: PeerState[] = Array.from({ length: 30 }, (_, i) => {
  const fight = i % 2 === 1, material = METALS[i % METALS.length], job = JOBS[(i >> 1) % JOBS.length];
  return {
    id: 6000 + i, uid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Person ${i}`,
    x: cx - 3.25 + (i % 6) * 1.5, y: cy - 3.25 + Math.floor(i / 6) * 1.5, dirX: Math.cos(i), dirY: Math.sin(i), level: 0,
    moving: false, swimming: false, working: true, act: fight ? 'attack_creature' : job,
    look: { gender: i % 3 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.5, skin: (i * 0.29) % 1 },
    gear: fight ? { weapon: { id: ARMS[(i >> 1) % ARMS.length], material, enchanted: i % 4 === 1 } } : undefined,
    tool: fight || !TOOLS[job] ? undefined : { id: TOOLS[job], material, enchanted: i % 4 === 0 },
  } as unknown as PeerState;
});
peers.push({
  id: 6100, uid: '00000000-0000-4000-8000-000000000100', name: 'Swimmer', x: cx - 1.5, y: cy + 7.5, dirX: 1, dirY: 0, level: 0,
  moving: false, swimming: true, working: false, look: { gender: 'man', hair: HAIRSTYLES[2].id, hairColour: 0.3, hairBright: 0.5, skin: 0.4 },
} as unknown as PeerState);
const WHERE = ['chest', 'head', 'arms', 'legs', 'feet'];

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

export interface Measured {
  frames: number;
  /** Real milliseconds a frame: the median and the mean. */
  median: number;
  mean: number;
  /** Pictures of bodies drawn afresh a frame (`figureStats`), and of wildermon made or drawn for themselves (`beastStats`). */
  redraws: number;
  beastMade: number;
  beastLive: number;
  /** The same over the last `quiet` frames, once whatever changed going On or Off has been drawn. */
  quietRedraws: number;
}

let frame = 0;

/** `n` frames `step` ms of the page's clock apart at `zoom`, with Animations `animations`; the last `quiet` of them counted again on their own. */
function frames(n: number, step: number, zoom: number, animations: Animations, quiet = 0): Measured {
  game.settings.animations = animations;
  game.settings.effects = 'all';
  renderer.camera.zoom = zoom;
  const each: number[] = [];
  const r0 = figureStats.redraws, m0 = beastStats.made, l0 = beastStats.live;
  let rq = r0;
  for (let i = 0; i < n; i++) {
    if (i === n - quiet) rq = figureStats.redraws;
    driven.tick(step);
    if (i % 15 === 0) {
      game.roster.sawAll(peers);
      game.creatures.sawAll(creatureRows(), game.time);
    }
    // a blow landing on every fighter once a second, each on its own beat
    peers.forEach((p, j) => {
      if (j % 2 !== 1 || (frame + j * 7) % 30 !== 0) return;
      game.roster.hurt(p.id, Date.now(), WHERE[j % WHERE.length]);
    });
    frame++;
    game.update(step / 1000);
    renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), step / 1000);
    const a = driven.realNow();
    renderer.render(step / 1000);
    canvas.ctx.getImageData(0, 0, 1, 1);
    each.push(driven.realNow() - a);
  }
  const sorted = [...each].sort((p, q) => p - q);
  return {
    frames: n, median: sorted[n >> 1], mean: each.reduce((p, q) => p + q, 0) / n,
    redraws: (figureStats.redraws - r0) / n, beastMade: (beastStats.made - m0) / n, beastLive: (beastStats.live - l0) / n,
    quietRedraws: quiet ? (figureStats.redraws - rq) / quiet : 0,
  };
}

const ready = loadAllWildermon().then(() => {
  game.roster.sawAll(peers);
  game.creatures.sawAll(creatureRows(), game.time);
  game.teamsFromCreatures();
});

(window as unknown as { animOff: unknown }).animOff = {
  frames, ready, setHour: (h: number) => (hour = h),
  shot: (): string => canvasEl.toDataURL('image/png'),
};
