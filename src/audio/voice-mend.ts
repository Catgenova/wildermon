import { ACT_SECS } from '../render/beasts';
import { MEND_HITS, MEND_WORK } from '../render/wild-mend';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Stitchkit's voice, and its stages' (the species is `tinka`): a
 * raccoon's chitter and churr -- a run of quick bright chirps for the little
 * one, lower and with a purring churr under it for the Patchcoon, and for the
 * Mendermask a deep rolling churr round 200 Hz with a slow chitter over it --
 * over the clink of a spanner on metal, the tonk of a mallet's stone on a
 * helmet, the ratchet of a nut being turned, the swish of a cloth, and on
 * the big one the rattle of its pack and the jingle of the lantern's chain.
 * A chirp is a triangle sliding up and down through a small throat; a churr
 * is a buzz through a chest resonance with a fast flutter in its loudness.
 * Steel is a struck bar: partials that belong to no scale.
 *
 * Every cue lands where its picture does (`./wild-mend`): the strike on
 * `MEND_HITS`, each pull, tap, turn and wipe of a go at its task on
 * `MEND_WORK`, and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding in pitch through a throat's resonances under an envelope, with a flutter in its loudness. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  flutter?: readonly [number, number];
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
  if (o.flutter) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = o.flutter[0];
    depth.gain.value = o.flutter[1] * 0.5;
    shake.gain.value = 1 - o.flutter[1] * 0.5;
    lfo.connect(depth).connect(shake.gain);
    stops.push(lfo);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.5));
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

/** How a stage sounds: how far down its voice is, how far down its tools ring, and how heavy it is. */
function bodyOf(stage: number, v: number): { pitch: number; tool: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.7, 0.42][s] * (0.94 + 0.12 * v), tool: [1.2, 1, 0.8][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** One chirp of a chitter: a quick bright rise and fall through a small throat. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  voiced(ctx, dest, at, { f: [f * 0.82, f * 1.25, f * 0.95], dur, gain: 0.2 * k, type: 'triangle', formants: [[f * 1.1, 2.5, 1], [f * 2.3, 4, 0.35]], attack: 0.008 });
}

/**
 * Its own call, by stage. The Stitchkit: a chitter, five quick bright chirps tumbling down, the last a little longer. The Patchcoon:
 * a churr -- a purring buzz round 300 Hz -- and four chirps over it, lower. The Mendermask: a deep churr round 110 Hz, its
 * harmonics brought up through a chest resonance from 150 to 300 Hz so a small speaker carries it, rolling in a slow flutter,
 * with three slow low chirps over its end.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 2100 * b.pitch;
    for (let q = 0; q < 5; q++) chirp(ctx, dest, at + q * 0.055, f * (1.08 - 0.05 * q), q === 4 ? 0.09 : 0.05, k * (q === 4 ? 1.0 : 1.1));
    return;
  }
  if (b.s === 1) {
    const f = 300 * b.pitch / 0.7;
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.08, f * 0.92], dur: 0.3, gain: 0.3 * k, formants: [[300, 3, 1], [700, 3, 0.7], [1500, 4, 0.25]], flutter: [26 + 4 * v, 0.7], attack: 0.03 });
    for (let q = 0; q < 4; q++) chirp(ctx, dest, at + 0.08 + q * 0.07, 1450 * b.pitch / 0.7 * (1.05 - 0.05 * q), 0.055, k * 0.8);
    return;
  }
  const f = 110 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, { f: [f * 0.92, f * 1.1, f * 0.96, f * 0.84], dur: 0.62, gain: 0.32 * k, formants: [[120, 2, 0.5], [190, 3.5, 1.5], [270, 3.5, 1.2], [520, 3, 0.4], [1100, 4, 0.08]], flutter: [19, 0.7], attack: 0.05 });
  ring(ctx, dest, at + 0.03, { freq: f * 0.5, to: f * 0.45, dur: 0.55, gain: 0.1 * k, type: 'sine', attack: 0.04 });
  for (let q = 0; q < 3; q++) chirp(ctx, dest, at + 0.38 + q * 0.1, 900 * (1 - 0.06 * q), 0.07, k * 0.55);
}

/** Steel on metal: a spanner's clink, a bright inharmonic ring and a click of noise. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  // The strike itself a hard click, a few milliseconds of bright noise and a knock under it, then the bar's ring.
  burst(ctx, dest, at, { dur: 0.012, freq: 5200 * pitch, q: 0.8, gain: 0.34 * k, attack: 0.0005 });
  ring(ctx, dest, at, { freq: 900 * pitch, to: 700 * pitch, dur: 0.03, gain: 0.16 * k, type: 'triangle', attack: 0.0005 });
  ring(ctx, dest, at, { freq: 2300 * pitch, dur: 0.32, gain: 0.16 * k, type: 'sine', attack: 0.001, partials: [[1, 0.55], [2.76, 0.3], [5.4, 0.15]] });
  burst(ctx, dest, at, { dur: 0.03, freq: 4200 * pitch, q: 1.5, gain: 0.12 * k, attack: 0.001 });
}

/** A stone mallet on a steel helmet: a duller tonk, the helmet ringing low under the knock. */
function tonk(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.014, freq: 3000 * pitch, q: 0.7, gain: 0.3 * k, attack: 0.0005 });
  ring(ctx, dest, at, { freq: 620 * pitch, to: 590 * pitch, dur: 0.3, gain: 0.2 * k, type: 'sine', attack: 0.0008, partials: [[1, 0.6], [2.32, 0.28], [4.1, 0.12]] });
  ring(ctx, dest, at, { freq: 180 * pitch, to: 120 * pitch, dur: 0.1, gain: 0.2 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.05, freq: 1400 * pitch, to: 500, q: 0.9, gain: 0.14 * k, attack: 0.001 });
}

/** A nut turned under a spanner: a ratchet's run of small clicks, `count` of them over `len` seconds. */
function ratchet(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, pitch: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const t = at + (len * q) / count;
    burst(ctx, dest, t, { dur: 0.018, freq: 3200 * pitch, q: 4, gain: 0.12 * k, attack: 0.001 });
    ring(ctx, dest, t, { freq: 1700 * pitch, dur: 0.04, gain: 0.03 * k, type: 'triangle', attack: 0.001 });
  }
}

/** A cloth drawn over metal: a soft swish of high noise, rising and falling. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2600, to: 3600, q: 0.8, gain: 0.08 * k, attack: dur * 0.45 });
}

/** A swing through the air: a band of noise rising to the blow, lower and longer for a bigger body. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, s: number, len: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: [700, 520, 380][s], to: [1900, 1500, 1100][s], q: 0.9, gain: 0.13 * k, attack: len * 0.8 });
}

/** The pack: leather creaking and the tools in it rattling, a thump and a scatter of small clinks. */
function rattle(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.12, freq: 260, to: 150, q: 0.9, gain: 0.16 * k, type: 'lowpass', attack: 0.004 });
  for (let q = 0; q < 5; q++) {
    const t = at + 0.012 + q * 0.03 + 0.01 * Math.sin(q * 5.1 + v * 7);
    ring(ctx, dest, t, { freq: (1500 + 700 * Math.abs(Math.sin(q * 2.3 + v))), dur: 0.08, gain: 0.04 * k * (1 - 0.12 * q), type: 'sine', attack: 0.001, partials: [[1, 0.6], [2.76, 0.3], [5.4, 0.1]] });
  }
}

/** The lantern's chain: a little run of bright jingles. */
function jingle(ctx: BaseAudioContext, dest: AudioNode, at: number, count: number, k: number): void {
  for (let q = 0; q < count; q++) ring(ctx, dest, at + q * 0.045, { freq: 3800 + 500 * Math.sin(q * 2.1), dur: 0.12, gain: 0.035 * k, type: 'sine', attack: 0.001, partials: [[1, 0.7], [2.4, 0.3]] });
}

/**
 * A strike, each landing with a thump of the body's weight behind it. The Stitchkit chitters and its spanner comes down with a clink; the Patchcoon churrs, the mallet whooshes down and
 * lands with a tonk; the Mendermask churrs deep as it winds round, the wrench whooshes across and lands with a heavy clank, its
 * pack rattling and the lantern's chain jingling after.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.12, 1.1, 0.75][s]), b = bodyOf(stage, v);
  const hit = at + MEND_HITS[s] * ACT_SECS.strike;
  call(ctx, out, at + 0.01, s, v, s === 2 ? 1.2 : s === 0 ? 0.6 : 0.75);
  whoosh(ctx, out, hit - 0.12 - 0.02 * s, s, 0.12 + 0.02 * s, 1);
  if (s === 1) tonk(ctx, out, hit, 1, 1.3);
  else clink(ctx, out, hit, b.tool, 1.2);
  // Its weight coming down behind the blow: a light thump of its body for the little one, heavier for the bigger.
  ring(ctx, out, hit + 0.01, { freq: [170, 130, 95][s], to: [90, 70, 50][s], dur: [0.09, 0.12, 0.16][s], gain: [0.22, 0.26, 0.3][s], type: 'sine', attack: 0.002 });
  burst(ctx, out, hit + 0.01, { dur: 0.06, freq: 500, to: 180, q: 0.7, gain: 0.1, type: 'lowpass', attack: 0.002 });
  if (s === 2) {
    // A heavy clank under the clink: the big wrench's weight.
    ring(ctx, out, hit, { freq: 240, to: 180, dur: 0.22, gain: 0.22, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.76, 0.2], [5.4, 0.1]] });
    rattle(ctx, out, hit + 0.04, v, 1);
    jingle(ctx, out, hit + 0.08, 4, 1);
  }
};

/**
 * A go at its task. The Stitchkit: the clink of the gear off its belt, three ratchet pulls on the nut each
 * ending in a clink, a pleased chitter, and the gear hooked back. The Patchcoon: the helmet off its belt,
 * three tonks of the mallet on it, a small churr as it looks it over. The Mendermask: its pack rattling and
 * the lantern jingling as it bends, the helmet set down with a dull tonk, two ratchet turns of the wrench,
 * two swishes of the cloth, the helmet picked up, and its churr.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.5, 1.4, 1.35][s]), b = bodyOf(stage, v), W = MEND_WORK, T = ACT_SECS.work;
  if (s === 0) {
    // The gear unhooked from the belt, a small clink, and hooked back on at the end.
    clink(ctx, out, at + W.hang * T, b.tool * 1.3, 0.35);
    clink(ctx, out, at + W.back * T, b.tool * 1.3, 0.3);
    for (const t of W.pulls) {
      ratchet(ctx, out, at + (t - 0.1) * T, 0.1 * T, 4, b.tool, 1);
      clink(ctx, out, at + t * T, b.tool * 1.1, 0.6);
    }
    call(ctx, out, at + (W.pulls[2] + 0.14) * T, 0, v, 0.4);
    return;
  }
  if (s === 1) {
    burst(ctx, out, at + W.hang * T, { dur: 0.06, freq: 900, to: 500, q: 0.9, gain: 0.08, attack: 0.004 });
    for (const t of W.taps) tonk(ctx, out, at + t * T, 1.05, 1);
    call(ctx, out, at + (W.look - 0.06) * T, 1, v, 0.45);
    return;
  }
  rattle(ctx, out, at + 0.2 * T, v, 0.9);
  jingle(ctx, out, at + 0.21 * T, 4, 1.1);
  // The helmet set down on the ground, and picked up again.
  tonk(ctx, out, at + W.set * T, 0.8, 0.7);
  burst(ctx, out, at + W.lift * T, { dur: 0.06, freq: 900, to: 500, q: 0.9, gain: 0.08, attack: 0.004 });
  for (const t of W.turns) ratchet(ctx, out, at + (t - 0.08) * T, 0.08 * T, 4, b.tool, 1.1);
  for (const t of W.wipes) swish(ctx, out, at + (t - 0.08) * T, 0.12 * T, 1.3);
  jingle(ctx, out, at + W.rise * T, 3, 1);
  call(ctx, out, at + (W.rise - 0.1) * T, 2, v, 0.7);
};

/**
 * Evolving, a cue the length of the act: a scatter of clinks as bolts and gears swirl round it, quickening and rising to the
 * flash at its middle, where a brass chime rings -- each stage's lower than the last -- and then its own call, the chitter or
 * the churr of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, stage <= 0 ? 1.55 : 1.85);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 500 * key, to: 1600 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    clink(ctx, dest, when, b.tool * (0.85 + 0.35 * u), 0.3 + 0.4 * u);
  }
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + flash + q * 0.06, { freq: f * key, dur: 0.9, gain: 0.07, type: 'sine', attack: 0.01, partials: [[1, 0.7], [2.76, 0.18], [5.4, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 196 * key, dur: 1.0, gain: 0.14, type: 'sine', attack: 0.015, partials: [[1, 0.6], [2, 0.25], [3, 0.1]] });
  call(ctx, dest, at + flash + 0.3, s, v, 0.7);
};

export const MEND_VOICE: Voice = { strike, work, evolve };
