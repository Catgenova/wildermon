import { ACT_SECS } from '../render/beasts';
import { HAUL_HITS, HAUL_STAMP, HAUL_WORK } from '../render/wild-haul';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Cartling's voice, and its stages' (the species is `roxxen`): a calf's
 * bleat, a lowing ox and a deep bellow, over the creak of a leather harness
 * and a wooden pole, the thud of hooves, the rustle of the leaves it wears,
 * and the brass bell at its chest, which the Wagonox and the Haulhorn carry
 * (a little clear one, and a big one with a hum under it). A call is a buzz
 * (a sawtooth sliding in pitch) through the resonances of a throat, with a
 * waver in its pitch; the bleat's a quick quaver in its loudness too, as a
 * lamb's is. The Haulhorn's bellow has its energy brought up between 150 and
 * 300 Hz, where a laptop's speakers still play, its fundamental under that.
 *
 * Every cue lands where its picture does (`./wild-haul`): the strike's blow
 * on `HAUL_HITS` and the Haulhorn's fore feet on `HAUL_STAMP`; at its task
 * each fore hoof dug in, each heave and each hind hoof shifted on
 * `HAUL_WORK`; the evolving bell on the flash at the middle of the act.
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
  const gain = ctx.createGain(), rise = Math.min(b.attack ?? RISE, b.dur * 0.5);
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
    const gain = ctx.createGain(), rise = Math.min(r.attack ?? RISE, r.dur * 0.5);
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

/** A voiced sound: a buzz sliding through `f`, through a throat's resonances, wavering in pitch (`vib`: how fast, how far as a share) and in loudness (`quaver`). */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  vib?: readonly [number, number];
  quaver?: readonly [number, number];
  attack?: number;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
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
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  if (o.quaver) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.quaver[0];
    depth.gain.value = o.quaver[1] * 0.5;
    flutter.gain.value = 1 - o.quaver[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    stops.push(lfo);
  }
  const env = ctx.createGain(), rise = o.attack ?? 0.03;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(flutter);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    flutter.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

const stageOf = (stage: number): 0 | 1 | 2 => Math.max(0, Math.min(2, Math.round(stage))) as 0 | 1 | 2;

/**
 * Its call, `k` loud, `len` as long as its own: the Cartling's bleat, a bright quavering "meh-eh" round 520 Hz that breaks
 * up and falls; the Wagonox's low, a full "mooo" round 150 Hz rising a little and sinking, through an open throat; the
 * Haulhorn's bellow, a deep buzz round 80 Hz swelling and dropping, its harmonics pushed up through a chest resonance from 150
 * to 300 Hz, with a rough growl under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, len = 1): void {
  const s = stageOf(stage), p = 0.95 + 0.1 * v;
  if (s === 0) {
    const f = 520 * p;
    voiced(ctx, dest, at, { f: [f * 0.92, f * 1.12, f * 1.04, f * 0.86], dur: 0.36 * len, gain: 0.57 * k, formants: [[880, 4, 1], [2300, 5, 0.5], [3400, 6, 0.16]], vib: [7, 0.02], quaver: [19 + 4 * v, 0.55], attack: 0.02 });
    return;
  }
  if (s === 1) {
    const f = 150 * p, dur = 0.7 * len;
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.08, f * 1.12, f * 0.94, f * 0.8], dur, gain: 0.42 * k, formants: [[300, 3, 1], [620, 4, 0.75], [1150, 5, 0.32], [2400, 6, 0.08]], vib: [5, 0.015], attack: 0.07 });
    // The "m" at its start: a closed hum before the throat opens.
    voiced(ctx, dest, at, { f: [f * 0.9, f], dur: 0.14, gain: 0.25 * k, formants: [[220, 3, 1]], attack: 0.03 });
    return;
  }
  const f = 80 * p, dur = 0.95 * len;
  voiced(ctx, dest, at, { f: [f * 0.85, f * 1.12, f * 1.08, f * 0.92, f * 0.72], dur, gain: 0.25 * k, formants: [[90, 2, 0.6], [170, 3.5, 1.5], [250, 3.5, 1.3], [480, 3, 0.5], [1000, 4, 0.14]], vib: [4, 0.02], quaver: [26, 0.35], attack: 0.1 });
  ring(ctx, dest, at + 0.05, { freq: f * 0.5, to: f * 0.42, dur: dur * 0.85, gain: 0.095 * k, type: 'sine', attack: 0.08 });
  burst(ctx, dest, at, { dur: dur * 0.9, freq: 230, to: 140, q: 0.8, gain: 0.055 * k, type: 'lowpass', attack: dur * 0.3 });
}

/**
 * The brass bell at its chest, struck `k` hard: the Wagonox's a clear little bell round 1100 Hz with its minor third and its
 * octave over it; the Haulhorn's a big bell round 620 Hz with a hum an octave under it, that rings on. The Cartling wears none.
 */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage);
  if (!s) return;
  const f = (s === 1 ? 1100 : 620) * (0.98 + 0.04 * v);
  ring(ctx, dest, at, { freq: f, dur: s === 1 ? 0.7 : 1.3, gain: (s === 1 ? 0.07 : 0.085) * k, type: 'sine', partials: [[0.5, s === 1 ? 0.15 : 0.45], [1, 0.6], [1.19, 0.25], [1.5, 0.14], [2, 0.22], [2.66, 0.08]] });
  burst(ctx, dest, at, { dur: 0.04, freq: f * 2.4, q: 3, gain: 0.025 * k });
}

/** The bell jangled as it swings: struck by its clapper a few times, each softer, a swing apart. */
function jangle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, n = 3): void {
  for (let q = 0; q < n; q++) bell(ctx, dest, at + q * (0.19 + 0.03 * v), stage, v + q * 0.1, k * (1 - 0.3 * q));
}

/**
 * Leather and wood under strain: the harness creaking, a run of tiny dry catches in a narrow band as the straps slip on their
 * buckles; and on the bigger ones the pole's lower groan under it, a few catches lower and slower.
 */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, len = 0.22): void {
  const s = stageOf(stage), n = 7 + 3 * s;
  for (let q = 0; q < n; q++) {
    const u = (q + 0.4 * Math.sin(q * 4.1 + v * 6)) / n;
    burst(ctx, dest, at + len * Math.max(0, u), { dur: 0.012, freq: (1500 - 250 * s) * (1 + 0.2 * Math.sin(q * 2.3 + v)), q: 7, gain: 0.08 * k * (0.6 + 0.4 * Math.sin(Math.PI * u)), attack: 0.003 });
  }
  if (s) {
    for (let q = 0; q < 4; q++) burst(ctx, dest, at + 0.03 + q * len * 0.25, { dur: 0.05, freq: 380 - 60 * s + 30 * Math.sin(q + v), q: 6, gain: 0.07 * k, attack: 0.01 });
  }
}

/** A hoof set down: a soft thud, deeper the bigger it is, and the scuff of earth under it. */
function hoof(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [170, 120, 90][s], to: [90, 64, 48][s], dur: [0.1, 0.16, 0.22][s], gain: [0.18, 0.24, 0.3][s] * k, type: 'sine' });
  burst(ctx, dest, at, { dur: 0.09 + 0.03 * s, freq: 900 - 150 * s, to: 380, q: 0.8, gain: 0.12 * k });
}

/** The leaves it wears, shaken: dry ticks in a high band over a soft hush. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, v: number, k: number, ticks = 6): void {
  burst(ctx, dest, at, { dur: len, freq: 3000 + v * 400, to: 2300, q: 0.9, gain: 0.045 * k, attack: Math.max(RISE, len * 0.35) });
  for (let q = 0; q < ticks; q++) {
    const when = at + len * ((q + 0.3 * Math.sin(q * 3.7 + v * 5)) / ticks);
    burst(ctx, dest, Math.max(at, when), { dur: 0.03, freq: q % 3 ? 5600 + 400 * Math.sin(q * 2.1 + v) : 2500, q: 2.5, gain: 0.05 * k });
  }
}

/**
 * A strike: a snort as it lowers its head, the whoosh of the butt, and where the blow lands, the knock of brow or horn and the
 * thud of its weight behind it, its leaves shaken, its bell jangling after; the Haulhorn's fore feet coming down after its toss
 * with a heavy thud; and its call over it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.5, 1.4, 0.95][s]);
  const hit = at + HAUL_HITS[s] * ACT_SECS.strike;
  burst(ctx, out, at + 0.04, { dur: 0.12 + 0.03 * s, freq: 1300 - 250 * s, to: 500 - 80 * s, q: 1.1, gain: 0.2 });
  burst(ctx, out, hit - 0.13, { dur: 0.14, freq: 500 - 80 * s, to: 1700 - 300 * s, q: 0.8, gain: 0.14, attack: 0.1 });
  // The knock: a hollow brow on the Cartling, horn on the others -- a woody crack falling.
  ring(ctx, out, hit, { freq: [520, 360, 260][s], to: [300, 220, 160][s], dur: 0.09, gain: 0.3, type: 'triangle', partials: [[1, 0.6], [2.3, 0.25], [3.9, 0.1]] });
  burst(ctx, out, hit, { dur: 0.06, freq: [1800, 1400, 1100][s], to: 700, q: 1.6, gain: 0.22, attack: 0.004 });
  hoof(ctx, out, hit + 0.01, s, 1.1);
  rustle(ctx, out, hit + 0.02, 0.26, v, 0.7);
  creak(ctx, out, hit + 0.03, s, v, 0.6, 0.16);
  jangle(ctx, out, hit + 0.05, s, v, 1, 3);
  if (s === 2) {
    const down = at + HAUL_STAMP * ACT_SECS.strike;
    hoof(ctx, out, down, 2, 1.4);
    burst(ctx, out, down + 0.02, { dur: 0.4, freq: 240, to: 90, q: 0.8, type: 'lowpass', gain: 0.22, attack: 0.03 });
  }
  call(ctx, out, hit + 0.08, s, v, 0.55, 0.6);
};

/**
 * A go at its task, hauling: each fore hoof dug in with a thud and a scuff, the harness creaking and the pole groaning at each
 * heave with the bell swinging and ringing, each hind hoof shifted with a softer scuff; a grunt of effort at the first heave.
 * It is played over and over while it hauls, so nothing in it is louder than a hoof.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [2.5, 2.2, 1.8][s]), W = HAUL_WORK;
  const T = (x: number): number => at + x * ACT_SECS.work;
  for (const d of W.digs) hoof(ctx, out, T(d), s, 0.8);
  for (const h of W.heaves) {
    creak(ctx, out, T(h) - 0.04, s, v, 1, 0.26);
    bell(ctx, out, T(h) + 0.06, s, v, 0.55);
  }
  for (const p of W.pushes) burst(ctx, out, T(p) - (p > 0.9 ? 0.03 : 0), { dur: 0.1, freq: 700 - 120 * s, to: 300, q: 0.8, gain: 0.1 });
  rustle(ctx, out, T(W.heaves[0]), 0.3, v, 0.35, 4);
  // A short grunt of effort, its own voice, low.
  call(ctx, out, T(W.heaves[0]) - 0.02, s, v, 0.22, 0.4);
};

/**
 * Evolving, a cue the length of the act: a papery burst as its leaves fly off it, the rustle building as they swirl round it,
 * a breath of air rising to the flash at the middle of the act, where a bell rings -- the stage's own, or for the Cartling a
 * little one -- with a shimmer of its partials; and after it, its call in its new voice. Each stage's bell is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [2.3, 1.6, 1.25][s]), flash = at + 0.5 * ACT_SECS.evolve;
  burst(ctx, out, at, { dur: 0.16, freq: 2500, to: 1500, q: 1.2, gain: 0.14 });
  rustle(ctx, out, at + 0.02, 0.24, v, 0.8);
  [0.22, 0.4, 0.56, 0.7].forEach((when, q) => rustle(ctx, out, at + when, 0.16, v + q * 0.2, 0.8 + 0.15 * q, 4 + q));
  burst(ctx, out, at + 0.2, { dur: flash - at - 0.2, freq: 1300, to: 2300, q: 2, gain: 0.1, attack: flash - at - 0.28 });
  const key = [1, 0.8, 0.62][s];
  for (const [f, g, d] of [[1, 0.13, 1.0], [1.5, 0.06, 0.8], [2, 0.06, 0.7], [3, 0.02, 0.4]] as Array<[number, number, number]>) {
    ring(ctx, out, flash, { freq: 880 * key * f, dur: d, gain: g, type: 'sine', partials: [[1, 0.8], [2.4, 0.2]] });
  }
  if (s) jangle(ctx, out, flash + 0.04, s, v, 1.1, 2);
  creak(ctx, out, flash + 0.1, s, v, 0.5, 0.2);
  call(ctx, out, flash + 0.32, s, v, 0.7);
};

export const HAUL_VOICE: Voice = { strike, work, evolve };
