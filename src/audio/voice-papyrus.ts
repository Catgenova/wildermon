import { ACT_SECS } from '../render/beasts';
import { PAPER_HITS, PAPER_WORK } from '../render/wild-papyrus';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Reedling's voice, and its stages' (the species is `papra`): soft
 * quacks, a chirr, and a rustly trill, the Pressmere's deeper and slower;
 * at its work, the papery rustle of strips laid and a sheet peeled, and a
 * soft thump as the press comes down.
 *
 * A quack is a short nasal buzz through the bill, a sawtooth sagging at its
 * end with a band of breath over it; a chirr is a run of tiny clicks of a
 * sine, fast enough to be one purr; a rustle is a band of noise high and
 * wide, in a few uneven puffs, the sound of dry leaves and paper. The bigger
 * the body, the lower all of it, the Pressmere's quack round 260 Hz. The
 * press's thump is a low sine falling away under a dull knock of noise.
 *
 * Every cue lands where its picture does (`./wild-papyrus`): the blow on
 * `PAPER_HITS`; each row of strips laid, the press coming down, the sheet
 * peeled and tossed, on `PAPER_WORK`; and the evolving chime on the flash
 * at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.46][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A quack: a soft nasal buzz at `f` sagging at its end, a band of breath through the bill over it. */
function quack(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.8, dur, gain: 0.1 * k, type: 'sawtooth', attack: 0.012, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  burst(ctx, dest, at, { dur, freq: f * 3, to: f * 2.4, q: 4, gain: 0.07 * k, attack: 0.012 });
}

/** A chirr: tiny sine clicks `rate` a second for `dur` round `f`, one soft purr. */
function chirr(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, rate: number, k: number): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n;
    ring(ctx, dest, at + u * dur, { freq: f * (1 + 0.06 * Math.sin(u * 5)), dur: 1.2 / rate, gain: 0.06 * k * (0.6 + 0.4 * Math.sin(Math.PI * u)), type: 'sine', attack: 0.25 / rate });
  }
}

/** A rustle: puffs of high wide noise one after another over `dur`, like dry leaves or paper. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  for (let q = 0; q < 4; q++) {
    const u = q / 4;
    burst(ctx, dest, at + u * dur, { dur: dur * 0.35, freq: (3600 + 900 * ((q * 7) % 3)) * pitch, q: 0.9, gain: 0.05 * k, attack: dur * 0.08 });
  }
}

/**
 * Its own call, by stage. The Reedling's: two quick high quacks round 900 Hz and a little chirr. The Papyruskin's: a quack, a
 * chirr, and a rustly trill. The Pressmere's: a slow low quack round 260 Hz and a long deep rustling trill.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    quack(ctx, dest, at, 900 * b.pitch, 0.07, k);
    quack(ctx, dest, at + 0.11, 960 * b.pitch, 0.08, 0.9 * k);
    chirr(ctx, dest, at + 0.24, 1800 * b.pitch, 0.14, 40, 0.8 * k);
    return;
  }
  if (b.s === 1) {
    quack(ctx, dest, at, 820 * b.pitch, 0.12, k);
    chirr(ctx, dest, at + 0.16, 1500 * b.pitch, 0.18, 34, 0.8 * k);
    rustle(ctx, dest, at + 0.18, 0.22, b.pitch * 1.3, 0.6 * k);
    return;
  }
  quack(ctx, dest, at, 560 * b.pitch, 0.24, 1.2 * k);
  chirr(ctx, dest, at + 0.28, 900 * b.pitch, 0.5, 24, k);
  rustle(ctx, dest, at + 0.3, 0.45, b.pitch * 1.4, 0.7 * k);
}

/** The press coming down: a low sine thump falling away under a dull knock, deeper for a bigger body and its bigger press. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  ring(ctx, dest, at, { freq: 150 - 50 * heavy, to: 70 - 15 * heavy, dur: 0.1 + 0.08 * heavy, gain: 0.26 * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.05 + 0.03 * heavy, freq: 700 - 250 * heavy, q: 0.9, gain: 0.14 * k, attack: 0.002 });
}

/**
 * A blow. The Reedling's lunge: a rustle as it springs and a snap of its bill on the bite, a quack after. The Papyruskin's shove
 * and the Pressmere's stamp: a rustle of its leaves and its sheets, a padded thump as it lands, deeper for the bigger body.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + PAPER_HITS[s] * T;
  rustle(ctx, out, at + 0.04, hit - at - 0.04, b.pitch * 1.2, 0.8);
  if (s === 0) {
    burst(ctx, out, hit, { dur: 0.025, freq: 2400, q: 3, gain: 0.2, attack: 0.001 });
    ring(ctx, out, hit, { freq: 260, to: 140, dur: 0.06, gain: 0.16, type: 'sine', attack: 0.002 });
  } else thump(ctx, out, hit, b.heavy, 1.2);
  quack(ctx, out, hit + 0.1, [900, 820, 560][s] * b.pitch, 0.09 + 0.05 * s, 0.6);
};

/**
 * A go at its task: a rustle of reed strips laid at each dab of its bill; the press coming down with a soft thump -- the
 * Reedling's two pats of its bill softer, the other two stepping onto the lid, a second lighter thump after -- the creak of the
 * lid let up; the long papery rustle of the sheet peeled; and a quack or a chirr now and then as it tosses the sheet back.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.7, 1.4, 1.2][s]), b = bodyOf(stage, v), W = PAPER_WORK, T = ACT_SECS.work;
  for (const c of [W.lay, W.lay2]) rustle(ctx, out, at + (c - 0.03) * T, 0.07, b.pitch * 1.3, 0.8);
  if (s === 0) {
    thump(ctx, out, at + W.pat * T, b.heavy, 0.45);
    thump(ctx, out, at + W.press * T, b.heavy, 0.6);
  } else {
    burst(ctx, out, at + W.shut * T, { dur: 0.05, freq: 900, q: 1.5, gain: 0.06, attack: 0.004 });
    thump(ctx, out, at + W.press * T, b.heavy, 0.9);
    thump(ctx, out, at + (W.press + 0.08) * T, b.heavy, 0.45);
    ring(ctx, out, at + W.open * T, { freq: 420 * b.pitch, to: 520 * b.pitch, dur: 0.06, gain: 0.03, type: 'triangle', attack: 0.01 });
  }
  burst(ctx, out, at + W.grip * T, { dur: (W.peel - W.grip) * T, freq: 2600 * b.pitch, to: 4800 * b.pitch, q: 1.4, gain: 0.05, attack: (W.peel - W.grip) * T * 0.5 });
  rustle(ctx, out, at + W.peel * T, (W.toss - W.peel) * T, b.pitch * 1.2, 0.7);
  if (v > 0.6) chirr(ctx, out, at + 0.9 * T, [1800, 1500, 900][s] * b.pitch, 0.1, 36, 0.4);
};

/**
 * Evolving, a cue the length of the act: a rustle of leaves and paper swelling as they swirl in, to the flash at its middle,
 * where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the quacks, the
 * trill, or the deep rustling trill of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) {
    const u = q / 6;
    rustle(ctx, dest, at + 0.1 + (flash - 0.2) * u, 0.14, key * (0.9 + 0.3 * u), 0.4 + 0.5 * u);
  }
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 800 * key, to: 3600 * key, q: 2.2, gain: 0.04, attack: (flash - 0.1) * 0.85 });
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const PAPYRUS_VOICE: Voice = { strike, work, evolve };
