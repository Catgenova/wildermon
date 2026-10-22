import type { TreeLook } from '../types';
import { diedBack, headed, stretch } from './birch';

/** Maple: a full, rounded crown of big pointed, scalloped heads of leaf in vivid orange-red. */
export const maple: TreeLook = {
  form: 'broadleaf',
  leaf: ['#ff9c54', '#e9582d', '#a8322a'],
  bark: '#6f5546',
  marks: 'furrows',
  cluster: { style: 'star', lobes: 7, depth: 0.55, flecks: 2 },
  shape: { height: 66, trunk: 0.32, width: 1.25, girth: 0.062, flare: 1.75, clusters: 13, clusterSize: 0.39, limbs: 5, flat: 0.3 },
  ages: { sapling: { limbs: 3 }, shrivelled: { limbs: 4 } },
  layout: (geo, info) => {
    const near = headed(geo, 0.86, false);
    if (info.ageKey === 'veryOld') diedBack(geo, near, 0.8);
    if (info.ageKey === 'shrivelled') for (const l of geo.limbs) stretch(l, 1.3);
  },
};
