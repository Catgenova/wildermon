import { ACT_SECS } from '../render/beasts';
import { MOTH_HITS, MOTH_WORK } from '../render/wild-moth';
import { burst, noiseBuffer, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Glimmoth's voice, and its stages' (the species is `wicka`): a moth. It
 * has no call of its own but its wings and its light: a soft hum of wingbeats
 * -- a breath of air, low and lowpassed, its loudness chopped at the rate the
 * wings beat, so it flutters -- and a chime, a little glass bell for the
 * lantern it carries in its belly. The Glimmoth's wings are quick and its
 * chime high and small; the Lurewing's slower, a two-note chime; the
 * Noctilure's slow and deep, a chord of three that rings a long time.
 *
 * Its strike is a buffet: the wings drawn up in a rising hum, brought down in
 * a whoosh with a soft dusty thud at `MOTH_HITS`, and a scatter of tiny
 * ticks as its scale dust settles. A go at its task is a flutter, the scratch
 * of a wick catching at `MOTH_WORK.catch` with a chime over it, and a clink of
 * the lantern's glass at `MOTH_WORK.place`. Evolving, chimes climb faster and
 * higher to the flash at the middle of the act, where its chord rings.
 */

/** How a stage sounds: how far down its chime is, how fast its wings beat, how long things ring. */
function bodyOf(stage: number, v: number): { pitch: number; beat: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.75, 0.5][s] * (0.97 + 0.06 * v), beat: [22, 15, 10][s] * (0.95 + 0.1 * v), long: [1, 1.5, 2.2][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Wingbeats: air through a low band and a lowpass, its loudness chopped `beat` times a second, swelling in and dying away over
 * `dur`; the band sweeps from `f` to `to`.
 */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { dur: number; beat: number; f: number; to?: number; gain: number; rise?: number }): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(o.f, at);
  if (o.to !== undefined) band.frequency.exponentialRampToValueAtTime(o.to, at + o.dur);
  band.Q.value = 1.4;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  // The chop: a sine on the loudness, full down to a fifth, once a beat.
  const chop = ctx.createGain();
  chop.gain.value = 0.6;
  const lfo = ctx.createOscillator(), amount = ctx.createGain();
  lfo.frequency.value = o.beat;
  amount.gain.value = 0.4;
  lfo.connect(amount).connect(chop.gain);
  const env = ctx.createGain();
  const rise = Math.max(0.02, o.rise ?? o.dur * 0.3);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.6));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  src.connect(band).connect(lp).connect(chop).connect(env).connect(dest);
  src.start(at, (at * 5.17) % 0.9);
  src.stop(at + o.dur + 0.03);
  lfo.start(at);
  lfo.stop(at + o.dur + 0.03);
}

/** A little glass bell: a sine with its bright partials, rung softly so it does not click. */
function chime(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, gain: number): void {
  ring(ctx, dest, at, { freq: f, dur, gain, type: 'sine', attack: 0.006, partials: [[1, 0.7], [2.76, 0.18], [5.4, 0.06]] });
}

/** Its chime, by stage: one high note; two, a third apart; a chord of three, low and long. */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 1568 * b.pitch;
  if (b.s === 0) {
    chime(ctx, dest, at, f, 0.45, 0.16 * k);
    return;
  }
  if (b.s === 1) {
    chime(ctx, dest, at, f, 0.6, 0.13 * k);
    chime(ctx, dest, at + 0.09, f * 1.26, 0.6, 0.11 * k);
    return;
  }
  [1, 1.26, 1.5].forEach((m, q) => chime(ctx, dest, at + q * 0.07, f * m, 0.95, 0.1 * k));
}

/**
 * A strike: its wings drawn up in a rising hum, then down in a whoosh of air and a soft dusty thud at the blow, and the dust
 * settling in a scatter of tiny ticks.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [2.1, 1.9, 1.75][b.s]), T = ACT_SECS.strike, hit = at + MOTH_HITS[b.s] * T;
  hum(ctx, out, at, { dur: hit - at + 0.08, beat: b.beat * 1.3, f: 220 * b.pitch, to: 420 * b.pitch, gain: 0.32, rise: (hit - at) * 0.8 });
  burst(ctx, out, hit - 0.1, { dur: 0.16, freq: 700 * b.pitch, to: 260 * b.pitch, q: 0.8, gain: 0.22, attack: 0.08 });
  ring(ctx, out, hit, { freq: [180, 130, 92][b.s], to: [110, 80, 56][b.s], dur: 0.12 + 0.05 * b.s, gain: 0.24, type: 'sine', attack: 0.004 });
  burst(ctx, out, hit, { dur: 0.1 + 0.04 * b.s, freq: 520, to: 200, q: 0.7, gain: 0.16, type: 'lowpass', attack: 0.004 });
  for (let q = 0; q < 5; q++) {
    const when = hit + 0.05 + q * 0.035 + 0.012 * Math.sin(q * 3.7 + v * 9);
    ring(ctx, out, when, { freq: (2600 + 500 * Math.abs(Math.sin(q * 2.1 + v))) * b.pitch, dur: 0.03, gain: 0.04 * (1 - q * 0.15), type: 'sine', attack: 0.002 });
  }
  bell(ctx, out, hit + 0.04, b.s, v, 0.35);
};

/**
 * A go at its task: its wings humming as it holds the candle up, the scratch of the wick catching and a chime over it as its
 * lantern lights it, and the lantern's glass clinking as it puts the candle in.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [2.6, 2.6, 2.5][b.s]), T = ACT_SECS.work, W = MOTH_WORK;
  hum(ctx, out, at, { dur: T * 0.95, beat: b.beat, f: 200 * b.pitch, to: 240 * b.pitch, gain: 0.16, rise: 0.15 });
  const lit = at + W.catch * T;
  burst(ctx, out, lit - 0.05, { dur: 0.09, freq: 3200, to: 1800, q: 1.2, gain: 0.12, attack: 0.004 });
  burst(ctx, out, lit, { dur: 0.22, freq: 900, to: 500, q: 0.8, gain: 0.08, attack: 0.03 });
  bell(ctx, out, lit + 0.02, b.s, v, 0.6);
  const put = at + W.place * T;
  ring(ctx, out, put, { freq: 2900 * (0.95 + 0.1 * v), dur: 0.08, gain: 0.07, type: 'sine', attack: 0.002, partials: [[1, 0.8], [2.4, 0.2]] });
  ring(ctx, out, put + 0.05, { freq: 3500 * (0.95 + 0.1 * v), dur: 0.06, gain: 0.05, type: 'sine', attack: 0.002 });
};

/**
 * Evolving, a cue the length of the act: its wings humming up as they fold, chimes climbing faster and higher as the light
 * gathers, to the flash at its middle, where its chord rings over a soft low swell -- each stage's lower than the last -- and
 * then the chime of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 2.1);
  const b = bodyOf(stage, v), key = [1, 0.84, 0.7][b.s], flash = 0.5 * ACT_SECS.evolve;
  hum(ctx, dest, at, { dur: flash + 0.1, beat: b.beat, f: 180 * key, to: 520 * key, gain: 0.18, rise: flash * 0.8 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    chime(ctx, dest, when, (1046 + 1046 * u) * key, 0.18, 0.03 + 0.04 * u);
  }
  [523, 659, 784].forEach((f) => chime(ctx, dest, at + flash, f * key, 1.0, 0.07));
  chime(ctx, dest, at + flash, 2093 * key, 0.6, 0.05);
  ring(ctx, dest, at + flash, { freq: 110 - 15 * b.s, to: 70 - 10 * b.s, dur: 0.5, gain: 0.16, type: 'sine', attack: 0.02 });
  bell(ctx, dest, at + flash + 0.4, b.s, v, 0.8);
};

export const MOTH_VOICE: Voice = { strike, work, evolve };
