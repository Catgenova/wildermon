import type { Track } from '../score';

/**
 * First Light: dawn on the island. D lydian (D major with G#), 46 BPM, 3/4.
 * A (16), which wakes from a bare left hand of two notes a bar to quarters and
 * then four- and five-note figures; B (24), which fills out in eighths, then a
 * second voice in the right hand, by way of a borrowed G major and G minor; A
 * again with its second statement lifted an octave and the left hand turned;
 * and an eight-bar turnaround. Enters on D major 7 (D3 F#3 A3 C#4) and leaves
 * on A suspended (A2 D3 E3 B3), which leads back into the first bar.
 */
export const FIRST_LIGHT: Track = {
  id: 'firstlight',
  name: 'First Light',
  bpm: 46,
  beats: 3,
  // Asked for: the melody very subdued and muted, at 0.3 of the usual touch; then its volume halved.
  melody: 0.3,
  melodyLevel: 0.5,
  sections: {
    A: [
      { c: 'D3 F#3 A3 C#4', l: 'D2:1 A2:2', r: 'D5:1 E5:1 F#5:1' },
      { c: 'D3 E3 G#3 B3', l: 'D2:1 E3+B3:2', r: 'G#5:2 F#5:1' },
      { c: 'D3 F#3 A3 C#4', l: 'D2:1 A2:2', r: 'E5:1.5 D5:0.5 C#5:1' },
      { c: 'B2 D3 F#3 A3', l: 'B1:1 F#2:2', r: 'A4:2 r:1' },
      { c: 'D3 F#3 A3 C#4', l: 'D2 A2 F#3', r: 'D5:1 E5:1 F#5:1' },
      { c: 'D3 E3 G#3 B3', l: 'D2 B2 G#3', r: 'B5:2 G#5:1', e: '@1 B6:2' },
      { c: 'G#2 B2 E3 G#3', l: 'G#2 E3 B3', r: 'F#5:1.5 E5:0.5 B4:1' },
      { c: 'A2 D3 E3 | A2 D3 E3 | A2 C#3 E3', l: 'A2 E3 C#4', r: 'E5:3' },
      { c: 'D3 F#3 A3 C#4', l: 'D2:1 A2:0.5 F#3:0.5 C#4:1', r: 'D5:1 E5:1 F#5:1' },
      { c: 'D3 E3 G#3 B3', l: 'D2:1 B2:0.5 E3:0.5 G#3:1', r: 'G#5:2 B5:1' },
      { c: 'F#2 C#3 E3 A3', l: 'F#2:1 C#3:0.5 A3:0.5 E4:1', r: 'A5:1.5 G#5:0.5 F#5:1' },
      { c: 'B2 D3 F#3 A3', l: 'B2:1 F#3:0.5 A3:0.5 D4:1', r: 'F#5:2 D5:1' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3:1 G#3:0.5 B3:0.5 E4:0.5 B3:0.5', r: 'E5:1 F#5:1 G#5:1' },
      { c: 'E2 B2 D3 G#3', l: 'E2:1 B2:0.5 G#3:0.5 D4:0.5 G#3:0.5', r: 'B5:1.5 G#5:0.5 E5:1' },
      { c: 'A2 D3 E3 | A2 D3 E3 | A2 C#3 E3', l: 'A2:1 E3:0.5 D4:0.5 C#4:0.5 E3:0.5', r: 'D5:2 C#5:1' },
      { c: 'D3 E3 F#3 A3', l: 'D2:1 A2:0.5 E3:0.5 F#3:0.5 A3:0.5', r: 'D5:3', e: '@1 F#6:1 A6:1' },
    ],
    B: [
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'F#5:1 B5:1.5 A5:0.5' },
      { c: 'A2 D3 F#3 C#4 E4', l: 'A2 F#3 C#4 E4 C#4 F#3', r: 'A5:2 F#5:1' },
      { c: 'G#2 B2 E3 G#3', l: 'G#2 E3 B3 E4 B3 E3', r: 'E5:1.5 F#5:0.5 G#5:1' },
      { c: 'G2 B2 D3 F#3', l: 'G2 D3 B3 F#4 B3 D3', r: 'B5:2 A5:1', e: '@1 F#6:1 B6:1' },
      { c: 'F#2 A2 D3 E3 A3', l: 'F#2 D3 A3 E4 A3 D3', r: 'A5:1 F#5:1 D5:1' },
      { c: 'E2 B2 D3 G#3', l: 'E2 B2 G#3 D4 G#3 B2', r: 'E5:1 F#5:1 G#5:1' },
      { c: 'A2 E3 B3 D4 | A2 E3 B3 D4 | A2 E3 B3 C#4', l: 'A2 E3 B3 D4 C#4 E3', r: 'B5:1.5 D6:0.5 C#6:1' },
      { c: 'A2 C#3 E3 B3', l: 'A2 E3 B3 C#4 B3 E3', r: 'A5:3' },
      { c: 'D3 F#3 A3 C#4', l: 'D2 A2 F#3 C#4 F#3 A2', r: 'A5:1 D6:1.5 C#6:0.5', e: '@1 A6:2' },
      { c: 'D3 E3 G#3 B3', l: 'D2 B2 G#3 B3 G#3 B2', r: 'B5:2 G#5:1' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'G#5:1.5 F#5:0.5 E5:1' },
      { c: 'F#2 C#3 E3 A3', l: 'F#2 C#3 A3 E4 A3 C#3', r: 'F#5:1.5 A5:0.5 C#6:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 A3 C#4 A3 F#3', r: 'D6:2 C#6:0.5 B5:0.5', e: '@2 F#6:1' },
      { c: 'E2 B2 D3 F#3 G#3', l: 'E2 B2 G#3 D4 G#3 B2', r: 'B5:1 G#5:1 E5:1' },
      { c: 'A2 E3 B3 D4 | A2 E3 B3 D4 | A2 E3 B3 C#4', l: 'A2 E3 B3 E4 C#4 E3', r: 'D5:2 C#5:1' },
      { c: 'A2 C#3 E3 B3', l: 'A2 E3 B3 C#4 B3 E3', r: 'E5:1.5 F#5:0.5 A5:1' },
      { c: 'G2 D3 F#3 A3 B3', l: 'G2 D3 B3 F#4 B3 D3', r: 'B5+D5:2 A5+F#5:1', e: '@1 F#6:0.5 A6:0.5 B6:1' },
      { c: 'F#2 A2 D3 A3', l: 'F#2 D3 A3 E4 A3 D3', r: 'A5+D5:1.5 F#5:0.5 D5+A4:1' },
      { c: 'E2 B2 D3 F#3 G#3', l: 'E2 B2 G#3 D4 G#3 B2', r: 'G#5+E5:1.5 F#5:0.5 E5+B4:1' },
      { c: 'A2 E3 B3 D4 | A2 E3 B3 D4 | A2 C#3 E3', l: 'A2 E3 B3 D4 C#4 E3', r: 'E5+B4:1 F#5:1 A5+C#5:1' },
      { c: 'G2 B2 D3 F#3', l: 'G2 D3 B3 F#4 B3 D3', r: 'B5+G5:2 D6+F#5:1', e: '@2 F#6:0.5 B6:0.5' },
      { c: 'G2 Bb2 D3 E3', l: 'G2 D3 Bb3 E4 Bb3 D3', r: 'D6+Bb5:2 Bb5+G5:1' },
      { c: 'A2 D3 F#3 A3', l: 'A2 F#3 A3 D4 A3 F#3', r: 'A5+F#5:2 F#5+D5:1' },
      { c: 'A2 D3 E3 B3 | A2 C#3 E3 B3', l: 'A2 E3 D4 C#4 E3 A2', r: 'E5:1.5 C#5:1.5', e: '@1.5 C#5:0.2 E5:0.2 A5:0.2 B5:0.2 C#6:0.2 E6:0.5' },
    ],
    T: [
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 A3 C#4 A3 F#3', r: 'D5:1 E5:1 F#5:1' },
      { c: 'G#2 B2 E3 G#3', l: 'G#2 E3 B3 E4 B3 E3', r: 'G#5:2 E5:1', e: '@1 B6:2' },
      { c: 'A2 D3 F#3 C#4', l: 'A2 F#3 A3 C#4 A3 F#3', r: 'F#5:1.5 E5:0.5 A4:1' },
      { c: 'F#2 C#3 E3 A3', l: 'F#2 C#3 A3 E4 A3 C#3', r: 'C#5:3' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'B4:1 D5:1 F#5:1' },
      { c: 'E2 B2 D3 F#3 G#3', l: 'E2 B2 G#3 D4 F#4 D4', r: 'G#5:2 F#5:1' },
      { c: 'G2 D3 F#3 A3 B3', l: 'G2 D3 A3 B3 A3 D3', r: 'F#5:1.5 E5:0.5 D5:1' },
      { c: 'A2 D3 E3 B3', l: 'A2:1 E3:1 D4:1', r: 'E5:3', e: '@1 A5:1 D6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B' },
    { s: 'A', lift: [4, 5, 6], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
