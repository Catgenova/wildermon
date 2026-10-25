/**
 * What a go of gathering can give, read off the rules that roll it: the
 * chance a go finds anything, the most quality it can come out at, how long
 * a spot stays picked over and when a crop is in season. Menu labels, the
 * tile window and the hover all say these, so they say them from here.
 *
 * Nothing here decides anything. The island rolls every go (`perform_gather`,
 * `perform_ground`, `perform_fish`, `perform_terrain`) on the same numbers;
 * this only says them.
 */
import type { Game } from './game';
import { EMPTY_CHANCE, FIND_CHECK, rollsAt } from './forage';
import { fruitingSeasons, fruitSeason } from './fruiting';
import { FISH, baitFor, fishHere, staysOn, type FishDef } from './fishing';
import { SEASONS, SEASON_DAYS, seasonBegan } from '../world/calendar';
import { DAY_SECONDS } from './pace';
import { readyIn, timeWords, waitWords } from './words';

/** A chance as a label says it: "54%". */
export const pct = (p: number): string => `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
/** The whole QL nothing comes out above, from the rule's ceiling. */
export const qlCap = (ceiling: number): number => Math.ceil(ceiling - 1e-9);
/** "QL ≤29", for a menu label. */
export const qlTag = (ceiling: number): string => `QL ≤${qlCap(ceiling)}`;
/** "Mine (78%, QL ≤34)": a label with its odds and its ceiling after it. */
export const tagged = (label: string, ...parts: Array<string | null | undefined>): string => {
  const said = parts.filter((p): p is string => !!p);
  return said.length ? `${label} (${said.join(', ')})` : label;
};

/** `tagged`, for a job with a tool: the plain label while the tool is not carried, since its numbers are the tool's. */
export const taggedWith = (g: Game, tool: string, label: string, ...parts: Array<string | null | undefined>): string =>
  (g.inventory.has(tool) ? tagged(label, ...parts) : label);

/** Looks over a tile in one go of foraging or botanizing: `rollsAt` the skill, and a Naturalist's Keen Eye (`passes:<job>`). */
export const searchPasses = (g: Game, job: 'forage' | 'botanize', skill: string): number =>
  rollsAt(g.skills.get(skill)) + Math.floor(g.perk(`passes:${job}`, 0));

/**
 * The chance one look turns something up: not the empty ground
 * (`EMPTY_CHANCE`, less a Naturalist's Sure Find), and then the skill check
 * at `FIND_CHECK`. The island's `perform_gather` rolls the same two.
 */
export const findChance = (g: Game, job: 'forage' | 'botanize', skill: string): number =>
  (1 - Math.min(1, EMPTY_CHANCE * g.perk(`empty:${job}`, 1))) * g.skillChance(skill, FIND_CHECK);

/** "2 passes at 54%", or "54%" for one. */
export const searchOdds = (g: Game, job: 'forage' | 'botanize', skill: string): string => {
  const n = searchPasses(g, job, skill);
  const p = pct(findChance(g, job, skill));
  return n > 1 ? `${n} passes at ${p}` : p;
};

/** "ready", or "ready in 2 min 10 s": a spot's wait for a kind of work (`Game.foragedLeft`). */
export const readySaid = (g: Game, x: number, y: number, kind: string): string => {
  const left = g.foragedLeft(x, y, kind);
  return left > 0 ? `ready in ${waitWords(left)}` : 'ready';
};

/** The end of a refusal for a spot worked too lately: "Ready in 1 min 40 s." The island's `ready_in`. */
export const pickedSaid = (g: Game, x: number, y: number, kind: string): string => readyIn(g.foragedLeft(x, y, kind));

/**
 * How long a crop stays in season, or how long until it comes in, from the
 * moment `now` (epoch seconds): "in season, 2 days and 3 hours left", "out
 * of season until autumn, in 6 days". Seasons in a row run together. Null
 * before the year is counted (`fruitSeason`), when everything is in season.
 */
export function seasonWindow(id: string, now: number): string | null {
  const season = fruitSeason(now);
  if (season === null) return null;
  const seasons = fruitingSeasons(id);
  const at = SEASONS.indexOf(season);
  const len = SEASON_DAYS * DAY_SECONDS;
  const next = seasonBegan(now) + len;
  const fruits = (k: number): boolean => seasons.includes(SEASONS[(at + k) % SEASONS.length]);
  if (fruits(0)) {
    let k = 1;
    while (k < SEASONS.length && fruits(k)) k++;
    return k === SEASONS.length ? 'in season all year' : `in season, ${timeWords(next + (k - 1) * len - now)} left`;
  }
  let k = 1;
  while (!fruits(k)) k++;
  return `out of season until ${SEASONS[(at + k) % SEASONS.length]}, in ${timeWords(next + (k - 1) * len - now)}`;
}

/** What a line in water of this depth can bring up for this fisher, and the fish that want more skill for it. */
export function fishFor(g: Game, depth: number): { pool: FishDef[]; later: FishDef[] } {
  const skill = g.skills.get('fishing');
  return { pool: fishHere(depth, skill), later: FISH.filter((f) => depth >= f.depth && skill < f.level) };
}

/**
 * A cast here, as its menu label says it: the chance a bite stays on with the
 * rod carried and the bait that would go on (`staysOn`), and the most quality
 * a fish comes up at (`productQl` with the rod). The island's `perform_fish`.
 */
export const castOdds = (g: Game, depth: number): string[] => {
  const bait = baitFor(g, depth);
  const on = staysOn(g.skills.get('fishing'), g.toolQl('fishing_rod'), !!bait, g.perk('hook:fish', 0));
  return [`stay on ${pct(on)}`, qlTag(g.qlCeiling('fishing', g.toolQl('fishing_rod')))];
};

/** "trout at 15, pike at 35": fish this water holds that want more fishing. */
export const laterSaid = (later: FishDef[]): string => later.map((f) => `${f.name.toLowerCase()} at ${f.level}`).join(', ');

