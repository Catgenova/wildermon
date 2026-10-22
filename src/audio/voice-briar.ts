import { ACT_SECS } from '../render/beasts';
import { BRIAR_CAST, BRIAR_STRIKE, BRIAR_WORK } from '../render/wild-briar';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Blushkit's voice, and its stages' (the species is `lungra`): a kit's
 * mews and trills, a Briarpounce's hissing chirr, a Thornlance's snarling
 * roar, over the rustle of the leaves on them.
 *
 * A voiced sound is a buzz -- a sawtooth sliding in pitch -- through a
 * throat's resonances; a trill is a mew with a fast flutter in its loudness,
 * and a chirr the same lower and rougher. A hiss is bright noise with no
 * pitch, and a roar a low buzz rising and falling through a wide throat,
 * rasped, with a hiss over it. Leaves are short bursts of bright noise close
 * together, a rustle; a swipe is a whoosh of air ending in a scratch.
 *
 * Every cue lands where its picture does (`./wild-briar`): the strike's
 * swipe on `BRIAR_STRIKE.hit`; the hiss at its post on `BRIAR_WORK.hiss`; the
 * pounce's spring, landing and bite on `BRIAR_CAST`; and the evolving chime on
 * the flash at the middle of the act.
 */

/** A voiced sound: a buzz through a throat's resonances under an envelope, with a burr (a flutter in its loudness) in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  burr?: readonly [number, number];
  attack?: number;
}

function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: Voiced): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
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
  return { pitch: [1, 0.62, 0.4][s] * (0.94 + 0.12 * v), throat: [1, 0.8, 0.64][s], leaf: [1, 0.86, 0.72][s], s };
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A kit's mew: a bright buzz round 820 Hz going up and falling away, through a small throat; `lift` how far it rises. */
function mew(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, lift = 1.35, dur = 0.2): void {
  const f = 820 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.84, f * lift, f * 1.1, f * 0.82], dur, gain: 0.32 * k,
    formants: [[1250, 4, 1], [2900, 6, 0.5], [4200, 7, 0.15]], burr: [24, 0.1], attack: 0.016,
  });
}

/** A kit's trill: a short rising mew fluttered fast in its loudness, a cat's brrp. */
function trill(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, dur = 0.16): void {
  const f = 700 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.88, f * 1.28, f * 1.18], dur, gain: 0.3 * k,
    formants: [[1050, 3.5, 1], [2500, 5, 0.45]], burr: [36 + 8 * v, 0.85], attack: 0.01,
  });
}

/** A chirr: lower and rougher than a trill, its flutter slower, from a bigger throat. */
function chirr(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.22): void {
  const b = bodyOf(stage, v), f = 640 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.9, f * 1.2, f * 1.0], dur, gain: 0.34 * k,
    formants: [[900 * b.throat, 3, 1], [2100 * b.throat, 4.5, 0.4]], burr: [26 + 6 * v, 0.9], attack: 0.012,
  });
}

/** A hiss: breath forced through bared teeth, bright noise swelling and cut off. */
function hiss(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, dur = 0.26): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur, freq: 4400 * b.throat, to: 3500 * b.throat, q: 1.1, gain: 0.16 * k, attack: dur * 0.35 });
  burst(ctx, dest, at, { dur: dur * 0.9, freq: 2100 * b.throat, q: 2, gain: 0.07 * k, attack: dur * 0.3 });
}

/** A growl: a low rough buzz, rising a little and sinking, rasped by a fast burr. */
function growl(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.34): void {
  const b = bodyOf(stage, v), f = 210 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.9, f * 1.12, f * 0.95], dur, gain: 0.5 * k,
    formants: [[460 * b.throat, 2.5, 1], [1150 * b.throat, 4, 0.45], [2500 * b.throat, 5, 0.12]], burr: [30 + 6 * v, 0.7], attack: 0.03,
  });
}

/** A roar: a big cat's, a wide-throated buzz swelling up and falling away, rasped, a hiss over its top. */
function roar(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.5): void {
  const b = bodyOf(stage, v), f = 190 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.85, f * 1.35, f * 1.2, f * 0.8], dur, gain: 0.55 * k,
    formants: [[380 * b.throat, 2, 1], [900 * b.throat, 3, 0.6], [2000 * b.throat, 4, 0.2]], burr: [22 + 6 * v, 0.6], attack: 0.05,
  });
  hiss(ctx, dest, at + 0.02, stage, 0.5 * k, dur * 0.7);
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
    burst(ctx, dest, at + len * u, { dur: 0.035, freq: (3100 + 1500 * Math.abs(Math.sin(q * 2.3 + v))) * leaf, q: 1.4, gain: 0.1 * k * (0.7 + 0.3 * Math.sin(q * 1.9)), attack: 0.004 });
  }
}

/** A claw swiping: a short whoosh rising through the air, ending in a scratch. */
function swipe(ctx: BaseAudioContext, dest: AudioNode, hit: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, hit - 0.1, { dur: 0.1, freq: 900 * b.leaf, to: 2800 * b.leaf, q: 0.9, gain: 0.12 * k, attack: 0.085 });
  burst(ctx, dest, hit, { dur: 0.05, freq: 5200, to: 3000, q: 2.2, gain: 0.16 * k, attack: 0.002 });
}

/** Paws coming down on the ground: a soft low thump, deeper for a bigger body, and a scuff. */
function land(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const s = Math.max(0, Math.min(2, stage));
  ring(ctx, dest, at, { freq: [240, 150, 100][s], to: [120, 78, 52][s], dur: [0.08, 0.14, 0.22][s], gain: [0.24, 0.32, 0.42][s] * k, type: 'sine', attack: 0.003 });
  burst(ctx, dest, at, { dur: 0.07 + 0.03 * s, freq: 900, to: 260, q: 0.8, gain: 0.14 * k, type: 'lowpass', attack: 0.003 });
}

/** Jaws snapping shut: a short hard click with a little knock under it. */
function snap(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.025, freq: 2600 * b.throat, q: 1.6, gain: 0.26 * k, attack: 0.001 });
  ring(ctx, dest, at, { freq: 520 * b.throat, to: 360 * b.throat, dur: 0.04, gain: 0.12 * k, type: 'triangle', attack: 0.001 });
}

/**
 * A strike. The Blushkit trills as it rears, bats with a soft swipe and
 * mews. The Briarpounce hisses as it raises its paw, slashes and chirrs. The
 * Thornlance growls as it rears, rakes, its jaws snapping, and snarls.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.9, 1.5, 1.3][s]), b = bodyOf(stage, v), T = ACT_SECS.strike;
  const raise = at + BRIAR_STRIKE.raise * T, hit = at + BRIAR_STRIKE.hit * T;
  rustle(ctx, out, raise - 0.04, 0.08, 3, b.leaf, v, 0.6);
  if (s === 0) {
    trill(ctx, out, at + 0.03, v, 0.7);
    swipe(ctx, out, hit, 0, 0.7);
    land(ctx, out, hit + 0.02, 0, 0.7);
    mew(ctx, out, hit + 0.04, v, 0.7, 1.45, 0.16);
    return;
  }
  if (s === 1) hiss(ctx, out, at + 0.01, s, 0.9, BRIAR_STRIKE.raise * T);
  else growl(ctx, out, at, s, v, 0.75, BRIAR_STRIKE.raise * T);
  swipe(ctx, out, hit, s, 1);
  land(ctx, out, hit + 0.01, s, 0.8);
  if (s === 2) snap(ctx, out, hit + 0.02, s, 1);
  if (s === 1) chirr(ctx, out, hit + 0.03, s, v, 0.75, 0.2);
  else snarl(ctx, out, hit + 0.03, s, v, 0.8, 0.3);
};

/**
 * A go at its post: a soft trill or a low chirr or growl as it crouches and
 * looks about, its leaves rustling as they bristle, and a warning at the
 * hiss -- a kit's mew, a hiss, or a snarl.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [2, 1.9, 1.5][s]), b = bodyOf(stage, v), W = BRIAR_WORK, T = ACT_SECS.work;
  rustle(ctx, out, at + 0.04, 0.12, 4, b.leaf, v, 0.6);
  if (s === 0) trill(ctx, out, at + 0.08, v, 0.45, 0.12);
  else if (s === 1) chirr(ctx, out, at + 0.06, s, v, 0.4, 0.18);
  else growl(ctx, out, at + 0.04, s, v, 0.35, 0.3);
  const h = at + (W.hiss - 0.08) * T;
  rustle(ctx, out, h, 0.1, 4, b.leaf, v + 1, 0.7);
  if (s === 0) mew(ctx, out, h, v, 0.55, 1.25, 0.16);
  else if (s === 1) hiss(ctx, out, h, s, 0.9, 0.22);
  else snarl(ctx, out, h, s, v, 0.75, 0.3);
};

/**
 * The pounce: a low chirr or a growl as it gathers, its rump treading; a
 * rustle as it springs and the air going past; a thump as it lands, the
 * leaves bursting off it; and the bite -- a kit's mew, a Briarpounce's
 * hissing chirr, a Thornlance's roar.
 */
const cast = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.5, 1.4, 1.3][s]), b = bodyOf(stage, v), C = BRIAR_CAST, T = ACT_SECS.cast;
  const spring = at + C.spring * T, landAt = at + C.land * T, bite = at + C.bite * T;
  if (s === 0) trill(ctx, out, at + 0.04, v, 0.6, 0.18);
  else if (s === 1) chirr(ctx, out, at + 0.02, s, v, 0.6, C.gather * T);
  else growl(ctx, out, at, s, v, 0.6, C.gather * T);
  rustle(ctx, out, spring - 0.02, 0.08, 4, b.leaf, v, 0.8);
  burst(ctx, out, spring, { dur: landAt - spring, freq: 700 * b.leaf, to: 1800 * b.leaf, q: 0.8, gain: 0.08, attack: (landAt - spring) * 0.6 });
  land(ctx, out, landAt, s, 1.1);
  rustle(ctx, out, landAt + 0.01, 0.2, 8, b.leaf, v + 2, 1);
  if (s > 0) snap(ctx, out, bite, s, 1);
  if (s === 0) mew(ctx, out, bite, v, 0.75, 1.5, 0.18);
  else if (s === 1) { hiss(ctx, out, bite, s, 0.6, 0.2); chirr(ctx, out, bite + 0.04, s, v, 0.7, 0.2); }
  else roar(ctx, out, bite + 0.01, s, v, 0.9, 0.5);
};

/**
 * Evolving, a cue the length of the act: a rustle of leaves stirring and
 * growing thicker and faster to the flash at its middle, where a clear chime
 * rings over a deep swell -- each stage's lower than the last -- and then its
 * own call: a mew, a hissing chirr or a roar of what it has become.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.6);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v), flash = 0.5 * ACT_SECS.evolve;
  for (let q = 0; q < 6; q++) {
    const u = q / 6, when = at + 0.05 + (flash - 0.15) * (1 - (1 - u) ** 1.6);
    rustle(ctx, dest, when, 0.08, 2 + q, b.leaf * (0.9 + 0.2 * u), v + q, 0.4 + 0.5 * u);
  }
  burst(ctx, dest, at + 0.1, { dur: flash - 0.1, freq: 600 * key, to: 1800 * key, q: 1.2, gain: 0.08, attack: (flash - 0.1) * 0.85 });
  [440, 554, 659].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.06, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2, 0.2], [3, 0.06]] }));
  ring(ctx, dest, at + flash, { freq: 1760 * key, dur: 0.5, gain: 0.05, type: 'sine', attack: 0.015, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [440, 554, 659]) ring(ctx, dest, at + flash + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + flash, { freq: 100 - 15 * s, to: 55 - 8 * s, dur: 0.4, gain: 0.2, type: 'sine', attack: 0.015 });
  if (s === 0) mew(ctx, dest, at + flash + 0.35, v, 0.6, 1.4, 0.22);
  else if (s === 1) { hiss(ctx, dest, at + flash + 0.33, s, 0.5, 0.18); chirr(ctx, dest, at + flash + 0.4, s, v, 0.6, 0.26); }
  else roar(ctx, dest, at + flash + 0.32, s, v, 0.7, 0.6);
};

export const BRIAR_VOICE: Voice = { strike, work, cast, evolve };
