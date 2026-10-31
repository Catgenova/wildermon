/**
 * How a track is written down, and how a bar of it becomes notes.
 *
 * A track is sections of bars and a form that says which sections play in
 * what order. Each bar is a few short lines, one per hand or instrument, in
 * one small notation:
 *
 *   `D5:2`      D5 for two beats; a note with no `:` lasts a beat
 *   `G2+D3`     two notes struck together
 *   `r:1`       a beat's rest
 *   `@2.5`      jump to beat 2.5 of the bar
 *
 * A line with no `:` and no `@` in it is spread evenly over the bar, which is
 * how a left hand's broken chord is written: eight notes are eighths.
 *
 * Nothing is played the same way twice round. The form repeats for as long as
 * the track has the floor, and each time round (`round`) the touch and timing
 * are drawn afresh from a fixed sequence, the left hand turns every other
 * figure round, and the music box doubles a few downbeats it left alone the
 * time before. The sequence is seeded by the round and the bar, so a given
 * pass sounds the same every time it is played.
 */
import type { Struck } from './instruments';

export interface Bar {
  /** The chord, for the pad and the pedal. `|` splits it into equal parts of the bar. */
  c: string;
  /** Left hand. */
  l: string;
  /** Right hand. */
  r: string;
  /** Music box. */
  b?: string;
  /** Celesta. */
  e?: string;
  /** Harp. */
  h?: string;
}

/** One entry of a form: a section, and how this pass of it differs. */
export interface Pass {
  s: string;
  /** Bars of the section (from 0) whose right hand goes up an octave. */
  lift?: readonly number[];
  /** The left hand turns the second half of each figure round. */
  turn?: boolean;
  /** Touch, as a share of the written one. */
  dyn?: number;
}

export interface Track {
  id: string;
  /** What it is called where a player can read it. */
  name: string;
  bpm: number;
  /** Beats to a bar. */
  beats: number;
  sections: Readonly<Record<string, readonly Bar[]>>;
  form: readonly Pass[];
}

/** One note of a bar, in beats from the bar's start. */
export interface Hit {
  kind: Struck;
  m: number;
  beat: number;
  /** When it is let go, in beats from the bar's start: its own length or the end of its chord under the pedal, whichever is later. */
  off: number;
  vel: number;
}

/** A held chord of pad, in beats from the bar's start. */
export interface Hold {
  notes: number[];
  beat: number;
  beats: number;
}

const NAMES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `C4` = 60, `F#3` = 54, `Bb2` = 46. */
export function pitch(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const chord = (text: string): number[] => text.trim().split(/\s+/).filter(Boolean).map(pitch);

/** A line of the notation, as notes in beats. */
export function line(text: string, beats: number): Array<{ ms: number[]; beat: number; dur: number }> {
  const toks = text.trim().split(/\s+/).filter(Boolean);
  const even = !/[:@]/.test(text);
  const step = even && toks.length ? beats / toks.length : 1;
  const out: Array<{ ms: number[]; beat: number; dur: number }> = [];
  let at = 0;
  for (const t of toks) {
    if (t.startsWith('@')) {
      at = Number(t.slice(1));
      continue;
    }
    const [head, durText] = t.split(':');
    const dur = durText === undefined ? step : Number(durText);
    if (head !== 'r') out.push({ ms: head.split('+').map(pitch), beat: at, dur });
    at += dur;
  }
  return out;
}

/** A fixed sequence for one pass of one bar. */
function seq(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Bars in a track's form, end to end. */
export const formBars = (t: Track): number => t.form.reduce((n, p) => n + t.sections[p.s].length, 0);

/** The pass and bar of the form that the `n`th bar of it (from 0) falls in. */
export function locate(t: Track, n: number): { pass: number; bar: number } {
  let left = n % formBars(t);
  for (let pass = 0; pass < t.form.length; pass += 1) {
    const len = t.sections[t.form[pass].s].length;
    if (left < len) return { pass, bar: left };
    left -= len;
  }
  return { pass: 0, bar: 0 };
}

/**
 * Bar `bar` of pass `pass` of the form, on its `round`th time round: every
 * note struck in it and the pad under it.
 */
export function play(t: Track, pass: number, bar: number, round: number): { hits: Hit[]; holds: Hold[] } {
  const p = t.form[pass];
  const b = t.sections[p.s][bar];
  const rnd = seq(round * 7919 + pass * 104729 + bar * 31 + 1);
  const wob = (amt: number): number => (rnd() - 0.5) * 2 * amt;
  // Each eight bars swell to their sixth and fall away.
  const arch = 0.94 + 0.12 * Math.sin((Math.PI * ((bar % 8) + 0.5)) / 8);
  const dyn = (p.dyn ?? 1) * arch;

  const parts = b.c.split('|');
  const holds: Hold[] = parts.map((c, i) => ({ notes: chord(c), beat: (i * t.beats) / parts.length, beats: t.beats / parts.length }));
  /** The end of the chord sounding at `beat`: where the pedal comes up. */
  const pedal = (beat: number): number => {
    const k = Math.min(parts.length - 1, Math.floor((beat * parts.length) / t.beats + 1e-6));
    return ((k + 1) * t.beats) / parts.length;
  };

  const hits: Hit[] = [];
  const add = (kind: Struck, m: number, beat: number, dur: number, vel: number): void => {
    hits.push({ kind, m, beat: Math.max(0, beat + wob(0.02)), off: Math.max(beat + dur, pedal(beat)), vel: Math.max(0.05, Math.min(1, vel * dyn + wob(0.03))) });
  };

  const left = line(b.l, t.beats);
  // Turned round: the second half of the figure in reverse. A pass can ask for it; second time round, every other bar has it.
  const turned = p.turn || (round % 2 === 1 && bar % 2 === 1);
  left.forEach((n, k) => {
    const half = Math.ceil(left.length / 2);
    const src = turned && k >= half ? left[left.length - 1 - (k - half)] : n;
    for (const m of src.ms) add('piano', m, n.beat, n.dur, k === 0 ? 0.36 : 0.26);
  });

  const lifted = p.lift?.includes(bar) ? 12 : 0;
  const right = line(b.r, t.beats);
  for (const n of right) for (const m of n.ms) add('piano', m + lifted, n.beat, n.dur, n.beat === 0 ? 0.55 : 0.5);

  if (b.b) for (const n of line(b.b, t.beats)) for (const m of n.ms) add('musicbox', m, n.beat, n.dur, 0.4);
  else if (round % 2 === 1 && bar % 4 === 1 && right[0]?.beat === 0) {
    // Second time round, the box doubles a downbeat it left alone the first time.
    const m = right[0].ms[0] + lifted + 12;
    if (m <= 96) add('musicbox', m, 0, 1, 0.32);
  }
  if (b.e) for (const n of line(b.e, t.beats)) for (const m of n.ms) add('celesta', m, n.beat, n.dur, 0.45);
  if (b.h) line(b.h, t.beats).forEach((n, k) => n.ms.forEach((m) => add('harp', m, n.beat, n.dur, 0.28 + k * 0.012)));
  return { hits, holds };
}
