import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { isDone, progressOf, type Bill } from './building';
import { metres, TileType } from '../world/tiles';
import { POOL_DEPTH, POOL_LIP, poolFloor, poolLevel } from '../world/springs';
import { greenNow } from './greening';

/**
 * Foundations.
 *
 * Asked for, out of a conversation about the thing Wurm never had: "some sort
 * of foundation piece, something material-intensive that fills in the terrain
 * of the tile and has perfectly vertical edges — could base the maximum slope
 * you can build them on skill", and then "specifically featuring vertical
 * edges that are easy to attach other building components to; in wurm i'd
 * often run into awkward building situations next to slopes."
 *
 * Every other answer to a slope in this game moves the ground: you dig the
 * high corner down, you drop the low one, you flatten, and the corners you
 * move are shared with four tiles, so levelling one tile pulls its neighbours
 * about and the hillside you wanted to build against stops being a hillside.
 * A foundation does the opposite. It leaves every corner exactly where it is
 * and pours a slab over the tile up to one flat top, with sides straight down
 * to whatever is underneath. The hill keeps its shape and you get a square of
 * level ground standing in it.
 *
 * What it costs is the hole it fills. `CONCRETE_PER_STEP` concrete for every
 * step of every corner it lifts, so a slab over a gentle tile is cheap, one
 * over a cliff is an undertaking, and one poured into deep water is the work
 * of a season — which is the point of the thing being material-intensive
 * rather than forbidden.
 *
 * What it asks of you is the deepest part of that pour. Three units of lift a
 * point of masonry: a beginner can square off a step, and a hillside needs
 * somebody who has been doing this a while.
 *
 * And where it goes is bare rock. Asked for: "all dirt must be dug from a
 * tile before planning a foundation", on "rocks or seams or ores". So every
 * spadeful of soil comes off all four corners first, and then it is the same
 * slab on plain stone, a seam or an ore: the pour asks nothing of the rock.
 */

/**
 * Why a foundation will not go over soil: what is left on the tile's four
 * corners together, a spadeful apiece, and what to do about it. The island
 * says it in the same words (`foundation_reason`).
 */
export const soilSays = (soil: number): string =>
  `Soil left over rock: ${metres(soil)} m (all corners). Dig every corner down to rock first.`;

/** Concrete per step of one corner lifted. */
export const CONCRETE_PER_STEP = 10;
/**
 * How much lift one point of masonry is worth.
 *
 * Measured against the deepest corner of the pour rather than against the
 * tile's slope, because those are the same number when you pour to the top of
 * the tile — which is the cheapest and by far the commonest choice — and they
 * come apart only when somebody sights a level well above it and asks for a
 * plinth. Shuttering a plinth is the harder job, and this says so.
 */
export const LIFT_PER_MASONRY = 3;
/** How near a building or its plan a slab may be poured: not this near. */
export const CLEAR_OF_BUILDINGS = 1;

export interface Foundation extends Bill {
  id: number;
  x: number;
  y: number;
  /** The elevation the top of the slab is poured to, in terrain units. */
  top: number;
  /** Who set it out. */
  madeBy?: string;
  /** A pool dug in it: water \`POOL_LIP\` under its top over a floor \`POOL_DEPTH\` under it. */
  pool?: boolean;
  /** When the moss on it began, in real seconds: when it was poured or last scrubbed. See `greening.ts`. */
  greenSince?: number;
}

/**
 * The concrete it takes to fill a pool back in: a barrowful for every step of
 * its depth. Far less than pouring that depth over a whole tile would take,
 * because the walls round it are still standing.
 */
export const POOL_FILL = POOL_DEPTH;

/** Poured, rather than still a shuttered plan. */
export const foundationDone = (f: Foundation): boolean => isDone(f);
export const foundationProgress = (f: Foundation): number => progressOf(f);

/** What a pour to `top` costs over four corners: the hole it fills, priced by the step. */
export const concreteFor = (corners: readonly number[], top: number): number =>
  CONCRETE_PER_STEP * corners.reduce((n, h) => n + Math.max(0, Math.round(top - h)), 0);

/** The deepest part of the pour, which is the part that wants the skill. */
export const liftFor = (corners: readonly number[], top: number): number => top - Math.min(...corners);

/** The masonry a lift that deep asks for. */
export const masonryFor = (lift: number): number => lift / LIFT_PER_MASONRY;

export const foundationBill = (concrete: number): Bill => ({ needed: { concrete }, total: { concrete } });

export const foundationState = (f: Foundation): string =>
  foundationDone(f)
    ? `poured to ${metres(f.top)} m`
    : `${Math.round(foundationProgress(f) * 100)}% · ${f.needed.concrete ?? 0} concrete to go`;

/**
 * One barrowful of concrete into a foundation's shuttering, as a go of "Pour
 * the foundation" works it, without the builder's skill or words. A hod
 * carrier's barrowful goes in the same way (`Game.fitPiece`). The island's
 * `perform_foundation` and `hod_fit`.
 */
export function pourIntoFoundation(g: Game, f: Foundation): void {
  f.needed.concrete = Math.max(0, (f.needed.concrete ?? 0) - 1);
  g.events.emit('world', f.x, f.y);
  if (!foundationDone(f)) return;
  /*
   * And the top of it is packed ground, which is what everything that asks
   * what a tile is made of wants to hear: a building wants packed dirt
   * under it and paving wants a packed floor, and a slab is both. The
   * corners are not touched — that is the whole promise of the thing —
   * only what the top of the tile is surfaced with.
   */
  g.world.setTile(f.x, f.y, TileType.PackedDirt);
  // Poured, and bare: the moss starts from here (`greening.ts`).
  f.greenSince = greenNow();
  // A slab is a wall to water, and one poured over a spring stops it.
  g.poolsChanged(f.x, f.y);
}

type TileTarget = Extract<Target, { kind: 'tile' }>;
const isTile = (t: Target): t is TileTarget => t.kind === 'tile';

export const FOUNDATION_ACTIONS: ActionDef[] = [
  {
    id: 'plan_foundation',
    label: 'Set out a foundation',
    verb: 'shuttering a foundation',
    skill: 'masonry',
    tool: 'mallet',
    stamina: 0.03,
    baseTime: 4,
    // Not offered over soil at all: the tile has to be dug down to bare rock first.
    applies: (t, g) => isTile(t) && !g.foundationAt(t.x, t.y) && g.world.slope(t.x, t.y) > 0 && g.world.allBare(t.x, t.y),
    labelFor: (t, g) => {
      if (!isTile(t)) return 'Set out a foundation';
      const top = g.foundationTop(t.x, t.y);
      const want = concreteFor(g.world.tileCorners(t.x, t.y), top);
      return `Set out a foundation to ${metres(top)} m (needs ${want} concrete)`;
    },
    check: (t, g) => (isTile(t) ? g.foundationReason(t.x, t.y, g.foundationTop(t.x, t.y)) : null),
    perform: (t, g) => {
      if (!isTile(t)) return;
      const top = g.foundationTop(t.x, t.y);
      if (g.foundationReason(t.x, t.y, top)) return;
      const f = g.addFoundation(t.x, t.y, top);
      g.note('planned_foundation');
      g.logMsg(
        `Foundation planned: top at ${metres(top)} m.`
        + ` Needs ${f.total.concrete} concrete. Surrounding ground is unchanged.`,
        'system',
      );
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'pour_foundation',
    label: 'Pour the foundation',
    verb: 'pouring concrete',
    skill: 'masonry',
    tool: 'trowel',
    stamina: 0.05,
    baseTime: 6,
    repeat: true,
    applies: (t, g) => isTile(t) && !!g.foundationAt(t.x, t.y) && !foundationDone(g.foundationAt(t.x, t.y)!),
    labelFor: (t, g) => {
      const f = isTile(t) ? g.foundationAt(t.x, t.y) : undefined;
      return f ? `Pour the foundation (${f.needed.concrete ?? 0} concrete to go)` : 'Pour the foundation';
    },
    check: (t, g) => {
      if (!isTile(t)) return null;
      const f = g.foundationAt(t.x, t.y);
      if (!f) return 'No shuttering here.';
      if (foundationDone(f)) return 'Already poured.';
      if (!g.inventory.has('trowel')) return 'Need a trowel.';
      if (!g.inventory.has('concrete')) return 'Need concrete.';
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const f = g.foundationAt(t.x, t.y);
      if (!f || foundationDone(f) || !g.inventory.consume('concrete')) return;
      pourIntoFoundation(g, f);
      if (!foundationDone(f)) {
        g.logMsg(`Concrete poured. ${f.needed.concrete} to go.`, 'event');
        return true;
      }
      g.note('poured_foundation');
      g.logMsg(`Foundation done: top at ${metres(f.top)} m. Can be built on, paved or bridged to.`, 'event');
      return false;
    },
  },
  {
    id: 'dig_pool',
    label: 'Dig a pool',
    verb: 'breaking out a pool',
    skill: 'masonry',
    tool: 'pickaxe',
    stamina: 0.12,
    baseTime: 30,
    applies: (t, g) => isTile(t) && !!g.slabAt(t.x, t.y) && !g.slabAt(t.x, t.y)!.pool,
    labelFor: (t, g) => {
      const f = isTile(t) ? g.slabAt(t.x, t.y) : undefined;
      return f ? `Dig a pool (water at ${metres(poolLevel(f.top))} m, floor at ${metres(poolFloor(f.top))} m)` : 'Dig a pool';
    },
    check: (t, g) => {
      if (!isTile(t)) return null;
      if (!g.inventory.has('pickaxe')) return 'Need a pickaxe.';
      return g.poolReason(t.x, t.y);
    },
    perform: (t, g) => {
      if (!isTile(t) || g.poolReason(t.x, t.y)) return;
      const f = g.slabAt(t.x, t.y);
      if (!f) return;
      f.pool = true;
      g.poolsChanged(f.x, f.y);
      g.logMsg(
        `Pool dug: floor at ${metres(poolFloor(f.top))} m, water at ${metres(poolLevel(f.top))} m,`
        + ` ${metres(POOL_DEPTH - POOL_LIP)} m deep. Joins adjacent pools of the same top. A spring in it spills over its lowest edge.`,
        'event',
      );
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'fill_pool',
    label: 'Fill the pool in',
    verb: 'filling the pool in',
    skill: 'masonry',
    tool: 'trowel',
    stamina: 0.08,
    baseTime: 20,
    applies: (t, g) => isTile(t) && !!g.slabAt(t.x, t.y)?.pool,
    labelFor: () => `Fill the pool in (needs ${POOL_FILL} concrete)`,
    check: (t, g) => {
      if (!isTile(t)) return null;
      if (!g.slabAt(t.x, t.y)?.pool) return 'No pool here.';
      if (!g.inventory.has('trowel')) return 'Need a trowel.';
      if (g.inventory.count('concrete') < POOL_FILL) return `Need ${POOL_FILL} concrete; have ${g.inventory.count('concrete')}.`;
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const f = g.slabAt(t.x, t.y);
      if (!f?.pool || !g.inventory.consume('concrete', POOL_FILL)) return;
      f.pool = false;
      g.poolsChanged(f.x, f.y);
      g.logMsg(`Pool filled: ${POOL_FILL} concrete, top at ${metres(f.top)} m. Any spring in it stops.`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
  {
    id: 'strike_foundation',
    label: 'Strike the shuttering',
    verb: 'striking the shuttering',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => isTile(t) && !!g.foundationAt(t.x, t.y) && !foundationDone(g.foundationAt(t.x, t.y)!),
    check: (t, g) => {
      if (!isTile(t)) return null;
      const f = g.foundationAt(t.x, t.y);
      if (!f) return 'No shuttering here.';
      // Concrete that has gone off is not coming back out of the ground, and a
      // slab that is holding a house up is not a plan any more.
      if (foundationDone(f)) return 'Already poured: not a plan.';
      return null;
    },
    perform: (t, g) => {
      if (!isTile(t)) return;
      const f = g.foundationAt(t.x, t.y);
      if (!f || foundationDone(f)) return;
      const back = (f.total.concrete ?? 0) - (f.needed.concrete ?? 0);
      g.removeFoundation(f.id);
      // What went in has set; the boards come away and the rest is rubble.
      if (back > 0) g.inventory.add('rock_shards', { count: back, ql: 20 });
      g.logMsg(`Shuttering struck.${back > 0 ? ` Got ${back} rock shards.` : ''}`, 'event');
      g.events.emit('world', t.x, t.y);
    },
  },
];

export const FOUNDATION_ACTION_BY_ID = new Map(FOUNDATION_ACTIONS.map((a) => [a.id, a]));
