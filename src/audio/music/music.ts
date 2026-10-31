/**
 * The soundtrack, in the game.
 *
 * It shares the effects' audio context (`Sound.audio`), so it starts off the
 * same first click or key, and has its own level beside theirs:
 * `settings.music`, 0 for none. Asked of on every frame (`step`), it does
 * three small things there and nothing else:
 *
 * - makes a little of the next notes the coming bars need, a few milliseconds
 *   a frame, so no frame waits on a low note being worked out;
 * - once the first bars' notes are made, starts the track and brings it up
 *   over a few seconds;
 * - keeps a second and a half of bars on the clock ahead of now.
 *
 * Out of sight the frames stop, so the bars on the clock run out and the
 * music stops with them; back in sight it carries on from the bar it was at.
 * Turned down to nothing, nothing more is put on the clock.
 */
import type { Game } from '../../game/game';
import { Conductor } from './conductor';
import { bus, Maker, roomMaking } from './instruments';
import { BLOSSOM } from './tracks/blossom';

/** Milliseconds a frame may spend making notes. */
const BUDGET_MS = 3;
/** Seconds of bars kept on the clock ahead of now. */
const LEAD = 1.5;
/** Bars ahead whose notes are made before they are needed. */
const AHEAD = 4;
/** Seconds the music takes to come up when it starts. */
const FADE_IN = 4;
/** The music's level at a setting of 1, against the effects at theirs. */
const FULL = 1.2;

export class Music {
  private master: GainNode | null = null;
  private conductor: Conductor | null = null;
  private queue: Maker[] = [];
  /** `conductor.bars` when `queue` was last filled. */
  private queuedAt = -1;
  private started = false;
  /** The level last asked of `master`. */
  private level = 0;
  /** The room being made, before there is a bus to put it in. */
  private room: Generator<void, AudioBuffer, void> | null = null;

  constructor(private readonly game: Game, private readonly audio: () => AudioContext | null) {}

  get volume(): number {
    return Math.max(0, Math.min(1, this.game.settings.music));
  }

  step(): void {
    const ctx = this.audio();
    if (!ctx || ctx.state !== 'running') return;
    const vol = this.volume;
    if (!this.master || !this.conductor) {
      if (vol <= 0) return;
      // The room first, a slice a frame, then the bus round it on the frame after.
      this.room ??= roomMaking(ctx);
      const until = performance.now() + BUDGET_MS;
      let r = this.room.next();
      while (!r.done && performance.now() < until) r = this.room.next();
      if (!r.done) return;
      const b = bus(ctx, { room: r.value });
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      b.output.connect(this.master).connect(ctx.destination);
      this.conductor = new Conductor(ctx, b);
      this.conductor.cue(BLOSSOM);
      // The notes start on the next frame.
      return;
    }
    const c = this.conductor;
    const now = ctx.currentTime;
    if (this.started && this.level !== vol * FULL) {
      this.level = vol * FULL;
      this.master.gain.setTargetAtTime(this.level, now, 0.08);
    }
    if (vol <= 0) return;

    if (this.queuedAt !== c.bars) {
      this.queue = c.wanted(AHEAD).map((w) => new Maker(ctx, w.kind, w.m, w.vel));
      this.queuedAt = c.bars;
    }
    const until = performance.now() + BUDGET_MS;
    while (this.queue.length && performance.now() < until && this.queue[0].work(until)) this.queue.shift();

    if (!this.started) {
      if (this.queue.length) return;
      this.started = true;
      this.level = vol * FULL;
      this.master.gain.setValueAtTime(0, now);
      this.master.gain.setTargetAtTime(this.level, now, FADE_IN / 3);
      c.begin(now + 0.2);
    }
    c.fill(now + LEAD);
  }
}
