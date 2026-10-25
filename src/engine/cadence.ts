/**
 * Input timing, counted for the island's watch (`rpc_input_note`, in
 * 20261026050100): how regular clicks and keypresses are over a long run, how
 * many mouse clicks came with no pointer movement before them, and how many
 * were dispatched by a script. A flag for a keeper to look at, never a refusal.
 *
 * One listener per kind of event on the window, passive, a few sums each: no
 * work in the frame, no allocation per event. `take()` hands over what was
 * counted since the last `take()` and starts again.
 */

/** A gap longer than this ends a run, in ms. */
export const RUN_GAP_MS = 10_000;

/** One summary, as `rpc_input_note` reads it. */
export interface InputNote {
  /** Intervals in the longest-kept run of clicks, their mean in ms, and their spread in parts per thousand of the mean. */
  clicks: number;
  click_ms: number;
  click_cv: number;
  /** The same for keys pressed, held-key repeats left out. */
  keys: number;
  key_ms: number;
  key_cv: number;
  /** Mouse clicks, and those with no pointer movement since the click before, at the same spot. */
  mouse: number;
  still: number;
  /** Clicks and keys dispatched by a script (`isTrusted` false). */
  synthetic: number;
}

/** A run of intervals, by Welford's sums. */
class Run {
  n = 0;
  mean = 0;
  m2 = 0;
  last = -1;
  /** The run of the most intervals since the last take, as `[n, mean ms, spread per mille]`. */
  best: [number, number, number] = [0, 0, 0];

  at(t: number): void {
    if (this.last >= 0) {
      const dt = t - this.last;
      if (dt > RUN_GAP_MS) this.close();
      else {
        this.n++;
        const d = dt - this.mean;
        this.mean += d / this.n;
        this.m2 += d * (dt - this.mean);
      }
    }
    this.last = t;
  }

  close(): void {
    if (this.n > this.best[0] && this.mean > 0) {
      const sd = Math.sqrt(this.m2 / this.n);
      this.best = [this.n, Math.round(this.mean), Math.round((sd / this.mean) * 1000)];
    }
    this.n = 0;
    this.mean = 0;
    this.m2 = 0;
  }

  /** The run kept since the last take, the one in progress included, and a fresh start from the last event. */
  take(): [number, number, number] {
    this.close();
    const kept = this.best;
    this.best = [0, 0, 0];
    return kept;
  }
}

export class Cadence {
  private clickRun = new Run();
  private keyRun = new Run();
  private mouse = 0;
  private still = 0;
  private synthetic = 0;
  private moved = true;
  private lastX = NaN;
  private lastY = NaN;

  constructor(target: Window = window) {
    const opts = { capture: true, passive: true } as const;
    target.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.moved = true;
    }, opts);
    target.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!e.isTrusted) this.synthetic++;
      this.clickRun.at(e.timeStamp);
      if (e.pointerType !== 'mouse') return;
      this.mouse++;
      if (!this.moved && e.clientX === this.lastX && e.clientY === this.lastY) this.still++;
      this.moved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }, opts);
    // A click with no pointerdown before it is a script's, or a key on a focused button.
    target.addEventListener('click', (e: MouseEvent) => {
      if (!e.isTrusted) this.synthetic++;
    }, opts);
    target.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!e.isTrusted) this.synthetic++;
      if (!e.repeat) this.keyRun.at(e.timeStamp);
    }, opts);
  }

  /** What was counted since the last take, or null when nothing was. */
  take(): InputNote | null {
    const [clicks, click_ms, click_cv] = this.clickRun.take();
    const [keys, key_ms, key_cv] = this.keyRun.take();
    const note: InputNote = {
      clicks, click_ms, click_cv, keys, key_ms, key_cv, mouse: this.mouse, still: this.still, synthetic: this.synthetic,
    };
    this.mouse = 0;
    this.still = 0;
    this.synthetic = 0;
    return clicks || keys || note.mouse || note.synthetic ? note : null;
  }
}
