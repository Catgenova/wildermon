import { ACT_SECS } from '../render/beasts';
import { BILL_HITS, BILL_WORK } from '../render/wild-curlew';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pebblebeak's voice, and its stages' (the species is `wurla`): a
 * shorebird chick's thin rising peep, the curlew's bubbling two-note
 * whistle, and the heron's harsh low croak, over the soft thuds of a bill
 * going into the soil and the wet pop of a worm coming out of it.
 *
 * A whistle is a sine gliding in pitch with a little of its octave over it;
 * the Soilwhistle's rises and then bubbles, shaken in pitch many times a
 * second. The Wormheron's croak is a sawtooth low down through a band of
 * filtered noise, a rasp. The smaller the bird, the higher and shorter.
 *
 * Every cue lands where its picture does (`./wild-curlew`): the blow on
 * `BILL_HITS`; the worm laid down, the jabs, the deep probe, the tugs, the
 * pop and the toss on `BILL_WORK`; and the evolving chime on the flash at
 * the middle of the act.
 */

/** A note: the pitch through it, how long, how loud, how much octave over it, and how fast and deep a trill shakes it. */
interface Note { f: readonly number[]; dur: number; gain: number; over?: number; trill?: readonly [number, number]; attack?: number; type?: OscillatorType }

function note(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Note): void {
  const env = ctx.createGain();
  const rise = o.attack ?? 0.01;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.5));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  env.connect(dest);
  const lfo = o.trill ? ctx.createOscillator() : null;
  if (lfo && o.trill) {
    lfo.frequency.value = o.trill[0];
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  for (const [mul, share] of [[1, 1], [2, o.over ?? 0.1]] as const) {
    if (share <= 0) continue;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
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
 * Its own call, by stage. The Pebblebeak: a thin peep rising from 2.6 kHz to 3.6, twice. The Soilwhistle: a rising whistle from
 * 1.5 kHz to 2.2 and a second that bubbles. The Wormheron: a harsh croak round 260 Hz, falling, through a rasp of noise.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 2600 * p;
    note(ctx, dest, at, { f: [f, f * 1.38, f * 1.3], dur: 0.12, gain: 0.28 * k });
    note(ctx, dest, at + 0.16, { f: [f * 1.05, f * 1.42, f * 1.34], dur: 0.13, gain: 0.26 * k });
    return;
  }
  if (s === 1) {
    const f = 1500 * p;
    note(ctx, dest, at, { f: [f, f * 1.45, f * 1.42], dur: 0.32, gain: 0.26 * k, over: 0.14, attack: 0.03 });
    note(ctx, dest, at + 0.38, { f: [f * 1.35, f * 1.5, f * 1.4], dur: 0.36, gain: 0.22 * k, over: 0.12, trill: [18 + 4 * v, 0.05], attack: 0.02 });
    return;
  }
  const f = 260 * p;
  note(ctx, dest, at, { f: [f * 1.1, f, f * 0.78], dur: 0.42, gain: 0.16 * k, over: 0.3, type: 'sawtooth', attack: 0.02 });
  burst(ctx, dest, at, { dur: 0.4, freq: 900 * p, to: 600 * p, q: 2.2, gain: 0.16 * k, attack: 0.02 });
}

/** A bill going into soft ground: a short dull thud, and crumbs. */
function probe(ctx: BaseAudioContext, dest: AudioNode, at: number, big: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.05 + 0.03 * big, freq: 520 / (0.8 + 0.3 * big), to: 220, q: 1, gain: 0.2 * k, type: 'lowpass', attack: 0.003 });
  burst(ctx, dest, at + 0.02, { dur: 0.025, freq: 1900, q: 2, gain: 0.04 * k, attack: 0.002 });
}

/** A worm stretched and slipping: a soft wet squeak gliding up. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  note(ctx, dest, at, { f: [700 * pitch, 1100 * pitch], dur: 0.09, gain: 0.08 * k, over: 0 });
  burst(ctx, dest, at, { dur: 0.08, freq: 1400 * pitch, q: 3, gain: 0.05 * k, attack: 0.01 });
}

/** A worm coming out of the ground: a wet pop, a sine falling fast, and soil scattering. */
function pop(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 900 * pitch, to: 260 * pitch, dur: 0.09, gain: 0.3 * k, type: 'sine', attack: 0.002 });
  for (let q = 0; q < 5; q++) burst(ctx, dest, at + 0.05 + q * 0.04, { dur: 0.025, freq: 1500 - q * 160, q: 1.8, gain: 0.06 * k, attack: 0.002 });
}

/** A wingbeat: a swell of air. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 500 * pitch, to: 1400 * pitch, q: 0.8, gain: 0.14 * k, attack: len * 0.6 });
}

/** A bill landing a blow: a hard little knock. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 1200 * pitch, to: 820 * pitch, dur: 0.05, gain: 0.3 * k, type: 'triangle', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.03, freq: 2400 * pitch, q: 2, gain: 0.14 * k, attack: 0.001 });
}

/**
 * A strike. The Pebblebeak peeps and hops into a jab; the Soilwhistle whistles as it draws back and its long bill lands with a sharp
 * knock; the Wormheron croaks as it lifts its wings, and its heavy bill strikes through a rush of air.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.3, 1.15, 1.0][s]), T = ACT_SECS.strike, hit = at + BILL_HITS[s] * T;
  const pitch = [1.2, 1, 0.7][s];
  call(ctx, out, at + 0.01, s, v, 0.55);
  whoosh(ctx, out, hit - 0.12, s === 2 ? 0.18 : 0.1, pitch, s === 2 ? 1.3 : 0.8);
  knock(ctx, out, hit, [1.1, 1, 0.75][s], 1);
};

/**
 * A go at its task: the worm laid down with a soft pat, three quick thuds of the bill probing, a deeper one, a squeak of the worm at
 * each tug, the wet pop as it comes out with soil scattering, and its call, softly, as it settles it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.9, 1.75, 1.6][s]), W = BILL_WORK, T = ACT_SECS.work, pitch = [1.2, 1, 0.75][s];
  probe(ctx, out, at + W.lay * T, s * 0.5, 0.35);
  W.jabs.forEach((j) => probe(ctx, out, at + j * T, s * 0.5, 0.7));
  probe(ctx, out, at + W.deep * T, s, 1);
  W.tugs.forEach((tg, q) => squeak(ctx, out, at + tg * T, pitch * (1 + 0.08 * q), 0.8 + 0.1 * q));
  pop(ctx, out, at + W.pop * T, pitch, 1);
  call(ctx, out, at + (W.toss + 0.02) * T, s, v, 0.25);
};

/**
 * Evolving, a cue the length of the act: a swell of air like wings rising to the flash at its middle, where a clear chime rings over
 * a warm swell -- each stage's lower than the last -- and then its own call, the peep, the whistle or the croak of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.35);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 700 * key, to: 2600 * key, q: 1.2, gain: 0.09, attack: (flash - 0.1) * 0.85 });
  [523, 659, 784].forEach((f, q) => ring(ctx, dest, at + 0.45 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.05, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 2093 * key, dur: 0.5, gain: 0.045, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [523, 659, 784]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.045, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 130 - 15 * s, to: 70 - 8 * s, dur: 0.4, gain: 0.16, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const CURLEW_VOICE: Voice = { strike, work, evolve };
