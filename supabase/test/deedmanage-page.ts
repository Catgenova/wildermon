/**
 * The page `deedmanage.ts` opens: a settlement of yours, founded, with a
 * handful of workers in every state of upkeep, companions that would make up
 * a specialty or a guard, and the Settlement window over it -- the whole
 * interface drawn as the game draws it. The island's half is what
 * `deedmanage.ts` hands in through `load`: the island's own `rpc_social` and
 * `rpc_deed_watch` answers, read off the database. Every door the window
 * knocks at (`DeedRoll`) is caught here and kept in `calls`, for the test to
 * put to the island and hand the answer back; every job is caught at
 * `game.ask` (`rpc_act`) and kept in `asks`.
 */
import { Game, type IslandGround } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import { GATHER_SKILL, maxHealth, SPECIES, UPKEEP_FOR } from '../../src/game/creatures';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import type { Target } from '../../src/game/actions';
import { followScreen } from '../../src/ui/screen';
import { DeedPanel } from '../../src/ui/panels/deed';
import type { Social } from '../../src/net/island';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 14;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;

/** Every job asked of the island, in order. */
const asks: Array<{ action: string; target: Target }> = [];
game.ask = (def, target) => {
  asks.push({ action: def.id, target });
};
game.hooks.confirm = async () => true;
game.putBody(cx + 0.5, cy + 0.5, 0);

/** The settlement as the island names it, set by `load`. */
let deedName = 'Fernhollow';
function ground(): void {
  game.sawGround({
    placed: [], crates: [], lying: [], crops: [], now: Date.now() / 1000,
    buildings: { nextId: 1, list: [], walls: [], floors: [] },
    deed: { name: deedName, x: cx, y: cy, radius: 12, level: 5, mine: true, role: 'founder' }, deeds: [],
  } as unknown as IslandGround, undefined, 'me');
}
ground();

/** Yours: where each stands, its trade by its kind, and what the island says of its upkeep. */
type Beast = Partial<IslandCreature> & { id: number; species: string; name: string; dx: number; dy: number; level?: number };
const HERD: Beast[] = [
  // Three woodcutters: a specialty. One a tenth of its upkeep short of unfed, one unfed.
  { id: 201, species: 'bevere', name: 'Bramble', mode: 'deed', dx: 5, dy: -3, hunger: 0.8, unfed: UPKEEP_FOR * 0.9 },
  { id: 202, species: 'bevere', name: 'Alder', mode: 'deed', dx: 6, dy: -3, hunger: 0.15, unfed: UPKEEP_FOR * 1.5 },
  { id: 203, species: 'bevere', name: 'Rowan', mode: 'deed', dx: 7, dy: -3, hunger: 0.9, unfed: UPKEEP_FOR * 0.1 },
  // A clay digger alone at its trade, and another following you that would make two.
  { id: 204, species: 'noot', name: 'Clod', mode: 'deed', dx: -4, dy: 6, hunger: 0.7, unfed: UPKEEP_FOR * 0.5 },
  { id: 205, species: 'noot', name: 'Loam', mode: 'active', dx: 1, dy: 0, hunger: 0.9 },
];

function seed(): void {
  const rows: IslandCreature[] = HERD.map((b) => ({
    variant: 0, stance: 'defensive', health: 1, mine: true, traits: [], age: 'grown', care: 0.5, sex: 'female', ...b,
    x: cx + 0.5 + b.dx, y: cy + 0.5 + b.dy,
  } as IslandCreature));
  game.creatures.sawAll(rows, game.time);
  for (const b of HERD) {
    const c = game.creatures.get(b.id)!;
    const def = SPECIES[c.species];
    const id = (def.gathers && GATHER_SKILL[def.gathers]) || def.learns?.skill || 'body_strength';
    c.skills = { [id]: b.level ?? 10 };
    c.health = maxHealth(c, def);
    c.post = null;
    // The island's count of the settlement's workers at its trade (`specialty`).
    if (c.mode === 'deed') c.specialty = HERD.filter((o) => o.mode === 'deed' && SPECIES[o.species].gathers === def.gathers).length;
  }
}
seed();

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 1.5;
followScreen(uiRoot);

/** The island's answers, as `load` hands them in, and every door knocked at, in order. */
let social: Social | null = null;
let watch: unknown = null;
const calls: unknown[][] = [];
const knock = (...args: unknown[]): Promise<string | null> => {
  calls.push(args);
  return Promise.resolve(null);
};
const roll = {
  known: () => social,
  prime: () => {},
  again: () => Promise.resolve(),
  me: () => (social?.deeds[0]?.founder ?? 'me'),
  rank: (founder: string, uid: string, rank: string) => knock('rank', founder, uid, rank),
  add: (name: string) => knock('add', name),
  rename: (id: number, name: string) => knock('rename', id, name),
  move: (id: number, dir: number) => knock('move', id, dir),
  drop: (id: number) => knock('drop', id),
  allow: (id: number, power: string, on: boolean) => knock('allow', id, power, on),
  newcomers: (id: number) => knock('newcomers', id),
  board: () => Promise.resolve('No board here.'),
  post: () => knock('post'),
  unpost: () => knock('unpost'),
  setWork: () => knock('setWork'),
  dropWork: () => knock('dropWork'),
  deliver: () => knock('deliver'),
  storeLog: () => Promise.resolve({ log: [] }),
  watch: () => Promise.resolve(watch ?? 'Loading…'),
  orders: (founder: string, stance: string) => knock('orders', founder, stance),
  care: () => calls.push(['care']),
};
/* The Settlement window, as `ui.ts` makes it, with this page's doors in place of the island's. */
const win = ui.windows.create({ id: 'deedtest', title: 'Settlement', x: 12, y: 56, width: 360, height: 560, anchor: 'tr', open: false });
const panel = new (DeedPanel as unknown as new (...a: unknown[]) => DeedPanel)(win, game, () => {}, () => {}, roll);

/** A frame, as the loop draws it. */
function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(cx, cy, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(1 / 60);
  panel.update(performance.now() + 1e7);
}

/** The island's answers in, the settlement named as the island names it, and the window drawn from them. */
function load(s: Social, w: unknown): void {
  // At this page's totem: the island's own settlement stands somewhere else on its own island.
  social = { ...s, deeds: s.deeds.map((e, i) => (i === 0 ? { ...e, x: cx, y: cy } : e)) };
  watch = w;
  const d = s.deeds[0];
  if (d && d.name !== deedName) {
    deedName = d.name;
    ground();
  }
  panel.render();
}

/** The window open; on a phone, filling the screen. */
let maxed = false;
function open(): void {
  for (const w of ui.windows.windows.values()) if (w.isOpen && w !== win) w.close();
  win.open();
  if (uiRoot.classList.contains('phone') && !maxed) {
    win.toggleMaximized();
    maxed = true;
  }
  frame();
}

/** Press a tab by its label; false when there is no such tab. */
function tab(label: string): boolean {
  const b = [...win.body.querySelectorAll<HTMLButtonElement>('.deed-tabs .log-tab')].find((x) => x.textContent === label);
  b?.click();
  frame();
  return !!b;
}

const driven = (window as unknown as { driven?: { tick: (ms: number) => void } }).driven;
/** `ms` of the page's clock. */
function run(ms: number): void {
  for (let t = 0; t < ms; t += 250) {
    driven?.tick(250);
    frame();
  }
}

/** What the window shows, for the test to read. */
function read(): Record<string, unknown> {
  const body = win.body;
  const text = (sel: string): string[] => [...body.querySelectorAll<HTMLElement>(sel)].map((e) => (e.textContent ?? '').trim());
  const w = win.el.getBoundingClientRect();
  const outside = [...body.querySelectorAll<HTMLElement>('.deed-row, .deed-head, button, .deed-matrix-wrap')]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.left < w.left - 1 || r.right > w.right + 1);
    }).map((e) => e.className + ':' + (e.textContent ?? '').slice(0, 30));
  return {
    tabs: text('.deed-tabs .log-tab'),
    on: text('.deed-tabs .tb-on'),
    heads: text('.deed-head'),
    rows: text('.deed-row'),
    notes: text('.deed-note'),
    boxes: [...body.querySelectorAll<HTMLInputElement>('.deed-matrix-box')].map((b) => `${b.dataset.rank}:${b.dataset.power}:${b.checked ? 1 : 0}:${b.disabled ? 'off' : 'on'}`),
    ranks: text('.deed-matrix-rank'),
    trades: text('.deed-trade'),
    powers: text('.deed-matrix-power'),
    orders: [...body.querySelectorAll<HTMLButtonElement>('.deed-orders button')].map((b) => `${b.dataset.stance}:${b.classList.contains('tb-on') ? 1 : 0}:${b.disabled ? 'off' : 'on'}`),
    assign: [...body.querySelectorAll<HTMLElement>('.deed-candidate')].map((e) => `${e.querySelector('.deed-who')?.textContent}:${(e.querySelector('button') as HTMLButtonElement)?.disabled ? 'off' : 'on'}`),
    visits: [...body.querySelectorAll<HTMLElement>('.deed-visit')].map((e) => [...e.children].map((c) => c.textContent).join('|')),
    overflow: body.scrollWidth - body.clientWidth,
    outside,
  };
}

/** Click the first element matching a selector, or the one whose text starts with `starts`; false when there is none. */
function click(sel: string, starts?: string): boolean {
  const el = [...win.body.querySelectorAll<HTMLElement>(sel)].find((e) => starts === undefined || (e.textContent ?? '').trim().startsWith(starts));
  if (!el) return false;
  el.click();
  frame();
  return true;
}

/** Tick or untick one box of the permissions grid. */
function box(rank: number, power: string): boolean {
  const b = win.body.querySelector<HTMLInputElement>(`.deed-matrix-box[data-rank="${rank}"][data-power="${power}"]`);
  if (!b || b.disabled) return false;
  b.click();
  frame();
  return true;
}

/** Scroll the window's list to an element, for a picture of it. */
function scrollTo(sel: string): void {
  win.body.querySelector(sel)?.scrollIntoView({ block: 'start' });
}

(window as unknown as { deedmanage: unknown }).deedmanage = { game, ui, win, panel, asks, calls, load, open, tab, run, read, click, box, frame, scrollTo };
