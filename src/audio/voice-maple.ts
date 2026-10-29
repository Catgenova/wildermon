import { ACT_SECS } from '../render/beasts';
import { MAPLE_HITS, MAPLE_WORK } from '../render/wild-maple';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Saplet's voice, and its stages' (the species is `ambra`): a squirrel's
 * quick chitter and chirp, higher the smaller it is, and the Tapsylvan's
 * deep chuff under its own; the dry rustle of the leaves on its tail as it
 * swings it; and at its task, wood on wood -- the tok of a spout knocked
 * into bark, a staff planted -- and the sap: a drip into a cup, a trickle,
 * a stream into a jar.
 *
 * A chitter is a run of short buzzy chirps, each a triangle falling fast in
 * pitch, a chirp one rising; a chuff is breath through the nose, a low band
 * of noise over a thud of chest. A rustle is a scatter of tiny high bursts
 * of noise, which is what a heap of dry leaves is; a swish a band of noise
 * sweeping down. A tok is a short triangle with a woody overtone and a click;
 * a drip a sine leaping up in pitch, the way a drop's ring does as it lands
 * in liquid; a trickle a soft band of noise, wavering.
 *
 * Every cue lands where its picture does (`./wild-maple`): the strike on
 * `MAPLE_HITS`; the drips, the pushes of the spout, the runs and the pour,
 * the staff planted, on `MAPLE_WORK`; and the evolving chime on the flash
 * at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.6][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chitter: `n` quick buzzy chirps falling in pitch from `f`, close together. */
function chitter(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const g = f * (1 + 0.06 * Math.sin(q * 2.3));
    ring(ctx, dest, at + q * 0.055, { freq: g, to: g * 0.62, dur: 0.04, gain: 0.1 * k, type: 'triangle', attack: 0.003, partials: [[1, 0.7], [2, 0.3]] });
  }
  burst(ctx, dest, at, { dur: n * 0.055, freq: f * 1.8, q: 3, gain: 0.03 * k, attack: 0.01 });
}

/** A chirp: a clear whistle sliding up. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f * 0.8, to: f * 1.3, dur: 0.08, gain: 0.13 * k, type: 'sine', attack: 0.008 });
}

/** A chuff: breath out through the nose, a low band of noise, over a thud of a deep chest. */
function chuff(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.22, freq: 520, to: 260, q: 0.9, gain: 0.22 * k, attack: 0.02 });
  ring(ctx, dest, at, { freq: 130, to: 92, dur: 0.18, gain: 0.16 * k, type: 'sine', attack: 0.01 });
}

/** The leaves on its tail rustling: a scatter of tiny dry bursts, `dur` long, brighter for a smaller tail. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, bright: number, k: number): void {
  const n = Math.max(4, Math.round(dur / 0.025));
  for (let q = 0; q < n; q++) {
    const when = at + (q / n) * dur + 0.01 * Math.sin(q * 7.1);
    burst(ctx, dest, when, { dur: 0.018, freq: (4200 + 1400 * Math.sin(q * 3.7)) * bright, q: 1.8, gain: 0.07 * k * (0.6 + 0.4 * Math.sin(q * 1.3) ** 2), attack: 0.002 });
  }
}

/** Something swung through the air: a band of noise sweeping down, longer and lower for a bigger thing. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2600 * pitch, to: 700 * pitch, q: 1.4, gain: 0.14 * k, attack: dur * 0.6 });
}

/** Wood on wood: a short hollow tok and a click, lower for a heavier piece. */
function tok(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.92, dur: 0.09, gain: 0.26 * k, type: 'triangle', attack: 0.001, partials: [[1, 0.7], [2.7, 0.3]] });
  burst(ctx, dest, at, { dur: 0.025, freq: 2400, q: 2, gain: 0.14 * k, attack: 0.001 });
}

/** A drop landing in sap: a sine leaping up in pitch, short. */
function drip(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.8, dur: 0.05, gain: 0.13 * k, type: 'sine', attack: 0.003 });
}

/** Sap running: a soft wavering band of noise, `dur` long, and a drop now and then in it. */
function trickle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 1.2, q: 1.1, gain: 0.07 * k, attack: dur * 0.2 });
  for (let q = 0; q < Math.round(dur / 0.12); q++) drip(ctx, dest, at + 0.05 + q * 0.12, f * (0.5 + 0.12 * (q % 3)), 0.5 * k);
}

/**
 * Its own call, by stage. The Saplet's: a quick high chitter round 2800 Hz and a chirp. The Mapletap's: a lower, longer chitter
 * and two chirps. The Tapsylvan's: a deep chuff and a slow low chitter under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    chitter(ctx, dest, at, 2800 * b.pitch, 5, k);
    chirp(ctx, dest, at + 0.32, 3000 * b.pitch, 0.8 * k);
    return;
  }
  if (b.s === 1) {
    chitter(ctx, dest, at, 2600 * b.pitch, 7, k);
    chirp(ctx, dest, at + 0.42, 2600 * b.pitch, 0.7 * k);
    chirp(ctx, dest, at + 0.54, 2900 * b.pitch, 0.6 * k);
    return;
  }
  chuff(ctx, dest, at, 1.1 * k);
  for (let q = 0; q < 4; q++) ring(ctx, dest, at + 0.2 + q * 0.09, { freq: 1500 * b.pitch, to: 900 * b.pitch, dur: 0.06, gain: 0.08 * k, type: 'triangle', attack: 0.004, partials: [[1, 0.7], [2, 0.3]] });
}

/**
 * A strike. The Saplet chitters, its tail rustling as it whips it over and down with a soft leafy whump. The Mapletap swishes
 * its spout down with a tok of wood and a chirp. The Tapsylvan chuffs as it heaves its staff up, and brings it down with a heavy
 * knock of wood and a rustle of its mantle.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.7, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + MAPLE_HITS[s] * T;
  if (s === 0) {
    chitter(ctx, out, at + 0.02, 3000 * b.pitch, 3, 0.7);
    rustle(ctx, out, hit - 0.12, 0.2, 1.1, 1);
    burst(ctx, out, hit, { dur: 0.12, freq: 700, to: 240, q: 0.8, gain: 0.3, type: 'lowpass', attack: 0.004 });
    rustle(ctx, out, hit + 0.02, 0.12, 0.9, 0.7);
    return;
  }
  swish(ctx, out, hit - 0.18, 0.18, b.pitch * 1.3, 1);
  if (s === 1) {
    tok(ctx, out, hit, 720, 1);
    chirp(ctx, out, hit + 0.06, 2400 * b.pitch, 0.5);
    rustle(ctx, out, hit, 0.1, 0.9, 0.5);
    return;
  }
  chuff(ctx, out, at + 0.04, 0.9);
  tok(ctx, out, hit, 300, 1.4);
  ring(ctx, out, hit, { freq: 88, to: 50, dur: 0.26, gain: 0.4, type: 'sine', attack: 0.003 });
  rustle(ctx, out, hit + 0.02, 0.22, 0.8, 0.9);
};

/**
 * A go at its task. The Saplet's: three drips landing in its cup, each a little lower as it fills, and a pleased chirp. The
 * Mapletap's: two toks as its spout goes into the bark, the sap trickling into its cup, poured into its jar, and a chitter. The
 * Tapsylvan's: a rustle as its jar goes down on its vine, a deep tok as the staff bites, the stream into the jar, and a chuff.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.9, 1.7, 1.6][s]), b = bodyOf(stage, v), W = MAPLE_WORK, T = ACT_SECS.work;
  if (s === 0) {
    W.drips.forEach((d, q) => drip(ctx, out, at + (d + 0.06) * T, 1500 - 180 * q, 1));
    rustle(ctx, out, at + 0.04 * T, 0.1, 1.1, 0.4);
    if (v > 0.4) chirp(ctx, out, at + 0.9 * T, 3100 * b.pitch, 0.6);
    return;
  }
  if (s === 1) {
    for (const p of W.pushes) tok(ctx, out, at + p * T, 820, 0.9);
    trickle(ctx, out, at + W.run * T, (W.full - W.run) * T, 1700, 1);
    trickle(ctx, out, at + W.pour * T, (W.poured - W.pour) * T, 1300, 0.9);
    tok(ctx, out, at + W.pull * T, 980, 0.4);
    if (v > 0.4) chitter(ctx, out, at + 0.9 * T, 2600 * b.pitch, 3, 0.5);
    return;
  }
  rustle(ctx, out, at + 0.06 * T, (W.lower - 0.06) * T, 0.7, 0.6);
  burst(ctx, out, at + W.lower * T, { dur: 0.06, freq: 500, to: 200, q: 1, gain: 0.16, type: 'lowpass', attack: 0.003 });
  tok(ctx, out, at + W.plant * T, 360, 1.3);
  trickle(ctx, out, at + W.flow * T, (W.stop - W.flow) * T, 1100, 1.3);
  rustle(ctx, out, at + W.lift * T, 0.12, 0.7, 0.5);
  if (v > 0.4) chuff(ctx, out, at + 0.9 * T, 0.6);
};

/**
 * Evolving, a cue the length of the act: a burst of rustling leaves, then a rustle rising and quickening as the leaves swirl in,
 * to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own
 * call, the chitter, the longer chitter or the chuff of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  rustle(ctx, dest, at + 0.02, 0.18, 1, 0.8);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 3200 * key, q: 1.4, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.2 + (flash - 0.3) * (1 - (1 - u) ** 1.6);
    rustle(ctx, dest, when, 0.05, 0.8 + 0.5 * u, 0.3 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const MAPLE_VOICE: Voice = { strike, work, evolve };
