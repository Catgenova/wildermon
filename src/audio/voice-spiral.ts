import { ACT_SECS } from '../render/beat-times';
import { SPIRAL_HITS, SPIRAL_WORK } from '../render/wild-spiral';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Spiralcalf's voice, and its stages' (the species is `awla`): a trumpet through the trunk -- the calf's a high squeaky
 * toot, the Spiraltrunk's a full blare, the Spiralphant's a deep bellow over a rumble -- with the breath of it. At its work, the
 * creak of the log turned in its trunk, then at each split the crack of the wood, the rasp of the shaving coming off it, and
 * the clack of the shaft landing on the pile.
 *
 * A trumpet is a reedy tone (a sawtooth and its partials) that swoops up and sags as it dies, a band of breath over it; a
 * rumble a low sine and low noise under it; a crack a short sharp burst of noise and a dull knock; a rasp a band of noise
 * sliding down; a clack a short hollow ring of wood. The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-spiral`): the blow on `SPIRAL_HITS`; the turn, each split and each
 * shaft's landing on `SPIRAL_WORK`; the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), slow: [1, 1.3, 1.7][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A trumpet round `f`, `dur` long: swooping up a fifth's worth into it, then sagging as it dies, breath over it. */
function trumpet(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  const up = dur * 0.22;
  const reed = [[1, 0.55], [2, 0.25], [3, 0.12], [4, 0.08]] as const;
  ring(ctx, dest, at, { freq: f * 0.7, to: f * 1.05, dur: up, gain: 0.05 * k, type: 'sawtooth', attack: up * 0.6, partials: reed });
  ring(ctx, dest, at + up * 0.9, { freq: f * 1.05, to: f * 0.86, dur: dur - up, gain: 0.05 * k, type: 'sawtooth', attack: 0.01, partials: reed });
  burst(ctx, dest, at, { dur, freq: f * 3, to: f * 2, q: 1.4, gain: 0.025 * k, attack: up });
}

/** A low rumble under a big body's call. */
function rumble(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: 70, to: 54, dur, gain: 0.12 * k, type: 'sine', attack: dur * 0.3 });
  burst(ctx, dest, at, { dur, freq: 120, q: 0.7, type: 'lowpass', gain: 0.05 * k, attack: dur * 0.3 });
}

/** The wood splitting: a short sharp burst and a dull knock under it. */
function crack(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.05, freq: 2600, to: 1400, q: 1.2, gain: 0.12 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur: 0.09, gain: 0.1 * k, type: 'triangle', attack: 0.001 });
}

/** A shaving coming off: a band of noise sliding down. */
function rasp(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3800, to: 1800, q: 3, gain: 0.05 * k, attack: dur * 0.4 });
}

/** A shaft landing on the pile: a short hollow clack of wood. */
function clack(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.94, dur: 0.06, gain: 0.08 * k, type: 'sine', attack: 0.001, partials: [[1, 0.7], [2.3, 0.3]] });
  burst(ctx, dest, at, { dur: 0.02, freq: 2000, q: 2, gain: 0.05 * k, attack: 0.001 });
}

/**
 * Its own call, by stage: the Spiralcalf's a short high toot round 820 Hz; the Spiraltrunk's a blare round 510 Hz, longer;
 * the Spiralphant's a bellow round 330 Hz with a rumble under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  trumpet(ctx, dest, at, 820 * b.pitch, 0.3 * b.slow, k);
  if (b.s === 2) rumble(ctx, dest, at, 0.6, k);
}

/** A strike: a snort as it rears and a trumpet on the blow, a thud as its tusks or trunk land. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.0, 1.9, 1.8][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + SPIRAL_HITS[s] * T;
  burst(ctx, out, at + 0.04, { dur: 0.12, freq: 900 * b.pitch, q: 1, gain: 0.05, attack: 0.02 });
  trumpet(ctx, out, hit - 0.1, 880 * b.pitch, 0.26 * b.slow, 1);
  ring(ctx, out, hit, { freq: 150 - 35 * s, to: 70 - 15 * s, dur: 0.12 + 0.05 * s, gain: 0.18, type: 'sine', attack: 0.002 });
};

/**
 * A go at its task: a creak as the log is turned in its trunk, then at each split the crack of the wood and the rasp of the
 * shaving off it, and the clack of the shaft on the pile; the bigger two's lower and fuller, the Spiralphant's with a grunt.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.5][s]), b = bodyOf(stage, v), W = SPIRAL_WORK, T = ACT_SECS.work;
  burst(ctx, out, at + W.turn[0] * T, { dur: (W.turn[1] - W.turn[0]) * T, freq: 600 * (1 + 0.3 * (1 - b.pitch)), to: 420, q: 6, gain: 0.03, attack: 0.08 });
  for (const c of W.splits) {
    crack(ctx, out, at + c * T, 420 * (0.6 + 0.4 * b.pitch), 1);
    rasp(ctx, out, at + c * T + 0.02, 0.14 + 0.04 * s, 0.9);
    clack(ctx, out, at + (c + W.land) * T, 1100 - 150 * s, 0.8);
    if (s === 2) burst(ctx, out, at + c * T - 0.04, { dur: 0.1, freq: 260, q: 1.2, gain: 0.05, attack: 0.02 });
  }
  if (v > 0.7) trumpet(ctx, out, at + 0.9 * T, 900 * b.pitch, 0.12, 0.4);
};

/**
 * Evolving, a cue the length of the act: shavings rustling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, the trumpet of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.7);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rasp(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.1, 0.4 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.3, s, v, 0.9);
};

export const SPIRAL_VOICE: Voice = { strike, work, evolve };
