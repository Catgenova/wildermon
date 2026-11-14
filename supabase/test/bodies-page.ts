/**
 * The page `bodies.ts` opens: the stretch of the island `animoff-page.ts` draws (thirty people at work and in a fight
 * round the body, wildermon, a wood, the sea with a swimmer, a fire) and a crowd beside it: sixty more people in rows,
 * half at work and half in a fight, blows landing on the fighters in turn. Drawn in the real game and renderer, the camera
 * put where each measure wants it every frame:
 *
 *   * `busy`: on the body, as `animoff.ts` draws it;
 *   * `crowd`: on the crowd;
 *   * `pan`: swept from the wood west of the body to the far end of the crowd and back, `PAN` tiles a second;
 *   * `zoom`: on the crowd, the zoom eased in, out past where it started and back, held between.
 *
 * Bundled for the browser by `bodies.ts`; the clock is put in before it by the driver.
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
import * as figure from '../../src/render/figure';

interface Driven { tick: (ms: number) => void; realNow: () => number }
const driven = (window as unknown as { driven: Driven }).driven;
/** What the bodies' own measures are, where the renderer has them (`figure.ts` bodyStats); none on a renderer without. */
interface BodyKnobs { clock?: { now: () => number }; stats?: { ms: number; drawn: number; deferred: number; step: number }; pin?: (step: number | null) => void }
const knobs = figure as unknown as { bodyKnobs?: BodyKnobs };
// The bodies' time budget on the page's real clock: the game's own is driven.
if (knobs.bodyKnobs?.clock) knobs.bodyKnobs.clock.now = driven.realNow;

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
/** The crowd's side of the body: whichever has the room. */
const side = cx < world.w / 2 ? 1 : -1;
const R = 14, FAR = 40;
const h0 = 8;
const shore = (dy: number): number => (dy <= 3 ? h0 : dy >= 7 ? -20 : h0 + ((-20 - h0) * (dy - 3)) / 4);
const x0 = Math.max(1, Math.min(cx - R, cx + side * FAR)), x1 = Math.min(world.w - 2, Math.max(cx + R + 1, cx + side * FAR));
for (let y = cy - R; y <= world.h; y++) for (let x = x0; x <= x1; x++) world.setHeight(x, y, Math.round(shore(y - cy)));
for (let y = cy - R; y < world.h; y++) for (let x = x0; x <= x1; x++) world.setTile(x, y, y - cy > 3 ? TileType.Sand : TileType.Grass);
for (let y = cy - 8; y <= cy - 5; y++) for (let x = cx - 6; x <= cx + 6; x++) {
  if ((x * 7 + y * 3) % 3) continue;
  world.setTile(x, y, (x + y) % 4 ? TileType.Tree : TileType.Bush, packTreeData((x * 5 + y) % Math.min(8, TREE_DEFS.length), 2 + ((x + y) % 3)));
}

const hour = 13;
const day0 = 1000 * DAY_SECONDS, opened = performance.now();
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.settings.fog = false;
game.putBody(cx + 0.5, cy + 0.5, 0);
// The same body every time (`Game.create` dresses it at random), so pictures of two builds can be laid side by side.
game.player.look = { gender: 'woman', hair: HAIRSTYLES[3].id, hairColour: 0.8, hairBright: 0.5, skin: 0.3 } as typeof game.player.look;

let id = 1000;
const placed: IslandPlaced[] = [{
  id: id++, kind: 'campfire', sub: null, x: cx - 6, y: cy + 1, sx: 0, sy: 0, ql: 40, fuel: 9999, ash: null, lit: true, dmg: null, name: null, material: 'oak',
  litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's',
}];
game.sawGround({ placed, crates: [], lying: [], crops: [], now: Date.now() / 1000, buildings: { nextId: 1, list: [], walls: [], floors: [] } } as unknown as IslandGround, undefined, 'me');

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
/** A person at (x, y), the even ones at work and the odd in a fight, as `animoff-page.ts` makes them. */
const person = (i: number, x: number, y: number): PeerState => {
  const fight = i % 2 === 1, material = METALS[i % METALS.length], job = JOBS[(i >> 1) % JOBS.length];
  return {
    id: 6000 + i, uid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Person ${i}`,
    x, y, dirX: Math.cos(i), dirY: Math.sin(i), level: 0,
    moving: false, swimming: false, working: true, act: fight ? 'attack_creature' : job,
    look: { gender: i % 3 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.5, skin: (i * 0.29) % 1 },
    gear: fight ? { weapon: { id: ARMS[(i >> 1) % ARMS.length], material, enchanted: i % 4 === 1 } } : undefined,
    tool: fight || !TOOLS[job] ? undefined : { id: TOOLS[job], material, enchanted: i % 4 === 0 },
  } as unknown as PeerState;
};
/** Thirty round the body, as `animoff-page.ts`; sixty in the crowd, twelve by five a tile and a half apart, from `CROWD_AT` tiles off. */
const CROWD_AT = 18;
const peers: PeerState[] = [
  ...Array.from({ length: 30 }, (_, i) => person(i, cx - 3.25 + (i % 6) * 1.5, cy - 3.25 + Math.floor(i / 6) * 1.5)),
  ...Array.from({ length: 60 }, (_, j) => person(30 + j, cx + side * (CROWD_AT + (j % 12) * 1.5), cy - 3.25 + Math.floor(j / 12) * 1.5)),
];
peers.push({
  id: 6200, uid: '00000000-0000-4000-8000-000000000200', name: 'Swimmer', x: cx - 1.5, y: cy + 7.5, dirX: 1, dirY: 0, level: 0,
  moving: false, swimming: true, working: false, look: { gender: 'man', hair: HAIRSTYLES[2].id, hairColour: 0.3, hairBright: 0.5, skin: 0.4 },
} as unknown as PeerState);
const WHERE = ['chest', 'head', 'arms', 'legs', 'feet'];
const crowdMid = { x: cx + side * (CROWD_AT + 8.25), y: cy };

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);

export type Scene = 'busy' | 'crowd' | 'pan' | 'zoom';
export interface Measured {
  frames: number;
  /** Real milliseconds a frame: the median, the mean, the ninetieth centile and the longest. */
  median: number;
  mean: number;
  p90: number;
  worst: number;
  /** Bodies drawn afresh a frame (`figureStats`). */
  redraws: number;
  /** Where the renderer has its own measures (`bodyKnobs.stats`): milliseconds a frame on the sculpted bodies, the most in any one frame, and bodies left waiting a frame. */
  bodyMs: number;
  bodyWorst: number;
  deferred: number;
  step: number;
}

/** Tiles a second the `pan` camera sweeps at. */
export const PAN = 20;
/** The zoom over a `zoom` round: eased from one to the next over fifteen frames, held for fifteen. */
const ZOOMS = [3, 1.4, 2];
const zoomAt = (i: number, from: number): number => {
  const leg = Math.floor(i / 30) % ZOOMS.length, k = Math.min(1, (i % 30) / 15), a = leg ? ZOOMS[leg - 1] : from, b = ZOOMS[leg];
  return a + (b - a) * (k * k * (3 - 2 * k));
};

let frame = 0;
let dressed = 0;

/** `n` frames `step` ms of the page's clock apart at `zoom`, with Animations `animations`, the camera as `scene` puts it. */
function frames(n: number, step: number, zoom: number, animations: Animations, scene: Scene): Measured {
  game.settings.animations = animations;
  game.settings.effects = 'all';
  renderer.camera.zoom = zoom;
  const each: number[] = [];
  const r0 = figure.figureStats.redraws, b0 = knobs.bodyKnobs?.stats ? { ...knobs.bodyKnobs.stats } : null;
  let bodyWorst = 0;
  const span = (CROWD_AT + 18) + R;
  for (let i = 0; i < n; i++) {
    driven.tick(step);
    if (i % 15 === 0) {
      game.roster.sawAll(peers);
      game.creatures.sawAll(creatureRows(), game.time);
    }
    peers.forEach((p, j) => {
      if (j % 2 !== 1 || (frame + j * 7) % 30 !== 0) return;
      game.roster.hurt(p.id, Date.now(), WHERE[j % WHERE.length]);
    });
    frame++;
    game.update(step / 1000);
    const h = game.playerHeight();
    if (scene === 'busy') renderer.camera.focus(game.player.x, game.player.y, h, step / 1000);
    else if (scene === 'crowd') renderer.camera.focus(crowdMid.x, crowdMid.y, h, null);
    else if (scene === 'pan') {
      // There and back across the body's people and the crowd: a sweep of `span` tiles each way.
      const go = (i * step * PAN) / 1000, k = go % (2 * span), along = k < span ? k : 2 * span - k;
      renderer.camera.focus(cx - side * R + side * along, cy, h, null);
    } else {
      renderer.camera.focus(crowdMid.x, crowdMid.y, h, null);
      renderer.camera.zoom = zoomAt(i, zoom);
    }
    const s0 = knobs.bodyKnobs?.stats?.ms ?? 0;
    const a = driven.realNow();
    renderer.render(step / 1000);
    canvas.ctx.getImageData(0, 0, 1, 1);
    each.push(driven.realNow() - a);
    bodyWorst = Math.max(bodyWorst, (knobs.bodyKnobs?.stats?.ms ?? 0) - s0);
  }
  renderer.camera.zoom = zoom;
  const sorted = [...each].sort((p, q) => p - q);
  const st = knobs.bodyKnobs?.stats;
  return {
    frames: n, median: sorted[n >> 1], mean: each.reduce((p, q) => p + q, 0) / n, p90: sorted[Math.floor(n * 0.9)], worst: sorted[n - 1],
    redraws: (figure.figureStats.redraws - r0) / n,
    bodyMs: st && b0 ? (st.ms - b0.ms) / n : NaN, bodyWorst: st ? bodyWorst : NaN,
    deferred: st && b0 ? (st.deferred - b0.deferred) / n : NaN, step: st ? st.step : NaN,
  };
}

const ready = loadAllWildermon().then(() => {
  game.roster.sawAll(peers);
  game.creatures.sawAll(creatureRows(), game.time);
  game.teamsFromCreatures();
});

(window as unknown as { bodies: unknown }).bodies = {
  frames, ready,
  shot: (): string => canvasEl.toDataURL('image/png'),
  pin: (step: number | null): void => knobs.bodyKnobs?.pin?.(step),
  /** Everybody dressed afresh (a new shade of hair): new to the view, as a crowd come upon is. */
  fresh: (): void => {
    dressed++;
    for (const p of peers) if (p.look) p.look = { ...p.look, hairColour: (p.look.hairColour + 0.01 * dressed) % 1 };
    game.roster.sawAll(peers);
  },
};
