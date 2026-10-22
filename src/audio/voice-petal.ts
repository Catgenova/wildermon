import { ACT_SECS } from '../render/beasts';
import { PETAL_DIGS, PETAL_HITS, PETAL_WORK, RAKE_STROKE } from '../render/wild-petal';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Budscarab's voice, and its stages' (the species is `grubba`): a shelled
 * thing in leaves, its call a voice behind a rattle. The Budscarab chirrs, a
 * quick bright trill of clicks over a little rising chirp; the Blossomhorn
 * huffs and trills lower, a reedy two-note call through a nasal band with the
 * clicking of its plates under it; the Florantler bellows, a slow low buzz
 * through a big chest with a hum an octave under it and its plates rattling.
 * Its leaves rustle with everything it does: soft high noise in short runs.
 *
 * Its work is wood and earth: claws hooked into a stump are a dry knock of
 * wood and a scrape of bark, raked earth is a low band of noise with grit in
 * it, and roots tearing out are a creak -- a band of noise swept up through a
 * tight resonance -- that ends in snaps, with the earth dropping after.
 *
 * Every cue lands where its picture does (`./wild-petal`): the strikes on
 * `PETAL_HITS`, the hook and the rake of each stroke on `PETAL_DIGS` and
 * `RAKE_STROKE`, the heave and the snap of the roots on `PETAL_WORK`, the
 * evolving chime on the flash at the middle of the act. Nothing starts in
 * under the shortest rise, and layers that start together are staggered.
 */

/** The shortest rise anything here is given. */
const RISE = 0.016;
/** Wood knocked: a few inharmonic partials, low and short. */
const WOOD = [[1, 0.6], [2.3, 0.25], [4.1, 0.1]] as const;
/** A chime, for evolving: a struck bar's partials, soft. */
const CHIME = [[1, 0.55], [2.76, 0.25], [5.4, 0.1]] as const;

/** How a stage sounds: how far down its voice is, how big a body is behind it, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; weight: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.58, 0.32][s] * (0.95 + 0.1 * v), weight: [0.7, 0.85, 1][s], long: [1, 1.3, 1.7][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * A voiced sound: `type` sliding through the pitches of `f`, through a nasal band (`nasal`) and a lowpass, under a rise, a
 * hold and a fall; its loudness chopped `trill` times a second for a trill, nought for none.
 */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; type: OscillatorType; nasal: number; cut: number; trill?: number }): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const stops: AudioScheduledSourceNode[] = [osc];
  const chop = ctx.createGain();
  chop.gain.value = 1;
  if (o.trill) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = o.trill;
    depth.gain.value = 0.4;
    chop.gain.value = 0.6;
    lfo.connect(depth).connect(chop.gain);
    stops.push(lfo);
  }
  const nose = ctx.createBiquadFilter();
  nose.type = 'peaking';
  nose.frequency.value = o.nasal;
  nose.Q.value = 2.2;
  nose.gain.value = 7;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut;
  lp.Q.value = 0.7;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + RISE);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE, o.dur * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(chop).connect(nose).connect(lp).connect(env).connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** Its leaves rustling: a few short soft bursts of high noise. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, k: number): void {
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.035, { dur: 0.05, freq: 3600 + 700 * (q % 3), q: 0.9, gain: 0.05 * k, attack: 0.012 });
}

/** Its plates knocking together: short dry clicks, lower on a bigger body. */
function rattle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, n: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  for (let q = 0; q < n; q++) burst(ctx, dest, at + q * 0.028 * b.long, { dur: 0.022, freq: (2400 - 500 * b.s) * (q % 2 ? 0.85 : 1), q: 3.5, gain: 0.12 * k, attack: 0.002 });
}

/**
 * Its own call, by stage. The Budscarab's a chirr: a run of quick bright clicks and a little chirp rising out of them; the
 * Blossomhorn's a huff and a reedy two-note trill, its plates clicking; the Florantler's a bellow: a hard huff of air over a
 * slow low buzz, a hum an octave under it, and its plates rattling.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    rattle(ctx, dest, at, 0, 5, 0.6 * k);
    const f = 1300 * b.pitch;
    voiced(ctx, dest, at + 0.1, { f: [f, f * 1.35, f * 1.2], dur: 0.12, gain: 0.22 * k, type: 'triangle', nasal: 2200, cut: 4200, trill: 38 });
    rustle(ctx, dest, at + 0.04, 2, k);
    return;
  }
  if (b.s === 1) {
    burst(ctx, dest, at, { dur: 0.08, freq: 900, to: 1500, q: 1.6, gain: 0.16 * k, attack: RISE });
    const f = 520 * b.pitch / 0.58;
    voiced(ctx, dest, at + 0.08, { f: [f * 0.8, f * 0.92], dur: 0.14, gain: 0.26 * k, type: 'sawtooth', nasal: 1100, cut: 2200, trill: 26 });
    voiced(ctx, dest, at + 0.24, { f: [f * 0.72, f * 0.6], dur: 0.18, gain: 0.26 * k, type: 'sawtooth', nasal: 900, cut: 1900, trill: 22 });
    rattle(ctx, dest, at + 0.1, 1, 4, 0.5 * k);
    rustle(ctx, dest, at + 0.05, 3, k);
    return;
  }
  burst(ctx, dest, at, { dur: 0.2, freq: 640, to: 260, q: 0.9, gain: 0.26 * k, type: 'lowpass', attack: 0.025 });
  const f = 190 * b.pitch / 0.32;
  voiced(ctx, dest, at + 0.06, { f: [f * 0.5, f * 0.58, f * 0.44], dur: 0.5, gain: 0.32 * k, type: 'sawtooth', nasal: 420, cut: 760, trill: 14 });
  ring(ctx, dest, at + 0.08, { freq: f * 0.25, to: f * 0.2, dur: 0.5, gain: 0.16 * k, type: 'sine', attack: 0.04 });
  rattle(ctx, dest, at + 0.12, 2, 6, 0.5 * k);
  rustle(ctx, dest, at + 0.1, 4, 1.2 * k);
}

/** A claw swish through the air: a band of noise sweeping down, kept under a lowpass so it is a swish and not a hiss. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.1 * b.long, freq: 2100 - 500 * b.s, to: 650 - 150 * b.s, q: 1.4, gain: 0.16 * k, attack: 0.03 });
}

/** Earth hit: a low thump falling away, and a dry crunch of soil a moment over it. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: 150 - 30 * b.s, to: 48, dur: 0.22 * b.long, gain: 0.5 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at + 0.008, { dur: 0.1 * b.long, freq: 900 - 200 * b.s, to: 300, q: 1.2, gain: 0.26 * k, attack: RISE });
}

/** Claws hooked into a stump: a dry knock of wood, and the bark splintering off. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: (420 - 90 * b.s), dur: 0.12 * b.long, gain: 0.22 * k, type: 'triangle', attack: 0.004, partials: WOOD });
  burst(ctx, dest, at + 0.006, { dur: 0.05, freq: 3000, q: 2.4, gain: 0.08 * k, attack: 0.003 });
}

/** A scrape of claws down bark and through dry earth: a low band of noise dragged down, with grit ticking over it. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 760 * (0.55 + 0.45 * b.pitch / 0.95);
  burst(ctx, dest, at, { dur, freq: f * 1.6, to: f * 0.7, q: 1.6, gain: 0.28 * k, attack: 0.02 });
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + 0.02 + (q * dur) / 5, { dur: 0.025, freq: (2600 + 500 * (q % 2)) * (0.7 + 0.3 * b.pitch), q: 4, gain: 0.08 * k, attack: 0.003 });
}

/** Dirt landing: a soft patter, a short low band and a scatter of ticks. */
function patter(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.08 * b.long, freq: 700 - 150 * b.s, to: 300, q: 1.4, gain: 0.2 * k, attack: RISE });
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + 0.03 + q * 0.035, { dur: 0.022, freq: 1800 + 400 * q, q: 3, gain: 0.06 * k, attack: 0.003 });
}

/** Roots straining and tearing: a creak, a band of noise swept up through a tight resonance, and the snaps at its end. */
function tear(ctx: BaseAudioContext, dest: AudioNode, at: number, snap: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const dur = Math.max(0.08, snap - at);
  burst(ctx, dest, at, { dur: dur + 0.04, freq: 260 * (1.4 - 0.25 * b.s), to: 620 * (1.4 - 0.25 * b.s), q: 7, gain: 0.2 * k, attack: dur * 0.6 });
  burst(ctx, dest, at + 0.01, { dur: dur, freq: 140, to: 220, q: 1, gain: 0.14 * k, type: 'lowpass', attack: dur * 0.7 });
  for (let q = 0; q < 3; q++) {
    const t = snap + q * 0.045;
    burst(ctx, dest, t, { dur: 0.03, freq: 1800 - 300 * q, q: 2, gain: 0.22 * k, attack: 0.002 });
    ring(ctx, dest, t + 0.004, { freq: 300 - 50 * b.s - 30 * q, to: 120, dur: 0.07, gain: 0.12 * k, type: 'sine', attack: 0.003 });
  }
}

/**
 * A strike. The Budscarab chirrs as it crouches, a little claw swish as it swipes, and a thud as its claw comes down; the
 * Blossomhorn calls as it rears, each of its two rakes a heavier swish and a thud, and a rustle of its horns as it tosses
 * them; the Florantler bellows as it rears, its claws whoosh down, and the slam is a crack of the ground over a deep thud and
 * a rumble, its plates rattling as it shakes. The wind-up is always quieter than the hit.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.0, 1.0, 0.95][s]);
  const hits = PETAL_HITS[s].map((h) => at + h * ACT_SECS.strike);
  if (s === 0) {
    call(ctx, out, at + 0.03, 0, v, 0.5);
    swish(ctx, out, hits[0] - 0.07, 0, 1);
    thud(ctx, out, hits[0], 0, 0.85);
    return;
  }
  if (s === 1) {
    call(ctx, out, at, 1, v, 0.45);
    for (const h of hits) {
      swish(ctx, out, h - 0.08, 1, 1.1);
      thud(ctx, out, h, 1, 0.9);
    }
    rustle(ctx, out, hits[1] + 0.1, 4, 1.6);
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.5);
  swish(ctx, out, hits[0] - 0.1, 2, 1.2);
  thud(ctx, out, hits[0], 2, 1);
  burst(ctx, out, hits[0] + 0.004, { dur: 0.07, freq: 1400, to: 560, q: 0.9, gain: 0.3, attack: RISE });
  burst(ctx, out, hits[0] + 0.02, { dur: 0.7, freq: 150, to: 55, q: 0.8, gain: 0.28, type: 'lowpass', attack: 0.04 });
  rattle(ctx, out, hits[0] + 0.06, 2, 6, 0.8);
};

/**
 * A go at its task, digging out a stump: a snuff at the stump's foot; at each rake a knock of wood as its claws hook into the
 * stump, a scrape down it and through the earth, and a patter of dirt landing behind; a grunt of effort as it drives its
 * snout in under; the roots creaking as it heaves and snapping at the top of it, with its call; earth dropping, and its
 * leaves rustling as it shakes its head. Each stage lower and heavier.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.1, 2.0, 2.2][s]), b = bodyOf(stage, v);
  const W = PETAL_WORK[s], T = ACT_SECS.work, n = PETAL_DIGS[s], each = ((W.dig - W.nose) * T) / n;
  burst(ctx, out, at + 0.03, { dur: 0.06 * b.long, freq: 1000 * (0.55 + 0.45 * b.pitch), to: 1600 * (0.55 + 0.45 * b.pitch), q: 2.4, gain: 0.12, attack: RISE });
  for (let k = 0; k < n; k++) {
    const start = at + W.nose * T + k * each;
    const bite = start + RAKE_STROKE.bite * each, fling = start + RAKE_STROKE.fling * each;
    knock(ctx, out, bite, s, 1);
    scrape(ctx, out, bite + 0.02, s, (fling - bite) * 0.85, 1.1 * b.weight);
    patter(ctx, out, fling + 0.12, s, 0.6);
  }
  // Driven in under it: a short grunt of effort.
  const f = [700, 380, 200][s];
  voiced(ctx, out, at + (W.dig + 0.02) * T, { f: [f, f * 0.85], dur: 0.08 * b.long, gain: 0.14, type: 'sawtooth', nasal: f * 2, cut: f * 5 });
  const snap = at + W.heave * T;
  tear(ctx, out, at + W.lever * T, snap, s, 1);
  call(ctx, out, snap + 0.02, s, v, 0.35);
  patter(ctx, out, snap + 0.16, s, 0.9);
  rustle(ctx, out, at + ((W.heave + 1) / 2) * T, 4, 1.4);
};

/**
 * Evolving, a cue the length of the act: a soft swell of air and a rustle of leaves quickening and climbing to the flash in
 * the middle, a chime there -- a struck bar and a fifth under it -- with a soft thump; and then its own call, the chirr, the
 * trill or the bellow of what it has become. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.15, 1.2][s]);
  const flash = at + 0.5 * ACT_SECS.evolve;
  const key = [1, 0.8, 0.64][s];
  burst(ctx, out, at + 0.02, { dur: flash - at + 0.12, freq: 1200, to: 2600, q: 0.7, gain: 0.08, attack: flash - at - 0.1 });
  for (let q = 0; q < 14; q++) {
    const f = q / 13, when = at + 0.1 + (flash - at - 0.16) * (1 - (1 - f) ** 1.7);
    burst(ctx, out, when, { dur: 0.05, freq: (3200 + 900 * f) * key, q: 0.9, gain: 0.04 + 0.08 * f, attack: 0.012 });
  }
  ring(ctx, out, flash, { freq: 880 * key, dur: 0.7, gain: 0.16, type: 'sine', attack: RISE, partials: CHIME });
  ring(ctx, out, flash + 0.012, { freq: 587 * key, dur: 0.6, gain: 0.12, type: 'sine', attack: RISE, partials: CHIME });
  ring(ctx, out, flash + 0.006, { freq: 120 * key, to: 60, dur: 0.25, gain: 0.24, type: 'sine', attack: RISE });
  call(ctx, out, at + 1.32, s, v, 0.55);
};

export const PETAL_VOICE: Voice = { strike, work, evolve };
