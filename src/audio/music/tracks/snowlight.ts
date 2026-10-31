import type { Track } from '../score';

/**
 * Snowlight: the second winter day, in turn with Frostglass. A major with
 * lydian colour (D sharp: B/A and Amaj7#11), 42 BPM, 3/4. A (16), B (16),
 * A again with its middle lifted an octave and the left hand turned, and an
 * eight-bar turnaround. Enters on Amaj7 (A C# E G#); leaves on E7 suspended
 * (E A B D), which leads back into the first bar.
 */
export const SNOWLIGHT: Track = {
  id: 'snowlight',
  name: 'Snowlight',
  bpm: 42,
  beats: 3,
  sections: {
    A: [
      { c: 'A3 C#4 E4 G#4', l: 'A2 E3 B3 C#4 B3 E3', r: 'C#5:1 E5:1.5 B4:0.5' },
      { c: 'F#3 A3 C#4 E4', l: 'F#2 C#3 A3 C#4 A3 C#3', r: 'C#5:2 A4:1' },
      { c: 'D3 F#3 A3 C#4', l: 'D2 A2 F#3 C#4 F#3 A2', r: 'D5:1.5 C#5:0.5 B4:1' },
      { c: 'E3 A3 B3 | E3 G#3 B3', l: 'E2 B2 A3 B3 G#3 B2', r: 'A4:1.5 G#4:1.5', e: '@1.5 B5:1.5' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'B4:1 C#5:1 E5:1' },
      { c: 'D3 F#3 A3 C#4 G#4', l: 'D3 A3 C#4 E4 C#4 A3', r: 'F#5:2 E5:0.5 C#5:0.5' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'D5:1.5 C#5:0.5 B4:1' },
      { c: 'E3 A3 B3 D4 | E3 G#3 B3 D4', l: 'E2 B2 A3 B3 G#3 D3', r: 'B4:3', e: '@1 E6:1 B5:1' },
      { c: 'A3 C#4 E4 G#4', l: 'A2 E3 B3 C#4 B3 E3', r: 'C#5:1 E5:1.5 B4:0.5' },
      { c: 'F#3 A3 C#4 E4 G#4', l: 'F#2 C#3 G#3 A3 C#4 A3', r: 'C#5:1.5 E5:0.5 A5:1', e: '@2 A6:1' },
      { c: 'D3 F#3 A3 C#4 G#4', l: 'D3 A3 C#4 E4 C#4 A3', r: 'G#5:1.5 F#5:0.5 E5:1' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'E5:2 C#5:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 C#4 D4 C#4 F#3', r: 'D5:1 C#5:1 B4:1' },
      { c: 'D3 F3 A3 B3', l: 'D3 F3 B3 D4 B3 F3', r: 'D5:1 F5:1.5 E5:0.5' },
      { c: 'E3 A3 C#4 E4 | E3 G#3 B3 D4', l: 'E2 C#3 A3 B3 G#3 D3', r: 'C#5:1.5 B4:1.5' },
      { c: 'A3 B3 C#4 E4', l: 'A2 E3 B3 C#4 B3 E3', r: 'A4:3', e: '@1 C#6:1 E6:1' },
    ],
    B: [
      { c: 'D3 F#3 A3 C#4 E4', l: 'D3 A3 C#4 E4 C#4 A3', r: 'F#5:1 A5:1.5 E5:0.5' },
      { c: 'C#3 E3 A3 C#4', l: 'C#3 A3 C#4 E4 C#4 A3', r: 'E5:2 C#5:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 C#4 D4 C#4 F#3', r: 'D5:1 F#5:1.5 C#5:0.5' },
      { c: 'A3 B3 D#4 F#4', l: 'A2 F#3 B3 D#4 B3 F#3', r: 'B4:1 D#5:2', e: '@1 D#6:2' },
      { c: 'G#3 B3 E4', l: 'G#2 E3 B3 E4 B3 E3', r: 'E5:2 F#5:0.5 G#5:0.5' },
      { c: 'F#3 A3 C#4 E4 G#4', l: 'F#2 C#3 G#3 A3 C#4 A3', r: 'A5:2 G#5:1', e: '@2 C#6:1' },
      { c: 'B2 D3 F#3 A3', l: 'B2 F#3 A3 D4 A3 F#3', r: 'F#5:2 D5:1' },
      { c: 'E3 A3 B3 D4 | E3 G#3 B3 D4', l: 'E2 B2 A3 D4 G#3 B2', r: 'E5:1.5 D5:0.5 B4:1' },
      { c: 'D3 F#3 A3 C#4 E4', l: 'D3 A3 C#4 E4 C#4 A3', r: 'F#5:1 A5:1.5 E5:0.5' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'G#5:2 E5:1' },
      { c: 'F#3 A3 C#4 E4 G#4', l: 'F#2 C#3 G#3 A3 C#4 A3', r: 'A5:1.5 B5:0.5 A5:1', e: '@1.5 E6:1.5' },
      { c: 'A3 C#4 D#4 G#4', l: 'A2 E3 G#3 D#4 G#3 E3', r: 'G#5:1.5 F#5:0.5 D#5:1' },
      { c: 'D3 F#3 A3 C#4 E4', l: 'D3 A3 C#4 E4 C#4 A3', r: 'E5:2 C#5:1' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'B4:2 C#5:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 C#4 D4 C#4 F#3', r: 'D5:2 C#5:0.5 B4:0.5' },
      { c: 'E3 A3 B3 D4 | E3 G#3 B3 D4', l: 'E2 B2 A3 D4 G#3 B2', r: 'A4:1.5 G#4:1.5', h: '@2 E3:0.1 G#3:0.1 B3:0.1 D4:0.1 E4:0.1 G#4:0.1 B4:0.4' },
    ],
    T: [
      { c: 'D3 F#3 A3 C#4 E4', l: 'D2 A2 F#3 C#4 F#3 A2', r: 'C#5:1 E5:1.5 B4:0.5' },
      { c: 'D3 F#3 A3 C#4', l: 'D2 A2 F#3 C#4 E4 C#4', r: 'C#5:2 A4:1' },
      { c: 'C#3 E3 G#3 B3', l: 'C#3 G#3 B3 E4 B3 G#3', r: 'B4:2 G#4:1' },
      { c: 'F#3 A3 C#4 E4 G#4', l: 'F#2 C#3 G#3 A3 C#4 A3', r: 'A4:3', e: '@1 G#5:1 C#6:1' },
      { c: 'B2 D3 F#3 A3 C#4', l: 'B2 F#3 C#4 D4 C#4 F#3', r: 'D5:1.5 C#5:0.5 B4:1' },
      { c: 'A3 B3 D#4 F#4', l: 'A2 F#3 B3 D#4 B3 F#3', r: 'D#5:2 B4:1' },
      { c: 'A3 C#4 E4 G#4', l: 'A2 E3 B3 C#4 B3 E3', r: 'C#5:2 B4:1' },
      { c: 'E3 A3 B3 D4', l: 'E2:1 B2:1 D3:0.5 A3:0.5', r: 'A4:3', e: '@1 B5:1 E6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [4, 5, 6], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
