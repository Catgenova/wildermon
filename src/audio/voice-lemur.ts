import { ACT_SECS } from '../render/beasts';
import { LEMUR_PICK, LEMUR_SWIPE } from '../render/wild-lemur';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Lemlet's voice, and its stages' (the species is `sprigga`): a ring-tailed
 * lemur's calls -- the kit's high mewing chirrup, the Lemleaf's chirrup run
 * into a cat's falling "mrrow", and the Lemorian's long wail, a bark rising
 * into a howl that sinks away, round 300 Hz -- over the rustle of the leaves
 * on it and in the tree, the snap of a sprout coming off its twig, a rake of
 * claws and a spitting hiss.
 *
 * A call is a buzz sliding in pitch through a small throat's resonances; a
 * chirrup is that buzz trilled, its loudness chopped quickly. A rustle is
 * noise, high and soft, in a few quick swells; a twig's snap is a click of
 * bright noise with a short woody knock under it. The bigger the body, the
 * lower each of them.
 *
 * Every cue lands where its picture does (`./wild-lemur`): the rake of the
 * strike on `LEMUR_SWIPE.hit`, the paw going up, its two tugs, the snap and
 * the mouthful of a go at its task on `LEMUR_PICK`, and the evolving chime on
 * the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, through a throat's resonances, under an envelope, its loudness trilled. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  /** A trill in its loudness: how many times a second, and how deep (nought to one). */
  trill?: readonly [number, number];
  attack?: number;
  type?: OscillatorType;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const shake = ctx.createGain();
  shake.gain.value = 1;
  const stops: AudioScheduledSourceNode[] = [osc];
  if (o.trill) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'triangle';
    lfo.frequency.value = o.trill[0];
    depth.gain.value = o.trill[1] * 0.5;
    shake.gain.value = 1 - o.trill[1] * 0.5;
    lfo.connect(depth).connect(shake.gain);
    stops.push(lfo);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(shake);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    shake.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** How a stage sounds: how far down its voice is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.74, 0.52][s] * (0.95 + 0.1 * v), s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Lemlet's: a high mew sliding up and a quick trilled chirrup after it, round 900 Hz. The Lemleaf's:
 * a trilled chirrup and then a cat's "mrrow", falling, round 520 Hz. The Lemorian's: a short bark, then a long wail rising and
 * sinking away, round 300 Hz, swelled through a chest resonance.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 900 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.85, f * 1.2, f * 1.1], dur: 0.16, gain: 0.5 * k, formants: [[1500, 3, 1], [3000, 4, 0.4]], type: 'triangle', attack: 0.02 });
    voiced(ctx, dest, at + 0.19, { f: [f * 1.1, f * 1.3, f * 1.15], dur: 0.11, gain: 0.42 * k, formants: [[1700, 3, 1], [3300, 4, 0.35]], trill: [34, 0.75], type: 'triangle' });
    return;
  }
  if (b.s === 1) {
    const f = 700 * b.pitch;
    voiced(ctx, dest, at, { f: [f, f * 1.15, f * 1.05], dur: 0.13, gain: 0.4 * k, formants: [[1100, 3, 1], [2400, 4, 0.4]], trill: [28, 0.8], type: 'triangle' });
    voiced(ctx, dest, at + 0.17, { f: [f * 0.95, f * 1.12, f * 0.78, f * 0.62], dur: 0.38, gain: 0.34 * k, formants: [[650, 2.5, 1], [1300, 3, 0.8], [2600, 4, 0.25]], attack: 0.03 });
    return;
  }
  const f = 420 * b.pitch;
  voiced(ctx, dest, at, { f: [f * 1.1, f * 0.9], dur: 0.09, gain: 0.34 * k, formants: [[500, 2.5, 1], [1100, 3, 0.6]], attack: 0.006 });
  voiced(ctx, dest, at + 0.14, { f: [f * 0.85, f * 1.25, f * 1.18, f * 0.92, f * 0.7], dur: 0.9, gain: 0.26 * k, formants: [[320, 2, 0.8], [620, 2.5, 1.1], [1250, 3, 0.45], [2500, 4, 0.12]], trill: [6 + 2 * v, 0.25], attack: 0.08 });
  ring(ctx, dest, at + 0.16, { freq: f * 0.42, to: f * 0.34, dur: 0.85, gain: 0.05 * k, type: 'sine', attack: 0.08 });
}

/** Leaves rustling: soft high noise in `n` quick swells over `dur`, lower for a bigger body. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const u = (q + 0.4 * Math.abs(Math.sin(q * 2.7 + v * 7))) / n;
    burst(ctx, dest, at + dur * u, { dur: dur / n + 0.05, freq: (3400 + 900 * Math.sin(q * 1.9 + v * 3)) * (0.75 + 0.25 * pitch), to: 2200 * (0.75 + 0.25 * pitch), q: 1.1, gain: 0.12 * k, attack: 0.012 });
  }
}

/** A sprout snapped off its twig: a click of bright noise and a short woody knock under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.035, freq: 3800, q: 1.4, gain: 0.2 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 1300 * (0.8 + 0.2 * pitch), to: 900, dur: 0.05, gain: 0.12 * k, type: 'triangle', attack: 0.001 });
}

/** A nibble: two quick soft clicks of teeth. */
function nibble(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  for (const d of [0, 0.07]) burst(ctx, dest, at + d, { dur: 0.025, freq: 2600, q: 2.5, gain: 0.12 * k, attack: 0.001 });
}

/** A swish through the air before a blow, lower and longer for a bigger body. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 700 * pitch, to: 2200 * pitch, q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/** A rake of claws: three quick scrapes of bright noise one after another, falling. */
function rake(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + q * 0.028, { dur: 0.07, freq: (4200 - 500 * q) * (0.8 + 0.2 * pitch), to: 1800, q: 2.2, gain: (0.18 - 0.03 * q) * k, attack: 0.003 });
}

/** A spitting hiss, bared teeth: a wash of breathy noise. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 5200 * (0.7 + 0.3 * pitch), to: 3600, q: 0.8, gain: 0.1 * k, attack: dur * 0.25 });
}

/** A paw coming down: a soft low thump, deeper for a bigger body. */
function pad(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [260, 180, 120][s], to: [150, 100, 64][s], dur: [0.06, 0.09, 0.14][s], gain: [0.18, 0.24, 0.3][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.05 + 0.03 * s, freq: 900, to: 300, q: 0.8, gain: 0.08 * k, type: 'lowpass', attack: 0.003 });
}

/**
 * A strike: it hisses as it rears with its paw up, the paw swishes down and its claws rake, its leaves shaken, and the paw
 * comes down; the Lemorian barks as it rakes.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.0, 2.6, 2.2][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + LEMUR_SWIPE.hit * T;
  hiss(ctx, out, at + 0.04, LEMUR_SWIPE.wind * T, b.pitch, 1);
  swish(ctx, out, hit - 0.09, 0.09, b.pitch, 1);
  rake(ctx, out, hit - 0.02, b.pitch, 1);
  if (s > 0) rustle(ctx, out, hit, 0.18, 3, b.pitch, v, 0.8 + 0.3 * s);
  pad(ctx, out, hit + 0.05, s, 0.8);
  if (s === 2) call(ctx, out, hit - 0.06, 2, v, 0.35);
};

/**
 * A go at its task: the leaves of the tree rustling as its paw goes up into them and at each of its two tugs, the snap of the
 * sprout coming off, a nibble as it takes it in its mouth, and a soft chirrup over it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.4, 3.2, 3.0][s]), b = bodyOf(stage, v), P = LEMUR_PICK, T = ACT_SECS.work;
  rustle(ctx, out, at + 0.12 * T, (P.reach - 0.12) * T, 3, b.pitch, v, 0.9);
  P.tugs.forEach((u, q) => rustle(ctx, out, at + (u - 0.03) * T, 0.1, 2, b.pitch, v + q, 1));
  snap(ctx, out, at + P.snap * T, b.pitch, 1);
  rustle(ctx, out, at + P.snap * T + 0.02, 0.16, 2, b.pitch, v + 3, 0.7);
  nibble(ctx, out, at + P.mouth * T, 0.9);
  if (v > 0.35) call(ctx, out, at + (P.mouth + 0.05) * T, s, v, 0.22);
};

/**
 * Evolving, a cue the length of the act: its leaves rustling faster and higher as the swirl gathers, to the flash at its middle,
 * where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the mew, the "mrrow"
 * or the wail of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 8; q++) {
    const u = q / 8;
    rustle(ctx, dest, at + 0.08 + (flash - 0.2) * u, 0.12, 2, b.pitch * (0.8 + 0.5 * u), v + q, 0.5 + 0.6 * u);
  }
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 110 - 15 * s, to: 60 - 8 * s, dur: 0.4, gain: 0.18, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const LEMUR_VOICE: Voice = { strike, work, evolve };
