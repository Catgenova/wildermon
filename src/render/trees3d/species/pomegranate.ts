import { pomegranate as flat } from '../../trees/species/pomegranate';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Pomegranate: the shared fruit tree (`./orchard`) as a shrub of several stems from its foot, its crown high over them. */
export const pomegranate: Species3D = orchardOf('Pomegranate', flat, {
  build: { height: 31, stem: 0.1, stems: 4, scaffolds: 5, spread: 0.8, dome: 0.26, twist: 0.2, girth: 0.07, flare: 1.2 },
});
