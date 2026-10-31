import type { Track } from '../score';

/**
 * Cove: the sign-in page, the sea moving in the cove. E flat major, 6/8 at a
 * dotted-quarter pulse of 50 (150 eighths a minute, `beats: 6`). A (32), B
 * (32), A again with its third phrase lifted an octave and the left hand
 * turned, and an eight-bar turnaround that ends on B flat nine suspended,
 * which leads back into the first bar.
 *
 * Entry chord (bar 1): E flat add nine, `Eb3 G3 Bb3 F4`.
 * Exit chord (last bar): B flat nine suspended, `Bb2 Eb3 F3 Ab3 C4`.
 */
export const COVE: Track = {
  id: 'cove',
  name: 'Cove',
  bpm: 150,
  beats: 6,
  sections: {
    A: [
      // a: the motif, a sixth up and down by step; half close on B flat.
      { c: 'Eb3 G3 Bb3 F4', l: 'Eb2 Bb2 G3 Bb3 F4 Bb3', r: 'Bb4:3 G5:2 F5:1' },
      { c: 'C3 Eb3 G3 Bb3', l: 'C2 G2 Eb3 G3 Bb3 G3', r: 'Eb5:3 C5:2 Bb4:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Ab4:3 F5:2 G5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 | Bb2 D3 F3 Ab3', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'F5:2 Eb5:1 D5:3' },
      { c: 'Eb3 G3 Bb3 F4', l: 'Eb2 Bb2 G3 Bb3 F4 Bb3', r: 'Bb4:3 Bb5:3' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Ab5:2 G5:1 F5:3' },
      { c: 'F2 Ab2 C3 Eb3 G3 | Bb2 D3 F3 Ab3', l: 'F2 C3 Ab3 Bb2 F3 Ab3', r: 'Eb5:3 D5:2 C5:1' },
      { c: 'Eb3 G3 Bb3 D4', l: 'Eb2 Bb2 G3 Bb3 D4 Bb3', r: 'Bb4:3 G4:3' },
      // a': the motif climbs to C6; full close.
      { c: 'Eb3 G3 Bb3 F4', l: 'Eb2 Bb2 G3 Bb3 F4 Bb3', r: 'Bb4:3 G5:2 F5:1' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'Eb5:3 G5:2 Bb5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C6:3 Bb5:2 G5:1', b: 'C7:3' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 D4 Bb3', r: 'Bb5:3 F5:2 D5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:3 Eb5:2 F5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'F5:3 Ab5:2 G5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 | Bb2 D3 F3 Ab3', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'F5:2 Eb5:1 D5:3' },
      { c: 'Eb3 G3 Bb3 F4', l: 'Eb2 Bb2 G3 Bb3 Eb4 Bb3', r: 'Eb5:4 Bb4:2' },
      // b: arpeggios up and down in falling sequence, the motif's sixth turned at bar 21.
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:2 Eb5:1 G5:3' },
      { c: 'Ab2 D3 F3 Bb3', l: 'Ab2 D3 F3 Bb3 D4 Bb3', r: 'F5:2 D5:1 Bb4:3' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 D4 Bb3', r: 'Bb4:2 D5:1 F5:3' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'Eb5:2 D5:1 C5:3' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'Ab5:3 G5:2 F5:1' },
      { c: 'Ab2 C3 Eb3 Bb3', l: 'Ab2 Eb3 Bb3 C4 Eb4 C4', r: 'Eb5:3 C5:2 Bb4:1' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'C5:3 D5:2 Eb5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 | Bb2 D3 F3 Ab3', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'F5:4 D5:2' },
      // a'': the motif again, up to C6 and home.
      { c: 'Eb3 G3 Bb3 F4', l: 'Eb2 Bb2 G3 Bb3 F4 Bb3', r: 'Bb4:3 G5:2 F5:1' },
      { c: 'C3 Eb3 G3 Bb3', l: 'C2 G2 Eb3 G3 Bb3 G3', r: 'Eb5:3 C5:2 Bb4:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Ab4:3 F5:2 G5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'C5:2 Eb5:1 Ab5:3' },
      { c: 'G2 Bb2 Eb3 F3', l: 'G2 Eb3 F3 Bb3 Eb4 Bb3', r: 'G5:3 Bb5:2 G5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C6:3 Bb5:2 Ab5:1', b: 'C7:3' },
      { c: 'F2 Ab2 C3 Eb3 G3 | Bb2 D3 F3 Ab3', l: 'F2 C3 Ab3 Bb2 F3 Ab3', r: 'G5:2 F5:1 D5:3' },
      {
        c: 'Eb3 G3 Bb3 F4',
        l: 'Eb2 Bb2 G3 Bb3 F4 Bb3',
        r: 'Eb5:6',
        h: '@3 Eb3:0.25 G3:0.25 Bb3:0.25 F4:0.25 G4:0.25 Bb4:0.25 Eb5:0.25 F5:0.25 G5:1',
      },
    ],
    B: [
      // c: long notes over C minor; half close.
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'G5:5 F5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Eb5:3 C5:2 Eb5:1' },
      { c: 'G2 Bb2 Eb3 F3', l: 'G2 Eb3 F3 Bb3 Eb4 Bb3', r: 'F5:2 Eb5:1 Bb4:3' },
      { c: 'Bb2 D3 F3 C4', l: 'Bb2 F3 Bb3 D4 Bb3 F3', r: 'C5:3 D5:3' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'G5:5 Bb5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C6:3 Bb5:2 G5:1', b: 'G6:3' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'Ab5:3 G5:2 F5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 C4 | Bb2 D3 F3 Ab3 C4', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'Eb5:3 D5:3' },
      // c': lydian A flat, borrowed D flat, rising in sequence to E flat 6.
      { c: 'Ab2 C3 Eb3 G3 D4', l: 'Ab2 Eb3 G3 C4 G3 Eb3', r: 'C5:2 D5:1 Eb5:3' },
      { c: 'Db3 F3 Ab3 Eb4', l: 'Db2 Ab2 F3 Ab3 Eb4 Ab3', r: 'Db5:2 Eb5:1 F5:3' },
      { c: 'G2 Bb2 Eb3 F3', l: 'G2 Eb3 F3 Bb3 Eb4 Bb3', r: 'Eb5:2 F5:1 G5:3' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'Bb5:3 G5:2 Eb5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'Ab5:3 G5:2 Bb5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Eb6:3 C6:2 Bb5:1', b: 'G6:3' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 D4 Bb3', r: 'Bb5:3 G5:2 F5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3 | Bb2 D3 F3 Ab3', l: 'F2 C3 Ab3 Bb2 F3 Ab3', r: 'Ab5:2 G5:1 D5:3' },
      // c'': back to C minor (the B flat above it turned aside), the minor iv at bar 22.
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'G5:5 F5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Eb5:3 C5:2 Bb4:1' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 D4 Bb3', r: 'D5:3 F5:2 Bb5:1' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'G5:3 Eb5:2 D5:1' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:3 Eb5:2 G5:1' },
      { c: 'Ab2 Cb3 Eb3 F3', l: 'Ab2 Eb3 F3 Cb4 Eb4 Cb4', r: 'F5:3 Eb5:2 Cb5:1' },
      { c: 'Bb2 Eb3 G3 F4', l: 'Bb2 Eb3 G3 Bb3 Eb4 Bb3', r: 'Bb4:3 Eb5:2 F5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 | Bb2 D3 F3 Ab3', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'F5:2 Eb5:1 D5:3' },
      // Way back: the motif's sixth stepping down, then the sweep into A.
      { c: 'C3 Eb3 G3 Bb3', l: 'C2 G2 Eb3 G3 Bb3 G3', r: 'Bb4:3 G5:3' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'Ab4:3 F5:3' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'G4:3 Eb5:3' },
      { c: 'Bb2 Eb3 F3 Ab3 | Bb2 D3 F3 Ab3', l: 'Bb2 F3 Ab3 C4 Ab3 F3', r: 'F4:3 D5:3' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:3 Eb5:2 G5:1' },
      { c: 'G2 Bb2 D3 F3', l: 'G2 D3 F3 Bb3 D4 Bb3', r: 'Bb5:3 F5:2 D5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3 | Bb2 D3 F3 Ab3', l: 'F2 C3 Ab3 Bb2 F3 Ab3', r: 'Eb5:2 C5:1 D5:3' },
      {
        c: 'Bb2 Eb3 F3 Ab3 C4',
        l: 'Bb2 F3 Ab3 C4 Eb4 C4',
        r: 'F5:2 Eb5:1 C5:3',
        h: '@3 Bb2:0.25 Eb3:0.25 F3:0.25 Bb3:0.25 C4:0.25 Eb4:0.25 F4:0.25 Bb4:0.25 C5:1',
      },
    ],
    T: [
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:5 Eb5:1' },
      { c: 'Ab2 Cb3 Eb3 F3', l: 'Ab2 Eb3 F3 Cb4 Eb4 Cb4', r: 'Cb5:5 Eb5:1' },
      { c: 'G2 Bb2 Eb3 F3', l: 'G2 Eb3 F3 Bb3 Eb4 Bb3', r: 'Bb4:3 G5:2 F5:1' },
      { c: 'C3 Eb3 G3 Bb3 D4', l: 'C2 G2 Eb3 Bb3 D4 Bb3', r: 'Eb5:3 D5:3' },
      { c: 'Ab2 C3 Eb3 G3', l: 'Ab2 Eb3 G3 C4 Eb4 C4', r: 'C5:3 Eb5:2 G5:1' },
      { c: 'F2 Ab2 C3 Eb3 G3', l: 'F2 C3 Eb3 Ab3 C4 Ab3', r: 'Ab5:3 G5:2 F5:1', b: '@3 G6:3' },
      { c: 'Db3 F3 Ab3 Eb4', l: 'Db2 Ab2 F3 Ab3 Eb4 Ab3', r: 'F5:3 Eb5:2 Db5:1' },
      { c: 'Bb2 Eb3 F3 Ab3 C4', l: 'Bb2 F3 Ab3 C4 Eb4 F4', r: 'C5:6', b: '@3 Bb5:1 Eb6:1 F6:1' },
    ],
  },
  form: [
    { s: 'A' },
    { s: 'B', dyn: 1.05 },
    { s: 'A', lift: [16, 17, 18, 19], turn: true },
    { s: 'T', dyn: 0.9 },
  ],
};
