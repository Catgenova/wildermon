/**
 * The page `nameicons.ts` opens: the game as it is drawn, with a few people
 * standing round you, the event window's talk, and the Social window, every
 * one of them filled from what `load` hands in -- the island's own `player`
 * rows, `rpc_chat` lines and `rpc_social` answer, read off the database by
 * the test. Every name plate handed to the frame's names is kept (`labels`),
 * with its icons, for the test to read; the windows are read off the page.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { NameLabels, type NameLabel } from '../../src/render/namelabels';
import type { PeerState } from '../../src/net/protocol';
import type { PlayerRow } from '../../src/contract/rows';
import type { Island, Social } from '../../src/net/island';
import type { SocialPanel } from '../../src/ui/panels/social';
import type { UiLight, UiStyle } from '../../src/game/settings';
import { cleanLook, HAIRSTYLES } from '../../src/game/look';

/** Every name plate handed in since the last `world`, as the frame's names had it. */
const labels: Array<{ text: string; icons: string[] }> = [];
const add = NameLabels.prototype.add;
NameLabels.prototype.add = function (this: NameLabels, l: NameLabel): void {
  labels.push({ text: l.text, icons: [...(l.icons ?? [])] });
  add.call(this, l);
};

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 10;
const h0 = Math.max(4, world.getHeight(cx, cy));
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, h0);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Grass);
const day0 = 1000 * DAY_SECONDS;
let hour = 13;
game.islandClock = () => day0 + (hour / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.putBody(cx + 0.5, cy + 0.5, 0);
game.settings.motion = 'less';
game.settings.uiLife = false;
game.settings.fog = false;

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });

/** Where each person stands, from you, in the order the island's rows come. */
const SPOTS: Array<[number, number]> = [[1.4, -0.6], [-1.4, 0.8], [0.8, 1.6], [-0.6, -1.8], [2, 1.4], [-2, -0.6]];

let social: Social | null = null;
let peers: PeerState[] = [];
/** Whether the world has been drawn long enough for every body's picture to have come in. */
let warmed = false;
let me = '';
/* The Social window's island: its own answer, handed in; nothing else is asked of it here. */
const stub = {
  get uid() {
    return me;
  },
  social: () => Promise.resolve(social),
  letters: () => Promise.resolve([]),
} as unknown as Island;
const socialPanel = (ui as unknown as { social: SocialPanel }).social;
(socialPanel as unknown as { island: Island }).island = stub;

function frame(): void {
  game.update(1 / 60);
  renderer.camera.focus(cx + 0.5, cy + 0.5, game.playerHeight(), null);
  renderer.render(1 / 60);
  ui.update(60);
}
const rest = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

const hideAll = (): void => {
  for (const w of ui.windows.windows.values()) if (w.isOpen) w.close();
  for (const b of ui.windows.bars.values()) b.el.style.visibility = 'hidden';
  for (const el of uiRoot.querySelectorAll<HTMLElement>('.ctx-menu, .tooltip, .notices, .spell-bar, .path-strip, .deed-banner')) el.style.visibility = 'hidden';
};

/** What a box of icons shows: each icon's id and title. */
const iconsIn = (el: Element | null): Array<{ id: string; title: string }> =>
  [...(el?.querySelectorAll<HTMLElement>('.name-icon') ?? [])].map((i) => ({ id: i.dataset.emblem ?? '', title: i.title }));

const api = {
  /**
   * The island's answers in: everybody's rows (the roster's read), the talk from before you came (`rpc_chat`, each
   * line with its speaker), and the Social window's answer, with your own uid.
   */
  async load(rows: PlayerRow[], chat: Array<{ text: string; at?: number; by?: string }>, s: Social, mine: string): Promise<void> {
    me = mine;
    social = s;
    game.badges.saw(rows);
    peers = rows.filter((r) => r.uid !== mine).map((r, i) => ({
      id: 500 + i, uid: r.uid, name: r.name, x: cx + 0.5 + SPOTS[i % SPOTS.length][0], y: cy + 0.5 + SPOTS[i % SPOTS.length][1],
      dirX: 0, dirY: 1, level: 0, moving: false, swimming: false, working: false,
      // Their look as the island has it on their row, cleaned as the roster cleans it (`play.ts`).
      look: cleanLook(r.look ?? { gender: i % 2 ? 'man' : 'woman', hair: HAIRSTYLES[1 + (i % (HAIRSTYLES.length - 1))].id, hairColour: (i * 0.23) % 1, hairBright: 0.5, skin: (i * 0.31) % 1 }),
    } as unknown as PeerState));
    game.roster.sawAll(peers);
    for (const l of chat) game.write(l.text, 'chat', l.at, l.by);
    for (let i = 0; i < 3; i++) frame();
    await rest(50);
  },
  /** A line said live, as the island's subscription hands it in. */
  said(text: string, by: string): void {
    game.write(text, 'chat', undefined, by);
  },
  /** Rows read again: a trade or class changed. */
  saw(rows: PlayerRow[]): void {
    game.badges.saw(rows);
  },
  /** A look on the page: Runecut by day or night, or Classic. */
  async look(style: UiStyle, light: UiLight): Promise<void> {
    game.settings.uiStyle = style;
    game.settings.uiLight = light;
    game.settings.uiFrames = 'themed';
    for (let i = 0; i < 3; i++) frame();
    await rest(80);
  },
  /** One window by itself, at (x, y) and so big; its box. */
  async show(id: 'events' | 'social', x: number, y: number, w: number, h: number): Promise<{ x: number; y: number; w: number; h: number }> {
    hideAll();
    uiRoot.style.visibility = '';
    canvasEl.style.visibility = 'hidden';
    document.body.style.background = '#6f7f73';
    const win = ui.windows.get(id)!;
    win.open();
    if (id === 'social') socialPanel.openOn(me, 'friends');
    Object.assign(win.el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    for (let i = 0; i < 4; i++) {
      frame();
      await rest(40);
    }
    // The talk on its own tab, its newest lines in view.
    if (id === 'events') {
      win.body.querySelector<HTMLButtonElement>('.log-tab[data-tab="chat"]')?.click();
      const list = win.body.querySelector<HTMLElement>('.log-list');
      if (list) list.scrollTop = list.scrollHeight;
      await rest(40);
    }
    const r = win.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  },
  /** The world with nothing over it, at this zoom, by day or night; the plates handed in for that frame. */
  async world(zoom: number, night: boolean): Promise<Array<{ text: string; icons: string[] }>> {
    hideAll();
    // Nothing of the interface over the world: what it leaves behind its windows as well.
    uiRoot.style.visibility = 'hidden';
    canvasEl.style.visibility = 'visible';
    hour = night ? 23 : 13;
    renderer.camera.zoom = zoom;
    // Long enough for the bodies' pictures to come in, which are made off the frame; told again where everybody is.
    for (let i = 0; i < (warmed ? 20 : 80); i++) {
      if (i % 5 === 0) game.roster.sawAll(peers);
      frame();
      await rest(60);
    }
    warmed = true;
    labels.length = 0;
    frame();
    return labels.slice();
  },
  /** Name icons on or off, by its own box in Settings, as a player would. */
  setIcons(on: boolean): boolean {
    const row = [...uiRoot.querySelectorAll<HTMLLabelElement>('.setting-row')].find((r) => r.querySelector('b')?.textContent === 'Name icons');
    const box = row?.querySelector<HTMLInputElement>('input[type=checkbox]');
    if (!box) return false;
    if (box.checked !== on) box.click();
    frame();
    return game.settings.nameIcons === on;
  },
  /** What the windows show: each line of talk and each Social row, with the icons before it. */
  read(): { chat: Array<{ text: string; by: string; icons: Array<{ id: string; title: string }> }>; social: Array<{ text: string; by: string; icons: Array<{ id: string; title: string }> }> } {
    const chat = [...ui.windows.get('events')!.body.querySelectorAll<HTMLElement>('.log-chat')].map((l) => ({
      text: l.textContent ?? '', by: l.querySelector<HTMLElement>('.name-icons')?.dataset.by ?? '', icons: iconsIn(l.querySelector('.name-icons')),
    }));
    const soc = [...ui.windows.get('social')!.body.querySelectorAll<HTMLElement>('.social-name')].map((n) => ({
      text: n.textContent ?? '', by: n.querySelector<HTMLElement>('.name-icons')?.dataset.by ?? '', icons: iconsIn(n.querySelector('.name-icons')),
    }));
    return { chat, social: soc };
  },
};
(window as unknown as { nameIcons: typeof api }).nameIcons = api;

/** The page's pieces, for a page built on this one (`newplayer-page.ts`). */
export const page = { game, ui, renderer, uiRoot, canvasEl, frame, hideAll, rest, at: { x: cx, y: cy } };
