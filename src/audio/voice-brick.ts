import { ACT_SECS } from '../render/beasts';
import { BASTION_SLAM, BRICK_HITS, BRICK_WORK } from '../render/wild-brick';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Brickling's voice, and its stages' (the species is `cobbe`): a little
 * salamander's chirp, a lizard's gravelly croak and a drake's grinding
 * rumble, over the clink and knock of brick on brick and the scrape of a
 * trowel. A voiced sound is a buzz sliding in pitch through a throat's
 * resonances; the bigger two have a grind in theirs, a fast rough flutter
 * in its loudness, which is stone rubbing on stone. Brick is a short dull
 * ring that belongs to no scale, lower and less bright than the chip line's
 * stone, over a burst of filtered noise; mortar is wet grit, noise under a
 * low band.
 *
 * Every cue lands where its picture does (`./wild-brick`): the strike on
 * `BRICK_HITS` and the Bastiondrake's tail on `BASTION_SLAM`, each tap,
 * pat, stroke, tap, heave, seat and stamp of a go at its task on
 * `BRICK_WORK`, and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz through a throat's resonances under an envelope, with a grind (a flutter in its loudness) in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  grind?: readonly [number, number];
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
  const stops: AudioScheduledSourceNode[] = [osc];
  if (o.grind) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = o.grind[0];
    depth.gain.value = o.grind[1] * 0.5;
    flutter.gain.value = 1 - o.grind[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    stops.push(lfo);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.02;
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
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** How a stage sounds: how far down its voice is, how far down its brick rings, how long it draws a sound out, and how heavy it is. */
function bodyOf(stage: number, v: number): { pitch: number; brick: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.5, 0.3][s] * (0.94 + 0.12 * v), brick: [1, 0.72, 0.5][s], long: [1, 1.35, 1.8][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Brickling's chirp: two quick bright rising peeps through a small throat. The Mortarback's croak:
 * a gravelly buzz round 200 Hz, ground by a fast flutter. The Bastiondrake's rumble: a deep grinding buzz round 90 Hz that
 * swells and sinks, a growl under it an octave down.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1150 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.85, f * 1.4, f * 1.15], dur: 0.08, gain: 0.21 * k, type: 'triangle', formants: [[1500, 3, 1], [3200, 5, 0.4]], attack: 0.018 });
    voiced(ctx, dest, at + 0.1, { f: [f, f * 1.55, f * 1.2], dur: 0.1, gain: 0.185 * k, type: 'triangle', formants: [[1600, 3, 1], [3400, 5, 0.4]], attack: 0.018 });
    return;
  }
  if (b.s === 1) {
    const f = 400 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.15, f * 0.85], dur: 0.26, gain: 0.42 * k, formants: [[220, 3, 0.8], [480, 2.5, 1], [1150, 4, 0.45], [2400, 5, 0.12]], grind: [38 + 6 * v, 0.6], attack: 0.03 });
    return;
  }
  const f = 300 * b.pitch;
  // A buzz round 90 Hz, its harmonics brought up through a chest resonance from 150 to 300 Hz so the rumble is heard on a small
  // speaker that plays nothing under a hundred and fifty, its fundamental still under them where a speaker can give it.
  voiced(ctx, dest, at, { f: [f * 0.85, f * 1.12, f * 0.9, f * 0.78], dur: 0.6, gain: 0.3 * k, formants: [[95, 2, 0.6], [185, 3.5, 1.5], [270, 3.5, 1.2], [560, 3, 0.45], [1250, 4, 0.1]], grind: [24, 0.6], attack: 0.06 });
  ring(ctx, dest, at + 0.04, { freq: f * 0.5, to: f * 0.4, dur: 0.55, gain: 0.14 * k, type: 'sine', attack: 0.04 });
  burst(ctx, dest, at, { dur: 0.6, freq: 240, to: 130, q: 0.8, gain: 0.07 * k, type: 'lowpass', attack: 0.2 });
}

/** Brick on brick: a short dull knock, inharmonic, lowpassed, with a little grit under it. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 1350 * pitch, to: 1150 * pitch, dur: 0.05, gain: 0.16 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.6], [2.17, 0.28], [3.6, 0.12]] });
  burst(ctx, dest, at, { dur: 0.05, freq: 2200 * pitch, q: 1.2, gain: 0.1 * k, attack: 0.002 });
}

/** A heavier thing set down on brick or ground: a low thump and a dull knock over it, the heavier the lower. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: [190, 130, 85][b.s], to: [100, 62, 38][b.s], dur: [0.12, 0.2, 0.42][b.s], gain: [0.24, 0.34, 0.5][b.s] * k, type: 'sine', attack: 0.003 });
  ring(ctx, dest, at, { freq: 560 * b.brick, to: 440 * b.brick, dur: 0.07 + 0.03 * b.s, gain: 0.16 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.6], [1.9, 0.3], [3.1, 0.1]] });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * b.s, freq: 800 * b.brick, to: 160, q: 0.7, gain: (0.18 + 0.08 * b.s) * k, type: 'lowpass', attack: 0.003 });
}

/** Mortar: wet grit, a short scrape of low noise, falling. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 900, to: 420, q: 1.4, gain: 0.2 * k, attack: dur * 0.3 });
  burst(ctx, dest, at + 0.01, { dur: dur * 0.8, freq: 260, to: 160, q: 0.9, gain: 0.12 * k, type: 'lowpass', attack: dur * 0.3 });
}

/** A trowel scraping: a thin bright band drawn along, with the dull ring of its iron at the end. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2600, to: 1900, q: 3, gain: 0.12 * k, attack: dur * 0.4 });
  ring(ctx, dest, at + dur * 0.8, { freq: 1900, dur: 0.12, gain: 0.04 * k, type: 'sine', attack: 0.004, partials: [[1, 0.6], [2.76, 0.3], [5.4, 0.1]] });
}

/** Grit and crumbs of brick falling and pattering: `count` clinks over `len` seconds, quieter and further apart as they settle. */
function patter(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const u = Math.max(0, (q + 0.4 * Math.sin(q * 5.3 + v * 7)) / count);
    clink(ctx, dest, at + len * u ** 1.4, pitch * (0.85 + 0.4 * Math.abs(Math.sin(q * 2.7 + v))), k * (1 - 0.6 * u) * 0.5);
  }
}

/** A swish through the air, a band of noise rising to the blow, lower and longer for a bigger body. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, len: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: len, freq: 500 * b.brick, to: 1600 * b.brick, q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/**
 * A strike. The Brickling chirps and its crest knocks into what it butts, a clink and a crumble of grit; the Mortarback croaks
 * as its tail swishes round and the blow lands with a dull brick thump; the Bastiondrake rumbles as it rears, its feet come down
 * with a deep thud and a crack of the ground, rubble pattering, and its tail slams down after.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.1, 0.6][s]), b = bodyOf(stage, v);
  const hit = at + BRICK_HITS[s] * ACT_SECS.strike;
  // The drake's rumble louder and its clink quieter, so what is heard of it is the low voice and the thud, not the brick.
  call(ctx, out, at + 0.02, s, v, s === 2 ? 1.27 : 0.7);
  swish(ctx, out, hit - 0.1 - 0.03 * s, s, 0.1 + 0.03 * s, 1);
  thump(ctx, out, hit, s, 1);
  clink(ctx, out, hit, b.brick, s === 2 ? 0.75 : 1.2);
  patter(ctx, out, hit + 0.04, 0.22 + 0.15 * s, 4 + 2 * s, b.brick * 1.1, v, s === 2 ? 0.5 : 0.8);
  if (s === 2) {
    burst(ctx, out, hit + 0.005, { dur: 0.07, freq: 2400, to: 1300, q: 1.2, gain: 0.11, attack: 0.002 });
    thump(ctx, out, at + BASTION_SLAM * ACT_SECS.strike, 2, 0.6);
  }
};

/**
 * A go at its task. The Brickling: two soft taps of its snout on a brick, each a clink with a puff of mortar, and the pat of its
 * paw, a duller knock, then a pleased chirp. The Mortarback: the trowel drawn out of the hod with a wet squelch, two scrapes as it
 * butters the brick, a tap, and the trowel back in with a squelch; a short croak. The Bastiondrake: a grinding heave, the block
 * dropped into its seat with a heavy thump, and the stamp, heavier still, with grit pattering.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 3.6, 0.6][s]), b = bodyOf(stage, v), W = BRICK_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const t of W.taps) {
      clink(ctx, out, at + t * T, b.brick * 1.1, 1);
      squelch(ctx, out, at + t * T + 0.01, 0.06, 0.4);
    }
    thump(ctx, out, at + W.pat * T, 0, 0.6);
    call(ctx, out, at + (W.pat + 0.1) * T, 0, v, 0.35);
    return;
  }
  if (s === 1) {
    squelch(ctx, out, at + W.grip * T, 0.14, 0.9);
    for (const t of W.strokes) scrape(ctx, out, at + t * T - 0.06, 0.1, 1);
    clink(ctx, out, at + W.tap * T, b.brick, 1.1);
    squelch(ctx, out, at + W.stow * T, 0.1, 0.7);
    call(ctx, out, at + (W.stow + 0.04) * T, 1, v, 0.3);
    return;
  }
  voiced(ctx, out, at + (W.heave - 0.12) * T, { f: [70, 92, 80], dur: 0.16 * T + 0.1, gain: 0.25, formants: [[220, 2, 1], [520, 3, 0.4]], grind: [22, 0.75], attack: 0.05 });
  thump(ctx, out, at + W.seat * T, 2, 0.8);
  thump(ctx, out, at + W.stamp * T, 2, 1);
  clink(ctx, out, at + W.stamp * T, b.brick, 0.8);
  patter(ctx, out, at + W.stamp * T + 0.03, 0.3, 5, b.brick * 1.2, v, 0.7);
};

/**
 * Evolving, a cue the length of the act: a crumble of brick bursting off it, then a grinding of brick on brick building as the
 * chips swirl in, clinks quickening in it, rising to the flash at its middle, where they set with a fired-clay chime -- a dull
 * low ring under a clear note -- and then its own call, the chirp, the croak or the rumble of what it has become. Each stage's
 * chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.5);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.82, 0.68][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at, { dur: 0.14, freq: 1200, to: 450, q: 0.8, gain: 0.2, attack: 0.008 });
  patter(ctx, dest, at + 0.02, 0.3, 7, b.brick, v, 0.8);
  burst(ctx, dest, at + 0.12, { dur: flash - 0.12, freq: 260 * key, to: 760 * key, q: 1.4, gain: 0.12, attack: (flash - 0.12) * 0.85 });
  for (let q = 0; q < 9; q++) {
    const u = q / 9, when = at + 0.25 + (flash - 0.3) * (1 - (1 - u) ** 1.6);
    clink(ctx, dest, when, b.brick * (0.9 + 0.3 * u), 0.4 + 0.4 * u);
  }
  [349, 440, 523].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.07, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2.17, 0.2], [3.6, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 175 * key, dur: 1.0, gain: 0.16, type: 'sine', attack: 0.02, partials: [[1, 0.6], [2.17, 0.25], [3.6, 0.1]] });
  ring(ctx, dest, at + flash, { freq: 1397 * key, dur: 0.45, gain: 0.05, type: 'sine', attack: 0.018, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [349, 440, 523]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 90 - 15 * s, to: 50 - 8 * s, dur: 0.35, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const BRICK_VOICE: Voice = { strike, work, evolve };
