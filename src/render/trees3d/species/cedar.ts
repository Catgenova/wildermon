import { mix, tone } from '../../trees/kit';
import { cedar as flat } from '../../trees/species/cedar';
import { fresh, wintry } from '../../foliage';
import { STONE } from '../../seams/kit';
import type { Build, Ramp, Species3D, Whorls } from '../types';

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#24384a', 0.3), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, mix(tone(lit, 0.2), '#e6dc78', 0.3)];

/** The cedar's habit: many close whorls of lacy sprays down nearly to the ground, under a nodding tip. */
const HABIT: Whorls = {
  tiers: 12, pads: 8, width: 0.5, bare: 0.18, long: 1, hang: 0.55, fingers: 3, ragged: 0.35, taper: 0.16,
  deadTop: 1, broken: false, stubs: 1, gaps: 0.04, spire: true, hem: 0.13,
  lace: 9, nod: 0.08, top: 0.84, tufts: 4, limb: 0.24, buttress: true, core: 0.55, swell: 0.6,
};
const habit = (w: Partial<Whorls>): Pick<Build, 'whorls'> => ({ whorls: { ...HABIT, ...w } });

/**
 * Cedar: a tall, narrow cone on a flared, buttressed foot, its red-brown
 * trunk stringy with long fibres, its boughs in many close whorls nearly to
 * the ground, each a lacy spray that sweeps out and hangs in a fringe of
 * small tips, layered on top, over a dark middle; its tip nods over. A very
 * old one is open, its bare limbs and trunk showing between the sprays,
 * with a dead limb through it; a shrivelled one is a grey snag. Stones and
 * ferns round its foot. Its colours are the flat cedar's
 * (`../../trees/species/cedar`): green the year round, new growth on the
 * tips in spring, darker in winter with snow on the sprays.
 */
export const cedar: Species3D = {
  name: 'Cedar',
  build: {
    height: 62, stem: 0.19, spread: 0.37, dome: 0, droop: 0.32, girth: 0.055, flare: 3.4, scaffolds: 0, forks: 0, branching: 0,
    clumps: 0, clumpSize: 0, gnarl: 0.1, lean: 0.6, dead: 0, bare: false, rune: false, hollow: false, ...habit({}),
  },
  ages: {
    sapling: { stem: 0.04, spread: 0.26, girth: 0.034, flare: 1, gnarl: 0, lean: 0.2, ...habit({ tiers: 6, pads: 6, stubs: 0, lace: 8, hem: 0.03, taper: 0.3, long: 0, nod: 0.05, core: 0.4, buttress: false, swell: 0 }) },
    young: { stem: 0.15, spread: 0.34, girth: 0.045, flare: 2.4, lean: 0.4, ...habit({ tiers: 10, pads: 7, stubs: 0, lace: 10, long: 0, swell: 0.4 }) },
    old: { stem: 0.19, spread: 0.39, girth: 0.06, flare: 3.6, gnarl: 0.15, lean: 1, rune: true, ...habit({ tiers: 12, pads: 8, stubs: 2, gaps: 0.08 }) },
    veryOld: {
      stem: 0.2, spread: 0.4, girth: 0.066, flare: 3.8, gnarl: 0.3, lean: 1.4, rune: true, hollow: true,
      ...habit({ tiers: 10, pads: 7, stubs: 3, gaps: 0.26, bare: 0.4, limb: 0.42, core: 0.18, ragged: 0.5, long: 2 }),
    },
    shrivelled: { stem: 0.2, spread: 0.3, girth: 0.06, flare: 3.4, gnarl: 0.4, lean: 1.4, bare: true, rune: true, ...habit({ broken: true }) },
    clipped: {
      height: 30, stem: 0.05, spread: 0.5, droop: 0.2, girth: 0.05, flare: 1.3, lean: 0.3,
      ...habit({ tiers: 5, pads: 9, taper: 0.45, spire: false, stubs: 0, hem: 0.03, bare: 0.15, long: 0, width: 0.45, lace: 9, nod: 0, buttress: false, core: 0.4, swell: 0 }),
    },
  },
  bark: {
    lit: tone(flat.bark, 0.22), shade: mix(flat.bark, '#3e3040', 0.3), dead: tone(mix(flat.bark, '#9a9a9a', 0.55), 0.3),
    furrow: mix(flat.bark, '#2e2230', 0.6), strands: tone(flat.bark, 0.5),
  },
  buttress: true,
  snowLine: true,
  inkedRune: true,
  undergrowth: { stone: STONE },
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [rampOf(flat.leaf), rampOf(flat.leaf), rampOf(flat.leaf)],
  },
  evergreen: { winter: rampOf(wintry(flat.leaf)) },
};
