import { ACT_SECS } from '../render/beasts';
import { KILN_HITS, KILN_WORK, KILNSPIRE_SLAM } from '../render/wild-kiln';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Kilnlet's voice, and its stages' (the species is `potta`): warm chirps
 * and a low crackling purr, and the tink of its clay tiles, the Kilnspire's
 * deeper and slower; at its work, the kiln's door, the soft whoomph of the
 * fire as it opens, and the clink of a pot set in and drawn out.
 *
 * A chirp is a sine swooping up and back, warm with a little of its octave;
 * a purr is a low triangle wave whose loudness flutters twenty-odd times a
 * second, with a crackle over it -- short ticks of noise at random, an ember
 * settling. A tile's tink is fired clay struck: a short ring with the
 * inharmonic partials of a struck plate, high and dry. The fire's whoomph is
 * a low swell of noise falling, the draught of the door opening on it; a
 * clink is two quick rings of a pot, a hollow note under a bright one. The
 * bigger the body, the lower all of it, the Kilnspire's purr round 95 Hz.
 *
 * Every cue lands where its picture does (`./wild-kiln`): the blow on
 * `KILN_HITS` and the Kilnspire's tail on `KILNSPIRE_SLAM`; the pot taken up,
 * the door, the pot pushed in, the fired pot drawn out, the door shut and the
 * pot set down on `KILN_WORK`; and the evolving chime on the flash at the
 * middle of the act.
 */

/** How a stage sounds: how far down its voice is, how heavy it is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.76, 0.52][s] * (0.95 + 0.1 * v), heavy: [0.3, 0.6, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A number of its own for each tick of a crackle. */
const jitter = (i: number): number => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };

/** A warm chirp: a sine swooping up and back, a little of its octave in it. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 1.45, dur: 0.07, gain: 0.1 * k, type: 'sine', attack: 0.008, partials: [[1, 0.85], [2, 0.15]] });
  ring(ctx, dest, at + 0.08, { freq: f * 1.35, to: f * 1.1, dur: 0.09, gain: 0.08 * k, type: 'sine', attack: 0.008, partials: [[1, 0.85], [2, 0.15]] });
}

/** A crackle: `n` short ticks of noise scattered over `dur`, embers settling. */
function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, n: number, k: number, seed = 0): void {
  for (let q = 0; q < n; q++) {
    const when = at + dur * jitter(q + seed * 7.3);
    burst(ctx, dest, when, { dur: 0.008 + 0.01 * jitter(q + seed + 3), freq: 2400 + 3200 * jitter(q + seed + 5), q: 2, gain: 0.05 * k * (0.5 + jitter(q + seed + 9)), attack: 0.001 });
  }
}

/** A low crackling purr: a hum at `f` fluttering `rate` times a second for `dur`, and a crackle over it. */
function purr(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, rate: number, k: number): void {
  const n = Math.max(2, Math.round(dur * rate));
  for (let q = 0; q < n; q++) {
    const u = q / n;
    ring(ctx, dest, at + u * dur, { freq: f * (1 + 0.03 * Math.sin(u * 5)), dur: 1.4 / rate, gain: 0.07 * k * (0.6 + 0.4 * Math.sin(Math.PI * u)), type: 'triangle', attack: 0.3 / rate, partials: [[1, 0.8], [2, 0.2]] });
  }
  crackle(ctx, dest, at, dur, Math.round(dur * 18), 0.7 * k, f);
}

/** A tile's tink: fired clay struck, a short dry ring with a struck plate's partials. */
function tink(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur: 0.09, gain: 0.07 * k, type: 'sine', attack: 0.001, partials: [[1, 0.6], [2.76, 0.28], [5.4, 0.12]] });
  burst(ctx, dest, at, { dur: 0.012, freq: f * 2, q: 3, gain: 0.05 * k, attack: 0.001 });
}

/** The fire's whoomph: a low swell of noise falling, the draught of a door opening on it. */
function whoomph(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.32, freq: 520 * pitch, to: 140 * pitch, q: 0.7, gain: 0.16 * k, attack: 0.07 });
  ring(ctx, dest, at + 0.02, { freq: 90 * pitch, to: 60 * pitch, dur: 0.26, gain: 0.08 * k, type: 'sine', attack: 0.05 });
}

/** A pot's clink: a hollow note under a bright one, quick. */
function clink(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, dur: 0.12, gain: 0.09 * k, type: 'sine', attack: 0.001, partials: [[1, 0.55], [2.32, 0.3], [4.1, 0.15]] });
  ring(ctx, dest, at + 0.035, { freq: f * 1.5, dur: 0.07, gain: 0.05 * k, type: 'sine', attack: 0.001, partials: [[1, 0.7], [2.76, 0.3]] });
}

/**
 * Its own call, by stage. The Kilnlet's: two warm chirps round 1300 Hz and a tink of its tiles. The Terrabrick's: a chirp and a
 * short crackling purr. The Kilnspire's: a long deep crackling purr round 95 Hz and the tiles tinking as it settles.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    chirp(ctx, dest, at, 1300 * b.pitch, k);
    chirp(ctx, dest, at + 0.2, 1450 * b.pitch, 0.8 * k);
    tink(ctx, dest, at + 0.4, 2600, 0.6 * k);
    return;
  }
  if (b.s === 1) {
    chirp(ctx, dest, at, 1300 * b.pitch, 0.8 * k);
    purr(ctx, dest, at + 0.18, 260 * b.pitch, 0.32, 24, k);
    return;
  }
  purr(ctx, dest, at, 185 * b.pitch, 0.7, 18, 1.3 * k);
  for (let q = 0; q < 3; q++) tink(ctx, dest, at + 0.55 + q * 0.07, 1900 - 160 * q, 0.5 * k);
}

/**
 * A strike: its tiles tinking as it gathers itself, and a thump as the blow lands -- deeper for a bigger body -- with a crackle of
 * sparks off its tiles; the Kilnspire's tail slammed down after with a second thump; and a chirp or a purr after it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + KILN_HITS[s] * T;
  for (let q = 0; q < 3; q++) tink(ctx, out, at + 0.06 + q * 0.05, (2400 - 200 * q) * (0.85 + 0.15 * b.pitch), 0.7);
  ring(ctx, out, hit, { freq: 150 - 50 * b.heavy, to: 70, dur: 0.1 + 0.08 * b.heavy, gain: 0.3, type: 'sine', attack: 0.003 });
  burst(ctx, out, hit, { dur: 0.06, freq: 900 - 300 * b.heavy, q: 0.9, gain: 0.18, attack: 0.002 });
  crackle(ctx, out, hit, 0.18, 8, 1.2, s);
  if (s === 2) {
    const slam = at + KILNSPIRE_SLAM * T;
    ring(ctx, out, slam, { freq: 80, to: 50, dur: 0.16, gain: 0.22, type: 'sine', attack: 0.004 });
    burst(ctx, out, slam, { dur: 0.08, freq: 500, q: 0.8, gain: 0.1, attack: 0.003 });
    purr(ctx, out, slam + 0.08, 185 * b.pitch, 0.28, 18, 0.9);
  } else chirp(ctx, out, hit + 0.1, 1300 * b.pitch, 0.6);
};

/**
 * A go at its task: a clink as the unfired pot is taken up; the door's scrape and the fire's whoomph as it opens on the glow, a
 * crackle under it; a clink as the pot is pushed in and another as the fired one is drawn out; the door shut with a dull clank;
 * a clink as the fired pot is set down; and now and then its call. The bigger the body, the lower its pots and its door.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.2, 2, 1.9][s]), b = bodyOf(stage, v), W = KILN_WORK, T = ACT_SECS.work;
  const pot = 900 * (0.8 + 0.2 * b.pitch);
  clink(ctx, out, at + W.pick * T, pot * 1.1, 0.7);
  burst(ctx, out, at + (W.open - 0.06) * T, { dur: 0.1, freq: 1400, to: 900, q: 2, gain: 0.05, attack: 0.02 });
  whoomph(ctx, out, at + (W.open - 0.02) * T, 0.9 + 0.2 * b.pitch, 1);
  crackle(ctx, out, at + W.open * T, (W.shut - W.open) * T, 10, 0.8, 7);
  clink(ctx, out, at + W.push * T, pot, 1);
  clink(ctx, out, at + W.grab * T, pot * 0.92, 1);
  ring(ctx, out, at + W.shut * T, { freq: 180, to: 140, dur: 0.1, gain: 0.08, type: 'triangle', attack: 0.002, partials: [[1, 0.7], [2.7, 0.3]] });
  burst(ctx, out, at + W.shut * T, { dur: 0.05, freq: 700, q: 1, gain: 0.08, attack: 0.002 });
  clink(ctx, out, at + W.set * T, pot * 0.92, 0.8);
  if (v > 0.5) call(ctx, out, at + 0.94 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a crackle quickening and tiles tinking faster and higher as the flakes and embers swirl
 * in, a whoomph of fire to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last
 * -- and then its own call, the chirps, the purr, or the deep crackling purr of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.1 + (flash - 0.2) * (1 - (1 - u) ** 1.6);
    tink(ctx, dest, when, (1800 + 1400 * u) * key, 0.5 + 0.4 * u);
  }
  crackle(ctx, dest, at + 0.1, flash - 0.1, 24, 0.9, 11);
  whoomph(ctx, dest, at + flash - 0.22, key, 1.2);
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.7);
};

export const KILN_VOICE: Voice = { strike, work, evolve };
