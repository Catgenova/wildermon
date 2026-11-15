/**
 * The page `craftpreview.ts` opens under the built game page's own head (as `ui-sheet-page.ts` is): the game's windows
 * as players get them, the Crafting window open, the sculpted bodies loaded, and stock in the pack for a choice of wood
 * and of metal. Driven through `window.craft`.
 */
import '../../src/page-guard';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { RECIPES } from '../../src/game/recipes';
import type { UiLight, UiStyle } from '../../src/game/settings';
import { setAnimations } from '../../src/engine/motion';
import { sculptedFigures, sculptedReady, sculptSoft, flatFigures } from '../../src/render/figure';
import { craftPreviewKnobs, previewOf, type PreviewKind } from '../../src/ui/craftpreview';
import type { CraftPanel } from '../../src/ui/panels/craft';
import { followScreen } from '../../src/ui/screen';

document.getElementById('boot')?.remove();
const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

// Bodies drawn by the processor (this harness's GL) move here: it is here to see them move.
craftPreviewKnobs.stillOnSoft = false;
setAnimations(true);
sculptedFigures(true);

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
game.settings.motion = 'full';
game.settings.uiLife = false;
// Two woods for a barrel, two metals for a sword, and what else they take.
for (const [id, extra, count] of [
  ['plank', 'Pine', 60], ['plank', 'Cedar', 60], ['nail', undefined, 200], ['ribbon', undefined, 20], ['shaft', undefined, 6], ['log', 'Pine', 10],
  ['sword_blade', 'iron', 1], ['sword_blade', 'gold', 1], ['leather', undefined, 20],
] as const) game.inventory.add(id, { ql: 30, count, ...(extra ? { extra } : {}) });

const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
canvasEl.style.visibility = 'hidden';
document.body.style.background = '#6f7f73';
const panel = (ui as unknown as { craftPanel: CraftPanel }).craftPanel;
// A phone's screen: fitted to it as the game page fits it (narrow, a phone), so the windows are a phone's.
if (window.innerWidth <= 720) followScreen(uiRoot);
const win = ui.windows.get('craft')!;

const frame = (): void => {
  game.update(1 / 60);
  renderer.camera.focus(game.spawn.x, game.spawn.y, game.playerHeight(), null);
  ui.update(60);
};
let ticking = true;
const tick = (): void => {
  if (ticking) frame();
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

/** The recipe that makes a thing, its first. */
const recipeOf = (item: string): string => RECIPES.find((r) => r.result === item)?.id ?? '';
const rowOf = (id: string): HTMLElement | null => {
  const rows = win.body.querySelectorAll<HTMLElement>(`.craft-row[data-recipe="${id}"]`);
  return rows[rows.length - 1] ?? null;
};

export interface PreviewState {
  shown: boolean;
  name: string;
  line: string;
  kind: PreviewKind | null;
  item: string;
  material: string;
  running: boolean;
  frames: number;
  /** The share of the picture that is not blank, and a hash of it. */
  share: number;
  sum: number;
  chosen: boolean;
}

function state(id = ''): PreviewState {
  const strip = win.body.querySelector<HTMLElement>('.craft-preview');
  const c = panel.preview.el;
  const g = c.getContext('2d');
  let on = 0, sum = 0, n = 1;
  if (g && c.width) {
    const d = g.getImageData(0, 0, c.width, c.height).data;
    n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 8) on++;
      sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3]) % 1000000007;
    }
  }
  const s = panel.preview.showing;
  return {
    shown: !!strip && !strip.hidden, name: strip?.querySelector('b')?.textContent ?? '', line: strip?.querySelector('small')?.textContent ?? '',
    kind: s?.kind ?? null, item: s?.what.item ?? '', material: s?.what.material ?? '', running: panel.preview.running, frames: panel.preview.frames,
    share: on / n, sum, chosen: !!id && !!rowOf(id)?.classList.contains('rc-on'),
  };
}

const api = {
  ready: (async () => {
    for (let i = 0; i < 300 && !sculptedReady(); i++) await rest(50);
  })(),
  stats: (): string => `sculpted ${sculptedReady()} flat ${flatFigures()} soft ${sculptSoft()} cost ${panel.preview.cost.toFixed(1)} ms frames ${panel.preview.frames}`,
  async look(style: UiStyle, light: UiLight): Promise<void> {
    game.settings.uiStyle = style;
    game.settings.uiLight = light;
    game.settings.uiFrames = 'themed';
    await rest(150);
  },
  /** The Crafting window open at its own place and size, or at a width given. */
  async open(width?: number, height?: number): Promise<{ x: number; y: number; w: number; h: number }> {
    for (const w of ui.windows.windows.values()) if (w.isOpen && w !== win) w.close();
    win.open();
    Object.assign(win.el.style, { left: '64px', top: '64px', minWidth: width ? `${width}px` : '', minHeight: '', maxWidth: width ? `${width}px` : '', ...(width ? { width: `${width}px` } : {}), ...(height ? { height: `${height}px` } : {}) });
    await rest(200);
    return api.box();
  },
  box(): { x: number; y: number; w: number; h: number } {
    const r = win.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  },
  recipeOf,
  /** Every recipe's thing, and the preview it has. */
  kinds: (): Record<string, PreviewKind | null> => Object.fromEntries(RECIPES.map((r) => [r.result, previewOf(r.result)])),
  /** A recipe's row brought into view and clicked on its name, as a player chooses one. */
  async choose(id: string): Promise<PreviewState> {
    panel.showRecipe(id);
    await rest(50);
    const row = rowOf(id);
    row?.querySelector<HTMLElement>('.craft-name')?.click();
    await rest(50);
    return state(id);
  },
  /** The pointer resting on a row, and then off the window. */
  async point(id: string, ms = 400): Promise<PreviewState> {
    const row = rowOf(id);
    row?.querySelector('.craft-name')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await rest(ms);
    return state(id);
  },
  async away(): Promise<PreviewState> {
    win.body.querySelector('.inv-list')?.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: document.body }));
    await rest(50);
    return state();
  },
  /** A row's choice of material set, as its select is. */
  async material(id: string, value: string): Promise<PreviewState> {
    const pick = rowOf(id)?.querySelector<HTMLSelectElement>('select.craft-of');
    if (pick) {
      pick.value = value;
      pick.dispatchEvent(new Event('change'));
    }
    await rest(80);
    return state(id);
  },
  choices: (id: string): string[] => [...(rowOf(id)?.querySelectorAll<HTMLOptionElement>('select.craft-of option') ?? [])].map((o) => o.value),
  state,
  /** Typed into the search: the rows in order, each its recipe, its thing, and the heading it is under. */
  async search(q: string): Promise<Array<{ recipe: string; result: string; section: string }>> {
    const box = win.body.querySelector<HTMLInputElement>('input[type="search"]')!;
    box.value = q;
    box.dispatchEvent(new Event('input'));
    await rest(60);
    const out: Array<{ recipe: string; result: string; section: string }> = [];
    let section = '';
    for (const el of win.body.querySelector('.inv-list')!.children) {
      if (el.classList.contains('rc-section')) section = el.textContent ?? '';
      const id = (el as HTMLElement).dataset.recipe;
      if (id) out.push({ recipe: id, result: RECIPES.find((r) => r.id === id)?.result ?? '', section });
    }
    return out;
  },
  /** The recipes that take a thing among what they are made of. */
  takes: (item: string): string[] => RECIPES.filter((r) => r.inputs.some((i) => i.item === item)).map((r) => r.id),
  async close(): Promise<PreviewState> {
    win.close();
    await rest(150);
    return state();
  },
  animations(on: boolean): void {
    game.settings.animations = on ? 'on' : 'off';
    setAnimations(on);
  },
  wait: rest,
  /** The page's own clock stopped, and the preview's, for frames drawn one at a time. */
  freeze(): void {
    ticking = false;
    panel.preview.stop();
  },
  thaw(): void {
    ticking = true;
  },
  frameAt(t: number): void {
    panel.preview.drawAt(t);
  },
  /** Everything but the window and its frame out of the picture. */
  only(): void {
    const id = 'craft';
    const keep = (el: Element): boolean => el === win.el || (el as HTMLElement).dataset?.frameFor === id;
    const walk = (parent: Element): void => {
      for (const child of parent.children) {
        const el = child as HTMLElement;
        if (keep(el)) el.style.visibility = '';
        else if (el.contains(win.el) || el.querySelector(`[data-frame-for="${id}"]`)) {
          el.style.visibility = '';
          walk(el);
        } else if (el.tagName !== 'SCRIPT' && el.tagName !== 'LINK' && !el.classList.contains('win')) el.style.visibility = 'hidden';
      }
    };
    walk(document.body);
  },
};
(window as unknown as { craft: typeof api }).craft = api;
