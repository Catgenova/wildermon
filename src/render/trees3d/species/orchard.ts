import { fruitingSeasons } from '../../../game/fruiting';
import { TREE_DEFS } from '../../../world/tiles';
import { AUTUMN, BLOOMS, EVERGREEN, fresh, newLeaf, wintry } from '../../foliage';
import { mix, tone } from '../../trees/kit';
import { SPRING_GREEN } from '../../trees/tree';
import type { AgeKey, Tones, TreeLook } from '../../trees/types';
import type { Build, Ramp, Species3D } from '../types';

/**
 * A ramp of seven from a crown's three tones (lit, body, underside), as the
 * flat trees are painted (`../../trees`): the same colours, with a step
 * deeper under the underside and a step paler over the lit.
 */
const rampOf = ([lit, mid, deep]: readonly [string, string, string]): Ramp =>
  [mix(tone(deep, -0.22), '#3a2a48', 0.25), deep, mix(deep, mid, 0.5), mid, mix(mid, lit, 0.5), lit, tone(lit, 0.28)];
const mix3 = (a: Tones, b: Tones | string, t: number): Tones =>
  a.map((c, i) => mix(c, typeof b === 'string' ? b : b[i], t)) as unknown as Tones;

/** A fruit tree at its prime: small, squat and gnarled, its trunk wound round itself, under a low dome of small clusters. */
const BUILD: Build = {
  height: 34, stem: 0.2, spread: 0.95, dome: 0.27, droop: 0.15, girth: 0.1, flare: 1.8, scaffolds: 4, forks: 3, branching: 2,
  clumps: 19, clumpSize: 0.29, gnarl: 0.6, lean: 1.2, dead: 0, bare: false, rune: false, hollow: false,
  habit: 'orchard', zig: 0.35, twist: 0.35, stems: 0,
};

/** How each age changes a kind's prime, as the flat trees' age rules do (`../../trees/tree` AGE_RULES). */
const AGES: Record<AgeKey, (b: Build) => Partial<Build>> = {
  sapling: (b) => ({
    stem: 0.5, spread: b.spread * 0.45, dome: 0.6, girth: b.girth * 0.4, flare: 1, scaffolds: 2, forks: 1, branching: 1.5, clumps: 4,
    clumpSize: 0.5, gnarl: 0.3, lean: b.lean * 0.3, twist: 0.3, stems: 0,
  }),
  young: (b) => ({
    stem: b.stem * 1.3, spread: b.spread * 0.62, dome: b.dome * 1.3, girth: b.girth * 0.55, flare: 1.3, scaffolds: 3, forks: 2,
    clumps: Math.round(b.clumps * 0.5), clumpSize: b.clumpSize * 1.3, gnarl: b.gnarl * 0.7, lean: b.lean * 0.6, twist: (b.twist ?? 0) * 0.9, stems: Math.min(b.stems ?? 0, 2),
  }),
  mature: () => ({}),
  old: (b) => ({
    spread: b.spread * 1.05, girth: b.girth * 1.15, flare: b.flare * 1.1, scaffolds: b.scaffolds + 1, clumps: Math.round(b.clumps * 1.15),
    gnarl: Math.min(1, b.gnarl + 0.2), lean: b.lean * 1.3, twist: (b.twist ?? 0) * 1.3, rune: true,
  }),
  veryOld: (b) => ({
    spread: b.spread * 1.05, girth: b.girth * 1.25, flare: b.flare * 1.15, scaffolds: b.scaffolds + 1, clumpSize: b.clumpSize * 0.95,
    gnarl: 1, lean: b.lean * 1.5, twist: (b.twist ?? 0) * 1.5, dead: 1, rune: true, hollow: true,
  }),
  shrivelled: (b) => ({ girth: b.girth * 1.2, flare: b.flare * 1.1, forks: 2, gnarl: 1, lean: b.lean * 1.5, twist: (b.twist ?? 0) * 1.5, bare: true, rune: true }),
  clipped: (b) => ({
    stem: 0.14, spread: b.spread * 0.95, dome: 0.55, droop: 0.1, girth: b.girth * 0.85, flare: 1.3, scaffolds: 3, forks: 2, clumps: 6,
    clumpSize: 0.58, gnarl: 0.3, lean: b.lean * 0.4, twist: 0.15, stems: 0,
  }),
};

/** What one kind sets of the shared fruit tree: its prime's build, any age's own, its leaf's edge and the bark's rope. */
export interface OrchardKind {
  build?: Partial<Build>;
  ages?: Partial<Record<AgeKey, Partial<Build>>>;
  leafForm?: Species3D['leafForm'];
  /** A mass's height on the screen against its width. */
  pad?: number;
  /** Smooth bark: no ridges wound round the trunk. */
  smooth?: boolean;
  /** Fruit hung in pairs on stalks. */
  pairs?: boolean;
}

/** The leaf edge a flat tree's clump of leaf hints at (`../../trees/types` ClusterLook): scalloped puffs, long thin leaves or pointed ovals. */
const leafFormOf = (flat: TreeLook): Species3D['leafForm'] =>
  flat.cluster.style === 'puff' ? 'puff' : (flat.cluster.slim ?? 0.5) <= 0.4 ? 'narrow' : 'oval';

/**
 * A fruit tree drawn as a solid (`../orchard`), from its flat tree
 * (`../../trees/species`): its bark, its leaf through the year and the colour
 * it turns, its flower (`../../foliage` BLOOMS) in spring at the ages that
 * bear, and its fruit in the seasons the island's fruiting table has it on
 * the tree (`../../../game/fruiting`), at those ages.
 */
export function orchardOf(name: string, flat: TreeLook, kind: OrchardKind): Species3D {
  const id = TREE_DEFS.find((d) => d.name === name)?.fruit ?? '';
  const build: Build = { ...BUILD, ...kind.build };
  const ages: Partial<Record<AgeKey, Partial<Build>>> = {};
  for (const k of Object.keys(AGES) as AgeKey[]) ages[k] = { ...AGES[k](build), ...kind.ages?.[k] };
  const bloom = BLOOMS[id];
  const au = flat.autumn ?? AUTUMN[name] ?? flat.leaf;
  // The new leaf among blossom is green whatever the summer crown is (`../../trees/tree`).
  const green = parseInt(flat.leaf[1].slice(3, 5), 16) > parseInt(flat.leaf[1].slice(1, 3), 16);
  const fruit = flat.fruit;
  return {
    name,
    build,
    ages,
    bark: {
      lit: tone(flat.bark, 0.3), shade: mix(flat.bark, '#3e3040', 0.4), dead: tone(mix(flat.bark, '#9a9a9a', 0.55), 0.3),
      furrow: mix(flat.bark, '#2e2230', 0.6), ...(kind.smooth ? {} : { rope: tone(flat.bark, 0.5) }),
    },
    leafForm: kind.leafForm ?? leafFormOf(flat),
    open: true,
    pad: kind.pad ?? 0.84,
    snowLine: true,
    inkedRune: true,
    leaf: {
      summer: rampOf(flat.leaf),
      spring: rampOf(fresh(flat.leaf)),
      autumn: [rampOf(au), rampOf(mix3(au, flat.leaf, 0.4)), rampOf(mix3(au, '#f2c24e', 0.25))],
    },
    ...(EVERGREEN.has(name) ? { evergreen: { winter: rampOf(wintry(flat.leaf)) } } : {}),
    orchard: {
      bloom: {
        ramp: rampOf(bloom?.tones ?? flat.leaf), eye: bloom?.eye ?? null, cover: bloom?.cover ?? 0,
        leaf: rampOf(newLeaf(green ? flat.leaf : SPRING_GREEN)),
      },
      fruit: {
        colour: fruit?.colour ?? '#c03030', size: fruit?.size ?? 1, count: fruit?.count ?? 0, shape: fruit?.shape ?? 'round',
        seasons: fruitingSeasons(id), pairs: kind.pairs ?? false,
      },
    },
  };
}
