/**
 * The page `scripts/ui-sheet.mjs` opens under the built game page's own head
 * (its policy, Trusted Types and stylesheets), as the boot check opens
 * `panels-page.ts`: the game as you see it once you are in, with one window
 * shown at a time so each can be photographed alone and its interior measured.
 *
 * `window.sheet` is driven from the script: `look` puts a look on the page,
 * `show` opens one window (or the journal at one tab) by itself where the
 * camera expects it, and `probe` reads the computed styles inside it.
 */
import '../../src/page-guard';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import type { JournalTab } from '../../src/ui/panels/journal';
import type { UiLight, UiStyle } from '../../src/game/settings';
import { Inventory } from '../../src/game/items';
import type { CratePanel } from '../../src/ui/panels/crate';

/** Where each window is put, from the page's top left, so its frame's overhang is in the picture too. */
const AT = 72;

export interface Probe {
  key: string;
  frame: string;
  /** Every element inside the body that scrolls (overflow auto or scroll), with what its scrollbar is. */
  scrolls: Array<{ cls: string; width: string; color: string; gutter: string; webkit: string; pad: string }>;
  /** The median height of a row: the children of the biggest scroll area. */
  row: number;
  /** Headings inside the body: `size family`, distinct. */
  headings: string[];
  /** Buttons inside the body: `radius | clip-path`, distinct. */
  buttons: string[];
  /** The body's own padding. */
  pad: string;
  /** Font sizes used by anything with text in the body, distinct, in px. */
  sizes: number[];
}

const seen = { done: false, keys: [] as string[], still: false };
(window as unknown as { sheet: unknown }).sheet = seen;

document.getElementById('boot')?.remove();
const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const game = Game.create(4242, 128);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(game.spawn.x + 0.5, game.spawn.y + 0.5, 0);
game.settings.motion = 'less';
game.settings.uiLife = false;

const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
// The world is not in the pictures: what shows through a see-through window is the page's own plain ground.
canvasEl.style.visibility = 'hidden';
document.body.style.background = '#6f7f73';

const frame = (): void => {
  game.update(1 / 60);
  renderer.camera.focus(game.spawn.x, game.spawn.y, game.playerHeight(), null);
  ui.update(60);
};
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

frame();
// Something to show in the windows of things: a tile picked beside where you stand, a bag opened from the pack.
ui.selectTile({ x: game.spawn.x + 1, y: game.spawn.y, down: false, level: 0 } as never);
const bag = game.inventory.add('sack', { ql: 30 });
const made = new Inventory([], 900_000);
bag.inside = ([['plank', 4], ['nail', 20], ['feather', 12], ['wool', 3], ['bread', 2], ['rope', 2], ['apple', 5], ['twine', 6], ['leather', 2], ['arrow', 30]] as const).map(([id, count]) => made.add(id, { ql: 24, count }));
const crates = (ui as unknown as { cratePanel: CratePanel }).cratePanel;
// And a ledger with something in it.
for (const [id, n, best, rare] of [['plank', 40, 31.2, 0], ['bucket', 3, 22.5, 1], ['brush', 1, 18, 0], ['nail', 120, 44.8, 2]] as const) {
  game.ledger[id] = { n, best, rare, first: day0, bestAt: day0 };
}
// A settlement of yours to show the settlement window's overview, and a shopping list with something on it.
game.deed = { name: 'Thornhold', x: game.spawn.x, y: game.spawn.y, radius: 5, level: 2, mine: true, role: 'founder' };
(ui as unknown as { shopping: { add: (recipe: string, count: number) => void } }).shopping.add('make_bucket', 2);
const TABS: JournalTab[] =['goals', 'path', 'ledger', 'news', 'boards', 'guide', 'tracker', 'help'];
const ids = [...ui.windows.windows.keys()];
seen.keys = [...ids.filter((id) => id !== 'journal'), ...TABS.map((t) => `journal:${t}`)];
const sizes = new Map(ids.map((id) => [id, [ui.windows.get(id)!.el.style.width, ui.windows.get(id)!.el.style.height]]));
for (const id of ids) ui.windows.get(id)?.open();
frame();

const hideAll = (): void => {
  for (const w of ui.windows.windows.values()) if (w.isOpen) w.close();
  for (const b of ui.windows.bars.values()) b.el.style.visibility = 'hidden';
  for (const el of uiRoot.querySelectorAll<HTMLElement>('.ctx-menu, .tooltip, .notices, .spell-bar, .path-strip, .deed-banner')) el.style.visibility = 'hidden';
};

const api = {
  /** Put a look on the page: Runecut by day or night with themed frames, or Classic. */
  async look(style: UiStyle, light: UiLight): Promise<void> {
    game.settings.uiStyle = style;
    game.settings.uiLight = light;
    game.settings.uiFrames = 'themed';
    for (let i = 0; i < 3; i++) frame();
    await rest(100);
  },
  /** One window by itself at `AT`, its default size; its box on the page, frame overhang and all. */
  async show(key: string): Promise<{ x: number; y: number; w: number; h: number }> {
    hideAll();
    const [id, tab] = key.split(':');
    const win = ui.windows.get(id);
    if (!win) throw new Error(`no window ${id}`);
    if (id === 'crate' && bag) crates.openBag(bag.uid);
    else if (tab) ui.toggleJournal(tab as JournalTab);
    else win.open();
    if (!win.isOpen) win.open();
    // The size it was made at, whatever happened to it since, so every look photographs the same box.
    const [w, h] = sizes.get(id)!;
    Object.assign(win.el.style, { left: `${AT}px`, top: `${AT}px`, width: w, height: h });
    for (let i = 0; i < 4; i++) {
      frame();
      await rest(30);
    }
    if (tab === 'help') for (let i = 0; i < 60 && !uiRoot.querySelector('.help-sec'); i++) await rest(50);
    frame();
    await rest(150);
    // Everything on the page but this window and its own frame's layers out of the picture: bars, other frames, the corner.
    const keep = (el: Element): boolean => el === win.el || (el as HTMLElement).dataset?.frameFor === id;
    const only = (parent: Element): void => {
      for (const child of parent.children) {
        const el = child as HTMLElement;
        if (keep(el)) el.style.visibility = '';
        else if (el.contains(win.el) || el.querySelector(`[data-frame-for="${id}"]`)) {
          el.style.visibility = '';
          only(el);
        } else if (el.tagName !== 'SCRIPT' && el.tagName !== 'LINK' && !el.classList.contains('win')) el.style.visibility = 'hidden';
      }
    };
    only(document.body);
    // Still: what canvases draw moves with the clock (a doll breathing, portraits drawn a slice a frame), so for a pixel diff of the styles they are left blank.
    if (seen.still) for (const c of win.el.querySelectorAll<HTMLElement>('.win-body canvas')) c.style.visibility = 'hidden';
    const r = win.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  },
  /** What the window's interior is made of, as computed. */
  probe(key: string): Probe {
    const id = key.split(':')[0];
    const win = ui.windows.get(id)!;
    const body = win.body;
    const cls = (el: Element): string => (typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : el.tagName.toLowerCase());
    const visible = (el: Element): boolean => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === 'fixed';
    const all = [...body.querySelectorAll('*')].filter(visible);
    const scrolls: Probe['scrolls'] = [];
    let biggest: Element | null = null;
    for (const el of [body, ...all]) {
      const s = getComputedStyle(el);
      if (!/auto|scroll/.test(s.overflowY) && !/auto|scroll/.test(s.overflowX)) continue;
      const wk = getComputedStyle(el, '::-webkit-scrollbar');
      const th = getComputedStyle(el, '::-webkit-scrollbar-thumb');
      scrolls.push({
        cls: cls(el), width: s.scrollbarWidth, color: s.scrollbarColor, gutter: s.scrollbarGutter,
        webkit: `${wk.width} ${th.backgroundColor} ${th.borderRadius}`, pad: s.padding,
      });
      if (!biggest || el.clientHeight * el.clientWidth > biggest.clientHeight * biggest.clientWidth) biggest = el;
    }
    const heights = biggest ? [...biggest.children].filter(visible).map((c) => Math.round(c.getBoundingClientRect().height)).filter((h) => h > 0).sort((a, b) => a - b) : [];
    const headings = new Set<string>();
    const buttons = new Set<string>();
    const sizes = new Set<number>();
    for (const el of all) {
      const s = getComputedStyle(el);
      const c = typeof el.className === 'string' ? el.className : '';
      if (/^H[1-6]$/.test(el.tagName) || /(^|[-\s])(head|heading|title|sec|section)([-\s]|$)/.test(c)) headings.add(`${s.fontSize} ${s.fontFamily.split(',')[0]}`);
      if (el.tagName === 'BUTTON') buttons.add(`${s.borderRadius} | ${s.clipPath}`);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) sizes.add(parseFloat(s.fontSize));
    }
    return {
      key, frame: win.el.dataset.frame ?? '', scrolls, row: heights.length ? heights[heights.length >> 1] : 0,
      headings: [...headings].sort(), buttons: [...buttons].sort(), pad: getComputedStyle(body).padding, sizes: [...sizes].sort((a, b) => a - b),
    };
  },
};
Object.assign(seen, api, { done: true });
