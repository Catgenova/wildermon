import { ACT_SECS } from '../render/beasts';
import { WALL_HITS, wallScrubs } from '../render/wild-wall';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Wallkit's voice, and its stages' (the species is `scurra`): a raccoon's chittering trill -- a quick run of bright
 * chirps, each sliding up -- over a short snuffle, the bigger two lower and slower. At its work, the swish of straw over stone
 * at every stroke of its brushes and a dry patter of moss coming away; in a strike, the whisk of a brush through the air and a
 * soft thump as it lands, the Stonepolish's a heavy one.
 *
 * A chirp is a short sine sliding up with a breath of noise on it; a trill a run of them; a snuffle a soft band of low noise;
 * a swish a band of noise sweeping down through the upper middle, rough; a patter a few tiny clicks of high noise; a thump a
 * low sine dropping. The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-wall`): the blows on `WALL_HITS`; each stroke's swish where the
 * brush turns back and the moss flies (`wallScrubs`); the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.76, 0.58][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.45][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chirp: a short sine sliding up from `f`, a breath of noise on it. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.35, dur, gain: 0.07 * k, type: 'sine', attack: 0.006 });
  burst(ctx, dest, at, { dur: dur * 0.6, freq: f * 2, q: 3, gain: 0.015 * k, attack: 0.004 });
}

/** A trill: `n` chirps round `f`, `gap` apart, falling a little. */
function trill(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, gap: number, k: number): void {
  for (let q = 0; q < n; q++) chirp(ctx, dest, at + q * gap, f * (1 - 0.04 * q), gap * 0.8, k * (1 - 0.06 * q));
}

/** A snuffle: a soft band of low noise, two quick breaths. */
function snuffle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  for (let q = 0; q < 2; q++) burst(ctx, dest, at + q * 0.07, { dur: 0.05, freq: f, q: 1.5, gain: 0.04 * k, attack: 0.01 });
}

/** Straw dragged over stone: a rough band of noise sweeping down, `dur` long. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.6, q: 1.1, gain: 0.08 * k, attack: dur * 0.35 });
  burst(ctx, dest, at + dur * 0.2, { dur: dur * 0.7, freq: f * 2.2, to: f * 1.6, q: 2.5, gain: 0.025 * k, attack: dur * 0.2 });
}

/** Moss coming away: a few tiny clicks of high noise. */
function patter(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + q * 0.022, { dur: 0.012, freq: 3800 - 300 * q, q: 2, gain: 0.03 * k, attack: 0.001 });
}

/** A low thump, dropping. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.55, dur: 0.14, gain: 0.18 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.04, freq: 900, q: 1, gain: 0.05 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Wallkit's: a trill of five chirps from 2.6 kHz and a snuffle. The Bristleward's: six, lower and
 * slower. The Stonepolish's: seven round 1.5 kHz, slow, and a deep snuffle.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  trill(ctx, dest, at, 2600 * b.pitch, 5 + b.s, 0.05 * b.slow, k);
  snuffle(ctx, dest, at + (5 + b.s) * 0.05 * b.slow + 0.03, 520 * b.pitch, k);
}

/** A strike: the whisk of a brush (the Wallkit's paw) through the air before each blow, and a thump as it lands. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 2, 1.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  for (const h of WALL_HITS[s]) {
    const hit = at + h * T;
    swish(ctx, out, hit - 0.09, 0.09, 2600 * b.pitch, 0.9);
    thump(ctx, out, hit, [180, 130, 90][s], 1);
  }
  chirp(ctx, out, at + 0.04, 2800 * b.pitch, 0.06, 0.8);
};

/** A go at its task: a swish of straw over the stone at every stroke, a patter of moss as the brush turns back. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.5][s]), b = bodyOf(stage, v), T = ACT_SECS.work;
  const stroke = [0.15, 0.17, 0.19][s];
  for (const h of wallScrubs(s)) {
    swish(ctx, out, at + h * T - stroke * 0.7, stroke, 2200 * b.pitch, 1);
    patter(ctx, out, at + h * T, 1);
  }
  if (v > 0.6) trill(ctx, out, at + 0.95 * T, 2600 * b.pitch, 2, 0.05, 0.4);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, the trill of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 5; q++) burst(ctx, dest, at + 0.1 + q * (flash - 0.2) / 5, { dur: 0.09, freq: 3000 + 300 * q, q: 1.2, gain: 0.025 + 0.006 * q, attack: 0.03 });
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const WALL_VOICE: Voice = { strike, work, evolve };
