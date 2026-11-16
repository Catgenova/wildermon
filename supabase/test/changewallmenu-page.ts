/**
 * The page `changewallmenu.ts` opens: the game's own tile menu (`UI.pickMenu`) over a game whose ground, skills,
 * pack and lines are laid from a real island's answers, and whose asks are kept for the island to be asked
 * (`game.ask`). Driven through `window.cwm`: lay what the island says, open a tile's menu as a click opens it, choose
 * a row by its labels as a player does, and hand over the asks that made.
 */
import { Game, type IslandGround } from '../../src/game/game';
import { Renderer, type Pick } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import type { Side } from '../../src/game/building';
import type { MenuItem } from '../../src/ui/contextmenu';

const game = Game.create(654, 128);
const day0 = 1000 * DAY_SECONDS;
game.islandClock = () => day0 + (13 / 24) * DAY_SECONDS;
game.creatures.fromIsland = true;
game.springs.fromIsland = true;
game.bodyFromIsland = true;
game.packFromIsland = true;
game.journalReady = false;
game.tallyFromIsland = true;

/** What the menu asked the island for, in order, till handed over. */
const asks: Array<{ action: string; target: unknown; goes?: number }> = [];
game.ask = (def, target, goes) => {
  asks.push({ action: def.id, target, goes });
};

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
document.body.appendChild(uiRoot);
const canvas = new FullscreenCanvas(canvasEl);
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });

/** A row as the test reads it: its label, whether it is refused and why, and what folds out of it. */
export interface Row { label: string; disabled: boolean; hint?: string; note?: string; children?: Row[] }
const rowOf = (m: MenuItem): Row => ({
  label: m.label, disabled: !!m.disabled, hint: m.hint, note: m.note, ...(m.children ? { children: m.children.map(rowOf) } : {}),
});

/** A click on a tile, on the side of it named (or its middle), as the renderer's pick hands it to the menu. */
const pickAt = (x: number, y: number, side?: Side): Pick => ({
  x, y, cx: x, cy: y,
  wx: x + (side === 'w' ? 0.05 : side === 'e' ? 0.95 : 0.5),
  wy: y + (side === 'n' ? 0.05 : side === 's' ? 0.95 : 0.5),
});
const menuAt = (x: number, y: number, side?: Side): MenuItem[] =>
  (ui as unknown as { pickMenu: (p: Pick) => { entries: MenuItem[] } }).pickMenu(pickAt(x, y, side)).entries;

const cwm = {
  /** Where the body stands, on the ground. */
  stand(x: number, y: number): void {
    game.putBody(x, y, 0);
  },
  /** The island's ground read laid as the page lays it, and its skills, pack and lines. */
  lay(ground: unknown, skills: Record<string, number>, pack: Array<{ id: string; count: number; ql: number }>, lines: Array<{ text: string; kind: string }>): void {
    game.sawGround(ground as IslandGround, undefined, 'me');
    for (const [id, v] of Object.entries(skills)) game.skills.values.set(id, v);
    for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
    for (const it of pack) game.inventory.add(it.id, { count: it.count, ql: it.ql });
    for (const l of lines) game.logMsg(l.text, l.kind === 'error' ? 'error' : 'event');
  },
  /** A tile's menu, as a click on that side of it opens it. */
  menu(x: number, y: number, side?: Side): Row[] {
    return menuAt(x, y, side).map(rowOf);
  },
  /**
   * Choose a row through its folds, each named by the start of its label, as a player clicks down them: false, and
   * nothing chosen, where a fold or the row is not there or is refused (a refused row does nothing when clicked).
   */
  choose(x: number, y: number, side: Side | undefined, path: string[]): string {
    let rows = menuAt(x, y, side);
    for (let i = 0; i < path.length; i++) {
      const row = rows.find((r) => r.label.startsWith(path[i]));
      if (!row) return `no row "${path[i]}" among ${rows.map((r) => r.label).join(' / ')}`;
      if (row.disabled) return `"${row.label}" refused: ${row.hint ?? ''}`;
      if (i === path.length - 1) {
        if (!row.onSelect) return `"${row.label}" does nothing`;
        row.onSelect();
        return 'chosen';
      }
      rows = row.children ?? [];
    }
    return 'no path';
  },
  /** The asks made since last asked. */
  asks(): Array<{ action: string; target: unknown; goes?: number }> {
    return asks.splice(0);
  },
  /** The wall on a side of a tile as the page holds it. */
  wall(level: number, x: number, y: number, side: Side): unknown {
    return game.buildings.wall(level, x, y, side) ?? null;
  },
  /** The last lines of the log. */
  log(n: number): string[] {
    return game.log.slice(-n).map((l) => l.text);
  },
};
(window as unknown as { cwm: typeof cwm }).cwm = cwm;
