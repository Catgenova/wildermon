/**
 * The effect marks on the clips (`./anim/clip.ts` Clip.fx), followed body by body: which marks a body's clip crossed since
 * its last frame, and where each has the body, for the renderer's action effects (`../render/fx/actions.ts`).
 *
 * A body's clip time is the clip player's own (`./anim` clipFor: the island's clock for a loop stood at, a timed job's go
 * fitted to its length by `fitTime`), so a mark fires on every screen at the moment the body is drawn crossing it, with
 * nothing sent. Followed per body by its id:
 *   - a mark fires once as the time passes it going forward, however many runs of a loop a frame covers;
 *   - time going back a little (a frame drawn again, a clock put right) fires nothing and nothing fires twice; going back
 *     further than `REWIND` (a new go of a job, from its start) lets the marks fire again from there;
 *   - a change of clip, a body not seen for `GAP`, or a frame that leaps more than `SKIP` of the clip starts afresh from
 *     where it is now, firing nothing: no storm of marks after a stall.
 *
 * Where a mark has a body is worked out with the skeleton the sculpted draw uses (`./lowpoly.ts` lowBodyOf), at the mark's
 * own moment of the clip (not the frame's), stood on its soles as the draw stands it, in the figure's frame; and kept per
 * body, clip, mark and what is held, so a crowd at work costs a few lookups a frame.
 */
import type { FigurePose } from '../render/figure';
import type { FxCross, FxPoint, SculptFx, V3 } from '../render/fx/types';
import { clipFor, heldIn, toolsIn } from './anim';
import { marksBetween, markTime, wrap, type Clip, type FxFrom } from './anim/clip';
import { clipLocal } from './anim/player';
import type { Held } from './anim/skeleton';
import { lowBodyOf } from './lowpoly';

/** Seconds of clip a frame may go back and still be the same go (nothing fires again); further back is a new go. */
export const REWIND = 0.25;
/** Seconds of clip a frame may leap and still fire what it crossed; further starts afresh. */
export const SKIP = 0.5;
/** Seconds on the drawing clock a body may go unseen before it starts afresh. */
export const GAP = 0.5;
/** Seconds of clip before a mark the point is found again at, for the way it was going. */
const WAY_DT = 1 / 60;
/** Bodies followed, and points kept, at most. */
const MOST_BODIES = 256, MOST_POINTS = 512;

interface Followed { clip: string; t: number; upTo: number; at: number }
const FOLLOWED = new Map<string, Followed>();
const POINTS = new Map<string, FxPoint | null>();
const NONE: readonly FxCross[] = [];

const bodyOf = (pose: FigurePose): 'man' | 'woman' => (pose.look?.gender === 'woman' ? 'woman' : 'man');

/** The marks body `id`'s clip crossed since it was last asked of (see the top of this file). */
export function fxTrack(id: string, pose: FigurePose, now: number): readonly FxCross[] {
  const body = bodyOf(pose), c = clipFor(pose, body);
  let s = FOLLOWED.get(id);
  if (!c || !c.clip.fx?.length) {
    if (s) FOLLOWED.delete(id);
    return NONE;
  }
  const t = c.t, name = c.clip.name;
  if (s) FOLLOWED.delete(id);
  if (!s || s.clip !== name || now - s.at > GAP || now < s.at) {
    FOLLOWED.set(id, { clip: name, t, upTo: t, at: now });
    if (FOLLOWED.size > MOST_BODIES) FOLLOWED.delete(FOLLOWED.keys().next().value as string);
    return NONE;
  }
  FOLLOWED.set(id, s);
  s.at = now;
  if (t < s.t) {
    if (s.t - t > REWIND) s.upTo = t;
    s.t = t;
    return NONE;
  }
  if (t - s.t > SKIP) {
    s.t = s.upTo = t;
    return NONE;
  }
  const from = Math.max(s.t, s.upTo);
  s.t = t;
  if (t <= from) return NONE;
  s.upTo = t;
  const clip = c.clip;
  return marksBetween(clip, from, t).map(({ i, run }) => {
    const mark = (clip.fx as NonNullable<Clip['fx']>)[i];
    return { mark, i, run, clip: name, point: () => pointOf(pose, body, clip, markTime(clip, mark), mark.from) };
  });
}

/** A point of a body as its clip has it now, or null where it plays none. */
export function fxPoint(pose: FigurePose, from: FxFrom): FxPoint | null {
  const body = bodyOf(pose), c = clipFor(pose, body);
  return c ? pointOf(pose, body, c.clip, wrap(c.clip, c.t), from, false) : null;
}

/** Where a clip at time `t` has a point of a body, in the figure's frame, and which way it was going; kept when `keep`. */
function pointOf(pose: FigurePose, body: 'man' | 'woman', c: Clip, t: number, from: FxFrom, keep = true): FxPoint | null {
  const ids = c.tools ? toolsIn(pose, body)?.tools : undefined, held = heldIn(pose);
  const key = keep ? `${body}|${c.name}|${t.toFixed(4)}|${'bone' in from ? from.bone : `${from.tool}:${from.side ?? 'r'}`}|${held ?? ''}|${ids?.l ?? ''}|${ids?.r ?? ''}` : '';
  if (keep && POINTS.has(key)) return POINTS.get(key) as FxPoint | null;
  const a = placeAt(body, c, t, from, ids, held);
  let out: FxPoint | null = null;
  if (a) {
    const b = placeAt(body, c, c.loop ? t - WAY_DT : Math.max(0, t - WAY_DT), from, ids, held);
    const d: V3 | null = b ? [a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]] : null, l = d ? Math.hypot(d[0], d[1], d[2]) : 0;
    out = { at: a.at, way: d && l > 1e-4 ? [d[0] / l, d[1] / l, d[2] / l] : null, ...(a.held ? { held: a.held } : {}) };
  }
  if (keep) {
    POINTS.set(key, out);
    if (POINTS.size > MOST_POINTS) POINTS.delete(POINTS.keys().next().value as string);
  }
  return out;
}

type MV = [number, number, number];
const addV = (a: MV, b: MV): MV => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulMV = (m: number[], v: MV): MV => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/**
 * A body posed as clip `c` has it at `t` (as `./anim` animate plays it: the job's tools in the fists, what is held in both
 * hands where the clip grips it, the weapon a clip wields in its fists), and the point `from` names on it, in the figure's
 * frame, stood on its soles; and the id of what that point is on. (The work brought to a shorter tool, which moves the
 * other hand only, is left out.)
 */
function placeAt(body: 'man' | 'woman', c: Clip, t: number, from: FxFrom, ids: Partial<Record<'l' | 'r', string>> | undefined, heldId: string | undefined): { at: V3; held?: string } | null {
  const B = lowBodyOf(body), sk = B.skeleton;
  const held = heldId === undefined ? undefined : B.heldOf(heldId);
  const wield = c.wields && held ? { hold: { l: held, r: held } } : {};
  const r = clipLocal(sk, c, wrap(c, t), c.grip ? held : undefined, B.toolHeld, { ids, ...wield });
  const F = sk.fk(r.local, r.move), up: MV = [0, B.lift(r.local, r.move), 0];
  if ('bone' in from) {
    const i = sk.at.get(from.bone), f = i === undefined ? undefined : F[i];
    return f ? { at: B.toGame(addV(f.P as MV, up)) } : null;
  }
  // What the hand holds: the job's tool or the one-handed weapon in that fist; else what both hands grip, or the clip wields
  // (in the lead fist, the right; a wielded bow in its own)
  const side = from.side ?? 'r', id = ids?.[side];
  let h: Held | undefined, k = side === 'l' ? 0 : 1, what = id;
  if (id) h = B.toolHeld(id);
  else if (held && (c.grip || c.wields)) { h = held; what = heldId; k = c.wields ? (c.wields === 'l' ? 0 : 1) : 1; }
  if (!h) return null;
  const g = sk.gripOf(F, h)[k], hh = h;
  const along = (p: readonly number[]): MV => addV(g.at as MV, mulMV(g.R, [(p[0] ?? 0) / hh.scale, ((p[1] ?? 0) - hh.lead) / hh.scale, (p[2] ?? 0) / hh.scale]));
  let p: MV;
  if (from.tool === 'grip') p = g.at as MV;
  else if (from.tool === 'tip') p = along([0, h.tip, 0]);
  else if (h.contact) p = along(h.contact);
  else if (h.ends?.length) {
    // the lowest of its far end: what meets the ground or the work
    p = along(h.ends[0]);
    for (const e of h.ends) { const q = along(e); if (q[1] < p[1]) p = q; }
  } else p = along([0, h.tip, 0]);
  return { at: B.toGame(addV(p, up)), ...(what ? { held: what } : {}) };
}

/** What the sculpted bodies' chunk gives the effects (`../render/figure.ts` sculptFx). */
export const SCULPT_FX: SculptFx = { track: fxTrack, point: fxPoint };
