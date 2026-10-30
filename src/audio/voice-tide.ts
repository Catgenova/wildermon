import { ACT_SECS } from '../render/beasts';
import { TIDE_HITS, TIDE_WORK } from '../render/wild-tide';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Springlet's voice, and its stages' (the species is `springlet`): a
 * small soft chirrup, a bubbly trill and a gentle whistle; deeper and rounder
 * as it grows, the Tidecourser's a low hollow call with a swell under it; and
 * water -- a splash, a flutter of wet fins, drops falling.
 *
 * A chirrup is a sine slid up and back down, short; a trill is a run of them
 * quick and close, wobbling, which is what a bubble makes of a voice; a
 * whistle is a long pure sine bending up and settling. The bigger the body,
 * the lower all of it, and the Tidecourser's has a soft octave under it and a
 * slow swell of low sine so it rings like a call over water. A splash is noise
 * falling away; fins fluttering are quick soft slaps of noise; a drop is a
 * sine leaping up, which is a bubble's ring as it closes.
 *
 * Every cue lands where its picture does (`./wild-tide`): the strike on
 * `TIDE_HITS`; the nibbles and the shake on `TIDE_WORK`; and the evolving
 * chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.48][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chirrup: a soft sine slid up from `f` and back, short, with a breath of noise over it. */
function chirrup(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 0.85, to: f * 1.25, dur: 0.06, gain: 0.12 * k, type: 'sine', attack: 0.008 });
  ring(ctx, dest, at + 0.055, { freq: f * 1.2, to: f * 0.95, dur: 0.07, gain: 0.1 * k, type: 'sine', attack: 0.006 });
  burst(ctx, dest, at, { dur: 0.08, freq: f * 2.4, q: 3, gain: 0.02 * k, attack: 0.01 });
}

/** A bubbly trill: chirps quick and close round `f`, wobbling up and down, `n` of them. */
function trill(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const g = f * (1 + 0.08 * Math.sin(q * 2.1));
    ring(ctx, dest, at + q * 0.045, { freq: g * 0.9, to: g * 1.15, dur: 0.04, gain: 0.09 * k * (1 - 0.3 * q / n), type: 'sine', attack: 0.004 });
  }
}

/** A gentle whistle: a long pure note bending up from `f` and settling, a soft octave under it for a big body. */
function whistle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, heavy: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 0.92, to: f * 1.08, dur, gain: 0.1 * k, type: 'sine', attack: dur * 0.3 });
  if (heavy > 0.5) ring(ctx, dest, at, { freq: f * 0.46, to: f * 0.54, dur: dur * 1.1, gain: 0.08 * k * heavy, type: 'triangle', attack: dur * 0.35 });
}

/**
 * Its own call, by stage. The Springlet's: two quick chirrups round 1500 Hz and a little trill. The Springsail's: a chirrup, a
 * trill and a short whistle round 1000 Hz. The Tidecourser's: a long low whistle round 700 Hz over a soft octave, a trill after
 * it, and a slow swell under both.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 1500 * b.pitch;
  if (b.s === 0) {
    chirrup(ctx, dest, at, f, k);
    chirrup(ctx, dest, at + 0.16, f * 1.08, 0.8 * k);
    trill(ctx, dest, at + 0.34, f * 1.1, 4, 0.6 * k);
    return;
  }
  if (b.s === 1) {
    chirrup(ctx, dest, at, f, k);
    trill(ctx, dest, at + 0.15, f * 1.05, 5, 0.7 * k);
    whistle(ctx, dest, at + 0.42, f * 1.15, 0.32, b.heavy, 0.8 * k);
    return;
  }
  whistle(ctx, dest, at, f, 0.6, b.heavy, 1.1 * k);
  trill(ctx, dest, at + 0.62, f * 1.2, 6, 0.6 * k);
  ring(ctx, dest, at, { freq: 110, to: 96, dur: 1.0, gain: 0.07 * k, type: 'sine', attack: 0.2 });
}

/** Water struck: a splash of noise falling away, bigger and lower for a bigger body. */
function splash(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.18 + 0.2 * heavy, freq: 2400 - 900 * heavy, to: 420, q: 0.6, gain: 0.3 * k, attack: 0.004 });
  burst(ctx, dest, at + 0.03, { dur: 0.12, freq: 3900, to: 2000, q: 1.2, gain: 0.08 * k, attack: 0.01 });
  ring(ctx, dest, at, { freq: 150 - 50 * heavy, to: 72, dur: 0.1 + 0.12 * heavy, gain: 0.1 * k * heavy, type: 'sine', attack: 0.004 });
}

/** Wet fins fluttering: quick soft slaps of noise, a little apart, falling in pitch. */
function flutter(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, heavy: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.035, { dur: 0.03, freq: (2600 - 900 * heavy) * (1 - 0.05 * q), q: 1.4, gain: 0.07 * k, attack: 0.002 });
}

/** A drop falling: a sine leaping up in pitch, short. */
function drop(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.7, dur: 0.05, gain: 0.1 * k, type: 'sine', attack: 0.003 });
}

/**
 * A strike. The Springlet chirrups as it pounces and lands on its fore feet in a splash. The Springsail's tail swishes round and
 * slaps the water. The Tidecourser calls as it rears and brings its fore feet down in a deep thump and a big splash. Each with a
 * flutter of wet fins after the hit.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 0.9, 0.85][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + TIDE_HITS[s] * T;
  if (s === 0) chirrup(ctx, out, at + 0.04, 1500 * b.pitch, 0.7);
  if (s === 1) burst(ctx, out, hit - 0.16, { dur: 0.16, freq: 2400, to: 800, q: 1.4, gain: 0.14, attack: 0.1 });
  if (s === 2) whistle(ctx, out, at + 0.02, 1500 * b.pitch, 0.24, b.heavy, 0.6);
  ring(ctx, out, hit, { freq: 200 - 90 * b.heavy, to: 70, dur: 0.1 + 0.2 * b.heavy, gain: 0.25 + 0.2 * b.heavy, type: 'sine', attack: 0.003 });
  splash(ctx, out, hit, b.heavy, 0.9);
  flutter(ctx, out, hit + 0.06, 4 + s, b.heavy, 1);
  for (let q = 0; q < 3; q++) drop(ctx, out, hit + 0.18 + q * 0.06, 1700 + 400 * q - 400 * b.heavy, 0.4);
};

/**
 * A go at its task, which is preening: three soft nibbles at a fin, a chirrup, and a shake -- a long flutter of wet fins and
 * drops flung off it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4.2, 4, 3.8][s]), b = bodyOf(stage, v), W = TIDE_WORK, T = ACT_SECS.work;
  for (const n of W.nibbles) burst(ctx, out, at + n * T, { dur: 0.04, freq: 1900 * (0.8 + 0.4 * b.pitch), q: 2, gain: 0.06, attack: 0.003 });
  flutter(ctx, out, at + (W.shake - 0.08) * T, 7, b.heavy, 1);
  for (let q = 0; q < 4; q++) drop(ctx, out, at + (W.shake + 0.02 + q * 0.04) * T, 1600 + 300 * (q % 2) - 300 * b.heavy, 0.5);
  if (v > 0.5) call(ctx, out, at + 0.9 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a splash, then bubbles rising faster and higher as the petals and the water swirl in,
 * to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own
 * call, what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  splash(ctx, dest, at + 0.02, 0.3, 0.5);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 500 * key, to: 1400 * key, q: 1.2, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    drop(ctx, dest, when, (1000 + 900 * u) * key, 0.35 + 0.35 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1760 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [440, 554, 659]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const TIDE_VOICE: Voice = { strike, work, evolve };
