import type { ActionDef, Target } from '../../game/actions';
import type { Game } from '../../game/game';
import { itemDef, type Item } from '../../game/items';
import { dropOrder, moveOrder, seenOf, type SeenJob } from '../../game/jobqueue';
import { INGOT_LUMPS, ingotOf, METAL_BY_LUMP } from '../../game/metal';
import { isMaterialKind, type MaterialKind } from '../../game/materials';
import { chooseMaterial, needOf, RECIPE_BY_ID, reachFor, type CraftStock, type Recipe } from '../../game/recipes';
import { keepControlKeys } from '../controlkeys';
import { Repaint } from '../repaint';
import { uiPoint } from '../screen';

/** Where the list is kept folded or open, in this browser. */
const FOLD_KEY = 'wurm-iso-queue-folded';
const lower = (id: string): string => itemDef(id).name.toLowerCase();
const reduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Seconds as the crafting window says a job's time: "40 s", "3 min 20 s", "1 h 5 min". */
export function clockSaid(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

/** One input of a job: how many it takes in all, and from where, in the order a craft spends. */
interface Use {
  item: string;
  need: number;
  from: Array<{ where: string; n: number }>;
  short: number;
}

/**
 * Everything queued, the job in hand first: at the foot of the crafting
 * window, which already counts what is at hand and where it is.
 *
 * Each job says its name, the goes left of a counted one, its time at your
 * pace now (`Game.duration`, a go at a time, times the goes), and for a craft
 * what it will use up and where each of it will come from. That is spent in
 * the order a craft spends it (`Game.craftStock`): the pack, then the bags,
 * then the nearest store, and the job in hand and every job before it in the
 * list have had their share first, so the list says which job will run short.
 *
 * The jobs waiting are put in order by their grip, dragged, or by ↑ and ↓,
 * and taken out with ×. The job in hand is not one of them and has neither.
 */
export class QueueView {
  readonly el: HTMLElement;
  private readonly head: HTMLDivElement;
  private readonly title: HTMLSpanElement;
  private readonly fold: HTMLButtonElement;
  private readonly go: HTMLButtonElement;
  private readonly list: HTMLOListElement;
  private readonly repaint = new Repaint(250);
  private folded = false;
  /** What the list last said in its cheap part (which jobs, how many goes), checked every frame. */
  private shape = '';
  /** The time left on the job in hand, rewritten only when the figure changes. */
  private nowTime: HTMLElement | null = null;
  private nowSaid = '';
  /** The jobs as drawn, which is what a reorder says it saw. */
  private seen: SeenJob[] = [];
  private dragging = false;
  /** The button to put the focus back on once the list is drawn again: a row's ↑ or ↓, by place. */
  private refocus: { at: number; dir: 'up' | 'down' | 'drop' } | null = null;

  constructor(private readonly game: Game) {
    this.el = document.createElement('section');
    this.el.className = 'craft-queue';
    this.el.hidden = true;
    this.head = document.createElement('div');
    this.head.className = 'cq-head';
    this.fold = document.createElement('button');
    this.fold.type = 'button';
    this.fold.className = 'inv-group cq-fold';
    this.title = document.createElement('span');
    this.title.className = 'cq-title';
    this.fold.append(this.title);
    this.fold.addEventListener('click', () => this.setFolded(!this.folded));
    this.go = document.createElement('button');
    this.go.type = 'button';
    this.go.className = 'tb-btn tb-small';
    this.go.textContent = 'Carry on';
    this.go.title = 'Take the jobs put down by walking up again, from the top of the list';
    this.go.addEventListener('click', () => this.game.resumeQueue());
    this.head.append(this.fold, this.go);
    this.list = document.createElement('ol');
    this.list.className = 'cq-list';
    this.el.append(this.head, this.list);
    // ↑, ↓ and × pressed from the keyboard, rather than Enter going to Talk.
    keepControlKeys(this.el);
    try {
      this.folded = localStorage.getItem(FOLD_KEY) === '1';
    } catch {
      // Open, for as long as the page is.
    }
    // What a craft would spend, and from where, changes with the pack and the stores.
    for (const ev of ['inventory', 'crate', 'skill', 'action'] as const) game.events.on(ev, () => this.repaint.ask());
  }

  private setFolded(on: boolean): void {
    this.folded = on;
    try {
      localStorage.setItem(FOLD_KEY, on ? '1' : '0');
    } catch {
      // Kept for as long as the page is open.
    }
    this.repaint.force();
    this.update(performance.now());
  }

  /** Every frame the window is open: the clock in place, and the list when what it says has changed. */
  update(now: number): void {
    const a = this.game.action;
    const q = this.game.queue;
    const shape = `${a ? `${a.def.id}.${a.left ?? ''}.${a.goes ?? ''}.${a.state}` : '-'}|${q.map((j) => `${j.def.id}.${j.goes ?? 1}`).join()}|${this.game.held ? 1 : 0}|${this.game.queueCapacity()}`;
    if (shape !== this.shape) {
      this.shape = shape;
      this.repaint.force();
    }
    if (!this.dragging && this.repaint.due(now)) {
      const said = this.draw();
      if (this.repaint.changed(now, said)) this.build();
    }
    // The job in hand's time ticks down; only its figure is touched.
    if (this.nowTime && a) {
      const t = this.timeLeft();
      if (t !== this.nowSaid) this.nowTime.textContent = this.nowSaid = t;
    }
  }

  private timeLeft(): string {
    const a = this.game.action;
    if (!a) return '';
    if (a.state === 'walking') return 'walking to it';
    const rest = Math.max(0, a.duration - a.elapsed) + Math.max(0, (a.left ?? 1) - 1) * a.duration;
    return `${clockSaid(rest)} left`;
  }

  /** The seconds a job waiting will take at your pace now. */
  private secsOf(def: ActionDef, goes: number): number {
    return this.game.duration(def) * goes;
  }

  /**
   * What each job uses and from where, worked through in the order the jobs
   * will run, so each takes what the ones before it have left. Built as text
   * first, which is what decides whether anything is drawn again.
   */
  private uses: Array<{ uses: Use[]; tool?: string }> = [];

  private draw(): string {
    const a = this.game.action;
    const jobs: Array<{ def: ActionDef; target: Target; goes: number }> = [];
    if (a) jobs.push({ def: a.def, target: a.target, goes: Math.max(1, a.left ?? 1) });
    for (const j of this.game.queue) jobs.push({ def: j.def, target: j.target, goes: Math.max(1, j.goes ?? 1) });
    const spent = new Map<Item, number>();
    const stocks = new Map<number, readonly CraftStock[]>();
    this.uses = jobs.map((j) => {
      const r = RECIPE_BY_ID.get(j.def.id);
      if (!r) return { uses: [] };
      const reach = reachFor(this.game, r);
      let stock = stocks.get(reach);
      if (!stock) stocks.set(reach, (stock = this.game.craftStock(undefined, false, reach)));
      const uid = j.target.kind === 'item' ? j.target.uid : undefined;
      const mat = chooseMaterial(this.game, r, uid, undefined, stock);
      return {
        uses: r.inputs.map((i) => this.allot(r, i.item, needOf(this.game, r, i) * j.goes, mat, stock as readonly CraftStock[], spent)),
        tool: r.tool && !this.game.inventory.has(r.tool) ? r.tool : undefined,
      };
    });
    return `${this.folded ? 1 : 0}${this.shape}|${this.uses.map((u) => `${u.tool ?? ''}:${u.uses.map((x) => `${x.item}${x.need}${x.short}${x.from.map((f) => `${f.where}${f.n}`).join()}`).join()}`).join(';')}`;
  }

  /** Take `need` of an input out of what is at hand, in spending order, net of what the jobs before have taken. */
  private allot(r: Recipe, id: string, need: number, mat: string | undefined, stock: readonly CraftStock[], spent: Map<Item, number>): Use {
    const metal = METAL_BY_LUMP.get(id);
    const bar = metal ? ingotOf(metal) : undefined;
    // An input of the recipe's kind of material has to be of the one settled on; the nails in an oak chest need not be oak.
    const strict = !!mat && !!r.material && stock.some((s) => s.item.id === id && isMaterialKind(s.item.extra, r.material as MaterialKind));
    const from = new Map<string, number>();
    let left = need;
    for (const s of stock) {
      if (left <= 0) break;
      const per = s.item.id === id ? 1 : s.item.id === bar ? INGOT_LUMPS : 0;
      if (!per || (strict && s.item.extra !== mat)) continue;
      const free = s.item.count - (spent.get(s.item) ?? 0);
      if (free <= 0) continue;
      const take = Math.min(free, Math.ceil(left / per));
      spent.set(s.item, (spent.get(s.item) ?? 0) + take);
      left -= take * per;
      const where = !s.carried ? (s.store ?? 'a store') : this.game.inventory.items.includes(s.item) ? 'pack' : 'bags';
      // An ingot broken into for lumps gives what is left of it back: only what the job takes is counted.
      from.set(where, (from.get(where) ?? 0) + take * per + Math.min(0, left));
    }
    return { item: id, need, from: [...from].map(([where, n]) => ({ where, n })), short: Math.max(0, left) };
  }

  private build(): void {
    const a = this.game.action;
    const q = this.game.queue;
    this.seen = seenOf(q);
    this.nowTime = null;
    this.nowSaid = '';
    const any = !!a || q.length > 0;
    this.el.hidden = !any;
    if (!any) {
      this.list.replaceChildren();
      return;
    }
    const held = (a ? 1 : 0) + q.length;
    const cap = this.game.queueCapacity();
    let total = a && a.state !== 'walking' ? Math.max(0, a.duration - a.elapsed) + Math.max(0, (a.left ?? 1) - 1) * a.duration : 0;
    for (const j of q) total += this.secsOf(j.def, Math.max(1, j.goes ?? 1));
    const putDown = !a && this.game.held;
    this.title.textContent = `${this.folded ? '▸' : '▾'} ${putDown ? 'Jobs put down' : 'Jobs'} · ${held} of ${cap} held · ${clockSaid(total)} in all`;
    this.fold.title = this.folded ? 'Show the jobs, the one in hand first' : 'Fold the jobs away';
    this.fold.setAttribute('aria-expanded', String(!this.folded));
    this.go.hidden = !putDown;
    this.list.hidden = this.folded;
    if (this.folded) {
      this.list.replaceChildren();
      return;
    }
    const rows: HTMLLIElement[] = [];
    let k = 0;
    if (a) rows.push(this.row(a.def, Math.max(1, a.left ?? 1), this.uses[k++], -1, a.goes));
    q.forEach((j, i) => rows.push(this.row(j.def, Math.max(1, j.goes ?? 1), this.uses[k++], i)));
    this.list.classList.toggle('cq-anim', !reduced() && this.game.settings.graphics !== 'fast');
    this.list.replaceChildren(...rows);
    const back = this.refocus;
    this.refocus = null;
    if (back) {
      const at = Math.max(0, Math.min(q.length - 1, back.at));
      const row = this.list.querySelector<HTMLElement>(`.cq-row[data-at="${at}"]`);
      const btn = row?.querySelector<HTMLButtonElement>(`.cq-${back.dir}:not(:disabled)`) ?? row?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      btn?.focus();
    }
  }

  /** A row: `at` is its place among the jobs waiting, or -1 for the job in hand. */
  private row(def: ActionDef, goes: number, use: { uses: Use[]; tool?: string } | undefined, at: number, of?: number): HTMLLIElement {
    const li = document.createElement('li');
    li.className = at < 0 ? 'cq-row cq-now' : 'cq-row';
    const grip = document.createElement('span');
    grip.className = 'cq-grip';
    grip.setAttribute('aria-hidden', 'true');
    const main = document.createElement('div');
    main.className = 'cq-main';
    const name = document.createElement('div');
    name.className = 'cq-name';
    name.textContent = def.label;
    const meta = document.createElement('small');
    meta.className = 'cq-meta';
    if (at < 0) {
      grip.textContent = '▶';
      grip.title = 'In hand now: it is not moved by reordering';
      const count = of && of > 1 ? `${goes} of ${of} goes left · ` : '';
      meta.append(document.createTextNode(count));
      const t = document.createElement('span');
      this.nowSaid = this.timeLeft();
      t.textContent = this.nowSaid;
      this.nowTime = t;
      meta.append(t);
    } else {
      li.dataset.at = String(at);
      grip.textContent = '⠿';
      grip.title = 'Drag to put it elsewhere in the list';
      meta.textContent = `${goes > 1 ? `× ${goes} · ` : ''}${clockSaid(this.secsOf(def, goes))}`;
      grip.addEventListener('pointerdown', (e) => this.grab(e, li, at));
    }
    name.append(meta);
    main.append(name);
    const parts: HTMLElement[] = [];
    if (use?.tool) {
      const t = document.createElement('span');
      t.className = 'lack';
      t.textContent = `no ${lower(use.tool)} carried`;
      parts.push(t);
    }
    for (const u of use?.uses ?? []) {
      const s = document.createElement('span');
      s.className = u.short ? 'lack' : 'have';
      s.textContent = `${u.need} ${lower(u.item)}`;
      const where = document.createElement('em');
      const bits = u.from.map((f) => `${f.n} in ${f.where}`);
      if (u.short) bits.push(`${u.short} short`);
      where.textContent = ` (${bits.join(', ')})`;
      s.append(where);
      parts.push(s);
    }
    if (parts.length) {
      const uses = document.createElement('div');
      uses.className = 'cq-uses';
      uses.append(document.createTextNode('Uses '));
      parts.forEach((p, i) => {
        if (i) uses.append(document.createTextNode(' · '));
        uses.append(p);
      });
      main.append(uses);
    }
    li.append(grip, main);
    if (at >= 0) {
      const n = this.seen.length;
      const btns = document.createElement('div');
      btns.className = 'cq-btns';
      const btn = (cls: 'up' | 'down' | 'drop', text: string, label: string, off: boolean, order: () => number[]): void => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tb-btn tb-small cq-${cls}`;
        b.textContent = text;
        b.title = label;
        b.setAttribute('aria-label', label);
        b.disabled = off;
        b.addEventListener('click', () => {
          this.refocus = { at: cls === 'up' ? at - 1 : cls === 'down' ? at + 1 : at, dir: cls };
          this.put(order());
        });
        btns.append(b);
      };
      btn('up', '↑', `Move ${def.label.toLowerCase()} up`, at === 0, () => moveOrder(n, at, at - 1));
      btn('down', '↓', `Move ${def.label.toLowerCase()} down`, at === n - 1, () => moveOrder(n, at, at + 1));
      btn('drop', '×', `Take ${def.label.toLowerCase()} out of the list`, false, () => dropOrder(n, at));
      li.append(btns);
    }
    return li;
  }

  private put(order: number[]): void {
    this.game.putQueueInOrder(this.seen, order);
    this.repaint.force();
  }

  /**
   * A row taken by its grip and dragged up or down the list. The rows are
   * measured once, when it is taken; after that only transforms move.
   */
  private grab(e: PointerEvent, li: HTMLLIElement, from: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rows = [...this.list.querySelectorAll<HTMLLIElement>('.cq-row:not(.cq-now)')];
    const tops = rows.map((r) => {
      const b = r.getBoundingClientRect();
      const t = uiPoint({ clientX: b.left, clientY: b.top }).y;
      return { top: t, mid: (t + uiPoint({ clientX: b.left, clientY: b.bottom }).y) / 2 };
    });
    const b = li.getBoundingClientRect();
    const h = uiPoint({ clientX: 0, clientY: b.bottom }).y - uiPoint({ clientX: 0, clientY: b.top }).y;
    const y0 = uiPoint(e).y;
    let to = from;
    this.dragging = true;
    li.classList.add('cq-lifted');
    const grip = e.currentTarget as HTMLElement;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer counts as down: the drag still follows it while it is over the grip.
    }
    const move = (m: PointerEvent): void => {
      const dy = uiPoint(m).y - y0;
      li.style.transform = `translateY(${dy}px)`;
      const mid = tops[from].mid + dy;
      to = from;
      while (to > 0 && mid < tops[to - 1].mid) to--;
      while (to < rows.length - 1 && mid > tops[to + 1].mid) to++;
      rows.forEach((r, i) => {
        if (i === from) return;
        const shift = from < to && i > from && i <= to ? -h : from > to && i >= to && i < from ? h : 0;
        const want = shift ? `translateY(${shift}px)` : '';
        if (r.style.transform !== want) r.style.transform = want;
      });
    };
    const end = (done: boolean): void => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      for (const r of rows) r.style.transform = '';
      li.classList.remove('cq-lifted');
      this.dragging = false;
      if (done && to !== from) this.put(moveOrder(rows.length, from, to));
      else this.repaint.force();
    };
    const up = (): void => end(true);
    const cancel = (): void => end(false);
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', cancel);
  }
}
