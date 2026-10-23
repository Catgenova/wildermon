import { ACT_SECS } from '../render/beasts';
import { HAM_HITS, HAM_WORK } from '../render/wild-hamster';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Wheatley's voice, and its stages' (the species is `grista`): a
 * hamster's squeak and chatter -- quick bright squeaks for the little one, a
 * lower chattering squeak with a huff under it for the Wheatwhirl, and for
 * the Wheatcheeks a deep chuffing grumble round 150 Hz with a short squeak
 * over its end -- over the grind of its millstones: a low rumble of stone on
 * stone with grit crackling in it, the crunch of grain going in, and the
 * thud of a stone landing a blow.
 *
 * Every cue lands where its picture does (`./wild-hamster`): the strike on
 * `HAM_HITS`, the grain and each chew of a go at its task on `HAM_WORK`, and
 * the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how far down its stones rumble, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; stone: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.94 + 0.12 * v), stone: [1.3, 1, 0.72][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** One squeak: a pure tone sliding up and back down, quick. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f * 0.85, at);
  osc.frequency.exponentialRampToValueAtTime(f * 1.2, at + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(f * 0.92, at + dur);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.18 * k, at + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** A huff: a short breath of low noise, the bigger body's grumble under its squeak. */
function huff(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f * 3, to: f * 1.6, q: 1.2, gain: 0.16 * k, attack: dur * 0.2 });
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur, gain: 0.12 * k, type: 'sawtooth', attack: dur * 0.15, partials: [[1, 0.5], [2, 0.3], [3, 0.15]] });
}

/**
 * Its own call, by stage. The Wheatley: three quick bright squeaks, the last higher. The Wheatwhirl: a huff and a chatter of four
 * lower squeaks over it. The Wheatcheeks: a deep chuffing grumble in three breaths round 150 Hz, and one short squeak over its end.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    for (let q = 0; q < 3; q++) squeak(ctx, dest, at + q * 0.07, 2600 * b.pitch * (q === 2 ? 1.15 : 1), q === 2 ? 0.1 : 0.05, k);
    return;
  }
  if (b.s === 1) {
    huff(ctx, dest, at, 260 * b.pitch / 0.72, 0.18, k);
    for (let q = 0; q < 4; q++) squeak(ctx, dest, at + 0.05 + q * 0.06, 1700 * b.pitch / 0.72 * (1.05 - 0.04 * q), 0.05, k * 0.85);
    return;
  }
  const f = 150 * (0.94 + 0.12 * v);
  for (let q = 0; q < 3; q++) huff(ctx, dest, at + q * 0.13, f * (1 - 0.06 * q), 0.14, k * 1.3);
  squeak(ctx, dest, at + 0.42, 1100, 0.09, k * 0.7);
}

/** The stones turning: a low rumble of stone on stone, `dur` long, with grit crackling in it. */
function grind(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 180 * pitch, to: 150 * pitch, q: 1.4, gain: 0.22 * k, type: 'bandpass', attack: dur * 0.25 });
  burst(ctx, dest, at, { dur, freq: 900 * pitch, q: 0.8, gain: 0.05 * k, attack: dur * 0.3 });
  for (let q = 0; q < 6; q++) burst(ctx, dest, at + (dur * (q + 0.3 * Math.sin(q * 4.1))) / 6, { dur: 0.015, freq: 2600 * pitch, q: 3, gain: 0.06 * k, attack: 0.001 });
}

/** Grain crunched: a short dry crackle. */
function crunch(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + q * 0.018, { dur: 0.025, freq: (3000 - 500 * q) * pitch, q: 2, gain: 0.1 * k, attack: 0.001 });
}

/** A stone landing a blow: a heavy knock and a short low ring. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.08, freq: 600 * pitch, to: 200 * pitch, q: 0.8, gain: 0.32 * k, type: 'lowpass', attack: 0.001 });
  ring(ctx, dest, at, { freq: 140 * pitch, to: 90 * pitch, dur: 0.18, gain: 0.26 * k, type: 'sine', attack: 0.002 });
  ring(ctx, dest, at, { freq: 760 * pitch, dur: 0.12, gain: 0.05 * k, type: 'sine', attack: 0.001, partials: [[1, 0.6], [2.3, 0.3], [4.1, 0.1]] });
}

/** A swing through the air: a band of noise rising to the blow, lower and longer for a bigger body. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, s: number, len: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: [700, 520, 380][s], to: [1800, 1400, 1000][s], q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/** A strike: its call as it winds, a whoosh as its cheek swings round, the thud of the stone landing and a grind as it spins. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.05, 0.85][s]), b = bodyOf(stage, v);
  const hit = at + HAM_HITS[s] * ACT_SECS.strike;
  call(ctx, out, at + 0.01, s, v, s === 0 ? 0.7 : 0.8);
  whoosh(ctx, out, hit - 0.12 - 0.02 * s, s, 0.12 + 0.02 * s, 1);
  thud(ctx, out, hit, b.stone, 1 + 0.15 * s);
  grind(ctx, out, hit + 0.02, 0.18, b.stone, 0.8);
};

/**
 * A go at its task: the crunch of grain going in at each feed, a chew at each chew, and the stones grinding the whole way
 * through; a small contented squeak after the second feed.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.4, 1.3][s]), b = bodyOf(stage, v), W = HAM_WORK, T = ACT_SECS.work;
  grind(ctx, out, at, T, b.stone, 1);
  for (const f of W.feeds) crunch(ctx, out, at + f * T, b.stone, 1);
  for (const c of W.chews) burst(ctx, out, at + c * T, { dur: 0.05, freq: 1400 * b.stone, to: 700 * b.stone, q: 1.2, gain: 0.07, attack: 0.004 });
  call(ctx, out, at + (W.feeds[1] + 0.12) * T, s, v, 0.35);
};

/**
 * Evolving, a cue the length of the act: grain pattering round it, quickening and rising to the flash at its middle, where a
 * chime rings -- each stage's lower than the last -- and the stones rumble, then its own call, the squeak or the grumble of what
 * it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, stage <= 0 ? 1.5 : 1.8);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 500 * key, to: 1600 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    crunch(ctx, dest, when, b.stone * (0.9 + 0.3 * u), 0.3 + 0.4 * u);
  }
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + flash + q * 0.06, { freq: f * key, dur: 0.9, gain: 0.07, type: 'sine', attack: 0.01, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  grind(ctx, dest, at + flash, 0.5, b.stone, 0.8);
  call(ctx, dest, at + flash + 0.3, s, v, 0.7);
};

export const HAMSTER_VOICE: Voice = { strike, work, evolve };
