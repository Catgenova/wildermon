import { ACT_SECS } from '../render/beat-times';
import { CHURN_HITS, CHURN_STROKES, CHURN_WORK, strokeTimes } from '../render/wild-churn';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Creamlet's voice, and its stages' (the species is `whirla`): a small
 * bright bloop, a round two-note burble, and a warm low hum through a wooden
 * barrel, over the butter they churn -- each plunger going home in its churn
 * with a soft wooden knock and a wet splosh of cream, and a pat of butter
 * patted down behind.
 *
 * A snail's call here is a bubble, as the Snaileaf's is: a sine sliding up
 * fast, the smaller the higher. The Butterwhorl's is a low hum round 120 Hz
 * through a hollow wooden resonance, where a small speaker still plays it. A
 * plunger home is a short low knock with a band of wet noise sliding down over
 * it; cream splashing is a few quick wet blips.
 *
 * Every cue lands where its picture does (`../render/wild-churn`): the strike
 * on `CHURN_HITS`; each stroke's plunger home on `strokeTimes`; the butter set
 * down on `CHURN_WORK.drop`; and the evolving chime on the flash at the middle
 * of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.44][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A bubble: a short sine sliding up, the higher the smaller, with a soft click as it pops. */
function bloop(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.8, dur, gain: 0.3 * k, type: 'sine', attack: 0.006 });
  burst(ctx, dest, at + dur * 0.8, { dur: 0.02, freq: f * 4, q: 3, gain: 0.04 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Creamlet's: three quick rising bloops, a giggle, round 640 Hz. The Churnsnail's: a round burble,
 * two lower bubbles over a soft wooden knock. The Butterwhorl's: a warm low hum round 120 Hz through a wooden resonance, a bubble
 * rising over it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    bloop(ctx, dest, at, 600 * b.pitch, 0.06, k);
    bloop(ctx, dest, at + 0.09, 680 * b.pitch, 0.06, k);
    bloop(ctx, dest, at + 0.18, 780 * b.pitch, 0.08, k);
    return;
  }
  if (b.s === 1) {
    bloop(ctx, dest, at, 560 * b.pitch, 0.1, 1.1 * k);
    bloop(ctx, dest, at + 0.14, 460 * b.pitch, 0.12, 1.1 * k);
    knock(ctx, dest, at + 0.02, 1, 0.4 * k);
    return;
  }
  const f = 300 * b.pitch;
  ring(ctx, dest, at, { freq: f, to: f * 0.9, dur: 0.8, gain: 0.2 * k, type: 'triangle', attack: 0.08, partials: [[1, 0.8], [2, 0.35], [3, 0.12]] });
  burst(ctx, dest, at + 0.02, { dur: 0.65, freq: 260, to: 190, q: 4, gain: 0.11 * k, attack: 0.1 });
  bloop(ctx, dest, at + 0.5, 420 * b.pitch, 0.14, 0.9 * k);
}

/** A plunger going home in a wooden churn: a short low knock, deeper for a bigger churn. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [240, 170, 120][s], to: [180, 120, 85][s], dur: 0.07 + 0.03 * s, gain: 0.32 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.7], [2.3, 0.25]] });
  burst(ctx, dest, at, { dur: 0.04, freq: 900, q: 1.4, gain: 0.08 * k, attack: 0.001 });
}

/** Cream sloshing as the plunger goes in: a band of wet noise sliding down, and a few quick blips of it splashing. */
function splosh(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.12, freq: 1300 * pitch, to: 420 * pitch, q: 2, gain: 0.14 * k, attack: 0.008 });
  for (let q = 0; q < 3; q++) ring(ctx, dest, at + 0.04 + q * 0.035, { freq: (900 + 260 * q) * pitch, to: (1300 + 300 * q) * pitch, dur: 0.025, gain: 0.06 * k, type: 'sine', attack: 0.002 });
}

/** Something soft coming down on the ground: a low, muffled thump, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [190, 120, 80][s], to: [95, 60, 40][s], dur: [0.1, 0.18, 0.32][s], gain: [0.3, 0.42, 0.55][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.08 * s, freq: 600, to: 160, q: 0.8, gain: (0.14 + 0.06 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** A strike: a breath drawn in as it rears, then its head and the weight of its churns brought down with a heavy thump, cream sloshing. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.15, 0.95][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + CHURN_HITS[s] * T;
  call(ctx, out, at + 0.02, s, v, 0.45);
  burst(ctx, out, hit - 0.12, { dur: 0.12, freq: 500 * b.pitch, to: 1400 * b.pitch, q: 0.9, gain: 0.08, attack: 0.09 });
  thump(ctx, out, hit, s, 1);
  knock(ctx, out, hit + 0.03, s, 0.7);
  splosh(ctx, out, hit + 0.05, 1.1 * b.pitch + 0.2, 0.8);
};

/**
 * A go at its task: each stroke's plunger knocking home in its churn with a splosh of cream -- the Butterwhorl's three churns a
 * moment apart -- a soft pat as its butter goes down behind it, and now and then its call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), T = ACT_SECS.work;
  const p = 1 / (0.7 + 0.6 * b.heavy), churns = [1, 1, 3][s];
  for (const home of strokeTimes()) {
    for (let i = 0; i < churns; i++) {
      const when = at + (home + 0.035 * i) * T;
      knock(ctx, out, when, i ? 0 : s, i ? 0.45 : 0.8);
      splosh(ctx, out, when + 0.02, p * (i ? 1.25 : 1), i ? 0.5 : 0.8);
    }
  }
  thump(ctx, out, at + CHURN_WORK.drop * T + 0.04, 0, 0.35);
  burst(ctx, out, at + CHURN_WORK.drop * T, { dur: 0.06, freq: 520 * p, to: 300 * p, q: 1.2, gain: 0.12, attack: 0.004 });
  if (v > 0.5 && CHURN_STROKES > 2) call(ctx, out, at + (CHURN_WORK.drop + 0.06) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: cream sloshing faster and brighter to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 2400 * key, q: 1.1, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 6; q++) {
    const u = q / 6, when = at + 0.15 + (flash - 0.25) * (1 - (1 - u) ** 1.6);
    splosh(ctx, dest, when, key * (1 + 0.4 * u), 0.4 + 0.5 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1318 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [349, 440, 523]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const CHURN_VOICE: Voice = { strike, work, evolve };
