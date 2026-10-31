import type { Track } from '../score';

/**
 * Ember Leaves: the first autumn day. F major, 48 BPM, 3/4. A (16) in F, B
 * (24) in A dorian whose last eight bars turn back toward F through Dm and
 * Gm, A again with its middle lifted an octave and the left hand turned, and
 * an eight-bar turnaround that ends on C9 suspended, which leads back into
 * the first bar.
 *
 * Entry chord (bar 1): F add9 (F3 A3 C4 G4).
 * Exit chord (last bar): C9 sus4 (C3 F3 G3 Bb3 D4).
 */
export const EMBER_LEAVES: Track = {
  id: 'emberleaves',
  name: 'Ember Leaves',
  bpm: 48,
  beats: 3,
  sections: {
    A: [
      { c: 'F3 A3 C4 G4', l: 'F2 C3 A3 C4 G3 C3', r: 'F5:1.5 E5:0.5 C5:1' },
      { c: 'E3 G3 C4 D4', l: 'E2 C3 G3 C4 G3 C3', r: 'D5:1.5 C5:0.5 G4:1' },
      { c: 'D3 F3 A3 C4', l: 'D2 A2 F3 C4 F3 A2', r: 'A4:1 C5:1 F5:1', b: '@2 F6:1' },
      { c: 'C3 E3 G3 A3', l: 'C3 G3 A3 E4 A3 G3', r: 'E5:2 D5:0.5 C5:0.5' },
      { c: 'Bb2 D3 F3 A3', l: 'Bb2 F3 A3 D4 A3 F3', r: 'D5:1.5 C5:0.5 A4:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:1 D5:1 C5:1' },
      { c: 'G2 Bb2 D3 F3 | C3 F3 G3 Bb3', l: 'G2 D3 Bb3 C3 F3 Bb3', r: 'Bb4:1.5 A4:0.5 G4:1' },
      { c: 'C3 F3 G3 Bb3 | C3 E3 G3 Bb3', l: 'C3 G3 F4 E4 Bb3 G3', r: 'G4:3', e: '@1.5 G5:0.5 E5:0.5 C5:0.5' },
      { c: 'F3 A3 C4 G4', l: 'F2 C3 A3 C4 G3 C3', r: 'F5:1.5 E5:0.5 C5:1' },
      { c: 'E3 G3 C4 D4', l: 'E2 C3 G3 D4 G3 C3', r: 'D5:1.5 E5:0.5 G5:1' },
      { c: 'D3 F3 A3 C4 E4', l: 'D2 A2 F3 C4 E4 C4', r: 'A5:1.5 G5:0.5 F5:1', b: '@1 E6:2' },
      { c: 'C3 F3 A3 E4', l: 'C3 F3 A3 E4 A3 F3', r: 'E5:2 D5:0.5 C5:0.5' },
      { c: 'Bb2 D3 F3 A3', l: 'Bb2 F3 A3 D4 A3 F3', r: 'D5:1.5 E5:0.5 F5:1' },
      { c: 'Bb2 Db3 F3 G3', l: 'Bb2 F3 G3 Db4 G3 F3', r: 'F5:2 Db5:1' },
      { c: 'C3 F3 A3 C4 | C3 E3 G3 Bb3', l: 'C3 F3 A3 C3 E3 Bb3', r: 'C5:1.5 Bb4:0.5 G4:1' },
      { c: 'F3 A3 C4 G4', l: 'F2 C3 G3 A3 C4 A3', r: 'A4:3', b: '@1 C6:1 F6:1' },
    ],
    B: [
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:1.5 F#5:0.5 G5:1' },
      { c: 'F#3 A3 D4 E4', l: 'F#2 D3 A3 D4 A3 D3', r: 'A5:1.5 G5:0.5 A5:1', b: '@1 D6:2' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 B3 D4 A3 D3', r: 'G5:1.5 F#5:0.5 E5:1' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 D4 G3 B2', r: 'B4:1.5 C5:0.5 D5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 B3 G3', r: 'E5:1.5 F#5:0.5 G5:1' },
      { c: 'D3 F#3 A3 D4', l: 'D3 A3 D4 F#4 D4 A3', r: 'F#5:1.5 E5:0.5 D5:1' },
      { c: 'B2 D3 F#3 A3 | E3 G3 B3 D4', l: 'B2 F#3 D4 E2 B2 G3', r: 'D5:1.5 E5:0.5 B4:1' },
      { c: 'A2 C3 E3 B3', l: 'A2 E3 B3 C4 B3 E3', r: 'A4:3' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:1.5 F#5:0.5 G5:1' },
      { c: 'F#3 A3 D4 E4', l: 'F#2 D3 A3 D4 A3 D3', r: 'A5:1 B5:1 D6:1' },
      { c: 'G3 B3 D4 F#4 A4', l: 'G2 D3 A3 B3 F#4 B3', r: 'D6:1.5 B5:0.5 A5:1', b: '@1.5 B6:1.5' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 D4 G3 B2', r: 'G5:2 E5:1' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D5:1.5 E5:0.5 F#5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 B3 G3', r: 'E5:2 G5:1' },
      { c: 'D3 F#3 A3 D4', l: 'D3 A3 D4 F#4 D4 A3', r: 'F#5:1.5 G5:0.5 A5:1' },
      { c: 'E3 A3 B3 D4 | E3 G3 B3 D4', l: 'E2 B2 A3 G3 B3 D4', r: 'A5:1.5 G5:1.5', b: '@1.5 G6:1.5' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:2 C5:1' },
      { c: 'D3 F3 A3 C4', l: 'D3 A3 C4 F4 C4 A3', r: 'F5:2 D5:1' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 F3 D3', r: 'D5:1.5 C5:0.5 Bb4:1' },
      { c: 'Bb2 D3 F3 A3 C4', l: 'Bb2 F3 A3 D4 A3 F3', r: 'C5:2 D5:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:1.5 D5:0.5 C5:1' },
      { c: 'D3 F3 A3 C4 E4', l: 'D2 A2 F3 C4 E4 C4', r: 'F5:2 E5:1', b: '@1 A6:2' },
      { c: 'G2 Bb2 D3 F3 A3 | C3 F3 G3 Bb3', l: 'G2 D3 A3 C3 G3 Bb3', r: 'D5:1.5 C5:1.5' },
      {
        c: 'C3 F3 G3 Bb3 D4',
        l: 'C3 G3 Bb3 D4 Bb3 G3',
        r: 'Bb4:1.5 A4:0.5 G4:1',
        h: '@2 C3:0.1 F3:0.1 G3:0.1 Bb3:0.1 C4:0.1 D4:0.1 F4:0.1 G4:0.3',
      },
    ],
    T: [
      { c: 'Bb2 D3 F3 A3 C4', l: 'Bb2 F3 A3 C4 A3 F3', r: 'F5:2 E5:0.5 D5:0.5' },
      { c: 'Bb2 C3 E3 G3', l: 'Bb2 E3 G3 C4 G3 E3', r: 'C5:3', e: '@1 G5:1 E6:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 G3 E3', r: 'E5:1.5 D5:0.5 C5:1' },
      { c: 'D3 F3 A3 C4 E4', l: 'D3 A3 C4 E4 C4 A3', r: 'F5:2 E5:1' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 F3 D3', r: 'D5:1.5 C5:0.5 Bb4:1' },
      { c: 'A2 C3 F3 E4', l: 'A2 F3 C4 E4 C4 F3', r: 'C5:2 E5:1' },
      { c: 'Bb2 D3 F3 A3 | Bb2 Db3 F3 G3', l: 'Bb2 F3 A3 Db4 G3 F3', r: 'D5:1.5 Db5:1.5' },
      { c: 'C3 F3 G3 Bb3 D4', l: 'C3:1 G3:1 Bb3:1', r: 'D5:2 C5:1', b: '@1 D6:1 G6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [4, 5, 6], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
