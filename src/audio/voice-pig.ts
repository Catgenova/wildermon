import { ACT_SECS } from '../render/beasts';
import { PIG_STRIKE, PIG_WORK } from '../render/wild-pig';
import { noiseBuffer, type Burst, type Ring } from './kit';
import type { Voice } from './voices';

/**
 * The Pigroot's voice, and its stages' (the species is `seavic`): a pig's call -- the Pigroot's high squealing oink, the
 * Plowhog's fuller grunt, the Harvestusk's deep boar's grunt from its chest -- the soil it plows, the leaves and wheat it
 * wears, and the bell at its throat, which grows with it: a little jingle bell, a cow-bell, a big gold bell. A call is a buzz
 * (a sawtooth sliding in pitch) through the resonances of a snout, with a burr in it; a bigger stage's is lower, its snout's
 * resonances lower, drawn out longer, with an octave under it.
 *
 * Every cue lands where its picture does: the strike's blow on `PIG_STRIKE.hit`, the plowing's shoves and the seed going in
 * on `PIG_WORK`, the evolving bell on the flash at the middle of the act. Nothing starts in under fifteen milliseconds, so
 * nothing clicks; and no two loud things land on the same moment.
 */

/** The shortest rise anything here is given: under it, a sound starts with a click. */
const RISE = 0.016;
/** The smallest gain an exponential fall is taken to; zero is not allowed one. */
const FLOOR = 0.00012;

/**
 * The kit's two primitives (`kit.ts`), with the rise made a straight line up from silence rather than an exponential one: an
 * exponential rise from near nothing stays near nothing for most of its time and arrives all at once, a click at the end of
 * it, so a hit given sixteen milliseconds to arrive arrived in three or four.
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
  const gain = ctx.createGain(), rise = Math.min(b.attack ?? RISE, b.dur * 0.5);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(Math.max(FLOOR * 2, b.gain), at + rise);
  gain.gain.exponentialRampToValueAtTime(FLOOR, at + b.dur);
  src.connect(filter).connect(gain).connect(dest);
  src.start(at, Math.random() * 0.9);
  src.stop(at + b.dur + 0.02);
}

function ring(ctx: BaseAudioContext, dest: AudioNode, at: number, r: Ring): void {
  for (const [mul, share] of r.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = r.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, r.freq * mul), at);
    if (r.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, r.to * mul), at + r.dur);
    const gain = ctx.createGain(), rise = Math.min(r.attack ?? RISE, r.dur * 0.5);
    // A high partial dies before a low one, as in the kit.
    const life = r.dur / (1 + (mul - 1) * 0.55);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(Math.max(FLOOR * 2, r.gain * share), at + rise);
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + life);
    osc.connect(gain).connect(dest);
    osc.start(at);
    osc.stop(at + life + 0.02);
  }
}

/** How a stage sounds: how far down its call is and its snout's resonances, how long it draws a call out, how much octave is under it, and its bell. */
function bodyOf(stage: number, v: number): { pitch: number; snout: number; long: number; under: number; bell: number } {
  const s = Math.max(0, Math.min(2, stage));
  return { pitch: [1, 0.66, 0.44][s] * (0.95 + 0.1 * v), snout: [1, 0.84, 0.7][s], long: [1, 1.18, 1.4][s], under: [0, 0.4, 0.75][s], bell: s };
}

/** A cue's own level, over everything in it, so each is set against the others as a whole. */
function level(ctx: BaseAudioContext, dest: AudioNode, k: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

/** A voiced sound: a buzz through a snout's resonances under an envelope, with a burr (a flutter in its loudness) in it. */
interface Voiced {
  f: readonly number[];
  dur: number;
  gain: number;
  formants: ReadonlyArray<readonly [number, number, number]>;
  burr?: readonly [number, number];
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
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = o.burr[0];
    depth.gain.value = o.burr[1] * 0.5;
    flutter.gain.value = 1 - o.burr[1] * 0.5;
    lfo.connect(depth).connect(flutter.gain);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(o.gain, at + RISE);
  env.gain.setValueAtTime(o.gain, at + Math.max(RISE, o.dur * 0.45));
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

/**
 * Its call, `k` loud: the Pigroot's a squealing oink -- a bright buzz round 700 Hz that jumps up and comes down, with a short
 * nasal oink under its start; the Plowhog's a fuller grunt round 200 Hz with an octave under it; the Harvestusk's a deep grunt
 * round 120 Hz from its chest. `lift` is how far it goes up in the middle: a question, a cheer.
 */
function call(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number, lift = 1.2, low = 1): void {
  const b = bodyOf(stage, v);
  if (stage === 0) {
    const f = 700 * b.pitch;
    voiced(ctx, dest, at, { f: [f * 0.8, f * lift * 1.1, f * 1.02, f * 0.76], dur: 0.2, gain: 0.34 * k, formants: [[1050, 4, 1], [2400, 5, 0.45], [3600, 6, 0.15]], burr: [46, 0.3] });
    voiced(ctx, dest, at, { f: [300 * b.pitch, 340 * b.pitch, 260 * b.pitch], dur: 0.11, gain: 0.26 * k, formants: [[420, 3, 1], [1100, 5, 0.5]], burr: [32, 0.55] });
    return;
  }
  const f = 300 * b.pitch, dur = 0.2 * b.long;
  voiced(ctx, dest, at, { f: [f, f * lift, f * 0.8], dur, gain: 0.46 * k, formants: [[380 * b.snout, 3, 1], [980 * b.snout, 5, 0.55], [2300 * b.snout, 6, 0.18]], burr: [28 + 6 * v, 0.6] });
  voiced(ctx, dest, at, { f: [f / 2, (f * lift) / 2, (f * 0.8) / 2], dur: dur * 1.1, gain: 0.46 * k * b.under * low, formants: [[240 * b.snout, 2, 1], [640 * b.snout, 3, 0.45]], burr: [22, 0.5] });
}

/** A snort: air blown out hard through the nose, falling, with a little of its voice in it. */
function snort(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  burst(ctx, dest, at, { dur: 0.13 * b.long, freq: 1600 * b.snout, to: 520 * b.snout, q: 1.1, gain: 0.3 * k, attack: RISE });
  voiced(ctx, dest, at, { f: [230 * b.pitch, 170 * b.pitch], dur: 0.1 * b.long, gain: 0.18 * k, formants: [[420 * b.snout, 2.5, 1], [1100 * b.snout, 4, 0.4]], burr: [28, 0.7] });
}

/** The whoosh of the lunge: a wash of air rising as it comes, longer and lower the bigger it is. */
function whoosh(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, dur: number, k: number): void {
  burst(ctx, dest, at, { dur, freq: 500 - 80 * stage, to: 1800 - 300 * stage, q: 0.8, gain: 0.16 * k, attack: dur * 0.7 });
}

/** A blow landing: a thud dropping to 60 Hz, the short knock of skull or tusk on something, and the dull slap of it. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  const b = bodyOf(stage, v);
  ring(ctx, dest, at, { freq: 140 - 15 * stage, to: 58, dur: 0.18 * b.long, gain: (0.2 + 0.03 * stage) * k, type: 'sine', attack: RISE });
  ring(ctx, dest, at, { freq: 360 - 30 * stage + 20 * v, to: 260 - 20 * stage, dur: 0.08, gain: 0.35 * k, type: 'triangle', attack: RISE });
  burst(ctx, dest, at, { dur: 0.1, freq: 560 * b.snout, to: 260, q: 0.8, gain: 0.34 * k, attack: RISE });
  // On the tusked stages, the crack of tusk on something: a short bright band falling from 1400 to 700 Hz.
  if (stage > 0) burst(ctx, dest, at, { dur: 0.06, freq: 1400, to: 700, q: 1.6, gain: 0.3 * k, attack: 0.004 });
}

/** The Harvestusk's hooves stamping down and the dust bursting up: a heavy low thud and a hiss of dust after it. */
function stamp(ctx: BaseAudioContext, dest: AudioNode, at: number, k: number): void {
  ring(ctx, dest, at, { freq: 90, to: 46, dur: 0.24, gain: 0.3 * k, type: 'sine', attack: RISE });
  // The dust going up and settling after it, so the Harvestusk's blow is a stamp and a long fall of earth, not the Plowhog's knock.
  burst(ctx, dest, at + 0.02, { dur: 0.5, freq: 900, to: 300, q: 0.6, gain: 0.16 * k, attack: 0.05 });
  // And the weight of it going on into the ground: a low rumble rolling away under the dust.
  burst(ctx, dest, at + 0.03, { dur: 0.35, freq: 240, to: 90, q: 0.8, type: 'lowpass', gain: 0.2 * k, attack: 0.03 });
}

/**
 * The bell at its throat, struck `k` hard: the Pigroot's a little jingle bell, a quick bright ping and the rattle of its
 * pellet; the Plowhog's a cow-bell, a clank of two partials a fifth and a bit apart that dies quickly; the Harvestusk's a big
 * gold bell, a hum under a ringing note and its bright partials, that rings on.
 */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  if (stage === 0) {
    for (let q = 0; q < 3; q++) ring(ctx, dest, at + q * (0.045 + 0.01 * v), { freq: 2650 + 120 * v + 60 * q, dur: 0.2, gain: 0.07 * k * (1 - 0.25 * q), type: 'sine', attack: RISE, partials: [[1, 0.75], [2.32, 0.18]] });
    return;
  }
  if (stage === 1) {
    const f = 760 + 30 * v;
    ring(ctx, dest, at, { freq: f, dur: 0.36, gain: 0.085 * k, type: 'triangle', attack: RISE, partials: [[1, 0.55], [1.48, 0.45], [2.6, 0.15]] });
    burst(ctx, dest, at, { dur: 0.06, freq: f * 2, q: 3, gain: 0.03 * k, attack: RISE });
    return;
  }
  const f = 392 + 12 * v;
  ring(ctx, dest, at, { freq: f, dur: 1.1, gain: 0.09 * k, type: 'sine', attack: RISE, partials: [[0.5, 0.35], [1, 0.6], [1.19, 0.22], [1.5, 0.16], [2, 0.2], [2.67, 0.08]] });
}

/** The leaves and wheat it wears, shaken: dry ticks in a narrow high band over a soft hush, the wheat's a little lower and drier. */
function rustle(ctx: BaseAudioContext, dest: AudioNode, at: number, len: number, v: number, k: number, ticks = 7): void {
  burst(ctx, dest, at, { dur: len, freq: 3200 + v * 400, to: 2400, q: 0.9, gain: 0.05 * k, attack: Math.max(RISE, len * 0.35) });
  for (let q = 0; q < ticks; q++) {
    const when = at + len * ((q + 0.3 * Math.sin(q * 3.7 + v * 5)) / ticks);
    burst(ctx, dest, Math.max(at, when), { dur: 0.03 + 0.015 * (q % 3), freq: q % 3 ? 6200 + 400 * Math.sin(q * 2.1 + v) : 2600, q: 2.5, gain: 0.06 * k, attack: RISE });
  }
}

/** Soil turned over by its snout: a gritty crunch in a low band, and the clods breaking, scattered. */
function crunch(ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number, k: number): void {
  burst(ctx, dest, at, { dur: 0.11, freq: 720 - 120 * stage, to: 300 - 40 * stage, q: 0.9, gain: 0.22 * k, attack: RISE });
  for (let q = 0; q < 3; q++) burst(ctx, dest, at + 0.025 + q * 0.03, { dur: 0.03, freq: 1500 - 200 * stage + 300 * Math.sin(q + v), q: 2.2, gain: 0.08 * k, attack: RISE });
}

/**
 * A strike: a snort as it gathers itself and a whoosh as it throws itself forward, then where the blow lands, at the frame it
 * lands on, the thump of it -- and on the Harvestusk the stamp of its fore hooves with it -- the bell jingling a beat after,
 * and its call: the Pigroot's squeal, the Plowhog's grunt, the Harvestusk's deep grunt as it hooks its tusks up.
 */
const strike = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, [1.15, 0.95, 0.85][Math.max(0, Math.min(2, stage))]);
  const hit = at + PIG_STRIKE.hit * ACT_SECS.strike;
  snort(ctx, out, at + 0.03, stage, v, 0.5);
  whoosh(ctx, out, hit - 0.13, stage, 0.14, 1);
  thump(ctx, out, hit, stage, v, 1);
  if (stage === 2) stamp(ctx, out, hit + 0.012, 0.9);
  rustle(ctx, out, hit + 0.02, 0.28, v, 0.8);
  bell(ctx, out, hit + 0.05, stage, v, 1);
  // Its call over it, with less of the octave under it than it has calling, so the blow is not all chest.
  call(ctx, out, hit + 0.1, stage, v, 0.6, 1.3, 0.4);
};

/**
 * A go at its task, plowing: the snout going into the soil and a scrape along under the crunch of soil as it pushes on
 * through it, a heavier crunch at each shove and a tinkle of its bell with it; then as it noses the seed in, a soft pop, and
 * a little contented call; all inside the second a go takes, each where its picture is.
 */
const work = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, [2.3, 2.6, 2.45][Math.max(0, Math.min(2, stage))]);
  const T = (x: number): number => at + x * ACT_SECS.work, W = PIG_WORK;
  // The snout going in, and the scrape of the push.
  crunch(ctx, out, T(W.bite), stage, v, 0.8);
  burst(ctx, out, T(W.bite) + 0.04, { dur: (W.plow - W.bite) * ACT_SECS.work, freq: 380 - 50 * stage, to: 760 - 90 * stage, q: 1.4, gain: 0.05, attack: 0.12 });
  for (let q = 0; q < 6; q++) crunch(ctx, out, T(W.bite + 0.05 + q * 0.07), stage, v, 0.32 + 0.08 * (q % 2));
  // The shoves, with the bell.
  for (const s of W.shoves) {
    crunch(ctx, out, T(s), stage, v, 1.6);
    // The thunk of the shove itself: the weight of it driven into the ground.
    ring(ctx, out, T(s), { freq: 220 - 20 * stage, to: 120 - 15 * stage, dur: 0.08, gain: 0.15, type: 'sine', attack: 0.006 });
    bell(ctx, out, T(s) + 0.035, stage, v, 0.45);
  }
  rustle(ctx, out, T(W.shoves[0]), 0.4, v, 0.45, 5);
  // The seed nosed in: a soft pop, low and round.
  ring(ctx, out, T(W.poke), { freq: 240 - 20 * stage, to: 520 - 30 * stage, dur: 0.07, gain: 0.12, type: 'sine', attack: RISE });
  burst(ctx, out, T(W.poke) + 0.01, { dur: 0.05, freq: 1200, q: 1.5, gain: 0.05, attack: RISE });
  call(ctx, out, T(W.poke) + 0.07, stage, v, 0.2, 1.1);
};

/**
 * Evolving, a cue the length of the act: a papery burst as the leaves pop off it, then the rustle of leaves and wheat
 * building as they swirl up round it, to a bright ring of its bell at the flash at the middle of the act, a sparkle over it,
 * and after it a happy call in its new voice. Each stage's bell and call is lower than the last's.
 */
const evolve = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number): void => {
  const out = level(ctx, dest, 1.7);
  const flash = at + 0.5 * ACT_SECS.evolve;
  burst(ctx, out, at, { dur: 0.16, freq: 2500, to: 1500, q: 1.2, gain: 0.14, attack: RISE });
  rustle(ctx, out, at + 0.02, 0.24, v, 0.8);
  // The rustle building: louder and thicker towards the flash, over a wash of air rising to it.
  [0.2, 0.36, 0.52, 0.68, 0.78].forEach((when, q) => rustle(ctx, out, at + when, q === 4 ? 0.1 : 0.16, v + q * 0.2, 0.8 + 0.15 * q, 4 + q));
  // Swelling nearly into the flash, a breath of air rising under it (not a hiss: it stops short of the highs), and let fall
  // over the last sixtieth of a second or so before it, so the flash lands on a moment's hush and stands out.
  burst(ctx, out, at + 0.2, { dur: flash - at - 0.2, freq: 1400, to: 2400, q: 2, gain: 0.12, attack: flash - at - 0.2 - 0.07 });
  // And over the last of it, the bell's own note coming up, trembling six times a second, cut off by the flash.
  const key = [1, 0.84, 0.7][Math.max(0, Math.min(2, stage))];
  const hum = ctx.createOscillator(), trem = ctx.createOscillator(), depth = ctx.createGain(), swell = ctx.createGain(), wob = ctx.createGain();
  hum.frequency.value = 784 * key;
  trem.frequency.value = 6;
  depth.gain.value = 0.4;
  wob.gain.value = 0.6;
  trem.connect(depth).connect(wob.gain);
  swell.gain.setValueAtTime(0, flash - 0.4);
  swell.gain.linearRampToValueAtTime(0.12, flash - 0.07);
  swell.gain.linearRampToValueAtTime(0.05, flash - 0.01);
  swell.gain.linearRampToValueAtTime(0, flash + 0.03);
  hum.connect(wob).connect(swell).connect(out);
  for (const o of [hum, trem]) {
    o.start(flash - 0.4);
    o.stop(flash + 0.05);
  }
  // The bell at the flash: a big bright ring of the stage's own bell, the bigger stages' lower, with a shimmer over it.
  for (const [f, g, d] of [[1, 0.14, 1.0], [1.5, 0.07, 0.8], [2, 0.07, 0.7], [3, 0.02, 0.4]] as Array<[number, number, number]>) {
    ring(ctx, out, flash, { freq: 784 * key * f, dur: d, gain: g, type: 'sine', attack: RISE, partials: [[1, 0.8], [2.4, 0.2]] });
  }
  bell(ctx, out, flash + 0.03, stage, v, 1.2);
  ring(ctx, out, flash + 0.06, { freq: 3136 * key, dur: 0.35, gain: 0.015, type: 'sine', attack: RISE });
  call(ctx, out, flash + 0.3, stage, v, 0.6, 1.35);
  call(ctx, out, flash + 0.52, stage, v, 0.5, 1.5);
};

export const PIG_VOICE: Voice = { strike, work, evolve };
