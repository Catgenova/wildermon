/**
 * Storey mode: one storey of every building looked at on its own.
 *
 * The storey control (`HUD.stepStorey`) pins the view to a storey
 * (`Settings.viewLevel`, 0 for the ground floor). While one is pinned every
 * other storey's walls, floors, columns, beams and roofs are hidden, above it
 * and below it, and so is whatever stands on them; a click lands on the pinned
 * storey's floor, a walk goes to that storey, and the menu is that storey's
 * building work. Auto (`viewLevel` null) is the view as it always was, and a
 * cellar is looked into as it always was (`Game.cellarView`).
 *
 * What a click on a storey can land on (`storeyTileAt`): a building's own
 * tiles up to its roof's level (`Building.levels`), a tile out past a
 * footprint carrying a floor of the storey (a jetty, a balcony, the head of
 * an outside staircase), and open air one tile out from a building that has
 * the storey, where a jetty could go. Each at the height its floor is drawn
 * at (`storeyHeight`, as `Renderer.drawFloor` stands it).
 *
 * A roof is a storey of its own: its building's level `levels`. Pinned there,
 * the roof is drawn and nothing under it, its tiles still to plan are marked
 * out at its eaves (`Renderer.drawRoofSites`), a pitched roof is clicked on
 * its slopes (`Renderer.roofPick`), and its menu is the roof's work and
 * nothing else; a storey under it neither draws it nor offers its work. A
 * click on a pitched roof chooses the tile and walks nowhere
 * (`pitchedRoofAt`): a flat one is a terrace, walked on.
 */
import { roofShapeDef, WALL_HEIGHT, type Building } from './building';
import { jettyBase } from './frame';
import type { Game } from './game';

const ROUND: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** The building a tile answers for on storey `level`, or undefined where nothing of that storey is, or could be. */
export function storeyHost(g: Game, x: number, y: number, level: number): Building | undefined {
  const bld = g.buildings;
  const own = bld.buildingAt(x, y);
  // Its own tiles, up to the roof's level: the roof is planned from the storey it sits on.
  if (own) return level >= 0 && level <= own.levels ? own : undefined;
  if (level <= 0) return undefined;
  // A floor of the storey out past every footprint: a jetty, a balcony, an outside staircase's head.
  const f = bld.floor(level, x, y);
  if (f) return bld.list.get(f.building);
  // Open air beside a building that has the storey, where a jetty could go.
  for (const [dx, dy] of ROUND) {
    const b = bld.buildingAt(x + dx, y + dy);
    if (b && b.levels > level) return b;
  }
  return undefined;
}

/** Whether a tile answers a click on storey `level` (`storeyHost`). */
export const storeyTileAt = (g: Game, x: number, y: number, level: number): boolean => storeyHost(g, x, y, level) !== undefined;

/**
 * The height of a tile's floor on storey `level`, as it is drawn: a building's
 * own tile from its deck or its ground, a tile out past it from the floor
 * its storeys are counted from (`jettyBase`), storeys on top.
 */
export function storeyHeight(g: Game, x: number, y: number, level: number): number {
  const ground = g.world.getHeight(x, y);
  const own = g.buildings.buildingAt(x, y);
  if (own) return (own.deck ?? ground) + level * WALL_HEIGHT;
  const host = storeyHost(g, x, y, level) ?? g.buildings.jettyAt(x, y);
  const base = host ? jettyBase(g, host, x, y) : null;
  return (base ?? ground) + level * WALL_HEIGHT;
}

/** The building whose pitched roof a tile is part of on storey `level`, its roof's own level: no walking there. */
export function pitchedRoofAt(g: Game, x: number, y: number, level: number): Building | undefined {
  const b = storeyHost(g, x, y, level) ?? g.buildings.jettyAt(x, y);
  if (!b || b.levels !== level || roofShapeDef(b).walkable) return undefined;
  return g.buildings.roofTiles(b).some(([rx, ry]) => rx === x && ry === y) ? b : undefined;
}

/** The tallest building's roof level: the highest storey there is to pin. */
export function tallestStorey(g: Game): number {
  let top = 0;
  for (const b of g.buildings.list.values()) top = Math.max(top, b.levels);
  return top;
}
