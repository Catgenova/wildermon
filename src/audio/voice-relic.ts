import { ACT_SECS } from '../render/beasts';
import { RELIC_HITS, RELIC_STRIKE, RELIC_WORK } from '../render/wild-relic';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Kintsu's voice, and its stages' (the species is `relka`): soft chitin
 * clicks, a beetle's shell plates ticking together, quicker and brighter on
 * the little one and slower and woodier on the bigger; under them a small
 * glassy chime, the gold of its mending, which on the Aureliax is a ringing
 * gold bell.
 *
 * A click is a very short burst of noise through a narrow band, a few in a
 * quick train, each a little apart in pitch so a train is not a buzz. A chime
 * is a few inharmonic sine partials, as a small struck bar; the Aureliax's
 * ring is the same lower and longer with a bell's minor-third partial over a
 * soft hum. Stone knocked on stone is a low damped ring with a crack of noise.
 *
 * Every cue lands where its picture does (`./wild-relic`): the strike on
 * `RELIC_HITS`, its gathering on `RELIC_STRIKE.gather`; the taps, the strokes,
 * the flash and the toss on `RELIC_WORK`; and the evolving chime on the flash
 * at the middle of the act.
 */

const stageOf = (stage: number): number => Math.max(0, Math.min(2, stage));

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A train of `n` chitin clicks from `at`, `gap` apart, round `f` Hz, lower for a bigger shell. */
function clicks(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, gap: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), f = [4200, 3000, 2100][s];
  for (let q = 0; q < n; q++) {
    const ff = f * (1 + 0.12 * Math.sin(q * 2.7 + v * 6));
    burst(ctx, dest, at + q * gap * (0.85 + 0.3 * Math.abs(Math.sin(q * 1.9 + v))), { dur: 0.012 + 0.006 * s, freq: ff, to: ff * 0.8, q: 6, gain: 0.16 * k, attack: 0.001 });
  }
}

/** The chime of its mending: a small struck bar, glassy, at `f`; the Aureliax's a gold bell, lower and longer, over a hum. */
function chime(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, f0?: number): void {
  const s = stageOf(stage), f = f0 ?? [2350, 1760, 1175][s];
  if (s < 2) {
    ring(ctx, dest, at, { freq: f, dur: 0.35 + 0.15 * s, gain: 0.07 * k, type: 'sine', attack: 0.003, partials: [[1, 0.7], [2.76, 0.22], [5.4, 0.08]] });
    return;
  }
  ring(ctx, dest, at, { freq: f, dur: 1.1, gain: 0.08 * k, type: 'sine', attack: 0.004, partials: [[1, 0.6], [1.19, 0.25], [2.0, 0.2], [2.98, 0.1]] });
  ring(ctx, dest, at + 0.01, { freq: f / 4, dur: 0.9, gain: 0.05 * k, type: 'sine', attack: 0.04 });
}

/** Stone knocked on stone: a low damped ring with a crack of noise on it, deeper for a bigger body. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [620, 420, 260][s], to: [480, 320, 190][s], dur: [0.06, 0.09, 0.14][s], gain: 0.3 * k, type: 'sine', attack: 0.002, partials: [[1, 0.8], [2.4, 0.25]] });
  burst(ctx, dest, at, { dur: 0.03 + 0.015 * s, freq: [3200, 2400, 1700][s], to: 900, q: 1.3, gain: 0.18 * k, attack: 0.001 });
}

/** A body coming down on its feet: a soft low thump. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [170, 110, 70][s], to: [90, 56, 36][s], dur: [0.1, 0.18, 0.3][s], gain: [0.25, 0.38, 0.5][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.08 * s, freq: 650, to: 150, q: 0.8, gain: (0.1 + 0.05 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * Its own call, by stage: a quick chirr of clicks with a little chime on it; the Relicrawler's slower, lower ticking and a
 * two-note chime; the Aureliax's measured clicks under a ringing gold bell.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = stageOf(stage), p = 0.96 + 0.08 * v;
  clicks(ctx, dest, at, [7, 6, 5][s], [0.022, 0.034, 0.05][s], s, v, k);
  if (s === 0) chime(ctx, dest, at + 0.17, s, k * 0.8, 2350 * p);
  else if (s === 1) {
    chime(ctx, dest, at + 0.2, s, k * 0.8, 1760 * p);
    chime(ctx, dest, at + 0.32, s, k * 0.6, 2217 * p);
  } else chime(ctx, dest, at + 0.26, s, k, 1175 * p);
}

/**
 * A strike. Its shell clicks as it gathers itself; at the blow, horns or claws on what is before it, a hard knock and a click
 * of chitin, a thump of its weight, and a glint of chime; the Aureliax's crush rings its gold bell.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.8, 1.6, 1.4][s]), T = ACT_SECS.strike;
  const hit = at + RELIC_HITS[s] * T, gather = at + RELIC_STRIKE.gather * T;
  clicks(ctx, out, gather - 0.12, 4, 0.03, s, v, 0.8);
  knock(ctx, out, hit, s, 1.1);
  clicks(ctx, out, hit + 0.01, 2, 0.02, s, v, 1);
  thump(ctx, out, hit + 0.02, s, 0.8);
  chime(ctx, out, hit + 0.03, s, s === 2 ? 0.9 : 0.5);
};

/**
 * A go at its task. The Kintsu taps the cracked tablet three times, a little click and a knock of stone each, the chime rising as
 * the gold fills it, a bright chime at the flash and a soft knock as the tablet drops into its basket. The Relicrawler's claw
 * scrapes down the crack twice, a soft rasp of clicks, and the chime rings at the flash. The Aureliax's pieces gather in a rising
 * shimmer and are struck whole with its bell.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [2.4, 3.6, 2.6][s]), W = RELIC_WORK, T = ACT_SECS.work;
  if (s === 0) {
    W.taps.forEach((t, q) => {
      knock(ctx, out, at + t * T, s, 0.55);
      clicks(ctx, out, at + t * T + 0.005, 1, 0.02, s, v + q, 0.7);
      ring(ctx, out, at + t * T + 0.01, { freq: 1900 + 260 * q, dur: 0.18, gain: 0.03, type: 'sine', attack: 0.003, partials: [[1, 0.7], [2.76, 0.2]] });
    });
  } else if (s === 1) {
    for (const t of W.strokes) {
      const from = at + (t - 0.07) * T;
      clicks(ctx, out, from, 8, 0.018, s, v, 0.5);
      burst(ctx, out, from, { dur: 0.14 * T, freq: 2600, to: 1500, q: 2, gain: 0.04, attack: 0.04 });
    }
  } else {
    const from = at + W.gather * T, len = (W.join - W.gather) * T;
    for (let q = 0; q < 8; q++) {
      const u = q / 8;
      ring(ctx, out, from + len * u, { freq: 880 * (1 + u), dur: 0.16, gain: 0.02 + 0.025 * u, type: 'sine', attack: 0.004, partials: [[1, 0.7], [2.76, 0.2]] });
    }
    knock(ctx, out, at + W.join * T, s, 0.4);
  }
  chime(ctx, out, at + W.flash * T, s, 1);
  if (s === 0) knock(ctx, out, at + (W.toss + 0.08) * T, s, 0.4);
  else if (v > 0.5) call(ctx, out, at + (W.flash + 0.2) * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: clicks quickening as the gold and stone swirl in, a chime rising with them, to the flash
 * at its middle, where a clear bell rings over a deep swell -- each stage's lower than the last -- and then its own call, the
 * chirr, the ticking or the gold bell of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 2.0);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 14; q++) {
    const u = q / 14, when = at + 0.12 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    burst(ctx, dest, when, { dur: 0.012, freq: 3000 * key * (1 + 0.3 * u), q: 6, gain: 0.05 + 0.05 * u, attack: 0.001 });
    if (q % 2 === 0) ring(ctx, dest, when, { freq: (1800 + 1400 * u) * key, dur: 0.12, gain: 0.025 + 0.03 * u, type: 'sine', attack: 0.002, partials: [[1, 0.7], [2.76, 0.25]] });
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.6, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.19, 0.25], [2, 0.2]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.045, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const RELIC_VOICE: Voice = { strike, work, evolve };
