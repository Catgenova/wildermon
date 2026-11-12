/**
 * What ground and trees a job can be done on, asked by the player's jobs
 * (`actions.ts`) and by a wildermon at the same trade (`creatures.ts`) alike.
 *
 * A leaf, so the wildermon can ask without loading the action list, which
 * says them on.
 */
import type { Game } from './game';
import { TileType, TREE_DEFS, treeAge, treeSpecies } from '../world/tiles';

/** The one tree a Forester's Tap Resin taps. */
export const RESIN_TREE = TREE_DEFS.findIndex((d) => d.name === 'Pine');
/** A living pine with timber in it: not a sapling, and not one clipped to a shrub. */
export const tappable = (data: number): boolean =>
  treeSpecies(data) === RESIN_TREE && treeAge(data).alive && treeAge(data).logs > 0;
/** The four corners of a tile, north-west first and going clockwise. */
export const tileCorners = (x: number, y: number): Array<[number, number]> => [
  [x, y],
  [x + 1, y],
  [x + 1, y + 1],
  [x, y + 1],
];
/**
 * How often working a face for its metal happens to bring a slab of it down.
 *
 * One swing in thirty. It was one in a hundred, which is hardly ever enough to
 * be a thing that happens: a seam worked for an afternoon sank a step or two
 * and the whole business read as a fixed wall you chipped at. A thirtieth is
 * still nobody's plan for moving rock -- `chip_corner` is the job for that,
 * and it comes off three swings in four -- but it is often enough that a face
 * you have been at all day is visibly lower than it was.
 *
 * The island holds the same number in `mine_collapse()`, and the browser's
 * miner, the browser's Mola and the island's all ask their own side for it.
 */
export const MINE_COLLAPSE = 1 / 30;
/** The ground a cut of grass is taken off: a grazza's as well as yours. */
export const CUT_GRASS = new Set<number>([TileType.Grass, TileType.Steppe, TileType.Lawn, TileType.Tundra]);
/**
 * How deep the water over a face may be and still be worked, in height units.
 *
 * Reported from the island: a copper vein that would not be mined, with "You
 * cannot mine below the water level." and no water anywhere on the tile. Two
 * things were wrong in one line, `rockHeight(corner) <= 0`.
 *
 * It asked the wrong corner height. `rockHeight` is the surface less the soil
 * over it, so a corner shared with a meadow refuses a face standing fifty
 * units above the sea, on the grounds that the bedrock buried under the grass
 * beside it is below sea level. Water is a question about the surface, and the
 * surface is what `hasWater` reads and what the renderer draws.
 *
 * And it was a height out even where the two agree: `<= 0` refuses a face
 * standing *at* the waterline, and water is only drawn below it — so nought is
 * the one height that refuses and shows nothing, which is exactly where a
 * shore face sits.
 *
 * So: the corner's own height, and ten units of water allowed over it. That is
 * about waist deep at the tide line and you work standing in it, which is what
 * a shore quarry looks like. Past that you are swimming, and nobody swings a
 * pick while swimming.
 */
export const MINE_DEPTH = 10;
/** Ground with anything living in it, and the damp ground that is full of them. */
export const WORMY = new Set<TileType>([TileType.Grass, TileType.Dirt, TileType.PackedDirt, TileType.Marsh, TileType.Moss]);
export const RICH_WORMS = new Set<TileType>([TileType.Marsh, TileType.Moss]);
/** What a go of a Miner's Pan brings up when it brings up anything, each as likely. */
export const PAN_ORES = ['copper_ore', 'tin_ore', 'silver_ore'];
/** Whether a tile has water at one of its corners, which panning wants. */
export const besideWater = (g: Game, x: number, y: number): boolean =>
  tileCorners(x, y).some(([cx, cy]) => g.world.getHeight(cx, cy) < 0);
