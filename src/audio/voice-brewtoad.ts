import { ACT_SECS } from '../render/beat-times';
import { BREW_HITS, BREW_STRIKE, BREW_WORK } from '../render/wild-brewtoad';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Brewtoad's voice, and its stages' (the species is `hoppa`): a bright happy chirrup of a croak, a warm rolling "brrup"
 * that lifts at its end, and a big jolly boom -- and the barrel each sits in or carries: a hollow knock of a hand on its staves,
 * the brew sloshing about in it, froth popping, and the Barrelburp's burp.
 *
 * A croak is a buzz through a throat's resonances whose loudness is chopped into pulses; these lift at the end where a
 * bog toad's fall, which is what makes them sound pleased. A slosh is low-passed noise swept down and up again, twice, as
 * liquid runs one way in a barrel and back; a knock on a stave is a short low ring with a wooden inharmonic over it. The burp is
 * a slow, ragged, falling buzz through an open "uh" of a throat, its pulses uneven.
 *
 * Every cue lands where its picture does (`./wild-brewtoad`): the strike on `BREW_HITS`, the Brewtoad's mouth opening on
 * `BREW_STRIKE.open` and the others rising on `BREW_STRIKE.rise`; each pat of a hand on the barrel and the croak (the
 * Barrelburp's burp) it sits back for on `BREW_WORK`; and the evolving chime on the flash at the middle of the act.
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
  /** How uneven its pulses are, nought to one: the pulse rate wandering as it goes. */
  ragged?: number;
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
  lfo.frequency.setValueAtTime(o.pulse, at);
  if (o.ragged) {
    for (let q = 1; q <= 4; q++) lfo.frequency.linearRampToValueAtTime(o.pulse * (1 + o.ragged * (q % 2 ? -0.4 : 0.3)), at + (o.dur * q) / 4);
  }
  amount.gain.value = o.depth * 0.5;
  lfo.connect(amount).connect(chop.gain);
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
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

const stageOf = (stage: number): number => Math.max(0, Math.min(2, stage));

/** How a stage sounds: how far down its voice is, and how heavy it is. */
function bodyOf(stage: number, v: number): { pitch: number; heavy: number; s: number } {
  const s = stageOf(stage);
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), heavy: [0.4, 0.7, 1][s], s };
}

function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own happy call, by stage. The Brewtoad's: a quick chirrup, three little croaks round 560 Hz, each a step higher. The
 * Brothgut's: a warm "brrup-brrUP", round 210 Hz, the second lifting at its end. The Barrelburp's: a big round "brrooOM", round
 * 100 Hz in slow pulses through a chest between 120 and 300 Hz, swelling up at the end, a hum under it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 560 * b.pitch;
    [1, 1.12, 1.3].forEach((step, q) => croak(ctx, dest, at + q * 0.085, {
      f: [f * step * 0.94, f * step * 1.12], dur: 0.065, gain: 0.75 * k, formants: [[1150, 3, 1], [2400, 4, 0.45]], pulse: 64, depth: 0.6, type: 'triangle',
    }));
    return;
  }
  if (b.s === 1) {
    const f = 340 * b.pitch;
    croak(ctx, dest, at, { f: [f * 0.92, f * 1.0, f * 0.96], dur: 0.18, gain: 0.5 * k, formants: [[270, 2.5, 1], [650, 2.5, 0.9], [1450, 4, 0.3]], pulse: 30 + 6 * v, depth: 0.85 });
    croak(ctx, dest, at + 0.24, { f: [f * 0.9, f * 1.0, f * 1.22], dur: 0.22, gain: 0.48 * k, formants: [[280, 2.5, 1], [700, 2.5, 0.9], [1500, 4, 0.3]], pulse: 30 + 6 * v, depth: 0.85 });
    return;
  }
  const f = 250 * b.pitch;
  croak(ctx, dest, at, { f: [f * 0.86, f * 0.95, f * 1.12], dur: 0.75, gain: 0.24 * k, formants: [[100, 2, 0.7], [180, 3, 1.5], [280, 3.5, 1.1], [520, 3, 0.35], [1050, 4, 0.06]], pulse: 12 + 3 * v, depth: 0.6, attack: 0.05 });
  ring(ctx, dest, at + 0.04, { freq: f * 0.5, to: f * 0.56, dur: 0.85, gain: 0.1 * k, type: 'sine', attack: 0.06 });
}

/** The Barrelburp's burp: a slow ragged buzz falling through an open "uh", round 80 Hz, with a wet click as it starts. */
function burp(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void {
  const f = 92 * (0.95 + 0.1 * v);
  burst(ctx, dest, at, { dur: 0.03, freq: 900, q: 1.5, gain: 0.12 * k, attack: 0.002 });
  croak(ctx, dest, at + 0.02, {
    f: [f * 1.25, f * 1.05, f * 0.9, f * 0.72], dur: 0.62, gain: 0.32 * k, formants: [[140, 2, 1], [420, 3, 1.2], [760, 3.5, 0.6], [1300, 5, 0.12]],
    pulse: 22, depth: 0.75, attack: 0.03, ragged: 0.6,
  });
  ring(ctx, dest, at + 0.03, { freq: f * 0.8, to: f * 0.55, dur: 0.6, gain: 0.12 * k, type: 'sine', attack: 0.04 });
}

/** A hand on a barrel's staves: a short hollow knock, deeper for a bigger barrel. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage), f = [300, 200, 140][s];
  ring(ctx, dest, at, { freq: f, to: f * 0.9, dur: [0.12, 0.18, 0.24][s], gain: 0.3 * k, type: 'sine', attack: 0.002, partials: [[1, 0.75], [2.3, 0.2], [3.9, 0.08]] });
  burst(ctx, dest, at, { dur: 0.03, freq: 1800, to: 900, q: 1.4, gain: 0.08 * k, attack: 0.002 });
}

/** The brew sloshing in a barrel: low-passed noise swept down and back up, twice, as it runs one way and the other. */
function slosh(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage), p = [1.3, 1, 0.75][s], dur = [0.12, 0.16, 0.2][s];
  burst(ctx, dest, at, { dur, freq: 900 * p, to: 380 * p, q: 2.4, gain: 0.14 * k, attack: dur * 0.3, type: 'lowpass' });
  burst(ctx, dest, at + dur * 0.9, { dur: dur * 0.9, freq: 420 * p, to: 760 * p, q: 2.4, gain: 0.1 * k, attack: dur * 0.3, type: 'lowpass' });
  burst(ctx, dest, at + dur * 0.4, { dur: dur * 1.2, freq: 1600 * p, to: 1100 * p, q: 3, gain: 0.03 * k, attack: dur * 0.4 });
}

/** Froth on its brew popping: a few small high plips. */
function froth(ctx: BaseAudioContext, dest: AudioNode, at: number, n: number, v: number, k: number): void {
  for (let q = 0; q < n; q++) {
    const f = 1300 + 700 * Math.abs(Math.sin(q * 2.3 + v * 5));
    ring(ctx, dest, at + q * 0.05 + 0.015 * Math.sin(q * 7 + v), { freq: f * 0.7, to: f, dur: 0.04, gain: 0.05 * k, type: 'sine', attack: 0.002 });
  }
}

/** A heavy body coming down on the ground: a low thump, deeper for a bigger body. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = stageOf(stage);
  ring(ctx, dest, at, { freq: [200, 120, 76][s], to: [100, 60, 36][s], dur: [0.1, 0.2, 0.38][s], gain: [0.3, 0.45, 0.6][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.08 + 0.1 * s, freq: 700, to: 160, q: 0.8, gain: (0.16 + 0.07 * s) * k, type: 'lowpass', attack: 0.003 });
}

/**
 * A strike. The Brewtoad chirrups as its mouth opens and snaps it shut with a wet click, its tub knocking as it lands. The
 * Brothgut croaks as it rises and comes down belly first, its barrel thumping and the brew in it sloshing. The Barrelburp booms
 * as it rears and stamps, a deep thump that shakes its barrel, the brew in it slopping hard.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.4, 1.1, 0.9][s]), T = ACT_SECS.strike;
  const hit = at + BREW_HITS[s] * T;
  if (s === 0) {
    call(ctx, out, at + BREW_STRIKE.open * T - 0.2, 0, v, 0.6);
    ring(ctx, out, hit, { freq: 640, to: 320, dur: 0.05, gain: 0.3, type: 'sine', attack: 0.002 });
    burst(ctx, out, hit, { dur: 0.04, freq: 2000, q: 1.5, gain: 0.16, attack: 0.002 });
    knock(ctx, out, hit + 0.06, 0, 0.7);
    slosh(ctx, out, hit + 0.06, 0, 0.7);
    return;
  }
  call(ctx, out, at + BREW_STRIKE.rise * T - 0.1, s, v, 0.6);
  thump(ctx, out, hit, s, 1);
  knock(ctx, out, hit + 0.01, s, 0.8);
  slosh(ctx, out, hit + 0.03, s, 1.2);
  if (s === 2) ring(ctx, out, hit + 0.02, { freq: 48, to: 32, dur: 0.6, gain: 0.3, type: 'sine', attack: 0.01 });
};

/**
 * A go at its task: a knock and a slosh at each pat of a hand on its barrel, froth popping after; then, sat back, its happy call
 * -- or, from the Barrelburp, a burp.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = stageOf(stage), out = level(ctx, dest, [1.0, 1.0, 0.95][s]), W = BREW_WORK, T = ACT_SECS.work;
  W.pats.forEach((p, q) => {
    knock(ctx, out, at + p * T, s, 0.55 + 0.1 * (q % 2));
    slosh(ctx, out, at + p * T + 0.02, s, 0.5);
  });
  froth(ctx, out, at + (W.pats[W.pats.length - 1] + 0.05) * T, 3 + s, v, 0.8);
  if (s === 2) burp(ctx, out, at + W.croak * T, v, 1);
  else call(ctx, out, at + W.croak * T, s, v, 0.5);
};

/**
 * Evolving, a cue the length of the act: its brew bubbling faster and higher as the hops swirl in, to the flash at its middle,
 * where a clear chime rings over a deep swell -- each stage's lower than the last -- and then its own call, the chirrup, the
 * brrup or the boom of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.75);
  const s = stageOf(stage), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 300 * key, to: 900 * key, q: 1.2, gain: 0.07, attack: (flash - 0.1) * 0.85, type: 'lowpass' });
  for (let q = 0; q < 12; q++) {
    const u = q / 12, when = at + 0.15 + (flash - 0.22) * (1 - (1 - u) ** 1.6);
    ring(ctx, dest, when, { freq: (700 + 900 * u) * key, to: (1000 + 1200 * u) * key, dur: 0.05, gain: 0.03 + 0.04 * u, type: 'sine', attack: 0.002 });
  }
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.22, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const BREW_VOICE: Voice = { strike, work, evolve };
