import { ACT_SECS } from '../render/beasts';
import { BADGER_DIGS, BADGER_HITS, BADGER_WORK, DIG_STROKE } from '../render/wild-badger';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Dirtlet's voice, and its stages' (the species is `snout`): a badger's,
 * a nose that is always going and a voice behind it that only gets bigger.
 * The Dirtlet snuffles and chitters, a quick run of high little clicks of
 * voice; the Tunnelclaw grunts, a short buzz through a nasal resonance with a
 * snuff of air before it; the Earthrend growls, low and rough, an octave of
 * rumble under it. Dug earth is dry: noise through a low band with grit in it
 * (short ticks over the scrape), not the wet sweep of clay; a stone knocked is
 * a few partials that die at once.
 *
 * Every cue lands where its picture does: the strikes on `BADGER_HITS`, the
 * snuffling, the digging on the strokes of `BADGER_DIGS` and `DIG_STROKE`, the
 * sniff in the hole and the stamp and scrape that mark the spot on
 * `BADGER_WORK`, the evolving knock on the flash at the middle of the act.
 * Nothing starts in under eighteen milliseconds, and layers that start
 * together are staggered, so nothing clicks.
 */

/** The shortest rise anything here is given. */
const RISE = 0.018;
/** A stone knocked: its partials, inharmonic and dying at once. */
const STONE = [[1, 0.6], [2.76, 0.22], [5.4, 0.1]] as const;

/** How a stage sounds: how far down its voice is, how big a body is behind it, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; weight: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.55, 0.3][s] * (0.95 + 0.1 * v), weight: [0.7, 0.85, 1][s], long: [1, 1.3, 1.75][s], s };
}

/** Noise through a filter through an envelope (`burst` in `./kit`), rising in a straight line from silence so it never clicks. */
function burst(ctx: BaseAudioContext, dest: AudioNode, at: number, b: Burst): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.type ?? 'bandpass';
  filter.frequency.setValueAtTime(Math.max(30, b.freq), at);
  if (b.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), at + b.dur);
  filter.Q.value = b.q ?? 1;
  const gain = ctx.createGain();
  const rise = Math.min(Math.max(RISE, b.attack ?? RISE), b.dur * 0.6);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(b.gain, at + rise);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + b.dur);
  src.connect(filter).connect(gain).connect(dest);
  src.start(at, (at * 7.31) % 0.9);
  src.stop(at + b.dur + 0.02);
}

/** An oscillator, or a stack of them, through an envelope (`ring` in `./kit`), rising in a straight line; a high partial dies first. */
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
 * A voiced sound: `type` sliding through the pitches of `f`, through a nasal resonance (`nasal`, a band) and a lowpass, under a
 * rise, a hold and a fall; a flutter of `vib` in its pitch and a burr in its loudness for the big ones.
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
    depth.gain.value = 0.35;
    shape.gain.value = 0.65;
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
  env.gain.linearRampToValueAtTime(o.gain, at + RISE);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE, o.dur * 0.35));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(shape).connect(nose).connect(lp).connect(env).connect(dest);
  for (const n of stops) {
    n.start(at);
    n.stop(at + o.dur + 0.05);
  }
}

/** A snuff of air through the nose: noise through a band in the nose's range, rising as it comes in. */
function snuff(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, dur = 0.06): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: dur * b.long, freq: 1000 * (0.55 + 0.45 * b.pitch), to: 1700 * (0.55 + 0.45 * b.pitch), q: 2.4, gain: 0.17 * k, attack: RISE });
}

/**
 * Its own call, by stage. The Dirtlet's a chitter: a snuff and a quick run of five high clicks of voice, each a little lower;
 * the Tunnelclaw's a grunt: two snuffs and a short nasal buzz falling; the Earthrend's a growl: a hard huff of air over a low
 * rough voice with a rumble an octave under it.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    snuff(ctx, dest, at, 0, 0.5 * k, 0.05);
    const f = 1100 * b.pitch;
    for (let q = 0; q < 5; q++) {
      const g = f * (1.1 - 0.06 * q) * (q % 2 ? 0.94 : 1);
      voiced(ctx, dest, at + 0.05 + q * 0.045, { f: [g, g * 1.25, g * 0.9], dur: 0.04, gain: 0.26 * k, type: 'triangle', nasal: 1800, cut: 4000 });
    }
    return;
  }
  if (b.s === 1) {
    snuff(ctx, dest, at, 1, 0.8 * k);
    snuff(ctx, dest, at + 0.08, 1, 0.6 * k);
    const f = 300 * b.pitch / 0.55;
    voiced(ctx, dest, at + 0.15, { f: [f * 0.6, f * 0.52, f * 0.44], dur: 0.2, gain: 0.32 * k, type: 'sawtooth', nasal: 760, cut: 1400, burr: 30 });
    return;
  }
  burst(ctx, dest, at, { dur: 0.2, freq: 620, to: 240, q: 0.9, gain: 0.3 * k, type: 'lowpass', attack: 0.025 });
  const f = 170 * b.pitch / 0.3;
  voiced(ctx, dest, at + 0.05, { f: [f * 0.5, f * 0.56, f * 0.42], dur: 0.46, gain: 0.34 * k, type: 'sawtooth', nasal: 380, cut: 640, vib: [7, 4], burr: 24 });
  ring(ctx, dest, at + 0.07, { freq: f * 0.25, to: f * 0.2, dur: 0.48, gain: 0.16 * k, type: 'sine', attack: 0.04 });
}

/** A claw swish through the air: a band of noise sweeping down, kept under a lowpass so it is a swish and not a hiss. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.1 * b.long, freq: 2100 - 500 * b.s, to: 650 - 150 * b.s, q: 1.4, gain: 0.16 * k, attack: 0.03 });
}

/** Earth hit: a low thump falling to fifty, and a dry crunch of soil a moment over it. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: 150 - 30 * b.s, to: 48, dur: 0.22 * b.long, gain: 0.5 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at + 0.008, { dur: 0.1 * b.long, freq: 900 - 200 * b.s, to: 300, q: 1.2, gain: 0.26 * k, attack: RISE });
}

/** A scrape of claws through dry earth: a low band of noise dragged down, with grit ticking over it. */
function scrape(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 700 * (0.55 + 0.45 * b.pitch / 0.95);
  burst(ctx, dest, at, { dur, freq: f * 1.6, to: f * 0.7, q: 1.6, gain: 0.3 * k, attack: 0.02 });
  for (let q = 0; q < 4; q++) burst(ctx, dest, at + 0.02 + (q * dur) / 5, { dur: 0.025, freq: (2600 + 500 * (q % 2)) * (0.7 + 0.3 * b.pitch), q: 4, gain: 0.09 * k });
}

/** Dirt landing: a soft patter, a short low band and a scatter of ticks. */
function patter(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.08 * b.long, freq: 700 - 150 * b.s, to: 300, q: 1.4, gain: 0.2 * k, attack: RISE });
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + 0.03 + q * 0.035, { dur: 0.022, freq: 1800 + 400 * q, q: 3, gain: 0.06 * k });
}

/** A stone knocked: a short ring of inharmonic partials, `f` its root. */
const knock = (ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.25): void =>
  ring(ctx, dest, at, { freq: f, dur, gain: 0.12 * k, type: 'sine', attack: RISE, partials: STONE });

/**
 * A strike. The Dirtlet chitters as it crouches, a little claw swish as it swipes, and a thud as its paw comes down; the
 * Tunnelclaw grunts as it rears, each of its two rakes a heavier swish and a thud, and a snap of its jaws after the second;
 * the Earthrend growls as it rears, its claws whoosh down, and the slam is a crack of the ground over a deep thud and a rumble
 * that rolls on, the stones on its back knocking as it shakes. The wind-up is always quieter than the hit.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.0, 1.0, 0.95][s]);
  const hits = BADGER_HITS[s].map((h) => at + h * ACT_SECS.strike);
  if (s === 0) {
    call(ctx, out, at + 0.03, 0, v, 0.5);
    swish(ctx, out, hits[0] - 0.07, 0, 1);
    thud(ctx, out, hits[0], 0, 0.85);
    return;
  }
  if (s === 1) {
    call(ctx, out, at, 1, v, 0.45);
    for (const h of hits) {
      swish(ctx, out, h - 0.08, 1, 1.1);
      thud(ctx, out, h, 1, 0.9);
    }
    // The snap of its jaws: two short hard clicks of tooth, a low knock under them.
    const snap = hits[1] + 0.04 * ACT_SECS.strike;
    burst(ctx, out, snap, { dur: 0.03, freq: 2200, q: 2, gain: 0.22 });
    ring(ctx, out, snap + 0.005, { freq: 220, to: 120, dur: 0.07, gain: 0.2, type: 'sine', attack: RISE });
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.5);
  swish(ctx, out, hits[0] - 0.1, 2, 1.2);
  thud(ctx, out, hits[0], 2, 1);
  // The crack of the ground: a short rough band, sharp at the front but kept under 2.6 kHz.
  burst(ctx, out, hits[0] + 0.004, { dur: 0.07, freq: 1400, to: 560, q: 0.9, gain: 0.32, attack: RISE });
  // And the rumble rolling on after it.
  burst(ctx, out, hits[0] + 0.02, { dur: 0.75, freq: 150, to: 55, q: 0.8, gain: 0.3, type: 'lowpass', attack: 0.04 });
  for (let q = 0; q < 3; q++) knock(ctx, out, hits[0] + 0.07 + q * 0.07, (300 + 70 * ((q * 2) % 3)) * (0.97 + 0.06 * v), 0.5);
};

/**
 * A go at its task, seeking: quick snuffles as its nose sweeps the ground; at each stroke of its claws a dry scrape as they
 * drag through the earth and a patter of dirt landing behind; three deep sniffs with its nose in the hole and a pleased little
 * call, the chitter, the grunt or the growl, as it finds what is there; and the mark, the thump of its paw stamped down
 * beside the hole and the scrape of its claws scoring the earth. Each stage lower and heavier.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.75, 2.0][s]), b = bodyOf(stage, v);
  const W = BADGER_WORK[s], T = ACT_SECS.work, n = BADGER_DIGS[s], each = ((W.dig - W.snuffle) * T) / n;
  for (let q = 0; q < 4; q++) snuff(ctx, out, at + 0.02 + (q * W.snuffle * T) / 4, s, 0.55, 0.04);
  for (let k = 0; k < n; k++) {
    const start = at + W.snuffle * T + k * each;
    const bite = start + DIG_STROKE.bite * each, fling = start + DIG_STROKE.fling * each;
    scrape(ctx, out, bite, s, (fling - bite) * 0.9, 1.2 * b.weight);
    patter(ctx, out, fling + 0.12, s, 0.7);
  }
  const sniff = at + (W.dig + 0.01) * T;
  for (let q = 0; q < 3; q++) snuff(ctx, out, sniff + q * 0.045 * b.long, s, 0.7, 0.04);
  call(ctx, out, at + (W.sniff - 0.01) * T, s, v, 0.3);
  // The stamp, and the scrape that scores the spot.
  const stamp = at + W.mark * T;
  ring(ctx, out, stamp, { freq: 130 - 25 * s, to: 55, dur: 0.14 * b.long, gain: 0.4, type: 'sine', attack: RISE });
  scrape(ctx, out, stamp + 0.02, s, 0.07 * T, 0.8);
};

/**
 * Evolving, a cue the length of the act: a low rumble of earth building, a rustle of leaves and a patter of crumbling soil
 * quickening over it, to a knock of stones at the flash in the middle -- a stone struck, a fifth under it, and a thump -- and
 * then its own call, the chitter, the grunt or the growl of what it has become. Each stage's knock is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.15, 1.2][s]);
  const flash = at + 0.5 * ACT_SECS.evolve;
  const key = [1, 0.8, 0.64][s];
  burst(ctx, out, at + 0.02, { dur: flash - at + 0.12, freq: 100, to: 180, q: 0.8, gain: 0.2, type: 'lowpass', attack: flash - at - 0.1 });
  // Leaves rustling and soil crumbling: short soft bursts, quickening and climbing to the flash.
  for (let q = 0; q < 14; q++) {
    const f = q / 13, when = at + 0.1 + (flash - at - 0.16) * (1 - (1 - f) ** 1.7);
    burst(ctx, out, when, { dur: 0.06, freq: (q % 2 ? 3000 : 900 + 700 * f) * key, q: q % 2 ? 0.8 : 2.5, gain: 0.06 + 0.1 * f, attack: RISE });
  }
  knock(ctx, out, flash, 520 * key, 1.4, 0.6);
  knock(ctx, out, flash + 0.012, 347 * key, 1.0, 0.5);
  ring(ctx, out, flash + 0.006, { freq: 120 * key, to: 55, dur: 0.3, gain: 0.3, type: 'sine', attack: RISE });
  call(ctx, out, at + 1.32, s, v, 0.55);
};

export const BADGER_VOICE: Voice = { strike, work, evolve };
