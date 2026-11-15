import type { Side } from './building';
import { ACTION_BY_ID } from './actions';
import { FIRE_COST, FIRE_SUBTILES, fireAnchor } from './campfire';
import { SUBTILES } from './crates';
import type { Game } from './game';
import { groundDecayRate, itemDef, type Item } from './items';
import { DAMAGE_MAX } from './limits';
import { rotSaid } from './rot';
import { SMELTER_H, SMELTER_W, smelterAnchor, smelterSize } from './smelter';
import { KILN_SUBTILES, kilnAnchor } from './kiln';
import { ANVIL_SUBTILES, anvilAnchor } from './anvil';

/**
 * The stations: a campfire, a smelter, a kiln and an anvil. Each is set down
 * the way a piece of furniture is (`UI.startPlacingStation`): it follows the
 * cursor as a ghost, Q and E turn it, a click sets it down, and the island
 * says yes or no with the job it always had (`build_campfire`, `place_smelter`,
 * `place_kiln`, `place_anvil`).
 *
 * Off any settlement a station decays as its item does lying on the ground
 * (`groundDecayRate`; a campfire as the shafts it is laid from), under a roof
 * at the share a roof keeps (`decayMultiplier`), and goes at `DAMAGE_MAX`. On a
 * settlement it does not decay. The island's `station_decay_rate` and
 * `station_sweep`, on the ground's clock (`ground_step`).
 */
export type StationKind = 'campfire' | 'smelter' | 'kiln' | 'anvil';

export interface StationDef {
  kind: StationKind;
  name: string;
  /** The job that sets it down. */
  action: string;
  /** The item carried and set down; a campfire is laid from shafts instead (`FIRE_COST`). */
  item?: string;
  /** Its block of subtiles facing south, across and down. */
  w: number;
  h: number;
  /** The item whose rate on the ground it decays at. */
  decaysAs: string;
}

export const STATIONS: Record<StationKind, StationDef> = {
  campfire: { kind: 'campfire', name: 'Campfire', action: 'build_campfire', w: FIRE_SUBTILES, h: FIRE_SUBTILES, decaysAs: 'shaft' },
  smelter: { kind: 'smelter', name: 'Smelter', action: 'place_smelter', item: 'smelter', w: SMELTER_W, h: SMELTER_H, decaysAs: 'smelter' },
  kiln: { kind: 'kiln', name: 'Kiln', action: 'place_kiln', item: 'kiln', w: KILN_SUBTILES, h: KILN_SUBTILES, decaysAs: 'kiln' },
  anvil: { kind: 'anvil', name: 'Anvil', action: 'place_anvil', item: 'anvil', w: ANVIL_SUBTILES, h: ANVIL_SUBTILES, decaysAs: 'anvil' },
};
export const STATION_KINDS = Object.keys(STATIONS) as StationKind[];
/** The station an item in the pack sets down as, if it is one. */
export const stationOfItem = (id: string): StationKind | undefined => STATION_KINDS.find((k) => STATIONS[k].item === id);

/** Its block of subtiles across and down, turned for the way it faces (the island's `placed_size`). */
export const stationFootprint = (kind: StationKind, facing: Side = 's'): [number, number] =>
  kind === 'smelter' ? smelterSize(facing) : [STATIONS[kind].w, STATIONS[kind].h];

/** Top-left subtile of the block it would take with the cursor on (sx, sy), kept inside the tile. */
export function stationAnchor(kind: StationKind, sx: number, sy: number, facing: Side = 's'): [number, number] {
  if (kind === 'smelter') return smelterAnchor(sx, sy, facing);
  if (kind === 'kiln') return kilnAnchor(sx, sy);
  if (kind === 'anvil') return anvilAnchor(sx, sy);
  return fireAnchor(sx, sy);
}

/** Where the middle of its block is, in tiles. */
export function stationCentreAt(kind: StationKind, x: number, y: number, sx: number, sy: number, facing: Side = 's'): [number, number] {
  const [w, h] = stationFootprint(kind, facing);
  return [x + (sx + w / 2) / SUBTILES, y + (sy + h / 2) / SUBTILES];
}

/** Eighths of a turn the drawing of one facing `facing` is turned by, against the view (`Camera.rotation`). */
export const stationTurn = (facing: Side = 's'): number => (facing === 'e' ? 2 : facing === 'n' ? 4 : facing === 'w' ? 6 : 0);

/** Why it cannot go down on (x, y) at spot (sx, sy) facing `facing`, or null: the job's own check, as the menu and the ghost ask it. */
export function stationPlaceReason(g: Game, kind: StationKind, x: number, y: number, sx: number, sy: number, facing: Side = 's', itemUid?: number): string | null {
  const def = ACTION_BY_ID.get(STATIONS[kind].action);
  if (!def) return 'Not on this island.';
  return def.check?.({ kind: 'tile', x, y, cx: x, cy: y, sx, sy, facing, itemUid }, g) ?? null;
}

/** What it costs to set down, as a label: the item, or the shafts a campfire is laid from. */
export const stationCostSaid = (kind: StationKind): string =>
  kind === 'campfire' ? `${FIRE_COST} × ${itemDef('shaft').name.toLowerCase()}` : itemDef(STATIONS[kind].item ?? kind).name;

/** Anything standing that is a station, as the decay rule reads it. */
export interface StationThing { x: number; y: number; ql?: number; rare?: number; dmg?: number; metal?: string }

/** Its item, as the ground's decay rule reads one (`groundDecayRate`): its kind's item, quality, rarity and, for an anvil, its metal. */
const decayItem = (kind: StationKind, s: StationThing): Item =>
  ({ uid: 0, id: STATIONS[kind].decaysAs, ql: s.ql ?? 20, dmg: 0, count: 1, ...(s.rare ? { rare: s.rare } : {}), ...(kind === 'anvil' && s.metal ? { extra: s.metal } : {}) });

/** Damage an hour off a settlement in the open, at a quality: its item's on the ground. */
export const stationDecayAt = (kind: StationKind, ql: number, rare?: number): number => groundDecayRate(decayItem(kind, { x: 0, y: 0, ql, rare }));

/** Whether any settlement covers a tile: yours, one you were asked into, or a neighbour's. The island's `on_deed`. */
export const onAnySettlement = (g: Game, x: number, y: number): boolean => g.onDeed(x, y) || !!g.deedAt(x, y);

/** Damage an hour where it stands: none on a settlement; off one, its item's, at the share a roof keeps under one. The island's `station_decay_rate`. */
export function stationDecayRate(g: Game, kind: StationKind, s: StationThing): number {
  if (onAnySettlement(g, s.x, s.y)) return 0;
  return groundDecayRate(decayItem(kind, s)) * g.decayMultiplier(s.x, s.y);
}

/** Its condition, as a label: its damage, what it decays at, and when it is gone. */
export function stationCondition(g: Game, kind: StationKind, s: StationThing): string {
  const dmg = s.dmg ?? 0;
  const rate = stationDecayRate(g, kind, s);
  if (rate <= 0) return `Damage: ${dmg.toFixed(1)} · Decay: none on a settlement`;
  const secs = (Math.max(0, DAMAGE_MAX - dmg) / rate) * 3600;
  return `Damage: ${dmg.toFixed(1)} · Decay: ${rate.toFixed(2)}/h off a settlement · Gone in: ${rotSaid(secs)}`;
}
