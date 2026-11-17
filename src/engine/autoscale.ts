/**
 * Render scale on Auto (`SETTING_DEFAULTS.renderScale`): the share of the
 * pixels the screen and Graphics allow that is drawn, stepped down one level
 * while frames come further apart than the budget and kept down only where
 * that made them come quicker -- a frame held up by the drawing calls rather
 * than the pixels is no faster for fewer pixels, only blurred -- and back up
 * while the drawing takes under half the budget.
 */

/** The levels, as shares of the pixels allowed: the first is all of them. */
export const AUTO_SCALES = [1, 0.75, 0.5] as const;
/** Device pixels to a screen pixel Auto never goes under. */
export const AUTO_LEAST_DPR = 0.75;
/** Milliseconds of frames measured at a time, the median of each taken. */
export const AUTO_WINDOW_MS = 2000;
/** Over budget: frames this many times the budget apart. Two windows over steps down. */
export const AUTO_OVER = 1.25;
/** A step down kept: frames at least this share quicker than before it. */
export const AUTO_GAIN = 0.1;
/** Room to step up: drawing under this share of the budget, three windows running. */
export const AUTO_ROOM = 0.5;
/** Milliseconds a step that was taken back is not tried again. */
export const AUTO_HOLD_MS = 120_000;

const median = (a: number[]): number => {
  a.sort((x, y) => x - y);
  return a[a.length >> 1];
};

export class AutoScale {
  /** The level drawn at (`AUTO_SCALES`). */
  level = 0;
  private gaps: number[] = [];
  private works: number[] = [];
  private windowAt = 0;
  /** The window after a change is its new pictures being made, and not measured. */
  private settle = false;
  /** A step down being tried: the level before it and the frames' gap there. */
  private down: { from: number; gap: number } | null = null;
  /** A step up being tried: the level before it. */
  private up: number | null = null;
  private overN = 0;
  private roomN = 0;
  private downHeld = 0;
  private upHeld = 0;

  /** Back to all the pixels, measuring afresh: Auto chosen again, or the screen changed. */
  reset(now: number): void {
    this.level = 0;
    this.gaps.length = this.works.length = 0;
    this.windowAt = now;
    this.settle = true;
    this.down = null;
    this.up = null;
    this.overN = this.roomN = 0;
    this.downHeld = this.upHeld = 0;
  }

  /**
   * A frame drawn `gap` ms after the one before, `work` ms of it spent
   * drawing, against frames `budget` ms apart, with `least` the lowest level
   * allowed: the level to draw at from now.
   */
  frame(now: number, gap: number, work: number, budget: number, least: number): number {
    if (gap > 0 && gap < 1000) {
      this.gaps.push(gap);
      this.works.push(work);
    }
    if (now - this.windowAt < AUTO_WINDOW_MS) return this.level;
    this.windowAt = now;
    if (this.gaps.length < 8 || this.settle) {
      this.settle = false;
      this.gaps.length = this.works.length = 0;
      return this.level;
    }
    const g = median(this.gaps), w = median(this.works);
    this.gaps.length = this.works.length = 0;
    const over = g > budget * AUTO_OVER;
    if (this.down) {
      const d = this.down;
      this.down = null;
      if (g > d.gap * (1 - AUTO_GAIN)) {
        this.downHeld = now + AUTO_HOLD_MS;
        return this.go(d.from);
      }
    }
    if (this.up !== null) {
      const from = this.up;
      this.up = null;
      if (over) {
        this.upHeld = now + AUTO_HOLD_MS;
        return this.go(from);
      }
    }
    if (over) {
      this.roomN = 0;
      if (++this.overN >= 2 && this.level < least && now >= this.downHeld) {
        this.overN = 0;
        this.down = { from: this.level, gap: g };
        return this.go(this.level + 1);
      }
      return this.level;
    }
    this.overN = 0;
    if (this.level > 0 && w < budget * AUTO_ROOM) {
      if (++this.roomN >= 3 && now >= this.upHeld) {
        this.roomN = 0;
        this.up = this.level;
        return this.go(this.level - 1);
      }
    } else this.roomN = 0;
    return this.level;
  }

  private go(level: number): number {
    this.level = level;
    this.settle = true;
    return level;
  }
}

/** The lowest level Auto may go to with `dpr` device pixels to a screen pixel allowed at full scale. */
export function autoLeast(dpr: number): number {
  let least = 0;
  for (let i = 1; i < AUTO_SCALES.length; i++) if (dpr * AUTO_SCALES[i] >= AUTO_LEAST_DPR - 1e-9) least = i;
  return least;
}
