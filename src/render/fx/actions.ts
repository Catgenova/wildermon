/**
 * Action effects: what a body's work and blows throw off (sparks off a blade, chips off a pick), drawn where the island
 * draws the body doing it.
 *
 * Three ways in:
 *   - **Marks on the clips** (`../../sculpt/anim/clip.ts` Clip.fx). Every body drawn in a frame is passed through `seen`
 *     (the player and each peer, `Renderer.drawEntities`); at the start of the next frame each body's clip is followed
 *     (`../../sculpt/fxmarks.ts`, in the sculpted bodies' chunk) and each mark its time crossed fires its effect at the
 *     place it names on the body, turned and stood where the body is in the world. The clip's time is the clip player's
 *     own, so every screen fires a peer's at the moment it draws it, with nothing sent.
 *   - **What the island says** (`fxAt`): an effect at a body by who it is (a block, a hit), at a place on it or its middle.
 *   - **Followed frame by frame** (`FxFollower`): what goes on with a body beside its marks, from the same pose: an oar's
 *     stroke (`./rowing.ts`), a fishing line out and what the island says came of your own go (`./fishing.ts`, `told`);
 *     and a swimmer under way's wake (`ActionWhere.wake`).
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
import { sculptFx, sculptSoft, treadRingsByFx, type FigurePose } from '../figure';
import { MOST_PARTICLES, MOST_LIGHTS, rngOf, type Body, type Eye, type P3, type Who } from '../spells/kit';
import { UNITS_PER_TILE } from '../iso';
import type { SpellStage } from '../spells/stage';
import type { Effects } from '../../game/settings';
import { ActionKit, SMALL_ZOOM } from './kit';
import { FxMaterials, type FxWorld } from './material';
import { ACTION_FX, type FxLinger } from './registry';
import type { FollowFrame, FxBody, FxEvent, FxFollower, FxFrom, FxMark, FxPoint, V3 } from './types';
import { Rowing } from './rowing';
import { Fishing } from './fishing';
import { BLOCK_SECS, FLINCH_SECS } from '../../game/fight';
import { BLOCK_IMPACT } from '../../sculpt/anim/clips/block';
import { FLINCH_SNAP } from '../../sculpt/anim/clips/flinch';

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
/** The hold of a heavy blow (a two-handed weapon's), milliseconds: the striker's and the struck's. */
export const HIT_STOP_HEAVY = 50;
const CATCH_UP = 3;
/** Seconds either side of a heavy blow within which a blow landing near it is the same blow, and both are held; and tiles near. */
export const HEAVY_WINDOW = 0.15;
const HEAVY_NEAR = 3;
/** Where a block's blow lands in it, and a flinch's snap, as shares of their lengths (`FigurePose.block`, `flinch.t`). */
const BLOCK_AT = BLOCK_IMPACT / BLOCK_SECS, FLINCH_AT = FLINCH_SNAP / FLINCH_SECS;
/** Past the moment, how far into a block or a flinch first seen still fires it (a body come into view mid-way does not). */
const LATE = 0.25;
/** Where a blow landing is put, by where it landed: the bone (its side for a limb, `s`), and how far out toward the blow, tenths of a metre. */
const LANDS: Readonly<Record<string, { bone: string; out: number }>> = {
  head: { bone: 'head', out: 1.3 }, chest: { bone: 'spine_03', out: 2 }, arms: { bone: 'lowerarm_s', out: 0.8 }, legs: { bone: 'calf_s', out: 0.9 }, feet: { bone: 'foot_s', out: 0.9 },
};
/** Tiles ahead of a blocker a Deflect's streak goes to where what struck is not known, and how high, height units. */
const DEFLECT_AHEAD = 1.2, DEFLECT_UP = 10;
/** Effects going on after their first frame, at most. */
const MOST_LINGERS = 64;
/** Effects the island asked for, waiting for the next frame, at most. */
const MOST_ASKED = 32;

/** What the renderer answers for the effects. */
export interface ActionWhere extends FxWorld {
  /** Somebody or something where it stands this frame, as the spells have it; null when gone. */
  body(w: Who): Body | null;
  /** Whether somebody holds Deflect now (a blow they block lands back): known for you alone. */
  deflect(w: Who): boolean;
  /** Where what somebody is fighting is (its middle), when known. */
  foe(w: Who): P3 | null;
  /** The ground's height under a point, height units. */
  ground(x: number, y: number): number;
  /** The water's surface under a point as it is drawn, height units, or null where there is none. */
  water(x: number, y: number): number | null;
  /** Where somebody fishing casts to, as the island finds it (`castAt`): known for you alone. */
  cast(w: Who): { x: number; y: number } | null;
  /** A swimmer under way at a point this frame, for the wake behind them (`../wake.ts` Wakes). */
  wake(id: string, x: number, y: number): void;
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

/** A mark's point put on the water (`params.surface`): at the figure's level nought, where a swimmer's water is drawn. */
function surfaced(p: FxPoint | null, params: FxMark['params']): FxPoint | null {
  return p && params?.surface === true ? { ...p, at: [p.at[0], p.at[1], 0] } : p;
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
  /** Where a body was drawn this frame when that is not where it stands (sat in a boat: `seen`), and last frame's. */
  private placed = new Map<string, P3>();
  private wasPlaced = new Map<string, P3>();
  /** What is followed on a body beside its marks: an oar's stroke, a line out. */
  private readonly rowing = new Rowing();
  private readonly fishing: Fishing;
  private readonly followers: FxFollower[];
  private lingers: Lingering[] = [];
  private asked: Asked[] = [];
  /** Each body's block and flinch last frame (`FigurePose.block`, `flinch.t`), to fire their moments as they are passed. */
  private overlays = new Map<string, { block?: number; flinch?: number }>();
  /** Heavy blows and blows landing lately: who, where, when on the drawing clock (`HEAVY_WINDOW`). */
  private heavies: Array<{ id: string; x: number; y: number; at: number }> = [];
  private landed: Array<{ id: string; x: number; y: number; at: number }> = [];
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
    this.fishing = new Fishing((id) => { const w = whoOfId(id); return w ? where.cast(w) : null; });
    this.followers = [this.rowing, this.fishing];
    const k = this.k;
    k.water = (x, y) => where.water(x, y);
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
  seen(pose: FigurePose, at?: P3): FigurePose {
    const id = pose.id;
    if (!id || this.effects === 'off') return pose;
    const held = this.heldBack(id), was = held > 0 && !pose.moving ? { ...pose, phase: pose.phase - held * 6, ...(pose.act ? { act: { ...pose.act, t: Math.max(0, pose.act.t - held) } } : {}) } : pose;
    // (a rod's line drawn here while it is out: `./fishing.ts`)
    const out = pose.working ? { ...was, line: true } : was;
    this.drawn.set(id, out);
    if (at) this.placed.set(id, at);
    return out;
  }

  /** What the island said of your own go (a log line): a fish caught is brought out at the float (`./fishing.ts`). */
  told(text: string): void {
    if (this.effects !== 'off' && text.startsWith('Caught:')) this.fishing.caught('player');
  }

  /** Where a body is this frame: where it stands, or where it was drawn (sat in a boat, `seen`). */
  private bodyOf(id: string, who: Who): Body | null {
    const b = this.where.body(who), at = this.wasPlaced.get(id);
    return b && at ? { ...b, x: at.x, y: at.y, z: at.z } : b;
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
    this.holdId(idOfWho(who), ms);
  }
  private holdId(id: string, ms: number): void {
    if (this.calm || this.effects === 'off' || !(ms > 0) || this.holds.has(id)) return;
    this.holds.set(id, { at: this.now, secs: Math.min(HIT_STOP_MOST, ms) / 1000 });
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
    this.placed.clear();
    this.wasPlaced.clear();
    for (const f of this.followers) f.clear();
    this.overlays.clear();
    this.heavies.length = this.landed.length = 0;
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
    const at = this.wasPlaced;
    this.wasPlaced = this.placed;
    this.placed = at;
    this.placed.clear();
    if (env.effects === 'off') {
      treadRingsByFx(false);
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
    // the rings off a hand treading water are the marks' (`../../sculpt/anim/clips/swim.ts` TREAD) while there are marks
    treadRingsByFx(!!fx);
    if (fx) for (const [id, pose] of this.following) {
      for (const c of fx.track(id, pose, env.now)) {
        const run = ACTION_FX[c.mark.kind];
        if (!run || long || (soft && !c.mark.key)) { this.stats.skipped++; continue; }
        const who = whoOfId(id), b = who ? this.bodyOf(id, who) : null, p = b ? surfaced(c.point(), c.mark.params) : null;
        if (!b || !p) { this.stats.skipped++; continue; }
        this.fire(this.eventOf(id, b, pose, p, c.mark.kind, c.mark.params ?? {}, !!c.mark.key, seedOf(id, c.i, c.run)), env);
      }
    }
    // what is followed beside the marks: oars, a line out; and a swimmer's wake
    if (fx) for (const [id, pose] of this.following) {
      const who = whoOfId(id), b = who ? this.bodyOf(id, who) : null;
      if (!b) continue;
      if (pose.swimming && pose.moving && id !== 'player') this.where.wake(id, b.x, b.y);
      const f = this.followOf(id, pose, b, fx, soft, long, env);
      for (const w of this.followers) w.follow(f);
    }
    // a blow on a shield, a blow landing: laid over the clips, fired at their moments
    if (fx) this.overlaysOf(fx, long, env);
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

  /** A body as a follower sees it this frame (`FollowFrame`). */
  private followOf(id: string, pose: FigurePose, b: Body, fx: NonNullable<ReturnType<typeof sculptFx>>, soft: boolean, long: boolean, env: ActionEnv): FollowFrame {
    const facing = pose.seat ? pose.facing : Math.round(pose.facing), turned: Body = { ...b, facing }, k = this.k;
    const body: FxBody = { x: b.x, y: b.y, z: b.z, facing };
    return {
      id, pose, body: turned, fx, now: env.now, dt: env.dt, night: env.night,
      local: (p) => k.local(turned, p[0], p[1], p[2]),
      water: (x, y) => this.where.water(x, y),
      fire: (kind, at, o = {}) => {
        if (!ACTION_FX[kind] || long || (soft && !o.key)) { this.stats.skipped++; return; }
        this.fire({ kind, who: id, at, way: o.way ?? null, body, ...(o.to ? { to: o.to } : {}), pose, params: o.params ?? {}, mine: id === 'player', key: !!o.key, seed: seedOf(id, 200, o.seed ?? Math.floor(env.now * 60)) }, env);
      },
      draw: (fn) => {
        const e: FxEvent = { kind: '', who: id, at: { x: b.x, y: b.y, z: b.z }, way: null, body, pose, params: {}, mine: id === 'player', key: true, seed: 0 };
        this.drawWith(e, 1, false, () => fn(k));
      },
    };
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
    const to = p.to ? k.local(turned, p.to[0], p.to[1], p.to[2]) : undefined;
    return { kind, who: id, at, way, body, ...(to ? { to } : {}), ...(pose ? { pose } : {}), ...(p.held ? { held: p.held } : {}), params, mine: id === 'player', key, seed };
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
    // a blow that holds (`params.stop`): the striker held `HIT_STOP_HEAVY`, and whoever a blow landed on near it within the window
    if (e.params.stop === true && e.pose?.job === 'attack_creature') {
      const stop = HIT_STOP_HEAVY;
      this.holdId(e.who, stop);
      this.heavies.push({ id: e.who, x: e.at.x, y: e.at.y, at: env.now });
      for (const h of this.landed) if (Math.abs(h.at - env.now) <= HEAVY_WINDOW && Math.hypot(h.x - e.at.x, h.y - e.at.y) <= HEAVY_NEAR) this.holdId(h.id, stop);
    }
  }

  /** The blocks and blows landing the bodies drawn last frame passed (their moments: `BLOCK_AT`, `FLINCH_AT`), fired. */
  private overlaysOf(fx: NonNullable<ReturnType<typeof sculptFx>>, long: boolean, env: ActionEnv): void {
    const now = env.now;
    this.heavies = this.heavies.filter((h) => now - h.at <= HEAVY_WINDOW);
    this.landed = this.landed.filter((h) => now - h.at <= HEAVY_WINDOW);
    for (const [id, pose] of this.following) {
      const was = this.overlays.get(id), u = pose.block, f = pose.flinch?.t;
      if (u === undefined && f === undefined) { if (was) this.overlays.delete(id); continue; }
      this.overlays.set(id, { block: u, flinch: f });
      const passed = (prev: number | undefined, cur: number | undefined, at: number): boolean =>
        cur !== undefined && cur >= at && (prev === undefined ? cur < at + LATE : prev < at && cur - prev < 0.5);
      const who = whoOfId(id), b = who ? this.where.body(who) : null;
      if (!who || !b) continue;
      if (passed(was?.block, u, BLOCK_AT) && pose.gear?.offhand) {
        if (long) { this.stats.skipped++; continue; }
        const p = fx.pointOver(pose, { shield: 'face' });
        if (!p) { this.stats.skipped++; continue; }
        const deflect = this.where.deflect(who);
        let to: P3 | undefined;
        if (deflect) {
          to = this.where.foe(who) ?? undefined;
          if (!to) { const ahead = this.eventOf(id, b, pose, { at: [0, DEFLECT_AHEAD * UNITS_PER_TILE, DEFLECT_UP], way: null }, 'block', {}, true, 0).at; to = ahead; }
        }
        this.fire({ ...this.eventOf(id, b, pose, p, 'block', { deflect }, true, seedOf(id, 101, Math.floor(now * 10))), ...(to ? { to } : {}) }, env);
      }
      if (passed(was?.flinch, f, FLINCH_AT)) {
        const fl = pose.flinch as NonNullable<FigurePose['flinch']>;
        this.landed.push({ id, x: b.x, y: b.y, at: now });
        for (const h of this.heavies) if (Math.hypot(h.x - b.x, h.y - b.y) <= HEAVY_NEAR) { this.holdId(id, HIT_STOP_HEAVY); break; }
        if (long) { this.stats.skipped++; continue; }
        // where it landed, on the side it came from: the bone, out toward the blow
        const where = fl.where && LANDS[fl.where] ? fl.where : 'chest', land = LANDS[where], a = fl.from ?? 0;
        const side = Math.sin(a) > 0 ? 'l' : 'r', p = fx.pointOver(pose, { bone: land.bone.replace(/_s$/, `_${side}`) });
        if (!p) { this.stats.skipped++; continue; }
        const out: V3 = [-Math.sin(a), Math.cos(a), 0];
        const at: FxPoint = { at: [p.at[0] + out[0] * land.out, p.at[1] + out[1] * land.out, p.at[2]], way: out };
        this.fire(this.eventOf(id, b, pose, at, 'hit', { where }, true, seedOf(id, 102, Math.floor(now * 10))), env);
      }
    }
    if (this.overlays.size > 256) this.overlays.delete(this.overlays.keys().next().value as string);
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
