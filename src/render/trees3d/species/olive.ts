import { olive as flat } from '../../trees/species/olive';
import type { Species3D } from '../types';
import { orchardOf } from './orchard';

/** Olive: the shared fruit tree (`./orchard`), its fat trunk wound hardest and hollow from old age on, under a broad, open crown of small flat clumps of long thin leaves. */
export const olive: Species3D = orchardOf('Olive', flat, {
  build: { stem: 0.3, twist: 0.6, gnarl: 1, girth: 0.13, spread: 1.0, dome: 0.24, clumps: 22, clumpSize: 0.2, holes: 4 },
  ages: { old: { hollow: true } },
  leafForm: 'narrow',
  pad: 0.7,
});
