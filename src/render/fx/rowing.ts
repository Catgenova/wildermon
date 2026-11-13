/**
 * Rowing: each oar's stroke followed as the figure rows it (`../figure.ts` oarsOf: the same stroke the oars are drawn
 * in), and while the boat is under way, the water's answer to it at each blade where it meets the water:
 *   - `oar` (`./water.ts`): drops as the blade goes in, at the catch;
 *   - `swirl`: the pair of whirls the blade leaves where it pulled, `SWIRL_LATE` of a stroke after the catch, left on the
 *     water as the boat goes on (`SWIRL_SECS`).
 * Nothing for a boat lying still.
 */
import { oarsOf } from '../figure';
import type { FollowFrame, FxFollower, V3 } from './types';

/** How far through the stroke after the catch, a share of it, the whirls are left: through the drive. */
export const SWIRL_LATE = 0.35;
/** Seconds a rower may go unseen and still be the same stroke. */
const GAP = 0.5;

/** Whether going from `a` to `b` round a stroke (shares, the short way forward) passed `at`. */
function passed(a: number, b: number, at: number): boolean {
  const d = (b - a + 1) % 1;
  return d > 0 && d < 0.5 && (at - a + 1) % 1 <= d && (at - a + 1) % 1 > 0;
}

export class Rowing implements FxFollower {
  private last = new Map<string, { s: [number, number]; at: number }>();

  follow(f: FollowFrame): void {
    const o = f.pose.moving ? oarsOf(f.pose) : null;
    if (!o) {
      this.last.delete(f.id);
      return;
    }
    const was = this.last.get(f.id);
    this.last.set(f.id, { s: o.strokes, at: f.now });
    if (this.last.size > 128) this.last.delete(this.last.keys().next().value as string);
    if (!was || f.now - was.at > GAP) return;
    let blades: V3[] | null = null;
    for (let k = 0; k < 2; k++) {
      const a = was.s[k], b = o.strokes[k];
      const into = passed(a, b, o.catch), pulled = passed(a, b, (o.catch + SWIRL_LATE) % 1);
      if (!into && !pulled) continue;
      blades ??= o.blades();
      const p = blades[k];
      if (!p) continue;
      const at = f.local(p), seed = Math.floor(f.now * 10) * 2 + k;
      if (into) f.fire('oar', at, { seed });
      if (pulled) {
        // the whirls either side of the blade, along the oar: outboard, the way of the blade from the boat's middle
        const out = f.local([p[0] * 1.2, p[1], 0]);
        f.fire('swirl', at, { way: { x: out.x - at.x, y: out.y - at.y, z: 0 }, seed: seed + 7 });
      }
    }
  }

  clear(): void {
    this.last.clear();
  }
}
