import type { Game } from '../../game/game';
import { itemDef, ITEM_DEFS, rarityOf } from '../../game/items';
import { Repaint } from '../repaint';

/** How the ledger may be put in order. */
type SortKey = 'best' | 'made' | 'name' | 'rare' | 'recent';
const SORTS: Array<[SortKey, string]> = [
  ['best', 'Best quality'],
  ['made', 'Count'],
  ['rare', 'Rare'],
  ['name', 'Name'],
  ['recent', 'Newest first'],
];

/**
 * The ledger: everything you have ever made.
 *
 * Every kind of thing that has come off a bench, an anvil or an oven, how many
 * of them, the best one you ever managed and how many came off rare. The
 * journal says what there is to do; this says what you have done, which is the
 * number a maker actually keeps. It is the journal's second tab (`JournalPanel`),
 * drawn into `host`, and looks again only while `showing` says it can be seen.
 */
export class LedgerPanel {
  private list: HTMLDivElement;
  private footer: HTMLDivElement;
  private search: HTMLInputElement;
  private query = '';
  private sort: SortKey = 'best';
  private readonly repaint = new Repaint(600);

  constructor(
    host: HTMLElement,
    private readonly game: Game,
    private readonly showing: () => boolean,
  ) {
    host.classList.add('inv-body');
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search';
    this.search.placeholder = 'Search made items';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.repaint.force();
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      this.search.value = '';
      this.query = '';
      this.repaint.force();
      this.render();
    });
    const bar = document.createElement('div');
    bar.className = 'panel-bar';
    const sel = document.createElement('select');
    sel.className = 'panel-select';
    sel.title = 'Sort order';
    for (const [key, label] of SORTS) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      this.sort = sel.value as SortKey;
      this.repaint.force();
      this.render();
    });
    // Named, so the box says what it changes rather than only what it is set to.
    const order = document.createElement('label');
    order.className = 'ledger-order';
    order.append('Sort', sel);
    bar.append(order);
    const head = document.createElement('div');
    head.className = 'inv-head ledger-head';
    for (const [label, title] of [
      ['Thing', 'Item made'],
      ['Made', 'Count made'],
      ['Rare', 'Count rare or better'],
      ['Best', 'Best QL made'],
    ]) {
      const cell = document.createElement('span');
      cell.textContent = label;
      cell.title = title;
      head.append(cell);
    }
    this.list = document.createElement('div');
    this.list.className = 'inv-list';
    this.footer = document.createElement('div');
    this.footer.className = 'inv-footer';
    host.append(this.search, bar, head, this.list, this.footer);
    game.events.on('inventory', () => this.repaint.ask());
    game.events.on('skill', () => this.repaint.ask());
    this.render();
  }

  /** Look again on a beat; a ledger only moves when something is finished. */
  update(now: number): void {
    if (!this.showing() || !this.repaint.due(now)) return;
    this.render(now);
  }

  /** Draw it now, whatever the beat: the tab has just been turned to. */
  refresh(): void {
    this.repaint.force();
    this.render();
  }

  render(now = performance.now()): void {
    const led = this.game.ledger;
    const ids = Object.keys(led).filter((id) => {
      if (!this.query) return true;
      const def = ITEM_DEFS[id];
      return `${def?.name ?? id} ${def?.category ?? ''}`.toLowerCase().includes(this.query);
    });
    const by: Record<SortKey, (a: string, b: string) => number> = {
      best: (a, b) => led[b].best - led[a].best,
      made: (a, b) => led[b].n - led[a].n,
      rare: (a, b) => led[b].rare - led[a].rare || led[b].n - led[a].n,
      name: (a, b) => (ITEM_DEFS[a]?.name ?? a).localeCompare(ITEM_DEFS[b]?.name ?? b),
      recent: (a, b) => led[b].first - led[a].first,
    };
    ids.sort(by[this.sort]);
    const totals = this.game.ledgerTotals();
    const sig = [this.sort, this.query, ids.map((id) => `${id}${led[id].n}${led[id].best.toFixed(1)}${led[id].rare}`).join('|')].join('~');
    if (!this.repaint.changed(now, sig)) return;
    this.list.replaceChildren();
    if (!Object.keys(led).length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Nothing made yet. Lists everything crafted.';
      this.list.append(empty);
      this.footer.textContent = '';
      return;
    }
    for (const id of ids) this.list.append(this.row(id));
    if (!ids.length) {
      const none = document.createElement('div');
      none.className = 'inv-empty';
      none.textContent = `No match: “${this.search.value.trim()}”. Esc clears.`;
      this.list.append(none);
    }
    this.footer.textContent = `${totals.kinds} kinds · ${totals.made} things · ${totals.rare} rare · best ever QL ${totals.best.toFixed(1)}`;
  }

  private row(id: string): HTMLDivElement {
    const rec = this.game.ledger[id];
    const row = document.createElement('div');
    row.className = 'inv-row ledger-row';
    const name = document.createElement('span');
    name.className = 'inv-name';
    name.textContent = ITEM_DEFS[id]?.name ?? id;
    const made = document.createElement('span');
    made.textContent = String(rec.n);
    const rare = document.createElement('span');
    rare.textContent = rec.rare ? String(rec.rare) : '—';
    if (rec.rare) rare.style.color = rarityOf({ rare: 1 }).css;
    const best = document.createElement('span');
    best.textContent = rec.best.toFixed(1);
    if (rec.best >= 90) best.classList.add('inv-keen');
    row.append(name, made, rare, best);
    const def = itemDef(id);
    row.title = `${def.name}: ${rec.n} made, best QL ${rec.best.toFixed(1)}${rec.rare ? `, ${rec.rare} of them rare or better` : ''}.${def.description ? ` ${def.description}` : ''}`;
    return row;
  }
}
