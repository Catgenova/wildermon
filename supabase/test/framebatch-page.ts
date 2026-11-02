/**
 * The page `framebatch.ts` opens: the game as the island runs it, and the interface, with the pack of thirty stacks
 * open. Driven through `window.framebatch`: each step changes the pack or the skill book as the island's words do,
 * says so as they do, a word at a time, and draws frames as the loop does (`UI.update`); and reads back what the
 * Inventory window, the Skills window and the belt show, and what they show when drawn afresh, then and there.
 */
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';
import { FullscreenCanvas } from '../../src/engine/canvas';
import { DAY_SECONDS } from '../../src/game/pace';
import { UI } from '../../src/ui/ui';
import { Keybinds } from '../../src/game/keybinds';
import { SKILL_BY_ID } from '../../src/game/skills';

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
const KINDS = ['rock_shards', 'log', 'dirt', 'clay', 'sand', 'plank', 'nails', 'iron_lump', 'grain', 'mallet'];
for (let i = 0; i < 30; i++) game.inventory.add(KINDS[i % KINDS.length], { ql: 10 + i * 2, count: 1 + (i % 6) });

const canvasEl = document.createElement('canvas');
canvasEl.id = 'game';
document.body.appendChild(canvasEl);
const uiRoot = document.createElement('div');
uiRoot.id = 'ui';
document.body.appendChild(uiRoot);
const renderer = new Renderer(new FullscreenCanvas(canvasEl), game);
const ui = new UI(game, renderer, uiRoot, canvasEl, { turn: () => {}, keys: new Keybinds(), island: null });
const win = (id: string) => ui.windows.windows.get(id)!;
win('inventory').open();
win('skills').close();

/** A frame, as the loop draws it, the world left undrawn. */
function frame(): void {
  game.update(1 / 60);
  ui.update(60);
}

const list = win('inventory').body.querySelector<HTMLElement>('.inv-list')!;
/** How many times the Inventory list has been drawn. */
let drawn = 0;
const replace = list.replaceChildren.bind(list);
list.replaceChildren = (...nodes: (Node | string)[]): void => {
  drawn++;
  replace(...nodes);
};

/** What the three show, as markup. */
function shown(): { pack: string; skills: string; belt: string } {
  return {
    pack: win('inventory').body.innerHTML,
    skills: win('skills').body.innerHTML,
    belt: uiRoot.querySelector('.belt-bar')?.outerHTML ?? '',
  };
}

/** What they show drawn afresh now, at once, as each did on every word before: the pack's search, the book opening, the belt. */
function afresh(): { pack: string; skills: string; belt: string } {
  const search = win('inventory').body.querySelector<HTMLInputElement>('.panel-search')!;
  search.dispatchEvent(new Event('input'));
  win('skills').onOpen?.();
  ui.hud.drawBelt();
  return shown();
}

let n = 0;
/** The pack as the island says it: changed stack by stack, a word for each (`Island.packRow`). */
function packWords(words: number): void {
  for (let i = 0; i < words; i++) {
    n++;
    const items = game.inventory.items.map((it) => ({ ...it }));
    if (n % 5 === 0) items.splice(n % items.length, 1);
    else if (n % 7 === 0) items.push({ uid: 5000 + n, id: KINDS[n % KINDS.length], ql: 50, dmg: 0, count: 3 });
    else items[n % items.length].count += 1;
    game.inventory.items = items;
    game.events.emit('inventory');
  }
}

const SKILLS = ['digging', 'mining', 'woodcutting', 'carpentry'];
/** The book as the island says it each beat: a word for each skill that rose, and one more (`island.hooks.mine`). */
function rise(ids: string[]): void {
  for (const id of ids) {
    game.skills.values.set(id, game.skills.get(id) + 1.25);
    game.events.emit('skill', id, 1.25);
  }
  game.events.emit('skill', '', 0);
}

/** A skill's number as its row shows it, and as the book has it. */
function skillSays(id: string): { row: string; book: string; flash: boolean } {
  const rows = [...win('skills').body.querySelectorAll<HTMLElement>('.skill-row')];
  const row = rows.find((r) => r.firstElementChild?.textContent === SKILL_BY_ID.get(id)?.name);
  return { row: row?.querySelector('.skill-value')?.textContent ?? '?', book: game.skills.standing(id).toFixed(2), flash: !!row?.classList.contains('flash') };
}

export interface Driven {
  frame: () => void;
  packWords: (words: number) => void;
  rise: (ids: string[]) => void;
  pin: (loop: number) => void;
  open: (id: string) => void;
  close: (id: string) => void;
  drawn: () => number;
  shown: typeof shown;
  afresh: typeof afresh;
  skillSays: typeof skillSays;
  skills: string[];
}
(window as unknown as { framebatch: Driven }).framebatch = {
  frame, packWords, rise,
  pin: (loop) => game.pinToBelt(loop, { action: 'dig' }),
  open: (id) => win(id).open(),
  close: (id) => win(id).close(),
  drawn: () => drawn,
  shown, afresh, skillSays, skills: SKILLS,
};
