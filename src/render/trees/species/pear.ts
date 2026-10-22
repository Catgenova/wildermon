import type { TreeLook } from '../types';

/** Pear: an upright crown narrowing to the top, with small golden pears. */
export const pear: TreeLook = {
  form: 'broadleaf',
  leaf: ['#92bf58', '#5b913e', '#33622f'],
  bark: '#7c604a',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 6, depth: 0.5, leaf: 1.0, slim: 0.58 },
  shape: { height: 70, trunk: 0.36, width: 1.0, girth: 0.065, clusters: 15, clusterSize: 0.4, limbs: 3, peak: 0.3, flat: 0.25 },
  fruit: { colour: '#f0c62a', size: 1.15, count: 11, shape: 'pear' },
};
