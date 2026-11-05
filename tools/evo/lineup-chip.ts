/**
 * A lineup at the island's own size, through the game's `drawBeast`: each cell of `window.ROWS` a kind at a stage, standing on
 * grass at the zoom it is played at (`zoom`, one by default), so kinds next to each other are drawn at the sizes the island
 * draws them. For looking a new line over beside the old ones; a tool, not part of the game.
 *
 *   node tools/evo/lineup-chip.mjs out.png '<json>'   where json is { zoom, rows: [[{ species, stage, facing, variant? }]] }
 */
import { drawBeast } from '../../src/render/beasts';
import { loadAllWildermon, wildermonKind } from '../../src/render/wildermon';
import { SPECIES } from '../../src/game/creatures';

interface Cell { species: string; stage?: number; facing?: number; variant?: number; label?: string }
declare global { interface Window { SPEC: { zoom: number; rows: Cell[][] }; DONE?: boolean } }

async function main(): Promise<void> {
  await loadAllWildermon();
  const { zoom, rows } = window.SPEC;
  const W = 150 * zoom, H = 150 * zoom;
  const cv = document.createElement('canvas');
  const cols = Math.max(...rows.map((r) => r.length));
  cv.width = cols * W;
  cv.height = rows.length * (H + 18);
  document.body.append(cv);
  const g = cv.getContext('2d')!;
  g.fillStyle = '#7a9a5e';
  g.fillRect(0, 0, cv.width, cv.height);
  rows.forEach((row, ri) => row.forEach((cell, ci) => {
    const k = wildermonKind(cell.species, cell.stage ?? 0);
    if (!k) return;
    const def = SPECIES[cell.species];
    const colors = def.variants[cell.variant ?? 0];
    const x = ci * W + W / 2, y = ri * (H + 18) + H * 0.82;
    for (let i = 0; i < 3; i++) drawBeast(g, x, y, zoom, k.key, k.kind, colors, { facing: cell.facing ?? 1, phase: 0, moving: false });
    g.fillStyle = '#111';
    g.font = '12px sans-serif';
    g.textAlign = 'center';
    g.fillText(cell.label ?? `${cell.species}@${cell.stage ?? 0}`, x, ri * (H + 18) + H + 12);
  }));
  window.DONE = true;
}
void main();
