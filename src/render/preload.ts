/**
 * The solid trees, bushes and stumps round where you come ashore, baked while the island is
 * still being read (`preloadTreesAt`), so the first frame finds them made:
 * as the camera will first see them, at the scale it first draws at, under
 * the sun as it is and then its next step.
 */
import { darknessAt } from '../game/game';
import { DAY_SECONDS } from '../game/pace';
import { drawsLow, liveSettings } from '../game/settings';
import { onPhone } from '../engine/device';
import type { World } from '../world/world';
import { bushSpecies, TileType, treeSpecies, treeVariant } from '../world/tiles';
import { yearAt } from './foliage';
import { spriteScaleNow } from './sprites';
import { BUSH3D_SPECIES, nextSunStep, preloadTrees3d, TREE3D_SPECIES } from './trees3d';
import { NEAR_REACH } from '../ui/bootsteps';

/** How far round the spawn, in tiles, the trees are baked: more than a screen at zoom one. */
const REACH = 28;
/** How many parts the near trees are baked in, for the boot bar to count. */
export const NEAR_PARTS = 4;

/** Coming ashore's part of the bake: `near` resolves when the trees round you are made, `all` when the rest are. */
export interface TreePreload {
  near: Promise<void>;
  all: Promise<void>;
}

/**
 * The trees in `NEAR_REACH` of a point, nearest first, in `parts` runs of about the same count, and then the
 * rest of `REACH`. Exported for supabase/test/bootsteps.ts.
 */
export function nearFirst<T extends { d: number }>(tiles: readonly T[], parts = NEAR_PARTS): { near: T[][]; far: T[] } {
  const sorted = [...tiles].sort((a, b) => a.d - b.d);
  const close = sorted.filter((t) => t.d <= NEAR_REACH * NEAR_REACH);
  const far = sorted.slice(close.length);
  const near: T[][] = [];
  const each = Math.max(1, Math.ceil(close.length / parts));
  for (let i = 0; i < close.length; i += each) near.push(close.slice(i, i + each));
  return { near, far };
}

const DONE: TreePreload = { near: Promise.resolve(), all: Promise.resolve() };

/**
 * Begun once the island's land is known and you are on it; quietly does nothing it cannot. `step` is told
 * each part of the near trees as it is done, of how many.
 */
export function preloadTreesAt(
  world: World, x: number, y: number, islandSeconds: number, wallSeconds = Date.now() / 1000,
  step?: (done: number, total: number) => void,
): TreePreload {
  try {
    if (!TREE3D_SPECIES.size && !BUSH3D_SPECIES.size) return DONE;
    // The low-end graphics draw every tree, bush and stump flat: nothing to bake.
    const settings = liveSettings();
    if (drawsLow(settings, onPhone())) return DONE;
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
    const hour = ((((islandSeconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS) * 24;
    const { season, day } = yearAt(wallSeconds);
    const turn = settings.rotation;
    const at = { season, day, hour, dark: darknessAt(hour), turn, scale: spriteScaleNow(), next: nextSunStep(hour, darknessAt) };
    const { near, far } = nearFirst(tiles);
    const close = (async () => {
      for (let i = 0; i < near.length; i++) {
        await preloadTrees3d(near[i], at);
        step?.(i + 1, near.length);
      }
    })().catch(() => {});
    // What is already made is passed over (`preloadTrees3d`), so the far run bakes only the far trees.
    const all = close.then(() => preloadTrees3d(far, at)).catch(() => {});
    return { near: close, all };
  } catch {
    return DONE;
  }
}
