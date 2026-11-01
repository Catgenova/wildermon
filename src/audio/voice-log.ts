import { ACT_SECS } from '../render/beasts';
import { LOG_HITS, LOG_WORK } from '../render/wild-log';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Lognib's voice, and its stages' (the species is `carra`): a beetle's dry chirr -- a quick run of clicks -- with a hollow
 * knock of its shell, the bigger two lower and slower. At its work, the Lognib's heaves: a click of its grip and the dull scrape
 * of a log dragged over the ground; the Timbersplit's and the Beammaster's: the deep thunk of the blade biting into the log, a
 * rasp at each saw stroke, and the crack of the log falling apart.
 *
 * A click is a very short band of noise with a dry tick of a tone in it; a chirr is a run of them; a knock a short hollow tone
 * dropping; a scrape a long low band of noise; a rasp a narrow band of noise sliding over a buzz; a thunk a low thump with a
 * woody ring; a crack a sharp burst of noise and a split ring. The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-log`): the toss or the chop on `LOG_HITS`; each heave, the bite, each
 * saw stroke and the split on `LOG_WORK`; the evolving chime on the flash at the middle of the act.
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

/** A click: a very short band of noise round `f` and a dry tick of a tone. */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.018, freq: f, q: 3, gain: 0.07 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: f * 0.5, to: f * 0.42, dur: 0.03, gain: 0.03 * k, type: 'triangle', attack: 0.001 });
}

/** A chirr: `n` clicks round `f`, `gap` apart, rising a little. */
function chirr(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, gap: number, k: number): void {
  for (let q = 0; q < n; q++) click(ctx, dest, at + q * gap, f * (1 + 0.03 * q), k * (1 - 0.05 * q));
}

/** A hollow knock of its shell: a short tone round `f`, dropping. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.75, dur: 0.08, gain: 0.09 * k, type: 'triangle', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.02, freq: f * 4, q: 2, gain: 0.03 * k, attack: 0.001 });
}

/** A log dragged over the ground: a long low band of noise, rough. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 700, to: 500, q: 1.2, gain: 0.07 * k, attack: dur * 0.3 });
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + (q + 0.5) * dur / 4, { dur: 0.03, freq: 1400 + 300 * q, q: 2, gain: 0.03 * k, attack: 0.002 });
}

/** A saw stroke: a narrow band of noise sliding over a buzz. */
function rasp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at - 0.06, { dur: 0.12, freq: f * 2.4, to: f * 1.6, q: 5, gain: 0.06 * k, attack: 0.04 });
  ring(ctx, dest, at - 0.06, { freq: f * 0.2, to: f * 0.18, dur: 0.12, gain: 0.02 * k, type: 'sawtooth', attack: 0.03 });
}

/** A blade biting into a log: a low thump with a woody ring after it. */
function thunk(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.6, dur: 0.12, gain: 0.2 * k, type: 'sine', attack: 0.002 });
  ring(ctx, dest, at, { freq: f * 3.1, to: f * 2.9, dur: 0.14, gain: 0.04 * k, type: 'triangle', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.03, freq: 1800, q: 1.5, gain: 0.08 * k, attack: 0.001 });
}

/** A log falling apart: a sharp burst of noise and a split ring. */
function crack(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.05, freq: 2600, q: 1, gain: 0.12 * k, attack: 0.001 });
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + 0.02 + q * 0.018, { dur: 0.02, freq: 3200 - 500 * q, q: 2, gain: 0.05 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 420, to: 300, dur: 0.18, gain: 0.05 * k, type: 'triangle', attack: 0.002 });
}

/**
 * Its own call, by stage. The Lognib's: a quick chirr of six clicks round 3.2 kHz and a knock of its shell. The Timbersplit's:
 * seven, lower and slower, a deeper knock. The Beammaster's: a slow run of eight round 1.9 kHz and a deep hollow knock.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  chirr(ctx, dest, at, 3200 * b.pitch, 6 + b.s, 0.03 * b.slow, k);
  knock(ctx, dest, at + 0.02, 340 * b.pitch, k);
}

/** A strike: a hiss as it gathers, and the Lognib's horn tossed through the blow, or the bigger two's blade chopped down. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 1.9, 1.8][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + LOG_HITS[s] * T;
  burst(ctx, out, at + 0.08, { dur: 0.12, freq: 4200 * b.pitch, q: 0.8, gain: 0.04, attack: 0.03 });
  if (s === 0) knock(ctx, out, hit, 420, 1.4);
  else thunk(ctx, out, hit, 150 * b.pitch, 1);
  ring(ctx, out, hit, { freq: 150 - 30 * s, to: 70, dur: 0.1 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.002 });
  chirr(ctx, out, hit + 0.08, 3400 * b.pitch, 2, 0.03, 0.7);
};

/**
 * A go at its task. The Lognib's: a click as it takes hold, and a scrape at each heave. The bigger two's: a thunk at the bite, a
 * rasp at each saw stroke, and a crack at the split.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.4, 2.3, 2.4][s]), b = bodyOf(stage, v), W = LOG_WORK, T = ACT_SECS.work;
  if (s === 0) {
    click(ctx, out, at + W.grip * T, 2800 * b.pitch, 1);
    for (const [a, e] of W.drags) scrape(ctx, out, at + a * T, (e - a) * T, 1);
  } else {
    thunk(ctx, out, at + W.bite * T, 160 * b.pitch, 1);
    for (const x of W.saws) rasp(ctx, out, at + x * T, 1200 * b.pitch, 1);
    crack(ctx, out, at + W.split * T, 1);
  }
  if (v > 0.6) chirr(ctx, out, at + 0.92 * T, 3200 * b.pitch, 3, 0.03, 0.4);
};

/**
 * Evolving, a cue the length of the act: chips rattling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the chirr of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) click(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 2400 + 200 * q, 0.6 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const LOG_VOICE: Voice = { strike, work, evolve };
