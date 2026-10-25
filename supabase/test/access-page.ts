/**
 * The page `access.ts` drives in Chromium: a wood of solid trees and bushes
 * round you, the renderer, and the windows, with Settings open. What it
 * answers is read off `window.access`; the clock is the driver's
 * (`window.driven`), moved only between frames.
 */
import '../../src/page-guard';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { BINDS, Keybinds } from '../../src/game/keybinds';
import { BUSH_DEFS, packTreeData, TileType, TREE_DEFS } from '../../src/world/tiles';
import { applyLook } from '../../src/ui/theme';
import { followScreen, setUiSize, uiSizeShown } from '../../src/ui/screen';
import { dprCapOf, drawsFast, drawsLow, frameCapOf, GRAPHICS, type Graphics } from '../../src/game/settings';
import type { Motion } from '../../src/engine/motion';

interface Driven {
  tick: (ms: number) => void;
}
const driven = (window as unknown as { driven: Driven }).driven;

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.append(canvasEl, uiRoot);

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 7;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
const oak = TREE_DEFS.findIndex((d) => d.name === 'Oak');
const rose = BUSH_DEFS.findIndex((d) => d.name === 'Rose bush');
// A wood: oaks on every other tile, a rose bush between, your own tile and the ones round it clear.
for (let y = cy - R; y <= cy + R; y++) {
  for (let x = cx - R; x <= cx + R; x++) {
    const near = Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
    if (near) world.setTile(x, y, TileType.Grass);
    else if ((x + y) % 2 === 0) {
      world.setTile(x, y, TileType.Tree, packTreeData(oak, 3));
    } else if ((x * 3 + y) % 5 === 0) {
      world.setTile(x, y, TileType.Bush, rose);
    } else world.setTile(x, y, TileType.Grass);
  }
}
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);
game.settings.fog = false;

const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const keys = new Keybinds();
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys, island: null });
applyLook(game.settings, game.isNight());
setUiSize(game.settings.uiSize);
followScreen(uiRoot);

const STEP = 1000 / 30;
const frame = (): void => {
  driven.tick(STEP);
  game.update(STEP / 1000);
  renderer.camera.focus(cx + 0.5, cy + 0.5, game.playerHeight(), null);
  renderer.render(STEP / 1000);
  ui.update(30);
};

export interface Drawn {
  /** Trees and bushes drawn on the last frame, and of them as solids. */
  all: number;
  solid: number;
  /** Frames of the run on which the solid trees moved in the wind. */
  swayed: number;
  /** `data-motion` on <html> at the end. */
  motion: string;
}

export interface Access {
  /** Draw `n` frames with these settings. */
  draw: (n: number, graphics: Graphics, motion: Motion, lowPower?: boolean) => Drawn;
  /** The transition time of a div given a 2 s transition, as the stylesheet leaves it. */
  transition: () => string;
  /** Press a Text size preset in Settings; the size asked for, the size shown, the interface's scale, and a window title's height. */
  preset: (size: number) => { asked: number; shown: number; scale: number; title: number };
  /** Every row of the Keys tab bound to F10 through its first slot, and put back with its ↺: the ones that would not. */
  rebindAll: () => { rows: number; listed: string[]; unbound: string[]; unrestored: string[]; restoreHidden: string[] };
  done: boolean;
}

const access: Access = {
  draw: (n, graphics, motion, lowPower = false) => {
    game.settings.graphics = graphics;
    game.settings.motion = motion;
    game.settings.lowPower = lowPower;
    applyLook(game.settings, game.isNight());
    let swayed = 0;
    for (let i = 0; i < n; i++) {
      frame();
      if (renderer.treesSway) swayed++;
    }
    return { all: renderer.drawnTrees.all, solid: renderer.drawnTrees.solid, swayed, motion: document.documentElement.dataset.motion ?? '' };
  },
  transition: () => {
    const d = document.createElement('div');
    d.style.transition = 'opacity 2s ease 1s';
    document.body.append(d);
    const t = getComputedStyle(d).transitionDuration;
    d.remove();
    return t;
  },
  preset: (size) => {
    if (!ui.windows.windows.get('settings')?.isOpen) ui.toggleWindow('settings');
    const btn = uiRoot.querySelector<HTMLButtonElement>(`.setting-preset-btns button[data-size="${size}"]`);
    btn?.click();
    const m = /matrix\(([^,]+)/.exec(getComputedStyle(uiRoot).transform);
    const title = uiRoot.querySelector('.win-title, .win-head')?.getBoundingClientRect().height ?? 0;
    return { asked: game.settings.uiSize, shown: uiSizeShown(), scale: m ? Number(m[1]) : 1, title };
  },
  rebindAll: () => {
    if (!ui.windows.windows.get('settings')?.isOpen) ui.toggleWindow('settings');
    const body = ui.windows.windows.get('settings')!.body;
    [...body.querySelectorAll<HTMLButtonElement>('.log-tab')].find((b) => b.textContent === 'Keys')?.click();
    // The keeper's row is there for everybody, hidden; a click reaches it all the same.
    const rows = [...body.querySelectorAll<HTMLElement>('.keys-row')];
    const byLabel = new Map(rows.map((r) => [r.querySelector('.keys-what b')?.textContent ?? '', r]));
    const listed: string[] = [], unbound: string[] = [], unrestored: string[] = [], restoreHidden: string[] = [];
    for (const b of BINDS) {
      const row = byLabel.get(b.label);
      if (!row) {
        listed.push(b.id);
        continue;
      }
      const slot = row.querySelector<HTMLButtonElement>('.keys-key');
      slot?.click();
      ui.grabKey('F10');
      if (keys.codes(b.id)[0] !== 'F10') unbound.push(b.id);
      const back = row.querySelector<HTMLButtonElement>('.keys-default');
      if (!back || back.hidden) restoreHidden.push(b.id);
      back?.click();
      const now = keys.codes(b.id);
      if (now.length !== b.keys.length || now.some((c, i) => c !== b.keys[i])) unrestored.push(b.id);
    }
    return { rows: rows.length, listed, unbound, unrestored, restoreHidden };
  },
  done: true,
};
(window as unknown as { access: Access }).access = access;

/** What the keys and the settings say on their own, with nothing drawn. */
export interface Rules {
  ids: string[];
  /** Codes two things answer to out of the box. */
  shared: string[];
  /** A table kept from before, with U under both the Market and the Stores: what each has after it is read. */
  market: string[];
  stores: string[];
  /** Frame limit, pixels per point and fast/low for each preset, desktop and phone with Low power. */
  presets: Array<{ graphics: string; lowPower: boolean; phone: boolean; cap: number; dpr: number; fast: boolean; low: boolean }>;
}
(window as unknown as { rules: () => Rules }).rules = () => {
  const seen = new Map<string, string>();
  const shared: string[] = [];
  for (const b of BINDS) for (const c of b.keys) {
    if (seen.has(c)) shared.push(`${c}: ${seen.get(c)} and ${b.id}`);
    seen.set(c, b.id);
  }
  // A store of its own for the table kept from before.
  const kept = new Map<string, string>();
  const store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
  const was = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
  const before: Record<string, string[]> = {};
  for (const b of BINDS) before[b.id] = b.id === 'win_market' ? ['KeyU'] : b.keys.slice();
  kept.set('wurm-iso-keys', JSON.stringify(before));
  const old = new Keybinds();
  if (was) Object.defineProperty(window, 'localStorage', was);
  const presets: Rules['presets'] = [];
  for (const graphics of GRAPHICS) for (const [phone, lowPower] of [[false, false], [true, true]] as const) {
    const s = { graphics, lowPower, frameCap: 0 };
    presets.push({ graphics, lowPower, phone, cap: frameCapOf(s, phone), dpr: dprCapOf(s, phone), fast: drawsFast(s, phone), low: drawsLow(s, phone) });
  }
  return { ids: BINDS.map((b) => b.id), shared, market: old.codes('win_market'), stores: old.codes('win_stores'), presets };
};
