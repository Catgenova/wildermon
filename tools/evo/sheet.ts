/**
 * A sheet of wildermon pictures, for looking a kind over: each cell one kind at
 * one stage, one facing and one moment -- standing, a frame of its walk, a
 * frame of a strike, a go at its task, its ability, or evolving.
 *
 *   node tools/evo/shot.mjs out.png '<json>'
 *
 * where the json is a list of rows, each a list of cells
 * `{ species, stage?, facing?, pose?, label?, fleece?, graze?, t? }`, a pose
 * being `stand`, `walk:<u>`, `run:<u>`, `graze`, or `<act>:<t>` for an act
 * (`strike`, `work`, `cast`, `evolve`) at `t` nought to one through it.
 * With `fleece` (nought shorn to one full), `graze` or `t` (its clock, in
 * seconds), the cell is framed on the kind standing in full fleece rather
 * than on the pose itself, so cells of one kind at different fleeces are
 * drawn at one scale and a shorn body shows as smaller.
 */
import { drawWildermonPortrait, WILDERMON, WILDERMON_STAGES } from '../../src/render/wildermon';
import { SPECIES } from '../../src/game/creatures';
import { drawKind, evolveBurst, extentOf, kitOf, paletteFor, type Anim } from '../../src/render/beasts';

interface Cell { species: string; stage?: number; facing?: number; pose?: string; label?: string; variant?: number; size?: number; fleece?: number; graze?: number; t?: number }

/** A cell drawn at the scale of the kind standing in full fleece, posed as it says. */
function fixed(ctx: CanvasRenderingContext2D, w: number, h: number, cell: Cell, colors: [string, string]): void {
  const stage = cell.stage ?? 0;
  const later = stage > 0 ? WILDERMON_STAGES[cell.species]?.[stage - 1] : undefined;
  const kind = later ?? WILDERMON[cell.species];
  const key = later ? `${cell.species}@${stage}` : cell.species;
  const kit = kitOf(key, kind, 1);
  const facing = cell.facing ?? 1;
  const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.3 };
  const e = extentOf(kind, kit, facing, still);
  const bw = e.x1 - e.x0, bh = Math.max(e.y1, 0) - e.y0;
  const k = Math.min(w / Math.max(1, bw), h / Math.max(1, bh)) * 0.8;
  const a: Anim = { ...still, t: cell.t ?? 0, ...poseOf(cell.pose), ...(cell.fleece !== undefined ? { fleece: cell.fleece } : {}), ...(cell.graze !== undefined ? { graze: cell.graze } : {}) };
  const pal = paletteFor(key, kind, colors);
  ctx.save();
  ctx.translate(w / 2 - ((e.x0 + e.x1) / 2) * k, h * 0.9);
  ctx.scale(k, k);
  if (a.act?.kind === 'evolve') evolveBurst(ctx, key, kind, pal, a.act.t, true);
  drawKind(ctx, kind, kit, pal, facing, a, Math.max(0.9, 1.2 * Math.min(1, 40 / (bh * k))) / k, 1 / k);
  if (a.act?.kind === 'evolve') evolveBurst(ctx, key, kind, pal, a.act.t, false);
  ctx.restore();
}
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
      if (cell.fleece !== undefined || cell.graze !== undefined || cell.t !== undefined) fixed(ctx, size, size, cell, def.variants[cell.variant ?? 0]);
      else drawWildermonPortrait(ctx, size, size, cell.species, def.variants[cell.variant ?? 0], cell.facing ?? 1, undefined, cell.stage ?? 0, poseOf(cell.pose));
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
