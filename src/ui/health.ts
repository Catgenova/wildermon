/**
 * What the Health window says, worked out from the game and nothing else, so
 * it can be read in a test as well as drawn (`src/ui/panels/health.ts`).
 *
 * Asked: a window for health where the ailments are listed, nutrition can be
 * read, and a wound is clicked to be bandaged, cleaned or salved, saying
 * plainly what has to be carried for each. Every figure here is the rule's
 * own (`wounds.ts`, `body.ts`, `nutrition.ts`), and every refusal is the
 * action's own check, asked of the very target the button would send.
 */
import { ACTION_BY_ID, type ActionDef, type Target } from '../game/actions';
import { HEAL_FED, HEAL_RATE } from '../game/body';
import { CLASSES } from '../game/classes';
import { VENOM_DRAIN } from '../game/fight';
import { dressingFor } from '../game/firstaid';
import type { Game } from '../game/game';
import { itemDef } from '../game/items';
import { fedWord, NUTRIENT_HOURS, NUTRIENT_NAMES, NUTRIENT_NOTES, NUTRIENTS, tableMul, upkeepMul, type Nutrient } from '../game/nutrition';
import { PERKS } from '../game/perks';
import { RECIPE_BY_ID, type Recipe } from '../game/recipes';
import { SKILL_DEFS } from '../game/skills';
import { listed, percent, spanWords } from '../game/words';
import {
  CLOSE_BARE, CLOSE_CLOTH, CLOSE_RIGHT, CLOSE_WRONG, FESTER_CLOTH, FESTER_WRONG, PART_NAMES, WOUND_KINDS,
  woundClose, woundDrain, woundKey, worstWound, type Wound,
} from '../game/wounds';
import { effectsOn, type Effect, type SpellsOnYou } from './effects';

/** The marks on the status panel this window shows as wounds instead (`effectsOn`). */
export const WOUND_EFFECTS = new Set(['bleed', 'venom', 'fester', 'burn', 'wounds']);

/** How far under the severity a wound closes and is gone (`tendWounds`, `wounds_settle`). */
const CLOSED_AT = 0.004;

/** A wound's state, worst first: what colours it and what its mark on the body does. */
export type WoundState = 'bad' | 'venom' | 'bleeding' | 'open' | 'dressed' | 'covered';

/** One way to see to a wound: what it is, what has to be carried for it, and the ask, or why it cannot be asked. */
export interface Care {
  id: 'bind_wound' | 'clean_wound' | 'apply_salve';
  /** The heading, and the button's word. */
  title: string;
  button: string;
  /** What has to be held, and what it does. */
  needs: string;
  /** What you carry of it, and what would go on. */
  have: string;
  /** Whether you carry what it takes. */
  holding: boolean;
  /** How to come by it, when you have none. */
  make: string | null;
  /** The ask the button sends, when there is something in the pack to send it with. */
  target: Target | null;
  /** Why it cannot be done now (the action's own check), or null. */
  why: string | null;
}

export interface WoundView {
  wound: Wound;
  key: string;
  state: WoundState;
  /** "Deep cut", "Light bruise". */
  title: string;
  part: string;
  /** Share of a life left to close, 0..1, for the bar. */
  severity: number;
  /** "Bleeding: 0.4% of your health a minute", and the like. */
  tags: string[];
  /** When it will be closed, in words, or why it will not. */
  eta: string;
  cares: Care[];
}

export interface HealthReport {
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  /** Health lost a minute to wounds, as a share of a life. */
  losing: number;
  /** Health the venom in you will take before it runs out or is dressed, as a share of a life. */
  venom: number;
  /** Health mended a minute while you rest, when it can be, else 0. */
  mending: number;
  /** What the line under the heart says about both. */
  rateWords: string[];
  wounds: WoundView[];
  against: Effect[];
  forYou: Effect[];
  nutrition: Array<{ id: Nutrient; name: string; value: number; note: string }>;
  fed: string;
  nutritionWords: string[];
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** A share of a life a minute, as a percentage, to a tenth where it is small. */
const perMinute = (x: number): string => {
  const p = x * 100;
  return `${p >= 10 ? Math.round(p) : Number(p.toFixed(1))}%`;
};
/** A multiplier said as "6.4×". */
const times = (x: number): string => `${Number(x.toFixed(1))}×`;

/** An item's name, lower case, as a recipe says it. */
const named = (id: string): string => itemDef(id).name.toLowerCase();

/** "from 2 thyme and 1 cotton, by first aid; makes 3": what a recipe takes, from the recipe. */
export function recipeWords(r: Recipe): string {
  const parts = r.inputs.map((i) => `${i.count ?? 1} ${named(i.item)}`);
  const tool = r.tool ? ` with a ${named(r.tool)}` : '';
  const trade = (SKILL_DEFS.find((d) => d.id === r.skill)?.name ?? r.skill).toLowerCase();
  return `from ${listed(parts)}${tool}, by ${trade}; makes ${r.count ?? 1}`;
}

/** Who may make a salve: the perks that give the recipe, by trade and name. */
function salveMakers(): string {
  const by = PERKS.filter((p) => p.fx.salve).map((p) => `a ${CLASSES.find((c) => c.id === p.class)?.name ?? p.class} with ${p.name}`);
  return by.length ? listed(by) : 'nobody';
}

/** How many of a thing you carry, and of covers, how many of one herb. */
const carried = (g: Game, id: string, herb?: string): number =>
  g.inventory.items.filter((it) => it.id === id && (herb === undefined || (it.extra ?? '').toLowerCase() === herb)).reduce((n, it) => n + it.count, 0);

/** The state a wound shows as. */
export function woundState(w: Wound): WoundState {
  if (w.infected) return 'bad';
  if ((w.venom ?? 0) > 0 && w.dressing === null) return 'venom';
  if (w.bleeding) return 'bleeding';
  if (w.dressing === null) return 'open';
  return w.dressing === WOUND_KINDS[w.kind].herb ? 'covered' : 'dressed';
}

/** The action as the button would ask it, and its refusal for that very target. */
function ask(g: Game, def: ActionDef | undefined, target: Target | null): string | null {
  if (!def) return 'That cannot be done here.';
  if (!target) return null;
  return def.check?.(target, g) ?? null;
}

/** The ways to see to one wound, in the order they are wanted. */
export function caresFor(g: Game, w: Wound): Care[] {
  const k = WOUND_KINDS[w.kind];
  const key = woundKey(w);
  const out: Care[] = [];
  if (w.infected) {
    // Gone bad: nothing holds on it until the lye has been through it.
    const lye = g.inventory.find('lye_bucket');
    const n = carried(g, 'lye_bucket');
    const target: Target | null = lye ? { kind: 'item', uid: lye.uid, wound: key } : null;
    const r = RECIPE_BY_ID.get('make_lye');
    out.push({
      id: 'clean_wound',
      title: 'Clean it out',
      button: 'Clean',
      needs: 'Held: a bucket of lye. It scours the wound clean, so it stops taking health and can close again; it is left open and bleeding, ready to be dressed.',
      have: n ? `You carry ${n} ${n === 1 ? 'bucket' : 'buckets'} of lye.` : 'You carry no lye.',
      holding: n > 0,
      make: n ? null : r ? `Lye: ${recipeWords(r)}.` : null,
      target,
      why: target ? ask(g, ACTION_BY_ID.get('clean_wound'), target) : 'You need a bucket of lye to clean it out with.',
    });
    return out;
  }
  // A dressing: the herb that suits it, any herb, or cloth.
  const use = dressingFor(g, w);
  const right = carried(g, 'cover', k.herb), covers = carried(g, 'cover'), cloth = carried(g, 'bandage');
  const target: Target | null = use ? { kind: 'item', uid: use.item.uid, wound: key } : null;
  const why = target ? ask(g, ACTION_BY_ID.get('bind_wound'), target) : 'You have nothing to dress it with.';
  const have: string[] = [];
  if (right) have.push(`${right} ${k.herb} ${right === 1 ? 'cover' : 'covers'}`);
  if (covers - right) have.push(`${covers - right} other ${covers - right === 1 ? 'cover' : 'covers'}`);
  if (cloth) have.push(`${cloth} ${cloth === 1 ? 'bandage' : 'bandages'}`);
  const makes: string[] = [];
  const coverR = RECIPE_BY_ID.get(`make_cover_${k.herb}`), clothR = RECIPE_BY_ID.get('make_bandage');
  if (!right && coverR) makes.push(`${capital(k.herb)} cover: ${recipeWords(coverR)}.`);
  if (!use && clothR) makes.push(`Bandages: ${recipeWords(clothR)}.`);
  const dressed = w.dressing !== null;
  // Only while a dressing out of the pack would close it faster than what is on it.
  if (!dressed || why === null || w.dressing !== k.herb) {
    out.push({
      id: 'bind_wound',
      title: dressed ? 'Dress it better' : 'Dress it',
      button: 'Dress',
      needs: `Held: a dressing. A ${k.herb} cover suits a ${k.name}: it closes it ${times(CLOSE_RIGHT / CLOSE_BARE)} as fast as left open and it cannot go bad. `
        + `Any other cover closes it ${times(CLOSE_WRONG / CLOSE_BARE)} as fast and leaves ${percent(FESTER_WRONG)} of the chance of going bad; `
        + `a bandage ${times(CLOSE_CLOTH / CLOSE_BARE)}, leaving ${percent(FESTER_CLOTH)}. A clean dressing also stops the bleeding and puts health back.`,
      have: (have.length ? `You carry ${listed(have)}.` : 'You carry no dressings.')
        + (use ? ` It would take your ${use.herb ? `${use.herb} cover` : 'bandage'} (QL ${use.item.ql.toFixed(0)}).` : ''),
      holding: !!use,
      make: makes.length ? makes.join(' ') : null,
      target,
      why,
    });
  }
  // A salve over a dressing that is not the herb that suits it, so it cannot go bad.
  if (dressed && w.dressing !== k.herb) {
    const salve = g.inventory.find('salve');
    const n = carried(g, 'salve');
    const st: Target | null = salve ? { kind: 'item', uid: salve.uid, wound: key } : null;
    const r = RECIPE_BY_ID.get(`make_salve_${k.herb}`);
    out.push({
      id: 'apply_salve',
      title: 'Rub in a salve',
      button: 'Salve',
      needs: 'Held: a salve. Rubbed in over the dressing, the wound under it never goes bad.',
      have: n ? `You carry ${n} ${n === 1 ? 'salve' : 'salves'}.` : 'You carry no salve.',
      holding: n > 0,
      make: n ? null : r ? `Salve: made only by ${salveMakers()}, ${recipeWords(r)}. Any healing herb will do in place of the ${k.herb}.` : null,
      target: st,
      why: st ? ask(g, ACTION_BY_ID.get('apply_salve'), st) : 'You have no salve.',
    });
  }
  return out;
}

/** When a wound will have closed, in words: it closes faster the shallower it gets (`woundClose`). */
export function closesIn(g: Game, w: Wound): string {
  if (w.infected) return 'Not closing: it has gone bad. Clean it out.';
  const rate = woundClose(w, g.skills.get('chirurgy'));
  if (rate <= 0 || w.severity <= CLOSED_AT) return 'Closing.';
  const k = rate / w.severity;
  return `Closes in about ${spanWords(Math.log(w.severity / CLOSED_AT) / k)} as it is.`;
}

export function woundView(g: Game, w: Wound): WoundView {
  const k = WOUND_KINDS[w.kind];
  const deep = w.severity > 0.16 ? 'Deep' : w.severity > 0.07 ? '' : 'Light';
  const tags: string[] = [];
  const drain = woundDrain(w);
  if (w.infected) tags.push(`Gone bad: losing ${perMinute(drain * 60)} of your health a minute until it is cleaned out`);
  else if (w.bleeding) tags.push(`Bleeding: ${perMinute(drain * 60)} of your health a minute`);
  if ((w.venom ?? 0) > 0 && w.dressing === null) tags.push(`Venom: ${perMinute(VENOM_DRAIN * 60)} a minute for ${spanWords(w.venom ?? 0)}, or until dressed`);
  if (w.dressing === k.herb) tags.push(`Under ${k.herb}, which suits it`);
  else if (w.dressing === '') tags.push('Bound with cloth');
  else if (w.dressing) tags.push(`Under ${w.dressing}, which does not suit it`);
  else if (!w.infected) tags.push('Open');
  if (w.salved) tags.push('Salved: it will not go bad');
  return {
    wound: w,
    key: woundKey(w),
    state: woundState(w),
    title: deep ? `${deep} ${k.name}` : capital(k.name),
    part: PART_NAMES[w.part] ?? w.part,
    severity: Math.min(1, w.severity / 0.3),
    tags,
    eta: closesIn(g, w),
    cares: caresFor(g, w),
  };
}

export function healthReport(g: Game, spells: SpellsOnYou): HealthReport {
  const p = g.player;
  const s = p.stats;
  const wounds = [...p.wounds];
  // Worst first: the one worth seeing to.
  const ranked: Wound[] = [];
  while (wounds.length) {
    const w = worstWound(wounds) as Wound;
    ranked.push(w);
    wounds.splice(wounds.indexOf(w), 1);
  }
  const losing = p.wounds.reduce((n, w) => n + woundDrain(w), 0) * 60;
  const venom = p.wounds.reduce((n, w) => n + (w.dressing === null ? VENOM_DRAIN * Math.max(0, w.venom ?? 0) : 0), 0);
  const fed = s.hunger > HEAL_FED && s.thirst > HEAL_FED;
  const open = g.bleeding();
  const mending = s.health < 1 && fed && !open ? HEAL_RATE * 60 : 0;
  const rateWords: string[] = [];
  if (losing > 0) rateWords.push(`Losing ${perMinute(losing)} a minute to your wounds.`);
  if (venom > 0) rateWords.push(`Venom will take ${perMinute(venom)} more unless the wound is dressed.`);
  if (s.health >= 0.999 && !p.wounds.length) rateWords.push('Whole and well.');
  else if (mending > 0) rateWords.push(`Mending ${perMinute(mending)} a minute while you rest.`);
  else if (open) rateWords.push('Nothing mends while a wound bleeds, has venom in it or has gone bad.');
  else if (!fed) rateWords.push(`Nothing mends while your food or water is at ${percent(HEAL_FED)} or under.`);
  const n = p.nutrition;
  const effects = effectsOn(g, spells);
  return {
    health: s.health,
    stamina: s.stamina,
    hunger: s.hunger,
    thirst: s.thirst,
    losing,
    venom,
    mending,
    rateWords,
    wounds: ranked.map((w) => woundView(g, w)),
    against: effects.filter((e) => !e.good && !WOUND_EFFECTS.has(e.id)),
    forYou: effects.filter((e) => e.good),
    nutrition: NUTRIENTS.map((id) => ({ id, name: NUTRIENT_NAMES[id], value: n[id], note: NUTRIENT_NOTES[id] })),
    fed: capital(fedWord(n)),
    nutritionWords: [
      `Food and water go down ${percent(1 - upkeepMul(n))} slower for how well fed you are, the average of the four.`,
      `Skills rise ${percent(tableMul(n, g.tableBest()) - 1)} faster for how balanced your meals are, the least of the four.`,
      `Each runs from full to empty over ${spanWords(NUTRIENT_HOURS)} unless you eat what feeds it.`,
    ],
  };
}
