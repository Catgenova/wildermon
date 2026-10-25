/**
 * The page `care.ts` opens: a settlement of yours with a herd of twelve
 * wildermon in every state the Wildermon window's Care tab sorts -- hungry,
 * hurt, unfed, due, tired with no bed of its size, idle, unbrushed, a pack in
 * your pack that fits one, a pair ready to put together, one crated, one at
 * work and well -- in a game run as the island runs it, and the whole
 * interface over it. Bundled for the browser by `care.ts`, which drives it
 * through `window.care`.
 *
 * Every job the window asks for is caught at `game.ask`, which is where the
 * island's `rpc_act` is called from (`play.ts`), and kept in `asks`.
 */
import { Game, type IslandGround, type IslandPlaced } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import { GATHER_SKILL, GRAZE_FILL, maxHealth, SPECIES, UPKEEP_FOR } from '../../src/game/creatures';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import type { Target } from '../../src/game/actions';
import { followScreen } from '../../src/ui/screen';
import { DUE_SOON } from '../../src/ui/panels/wildermon';

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

/** Every job asked of the island, in order: the action and its target. */
const asks: Array<{ action: string; target: Target }> = [];
/**
 * The island's half, as far as the window can see it: a job takes its time on the bar (`showAction`) and is done,
 * and a feeding fills it a meal's worth (`GRAZE_FILL`). Off until the test turns it on.
 */
const island = { on: false, ends: 0, fed: -1 };
game.ask = (def, target) => {
  asks.push({ action: def.id, target });
  if (!island.on) return;
  const secs = def.instant ? 0 : def.baseTime;
  if (target.kind === 'creature' && def.id === 'feed') island.fed = target.id;
  if (secs > 0) {
    game.showAction(def, target, secs, secs);
    island.ends = performance.now() + secs * 1000;
  } else island.ends = performance.now();
};
/** The questions asked before a job: a pairing's preview (`confirms`). */
const asked: string[] = [];
game.hooks.confirm = async (q: string) => {
  asked.push(q);
  return true;
};
game.putBody(cx + 0.5, cy + 0.5, 0);

/* The settlement, with one small bed on it (taken) and none of the other sizes. */
let pid = 5000;
const placed: IslandPlaced[] = [];
const put = (sub: string, x: number, y: number): number => {
  placed.push({
    id: pid, kind: 'furniture', sub, x, y, sx: 0, sy: 0, ql: 40, fuel: null, ash: null, lit: null, dmg: null, name: null, material: 'oak',
    litres: null, liquid: null, ferment: null, bait: null, bait_ql: null, caught: null, state: null, mine: true, facing: 's',
  });
  return pid++;
};
const SMALL_BED = put('den_small', cx - 6, cy - 6);
game.sawGround({
  placed, crates: [], lying: [], crops: [], now: Date.now() / 1000,
  buildings: { nextId: 1, list: [], walls: [], floors: [] },
  deed: { name: 'Fernhollow', x: cx, y: cy, radius: 12, level: 2, mine: true, role: 'mayor' }, deeds: [],
} as unknown as IslandGround, undefined, 'me');

/* The pack: food for some of them, a brush, and a small wildermon pack that fits a first-stage worker. */
game.inventory.add('blueberry', { count: 3, ql: 30 });
game.inventory.add('potato', { count: 5, ql: 25 });
game.inventory.add('brush', { ql: 40 });
game.inventory.add('wild_pack_small', { ql: 35 });
game.skills.values.set('animal_husbandry', 30);

/** One of yours: where it stands relative to you, and what the island says of it. */
type Beast = Partial<IslandCreature> & { id: number; species: string; name: string; dx: number; dy: number; share?: number; level?: number };
const HERD: Beast[] = [
  // A companion at your heel, hungry.
  { id: 101, species: 'rabba', name: 'Burrow', mode: 'active', dx: 1, dy: 0, hunger: 0.12, sex: 'male', level: 8 },
  // A companion hurt in a fight.
  { id: 102, species: 'vola', name: 'Pip', mode: 'active', dx: 0, dy: 1, hunger: 0.7, share: 0.35, sex: 'female', level: 14 },
  // A woodcutter out of stamina with no bed of its size: resting where it stands.
  { id: 103, species: 'bevere', name: 'Bramble', mode: 'deed', dx: 5, dy: -3, hunger: 0.8, worn: 30, idleWhy: 'rest', idleN: 180, sex: 'male', level: 31 },
  // A clay digger with nothing in range.
  { id: 104, species: 'noot', name: 'Clod', mode: 'deed', dx: -4, dy: 6, hunger: 0.9, idleWhy: 'range', idleN: 18, sex: 'female', level: 12 },
  // A reed cutter walking to the small bed.
  { id: 105, species: 'sedra', name: 'Tumble', mode: 'deed', dx: -5, dy: -5, hunger: 0.6, worn: 30, idleWhy: 'tired', idleBed: 'den_small', sex: 'male', level: 6 },
  // A peat cutter that has gone a day unfed, the stores empty of what it eats.
  { id: 106, species: 'bogga', name: 'Moss', mode: 'deed', dx: 7, dy: 4, hunger: 0.22, unfed: UPKEEP_FOR + 3600, sex: 'female', level: 19 },
  // In young, due soon.
  { id: 107, species: 'rabba', name: 'Hazel', mode: 'deed', dx: 3, dy: 5, hunger: 0.75, dueIn: Math.round(DUE_SOON / 2), sex: 'female', level: 22 },
  // A companion wanting a brush.
  { id: 108, species: 'woola', name: 'Fern', mode: 'active', dx: -1, dy: 1, hunger: 0.8, care: 0.1, sex: 'female', level: 10 },
  // A forager with no pack on, with one of its size in your pack.
  { id: 109, species: 'magga', name: 'Tansy', mode: 'deed', dx: 2, dy: -2, hunger: 0.7, care: 0.6, sex: 'female', level: 9 },
  // A pair of Snufflets, grown, fed and rested: ready to be put together.
  { id: 110, species: 'rabba', name: 'Sorrel', mode: 'active', dx: -1, dy: -1, hunger: 0.9, care: 0.7, sex: 'female', level: 18 },
  // Asleep in its crate.
  { id: 111, species: 'wicka', name: 'Ember', mode: 'stored', dx: 0, dy: 0, hunger: 0.6, sex: 'male', level: 3 },
  // Her mate, at your heel, grown, fed and rested, in a small harness.
  { id: 112, species: 'rabba', name: 'Rowan', mode: 'active', dx: -2, dy: 0, hunger: 0.9, care: 0.8, sex: 'male', level: 20,
    gear: { harness: { def: 'wild_harness_small', ql: 50, dmg: 4 } } },
];

function seed(): void {
  const rows: IslandCreature[] = HERD.map((b) => ({
    variant: 0, stance: 'passive', health: 1, mine: true, traits: [], age: 'grown', care: 0.5, ...b,
    x: cx + 0.5 + b.dx, y: cy + 0.5 + b.dy,
  } as IslandCreature));
  game.creatures.sawAll(rows, game.time);
  for (const b of HERD) {
    const c = game.creatures.get(b.id)!;
    const def = SPECIES[c.species];
    // Its level, as its task's skill (`creatureLevel`).
    const id = (def.gathers && GATHER_SKILL[def.gathers]) || def.learns?.skill || 'body_strength';
    c.skills = { [id]: b.level ?? 1 };
    c.health = maxHealth(c, def) * (b.share ?? 1);
    c.post = null;
    c.bredAt = -1e9;
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
// Sized to the screen as the game sizes it: narrow, and on a touch screen a phone (`screen.ts`).
followScreen(uiRoot);

/** A frame, as the loop draws it, and the island's job done when its time is up; drawn only when asked (`draw`). */
function frame(draw = true): void {
  if (island.on && island.ends && performance.now() >= island.ends) {
    island.ends = 0;
    game.showAction(null, null);
    const c = island.fed >= 0 ? game.creatures.get(island.fed) : undefined;
    if (c) {
      c.hunger = Math.min(1, c.hunger + GRAZE_FILL);
      c.unfed = 0;
    }
    island.fed = -1;
  }
  game.update(1 / 60);
  if (draw) {
    renderer.camera.focus(cx, cy, game.playerHeight(), null);
    renderer.render(1 / 60);
  }
  ui.update(1 / 60);
}

/** The Wildermon window, open; on a phone, filling the screen (its expand button). */
function open(): void {
  for (const w of ui.windows.windows.values()) if (w.isOpen && w.opts.id !== 'wildermon') w.close();
  const w = ui.windows.get('wildermon')!;
  w.open();
  if (uiRoot.classList.contains('phone')) w.toggleMaximized();
  frame();
}

/** Show a tab of the Wildermon window. */
function tab(which: 'care' | 'cards'): void {
  (ui as unknown as { wildermon: { show: (t: 'care' | 'cards') => void } }).wildermon.show(which);
  frame();
}

const driven = (window as unknown as { driven?: { tick: (ms: number) => void } }).driven;
/** `ms` of the page's clock, a frame each sixtieth of a second. */
function run(ms: number): void {
  for (let t = 0; t < ms; t += 1000 / 60) {
    driven?.tick(1000 / 60);
    frame(false);
  }
}

/** The Care tab's page. */
const page = (): HTMLElement => document.querySelector('.care-page') as HTMLElement;

/** The needs list as it reads, top to bottom: the need, whose, what it says and its fix's button. */
function rows(): Array<{ kind: string; id: number; says: string; fix: string }> {
  return [...page().querySelectorAll<HTMLElement>('.care-need')].map((r) => ({
    kind: r.dataset.kind ?? '', id: Number(r.dataset.id), says: r.querySelector('.care-says')?.textContent ?? '',
    fix: (r.querySelector('.care-fix') as HTMLButtonElement | null)?.hidden ? '' : r.querySelector('.care-fix')?.textContent ?? '',
  }));
}

/** Press a need's fix. */
function fix(kind: string, id: number): boolean {
  const b = page().querySelector<HTMLButtonElement>(`.care-need[data-kind="${kind}"][data-id="${id}"] .care-fix`);
  if (!b || b.hidden) return false;
  b.click();
  return true;
}

/** Press a bulk button by what it starts with, and say what it said. */
function bulk(name: string): string {
  const b = [...page().querySelectorAll<HTMLButtonElement>('.care-bulk button')].find((x) => (x.textContent ?? '').startsWith(name));
  const said = b ? `${b.textContent}${b.disabled ? ' (disabled)' : ''}` : '';
  b?.click();
  return said;
}

/** Tick one of the herd for Assign selected. */
function tick(id: number): void {
  page().querySelector<HTMLInputElement>(`.care-row[data-id="${id}"] .care-tick`)?.click();
}

/** Back where it started: the herd as it was, you at the totem, nothing in hand or asked. */
function reset(): void {
  game.showAction(null, null);
  game.player.stop();
  game.putBody(cx + 0.5, cy + 0.5, 0);
  seed();
  asks.length = 0;
  asked.length = 0;
  island.on = false;
  island.ends = 0;
  frame();
}

/** What the tab bar and the page say: which tab is on, and whether anything runs off the side of the window. */
function layout(): { tab: string; careShown: boolean; overflow: number; outside: string[] } {
  const w = ui.windows.get('wildermon')!.el.getBoundingClientRect();
  const on = document.querySelector('.pals-tabs .tb-on')?.textContent ?? '';
  const p = page();
  const outside = [...p.querySelectorAll<HTMLElement>('.care-fix:not([hidden]), .care-bulk button, .care-row')]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.left < w.left - 1 || r.right > w.right + 1);
    }).map((e) => e.textContent ?? e.className);
  return { tab: on, careShown: !p.hidden, overflow: p.scrollWidth - p.clientWidth, outside };
}

(window as unknown as { care: unknown }).care = {
  game, ui, asks, asked, island, open, frame, seed, tab, run, rows, fix, bulk, tick, reset, layout, SMALL_BED, cx, cy,
};
