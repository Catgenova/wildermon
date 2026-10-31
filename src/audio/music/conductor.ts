/**
 * Plays a track: turns its bars into notes on the audio clock, a little
 * ahead of time, for as long as it is asked to.
 *
 * Nothing here runs on a timer of its own. Whoever owns the conductor calls
 * `fill` with how far ahead to have scheduled — the game from its frame, a
 * render all at once — and every bar that starts before then is put on the
 * clock in one go. A bar is several seconds long at these tempos, so a
 * second's lead is plenty and costs nothing.
 *
 * Making a note is the one costly thing (`note` in `instruments.ts` works it
 * out sample by sample), so `wanted` says which notes the coming bars need
 * that are not made yet, for the owner to make in the gaps between frames
 * before `fill` gets to them.
 */
import { isMade, madeFor, note, pad, strike, type Bus, type Struck } from './instruments';
import { formBars, locate, play, type Track } from './score';

/** How loud each instrument is for a touch. */
const GAIN: Readonly<Record<Struck, (vel: number) => number>> = {
  piano: (v) => 0.07 + 0.45 * v ** 1.5,
  harp: (v) => 0.035 + 0.15 * v,
  musicbox: (v) => 0.03 + 0.14 * v,
  celesta: (v) => 0.03 + 0.14 * v,
};

/** Where each instrument sits: the piano low to the left and high to the right, as from the bench. */
const PAN: Readonly<Record<Struck, (m: number) => number>> = {
  piano: (m) => ((m - 60) / 48) * 0.55,
  harp: (m) => ((m - 55) / 36) * 0.6 - 0.15,
  musicbox: () => 0.35,
  celesta: () => -0.3,
};

/** The pad's level under the piano. */
const PAD_GAIN = 0.022;
/** The last bar of the form is held back by this much, so the turn back to the top is not rushed. */
const LAST_BAR = 1.12;
/** Released keys come up just before the next chord, so its notes are struck into a clean pedal. */
const LIFT = 0.04;

export class Conductor {
  /** Everything this conductor plays goes through here, so it can be faded as one. */
  readonly out: GainNode;
  private track: Track | null = null;
  /** Bars scheduled since `start`. */
  private n = 0;
  /** When the next bar starts, in context seconds. */
  private next = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly bus: Bus) {
    this.out = ctx.createGain();
    this.out.connect(bus.input);
  }

  /** Readies `track` from its first bar, to `begin` once its first notes are made. */
  cue(track: Track): void {
    this.track = track;
    this.n = 0;
    this.next = Infinity;
  }

  /** Starts what is cued at context time `at`. */
  begin(at: number): void {
    this.next = at;
  }

  /** Plays `track` from its first bar, starting at context time `at`. */
  start(track: Track, at: number): void {
    this.cue(track);
    this.begin(at);
  }

  get playing(): Track | null {
    return this.track;
  }

  /** Bars put on the clock so far. */
  get bars(): number {
    return this.n;
  }

  /** Seconds a beat lasts in bar `n` of the current track. */
  private beatSecs(n: number): number {
    const t = this.track;
    if (!t) return 0;
    const last = n % formBars(t) === formBars(t) - 1;
    return (60 / t.bpm) * (last ? LAST_BAR : 1);
  }

  /** Puts every bar that starts before `horizon` on the clock. */
  fill(horizon: number): void {
    const t = this.track;
    if (!t) return;
    // Fallen behind the clock (the tab was out of sight, or the music turned
    // down to nothing): carry on from the bar it stopped at, a moment from now.
    const now = this.ctx.currentTime;
    if (this.next < now) this.next = now + 0.25;
    while (this.next < horizon) {
      const { pass, bar } = locate(t, this.n);
      const round = Math.floor(this.n / formBars(t));
      const beat = this.beatSecs(this.n);
      const at = this.next;
      const { hits, holds } = play(t, pass, bar, round);
      for (const h of hits) {
        const { buf, rate } = note(this.ctx, h.kind, h.m, h.vel);
        strike(this.ctx, this.out, at + h.beat * beat, buf, {
          gain: GAIN[h.kind](h.vel) * (h.level ?? 1),
          pan: PAN[h.kind](h.m),
          rate,
          wow: this.bus.wow,
          // Only the piano has dampers; the rest ring out.
          until: h.kind === 'piano' ? at + h.off * beat - LIFT : undefined,
          damp: 0.09,
        });
      }
      for (const p of holds) pad(this.ctx, this.out, at + p.beat * beat, p.beats * beat, p.notes, PAD_GAIN, 1.5, 2);
      this.next += t.beats * beat;
      this.n += 1;
    }
  }

  /** Notes the next `bars` bars will strike that are not made yet. */
  wanted(bars: number): Array<{ kind: Struck; m: number; vel: number }> {
    const t = this.track;
    if (!t) return [];
    const out = new Map<string, { kind: Struck; m: number; vel: number }>();
    for (let i = 0; i < bars; i += 1) {
      const n = this.n + i;
      const { pass, bar } = locate(t, n);
      for (const h of play(t, pass, bar, Math.floor(n / formBars(t))).hits) {
        const key = madeFor(h.kind, h.m, h.vel).key;
        if (!out.has(key) && !isMade(this.ctx, h.kind, h.m, h.vel)) out.set(key, h);
      }
    }
    return [...out.values()];
  }
}
