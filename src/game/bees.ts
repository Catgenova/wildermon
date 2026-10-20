import type { ActionDef, Target } from './actions';
import { furnitureDef, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef } from './items';
import { lampTooFar } from './lamps';
import { DAY_SECONDS } from './pace';
import { SEASON_DAYS, SEASONS, seasonAt, seasonBegan, type Season } from '../world/calendar';
import { flowersHere } from './wildflowers';
import { capital } from './words';

/**
 * Bees: a skep, a coiled straw hive woven with a carving knife and set down
 * like any piece, that fills itself with honey and beeswax off the
 * wildflowers in reach of it.
 *
 * Nothing is kept in it and nothing ticks. The skep remembers one moment,
 * when it was set down or last emptied (`PlacedFurniture.skepAt`; on the
 * island `placed.state -> skep_at`, stamped by `skep_stamp` as the row goes
 * in), and what it has made is worked out from that moment to now whenever
 * anybody looks at it or takes from it (`skepMade`; the island's
 * `skep_made`):
 *
 *   * the time between is cut at every turn of the season, and each stretch
 *     makes honey at `skepRate` for that season -- a honey every
 *     `SKEP_CLUMP_HOURS` hours for each clump of wildflowers within
 *     `SKEP_REACH` tiles of the skep's tile, counted as the ground stands
 *     (`flowersHere`: grass, not picked this year, nothing built over it) in
 *     that stretch's season -- so a skep makes nothing in a season nothing is
 *     in flower, and nothing at all in `SKEP_IDLE`, whatever is in flower;
 *   * it holds `SKEP_HOLDS` honey at most and makes no more until it is
 *     emptied;
 *   * and for every `SKEP_WAX_EVERY` honey in it there is a beeswax.
 *
 * Take honey empties it: every whole honey in it and the beeswax that goes
 * with them, at a quality off the skep's own (as a tool's) and the taker's
 * `SKEP_SKILL`, which it trains; and the skep starts again from that moment.
 * Whoever set it down may take from it, and anybody of the settlement it
 * stands on. Picked up, it starts again from nothing where it is set down.
 */
export const SKEP = 'skep';
/** Emptying it of what it has made. */
export const TAKE_HONEY = 'take_honey';
/** Examine, on a skep standing: its flowers, its rate, what is in it and what it holds. */
export const LOOK_SKEP = 'examine_skep';

/** Tiles each way from the skep's own tile that its bees work: a square `2 * SKEP_REACH + 1` tiles across. */
export const SKEP_REACH = 3;
/** Hours one clump of wildflowers in reach takes to make a honey. */
export const SKEP_CLUMP_HOURS = 50;
/** The most honey a skep holds. */
export const SKEP_HOLDS = 12;
/** A beeswax for every this many honey. */
export const SKEP_WAX_EVERY = 4;
/** The season a skep makes nothing in, flowers or none. */
export const SKEP_IDLE: Season = 'winter';
/** The trade that takes it, and that a skep's honey is good by. */
export const SKEP_SKILL = 'animal_husbandry';
/** Seconds in the hour the rate is said in. */
export const HOUR = 3600;

const honeyWord = (): string => itemDef('honey').name.toLowerCase();
const waxWord = (): string => itemDef('wax').name.toLowerCase();
const word = (): string => furnitureDef(SKEP).name.toLowerCase();

/** Honey an hour a skep makes off this many clumps in reach, in this season: none in `SKEP_IDLE`. */
export const skepRate = (flowers: number, season: Season): number => (season === SKEP_IDLE ? 0 : flowers / SKEP_CLUMP_HOURS);

/** That rate as it is said: to two places, no trailing noughts. The island's `skep_rate_said`. */
export const skepRateSaid = (flowers: number, season: Season): string =>
  String(Math.round((season === SKEP_IDLE ? 0 : flowers * 100) / SKEP_CLUMP_HOURS) / 100);

/** The beeswax that goes with so much honey. */
export const skepWax = (honey: number): number => Math.floor(honey / SKEP_WAX_EVERY);

/**
 * The clumps of wildflowers in reach of a skep standing on this tile, at a
 * moment: every tile within `SKEP_REACH` each way, each as `flowersHere`
 * counts it then. The island's `skep_flowers`, off its `flowers_on`.
 */
export function skepFlowers(g: Game, x: number, y: number, at: number): number {
  let n = 0;
  for (let ty = y - SKEP_REACH; ty <= y + SKEP_REACH; ty++) {
    for (let tx = x - SKEP_REACH; tx <= x + SKEP_REACH; tx++) n += flowersHere(g, tx, ty, at);
  }
  return n;
}

/** The moment the season `t` falls in turns to the next, in epoch seconds. */
const seasonEnds = (t: number): number => seasonBegan(t) + SEASON_DAYS * DAY_SECONDS;

/**
 * Honey a skep has made between two moments (epoch seconds), up to what it
 * holds: each stretch between turns of the season at its own season's rate,
 * the flowers counted once a season. The island's `skep_made`, step for step.
 */
export function skepMadeBetween(g: Game, x: number, y: number, from: number, to: number): number {
  const seen = new Map<Season, number>();
  let made = 0;
  let t = from;
  while (t < to && made < SKEP_HOLDS) {
    const season = seasonAt(t).season;
    const end = Math.min(to, seasonEnds(t));
    if (season !== SKEP_IDLE) {
      let n = seen.get(season);
      if (n === undefined) seen.set(season, (n = skepFlowers(g, x, y, t)));
      made += ((end - t) * n) / (SKEP_CLUMP_HOURS * HOUR);
    }
    t = end;
  }
  return Math.min(SKEP_HOLDS, made);
}

/** Honey a skep standing has made since it was set down or last emptied. */
export const skepMade = (g: Game, f: PlacedFurniture, now = g.wallNow()): number =>
  skepMadeBetween(g, f.x, f.y, f.skepAt ?? now, now);

/** What a refused Take honey says. The island says the same (`skep_said`). */
export const SKEP_SAID = {
  get notYours(): string { return `Only whoever set this ${word()} down, or a citizen of its settlement, may take from it.`; },
  get empty(): string { return `Less than 1 ${honeyWord()} in the ${word()}.`; },
};

/** What taking from it says. The island's `skep_took_said`. */
export const skepTookSaid = (honey: number, wax: number): string =>
  `Took: ${honey} ${honeyWord()}${wax > 0 ? `, ${wax} ${waxWord()}` : ''}. ${capital(word())} empty.`;

/**
 * What Examine says of a skep: the clumps in reach this season and the rate
 * they make, or why it makes nothing; and what is in it against what it
 * holds. The island's `skep_says`, off the same numbers.
 */
export function skepSays(flowers: number, season: Season, made: number): string {
  const honey = Math.floor(made);
  let rate: string;
  if (season === SKEP_IDLE) {
    rate = `${capital(season)}: no honey until ${SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]}.`;
  } else if (flowers <= 0) {
    rate = `No wildflowers within ${SKEP_REACH} tiles this ${season}: no honey.`;
  } else {
    rate = `Wildflowers within ${SKEP_REACH} tiles: ${flowers} ${flowers === 1 ? 'clump' : 'clumps'}. Rate: `
      + `${skepRateSaid(flowers, season)} ${honeyWord()}/hour (1 per ${SKEP_CLUMP_HOURS} hours per clump).`;
  }
  return `${rate} In it: ${honey}/${SKEP_HOLDS} ${honeyWord()}, ${skepWax(honey)} ${waxWord()} `
    + `(1 ${waxWord()} per ${SKEP_WAX_EVERY} ${honeyWord()}).`;
}

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const skepOf = (g: Game, t: Target): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && f.kind === SKEP ? f : undefined;
};

/** Whether these hands may take from it: whoever set it down, or anybody of the settlement it stands on. */
export const mayTakeHoney = (g: Game, f: PlacedFurniture): boolean => f.mine !== false || g.onDeed(f.x, f.y);

/**
 * Why a skep cannot be emptied, or looked at, now, or null: in the island's
 * order -- there, in reach, whose, and whether there is a whole honey in it
 * (`skep_refusal`).
 */
export function skepRefusal(g: Game, id: string, t: Target): string | null {
  const f = skepOf(g, t);
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(word());
  if (id !== TAKE_HONEY) return null;
  if (!mayTakeHoney(g, f)) return SKEP_SAID.notYours;
  if (skepMade(g, f) < 1) return SKEP_SAID.empty;
  return null;
}

export const BEE_ACTIONS: ActionDef[] = [
  {
    id: TAKE_HONEY,
    label: 'Take honey',
    verb: 'taking the honey',
    skill: SKEP_SKILL,
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => !!skepOf(g, t),
    check: (t, g) => skepRefusal(g, TAKE_HONEY, t),
    perform: (t, g) => {
      const f = skepOf(g, t);
      if (!f || skepRefusal(g, TAKE_HONEY, t)) return;
      const now = g.wallNow();
      const honey = Math.floor(skepMade(g, f, now));
      const wax = skepWax(honey);
      const ql = g.productQl(SKEP_SKILL, f.ql);
      g.gather('honey', { count: honey, ql });
      // A skep is a hive too, for the journal (the island's `perform_skep` the same).
      g.note('honey');
      if (wax > 0) g.gather('wax', { count: wax, ql });
      f.skepAt = now;
      g.logMsg(skepTookSaid(honey, wax), 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    id: LOOK_SKEP,
    label: 'Examine',
    verb: 'looking into the skep',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => !!skepOf(g, t),
    check: (t, g) => skepRefusal(g, LOOK_SKEP, t),
    perform: (t, g) => {
      const f = skepOf(g, t);
      if (!f) return;
      const now = g.wallNow();
      const season = seasonAt(now).season;
      g.logMsg(skepSays(skepFlowers(g, f.x, f.y, now), season, skepMade(g, f, now)), 'event');
    },
  },
];

describeFrom(SKEP, { reach: SKEP_REACH, hours: SKEP_CLUMP_HOURS, holds: SKEP_HOLDS, wax: SKEP_WAX_EVERY, idle: SKEP_IDLE });
