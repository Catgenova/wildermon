import { ACT_SECS } from '../render/beasts';
import { MORTOISE_HITS, MORTOISE_WORK } from '../render/wild-mortoise';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Mortarshell's voice, and its stages' (the species is `glossa`): a tortoise's, low and slow -- a breathy hiss and a soft
 * grunt, the Groutback's lower and longer, the Mortoise's a deep rumble under a long hiss. At its work: the wet, thick churn of
 * mortar going round its basin, the paddle's wood knocking on the stone of the rim once a turn, a slop at each slop, and its
 * slow nod's grunt.
 *
 * A hiss is a soft band of noise breathed out; a grunt a low buzz through a lowpass, sagging; a churn a low band of noise
 * swelling and ebbing, wet; a knock a short hollow tone over a click; a slop a dull falling thump of noise. The bigger the body,
 * the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-mortoise`): the bite on `MORTOISE_HITS`, the slops and the nod on
 * `MORTOISE_WORK`, the evolving chime on the flash at the middle of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), slow: [1, 1.3, 1.7][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A breathy hiss, out through the nose. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2600 * pitch, to: 1800 * pitch, q: 0.8, gain: 0.05 * k, attack: dur * 0.3 });
}

/** A low grunt, sagging, through a lowpass. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.78, dur, gain: 0.07 * k, type: 'sawtooth', attack: 0.03 });
  ring(ctx, dest, at, { freq: f * 0.5, to: f * 0.4, dur, gain: 0.08 * k, type: 'sine', attack: 0.03 });
  burst(ctx, dest, at, { dur: dur * 0.8, freq: f * 2.2, q: 1.5, type: 'lowpass', gain: 0.04 * k, attack: 0.02 });
}

/** Thick mortar going round: a low wet band of noise swelling and ebbing, `turns` times over `dur`. */
function churn(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  const n = 4;
  for (let q = 0; q < n; q++) {
    burst(ctx, dest, at + (q * dur) / n, { dur: (dur / n) * 1.3, freq: (380 + 90 * (q % 2)) * pitch, to: 300 * pitch, q: 1.4, gain: 0.06 * k, attack: (dur / n) * 0.5 });
  }
}

/** The paddle's wood knocking on the stone rim: a short hollow tone over a click. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 520 * pitch, to: 430 * pitch, dur: 0.07, gain: 0.05 * k, type: 'triangle', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.02, freq: 2400, q: 2, gain: 0.04 * k, attack: 0.001 });
}

/** A slop of mortar over the rim: a dull falling thump of noise. */
function slop(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.12, freq: 700 * pitch, to: 240 * pitch, q: 1.1, gain: 0.08 * k, attack: 0.006 });
  ring(ctx, dest, at + 0.01, { freq: 150 * pitch, to: 90 * pitch, dur: 0.09, gain: 0.05 * k, type: 'sine', attack: 0.004 });
}

/**
 * Its own call, by stage. The Mortarshell's: a short hiss and a soft grunt round 200 Hz. The Groutback's: a longer hiss, a grunt
 * round 145 Hz. The Mortoise's: a long hiss over a deep rumble round 100 Hz.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  hiss(ctx, dest, at, 0.22 * b.slow, b.pitch, k);
  grunt(ctx, dest, at + 0.12 * b.slow, 200 * b.pitch, 0.2 * b.slow, k);
}

/** A strike: a hiss as it draws its head in, a snap of its beak and a thump as its weight comes after it. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.8, 1.7][s]), b = bodyOf(stage, v), T = ACT_SECS.strike, hit = at + MORTOISE_HITS[s] * T;
  hiss(ctx, out, at + 0.03, 0.16, b.pitch, 1);
  burst(ctx, out, hit, { dur: 0.03, freq: 1800 * b.pitch, q: 2.2, gain: 0.09, attack: 0.001 });
  ring(ctx, out, hit + 0.02, { freq: 120 - 25 * s, to: 55, dur: 0.14 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.003 });
};

/** A go at its task: the churn of the mortar the whole way round, the paddle knocking the rim once, a slop at each slop, a grunt at its nod. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.4][s]), b = bodyOf(stage, v), W = MORTOISE_WORK, T = ACT_SECS.work;
  churn(ctx, out, at, T, b.pitch, 1);
  if (s > 0) knock(ctx, out, at + 0.15 * T, b.pitch, 0.8);
  for (const c of W.slops) slop(ctx, out, at + c * T, b.pitch, 1);
  if (v > 0.6) grunt(ctx, out, at + W.nod * T, 190 * b.pitch, 0.12 * b.slow, 0.5);
};

/**
 * Evolving, a cue the length of the act: a low grinding of stone rising to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, as what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 260 * key, to: 1400 * key, q: 1.6, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 86 - 14 * s, to: 46 - 8 * s, dur: 0.5, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const MORTOISE_VOICE: Voice = { strike, work, evolve };
