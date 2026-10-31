import { ACT_SECS } from '../render/beasts';
import { REACH_HITS, REACH_WORK } from '../render/wild-giraffe';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Saplingreach's voice, and its stages' (the species is `snedda`): a soft
 * hum through the nose, as a giraffe hums, the Saplingreach's a high little
 * bleat of a hum, the Grovemaster's a deep slow drone; a snort; and the
 * rustle of the leaves it wears. At its work, the rustle of the stretch up,
 * the click of each nip at the twig, the dry snap of it coming away, and the
 * patter of it landing in the grass; the Grovemaster's trees creak as it
 * stretches.
 *
 * A hum is a soft triangle with a slow wobble in it, a sine an octave under,
 * and a breath of low noise at its start; the bigger the body the lower and
 * the longer. A snap is a short, bright crack of noise over a dry tick; the
 * twig landing, two soft taps. A creak is a slow rising squeal of a narrow
 * band of noise, low.
 *
 * Every cue lands where its picture does (`./wild-giraffe`): the blow on
 * `REACH_HITS`; the stretch, each nip, the snap and the landing on
 * `REACH_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how long its hum, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.46][s] * (0.95 + 0.1 * v), long: [1, 1.35, 1.9][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A hum through the nose: a soft wobbling triangle at `f` for `dur`, a sine an octave under, a breath at its start. */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  const n = Math.max(2, Math.round(dur * 6));
  for (let q = 0; q < n; q++) {
    const u = q / n, fq = f * (1 + 0.03 * Math.sin(u * 9)) * (1.02 - 0.06 * u);
    const swell = Math.sin(Math.PI * Math.min(1, (u + 0.5 / n) * 1.1));
    ring(ctx, dest, at + u * dur, { freq: fq, to: fq * 0.99, dur: (dur / n) * 1.6, gain: 0.07 * k * swell, type: 'triangle', attack: (dur / n) * 0.5, partials: [[1, 0.8], [2, 0.2]] });
    ring(ctx, dest, at + u * dur, { freq: fq / 2, dur: (dur / n) * 1.6, gain: 0.05 * k * swell, type: 'sine', attack: (dur / n) * 0.5 });
  }
  burst(ctx, dest, at, { dur: 0.1, freq: f * 3, q: 1, gain: 0.03 * k, attack: 0.03 });
}

/** Leaves rustling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3600, to: 2400, q: 1.2, gain: 0.05 * k, attack: dur * 0.3 });
}

/** A nip: a small dry click of teeth on wood. */
function nip(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.018, freq: 3000, q: 6, gain: 0.08 * k, attack: 0.001 });
}

/** The twig snapped off: a bright crack of noise and a dry tick under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.035, freq: 2200, to: 1200, q: 3, gain: 0.16 * k, attack: 0.001 });
  burst(ctx, dest, at + 0.012, { dur: 0.05, freq: 900, q: 4, gain: 0.08 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 640, to: 380, dur: 0.05, gain: 0.05 * k, type: 'triangle', attack: 0.001 });
}

/** Wood creaking: a slow narrow squeal of low noise, rising. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 380, to: 620, q: 14, gain: 0.07 * k, attack: dur * 0.4 });
}

/**
 * Its own call, by stage. The Saplingreach's: a quick high hum round 330 Hz with a lift at its end. The Canopyshaper's: a longer
 * hum round 230 Hz. The Grovemaster's: a deep slow drone round 150 Hz, and its leaves rustling.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  hum(ctx, dest, at, 330 * b.pitch, 0.34 * b.long, k);
  if (b.s === 0) ring(ctx, dest, at + 0.3, { freq: 380, to: 460, dur: 0.1, gain: 0.04 * k, type: 'triangle', attack: 0.02 });
  if (b.s === 2) rustle(ctx, dest, at + 0.1, 0.4, 0.8 * k);
}

/** A strike: a snort as it gathers itself, a thud of hooves as the blow lands, a rustle of its leaves, and a short hum. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + REACH_HITS[s] * T;
  burst(ctx, out, at + 0.03, { dur: 0.1, freq: 1100 * b.pitch, q: 1.2, gain: 0.06, attack: 0.01 });
  ring(ctx, out, hit, { freq: 160 - 40 * s, to: 60, dur: 0.12 + 0.06 * s, gain: 0.28, type: 'sine', attack: 0.002 });
  burst(ctx, out, hit, { dur: 0.05, freq: 1300 - 300 * s, q: 1.4, gain: 0.14, attack: 0.001 });
  rustle(ctx, out, hit + 0.02, 0.2 + 0.08 * s, 0.9);
  if (s === 2) creak(ctx, out, hit + 0.04, 0.25, 0.8);
  hum(ctx, out, hit + 0.1, 360 * b.pitch, 0.14 * b.long, 0.5);
};

/**
 * A go at its task: a rustle as it stretches up, a click at each nip, the snap of the twig coming away, a rustle as it turns its
 * head aside, and two soft taps as the twig lands; the Grovemaster's trees creaking as it stretches, and now and then a hum.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4, 3.4, 2.6][s]), b = bodyOf(stage, v), W = REACH_WORK, T = ACT_SECS.work;
  rustle(ctx, out, at + W.up[0] * T, (W.up[1] - W.up[0]) * T, 0.6);
  if (s === 2) creak(ctx, out, at + 0.02, (W.up[1] - W.up[0]) * T, 0.6);
  for (const c of W.nips) nip(ctx, out, at + c * T, 1);
  snap(ctx, out, at + W.snap * T, 1);
  rustle(ctx, out, at + W.drop * T, 0.1, 0.6);
  burst(ctx, out, at + W.land * T, { dur: 0.03, freq: 900, q: 2, gain: 0.05, attack: 0.002 });
  burst(ctx, out, at + W.land * T + 0.05, { dur: 0.025, freq: 1100, q: 2, gain: 0.03, attack: 0.002 });
  if (v > 0.6) hum(ctx, out, at + 0.84 * T, 340 * b.pitch, 0.14 * b.long, 0.35);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the hum of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.12, 0.5 + 0.1 * q);
  if (s === 2) creak(ctx, dest, at + flash - 0.4, 0.35, 0.7);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1397 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [349, 440, 523]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 90 - 14 * s, to: 48 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const GIRAFFE_VOICE: Voice = { strike, work, evolve };
