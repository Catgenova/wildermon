/**
 * The way from one track into the next.
 *
 * The outgoing track stops at the end of a phrase and is let ring; over its
 * tail the harp rolls up the chord it stopped on, then up the chord the next
 * track opens on, with the pad moving from one to the other beneath, and the
 * next track comes in on its first bar `BRIDGE_SECS` after the stop. Any two
 * tracks can be joined so: nothing is written per pair.
 */
import { GAIN, PAN } from './conductor';
import { note, pad, strike } from './instruments';

/** Seconds from the outgoing track's stop to the incoming one's first bar. */
export const BRIDGE_SECS = 3.6;
/** Seconds the outgoing track's tail takes to fade, and the incoming one to come up. */
export const CROSSFADE = 6;
/** The harp's touch in a bridge: soft. */
export const BRIDGE_TOUCH = 0.22;
/** The lowest note a bridge's harp starts from, and the most notes it rolls up a chord. */
const HARP_FLOOR = 55;
const ROLL = 5;
/** Seconds between the notes of a roll, and from the first roll to the second. */
const STEP = 0.2;
const SECOND = 1.6;

/** A chord rolled up the harp from `HARP_FLOOR`: each of its pitch classes once, lowest first, the first an octave up to close. */
export function harpRoll(chord: readonly number[]): number[] {
  const classes = [...new Set(chord.map((m) => ((m % 12) + 12) % 12))];
  const up = classes.map((pc) => HARP_FLOOR + ((pc - HARP_FLOOR) % 12 + 12) % 12).sort((a, b) => a - b).slice(0, ROLL - 1);
  return up.length ? [...up, up[0] + 12] : [];
}

/** Every note a bridge can ask the harp for: the floor up through a roll's top. */
export const BRIDGE_NOTES: readonly number[] = Array.from({ length: 24 }, (_, i) => HARP_FLOOR + i);

/** Plays a bridge from `from` (the chord the outgoing track stopped on) to `to` (the incoming track's first), starting at `at`. */
export function bridge(ctx: BaseAudioContext, dest: AudioNode, at: number, from: readonly number[], to: readonly number[], wow?: AudioNode): void {
  const roll = (chord: readonly number[], t0: number): void => {
    harpRoll(chord).forEach((m, k) => {
      const vel = BRIDGE_TOUCH + k * 0.015;
      const { buf, rate } = note(ctx, 'harp', m, vel);
      strike(ctx, dest, t0 + k * STEP, buf, { gain: GAIN.harp(vel), pan: PAN.harp(m), rate, wow });
    });
  };
  roll(from, at);
  roll(to, at + SECOND);
  if (from.length) pad(ctx, dest, at, SECOND + 0.2, [...from], 0.02, 0.6, 1.5);
  if (to.length) pad(ctx, dest, at + SECOND - 0.2, BRIDGE_SECS - SECOND + 1.2, [...to], 0.02, 1, 2);
}

/** An equal-power fade of `gain` from its level at `at` to `to` over `secs`: the sum of a fade out and a fade in stays as loud. */
export function fade(gain: AudioParam, at: number, secs: number, from: number, to: number): void {
  const n = 32;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = i / (n - 1);
    const w = to > from ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
    curve[i] = to > from ? from + (to - from) * w : to + (from - to) * w;
  }
  gain.cancelScheduledValues(at);
  gain.setValueCurveAtTime(curve, at, secs);
}
