/**
 * The page `staleline.ts` serves as modules, each fetched as the built site's are: a stretch of grass in the real game
 * and renderer with wild wildermon on it, and the corner's Update button (`updateButton`). Bundled by `staleline.ts`
 * with every line's models in a module of its own, under an import map that pins each module's hash, as
 * scripts/sri.mjs does for the site.
 */
import { Game } from '../../src/game/game';
import type { IslandCreature } from '../../src/game/creatures';
import { Renderer } from '../../src/render/renderer';
import { wildermonKind } from '../../src/render/wildermon';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { TileType } from '../../src/world/tiles';
import { DAY_SECONDS } from '../../src/game/pace';
import { updateButton } from '../../src/ui/update';

const game = Game.create(4242, 128);
const world = game.world;
const cx = game.spawn.x, cy = game.spawn.y;
for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 13; x++) {
  world.setHeight(x, y, 8);
  world.setTile(x, y, TileType.Grass);
}
const day0 = 1000 * DAY_SECONDS, opened = performance.now();
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS + (performance.now() - opened) / 1000;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;
game.ask = () => {};
game.settings.fog = false;
game.putBody(cx + 0.5, cy + 2.5, 0);

const canvasEl = document.createElement('canvas');
document.body.appendChild(canvasEl);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
// In the corner, as the HUD puts it (`.hud-corner`), over the grass.
const button = updateButton();
const corner = document.createElement('div');
corner.className = 'hud-corner';
corner.append(button);
document.body.appendChild(corner);

let id = 1000;
const mobs: IslandCreature[] = [];
/** A wild one of a kind, `dx` tiles across from the middle, hurt. */
function put(species: string, dx: number): void {
  mobs.push({
    id: id++, species, name: species, variant: 0, mode: 'wild', stance: 'passive', x: cx + 0.5 + dx, y: cy + 0.5, health: 0.75, max: 1,
    mine: false, sex: 'male', traits: [], skills: {},
  } as unknown as IslandCreature);
  game.creatures.sawAll(mobs, game.time);
}

/** `n` frames, a sixtieth of a second apart on the game's clock, each a turn of the page apart. */
async function frames(n: number): Promise<void> {
  renderer.camera.zoom = 2;
  for (let i = 0; i < n; i++) {
    game.update(1 / 60);
    renderer.camera.focus(cx + 0.5, cy + 0.5, game.playerHeight(), 1 / 60);
    renderer.render(1 / 60);
    await new Promise((r) => setTimeout(r, 16));
  }
}

(window as unknown as { staleLine: unknown }).staleLine = {
  put, frames,
  /** Whether a line's models are in. */
  drawn: (species: string): boolean => !!wildermonKind(species),
  button: (): { hidden: boolean; text: string } => ({ hidden: button.hidden, text: button.textContent ?? '' }),
  shot: (): string => canvasEl.toDataURL('image/png'),
};
