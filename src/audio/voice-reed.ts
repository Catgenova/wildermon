import { ACT_SECS } from '../render/beasts';
import { REED_HITS, REED_WORK } from '../render/wild-reed';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Reedpup's voice, and its stages' (the species is `sedra`): an otter's
 * chirps, whistles and chuckles, over the dry rustle and swish of reeds. A
 * chirp is a short bright whistle sliding up through a small throat; a
 * chuckle a quick run of soft voiced huffs, lower and slower the bigger the
 * body, so the Marshreaper's is a deep chest-chuckle that sits between 150
 * and 300 Hz where a small speaker still plays it. Reeds are noise: a rustle
 * is a scatter of short bright ticks of it, a swish a band of it swept up to
 * the blow, a snap a hard click over a hollow knock; the Marshreaper's
 * scythe swishes long and low and rings thinly as it cuts.
 *
 * Every cue lands where its picture does (`./wild-reed`): the strike on
 * `REED_HITS`, the Reedpup's bite, tugs and letting go, the Reedweaver's
 * grip, snap, toss and the cut top landing, and the Marshreaper's sweep and gather on
 * `REED_WORK`, and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz or a whistle sliding in pitch through a throat's resonances under an envelope. */
interface Voiced { f: readonly number[]; dur: number; gain: number; formants: ReadonlyArray<readonly [number, number, number]>; attack?: number; type?: OscillatorType }

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const env = ctx.createGain();
  const rise = o.attack ?? 0.015;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    osc.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** How a stage sounds: how far down its voice is, how far down its reeds rustle, how slow its chuckle, and which it is. */
function bodyOf(stage: number, v: number): { pitch: number; reed: number; slow: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.36][s] * (0.94 + 0.12 * v), reed: [1, 0.8, 0.62][s], slow: [1, 1.3, 1.7][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A chirp: a short whistle sliding up and falling back a little, `f` at its root, with a breath of air on it. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, k: number): void {
  voiced(ctx, dest, at, { f: [f * 0.82, f * 1.32, f * 1.12], dur, gain: 0.32 * k, type: 'triangle', formants: [[f * 1.15, 2.2, 1], [f * 2.4, 4, 0.25]], attack: 0.012 });
  burst(ctx, dest, at, { dur: dur * 0.8, freq: f * 2.6, q: 2, gain: 0.03 * k, attack: dur * 0.3 });
}

/** A chuckle: `n` soft voiced huffs in a quick run, each a little lower than the last, through an otter's throat. */
function chuckle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, n: number, k: number): void {
  const b = bodyOf(stage, v), gap = 0.07 * b.slow, f = 520 * b.pitch;
  for (let q = 0; q < n; q++) {
    const t = at + q * gap, g = (1 - 0.12 * q) * k, ff = f * (1 - 0.05 * q);
    if (b.s === 2) {
      // The Marshreaper's from its chest: a buzz round 170 Hz with its body between 150 and 300.
      voiced(ctx, dest, t, { f: [ff * 0.95, ff * 1.08, ff * 0.9], dur: gap * 0.85, gain: 0.5 * g, formants: [[170, 2.5, 1.3], [260, 3, 1.1], [520, 3, 0.4], [1100, 4, 0.1]], attack: 0.012 });
    } else {
      voiced(ctx, dest, t, { f: [ff * 0.95, ff * 1.1, ff * 0.9], dur: gap * 0.8, gain: 0.34 * g, formants: [[ff * 1.4, 2.5, 1], [ff * 3, 3.5, 0.4], [2600, 4, 0.12]], attack: 0.01 });
    }
    burst(ctx, dest, t, { dur: gap * 0.6, freq: 1800 * b.pitch + 600, q: 1.2, gain: 0.03 * g, attack: 0.008 });
  }
}

/**
 * Its own call, by stage. The Reedpup: two bright rising chirps, a pup's squeak. The Reedweaver: a whistle and a chuckle after
 * it. The Marshreaper: a deep chuckle from its chest, a low whistle over its end.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    chirp(ctx, dest, at, 2300 * b.pitch, 0.08, k);
    chirp(ctx, dest, at + 0.11, 2500 * b.pitch, 0.1, 0.9 * k);
    return;
  }
  if (b.s === 1) {
    // Its whistle round 700 to 900 Hz, under the pup's and over the Marshreaper's.
    chirp(ctx, dest, at, 1150 * b.pitch, 0.16, 1.5 * k);
    chuckle(ctx, dest, at + 0.19, 1, v, 3, 1.2 * k);
    return;
  }
  chuckle(ctx, dest, at, 2, v, 4, k);
  ring(ctx, dest, at + 0.02, { freq: 85 * (0.95 + 0.1 * v), to: 70, dur: 0.45, gain: 0.12 * k, type: 'sine', attack: 0.03 });
  chirp(ctx, dest, at + 0.5, (900 * b.pitch) / 0.36, 0.16, 0.45 * k);
}

/** Reeds rustling: `count` short bright ticks of noise over `len` seconds, the first loudest, as dry leaves brush. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, reed: number, v: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const u = Math.max(0, (q + 0.45 * Math.sin(q * 4.1 + v * 9)) / count);
    burst(ctx, dest, at + len * u, { dur: 0.035 + 0.02 * Math.abs(Math.sin(q * 2.3)), freq: (3600 + 1400 * Math.sin(q * 1.7 + v)) * reed, q: 1.6, gain: 0.11 * k * (1 - 0.5 * u), attack: 0.003 });
  }
  burst(ctx, dest, at, { dur: len, freq: 2600 * reed, to: 1800 * reed, q: 0.7, gain: 0.04 * k, attack: len * 0.3 });
}

/** A swish through the air: a band of noise swept up to the blow, lower and longer for a bigger thing swung. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, lo: number, hi: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: lo, to: hi, q: 1.1, gain: 0.16 * k, attack: len * 0.75 });
}

/** A reed snapped: a hard click over a short hollow knock. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, reed: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.03, freq: 2800 * reed, q: 2.5, gain: 0.3 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 640 * reed, to: 520 * reed, dur: 0.06, gain: 0.12 * k, type: 'triangle', attack: 0.001, partials: [[1, 0.7], [2.3, 0.3]] });
}

/**
 * The blow landing: a sharp short knock, its body a low thud and its edge a bright tick, over in a few hundredths of a second,
 * so a strike has the peak of a blow without being any louder for longer.
 */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, low: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.018, freq: 3200, q: 0.7, gain: 0.55 * k, attack: 0.0008 });
  ring(ctx, dest, at, { freq: low, to: low * 0.6, dur: 0.05, gain: 0.5 * k, type: 'sine', attack: 0.001 });
}

/** Teeth meeting: a small dry click. */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.02, freq: 4200, q: 3, gain: 0.22 * k, attack: 0.001 });
}

/** The scythe's blade through the reeds: a long low swish, a ring of its edge, and the reeds' crash and patter after it. */
function scythe(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void {
  burst(ctx, dest, at - 0.16, { dur: 0.2, freq: 260, to: 900, q: 0.9, gain: 0.2 * k, attack: 0.15 });
  burst(ctx, dest, at - 0.12, { dur: 0.16, freq: 180, to: 300, q: 1.5, gain: 0.18 * k, attack: 0.12, type: 'bandpass' });
  ring(ctx, dest, at, { freq: 2350 * (0.97 + 0.06 * v), dur: 0.35, gain: 0.04 * k, type: 'sine', attack: 0.004, partials: [[1, 0.6], [2.76, 0.28], [5.4, 0.12]] });
  rustle(ctx, dest, at + 0.01, 0.22, 7, 0.75, v, 0.9 * k);
}

/**
 * A strike. The Reedpup chirps and lunges with a rush of air, its teeth snapping shut on the blow; the Reedweaver chuckles as it
 * swings its bundle round with a swish, and the bundle lands with a slap and a burst of rustling; the Marshreaper's chest
 * chuckle under the long low swish and ring of its scythe.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.0, 2.3, 0.74][s]), b = bodyOf(stage, v);
  const hit = at + REED_HITS[s] * ACT_SECS.strike;
  if (s === 0) {
    call(ctx, out, at + 0.02, 0, v, 0.85);
    swish(ctx, out, hit - 0.1, 0.1, 900, 2600, 0.8);
    click(ctx, out, hit, 1.2);
    knock(ctx, out, hit, 260, 0.9);
    rustle(ctx, out, hit + 0.02, 0.12, 4, b.reed, v, 0.6);
    return;
  }
  if (s === 1) {
    chuckle(ctx, out, at + 0.02, 1, v, 3, 0.8);
    swish(ctx, out, hit - 0.14, 0.14, 500, 1900, 1.1);
    knock(ctx, out, hit, 200, 0.29);
    burst(ctx, out, hit, { dur: 0.06, freq: 1300, to: 600, q: 0.8, gain: 0.2, attack: 0.002 });
    burst(ctx, out, hit, { dur: 0.09, freq: 380, to: 200, q: 1, gain: 0.2, type: 'lowpass', attack: 0.003 });
    rustle(ctx, out, hit + 0.01, 0.2, 7, b.reed, v, 1);
    return;
  }
  chuckle(ctx, out, at + 0.02, 2, v, 3, 0.9);
  scythe(ctx, out, hit, v, 1.2);
  knock(ctx, out, hit, 150, 1.1);
};

/**
 * A go at its task. The Reedpup: its teeth click on a reed, two tugs that rustle it, the crack of it bitten through, the
 * patter of the top landing and a chirp. The Reedweaver: a rustle as its paw takes a reed, the snap of its top, a swish as it tosses the top away and a patter as it lands,
 * and a pleased whistle. The Marshreaper: the swish and ring of the scythe through the reeds, and a long rustle as it gathers
 * them in, with a low chuckle.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2.0, 2.1, 1.27][s]), b = bodyOf(stage, v), W = REED_WORK, T = ACT_SECS.work;
  if (s === 0) {
    click(ctx, out, at + W.bite * T, 1);
    for (const t of W.tugs) rustle(ctx, out, at + t * T - 0.03, 0.1, 4, b.reed, v, 0.9);
    snap(ctx, out, at + W.release * T, b.reed, 0.8);
    rustle(ctx, out, at + W.drops * T, 0.08, 3, b.reed * 0.9, v, 0.7);
    chirp(ctx, out, at + (W.drops + 0.08) * T, 2400 * b.pitch, 0.08, 0.6);
    return;
  }
  if (s === 1) {
    rustle(ctx, out, at + W.grab * T - 0.02, 0.12, 4, b.reed, v, 0.8);
    snap(ctx, out, at + W.snap * T, b.reed, 1);
    swish(ctx, out, at + W.toss * T - 0.08, 0.08, 800, 2000, 0.6);
    rustle(ctx, out, at + W.lands * T, 0.1, 4, b.reed * 0.85, v, 0.8);
    chirp(ctx, out, at + (W.lands + 0.08) * T, 1300 * b.pitch, 0.12, 0.5);
    return;
  }
  scythe(ctx, out, at + W.sweep * T, v, 1);
  rustle(ctx, out, at + (W.gather - 0.12) * T, 0.25, 8, b.reed, v, 0.8);
  chuckle(ctx, out, at + (W.gather + 0.08) * T, 2, v, 2, 0.6);
};

/**
 * Evolving, a cue the length of the act: a burst of rustling leaves, then a rustle swelling as the leaves swirl in with a
 * breathy whistle rising through it to the flash at its middle, where a reed-flute chord rings -- three soft notes, lower for
 * each stage -- over a soft low swell, and then its own call, the chirps, the whistle and chuckle, or the chest chuckle of what
 * it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage));
  dest = level(ctx, dest, [1.7, 1.5, 1.25][s]);
  const key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  rustle(ctx, dest, at, 0.25, 8, b.reed, v, 0.9);
  burst(ctx, dest, at + 0.15, { dur: flash - 0.15, freq: 1400 * key, to: 3600 * key, q: 1.2, gain: 0.09, attack: (flash - 0.15) * 0.85 });
  voiced(ctx, dest, at + 0.3, { f: [700 * key, 1400 * key], dur: flash - 0.3, gain: 0.06, type: 'sine', formants: [[1000 * key, 1, 1]], attack: (flash - 0.3) * 0.8 });
  for (let q = 0; q < 6; q++) rustle(ctx, dest, at + 0.3 + q * 0.09, 0.06, 2, b.reed * (0.9 + 0.05 * q), v + q, 0.3 + 0.1 * q);
  [523, 659, 784].forEach((f, q) => ring(ctx, dest, at + flash + q * 0.06, { freq: f * key, dur: 0.9, gain: 0.08, type: 'sine', attack: 0.03, partials: [[1, 0.8], [2, 0.15], [3, 0.05]] }));
  ring(ctx, dest, at + flash, { freq: 130 * key, dur: 0.8, gain: 0.14, type: 'sine', attack: 0.04 });
  call(ctx, dest, at + flash + 0.4, s, v, 0.7);
};

export const REED_VOICE: Voice = { strike, work, evolve };
