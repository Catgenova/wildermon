import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Chiptail's voice, and its stages' (the species is `quarra`): a kit's
 * mew, a prowler's growl and a monolith's rumble, over the knock and clatter
 * of the stone it carries and breaks. A voiced sound is a buzz -- a
 * sawtooth sliding in pitch -- put through the resonances of a throat; stone
 * is a short ring that does not belong to a scale over a burst of filtered
 * noise. A bigger stage is a lower voice and lower, longer, heavier stone.
 *
 * Every cue is laid against its picture (`./wild-chip`): a strike lands at
 * half way through its 0.55 s, a go at its task brings the club down at 0.33 s
 * and rakes the rock at 0.7 s and 0.94 s, and evolving flashes at the
 * middle of its 1.8 s.
 */

/** When, in seconds from the start of a cue, the picture's club lands (a strike), hits the rock and is raked (a go at its task), and flashes (evolving). */
const LANDS = 0.275;
const KNOCK = 0.33;
const RAKES = [0.7, 0.94] as const;
const FLASH = 0.9;

/** A voiced sound: a buzz through a throat's resonances under an envelope, with a burr (a flutter in its loudness) in it. */
interface Voiced {
  /** The pitch through it, evenly spaced from start to end. */
  f: readonly number[];
  dur: number;
  gain: number;
  /** Each resonance: where it is, how narrow, and how loud. */
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

/** How a stage sounds: how far down its voice is, how far down its throat and its stone ring, how long it draws a sound out, and how heavy its stone is. */
function bodyOf(stage: number, v: number): { pitch: number; throat: number; stone: number; long: number; heavy: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.42][s] * (0.94 + 0.12 * v), throat: [1, 0.8, 0.64][s], stone: [1, 0.66, 0.42][s], long: 1 + 0.3 * s, heavy: s };
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A kit's mew: a bright buzz round 700 Hz going up and falling away, through a small throat; `k` loud, `lift` how far it rises. */
function mew(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, lift = 1.35, dur = 0.2): void {
  const f = 720 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.82, f * lift, f * 1.08, f * 0.78], dur, gain: 0.34 * k, type: 'sawtooth',
    formants: [[1100, 4, 1], [2600, 6, 0.5], [3900, 7, 0.16]], burr: [26, 0.12], attack: 0.016,
  });
}

/** A chirp: a short quick upward mew, the kit's trill. */
const chirp = (ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void => mew(ctx, dest, at, v, k, 1.5, 0.09);

/** A growl: a low rough buzz, a prowler's round 120 Hz, rising a little and sinking, rasped by a fast burr. */
function growl(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, dur = 0.34): void {
  const b = bodyOf(stage, v), f = 190 * b.pitch;
  voiced(ctx, dest, at, {
    f: [f * 0.9, f * 1.12, f], dur: dur * b.long * 0.8, gain: 0.5 * k,
    formants: [[420 * b.throat, 2.5, 1], [1050 * b.throat, 4, 0.45], [2300 * b.throat, 5, 0.12]], burr: [34 + 6 * v, 0.7], attack: 0.03,
  });
}

/** A rumble: the deepest voice, round 70 Hz under a grind of low noise, slow to come and slow to go. */
function rumble(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, dur = 0.55): void {
  const f = 78 * (0.94 + 0.12 * v);
  voiced(ctx, dest, at, {
    f: [f * 0.92, f * 1.1, f * 0.86], dur, gain: 0.6 * k,
    formants: [[220, 2, 1], [520, 3, 0.5], [1200, 4, 0.12]], burr: [22, 0.75], attack: 0.06,
  });
  burst(ctx, dest, at, { dur, freq: 260, to: 140, q: 0.8, gain: 0.08 * k, type: 'lowpass', attack: dur * 0.3 });
}

/** A pebble's clack: a knock of stone on stone, high and short, inharmonic so it is stone and not a note. */
function clack(ctx: BaseAudioContext, dest: AudioNode, at: number, pitch: number, k: number, attack = 0.001): void {
  ring(ctx, dest, at, { freq: 2300 * pitch, dur: 0.035 + attack, gain: 0.16 * k, type: 'triangle', attack, partials: [[1, 0.7], [2.32, 0.3]] });
  burst(ctx, dest, at, { dur: 0.03 + attack, freq: 4200 * pitch, q: 1.6, gain: 0.12 * k, attack });
}

/** Grit and chips falling and clattering: `count` clacks over `len` seconds, quieter and further apart as they settle. */
function clatter(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, count: number, pitch: number, v: number, k: number): void {
  for (let q = 0; q < count; q++) {
    const u = Math.max(0, (q + 0.4 * Math.sin(q * 5.3 + v * 7)) / count);
    clack(ctx, dest, at + len * u ** 1.4, pitch * (0.8 + 0.45 * Math.abs(Math.sin(q * 2.7 + v))), k * (1 - 0.6 * u));
  }
}

/**
 * A blow of the club landing, by stage: a kit's bonk, a hollow knock round
 * 600 Hz with a little thump; a prowler's thud, a body of low sine dropping
 * under a knock; a monolith's slam, a deep boom dropping to 38 Hz, a crack
 * of the ground breaking, and the rubble of it coming down for most of a
 * second.
 */
function blow(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k = 1): void {
  const b = bodyOf(stage, v);
  ring(ctx, dest, at, { freq: [170, 120, 80][b.heavy], to: [90, 60, 38][b.heavy], dur: [0.14, 0.24, 0.5][b.heavy], gain: [0.22, 0.36, 0.5][b.heavy] * k, type: 'sine', attack: 0.003 });
  ring(ctx, dest, at, { freq: 620 * b.stone + 30 * v, to: 480 * b.stone, dur: 0.07 + 0.03 * b.heavy, gain: 0.2 * k, type: 'triangle', attack: 0.002, partials: [[1, 0.6], [1.78, 0.3], [2.9, 0.1]] });
  burst(ctx, dest, at, { dur: 0.1 + 0.12 * b.heavy, freq: 900 * b.stone, to: 140, q: 0.7, gain: (0.22 + 0.08 * b.heavy) * k, type: 'lowpass', attack: 0.002 });
  if (b.heavy >= 2) {
    // The ground cracking: a snap of bright noise, and a second, lower, as the crack runs.
    burst(ctx, dest, at + 0.005, { dur: 0.06, freq: 2600, to: 1400, q: 1.2, gain: 0.2 * k, attack: 0.001 });
    burst(ctx, dest, at + 0.07, { dur: 0.09, freq: 1500, to: 700, q: 1.1, gain: 0.12 * k, attack: 0.002 });
  }
  clatter(ctx, dest, at + 0.04, 0.25 + 0.22 * b.heavy, 4 + 3 * b.heavy, b.stone * 1.2, v, (0.55 + 0.15 * b.heavy) * k);
}

/** The club going through the air: a whoosh of noise rising to the blow, lower and longer for a heavier club. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, len: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: len, freq: 500 * b.stone, to: 1800 * b.stone, q: 0.9, gain: 0.12 * k, attack: len * 0.8 });
}

/**
 * A strike: the kit chirps and hops and bonks; the prowler growls as it
 * gathers and the club thuds down; the monolith rumbles, its boulder of a
 * club swishes over and slams the ground. The blow lands at `LANDS`, where
 * the club lands in its picture.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.1 * [1, 1, 0.82][Math.max(0, Math.min(2, stage))]);
  if (stage <= 0) {
    chirp(ctx, out, at + 0.03, v, 0.9);
    mew(ctx, out, at + LANDS + 0.05, v, 0.7, 1.25, 0.16);
  } else if (stage === 1) growl(ctx, out, at, stage, v, 0.9, 0.42);
  else rumble(ctx, out, at, v, 0.9, 0.62);
  whoosh(ctx, out, at + LANDS - 0.13 - 0.04 * stage, stage, 0.13 + 0.04 * stage, 1);
  blow(ctx, out, at + LANDS, stage, v);
};

/**
 * A go at its task, quarrying: the club brought down on the rock at
 * `KNOCK` with a knock and chips clattering off it, then two rakes of the
 * hind paw, each a scrape of claws on stone with grit falling, and a shard
 * breaking off at the end of the second; a contented chirp, a grunt, or a
 * low hum, by stage.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.5 * [1, 1, 0.9][Math.max(0, Math.min(2, stage))]), b = bodyOf(stage, v);
  whoosh(ctx, out, at + KNOCK - 0.1, stage, 0.1, 0.7);
  ring(ctx, out, at + KNOCK, { freq: 760 * b.stone + 40 * v, to: 600 * b.stone, dur: 0.09 + 0.04 * b.heavy, gain: 0.26, type: 'triangle', attack: 0.002, partials: [[1, 0.55], [1.83, 0.3], [3.1, 0.15]] });
  ring(ctx, out, at + KNOCK, { freq: 150 - 30 * b.heavy, to: 80 - 20 * b.heavy, dur: 0.12 + 0.08 * b.heavy, gain: 0.22 + 0.06 * b.heavy, type: 'sine', attack: 0.003 });
  burst(ctx, out, at + KNOCK, { dur: 0.08, freq: 1200 * b.stone, to: 300, q: 0.8, gain: 0.16, type: 'lowpass', attack: 0.002 });
  clatter(ctx, out, at + KNOCK + 0.03, 0.26, 5, b.stone * 1.25, v, 0.6);
  for (const [q, r] of RAKES.entries()) {
    // A scrape: claws dragged along stone, a gritty band of noise with a tremble in it, then grit falling off it.
    for (let g = 0; g < 4; g++) burst(ctx, out, at + r - 0.06 + g * 0.035, { dur: 0.05, freq: (2200 + 300 * g) * (0.8 + 0.2 * b.stone), q: 2.2, gain: 0.1 + 0.03 * (g % 2), attack: 0.004 });
    clatter(ctx, out, at + r + 0.06, 0.12, 3, b.stone * 1.5, v + q, 0.4);
  }
  clack(ctx, out, at + RAKES[1] + 0.12, b.stone * 0.9, 0.7);
  if (stage <= 0) chirp(ctx, out, at + 0.5, v, 0.45);
  else if (stage === 1) growl(ctx, out, at + 0.5, stage, v, 0.32, 0.18);
  else rumble(ctx, out, at + 0.48, v, 0.35, 0.3);
};

/**
 * Evolving, a cue the length of the act: a crack and a burst of grit as the
 * stone bursts off it, then a grinding of stone on stone building as the
 * pebbles swirl in, rising to the flash at its middle, where they knit into
 * it with a resonant stone chime -- a struck bell of rock, low and
 * inharmonic, under a bright note -- and a last call: a mew, a growl or a
 * rumble. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.6);
  const s = Math.max(0, Math.min(2, stage)), key = [1, 0.84, 0.7][s], b = bodyOf(stage, v);
  // The stone bursting off it.
  burst(ctx, dest, at, { dur: 0.14, freq: 1400, to: 500, q: 0.8, gain: 0.2, attack: 0.008 });
  clatter(ctx, dest, at + 0.02, 0.3, 7, 1.1, v, 0.6);
  // Grinding: low gritty noise swelling up to the flash, with stone ticks quickening in it as the pebbles come in.
  burst(ctx, dest, at + 0.15, { dur: FLASH - 0.15, freq: 300 * b.stone + 200, to: 900, q: 1.4, gain: 0.12, attack: (FLASH - 0.15) * 0.85 });
  burst(ctx, dest, at + 0.2, { dur: FLASH - 0.2, freq: 2400, to: 3600, q: 1.2, gain: 0.05, attack: (FLASH - 0.2) * 0.9 });
  for (let q = 0; q < 10; q++) {
    const u = q / 10, when = at + 0.25 + (FLASH - 0.3) * (1 - (1 - u) ** 1.6);
    clack(ctx, dest, when, b.stone * (0.9 + 0.3 * u), 0.35 + 0.35 * u, 0.006);
  }
  // Three notes climbing into it, each a soft stone ring.
  [392, 523, 659].forEach((f, q) => ring(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.4, gain: 0.07, type: 'sine', attack: 0.018, partials: [[1, 0.7], [2.76, 0.2], [5.4, 0.06]] }));
  // The flash: the stone bell, a low struck ring under a clear bright note, and a soft chord ringing on.
  ring(ctx, dest, at + FLASH, { freq: 196 * key, dur: 1.0, gain: 0.16, type: 'sine', attack: 0.02, partials: [[1, 0.6], [2.4, 0.25], [3.9, 0.1], [5.6, 0.05]] });
  ring(ctx, dest, at + FLASH, { freq: 1568 * key, dur: 0.45, gain: 0.05, type: 'sine', attack: 0.018, partials: [[1, 0.7], [1.5, 0.3]] });
  for (const f of [392, 494, 587]) ring(ctx, dest, at + FLASH + 0.01, { freq: f * key, dur: 0.75, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  ring(ctx, dest, at + FLASH, { freq: 90 - 15 * s, to: 50 - 8 * s, dur: 0.35, gain: 0.22, type: 'sine', attack: 0.015 });
  if (s === 0) mew(ctx, dest, at + 1.25, v, 0.6, 1.4, 0.22);
  else if (s === 1) growl(ctx, dest, at + 1.2, stage, v, 0.55, 0.36);
  else rumble(ctx, dest, at + 1.15, v, 0.6, 0.55);
};

export const CHIP_VOICE: Voice = { strike, work, evolve };
