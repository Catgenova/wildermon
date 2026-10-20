import type { Game } from '../../game/game';
import { itemDef } from '../../game/items';
import { CRAFT_REACH, RECIPE_BY_ID, stationName } from '../../game/recipes';
import { shoppingList, type ShoppingEntry } from '../../game/shopping';
import { Repaint } from '../repaint';
import type { UIWindow } from '../windows';

/** Where the list is kept: in this browser, like the pinned recipes, since it is about whoever sits here. */
const KEY = 'wurm-iso-shopping';

const lower = (id: string): string => itemDef(id).name.toLowerCase();

/**
 * The shopping list window: what you set out to make, and everything it
 * takes down to what is gathered, against what is at hand (`shopping.ts`).
 * Left open, it is the list carried while gathering, and it ticks itself off
 * as the pack and the stores within reach fill.
 */
export class ShoppingPanel {
  private entries: ShoppingEntry[] = [];
  private readonly body: HTMLDivElement;
  private readonly repaint = new Repaint(500);

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('settings-body', 'shop-body');
    this.body = document.createElement('div');
    this.body.className = 'shop';
    win.body.append(this.body);
    this.load();
    for (const ev of ['inventory', 'crate', 'world'] as const) game.events.on(ev as 'inventory', () => this.repaint.ask());
    win.onOpen = () => {
      this.repaint.force();
      this.render();
    };
    this.render();
  }

  /** Put a recipe on the list, or more of it if it is there. */
  add(recipe: string, count: number): void {
    if (!RECIPE_BY_ID.has(recipe) || count <= 0) return;
    const had = this.entries.find((e) => e.recipe === recipe);
    if (had) had.count += count;
    else this.entries.push({ recipe, count });
    this.save();
    this.repaint.force();
    this.render();
    if (!this.win.isOpen) this.win.open();
  }

  /** Redraw on a beat while open, and only when what it says has changed. */
  update(now: number): void {
    if (!this.win.isOpen || !this.repaint.due(now)) return;
    this.render(now);
  }

  private load(): void {
    try {
      const got = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      if (Array.isArray(got)) {
        this.entries = got.filter((e): e is ShoppingEntry => !!e && typeof e.recipe === 'string' && RECIPE_BY_ID.has(e.recipe)
          && typeof e.count === 'number' && e.count > 0).map((e) => ({ recipe: e.recipe, count: Math.floor(e.count) }));
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.entries));
    } catch {
      // Storage shut: the list lasts as long as the page.
    }
  }

  private render(now = performance.now()): void {
    const list = shoppingList(this.game, this.entries);
    const sign = JSON.stringify([this.entries, list.gather, list.cast.map((c) => [c.item, c.count]), list.make.map((m) => [m.item, m.count]), list.tools, list.stations]);
    if (!this.repaint.changed(now, sign)) return;
    this.body.replaceChildren();
    if (!this.entries.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Empty. Crafting (R): press List on a recipe to add its full bill, down to raw materials, against what you hold and nearby stores.';
      this.body.append(empty);
      return;
    }
    // What is being made, each with more, fewer and off.
    const head = this.section('To make');
    for (const e of this.entries) {
      const r = RECIPE_BY_ID.get(e.recipe);
      if (!r) continue;
      const row = document.createElement('div');
      row.className = 'shop-row shop-entry';
      const name = document.createElement('span');
      name.className = 'shop-name';
      name.textContent = `${itemDef(r.result).name} × ${e.count}`;
      const step = Math.max(1, this.game.madeAGo(r));
      const btn = (text: string, title: string, go: () => void): HTMLButtonElement => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tb-btn tb-small';
        b.textContent = text;
        b.title = title;
        b.addEventListener('click', go);
        return b;
      };
      const less = btn('−', `${step} fewer`, () => {
        e.count = Math.max(step, e.count - step);
        this.save();
        this.render();
      });
      const more = btn('+', `${step} more`, () => {
        e.count += step;
        this.save();
        this.render();
      });
      const off = btn('×', 'Remove from list', () => {
        this.entries = this.entries.filter((x) => x !== e);
        this.save();
        this.repaint.force();
        this.render();
      });
      off.classList.add('tb-danger');
      row.append(name, less, more, off);
      head.append(row);
    }

    const at = `in your pack${this.game.settings.fromStores ? ` and the stores within ${CRAFT_REACH} tiles` : ''}`;
    const gather = this.section('To fetch', `Raw: gathered, found or bought. Have: ${at}.`);
    if (!list.gather.length) gather.append(this.note('Nothing to fetch.'));
    for (const g of list.gather) gather.append(this.line(itemDef(g.item).name, g.have, g.need));
    if (list.cast.length) {
      const cast = this.section('To cast', 'Smelter pour, then anvil; lumps of any one metal.');
      for (const c of list.cast) cast.append(this.text(`${c.count} × ${lower(c.item)}: ${c.mould.name.toLowerCase()}, ${c.lumps} ${c.lumps === 1 ? 'lump' : 'lumps'}`));
    }
    if (list.make.length) {
      const make = this.section('Intermediates', 'Short; made from the above.');
      for (const m of list.make) make.append(this.text(`${m.count} × ${lower(m.item)}: ${m.recipe.label}`));
    }
    if (list.tools.length || list.stations.length) {
      const need = this.section('Tools and stations');
      if (list.tools.length) need.append(this.text(`In your pack: ${list.tools.map(lower).join(', ')}`));
      if (list.stations.length) need.append(this.text(`Worked at: ${list.stations.map((s) => stationName(s as never).toLowerCase()).join(', ')}`));
    }
  }

  private section(title: string, lead?: string): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'shop-section';
    const h = document.createElement('div');
    h.className = 'skill-group';
    h.textContent = title;
    box.append(h);
    if (lead) box.append(this.note(lead));
    this.body.append(box);
    return box;
  }

  private note(text: string): HTMLDivElement {
    const n = document.createElement('div');
    n.className = 'shop-note';
    n.textContent = text;
    return n;
  }

  private text(text: string): HTMLDivElement {
    const n = document.createElement('div');
    n.className = 'shop-row';
    n.textContent = text;
    return n;
  }

  /** A thing to fetch: its name, a bar, and have of need, ticked when there is enough. */
  private line(name: string, have: number, need: number): HTMLDivElement {
    const row = document.createElement('div');
    const done = have >= need;
    row.className = `shop-row shop-fetch${done ? ' shop-done' : ''}`;
    const n = document.createElement('span');
    n.className = 'shop-name';
    n.textContent = `${done ? '✔ ' : ''}${name}`;
    const bar = document.createElement('span');
    bar.className = 'shop-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round(Math.min(1, need ? have / need : 1) * 100)}%`;
    bar.append(fill);
    const count = document.createElement('span');
    count.className = 'shop-count';
    count.textContent = `${have} / ${need}`;
    count.title = done ? 'Enough' : `${need - have} more needed`;
    row.append(n, bar, count);
    return row;
  }
}
