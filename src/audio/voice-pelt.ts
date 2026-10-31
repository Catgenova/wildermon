import { ACT_SECS } from '../render/beasts';
import { PELT_HITS, PELT_WORK } from '../render/wild-pelt';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Peltling's voice, and its stages' (the species is `tanna`): a weasel's chuckle, quick soft clucks in a run, over the dry
 * rustle of its feather plates; the Hideweaver's lower and slower. At its work, the soft slap of a paw pressed into the hide,
 * the creak of leather drawn and stretched, and on the Hideweaver the whump of a big hide shaken out.
 *
 * A cluck is a short triangle tone falling a little, with a tick of breath; a chuckle is five or six of them, each a touch
 * lower. A rustle is a soft band of high noise; a slap a short low thud with a dull smack over it; a creak a narrow band of
 * noise sliding up, buzzing; a whump a wide burst of low noise falling away. The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`./wild-pelt`): the lunge on `PELT_HITS`; each knead, the stretch, the lift, the
 * working and the shake on `PELT_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.56][s] * (0.95 + 0.1 * v), slow: [1, 1.2, 1.5][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chuckle: `n` quick clucks round `f`, each a touch lower, `gap` apart. */
function chuckle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, gap: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const fq = f * (1 - 0.035 * q), t = at + q * gap;
    ring(ctx, dest, t, { freq: fq, to: fq * 0.82, dur: gap * 0.85, gain: 0.08 * k * (1 - 0.08 * q), type: 'triangle', attack: 0.004, partials: [[1, 0.75], [2, 0.25]] });
    burst(ctx, dest, t, { dur: 0.025, freq: fq * 4, q: 2, gain: 0.025 * k, attack: 0.002 });
  }
}

/** Its plates rustling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3400, to: 2400, q: 1.1, gain: 0.05 * k, attack: dur * 0.3 });
}

/** A paw pressed into the hide: a short low thud and a dull smack over it. */
function slap(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.6, dur: 0.09, gain: 0.16 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.06, freq: 900, to: 500, q: 1.2, gain: 0.09 * k, attack: 0.002 });
}

/** Leather drawn and stretched: a narrow band of noise sliding up, buzzing as it goes. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 1.6, q: 7, gain: 0.07 * k, attack: dur * 0.4 });
  ring(ctx, dest, at, { freq: f * 0.12, to: f * 0.16, dur, gain: 0.025 * k, type: 'sawtooth', attack: dur * 0.4 });
}

/**
 * Its own call, by stage. The Peltling's: a quick chuckle round 760 Hz. The Peltipede's: a fuller one round 580 Hz. The
 * Hideweaver's: a slow deep one round 420 Hz, its plates rustling with it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  chuckle(ctx, dest, at, 760 * b.pitch, 5 + b.s, 0.07 * b.slow, k);
  rustle(ctx, dest, at, 0.18 * b.slow, 0.5 * k);
}

/** A lunge: its plates rattled up as it rears, a hiss, a thud as its front comes down, and a sharp cluck. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + PELT_HITS[s] * T;
  rustle(ctx, out, at + 0.03, 0.16, 1.1);
  burst(ctx, out, at + 0.08, { dur: 0.14, freq: 4200 * b.pitch, q: 0.8, gain: 0.05, attack: 0.03 });
  ring(ctx, out, hit, { freq: 170 - 40 * s, to: 70, dur: 0.11 + 0.05 * s, gain: 0.24, type: 'sine', attack: 0.002 });
  burst(ctx, out, hit, { dur: 0.05, freq: 1300 - 300 * s, q: 1.4, gain: 0.14, attack: 0.001 });
  chuckle(ctx, out, hit + 0.06, 820 * b.pitch, 2, 0.06, 0.8);
};

/**
 * A go at its task. The Peltling's and the Peltipede's: a slap at each knead and a creak as the paw draws the hide back, a long
 * creak as it is stretched, and now and then a pleased chuckle. The Hideweaver's: a rustle as it lifts the hide, a long creak as
 * it is stretched wide, a creak as each side is worked, and the whump of it shaken out.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.3, 1.2, 4.6][s]), b = bodyOf(stage, v), W = PELT_WORK, T = ACT_SECS.work;
  if (s < 2) {
    for (const c of W.knead) {
      slap(ctx, out, at + c * T, 150 * b.pitch, 1);
      creak(ctx, out, at + (c + 0.03) * T, 0.09, 1500 * b.pitch, 0.7);
    }
    creak(ctx, out, at + (W.stretch - 0.12) * T, 0.14 * T + 0.05, 1100 * b.pitch, 1);
    if (v > 0.6) chuckle(ctx, out, at + 0.9 * T, 780 * b.pitch, 3, 0.06, 0.4);
    return;
  }
  rustle(ctx, out, at + 0.04 * T, 0.12, 0.8);
  creak(ctx, out, at + W.lift * T, (W.wide - W.lift) * T, 700, 1);
  for (const c of W.work) creak(ctx, out, at + (c - 0.04) * T, 0.1, 900, 0.8);
  burst(ctx, out, at + (W.shake - 0.02) * T, { dur: 0.22, freq: 380, to: 140, q: 0.7, gain: 0.16, attack: 0.01 });
  rustle(ctx, out, at + W.shake * T, 0.14, 0.7);
  if (v > 0.6) chuckle(ctx, out, at + 0.9 * T, 760 * b.pitch, 3, 0.08, 0.4);
};

/**
 * Evolving, a cue the length of the act: plates rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the chuckle of what it has become.
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

export const PELT_VOICE: Voice = { strike, work, evolve };
