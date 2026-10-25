/**
 * Plans over an area: a whole storey's walls, a whole storey's floor, a whole
 * roof, or a building's footprint dragged out over a rectangle, laid out as
 * a ghost before it is asked for, with what the lot will take against what
 * is to hand, and taken back again in one go if it went in wrong.
 *
 * Asked for: "previews for multi-tile plans (ghost of the whole plan before
 * committing), cost totals before you commit (sum of every material across
 * the plan, against what you carry/store), undo for a misplaced plan".
 *
 * Every piece is the plan a single click asks for -- `plan_wall`,
 * `plan_floor`, `plan_building`, `add_to_building` -- and is asked of the
 * same check (`ActionDef.check`), so the ghost is red exactly where the
 * single plan would be refused. The island plans the pieces that pass in one
 * call (`rpc_plan_area`), each by its own refusal and its own performer, and
 * keeps the batch for `rpc_plan_undo`: within `PLAN_UNDO_SECONDS` every piece
 * of it still standing is taken down by its own removal, as Remove wall,
 * Remove floor and Remove from plan take one down.
 */
import { ACTION_BY_ID, type ActionDef, type Target } from './actions';
import {
  billPlus,
  pierBill,
} from './piers';
import {
  borderOf,
  floorBill,
  MATERIAL_BY_ID,
  GLASS_ROOF,
  roofShapeOf,
  wallBill,
  type Bill,
  type Building,
  type RoofShape,
  type Side,
  type WallType,
} from './building';
import { fenceScale, needTool } from './buildActions';
import { storedFor } from './buildstock';
import { jettyOver } from './frame';
import { counterStreetRefusal } from './counters';
import type { Game } from './game';

type TileTarget = Extract<Target, { kind: 'tile' }>;

/** The most pieces one plan over an area asks for: the island's `plan_area_most`. */
export const PLAN_AREA_MOST = 64;
/** How long a plan stays to be taken back (`rpc_plan_undo`), in seconds: the island's `plan_undo_seconds`. */
export const PLAN_UNDO_SECONDS = 300;

/** What a plan over an area lays: walls round a storey, its floor, the roof, or a footprint. */
export type AreaKind = 'walls' | 'floor' | 'roof' | 'footprint';

export interface AreaPlan {
  kind: AreaKind;
  /** The building it is for: walls, floor and roof always; a footprint when it is added to one. */
  buildingId?: number;
  /** The storey: walls and floor; the top storey for a roof; 0 for a footprint. */
  level: number;
  material?: string;
  wallType?: WallType;
  /** A roof's shape, chosen with its first tile; after that the building's. */
  roofShape?: RoofShape;
  /** The tile it was asked from: a footprint's first corner. */
  anchor: { x: number; y: number };
  /** A footprint's other corner: the cursor's tile, until the click. */
  corner?: { x: number; y: number };
  /** A new building's name. */
  name?: string;
}

/** One piece of a plan over an area: the job a single click would ask for, why it would be refused, and its bill. */
export interface AreaPiece {
  action: 'plan_wall' | 'plan_floor' | 'plan_building' | 'add_to_building';
  target: TileTarget;
  why: string | null;
  bill: Bill | null;
}

/** What a plan over an area takes of one thing, against what is in the pack and in the stores within reach. */
export interface AreaTotal {
  id: string;
  need: number;
  carried: number;
  stored: number;
}

const STEPS: ReadonlyArray<readonly [Side, number, number]> = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
const tileOf = (k: string): [number, number] => k.split(',').map(Number) as [number, number];
const tileTarget = (x: number, y: number, more: Partial<TileTarget>): TileTarget => ({ kind: 'tile', x, y, cx: x, cy: y, ...more });

/** Why a piece would be refused, by the check a single plan is asked (`ActionDef.check`). */
function refusal(g: Game, id: AreaPiece['action'], t: TileTarget): string | null {
  const def: ActionDef | undefined = ACTION_BY_ID.get(id);
  if (!def) return 'Not on this island.';
  return def.check?.(t, g) ?? null;
}

/** The pieces of a building's plan: walls round the storey, its floor, or its roof, each with the check it would get. */
function buildingPieces(g: Game, plan: AreaPlan, b: Building): AreaPiece[] {
  const bld = g.buildings;
  const out: AreaPiece[] = [];
  const material = plan.material;
  if (!material) return out;
  const inside = new Set(b.tiles);
  if (plan.kind === 'walls') {
    const type = plan.wallType ?? 'solid';
    for (const k of b.tiles) {
      const [x, y] = tileOf(k);
      for (const [side, dx, dy] of STEPS) {
        if (inside.has(`${x + dx},${y + dy}`)) continue;
        // A side already walled or planned is left as it is; so is one marked No plan.
        if (bld.wall(plan.level, x, y, side) || bld.noPlan(plan.level, borderOf(x, y, side))) continue;
        const target = tileTarget(x, y, { side, wallType: type, material, level: plan.level });
        const why = refusal(g, 'plan_wall', target);
        out.push({ action: 'plan_wall', target, why, bill: wallBill(material, type, fenceScale(g, type)) });
      }
    }
  } else if (plan.kind === 'floor') {
    for (const k of b.tiles) {
      const [x, y] = tileOf(k);
      if (bld.floor(plan.level, x, y)) continue;
      // Named a floor, as a single plan's row names it: the island's refusal of a tile already floored asks for it.
      const target = tileTarget(x, y, { material, floorKind: 'floor', level: plan.level });
      const why = refusal(g, 'plan_floor', target);
      // The ground floor of a tile on piers is its deck, and the piers under it go on its bill (`piers.ts`).
      const bill = plan.level === 0 && bld.onPiers(x, y) ? billPlus(floorBill(material), pierBill(material, g.pierDropAt(x, y))) : floorBill(material);
      out.push({ action: 'plan_floor', target, why, bill });
    }
  } else if (plan.kind === 'roof') {
    const shape = b.roof ?? plan.roofShape ?? roofShapeOf(b);
    // Over its jetties as well as its footprint (`roofTiles`): a jetty's tile names its building.
    for (const [x, y] of bld.roofTiles(b)) {
      if (bld.floor(b.levels, x, y)) continue;
      const out1 = !inside.has(`${x},${y}`);
      const target = tileTarget(x, y, {
        material, floorKind: 'roof', level: b.levels - 1,
        ...(b.roof ? {} : { roofShape: shape }),
        ...(out1 ? { buildingId: b.id } : {}),
      });
      const why = refusal(g, 'plan_floor', target);
      out.push({ action: 'plan_floor', target, why, bill: floorBill(material, 'roof', shape) });
    }
  }
  return out;
}

/**
 * The tiles of a footprint dragged out from `anchor` to `corner`, nearest the
 * anchor first, each joined to the plan by a side through tiles that pass:
 * the order the island takes them in, the first a new building's and the
 * rest added to it. A tile that passes but is cut off from the rest is
 * refused as not joined.
 */
function footprintPieces(g: Game, plan: AreaPlan): AreaPiece[] {
  const bld = g.buildings;
  const into = plan.buildingId !== undefined ? bld.list.get(plan.buildingId) : bld.buildingAt(plan.anchor.x, plan.anchor.y);
  const corner = plan.corner ?? plan.anchor;
  const x0 = Math.min(plan.anchor.x, corner.x), x1 = Math.max(plan.anchor.x, corner.x);
  const y0 = Math.min(plan.anchor.y, corner.y), y1 = Math.max(plan.anchor.y, corner.y);
  const tool = needTool(g, 'mallet');
  /** Why a tile of the rectangle cannot go in, before whether it is joined: as `plan_building` and `add_to_building` ask. */
  const own = (x: number, y: number): string | null => {
    if (bld.buildingAt(x, y)) return null;
    if (into && into.levels > 1) return 'Footprint fixed once upper storeys are planned.';
    return jettyOver(g, x, y) ?? tool ?? g.planReason(x, y, into) ?? counterStreetRefusal(g, x, y);
  };
  const out: AreaPiece[] = [];
  const done = new Set<string>();
  const joined = new Set<string>(into ? into.tiles : []);
  const queue: Array<[number, number]> = [];
  const inRect = (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // From the anchor: a new building's first tile, or the building it is added to.
  if (!into) {
    const why = own(plan.anchor.x, plan.anchor.y);
    const target = tileTarget(plan.anchor.x, plan.anchor.y, plan.name ? { name: plan.name } as Partial<TileTarget> : {});
    out.push({ action: 'plan_building', target, why, bill: null });
    done.add(`${plan.anchor.x},${plan.anchor.y}`);
    if (!why) {
      joined.add(`${plan.anchor.x},${plan.anchor.y}`);
      queue.push([plan.anchor.x, plan.anchor.y]);
    }
  } else {
    for (const k of into.tiles) queue.push(tileOf(k));
  }
  while (queue.length) {
    const [x, y] = queue.shift() as [number, number];
    for (const [, dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!inRect(nx, ny) || done.has(k) || bld.buildingAt(nx, ny)) continue;
      done.add(k);
      const why = own(nx, ny);
      out.push({ action: 'add_to_building', target: tileTarget(nx, ny, {}), why, bill: null });
      if (!why) {
        joined.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  // The rest of the rectangle: refused, each in its own words, or as cut off from the plan.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = `${x},${y}`;
    if (done.has(k) || bld.buildingAt(x, y)) continue;
    out.push({ action: 'add_to_building', target: tileTarget(x, y, {}), why: own(x, y) ?? 'Not joined to the plan.', bill: null });
  }
  return out;
}

/** Every piece of a plan over an area, with why each would be refused; past `PLAN_AREA_MOST` that pass, the rest are refused as too many. */
export function areaPieces(g: Game, plan: AreaPlan): AreaPiece[] {
  let pieces: AreaPiece[];
  if (plan.kind === 'footprint') pieces = footprintPieces(g, plan);
  else {
    const b = plan.buildingId !== undefined ? g.buildings.list.get(plan.buildingId) : undefined;
    pieces = b ? buildingPieces(g, plan, b) : [];
  }
  let passing = 0;
  for (const p of pieces) {
    if (p.why) continue;
    if (++passing > PLAN_AREA_MOST) p.why = `Max ${PLAN_AREA_MOST} pieces a plan.`;
  }
  return pieces;
}

/** The pieces that pass: what the island is asked for. */
export const passing = (pieces: AreaPiece[]): AreaPiece[] => pieces.filter((p) => !p.why);

/**
 * What the pieces that pass take, summed over every one of them, against the
 * pack (`carried`) and the stores building draws on (`stored`): a crate on any
 * tile of the plan, and the stores within `buildReach` of where you stand.
 */
export function areaTotals(g: Game, pieces: AreaPiece[]): AreaTotal[] {
  const need = new Map<string, number>();
  let material: string | undefined;
  for (const p of passing(pieces)) {
    if (!p.bill) continue;
    material ??= p.target.material;
    for (const [id, n] of Object.entries(p.bill.needed)) if (n > 0) need.set(id, (need.get(id) ?? 0) + n);
  }
  const mat = material ? (MATERIAL_BY_ID.get(material) ?? (material === GLASS_ROOF.id ? GLASS_ROOF : undefined)) : undefined;
  const tiles = passing(pieces).map((p) => ({ x: p.target.x, y: p.target.y }));
  return [...need.entries()].map(([id, n]) => ({ id, need: n, carried: g.inventory.count(id), stored: storedFor(g, id, mat, tiles) }));
}

/** What the pieces that pass are, counted: "12 walls", "1 tile". */
export function areaCount(plan: AreaPlan, n: number): string {
  const one = plan.kind === 'walls' ? 'wall' : plan.kind === 'floor' ? 'floor tile' : plan.kind === 'roof' ? 'roof tile' : 'tile';
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** The refusals among the pieces, each reason once with how many it holds back, most first. */
export function areaRefusals(pieces: AreaPiece[]): Array<{ why: string; n: number }> {
  const by = new Map<string, number>();
  for (const p of pieces) if (p.why) by.set(p.why, (by.get(p.why) ?? 0) + 1);
  return [...by.entries()].map(([why, n]) => ({ why, n })).sort((a, b) => b.n - a.n);
}

/** The jobs the island is asked for, as it takes them: `rpc_plan_area`'s list. */
export function areaAsk(pieces: AreaPiece[]): Array<{ action: AreaPiece['action']; target: TileTarget }> {
  return passing(pieces).map((p) => ({ action: p.action, target: p.target }));
}

/** What the island says to a plan over an area, or to an undo: how many it planned or took down, or why not. */
export interface PlanAnswer {
  planned?: number;
  removed?: number;
  refused?: number;
  why?: string;
}

/** The single plans an undo takes back as well (`rpc_plan_undo`): the walls and floors you plan by hand. */
export const UNDONE_PLANS: ReadonlySet<string> = new Set(['plan_wall', 'plan_fence', 'plan_floor']);
