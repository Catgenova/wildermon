/**
 * The bar under a plan over an area (`planarea.ts`): while it is laid out,
 * what it plans, what the lot takes against the pack and the stores within
 * reach, and what is refused and why, with Plan and Cancel; once the island
 * has planned it, Undo for as long as the island keeps it to undo
 * (`PLAN_UNDO_SECONDS`). Every word goes in as text.
 */
import { itemDef } from '../game/items';
import type { AreaTotal } from '../game/planarea';

/** What the bar shows while a plan is laid out. */
export interface PlanBarView {
  title: string;
  /** How many pieces pass: what Plan asks for. */
  count: number;
  totals: AreaTotal[];
  refused: Array<{ why: string; n: number }>;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class PlanBar {
  readonly el: HTMLDivElement;
  private undoUntil = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement, private readonly on: { plan: () => void; cancel: () => void; undo: () => void }) {
    this.el = el('div', 'plan-bar');
    this.el.hidden = true;
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Plan');
    // A click on the bar is the bar's, not the island's under it.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.append(this.el);
  }

  /** Whether the bar is offering Undo just now. */
  get undoing(): boolean {
    return !this.el.hidden && this.el.dataset.mode === 'undo';
  }

  /** The plan as it is laid out: its pieces counted, its totals, its refusals, Plan and Cancel. */
  show(v: PlanBarView): void {
    this.clearTimer();
    this.el.dataset.mode = 'plan';
    const rows: HTMLElement[] = [el('div', 'plan-bar-title', v.title)];
    if (v.totals.length) {
      const table = el('table', 'plan-bar-totals');
      const head = el('tr', 'plan-bar-head');
      for (const h of ['', 'Need', 'Carried', 'Stored', 'Short']) head.append(el('th', '', h));
      table.append(head);
      for (const t of v.totals) {
        const short = Math.max(0, t.need - t.carried - t.stored);
        const tr = el('tr', short > 0 ? 'plan-bar-short' : '');
        tr.append(el('td', 'plan-bar-what', itemDef(t.id).name), el('td', '', String(t.need)), el('td', '', String(t.carried)),
          el('td', '', String(t.stored)), el('td', 'plan-bar-gap', short > 0 ? String(short) : '0'));
        table.append(tr);
      }
      rows.push(table);
    } else if (v.count > 0) {
      rows.push(el('div', 'plan-bar-line', 'Materials: none'));
    }
    for (const r of v.refused.slice(0, 3)) rows.push(el('div', 'plan-bar-refused', `Refused ${r.n}: ${r.why}`));
    const buttons = el('div', 'plan-bar-buttons');
    const plan = el('button', 'tb-btn plan-bar-go', `Plan ${v.count}`);
    plan.type = 'button';
    plan.disabled = v.count === 0;
    plan.addEventListener('click', () => this.on.plan());
    const cancel = el('button', 'tb-btn', 'Cancel (Esc)');
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.on.cancel());
    buttons.append(plan, cancel);
    rows.push(buttons);
    this.el.replaceChildren(...rows);
    this.el.hidden = false;
  }

  /** A plan the island has just planned: Undo, until `until` (ms on `Date.now`), and gone after. */
  offerUndo(title: string, until: number): void {
    this.clearTimer();
    this.undoUntil = until;
    this.el.dataset.mode = 'undo';
    const buttons = el('div', 'plan-bar-buttons');
    const undo = el('button', 'tb-btn plan-bar-go', 'Undo (Ctrl+Z)');
    undo.type = 'button';
    undo.addEventListener('click', () => this.on.undo());
    const close = el('button', 'tb-btn', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.hide());
    buttons.append(undo, close);
    this.el.replaceChildren(el('div', 'plan-bar-title', title), buttons);
    this.el.hidden = false;
    this.timer = setTimeout(() => this.hide(), Math.max(0, until - Date.now()));
  }

  /** Whether Undo is still on offer. */
  undoOpen(): boolean {
    return this.undoing && Date.now() < this.undoUntil;
  }

  hide(): void {
    this.clearTimer();
    this.el.hidden = true;
    this.el.replaceChildren();
    delete this.el.dataset.mode;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
