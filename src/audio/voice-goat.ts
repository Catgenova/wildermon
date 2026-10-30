import { ACT_SECS } from '../render/beasts';
import { GOAT_HITS, GOAT_WORK } from '../render/wild-goat';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Briarling's voice, and its stages' (the species is `petta`): soft
 * bleats, a little mehh, and on the Floracrux, which wears one, a bell; the
 * Floracrux's bleat deeper and longer. At its work, the rustle of leaves as it
 * nibbles, the soft pluck of a flower, the swish of its toss and the rustle of
 * the flower landing in its collar or its basket.
 *
 * A bleat is a buzzy tone wavering eight or nine times a second, which is
 * what makes a goat's mehh: short swells of a sawtooth and a triangle one
 * after another, sliding a little down; a little breath of noise over the
 * start of it. The bigger the body, the lower and the longer, the Floracrux's
 * round 150 Hz. A bell is a high sine with the uneven partials of a bell. A
 * rustle is a soft band of high noise; a pluck a short, narrow snap.
 *
 * Every cue lands where its picture does (`./wild-goat`): the butt on
 * `GOAT_HITS`; each nibble, the pluck, the toss and the landing on
 * `GOAT_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how long its bleat, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), long: [1, 1.3, 1.8][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A bleat: a buzzy tone at `f` wavering `rate` times a second for `dur`, sliding down a little, with a breath at its start. */
function bleat(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number, rate = 8.5): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n, fq = f * (1.04 - 0.1 * u);
    const swell = 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.4));
    ring(ctx, dest, at + u * dur, { freq: fq, to: fq * 0.97, dur: 1.5 / rate, gain: 0.05 * k * swell, type: 'sawtooth', attack: 0.35 / rate });
    ring(ctx, dest, at + u * dur, { freq: fq, dur: 1.5 / rate, gain: 0.06 * k * swell, type: 'triangle', attack: 0.3 / rate, partials: [[1, 0.7], [2, 0.3]] });
  }
  burst(ctx, dest, at, { dur: 0.08, freq: f * 6, q: 1.5, gain: 0.04 * k, attack: 0.02 });
}

/** A small bell: a high clear tone with a bell's uneven partials, ringing on. */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur: 0.7, gain: 0.05 * k, type: 'sine', attack: 0.003, partials: [[1, 0.6], [2.76, 0.25], [5.4, 0.15]] });
}

/** Leaves rustling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3800, to: 2600, q: 1.2, gain: 0.05 * k, attack: dur * 0.3 });
}

/** A flower plucked: a short narrow snap and a tick. */
function pluck(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.02, freq: 2600, q: 8, gain: 0.12 * k, attack: 0.001 });
  ring(ctx, dest, at + 0.005, { freq: 1200, to: 700, dur: 0.05, gain: 0.05 * k, type: 'sine', attack: 0.002 });
}

/**
 * Its own call, by stage. The Briarling's: a quick high bleat round 520 Hz. The Meadowtide's: a fuller mehh round 370 Hz. The
 * Floracrux's: a long deep bleat round 260 Hz and its bell.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  bleat(ctx, dest, at, 520 * b.pitch, 0.32 * b.long, k, 9 - b.s);
  if (b.s === 2) bell(ctx, dest, at + 0.05, 2200, 0.8 * k);
}

/** A butt: a breath as it gathers itself, a soft knock of horn as it lands, a jingle of the Floracrux's bell, and a short bleat. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + GOAT_HITS[s] * T;
  burst(ctx, out, at + 0.04, { dur: 0.12, freq: 900 * b.pitch, q: 1, gain: 0.05, attack: 0.04 });
  ring(ctx, out, hit, { freq: 220 - 60 * s, to: 90, dur: 0.1 + 0.05 * s, gain: 0.26, type: 'sine', attack: 0.002 });
  burst(ctx, out, hit, { dur: 0.05, freq: 1500 - 300 * s, q: 1.4, gain: 0.16, attack: 0.001 });
  rustle(ctx, out, hit + 0.02, 0.18, 0.8);
  if (s === 2) { bell(ctx, out, hit + 0.01, 2200, 1); bell(ctx, out, hit + 0.09, 2200, 0.6); }
  bleat(ctx, out, hit + 0.1, 560 * b.pitch, 0.16 * b.long, 0.6, 9);
};

/**
 * A go at its task: a rustle at each nibble, the soft pluck of the flower, a swish as it is tossed, and a rustle as it lands in
 * the collar or the basket; the Floracrux's bell at the toss, and now and then a little mehh.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4, 3.4, 2.4][s]), b = bodyOf(stage, v), W = GOAT_WORK, T = ACT_SECS.work;
  for (const c of W.bites) rustle(ctx, out, at + (c - 0.03) * T, 0.07, 0.8);
  pluck(ctx, out, at + W.pluck * T, 1);
  burst(ctx, out, at + (W.toss - 0.03) * T, { dur: 0.12, freq: 1400, to: 3200, q: 1.5, gain: 0.04, attack: 0.04 });
  rustle(ctx, out, at + W.land * T, 0.12, 1);
  if (s === 2) bell(ctx, out, at + W.toss * T, 2200, 0.6);
  if (v > 0.6) bleat(ctx, out, at + 0.86 * T, 540 * b.pitch, 0.14 * b.long, 0.35, 9);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the bleat of what it has become.
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

export const GOAT_VOICE: Voice = { strike, work, evolve };
