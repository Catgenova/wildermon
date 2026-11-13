import type { TileChange } from '../landpack';
import { isNum, type Fields } from './read';

/** A row of `tile_change` as the browser lays it: the history read, Postgres Changes and the land Broadcast. */
export type ChangeRow = TileChange & { n: number; world_id?: string };

/** A `tile_change` row, or null for one without its number, its square, its tile or its data. */
export function changeRow(r: Fields): ChangeRow | null {
  const { n, x, y, tile, data } = r;
  if (!isNum(n) || !isNum(x) || !isNum(y) || !isNum(tile) || !isNum(data)) return null;
  // Corners and soil are laid only when all four are there (`layChange`), which is checked where they are laid.
  const corners = Array.isArray(r.corners) ? r.corners.filter(isNum) : [];
  return {
    n, x, y, tile, data, corners,
    ...(Array.isArray(r.soil) ? { soil: r.soil.filter(isNum) } : {}),
    ...(typeof r.world_id === 'string' ? { world_id: r.world_id } : {}),
  };
}
