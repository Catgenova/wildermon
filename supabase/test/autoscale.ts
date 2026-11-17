/**
 * Render scale on Auto (`src/engine/autoscale.ts`).
 *
 *   * frames twice the budget apart that come quicker for fewer pixels: one step down, then the next, never under
 *     `AUTO_LEAST_DPR`;
 *   * frames held up by the drawing calls rather than the pixels, no quicker a step down: the step taken back, and
 *     not tried again for `AUTO_HOLD_MS`;
 *   * drawing under `AUTO_ROOM` of the budget a step down: back up;
 *   * frames within the budget: all the pixels, never a step.
 */
import { AUTO_HOLD_MS, AUTO_LEAST_DPR, AUTO_SCALES, AUTO_WINDOW_MS, AutoScale, autoLeast } from '../../src/engine/autoscale';
import { check, finish } from './harness';

const BUDGET = 1000 / 60;
/** Frames run for `ms` with a gap and work each level gives; the levels seen at each window's end. */
function run(a: AutoScale, t0: number, ms: number, at: (level: number) => [number, number], least = 2): [number, number[]] {
  let t = t0;
  const seen: number[] = [];
  let lastWin = Math.floor(t0 / AUTO_WINDOW_MS);
  while (t < t0 + ms) {
    const [gap, work] = at(a.level);
    t += gap;
    a.frame(t, gap, work, BUDGET, least);
    const win = Math.floor(t / AUTO_WINDOW_MS);
    if (win !== lastWin) {
      seen.push(a.level);
      lastWin = win;
    }
  }
  return [t, seen];
}

// The pixels the cost: 50 ms at all of them, falling with their square.
const fill = (l: number): [number, number] => [50 * AUTO_SCALES[l] ** 2, 40 * AUTO_SCALES[l] ** 2];
{
  const a = new AutoScale();
  a.reset(0);
  const [, seen] = run(a, 0, 40_000, fill);
  check('pixel-bound frames over budget: down a step, then to the last', seen.includes(1) && a.level === AUTO_SCALES.length - 1, seen.join(','));
}
{
  const a = new AutoScale();
  a.reset(0);
  run(a, 0, 40_000, fill, 1);
  check('never under the least level allowed', a.level === 1, String(a.level));
  check(`at ${AUTO_LEAST_DPR} or more device pixels to a screen pixel: 1× allows down to ${AUTO_SCALES[autoLeast(1)]}, 2× to ${AUTO_SCALES[autoLeast(2)]}`,
    AUTO_SCALES[autoLeast(1)] >= AUTO_LEAST_DPR && AUTO_SCALES[autoLeast(2)] * 2 >= AUTO_LEAST_DPR && autoLeast(2) === AUTO_SCALES.length - 1);
}
// The drawing calls the cost: 50 ms whatever the pixels.
{
  const a = new AutoScale();
  a.reset(0);
  const [t, seen] = run(a, 0, 20_000, () => [50, 45]);
  check('call-bound frames: a step tried and taken back', seen.includes(1) && a.level === 0, seen.join(','));
  const [, later] = run(a, t, AUTO_HOLD_MS - 20_000, () => [50, 45]);
  check(`not tried again for ${AUTO_HOLD_MS / 60_000} min`, later.every((l) => l === 0), later.join(','));
}
{
  const a = new AutoScale();
  a.reset(0);
  let heavy = true;
  const [t] = run(a, 0, 30_000, (l) => (heavy ? fill(l) : [BUDGET, 2]));
  const low = a.level;
  heavy = false;
  run(a, t, 40_000, () => [BUDGET, 2]);
  check('drawing light again: back up to all the pixels', low > 0 && a.level === 0, `${low} -> ${a.level}`);
}
{
  const a = new AutoScale();
  a.reset(0);
  const [, seen] = run(a, 0, 60_000, () => [BUDGET, 12]);
  check('frames within budget: all the pixels throughout', seen.every((l) => l === 0), seen.join(','));
}

finish('Render scale on Auto');
