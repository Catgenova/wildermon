import { ACT_SECS } from '../render/beasts';
import { CLAY_DIGS, CLAY_HITS, CLAY_WORK, DIG_STROKE, WORK_LAND } from '../render/wild-clay';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Mudlet's voice, and its stages' (the species is `noot`): a digger's
 * snuffling nose and a voice behind it, wet clay and the ring of fired
 * pottery. Every call is one family -- a voiced tone through a nasal
 * resonance, with a snuff of air through the nose before it -- and only
 * gets bigger: the Mudlet's a squeaky yip, the Clayburrow's a snuffling
 * grunt, the Terramole's a deep rumbling snort, each lower and longer than
 * the last. Clay is noise through a low band whose resonance sweeps as it
 * goes, which is what makes it wet; a pot is a short stack of partials that
 * belong to no scale and die fast, which is what makes it fired clay rather
 * than metal.
 *
 * Every cue lands where its picture does: the strikes on `CLAY_HITS`, the
 * digging on the strokes of `CLAY_DIGS` and `DIG_STROKE` and the scoop and
 * toss of `CLAY_WORK`, the evolving chime on the flash at the middle of the
 * act. Nothing starts in under eighteen milliseconds, and layers that start
 * together are staggered, so nothing clicks.
 */

/** The shortest rise anything here is given. */
const RISE = 0.018;
/** A fired pot struck: its partials, inharmonic and dying fast. */
const POT = [[1, 0.55], [2.32, 0.24], [4.25, 0.12], [6.63, 0.06]] as const;

/** How a stage sounds: how far down its voice is, how big a body is behind it, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; weight: number; long: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.56, 0.32][s] * (0.95 + 0.1 * v), weight: [0.7, 0.85, 1][s], long: [1, 1.35, 1.8][s], s };
}

/**
 * Noise through a filter through an envelope (`burst` in `./kit`), but rising in a straight line from silence: an exponential
 * rise from near nothing does all its rising in its last few milliseconds, which is a click by another name.
 */
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
    depth.gain.value = 0.3;
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
function snuff(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number, dur = 0.07): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: dur * b.long, freq: 900 * (0.6 + 0.4 * b.pitch), to: 1500 * (0.6 + 0.4 * b.pitch), q: 2.2, gain: 0.18 * k, attack: RISE });
}

/**
 * Its own call, by stage, one family: a snuff and then the voice. The Mudlet's a small squeaky yip, up and down; the
 * Clayburrow's a snuffling grunt, two snuffs and a nasal buzz; the Terramole's a deep rumbling snort, a hard snort of air over a
 * low rough voice with a growl of an octave under it.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  if (b.s === 0) {
    snuff(ctx, dest, at, 0, 0.6 * k, 0.05);
    const f = 760 * b.pitch / 0.95;
    voiced(ctx, dest, at + 0.04, { f: [f, f * 1.45, f * 1.1], dur: 0.13, gain: 0.34 * k, type: 'triangle', nasal: 1400, cut: 3200, vib: [30, 30] });
    return;
  }
  if (b.s === 1) {
    snuff(ctx, dest, at, 1, 0.8 * k, 0.06);
    snuff(ctx, dest, at + 0.09, 1, 0.7 * k, 0.06);
    const f = 400 * b.pitch / 0.56;
    voiced(ctx, dest, at + 0.17, { f: [f * 0.55, f * 0.48, f * 0.42], dur: 0.2, gain: 0.3 * k, type: 'sawtooth', nasal: 820, cut: 1500, burr: 28 });
    return;
  }
  burst(ctx, dest, at, { dur: 0.22, freq: 700, to: 260, q: 0.9, gain: 0.32 * k, type: 'lowpass', attack: 0.025 });
  const f = 200 * b.pitch / 0.32;
  voiced(ctx, dest, at + 0.06, { f: [f * 0.5, f * 0.46, f * 0.38], dur: 0.38, gain: 0.32 * k, type: 'sawtooth', nasal: 420, cut: 700, vib: [9, 4], burr: 19 });
  ring(ctx, dest, at + 0.08, { freq: f * 0.25, to: f * 0.2, dur: 0.4, gain: 0.16 * k, type: 'sine', attack: 0.03 });
}

/** A claw swish through the air: a band of noise sweeping down, kept under a lowpass so it is a swish and not a hiss. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.1 * b.long, freq: 2200 - 500 * b.s, to: 700 - 150 * b.s, q: 1.4, gain: 0.16 * k, attack: 0.03 });
}

/** Wet earth hit: a low thump falling to fifty, and the dull slap of clay a moment over it. */
function thud(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  ring(ctx, dest, at, { freq: 150 - 30 * b.s, to: 48, dur: 0.22 * b.long, gain: 0.5 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at + 0.008, { dur: 0.13 * b.long, freq: 520 - 120 * b.s, to: 140, q: 2.5, gain: 0.3 * k, type: 'lowpass', attack: RISE });
}

/** A squelch: wet clay giving under claws, a resonant band of noise swept up and back. */
function squelch(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  const f = 340 * (0.55 + 0.45 * b.pitch / 0.95);
  burst(ctx, dest, at, { dur: dur * 0.55, freq: f, to: f * 2.6, q: 5, gain: 0.32 * k, attack: 0.02 });
  burst(ctx, dest, at + dur * 0.45, { dur: dur * 0.55, freq: f * 2.2, to: f * 0.9, q: 4, gain: 0.24 * k, attack: 0.02 });
}

/** A soft slap of a clay lump landing: a short low band and a small thump under it. */
function slap(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void {
  const b = bodyOf(stage, 0.5);
  burst(ctx, dest, at, { dur: 0.09 * b.long, freq: 620 - 120 * b.s, to: 220, q: 1.6, gain: 0.3 * k, attack: RISE });
  ring(ctx, dest, at + 0.006, { freq: 190 - 40 * b.s, to: 90, dur: 0.1 * b.long, gain: 0.18 * k, type: 'sine', attack: RISE });
}

/** A fired pot struck: a short ring of inharmonic partials, `f` its root. */
const chime = (ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.5): void =>
  ring(ctx, dest, at, { freq: f, dur, gain: 0.12 * k, type: 'sine', attack: RISE, partials: POT });

/**
 * A strike. The Mudlet yips as it crouches, a little claw swish as it swipes, and a wet thud as its paw comes down on the
 * clay; the Clayburrow grunts as it rears, and each of its two rakes is a heavier swish and a thud; the Terramole snorts as it
 * rears, its claws whoosh down, and the slam is a crack of the ground over a deep thud and a rumble that rolls on, the pots on
 * its back clinking as it shakes. The wind-up is always quieter than the hit.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.0, 1.0, 0.95][s]);
  const hits = CLAY_HITS[s].map((h) => at + h * ACT_SECS.strike);
  if (s === 0) {
    call(ctx, out, at + 0.04, 0, v, 0.5);
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
    return;
  }
  call(ctx, out, at + 0.02, 2, v, 0.5);
  swish(ctx, out, hits[0] - 0.1, 2, 1.2);
  thud(ctx, out, hits[0], 2, 1);
  // The crack of the ground: a short rough band, sharp at the front but kept under 2.6 kHz.
  burst(ctx, out, hits[0] + 0.004, { dur: 0.07, freq: 1500, to: 600, q: 0.9, gain: 0.32, attack: RISE });
  // And the rumble rolling on after it.
  burst(ctx, out, hits[0] + 0.02, { dur: 0.75, freq: 160, to: 60, q: 0.8, gain: 0.3, type: 'lowpass', attack: 0.04 });
  for (let q = 0; q < 3; q++) chime(ctx, out, hits[0] + 0.07 + q * 0.06, (620 + 140 * ((q * 2) % 3)) * (0.97 + 0.06 * v), 0.4, 0.18);
};

/**
 * A go at its task, digging clay: at each stroke, as the claws go into the clay, a wet squelching scoop, and as the clay comes
 * off them a soft slap of it landing behind; then a contented snuffle with its snout in the hole, three snuffs and a low hum;
 * and the lump it lifts out, squelching free of the hole and landing aside with a slap. Each stage lower and heavier.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.8, 1.75, 2.0][s]), b = bodyOf(stage, v);
  const W = CLAY_WORK[s], T = ACT_SECS.work, n = CLAY_DIGS[s], each = (W.dig * T) / n;
  for (let k = 0; k < n; k++) {
    const bite = at + (k + DIG_STROKE.bite) * each, fling = at + (k + DIG_STROKE.fling) * each;
    squelch(ctx, out, bite, s, (fling - bite) * 0.9, 1.25 * b.weight);
    slap(ctx, out, fling + 0.12, s, 0.7);
  }
  // The snuffle in the hole: three snuffs and a contented hum, in its own voice.
  const sniff = at + (W.dig + 0.02) * T;
  for (let q = 0; q < 3; q++) snuff(ctx, out, sniff + q * 0.07 * b.long, s, 0.6, 0.05);
  const f = [520, 260, 130][s] * (0.95 + 0.1 * v);
  voiced(ctx, out, sniff + 0.2 * b.long, { f: [f, f * 1.08, f], dur: 0.16 * b.long, gain: 0.11, type: 'triangle', nasal: [1100, 650, 380][s], cut: [2400, 1400, 800][s], vib: [6, 4] });
  // The lump pulled out of the hole, and landing where it is tossed.
  squelch(ctx, out, at + W.scoop * T - 0.02, s, 0.12 * b.long, 0.7 * b.weight);
  slap(ctx, out, at + W.toss * T + WORK_LAND, s, 1.0);
};

/**
 * Evolving, a cue the length of the act: a low rumble of earth building, a crackle of clay drying and cracking quickening over
 * it, to a fired-pottery chime at the flash in the middle -- a struck pot ringing, a fifth under it, and a thump -- and then its
 * own call, the yip, the grunt or the snort of what it has become. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.15, 1.2][s]);
  const flash = at + 0.5 * ACT_SECS.evolve;
  const key = [1, 0.8, 0.64][s];
  // The rumble building to the flash.
  burst(ctx, out, at + 0.02, { dur: flash - at + 0.12, freq: 110, to: 190, q: 0.8, gain: 0.2, type: 'lowpass', attack: flash - at - 0.1 });
  // Clay crackling as it bakes: short dull ticks, quickening and climbing to the flash.
  for (let q = 0; q < 14; q++) {
    const f = q / 13, when = at + 0.1 + (flash - at - 0.16) * (1 - (1 - f) ** 1.7);
    burst(ctx, out, when, { dur: 0.04, freq: (700 + 900 * f) * key * (1 + 0.05 * Math.sin(q * 2.3)), q: 3, gain: 0.08 + 0.12 * f, attack: RISE });
  }
  // The chime at the flash: a pot ringing long, a fifth under it, a thump of clay.
  chime(ctx, out, flash, 784 * key, 1.4, 1.2);
  chime(ctx, out, flash + 0.012, 523 * key, 0.9, 1.0);
  ring(ctx, out, flash + 0.006, { freq: 130 * key, to: 60, dur: 0.3, gain: 0.3, type: 'sine', attack: RISE });
  call(ctx, out, at + 1.32, s, v, 0.55);
};

export const CLAY_VOICE: Voice = { strike, work, evolve };
