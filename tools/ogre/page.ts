/**
 * The page `tools/ogre/shot.mjs` opens to look the ogre proposals over
 * (`src/render/wild-ogre.ts`) beside the live ogre and the other monsters.
 *
 * Driven through `window.ogre`:
 *   * `sheet(id)`: one proposal's turns by day and night, its standing loop,
 *     walk and run, strike from two sides, and the game's zooms on grass with
 *     an orc and a goblin beside it;
 *   * `close(id)`: the proposal drawn big, crisp, by day and night;
 *   * `lineup()`: the live ogre, the three proposals, the orc, the goblin and
 *     revamped wildermon, at the game's scale, by day and night;
 *   * `bench(id, n, frames)`: the cost of a crowd of `n` of them.
 *
 * A body at a game zoom is drawn as the island draws it (`drawBeast`): a
 * picture made at the zoom step it falls in, capped at sixteen, and put down
 * at the zoom asked for.
 */
import { drawKind, extentOf, kitOf, paletteFor, drawBeast, beastFrame, type Anim, type Kind } from '../../src/render/beasts';
import { loadWildermon, wildermonKind } from '../../src/render/wildermon';
import { SPECIES } from '../../src/game/creatures';
import { NIGHT_WASH } from '../../src/render/nightwash';
import { OGRE } from '../../src/render/wild-upright';
import { OGRE_PROPOSALS } from '../../src/render/wild-ogre';

const DEV = window.devicePixelRatio || 1;
const GRASS = '#7d9b5e';
const STEPS = Array.from({ length: 21 }, (_, q) => 0.5 * 2 ** (q / 4));
const inkAt = (step: number, size = 1): number => Math.max(1.1, (0.7 * step) / size) / step;

interface Body { key: string; kind: Kind; colors: [string, string] }

function bodyOf(id: string, variant = 0): Body {
  if (id === 'live') return { key: 'ogre-live', kind: OGRE, colors: SPECIES.ogre.variants[variant] };
  if (id in OGRE_PROPOSALS) return { key: `ogre-${id}`, kind: OGRE_PROPOSALS[id].kind, colors: SPECIES.ogre.variants[variant] };
  const [sp, st] = id.split('@');
  const m = wildermonKind(sp, Number(st ?? 0));
  if (!m) throw new Error(`no ${id}`);
  return { key: m.key, kind: m.kind, colors: SPECIES[sp].variants[variant] };
}

const still = (o: Partial<Anim> = {}): Anim => ({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.3, ...o });

/** A pose by name: `stand:<t>`, `walk:<u>`, `run:<u>`, `strike:<t>`. */
function poseOf(p: string): Anim {
  const [k, v] = p.split(':');
  const x = Number(v ?? 0);
  if (k === 'stand') return still({ t: x, breath: 0.5 + 0.5 * Math.sin((x * Math.PI * 2 * 7) / 24) });
  if (k === 'walk') return still({ go: 1, gait: 0, u: x });
  if (k === 'run') return still({ go: 1, gait: 1, u: x });
  return still({ act: { kind: k as 'strike', t: x } });
}

/** A body with its feet at (x, y) as the island draws it at `zoom`: a picture at its zoom step, put down at the zoom. */
function gameDraw(g: CanvasRenderingContext2D, x: number, y: number, zoom: number, b: Body, facing: number, a: Anim): void {
  const size = b.kind.size ?? 1, z = zoom * size;
  const step = STEPS.find((s) => s >= z * 0.98) ?? STEPS[STEPS.length - 1];
  const kit = kitOf(b.key, b.kind, step < 1.5 ? 0 : 1);
  const pal = paletteFor(b.key, b.kind, b.colors);
  const e = extentOf(b.kind, kit, facing, a);
  const pad = 2 + (e.x1 - e.x0) * 0.25;
  const k = step * DEV;
  const w = Math.ceil((e.x1 - e.x0 + pad * 2) * k), h = Math.ceil((Math.max(e.y1, 0) - e.y0 + pad * 2) * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const pg = c.getContext('2d')!;
  const ox = (-e.x0 + pad) * k, oy = (-e.y0 + pad) * k;
  pg.setTransform(k, 0, 0, k, ox, oy);
  drawKind(pg, b.kind, kit, pal, facing, a, inkAt(step, size), 1 / step);
  const s = z / step / DEV;
  g.drawImage(c, x - ox * s, y - oy * s, w * s, h * s);
}

/** A body drawn crisp at scale `k` (pixels to its units), feet at (x, y). */
function crispDraw(g: CanvasRenderingContext2D, x: number, y: number, k: number, b: Body, facing: number, a: Anim, lod = 1): void {
  const kit = kitOf(b.key, b.kind, lod);
  const pal = paletteFor(b.key, b.kind, b.colors);
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  drawKind(g, b.kind, kit, pal, facing, a, Math.max(0.9, 1.2 * Math.min(1, 300 / (k * 5))) / k, 1 / k);
  g.restore();
}

function night(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.save();
  g.setTransform(DEV, 0, 0, DEV, 0, 0);
  g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

function canvasOf(w: number, h: number, bg = GRASS): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DEV);
  cv.height = Math.round(h * DEV);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.setTransform(DEV, 0, 0, DEV, 0, 0);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // A tile grid, faintly, for scale: a tile is 96 by 48 at zoom one.
  return { cv, g };
}

function tiles(g: CanvasRenderingContext2D, w: number, h: number, zoom: number, cx: number, cy: number): void {
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 1;
  const tw = 48 * zoom, th = 24 * zoom;
  for (let q = -40; q <= 40; q++) {
    g.beginPath();
    g.moveTo(cx + q * tw - 40 * tw, cy + q * th + 40 * th);
    g.lineTo(cx + q * tw + 40 * tw, cy + q * th - 40 * th);
    g.moveTo(cx + q * tw - 40 * tw, cy - q * th - 40 * th);
    g.lineTo(cx + q * tw + 40 * tw, cy - q * th + 40 * th);
    g.stroke();
  }
  g.restore();
}

const root = document.getElementById('root')!;
function heading(text: string, big = false): void {
  const d = document.createElement('div');
  d.style.cssText = `font:${big ? 'bold 20px' : 'bold 13px'} system-ui,sans-serif;color:${big ? '#f4ecd8' : '#d8cfbc'};margin:${big ? '10px 8px 2px' : '10px 8px 3px'}`;
  d.textContent = text;
  root.append(d);
}
function note(text: string): void {
  const d = document.createElement('div');
  d.style.cssText = 'font:12px system-ui,sans-serif;color:#b8b0a0;margin:0 8px 6px;max-width:1500px';
  d.textContent = text;
  root.append(d);
}
function row(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = 'white-space:nowrap;margin:0 6px';
  root.append(d);
  return d;
}
function cell(line: HTMLElement, cv: HTMLCanvasElement, label: string): void {
  const box = document.createElement('div');
  box.style.cssText = 'display:inline-block;margin:2px;font:11px system-ui,sans-serif;text-align:center;color:#ddd;vertical-align:top';
  box.append(cv, document.createElement('br'), label);
  line.append(box);
}

/** One body in a cell `w` by `h`, at a game zoom, feet at the cell's foot. */
function gameCell(line: HTMLElement, w: number, h: number, zoom: number, b: Body, facing: number, pose: string, nightly: boolean, label: string): void {
  const { cv, g } = canvasOf(w, h);
  tiles(g, w, h, zoom, w / 2, h - 26);
  gameDraw(g, w / 2, h - 26, zoom, b, facing, poseOf(pose));
  if (nightly) night(g, w, h);
  cell(line, cv, label);
}

function sheet(id: string): void {
  const P = OGRE_PROPOSALS[id];
  const b = bodyOf(id);
  heading(`Ogre ${id}: ${P.name}`, true);
  note(P.concept);
  const Z = 0.6;
  heading(`Turns, facings 0 to 7, standing, zoom ${Z} (day)`);
  let r = row();
  for (let f = 0; f < 8; f++) gameCell(r, 250, 300, Z, b, f, 'stand:0', false, `facing ${f}`);
  heading(`Turns, night`);
  r = row();
  for (let f = 0; f < 8; f++) gameCell(r, 250, 300, Z, b, f, 'stand:0', true, `facing ${f}`);
  heading('Standing loop (facing 1): seconds into the 24 s loop');
  r = row();
  for (const t of P.idle) gameCell(r, 250, 300, Z, b, 1, `stand:${t}`, false, `t ${t}`);
  heading('Walk (facing 2) and run (facing 2): share of a stride');
  r = row();
  for (const u of [0, 0.25, 0.5, 0.75]) gameCell(r, 250, 300, Z, b, 2, `walk:${u}`, false, `walk ${u}`);
  for (const u of [0, 0.25, 0.5, 0.75]) gameCell(r, 250, 300, Z, b, 2, `run:${u}`, false, `run ${u}`);
  for (const f of [1, 3]) {
    heading(`Strike (facing ${f}): share of its 0.55 s`);
    r = row();
    for (const t of [0, 0.15, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9]) gameCell(r, 250, 300, Z, b, f, `strike:${t}`, false, `strike ${t}`);
  }
  heading('Game zooms 0.35, 0.5, 1 beside an orc and a goblin, day and night');
  r = row();
  for (const nightly of [false, true]) {
    for (const z of [0.35, 0.5, 1]) {
      const w = z === 1 ? 560 : z === 0.5 ? 300 : 220, h = z === 1 ? 420 : 260;
      const { cv, g } = canvasOf(w, h);
      const fy = h - 30;
      tiles(g, w, h, z, w / 2, fy);
      gameDraw(g, w * 0.28, fy - 10 * z, z, bodyOf('goblin'), 1, poseOf('stand:2'));
      gameDraw(g, w * 0.5, fy, z, b, 1, poseOf('stand:0'));
      gameDraw(g, w * 0.78, fy + 6 * z, z, bodyOf('orc'), 1, poseOf('stand:4'));
      if (nightly) night(g, w, h);
      cell(r, cv, `zoom ${z}${nightly ? ' night' : ''}`);
    }
  }
}

function close(id: string): void {
  const P = OGRE_PROPOSALS[id];
  const b = bodyOf(id);
  heading(`Ogre ${id}: ${P.name}, close`, true);
  const r = row();
  for (const [f, pose, nightly, label] of [[1, 'stand:0', false, 'facing 1'], [6, 'stand:0', false, 'facing 6'], [1, 'strike:0.5', false, 'strike, the blow'], [1, 'stand:0', true, 'night']] as Array<[number, string, boolean, string]>) {
    const { cv, g } = canvasOf(460, 560);
    const a = poseOf(pose);
    const kit = kitOf(b.key, b.kind, 1);
    const e = extentOf(b.kind, kit, f, a);
    const k = Math.min(420 / (e.x1 - e.x0), 500 / (Math.max(e.y1, 0) - e.y0));
    crispDraw(g, 230 - ((e.x0 + e.x1) / 2) * k, 540 - Math.max(e.y1, 0) * k, k, b, f, a);
    if (nightly) night(g, 460, 560);
    cell(r, cv, label);
  }
  // The far level of detail, which the island draws a body at below a zoom step of 1.5 (never, at an ogre's size, but kept).
  const { cv, g } = canvasOf(230, 560);
  const a = poseOf('stand:0');
  const e = extentOf(b.kind, kitOf(b.key, b.kind, 0), 1, a);
  const k = Math.min(200 / (e.x1 - e.x0), 500 / (Math.max(e.y1, 0) - e.y0));
  crispDraw(g, 115 - ((e.x0 + e.x1) / 2) * k, 540 - Math.max(e.y1, 0) * k, k, b, 1, a, 0);
  cell(r, cv, 'far detail (lod 0)');
}

function lineup(): void {
  heading('Lineup at the game\'s scale, zoom 0.6: live ogre, A, B, C, orc, goblin, Bastiondrake, Monolithump, Earthrend', true);
  const who = ['live', 'A', 'B', 'C', 'orc', 'goblin', 'cobbe@2', 'quarra@2', 'snout@2'];
  const xs = [110, 330, 560, 790, 980, 1090, 1200, 1300, 1400];
  for (const [facing, nightly] of [[1, false], [1, true], [3, false]] as Array<[number, boolean]>) {
    const w = 1500, h = 340;
    const r = row();
    const { cv, g } = canvasOf(w, h);
    tiles(g, w, h, 0.6, w / 2, h - 30);
    who.forEach((id, q) => gameDraw(g, xs[q], h - 30, 0.6, bodyOf(id), facing, poseOf('stand:0')));
    if (nightly) night(g, w, h);
    cell(r, cv, `facing ${facing}${nightly ? ', night' : ''}`);
  }
  heading('Style: each drawn to the same height, crisp: live ogre, A, B, C beside revamped wildermon (Bastiondrake, Monolithump, Earthrend, Cragjaws, Hallowmire)', true);
  const style = ['live', 'A', 'B', 'C', 'cobbe@2', 'quarra@2', 'snout@2', 'thumpa@2', 'whispet@2'];
  const r = row();
  for (const id of style) {
    const b = bodyOf(id);
    const { cv, g } = canvasOf(240, 280);
    const a = poseOf('stand:0');
    const e = extentOf(b.kind, kitOf(b.key, b.kind, 1), 1, a);
    const k = Math.min(220 / (e.x1 - e.x0), 250 / (Math.max(e.y1, 0) - e.y0));
    crispDraw(g, 120 - ((e.x0 + e.x1) / 2) * k, 268 - Math.max(e.y1, 0) * k, k, b, 1, a);
    cell(r, cv, id);
  }
}

/** Ms to draw a crowd of `n` of one body: each picture made afresh (what a new one costs), and as the island puts them down. */
function bench(id: string, n: number, frames: number): { fresh: number; game: number; parts: number; faces: number; detail: string } {
  const b = bodyOf(id);
  const { cv, g } = canvasOf(1600, 900);
  root.append(cv);
  // Fresh: every body drawn through its mesh at zoom 1's step (sixteen), as a new picture of it is.
  const kit = kitOf(b.key, b.kind, 1);
  const pal = paletteFor(b.key, b.kind, b.colors);
  const off = document.createElement('canvas');
  off.width = 400 * DEV;
  off.height = 600 * DEV;
  const og = off.getContext('2d')!;
  const t0 = performance.now();
  for (let fr = 0; fr < frames; fr++) {
    for (let q = 0; q < n; q++) {
      og.setTransform(16 * DEV, 0, 0, 16 * DEV, 200 * DEV, 560 * DEV);
      drawKind(og, b.kind, kit, pal, q % 8, poseOf(`stand:${(fr * 0.37 + q * 1.3) % 24}`), inkAt(16, b.kind.size), 1 / 16);
    }
  }
  const fresh = (performance.now() - t0) / frames;
  // Game: through `drawBeast`, kept pictures and all, a crowd standing and walking about.
  for (let fr = 0; fr < 30; fr++) {
    beastFrame();
    for (let q = 0; q < n; q++) drawBeast(g, 100 + (q % 8) * 190, 300 + Math.floor(q / 8) * 200, 0.6, b.key, b.kind, b.colors, { id: q + 1, facing: q % 8, phase: fr * 0.05 + q, moving: q % 3 === 0 });
  }
  const t1 = performance.now();
  for (let fr = 0; fr < frames; fr++) {
    beastFrame();
    g.fillStyle = GRASS;
    g.fillRect(0, 0, 1600, 900);
    for (let q = 0; q < n; q++) drawBeast(g, 100 + (q % 8) * 190, 300 + Math.floor(q / 8) * 200, 0.6, b.key, b.kind, b.colors, { id: q + 1, facing: q % 8, phase: fr * 0.05 + q, moving: q % 3 === 0 });
  }
  const game = (performance.now() - t1) / frames;
  cv.remove();
  const faces = kit.reduce((s, pc) => s + pc.mesh.f.length, 0);
  const detail = kit.map((pc) => `${pc.key}:${pc.mesh.f.length}`).join(' ');
  return { fresh, game, parts: kit.length, faces, detail };
}

/** A quick strip of one body at one facing through some poses, for working on a move. */
function strip(id: string, facing: number, poses: string[]): void {
  const b = bodyOf(id);
  const r = row();
  for (const pose of poses) gameCell(r, 250, 300, 0.6, b, facing, pose, false, `${id} f${facing} ${pose}`);
}

const W = window as unknown as { ogre: Record<string, unknown>; READY: boolean };
W.ogre = { sheet, close, lineup, bench, strip };
void Promise.all(['goblin', 'orc', 'cobbe', 'quarra', 'snout', 'thumpa', 'whispet'].map((s) => loadWildermon(s))).then(() => {
  W.READY = true;
});
