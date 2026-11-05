import { ACT_SECS } from '../render/beasts';
import { DEER_HITS, DEER_WORK } from '../render/wild-deer';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Bramblet's voice, and its stages' (the species is `brambo`): the
 * fawn's thin high bleat; the Vinehorn's short bark; the Briarstag's bugle,
 * a whistle sliding up and breaking into grunts. At its work, leaves rustling
 * as it noses into the bush, the soft pop of a cluster of berries coming
 * away, the swish of its toss and the rustle of the cluster landing in its
 * mantle or its basket. Its strike is the hollow knock of wood on wood.
 *
 * A bleat is a nasal tone with a little waver in it, a triangle and a
 * sawtooth together, falling at its end. A bark is a short, rough, low burst
 * of noise over a tone. A bugle is a sine sliding a long way up, its top
 * breaking, and a few short grunts under it. Antlers knocking are a hollow
 * wooden tone and a sharp click over it.
 *
 * Every cue lands where its picture does (`./wild-deer`): the blow on
 * `DEER_HITS`; each nibble, the pluck, the toss and the landing on
 * `DEER_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how long its call, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.46][s] * (0.95 + 0.1 * v), long: [1, 1.2, 1.7][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A fawn's bleat: a thin nasal tone at `f` for `dur`, wavering, falling at its end. */
function bleat(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.82, dur, gain: 0.07 * k, type: 'triangle', attack: dur * 0.15, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  ring(ctx, dest, at, { freq: f * 1.01, to: f * 0.8, dur: dur * 0.9, gain: 0.025 * k, type: 'sawtooth', attack: dur * 0.2 });
  burst(ctx, dest, at, { dur: 0.05, freq: f * 5, q: 2, gain: 0.025 * k, attack: 0.01 });
}

/** A bark: a short rough burst of low noise over a tone at `f`. */
function bark(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.16, freq: f * 3, to: f * 1.6, q: 1.2, gain: 0.08 * k, attack: 0.008 });
  ring(ctx, dest, at, { freq: f, to: f * 0.75, dur: 0.18, gain: 0.08 * k, type: 'sawtooth', attack: 0.01 });
}

/** A bugle: a sine sliding up from `f` to five times it and breaking at its top, then a few short grunts under it. */
function bugle(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 5, dur: dur * 0.7, gain: 0.06 * k, type: 'sine', attack: dur * 0.2, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + dur * 0.62, { freq: f * 5.2, to: f * 3.6, dur: dur * 0.3, gain: 0.04 * k, type: 'triangle', attack: 0.02 });
  for (let q = 0; q < 3; q++) bark(ctx, dest, at + dur * (0.95 + 0.16 * q), f * 0.6, 0.6 * k);
}

/** Leaves rustling: a soft band of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 3600, to: 2400, q: 1.2, gain: 0.05 * k, attack: dur * 0.3 });
}

/** A cluster of berries coming away: a soft round pop and a tick of the twig. */
function pop(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  ring(ctx, dest, at, { freq: 620, to: 380, dur: 0.06, gain: 0.08 * k, type: 'sine', attack: 0.002 });
  burst(ctx, dest, at + 0.01, { dur: 0.02, freq: 3000, q: 6, gain: 0.06 * k, attack: 0.001 });
}

/** Antlers knocking: a hollow wooden tone and a sharp click over it. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur: 0.12, gain: 0.2 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.6], [2.3, 0.3], [4.1, 0.1]] });
  burst(ctx, dest, at, { dur: 0.03, freq: 2400, q: 3, gain: 0.14 * k, attack: 0.001 });
}

/**
 * Its own call, by stage. The Bramblet's: a thin high bleat round 760 Hz. The Vinehorn's: a short bark round 330 Hz and a
 * bleat. The Briarstag's: a bugle sliding up from round 280 Hz and its grunts.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) bleat(ctx, dest, at, 760 * b.pitch, 0.24 * b.long, k);
  else if (b.s === 1) { bark(ctx, dest, at, 500 * b.pitch, k); bleat(ctx, dest, at + 0.2, 900 * b.pitch, 0.2, 0.7 * k); }
  else bugle(ctx, dest, at, 600 * b.pitch, 0.6 * b.long, k);
}

/** A blow: a breath as it gathers itself, the knock of its antlers as it lands, leaves shaken loose, and a bark. */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + DEER_HITS[s] * T;
  burst(ctx, out, at + 0.04, { dur: 0.12, freq: 900 * b.pitch, q: 1, gain: 0.05, attack: 0.04 });
  knock(ctx, out, hit, 520 - 120 * s, 1);
  if (s) knock(ctx, out, hit + 0.06, 470 - 120 * s, 0.6);
  rustle(ctx, out, hit + 0.02, 0.2, 0.9);
  bark(ctx, out, hit + 0.12, 520 * b.pitch, 0.5);
};

/**
 * A go at its task: a rustle at each nibble in the bush, the soft pop of a cluster coming away, a swish as it is tossed, and a
 * rustle as it lands in the mantle or the basket; now and then a little bleat.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4, 3.4, 2.4][s]), b = bodyOf(stage, v), W = DEER_WORK, T = ACT_SECS.work;
  for (const c of W.bites) rustle(ctx, out, at + (c - 0.03) * T, 0.08, 0.9);
  pop(ctx, out, at + W.pluck * T, 1);
  burst(ctx, out, at + (W.toss - 0.03) * T, { dur: 0.12, freq: 1400, to: 3200, q: 1.5, gain: 0.04, attack: 0.04 });
  rustle(ctx, out, at + W.land * T, 0.12, 1);
  if (v > 0.6) bleat(ctx, out, at + 0.86 * T, 800 * b.pitch, 0.14, 0.35);
};

/**
 * Evolving, a cue the length of the act: leaves rustling in, a rising sweep to the flash at its middle, where a clear chime rings
 * over a deep swell -- each stage's lower than the last -- and then its own call, the voice of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.1 + q * (flash - 0.2) / 6, 0.12, 0.5 + 0.1 * q);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 4000 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.8);
};

export const DEER_VOICE: Voice = { strike, work, evolve };
