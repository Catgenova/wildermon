import { mix, tone } from '../../trees/kit';
import { maple as flat } from '../../trees/species/maple';
import { AUTUMN, fresh } from '../../foliage';
import type { Ramp, Species3D } from '../types';

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
/** The colour the flat maple turns. */
const autumn = flat.autumn ?? AUTUMN.Maple;

const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#3a2a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.32)];

/**
 * Maple: a short, stout trunk splitting low into a few limbs under one broad,
 * rounded dome of big lumpy masses edged in five-pointed leaves. Its colours
 * are the flat maple's (`../../trees/species/maple`): orange-red through the
 * summer, its fresh leaf in spring and hung with winged keys, its autumn
 * colour on the top of the crown going to the summer red and to gold low at
 * the rim, bare and snowed on in winter.
 */
export const maple: Species3D = {
  name: 'Maple',
  build: {
    height: 44, stem: 0.27, spread: 0.55, dome: 0.42, droop: 0.2, girth: 0.095, flare: 1.7, scaffolds: 6, forks: 3, branching: 2.4,
    clumps: 7, clumpSize: 0.52, gnarl: 0.35, lean: 2, dead: 0, bare: false, rune: false, hollow: false,
  },
  ages: {
    sapling: { stem: 0.42, spread: 0.36, dome: 0.45, girth: 0.045, flare: 1, scaffolds: 3, forks: 1, branching: 2, clumps: 4, clumpSize: 0.58, gnarl: 0.1, lean: 0.6 },
    young: { stem: 0.34, spread: 0.46, girth: 0.07, flare: 1.3, scaffolds: 4, forks: 2, clumps: 5, clumpSize: 0.56, gnarl: 0.2, lean: 1.2 },
    old: { spread: 0.6, girth: 0.11, flare: 1.85, scaffolds: 7, clumps: 8, clumpSize: 0.5, gnarl: 0.55, lean: 3, rune: true },
    veryOld: { spread: 0.6, girth: 0.12, flare: 1.95, scaffolds: 7, clumps: 7, clumpSize: 0.48, gnarl: 0.75, lean: 3.5, dead: 2, rune: true, hollow: true },
    shrivelled: { girth: 0.11, flare: 1.9, scaffolds: 5, forks: 2, gnarl: 0.8, lean: 3.5, bare: true, rune: true },
    clipped: { stem: 0.16, spread: 0.6, dome: 0.5, droop: 0.1, girth: 0.08, flare: 1.3, scaffolds: 4, forks: 2, clumps: 5, clumpSize: 0.6, gnarl: 0.3, lean: 0.8 },
  },
  bark: { lit: tone(flat.bark, 0.3), shade: mix(flat.bark, '#3e3040', 0.45), dead: tone(flat.bark, 0.5), furrow: mix(flat.bark, '#2e2230', 0.6) },
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [
      rampOf(autumn),
      rampOf(autumn.map((c, i) => mix(c, flat.leaf[i], 0.5)) as unknown as readonly [string, string, string]),
      rampOf(flat.leaf.map((c) => mix(c, '#f2c24e', 0.35)) as unknown as readonly [string, string, string]),
    ],
  },
  keys: { colour: '#e8c890', ripe: '#c8a470' },
  buds: '#d0464a',
};
