import type { Track } from '../score';

/**
 * Frostglass: the first winter day. E minor with add9 colours and turns to
 * G major, 44 BPM, 4/4. A (16), B (16, in G), A again with its first phrase
 * lifted an octave and the left hand turned, and an eight-bar turnaround that
 * ends on B suspended, which leads back into the first bar.
 *
 * Entry chord (bar 1): E minor add9, `E3 G3 B3 F#4`.
 * Exit chord (last bar): B suspended fourth, `B2 E3 F#3 A3`.
 */
export const FROSTGLASS: Track = {
  id: 'frostglass',
  name: 'Frostglass',
  bpm: 44,
  beats: 4,
  sections: {
    A: [
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:1.5 F#5:0.5 G5:1 A5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 B3 E4 G4 B4 G4 E4 B3', r: 'B5:2 G5:1 E5:1' },
      { c: 'G3 B3 D4 A4', l: 'G2 B3 D4 G4 A4 G4 D4 B3', r: 'A5:1.5 E5:0.5 G5:1 B5:1' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 A4 F#4 E4 A3', r: 'A5:2 F#5:1 E5:1' },
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:1.5 F#5:0.5 G5:1 A5:1' },
      { c: 'A2 C3 E3 G3 B3', l: 'A2 E3 B3 C4 G4 C4 B3 E3', r: 'B5:1.5 C6:0.5 B5:1 G5:1', e: '@2 E6:2' },
      { c: 'C3 E3 G3 B3 F#4', l: 'C3 G3 B3 E4 F#4 E4 B3 G3', r: 'A5:1 G5:1 F#5:1 E5:1' },
      { c: 'B2 E3 F#3 A3 | B2 D3 F#3 A3', l: 'B2 F#3 A3 E4 D4 A3 F#3 B2', r: 'F#5:3 A5:1', e: '@1.5 B6:0.5 A6:0.5 F#6:1' },
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:1.5 F#5:0.5 G5:1 A5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 B3 E4 G4 B4 G4 E4 B3', r: 'B5:2 G5:1 E5:1' },
      { c: 'G3 B3 D4 A4', l: 'G2 B3 D4 G4 A4 G4 D4 B3', r: 'A5:1.5 E5:0.5 G5:1 B5:1' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 A4 F#4 E4 A3', r: 'F#5:1 A5:1 D6:2' },
      { c: 'C3 E3 G3 B3', l: 'C3 B3 E4 G4 B4 G4 E4 B3', r: 'E6:1.5 D6:0.5 C6:1 B5:1' },
      { c: 'A2 C3 E3 G3 B3', l: 'A2 E3 B3 C4 G4 C4 B3 E3', r: 'C6:1 E6:2 D6:1', e: '@2.5 B6:0.5 G6:1' },
      { c: 'A2 C3 E3 G3 | D3 F#3 A3 E4', l: 'A2 E3 G3 C4 D3 A3 E4 F#4', r: 'C6:1.5 B5:0.5 A5:1 F#5:1' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 B3 D4 A4 D4 B3 D3', r: 'G5:3 r:1', e: '@2 B6:1 G6:1' },
    ],
    B: [
      { c: 'C3 E3 G3 B3 D4', l: 'C3 G3 D4 E4 B4 E4 D4 G3', r: 'E5:1.5 G5:0.5 B5:2' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 A4 F#4 E4 A3', r: 'A5:1.5 F#5:0.5 E5:2' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 D4 F#4 A4 F#4 D4 F#3', r: 'F#5:1.5 A5:0.5 D6:2' },
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:3 r:1', e: '@3 B6:0.5 F#6:0.5' },
      { c: 'C3 E3 G3 B3 D4', l: 'C3 G3 D4 E4 B4 E4 D4 G3', r: 'E5:1.5 G5:0.5 B5:1 D6:1' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 A4 F#4 E4 A3', r: 'E6:2 D6:1 A5:1', e: '@2 F#6:1 A6:1' },
      { c: 'B2 D3 G3 B3', l: 'B2 G3 D4 G4 B4 G4 D4 G3', r: 'B5:2 A5:1 G5:1' },
      { c: 'A2 C3 E3 G3 | D3 F#3 A3 C4', l: 'A2 E3 G3 C4 D3 A3 C4 F#4', r: 'A5:1.5 B5:0.5 C6:1 A5:1' },
      { c: 'G3 B3 D4 F#4', l: 'G2 D3 B3 D4 F#4 D4 B3 D3', r: 'G5:1.5 B5:0.5 D6:2' },
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:1.5 A5:0.5 G5:1 F#5:1' },
      { c: 'C3 E3 G3 B3', l: 'C3 G3 B3 E4 G4 E4 B3 G3', r: 'E5:1.5 G5:0.5 C6:1 B5:1' },
      { c: 'C3 Eb3 G3 A3', l: 'C3 G3 A3 Eb4 G4 Eb4 A3 G3', r: 'A5:1.5 G5:0.5 Eb5:2', e: '@2 Eb6:2' },
      { c: 'D3 G3 B3 D4', l: 'D3 G3 B3 D4 G4 D4 B3 G3', r: 'D5:1 G5:1 B5:2' },
      { c: 'A2 C3 E3 G3 B3', l: 'A2 E3 B3 C4 G4 C4 B3 E3', r: 'C6:1.5 B5:0.5 E6:2', e: '@2 G6:1 B6:1' },
      { c: 'C3 E3 G3 B3 F#4', l: 'C3 G3 B3 E4 F#4 E4 B3 G3', r: 'D6:1.5 C6:0.5 B5:1 A5:1' },
      { c: 'B2 E3 F#3 A3 | B2 D#3 F#3 A3', l: 'B2 F#3 A3 E4 D#4 A3 F#3 B2', r: 'B5:2 A5:2', h: '@3 B2:0.1 D#3:0.1 F#3:0.1 A3:0.1 B3:0.1 D#4:0.1 F#4:0.1 A4:0.3' },
    ],
    T: [
      { c: 'C3 E3 G3 B3 D4', l: 'C3 G3 D4 E4 B4 E4 D4 G3', r: 'B5:3 A5:1' },
      { c: 'C3 E3 G3 B3 F#4', l: 'C3 G3 B3 E4 F#4 E4 B3 G3', r: 'G5:4', e: '@1 B6:1.5 F#6:0.5 G6:1' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 A3 B3 D4 B3 A3 D3', r: 'A5:1.5 G5:0.5 D5:2' },
      { c: 'D3 F#3 A3 E4', l: 'D3 A3 E4 F#4 A4 F#4 E4 A3', r: 'F#5:2 E5:2' },
      { c: 'E3 G3 B3 F#4', l: 'E3 B3 F#4 G4 B4 G4 F#4 B3', r: 'B5:1.5 F#5:0.5 G5:1 A5:1' },
      { c: 'A2 C3 E3 G3 B3', l: 'A2 E3 B3 C4 G4 C4 B3 E3', r: 'B5:2 C6:1 B5:1', e: '@2 E6:2' },
      { c: 'C3 E3 G3 B3 F#4', l: 'C3 G3 B3 E4 F#4 E4 B3 G3', r: 'A5:1.5 G5:0.5 F#5:2' },
      { c: 'B2 E3 F#3 A3', l: 'B2:1 F#3:1 A3:1 E4:1', r: 'E5:2.5 F#5:0.5 A5:1', e: '@1 F#6:1 B6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [0, 1, 2, 3, 4, 5, 6, 7], turn: true, dyn: 0.95 },
    { s: 'T', dyn: 0.9 },
  ],
};
