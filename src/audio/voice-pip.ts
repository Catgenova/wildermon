import { ACT_SECS } from '../render/beasts';
import { PIP_HITS, PIP_WORK } from '../render/wild-pip';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pipseed's voice, and its stages' (the species is `sappa`): a chick's
 * bright cheep, a warbling two-note trill, and a raptor's long ringing cry,
 * over the dry rustle of the leaves they are feathered in and the soil they
 * plant into.
 *
 * A bird's note is a sine gliding fast in pitch with a little of its octave
 * over it; a trill is the same note shaken in pitch many times a second. The
 * smaller the bird, the higher and shorter: the Pipseed round 4 kHz, the
 * Sprigwing round 2.5 kHz, the Arborcrest's cry falling from 1.6 kHz with a
 * rasp of noise through it. A rustle is a run of short bright noise bursts,
 * each a dry leaf turning over; soil is a low dull burst.
 *
 * Every cue lands where its picture does (`./wild-pip`): the blow on
 * `PIP_HITS`; the push, the two taps and the taking up of the next on
 * `PIP_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** A note: the pitch through it, how long, how loud, how much octave over it, and how fast and deep a trill shakes it. */
interface Note { f: readonly number[]; dur: number; gain: number; over?: number; trill?: readonly [number, number]; attack?: number }

function note(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Note): void {
  const env = ctx.createGain();
  const rise = o.attack ?? 0.008;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.45));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  env.connect(dest);
  const lfo = o.trill ? ctx.createOscillator() : null;
  if (lfo && o.trill) {
    lfo.frequency.value = o.trill[0];
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  for (const [mul, share] of [[1, 1], [2, o.over ?? 0.12]] as const) {
    if (share <= 0) continue;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    o.f.forEach((f, i) => {
      const t = at + (o.dur * 0.85 * i) / Math.max(1, o.f.length - 1);
      if (i === 0) osc.frequency.setValueAtTime(f * mul, t);
      else osc.frequency.exponentialRampToValueAtTime(f * mul, t);
    });
    if (lfo && o.trill) {
      const depth = ctx.createGain();
      depth.gain.value = o.f[0] * mul * o.trill[1];
      lfo.connect(depth).connect(osc.frequency);
    }
    const g = ctx.createGain();
    g.gain.value = share;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + o.dur + 0.05);
  }
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

const stageOf = (stage: number): number => Math.max(0, Math.min(2, stage));

/**
 * Its own call, by stage. The Pipseed: two quick rising cheeps round 4 kHz. The Sprigwing: a two-note warble, the second trilled,
 * round 2.5 kHz. The Arborcrest: a long cry falling from 1.6 kHz to 1.1, a rasp of noise through its start, and a short second
 * note after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 3900 * p;
    note(ctx, dest, at, { f: [f * 0.82, f * 1.08, f], dur: 0.07, gain: 0.32 * k });
    note(ctx, dest, at + 0.11, { f: [f * 0.88, f * 1.16, f * 1.05], dur: 0.08, gain: 0.3 * k });
    return;
  }
  if (s === 1) {
    const f = 2450 * p;
    note(ctx, dest, at, { f: [f, f * 1.18, f * 1.1], dur: 0.12, gain: 0.28 * k, over: 0.18 });
    note(ctx, dest, at + 0.15, { f: [f * 1.2, f * 1.05, f * 0.92], dur: 0.26, gain: 0.26 * k, over: 0.16, trill: [24 + 4 * v, 0.06] });
    return;
  }
  const f = 1600 * p;
  note(ctx, dest, at, { f: [f * 0.92, f, f * 0.84, f * 0.7], dur: 0.62, gain: 0.26 * k, over: 0.3, trill: [9, 0.025], attack: 0.03 });
  burst(ctx, dest, at, { dur: 0.22, freq: 2600 * p, to: 1700 * p, q: 3, gain: 0.07 * k, attack: 0.02 });
  note(ctx, dest, at + 0.7, { f: [f * 0.8, f * 0.86, f * 0.72], dur: 0.2, gain: 0.16 * k, over: 0.25 });
}

/** Leaves rustling: a run of short dry bursts of bright noise, `n` of them over `dur`, lower for bigger leaves. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const u = (q + 0.6 * Math.abs(Math.sin(q * 2.3 + v * 7))) / n;
    burst(ctx, dest, at + dur * u, { dur: 0.03 + 0.02 * Math.abs(Math.sin(q * 1.7)), freq: (3400 + 1600 * Math.sin(q * 2.9 + v)) * pitch, q: 1.6, gain: 0.07 * k, attack: 0.003 });
  }
}

/** A wingbeat: air pushed through a fan of leaves, a swell of low noise under a rustle. */
function beatOf(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 500 * pitch, to: 1300 * pitch, q: 0.8, gain: 0.13 * k, attack: len * 0.6 });
  rustle(ctx, dest, at, len, 5, pitch, v, 0.8 * k);
}

/** A hard little knock: a beak, or an acorn held in one, on something. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 1300 * pitch, to: 900 * pitch, dur: 0.05, gain: 0.3 * k, type: 'triangle', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.03, freq: 2600 * pitch, q: 2, gain: 0.14 * k, attack: 0.001 });
}

/** Soil pushed into or patted down: a dull low burst, and a few crumbs falling. */
function soil(ctx: BaseAudioContext, dest: AudioNode, at: number, big: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07 + 0.04 * big, freq: 420 / (0.8 + 0.3 * big), to: 180, q: 0.9, gain: 0.22 * k, type: 'lowpass', attack: 0.004 });
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + 0.04 + q * 0.035, { dur: 0.02, freq: 1800 - q * 300, q: 2, gain: 0.05 * k, attack: 0.002 });
}

/**
 * A strike. The Pipseed cheeps, flutters and knocks its acorn on what it pecks. The Sprigwing trills, rattles its leaves as it draws
 * up, and its long beak lands with a sharp knock. The Arborcrest cries as it lifts its wings, beats them down into the blow with a
 * heavy rush of air and leaves, and its beak strikes.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.3, 1.15, 1.0][s]), T = ACT_SECS.strike, hit = at + PIP_HITS[s] * T;
  const pitch = [1.2, 1, 0.7][s];
  call(ctx, out, at + 0.01, s, v, 0.55);
  rustle(ctx, out, at + 0.04, 0.16, 4 + s, pitch, v, 0.8);
  if (s === 2) beatOf(ctx, out, hit - 0.14, 0.18, pitch, v, 1.4);
  else burst(ctx, out, hit - 0.08, { dur: 0.08, freq: 900 * pitch, to: 2600 * pitch, q: 0.9, gain: 0.1, attack: 0.06 });
  knock(ctx, out, hit, [0.8, 1.1, 0.75][s], 1);
  rustle(ctx, out, hit + 0.01, 0.2, 5, pitch, v + 0.3, 0.7);
};

/**
 * A go at its task: leaves rustling as it bows, the soil as what it carries is pushed in, two soft pats, the rustle as it takes up the
 * next, and its call, softly, as it straightens.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.95, 1.8, 1.65][s]), W = PIP_WORK, T = ACT_SECS.work, pitch = [1.2, 1, 0.75][s];
  rustle(ctx, out, at + W.down[0] * T, (W.down[1] - W.down[0]) * T, 3, pitch, v, 0.6);
  soil(ctx, out, at + (W.set - 0.03) * T, s, 1);
  W.tamps.forEach((tp, q) => soil(ctx, out, at + tp * T, s * 0.5, 0.55 - 0.1 * q));
  rustle(ctx, out, at + (W.take - 0.04) * T, 0.12, 3, pitch * 1.1, v + 0.5, 0.7);
  call(ctx, out, at + (W.up - 0.02) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a whirl of leaves rustling faster and higher to the flash at its middle, where a clear
 * chime rings over a warm swell -- each stage's lower than the last -- and then its own call, the cheep, the trill or the cry of
 * what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.35);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 3200 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 14; q++) {
    const u = q / 14, when = at + 0.15 + (flash - 0.2) * (1 - (1 - u) ** 1.5);
    burst(ctx, dest, when, { dur: 0.035, freq: (2400 + 2200 * u) * key, q: 1.8, gain: 0.05 + 0.05 * u, attack: 0.003 });
  }
  [523, 659, 784].forEach((f, q) => ring(ctx, dest, at + 0.45 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.05, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 2093 * key, dur: 0.5, gain: 0.045, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [523, 659, 784]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.045, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 130 - 15 * s, to: 70 - 8 * s, dur: 0.4, gain: 0.16, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const PIP_VOICE: Voice = { strike, work, evolve };
