import { ACT_SECS } from '../render/beasts';
import { SLUG_FLAME, SLUG_HITS, SLUG_WORK } from '../render/wild-slug';
import { noiseBuffer } from './kit';
import type { Voice } from './voices';

/**
 * The Sluglow's voice, and its stages' (the species is `embra`): a snail
 * with a fire in it. Every call is one family -- a round voiced tone that
 * bubbles (its loudness fluttering, as a thing talking through something
 * wet), with a soft breath of fire under it -- and only gets bigger: the
 * Sluglow's a soft bubbly chirp-coo, the Slugember's a warmer, rounder
 * burbling hum, the Slugferno's a deep rumbling roar-hum with a whoosh of
 * flame under it, each lower and slower than the last. Its body is wet: a
 * blow is a squelching thump. Its fire is noise, kept under a lowpass so it
 * crackles and sizzles without hissing.
 *
 * Every cue lands where its picture does: the strikes on `SLUG_HITS` (and the
 * Slugferno's flame on `SLUG_FLAME`), the stoking on `SLUG_WORK`, the evolving
 * flare on the flash at the middle of the act. Nothing rises in under sixteen
 * milliseconds, and every envelope starts from silence, so nothing clicks.
 */

/** The shortest rise anything here is given. */
const RISE = 0.016;

/** How a stage sounds: how far down its voice is, how heavy a body is behind it, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; weight: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.5, 0.25][s] * (0.96 + 0.08 * v), weight: [0.7, 0.85, 1][s], long: [1, 1.3, 1.65][s], s };
}

/** An envelope from silence: up in a straight line over `rise`, held to `hold`, and away to nothing by `dur`. */
function envelope(ctx: BaseAudioContext, at: number, gain: number, rise: number, dur: number, hold = 0): GainNode {
  const env = ctx.createGain();
  const r = Math.min(Math.max(RISE, rise), dur * 0.6);
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + r);
  if (hold > r) env.gain.setValueAtTime(gain, at + Math.min(hold, dur * 0.9));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  return env;
}

/** A swell from silence: up in a straight line the whole of `dur` but its last thirty milliseconds, and down to nothing in those. */
function swelling(ctx: BaseAudioContext, at: number, gain: number, dur: number): GainNode {
  const env = ctx.createGain();
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  // Up to its height a little before its end, drawn back to half as the moment comes, so what it builds to is louder than it.
  env.gain.linearRampToValueAtTime(gain, at + dur - 0.06);
  env.gain.linearRampToValueAtTime(gain * 0.4, at + dur - 0.02);
  env.gain.linearRampToValueAtTime(0, at + dur + 0.01);
  return env;
}

/**
 * Noise through a band, and then a lowpass so nothing of it is harsh, under an envelope: a squelch, a crackle, a sizzle, a breath,
 * a whoosh. The band sweeps from `f` to `to` over it.
 */
function noise(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { dur: number; f: number; to?: number; q?: number; cut?: number; gain: number; rise?: number; hold?: number; type?: BiquadFilterType; swell?: boolean }): void {
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
  lp.frequency.value = o.cut ?? 3200;
  lp.Q.value = 0.5;
  src.connect(band).connect(lp).connect(o.swell ? swelling(ctx, at, o.gain, o.dur) : envelope(ctx, at, o.gain, o.rise ?? RISE, o.dur, o.hold)).connect(dest);
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
    const life = o.dur / (1 + (mul - 1) * 0.45);
    osc.connect(envelope(ctx, at, o.gain * share, o.rise ?? RISE, life)).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.03);
  }
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its voice: `type` through the pitches of `f`, evenly, through a soft formant and a lowpass, its loudness bubbling at `bubble`
 * a second -- which is what makes it a snail's coo rather than a whistle -- under a rise, a hold and a fall.
 */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; type: OscillatorType; formant: number; cut: number; bubble: number; depth?: number; swell?: boolean }): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const shape = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
  const d = o.depth ?? 0.35;
  shape.gain.value = 1 - d;
  lfo.frequency.value = o.bubble;
  depth.gain.value = d;
  lfo.connect(depth).connect(shape.gain);
  const form = ctx.createBiquadFilter();
  form.type = 'peaking';
  form.frequency.value = o.formant;
  form.Q.value = 1.6;
  form.gain.value = 7;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut;
  lp.Q.value = 0.7;
  osc.connect(shape).connect(form).connect(lp).connect(o.swell ? swelling(ctx, at, o.gain, o.dur) : envelope(ctx, at, o.gain, 0.025, o.dur, o.dur * 0.4)).connect(dest);
  for (const n of [osc, lfo]) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/* ---- its voices -------------------------------------------------------------------------- */

/**
 * Its own call, by stage, one family: a bubbling voice rising and settling, a breath of fire under it. The Sluglow's a soft bubbly
 * chirp-coo, up and down; the Slugember's a warm round burbling hum, slower and lower; the Slugferno's a deep rumbling roar-hum,
 * an octave of growl under it, and a whoosh of flame under that.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  const f = 640 * b.pitch;
  if (b.s === 0) {
    voiced(ctx, dest, at, { f: [f * 0.9, f * 1.3, f * 1.05, f * 0.92], dur: 0.2, gain: 0.32 * k, type: 'triangle', formant: 1300, cut: 3000, bubble: 26, depth: 0.4 });
    noise(ctx, dest, at, { dur: 0.16, f: 900, q: 0.8, cut: 1800, gain: 0.05 * k, rise: 0.05 });
    return;
  }
  if (b.s === 1) {
    voiced(ctx, dest, at, { f: [f * 0.88, f * 1.12, f * 1.04, f * 0.86], dur: 0.34, gain: 0.32 * k, type: 'triangle', formant: 700, cut: 1800, bubble: 15, depth: 0.42 });
    tone(ctx, dest, at + 0.02, { f: f * 0.5, to: f * 0.45, dur: 0.32, gain: 0.08 * k, rise: 0.04 });
    noise(ctx, dest, at, { dur: 0.3, f: 600, q: 0.8, cut: 1400, gain: 0.07 * k, rise: 0.08 });
    return;
  }
  voiced(ctx, dest, at, { f: [f * 0.86, f * 1.1, f * 1.0, f * 0.8], dur: 0.5, gain: 0.32 * k, type: 'sawtooth', formant: 420, cut: 900, bubble: 10, depth: 0.45 });
  tone(ctx, dest, at + 0.03, { f: f * 0.5, to: f * 0.42, dur: 0.48, gain: 0.14 * k, rise: 0.05 });
  // The whoosh of its fire under it.
  noise(ctx, dest, at, { dur: 0.5, f: 300, to: 700, q: 0.7, cut: 1200, gain: 0.12 * k, rise: 0.18 });
}

/* ---- what it does ------------------------------------------------------------------------- */

/** A wet squelching thump: its soft body landing on what it hits -- a resonant band swept up and back, and a low thud under it. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5), f = 520 * (0.55 + 0.45 * b.pitch);
  noise(ctx, dest, at, { dur: 0.09 * b.long, f, to: f * 2.2, q: 4, cut: 2400, gain: 0.5 * k });
  noise(ctx, dest, at + 0.05 * b.long, { dur: 0.1 * b.long, f: f * 1.8, to: f * 0.8, q: 3.5, cut: 2000, gain: 0.34 * k, rise: 0.02 });
  // The thud under it: high and light on the Sluglow, so the blow is a wet pop and not a boom.
  tone(ctx, dest, at, b.s === 0 ? { f: 260, to: 120, dur: 0.12, gain: 0.08 * k } : { f: 190 - 40 * b.s, to: 70 - 15 * b.s, dur: 0.16 * b.long, gain: 0.2 * k * b.weight });
}

/** Sparks crackling off it: a run of small dull ticks, scattered, dying away; under 3 kHz, so they crackle and do not hiss. */
function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, len: number, count: number, k: number, v: number): void {
  const b = bodyOf(stage, v);
  for (let q = 0; q < count; q++) {
    const f = (q + 0.5) / count, when = at + len * (f ** 1.4) + 0.012 * Math.sin(q * 5.3 + v * 7);
    noise(ctx, dest, Math.max(at, when), { dur: 0.028 + 0.012 * (q % 3), f: (1300 + 500 * Math.sin(q * 2.7 + v)) * (0.8 + 0.2 * b.pitch / 0.96), q: 3, cut: 2800, gain: 0.32 * k * (1 - 0.5 * f) });
  }
}

/** Embers sizzling: a soft fizz, its band falling, under a lowpass. */
const sizzle = (ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, k: number): void =>
  noise(ctx, dest, at, { dur, f: 2200, to: 1400, q: 1.1, cut: 2600, gain: 0.07 * k, rise: 0.04 });

/** A whoosh of flame: a broad band of noise swelling and climbing as it goes, kept warm under a lowpass. */
const whoosh = (ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, stage: number, k: number): void =>
  noise(ctx, dest, at, { dur, f: 260 + 60 * (2 - stage), to: 900, q: 0.6, cut: 1500, gain: 0.32 * k, rise: dur * 0.35, hold: dur * 0.6 });

/** Fuel catching: a soft low whoomp, the air drawn into the flame. */
function whoomp(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, stretch = 1): void {
  const b = bodyOf(stage, 0.5), long = b.long * stretch;
  tone(ctx, dest, at, { f: 170 - 35 * b.s, to: 90 - 20 * b.s, dur: 0.2 * long, gain: 0.14 * k, rise: 0.03 });
  noise(ctx, dest, at, { dur: 0.3 * long, f: 420 - 80 * b.s, to: 1000 - 150 * b.s, q: 0.9, cut: 1600, gain: 0.4 * k, rise: 0.04 });
}

/* ---- the cues ---------------------------------------------------------------------------- */

/**
 * A strike. It calls as it draws itself up -- softer than the blow -- and the blow is a wet squelching thump and a crackle of
 * sparks off it and the fizz of embers. The Slugember's lands heavier, with more sparks; the Slugferno roars as it rears, its flame
 * goes out of it in a whoosh, and it comes down with a heavy thud.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [3.1, 2.4, 2.4][s]);
  const hit = at + SLUG_HITS[s] * ACT_SECS.strike;
  call(ctx, out, at + 0.03, s, v, [0.12, 0.2, 0.18][s]);
  squelch(ctx, out, hit, s, 1);
  crackle(ctx, out, hit + 0.01, s, 0.22 + 0.05 * s, 7 + 3 * s, 1, v);
  sizzle(ctx, out, hit + 0.04, 0.3 + 0.1 * s, 1);
  if (s === 2) {
    const [f0, f1] = SLUG_FLAME;
    whoosh(ctx, out, at + f0 * ACT_SECS.strike, (f1 - f0) * ACT_SECS.strike + 0.12, s, 0.9);
    // The heavy thud as it comes down.
    tone(ctx, out, hit + 0.004, { f: 110, to: 45, dur: 0.34, gain: 0.26 });
    noise(ctx, out, hit + 0.006, { dur: 0.28, f: 360, to: 140, q: 1.2, cut: 900, gain: 0.32 });
  }
};

/**
 * A go at its task: a soft dull scrape as it noses the fuel along, a gentle warm breath as it blows on it, and as it catches a
 * small whoomp and a soft crackle; and a little contented sound of its own. Each stage heavier and lower.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), b = bodyOf(stage, v), out = level(ctx, dest, [2.9, 2.8, 2.6][s]);
  const W = SLUG_WORK, T = ACT_SECS.work;
  // The scrape of the fuel along the ground.
  const push = at + W.down * T, len = (W.push - W.down) * T;
  if (s === 0) {
    // The Sluglow's: a short bright scrape of a small piece.
    noise(ctx, out, push + len * 0.15, { dur: len * 0.7, f: 900, to: 650, q: 1.6, cut: 2400, gain: 0.18, rise: 0.03, hold: len * 0.4 });
  } else {
    if (s === 1) {
      // The Slugember's: two shoves, a short scrape each.
      for (const k of [-0.45, 0.75]) noise(ctx, out, push + len * k, { dur: 0.09, f: 420, to: 320, q: 1.4, cut: 1300, gain: 0.34, rise: 0.02, hold: 0.05 });
    } else noise(ctx, out, push, { dur: len + 0.04, f: 280, to: 200, q: 1.4, cut: 1300, gain: 0.2, rise: 0.05, hold: len * 0.7 });
    // The Slugferno's log is heavy: it drags a second time, deeper.
    if (s === 2) noise(ctx, out, push + len * 0.55, { dur: len * 0.6, f: 240, to: 170, q: 1.2, cut: 800, gain: 0.22, rise: 0.04, hold: len * 0.3 });
  }
  tone(ctx, out, push + len * 0.2, { f: 130 - 30 * s, to: 100 - 25 * s, dur: 0.1, gain: 0.08 * b.weight });
  // Its breath on it.
  const blow = at + W.breathe * T, bl = (W.light - W.breathe) * T;
  noise(ctx, out, blow, { dur: bl + 0.05, f: 900 - 200 * s, to: 1200 - 250 * s, q: 0.7, cut: 1800 - 300 * s, gain: 0.12, rise: bl * 0.45, hold: bl * 0.75 });
  // It catches.
  const light = at + W.light * T;
  // The Slugferno's catches slower, a longer draw of air into a bigger fire.
  whoomp(ctx, out, light, s, 1, s === 2 ? 1.3 : 1);
  crackle(ctx, out, light + 0.05, s, 0.24 + 0.06 * s, 5 + 2 * s + (s === 2 ? 3 : 0), 0.7, v);
  call(ctx, out, light + 0.22, s, v, 0.22);
};

/**
 * Evolving, a cue the length of the act: a warm hum rising under a crackle that quickens and climbs, building to a bright, glassy,
 * bell-like flare at the flash in the middle of the act -- a whoomp of fire under it -- and then its own call, of what it has
 * become. Each stage's flare is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.2, 1.15][s]);
  const flash = at + 0.5 * ACT_SECS.evolve, key = [1, 0.78, 0.6][s];
  // The warm hum rising to the flash, bubbling as its voice does.
  const f = 260 * key;
  // Both swelling the whole way up to the flash, and gone into the bell as it rings.
  voiced(ctx, out, at + 0.02, { f: [f * 0.7, f * 0.85, f * 1.2], dur: flash - at - 0.01, gain: 0.24, type: 'triangle', formant: 600 * key, cut: 1500, bubble: [20, 14, 10][s], depth: 0.3, swell: true });
  noise(ctx, out, at + 0.03, { dur: flash - at - 0.01, f: 300 * key, to: 900 * key, q: 0.7, cut: 1500, gain: 0.18, swell: true });
  // The crackle quickening and climbing to it.
  for (let q = 0; q < 16; q++) {
    const g = q / 15, when = at + 0.08 + (flash - at - 0.12) * (1 - (1 - g) ** 1.8);
    noise(ctx, out, when, { dur: 0.035, f: (900 + 1000 * g) * key * (1 + 0.06 * Math.sin(q * 2.3 + v)), q: 3, cut: 2800, gain: 0.07 + 0.12 * g });
  }
  // The flare: a bright glassy bell, its partials a little off a scale, a fifth under it, and the fire whooming up under them.
  tone(ctx, out, flash, { f: 1318 * key, dur: 1.1, gain: [0.28, 0.34, 0.36][s], partials: [[1, 0.55], [2.01, 0.22], [3.02, 0.12], [4.17, 0.06]] });
  tone(ctx, out, flash + 0.01, { f: 880 * key, dur: 0.9, gain: [0.12, 0.15, 0.16][s], partials: [[1, 0.8], [2, 0.2]] });
  whoomp(ctx, out, flash, s, 0.8);
  sizzle(ctx, out, flash + 0.03, 0.4, 1.2);
  call(ctx, out, at + 1.32, s, v, [0.42, 0.4, 0.36][s]);
};

export const SLUG_VOICE: Voice = { strike, work, evolve };
