/**
 * The page `levelmark.ts` opens: a flat yard with one corner raised and one
 * sunk, in a game run as the island runs it (`ask` takes every job), the
 * renderer that draws it and the interface over it. Driven through
 * `window.levelmark`: the island's word on the level is handed in as the
 * ground read hands it (`sawGround`), and `colour` says what is drawn at a
 * corner.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import type { IslandGround } from '../../src/contract/ground';

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
const R = 12;
const H = 40;
for (let y = cy - R; y <= cy + R + 1; y++) for (let x = cx - R; x <= cx + R + 1; x++) world.setHeight(x, y, H);
for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) world.setTile(x, y, TileType.Dirt);
/** Two corners off the yard's height, beside your own: one raised, one sunk. */
const RAISED: [number, number] = [cx + 2, cy];
const SUNK: [number, number] = [cx - 2, cy];
world.setHeight(RAISED[0], RAISED[1], H + 6);
world.setHeight(SUNK[0], SUNK[1], H - 6);
game.islandClock = () => 1000 * DAY_SECONDS + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.settings.fog = false;
game.settings.motion = 'less';
/** Every job asked of the island, by id and the corner it was asked at. */
const asked: Array<{ id: string; cx?: number; cy?: number }> = [];
game.ask = (def, target) => {
  asked.push({ id: def.id, ...(target.kind === 'tile' ? { cx: target.cx, cy: target.cy } : {}) });
};
game.putBody(cx + 0.5, cy + 0.5, 0);

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
renderer.camera.zoom = 2;
renderer.camera.rotation = 0;

/** A frame: the world round you, with no cursor over it. */
function frame(): void {
  renderer.hover = null;
  renderer.camera.focus(game.player.x, game.player.y, game.playerHeight(), null);
  renderer.time = 20;
  renderer.render(0);
}

export interface Chip {
  hidden: boolean;
  text: string;
  title: string;
}

const page = {
  raised: RAISED,
  sunk: SUNK,
  home: [cx, cy] as [number, number],
  /** The level's chip as it stands, without a hud tick. */
  chip(): Chip {
    const el = uiRoot.querySelector<HTMLElement>('.hud-level');
    return { hidden: !el || el.hidden === true, text: el?.querySelector('.hud-level-text')?.textContent ?? '', title: el?.title ?? '' };
  },
  /** The island's word on the level, as the ground read brings it. */
  saw(level: number | null): void {
    game.sawGround({ level } as IslandGround);
  },
  /** Set level here at a corner, as its menu entry asks it. */
  take(x: number, y: number): void {
    const def = ACTION_BY_ID.get('take_level');
    if (def) game.requestAction(def, { kind: 'tile', x, y, cx: x, cy: y } as Target);
  },
  height: (x: number, y: number): number => world.getHeight(x, y),
  asked: (): typeof asked => asked.slice(),
  /** The colour drawn at a corner: the mean of a strip across it, one frame drawn. */
  colour(x: number, y: number): [number, number, number] {
    frame();
    const ctx = canvas.ctx;
    const dpr = ctx.getTransform().a;
    const cam = renderer.camera;
    const sx = Math.round(cam.worldToScreenX(x, y) * dpr), sy = Math.round(cam.worldToScreenY(x, y, world.getHeight(x, y)) * dpr);
    const px = ctx.getImageData(sx - 3, sy - 1, 7, 3).data;
    const rgb: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += px[i + c] / 21;
    return rgb;
  },
};
export type LevelPage = typeof page;
(window as unknown as { levelmark: LevelPage }).levelmark = page;
