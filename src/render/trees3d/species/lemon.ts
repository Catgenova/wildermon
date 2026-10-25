import { lemon as flat } from '../../trees/species/lemon';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Lemon: the shared fruit tree (`./orchard`), smooth-barked, under a dense round evergreen crown. */
export const lemon: Species3D = orchardOf('Lemon', flat, {
  build: { twist: 0.1, gnarl: 0.3, spread: 0.76, dome: 0.42, clumps: 22, holes: 1 },
  smooth: true,
  gloss: true,
});
