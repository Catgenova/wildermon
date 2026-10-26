/**
 * The page `respawnpick.ts` opens: the world drawn as the game draws it, the
 * body on the spawn just after a death, and the death chooser on the
 * interface root (`mountRespawn`), fed the island's own offer through
 * `offer`. The island is a stand-in: each pick the chooser sends is kept in
 * `sent`, and answered with what `answer` last set (null: taken). Driven
 * through `window.respawnpick`.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { followScreen } from '../../src/ui/screen';
import { deathSaid } from '../../src/game/graves';
import type { Fallen } from '../../src/game/respawn';
import type { Island } from '../../src/net/island';
import { mountRespawn } from '../../src/ui/respawn';

const game = Game.create(4242, 256);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 16;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
game.islandClock = () => 1000 * DAY_SECONDS + (15 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);
game.logMsg(deathSaid('here'), 'error');

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

/** A frame, as the loop draws it. */
function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(1 / 60);
}
for (let i = 0; i < 4; i++) frame();

/** Every pick sent, in order, and what the next is answered with. */
const sent: string[] = [];
let next: string | null = null;
const island = {
  hooks: {} as Island['hooks'],
  info: { size: 4096 },
  respawn: (at: string): Promise<string | null> => {
    sent.push(at);
    const no = next;
    next = null;
    return Promise.resolve(no);
  },
};
mountRespawn(uiRoot, game, island as unknown as Island);

/** Keys that got past the chooser to the page behind it. */
let gameKeys = 0;
window.addEventListener('keydown', () => { gameKeys++; });

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

export interface Shown {
  open: boolean;
  title: string | null;
  why: string | null;
  heads: string[];
  /** Each card, as `at|name|place|distance`. */
  cards: string[];
  stay: string | null;
  focus: string | null;
  spawn: { x: number; y: number };
  /** Every pick sent to the stand-in island, in order. */
  sent: string[];
  /** Cards and buttons any part of which is off the side of the screen. */
  outside: string[];
}

function read(): Shown {
  const el = uiRoot.querySelector<HTMLElement>('.respawn');
  const text = (sel: string): string | null => el?.querySelector(sel)?.textContent ?? null;
  const w = window.innerWidth;
  return {
    open: !!el,
    title: text('.respawn-title'),
    why: text('.respawn-why'),
    heads: [...(el?.querySelectorAll('.boot-stones-head') ?? [])].map((h) => h.textContent ?? ''),
    cards: [...(el?.querySelectorAll<HTMLButtonElement>('.boot-stone') ?? [])].map((b) =>
      `${b.dataset.at}|${b.querySelector('b')?.textContent}|${b.querySelector('.boot-stone-words > span')?.textContent}|${b.querySelector('.boot-stone-far')?.textContent}`),
    stay: text('.respawn-stay'),
    focus: (document.activeElement as HTMLElement | null)?.dataset?.at ?? null,
    spawn: { x: cx + 0.5, y: cy + 0.5 },
    sent: sent.slice(),
    outside: [...(el?.querySelectorAll<HTMLElement>('.boot-stone, .respawn-stay') ?? [])].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < -1 || r.right > w + 1;
    }).map((e) => e.dataset.at ?? e.className),
  };
}

/** The island's offer on a beat, or none; then a frame. */
async function offer(f: Fallen | null, size: number): Promise<void> {
  island.info.size = size;
  island.hooks.fallen?.(f);
  frame();
  await settle();
}

/** Click a card, or `stay`; wait for the stand-in's answer. */
async function click(at: string): Promise<void> {
  uiRoot.querySelector<HTMLButtonElement>(`.respawn [data-at="${at}"]`)?.click();
  await settle();
  frame();
}

/** Answer the next pick with this refusal. */
function answer(why: string | null): void {
  next = why;
}

/** A key pressed where the keys are: where they are after it, and how many reached the page behind. */
function key(k: string, shift = false): { focus: string | null; game: number } {
  gameKeys = 0;
  const at = document.activeElement ?? document.body;
  at.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true, cancelable: true }));
  return { focus: (document.activeElement as HTMLElement | null)?.dataset?.at ?? null, game: gameKeys };
}

/** Wait (a few seconds at most) until every picture has its stone or token in it, and say what each holds. */
async function pictures(): Promise<{ painted: string[]; distinct: boolean }> {
  const readPics = (): Array<{ id: string; share: number; data: Uint8ClampedArray }> =>
    [...uiRoot.querySelectorAll<HTMLButtonElement>('.respawn .boot-stone')].map((b) => {
      const c = b.querySelector('canvas');
      const g = c && c.width && c.height ? c.getContext('2d') : null;
      if (!c || !g) return { id: b.dataset.at ?? '', share: 0, data: new Uint8ClampedArray() };
      const data = g.getImageData(0, 0, c.width, c.height).data;
      let off = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 30) off++;
      }
      return { id: b.dataset.at ?? '', share: off / (data.length / 4), data };
    });
  let now = readPics();
  for (let waited = 0; waited < 8000 && now.some((p) => p.share < 0.01); waited += 100) {
    await new Promise((r) => setTimeout(r, 100));
    now = readPics();
  }
  // A beat longer, for the runes' light on the last one in.
  await new Promise((r) => setTimeout(r, 200));
  const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
  return {
    painted: now.map((p) => `${p.id}|${p.share.toFixed(3)}`),
    distinct: now.every((p, i) => now.every((q, j) => j <= i || !same(p.data, q.data))),
  };
}

export interface Driven {
  offer: (f: Fallen | null, size: number) => Promise<void>;
  read: () => Shown;
  click: (at: string) => Promise<void>;
  answer: (why: string | null) => void;
  key: (k: string, shift?: boolean) => { focus: string | null; game: number };
  pictures: () => Promise<{ painted: string[]; distinct: boolean }>;
}
(window as unknown as { respawnpick: Driven }).respawnpick = { offer, read, click, answer, key, pictures };
