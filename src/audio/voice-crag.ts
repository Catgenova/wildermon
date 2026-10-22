import { ACT_SECS } from '../render/beasts';
import { CRAG_CAST, CRAG_STRIKE, CRAG_WORK } from '../render/wild-crag';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pebbletooth's voice, and its stages' (the species is `thumpa`): a pup's
 * chirps and clicks, a lizard's gravelly hiss, and the Cragjaws' roar, over
 * the knock of stone on stone and the boom of its slam.
 *
 * A chirp is a quick bright buzz through a small throat; a click is a short
 * dry knock of its jaw. A hiss is noise through a throat's resonance, and
 * gravelly because its loudness flutters fast, which is a rasp. A roar is a
 * low buzz sliding up and down through a big chest, the same rasp in it and a
 * wash of noise over it, its energy between 120 and 400 Hz where a small
 * speaker still plays it. Stone is a short inharmonic ring over a burst of
 * filtered noise; the slam is a deep boom falling away, the ground cracking,
 * and grit pattering down after it. A bigger stage is a lower, longer voice.
 *
 * Every cue lands where its picture does (`./wild-crag`): the jaw snapping
 * shut on `CRAG_STRIKE.snap`, the slam on `CRAG_CAST.slam`, the tongue's
 * flick and the hiss at its post on `CRAG_WORK`, and the evolving chime on the
 * flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, through a throat's resonances, with a rasp (a flutter in its loudness) in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  rasp?: readonly [number, number];
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
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  if (o.rasp) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = o.rasp[0];
    depth.gain.value = o.rasp[1] * 0.5;
    flutter.gain.value = 1 - o.rasp[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.015;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.45));
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
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** How a stage sounds: how far down its voice is, how far down its stone rings, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; stone: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.6, 0.4][s] * (0.94 + 0.12 * v), stone: [1, 0.7, 0.45][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** The pup's chirp: a quick bright buzz round 900 Hz going up and falling away, through a small throat; `lift` how far it rises. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, lift = 1.4, dur = 0.09): void {
  const f = 880 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, { f: [f * 0.85, f * lift, f * 0.95], dur, gain: 0.3 * k, type: 'triangle', formants: [[1500, 4, 1], [3000, 6, 0.4]], attack: 0.008 });
}

/** A click of the jaw or the tongue: a short dry knock, high, a little pitch in it. */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.025, freq: 3200 * pitch, q: 2.2, gain: 0.22 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 1900 * pitch, dur: 0.03, gain: 0.1 * k, type: 'triangle', attack: 0.001, partials: [[1, 0.7], [2.3, 0.3]] });
}

/** A hiss: noise through a throat's resonance, gravelly with a fast rasp in it, lower and longer for a bigger body. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.3): void {
  const b = bodyOf(stage, v), len = dur * (1 + 0.35 * b.s);
  burst(ctx, dest, at, { dur: len, freq: 3400 * (0.7 + 0.3 * b.pitch), to: 2400 * (0.7 + 0.3 * b.pitch), q: 1.4, gain: 0.16 * k, attack: len * 0.25 });
  // The gravel in it: a low rasp buzzing under the breath.
  voiced(ctx, dest, at + 0.02, { f: [150 * b.pitch * 1.6, 130 * b.pitch * 1.6], dur: len * 0.9, gain: 0.12 * k, formants: [[700, 2, 1], [1800, 3, 0.4]], rasp: [38 + 8 * v, 0.85], attack: len * 0.3 });
}

/**
 * The Cragjaws' roar: a low buzz round 110 Hz rising and sinking, swelled through a big chest between 150 and 400 Hz, a hard rasp in
 * it, a wash of noise over it like breath through a throat of stone.
 */
function roar(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, dur = 0.7): void {
  const f = 105 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, { f: [f * 0.85, f * 1.25, f * 1.1, f * 0.75], dur, gain: 0.55 * k, formants: [[180, 2, 1], [380, 2.5, 0.9], [800, 3, 0.35], [1600, 4, 0.1]], rasp: [26 + 6 * v, 0.7], attack: 0.06 });
  burst(ctx, dest, at + 0.03, { dur: dur * 0.9, freq: 900, to: 500, q: 0.8, gain: 0.1 * k, attack: dur * 0.3 });
}

/** A growl, the Shaleclaw's: shorter than a roar and higher, mostly rasp. */
function growl(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, dur = 0.32): void {
  const f = 170 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, { f: [f * 0.9, f * 1.15, f * 0.9], dur, gain: 0.45 * k, formants: [[420, 2.5, 1], [1000, 4, 0.45], [2200, 5, 0.12]], rasp: [34 + 6 * v, 0.75], attack: 0.03 });
}

/** Its own call, by stage: two chirps, a gravelly hiss, a roar. */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  if (s === 0) {
    chirp(ctx, dest, at, v, k);
    chirp(ctx, dest, at + 0.12, v, k * 0.9, 1.6, 0.08);
  } else if (s === 1) {
    hiss(ctx, dest, at, 1, v, k * 0.8, 0.26);
    growl(ctx, dest, at + 0.12, v, k * 0.7, 0.26);
  } else roar(ctx, dest, at, v, k);
}

/** Jaws snapping shut: a hard knock of stone teeth on stone teeth, and a crunch of grit. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  ring(ctx, dest, at, { freq: 1300 * b.stone + 60 * v, to: 1000 * b.stone, dur: 0.06 + 0.02 * b.s, gain: 0.28 * k, type: 'triangle', attack: 0.001, partials: [[1, 0.6], [1.9, 0.28], [3.2, 0.12]] });
  burst(ctx, dest, at, { dur: 0.05 + 0.03 * b.s, freq: 2400 * b.stone + 600, q: 1.3, gain: 0.24 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: [220, 150, 100][b.s], to: [140, 90, 60][b.s], dur: 0.08 + 0.05 * b.s, gain: 0.22 * k, type: 'sine', attack: 0.002 });
}

/** Grit and chips pattering down: `count` small knocks over `len` seconds, quieter and further apart as they settle. */
function patter(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const u = Math.max(0, (q + 0.4 * Math.sin(q * 5.3 + v * 7)) / count);
    const when = at + len * u ** 1.4, p = pitch * (0.8 + 0.45 * Math.abs(Math.sin(q * 2.7 + v)));
    ring(ctx, dest, when, { freq: 2300 * p, dur: 0.03, gain: 0.12 * k * (1 - 0.6 * u), type: 'triangle', partials: [[1, 0.7], [2.32, 0.3]] });
    burst(ctx, dest, when, { dur: 0.025, freq: 4000 * p, q: 1.6, gain: 0.08 * k * (1 - 0.6 * u) });
  }
}

/** The slam: a deep boom falling away, a thud of the body coming down, the ground cracking, and grit falling after it. */
function slam(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  ring(ctx, dest, at, { freq: [150, 105, 72][b.s], to: [70, 48, 34][b.s], dur: [0.3, 0.45, 0.65][b.s], gain: [0.42, 0.5, 0.58][b.s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.16 + 0.1 * b.s, freq: 900, to: 150, q: 0.7, gain: (0.26 + 0.06 * b.s) * k, type: 'lowpass', attack: 0.002 });
  // The ground cracking: a snap of bright noise, and a second, lower, as the crack runs out.
  burst(ctx, dest, at + 0.006, { dur: 0.06, freq: 2600, to: 1400, q: 1.2, gain: 0.18 * k, attack: 0.001 });
  burst(ctx, dest, at + 0.08, { dur: 0.1, freq: 1500, to: 650, q: 1.1, gain: 0.12 * k, attack: 0.002 });
  // The shock going out: a low rumble swelling a moment after and dying away.
  burst(ctx, dest, at + 0.04, { dur: 0.5 + 0.2 * b.s, freq: 220, to: 90, q: 0.9, gain: 0.12 * k, type: 'lowpass', attack: 0.08 });
  patter(ctx, dest, at + 0.06, 0.35 + 0.2 * b.s, 5 + 2 * b.s, b.stone * 1.2, v, 0.6 * k);
}

/** A swish through the air before a blow, lower and longer for a bigger body. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 600 * pitch, to: 1800 * pitch, q: 0.9, gain: 0.1 * k, attack: len * 0.8 });
}

/**
 * A strike, the bite: a chirp, a hiss or a growl as it draws back with its jaw open, the lunge through the air, and the jaws snapped
 * shut with a knock of stone teeth; the Cragjaws roars as it draws back.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [1.3, 1.1, 0.9][b.s]), T = ACT_SECS.strike, hit = at + CRAG_STRIKE.snap * T;
  if (b.s === 0) chirp(ctx, out, at + 0.02, v, 0.9, 1.5, 0.1);
  else if (b.s === 1) hiss(ctx, out, at + 0.02, 1, v, 0.9, 0.18);
  else roar(ctx, out, at, v, 0.75, 0.3);
  const lunge = at + CRAG_STRIKE.lunge * T;
  swish(ctx, out, lunge, hit - lunge, b.pitch * 1.4, 1);
  snap(ctx, out, hit, b.s, v, 1);
  // The fore feet coming down under the lunge.
  ring(ctx, out, hit + 0.02, { freq: [180, 120, 80][b.s], to: [110, 70, 46][b.s], dur: 0.08 + 0.05 * b.s, gain: 0.16, type: 'sine', attack: 0.003 });
};

/**
 * A go at its post: a soft click of the tongue as it flicks on the two smaller ones, and a hiss, low and gravelly, with its jaw
 * parted; on the Cragjaws a low rumble in its chest instead.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [0.9, 0.85, 0.8][b.s]), T = ACT_SECS.work;
  if (b.s < 2) {
    click(ctx, out, at + CRAG_WORK.flick * T, 1.2 - 0.2 * b.s, 0.6);
    click(ctx, out, at + (CRAG_WORK.flick + 0.14) * T, 1.1 - 0.2 * b.s, 0.5);
    hiss(ctx, out, at + (CRAG_WORK.hiss - 0.08) * T, b.s, v, 0.45, 0.2);
  } else {
    voiced(ctx, out, at + (CRAG_WORK.hiss - 0.1) * T, { f: [70, 78, 66], dur: 0.32, gain: 0.35, formants: [[160, 2, 1], [360, 3, 0.5]], rasp: [22, 0.7], attack: 0.06 });
  }
};

/**
 * Its stun: its call as it rears -- a chirp, a growl, a roar -- the tail and fore feet swinging up, and the slam as they come down,
 * the ground booming and cracking and grit pattering after.
 */
const cast = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [1.3, 1.1, 0.95][b.s]), T = ACT_SECS.cast, hit = at + CRAG_CAST.slam * T;
  if (b.s === 0) {
    chirp(ctx, out, at + 0.05, v, 0.9, 1.3, 0.12);
    chirp(ctx, out, at + 0.2, v, 0.8, 1.7, 0.1);
  } else if (b.s === 1) growl(ctx, out, at + 0.04, v, 0.9, 0.36);
  else roar(ctx, out, at + 0.02, v, 0.9, 0.42);
  const top = at + CRAG_CAST.top * T;
  swish(ctx, out, top, hit - top, b.pitch * 1.2, 1.2);
  slam(ctx, out, hit, b.s, v, 1);
};

/**
 * Evolving, a cue the length of the act: a crack and grit as the stone bursts off it, then a grinding of stone on stone building as
 * the chips swirl in, to the flash at its middle, where a low struck bell of rock rings under a clear note -- each stage's lower than
 * the last -- and then its own call, the chirps, the hiss or the roar of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.6);
  const b = bodyOf(stage, v), s = b.s, key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at, { dur: 0.14, freq: 1400, to: 500, q: 0.8, gain: 0.2, attack: 0.008 });
  patter(ctx, dest, at + 0.02, 0.3, 7, 1.1, v, 0.6);
  burst(ctx, dest, at + 0.12, { dur: flash - 0.12, freq: 360 * key, to: 900 * key, q: 1.4, gain: 0.12, attack: (flash - 0.12) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.25 + (flash - 0.3) * (1 - (1 - u) ** 1.6);
    click(ctx, dest, when, b.stone * (0.9 + 0.3 * u), 0.3 + 0.3 * u);
  }
  [392, 523, 659].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.07, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2.76, 0.2], [5.4, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 196 * key, dur: 1.0, gain: 0.16, type: 'sine', attack: 0.02, partials: [[1, 0.6], [2.4, 0.25], [3.9, 0.1], [5.6, 0.05]] });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.45, gain: 0.05, type: 'sine', attack: 0.018, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 90 - 15 * s, to: 50 - 8 * s, dur: 0.35, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.3, s, v, 0.6);
};

export const CRAG_VOICE: Voice = { strike, work, cast, evolve };
