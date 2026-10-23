/**
 * The page `tools/piece-sheet.mjs` renders: a contact sheet of furniture,
 * old model beside kit model, for the config in `window.SHEET`. Not run on
 * its own; see the header of `piece-sheet.mjs` for how to use it.
 */
// The game's modules in the order the game loads them: `actions` before anything that reaches it through `traps`.
import '../src/game/actions';
import { furnitureDef } from '../src/game/furniture';
import { dyeTint } from '../src/game/dyestuffs';
import type { Side } from '../src/game/building';
import { drawFurniture, FURNITURE_HEIGHT, pieceView, type PieceView } from '../src/render/furniture';
import { isKit, kitBypass, kitSync } from '../src/render/kitpieces';
import { KIT_PIECES } from '../src/render/kit/index';
import { denSync } from '../src/render/dens';
import { drawAnvil, drawKiln, drawSmelter } from '../src/render/forge';
import { NIGHT_WASH } from '../src/render/nightwash';

interface Sheet {
  kinds: string[];
  views: Array<[Side, number]>;
  zooms: number[];
  dye: string;
  woods: string[];
  mag: number;
  lit: boolean;
  only?: 'old' | 'new';
}

const cfg = (window as unknown as { SHEET: Sheet }).SHEET;
kitSync(true);
denSync(true);

/** What one cell draws: old or kit model, from which view, at what zoom, in what light, as what. */
interface Cell {
  kind: string;
  side: 'old' | 'new';
  view: [Side, number];
  zoom: number;
  night: boolean;
  lit?: boolean;
  tint?: string;
  trim?: number;
  material?: string;
  label: string;
}

const GRASS = '#8fae6a';
const FLOOR = 'rgba(236, 226, 200, 0.55)';
const FLOOR_LINE = 'rgba(120, 104, 84, 0.35)';

/** Draw a cell's piece at (x, y): a reference piece of the kit, or furniture old or new. */
function drawPiece(g: CanvasRenderingContext2D, x: number, y: number, c: Cell, view: PieceView): void {
  const [facing, rot] = c.view;
  if (c.kind === '@anvil') { drawAnvil(g, x, y, c.zoom, '#a6b2c6', '#535d78', rot, 0); return; }
  if (c.kind === '@smelter') { drawSmelter(g, x, y, c.zoom, rot, { lit: !!c.lit, working: false }, c.night ? 1 : 0); return; }
  if (c.kind === '@kiln') { drawKiln(g, x, y, c.zoom, rot, { lit: !!c.lit, firing: false }, c.night ? 1 : 0); return; }
  void facing;
  kitBypass(c.side === 'old');
  try {
    drawFurniture(g, x, y, c.zoom, c.kind, !!c.lit, c.tint ? dyeTint(c.tint) ?? undefined : undefined, c.trim, view, c.material);
  } finally {
    kitBypass(false);
  }
}

/** Its footprint on the floor, a pale square of its subtiles, so its size can be judged. */
function footprint(g: CanvasRenderingContext2D, x: number, y: number, c: Cell, view: PieceView): void {
  if (c.kind.startsWith('@')) return;
  const def = furnitureDef(c.kind);
  const hw = def.w * 5, hd = def.h * 5;
  const P = (u: number, v: number): [number, number] => [x + (u * view.ux + v * view.vx) * c.zoom, y + (u * view.uy + v * view.vy) * c.zoom];
  g.beginPath();
  [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(([u, v], i) => { const [px, py] = P(u, v); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.closePath();
  g.fillStyle = FLOOR;
  g.fill();
  g.strokeStyle = FLOOR_LINE;
  g.lineWidth = 1;
  g.beginPath();
  for (let u = -hw + 10; u < hw; u += 10) { const a = P(u, -hd), b = P(u, hd); g.moveTo(...a); g.lineTo(...b); }
  for (let v = -hd + 10; v < hd; v += 10) { const a = P(-hw, v), b = P(hw, v); g.moveTo(...a); g.lineTo(...b); }
  g.stroke();
}

/** The box of what a cell draws, around its floor contact, from a trial on a clear canvas. */
function measure(c: Cell): [number, number, number, number] {
  const S = Math.ceil(420 * c.zoom);
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d')!;
  const view = pieceView(c.view[0], c.view[1]);
  drawPiece(g, S / 2, S * 0.7, c, view);
  footprint(g, S / 2, S * 0.7, c, view);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) return [-10, -10, 10, 10];
  return [x0 - S / 2, y0 - S * 0.7, x1 + 1 - S / 2, y1 + 1 - S * 0.7];
}

function render(c: Cell, box: [number, number, number, number]): HTMLElement {
  const pad = 6;
  const w = Math.ceil(box[2] - box[0] + pad * 2), h = Math.ceil(box[3] - box[1] + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.width = `${w * cfg.mag}px`;
  cv.style.height = `${h * cfg.mag}px`;
  cv.style.imageRendering = 'pixelated';
  const g = cv.getContext('2d')!;
  g.fillStyle = GRASS;
  g.fillRect(0, 0, w, h);
  const x = Math.round(pad - box[0]), y = Math.round(pad - box[1]);
  const view = pieceView(c.view[0], c.view[1]);
  footprint(g, x, y, c, view);
  drawPiece(g, x, y, c, view);
  if (c.night) {
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha})`;
    g.fillRect(0, 0, w, h);
  }
  const box2 = document.createElement('div');
  box2.className = 'cell ' + c.side;
  box2.append(cv, Object.assign(document.createElement('div'), { className: 'cap', textContent: c.label }));
  return box2;
}

const root = document.getElementById('root')!;
const viewName = ([f, r]: [Side, number]): string => `${f}${r}`;
for (const kind of cfg.kinds) {
  const ref = kind.startsWith('@');
  const kit = !ref && isKit(kind) ? KIT_PIECES[kind] : undefined;
  const sides: Array<'old' | 'new'> = ref ? ['old'] : kit ? (cfg.only ? [cfg.only] : ['old', 'new']) : ['old'];
  const block = document.createElement('div');
  block.className = 'block';
  const name = ref ? `${kind.slice(1)} (kit reference)` : `${furnitureDef(kind).name} [${kind}] ${furnitureDef(kind).w}x${furnitureDef(kind).h} · ${kit ? 'old | kit' : 'old model only'} · height ${FURNITURE_HEIGHT[kind] ?? '-'}px`;
  block.append(Object.assign(document.createElement('h2'), { textContent: name }));
  const rows: Array<{ label: string; cells: Cell[] }> = [];
  const base = (side: 'old' | 'new', view: [Side, number], zoom: number, more: Partial<Cell>, label: string): Cell => ({ kind, side, view, zoom, night: false, label, ...more });
  const row = (label: string, make: (side: 'old' | 'new') => Cell[]): void => { rows.push({ label, cells: sides.flatMap(make) }); };
  for (const z of cfg.zooms) {
    row(`zoom ${z} · day`, (s) => cfg.views.map((v) => base(s, v, z, {}, `${s} ${viewName(v)}`)));
    row(`zoom ${z} · night`, (s) => cfg.views.map((v) => base(s, v, z, { night: true }, `${s} ${viewName(v)} night`)));
    if (!ref) row(`zoom ${z} · dyed ${cfg.dye}`, (s) => cfg.views.slice(0, 3).map((v) => base(s, v, z, { tint: cfg.dye }, `${s} ${viewName(v)} dyed`)));
    if (!ref) row(`zoom ${z} · woods`, (s) => cfg.woods.map((m) => base(s, cfg.views[0], z, { material: m }, `${s} ${m}`)));
    if (cfg.lit || kit?.uses?.lit || ref) {
      // Lit in its last state, where a piece has states: a lantern post lit with its lantern in it.
      const st = kit?.states?.[kit.states.length - 1];
      row(`zoom ${z} · lit${st ? ` · ${st.label}` : ''}`, (s) => [false, true].flatMap((n) => cfg.views.slice(0, 2).map((v) => base(s, v, z, { lit: true, night: n, trim: st?.trim }, `${s} ${viewName(v)} lit${n ? ' night' : ''}`))));
    }
    for (const st of kit?.states ?? []) row(`zoom ${z} · ${st.label}`, (s) => cfg.views.map((v) => base(s, v, z, { trim: st.trim }, `${s} ${viewName(v)} ${st.label}`)));
    if (kit?.layers) row(`zoom ${z} · layers`, (s) => Array.from({ length: kit.layers! }, (_, i) => base(s, cfg.views[0], z, { trim: i }, `${s} layer ${i}`)));
  }
  // Every cell of a zoom the same size, so old and new are seen at one scale.
  const boxes = new Map<number, [number, number, number, number]>();
  for (const r of rows) for (const c of r.cells) {
    const b = measure(c), was = boxes.get(c.zoom);
    boxes.set(c.zoom, was ? [Math.min(was[0], b[0]), Math.min(was[1], b[1]), Math.max(was[2], b[2]), Math.max(was[3], b[3])] : b);
  }
  for (const r of rows) {
    const line = document.createElement('div');
    line.className = 'row';
    line.append(Object.assign(document.createElement('div'), { className: 'label', textContent: r.label }));
    let last: string | null = null;
    for (const c of r.cells) {
      if (last && last !== c.side) line.append(Object.assign(document.createElement('div'), { className: 'gap' }));
      last = c.side;
      line.append(render(c, boxes.get(c.zoom)!));
    }
    block.append(line);
  }
  root.append(block);
}
(window as unknown as { DONE: boolean }).DONE = true;
