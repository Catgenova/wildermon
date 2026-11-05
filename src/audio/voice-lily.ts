import { ACT_SECS } from '../render/beasts';
import { LILY_HITS, LILY_WORK } from '../render/wild-lily';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Padbloom's voice, and its stages' (the species is `spitta`): a tortoise's, but a happy one -- the Padbloom a bright little
 * chirrup through its open mouth, the Lilyback a rounder hoot, the Lotushell a deep, slow, contented hum under a soft breath. At
 * its work: a gulp of water as its beak goes in, a plop as the root goes down and a little ring of water drops after it, its
 * contented hum as it lifts its head again.
 *
 * A chirrup is a sine swept up and back in a few quick steps; a hoot a soft tone that rises and falls; a hum a low sine and its
 * octave, swelling; a plop a falling tone over a short burst of noise; drops little high pings, falling. The bigger the body, the
 * lower and the slower.
 *
 * Every cue lands where its picture does (`../render/wild-lily`): the bite on `LILY_HITS`, the plop on `LILY_WORK.plant`, the
 * evolving chime on the flash at the middle of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.74, 0.52][s] * (0.95 + 0.1 * v), slow: [1, 1.3, 1.7][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A soft breath, out through the nose. */
function breath(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2200 * pitch, to: 1500 * pitch, q: 0.7, gain: 0.035 * k, attack: dur * 0.35 });
}

/** A bright chirrup: a few quick rising steps of a sine and back. */
function chirrup(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  for (let q = 0; q < 3; q++) {
    ring(ctx, dest, at + q * 0.06, { freq: f * (1 + 0.12 * q), to: f * (1.2 + 0.12 * q), dur: 0.06, gain: 0.05 * k, type: 'sine', attack: 0.006 });
  }
}

/** A round hoot: a soft tone rising and falling. */
function hoot(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.18, dur: dur * 0.45, gain: 0.06 * k, type: 'triangle', attack: 0.02 });
  ring(ctx, dest, at + dur * 0.4, { freq: f * 1.18, to: f * 0.9, dur: dur * 0.6, gain: 0.05 * k, type: 'triangle', attack: 0.01 });
}

/** A deep contented hum: a low sine and its octave, swelling and fading. */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.96, dur, gain: 0.08 * k, type: 'sine', attack: dur * 0.3 });
  ring(ctx, dest, at, { freq: f * 2, to: f * 1.92, dur: dur * 0.8, gain: 0.025 * k, type: 'sine', attack: dur * 0.3 });
}

/** A plop: a falling tone over a short burst of noise, the root going into the water. */
function plop(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 900 * pitch, to: 260 * pitch, dur: 0.09, gain: 0.08 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07, freq: 1400 * pitch, to: 500 * pitch, q: 1.2, gain: 0.05 * k, attack: 0.003 });
}

/** Drops falling back on the water: little high pings, falling and fading. */
function drops(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  for (let q = 0; q < 4; q++) {
    const f = (1900 + 380 * ((q * 7) % 4)) * pitch;
    ring(ctx, dest, at + 0.07 + q * 0.055, { freq: f, to: f * 0.7, dur: 0.05, gain: 0.025 * k * (1 - q * 0.18), type: 'sine', attack: 0.002 });
  }
}

/**
 * Its own call, by stage. The Padbloom's: a breath and a bright chirrup round 900 Hz. The Lilyback's: a round hoot round 420 Hz.
 * The Lotushell's: a long breath over a deep contented hum round 150 Hz.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  breath(ctx, dest, at, 0.18 * b.slow, b.pitch, k);
  if (b.s === 0) chirrup(ctx, dest, at + 0.1, 900 * b.pitch, k);
  else if (b.s === 1) hoot(ctx, dest, at + 0.12, 560 * b.pitch, 0.32, k);
  else hum(ctx, dest, at + 0.12, 290 * b.pitch, 0.6, k);
}

/** A strike: a breath as it draws its head in, a snap of its beak and a thump as its weight comes after it. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.8, 1.7][s]), b = bodyOf(stage, v), T = ACT_SECS.strike, hit = at + LILY_HITS[s] * T;
  breath(ctx, out, at + 0.03, 0.15, b.pitch, 1.4);
  burst(ctx, out, hit, { dur: 0.03, freq: 2000 * b.pitch, q: 2.2, gain: 0.09, attack: 0.001 });
  ring(ctx, out, hit + 0.02, { freq: 125 - 25 * s, to: 58, dur: 0.14 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.003 });
};

/** A go at its task: a gulp as its beak goes into the water, the plop of the root going down and the drops after, a hum as it rises. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.4][s]), b = bodyOf(stage, v), W = LILY_WORK, T = ACT_SECS.work;
  burst(ctx, out, at + (W.plant - 0.14) * T, { dur: 0.08, freq: 600 * b.pitch, to: 380 * b.pitch, q: 1.6, gain: 0.04, attack: 0.02 });
  plop(ctx, out, at + W.plant * T, b.pitch, 1);
  drops(ctx, out, at + W.plant * T, b.pitch, 1);
  if (v > 0.5) hum(ctx, out, at + W.up * T - 0.05, 300 * b.pitch, 0.2 * b.slow, 0.5);
};

/**
 * Evolving, a cue the length of the act: a rising shimmer of water rising to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, as what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 500 * key, to: 2600 * key, q: 2.2, gain: 0.045, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [440, 554, 659]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 90 - 14 * s, to: 48 - 8 * s, dur: 0.5, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const LILY_VOICE: Voice = { strike, work, evolve };
