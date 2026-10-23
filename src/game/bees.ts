import type { ActionDef, Target } from './actions';
import { furnitureCentre, furnitureDef, hiveRoom, type PlacedFurniture } from './furniture';
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

/* ---- a Vesp at its trade ------------------------------------------------------------------------------- */

/**
 * A Vesp set to work a settlement (its trade, `hive`) works a hive the way bees
 * work a skep, trip by trip:
 *
 *   * it takes the nearest hive within its range of the token that has room,
 *     and of the tiles within `SKEP_REACH` of that hive's tile that are in
 *     flower (`flowersHere`, as a skep counts them), the next in its turn: in
 *     rows from the corner, its goes today (its ledger's) on from the first;
 *   * it flies out to that tile, works the flower a go, and flies back with
 *     what it gathered, into the hive;
 *   * what it brings is what a skep there would have made over the trip:
 *     `skepRate` for the clumps in reach of the hive and the season, for the
 *     time from setting off to setting off again (`VESP_REST` after it is back);
 *     so a Vesp at work fills its hive at a skep's rate there, and a beeswax
 *     goes in with every `SKEP_WAX_EVERY`th honey;
 *   * nothing in `SKEP_IDLE`, and nothing where no hive in range has room or
 *     no flower is in reach of one, which it says (`VespIdle`).
 *
 * The island's `vesp_trip`, `worker_settle` and `vesp_put`, step for step.
 */
export type VespIdle = 'range' | 'season' | 'room' | 'flowers';
export type VespTrip = { hive: PlacedFurniture; x: number; y: number } | { why: VespIdle; n: number };

/** Seconds it stands at the hive after putting in what it brought, before it sets off again: the island's `vesp_rest`. */
export const VESP_REST = 1;

/**
 * Where a Vesp at `cx, cy` goes next, working a settlement at `sx, sy` to `range` tiles, on its `turn`th go of the
 * day; or why it goes nowhere: no hive in range (`range`, the number its range), `SKEP_IDLE`, every hive in range
 * full (`room`), or no wildflowers within `SKEP_REACH` of one with room (`flowers`, the number the reach).
 */
export function vespTrip(g: Game, cx: number, cy: number, sx: number, sy: number, range: number, turn: number, now: number): VespTrip {
  const hives: Array<{ f: PlacedFurniture; d: number }> = [];
  for (const f of g.furniture.values()) {
    if (f.kind !== 'hive' || Math.max(Math.abs(f.x - sx), Math.abs(f.y - sy)) > range) continue;
    const [hx, hy] = furnitureCentre(f);
    hives.push({ f, d: (hx - cx) ** 2 + (hy - cy) ** 2 });
  }
  if (!hives.length) return { why: 'range', n: range };
  if (seasonAt(now).season === SKEP_IDLE) return { why: 'season', n: 0 };
  hives.sort((a, b) => a.d - b.d || a.f.id - b.f.id);
  let room = false;
  for (const { f } of hives) {
    if (hiveRoom(f) <= 0) continue;
    room = true;
    const tiles: Array<[number, number]> = [];
    for (let ty = f.y - SKEP_REACH; ty <= f.y + SKEP_REACH; ty++) {
      for (let tx = f.x - SKEP_REACH; tx <= f.x + SKEP_REACH; tx++) if (flowersHere(g, tx, ty, now) > 0) tiles.push([tx, ty]);
    }
    if (tiles.length) {
      const [x, y] = tiles[turn % tiles.length];
      return { hive: f, x, y };
    }
  }
  return room ? { why: 'flowers', n: SKEP_REACH } : { why: 'room', n: 0 };
}

/** Honey a Vesp brings its hive off a trip of `secs` seconds, with so many clumps in reach of it in this season: a skep's. */
export const vespHoney = (flowers: number, season: Season, secs: number): number => (skepRate(flowers, season) * secs) / HOUR;

/**
 * What a Vesp brought, into a hive: onto the honey it has toward its next whole one, at the quality of all of it
 * together; every whole honey made while it has room, and a beeswax with every `SKEP_WAX_EVERY`th it has made. What
 * is left waits for the next trip, no more than a honey of it while the hive is full. The island's `vesp_put`.
 */
export function hiveTakes(f: PlacedFurniture, honey: number, ql: number): { honey: number; wax: number; ql: number } {
  const was = f.nectar ?? 0;
  let part = was + honey;
  const q = part > 0 ? ((f.nectarQl ?? ql) * was + ql * honey) / part : ql;
  let room = hiveRoom(f);
  let made = 0;
  let wax = 0;
  while (part >= 1 && room > 0) {
    part -= 1;
    made++;
    room--;
    f.honeys = (f.honeys ?? 0) + 1;
    if (f.honeys % SKEP_WAX_EVERY === 0 && room > 0) {
      wax++;
      room--;
    }
  }
  f.nectar = Math.min(part, 1);
  f.nectarQl = q;
  return { honey: made, wax, ql: q };
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
      g.note(`skep:${seasonAt(now).season}`);
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
describeFrom('hive', { vespReach: SKEP_REACH, vespHours: SKEP_CLUMP_HOURS, vespWax: SKEP_WAX_EVERY, vespIdle: SKEP_IDLE });
