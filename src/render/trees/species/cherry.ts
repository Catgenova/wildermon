import type { TreeLook } from '../types';
import { orchardOpen, orchardWood } from './apple';

/** Cherry: a broad frothy pink crown on a dark spreading trunk, small dark-red cherries in it. */
export const cherry: TreeLook = {
  form: 'broadleaf',
  leaf: ['#fcd8e6', '#f2a6c6', '#cf789f'],
  bark: '#634440',
  marks: 'furrows',
  cluster: { style: 'puff', lobes: 6, depth: 0.85, flecks: 4 },
  shape: {
    height: 68, trunk: 0.33, width: 1.48, girth: 0.068, flare: 1.9, gnarl: 0.35, clusters: 20, clusterSize: 0.33,
    limbs: 4, flat: 0.3,
  },
  ages: {
    sapling: { width: 1.2, girth: 0.055 },
    young: { width: 1.4, limbs: 3 },
    veryOld: { gaps: 0.45, dead: 3 },
    shrivelled: { girth: 0.08, limbs: 3, trunk: 0.4 },
  },
  fruit: { colour: '#a8182e', size: 0.9, count: 14, shape: 'round' },
  layout: (g, info) => {
    orchardOpen(g, 0.78);
    orchardWood(g, info);
  },
};
