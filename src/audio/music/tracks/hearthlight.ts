import type { Track } from '../score';

/**
 * Hearthlight: the autumn evening, which takes turns with Ember Leaves.
 * B♭ major, 46 BPM, 4/4. A (16), B (16) turning to the relative G minor,
 * A again with its second phrase lifted an octave and the left hand turned,
 * and an eight-bar turnaround. 56 bars, about 4.9 minutes a loop.
 *
 * Entry chord (bar 1): B♭maj7 (Bb2 F3 A3 D4).
 * Exit chord (last bar): F7sus4 (F3 Bb3 C4 Eb4), which leads back into bar 1.
 *
 * The motif: up a fourth from F to B♭, then two steps to a held D
 * (F4 B♭4 C5 D5, long on the third); its answer is the same figure turned
 * upside down (F5 D5 C5 B♭4), and the B section opens with the fourth
 * dropped instead of raised (D5 G4 A4 B♭4).
 */
export const HEARTHLIGHT: Track = {
  id: 'hearthlight',
  name: 'Hearthlight',
  bpm: 46,
  beats: 4,
  sections: {
    A: [
      { c: 'Bb2 F3 A3 D4', l: 'Bb2 F3 D4 F3 A3 F3 D4 F3', r: 'F4:1 Bb4:0.5 C5:0.5 D5:2' },
      { c: 'G2 D3 F3 Bb3', l: 'G2 D3 Bb3 D3 F3 D3 Bb3 D3', r: 'G5:1.5 F5:0.5 D5:2' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 G3 Bb2', r: 'Eb5:1 D5:0.5 C5:0.5 Bb4:1 G4:1' },
      { c: 'C3 Eb3 G3 Bb3', l: 'C3 G3 Eb4 G3 Bb3 G3 Eb4 G3', r: 'Bb4:1 C5:1 Eb5:2' },
      { c: 'Bb2 F3 A3 D4', l: 'Bb2 F3 D4 F3 A3 F3 D4 F3', r: 'F5:1 D5:0.5 C5:0.5 Bb4:2' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 G3 Bb2', r: 'G5:1.5 F5:0.5 Eb5:1 D5:1', b: 'G6:2' },
      { c: 'C3 Eb3 G3 Bb3 | F3 A3 C4 Eb4', l: 'C3 G3 Bb3 Eb4 F2 C3 Eb3 A3', r: 'C5:1.5 Bb4:0.5 A4:1 C5:1' },
      { c: 'F3 Bb3 C4 Eb4 | F3 A3 C4 Eb4', l: 'F2 C3 Eb3 Bb3 F2 C3 Eb3 A3', r: 'Bb4:2 A4:2' },
      { c: 'Bb2 F3 A3 D4', l: 'Bb2 F3 D4 F3 A3 F3 D4 F3', r: 'F4:1 Bb4:0.5 C5:0.5 D5:2' },
      { c: 'D3 F3 A3 C4', l: 'D3 A3 C4 A3 F3 A3 C4 A3', r: 'F5:1.5 Eb5:0.5 D5:1 C5:1' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 G3 Bb2', r: 'Bb4:1 Eb5:1 G5:1.5 F5:0.5' },
      { c: 'G2 D3 F3 Bb3', l: 'G2 D3 Bb3 D3 F3 D3 Bb3 D3', r: 'G5:2 F5:1 D5:1' },
      { c: 'Eb3 G3 Bb3 D4 F4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 F3 Bb2', r: 'Eb5:1.5 F5:0.5 G5:2' },
      { c: 'Eb3 Gb3 Bb3 C4', l: 'Eb2 Bb2 Gb3 Bb2 C4 Bb2 Gb3 Bb2', r: 'Bb5:2 Gb5:2' },
      { c: 'F3 Bb3 D4 | F3 A3 C4 Eb4', l: 'F2 D3 Bb3 D3 F2 C3 Eb3 A3', r: 'F5:1 D5:1 C5:1 Eb5:1' },
      { c: 'Bb2 F3 C4 D4', l: 'Bb2 F3 C4 D4 F4 D4 C4 F3', r: 'D5:4', h: '@3 Bb3:0.1 D4:0.1 F4:0.1 Bb4:0.1 C5:0.1 D5:0.1 F5:0.4' },
    ],
    B: [
      { c: 'G3 Bb3 D4 F4 A4', l: 'G2 D3 A3 Bb3 D4 Bb3 A3 D3', r: 'D5:1 G4:0.5 A4:0.5 Bb4:2', h: 'G2:0.12 D3:0.12 Bb3:0.12 F4:0.12' },
      { c: 'Eb3 G3 Bb3 D4 F4', l: 'Eb2 Bb2 D3 G3 Bb3 G3 D3 Bb2', r: 'Eb5:1.5 D5:0.5 Bb4:1 F4:1' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 Bb3 D4 Eb4 D4 Bb3 G3', r: 'G4:1 C5:0.5 D5:0.5 Eb5:2' },
      { c: 'D3 G3 A3 C4 | D3 F3 A3 C4', l: 'D3 A3 C4 G4 D3 A3 C4 F4', r: 'D5:2 C5:1 A4:1' },
      { c: 'G3 Bb3 D4 F4 A4', l: 'G2 D3 A3 Bb3 D4 Bb3 A3 D3', r: 'D5:1 G4:0.5 A4:0.5 Bb4:2', h: 'G2:0.12 D3:0.12 Bb3:0.12 F4:0.12' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 D3 G3 Bb3 G3 D3 Bb2', r: 'Bb4:1 D5:0.5 Eb5:0.5 G5:2' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 Bb3 D4 Eb4 D4 Bb3 G3', r: 'Eb5:1 G5:1 F5:0.5 Eb5:0.5 D5:1' },
      { c: 'D3 G3 A3 C4 | D3 F#3 A3 C4', l: 'D3 A3 C4 G4 D3 A3 C4 F#4', r: 'C5:2 A4:2' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 D3 G3 Bb3 G3 D3 Bb2', r: 'G4:1 Bb4:1 Eb5:1.5 D5:0.5', h: 'Eb3:0.12 Bb3:0.12 D4:0.12 G4:0.12' },
      { c: 'D3 F3 Bb3 D4', l: 'D3 F3 Bb3 D4 F4 D4 Bb3 F3', r: 'F5:1.5 Eb5:0.5 D5:2' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 Bb3 D4 Eb4 D4 Bb3 G3', r: 'Eb5:2 D5:1 C5:1' },
      { c: 'G3 Bb3 D4 F4', l: 'G2 D3 F3 Bb3 D4 Bb3 F3 D3', r: 'D5:2 Bb4:1 G4:1' },
      { c: 'Eb3 G3 Bb3 D4 F4', l: 'Eb2 Bb2 D3 G3 Bb3 G3 D3 Bb2', r: 'Bb4:1.5 C5:0.5 D5:1 Eb5:1', h: 'Eb3:0.12 Bb3:0.12 D4:0.12 F4:0.12' },
      { c: 'D3 F3 A3 C4', l: 'D3 A3 C4 F4 A4 F4 C4 A3', r: 'F5:1 A5:1.5 G5:0.5 F5:1', b: '@1 A6:2' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 Bb3 D4 Eb4 D4 Bb3 G3', r: 'Eb5:1.5 D5:0.5 C5:2' },
      { c: 'F3 Bb3 C4 Eb4 | F3 A3 C4 Eb4', l: 'F2 C3 Eb3 Bb3 F2 C3 Eb3 A3', r: 'Bb4:2 A4:1', h: '@3 F3:0.1 A3:0.1 C4:0.1 Eb4:0.1 F4:0.1 A4:0.1 C5:0.4' },
    ],
    T: [
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 G3 Bb2', r: 'Eb5:3 D5:1' },
      { c: 'Eb3 G3 Bb3 D4 A4', l: 'Eb2 Bb2 G3 Bb2 D3 Bb2 G3 Bb2', r: 'D5:2 A4:2' },
      { c: 'D3 F3 A3 C4', l: 'D3 A3 C4 A3 F3 A3 C4 A3', r: 'C5:2 A4:1 F4:1' },
      { c: 'G3 Bb3 D4 F4 A4', l: 'G2 D3 A3 Bb3 D4 Bb3 A3 D3', r: 'Bb4:4', b: '@1 F6:1.5 D6:1.5' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C3 G3 Bb3 D4 Eb4 D4 Bb3 G3', r: 'Eb5:2 D5:1 C5:1' },
      { c: 'F3 A3 C4 Eb4', l: 'F2 C3 A3 C3 Eb3 C3 A3 C3', r: 'A4:4' },
      { c: 'Bb2 F3 A3 D4', l: 'Bb2 F3 D4 F3 A3 F3 D4 F3', r: 'D5:1.5 C5:0.5 Bb4:1 A4:1' },
      { c: 'F3 Bb3 C4 Eb4', l: 'F2:1 C3:1 Eb3:1 Bb3:1', r: 'C5:4', b: '@1 F6:1 C6:1', h: '@3 F3:0.1 Bb3:0.1 C4:0.1 Eb4:0.1 F4:0.1 Bb4:0.1 C5:0.4' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B' },
    { s: 'A', lift: [4, 5, 6, 7], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
