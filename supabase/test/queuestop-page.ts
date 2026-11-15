/**
 * The page `queuestop.ts` opens under the built game page's own head (as `craftpreview-page.ts` is): the game's windows
 * as players get them, the Crafting window open with a job in hand and jobs queued behind it. The island's answer to
 * the × (`rpc_skip`) is stood in for by `game.skip`: a moment later the next job waiting is the island's job in hand.
 * Driven through `window.qs`.
 */
import '../../src/page-guard';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import type { UiLight, UiStyle } from '../../src/game/settings';
import { setAnimations } from '../../src/engine/motion';

document.getElementById('boot')?.remove();
const canvasEl = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
setAnimations(false);

const game = Game.create(4242, 128);
game.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(game.spawn.x + 0.5, game.spawn.y + 0.5, 0);
game.settings.uiLife = false;
// Ten in the head: the screenshot's 9/10.
game.skills.values.set('mind_logic', 90);
const lump = game.inventory.add('glass_lump', { ql: 30, count: 15 });

const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
canvasEl.style.visibility = 'hidden';
document.body.style.background = '#6f7f73';
const win = ui.windows.get('craft')!;

const tick = (): void => {
  game.update(1 / 60);
  renderer.camera.focus(game.spawn.x, game.spawn.y, game.playerHeight(), null);
  ui.update(60);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

const def = (id: string): ActionDef => {
  const d = ACTION_BY_ID.get(id);
  if (!d) throw new Error(`no ${id}`);
  return d;
};
const GLASS = def('make_glass_panel');
const CUT = def('cut_grass');
const glassAt: Target = { kind: 'item', uid: lump.uid } as Target;
const grassAt = (i: number): Target => ({ kind: 'tile', x: game.spawn.x + 1 + i, y: game.spawn.y, cx: game.spawn.x + 1 + i, cy: game.spawn.y }) as Target;

/** The island's answer to `rpc_skip`, a moment after it is asked: the next job waiting in hand, the rest kept. */
let skips = 0;
let stops = 0;
game.skip = () => {
  skips++;
  window.setTimeout(() => {
    const next = game.queue.shift();
    if (next) game.showAction(next.def, next.target, 5, 5, next.goes, next.goes);
    game.events.emit('action');
  }, 120);
};
game.stop = () => {
  stops++;
};

const rectOf = (el: Element | null): { x: number; y: number; w: number; h: number } => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 };
};
const queueEl = (): HTMLElement | null => win.body.querySelector<HTMLElement>('.craft-queue');

export interface QsState {
  shown: boolean;
  title: string;
  inHand: string | null;
  left: number | null;
  queued: string[];
  /** The job in hand's row: its name, and its ×'s title and label. */
  now: string;
  stop: string | null;
  stopLabel: string | null;
  /** How many × buttons the job in hand's row has, and the buttons of the first job waiting. */
  nowButtons: number;
  waitingButtons: string[];
  skips: number;
  stops: number;
  focusOnStop: boolean;
}

const api = {
  async look(style: UiStyle, light: UiLight = 'day'): Promise<void> {
    game.settings.uiStyle = style;
    game.settings.uiLight = light;
    game.settings.uiFrames = 'themed';
    await rest(150);
  },
  /** A glass panel in hand, 56 of 58 left, and `n` Cut grass behind it; the Crafting window open. */
  async setup(n: number): Promise<QsState> {
    game.queue.length = 0;
    game.showAction(GLASS, glassAt, 10.3, 9.6, 56, 58);
    for (let i = 0; i < n; i++) game.queue.push({ def: CUT, target: grassAt(i), goes: 1 });
    skips = 0;
    stops = 0;
    for (const w of ui.windows.windows.values()) if (w.isOpen && w !== win) w.close();
    win.open();
    // Tall enough for the list at its foot to be seen whole.
    Object.assign(win.el.style, { left: '64px', top: '40px', width: '440px', height: '820px', maxHeight: '' });
    game.events.emit('action');
    await rest(400);
    return api.state();
  },
  state(): QsState {
    const q = queueEl();
    const nowRow = q?.querySelector('.cq-now') ?? null;
    const stop = nowRow?.querySelector<HTMLButtonElement>('.cq-stop') ?? null;
    const first = q?.querySelector('.cq-row[data-at="0"]') ?? null;
    return {
      shown: !!q && !q.hidden,
      title: q?.querySelector('.cq-title')?.textContent ?? '',
      inHand: game.action?.def.id ?? null,
      left: game.action?.left ?? null,
      queued: game.queue.map((j) => j.def.id),
      now: nowRow?.querySelector('.cq-name')?.firstChild?.textContent ?? '',
      stop: stop?.title ?? null,
      stopLabel: stop?.getAttribute('aria-label') ?? null,
      nowButtons: nowRow?.querySelectorAll('button').length ?? 0,
      waitingButtons: [...(first?.querySelectorAll('button') ?? [])].map((b) => b.textContent ?? ''),
      skips,
      stops,
      focusOnStop: !!document.activeElement?.matches('.cq-now .cq-stop'),
    };
  },
  /** Where the job in hand's × is, and the first job waiting's ×, on the page. */
  boxes(): { stop: ReturnType<typeof rectOf>; drop: ReturnType<typeof rectOf>; panel: ReturnType<typeof rectOf> } {
    const q = queueEl();
    return {
      stop: rectOf(q?.querySelector('.cq-now .cq-stop') ?? null),
      drop: rectOf(q?.querySelector('.cq-row[data-at="0"] .cq-drop') ?? null),
      panel: rectOf(q),
    };
  },
  /** The bar's Stop, as it was before the ×: the job and the queue both. */
  stopAll(): QsState {
    game.cancelAction();
    return api.state();
  },
  wait: rest,
};

(window as unknown as { qs: typeof api }).qs = api;
