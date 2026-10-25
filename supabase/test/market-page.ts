/**
 * The page `marketfind.ts` opens: the whole interface over a game run as the
 * island runs it, with the Market window's island answering from the rows
 * below -- four stalls and a shop counter across the island, two buy orders
 * and a month of sales -- the way `rpc_market`, `rpc_orders`, `rpc_prices` and
 * `rpc_sales` answer. Bundled for the browser by `marketfind.ts`, which drives
 * it through `window.market`.
 *
 * Every door the window knocks at is caught and kept in `asked`, with what it
 * was asked; a Buy at the counter is answered as `rpc_buy` answers one out of
 * reach or within it.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { followScreen } from '../../src/ui/screen';
import type { Good, Island, Order, Stall } from '../../src/net/island';
import type { Prices } from '../../src/game/prices';
import { COUNTER_REACH } from '../../src/game/counters';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 40;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.putBody(cx + 0.5, cy + 0.5, 0);
game.sawGround({
  placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 1, list: [], walls: [], floors: [] }, deed: null, deeds: [],
} as unknown as IslandGround, undefined, 'me');
game.inventory.add('coin', { count: 60, ql: 50, extra: 'Silver' });
game.inventory.add('iron_ore', { count: 8, ql: 40 });
game.inventory.add('log', { count: 2, ql: 20 });

let gid = 900;
const good = (def: string, ql: number, count: number, price: number | null): Good =>
  ({ id: gid++, def, ql, dmg: 0, count, extra: null, rare: null, price, creature: null });
/** The island's stalls, as `rpc_market` sends them to somebody at the board. */
const STALLS: Stall[] = [
  { id: 11, x: cx + 2, y: cy + 1, owner: 'You', mine: true, deed: null, till: 12, what: 'stall',
    goods: [good('plank', 35, 4, 10), good('rope', 22, 1, null)] },
  { id: 12, x: cx + 12, y: cy - 4, owner: 'Ama', mine: false, deed: 'Fernhollow', till: null, what: 'stall',
    goods: [good('iron_ore', 34, 5, 15), good('plank', 40, 1, 4), good('pickaxe', 52, 1, 30)] },
  { id: 13, x: cx - 30, y: cy + 20, owner: 'Bryn', mine: false, deed: 'Stonehaven', till: null, what: 'counter',
    goods: [good('iron_ore', 22, 10, 20), good('iron_lump', 45, 2, 18)] },
  { id: 14, x: cx + 90, y: cy + 60, owner: 'Cato', mine: false, deed: null, till: null, what: 'stall',
    goods: [good('iron_ore', 61, 3, 18), good('rope', 30, 1, 3)] },
  { id: 15, x: cx - 6, y: cy - 70, owner: 'Dagny', mine: false, deed: 'Eastreach', till: null, what: 'stall',
    goods: [good('clay', 20, 20, 10), good('log', 30, 4, 8)] },
];
const ORDERS: Order[] = [
  { n: 1, def: 'iron_ore', ql: 30, want: 20, got: 4, price: 4, who: 'Eir', mine: false, x: cx + 5, y: cy + 5, deed: 'Fernhollow', left: 3 * 86400 },
  { n: 2, def: 'plank', ql: 0, want: 6, got: 0, price: 3, who: 'You', mine: true, x: cx, y: cy, deed: null, left: 6 * 86400 },
];
/** A month of sales, as `rpc_prices` sends it: by kind, a row a day. */
const PRICES: Prices = {
  iron_ore: [
    { ago: 0, n: 6, silver: 21, lo: 3, hi: 4, ql: 31 }, { ago: 2, n: 10, silver: 25, lo: 2, hi: 3, ql: 24 },
    { ago: 5, n: 4, silver: 16, lo: 4, hi: 4, ql: 44 }, { ago: 9, n: 12, silver: 36, lo: 3, hi: 3, ql: 30 },
    { ago: 17, n: 3, silver: 15, lo: 5, hi: 5, ql: 58 }, { ago: 26, n: 8, silver: 20, lo: 2, hi: 3, ql: 20 },
  ],
  plank: [{ ago: 1, n: 5, silver: 20, lo: 4, hi: 4, ql: 33 }, { ago: 12, n: 2, silver: 10, lo: 5, hi: 5, ql: 41 }],
  pickaxe: [{ ago: 4, n: 1, silver: 28, lo: 28, hi: 28, ql: 50 }],
  rope: [{ ago: 3, n: 2, silver: 6, lo: 3, hi: 3, ql: 25 }],
} as unknown as Prices;
/** The month's single sales of a kind, newest first, as `rpc_sales` sends them. */
const SALES: Record<string, Array<{ ago: number; n: number; silver: number; ql: number | null }>> = {
  iron_ore: [
    { ago: 3600, n: 2, silver: 8, ql: 36 }, { ago: 5400, n: 4, silver: 13, ql: 28 }, { ago: 2 * 86400, n: 10, silver: 25, ql: 24 },
    { ago: 5 * 86400, n: 4, silver: 16, ql: 44 }, { ago: 26 * 86400, n: 8, silver: 20, ql: null },
  ],
};

/** Whether the board is read where you stand: at a settlement token or a mailbox. */
const state = { board: true, token: { x: cx + 8, y: cy - 3, deed: 'Fernhollow' } };
/** Every door knocked at: its name and what it was asked. */
const asked: Array<{ door: string; args: unknown[] }> = [];
const knock = (door: string, ...args: unknown[]): void => void asked.push({ door, args });
const fake = {
  uid: 'me',
  away: null,
  info: { id: 'w' },
  async market(): Promise<unknown> {
    knock('rpc_market');
    return state.board
      ? { board: true, stalls: structuredClone(STALLS) }
      : { board: false, stalls: structuredClone(STALLS.filter((s) => s.mine)), token: { ...state.token } };
  },
  async orders(): Promise<unknown> {
    knock('rpc_orders');
    return { board: state.board, orders: structuredClone(state.board ? ORDERS : ORDERS.filter((o) => o.mine)) };
  },
  async prices(): Promise<Prices> {
    knock('rpc_prices');
    return structuredClone(PRICES);
  },
  async sales(def: string): Promise<unknown> {
    knock('rpc_sales', def);
    return structuredClone(SALES[def] ?? []);
  },
  async deals(): Promise<unknown[]> { return []; },
  async waiting(): Promise<unknown> { return { at_box: false, things: [] }; },
  async buy(id: number): Promise<string | null> {
    knock('rpc_buy', id);
    const st = STALLS.find((s) => s.goods.some((g) => g.id === id));
    if (!st) return 'That is not for sale.';
    const far = Math.max(Math.abs(st.x + 0.5 - game.player.x), Math.abs(st.y + 0.5 - game.player.y));
    return far > COUNTER_REACH ? `Stand within ${COUNTER_REACH} tiles of the ${st.what}.` : null;
  },
  async order(def: string, count: number, price: number, ql: number): Promise<string | null> {
    knock('rpc_order', def, count, price, ql);
    return null;
  },
  async fillOrder(n: number, count: number): Promise<string | null> {
    knock('rpc_order_fill', n, count);
    return null;
  },
  async noticesAshore(): Promise<unknown[]> { return []; },
};
/** Any other door the interface knocks at answers nothing, as an island with nothing to say. */
const island = new Proxy(fake as Record<string | symbol, unknown>, {
  get: (t, k) => (k in t ? t[k] : typeof k === 'string' && k !== 'then' ? async () => null : undefined),
}) as unknown as Island;

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island });
renderer.camera.zoom = 1.5;
followScreen(uiRoot);

function frame(draw = true): void {
  game.update(1 / 60);
  if (draw) {
    renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), null);
    renderer.render(1 / 60);
  }
  ui.update(1 / 60);
}

const driven = (window as unknown as { driven?: { tick: (ms: number) => void } }).driven;
/** `ms` of the page's clock, a frame each sixtieth of a second. */
function run(ms: number): void {
  for (let t = 0; t < ms; t += 1000 / 60) {
    driven?.tick(1000 / 60);
    frame(false);
  }
}

/** Let the window's asks come back. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  frame();
};

/** A window open, every other shut; on a phone, filling the screen. */
async function open(id = 'market'): Promise<void> {
  for (const w of ui.windows.windows.values()) if (w.isOpen && w.opts.id !== id) w.close();
  const w = ui.windows.get(id)!;
  w.open();
  if (uiRoot.classList.contains('phone') && !w.isMaximized) w.toggleMaximized();
  await settle();
}

/** Show a tab of the Market window, by its label. */
async function tab(label: string): Promise<boolean> {
  const b = [...document.querySelectorAll<HTMLButtonElement>('.market-tabs button')].find((x) => x.textContent === label);
  b?.click();
  await settle();
  return !!b;
}

/** The Market window's page. */
const page = (): HTMLElement => document.querySelector('.market-page') as HTMLElement;

/** Type into the Find box, as a hand does. */
async function find(text: string): Promise<boolean> {
  const box = page().querySelector<HTMLInputElement>('.market-find');
  if (!box) return false;
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
  return true;
}

/** Choose how the found are sorted. */
async function sortBy(value: string): Promise<void> {
  const sel = page().querySelector<HTMLSelectElement>('.market-sort');
  if (!sel) return;
  sel.value = value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

/** The found, top to bottom: what, its price column, where, and its buttons. */
function hits(): Array<{ what: string; cost: string; where: string; vs: string; acts: string[] }> {
  return [...page().querySelectorAll<HTMLElement>('.market-hit')].map((r) => ({
    what: r.querySelector('.market-what')?.firstChild?.textContent ?? '',
    cost: r.querySelector('.market-cost')?.textContent ?? '',
    where: r.querySelector('.market-what small')?.textContent ?? '',
    vs: r.querySelector('.market-vs')?.textContent ?? '',
    acts: [...r.querySelectorAll<HTMLButtonElement>('.market-acts button')].map((b) => b.textContent ?? ''),
  }));
}

/** Press a button on the n-th found row, by its label. */
async function press(n: number, label: string): Promise<boolean> {
  const row = page().querySelectorAll<HTMLElement>('.market-hit')[n];
  const b = row ? [...row.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent === label) : undefined;
  b?.click();
  await settle();
  return !!b;
}

/** Press a button anywhere on the page, by its label. */
async function pressAny(label: string): Promise<boolean> {
  const b = [...page().querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent === label);
  b?.click();
  await settle();
  return !!b;
}

/** What the page says, line by line. */
const text = (): string => page().innerText;

/** Whether anything in the Market window runs off its side. */
function layout(): { overflow: number; outside: string[] } {
  const w = ui.windows.get('market')!.el.getBoundingClientRect();
  const p = page();
  const outside = [...p.querySelectorAll<HTMLElement>('button, input, select')]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.left < w.left - 1 || r.right > w.right + 1);
    }).map((e) => e.textContent || e.className);
  return { overflow: p.scrollWidth - p.clientWidth, outside };
}

/** Back at the start, at the board or away from it. */
async function reset(board = true): Promise<void> {
  game.player.stop();
  game.putBody(cx + 0.5, cy + 0.5, 0);
  state.board = board;
  asked.length = 0;
  frame();
}

(window as unknown as { market: unknown }).market = {
  game, ui, asked, state, cx, cy, open, tab, find, sortBy, hits, press, pressAny, text, layout, reset, run, frame, settle,
  marks: () => game.marks.map((m) => ({ name: m.name, x: m.x, y: m.y, colour: m.colour })),
  travelling: () => game.travelling,
  log: () => game.log.slice(-6).map((m) => m.text),
};
