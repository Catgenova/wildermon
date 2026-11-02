import { ACT_SECS } from '../render/beasts';
import { HERB_HITS, HERB_WORK } from '../render/wild-herbpup';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Herbpup's voice, and its stages' (the species is `salva`): a fox's yip -- a bright bark that leaps up and falls away --
 * the kit's quick and high, the Herbfox's a clear two-note call, the Herbwarden's lower and slower with a soft whine after it.
 * At its work, a rustle of leaves and a soft pat as the poultice is pressed on, each time, and the hush of cloth drawn round as
 * it winds the strip; in a strike, a snap of its jaws and the whisk of a paw; evolving, leaves rustling in to a chime.
 *
 * A yip is a sine leaping up and falling, a breath of noise on it; a rustle a band of high noise in a few quick shakes; a pat
 * a soft low thump; the hush of cloth a band of noise sweeping up and down, soft. The bigger the body, the lower and the
 * longer.
 *
 * Every cue lands where its picture does (`../render/wild-herbpup`): the blows on `HERB_HITS`; a rustle and a pat on each of
 * `HERB_WORK.presses`; the hush through `HERB_WORK.wrap`; the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.6][s] * (0.95 + 0.1 * v), slow: [1, 1.18, 1.4][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A yip: a sine leaping up from `f` and falling away below it, a breath of noise on it. */
function yip(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 1.5, to: f * 0.8, dur, gain: 0.08 * k, type: 'triangle', attack: 0.008, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at, { freq: f, to: f * 1.5, dur: dur * 0.25, gain: 0.05 * k, type: 'sine', attack: 0.004 });
  burst(ctx, dest, at, { dur: dur * 0.5, freq: f * 2.4, q: 2.5, gain: 0.02 * k, attack: 0.004 });
}

/** A rustle of leaves: a few quick shakes of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + q * 0.028, { dur: 0.035, freq: 4200 - 400 * q, q: 1.6, gain: 0.03 * k, attack: 0.004 });
}

/** A soft pat: a low thump, short. */
function pat(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.7, dur: 0.08, gain: 0.12 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.05, freq: 700, q: 0.8, gain: 0.04 * k, attack: 0.002 });
}

/** The hush of cloth drawn round: a soft band of noise sweeping up and down, `dur` long. */
function hush(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur: dur * 0.5, freq: 1600, to: 3200, q: 1.2, gain: 0.035 * k, attack: dur * 0.2 });
  burst(ctx, dest, at + dur * 0.5, { dur: dur * 0.5, freq: 3200, to: 1600, q: 1.2, gain: 0.035 * k, attack: dur * 0.2 });
}

/**
 * Its own call, by stage. The Herbpup's: three quick yips from 1.8 kHz. The Herbfox's: two, a step apart, from 1.4 kHz. The
 * Herbwarden's: one long yip from 1.1 kHz and a soft whine after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 1800 * b.pitch;
  const n = [3, 2, 1][b.s];
  for (let q = 0; q < n; q++) yip(ctx, dest, at + q * 0.11 * b.slow, f * (1 - 0.08 * q), 0.09 * b.slow, k);
  if (b.s === 2) ring(ctx, dest, at + 0.16, { freq: f * 1.1, to: f * 0.9, dur: 0.3, gain: 0.03 * k, type: 'sine', attack: 0.05 });
}

/** A strike: a snap of its jaws before the blow and the whisk of a paw as it lands. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 2, 1.9][s]), b = bodyOf(stage, v), hit = at + HERB_HITS[s] * ACT_SECS.strike;
  yip(ctx, out, at + 0.04, 2000 * b.pitch, 0.07, 0.8);
  burst(ctx, out, hit - 0.07, { dur: 0.07, freq: 2600 * b.pitch, to: 1300 * b.pitch, q: 1.2, gain: 0.07, attack: 0.03 });
  pat(ctx, out, hit, [220, 170, 130][s], 1.2);
  rustle(ctx, out, hit + 0.02, 0.8);
};

/** A go at its task: a rustle of leaves and a soft pat at each press of the poultice; the hush of cloth as it winds the strip. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.5][s]), b = bodyOf(stage, v), T = ACT_SECS.work;
  for (const c of HERB_WORK.presses) {
    rustle(ctx, out, at + c * T - 0.03, 1);
    pat(ctx, out, at + c * T, [260, 200, 150][s], 1);
  }
  const [w0, w1] = HERB_WORK.wrap, turns = 2, each = ((w1 - w0) * T) / turns;
  for (let q = 0; q < turns; q++) hush(ctx, out, at + w0 * T + q * each, each, 1);
  if (v > 0.6) yip(ctx, out, at + 0.95 * T, 1900 * b.pitch, 0.06, 0.4);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, the yip of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 5; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 5, 0.6 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const HERB_VOICE: Voice = { strike, work, evolve };
