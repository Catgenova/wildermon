import type { ActionDef, Target } from './actions';
import { fixedTo } from './ageing';
import { FRUITING } from './fruiting';
import { isDone, WALL_TYPES, WALL_TYPE_BY_ID, type Side } from './building';
import { facingOf, FACINGS, turnedFacing, type PlacedFurniture } from './furniture';
import { STATE_TAILS } from './pieceTails';
import type { Game } from './game';
import { describeFrom, itemDef } from './items';
import { lampTooFar } from './lamps';
import { DAY_SECONDS } from './pace';
import { article, listedOr, numberWord, timeWords } from './words';
import { SEASONS, SEASON_DAYS, seasonAt, seasonBegan, type Season } from '../world/calendar';
import { BUSH_DEFS, TILE_DEFS, TileType, bushSpecies } from '../world/tiles';

/**
 * Vineyards: a grapevine grown up a trellis, and the grapes off it.
 *
 * A trellis is a carpenter's piece, set down on the ground outside a
 * building against the outer face of a finished wall of a type that takes
 * one (`WallTypeDef.trellis`: a solid wall and a window), facing it, along
 * the whole of that side of its tile (`trellisWallRefusal`, `trellisFacing`).
 * The wall is asked for when it is set down and when it is turned, and at no
 * other time: one standing where its wall has come down since, or set down
 * before the rule was, stays and grows as it did. A grape cutting
 * planted at its foot (`plant_vine`) takes if the trellis stands on soil
 * (`VINE_SOIL`), and the vine is the trellis's from then on: the moment it
 * was planted is kept on the piece (`vineAt`; on the island the placed row's
 * `vine_at`), and everything about it is read off that moment and the wall
 * clock, the way an arch's roses are (`roses.ts`). Picking a trellis up
 * loses its vine.
 *
 * Modelled on a fruit tree: too young to bear for `VINE_BEARS` days, and then
 * it bears -- but only in `GRAPE_SEASON`, and once in `VINE_REST` days, the
 * moment it was last picked being kept on the piece too (`pickedAt`,
 * `picked_at`). Picking it out of season gives nothing and says when it
 * fruits.
 *
 * The first cutting comes off a wild vine: they grow through the thorn
 * bushes (`WILD_VINE`), and one is cut off a thorn bush with a sickle, once
 * in a while (`cut_vine`, marked foraged as a bush's harvest is).
 *
 * The season is the fruiting table's (`FRUITING` in `fruiting.ts`), read
 * into `GRAPE_SEASON`, so grapes keep the calendar every other fruit keeps. Every rule here is the
 * island's too (`supabase/migrations/*_vineyards_and_wine_that_ages.sql`), in
 * the same words and the same order; `supabase/test/vineyard.ts` holds the
 * two sides to each other.
 */

export const TRELLIS = 'trellis';
export const GRAPE = 'grape';
export const GRAPE_CUTTING = 'grape_cutting';
/** Cutting a grape cutting off a wild vine, on a thorn bush. */
export const CUT_VINE = 'cut_vine';
/** Planting a grape cutting at the foot of a trellis. */
export const PLANT_VINE = 'plant_vine';
/** Picking the grapes off a trellis's vine. */
export const PICK_GRAPES = 'pick_grapes';

/** The season grapes ripen in, and the only one a vine is picked in: the fruiting table's. */
export const GRAPE_SEASON: Season = FRUITING[GRAPE][0];
/** Days of the island's year after it is planted before a vine bears. */
export const VINE_BEARS = 3;
/** Days of the island's year after a vine is picked before it bears again. */
export const VINE_REST = 1;
/**
 * Grapes a pick gives: `GRAPES_A_PICK` × (`GRAPES_BASE` + forestry ÷
 * `GRAPES_SPAN`), to the nearest whole one and never fewer than one -- a
 * fruit tree's sum, without its dice.
 */
export const GRAPES_A_PICK = 6;
export const GRAPES_BASE = 0.5;
export const GRAPES_SPAN = 130;
/** The trade a vine is worked with, cut, planted and picked: a fruit tree's. */
export const VINE_SKILL = 'forestry';
/** What a go at a vine teaches: a fruit tree's picking. */
export const VINE_GAIN = 0.35;
/** What a cutting is taken off a wild vine with. */
export const CUTTING_TOOL = 'sickle';
/** The bush wild vines grow through. */
export const WILD_VINE = 'Thorn bush';
/** The ground a vine roots in, under its trellis. */
export const VINE_SOIL: readonly TileType[] = [TileType.Grass, TileType.Dirt, TileType.Field, TileType.Lawn, TileType.Steppe];

/** Grapes a pick gives at this forestry. The island's `grapes_for`. */
export const grapesFor = (skill: number): number => Math.max(1, Math.floor(GRAPES_A_PICK * (GRAPES_BASE + skill / GRAPES_SPAN) + 0.5));

/** The wall types a trellis is set against, from their own table: a solid wall and a window. */
export const TRELLIS_WALLS = WALL_TYPES.filter((w) => w.trellis).map((w) => w.id);
/** Those, as they are said: "solid or window wall". */
export const trellisWallWords = (): string => `${listedOr(WALL_TYPES.filter((w) => w.trellis).map((w) => w.name.toLowerCase()))} wall`;
/** The wall types a trellis is not set against, from the same table: "a door, a double door, ... or a rune gate". */
export const trellisRefusedWords = (): string =>
  listedOr(WALL_TYPES.filter((w) => !w.trellis).map((w) => w.name.toLowerCase()).map((n) => `${article(n)} ${n}`));
/** Every way a trellis is refused, said once for its text and the help. */
export const trellisRefusedSaid = (): string =>
  `A ${trellisWord()} is refused on a tile of a building, upstairs, on a side with no wall or an unfinished one, and against ${trellisRefusedWords()}; `
  + `a hidden door is refused only to whoever its padlock admits, and is a solid wall to anybody else.`;

/** The soils, as they are said: "grass, dirt, field, lawn or steppe". */
export const vineSoilWords = (): string => listedOr(VINE_SOIL.map((t) => TILE_DEFS[t].name.toLowerCase()));

/** Whether a piece is a trellis, which a vine grows on. */
export const isTrellis = (f: PlacedFurniture | undefined): boolean => f?.kind === TRELLIS;

/** Seconds from `now` until `GRAPE_SEASON` next begins; nought in it. Epoch seconds, as `seasonAt`. */
export function untilGrapes(now: number): number {
  const { season } = seasonAt(now);
  if (season === GRAPE_SEASON) return 0;
  const k = (SEASONS.indexOf(GRAPE_SEASON) - SEASONS.indexOf(season) + SEASONS.length) % SEASONS.length;
  return seasonBegan(now) + k * SEASON_DAYS * DAY_SECONDS - now;
}

export type VineStage = 'none' | 'young' | 'waiting' | 'picked' | 'ripe';

/**
 * How the vine on a trellis stands at `now`: none planted, too young to
 * bear, grown and waiting for its season, picked and resting, or ripe.
 */
export function vineStage(f: Pick<PlacedFurniture, 'vineAt' | 'pickedAt'>, now: number): VineStage {
  if (f.vineAt === undefined) return 'none';
  if (now - f.vineAt < VINE_BEARS * DAY_SECONDS) return 'young';
  if (seasonAt(now).season !== GRAPE_SEASON) return 'waiting';
  if (f.pickedAt !== undefined && now - f.pickedAt < VINE_REST * DAY_SECONDS) return 'picked';
  return 'ripe';
}

/** The lowest and the highest a skill stands at, for the text's two ends of the sum. */
const SKILL_FLOOR = 1;
const SKILL_TOP = 100;

const days = (n: number): string => `${numberWord(n)} day${n === 1 ? '' : 's'}`;
/** "once a day", "once every two days". */
export const onceEvery = (n: number): string => (n === 1 ? 'once a day' : `once every ${days(n)}`);
const trellisWord = (): string => itemDef(TRELLIS).name.toLowerCase();
const cuttingWord = (): string => itemDef(GRAPE_CUTTING).name.toLowerCase();

/** What a refused go at a vine says. The island says the same (`vine_said`). */
export const VINE_SAID = {
  get none(): string { return `Nothing grows on this ${trellisWord()}. Plant a ${cuttingWord()} at its foot.`; },
  get young(): string { return `The vine is too young to bear. A vine bears from ${days(VINE_BEARS)} after it is planted.`; },
  get picked(): string { return `You have picked this vine. It bears again ${days(VINE_REST)} after it is picked.`; },
  has: 'A vine grows on it already.',
  get soil(): string { return `A vine roots only in soil. Set the ${trellisWord()} down on ${vineSoilWords()}.`; },
  get noCutting(): string { return `You have no ${cuttingWord()}.`; },
  noWild: 'There is no wild vine in this.',
  get cut(): string { return `You have taken the cutting this ${WILD_VINE.toLowerCase()} has. Come back later.`; },
  get noTool(): string { return `You need a ${itemDef(CUTTING_TOOL).name.toLowerCase()} to cut a vine.`; },
  /** Set down anywhere but against the outside of a wall that takes one (`trellisWallRefusal`). */
  get wall(): string { return `A ${trellisWord()} is set down only on the ground outside a building, against the outer face of a finished ${trellisWallWords()}.`; },
  /** Turned, with no other side of its tile against such a wall (`trellisTurnsTo`). */
  get turn(): string { return `No other side of this tile has the outer face of a finished ${trellisWallWords()} for the ${trellisWord()} to stand against.`; },
};

/**
 * Why a trellis will not stand on tile (x, y) against its side `facing`, or
 * null: it is set down from the ground (`level` is the storey of whoever
 * sets it down, or of the trellis being turned), on a tile that is no
 * building's -- so the wall's other face is a building's inside and this one
 * its outside -- against a finished wall on that side whose type takes a
 * trellis (`WallTypeDef.trellis`). A hidden door is the type it is seen as
 * (`Buildings.seenType`): a solid wall to all but whoever its padlock admits.
 * One sentence for every way of missing it (`VINE_SAID.wall`). The island's
 * `trellis_wall_refusal`, asked at the same points.
 */
export function trellisWallRefusal(g: Game, x: number, y: number, facing: Side, level: number): string | null {
  if (level !== 0 || g.buildings.buildingAt(x, y)) return VINE_SAID.wall;
  const w = g.buildings.wall(0, x, y, facing);
  return w && isDone(w) && WALL_TYPE_BY_ID.get(g.buildings.seenType(w))?.trellis ? null : VINE_SAID.wall;
}

/**
 * The side of tile (x, y) a trellis set down at the point (fx, fy) in it --
 * each nought to one across the tile -- goes against: of the sides it may
 * stand against (`trellisWallRefusal`), the nearest the point, the first of
 * north, east, south and west where two are as near. Where there is none,
 * the side nearest the point all the same, for it to be shown and refused
 * against.
 */
export function trellisFacing(g: Game, x: number, y: number, fx: number, fy: number, level: number): Side {
  const off: Record<Side, number> = { n: fy, e: 1 - fx, s: 1 - fy, w: fx };
  const sides = (['n', 'e', 's', 'w'] as Side[]).sort((a, b) => off[a] - off[b]);
  return sides.find((side) => !trellisWallRefusal(g, x, y, side, level)) ?? sides[0];
}

/**
 * Which way a trellis faces after a turn: the next side round to the right
 * of the way it faces that it may stand against, or null where no other
 * side may (`VINE_SAID.turn`). The island's `trellis_turns_to`.
 */
export function trellisTurnsTo(g: Game, f: PlacedFurniture): Side | null {
  let facing = facingOf(f);
  for (let i = 0; i < FACINGS.length - 1; i++) {
    facing = turnedFacing(facing, 1);
    if (!trellisWallRefusal(g, f.x, f.y, facing, f.level ?? 0)) return facing;
  }
  return null;
}

/**
 * Why a vine gives nothing out of season, and when it fruits: the island's
 * `vine_season_said`, at the same moment the same words.
 */
export function vineSeasonSaid(now: number): string {
  return vineSeasonWords(seasonAt(now).season, timeWords(untilGrapes(now)));
}
/** The same, round the season it is and the wait, for the island to put its own into. */
export const vineSeasonWords = (season: string, wait: string): string =>
  `Grapes ripen only in ${GRAPE_SEASON}. It is ${season} now; this vine fruits in ${wait}.`;

/** What planting says. The island's `vine_planted_said`. */
export const vinePlantedSaid = (): string =>
  `You plant the ${cuttingWord()} at the foot of the ${trellisWord()}. It bears from ${days(VINE_BEARS)} on, in ${GRAPE_SEASON}.`;

/** What a pick says. The island's `grapes_said`. */
export const grapesSaid = (n: number, ql: number): string =>
  `You pick ${n} ${itemDef(GRAPE).name.toLowerCase()}${n === 1 ? '' : 's'} off the vine. (QL ${fixedTo(ql, 1)})`;

/** What a cutting says. The island's `cut_vine_said`. */
export const cutVineSaid = (ql: number): string =>
  `You cut a ${cuttingWord()} off the wild vine in the ${WILD_VINE.toLowerCase()}. (QL ${fixedTo(ql, 1)})`;

/** What the line under a trellis's name says of its vine. */
export function vineSays(f: PlacedFurniture, now: number): string {
  const stage = vineStage(f, now);
  if (stage === 'none') return 'no vine';
  if (stage === 'young') return `young vine · bears in ${timeWords((f.vineAt ?? now) + VINE_BEARS * DAY_SECONDS - now)}`;
  if (stage === 'waiting') return `vine · fruits in ${timeWords(untilGrapes(now))}`;
  if (stage === 'picked') return `vine, picked · bears again in ${timeWords((f.pickedAt ?? now) + VINE_REST * DAY_SECONDS - now)}`;
  return 'vine, grapes ripe';
}

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const trellisOf = (g: Game, t: Target): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return isTrellis(f) ? f : undefined;
};

/** Whether a tile is a thorn bush, which a wild vine grows through. */
const wildVineAt = (g: Game, x: number, y: number): boolean =>
  g.world.getTile(x, y) === TileType.Bush && BUSH_DEFS[bushSpecies(g.world.getData(x, y))]?.name === WILD_VINE;

/**
 * Why a vine cannot be planted or picked now, or null: in the island's order
 * -- there, in reach, and then the vine (`vine_refusal`).
 */
export function vineRefusal(g: Game, id: string, t: Target): string | null {
  if (id === CUT_VINE) {
    if (t.kind !== 'tile' || !wildVineAt(g, t.x, t.y)) return VINE_SAID.noWild;
    if (g.isForaged(t.x, t.y, 'vine')) return VINE_SAID.cut;
    return g.inventory.has(CUTTING_TOOL) ? null : VINE_SAID.noTool;
  }
  const f = trellisOf(g, t);
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(trellisWord());
  const now = g.wallNow();
  if (id === PLANT_VINE) {
    if (f.vineAt !== undefined) return VINE_SAID.has;
    if ((f.level ?? 0) !== 0 || !VINE_SOIL.includes(g.world.getTile(f.x, f.y) as TileType)) return VINE_SAID.soil;
    return g.inventory.has(GRAPE_CUTTING) ? null : VINE_SAID.noCutting;
  }
  const stage = vineStage(f, now);
  if (stage === 'none') return VINE_SAID.none;
  if (stage === 'young') return VINE_SAID.young;
  if (stage === 'waiting') return vineSeasonSaid(now);
  if (stage === 'picked') return VINE_SAID.picked;
  return null;
}

export const VINEYARD_ACTIONS: ActionDef[] = [
  {
    id: CUT_VINE,
    label: 'Cut a grape cutting',
    verb: 'cutting a vine',
    skill: VINE_SKILL,
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => t.kind === 'tile' && wildVineAt(g, t.x, t.y),
    check: (t, g) => vineRefusal(g, CUT_VINE, t),
    perform: (t, g) => {
      if (t.kind !== 'tile' || vineRefusal(g, CUT_VINE, t)) return;
      const made = g.gather(GRAPE_CUTTING, { count: 1, ql: g.productQl(VINE_SKILL, g.toolQl(CUTTING_TOOL)) });
      g.markForaged(t.x, t.y, 'vine');
      g.gainSkill(VINE_SKILL, VINE_GAIN);
      g.logMsg(cutVineSaid(made.ql), 'event');
    },
  },
  {
    id: PLANT_VINE,
    label: 'Plant a grape cutting',
    verb: 'planting a vine',
    skill: VINE_SKILL,
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => {
      const f = trellisOf(g, t);
      return !!f && f.vineAt === undefined;
    },
    check: (t, g) => vineRefusal(g, PLANT_VINE, t),
    perform: (t, g) => {
      const f = trellisOf(g, t);
      if (!f || vineRefusal(g, PLANT_VINE, t)) return;
      const cutting = g.inventory.find(GRAPE_CUTTING);
      if (!cutting) return;
      g.inventory.remove(cutting.uid, 1);
      f.vineAt = g.wallNow();
      delete f.pickedAt;
      g.gainSkill(VINE_SKILL, VINE_GAIN);
      g.logMsg(vinePlantedSaid(), 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    id: PICK_GRAPES,
    label: 'Pick grapes',
    verb: 'picking grapes',
    skill: VINE_SKILL,
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => trellisOf(g, t)?.vineAt !== undefined,
    check: (t, g) => vineRefusal(g, PICK_GRAPES, t),
    perform: (t, g) => {
      const f = trellisOf(g, t);
      if (!f || vineRefusal(g, PICK_GRAPES, t)) return;
      const n = grapesFor(g.skills.get(VINE_SKILL));
      const made = g.gather(GRAPE, { count: n, ql: g.productQl(VINE_SKILL) });
      f.pickedAt = g.wallNow();
      g.gainSkill(VINE_SKILL, VINE_GAIN);
      g.logMsg(grapesSaid(n, made.ql), 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
];

/**
 * Where a trellis stands, said once: for its text, the cutting's and the help.
 * What it is set down against, and which wall where a tile has two
 * (`trellisFacing`); and that it stays when the wall goes.
 */
export const TRELLIS_RULE = (): string => `${VINE_SAID.wall} It stands along the whole of that side of its tile; `
  + `on a tile with such walls on more than one side, it goes against the one nearest where it is set down. `
  + `It stays standing, with its vine, if the wall comes down.`;

/** The rule, said once: for the trellis's and the cutting's text and the help. */
export const VINE_RULE = (): string => `${TRELLIS_RULE()} Plant a ${cuttingWord()} at the foot of a ${trellisWord()} standing on ${vineSoilWords()}. `
  + `The vine bears from ${days(VINE_BEARS)} after it is planted, in ${GRAPE_SEASON} only, and ${onceEvery(VINE_REST)}: `
  + `a pick gives ${GRAPES_A_PICK} × (${GRAPES_BASE} + ${VINE_SKILL} ÷ ${GRAPES_SPAN}) grapes to the nearest whole one, `
  + `${grapesFor(SKILL_FLOOR)} at ${VINE_SKILL} ${SKILL_FLOOR} and ${grapesFor(SKILL_TOP)} at ${SKILL_TOP}. Picking the ${trellisWord()} up loses its vine.`;

// The line under a trellis's name says how its vine stands.
STATE_TAILS.push((f) => (isTrellis(f) ? ` · ${vineSays(f, Date.now() / 1000)}` : ''));

describeFrom(GRAPE, { grapeSeason: GRAPE_SEASON });
describeFrom(TRELLIS, { rule: VINE_RULE(), refused: trellisRefusedSaid() });
describeFrom(GRAPE_CUTTING, { rule: VINE_RULE(), wild: WILD_VINE.toLowerCase(), tool: itemDef(CUTTING_TOOL).name.toLowerCase() });
