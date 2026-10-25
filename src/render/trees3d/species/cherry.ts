import { cherry as flat } from '../../trees/species/cherry';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Cherry: the shared fruit tree (`./orchard`), its trunk wound hardest of them, under a broad dome. */
export const cherry: Species3D = orchardOf('Cherry', flat, {
  build: { twist: 0.45, gnarl: 0.7, scaffolds: 4 },
  pairs: true,
});
