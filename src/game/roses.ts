/**
 * What climbs an arch -- roses on a rose arch, lavender on a lavender arch
 * (`Climber`, `FurnitureDef.climber`) -- and how far it has grown. Both grow
 * by the one rule here, the same days and the same seasons.
 *
 * Asked for with the pictures: an arch over a path that fills in over the days
 * after it goes up -- bare, then leafy, then in bud, then in flower, flowering
 * in spring and summer and in leaf the rest of the year. What decides it is
 * the moment the arch was set down, which the island keeps for every piece
 * (`placed.made_at`) and hands to every browser that can see it (`set` in the
 * ground read), so everybody looking at one arch sees the same roses on it.
 * Both that moment and the season are the wall clock's; nothing else is kept.
 *
 * Picking an arch up and setting it down again is planting its roses again.
 */
import { SEASONS, seasonAt, type Season } from '../world/calendar';
import { DAY_SECONDS } from './pace';
import { capital, listed, spanWords } from './words';

/** What is planted at an arch's feet and climbs it; wisteria over a pergola (`garden.ts`). */
export type Climber = 'rose' | 'lavender' | 'wisteria';
/** What it is called on the arch, for the line under its name and the rule. */
export const CLIMBER_NAME: Record<Climber, string> = { rose: 'roses', lavender: 'lavender', wisteria: 'wisteria' };

/** Days of the island's year after it is set down that an arch's roses are in leaf, in bud and in flower. */
export const ROSE_LEAFY = 1;
export const ROSE_BUD = 2;
export const ROSE_FLOWER = 3;
/** The seasons roses and lavender bud and flower in (`FRUITING`, both cut in the same two); the rest of the year a grown arch is in leaf. */
export const ROSE_SEASONS: readonly Season[] = ['spring', 'summer'];
/** The seasons each climber buds and flowers in: wisteria in spring alone. */
export const CLIMBER_BLOOMS: Record<Climber, readonly Season[]> = { rose: ROSE_SEASONS, lavender: ROSE_SEASONS, wisteria: ['spring'] };
/** And the seasons a grown one stands bare in: wisteria drops its leaves in winter; roses and lavender never. */
export const CLIMBER_BARE: Record<Climber, readonly Season[]> = { rose: [], lavender: [], wisteria: ['winter'] };

const DAY = DAY_SECONDS;

export type RoseStage = 'bare' | 'leafy' | 'bud' | 'flower';

/** What the roses on an arch look like, in words: "bare", "in leaf", "in bud", "in flower". */
export const ROSE_WORD: Record<RoseStage, string> = { bare: 'bare', leafy: 'in leaf', bud: 'in bud', flower: 'in flower' };

/**
 * How the roses on an arch set down at `setAt` stand at `now`, both in epoch
 * seconds: the stage, how many days they have been growing, and whether it is
 * the time of year they flower. An arch with no moment of its own -- one set
 * down before arches kept one -- is taken as long grown.
 */
export function roseStage(setAt: number | undefined, now: number, climber: Climber = 'rose'): { stage: RoseStage; days: number; blooms: boolean } {
  const days = setAt === undefined ? ROSE_FLOWER * 10 : Math.max(0, (now - setAt) / DAY);
  const season = seasonAt(now).season;
  const blooms = CLIMBER_BLOOMS[climber].includes(season);
  const stage: RoseStage = days < ROSE_LEAFY || CLIMBER_BARE[climber].includes(season) ? 'bare'
    : !blooms || days < ROSE_BUD ? 'leafy' : days < ROSE_FLOWER ? 'bud' : 'flower';
  return { stage, days, blooms };
}

const bloomSeasons = (climber: Climber): string => listed(CLIMBER_BLOOMS[climber]);
/** The rest of a grown climber's year, in words: "in leaf the rest of the year", or wisteria's "in leaf in summer and autumn; bare in winter". */
const restOfYear = (climber: Climber): string => {
  const bare = CLIMBER_BARE[climber];
  if (!bare.length) return 'in leaf the rest of the year';
  const leaf = SEASONS.filter((s) => !CLIMBER_BLOOMS[climber].includes(s) && !bare.includes(s));
  return `in leaf in ${listed(leaf)}; bare in ${listed(bare)}`;
};

/** What an arch's roses (or its lavender) are doing and what they do next, for the line under its name. */
export function roseSays(setAt: number | undefined, now: number, climber: Climber = 'rose'): string {
  const { stage, blooms, days } = roseStage(setAt, now, climber);
  const at = setAt ?? now - ROSE_FLOWER * 10 * DAY;
  const name = CLIMBER_NAME[climber];
  const next = (d: number, word: string): string => ` · ${word} in ${spanWords(at + d * DAY - now)}`;
  if (stage === 'bare' && days >= ROSE_LEAFY) return `${name} bare · ${restOfYear(climber)}`;
  if (stage === 'bare') return `${name} bare${next(ROSE_LEAFY, 'in leaf')}`;
  if (stage === 'leafy' && blooms) return `${name} in leaf${next(ROSE_BUD, 'in bud')}`;
  if (stage === 'leafy') return `${name} in leaf · bud and flower in ${bloomSeasons(climber)}`;
  if (stage === 'bud') return `${name} in bud${next(ROSE_FLOWER, 'in flower')}`;
  return `${name} in flower`;
}

/** The rule for what climbs an arch, said once: for a piece's description and the help. */
export const climberRule = (climber: Climber): string => {
  const name = CLIMBER_NAME[climber];
  return `${capital(name)}: in leaf ${ROSE_LEAFY} ${ROSE_LEAFY === 1 ? 'day' : 'days'} after it is set down, in bud after ${ROSE_BUD} days, in flower after ${ROSE_FLOWER} days, in ${bloomSeasons(climber)}; ${restOfYear(climber)}. Picking it up and setting it down restarts its ${name}.`;
};
export const ROSES_RULE = climberRule('rose');
export const LAVENDER_RULE = climberRule('lavender');
export const WISTERIA_RULE = climberRule('wisteria');
