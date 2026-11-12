import { ACT_SECS } from '../render/beat-times';
import { PEA_HITS } from '../render/wild-peafowl';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Peachick's voice, and its stages' (the species is `quill`): a
 * peafowl's call, a nasal "kee-AW" -- a short rising yelp into a long wail
 * that falls -- over the rattle of its train. A call is a buzz (a sawtooth
 * sliding in pitch) through the narrow resonances of a beak and a long neck;
 * the bigger the bird, the lower and the longer. The Peachick's is a thin
 * cheep of it, the Plumecrest's the full call, the Featherbourne's lower and
 * twice over, and its train shivered after it: the dry rattle of a fan of
 * quills shaken, noise beaten at twenty times a second.
 *
 * Every cue lands where its picture does (`../render/wild-peafowl`): the
 * peck on `PEA_HITS`; the evolving chime on the flash at the middle of the act.
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
 * A voiced sound: a buzz sliding through `f`, through a beak's and a neck's resonances (`formants`: from, to, how narrow,
 * how loud), wavering a little (`vib`: how fast, how far as a share).
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
  const env = ctx.createGain(), rise = Math.max(RISE, o.attack ?? 0.02);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  for (const [from, to, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + o.dur * 0.4);
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
 * Its call, `k` loud: the "kee", short and rising, and the "AW", long, nasal and falling. The Peachick's round 900 Hz and
 * quick; the Plumecrest's round 560 Hz; the Featherbourne's round 400 Hz, longer, and a second time after a breath.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  const f = [900, 560, 400][s] * p, len = [0.55, 0.85, 1.1][s];
  const nasal: ReadonlyArray<readonly [number, number, number, number]> = [[f * 2.2, f * 1.8, 6, 1], [f * 4.4, f * 3.6, 8, 0.5], [2600, 2400, 7, 0.2]];
  const once = (t: number, g: number): void => {
    voiced(ctx, dest, t, { f: [f * 0.85, f * 1.25], dur: 0.12 * len, gain: 0.32 * g, formants: nasal, attack: 0.012 });
    voiced(ctx, dest, t + 0.13 * len, { f: [f * 1.3, f * 1.36, f * 1.1, f * 0.82], dur: 0.62 * len, gain: 0.42 * g, formants: nasal, vib: [7, 0.025], attack: 0.03 });
  };
  once(at, k);
  if (s === 2) {
    once(at + 0.95 * len, k * 0.8);
    // And under it, a breath of its chest, where a laptop's speakers still play.
    burst(ctx, dest, at + 0.1, { dur: 0.7 * len, freq: 320, to: 220, q: 1, gain: 0.05 * k, type: 'lowpass', attack: 0.2 });
  }
}

/** Its train shaken: the dry rattle of quills, noise beaten quickly up and down, for `len` seconds. */
function rattle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, len: number, k: number): void {
  const s = stageOf(stage), beats = Math.round(len * [26, 22, 18][s]);
  for (let q = 0; q < beats; q++) {
    const t = at + (q / beats) * len, swell = Math.sin(Math.PI * (q + 0.5) / beats);
    burst(ctx, dest, t, { dur: 0.035, freq: [5200, 4200, 3400][s] + 500 * Math.sin(q * 2.3), q: 1.6, gain: (0.04 + 0.08 * swell) * k, attack: 0.004 });
  }
}

/** A foot set down: a light tap and the scratch of its claws. */
function step(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [240, 180, 130][s], to: [140, 100, 76][s], dur: 0.07 + 0.03 * s, gain: 0.12 * k, type: 'sine' });
  burst(ctx, dest, at, { dur: 0.06, freq: 2600, to: 1600, q: 1.2, gain: 0.06 * k });
}

/**
 * A strike: the train shaken as it shows, the wings' whoosh, and where the peck lands the hard tick of its beak and the
 * thud of its weight; its call after.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.4, 1.3, 1.2][s]);
  const hit = at + PEA_HITS[s] * ACT_SECS.strike;
  rattle(ctx, out, at + 0.03, s, hit - at - 0.06, 0.7 + 0.15 * s);
  burst(ctx, out, hit - 0.12, { dur: 0.13, freq: 600, to: 1800, q: 0.8, gain: 0.12, attack: 0.09 });
  ring(ctx, out, hit, { freq: [1900, 1500, 1200][s], to: [1200, 950, 760][s], dur: 0.05, gain: 0.22, type: 'triangle', partials: [[1, 0.7], [2.6, 0.2]] });
  burst(ctx, out, hit, { dur: 0.05, freq: 3200, to: 1800, q: 1.8, gain: 0.16, attack: 0.003 });
  step(ctx, out, hit + 0.01, s, 1.1);
  call(ctx, out, hit + 0.12, s, v, 0.5);
};

/**
 * Evolving, a cue the length of the act: its feathers rustling as they fly round it, the train rattled as it spreads, a
 * breath of air rising to the flash at the middle of the act, where a chime rings, each stage's lower than the last; and
 * after it, its call in its new voice.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [2.0, 1.6, 1.5][s]), flash = at + 0.5 * ACT_SECS.evolve;
  [0.02, 0.2, 0.38, 0.55].forEach((when, q) => burst(ctx, out, at + when, { dur: 0.18, freq: 3200 + 300 * q, to: 2200, q: 1, gain: 0.06 + 0.02 * q, attack: 0.05 }));
  rattle(ctx, out, at + 0.25, s, flash - at - 0.3, 0.8);
  burst(ctx, out, at + 0.2, { dur: flash - at - 0.2, freq: 1300, to: 2300, q: 2, gain: 0.1, attack: flash - at - 0.28 });
  const key = [1, 0.8, 0.62][s];
  for (const [f, g, d] of [[1, 0.13, 1.0], [1.5, 0.06, 0.8], [2, 0.06, 0.7], [3, 0.02, 0.4]] as Array<[number, number, number]>) {
    ring(ctx, out, flash, { freq: 880 * key * f, dur: d, gain: g, type: 'sine', partials: [[1, 0.8], [2.4, 0.2]] });
  }
  call(ctx, out, flash + 0.3, s, v, 0.7);
};

export const PEAFOWL_VOICE: Voice = { strike, evolve };
