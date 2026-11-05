import { ACT_SECS } from '../render/beasts';
import { GOLEM_HITS, GOLEM_TAPS } from '../render/wild-golem';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Chipkin's voice, and its stages' (the species is `chissa`): stone on stone. Its call is a grinding rumble, a low band of
 * noise with a hum under it -- the Chipkin's quick and gravelly, the Brickorn's deeper, the Fortigran's a long slow grind like a
 * millstone. A knock of stone is a short hard click with a thud under it; chips are a scatter of tiny clicks after it.
 *
 * Every cue lands where its picture does (`../render/wild-golem`): the blow on `GOLEM_HITS`, each tap of its knuckles on the
 * block on `GOLEM_TAPS`, the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.74, 0.55][s] * (0.95 + 0.1 * v), slow: [1, 1.3, 1.7][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A knock of stone on stone: a hard click and a thud under it. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.025, freq: 2600, q: 3, gain: 0.07 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: f, to: f * 0.6, dur: 0.09, gain: 0.12 * k, type: 'sine', attack: 0.002 });
}

/** Chips falling: a few tiny clicks after a knock, scattered. */
function chips(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number, seed: number): void {
  for (let q = 0; q < 5; q++) {
    const off = 0.03 + 0.05 * q + 0.02 * Math.sin(seed * 7 + q * 3.1);
    burst(ctx, dest, at + off, { dur: 0.012, freq: 4200 + 600 * Math.sin(q + seed), q: 6, gain: 0.025 * k, attack: 0.001 });
  }
}

/** A grind: a low band of noise, rough, with a hum under it. */
function grind(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 380 * pitch, to: 300 * pitch, q: 1.4, gain: 0.07 * k, attack: dur * 0.3 });
  ring(ctx, dest, at, { freq: 70 * pitch * 2, to: 60 * pitch * 2, dur, gain: 0.06 * k, type: 'triangle', attack: dur * 0.25 });
}

/**
 * Its own call, by stage. The Chipkin's: two short gravelly grunts. The Brickorn's: one deeper grind and a knock. The
 * Fortigran's: a long slow grind that falls, like a millstone.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    grind(ctx, dest, at, 0.08, 1.6 * b.pitch, k);
    grind(ctx, dest, at + 0.12, 0.07, 1.8 * b.pitch, k * 0.8);
  } else if (b.s === 1) {
    grind(ctx, dest, at, 0.22, b.pitch, k);
    knock(ctx, dest, at + 0.22, 160, k * 0.6);
  } else {
    grind(ctx, dest, at, 0.45 * b.slow * 0.6, b.pitch, k * 1.1);
  }
}

/** A strike: a grind as it winds up, the blow landing as a heavy knock with chips flying, and its call after. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.8, 1.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const h = GOLEM_HITS[s] * T;
  grind(ctx, out, at + 0.02, Math.max(0.05, h - 0.06), b.pitch * 1.2, 0.6);
  knock(ctx, out, at + h, 140 - 30 * s, 1.3);
  chips(ctx, out, at + h, 1, s);
  call(ctx, out, at + h + 0.08, s, v, 0.6);
};

/** A go at its task: a knock of its knuckles on the block at each tap, and chips falling after each. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.6, 2.4, 2.3][s]), T = ACT_SECS.work;
  GOLEM_TAPS.forEach((tap, q) => {
    knock(ctx, out, at + tap * T, 210 - 35 * s, 1);
    chips(ctx, out, at + tap * T, 0.9, q + s);
  });
  if (v > 0.7) call(ctx, out, at + 0.95 * T, s, v, 0.4);
};

/**
 * Evolving, a cue the length of the act: stone grinding as it gathers, a rising sweep to the flash at its middle, where a clear
 * chime rings over a deep swell -- each stage's lower than the last -- a heavy knock as it settles, and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve, b = bodyOf(stage, v);
  grind(ctx, dest, at + 0.1, flash - 0.1, b.pitch, 1.2);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 3200 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 88 - 15 * s, to: 48 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  knock(ctx, dest, at + flash + 0.22, 120 - 20 * s, 1.2);
  chips(ctx, dest, at + flash + 0.22, 1, 3);
  call(ctx, dest, at + flash + 0.4, s, v, 0.8);
};

export const GOLEM_VOICE: Voice = { strike, work, evolve };
