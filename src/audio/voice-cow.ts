import { ACT_SECS } from '../render/beat-times';
import { COW_HITS } from '../render/wild-cow';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Creamcalf's voice, and its stages' (the species is `cudda`): a calf's
 * "maa", a cow's moo and a deep long low, over the soft rustle of the leaves
 * and flowers it wears and the thud of its hooves. A call is a buzz (a
 * sawtooth sliding in pitch) through the resonances of a throat, opening from
 * a closed "m" into an "oo"; the bigger the body, the lower, the longer and
 * the more of an octave under it. The Lactisovereign's low has its energy
 * brought up between 150 and 300 Hz, where a laptop's speakers still play,
 * its fundamental under that.
 *
 * Every cue lands where its picture does (`../render/wild-cow`): the butt on
 * `COW_HITS`; the evolving chime on the flash at the middle of the act.
 */

/** The shortest rise anything here is given: under it, a sound starts with a click. */
const RISE = 0.016;
/** The smallest gain an exponential fall is taken to. */
const FLOOR = 0.00012;

/** Filtered noise through an envelope, its rise a straight line up from silence so nothing clicks. */
function burst(ctx: BaseAudioContext, dest: AudioNode, at: number, b: Burst): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.type ?? 'bandpass';
  filter.frequency.setValueAtTime(Math.max(30, b.freq), at);
  if (b.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), at + b.dur);
  filter.Q.value = b.q ?? 1;
  const gain = ctx.createGain(), rise = Math.min(Math.max(RISE, b.attack ?? RISE), b.dur * 0.5);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(Math.max(FLOOR * 2, b.gain), at + rise);
  gain.gain.exponentialRampToValueAtTime(FLOOR, at + b.dur);
  src.connect(filter).connect(gain).connect(dest);
  src.start(at, Math.random() * 0.9);
  src.stop(at + b.dur + 0.02);
}

/** An oscillator or a stack of them, each partial dying sooner the higher it is, as a struck thing's do. */
function ring(ctx: BaseAudioContext, dest: AudioNode, at: number, r: Ring): void {
  for (const [mul, share] of r.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = r.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, r.freq * mul), at);
    if (r.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, r.to * mul), at + r.dur);
    const gain = ctx.createGain(), rise = Math.min(Math.max(RISE, r.attack ?? RISE), r.dur * 0.5);
    const life = r.dur / (1 + (mul - 1) * 0.55);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(Math.max(FLOOR * 2, r.gain * share), at + rise);
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + life);
    osc.connect(gain).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.02);
  }
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * A voiced sound: a buzz sliding through `f`, wavering in pitch (`vib`: how fast, how far as a share), through a throat's
 * resonances that glide from where they start to where they end (`formants`: from, to, how narrow, how loud).
 */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: {
  f: readonly number[]; dur: number; gain: number; formants: ReadonlyArray<readonly [number, number, number, number]>; vib?: readonly [number, number]; attack?: number;
}): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const stops: AudioScheduledSourceNode[] = [osc];
  if (o.vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.f[0] * o.vib[1];
    lfo.connect(depth).connect(osc.frequency);
    stops.push(lfo);
  }
  const env = ctx.createGain(), rise = Math.max(RISE, o.attack ?? 0.04);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.6));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  for (const [from, to, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + o.dur * 0.3);
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

const stageOf = (stage: number): 0 | 1 | 2 => Math.max(0, Math.min(2, Math.round(stage))) as 0 | 1 | 2;

/**
 * Its call, `k` loud, `len` as long as its own. The Creamcalf's: a calf's "maa" round 300 Hz, rising and breaking down at
 * its end. The Milkmere's: a full "mmoo" round 140 Hz, a closed hum opening into the vowel, rising a little and sinking.
 * The Lactisovereign's: a long deep "mmooo" round 90 Hz, an octave under it and a breath of chest in it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, len = 1): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 300 * p, dur = 0.42 * len;
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.12, f * 1.08, f * 0.8], dur, gain: 0.5 * k, formants: [[420, 900, 4, 1], [1300, 1800, 5, 0.45], [2800, 3000, 7, 0.12]], vib: [6, 0.02], attack: 0.03 });
    return;
  }
  const f = (s === 1 ? 140 : 90) * p, dur = (s === 1 ? 0.75 : 1.05) * len;
  voiced(ctx, dest, at, { f: [f * 0.88, f * 1.06, f * 1.1, f * 0.98, f * 0.82], dur, gain: (s === 1 ? 0.42 : 0.3) * k, formants: [[230, 340, 3, 1], [480, 640, 4, 0.7], [1000, 1100, 5, 0.25], [2300, 2400, 6, 0.06]], vib: [4.5, 0.015], attack: 0.08 });
  // The "m" at its start: a closed hum before the throat opens.
  voiced(ctx, dest, at, { f: [f * 0.88, f], dur: 0.16 * len, gain: 0.25 * k, formants: [[200, 220, 3, 1]], attack: 0.03 });
  if (s === 2) {
    ring(ctx, dest, at + 0.06, { freq: f * 0.5, to: f * 0.42, dur: dur * 0.85, gain: 0.09 * k, type: 'sine', attack: 0.1 });
    burst(ctx, dest, at, { dur: dur * 0.9, freq: 220, to: 140, q: 0.8, gain: 0.05 * k, type: 'lowpass', attack: dur * 0.3 });
  }
}

/** A hoof set down: a soft thud, deeper the bigger it is, and the scuff of earth under it. */
function hoof(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [170, 120, 88][s], to: [90, 64, 46][s], dur: [0.1, 0.16, 0.22][s], gain: [0.18, 0.24, 0.3][s] * k, type: 'sine' });
  burst(ctx, dest, at, { dur: 0.09 + 0.03 * s, freq: 900 - 150 * s, to: 380, q: 0.8, gain: 0.12 * k });
}

/** The leaves and flowers it wears, shaken: dry ticks in a high band over a soft hush. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, v: number, k: number, ticks = 6): void {
  burst(ctx, dest, at, { dur: len, freq: 3000 + v * 400, to: 2300, q: 0.9, gain: 0.045 * k, attack: Math.max(RISE, len * 0.35) });
  for (let q = 0; q < ticks; q++) {
    const when = at + len * ((q + 0.3 * Math.sin(q * 3.7 + v * 5)) / ticks);
    burst(ctx, dest, Math.max(at, when), { dur: 0.03, freq: q % 3 ? 5600 + 400 * Math.sin(q * 2.1 + v) : 2500, q: 2.5, gain: 0.05 * k });
  }
}

/**
 * A strike: a snort as it lowers its head, the whoosh of the butt, and where the blow lands the knock of brow or horn, the
 * thud of its weight behind it and its leaves and flowers shaken; on the bigger two a stamp first; and its call after.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.5, 1.35, 1.25][s]);
  const hit = at + COW_HITS[s] * ACT_SECS.strike;
  if (s) hoof(ctx, out, at + 0.12 * ACT_SECS.strike, s, 0.9);
  burst(ctx, out, at + 0.04, { dur: 0.12 + 0.03 * s, freq: 1300 - 250 * s, to: 500 - 80 * s, q: 1.1, gain: 0.2 });
  burst(ctx, out, hit - 0.13, { dur: 0.14, freq: 500 - 80 * s, to: 1700 - 300 * s, q: 0.8, gain: 0.14, attack: 0.1 });
  // The knock: a hollow brow on the Creamcalf, horn on the others -- a woody crack falling.
  ring(ctx, out, hit, { freq: [520, 380, 270][s], to: [300, 230, 170][s], dur: 0.09, gain: 0.3, type: 'triangle', partials: [[1, 0.6], [2.3, 0.25], [3.9, 0.1]] });
  burst(ctx, out, hit, { dur: 0.06, freq: [1800, 1400, 1100][s], to: 700, q: 1.6, gain: 0.22, attack: 0.004 });
  hoof(ctx, out, hit + 0.01, s, 1.1);
  rustle(ctx, out, hit + 0.02, 0.26, v, 0.7);
  call(ctx, out, hit + 0.1, s, v, 0.55, 0.6);
};

/**
 * Evolving, a cue the length of the act: a papery burst as its petals fly off it, the rustle building as they swirl round
 * it, a breath of air rising to the flash at the middle of the act, where a chime rings, each stage's lower than the last;
 * and after it, its call in its new voice.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [2.2, 1.6, 1.6][s]), flash = at + 0.5 * ACT_SECS.evolve;
  burst(ctx, out, at, { dur: 0.16, freq: 2500, to: 1500, q: 1.2, gain: 0.14 });
  [0.02, 0.22, 0.4, 0.56, 0.7].forEach((when, q) => rustle(ctx, out, at + when, 0.16, v + q * 0.2, 0.7 + 0.15 * q, 4 + q));
  burst(ctx, out, at + 0.2, { dur: flash - at - 0.2, freq: 1300, to: 2300, q: 2, gain: 0.1, attack: flash - at - 0.28 });
  const key = [1, 0.8, 0.62][s];
  for (const [f, g, d] of [[1, 0.13, 1.0], [1.5, 0.06, 0.8], [2, 0.06, 0.7], [3, 0.02, 0.4]] as Array<[number, number, number]>) {
    ring(ctx, out, flash, { freq: 880 * key * f, dur: d, gain: g, type: 'sine', partials: [[1, 0.8], [2.4, 0.2]] });
  }
  call(ctx, out, flash + 0.3, s, v, 0.7);
};

export const COW_VOICE: Voice = { strike, evolve };
