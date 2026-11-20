import { ACTION_BY_ID, type Target } from '../../game/actions';
import type { Game } from '../../game/game';
import { canImprove, IMPROVE_DAMAGE, IMPROVE_FAIL_LEAST, IMPROVE_FAIL_SPREAD, improvable, lockSaid, madeOf, stockKinds, type StockLock } from '../../game/improve';
import { itemDef, itemName, type Item } from '../../game/items';
import {
  byDamage, cyclePlan, goSecs, heldEquipment, honeable, honeQueue, improveTools, improveTop, JOB_GOES_MOST, lockKey, passesAhead, pieceJob, piecePlans,
  queueRoom, repairCost, repairHealed, repairQlPerPoint, repairQueue, repairRefusal, usedIn, whetstonesHeld, willUse, type CyclePlan, type CycleStop,
} from '../../game/mending';
import { WHETSTONE } from '../../game/relicuse';
import { SKILL_BY_ID } from '../../game/skills';
import { Repaint } from '../repaint';
import type { UIWindow } from '../windows';
import { kitBody } from '../kit';
import { clockSaid } from './craftqueue';

const ql1 = (n: number): string => n.toFixed(1);
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const lower = (id: string): string => itemDef(id).name.toLowerCase();
const skillName = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id.replace(/_/g, ' ');
const actionsSaid = (n: number): string => `${n} ${n === 1 ? 'action' : 'actions'}`;

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
  const stock = improvable(it.id, it.extra)?.material.stock ?? [];
  return `${stock.filter((s) => !s.endsWith('_ingot')).slice(0, 4).map(lower).join(', ')}${stock.length > 4 ? ', …' : ''}`;
}

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
  /** The piece Improve shows: the one last picked while held, else the first. */
  private uid: number | null = null;
  /** The stock kind a run is held to for each material (`lockKey`), chosen here; the first a pass would draw otherwise. */
  private readonly locks = new Map<string, string>();
  private cycles = 10;
  private upto: number | null = null;
  /** What the last Improve all used, by the stock's name, off its passes' lines (`usedIn`); null before one. */
  private used: Map<string, number> | null = null;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    kitBody(win.body, 'settings-body', 'mend-body');
    this.body = document.createElement('div');
    this.body.className = 'mend rc-scroll';
    win.body.append(this.body);
    for (const ev of ['inventory', 'crate', 'skill', 'action'] as const) game.events.on(ev as 'inventory', () => this.repaint.ask());
    game.events.on('log', (e) => {
      const u = this.used && usedIn(e.text);
      if (!u || !this.used) return;
      this.used.set(u[0], (this.used.get(u[0]) ?? 0) + u[1]);
      this.repaint.ask();
    });
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

  private render(now = performance.now()): void {
    const g = this.game;
    const gear = heldEquipment(g);
    const rows = [...gear].sort(byDamage);
    const pieces = rows.filter((it) => canImprove(it.id));
    const a = g.action;
    const sign = JSON.stringify([
      gear.map((it) => [it.uid, it.id, it.ql.toFixed(2), it.dmg.toFixed(2), g.isEquipped(it.uid)]),
      g.inventory.items.map((it) => [it.id, it.extra, it.count]), [...g.skills.values.entries()].map(([k, v]) => [k, v.toFixed(2)]),
      this.uid, [...this.locks], this.cycles, this.upto, a ? [a.def.id, a.left, a.goes, a.target] : null,
      g.queue.map((q) => [q.def.id, q.goes]), g.queueCapacity(),
    ]);
    if (!this.repaint.changed(now, sign)) return;
    const scroll = this.win.body.scrollTop;
    const scrolled = this.body.scrollTop;
    // What had the keys, to have them again on the same control once it is drawn afresh.
    const active = document.activeElement;
    const focus = active instanceof HTMLElement && this.body.contains(active) ? active.dataset.mendFocus : undefined;
    // Rows Improve, Repair or Hone would start on first, the rest last; each lot most damaged first.
    const improve = ACTION_BY_ID.get('improve_item');
    const whet = whetstonesHeld(g);
    const can = new Map(rows.map((it) => [it.uid,
      (!!improve && !improve.check?.({ kind: 'item', uid: it.uid }, g)) || (it.dmg > 0 && !repairRefusal(g, it)) || (honeable(it) && whet > 0)]));
    const live = (it: Item): number => Number(!can.get(it.uid));
    rows.sort((a, b) => live(a) - live(b) || byDamage(a, b));
    pieces.sort((a, b) => live(a) - live(b) || byDamage(a, b));
    const one = pieces.find((it) => it.uid === this.uid) ?? pieces[0];
    this.body.replaceChildren();
    this.allSection(pieces);
    this.inHand();
    this.repairSection(rows, one?.uid ?? null);
    this.improveSection(pieces, one);
    this.win.body.scrollTop = scroll;
    this.body.scrollTop = scrolled;
    if (focus) this.body.querySelector<HTMLElement>(`[data-mend-focus="${focus}"]`)?.focus();
  }

  /* ---- all ---------------------------------------------------------------------------------------- */

  /** Repair all, Hone all and Improve all: each piece in turn, one job after another. */
  private allSection(pieces: Item[]): void {
    const g = this.game;
    const box = this.section('All', 'mend-all');
    const repair = ACTION_BY_ID.get('repair_item');
    const hone = ACTION_BY_ID.get('hone_whetstone');
    const improve = ACTION_BY_ID.get('improve_item');
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
    const honed = honeQueue(g);
    const hDmg = honed.reduce((n, it) => n + it.dmg, 0);
    const hKept = honed.reduce((n, it) => n + repairCost(g, it).ql, 0);
    const damaged = heldEquipment(g).filter(honeable).length;
    const hl = this.row([
      `Hone all: ${honed.length} of ${damaged} damaged ${damaged === 1 ? 'item' : 'items'}`, `${itemDef(WHETSTONE).name}s: ${honed.length} of ${held} held`,
      `${hDmg > 0 ? '−' : ''}${ql1(hDmg)} damage`, `QL kept (Repair: −${hKept.toFixed(2)})`, 'most damaged first',
    ], 'mend-sum');
    hl.append(this.button('Hone all', honed.length ? `${honed.length} ancient whetstones, one an item` : held < 1 ? 'Need an ancient whetstone.' : 'Nothing damaged.', !honed.length || !hone, () => {
      const first = honed[0];
      if (hone && first) g.requestAction(hone, { kind: 'item', uid: first.uid, all: honed.length });
    }, 'mend-go'));
    box.append(hl);
    box.append(this.row(['Hone: 1 item a whetstone', 'all damage off', 'QL kept', 'used up', `${clockSaid(goSecs(g, 'hone_whetstone'))} an action`], 'mend-dim'));

    // Improve all: a run of cycles on each piece Improve takes, by item id; the island picks each next (`private.improve_all_next`).
    const count = Math.max(1, Math.min(JOB_GOES_MOST, Math.floor(this.cycles)));
    const upto = this.upto ?? undefined;
    const byId = [...pieces].sort((a, b) => a.uid - b.uid);
    const plans = piecePlans(g, byId, (it) => stockKinds(g, it)[0]?.lock ?? null, count, upto).filter((p) => p.jobs > 0);
    const sum = (f: (p: CyclePlan) => number): number => plans.reduce((n, p) => n + (p.plan ? f(p.plan) : 0), 0);
    const il = this.row([
      `Improve all: ${plans.length} of ${pieces.length} ${pieces.length === 1 ? 'item' : 'items'}`, `Improve ${actionsSaid(sum((p) => p.passes))}`,
      `Repair ≈ ${actionsSaid(sum((p) => p.repairGoes))}`, `≈ ${clockSaid(sum((p) => p.secs))}`,
    ], 'mend-sum');
    const head = plans[0];
    il.append(this.button('Improve all', head ? `${plans.length} items in turn: Improve × ${count} each, Repair when damage is over ${IMPROVE_DAMAGE}` : 'No item Improve takes now.',
      !head || !improve || !repair, () => {
        if (!head || !improve || !repair) return;
        this.used = new Map();
        const t = { kind: 'item', uid: head.it.uid, mend: true, all: plans.length, cycles: count, ...(upto !== undefined ? { upto } : {}) } as Target;
        if (head.first) g.requestAction(repair, t, head.first.goes);
        else g.requestAction(improve, t, count);
      }, 'mend-go'));
    box.append(il);
    // What it will use, kind by kind, against what is at hand: a kind it uses all of stops the run there.
    const will = willUse(g, plans);
    if (will.length) {
      box.append(this.row([`Will use: ${will.map((w) => `${lockSaid(w.lock)} ×${w.passes} (held ${w.held}${w.passes >= w.held ? ': stops when out' : ''})`).join(' · ')}`], 'mend-dim'));
    }
    // What the last one used, pass by pass.
    if (this.used) {
      const said = [...this.used].map(([name, n]) => `${name} ×${n}`).join(' · ');
      box.append(this.row([`Used, last Improve all: ${said || 'nothing yet'}`], 'mend-dim mend-used'));
    }
    box.append(this.cycleInputs(true));
  }

  /** Cycles and Target QL: one value each, for Improve all and the piece's own run. */
  private cycleInputs(all: boolean): HTMLDivElement {
    const inputs = this.row([], 'mend-dim');
    const num = (label: string, value: string, min: number, max: number, step: number, set: (v: string) => void, title: string, key: string): void => {
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
      i.className = 'mend-input rc-field';
      i.dataset.mendFocus = `${key}:${all ? 'all' : 'one'}`;
      i.addEventListener('keydown', (e) => e.stopPropagation());
      i.addEventListener('change', () => {
        set(i.value);
        this.repaint.force();
        this.render();
      });
      l.append(i);
      inputs.append(l);
    };
    const count = Math.max(1, Math.min(JOB_GOES_MOST, Math.floor(this.cycles)));
    num(all ? 'Cycles an item' : 'Cycles', String(count), 1, JOB_GOES_MOST, 1, (v) => { this.cycles = Number(v) || 1; }, `Improve passes${all ? ' an item' : ''}, 1 to ${JOB_GOES_MOST}`, 'cycles');
    num('Target QL', this.upto === null ? '' : String(this.upto), 1, 100, 1, (v) => { this.upto = v.trim() === '' ? null : Math.max(1, Math.min(100, Number(v))); }, 'Blank: none', 'upto');
    return inputs;
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

  private repairSection(rows: Item[], on: number | null): void {
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
      const table = this.table(box, ['Item', 'QL', 'Damage', 'Repair to 0', '']);
      const whet = whetstonesHeld(g);
      for (const it of rows) {
        const tr = document.createElement('tr');
        if (it.uid === on) tr.className = 'mend-chosen rc-on';
        const said = `${itemName(it)}${g.isEquipped(it.uid) ? ' (worn)' : ''}`;
        const name = this.cell(tr, said, 'mend-name');
        if (canImprove(it.id)) {
          name.classList.add('mend-pick');
          name.title = 'Show in Improve';
          name.tabIndex = 0;
          name.setAttribute('role', 'button');
          name.setAttribute('aria-pressed', String(it.uid === on));
          name.dataset.mendFocus = `name:${it.uid}`;
          name.addEventListener('click', () => this.show(it.uid));
          name.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            this.show(it.uid);
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
  }

  /* ---- improve -------------------------------------------------------------------------------------- */

  /** The kind a piece is held to: the one chosen for its material where it takes it, else the first it would draw. */
  private lockFor(it: Item): StockLock | null {
    const kinds = stockKinds(this.game, it);
    const want = this.locks.get(improvable(it.id, it.extra)?.material.id ?? '');
    return (kinds.find((k) => lockKey(k.lock) === want) ?? kinds[0])?.lock ?? null;
  }

  private improveSection(pieces: Item[], it: Item | undefined): void {
    const g = this.game;
    const box = this.section('Improve', 'mend-improve');
    if (!it) {
      box.append(this.row(['No held item Improve takes.'], 'mend-dim'));
      return;
    }
    const what = improvable(it.id, it.extra);
    if (!what) return;

    const pick = document.createElement('select');
    pick.className = 'panel-select rc-field mend-select';
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
    this.cyclesSection(it);
  }

  /** Kinds of stock, a radio each for the one a run is held to (for this material). */
  private kindsTable(box: HTMLElement, mat: string, kinds: Array<{ lock: StockLock; carried: number; stored: number; takes: string }>, on: string, several: boolean): void {
    const table = this.table(box, several ? ['', 'Kind', 'Carried', 'In reach', 'Pieces'] : ['', 'Kind', 'Carried', 'In reach', 'Passes']);
    for (const k of kinds) {
      const tr = document.createElement('tr');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'rc-check';
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

  private cyclesSection(piece: Item): void {
    const g = this.game;
    const box = this.section('Improve and repair cycles', 'mend-cycles');
    const improve = ACTION_BY_ID.get('improve_item');
    const repair = ACTION_BY_ID.get('repair_item');
    const count = Math.max(1, Math.min(JOB_GOES_MOST, Math.floor(this.cycles)));
    const upto = this.upto ?? undefined;
    box.append(this.cycleInputs(false));

    const [one] = piecePlans(g, [piece], (it) => this.lockFor(it), count, upto);
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

    // The queue: the run is one job (`pieceJob`).
    const room = queueRoom(g);
    const job = one.jobs > 0 ? pieceJob(one, count, upto) : null;
    const def = job ? (job.action === 'repair_item' ? repair : improve) : undefined;
    const why = one.why ?? (!job ? 'No piece to improve.' : room < 1 ? `Action queue full: ${g.queueCapacity()}.` : null);
    const first = one.first;
    const label = `Queue ${count} ${count === 1 ? 'cycle' : 'cycles'}`;
    const title = why ?? `${first ? `Repair × ${first.goes}, then ` : ''}Improve × ${count}, Repair when damage is over ${IMPROVE_DAMAGE}`;
    const go = this.row([]);
    const b = this.button(label, title, !!why || !def, () => {
      if (job && def) void g.requestInTurn([{ def, target: job.target, goes: job.goes }]);
    }, 'mend-go rc-go');
    b.dataset.mendFocus = 'queue';
    go.append(b);
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
    h.className = 'skill-group rc-section mend-head';
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
    wide.className = 'mend-wide rc-wide';
    host.append(wide);
    host = wide;
    const t = document.createElement('table');
    t.className = `mend-table rc-table ${cls}`.trim();
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
    b.className = `tb-btn rc-btn tb-small ${cls}`.trim();
    b.textContent = text;
    b.title = title;
    b.disabled = disabled;
    b.addEventListener('click', go);
    return b;
  }
}
