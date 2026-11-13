/**
 * Getting down onto the ground and up off it, for a clip played sat or lying there (sleeping, meditating: `DOWNS`): a
 * one-shot clip of its own (`Down`) from the idle's stance to the clip's pose, played forward on going into the clip and
 * backward on leaving it, from as far as it had got. Its feet are kept where the idle stands them as far as `planted`
 * says (the legs bent to reach them: crouched, sat down on the ground behind them), and are keyed as they go the rest of
 * the way (the legs crossed, lain on the side). `./index.ts` animate hands a body over to it (`gettingDown`) while it
 * plays; a body first seen already sat or lying is drawn so at once.
 */
import { sampleKey, wrap, type Clip, type Key } from './clip';
import type { M3, V } from './math';
import { blendLocal, plantOf, poseAt } from './player';
import type { Skeleton } from './skeleton';

/** A clip's way down onto the ground from the idle's stance (its last key the clip's pose), and how planted its feet are over time (1: where `plant` stands them). */
export interface Down extends Clip { planted: Array<Key<number>> }

type Local = { local: Array<M3 | undefined>; move: V };
/**
 * What a body is doing: getting down into a clip (`name`) or up out of it, since `at` (ms), from `t0` seconds into its
 * way down, from the pose it was drawn with (`from`); getting up, at `rate` times the way down's pace.
 */
interface Got { name: string; D: Down; up: boolean; at: number; t0: number; from: Local | null; rate?: number }

/** The clips got down into by a way of their own, by the clip's name (`./clips/life.ts`). */
const DOWNS = new Map<string, Down>();
export function downInto(name: string, d: Down): void { DOWNS.set(name, d); }

/** Seconds the way down is faded into from the pose a body had, and its end into the clip's own motion. */
const FADE = 0.2, LAND = 0.4;
/** How much faster the way down is played backward getting up, and getting up to walk away. */
const UP = 1.3, UP_WALK = 3;
/** Smoothstep, clamped. */
const smooth = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };

/** A body's way down at time t: keyed, its feet kept where it stands them as far as it says. */
export function downAt(sk: Skeleton, D: Down, t: number): Local {
  const p = poseAt(sk, D, t), w = sampleKey(D.planted, wrap(D, t), D.length, false);
  const free = sk.finish(p, { free: true });
  if (w <= 0) return free;
  const held = sk.finish(p, { plant: plantOf(sk, D), free: true });
  return w >= 1 ? held : blendLocal(free, held, w);
}

/** What each body is doing, by its key (`./index.ts` animate's). */
const GOT = new Map<string, Got>();
const MAX_GOT = 256;

/**
 * A body's pose while it gets down into its clip or up out of it (`now` the pose of what it does now; `k` what it is
 * drawn from, since when, and from what pose), or none: what it does now is drawn as it is. `fresh`: the body is seen for
 * the first time, so it is drawn already sat or lying.
 */
export function gettingDown(sk: Skeleton, key: string, k: { source: string; from: Local | null; at: number }, fresh: boolean, now: Local, ms: number): Local | undefined {
  let g = GOT.get(key);
  const D = DOWNS.get(k.source);
  const from = (st: Got, e: number, pose: Local): Local => (st.from && e < FADE ? blendLocal(st.from, pose, smooth(e / FADE)) : pose);
  if (D) {
    if (fresh) { set(key, { name: k.source, D, up: false, at: k.at, t0: D.length + LAND, from: null }); return undefined; }
    if (!g || g.name !== k.source || g.at !== k.at) {
      // going down: from the start, or from as far as a getting up had got back to
      const back = g && g.up && g.D === D ? Math.max(0, g.t0 - ((ms - g.at) / 1000) * UP) : 0;
      g = set(key, { name: k.source, D, up: false, at: k.at, t0: back, from: k.from });
    }
    const e = (ms - g.at) / 1000, t = g.t0 + e;
    if (t >= D.length + LAND) { k.from = null; return undefined; }
    if (t >= D.length) return blendLocal(downAt(sk, D, D.length), now, smooth((t - D.length) / LAND));
    return from(g, e, downAt(sk, D, t));
  }
  if (!g) return undefined;
  const rate = k.source === 'walk' ? UP_WALK : UP;
  if (!g.up) {
    // left: up from as far as the way down had got
    const reached = Math.min(g.D.length, g.t0 + Math.max(0, (k.at - g.at) / 1000));
    g = set(key, { ...g, up: true, at: k.at, t0: reached, from: k.from, rate });
  } else if (g.at !== k.at) {
    // gone on to something else while getting up (set off walking): on from where it had got, at that one's pace
    g = set(key, { ...g, at: k.at, t0: g.t0 - ((k.at - g.at) / 1000) * (g.rate ?? UP), from: k.from, rate });
  }
  const e = (ms - g.at) / 1000, t = g.t0 - e * (g.rate ?? UP);
  if (t <= -FADE) { GOT.delete(key); k.from = null; return undefined; }
  if (t <= 0) return blendLocal(downAt(sk, g.D, 0), now, smooth(-t / FADE));
  return from(g, e, downAt(sk, g.D, t));
}
function set(key: string, g: Got): Got {
  GOT.delete(key);
  GOT.set(key, g);
  if (GOT.size > MAX_GOT) GOT.delete(GOT.keys().next().value as string);
  return g;
}

/** Whether a body getting down is still on its way (its eyes open until it is down), by its key: none known, it is not. */
export function onTheWay(key: string, ms: number): boolean {
  const g = GOT.get(key);
  if (!g) return false;
  if (g.up) return true;
  return g.t0 + (ms - g.at) / 1000 < g.D.length * 0.85;
}

/**
 * Whether a body is sat or lain on the ground, or on its way down onto it or up (by its key, and the clip it plays): put
 * where its clip puts it, not stood on its lowest sole (`../lowpoly.ts`).
 */
export const onTheGround = (key: string, clip: string | undefined): boolean => GOT.has(key) || (clip !== undefined && DOWNS.has(clip));

/** The clips played with the eyes shut: asleep, meditating, praying with the head bowed. */
const SHUT = new Set(['sleep', 'meditate', 'pray']);
/** Whether a body's eyes are shut (by its key, and the clip it plays): in one of those, and down, not on its way down or up. */
export const eyesShut = (key: string, clip: string | undefined, ms: number): boolean => clip !== undefined && SHUT.has(clip) && !onTheWay(key, ms);
