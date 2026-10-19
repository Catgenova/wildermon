import { ACT_SECS } from '../render/beasts';
import { biteTimes, GNAW_GO, GNAW_HITS } from '../render/wild-gnaw';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sapgnaw's voice, and its stages' (the species is `bevere`): a gnawer's
 * chattering, teeth on wood and a tail slapped flat on wet ground. Every call
 * is one family -- quick voiced syllables through a nasal resonance, in a
 * chatter -- and only gets bigger: the Sapgnaw's a tiny chirpy squeak, the
 * Logchewer's a fuller chuffing chatter with a breath before each syllable,
 * the Timberlord's a deep rumbling grunt rolled into a bellow, each lower and
 * longer than the last. Wood is noise through a low band, gritty where teeth
 * scrape it and short and hard where it cracks, and a struck log is a short
 * stack of partials that belong to no scale, which is what makes it wood
 * rather than metal or clay.
 *
 * Every cue lands where its picture does: the strikes on `GNAW_HITS`, the
 * gnawing on each bite of `biteTimes`, the tug and the tail's slap of a go on
 * `GNAW_GO`, the evolving knock on the flash at the middle of the act. Nothing
 * rises in under seventeen milliseconds, layers that start together are
 * staggered, and every noise of wood is under a lowpass, so nothing clicks
 * and nothing hisses.
 */

/** The shortest rise anything here is given. */
const RISE = 0.021;
/** The rise of a hit's layers, all started together so they do not add up to a faster one. */
const HIT = 0.026;
/** A log struck: its partials, inharmonic and dying fast, the higher ones first. */
const LOG = [[1, 0.6], [2.71, 0.24], [5.15, 0.1]] as const;

/** How a stage sounds: how far down its voice is, how big a body is behind it, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; weight: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.6, 0.36][s] * (0.95 + 0.1 * v), weight: [0.75, 0.88, 1][s], long: [1, 1.3, 1.7][s], s };
}

/** Noise through a filter through an envelope, rising in a straight line from silence, and under a lowpass at `cut`. */
function burst(ctx: BaseAudioContext, dest: AudioNode, at: number, b: Burst & { cut?: number; grit?: number }): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.type ?? 'bandpass';
  filter.frequency.setValueAtTime(Math.max(30, b.freq), at);
  if (b.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), at + b.dur);
  filter.Q.value = b.q ?? 1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = b.cut ?? 3000;
  lp.Q.value = 0.6;
  const gain = ctx.createGain();
  const rise = Math.min(Math.max(RISE, b.attack ?? RISE), b.dur * 0.6);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(b.gain, at + rise);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + b.dur);
  const stops: AudioScheduledSourceNode[] = [src];
  let tail: AudioNode = gain;
  // Grit: the loudness shaken fast, which is teeth catching on the grain.
  if (b.grit) {
    const shake = ctx.createGain();
    shake.gain.value = 0.55;
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = 'triangle';
    lfo.frequency.value = b.grit;
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(shake.gain);
    gain.connect(shake);
    tail = shake;
    stops.push(lfo);
  }
  src.connect(filter).connect(lp).connect(gain);
  tail.connect(dest);
  src.start(at, (at * 7.31) % 0.9);
  for (const n of stops) {
    if (n !== src) n.start(at);
    n.stop(at + b.dur + 0.03);
  }
}

/** An oscillator, or a stack of them, through an envelope rising in a straight line; a high partial dies first. */
function ring(ctx: BaseAudioContext, dest: AudioNode, at: number, r: Ring): void {
  for (const [mul, share] of r.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = r.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, r.freq * mul), at);
    if (r.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, r.to * mul), at + r.dur);
    const gain = ctx.createGain();
    const life = r.dur / (1 + (mul - 1) * 0.55), rise = Math.min(Math.max(RISE, r.attack ?? RISE), life * 0.5);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(r.gain * share, at + rise);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + life);
    osc.connect(gain).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.02);
  }
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/**
 * A voiced syllable: `type` sliding through the pitches of `f`, through a nasal resonance and a lowpass, under a rise, a hold
 * and a fall; a flutter of `vib` in its pitch and a burr in its loudness for the big ones.
 */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; type: OscillatorType; nasal: number; cut: number; vib?: [number, number]; burr?: number }): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const stops: AudioScheduledSourceNode[] = [osc];
  if (o.vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.vib[1];
    lfo.connect(depth).connect(osc.frequency);
    stops.push(lfo);
  }
  const shape = ctx.createGain();
  shape.gain.value = 1;
  if (o.burr) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.burr;
    // Eased in after the rise, so the burr's first swell does not sharpen the onset.
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(0.3, at + Math.min(0.05, o.dur * 0.4));
    shape.gain.value = 0.7;
    lfo.connect(depth).connect(shape.gain);
    stops.push(lfo);
  }
  const nose = ctx.createBiquadFilter();
  nose.type = 'peaking';
  nose.frequency.value = o.nasal;
  nose.Q.value = 2.5;
  nose.gain.value = 8;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut;
  lp.Q.value = 0.7;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + RISE * 1.15);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE * 1.15, o.dur * 0.35));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(shape).connect(nose).connect(lp).connect(env).connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** A chuff of breath through the nose: noise through a low band, rising as it comes. */
function chuff(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, dur = 0.06): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: dur * b.long, freq: 1100 * (0.5 + 0.5 * b.pitch), to: 700 * (0.5 + 0.5 * b.pitch), q: 1.6, gain: 0.16 * k, attack: 0.02, cut: 2600 });
}

/**
 * Its own call, by stage, one family: a chatter of quick syllables. The Sapgnaw's three tiny chirpy squeaks, up and down; the
 * Logchewer's chuffing chatter, a breath before each of three fuller syllables; the Timberlord's deep rumbling grunt rolled into
 * a bellow, a rough low voice with a growl an octave under it.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    const f = 1050 * b.pitch / 0.95;
    [[1, 1.35, 1.1], [1.1, 1.5, 1.2], [0.95, 1.25, 0.9]].forEach((c, q) =>
      voiced(ctx, dest, at + q * 0.075, { f: c.map((x) => f * x), dur: 0.06, gain: (0.3 - 0.04 * q) * k, type: 'triangle', nasal: 1800, cut: 3400, vib: [34, 26] }));
    return;
  }
  if (b.s === 1) {
    const f = 520 * b.pitch / 0.6;
    for (let q = 0; q < 3; q++) {
      chuff(ctx, dest, at + q * 0.11, 1, 0.8 * k, 0.045);
      voiced(ctx, dest, at + q * 0.11 + 0.03, { f: [f * (1 + 0.06 * q), f * 1.2, f * 0.92], dur: 0.08, gain: (0.27 - 0.03 * q) * k, type: 'sawtooth', nasal: 1100, cut: 2200, burr: 32 });
    }
    return;
  }
  const f = 150 * b.pitch / 0.36;
  chuff(ctx, dest, at, 2, 0.9 * k, 0.09);
  voiced(ctx, dest, at + 0.05, { f: [f * 0.9, f * 1.08, f * 0.95], dur: 0.16, gain: 0.26 * k, type: 'sawtooth', nasal: 520, cut: 900, burr: 18 });
  voiced(ctx, dest, at + 0.2, { f: [f * 1.05, f * 1.2, f * 0.82], dur: 0.36, gain: 0.3 * k, type: 'sawtooth', nasal: 480, cut: 820, vib: [7, 4], burr: 16 });
  ring(ctx, dest, at + 0.22, { freq: f * 0.5, to: f * 0.42, dur: 0.38, gain: 0.14 * k, type: 'sine', attack: 0.03 });
}

/** A clack of its teeth closing: a short knock of enamel, high and hard but lowpassed, two incisors a hair apart. */
function clack(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 1500 * (0.45 + 0.55 * b.pitch);
  burst(ctx, dest, at, { dur: 0.07, freq: f, q: 5, gain: 0.34 * k, attack: 0.03, cut: 3200 });
  burst(ctx, dest, at + 0.004, { dur: 0.055, freq: f * 1.3, q: 6, gain: 0.2 * k, attack: HIT, cut: 3400 });
  ring(ctx, dest, at, { freq: f * 0.5, to: f * 0.42, dur: 0.08, gain: 0.16 * k, type: 'triangle', attack: HIT });
}

/** A wood crack: a short rough band falling, sharp at its front but kept under the lowpass, and a log's knock under it. */
function crack(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.08 * b.long, freq: 1300 * (0.6 + 0.4 * b.pitch), to: 520, q: 1.4, gain: 0.3 * k, attack: HIT, cut: 2600 });
  ring(ctx, dest, at, { freq: 330 * (0.55 + 0.45 * b.pitch), dur: 0.16 * b.long, gain: 0.16 * k, type: 'sine', attack: HIT, partials: LOG });
}

/** A gnaw: teeth scraping across the grain, a gritty band of noise shaken fast and swept down a little, lowpassed so it rasps rather than hisses. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 1250 * (0.4 + 0.6 * b.pitch);
  burst(ctx, dest, at, { dur, freq: f, to: f * 0.7, q: 2.2, gain: 0.3 * k, attack: 0.02, cut: 2400, grit: [62, 46, 34][b.s] });
}

/** A tail slapped flat on wet ground: a wet low thwack of noise, and a flat thump under it. */
function thwack(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.12 * b.long, freq: 900 * (0.55 + 0.45 * b.pitch), to: 260, q: 0.9, gain: 0.36 * k, attack: HIT, cut: 2200, type: 'lowpass' });
  burst(ctx, dest, at, { dur: 0.1 * b.long, freq: 520 * (0.6 + 0.4 * b.pitch), to: 380, q: 3.5, gain: 0.2 * k, attack: HIT, cut: 2000 });
  ring(ctx, dest, at, { freq: 150 * (0.6 + 0.4 * b.pitch), to: 60, dur: 0.16 * b.long, gain: 0.3 * k, type: 'sine', attack: HIT });
}

/** A heavy body landing: a low thump falling to forty, and the dull slap of paws over it. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: 130 - 25 * b.s, to: 42, dur: 0.24 * b.long, gain: 0.5 * k, type: 'sine', attack: HIT });
  burst(ctx, dest, at, { dur: 0.12 * b.long, freq: 480 - 100 * b.s, to: 140, q: 2, gain: 0.26 * k, type: 'lowpass', attack: HIT, cut: 1600 });
}

/** A trunk creaking as it starts to give: a slow rough tone gliding down through a narrow wooden band, catching as it goes. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 230 * (0.55 + 0.45 * b.pitch);
  voiced(ctx, dest, at, { f: [f, f * 0.86, f * 0.74], dur, gain: 0.16 * k, type: 'sawtooth', nasal: f * 3.2, cut: 1300, burr: 23 });
}

/** A swish of a paw or the tail through the air, a band of noise sweeping down, under a lowpass. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.1 * b.long, freq: 1800 - 450 * b.s, to: 600 - 140 * b.s, q: 1.3, gain: 0.13 * k, attack: 0.03, cut: 2600 });
}

/**
 * A strike. The Sapgnaw squeaks as it gathers itself and its teeth clack shut as it lunges, a chip of something cracking;
 * the Logchewer chatters as it rears, its teeth clack as it drops onto its bite, and its tail slaps down behind it, a wet flat
 * thwack; the Timberlord grunts as it rears, its paws whoosh down and the slam is a heavy thud with a crack of wood over it
 * and its tusks clacking, a rumble rolling on. The wind-up always quieter than the hit.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.4, 1.15, 0.69][s]);
  const hits = GNAW_HITS[s].map((h) => at + h * ACT_SECS.strike);
  if (s === 0) {
    call(ctx, out, at + 0.02, 0, v, 0.3);
    clack(ctx, out, hits[0], 0, 1.6);
    crack(ctx, out, hits[0], 0, 0.9);
    return;
  }
  if (s === 1) {
    call(ctx, out, at, 1, v, 0.42);
    clack(ctx, out, hits[0], 1, 1.4);
    crack(ctx, out, hits[0], 1, 0.55);
    swish(ctx, out, hits[1] - 0.09, 1, 0.8);
    thwack(ctx, out, hits[1], 1, 1.1);
    return;
  }
  call(ctx, out, at + 0.01, 2, v, 0.45);
  swish(ctx, out, hits[0] - 0.1, 2, 1.1);
  thud(ctx, out, hits[0], 2, 0.65);
  crack(ctx, out, hits[0], 2, 1.8);
  clack(ctx, out, hits[0], 2, 0.8);
  // A splintering chip crack, high enough to come through a small speaker.
  burst(ctx, out, hits[0], { dur: 0.1, freq: 1100, to: 800, q: 2.2, gain: 0.4, attack: HIT, cut: 2800 });
  burst(ctx, out, hits[0] + 0.03, { dur: 0.7, freq: 150, to: 55, q: 0.8, gain: 0.15, type: 'lowpass', attack: 0.04, cut: 600 });
};

/**
 * A go at its task, gnawing a trunk: at each bite a gritty scrape of its teeth across the grain as it drives in, the clack as
 * they close on the bark and a small crack of a chip coming away, a little chatter of chewing between; then the trunk creaking
 * as it tugs, a bigger crack as the tree gives, and the thwack of its tail slapped down. Each stage lower and heavier.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.7, 1.75, 1.85][s]), b = bodyOf(stage, v);
  const T = ACT_SECS.work, hits = biteTimes(s), each = ((GNAW_GO.to - GNAW_GO.from) / hits.length) * T;
  hits.forEach((h, q) => {
    const bite = at + h * T;
    scrape(ctx, out, bite - each * 0.3, s, each * 0.32, 0.9 * b.weight);
    clack(ctx, out, bite, s, 1.0);
    crack(ctx, out, bite, s, 0.6 + 0.1 * (q % 2));
    // The grind after the bite: a shorter scrape, softer.
    scrape(ctx, out, bite + 0.05, s, each * 0.35, 0.5 * b.weight);
  });
  creak(ctx, out, at + (GNAW_GO.to + 0.01) * T, s, (GNAW_GO.tug - GNAW_GO.to) * T, 1);
  // The tree giving: a loud crack and the low knock of the trunk under it.
  crack(ctx, out, at + GNAW_GO.tug * T, s, 1.3);
  ring(ctx, out, at + GNAW_GO.tug * T, { freq: 150 * (0.6 + 0.4 * b.pitch), to: 110 * (0.6 + 0.4 * b.pitch), dur: 0.3 * b.long, gain: 0.22, type: 'sine', attack: HIT, partials: LOG });
  thwack(ctx, out, at + GNAW_GO.slap * T, s, 0.55);
};

/**
 * Evolving, a cue the length of the act: a rustle of leaves and wood creaking, building and quickening, to a deep resonant
 * wooden knock at the flash in the middle -- a log struck and ringing, a fifth under it, a thump -- and then its own call, the
 * squeak, the chatter or the bellow of what it has become. Each stage's knock is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.15, 1.2][s]);
  const flash = at + 0.5 * ACT_SECS.evolve;
  const key = [1, 0.8, 0.64][s];
  // A rustle of leaves, in bursts quickening and swelling to the flash, kept under a lowpass.
  for (let q = 0; q < 12; q++) {
    const f = q / 11, when = at + 0.04 + (flash - at - 0.14) * (1 - (1 - f) ** 1.6);
    burst(ctx, out, when, { dur: 0.09 + 0.04 * f, freq: 1700 + 500 * Math.sin(q * 2.1), to: 1100, q: 0.9, gain: 0.07 + 0.13 * f, attack: 0.025, cut: 3200 });
  }
  // Wood creaking as its stakes and chips grow: two slow creaks, the second higher.
  creak(ctx, out, at + 0.16, s, 0.32, 0.8);
  creak(ctx, out, at + 0.5, s, 0.3, 1.0);
  // A low swell under it, building to the flash.
  burst(ctx, out, at + 0.02, { dur: flash - at + 0.1, freq: 120, to: 200, q: 0.8, gain: 0.16, type: 'lowpass', attack: flash - at - 0.1, cut: 600 });
  // The knock at the flash: a log ringing long, a fifth under it, a thump.
  ring(ctx, out, flash, { freq: 392 * key, dur: 1.1, gain: 0.2, type: 'sine', attack: RISE, partials: LOG });
  ring(ctx, out, flash + 0.012, { freq: 262 * key, dur: 0.9, gain: 0.15, type: 'sine', attack: RISE, partials: LOG });
  ring(ctx, out, flash + 0.006, { freq: 120 * key, to: 55, dur: 0.3, gain: 0.3, type: 'sine', attack: RISE });
  call(ctx, out, at + 1.3, s, v, 0.55);
};

export const GNAW_VOICE: Voice = { strike, work, evolve };
