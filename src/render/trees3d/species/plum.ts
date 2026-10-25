import { plum as flat } from '../../trees/species/plum';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Plum: the shared fruit tree (`./orchard`) under a broad round dome. */
export const plum: Species3D = orchardOf('Plum', flat, {
  build: { twist: 0.25, spread: 0.9 },
});
