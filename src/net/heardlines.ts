/**
 * Which of the island's lines this browser has heard, and which the beat
 * should ask for again (`Island.hearLine`, `Island.pulse`).
 *
 * The lines come down three roads -- Realtime on your own topic, Realtime on
 * the island's, and the beat's catch-up (`rpc_settle`'s `said`) -- and each
 * line carries its number in `event`. That number is drawn when the line is
 * told, not when its transaction commits, and the two topics are two
 * channels: a line of yours and a line to the island told a moment apart can
 * come in either order, and a long settle can commit after a short one that
 * drew a higher number. The cursor this replaces was the highest number
 * heard, and a line under it was taken for said: so a line to the island
 * heard first stepped over a line of yours still on its way, and the beat,
 * counting from the same cursor, stepped over it too. That was "sometimes an
 * action completes or fails with no description in the event log".
 *
 * So each line is heard once by its number, whatever order it comes in, and
 * the beat counts from a floor that moves up only past lines heard at least
 * `SAID_LAG_MS` before a beat that answered: by then every line numbered
 * under them has committed, and that beat has read it.
 */

/**
 * How long, in milliseconds, a line can come after a line numbered above it: longer than any statement runs on
 * the island (the keeper's statement timeout is eight seconds), with room to spare.
 */
export const SAID_LAG_MS = 15000;
/** The most lines kept above the floor; past it the oldest are let go and the floor moves up past them. */
export const HEARD_MOST = 2000;

export class HeardLines {
  /** Every line at or below this has been heard, or is not this body's; the beat asks for what is above it (`p_said`). */
  floor = 0;
  /** The highest line heard, for a message that says only how far the island has got (`upto`). */
  top = 0;
  /** Lines above the floor already heard, and when, on `now`'s clock. */
  private readonly heard = new Map<number, number>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Start from a mark: where the island's lines stood when you came ashore (`rpc_join`'s `saidTo`). */
  from(mark: number): void {
    this.heard.clear();
    this.floor = Math.max(0, mark);
    this.top = this.floor;
  }

  /** Nothing at or below a mark is to be read again: the island's answer to a first beat (`saidTo`). */
  mark(mark: number): void {
    if (mark <= this.floor) return;
    this.floor = mark;
    this.top = Math.max(this.top, mark);
    for (const n of this.heard.keys()) if (n <= mark) this.heard.delete(n);
  }

  /** Whether line `n` is new: true the first time it is heard, by any road; false at or below the floor, or again. */
  first(n: number): boolean {
    if (n <= this.floor || this.heard.has(n)) return false;
    this.heard.set(n, this.now());
    if (n > this.top) this.top = n;
    if (this.heard.size > HEARD_MOST) {
      const oldest = [...this.heard.keys()].sort((a, b) => a - b).slice(0, this.heard.size - HEARD_MOST);
      this.mark(oldest[oldest.length - 1]);
    }
    return true;
  }

  /**
   * A beat asked at `asked` (on `now`'s clock) has answered, its lines heard: the floor moves up to the highest
   * line heard at least `SAID_LAG_MS` before it. Every line numbered under that one was told before it was, so
   * had committed by the time the beat read, and the beat read everything above the floor it was sent with.
   */
  settled(asked: number): void {
    let to = this.floor;
    for (const [n, at] of this.heard) if (n > to && at <= asked - SAID_LAG_MS) to = n;
    this.mark(to);
  }
}
