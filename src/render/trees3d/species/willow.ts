import { mix, tone } from '../../trees/kit';
import { willow as flat } from '../../trees/species/willow';
import { AUTUMN, fresh } from '../../foliage';
import type { Build, Ramp, Species3D, Weep } from '../types';

/** The colour the flat willow turns. */
const autumn = flat.autumn ?? AUTUMN.Willow;

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#2a3a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.3)];

type Three = readonly [string, string, string];
const mix3 = (a: Three, b: Three, t: number): Three => a.map((c, i) => mix(c, b[i], t)) as unknown as Three;

/** The willow's curtains: strands round each lobe's rim, hanging to a ragged hem. */
const WEEP: Weep = { tops: 2, fill: 1.3, width: 1.05, hem: 0.17, ragged: 0.2 };
const weep = (w: Partial<Weep>): Pick<Build, 'weep'> => ({ weep: { ...WEEP, ...w } });

/**
 * Willow: a thick, leaning trunk in an S-bend, twisted, forking into a few
 * twisting limbs that arch up and out, a lobe of leaf on the end of each
 * making a broad dome, and a curtain of long strands hanging off every lobe
 * nearly to the ground, parted in front so the trunk shows. Its colours are
 * the flat willow's (`../../trees/species/willow`): yellow-green through the
 * summer, its fresh leaf in spring, its yellow in autumn as the strands thin,
 * bare whips hanging and snowed on in winter.
 */
export const willow: Species3D = {
  name: 'Willow',
  build: {
    height: 40, stem: 0.36, spread: 0.72, dome: 0.4, droop: 0.3, girth: 0.085, flare: 2.1, scaffolds: 5, forks: 2, branching: 2,
    clumps: 7, clumpSize: 0.4, gnarl: 0.7, lean: 4, dead: 0, bare: false, rune: false, hollow: false,
    habit: 'spreading', low: 0, zig: 0.42, sBend: 0.9, ...weep({}),
  },
  ages: {
    sapling: { stem: 0.4, spread: 0.5, dome: 0.45, girth: 0.05, flare: 1, scaffolds: 3, forks: 1, clumpSize: 0.5, gnarl: 0.2, lean: 1, sBend: 0.4, ...weep({ tops: 1, hem: 0.22, ragged: 0.2, width: 1 }) },
    young: { stem: 0.38, spread: 0.62, girth: 0.065, flare: 1.4, scaffolds: 4, clumpSize: 0.48, gnarl: 0.45, lean: 2, sBend: 0.7, ...weep({ tops: 1, hem: 0.14 }) },
    old: { spread: 0.76, girth: 0.095, flare: 2.3, scaffolds: 5, gnarl: 0.85, lean: 5, sBend: 1.1, rune: true },
    veryOld: { spread: 0.76, girth: 0.105, flare: 2.4, scaffolds: 6, gnarl: 1, lean: 5.5, sBend: 1.35, dead: 1, rune: true, hollow: true },
    shrivelled: { girth: 0.1, flare: 2.3, scaffolds: 5, forks: 2, gnarl: 1, lean: 5, sBend: 1.2, bare: true, rune: true },
    clipped: { height: 30, stem: 0.2, spread: 0.75, dome: 0.5, droop: 0.1, girth: 0.08, flare: 1.4, scaffolds: 4, forks: 2, clumpSize: 0.5, gnarl: 0.4, lean: 0.6, sBend: 0.3, ...weep({ tops: 1, hem: 0.08, ragged: 0.15, width: 1 }) },
  },
  bark: {
    lit: tone(flat.bark, 0.36), shade: mix(flat.bark, '#3e3040', 0.3), dead: tone(mix(flat.bark, '#a8a8a0', 0.4), 0.45), furrow: mix(flat.bark, '#2e2230', 0.6),
    // Dead wood weathered pale, its shade too.
    deadShade: mix(tone(mix(flat.bark, '#a8a8a0', 0.4), 0.45), '#4a4450', 0.4),
    twist: true,
  },
  // The flat willow's withies (`../../trees/tree`).
  whips: mix(flat.bark, '#c8b878', 0.6),
  leafForm: 'willow',
  open: true,
  buttress: true,
  snowLine: true,
  inkedRune: true,
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [rampOf(autumn), rampOf(mix3(autumn, flat.leaf, 0.45)), rampOf(mix3(autumn, flat.leaf, 0.2).map((c) => tone(c, 0.06)) as unknown as Three)],
  },
};
