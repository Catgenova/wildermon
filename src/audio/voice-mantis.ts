import { ACT_SECS } from '../render/beasts';
import { MANTIS_HITS, MANTIS_WORK } from '../render/wild-mantis';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sprigmant's voice, and its stages' (the species is `grazza`): a mantis. It has no call but its body: the dry click of its
 * forelegs snapping shut, the papery rustle of its wings, and the hiss of a blade through grass. The Sprigmant's are small and
 * high -- a tick, a thin swish; the Petalblade's fuller, its four wings a flutter of paper as they flare; the Bloomreaper's
 * heavy, a deep whoosh as its blades come down and a hard shearing clack at the blow.
 *
 * A swish is noise through a band that falls as the blade passes; a rustle is a run of short bright bursts, each a dry wing
 * turning; a click is a short high ring with a crack of noise on it. Every cue lands where its picture does (`./wild-mantis`):
 * the snap on `MANTIS_HITS`; each sweep through the grass on `MANTIS_WORK.cuts`, the gathering and the sheaf set down after them;
 * and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down it is, how heavy, which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A blade through the air or the grass: a band of noise swept down from `f` as it passes, `dur` long. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.35, q: 1.1, gain: 0.2 * k, attack: dur * 0.45 });
}

/** Grass cut: a crisp shearing hiss, high and short, with a dry tick in it. */
function shear(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.07, freq: 5200 * pitch, to: 3000 * pitch, q: 1.6, gain: 0.14 * k, attack: 0.004 });
  burst(ctx, dest, at + 0.015, { dur: 0.05, freq: 2400 * pitch, q: 2.2, gain: 0.08 * k, attack: 0.002 });
}

/** Its forelegs snapping shut: a dry click, a short high ring with a crack of noise, deeper and harder for a bigger body. */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, heavy: number, k: number): void {
  ring(ctx, dest, at, { freq: 2600 * pitch, to: 1700 * pitch, dur: 0.035 + 0.03 * heavy, gain: 0.22 * k, type: 'triangle', attack: 0.001 });
  burst(ctx, dest, at, { dur: 0.03 + 0.03 * heavy, freq: 3400 * pitch, q: 1.4, gain: 0.2 * k, attack: 0.001 });
  if (heavy > 0.6) burst(ctx, dest, at + 0.005, { dur: 0.09, freq: 900 * pitch, to: 400 * pitch, q: 0.9, gain: 0.16 * k * heavy, attack: 0.002 });
}

/** Dry wings turning: `n` short bright bursts over `dur`, a papery flutter. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const when = at + (dur * q) / n + 0.012 * Math.sin(q * 4.1 + v * 7);
    burst(ctx, dest, when, { dur: 0.04, freq: (3800 + 1400 * Math.abs(Math.sin(q * 2.3 + v))) * pitch, q: 1.3, gain: (0.05 + 0.03 * Math.abs(Math.sin(q * 1.7))) * k, attack: 0.003 });
  }
}

/**
 * A strike. The Sprigmant: a tick as its forelegs cock, a thin swish and a sharp click as they snap shut. The Petalblade: its
 * wings rustling up as they flare, a fuller swish and a click. The Bloomreaper: its wings rustling, a deep whoosh as both blades
 * come down from over its head, and a hard shearing clack at the blow.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [1.6, 1.45, 1.3][b.s]), T = ACT_SECS.strike, hit = at + MANTIS_HITS[b.s] * T;
  if (b.s > 0) rustle(ctx, out, at + 0.04, hit - at - 0.1, 5 + 3 * b.s, b.pitch * 1.2, v, 0.8 + 0.3 * b.s);
  else ring(ctx, out, at + 0.12, { freq: 3000, dur: 0.025, gain: 0.08, type: 'triangle', attack: 0.001 });
  swish(ctx, out, hit - 0.08 - 0.05 * b.s, 0.1 + 0.07 * b.s, 2600 * b.pitch, 0.8 + 0.4 * b.s);
  click(ctx, out, hit, b.pitch, b.heavy, 1);
  if (b.s === 2) {
    // The second blade a beat behind the first, and a low thud as the slash ends.
    click(ctx, out, hit + 0.035 * T, b.pitch * 0.94, b.heavy, 0.7);
    ring(ctx, out, hit + 0.02, { freq: 120, to: 70, dur: 0.18, gain: 0.18, type: 'sine', attack: 0.004 });
  }
};

/**
 * A go at its task: a swish and the crisp shear of cut grass at each of its three sweeps, a rustle as it gathers the clippings into
 * its forelegs, and the soft thud of the sheaf set down on its heap.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [1.7, 1.7, 1.65][b.s]), T = ACT_SECS.work, W = MANTIS_WORK;
  W.cuts.forEach((c, q) => {
    swish(ctx, out, at + c * T, 0.12 * T + 0.02, (2200 + 300 * q) * b.pitch, 0.7 + 0.3 * b.heavy);
    shear(ctx, out, at + (c + 0.05) * T, b.pitch * (1 + 0.05 * q), 1);
  });
  rustle(ctx, out, at + W.gather * T, 0.14 * T, 6, b.pitch * 0.7, v, 0.9);
  const set = at + (W.set + 0.03) * T;
  burst(ctx, out, set, { dur: 0.1 + 0.05 * b.s, freq: 900 * b.pitch, to: 300 * b.pitch, q: 0.8, gain: 0.14, type: 'lowpass', attack: 0.006 });
  rustle(ctx, out, set, 0.06, 3, b.pitch * 0.6, v, 0.6);
};

/**
 * Evolving, a cue the length of the act: its wings rustling faster and higher as the light gathers, to the flash at its middle,
 * where a clear chime rings over a soft low swell -- each stage's lower than the last -- and then the click of what it has
 * become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.8);
  const b = bodyOf(stage, v), key = [1, 0.84, 0.7][b.s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 14; q++) {
    const u = q / 14, when = at + 0.1 + (flash - 0.16) * (1 - (1 - u) ** 1.6);
    burst(ctx, dest, when, { dur: 0.04, freq: (2400 + 3000 * u) * key, q: 1.4, gain: 0.03 + 0.05 * u, attack: 0.003 });
  }
  ring(ctx, dest, at + flash, { freq: 1760 * key, dur: 0.6, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [440, 554, 659]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 100 - 15 * b.s, to: 56 - 8 * b.s, dur: 0.45, gain: 0.2, type: 'sine', attack: 0.015 });
  click(ctx, dest, at + flash + 0.4, b.pitch, b.heavy, 0.8);
};

export const MANTIS_VOICE: Voice = { strike, work, evolve };
