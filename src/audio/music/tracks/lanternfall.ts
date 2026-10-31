import type { Bar, Track } from '../score';

/**
 * Lanternfall: dusk on the island, every season. B♭ major, 6/8 at a
 * dotted-quarter pulse of 45 (135 eighths a minute). A (32), B (24), A again
 * with its sequence lifted an octave and the left hand turned, and an
 * eight-bar turnaround. The whole loop sits a little below full touch.
 *
 * Entry chord (bar 1): B♭ add9, `Bb2 D3 F3 C4`.
 * Exit chord (last bar): F9 suspended, `F2 C3 Eb3 G3 Bb3`, which leads back
 * into the first bar.
 */

/** Chords: the pad, and the left hand's broken chord in six eighths. */
const K = {
  Bb9: { c: 'Bb2 D3 F3 C4', l: 'Bb2 F3 C4 D4 C4 F3' },
  BbD: { c: 'D3 F3 Bb3 C4', l: 'D3 F3 Bb3 C4 Bb3 F3' },
  BbF: { c: 'F2 Bb2 D3 F3', l: 'F2 D3 Bb3 C4 Bb3 D3' },
  Bbm7: { c: 'Bb2 D3 F3 A3', l: 'Bb2 F3 A3 D4 A3 F3' },
  Gm7: { c: 'G2 D3 F3 Bb3', l: 'G2 D3 Bb3 D4 Bb3 D3' },
  Gm9: { c: 'G2 Bb2 D3 F3 A3', l: 'G2 D3 F3 A3 F3 D3' },
  Ebm7: { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 D4 G3 Bb2' },
  EbG: { c: 'G2 Bb2 Eb3 G3 D4', l: 'G2 Eb3 Bb3 D4 Bb3 Eb3' },
  EbLyd: { c: 'Eb3 G3 A3 D4', l: 'Eb2 Bb2 G3 A3 D4 A3' },
  Ebm6: { c: 'Eb3 Gb3 Bb3 C4', l: 'Eb2 Bb2 Gb3 C4 Gb3 Bb2' },
  Abm7: { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 G3 Eb3' },
  Cm7: { c: 'C3 Eb3 G3 Bb3', l: 'C3 G3 Bb3 Eb4 Bb3 G3' },
  Cm9: { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 D4 Eb4 D4 G3' },
  Dm7: { c: 'D3 F3 A3 C4', l: 'D3 A3 C4 F4 C4 A3' },
  F: { c: 'F2 A2 C3 F3', l: 'F2 C3 A3 C4 A3 C3' },
  F9: { c: 'F2 A2 Eb3 G3', l: 'F2 C3 G3 A3 Eb4 A3' },
  Fsus: { c: 'F2 Bb2 C3 Eb3 | F2 A2 C3 Eb3', l: 'F2 C3 Bb3 Eb4 A3 C3' },
  Cm7F7: { c: 'C3 Eb3 G3 Bb3 | F2 A2 C3 Eb3', l: 'C3 G3 Bb3 F2 Eb3 A3' },
  F9sus: { c: 'F2 C3 Eb3 G3 Bb3', l: 'F2 C3 G3 Bb3 Eb4 Bb3' },
} as const;

const at = (k: keyof typeof K, r: string, more: Partial<Bar> = {}): Bar => ({ ...K[k], r, ...more });

export const LANTERNFALL: Track = {
  id: 'lanternfall',
  name: 'Lanternfall',
  bpm: 135,
  beats: 6,
  sections: {
    A: [
      // a: the motif, to a half close on F.
      at('Bb9', 'F4:1 Bb4:1 C5:1 D5:3'),
      at('Gm7', 'G5:2 F5:1 D5:3'),
      at('Ebm7', 'C5:2 Bb4:1 G4:3'),
      at('Fsus', 'Bb4:3 A4:3'),
      at('BbD', 'F4:1 Bb4:1 C5:1 D5:3'),
      at('Cm7', 'Eb5:2 F5:1 G5:3'),
      at('Ebm7', 'G5:2 F5:1 Eb5:3', { b: '@3 G6:3' }),
      at('F', 'D5:2 C5:1 A4:3'),
      // a': the answer, to a full close.
      at('Bb9', 'F4:1 Bb4:1 C5:1 D5:3'),
      at('Gm7', 'G5:2 F5:1 D5:3'),
      at('Ebm7', 'C5:2 Eb5:1 G5:3'),
      at('Dm7', 'A5:2 G5:1 F5:3', { e: '@3 D6:3' }),
      at('Ebm7', 'G5:2 F5:1 Eb5:3'),
      at('Cm9', 'Eb5:2 D5:1 C5:3'),
      at('Fsus', 'Bb4:2 C5:1 A4:3'),
      at('Bb9', 'Bb4:6'),
      // b: the motif turned downward, in sequence.
      at('Gm7', 'D5:1 C5:1 Bb4:1 G4:3'),
      at('EbLyd', 'G4:2 A4:1 D5:3'),
      at('Cm9', 'Eb5:1 D5:1 C5:1 G4:3'),
      at('F', 'A4:2 C5:1 F5:3'),
      at('Ebm7', 'G5:2 F5:1 Eb5:1 D5:2'),
      at('Dm7', 'C5:2 D5:1 F5:3'),
      at('Cm9', 'Eb5:2 F5:1 G5:3'),
      at('Fsus', 'F5:2 Eb5:1 C5:3'),
      // a'': the motif again, through the borrowed minor iv, home.
      at('Bb9', 'F4:1 Bb4:1 C5:1 D5:3'),
      at('Gm7', 'G5:2 F5:1 D5:3'),
      at('Ebm7', 'C5:2 Bb4:1 G4:3'),
      at('Ebm6', 'C5:2 Bb4:1 Gb4:3'),
      at('BbD', 'F4:1 Bb4:1 D5:1 F5:3'),
      at('Cm9', 'G5:2 F5:1 D5:3'),
      at('Fsus', 'Eb5:2 C5:1 A4:3'),
      at('Bb9', 'Bb4:6', { b: '@2 D6:1 F6:1 Bb6:2' }),
    ],
    B: [
      at('Ebm7', 'G4:2 Bb4:1 Eb5:3'),
      at('Dm7', 'F5:2 D5:1 C5:3'),
      at('Cm7', 'Eb5:2 C5:1 G4:3'),
      at('BbD', 'Bb4:2 C5:1 D5:3'),
      at('EbG', 'Eb5:2 G5:1 Bb5:3'),
      at('F', 'A5:2 G5:1 F5:3'),
      at('Gm7', 'F5:2 D5:1 Bb4:3'),
      at('Fsus', 'C5:3 A4:3'),
      at('Ebm7', 'G4:2 Bb4:1 Eb5:3'),
      at('Dm7', 'F5:2 D5:1 C5:3'),
      at('Gm7', 'Bb4:2 D5:1 G5:3'),
      at('EbLyd', 'A5:2 G5:1 D5:3'),
      at('Cm9', 'Eb5:2 G5:1 Bb5:3', { b: '@3 G6:1.5 Bb6:1.5' }),
      at('Dm7', 'A5:3 F5:2 D5:1'),
      at('Gm7', 'Bb4:2 C5:1 D5:3'),
      at('Cm7F7', 'Eb5:2 C5:1 A4:3'),
      at('BbD', 'D5:2 C5:1 Bb4:3'),
      at('Ebm7', 'C5:2 D5:1 Eb5:3'),
      at('Abm7', 'G5:2 F5:1 Eb5:3'),
      at('BbF', 'D5:3 C5:2 Bb4:1'),
      at('Gm9', 'Bb4:3 D5:3'),
      at('Cm9', 'Eb5:3 D5:3'),
      at('F9sus', 'C5:2 Bb4:1 G4:3'),
      at('Fsus', 'Bb4:3 A4:3', { h: '@3 F3:0.25 A3:0.25 C4:0.25 Eb4:0.25 F4:0.25 A4:0.25 C5:1.5' }),
    ],
    T: [
      at('Ebm7', 'G5:3 F5:2 D5:1'),
      at('Ebm6', 'C5:3 Bb4:2 Gb4:1'),
      at('BbD', 'F4:1 Bb4:1 C5:1 D5:3'),
      at('Gm9', 'F5:3 D5:3', { b: '@3 D6:1.5 A6:1.5' }),
      at('Cm9', 'Eb5:3 D5:3'),
      at('F9', 'C5:3 A4:3'),
      at('Bbm7', 'Bb4:2 D5:1 F5:3'),
      at('F9sus', 'Eb5:3 C5:3', { l: 'F2 C3 G3 Bb3 C4 Eb4', e: '@3 G5:1.5 C6:1.5' }),
    ],
  },
  form: [
    { s: 'A', dyn: 0.94 },
    { s: 'B', dyn: 0.98 },
    { s: 'A', lift: [16, 17, 18, 19], turn: true, dyn: 0.9 },
    { s: 'T', dyn: 0.82 },
  ],
};
