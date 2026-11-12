import { ACT_SECS } from '../render/beat-times';
import { EMBER_DRAG, EMBER_HITS, EMBER_WORK } from '../render/wild-ember';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Emberkit's voice, and its stages' (the species is `cindra`): the kit's high fox yip; the Emberbrush's and the
 * Ashsweeper's a hawk's cry, each lower and longer than the last, with a rustle of plumes. At its work, each stroke is a
 * scrape of claws or tines through ash as it drags, a soft whoosh of ash thrown up, and the crackle of embers kicked loose
 * as it digs in.
 *
 * A yip is a short tone bent up and down with a breath of noise; a cry a tone that falls from high with a rasp of noise
 * over it; a scrape a band of noise sliding down; a crackle a few very short ticks of noise, scattered; a whoosh a soft wide
 * band of low noise. The bigger the body, the lower and the longer.
 *
 * Every cue lands where its picture does (`../render/wild-ember`): the swipe or the slam on `EMBER_HITS`; each stroke's dig
 * and drag on `EMBER_WORK` and `EMBER_DRAG`; the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how slow, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.6][s] * (0.95 + 0.1 * v), slow: [1, 1.25, 1.5][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** Embers crackling: `n` very short ticks of bright noise, scattered over `dur`. */
function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, dur: number, k: number, seed: number): void {
  for (let q = 0; q < n; q++) {
    const r = Math.abs(Math.sin((q + 1) * 12.9898 + seed * 78.233)) % 1;
    burst(ctx, dest, at + r * dur, { dur: 0.008, freq: 3500 + 2500 * r, q: 2, gain: 0.06 * k * (0.6 + 0.4 * r), attack: 0.001 });
  }
}

/** Claws or tines dragged through ash: a band of noise sliding down over the drag. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.55, q: 3, gain: 0.07 * k, attack: dur * 0.2 });
}

/** Ash thrown up: a soft wide band of low noise. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 700, to: 400, q: 0.7, gain: 0.05 * k, attack: dur * 0.35 });
}

/**
 * Its own call, by stage. The Emberkit's: a high yip, bent up and back, twice. The Emberbrush's: a hawk's cry falling from
 * 2.2 kHz with a rasp over it. The Ashsweeper's: the same cry lower and longer, a rustle of its plumes after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    for (const d of [0, 0.13]) {
      ring(ctx, dest, at + d, { freq: 1300 * b.pitch, to: 1700 * b.pitch, dur: 0.07, gain: 0.07 * k, type: 'triangle', attack: 0.004 });
      ring(ctx, dest, at + d + 0.06, { freq: 1700 * b.pitch, to: 1100 * b.pitch, dur: 0.05, gain: 0.05 * k, type: 'triangle', attack: 0.002 });
      burst(ctx, dest, at + d, { dur: 0.08, freq: 3000, q: 1.5, gain: 0.015 * k, attack: 0.01 });
    }
    return;
  }
  const dur = 0.32 * b.slow;
  ring(ctx, dest, at, { freq: 2200 * b.pitch, to: 1300 * b.pitch, dur, gain: 0.07 * k, type: 'sawtooth', attack: 0.02, partials: [[1, 0.6], [2, 0.25], [3, 0.15]] });
  burst(ctx, dest, at, { dur, freq: 2600 * b.pitch, to: 1600 * b.pitch, q: 4, gain: 0.03 * k, attack: 0.02 });
  burst(ctx, dest, at + dur * 0.8, { dur: 0.18 * b.slow, freq: 2500, to: 1800, q: 1, gain: 0.03 * k, attack: 0.05 });
}

/** A strike: a hiss as it gathers, and the kit's claws or the bigger two's rake through the air and down, embers crackling off it. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 1.9, 1.8][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + EMBER_HITS[s] * T;
  burst(ctx, out, at + 0.06, { dur: 0.14, freq: 4200 * b.pitch, q: 0.8, gain: 0.04, attack: 0.04 });
  burst(ctx, out, hit - 0.06, { dur: 0.07, freq: 2400 * b.pitch, to: 900 * b.pitch, q: 2, gain: 0.07, attack: 0.03 });
  ring(ctx, out, hit, { freq: 160 - 35 * s, to: 70, dur: 0.1 + 0.05 * s, gain: 0.16, type: 'sine', attack: 0.002 });
  crackle(ctx, out, hit, 5 + 2 * s, 0.25, 1, s);
  if (s === 2) whoosh(ctx, out, hit, 0.3, 1.2);
};

/**
 * A go at its task. Each stroke: a crackle of embers as it digs in, the scrape of the drag back through the ash, and a soft
 * whoosh of ash thrown up behind it; the bigger two's scrapes lower and fuller, the Ashsweeper's tines a thud as they bite.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.4, 2.6, 2.4][s]), b = bodyOf(stage, v), T = ACT_SECS.work;
  for (const [q, c] of EMBER_WORK.strokes[s].entries()) {
    const dig = at + (c - 0.02) * T, drag = EMBER_DRAG * T;
    crackle(ctx, out, dig, 3 + s, 0.12, 0.9, q + s * 3);
    if (s === 2) ring(ctx, out, dig, { freq: 110, to: 70, dur: 0.08, gain: 0.08, type: 'sine', attack: 0.003 });
    scrape(ctx, out, at + c * T, drag, 2600 * b.pitch, 1 + 0.2 * s);
    whoosh(ctx, out, at + c * T + drag * 0.4, drag * 1.4, 0.8 + 0.2 * s);
  }
  if (v > 0.6) call(ctx, out, at + 0.94 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: embers crackling in, a rising sweep to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its own call, the cry of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  crackle(ctx, dest, at + 0.1, 14, flash - 0.2, 0.8, 9);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 4000 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const EMBER_VOICE: Voice = { strike, work, evolve };
