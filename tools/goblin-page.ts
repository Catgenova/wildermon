/**
 * The page `tools/goblin-shot.mjs` opens to look the goblin's three subspecies
 * over (`GOBLIN_RUNECUT` in `src/render/goblin-runecut.ts`; A the Scrapper, B
 * the Raider, C the Hexer Goblin): for one, a sheet of it close up at all eight
 * turns, standing, looking about, walking, running and striking; then at the
 * size the island is played at, by day and by night, marked as hostile and
 * not, on the game's own ground through the game's own renderer, put out in
 * its own variant so the line draws it as that subspecies; and a lineup of all
 * three beside revamped wildermon.
 *
 * Driven through `window.gob`: `sheet(look)` lays the sheet out for one look,
 * `lineup()` the lineup, `big(...)` single looks big, `refs(...)` wildermon
 * big; `fresh(look, lod)` times a goblin drawn afresh, `pieces(look)` what
 * each of its pieces costs, and `bench(look, n)` a crowd of goblins drawn
 * afresh and on the island. Drawn close up, the look is put on a kind of the
 * page's own (`GOBLIN`, `Object.assign`); on the island, each goblin is drawn
 * as its variant's subspecies, as the game draws it.
 *
 * A tool and nothing else: the island it draws is a local copy of the rules
 * (`Game.create`), as the falls page's is, never a game for anybody to play.
 */
import { Game } from '../src/game/game';
import { Renderer } from '../src/render/renderer';
import { FullscreenCanvas } from '../src/engine/canvas';
import { DAY_SECONDS } from '../src/game/pace';
import { TileType } from '../src/world/tiles';
import { HALF_H, HALF_W } from '../src/render/iso';
import { levelSkill, SPECIES } from '../src/game/creatures';
import { drawKind, extentOf, forgetBeast, kitOf, paletteFor, type Anim, type Kind, type Piece } from '../src/render/beasts';
import { drawWildermonPortrait, loadWildermon, wildermonKind } from '../src/render/wildermon';
import { mesh } from '../src/render/figure';
import { GOBLIN_RUNECUT } from '../src/render/goblin-runecut';

interface GobPage {
  ready: boolean;
  error: string;
  sheet(look: string): Promise<void>;
  lineup(): Promise<void>;
  refs(list: Array<[string, number, number]>): Promise<void>;
  big(list: Array<[string, number, number, number]>): Promise<void>;
  frames(look: string, motion: string): Promise<void>;
  bench(look: string, n: number): Promise<{ fresh: number; picture: number; island: number; islandGo: number }>;
  pieces(look: string): Array<[string, number]>;
  fresh(look: string, lod: number): number;
}
const page: GobPage = { ready: false, error: '', sheet: async () => {}, lineup: async () => {}, refs: async () => {}, big: async () => {}, frames: async () => {}, bench: async () => ({ fresh: 0, picture: 0, island: 0, islandGo: 0 }), pieces: () => [], fresh: () => 0 };
(window as unknown as { gob: GobPage }).gob = page;

const LOOKS: Record<string, Kind> = { ...GOBLIN_RUNECUT };
/** Each look's subspecies' name, as the field guide has it, and its variant. */
const NAMES: Record<string, string> = Object.fromEntries(['A', 'B', 'C'].map((l, v) => [l, `${l}: ${SPECIES.goblin.subspecies![v]}`]));
const VARIANT: Record<string, number> = { A: 0, B: 1, C: 2 };
/** The kind the page draws close up, the look put on it (`setLook`), and its pictures kept under `goblin`. */
const GOBLIN: Kind = { ...GOBLIN_RUNECUT.A };
let current = 'A';
/** The variant the look is put out in: its subspecies' own, and its colours. */
let lookVariant = 0;
function setLook(look: string): void {
  lookVariant = VARIANT[look] ?? 0;
  if (look === current) return;
  // Forget what was kept for the goblin first, so its pieces, pictures and colours are made afresh from the new look.
  forgetBeast('goblin', GOBLIN);
  Object.assign(GOBLIN, LOOKS[look]);
  if (!LOOKS[look].acts) delete (GOBLIN as Partial<Kind>).acts;
  if (!LOOKS[look].glow) delete (GOBLIN as Partial<Kind>).glow;
  if (!LOOKS[look].extra) delete (GOBLIN as Partial<Kind>).extra;
  current = look;
}

const nextFrame = (): Promise<number> => new Promise((done) => requestAnimationFrame(done));
const DPR = window.devicePixelRatio || 1;
const GOB_COLORS = SPECIES.goblin.variants;

/* ---- close up ---------------------------------------------------------------------------- */

const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.3 };

/** A cell `w` by `h` CSS pixels of the goblin in `look`, posed, at one scale for every turn and pose (`k` pixels a unit). */
function closeCell(w: number, h: number, facing: number, a: Anim, k: number, bg: string, variant = lookVariant): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, cv.width, cv.height);
  const kit = kitOf('goblin', GOBLIN, 1);
  const pal = paletteFor('goblin', GOBLIN, GOB_COLORS[variant]);
  g.scale(DPR, DPR);
  g.translate(w / 2, h * 0.86);
  g.scale(k, k);
  drawKind(g, GOBLIN, kit, pal, facing, a, Math.max(0.9, 1.2) / k, 1 / (k * DPR));
  return cv;
}

/** How many CSS pixels a unit of the goblin is, for its tallest turn standing to fill `h`. */
function closeScale(h: number): number {
  const kit = kitOf('goblin', GOBLIN, 1);
  let tall = 0;
  for (let f = 0; f < 8; f++) {
    const e = extentOf(GOBLIN, kit, f, still);
    tall = Math.max(tall, Math.max(0, e.y1) - e.y0);
  }
  return (h * 0.8) / tall;
}

/* ---- the island -------------------------------------------------------------------------- */

const SIZE = 48;
let game: Game;
let renderer: Renderer;
let gameCanvas: HTMLCanvasElement;
let hour = 13;

/** A creature on the island: what it is, where, which way on the screen it faces, and what it is doing. */
interface Body { species: string; x: number; y: number; facing: number; moving?: boolean; run?: boolean; strike?: number; stage?: number; variant?: number }

/** The way in the world to head for a body to face `f` on the screen at the camera's first turn. */
function headingFor(f: number): [number, number] {
  const ux = Math.sin((f * Math.PI) / 4), uy = Math.cos((f * Math.PI) / 4);
  return [(ux / HALF_W + uy / HALF_H) / 2, (uy / HALF_H - ux / HALF_W) / 2];
}

function stock(bodies: Body[]): void {
  for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
  for (const b of bodies) {
    const c = game.creatures.spawn(b.species, b.x, b.y, 'wild', () => 0.5);
    const [dx, dy] = headingFor(b.facing);
    c.dirX = dx;
    c.dirY = dy;
    c.variant = b.variant ?? 0;
    // Never hit, so never drawn in a blow's flash.
    c.attackedAt = -1e9;
    c.moving = !!b.moving;
    c.state = b.moving ? 'wander' : 'idle';
    if (b.stage) {
      const skill = levelSkill(SPECIES[b.species]);
      if (skill) c.skills = { ...c.skills, [skill]: b.stage === 2 ? 60 : 30 };
    }
    (c as { strikeAt?: number }).strikeAt = b.strike;
  }
  // Filed under their tiles, which the renderer finds them by, without a tick of the rules moving them.
  const index = game.creatures as unknown as { clearTiles(): void; place(c: unknown): void };
  index.clearTiles();
  for (const c of game.creatures.list.values()) index.place(c);
}

/** Draw the island at a zoom and hour, looking at a point, for `frames` frames ending at the clock's `t`. */
async function islandFrame(zoom: number, h: number, at: [number, number], frames = 20): Promise<void> {
  hour = h;
  const cam = renderer.camera;
  cam.zoom = zoom;
  cam.rotation = 0;
  // The player out of the picture, up the screen from what is looked at.
  game.player.x = at[0] - 7;
  game.player.y = at[1] - 7;
  for (let i = 0; i < frames; i++) {
    game.time += 1 / 30;
    for (const c of game.creatures.list.values()) {
      const s = (c as { strikeAt?: number }).strikeAt;
      if (s !== undefined) {
        c.act = 'strike';
        c.actAt = game.time - s * 0.55;
      }
      if (c.moving) c.walkPhase += (c.state === 'run' ? 0.5 : 0.3);
    }
    cam.focus(at[0], at[1], 20, null);
    renderer.render(1 / 30);
    await nextFrame();
  }
}

/** A crop of the game canvas, `w` by `h` CSS pixels round the screen point (cx, cy), as a canvas of its own. */
function crop(cx: number, cy: number, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  cv.getContext('2d')!.drawImage(gameCanvas, Math.round((cx - w / 2) * DPR), Math.round((cy - h / 2) * DPR), cv.width, cv.height, 0, 0, cv.width, cv.height);
  return cv;
}

/** The screen point of a spot on the island at ground height. */
function screenOf(x: number, y: number): [number, number] {
  const cam = renderer.camera;
  return [cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, 20)];
}

/** A row of bodies along the screen, a tile's diagonal apart, starting at (x0, y0). */
function row(list: Array<Omit<Body, 'x' | 'y'>>, x0: number, y0: number, gap = 1): Body[] {
  return list.map((b, i) => ({ ...b, x: x0 + i * gap, y: y0 - i * gap }));
}

/* ---- the sheet ----------------------------------------------------------------------------- */

const root = document.createElement('div');
root.id = 'sheet';
root.style.cssText = 'position:absolute;left:0;top:0;z-index:5;background:#20232a;color:#e8e4da;font:13px/1.35 system-ui,sans-serif;padding:12px;display:inline-block';

function heading(text: string, size = 15): HTMLElement {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = `font-weight:600;font-size:${size}px;margin:10px 0 4px`;
  return d;
}
function strip(cells: Array<[HTMLCanvasElement, string]>): HTMLElement {
  const line = document.createElement('div');
  line.style.cssText = 'display:flex;gap:4px;flex-wrap:nowrap';
  for (const [cv, label] of cells) {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;font-size:11px;color:#bbb';
    const cap = document.createElement('div');
    cap.textContent = label;
    box.append(cv, cap);
    line.append(box);
  }
  return line;
}

const GRASS = '#7d9b5e';
const FACING_NAMES = ['front', '3/4 front R', 'right', '3/4 back R', 'back', '3/4 back L', 'left', '3/4 front L'];

/** The island scenes for the sheet and the lineup: each at a zoom and an hour, cropped round the bodies. */
async function islandRow(bodies: Body[], zoom: number, h: number, w: number, hh: number, lift = 0.35, marked = false): Promise<HTMLCanvasElement> {
  stock(bodies);
  // Hostile things marked in red, as the island marks them unless a player turns it off (Settings, `markThreats`).
  game.settings.markThreats = marked;
  const xs = bodies.map((b) => b.x), ys = bodies.map((b) => b.y);
  const mid: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  await islandFrame(zoom, h, mid);
  const [sx, sy] = screenOf(mid[0], mid[1]);
  return crop(sx, sy - hh * lift, w, hh);
}

page.sheet = async (look) => {
  setLook(look);
  root.replaceChildren();
  root.append(heading(NAMES[look] ?? look, 20));
  const k = closeScale(190);
  // Every turn, standing, close up, and the poses at two turns: the close-up crop (`#close`).
  const close = document.createElement('div');
  close.id = 'close';
  close.style.cssText = 'background:#20232a;padding:4px';
  root.append(close);
  close.append(heading('Turns, standing, close up'));
  close.append(strip(Array.from({ length: 8 }, (_, f) => [closeCell(150, 200, f, still, k, GRASS), `${f} ${FACING_NAMES[f]}`] as [HTMLCanvasElement, string])));
  close.append(heading('Poses, close up (turn 1 and turn 6)'));
  const poses: Array<[Partial<Anim>, string]> = [
    [{}, 'idle'], [{ t: 1.9 }, 'idle: glance'], [{ t: 4.75 }, 'idle: blade slap'], [{ go: 1, u: 0.25 }, 'walk'], [{ go: 1, u: 0.75 }, 'walk'],
    [{ go: 1, gait: 1, u: 0.3 }, 'run'], [{ act: { kind: 'strike', t: 0.22 } }, 'strike: wind-up'], [{ act: { kind: 'strike', t: 0.5 } }, 'strike: hit'],
    [{ act: { kind: 'strike', t: 0.8 } }, 'strike: follow'],
  ];
  for (const f of [1, 6]) close.append(strip(poses.map(([p, label]) => [closeCell(130, 180, f, { ...still, ...p }, k * 0.88, GRASS), label] as [HTMLCanvasElement, string])));
  // At the size the island is played at (zoom 1), every turn and the poses, by day and by night; and closer, at zoom 2.
  const v = lookVariant;
  const turns = Array.from({ length: 8 }, (_, f) => ({ species: 'goblin', facing: f, variant: v }));
  const acting: Array<Omit<Body, 'x' | 'y'>> = [
    { species: 'goblin', facing: 1, variant: v }, { species: 'goblin', facing: 7, moving: true, variant: v }, { species: 'goblin', facing: 2, strike: 0.5, variant: v },
    { species: 'goblin', facing: 6, strike: 0.25, variant: v }, { species: 'goblin', facing: 3, variant: v }, { species: 'goblin', facing: 0, strike: 0.5, variant: v },
  ];
  for (const [h, when] of [[13, 'day'], [23, 'night']] as Array<[number, string]>) {
    for (const marked of [false, true]) {
      root.append(heading(`Game zoom 1, ${when}${marked ? ', hostile marked in red (the default setting)' : ', unmarked'}: turns 0-7, then idle / walk / strike`));
      const a = await islandRow(row(turns, 16, 30, 0.85), 1, h, 640, 130, 0.35, marked);
      const b = await islandRow(row(acting, 16, 30, 0.9), 1, h, 500, 130, 0.35, marked);
      root.append(strip([[a, ''], [b, '']]));
    }
  }
  root.append(heading('Zoom 2, day'));
  root.append(strip([[await islandRow(row(acting.slice(0, 4), 16, 30, 1.0), 2, 13, 780, 250), '']]));
};

page.lineup = async () => {
  root.replaceChildren();
  root.append(heading('Lineup at game zoom 1: the Scrapper, Raider and Hexer Goblin, then revamped wildermon (Brickling / Bastiondrake, Whispet / Hallowmire, Moonhare, Stitchkit)', 15));
  const others: Array<Omit<Body, 'x' | 'y'>> = [
    { species: 'cobbe', facing: 1 }, { species: 'cobbe', facing: 1, stage: 2 }, { species: 'whispet', facing: 1 }, { species: 'whispet', facing: 1, stage: 2 },
    { species: 'orse', facing: 1, stage: 2 }, { species: 'tinka', facing: 1 },
  ];
  for (const [h, when, marked] of [[13, 'day', false], [23, 'night', false], [13, 'day, hostile marked in red (default setting)', true]] as Array<[number, string, boolean]>) {
    const cells: Array<[HTMLCanvasElement, string]> = [];
    for (const look of ['A', 'B', 'C']) {
      const v = VARIANT[look];
      cells.push([await islandRow(row([{ species: 'goblin', facing: 1, variant: v }, { species: 'goblin', facing: 7, strike: 0.5, variant: v }], 16, 30, 1.05), 1, h, 180, 130, 0.35, marked), NAMES[look]]);
    }
    cells.push([await islandRow(row(others, 16, 30, 1.5), 1, h, 820, 130, 0.35, marked), 'Brickling, Bastiondrake, Whispet, Hallowmire, Moonhare, Stitchkit']);
    root.append(heading(when));
    root.append(strip(cells));
  }
  // Close, each filling its cell, for the style: every look beside revamped wildermon drawn the same way.
  root.append(heading('Close up, each filling its cell: the Scrapper, Raider and Hexer Goblin beside the Bastiondrake, Hallowmire, Stitchkit and Moonhare'));
  const cells: Array<[HTMLCanvasElement, string]> = [];
  for (const look of ['A', 'B', 'C']) {
    setLook(look);
    cells.push([closeCell(200, 230, 1, still, closeScale(215), GRASS), NAMES[look]]);
  }
  for (const [sp, stage, name] of [['cobbe', 2, 'Bastiondrake'], ['whispet', 2, 'Hallowmire'], ['tinka', 0, 'Stitchkit'], ['orse', 2, 'Moonhare']] as Array<[string, number, string]>) {
    const cv = document.createElement('canvas');
    cv.width = 200 * DPR;
    cv.height = 230 * DPR;
    cv.style.width = '200px';
    cv.style.height = '230px';
    const g = cv.getContext('2d')!;
    g.fillStyle = GRASS;
    g.fillRect(0, 0, cv.width, cv.height);
    drawWildermonPortrait(g, cv.width, cv.height, sp, SPECIES[sp].variants[0], 1, undefined, stage);
    cells.push([cv, name]);
  }
  root.append(strip(cells));
};

/** Each look big, for looking a turn and a moment over: look, turn, clock, and how far through a strike (below nought: none). */
page.big = async (list) => {
  root.replaceChildren();
  const cells: Array<[HTMLCanvasElement, string]> = [];
  for (const [look, f, t, st] of list) {
    setLook(look);
    const k = closeScale(440);
    cells.push([closeCell(340, 460, f, { ...still, t, ...(st >= 0 ? { act: { kind: 'strike' as const, t: st } } : {}) }, k * 0.95, GRASS), `${look} turn ${f} t ${t} strike ${st}`]);
  }
  for (let i = 0; i < cells.length; i += 5) root.append(strip(cells.slice(i, i + 5)));
};

/**
 * One motion of a look at every turn, a row a turn, at regular steps through it, for looking each frame over for a
 * limb or a blade through the body: `idle` every two seconds of its loop, `walk` and `run` every eighth of a stride,
 * `strike` every tenth of the blow.
 */
page.frames = async (look, motion) => {
  setLook(look);
  root.replaceChildren();
  root.append(heading(`${NAMES[look] ?? look}: ${motion}, every turn (rows 0-7), at regular steps`, 16));
  const k = closeScale(170);
  const steps: Array<[Partial<Anim>, string]> = motion === 'idle' ? Array.from({ length: 12 }, (_, q) => [{ t: q * 2 }, `t ${q * 2}`] as [Partial<Anim>, string])
    : motion === 'walk' || motion === 'run' ? Array.from({ length: 8 }, (_, q) => [{ go: 1, gait: motion === 'run' ? 1 : 0, u: q / 8 }, `u ${q}/8`] as [Partial<Anim>, string])
      : Array.from({ length: 11 }, (_, q) => [{ act: { kind: 'strike' as const, t: q / 10 } }, `t ${(q / 10).toFixed(1)}`] as [Partial<Anim>, string]);
  for (let f = 0; f < 8; f++) root.append(strip(steps.map(([pose, label]) => [closeCell(118, 160, f, { ...still, ...pose }, k * 0.86, GRASS), `${f}: ${label}`] as [HTMLCanvasElement, string])));
};

/** Revamped wildermon big, each filling its cell, for setting the goblin's looks against: species, stage, turn. */
page.refs = async (list) => {
  root.replaceChildren();
  for (const [sp] of list) await loadWildermon(sp);
  const cells: Array<[HTMLCanvasElement, string]> = list.map(([sp, stage, f]) => {
    const cv = document.createElement('canvas');
    cv.width = 260 * DPR;
    cv.height = 260 * DPR;
    cv.style.width = '260px';
    cv.style.height = '260px';
    const g = cv.getContext('2d')!;
    g.fillStyle = GRASS;
    g.fillRect(0, 0, cv.width, cv.height);
    drawWildermonPortrait(g, cv.width, cv.height, sp, SPECIES[sp].variants[0], f, undefined, stage);
    return [cv, `${sp}@${stage}`];
  });
  for (let i = 0; i < cells.length; i += 6) root.append(strip(cells.slice(i, i + 6)));
};

/** Milliseconds a goblin drawn afresh, whole and with each piece left out in turn: what each piece costs. */
function freshMs(kit: readonly Piece[], reps: number): number {
  const cv = document.createElement('canvas');
  cv.width = 1600;
  cv.height = 900;
  const g = cv.getContext('2d')!;
  const pal = paletteFor('goblin', GOBLIN, GOB_COLORS[lookVariant]);
  const zoom = 2 * (GOBLIN.size ?? 1);
  const times: number[] = [];
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    for (let i = 0; i < 16; i++) {
      g.save();
      g.translate(60 + (i % 12) * 120, 140 + Math.floor(i / 12) * 160);
      g.scale(zoom, zoom);
      drawKind(g, GOBLIN, kit, pal, i % 8, { ...still, t: r * 0.37 + i }, 1.2 / zoom, 1 / zoom);
      g.restore();
    }
    g.getImageData(0, 0, 1, 1);
    times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  return times[times.length >> 1] / 16;
}
page.fresh = (look, lod) => {
  setLook(look);
  return freshMs(kitOf('goblin', GOBLIN, lod), 25);
};
page.pieces = (look) => {
  setLook(look);
  const kit = kitOf('goblin', GOBLIN, 1);
  // Each the least of three goes, the whole measured between each piece's so a slow stretch does not land on one alone.
  const least = (k: readonly Piece[]): number => Math.min(freshMs(k, 20), freshMs(k, 20), freshMs(k, 20));
  const whole = least(kit);
  const out: Array<[string, number]> = [['whole', whole]];
  for (const pc of kit) out.push([pc.key, whole - least(kit.filter((q) => q !== pc))]);
  // And with no decals at all: what the painted runes, stitches, teeth and eyes come to.
  const bare = kit.map((pc) => ({ ...pc, mesh: mesh(pc.mesh.v, pc.mesh.f.filter((f) => !f.decal)), shut: undefined }));
  out.push(['decals', whole - least(bare)]);
  return out;
};

page.bench = async (look, n) => {
  setLook(look);
  // Drawn afresh: `n` goblins posed and drawn each frame, as a picture of each is made, at zoom 1 on a device pixel ratio of 2.
  const cv = document.createElement('canvas');
  cv.width = 1600;
  cv.height = 900;
  const g = cv.getContext('2d')!;
  const kit = kitOf('goblin', GOBLIN, 1);
  const pal = paletteFor('goblin', GOBLIN, GOB_COLORS[lookVariant]);
  const zoom = 2 * (GOBLIN.size ?? 1);
  const times: number[] = [];
  for (let r = 0; r < 40; r++) {
    const t0 = performance.now();
    g.clearRect(0, 0, 1600, 900);
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(60 + (i % 12) * 120, 140 + Math.floor(i / 12) * 160);
      g.scale(zoom, zoom);
      drawKind(g, GOBLIN, kit, pal, i % 8, { ...still, t: r * 0.37 + i, go: i % 3 === 0 ? 1 : 0, u: r / 12 }, 1.2 / zoom, 1 / zoom);
      g.restore();
    }
    g.getImageData(0, 0, 1, 1);
    times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  const fresh = times[times.length >> 1];
  // On the island: `n` goblins standing about and going, every frame, steady (pictures kept), median ms a frame.
  const bodies: Body[] = Array.from({ length: n }, (_, i) => ({ species: 'goblin', x: 10 + (i % 6) * 1.6, y: 14 + Math.floor(i / 6) * 1.6, facing: i % 8, moving: i % 4 === 0, variant: lookVariant }));
  const timeIsland = async (): Promise<number> => {
    stock(bodies);
    await islandFrame(1, 13, [14, 18], 120);
    const ms: number[] = [];
    for (let i = 0; i < 120; i++) {
      game.time += 1 / 60;
      for (const c of game.creatures.list.values()) if (c.moving) c.walkPhase += 0.15;
      const t0 = performance.now();
      renderer.render(1 / 60);
      ms.push(performance.now() - t0);
      await nextFrame();
    }
    ms.sort((x, y) => x - y);
    return ms[ms.length >> 1];
  };
  const island = await timeIsland();
  // And with every one of them going, so new stride pictures are drawn as they come round.
  for (const b of bodies) b.moving = true;
  forgetBeast('goblin', GOBLIN);
  const islandGo = await timeIsland();
  return { fresh, picture: fresh / n, island, islandGo };
};

try {
  gameCanvas = document.createElement('canvas');
  gameCanvas.id = 'game';
  document.body.appendChild(gameCanvas);
  document.body.appendChild(root);
  document.body.style.margin = '0';
  game = Game.create(4242, SIZE);
  game.islandClock = () => 1000 * DAY_SECONDS + (hour / 24) * DAY_SECONDS;
  game.creatures.fromIsland = true;
  game.bodyFromIsland = true;
  game.packFromIsland = true;
  game.journalReady = false;
  game.tallyFromIsland = true;
  game.ask = () => {};
  game.settings.fog = false;
  game.settings.grid = false;
  const w = game.world;
  for (let y = 0; y <= SIZE; y++) for (let x = 0; x <= SIZE; x++) w.setHeight(x, y, 20);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) w.setTile(x, y, TileType.Grass, 0);
  for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
  game.update(0.01);
  renderer = new Renderer(new FullscreenCanvas(gameCanvas), game);
  for (const sp of ['goblin', 'cobbe', 'whispet', 'orse', 'tinka']) await loadWildermon(sp);
  void wildermonKind;
  page.ready = true;
} catch (e) {
  page.error = String((e as Error).stack ?? e);
  page.ready = true;
}
