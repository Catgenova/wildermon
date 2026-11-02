import { ACT_SECS } from '../render/beasts';
import { BADGER_HITS } from '../render/wild-badger';
import { PESTLET_WORK } from '../render/wild-pestlet';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pestlet's voice, and its stages' (the species is `crakka`): a small pangolin's snuffle, three quick sniffs through its
 * snout, and a small grunt; the Churnscale's lower and slower, the Mortarium's a deep snort and a low grunt. Its scales clatter
 * when it strikes. At its work: the trickle of the pour while its tip is up, a wet glop as the tip goes into the mortar, the
 * churn of the mortar going round, a plop at each slop over the rim, and a glop again as the tip comes out.
 *
 * A sniff is a short band of mid noise; a grunt a low buzz, short, through a lowpass; a trickle a narrow band of high noise
 * wavering; a glop a short tone falling fast over a dull thud of noise; the churn a low band of noise swelling and sweeping.
 * The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-pestlet`): the blows on `BADGER_HITS`, the dip, the slops and the lift
 * on `PESTLET_WORK`, the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.5][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A sniff through its snout: a short band of noise, rising. */
function sniff(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.06, freq: f, to: f * 1.3, q: 2.2, gain: 0.07 * k, attack: 0.012 });
}

/** A small grunt: a low buzz falling, and a soft body under it. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.78, dur, gain: 0.07 * k, type: 'sawtooth', attack: 0.015 });
  ring(ctx, dest, at, { freq: f * 0.5, to: f * 0.4, dur, gain: 0.06 * k, type: 'sine', attack: 0.015 });
}

/** A wet glop: a short tone falling fast over a dull thud of noise. */
function glop(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.45, dur: 0.07, gain: 0.08 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.06, freq: 420, to: 220, q: 1.4, gain: 0.07 * k, attack: 0.004 });
}

/** The pour: a narrow band of high noise wavering, a little run of bubbles in it. */
function trickle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  const n = Math.max(2, Math.round(dur / 0.04));
  for (let q = 0; q < n; q++) burst(ctx, dest, at + (q * dur) / n, { dur: dur / n + 0.02, freq: 2600 + 500 * ((q * 7) % 3), q: 5, gain: 0.025 * k, attack: dur / n / 2 });
}

/**
 * Its own call, by stage. The Pestlet's: three quick sniffs round 2.2 kHz and a small grunt. The Churnscale's: three slower,
 * lower sniffs and a grunt. The Mortarium's: a deep snort and a long low grunt.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s < 2) for (let q = 0; q < 3; q++) sniff(ctx, dest, at + q * 0.07 * b.slow, 2200 * b.pitch * (1 - 0.05 * q), k);
  else burst(ctx, dest, at, { dur: 0.14, freq: 700, to: 420, q: 1.3, gain: 0.1 * k, attack: 0.01 });
  grunt(ctx, dest, at + (b.s < 2 ? 0.22 * b.slow : 0.12), 300 * b.pitch, 0.1 * b.slow, k);
}

/** A strike: a clatter of its scales as it gathers, a thump at each blow, a grunt after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.8, 1.7][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  for (let q = 0; q < 4; q++) burst(ctx, out, at + 0.03 + q * 0.025, { dur: 0.02, freq: 3200 - 300 * q, q: 4, gain: 0.04, attack: 0.002 });
  for (const h of BADGER_HITS[s]) {
    ring(ctx, out, at + h * T, { freq: 160 - 30 * s, to: 60, dur: 0.12 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.002 });
    burst(ctx, out, at + h * T, { dur: 0.05, freq: 900, q: 1.2, gain: 0.06, attack: 0.002 });
  }
  grunt(ctx, out, at + 0.02, 280 * b.pitch, 0.1, 0.7);
};

/** A go at its task: the pour while the tip is up, a glop as it goes in, the churn as it goes round, a plop at each slop, a glop out. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.4][s]), b = bodyOf(stage, v), W = PESTLET_WORK, T = ACT_SECS.work;
  const f = 380 * (0.6 + 0.4 * b.pitch);
  trickle(ctx, out, at, 0.12 * T, 1);
  glop(ctx, out, at + W.down * T, f, 1);
  burst(ctx, out, at + W.down * T, { dur: (W.up - W.down) * T, freq: 320 * (0.7 + 0.3 * b.pitch), to: 520 * (0.7 + 0.3 * b.pitch), q: 1.8, gain: 0.05, attack: (W.up - W.down) * T * 0.4 });
  for (const c of W.slop) glop(ctx, out, at + (c + 0.08) * T, f * 1.6, 0.6);
  glop(ctx, out, at + W.up * T, f * 1.2, 0.7);
  trickle(ctx, out, at + 0.88 * T, 0.12 * T, 1);
  if (v > 0.6) sniff(ctx, out, at + 0.5 * T, 2000 * b.pitch, 0.5);
};

/**
 * Evolving, a cue the length of the act: its scales clattering in, a rising sweep to the flash at its middle, where a clear
 * chime rings over a deep swell -- each stage's lower than the last -- and then its own call, as what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 8; q++) burst(ctx, dest, at + 0.1 + q * 0.07, { dur: 0.025, freq: 3000 + 200 * (q % 3), q: 4, gain: 0.035, attack: 0.002 });
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 3200 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const fr of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: fr * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const PESTLET_VOICE: Voice = { strike, work, evolve };
