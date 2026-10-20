import type { Game } from '../../game/game';
import type { Island } from '../../net/island';
import {
  BARTER_IDLE, BARTER_MOST, BARTER_REACH, BARTER_REFRESH, barterPutRefusal, barterSaid, sideWords, type Barter, type BarterSide, type BarterThing,
} from '../../game/barter';
import { itemName, type Item } from '../../game/items';
import { purse } from '../../game/money';
import { makeDropZone } from '../dragdrop';
import type { UIWindow } from '../windows';

/**
 * The Trade window: two columns, what you give and what they give, each a
 * list of things and a sum of silver, and an Accept under each.
 *
 * Nothing about the trade is decided here. The island holds it (`barter.ts`,
 * `rpc_barter`), and this window draws what the island last said, sends your
 * side whole whenever you change it, and asks again whenever the island says
 * the trade changed (Broadcast `barter`) and every few seconds besides, which
 * is also what lets the island notice two people who have walked apart.
 *
 * Things go onto your side by dragging them out of the Inventory window, or
 * by picking one from the list under your column; a stack may go in part.
 * Coins go in as a sum, from the box under it.
 */
export class BarterPanel {
  private readonly page: HTMLDivElement;
  private shown: Barter | null = null;
  /** Why the last trade ended, when it has just ended, said where the trade was. */
  private ended = '';
  private asking = false;
  private clock = 0;
  /** When `update` last ran, in seconds. */
  private last = 0;
  /** Seconds before the trade lapses, counted down here between asks. */
  private left = 0;
  /** The thing picked in the list under your side, and how many of it. */
  private pick = 0;
  private count = 1;

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly island: Island | null,
  ) {
    win.body.classList.add('skills-body');
    this.page = document.createElement('div');
    this.page.className = 'barter-page';
    win.body.append(this.page);
    win.onOpen = () => void this.refresh();
    if (island) {
      // Told by the island that a trade of ours changed, or that somebody asks: look again, and show the window.
      island.hooks.barter = () => void this.refresh(true);
      // And once at the start, for a trade standing from before a reload.
      void this.refresh(true);
    }
    this.draw();
  }

  /** Ask somebody to trade, from their menu or the Social window. */
  async ask(uid: string): Promise<void> {
    if (!this.island) return;
    const why = await this.island.barterAsk(uid);
    if (why) this.game.logMsg(why, 'error');
    await this.refresh(true);
  }

  /** Asked again while a trade stands, and counted down in between. `now` in seconds. */
  update(now: number): void {
    const dt = this.last ? Math.min(1, Math.max(0, now - this.last)) : 0;
    this.last = now;
    if (!this.island || !this.shown) return;
    this.left = Math.max(0, this.left - dt);
    this.clock += dt;
    if (this.clock < BARTER_REFRESH) return;
    this.clock = 0;
    void this.refresh();
  }

  /** Ask the island for the trade. `show`: open the window when there is one. */
  private async refresh(show = false): Promise<void> {
    if (!this.island || this.asking) return;
    this.asking = true;
    let got: Awaited<ReturnType<Island['barter']>>;
    try {
      got = await this.island.barter();
    } finally {
      this.asking = false;
    }
    if (!got) return;
    const was = this.shown;
    this.shown = got.barter;
    this.clock = 0;
    if (got.barter) {
      this.ended = '';
      this.left = got.barter.left;
      if (show && !this.win.isOpen) this.win.open();
    } else if (got.why) {
      this.ended = got.why;
    } else if (was) {
      // Ended by a door this browser did not open: the log has the line, the window says it is over.
      this.ended = this.ended || barterSaid('over');
    }
    // A change to the trade is drawn at once, even over a box being typed in; the same trade again only when nobody is typing.
    if (keyOf(was) !== keyOf(this.shown) || !this.typing()) this.draw();
  }

  /** Whether somebody is typing into one of this window's boxes, or choosing from its list, which a redraw would take from under them. */
  private typing(): boolean {
    const el = document.activeElement;
    return (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && this.page.contains(el);
  }

  private async act(go: Promise<string | null>): Promise<void> {
    const why = await go;
    if (why) this.game.logMsg(why, 'error');
    await this.refresh();
    this.draw();
  }

  // -- drawing ----------------------------------------------------------------

  private draw(): void {
    this.page.replaceChildren();
    if (!this.island) {
      this.note('Trading: island only.');
      return;
    }
    const b = this.shown;
    if (!b) {
      if (this.ended) this.note(this.ended, 'barter-ended');
      this.note(`No trade open. Start one: right-click a player, or Trade in the Social window. Range: ${BARTER_REACH} tiles.`);
      return;
    }
    const them = b.theirs.name;
    if (b.state === 'asked') {
      if (b.asker) {
        this.note(`Trade request sent to ${them}. Waiting.`);
        this.bar(this.button('Cancel', 'Withdraw request', () => void this.act(this.island!.barterCancel(b.n))));
      } else {
        this.note(`Trade request from ${them}.`);
        this.bar(
          this.button('Trade', `Open trade with ${them}`, () => void this.act(this.island!.barterAnswer(b.n, true))),
          this.button('No', `Turn ${them} down`, () => void this.act(this.island!.barterAnswer(b.n, false))),
        );
      }
      this.footer(b);
      return;
    }

    const cols = document.createElement('div');
    cols.className = 'barter-cols';
    cols.append(this.column('You give', b.mine, true, b), this.column(`${them} gives`, b.theirs, false, b));
    this.page.append(cols);

    const accept = this.button(b.mine.ok ? 'Accepted' : 'Accept',
      b.mine.ok ? `Waiting for ${them}` : `Accept: get ${sideWords(b.theirs)} for ${sideWords(b.mine)}`,
      () => void this.act(this.island!.barterAccept(b.n, b.rev)));
    accept.disabled = b.mine.ok;
    accept.classList.add('barter-accept');
    this.bar(accept, this.button('Cancel', 'Cancel the trade. Nothing changes hands.', () => void this.act(this.island!.barterCancel(b.n))));
    this.note(b.mine.ok && b.theirs.ok ? '' : b.mine.ok ? `Accepted. Waiting for ${them}.`
      : b.theirs.ok ? `${them} accepted.` : 'Not accepted. Any change resets both Accepts.',
    'barter-status');
    this.footer(b);
  }

  /** One side: its things, its silver and whether it has accepted; on yours, the ways to change it. */
  private column(title: string, side: BarterSide, mine: boolean, b: Barter): HTMLDivElement {
    const col = document.createElement('div');
    col.className = `barter-col${side.ok ? ' barter-ok' : ''}`;
    const head = document.createElement('div');
    head.className = 'deed-head barter-head';
    head.textContent = side.ok ? `${title} · accepted` : title;
    col.append(head);
    const list = document.createElement('div');
    list.className = 'barter-list';
    if (!side.things.length) list.append(this.line('No things.', 'barter-none'));
    for (const t of side.things) {
      const row = document.createElement('div');
      row.className = `barter-thing${t.has < t.count ? ' barter-gone' : ''}`;
      const name = document.createElement('span');
      name.className = 'barter-name';
      name.textContent = `${t.count > 1 ? `${t.count} × ` : ''}${thingName(t)}`;
      name.title = t.has < t.count ? 'Not enough in pack: trade refused while listed.' : `QL ${t.ql.toFixed(1)}`;
      row.append(name);
      if (mine) {
        row.append(this.button('×', `Remove ${thingName(t).toLowerCase()}`,
          () => void this.send(b, side.things.filter((x) => x.id !== t.id).map((x) => ({ id: x.id, count: x.count })), side.coins)));
      }
      list.append(row);
    }
    col.append(list);
    col.append(this.line(`Silver: ${side.coins}`, 'barter-coins'));
    if (!mine) return col;

    // Let go of a thing from the Inventory window here, and the whole stack goes on.
    makeDropZone(col, (p) => p.from === 'inventory', (p) => {
      const it = this.game.inventory.get(p.uid);
      if (it) void this.put(b, it, it.count);
    });
    col.append(this.adder(b, side));
    return col;
  }

  /** Under your side: a thing from your pack and how many, and the silver. */
  private adder(b: Barter, side: BarterSide): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'barter-add';
    const on = new Set(side.things.map((t) => t.id));
    // What may go: not coins, which go by the sum, nor anything worn, held or kept back, which the island refuses.
    const pack = this.game.inventory.items.filter((it) => it.id !== 'coin' && !it.locked && !this.game.isEquipped(it.uid) && !on.has(it.uid));
    if (!pack.some((it) => it.uid === this.pick)) {
      this.pick = pack[0]?.uid ?? 0;
      this.count = pack[0]?.count ?? 1;
    }
    const sel = document.createElement('select');
    sel.className = 'panel-select barter-pick';
    sel.title = 'Item from your pack, or drag from Inventory';
    for (const it of pack) {
      const o = document.createElement('option');
      o.value = String(it.uid);
      o.textContent = it.count > 1 ? `${itemName(it)} (${it.count})` : itemName(it);
      sel.append(o);
    }
    sel.value = String(this.pick);
    const n = document.createElement('input');
    n.type = 'number';
    n.min = '1';
    n.className = 'panel-select barter-count';
    n.title = 'Count';
    n.value = String(this.count);
    sel.addEventListener('change', () => {
      this.pick = Number(sel.value);
      this.count = this.game.inventory.get(this.pick)?.count ?? 1;
      n.value = String(this.count);
    });
    n.addEventListener('input', () => (this.count = Math.max(1, Math.floor(Number(n.value) || 1))));
    const add = this.button('Add', `Add to your side. Max ${BARTER_MOST} things per side.`, () => {
      const it = this.game.inventory.get(this.pick);
      if (it) void this.put(b, it, Math.min(this.count, it.count));
    });
    add.disabled = !pack.length || side.things.length >= BARTER_MOST;
    const row1 = document.createElement('div');
    row1.className = 'barter-row';
    if (pack.length) row1.append(sel, n, add);
    else row1.append(this.line('Nothing else tradeable: coins go as silver; worn, held or kept-back items excluded.', 'barter-none'));

    const coins = document.createElement('input');
    coins.type = 'number';
    coins.min = '0';
    coins.className = 'panel-select barter-silver';
    coins.value = String(side.coins);
    const have = purse(this.game.inventory.items);
    coins.title = `Silver to give (have ${have}).`;
    const set = this.button('Set silver', `Silver to give (have ${have}).`,
      () => void this.send(b, side.things.map((t) => ({ id: t.id, count: t.count })), Math.max(0, Math.floor(Number(coins.value) || 0))));
    coins.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') set.click();
    });
    const row2 = document.createElement('div');
    row2.className = 'barter-row';
    row2.append(coins, set);
    box.append(row1, row2);
    return box;
  }

  /** Put a thing on your side, refused here first in the island's words where the browser can already see why. */
  private async put(b: Barter, it: Item, count: number): Promise<void> {
    const why = barterPutRefusal(it, this.game.isEquipped(it.uid), count, b.mine.name);
    if (why) {
      this.game.logMsg(why, 'error');
      return;
    }
    const things = b.mine.things.filter((t) => t.id !== it.uid).map((t) => ({ id: t.id, count: t.count }));
    things.push({ id: it.uid, count });
    await this.send(b, things, b.mine.coins);
  }

  private async send(b: Barter, things: Array<{ id: number; count: number }>, coins: number): Promise<void> {
    if (!this.island) return;
    await this.act(this.island.barterOffer(b.n, things, coins));
  }

  private footer(b: Barter): void {
    this.note(`Distance ${b.apart} tiles (cancels past ${BARTER_REACH}). `
      + `Lapses after ${BARTER_IDLE} s idle: ${Math.ceil(this.left)} s left.`, 'barter-foot');
  }

  private note(text: string, cls = ''): void {
    if (!text) return;
    this.page.append(this.line(text, `market-note barter-note ${cls}`));
  }

  private line(text: string, cls: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  private bar(...buttons: HTMLButtonElement[]): void {
    const el = document.createElement('div');
    el.className = 'panel-bar barter-bar';
    el.append(...buttons);
    this.page.append(el);
  }

  private button(label: string, title: string, go: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-btn tb-small market-do';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', go);
    return b;
  }
}

/** What about a trade changes what the window shows: its state, its sides and both Accepts. */
const keyOf = (b: Barter | null): string => (b ? `${b.n}:${b.state}:${b.rev}:${b.mine.ok}:${b.theirs.ok}` : '');

/** A thing on a side, named as the pack names it. */
const thingName = (t: BarterThing): string =>
  itemName({ uid: 0, id: t.def, extra: t.extra ?? undefined, ql: t.ql, count: t.count, dmg: t.dmg } as Item);
