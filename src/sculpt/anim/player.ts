/**
 * The clip player: samples clips (`./clip.ts`) on a body's skeleton (`./skeleton.ts`), crossfades from one to the next,
 * lays an upper-body clip over the legs' and additive clips on top, time-scales a loop or a one-shot to an action's
 * length, keeps a walk's or a run's phase matched to the speed, and adds the procedural layer: breathing, looking,
 * the arms kept off the body and the feet planted.
 *
 * `poseAt` samples one clip at a time with nothing kept between frames, which is all a loop such as the idle needs; a
 * `ClipPlayer` keeps the layers and their fades for a body drawn frame after frame.
 */
import { UPPER, eventsBetween, fitTime, gripAt, runsOf, sampleClip, sampleFeet, stanceOf, strideOf, wrap, type Clip } from './clip';
import type { Foot } from './clip';
import { QI, add, qmat, qmul, quat, scl, slerp, type M3, type Q, type V } from './math';
import type { Held, Plant, Pose, Skeleton } from './skeleton';

/** A clip's pose at time t on a skeleton: its turns and shift with the body's corrections, its breathing added. */
export function poseAt(sk: Skeleton, c: Clip, t: number, o: { breath?: boolean } = {}): Pose {
  const s = sampleClip(c, t, sk.body);
  const pose = poseOf(sk, s.rot, s.move);
  if (c.breath && o.breath !== false) addPose(pose, breathe(sk, (wrap(c, t) / c.length) * c.breath.count, c.breath.depth), 1);
  return pose;
}
/** Turns in the man's bone frames and a shift in body heights, as a pose of this body. */
function poseOf(sk: Skeleton, rot: Record<string, [number, number, number]>, move: [number, number, number]): Pose {
  const q: Array<Q | undefined> = [];
  for (const [bone, e] of Object.entries(rot)) { const i = sk.at.get(bone); if (i !== undefined) q[i] = sk.local(i, e); }
  return { q, move: scl(move, sk.height) };
}

/** Where a clip that plants its feet stands them, for a body (kept: the same clip, the same place). */
const PLANTS = new WeakMap<Clip, Map<Skeleton, Plant>>();
export function plantOf(sk: Skeleton, c: Clip): Plant | undefined {
  const st = stanceOf(c, sk.body);
  if (!st) return undefined;
  let m = PLANTS.get(c);
  if (!m) PLANTS.set(c, (m = new Map()));
  let p = m.get(sk);
  if (!p) m.set(sk, (p = sk.plantOf(poseOf(sk, st.rot, st.move))));
  return p;
}

/**
 * Where a clip stands a body's feet at time t: its stance, or for a clip that keys its feet (`Clip.feet`) where they are
 * keyed from it, over the body's stride.
 */
export function plantAt(sk: Skeleton, c: Clip, t: number): Plant | undefined {
  const base = plantOf(sk, c), feet = sampleFeet(c, t, sk.body);
  if (!base || !feet) return base;
  return sk.step(base, feet, strideOf(c, sk.body), c.bodies?.[sk.body]?.feet?.in);
}

/** A clip at time t on a body, finished: the local turns its draw wants and the body's shift; `held`, what is in both hands. */
export function clipLocal(sk: Skeleton, c: Clip, t: number, held?: Held): { local: Array<M3 | undefined>; move: V } {
  return sk.finish(poseAt(sk, c, t), { plant: plantAt(sk, c, t), armsOut: c.bodies?.[sk.body]?.armsOut, grip: gripAt(c, t), held });
}

/**
 * Breathing as an additive pose at a phase (whole numbers: breathed out): the chest lifted and opened, the shoulders
 * raised, the head kept level; `depth` 1 is a clear breath at game size.
 */
export function breathe(sk: Skeleton, phase: number, depth: number): Pose {
  // in fast, out slow: a breath's first two-fifths in
  const f = ((phase % 1) + 1) % 1, b = (f < 0.4 ? Math.sin((f / 0.4) * Math.PI * 0.5) : Math.cos(((f - 0.4) / 0.6) * Math.PI * 0.5)) ** 2 * depth;
  const q: Array<Q | undefined> = [];
  const put = (bone: string, e: [number, number, number]): void => { const i = sk.at.get(bone); if (i !== undefined) q[i] = sk.local(i, e); };
  put('spine_02', [-1.2 * b, 0, 0]);
  put('spine_03', [-2.4 * b, 0, 0]);
  put('neck_01', [1.8 * b, 0, 0]);
  put('head', [1.8 * b, 0, 0]);
  for (const [s, k] of [['l', 1], ['r', -1]] as const) {
    const ci = sk.at.get(`clavicle_${s}`), ui = sk.at.get(`upperarm_${s}`);
    if (ci !== undefined) q[ci] = sk.world(ci, [0, 0, 1], 4 * b * k);
    // the arms hang as before: the shoulder's lift taken back at the upper arm
    if (ui !== undefined) q[ui] = sk.world(ui, [0, 0, 1], -4 * b * k);
  }
  return { q, move: [0, 0, 0] };
}

/** Looking: the head turned by yaw (to the body's left, degrees) and pitch (down), shared down the neck, as an additive pose. */
export function lookAt(sk: Skeleton, yaw: number, pitch: number): Pose {
  const q: Array<Q | undefined> = [];
  for (const [bone, k] of [['neck_01', 0.25], ['neck_02', 0.25], ['head', 0.5]] as const) { const i = sk.at.get(bone); if (i !== undefined) q[i] = sk.local(i, [pitch * k, yaw * k, 0]); }
  return { q, move: [0, 0, 0] };
}

/** b added onto a by weight w: each bone turned further by its turn in b, the shift added. */
export function addPose(a: Pose, b: Pose, w: number): Pose {
  b.q.forEach((q, i) => { if (q) a.q[i] = qmul(a.q[i] ?? QI, w === 1 ? q : slerp(QI, q, w)); });
  a.move = add(a.move, scl(b.move, w));
  return a;
}
/** a blended toward b by w (0: a, 1: b), only over the bones `only` names when given. */
export function blendPose(a: Pose, b: Pose, w: number, only?: (i: number) => boolean): Pose {
  const n = Math.max(a.q.length, b.q.length), q: Array<Q | undefined> = [];
  for (let i = 0; i < n; i++) {
    if (only && !only(i)) { q[i] = a.q[i]; continue; }
    const qa = a.q[i] ?? QI, qb = b.q[i] ?? QI;
    q[i] = slerp(qa, qb, w);
  }
  const move: V = only ? a.move : [a.move[0] + (b.move[0] - a.move[0]) * w, a.move[1] + (b.move[1] - a.move[1]) * w, a.move[2] + (b.move[2] - a.move[2]) * w];
  return { q, move };
}
/** Finished locals blended (for a fade from a pose not made of clips): a toward b by w. */
export function blendLocal(a: { local: Array<M3 | undefined>; move: V }, b: { local: Array<M3 | undefined>; move: V }, w: number): { local: Array<M3 | undefined>; move: V } {
  const n = Math.max(a.local.length, b.local.length), local: Array<M3 | undefined> = [];
  for (let i = 0; i < n; i++) {
    const la = a.local[i], lb = b.local[i];
    if (!la && !lb) continue;
    local[i] = qmat(slerp(la ? quat(la) : QI, lb ? quat(lb) : QI, w));
  }
  return { local, move: [a.move[0] + (b.move[0] - a.move[0]) * w, a.move[1] + (b.move[1] - a.move[1]) * w, a.move[2] + (b.move[2] - a.move[2]) * w] };
}

/**
 * One clip playing: where it is, how fast, and its weight fading toward `to` at `speed` a second; for a clip fitted to an
 * action (`ClipPlayer.fit`) with spans to stretch, the seconds played and each run's length, its time found from them.
 */
interface Track { clip: Clip; t: number; rate: number; w: number; to: number; speed: number; played?: number; run?: number }
const track = (clip: Clip, t = 0, rate = 1): Track => ({ clip, t, rate, w: 1, to: 1, speed: 0 });

/**
 * A body's clips, kept frame to frame: a base clip (crossfaded from the last), an upper-body clip over it, additive clips
 * on top, and a look. `update(dt)` steps them and returns the events crossed; `finish()` is the pose to draw.
 */
export class ClipPlayer {
  private base: Track | null = null;
  private last: Track | null = null;
  private fade = 0;
  private fadeAt = 0;
  private upper: Track | null = null;
  private adds: Track[] = [];
  private look: [number, number] = [0, 0];
  /** What is held in both hands, for a clip that grips it (`Clip.grip`). */
  held: Held | undefined;
  constructor(readonly sk: Skeleton) {}

  /** Plays a clip as the base, faded in over `fade` seconds from whatever played before; `at` its start time. */
  play(clip: Clip, o: { fade?: number; at?: number; rate?: number } = {}): void {
    if (this.base?.clip === clip) return;
    this.last = this.base;
    this.base = track(clip, o.at ?? 0, o.rate ?? 1);
    this.fade = this.last ? (o.fade ?? 0.2) : 0;
    this.fadeAt = 0;
  }
  /** Lays an upper-body clip over the base (null takes it off), faded over `fade` seconds. */
  over(clip: Clip | null, fade = 0.15): void {
    if (clip && this.upper?.clip !== clip) this.upper = { ...track(clip), w: 0, to: 1, speed: 1 / Math.max(1e-3, fade) };
    else if (!clip && this.upper) { this.upper.to = 0; this.upper.speed = 1 / Math.max(1e-3, fade); }
  }
  /** Adds an additive clip at a weight (0 takes it off), faded over `fade` seconds. */
  additive(clip: Clip, weight: number, fade = 0.15): void {
    let a = this.adds.find((x) => x.clip === clip);
    if (!a) this.adds.push((a = { ...track(clip), w: 0, to: weight, speed: 0 }));
    a.to = weight;
    a.speed = Math.abs(weight - a.w) / Math.max(1e-3, fade);
  }
  /** Turns the head to look: yaw to the body's left and pitch down, degrees. */
  lookTo(yaw: number, pitch: number): void { this.look = [yaw, pitch]; }

  /**
   * The base clip played to fit an action's length: a one-shot stretched to it, a loop to a whole number of runs in it.
   * A clip with spans to stretch (`Clip.stretch`: its holds) takes the difference up in them, its fast beats played as
   * keyed (`fitTime`); any other is played faster or slower throughout. `most` caps the runs (1: one blow a go).
   */
  fit(seconds: number, most = Infinity): void {
    if (!this.base || seconds <= 0) return;
    const b = this.base, c = b.clip, { runs, run } = runsOf(c, seconds, most);
    if (c.stretch?.length) { b.played = (b.t / c.length) * run; b.run = run; b.rate = 1; return; }
    b.played = b.run = undefined;
    b.rate = (runs * c.length) / seconds;
  }
  /** The base loop's rate for a speed: one run of the clip covers `stride` (distance a run of it travels). */
  matchSpeed(speed: number, stride: number): void { if (this.base) { this.base.run = this.base.played = undefined; this.base.rate = stride > 0 ? (speed * this.base.clip.length) / stride : 1; } }
  /** The base loop put at a phase of its cycle (0 to 1, as the game's walk phase over a turn). */
  syncPhase(phase: number): void {
    const b = this.base;
    if (!b) return;
    const u = ((phase % 1) + 1) % 1;
    if (b.run) { b.played = u * b.run; b.t = fitTime(b.clip, b.played, b.run); } else b.t = u * b.clip.length;
  }

  /** Steps the clips by dt seconds; the events the base and upper clips crossed. */
  update(dt: number): string[] {
    const ev: string[] = [];
    for (const k of [this.base, this.upper, this.last, ...this.adds]) {
      if (!k) continue;
      const t0 = k.t;
      if (k.run) { k.played = (k.played ?? 0) + dt; k.t = fitTime(k.clip, k.played, k.run); }
      else k.t += dt * k.rate;
      if (k === this.base || k === this.upper) ev.push(...eventsBetween(k.clip, t0, k.t));
      if (k.speed) { k.w += Math.sign(k.to - k.w) * Math.min(Math.abs(k.to - k.w), k.speed * dt); if (k.w === k.to) k.speed = 0; }
    }
    if (this.last) { this.fadeAt += dt; if (this.fadeAt >= this.fade) this.last = null; }
    if (this.upper && this.upper.w === 0 && this.upper.to === 0) this.upper = null;
    this.adds = this.adds.filter((a) => a.w > 0 || a.to > 0);
    return ev;
  }

  /** The pose to draw now: the layers blended, the procedural layer done; null with nothing playing. */
  finish(): { local: Array<M3 | undefined>; move: V } | null {
    if (!this.base) return null;
    const sk = this.sk;
    let p = poseAt(sk, this.base.clip, this.base.t);
    const fw = this.last && this.fade > 0 ? Math.min(1, this.fadeAt / this.fade) : 1;
    if (this.last && fw < 1) p = blendPose(poseAt(sk, this.last.clip, this.last.t), p, fw * fw * (3 - 2 * fw));
    if (this.upper && this.upper.w > 0) {
      const up = poseAt(sk, this.upper.clip, this.upper.t);
      p = this.upper.clip.mask === 'additive' ? addPose(p, up, this.upper.w) : blendPose(p, up, this.upper.w, (i) => UPPER.has(sk.bones[i].name));
    }
    for (const a of this.adds) addPose(p, poseAt(sk, a.clip, a.t), a.w);
    if (this.look[0] || this.look[1]) addPose(p, lookAt(sk, this.look[0], this.look[1]), 1);
    // the feet planted where the clip mostly playing stands them
    const lead = this.last && fw < 0.5 ? this.last : this.base;
    return sk.finish(p, { plant: plantAt(sk, lead.clip, lead.t), armsOut: lead.clip.bodies?.[sk.body]?.armsOut, grip: gripAt(lead.clip, lead.t), held: this.held });
  }
}

/**
 * Where a body's feet stand w of the way from one clip's place (at its time) to another's: the two stances blended, and
 * each foot's keyed channels (forward, up, rolled about the heel or the ball: \`Clip.feet\`) blended over them, so a foot
 * rolled up onto its toes by one clip and flat in the other rolls about its ball as it goes; none unless both plant.
 */
export function plantBetween(sk: Skeleton, a: { clip: Clip; t: number }, b: { clip: Clip; t: number }, w: number): Plant | undefined {
  const pa = plantOf(sk, a.clip), pb = plantOf(sk, b.clip);
  if (!pa || !pb) return undefined;
  const at = (s: number): V => add(pa.at[s], scl(add(pb.at[s], scl(pa.at[s], -1)), w));
  const W = (s: number): M3 => qmat(slerp(quat(pa.W[s]), quat(pb.W[s]), w));
  const fa = sampleFeet(a.clip, a.t, sk.body), fb = sampleFeet(b.clip, b.t, sk.body), sa = strideOf(a.clip, sk.body), sb = strideOf(b.clip, sk.body);
  const feet = [0, 1].map((s) => {
    const x = fa?.[s] ?? { z: 0, lift: 0, pitch: 0 }, y = fb?.[s] ?? { z: 0, lift: 0, pitch: 0 };
    return { z: x.z * sa + (y.z * sb - x.z * sa) * w, lift: x.lift + (y.lift - x.lift) * w, pitch: x.pitch + (y.pitch - x.pitch) * w };
  }) as [Foot, Foot];
  const inward = (a.clip.bodies?.[sk.body]?.feet?.in ?? 0) * (1 - w) + (b.clip.bodies?.[sk.body]?.feet?.in ?? 0) * w;
  return sk.step({ at: [at(0), at(1)], W: [W(0), W(1)] }, feet, 1, inward);
}
