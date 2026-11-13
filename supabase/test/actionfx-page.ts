/**
 * The page `actionfx.ts` opens: thirty other people in view on grass and bare rock, fifteen fighting with a weapon in one
 * hand (`../../src/sculpt/anim/clips/fight.ts`, its sparks) and fifteen mining (`../../src/sculpt/anim/clips/swing.ts`, its
 * chips), each with its own metal, some enchanted, in the real game and renderer. Bundled for the browser by
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
/** Thirty people on a grid of six by five round the body, a tile and a half apart: the odd ones fighting, the even mining. */
const peers: PeerState[] = Array.from({ length: 30 }, (_, i) => {
  const fight = i % 2 === 1, material = METALS[i % METALS.length];
  return {
    id: 6000 + i, uid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Person ${i}`,
    x: cx - 3.25 + (i % 6) * 1.5, y: cy - 3.25 + Math.floor(i / 6) * 1.5, dirX: Math.cos(i), dirY: Math.sin(i), level: 0,
    moving: false, swimming: false, working: true, act: fight ? 'attack_creature' : 'mine',
    look: { gender: i % 3 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.137) % 1, hairBright: 0.5, skin: (i * 0.29) % 1 },
    gear: fight ? { weapon: { id: WEAPONS[i % WEAPONS.length], material, enchanted: i % 4 === 1 } } : undefined,
    tool: fight ? undefined : { id: 'pickaxe', material, enchanted: i % 4 === 0 },
  } as unknown as PeerState;
});
game.roster.sawAll(peers);

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
    if (i % 15 === 0) game.roster.sawAll(peers);
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
