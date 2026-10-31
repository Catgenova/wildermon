import type { Track } from '../score';

/**
 * Moonwater: the island at night, in every season. D♭ lydian (D♭ major with
 * G natural), 42 BPM, 4/4. A (16), B (16) on the borrowed G♭ side with a
 * minor iv, A again with its second phrase lifted an octave and the left hand
 * turned, and an eight-bar turnaround that ends on A♭ suspended, which leads
 * back into the first bar.
 *
 * Entry chord (bar 1): D♭maj7, `Db3 F3 Ab3 C4`.
 * Exit chord (last bar): A♭sus4 add9, `Ab2 Db3 Eb3 Bb3`.
 */
export const MOONWATER: Track = {
  id: 'moonwater',
  name: 'Moonwater',
  bpm: 42,
  beats: 4,
  sections: {
    A: [
      { c: 'Db3 F3 Ab3 C4', l: 'Db2 Ab2 Eb3 F3', r: 'Ab4:1 Eb5:1 F5:2' },
      { c: 'Db3 G3 Bb3 Eb4', l: 'Db2 Bb2 Eb3 G3', r: 'G5:1.5 F5:0.5 Eb5:2' },
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 Ab2 Db3 F3', r: 'F5:1.5 Eb5:0.5 Db5:2' },
      { c: 'Ab2 C3 Eb3 Bb3', l: 'Ab1:1 Eb2:1 C3:2', r: 'C5:3 r:1' },
      { c: 'Db3 F3 Ab3 C4', l: 'Db2 Ab2 Eb3 F3', r: 'Ab4:1 Eb5:1 F5:2' },
      { c: 'Db3 G3 Bb3 Eb4', l: 'Db2 Bb2 Eb3 G3', r: 'G5:1.5 F5:0.5 G5:1 Bb5:1' },
      { c: 'Bb2 Db3 F3 Ab3 | Ab2 C3 Eb3 G3', l: 'Bb1 Db3 Ab1 C3', r: 'Ab5:1 F5:1 C5:1.5 Eb5:0.5' },
      { c: 'Db3 F3 Ab3 Eb4', l: 'Db2:1 Ab2:1 F3:2', r: 'Db5:3 r:1' },
      { c: 'Db3 F3 Ab3 C4', l: 'Db2 Ab2 Eb3 F3', r: 'Ab4:1 Eb5:1 F5:2' },
      { c: 'C3 Eb3 G3 Bb3', l: 'C2 G2 Eb3 G3', r: 'G5:1.5 F5:0.5 Eb5:2' },
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 F2 Db3 F3', r: 'Db5:1 F5:1 Ab5:1 Bb5:1' },
      { c: 'Ab2 C3 Eb3 Bb3', l: 'Ab1 Eb2 C3 Eb3', r: 'C6:2 Bb5:2', b: '@2 Eb6:2' },
      { c: 'F3 Ab3 C4 Eb4', l: 'F2 C3 Eb3 Ab3', r: 'Ab5:2 F5:1 Eb5:1' },
      { c: 'Bb2 Db3 F3 Ab3', l: 'Bb1 F2 Db3 Ab3', r: 'Db5:2 F5:1 Eb5:1' },
      { c: 'Eb3 G3 Bb3 Db4 | Ab2 C3 Eb3 G3', l: 'Eb2 Db3 Ab1 C3', r: 'G5:1.5 F5:0.5 Eb5:1 C5:1' },
      { c: 'Db3 F3 Ab3 C4', l: 'Db2:2 Ab2:1 Eb3:1', r: 'Db5:3 r:1' },
    ],
    B: [
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 F2 Db3 C4', r: 'Bb4:2 C5:1 Db5:1' },
      { c: 'Gb2 Bb2 Db3 F3', l: 'Gb2 Db3 F3 Bb3', r: 'F5:2 Eb5:2' },
      { c: 'F3 Ab3 C4 Eb4', l: 'F2 C3 Eb3 Ab3', r: 'Ab4:2 Bb4:1 C5:1' },
      { c: 'Ab2 Db3 Eb3 Bb3 | Ab2 C3 Eb3 Bb3', l: 'Ab1 Db3 Eb2 C3', r: 'Db5:2 C5:2' },
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 F2 Db3 C4', r: 'Bb4:2 C5:1 Db5:1' },
      { c: 'Gb2 Bb2 Db3 F3', l: 'Gb2 Db3 F3 Bb3', r: 'Bb5:2 Ab5:1 F5:1' },
      { c: 'F3 Ab3 C4 Eb4 | Bb2 Db3 F3 Ab3', l: 'F2 Eb3 Bb1 Ab2', r: 'Ab5:1.5 F5:0.5 Eb5:1 Db5:1' },
      { c: 'Db3 G3 Bb3 Eb4', l: 'Db2:1 Bb2:1 G3:2', r: 'Eb5:3 r:1', b: '@1 G6:1.5 Eb6:1.5' },
      { c: 'Gb2 Bb2 Db3 F3', l: 'Gb2 Db3 F3 Bb3', r: 'Db5:1 F5:1 Bb5:2' },
      { c: 'F3 Ab3 C4 Eb4', l: 'F2 C3 Eb3 Ab3', r: 'Ab5:2 Eb5:1 F5:1' },
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 F2 Db3 C4', r: 'Db6:2 C6:1 Bb5:1' },
      { c: 'Ab2 C3 Eb3 Bb3', l: 'Ab1 Eb2 C3 Eb3', r: 'C6:1.5 Bb5:0.5 Ab5:2' },
      { c: 'Gb2 Bb2 Db3 F3', l: 'Gb2 Db3 F3 Bb3', r: 'Bb5:1.5 Ab5:0.5 F5:2' },
      { c: 'Gb2 A2 Db3 Eb3', l: 'Gb2 Db3 Eb3 A3', r: 'Eb5:1.5 F5:0.5 Gb5:2' },
      { c: 'Ab2 Db3 F3 C4', l: 'Ab1 Db3 F3 C4', r: 'F5:3 Eb5:1' },
      {
        c: 'Ab2 Db3 Eb3 Bb3 | Ab2 C3 Eb3 G3',
        l: 'Ab1 Db3 Eb2 C3',
        r: 'Db5:2 C5:2',
        h: '@3 Ab2:0.1 Eb3:0.1 Ab3:0.1 C4:0.1 Eb4:0.1 G4:0.5',
      },
    ],
    T: [
      { c: 'Db3 G3 Bb3 Eb4', l: 'Db2 Bb2 Eb3 G3', r: 'F5:2 G5:1 F5:1' },
      { c: 'Db3 F3 Ab3 C4', l: 'Db2 Ab2 C3 F3', r: 'Eb5:4' },
      { c: 'Bb2 Db3 F3 C4', l: 'Bb1 F2 Db3 C4', r: 'Db5:2 C5:2' },
      { c: 'F3 Ab3 C4 Eb4', l: 'F2 C3 Eb3 Ab3', r: 'Ab4:2 Eb5:2' },
      { c: 'Db3 F3 Ab3 C4', l: 'Db2 Ab2 Eb3 F3', r: 'Ab4:1 Eb5:1 F5:2' },
      { c: 'Db3 G3 Bb3 Eb4', l: 'Db2 Bb2 Eb3 G3', r: 'G5:4' },
      { c: 'Bb2 Db3 F3 C4 | F3 Ab3 C4 Eb4', l: 'Bb1 Db3 F2 C3', r: 'F5:2 Eb5:2' },
      { c: 'Ab2 Db3 Eb3 Bb3', l: 'Ab1 Eb2 Bb2 Db3', r: 'Db5:4', b: '@1 Bb5:1 Db6:1 Eb6:1' },
    ],
  },
  form: [
    { s: 'A', dyn: 0.85 },
    { s: 'B', dyn: 0.9 },
    { s: 'A', lift: [4, 5, 6, 7], turn: true, dyn: 0.88 },
    { s: 'T', dyn: 0.8 },
  ],
};
