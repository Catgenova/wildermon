import { ACT_SECS } from '../render/beasts';
import { VANARI_PICK, VANARI_THROW } from '../render/wild-vanari';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Vanari's voice, and its stages' (the species is `plucka`): a sifaka's
 * calls -- the kit's high squeak, the Orchibelle's sneezing "shi-fak", a
 * hiss and a click, and the Arboanari's deep honking bark, round 220 Hz --
 * over the rustle of the leaves of the tree it picks, the snap of a fruit's
 * stalk, the soft thump of an orange into the wicker, the swish of a throw
 * and the wet burst of an orange on what it hits.
 *
 * A call is a buzz sliding in pitch through a small throat's resonances; the
 * "shi" of a "shi-fak" is a hiss of high noise, the "fak" a short voiced
 * click after it. A rustle is noise, high and soft, in a few quick swells; a
 * stalk's snap is a click of bright noise with a short woody knock under it;
 * a burst orange is a low wet thump under a spray of noise. The bigger the
 * body, the lower each of them.
 *
 * Every cue lands where its picture does (`./wild-vanari`): the release and
 * the burst of the throw on `VANARI_THROW`, the reach, the two tugs, the
 * pluck and the drop into the basket of a go at its task on `VANARI_PICK`,
 * and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, through a throat's resonances, under an envelope. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
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
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
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
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** How a stage sounds: how far down its voice is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Vanari's: two high squeaks rising, round 1100 Hz. The Orchibelle's: a "shi-fak", a hiss and then a
 * short voiced click falling, round 600 Hz. The Arboanari's: the same, deeper, then a honking bark, round 220 Hz, swelled
 * through a chest resonance.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1100 * b.pitch;
    for (const [d, up] of [[0, 1.25], [0.15, 1.35]] as const) {
      voiced(ctx, dest, at + d, { f: [f * 0.9, f * up, f * 1.1], dur: 0.1, gain: 0.45 * k, formants: [[1800, 3, 1], [3600, 4, 0.35]], type: 'triangle', attack: 0.01 });
    }
    return;
  }
  const f = 600 * b.pitch;
  burst(ctx, dest, at, { dur: 0.12 + 0.04 * b.s, freq: 4200 * (0.8 + 0.2 * b.pitch), to: 3000, q: 1, gain: 0.16 * k, attack: 0.03 });
  voiced(ctx, dest, at + 0.13 + 0.03 * b.s, { f: [f * 1.2, f * 0.85], dur: 0.08, gain: 0.4 * k, formants: [[900 * b.pitch + 300, 2.5, 1], [2000 * b.pitch + 400, 3, 0.4]], attack: 0.004 });
  if (b.s === 2) {
    const g = 220 * (0.95 + 0.1 * v);
    voiced(ctx, dest, at + 0.32, { f: [g * 1.1, g * 1.25, g * 0.85], dur: 0.36, gain: 0.3 * k, formants: [[340, 2, 1], [700, 2.5, 0.8], [1400, 3, 0.25]], attack: 0.03 });
    ring(ctx, dest, at + 0.32, { freq: g * 0.5, to: g * 0.4, dur: 0.36, gain: 0.06 * k, type: 'sine', attack: 0.04 });
  }
}

/** Leaves rustling: soft high noise in `n` quick swells over `dur`, lower for a bigger body. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const u = (q + 0.4 * Math.abs(Math.sin(q * 2.7 + v * 7))) / n;
    burst(ctx, dest, at + dur * u, { dur: dur / n + 0.05, freq: (3400 + 900 * Math.sin(q * 1.9 + v * 3)) * (0.75 + 0.25 * pitch), to: 2200 * (0.75 + 0.25 * pitch), q: 1.1, gain: 0.12 * k, attack: 0.012 });
  }
}

/** A fruit's stalk snapping: a click of bright noise and a short woody knock under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.035, freq: 3600, q: 1.4, gain: 0.2 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 1100 * (0.8 + 0.2 * pitch), to: 800, dur: 0.05, gain: 0.12 * k, type: 'triangle', attack: 0.001 });
}

/** An orange dropped into the basket: a soft round thump and the creak of the wicker. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [240, 190, 150][s], to: [130, 100, 80][s], dur: 0.09, gain: 0.22 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at + 0.01, { dur: 0.08, freq: 1500, to: 900, q: 3, gain: 0.08 * k, attack: 0.004 });
}

/** A swish through the air as it throws, lower and longer for a bigger body. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 700 * pitch, to: 2400 * pitch, q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/** An orange bursting on what it hits: a low wet thump under a spray of noise that falls away. */
function splat(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [200, 160, 130][s], to: [90, 70, 55][s], dur: 0.1, gain: 0.26 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at, { dur: 0.18, freq: 1800, to: 600, q: 0.8, gain: 0.18 * k, attack: 0.003 });
  burst(ctx, dest, at + 0.03, { dur: 0.12, freq: 4200, to: 2600, q: 1.2, gain: 0.08 * k, attack: 0.004 });
}

/**
 * A strike: the rustle of its paw in the leaves of the basket as it takes an orange out, a swish as it throws, and the orange
 * bursting on what it hits; the Orchibelle and the Arboanari call as they throw.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.0, 2.6, 2.2][s]), b = bodyOf(stage, v), T = ACT_SECS.strike, W = VANARI_THROW;
  rustle(ctx, out, at + (W.grab - 0.08) * T, 0.1, 2, b.pitch, v, 0.8);
  swish(ctx, out, at + (W.release - 0.12) * T, 0.12 * T, b.pitch, 1);
  splat(ctx, out, at + W.hit * T, s, 1);
  if (s > 0) call(ctx, out, at + (W.release - 0.1) * T, s, v, 0.3);
};

/**
 * A go at its task: the leaves of the tree rustling as its paw goes up into them and at each of its two tugs, the snap of the
 * stalk as the fruit comes off, a rustle of leaves, the thump of the orange into the basket, and a soft squeak over it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.4, 3.2, 3.0][s]), b = bodyOf(stage, v), P = VANARI_PICK, T = ACT_SECS.work;
  rustle(ctx, out, at + 0.1 * T, (P.reach - 0.1) * T, 3, b.pitch, v, 0.9);
  P.tugs.forEach((u, q) => rustle(ctx, out, at + (u - 0.03) * T, 0.1, 2, b.pitch, v + q, 1));
  snap(ctx, out, at + P.pluck * T, b.pitch, 1);
  rustle(ctx, out, at + P.pluck * T + 0.02, 0.16, 2, b.pitch, v + 3, 0.7);
  thump(ctx, out, at + P.drop * T, s, 1);
  if (v > 0.35) call(ctx, out, at + (P.drop + 0.06) * T, 0, v, 0.18 * (1 - 0.3 * s));
};

/**
 * Evolving, a cue the length of the act: its leaves rustling faster and higher as the swirl gathers, to the flash at its middle,
 * where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the squeak, the
 * "shi-fak" or the bark of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 8; q++) {
    const u = q / 8;
    rustle(ctx, dest, at + 0.08 + (flash - 0.2) * u, 0.12, 2, b.pitch * (0.8 + 0.5 * u), v + q, 0.5 + 0.6 * u);
  }
  [440, 554, 659].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1760 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [440, 554, 659]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 110 - 15 * s, to: 60 - 8 * s, dur: 0.4, gain: 0.18, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const VANARI_VOICE: Voice = { strike, work, evolve };
