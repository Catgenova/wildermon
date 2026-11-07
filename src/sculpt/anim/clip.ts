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
 * - `out`: fast away from the last key, slowing into this one.
 */
export type EaseName = 'linear' | 'inOut' | 'hold' | 'back' | 'out';
export interface Ease { ease?: EaseName; hold?: number; back?: number }

/** A key: at time `t` seconds, the value, and how it is reached. */
export interface Key<T> extends Ease { t: number; v: T }

/** Which bones a clip moves when it is laid over another: all, the upper body only, or added on top. */
export type Mask = 'full' | 'upper' | 'additive';

/** The per-body correction layer for one body. */
export interface Correction {
  /** Turns added to the authored turns, per bone, degrees. */
  add?: Record<string, Euler>;
  /** Scales on the authored turns, per bone (1: as authored). */
  scale?: Record<string, number>;
  /** A scale on the `move` keys. */
  move?: number;
  /** How far the upper arms are kept out from the chest, as `lowpoly.ts` fromGame keeps them: added to the body's own. */
  armsOut?: number;
}

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
}

/** The bones a clip masked `upper` moves: the spine above the waist, the neck, the head and the arms. */
export const UPPER = new Set(['spine_02', 'spine_03', 'neck_01', 'neck_02', 'head', 'jaw', ...['l', 'r'].flatMap((s) => ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb_01', 'thumb_02', 'thumb_03', 'fingers_01', 'fingers_02'].map((b) => `${b}_${s}`))]);

/** An easing's share of the way at u (0 to 1) of a segment. */
export function eased(u: number, e: Ease): number {
  u = Math.min(1, Math.max(0, u));
  switch (e.ease ?? 'inOut') {
    case 'linear': return u;
    case 'out': return 1 - (1 - u) * (1 - u) * (1 - u);
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

/** A track's value at time t (seconds, already wrapped for a loop). */
export function sampleKeys(keys: Array<Key<Euler>>, t: number, length: number, loop: boolean): Euler {
  if (keys.length === 1 || t <= keys[0].t && !loop) return [...keys[0].v] as Euler;
  let i = keys.length - 1;
  for (let k = 0; k < keys.length; k++) if (keys[k].t > t) { i = k - 1; break; }
  let a: Key<Euler>, b: Key<Euler>, t0: number, t1: number;
  if (i < 0) {
    // before the first key: in a loop, on the way round from the last
    if (!loop) return [...keys[0].v] as Euler;
    a = keys[keys.length - 1]; b = keys[0]; t0 = a.t - length; t1 = b.t;
  } else if (i === keys.length - 1) {
    if (!loop) return [...keys[i].v] as Euler;
    a = keys[i]; b = keys[0]; t0 = a.t; t1 = b.t + length;
  } else { a = keys[i]; b = keys[i + 1]; t0 = a.t; t1 = b.t; }
  const w = eased((t - t0) / Math.max(1e-6, t1 - t0), b);
  return [a.v[0] + (b.v[0] - a.v[0]) * w, a.v[1] + (b.v[1] - a.v[1]) * w, a.v[2] + (b.v[2] - a.v[2]) * w];
}

/** A clip's time wrapped to it: round for a loop, held at the ends for a one-shot. */
export const wrap = (c: Clip, t: number): number => (c.loop ? ((t % c.length) + c.length) % c.length : Math.min(c.length, Math.max(0, t)));

/** A clip at time t: each bone's turn (degrees) and the body's shift (body heights), with a body's corrections. */
export function sampleClip(c: Clip, t: number, body?: 'man' | 'woman'): { rot: Record<string, Euler>; move: Euler } {
  const tt = wrap(c, t), fix = body ? c.bodies?.[body] : undefined;
  const rot: Record<string, Euler> = {};
  for (const [bone, keys] of Object.entries(c.tracks)) {
    let e = sampleKeys(keys, tt, c.length, c.loop);
    const k = fix?.scale?.[bone];
    if (k !== undefined) e = [e[0] * k, e[1] * k, e[2] * k];
    rot[bone] = e;
  }
  for (const [bone, keys] of Object.entries(c.accents ?? {})) {
    let d = sampleKeys(keys, tt, c.length, c.loop);
    const k = fix?.scale?.[bone];
    if (k !== undefined) d = [d[0] * k, d[1] * k, d[2] * k];
    const e = rot[bone] ?? [0, 0, 0];
    rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]];
  }
  for (const [bone, d] of Object.entries(fix?.add ?? {})) { const e = rot[bone] ?? [0, 0, 0]; rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; }
  let move: Euler = c.move ? sampleKeys(c.move, tt, c.length, c.loop) : [0, 0, 0];
  if (fix?.move !== undefined) move = [move[0] * fix.move, move[1] * fix.move, move[2] * fix.move];
  return { rot, move };
}

/** A clip's stance (`Clip.plant`) for a body, its corrections made: each bone's turn and the body's shift. */
export function stanceOf(c: Clip, body?: 'man' | 'woman'): { rot: Record<string, Euler>; move: Euler } | undefined {
  if (!c.plant) return undefined;
  const fix = body ? c.bodies?.[body] : undefined, rot: Record<string, Euler> = {};
  for (const [bone, e] of Object.entries(c.plant.rot)) { const k = fix?.scale?.[bone] ?? 1; rot[bone] = [e[0] * k, e[1] * k, e[2] * k]; }
  for (const [bone, d] of Object.entries(fix?.add ?? {})) { const e = rot[bone] ?? [0, 0, 0]; rot[bone] = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; }
  const m = c.plant.move ?? [0, 0, 0], k = fix?.move ?? 1;
  return { rot, move: [m[0] * k, m[1] * k, m[2] * k] };
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
