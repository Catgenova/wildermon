import { ACT_SECS } from '../render/beasts';
import { SLAG_STRIKE, SLAG_WORK } from '../render/wild-slag';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Slaglet's voice, and its stages' (the species is `scorcha`): a crucible
 * crab's bubbling crackle of molten metal, the hiss of steam out of its
 * chimneys, and the clank of copper and stone -- a Slaglet's a quick bright
 * blip-and-pop, an Alloyster's a fuller gurgle under a furnace's roar, a
 * Moltenex's a slow deep bubbling under a heavy clank.
 *
 * Molten metal bubbling is a run of low sine blips sliding up, each ending in
 * a small pop; crackle is a scatter of short bright clicks; steam is noise
 * high and narrowing, kept soft; copper is a struck bar's three partials. A
 * bigger stage is lower, slower and heavier in all of it.
 *
 * Every cue lands where its picture does (`../render/wild-slag`): the strike
 * on `SLAG_STRIKE.hit`; a go at its task scraping lumps up on `SLAG_WORK.dig`
 * to `.scoop`, tossing them on `.toss`, and the clank, flare and puff of
 * steam as they land on `.land`; and the evolving chime on the flash at the
 * middle of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.5][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A bubble of molten metal: a low sine sliding up, then a soft pop. */
function bubble(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.6, dur, gain: 0.26 * k, type: 'sine', attack: 0.008 });
  burst(ctx, dest, at + dur * 0.85, { dur: 0.025, freq: f * 5, q: 2.5, gain: 0.05 * k, attack: 0.002 });
}

/** A crackle: a few short bright clicks scattered over `span` seconds. */
function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number, span: number, n: number, pitch: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const when = at + span * ((q + 0.5 * ((q * 7919) % 5) / 5) / n);
    burst(ctx, dest, when, { dur: 0.012, freq: (2600 + 700 * (q % 3)) * pitch, q: 4, gain: 0.05 * k, attack: 0.001 });
  }
}

/** Steam out of its chimneys: noise high and narrowing as it fades, longer for a bigger stage. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  burst(ctx, dest, at, { dur: [0.3, 0.45, 0.65][s], freq: 5200, to: 3200, q: 1.6, type: 'bandpass', gain: 0.06 * k, attack: 0.04 });
}

/** Copper and stone knocked together: a struck bar, lower for a bigger stage, over a dull knock. */
function clank(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage)), f = [880, 560, 360][s];
  ring(ctx, dest, at, { freq: f, to: f * 0.97, dur: 0.25 + 0.15 * s, gain: 0.12 * k, type: 'sine', attack: 0.002, partials: [[1, 0.5], [2.76, 0.32], [5.4, 0.18]] });
  burst(ctx, dest, at, { dur: 0.05 + 0.03 * s, freq: 700 - 150 * s, q: 1.2, gain: 0.1 * k, attack: 0.002 });
}

/** Something heavy coming down on the ground: a low muffled thump, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [180, 115, 78][s], to: [90, 58, 38][s], dur: [0.1, 0.18, 0.32][s], gain: [0.3, 0.42, 0.55][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.08 * s, freq: 600, to: 160, q: 0.8, gain: (0.14 + 0.06 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * Its own call, by stage. The Slaglet's: three quick rising bubbles and a little crackle, round 520 Hz. The Alloyster's: two
 * fuller bubbles over a furnace's low roar and a clank. The Moltenex's: a deep slow bubbling round 150 Hz with a heavy clank and
 * a long hiss of steam.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    bubble(ctx, dest, at, 500 * b.pitch, 0.06, k);
    bubble(ctx, dest, at + 0.09, 560 * b.pitch, 0.06, k);
    bubble(ctx, dest, at + 0.18, 640 * b.pitch, 0.08, k);
    crackle(ctx, dest, at + 0.05, 0.25, 4, 1, 0.8 * k);
    return;
  }
  if (b.s === 1) {
    burst(ctx, dest, at, { dur: 0.5, freq: 220, to: 160, q: 1.2, type: 'bandpass', gain: 0.08 * k, attack: 0.08 });
    bubble(ctx, dest, at + 0.05, 420 * b.pitch, 0.1, 1.1 * k);
    bubble(ctx, dest, at + 0.2, 360 * b.pitch, 0.12, 1.1 * k);
    clank(ctx, dest, at + 0.34, 1, 0.5 * k);
    return;
  }
  for (let q = 0; q < 4; q++) bubble(ctx, dest, at + q * 0.16, (300 - 20 * q) * b.pitch, 0.16, 1.1 * k);
  burst(ctx, dest, at, { dur: 0.8, freq: 160, to: 110, q: 1, type: 'bandpass', gain: 0.1 * k, attack: 0.12 });
  clank(ctx, dest, at + 0.5, 2, 0.6 * k);
  hiss(ctx, dest, at + 0.55, 2, 0.8 * k);
}

/** A strike: a bubbling breath as it gathers, then its claw brought down with a thump, a clank of copper, a crackle of sparks. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.15, 0.95][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + SLAG_STRIKE.hit * T;
  call(ctx, out, at + 0.02, s, v, 0.4);
  burst(ctx, out, hit - 0.1, { dur: 0.1, freq: 500 * b.pitch, to: 1400 * b.pitch, q: 0.9, gain: 0.07, attack: 0.08 });
  thump(ctx, out, hit, s, 1);
  clank(ctx, out, hit + 0.02, s, 0.7);
  crackle(ctx, out, hit + 0.03, 0.2, 5, b.pitch + 0.3, 0.9);
};

/**
 * A go at its task: claws scraping lumps up off the ground, a clank as they are tossed, and as they land in its metal a deep
 * splash of bubbles, a crackle of sparks and a hiss of steam; now and then its call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), T = ACT_SECS.work;
  const p = 1 / (0.7 + 0.6 * b.heavy);
  burst(ctx, out, at + SLAG_WORK.dig * T, { dur: (SLAG_WORK.scoop - SLAG_WORK.dig) * T, freq: 1400 * p, to: 700 * p, q: 1.2, gain: 0.08, attack: 0.02 });
  clank(ctx, out, at + SLAG_WORK.toss * T, s, 0.45);
  const land = at + SLAG_WORK.land * T;
  for (let q = 0; q < 3; q++) bubble(ctx, out, land + q * 0.05, (260 + 60 * q) * p, 0.07, 0.9);
  crackle(ctx, out, land + 0.02, 0.25, 6, p + 0.2, 1);
  hiss(ctx, out, land + 0.08, s, 1);
  if (v > 0.5) call(ctx, out, at + (SLAG_WORK.land + 0.1) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: bubbling quicker and brighter to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- with a burst of steam, and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 2400 * key, q: 1.1, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 7; q++) {
    const u = q / 7, when = at + 0.15 + (flash - 0.25) * (1 - (1 - u) ** 1.6);
    bubble(ctx, dest, when, (300 + 260 * u) * key, 0.06, 0.4 + 0.5 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1318 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [349, 440, 523]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  hiss(ctx, dest, at + flash + 0.05, 2, 0.9);
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const SLAG_VOICE: Voice = { strike, work, evolve };
