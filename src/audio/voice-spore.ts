import { ACT_SECS } from '../render/beasts';
import { BERRY_FLIGHT, SPORE_HITS, SPORE_WORK } from '../render/wild-spore';
import { burst, ring } from './kit';
import type { Voice } from './voices';

/**
 * The Sporeling's voice, and its stages' (the species is `vola`): the
 * Sporeling's squeaky chirp, the Sporekin's chitter and the Sporelord's low
 * hum; the soft boing of a cap, the whoosh of a swung sprig and the patter of
 * berries landing, the knock of a wooden staff on the ground; the rustle and
 * snip of picking, and a herb dropped into wicker. A spore is a breath of
 * high soft noise, and a herb found a small bell.
 *
 * Every cue lands where its picture does: the strikes on `SPORE_HITS` (and
 * the berries where they come down, `BERRY_FLIGHT`), the picking on
 * `SPORE_WORK`, the evolving chime on the flash at the middle of the act. A
 * bigger stage is lower in all of it. Nothing starts in under fifteen
 * milliseconds, so nothing clicks.
 */

/** The shortest rise anything here is given: under it, a sound starts with a click. */
const RISE = 0.016;

/** How a stage sounds: how far down its voice is, how far down what it knocks and rustles, and how long it draws a sound out. */
function bodyOf(stage: number, v: number): { pitch: number; key: number; long: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.72, 0.5][s] * (0.95 + 0.1 * v), key: [1, 0.86, 0.72][s], long: [1, 1.15, 1.35][s] };
}

/** A cue's own level, over everything in it. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A pitched voice: `type` through a lowpass, its pitch through the points of `f` evenly, under a rise, a hold and a fall; a flutter of `vib` in it. */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: { f: readonly number[]; dur: number; gain: number; type: OscillatorType; cut: number; vib?: [number, number] }): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  if (o.vib) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.vib[1];
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cut;
  lp.Q.value = 0.8;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(o.gain, at + RISE);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE, o.dur * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(lp).connect(env).connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/* ---- its voices -------------------------------------------------------------------------- */

/** The Sporeling's chirp: a small squeaky rise and fall round 2 kHz, with a flutter in it. */
function chirp(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, up = 1.35): void {
  const f = 1900 + 200 * v;
  voiced(ctx, dest, at, { f: [f, f * up, f * 0.9], dur: 0.12, gain: 0.3 * k, type: 'triangle', cut: 6500, vib: [32, 90] });
}

/** The Sporekin's chitter: four quick little chirps, lower than the Sporeling's, alternately up and down. */
function chitter(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void {
  const f = 1250 + 120 * v;
  for (let q = 0; q < 4; q++) {
    const g = f * (q % 2 ? 1.12 : 0.96) * (1 - 0.03 * q);
    voiced(ctx, dest, at + q * 0.062, { f: [g * 0.92, g * 1.18, g], dur: 0.05, gain: 0.26 * k * (1 - 0.1 * q), type: 'triangle', cut: 4800, vib: [40, 50] });
  }
}

/** The Sporelord's hum: a low, closed-mouthed "hmm-mm" round 130 Hz, rising and settling, with a slow waver in it. */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number, len = 0.5): void {
  const f = 128 + 10 * v;
  voiced(ctx, dest, at, { f: [f * 0.94, f * 1.1, f * 1.04, f * 0.92], dur: len, gain: 0.34 * k, type: 'sawtooth', cut: 620, vib: [5, 3] });
  voiced(ctx, dest, at, { f: [f * 1.88, f * 2.2, f * 2.08, f * 1.84], dur: len, gain: 0.08 * k, type: 'sine', cut: 1200 });
}

/** Its own sound, by stage: the chirp, the chitter or the hum. */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  if (stage <= 0) chirp(ctx, dest, at, v, k);
  else if (stage === 1) chitter(ctx, dest, at, v, k);
  else hum(ctx, dest, at, v, k);
}

/* ---- what it does ------------------------------------------------------------------------- */

/** A puff of spores: a soft breath of noise, high and falling. */
const puff = (ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, k: number, dur = 0.22): void =>
  burst(ctx, dest, at, { dur, freq: 3200 * key, to: 1300 * key, q: 0.8, gain: 0.22 * k, attack: RISE + 0.01 });

/** The leaves it wears, or picks among, stirred: a scatter of tiny dry ticks in a narrow band over a soft hush. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, key: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: len, freq: 3400 * key + v * 300, to: 2400 * key, q: 0.9, gain: 0.07 * k, attack: len * 0.35 });
  for (let q = 0; q < 6; q++) {
    const when = at + len * ((q + 0.3 * Math.sin(q * 3.7 + v * 5)) / 6);
    burst(ctx, dest, Math.max(at, when), { dur: 0.03 + 0.01 * (q % 3), freq: (6000 + 500 * Math.sin(q * 2.1 + v)) * key, q: 2.5, gain: 0.07 * k, attack: RISE });
  }
}

/**
 * The cap's bonk: a soft round boing -- a sine dropping and wobbling back up
 * -- the dull pat of the cap on what it butts, and the puff of spores off it.
 */
function boing(ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, k: number): void {
  voiced(ctx, dest, at, { f: [460 * key, 230 * key, 300 * key, 270 * key], dur: 0.3, gain: 0.42 * k, type: 'sine', cut: 2000, vib: [16, 22] });
  ring(ctx, dest, at, { freq: 170 * key, to: 90 * key, dur: 0.12, gain: 0.3 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at, { dur: 0.1, freq: 900 * key, to: 300, q: 0.7, gain: 0.3 * k, type: 'lowpass', attack: RISE });
  puff(ctx, dest, at + 0.02, key, k, 0.26);
}

/** A sprig swung through the air: a band of noise sweeping up and out as it comes round, quick at its end. */
const whoosh = (ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, key: number, k: number): void =>
  burst(ctx, dest, at, { dur, freq: 500 * key, to: 2600 * key, q: 1.6, gain: 0.3 * k, attack: dur * 0.75 });

/** A berry landing: a tiny wet pop with a pitch to it, and a whisper of spores. */
function plink(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number): void {
  ring(ctx, dest, at, { freq: f, to: f * 0.7, dur: 0.07, gain: 0.26 * k, type: 'sine', attack: RISE });
  burst(ctx, dest, at, { dur: 0.04, freq: 2400, q: 2, gain: 0.12 * k, attack: RISE });
}

/** The staff on the ground: a woody knock -- a short note in a struck stick's uneven partials -- over a deep thud. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, k: number): void {
  ring(ctx, dest, at, { freq: 210 * key, dur: 0.24, gain: 0.34 * k, type: 'triangle', attack: RISE, partials: [[1, 0.6], [2.42, 0.28], [4.1, 0.12]] });
  burst(ctx, dest, at, { dur: 0.07, freq: 1100 * key, q: 2.2, gain: 0.3 * k, attack: RISE });
  ring(ctx, dest, at, { freq: 110 * key, to: 48, dur: 0.32, gain: 0.46 * k, type: 'sine', attack: RISE });
}

/** A herb found: a small high bell, soft. */
const found = (ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, k: number): void =>
  ring(ctx, dest, at, { freq: 2794 * key, dur: 0.3, gain: 0.07 * k, type: 'sine', attack: RISE, partials: [[1, 0.7], [2, 0.2], [3, 0.1]] });

/** A stalk snapped: a short bright snip and a tiny pitched tick. */
function snip(ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.045, freq: 4400 * key, q: 3, gain: 0.3 * k, attack: RISE });
  ring(ctx, dest, at, { freq: 1700 * key, to: 1200 * key, dur: 0.05, gain: 0.12 * k, type: 'triangle', attack: RISE });
}

/** A herb let fall into the basket: the wicker creaking under it, a run of small dry clicks, and the soft drop of it. */
function wicker(ctx: BaseAudioContext, dest: AudioNode, at: number, key: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.09, freq: 420 * key, to: 220, q: 0.8, gain: 0.26 * k, type: 'lowpass', attack: RISE });
  for (let q = 0; q < 6; q++) {
    burst(ctx, dest, at + 0.03 + q * (0.022 + 0.004 * Math.sin(q + v * 3)), { dur: 0.03, freq: (1500 + 260 * (q % 3)) * key, q: 4, gain: 0.12 * k * (1 - 0.1 * q), attack: RISE });
  }
}

/** The Sporeling stuffing its cheek: three soft munches, low and muffled. */
function munch(ctx: BaseAudioContext, dest: AudioNode, at: number, v: number, k: number): void {
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + q * (0.09 + 0.01 * v), { dur: 0.07, freq: 700, to: 380, q: 0.9, gain: 0.26 * k * (1 - 0.15 * q), type: 'lowpass', attack: RISE });
}

/* ---- the cues ---------------------------------------------------------------------------- */

/**
 * A strike. The Sporeling chirps as it crouches and bonks with its cap, a
 * soft boing and a puff of spores. The Sporekin chitters as it winds back, its
 * sprig whooshes round, and its berries come down in a patter of little pops.
 * The Sporelord hums as it raises its staff, knocks it down on the ground with
 * a deep woody thud, and the spores go up off it in a long whoosh.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), b = bodyOf(stage, v), out = level(ctx, dest, [0.8, 1.5, 0.95][s]);
  const hit = at + SPORE_HITS[s] * ACT_SECS.strike;
  if (s === 0) {
    chirp(ctx, out, at + 0.04, v, 0.55, 1.5);
    boing(ctx, out, hit, b.key, 1);
    return;
  }
  if (s === 1) {
    chitter(ctx, out, at + 0.02, v, 0.6);
    whoosh(ctx, out, hit - 0.14, 0.2, b.key, 1);
    rustle(ctx, out, hit, 0.12, b.key, v, 0.7);
    // The berries landing, each where its picture comes down (`strikeBurst`): spread a little either side of the flight.
    const land = BERRY_FLIGHT * ACT_SECS.strike;
    for (let q = 0; q < 5; q++) {
      const when = hit + land * (0.86 + 0.28 * ((q * 0.618) % 1));
      plink(ctx, out, when, (1500 - 140 * q) * b.key * (0.97 + 0.06 * v), 1 - 0.08 * q);
    }
    puff(ctx, out, hit + land, b.key, 0.6);
    return;
  }
  hum(ctx, out, at + 0.02, v, 0.55, 0.26);
  knock(ctx, out, hit, b.key, 1);
  puff(ctx, out, hit + 0.02, b.key, 1, 0.5);
  burst(ctx, out, hit + 0.04, { dur: 0.6, freq: 1800 * b.key, to: 4200 * b.key, q: 1.1, gain: 0.12, attack: 0.12 });
  // The pods on its staff and its cap rattling as it lands.
  for (let q = 0; q < 3; q++) burst(ctx, out, hit + 0.07 + q * 0.05, { dur: 0.035, freq: 1300 * b.key, q: 3.5, gain: 0.1, attack: RISE });
};

/**
 * A go at its task, botanizing: the leaves rustling as it stoops into the
 * undergrowth, a snip as it plucks what it has found with a small bell as it
 * finds it, and then -- the Sporeling -- three munches as it stuffs its
 * cheek and a pleased chirp; or, grown, the soft drop of the herb into its
 * basket and the creak of the wicker. All inside the second a go takes.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), b = bodyOf(stage, v), out = level(ctx, dest, [1.9, 2.5, 2.5][s]);
  const W = SPORE_WORK, go = ACT_SECS.work;
  rustle(ctx, out, at + 0.12 * go, (W.reach - 0.1) * go, b.key, v, 0.8);
  const pluck = at + W.pluck * go;
  snip(ctx, out, pluck, b.key, 1);
  found(ctx, out, pluck + 0.04, b.key, 1);
  rustle(ctx, out, pluck + 0.02, 0.14, b.key, v, 0.6);
  const drop = at + W.drop * go;
  if (s === 0) {
    munch(ctx, out, drop, v, 1);
    chirp(ctx, out, drop + 0.3, v, 0.35, 1.2);
  } else {
    // The herb lands in the basket a tenth of a second after it is let go (`workSpray`).
    wicker(ctx, out, drop + 0.1, b.key, v, 1);
  }
};

/**
 * Evolving, a cue the length of the act: a soft puff as the spores burst out
 * of it, an airy shimmer rising under a sparkle of tiny bells that quickens
 * and climbs, building to a soft chime at the flash in the middle of the act
 * with a chord under it; and then its own sound, the chirp, chitter or hum
 * of what it has become. Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, 1.25);
  const flash = at + 0.5 * ACT_SECS.evolve;
  puff(ctx, out, at, b.key, 1.2, 0.35);
  burst(ctx, out, at + 0.1, { dur: flash - at - 0.08, freq: 1600 * b.key, to: 6400 * b.key, q: 1.6, gain: 0.08, attack: flash - at - 0.25 });
  for (let q = 0; q < 14; q++) {
    const f = q / 13, when = at + 0.12 + (flash - at - 0.18) * (1 - (1 - f) ** 1.7);
    ring(ctx, out, when, { freq: (1500 + 2400 * f) * b.key * (1 + 0.05 * Math.sin(q * 2.3 + v)), dur: 0.12, gain: 0.04 + 0.06 * f, type: 'sine', attack: RISE });
  }
  // The chime at the flash: a soft bell, a fifth and a tenth under it.
  ring(ctx, out, flash, { freq: 1046 * b.key, dur: 1.1, gain: 0.2, type: 'sine', attack: RISE, partials: [[1, 0.6], [2, 0.25], [3, 0.1]] });
  for (const f of [523, 659, 784]) ring(ctx, out, flash, { freq: f * b.key, dur: 0.8, gain: 0.07, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  puff(ctx, out, flash + 0.01, b.key, 0.6, 0.3);
  call(ctx, out, at + 1.3, stage, v, [0.8, 0.8, 0.5][Math.max(0, Math.min(2, stage))]);
};

export const SPORE_VOICE: Voice = { strike, work, evolve };
