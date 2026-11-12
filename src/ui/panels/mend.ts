import { ACTION_BY_ID, type Target } from '../../game/actions';
import type { Game } from '../../game/game';
import { canImprove, IMPROVE_DAMAGE, IMPROVE_FAIL_LEAST, IMPROVE_FAIL_SPREAD, improvable, lockSaid, stockKinds, type StockLock } from '../../game/improve';
import { itemDef, itemName, type Item } from '../../game/items';
import {
  byDamage, cyclePlan, goSecs, heldEquipment, honeable, honeQueue, improveTools, improveTop, JOB_GOES_MOST, passesAhead, repairCost,
  repairHealed, repairQlPerPoint, repairQueue, repairRefusal, whetstonesHeld, type CycleStop,
} from '../../game/mending';
import { WHETSTONE } from '../../game/relicuse';
import { SKILL_BY_ID } from '../../game/skills';
import { Repaint } from '../repaint';
import type { UIWindow } from '../windows';
import { clockSaid } from './craftqueue';

const ql1 = (n: number): string => n.toFixed(1);
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const lower = (id: string): string => itemDef(id).name.toLowerCase();
const skillName = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id.replace(/_/g, ' ');
const keyOf = (l: StockLock): string => `${l.stock}|${l.stockOf ?? ''}`;
const actionsSaid = (n: number): string => `${n} ${n === 1 ? 'action' : 'actions'}`;

/** The jobs this window starts, which it says are in hand. */
const OURS = new Set(['improve_item', 'repair_item', 'hone_whetstone']);

/**
 * Improve and repair: one window for both (`src/game/mending.ts` has the numbers).
 *
 * **Repair**: held equipment, the most damaged first, each with its QL, its damage, what a Repair of it to
 * nought costs, and Repair and Hone on the row; Repair all; and the ancient whetstones held, what one does,
 * and Hone all. **Improve**: one piece, chosen here or off its menu: its QL and top, its tools, every kind of
 * stock a pass takes with what is carried and in reach, every pass ahead the chosen kind allows, and the time
 * a go of each job takes. **Cycles**: a run of improve-and-repair cycles held to the chosen kind of stock, what
 * it uses up and which of its stops comes first.
 */
export class MendPanel {
  private readonly body: HTMLDivElement;
  private readonly repaint = new Repaint(400);
  /** The piece being improved. */
  private uid: number | null = null;
  /** The stock kind a run is held to, chosen here; the first a pass would draw otherwise. */
  private lock: string | null = null;
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

  /** Open on this piece: off its menu, or with nothing chosen. */
  show(uid?: number): void {
    if (uid !== undefined) {
      this.uid = uid;
      this.lock = null;
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

  private render(now = performance.now()): void {
    const g = this.game;
    const gear = heldEquipment(g);
    const a = g.action;
    const sign = JSON.stringify([
      gear.map((it) => [it.uid, it.id, it.ql.toFixed(2), it.dmg.toFixed(2), g.isEquipped(it.uid)]),
      g.inventory.items.map((it) => [it.id, it.extra, it.count]), [...g.skills.values.entries()].map(([k, v]) => [k, v.toFixed(2)]),
      this.uid, this.lock, this.cycles, this.upto, a ? [a.def.id, a.left, a.goes, a.target] : null,
      g.queue.map((q) => [q.def.id, q.goes]),
    ]);
    if (!this.repaint.changed(now, sign)) return;
    const scroll = this.win.body.scrollTop;
    this.body.replaceChildren();
    this.inHand();
    this.repairSection(gear);
    this.improveSection(gear);
    this.win.body.scrollTop = scroll;
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

  private repairSection(gear: Item[]): void {
    const g = this.game;
    const box = this.section('Repair', 'mend-repair');
    const repair = ACTION_BY_ID.get('repair_item');
    const hone = ACTION_BY_ID.get('hone_whetstone');
    const healed = repairHealed(g);
    box.append(this.row([
      `Repair: −${ql1(healed)} damage an action`, `QL −${repairQlPerPoint(g).toFixed(4)} a damage point`, `${clockSaid(goSecs(g, 'repair_item'))} an action`,
    ], 'mend-dim'));
    if (!gear.length) {
      box.append(this.row(['No held equipment: worn, or tools, weapons, armour, shields and packs in the pack.'], 'mend-dim'));
    } else {
      const table = this.table(box, ['Item', 'QL', 'Damage', 'Repair to 0', '', '']);
      const whet = whetstonesHeld(g);
      for (const it of [...gear].sort(byDamage)) {
        const tr = document.createElement('tr');
        if (it.uid === this.uid) tr.className = 'mend-chosen';
        const name = this.cell(tr, `${itemName(it)}${g.isEquipped(it.uid) ? ' (worn)' : ''}`, 'mend-name');
        if (canImprove(it.id)) {
          name.classList.add('mend-pick');
          name.title = 'Improve this';
          name.addEventListener('click', () => this.show(it.uid));
        }
        this.cell(tr, ql1(it.ql), 'mend-num');
        this.cell(tr, ql1(it.dmg), `mend-num${it.dmg > IMPROVE_DAMAGE ? ' mend-bad' : ''}`);
        const why = it.dmg > 0 ? repairRefusal(g, it) : 'Not damaged.';
        const cost = repairCost(g, it);
        this.cell(tr, it.dmg <= 0 ? '—' : why ?? `${actionsSaid(cost.goes)} · ${clockSaid(cost.secs)} · QL −${cost.ql.toFixed(2)}`, why && it.dmg > 0 ? 'mend-num mend-bad' : 'mend-num');
        const rb = this.button('Repair', why ?? `Repair × ${cost.goes}`, !!why || !repair, () => {
          if (repair) g.requestAction(repair, { kind: 'item', uid: it.uid }, cost.goes);
        });
        this.cell(tr, '').append(rb);
        const hb = this.button('Hone', !honeable(it) ? (it.dmg > 0 ? 'Not with an ancient whetstone.' : 'Not damaged.') : whet < 1 ? 'Need an ancient whetstone.' : '1 ancient whetstone: all damage off, QL kept',
          !honeable(it) || whet < 1 || !hone, () => {
            if (hone) g.requestAction(hone, { kind: 'item', uid: it.uid });
          });
        this.cell(tr, '').append(hb);
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

  private improveSection(gear: Item[]): void {
    const g = this.game;
    const box = this.section('Improve', 'mend-improve');
    const pieces = gear.filter((it) => canImprove(it.id));
    if (!pieces.length) {
      box.append(this.row(['No held item Improve takes.'], 'mend-dim'));
      return;
    }
    if (this.uid === null || !pieces.some((it) => it.uid === this.uid)) this.uid = pieces[0].uid;
    const it = pieces.find((p) => p.uid === this.uid) ?? pieces[0];
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
    const sub = document.createElement('div');
    sub.className = 'mend-sub';
    sub.textContent = 'Stock: 1 a pass';
    box.append(sub);
    if (!kinds.length) {
      box.append(this.row([`Missing: ${what.material.stock.filter((s) => !s.endsWith('_ingot')).slice(0, 4).map(lower).join(', ')}${what.material.stock.length > 4 ? ', …' : ''} · held 0 · needed 1 a pass`], 'mend-bad'));
    }
    const chosen = kinds.find((k) => keyOf(k.lock) === this.lock) ?? kinds[0];
    if (chosen) this.lock = keyOf(chosen.lock);
    if (kinds.length) {
      const table = this.table(box, ['', 'Kind', 'Carried', 'In reach', 'Passes']);
      for (const k of kinds) {
        const tr = document.createElement('tr');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'mend-kind';
        radio.checked = k === chosen;
        radio.title = 'Run held to this kind';
        radio.addEventListener('change', () => {
          this.lock = keyOf(k.lock);
          this.repaint.force();
          this.render();
        });
        this.cell(tr, '').append(radio);
        this.cell(tr, lockSaid(k.lock), 'mend-name');
        this.cell(tr, String(k.carried), 'mend-num');
        this.cell(tr, String(k.stored), 'mend-num');
        this.cell(tr, String(k.carried + k.stored), 'mend-num');
        table.append(tr);
      }
    }
    if (!chosen) return;

    // The passes ahead, as many as the chosen stock allows.
    const rows = passesAhead(g, it, chosen.lock);
    const ahead = document.createElement('div');
    ahead.className = 'mend-sub';
    ahead.textContent = `Passes ahead: ${rows.length} (${lockSaid(chosen.lock)} at hand ${chosen.carried + chosen.stored}${rows.length < Math.min(chosen.carried + chosen.stored, JOB_GOES_MOST) ? `, top QL ${ql1(top)}` : ''})`;
    box.append(ahead);
    if (rows.length) {
      const wrap = document.createElement('div');
      wrap.className = 'mend-passes';
      box.append(wrap);
      const table = this.table(wrap, ['Pass', 'Needs', 'QL if passed', 'Chance', 'Left after']);
      for (const r of rows) {
        const tr = document.createElement('tr');
        this.cell(tr, String(r.n), 'mend-num');
        this.cell(tr, `1 ${lockSaid(chosen.lock)}`);
        this.cell(tr, `${ql1(r.from)} → ${ql1(r.to)}`, 'mend-num');
        this.cell(tr, pct(r.chance), 'mend-num');
        this.cell(tr, String(r.left), 'mend-num');
        table.append(tr);
      }
    }
    this.cyclesSection(it, chosen.lock, chosen.carried + chosen.stored);
  }

  /* ---- a run of cycles ---------------------------------------------------------------------------------- */

  private cyclesSection(it: Item, lock: StockLock, atHand: number): void {
    const g = this.game;
    const box = this.section('Improve and repair cycles', 'mend-cycles');
    const improve = ACTION_BY_ID.get('improve_item');
    const count = Math.max(1, Math.min(JOB_GOES_MOST, Math.floor(this.cycles)));
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
    num('Cycles', String(count), 1, JOB_GOES_MOST, 1, (v) => { this.cycles = Number(v) || 1; }, `Improve passes, 1 to ${JOB_GOES_MOST}`);
    num('Target QL', this.upto === null ? '' : String(this.upto), 1, 100, 1, (v) => { this.upto = v.trim() === '' ? null : Math.max(1, Math.min(100, Number(v))); }, 'Blank: none');
    box.append(inputs);
    box.append(this.row(['Cycle: 1 Improve pass', `damage over ${IMPROVE_DAMAGE}: Repair to 0 first`, `stock held to ${lockSaid(lock)}`], 'mend-dim'));

    const plan = cyclePlan(g, it, lock, count, this.upto ?? undefined);
    const stops: Array<[CycleStop, string, number | null, string]> = [
      ['count', `Count: ${count} passes`, count, ''],
      ['stock', `Out of ${lockSaid(lock)}: ${atHand} passes`, atHand, ''],
      ['target', this.upto === null ? 'Target QL: none' : `Target QL ${this.upto}: ${plan.toTarget === null ? 'past top' : `≈ ${plan.toTarget} passes`}`, plan.toTarget, ''],
      ['top', `Top QL ${ql1(improveTop(g, it))}: ${plan.toTop === null ? '—' : `≈ ${plan.toTop} passes`}`, plan.toTop, ''],
    ];
    const list = document.createElement('ul');
    list.className = 'mend-stops';
    for (const [k, label] of stops) {
      const li = document.createElement('li');
      li.textContent = label;
      if (k === plan.stop) {
        li.className = 'mend-first';
        li.textContent = `${label} ◀ stops here`;
      }
      list.append(li);
    }
    const sub = document.createElement('div');
    sub.className = 'mend-sub';
    sub.textContent = 'Stops at the first of';
    box.append(sub, list);
    box.append(this.row([
      `Uses: ${plan.passes} × ${lockSaid(lock)} (at hand ${atHand})`,
      `Repair ≈ ${actionsSaid(plan.repairGoes)}, QL −${plan.repairQl.toFixed(2)}`,
      `Ends ≈ QL ${ql1(plan.endQl)}`,
      `≈ ${clockSaid(plan.secs)}`,
    ], 'mend-sum'));
    const t: Target = { kind: 'item', uid: it.uid, mend: true, stock: lock.stock, ...(lock.stockOf ? { stockOf: lock.stockOf } : {}), ...(this.upto !== null ? { upto: this.upto } : {}) };
    /*
     * Over the damage Improve takes now, and Repair takes it: the run starts with that Repair, and Improve is
     * asked as it will be after it -- the piece at nought -- so the button says why not only for what a Repair
     * would not mend.
     */
    const repair = ACTION_BY_ID.get('repair_item');
    const first = it.dmg > IMPROVE_DAMAGE && !repairRefusal(g, it) ? repairCost(g, it) : null;
    const had = it.dmg;
    if (first) it.dmg = 0;
    const why = improve?.check?.(t, g) ?? null;
    it.dmg = had;
    const go = this.row([]);
    go.append(this.button(`Queue ${count} ${count === 1 ? 'cycle' : 'cycles'}`, why ?? `${first ? `Repair × ${first.goes}, then ` : ''}Improve × ${count}, Repair when damage is over ${IMPROVE_DAMAGE}`, !!why || !improve, () => {
      if (first && repair) g.requestAction(repair, { kind: 'item', uid: it.uid }, first.goes);
      if (improve) g.requestAction(improve, t, count);
    }, 'mend-go'));
    if (first && !why) go.append(this.row([`First: Repair to 0, ${actionsSaid(first.goes)}, QL −${first.ql.toFixed(2)}`], 'mend-dim'));
    if (why) {
      const w = document.createElement('span');
      w.className = 'mend-bad';
      w.textContent = why;
      go.append(w);
    }
    box.append(go);
  }

  /* ---- pieces ----------------------------------------------------------------------------------------- */

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

  private table(host: HTMLElement, heads: string[]): HTMLTableSectionElement {
    const t = document.createElement('table');
    t.className = 'mend-table';
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
