import { ACT_SECS } from '../render/beasts';
import { CAPY_HITS, CAPY_WORK } from '../render/wild-capy';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pailbara's voice, and its stages' (the species is `dippa`): a young
 * capybara's soft whistling chirp, a grown one's contented clicking purr, and
 * the Reservara's deep gruff huff of a bark; over the water they carry -- a
 * splash, a slosh, the glug of a bucket filling, a drip.
 *
 * A capybara's chirp is a pure whistle sliding up and back, so a sine; its
 * purr a train of soft clicks, so noise chopped into pulses through a nose's
 * resonance; its bark a burst of breath through a big chest, low noise with a
 * short low tone under it, between 120 and 300 Hz where a small speaker still
 * plays it. Water is noise for a splash and a slosh, and a sine whose pitch
 * leaps up for each bubble of a glug and each drip, which is what a bubble's
 * ring does as it closes; the bigger the vessel, the lower its glug.
 *
 * Every cue lands where its picture does (`./wild-capy`): the strike on
 * `CAPY_HITS`; the splash as it goes into the water, the glugs as it fills,
 * the water running off it and the shake of its head on `CAPY_WORK`; and the
 * evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.42][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Pailbara's: two soft whistling chirps, rising, round 1300 Hz. The Caskybara's: a contented purr,
 * a dozen soft clicks through the nose round 700 Hz, a low hum under them. The Reservara's: a gruff huff of a bark, a burst of
 * breath through a chest resonance round 200 Hz, a short low tone under it, and a click of its teeth after.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1300 * b.pitch;
    ring(ctx, dest, at, { freq: f * 0.82, to: f * 1.18, dur: 0.11, gain: 0.16 * k, type: 'sine', attack: 0.015 });
    ring(ctx, dest, at + 0.15, { freq: f * 0.9, to: f * 1.32, dur: 0.14, gain: 0.15 * k, type: 'sine', attack: 0.015 });
    burst(ctx, dest, at, { dur: 0.08, freq: 2600 * b.pitch, q: 2, gain: 0.03 * k, attack: 0.01 });
    return;
  }
  if (b.s === 1) {
    const n = 11;
    for (let q = 0; q < n; q++) {
      const t = at + q * (0.045 + 0.006 * v);
      burst(ctx, dest, t, { dur: 0.025, freq: 1050 * b.pitch * (1 - 0.01 * q), q: 3.2, gain: (0.13 - 0.005 * q) * k, attack: 0.002 });
    }
    ring(ctx, dest, at, { freq: 150, to: 130, dur: n * 0.05, gain: 0.07 * k, type: 'triangle', attack: 0.04 });
    return;
  }
  burst(ctx, dest, at, { dur: 0.24, freq: 480 * b.pitch * 1.4, to: 220, q: 1.1, gain: 0.32 * k, attack: 0.012 });
  burst(ctx, dest, at, { dur: 0.18, freq: 200, to: 140, q: 2.6, gain: 0.24 * k, attack: 0.01 });
  ring(ctx, dest, at + 0.01, { freq: 118, to: 84, dur: 0.26, gain: 0.2 * k, type: 'triangle', attack: 0.015 });
  burst(ctx, dest, at + 0.3, { dur: 0.02, freq: 2400, q: 3, gain: 0.08 * k, attack: 0.001 });
}

/** Water struck or gone into: a splash of noise falling away, bigger and lower for a bigger body. */
function splash(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.22 + 0.2 * heavy, freq: 2200 - 800 * heavy, to: 380, q: 0.6, gain: 0.3 * k, attack: 0.005 });
  burst(ctx, dest, at + 0.04, { dur: 0.16, freq: 3600, to: 1800, q: 1.2, gain: 0.08 * k, attack: 0.01 });
  ring(ctx, dest, at, { freq: 140 - 50 * heavy, to: 70, dur: 0.12 + 0.1 * heavy, gain: 0.12 * k * heavy, type: 'sine', attack: 0.004 });
}

/** A bubble closing: a sine leaping up in pitch, short; a drip is a small high one, a glug a low one. */
function bubble(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.7, dur: 0.05, gain: 0.12 * k, type: 'sine', attack: 0.003 });
}

/** Water swung in what it carries: a soft wash of noise rising and falling. */
function slosh(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 900 * pitch, to: 520 * pitch, q: 0.8, gain: 0.12 * k, attack: dur * 0.4 });
}

/** A body coming down on the ground: a low thump, softened, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [210, 130, 80][s], to: [110, 66, 40][s], dur: [0.1, 0.18, 0.34][s], gain: [0.3, 0.42, 0.58][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * s, freq: 700, to: 160, q: 0.8, gain: (0.16 + 0.07 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * A strike. The Pailbara chirps as it springs and butts with a soft thump, its pail sloshing. The Caskybara huffs as it drives
 * forward and shoves with a heavy thump, its buckets swinging and sloshing. The Reservara barks as it rears and stamps down with a
 * deep thump that throws the water up out of its casks in a splash.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.15, 0.95][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + CAPY_HITS[s] * T;
  if (s === 0) call(ctx, out, at + 0.04, 0, v, 0.7);
  else burst(ctx, out, hit - 0.14, { dur: 0.12, freq: 500 * b.pitch * 2, to: 260, q: 0.9, gain: 0.16, attack: 0.03 });
  if (s === 2) call(ctx, out, at + 0.06, 2, v, 0.8);
  thump(ctx, out, hit, s, 1);
  slosh(ctx, out, hit + 0.02, 0.22 + 0.08 * s, b.pitch, 0.9 + 0.3 * s);
  if (s === 2) splash(ctx, out, hit + 0.05, b.heavy, 0.8);
};

/**
 * A go at its task: a splash as it lands in the water, glugs as what it carries fills -- each lower than the last as it fills, and
 * lower for a bigger vessel -- a slosh as it rocks, water running off it as it comes up, a patter of drips, its head shaken, and its
 * call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.5, 1.6][s]), b = bodyOf(stage, v), W = CAPY_WORK, T = ACT_SECS.work;
  splash(ctx, out, at + W.under * T - 0.03, b.heavy * 0.7, 0.8);
  const glugs = 5 + s;
  for (let q = 0; q < glugs; q++) {
    const u = q / (glugs - 1), when = at + (W.fill[0] + (W.fill[1] - W.fill[0]) * u) * T + 0.012 * Math.sin(q * 3 + v);
    bubble(ctx, out, when, (520 - 140 * u) * b.pitch, 0.9);
  }
  slosh(ctx, out, at + (W.fill[0] + 0.06) * T, (W.fill[1] - W.fill[0]) * T * 0.8, b.pitch, 0.8);
  burst(ctx, out, at + (W.fill[1] + 0.02) * T, { dur: (W.rise - W.fill[1]) * T, freq: 2600, to: 1200, q: 0.7, gain: 0.08, attack: 0.04 });
  for (let q = 0; q < 3; q++) bubble(ctx, out, at + (W.rise + 0.03 + q * 0.05) * T, 1900 + 400 * q, 0.5);
  burst(ctx, out, at + W.shake * T, { dur: 0.12, freq: 3200, to: 1500, q: 0.8, gain: 0.07, attack: 0.01 });
  if (v > 0.5) call(ctx, out, at + 0.95 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: drips falling faster and higher as the water and leaves swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the chirp,
 * the purr or the bark of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  splash(ctx, dest, at + 0.02, 0.3, 0.5);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 400 * key, to: 1200 * key, q: 1.2, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    bubble(ctx, dest, when, (900 + 900 * u) * key, 0.35 + 0.35 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const CAPY_VOICE: Voice = { strike, work, evolve };
