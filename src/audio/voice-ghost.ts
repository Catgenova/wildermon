import { ACT_SECS } from '../render/beasts';
import { GHOST_FEAR, GHOST_HITS } from '../render/wild-ghost';
import { noiseBuffer } from './kit';
import type { Voice } from './voices';

/**
 * The Whispet's voice, and its stages' (the species is `whispet`): a ghost.
 * Every call is one family -- a soft round "ooo", a sine with a little
 * triangle in it under a lowpass, wavering, with a breath of air round it --
 * and only grows: the Whispet's a tiny airy coo, the Lanternveil's a warbling
 * "oooOOoo" that swells in its middle, the Hallowmire's a deep hollow moan
 * that echoes, each lower and longer than the last. Its blows are soft: a
 * whoosh of air and a muffled thump with a hollow ring in it; the
 * Hallowmire's lanterns clank on their chains as it strikes and chime as it
 * frightens. Its Fear is the call grown into a "boo" that swells up into a
 * hollow shock with an echo behind it. Every breath of air is kept under a
 * lowpass, so nothing hisses.
 *
 * Every cue lands where its picture does: the strikes on `GHOST_HITS`, the
 * Fear's shock where its ring goes out (`GHOST_FEAR.out`), the evolving chime
 * on the flash at the middle of the act. Nothing rises in under twenty
 * milliseconds, and every envelope starts from silence, so nothing clicks.
 */

/** The shortest rise anything here is given. */
const RISE = 0.02;

/** How a stage sounds: how far down its voice is, how deep what it strikes, how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; deep: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.64, 0.31][s] * (0.97 + 0.06 * v), deep: [1, 0.78, 0.58][s], long: [1, 1.7, 2.6][s], s };
}

/** An envelope from silence: up in a straight line over `rise`, held to `hold`, and away to nothing by `dur`. */
function envelope(ctx: BaseAudioContext, at: number, gain: number, rise: number, dur: number, hold = 0): GainNode {
  const env = ctx.createGain();
  const r = Math.min(Math.max(RISE, rise), dur * 0.7);
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + r);
  if (hold > r) env.gain.setValueAtTime(gain, at + Math.min(hold, dur * 0.92));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  env.gain.setValueAtTime(0, at + dur + 0.005);
  return env;
}

/** Noise through a band and then a lowpass, so it is air and never hiss, under an envelope; the band sweeps from `f` to `to`. */
function air(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { dur: number; f: number; to?: number; q?: number; cut?: number; gain: number; rise?: number; hold?: number; type?: BiquadFilterType }): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = o.type ?? 'bandpass';
  band.frequency.setValueAtTime(Math.max(30, o.f), at);
  if (o.to !== undefined) band.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), at + o.dur);
  band.Q.value = o.q ?? 1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut ?? 2200;
  lp.Q.value = 0.5;
  src.connect(band).connect(lp).connect(envelope(ctx, at, o.gain, o.rise ?? RISE, o.dur, o.hold)).connect(dest);
  src.start(at, (at * 7.31) % 0.9);
  src.stop(at + o.dur + 0.03);
}

/** A tone, or a stack of partials over it (each `[multiple, share]`, a high one dying first), sliding from `f` to `to`. */
function tone(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: number; to?: number; dur: number; gain: number; type?: OscillatorType; rise?: number; partials?: ReadonlyArray<readonly [number, number]> }): void {
  for (const [mul, share] of o.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f * mul), at);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * mul), at + o.dur);
    const life = o.dur / (1 + (mul - 1) * 0.4);
    osc.connect(envelope(ctx, at, o.gain * share, o.rise ?? RISE, life)).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.03);
  }
}

/** An echo: what goes in comes out, and again a little later and quieter, and again, darker each time: a hollow place. */
function echo(ctx: BaseAudioContext, dest: AudioNode, delay: number, back: number, cut: number): AudioNode {
  const input = ctx.createGain();
  input.connect(dest);
  const d = ctx.createDelay(1);
  d.delayTime.value = delay;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  const fb = ctx.createGain();
  fb.gain.value = back;
  input.connect(d);
  d.connect(lp).connect(fb).connect(d);
  // The repeats come back as quietly as they feed round, the first as well as the rest.
  const wet = ctx.createGain();
  wet.gain.value = back;
  lp.connect(wet).connect(dest);
  return input;
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/* ---- its voice -------------------------------------------------------------------------------- */

/**
 * The "ooo": a sine with a soft triangle an octave over it, through a lowpass, its pitch through the points of `f` evenly over
 * `dur`, wavering at `vib` (rate, cents), and a breath of air round it; its loudness through `shape` evenly (a swell in the middle
 * of a warble), from silence and back to it.
 */
function ooo(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; vib: [number, number]; shape?: readonly number[]; cut?: number; breath?: number }): void {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setValueAtTime(0, at);
  const shape = o.shape ?? [0, 1, 0.8, 0];
  shape.forEach((k, i) => {
    const t = at + (o.dur * i) / (shape.length - 1);
    if (i === 0) return;
    out.gain.linearRampToValueAtTime(Math.max(0, k) * o.gain, Math.max(at + RISE, t));
  });
  out.gain.setValueAtTime(0, at + o.dur + 0.005);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut ?? o.f[0] * 2.6;
  lp.Q.value = 0.9;
  lp.connect(out).connect(dest);
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = o.vib[0];
  depth.gain.value = o.vib[1];
  lfo.connect(depth);
  lfo.start(at);
  lfo.stop(at + o.dur + 0.05);
  for (const [mul, share, type] of [[1, 1, 'sine'], [2, 0.16, 'triangle'], [1.006, 0.35, 'sine']] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    o.f.forEach((f, i) => {
      const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
      if (i === 0) osc.frequency.setValueAtTime(f * mul, t);
      else osc.frequency.exponentialRampToValueAtTime(f * mul, t);
    });
    depth.connect(osc.detune);
    const g = ctx.createGain();
    g.gain.value = share;
    osc.connect(g).connect(lp);
    osc.start(at);
    osc.stop(at + o.dur + 0.05);
  }
  if (o.breath) air(ctx, dest, at, { dur: o.dur, f: o.f[0] * 2.2, q: 1.2, cut: 2000, gain: o.breath * o.gain, rise: o.dur * 0.3, hold: o.dur * 0.6 });
}

/** Its own call, by stage: the Whispet's tiny airy coo, the Lanternveil's warbling "oooOOoo", the Hallowmire's deep echoing moan. */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v), f = 640 * b.pitch;
  if (b.s === 0) ooo(ctx, dest, at, { f: [f * 0.92, f * 1.1, f * 0.96], dur: 0.3, gain: 0.3 * k, vib: [7, 14], shape: [0, 1, 0.85, 0], breath: 0.25 });
  else if (b.s === 1) ooo(ctx, dest, at, { f: [f * 0.9, f * 1.0, f * 1.16, f * 1.04, f * 0.92], dur: 0.56, gain: 0.3 * k, vib: [5.5, 30], shape: [0, 0.5, 1, 0.9, 0.45, 0], breath: 0.22 });
  else {
    const room = echo(ctx, dest, 0.21, 0.42, 900);
    ooo(ctx, room, at, { f: [f * 0.88, f * 1.0, f * 1.08, f * 0.94, f * 0.82], dur: 0.82, gain: 0.34 * k, vib: [3.5, 22], shape: [0, 0.7, 1, 0.85, 0.5, 0], cut: f * 3.2, breath: 0.3 });
    // A hollow under it: the same moan an octave down, quietly.
    ooo(ctx, room, at + 0.02, { f: [f * 0.44, f * 0.5, f * 0.47, f * 0.41], dur: 0.78, gain: 0.16 * k, vib: [3.5, 18], shape: [0, 1, 0.8, 0] });
  }
}

/* ---- what it does ------------------------------------------------------------------------------- */

/** A swing through the air: a band of air rising as it comes round, quick at its end, lowpassed. */
const whoosh = (ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, deep: number, k: number): void =>
  air(ctx, dest, at, { dur, f: 380 * deep, to: 1300 * deep, q: 1.1, cut: 2200, gain: 0.32 * k, rise: dur * 0.75, hold: dur * 0.8 });

/** A blow from a ghost: a muffled thump, and a hollow ring in it, as of something struck that is not quite there. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, deep: number, k: number): void {
  tone(ctx, dest, at, { f: 170 * deep, to: 62 * deep, dur: 0.26, gain: 0.5 * k });
  air(ctx, dest, at, { dur: 0.1, f: 520 * deep, to: 240 * deep, q: 0.8, cut: 1100, gain: 0.5 * k });
  // The hollow: two near notes beating against each other, round a soft middle.
  tone(ctx, dest, at + 0.004, { f: 330 * deep, to: 300 * deep, dur: 0.32, gain: 0.12 * k, type: 'triangle' });
  tone(ctx, dest, at + 0.004, { f: 337 * deep, to: 306 * deep, dur: 0.32, gain: 0.1 * k });
}

/** A brass lantern knocked on its chain: a short bright metal note in a struck bar's uneven partials, and the chain's rattle. */
function clank(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  tone(ctx, dest, at, { f, dur: 0.3, gain: 0.12 * k, partials: [[1, 0.6], [2.76, 0.3], [5.4, 0.1]] });
  for (let q = 0; q < 3; q++) air(ctx, dest, at + 0.025 + q * 0.03, { dur: 0.03, f: 1800, q: 4, cut: 2600, gain: 0.08 * k * (1 - 0.2 * q) });
}

/** A lantern chiming: a soft glassy bell, long. */
const chime = (ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.9): void =>
  tone(ctx, dest, at, { f, dur, gain: 0.09 * k, partials: [[1, 0.65], [2.01, 0.22], [3.02, 0.13]] });

/* ---- the cues ----------------------------------------------------------------------------------- */

/**
 * A strike. A little coo as it winds up, a whoosh of air as it comes in, and the muffled spectral thump where it lands, deeper at each
 * stage: the Whispet's a quick bump, the Lanternveil's a long swipe, the Hallowmire's a heavy lash, with its lanterns clanking on
 * their chains.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [0.6, 0.6, 0.62][b.s]);
  const hit = at + GHOST_HITS[b.s] * ACT_SECS.strike;
  // The wind-up: its call, short and quiet, well under the blow.
  if (b.s === 0) ooo(ctx, out, at + 0.03, { f: [700 * b.pitch, 820 * b.pitch], dur: 0.14, gain: 0.12, vib: [8, 10], shape: [0, 1, 0] });
  else if (b.s === 1) ooo(ctx, out, at + 0.02, { f: [430, 500, 470].map((f) => f * b.pitch / 0.64), dur: 0.22, gain: 0.12, vib: [6, 20], shape: [0, 1, 0.6, 0] });
  else ooo(ctx, out, at + 0.02, { f: [210, 236, 220], dur: 0.32, gain: 0.14, vib: [3.5, 18], shape: [0, 1, 0.7, 0] });
  // The Whispet's a short puff as it darts; the Lanternveil's a long swipe of its arms and its brim, rising; the Hallowmire's heavy.
  if (b.s === 1) air(ctx, out, hit - 0.27, { dur: 0.3, f: 300 * b.deep, to: 1100 * b.deep, q: 0.9, cut: 2000, gain: 0.34, rise: 0.24, hold: 0.27 });
  else whoosh(ctx, out, hit - [0.1, 0, 0.16][b.s], [0.12, 0, 0.2][b.s], b.deep, [0.7, 0, 1.1][b.s]);
  thump(ctx, out, hit, b.deep, 1);
  if (b.s === 2) {
    clank(ctx, out, hit + 0.02, 1180, 1);
    clank(ctx, out, hit + 0.09, 1410, 0.7);
  }
};

/**
 * Its Fear: a breath drawn in as it gathers itself, then its call grown into a "boo" that swells and rises as it swells, into a
 * hollow shock where the ring goes out, with an echo behind it; on a Hallowmire its lanterns chime.
 */
const fear = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [0.62, 0.6, 0.6][b.s]);
  const T = (x: number): number => at + x * ACT_SECS.cast, F = GHOST_FEAR;
  const room = echo(ctx, out, [0.12, 0.17, 0.23][b.s], [0.22, 0.28, 0.34][b.s], 1100);
  // Drawn in.
  air(ctx, out, T(0.02), { dur: T(F.gather) - T(0.02), f: 500 * b.deep, to: 900 * b.deep, q: 0.9, cut: 1600, gain: 0.07, rise: 0.12, hold: 0.14 });
  // The boo: low and rising as it swells, held, and away.
  const f = 520 * b.pitch;
  ooo(ctx, room, T(F.gather - 0.02), { f: [f * 0.72, f * 0.9, f * 1.06, f * 1.0, f * 0.86], dur: T(F.done) - T(F.gather - 0.02), gain: [0.19, 0.24, 0.21][b.s], vib: [5, 20], shape: b.s ? [0, 0.35, 1, 0.95, 0.6, 0] : [0, 0.6, 1, 0.7, 0.4, 0], cut: f * 3, breath: 0.2 });
  // The shock where the ring goes out: a deep soft blow and a hollow ring, echoing.
  const out1 = T(F.out);
  tone(ctx, room, out1, { f: 120 * b.deep, to: 44 * b.deep, dur: 0.5, gain: 0.42 });
  air(ctx, room, out1, { dur: 0.4, f: 360 * b.deep, to: 160 * b.deep, q: 1.6, cut: 900, gain: 0.32, rise: 0.02 });
  tone(ctx, room, out1 + 0.005, { f: 290 * b.deep, to: 250 * b.deep, dur: 0.55, gain: 0.1, type: 'triangle' });
  tone(ctx, room, out1 + 0.005, { f: 297 * b.deep, to: 256 * b.deep, dur: 0.55, gain: 0.08 });
  if (b.s === 2) [1046, 1318, 1568].forEach((c, q) => chime(ctx, out, out1 + 0.04 + q * 0.09, c * (0.99 + 0.02 * v), 1));
};

/**
 * Evolving, a cue the length of the act: an eerie chord rising and shimmering -- three wavering tones a minor third and a tritone
 * apart, climbing together and growing -- building to a bright glassy chime at the flash in the middle of the act, a chord under
 * it; and then the call of what it has become. Each stage's lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, 1.1);
  const flash = at + 0.5 * ACT_SECS.evolve, key = [1, 0.84, 0.7][b.s];
  const rise = flash - at;
  for (const [mul, type] of [[1, 'triangle'], [1.19, 'sine'], [1.414, 'sine'], [2.0, 'sine']] as const) {
    const osc = ctx.createOscillator(), shimmer = ctx.createOscillator(), sg = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(330 * key * mul * 0.75, at);
    osc.frequency.exponentialRampToValueAtTime(330 * key * mul, flash);
    // A shimmer: its loudness wavering, quicker as it builds.
    shimmer.frequency.setValueAtTime(4, at);
    shimmer.frequency.linearRampToValueAtTime(11, flash);
    sg.gain.value = 0.35;
    const trem = ctx.createGain();
    trem.gain.value = 0.65;
    shimmer.connect(sg).connect(trem.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, at);
    lp.frequency.exponentialRampToValueAtTime(2600, flash);
    const env = ctx.createGain();
    env.gain.value = 0;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.02, at + 0.1);
    env.gain.exponentialRampToValueAtTime(mul === 1 ? 0.11 : 0.07, flash - 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, flash + 0.25);
    env.gain.setValueAtTime(0, flash + 0.26);
    osc.connect(lp).connect(trem).connect(env).connect(out);
    osc.start(at);
    shimmer.start(at);
    osc.stop(flash + 0.3);
    shimmer.stop(flash + 0.3);
  }
  // A breath of air rising under it, lowpassed.
  air(ctx, out, at + 0.05, { dur: rise, f: 400 * key, to: 1500 * key, q: 1, cut: 2000, gain: 0.08, rise: rise * 0.85, hold: rise * 0.9 });
  // The chime at the flash: a glassy bell and a chord under it.
  tone(ctx, out, flash, { f: 1318 * key, dur: 1.1, gain: 0.3, partials: [[1, 0.55], [2.01, 0.25], [3.03, 0.12], [4.2, 0.08]] });
  for (const f of [523, 622, 784]) tone(ctx, out, flash, { f: f * key, dur: 0.85, gain: 0.08, rise: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  call(ctx, out, at + 1.18, stage, v, [0.42, 0.42, 0.26][b.s]);
};

export const GHOST_VOICE: Voice = { strike, cast: fear, evolve };
