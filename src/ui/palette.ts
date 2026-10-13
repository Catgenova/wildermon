import { keepControlKeys } from './controlkeys';

/**
 * Find anything: a box to type in that finds a window, a recipe, a setting, a
 * page of the help, a window layout or a key by its name, and opens it.
 *
 * Opened with its own key (`palette`, `/` out of the box) or Ctrl+K. Every
 * word typed has to be in what a row is called, or in the line under it; rows
 * whose name starts with what was typed come first, then rows whose name has
 * all of it, then the rest; with nothing typed, windows come first and recipes
 * last (`KIND_ORDER`). Up and down choose, Enter opens, Esc shuts it.
 */

export interface PaletteEntry {
  /** What it is called, which is what is searched first. */
  label: string;
  /** What sort of thing it is: Window, Recipe, Setting, Help, Layout, Do. */
  kind: string;
  /** A line under the name, searched too. */
  hint?: string;
  /** The key that does the same, if there is one. */
  key?: string;
  run: () => void;
}

/** The most rows shown at once: enough to scroll a short word's worth, few enough to draw on every key. */
const SHOWN = 60;

/** With nothing typed, the order the sorts come in: what is opened most first, recipes and help last. */
const KIND_ORDER = ['Window', 'Do', 'Layout', 'Setting', 'Help', 'Recipe'];
const kindRank = (kind: string): number => {
  const i = KIND_ORDER.indexOf(kind);
  return i < 0 ? KIND_ORDER.length : i;
};

export class Palette {
  private readonly el: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLDivElement;
  private readonly count: HTMLDivElement;
  private entries: PaletteEntry[] = [];
  private shown: PaletteEntry[] = [];
  private at = 0;

  constructor(root: HTMLElement, private readonly source: () => PaletteEntry[]) {
    this.el = document.createElement('div');
    this.el.className = 'palette';
    this.el.hidden = true;
    const box = document.createElement('div');
    box.className = 'palette-box';
    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.className = 'palette-input';
    this.input.id = 'palette-input';
    this.input.placeholder = 'Find a window, recipe, setting or help page…';
    this.input.setAttribute('aria-label', 'Find a window, recipe, setting, help page, layout or key');
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.list = document.createElement('div');
    this.list.className = 'palette-list';
    this.count = document.createElement('div');
    this.count.className = 'palette-count';
    box.append(this.input, this.list, this.count);
    this.el.append(box);
    root.append(this.el);

    this.input.addEventListener('input', () => {
      this.at = 0;
      this.render();
    });
    this.input.addEventListener('keydown', (e) => {
      // Nothing typed here is the game's.
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.move(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.choose(this.shown[this.at]);
      }
    });
    keepControlKeys(this.list);
    // A click anywhere outside the box puts it away.
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.entries = this.source();
    this.input.value = '';
    this.at = 0;
    this.el.hidden = false;
    this.render();
    this.input.focus();
  }

  close(): void {
    this.el.hidden = true;
    this.input.blur();
  }

  /** Ask the source again, keeping what has been typed: for a list that arrives late (the help's pages). */
  refresh(): void {
    if (!this.isOpen) return;
    this.entries = this.source();
    this.render();
  }

  private choose(e: PaletteEntry | undefined): void {
    if (!e) return;
    this.close();
    e.run();
  }

  private move(by: number): void {
    if (!this.shown.length) return;
    this.at = (this.at + by + this.shown.length) % this.shown.length;
    this.mark();
  }

  private mark(): void {
    [...this.list.children].forEach((c, i) => c.classList.toggle('palette-at', i === this.at));
    (this.list.children[this.at] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }

  /** How well a row answers what was typed, lower first, or null for not at all. */
  private static rank(e: PaletteEntry, q: string, words: string[]): number | null {
    if (!q) return kindRank(e.kind);
    const name = e.label.toLowerCase();
    const all = `${name} ${e.kind.toLowerCase()} ${(e.hint ?? '').toLowerCase()}`;
    if (!words.every((w) => all.includes(w))) return null;
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    if (words.every((w) => name.includes(w))) return 2;
    return 3;
  }

  private render(): void {
    const q = this.input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const hits: Array<{ e: PaletteEntry; r: number }> = [];
    for (const e of this.entries) {
      const r = Palette.rank(e, q, words);
      if (r !== null) hits.push({ e, r });
    }
    hits.sort((a, b) => a.r - b.r || a.e.label.localeCompare(b.e.label));
    this.shown = hits.slice(0, SHOWN).map((h) => h.e);
    this.at = Math.min(this.at, Math.max(0, this.shown.length - 1));
    this.list.replaceChildren(...this.shown.map((e, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'palette-row' + (i === this.at ? ' palette-at' : '');
      const kind = document.createElement('span');
      kind.className = `palette-kind palette-kind-${e.kind.toLowerCase()}`;
      kind.textContent = e.kind;
      const name = document.createElement('span');
      name.className = 'palette-name';
      name.textContent = e.label;
      if (e.hint) {
        const hint = document.createElement('small');
        hint.textContent = e.hint;
        name.append(hint);
      }
      row.append(kind, name);
      if (e.key) {
        const key = document.createElement('kbd');
        key.textContent = e.key;
        row.append(key);
      }
      row.addEventListener('pointerenter', () => {
        this.at = i;
        this.mark();
      });
      row.addEventListener('click', () => this.choose(e));
      return row;
    }));
    this.count.textContent = !hits.length
      ? `Nothing is called “${this.input.value.trim()}”.`
      : hits.length > SHOWN
        ? `The first ${SHOWN} of ${hits.length}: type more to narrow it.`
        : `${hits.length} found · ↑ ↓ to choose, Enter to open, Esc to shut`;
  }
}
