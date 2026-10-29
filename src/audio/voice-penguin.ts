import { ACT_SECS } from '../render/beasts';
import { PENG_HITS, PENG_WORK } from '../render/wild-penguin';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Finlet's voice, and its stages' (the species is `wadd`): a chick's
 * high peeping chirp, a grown penguin's soft nasal honk, and the
 * Tideharvest's deep braying honk in a run; over the water they work -- a
 * splash, a plop, the swish of a pole or a net, water pouring off a net.
 *
 * A chick's peep is a pure whistle sliding up, so a sine; a honk is a buzz
 * through a nose, so a sawtooth's harmonics under a narrow band of noise
 * where a bill's resonance is, sliding down at its end; the bigger the body,
 * the lower the buzz, the Tideharvest's between 160 and 320 Hz where a small
 * speaker still plays it. Water is noise for a splash and a pour, and a sine
 * leaping up in pitch for each plop and drip, which is what a bubble's ring
 * does as it closes; a swish is a band of noise sweeping down.
 *
 * Every cue lands where its picture does (`./wild-penguin`): the strike on
 * `PENG_HITS`; the toss, the snatch and the shake, the cast, the bite and
 * the haul, the net into the water, its sweep and its lifting out, on
 * `PENG_WORK`; and the evolving chime on the flash at the middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), heavy: [0.35, 0.65, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A honk: a nasal buzz at `f` sagging at its end, a band of breath through the bill over it. */
function honk(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.82, dur, gain: 0.12 * k, type: 'sawtooth', attack: 0.02, partials: [[1, 0.6], [2, 0.3], [3, 0.1]] });
  burst(ctx, dest, at, { dur, freq: f * 3.2, to: f * 2.6, q: 4, gain: 0.1 * k, attack: 0.02 });
}

/**
 * Its own call, by stage. The Finlet's: three quick peeps, rising, round 1700 Hz. The Reeffin's: a soft nasal honk round 440
 * Hz and a shorter one after. The Tideharvest's: a braying run of honks round 250 Hz, each a little higher, the last long.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1700 * b.pitch;
    for (let q = 0; q < 3; q++) ring(ctx, dest, at + q * 0.11, { freq: f * (0.82 + 0.04 * q), to: f * (1.2 + 0.06 * q), dur: 0.07, gain: 0.14 * k, type: 'sine', attack: 0.01 });
    burst(ctx, dest, at, { dur: 0.06, freq: 3200 * b.pitch, q: 2, gain: 0.025 * k, attack: 0.01 });
    return;
  }
  if (b.s === 1) {
    honk(ctx, dest, at, 700 * b.pitch, 0.2, k);
    honk(ctx, dest, at + 0.26, 760 * b.pitch, 0.12, 0.8 * k);
    return;
  }
  for (let q = 0; q < 4; q++) honk(ctx, dest, at + q * 0.17, 620 * b.pitch * (1 + 0.05 * q), q === 3 ? 0.4 : 0.12, 1.1 * k);
  ring(ctx, dest, at, { freq: 120, to: 100, dur: 0.9, gain: 0.06 * k, type: 'triangle', attack: 0.05 });
}

/** Water struck or gone into: a splash of noise falling away, bigger and lower for a bigger body. */
function splash(ctx: BaseAudioContext, dest: AudioNode, at: number, heavy: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.2 + 0.2 * heavy, freq: 2300 - 800 * heavy, to: 400, q: 0.6, gain: 0.3 * k, attack: 0.005 });
  burst(ctx, dest, at + 0.04, { dur: 0.14, freq: 3800, to: 1900, q: 1.2, gain: 0.08 * k, attack: 0.01 });
  ring(ctx, dest, at, { freq: 150 - 50 * heavy, to: 72, dur: 0.12 + 0.1 * heavy, gain: 0.1 * k * heavy, type: 'sine', attack: 0.004 });
}

/** A bubble closing: a sine leaping up in pitch, short; a drip is a small high one, a plop a low one. */
function bubble(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.7, dur: 0.05, gain: 0.12 * k, type: 'sine', attack: 0.003 });
}

/** Something swung through the air: a band of noise sweeping down, longer and lower for a bigger thing. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 2600 * pitch, to: 700 * pitch, q: 1.4, gain: 0.14 * k, attack: dur * 0.6 });
}

/** A fish flapping: a few quick wet slaps, soft. */
function flap(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.07, { dur: 0.03, freq: 1800 + 300 * (q % 2), q: 1.6, gain: 0.08 * k, attack: 0.002 });
}

/**
 * A strike. The Finlet peeps as it hops and slaps with the fish in its beak, a wet smack. The Reeffin swings its pole through
 * the air and brings it down with a knock of wood. The Tideharvest honks as it heaves its net up and slams the hoop down with
 * a deep thump and a splash.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.9, 1.0][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + PENG_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + 0.04, 0, v, 0.6);
    burst(ctx, out, hit, { dur: 0.06, freq: 2600, to: 1400, q: 1.1, gain: 0.3, attack: 0.002 });
    ring(ctx, out, hit, { freq: 220, to: 120, dur: 0.08, gain: 0.22, type: 'sine', attack: 0.002 });
    flap(ctx, out, hit + 0.08, 3, 0.8);
    return;
  }
  swish(ctx, out, hit - 0.2, 0.2, b.pitch * 1.4, 1);
  if (s === 1) {
    ring(ctx, out, hit, { freq: 190, to: 150, dur: 0.12, gain: 0.3, type: 'triangle', attack: 0.002, partials: [[1, 0.7], [2.4, 0.3]] });
    burst(ctx, out, hit, { dur: 0.04, freq: 1600, q: 2, gain: 0.18, attack: 0.001 });
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.5);
  ring(ctx, out, hit, { freq: 90, to: 44, dur: 0.32, gain: 0.5, type: 'sine', attack: 0.003 });
  burst(ctx, out, hit, { dur: 0.2, freq: 600, to: 150, q: 0.8, gain: 0.25, type: 'lowpass', attack: 0.003 });
  splash(ctx, out, hit + 0.03, b.heavy, 0.8);
};

/**
 * A go at its task. The Finlet's: a flick and a soft plop as the fish lands in its basket, a splash as its beak goes in, the
 * new fish flapping as it shakes it, and a peep. The Reeffin's: the pole swished back and cast, a plop where the line lands,
 * two low bubbles as the bite tugs, a splash as the fish comes out, drips, and a honk. The Tideharvest's: the net swished down,
 * a splash as the hoop goes in, a wash of water as it sweeps, water pouring out of the net as it lifts, and a honk.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.9, 1.7, 1.6][s]), b = bodyOf(stage, v), W = PENG_WORK, T = ACT_SECS.work;
  if (s === 0) {
    swish(ctx, out, at + (W.toss - 0.04) * T, 0.08, 1.6, 0.6);
    bubble(ctx, out, at + W.stow * T, 420, 0.6);
    burst(ctx, out, at + W.stow * T, { dur: 0.05, freq: 900, q: 1.5, gain: 0.08, attack: 0.002 });
    splash(ctx, out, at + W.dip * T, b.heavy * 0.6, 0.6);
    flap(ctx, out, at + (W.shake - 0.06) * T, 4, 1);
    for (let q = 0; q < 3; q++) bubble(ctx, out, at + (W.shake + 0.04 + q * 0.04) * T, 2000 + 300 * q, 0.4);
    if (v > 0.5) call(ctx, out, at + 0.9 * T, 0, v, 0.35);
    return;
  }
  if (s === 1) {
    swish(ctx, out, at + 0.12 * T, 0.14, 1, 0.5);
    swish(ctx, out, at + (W.cast - 0.06) * T, 0.16, 1.3, 0.9);
    bubble(ctx, out, at + W.land * T, 340, 0.9);
    burst(ctx, out, at + W.land * T, { dur: 0.08, freq: 1400, to: 700, q: 1, gain: 0.1, attack: 0.003 });
    bubble(ctx, out, at + W.bite * T, 240, 0.6);
    bubble(ctx, out, at + (W.bite + 0.05) * T, 260, 0.6);
    splash(ctx, out, at + W.haul * T, 0.4, 0.7);
    flap(ctx, out, at + (W.haul + 0.06) * T, 4, 0.9);
    for (let q = 0; q < 3; q++) bubble(ctx, out, at + (W.haul + 0.12 + q * 0.05) * T, 1800 + 300 * q, 0.4);
    if (v > 0.5) call(ctx, out, at + 0.92 * T, 1, v, 0.3);
    return;
  }
  swish(ctx, out, at + (W.into - 0.14) * T, 0.18, 0.8, 0.9);
  splash(ctx, out, at + W.into * T, b.heavy, 0.8);
  burst(ctx, out, at + (W.into + 0.03) * T, { dur: (W.sweep - W.into) * T, freq: 1100, to: 1600, q: 0.7, gain: 0.12, attack: 0.08 });
  burst(ctx, out, at + W.lift * T, { dur: 0.3, freq: 2400, to: 900, q: 0.6, gain: 0.14, attack: 0.03 });
  for (let q = 0; q < 6; q++) bubble(ctx, out, at + (W.lift + 0.02 + q * 0.035) * T + 0.01 * Math.sin(q * 3 + v), 900 + 200 * (q % 3), 0.5);
  if (v > 0.5) call(ctx, out, at + 0.9 * T, 2, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a splash, then bubbles rising faster and higher as the water and leaves swirl in, to the
 * flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call,
 * the peeps, the honk or the bray of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  splash(ctx, dest, at + 0.02, 0.3, 0.5);
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 400 * key, to: 1200 * key, q: 1.2, gain: 0.07, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    bubble(ctx, dest, when, (900 + 900 * u) * key, 0.35 + 0.35 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const PENGUIN_VOICE: Voice = { strike, work, evolve };
