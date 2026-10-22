import type { TreeLook } from '../types';
import { boughsOf } from './pine';

/** Cedar: broad and spreading, fewer tiers swept out long and turned up at the tips, a warmer green than the pine. */
export const cedar: TreeLook = {
  form: 'conifer',
  leaf: ['#88b083', '#467e62', '#285046'],
  bark: '#7a4a36',
  marks: 'furrows',
  cluster: { style: 'puff', lobes: 8, depth: 0.5 },
  shape: { height: 80, trunk: 0.16, width: 0.8, girth: 0.044, flare: 1.8, tiers: 6, droop: 0.3 },
  ages: { veryOld: { gaps: 0, dead: 0 }, shrivelled: { girth: 0.054 } },
  ...boughsOf({ fingers: 3, thick: 0.85, lift: 0.3, slope: 0.22, curl: 0.35, inner: 0.55, hem: 0.11, deadTop: 0.55 }),
};
