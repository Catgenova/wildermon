import { dulled, mix, tone } from '../../trees/kit';
import { BIRCH_INK } from '../../trees/paint';
import { birch as flat } from '../../trees/species/birch';
import { AUTUMN, fresh } from '../../foliage';
import type { Ramp, Species3D } from '../types';

/** The colour the flat birch turns. */
const autumn = flat.autumn ?? AUTUMN.Birch;
/** Its twigs, dark on the white wood. */
const twig = flat.twig ?? BIRCH_INK;

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#2a3a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.25)];

type Three = readonly [string, string, string];
const mix3 = (a: Three, b: Three, t: number): Three => a.map((c, i) => mix(c, b[i], t)) as unknown as Three;

/**
 * Birch: one to three slender white stems from one flared foot, each a
 * leader to the top with upswept limbs along it, under a tall, narrow,
 * open crown of small hanging clusters on the limbs' drooping ends. Its
 * colours are the flat birch's (`../../trees/species/birch`): chalk-white
 * bark with dark dashes, scars where limbs leave and a cracked dark band at
 * the foot; dark twigs; yellow-green leaf through the summer, its fresh leaf
 * in spring, gold in autumn, bare and snowed on along its tops in winter.
 */
export const birch: Species3D = {
  name: 'Birch',
  build: {
    height: 62, stem: 0.3, spread: 0.28, dome: 0.5, droop: 0.4, girth: 0.05, flare: 1.45, scaffolds: 9, forks: 2, branching: 2,
    clumps: 18, clumpSize: 0.42, gnarl: 0.2, lean: 1.2, dead: 0, bare: false, rune: false, hollow: false,
    habit: 'upright', stems: 3, rough: 0.1,
  },
  ages: {
    sapling: { stem: 0.34, spread: 0.26, girth: 0.036, flare: 1.1, scaffolds: 4, forks: 1, branching: 1, clumps: 5, clumpSize: 0.6, gnarl: 0.1, lean: 0.4, stems: 1, rough: 0 },
    young: { stem: 0.28, spread: 0.3, girth: 0.042, flare: 1.3, scaffolds: 7, clumps: 13, clumpSize: 0.56, gnarl: 0.15, lean: 0.8, stems: 2, rough: 0.04 },
    old: { spread: 0.3, girth: 0.056, flare: 1.55, scaffolds: 10, clumps: 20, clumpSize: 0.42, gnarl: 0.3, lean: 1.6, rune: true, rough: 0.14 },
    veryOld: { spread: 0.3, girth: 0.06, flare: 1.65, scaffolds: 10, clumps: 16, clumpSize: 0.42, gnarl: 0.4, lean: 2, dead: 2, rune: true, hollow: true, rough: 0.17 },
    shrivelled: { girth: 0.058, flare: 1.65, scaffolds: 6, forks: 1, gnarl: 0.4, lean: 2, bare: true, rune: true, rough: 0.17 },
    clipped: { stem: 0.12, spread: 0.45, dome: 0.5, droop: 0.3, girth: 0.035, flare: 1.1, scaffolds: 6, forks: 1, clumps: 8, clumpSize: 0.55, gnarl: 0.2, lean: 0.4, stems: 3, rough: 0 },
  },
  bark: {
    lit: tone(flat.bark, 0.6), shade: mix(flat.bark, '#3e3040', 0.13), dead: dulled(flat.bark, 0.4), furrow: mix(twig, '#2e2230', 0.4),
    twig, marks: { ink: BIRCH_INK, base: mix(twig, flat.bark, 0.3) },
  },
  leafForm: 'birch',
  open: true,
  haze: true,
  pad: 0.9,
  snowLine: true,
  inkedRune: true,
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [rampOf(autumn), rampOf(mix3(autumn, flat.leaf, 0.06)), rampOf(mix3(autumn, flat.leaf, 0.2))],
  },
};
