import { ACT_SECS } from '../render/beasts';
import { CHEST_HITS, CHEST_STRIKE, CHEST_WORK } from '../render/wild-chest';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Chestkit's voice, and its stages' (the species is `magga`): a cheeky
 * chirruping squeak, a hollow grumble from inside a bigger box, and a deep
 * booming grunt out from under the Hoardback's shell; and the chest it is --
 * the lid's hinge creaking open, the lid clapped shut, wood knocking, and the
 * gold inside jingling.
 *
 * A voice here is a buzz through a few resonances, the way a throat is; the
 * bigger the box it comes out of, the lower the buzz and the lower and
 * narrower the resonances, so the Lootvent's and the Hoardback's grumble
 * sounds hollow, as if from inside a box. A creak is a hinge's stick-slip:
 * a train of low clicks rising and falling in rate, through a wooden
 * resonance. A clap of the lid is a short knock of wood -- a damped low ring
 * with a crack of noise on it -- and coins are small bright inharmonic rings,
 * a few at once, scattered in time.
 *
 * Every cue lands where its picture does (`./wild-chest`): the strike on
 * `CHEST_HITS`, the lid flung open (or the head drawn back) on
 * `CHEST_STRIKE.open`; each nudge, the flip, the lid opening, the thing
 * dropping in and the lid slammed on it on `CHEST_WORK`; and the evolving
 * chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, its loudness pulsed `pulse` times a second, through a few resonances. */
interface Buzz {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  pulse: number;
  depth: number;
  attack?: number;
  type?: OscillatorType;
}

function buzz(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Buzz): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
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

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

const stageOf = (stage: number): number => Math.max(0, Math.min(2, stage));

/**
 * Its own call, by stage. The Chestkit's: a quick rising chirrup, two squeaks round 900 Hz, bright and a little woody. The
 * Lootvent's: a hollow "hrrm-hm" round 220 Hz through narrow low resonances, as from inside a box. The Hoardback's: a deep
 * booming grunt round 100 Hz, slow-pulsed, swelled through a chest resonance between 140 and 320 Hz where a small speaker still
 * plays it, a low hum under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 880 * p;
    buzz(ctx, dest, at, { f: [f * 0.8, f * 1.15, f], dur: 0.08, gain: 0.7 * k, formants: [[1500, 3, 1], [3000, 4, 0.35]], pulse: 70, depth: 0.4, type: 'triangle' });
    buzz(ctx, dest, at + 0.11, { f: [f * 0.95, f * 1.4], dur: 0.1, gain: 0.7 * k, formants: [[1800, 3, 1], [3400, 4, 0.35]], pulse: 70, depth: 0.4, type: 'triangle' });
    return;
  }
  if (s === 1) {
    const f = 220 * p;
    buzz(ctx, dest, at, { f: [f * 0.9, f * 1.05, f * 0.95], dur: 0.22, gain: 0.5 * k, formants: [[330, 6, 1.2], [700, 5, 0.6], [1500, 6, 0.15]], pulse: 24 + 6 * v, depth: 0.5 });
    buzz(ctx, dest, at + 0.27, { f: [f * 1.0, f * 0.85], dur: 0.12, gain: 0.42 * k, formants: [[320, 6, 1.1], [680, 5, 0.5]], pulse: 24 + 6 * v, depth: 0.5 });
    return;
  }
  const f = 100 * p;
  buzz(ctx, dest, at, { f: [f * 0.9, f * 1.08, f * 0.8], dur: 0.6, gain: 0.3 * k, formants: [[140, 3, 1.4], [230, 4, 1.2], [320, 4, 0.7], [700, 4, 0.12]], pulse: 11 + 3 * v, depth: 0.55, attack: 0.05 });
  ring(ctx, dest, at + 0.03, { freq: f * 0.6, to: f * 0.45, dur: 0.7, gain: 0.12 * k, type: 'sine', attack: 0.05 });
}

/** The lid's hinge creaking: a hinge's stick-slip, clicks quickening and slowing, through a woody resonance, lower for a bigger lid. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, stage: number, k: number): void {
  const s = stageOf(stage), f = [1300, 950, 650][s];
  buzz(ctx, dest, at, { f: [55 - 10 * s, 95 - 20 * s, 70 - 15 * s], dur, gain: 0.32 * k, formants: [[f, 7, 1], [f * 2.3, 8, 0.4]], pulse: 9, depth: 0.5, attack: dur * 0.2 });
}

/** The lid clapped shut, or wood knocked: a short damped ring of wood with a crack of noise on it, deeper for a bigger chest. */
function clap(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [520, 320, 190][s], to: [380, 230, 130][s], dur: [0.08, 0.12, 0.18][s], gain: 0.42 * k, type: 'sine', attack: 0.002, partials: [[1, 0.8], [2.3, 0.3], [4.1, 0.1]] });
  burst(ctx, dest, at, { dur: 0.04 + 0.02 * s, freq: [2600, 1900, 1300][s], to: 700, q: 1.2, gain: 0.22 * k, attack: 0.001 });
}

/** Gold jingling in the chest: a few small bright inharmonic rings, scattered a little in time. */
function jingle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const f = 3200 + 1600 * Math.abs(Math.sin(q * 2.3 + v * 5));
    ring(ctx, dest, at + q * 0.03 + 0.012 * Math.sin(q * 7 + v), { freq: f, dur: 0.2, gain: 0.045 * k, type: 'sine', attack: 0.002, partials: [[1, 0.6], [2.76, 0.3], [5.4, 0.1]] });
  }
}

/** A body coming down on the ground: a low thump, softened, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [190, 120, 74][s], to: [100, 60, 36][s], dur: [0.1, 0.2, 0.36][s], gain: [0.3, 0.45, 0.6][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * s, freq: 700, to: 160, q: 0.8, gain: (0.14 + 0.07 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** Something nudged along the ground: a soft scuff of noise. */
function scuff(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07, freq: 900, to: 500, q: 0.9, gain: 0.08 * k, attack: 0.01 });
}

/**
 * A strike. The Chestkit's lid creaks open as it springs and claps shut on what it bites, the gold in it jingling. The Lootvent
 * grumbles as it rears with its lid gaping, and comes down with the lid crashed shut and a heavy thump. The Hoardback grunts as
 * it draws its head in, and its beak snaps shut with a hard click, its shell knocking as its weight lurches after it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.3, 1.1, 0.95][s]), T = ACT_SECS.strike;
  const hit = at + CHEST_HITS[s] * T, open = at + CHEST_STRIKE.open * T;
  if (s < 2) {
    creak(ctx, out, open - 0.02, 0.12, s, 0.8);
    if (s === 1) call(ctx, out, open - 0.08, s, v, 0.6);
    clap(ctx, out, hit, s, 1.1);
    jingle(ctx, out, hit + 0.02, 3 + 2 * s, v, 0.9);
    thump(ctx, out, hit + 0.02, s, s ? 1 : 0.5);
    return;
  }
  call(ctx, out, at + 0.04, s, v, 0.6);
  ring(ctx, out, hit, { freq: 1100, to: 700, dur: 0.04, gain: 0.3, type: 'square', attack: 0.001 });
  burst(ctx, out, hit, { dur: 0.03, freq: 3000, q: 1.5, gain: 0.2, attack: 0.001 });
  clap(ctx, out, hit + 0.04, s, 0.5);
  thump(ctx, out, hit + 0.05, s, 0.7);
  jingle(ctx, out, hit + 0.06, 4, v, 0.7);
};

/**
 * A go at its task: two soft scuffs as it noses the thing in front of it, the hinge creaking as the lid swings open, a soft thud
 * as the thing drops in, the lid clapped shut on it with a jingle of the gold inside, and now and then its call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.5, 1.55, 1.6][s]), W = CHEST_WORK, T = ACT_SECS.work;
  W.nudges.forEach((n) => scuff(ctx, out, at + n * T, 1));
  creak(ctx, out, at + W.open * T, 0.14 + 0.04 * s, s, 0.8);
  burst(ctx, out, at + W.drop * T, { dur: 0.06, freq: 500, to: 250, q: 0.8, gain: 0.12, attack: 0.004 });
  clap(ctx, out, at + W.shut * T, s, 0.9);
  jingle(ctx, out, at + W.shut * T + 0.02, 3, v, 0.7);
  if (v > 0.5) call(ctx, out, at + (W.shut + 0.1) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: coins jingling faster and higher as the leaves and gold swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- the lid claps, and then its own
 * call, the chirrup, the grumble or the grunt of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 400 * key, to: 1200 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: (2400 + 1600 * u) * key, dur: 0.12, gain: 0.03 + 0.04 * u, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.76, 0.25]] });
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  clap(ctx, dest, at + flash + 0.25, s, 0.6);
  call(ctx, dest, at + flash + 0.4, s, v, 0.6);
};

export const CHEST_VOICE: Voice = { strike, work, evolve };
