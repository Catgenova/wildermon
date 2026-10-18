/**
 * A sheet of wildermon pictures, for looking a kind over: each cell one kind at
 * one stage, one facing and one moment -- standing, a frame of its walk, a
 * frame of a strike, a go at its task, its ability, or evolving.
 *
 *   node tools/evo/shot.mjs out.png '<json>'
 *
 * where the json is a list of rows, each a list of cells
 * `{ species, stage?, facing?, pose?, label? }`, a pose being
 * `stand`, `walk:<u>`, `run:<u>`, `graze`, or `<act>:<t>` for an act
 * (`strike`, `work`, `cast`, `evolve`) at `t` nought to one through it.
 */
import { drawWildermonPortrait } from '../../src/render/wildermon';
import { SPECIES } from '../../src/game/creatures';
import type { Anim } from '../../src/render/beasts';

interface Cell { species: string; stage?: number; facing?: number; pose?: string; label?: string; variant?: number; size?: number }
const rows = (window as unknown as { ROWS: Cell[][] }).ROWS;
const poseOf = (p = 'stand'): Partial<Anim> | undefined => {
  const [k, v] = p.split(':');
  const x = Number(v ?? 0);
  if (k === 'stand') return undefined;
  if (k === 'graze') return { graze: 1 };
  if (k === 'walk') return { go: 1, gait: 0, u: x };
  if (k === 'run') return { go: 1, gait: 1, u: x };
  return { act: { kind: k as 'strike' | 'work' | 'cast' | 'evolve', t: x } };
};
const root = document.getElementById('root')!;
for (const row of rows) {
  const line = document.createElement('div');
  line.style.whiteSpace = 'nowrap';
  for (const cell of row) {
    const size = cell.size ?? 220;
    const def = SPECIES[cell.species];
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#7d9b5e';
    ctx.fillRect(0, 0, size, size);
    try {
      drawWildermonPortrait(ctx, size, size, cell.species, def.variants[cell.variant ?? 0], cell.facing ?? 1, undefined, cell.stage ?? 0, poseOf(cell.pose));
    } catch (e) {
      ctx.fillStyle = 'red';
      ctx.fillText(String(e), 4, 100);
    }
    const box = document.createElement('div');
    box.style.cssText = 'display:inline-block;margin:2px;font:11px sans-serif;text-align:center;color:#ddd';
    box.append(cv, document.createElement('br'), cell.label ?? `${cell.species}@${cell.stage ?? 0} ${cell.pose ?? 'stand'}`);
    line.append(box);
  }
  root.append(line);
}
(window as unknown as { DONE: boolean }).DONE = true;
