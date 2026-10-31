/**
 * The soundtrack, in the game and on the sign-in page.
 *
 * It plays through an audio context it is handed (in the game, the effects'
 * `Sound.audio`, so it starts off the same first click), at its own level
 * (`volume`, 0 for none), choosing among the tracks `pick` says may play now.
 * Asked of on every frame (`step`), it does small things there and nothing
 * else:
 *
 * - makes a little of the notes the coming bars need, a few milliseconds a
 *   frame, so no frame waits on a low note being worked out: the playing
 *   track's next bars first, then the next track's first bars, then the
 *   harp's bridge notes;
 * - once the first track's first bars are made, starts it and brings it up
 *   over a few seconds;
 * - keeps a second and a half of bars on the clock ahead of now;
 * - moves to another track when the playing one may no longer play (at the
 *   end of a phrase), or when it has been round once and another of the same
 *   moment is waiting its turn (at the top of the form): the outgoing one
 *   stops and rings, a harp bridge joins its last chord to the next one's
 *   first, and the two cross in an equal-power fade.
 *
 * Out of sight the frames stop, so the bars on the clock run out and the
 * music stops with them; back in sight it carries on from the bar it was at.
 * Turned down to nothing, nothing more is put on the clock.
 */
import { BRIDGE_NOTES, BRIDGE_SECS, BRIDGE_TOUCH, CROSSFADE, bridge, fade } from './bridge';
import { Conductor } from './conductor';
import { bus, Maker, roomMaking, type Bus } from './instruments';
import { chord, type Track } from './score';

/** Milliseconds a frame may spend making notes. */
const BUDGET_MS = 3;
/** Seconds of bars kept on the clock ahead of now. */
const LEAD = 1.5;
/** Bars ahead whose notes are made before they are needed. */
const AHEAD = 4;
/** Seconds the music takes to come up when it first starts. */
const FADE_IN = 4;
/** The music's level at a setting of 1, against the effects at theirs. */
const FULL = 1.2;

export interface Listening {
  /** The audio context to play through, once there is one running. */
  audio: () => AudioContext | null;
  /** The level, 0 to 1. */
  volume: () => number;
  /** The tracks that may play now; the first is the one to start with. */
  pick: () => readonly Track[];
}

/** The chord a track opens on. */
const opening = (t: Track): number[] => chord(t.sections[t.form[0].s][0].c.split('|')[0]);

export class Music {
  private master: GainNode | null = null;
  private bus: Bus | null = null;
  /** The track playing, and the one being readied to follow it. */
  private now: Conductor | null = null;
  private next: Conductor | null = null;
  /** Notes to make, and whether the next track (rather than the playing one) waits on each. */
  private queue: Array<{ maker: Maker; forNext: boolean }> = [];
  /** What `queue` was last filled for. */
  private queuedFor = '';
  /** The harp's bridge notes, made once the first track is playing and the queue is empty. */
  private harp: Maker[] | null = null;
  private started = false;
  /** The level last asked of `master`. */
  private level = 0;
  /** The room being made, before there is a bus to put it in. */
  private room: Generator<void, AudioBuffer, void> | null = null;

  constructor(private readonly listen: Listening) {}

  get volume(): number {
    return Math.max(0, Math.min(1, this.listen.volume()));
  }

  /** The track playing now, if any. */
  get playing(): Track | null {
    return this.now?.playing ?? null;
  }

  step(): void {
    const ctx = this.listen.audio();
    if (!ctx || ctx.state !== 'running') return;
    const vol = this.volume;
    if (!this.master || !this.bus) {
      if (vol <= 0) return;
      // The room first, a slice a frame, then the bus round it on the frame after.
      this.room ??= roomMaking(ctx);
      const until = performance.now() + BUDGET_MS;
      let r = this.room.next();
      while (!r.done && performance.now() < until) r = this.room.next();
      if (!r.done) return;
      this.bus = bus(ctx, { room: r.value });
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.bus.output.connect(this.master).connect(ctx.destination);
      // The notes start on the next frame.
      return;
    }
    const now = ctx.currentTime;
    if (this.started && this.level !== vol * FULL) {
      this.level = vol * FULL;
      this.master.gain.setTargetAtTime(this.level, now, 0.08);
    }
    if (vol <= 0) return;

    const pool = this.listen.pick();
    const cur = this.now?.playing ?? null;
    // Who follows: nobody yet if the one playing may stay and has no turn to give; otherwise the first of the
    // moment's that is not it.
    const leaving = !!cur && !pool.includes(cur);
    const turn = !!cur && pool.length > 1;
    const wanted = !cur ? pool[0] : leaving || turn ? pool.find((t) => t !== cur) ?? pool[0] : null;
    if (wanted && this.next?.playing !== wanted) this.next = this.cued(ctx, wanted);
    if (!wanted && this.next) this.next = null;

    this.make(ctx);

    if (!this.now) {
      // The first track: begun once its first bars are made, and brought up.
      if (!this.next || this.queue.length) return;
      this.started = true;
      this.level = vol * FULL;
      this.master.gain.setValueAtTime(0, now);
      this.master.gain.setTargetAtTime(this.level, now, FADE_IN / 3);
      this.next.out.gain.value = 1;
      this.next.begin(now + 0.2);
      this.now = this.next;
      this.next = null;
    }
    const ready = !!this.next && !this.queue.some((q) => q.forNext);
    const playingNow = this.now;
    const stopAt = playingNow.fill(now + LEAD, (n) =>
      ready && (leaving ? playingNow.phraseAt(n) : turn && playingNow.topAt(n)));
    if (stopAt !== null && this.next) this.cross(ctx, playingNow, this.next, stopAt);
  }

  /** A conductor readied on `track`, silent until it is crossed to. */
  private cued(ctx: AudioContext, track: Track): Conductor {
    const c = new Conductor(ctx, this.bus!);
    c.out.gain.value = 0;
    c.cue(track);
    return c;
  }

  /** From `from`, stopped at `at`, over a bridge into `to`. */
  private cross(ctx: AudioContext, from: Conductor, to: Conductor, at: number): void {
    const t = to.playing!;
    bridge(ctx, this.bus!.input, at, from.last, opening(t), this.bus!.wow);
    fade(from.out.gain, at, CROSSFADE, from.out.gain.value || 1, 0.0001);
    const begin = at + BRIDGE_SECS;
    to.begin(begin);
    fade(to.out.gain, begin - 0.5, CROSSFADE * 0.6, 0.0001, 1);
    // The tail has rung out well before this; then the outgoing nodes go.
    window.setTimeout(() => from.out.disconnect(), (begin - ctx.currentTime + CROSSFADE + 4) * 1000);
    this.now = to;
    this.next = null;
  }

  /** Makes notes for a few milliseconds: the playing track's coming bars, the next one's first, the bridge's harp. */
  private make(ctx: AudioContext): void {
    const key = `${this.now?.playing?.id ?? '-'}:${this.now?.bars ?? 0}:${this.next?.playing?.id ?? '-'}`;
    if (key !== this.queuedFor) {
      this.queuedFor = key;
      const mine = (c: Conductor | null, forNext: boolean): Array<{ maker: Maker; forNext: boolean }> =>
        (c ? c.wanted(AHEAD) : []).map((w) => ({ maker: new Maker(ctx, w.kind, w.m, w.vel), forNext }));
      this.queue = [...mine(this.now, false), ...mine(this.next, true)];
    }
    const until = performance.now() + BUDGET_MS;
    while (this.queue.length && performance.now() < until && this.queue[0].maker.work(until)) this.queue.shift();
    if (this.queue.length || !this.now) return;
    this.harp ??= BRIDGE_NOTES.map((m) => new Maker(ctx, 'harp', m, BRIDGE_TOUCH));
    while (this.harp.length && performance.now() < until && this.harp[0].work(until)) this.harp.shift();
  }
}
