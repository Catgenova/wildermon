import { ACT_SECS } from '../render/beasts';
import { LOOM_HITS, LOOM_WORK } from '../render/wild-loomhare';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Clothkit's voice, and its stages' (the species is `leecha`): a rabbit's soft sounds and the thump of its hind foot. The
 * Clothkit chirps, two quick bright peeps that rise; the Loomhare's chirp is lower and it grunts after it; the
 * Bandageweaver's is a soft low honk and a purr. A thump is a low thud with a brush of earth in it; cloth is a soft band of
 * noise, a rustle as it is drawn and a whisper as it winds.
 *
 * Every cue lands where its picture does (`../render/wild-loomhare`): the cuff on `LOOM_HITS`, each turn of the roll and the
 * tug of the strip on `LOOM_WORK`, the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.5][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** Cloth drawn or wound: a soft band of mid noise, swelling and dying. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number, f = 3200): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.7, q: 0.8, gain: 0.05 * k, attack: dur * 0.45 });
}

/** A peep: a short tone sliding up, through a band. */
function peep(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.35, dur: 0.06, gain: 0.06 * k, type: 'triangle', attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.03, freq: f * 2.2, q: 4, gain: 0.015 * k, attack: 0.003 });
}

/** A thump of a hind foot: a low thud and a brush of earth. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.5, dur: 0.12, gain: 0.16 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.05, freq: 700, q: 1, gain: 0.04 * k, attack: 0.002 });
}

/**
 * Its own call, by stage. The Clothkit's: two peeps round 2.2 kHz. The Loomhare's: a lower peep and a short grunt. The
 * Bandageweaver's: a soft low honk and a purr under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    peep(ctx, dest, at, 2200 * b.pitch, k);
    peep(ctx, dest, at + 0.09, 2400 * b.pitch, k * 0.8);
  } else if (b.s === 1) {
    peep(ctx, dest, at, 2200 * b.pitch, k);
    burst(ctx, dest, at + 0.08, { dur: 0.09, freq: 520, to: 380, q: 2, gain: 0.06 * k, attack: 0.01 });
  } else {
    ring(ctx, dest, at, { freq: 320 * b.pitch * 2, to: 260 * b.pitch * 2, dur: 0.16, gain: 0.06 * k, type: 'triangle', attack: 0.02 });
    for (let q = 0; q < 6; q++) burst(ctx, dest, at + 0.14 + q * 0.035, { dur: 0.03, freq: 240, q: 2, gain: 0.04 * k, attack: 0.008 });
  }
}

/** A strike: a thump as it rears, a rustle of its strips, and the cuff, and its call after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.8, 1.7][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  thump(ctx, out, at + 0.04, 120 - 25 * s, 0.7);
  rustle(ctx, out, at + 0.1, 0.12 * b.slow, 0.8);
  const h = LOOM_HITS[s] * T;
  ring(ctx, out, at + h, { freq: 180 - 30 * s, to: 70, dur: 0.1 + 0.03 * s, gain: 0.14, type: 'sine', attack: 0.002 });
  burst(ctx, out, at + h, { dur: 0.05, freq: 1100, q: 1.2, gain: 0.05, attack: 0.002 });
  call(ctx, out, at + h + 0.05, s, v, 0.7);
};

/** A go at its task: a whisper of cloth at each turn of the roll, a rustle as the strip is tugged taut. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 2.6, 2.4][s]), b = bodyOf(stage, v), W = LOOM_WORK, T = ACT_SECS.work;
  for (const c of W.winds) rustle(ctx, out, at + (c - 0.08) * T, 0.16, 1, 2600 * (0.8 + 0.2 * b.pitch));
  rustle(ctx, out, at + W.tug * T, 0.06, 1.4, 4200);
  if (v > 0.7) peep(ctx, out, at + 0.95 * T, 2200 * b.pitch, 0.5);
};

/**
 * Evolving, a cue the length of the act: cloth rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- a thump, and then its own call, as what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  rustle(ctx, dest, at + 0.1, flash - 0.1, 1.4);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  thump(ctx, dest, at + flash + 0.2, 110 - 20 * s, 0.8);
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const LOOMHARE_VOICE: Voice = { strike, work, evolve };
