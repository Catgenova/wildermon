import type { Species3D } from '../types';

/**
 * Maple: a leaning, bending trunk that splits low into a few sinuous limbs
 * spreading into a broad crown wider than it is tall, its leaf in ragged
 * sprays of five-pointed leaves along the branches, the ends hanging. Green
 * through the summer; red in the flower before the leaf, then hung with
 * winged keys; crimson, orange and gold in autumn from the top of the crown
 * outward, gold over and red under; bare and snowed on in winter.
 */
export const maple: Species3D = {
  name: 'Maple',
  build: {
    height: 44, stem: 0.24, spread: 0.68, dome: 0.4, droop: 0.35, girth: 0.07, flare: 1.7, scaffolds: 5, forks: 3, branching: 2.4,
    clumps: 80, clumpSize: 0.3, leaves: 34, gnarl: 0.45, lean: 3, dead: 0, bare: false, rune: false, hollow: false,
  },
  ages: {
    sapling: { stem: 0.4, spread: 0.4, dome: 0.45, girth: 0.036, flare: 1, scaffolds: 3, forks: 1, branching: 2, clumps: 16, clumpSize: 0.36, leaves: 22, gnarl: 0.1, lean: 0.8 },
    young: { stem: 0.3, spread: 0.58, girth: 0.05, flare: 1.3, scaffolds: 3, forks: 2, clumps: 40, clumpSize: 0.3, gnarl: 0.3, lean: 2 },
    old: { spread: 0.74, girth: 0.09, flare: 1.85, scaffolds: 5, clumps: 88, gnarl: 0.65, lean: 4, rune: true },
    veryOld: { spread: 0.74, girth: 0.1, flare: 1.95, scaffolds: 5, clumps: 72, gnarl: 0.85, lean: 4.5, dead: 2, rune: true, hollow: true },
    shrivelled: { girth: 0.09, flare: 1.9, scaffolds: 4, forks: 2, gnarl: 0.85, lean: 4.5, bare: true, rune: true },
    clipped: { stem: 0.16, spread: 0.85, dome: 0.55, droop: 0.15, girth: 0.07, flare: 1.3, scaffolds: 4, forks: 2, clumps: 30, clumpSize: 0.36, leaves: 28, gnarl: 0.3, lean: 1 },
  },
  bark: { lit: '#c4ad9c', shade: '#5e4c5c', dead: '#b8b0a8', furrow: '#4a3a48' },
  leaf: {
    summer: ['#4a6e60', '#5a8a62', '#6ca464', '#86bc6c', '#a4d07a', '#c4e292', '#e2f2b8'],
    spring: ['#4a6e52', '#5c8e52', '#78aa58', '#98c464', '#b8da74', '#d2ea90', '#ecf6ba'],
    bud: ['#6a2a40', '#922e44', '#bc3a48', '#d84c4e', '#ea6a60', '#f48c78', '#fab09a'],
    autumn: [
      ['#5a2244', '#842846', '#ac3048', '#cc3c46', '#e2504c', '#ee6c5a', '#f68e74'],
      ['#7a3a3e', '#a64e3a', '#cc6a38', '#e88a3e', '#f4a650', '#fac26e', '#fdd898'],
      ['#806040', '#a87e3c', '#cca040', '#e6bc48', '#f2d05c', '#f8e080', '#fcf0b0'],
    ],
  },
  leafSize: 1.9,
  keys: { colour: '#d2d48e', ripe: '#c8a470' },
  buds: '#d0464a',
};
