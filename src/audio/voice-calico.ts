import { ACT_SECS } from '../render/beasts';
import { CAT_HITS, CAT_WORK } from '../render/wild-calico';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sprigkit's voice, and its stages' (the species is `bedda`): a kitten's
 * high mew, a grown cat's rolling trill, and the Floramane's deep mrrow over
 * a contented rumble; a purr; and over its planter -- soft pats of soil, a
 * seed popped in, leaves rustling, water poured from a jug, a stem snapped.
 *
 * A mew is a voice through an open mouth, so a sawtooth's harmonics climbing
 * and then sagging, under a band of breath where the mouth rings; a trill is
 * the same voice broken into quick rising pulses, a rolled r. A purr is a
 * low hum beaten at about twenty-five times a second, each beat a puff of
 * low noise; the Floramane's rumble is that purr lower and longer, with a
 * hum under it a small speaker still plays. A pat is a thud of low noise,
 * soft; a rustle is a few short bands of high noise, which is what leaves
 * rubbing do; a pour is noise in a narrowing band.
 *
 * Every cue lands where its picture does (`./wild-calico`): the strike on
 * `CAT_HITS`; the pats, the seed and the sprout, the jug, the pour and the
 * bloom, the pluck, the tuck and the pat, on `CAT_WORK`; and the evolving
 * chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.42][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A mew: the voice up from `f` to its top and sagging away below where it began, a band of breath over it. */
function mew(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  const up = dur * 0.35;
  ring(ctx, dest, at, { freq: f, to: f * 1.35, dur: up, gain: 0.1 * k, type: 'sawtooth', attack: 0.02, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  ring(ctx, dest, at + up * 0.9, { freq: f * 1.35, to: f * 0.8, dur: dur - up, gain: 0.1 * k, type: 'sawtooth', attack: 0.01, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  burst(ctx, dest, at, { dur, freq: f * 3.4, to: f * 2.6, q: 3.5, gain: 0.06 * k, attack: 0.03 });
}

/** A trill: `n` quick pulses of the voice, each rising, the run climbing; a rolled r. */
function trill(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) ring(ctx, dest, at + q * 0.035, { freq: f * (1 + 0.03 * q), to: f * (1.12 + 0.03 * q), dur: 0.03, gain: 0.1 * k, type: 'triangle', attack: 0.004, partials: [[1, 0.7], [2, 0.3]] });
}

/** A purr: a low hum beaten about twenty-five times a second, each beat a puff of low noise; lower and longer for a bigger body. */
function purr(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, heavy: number, k: number): void {
  const rate = 26 - 6 * heavy, beats = Math.floor(dur * rate);
  for (let q = 0; q < beats; q++) {
    const swell = Math.sin((Math.PI * (q + 0.5)) / beats);
    burst(ctx, dest, at + q / rate, { dur: 0.6 / rate, freq: 260 - 110 * heavy, q: 0.9, type: 'lowpass', gain: 0.16 * k * swell, attack: 0.008 });
  }
  ring(ctx, dest, at, { freq: 110 - 40 * heavy, to: 100 - 38 * heavy, dur, gain: 0.05 * k * (0.5 + heavy), type: 'triangle', attack: dur * 0.3 });
}

/** A soft pat of paw on soil: a thud of low noise, a little grit over it. */
function pat(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07 + 0.05 * heavy, freq: 420 - 160 * heavy, to: 160, q: 0.8, type: 'lowpass', gain: 0.32 * k, attack: 0.003 });
  burst(ctx, dest, at + 0.005, { dur: 0.05, freq: 2600, q: 1.2, gain: 0.04 * k, attack: 0.002 });
}

/** Leaves rustling: a few short bands of high noise, one after another. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.045 + 0.01 * (q % 2), { dur: 0.05 + 0.02 * (q % 3), freq: 3400 + 700 * ((q * 3) % 4), to: 2400, q: 1.4, gain: 0.07 * k, attack: 0.01 });
}

/** A twinkle as a flower opens or a sprout comes up: two soft bell notes a fifth apart. */
function twinkle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur: 0.3, gain: 0.05 * k, type: 'sine', attack: 0.01, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + 0.07, { freq: f * 1.5, dur: 0.35, gain: 0.045 * k, type: 'sine', attack: 0.01, partials: [[1, 0.8], [2, 0.2]] });
}

/**
 * Its own call, by stage. The Sprigkit's: a high mew round 900 Hz. The Bloomwhisk's: a rolling trill round 520 Hz and a short
 * mew after it. The Floramane's: a deep mrrow round 300 Hz over its contented rumble.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    mew(ctx, dest, at, 900 * b.pitch, 0.32, k);
    return;
  }
  if (b.s === 1) {
    trill(ctx, dest, at, 780 * b.pitch, 7, k);
    mew(ctx, dest, at + 0.3, 820 * b.pitch, 0.24, 0.8 * k);
    return;
  }
  trill(ctx, dest, at, 700 * b.pitch, 5, 1.1 * k);
  mew(ctx, dest, at + 0.18, 720 * b.pitch, 0.5, 1.2 * k);
  purr(ctx, dest, at + 0.1, 0.9, 1, 0.7 * k);
}

/**
 * A strike. The Sprigkit mews as it hops and bops down, a soft thump. The Bloomwhisk's paws swish down through the air and land
 * with a slap and a shake of its leaves. The Floramane mrrows as it heaves up and comes down with a deep thump, its leaves
 * thrashing.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.1][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + CAT_HITS[s] * T;
  if (s === 0) {
    mew(ctx, out, at + 0.04, 1000 * b.pitch, 0.18, 0.7);
    pat(ctx, out, hit, 0.3, 1);
    rustle(ctx, out, hit + 0.02, 3, 0.6);
    return;
  }
  burst(ctx, out, hit - 0.16, { dur: 0.16, freq: 2400 * b.pitch, to: 700 * b.pitch, q: 1.4, gain: 0.12, attack: 0.1 });
  if (s === 1) {
    burst(ctx, out, hit, { dur: 0.05, freq: 1500, to: 800, q: 1.2, gain: 0.26, attack: 0.002 });
    pat(ctx, out, hit, 0.5, 0.8);
    rustle(ctx, out, hit + 0.03, 4, 0.8);
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.45);
  ring(ctx, out, hit, { freq: 88, to: 44, dur: 0.32, gain: 0.45, type: 'sine', attack: 0.003 });
  burst(ctx, out, hit, { dur: 0.22, freq: 520, to: 140, q: 0.8, gain: 0.26, type: 'lowpass', attack: 0.003 });
  rustle(ctx, out, hit + 0.02, 6, 1);
};

/**
 * A go at its task. The Sprigkit's: two soft pats of the soil, a rustle at its belt for the seed, a little pop as it goes in, the
 * soil patted down, a twinkle as the sprout comes up, and a purr. The Bloomwhisk's: a clink of the clay jug, water poured onto
 * the sprout, a rustle as it cups it, a twinkle as it blooms, and a trill. The Floramane's: a rustle as it takes hold of the
 * bloom, the stem snapped, a rustle as it tucks it into its mantle, two pats on it, a twinkle as the new bud opens, and its rumble.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.7, 1.6][s]), b = bodyOf(stage, v), W = CAT_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const c of W.pats) pat(ctx, out, at + c * T, 0.2, 0.8);
    rustle(ctx, out, at + (W.seed - 0.04) * T, 2, 0.6);
    ring(ctx, out, at + W.sow * T, { freq: 520, to: 900, dur: 0.05, gain: 0.1, type: 'sine', attack: 0.003 });
    pat(ctx, out, at + W.tamp * T, 0.2, 0.9);
    pat(ctx, out, at + (W.tamp + 0.04) * T, 0.2, 0.6);
    twinkle(ctx, out, at + W.sprout * T, 1320, 0.8);
    if (v > 0.5) purr(ctx, out, at + 0.9 * T, 0.5, 0, 0.5);
    return;
  }
  if (s === 1) {
    ring(ctx, out, at + W.jug * T, { freq: 1180, dur: 0.12, gain: 0.05, type: 'sine', attack: 0.002, partials: [[1, 0.6], [2.7, 0.4]] });
    burst(ctx, out, at + W.pour * T, { dur: (W.poured - W.pour) * T, freq: 1800, to: 2600, q: 0.9, gain: 0.08, attack: 0.05 });
    for (let q = 0; q < 4; q++) ring(ctx, out, at + (W.pour + 0.04 + q * 0.05) * T, { freq: 1400 + 200 * (q % 3), to: 2300, dur: 0.04, gain: 0.05, type: 'sine', attack: 0.003 });
    rustle(ctx, out, at + W.cup * T, 3, 0.6);
    twinkle(ctx, out, at + W.bloom * T, 1100, 1);
    if (v > 0.5) trill(ctx, out, at + 0.86 * T, 780 * b.pitch, 6, 0.5);
    return;
  }
  rustle(ctx, out, at + W.grasp * T, 3, 0.8);
  burst(ctx, out, at + W.pluck * T, { dur: 0.03, freq: 2200, q: 2, gain: 0.22, attack: 0.001 });
  ring(ctx, out, at + W.pluck * T, { freq: 340, to: 200, dur: 0.05, gain: 0.08, type: 'triangle', attack: 0.002 });
  rustle(ctx, out, at + (W.tuck - 0.04) * T, 5, 1);
  pat(ctx, out, at + (W.pat - 0.03) * T, 0.6, 0.5);
  pat(ctx, out, at + (W.pat + 0.04) * T, 0.6, 0.5);
  twinkle(ctx, out, at + (W.regrow + 0.08) * T, 880, 0.8);
  purr(ctx, out, at + 0.58 * T, 0.45 * T, 1, 0.8);
};

/**
 * Evolving, a cue the length of the act: a rustle of leaves gathering and quickening as they swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the mew, the
 * trill or the mrrow and rumble of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.08, { dur: flash - 0.08, freq: 2200 * key, to: 4200 * key, q: 1, gain: 0.05, attack: (flash - 0.08) * 0.85 });
  for (let q = 0; q < 9; q++) {
    const u = q / 9, when = at + 0.12 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    rustle(ctx, dest, when, 2, 0.3 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const CALICO_VOICE: Voice = { strike, work, evolve };
