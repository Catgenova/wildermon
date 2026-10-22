import type { TreeLook } from '../types';
import { diedBack, headed, stretch } from './birch';

/** Oak: a broad crown of big rounded heads of leaf round the rim, on a thick, flared, furrowed trunk. */
export const oak: TreeLook = {
  form: 'broadleaf',
  leaf: ['#93c264', '#5a9443', '#33642f'],
  bark: '#7a5a44',
  marks: 'furrows',
  cluster: { style: 'puff', lobes: 9, depth: 0.5 },
  shape: { height: 64, trunk: 0.34, width: 1.4, girth: 0.08, flare: 1.9, gnarl: 0.25, clusters: 17, clusterSize: 0.34, limbs: 5, flat: 0.35 },
  ages: { sapling: { limbs: 3 } },
  layout: (geo, info) => {
    const near = headed(geo, 0.82, false);
    if (info.ageKey === 'veryOld') diedBack(geo, near, 0.8);
    if (info.ageKey === 'shrivelled') for (const l of geo.limbs) stretch(l, 1.3);
  },
};
