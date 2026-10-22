import type { TreeLook } from '../types';
import { orchardWood } from './apple';

/** Peach: a fresh yellow-green crown of long narrow leaves, with small coral peaches. */
export const peach: TreeLook = {
  form: 'broadleaf',
  leaf: ['#b6d872', '#72aa4a', '#3c7437'],
  bark: '#7c5a46',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 8, depth: 0.5, leaf: 1.3, slim: 0.28 },
  shape: {
    height: 68, trunk: 0.34, width: 1.4, girth: 0.068, flare: 1.9, gnarl: 0.3, clusters: 18, clusterSize: 0.35,
    limbs: 3, flat: 0.3,
  },
  ages: {
    sapling: { width: 1.15, girth: 0.055 },
    young: { width: 1.35 },
    veryOld: { gaps: 0.45, dead: 3 },
    shrivelled: { girth: 0.08, limbs: 3, trunk: 0.4 },
  },
  fruit: { colour: '#f7804e', size: 1.15, count: 13, shape: 'round' },
  layout: orchardWood,
};
