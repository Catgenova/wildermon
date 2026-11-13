/**
 * The page `actionfx.ts` opens: thirty other people in view on grass and bare rock in the real game and renderer. At work
 * (`window.actionFxScene` 'work', the first): fifteen fighting with a weapon in one hand (`../../src/sculpt/anim/clips/fight.ts`,
 * its sparks) and fifteen mining (`../../src/sculpt/anim/clips/swing.ts`, its chips), each with its own metal, some
 * enchanted. In a fight ('combat'): ten with a one-handed weapon and a shield, metal or wood, taking blows on it; ten with a
 * two-handed weapon (its heavy blow); ten shooting a bow; all in armour of the five classes and none, blows landing on
 * every one of them in turn (`roster.blocked`, `roster.hurt`). On the water ('water'): the sea to the east, twenty
 * swimming in it (ten under way, `../../src/sculpt/anim/clips/swim.ts` SWIM, its splashes; ten treading water, its rings)
 * and ten rowing boats under way, a peer at the oars of each (`../../src/render/fx/rowing.ts`). Bundled for the browser by
 * `actionfx.ts`; the clock is put in before it by the driver.
 */
import { Game } from '../../src/game/game';
import type { PeerState } from '../../src/net/protocol';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { HAIRSTYLES } from '../../src/game/look';
import type { Effects } from '../../src/game/settings';
import { ACTION_SHARE } from '../../src/render/fx/actions';
import { MOST_PARTICLES } from '../../src/render/spells/kit';

interface Driven { tick: (ms: number) => void; realNow: () => number }
const driven = (window as unknown as { driven: Driven }).driven;

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 12;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
// Grass to the west, bare rock to the east: the miners on both.
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, x > cx ? TileType.Rock : TileType.Grass);

const scene = (window as unknown as { actionFxScene?: string }).actionFxScene ?? 'work';
const water = scene === 'water';
// On the water, the sea from a tile east of the body on: deep enough to swim and row in.
if (water) for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx + 1; x <= cx + R + 1; x++) world.setHeight(x, y, -12);

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
game.putBody(cx + 0.5, cy + 0.5, 0);

const WEAPONS = ['sword', 'short_sword', 'hatchet', 'hunting_knife', 'throwing_axe'];
const METALS = ['iron', 'steel', 'copper', 'bronze', 'silver'];
const combat = scene === 'combat';
const HEAVY = ['long_sword', 'maul', 'battle_axe'], BOWS = ['short_bow', 'long_bow'];
/** Armour by class, a piece for every slot, for a fight's bodies in turn; and where blows land, in turn. */
const SETS: Array<Record<string, string>> = [
  { head: 'helm', chest: 'plate_breastplate', shawl: 'plate_shawl', legs: 'plate_legs', feet: 'plate_boots' },
  { head: 'chain_coif', chest: 'chain_hauberk', shawl: 'chain_shawl', legs: 'chain_leggings', feet: 'chain_boots' },
  { head: 'leather_cap', chest: 'leather_jerkin', shawl: 'leather_shawl', legs: 'leather_trousers', feet: 'leather_boots' },
  { head: 'wool_cap', chest: 'cloth_tunic', shawl: 'cloth_shawl', legs: 'cloth_trousers', feet: 'cloth_shoes' },
  { head: 'scale_helm', chest: 'scale_cuirass', shawl: 'scale_shawl', legs: 'scale_leggings', feet: 'scale_boots' },
  {},
];
const WHERE = ['chest', 'head', 'arms', 'legs', 'feet'];
/** A fight's body: its weapon (and shield), its armour. */
function fighter(i: number, material: string): Record<string, unknown> {
  const kind = i % 3, set = SETS[i % SETS.length], gear: Record<string, unknown> = {};
  for (const [slot, id] of Object.entries(set)) gear[slot] = { id, material };
  if (kind === 0) { gear.weapon = { id: WEAPONS[i % WEAPONS.length], material, enchanted: i % 4 === 0 }; gear.offhand = { id: i % 2 ? 'metal_shield' : 'wooden_shield', material: i % 2 ? material : 'oak' }; }
  else if (kind === 1) gear.weapon = { id: HEAVY[i % HEAVY.length], material, enchanted: i % 4 === 1 };
  else gear.weapon = { id: BOWS[i % BOWS.length], material: 'oak', enchanted: i % 4 === 2 };
  return gear;
}
/** Thirty people on a grid of six by five round the body, a tile and a half apart: the odd ones fighting, the even mining. */
const peers: PeerState[] = Array.from({ length: 30 }, (_, i) => {
  const fight = i % 2 === 1, material = METALS[i % METALS.length];
  return {
    id: 6000 + i, uid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Person ${i}`,
    x: cx - 3.25 + (i % 6) * 1.5, y: cy - 3.25 + Math.floor(i / 6) * 1.5, dirX: Math.cos(i), dirY: Math.sin(i), level: 0,
    moving: false, swimming: false, working: true, act: fight || combat ? 'attack_creature' : 'mine',
    look: { gender: i % 3 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.5, skin: (i * 0.29) % 1 },
    gear: combat ? fighter(i, material) : fight ? { weapon: { id: WEAPONS[i % WEAPONS.length], material, enchanted: i % 4 === 1 } } : undefined,
    tool: fight || combat ? undefined : { id: 'pickaxe', material, enchanted: i % 4 === 0 },
  } as unknown as PeerState;
});
/** On the water: twenty swimming on a grid of five by four east of the body (the first ten under way north), and ten at the oars of a rowing boat, under way south. */
const SWIMMERS = 20, ROWERS = 10;
const swimmers: PeerState[] = Array.from({ length: SWIMMERS }, (_, i) => ({
  id: 7000 + i, uid: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`, name: `Swimmer ${i}`,
  x: cx + 2.5 + (i % 5) * 1.4, y: cy - 2.5 + Math.floor(i / 5) * 1.6, dirX: 0, dirY: -1, level: 0,
  moving: i < 10, swimming: true, working: false,
  look: { gender: i % 3 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.5, skin: (i * 0.29) % 1 },
} as unknown as PeerState));
const rowers: PeerState[] = Array.from({ length: ROWERS }, (_, i) => ({
  id: 7100 + i, uid: `00000000-0000-4000-9100-${String(i).padStart(12, '0')}`, name: `Rower ${i}`,
  x: cx + 2.5 + (i % 5) * 2, y: cy + 4 + Math.floor(i / 5) * 2.5, dirX: 0, dirY: 1, level: 0,
  moving: true, swimming: false, working: false,
  look: { gender: i % 2 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.21) % 1, hairBright: 0.5, skin: (i * 0.37) % 1 },
} as unknown as PeerState));
if (water) {
  rowers.forEach((p, i) => {
    const f = { id: 900 + i, x: Math.floor(p.x), y: Math.floor(p.y), sx: 0, sy: 0, facing: 's', kind: 'rowing_boat', ql: 50, items: [], helm: (p as unknown as { uid: string }).uid };
    game.furniture.set(f.id, f as never);
  });
  game.placed.furniture.reset(game.furniture.values());
}
/** Where those under way have got to, a frame on: north for the swimmers, south for the boats, and back to the start after three tiles. */
let gone = 0;
function onTheWater(step: number): PeerState[] {
  gone = (gone + (step / 1000) * 0.6) % 3;
  return [
    ...swimmers.map((p) => (p.moving ? { ...p, y: p.y - gone } : p)),
    ...rowers.map((p) => ({ ...p, y: p.y + gone })),
  ];
}
game.roster.sawAll(water ? onTheWater(0) : peers);

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const fx = renderer.actionFx, parts = renderer.spells.parts;

export interface Measured {
  frames: number;
  /** Real milliseconds a frame: the median and the mean. */
  median: number;
  mean: number;
  /** Effects fired, by kind; particles added and left out for want of room; the most alive at once (spells' and actions'). */
  fired: number;
  byKind: Record<string, number>;
  spawned: number;
  dropped: number;
  most: number;
  /** Alive at the end. */
  alive: number;
}

/** Frames drawn since the page opened, for the fight's blows' turns. */
let frame = 0;

const alive = (): number => {
  let n = 0;
  for (let i = 0; i < parts.span; i++) if (parts.life[i] > 0) n++;
  return n;
};

/**
 * `n` frames `step` ms of the page's clock apart at `zoom`, with Effects `effects`, the processor's GL taken as such or
 * not (`soft`); `ask` effects asked for at the body each frame (`fxAt`), each of `askN` particles.
 */
function frames(n: number, step: number, zoom: number, effects: Effects, soft: boolean, ask = 0, askN = 0): Measured {
  game.settings.effects = effects;
  fx.soft = soft;
  renderer.camera.zoom = zoom;
  const s0 = { ...fx.stats, byKind: { ...fx.stats.byKind } };
  fx.stats.most = 0;
  const each: number[] = [];
  let most = 0;
  for (let i = 0; i < n; i++) {
    driven.tick(step);
    if (water) game.roster.sawAll(onTheWater(step));
    else if (i % 15 === 0) game.roster.sawAll(peers);
    // in a fight, every body takes a blow once a second, its turn of the second its own: on the shield where it has one
    // (every other time), else landing where it lands in turn
    if (combat) peers.forEach((p, j) => {
      const beat = frame + j * 7;
      if (beat % 30 !== 0) return;
      const shield = !!(p.gear as Record<string, unknown> | undefined)?.offhand && (beat / 30) % 2 === 0;
      if (shield) game.roster.blocked(p.id, Date.now());
      else game.roster.hurt(p.id, Date.now(), WHERE[(j + beat / 30) % WHERE.length]);
    });
    frame++;
    game.update(step / 1000);
    for (let j = 0; j < ask; j++) fx.fxAt({ kind: 'player' }, 'sparks', { n: askN });
    renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), step / 1000);
    const a = driven.realNow();
    renderer.render(step / 1000);
    canvas.ctx.getImageData(0, 0, 1, 1);
    each.push(driven.realNow() - a);
    most = Math.max(most, alive());
  }
  const sorted = [...each].sort((p, q) => p - q);
  const byKind: Record<string, number> = {};
  for (const [k, v] of Object.entries(fx.stats.byKind)) byKind[k] = v - (s0.byKind[k] ?? 0);
  return {
    frames: n, median: sorted[n >> 1], mean: each.reduce((p, q) => p + q, 0) / n,
    fired: fx.stats.fired - s0.fired, byKind, spawned: fx.stats.spawned - s0.spawned, dropped: fx.stats.dropped - s0.dropped, most: Math.max(most, fx.stats.most), alive: alive(),
  };
}

/** The pool filled to `n` particles that are not the action effects' (as a spell's would be), each living `secs`. */
function fill(n: number, secs: number): void {
  for (let i = 0; i < n; i++) {
    const s = parts.take(parts.most);
    if (s < 0) return;
    parts.x[s] = cx; parts.y[s] = cy; parts.z[s] = h0 + 10; parts.vx[s] = parts.vy[s] = parts.vz[s] = 0;
    parts.age[s] = 0; parts.life[s] = secs; parts.size[s] = parts.size1[s] = 1; parts.grav[s] = 0; parts.drag[s] = 1; parts.spin[s] = 0; parts.bias[s] = 0;
    parts.kind[s] = 2; parts.flags[s] = 0; parts.colour[s] = parts.colourOf('#ffffff'); parts.fade[s] = 65535;
  }
}

(window as unknown as { actionFx: unknown }).actionFx = { frames, fill, setHour: (h: number) => (hour = h), most: MOST_PARTICLES, share: Math.floor(MOST_PARTICLES * ACTION_SHARE) };
