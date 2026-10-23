import { ACT_SECS } from '../render/beasts';
import { SNAIL_HITS, SNAIL_ROCKS, SNAIL_WORK } from '../render/wild-snail';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Snaileaf's voice, and its stages' (the species is `middun`): a
 * small wet bloop, a hollow two-note burble, and a deep woody groan with
 * leaves rustling over it, over the compost they turn -- something rotting
 * slurped up in gulps, soil and leaves tumbling as the shell rocks, and a
 * soft plop of compost behind.
 *
 * A snail's call here is a bubble: a sine sliding up fast, the way a bubble
 * rises and pops, the smaller the higher. The Hearthsnail's is a low hum
 * through a hollow wooden resonance, its energy between 110 and 300 Hz where
 * a small speaker still plays it. Tumbling soil is low noise in short grains;
 * leaves are high, dry noise in quick flutters; a slurp is a band of noise
 * sliding down with a wet pop at its end.
 *
 * Every cue lands where its picture does (`../render/wild-snail`): the strike
 * on `SNAIL_HITS`; each gulp, each rock of the shell and the compost dropped
 * on `SNAIL_WORK`; and the evolving chime on the flash at the middle of the
 * act.
 */

/** How a stage sounds: how far down its voice is, and how heavy. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A bubble: a short sine sliding up, the higher the smaller, with a soft click as it pops. */
function bloop(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.9, dur, gain: 0.32 * k, type: 'sine', attack: 0.006 });
  burst(ctx, dest, at + dur * 0.8, { dur: 0.02, freq: f * 4, q: 3, gain: 0.05 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Snaileaf's: two quick bloops, the second higher, round 600 Hz. The Middunsnail's: a hollow
 * burble, two lower bubbles over a short earthy rumble. The Hearthsnail's: a long low groan round 110 Hz through a wooden
 * resonance, leaves rustling over it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    bloop(ctx, dest, at, 560 * b.pitch, 0.07, k);
    bloop(ctx, dest, at + 0.11, 700 * b.pitch, 0.08, k);
    return;
  }
  if (b.s === 1) {
    bloop(ctx, dest, at, 520 * b.pitch, 0.1, 1.1 * k);
    bloop(ctx, dest, at + 0.14, 420 * b.pitch, 0.13, 1.1 * k);
    burst(ctx, dest, at, { dur: 0.3, freq: 220, to: 140, q: 1.2, gain: 0.14 * k, attack: 0.04 });
    return;
  }
  const f = 280 * b.pitch;
  ring(ctx, dest, at, { freq: f, to: f * 0.82, dur: 0.85, gain: 0.2 * k, type: 'triangle', attack: 0.08, partials: [[1, 0.8], [2, 0.35], [2.7, 0.15]] });
  burst(ctx, dest, at + 0.02, { dur: 0.7, freq: 240, to: 160, q: 4, gain: 0.12 * k, attack: 0.1 });
  rustle(ctx, dest, at + 0.25, 0.5, 0.7 * k);
}

/** Dry leaves rustling: quick flutters of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  const n = Math.max(3, Math.round(dur / 0.05));
  for (let q = 0; q < n; q++) {
    burst(ctx, dest, at + (q / n) * dur + 0.01 * Math.sin(q * 7.1), { dur: 0.04, freq: 3200 + 1400 * Math.abs(Math.sin(q * 2.3)), q: 1.4, gain: 0.05 * k, attack: 0.003 });
  }
}

/** Soil tumbling: low grains of noise, a few at a time. */
function tumble(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  const n = Math.max(3, Math.round(dur / 0.04));
  for (let q = 0; q < n; q++) {
    burst(ctx, dest, at + (q / n) * dur, { dur: 0.05, freq: (420 + 260 * Math.abs(Math.sin(q * 3.7))) * pitch, q: 1.1, gain: 0.09 * k * (0.6 + 0.4 * Math.sin((q / n) * Math.PI)), attack: 0.004 });
  }
}

/** A slurp: a band of wet noise sliding down, and a little pop as it goes in. */
function slurp(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.08, freq: 1500 * pitch, to: 500 * pitch, q: 2.4, gain: 0.16 * k, attack: 0.01 });
  ring(ctx, dest, at + 0.06, { freq: 260 * pitch, to: 420 * pitch, dur: 0.04, gain: 0.18 * k, type: 'sine', attack: 0.002 });
}

/** Something soft coming down on the ground: a low, muffled thump, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [190, 120, 80][s], to: [95, 60, 40][s], dur: [0.1, 0.18, 0.32][s], gain: [0.3, 0.42, 0.55][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.08 * s, freq: 600, to: 160, q: 0.8, gain: (0.14 + 0.06 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * A strike: a breath drawn in as it rears, then its head and the weight of its shell brought down on the ground before it with a
 * soft heavy thump, soil and leaves scattering.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.15, 0.95][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + SNAIL_HITS[s] * T;
  call(ctx, out, at + 0.02, s, v, 0.45);
  burst(ctx, out, hit - 0.12, { dur: 0.12, freq: 500 * b.pitch, to: 1400 * b.pitch, q: 0.9, gain: 0.08, attack: 0.09 });
  thump(ctx, out, hit, s, 1);
  tumble(ctx, out, hit + 0.02, 0.16 + 0.06 * s, 1.1 * b.pitch + 0.3, 0.9);
  rustle(ctx, out, hit + 0.03, 0.15, 0.8);
};

/**
 * A go at its task: three slurps as it takes the rotting thing in, soil tumbling and leaves rustling as its shell rocks each way,
 * a soft plop as its compost drops behind it, and now and then its call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), W = SNAIL_WORK, T = ACT_SECS.work;
  const p = 1 / (0.7 + 0.6 * b.heavy);
  for (let q = 0; q < 3; q++) slurp(ctx, out, at + (W.gulp + ((W.gone - W.gulp) * q) / 3) * T, p * (1 - 0.06 * q), 0.9);
  const [c0, c1] = W.churn, rock = ((c1 - c0) / (SNAIL_ROCKS * 2)) * T;
  for (let q = 0; q < SNAIL_ROCKS * 2; q++) {
    const when = at + c0 * T + rock * (q + 0.3);
    tumble(ctx, out, when, rock * 0.7, p, 0.8);
    if (q % 2) rustle(ctx, out, when + rock * 0.2, rock * 0.5, 0.7);
  }
  thump(ctx, out, at + W.drop * T + 0.04, s, 0.3);
  burst(ctx, out, at + W.drop * T, { dur: 0.08, freq: 380 * p, to: 200 * p, q: 1.2, gain: 0.14, attack: 0.004 });
  if (v > 0.5) call(ctx, out, at + (W.drop + 0.08) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: leaves rustling faster and brighter as they swirl in, to the flash at its middle, where
 * a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the bloop, the burble or the
 * groan of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 2400 * key, q: 1.1, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.15 + (flash - 0.25) * (1 - (1 - u) ** 1.6);
    rustle(ctx, dest, when, 0.08, 0.5 + 0.6 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1318 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [330, 415, 494]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const SNAIL_VOICE: Voice = { strike, work, evolve };
