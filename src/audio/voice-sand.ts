import { noiseBuffer } from './kit';
import type { Voice } from './voices';

/**
 * The Sandpip's voice, and its stages' (the species is `crawler`): a hermit
 * crab's chitter of shell clicking on shell -- a Sandpip's tiny and quick, a
 * Sandpincher's fuller and clacking, a Sandpinnacle's a slow deep clack over
 * a grind -- and the sand it digs and carries. Shell is a short ring that
 * belongs to no scale, sand is noise kept low and soft (never a hiss), and
 * a bigger stage is lower, slower and heavier in all of it.
 *
 * Every cue is laid against its picture (`../render/wild-sand`): a strike
 * lands 0.58 of the way through its 0.55 s; a go at its task drags its claws along
 * the ground from 0.13 s to 0.29 s, tosses the sand at 0.62 s and lands it in
 * the bowl at 0.75 s; and evolving flashes at the middle of its 1.8 s.
 */

/** When, in seconds from the start of a cue, the claw lands (a strike); the scoop, toss and landing of a go at its task; and the flash. */
const LANDS = 0.319;
const SCOOP = [0.13, 0.29] as const;
const TOSS = 0.62;
const POUR = 0.75;
const FLASH = 0.9;

/** Every attack this long at the least, risen in a straight line, so nothing in it is a click and every onset swells over 15 ms or so. */
const RISE = 0.018;
const FLOOR = 0.0001;

/** An envelope on `g`: up in a straight line to `gain` over `attack`, then dying away to nothing by `end`. */
function envelope(g: AudioParam, at: number, gain: number, attack: number, end: number): void {
  // Silent from the first sample, not only from `at`: a gain is one until told otherwise.
  g.value = 0;
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(gain, at + attack);
  g.exponentialRampToValueAtTime(FLOOR, Math.max(at + attack + 0.005, end));
}

/** A struck thing: sine partials over a root, sagging from `freq` to `to`, each higher one dying sooner. */
interface Tone { freq: number; to?: number; dur: number; gain: number; attack?: number; partials?: ReadonlyArray<readonly [number, number]> }
function tone(ctx: BaseAudioContext, dest: AudioNode, at: number, r: Tone): void {
  const attack = Math.max(RISE, r.attack ?? RISE);
  for (const [mul, share] of r.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(20, r.freq * mul), at);
    if (r.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, r.to * mul), at + r.dur);
    const g = ctx.createGain(), life = Math.max(attack + 0.01, r.dur / (1 + (mul - 1) * 0.5));
    envelope(g.gain, at, r.gain * share, attack, at + life);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.03);
  }
}

/** Noise through a filter through an envelope, the filter moving from `freq` to `to`. */
interface Hush { dur: number; freq: number; to?: number; q?: number; type?: BiquadFilterType; gain: number; attack?: number }
function noise(ctx: BaseAudioContext, dest: AudioNode, at: number, b: Hush): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = b.type ?? 'bandpass';
  f.frequency.setValueAtTime(Math.max(30, b.freq), at);
  if (b.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), at + b.dur);
  f.Q.value = b.q ?? 1;
  const g = ctx.createGain();
  envelope(g.gain, at, b.gain, Math.min(Math.max(RISE, b.attack ?? RISE), b.dur * 0.7), at + b.dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at, (at * 7.3) % 0.9);
  src.stop(at + b.dur + 0.03);
}

/** How a stage sounds: how far down its shell rings, how slow its chitter, how heavy its sand, and how much grind is in its voice. */
function bodyOf(stage: number, v: number): { pitch: number; slow: number; heavy: number; s: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.62, 0.4][s] * (0.95 + 0.1 * v), slow: [1, 1.35, 1.8][s], heavy: [0, 1, 2][s], s };
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A buzz through a throat's resonances under an envelope: the grind in a big one's voice. */
function grind(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, dur: number, gain: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f, at);
  osc.frequency.exponentialRampToValueAtTime(f * 0.85, at + dur);
  const lfo = ctx.createOscillator(), depth = ctx.createGain(), flutter = ctx.createGain();
  lfo.frequency.value = 23;
  depth.gain.value = 0.4;
  flutter.gain.value = 0.6;
  lfo.connect(depth).connect(flutter.gain);
  const band = ctx.createBiquadFilter();
  band.type = 'lowpass';
  band.frequency.value = 420;
  band.Q.value = 2;
  const env = ctx.createGain();
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.04);
  env.gain.setValueAtTime(gain, at + dur * 0.5);
  env.gain.exponentialRampToValueAtTime(FLOOR, at + dur);
  osc.connect(flutter).connect(band).connect(env).connect(dest);
  osc.start(at);
  lfo.start(at);
  osc.stop(at + dur + 0.05);
  lfo.stop(at + dur + 0.05);
}

/**
 * A click of shell on shell: a short hollow ring that is no note, with a
 * breath of low noise under it; `f` how high, `k` how loud.
 */
function click(ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.05): void {
  // Its overtones kept under 4.5 kHz: a click, not a tick.
  tone(ctx, dest, at, { freq: f, to: f * 0.94, dur, gain: 0.2 * k, attack: RISE, partials: ([[1, 0.65], [1.87, 0.25], [3.05, 0.1]] as const).filter(([m]) => f * m < 4500) });
  noise(ctx, dest, at + 0.004, { dur: dur * 0.8, freq: Math.min(2200, f * 1.1), q: 2.2, gain: 0.07 * k, attack: RISE });
}

/**
 * Its call, the voice the whole line shares: a run of shell clicks, a
 * chitter. A Sandpip's tiny and quick round 2 kHz; a Sandpincher's fuller,
 * slower clacks with a hollow knock under each; a Sandpinnacle's a few deep
 * clacks over a grind.
 */
function chitter(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, count = 5): void {
  const b = bodyOf(stage, v), gap = 0.042 * b.slow;
  for (let q = 0; q < count; q++) {
    const f = 1900 * b.pitch * (q % 2 ? 0.86 : 1) * (1 + 0.04 * Math.sin(q * 2.3 + v * 5));
    const when = at + q * gap * (1 + 0.15 * Math.sin(q * 1.7));
    click(ctx, dest, when, f, k * (1 - 0.35 * (q / count)), 0.045 + 0.02 * b.heavy);
    // The fuller ones' hollow knock under each clack: the shell's body.
    if (b.heavy) tone(ctx, dest, when + 0.003, { freq: 520 * b.pitch * 1.6, to: 380 * b.pitch * 1.6, dur: 0.07 + 0.03 * b.heavy, gain: 0.1 * k * b.heavy, attack: RISE });
  }
  if (b.heavy >= 2) grind(ctx, dest, at, 62 * (0.95 + 0.1 * v), gap * count + 0.12, 0.16 * k);
}

/** A claw through the air: a soft rising rush of low noise, longer and lower for a bigger claw. */
function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, pitch: number, k: number): void {
  // Lowpassed, so it is air moved and not a hiss.
  noise(ctx, dest, at, { dur: len, freq: 300 * pitch + 200, to: 1100 * pitch + 300, q: 1.1, gain: 0.16 * k, type: 'lowpass', attack: len * 0.8 });
}

/** Sand: low soft noise, moved slowly up or down, never bright -- what a scoop, a pour or a thump of it is made of. */
function sand(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, from: number, to: number, k: number, attack = 0.03): void {
  noise(ctx, dest, at, { dur, freq: from, to, q: 0.7, gain: k, type: 'lowpass', attack });
}

/**
 * The blow, by stage: a Sandpip's pinch, a sharp little snap of shell on
 * shell; a Sandpincher's big snap, lower and with a knock of its weight in
 * it; a Sandpinnacle's crush, a heavy crunch of shell into the ground with a
 * thump of sand thrown up and coming down.
 */
function blow(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void {
  const b = bodyOf(stage, v);
  // The snap: the two fingers meeting, a bright hard ring, then the knock of the claw's weight a breath after.
  tone(ctx, dest, at, { freq: 1700 * b.pitch + 60 * v, to: 1400 * b.pitch, dur: 0.07 + 0.03 * b.heavy, gain: 0.32, attack: RISE, partials: [[1, 0.6], [2.31, 0.28], [3.7, 0.12]] });
  tone(ctx, dest, at + 0.008, { freq: [260, 190, 140][b.s], to: [150, 110, 80][b.s], dur: [0.1, 0.18, 0.32][b.s], gain: [0.24, 0.34, 0.4][b.s], attack: RISE + 0.004 });
  noise(ctx, dest, at + 0.004, { dur: 0.06 + 0.04 * b.heavy, freq: 1500 * b.pitch + 300, to: 300, q: 0.7, gain: 0.18, type: 'lowpass', attack: RISE });
  if (b.heavy >= 2) {
    // The crush: shell crunching into the ground, a run of short low cracks; the sand thumping up and pattering back down.
    for (let q = 0; q < 5; q++) noise(ctx, dest, at + 0.012 + q * 0.022, { dur: 0.05, freq: 1100 - 120 * q, to: 380, q: 0.9, gain: 0.26 * (1 - 0.13 * q), type: 'lowpass', attack: RISE });
    // The crunch itself, in the middle of the range where it is heard, not under it.
    noise(ctx, dest, at + 0.006, { dur: 0.22, freq: 600, to: 300, q: 1.5, gain: 0.25, attack: RISE });
    sand(ctx, dest, at + 0.015, 0.36, 700, 220, 0.24, RISE + 0.01);
  }
  // Sand off the blow coming down: a soft patter, heavier for a bigger one.
  for (let q = 0; q < 3 + 2 * b.heavy; q++) sand(ctx, dest, at + 0.12 + q * 0.07 + 0.02 * Math.sin(q * 3 + v), 0.07, 900 - 150 * b.heavy, 400, 0.05 + 0.02 * b.heavy, RISE);
}

/**
 * A strike: a chitter as it gathers, the claw (or both) swishing through the
 * air, and the blow landing at `LANDS`, louder than all of it.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [1.4, 1.05, 1.02][b.s]);
  chitter(ctx, out, at + 0.02, stage, v, 0.45, 3);
  const len = 0.13 + 0.04 * b.heavy;
  swish(ctx, out, at + LANDS - len, len, b.pitch, 1 + 0.4 * b.heavy);
  blow(ctx, out, at + LANDS, stage, v);
};

/**
 * A go at its task: two soft scoops of sand as its claws drag along the
 * ground, a little rush as it tosses them up over its head, the sand pouring
 * into its bowl with a clink of shell, and a short contented chitter; lower,
 * slower and heavier at each stage.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const b = bodyOf(stage, v), out = level(ctx, dest, [3.4, 2.5, 2.0][b.s]);
  const low = [1, 0.7, 0.48][b.s];
  // The scoop: sand pushed along by both claws, a soft swell and fall, the second claw a breath after the first.
  for (const [q, off] of [[0, 0], [1, 0.03]] as const) {
    sand(ctx, out, at + SCOOP[0] + off, SCOOP[1] - SCOOP[0], 650 * low, 1000 * low, (b.s ? 0.2 + 0.05 * b.heavy : 0.13) - 0.03 * q, (SCOOP[1] - SCOOP[0]) * 0.45);
  }
  // The toss: a short rush up.
  swish(ctx, out, at + TOSS - 0.07, 0.09, b.pitch, 0.7);
  // The pour into the bowl: sand landing on sand, a soft run of little thumps, and a clink of shell as it hits the rim.
  // Sand pouring onto sand: noise between 600 Hz and 1.2 kHz, lower for a bigger one, which is what carries the pour.
  noise(ctx, out, at + POUR - 0.01, { dur: 0.3 + 0.06 * b.heavy, freq: 1200 * (0.75 + 0.25 * low), to: 600 * (0.8 + 0.2 * low), q: 0.9, gain: 0.2 + 0.04 * b.heavy, attack: RISE + 0.01 });
  for (let q = 0; q < 4; q++) noise(ctx, out, at + POUR + 0.02 + q * 0.05, { dur: 0.06, freq: 900 * (0.8 + 0.2 * low), q: 1.1, gain: 0.08 + 0.02 * b.heavy, attack: RISE });
  click(ctx, out, at + POUR + 0.03, 2000 * b.pitch, 0.5);
  if (b.heavy) tone(ctx, out, at + POUR + 0.01, { freq: 180 - 10 * b.heavy, to: 110 - 6 * b.heavy, dur: 0.12 + 0.04 * b.heavy, gain: 0.06 + 0.025 * b.heavy, attack: RISE + 0.005 });
  chitter(ctx, out, at + 0.93, stage, v, 0.32, 2 + (b.s === 0 ? 2 : 1));
};

/**
 * Evolving, a cue the length of the act: a burst of sand and a clatter of
 * shell as it bursts, then sand swirling and shells clattering faster and
 * faster up to the flash at its middle, where it rings out in a bright hollow
 * chime, a conch's -- a round low note with its odd overtones and a breath of
 * air in it, under a bright high one -- and then a chitter from its new body.
 * Each stage's chime is lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  dest = level(ctx, dest, 1.45);
  const b = bodyOf(stage, v), key = [1, 0.84, 0.7][b.s];
  // The burst.
  sand(ctx, dest, at, 0.2, 900, 300, 0.2, RISE);
  for (let q = 0; q < 6; q++) click(ctx, dest, at + 0.02 + q * 0.04 + 0.015 * Math.sin(q * 2.1), 1900 * key * (0.8 + 0.3 * ((q * 7) % 3) / 2), 0.35 * (1 - q / 8));
  // The swirl: low sand swelling up to the flash, and shell ticks quickening in it as the shells come in.
  sand(ctx, dest, at + 0.18, FLASH - 0.18, 300 * key, 1100 * key, 0.3, (FLASH - 0.18) * 0.85);
  for (let q = 0; q < 11; q++) {
    const u = q / 11, when = at + 0.28 + (FLASH - 0.32) * (1 - (1 - u) ** 1.7);
    click(ctx, dest, when, 1700 * key * (0.85 + 0.35 * u), 0.3 + 0.45 * u, 0.04);
  }
  // Three notes climbing into it, soft.
  [392, 494, 587].forEach((f, q) => tone(ctx, dest, at + 0.5 + q * 0.12, { freq: f * key, dur: 0.38, gain: 0.05, attack: 0.02, partials: [[1, 0.7], [3, 0.12]] }));
  // The flash: the conch.
  const c = 392 * key;
  tone(ctx, dest, at + FLASH, { freq: c, dur: 1.2, gain: 0.2, attack: 0.018, partials: [[1, 0.62], [3, 0.2], [5, 0.08], [7, 0.03]] });
  noise(ctx, dest, at + FLASH, { dur: 0.8, freq: c, q: 9, gain: 0.12, attack: 0.03 });
  tone(ctx, dest, at + FLASH + 0.012, { freq: c * 4, dur: 0.5, gain: 0.05, attack: 0.02, partials: [[1, 0.7], [1.5, 0.3]] });
  tone(ctx, dest, at + FLASH + 0.006, { freq: 92 - 16 * b.s, to: 60 - 10 * b.s, dur: 0.35, gain: 0.2, attack: 0.02 });
  chitter(ctx, dest, at + 1.3, stage, v, 0.5, b.s === 0 ? 5 : 4);
};

export const SAND_VOICE: Voice = { strike, work, evolve };
