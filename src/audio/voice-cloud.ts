import { ACT_SECS } from '../render/beasts';
import { CLOUD_HITS, CLOUD_WORK, SHAKE } from '../render/wild-cloud';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Cloudlet's voice, and its stages' (the species is `woola`): a sheep's
 * bleat, the knock of its horns, the soft whoomph of its cloud of a fleece,
 * and the tinkle of the crystals it wears. A bleat is a buzz with a quaver in
 * its loudness -- the "eh-eh-eh" of a sheep -- put through a mouth that opens
 * from a hummed "m" into an "aa" as it goes; the Cloudlet's is a lamb's, high
 * and thin, the Cloudram's fuller, and the Cloudborne's a deep warm ram's
 * call an octave and more under it, the same bleat slowed and lowered, with
 * an octave under that. A crystal is a struck bar, three partials that
 * belong to no scale (`ring`), so it reads as glass rather than as a note.
 *
 * Every cue lands where its picture does: the strike on its blow
 * (`CLOUD_HITS`), the munching on the bites of its grazing and the rustle on
 * its shake (`CLOUD_WORK`), the evolving chime on the flash in the middle of
 * the act. Nothing starts in under eighteen milliseconds, and every start is
 * an even rise rather than the kit's exponential one (`air`, `tone`), which
 * comes most of the way up in its last two: so nothing clicks.
 */

/** The shortest rise anything here is given: under it, a sound starts with a click. */
const RISE = 0.018;
/** A struck crystal's partials: a bar's, inharmonic. */
const CRYSTAL = [[1, 0.6], [2.76, 0.26], [5.4, 0.12]] as const;

/**
 * How a stage sounds: how far down its voice is, how far down the
 * resonances of its mouth are (a bigger head), how slow its quaver, how long
 * it draws a sound out, how much octave is under it, and how far down its
 * crystals and its horns ring.
 */
function bodyOf(stage: number, v: number): { pitch: number; mouth: number; quaver: number; long: number; under: number; key: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.64, 0.4][s] * (0.95 + 0.1 * v), mouth: [1, 0.86, 0.72][s], quaver: [24, 17, 12][s] + 3 * v, long: [1, 1.18, 1.4][s], under: [0, 0.3, 0.6][s], key: [1, 0.86, 0.74][s] };
}

/** The smallest gain a ramp is let fall to; an exponential ramp cannot reach nought. */
const FLOOR = 0.00012;

/** Noise through a filter, under an even rise and an exponential fall: the kit's `burst`, without its click of an onset. */
function air(ctx: BaseAudioContext, dest: AudioNode, at: number, b: Burst): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.type ?? 'bandpass';
  filter.frequency.setValueAtTime(Math.max(30, b.freq), at);
  if (b.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(30, b.to), at + b.dur);
  filter.Q.value = b.q ?? 1;
  const gain = ctx.createGain(), rise = Math.min(Math.max(RISE, b.attack ?? RISE), b.dur * 0.6);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(b.gain, at + rise);
  gain.gain.exponentialRampToValueAtTime(FLOOR, at + b.dur);
  src.connect(filter).connect(gain).connect(dest);
  src.start(at, Math.random() * 0.9);
  src.stop(at + b.dur + 0.02);
}

/** An oscillator, or a stack of them, under an even rise and an exponential fall: the kit's `ring`, without its click. */
function tone(ctx: BaseAudioContext, dest: AudioNode, at: number, r: Ring): void {
  for (const [mul, share] of r.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = r.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, r.freq * mul), at);
    if (r.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, r.to * mul), at + r.dur);
    // A high partial dies before a low one, as a struck thing's do.
    const life = r.dur / (1 + (mul - 1) * 0.55), rise = Math.min(Math.max(RISE, r.attack ?? RISE), life * 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(r.gain * share, at + rise);
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + life);
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
 * A voiced sound: a buzz through the points of `f` evenly, under a rise, a
 * hold and a fall, with a quaver in its loudness (`quaver`, how fast and how
 * deep), through resonances that glide from where they start to where they
 * end (`formants`: from, to, how narrow, how loud).
 */
function voiced(ctx: BaseAudioContext, dest: AudioNode, at: number, o: {
  f: readonly number[]; dur: number; gain: number; formants: ReadonlyArray<readonly [number, number, number, number]>; quaver?: readonly [number, number]; attack?: number;
}): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  o.f.forEach((f, i) => {
    const t = at + (o.dur * i) / Math.max(1, o.f.length - 1);
    if (i === 0) osc.frequency.setValueAtTime(f, t);
    else osc.frequency.exponentialRampToValueAtTime(f, t);
  });
  const shake = ctx.createGain();
  shake.gain.value = 1;
  if (o.quaver) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.quaver[0];
    depth.gain.value = o.quaver[1] * 0.5;
    shake.gain.value = 1 - o.quaver[1] * 0.5;
    lfo.connect(depth).connect(shake.gain);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const env = ctx.createGain(), rise = Math.max(RISE, o.attack ?? 0.018);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + rise);
  env.gain.setValueAtTime(o.gain, at + Math.max(rise, o.dur * 0.55));
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(shake);
  for (const [from, to, q, g] of o.formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + o.dur * 0.35);
    band.Q.value = q;
    const share = ctx.createGain();
    share.gain.value = g;
    shake.connect(band).connect(share).connect(env);
  }
  env.connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/**
 * A bleat: a lamb's at 560 Hz, rising quickly and holding and falling away,
 * quavering, its mouth opening from a hum into an "aa"; `len` draws it out,
 * `k` is how loud. A bigger stage's is lower, slower and longer, with an
 * octave under it, unless `under` is false.
 */
function bleat(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, len = 1, lift = 1.1, under = true): void {
  const b = bodyOf(stage, v), f = 560 * b.pitch, dur = 0.34 * b.long * len, m = b.mouth;
  const formants = [[420 * m, 820 * m, 4, 1], [1150 * m, 1500 * m, 6, 0.5], [2500 * m, 2700 * m, 8, 0.2]] as const;
  voiced(ctx, dest, at, { f: [f * 0.86, f * lift, f * 1.02, f * 0.88], dur, gain: 0.42 * k, formants, quaver: [b.quaver, 0.6] });
  if (under && b.under) {
    voiced(ctx, dest, at + 0.01, { f: [f * 0.43, f * lift * 0.5, f * 0.51, f * 0.44], dur: dur * 1.05, gain: 0.42 * k * b.under, formants: [[300 * m, 520 * m, 3, 1], [800 * m, 1000 * m, 4, 0.4]], quaver: [b.quaver, 0.5] });
  }
}

/**
 * A contented "mm": a short hum with its mouth shut, a bleat's buzz through
 * low nasal resonances, rising a little and settling; lower and slower on a
 * bigger stage, with the octave under it.
 */
function hum(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, most = 1): void {
  const b = bodyOf(stage, v), f = 560 * b.pitch * 0.9, dur = Math.min(0.26 * b.long, most), m = b.mouth;
  const formants = [[250 * m, 300 * m, 3, 1], [900 * m, 1000 * m, 5, 0.22], [2300 * m, 2400 * m, 7, 0.05]] as const;
  voiced(ctx, dest, at, { f: [f * 0.92, f * 1.03, f * 0.96, f * 0.9], dur, gain: 0.4 * k, formants, quaver: [b.quaver * 0.5, 0.3], attack: 0.03 });
  if (b.under) voiced(ctx, dest, at + 0.01, { f: [f * 0.46, f * 0.515, f * 0.48, f * 0.45], dur, gain: 0.4 * k * b.under, formants: [[220 * m, 260 * m, 3, 1]], quaver: [b.quaver * 0.5, 0.3], attack: 0.03 });
}

/** A short breath out through the nose: a huff, falling. */
const huff = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void => {
  const b = bodyOf(stage, v);
  air(ctx, dest, at, { dur: 0.14 * b.long, freq: (1700 + 200 * v) * b.mouth, to: 600 * b.mouth, q: 1.1, gain: 0.26 * k, attack: RISE });
};

/** The horns knocking on what they butt: a dull hollow knock of horn, a little higher on a smaller one, and the thump of the blow under it. */
function knock(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  tone(ctx, dest, at, { freq: (430 + 40 * v) * b.key, to: 330 * b.key, dur: 0.12, gain: 0.34 * k, type: 'triangle', attack: RISE, partials: [[1, 0.7], [2.42, 0.25], [4.1, 0.08]] });
  tone(ctx, dest, at, { freq: 150 * b.key, to: 70, dur: 0.2 + 0.05 * stage, gain: 0.32 * k, type: 'sine', attack: RISE });
  air(ctx, dest, at, { dur: 0.08, freq: 1300 * b.key, to: 500, q: 1.2, gain: 0.2 * k, attack: RISE });
}

/** The cloud of its fleece puffing out: a soft round whoomph of low air, swelling and falling away. */
const whoomph = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, k: number): void =>
  air(ctx, dest, at, { dur: 0.32 + 0.06 * stage, freq: 520 - 60 * stage, to: 160, q: 0.6, gain: 0.32 * k, type: 'lowpass', attack: 0.03 });

/** A crystal struck: a bar's ring, short and high, `f` its root. */
const clink = (ctx: BaseAudioContext, dest: AudioNode, at: number, f: number, k: number, dur = 0.3): void =>
  tone(ctx, dest, at, { freq: f, dur, gain: 0.1 * k, type: 'sine', attack: RISE, partials: CRYSTAL });

/** The crystals it wears, jostled: a few clinks close together, each a little apart in pitch. */
function tinkle(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, n: number, k: number, gap = 0.045): void {
  const b = bodyOf(stage, v);
  for (let q = 0; q < n; q++) clink(ctx, dest, at + q * gap * (1 + 0.3 * Math.sin(q * 2.3 + v * 4)), (2900 + 520 * ((q * 3 + 1) % 5)) * b.key, k * (1 - 0.12 * q), 0.22);
}

/**
 * A strike. The Cloudlet gives a small bleat as it crouches to hop; the
 * Cloudram a huff and a bleat as it rears; the Cloudborne a deep huff as it
 * draws back to charge. Then, where its horns land, the knock of horn, the
 * whoomph of its fleece puffing out and its crystals tinkling, the blow
 * louder than all that went before it; and the Cloudborne's slam has a low
 * call after it, and its crystals ringing on.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), out = level(ctx, dest, [1.1, 1.05, 1.0][s]);
  const hit = at + CLOUD_HITS[s] * ACT_SECS.strike;
  if (s === 0) bleat(ctx, out, at + 0.02, stage, v, 0.62, 0.5, 1.25);
  else if (s === 1) {
    huff(ctx, out, at + 0.02, stage, v, 1.0);
    bleat(ctx, out, at + 0.08, stage, v, 1.0, 0.55, 1.2);
  } else {
    huff(ctx, out, at + 0.03, stage, v, 1.4);
    bleat(ctx, out, at + 0.06, stage, v, 0.85, 0.45, 0.95, false);
  }
  knock(ctx, out, hit, stage, v, 1);
  whoomph(ctx, out, hit + 0.01, stage, 0.9 + 0.2 * s);
  tinkle(ctx, out, hit + 0.03, stage, v, 2 + s, 0.8);
  if (s === 2) {
    tone(ctx, out, hit + 0.02, { freq: 1240 * bodyOf(stage, v).key, dur: 0.8, gain: 0.05, type: 'sine', attack: RISE, partials: CRYSTAL });
    bleat(ctx, out, hit + 0.16, stage, v, 0.3, 0.7, 1.05);
  }
};

/**
 * A go at its task: a soft crunch of grass at each bite, with the faint pull
 * of it tearing; then as it shakes itself, the soft rustle of the fleece
 * going to and fro with the shake, lower on a bigger stage, and the crystals
 * it wears jingling faintly in it; and after the shake a contented "mm" in
 * its own voice. The Cloudborne's munching is slower and deeper.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const s = Math.max(0, Math.min(2, stage)), b = bodyOf(stage, v), out = level(ctx, dest, [2.7, 2.9, 2.9][s]);
  const secs = ACT_SECS.work;
  for (const [q, t] of CLOUD_WORK.bites.entries()) {
    const when = at + t * secs - 0.02;
    air(ctx, out, when, { dur: 0.06 + 0.01 * s, freq: (2000 - 300 * s) * (1 + 0.08 * Math.sin(q * 2.1 + v * 3)), q: 1.6, gain: 0.16, attack: RISE });
    air(ctx, out, when + 0.005, { dur: 0.08, freq: 340 * b.mouth, to: 200, q: 0.8, gain: 0.12, type: 'lowpass', attack: RISE });
    air(ctx, out, when + 0.03, { dur: 0.05, freq: 3400, q: 2.2, gain: 0.04, attack: RISE });
  }
  // The shake: the rustle swelling and falling with it, louder each way the fleece is flung, twice to each to and fro.
  const [s0, s1] = CLOUD_WORK.shake, start = at + s0 * secs, len = (s1 - s0) * secs;
  const rustle = ctx.createGain();
  rustle.gain.value = 0.5;
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = (SHAKE / secs / (2 * Math.PI)) * 2;
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(rustle.gain);
  lfo.start(start);
  lfo.stop(start + len + 0.1);
  // Soft, not hissing: nothing much over two and a half thousand.
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 2500;
  soft.Q.value = 0.5;
  rustle.connect(soft).connect(out);
  const band = [1700, 1300, 950][s];
  air(ctx, rustle, start, { dur: len, freq: band, to: band * 0.7, q: 0.55, gain: 0.34, attack: len * 0.4 });
  tinkle(ctx, out, start + len * 0.3, stage, v, 3, 0.35, 0.07);
  // Over before the go is, so a looping go does not run one into the next.
  const humAt = start + len + 0.02;
  hum(ctx, out, humAt, stage, v, [0.75, 0.45, 0.22][s], at + secs - 0.04 - humAt);
};

/**
 * Evolving, a cue the length of the act: a soft poof of cloud as it begins,
 * then an airy breeze swelling, and crystal chimes climbing and quickening
 * over it to a bright chime at the flash in the middle of it, with a warm
 * chord ringing on under that; and then the bleat of what it has become.
 * Each stage's chimes are lower than the last.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.75), b = bodyOf(stage, v), key = b.key;
  const flash = at + 0.5 * ACT_SECS.evolve;
  // The cloud billowing out of it as it begins.
  air(ctx, out, at, { dur: 0.3, freq: 700, to: 260, q: 0.6, gain: 0.18, type: 'lowpass', attack: 0.03 });
  // The breeze, swelling to the flash and dying away after it.
  air(ctx, out, at + 0.05, { dur: flash - at + 0.5, freq: 600, to: 2600, q: 0.7, gain: 0.09, attack: flash - at - 0.08 });
  air(ctx, out, at + 0.1, { dur: flash - at + 0.2, freq: 3200, to: 6000, q: 1.2, gain: 0.03, attack: flash - at - 0.15 });
  // The chimes, climbing a pentatonic scale and coming quicker toward the flash.
  const notes = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];
  notes.forEach((f, q) => {
    const u = q / (notes.length - 1), when = at + 0.18 + (flash - at - 0.24) * (1 - (1 - u) ** 1.7);
    tone(ctx, out, when, { freq: f * key, dur: 0.45, gain: 0.05 + 0.06 * u, type: 'sine', attack: RISE, partials: CRYSTAL });
  });
  // The flash: a bright bell, a sparkle over it, and a warm chord under it ringing on.
  tone(ctx, out, flash, { freq: 1568 * key, dur: 1.0, gain: 0.16, type: 'sine', attack: RISE, partials: [[1, 0.6], [2.76, 0.24], [5.4, 0.1], [1.5, 0.2]] });
  tone(ctx, out, flash + 0.02, { freq: 3136 * key, dur: 0.45, gain: 0.05, type: 'sine', attack: RISE });
  for (const f of [392, 494, 587]) tone(ctx, out, flash + 0.01, { freq: f * key, dur: 0.8, gain: 0.05, type: 'sine', attack: 0.02, partials: [[1, 0.8], [2, 0.2]] });
  tinkle(ctx, out, flash + 0.08, stage, v, 4, 0.5, 0.06);
  bleat(ctx, out, at + 1.28, stage, v, 0.55, 0.9, 1.15);
};

export const CLOUD_VOICE: Voice = { strike, work, evolve };
