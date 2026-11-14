/**
 * Skill gates: the one rule for what a skill level opens.
 *
 * A thing has at most one gate, a skill and a level (`SkillGate`). Under it the thing is refused, for a person and for a
 * worker alike; at it, allowed. Every gate is held here, once, and the island has the same table (`skill_gate`, emitted
 * by `npm run defs` from `SKILL_GATES`), the same check (`gate_refusal`) and the same words (`gateRefusal`):
 *
 *   "Willow: needs woodcutting 70; have 12.4."
 *
 * which is the form mining has always refused a seam in. A menu shows a gated action greyed with those words as its
 * hint (the context menu does that for any refusal); the Skills window lists each skill's gates, ticked or not
 * (`unlocksOf`, `unlocksSaid`); the help says them per skill off the same list.
 *
 * A worker uses the same gate against its own level in the task's skill: it never picks the thing its level could not
 * work, and an idle one with only gated work in reach says so (`IdleWhy` 'gate', the island's `gate_idle`).
 *
 * Levels sit on `GATE_LADDER`, so gates land on few steps a player can learn. See docs/gating.md for the whole table
 * this is the start of: only tree felling is on it yet.
 *
 * A leaf: game, UI, defs and tests read it.
 */
import { SKILL_BY_ID } from './skills';
import { TREE_DEFS, treeAge, treeSpecies } from '../world/tiles';

/** The steps a gate's level is chosen from. */
export const GATE_LADDER = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export type GateLevel = (typeof GATE_LADDER)[number];

/** What sort of thing a gate is on, which with `id` keys it: a tree species by its lower-case name. */
export type GateKind = 'tree';

/** What a gate of each kind stops, as the help says it. */
export const GATE_STOPS: Readonly<Record<GateKind, string>> = {
  tree: 'felling a tree with logs: Cut down, Coppice, a feller\'s work',
};

export interface SkillGate {
  kind: GateKind;
  /** The thing within its kind: a tree's lower-case name. */
  id: string;
  /** Its name as the game says it: "Willow". */
  name: string;
  skill: string;
  level: GateLevel;
}

/**
 * Felling a tree that has logs in it (Cut down, Coppice; a feller's work), by woodcutting. Asked for: pine least,
 * birch, oak and maple early, willow most. The rest by their wood's difficulty (`materials.ts`): 0-1 at 20, 2 at 30,
 * 3 at 40, 4-5 at 50, 6 at 60. A tree with no logs yet is cleared by anybody.
 */
export const TREE_GATE: Readonly<Record<string, GateLevel>> = {
  Pine: 1,
  Birch: 5,
  Oak: 10,
  Maple: 20,
  Fig: 20,
  Peach: 20,
  Cherry: 30,
  Lemon: 30,
  Apricot: 30,
  Apple: 40,
  Pear: 40,
  Plum: 40,
  Quince: 40,
  Cedar: 50,
  Pomegranate: 50,
  Olive: 60,
  Willow: 70,
};

/** Every gate, in skill then level then name order. */
export const SKILL_GATES: readonly SkillGate[] = [
  ...TREE_DEFS.map((t): SkillGate => {
    const level = TREE_GATE[t.name];
    if (level === undefined) throw new Error(`${t.name}: no woodcutting gate`);
    return { kind: 'tree', id: t.name.toLowerCase(), name: t.name, skill: 'woodcutting', level };
  }),
].sort((a, b) => a.skill.localeCompare(b.skill) || a.level - b.level || a.name.localeCompare(b.name));

for (const g of SKILL_GATES) {
  if (!GATE_LADDER.includes(g.level)) throw new Error(`${g.kind} ${g.id}: ${g.level} is not on the ladder`);
  if (!SKILL_BY_ID.has(g.skill)) throw new Error(`${g.kind} ${g.id}: no skill ${g.skill}`);
}

const BY_KEY = new Map(SKILL_GATES.map((g) => [`${g.kind}:${g.id}`, g]));

/** The gate on a thing, or undefined: it is open to all. The island's `skill_gate`. */
export const gateOf = (kind: GateKind, id: string): SkillGate | undefined => BY_KEY.get(`${kind}:${id}`);

/** A skill as the refusal says it: "animal husbandry". */
export const skillWord = (skill: string): string => (SKILL_BY_ID.get(skill)?.name ?? skill.replace(/_/g, ' ')).toLowerCase();

/**
 * The one refusal: null at or over the level, else "Willow: needs woodcutting 70; have 12.4." The island's
 * `gate_refusal`, word for word.
 */
export const gateRefusal = (name: string, skill: string, have: number, need: number): string | null =>
  have >= need ? null : `${name}: needs ${skillWord(skill)} ${need}; have ${have.toFixed(1)}.`;

/** A thing's refusal for somebody at `have` in its gate's skill (`haveOf`), or null for none. */
export const gatedFor = (kind: GateKind, id: string, haveOf: (skill: string) => number): string | null => {
  const g = gateOf(kind, id);
  return g ? gateRefusal(g.name, g.skill, haveOf(g.skill), g.level) : null;
};

/** The felling gate on a tree tile's data, or undefined for a tree with no logs in it: those anybody clears. */
export const treeGate = (data: number): SkillGate | undefined =>
  treeAge(data).logs > 0 ? gateOf('tree', TREE_DEFS[treeSpecies(data)].name.toLowerCase()) : undefined;

/** Whether a worker at `skill` in a gate's skill may work it: the same rule as a person's. */
export const gateOpen = (g: SkillGate | undefined, skill: number): boolean => !g || skill >= g.level;

/* ---- What a skill opens, for the Skills window and the help ----------------------------------------------------- */

/** One gate on a skill as the Skills window lists it: met or not at a level. */
export interface Unlock {
  name: string;
  level: number;
  met: boolean;
}

/** A skill's gates in level order, each met or not at `have`. */
export const unlocksOf = (skill: string, have: number): Unlock[] =>
  SKILL_GATES.filter((g) => g.skill === skill).map((g) => ({ name: g.name, level: g.level, met: have >= g.level }));

/** Whether a skill has any gate on it. */
export const hasUnlocks = (skill: string): boolean => SKILL_GATES.some((g) => g.skill === skill);

/** The next of a skill's gates: "Next: Birch at 5 (yours 1.0)", or null with every one met. */
export const nextUnlockSaid = (skill: string, have: number): string | null => {
  const next = unlocksOf(skill, have).find((u) => !u.met);
  return next ? `Next: ${next.name} at ${next.level} (yours ${have.toFixed(1)})` : null;
};

/** A skill's gates grouped by level, for the help: "Pine 1; Birch 5; Oak 10; Fig, Maple and Peach 20". */
export const unlocksSaid = (skill: string): string => {
  const rungs = new Map<number, string[]>();
  for (const g of SKILL_GATES.filter((x) => x.skill === skill)) rungs.set(g.level, [...(rungs.get(g.level) ?? []), g.name]);
  const and = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  return [...rungs].map(([level, names]) => `${and(names)} ${level}`).join('; ');
};

/** The skills with gates, in the order the Skills window lists skills. */
export const GATED_SKILLS: readonly string[] = [...new Set(SKILL_GATES.map((g) => g.skill))];
