/**
 * Keyframed clips for the low-poly bodies (`../lowpoly.ts`), authored once for the shared skeleton.
 *
 * A clip holds, per posed bone, keys of a local turn [rx, ry, rz] in degrees (Rz · Rx · Ry), in the MAN's bone frame:
 * Y from head to tail, X the bend axis, +rx bending forward. `./skeleton.ts` carries each turn over to a body whose bone
 * frames differ (hers) as the same turn in the world, so one clip moves both bodies alike. `move` keys shift the whole
 * body (the root): [x, y, z] in body heights, x the body's left, y up, z forward, so a shift is the same share of a short
 * body as of a tall one.
 *
 * Each key names the easing it is reached by (`Ease`). A loop runs from its last key back round to its first, eased as the
 * first key says, so a loop is seamless by construction. `accents` are tracks of their own timing whose turns are
 * added to the main tracks': a fidget over a weight shift. Events are marks on the timeline (`impact`), passed on by the
 * player as it crosses them. `bodies` holds the per-body correction layer: turns added to and scales on the authored
 * turns for one body only, and a scale on its `move` (her narrower stance, her arms further out, her shorter shift).
 */
import type { Euler } from './math';

/**
 * How a key is reached from the key before it:
 * - `linear`: at an even rate;
 * - `inOut`: eased out of the last key and into this one (smoothstep);
 * - `hold`: held at the last key for `hold` of the way (0.6 if not given), then popped into this one fast and settled;
 * - `back`: overshoots this key by `back` of the change (0.18 if not given) and settles onto it;
 * - `out`: fast away from the last key, slowing into this one;
 * - `in`: slow away from the last key, gathering speed into this one (a blow landing).
 */
export type EaseName = 'linear' | 'inOut' | 'hold' | 'back' | 'out' | 'in';
export interface Ease { ease?: EaseName; hold?: number; back?: number }

/** A key: at time `t` seconds, the value, and how it is reached. */
export interface Key<T> extends Ease { t: number; v: T }

/** Which bones a clip moves when it is laid over another: all, the upper body only, or added on top. */
export type Mask = 'full' | 'upper' | 'additive';

/** The per-body correction layer for one body. */
export interface Correction {
  /** Turns added to the authored turns, per bone, degrees. */
  add?: Record<string, Euler>;
  /** Turns added over time, per bone, degrees (keyed as the clip's own tracks; `$move` the shift, body heights): a key pose put right for this body alone. */
  tracks?: Record<string, Array<Key<Euler>>>;
  /** Scales on the authored turns, per bone (1: as authored): one for all three, or one each for rx, ry, rz. */
  scale?: Record<string, number | Euler>;
  /** A scale on the `move` keys: one for all three, or one each across, up and forward. */
  move?: number | Euler;
  /** How far the upper arms are kept out from the chest, as `lowpoly.ts` fromGame keeps them: added to the body's own. */
  armsOut?: number;
  /**
   * A clip's keyed feet (`Clip.feet`): each foot's line moved in toward the middle by this, body heights; its lift scaled;
   * and the body's own stride, the game's units a run of the clip.
   */
  feet?: { in?: number; lift?: number; stride?: number };
  /** The reached hands' places moved for this body (`Clip.hands`), body heights across, up and forward: a shorter reach brought in. */
  hands?: Partial<Record<Side, Euler>>;
  /**
   * How far up its handle each hand's tool is held (`Clip.tools`), the game's units toward its head from where its grip
   * says (`grip.lead`): a body that holds a long tool shorter (choked up), its contact that much nearer the fist.
   */
  grip?: Partial<Record<Side, number>>;
}

/** Both hands on one handle: see `Clip.grip`. */
export interface Grip {
  ground?: number;
  /** How far the far end is let down onto the ground over time (0: as keyed; 1: resting on it, the wrist turned down to it). */
  rest?: Array<Key<number>>;
  /**
   * How far the left elbow is put, over time, toward the side that lines its forearm up with its hand on the grip (so the
   * wrist bends least), from the side it is keyed on (0, as when not given).
   */
  lineUp?: Array<Key<number>>;
}
/** A grip at a moment: how far off the ground the far end is kept, how far it is let down onto it, and how far the left elbow lines up. */
export interface GripAt { ground: number; rest: number; lineUp: number }

/**
 * A hand put on a place in the world while a clip plays (`Clip.hands`), its arm reached to it (`./skeleton.ts` finish): the
 * fist's grip (its tool's socket, or where a fist closes on a handle) at `at` over time, in body heights across (the body's
 * left), up from the ground and forward, in the frame the feet stand in; the grip running along `way` toward the thumb,
 * the knuckles as near the forearm's way as that allows.
 */
export interface HandReach {
  at: Array<Key<Euler>>; way: Euler;
  /** The grip's way over time, in place of `way` (a rod swung over the shoulder and cast out). */
  ways?: Array<Key<Euler>>;
  /**
   * The way the knuckles point over time, kept in the world (in place of as near the forearm's way as the grip allows): a
   * hand flat on what it presses, or one on a long handle the forearm runs along.
   */
  knuckles?: Array<Key<Euler>>;
}
/** A hand's place, its grip's way and where its knuckles point when kept (`HandReach`) at a moment. */
export interface HandAt { at: Euler; way: Euler; knuckles?: Euler }
/** The hands a clip holds a tool in (`Clip.tools`), by the side. */
export type Side = 'l' | 'r';

/** A foot's channels as a clip keys them (`Clip.feet`). */
export type FootChannel = 'z' | 'lift' | 'pitch';
export type FootKeys = Record<FootChannel, Array<Key<number>>>;
/** A foot at a moment: forward of where it stands (strides), up off the ground (body heights), toe up (degrees). */
export interface Foot { z: number; lift: number; pitch: number }

export interface Clip {
  name: string;
  /** A loop, or played once and held on its last key. */
  loop: boolean;
  /** Seconds. */
  length: number;
  mask: Mask;
  /** Per posed bone (the rig's names: `spine_03`, `upperarm_l`), its keys. */
  tracks: Record<string, Array<Key<Euler>>>;
  /** Beats laid on top of the tracks on their own timing (a head turn over a weight shift): their turns added. */
  accents?: Record<string, Array<Key<Euler>>>;
  /** The whole body's shift, body heights. */
  move?: Array<Key<Euler>>;
  /** The key poses by time, for the authoring tool's sheet (`tools/sculpt/lowanim.mjs`). */
  poses?: Array<{ t: number; name: string }>;
  /** Marks on the timeline, seconds. */
  events?: Array<{ t: number; name: string }>;
  /** Both feet kept where this stance stands them (soles flat, no sliding), the legs bent to reach them: its turns and shift. */
  plant?: { rot: Record<string, Euler>; move?: Euler };
  /** Breaths over one run of the clip, added by the player's breathing layer (`./player.ts`), and how deep. */
  breath?: { count: number; depth: number };
  /** The per-body correction layer: `man`, `woman`. */
  bodies?: Partial<Record<'man' | 'woman', Correction>>;
  /**
   * The feet keyed where they go, as a walk on the spot: each foot from where the stance (`plant`) stands it, forward in
   * strides (the ground a planted foot goes back over in one run of the clip), up in body heights, and pitched toe up about
   * its heel (or heel up about the ball of the foot) in degrees; the legs bent to reach. `stride` is that ground in the
   * game's units (a body's own in `Correction.feet.stride`): the clip is played a run to that much ground the game carries
   * the body over (`./index.ts` clipFor), so a foot keyed back at a steady rate stays where it was put, at any pace.
   */
  feet?: { stride: number; l: FootKeys; r: FootKeys };
  /**
   * Both hands on what is held (`./skeleton.ts` finish, its `Held`: the sword's grip, or a handle when nothing says): the
   * right arm as keyed, its fist the lead (nearer the head or the guard), the left reached onto the grip below it (two-bone
   * IK, its elbow kept on the side it is keyed on) and closed on it as its socket says. The lowest of its far end (the
   * sword's point and the edges by it) kept `ground` game units off the ground by turning the right wrist up, and let
   * down onto it as far as `rest` says by turning it down.
   */
  grip?: Grip;
  /**
   * The spans (seconds, within the clip) that take up the time when a clip is fitted to an action's length (`fitTime`):
   * the holds, so the fast beats between them keep their speed.
   */
  stretch?: Array<[number, number]>;
  /** One run a go of a timed job however long the go (a cast a go), its holds stretched to fill it (`../index.ts` clipFor). */
  oneAGo?: boolean;
  /** The arms as keyed, not kept off the body (`./skeleton.ts` finish): a clip whose hands work in front of it. */
  armsFree?: boolean;
  /** Hands put on places in the world, their arms reached to them (`HandReach`): the other arms as keyed. */
  hands?: Partial<Record<Side, HandReach>>;
  /** The tool drawn in each hand while the clip plays, by its asset's id (`../lowpoly.ts`), its fist closed on it. */
  tools?: Partial<Record<Side, string>>;
  /**
   * The hand that strikes with its tool (`tools`) and when its tool meets the work: a job's own tool that reaches less far
   * than the clip's has the work brought to it (`../index.ts`).
   */
  strike?: { side: Side; t: number };
  /**
   * The hand the weapon in hand is drawn in while the clip plays (a bow in the left fist), both fists reached as they
   * would close on its grip (`Clip.hands`).
   */
  wields?: Side;
  /**
   * A bow's shot (`../lowpoly.ts`): the span (seconds) its string is drawn to the other fist, the span an arrow is in that
   * fist (from the quiver to the loose; while drawn too), and the moment of the full draw, where the arrow is laid along.
   */
  bow?: { drawn: [number, number]; arrow: [number, number]; full: number };
}

/** The bones a clip masked `upper` moves: the spine above the waist, the neck, the head and the arms. */
export const UPPER = new Set(['spine_02', 'spine_03', 'neck_01', 'neck_02', 'head', 'jaw', ...['l', 'r'].flatMap((s) => ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb_01', 'thumb_02', 'thumb_03', 'fingers_01', 'fingers_02'].map((b) => `${b}_${s}`))]);

/** An easing's share of the way at u (0 to 1) of a segment. */
export function eased(u: number, e: Ease): number {
  u = Math.min(1, Math.max(0, u));
  switch (e.ease ?? 'inOut') {
    case 'linear': return u;
    case 'out': return 1 - (1 - u) * (1 - u) * (1 - u);
    case 'in': return u * u;
    case 'hold': {
      const h = e.hold ?? 0.6;
      if (u <= h) return 0;
      const w = (u - h) / (1 - h);
      // popped: fast out, a touch past, settled
      return backOut(w, 0.08);
    }
    case 'back': return backOut(u, e.back ?? 0.18);
    default: return u * u * (3 - 2 * u);
  }
}
/** Out to `over` past the end at about three-quarters of the way, settled onto the end: a back-out of that height. */
function backOut(u: number, over: number): number {
  // the classic back-out, its tension chosen for the overshoot asked: (s+1)x^3 - s x^2 over x = u - 1, peak at 1 + over
  const s = backTension(over), x = u - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}
const TENSION = new Map<number, number>();
function backTension(over: number): number {
  let s = TENSION.get(over);
  if (s !== undefined) return s;
  // the peak of 1 + (s+1)x^3 + s x^2 is at x = -2s / (3(s+1)): solved for its height by bisection
  let lo = 0, hi = 20;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2, x = (-2 * m) / (3 * (m + 1)), peak = (m + 1) * x * x * x + m * x * x;
    if (peak < over) lo = m; else hi = m;
  }
  s = (lo + hi) / 2;
  TENSION.set(over, s);
  return s;
}

/** The keys either side of time t (seconds, already wrapped for a loop) and the eased share of the way from one to the other. */
function segment<T>(keys: Array<Key<T>>, t: number, length: number, loop: boolean): { a: Key<T>; b: Key<T>; w: number } {
  if (keys.length === 1 || t <= keys[0].t && !loop) return { a: keys[0], b: keys[0], w: 0 };
  let i = keys.length - 1;
  for (let k = 0; k < keys.length; k++) if (keys[k].t > t) { i = k - 1; break; }
  let a: Key<T>, b: Key<T>, t0: number, t1: number;
  if (i < 0) {
    // before the first key: in a loop, on the way round from the last
    if (!loop) return { a: keys[0], b: keys[0], w: 0 };
    a = keys[keys.length - 1]; b = keys[0]; t0 = a.t - length; t1 = b.t;
  } else if (i === keys.length - 1) {
    if (!loop) return { a: keys[i], b: keys[i], w: 0 };
    a = keys[i]; b = keys[0]; t0 = a.t; t1 = b.t + length;
  } else { a = keys[i]; b = keys[i + 1]; t0 = a.t; t1 = b.t; }
  return { a, b, w: eased((t - t0) / Math.max(1e-6, t1 - t0), b) };
}

/** A track's value at time t (seconds, already wrapped for a loop). */
export function sampleKeys(keys: Array<Key<Euler>>, t: number, length: number, loop: boolean): Euler {
  const { a, b, w } = segment(keys, t, length, loop);
  return [a.v[0] + (b.v[0] - a.v[0]) * w, a.v[1] + (b.v[1] - a.v[1]) * w, a.v[2] + (b.v[2] - a.v[2]) * w];
}

/** One channel's value at time t (already wrapped for a loop), as `sampleKeys`. */
export function sampleKey(keys: Array<Key<number>>, t: number, length: number, loop: boolean): number {
  const { a, b, w } = segment(keys, t, length, loop);
  return a.v + (b.v - a.v) * w;
}

/** A clip's time wrapped to it: round for a loop, held at the ends for a one-shot. */
export const wrap = (c: Clip, t: number): number => (c.loop ? ((t % c.length) + c.length) % c.length : Math.min(c.length, Math.max(0, t)));

/** v scaled by k, one number for all three or one each. */
const scaled = (v: Euler, k: number | Euler | undefined): Euler => (k === undefined ? v : typeof k === 'number' ? [v[0] * k, v[1] * k, v[2] * k] : [v[0] * k[0], v[1] * k[1], v[2] * k[2]]);

/** A clip at time t: each bone's turn (degrees) and the body's shift (body heights), with a body's corrections. */
export function sampleClip(c: Clip, t: number, body?: 'man' | 'woman'): { rot: Record<string, Euler>; move: Euler } {
  const tt = wrap(c, t), fix = body ? c.bodies?.[body] : undefined;
  const rot: Record<string, Euler> = {};
  for (const [bone, keys] of Object.entries(c.tracks)) {
    rot[bone] = scaled(sampleKeys(keys, tt, c.length, c.loop), fix?.scale?.[bone]);
  }
  for (const [bone, keys] of Object.entries(c.accents ?? {})) {
    const d = scaled(sampleKeys(keys, tt, c.length, c.loop), fix?.scale?.[bone]);
    const e = rot[bone] ?? [0, 0, 0];
    rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]];
  }
  for (const [bone, keys] of Object.entries(fix?.tracks ?? {})) {
    if (bone === '$move') continue;
    const d = sampleKeys(keys, tt, c.length, c.loop), e = rot[bone] ?? [0, 0, 0];
    rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]];
  }
  for (const [bone, d] of Object.entries(fix?.add ?? {})) { const e = rot[bone] ?? [0, 0, 0]; rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; }
  const move = scaled(c.move ? sampleKeys(c.move, tt, c.length, c.loop) : [0, 0, 0], fix?.move), dm = fix?.tracks?.$move;
  if (dm) { const d = sampleKeys(dm, tt, c.length, c.loop); move[0] += d[0]; move[1] += d[1]; move[2] += d[2]; }
  return { rot, move };
}

/** A clip's stance (`Clip.plant`) for a body, its corrections made: each bone's turn and the body's shift. */
export function stanceOf(c: Clip, body?: 'man' | 'woman'): { rot: Record<string, Euler>; move: Euler } | undefined {
  if (!c.plant) return undefined;
  const fix = body ? c.bodies?.[body] : undefined, rot: Record<string, Euler> = {};
  for (const [bone, e] of Object.entries(c.plant.rot)) rot[bone] = scaled(e, fix?.scale?.[bone]);
  for (const [bone, d] of Object.entries(fix?.add ?? {})) { const e = rot[bone] ?? [0, 0, 0]; rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; }
  return { rot, move: scaled(c.plant.move ?? [0, 0, 0], fix?.move) };
}

/** The ground a run of a clip that keys its feet covers on a body, the game's units (`Clip.feet`): 0 for one that does not. */
export const strideOf = (c: Clip, body?: 'man' | 'woman'): number => (body && c.bodies?.[body]?.feet?.stride) || c.feet?.stride || 0;

/** A clip's keyed feet at time t (`Clip.feet`), left and right, with a body's corrections: none if it keys no feet. */
export function sampleFeet(c: Clip, t: number, body?: 'man' | 'woman'): [Foot, Foot] | undefined {
  if (!c.feet) return undefined;
  const tt = wrap(c, t), lift = (body && c.bodies?.[body]?.feet?.lift) ?? 1;
  const one = (k: FootKeys): Foot => ({ z: sampleKey(k.z, tt, c.length, c.loop), lift: sampleKey(k.lift, tt, c.length, c.loop) * lift, pitch: sampleKey(k.pitch, tt, c.length, c.loop) });
  return [one(c.feet.l), one(c.feet.r)];
}

/** The shortest a span of `Clip.stretch` is squeezed to (a share of its length) before the rest of the clip is. */
const SQUEEZE = 0.35;
/**
 * A clip's time `played` seconds in when each run of it takes `run` seconds: the spans of `Clip.stretch` lengthened or
 * shortened to make up the difference, the rest played as keyed; a clip with none, or squeezed past what its spans can
 * give, scaled evenly. Counted on over runs (a loop's second run from `length`), so events are crossed in order.
 */
export function fitTime(c: Clip, played: number, run: number): number {
  const L = c.length;
  if (run <= 0) return played;
  const n = Math.floor(played / run), u = played - n * run;
  const spans = (c.stretch ?? []).map(([a, b]) => [Math.max(0, Math.min(L, a)), Math.max(0, Math.min(L, b))]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const S = spans.reduce((s, [a, b]) => s + b - a, 0);
  // seconds played per second of the clip: in the spans (k) and out of them (r)
  let k = run / L, r = run / L;
  if (S > 0 && S < L) {
    const extra = run - L;
    if (extra >= -S * (1 - SQUEEZE)) { k = (S + extra) / S; r = 1; }
    else { k = SQUEEZE; r = (run - S * SQUEEZE) / (L - S); }
  }
  // the clip's pieces in order, in and out of the spans, walked until `u` seconds are played
  let clip = 0, left = u;
  const pieces: Array<[number, number]> = [];
  for (const [a, b] of spans) { if (a > clip) pieces.push([a - clip, r]); pieces.push([b - a, k]); clip = b; }
  if (clip < L) pieces.push([L - clip, r]);
  clip = 0;
  for (const [len, rate] of pieces) {
    const dur = len * rate;
    if (left <= dur) return n * L + clip + (rate > 0 ? left / rate : 0);
    left -= dur; clip += len;
  }
  return n * L + L;
}
/** The runs of a loop fitted into an action of `seconds`, and each run's length: as many whole runs as come nearest. */
export function runsOf(c: Clip, seconds: number, most = Infinity): { runs: number; run: number } {
  const runs = c.loop ? Math.max(1, Math.min(most, Math.round(seconds / c.length))) : 1;
  return { runs, run: seconds / runs };
}

/** A clip's grip at time t (`Clip.grip`): none for a clip that does not grip. */
export function gripAt(c: Clip, t: number): GripAt | undefined {
  if (!c.grip) return undefined;
  const at = (k?: Array<Key<number>>): number => (k ? sampleKey(k, wrap(c, t), c.length, c.loop) : 0);
  return { ground: c.grip.ground ?? 0, rest: at(c.grip.rest), lineUp: at(c.grip.lineUp) };
}

/** A clip's reached hands at time t (`Clip.hands`): none for a clip that reaches none. */
export function handsAt(c: Clip, t: number, body?: 'man' | 'woman', shift: Partial<Record<Side, Euler>> = {}): Partial<Record<Side, HandAt>> | undefined {
  if (!c.hands) return undefined;
  const out: Partial<Record<Side, HandAt>> = {};
  for (const [s, h] of Object.entries(c.hands) as Array<[Side, HandReach]>) {
    const at = sampleKeys(h.at, wrap(c, t), c.length, c.loop), d = (body && c.bodies?.[body]?.hands?.[s]) || [0, 0, 0], e = shift[s] ?? [0, 0, 0];
    const tt = wrap(c, t), way = h.ways ? sampleKeys(h.ways, tt, c.length, c.loop) : h.way;
    out[s] = { at: [at[0] + d[0] + e[0], at[1] + d[1] + e[1], at[2] + d[2] + e[2]], way, ...(h.knuckles ? { knuckles: sampleKeys(h.knuckles, tt, c.length, c.loop) } : {}) };
  }
  return out;
}

/** The events a clip passes from time a to time b (b after a; a loop's wrap counted). */
export function eventsBetween(c: Clip, a: number, b: number): string[] {
  const out: string[] = [];
  if (!c.events?.length || b <= a) return out;
  if (!c.loop) { for (const e of c.events) if (e.t > a && e.t <= b) out.push(e.name); return out; }
  const n0 = Math.floor(a / c.length), n1 = Math.floor(b / c.length);
  for (let n = n0; n <= n1; n++) for (const e of c.events) { const t = n * c.length + e.t; if (t > a && t <= b) out.push(e.name); }
  return out;
}
