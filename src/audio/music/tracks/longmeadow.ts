import type { Track } from '../score';

/**
 * Long Meadow: the first summer day. C major, 55 BPM, 4/4. A (16): the piano
 * alone, broken chords in eighths under the tune. B (16): the left hand
 * thins to quarters and the harp takes the eighths, rising and falling under
 * a higher tune. A again with its second four bars lifted an octave and the
 * left hand turned, and an eight-bar turnaround over the harp that ends on
 * G9 suspended, which leads back into the first bar.
 *
 * Entry chord (bar 1): C add9, `C3 E3 G3 D4`.
 * Exit chord (last bar): G9 sus4, `G2 D3 F3 A3 C4`.
 */
export const LONG_MEADOW: Track = {
  id: 'longmeadow',
  name: 'Long Meadow',
  bpm: 55,
  beats: 4,
  sections: {
    A: [
      { c: 'C3 E3 G3 D4', l: 'C3 G3 D4 G3 E4 G3 D4 G3', r: 'G4:1 E5:1.5 D5:0.5 C5:1' },
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3 E4 C3 A3 C3', r: 'A4:1 F5:1.5 E5:0.5 C5:0.5 D5:0.5' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 C4 E3 G3 E3 C4 E3', r: 'E5:1.5 D5:0.5 C5:1 A4:1' },
      { c: 'G2 D3 G3 C4 | G2 D3 G3 B3', l: 'G2 D3 C4 D3 B3 D3 G3 D3', r: 'C5:2 B4:2' },
      { c: 'E3 G3 C4 D4', l: 'E2 C3 G3 C3 D4 C3 G3 C3', r: 'G4:1 G5:1.5 F5:0.5 E5:1', b: '@1 G6:2' },
      { c: 'F2 C3 E3 A3 B3', l: 'F2 C3 A3 C3 B3 C3 E4 C3', r: 'D5:1 C5:1 B4:2' },
      { c: 'D3 F3 A3 C4 E4', l: 'D3 A3 F4 A3 E4 A3 C4 A3', r: 'C5:1 D5:0.5 E5:0.5 F5:1 E5:1' },
      {
        c: 'G2 D3 G3 C4 | G2 D3 G3 B3',
        l: 'G2 D3 C4 D3 B3 D3 G3 D3',
        r: 'D5:2 B4:2',
        h: '@3 G3:0.1 B3:0.1 D4:0.1 G4:0.1 B4:0.1 D5:0.5',
      },
      { c: 'C3 E3 G3 D4', l: 'C3 G3 D4 G3 E4 G3 D4 G3', r: 'G4:1 E5:1.5 D5:0.5 C5:1' },
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3 E4 C3 A3 C3', r: 'A4:1 F5:1.5 E5:0.5 D5:1' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2 D4 B2 G3 B2', r: 'B4:1 G5:1.5 F5:0.5 E5:1' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 C4 E3 G3 E3 C4 E3', r: 'G5:1 A5:1.5 G5:0.5 E5:1' },
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3 E4 C3 A3 C3', r: 'E5:1 F5:1 A5:1.5 G5:0.5' },
      { c: 'F3 Ab3 C4 D4', l: 'F2 C3 Ab3 C3 D4 C3 Ab3 C3', r: 'C6:1.5 Ab5:0.5 F5:1 D5:1', e: 'C6:2' },
      { c: 'D3 F3 A3 C4 | G2 B2 D3 F3', l: 'D3 A3 F4 A3 G2 D3 B3 D3', r: 'F5:1.5 E5:0.5 D5:1 B4:1' },
      {
        c: 'C3 E3 G3 D4',
        l: 'C3 G3 E4 G3 C4 G3 E4 G3',
        r: 'C5:4',
        h: '@3 C4:0.1 E4:0.1 G4:0.1 C5:0.1 E5:0.1 G5:0.1 C6:0.4',
      },
    ],
    B: [
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3', r: 'E5:1 A5:2 G5:1', h: 'F3 C4 E4 A4 C5 A4 E4 C4' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 B3 D3', r: 'D5:1 G5:2 A5:1', b: '@1 G6:2', h: 'G3 D4 A4 B4 D5 B4 A4 D4' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2', r: 'G5:1.5 E5:0.5 D5:2', h: 'E3 B3 D4 G4 B4 G4 D4 B3' },
      { c: 'A2 C3 E3 G3', l: 'A2 E3 C4 E3', r: 'C5:1.5 D5:0.5 E5:2', h: 'A3 E4 G4 A4 C5 A4 G4 E4' },
      { c: 'D3 F3 A3 C4 E4', l: 'D3 A3 C4 A3', r: 'F5:1 A5:2 G5:1', h: 'D4 F4 A4 C5 E5 C5 A4 F4' },
      { c: 'Bb2 D3 F3 A3', l: 'Bb2 F3 D4 F3', r: 'A5:2 F5:1 D5:1', h: 'Bb3 D4 F4 A4 D5 A4 F4 D4' },
      { c: 'A2 F3 C4 E4', l: 'A2 F3 C4 F3', r: 'C5:1 D5:1 E5:1 F5:1', h: 'A3 C4 F4 A4 C5 A4 F4 C4' },
      { c: 'G2 C3 D3 F3 | G2 B2 D3 F3', l: 'G2 D3 B2 F3', r: 'G5:2 F5:1 D5:1', h: 'G3 D4 F4 G4 B4 G4 F4 D4' },
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3', r: 'E5:1 A5:2 G5:1', h: 'F3 C4 E4 A4 C5 A4 E4 C4' },
      { c: 'G3 B3 D4 A4', l: 'G2 D3 B3 D3', r: 'D5:1 B5:2 A5:1', b: '@1 B6:2', h: 'G3 D4 A4 B4 D5 B4 A4 D4' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2', r: 'G5:2 E5:1 D5:1', h: 'E3 B3 D4 G4 B4 G4 D4 B3' },
      { c: 'A2 C3 E3 G3 | G2 C3 E3 A3', l: 'A2 E3 G2 E3', r: 'C5:1.5 B4:0.5 C5:1 E5:1', h: 'A3 C4 E4 A4 C5 A4 E4 C4' },
      { c: 'F2 C3 E3 A3 B3', l: 'F2 C3 E3 A3', r: 'A5:1 B5:1 C6:1.5 B5:0.5', e: '@2 C6:1.5', h: 'F3 C4 E4 A4 B4 A4 E4 C4' },
      { c: 'D3 F3 A3 C4 E4', l: 'D3 A3 C4 A3', r: 'A5:1.5 G5:0.5 F5:1 E5:1', h: 'D4 F4 A4 C5 E5 C5 A4 F4' },
      { c: 'G2 C3 D3 F3', l: 'G2 D3 F3 C4', r: 'F5:2 D5:1 C5:1', h: 'G3 C4 D4 F4 G4 F4 D4 G3' },
      {
        c: 'G2 C3 D3 F3 | G2 B2 D3 F3',
        l: 'G2 D3 F3 B3',
        r: 'D5:2 B4:2',
        h: 'G3:0.5 D4:0.5 F4:0.5 G4:0.5 B3:0.5 D4:0.5 @3 G3:0.1 B3:0.1 D4:0.1 F4:0.1 G4:0.1 B4:0.1 D5:0.4',
      },
    ],
    T: [
      { c: 'A2 C3 E3 G3', l: 'A2 E3 C4 E3', r: 'G4:1 E5:3', h: 'A3 C4 E4 G4 C5 G4 E4 C4' },
      { c: 'F3 A3 C4 E4', l: 'F2 C3 A3 C3', r: 'A4:1 F5:2 E5:1', h: 'F3 C4 E4 A4 C5 A4 E4 C4' },
      { c: 'E3 G3 B3 D4', l: 'E2 B2 G3 B2', r: 'B4:1 G5:3', h: 'E3 B3 D4 G4 B4 G4 D4 B3' },
      { c: 'A2 C3 E3 G3 B3', l: 'A2 E3 G3 B3', r: 'A5:1.5 G5:0.5 E5:2', b: '@2 E6:2', h: 'A3 E4 G4 B4 E5 B4 G4 E4' },
      { c: 'D3 F3 A3 C4 E4', l: 'D3 A3 C4 A3', r: 'F5:2 E5:2', h: 'D4 F4 A4 C5 E5 C5 A4 F4' },
      { c: 'F2 C3 D3 Ab3', l: 'F2 C3 Ab3 C3', r: 'D5:2 C5:2', h: 'F3 C4 D4 Ab4 C5 Ab4 D4 C4' },
      { c: 'E3 G3 C4 D4', l: 'E2 C3 G3 C3', r: 'C5:1 G5:2 E5:1', h: 'E3 C4 D4 G4 C5 G4 D4 C4' },
      {
        c: 'G2 D3 F3 A3 C4',
        l: 'G2:1 D3:1 A3:1 C4:1',
        r: 'D5:2 C5:1 A4:1',
        b: '@2 C6:1 A5:1',
        h: 'G3 D4 F4 A4 C5 A4 F4 D4',
      },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [4, 5, 6, 7], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
