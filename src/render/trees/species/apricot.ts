import type { TreeLook } from '../types';
import { wornOrchard } from './pomegranate';

/** Apricot: a green rounded crown with small orange apricots. */
export const apricot: TreeLook = {
  form: 'broadleaf',
  leaf: ['#a8d06a', '#5e9a44', '#346834'],
  bark: '#7a5c48',
  marks: 'furrows',
  cluster: { style: 'leaves', lobes: 7, depth: 0.5, leaf: 0.9, slim: 0.5 },
  shape: { height: 64, trunk: 0.3, width: 1.45, girth: 0.072, gnarl: 0.25, clusters: 18, clusterSize: 0.34, limbs: 3, flat: 0.22, peak: 0.25 },
  ages: { veryOld: { gaps: 0, hollow: false }, shrivelled: { trunk: 0.46, width: 1.9 } },
  fruit: { colour: '#f28a26', size: 1.05, count: 14, shape: 'round' },
  layout: wornOrchard,
};
