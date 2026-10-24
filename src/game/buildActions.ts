import { litresAtHand, lyeCarried, LYE_USE, NEED_LYE, takeLitres } from './placeables';
import type { ActionDef, Target } from './actions';
import {
  borderOf,
  CELLAR_DEPTH,
  describeNeeds,
  scaledBill,
  FLOOR_KIND_NAMES,
  floorName,
  floorKind,
  isDone,
  MATERIAL_BY_ID,
  MAX_LEVELS,
  SIDE_NAMES,
  gapText,
  heftWord,
  onlyRefusal,
  roofShapeDef,
  storeySkill,
  WALL_TYPE_BY_ID,
  type Bill,
  type Building,
  type Side,
  type Wall,
  type WallType,
  type FloorKind,
  type MaterialDef,
  jobLevel,
  NO_PLAN_FROM,
} from './building';
import { dyeChoice, dyeEnough, dyeReason, litresWord, paneTint, pickDye, spendDye, TINTED_PANE } from './dyes';
import { capital } from './words';
import { colourWord, DYE_LITRES } from './dyestuffs';
import type { Game } from './game';
import { gatePlanRefusal, gateRemoveRefusal, planGate, planLine } from './gates';
import { greenNow } from './greening';
import { glassPlanRefusal, glassResync } from './glasshouse';
import { counterGone, counterPlanRefusal, counterRemoveRefusal, counterStreetRefusal } from './counters';
import { lampWallRefusal } from './lamps';
import { itemDef } from './items';
import { billPlus, deckBears, deckCarries, metres, pierBill, pierDrop } from './piers';
import { TileType } from '../world/tiles';
import { floorHolds, jettyOnWall, jettyOver, jettyReason, jettyRoofOnWall, storeyOf, storeyOnWall, terraceRailed, wallFrameReason, wallLevelOf } from './frame';

type TileTarget = Extract<Target, { kind: 'tile' }>;
const isTile = (t: Target): t is TileTarget => t.kind === 'tile';

const TOOL_NAMES: Record<string, string> = { mallet: 'a mallet', trowel: 'a trowel' };
export const needTool = (g: Game, tool: string): string | null => (g.inventory.has(tool) ? null : `Need ${TOOL_NAMES[tool] ?? tool}.`);

/** Plural-ish item names for material lists. */
export function materialName(id: string, n: number): string {
  const name = itemDef(id).name.toLowerCase();
  if (n === 1 || name.endsWith('s') || ['mortar', 'thatch', 'adobe'].includes(name)) return name;
  return `${name}s`;
}

export const needsText = (bill: Bill): string => describeNeeds(bill, materialName);

import { buildWork, consumeUnit, nextAvailable, takeUnit, toHand } from './buildstock';
export { buildReach, buildWork, consumeUnit, nextAvailable, takeUnit, toHand } from './buildstock';

/**
 * A Mason's Repoint.
 *
 * A finished stone wall laid again in another stone, in one go: the new
 * stone's whole bill is paid out of whatever a wall may be built out of, the
 * fittings stay where they are, and `REPOINT_BACK` of the old stone comes
 * back -- the bricks, shards or adobe, not the mortar, which is spent once it
 * has set. The paint goes with the old face.
 */
/**
 * The share of its material a wall of this type is planned for: all of it,
 * or less for a fence type and a Carpenter's Fence Builder (`bill:fence`).
 * A fence type is one that stands on its own border (`FENCE_TYPES`), wherever
 * it is planned; the island asks the same of `wall_type_def.standalone`.
 */
export const fenceScale = (g: Game, type: WallType): number =>
  WALL_TYPE_BY_ID.get(type)?.standalone ? g.perk('bill:fence', 1) : 1;

export const REPOINT_BACK = 0.5;
export const REPOINT_TIME = 30;
/** What a wall of `mat` is laid in, without its fittings: the bill a Repoint pays. */
export const layingBill = (mat: string, type: Wall['type']): Bill => scaledBill(mat, WALL_TYPE_BY_ID.get(type)?.factor ?? 1);

function repointReason(g: Game, t: TileTarget): string | null {
  if (g.perk('repoint', 0) <= 0) return 'Needs perk: Repoint (Mason).';
  if (!t.side) return 'Choose a side.';
  const wall = wallAt(g, t);
  if (!wall) return 'No wall there.';
  const was = material(wall.material);
  if (was?.kind !== 'stone') return 'Stone walls only.';
  if (!isDone(wall)) return 'Finish it first.';
  const mat = material(t.material);
  if (!mat || mat.kind !== 'stone') return 'Choose a stone.';
  if (mat.id === was.id) return `Already ${mat.name.toLowerCase()}.`;
  const only = onlyRefusal(mat.id, { wall: wall.type });
  if (only) return only;
  const tool = needTool(g, mat.tool);
  if (tool) return tool;
  const b = storeyOf(g, t);
  if (b && wall.building === b.id) {
    // What is under it has to carry the new stone, as it would a new wall,
    // and the new stone has to carry what stands on it.
    // A building on piers stands on its decks, which carry what they are laid in (`piers.ts`).
    const deck = b.deck != null ? deckCarries(mat, g.buildings.deckUnder(b), b.name) : null;
    if (deck) return deck;
    const bears = g.buildings.bearing(b, wall.level);
    if (mat.heft > bears) return `${mat.name} too heavy for what is under it: this storey carries ${heftWord(bears)} at most.`;
    let over = 0;
    for (const w of g.buildings.walls.values()) {
      if (w.building === b.id && w.level > wall.level) over = Math.max(over, material(w.material)?.heft ?? 0);
    }
    if (mat.heft < over) return `${mat.name} cannot carry the ${heftWord(over)} above it.`;
    const stands = mat.storeys + g.perk(`storeys:${buildWork(mat)}`, 0);
    if (b.levels > stands) return `${mat.name}: max ${stands} storeys; this is ${b.levels}.`;
  }
  const bill = layingBill(mat.id, wall.type);
  const short = Object.entries(bill.needed).filter(([id, n]) => toHand(g, id, mat, t) < n);
  if (short.length) return `Need ${needsText(bill)}.`;
  return null;
}

const buildingOf = (g: Game, t: TileTarget): Building | undefined => g.buildings.buildingAt(t.x, t.y);
/** The storey a floor job is for: the one it names, or the one being worked (`jobLevel`). */
const topLevel = (b: Building, t: TileTarget): number => jobLevel(b, t);
/**
 * The storey a floor job works on: the roof's, over the top storey; the
 * ground floor's, for a flight or a ladder down to a cellar (`down`), whatever
 * storey the building is being worked on; and otherwise the one the job names,
 * or the one being worked (`jobLevel`).
 */
const slotLevel = (t: TileTarget, b: Building): number => (t.floorKind === 'roof' ? b.levels : t.down ? 0 : topLevel(b, t));
/**
 * Whether a flight or a ladder down planned here goes in where the ground
 * floor is floored: it takes the flooring up, as taking the flooring up
 * would, rather than asking for it to be taken up first -- which on a tile
 * with a wall along it is not to be had while the wall stands.
 */
const flooringUnder = (g: Game, t: TileTarget, level: number, kind: FloorKind): boolean => {
  const there = g.buildings.floor(level, t.x, t.y);
  return level === 0 && (kind === 'stairs' || kind === 'ladder') && !!there && floorKind(there) === 'floor';
};
/** The tile across a side of another: where the foot of a flight climbed from that side lands. */
const across = (x: number, y: number, side: Side): [number, number] =>
  side === 'n' ? [x, y - 1] : side === 's' ? [x, y + 1] : side === 'w' ? [x - 1, y] : [x + 1, y];
/**
 * Why a flight or a ladder cannot go down from the ground floor here, into
 * the cellar under it, or null. It stands over a tile of the cellar and comes
 * down, on the side it is climbed from, onto another: the island's
 * `cellar_flight_refusal` says the same.
 */
function flightDownReason(g: Game, t: TileTarget, b: Building): string | null {
  const c = g.buildings.cellar(t.x, t.y);
  if (!c && !t.down) {
    // Not a way down, so a way up: jobs go to the storey being worked on (`jobLevel`), and in a building with one over the ground it is that storey to work on.
    return b.levels > 1 ? `Plan ${t.floorKind === 'ladder' ? 'a ladder' : 'stairs'} from storey 2 or above.`
      : 'Stairs and ladders need an upper storey: plan one first.';
  }
  const dug = c?.dug ?? 0;
  if (dug < CELLAR_DEPTH) return `Dig the cellar first: ${metres(dug)} m of ${metres(CELLAR_DEPTH)} m dug.`;
  // A glasshouse's field is cleared before anything is planned over it (`glasshouse.ts`).
  if (g.world.getTile(t.x, t.y) === TileType.Field) return 'Field here: clear it first.';
  if (!t.side) return 'Choose the side to climb from.';
  const [fx, fy] = across(t.x, t.y, t.side);
  if (g.buildings.cellar(fx, fy)?.building !== b.id || !g.buildings.cellarDone(fx, fy)) {
    return `Foot would land on ${fx},${fy}: no cellar dug there.`;
  }
  return null;
}
/**
 * Why a flight or a ladder cannot go in here because one the other way is
 * on the same tile, or null. A flight up from the ground floor and a flight
 * down from it would both be walked onto from the ground floor's tile, and
 * only the one would ever be taken: one way off the ground floor a tile. The
 * island's `cellar_stack_refusal` says the same.
 */
function stackedFlightReason(g: Game, t: TileTarget, level: number): string | null {
  const other = level === 1 ? g.buildings.floor(0, t.x, t.y) : level === 0 ? g.buildings.floor(1, t.x, t.y) : undefined;
  if (!other || (floorKind(other) !== 'stairs' && floorKind(other) !== 'ladder')) return null;
  const what = FLOOR_KIND_NAMES[floorKind(other)];
  return level === 1 ? `${capital(what)} down to the cellar is there.` : `${capital(what)} up to the next storey is there.`;
}
/** The storey wall work happens on: a building's working one, a jetty's, round a flat roof, or the ground (`wallLevelOf`). */
const wallLevel = (g: Game, t: TileTarget): number => wallLevelOf(g, t);
/** The wall or fence on the side of a tile that is being worked on. */
const wallAt = (g: Game, t: TileTarget) => (t.side ? g.buildings.wall(wallLevel(g, t), t.x, t.y, t.side) : undefined);
const material = (id: string | undefined): MaterialDef | undefined => (id ? MATERIAL_BY_ID.get(id) : undefined);

const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];
/**
 * Why a side cannot be marked No plan (`no_plan`), or the mark taken off it
 * (`mark_out`), or null: a bare outside side of a building's storey 2 and up,
 * on the storey the job names (`jobLevel`). The island's `no_plan_refusal`
 * says the same, in the same order.
 */
export function noPlanReason(g: Game, t: TileTarget, id: 'no_plan' | 'mark_out'): string | null {
  if (!t.side || !SIDES.includes(t.side)) return 'Choose a side.';
  const b = buildingOf(g, t);
  if (!b) return 'No building here.';
  const level = jobLevel(b, t);
  if (level < NO_PLAN_FROM) return `Storey ${NO_PLAN_FROM + 1} and up only.`;
  const [ox, oy] = across(t.x, t.y, t.side);
  if (g.buildings.buildingAt(ox, oy)?.id === b.id) return 'Outside sides only.';
  if (g.buildings.wall(level, t.x, t.y, t.side)) return 'Already a wall on that side.';
  const marked = g.buildings.noPlan(level, borderOf(t.x, t.y, t.side));
  if (id === 'no_plan' && marked) return 'Already no plan.';
  if (id === 'mark_out' && !marked) return 'Already marked out.';
  return null;
}

/** Building work. These are hidden from the generic menu; the UI composes them with sides and materials. */
export const BUILD_ACTIONS: ActionDef[] = [
  {
    id: 'plan_building',
    label: 'Plan building',
    verb: 'planning a building',
    hidden: true,
    asks: {
      question: 'Building name:',
      fallback: () => 'House',
      declined: 'Nothing planned.',
    },
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => isTile(t) && !g.buildings.buildingAt(t.x, t.y),
    // Nor under a jetty (`frame.ts`), nor on the street a shop counter sells onto (`counters.ts`).
    check: (t, g) => (isTile(t) ? (jettyOver(g, t.x, t.y) ?? needTool(g, 'mallet') ?? g.planReason(t.x, t.y) ?? counterStreetRefusal(g, t.x, t.y)) : null),
    perform: (t, g) => {
      if (!isTile(t)) return;
      const name = ((t as { name?: string }).name ?? '').trim();
      // On level ground, as it stands; anywhere else, on piers under a deck at the tile's top (`piers.ts`).
      const site = g.foundationAt(t.x, t.y) ? null : g.pierSite(t.x, t.y);
      const deck = site?.deck ?? undefined;
      const b = g.buildings.create(name.slice(0, 32) || 'House', t.x, t.y, deck);
      // Nothing walks under a deck: a creature standing there is moved off (`Creatures.shoo`).
      if (deck !== undefined) g.creatures.shoo(g, t.x, t.y);
      if (site && deck !== undefined) {
        g.logMsg(`Planned: ${b.name}, on piers. Deck at ${metres(deck)} m, ${metres(pierDrop(site.ground, deck))} m over the lowest ground.`
          + ' Next: plan the deck (builds the piers), then walls.', 'event');
      } else {
        g.logMsg(`Planned: ${b.name}. Next: extend onto adjacent packed tiles, then plan walls on its borders.`, 'event');
      }
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'add_to_building',
    label: 'Add to building',
    verb: 'extending the plan',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !g.buildings.buildingAt(t.x, t.y) && !!g.buildings.neighbourBuilding(t.x, t.y),
    check: (t, g) => {
      if (!isTile(t)) return null;
      const over = jettyOver(g, t.x, t.y);
      if (over) return over;
      const tool = needTool(g, 'mallet');
      if (tool) return tool;
      const b = g.buildings.neighbourBuilding(t.x, t.y);
      if (!b) return 'No building next to this tile.';
      if (b.levels > 1) return 'Footprint fixed once upper storeys are planned.';
      return g.planReason(t.x, t.y, b) ?? counterStreetRefusal(g, t.x, t.y);
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = g.buildings.neighbourBuilding(t.x, t.y);
      if (!b) return;
      // Under the building's deck, or its floor if it has no deck yet, where the ground is not level with it (`piers.ts`).
      const site = g.foundationAt(t.x, t.y) ? null : g.pierSite(t.x, t.y, b);
      const deck = site?.deck ?? undefined;
      g.buildings.addTile(b, t.x, t.y, deck);
      if (deck !== undefined) g.creatures.shoo(g, t.x, t.y);
      // A tile with no glass over it: a glasshouse is one no longer, and what grows in it goes back on the field's clock.
      glassResync(g);
      if (site && deck !== undefined) {
        g.logMsg(`Added to ${b.name}, on piers: deck at ${metres(deck)} m, ${metres(pierDrop(site.ground, deck))} m over the lowest ground.`, 'event');
      } else {
        g.logMsg(`Added to ${b.name}.`, 'event');
      }
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'remove_from_plan',
    label: 'Remove from plan',
    verb: 'removing the plan',
    hidden: true,
    stamina: 0.01,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !!buildingOf(g, t),
    check: (t, g) => {
      if (!isTile(t)) return null;
      const b = buildingOf(g, t);
      if (!b) return 'No building here.';
      if (b.levels > 1) return 'Remove the upper storeys first.';
      // A building with a cellar under it comes down only once the cellar is filled in: see `cellar.ts`.
      if (g.buildings.cellar(t.x, t.y)) return 'Fill in the cellar first.';
      if (g.buildings.tileHasStructures(t.x, t.y)) return 'Remove this tile\'s walls and floor first.';
      // And the columns on its corners, which would be left standing on nothing.
      for (const [cx, cy] of [[t.x, t.y], [t.x + 1, t.y], [t.x + 1, t.y + 1], [t.x, t.y + 1]]) {
        if (g.buildings.column(0, cx, cy)) return 'Remove the corner columns first.';
      }
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = buildingOf(g, t);
      if (!b) return;
      g.buildings.removeTile(b, t.x, t.y);
      glassResync(g);
      g.logMsg(b.tiles.length ? `Removed from ${b.name}.` : `Plan removed: ${b.name}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'plan_wall',
    label: 'Plan wall',
    verb: 'planning a wall',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !!storeyOf(g, t),
    check: (t, g) => {
      if (!isTile(t) || !t.side || !t.wallType || !t.material) return 'Choose a side, wall type and material.';
      // Glass goes on a roof and nowhere else (`glasshouse.ts`).
      const glass = glassPlanRefusal(g, t, 'plan_wall');
      if (glass) return glass;
      const tool = needTool(g, 'mallet');
      if (tool) return tool;
      const b = storeyOf(g, t);
      if (!b) return 'No building here.';
      // Round a flat roof only a railing, and a railing only off the ground (`frame.ts`).
      const frame = wallFrameReason(g, t, b);
      if (frame) return frame;
      const level = wallLevel(g, t);
      // On an upper storey, and on the ground floor of a tile on piers, which is its deck.
      if (level > 0 || g.buildings.onPiers(t.x, t.y)) {
        const floor = g.buildings.floor(level, t.x, t.y);
        if (!floor || !isDone(floor)) return 'Build this storey\'s floor first.';
      }
      if (g.buildings.wall(level, t.x, t.y, t.side)) return 'Already a wall on that side.';
      // A shop counter faces the street from the ground floor (`counters.ts`).
      if (t.wallType === 'counter') {
        const street = counterPlanRefusal(g, b, level, t.x, t.y, t.side);
        if (street) return street;
      }
      // Nor does a wall close over a lantern post's arm (`lamps.ts`).
      const arm = lampWallRefusal(g, level, t.x, t.y, t.side, t.wallType);
      if (arm) return arm;
      /*
       * And what is underneath has to carry it. A storey of cut stone raised
       * over a log one is a roof looking for somewhere to fall; the courses
       * below are what hold a wall up, and a beginner finds that out by
       * being told rather than by watching it come down.
       */
      const mat = material(t.material);
      // And a building on piers stands on its decks, which carry what they are laid in (`piers.ts`).
      const deck = mat && b.deck != null ? deckCarries(mat, g.buildings.deckUnder(b), b.name) : null;
      if (deck) return deck;
      const bears = g.buildings.bearing(b, level);
      if (mat && mat.heft > bears) {
        return `${mat.name} too heavy for what is under it: this storey carries ${heftWord(bears)} at most.`;
      }
      // A portcullis in stone on the ground floor; a hidden door's padlock and hinges in hand (`gates.ts`).
      return gatePlanRefusal(t.wallType, mat, level, !g.buildings.buildingAt(t.x, t.y));
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side || !t.wallType || !t.material) return;
      const b = storeyOf(g, t);
      if (!b) return;
      // A fence type stood in a building is still a fence, to a Carpenter's Fence Builder.
      const wall = g.buildings.setWall(b, wallLevel(g, t), t.x, t.y, t.side, t.wallType, t.material, fenceScale(g, t.wallType));
      // gates: a solid wall planned on a border its planner asked a hidden door on takes its padlock and hinges now,
      // and cuts its key, and says so on the end of the plan's own line; and any other type is named as what it is
      // ("a portcullis in stone brick", and a railing as "a log railing"), as the island names it (`planLine`).
      const gate = planGate(g, wall);
      // A glasshouse is walled all round (`glasshouse.ts`).
      glassResync(g);
      g.logMsg(`${planLine(t.wallType, material(t.material)?.name ?? t.material, SIDE_NAMES[t.side])} Needs ${needsText(wall)}.${
        gate ? ` ${gate}` : ''}`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'plan_fence',
    label: 'Plan fence',
    verb: 'planning a fence',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !buildingOf(g, t),
    check: (t, g) => {
      if (!isTile(t) || !t.side || !t.wallType || !t.material) return 'Choose a side, kind and material.';
      const glass = glassPlanRefusal(g, t, 'plan_fence');
      if (glass) return glass;
      const type = WALL_TYPE_BY_ID.get(t.wallType);
      if (!type?.standalone) return 'Only fences and half walls stand alone.';
      const mat = material(t.material);
      const tool = mat ? needTool(g, mat.tool) : 'Choose a material.';
      if (tool) return tool;
      if (buildingOf(g, t)) return 'Part of a building: plan a wall.';
      const border = borderOf(t.x, t.y, t.side);
      // The border is shared, so the tile on the other side of it has a say.
      const [ax, ay] = t.side === 'n' ? [t.x, t.y - 1] : t.side === 's' ? [t.x, t.y + 1] : t.side === 'w' ? [t.x - 1, t.y] : [t.x + 1, t.y];
      if (g.buildings.buildingAt(ax, ay)) return 'Building on the other side of that border.';
      if (!g.world.inBounds(ax, ay)) return 'Map edge.';
      if (g.world.hasWater(t.x, t.y) || g.world.hasWater(ax, ay)) return 'Not in water.';
      if (!g.world.isPassable(t.x, t.y) || !g.world.isPassable(ax, ay)) return 'No room for posts.';
      if (g.buildings.wallOnBorder(0, border)) return 'Border already taken.';
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side || !t.wallType || !t.material) return;
      // For less of the material, for a Carpenter's Fence Builder, as `perform_building` has it.
      const wall = g.buildings.setFence(t.x, t.y, t.side, t.wallType, t.material, fenceScale(g, t.wallType));
      const type = WALL_TYPE_BY_ID.get(t.wallType)?.name.toLowerCase() ?? 'fence';
      g.logMsg(`Planned: ${material(t.material)?.name.toLowerCase()} ${type}, ${SIDE_NAMES[t.side]} border. Needs ${needsText(wall)}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'build_wall',
    label: 'Build wall',
    verb: 'building',
    hidden: true,
    repeat: true,
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => isTile(t) && (!!storeyOf(g, t) || !!wallAt(g, t)),
    check: (t, g) => {
      if (!isTile(t) || !t.side) return 'Choose a side.';
      const wall = wallAt(g, t);
      if (!wall) return 'No wall planned there.';
      if (isDone(wall)) return 'Wall finished.';
      // Nor is one raised over a lantern post's arm (`lamps.ts`).
      const arm = lampWallRefusal(g, wall.level, t.x, t.y, t.side, wall.type);
      if (arm) return arm;
      const mat = material(wall.material);
      const tool = mat ? needTool(g, mat.tool) : null;
      if (tool) return tool;
      if (!nextAvailable(g, wall, t)) return `Need ${needsText(wall)}.`;
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return false;
      const wall = wallAt(g, t);
      if (!wall || isDone(wall)) return false;
      const mat = material(wall.material);
      // A pane fitted into a window or a bay window gives its glass the pane's colour (`TINTED_PANE`).
      const used = consumeUnit(g, wall, t, (from) => {
        if (from.id !== TINTED_PANE) return;
        const tint = paneTint(from);
        if (tint) wall.glass = tint;
        else delete wall.glass;
      });
      if (!used || !mat) return false;
      g.gainSkill(mat.skill, 0.4);
      g.events.emit('world', t.x, t.y);
      // What the last of it starts, as a hod carrier's piece does (`Game.wallFitted`).
      g.wallFitted(wall);
      if (isDone(wall)) {
        const low = WALL_TYPE_BY_ID.get(wall.type)?.low;
        const what = low ? WALL_TYPE_BY_ID.get(wall.type)?.name.toLowerCase() : 'wall';
        // A wall of a building finished, for the journal; a fence is not one (the island's `perform_building` the same).
        if (!low) g.note('walled');
        // And which type, for the journal's rune gate, portcullis and hidden door (the island's the same).
        g.note(`built:${wall.type}`);
        g.logMsg(`Built: ${mat.name.toLowerCase()} ${what}.`, 'event');
        return false;
      }
      g.logMsg(`Added: ${materialName(used, 1)}. Still needed: ${needsText(wall)}.`, 'event');
      return nextAvailable(g, wall, t) !== null;
    },
  },
  /*
   * Paint.
   *
   * Everything on this island comes out the colour of what it was made of, so
   * a street of twelve materials is a street of twelve colours and no more:
   * the builder chooses what a wall is *of* and never what it looks like. A
   * few litres of the same dye the tailoring uses (`DYE_LITRES`), worked into a
   * limewash and brushed over finished work, is the first thing a builder gets
   * to choose. It comes out of one bucket of dye in the pack or one barrel of
   * it within reach, chosen where more than one holds enough (`dyeLitres`).
   */
  {
    id: 'paint_wall',
    label: 'Paint wall',
    verb: 'painting',
    hidden: true,
    skill: 'alchemy',
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => isTile(t) && !!wallAt(g, t),
    dyeLitres: () => DYE_LITRES.wall,
    labelFor: (t, g) => {
      const all = dyeEnough(g, DYE_LITRES.wall);
      return all.length === 1 ? `Paint wall ${colourWord(all[0].hex)}` : 'Paint wall';
    },
    check: (t, g) => {
      if (!isTile(t) || !t.side) return 'Choose a side.';
      const wall = wallAt(g, t);
      if (!wall) return 'No wall there.';
      if (!isDone(wall)) return 'Finish it first.';
      return dyeReason(g, DYE_LITRES.wall, dyeChoice(t), wall.dye, g.dyeReach());
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return;
      const wall = wallAt(g, t);
      const d = pickDye(g, DYE_LITRES.wall, dyeChoice(t));
      if (!wall || !d || !spendDye(g, d, DYE_LITRES.wall)) return;
      wall.dye = d.hex;
      g.gainSkill('alchemy', 0.3);
      g.logMsg(`Painted: ${SIDE_NAMES[t.side]} wall, ${colourWord(d.hex)} (${d.hex}). Dye used: ${litresWord(DYE_LITRES.wall)}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'strip_wall_paint',
    label: 'Remove paint',
    verb: 'scrubbing',
    hidden: true,
    skill: 'alchemy',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => isTile(t) && !!wallAt(g, t)?.dye,
    check: (t, g) => {
      if (!isTile(t) || !t.side) return 'Choose a side.';
      const wall = wallAt(g, t);
      if (!wall?.dye) return 'No colour to remove.';
      if (litresAtHand(lyeCarried(g)) < LYE_USE) return NEED_LYE;
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return;
      const wall = wallAt(g, t);
      if (!wall || !takeLitres(lyeCarried(g), LYE_USE)) return;
      delete wall.dye;
      g.gainSkill('alchemy', 0.2);
      g.logMsg(`Paint removed: bare ${material(wall.material)?.name.toLowerCase() ?? 'stone'}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'repoint_wall',
    label: 'Repoint wall',
    verb: 'repointing',
    hidden: true,
    skill: 'masonry',
    tool: 'trowel',
    stamina: 0.06,
    baseTime: REPOINT_TIME,
    applies: (t, g) => isTile(t) && g.perk('repoint', 0) > 0 && material(wallAt(g, t)?.material)?.kind === 'stone',
    labelFor: (t) => (isTile(t) && t.material ? `Repoint in ${material(t.material)?.name.toLowerCase()}` : 'Repoint wall'),
    check: (t, g) => (isTile(t) ? repointReason(g, t) : null),
    perform: (t, g) => {
      if (!isTile(t) || !t.side || repointReason(g, t)) return;
      const wall = wallAt(g, t);
      const was = material(wall?.material);
      const mat = material(t.material);
      if (!wall || !was || !mat) return;
      const bill = layingBill(mat.id, wall.type);
      for (const [id, n] of Object.entries(bill.needed)) for (let i = 0; i < n; i++) if (!takeUnit(g, id, mat, t)) return;
      // Half the old stone back, rounded down: what was laid of the first thing on its bill.
      const stone = was.bill[0][0];
      const back = Math.floor((wall.total[stone] ?? 0) * REPOINT_BACK);
      if (back > 0) g.inventory.add(stone, { count: back, ql: 20 });
      // The fittings stay where they are; the stone around them is new.
      const fitted = WALL_TYPE_BY_ID.get(wall.type)?.fittings ?? [];
      wall.material = mat.id;
      wall.total = { ...bill.total };
      for (const [id, n] of fitted) wall.total[id] = (wall.total[id] ?? 0) + n;
      wall.needed = Object.fromEntries(Object.keys(wall.total).map((id) => [id, 0]));
      delete wall.dye;
      // New stone, and bare: whatever grew on the old went with it.
      wall.greenSince = greenNow();
      g.gainSkill('masonry', 1);
      g.logMsg(`Repointed: ${SIDE_NAMES[t.side]} wall, ${was.name.toLowerCase()} to ${mat.name.toLowerCase()}`
        + `${back > 0 ? `. Returned: ${back} ${materialName(stone, back)}` : ''}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'paint_floor',
    label: 'Paint floor',
    verb: 'painting',
    hidden: true,
    skill: 'alchemy',
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => {
      if (!isTile(t)) return false;
      const b = storeyOf(g, t);
      return !!b && !!g.buildings.floor(topLevel(b, t), t.x, t.y);
    },
    dyeLitres: () => DYE_LITRES.floor,
    labelFor: (t, g) => {
      const all = dyeEnough(g, DYE_LITRES.floor);
      return all.length === 1 ? `Paint floor ${colourWord(all[0].hex)}` : 'Paint floor';
    },
    check: (t, g) => {
      if (!isTile(t)) return null;
      const b = storeyOf(g, t);
      const floor = b && g.buildings.floor(topLevel(b, t), t.x, t.y);
      if (!floor) return 'No floor here.';
      if (!isDone(floor)) return 'Finish it first.';
      return dyeReason(g, DYE_LITRES.floor, dyeChoice(t), floor.dye, g.dyeReach());
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = storeyOf(g, t);
      const floor = b && g.buildings.floor(topLevel(b, t), t.x, t.y);
      const d = pickDye(g, DYE_LITRES.floor, dyeChoice(t));
      if (!floor || !d || !spendDye(g, d, DYE_LITRES.floor)) return;
      floor.dye = d.hex;
      g.gainSkill('alchemy', 0.3);
      g.logMsg(`Painted: floor, ${colourWord(d.hex)} (${d.hex}). Dye used: ${litresWord(DYE_LITRES.floor)}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'remove_wall',
    label: 'Remove wall',
    verb: 'taking down the wall',
    hidden: true,
    stamina: 0.04,
    baseTime: 4,
    applies: (t, g) => isTile(t) && (!!storeyOf(g, t) || !!wallAt(g, t)),
    check: (t, g) => {
      if (!isTile(t) || !t.side) return 'Choose a side.';
      const wall = wallAt(g, t);
      if (!wall) return 'No wall there.';
      // A jetty resting on it alone would be left in the air, and so would a roof over one, or the storey over it (`frame.ts`).
      const jetty = jettyOnWall(g, wall);
      if (jetty !== null) return `Storey ${jetty + 1} jetty rests on this wall: add a column at each end, or remove the jetty, first.`;
      const over = jettyRoofOnWall(g, wall) ?? storeyOnWall(g, wall);
      if (over) return over;
      // And a shop counter comes down empty, till and all (`counters.ts`).
      const counter = counterRemoveRefusal(g, wall);
      if (counter) return counter;
      // gates: a padlock on a portcullis keeps it from being taken down as from being worked (`gates.ts`).
      return gateRemoveRefusal(g, wall);
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return;
      const wall = wallAt(g, t);
      if (!wall || counterRemoveRefusal(g, wall)) return;
      counterGone(g, wall);
      const what = WALL_TYPE_BY_ID.get(wall.type)?.low ? (WALL_TYPE_BY_ID.get(wall.type)?.name.toLowerCase() ?? 'fence') : 'wall';
      g.buildings.removeWall(wallLevel(g, t), t.x, t.y, t.side);
      // A glasshouse with a wall down is open to the weather (`glasshouse.ts`).
      glassResync(g);
      g.logMsg(`Removed: ${what}, ${SIDE_NAMES[t.side]} side.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  /*
   * No plan: a bare outside side of storey 2 and up drawn with no plan model
   * on it, and the mark taken off again. Shown only: the side stays open to
   * every rule that asks the storey closed in.
   */
  {
    id: 'no_plan',
    label: 'No plan',
    verb: 'clearing the plan model',
    hidden: true,
    stamina: 0.01,
    baseTime: 1,
    applies: (t, g) => isTile(t) && !!buildingOf(g, t),
    check: (t, g) => (isTile(t) ? noPlanReason(g, t, 'no_plan') : 'Choose a side.'),
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return;
      const b = buildingOf(g, t);
      if (!b || noPlanReason(g, t, 'no_plan')) return;
      const level = jobLevel(b, t);
      g.buildings.markNoPlan(b, level, t.x, t.y, t.side);
      g.logMsg(`No plan: ${SIDE_NAMES[t.side]} side, storey ${level + 1}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'mark_out',
    label: 'Mark out',
    verb: 'marking out the side',
    hidden: true,
    stamina: 0.01,
    baseTime: 1,
    applies: (t, g) => isTile(t) && !!buildingOf(g, t),
    check: (t, g) => (isTile(t) ? noPlanReason(g, t, 'mark_out') : 'Choose a side.'),
    perform: (t, g) => {
      if (!isTile(t) || !t.side) return;
      const b = buildingOf(g, t);
      if (!b || noPlanReason(g, t, 'mark_out')) return;
      const level = jobLevel(b, t);
      g.buildings.markOut(level, t.x, t.y, t.side);
      g.logMsg(`Marked out: ${SIDE_NAMES[t.side]} side, storey ${level + 1}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'add_floor',
    label: 'Plan another storey',
    verb: 'planning a storey',
    hidden: true,
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => isTile(t) && !!buildingOf(g, t),
    check: (t, g) => {
      if (!isTile(t)) return null;
      // No storey over a field (`glasshouse.ts`).
      const glass = glassPlanRefusal(g, t, 'add_floor');
      if (glass) return glass;
      const tool = needTool(g, 'mallet');
      if (tool) return tool;
      const b = buildingOf(g, t);
      if (!b) return 'No building here.';
      // A Mason's Tall Walls: stone stands higher in a building of theirs.
      const tall = g.perk('storeys:build_stone', 0);
      if (b.levels >= MAX_LEVELS + tall) return `Max ${MAX_LEVELS + tall} storeys.`;
      /*
       * And no taller than what it is made of will stand.
       *
       * The shortest material in the whole building answers, not the one you
       * are standing on: a plank wing joined to a stone tower caps the tower,
       * because a building is one thing and comes down as one thing.
       */
      const cap = g.buildings.storeyCap(b, tall);
      if (b.levels >= cap) {
        const stands = (m: MaterialDef): number => m.storeys + (m.kind === 'stone' ? tall : 0);
        const worst = g.buildings.materialsIn(b).reduce((a, m) => (a && stands(a) <= stands(m) ? a : m), undefined as MaterialDef | undefined);
        return `${worst?.name ?? 'Its material'}: max ${cap} storeys.`;
      }
      // And the hands to raise it: ten a storey in the trade of the one below.
      const under = g.buildings.storeyMaterial(b, b.levels - 1);
      const want = storeySkill(b.levels);
      if (under && g.skills.get(under.skill) < want) {
        return `Storey ${b.levels + 1} over ${under.name.toLowerCase()} needs ${under.skill} ${want}; have ${g.skills.get(under.skill).toFixed(1)}.`;
      }
      if (g.buildings.hasRoof(b)) return 'Remove the roof first.';
      if (g.buildings.hasLowWall(b, b.levels - 1)) {
        return 'Storey below needs walls, or finished columns at both ends of each open side. Fences, half walls and railings carry nothing.';
      }
      // Only the ground storey closed in before a second; a third and up plans over one still going up.
      if (b.levels === 1) {
        const below = gapText(b.levels, g.buildings.levelGaps(b, b.levels - 1, g.player.x, g.player.y));
        if (below) return below;
      }
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = buildingOf(g, t);
      if (!b) return;
      b.levels += 1;
      b.workLevel = b.levels - 1;
      glassResync(g);
      g.logMsg(`Planned: ${b.name} storey ${b.levels}. Next: floor tiles, then walls.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'plan_floor',
    label: 'Plan floor',
    verb: 'planning a floor',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !!storeyOf(g, t),
    check: (t, g) => {
      if (!isTile(t) || !t.material) return 'Choose a material.';
      // Glass on a pitched roof and nowhere else, no floor over a field, and no roof but glass on a building with one (`glasshouse.ts`).
      const glass = glassPlanRefusal(g, t, 'plan_floor');
      if (glass) return glass;
      const tool = needTool(g, 'mallet');
      if (tool) return tool;
      const b = storeyOf(g, t);
      if (!b) return 'No building here.';
      const kind: FloorKind = t.floorKind ?? 'floor';
      const level = slotLevel(t, b);
      // Out past the footprint: a jetty, or the roof over one (`frame.ts`).
      if (!buildingOf(g, t)) {
        const jetty = jettyReason(g, t, b, kind, level);
        if (jetty) return jetty;
      }
      if (kind === 'roof') {
        // Which storey and which border, because "all walls must be built"
        // reads like a lie while you are standing in a finished room and the
        // storey that is short of a wall is the one planned over your head.
        const top = gapText(b.levels, g.buildings.levelGaps(b, b.levels - 1, g.player.x, g.player.y));
        if (top) return top;
      } else if (kind === 'stairs' || kind === 'ladder') {
        // On the ground floor, a way down to the cellar under it.
        if (level < 1) {
          const down = flightDownReason(g, t, b);
          if (down) return down;
        }
        if (!t.side) return 'Choose the side to climb from.';
        // A flight or a ladder up from a tile on piers stands on its deck.
        if ((level > 1 || g.buildings.onPiers(t.x, t.y)) && !g.buildings.floor(level - 1, t.x, t.y)) return 'Plan the floor below first.';
        const stacked = stackedFlightReason(g, t, level);
        if (stacked) return stacked;
      }
      // A flight or a ladder down takes up the ground floor's flooring where it goes (`flooringUnder`).
      if (g.buildings.floor(level, t.x, t.y) && !flooringUnder(g, t, level, kind)) {
        return kind === 'roof' ? 'Roof already planned here.' : 'Floor already planned here.';
      }
      // A deck on piers carries what it is laid in, and the building standing on it is as heavy as its heaviest wall.
      const mat = material(t.material);
      if (mat && level === 0 && kind === 'floor' && g.buildings.onPiers(t.x, t.y)) return deckBears(mat, g.buildings.heaviestWall(b), b.name);
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t) || !t.material) return;
      const b = storeyOf(g, t);
      if (!b) return;
      const kind: FloorKind = t.floorKind ?? 'floor';
      const level = slotLevel(t, b);
      /*
       * A building has one roof, so the first tile of it decides the shape and
       * the rest follow. Changing your mind means taking the roof off, which
       * is what changing your mind about a roof means anywhere.
       */
      if (kind === 'roof' && !b.roof) b.roof = t.roofShape ?? 'hip';
      if (flooringUnder(g, t, level, kind)) g.logMsg('Flooring removed.', 'event');
      const floor = g.buildings.setFloor(b, level, t.x, t.y, t.material, kind, kind === 'stairs' || kind === 'ladder' ? t.side : undefined,
        kind === 'stairs' ? t.hand : undefined);
      glassResync(g);
      // The ground floor of a tile on piers is its deck, and the piers under it go on its bill (`piers.ts`).
      const piers = level === 0 && kind === 'floor' && g.buildings.onPiers(t.x, t.y);
      if (piers) Object.assign(floor, billPlus(floor, pierBill(t.material, g.pierDropAt(t.x, t.y))));
      const shape = kind === 'roof' ? `${roofShapeDef(b).name.toLowerCase()} ` : '';
      const what = kind === 'ladder' ? 'ladder' : `${shape}${material(t.material)?.name.toLowerCase()} ${piers ? 'deck on piers' : floorName(floor)}`;
      g.logMsg(`Planned: ${what}. Needs ${needsText(floor)}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'build_floor',
    label: 'Build floor',
    verb: 'building',
    hidden: true,
    repeat: true,
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => isTile(t) && !!storeyOf(g, t),
    check: (t, g) => {
      if (!isTile(t)) return null;
      const b = storeyOf(g, t);
      const floor = b && g.buildings.floor(slotLevel(t, b), t.x, t.y);
      if (!floor) return 'Nothing planned here.';
      if (isDone(floor)) return 'Already finished.';
      const mat = material(floor.material);
      const tool = floorKind(floor) === 'ladder' ? needTool(g, 'mallet') : mat ? needTool(g, mat.tool) : null;
      if (tool) return tool;
      if (!nextAvailable(g, floor, t)) return `Need ${needsText(floor)}.`;
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return false;
      const b = storeyOf(g, t);
      const floor = b && g.buildings.floor(slotLevel(t, b), t.x, t.y);
      if (!floor || isDone(floor)) return false;
      const used = consumeUnit(g, floor, t);
      if (!used) return false;
      // What a piece of it starts, as a hod carrier's piece does (`Game.floorFitted`).
      g.floorFitted();
      const kind = floorKind(floor);
      const mat = material(floor.material);
      // Floors are paving; stairs, ladders and roofs are carpentry or masonry by material.
      g.gainSkill(kind === 'floor' ? 'paving' : kind === 'ladder' ? 'carpentry' : (mat?.skill ?? 'carpentry'), 0.4);
      g.events.emit('world', t.x, t.y);
      const what = kind === 'ladder' ? 'ladder' : `${mat?.name.toLowerCase()} ${floorName(floor)}`;
      if (isDone(floor)) {
        // A floor finished on a second storey or higher, for the journal (the island's `perform_building` the same).
        if (kind === 'floor' && slotLevel(t, b) >= 1) g.note('storey');
        // And for the journal's third storey, pier and outside staircase (the island's the same).
        if (kind === 'floor' && slotLevel(t, b) >= 1) g.note(`storey:${slotLevel(t, b) + 1}`);
        if (kind === 'floor' && slotLevel(t, b) === 0 && b.piers?.includes(`${t.x},${t.y}`)) g.note('pier');
        if (g.buildings.outsideStair(t.x, t.y, slotLevel(t, b)) === floor) g.note('outstair');
        g.logMsg(`Built: ${what}.`, 'event');
        return false;
      }
      g.logMsg(`Added: ${materialName(used, 1)}. Still needed: ${needsText(floor)}.`, 'event');
      return nextAvailable(g, floor, t) !== null;
    },
  },
  {
    id: 'remove_floor',
    label: 'Remove floor',
    verb: 'tearing up the floor',
    hidden: true,
    stamina: 0.04,
    baseTime: 4,
    applies: (t, g) => isTile(t) && !!storeyOf(g, t),
    check: (t, g) => {
      if (!isTile(t)) return null;
      const b = storeyOf(g, t);
      if (!b) return 'No building here.';
      const level = slotLevel(t, b);
      const floor = g.buildings.floor(level, t.x, t.y);
      if (!floor) return 'Nothing to remove.';
      // A flight down is let into the ground floor, and the walls round it stand on the ground;
      // and a way down is a way up too, for whoever is down there.
      if (level === 0 && (floorKind(floor) === 'stairs' || floorKind(floor) === 'ladder')) {
        return g.buildings.cellar(t.x, t.y) && g.cellarOccupied(b) ? 'Someone is in the cellar: this is its way out.' : null;
      }
      // A railing round a flat roof stands on it (`frame.ts`).
      if (floorKind(floor) === 'roof' && terraceRailed(g, b, t.x, t.y)) return 'Remove the railing on it first.';
      if (floorKind(floor) !== 'roof') {
        // A wall stands on a floor only where it may not go up without a finished one (`plan_wall`): a storey up, or a
        // deck on piers. On the ground floor it stands on the ground, and a floor still planned carries nothing.
        if (isDone(floor) && (level > 0 || g.buildings.onPiers(t.x, t.y))) {
          for (const side of ['n', 'e', 's', 'w'] as const) if (g.buildings.wall(level, t.x, t.y, side)) return 'Remove the walls on it first.';
        }
        // A column on it, or the roof over a jetty (`frame.ts`).
        const holds = floorHolds(g, b, level, t.x, t.y);
        if (holds) return holds;
      }
      // A deck on piers holds up whatever stands or lies on it, and whoever is taking it up (`deck_refusal`).
      if (level === 0 && g.buildings.onPiers(t.x, t.y)) {
        if (g.anythingPlaced(t.x, t.y) || g.groundAt(t.x, t.y).length) return 'Clear the deck first.';
        if (g.bridges.size && g.bridgeEndAt(t.x, t.y)) return 'Bridge end on the deck: remove the bridge first.';
        const p = g.player;
        if (p.level === 0 && p.tileX === t.x && p.tileY === t.y) return 'Step off the deck first.';
        if (g.peerOn(t.x, t.y)) return 'Someone is on the deck.';
      }
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = storeyOf(g, t);
      if (!b) return;
      const level = slotLevel(t, b);
      const floor = g.buildings.floor(level, t.x, t.y);
      if (!floor) return;
      g.buildings.removeFloor(level, t.x, t.y);
      // Glass taken off a glasshouse: what grows in it goes back on the field's clock.
      glassResync(g);
      const p = g.player;
      if (p.tileX === t.x && p.tileY === t.y && p.level >= level && level > 0) p.level = level - 1;
      g.logMsg(`Removed: ${floorName(floor)}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'remove_storey',
    label: 'Remove top storey',
    verb: 'removing the storey',
    hidden: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && (buildingOf(g, t)?.levels ?? 0) > 1,
    check: (t, g) => {
      if (!isTile(t)) return null;
      const b = buildingOf(g, t);
      if (!b || b.levels <= 1) return 'No upper storey.';
      const level = b.levels - 1;
      if (g.buildings.hasRoof(b)) return 'Remove the roof first.';
      for (const w of g.buildings.walls.values()) if (w.building === b.id && w.level === level) return 'Remove the top storey\'s walls first.';
      for (const f of g.buildings.floors.values()) if (f.building === b.id && f.level === level) return 'Remove the top storey\'s floors first.';
      for (const c of g.buildings.columns.values()) if (c.building === b.id && c.level === level) return 'Remove the top storey\'s columns first.';
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = buildingOf(g, t);
      if (!b || b.levels <= 1) return;
      b.levels -= 1;
      b.workLevel = b.levels - 1;
      // Its sides marked No plan go with it.
      g.buildings.dropNoPlans(b.id, b.levels);
      glassResync(g);
      g.logMsg(`${b.name}: ${b.levels} ${b.levels === 1 ? 'storey' : 'storeys'}.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'rename_building',
    asks: {
      question: 'New building name:',
      fallback: (t, g) => (isTile(t) ? buildingOf(g, t)?.name ?? '' : ''),
    },
    label: 'Rename building',
    verb: 'renaming',
    hidden: true,
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => isTile(t) && !!buildingOf(g, t),
    perform: (t, g) => {
      if (!isTile(t)) return;
      const b = buildingOf(g, t);
      if (!b) return;
      const name = ((t as { name?: string }).name ?? '').trim();
      if (!name) return;
      b.name = name.slice(0, 32);
      g.logMsg(`Building renamed: ${b.name}.`, 'event');
    },
  },
];

export const BUILD_ACTION_BY_ID = new Map(BUILD_ACTIONS.map((a) => [a.id, a]));
