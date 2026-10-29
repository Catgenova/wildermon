import { ACT_SECS } from '../render/beasts';
import { NAIL_HITS, NAIL_WORK } from '../render/wild-nail';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Nailsprout's voice, and its stages' (the species is `dowse`): a young
 * mole's quick high chitter, a grown one's snuffle and chirp, and the
 * Nailwright's deep contented grunt; over the smithing they do -- the clink of
 * a hammer on a nail on an anvil, the crackle of sparks, a nail dropped among
 * nails.
 *
 * A chitter is a run of short squeaks, so short sines leaping up; a snuffle
 * is breath through a small nose, a few quick bursts of narrow noise high up;
 * a grunt is a buzz in the chest, a sawtooth's harmonics low under a band of
 * breath, the Nailwright's between 90 and 180 Hz where a small speaker still
 * plays it. A hammer on iron is a struck bar, its partials not in a scale
 * (`ring`'s 2.76 and 5.4), higher and shorter the smaller the hammer, with a
 * thud of the anvil under the Nailwright's sledge; sparks are a scatter of
 * very short ticks of high noise.
 *
 * Every cue lands where its picture does (`./wild-nail`): the strike on
 * `NAIL_HITS`; each tap and blow, the Nailwright's flip and the nail landing
 * in its crate, on `NAIL_WORK`; and the evolving chime on the flash at the
 * middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.45][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A struck bar of metal: three partials that do not belong to a scale. */
const METAL = [[1, 0.5], [2.76, 0.32], [5.4, 0.18]] as const;

/** A snuffle: a few quick sniffs through a small nose, narrow noise high up, each a little lower. */
function snuffle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, pitch: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.07, { dur: 0.045, freq: 3400 * pitch * (1 - 0.06 * q), q: 3, gain: 0.07 * k, attack: 0.008 });
}

/** A grunt: a buzz low in the chest sagging at its end, a band of breath over it. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.85, dur, gain: 0.12 * k, type: 'sawtooth', attack: 0.03, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  burst(ctx, dest, at, { dur, freq: f * 4, to: f * 3, q: 3, gain: 0.07 * k, attack: 0.03 });
}

/**
 * Its own call, by stage. The Nailsprout's: a quick chitter of four squeaks round 2400 Hz and a sniff. The Hammertin's: a
 * snuffle and a chirp round 1300 Hz, falling. The Nailwright's: a snuffle and a long deep grunt round 130 Hz, and a shorter one.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 2400 * b.pitch;
    for (let q = 0; q < 4; q++) ring(ctx, dest, at + q * 0.06, { freq: f * (0.9 + 0.05 * (q % 2)), to: f * 1.25, dur: 0.04, gain: 0.12 * k, type: 'sine', attack: 0.005 });
    snuffle(ctx, dest, at + 0.28, 2, 1, 0.8 * k);
    return;
  }
  if (b.s === 1) {
    snuffle(ctx, dest, at, 3, 0.9, k);
    ring(ctx, dest, at + 0.24, { freq: 1900 * b.pitch, to: 1300 * b.pitch, dur: 0.12, gain: 0.11 * k, type: 'triangle', attack: 0.01 });
    return;
  }
  snuffle(ctx, dest, at, 3, 0.75, k);
  grunt(ctx, dest, at + 0.22, 290 * b.pitch, 0.42, 1.1 * k);
  grunt(ctx, dest, at + 0.7, 320 * b.pitch, 0.16, 0.8 * k);
}

/** A hammer on a nail on an anvil: a click and a ringing bar, higher and shorter for a smaller hammer, a thud under a heavy one. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.02, freq: 4800 - 1200 * heavy, q: 0.9, gain: 0.22 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 1500 - 900 * heavy, dur: 0.18 + 0.5 * heavy, gain: 0.22 * k, type: 'sine', partials: METAL });
  if (heavy > 0.8) ring(ctx, dest, at, { freq: 110, to: 60, dur: 0.22, gain: 0.3 * k, type: 'sine', attack: 0.002 });
}

/** Sparks off a blow: a scatter of very short ticks of high noise, `n` of them, over a third of a second. */
function sparks(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const when = at + 0.02 + 0.32 * ((q * 0.618) % 1) ** 1.4;
    burst(ctx, dest, when, { dur: 0.012, freq: 6500 + 1800 * ((q * 0.37) % 1), q: 1.5, gain: 0.05 * k, attack: 0.001 });
  }
}

/** Something swung through the air: a band of noise sweeping down, longer and lower for a bigger thing. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2400 * pitch, to: 700 * pitch, q: 1.4, gain: 0.13 * k, attack: dur * 0.6 });
}

/** A blow on the ground: a thump, and a crack of stone over it. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  ring(ctx, dest, at, { freq: 150 - 60 * heavy, to: 60, dur: 0.12 + 0.2 * heavy, gain: 0.4 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.12 * heavy, freq: 1400 - 600 * heavy, to: 300, q: 0.8, gain: 0.25 * k, attack: 0.002 });
}

/**
 * A strike. The Nailsprout chitters as it hops in and bonks the ground with its little hammer, a light knock and a clink. The
 * Hammertin swings its hammer down through the air into a thump, sparks off it. The Nailwright grunts as it heaves its sledge
 * up, and slams it down with a deep thump, a crack of stone and a crackle of sparks.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.7, 1.2][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + NAIL_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + 0.02, 0, v, 0.5);
    thump(ctx, out, hit, 0.1, 0.6);
    clink(ctx, out, hit + 0.005, 0, 0.4);
    sparks(ctx, out, hit, 3, 0.6);
    return;
  }
  swish(ctx, out, hit - 0.18, 0.18, b.pitch * 1.4, 1);
  if (s === 2) grunt(ctx, out, at + 0.04, 300 * b.pitch, 0.22, 0.9);
  thump(ctx, out, hit, b.heavy, 1);
  sparks(ctx, out, hit, [0, 5, 9][s], 1);
};

/**
 * A go at its task. The Nailsprout's: four quick light clinks of its little hammer on the nail, a few sparks, and a chitter.
 * The Hammertin's: two ringing blows, each swung down from over its head with sparks after. The Nailwright's: the sledge
 * swished down twice, one heavy clang after the other with a thud of the anvil and a crackle of sparks; then the finished nail
 * flicked into the air, and dropped among the nails in its crate with a rattle; and a grunt.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.7, 1.6, 1.4][s]), b = bodyOf(stage, v), W = NAIL_WORK, T = ACT_SECS.work;
  if (s === 0) {
    W.taps.forEach((h, q) => {
      clink(ctx, out, at + h * T, 0, 0.55 + 0.1 * (q % 2));
      sparks(ctx, out, at + h * T, 2, 0.5);
    });
    if (v > 0.5) call(ctx, out, at + 0.95 * T, 0, v, 0.3);
    return;
  }
  if (s === 1) {
    for (const h of W.blows) {
      swish(ctx, out, at + h * T - 0.12, 0.12, 1.1, 0.5);
      clink(ctx, out, at + h * T, 0.45, 1);
      sparks(ctx, out, at + h * T, 6, 0.9);
    }
    if (v > 0.5) call(ctx, out, at + 0.9 * T, 1, v, 0.3);
    return;
  }
  W.sledge.forEach((h, q) => {
    swish(ctx, out, at + h * T - 0.16, 0.16, 0.8, 0.8);
    clink(ctx, out, at + h * T, 1, q ? 1.1 : 0.9);
    sparks(ctx, out, at + h * T, q ? 12 : 8, 1);
  });
  swish(ctx, out, at + W.flip[0] * T, 0.12, 1.6, 0.4);
  // The nail landing among the nails in the crate: a few light clinks tumbling.
  for (let q = 0; q < 4; q++) ring(ctx, out, at + W.flip[1] * T + q * 0.035, { freq: 2600 + 500 * ((q * 0.7) % 1), dur: 0.08, gain: 0.06 * (1 - q * 0.2), type: 'sine', partials: METAL });
  if (v > 0.5) grunt(ctx, out, at + 0.92 * T, 300 * b.pitch, 0.24, 0.6);
};

/**
 * Evolving, a cue the length of the act: a crackle of sparks, then sparks crackling faster and a shimmer of metal rising as they
 * swirl in, to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and
 * then its own call, the chitter, the chirp or the grunt of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  sparks(ctx, dest, at + 0.02, 6, 0.8);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 500 * key, to: 1500 * key, q: 1.2, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: (1800 + 1400 * u) * key, dur: 0.06, gain: 0.03 + 0.03 * u, type: 'sine', partials: METAL });
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const NAIL_VOICE: Voice = { strike, work, evolve };
