import type { Track } from '../score';

/**
 * Petalwind: the second spring day, a slow waltz that takes turns with
 * Blossom. D major, 50 BPM, 3/4. A (16), B (16), A again with its second
 * phrase lifted an octave and the left hand turned, C (8: the tune at half
 * speed up high over harp arpeggios), and an eight-bar turnaround that walks
 * down to A7 suspended, which leads back into the first bar.
 *
 * Entry chord: D add9 (D3 F#3 A3 E4). Exit chord: A7sus4 (A2 D3 E3 G3).
 */
export const PETALWIND: Track = {
  id: 'petalwind',
  name: 'Petalwind',
  bpm: 50,
  beats: 3,
  sections: {
    A: [
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 E4 A3', r: 'A4:1 F#5:1.5 E5:0.5' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D5:2 C#5:0.5 D5:0.5' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 F#4 B3 D3', r: 'B4:1 G5:1.5 F#5:0.5' },
      { c: 'A2 C#3 E3 B3', l: 'A2 E3 B3 C#4 B3 E3', r: 'E5:2 C#5:1' },
      { c: 'F#3 A3 D4 E4', l: 'F#2 D3 A3 E4 A3 D3', r: 'A4:1 F#5:1.5 G5:0.5' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 A3 B3 F#4 B3', r: 'A5:2 G5:0.5 F#5:0.5', b: 'A6:2' },
      { c: 'A2 C#3 E3 G3', l: 'A2 E3 G3 C#4 G3 E3', r: 'G5:1.5 E5:0.5 C#5:1' },
      { c: 'D3 F#3 A3 D4', l: 'D3 A3 D4 F#4 D4 A3', r: 'D5:3', h: '@1 A3:0.5 D4:0.5 F#4:0.5 A4:0.5' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 E4 A3', r: 'A4:1 F#5:1.5 E5:0.5' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D5:2 B4:1' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 D4 G3 B2', r: 'G4:1 E5:1.5 D5:0.5' },
      { c: 'A2 C#3 E3 G3', l: 'A2 E3 G3 C#4 G3 E3', r: 'C#5:2 A4:1' },
      { c: 'F#3 A3 C#4 E4', l: 'F#2 C#3 A3 E4 A3 C#3', r: 'C#5:1 E5:1 A5:1' },
      { c: 'G3 B3 C#4 F#4', l: 'G2 D3 B3 C#4 F#4 B3', r: 'B5:1.5 A5:0.5 F#5:1', b: 'B6:1.5' },
      { c: 'G3 Bb3 D4 E4', l: 'G2 D3 Bb3 E4 Bb3 D3', r: 'E5:1 D5:1 Bb4:1' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 E4 A3', r: 'A4:3', h: '@1.8 D3:0.1 A3:0.1 E4:0.1 F#4:0.1 A4:0.1 D5:0.7' },
    ],
    B: [
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D4 F#4 D4', r: 'B4:1.5 D5:0.5 G5:1' },
      { c: 'G3 A3 C#4 E4', l: 'G2 E3 A3 C#4 E4 C#4', r: 'A5:2 G5:0.5 E5:0.5', h: '@1 E4:0.33 A4:0.33 C#5:0.34' },
      { c: 'A2 C#3 E3 F#3', l: 'A2 E3 F#3 C#4 E4 C#4', r: 'F#5:2 E5:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 A3 D4 F#4 D4', r: 'D5:2 C#5:1' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B3 D4 B3', r: 'B4:1.5 E5:0.5 G5:1' },
      { c: 'G3 B3 C#4 F#4', l: 'G2 D3 B3 C#4 F#4 C#4', r: 'B5:2 A5:0.5 F#5:0.5', b: 'B6:2' },
      { c: 'A2 D3 E3 G3 | A2 C#3 E3 G3', l: 'A2 E3 D4 E3 C#4 G3', r: 'E5:1 D5:0.5 C#5:1.5' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D5:3', h: '@1 B3:0.25 D4:0.25 F#4:0.25 A4:0.25 B4:0.5 D5:0.5' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D4 F#4 D4', r: 'B4:1.5 D5:0.5 G5:1' },
      { c: 'G3 A3 C#4 E4', l: 'G2 E3 A3 C#4 E4 C#4', r: 'A5:1.5 G5:0.5 E5:1', h: '@1 E4:0.33 A4:0.33 C#5:0.34' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 F#4 D4', r: 'F#5:2 A5:1' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B3 D4 B3', r: 'G5:2 F#5:0.5 E5:0.5' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D4 F#4 D4', r: 'D5:1 B5:1.5 A5:0.5' },
      { c: 'G3 A3 C#4 E4', l: 'G2 E3 A3 C#4 E4 C#4', r: 'C#6:2 B5:0.5 A5:0.5', b: 'A6:2' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'F#5:1.5 D5:0.5 E5:1' },
      { c: 'A2 D3 E3 G3 | A2 C#3 E3 G3', l: 'A2 E3 D4 E3 C#4 G3', r: 'D5:1.5 C#5:1.5', h: '@1.5 A3:0.1 C#4:0.1 E4:0.1 G4:0.1 A4:0.1 C#5:0.1 E5:0.6' },
    ],
    C: [
      { c: 'G3 B3 D4 F#4', l: 'G2:1 D3+B3:2', r: 'B5:3', h: 'G3 D4 F#4 B4 F#4 D4' },
      { c: 'E3 G3 B3 D4 F#4', l: 'E2:1 B2+G3:2', r: 'G6:2 F#6:1', h: 'E3 B3 F#4 G4 F#4 B3' },
      { c: 'A2 C#3 E3 B3', l: 'A2:1 E3+C#4:2', r: 'E6:3', h: 'A3 E4 B4 C#5 B4 E4' },
      { c: 'B2 D3 F#3 A3', l: 'B2:1 F#3+D4:2', r: 'D6:2 C#6:0.5 D6:0.5', h: 'B3 F#4 A4 D5 A4 F#4' },
      { c: 'F#3 A3 D4 E4', l: 'F#2:1 A3+D4:2', r: 'A5:3', h: 'F#3 D4 E4 A4 E4 D4' },
      { c: 'G3 B3 D4 F#4', l: 'G2:1 D3+B3:2', r: 'F#6:2 E6:1', h: 'G3 D4 F#4 B4 F#4 D4' },
      { c: 'E3 G3 B3 D4 F#4', l: 'E2:1 G3+D4:2', r: 'D6:2 B5:1', h: 'E3 B3 D4 G4 F#4 D4' },
      { c: 'A2 C#3 E3 G3', l: 'A2:1 G3+C#4:2', r: 'G6:1.5 E6:0.5 C#6:1', h: 'A3 C#4 E4 G4 C#5 E5' },
    ],
    T: [
      { c: 'D3 F#3 A3 C#4', l: 'D3 A3 C#4 F#4 C#4 A3', r: 'A5:1 F#6:1.5 E6:0.5' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D6:2 C#6:0.5 D6:0.5' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 F#4 B3 D3', r: 'B5:2 A5:1' },
      { c: 'G3 Bb3 D4 E4', l: 'G2 D3 Bb3 E4 Bb3 D3', r: 'Bb5:2 G5:1' },
      { c: 'F#3 A3 D4 E4', l: 'F#2 D3 A3 E4 A3 D3', r: 'A5:2 F#5:1' },
      { c: 'E3 G3 B3 D4 F#4', l: 'E2 B2 F#3 G3 D4 G3', r: 'G5:2 F#5:1' },
      { c: 'G3 A3 C#4 E4', l: 'G2 E3 A3 C#4 E4 C#4', r: 'E5:2 C#5:1' },
      { c: 'A2 D3 E3 G3', l: 'A2 E3 G3 D4 G3 E3', r: 'D5:2 B4:1', b: '@1 A6:1 E6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B' },
    { s: 'A', lift: [4, 5, 6, 7], turn: true },
    { s: 'C' },
    { s: 'T', dyn: 0.9 },
  ],
};
