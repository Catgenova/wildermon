/**
 * Hybrid wildermon: the listed crosses of two kinds, and the numbers a cross and a hybrid go by. A leaf, so that the
 * rules (`creatures.ts`, `husbandry.ts`), the field guide and the drawing (`render/wildermon.ts`) all read one list.
 *
 * Asked for: "50 hybrids to start. Each is a listed cross of two kinds whose trades go together"; "a listed cross
 * succeeds at 25% of the normal breed chance, needs the breeder's breeding skill ≥ 50 and both parents at ≥ 80% care";
 * "Two trades, one worker slot ... at 75% of a pure-bred's speed in each"; "Infertile"; "Doesn't evolve: born at the
 * stage of the less-evolved parent and stays there"; "Hybrid vigour: +5% health"; "Hybrids never stand up wild".
 *
 * Each cross is `[id, name, a, b]`: the hybrid's species id and name, and its two parent kinds. The first parent, `a`,
 * gives it its body (its model's shape and moves) and its first trade, worked first where both have work in reach;
 * the second, `b`, its markings, its colours and its second trade. Which parent is the dam does not matter: either
 * way round the pair throws the same hybrid. The island has the list as `species_def.hybrid_a` and `hybrid_b`.
 */

/** A listed cross: the hybrid's id and name, its body parent and its markings parent. */
export interface HybridCross {
  id: string;
  name: string;
  /** Body, first trade. */
  a: string;
  /** Markings and colours, second trade. */
  b: string;
}

/** A listed cross takes at this share of the pairing's normal chance (`breedChance`). The island's `cross_chance`. */
export const CROSS_CHANCE = 0.25;
/** The animal husbandry a breeder needs to try a listed cross. The island's `cross_skill`. */
export const CROSS_SKILL = 50;
/** The care each parent of a listed cross needs. The island's `cross_care`. */
export const CROSS_CARE = 0.8;
/** A hybrid's task speed in each of its two trades, as a share of a pure-bred's. The island's `hybrid_work`. */
export const HYBRID_WORK = 0.75;
/** A hybrid's health over what its kind and blood give (hybrid vigour). The island's `hybrid_hardy`. */
export const HYBRID_HARDY = 1.05;

const LIST: ReadonlyArray<readonly [string, string, string, string]> = [
  ['millhog', 'Millhog', 'grista', 'seavic'],
  ['bricklekiln', 'Bricklekiln', 'potta', 'cobbe'],
  ['pailreed', 'Pailreed', 'sedra', 'dippa'],
  ['emberbroth', 'Emberbroth', 'cindra', 'simma'],
  ['sawchip', 'Sawchip', 'chissa', 'rippa'],
  ['mulchkit', 'Mulchkit', 'middun', 'bedda'],
  ['stokestew', 'Stokestew', 'embra', 'simma'],
  ['fellsaw', 'Fellsaw', 'bevere', 'rippa'],
  ['gnawbeam', 'Gnawbeam', 'bevere', 'carra'],
  ['seedgnaw', 'Seedgnaw', 'bevere', 'sappa'],
  ['stumpseed', 'Stumpseed', 'grubba', 'sappa'],
  ['pruneling', 'Pruneling', 'sprigga', 'snedda'],
  ['orchardeer', 'Orchardeer', 'plucka', 'brambo'],
  ['slipmole', 'Slipmole', 'noot', 'mudda'],
  ['kilnroll', 'Kilnroll', 'potta', 'mudda'],
  ['glowglass', 'Glowglass', 'glimmip', 'embra'],
  ['chiselbash', 'Chiselbash', 'chissa', 'quarra'],
  ['nailmole', 'Nailmole', 'mola', 'dowse'],
  ['ribbonmole', 'Ribbonmole', 'mola', 'siffa'],
  ['tinsprout', 'Tinsprout', 'dowse', 'siffa'],
  ['papyrpup', 'Papyrpup', 'sedra', 'papra'],
  ['groutpestle', 'Groutpestle', 'glossa', 'crakka'],
  ['cindermortar', 'Cindermortar', 'cindra', 'crakka'],
  ['lyepelt', 'Lyepelt', 'tanna', 'cindra'],
  ['curdchurn', 'Curdchurn', 'whirla', 'frosta'],
  ['shearwhey', 'Shearwhey', 'frosta', 'sheela'],
  ['shearspin', 'Shearspin', 'ulva', 'sheela'],
  ['yarnkit', 'Yarnkit', 'leecha', 'ulva'],
  ['salvecloth', 'Salvecloth', 'leecha', 'salva'],
  ['sporegauze', 'Sporegauze', 'vola', 'leecha'],
  ['snuffstew', 'Snuffstew', 'rabba', 'simma'],
  ['finbroth', 'Finbroth', 'wadd', 'simma'],
  ['flourbroth', 'Flourbroth', 'simma', 'grista'],
  ['malttoad', 'Malttoad', 'hoppa', 'grista'],
  ['cidertoad', 'Cidertoad', 'hoppa', 'plucka'],
  ['puddlepail', 'Puddlepail', 'holla', 'dippa'],
  ['barrelhop', 'Barrelhop', 'holla', 'hoppa'],
  ['beamspiral', 'Beamspiral', 'carra', 'awla'],
  ['arrowcalf', 'Arrowcalf', 'awla', 'flecha'],
  ['meadowmant', 'Meadowmant', 'grazza', 'petta'],
  ['mossmant', 'Mossmant', 'grazza', 'dulla'],
  ['scrubnib', 'Scrubnib', 'dulla', 'scurra'],
  ['tarskip', 'Tarskip', 'bogga', 'ambra'],
  ['candleglow', 'Candleglow', 'embra', 'wicka'],
  ['kintstitch', 'Kintstitch', 'tinka', 'relka'],
  ['digsu', 'Digsu', 'snout', 'relka'],
  ['wormsnail', 'Wormsnail', 'wurla', 'middun'],
  ['muckhog', 'Muckhog', 'seavic', 'middun'],
  ['hushpup', 'Hushpup', 'kemma', 'salva'],
  ['lilyreed', 'Lilyreed', 'sedra', 'spitta'],
];

/** Every listed cross, in the field guide's order. */
export const HYBRIDS: readonly HybridCross[] = LIST.map(([id, name, a, b]) => ({ id, name, a, b }));
/** Each cross by its hybrid's id. */
export const HYBRID_BY_ID: ReadonlyMap<string, HybridCross> = new Map(HYBRIDS.map((h) => [h.id, h]));

const pairKey = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`);
const BY_PAIR = new Map(HYBRIDS.map((h) => [pairKey(h.a, h.b), h]));
/** The listed cross of two kinds, either way round; none for a pair of one kind or a pair not listed. The island's `cross_of`. */
export const crossOf = (x: string, y: string): HybridCross | undefined => (x === y ? undefined : BY_PAIR.get(pairKey(x, y)));
/** Whether a kind is a hybrid. */
export const isHybrid = (species: string): boolean => HYBRID_BY_ID.has(species);
