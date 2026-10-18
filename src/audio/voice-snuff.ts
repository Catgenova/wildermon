import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Snufflet's voice, and its stages' (the species is `rabba`): a pig's
 * grunt and squeal, a snuffling nose, and the rustle of the leaves it
 * wears. A grunt is a buzz -- a sawtooth sliding in pitch -- put through
 * three resonances of a snout, with a burr in it; a sniff is noise through a
 * narrow band, rising as it comes in. A bigger stage is a lower buzz and
 * lower resonances, longer, with an octave under it.
 */

/** A voiced sound: a buzz through a snout's resonances under an envelope, with a burr (a flutter in its loudness) in it. */
interface Voiced {
  /** The pitch through it, evenly spaced from start to end. */
  f: readonly number[];
  dur: number;
  gain: number;
  /** Each resonance: where it is, how narrow, and how loud. */
  formants: ReadonlyArray<readonly [number, number, number]>;
  /** How fast the burr flutters, and how deep. */
  burr?: readonly [number, number];
  attack?: number;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  if (o.burr) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.burr[0];
    depth.gain.value = o.burr[1] * 0.5;
    flutter.gain.value = 1 - o.burr[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.018;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.45));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(flutter);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    flutter.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** How a stage sounds: how far down its buzz is, how far down its resonances (a bigger snout), how long it draws a sound out, and how much octave is under it. */
function bodyOf(stage: number, v: number): { pitch: number; snout: number; long: number; under: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.78, 0.6][s] * (0.94 + 0.12 * v), snout: [1, 0.86, 0.74][s], long: 1 + 0.15 * s, under: [0, 0.35, 0.6][s] };
}

/** A grunt: a short nasal buzz, its pitch lifting and falling, `k` loud; with an octave under it on a bigger body. */
function grunt(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, lift = 1.18): void {
  const b = bodyOf(stage, v), f = 150 * b.pitch, dur = 0.2 * b.long;
  const formants = [[380 * b.snout, 3, 1], [1000 * b.snout, 5, 0.6], [2400 * b.snout, 6, 0.22]] as const;
  voiced(ctx, dest, at, { f: [f, f * lift, f * 0.82], dur, gain: 0.5 * k, formants, burr: [30 + 10 * v, 0.6] });
  if (b.under) voiced(ctx, dest, at, { f: [f / 2, (f * lift) / 2, (f * 0.82) / 2], dur: dur * 1.1, gain: 0.5 * k * b.under, formants: [[260 * b.snout, 2, 1], [700 * b.snout, 3, 0.5]], burr: [24, 0.5] });
}

/** A squeal: a high bright buzz going up and coming down, short. */
function squeal(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 620 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.8, f * 1.45, f * 1.3, f * 0.9], dur: 0.22 * b.long, gain: 0.42 * k,
    formants: [[1150 * b.snout, 4, 1], [2500 * b.snout, 5, 0.5], [3700 * b.snout, 6, 0.18]], burr: [52, 0.3], attack: 0.012,
  });
}

/** A sniff: air drawn in through the nose, a narrow band of noise rising as it comes. */
const sniff = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void => {
  const b = bodyOf(stage, v);
  burst(ctx, dest, at, { dur: 0.075, freq: 2600 * b.snout + v * 300, to: 3600 * b.snout, q: 2.4, gain: 0.3 * k, attack: 0.03 });
};

/** A snort: air blown out hard through the nose, falling, with a little grunt in it. */
function snort(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  burst(ctx, dest, at, { dur: 0.12 * b.long, freq: 1500 * b.snout, to: 520 * b.snout, q: 1.1, gain: 0.32 * k, attack: 0.006 });
  voiced(ctx, dest, at, { f: [110 * b.pitch, 90 * b.pitch], dur: 0.1 * b.long, gain: 0.22 * k, formants: [[420 * b.snout, 2.5, 1], [1100 * b.snout, 4, 0.4]], burr: [28, 0.7] });
}

/** The leaves it wears, shaken: a scatter of tiny dry ticks high up, over a soft hush. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 4200 + v * 600, to: 3000, q: 0.6, gain: 0.08 * k, attack: len * 0.35 });
  for (let q = 0; q < 7; q++) {
    const when = at + len * ((q + 0.3 * Math.sin(q * 3.7 + v * 5)) / 7);
    burst(ctx, dest, Math.max(at, when), { dur: 0.025 + 0.015 * (q % 3), freq: 5200 + 900 * Math.sin(q * 2.1 + v), q: 1.4, gain: 0.11 * k, type: 'highpass' });
  }
}

/** A blow landing: a low thud that drops, and the dull knock of it. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void {
  const b = bodyOf(stage, v);
  ring(ctx, dest, at, { freq: 120 * b.snout, to: 48 * b.snout, dur: 0.2 * b.long, gain: 0.38, type: 'sine' });
  burst(ctx, dest, at, { dur: 0.09, freq: 420 * b.snout, to: 160, q: 0.7, gain: 0.34, type: 'lowpass', attack: 0.002 });
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * A strike: a snort as it gathers itself, then a squealing grunt as it
 * throws itself forward and the thump of the snout going in just over a
 * quarter of a second on, when the blow lands in its picture; the
 * Snuffthorn's ends in a deep grunt as it hooks its tusk up.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.15);
  snort(ctx, out, at + 0.02, stage, v, 0.7);
  squeal(ctx, out, at + 0.17, stage, v, 1);
  grunt(ctx, out, at + 0.24, stage, v, 0.8, 1.3);
  thump(ctx, out, at + 0.29, stage, v);
  rustle(ctx, out, at + 0.3, 0.3, v, 0.8);
  if (stage >= 2) grunt(ctx, out, at + 0.38, stage, v, 0.8, 1.45);
};

/**
 * A go at its task, rooting: three quick sniffs, a snort into the ground and
 * the earth turned, a soft contented grunt, another snort and the earth
 * thrown up, and the leaves of its mane rustling with it, each where its
 * picture flicks the snout up; all inside the second a rooting go takes.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 2.6);
  for (let q = 0; q < 3; q++) sniff(ctx, dest, at + q * (0.095 + 0.01 * v), stage, v, 0.75 - 0.1 * q);
  snort(ctx, dest, at + 0.33, stage, v, 0.6);
  burst(ctx, dest, at + 0.37, { dur: 0.16, freq: 520, to: 200, q: 0.6, gain: 0.22, attack: 0.004 });
  grunt(ctx, dest, at + 0.52, stage, v, 0.32, 1.08);
  sniff(ctx, dest, at + 0.7, stage, v, 0.5);
  snort(ctx, dest, at + 0.84, stage, v, 0.45);
  burst(ctx, dest, at + 0.88, { dur: 0.14, freq: 560, to: 220, q: 0.6, gain: 0.18, attack: 0.004 });
  rustle(ctx, dest, at + 0.4, 0.55, v, 0.6);
};

/**
 * Evolving: a bright chime climbing five notes, over a rising shimmer of
 * leaves, a sparkle at the top, and then a happy double grunt; a bigger
 * stage's grunt deeper, and its chime with a low note under it.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 2.3);
  const notes = [784, 988, 1175, 1568, 1976];
  const bell = [[1, 0.7], [2, 0.2], [3.01, 0.08]] as const;
  notes.forEach((f, q) => ring(ctx, dest, at + q * 0.085, { freq: f, dur: 0.55 - q * 0.04, gain: 0.13, type: 'triangle', partials: bell }));
  if (stage > 0) ring(ctx, dest, at, { freq: 392 / (stage > 1 ? 2 : 1), dur: 0.9, gain: 0.12, type: 'sine', attack: 0.08, partials: [[1, 0.8], [2, 0.2]] });
  burst(ctx, dest, at + 0.05, { dur: 0.7, freq: 2200, to: 6800, q: 1.3, gain: 0.12, attack: 0.35 });
  ring(ctx, dest, at + 0.46, { freq: 3136, dur: 0.35, gain: 0.05, type: 'sine', partials: [[1, 0.6], [1.5, 0.4]] });
  grunt(ctx, dest, at + 0.78, stage, v, 0.5, 1.35);
  grunt(ctx, dest, at + 1.0, stage, v, 0.45, 1.5);
};

export const SNUFF_VOICE: Voice = { strike, work, evolve };
