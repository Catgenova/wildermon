import { ACTION_BY_ID, type Target } from '../../game/actions';
import { QUEUE_PER_MIND, type Game } from '../../game/game';
import { canImprove, IMPROVE_DAMAGE, IMPROVE_FAIL_LEAST, IMPROVE_FAIL_SPREAD, improvable, lockSaid, madeOf, stockKinds, type StockLock } from '../../game/improve';
import { itemDef, itemName, type Item } from '../../game/items';
import {
  byDamage, cyclePlan, goSecs, heldEquipment, honeable, honeQueue, improveTools, improveTop, JOB_GOES_MOST, lockAtHand, lockKey, passesAhead, pieceJob, piecePlans,
  piecesThatFit, queueRoom, repairCost, repairHealed, repairQlPerPoint, repairQueue, repairRefusal, whetstonesHeld, type CyclePlan, type CycleStop,
} from '../../game/mending';
import { WHETSTONE } from '../../game/relicuse';
import { SKILL_BY_ID } from '../../game/skills';
import { Picking } from '../picking';
import { Repaint } from '../repaint';
import type { UIWindow } from '../windows';
import { clockSaid } from './craftqueue';

const ql1 = (n: number): string => n.toFixed(1);
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const lower = (id: string): string => itemDef(id).name.toLowerCase();
const skillName = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id.replace(/_/g, ' ');
const actionsSaid = (n: number): string => `${n} ${n === 1 ? 'action' : 'actions'}`;
const piecesSaid = (n: number): string => `${n} ${n === 1 ? 'piece' : 'pieces'}`;

/** A stop of a run of cycles, as its line says it: what it comes to on its own. */
function stopSaid(g: Game, it: Item, stop: CycleStop, plan: CyclePlan, lock: StockLock, atHand: number, upto: number | null): string {
  if (stop === 'count') return `Count: ${plan.count} passes`;
  if (stop === 'stock') return `Out of ${lockSaid(lock)}: ${atHand} passes`;
  if (stop === 'target') return upto === null ? 'Target QL: none' : `Target QL ${upto}: ${plan.toTarget === null ? 'past top' : `≈ ${plan.toTarget} passes`}`;
  return `Top QL ${ql1(improveTop(g, it))}: ${plan.toTop === null ? '—' : `≈ ${plan.toTop} passes`}`;
}

/** The stock a piece takes, as what is missing is named: what it is made of, else its material's kinds. */
function stockSaid(it: Item): string {
  const made = madeOf(it);
  if (made) return made.toLowerCase();
  const stock = improvable(it.id)?.material.stock ?? [];
  return `${stock.filter((s) => !s.endsWith('_ingot')).slice(0, 4).map(lower).join(', ')}${stock.length > 4 ? ', …' : ''}`;
}

/** Keys and modifiers a pick reads: a click's, a key's, or a box ticked. */
type PickKeys = Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/** The jobs this window starts, which it says are in hand. */
const OURS = new Set(['improve_item', 'repair_item', 'hone_whetstone']);

/**
 * Improve and repair: one window for both (`src/game/mending.ts` has the numbers).
 *
 * **Repair**: held equipment, the most damaged first, each with its QL, its damage, what a Repair of it to
 * nought costs, and Repair, Hone and Improve on the row; Repair all; and the ancient whetstones held, what one
 * does, and Hone all. **Improve**: the pieces chosen on the rows or off a piece's menu -- one, or several with
 * Ctrl/⌘-click, Shift-click or a row's box (`Picking`) -- their QL and top, their tools, every kind of stock a pass
 * takes with what is carried and in reach, and for one piece every pass ahead the chosen kind allows and the time
 * a go of each job takes. **Cycles**: a run of improve-and-repair cycles on each piece chosen in turn, each held
 * to the chosen kind of stock where it takes it, what the run uses up and which of its stops comes first.
 */
export class MendPanel {
  private readonly body: HTMLDivElement;
  private readonly repaint = new Repaint(400);
  /** The piece last picked on its own: the one a Shift-click runs from, and the one chosen when the pick is empty. */
  private uid: number | null = null;
  /** The pieces chosen for Improve and the cycles. */
  private readonly picking = new Picking();
  /** The stock kind a run is held to for each material (`lockKey`), chosen here; the first a pass would draw otherwise. */
  private readonly locks = new Map<string, string>();
  private cycles = 10;
  private upto: number | null = null;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('settings-body', 'mend-body');
    this.body = document.createElement('div');
    this.body.className = 'mend';
    win.body.append(this.body);
    for (const ev of ['inventory', 'crate', 'skill', 'action'] as const) game.events.on(ev as 'inventory', () => this.repaint.ask());
    win.onOpen = () => {
      this.repaint.force();
      this.render();
    };
    this.render();
  }

  /** Open on this piece, and only it: off its menu, or with nothing chosen. */
  show(uid?: number): void {
    if (uid !== undefined) {
      this.uid = uid;
      this.picking.only(uid);
      this.locks.clear();
    }
    if (!this.win.isOpen) this.win.open();
    this.repaint.force();
    this.render();
  }

  /** Redraw on a beat while open, and only when what it says has changed. */
  update(now: number): void {
    if (!this.win.isOpen || !this.repaint.due(now)) return;
    this.render(now);
  }

  /**
   * A row's name or box: a plain click chooses that piece alone; Ctrl/⌘ adds it or takes it off; Shift chooses
   * the run from the last piece picked to it, in the rows' order. Never none.
   */
  private pick(uid: number, order: number[], e: PickKeys): void {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      this.show(uid);
      return;
    }
    this.picking.click(uid, order, e as MouseEvent);
    if (!this.picking.size) this.picking.only(uid);
    if (!e.shiftKey && this.picking.uids.has(uid)) this.uid = uid;
    this.repaint.force();
    this.render();
  }

  private render(now = performance.now()): void {
    const g = this.game;
    const gear = heldEquipment(g);
    const rows = [...gear].sort(byDamage);
    const pieces = rows.filter((it) => canImprove(it.id));
    // The pick keeps to what is still held; empty, it is the piece last picked, else the first.
    this.picking.keep(pieces.map((it) => it.uid));
    if (!this.picking.size && pieces.length) this.picking.only(pieces.find((it) => it.uid === this.uid)?.uid ?? pieces[0].uid);
    const chosen = pieces.filter((it) => this.picking.uids.has(it.uid));
    const a = g.action;
    const sign = JSON.stringify([
      gear.map((it) => [it.uid, it.id, it.ql.toFixed(2), it.dmg.toFixed(2), g.isEquipped(it.uid)]),
      g.inventory.items.map((it) => [it.id, it.extra, it.count]), [...g.skills.values.entries()].map(([k, v]) => [k, v.toFixed(2)]),
      this.uid, chosen.map((it) => it.uid), [...this.locks], this.cycles, this.upto, a ? [a.def.id, a.left, a.goes, a.target] : null,
      g.queue.map((q) => [q.def.id, q.goes]), g.queueCapacity(),
    ]);
    if (!this.repaint.changed(now, sign)) return;
    const scroll = this.win.body.scrollTop;
    const scrolled = this.body.scrollTop;
    // What had the keys, to have them again on the same control once it is drawn afresh.
    const active = document.activeElement;
    const focus = active instanceof HTMLElement && this.body.contains(active) ? active.dataset.mendFocus : undefined;
    this.body.replaceChildren();
    this.inHand();
    this.repairSection(rows, pieces.map((it) => it.uid));
    this.improveSection(pieces, chosen);
    this.win.body.scrollTop = scroll;
    this.body.scrollTop = scrolled;
    if (focus) this.body.querySelector<HTMLElement>(`[data-mend-focus="${focus}"]`)?.focus();
  }

  /* ---- what is in hand ---------------------------------------------------------------------------- */

  private inHand(): void {
    const a = this.game.action;
    const box = this.section('In hand');
    if (!a || !OURS.has(a.def.id)) {
      box.append(this.row(['None'], 'mend-dim'));
      return;
    }
    const it = a.target.kind === 'item' ? this.game.inventory.get(a.target.uid) : undefined;
    const t = a.target as Target & { mend?: boolean; all?: number; stock?: string; stockOf?: string; upto?: number };
    const parts = [`${a.def.label}: ${it ? itemName(it) : 'gone'}`];
    if (a.goes) parts.push(`action ${Math.max(1, a.goes - (a.left ?? a.goes) + 1)} of ${a.goes}`);
    if (t.mend) parts.push('cycles');
    if (t.all) parts.push(`${t.all} ${t.all === 1 ? 'piece' : 'pieces'} left`);
    if (t.stock) parts.push(`stock ${lockSaid({ stock: t.stock, stockOf: t.stockOf })}`);
    if (typeof t.upto === 'number') parts.push(`to QL ${t.upto}`);
    box.append(this.row([parts.join(' · ')], 'mend-now'));
    const next = this.game.queue.map((q) => `${q.def.label}${q.goes && q.goes > 1 ? ` × ${q.goes}` : ''}`);
    if (next.length) box.append(this.row([`Then: ${next.join(', ')}`], 'mend-dim'));
  }

  /* ---- repair --------------------------------------------------------------------------------------- */

  private repairSection(rows: Item[], order: number[]): void {
    const g = this.game;
    const box = this.section('Repair', 'mend-repair');
    const repair = ACTION_BY_ID.get('repair_item');
    const hone = ACTION_BY_ID.get('hone_whetstone');
    const improve = ACTION_BY_ID.get('improve_item');
    const healed = repairHealed(g);
    box.append(this.row([
      `Repair: −${ql1(healed)} damage an action`, `QL −${repairQlPerPoint(g).toFixed(4)} a damage point`, `${clockSaid(goSecs(g, 'repair_item'))} an action`,
    ], 'mend-dim'));
    if (!rows.length) {
      box.append(this.row(['No held equipment: worn, or tools, weapons, armour, shields and packs in the pack.'], 'mend-dim'));
    } else {
      // How many are chosen for Improve, and the ways to choose several.
      const n = this.picking.size;
      const count = this.row([`Chosen for Improve: ${n} of ${order.length}`], 'mend-count');
      count.append(this.row(['Several: Ctrl/⌘-click, Shift-click or ✓'], 'mend-dim'));
      if (n > 1 && this.uid !== null) {
        const one = this.uid;
        count.append(this.button('Only one', 'Choose only the piece last picked', false, () => this.show(one), 'mend-go'));
      }
      box.append(count);
      const table = this.table(box, ['✓', 'Item', 'QL', 'Damage', 'Repair to 0', '']);
      const whet = whetstonesHeld(g);
      for (const it of rows) {
        const tr = document.createElement('tr');
        const picked = this.picking.uids.has(it.uid);
        if (picked) tr.className = 'mend-chosen';
        const said = `${itemName(it)}${g.isEquipped(it.uid) ? ' (worn)' : ''}`;
        // The box: the same as a Ctrl-click (a Shift-click on it, the same as a Shift-click), for a thumb and the Tab key.
        const tick = this.cell(tr, '', 'mend-tick');
        if (canImprove(it.id)) {
          const box2 = document.createElement('input');
          box2.type = 'checkbox';
          box2.checked = picked;
          box2.title = 'Choose for Improve';
          box2.setAttribute('aria-label', `Choose for Improve: ${said}`);
          box2.dataset.mendFocus = `tick:${it.uid}`;
          box2.addEventListener('click', (e) => this.pick(it.uid, order, { ctrlKey: !e.shiftKey, metaKey: false, shiftKey: e.shiftKey }));
          tick.append(box2);
        }
        const name = this.cell(tr, said, 'mend-name');
        if (canImprove(it.id)) {
          name.classList.add('mend-pick');
          name.title = 'Improve this · Ctrl/⌘-click: add or take off · Shift-click: a run';
          name.tabIndex = 0;
          name.setAttribute('role', 'button');
          name.setAttribute('aria-pressed', String(picked));
          name.dataset.mendFocus = `name:${it.uid}`;
          name.addEventListener('click', (e) => this.pick(it.uid, order, e));
          name.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            this.pick(it.uid, order, e);
          });
        }
        this.cell(tr, ql1(it.ql), 'mend-num');
        this.cell(tr, ql1(it.dmg), `mend-num${it.dmg > IMPROVE_DAMAGE ? ' mend-bad' : ''}`);
        const why = it.dmg > 0 ? repairRefusal(g, it) : 'Not damaged.';
        const cost = repairCost(g, it);
        const costs = this.cell(tr, it.dmg <= 0 ? '—' : why ?? '', why && it.dmg > 0 ? 'mend-num mend-cost mend-bad' : 'mend-num mend-cost');
        // Each part whole, so a narrow window breaks between them.
        if (it.dmg > 0 && !why) {
          [actionsSaid(cost.goes), clockSaid(cost.secs), `QL −${cost.ql.toFixed(2)}`].forEach((part, i) => {
            const span = document.createElement('span');
            span.className = 'mend-part';
            span.textContent = i ? ` · ${part}` : part;
            costs.append(span);
          });
        }
        const acts = this.cell(tr, '', 'mend-acts');
        const rb = this.button('Repair', why ?? `Repair × ${cost.goes}`, !!why || !repair, () => {
          if (repair) g.requestAction(repair, { kind: 'item', uid: it.uid }, cost.goes);
        });
        rb.dataset.mendFocus = `repair:${it.uid}`;
        acts.append(rb);
        const hb = this.button('Hone', !honeable(it) ? (it.dmg > 0 ? 'Not with an ancient whetstone.' : 'Not damaged.') : whet < 1 ? 'Need an ancient whetstone.' : '1 ancient whetstone: all damage off, QL kept',
          !honeable(it) || whet < 1 || !hone, () => {
            if (hone) g.requestAction(hone, { kind: 'item', uid: it.uid });
          });
        hb.dataset.mendFocus = `hone:${it.uid}`;
        acts.append(hb);
        // Improve, once: the item menu's Improve, refused in its words; and the piece is the one chosen.
        const ask: Target = { kind: 'item', uid: it.uid };
        const no = improve?.check?.(ask, g) ?? null;
        const ib = this.button('Improve', no ?? `Improve × 1 · ${clockSaid(goSecs(g, 'improve_item'))}`, !!no || !improve, () => {
          this.show(it.uid);
          if (improve) g.requestAction(improve, ask, 1);
        });
        ib.dataset.mendFocus = `improve:${it.uid}`;
        acts.append(ib);
        table.append(tr);
      }
    }
    // Repair all.
    const all = repairQueue(g);
    const goes = all.reduce((n, it) => n + repairCost(g, it).goes, 0);
    const secs = all.reduce((n, it) => n + repairCost(g, it).secs, 0);
    const qlLost = all.reduce((n, it) => n + repairCost(g, it).ql, 0);
    const dmg = all.reduce((n, it) => n + it.dmg, 0);
    const line = this.row([
      `Repair all: ${all.length} ${all.length === 1 ? 'item' : 'items'}`, `${dmg > 0 ? '−' : ''}${ql1(dmg)} damage`, actionsSaid(goes), clockSaid(secs), `QL −${qlLost.toFixed(2)}`,
      'most damaged first',
    ], 'mend-sum');
    line.append(this.button('Repair all', all.length ? `${all.length} items, one job each, one after another` : 'Nothing damaged that Repair takes.', !all.length || !repair, () => {
      const first = all[0];
      if (repair && first) g.requestAction(repair, { kind: 'item', uid: first.uid, all: all.length }, repairCost(g, first).goes);
    }, 'mend-go'));
    box.append(line);

    // The ancient whetstones.
    const held = whetstonesHeld(g);
    const sub = document.createElement('div');
    sub.className = 'mend-sub';
    sub.textContent = `${itemDef(WHETSTONE).name}s held: ${held}`;
    box.append(sub);
    box.append(this.row(['Each: 1 item', 'all damage off', 'QL kept', 'used up', `${clockSaid(goSecs(g, 'hone_whetstone'))} an action`], 'mend-dim'));
    const honed = honeQueue(g);
    const hDmg = honed.reduce((n, it) => n + it.dmg, 0);
    const hKept = honed.reduce((n, it) => n + repairCost(g, it).ql, 0);
    const damaged = heldEquipment(g).filter(honeable).length;
    const hl = this.row([
      `Hone all: ${honed.length} of ${damaged} damaged ${damaged === 1 ? 'item' : 'items'}`, `${honed.length} ${honed.length === 1 ? 'whetstone' : 'whetstones'}`,
      `${hDmg > 0 ? '−' : ''}${ql1(hDmg)} damage`, `QL kept (Repair: −${hKept.toFixed(2)})`, 'most damaged first',
    ], 'mend-sum');
    hl.append(this.button('Hone all', honed.length ? `${honed.length} ancient whetstones, one an item` : held < 1 ? 'Need an ancient whetstone.' : 'Nothing damaged.', !honed.length || !hone, () => {
      const first = honed[0];
      if (hone && first) g.requestAction(hone, { kind: 'item', uid: first.uid, all: honed.length });
    }, 'mend-go'));
    box.append(hl);
  }

  /* ---- improve -------------------------------------------------------------------------------------- */

  /** The kind a piece is held to: the one chosen for its material where it takes it, else the first it would draw. */
  private lockFor(it: Item): StockLock | null {
    const kinds = stockKinds(this.game, it);
    const want = this.locks.get(improvable(it.id)?.material.id ?? '');
    return (kinds.find((k) => lockKey(k.lock) === want) ?? kinds[0])?.lock ?? null;
  }

  private improveSection(pieces: Item[], chosen: Item[]): void {
    const g = this.game;
    const box = this.section('Improve', 'mend-improve');
    if (!pieces.length || !chosen.length) {
      box.append(this.row(['No held item Improve takes.'], 'mend-dim'));
      return;
    }
    if (chosen.length > 1) {
      this.severalSection(box, chosen);
      this.cyclesSection(chosen);
      return;
    }
    const it = chosen[0];
    const what = improvable(it.id);
    if (!what) return;

    const pick = document.createElement('select');
    pick.className = 'panel-select mend-select';
    pick.title = 'Item to improve';
    for (const p of pieces) {
      const o = document.createElement('option');
      o.value = String(p.uid);
      o.textContent = `${itemName(p)} · QL ${ql1(p.ql)}`;
      o.selected = p.uid === it.uid;
      pick.append(o);
    }
    pick.addEventListener('change', () => this.show(Number(pick.value)));
    const pr = this.row(['Item']);
    pr.append(pick);
    box.append(pr);

    const top = improveTop(g, it);
    const improve = ACTION_BY_ID.get('improve_item');
    const ask = { kind: 'item' as const, uid: it.uid };
    const why = improve?.check?.(ask, g) ?? null;
    const facts = document.createElement('dl');
    facts.className = 'mend-facts';
    const fact = (k: string, v: string, cls = ''): void => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      if (cls) dd.className = cls;
      facts.append(dt, dd);
    };
    fact('QL', `${ql1(it.ql)} · top ${ql1(top)} (${skillName(what.skill)} ${g.skills.get(what.skill).toFixed(1)})`);
    fact('Damage', `${ql1(it.dmg)} · Improve refused over ${IMPROVE_DAMAGE}`, it.dmg > IMPROVE_DAMAGE ? 'mend-bad' : '');
    fact('Material', `${what.material.name} · 1 stock a pass, passed or failed`);
    fact('Tools', improveTools(g, it).map((t) => `${itemDef(t.id).name} ${t.held ? `QL ${ql1(g.toolQl(t.id))}` : 'missing'}`).join(' · '),
      improveTools(g, it).some((t) => !t.held) ? 'mend-bad' : '');
    fact('Time an action', `Improve ${clockSaid(goSecs(g, 'improve_item'))} · Repair ${clockSaid(goSecs(g, 'repair_item'))}`);
    fact('Failed pass', `+${IMPROVE_FAIL_LEAST} to ${IMPROVE_FAIL_LEAST + IMPROVE_FAIL_SPREAD} damage`);
    if (why) fact('Improve now', why, 'mend-bad');
    box.append(facts);

    // Every kind of stock a pass takes, and the one a run is held to.
    const kinds = stockKinds(g, it);
    box.append(this.sub('Stock: 1 a pass'));
    if (!kinds.length) box.append(this.row([`Missing: ${stockSaid(it)} · held 0 · needed 1 a pass`], 'mend-bad'));
    const lock = this.lockFor(it);
    const chosen1 = kinds.find((k) => lock && lockKey(k.lock) === lockKey(lock));
    if (kinds.length) this.kindsTable(box, what.material.id, kinds.map((k) => ({ ...k, takes: '' })), chosen1 ? lockKey(chosen1.lock) : '', false);
    if (!chosen1) return;

    // The passes ahead, as many as the chosen stock allows.
    const rows = passesAhead(g, it, chosen1.lock);
    box.append(this.sub(`Passes ahead: ${rows.length} (${lockSaid(chosen1.lock)} at hand ${chosen1.carried + chosen1.stored}${rows.length < Math.min(chosen1.carried + chosen1.stored, JOB_GOES_MOST) ? `, top QL ${ql1(top)}` : ''})`));
    if (rows.length) {
      const wrap = document.createElement('div');
      wrap.className = 'mend-passes';
      box.append(wrap);
      const table = this.table(wrap, ['Pass', 'Needs', 'QL if passed', 'Chance', 'Left after']);
      for (const r of rows) {
        const tr = document.createElement('tr');
        this.cell(tr, String(r.n), 'mend-num');
        this.cell(tr, `1 ${lockSaid(chosen1.lock)}`);
        this.cell(tr, `${ql1(r.from)} → ${ql1(r.to)}`, 'mend-num');
        this.cell(tr, pct(r.chance), 'mend-num');
        this.cell(tr, String(r.left), 'mend-num');
        table.append(tr);
      }
    }
    this.cyclesSection(chosen);
  }

  /** Several pieces chosen: each one's QL, top, tools and stock, what is missing, and the kinds of stock by material. */
  private severalSection(box: HTMLElement, chosen: Item[]): void {
    const g = this.game;
    const improve = ACTION_BY_ID.get('improve_item');
    box.append(this.sub(`Chosen: ${piecesSaid(chosen.length)}`));
    const table = this.table(box, ['Item', 'QL', 'Top', 'Tools', 'Stock (at hand)', 'Improve now'], 'mend-each');
    const groups = new Map<string, { name: string; items: Item[] }>();
    for (const it of chosen) {
      const what = improvable(it.id);
      if (!what) continue;
      const tools = improveTools(g, it);
      const missing = tools.filter((t) => !t.held);
      const lock = this.lockFor(it);
      const why = improve?.check?.({ kind: 'item', uid: it.uid }, g) ?? null;
      const tr = document.createElement('tr');
      this.cell(tr, itemName(it), 'mend-name');
      this.cell(tr, ql1(it.ql), 'mend-num');
      this.cell(tr, ql1(improveTop(g, it)), 'mend-num');
      this.cell(tr, missing.length ? `Missing: ${missing.map((t) => lower(t.id)).join(', ')}` : tools.map((t) => lower(t.id)).join(', '), missing.length ? 'mend-bad' : '');
      this.cell(tr, lock ? `${lockSaid(lock)} (${lockAtHand(g, lock)})` : `Missing: ${stockSaid(it)}`, lock ? '' : 'mend-bad');
      this.cell(tr, why ?? '—', why ? 'mend-bad' : '');
      table.append(tr);
      const grp = groups.get(what.material.id) ?? { name: what.material.name, items: [] };
      grp.items.push(it);
      groups.set(what.material.id, grp);
    }
    // The kinds of stock, by material: the one chosen holds every piece that takes it.
    for (const [mat, grp] of groups) {
      box.append(this.sub(`Stock, ${grp.name}: 1 a pass`));
      const kinds = new Map<string, { lock: StockLock; carried: number; stored: number; n: number }>();
      for (const it of grp.items) {
        for (const k of stockKinds(g, it)) {
          const was = kinds.get(lockKey(k.lock));
          if (was) was.n++;
          else kinds.set(lockKey(k.lock), { ...k, n: 1 });
        }
      }
      if (!kinds.size) {
        box.append(this.row([`Missing: ${stockSaid(grp.items[0])}`], 'mend-bad'));
        continue;
      }
      const want = this.locks.get(mat);
      const first = grp.items.map((it) => this.lockFor(it)).find((l) => l !== null);
      const on = want && kinds.has(want) ? want : first ? lockKey(first) : '';
      this.kindsTable(box, mat, [...kinds.values()].map((k) => ({ ...k, takes: `${k.n} of ${grp.items.length}` })), on, true);
    }
  }

  /** Kinds of stock, a radio each for the one a run is held to (for this material). */
  private kindsTable(box: HTMLElement, mat: string, kinds: Array<{ lock: StockLock; carried: number; stored: number; takes: string }>, on: string, several: boolean): void {
    const table = this.table(box, several ? ['', 'Kind', 'Carried', 'In reach', 'Pieces'] : ['', 'Kind', 'Carried', 'In reach', 'Passes']);
    for (const k of kinds) {
      const tr = document.createElement('tr');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `mend-kind-${mat}`;
      radio.checked = lockKey(k.lock) === on;
      radio.title = several ? 'Every piece that takes it held to this kind' : 'Run held to this kind';
      radio.setAttribute('aria-label', `Held to ${lockSaid(k.lock)}`);
      radio.dataset.mendFocus = `kind:${mat}:${lockKey(k.lock)}`;
      radio.addEventListener('change', () => {
        this.locks.set(mat, lockKey(k.lock));
        this.repaint.force();
        this.render();
      });
      this.cell(tr, '').append(radio);
      this.cell(tr, lockSaid(k.lock), 'mend-name');
      this.cell(tr, String(k.carried), 'mend-num');
      this.cell(tr, String(k.stored), 'mend-num');
      this.cell(tr, several ? k.takes : String(k.carried + k.stored), 'mend-num');
      table.append(tr);
    }
  }

  /* ---- a run of cycles ---------------------------------------------------------------------------------- */

  private cyclesSection(chosen: Item[]): void {
    const g = this.game;
    const box = this.section('Improve and repair cycles', 'mend-cycles');
    const improve = ACTION_BY_ID.get('improve_item');
    const repair = ACTION_BY_ID.get('repair_item');
    const several = chosen.length > 1;
    const count = Math.max(1, Math.min(JOB_GOES_MOST, Math.floor(this.cycles)));
    const upto = this.upto ?? undefined;
    const inputs = this.row([]);
    const num = (label: string, value: string, min: number, max: number, step: number, set: (v: string) => void, title: string): void => {
      const l = document.createElement('label');
      l.className = 'mend-field';
      l.append(label);
      const i = document.createElement('input');
      i.type = 'number';
      i.min = String(min);
      i.max = String(max);
      i.step = String(step);
      i.value = value;
      i.title = title;
      i.className = 'mend-input';
      i.addEventListener('keydown', (e) => e.stopPropagation());
      i.addEventListener('change', () => {
        set(i.value);
        this.repaint.force();
        this.render();
      });
      l.append(i);
      inputs.append(l);
    };
    num(several ? 'Cycles a piece' : 'Cycles', String(count), 1, JOB_GOES_MOST, 1, (v) => { this.cycles = Number(v) || 1; }, `Improve passes${several ? ' a piece' : ''}, 1 to ${JOB_GOES_MOST}`);
    num('Target QL', this.upto === null ? '' : String(this.upto), 1, 100, 1, (v) => { this.upto = v.trim() === '' ? null : Math.max(1, Math.min(100, Number(v))); }, 'Blank: none');
    box.append(inputs);

    const plans = piecePlans(g, chosen, (it) => this.lockFor(it), count, upto);
    const room = queueRoom(g);
    const { fit, left } = piecesThatFit(plans, room);
    const one = plans[0];
    if (!several) {
      if (!one?.lock) return;
      box.append(this.row(['Cycle: 1 Improve pass', `damage over ${IMPROVE_DAMAGE}: Repair to 0 first`, `stock held to ${lockSaid(one.lock)}`], 'mend-dim'));
      const plan = one.plan ?? cyclePlan(g, one.it, one.lock, count, upto, one.atHand);
      const list = document.createElement('ul');
      list.className = 'mend-stops';
      for (const k of ['count', 'stock', 'target', 'top'] as const) {
        const li = document.createElement('li');
        const label = stopSaid(g, one.it, k, plan, one.lock, one.atHand, this.upto);
        li.textContent = label;
        if (k === plan.stop) {
          li.className = 'mend-first';
          li.textContent = `${label} ◀ stops here`;
        }
        list.append(li);
      }
      box.append(this.sub('Stops at the first of'), list);
      box.append(this.row([
        `Uses: ${plan.passes} × ${lockSaid(one.lock)} (at hand ${one.atHand})`,
        `Repair ≈ ${actionsSaid(plan.repairGoes)}, QL −${plan.repairQl.toFixed(2)}`,
        `Ends ≈ QL ${ql1(plan.endQl)}`,
        `≈ ${clockSaid(plan.secs)}`,
      ], 'mend-sum'));
    } else {
      box.append(this.row(['Cycle: 1 Improve pass', `damage over ${IMPROVE_DAMAGE}: Repair to 0 first`, 'each piece held to its stock kind', 'pieces in the rows\' order'], 'mend-dim'));
      const table = this.table(box, ['Item', 'Stock (at hand)', 'Passes', 'Stops first', 'Repairs', 'Ends QL', 'Time'], 'mend-each');
      for (const p of plans) {
        const tr = document.createElement('tr');
        if (left.includes(p)) tr.className = 'mend-left';
        this.cell(tr, itemName(p.it), 'mend-name');
        if (!p.plan || !p.lock) {
          const why = this.cell(tr, p.why ?? '—', 'mend-bad');
          why.colSpan = 6;
        } else {
          this.cell(tr, `${lockSaid(p.lock)} (${p.atHand})`);
          this.cell(tr, String(p.plan.passes), 'mend-num');
          this.cell(tr, stopSaid(g, p.it, p.plan.stop, p.plan, p.lock, p.atHand, this.upto), p.plan.passes ? '' : 'mend-bad');
          this.cell(tr, `≈ ${p.plan.repairGoes}`, 'mend-num');
          this.cell(tr, `≈ ${ql1(p.plan.endQl)}`, 'mend-num');
          this.cell(tr, `≈ ${clockSaid(p.plan.secs)}`, 'mend-num');
        }
        table.append(tr);
      }
      // The totals, of the pieces that go in the queue.
      const sum = (f: (p: CyclePlan) => number): number => fit.reduce((n, p) => n + (p.plan ? f(p.plan) : 0), 0);
      const uses = new Map<string, { lock: StockLock; n: number }>();
      for (const p of fit) {
        if (!p.lock || !p.plan) continue;
        const u = uses.get(lockKey(p.lock)) ?? { lock: p.lock, n: 0 };
        u.n += p.plan.passes;
        uses.set(lockKey(p.lock), u);
      }
      box.append(this.row([
        `Total: ${piecesSaid(fit.length)}`,
        `Improve ${actionsSaid(sum((p) => p.passes))}`,
        `Repair ≈ ${actionsSaid(sum((p) => p.repairGoes))}, QL −${sum((p) => p.repairQl).toFixed(2)}`,
        `Uses: ${[...uses.values()].map((u) => `${u.n} × ${lockSaid(u.lock)}`).join(', ') || 'none'}`,
        `≈ ${clockSaid(sum((p) => p.secs))}`,
      ], 'mend-sum'));
    }

    // The queue: one job for each piece's run (`pieceJob`); what the room left takes.
    const asked = plans.filter((p) => p.jobs > 0);
    if (left.length) {
      box.append(this.row([
        `Action queue ${g.queueCapacity()}: room for ${room}, ${asked.reduce((n, p) => n + p.jobs, 0)} asked`,
        `Not queued: ${left.map((p) => itemName(p.it)).join(', ')}`,
        `${skillName('mind_logic')}: +1 per ${QUEUE_PER_MIND} levels`,
      ], 'mend-bad'));
    }
    const jobs = fit.flatMap((p) => {
      const job = pieceJob(p, count, upto);
      const def = job.action === 'repair_item' ? repair : improve;
      return def ? [{ def, target: job.target, goes: job.goes }] : [];
    });
    const why = (!several ? one?.why : null) ?? (fit.length ? null : asked.length ? `Action queue full: ${g.queueCapacity()}.` : 'No piece to improve.');
    const first = !several ? one?.first ?? null : null;
    const label = `Queue ${count} ${count === 1 ? 'cycle' : 'cycles'}${several ? ` × ${piecesSaid(fit.length)}` : ''}`;
    const title = why ?? (several
      ? `${fit.map((p) => itemName(p.it)).join(', ')}: in turn, Improve × ${count} each, Repair when damage is over ${IMPROVE_DAMAGE}`
      : `${first ? `Repair × ${first.goes}, then ` : ''}Improve × ${count}, Repair when damage is over ${IMPROVE_DAMAGE}`);
    const go = this.row([]);
    const b = this.button(label, title, !!why || !improve || !jobs.length, () => void g.requestInTurn(jobs), 'mend-go');
    b.dataset.mendFocus = 'queue';
    go.append(b);
    if (first && !why) go.append(this.row([`First: Repair to 0, ${actionsSaid(first.goes)}, QL −${first.ql.toFixed(2)}`], 'mend-dim'));
    if (several && fit.some((p) => p.first) && !why) {
      go.append(this.row([`First, over ${IMPROVE_DAMAGE} damage: Repair to 0 (${fit.filter((p) => p.first).map((p) => itemName(p.it)).join(', ')})`], 'mend-dim'));
    }
    if (why) {
      const w = document.createElement('span');
      w.className = 'mend-bad';
      w.textContent = why;
      go.append(w);
    }
    box.append(go);
  }

  /* ---- pieces ----------------------------------------------------------------------------------------- */

  private sub(text: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'mend-sub';
    d.textContent = text;
    return d;
  }

  private section(title: string, cls = ''): HTMLElement {
    const box = document.createElement('section');
    box.className = `mend-section ${cls}`.trim();
    const h = document.createElement('div');
    h.className = 'skill-group';
    h.textContent = title;
    box.append(h);
    this.body.append(box);
    return box;
  }

  private row(parts: string[], cls = ''): HTMLDivElement {
    const r = document.createElement('div');
    r.className = `mend-row ${cls}`.trim();
    for (const p of parts) {
      const s = document.createElement('span');
      s.textContent = p;
      r.append(s);
    }
    return r;
  }

  /** A table in a box of its own that scrolls sideways when the window is narrower than it. */
  private table(host: HTMLElement, heads: string[], cls = ''): HTMLTableSectionElement {
    const wide = document.createElement('div');
    wide.className = 'mend-wide';
    host.append(wide);
    host = wide;
    const t = document.createElement('table');
    t.className = `mend-table ${cls}`.trim();
    const head = document.createElement('thead');
    const tr = document.createElement('tr');
    for (const h of heads) {
      const th = document.createElement('th');
      th.textContent = h;
      tr.append(th);
    }
    head.append(tr);
    const body = document.createElement('tbody');
    t.append(head, body);
    host.append(t);
    return body;
  }

  private cell(tr: HTMLTableRowElement, text: string, cls = ''): HTMLTableCellElement {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.append(td);
    return td;
  }

  private button(text: string, title: string, disabled: boolean, go: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tb-btn tb-small ${cls}`.trim();
    b.textContent = text;
    b.title = title;
    b.disabled = disabled;
    b.addEventListener('click', go);
    return b;
  }
}
