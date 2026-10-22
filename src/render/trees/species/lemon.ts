import type { TreeLook } from '../types';

/** Lemon: a dense rounded evergreen crown with small yellow lemons. */
export const lemon: TreeLook = {
  form: 'broadleaf',
  leaf: ['#88bb56', '#4f8a3c', '#2c5e2e'],
  bark: '#7e6450',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 6, depth: 0.5, leaf: 0.95, slim: 0.55 },
  shape: { height: 64, trunk: 0.34, width: 1.25, girth: 0.06, clusters: 16, clusterSize: 0.39, limbs: 3, flat: 0.3 },
  fruit: { colour: '#ffe03a', size: 1.05, count: 13, shape: 'oval' },
};
