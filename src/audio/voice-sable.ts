import { ACT_SECS } from '../render/beat-times';
import { BADGER_HITS } from '../render/wild-badger';
import { SABLE_WORK } from '../render/wild-sable';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sablekit's voice, and its stages' (the species is `flecha`): a small badger's chitter, a rustle of its feathers over it;
 * the Sableplume's a chuff and a short grumble, the Fletchercrest's a deep huff and a growl, each with its feathers shaken.
 * At its work: a snip of its teeth through a feather at each snip, the whirr of thread going round as it binds, and a light
 * tap of the shaft as it holds it up.
 *
 * A chitter is a quick run of high voiced clicks; a rustle a soft band of high noise; a snip a short sharp click of noise over a
 * tick of a tone; a whirr a narrow band of noise wavering; a grumble a low buzz through a lowpass. The bigger the body, the
 * lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-sable`): the blows on `BADGER_HITS`, the snips, the binding and the
 * look on `SABLE_WORK`, the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.45][s] * (0.95 + 0.1 * v), slow: [1, 1.25, 1.6][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A rustle of feathers: a soft band of high noise, swelling and dying. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 5200, to: 3600, q: 0.9, gain: 0.05 * k, attack: dur * 0.4 });
}

/** A voiced click: a short tone sliding up then down, through a band. */
function chit(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.2, dur: 0.035, gain: 0.07 * k, type: 'triangle', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.02, freq: f * 2, q: 3, gain: 0.03 * k, attack: 0.002 });
}

/** A grumble: a low buzz falling, through a lowpass. */
function grumble(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur, gain: 0.08 * k, type: 'sawtooth', attack: 0.02 });
  ring(ctx, dest, at, { freq: f * 0.5, to: f * 0.42, dur, gain: 0.07 * k, type: 'sine', attack: 0.02 });
}

/** A snip through a feather: a short sharp click of noise and a dry tick. */
function snip(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.025, freq: f * 3, q: 2.5, gain: 0.09 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: f, to: f * 0.85, dur: 0.03, gain: 0.03 * k, type: 'triangle', attack: 0.001 });
}

/** Thread going round: a narrow band of noise wavering as it is wound, `turns` times. */
function whirr(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, turns: number, k: number): void {
  for (let q = 0; q < turns; q++) burst(ctx, dest, at + (q * dur) / turns, { dur: dur / turns, freq: 2600 + 300 * (q % 2), q: 6, gain: 0.04 * k, attack: dur / turns / 2 });
}

/**
 * Its own call, by stage. The Sablekit's: a chitter of five clicks round 1.8 kHz and a rustle. The Sableplume's: a chuff and a
 * short grumble, a rustle. The Fletchercrest's: a deep huff, a growl, its feathers shaken longer.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) for (let q = 0; q < 5; q++) chit(ctx, dest, at + q * 0.045, 1800 * (1.05 - 0.04 * q), k);
  else {
    burst(ctx, dest, at, { dur: 0.08 * b.slow, freq: 900 * b.pitch, to: 500 * b.pitch, q: 1.2, gain: 0.08 * k, attack: 0.01 });
    grumble(ctx, dest, at + 0.06, 260 * b.pitch, 0.18 * b.slow, k);
  }
  rustle(ctx, dest, at + 0.05, 0.18 * b.slow, k);
}

/** A strike: a rustle as it gathers, a thump at each blow, and its call after the last. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.8, 1.7][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  rustle(ctx, out, at + 0.04, 0.12, 0.8);
  for (const h of BADGER_HITS[s]) {
    ring(ctx, out, at + h * T, { freq: 160 - 30 * s, to: 60, dur: 0.12 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.002 });
    burst(ctx, out, at + h * T, { dur: 0.05, freq: 900, q: 1.2, gain: 0.06, attack: 0.002 });
  }
  if (s === 0) chit(ctx, out, at + 0.04, 2000 * b.pitch, 0.8);
  else grumble(ctx, out, at + 0.02, 240 * b.pitch, 0.12, 0.7);
};

/** A go at its task: a snip at each snip, the whirr of the thread as it binds, a tap as it holds the shaft up. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.2, 2.6, 2.4][s]), b = bodyOf(stage, v), W = SABLE_WORK, T = ACT_SECS.work;
  for (const c of W.snips) snip(ctx, out, at + c * T, 2400 * (0.7 + 0.3 * b.pitch), 1);
  whirr(ctx, out, at + W.bind * T, (W.bound - W.bind) * T, 4, 1);
  ring(ctx, out, at + W.look * T, { freq: 900 * (0.7 + 0.3 * b.pitch), to: 820, dur: 0.05, gain: 0.03, type: 'triangle', attack: 0.002 });
  if (v > 0.6) rustle(ctx, out, at + 0.9 * T, 0.08, 0.6);
};

/**
 * Evolving, a cue the length of the act: feathers rustling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, as what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  rustle(ctx, dest, at + 0.1, flash - 0.1, 1.4);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const SABLE_VOICE: Voice = { strike, work, evolve };
