/**
 * Action effects: what a body's work and blows throw off (sparks off a blade, chips off a pick), drawn where the island
 * draws the body doing it.
 *
 * Two ways in:
 *   - **Marks on the clips** (`../../sculpt/anim/clip.ts` Clip.fx). Every body drawn in a frame is passed through `seen`
 *     (the player and each peer, `Renderer.drawEntities`); at the start of the next frame each body's clip is followed
 *     (`../../sculpt/fxmarks.ts`, in the sculpted bodies' chunk) and each mark its time crossed fires its effect at the
 *     place it names on the body, turned and stood where the body is in the world. The clip's time is the clip player's
 *     own, so every screen fires a peer's at the moment it draws it, with nothing sent.
 *   - **What the island says** (`fxAt`): an effect at a body by who it is (a block, a hit), at a place on it or its middle.
 *
 * The effects themselves are `./registry.ts` ACTION_FX, drawn with `./kit.ts` ActionKit on the spells' stage
 * (`../spells/stage.ts`): its particle pool, its passes and its lights, so a spell and a blow are counted together and
 * the spells come first. The rules each frame:
 *   - **Effects off**: nothing, no hold of time. **Fewer**: `FEWER_SHARE` of the particles, no lights.
 *   - **The pool**: the action effects add particles only while the pool (the spells' included) holds fewer than
 *     `ACTION_SHARE` of its most (`MOST_PARTICLES`, a third on fast graphics): the rest is the spells' alone.
 *   - **Lights**: at most `ACTION_LIGHTS` a frame, after the spells' have been put down, and none for a body further than
 *     `NEAR_TILES` from you.
 *   - **Far off**: a body further than `NEAR_TILES` from you gets `FAR_SHARE` of its particles.
 *   - **Zoomed out** past `SMALL_ZOOM` (`./kit.ts`): bursts marked small left out.
 *   - **The processor's GL** (`glSoftware`): only marks marked `key`.
 *   - **A long frame**: a frame that took longer than `LONG_FRAME` fires nothing new (the marks are still followed).
 *   - **A hold** (`hitStop`): a struck body's clip time held for up to `HIT_STOP_MOST` ms, then caught up over three times
 *     as long; none with Motion reduced or Effects off.
 */
import { sculptFx, sculptSoft, type FigurePose } from '../figure';
import { MOST_PARTICLES, MOST_LIGHTS, rngOf, type Body, type Eye, type P3, type Who } from '../spells/kit';
import type { SpellStage } from '../spells/stage';
import type { Effects } from '../../game/settings';
import { ActionKit, SMALL_ZOOM } from './kit';
import { FxMaterials, type FxWorld } from './material';
import { ACTION_FX, type FxLinger } from './registry';
import type { FxBody, FxEvent, FxFrom, FxPoint } from './types';

/** Of the particle pool, the share the action effects may fill (the spells' particles counted in it). */
export const ACTION_SHARE = 0.4;
/** The particles an effect asks for that are drawn with Effects on Fewer, and for a body far off. */
export const FEWER_SHARE = 0.5;
export const FAR_SHARE = 0.5;
/** Tiles from you within which a body's effects are drawn whole and may light the night. */
export const NEAR_TILES = 12;
/** Lights the action effects may put down in a frame, after the spells'. */
export const ACTION_LIGHTS = 2;
/** Seconds a frame may take before the next fires nothing new. */
export const LONG_FRAME = 1 / 20;
/** The longest a hold of a body's clip time may be, milliseconds, and how many times as long it takes to catch up. */
export const HIT_STOP_MOST = 60;
const CATCH_UP = 3;
/** Effects going on after their first frame, at most. */
const MOST_LINGERS = 64;
/** Effects the island asked for, waiting for the next frame, at most. */
const MOST_ASKED = 32;

/** What the renderer answers for the effects. */
export interface ActionWhere extends FxWorld {
  /** Somebody or something where it stands this frame, as the spells have it; null when gone. */
  body(w: Who): Body | null;
  /** The ground's height under a point, height units. */
  ground(x: number, y: number): number;
}

/** A frame's conditions (`ActionFx.update`). */
export interface ActionEnv {
  eye: Eye;
  now: number;
  dt: number;
  fast: boolean;
  night: number;
  effects: Effects;
  /** Motion reduced (`lessMotion`). */
  calm: boolean;
  /** Where you stand, for how far off a body is. */
  me: { x: number; y: number };
}

/** A body by its id as the figure is drawn with it ('player', 'o' and a peer's id, 'c' and a creature's), and back. */
export const idOfWho = (w: Who): string => (w.kind === 'player' ? 'player' : w.kind === 'peer' ? `o${w.id}` : `c${w.id}`);
export function whoOfId(id: string): Who | null {
  if (id === 'player') return { kind: 'player' };
  const n = Number(id.slice(1));
  if (!Number.isInteger(n)) return null;
  return id[0] === 'o' ? { kind: 'peer', id: n } : id[0] === 'c' ? { kind: 'creature', id: n } : null;
}

/** A seed from a body, a mark and a run of its clip. */
function seedOf(id: string, i: number, run: number): number {
  let h = 2166136261;
  for (let c = 0; c < id.length; c++) h = Math.imul(h ^ id.charCodeAt(c), 16777619);
  h = Math.imul(h ^ (i + 1), 16777619);
  h = Math.imul(h ^ (run & 0xffff), 16777619);
  return (h ^ (run >>> 16)) >>> 0;
}

interface Lingering { e: FxEvent; l: FxLinger; start: number; share: number; lit: boolean }
interface Asked { who: Who; kind: string; params: Readonly<Record<string, number | string | boolean>>; from?: FxFrom }

export class ActionFx {
  readonly k = new ActionKit();
  readonly mat: FxMaterials;
  /** Bodies drawn this frame, by id, for the next frame's update; and those that frame is following. */
  private drawn = new Map<string, FigurePose>();
  private following = new Map<string, FigurePose>();
  private lingers: Lingering[] = [];
  private asked: Asked[] = [];
  /** Holds of a body's clip time, by id: from when on the drawing clock, and how long (seconds). */
  private holds = new Map<string, { at: number; secs: number }>();
  private now = 0;
  private effects: Effects = 'all';
  private calm = false;
  /** Lights put down this frame. */
  private lights = 0;
  /** Whether the GL is taken as the processor's (only `key` marks fire): null as it is (`glSoftware`); set by the tests to measure every effect. */
  soft: boolean | null = null;
  /** What the effects came to, counted from the start (for the tests and the perf page). */
  readonly stats = { fired: 0, skipped: 0, spawned: 0, dropped: 0, most: 0, byKind: {} as Record<string, number> };

  constructor(private readonly stage: SpellStage, private readonly where: ActionWhere) {
    this.mat = new FxMaterials(where);
    const k = this.k;
    k.parts = stage.parts;
    k.out = stage.out;
    k.mat = this.mat;
    k.ground = (x, y) => where.ground(x, y);
    // (a palette for the kit's defaults; every action effect names its own colours)
    k.pal = { core: '#fffaf0', main: '#e8e0d0', deep: '#a89c88', accent: '#ffe7a6', ink: '#3a3038', light: '#fff1d6' };
  }

  /**
   * A body as it is drawn this frame (the pose handed to the figure): kept for the next frame's marks, and returned with
   * its clip time held where a hold is on it (`hitStop`).
   */
  seen(pose: FigurePose): FigurePose {
    const id = pose.id;
    if (!id || this.effects === 'off') return pose;
    const held = this.heldBack(id), out = held > 0 && !pose.moving ? { ...pose, phase: pose.phase - held * 6, ...(pose.act ? { act: { ...pose.act, t: Math.max(0, pose.act.t - held) } } : {}) } : pose;
    this.drawn.set(id, out);
    return out;
  }

  /** Seconds of clip a body is held back by now (`hitStop`). */
  private heldBack(id: string): number {
    const h = this.holds.get(id);
    if (!h) return 0;
    const e = this.now - h.at;
    if (e < 0 || e >= h.secs * (1 + CATCH_UP)) {
      this.holds.delete(id);
      return 0;
    }
    return e < h.secs ? e : h.secs * (1 - (e - h.secs) / (h.secs * CATCH_UP));
  }

  /**
   * Hold a struck body's clip time (and the striker's, called for both) for `ms` milliseconds, at most `HIT_STOP_MOST`,
   * then let it catch up: the weight of a blow. Nothing with Motion reduced or Effects off.
   */
  hitStop(who: Who, ms: number): void {
    if (this.calm || this.effects === 'off' || !(ms > 0)) return;
    this.holds.set(idOfWho(who), { at: this.now, secs: Math.min(HIT_STOP_MOST, ms) / 1000 });
  }

  /**
   * An effect at a body for something the island said (a block, a hit): `kind` an entry of ACTION_FX, at the place
   * `from` names on it as its clip has it now, else at its middle (`params.share` of its height, 0.6 if not given); drawn
   * from the next frame under the same rules as a mark's. False when there is no such effect or effects are off.
   */
  fxAt(who: Who, kind: string, params: Readonly<Record<string, number | string | boolean>> = {}, from?: FxFrom): boolean {
    if (!ACTION_FX[kind] || this.effects === 'off') return false;
    if (this.asked.length >= MOST_ASKED) this.asked.shift();
    this.asked.push({ who, kind, params, ...(from ? { from } : {}) });
    return true;
  }

  /** Drop everything going on (the island reset). */
  clear(): void {
    this.lingers.length = 0;
    this.asked.length = 0;
    this.holds.clear();
    this.drawn.clear();
    this.following.clear();
  }

  /**
   * A frame, after the spells' (`SpellStage.update`), before what they drew is laid out: the marks crossed by the bodies
   * drawn last frame fired, what the island asked for fired, and what goes on drawn again.
   */
  update(env: ActionEnv): void {
    this.now = env.now;
    this.effects = env.effects;
    this.calm = env.calm;
    // what was drawn last frame is followed now; this frame's drawing fills the other
    const was = this.following;
    this.following = this.drawn;
    this.drawn = was;
    this.drawn.clear();
    if (env.effects === 'off') {
      this.lingers.length = 0;
      this.asked.length = 0;
      this.holds.clear();
      return;
    }
    const k = this.k, ps = this.stage.parts;
    k.eye = env.eye;
    k.zoom = env.eye.zoom;
    k.now = env.now;
    k.dt = Math.min(0.1, env.dt);
    k.fast = env.fast;
    k.night = env.night;
    k.mine = false;
    k.small = env.eye.zoom < SMALL_ZOOM;
    const cap = env.fast ? Math.round(MOST_PARTICLES / 3) : MOST_PARTICLES;
    k.partCap = cap;
    // the pool as the spells have left it this frame: room for the action effects up to their share of it
    let alive = 0;
    for (let i = 0; i < ps.span; i++) if (ps.life[i] > 0) alive++;
    k.room = Math.max(0, Math.floor(cap * ACTION_SHARE) - alive);
    this.lights = Math.max(0, Math.min(ACTION_LIGHTS, MOST_LIGHTS - this.stage.out.lights.length));
    k.spawned = k.dropped = 0;
    // what goes on
    let keep = 0;
    for (const g of this.lingers) {
      const u = (env.now - g.start) / g.l.secs;
      if (u >= 1 || u < 0) continue;
      this.lingers[keep++] = g;
      k.rand = rngOf((g.e.seed ^ Math.imul(Math.floor(env.now * 60), 2654435761)) >>> 0);
      this.drawWith(g.e, g.share, g.lit, () => g.l.draw(k, u));
    }
    this.lingers.length = keep;
    // the marks crossed, and what the island asked for
    const fx = sculptFx(), soft = this.soft ?? sculptSoft(), long = env.dt > LONG_FRAME;
    if (fx) for (const [id, pose] of this.following) {
      for (const c of fx.track(id, pose, env.now)) {
        const run = ACTION_FX[c.mark.kind];
        if (!run || long || (soft && !c.mark.key)) { this.stats.skipped++; continue; }
        const who = whoOfId(id), b = who ? this.where.body(who) : null, p = b ? c.point() : null;
        if (!b || !p) { this.stats.skipped++; continue; }
        this.fire(this.eventOf(id, b, pose, p, c.mark.kind, c.mark.params ?? {}, !!c.mark.key, seedOf(id, c.i, c.run)), env);
      }
    }
    for (const a of this.asked) {
      if (long) { this.stats.skipped++; continue; }
      const id = idOfWho(a.who), b = this.where.body(a.who);
      if (!b) { this.stats.skipped++; continue; }
      const pose = this.following.get(id) ?? b.figure, p: FxPoint | null = a.from && pose && fx ? fx.point(pose, a.from) : null;
      const share = typeof a.params.share === 'number' ? a.params.share : 0.6;
      const at: FxPoint = p ?? { at: [0, 0, b.tall * share], way: null };
      this.fire(this.eventOf(id, b, pose, at, a.kind, a.params, true, seedOf(id, 0, Math.floor(env.now * 60))), env);
    }
    this.asked.length = 0;
    this.stats.spawned += k.spawned;
    this.stats.dropped += k.dropped;
    let now = 0;
    for (let i = 0; i < ps.span; i++) if (ps.life[i] > 0) now++;
    if (now > this.stats.most) this.stats.most = now;
  }

  /** An event at a point of a body (its figure's frame) put in the world where the body stands, turned as it is drawn. */
  private eventOf(id: string, b: Body, pose: FigurePose | undefined, p: FxPoint, kind: string, params: Readonly<Record<string, number | string | boolean>>, key: boolean, seed: number): FxEvent {
    // (turned as the sculpted body is drawn: to the nearest of the eight ways, unless sat square along what it sits in)
    const facing = pose ? (pose.seat ? pose.facing : Math.round(pose.facing)) : b.facing;
    const body: FxBody = { x: b.x, y: b.y, z: b.z, facing };
    const turned: Body = { ...b, facing }, k = this.k;
    const at = k.local(turned, p.at[0], p.at[1], p.at[2]);
    let way: P3 | null = null;
    if (p.way) {
      const o = k.local(turned, 0, 0, 0), w = k.local(turned, p.way[0], p.way[1], p.way[2]);
      way = { x: w.x - o.x, y: w.y - o.y, z: w.z - o.z };
    }
    return { kind, who: id, at, way, body, ...(pose ? { pose } : {}), ...(p.held ? { held: p.held } : {}), params, mine: id === 'player', key, seed };
  }

  /** Fire an event's effect now, under the frame's rules. */
  private fire(e: FxEvent, env: ActionEnv): void {
    const run = ACTION_FX[e.kind];
    if (!run) return;
    const near = e.mine || Math.hypot(e.body.x - env.me.x, e.body.y - env.me.y) <= NEAR_TILES;
    const share = (env.effects === 'fewer' ? FEWER_SHARE : 1) * (near ? 1 : FAR_SHARE), lit = env.effects === 'all' && near;
    this.k.rand = rngOf(e.seed);
    this.stats.fired++;
    this.stats.byKind[e.kind] = (this.stats.byKind[e.kind] ?? 0) + 1;
    const l = this.drawWith(e, share, lit, () => run(e, this.k));
    if (l && l.secs > 0 && this.lingers.length < MOST_LINGERS) this.lingers.push({ e, l, start: env.now, share, lit });
  }

  /** Draw with the kit made ready for an event (its level of detail, its light if any is left), the lights it put down counted. */
  private drawWith<T>(e: FxEvent, share: number, lit: boolean, draw: () => T): T {
    const k = this.k, lights = this.stage.out.lights;
    k.ev = e;
    k.mine = e.mine;
    k.share = share;
    k.lit = lit && this.lights > 0;
    k.lightsLeft = k.lit ? 1 : 0;
    const before = lights.length, out = draw();
    this.lights -= lights.length - before;
    return out;
  }
}
