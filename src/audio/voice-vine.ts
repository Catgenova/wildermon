import { ACT_SECS } from '../render/beasts';
import { VINE_STRIKE, VINE_WORK } from '../render/wild-vine';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Snarepup's voice, and its stages' (the species is `rowl`): a pup's
 * mews and chirrs, a Lashrunner's hiss and snarl, a Vinehunter's low growl,
 * over the rustle of the leaves on them and the lash of a vine tail.
 *
 * A voiced sound is a buzz -- a sawtooth sliding in pitch -- through a
 * throat's resonances; a chirr is a mew with a fast flutter in its loudness,
 * a cat's trill. A hiss is bright noise with no pitch, and a snarl a hiss
 * over a rasped growl. Leaves are short bursts of bright noise close
 * together, a rustle; a lash is a whoosh rising to a crack, a click of
 * noise with a little high ring in it, where the vine's tip snaps over.
 *
 * Every cue lands where its picture does (`./wild-vine`): the strike's spring
 * on `VINE_STRIKE.spring` and its landing, bite and lash on `VINE_STRIKE.hit`;
 * a go at its task's spring, landing, bite, shakes and lift on `VINE_WORK`;
 * and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz through a throat's resonances under an envelope, with a burr (a flutter in its loudness) in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  burr?: readonly [number, number];
  attack?: number;
  type?: OscillatorType;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const flutter = ctx.createGain();
  flutter.gain.value = 1;
  if (o.burr) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.burr[0];
    depth.gain.value = o.burr[1] * 0.5;
    flutter.gain.value = 1 - o.burr[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const env = ctx.createGain();
  const rise = o.attack ?? 0.018;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.45));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(flutter);
  for (const [f, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    flutter.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/** How a stage sounds: how far down its voice is, how far down its throat, how big its leaves are, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; throat: number; leaf: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.6, 0.42][s] * (0.94 + 0.12 * v), throat: [1, 0.8, 0.66][s], leaf: [1, 0.85, 0.7][s], s };
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A pup's mew: a bright buzz round 760 Hz going up and falling away, through a small throat; `lift` how far it rises. */
function mew(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, lift = 1.35, dur = 0.2): void {
  const f = 760 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.82, f * lift, f * 1.08, f * 0.8], dur, gain: 0.32 * k,
    formants: [[1150, 4, 1], [2700, 6, 0.5], [4000, 7, 0.15]], burr: [26, 0.12], attack: 0.016,
  });
}

/** A chirr: a pup's trill, a short mew rising, fluttered fast in its loudness. */
function chirr(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, dur = 0.16): void {
  const f = 640 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.9, f * 1.25, f * 1.15], dur, gain: 0.3 * k,
    formants: [[1000, 3.5, 1], [2400, 5, 0.45]], burr: [34 + 8 * v, 0.85], attack: 0.01,
  });
}

/** A growl: a low rough buzz, rising a little and sinking, rasped by a fast burr; lower and longer for a bigger body. */
function growl(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.34): void {
  const b = bodyOf(stage, v), f = 200 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.9, f * 1.12, f * 0.95], dur: dur * (1 + 0.25 * b.s), gain: 0.5 * k,
    formants: [[440 * b.throat, 2.5, 1], [1100 * b.throat, 4, 0.45], [2400 * b.throat, 5, 0.12]], burr: [30 + 6 * v, 0.7], attack: 0.03,
  });
}

/** A hiss: breath forced through bared teeth, bright noise swelling and cut off. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, dur = 0.26): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur, freq: 4200 * b.throat, to: 3400 * b.throat, q: 1.1, gain: 0.16 * k, attack: dur * 0.35 });
  burst(ctx, dest, at, { dur: dur * 0.9, freq: 2000 * b.throat, q: 2, gain: 0.07 * k, attack: dur * 0.3 });
}

/** A snarl: a hiss over a growl, the teeth bared. */
function snarl(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.3): void {
  hiss(ctx, dest, at, stage, 0.7 * k, dur);
  growl(ctx, dest, at + 0.01, stage, v, 0.8 * k, dur);
}

/** Leaves rustling: `count` short bright bursts close together over `len` seconds, each a little different. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, leaf: number, v: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const u = (q + 0.45 * Math.abs(Math.sin(q * 3.7 + v * 5))) / count;
    burst(ctx, dest, at + len * u, { dur: 0.035, freq: (3000 + 1600 * Math.abs(Math.sin(q * 2.3 + v))) * leaf, q: 1.4, gain: 0.1 * k * (0.7 + 0.3 * Math.sin(q * 1.9)), attack: 0.004 });
  }
}

/** A vine lashing: a whoosh rising through the air to a crack where its tip snaps over, and its leaves shaken after. */
function lash(ctx: BaseAudioContext, dest: AudioNode, crack: number, len: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  burst(ctx, dest, crack - len, { dur: len, freq: 700 * b.leaf, to: 2600 * b.leaf, q: 0.9, gain: 0.13 * k, attack: len * 0.85 });
  burst(ctx, dest, crack, { dur: 0.03, freq: 3600, q: 0.8, gain: 0.3 * k, attack: 0.001 });
  ring(ctx, dest, crack, { freq: 2100 * b.leaf, to: 1500 * b.leaf, dur: 0.04, gain: 0.08 * k, type: 'triangle', attack: 0.001 });
  rustle(ctx, dest, crack + 0.02, 0.18, 6, b.leaf, v, 0.8 * k);
}

/** Paws coming down on the ground: a soft low thump, deeper for a bigger body, and a scuff. */
function land(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [230, 150, 105][s], to: [120, 80, 55][s], dur: [0.08, 0.13, 0.2][s], gain: [0.24, 0.32, 0.4][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.03 * s, freq: 900, to: 260, q: 0.8, gain: 0.14 * k, type: 'lowpass', attack: 0.003 });
}

/** Jaws snapping shut: a short hard click with a little knock under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.025, freq: 2600 * b.throat, q: 1.6, gain: 0.26 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 520 * b.throat, to: 360 * b.throat, dur: 0.04, gain: 0.12 * k, type: 'triangle', attack: 0.001 });
}

/**
 * A strike. The Snarepup chirrs as it gathers, hops with a rustle of its
 * leaves, comes down with a soft thump and mews. The Lashrunner hisses as it
 * gathers, springs with a rustle, lands snarling with its jaws snapping, and
 * its vine tail lashes over with a crack. The Vinehunter growls low as it
 * gathers, and lands heavier, snarling, the lash lower and the crack harder.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.35, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const spring = at + VINE_STRIKE.spring * T, hit = at + VINE_STRIKE.hit * T;
  if (s === 0) {
    chirr(ctx, out, at + 0.02, v, 0.8);
    rustle(ctx, out, spring, 0.06, 3, b.leaf, v, 0.7);
    land(ctx, out, hit, 0, 1);
    mew(ctx, out, hit + 0.03, v, 0.7, 1.45, 0.16);
    return;
  }
  if (s === 1) hiss(ctx, out, at + 0.01, s, 0.9, VINE_STRIKE.gather * T);
  else growl(ctx, out, at, s, v, 0.75, VINE_STRIKE.gather * T);
  rustle(ctx, out, spring, 0.07, 4, b.leaf, v, 0.8);
  land(ctx, out, hit, s, 1);
  snap(ctx, out, hit - 0.01, s, 1);
  snarl(ctx, out, hit + 0.01, s, v, 0.75, 0.22 + 0.06 * s);
  // The tip of the lash comes over a little after the paws are down.
  lash(ctx, out, hit + 0.05, 0.12, s, v, 1);
};

/**
 * A go at its task: a soft chirr or a low growl as it stares down at its
 * kill, the leaves rustling as it springs and again as it lands, the jaws
 * snapping on it, a rustle at each shake, and a muffled growl -- a pup's
 * pleased chirr -- with it held up in its jaws.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.3, 1.2, 1.1][s]), b = bodyOf(stage, v), W = VINE_WORK, T = ACT_SECS.work;
  if (s === 0) chirr(ctx, out, at + 0.04, v, 0.5, 0.12);
  else growl(ctx, out, at + 0.02, s, v, 0.35, 0.2);
  rustle(ctx, out, at + W.spring * T, 0.07, 3, b.leaf, v, 0.7);
  land(ctx, out, at + W.land * T, s, 0.9);
  rustle(ctx, out, at + W.land * T + 0.01, 0.1, 4, b.leaf, v, 0.8);
  snap(ctx, out, at + W.grab * T - 0.02, s, 0.9);
  for (let q = 0; q < 3; q++) rustle(ctx, out, at + (W.grab + (W.shake - W.grab) * (q + 0.3) / 3) * T, 0.05, 3, b.leaf * (1 + 0.08 * q), v + q, 0.6);
  if (s === 0) chirr(ctx, out, at + W.lifted * T, v, 0.45, 0.14);
  else growl(ctx, out, at + W.lifted * T, s, v, 0.3, 0.22);
};

/**
 * Evolving, a cue the length of the act: a rustle of leaves stirring and
 * growing thicker and faster to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its
 * own call: a mew, a snarl or a growl of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.6);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) {
    const u = q / 6, when = at + 0.05 + (flash - 0.15) * (1 - (1 - u) ** 1.6);
    rustle(ctx, dest, when, 0.08, 2 + q, b.leaf * (0.9 + 0.2 * u), v + q, 0.4 + 0.5 * u);
  }
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 1800 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  [392, 494, 587].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 100 - 15 * s, to: 55 - 8 * s, dur: 0.4, gain: 0.2, type: 'sine', attack: 0.015 });
  if (s === 0) mew(ctx, dest, at + flash + 0.35, v, 0.6, 1.4, 0.22);
  else if (s === 1) snarl(ctx, dest, at + flash + 0.35, s, v, 0.6, 0.3);
  else growl(ctx, dest, at + flash + 0.32, s, v, 0.6, 0.5);
};

export const VINE_VOICE: Voice = { strike, work, evolve };
