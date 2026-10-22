import { ACT_SECS } from '../render/beasts';
import { TOAD_HITS, TOAD_STRIKE, TOAD_WORK } from '../render/wild-toad';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Mosskip's voice, and its stages' (the species is `bogga`): a small
 * peeping croak, a deep two-beat croak, and a booming rumble of a croak, over
 * the bog they cut -- wet peat raked and sucked up out of the cut, a block
 * shoved and set down -- and the chink of their crystals.
 *
 * A croak is a buzz through a throat's resonances whose loudness is chopped
 * into pulses, a toad's trill being a train of clicks; the smaller the toad,
 * the higher the buzz and the faster the pulses. The Bastiontoad's croak is a
 * slow-pulsed low buzz swelled through a big chest, its energy between 120
 * and 300 Hz where a small speaker still plays it, a low hum rumbling under
 * it. Wet peat is low noise cut short, and its suck a falling band of noise
 * with a low pop; a crystal is a struck bar's inharmonic ring.
 *
 * Every cue lands where its picture does (`./wild-toad`): the strike on
 * `TOAD_HITS`, the Mosskip's mouth opening on `TOAD_STRIKE.open` and the
 * others leaving the ground or rearing on `TOAD_STRIKE.rise`; each rake, the
 * lever, the shove and the block set down on `TOAD_WORK`; and the evolving
 * chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, chopped into pulses `pulse` times a second, through a throat's resonances. */
interface Croak {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
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

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.6, 0.38][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Mosskip's: two quick peeping croaks, the second higher, round 520 Hz. The Craghopper's: a deep
 * "brrok-brok", round 200 Hz in quick pulses, falling. The Bastiontoad's: a booming "brrrooom", round 90 Hz in slow pulses,
 * swelled through a chest resonance between 120 and 300 Hz, a low rumbling hum under it that dies after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 520 * b.pitch;
    croak(ctx, dest, at, { f: [f * 0.95, f * 1.1, f], dur: 0.07, gain: 0.8 * k, formants: [[1100, 3, 1], [2300, 4, 0.4]], pulse: 60, depth: 0.65, type: 'triangle' });
    croak(ctx, dest, at + 0.1, { f: [f * 1.05, f * 1.3, f * 1.2], dur: 0.08, gain: 0.8 * k, formants: [[1300, 3, 1], [2600, 4, 0.4]], pulse: 60, depth: 0.65, type: 'triangle' });
    return;
  }
  if (b.s === 1) {
    const f = 340 * b.pitch;
    croak(ctx, dest, at, { f: [f * 1.08, f * 0.9, f * 0.85], dur: 0.24, gain: 0.5 * k, formants: [[260, 2.5, 1], [620, 2.5, 0.9], [1400, 4, 0.3]], pulse: 32 + 6 * v, depth: 0.85 });
    croak(ctx, dest, at + 0.3, { f: [f * 0.95, f * 0.82], dur: 0.14, gain: 0.42 * k, formants: [[250, 2.5, 1], [600, 2.5, 0.8], [1300, 4, 0.25]], pulse: 32 + 6 * v, depth: 0.85 });
    return;
  }
  const f = 240 * b.pitch;
  croak(ctx, dest, at, { f: [f * 0.92, f * 1.05, f * 0.95, f * 0.78], dur: 0.8, gain: 0.24 * k, formants: [[95, 2, 0.7], [170, 3, 1.5], [260, 3.5, 1.1], [480, 3, 0.35], [1000, 4, 0.06]], pulse: 13 + 3 * v, depth: 0.6, attack: 0.06 });
  ring(ctx, dest, at + 0.04, { freq: f * 0.5, to: f * 0.36, dur: 0.95, gain: 0.11 * k, type: 'sine', attack: 0.06 });
}

/** A heavy body coming down on the ground: a low thump, softened, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [200, 120, 76][s], to: [100, 60, 36][s], dur: [0.1, 0.2, 0.38][s], gain: [0.3, 0.45, 0.6][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * s, freq: 700, to: 160, q: 0.8, gain: (0.16 + 0.07 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** Its crystals chinking against each other, shaken: a few small inharmonic rings, high and bright. */
function chink(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const f = 2400 + 900 * Math.abs(Math.sin(q * 2.7 + v * 7));
    ring(ctx, dest, at + q * 0.035 + 0.01 * Math.sin(q * 5 + v), { freq: f, dur: 0.18, gain: 0.05 * k, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.76, 0.25], [5.4, 0.08]] });
  }
}

/** Wet peat struck or raked: a short low squelch of noise. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.09, freq: 420 * pitch, to: 220 * pitch, q: 1.4, gain: 0.22 * k, attack: 0.004 });
  burst(ctx, dest, at + 0.02, { dur: 0.06, freq: 1400 * pitch, to: 700 * pitch, q: 1.8, gain: 0.07 * k, attack: 0.004 });
}

/** A block of peat sucked up out of the cut: a falling band of noise and a low pop as it comes free. */
function suck(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.14, freq: 900 * pitch, to: 260 * pitch, q: 2.2, gain: 0.16 * k, attack: 0.03 });
  ring(ctx, dest, at + 0.12, { freq: 140 * pitch, to: 260 * pitch, dur: 0.06, gain: 0.25 * k, type: 'sine', attack: 0.003 });
}

/** Something heavy shoved along the ground: a rough scrape of low noise. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 300 * pitch, to: 520 * pitch, q: 0.9, gain: 0.1 * k, attack: dur * 0.3 });
}

/**
 * A strike. The Mosskip peeps as it springs, its mouth snapping shut on what it bites with a wet click. The Craghopper croaks as
 * it leaves the ground and comes down on its belly with a heavy thump, its crystals chinking. The Bastiontoad booms as it rears,
 * and crashes down on its forefeet with a deep thump that shakes the ground and its crystals.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.1, 0.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + TOAD_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + TOAD_STRIKE.open * T - 0.1, 0, v, 0.6);
    ring(ctx, out, hit, { freq: 620, to: 300, dur: 0.05, gain: 0.32, type: 'sine', attack: 0.002 });
    burst(ctx, out, hit, { dur: 0.04, freq: 2000, q: 1.5, gain: 0.18, attack: 0.002 });
    thump(ctx, out, hit + 0.05, 0, 0.6);
    return;
  }
  call(ctx, out, at + TOAD_STRIKE.rise * T - 0.08, s, v, 0.6);
  burst(ctx, out, hit - 0.1, { dur: 0.1, freq: 500 * b.pitch, to: 1500 * b.pitch, q: 0.9, gain: 0.1, attack: 0.08 });
  thump(ctx, out, hit, s, 1);
  squelch(ctx, out, hit + 0.01, b.pitch * 1.4, 0.6 * b.heavy);
  chink(ctx, out, hit + 0.02, 3 + 2 * s, v, 0.8 + 0.4 * s);
  if (s === 2) ring(ctx, out, hit + 0.02, { freq: 48, to: 32, dur: 0.6, gain: 0.3, type: 'sine', attack: 0.01 });
};

/**
 * A go at its task: two squelches as its forefeet rake the peat, a suck and a pop as its snout flips the block up out of the cut,
 * a scrape as it shoves the block across, a thud as the block lands on the stack, and its call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), W = TOAD_WORK, T = ACT_SECS.work;
  const p = 1 / (0.7 + 0.3 * b.heavy * 2);
  W.rakes.forEach((r, q) => squelch(ctx, out, at + r * T, p * (1 + 0.1 * q), 0.9));
  suck(ctx, out, at + (W.lever - 0.06) * T, p, 1);
  scrape(ctx, out, at + W.shove[0] * T, (W.shove[1] - W.shove[0]) * T, p, 0.9);
  thump(ctx, out, at + W.set * T, s, 0.35);
  if (v > 0.5) call(ctx, out, at + (W.set + 0.06) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: crystals chinking faster and higher as the moss and chips swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the peep, the
 * croak or the boom of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 400 * key, to: 1200 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: (1800 + 1400 * u) * key, dur: 0.12, gain: 0.03 + 0.04 * u, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.76, 0.25]] });
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const TOAD_VOICE: Voice = { strike, work, evolve };
