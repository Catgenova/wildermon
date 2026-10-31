/**
 * The soundtrack's instruments, built rather than recorded, the same as the
 * kit in `../kit.ts`.
 *
 * Four of them are struck or plucked — a felt piano, a music box, a celesta
 * and a harp — and each note of those is worked out once, sample by sample,
 * into a buffer: a sum of decaying sine waves, one per partial, with the
 * numbers below saying where each partial sits, how loud it starts and how
 * fast it dies. A buffer is then played as often as the score asks for it,
 * which costs one node per note rather than a stack of oscillators. The
 * fifth, the pad, is held rather than struck, so it is oscillators.
 *
 * Every partial is a damped resonator, `s[t+1] = 2r·cos(w)·s[t] - r²·s[t-1]`:
 * one multiply-add a sample, and it decays by itself.
 */

/** The pitch of a MIDI note number, A4 = 69 = 440 Hz. */
export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** A fixed sequence, so a note sounds the same each time it is made and a fault can be heard twice. */
function seq(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Adds one decaying partial into `out`: amplitude `amp`, frequency `hz`,
 * amplitude time constant `tau` seconds, starting phase `phase`.
 */
function partial(out: Float32Array, sr: number, hz: number, amp: number, tau: number, phase: number): void {
  if (hz <= 0 || hz >= sr * 0.47 || amp <= 0) return;
  const w = (2 * Math.PI * hz) / sr;
  const r = Math.exp(-1 / (tau * sr));
  const c = 2 * r * Math.cos(w);
  const r2 = r * r;
  let s0 = amp * Math.sin(phase);
  let s1 = amp * r * Math.sin(phase + w);
  // Past -80 dB the partial is not worth the multiply.
  const n = Math.min(out.length, Math.ceil(tau * sr * 9.2));
  if (n > 0) out[0] += s0;
  for (let i = 1; i < n; i += 1) {
    out[i] += s1;
    const s2 = c * s1 - r2 * s0;
    s0 = s1;
    s1 = s2;
  }
}

/**
 * Noise in a band with a decaying envelope: a hammer's felt, a pin on a tine.
 * The band is a one-pole low-pass at `top` less a one-pole low-pass at
 * `floor`, so nothing under `floor` thumps.
 */
function knock(out: Float32Array, sr: number, rnd: () => number, amp: number, tau: number, top: number, floor: number): void {
  const a = Math.exp((-2 * Math.PI * top) / sr);
  const b = Math.exp((-2 * Math.PI * floor) / sr);
  let y = 0;
  let low = 0;
  const n = Math.min(out.length, Math.ceil(tau * sr * 7));
  for (let i = 0; i < n; i += 1) {
    y = (1 - a) * (rnd() * 2 - 1) + a * y;
    low = (1 - b) * y + b * low;
    out[i] += (y - low) * amp * Math.exp(-i / (tau * sr));
  }
}

/** A raised-cosine rise over the first `secs`, and a fade over the last `tail`. */
function shape(out: Float32Array, sr: number, secs: number, tail = 0.4): void {
  const rise = Math.max(1, Math.round(secs * sr));
  for (let i = 0; i < Math.min(rise, out.length); i += 1) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / rise);
  const fall = Math.min(out.length, Math.round(tail * sr));
  for (let i = 0; i < fall; i += 1) out[out.length - 1 - i] *= i / fall;
}

/** Scales a note so its loudest sample is `peak`. */
function level(out: Float32Array, peak: number): Float32Array {
  let m = 0;
  for (let i = 0; i < out.length; i += 1) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) for (let i = 0; i < out.length; i += 1) out[i] *= peak / m;
  return out;
}

/** Seconds for a piano string at `m` to fall 60 dB once struck: about 14 s at A1, 4.4 s at middle C, 1.5 s at C6. */
export const pianoRing = (m: number): number => 14 * 2 ** (-((m - 33) / 12) * 0.75);

/**
 * One note of a felt piano: a felt strip between hammer and string, which
 * takes the edge off the strike and most of the top off the tone.
 *
 * - Partials are stretched: `f_n = n·f0·√(1 + B·n²)`, with B growing up the
 *   keyboard, which is where a piano's slight shimmer comes from.
 * - Two strings to a note, a fraction of a cent apart, so the sound beats
 *   slowly instead of standing still.
 * - Each partial dies in two stages: a quick drop after the strike and a long
 *   tail after it, the way a real string hands its energy to the soundboard.
 * - `vel` (0..1) sets how hard: harder is brighter and has a sharper start.
 */
export function feltPiano(sr: number, m: number, vel: number): Float32Array {
  vel = clamp01(vel);
  const f0 = midiHz(m);
  const t60 = pianoRing(m);
  const secs = Math.min(8, t60 * 0.9 + 0.3);
  const out = new Float32Array(Math.ceil(secs * sr));
  const rnd = seq(m * 7919 + Math.round(vel * 100));
  const B = 0.0001 * 2 ** (((m - 40) / 12) * 1.4);
  // The felt: a low-pass on the strike, lower for a softer touch, never below the second partial.
  const felt = Math.max(f0 * 2.2, 700 + 2600 * vel ** 1.3);
  const tilt = 1.65 - 0.55 * vel;
  const tauSlow = t60 / 6.91;
  const prompt = 0.55;
  for (let n = 1; n <= 28; n += 1) {
    const hz = n * f0 * Math.sqrt(1 + B * n * n);
    if (hz > Math.min(9500, sr * 0.45)) break;
    // The hammer strikes about an eighth of the way along, which thins every eighth partial.
    let a = (0.35 + 0.65 * Math.abs(Math.sin((Math.PI * n) / 8.3))) / n ** tilt;
    a /= 1 + (hz / felt) ** 2;
    // A bass string's fundamental is weak; most of what is heard is its second and third.
    if (n === 1) a *= 0.55 + 0.45 * clamp01((m - 28) / 20);
    const slow = tauSlow / (1 + 0.16 * (n - 1) + hz / 9000);
    const fast = slow / 7;
    const cents = 0.25 + 0.6 * rnd();
    const detune = 2 ** (cents / 1200);
    const ph = rnd() * Math.PI * 2;
    const ph2 = rnd() * Math.PI * 2;
    // First string, then the second slightly sharp and a little quieter so the beat never cancels out.
    partial(out, sr, hz, a * prompt, fast, ph);
    partial(out, sr, hz, a * (1 - prompt), slow, ph);
    partial(out, sr, hz * detune, a * prompt * 0.7, fast, ph2);
    partial(out, sr, hz * detune, a * (1 - prompt) * 0.7, slow * 1.08, ph2);
  }
  // The hammer itself, through the felt, and the knock of the action under it.
  knock(out, sr, rnd, 0.05 + 0.06 * vel, 0.011, 500 + 900 * vel, 160);
  partial(out, sr, 118 + 12 * rnd(), 0.008 + 0.006 * vel, 0.03, 0);
  shape(out, sr, 0.0035 + 0.007 * (1 - vel), Math.min(0.6, secs * 0.2));
  return level(out, 0.9);
}

/**
 * A music box: a steel tine plucked by a pin. A tine is a bar fixed at one
 * end, so its partials sit at 1, 6.27 and 17.5 times the note, far from any
 * scale; the high two die within a fraction of a second, which is the ting.
 * Each note is two tines a hair apart, as a comb doubles its tunes.
 */
export function musicBox(sr: number, m: number, vel: number): Float32Array {
  vel = clamp01(vel);
  const f0 = midiHz(m);
  const t60 = 3.4 * 2 ** (-((m - 84) / 12) * 0.5);
  const secs = Math.min(5, t60 + 0.2);
  const out = new Float32Array(Math.ceil(secs * sr));
  const rnd = seq(m * 104729 + 3);
  const tau = t60 / 6.91;
  partial(out, sr, f0, 1, tau, 0);
  partial(out, sr, f0 * 2 ** (1.6 / 1200), 0.45, tau * 0.9, rnd() * 6.28);
  partial(out, sr, f0 * 6.27, 0.3 * (0.5 + vel), 0.055, rnd() * 6.28);
  partial(out, sr, f0 * 17.55, 0.1 * (0.5 + vel), 0.011, rnd() * 6.28);
  knock(out, sr, rnd, 0.12 * (0.4 + vel), 0.0025, 9000, 2500);
  shape(out, sr, 0.0008, 0.3);
  return level(out, 0.85);
}

/**
 * A celesta: felt hammers on steel plates over wooden resonators. The
 * resonators bring the note forward and leave little else, so it is nearly
 * a pure tone with a faint bell above it and a soft thunk below.
 */
export function celesta(sr: number, m: number, vel: number): Float32Array {
  vel = clamp01(vel);
  const f0 = midiHz(m);
  const t60 = 2.8 * 2 ** (-((m - 72) / 12) * 0.55);
  const secs = Math.min(4.5, t60 + 0.2);
  const out = new Float32Array(Math.ceil(secs * sr));
  const rnd = seq(m * 15485863 + 11);
  const tau = t60 / 6.91;
  partial(out, sr, f0, 1, tau, 0);
  partial(out, sr, f0 * 2, 0.09 + 0.06 * vel, tau / 3, rnd() * 6.28);
  partial(out, sr, f0 * 2.76, 0.06 + 0.05 * vel, tau / 6, rnd() * 6.28);
  partial(out, sr, f0 * 5.4, 0.025 * (0.5 + vel), tau / 14, rnd() * 6.28);
  knock(out, sr, rnd, 0.05, 0.007, 900, 180);
  shape(out, sr, 0.0025, 0.3);
  return level(out, 0.85);
}

/**
 * A harp string, plucked by a finger about three tenths of the way along.
 * Gut and nylon are warm: harmonic partials falling away quickly above the
 * fourth, and the upper ones dying first.
 */
export function harp(sr: number, m: number, vel: number): Float32Array {
  vel = clamp01(vel);
  const f0 = midiHz(m);
  const t60 = 6 * 2 ** (-((m - 48) / 12) * 0.6);
  const secs = Math.min(6, t60 + 0.2);
  const out = new Float32Array(Math.ceil(secs * sr));
  const rnd = seq(m * 2654435 + 5);
  const tau = t60 / 6.91;
  const tilt = 1.5 - 0.4 * vel;
  for (let n = 1; n <= 16; n += 1) {
    const hz = n * f0 * Math.sqrt(1 + 0.00004 * n * n);
    if (hz > Math.min(8000, sr * 0.45)) break;
    const a = Math.abs(Math.sin(Math.PI * n * 0.29)) / n ** tilt;
    partial(out, sr, hz, a, tau / (1 + 0.45 * (n - 1)), rnd() * 6.28);
  }
  knock(out, sr, rnd, 0.012 + 0.012 * vel, 0.003, 2200, 400);
  shape(out, sr, 0.0015, 0.4);
  return level(out, 0.85);
}

export type Struck = 'piano' | 'musicbox' | 'celesta' | 'harp';

const MAKERS: Record<Struck, (sr: number, m: number, vel: number) => Float32Array> = {
  piano: feltPiano,
  musicbox: musicBox,
  celesta,
  harp,
};

/**
 * The notes made so far, per context. A touch is kept to five steps
 * (`TOUCHES`) so a phrase of thirty notes is a handful of buffers, not thirty.
 */
const MADE = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const TOUCHES = 5;

export function note(ctx: BaseAudioContext, kind: Struck, m: number, vel: number): AudioBuffer {
  let made = MADE.get(ctx);
  if (!made) MADE.set(ctx, (made = new Map()));
  const touch = Math.round(clamp01(vel) * (TOUCHES - 1)) / (TOUCHES - 1);
  const key = `${kind}:${m}:${touch}`;
  const had = made.get(key);
  if (had) return had;
  const data = MAKERS[kind](ctx.sampleRate, m, touch);
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  made.set(key, buf);
  return buf;
}

/**
 * The room every instrument plays into: about two and a half seconds of
 * decaying noise, darker as it dies, after a few early reflections. Made in
 * code once per context, the same each time.
 */
export function room(ctx: BaseAudioContext, t60 = 2.4): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.ceil((t60 + 0.3) * sr);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.round(0.012 * sr);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = new Float32Array(len);
    const rnd = seq(0x51ed + ch * 977);
    let y = 0;
    for (let i = pre; i < len; i += 1) {
      const t = (i - pre) / sr;
      // From 7 kHz at the start down to 1.2 kHz at the end: walls take the top first.
      const cut = 7000 * (1200 / 7000) ** Math.min(1, t / t60);
      const a = Math.exp((-2 * Math.PI * cut) / sr);
      y = (1 - a) * (rnd() * 2 - 1) + a * y;
      const onset = Math.min(1, t / 0.02);
      d[i] = y * Math.exp((-6.91 * t) / t60) * onset;
    }
    const taps = [0.017, 0.023, 0.031, 0.041, 0.053, 0.067];
    taps.forEach((s, k) => {
      const i = Math.round((s + (ch ? 0.0021 : 0)) * sr);
      if (i < len) d[i] += (k % 2 === ch ? 0.5 : -0.4) * (1 - k / taps.length);
    });
    buf.getChannelData(ch).set(d);
  }
  return buf;
}

/** How a struck note is played back: where it sits, how loud, and when its damper comes down. */
export interface Strike {
  gain: number;
  /** -1 left to 1 right. */
  pan?: number;
  /** When the key (or pedal) lets go, in context seconds; unset lets it ring out. */
  until?: number;
  /** The damper's time constant in seconds once `until` is reached. */
  damp?: number;
  /** A param to wobble the pitch with, in cents (the shared tape wow). */
  wow?: AudioNode;
}

export function strike(ctx: BaseAudioContext, dest: AudioNode, at: number, buf: AudioBuffer, s: Strike): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (s.wow) s.wow.connect(src.detune);
  const g = ctx.createGain();
  g.gain.setValueAtTime(s.gain, at);
  let end = at + buf.duration;
  if (s.until !== undefined && s.until < end) {
    const damp = s.damp ?? 0.08;
    g.gain.setTargetAtTime(0, s.until, damp);
    end = Math.min(end, s.until + damp * 8);
  }
  let tail: AudioNode = g;
  if (s.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, s.pan));
    g.connect(p);
    tail = p;
  }
  tail.connect(dest);
  src.connect(g);
  src.start(at);
  src.stop(end + 0.02);
}

/**
 * A held chord of soft pad: two triangle waves a few cents apart per note and
 * a sine an octave down, through a low-pass that breathes slowly. It arrives
 * over `rise` seconds and leaves over `fall`.
 */
export function pad(ctx: BaseAudioContext, dest: AudioNode, at: number, dur: number, notes: readonly number[], gain: number, rise = 2.2, fall = 3): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 820;
  lp.Q.value = 0.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 220;
  lfo.connect(depth).connect(lp.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.setTargetAtTime(gain, at, rise / 3);
  env.gain.setTargetAtTime(0, at + dur, fall / 4);
  lp.connect(env).connect(dest);
  const stop = at + dur + fall * 2;
  const voices: Array<[number, OscillatorType, number, number]> = [];
  for (const m of notes) {
    voices.push([midiHz(m), 'triangle', -7, 1], [midiHz(m), 'triangle', 7, 1], [midiHz(m - 12), 'sine', 0, 0.35]);
  }
  for (const [hz, type, cents, share] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = share / Math.sqrt(notes.length);
    o.connect(g).connect(lp);
    o.start(at);
    o.stop(stop);
  }
  lfo.start(at);
  lfo.stop(stop);
}

/**
 * The bus the soundtrack plays through: dry and a send into the room, a gentle
 * compressor to hold the two together, and one slow pitch wobble every struck
 * note shares (a few cents, like an old tape), so the whole band drifts as one.
 */
export interface Bus {
  /** Where notes go. */
  input: AudioNode;
  /** The wobble, for `Strike.wow`. */
  wow: AudioNode;
  /** The last node; connect it to the destination. */
  output: AudioNode;
  /** Stops the wobble's oscillators. */
  stop(at: number): void;
}

export function bus(ctx: BaseAudioContext, opts: { wet?: number; wowCents?: number } = {}): Bus {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.82;
  const verb = ctx.createConvolver();
  verb.buffer = room(ctx);
  const wet = ctx.createGain();
  wet.gain.value = opts.wet ?? 0.42;
  const warm = ctx.createBiquadFilter();
  warm.type = 'highshelf';
  warm.frequency.value = 5200;
  warm.gain.value = -4;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 2.4;
  comp.attack.value = 0.025;
  comp.release.value = 0.35;
  input.connect(dry).connect(warm);
  input.connect(verb).connect(wet).connect(warm);
  warm.connect(comp);
  const slow = ctx.createOscillator();
  slow.frequency.value = 0.21;
  const quick = ctx.createOscillator();
  quick.frequency.value = 0.83;
  const wow = ctx.createGain();
  wow.gain.value = opts.wowCents ?? 3;
  const quickShare = ctx.createGain();
  quickShare.gain.value = 0.3;
  slow.connect(wow);
  quick.connect(quickShare).connect(wow);
  slow.start();
  quick.start();
  return {
    input,
    wow,
    output: comp,
    stop: (at) => {
      slow.stop(at);
      quick.stop(at);
    },
  };
}
