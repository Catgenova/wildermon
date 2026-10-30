import { ACT_SECS } from '../render/beasts';
import { TIMBER_HITS, TIMBER_WORK } from '../render/wild-timber';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Logkit's voice, and its stages' (the species is `rippa`): chitters,
 * squeaks and a woody chuff, the Timberback's deeper and gruffer; at its
 * work, the rasp of teeth or a saw in wood and the clack of a slab landing on
 * the planks.
 *
 * A chitter is a quick run of short high ticks of noise, a squirrel's
 * scolding; a squeak a sine swooping up; a chuff a short low puff of noise
 * through a hollow, a knock of wood under it. The bigger the body, the lower
 * all of it, the Timberback's chuff a grunt round 90 Hz. A rasp is a band of
 * noise swept up and down, quick, a stroke at a time; a saw is that, faster
 * and brighter, with the whine of the blade under it, a saw-tooth that rises
 * as it bites; a clack two hollow knocks of wood close together.
 *
 * Every cue lands where its picture does (`./wild-timber`): the bite or the
 * blade on `TIMBER_HITS`; the Logkit's bites, the blade into the log and
 * through it, and the slab landing, on `TIMBER_WORK`; and the evolving chime
 * on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.46][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chitter: `n` short high ticks, quick. */
function chitter(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, f: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.045, { dur: 0.022, freq: f * (1 + 0.08 * (q % 2)), q: 5, gain: 0.14 * k, attack: 0.002 });
}

/** A squeak: a sine swooping up. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.6, dur: 0.09, gain: 0.1 * k, type: 'sine', attack: 0.008 });
}

/** A chuff: a short low puff of breath and a hollow knock of wood under it. */
function chuff(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.12, freq: f * 4, to: f * 2, q: 1.1, gain: 0.12 * k, attack: 0.01 });
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur: 0.12, gain: 0.16 * k, type: 'triangle', attack: 0.006, partials: [[1, 0.7], [2.7, 0.3]] });
}

/** Its own call, by stage: the Logkit's chitter and a squeak; the Sawquill's chitter and a chuff; the Timberback's two deep chuffs. */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    chitter(ctx, dest, at, 4, 3600 * b.pitch, k);
    squeak(ctx, dest, at + 0.2, 1700 * b.pitch, k);
    return;
  }
  if (b.s === 1) {
    chitter(ctx, dest, at, 3, 3600 * b.pitch, k);
    chuff(ctx, dest, at + 0.16, 200 * b.pitch, k);
    return;
  }
  chuff(ctx, dest, at, 200 * b.pitch, 1.3 * k);
  chuff(ctx, dest, at + 0.2, 180 * b.pitch, 1.1 * k);
}

/** A rasp: teeth or a blade drawn through wood, a band of noise swept up and back, `n` strokes over `dur`. */
function rasp(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, f: number, k: number): void {
  const each = dur / n;
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * each, { dur: each * 0.9, freq: f, to: f * (q % 2 ? 0.7 : 1.4), q: 2.2, gain: 0.1 * k, attack: each * 0.25 });
}

/** The blade: its whine rising as it bites, under the rasp of its teeth in the wood. */
function saw(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 260 * pitch, to: 420 * pitch, dur, gain: 0.035 * k, type: 'sawtooth', attack: 0.04 });
  rasp(ctx, dest, at, dur, Math.max(4, Math.round(dur * 22)), 2600 * pitch + 900, 1.2 * k);
}

/** A clack: two hollow knocks of wood close together, a plank landing on planks. */
function clack(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  for (const [d, f] of [[0, 760], [0.05, 600]] as const) {
    ring(ctx, dest, at + d, { freq: f - 220 * heavy, dur: 0.07 + 0.04 * heavy, gain: 0.2 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.6], [2.4, 0.3], [4.1, 0.1]] });
    burst(ctx, dest, at + d, { dur: 0.03, freq: 1500 - 400 * heavy, q: 1.6, gain: 0.12 * k, attack: 0.001 });
  }
}

/**
 * A strike. The Logkit's: a chitter as it crouches, a snap of teeth, a soft thump as it lands and a squeak as it bites. The others': a chuff as the blade
 * goes up, its whine as it comes down, and the bite of its teeth -- a rasp and a woody knock.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + TIMBER_HITS[s] * T;
  if (s === 0) {
    chitter(ctx, out, at + 0.04, 3, 3800 * b.pitch, 0.8);
    burst(ctx, out, hit, { dur: 0.03, freq: 2400, q: 2, gain: 0.2, attack: 0.001 });
    ring(ctx, out, hit, { freq: 190, to: 95, dur: 0.08, gain: 0.25, type: 'sine', attack: 0.003 });
    squeak(ctx, out, hit + 0.05, 1700 * b.pitch, 0.7);
    return;
  }
  chuff(ctx, out, at + 0.05, 200 * b.pitch, 0.8);
  ring(ctx, out, hit - 0.12, { freq: 300 * b.pitch, to: 520 * b.pitch, dur: 0.14, gain: 0.05, type: 'sawtooth', attack: 0.03 });
  rasp(ctx, out, hit, 0.1, 3, 2400 * b.pitch + 800, 1.4);
  ring(ctx, out, hit, { freq: 170 - 60 * b.heavy, to: 80, dur: 0.1 + 0.06 * b.heavy, gain: 0.26, type: 'sine', attack: 0.003 });
};

/**
 * A go at its task. The Logkit's: a rasp of teeth at each of its four bites, and the clack of the slab landing. The others': the
 * blade's whine and the rasp of the saw from when it goes into the log to when it is through, and the clack of the slab landing;
 * now and then a chuff.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.6, 2.6, 1.8][s]), b = bodyOf(stage, v), W = TIMBER_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const c of W.bites) rasp(ctx, out, at + (c - 0.03) * T, 0.06, 2, 3200 * b.pitch, 0.9);
  } else saw(ctx, out, at + W.into * T, (W.through - W.into) * T, b.pitch, 1);
  clack(ctx, out, at + W.land * T, b.heavy, 1);
  if (v > 0.5) call(ctx, out, at + 0.86 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a run of chitters quickening and a rasp rising as the chips swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.1 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    burst(ctx, dest, when, { dur: 0.022, freq: (3000 + 1800 * u) * key, q: 5, gain: 0.08 + 0.06 * u, attack: 0.002 });
  }
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 3400 * key, q: 2.2, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const TIMBER_VOICE: Voice = { strike, work, evolve };
