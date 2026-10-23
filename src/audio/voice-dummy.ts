import { ACT_SECS } from '../render/beasts';
import { DUMMY_GATHER, DUMMY_HITS } from '../render/wild-dummy';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Dummicub's voice, and its stages' (the species is `sparra`): a stuffed
 * bear's -- the cub's squeaky "hup!", the Dummibear's short huffing grunt,
 * and the Dummititan's deep, round "hoom" -- over the padded thump of a
 * stuffed paw landing, and the rustle of straw shaken loose in it.
 *
 * A grunt is a buzz through a throat's resonances under a quick swell; the
 * cub's is a squeak, a thin tone sliding up. A padded blow is a low thump of
 * a sine with soft low noise over it, cloth on cloth, and no click: it is
 * stuffed. Straw is high, dry noise in a few quick crackles. The bigger the
 * body, the lower all of it.
 *
 * Every cue lands where its picture does (`./wild-dummy`): each blow of the
 * strike on `DUMMY_HITS`, the grunt as it gathers itself on `DUMMY_GATHER`,
 * and the evolving chime on the flash at the middle of the act.
 */

/** A voiced sound: a buzz sliding through `f`, through a throat's resonances, under a swell. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
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
  const env = ctx.createGain();
  const rise = o.attack ?? 0.012;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.45));
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

/** How a stage sounds: how far down its voice is, and which stage. */
function bodyOf(stage: number, v: number): { pitch: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), s };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * Its own call, by stage. The Dummicub's: a squeaky "hup!", a thin tone sliding up round 820 Hz, a little air in it. The
 * Dummibear's: a short huffing grunt, round 260 Hz, breath under it. The Dummititan's: a deep round "hoom", round 110 Hz, swelled
 * through a chest resonance, a low hum dying after it.
 */
export function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 820 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.8, f * 1.25, f * 1.15], dur: 0.12, gain: 0.45 * k, formants: [[1400, 3, 1], [2800, 4, 0.35]], type: 'triangle', attack: 0.01 });
    burst(ctx, dest, at, { dur: 0.08, freq: 3200, q: 1.2, gain: 0.05 * k, attack: 0.01 });
    return;
  }
  if (b.s === 1) {
    const f = 420 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 1.1, f, f * 0.82], dur: 0.18, gain: 0.4 * k, formants: [[480, 2.5, 1], [1050, 3, 0.7], [2300, 4, 0.2]], attack: 0.015 });
    burst(ctx, dest, at, { dur: 0.16, freq: 1300, to: 700, q: 0.9, gain: 0.09 * k, attack: 0.01 });
    return;
  }
  const f = 275 * b.pitch;
  voiced(ctx, dest, at, { f: [f * 0.9, f * 1.05, f * 0.95, f * 0.8], dur: 0.6, gain: 0.3 * k, formants: [[140, 2, 0.9], [260, 2.5, 1.3], [520, 3, 0.45], [1000, 4, 0.08]], attack: 0.05 });
  ring(ctx, dest, at + 0.03, { freq: f * 0.5, to: f * 0.4, dur: 0.7, gain: 0.08 * k, type: 'sine', attack: 0.05 });
}

/** A stuffed paw landing: a soft low thump and the scuff of cloth on cloth, deeper and heavier for a bigger body; no click in it. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [240, 140, 84][s], to: [130, 70, 40][s], dur: [0.09, 0.16, 0.32][s], gain: [0.32, 0.46, 0.6][s] * k, type: 'sine', attack: 0.004 });
  burst(ctx, dest, at, { dur: 0.06 + 0.06 * s, freq: [900, 600, 380][s], to: [400, 260, 150][s], q: 0.7, gain: (0.14 + 0.05 * s) * k, type: 'lowpass', attack: 0.004 });
}

/** Straw shaken loose: a few dry crackles of high noise, lower and more of them for a bigger body. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage)), n = 3 + 2 * s;
  for (let q = 0; q < n; q++) {
    const when = at + q * 0.028 + 0.012 * Math.abs(Math.sin(q * 3.1 + v * 5));
    burst(ctx, dest, when, { dur: 0.04, freq: (5200 - 900 * s) * (0.85 + 0.3 * Math.abs(Math.sin(q * 1.7 + v))), q: 1.6, gain: 0.05 * k, attack: 0.002 });
  }
}

/**
 * A strike. The Dummicub squeaks as it hops in, and each of its two swipes lands with a small padded pat. The Dummibear huffs as
 * it steps in, and its jab and its cross land as two padded thumps, the cross the heavier. The Dummititan hooms as it raises its
 * paws, and they come down together in one deep padded slam. Straw rustles out of it as the last blow jars it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.2, 1.0][s]), T = ACT_SECS.strike;
  const hits = DUMMY_HITS[s];
  call(ctx, out, at + DUMMY_GATHER[s] * T - (s === 2 ? 0.12 : 0.06), s, v, 0.55);
  hits.forEach((h, q) => thump(ctx, out, at + h * T, s, q === hits.length - 1 ? 1 : 0.7));
  rustle(ctx, out, at + hits[hits.length - 1] * T + 0.02, s, v, 1);
  if (s === 2) ring(ctx, out, at + hits[0] * T + 0.01, { freq: 50, to: 34, dur: 0.45, gain: 0.25, type: 'sine', attack: 0.01 });
};

/**
 * Evolving, a cue the length of the act: straw rustling faster and higher as the light gathers, to the flash at its middle, where a
 * clear chime rings over a soft deep swell -- each stage's lower than the last -- and then its own call, the squeak, the huff or
 * the hoom of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.7);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], flash = 0.5 * ACT_SECS.evolve;
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 900 * key, to: 3000 * key, q: 1.1, gain: 0.06, attack: (flash - 0.1) * 0.85 });
  for (let q = 0; q < 8; q++) rustle(ctx, dest, at + 0.12 + (flash - 0.24) * (q / 8) ** 0.8, s, v + q, 0.4 + 0.08 * q);
  ring(ctx, dest, at + flash, { freq: 1568 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 96 - 15 * s, to: 52 - 8 * s, dur: 0.45, gain: 0.2, type: 'sine', attack: 0.015 });
  call(ctx, dest, at + flash + 0.35, s, v, 0.6);
};

export const DUMMY_VOICE: Voice = { strike, evolve };
