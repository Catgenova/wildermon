import type { TreeLook } from '../types';
import { orchardOpen, orchardWood } from './apple';

/** Plum: a magenta-purple crown of pointed leaf rosettes, with small blue plums. */
export const plum: TreeLook = {
  form: 'broadleaf',
  leaf: ['#c98fc8', '#9a5aa0', '#5e3166'],
  bark: '#6a5048',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 7, depth: 0.5, leaf: 1.2, slim: 0.36 },
  shape: {
    height: 68, trunk: 0.33, width: 1.4, girth: 0.07, flare: 1.9, gnarl: 0.3, clusters: 18, clusterSize: 0.35,
    limbs: 3, flat: 0.3,
  },
  ages: {
    sapling: { width: 1.15, girth: 0.056 },
    young: { width: 1.35 },
    veryOld: { gaps: 0.45, dead: 3 },
    shrivelled: { girth: 0.082, limbs: 3, trunk: 0.4 },
  },
  fruit: { colour: '#4d52b4', size: 1.15, count: 12, shape: 'oval' },
  layout: (g, info) => {
    orchardOpen(g, 0.8);
    orchardWood(g, info);
  },
};
