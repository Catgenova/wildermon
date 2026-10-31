import { ACT_SECS } from '../render/beasts';
import { SHEAR_HITS, SHEAR_WORK } from '../render/wild-shear';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Shearling's voice, and its stages' (the species is `sheela`): the
 * Shearling a lamb's high bleat; the Clipperoo and the Shearlord the soft
 * clucks and huffs a kangaroo makes, deeper and slower the bigger the body.
 * At its work, the snip of its forepaws four times, a wool tuft's soft
 * rustle at each, and a muffled whump as the clip goes into the stores.
 *
 * A bleat is a buzzy tone wavering eight times a second (as the goat line's,
 * `./voice-goat`), higher and shorter. A cluck is a short knock of a low sine
 * with a click over it; a huff a breath of low noise. A snip is two quick
 * narrow ticks, the blades meeting. Fleece rustles as a soft band of
 * mid-high noise, lower than leaves.
 *
 * Every cue lands where its picture does (`./wild-shear`): the butt or the
 * kick on `SHEAR_HITS`; each snip, the gathering and the clip going on
 * `SHEAR_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how long its call, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.52][s] * (0.95 + 0.1 * v), long: [1, 1.2, 1.5][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A bleat: a buzzy tone at `f` wavering `rate` times a second for `dur`, sliding down a little, with a breath at its start. */
function bleat(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number, rate = 8): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n, fq = f * (1.05 - 0.12 * u);
    const swell = 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.4));
    ring(ctx, dest, at + u * dur, { freq: fq, to: fq * 0.97, dur: 1.5 / rate, gain: 0.045 * k * swell, type: 'sawtooth', attack: 0.35 / rate });
    ring(ctx, dest, at + u * dur, { freq: fq, dur: 1.5 / rate, gain: 0.06 * k * swell, type: 'triangle', attack: 0.3 / rate, partials: [[1, 0.7], [2, 0.3]] });
  }
  burst(ctx, dest, at, { dur: 0.06, freq: f * 6, q: 1.5, gain: 0.035 * k, attack: 0.02 });
}

/** A cluck: a short low knock with a click over it, as a kangaroo's. */
function cluck(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.7, dur: 0.07, gain: 0.14 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.015, freq: 2400, q: 6, gain: 0.08 * k, attack: 0.001 });
}

/** A huff: a breath of low noise. */
function huff(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.7, q: 0.8, gain: 0.06 * k, attack: dur * 0.25 });
}

/** A snip: two quick narrow ticks, the blades meeting. */
function snip(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.012, freq: 5200, q: 9, gain: 0.1 * k, attack: 0.001 });
  burst(ctx, dest, at + 0.025, { dur: 0.016, freq: 4300, q: 9, gain: 0.12 * k, attack: 0.001 });
}

/** Wool rustling: a soft band of mid-high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2200, to: 1500, q: 1.1, gain: 0.05 * k, attack: dur * 0.3 });
}

/**
 * Its own call, by stage. The Shearling's: a quick high bleat round 640 Hz. The Clipperoo's: two clucks round 300 Hz and a huff.
 * The Shearlord's: three slower, deeper clucks round 210 Hz and a long huff.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    bleat(ctx, dest, at, 640 * b.pitch, 0.3, k, 9);
    return;
  }
  const n = b.s + 1, gap = 0.11 * b.long;
  for (let q = 0; q < n; q++) cluck(ctx, dest, at + q * gap, 430 * b.pitch * (1 - 0.06 * q), k);
  huff(ctx, dest, at + n * gap, 0.18 * b.long, 700 * b.pitch, k);
}

/** A strike: a breath as it gathers itself, a soft thump of fleece as the butt or the kick lands, and a call after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.4][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + SHEAR_HITS[s] * T;
  huff(ctx, out, at + 0.05, 0.12, 900 * b.pitch, 1);
  ring(ctx, out, hit, { freq: 170 - 40 * s, to: 70, dur: 0.12 + 0.04 * s, gain: 0.26, type: 'sine', attack: 0.002 });
  burst(ctx, out, hit, { dur: 0.06, freq: 900 - 150 * s, q: 1.2, gain: 0.14, attack: 0.001 });
  rustle(ctx, out, hit + 0.02, 0.16, 0.9);
  if (s === 0) bleat(ctx, out, hit + 0.1, 680 * b.pitch, 0.14, 0.6, 9);
  else cluck(ctx, out, hit + 0.12, 430 * b.pitch, 0.7);
};

/** A go at its task: a snip at each of the four, a rustle of wool with each, a rustle as the clip is gathered, a whump as it goes. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4, 3.4, 2.8][s]), b = bodyOf(stage, v), W = SHEAR_WORK, T = ACT_SECS.work;
  W.snips.forEach((c, q) => {
    snip(ctx, out, at + (c - 0.04) * T, 0.9 + 0.1 * (q % 2));
    rustle(ctx, out, at + c * T, 0.06, 0.6);
  });
  rustle(ctx, out, at + (W.gather - 0.04) * T, 0.12, 1);
  ring(ctx, out, at + W.gone * T, { freq: 140 - 20 * s, to: 90, dur: 0.1, gain: 0.08, type: 'sine', attack: 0.01 });
  burst(ctx, out, at + W.gone * T, { dur: 0.1, freq: 600, q: 0.8, gain: 0.04, attack: 0.02 });
  if (v > 0.6) {
    if (s === 0) bleat(ctx, out, at + 0.84 * T, 660 * b.pitch, 0.12, 0.35, 9);
    else cluck(ctx, out, at + 0.84 * T, 430 * b.pitch, 0.4);
  }
};

/**
 * Evolving, a cue the length of the act: wool rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the voice of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.12, 0.5 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1480 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [370, 466, 554]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const SHEAR_VOICE: Voice = { strike, work, evolve };
