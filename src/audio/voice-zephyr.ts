import { ACT_SECS } from '../render/beasts';
import { ZEPHYR_HITS, ZEPHYR_WARD } from '../render/wild-zephyr';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Zephlet's voice, and its stages' (the species is `stona`): the pup's
 * airy chirps and trills, the Galecrest's whistling gust of a cry, and the
 * Tempestwyrm's deep, windy roar -- over the wind they move, a whoosh for a
 * wing or a lunge and a rising rush as a ward wraps round them.
 *
 * A whistle is a sine with a quick vibrato on its pitch, slid where it goes,
 * with a little breath of high noise under it; a chirp is a short one leaping
 * up, a trill a run of them alternating. The Galecrest's cry is a whistle
 * gliding up and down over a gust of noise through a band that sweeps with
 * it. The Tempestwyrm's roar is a low sawtooth growl through a throat's
 * resonances, a rumble of noise under it and the wind's whistle over it, its
 * energy between 150 and 400 Hz where a small speaker still plays it.
 *
 * Every cue lands where its picture does (`./wild-zephyr`): the strike on
 * `ZEPHYR_HITS`, the ward's gathering and wrapping on `ZEPHYR_WARD`, and the
 * evolving chime on the flash at the middle of the act.
 */

/** A whistled note: a sine through `f` (Hz, slid between), with a vibrato `wobble` deep (a share of its pitch) `rate` times a second. */
function whistle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: readonly number[], dur: number, gain: number, rate = 9, wobble = 0.03, attack = 0.01): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  f.forEach((x, i) => {
    const t = at + (dur * i) / Math.max(1, f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(x, t);
    else osc.frequency.exponentialRampToValueAtTime(x, t);
  });
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = rate;
  depth.gain.value = f[0] * wobble;
  lfo.connect(depth).connect(osc.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.setValueAtTime(gain, at + Math.max(attack, dur * 0.55));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(dest);
  for (const n of [osc, lfo]) {
    n.start(at);
    n.stop(at + dur + 0.05);
  }
}

/** A growl: a sawtooth through `f`, through a throat's resonances (frequency, sharpness, share). */
function growl(ctx: BaseAudioContext, dest: AudioNode, at: number, f: readonly number[], dur: number, gain: number, formants: ReadonlyArray<readonly [number, number, number]>, attack = 0.06): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  f.forEach((x, i) => {
    const t = at + (dur * i) / Math.max(1, f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(x, t);
    else osc.frequency.exponentialRampToValueAtTime(x, t);
  });
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.setValueAtTime(gain, at + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  for (const [fq, q, g] of formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = fq;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    osc.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

const stageOf = (stage: number): 0 | 1 | 2 => Math.max(0, Math.min(2, Math.round(stage))) as 0 | 1 | 2;

/**
 * Its own call, by stage. The Zephlet's: a chirp leaping up round 1.6 kHz and a quick trill after it. The Galecrest's: a whistling
 * cry gliding up and falling, round 900 Hz, over a gust. The Tempestwyrm's: a deep roar round 95 Hz, swelling, with the wind
 * rushing under it and whistling over it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 1600 * p;
    whistle(ctx, dest, at, [f * 0.8, f * 1.3], 0.08, 0.3 * k, 14, 0.02, 0.006);
    for (let q = 0; q < 4; q++) whistle(ctx, dest, at + 0.11 + q * 0.045, [f * (q % 2 ? 1.12 : 1.28), f * (q % 2 ? 1.05 : 1.2)], 0.04, (0.2 - 0.03 * q) * k, 20, 0.015, 0.004);
    burst(ctx, dest, at, { dur: 0.28, freq: 5200, q: 1.2, gain: 0.04 * k, attack: 0.03 });
    return;
  }
  if (s === 1) {
    const f = 880 * p;
    whistle(ctx, dest, at, [f * 0.85, f * 1.35, f * 1.1, f * 0.8], 0.5, 0.22 * k, 7, 0.035, 0.04);
    burst(ctx, dest, at, { dur: 0.55, freq: 700, to: 1800, q: 1.4, gain: 0.12 * k, attack: 0.18 });
    burst(ctx, dest, at + 0.25, { dur: 0.35, freq: 1800, to: 600, q: 1.2, gain: 0.07 * k, attack: 0.05 });
    return;
  }
  const f = 95 * p;
  growl(ctx, dest, at, [f * 0.9, f * 1.12, f * 1.0, f * 0.78], 0.9, 0.28 * k, [[160, 2, 1.2], [280, 3, 1.1], [420, 3.5, 0.6], [900, 4, 0.12]]);
  ring(ctx, dest, at + 0.04, { freq: f * 0.5, to: f * 0.42, dur: 0.85, gain: 0.12 * k, type: 'sine', attack: 0.08 });
  burst(ctx, dest, at, { dur: 1.0, freq: 320, to: 650, q: 0.9, gain: 0.16 * k, attack: 0.3 });
  whistle(ctx, dest, at + 0.2, [1100 * p, 1500 * p, 900 * p], 0.7, 0.05 * k, 5, 0.04, 0.2);
}

/** Air moved fast past it: a swish of noise rising through its band, lower and longer for a bigger body. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, low: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: low, to: low * 3.2, q: 0.9, gain: 0.16 * k, attack: len * 0.7 });
}

/** Jaws snapping shut: a sharp click and a short knock under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, s: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.035, freq: [3200, 2400, 1700][s], q: 2, gain: 0.3 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: [620, 380, 210][s], to: [300, 180, 100][s], dur: 0.07, gain: 0.25 * k, type: 'sine', attack: 0.002 });
}

/**
 * A strike. The Zephlet chirps as it draws back and snaps with a puff of air; the Galecrest cries, its lunge whooshes and its jaws
 * snap; the Tempestwyrm roars as it rears, its wings come down with a deep whump of air, and its jaws snap.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.3, 1.1, 0.95][s]), hit = at + ZEPHYR_HITS[s] * ACT_SECS.strike;
  call(ctx, out, at, s, v, 0.6);
  whoosh(ctx, out, hit - 0.12, 0.13, [900, 600, 380][s], 1);
  snap(ctx, out, hit, s, 1);
  burst(ctx, out, hit + 0.01, { dur: 0.18 + 0.08 * s, freq: [2600, 1800, 900][s], to: [1200, 700, 300][s], q: 0.8, gain: 0.12, attack: 0.01 });
  if (s === 2) {
    // The wings brought down: a deep thump of air.
    ring(ctx, out, hit - 0.02, { freq: 70, to: 40, dur: 0.3, gain: 0.4, type: 'sine', attack: 0.01 });
    burst(ctx, out, hit - 0.03, { dur: 0.35, freq: 260, to: 120, q: 0.7, gain: 0.3, type: 'lowpass', attack: 0.02 });
  }
};

/** A go at keeping watch: its call, softly, as it looks round -- a chirrup, a short whistle, a low huff. */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.1, 1.0, 0.9][s]);
  if (s === 0) {
    const f = 1500 * (0.95 + 0.1 * v);
    whistle(ctx, out, at + 0.1, [f, f * 1.25, f * 1.1], 0.12, 0.14, 16, 0.02, 0.008);
    whistle(ctx, out, at + 0.26, [f * 1.1, f * 1.3], 0.07, 0.1, 18, 0.02, 0.006);
    return;
  }
  if (s === 1) {
    whistle(ctx, out, at + 0.1, [820, 1150, 980], 0.28, 0.1, 7, 0.03, 0.03);
    burst(ctx, out, at + 0.1, { dur: 0.3, freq: 900, to: 1500, q: 1.2, gain: 0.05, attack: 0.1 });
    return;
  }
  growl(ctx, out, at + 0.12, [80, 92, 74], 0.4, 0.12, [[160, 2, 1], [300, 3, 0.8]], 0.05);
  burst(ctx, out, at + 0.12, { dur: 0.45, freq: 400, to: 260, q: 0.9, gain: 0.08, attack: 0.12 });
};

/**
 * Its Stoneskin: the wind drawn in, a rising rush of noise and a whistle climbing with it; then as the ward wraps round it a low
 * hard ring, as of stone, and over it a glassy shimmer of high notes swirling round and fading with the ward, a little lower for a
 * bigger body.
 */
const cast = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.2, 1.15, 1.1][s]), key = [1, 0.8, 0.62][s], T = ACT_SECS.cast;
  const wrap = at + ZEPHYR_WARD.wrap * T, end = at + ZEPHYR_WARD.gone * T;
  burst(ctx, out, at, { dur: wrap - at + 0.05, freq: 300 * key, to: 1800 * key, q: 1.1, gain: 0.18, attack: (wrap - at) * 0.85 });
  whistle(ctx, out, at + 0.05, [500 * key, 1400 * key], wrap - at, 0.06, 6, 0.04, 0.2);
  ring(ctx, out, wrap, { freq: 180 * key, dur: 0.5, gain: 0.22, type: 'sine', attack: 0.004, partials: [[1, 0.6], [2.76, 0.25], [5.4, 0.15]] });
  for (let q = 0; q < 6; q++) {
    const f = [1568, 1976, 2349, 1760, 2637, 2093][q] * key * (0.98 + 0.04 * v);
    ring(ctx, out, wrap + 0.02 + q * 0.06, { freq: f, dur: 0.28, gain: 0.05 - 0.004 * q, type: 'sine', attack: 0.006, partials: [[1, 0.8], [2.01, 0.2]] });
  }
  burst(ctx, out, wrap, { dur: end - wrap, freq: 2200 * key, to: 900 * key, q: 1.6, gain: 0.07, attack: 0.05 });
  call(ctx, out, at + 0.02, s, v, 0.35);
};

/**
 * Evolving, a cue the length of the act: a gust off it, then wind rising faster and higher as the feathers swirl in, to the flash
 * at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the
 * chirp, the cry or the roar of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.6);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  whoosh(ctx, dest, at, 0.3, 500 * key, 0.9);
  burst(ctx, dest, at + 0.12, { dur: flash - 0.12, freq: 400 * key, to: 2400 * key, q: 1.3, gain: 0.12, attack: (flash - 0.12) * 0.85 });
  whistle(ctx, dest, at + 0.2, [600 * key, 1800 * key], flash - 0.2, 0.05, 6, 0.04, 0.3);
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 100 - 15 * s, to: 55 - 8 * s, dur: 0.4, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const ZEPHYR_VOICE: Voice = { strike, work, cast, evolve };
