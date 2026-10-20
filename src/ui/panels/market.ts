import { LETTER_MAX, type Deal, type Good, type Island, type Occupant, type Order, type Parcel, type Stall } from '../../net/island';
import type { Enchant } from '../../game/enchant';
import type { Game } from '../../game/game';
import { billWords, ITEM_DEFS, itemDef, itemName, RARITIES, type Item } from '../../game/items';
import { dailyEach, SALE_DAYS, silverEach, summarise, type Prices, type SaleDay, type SaleSummary } from '../../game/prices';
import { furnitureDef } from '../../game/furniture';
import { SPECIES } from '../../game/creatures';
import { priceWords, purse } from '../../game/money';
import { couldBring, ORDER_LIFE, orderWords } from '../../game/orders';
import { awayFor } from '../../game/away';
import { COUNTER_BUY_FROM, sellsTooFar } from '../../game/counters';
import { durationSaid } from '../../game/boons';
import type { UIWindow } from '../windows';

/** How often the window asks again while it is open. */
const REFRESH = 5;

/**
 * Where goods change hands.
 *
 * Coins have existed since there was an anvil to strike them on and have
 * never bought anything, because there was nothing to buy them with and
 * nobody to buy from. Five tabs, because they answer five different
 * questions:
 *
 *   **Board** — what is for sale anywhere on the island, and what is wanted.
 *   Every stall, where it stands, what is on it and for how much, read at a
 *   settlement token or a mailbox, and a Buy for each, which goes through
 *   when you stand at that stall's counter; and every buy order, with a Fill
 *   for each, which goes through there and then.
 *
 *   **Orders** — what you want and nobody has put out. Your own buy orders,
 *   wherever you are, to take back; and putting one up, at a token or a
 *   mailbox.
 *
 *   **Deals** — two people standing together. An offer with its terms written
 *   down, held out of the offerer's pack while it stands, taken or turned
 *   down whole. Not a live two-window negotiation: the terms you read are the
 *   terms that execute, which is the property the ready-flag dance in every
 *   other game exists to fake.
 *
 *   **Stall** — for when you are not there. Lay goods out, put a price on
 *   each, and it sells while you are asleep; the coins wait in the till.
 *
 *   **Post** — for when neither of you is. A parcel in at one mailbox and out
 *   at any other.
 *
 * Nothing here works in the game you play by yourself, and the window says so
 * rather than showing empty tabs: there is one person in that game and none
 * of these is a thing you do alone.
 *
 * A creature crate with a wildermon in it goes everywhere the rest do: into a
 * deal, onto a stall, into the post. Whoever it goes to keeps the wildermon.
 */
/**
 * A month of what one thing sold for, as an inline drawing: a bar a day,
 * oldest on the left, each as tall as that day's average price of one against
 * the dearest day's. A hover on a bar says the day, how many and the price.
 */
function priceChart(days: readonly SaleDay[]): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 120, H = 26, gap = 1;
  const each = dailyEach(days);
  const top = Math.max(1, ...each.map((v) => v ?? 0));
  const bw = (W - gap * (SALE_DAYS - 1)) / SALE_DAYS;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.classList.add('price-chart');
  const byAgo = new Map(days.map((d) => [d.ago, d]));
  each.forEach((v, i) => {
    const x = i * (bw + gap);
    const ago = SALE_DAYS - 1 - i;
    const r = document.createElementNS(NS, 'rect');
    const h = v === null ? 1.5 : Math.max(2, (v / top) * (H - 2));
    r.setAttribute('x', x.toFixed(2));
    r.setAttribute('y', (H - h).toFixed(2));
    r.setAttribute('width', bw.toFixed(2));
    r.setAttribute('height', h.toFixed(2));
    r.setAttribute('rx', '1');
    r.setAttribute('class', v === null ? 'price-bar-none' : 'price-bar');
    const d = byAgo.get(ago);
    const t = document.createElementNS(NS, 'title');
    t.textContent = `${ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`}: ${d ? `${d.n} sold, ${silverEach(d.silver / d.n)} silver each on average` : 'none sold'}`;
    r.append(t);
    svg.append(r);
  });
  return svg;
}

type Tab = 'board' | 'prices' | 'orders' | 'deals' | 'stall' | 'post';
export class MarketPanel {
  private readonly bar: HTMLDivElement;
  private readonly page: HTMLDivElement;
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private tab: Tab = 'board';
  private deals: Deal[] = [];
  private market: { board: boolean; stalls: Stall[] } = { board: false, stalls: [] };
  private orders: { board: boolean; orders: Order[] } = { board: false, orders: [] };
  /** What everything has sold for on the island in the last month (`rpc_prices`), read when the window is and once at the start. */
  prices: Prices = {};
  /** The order being written: the name of what is wanted, the least quality, how many and the silver for each. */
  private wanted = { name: '', ql: 0, count: 1, price: 1 };
  /** How many somebody has typed that they will bring to an order, by the order's number. */
  private readonly bringing = new Map<number, number>();
  /** What is ticked to go in a parcel, by item uid, and the note that goes with it. */
  private readonly posting = new Set<number>();
  private note = '';
  private waiting: { at_box: boolean; things: Parcel[] } = { at_box: false, things: [] };
  private asking = false;
  private clock = 0;
  /** What is ticked to go into an offer, by item uid. */
  private readonly picked = new Set<number>();
  private want = 0;

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly island: Island | null,
    /** Somebody to offer to: the social window's list, so there is one roll. */
    private readonly folk: () => Array<{ uid: string; name: string }>,
  ) {
    win.body.classList.add('skills-body');
    this.bar = document.createElement('div');
    this.bar.className = 'log-tabs market-tabs';
    for (const [id, label, title] of [
      ['board', 'Board', 'All stalls and buy orders; read at a settlement token or mailbox'],
      ['prices', 'Prices', `Sale prices, last ${SALE_DAYS} days`],
      ['orders', 'Orders', 'Your buy orders; place one'],
      ['deals', 'Deals', 'Offers sent and received'],
      ['stall', 'Stall', 'Your stall goods and takings'],
      ['post', 'Post', 'Parcels at mailboxes'],
    ] as Array<[Tab, string, string]>) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small log-tab' + (id === this.tab ? ' tb-on' : '');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      this.bar.append(b);
    }
    this.page = document.createElement('div');
    this.page.className = 'market-page';
    win.body.append(this.bar, this.page);
    win.onOpen = () => void this.refresh();
    this.draw();
    // Once at the start, so a thing in the pack can say what its like went for before the window is ever opened.
    if (island) void island.prices().then((p) => (this.prices = p));
  }

  /** Open on the Stall tab, where your stalls' and counters' goods are priced. */
  openStall(): void {
    this.show('stall');
    this.win.open();
  }

  private show(id: Tab): void {
    this.tab = id;
    for (const [key, el] of this.tabs) el.classList.toggle('tb-on', key === id);
    this.draw();
    this.win.body.scrollTop = 0;
  }

  /** Asked again while the window is open, and not at all while it is shut. */
  update(dt: number): void {
    if (!this.win.isOpen || !this.island) return;
    this.clock += dt;
    if (this.clock < REFRESH) return;
    this.clock = 0;
    void this.refresh();
  }

  /**
   * Asked again, and drawn again -- but not over somebody typing. An order is
   * four boxes filled in one after another, and a window that redrew itself
   * every few seconds took the box away from under the hand typing into it.
   * What was typed is kept either way; a press of a button draws regardless.
   */
  private async refresh(force = false): Promise<void> {
    if (!this.island || this.asking) return;
    this.asking = true;
    try {
      this.deals = await this.island.deals();
      this.waiting = await this.island.waiting();
      this.market = await this.island.market();
      this.orders = await this.island.orders();
      this.prices = await this.island.prices();
    } finally {
      this.asking = false;
    }
    if (force || !this.typing()) this.draw();
  }

  /** Whether one of this window's boxes has somebody typing into it. */
  private typing(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'number') && this.page.contains(el);
  }

  private async act(go: Promise<string | null>): Promise<void> {
    const why = await go;
    if (why) this.game.logMsg(why, 'error');
    this.clock = REFRESH;
    await this.refresh(true);
  }

  private draw(): void {
    this.page.replaceChildren();
    if (!this.island) {
      this.say('Market: island only (board, buy orders, deals, stalls, post).');
      return;
    }
    if (this.tab === 'board') this.drawBoard();
    else if (this.tab === 'prices') this.drawPrices();
    else if (this.tab === 'orders') this.drawOrders();
    else if (this.tab === 'deals') this.drawDeals();
    else if (this.tab === 'stall') this.drawStall();
    else this.drawPost();
  }

  /**
   * Every thing sold on the island in the month, most sold first: how many,
   * the cheapest and dearest one and the average, and a bar a day of what one
   * fetched, oldest on the left. Read wherever you stand, unlike the board:
   * what things go for is common knowledge.
   */
  private drawPrices(): void {
    const rows = Object.entries(this.prices)
      .map(([def, days]) => ({ def, days, s: summarise(days) }))
      .filter((r): r is { def: string; days: SaleDay[]; s: SaleSummary } => !!r.s)
      .sort((a, b) => b.s.n - a.s.n || itemDef(a.def).name.localeCompare(itemDef(b.def).name));
    if (!rows.length) {
      this.say(`No sales in the last ${SALE_DAYS} days.`);
      return;
    }
    this.say(`Stall, counter and buy-order sales, last ${SALE_DAYS} days. One bar per day, oldest left; height: that day's price vs its highest; gap: no sale.`);
    for (const { def, days, s } of rows) {
      const row = document.createElement('div');
      row.className = 'price-row';
      const name = document.createElement('div');
      name.className = 'price-name';
      name.textContent = itemDef(def).name;
      const said = document.createElement('small');
      said.textContent = `${s.n} sold · ${s.lo === s.hi ? `${silverEach(s.lo)} silver each` : `${silverEach(s.lo)}–${silverEach(s.hi)} silver each, ${silverEach(s.each)} on average`}`
        + ` · last ${s.last === 0 ? 'today' : s.last === 1 ? 'yesterday' : `${s.last} days ago`}`;
      name.append(said);
      row.append(name, priceChart(days));
      this.page.append(row);
    }
  }

  private say(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'skill-note market-note';
    el.textContent = text;
    this.page.append(el);
    return el;
  }

  private head(text: string): void {
    const el = document.createElement('div');
    el.className = 'skill-group';
    el.textContent = text;
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

  /** A row's words: what it is, and smaller under it, anything more. */
  private lines(main: string, more = ''): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'market-what';
    el.textContent = main;
    if (more) {
      const small = document.createElement('small');
      small.textContent = more;
      el.append(small);
    }
    return el;
  }

  /** A row of the board or a stall: what, its price in a column of its own, and what to do. */
  private good(what: HTMLElement, cost: HTMLElement | string, ...acts: HTMLElement[]): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'skill-row market-good';
    const price = typeof cost === 'string' ? Object.assign(document.createElement('span'), { textContent: cost }) : cost;
    price.classList.add('market-cost');
    const doing = document.createElement('span');
    doing.className = 'market-acts';
    doing.append(...acts);
    row.append(what, price, doing);
    return row;
  }

  /** A stall's heading: whose and what, and under it, smaller, where and how far. */
  private place(title: string, where: string): void {
    this.head(title);
    const el = document.createElement('div');
    el.className = 'market-where';
    el.textContent = where;
    this.page.append(el);
  }

  /** What a deal is, in one line: the goods, and the coins one way or the other. */
  private terms(d: Deal): string {
    const things = d.things.map((t) => (t.count > 1 ? `${t.count} × ${nameOf(t)}` : nameOf(t)));
    const coins = d.want > 0 ? `for ${priceWords(d.want)}`
      : d.give > 0 ? `and ${priceWords(d.give)} with it` : 'for nothing';
    return `${things.length ? things.join(', ') : 'nothing'} ${coins}`;
  }

  private drawDeals(): void {
    const mine = this.deals.filter((d) => d.mine);
    const theirs = this.deals.filter((d) => !d.mine);
    this.head('Received');
    if (!theirs.length) this.say('None. Offers stand until taken or refused.');
    for (const d of theirs) {
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      row.append(this.lines(this.terms(d), `from ${d.who}`),
        this.button('Accept', 'Both must stand together', () => void this.act(this.island!.answerDeal(d.n, true))),
        this.button('Refuse', 'Refuse; everything returns', () => void this.act(this.island!.answerDeal(d.n, false))));
      this.page.append(row);
    }

    this.head('Sent');
    if (!mine.length) this.say('None.');
    for (const d of mine) {
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      row.append(this.lines(this.terms(d), `to ${d.who}`), this.button('Withdraw', 'Everything held returns', () => void this.act(this.island!.answerDeal(d.n, false))));
      this.page.append(row);
    }

    /*
     * And making one. Tick what is going, name what is wanted for it, choose
     * who — in that order, because that is the order somebody thinks in.
     */
    this.head('New offer');
    const people = this.folk();
    if (!people.length) {
      this.say('No contacts. Fellow citizens and letter contacts can receive offers.');
      return;
    }
    this.pick(this.picked, 'Offer');

    const bar = document.createElement('div');
    bar.className = 'panel-bar market-bar';
    const price = document.createElement('input');
    price.type = 'number';
    price.min = '0';
    price.className = 'panel-select market-price';
    price.value = String(this.want);
    price.title = 'Silver asked. 0: gift.';
    price.addEventListener('input', () => (this.want = Math.max(0, Number(price.value) || 0)));
    const who = document.createElement('select');
    who.className = 'panel-select market-who';
    who.title = 'Recipient';
    for (const f of people) {
      const o = document.createElement('option');
      o.value = f.uid;
      o.textContent = f.name;
      who.append(o);
    }
    bar.append(field('silver wanted', price), field('to', who), this.button('Offer', 'Terms fixed once sent', () => {
      const items = [...this.picked];
      this.picked.clear();
      void this.act(this.island!.offer(who.value, items, this.want, 0));
    }));
    this.page.append(bar);
    this.say(`Carried: ${priceWords(purse(this.game.inventory.items))}.`);
  }

  private drawStall(): void {
    /*
     * A stall is a piece of furniture, so what is on it is already the store
     * window's business. What belongs here is the price on each thing and the
     * till underneath, which is the part no other window has a place for --
     * and they come from the island, which keeps them, for your own stalls
     * wherever you stand.
     */
    const stalls = this.market.stalls.filter((st) => st.mine);
    if (!stalls.length) {
      this.say(`No stall. Build one: ${billWords(furnitureDef('stall').bill, true)}.`);
      return;
    }
    for (const st of stalls) {
      this.head(`${st.what === 'counter' ? 'Shop counter' : 'Stall'} at ${st.x},${st.y}${st.deed ? ` on ${st.deed}` : ''}`);
      const till = st.till ?? 0;
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      const text = document.createElement('span');
      text.className = 'market-what';
      text.textContent = till > 0 ? `Till: ${priceWords(till)}.` : 'Till empty.';
      row.append(text);
      if (till > 0) row.append(this.button('Collect takings', sellsTooFar(st.what === 'counter' ? 'counter' : 'stall'), () => void this.act(this.island!.takings(st.id))));
      this.page.append(row);
      if (!st.goods.length) this.say('Counter empty. Add goods, then set prices.');
      for (const good of st.goods) {
        const box = document.createElement('input');
        box.type = 'number';
        box.min = '0';
        box.className = 'panel-select market-price';
        box.value = String(good.price ?? 0);
        box.title = 'Silver price. 0: off sale.';
        box.setAttribute('aria-label', `Silver for ${goodName(good)}`);
        const unit = document.createElement('label');
        unit.className = 'market-field';
        unit.append(box, 'silver');
        this.page.append(this.good(this.lines(goodName(good), good.price ? `on sale at ${priceWords(good.price)}` : 'not for sale'), unit,
          this.button('Set', '0: off sale', () => void this.act(this.island!.setPrice(good.id, Math.max(0, Number(box.value) || 0))))));
      }
    }
  }

  /**
   * Everything for sale on the island, stall by stall, nearest first, and
   * then everything wanted, order by order, oldest first. It is read at a
   * settlement token or a mailbox; buying is done at the stall, whose counter
   * you have to be standing at when you press Buy, and filling an order is
   * done where you stand.
   */
  private drawBoard(): void {
    if (!this.market.board) {
      this.say('Board: stand at a settlement token or mailbox.');
      return;
    }
    const me = this.game.player;
    const theirs = this.market.stalls
      .filter((st) => !st.mine && st.goods.length)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    if (!theirs.length) this.say('Nothing for sale.');
    for (const st of theirs) {
      const far = Math.round(Math.hypot(st.x + 0.5 - me.x, st.y + 0.5 - me.y));
      this.place(`${st.owner}'s ${st.what === 'counter' ? 'shop counter' : 'stall'}`,
        `${st.x},${st.y}${st.deed ? ` on ${st.deed}` : ''} · ${far} ${far === 1 ? 'tile' : 'tiles'} away`);
      for (const good of st.goods) {
        this.page.append(this.good(this.lines(goodName(good)), priceWords(good.price ?? 0),
          this.button('Buy', st.what === 'counter' ? COUNTER_BUY_FROM : sellsTooFar('stall'), () => void this.act(this.island!.buy(good.id)))));
      }
    }
    this.drawWanted();
    this.say(`Carried: ${priceWords(purse(this.game.inventory.items))}. Your stalls: Stall tab. Your orders: Orders tab.`);
  }

  /**
   * Everybody else's buy orders, and a Fill for each that you have something
   * for: how many of yours will do is counted off your pack the way the
   * island counts it, and the box starts at as many as it can take.
   */
  private drawWanted(): void {
    this.head('Wanted');
    const theirs = this.orders.orders.filter((o) => !o.mine);
    if (!theirs.length) this.say('No orders.');
    for (const o of theirs) {
      const left = o.want - o.got;
      const have = couldBring(this.game.inventory.items, o, (uid) => this.game.isEquipped(uid));
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      row.append(this.lines(`${orderWords(o.def, left, o.ql)} at ${priceWords(o.price)} each`,
        `${o.who}'s order at ${o.x},${o.y}${o.deed ? ` on ${o.deed}` : ''}. `
        + `You have: ${have}.`));
      if (have) {
        const most = Math.min(have, left);
        const box = document.createElement('input');
        box.type = 'number';
        box.min = '1';
        box.max = String(most);
        box.className = 'panel-select market-count';
        box.value = String(Math.min(this.bringing.get(o.n) ?? most, most));
        box.title = 'Count to bring';
        box.setAttribute('aria-label', 'Count to bring');
        box.addEventListener('input', () => this.bringing.set(o.n, Math.max(1, Math.floor(Number(box.value) || 1))));
        row.append(box, this.button('Fill',
          `Paid ${priceWords(o.price)} each at once; goods go to ${o.who} by post`,
          () => {
            const n = Math.max(1, Math.floor(Number(box.value) || 1));
            this.bringing.delete(o.n);
            void this.act(this.island!.fillOrder(o.n, n));
          }));
      }
      this.page.append(row);
    }
  }

  /**
   * Your own buy orders, wherever you are, each with what it still holds and
   * how long it has left; and putting one up, which is done at a settlement
   * token or a mailbox, where the board is read.
   */
  private drawOrders(): void {
    this.head('Your orders');
    const mine = this.orders.orders.filter((o) => o.mine);
    if (!mine.length) this.say('None.');
    for (const o of mine) {
      const left = o.want - o.got;
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      row.append(this.lines(`${orderWords(o.def, left, o.ql)} at ${priceWords(o.price)} each`,
        `${o.got ? `${o.got}/${o.want} brought. ` : ''}${priceWords(left * o.price)} held, lapses in ${awayFor(o.left)}.`), this.button('Withdraw', `${priceWords(left * o.price)} returned to your purse`,
        () => void this.act(this.island!.cancelOrder(o.n))));
      this.page.append(row);
    }

    this.head('New order');
    if (!this.orders.board) {
      this.say('Need a settlement token or mailbox.');
      return;
    }
    // What it would hold, said under the boxes and said again as they change.
    const held = document.createElement('div');
    held.className = 'skill-note market-note';
    held.textContent = this.holds();
    const form = document.createElement('div');
    form.className = 'panel-bar market-order';
    const list = kindList();
    const kind = document.createElement('input');
    kind.type = 'text';
    kind.className = 'panel-select market-kind';
    kind.placeholder = 'Item wanted';
    kind.title = 'Any material of this kind accepted';
    kind.setAttribute('list', list.id);
    kind.value = this.wanted.name;
    kind.addEventListener('input', () => (this.wanted.name = kind.value));
    const box = (value: number, least: number, title: string, set: (n: number) => void): HTMLInputElement => {
      const el = document.createElement('input');
      el.type = 'number';
      el.min = String(least);
      el.className = 'panel-select market-count';
      el.value = String(value);
      el.title = title;
      el.addEventListener('input', () => {
        set(Math.max(least, Math.floor(Number(el.value) || least)));
        held.textContent = this.holds();
      });
      return el;
    };
    const ql = box(this.wanted.ql, 0, 'Min QL; 0: any', (n) => (this.wanted.ql = Math.min(100, n)));
    ql.max = '100';
    const count = box(this.wanted.count, 1, 'Count', (n) => (this.wanted.count = n));
    const price = box(this.wanted.price, 1, 'Silver each', (n) => (this.wanted.price = n));
    form.append(kind, field('quality at least', ql), field('how many', count), field('silver each', price),
      this.button('Place order', 'Full price taken from your purse now', () => {
        const def = kindNamed(this.wanted.name);
        if (!def) {
          this.game.logMsg('Unknown item: choose from the list.', 'error');
          return;
        }
        const { ql: least, count: n, price: each } = this.wanted;
        void this.act(this.island!.order(def, n, each, least).then((why) => {
          if (!why) this.wanted = { name: '', ql: 0, count: 1, price: 1 };
          return why;
        }));
      }));
    this.page.append(form, list, held);
  }

  /** What the order being written would hold, and for how long, against what you carry. */
  private holds(): string {
    const { count, price } = this.wanted;
    return `Holds ${priceWords(count * price)} from your purse until filled, withdrawn, `
      + `or lapsed after ${durationSaid(ORDER_LIFE)} (remainder returned). `
      + `Carried: ${priceWords(purse(this.game.inventory.items))}.`;
  }

  /** A tick list of what is in your pack, to offer or to post. A crate with a wildermon in it is on it too. */
  private pick(into: Set<number>, doing: string): void {
    // Nothing put by and no coin: coins go by the number in the box, not by the stack.
    const pack = this.game.inventory.items.filter((it) => !it.locked && it.id !== 'coin');
    const list = document.createElement('div');
    list.className = 'market-pick';
    for (const it of pack.slice(0, PICK_SHOWN)) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = into.has(it.uid);
      box.addEventListener('change', () => {
        if (box.checked) into.add(it.uid);
        else into.delete(it.uid);
      });
      const name = document.createElement('span');
      const occupant = it.creature === undefined ? undefined : this.game.creatures.get(it.creature);
      const named = occupant ? `${itemName(it)} — ${occupant.name}, ${occupant.rare ? `${RARITIES[occupant.rare].name} ` : ''}${speciesName(occupant.species)}` : itemName(it);
      name.textContent = it.count > 1 ? `${named} (${it.count})` : named;
      label.append(box, name);
      list.append(label);
    }
    this.page.append(list);
    if (pack.length > PICK_SHOWN) {
      this.say(`+${pack.length - PICK_SHOWN} more not shown. ${doing}: top of pack only; store the rest first.`);
    }
  }

  private drawPost(): void {
    this.head('Waiting');
    if (!this.waiting.things.length) {
      this.say('No parcels. Send at any mailbox; collect at any mailbox.');
    }
    for (const t of this.waiting.things) {
      const row = document.createElement('div');
      row.className = 'skill-row market-row';
      row.append(this.lines(`${t.count > 1 ? `${t.count} × ` : ''}${nameOf(t)}`, t.from ? `from ${t.from}` : ''));
      this.page.append(row);
    }
    if (this.waiting.things.length) {
      const bar = document.createElement('div');
      bar.className = 'panel-bar';
      bar.append(this.button('Collect all', this.waiting.at_box ? 'Into your pack' : 'Need a mailbox',
        () => void this.act(this.island!.collect())));
      this.page.append(bar);
      if (!this.waiting.at_box) this.say('Collect at any mailbox.');
    }

    /*
     * And sending: tick what goes, write a line with it, choose who. It goes
     * into the post at the mailbox you stand at and is theirs from then on,
     * waiting for them at any mailbox.
     */
    this.head('Send parcel');
    if (!this.waiting.at_box) {
      this.say('Need a mailbox.');
      return;
    }
    const people = this.folk();
    if (!people.length) {
      this.say('No contacts. Fellow citizens and letter contacts can receive parcels.');
      return;
    }
    this.pick(this.posting, 'Send');
    const bar = document.createElement('div');
    bar.className = 'panel-bar market-bar';
    const note = document.createElement('input');
    note.type = 'text';
    note.maxLength = LETTER_MAX;
    note.className = 'panel-select market-note-input';
    note.placeholder = 'Note';
    note.value = this.note;
    note.addEventListener('input', () => (this.note = note.value));
    const who = document.createElement('select');
    who.className = 'panel-select market-who';
    who.title = 'Recipient';
    for (const f of people) {
      const o = document.createElement('option');
      o.value = f.uid;
      o.textContent = f.name;
      who.append(o);
    }
    bar.append(note, field('to', who), this.button('Send', 'Theirs once sent', () => {
      const items = [...this.posting];
      this.posting.clear();
      const text = this.note;
      this.note = '';
      void this.act(this.island!.post(who.value, text, items));
    }));
    this.page.append(bar);
  }
}

/** How many things of the pack a tick list shows. */
const PICK_SHOWN = 40;

/** A thing in a deal or in the post, named the way the pack names it, and a crate with who is in it. */
const nameOf = (t: { def: string; extra: string | null; ql: number; count: number; creature?: Occupant | null; enchant?: Enchant | null }): string => {
  // With what is enchanted into it, which the island sends with every thing on offer (`enchant.ts`).
  const named = itemName({ uid: 0, id: t.def, extra: t.extra ?? undefined, ql: t.ql, count: t.count, dmg: 0, enchant: t.enchant ?? undefined } as Item);
  return t.creature ? `${named} — ${t.creature.name}, ${t.creature.rare ? `${t.creature.rare} ` : ''}${speciesName(t.creature.species)}` : named;
};
/** A species as a sentence names it. */
const speciesName = (id: string): string => (SPECIES[id]?.name ?? id).toLowerCase();
const goodName = (g: Good): string => (g.count > 1 ? `${g.count} × ${nameOf(g)}` : nameOf(g));

/**
 * Every kind of thing an order may ask for, as the pack names it: all but
 * coins, which are what an order pays with. Worked out the first time it is
 * asked for rather than when this file loads, by which time every table that
 * adds a kind of its own has added it.
 */
const orderable = (): Array<[string, string]> =>
  Object.entries(ITEM_DEFS).filter(([id]) => id !== 'coin').map(([id, d]) => [id, d.name] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1]));
let kinds: Map<string, string> | null = null;
/** The kind of thing typed into an order, by its name, whatever case it was typed in. */
const kindNamed = (name: string): string | undefined =>
  (kinds ??= new Map(orderable().map(([id, n]) => [n.toLowerCase(), id]))).get(name.trim().toLowerCase());
let kindsOffered: HTMLDataListElement | null = null;
/** The names offered as one is typed. */
const kindList = (): HTMLDataListElement => {
  if (kindsOffered) return kindsOffered;
  kindsOffered = document.createElement('datalist');
  kindsOffered.id = 'market-kinds';
  for (const [, name] of orderable()) {
    const o = document.createElement('option');
    o.value = name;
    kindsOffered.append(o);
  }
  return kindsOffered;
};

/** A box with what it is for written in front of it. */
const field = (label: string, input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement => {
  const el = document.createElement('label');
  el.className = 'market-field';
  el.append(label, input);
  return el;
};

