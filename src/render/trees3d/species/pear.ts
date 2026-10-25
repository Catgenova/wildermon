import { pear as flat } from '../../trees/species/pear';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Pear: the shared fruit tree (`./orchard`), upright, its crown narrowing to its top. */
export const pear: Species3D = orchardOf('Pear', flat, {
  build: { stem: 0.24, spread: 0.66, dome: 0.62, peak: 0.72, twist: 0.15, gnarl: 0.4, clumps: 18 },
});
