import { tryGain } from './learn';
import type { ActionDef, Target } from './actions';
import { furnitureName, holdsLiquid, litresIn, type LiquidKind, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeWith, itemDef } from './items';
import { world } from './pace';

/**
 * Brewing. Fill a barrel with water, tip in what you have grown or gathered,
 * and leave it alone. It works for as long as its `time` says -- from ale,
 * the quickest, to wine, the slowest -- and nothing can hurry it. What comes out
 * is drawn off into a bucket like any other liquid and drunk from that, and
 * every one of them favours a trade far harder than any food does.
 */
export interface BrewDef {
  /** The liquid it becomes. */
  id: LiquidKind;
  name: string;
  /** What goes in besides the water, and how much of it. */
  input: string;
  count: number;
  /** Litres of water it wants, which is what you get back out. */
  litres: number;
  /** Seconds it works for. */
  time: number;
  /** How hard it is to set going right. */
  difficulty: number;
  done: string;
  /** How it gets better kept in its barrel after it stops working (`ageing.ts`); absent on a brew that does not. */
  ages?: Ageing;
}

/**
 * How a brew that ages gets better in its barrel (`ageing.ts`): `rate` QL for
 * every day of the island's year it is kept out of a cellar, and never more
 * than `cap` QL over what it was brewed at.
 */
export interface Ageing {
  rate: number;
  cap: number;
}

/** Wine's, cherry or grape. */
export const WINE_AGEING: Ageing = { rate: 0.25, cap: 10 };
/** Mead's: slower than wine, and further. */
export const MEAD_AGEING: Ageing = { rate: 0.2, cap: 12 };

/** What one go at a brew teaches, whichever way it comes out. */
export const BREW_GAIN = 0.6;

/** Grapes off a vine (`vineyard.ts`) a barrel of grape wine takes. */
export const GRAPE_WINE_GRAPES = 24;

export const BREWS: BrewDef[] = [
  { id: 'ale', name: 'Ale', input: 'wheat', count: 12, litres: 15, time: world(15 * 60), difficulty: 12, done: 'Brewing: ale.' },
  { id: 'cider', name: 'Cider', input: 'apple', count: 20, litres: 15, time: world(30 * 60), difficulty: 18, done: 'Brewing: cider.' },
  { id: 'mead', name: 'Mead', input: 'honey', count: 12, litres: 15, time: world(40 * 60), difficulty: 24, done: 'Brewing: mead.', ages: MEAD_AGEING },
  { id: 'wine', name: 'Wine', input: 'cherry', count: 30, litres: 15, time: world(45 * 60), difficulty: 30, done: 'Brewing: wine.', ages: WINE_AGEING },
  { id: 'grape_wine', name: 'Grape wine', input: 'grape', count: GRAPE_WINE_GRAPES, litres: 15, time: world(45 * 60), difficulty: 30, done: 'Brewing: grape wine.', ages: WINE_AGEING },
];

export const BREW_BY_ID = new Map(BREWS.map((b) => [b.id, b]));
// How long a brew works, for a drink's text to say: `{brew.wine.time:span}`.
describeWith({ brew: Object.fromEntries(BREWS.map((b) => [b.id, b])) });
/*
 * What a spirit's knack is measured against, for its text to say: the brews
 * that are as strong a drink as it is, whose knack its own multiplies. A
 * weaker brew's is shorter still, so "as long as a brew's" would be wrong for
 * those.
 */
const asStrong = BREWS.filter((b) => itemDef(`${b.id}_bucket`).drink === itemDef('spirit_bucket').drink).map((b) => b.name.toLowerCase());
describeWith({ spirit: { asStrong: asStrong.length < 2 ? (asStrong[0] ?? '') : `${asStrong.slice(0, -1).join(', ')} or ${asStrong[asStrong.length - 1]}` } });
/** A brew, or the spirit a Cook distils out of one: what favours a trade drunk out of a barrel. */
export const isBrew = (liquid: LiquidKind | undefined): boolean => !!liquid && (BREW_BY_ID.has(liquid) || liquid === 'spirit');
/** Still working, and not to be drawn off until it has stopped. */
export const isWorking = (f: PlacedFurniture): boolean => (f.ferment ?? 0) > 0;

/** Anything you would actually put in your mouth. */
export const drinkable = (liquid: LiquidKind | undefined): boolean => liquid === 'water' || liquid === 'milk' || liquid === 'juice' || isBrew(liquid);

type FurnitureTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get((t as FurnitureTarget).id) : undefined);

/** Barrels near enough to tip something into. */
export function brewBarrel(g: Game, t: Target): PlacedFurniture | undefined {
  const f = pieceOf(g, t);
  return f && holdsLiquid(f) ? f : undefined;
}

/** Why this brew cannot be set going in this barrel, or null. */
export function brewReason(g: Game, f: PlacedFurniture | undefined, brew: BrewDef): string | null {
  if (!f) return 'Stand at a barrel.';
  if (!holdsLiquid(f)) return 'That holds no liquid.';
  if (isWorking(f)) return 'Already brewing.';
  if (f.liquid !== 'water') return `Needs water: empty the ${furnitureName(f).toLowerCase()} and fill it from a well.`;
  if (litresIn(f) < brew.litres) return `Need ${brew.litres} litres of water; has ${litresIn(f).toFixed(0)}.`;
  // What goes in comes from the same stock a craft spends: the pack, a bag on
  // your back, and your stores within reach.
  const have = g.stockCount(brew.input);
  if (have < brew.count) return `Need ${brew.count} × ${itemDef(brew.input).name.toLowerCase()}; have ${have}.`;
  return null;
}

export const BREWING_ACTIONS: ActionDef[] = [
  {
    id: 'start_brew',
    label: 'Set a brew going',
    verb: 'setting a brew going',
    skill: 'brewing',
    hidden: true,
    stamina: 0.04,
    baseTime: 10,
    applies: (t, g) => brewBarrel(g, t) !== undefined,
    check: (t, g) => {
      const f = brewBarrel(g, t);
      const brew = t.kind === 'furniture' && t.brew ? BREW_BY_ID.get(t.brew as LiquidKind) : undefined;
      if (!brew) return 'Choose what to brew.';
      return brewReason(g, f, brew);
    },
    perform: (t, g) => {
      const f = brewBarrel(g, t);
      const brew = t.kind === 'furniture' && t.brew ? BREW_BY_ID.get(t.brew as LiquidKind) : undefined;
      if (!f || !brew || brewReason(g, f, brew)) return;
      // What goes in decides most of what comes out; the hand only decides
      // how much of it survives the working.
      const stockQl = g.stockOf((it) => it.id === brew.input)[0]?.item.ql ?? 20;
      if (!g.spendStock(brew.input, brew.count)) return;
      if (!g.skillCheck('brewing', brew.difficulty, 0, g.mindEase())) {
        f.litres = Math.max(0, litresIn(f) - brew.litres);
        if (f.litres <= 0) f.liquid = undefined;
        delete f.knack;
        delete f.agedFrom;
        g.gainSkill('brewing', tryGain(false, BREW_GAIN));
        g.logMsg(`Brew failed: ${furnitureName(f).toLowerCase()} emptied.`, 'event');
        g.events.emit('crate');
        return;
      }
      f.litres = brew.litres;
      f.liquid = brew.id;
      f.ferment = brew.time;
      // A brew that ages does so from the moment it stops working, which is now and its working (`ageing.ts`).
      if (brew.ages) f.agedFrom = g.wallNow() + brew.time;
      else delete f.agedFrom;
      // Its brewer's hand in it, which goes into every bucket drawn off it (a Cook's Strong Brew).
      const knack = g.perk(`brewed:${brew.id}`, 1);
      if (knack !== 1) f.knack = knack;
      else delete f.knack;
      f.ql = Math.max(1, Math.min(100, (stockQl + g.skills.get('brewing')) / 2));
      g.gainSkill('brewing', tryGain(true, BREW_GAIN));
      g.note('brew');
      g.note(`brew:${brew.id}`);
      g.logMsg(`${brew.done} Ready in about ${Math.round(brew.time / 60)} minutes.`, 'event');
      g.events.emit('crate');
    },
  },
];

export const BREWING_ACTION_BY_ID = new Map(BREWING_ACTIONS.map((a) => [a.id, a]));
