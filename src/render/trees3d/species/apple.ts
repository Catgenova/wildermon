import { apple as flat } from '../../trees/species/apple';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Apple: the shared fruit tree (`./orchard`) under a broad round dome. */
export const apple: Species3D = orchardOf('Apple', flat, {
  build: { twist: 0.25 },
});
