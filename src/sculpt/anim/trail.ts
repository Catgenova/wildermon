/**
 * The slash trail: the sweep of a held blade over a clip's downward blow, drawn as a ribbon (`../gl` drawSculptGL) between
 * the blade's point and a point along it, from where the blow starts (the clip's `strike` event) to where the blade is now,
 * its last (the `impact` event) faded out over `FADE` seconds after it. Widest at the blade, tapering to nothing at the
 * tail. The blade's path is the clip's own (its strike is never stretched: `Clip.stretch`), sampled once per body and held
 * prop, so a frame costs a few interpolations; a clip with no `strike` and `impact` events, or out of that window, none.
 */
import type { Clip } from './clip';
import { clipLocal } from './player';
import { add, scl, sub, type V } from './math';
import type { Held, Skeleton } from './skeleton';

/** Seconds the trail takes to fade after the blow lands. */
export const FADE = 0.16;
/** Seconds of clip between samples of the blade's path. */
const STEP = 1 / 200;
/** Points along the ribbon from its tail to the blade. */
const SEGMENTS = 20;
/** How far along the blade, from the lead fist to the point, the ribbon's inner edge is at the blade (where the prop does not say, `Held.inner`). */
const INNER = 0.3;

/** The blade at a moment: its point and the ribbon's inner edge, the mesh's units and axes. */
interface Sample { inner: V; tip: V }
interface Path { from: number; to: number; samples: Sample[] }
const PATHS = new WeakMap<Clip, Map<Skeleton, Map<Held, Path | null>>>();

/** The clip's blow, its blade's path for a body holding a prop: none for a clip without the events. */
function pathOf(sk: Skeleton, c: Clip, held: Held): Path | null {
  let bySk = PATHS.get(c);
  if (!bySk) PATHS.set(c, (bySk = new Map()));
  let byHeld = bySk.get(sk);
  if (!byHeld) bySk.set(sk, (byHeld = new Map()));
  let p = byHeld.get(held);
  if (p !== undefined) return p;
  const from = c.events?.find((e) => e.name === 'strike')?.t, to = c.events?.find((e) => e.name === 'impact')?.t;
  if (from === undefined || to === undefined || to <= from) { byHeld.set(held, null); return null; }
  const samples: Sample[] = [], n = Math.ceil((to - from) / STEP);
  for (let k = 0; k <= n; k++) {
    const r = clipLocal(sk, c, from + ((to - from) * k) / n, held), g = sk.gripOf(sk.fk(r.local, r.move), held)[1];
    const along = (y: number): V => add(g.at, scl(g.way, (y - held.lead) / held.scale));
    samples.push({ inner: along(held.inner ?? held.lead + INNER * (held.tip - held.lead)), tip: along(held.tip) });
  }
  byHeld.set(held, (p = { from, to, samples }));
  return p;
}

const lerp = (a: V, b: V, w: number): V => add(a, scl(sub(b, a), w));
/** The blade on the path at clip time t (within it). */
function bladeAt(p: Path, t: number): Sample {
  const x = ((Math.min(p.to, Math.max(p.from, t)) - p.from) / (p.to - p.from)) * (p.samples.length - 1), i = Math.min(p.samples.length - 2, Math.floor(x)), w = x - i;
  const a = p.samples[i], b = p.samples[i + 1];
  return { inner: lerp(a.inner, b.inner, w), tip: lerp(a.tip, b.tip, w) };
}

/**
 * The trail at clip time t (wrapped to the clip) for a body holding a prop: from its tail to the blade, each point's inner
 * edge and its point (the mesh's units and axes; the inner edge drawn in toward the point as the ribbon thins) and how
 * opaque it is (nought to one); none outside the blow and its fade.
 */
export function slashTrail(sk: Skeleton, c: Clip, t: number, held: Held): Array<{ inner: V; tip: V; a: number }> | undefined {
  const p = pathOf(sk, c, held);
  if (!p || t < p.from || t > p.to + FADE) return undefined;
  // after the blow: faded out, the tail drawn on toward the blade as it goes
  const after = Math.max(0, (t - p.to) / FADE), head = Math.min(t, p.to), tail = p.from + (head - p.from) * 0.7 * after, fade = 1 - after * after;
  if (head - tail < STEP || fade <= 0) return undefined;
  const out: Array<{ inner: V; tip: V; a: number }> = [];
  for (let k = 0; k <= SEGMENTS; k++) {
    const u = k / SEGMENTS, s = bladeAt(p, tail + (head - tail) * u);
    out.push({ inner: lerp(s.tip, s.inner, Math.pow(u, 1.4)), tip: s.tip, a: fade * Math.pow(u, 0.7) });
  }
  return out;
}
