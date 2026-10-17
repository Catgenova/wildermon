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
import { DRESS_CHECK, dressingFor, healAmount, HERB_HEAL, SLIP_HEAL, SUITS_HEAL } from '../game/firstaid';
import type { Game } from '../game/game';
import { itemDef } from '../game/items';
import { balance, fedness, fedWord, NUTRIENT_HOURS, NUTRIENT_NAMES, NUTRIENT_NOTES, NUTRIENTS, tableMul, upkeepMul, type Nutrient } from '../game/nutrition';
import { PERKS } from '../game/perks';
import { RECIPE_BY_ID, type Recipe } from '../game/recipes';
import { SKILL_DEFS } from '../game/skills';
import { listed, percent } from '../game/words';
import {
  CLOSE_BARE, CLOSE_CLOTH, CLOSE_PACE, CLOSE_PER_SKILL, CLOSE_RIGHT, CLOSE_WRONG, FESTER_CLOTH, FESTER_WRONG, PART_NAMES, WOUND_KINDS,
  woundClose, woundDrain, woundKey, worstWound, type Wound,
} from '../game/wounds';
import { effectsOn, type Effect, type SpellsOnYou } from './effects';

/** The marks on the status panel this window shows as wounds instead (`effectsOn`). */
export const WOUND_EFFECTS = new Set(['bleed', 'venom', 'fester', 'burn', 'wounds']);

/** How far under the severity a wound closes and is gone (`tendWounds`, `wounds_settle`). */
const CLOSED_AT = 0.004;

/** A wound's state, worst first: what colours it and what its mark on the body does. */
export type WoundState = 'bad' | 'venom' | 'bleeding' | 'open' | 'dressed' | 'covered';

/** One thing that could be held for a care, ranked: what it is, what it does for this wound, and how many you carry. */
export interface CareOption {
  /** The item, for its picture: `cover`, `bandage`, `lye_bucket` or `salve`. */
  item: string;
  label: string;
  /** What it is, in a few words. */
  does: string;
  /** How much health it puts back on this wound at the QL it would go on at, as "16%", or null where that is not what it is for. */
  heals: string | null;
  /** How long this wound would take to close under it, as "~66 min", or null where that is not what it is for. */
  closes: string | null;
  /** How much of an open wound's chance of going bad is left under it, as "5%", or null. */
  turns: string | null;
  have: number;
  /** The one that would be used now. */
  chosen: boolean;
  /** The best there is for this wound. */
  best: boolean;
}

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
  /** What could be held for it, best first. */
  options: CareOption[];
  /** What it would use now, by name and quality, or null. */
  uses: { item: string; label: string; ql: number } | null;
  /** What it does, in numbers, with what it would use now. */
  effect: string | null;
  /** What comes of it when it takes and when it misses, with the chance of each. */
  odds: Array<{ ok: boolean; chance: string; text: string }>;
  /** How to make what it takes: each recipe, its inputs against what you carry, its tool and trade. */
  recipes: RecipeView[];
}

/** A recipe as the window shows it: what goes in against what you carry, the tool, the trade and its level. */
export interface RecipeView {
  title: string;
  inputs: Array<{ item: string; name: string; have: number; need: number }>;
  tool: { name: string; have: boolean } | null;
  skill: { name: string; level: number };
  makes: number;
  /** Who alone may make it, when not everybody may. */
  who: string | null;
}

/** Everything carried loose in the pack (not in a bag), which is where a treatment looks. */
const loose = (g: Game, id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);

function recipeView(g: Game, r: Recipe, title: string, who: string | null = null): RecipeView {
  return {
    title,
    inputs: r.inputs.map((i) => ({ item: i.item, name: itemDef(i.item).name, have: loose(g, i.item), need: i.count ?? 1 })),
    tool: r.tool ? { name: itemDef(r.tool).name, have: g.inventory.has(r.tool) } : null,
    skill: { name: SKILL_DEFS.find((d) => d.id === r.skill)?.name ?? r.skill, level: g.skills.get(r.skill) },
    makes: r.count ?? 1,
    who,
  };
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
  /** The same as words: "20% of a life". */
  depth: string;
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
  /** Seconds until health runs out at the losses as they are, or null while it is not running out. */
  emptyIn: number | null;
  /** The same as marks: a short figure for the chip, and its sentence. */
  rates: Array<{ kind: 'bad' | 'good' | 'still'; short: string; long: string; parts?: string[] }>;
  /** Your first aid and chirurgy, and what each does for you now. */
  hands: Array<{ name: string; level: number; does: string }>;
  /** How fast health comes back on its own while resting, and what that waits on, each met or not. */
  mend: { rate: string; needs: Array<{ ok: boolean; text: string }> };
  wounds: WoundView[];
  against: Effect[];
  forYou: Effect[];
  nutrition: Array<{ id: Nutrient; name: string; value: number; note: string }>;
  fed: string;
  /** Whether what you are eating wants seeing to: your lowest under 40%. */
  hungry: boolean;
  nutritionWords: string[];
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** A share of a life a minute, as a percentage, to a tenth where it is small. */
const perMinute = (x: number): string => {
  const p = x * 100;
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`;
};

/** A span in digits, as a clock would say it: "45s", "1m 52s", "12 min", "7 h". */
export function clockWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}
/** A share as a whole percentage, the way the bars show it. */
const whole = (x: number): string => `${Math.round(x * 100)}%`;

/** The next word up for how you are eating, and from what lowest (`fedWord`). */
const nextFed = (b: number): string => {
  const steps: Array<[number, string]> = [[0.15, 'living on scraps'], [0.4, 'eating plainly'], [0.7, 'eating well'], [0.95, 'wanting for nothing']];
  const up = steps.find(([at]) => b < at);
  return up ? ` · ${up[1]} from ${whole(up[0])}` : '';
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
    const clean = g.skillChance('first_aid', CLEAN_CHECK, lye?.ql ?? 0, g.mindEase());
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
      options: [{ item: 'lye_bucket', label: 'Bucket of lye', does: 'The lye is spent either way; you keep the bucket', heals: null, closes: null, turns: null, have: n, chosen: !!lye, best: true }],
      uses: lye ? { item: 'lye_bucket', label: 'bucket of lye', ql: lye.ql } : null,
      effect: null,
      odds: [
        { ok: true, chance: percent(clean), text: `Stops the −${perMinute(woundDrain(w) * 60)}/min and it can close; it then bleeds −${perMinute(woundDrain({ ...w, infected: false, bleeding: true }) * 60)}/min until dressed` },
        { ok: false, chance: percent(1 - clean), text: 'It stays gone bad' },
      ],
      recipes: r ? [recipeView(g, r, 'Bucket of lye')] : [],
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
  // Each kind at the best QL you carry of it, or, with none, at the QL of what would go on now.
  const aid = g.skills.get('first_aid');
  const topQl = (pick: (it: { id: string; extra?: string; ql: number }) => boolean): number =>
    g.inventory.items.filter(pick).reduce((m, it) => Math.max(m, it.ql), -1);
  const at = (q: number): number => (q >= 0 ? q : use?.item.ql ?? 50);
  const healsAt = (q: number, mul: number): string => percent(healAmount(aid, at(q)) * mul);
  const closesUnder = (d: string): string => {
    const t = closeTime(g, { ...w, dressing: d, bleeding: false });
    return t === null ? '–' : `~${clockWords(t)}`;
  };
  const herbOf = (it: { extra?: string }): string => (it.extra ?? '').toLowerCase();
  const rightQl = topQl((it) => it.id === 'cover' && herbOf(it) === k.herb);
  const otherQl = topQl((it) => it.id === 'cover' && herbOf(it) !== k.herb);
  const clothQl = topQl((it) => it.id === 'bandage');
  const otherHerb = Object.values(WOUND_KINDS).map((x) => x.herb).find((h) => h !== k.herb) ?? 'other';
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
      options: [
        { item: 'cover', label: `${capital(k.herb)} cover`, does: `Heals ${times(SUITS_HEAL)} a bandage's worth`, heals: healsAt(rightQl, SUITS_HEAL), closes: closesUnder(k.herb), turns: '0%', have: right, chosen: use?.herb === k.herb, best: true },
        { item: 'cover', label: 'Other cover', does: `Heals ${times(HERB_HEAL)} a bandage's worth`, heals: healsAt(otherQl, HERB_HEAL), closes: closesUnder(otherHerb), turns: percent(FESTER_WRONG), have: covers - right, chosen: !!use && use.herb !== '' && use.herb !== k.herb, best: false },
        { item: 'bandage', label: 'Bandage', does: 'Heals a bandage\'s worth', heals: healsAt(clothQl, 1), closes: closesUnder(''), turns: percent(FESTER_CLOTH), have: cloth, chosen: use?.herb === '', best: false },
      ],
      uses: use ? { item: use.herb ? 'cover' : 'bandage', label: use.herb ? `${use.herb} cover` : 'bandage', ql: use.item.ql } : null,
      effect: null,
      odds: use ? (() => {
        const healed = healAmount(aid, use.item.ql) * (use.herb === k.herb ? SUITS_HEAL : use.herb ? HERB_HEAL : 1);
        const ok = dressChance(g, use.item.ql);
        return [
          { ok: true, chance: percent(ok), text: `+${percent(healed)} health and ${w.bleeding ? 'the bleeding stops' : 'it is dressed'}` },
          { ok: false, chance: percent(1 - ok), text: `+${percent(healed * SLIP_HEAL)} health; the ${use.herb ? 'cover' : 'bandage'} is spent and ${w.bleeding ? 'it keeps bleeding' : 'it stays open'}` },
        ];
      })() : [],
      recipes: [
        ...(!right && coverR ? [recipeView(g, coverR, `${capital(k.herb)} cover`)] : []),
        ...(!use && clothR ? [recipeView(g, clothR, 'Bandages')] : []),
      ],
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
      options: [{ item: 'salve', label: 'Salve', does: 'Used up', heals: null, closes: null, turns: '0%', have: n, chosen: !!salve, best: true }],
      uses: salve ? { item: 'salve', label: 'salve', ql: salve.ql } : null,
      effect: 'Rubbed in over the dressing, the wound under it never goes bad.',
      odds: [],
      recipes: !n && r ? [recipeView(g, r, `Salve (any healing herb in place of the ${k.herb})`, salveMakers())] : [],
    });
  }
  return out;
}

/** The chance a dressing goes on cleanly: the first aid check, and a second chance for a Naturalist's Sure Hands (`sureCheck`). */
export function dressChance(g: Game, ql: number): number {
  const c = g.skillChance('first_aid', DRESS_CHECK, ql, g.mindEase());
  const fail = g.perk('fail:bind_wound', 1);
  return c + (1 - c) * (1 - fail);
}

/** How hard cleaning a wound out is (`clean_wound`, the island's `perform_fight`). */
export const CLEAN_CHECK = 26;

/** When a wound will have closed, in words: it closes faster the shallower it gets (`woundClose`). */
export function closesIn(g: Game, w: Wound): string {
  if (w.infected) return 'Not closing';
  const t = closeTime(g, w);
  if (!t) return 'Closing.';
  return `Closes in ~${clockWords(t)} as it is`;
}

/** How long until a wound has closed at its pace, in seconds (it closes faster the shallower it gets), or null when it is not closing. */
function closeTime(g: Game, w: Wound): number | null {
  if (w.infected) return null;
  const rate = woundClose(w, g.skills.get('chirurgy'));
  if (rate <= 0) return null;
  if (w.severity <= CLOSED_AT) return 0;
  return Math.log(w.severity / CLOSED_AT) / (rate / w.severity);
}

export function woundView(g: Game, w: Wound): WoundView {
  const k = WOUND_KINDS[w.kind];
  const deep = w.severity > 0.16 ? 'Deep' : w.severity > 0.07 ? '' : 'Light';
  const tags: string[] = [];
  const drain = woundDrain(w);
  if (w.infected) tags.push(`Gone bad: losing ${perMinute(drain * 60)} of your health a minute until it is cleaned out`);
  else if (w.bleeding) tags.push(`Bleeding: ${perMinute(drain * 60)} of your health a minute`);
  if ((w.venom ?? 0) > 0 && w.dressing === null) tags.push(`Venom: ${perMinute(VENOM_DRAIN * 60)} a minute for ${clockWords(w.venom ?? 0)}, or until dressed`);
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
    severity: Math.min(1, w.severity),
    depth: `${Math.round(w.severity * 100)}%`,
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
  const rates: HealthReport['rates'] = [];
  const say = (kind: 'bad' | 'good' | 'still', short: string, long: string, parts?: string[]): void => {
    rates.push({ kind, short, long, ...(parts ? { parts } : {}) });
    rateWords.push(long);
  };
  if (losing > 0) say('bad', `−${perMinute(losing)}/min`, `Losing ${perMinute(losing)} of your health a minute to your wounds.`);
  if (venom > 0) say('bad', `−${perMinute(venom)} venom to come`, `Venom will take ${perMinute(venom)} more of your health unless the wound is dressed.`);
  if (s.health >= 0.999 && !p.wounds.length) say('good', 'Whole', 'Whole and well.');
  else if (mending > 0) say('good', `+${perMinute(mending)}/min resting`, `Mending ${perMinute(mending)} a minute while you rest.`);
  else if (open || !fed) {
    const why = [
      ...(open ? ['Open wound'] : []),
      ...(s.hunger <= HEAL_FED ? [`Food ${Math.round(s.hunger * 100)}%, needs over ${percent(HEAL_FED)}`] : []),
      ...(s.thirst <= HEAL_FED ? [`Water ${Math.round(s.thirst * 100)}%, needs over ${percent(HEAL_FED)}`] : []),
    ];
    // Each reason kept on one line, so a narrow window breaks only between them.
    say('still', `Not mending: ${why.map((w) => w.replace(/ /g, '\u00a0')).join(' · ')}`,
      `Nothing mends while a wound bleeds, has venom in it or has gone bad, or while your food or water is at ${percent(HEAL_FED)} or under.`, why);
  }
  // At the losses as they are: the venom's share first, then the steady bleed.
  const emptyIn = losing > 0 ? Math.max(0, (s.health - venom) / (losing / 60)) : venom >= s.health ? 0 : null;
  const aid = g.skills.get('first_aid'), chir = g.skills.get('chirurgy');
  const hands = [
    { name: 'First aid', level: aid, does: `Dressings heal ${percent(healAmount(aid, 0)).replace('%', '')}–${percent(healAmount(aid, 100))} by QL` },
    { name: 'Chirurgy', level: chir, does: `Wounds close +${percent((CLOSE_PACE + chir * CLOSE_PER_SKILL) / CLOSE_PACE - 1)} faster` },
  ];
  const n = p.nutrition;
  const lowest = NUTRIENTS.reduce((a, b) => (n[b] < n[a] ? b : a));
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
    rates,
    emptyIn,
    hands,
    mend: {
      rate: `Resting, you mend ${perMinute(HEAL_RATE * 60)} a minute when all of these are met:`,
      needs: [
        { ok: !open, text: `No wound bleeding, with venom in it or gone bad (now ${p.wounds.filter((w) => w.bleeding || w.infected || ((w.venom ?? 0) > 0 && w.dressing === null)).length})` },
        { ok: s.hunger > HEAL_FED, text: `Food over ${percent(HEAL_FED)} (now ${Math.round(s.hunger * 100)}%)` },
        { ok: s.thirst > HEAL_FED, text: `Water over ${percent(HEAL_FED)} (now ${Math.round(s.thirst * 100)}%)` },
      ],
    },
    wounds: ranked.map((w) => woundView(g, w)),
    against: effects.filter((e) => !e.good && !WOUND_EFFECTS.has(e.id)),
    forYou: effects.filter((e) => e.good),
    nutrition: NUTRIENTS.map((id) => ({ id, name: NUTRIENT_NAMES[id], value: n[id], note: NUTRIENT_NOTES[id] })),
    fed: `${capital(fedWord(n))} · lowest ${whole(n[lowest])}${nextFed(balance(n))}`,
    hungry: balance(n) < 0.4,
    nutritionWords: [
      `Food and water fall ${percent(1 - upkeepMul(n))} slower (by the average of the four, ${whole(fedness(n))}).`,
      `Skills rise ${percent(tableMul(n, g.tableBest()) - 1)} faster (by your lowest, ${NUTRIENT_NAMES[lowest]} ${whole(n[lowest])}).`,
      `Each empties in ${clockWords(NUTRIENT_HOURS)} without the food that feeds it.`,
    ],
  };
}
