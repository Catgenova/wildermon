import { ACT_SECS } from '../render/beat-times';
import { GINGER_HITS, GINGER_THUMPS } from '../render/wild-ginger';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Crumbud's voice, and its stages' (the species is `crumbud`): baked gingerbread with bells on. Its call is a cheerful grunt
 * -- a short voiced hum that lifts at the end -- with sleigh-bell jingles after it: the Crumbud's high and quick, the
 * Gingerbark's lower with a jingle, the Yuleheart's a deep chesty "ho" and a big bell. A knock of gingerbread is a dull crunch, a
 * thud with crumbs of noise.
 *
 * Every cue lands where its picture does (`../render/wild-ginger`): the blow on `GINGER_HITS`, each thump on its chest on
 * `GINGER_THUMPS` (its Taunt, ringing a bell at the second), the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), slow: [1, 1.25, 1.6][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A grunt: a voiced hum through a mouth-like band, lifting a little at the end. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.25, dur, gain: 0.1 * k, type: 'sawtooth', attack: dur * 0.2 });
  burst(ctx, dest, at, { dur, freq: f * 4, to: f * 5, q: 3, gain: 0.03 * k, attack: dur * 0.3 });
}

/** A sleigh bell: a bright cluster of inharmonic partials, struck and fading quickly; `n` shakes. */
function jingle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, key: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const t = at + q * 0.055 + 0.008 * Math.sin(q * 5.3);
    const f = (3100 + 420 * Math.sin(q * 2.7)) * key;
    ring(ctx, dest, t, { freq: f, dur: 0.16, gain: 0.025 * k, type: 'sine', attack: 0.002, partials: [[1, 0.6], [1.47, 0.25], [2.09, 0.15]] });
    burst(ctx, dest, t, { dur: 0.03, freq: 7000 * key, q: 4, gain: 0.02 * k, attack: 0.001 });
  }
}

/** A hand bell: one clear struck tone with its hum and its overtones, ringing on. */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur, gain: 0.07 * k, type: 'sine', attack: 0.003, partials: [[1, 0.55], [2.0, 0.2], [2.76, 0.15], [5.4, 0.1]] });
  ring(ctx, dest, at, { freq: f * 0.5, dur: dur * 0.8, gain: 0.03 * k, type: 'sine', attack: 0.01 });
}

/** A knock of gingerbread: a dull thud and a crunch of crumbs. */
function crunch(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.55, dur: 0.11, gain: 0.13 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.07, freq: 1500, to: 900, q: 1.2, gain: 0.06 * k, attack: 0.002 });
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + 0.03 + 0.035 * q, { dur: 0.01, freq: 3200 + 500 * q, q: 5, gain: 0.018 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Crumbud's: two quick high grunts and a little jingle. The Gingerbark's: one lower grunt that lifts,
 * and a jingle. The Yuleheart's: a deep slow "ho" and a hand bell under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    grunt(ctx, dest, at, 0.07, 330 * b.pitch, k);
    grunt(ctx, dest, at + 0.1, 0.08, 390 * b.pitch, k * 0.9);
    jingle(ctx, dest, at + 0.16, 3, 1.1, k);
  } else if (b.s === 1) {
    grunt(ctx, dest, at, 0.16, 300 * b.pitch, k);
    jingle(ctx, dest, at + 0.14, 4, 1, k);
  } else {
    grunt(ctx, dest, at, 0.3 * b.slow * 0.6, 290 * b.pitch, k * 1.1);
    bell(ctx, dest, at + 0.08, 660, 0.7, k * 0.8);
  }
}

/** A strike: a grunt as it winds up, the punch landing as a crunch with a shake of bells, and its call after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.8, 1.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const h = GINGER_HITS[s] * T;
  grunt(ctx, out, at + 0.02, Math.max(0.05, h - 0.08), 260 * b.pitch, 0.6);
  crunch(ctx, out, at + h, 150 - 30 * s, 1.3);
  jingle(ctx, out, at + h + 0.02, 3 + s, [1.1, 1, 0.9][s], 0.9);
  call(ctx, out, at + h + 0.12, s, v, 0.55);
};

/**
 * Its Taunt: a thump on its chest at each beat, the second ringing a bell -- each stage's lower than the last -- with a shake of
 * sleigh bells, and its call loud over it.
 */
const taunt = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, T: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 2.1, 2.1][s]), key = [1.2, 1, 0.8][s];
  GINGER_THUMPS.forEach((th, q) => {
    crunch(ctx, out, at + th * T, 120 - 25 * s, 1.1);
    if (q === GINGER_THUMPS.length - 1) {
      bell(ctx, out, at + th * T + 0.01, 880 * key, 1.1, 1.3);
      bell(ctx, out, at + th * T + 0.01, 1320 * key, 0.8, 0.6);
    }
    jingle(ctx, out, at + th * T + 0.03, 4 + 2 * s, key, 1.2);
  });
  call(ctx, out, at + 0.04, s, v, 0.9);
};

const cast = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => taunt(ctx, dest, at, stage, v, ACT_SECS.cast);
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => taunt(ctx, dest, at, stage, v, ACT_SECS.work);

/**
 * Evolving, a cue the length of the act: a rising shimmer of sleigh bells to the flash at its middle, where a chord of hand bells
 * rings over a deep swell -- each stage's lower than the last -- a crunch as it settles, and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 10; q++) jingle(ctx, dest, at + 0.1 + (q * (flash - 0.15)) / 10, 1, key * (0.8 + 0.04 * q), 0.4 + 0.08 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 3200 * key, q: 2.5, gain: 0.04, attack: (flash - 0.1) * 0.85 });
  for (const f of [523, 659, 784]) bell(ctx, dest, at + flash + 0.01, f * key, 1.0, 0.8);
  ring(ctx, dest, at + flash, { freq: 92 - 15 * s, to: 50 - 8 * s, dur: 0.45, gain: 0.2, type: 'sine', attack: 0.015 });
  crunch(ctx, dest, at + flash + 0.22, 130 - 20 * s, 1.1);
  call(ctx, dest, at + flash + 0.4, s, v, 0.8);
};

export const GINGER_VOICE: Voice = { strike, work, cast, evolve };
