import { ACT_SECS } from '../render/beasts';
import { MUS_HITS, MUS_WORK } from '../render/wild-mouse';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Wheybit's voice, and its stages' (the species is `frosta`): a high
 * squeaking giggle, a rounder two-note squeak, and a deep warm chuckle with a
 * squeak on the end, over the cheese they press -- each squeeze of the curd a
 * soft wet squelch, the whey dripping after it in small bright drops.
 *
 * A mouse's squeak here is a short sine sliding up and back with a quick
 * flutter on it, the smaller the higher; the Fromageon's chuckle is three
 * falling "heh"s round 300 Hz through a soft vowel. A squeeze is a band of wet
 * noise pressed down in pitch; a drop of whey is a tiny sine blip falling.
 *
 * Every cue lands where its picture does (`../render/wild-mouse`): the strike
 * on `MUS_HITS`; each squeeze on `MUS_WORK.squeezes`; and the evolving chime
 * on the flash at the middle of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.8, 0.62][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A squeak: a short sine up and back, with a flutter on it, and a breath of noise at its start. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.35, dur: dur * 0.55, gain: 0.18 * k, type: 'sine', attack: 0.006 });
  ring(ctx, dest, at + dur * 0.5, { freq: f * 1.35, to: f * 1.1, dur: dur * 0.5, gain: 0.15 * k, type: 'sine', attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.02, freq: f * 2.2, q: 4, gain: 0.03 * k, attack: 0.002 });
}

/** A "heh": a short falling triangle through a soft vowel. */
function heh(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.85, dur: 0.11, gain: 0.2 * k, type: 'triangle', attack: 0.01, partials: [[1, 0.8], [2, 0.3], [3, 0.1]] });
  burst(ctx, dest, at, { dur: 0.09, freq: 700, to: 520, q: 3, gain: 0.05 * k, attack: 0.01 });
}

/**
 * Its own call, by stage. The Wheybit's: a giggle of three quick squeaks rising, round 1900 Hz. The Pressqueak's: two rounder
 * squeaks, the second higher. The Fromageon's: a warm chuckle, three falling "heh"s round 300 Hz, and a squeak on the end.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    squeak(ctx, dest, at, 1800 * b.pitch, 0.07, k);
    squeak(ctx, dest, at + 0.09, 1950 * b.pitch, 0.07, k);
    squeak(ctx, dest, at + 0.18, 2150 * b.pitch, 0.09, k);
    return;
  }
  if (b.s === 1) {
    squeak(ctx, dest, at, 1500 * b.pitch, 0.11, 1.1 * k);
    squeak(ctx, dest, at + 0.15, 1750 * b.pitch, 0.13, 1.1 * k);
    return;
  }
  for (let q = 0; q < 3; q++) heh(ctx, dest, at + q * 0.13, (330 - 25 * q) * (0.9 + 0.2 * v), k);
  squeak(ctx, dest, at + 0.44, 1300 * b.pitch, 0.12, 0.8 * k);
}

/** A squeeze of the curd: a band of wet noise pressed down in pitch, deeper for a bigger round. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  burst(ctx, dest, at, { dur: 0.16 + 0.04 * s, freq: [1400, 1100, 850][s], to: [500, 380, 280][s], q: 1.6, gain: 0.16 * k, attack: 0.02 });
  ring(ctx, dest, at + 0.01, { freq: [220, 160, 120][s], to: [170, 120, 90][s], dur: 0.1, gain: 0.12 * k, type: 'sine', attack: 0.01 });
}

/** Drops of whey falling: tiny bright blips, each a little lower. */
function drips(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) ring(ctx, dest, at + q * 0.07, { freq: 1700 - 160 * q, to: 2300 - 160 * q, dur: 0.025, gain: 0.05 * k, type: 'sine', attack: 0.002 });
}

/** Paws landing: a soft, muffled thump, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [200, 140, 95][s], to: [110, 75, 50][s], dur: [0.08, 0.14, 0.24][s], gain: [0.28, 0.38, 0.5][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.06 + 0.06 * s, freq: 700, to: 200, q: 0.8, gain: (0.12 + 0.05 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** A strike: a squeak as it winds, then both paws shoved home with a soft thump. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.2, 1][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + MUS_HITS[s] * T;
  squeak(ctx, out, at + 0.05, 1700 * b.pitch, 0.1, 0.8);
  burst(ctx, out, hit - 0.1, { dur: 0.1, freq: 600 * b.pitch, to: 1500 * b.pitch, q: 0.9, gain: 0.07, attack: 0.08 });
  thump(ctx, out, hit, s, 1);
};

/** A go at its task: each squeeze a wet squelch with the whey dripping after it, and now and then its call, softly. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), T = ACT_SECS.work;
  for (const c of MUS_WORK.squeezes) {
    squelch(ctx, out, at + (c - 0.06) * T, s, 0.9);
    drips(ctx, out, at + (c + 0.06) * T, 3, 0.8);
  }
  if (v > 0.5) call(ctx, out, at + 0.85 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: squeaks quickening and rising to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 2400 * key, q: 1.1, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 6; q++) {
    const u = q / 6, when = at + 0.15 + (flash - 0.25) * (1 - (1 - u) ** 1.6);
    squeak(ctx, dest, when, (1300 + 700 * u) * key, 0.05, 0.4 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1318 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const MOUSE_VOICE: Voice = { strike, work, evolve };
