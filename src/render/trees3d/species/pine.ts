import { mix, tone } from '../../trees/kit';
import { pine as flat } from '../../trees/species/pine';
import { fresh, wintry } from '../../foliage';
import type { Build, Ramp, Species3D, Whorls } from '../types';

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#2a3a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.32)];

/** The pine's habit: tall whorls of hanging, fingered boughs. The cedar can hang the same to its own numbers. */
const HABIT: Whorls = {
  tiers: 6, pads: 5, width: 0.6, hang: 0.3, fingers: 6, ragged: 0.3, taper: 0.26, deadTop: 1, broken: false, stubs: 1, gaps: 0, spire: true, hem: 0.24,
};
const habit = (w: Partial<Whorls>): Pick<Build, 'whorls'> => ({ whorls: { ...HABIT, ...w } });

/**
 * Pine: a tall, slender spire on a straight reddish trunk, its boughs in
 * whorls round the leader, widest at the bottom, each bough a pad falling
 * to a hem of fingers, with the trunk showing between the whorls. Old ones
 * stand bare for the lower third with dead stubs on them; a very old one is
 * dead at the top, the leader snapped and bent over. Its colours are the
 * flat pine's (`../../trees/species/pine`): blue-green the year round, new
 * growth on the finger ends in spring, darker in winter with snow on the
 * whorls.
 */
export const pine: Species3D = {
  name: 'Pine',
  build: {
    height: 62, stem: 0.36, spread: 0.36, dome: 0, droop: 0.15, girth: 0.04, flare: 1.7, scaffolds: 0, forks: 0, branching: 0,
    clumps: 0, clumpSize: 0, gnarl: 0.1, lean: 0.8, dead: 0, bare: false, rune: false, hollow: false, ...habit({}),
  },
  ages: {
    sapling: { stem: 0.06, spread: 0.3, girth: 0.034, flare: 1, gnarl: 0, lean: 0.2, ...habit({ tiers: 4, pads: 5, stubs: 0, fingers: 5, hem: 0.04, taper: 0.35 }) },
    young: { stem: 0.26, spread: 0.3, girth: 0.036, flare: 1.3, lean: 0.4, ...habit({ tiers: 5, stubs: 0, hem: 0.16, taper: 0.22 }) },
    old: { stem: 0.4, spread: 0.31, girth: 0.044, flare: 1.85, gnarl: 0.2, lean: 1.2, rune: true, ...habit({ tiers: 7, stubs: 3, gaps: 0.12 }) },
    veryOld: {
      stem: 0.4, spread: 0.3, girth: 0.046, flare: 1.95, gnarl: 0.35, lean: 1.6, rune: true, hollow: true,
      ...habit({ tiers: 6, stubs: 4, gaps: 0.15, deadTop: 0.8, broken: true }),
    },
    shrivelled: { stem: 0.25, spread: 0.3, girth: 0.044, flare: 1.9, gnarl: 0.4, lean: 1.6, bare: true, rune: true, ...habit({ broken: true }) },
    clipped: { height: 30, stem: 0.05, spread: 0.62, droop: 0.15, girth: 0.05, flare: 1.3, lean: 0.3, ...habit({ tiers: 4, pads: 7, taper: 0.4, spire: false, stubs: 0, hem: 0.03 }) },
  },
  bark: { lit: tone(flat.bark, 0.2), shade: mix(flat.bark, '#3e3040', 0.25), dead: tone(mix(flat.bark, '#9a9a9a', 0.5), 0.35), furrow: mix(flat.bark, '#2e2230', 0.6) },
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [rampOf(flat.leaf), rampOf(flat.leaf), rampOf(flat.leaf)],
  },
  evergreen: { winter: rampOf(wintry(flat.leaf)) },
};
