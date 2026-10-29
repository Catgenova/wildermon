import { ACT_SECS } from '../render/beasts';
import { SPIDER_HITS, SPIDER_WORK } from '../render/wild-spider';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sprindle's voice, and its stages' (the species is `ulva`): soft
 * clicks, a chirrup, and a purring trill, the Silkward's deeper and slower;
 * at its work, the zip of thread drawn out and the soft thrum of a spindle
 * or a ball turning.
 *
 * A click is a short band of noise, high and narrow, the sound of small
 * mouthparts; a chirrup is a sine swooping up and back in a few quick
 * steps; a purr is a low triangle wave whose loudness flutters twenty-odd
 * times a second, which is what a trill is. The bigger the body, the lower
 * all of it, the Silkward's purr round 110 Hz where a small speaker still
 * plays it. A thread drawn out is a band of noise sweeping up, a zip; a
 * spindle's thrum a low hum with a slow flutter as it turns.
 *
 * Every cue lands where its picture does (`./wild-spider`): the pounce on
 * `SPIDER_HITS`; each turn of the Sprindle's ball, the Webloom's spindle
 * let down, flicked and caught, the Silkward's two draws of silk, its skein
 * let fall and landing, on `SPIDER_WORK`; and the evolving chime on the
 * flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.74, 0.48][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A click: a short high tick of noise. */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.018, freq: f, q: 6, gain: 0.16 * k, attack: 0.001 });
}

/** A purring trill: a low hum at `f` fluttering `rate` times a second for `dur`, made of short swells one after another. */
function trill(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, rate: number, k: number): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n;
    ring(ctx, dest, at + u * dur, { freq: f * (1 + 0.04 * Math.sin(u * 6)), dur: 1.4 / rate, gain: 0.07 * k * (0.6 + 0.4 * Math.sin(Math.PI * u)), type: 'triangle', attack: 0.3 / rate, partials: [[1, 0.8], [2, 0.2]] });
  }
}

/** A chirrup: a sine swooping up and back in quick steps. */
function chirrup(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.5, dur: 0.06, gain: 0.1 * k, type: 'sine', attack: 0.006 });
  ring(ctx, dest, at + 0.07, { freq: f * 1.3, to: f * 1.05, dur: 0.08, gain: 0.09 * k, type: 'sine', attack: 0.006 });
}

/**
 * Its own call, by stage. The Sprindle's: two soft clicks and a high chirrup round 1500 Hz. The Webloom's: clicks, a chirrup and
 * a short purr. The Silkward's: slow clicks and a long deep purring trill round 110 Hz.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  for (let q = 0; q < (b.s === 2 ? 3 : 2); q++) click(ctx, dest, at + q * (0.06 + 0.04 * b.s), 4200 * b.pitch, k);
  if (b.s === 0) {
    chirrup(ctx, dest, at + 0.14, 1500 * b.pitch, k);
    return;
  }
  if (b.s === 1) {
    chirrup(ctx, dest, at + 0.14, 1500 * b.pitch, 0.8 * k);
    trill(ctx, dest, at + 0.3, 300 * b.pitch, 0.3, 26, k);
    return;
  }
  trill(ctx, dest, at + 0.22, 230 * b.pitch, 0.7, 20, 1.3 * k);
}

/** Thread drawn out: a band of noise sweeping up, quick. */
function zip(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 1800 * pitch, to: 5200 * pitch, q: 3, gain: 0.09 * k, attack: dur * 0.3 });
}

/** A spindle or a ball turning: a soft low hum, fluttering slowly. */
function thrum(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  trill(ctx, dest, at, f, dur, 12, 0.8 * k);
  burst(ctx, dest, at, { dur, freq: f * 4, q: 1.2, gain: 0.04 * k, attack: dur * 0.3 });
}

/**
 * A pounce: clicks as it rears, and a soft padded thump as its front feet come down, deeper for a bigger body, a chirrup or a
 * purr after it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.6, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + SPIDER_HITS[s] * T;
  for (let q = 0; q < 3; q++) click(ctx, out, at + 0.05 + q * 0.05, 4600 * b.pitch, 0.8);
  ring(ctx, out, hit, { freq: 150 - 50 * b.heavy, to: 70, dur: 0.1 + 0.08 * b.heavy, gain: 0.3, type: 'sine', attack: 0.003 });
  burst(ctx, out, hit, { dur: 0.06, freq: 900 - 300 * b.heavy, q: 0.9, gain: 0.18, attack: 0.002 });
  zip(ctx, out, hit - 0.04, 0.08, b.pitch * 1.2, 0.6);
  if (s === 2) trill(ctx, out, hit + 0.08, 230 * b.pitch, 0.3, 20, 1);
  else chirrup(ctx, out, hit + 0.1, 1500 * b.pitch, 0.6);
};

/**
 * A go at its task. The Sprindle's: a zip of thread and a soft thrum of the ball at each of its three turns, and a chirrup. The
 * Webloom's: a zip as the spindle is let down, a flick and the spindle's thrum rising and slowing as it twirls, a tap as it is
 * caught. The Silkward's: a long zip and a thrum at each draw of silk, a soft swish as the skein falls and a muffled thump as it
 * lands, and a purr.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [4.5, 3.6, 1.8][s]), b = bodyOf(stage, v), W = SPIDER_WORK, T = ACT_SECS.work;
  if (s === 0) {
    for (const c of [W.wind, W.wind2, W.wind3]) {
      zip(ctx, out, at + (c - 0.09) * T, 0.09, b.pitch, 0.8);
      thrum(ctx, out, at + (c - 0.06) * T, 180 * b.pitch, 0.12, 0.7);
    }
    if (v > 0.5) chirrup(ctx, out, at + 0.86 * T, 1500 * b.pitch, 0.4);
    return;
  }
  if (s === 1) {
    zip(ctx, out, at + 0.08 * T, (W.drop - 0.08) * T, b.pitch * 0.9, 0.8);
    click(ctx, out, at + W.flick * T, 3000, 1.2);
    thrum(ctx, out, at + W.flick * T, 260 * b.pitch, (W.catch - W.flick) * T, 1);
    burst(ctx, out, at + W.catch * T, { dur: 0.03, freq: 1400, q: 2, gain: 0.12, attack: 0.002 });
    if (v > 0.5) call(ctx, out, at + 0.9 * T, 1, v, 0.3);
    return;
  }
  for (const c of [W.draw, W.draw2]) {
    zip(ctx, out, at + (c - 0.12) * T, 0.14, b.pitch, 1);
    thrum(ctx, out, at + (c - 0.04) * T, 230 * b.pitch, 0.14, 0.9);
  }
  burst(ctx, out, at + W.fall * T, { dur: (W.land - W.fall) * T, freq: 1600, to: 600, q: 1, gain: 0.06, attack: 0.05 });
  ring(ctx, out, at + W.land * T, { freq: 120, to: 70, dur: 0.12, gain: 0.2, type: 'sine', attack: 0.004 });
  burst(ctx, out, at + W.land * T, { dur: 0.08, freq: 500, q: 0.8, gain: 0.1, attack: 0.003 });
  if (v > 0.5) call(ctx, out, at + 0.86 * T, 2, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a run of soft clicks quickening, and a thread zipping up higher and higher as the silk
 * and leaves swirl in, to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the
 * last -- and then its own call, the chirrup, the purr, or the deep trill of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.1 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    click(ctx, dest, when, (3000 + 2000 * u) * key, 0.5 + 0.4 * u);
  }
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 4000 * key, q: 2.5, gain: 0.05, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const SPIDER_VOICE: Voice = { strike, work, evolve };
