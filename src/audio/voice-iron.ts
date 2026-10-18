import { ACT_SECS } from '../render/beasts';
import { DIG_STROKE, IRON_DIGS, IRON_HITS } from '../render/wild-iron';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Ironemole's voice, and its stages' (the species is `mola`): a mole's
 * squeak and snort and huff, claws on stone and in earth, and the ring of the
 * ore crystals it wears. The Ironemole squeaks; the Ferrodrill snorts; the
 * Oremander huffs from deep in its chest. A crystal is a struck bar, three
 * partials that belong to no scale (`ring`), so it reads as mineral rather
 * than as a note; a bigger stage's crystals are bigger and ring lower.
 *
 * Every cue lands where its picture does: the strikes on the blows of
 * `IRON_HITS`, the digging on the strokes of `IRON_DIGS` and `DIG_STROKE`, the
 * evolving chime on the flash at the middle of the act. Nothing starts in
 * under fifteen milliseconds, so nothing clicks.
 */

/** The shortest rise anything here is given: under it, a sound starts with a click. */
const RISE = 0.015;
/** A struck crystal's partials: a bar's, inharmonic. */
const CRYSTAL = [[1, 0.6], [2.76, 0.26], [5.4, 0.12]] as const;

/** How a stage sounds: how far down its voice and its crystals are, how big a body is behind them, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; key: number; weight: number; long: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.68, 0.46][s] * (0.95 + 0.1 * v), key: [1, 0.84, 0.7][s], weight: [0.6, 0.8, 1][s], long: [1, 1.2, 1.45][s] };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A pitched voice: `type` through a lowpass, its pitch through the points of `f` evenly, under a rise, a hold and a fall; a flutter of `vib` in it. */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; type: OscillatorType; cut: number; vib?: [number, number] }): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  if (o.vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.vib[1];
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut;
  lp.Q.value = 0.9;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + RISE);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE, o.dur * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(lp).connect(env).connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** The Ironemole's squeak: a small bright chirp, up and down, with a flutter in it. */
function squeak(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, up = 1.35): void {
  const f = 1500 + 200 * v;
  voiced(ctx, dest, at, { f: [f, f * up, f * 1.05], dur: 0.13, gain: 0.3 * k, type: 'triangle', cut: 5200, vib: [38, 60] });
}

/** The Ferrodrill's snort: air blown hard out of a long snout, falling, with a short buzz of voice under it. */
function snort(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  burst(ctx, dest, at, { dur: 0.14 * b.long, freq: 1500 * b.key, to: 480 * b.key, q: 1.1, gain: 0.34 * k, attack: RISE });
  voiced(ctx, dest, at + 0.01, { f: [230 * b.pitch, 170 * b.pitch], dur: 0.11 * b.long, gain: 0.16 * k, type: 'sawtooth', cut: 1100, vib: [26, 8] });
}

/** The Oremander's huff: a deep breath forced out of a big chest, a low rough voice in it. */
function huff(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  burst(ctx, dest, at, { dur: 0.3 * b.long, freq: 700, to: 220, q: 0.7, gain: 0.32 * k, type: 'lowpass', attack: 0.03 });
  voiced(ctx, dest, at + 0.02, { f: [150 * b.pitch * 1.6, 120 * b.pitch * 1.6, 95 * b.pitch * 1.6], dur: 0.26 * b.long, gain: 0.26 * k, type: 'sawtooth', cut: 520, vib: [18, 6] });
}

/** Its own sound, by stage: the squeak, the snort or the huff. */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  if (stage <= 0) squeak(ctx, dest, at, v, k);
  else if (stage === 1) snort(ctx, dest, at, stage, v, k);
  else huff(ctx, dest, at, stage, v, k);
}

/** Claws raked over stone: a high band of noise falling, rough with a run of tiny ticks; sharper, longer and lower on a bigger body. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), dur = 0.09 + 0.03 * stage;
  burst(ctx, dest, at, { dur, freq: (4200 - 600 * stage) + 300 * v, to: 2000 - 300 * stage, q: 1.6 + stage, gain: 0.26 * k, attack: RISE });
  for (let q = 0; q < 4 + stage; q++) burst(ctx, dest, at + q * dur * 0.22, { dur: 0.03, freq: (5200 - 500 * stage) * b.key, q: 4, gain: 0.08 * k, attack: RISE });
}

/** A crystal struck: a bar's ring, short, `f` its root; a bigger stage's lower. */
const clink = (ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.28): void =>
  ring(ctx, dest, at, { freq: f, dur, gain: 0.12 * k, type: 'sine', attack: RISE, partials: CRYSTAL });

/** A heavy body landing: a low thud falling to a floor of fifty, and the dull slap of earth. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  ring(ctx, dest, at, { freq: 120 - 15 * stage, to: 50, dur: 0.32, gain: 0.45 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at, { dur: 0.16, freq: 380, to: 130, q: 0.7, gain: 0.34 * k, type: 'lowpass', attack: RISE });
}

/**
 * A strike. The Ironemole squeaks as it rears, then its claws rake down with
 * a scratch and a tiny tick of crystal; the Ferrodrill snorts as it gathers,
 * and each of its two slashes is a sharper scrape, the second with a crystal
 * clink; the Oremander huffs as it rears up and comes down in a heavy thud
 * with its crystals chiming over it and rattling as it settles.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.25, 1.9, 1.15][s]), b = bodyOf(stage, v);
  const hits = IRON_HITS[s].map((h) => at + h * ACT_SECS.strike);
  if (s === 0) {
    squeak(ctx, out, at + 0.06, v, 1, 1.5);
    scrape(ctx, out, hits[0] - 0.02, 0, v, 1);
    clink(ctx, out, hits[0] + 0.01, 3100 * b.key, 0.5, 0.18);
    squeak(ctx, out, hits[0] + 0.1, v, 0.6, 1.2);
    return;
  }
  if (s === 1) {
    snort(ctx, out, at + 0.02, stage, v, 0.9);
    scrape(ctx, out, hits[0] - 0.03, 1, v, 1);
    scrape(ctx, out, hits[1] - 0.03, 1, v, 1);
    clink(ctx, out, hits[1], 2500 * b.key, 0.8);
    return;
  }
  huff(ctx, out, at + 0.03, stage, v, 1);
  thud(ctx, out, hits[0], stage, 1);
  scrape(ctx, out, hits[0] - 0.02, 2, v, 0.6);
  ring(ctx, out, hits[0] + 0.01, { freq: 1180 * b.key, dur: 0.9, gain: 0.07, type: 'sine', attack: RISE, partials: CRYSTAL });
  for (let q = 0; q < 4; q++) clink(ctx, out, hits[0] + 0.08 + q * 0.045, (2300 + 400 * ((q * 3) % 4)) * b.key, 0.35, 0.14);
};

/**
 * A go at its task, digging at a seam: at each stroke, as the claws bite into
 * the ground, a scrape through soil and a clink of metal struck in it; as
 * they come out, a hiss of earth thrown back; and once a go, the chunk of ore
 * tossed back landing with a brighter clink. The Oremander's strokes are half
 * as many, heavier and lower.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.6, 3.5, 1.75][s]), b = bodyOf(stage, v);
  const n = IRON_DIGS[s], each = ACT_SECS.work / n;
  for (let k = 0; k < n; k++) {
    const bite = at + (k + DIG_STROKE.bite) * each, fling = at + (k + DIG_STROKE.fling) * each;
    const drag = fling - bite;
    // The claws through the soil: a band of noise, dropping as they drag back, its grit on top.
    burst(ctx, out, bite, { dur: drag, freq: 1100 * b.key, to: 420 * b.key, q: 0.8, gain: 0.2 * b.weight, attack: 0.02 });
    burst(ctx, out, bite, { dur: drag * 0.7, freq: 3000 * b.key, to: 1800, q: 1.2, gain: 0.07, attack: 0.02 });
    if (s === 2) thud(ctx, out, bite, stage, 0.35);
    // Metal in the seam, struck: a clink on every stroke, alternately higher and lower.
    clink(ctx, out, bite + 0.01, (k % 2 ? 2200 : 2900) * b.key * (0.97 + 0.06 * v), 0.45, 0.16);
    // The earth thrown back.
    burst(ctx, out, fling, { dur: 0.17, freq: 2400, to: 1300, q: 0.6, gain: 0.12, attack: 0.02 });
  }
  // The chunk of ore landing behind it.
  clink(ctx, out, at + (DIG_STROKE.fling * each) + 0.3, 3400 * b.key, 0.55, 0.22);
};

/**
 * Evolving, a cue the length of the act: crystals growing, a run of tiny
 * crystal ticks quickening and climbing over a rising shimmer, building to a
 * resonant metallic chime at the flash in the middle of it, with a low tone
 * under it ringing on; and then its own sound, the squeak, snort or huff of
 * what it has become. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.5), b = bodyOf(stage, v);
  const flash = at + 0.5 * ACT_SECS.evolve;
  // The burst of shards at the start.
  burst(ctx, out, at, { dur: 0.18, freq: 3200, to: 1800, q: 1.4, gain: 0.12, attack: RISE });
  for (let q = 0; q < 3; q++) clink(ctx, out, at + 0.02 + q * 0.04, (3600 - 400 * q) * b.key, 0.35, 0.15);
  // The shimmer rising to the flash.
  burst(ctx, out, at + 0.12, { dur: flash - at - 0.1, freq: 1400 * b.key, to: 6200 * b.key, q: 2.2, gain: 0.07, attack: flash - at - 0.25 });
  // Crystals growing: ticks quickening and climbing to the flash.
  for (let q = 0; q < 12; q++) {
    const f = q / 11, when = at + 0.14 + (flash - at - 0.2) * (1 - (1 - f) ** 1.6);
    clink(ctx, out, when, (900 + 1500 * f) * b.key * (1 + 0.04 * Math.sin(q * 2.3)), 0.25 + 0.35 * f, 0.18);
  }
  // The chime at the flash: a struck bar ringing long, a fifth over it, and a low tone under them.
  ring(ctx, out, flash, { freq: 660 * b.key, dur: 1.1, gain: 0.16, type: 'sine', attack: RISE, partials: [[1, 0.6], [2.76, 0.28], [5.4, 0.14], [1.5, 0.2]] });
  ring(ctx, out, flash, { freq: 330 * b.key, dur: 0.85, gain: 0.1, type: 'sine', attack: 0.02 });
  ring(ctx, out, flash + 0.02, { freq: 2640 * b.key, dur: 0.4, gain: 0.04, type: 'sine', attack: RISE });
  call(ctx, out, at + 1.3, stage, v, 0.8);
};

export const IRON_VOICE: Voice = { strike, work, evolve };
