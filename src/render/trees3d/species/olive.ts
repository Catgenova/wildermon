import { olive as flat } from '../../trees/species/olive';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Olive: the shared fruit tree (`./orchard`), its fat trunk wound hardest and hollow from old age on, under a broad, open crown of long thin leaves. */
export const olive: Species3D = orchardOf('Olive', flat, {
  build: { twist: 0.6, gnarl: 1, girth: 0.13, spread: 1.0, dome: 0.26, holes: 3 },
  ages: { old: { hollow: true } },
  leafForm: 'narrow',
});
