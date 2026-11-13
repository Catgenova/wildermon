// The low chignon: the game's 'chignon', "Low chignon". Built by tools/sculpt/lowchignon.mjs from this description alone
// (no sheet): the hair swept smoothly back from the whole hairline, a slight side part on the body's left, a few faceted
// comb-line locks, every lock running back to a rolled bun low at the nape, just above the neck; the bun a faceted coil;
// one loose strand at the right temple. Angles in degrees: theta round the head from the front (+ the body's left), phi up
// from the skull's middle; lengths in head units on the man (the woman's scaled by her skull's size).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Low chignon',
  // the hairline round the head, per body: per |theta| the phi under which there is no hair (the forehead's along the
  // head's own t0-t1 edge; over the temple; over the ear's top; behind the ear down to the nape)
  edge: {
    male: [[0, 29], [20, 28], [40, 24], [55, 18], [68, 12], [80, 10], [95, 10], [105, 6], [115, -6], [130, -24], [150, -38], [165, -43], [180, -44]],
    female: [[0, 35.5], [20, 34], [40, 28], [55, 20], [68, 12], [80, 6], [95, 6], [105, 2], [115, -10], [130, -28], [150, -42], [165, -48], [180, -50]],
  },
  // the bun: where its foot is on the skull (theta, phi), its axis that share of the way from the skull's normal there
  // to straight back, tipped up by `up` (a share)
  knot: { th: 180, ph: { male: -20, female: -24 }, back: 0.5, up: 0.12 },
  // the locks round the bun: their count (a ridge each, a border between two), spaced evenly along the ring `spaceAt`
  // of the way out from the bun; each border a comb line `valleyHalf` degrees each side of it in `creaseShade`
  locks: 9, spaceAt: 0.7, valleyHalf: 1.6, creaseShade: 4,
  // the side part: where it meets the hairline (theta), its groove's half width (degrees round the bun), from this share
  // of the way out to the hairline; its groove in `shade`, the hair there thinned by `dip` of its thickness; the hair the
  // far side of it raised by `lift` (head units) over `spread` degrees
  part: { th: 26, half: 2.2, from: 0.5, shade: 1, dip: 0.55, lift: 0.018, spread: 22 },
  // the rows out from the bun to the hairline, as shares of the way (the bun's own point at 0)
  rows: [0, 0.1, 0.22, 0.35, 0.48, 0.61, 0.73, 0.84, 0.93, 1],
  // the hair's thickness off the skin along the way (from the bun to the hairline)
  thick: [[0, 0.06], [0.25, 0.07], [0.6, 0.068], [0.85, 0.055], [0.95, 0.045], [1, 0.035]],
  // and that taken this many times by |theta| where the lock ends (the nape's hair, up to the bun, lies flatter)
  thickBy: [[0, 1], [60, 1], [110, 0.95], [150, 0.85], [180, 0.8]],
  // a lock's relief: its ridge out and its borders in by this share of the thickness, at most `relief`
  reliefShare: 0.2, relief: 0.013,
  // the shell's inside sunk this far into the scalp where it lies on it, the rows out to `sinkTo` of the way; off the
  // skin by `lip` where it does not (toward its edge); the rim (the hairline's thickness) in this shade
  sink: 0.04, sinkTo: 0.8, lip: 0.006, rimShade: 2,
  // the shell's outside at least this far over every point of the skin it covers
  cover: 0.015,
  // the bun: its radius across, up and down, and along its axis (out from the skull), its middle this far out along the
  // axis from the skin; its lobes (the rolled hair, a ridge each, a crease between in `creaseShade`) at these
  // latitudes, each ring turned `twist` degrees on the last (the coil); ridges out and creases in by `relief`
  bun: { rx: 0.31, ry: 0.2, rv: 0.16, out: 0.2, lobes: 5, lats: [-72, -44, -14, 16, 44, 72], twist: 26, relief: 0.08, creaseShade: 2 },
  // the loose strand: its root under the hairline at this theta (the body's right), this far above it; hanging this
  // long, drawn this many degrees forward toward its tip with a wave of `wave` degrees; its width and depth at the root
  // (to a point at the tip), off the skin by `off`, curled out by `curl` at the tip, in rings; its inside in `shade`
  strand: { th: -64, above: 3, len: 0.5, fwd: 8, wave: 3, w: 0.12, d: 0.05, off: 0.04, curl: 0.07, rings: 7, shade: 3 },
};
