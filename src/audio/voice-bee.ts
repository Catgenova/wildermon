import { ACT_SECS } from '../render/beasts';
import { BEE_HITS, BEE_WORK } from '../render/wild-bee';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Buzzlet's voice, and its stages' (the species is `vesp`): a bee's buzz,
 * higher and thinner on the Buzzlet and deeper on each stage after, the
 * Hivemaster's a low drone; little chirps over it; and the stickiness of its
 * work -- a squelch where a paw or a comb meets honey -- and a zip as it
 * stings.
 *
 * A buzz is a sawtooth through a lowpass, its loudness beaten by its wings
 * (a fast tremolo), so it is a buzz and not a tone; the bigger the body, the
 * lower it is and the slower its wings beat, the Hivemaster's round 110 Hz
 * where its harmonics still carry on a small speaker. A chirp is a sine
 * sliding up. A squelch is a band of noise dropping fast over a low sine
 * popping up, which is a wet thing let go of; a zip is a narrow band of noise
 * sweeping down from high, very short, with a thin whistle sliding up.
 *
 * Every cue lands where its picture does (`./wild-bee`): the sting on
 * `BEE_HITS`; the dabs and the smoothing, the presses and the shaping, the
 * panel set and pressed home, on `BEE_WORK`; and the evolving chime on the
 * flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.48][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * A buzz: a sawtooth at `f` sliding to `to`, through a lowpass, under a rise, a hold and a fall, its loudness beaten `beat` times
 * a second by its wings.
 */
function buzz(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: number; to?: number; dur: number; gain: number; beat: number; cut?: number }): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.f, at);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, at + o.dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut ?? o.f * 6;
  lp.Q.value = 1.2;
  const env = ctx.createGain(), rise = Math.min(0.05, o.dur * 0.25);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + o.dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  // The wings' beat: the loudness swung between a third and the whole of it.
  const am = ctx.createGain();
  am.gain.value = 0.65;
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = o.beat;
  depth.gain.value = 0.35;
  lfo.connect(depth).connect(am.gain);
  osc.connect(lp).connect(am).connect(env).connect(dest);
  osc.start(at);
  lfo.start(at);
  osc.stop(at + o.dur + 0.02);
  lfo.stop(at + o.dur + 0.02);
}

/** Its buzz at a stage, `dur` long: higher and its wings quicker on a small body. */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, b: { pitch: number }, dur: number, k: number, rise = 1): void {
  buzz(ctx, dest, at, { f: 230 * b.pitch, to: 230 * b.pitch * rise, dur, gain: 0.07 * k, beat: 22 + 18 * b.pitch });
}

/** A chirp: a sine sliding up, short. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.06): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.45, dur, gain: 0.12 * k, type: 'sine', attack: 0.008 });
}

/** A squelch: honey pressed and let go of, wetter and lower on a bigger body. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.09 + 0.06 * heavy, freq: 1500 - 500 * heavy, to: 320, q: 2.2, gain: 0.2 * k, attack: 0.006 });
  ring(ctx, dest, at + 0.015, { freq: 150 - 40 * heavy, to: 340 - 90 * heavy, dur: 0.07 + 0.04 * heavy, gain: 0.16 * k, type: 'sine', attack: 0.004 });
}

/**
 * Its own call, by stage. The Buzzlet's: two quick chirps round 1600 Hz over a short thin buzz. The Combworker's: a buzz round
 * 160 Hz and one chirp. The Hivemaster's: a deep droning buzz round 110 Hz swelling up, and two low chirps.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    hum(ctx, dest, at, b, 0.22, 0.8 * k, 1.1);
    chirp(ctx, dest, at + 0.05, 1600, k);
    chirp(ctx, dest, at + 0.15, 1800, k);
    return;
  }
  if (b.s === 1) {
    hum(ctx, dest, at, b, 0.32, k, 1.08);
    chirp(ctx, dest, at + 0.22, 1250, 0.8 * k, 0.08);
    return;
  }
  hum(ctx, dest, at, b, 0.6, 1.3 * k, 1.12);
  // An octave under its buzz, for the weight of it.
  ring(ctx, dest, at, { freq: 115 * b.pitch, dur: 0.6, gain: 0.05 * k, type: 'triangle', attack: 0.08 });
  chirp(ctx, dest, at + 0.38, 900, 0.7 * k, 0.09);
  chirp(ctx, dest, at + 0.5, 1000, 0.7 * k, 0.09);
}

/** The sting going home: a zip of noise sweeping down from high and a thin whistle up, quick; a small tap where it lands. */
function zip(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at - 0.05, { dur: 0.07, freq: 7000, to: 1800, q: 3.5, gain: 0.22 * k, attack: 0.04 });
  ring(ctx, dest, at - 0.04, { freq: 1800, to: 3600, dur: 0.06, gain: 0.08 * k, type: 'sine', attack: 0.01 });
  burst(ctx, dest, at, { dur: 0.04, freq: 2400 - 900 * heavy, q: 1.4, gain: 0.2 * k, attack: 0.002 });
  ring(ctx, dest, at, { freq: 260 - 100 * heavy, to: 140 - 50 * heavy, dur: 0.06 + 0.04 * heavy, gain: 0.16 * k, type: 'sine', attack: 0.002 });
}

/** A strike: an angry buzz rising as it rears, and the zip of the sting as it jabs. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.6, 1.4][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + BEE_HITS[s] * T;
  buzz(ctx, out, at, { f: 230 * b.pitch, to: 330 * b.pitch, dur: hit - at + 0.08, gain: 0.08, beat: 30 + 20 * b.pitch });
  zip(ctx, out, hit, b.heavy, 1);
  if (s === 2) ring(ctx, out, hit, { freq: 80, to: 46, dur: 0.22, gain: 0.25, type: 'sine', attack: 0.003 });
};

/**
 * A go at its task, a buzz under it all. The Buzzlet's: a sticky squelch at each dab at its drop, a softer smear as it smooths
 * it, and a chirp. The Combworker's: a squelch at each press of its comb and a smear as it shapes it. The Hivemaster's: a heavy
 * squelch as it sets its panel down, a thump and a squelch as it presses it home with a puff of pollen, and a sticky pull as it
 * lifts it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.7, 1.6][s]), b = bodyOf(stage, v), W = BEE_WORK, T = ACT_SECS.work;
  hum(ctx, out, at + 0.05 * T, b, 0.85 * T, 0.45);
  const smear = (when: number, k: number): void => burst(ctx, out, at + when * T, { dur: 0.16, freq: 900, to: 1700, q: 1.6, gain: 0.08 * k, attack: 0.06 });
  if (s === 0) {
    squelch(ctx, out, at + W.dab * T, b.heavy, 0.9);
    squelch(ctx, out, at + W.dab2 * T, b.heavy, 0.8);
    smear(W.smooth - 0.06, 1);
    if (v > 0.5) chirp(ctx, out, at + 0.86 * T, 1700, 0.5);
    return;
  }
  if (s === 1) {
    squelch(ctx, out, at + W.press * T, b.heavy, 1);
    squelch(ctx, out, at + W.press2 * T, b.heavy, 0.9);
    smear(W.shape - 0.08, 1.2);
    if (v > 0.5) chirp(ctx, out, at + 0.9 * T, 1300, 0.4, 0.08);
    return;
  }
  squelch(ctx, out, at + W.set * T, b.heavy, 1);
  ring(ctx, out, at + W.home * T, { freq: 92, to: 50, dur: 0.24, gain: 0.3, type: 'sine', attack: 0.004 });
  squelch(ctx, out, at + W.home * T, b.heavy, 0.8);
  burst(ctx, out, at + (W.home + 0.01) * T, { dur: 0.3, freq: 5200, to: 3000, q: 0.8, gain: 0.05, attack: 0.02 });
  ring(ctx, out, at + W.lift * T, { freq: 300, to: 140, dur: 0.12, gain: 0.1, type: 'sine', attack: 0.01 });
  burst(ctx, out, at + W.lift * T, { dur: 0.12, freq: 700, to: 1400, q: 2, gain: 0.08, attack: 0.03 });
};

/**
 * Evolving, a cue the length of the act: its buzz rising and quickening as the pollen and petals swirl in, to the flash at its
 * middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the chirps,
 * the buzz or the drone of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.7);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve, b = bodyOf(Math.max(0, s - 1), v);
  buzz(ctx, dest, at + 0.05, { f: 200 * b.pitch, to: 420 * b.pitch, dur: flash - 0.05, gain: 0.06, beat: 26 });
  for (let q = 0; q < 6; q++) chirp(ctx, dest, at + 0.2 + (flash - 0.3) * (q / 6), (1200 + 140 * q) * key, 0.25 + 0.06 * q, 0.05);
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const BEE_VOICE: Voice = { strike, work, evolve };
