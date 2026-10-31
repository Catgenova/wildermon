import type { Track } from '../score';

/**
 * Blossom: the spring day. G major, 52 BPM, 4/4. A (16), B (16), A again
 * with its middle lifted an octave and the left hand turned, and an eight-bar
 * turnaround that ends on D suspended, which leads back into the first bar.
 */
export const BLOSSOM: Track = {
  id: 'blossom',
  bpm: 52,
  beats: 4,
  sections: {
    A: [
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D3 F#3 D3 B3 D3', r: 'D5:2 B4:1 C5:0.5 D5:0.5' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2 F#3 B2 G3 B2', r: 'E5:2 D5:1 B4:1', b: 'E6:2' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 E4 G3 F#4 G3 E4 G3', r: 'C5:1.5 B4:0.5 A4:1 G4:1' },
      { c: 'D3 F#3 A3 C4', l: 'D3 A3 G4 A3 F#4 A3 D4 A3', r: 'A4:2 G4:1 F#4:1' },
      { c: 'B2 D3 G3 B3', l: 'B2 F#3 D4 F#3 G3 F#3 D4 F#3', r: 'G4:1 B4:1 D5:1.5 E5:0.5', b: '@2 D6:1.5 E6:0.5' },
      { c: 'C3 E3 G3 D4', l: 'C3 G3 D4 G3 E4 G3 D4 G3', r: 'D5:2 E5:0.5 D5:0.5 B4:1', b: 'D6:2' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 C4 E3 G3 E3 C4 E3', r: 'C5:1.5 B4:0.5 A4:1 B4:1' },
      { c: 'D3 F#3 A3 C4', l: 'D3 A3 C4 A3 F#4 A3 D4 A3', r: 'A4:4' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D3 F#3 D3 B3 D3', r: 'D5:2 B4:1 C5:0.5 D5:0.5' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2 F#3 B2 G3 B2', r: 'E5:1.5 F#5:0.5 G5:1 E5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 E4 G3 F#4 G3 E4 G3', r: 'D5:1.5 C5:0.5 B4:1 A4:1' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 D4 F#3 A3 F#3 D4 F#3', r: 'B4:2 A4:1 G4:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 G3 E4 G3 B3 G3', r: 'G4:1 A4:1 B4:1 E5:1', b: '@3 E6:1' },
      { c: 'D3 F#3 A3 C4', l: 'D3 A3 D4 A3 F#4 A3 D4 A3', r: 'D5:2 C5:0.5 B4:0.5 A4:1' },
      { c: 'A2 C3 E3 G3 | D3 F#3 A3 C4', l: 'A2 E3 G3 E3 D3 A3 C4 A3', r: 'C5:1 B4:1 A4:1 F#4:1' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 A3 B3 D4 B3 A3 D3', r: 'G4:4', b: '@1 D6:1 B5:1 G6:1' },
    ],
    B: [
      { c: 'E3 G3 B3 D4', l: 'E2 B2 D3 G3 B3 G3 D3 B2', r: 'B4:1 E5:1 F#5:1 G5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 G4 E4 B3 G3', r: 'G5:2 F#5:1 E5:1' },
      { c: 'B2 D3 G3 B3', l: 'B2 G3 D4 G3 B3 G3 D4 G3', r: 'D5:3 B4:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 E4 C4 G3 E3', r: 'C5:1.5 D5:0.5 E5:2', b: '@2 E6:2' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 D3 G3 B3 G3 D3 B2', r: 'B4:1 E5:1 F#5:1 G5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 G4 E4 B3 G3', r: 'A5:2 G5:1 E5:1' },
      { c: 'D3 F#3 A3 D4', l: 'D3 A3 D4 F#4 A4 F#4 D4 A3', r: 'F#5:2 E5:1 D5:1' },
      { c: 'D3 G3 A3 C4 | D3 F#3 A3 C4', l: 'D3 A3 D4 G4 A4 F#4 D4 A3', r: 'E5:2 D5:2', b: '@2 F#6:2' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 G4 E4 B3 G3', r: 'E5:1 G5:1 E5:1 D5:1' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 F#4 D4 A3 F#3', r: 'D5:2 B4:1 A4:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 G3 C4 E4 C4 G3 E3', r: 'C5:1 E5:1 D5:1 C5:1' },
      { c: 'B2 D3 G3 B3', l: 'B2 G3 D4 G3 B3 G3 D4 G3', r: 'B4:3 G4:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 G4 E4 B3 G3', r: 'C5:1.5 D5:0.5 E5:1 G5:1' },
      { c: 'C3 Eb3 G3 A3', l: 'C3 G3 Eb4 G3 A3 G3 Eb4 G3', r: 'G5:2 Eb5:1 D5:1', b: '@2 Eb6:2' },
      { c: 'D3 G3 B3 D4', l: 'D3 G3 B3 D4 G4 D4 B3 G3', r: 'D5:2 B4:1 A4:1' },
      { c: 'D3 G3 A3 C4 | D3 F#3 A3 C4', l: 'D3 A3 C4 G4 F#4 C4 A3 D3', r: 'A4:3', b: '@2 D6:0.5 F#6:0.5 A6:1', h: '@3 D3:0.1 F#3:0.1 A3:0.1 C4:0.1 D4:0.1 F#4:0.1 A4:0.4' },
    ],
    T: [
      { c: 'C3 E3 G3 B3', l: 'C3 G3 E4 G3 B3 G3 E4 G3', r: 'E5:3 D5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 E4 G3 B3 G3 E4 G3', r: 'B4:4' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 D4 F#3 A3 F#3 D4 F#3', r: 'D5:2 A4:2' },
      { c: 'E3 G3 B3 F#4', l: 'E2 B2 G3 B2 F#3 B2 G3 B2', r: 'B4:4', b: '@1 F#6:1.5 B5:1.5' },
      { c: 'A2 C3 E3 B3', l: 'A2 E3 G3 B3 C4 B3 G3 E3', r: 'C5:2 B4:1 A4:1' },
      { c: 'D3 F#3 C4 E4', l: 'D3 A3 C4 E4 F#4 E4 C4 A3', r: 'A4:4' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D3 F#3 D3 B3 D3', r: 'G4:1 B4:1 D5:1 F#5:1' },
      { c: 'D3 G3 A3 C4', l: 'D3:1 A3:1 C4:1 G4:1', r: 'A4:4', b: '@1 A5:1 D6:1 G6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [4, 5, 6], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
