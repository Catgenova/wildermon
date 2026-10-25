import { quince as flat } from '../../trees/species/quince';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Quince: the shared fruit tree (`./orchard`), low and round, its limbs crooked. */
export const quince: Species3D = orchardOf('Quince', flat, {
  build: { twist: 0.2, spread: 0.88, dome: 0.32, zig: 0.5 },
});
