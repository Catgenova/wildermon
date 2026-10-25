import { apricot as flat } from '../../trees/species/apricot';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Apricot: the shared fruit tree (`./orchard`) under a broad round dome. */
export const apricot: Species3D = orchardOf('Apricot', flat, {
  build: { twist: 0.2, spread: 0.95, dome: 0.3 },
});
