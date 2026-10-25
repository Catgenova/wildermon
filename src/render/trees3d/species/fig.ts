import { fig as flat } from '../../trees/species/fig';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Fig: the shared fruit tree (`./orchard`), smooth-barked and straight, under a low crown of few big masses. */
export const fig: Species3D = orchardOf('Fig', flat, {
  build: { twist: 0, gnarl: 0.3, spread: 1.0, dome: 0.26, clumps: 14, clumpSize: 0.34 },
  leafForm: 'maple',
  smooth: true,
});
