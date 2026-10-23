import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { QL_TOP } from './limits';

/**
 * Maps: a sheet of papyrus with a square of the island drawn onto it.
 *
 * The map window shows only what you have seen (the fog of war: `world.seen`,
 * kept on the island as `fog`). A map is how somebody else's walking gets
 * onto it. Draw one standing somewhere and it holds the square of tiles round
 * that spot, as far each way as its quality reaches (`chartReach`); Study it
 * and that square goes on your own map; Copy it onto a fresh sheet and hand
 * the copy on like anything else in a pack.
 *
 * What a map holds is written on the item (`extra`, which its name shows):
 * `14 tiles round 512, 300`. The island reads the same words back
 * (`chart_extra`, `chart_of`) and keeps every square studied in `charted`, so
 * a map read on one machine is on the map of every other.
 */

/** The map, and what it is drawn on. */
export const CHART_ITEM = 'drawn_map';
export const CHART_SHEET = 'papyrus';
/** The trade it is drawn and copied with, and whose level sets its quality. */
export const CHART_SKILL = 'papyrusmaking';
/** The three jobs. */
export const DRAW_MAP = 'draw_map';
export const STUDY_MAP = 'study_map';
export const COPY_MAP = 'copy_map';

/** Tiles each way from where it was drawn that a map of QL 0 reaches. */
export const CHART_LEAST = 4;
/** And one tile further each way for every so many QL. */
export const CHART_QL_PER_TILE = 5;

/** Seconds at skill 1, and the wind each costs. */
export const DRAW_TIME = 20;
export const COPY_TIME = 15;
export const STUDY_MAP_TIME = 5;
export const CHART_WIND = 0.03;

/** How far each way from where it was drawn a map of this quality reaches. */
export const chartReach = (ql: number): number => CHART_LEAST + Math.floor(Math.max(0, ql) / CHART_QL_PER_TILE);
/** The side of the square, in tiles. */
export const chartSide = (reach: number): number => reach * 2 + 1;

/** What a map holds: the tile it was drawn on and how far it reaches each way. */
export interface Chart { x: number; y: number; r: number }

/** What is written on the map's `extra`. The island's `chart_extra`. */
export const chartExtra = (c: Chart): string => `${c.r} tiles round ${c.x}, ${c.y}`;
const EXTRA = /^(\d+) tiles round (\d+), (\d+)$/;
/** And read back, or null for anything that is not one. The island's `chart_of`. */
export function chartOf(it: Pick<Item, 'id' | 'extra'> | undefined): Chart | null {
  if (!it || it.id !== CHART_ITEM) return null;
  const m = EXTRA.exec(it.extra ?? '');
  return m ? { r: Number(m[1]), x: Number(m[2]), y: Number(m[3]) } : null;
}

/** The square in words: "the 29 by 29 tiles round 512, 300". */
const square = (c: Chart): string => `${chartSide(c.r)}×${chartSide(c.r)} tiles round ${c.x}, ${c.y}`;

/** What Examine adds of a map. The island's `chart_item_says`. */
export const chartItemSays = (it: Pick<Item, 'id' | 'extra'>): string => {
  const c = chartOf(it);
  if (!c) return '';
  return ` Map: ${square(c)}. Study it to add all ${chartSide(c.r) ** 2} tiles to your map.`;
};

/** What drawing, studying and copying say. The island's `chart_said`. */
export const drawnSaid = (c: Chart, ql: number): string =>
  `Drawn: ${square(c)}, QL ${ql.toFixed(1)}.`;
export const studiedSaid = (c: Chart): string => `Studied: ${square(c)} added to your map.`;
export const copiedSaid = (c: Chart, ql: number): string =>
  `Copied: ${square(c)}, QL ${ql.toFixed(1)}.`;

/** Why a map job will not go. The island's `chart_said`. */
export const CHART_SAID = {
  noSheet: 'Need a sheet of papyrus.',
  notMap: 'Not a map.',
  blank: 'Map is blank.',
  noCopySheet: 'Need a sheet of papyrus.',
};

/**
 * What a map is drawn or copied at: your papyrusmaking, as any work done with
 * no tool comes out (`productQl`), and never better than the sheet under the
 * ink -- nor, for a copy, the map it is copied from.
 */
export const chartQl = (made: number, ...caps: number[]): number => Math.max(1, Math.min(made, ...caps));

/** The best sheet of papyrus in the pack, which a copy goes onto. The island's `chart_sheet`. */
export const bestSheet = (g: Game): Item | undefined => g.inventory.items
  .filter((it) => it.id === CHART_SHEET && !it.locked)
  .sort((a, b) => b.ql - a.ql || a.uid - b.uid)[0];

const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a map job cannot be done, or null, in the island's order (`chart_refusal`). */
export function chartRefusal(g: Game, id: string, t: Target): string | null {
  const it = held(g, t);
  if (id === DRAW_MAP) return it?.id === CHART_SHEET ? null : CHART_SAID.noSheet;
  if (it?.id !== CHART_ITEM) return CHART_SAID.notMap;
  if (!chartOf(it)) return CHART_SAID.blank;
  if (id === COPY_MAP && !bestSheet(g)) return CHART_SAID.noCopySheet;
  return null;
}

/**
 * Put a map's square on your own map: every tile of it, inside the island,
 * remembered as it stands now. The island keeps the same square in `charted`
 * and hands it to the browser that studied it, and to every later sitting.
 */
export function learnChart(g: Game, c: Chart): number {
  return g.vision.learnSquare(c.x, c.y, c.r);
}

/**
 * The square a `charted` line names: what the island says to the browser that
 * studied a map, `{"x":..,"y":..,"r":..}`, put on its map rather than in its
 * log (`perform_chart`). Null for anything else.
 */
export function chartedSquare(text: string): Chart | null {
  try {
    const c = JSON.parse(text) as { x?: unknown; y?: unknown; r?: unknown };
    return typeof c.x === 'number' && typeof c.y === 'number' && typeof c.r === 'number' ? { x: c.x, y: c.y, r: c.r } : null;
  } catch {
    return null;
  }
}

export const CHART_ACTIONS: ActionDef[] = [
  {
    id: DRAW_MAP,
    label: 'Draw a map',
    verb: 'drawing a map',
    skill: CHART_SKILL,
    stamina: CHART_WIND,
    baseTime: DRAW_TIME,
    applies: (t, g) => held(g, t)?.id === CHART_SHEET,
    check: (t, g) => chartRefusal(g, DRAW_MAP, t),
    perform: (t, g) => {
      const sheet = held(g, t);
      if (!sheet || chartRefusal(g, DRAW_MAP, t)) return;
      const ql = chartQl(g.productQl(CHART_SKILL), sheet.ql);
      const c: Chart = { x: g.player.tileX, y: g.player.tileY, r: chartReach(ql) };
      g.inventory.remove(sheet.uid, 1);
      g.inventory.add(CHART_ITEM, { ql, extra: chartExtra(c) });
      g.note('charted');
      g.logMsg(drawnSaid(c, ql), 'event');
    },
  },
  {
    id: STUDY_MAP,
    label: 'Study map',
    verb: 'studying a map',
    stamina: 0,
    baseTime: STUDY_MAP_TIME,
    applies: (t, g) => held(g, t)?.id === CHART_ITEM,
    check: (t, g) => chartRefusal(g, STUDY_MAP, t),
    perform: (t, g) => {
      const c = chartOf(held(g, t));
      if (!c) return;
      learnChart(g, c);
      g.logMsg(studiedSaid(c), 'event');
    },
  },
  {
    id: COPY_MAP,
    label: 'Copy map',
    verb: 'copying a map',
    skill: CHART_SKILL,
    stamina: CHART_WIND,
    baseTime: COPY_TIME,
    applies: (t, g) => held(g, t)?.id === CHART_ITEM,
    check: (t, g) => chartRefusal(g, COPY_MAP, t),
    perform: (t, g) => {
      const map = held(g, t);
      const from = chartOf(map);
      const sheet = bestSheet(g);
      if (!map || !from || !sheet) return;
      const ql = chartQl(g.productQl(CHART_SKILL), sheet.ql, map.ql);
      // A worse copy loses its edges: never further than the copy's own quality reaches.
      const c: Chart = { ...from, r: Math.min(from.r, chartReach(ql)) };
      g.inventory.remove(sheet.uid, 1);
      g.inventory.add(CHART_ITEM, { ql, extra: chartExtra(c) });
      g.logMsg(copiedSaid(c, ql), 'event');
    },
  },
];

describeFrom(CHART_ITEM, {
  least: CHART_LEAST,
  perTile: CHART_QL_PER_TILE,
  most: chartReach(QL_TOP),
  top: QL_TOP,
  sheet: itemDef(CHART_SHEET).name.toLowerCase(),
});
