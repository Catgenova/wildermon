import { ACT_SECS } from '../render/beasts';
import { OWL_HITS, OWL_WORK } from '../render/wild-owl';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Whispling's voice, and its stages' (the species is `kemma`): soft owl
 * hoots and chirrs, the Whispling's a high little hoo, the Hushwing's a fuller
 * two-note hoo-hoo, the Songroost's a deep, long, falling hoot. At its work,
 * the hush of its wing feathers stroking along the one beside it, a soft
 * chirr as it goes.
 *
 * A hoot is a pure tone with a little of its octave in it, swelling in and
 * sliding down a touch, with a breath of noise at its start; a chirr is a
 * tone trilled on and off twenty times a second. A wing stroke is a soft band
 * of noise sweeping up and down, the sound of feathers through air.
 *
 * Every cue lands where its picture does (`./wild-owl`): the blow on
 * `OWL_HITS`; each stroke on `OWL_WORK`; and the evolving chime on the flash
 * at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how long its hoot, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.56][s] * (0.95 + 0.1 * v), long: [1, 1.3, 1.8][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A hoot: a soft round tone at `f` for `dur`, swelling in and sliding down a little, with a breath at its start. */
function hoot(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 1.03, to: f * 0.9, dur, gain: 0.1 * k, type: 'sine', attack: dur * 0.35, partials: [[1, 0.85], [2, 0.12], [3, 0.03]] });
  burst(ctx, dest, at, { dur: dur * 0.5, freq: f * 2.2, q: 2, gain: 0.025 * k, attack: dur * 0.2 });
}

/** A chirr: a tone trilled on and off `rate` times a second for `dur`, falling a little. */
function chirr(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number, rate = 20): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n, fq = f * (1.05 - 0.12 * u);
    ring(ctx, dest, at + u * dur, { freq: fq, dur: 0.7 / rate, gain: 0.04 * k * (1 - 0.5 * u), type: 'triangle', attack: 0.2 / rate });
  }
}

/** Feathers through air: a soft band of noise swept up and back down over `dur`. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number, low = 1): void {
  burst(ctx, dest, at, { dur, freq: 1200 * low, to: 3000 * low, q: 0.9, gain: 0.05 * k, attack: dur * 0.45 });
}

/** Its own call, by stage: the Whispling's high hoo round 620 Hz, the Hushwing's hoo-hoo round 480 Hz, the Songroost's long hoot round 350 Hz. */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 620 * b.pitch;
  hoot(ctx, dest, at, f, 0.22 * b.long, k);
  if (b.s >= 1) hoot(ctx, dest, at + 0.3 * b.long, f * 0.92, 0.3 * b.long, k * 0.9);
  if (b.s === 0) chirr(ctx, dest, at + 0.26, f * 1.3, 0.14, 0.6 * k);
}

/** A strike: a rush of wings as it flares, a sharp tick of talons as it lands, and a short hard hoot. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + OWL_HITS[s] * T;
  swish(ctx, out, at + 0.03, 0.2, 1.2, 1 - 0.15 * s);
  burst(ctx, out, hit, { dur: 0.03, freq: 3200 - 400 * s, q: 3, gain: 0.14, attack: 0.001 });
  ring(ctx, out, hit, { freq: 260 - 60 * s, to: 110, dur: 0.08 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.002 });
  hoot(ctx, out, hit + 0.06, 700 * b.pitch, 0.1 * b.long, 0.8);
};

/** A go at its task: a hush of feathers at each stroke of the wing along the one beside it, and a soft chirr as it works. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4, 3.4, 2.6][s]), b = bodyOf(stage, v), W = OWL_WORK, T = ACT_SECS.work;
  swish(ctx, out, at + W.open[0] * T, (W.open[1] - W.open[0]) * T, 0.7, 1 - 0.15 * s);
  for (const st of W.strokes) swish(ctx, out, at + (st - 0.08) * T, 0.16, 1, 1 - 0.15 * s);
  swish(ctx, out, at + W.fold[0] * T, (W.fold[1] - W.fold[0]) * T, 0.6, 1 - 0.15 * s);
  chirr(ctx, out, at + 0.45 * T, 900 * b.pitch, 0.12 * b.long, 0.5 + 0.3 * v);
};

/**
 * Evolving, a cue the length of the act: wings rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the hoot of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 5; q++) swish(ctx, dest, at + 0.1 + q * (flash - 0.2) / 5, 0.14, 0.4 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 4000 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const OWL_VOICE: Voice = { strike, work, evolve };
