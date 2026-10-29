import { ACT_SECS } from '../render/beasts';
import { RIB_HITS, RIB_WORK } from '../render/wild-ribbon';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Ribbonip's voice, and its stages' (the species is `siffa`): a small
 * rodent's squeak and quick chitter, the Stripforge's lower churring
 * chitter, and the Metallocurl's chuff and deep chatter; over the ribbons
 * they work -- the zing of a strip drawn out, the shimmer of a ribbon in the
 * air, the clink of metal on the anvil and the crack of a ribbon whipped.
 *
 * A squeak is a pure whistle bent up and down, so a sine; a chitter is a
 * run of short squeaks too quick to count, each with a click of the teeth
 * at its front, a band of noise; a chuff is breath through a big nose, low
 * noise. Metal drawn thin rings: a zing is a stack of partials that do not
 * belong to a scale (2.76 and 5.4 over the root, as a struck bar's do)
 * sliding up as it is drawn out, over a fine hiss of it running through the
 * paws; a shimmer is a few of those, high and quiet, beating against each
 * other; a clink on the anvil is the same bar struck, short. The bigger the
 * body, the lower its voice and its metal.
 *
 * Every cue lands where its picture does (`./wild-ribbon`): the strike on
 * `RIB_HITS`; the strip drawn and pinched, the ribbon stretched and folded
 * down, the whip and its crack and its settling into orbit, on `RIB_WORK`;
 * and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how far down its metal, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; metal: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.42][s] * (0.95 + 0.1 * v), metal: [1, 0.8, 0.62][s] * (0.97 + 0.06 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** Metal drawn thin, ringing: three partials that belong to no scale. */
const METAL = [[1, 0.55], [2.76, 0.3], [5.4, 0.15]] as const;

/** A squeak: a whistle at `f` bent up and back, short; a tooth-click at its front. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 0.86, to: f * 1.12, dur: dur * 0.55, gain: 0.13 * k, type: 'sine', attack: 0.006 });
  ring(ctx, dest, at + dur * 0.45, { freq: f * 1.12, to: f * 0.92, dur: dur * 0.55, gain: 0.1 * k, type: 'sine', attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.012, freq: f * 2.2, q: 2.5, gain: 0.05 * k, attack: 0.001 });
}

/** A chitter: `n` quick squeaks, each a little off the last, too quick to count. */
function chitter(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) squeak(ctx, dest, at + q * 0.045, f * (1 + 0.07 * ((q * 5) % 3) - 0.04 * q), 0.035, k * (1 - 0.06 * q));
}

/** A chuff: breath through a big nose, a puff of low noise with a little voice under it. */
function chuff(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.16, freq: 700, to: 380, q: 0.8, gain: 0.16 * k, attack: 0.02 });
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur: 0.14, gain: 0.08 * k, type: 'triangle', attack: 0.015 });
}

/**
 * A zing: a ribbon drawn out, its metal ringing up from `f` to `to` over `dur` as it thins, a fine hiss of it running
 * through the paws under it.
 */
function zing(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, to: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to, dur, gain: 0.08 * k, type: 'sine', attack: dur * 0.7, partials: METAL });
  burst(ctx, dest, at, { dur, freq: 5200, to: 7600, q: 3, gain: 0.05 * k, attack: dur * 0.8 });
}

/** A shimmer: ribbon in the air, a few high quiet metal rings a little apart in pitch, beating, dying slowly. */
function shimmer(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  for (const [d, m] of [[0, 1], [0.03, 1.013], [0.07, 1.5], [0.11, 1.508]] as const) {
    ring(ctx, dest, at + d, { freq: f * m, dur, gain: 0.035 * k, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2.76, 0.2]] });
  }
}

/** Metal struck on the anvil: a bar's three partials, short, with the knock of it. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.3): void {
  ring(ctx, dest, at, { freq: f, dur, gain: 0.16 * k, type: 'sine', attack: 0.001, partials: METAL });
  burst(ctx, dest, at, { dur: 0.03, freq: f * 1.6, q: 1.5, gain: 0.12 * k, attack: 0.001 });
}

/** A ribbon swung through the air: a band of noise sweeping down, a whistle of metal over it. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3000 * pitch, to: 900 * pitch, q: 1.3, gain: 0.13 * k, attack: dur * 0.6 });
  ring(ctx, dest, at, { freq: 2400 * pitch, to: 1500 * pitch, dur, gain: 0.025 * k, type: 'sine', attack: dur * 0.6, partials: METAL });
}

/** A crack: a ribbon whipped taut, a sharp snap of noise and its metal ringing after. */
function crack(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.04, freq: 3600, q: 0.7, gain: 0.32 * k, attack: 0.001 });
  burst(ctx, dest, at + 0.005, { dur: 0.12, freq: 1800, to: 900, q: 1.2, gain: 0.1 * k, attack: 0.002 });
  ring(ctx, dest, at + 0.01, { freq: f, dur: 0.5, gain: 0.08 * k, type: 'sine', attack: 0.002, partials: METAL });
}

/**
 * Its own call, by stage. The Ribbonip's: two bright squeaks round 2800 Hz and a quick chitter. The Stripforge's: a churring
 * chitter round 1800 Hz, a squeak to end it. The Metallocurl's: a chuff and a deep chatter round 1100 Hz, slower.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 2800 * b.pitch;
    squeak(ctx, dest, at, f, 0.09, k);
    squeak(ctx, dest, at + 0.12, f * 1.1, 0.07, 0.8 * k);
    chitter(ctx, dest, at + 0.24, f * 1.05, 4, 0.6 * k);
    return;
  }
  if (b.s === 1) {
    const f = 2700 * b.pitch;
    chitter(ctx, dest, at, f, 7, 0.9 * k);
    squeak(ctx, dest, at + 0.36, f * 1.15, 0.1, 0.8 * k);
    return;
  }
  const f = 2600 * b.pitch;
  chuff(ctx, dest, at, 140, k);
  for (let q = 0; q < 5; q++) squeak(ctx, dest, at + 0.18 + q * 0.075, f * (1 - 0.04 * q), 0.06, 0.9 * k);
  ring(ctx, dest, at + 0.18, { freq: 130, to: 110, dur: 0.4, gain: 0.05 * k, type: 'triangle', attack: 0.03 });
}

/**
 * A strike. The Ribbonip squeaks and lashes its ribbon out, a quick swish and a light crack. The Stripforge chitters as it
 * rears and brings its ribbon down, a swish and a crack with its metal ringing. The Metallocurl chuffs as it turns into a
 * sweep, its loops shimmering, a long swish and a heavy crack.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.6, 2.3, 1.5][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + RIB_HITS[s] * T;
  if (s === 0) squeak(ctx, out, at + 0.03, 3000 * b.pitch, 0.08, 0.8);
  else if (s === 1) chitter(ctx, out, at + 0.02, 2700 * b.pitch, 3, 0.7);
  else {
    chuff(ctx, out, at + 0.02, 140, 0.9);
    shimmer(ctx, out, at + 0.1, 2200 * b.metal, 0.4, 0.8);
  }
  swish(ctx, out, hit - 0.06 - 0.06 * s, 0.08 + 0.06 * s, 1.2 - 0.25 * s, 0.9);
  crack(ctx, out, hit, 2600 * b.metal, 0.5 + 0.25 * s);
  if (s === 2) ring(ctx, out, hit, { freq: 110, to: 70, dur: 0.22, gain: 0.18, type: 'sine', attack: 0.003 });
};

/**
 * A go at its task. The Ribbonip's: a tap as its paws take the lump, the zing of a strip drawn up out of it between its
 * paws, a bright clink as it pinches it flat, and a squeak. The Stripforge's: a zing as it stretches its ribbon wide, a
 * clank as it folds it down on the anvil, another zing as it stretches it again, and a chitter. The Metallocurl's: a hiss
 * of ribbon drawn back, a long swish as it whips it out, a heavy crack and clang on the anvil, the loop's metal shimmering
 * as it settles into its orbit, and a chuff.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.9, 1.9, 1.4][s]), b = bodyOf(stage, v), W = RIB_WORK, T = ACT_SECS.work;
  if (s === 0) {
    burst(ctx, out, at + W.grab * T, { dur: 0.03, freq: 2200, q: 2, gain: 0.08, attack: 0.002 });
    zing(ctx, out, at + W.grab * T, 1500 * b.metal, 2600 * b.metal, (W.drawn - W.grab) * T, 0.9);
    clink(ctx, out, at + W.pinch * T, 3300 * b.metal, 0.7, 0.22);
    shimmer(ctx, out, at + (W.pinch + 0.02) * T, 3400 * b.metal, 0.3, 0.5);
    if (v > 0.5) squeak(ctx, out, at + 0.86 * T, 2900 * b.pitch, 0.08, 0.5);
    return;
  }
  if (s === 1) {
    zing(ctx, out, at + 0.04 * T, 1200 * b.metal, 2000 * b.metal, (W.wide - 0.04) * T, 0.8);
    clink(ctx, out, at + W.fold * T, 1900 * b.metal, 0.9, 0.34);
    burst(ctx, out, at + W.fold * T, { dur: 0.08, freq: 500, to: 260, q: 1, gain: 0.12, attack: 0.002 });
    zing(ctx, out, at + (W.fold + 0.06) * T, 1300 * b.metal, 2200 * b.metal, (W.again - W.fold - 0.06) * T, 0.7);
    if (v > 0.5) chitter(ctx, out, at + 0.84 * T, 2700 * b.pitch, 4, 0.45);
    return;
  }
  burst(ctx, out, at + 0.04 * T, { dur: (W.back - 0.04) * T, freq: 4200, to: 2600, q: 2, gain: 0.05, attack: (W.back - 0.04) * T * 0.7 });
  swish(ctx, out, at + W.back * T, (W.crack - W.back) * T, 0.7, 1);
  crack(ctx, out, at + W.crack * T, 1500 * b.metal, 0.9);
  clink(ctx, out, at + (W.crack + 0.01) * T, 1100 * b.metal, 0.9, 0.5);
  ring(ctx, out, at + W.crack * T, { freq: 90, to: 60, dur: 0.25, gain: 0.16, type: 'sine', attack: 0.003 });
  shimmer(ctx, out, at + (W.crack + 0.08) * T, 1800 * b.metal, (W.settle - W.crack) * T + 0.2, 0.8);
  if (v > 0.5) chuff(ctx, out, at + 0.86 * T, 140, 0.5);
};

/**
 * Evolving, a cue the length of the act: a shimmer of metal, then zings rising faster and higher as the motes of gold and
 * steel spiral in, to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the
 * last -- and then its own call, the squeaks, the chitter or the chatter of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.7);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  shimmer(ctx, dest, at + 0.02, 2600 * key, 0.5, 0.6);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 2000 * key, to: 6000 * key, q: 2, gain: 0.04, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.15 + (flash - 0.24) * (1 - (1 - u) ** 1.6);
    zing(ctx, dest, when, (1200 + 1200 * u) * key, (1600 + 1600 * u) * key, 0.08, 0.4 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.6, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.6], [2.76, 0.25], [5.4, 0.15]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const RIBBON_VOICE: Voice = { strike, work, evolve };
