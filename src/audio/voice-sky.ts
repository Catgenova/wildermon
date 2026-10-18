import { burst, noiseBuffer, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Skylooklet's voice, and its stages' (the species is `warda`): a
 * watcher's whistle, the rush of its wings and the knock of its hooves. A
 * whistle is a sine gliding in pitch with a little of its octave over it, a
 * slow vibrato in it and a breath of air through it. Each stage whistles
 * the same way, lower the bigger it is: the Skylooklet a bright chirp, the
 * Skywarden a clear call of two notes, the Skyrange one low, long, ringing
 * note that carries, with its own echo coming back off the hills.
 */

/** A whistle: the pitch through it, evenly spaced from start to end, how long, how loud, and how it is coloured. */
interface Whistle {
  f: readonly number[];
  dur: number;
  gain: number;
  /** How fast the vibrato goes, and how deep, as a share of the pitch. */
  vib?: readonly [number, number];
  /** How much octave over it, and how much of a twelfth. */
  over?: readonly [number, number];
  /** How much air through it. */
  breath?: number;
  attack?: number;
}

function whistle(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Whistle): void {
  const env = ctx.createGain();
  const rise = o.attack ?? 0.018;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  env.connect(dest);
  const [o2, o3] = o.over ?? [0.1, 0];
  const lfo = o.vib ? ctx.createOscillator() : null;
  if (lfo && o.vib) {
    lfo.frequency.value = o.vib[0];
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  for (const [mul, share] of [[1, 1], [2, o2], [3, o3]] as const) {
    if (share <= 0) continue;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    o.f.forEach((f, i) => {
      const t = at + (o.dur * 0.8 * i) / Math.max(1, o.f.length - 1);
      if (i === 0) osc.frequency.setValueAtTime(f * mul, t);
      else osc.frequency.exponentialRampToValueAtTime(f * mul, t);
    });
    if (lfo && o.vib) {
      const depth = ctx.createGain();
      depth.gain.value = o.f[0] * mul * o.vib[1];
      lfo.connect(depth).connect(osc.frequency);
    }
    const g = ctx.createGain();
    g.gain.value = share;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + o.dur + 0.05);
  }
  // The air through it: a narrow band of noise about the pitch, soft under the note.
  if (o.breath) burst(ctx, dest, at, { dur: o.dur * 0.9, freq: o.f[0], to: o.f[o.f.length - 1], q: 5, gain: o.gain * o.breath, attack: Math.max(rise, o.dur * 0.25) });
}

/** How a stage sounds: how far down its whistle is, how much longer it draws a sound out, and how heavy it is on its feet. */
function bodyOf(stage: number, v: number): { pitch: number; long: number; weight: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.96 + 0.08 * v), long: 1 + 0.35 * s, weight: s };
}

/**
 * Its call, `k` loud, a stage at a time but all of one kind -- a whistle
 * rising into its note and falling away: the Skylooklet's a bright chirp
 * and a second, quicker one; the Skywarden's two clear notes, the second a
 * fourth over the first; the Skyrange's one long note, lower, ringing,
 * with a twelfth in it and its echo coming back faint a moment later.
 * `lift` raises the whole of it, for the bright call it gives as it evolves.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, lift = 1): void {
  const b = bodyOf(stage, v), f = 2600 * b.pitch * lift;
  if (stage <= 0) {
    whistle(ctx, dest, at, { f: [f * 0.78, f * 1.22, f * 1.05], dur: 0.13, gain: 0.34 * k, vib: [9, 0.01], over: [0.14, 0], breath: 0.25 });
    whistle(ctx, dest, at + 0.15, { f: [f * 0.9, f * 1.3, f * 1.12], dur: 0.1, gain: 0.26 * k, over: [0.14, 0], breath: 0.2 });
  } else if (stage === 1) {
    whistle(ctx, dest, at, { f: [f * 0.92, f, f], dur: 0.16, gain: 0.3 * k, vib: [6, 0.008], over: [0.12, 0.02], breath: 0.2 });
    // Raised, for the flash as it evolves, the first note is the loud one, so the call peaks at the flash and not after it.
    whistle(ctx, dest, at + 0.17, { f: [f * 1.25, f * 1.34, f * 1.32, f * 1.24], dur: 0.26, gain: (lift > 1 ? 0.24 : 0.32) * k, vib: [6, 0.01], over: [0.12, 0.02], breath: 0.2 });
  } else {
    const ring1: Whistle = { f: [f * 0.86, f * 1.04, f, f * 0.95], dur: 0.55, gain: 0.32 * k, vib: [5.2, 0.012], over: [0.2, 0.07], breath: 0.15, attack: 0.02 };
    whistle(ctx, dest, at, ring1);
    // Its echo, off the hills: the same note, fainter and duller, a little after.
    whistle(ctx, dest, at + 0.24, { ...ring1, gain: 0.09 * k, over: [0.05, 0], breath: 0 });
  }
}

/**
 * Air swelling and dying away: noise through a band that moves from `f0` up
 * to `f1` at the height of it and down to `f2` by the end, its loudness
 * rising evenly to the height and falling evenly from it, so that it comes
 * and goes as a breath does rather than as a hit.
 */
function swell(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, peak: number, f: readonly [number, number, number], q: number, gain: number, top?: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(f[0], at);
  band.frequency.exponentialRampToValueAtTime(f[1], at + dur * peak);
  band.frequency.exponentialRampToValueAtTime(f[2], at + dur);
  const env = ctx.createGain();
  // Silent from the start: a gain node is at one until told otherwise, and the noise would sound for a sample before the ramp.
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + dur * peak);
  env.gain.linearRampToValueAtTime(0, at + dur);
  // Its top cut away, when it is the soft rush of wind under something else rather than a hiss.
  let out: AudioNode = band;
  if (top) {
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = top;
    low.Q.value = 0.5;
    out = band.connect(low);
  }
  src.connect(band);
  out.connect(env).connect(dest);
  src.start(at, 0.37);
  src.stop(at + dur + 0.02);
}

/** The rush of its wings beating once: a band of air rising and falling, lower on a bigger body. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const low = 1 / (1 + 0.25 * bodyOf(stage, 0.5).weight);
  swell(ctx, dest, at, dur, 0.6, [500 * low, 1600 * low, 700 * low], 0.9, 0.5 * k, 2500);
}

/**
 * A blow landing: a hoof coming down hard on the ground -- a low thud
 * falling to a floor of 60 Hz, the knock of the hoof itself higher over it,
 * and the dull slap of the ground -- or, for the Skylooklet, the lighter
 * knock of its head going in. Bigger and lower at each stage.
 */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const w = bodyOf(stage, v).weight;
  ring(ctx, dest, at, { freq: 150 - 15 * w, to: 58, dur: 0.16 + 0.05 * w, gain: (0.32 + 0.05 * w) * k, type: 'sine', attack: 0.015 });
  ring(ctx, dest, at, { freq: 420 - 70 * w + 30 * v, to: 260 - 30 * w, dur: 0.07, gain: 0.2 * k, type: 'triangle', attack: 0.015 });
  burst(ctx, dest, at, { dur: 0.1 + 0.03 * w, freq: 520 - 60 * w, to: 170, q: 0.7, gain: 0.3 * k, type: 'lowpass', attack: 0.015 });
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** When the blow lands in a strike's picture, a stage at a time, in seconds from its start (`HIT` in `../render/wild-sky`, over the 0.55 s it takes). */
const HIT_AT = [0.48 * 0.55, 0.52 * 0.55, 0.54 * 0.55] as const;

/**
 * A strike: the rush of its wings as it rears and flares them (or, the
 * Skylooklet, flaps once as it draws back), then the thud of the hooves
 * coming down -- louder than all that went before it -- just over a quarter
 * of a second on, when the blow lands in its picture, and once the thud has
 * gone, a short sharp call.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.04);
  const s = Math.max(0, Math.min(2, stage)), hit = at + HIT_AT[s];
  whoosh(ctx, out, at + 0.02, s, HIT_AT[s] - 0.04, 0.9);
  thud(ctx, out, hit, s, v, 1);
  // The Skyrange's double stamp: the second hoof a hair after the first.
  if (s === 2) thud(ctx, out, hit + 0.035, s, v, 0.45);
  call(ctx, out, hit + 0.12, s, v, 0.36);
};

/**
 * Evolving, a cue the length of the act: wind rising round it and a flutter
 * of feathers quickening, building to the flash at the middle of it, where
 * its call rings out bright and high over a shimmer of chimes -- each stage's
 * lower than the last -- and then, settling, its own call, quieter.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.25);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s];
  // The wind rising, slow to come in.
  // The wind rising, slow to come in, lower for a bigger body, and soft: its top cut away so it is a rush of air and not a hiss.
  swell(ctx, dest, at, 1.2, 0.74, [380 * key, 2000 * key, 1200 * key], 1.1, 0.36, 3000 * key);
  // The flutter: soft beats of air, coming closer together and louder as it builds.
  let when = at + 0.08;
  for (let q = 0; q < 14 && when < at + 0.86; q++) {
    burst(ctx, dest, when, { dur: 0.04, freq: (1700 + 200 * Math.sin(q * 1.7)) * key, q: 3, gain: 0.1 + 0.14 * (q / 13), attack: 0.016 });
    when += 0.09 - 0.0045 * q;
  }
  // The flash, at the middle of the act: its call, bright and high, and a shimmer of chimes under it.
  const flash = at + 0.9;
  // The chick's no higher than a little over its own call, which is high already.
  call(ctx, dest, flash, s, v, 0.48, s === 0 ? 1.15 : 1.35);
  for (const [f, d] of [[1568, 0], [2093, 0.03], [3136, 0.06]] as const) ring(ctx, dest, flash + d, { freq: f * key, dur: 0.6, gain: 0.045, type: 'sine', attack: 0.018, partials: [[1, 0.8], [2, 0.2]] });
  // Settled, its own call, quieter.
  call(ctx, dest, at + 1.22, s, v, 0.22);
};

export const SKY_VOICE: Voice = { strike, evolve };
