import { cropYield, RIPE, seedSays, TILLABLE } from '../game/farming';
import { CUT_GRASS } from '../game/actions';
import { fishable, waterDepth } from '../game/fishing';
import { BOTANIZE_TABLE, FORAGE_TABLE } from '../game/forage';
import { fruitsAt } from '../game/fruiting';
import { treeAge } from '../world/tiles';
import { FLOWER_SEASONS, flowerSeason } from '../world/flowers';
import { SEASONS } from '../world/calendar';
import { fishFor, laterSaid, readySaid, searchOdds, seasonWindow } from '../game/yields';
import { DAILY_RESET, isSeam, metres } from '../world/tiles';
import type { Game } from '../game/game';
import { itemDef } from '../game/items';
import { bedrockAt } from '../world/ore';
import {
  groundRoll, TILE_DEFS, TileType, dustiness, standCap, stepsGroundRefusal, stepsTimber, STEPS_BRICKS, STEPS_MOST, STEPS_PLANKS, STEPS_SLABS,
  trailGround, WEAR_FALL, WEAR_MOST, WEAR_TRAIL, WEARS, BUSH_DEFS, bushSpecies, TREE_DEFS, treeSpecies, FLOWERS_PICKED,
} from '../world/tiles';
import { fruitingSeasons } from '../game/fruiting';
import { STONE_STEPS_BILL, TIMBER_STEPS_BILL, stepsBack } from '../game/steps';
import { listed } from '../game/words';
import { flowersHere } from '../game/wildflowers';
import { SLOW_SLOPE } from '../game/player';

/**
 * What the rock under a tile is, when anybody has looked.
 *
 * Bare rock says what it is by being bare. Everything else has soil on top and
 * only a prospector can tell you — and the reading fades, because a prospector
 * remembers what they read for a while and not for ever.
 *
 * This was a line in the mouseover and nowhere else, which on a phone is
 * nowhere at all: there is no hovering with a finger, so the one thing
 * prospecting is *for* — is this seam worth mining, and what quality will it
 * give — could be lit up on the ground and unreadable. It is one sentence in
 * one place now, and the mouseover, the tile window and the right-click menu
 * all say it, so none of them can drift from the others.
 *
 * Null when nobody has read this ground, which is the honest answer and not a
 * guess.
 */
export function groundReading(g: Game, x: number, y: number): string | null {
  const w = g.world;
  const bare = w.getTile(x, y) === TileType.Rock;
  if (!bare && !g.isProspected(x, y)) return null;
  const rock = bedrockAt(w, x, y);
  return `${rock.name}${isSeam(rock) ? ` · mining ${rock.level}` : ''} · up to QL ${rock.maxQl}${bare ? '' : ', buried'}`;
}

/**
 * Where the corner you have picked stands, and what is on it.
 *
 * Every corner action is about one corner and about how high it is: mining and
 * chipping a face back, dropping dirt, digging, flattening, and whether a wall
 * will stand. The renderer marks the one you picked with a dot, and the number
 * behind the dot was a mouseover line and nowhere else — which on a phone is
 * nowhere at all. The same hole the prospector's reading fell down, and the
 * same fix: one sentence in one place, said by the mouseover, the tile window
 * and the right-click menu alike.
 *
 * Read against the water line rather than as a bare number, because that is
 * what every one of those actions is actually asking. Zero *is* the water
 * line — so a corner sitting on it reads as sitting on it, which is worth
 * saying plainly: it is dry ground, it is a face you can work, and it is the
 * one height that used to be refused for being wet.
 */
export function cornerReading(g: Game, cx: number, cy: number): string {
  const w = g.world;
  const h = w.getHeight(cx, cy);
  const soil = w.getDirt(cx, cy);
  const stands = h === 0 ? 'at the water line' : h > 0 ? `${metres(h)} m above the water` : `${metres(-h)} m under water`;
  // And where it stands against the level, when one has been taken, which is
  // the number every job on this corner is working towards.
  const mark = g.level === null ? ''
    : h === g.level ? ' · at the level'
    : ` · ${metres(Math.abs(h - g.level))} m ${h > g.level ? 'above' : 'below'} the level of ${metres(g.level)} m`;
  return `Corner ${cx}, ${cy} · ${stands} · ${soil > 0 ? `${metres(soil)} m soil over rock` : 'bare rock'}${mark}`;
}

/**
 * What a tile gives to the hands that work it, now: what a line brings up
 * from this water, whether the ground is picked over and for how long, what a
 * tree or a bush bears and in which season, and the most quality any of it
 * comes out at. Said in the tile window and the hover, and on the right-click
 * menu's head, off the rules in `yields.ts` -- and the time a spot stays
 * picked over off the island's own `foraged` rows (`Game.foragedFromIsland`).
 *
 * `full` adds what the rest of the year holds: the finds out of season.
 */
export function yieldLines(g: Game, x: number, y: number, full = false): string[] {
  const w = g.world;
  if (!w.inBounds(x, y)) return [];
  const type = w.getTile(x, y);
  const def = TILE_DEFS[type];
  const lines: string[] = [];
  const now = g.wallNow();
  const cap = (n: number): number => Math.ceil(n - 1e-9);

  // Water: what a line can bring up here at this hand, and what wants more.
  if (fishable(g, x, y)) {
    const { pool, later } = fishFor(g, waterDepth(g, x, y));
    // The ceiling is the rod's to say, so only with one carried.
    const ql = g.inventory.has('fishing_rod') ? ` · QL up to ${cap(g.qlCeiling('fishing', g.toolQl('fishing_rod')))}` : '';
    lines.push(pool.length ? `Fish: ${pool.map((f) => f.name.toLowerCase()).join(', ')}${ql}`
      : `Fish: none at fishing ${Math.floor(g.skills.get('fishing'))}`);
    if (later.length) lines.push(`Fish at higher fishing: ${laterSaid(later)}`);
  }

  // Foraging and botanizing: picked over or not, the looks a go takes and its most quality.
  const search = (job: 'forage' | 'botanize', skill: string, name: string, table: Array<[string, number]>): void => {
    const left = g.foragedLeft(x, y, job);
    lines.push(left > 0 ? `${name}: searched · ${readySaid(g, x, y, job)}`
      : `${name}: ready · ${searchOdds(g, job, skill)} · QL up to ${cap(g.qlCeiling(skill))}`);
    const out = table.filter(([id]) => !fruitsAt(id, now)).map(([id]) => itemDef(id).name.toLowerCase());
    if (full && out.length) lines.push(`${name} out of season: ${out.join(', ')}`);
  };
  if (def.forage) search('forage', 'foraging', 'Forage', FORAGE_TABLE);
  if (def.botanize) search('botanize', 'botanizing', 'Botanize', BOTANIZE_TABLE);

  // What a tree or a bush bears: in season or when, picked or ready, and its most quality.
  const bears = (id: string, ql: number, young: boolean): void => {
    const name = itemDef(id).name;
    const season = seasonWindow(id, now);
    if (young) lines.push(`${name}: too young to bear`);
    else if (!fruitsAt(id, now)) lines.push(`${name}: ${season}`);
    else lines.push(`${name}: ${season ? `${season} · ` : ''}${readySaid(g, x, y, 'forage')} · QL up to ${cap(ql)}`);
  };
  if (type === TileType.Tree) {
    const data = w.getData(x, y);
    const age = treeAge(data);
    const fruit = TREE_DEFS[treeSpecies(data)].fruit;
    if (fruit && age.alive) bears(fruit, g.qlCeiling('forestry'), !age.bears);
    if (age.alive && age.logs > 0) {
      const left = g.foragedLeft(x, y, 'sprout');
      lines.push(left > 0 ? `Sprout: picked · ${readySaid(g, x, y, 'sprout')}` : `Sprout: ready · QL up to ${cap(g.qlCeiling('forestry'))}`);
    }
  } else if (type === TileType.Bush) {
    const yields = BUSH_DEFS[bushSpecies(w.getData(x, y))].yields;
    if (yields) bears(yields, g.qlCeiling('forestry', g.toolQl('sickle')), false);
  }

  // Wildflowers: how many clumps and their most quality, or picked and when they come again.
  if (type === TileType.Grass) {
    const n = flowersHere(g, x, y, now);
    if (n) lines.push(`Wildflowers: ${n} · QL up to ${cap(g.qlCeiling('foraging'))}`);
    else if (w.getData(x, y) & FLOWERS_PICKED && FLOWER_SEASONS.includes(flowerSeason(now))) lines.push(`Wildflowers: picked · again in ${SEASONS[0]}`);
  }

  // And whatever else was cut or searched here lately, for as long as it is.
  const cut = (kind: string, name: string, done: string): void => {
    if (g.foragedLeft(x, y, kind) > 0) lines.push(`${name}: ${done} · ${readySaid(g, x, y, kind)}`);
  };
  if (CUT_GRASS.has(type)) cut('grass', 'Grass', 'cut');
  if (type === TileType.Moss) cut('moss', 'Moss', 'cut');
  if (type === TileType.Reed) cut('reed', 'Reeds', 'cut');
  cut('dig', 'Investigate', 'searched');
  return lines;
}

/**
 * What a piece of ground is *for*.
 *
 * The tile window already lists everything you could do to a tile this
 * moment, and hovering it says what is standing on it. Neither answers the
 * question you actually have when you are deciding where to put a road, a
 * field or a settlement: what is this ground like to live on. That is all
 * property rather than state — the pace it is walked at, what a loaded cart
 * makes of it, what digging gives you, whether anything grows on it, whether
 * it will take paving — and none of it shows anywhere until you have tried it
 * and noticed.
 *
 * Every line is a number read out of the tile's own definition, so this cannot
 * drift away from what the game actually does.
 */
export function tileUses(g: Game, x: number, y: number): string[] {
  const w = g.world;
  const type = w.getTile(x, y);
  const def = TILE_DEFS[type];
  const lines: string[] = [`${def.name}: uses`];

  // Getting about on it, on foot and under a load.
  if (def.blocks) lines.push('Not walkable.');
  else {
    const pace = Math.round(def.speed * 100);
    const laden = Math.round(groundRoll(def.roll, 1) * 100);
    lines.push(`Walk speed ${pace}% · laden cart speed ${laden}%`);
    // And whether it can be stood on at all, which is the one thing about a
    // dug tile you otherwise find out by walking into it.
    const slope = w.slope(x, y);
    // A flight of steps is stood on at any slope a flight is laid on.
    const cap = standCap(type, g.standSlope());
    if (slope > cap) lines.push(`Slope ${metres(slope)} m: too steep (your max ${metres(Math.floor(cap))} m, raised by climbing)`);
    else if (slope > SLOW_SLOPE) lines.push(`Slope ${metres(slope)} m: walk speed ${Math.round((100 * SLOW_SLOPE) / slope)}%`);
  }

  // Working it with a tool.
  if (def.digYield) {
    const gives = itemDef(def.digYield).name.toLowerCase();
    lines.push(`Shovel: ${def.collect ? `collect ${gives}, ground unchanged` : `dig ${gives}${def.turnsToDirt ? ', tile becomes dirt' : ''}`}`);
  }
  if (def.mineable) lines.push('Pickaxe: mine for its contents; lowers corner by corner');

  // What grows on it and what it gives now (`yieldLines`).
  lines.push(...yieldLines(g, x, y, true));
  // What feet do to it. The wear itself is the island's to count on an island, and only
  // said here where this browser keeps it (`World.wear`).
  const worn = g.ask ? '' : ` · wear ${w.wearAt(x, y)}`;
  if (type === TileType.Trail) {
    const was = TILE_DEFS[trailGround(w.getData(x, y))].name.toLowerCase();
    lines.push(`Trail: back to ${was} when wear reaches 0 (−${WEAR_FALL} at each ${DAILY_RESET}, max ${WEAR_MOST})${worn}`);
  } else if (WEARS.has(type)) {
    lines.push(`Wear: +1 per step, trail at ${WEAR_TRAIL}, −${WEAR_FALL} at each ${DAILY_RESET}${worn}`);
  }
  // What a fruit tree bears or a bush is cut for, in which seasons (`fruiting.ts`); whether now is `yieldLines`'.
  const borne = type === TileType.Tree ? TREE_DEFS[treeSpecies(w.getData(x, y))].fruit
    : type === TileType.Bush ? BUSH_DEFS[bushSpecies(w.getData(x, y))].yields : undefined;
  if (borne) lines.push(`${itemDef(borne).name} in ${listed(fruitingSeasons(borne))}`);
  if (TILLABLE.has(type)) lines.push('Rake: becomes a field');
  // What a harvest gives, untended and tended at every stage (`cropYield`), as the island's `crop_yield`.
  if (type === TileType.Field) lines.push(`Harvest: ${cropYield(0).produce} untended, ${cropYield(RIPE).produce} tended every stage; ${seedSays()}`);

  // What can be laid over it or built on it. Saying a road will not take a
  // road, or that bare rock will not take one, is not worth a line.
  const paved = type === TileType.Cobblestone || type === TileType.Slabs;
  if (type === TileType.Steps) {
    lines.push(`${w.tileName(x, y)}: walkable at any slope up to ${metres(STEPS_MOST)} m; no wheels`);
    lines.push(`Pickaxe: remove; returns ${stepsTimber(w.getData(x, y)) ? `${stepsBack(STEPS_PLANKS)}/${STEPS_PLANKS} planks` : `${stepsBack(STEPS_SLABS)}/${STEPS_SLABS} slabs and ${stepsBack(STEPS_BRICKS)}/${STEPS_BRICKS} bricks`}; leaves packed dirt`);
  } else if (type === TileType.PackedDirt) {
    const why = stepsGroundRefusal(w.corners(x, y, [0, 0, 0, 0]));
    lines.push(why ? `Garden steps: not here. ${why}` : `Garden steps: ${STONE_STEPS_BILL} with a trowel, or ${TIMBER_STEPS_BILL} with a mallet`);
  }
  if (paved) lines.push('Paved. Pickaxe: break up to dirt.');
  else if (def.pavable) lines.push('Pavable: cobblestone or slabs, after packing');
  else if (!def.blocks && type !== TileType.Rock) lines.push('Not pavable');

  // What it does underfoot, which is the one thing about ground you notice.
  const dust = dustiness(type);
  if (dust >= 0.8) lines.push('Dust: heavy');
  else if (dust === 0) lines.push('Dust: none');
  else if (dust <= 0.12) lines.push('Dust: light');

  return lines;
}
