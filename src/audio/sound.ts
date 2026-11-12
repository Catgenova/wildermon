import type { Game } from '../game/game';
import { TileType, stepsTimber } from '../world/tiles';
import { MATERIAL_BY_ID } from '../game/building';
import { BRIDGES } from '../game/bridges';
import { blow, chime, footfall, stroke, type Footing, type Stroke } from './kit';
import { voiceOf } from './voices';
import { stageOf } from '../game/creatures';

/**
 * What the game sounds like from where the camera is standing.
 *
 * Two jobs, and they are separate on purpose. The kit says what a thing
 * sounds like; this says how loud it is and which ear it is in, which is a
 * question about the view rather than about the thing.
 *
 * The rule is the one the picture already uses. The camera is the ear: it
 * detaches from the player when you drag it, and when it does, what you hear
 * goes with it rather than staying behind with your body. So a smelter you
 * have walked away from goes quiet, and a smelter you have merely *looked*
 * away from goes quiet too, which is right — you have taken the view
 * somewhere else and the view is where you are attending.
 *
 * Both numbers come off the screen rather than out of the world, which also
 * gets the zoom for free: pull the camera back and the whole island gets
 * further away and quieter together, instead of the ground shrinking while a
 * hammer two hundred tiles off stays at full volume.
 */

/** Enough of a camera to place a sound: everything here is read, nothing set. */
export interface Ear {
  width: number;
  height: number;
  worldToScreenX(wx: number, wy: number): number;
  worldToScreenY(wx: number, wy: number, h: number): number;
}

/**
 * How far off the middle of the screen a sound can be before it is not worth
 * starting, measured in half-screens. Past two the gain is under a fortieth
 * and the voice is a node allocated to play silence.
 */
const EARSHOT = 2.4;

/** Voices allowed to start in one window, so a herd cannot deafen anybody. */
const VOICE_CAP = 10;
const VOICE_WINDOW = 0.12;

/** Tiles between one footfall and the next. The dust uses the same stride. */
const STRIDE = 0.58;

/** The player's own feet, and where a peer's sit, in the one keyed-by-number table. */
const EARS_PLAYER = -1;
const EARS_PEER = -2;
/** Pairs of feet held before the stale ones are swept, and how stale is stale. */
const FEET_KEEP = 256;
const FEET_STALE = 600;

/** What each kind of ground sounds like underfoot. */
export const FOOTINGS: Partial<Record<number, Footing>> = {
  [TileType.Grass]: 'soft',
  [TileType.Lawn]: 'soft',
  [TileType.Moss]: 'soft',
  [TileType.Steppe]: 'soft',
  [TileType.Tundra]: 'soft',
  [TileType.Field]: 'soft',
  [TileType.Kelp]: 'soft',
  [TileType.Reed]: 'soft',
  [TileType.Bush]: 'soft',
  [TileType.Tree]: 'soft',
  [TileType.Stump]: 'soft',
  [TileType.Sand]: 'grit',
  [TileType.Dirt]: 'grit',
  [TileType.PackedDirt]: 'grit',
  [TileType.Trail]: 'grit',
  [TileType.Clay]: 'grit',
  [TileType.Peat]: 'grit',
  [TileType.Tar]: 'grit',
  [TileType.Rock]: 'stone',
  [TileType.Cobblestone]: 'stone',
  [TileType.Slabs]: 'stone',
  [TileType.Steps]: 'stone',
  [TileType.SteppingStones]: 'stone',
  [TileType.Snow]: 'snow',
  [TileType.Marsh]: 'water',
};

/**
 * What is under this pair of boots.
 *
 * A deck beats the ground under it, because a deck is what the foot is
 * actually on: a plank bridge over a river sounds like planks, and the river
 * is not consulted. Below that, water beats everything, and then it is
 * whatever the tile is made of.
 */
export function footingAt(g: Game, x: number, y: number, level: number): Footing {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const floor = level > 0 || g.buildings.buildingAt(tx, ty) ? g.buildings.floor(level, tx, ty) : null;
  if (floor) return MATERIAL_BY_ID.get(floor.material)?.kind === 'stone' ? 'stone' : 'wood';
  const bridge = g.bridgeAt(tx, ty);
  // Under an aqueduct the feet are on the ground: nobody walks its deck.
  if (bridge && bridge.kind !== 'aqueduct') return BRIDGES[bridge.kind]?.stone ? 'stone' : 'wood';
  // Stepping stones are stepped on, not waded through, whatever water is round them.
  if (g.world.stonesAt(tx, ty)) return 'stone';
  if (g.world.hasWater(tx, ty) && g.world.heightAt(x, y) < g.world.surfaceAt(tx, ty)) return 'water';
  const tile = g.world.viewTile(tx, ty, true);
  // A flight of timber steps is boards underfoot, not stone.
  if (tile === TileType.Steps && stepsTimber(g.world.getData(tx, ty))) return 'wood';
  return FOOTINGS[tile] ?? 'soft';
}

// What a go at a job sounds like lives in the leaf (`strokes.ts`), so the rules can ask it without the mixer.
export { HUSHED, isWork, STROKE_BY_ID, strokeOf } from './strokes';

/**
 * Where a point on the island lands in the mix: which ear, and how loud.
 *
 * Both off the screen rather than out of the world, which is what makes the
 * camera the ear. Null when it is too far off the view to be worth a voice —
 * and that is a real saving rather than a tidiness: a herd of forty grazers
 * over the next hill would otherwise be forty nodes a second built to play
 * something nobody can hear.
 */
export function mixAt(ear: Ear, wx: number, wy: number, h: number): { pan: number; gain: number } | null {
  const dx = (ear.worldToScreenX(wx, wy) - ear.width / 2) / (ear.width / 2);
  const dy = (ear.worldToScreenY(wx, wy, h) - ear.height / 2) / (ear.height / 2);
  const d = Math.hypot(dx, dy);
  if (!(d <= EARSHOT)) return null;
  return { pan: Math.max(-1, Math.min(1, dx)), gain: 1 / (1 + d * d * 2.2) };
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /**
   * Where each pair of feet last put one down, for working out when the next
   * step lands. Keyed by a number — the player is -1, a peer is below that,
   * a creature is its own id — because this is asked of everything walking on
   * the island on every frame, and `'c' + id` was a string apiece for all of
   * them. Stamped, so pairs of feet that have walked out of the world can be
   * swept rather than kept for the session.
   */
  private feet = new Map<number, { x: number; y: number; at: number }>();
  /** How many frames since the last sweep of the above. */
  private swept = 0;
  private started: number[] = [];
  private levels = new Map<string, number>();
  private vary = 0;

  constructor(private readonly game: Game, private readonly ear: Ear) {
    this.listen();
  }

  /**
   * Start the audio, which a browser will only do off the back of something
   * the person did. Safe to call on every click for ever: the second call
   * onwards is a comparison and a return.
   */
  arm(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WithLegacy = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (globalThis as WithLegacy).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  /** The audio context once armed, for the soundtrack (`music/music.ts`) to play through as well. */
  get audio(): AudioContext | null {
    return this.ctx;
  }

  get volume(): number {
    return Math.max(0, Math.min(1, this.game.settings.volume));
  }

  set volume(v: number) {
    this.game.settings.volume = Math.max(0, Math.min(1, v));
  }

  /**
   * Where to put a sound that is happening at a point on the island, or null
   * when it is happening too far off the view to be worth a voice.
   *
   * Pan is how far off the middle of the screen it is; gain falls away with
   * the square of the distance, which is what an inverse square law comes to
   * once the screen rather than the world is doing the measuring.
   */
  private place(wx: number, wy: number): { node: AudioNode; at: number } | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.volume <= 0) return null;
    // The setting is the one true answer and this follows it, rather than
    // being told when it changes. It costs a comparison per sound and it
    // means the slider — or a console, or anything else — needs no wire back
    // to here at all.
    if (master.gain.value !== this.volume) master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.02);
    const at = mixAt(this.ear, wx, wy, this.game.world.heightAt(wx, wy));
    if (!at) return null;
    const now = ctx.currentTime;
    // The cap is on voices *started*, not playing, so a long sound never
    // blocks a short one and the count clears itself.
    while (this.started.length && now - this.started[0] > VOICE_WINDOW) this.started.shift();
    if (this.started.length >= VOICE_CAP) return null;
    this.started.push(now);
    const gain = ctx.createGain();
    gain.gain.value = at.gain;
    // A browser without a panner is a browser that gets the sound in both
    // ears, which is worse than stereo and much better than nothing.
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = at.pan;
      gain.connect(pan).connect(master);
    } else {
      gain.connect(master);
    }
    return { node: gain, at: now };
  }

  /** Two pieces of the interface joined edge to edge (`WindowManager.onJoin`): a short click, in both ears, at the volume setting. */
  join(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.volume <= 0) return;
    if (master.gain.value !== this.volume) master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.02);
    const t = ctx.currentTime, o = ctx.createOscillator(), v = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    v.gain.setValueAtTime(0.08, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(v).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** A number that wanders about between 0 and 1, so nothing repeats exactly. */
  private next(): number {
    this.vary = (this.vary * 1103515245 + 12345) % 2147483648;
    return this.vary / 2147483648;
  }

  /**
   * Footfalls, worked out from ground covered rather than from a walk cycle,
   * which is the same rule the dust uses and for the same reason: something
   * that stops walking should stop making the noise, and something being
   * dragged along by a cart should make it.
   */
  step(): void {
    if (!this.ctx || this.volume <= 0) return;
    const g = this.game;
    const ear = this.ear;
    const now = ++this.swept;
    /*
     * Out of earshot before anything else is asked.
     *
     * This runs on every frame for every creature on the island, and on a live
     * one that is every creature the island has told us about — hundreds of
     * them, nearly all of them nowhere near the screen. It was doing a string
     * concat, a map lookup and a square root for each, to reach `place` and be
     * told the sound was inaudible. The same question, asked first, is two
     * multiplications: `mixAt` measures in half-screens from the middle, so
     * anything more than `EARSHOT` of them away can never make a sound.
     */
    const halfW = ear.width / 2;
    const halfH = ear.height / 2;
    const heard = (x: number, y: number): boolean => {
      const dx = (ear.worldToScreenX(x, y) - halfW) / halfW;
      if (dx < -EARSHOT || dx > EARSHOT) return false;
      const dy = (ear.worldToScreenY(x, y, 0) - halfH) / halfH;
      return dy >= -EARSHOT && dy <= EARSHOT;
    };
    const foot = (id: number, x: number, y: number, level: number): void => {
      const last = this.feet.get(id);
      if (!last) {
        this.feet.set(id, { x, y, at: now });
        return;
      }
      last.at = now;
      if (Math.hypot(last.x - x, last.y - y) < STRIDE) return;
      last.x = x;
      last.y = y;
      const put = this.place(x, y);
      if (!put) return;
      footfall(this.ctx!, put.node, put.at, footingAt(g, x, y, level), this.next());
    };
    const p = g.player;
    foot(EARS_PLAYER, p.x, p.y, p.level);
    for (const cr of g.creatures.list.values()) {
      if (!heard(cr.x, cr.y)) continue;
      // Its voice fetched while it is in earshot, so it is in before it acts.
      voiceOf(cr.species);
      foot(cr.id, cr.x, cr.y, 0);
    }
    for (const other of g.roster.list()) {
      if (heard(other.x, other.y)) foot(EARS_PEER - other.id, other.x, other.y, other.level);
    }
    // And the pairs of feet nobody has heard in a while, which otherwise pile
    // up for as long as the tab is open.
    if (this.feet.size > FEET_KEEP) {
      for (const [id, was] of this.feet) if (now - was.at > FEET_STALE) this.feet.delete(id);
    }
  }

  private say(wx: number, wy: number, play: (ctx: AudioContext, node: AudioNode, at: number) => void): void {
    const put = this.place(wx, wy);
    if (!put || !this.ctx) return;
    play(this.ctx, put.node, put.at);
  }

  /** The three notes, which come from nowhere in particular and so are not placed. */
  private note(kind: 'skill' | 'goal' | 'no'): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.volume <= 0) return;
    chime(ctx, master, ctx.currentTime, kind);
  }

  private listen(): void {
    const g = this.game;
    g.events.on('work', (x, y, kind) => this.say(x, y, (ctx, node, at) => stroke(ctx, node, at, kind as Stroke, this.next())));
    g.events.on('hit', (x, y, _amount, kind) => this.say(x, y, (ctx, node, at) => blow(ctx, node, at, kind === 'taken', this.next())));
    // A wildermon's own voice, for each act it has a sound for (`voiceOf`), at the stage it is at.
    g.events.on('beast', (id, act) => {
      const c = g.creatures.get(id);
      const cue = c && voiceOf(c.species)?.[act];
      if (c && cue) this.say(c.x, c.y, (ctx, node, at) => cue(ctx, node, at, stageOf(c), this.next()));
    });
    // A skill speaks when its whole number changes, which is the same rule
    // the log already uses for a characteristic. Anything else would be a
    // note every two seconds for an entire evening.
    g.events.on('skill', (id) => {
      const now = Math.floor(g.skills.get(id));
      const was = this.levels.get(id);
      this.levels.set(id, now);
      if (was !== undefined && now > was) this.note('skill');
    });
    g.events.on('journal', () => this.note('goal'));
    g.events.on('log', (entry) => {
      if (entry.kind === 'error') this.note('no');
    });
    g.events.on('reset', () => {
      this.feet.clear();
      this.levels.clear();
    });
  }
}
