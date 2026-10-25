import { peach as flat } from '../../trees/species/peach';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Peach: the shared fruit tree (`./orchard`), its crown low and spreading. */
export const peach: Species3D = orchardOf('Peach', flat, {
  build: { twist: 0.2, spread: 1.0, dome: 0.25 },
});
