import { mix, tone } from '../../trees/kit';
import { paintTree3d } from '../paint';
import { grow } from '../skeleton';
import type { Build, Bush3D, BushJob, Ramp, Species3D } from '../types';

/** A ramp of seven from a bush's two tones (`BUSH_DEFS` foliage, light and dark). */
const rampOf = ([lit, deep]: readonly [string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#2a3a48', 0.25), deep, mix(deep, lit, 0.33), mix(deep, lit, 0.66), lit, tone(lit, 0.12), tone(lit, 0.24)];

const BUILD: Build = {
  height: 8, stem: 0.1, spread: 0.95, dome: 0.5, droop: 0.2, girth: 0.05, flare: 1, scaffolds: 5, forks: 1, branching: 1.5,
  clumps: 5, clumpSize: 0.6, gnarl: 0.3, lean: 0.3, dead: 0, bare: false, rune: false, hollow: false,
};

/** Rose bush, a stand-in: the tree painter's dome on a knee-high frame, in `BUSH_DEFS[0]`'s colours. */
export const rose: Bush3D = {
  name: 'Rose bush',
  grow: (seed) => ({ ...grow(BUILD, BUILD.height, seed), foot: 8 }),
  paint: (g, job: BushJob) => {
    const leaf = rampOf(job.look.foliage ?? job.def.foliage);
    const spec: Species3D = {
      name: job.def.name, build: BUILD, ages: {},
      bark: { lit: '#8a7262', shade: '#4e3c3a', dead: '#9a8a80', furrow: '#3e3030' },
      leaf: { summer: leaf, spring: leaf, autumn: [leaf, leaf, leaf] },
    };
    const dress = { season: job.season, step: 0, full: job.look.full, turned: 0, litter: 0, keys: false };
    paintTree3d(g, { sk: job.sk, spec, dress, light: job.light, e: job.e, seed: job.seed, frame: job.frame });
  },
};
