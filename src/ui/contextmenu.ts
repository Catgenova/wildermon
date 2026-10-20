import { uiBox, uiPoint } from './screen';

export interface MenuItem {
  label: string;
  /** Why the entry is unavailable; shown in red. */
  hint?: string;
  /** Neutral extra text such as a materials list. */
  note?: string;
  disabled?: boolean;
  /** Whether the thing the entry toggles is on; set, the row keeps a column for a tick so the labels stay in line. */
  checked?: boolean;
  /** The key that does the same, written at the row's end. */
  keys?: string;
  onSelect?: () => void;
  /** A submenu; the row expands in place so it works with a mouse or a finger. */
  children?: MenuItem[];
}

/** What a list of menu rows needs from whatever is showing it. */
export interface RowHooks {
  /** A submenu opened or closed, so a floating menu can measure itself again. */
  changed?: () => void;
  /** An entry is about to run, so a floating menu can get out of the way. */
  chose?: () => void;
  /** The key that does this entry, when whatever is showing it binds keys. */
  keyOf?: (item: MenuItem) => string | undefined;
  /**
   * Which folds are open, by path. A list that is rebuilt while you work would
   * otherwise shut every submenu under your hand; passing the same set back in
   * keeps them open across as many rebuilds as it takes.
   */
  folds?: Set<string>;
}

/**
 * Build the rows for a list of menu entries. The right-click menu and the tile
 * window both draw their entries with this, so the two can never drift apart.
 */
export function buildMenuRows(items: MenuItem[], depth: number, hooks: RowHooks = {}, path = ''): HTMLElement[] {
  return items.flatMap((item) => buildMenuRow(item, depth, hooks, `${path}/${item.label}`));
}

function buildMenuRow(item: MenuItem, depth: number, hooks: RowHooks, path: string): HTMLElement[] {
  const row = document.createElement('div');
  // A row that does nothing and opens nothing is a line of information, not a refused job, and is drawn as one.
  const info = !item.onSelect && !item.children;
  row.className = 'ctx-item' + (item.disabled ? ' disabled' : '') + (depth ? ' ctx-child' : '') + (info ? ' ctx-info' : '');
  row.style.paddingLeft = `${8 + depth * 14}px`;
  // Reachable from the keyboard (`ContextMenu`'s arrows) without being a stop for Tab.
  if (!info) {
    row.tabIndex = -1;
    row.setAttribute('role', 'menuitem');
    if (item.disabled) row.setAttribute('aria-disabled', 'true');
  }
  if (item.checked !== undefined) {
    const tick = document.createElement('span');
    tick.className = 'ctx-tick';
    tick.textContent = item.checked ? '\u2713' : '';
    row.append(tick);
    row.setAttribute('role', 'menuitemcheckbox');
    row.setAttribute('aria-checked', String(item.checked));
  }
  // A key that does this entry, written where it can be seen.
  const key = hooks.keyOf?.(item);
  if (key !== undefined) {
    const kbd = document.createElement('kbd');
    kbd.className = 'ctx-key';
    kbd.textContent = key;
    row.append(kbd);
    row.classList.add('ctx-keyed');
  }
  const label = document.createElement('span');
  label.className = 'ctx-label';
  label.textContent = item.label;
  row.append(label);
  if (item.keys) {
    const kbd = document.createElement('kbd');
    kbd.className = 'ctx-shortcut';
    kbd.textContent = item.keys;
    row.append(kbd);
  }
  if (item.children) {
    // A fold that is refused says why, as any refused row does.
    if (item.disabled && item.hint) {
      const hint = document.createElement('span');
      hint.className = 'ctx-hint';
      hint.textContent = item.hint;
      row.append(hint);
      row.title = item.hint;
    }
    const chevron = document.createElement('span');
    chevron.className = 'ctx-chevron';
    chevron.textContent = '\u25b8';
    row.setAttribute('aria-expanded', 'false');
    // A row that is both a job and a fold: the label does it, the arrow opens
    // the choices. A row that is only a fold opens wherever it is clicked.
    if (item.onSelect) chevron.title = 'More options';
    row.append(chevron);
    let open: HTMLElement[] | null = null;
    const fold = (remember = true): void => {
      if (open) {
        for (const el of open) el.remove();
        open = null;
        chevron.textContent = '\u25b8';
        row.setAttribute('aria-expanded', 'false');
        if (remember) hooks.folds?.delete(path);
      } else {
        open = buildMenuRows(item.children ?? [], depth + 1, hooks, path);
        row.after(...open);
        chevron.textContent = '\u25be';
        row.setAttribute('aria-expanded', 'true');
        if (remember) hooks.folds?.add(path);
      }
      hooks.changed?.();
    };
    // A fold that was open before this list was rebuilt opens again with it.
    if (hooks.folds?.has(path)) queueMicrotask(() => {
      if (row.isConnected && !open) fold(false);
    });
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.disabled) return;
      fold();
    });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.disabled) return;
      if (!item.onSelect) {
        fold();
        return;
      }
      hooks.chose?.();
      item.onSelect();
    });
    return [row];
  }
  if (item.hint) {
    const hint = document.createElement('span');
    hint.className = 'ctx-hint';
    hint.textContent = item.hint;
    row.append(hint);
    row.title = item.hint;
  } else if (item.note) {
    const note = document.createElement('span');
    note.className = 'ctx-note';
    note.textContent = item.note;
    row.append(note);
    // A note is cut to its slot; the whole of it is there under the pointer, as a hint's is.
    row.title = item.note;
  }
  row.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.disabled) return;
    hooks.chose?.();
    item.onSelect?.();
  });
  return [row];
}

/** Wurm-style right-click menu. */
export class ContextMenu {
  readonly el: HTMLDivElement;
  private swallow = false;

  constructor(root: HTMLElement, private readonly canvas: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ctx-menu';
    this.el.setAttribute('role', 'menu');
    this.el.hidden = true;
    this.el.addEventListener('keydown', (e) => this.key(e));
    root.append(this.el);
    const outside = (e: Event): void => {
      if (this.el.hidden) return;
      if (!this.el.contains(e.target as Node)) {
        this.hide();
        if (e.target === this.canvas) this.swallow = true;
      }
    };
    window.addEventListener('mousedown', outside, true);
    window.addEventListener('touchstart', outside, { capture: true, passive: true });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  /**
   * Open at a point on the screen: a pointer's `clientX` and `clientY`, or a
   * corner of something's `getBoundingClientRect()`.
   *
   * Turned into the interface's own coordinates here rather than by every
   * caller, because the interface is a scaled box over the screen -- on a
   * phone, and at any text and window size but 100% -- and all but one caller
   * was handing its screen point straight to `left` and `top`, which puts the
   * menu somewhere else than where it was asked for as soon as the scale is
   * anything but one.
   */
  show(x: number, y: number, title: string, items: MenuItem[], facts?: string[]): void {
    if (this.el.hidden) this.before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.el.replaceChildren();
    const head = document.createElement('div');
    head.className = 'ctx-title';
    head.textContent = title;
    this.el.append(head);
    // What is true of the thing rather than what can be done to it: where the
    // corner you picked stands, and the ore a prospector read. Both of them
    // used to be sayable only by hovering, and a finger cannot hover.
    for (const fact of facts ?? []) {
      const line = document.createElement('div');
      line.className = 'ctx-facts';
      line.textContent = fact;
      this.el.append(line);
    }
    if (!items.length) {
      const none = document.createElement('div');
      none.className = 'ctx-item disabled';
      none.textContent = 'Nothing to do here';
      this.el.append(none);
    }
    this.el.append(...buildMenuRows(items, 0, { changed: () => this.fit(), chose: () => this.hide() }));
    this.el.hidden = false;
    this.el.setAttribute('aria-label', title);
    this.anchor = uiPoint({ clientX: x, clientY: y });
    this.fit();
    // The first thing that can be done has the keyboard, so the arrows and Enter work at once; a pointer sees no ring for it.
    this.rows().find((r) => !r.classList.contains('disabled'))?.focus({ preventScroll: true });
  }

  /** The rows the arrows walk, in the order they are drawn: open folds' rows among them. */
  private rows(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>('.ctx-item[tabindex]')];
  }

  /**
   * The menu from the keyboard: up and down walk the rows, Home and End go
   * to the ends, right opens a fold and left shuts it, Enter or Space does
   * the row, and Escape puts the menu away. Each is kept from the island, so
   * an arrow here does not also push the view about.
   */
  private key(e: KeyboardEvent): void {
    const rows = this.rows();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const go = (i: number): void => {
      const r = rows[(i + rows.length) % rows.length];
      r?.focus();
      r?.scrollIntoView({ block: 'nearest' });
    };
    const row = rows[at];
    const chevron = row?.querySelector<HTMLElement>('.ctx-chevron');
    switch (e.key) {
      case 'ArrowDown': go(at + 1); break;
      case 'ArrowUp': go(at < 0 ? rows.length - 1 : at - 1); break;
      case 'Home': go(0); break;
      case 'End': go(rows.length - 1); break;
      case 'ArrowRight':
        if (chevron && row?.getAttribute('aria-expanded') === 'false') chevron.click();
        break;
      case 'ArrowLeft':
        if (chevron && row?.getAttribute('aria-expanded') === 'true') chevron.click();
        break;
      case 'Enter':
      case ' ':
        row?.click();
        break;
      case 'Escape': this.hide(); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  private anchor = { x: 0, y: 0 };

  /** Place the menu at its anchor, pulled back inside the viewport if it would overflow. */
  private fit(): void {
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    // Its own size in the interface's pixels, which is what `uiBox` is in; a
    // bounding rectangle is in the screen's, and is the scale times bigger.
    const left = Math.min(this.anchor.x, uiBox().w - this.el.offsetWidth - 4);
    const top = Math.min(this.anchor.y, uiBox().h - this.el.offsetHeight - 4);
    this.el.style.left = `${Math.max(0, left)}px`;
    this.el.style.top = `${Math.max(0, top)}px`;
  }

  /** What had the keyboard before the menu took it, to be given it back. */
  private before: HTMLElement | null = null;

  hide(): void {
    if (this.el.hidden) return;
    const had = this.el.contains(document.activeElement);
    this.el.hidden = true;
    if (had && this.before?.isConnected) this.before.focus({ preventScroll: true });
    this.before = null;
  }

  /** True once when the menu was just closed by a press on the canvas, so a plain click there does nothing else. */
  consumeSwallow(): boolean {
    const s = this.swallow;
    this.swallow = false;
    return s;
  }
}
