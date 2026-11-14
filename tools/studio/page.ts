/**
 * The page `tools/studio/shot.mjs` opens: the asset studio. One asset at a
 * time, drawn as the game draws it, into a contact sheet -- every view, every
 * zoom, by day and by night, each state and variant, and a strip of frames
 * for every moving part -- and judged against `docs/aesthetic.md` by the
 * checks in `./checks.ts`. What there is and how each is drawn is
 * `./families.ts`; the `world` family (the ground, the water, the sky across
 * the day, the night wash) is here, drawn by the game's own renderer over a
 * small island built for it, as tools/falls-page.ts does.
 *
 * Driven through `window.studio`:
 *   * `catalogue()`: every asset of every family, as data;
 *   * `sheet(spec)`: lays the sheet out under `#root` and returns its checks;
 *   * `bench(spec)`: the cost of drawing it, fresh and kept, once and twenty times.
 *
 * A tool and nothing else: the island it draws is a local copy of the rules
 * (`Game.create`), never a game of its own for anybody to play.
 */
import { DEFAULTS, FAMILIES, familyOf, footprintOf, syncKit, withClock, type Asset, type Box, type Family, type Opts } from './families';
import { judgeBox, judgeDay, judgeMotion, judgeMottle, judgeNight, judgeSame, read, type Check } from './checks';
import { NIGHT_WASH } from '../../src/render/nightwash';
import { pieceView } from '../../src/render/furniture';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { packTreeData, TileType } from '../../src/world/tiles';
import { FIRE_CAPACITY } from '../../src/game/campfire';
import { tileKey } from '../../src/game/tileindex';
import type { PlacedFurniture } from '../../src/game/furniture';
import type { Item } from '../../src/game/items';
import { SEASON_DAYS, SEASONS, YEAR_FROM, type Season } from '../../src/world/calendar';

export interface Spec {
  family: string;
  kind: string;
  zooms: number[];
  mag: number;
  turns: number[];
  facings: number[];
  frames: number;
  /** A reference picture as a data URL, and what it is. */
  ref?: string;
  refNote?: string;
  checkOnly?: boolean;
  /** The world family: the hours and seasons of its strip. */
  hours: number[];
  seasons: string[];
}

export interface Report {
  asset: Omit<Asset, 'look'>;
  checks: Check[];
  /** Pixels at zoom one: the box round what is drawn, floor contact at (0, 0). */
  box?: Box;
  error?: string;
}

interface Bench { fresh: number; kept: number; crowd: number }

interface Studio {
  ready: boolean;
  error: string;
  catalogue(): Asset[];
  sheet(spec: Spec): Promise<Report>;
  bench(spec: Spec): Promise<Bench>;
}

const GRASS = '#8fae6a';
const FLOOR = 'rgba(236, 226, 200, 0.5)';
const FLOOR_LINE = 'rgba(120, 104, 84, 0.35)';
const root = document.getElementById('root')!;

/* ---- the page ------------------------------------------------------------------------------ */

function el(tag: string, css: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}
const heading = (text: string, big = false): void => { root.append(el('div', `font:${big ? 'bold 18px' : 'bold 13px'} system-ui,sans-serif;color:${big ? '#f4ecd8' : '#d8cfbc'};margin:${big ? '12px 8px 2px' : '10px 8px 3px'}`, text)); };
const note = (text: string): void => { root.append(el('div', 'font:12px system-ui,sans-serif;color:#b8b0a0;margin:0 8px 6px;max-width:1800px;white-space:pre-wrap', text)); };
function row(label: string): HTMLElement {
  const r = el('div', 'display:flex;align-items:flex-end;gap:4px;margin:3px 6px;white-space:nowrap');
  r.append(el('div', 'width:150px;flex:none;color:#bbb;font:11px system-ui,sans-serif;white-space:normal', label));
  root.append(r);
  return r;
}
function cell(line: HTMLElement, cv: HTMLCanvasElement, label: string, mag: number, bad = false): void {
  cv.style.width = `${cv.width * mag}px`;
  cv.style.height = `${cv.height * mag}px`;
  cv.style.imageRendering = 'pixelated';
  const box = el('div', `display:inline-flex;flex-direction:column;align-items:center;font:10px system-ui,sans-serif;color:${bad ? '#f0a0a0' : '#ccc'}`);
  box.append(cv, el('div', '', label));
  line.append(box);
}

/* ---- drawing one cell ------------------------------------------------------------------------ */

interface Drawn { cv: HTMLCanvasElement; box: Box | null; declared: Box | null; ms: number }

/** Draw an asset on a clear canvas, floor contact at (fx, fy): what the checks read, and what a cell is framed on. */
function draw(fam: Family, a: Asset, o: Opts, zoom: number, w: number, h: number, fx: number, fy: number, ground: boolean): Drawn {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w);
  cv.height = Math.ceil(h);
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  if (ground) {
    g.fillStyle = GRASS;
    g.fillRect(0, 0, cv.width, cv.height);
    footprint(g, fx, fy, a, o, zoom);
  }
  const t0 = performance.now();
  let declared: Box | null = null;
  try {
    const b = fam.draw(g, fx, fy, zoom, a, o);
    if (b) declared = [fx + b[0], fy + b[1], fx + b[2], fy + b[3]];
  } catch (e) {
    g.fillStyle = '#e06060';
    g.font = '10px sans-serif';
    g.fillText(String(e).slice(0, 60), 2, 12);
    declared = null;
  }
  const ms = performance.now() - t0;
  if (o.night > 0) nightOver(fam, a, o, zoom, cv, fx, fy, ground);
  return { cv, box: null, declared, ms };
}

/**
 * The night over a cell: the asset drawn by day, the wash laid over it with
 * the holes the asset cuts in it, and what the asset draws over the wash, as
 * the renderer orders them. A family with no night pass of its own has
 * whatever it draws bright and coloured at night taken as emissive.
 */
function nightOver(fam: Family, a: Asset, o: Opts, zoom: number, cv: HTMLCanvasElement, fx: number, fy: number, ground: boolean): void {
  const g = cv.getContext('2d')!;
  const wash = document.createElement('canvas');
  wash.width = cv.width;
  wash.height = cv.height;
  const wg = wash.getContext('2d')!;
  wg.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * o.night})`;
  wg.fillRect(0, 0, wash.width, wash.height);
  const hole = (x: number, y: number, r: number, alpha: number): void => {
    wg.save();
    wg.globalCompositeOperation = 'destination-out';
    const grad = wg.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    wg.fillStyle = grad;
    wg.fillRect(x - r, y - r, r * 2, r * 2);
    wg.restore();
  };
  if (!ground) {
    // On a clear ground the wash falls only on the asset.
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(cv, 0, 0);
    wg.globalCompositeOperation = 'source-over';
  }
  if (fam.night) {
    // Its holes first, on a scratch canvas, so the wash goes down cut; then the wash; then what it draws over the wash, on the cell itself
    // (a night pass may blend with what is under it).
    const scratch = document.createElement('canvas');
    scratch.width = cv.width;
    scratch.height = cv.height;
    try { fam.night(scratch.getContext('2d')!, fx, fy, zoom, a, o, hole); } catch { /* a night pass that fails leaves the wash whole */ }
    g.drawImage(wash, 0, 0);
    try { fam.night(g, fx, fy, zoom, a, o, () => {}); } catch { /* as above */ }
    return;
  }
  // No pass of its own: the asset drawn at night, and of it only what is bright and coloured, over the wash.
  const lit = document.createElement('canvas');
  lit.width = cv.width;
  lit.height = cv.height;
  const lg = lit.getContext('2d', { willReadFrequently: true })!;
  try { fam.draw(lg, fx, fy, zoom, a, { ...o, lit: true }); } catch { /* nothing to lay over */ }
  const img = lg.getImageData(0, 0, lit.width, lit.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]) / 255, mn = Math.min(d[i], d[i + 1], d[i + 2]) / 255, l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
    if (!(l > 0.6 && sat > 0.3)) d[i + 3] = 0;
  }
  lg.putImageData(img, 0, 0);
  g.drawImage(wash, 0, 0);
  g.drawImage(lit, 0, 0);
}

/** The footprint, a pale square of subtiles under a piece, as the furniture sheet has it. */
function footprint(g: CanvasRenderingContext2D, x: number, y: number, a: Asset, o: Opts, zoom: number): void {
  const fp = footprintOf(a);
  if (!fp || a.views !== 'turns') return;
  const view = pieceView(o.side, o.turn);
  const hw = fp[0] * 5, hd = fp[1] * 5;
  const P = (u: number, v: number): [number, number] => [x + (u * view.ux + v * view.vx) * zoom, y + (u * view.uy + v * view.vy) * zoom];
  g.beginPath();
  [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(([u, v], i) => { const [px, py] = P(u, v); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.closePath();
  g.fillStyle = FLOOR;
  g.fill();
  g.strokeStyle = FLOOR_LINE;
  g.lineWidth = 1;
  g.beginPath();
  for (let u = -hw + 10; u < hw; u += 10) { const p = P(u, -hd), q = P(u, hd); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
  for (let v = -hd + 10; v < hd; v += 10) { const p = P(-hw, v), q = P(hw, v); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
  g.stroke();
}

/** The box round what a cell draws at a zoom, floor contact at (0, 0), from a trial on a big clear canvas. */
function measure(fam: Family, a: Asset, o: Opts, zoom: number): Box {
  const S = Math.ceil(520 * Math.max(1, zoom));
  const d = draw(fam, a, o, zoom, S, S, S / 2, S * 0.72, false);
  const r = read(d.cv.getContext('2d')!.getImageData(0, 0, S, S));
  if (!r.box) return [-10, -10, 10, 10];
  return [r.box[0] - S / 2, r.box[1] - S * 0.72, r.box[2] - S / 2, r.box[3] - S * 0.72];
}
const union = (a: Box, b: Box): Box => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/* ---- the sheet ------------------------------------------------------------------------------- */

interface Cell { label: string; o: Opts; night?: boolean }

const views = (a: Asset, spec: Spec): Array<[string, Partial<Opts>]> =>
  a.views === 'turns' ? spec.turns.map((t) => [`turn ${t}`, { turn: t }]) : a.views === 'facings' ? spec.facings.map((f) => [`facing ${f}`, { facing: f }]) : [['', {}]];

async function sheet(spec: Spec): Promise<Report> {
  root.replaceChildren();
  if (spec.family === 'world') return worldSheet(spec);
  const fam = familyOf(spec.family);
  const a = fam?.list().find((x) => x.kind === spec.kind);
  if (!fam || !a) {
    heading(`No ${spec.family}:${spec.kind}`, true);
    return { asset: { family: spec.family, kind: spec.kind } as Asset, checks: [], error: `no ${spec.family}:${spec.kind}` };
  }
  const { look: _look, ...plain } = a as Asset & { look?: unknown };
  void _look;
  heading(`${a.family}:${a.kind} — ${a.name}`, true);
  note(`${a.register === 'line' ? 'ligne claire' : 'painted'} · ${a.style} · ${a.entry} · ${a.file}${a.heightPx ? ` · game height ${a.heightPx}px at zoom 1` : ''}${a.emissive ? ' · emissive' : ''}`);
  if (spec.ref) {
    const r = row(`reference${spec.refNote ? `\n${spec.refNote}` : ''}`);
    const img = document.createElement('img');
    img.src = spec.ref;
    img.style.cssText = 'max-height:300px;max-width:900px;border:1px solid #555';
    r.append(img);
  }
  const base: Opts = { ...DEFAULTS, facing: spec.facings[0] ?? 1, turn: spec.turns[0] ?? 0 };
  const checks: Check[] = [];
  let box: Box | undefined;
  const expectSplash = ['flower', 'rune', 'spell'].includes(a.family);
  const litState = a.states.length ? a.states[a.states.length - 1].set.state ?? 0 : 0;

  if (fam.whole) {
    // A family that is a sheet of its own: as it is, by day and by night.
    for (const night of [0, 1]) {
      const r = row(night ? 'night' : 'day');
      const cv = fam.whole(a, { ...base, night });
      cell(r, cv, `${a.kind}${night ? ' night' : ''}`, 1);
      if (!night) {
        const rd = read(cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height));
        checks.push(...judgeDay(rd, a.register, 'whole sheet, ground and bodies included', false));
      }
    }
    return { asset: plain, checks };
  }

  await fam.prepare?.(a, base);
  for (const st of a.states) await fam.prepare?.(a, { ...base, ...st.set });
  for (const v of a.variants) await fam.prepare?.(a, { ...base, ...v.set });

  for (const zoom of spec.zooms) {
    const rows: Array<[string, Cell[]]> = [];
    const V = views(a, spec);
    rows.push([`zoom ${zoom} · day`, V.map(([l, s]) => ({ label: l, o: { ...base, ...s } }))]);
    rows.push([`zoom ${zoom} · night`, V.map(([l, s]) => ({ label: `${l} night`, o: { ...base, ...s, night: 1 }, night: true }))]);
    if (a.views === 'turns' && a.family === 'furniture') rows.push([`zoom ${zoom} · sides, turn 0`, (['s', 'e', 'n', 'w'] as const).map((side) => ({ label: `side ${side}`, o: { ...base, side } }))]);
    if (a.states.length) rows.push([`zoom ${zoom} · states`, a.states.map((s) => ({ label: s.label, o: { ...base, ...s.set } }))]);
    if (a.variants.length) rows.push([`zoom ${zoom} · variants`, a.variants.map((v) => ({ label: v.label, o: { ...base, ...v.set } }))]);
    if (a.emissive) rows.push([`zoom ${zoom} · lit, day and night`, [0, 1].map((n) => ({ label: n ? 'lit night' : 'lit day', o: { ...base, lit: true, state: litState, night: n }, night: !!n }))]);
    // Every cell of a zoom the same size, so they are seen at one scale.
    let b: Box | null = null;
    for (const [, cells] of rows) for (const c of cells.slice(0, 10)) { const m = measure(fam, a, c.o, zoom); b = b ? union(b, m) : m; }
    b ??= [-10, -10, 10, 10];
    if (zoom === spec.zooms[0]) box = [b[0] / zoom, b[1] / zoom, b[2] / zoom, b[3] / zoom];
    const pad = 8, w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2, fx = pad - b[0], fy = pad - b[1];
    for (const [label, cells] of rows) {
      const r = row(label);
      for (const c of cells) {
        const d = draw(fam, a, c.o, zoom, w, h, fx, fy, true);
        cell(r, d.cv, `${c.label} · ${d.ms.toFixed(1)} ms`, spec.mag);
      }
    }
  }

  // The motion strips, at the largest zoom asked for.
  const mz = Math.max(...spec.zooms, 2);
  for (const m of a.motions) {
    const n = spec.frames || m.frames;
    const cells: Cell[] = Array.from({ length: n }, (_, k) => {
      const u = n > 1 ? k / (n - 1) : 0;
      const t = m.secs ? u * m.secs : m.id === 'flicker' ? k * 0.15 + 0.01 : k * 0.4;
      const state = m.set?.state ?? (m.set?.lit ? litState : base.state);
      return { label: `${m.id} ${k}`, o: { ...base, ...m.set, state, motion: m.id, frame: k, u, t, night: m.id === 'flicker' || m.id === 'glow' || m.id === 'bloom' ? 0.6 : 0 } };
    });
    for (const c of cells) await fam.prepare?.(a, c.o);
    let b: Box | null = null;
    for (const c of cells) { const m = measure(fam, a, c.o, mz); b = b ? union(b, m) : m; }
    b ??= [-10, -10, 10, 10];
    const pad = 8, w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2, fx = pad - b[0], fy = pad - b[1];
    const r = row(`${m.label} · zoom ${mz}`);
    const reads = cells.map((c) => {
      const d = draw(fam, a, c.o, mz, w, h, fx, fy, true);
      cell(r, d.cv, c.label, Math.max(1, spec.mag - 1));
      const clear = draw(fam, a, c.o, mz, w, h, fx, fy, false);
      return read(clear.cv.getContext('2d')!.getImageData(0, 0, clear.cv.width, clear.cv.height));
    });
    if (reads.length > 1) checks.push(judgeMotion(reads[0], reads[Math.floor(reads.length / 2)], m.id, `${m.label} frames 0 and ${Math.floor(reads.length / 2)}`, m.optional));
  }

  // The checks: on the first view at zoom 2 by day and by night, the declared box, and a second draw of the same.
  const cz = 2;
  const b = measure(fam, a, base, cz);
  const pad = 8, w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2, fx = pad - b[0], fy = pad - b[1];
  const day = draw(fam, a, base, cz, w, h, fx, fy, false);
  const dayR = read(day.cv.getContext('2d')!.getImageData(0, 0, day.cv.width, day.cv.height));
  checks.push(...judgeDay(dayR, a.register, `${a.kind} first view, zoom ${cz}`, expectSplash, fam.splashy));
  const litO: Opts = a.emissive ? { ...base, lit: true, state: litState } : base;
  const night = draw(fam, a, { ...litO, night: 1 }, cz, w, h, fx, fy, true);
  const nightR = read(night.cv.getContext('2d')!.getImageData(0, 0, night.cv.width, night.cv.height));
  const dayG = draw(fam, a, litO, cz, w, h, fx, fy, true);
  checks.push(...judgeNight(read(dayG.cv.getContext('2d')!.getImageData(0, 0, dayG.cv.width, dayG.cv.height)), nightR, `${a.kind} first view, night`, a.emissive));
  checks.push(judgeBox(dayR, day.declared, `${a.kind} first view, zoom ${cz}`));
  // The facets, close up.
  const far = 6, fb = measure(fam, a, base, far);
  const close = draw(fam, a, base, far, fb[2] - fb[0] + 16, fb[3] - fb[1] + 16, 8 - fb[0], 8 - fb[1], false);
  checks.push(judgeMottle(read(close.cv.getContext('2d')!.getImageData(0, 0, close.cv.width, close.cv.height)), a.register, `${a.kind} first view, zoom ${far}`));
  // Back at the checks' zoom, with whatever a close-up put out of its bakes made again.
  await fam.prepare?.(a, base);
  if (!fam.unsteady) {
    const again = draw(fam, a, fam.fresh ? fam.fresh(base) : base, cz, w, h, fx, fy, false);
    checks.push(judgeSame(dayR, read(again.cv.getContext('2d')!.getImageData(0, 0, again.cv.width, again.cv.height)), fam.fresh ? `${a.kind} kept picture against the live path` : `${a.kind} drawn twice`));
  }
  if (a.heightPx && dayR.box) {
    // Its height over the floor contact, as the game measures a piece (the soft shadow under it is not counted).
    const hpx = (fy - dayR.box[1]) / cz;
    checks.push({ id: 'size-as-game', ok: Math.abs(hpx - a.heightPx) <= Math.max(6, a.heightPx * 0.25), said: `${hpx.toFixed(0)} px tall at zoom 1; the game says ${a.heightPx}`, cell: `${a.kind} first view` });
  } else if (dayR.box) {
    checks.push({ id: 'size-px', ok: null, said: `${((dayR.box[2] - dayR.box[0]) / cz).toFixed(0)} × ${((dayR.box[3] - dayR.box[1]) / cz).toFixed(0)} px at zoom 1`, cell: `${a.kind} first view` });
  }
  const r = row('checks');
  const list = el('div', 'font:11px ui-monospace,monospace;color:#ddd;white-space:pre;line-height:1.35');
  list.textContent = checks.map((c) => `${c.ok === null ? '  · ' : c.ok ? ' ok ' : 'FAIL'} ${c.id.padEnd(20)} ${c.said}  [${c.cell}]`).join('\n');
  r.append(list);
  return { asset: plain, checks, box };
}

/* ---- the cost ------------------------------------------------------------------------------- */

async function bench(spec: Spec): Promise<Bench> {
  const fam = familyOf(spec.family);
  const a = fam?.list().find((x) => x.kind === spec.kind);
  if (!fam || !a || fam.whole) return { fresh: 0, kept: 0, crowd: 0 };
  const base: Opts = { ...DEFAULTS, facing: spec.facings[0] ?? 1, turn: spec.turns[0] ?? 0 };
  await fam.prepare?.(a, base);
  const cv = document.createElement('canvas');
  cv.width = 800;
  cv.height = 600;
  const g = cv.getContext('2d')!;
  const once = (t: number): number => { const t0 = performance.now(); withClock(t, () => fam.draw(g, 400, 450, 1, a, { ...base, t })); return performance.now() - t0; };
  const fresh = once(0.5);
  const kept: number[] = [];
  for (let i = 0; i < 20; i++) kept.push(once(0.5));
  kept.sort((x, y) => x - y);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) withClock(0.5 + i * 0.01, () => fam.draw(g, 100 + (i % 5) * 150, 200 + Math.floor(i / 5) * 100, 1, a, { ...base, facing: i % 8, turn: i % 8, t: 0.5 + i * 0.01 }));
  return { fresh, kept: kept[10], crowd: performance.now() - t0 };
}

/* ---- the world: the ground, the water, the sky across the day, the wash ----------------------- */

const SIZE = 48;
const SCENES: Record<string, { about: string; tile: (x: number, y: number) => number; height: (x: number, y: number) => number; dress?: (game: Game) => void }> = {
  terrains: {
    about: 'Every ground, a band each, with a tree and the player in the middle: the ground family in one place.',
    tile: (x, y) => {
      const bands = [TileType.Grass, TileType.Dirt, TileType.Sand, TileType.Rock, TileType.Steppe, TileType.Tundra, TileType.Marsh, TileType.Clay, TileType.Peat, TileType.Tar, TileType.Moss, TileType.Snow, TileType.Cobblestone, TileType.Lawn, TileType.PackedDirt, TileType.Field];
      return bands[Math.floor(((x + y) / 2) % bands.length)];
    },
    height: () => 30,
  },
  meadow: { about: 'Grass, a few trees and bushes, the player: the island as it mostly is.', tile: () => TileType.Grass, height: (x, y) => 30 + 6 * Math.sin(x / 5) * Math.cos(y / 7) },
  shore: { about: 'Sand running down into the sea: the shore and the water.', tile: (x, y) => (y > 30 ? TileType.Sand : TileType.Grass), height: (_x, y) => Math.max(-14, 40 - (y - 10) * 2.2) },
  camp: {
    about: 'A camp on the grass: a campfire lit and one laid, sacks of what was dropped, a chest, a chair and a rune lantern beside them.',
    tile: () => TileType.Grass,
    height: () => 30,
    dress: (game) => {
      const fire = (id: number, x: number, y: number, lit: boolean, fuel: number): void => {
        const f = { id, x, y, sx: 1, sy: 1, fuel, lit, ash: lit ? 1 : 0 };
        game.campfires.set(id, f);
        game.placed.campfires.add(f);
      };
      fire(9001, 25, 24, true, FIRE_CAPACITY);
      fire(9002, 22, 26, false, FIRE_CAPACITY * 0.5);
      const piece = (id: number, kind: string, x: number, y: number, facing: 'n' | 's' | 'e' | 'w'): void => {
        const f = { id, kind, x, y, sx: 1, sy: 1, facing, ql: 50, items: [] } as unknown as PlacedFurniture;
        game.furniture.set(id, f);
        game.placed.furniture.add(f);
      };
      piece(9101, 'chest', 23, 23, 's');
      piece(9102, 'chair', 26, 26, 'w');
      piece(9103, 'rune_lantern', 27, 24, 's');
      const lay = (x: number, y: number, items: Array<{ id: string; count: number; rare?: number }>): void => {
        game.ground.set(tileKey(x, y), items.map((it) => ({ ...it, ql: 30 }) as unknown as Item));
      };
      lay(24, 26, [{ id: 'rock', count: 1 }]);
      lay(23, 25, [{ id: 'rock', count: 6 }, { id: 'log', count: 2 }]);
      lay(26, 23, [{ id: 'rock', count: 30 }, { id: 'plank', count: 4 }, { id: 'shaft', count: 3 }, { id: 'hatchet', count: 1, rare: 3 }]);
    },
  },
  rock: { about: 'A rock face and its steps: stone and the outcrops.', tile: (x, y) => (Math.abs(x - 24) < 6 || y < 18 ? TileType.Rock : TileType.Grass), height: (x, y) => (y < 18 ? 90 : Math.abs(x - 24) < 6 ? 60 : 30) },
};

let world: { game: Game; renderer: Renderer; canvasEl: HTMLCanvasElement; scene: string; hour: number; seasonIndex: number } | null = null;

function buildWorld(scene: string): void {
  const S = SCENES[scene] ?? SCENES.meadow;
  if (!world) {
    const canvasEl = document.createElement('canvas');
    canvasEl.id = 'game';
    canvasEl.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden';
    document.body.appendChild(canvasEl);
    const game = Game.create(4242, SIZE);
    game.islandClock = () => YEAR_FROM + (world!.seasonIndex * SEASON_DAYS + 20) * DAY_SECONDS + (world!.hour / 24) * DAY_SECONDS;
    game.creatures.fromIsland = true;
    game.bodyFromIsland = true;
    game.packFromIsland = true;
    game.journalReady = false;
    game.tallyFromIsland = true;
    game.ask = () => {};
    game.settings.fog = false;
    const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
    world = { game, renderer, canvasEl, scene: '', hour: 13, seasonIndex: 1 };
  }
  if (world.scene === scene) return;
  const w = world.game.world;
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, S.height(x, y));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) w.setTile(x, y, S.tile(x, y) as TileType, 0);
  const trees: Array<[number, number, number]> = [[22, 22, 1], [27, 23, 5], [22, 27, 3], [26, 26, 2]];
  for (const [x, y, sp] of trees) if (S.tile(x, y) !== TileType.Rock && S.height(x, y) > 0) w.setTile(x, y, TileType.Tree, packTreeData(sp, (x * 7 + y) & 7));
  if (scene === 'meadow') for (const [x, y] of [[24, 22], [26, 24], [23, 26]]) w.setTile(x, y, TileType.Bush, 0);
  S.dress?.(world.game);
  world.game.player.x = 24.5;
  world.game.player.y = 24.5;
  world.game.update(0.01);
  world.scene = scene;
}

async function worldSheet(spec: Spec): Promise<Report> {
  const scene = spec.kind in SCENES ? spec.kind : 'meadow';
  heading(`world:${scene} — ${SCENES[scene].about}`, true);
  note('painted · Renderer over a small island (Game.create) · src/render/renderer.ts, sky.ts, nightwash.ts, water.ts, shore.ts');
  if (spec.ref) {
    const r = row(`reference${spec.refNote ? `\n${spec.refNote}` : ''}`);
    const img = document.createElement('img');
    img.src = spec.ref;
    img.style.cssText = 'max-height:300px;max-width:900px;border:1px solid #555';
    r.append(img);
  }
  buildWorld(scene);
  const { game, renderer, canvasEl } = world!;
  const cam = renderer.camera;
  const checks: Check[] = [];
  const W = 440, H = 330;
  const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));
  const seasons = spec.seasons.length ? spec.seasons : ['summer'];
  for (const zoom of spec.zooms) {
    for (const season of seasons) {
      for (const turn of spec.turns.slice(0, 2)) {
        const r = row(`zoom ${zoom} · ${season} · turn ${turn}`);
        const reads: Array<[number, ReturnType<typeof read>]> = [];
        for (const hour of spec.hours) {
          world!.hour = hour;
          world!.seasonIndex = Math.max(0, SEASONS.indexOf(season as Season));
          cam.zoom = zoom;
          cam.rotation = turn;
          cam.focus(24.5, 24.5, game.world.getHeight(24, 24), null);
          for (let i = 0; i < 20; i++) {
            game.update(1 / 60);
            renderer.time = i / 20;
            renderer.render(0);
            await nextFrame();
          }
          const cv = document.createElement('canvas');
          cv.width = W;
          cv.height = H;
          const g = cv.getContext('2d', { willReadFrequently: true })!;
          const dpr = window.devicePixelRatio || 1;
          g.drawImage(canvasEl, (canvasEl.width / dpr - W) / 2 * dpr, (canvasEl.height / dpr - H) / 2 * dpr, W * dpr, H * dpr, 0, 0, W, H);
          cell(r, cv, `${hour}:00`, 1);
          reads.push([hour, read(g.getImageData(0, 0, W, H))]);
        }
        if (zoom === spec.zooms[0] && season === seasons[0] && turn === spec.turns[0]) {
          const noon = reads.find(([h]) => h >= 11 && h <= 15) ?? reads[0];
          checks.push(...judgeDay(noon[1], 'paint', `world:${scene} ${noon[0]}:00`, false).filter((c) => !['silhouette-soft', 'lit-from-left', 'ink-own-colour'].includes(c.id)));
          const night = reads.find(([h]) => h >= 22 || h <= 3);
          if (night) checks.push(...judgeNight(noon[1], night[1], `world:${scene} ${night[0]}:00`, false));
        }
      }
    }
  }
  const r = row('checks');
  const list = el('div', 'font:11px ui-monospace,monospace;color:#ddd;white-space:pre;line-height:1.35');
  list.textContent = checks.map((c) => `${c.ok === null ? '  · ' : c.ok ? ' ok ' : 'FAIL'} ${c.id.padEnd(20)} ${c.said}  [${c.cell}]`).join('\n');
  r.append(list);
  return { asset: { family: 'world', kind: scene, name: SCENES[scene].about, register: 'paint', style: 'scene', entry: 'Renderer', file: 'src/render/renderer.ts', views: 'turns', states: [], variants: [], motions: [], emissive: false, ref: 1 }, checks };
}

/* ---- the catalogue ----------------------------------------------------------------------------- */

function catalogue(): Asset[] {
  const out: Asset[] = [];
  for (const f of FAMILIES) {
    try {
      for (const a of f.list()) {
        const { look: _look, colour: _colour, ...plain } = a as Asset & { look?: unknown; colour?: unknown };
        void _look; void _colour;
        out.push(plain as Asset);
      }
    } catch (e) {
      out.push({ family: f.id, kind: '?', name: `could not list: ${String(e)}`, register: f.register, style: 'scene', entry: '', file: '', views: 'none', states: [], variants: [], motions: [], emissive: false, ref: f.ref });
    }
  }
  for (const [kind, s] of Object.entries(SCENES)) out.push({ family: 'world', kind, name: s.about, register: 'paint', style: 'scene', entry: 'Renderer', file: 'src/render/renderer.ts', views: 'turns', states: [], variants: SEASONS.map((x) => ({ label: x, set: { season: x } })), motions: [{ id: 'day', label: 'the sky across the day', frames: 6 }], emissive: false, ref: 1 });
  return out;
}

export const FAMILY_ABOUT = (): Array<[string, string, string]> => [...FAMILIES.map((f): [string, string, string] => [f.id, f.register, f.about]), ['world', 'paint', 'The ground by terrain, the water and shore, the sky across the day and the night wash, as a scene strip: a tile patch with a tree and the player on it at each hour.']];

const studio: Studio = { ready: false, error: '', catalogue, sheet, bench };
(window as unknown as { studio: Studio; FAMILY_ABOUT: typeof FAMILY_ABOUT }).studio = studio;
(window as unknown as { FAMILY_ABOUT: typeof FAMILY_ABOUT }).FAMILY_ABOUT = FAMILY_ABOUT;
try {
  syncKit();
  studio.ready = true;
} catch (e) {
  studio.error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  studio.ready = true;
}
