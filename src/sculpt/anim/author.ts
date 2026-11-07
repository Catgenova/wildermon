/**
 * Helpers for writing a clip pose to pose (`./clips/*.ts`): key poses on a timeline become the per-bone tracks of
 * `./clip.ts`, a pose is mirrored left for right, and a bone's keys can trail the beat (`lag`: overlapping action, the
 * arms catching up with the hips) or lead it.
 */
import type { Clip, EaseName, Key } from './clip';
import type { Euler } from './math';

/** A key pose: each bone's turn (bones left out: at rest), and the body's shift in body heights. */
export interface KeyPose { rot: Record<string, Euler>; move?: Euler }
/** A key pose on the timeline, how it is reached, and a name for the authoring tool's sheet. */
export interface Beat {
  t: number; pose: KeyPose; ease?: EaseName; hold?: number; back?: number; name?: string;
  /** A key pose (blocked first) or a breakdown between them (the default), for showing a clip's passes. */
  stage?: 'key' | 'breakdown';
  /** How some bones (`$move`: the shift) reach this beat instead, by bone. */
  per?: Record<string, { ease?: EaseName; hold?: number; back?: number }>;
}

/** A pose mirrored: left for right, the turns across the body (ry, rz) and the shift across it reversed. */
export function mirror(p: KeyPose): KeyPose {
  const rot: Record<string, Euler> = {};
  for (const [bone, e] of Object.entries(p.rot)) {
    const m = /_(l|r)$/.exec(bone), to = m ? bone.slice(0, -1) + (m[1] === 'l' ? 'r' : 'l') : bone;
    rot[to] = [e[0], -e[1], -e[2]];
  }
  return { rot, move: p.move ? [-p.move[0], p.move[1], p.move[2]] : undefined };
}

/** Poses merged, the later's bones over the earlier's. */
export const merge = (...ps: KeyPose[]): KeyPose => ({ rot: Object.assign({}, ...ps.map((p) => p.rot)), move: ps.reduce<Euler | undefined>((m, p) => p.move ?? m, undefined) });

/**
 * A pose-to-pose clip as it stood at an earlier pass, to show how it was built: `blocking` its key poses only, held
 * (stepped); `breakdowns` every beat and accent, still stepped; `splined` eased between them; `polish` the clip itself
 * (the lag, the breathing). The feet stay planted throughout.
 */
export function passOf(c: Clip, beats: Beat[], pass: 'blocking' | 'breakdowns' | 'splined' | 'polish'): Clip {
  if (pass === 'polish') return c;
  const step = { ease: 'hold' as const, hold: 1 }, stepped = pass !== 'splined';
  const bs = beats.filter((b) => pass !== 'blocking' || b.stage === 'key').map((b) => (stepped ? { ...b, ...step, per: undefined } : b));
  const accents = pass === 'blocking' ? undefined : Object.fromEntries(Object.entries(c.accents ?? {}).map(([k, keys]) => [k, keys.map((key) => (stepped ? { ...key, ...step } : key))]));
  return { ...c, ...poseToPose(bs, { length: c.length, loop: c.loop }), accents, breath: undefined };
}

/** Key poses as tracks: every bone keyed at every beat, each bone's keys shifted by its `lag` (seconds; a loop wrapped). */
export function poseToPose(beats: Beat[], o: { length: number; loop: boolean; lag?: Record<string, number> }): { tracks: Record<string, Array<Key<Euler>>>; move: Array<Key<Euler>>; poses: Array<{ t: number; name: string }> } {
  const bones = new Set(beats.flatMap((b) => Object.keys(b.pose.rot)));
  const keyOf = (b: Beat, t: number, v: Euler, bone: string): Key<Euler> => {
    const e = { ease: b.ease, hold: b.hold, back: b.back, ...b.per?.[bone] };
    return { t, v, ...(e.ease ? { ease: e.ease } : {}), ...(e.hold !== undefined ? { hold: e.hold } : {}), ...(e.back !== undefined ? { back: e.back } : {}) };
  };
  const at = (t: number): number => (o.loop ? ((t % o.length) + o.length) % o.length : Math.min(o.length, Math.max(0, t)));
  const tracks: Record<string, Array<Key<Euler>>> = {};
  for (const bone of bones) {
    const lag = o.lag?.[bone] ?? 0;
    tracks[bone] = beats.map((b) => keyOf(b, +at(b.t + lag).toFixed(4), b.pose.rot[bone] ?? [0, 0, 0], bone)).sort((a, b) => a.t - b.t);
  }
  const move = beats.map((b) => keyOf(b, b.t, b.pose.move ?? [0, 0, 0], '$move'));
  return { tracks, move, poses: beats.filter((b) => b.name).map((b) => ({ t: b.t, name: b.name as string })) };
}
