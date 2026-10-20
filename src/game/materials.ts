import { GEMS, tradeName, type GemDef } from './gems';
import { METAL_BY_INGOT, METAL_BY_LUMP, METALS } from './metal';
import { TREE_DEFS } from '../world/tiles';

/**
 * What a thing is made of, and what that is worth.
 *
 * Wurm's rule is that the same bill of materials in two different woods, or
 * two different metals, makes two different things. An oak chest outlasts a
 * pine one and is harder work to build; a cedar barrel is still sound when
 * the birch one beside it has gone; a lead sword is a joke and an adamantine
 * one is not. Every wood and every metal carries the same eight numbers, and
 * everything made of it reads whichever of them apply to the sort of thing
 * it is.
 */
export type MaterialKind = 'wood' | 'metal' | 'gem';

export interface MaterialDef {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Added to the difficulty of anything made of it: hard woods fight back. */
  difficulty: number;
  /** Multiplier on the finished thing's weight. */
  weight: number;
  /** Multiplier on damage it takes in use, and on the blows armour soaks up. */
  wear: number;
  /** Multiplier on how fast it rots when it is left out. */
  decay: number;
  /** Multiplier on the harm a weapon of it does. */
  edge: number;
  /** Multiplier on the share of a blow armour of it turns aside. */
  soak: number;
  /** Multiplier on a tool's working quality: how fast and how true it cuts. */
  bite: number;
  /** Multiplier on what a container or a cart of it will hold. */
  hold: number;
  /** Strikes the unnatural harder than its edge alone would say. */
  bane?: boolean;
  /** One line, for the examine window. */
  note: string;
}

type Props = Omit<MaterialDef, 'id' | 'name' | 'kind'>;

/**
 * The six woods. Pine is the cheap softwood that grows everywhere and rots as
 * fast as it grew; oak is the one that costs you an afternoon and outlives
 * you; cedar is the one that does not rot. Birch and willow are light and
 * springy, which is what a bow wants and a wall does not.
 */
const WOOD_PROPS: Record<string, Props> = {
  Birch: { difficulty: -1, weight: 0.88, wear: 1.02, decay: 1.05, edge: 1, soak: 0.96, bite: 1.04, hold: 1, note: '' },
  Pine: { difficulty: -3, weight: 0.8, wear: 1.2, decay: 1.25, edge: 0.9, soak: 0.88, bite: 1.06, hold: 0.95, note: '' },
  Oak: { difficulty: 5, weight: 1.22, wear: 0.68, decay: 0.85, edge: 1.12, soak: 1.16, bite: 0.94, hold: 1.12, note: '' },
  Maple: { difficulty: 1, weight: 1.05, wear: 0.9, decay: 1, edge: 1.05, soak: 1.02, bite: 1, hold: 1.05, note: '' },
  Willow: { difficulty: -3, weight: 0.78, wear: 1.12, decay: 1.12, edge: 0.94, soak: 0.9, bite: 1.08, hold: 0.95, note: '' },
  Cedar: { difficulty: 4, weight: 0.9, wear: 0.86, decay: 0.35, edge: 1, soak: 1, bite: 0.98, hold: 1, note: '' },
  // Orchard woods: little of them off any one tree, and all three are close
  // grained and hard for it.
  Apple: { difficulty: 3, weight: 1.18, wear: 0.74, decay: 0.95, edge: 1.08, soak: 1.1, hold: 1.06, bite: 1.02, note: '' },
  Cherry: { difficulty: 2, weight: 1.02, wear: 0.82, decay: 0.9, edge: 1.06, soak: 1.06, bite: 1.1, hold: 1.04, note: '' },
  Olive: { difficulty: 6, weight: 1.3, wear: 0.6, decay: 0.55, edge: 1.14, soak: 1.2, bite: 0.9, hold: 1.08, note: '' },
  // And the eight held to their islands, which are orchard woods too: close
  // grained, hard for their size, and little of any of them off one tree.
  Pear: { difficulty: 3, weight: 1.16, wear: 0.76, decay: 0.95, edge: 1.06, soak: 1.08, bite: 1.06, hold: 1.05, note: '' },
  Plum: { difficulty: 3, weight: 1.12, wear: 0.78, decay: 0.9, edge: 1.08, soak: 1.06, bite: 1.02, hold: 1.04, note: '' },
  Peach: { difficulty: 1, weight: 1, wear: 0.94, decay: 1.05, edge: 1.02, soak: 1, bite: 1.02, hold: 1, note: '' },
  Fig: { difficulty: 0, weight: 0.86, wear: 1.05, decay: 1.15, edge: 0.96, soak: 0.94, bite: 1, hold: 0.98, note: '' },
  Lemon: { difficulty: 2, weight: 1.06, wear: 0.86, decay: 0.85, edge: 1.04, soak: 1.04, bite: 1.04, hold: 1.02, note: '' },
  Pomegranate: { difficulty: 4, weight: 1.2, wear: 0.72, decay: 0.8, edge: 1.1, soak: 1.1, bite: 0.98, hold: 1.06, note: '' },
  Apricot: { difficulty: 2, weight: 1.08, wear: 0.84, decay: 0.9, edge: 1.06, soak: 1.04, bite: 1.04, hold: 1.02, note: '' },
  Quince: { difficulty: 3, weight: 1.14, wear: 0.78, decay: 0.92, edge: 1.06, soak: 1.06, bite: 1.02, hold: 1.04, note: '' },
};

/**
 * The fourteen metals. Copper is the workhorse everything starts in; tin,
 * zinc, lead and pewter are too soft to be anything but stock; silver and
 * gold are for show and for the things silver is good against; bronze and
 * brass are the first real step up; and the four out of the deep seams —
 * adamantine, glimmersteel, mithril and seryll — are what a lifetime of
 * mining is for.
 */
const METAL_PROPS: Record<string, Props> = {
  copper: { difficulty: 0, weight: 1, wear: 1, decay: 1, edge: 0.85, soak: 0.9, bite: 0.9, hold: 1, note: '' },
  iron: { difficulty: 2, weight: 1.1, wear: 0.75, decay: 1.35, edge: 1.12, soak: 1.12, bite: 1.1, hold: 1, note: '' },
  steel: { difficulty: 5, weight: 1.05, wear: 0.5, decay: 0.95, edge: 1.28, soak: 1.22, bite: 1.24, hold: 1, note: '' },
  tin: { difficulty: -2, weight: 0.85, wear: 1.5, decay: 1.1, edge: 0.5, soak: 0.55, bite: 0.6, hold: 1, note: '' },
  zinc: { difficulty: -1, weight: 0.9, wear: 1.4, decay: 1.05, edge: 0.55, soak: 0.6, bite: 0.65, hold: 1, note: '' },
  lead: { difficulty: -3, weight: 1.95, wear: 1.6, decay: 0.7, edge: 0.45, soak: 0.72, bite: 0.5, hold: 1, note: '' },
  silver: { difficulty: 4, weight: 1.2, wear: 1.2, decay: 0.45, edge: 0.9, soak: 0.86, bite: 0.86, hold: 1, bane: true, note: '' },
  gold: { difficulty: 7, weight: 2.1, wear: 1.5, decay: 0.15, edge: 0.6, soak: 0.75, bite: 0.6, hold: 1, note: '' },
  bronze: { difficulty: 1, weight: 1.05, wear: 0.85, decay: 0.8, edge: 1.06, soak: 1.06, bite: 1.06, hold: 1, note: '' },
  brass: { difficulty: 1, weight: 1.05, wear: 0.9, decay: 0.72, edge: 1, soak: 1, bite: 1, hold: 1, note: '' },
  pewter: { difficulty: -1, weight: 1, wear: 1.45, decay: 0.9, edge: 0.55, soak: 0.6, bite: 0.65, hold: 1, note: '' },
  electrum: { difficulty: 5, weight: 1.5, wear: 1.3, decay: 0.25, edge: 0.8, soak: 0.86, bite: 0.76, hold: 1, note: '' },
  adamantine: { difficulty: 10, weight: 0.75, wear: 0.35, decay: 0.15, edge: 1.45, soak: 1.25, bite: 1.3, hold: 1, note: '' },
  glimmersteel: { difficulty: 12, weight: 0.6, wear: 0.3, decay: 0.1, edge: 1.3, soak: 1.48, bite: 1.25, hold: 1, note: '' },
  mithril: { difficulty: 14, weight: 0.42, wear: 0.25, decay: 0.08, edge: 1.35, soak: 1.4, bite: 1.38, hold: 1, note: '' },
  seryll: { difficulty: 16, weight: 0.7, wear: 0.08, decay: 0.02, edge: 1.25, soak: 1.36, bite: 1.2, hold: 1, note: '' },
};

const wood = (name: string): MaterialDef => ({ id: name.toLowerCase(), name, kind: 'wood', ...(WOOD_PROPS[name] ?? WOOD_PROPS.Pine) });
const metal = (id: string, name: string): MaterialDef => ({ id, name, kind: 'metal', ...(METAL_PROPS[id] ?? METAL_PROPS.copper) });
/** A stone: nothing is made *of* one but the setting, and the rarer it is the harder it is to seat. Its line says what it favours. */
const gem = (g: GemDef): MaterialDef => ({ id: g.id, name: g.name, kind: 'gem', difficulty: 3 * (5 - g.weight), weight: 1, wear: 1, decay: 1, edge: 1, soak: 1, bite: 1, hold: 1, note: `Skill: ${tradeName(g.skill)}.` });

export const WOODS: MaterialDef[] = TREE_DEFS.map((t) => wood(t.name));
export const METAL_MATERIALS: MaterialDef[] = METALS.map((m) => metal(m.id, m.name));
export const GEM_MATERIALS: MaterialDef[] = GEMS.map(gem);
export const MATERIALS: MaterialDef[] = [...WOODS, ...METAL_MATERIALS, ...GEM_MATERIALS];
/** Anything that carries its own light (a Lume, an Embra) takes this many times the blow from a bane metal's edge. */
export const BANE_BONUS = 1.5;
/** Each multiplier a material carries, by what it multiplies, in the order the examine line says them. */
const NOTE_FACTORS: Array<[keyof Props, string]> = [
  ['weight', 'weight'], ['wear', 'wear'], ['decay', 'decay'], ['edge', 'weapon damage'],
  ['soak', 'armour soak'], ['bite', 'tool QL'], ['hold', 'capacity'],
];
/** A material's line, off its own numbers: every factor that is not ×1, its bane and the bow it is tillered into. */
function noteOf(m: MaterialDef): string {
  const parts: string[] = [];
  if (m.difficulty) parts.push(`difficulty ${m.difficulty > 0 ? '+' : ''}${+m.difficulty.toFixed(2)}`);
  for (const [k, label] of NOTE_FACTORS) if (m[k] !== 1) parts.push(`${label} ×${m[k]}`);
  if (m.bane) parts.push(`damage ×${BANE_BONUS} to glowing creatures`);
  const bows = Object.entries(BOW_WOOD).filter(([, w]) => w === m.name).map(([id]) => id.replace(/_/g, ' '));
  if (bows.length) parts.push(`bow wood: ${bows.join(', ')}`);
  const said = parts.join(', ');
  return `${said ? `${said[0].toUpperCase()}${said.slice(1)}.` : ''}${m.note ? `${said ? ' ' : ''}${m.note}` : ''}`;
}

/** Looked up by the name written on the item, which is how it is stored. */
const BY_NAME = new Map(MATERIALS.map((m) => [m.name.toLowerCase(), m]));
export const MATERIAL_BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

/** What a thing with nothing written on it is made of: nothing in particular. */
export const PLAIN: MaterialDef = { id: 'plain', name: '', kind: 'wood', difficulty: 0, weight: 1, wear: 1, decay: 1, edge: 1, soak: 1, bite: 1, hold: 1, note: '' };

/** The material an `extra` names, or null when it names something else. */
export function materialOf(extra: string | undefined): MaterialDef | null {
  return extra ? BY_NAME.get(extra.toLowerCase()) ?? null : null;
}

/** As materialOf, but never null: a thing of no particular stuff behaves as one. */
export const matOf = (extra: string | undefined): MaterialDef => materialOf(extra) ?? PLAIN;

/**
 * What an item is made of. Most things say so on the label; a lump says so by
 * being a lump of it, which is why its metal is read off the item id instead.
 */
export function materialOfItem(item: { id: string; extra?: string }): MaterialDef | null {
  const named = materialOf(item.extra);
  if (named) return named;
  // A lump says its metal in its name, and so does an ingot (a Smith's Ingots).
  const lump = METAL_BY_LUMP.get(item.id) ?? METAL_BY_INGOT.get(item.id);
  return lump ? MATERIAL_BY_ID.get(lump.id) ?? null : null;
}

export const matOfItem = (item: { id: string; extra?: string }): MaterialDef => materialOfItem(item) ?? PLAIN;

/** Whether an `extra` names a material of this kind. */
export const isMaterialKind = (extra: string | undefined, kind: MaterialKind): boolean => materialOf(extra)?.kind === kind;

/**
 * The wood each bow must be tillered from. A bow stave is not a plank: the
 * limbs want a wood that bends and comes back, and each length of bow wants a
 * different one. Nothing else in the game is this fussy about its material.
 */
export const BOW_WOOD: Record<string, string> = {
  short_bow: 'Willow',
  medium_bow: 'Birch',
  long_bow: 'Oak',
};
// Every material's line says what it is worth off its own numbers (`noteOf`).
for (const m of MATERIALS) m.note = noteOf(m);

/**
 * A tool's working quality is its own quality lifted or dragged by the metal
 * of its head. Kept inside a hundred, since a tool's quality is read
 * elsewhere as a chance out of a hundred.
 */
export const workingQl = (ql: number, extra: string | undefined): number => Math.min(100, ql * matOf(extra).bite);

/** How freely a body of this wood rolls: a light cart is a shade quicker. */
export const rollEase = (extra: string | undefined): number => 1 / (0.82 + matOf(extra).weight * 0.18);

/** What the material lends, for the examine window; empty for plain stuff. */
export function materialNote(extra: string | undefined): string {
  const m = materialOf(extra);
  return m ? `${m.name}: ${m.note}` : '';
}
