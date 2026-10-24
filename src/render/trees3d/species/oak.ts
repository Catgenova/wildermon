import { mix, tone } from '../../trees/kit';
import { oak as flat } from '../../trees/species/oak';
import { AUTUMN, fresh } from '../../foliage';
import type { Ramp, Species3D } from '../types';

/** The colour the flat oak turns. */
const autumn = flat.autumn ?? AUTUMN.Oak;

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#2a3a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.08)];

type Three = readonly [string, string, string];
/** What the low masses go through on the way to the russet: brown-gold. */
const GOLD: Three = ['#e2b468', '#b98440', '#7a5630'];
/**
 * Autumn's ramp: the same three tones a step further down, so a mass's
 * body is the turned leaf's middle and its shade the deep brown under it.
 */
const fallOf = ([lit, mid, deep]: Three): Ramp =>
  [mix(tone(deep, -0.42), '#2a1a20', 0.2), tone(deep, -0.24), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.55), lit];
const mix3 = (a: Three, b: Three, t: number): Three => a.map((c, i) => mix(c, b[i], t)) as unknown as Three;

/**
 * Oak: a short, massive trunk on buttress roots splitting low into thick,
 * crooked limbs, the lowest reaching out near level, under a broad, open
 * crown of many small round-lobed masses on the branch ends. Its colours are
 * the flat oak's (`../../trees/species/oak`): green through the summer, its
 * fresh leaf in spring, its russet from the top of the crown down in autumn
 * with the low masses the last to turn, bare and snowed on in winter.
 */
export const oak: Species3D = {
  name: 'Oak',
  build: {
    height: 35, stem: 0.23, spread: 0.64, dome: 0.44, droop: 0.25, girth: 0.125, flare: 2.4, scaffolds: 5, forks: 3, branching: 2,
    clumps: 12, clumpSize: 0.46, gnarl: 0.6, lean: 1.5, dead: 0, bare: false, rune: false, hollow: false,
    habit: 'spreading', low: 0.4, zig: 0.38,
  },
  ages: {
    sapling: { stem: 0.36, spread: 0.36, dome: 0.5, girth: 0.05, flare: 1, scaffolds: 3, forks: 1, branching: 1.6, clumps: 3, clumpSize: 0.66, gnarl: 0.2, lean: 0.5, low: 0, zig: 0.3 },
    young: { stem: 0.3, spread: 0.55, dome: 0.45, girth: 0.08, flare: 1.4, scaffolds: 3, forks: 2, clumps: 5, clumpSize: 0.56, gnarl: 0.35, lean: 1, low: 0, zig: 0.35 },
    old: { spread: 0.66, girth: 0.13, flare: 2.6, scaffolds: 5, clumps: 13, clumpSize: 0.44, gnarl: 0.75, lean: 2, low: 0.5, rune: true },
    veryOld: { spread: 0.68, girth: 0.135, flare: 2.7, scaffolds: 5, clumps: 11, clumpSize: 0.44, gnarl: 0.9, lean: 2.5, low: 0.5, dead: 1, rune: true, hollow: true },
    shrivelled: { girth: 0.13, flare: 2.5, scaffolds: 5, forks: 2, gnarl: 0.9, lean: 2.5, bare: true, rune: true },
    clipped: { stem: 0.14, spread: 0.6, dome: 0.55, droop: 0.1, girth: 0.1, flare: 1.4, scaffolds: 4, forks: 2, clumps: 5, clumpSize: 0.6, gnarl: 0.3, lean: 0.6, low: 0.25 },
  },
  bark: {
    lit: tone(flat.bark, 0.3), shade: mix(flat.bark, '#3e3040', 0.45), dead: tone(flat.bark, 0.5), furrow: mix(flat.bark, '#2e2230', 0.6),
    moss: mix(flat.leaf[1], flat.bark, 0.3), ridged: true,
  },
  leafForm: 'oak',
  open: true,
  pad: 0.84,
  buttress: true,
  snowLine: true,
  inkedRune: true,
  leaf: {
    summer: rampOf(flat.leaf),
    spring: rampOf(fresh(flat.leaf)),
    autumn: [fallOf(autumn), fallOf(mix3(autumn, GOLD, 0.5)), fallOf(mix3(GOLD, flat.leaf, 0.12))],
  },
};
