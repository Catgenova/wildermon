/**
 * The page `newplayer.ts` opens: `nameicons-page.ts` (the game as drawn, the
 * event window, Social, the names over heads, Settings' Name icons), and a
 * wild one at your side to tame, whose card and menu say what a first tame
 * would be (`src/game/firsttame.ts`).
 */
import { page } from './nameicons-page';
import { SPECIES } from '../../src/game/creatures';
import { creatureLines } from '../../src/ui/creatureinfo';
import type { MenuItem } from '../../src/ui/contextmenu';

const { game, ui, uiRoot, canvasEl, frame, hideAll, rest, at } = page;
type Inner = {
  creatureEntries: (id: number) => MenuItem[];
  menu: { show: (x: number, y: number, title: string, items: MenuItem[]) => void };
};
const inner = ui as unknown as Inner;

let wild = 0;

const api = {
  /**
   * A wild one of `species` beside you, its food in your pack and the taming it asks, your first tame still to come
   * or not; its right-click menu up at (x, y). Its Tame entry and its card, as drawn.
   */
  async tameMenu(species: string, first: boolean, x: number, y: number): Promise<{ label: string; note: string | null; card: string[]; box: { x: number; y: number; w: number; h: number } }> {
    hideAll();
    uiRoot.style.visibility = '';
    canvasEl.style.visibility = 'visible';
    if (!wild || !game.creatures.get(wild)) {
      const def = SPECIES[species];
      const c = game.creatures.spawn(species, at.x + 1.3, at.y + 0.5, 'wild', () => 0.5, game.time - 30 * 86400);
      c.hunger = 1;
      wild = c.id;
      game.skills.values.set('taming', def.tameLevel + 1);
      game.inventory.add(def.diet[0], { count: 5, ql: 30 });
    }
    game.player.firstTame = first;
    const c = game.creatures.get(wild)!;
    const entries = inner.creatureEntries(wild);
    inner.menu.show(x, y, `${c.name} (${game.creatures.describe(c)})`, entries);
    for (let i = 0; i < 3; i++) {
      frame();
      await rest(40);
    }
    const tame = entries.find((e) => e.label.startsWith('Tame'));
    const menu = uiRoot.querySelector<HTMLElement>('.ctx-menu');
    if (menu) menu.style.visibility = 'visible';
    const r = menu?.getBoundingClientRect();
    return {
      label: tame?.label ?? '', note: tame?.note ?? null, card: creatureLines(game, c),
      box: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 },
    };
  },
  /** The first New sprout in the event window: its title, and its middle, for the pointer. */
  sprout(): { title: string; x: number; y: number } | null {
    const el = ui.windows.get('events')!.body.querySelector<HTMLElement>('.name-icon[data-emblem="new"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { title: el.title, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  /**
   * The first New sprout in the event window, its title shown in the game's own tooltip under it: a browser does not
   * draw its own title tip into a screenshot.
   */
  hover(): { title: string; x: number; y: number } | null {
    const at = api.sprout();
    if (!at) return null;
    const tip = (ui as unknown as { tooltip: { el: HTMLElement; show: (x: number, y: number, lines: string[]) => void } }).tooltip;
    tip.show(at.x + 8, at.y + 12, [at.title]);
    // Put back where the windows' pictures hid it (`hideAll`).
    tip.el.style.visibility = 'visible';
    return at;
  },
};
(window as unknown as { newPlayer: typeof api }).newPlayer = api;
