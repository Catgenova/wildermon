import { ACT_SECS } from '../render/beasts';
import { HARE_HITS, HARE_WORK, KIT_JAB } from '../render/wild-hare';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Thistlekit's voice, and its stages' (the species is `orse`): soft hare
 * and deer sounds over the thump of its hind feet. The kit squeaks, a quick
 * bright peep that rises; the Bunnycourser barks, a short hoarse deer's bark
 * through a long throat; the Moonhare calls, a clear ringing note that swells
 * and holds, its fundamental and its first harmonics between 150 and 300 Hz
 * so it carries on a small speaker, with a bell's shimmer over it. A thump
 * is a soft low thud with a brush of earth in it; fur is soft noise.
 *
 * Every cue lands where its picture does (`./wild-hare`): the strike on
 * `HARE_HITS` and the kit's second jab on `KIT_JAB`, each sniff, thump,
 * nibble, shake, stroke and flick of a go at its task on `HARE_WORK`, and
 * the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz or a tone sliding in pitch through a throat's resonances under an envelope, with a vibrato in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  attack?: number;
  type?: OscillatorType;
  /** A vibrato: how fast, and how deep as a share of the pitch. */
  vib?: readonly [number, number];
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const stops: AudioScheduledSourceNode[] = [osc];
  if (o.vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.vib[1] * o.f[0];
    lfo.connect(depth).connect(osc.frequency);
    stops.push(lfo);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.02;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.5));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    osc.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** How a stage sounds: how far down its thumps go, how long it draws a sound out, and which it is. */
function bodyOf(stage: number, v: number): { low: number; long: number; s: number; v: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { low: [1, 0.72, 0.52][s] * (0.95 + 0.1 * v), long: [1, 1.3, 1.7][s], s, v };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Thistlekit's squeak: two quick peeps rising through a small throat, round 1.8 kHz. The
 * Bunnycourser's bark: a short hoarse buzz round 520 Hz falling away, a breath of noise over it. The Moonhare's call: a clear
 * note round 210 Hz swelling and holding with a slow vibrato, its second and third harmonics brought up between 150 and 300 Hz
 * and a little over, an octave and a fifth of soft bell over it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1750 * (0.95 + 0.1 * v);
    voiced(ctx, dest, at, { f: [f * 0.8, f * 1.3, f * 1.1], dur: 0.07, gain: 0.2 * k, type: 'triangle', formants: [[2000, 3, 1], [4200, 5, 0.3]], attack: 0.01 });
    voiced(ctx, dest, at + 0.09, { f: [f * 0.9, f * 1.45, f * 1.2], dur: 0.09, gain: 0.18 * k, type: 'triangle', formants: [[2200, 3, 1], [4400, 5, 0.3]], attack: 0.012 });
    return;
  }
  if (b.s === 1) {
    const f = 520 * (0.95 + 0.1 * v);
    voiced(ctx, dest, at, { f: [f * 1.1, f, f * 0.7], dur: 0.2, gain: 0.32 * k, formants: [[600, 3, 1], [1400, 4, 0.5], [2600, 5, 0.18]], attack: 0.008 });
    burst(ctx, dest, at, { dur: 0.18, freq: 1800, to: 900, q: 0.9, gain: 0.08 * k, attack: 0.01 });
    return;
  }
  const f = 210 * (0.97 + 0.06 * v);
  voiced(ctx, dest, at, { f: [f * 0.94, f, f * 1.02, f * 0.96], dur: 0.75, gain: 0.125 * k, type: 'triangle', formants: [[f, 4, 1.4], [f * 2, 5, 0.9], [f * 3, 6, 0.4], [f * 5, 6, 0.12]], attack: 0.08, vib: [5.2, 0.012] });
  ring(ctx, dest, at + 0.06, { freq: f * 3, dur: 0.8, gain: 0.035 * k, type: 'sine', attack: 0.05, partials: [[1, 0.7], [2.01, 0.2]] });
}

/** A hind foot brought down hard: a soft low thud and a brush of earth over it, the bigger the deeper. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: 150 * b.low, to: 70 * b.low, dur: 0.12 + 0.08 * b.s, gain: 0.42 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.04 * b.s, freq: 700 * b.low, to: 200, q: 0.7, gain: 0.16 * k, type: 'lowpass', attack: 0.003 });
}

/** A sniff: a short breath in through the nose, a band of noise high up. */
function sniff(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07, freq: 3600, to: 4400, q: 1.6, gain: 0.1 * k, attack: 0.03 });
}

/** Fur brushed or shaken: soft noise drawn along, or fluttering. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number, flutter = 0): void {
  if (!flutter) {
    burst(ctx, dest, at, { dur, freq: 2400, to: 1500, q: 0.8, gain: 0.1 * k, attack: dur * 0.4 });
    return;
  }
  for (let q = 0; q < flutter; q++) burst(ctx, dest, at + (q * dur) / flutter, { dur: dur / flutter, freq: 1600 + 300 * (q % 2), q: 0.9, gain: 0.09 * k, attack: 0.01 });
}

/** A swish through the air, a band of noise rising to the blow. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 600, to: 1900, q: 0.9, gain: 0.1 * k, attack: len * 0.8 });
}

/**
 * A strike. The Thistlekit squeaks and boxes, a soft pat at each jab; the Bunnycourser barks as it kicks, a swish and both hind
 * feet's thud; the Moonhare calls as it rears and stamps down with a deep double thud.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 0.82, 0.62][s]), T = ACT_SECS.strike;
  const hit = at + HARE_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + 0.04, 0, v, 0.8);
    for (const h of [HARE_HITS[0], KIT_JAB]) {
      swish(ctx, out, at + h * T - 0.06, 0.06, 0.6);
      thump(ctx, out, at + h * T, 0, 0.45);
    }
    return;
  }
  if (s === 1) {
    call(ctx, out, at + 0.02, 1, v, 0.9);
    swish(ctx, out, hit - 0.1, 0.1, 1);
    thump(ctx, out, hit, 1, 1);
    thump(ctx, out, hit + 0.025, 1, 0.7);
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.8);
  thump(ctx, out, hit, 2, 1.1);
  thump(ctx, out, hit + 0.03, 2, 0.8);
};

/**
 * A go at its task. The Thistlekit sniffs three times and thumps twice, then peeps; the Bunnycourser nibbles at its fur three
 * times, soft brushes, and shakes its ears in a flutter; the Moonhare draws its ear through its paw twice, two long brushes,
 * flicks it, and hums a soft low note of its call.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.3, 9.8, 2.9][s]), W = HARE_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const t of W.sniffs) sniff(ctx, out, at + t * T, 1);
    for (const t of W.thumps) thump(ctx, out, at + t * T, 0, 1);
    call(ctx, out, at + (W.thumps[1] + 0.1) * T, 0, v, 0.3);
    return;
  }
  if (s === 1) {
    for (const t of W.nibbles) { rustle(ctx, out, at + t * T - 0.03, 0.08, 1); burst(ctx, out, at + t * T, { dur: 0.02, freq: 3000, q: 2, gain: 0.08, attack: 0.002 }); }
    rustle(ctx, out, at + (W.shake - 0.06) * T, 0.18, 1.2, 6);
    return;
  }
  for (const t of W.strokes) rustle(ctx, out, at + t * T - 0.1, 0.24, 1.2);
  rustle(ctx, out, at + W.flick * T, 0.1, 1.1, 3);
  // The paw set down again.
  thump(ctx, out, at + (W.flick - 0.05) * T, 2, 0.28);
  call(ctx, out, at + (W.flick + 0.04) * T, 2, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a breath of air rising as the light gathers, soft chimes quickening in it up to the
 * flash at its middle, where they ring together in a moonlit chord, then its own call -- the squeak, the bark or the ringing
 * call of what it has become. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, [2.0, 1.9, 1.6][Math.max(0, Math.min(2, stage))]);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.05, { dur: flash - 0.05, freq: 500 * key, to: 2200 * key, q: 1.2, gain: 0.07, attack: (flash - 0.05) * 0.85 });
  for (let q = 0; q < 8; q++) {
    const u = q / 8, when = at + 0.15 + (flash - 0.25) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: [784, 988, 1175, 1319][q % 4] * key, dur: 0.3, gain: 0.03 + 0.03 * u, type: 'sine', attack: 0.01, partials: [[1, 0.8], [2, 0.15]] });
  }
  for (const f of [392, 494, 587, 784]) ring(ctx, dest, at + flash, { freq: f * key, dur: 0.9, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.8], [2.01, 0.15]] });
  ring(ctx, dest, at + flash, { freq: 196 * key, dur: 1.0, gain: 0.12, type: 'sine', attack: 0.02 });
  call(ctx, dest, at + flash + 0.3, s, v, 0.7);
};

export const HARE_VOICE: Voice = { strike, work, evolve };
