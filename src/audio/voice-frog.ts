import { ACT_SECS } from '../render/beasts';
import { FROG_HITS, FROG_STRIKE, FROG_WORK } from '../render/wild-frog';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Puddlehop's voice, and its stages' (the species is `holla`): a small
 * bright ribbit, a throaty two-beat croak, and a bullfrog's deep boom, over
 * the water they carry -- a slosh, a glug, a drip, a pour.
 *
 * A croak is a buzz through a throat's resonances whose loudness is chopped
 * into pulses: a frog's call is a train of clicks from its vocal cords, so
 * the chop is what makes it a ribbit rather than a hum. The smaller the frog,
 * the higher the buzz and the faster the pulses; the Aquavoyager's boom is a
 * slow-pulsed low buzz swelled through a big chest, its energy put between
 * 150 and 300 Hz where a small speaker still plays it. Water is noise for a
 * slosh and a pour, and a sine whose pitch leaps up for each bubble of a glug
 * and each drip, which is what a bubble's ring does as it closes.
 *
 * Every cue lands where its picture does (`./wild-frog`): the strike on
 * `FROG_HITS`, the tongue's flick out from `FROG_STRIKE.open` and the
 * Aquavoyager's stamp on `FROG_STRIKE.stamp`; each gulp, the tip and the pour
 * of a go at its task on `FROG_WORK`; and the evolving chime on the flash at
 * the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, chopped into pulses `pulse` times a second, through a throat's resonances. */
interface Croak {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  /** Pulses a second, and how deep the chop is (nought to one). */
  pulse: number;
  depth: number;
  attack?: number;
  type?: OscillatorType;
}

function croak(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Croak): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  // The chop: a square wave on the loudness, from full down by `depth`.
  const chop = ctx.createGain();
  chop.gain.value = 1 - o.depth * 0.5;
  const lfo = ctx.createOscillator(), amount = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.value = o.pulse;
  amount.gain.value = o.depth * 0.5;
  lfo.connect(amount).connect(chop.gain);
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.5));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(chop);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    chop.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  for (const n of [osc, lfo]) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** How a stage sounds: how far down its voice is, how much water it slops about, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; water: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), water: [1, 0.75, 0.55][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Puddlehop's ribbit: two quick bright pulsed chirps, the second higher, round 600 Hz. The
 * Springcarrier's croak: a throaty "rrr-up", round 220 Hz in quick pulses, falling and lifting. The Aquavoyager's boom: a bullfrog's
 * deep "jug-o-rum", round 95 Hz in slow pulses, swelled through a chest resonance between 150 and 300 Hz, a low hum under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 600 * b.pitch;
    croak(ctx, dest, at, { f: [f * 0.9, f * 1.05, f], dur: 0.075, gain: 0.85 * k, formants: [[1300, 3, 1], [2600, 4, 0.45]], pulse: 70, depth: 0.7, type: 'triangle' });
    croak(ctx, dest, at + 0.11, { f: [f, f * 1.25, f * 1.1], dur: 0.1, gain: 0.85 * k, formants: [[1500, 3, 1], [2900, 4, 0.45]], pulse: 70, depth: 0.7, type: 'triangle' });
    return;
  }
  if (b.s === 1) {
    const f = 360 * b.pitch;
    croak(ctx, dest, at, { f: [f * 1.05, f * 0.85, f * 0.9], dur: 0.2, gain: 0.5 * k, formants: [[300, 2.5, 0.9], [700, 2.5, 1], [1500, 4, 0.35]], pulse: 42 + 6 * v, depth: 0.8 });
    croak(ctx, dest, at + 0.24, { f: [f * 0.95, f * 1.2, f * 1.1], dur: 0.12, gain: 0.42 * k, formants: [[320, 2.5, 0.9], [760, 2.5, 1], [1600, 4, 0.3]], pulse: 42 + 6 * v, depth: 0.8 });
    return;
  }
  const f = 240 * b.pitch;
  croak(ctx, dest, at, { f: [f * 0.9, f * 1.06, f * 0.98, f * 0.82], dur: 0.62, gain: 0.23 * k, formants: [[110, 2, 0.6], [190, 3, 1.5], [270, 3.5, 1.2], [520, 3, 0.4], [1100, 4, 0.08]], pulse: 17 + 3 * v, depth: 0.55, attack: 0.05 });
  ring(ctx, dest, at + 0.03, { freq: f * 0.5, to: f * 0.42, dur: 0.58, gain: 0.09 * k, type: 'sine', attack: 0.05 });
}

/** Water slopping in a bladder: a wash of noise rising and falling, bright at the top of the slop. */
function slosh(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 380 * pitch, to: 900 * pitch, q: 1.6, gain: 0.16 * k, attack: dur * 0.4 });
  burst(ctx, dest, at + dur * 0.35, { dur: dur * 0.8, freq: 1100 * pitch, to: 520 * pitch, q: 2.4, gain: 0.09 * k, attack: dur * 0.25 });
}

/** A glug: a bubble or two closing, each a sine leaping up in pitch as it dies. */
function glug(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 190 * pitch, to: 420 * pitch, dur: 0.07, gain: 0.32 * k, type: 'sine', attack: 0.004 });
  ring(ctx, dest, at + 0.045, { freq: 260 * pitch, to: 560 * pitch, dur: 0.05, gain: 0.2 * k, type: 'sine', attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.06, freq: 500 * pitch, q: 2, gain: 0.08 * k, attack: 0.004 });
}

/** A drip: one small bright bubble's ring, leaping up. */
function drip(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 1100 * pitch, to: 2300 * pitch, dur: 0.04, gain: 0.16 * k, type: 'sine', attack: 0.002 });
}

/** Water poured into a bucket: a hiss of noise for `dur`, with bubbles gulping in it, rising in pitch as the bucket fills. */
function pour(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 1500 * pitch, to: 2300 * pitch, q: 0.9, gain: 0.11 * k, attack: 0.04 });
  burst(ctx, dest, at, { dur, freq: 420 * pitch, to: 640 * pitch, q: 1.4, gain: 0.08 * k, attack: 0.05 });
  const n = Math.round(dur * 16);
  for (let q = 0; q < n; q++) {
    const u = (q + 0.5 * Math.abs(Math.sin(q * 3.1 + v * 5))) / n;
    ring(ctx, dest, at + dur * u, { freq: (380 + 300 * u) * pitch * (0.85 + 0.3 * Math.abs(Math.sin(q * 1.7 + v))), to: (700 + 500 * u) * pitch, dur: 0.035, gain: 0.07 * k, type: 'sine', attack: 0.003 });
  }
}

/** A splash: water thrown about, a burst of bright noise and drops pattering after it. */
function splash(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.22, freq: 2400 * pitch, to: 900 * pitch, q: 0.7, gain: 0.2 * k, attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.16, freq: 600 * pitch, to: 300 * pitch, q: 1, gain: 0.14 * k, attack: 0.004 });
  for (let q = 0; q < 4; q++) drip(ctx, dest, at + 0.06 + q * 0.05 + 0.02 * Math.sin(q * 4 + v * 9), pitch * (0.8 + 0.3 * Math.abs(Math.sin(q * 2.3 + v))), k * (0.7 - 0.12 * q));
}

/** A heavy wet body coming down on the ground: a low thump, softened. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [210, 140, 92][s], to: [110, 70, 44][s], dur: [0.1, 0.18, 0.32][s], gain: [0.3, 0.42, 0.5][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.08 * s, freq: 700, to: 180, q: 0.8, gain: (0.16 + 0.06 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** A swish through the air before a blow, lower and longer for a bigger body. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 600 * pitch, to: 1900 * pitch, q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/**
 * A strike. The Puddlehop ribbits, and its tongue flicks out with a thin wet whip and lands with a sticky pop. The Springcarrier
 * croaks as it rears, its bladders slop, and it comes down on its belly with a wet thump and a splash. The Aquavoyager booms as
 * it winds round, its bladders swing through the air with a heavy slosh, the blow lands with a splash and its hand stamps down.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.42, 1.1, 0.85][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + FROG_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + 0.01, 0, v, 0.55);
    const open = at + FROG_STRIKE.open * T;
    burst(ctx, out, open, { dur: hit - open + 0.01, freq: 1800, to: 4200, q: 2, gain: 0.14, attack: (hit - open) * 0.7 });
    ring(ctx, out, hit, { freq: 520, to: 260, dur: 0.06, gain: 0.34, type: 'sine', attack: 0.002 });
    burst(ctx, out, hit, { dur: 0.05, freq: 1600, q: 1.5, gain: 0.2, attack: 0.002 });
    glug(ctx, out, at + FROG_STRIKE.back * T, 1.4, 0.5);
    return;
  }
  call(ctx, out, at + 0.02, s, v, 0.6);
  slosh(ctx, out, at + 0.12, 0.2, b.water, 0.6);
  swish(ctx, out, hit - 0.12, 0.12, b.pitch, 1);
  thump(ctx, out, hit, s, 1);
  splash(ctx, out, hit + 0.01, b.water, v, 0.9);
  slosh(ctx, out, hit + 0.03, 0.26, b.water, 0.8);
  if (s === 2) thump(ctx, out, at + FROG_STRIKE.stamp * T, 2, 0.6);
};

/**
 * A go at its task: a slosh as it leans over, the water pouring into the bucket, a drip or two as it stops; then three glugs as it
 * gulps from the puddle and its bladders fill, and its call, softly, as it lifts its head.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), W = FROG_WORK, T = ACT_SECS.work;
  W.gulps.forEach((g, q) => glug(ctx, out, at + g * T, b.water * (1 + 0.12 * q), 1));
  slosh(ctx, out, at + W.tip * T, 0.18, b.water, 0.8);
  pour(ctx, out, at + W.pour[0] * T, (W.pour[1] - W.pour[0]) * T, b.water, v, 1);
  drip(ctx, out, at + W.pour[1] * T + 0.04, b.water, 0.8);
  drip(ctx, out, at + W.pour[1] * T + 0.13, b.water * 1.1, 0.6);
  call(ctx, out, at + (W.gulps[2] + 0.07) * T, s, v, 0.35);
};

/**
 * Evolving, a cue the length of the act: a splash off it, then bubbles rising faster and higher as the drops swirl in, to the
 * flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call,
 * the ribbit, the croak or the boom of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  splash(ctx, dest, at, b.water, v, 0.9);
  burst(ctx, dest, at + 0.12, { dur: flash - 0.12, freq: 300 * key, to: 900 * key, q: 1.4, gain: 0.1, attack: (flash - 0.12) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.22 + (flash - 0.28) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: (300 + 500 * u) * key, to: (700 + 900 * u) * key, dur: 0.05, gain: 0.08 + 0.08 * u, type: 'sine', attack: 0.003 });
  }
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 100 - 15 * s, to: 55 - 8 * s, dur: 0.4, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const FROG_VOICE: Voice = { strike, work, evolve };
