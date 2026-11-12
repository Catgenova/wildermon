import { ACT_SECS } from '../render/beat-times';
import { PACK_HITS } from '../render/wild-pack';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Packlet's voice, and its stages' (the species is `bura`): a hare's soft huff and grunt -- a short breathy puff over a low
 * hum -- with its leaves rustling and its pods knocking in their ropes, a hollow wooden clunk; the bigger two lower and slower,
 * the Cargocrest with the creak of its cage of roots.
 *
 * A huff is a short band of breath noise falling; a grunt a low hum with a breath over it; a clunk a hollow low ring, the pods
 * knocking; a rustle a soft band of high noise; a creak a narrow band of noise sliding over a low ring. The bigger the body,
 * the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-pack`): the kick on `PACK_HITS`, and the evolving chime on the flash
 * at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.6][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.45][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A huff: a short puff of breath, falling. */
function huff(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.6, q: 1.2, gain: 0.07 * k, attack: dur * 0.15 });
}

/** A grunt: a low hum with a breath over it. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.82, dur, gain: 0.09 * k, type: 'triangle', attack: 0.02, partials: [[1, 0.7], [2, 0.3]] });
  huff(ctx, dest, at, 900 * (f / 160), dur * 0.8, 0.6 * k);
}

/** The pods knocking in their ropes: a hollow low clunk. */
function clunk(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.9, dur: 0.12, gain: 0.08 * k, type: 'sine', attack: 0.002, partials: [[1, 0.6], [2.4, 0.4]] });
  burst(ctx, dest, at, { dur: 0.02, freq: f * 4, q: 2, gain: 0.04 * k, attack: 0.001 });
}

/** Its leaves rustling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2800, to: 1900, q: 1, gain: 0.05 * k, attack: dur * 0.3 });
}

/** The Cargocrest's roots creaking. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.2, freq: 700, to: 520, q: 9, gain: 0.04 * k, attack: 0.05 });
  ring(ctx, dest, at, { freq: 140, to: 120, dur: 0.2, gain: 0.03 * k, type: 'sawtooth', attack: 0.05 });
}

/**
 * Its own call, by stage. The Packlet's: two quick huffs and a small grunt round 180 Hz, its pod knocking once. The
 * Haulbud's: lower and slower, its pods knocking twice. The Cargocrest's: a deep grunt and the creak of its cage.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  huff(ctx, dest, at, 1400 * b.pitch, 0.07 * b.slow, k);
  huff(ctx, dest, at + 0.11 * b.slow, 1300 * b.pitch, 0.07 * b.slow, k);
  grunt(ctx, dest, at + 0.22 * b.slow, 180 * b.pitch, 0.16 * b.slow, k);
  for (let q = 0; q <= Math.min(1, b.s); q++) clunk(ctx, dest, at + 0.3 * b.slow + q * 0.09, 260 * b.pitch, 0.7 * k);
  if (b.s === 2) creak(ctx, dest, at + 0.05, k);
  rustle(ctx, dest, at, 0.14 * b.slow, 0.5 * k);
}

/** A kick: its leaves rustling as it sets, a grunt, a thud of both hind feet on the blow, and its pods knocking after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 2.0, 1.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + PACK_HITS[s] * T;
  rustle(ctx, out, at + 0.04, 0.16, 1);
  grunt(ctx, out, hit - 0.1, 170 * b.pitch, 0.12, 1);
  ring(ctx, out, hit, { freq: 120 - 25 * s, to: 60, dur: 0.12 + 0.04 * s, gain: 0.2, type: 'sine', attack: 0.002 });
  burst(ctx, out, hit, { dur: 0.05, freq: 600, q: 0.8, gain: 0.08, attack: 0.001 });
  clunk(ctx, out, hit + 0.1, 260 * b.pitch, 1);
  clunk(ctx, out, hit + 0.22, 240 * b.pitch, 0.7);
  if (s === 2) creak(ctx, out, hit + 0.05, 1);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, the huff of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.12, 0.5 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1397 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [349, 440, 523]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const PACK_VOICE: Voice = { strike, evolve };
