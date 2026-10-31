import { ACT_SECS } from '../render/beasts';
import { GLASS_HITS, GLASS_WORK, PRISMETAIL_SLAM } from '../render/wild-glass';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Glimmip's voice, and its stages' (the species is `glimmip`): a gecko's
 * soft clicking chirps, and the glass of its bubble -- a clear ring, the
 * Prismetail's lower and longer; at its work, the smelter's breath of fire,
 * the gob drawn hot out of it with a sizzle, the puffs it blows the bubble
 * with and the bubble's swelling ring, and the lump set down with a clink.
 *
 * A chirp is a gecko's: a few quick clicks of a sine sliding up, dry and
 * short. Glass is a struck thin bowl: a ring with a bell's inharmonic
 * partials, high and long, and its shimmer a few of them a little apart. A
 * puff is a short breath of soft noise; the bubble's swelling a ring sliding
 * up as it grows. The bigger the body, the lower all of it.
 *
 * Every cue lands where its picture does (`./wild-glass`): the blow on
 * `GLASS_HITS` and the Prismetail's tail on `PRISMETAIL_SLAM`; the gob, the
 * puffs, the bubble and the lump on `GLASS_WORK`; and the evolving chime on
 * the flash at the middle of the act.
 */

function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.8, 0.6][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A gecko's chirp: `n` quick dry clicks, each a sine sliding up. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) {
    ring(ctx, dest, at + q * 0.055, { freq: f * (1 + 0.04 * q), to: f * 1.3, dur: 0.035, gain: 0.09 * k, type: 'sine', attack: 0.002, partials: [[1, 0.8], [2, 0.2]] });
    burst(ctx, dest, at + q * 0.055, { dur: 0.006, freq: f * 2.4, q: 3, gain: 0.03 * k, attack: 0.001 });
  }
}

/** Glass struck: a clear ring with a bell's partials, and a second a little apart for its shimmer. */
function glassRing(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur, gain: 0.06 * k, type: 'sine', attack: 0.002, partials: [[1, 0.55], [2.76, 0.28], [5.4, 0.17]] });
  ring(ctx, dest, at + 0.01, { freq: f * 1.007, dur: dur * 0.8, gain: 0.03 * k, type: 'sine', attack: 0.004, partials: [[1, 0.7], [2.76, 0.3]] });
}

/** A puff: a short breath of soft noise. */
function puff(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07, freq: 1100 * pitch, to: 700 * pitch, q: 0.8, gain: 0.07 * k, attack: 0.015 });
}

/** A lump of glass set down: a quick bright clink over a soft knock. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur: 0.1, gain: 0.08 * k, type: 'sine', attack: 0.001, partials: [[1, 0.5], [2.76, 0.32], [5.4, 0.18]] });
  burst(ctx, dest, at, { dur: 0.02, freq: 600, q: 1, gain: 0.05 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Glimmip's: a quick chirp of clicks round 1800 Hz and its bubble's high ring. The Glascade's: two
 * chirps and a ring with a shimmer. The Prismetail's: a slower, lower chirp and three rings of glass down a chord, long.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    chirp(ctx, dest, at, 1800 * b.pitch, 4, k);
    glassRing(ctx, dest, at + 0.26, 2640, 0.5, 0.7 * k);
    return;
  }
  if (b.s === 1) {
    chirp(ctx, dest, at, 1800 * b.pitch, 3, k);
    chirp(ctx, dest, at + 0.22, 1950 * b.pitch, 3, 0.8 * k);
    glassRing(ctx, dest, at + 0.44, 2090, 0.7, 0.8 * k);
    return;
  }
  chirp(ctx, dest, at, 1600 * b.pitch, 3, 1.1 * k);
  for (const [q, f] of [1568, 1319, 1047].entries()) glassRing(ctx, dest, at + 0.22 + q * 0.12, f, 0.9, 0.8 * k);
}

/**
 * A strike: a hiss as it gathers itself, a thump as the blow lands -- deeper for a bigger body -- and the glass of its bubble ringing
 * with it; the Prismetail's tail brought down after with a second thump and a ring; and a chirp after it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + GLASS_HITS[s] * T;
  burst(ctx, out, at + 0.05, { dur: 0.14, freq: 3600 * b.pitch, q: 1.2, gain: 0.05, attack: 0.03 });
  ring(ctx, out, hit, { freq: 160 - 55 * b.heavy, to: 72, dur: 0.1 + 0.08 * b.heavy, gain: 0.28, type: 'sine', attack: 0.003 });
  burst(ctx, out, hit, { dur: 0.05, freq: 1000 - 320 * b.heavy, q: 0.9, gain: 0.16, attack: 0.002 });
  glassRing(ctx, out, hit + 0.02, 2400 * (0.8 + 0.2 * b.pitch), 0.45, 1);
  if (s === 2) {
    const slam = at + PRISMETAIL_SLAM * T;
    ring(ctx, out, slam, { freq: 82, to: 52, dur: 0.16, gain: 0.2, type: 'sine', attack: 0.004 });
    glassRing(ctx, out, slam + 0.02, 1568, 0.6, 0.9);
  } else chirp(ctx, out, hit + 0.12, 1800 * b.pitch, 3, 0.6);
};

/**
 * A go at its task: the smelter's breath of fire as its head goes in; a sizzle as the gob is drawn out hot; three puffs as it blows
 * and the bubble's ring rising as it swells; a soft tink as it settles into a lump; a clink as the lump is set down; and now and
 * then its call. The bigger the body, the lower its glass.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.8, 3.6, 3.4][s]), b = bodyOf(stage, v), W = GLASS_WORK, T = ACT_SECS.work;
  const glass = 2200 * (0.75 + 0.25 * b.pitch);
  burst(ctx, out, at + (W.reach - 0.06) * T, { dur: 0.22, freq: 480, to: 180, q: 0.7, gain: 0.1, attack: 0.05 });
  burst(ctx, out, at + W.grab * T, { dur: 0.16, freq: 5200, to: 3000, q: 1.4, gain: 0.05, attack: 0.004 });
  for (let q = 0; q < 3; q++) puff(ctx, out, at + (W.puff + q * (W.blown - W.puff) / 3) * T, 0.9 + 0.2 * b.pitch, 1);
  ring(ctx, out, at + W.puff * T, { freq: glass * 0.5, to: glass * 0.8, dur: (W.blown - W.puff) * T, gain: 0.035, type: 'sine', attack: 0.05, partials: [[1, 0.8], [2.76, 0.2]] });
  glassRing(ctx, out, at + W.lump * T, glass, 0.3, 0.6);
  clink(ctx, out, at + W.set * T, glass * 0.8, 1);
  if (v > 0.5) call(ctx, out, at + 0.94 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: little rings of glass quickening and rising as the bubbles swirl in, a swelling ring to
 * the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.1 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    glassRing(ctx, dest, when, (1900 + 1500 * u) * key, 0.25, 0.4 + 0.4 * u);
  }
  ring(ctx, dest, at + flash - 0.3, { freq: 600 * key, to: 1200 * key, dur: 0.3, gain: 0.04, type: 'sine', attack: 0.1 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const GLASS_VOICE: Voice = { strike, work, evolve };
