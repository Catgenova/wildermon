import { ACT_SECS } from '../render/beasts';
import { ROLL_HITS, ROLL_STRIKE, ROLL_WORK } from '../render/wild-clayroll';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sliplet's voice, and its stages' (the species is `mudda`): a small
 * chirping trill, a rolling hum, and a deep grumbling rumble, over the clay
 * they shape -- a wet lump slapped flat, its sides pressed, its top patted, a
 * brick shoved across and set down -- and the grind of a clay shell turning.
 *
 * A call is a buzz through a throat's resonances, its loudness chopped into
 * pulses: the smaller the body, the higher the buzz and the faster the pulses,
 * so the Sliplet's is a quick trill round 1.1 kHz and the Rollterra's a slow
 * rumble round 90 Hz swelled through a chest between 120 and 300 Hz, where a
 * small speaker still plays it. Wet clay is low noise cut short; a shell
 * rolling is low noise swelling and falling, a rough rumble under it.
 *
 * Every cue lands where its picture does (`./wild-clayroll`): the strike on
 * `ROLL_HITS`, the curl on `ROLL_STRIKE.curled` and the Rollterra's shell
 * rolling back until it has reared, `ROLL_STRIKE.reared`; the slam, each press and pat, the shove and the brick
 * set down on `ROLL_WORK`; and the evolving chime on the flash at the middle of
 * the act.
 */

/** A voiced sound: a buzz sliding through `f`, chopped into pulses `pulse` times a second, through a throat's resonances. */
interface Call {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  pulse: number;
  depth: number;
  attack?: number;
  type?: OscillatorType;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Call): void {
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
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Sliplet's: a quick rising chirp and a trill after it, round 1.1 kHz. The Wheelmote's: a rolling
 * "rrrum-rum", round 300 Hz in quick pulses, rising then falling. The Rollterra's: a deep grumbling "grrrohm", round 90 Hz in slow
 * pulses, swelled through a chest resonance between 120 and 300 Hz, a low hum under it that dies after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1100 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.8, f * 1.15], dur: 0.06, gain: 0.7 * k, formants: [[1800, 3, 1], [3200, 4, 0.35]], pulse: 70, depth: 0.3, type: 'triangle' });
    voiced(ctx, dest, at + 0.08, { f: [f * 1.1, f * 1.2, f * 0.95], dur: 0.16, gain: 0.6 * k, formants: [[1900, 3, 1], [3400, 4, 0.3]], pulse: 38 + 6 * v, depth: 0.8, type: 'triangle' });
    return;
  }
  if (b.s === 1) {
    const f = 480 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.08, f], dur: 0.26, gain: 0.45 * k, formants: [[320, 2.5, 1], [760, 2.5, 0.8], [1600, 4, 0.25]], pulse: 26 + 5 * v, depth: 0.75 });
    voiced(ctx, dest, at + 0.32, { f: [f, f * 0.84], dur: 0.14, gain: 0.38 * k, formants: [[300, 2.5, 1], [720, 2.5, 0.7]], pulse: 26 + 5 * v, depth: 0.75 });
    return;
  }
  const f = 225 * b.pitch;
  voiced(ctx, dest, at, { f: [f * 0.9, f * 1.06, f * 0.98, f * 0.8], dur: 0.85, gain: 0.24 * k, formants: [[100, 2, 0.7], [180, 3, 1.5], [270, 3.5, 1.1], [500, 3, 0.35], [1000, 4, 0.06]], pulse: 11 + 3 * v, depth: 0.65, attack: 0.07 });
  ring(ctx, dest, at + 0.05, { freq: f * 0.5, to: f * 0.38, dur: 1.0, gain: 0.11 * k, type: 'sine', attack: 0.06 });
}

/** A heavy body or a brick coming down: a low thump, softened, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [210, 130, 80][s], to: [110, 64, 38][s], dur: [0.1, 0.2, 0.36][s], gain: [0.3, 0.45, 0.6][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * s, freq: 700, to: 160, q: 0.8, gain: (0.15 + 0.07 * s) * k, type: 'lowpass', attack: 0.003 });
}

/** Wet clay slapped or pressed: a short low squelch of noise with a wet top to it. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.1, freq: 480 * pitch, to: 240 * pitch, q: 1.4, gain: 0.24 * k, attack: 0.004 });
  burst(ctx, dest, at + 0.015, { dur: 0.06, freq: 1700 * pitch, to: 900 * pitch, q: 2, gain: 0.08 * k, attack: 0.004 });
}

/** A paw patted on a damp brick: a soft dull tap. */
function pat(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.04, freq: 900 * pitch, to: 500 * pitch, q: 1.2, gain: 0.16 * k, attack: 0.002 });
  ring(ctx, dest, at, { freq: 260 * pitch, to: 180 * pitch, dur: 0.05, gain: 0.12 * k, type: 'sine', attack: 0.002 });
}

/** Its clay shell turning over: low noise swelling and falling, with a rough low rumble under it. */
function grind(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 260 * pitch, to: 380 * pitch, q: 0.9, gain: 0.12 * k, attack: dur * 0.4 });
  ring(ctx, dest, at, { freq: 70 * pitch, to: 60 * pitch, dur, gain: 0.08 * k, type: 'triangle', attack: dur * 0.3 });
}

/**
 * A strike. The Sliplet and the Wheelmote chirp or hum as they curl up, their shell rumbling as it rolls, and land with a thump and
 * a squelch of clay; the Wheelmote's thump heavier, from the air. The Rollterra grumbles as it rears, and comes down with a deep
 * thump that shakes the ground.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.1, 0.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + ROLL_HITS[s] * T;
  if (s < 2) {
    call(ctx, out, at + 0.02, s, v, 0.5);
    burst(ctx, out, at + ROLL_STRIKE.curled * T - 0.02, { dur: 0.04, freq: 1400 * b.pitch, q: 1.4, gain: 0.12, attack: 0.002 });
    grind(ctx, out, at + ROLL_STRIKE.curled * T, hit - (at + ROLL_STRIKE.curled * T), b.pitch * 1.3, 1.3);
  } else {
    call(ctx, out, at + 0.02, s, v, 0.6);
    // Its shell rolling back as it rears, and on again as it comes down.
    grind(ctx, out, at + 0.04, ROLL_STRIKE.reared * T, b.pitch, 0.6);
    grind(ctx, out, hit - 0.06, 0.2, b.pitch, 1);
  }
  thump(ctx, out, hit, s, 1);
  squelch(ctx, out, hit + 0.01, b.pitch * 1.3, 0.6 * b.heavy);
  if (s === 2) ring(ctx, out, hit + 0.02, { freq: 48, to: 32, dur: 0.6, gain: 0.3, type: 'sine', attack: 0.01 });
};

/**
 * A go at its task: a wet slap as both paws come down on the lump, a squelch as each side is pressed square, two soft pats on the
 * top, the shell grinding round as it presses, a scrape as the brick is shoved across, a thud as it is set on the stack, and its
 * call, softly.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.6, 1.65][s]), b = bodyOf(stage, v), W = ROLL_WORK, T = ACT_SECS.work;
  const p = 1 / (0.7 + 0.6 * b.heavy);
  squelch(ctx, out, at + W.slam * T, p, 1.1);
  thump(ctx, out, at + W.slam * T, s, 0.25);
  W.press.forEach((r, q) => squelch(ctx, out, at + r * T, p * (1.15 + 0.1 * q), 0.6));
  W.pats.forEach((r, q) => pat(ctx, out, at + r * T, p * (1 + 0.08 * q), 0.9));
  grind(ctx, out, at + W.slam * T, (W.press[1] - W.slam) * T, p, 0.6);
  burst(ctx, out, at + W.shove[0] * T, { dur: (W.shove[1] - W.shove[0]) * T, freq: 320 * p, to: 540 * p, q: 0.9, gain: 0.09, attack: 0.04 });
  grind(ctx, out, at + W.shove[0] * T, (W.set - W.shove[0]) * T, p, 0.7);
  thump(ctx, out, at + W.set * T, s, 0.35);
  if (v > 0.5) call(ctx, out, at + (W.set + 0.04) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: its shell grinding round as it curls up and the clay swirls in, faster and higher, to the
 * flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the
 * chirp, the hum or the rumble of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  grind(ctx, dest, at + 0.1, flash - 0.1, key * 1.2, 0.8);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 400 * key, to: 1200 * key, q: 1.2, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    pat(ctx, dest, when, key * (0.9 + 0.8 * u), 0.5 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const CLAYROLL_VOICE: Voice = { strike, work, evolve };
