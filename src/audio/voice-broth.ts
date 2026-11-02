import { ACT_SECS } from '../render/beasts';
import { BROTH_HITS, BROTH_STRIKE, BROTH_WORK } from '../render/wild-broth';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Brothlet's voice, and its stages' (the species is `simma`): a frog's croak -- a small round "brrup", a throaty
 * two-beat "brrok-ok", and a deep slow "brrrooom" -- over the broth it carries and cooks: a slosh in its throat, a pot
 * bubbling, a wooden spoon dragged round the pot and knocked on its rim.
 *
 * A croak is a buzz through a throat's resonances whose loudness is chopped into pulses, a frog's call being a train of
 * clicks; the smaller the frog, the higher the buzz and the faster the pulses. Broth bubbling is a run of low sines each
 * leaping up in pitch as it dies, as a bubble's ring does as it closes, thicker and lower than water's; the spoon's drag is
 * a band of noise sweeping round with it; its knock a short wooden ring.
 *
 * Every cue lands where its picture does (`../render/wild-broth`): the strike on `BROTH_HITS`, the Brothlet's mouth
 * snapping open on `BROTH_STRIKE.open` and the bigger two leaving the ground on `BROTH_STRIKE.rise`; the spoon's scrape
 * along the far side of the pot and its knock on the rim on `BROTH_WORK`; and the evolving chime on the flash at the middle
 * of the act.
 */

/** A voiced sound: a buzz sliding through `f`, chopped into pulses `pulse` times a second, through a throat's resonances. */
interface Croak {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  pulse: number;
  depth: number;
  attack?: number;
  type?: OscillatorType;
}

function croak(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Croak): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const chop = ctx.createGain();
  chop.gain.value = 1 - o.depth * 0.5;
  const lfo = ctx.createOscillator(), amount = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.value = o.pulse;
  amount.gain.value = o.depth * 0.5;
  lfo.connect(amount).connect(chop.gain);
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.5));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(chop);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    chop.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  for (const n of [osc, lfo]) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** How a stage sounds: how far down its voice is, how much broth it slops about, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; broth: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.42][s] * (0.95 + 0.1 * v), broth: [1, 0.78, 0.6][s], s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Brothlet's: a small round "brrup", rising, round 480 Hz in quick pulses. The Stockbelly's: a
 * throaty "brrok-ok", round 210 Hz, falling then lifting. The Cauldronthroat's: a deep slow "brrrooom" round 90 Hz swelled
 * through a big chest, a low hum under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 480 * b.pitch;
    croak(ctx, dest, at, { f: [f * 0.85, f * 1.05, f * 1.15], dur: 0.12, gain: 0.8 * k, formants: [[900, 3, 1], [2000, 4, 0.4]], pulse: 55, depth: 0.7, type: 'triangle' });
    return;
  }
  if (b.s === 1) {
    const f = 340 * b.pitch;
    croak(ctx, dest, at, { f: [f * 1.06, f * 0.88, f * 0.84], dur: 0.22, gain: 0.5 * k, formants: [[280, 2.5, 1], [640, 2.5, 0.9], [1400, 4, 0.3]], pulse: 34 + 6 * v, depth: 0.85 });
    croak(ctx, dest, at + 0.27, { f: [f * 0.9, f * 1.1], dur: 0.12, gain: 0.42 * k, formants: [[290, 2.5, 1], [660, 2.5, 0.8], [1400, 4, 0.25]], pulse: 34 + 6 * v, depth: 0.85 });
    return;
  }
  const f = 220 * b.pitch;
  croak(ctx, dest, at, { f: [f * 0.92, f * 1.04, f * 0.96, f * 0.8], dur: 0.75, gain: 0.24 * k, formants: [[100, 2, 0.7], [180, 3, 1.5], [270, 3.5, 1.1], [500, 3, 0.35], [1000, 4, 0.06]], pulse: 14 + 3 * v, depth: 0.6, attack: 0.06 });
  ring(ctx, dest, at + 0.04, { freq: f * 0.5, to: f * 0.38, dur: 0.85, gain: 0.1 * k, type: 'sine', attack: 0.06 });
}

/** Broth slopping in its throat: a thick wash of noise rising and falling. */
function slosh(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 300 * pitch, to: 700 * pitch, q: 1.6, gain: 0.15 * k, attack: dur * 0.4 });
  burst(ctx, dest, at + dur * 0.35, { dur: dur * 0.8, freq: 850 * pitch, to: 420 * pitch, q: 2.4, gain: 0.08 * k, attack: dur * 0.25 });
}

/** A bubble of thick broth: a low sine leaping up as it closes, and a soft plop. */
function blup(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 150 * pitch, to: 330 * pitch, dur: 0.08, gain: 0.26 * k, type: 'sine', attack: 0.005 });
  burst(ctx, dest, at, { dur: 0.05, freq: 380 * pitch, q: 2, gain: 0.06 * k, attack: 0.004 });
}

/** A wooden spoon dragged round the pot through the broth: a soft band of noise sweeping up and down, `dur` long. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, pitch: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 700 * pitch, to: 1200 * pitch, q: 1.3, gain: 0.07 * k, attack: dur * 0.45 });
  burst(ctx, dest, at + dur * 0.3, { dur: dur * 0.6, freq: 2400 * pitch, to: 1700 * pitch, q: 3, gain: 0.025 * k, attack: dur * 0.3 });
}

/** The spoon knocked on the pot's rim: a short wooden ring and a click. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number): void {
  ring(ctx, dest, at, { freq: 820 * pitch, dur: 0.07, gain: 0.16 * k, type: 'sine', attack: 0.001, partials: [[1, 0.7], [2.4, 0.25], [4.1, 0.08]] });
  burst(ctx, dest, at, { dur: 0.02, freq: 2600, q: 1.5, gain: 0.08 * k, attack: 0.001 });
}

/** A heavy soft body coming down on the ground: a low thump. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [210, 130, 86][s], to: [110, 64, 40][s], dur: [0.1, 0.2, 0.34][s], gain: [0.3, 0.44, 0.55][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.08 * s, freq: 700, to: 170, q: 0.8, gain: (0.16 + 0.06 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * A strike. The Brothlet croaks, its mouth snaps open with a wet smack and shut on what is in front of it. The bigger two
 * croak as they leave the ground, the broth in their throats slops, and they come down on their bellies with a thump.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.1, 0.9][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const hit = at + BROTH_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + 0.01, 0, v, 0.55);
    burst(ctx, out, at + BROTH_STRIKE.open * T, { dur: 0.05, freq: 1400, q: 1.6, gain: 0.12, attack: 0.004 });
    ring(ctx, out, hit, { freq: 480, to: 240, dur: 0.06, gain: 0.32, type: 'sine', attack: 0.002 });
    burst(ctx, out, hit, { dur: 0.05, freq: 1500, q: 1.5, gain: 0.18, attack: 0.002 });
    thump(ctx, out, hit + 0.02, 0, 0.6);
    return;
  }
  call(ctx, out, at + BROTH_STRIKE.rise * T - 0.12, s, v, 0.6);
  slosh(ctx, out, at + BROTH_STRIKE.rise * T, 0.2, b.broth, 0.6);
  thump(ctx, out, hit, s, 1);
  slosh(ctx, out, hit + 0.03, 0.28, b.broth, 0.9);
};

/**
 * A go at its task: the spoon dragged once round the pot, scraping along its far side; the broth bubbling under it; the
 * spoon knocked on the rim as it comes round; and the broth in its throat slopping round after it.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.6, 1.6, 1.7][s]), b = bodyOf(stage, v), W = BROTH_WORK, T = ACT_SECS.work;
  scrape(ctx, out, at + (W.scrape - 0.22) * T, 0.44 * T, b.broth, 1);
  for (let q = 0; q < 3; q++) blup(ctx, out, at + (0.12 + 0.27 * q + 0.05 * Math.sin(q * 3 + v * 7)) * T, b.broth * (0.9 + 0.2 * Math.abs(Math.sin(q * 2.1 + v))), 0.8);
  knock(ctx, out, at + W.tap * T, b.broth, 1);
  if (s) slosh(ctx, out, at + 0.3 * T, 0.3, b.broth, 0.45);
  if (v > 0.7) call(ctx, out, at + 0.6 * T, s, v, 0.3);
};

/**
 * Evolving, a cue the length of the act: a slosh, then bubbles rising faster and higher as the steam and the bits swirl in,
 * to the flash at its middle, where a clear chime rings over a deep swell -- each stage's lower than the last -- and then
 * its own call, the croak of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  slosh(ctx, dest, at, 0.25, b.broth, 0.8);
  burst(ctx, dest, at + 0.12, { dur: flash - 0.12, freq: 260 * key, to: 800 * key, q: 1.4, gain: 0.09, attack: (flash - 0.12) * 0.85 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.22 + (flash - 0.28) * (1 - (1 - u) ** 1.6);
    blup(ctx, dest, when, (1 + 1.4 * u) * key, 0.6 + 0.4 * u);
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.42, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const BROTH_VOICE: Voice = { strike, work, evolve };
