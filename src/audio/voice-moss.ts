import { ACT_SECS } from '../render/beat-times';
import { MOSS_HITS, MOSS_WORK } from '../render/wild-moss';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Mossnib's voice, and its stages' (the species is `dulla`): a beetle's dry chirr -- a quick run of clicks -- over the soft
 * rustle of the moss on its back, the bigger two lower and slower, with a click of their plates. At its work, the Mossnib's
 * nips: a small crisp crunch and a click of its jaws; the Mossshear's and the Mossreaver's cuts: the scrape of two blades drawn
 * over each other and the snip of them shut, a rustle of moss as it falls, and a soft thump of the cut moss gathered.
 *
 * A click is a very short band of noise with a dry tick of a tone in it; a chirr is a run of them; a rustle a soft band of high
 * noise; a scrape a narrow band of noise sliding down over a thin ringing; a snip a sharp high tick with a ring after it. The
 * bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-moss`): the nip or the slash on `MOSS_HITS`; each nip and each cut on
 * `MOSS_WORK`, and the gathering at its `lift`; the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.8, 0.62][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.45][s], s };
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

/** The moss on its back rustling, or moss falling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3000, to: 2000, q: 1, gain: 0.05 * k, attack: dur * 0.3 });
}

/** Two blades drawn over each other and shut: a scrape sliding down over a thin ring, and the snip. */
function snip(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at - 0.07, { dur: 0.08, freq: f * 2.2, to: f * 1.4, q: 6, gain: 0.05 * k, attack: 0.05 });
  ring(ctx, dest, at - 0.07, { freq: f * 1.9, to: f * 1.7, dur: 0.08, gain: 0.012 * k, type: 'sine', attack: 0.04 });
  burst(ctx, dest, at, { dur: 0.03, freq: f * 3, q: 2.5, gain: 0.12 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: f, to: f * 0.96, dur: 0.16, gain: 0.03 * k, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.7, 0.3]] });
}

/** A small crisp crunch: moss bitten through. */
function crunch(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + q * 0.014, { dur: 0.022, freq: 2200 + 700 * q, q: 1.6, gain: 0.06 * k * (1 - 0.2 * q), attack: 0.001 });
}

/**
 * Its own call, by stage. The Mossnib's: a quick chirr of six clicks round 3.4 kHz. The Mossshear's: seven, lower and slower,
 * and a click of its plates. The Mossreaver's: a slow run of eight round 2.1 kHz and a deep click of its plates, the moss on its
 * back rustling with it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  chirr(ctx, dest, at, 3400 * b.pitch, 6 + b.s, 0.03 * b.slow, k);
  if (b.s > 0) ring(ctx, dest, at + 0.02, { freq: 300 * b.pitch, to: 220 * b.pitch, dur: 0.07, gain: 0.08 * k, type: 'triangle', attack: 0.002 });
  rustle(ctx, dest, at, 0.16 * b.slow, 0.5 * k);
}

/** A strike: its moss rustling as it gathers, a hiss, and the Mossnib's jaws or the bigger two's blades shut on the blow. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 1.9, 1.8][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + MOSS_HITS[s] * T;
  rustle(ctx, out, at + 0.03, 0.14, 1);
  burst(ctx, out, at + 0.08, { dur: 0.12, freq: 4600 * b.pitch, q: 0.8, gain: 0.04, attack: 0.03 });
  if (s === 0) {
    click(ctx, out, hit, 2600, 1.4);
    crunch(ctx, out, hit + 0.01, 0.9);
  } else snip(ctx, out, hit, 1500 * b.pitch, 1.3);
  ring(ctx, out, hit, { freq: 150 - 30 * s, to: 70, dur: 0.1 + 0.04 * s, gain: 0.16, type: 'sine', attack: 0.002 });
  chirr(ctx, out, hit + 0.08, 3600 * b.pitch, 2, 0.03, 0.7);
};

/**
 * A go at its task. The Mossnib's: a click and a crunch at each nip, and a rustle as it lifts the tuft. The bigger two's: a
 * scrape and a snip at each cut with moss rustling down after it, and a soft thump as the cut moss is gathered.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.8, 2.3, 2.4][s]), b = bodyOf(stage, v), W = MOSS_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const c of W.nips) {
      click(ctx, out, at + c * T, 3000 * b.pitch, 1);
      crunch(ctx, out, at + c * T + 0.012, 0.9);
    }
  } else {
    for (const c of W.snips) {
      snip(ctx, out, at + c * T, 1500 * b.pitch, 1);
      rustle(ctx, out, at + c * T + 0.03, 0.12, 0.8);
    }
    ring(ctx, out, at + W.lift * T, { freq: 120 * b.pitch, to: 80 * b.pitch, dur: 0.08, gain: 0.08, type: 'sine', attack: 0.004 });
  }
  rustle(ctx, out, at + W.lift * T, 0.14, 0.7);
  if (v > 0.6) chirr(ctx, out, at + 0.92 * T, 3400 * b.pitch, 3, 0.03, 0.4);
};

/**
 * Evolving, a cue the length of the act: moss rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the chirr of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.12, 0.5 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 4000 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const MOSS_VOICE: Voice = { strike, work, evolve };
