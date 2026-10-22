import type { TreeLook } from '../types';
import { wornOrchard } from './pomegranate';

/** Quince: a light yellow-green, round crown with small golden quinces. */
export const quince: TreeLook = {
  form: 'broadleaf',
  leaf: ['#bcd47a', '#88aa52', '#527636'],
  bark: '#7a6450',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 8, depth: 0.5, leaf: 0.9, slim: 0.55 },
  shape: { height: 62, trunk: 0.29, width: 1.42, girth: 0.075, gnarl: 0.25, clusters: 19, clusterSize: 0.33, limbs: 3, flat: 0.18, peak: 0.25 },
  ages: { veryOld: { gaps: 0, hollow: false }, shrivelled: { trunk: 0.46, width: 1.9 } },
  fruit: { colour: '#f4be12', size: 1.15, count: 11, shape: 'pear' },
  layout: wornOrchard,
};
