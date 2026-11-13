/**
 * Helpers for writing a clip pose to pose (`./clips/*.ts`): key poses on a timeline become the per-bone tracks of
 * `./clip.ts`, a pose is mirrored left for right, and a bone's keys can trail the beat (`lag`: overlapping action, the
 * arms catching up with the hips) or lead it.
 */
import type { Clip, EaseName, Foot, FootChannel, FootKeys, Key } from './clip';
import type { Euler } from './math';

/**
 * A key pose: each bone's turn (bones left out: at rest), the body's shift in body heights, and for a clip that keys its
 * feet (`Clip.feet`) where each foot is.
 */
export interface KeyPose { rot: Record<string, Euler>; move?: Euler; feet?: { l: Foot; r: Foot } }
/** A key pose on the timeline, how it is reached, and a name for the authoring tool's sheet. */
export interface Beat {
  t: number; pose: KeyPose; ease?: EaseName; hold?: number; back?: number; name?: string;
  /** A key pose (blocked first) or a breakdown between them (the default), for showing a clip's passes. */
  stage?: 'key' | 'breakdown';
  /** How some bones (`$move`: the shift; `$z_l`, `$lift_l`, `$pitch_l` and the right's: a foot's channels) reach this beat instead, by bone. */
  per?: Record<string, { ease?: EaseName; hold?: number; back?: number }>;
}

/** A pose mirrored: left for right, the turns across the body (ry, rz) and the shift across it reversed. */
export function mirror(p: KeyPose): KeyPose {
  const rot: Record<string, Euler> = {};
  for (const [bone, e] of Object.entries(p.rot)) {
    const m = /_(l|r)$/.exec(bone), to = m ? bone.slice(0, -1) + (m[1] === 'l' ? 'r' : 'l') : bone;
    rot[to] = [e[0], -e[1], -e[2]];
  }
  return { rot, move: p.move ? [-p.move[0], p.move[1], p.move[2]] : undefined, feet: p.feet ? { l: p.feet.r, r: p.feet.l } : undefined };
}
/** A beat's per-bone easings mirrored, left for right. */
export const mirrorPer = (per: Beat['per']): Beat['per'] => per && Object.fromEntries(Object.entries(per).map(([k, e]) => { const m = /_(l|r)$/.exec(k); return [m ? k.slice(0, -1) + (m[1] === 'l' ? 'r' : 'l') : k, e]; }));

/** Poses merged, the later's bones over the earlier's. */
export const merge = (...ps: KeyPose[]): KeyPose => ({ rot: Object.assign({}, ...ps.map((p) => p.rot)), move: ps.reduce<Euler | undefined>((m, p) => p.move ?? m, undefined), feet: ps.reduce<KeyPose['feet']>((f, p) => p.feet ?? f, undefined) });

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
  const { footKeys, ...k } = poseToPose(bs, { length: c.length, loop: c.loop });
  // a body's correction tracks as the beats are: only at the passes' beats, stepped where they are
  const at = new Set(bs.map((b) => b.t));
  const bodies = c.bodies && Object.fromEntries(Object.entries(c.bodies).map(([who, f]) => [who, f?.tracks ? { ...f, tracks: Object.fromEntries(Object.entries(f.tracks).map(([bone, keys]) => [bone, keys.filter((key) => at.has(key.t)).map((key) => (stepped ? { ...key, ...step } : key))])) } : f]));
  return { ...c, ...k, feet: c.feet && footKeys ? { stride: c.feet.stride, ...footKeys } : c.feet, accents, bodies, breath: undefined };
}

/** Key poses as tracks: every bone keyed at every beat, each bone's keys shifted by its `lag` (seconds; a loop wrapped). */
export function poseToPose(beats: Beat[], o: { length: number; loop: boolean; lag?: Record<string, number> }): { tracks: Record<string, Array<Key<Euler>>>; move: Array<Key<Euler>>; poses: Array<{ t: number; name: string }>; footKeys?: { l: FootKeys; r: FootKeys } } {
  const bones = new Set(beats.flatMap((b) => Object.keys(b.pose.rot)));
  const keyOf = <T>(b: Beat, t: number, v: T, bone: string): Key<T> => {
    const e = { ease: b.ease, hold: b.hold, back: b.back, ...b.per?.[bone] };
    return { t, v, ...(e.ease ? { ease: e.ease } : {}), ...(e.hold !== undefined ? { hold: e.hold } : {}), ...(e.back !== undefined ? { back: e.back } : {}) };
  };
  const at = (t: number): number => (o.loop ? ((t % o.length) + o.length) % o.length : Math.min(o.length, Math.max(0, t)));
  const tracks: Record<string, Array<Key<Euler>>> = {};
  for (const bone of bones) {
    const lag = o.lag?.[bone] ?? 0;
    tracks[bone] = beats.map((b) => keyOf(b, +at(b.t + lag).toFixed(4), b.pose.rot[bone] ?? [0, 0, 0], bone)).sort((a, b) => a.t - b.t);
  }
  const move = beats.map((b) => keyOf<Euler>(b, b.t, b.pose.move ?? [0, 0, 0], '$move'));
  // the feet, channel by channel, when every beat places them
  const keyed = beats.every((b) => b.pose.feet);
  const foot = (s: 'l' | 'r'): FootKeys => Object.fromEntries((['z', 'lift', 'pitch'] as FootChannel[]).map((ch) => [ch, beats.map((b) => keyOf(b, b.t, (b.pose.feet as { l: Foot; r: Foot })[s][ch], `$${ch}_${s}`))])) as FootKeys;
  return { tracks, move, poses: beats.filter((b) => b.name).map((b) => ({ t: b.t, name: b.name as string })), ...(keyed ? { footKeys: { l: foot('l'), r: foot('r') } } : {}) };
}

/** A bone's name on the other side (left for right), or itself. */
const otherSide = (bone: string): string => { const m = /_(l|r)$/.exec(bone); return m ? bone.slice(0, -1) + (m[1] === 'l' ? 'r' : 'l') : bone; };
/** Keys of turns mirrored (the turns across the body, ry and rz, reversed), or of a shift (`flip`: across it, x, reversed). */
const mirrorKeys = (keys: Array<Key<Euler>>, shift = false): Array<Key<Euler>> => keys.map((k) => ({ ...k, v: shift ? [-k.v[0], k.v[1], k.v[2]] : [k.v[0], -k.v[1], -k.v[2]] }));
const mirrorTracks = (t: Record<string, Array<Key<Euler>>>): Record<string, Array<Key<Euler>>> => Object.fromEntries(Object.entries(t).map(([b, keys]) => [otherSide(b), mirrorKeys(keys, b === '$move')]));
const swapSides = <T>(r: Partial<Record<'l' | 'r', T>> | undefined): Partial<Record<'l' | 'r', T>> | undefined => r && Object.fromEntries(Object.entries(r).map(([s, v]) => [s === 'l' ? 'r' : 'l', v]));
/**
 * A whole clip mirrored left for right, named `name`: every track, accent, the shift, the stance, each body's corrections,
 * the reached hands (their places and ways across the body reversed) and the tools in them swapped hand for hand.
 */
export function mirrorClip(c: Clip, name: string): Clip {
  const hands = swapSides(c.hands);
  return {
    ...c, name,
    tracks: mirrorTracks(c.tracks),
    ...(c.accents ? { accents: mirrorTracks(c.accents) } : {}),
    ...(c.move ? { move: mirrorKeys(c.move, true) } : {}),
    ...(c.plant ? { plant: { rot: Object.fromEntries(Object.entries(c.plant.rot).map(([b, e]) => [otherSide(b), [e[0], -e[1], -e[2]] as Euler])), ...(c.plant.move ? { move: [-c.plant.move[0], c.plant.move[1], c.plant.move[2]] as Euler } : {}) } } : {}),
    ...(c.bodies ? {
      bodies: Object.fromEntries(Object.entries(c.bodies).map(([who, f]) => [who, f && {
        ...f,
        ...(f.add ? { add: Object.fromEntries(Object.entries(f.add).map(([b, e]) => [otherSide(b), [e[0], -e[1], -e[2]] as Euler])) } : {}),
        ...(f.tracks ? { tracks: mirrorTracks(f.tracks) } : {}),
        ...(f.scale ? { scale: Object.fromEntries(Object.entries(f.scale).map(([b, k]) => [otherSide(b), k])) } : {}),
        ...(f.move !== undefined ? { move: f.move } : {}),
        ...(f.grip ? { grip: swapSides(f.grip) } : {}),
        ...(f.hands ? { hands: Object.fromEntries(Object.entries(f.hands).map(([s, d]) => [s === 'l' ? 'r' : 'l', d && [-d[0], d[1], d[2]]])) } : {}),
      }])),
    } : {}),
    ...(hands ? { hands: Object.fromEntries(Object.entries(hands).map(([s, h]) => [s, h && { at: mirrorKeys(h.at, true), way: [-h.way[0], h.way[1], h.way[2]] as Euler }])) } : {}),
    ...(c.tools ? { tools: swapSides(c.tools) } : {}),
    ...(c.strike ? { strike: { ...c.strike, side: c.strike.side === 'l' ? 'r' : 'l' } } : {}),
    // (the effect marks from the other side: a bone's on its mirror, a tool's in the other hand)
    ...(c.fx ? { fx: c.fx.map((m) => ({ ...m, from: 'bone' in m.from ? { bone: otherSide(m.from.bone) } : { ...m.from, side: m.from.side === 'l' ? 'r' : 'l' } })) } : {}),
  };
}
