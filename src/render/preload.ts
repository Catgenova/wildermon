/**
 * The solid trees, bushes and stumps round where you come ashore, baked while the island is
 * still being read (`preloadTrees3d`), so the first frame finds them made:
 * as the camera will first see them, at the scale it first draws at, under
 * the sun as it is and then its next step.
 */
import { darknessAt } from '../game/game';
import { DAY_SECONDS } from '../game/pace';
import { liveSettings } from '../game/settings';
import type { World } from '../world/world';
import { bushSpecies, TileType, treeSpecies, treeVariant } from '../world/tiles';
import { yearAt } from './foliage';
import { spriteScaleNow } from './sprites';
import { BUSH3D_SPECIES, nextSunStep, preloadTrees3d, TREE3D_SPECIES } from './trees3d';

/** How far round the spawn, in tiles, the trees are baked: more than a screen at zoom one. */
const REACH = 28;

/** Begun once the island's land is known and you are on it; quietly does nothing it cannot. */
export function preloadTreesAt(world: World, x: number, y: number, islandSeconds: number, wallSeconds = Date.now() / 1000): Promise<void> {
  try {
    if (!TREE3D_SPECIES.size && !BUSH3D_SPECIES.size) return Promise.resolve();
    const tiles: Array<{ bush: boolean; stump: boolean; species: number; variant: number; x: number; y: number; d: number }> = [];
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let ty = cy - REACH; ty <= cy + REACH; ty++) {
      for (let tx = cx - REACH; tx <= cx + REACH; tx++) {
        if (!world.inBounds(tx, ty)) continue;
        const t = world.getTile(tx, ty);
        if (t !== TileType.Tree && t !== TileType.Bush && t !== TileType.Stump) continue;
        const data = world.getData(tx, ty);
        const bush = t === TileType.Bush, stump = t === TileType.Stump;
        tiles.push({ bush, stump, species: bush ? bushSpecies(data) : treeSpecies(data), variant: bush || stump ? 0 : treeVariant(data), x: tx, y: ty, d: (tx - x) ** 2 + (ty - y) ** 2 });
      }
    }
    tiles.sort((a, b) => a.d - b.d);
    const hour = ((((islandSeconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS) * 24;
    const { season, day } = yearAt(wallSeconds);
    const turn = liveSettings().rotation;
    return preloadTrees3d(tiles, { season, day, hour, dark: darknessAt(hour), turn, scale: spriteScaleNow(), next: nextSunStep(hour, darknessAt) }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}
