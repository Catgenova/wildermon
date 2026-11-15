/**
 * A skill check's chance, and the one term that cost a failed one the most.
 *
 * The island rolls every check (`skill_check`) and, when one fails, names on
 * the failure line the term that cost it most (`fail_why`, `fail_factor`):
 * each term moved to its best with the others held, the one whose best would
 * have added most to the chance. This is the same reckoning, for the odds the
 * browser shows on hover; `failwhy.ts` in the tests holds the two together.
 */
import { CHAR_START, QL_TOP } from './limits';
import { SKILL_BY_ID, SKILL_TOP } from './skills';

/** Difficulty mind logic takes off a thinking check for every level over the starting mark (`mind_ease`); never more than half the check's. */
export const MIND_EASE_PER_LEVEL = 0.2;
/** The difficulty mind logic at this level takes off a check that takes it (`mind_ease_at`). */
export const mindEaseAt = (mind: number): number => Math.max(0, (mind - CHAR_START) * MIND_EASE_PER_LEVEL);

/** A check's chance, between 30% and 98% (`skill_odds`): skill and tool add, difficulty (less what mind logic eases, at most half) takes away. */
export const skillOdds = (skill: number, difficulty: number, toolQl = 0, ease = 0): number => {
  const d = ease > 0 ? Math.max(difficulty * 0.5, difficulty - ease) : difficulty;
  return Math.min(0.98, Math.max(0.3, 0.6 + (skill / 100) * 0.38 + toolQl / 500 - d / 150));
};

/** A term is named only when its best would have added this much to the chance (`fail_least`). */
export const FAIL_LEAST = 0.01;

/** The terms a failure line may name, each with its best, in the order a tie goes (`fail_factor_label`). */
export const FAIL_FACTORS = [
  { id: 'skill', label: 'skill', top: SKILL_TOP },
  { id: 'tool', label: 'tool QL', top: QL_TOP },
  { id: 'material', label: 'material difficulty', top: 0 },
  { id: 'mind', label: SKILL_BY_ID.get('mind_logic')?.name ?? 'mind_logic', top: SKILL_TOP },
] as const;
/** The jobs whose failure line names its biggest factor, besides every craft with a difficulty (`fail_why`). */
export const FAIL_WHY_JOBS: readonly string[] = [
  'cut_down', 'coppice', 'collect', 'dig', 'dig_tile', 'dig_cellar', 'dig_stump', 'mine', 'mine_outcrop', 'mine_cellar',
  'lay_steps', 'lay_timber_steps', 'raise_rock', 'rubble_fill', 'dredge', 'prune', 'graft', 'improve_item',
];
export type FailFactorId = (typeof FAIL_FACTORS)[number]['id'];

/** What a check was rolled at. `tool` 0 is no tool; `material` the difficulty its material adds; `mind` mind logic, where the check takes it. */
export interface CheckAt {
  skill: number;
  difficulty: number;
  tool?: number;
  ease?: number;
  /** The share of failures a perk lets stand (`perk_pass`): 1 with none. */
  fail?: number;
  material?: number;
  mind?: number | null;
}

export interface FailFactor {
  id: FailFactorId;
  /** The term's own number: the skill, the tool's QL, the material's difficulty, the mind logic. */
  n: number;
  /** What its best would have added to the chance, 0 to 1. */
  cost: number;
}

/** The term that cost the check most against its best, the others held; null when none cost `FAIL_LEAST` (`fail_factor`). */
export const failFactor = (c: CheckAt): FailFactor | null => {
  const tool = c.tool ?? 0, ease = c.ease ?? 0, fail = c.fail ?? 1, mat = c.material ?? 0;
  const now = skillOdds(c.skill, c.difficulty, tool, ease);
  const terms: Array<[FailFactorId, number, number] | null> = [
    ['skill', c.skill, skillOdds(SKILL_TOP, c.difficulty, tool, ease)],
    tool > 0 ? ['tool', tool, skillOdds(c.skill, c.difficulty, QL_TOP, ease)] : null,
    mat > 0 ? ['material', mat, skillOdds(c.skill, c.difficulty - mat, tool, ease)] : null,
    c.mind != null ? ['mind', c.mind, skillOdds(c.skill, c.difficulty, tool, mindEaseAt(SKILL_TOP))] : null,
  ];
  let top: FailFactor | null = null;
  for (const t of terms) {
    if (!t) continue;
    const cost = fail * (t[2] - now);
    if (cost >= FAIL_LEAST && (!top || cost > top.cost)) top = { id: t[0], n: t[1], cost };
  }
  return top;
};

/** Rounded as the island rounds it: half up (`floor(x + 0.5)`). */
const whole = (x: number): number => Math.floor(x + 0.5);

/** " Biggest factor: tool QL 12 (−18%).", or nothing (`fail_factor_said`). */
export const failFactorSaid = (f: FailFactor | null): string => {
  if (!f) return '';
  const label = FAIL_FACTORS.find((d) => d.id === f.id)?.label ?? f.id;
  return ` Biggest factor: ${label} ${whole(f.n)} (−${whole(f.cost * 100)}%).`;
};

/** The help's and What's new's example: a Cut down at this woodcutting, with a hatchet of this QL. */
export const FAIL_EXAMPLE_AT = { skill: 90, tool: 5 } as const;
