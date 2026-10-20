import { DEED_RADIUS_PER_LEVEL, MAX_DEED_LEVEL, deedWorkersAt, type Deed, type Game } from '../../game/game';
import { DEED_ACTION_BY_ID, standingWord, upgradeProgress, upgradeReason } from '../../game/deed';
import { furnitureDef, furnitureName } from '../../game/furniture';
import { SPECIALTY_AT, SPECIALTY_BONUS, specialtySays, STANCES, STANCE_NAMES } from '../../game/creatures';
import { percent } from '../../game/words';
import { ACTION_BY_ID } from '../../game/actions';
import { crateName } from '../../game/crates';
import { trapName } from '../../game/traps';
import { bridgeName } from '../../game/bridges';
import { postName } from '../../game/posts';
import { BAUBLE_TIERS, baubleSummary, socketsOf } from '../../game/baubles';
import type { UIWindow } from '../windows';
import {
  andList, deedMay, isFounder, lacks, POWER, powerBit, RANK_CAP, STORE_LOG_CAP, RANK_NAME_MAX, RANK_POWERS, rankAddRefusal, rankDropRefusal, rankMay,
  rankMoveRefusal, rankName, rankNameRefusal, type PowerId, type RankDef,
} from '../../game/ranks';
import type { MyDeed, Social } from '../../net/island';
import { storeLogLine, type StoreLogEntry } from '../../game/stores';
import { asRanked, defOf, defsOf, ranksToGive } from './social';
import { crateKindOfItem } from '../../game/crates';
import { itemDef, ITEM_DEFS } from '../../game/items';
import {
  cleanNotice, deliveredBy, deliverRefusal, DELIVER_REACH, LEDGER_KEEP, NOTICE_KEEP, NOTICE_MAIL_DAYS, NOTICE_MAX, noticeRefusal, SETTLE_REFRESH,
  WORK_COUNT_MAX, WORK_DONE_KEEP, WORK_OPEN_MAX, WORK_QL_TOP, workSetRefusal, type LedgerLine, type SettleBoard, type Work,
} from '../../game/noticeboard';

/**
 * The roll of a settlement and the way to set ranks on it, which only an
 * island has: the Social window's last answer, asked again when it is old,
 * `rpc_rank`, and the founder's own doors for its ranks (`rpc_rank_add` and
 * the rest), each answering with a refusal or nothing.
 */
export interface DeedRoll {
  known(): Social | null;
  prime(): void;
  again(): Promise<void>;
  me(): string;
  rank(founder: string, uid: string, rank: string): Promise<string | null>;
  add(name: string): Promise<string | null>;
  rename(id: number, name: string): Promise<string | null>;
  move(id: number, dir: -1 | 1): Promise<string | null>;
  drop(id: number): Promise<string | null>;
  allow(id: number, power: PowerId, on: boolean): Promise<string | null>;
  newcomers(id: number): Promise<string | null>;
  /** A settlement's notices, work and ledger, or the island's refusal; `seen` marks its notices seen. */
  board(founder: string, seen: boolean): Promise<SettleBoard | string>;
  post(founder: string, text: string): Promise<string | null>;
  unpost(founder: string, n: number): Promise<string | null>;
  setWork(founder: string, def: string, count: number, minQl: number | null): Promise<string | null>;
  dropWork(founder: string, id: number): Promise<string | null>;
  deliver(founder: string, id: number): Promise<string | null>;
  /** A settlement's store log, newest first, by its founder (`rpc_store_log`). */
  storeLog(founder: string): Promise<{ why?: string; log?: StoreLogEntry[] }>;
}

/** The Settlement window's tabs: the settlement at a glance, its notices, and the work it wants with its ledger. */
export type DeedTab = 'overview' | 'notices' | 'work';
const DEED_TABS: ReadonlyArray<[DeedTab, string, string]> = [
  ['overview', 'Settlement', 'Level, border, citizens, ranks, structures.'],
  ['notices', 'Notices', `Posts, newest first. Keeps ${NOTICE_KEEP}.`],
  ['work', 'Work', `Work wanted, deliveries, ledger (newest ${LEDGER_KEEP} lines).`],
];

/** Every thing a deed crate takes, by its name in lower case: what a work may ask for. */
let thingsByName: Map<string, string> | null = null;
function workThings(): Map<string, string> {
  if (thingsByName) return thingsByName;
  thingsByName = new Map();
  for (const [id, def] of Object.entries(ITEM_DEFS)) {
    if (id === 'coin' || crateKindOfItem(id)) continue;
    const key = def.name.toLowerCase();
    if (!thingsByName.has(key)) thingsByName.set(key, id);
  }
  return thingsByName;
}

/** A thing's name, in lower case, as the island says it. */
const thingName = (def: string): string => (itemDef(def)?.name ?? def).toLowerCase();

/** A work as the lists name it: its number, how many of what, and how good. */
export const workLabel = (w: Pick<Work, 'id' | 'def' | 'want' | 'minQl'>): string =>
  `#${w.id} · ${w.want} × ${thingName(w.def)}${w.minQl === null ? '' : `, QL ${w.minQl}+`}`;

/** One ledger line in words. */
export function ledgerWords(l: LedgerLine): string {
  const what = thingName(l.def);
  if (l.what === 'set') return `${l.by} set #${l.work}: ${l.count} × ${what}.`;
  if (l.what === 'delivered') return `${l.by} delivered ${l.count} × ${what}${l.ql === null ? '' : ` at QL ${l.ql.toFixed(1)}`} toward #${l.work}.`;
  if (l.what === 'done') return `#${l.work} done: all ${l.count} × ${what} delivered.`;
  return `${l.by} took #${l.work} down with ${l.count} × ${what} delivered.`;
}

/** When, as the notices and the ledger say it. */
const when = (at: number): string =>
  new Date(at * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** How long ago something was, in the largest whole unit: "40 s", "12 min", "3 h", "2 d". */
const agoWords = (at: number): string => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - at));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
};

/** How often the Settlement window asks the island for the store log again, in seconds, while it is open. */
const STORE_LOG_EVERY = 10;

/**
 * Who a settlement's baubles work for, from its ranks: its founder, and
 * every rank holding Bauble effects (`bauble_here`).
 */
function baublesFor(here: MyDeed | undefined): string {
  const who = here ? defsOf(here).filter((r) => (r.perms & powerBit('served')) !== 0).map((r) => r.name) : [];
  return who.length
    ? `Applies to every action on its land by the founder and ranks with ${POWER.served.label}: ${andList(who)}.`
    : `Applies to the founder's actions on its land. No rank has ${POWER.served.label}.`;
}

/**
 * The settlement at a glance.
 *
 * Everything about a deed used to be answered by clicking the token and
 * reading a menu: what level it is, how far the border runs, how many
 * wildermon are working, what the next upgrade wants, what is standing on the
 * land. This window is all of it on one page, and it walks you to anything on
 * it.
 */
export class DeedPanel {
  private body: HTMLDivElement;
  private lastRender = 0;
  /** The rank whose permissions are shown, by id. */
  private openRank: number | null = null;
  private tab: DeedTab = 'overview';
  private readonly tabs = new Map<DeedTab, HTMLButtonElement>();
  /** The last board the island gave, the refusal it gave instead, and which settlement it was for. */
  private board: SettleBoard | null = null;
  private boardWhy: string | null = null;
  private boardFor = '';
  private asking = false;
  private lastAsk = -1e9;
  /** What the board's list was drawn from, so it is drawn again only when that changes. */
  private listKey = '';
  /** The forms, made once and kept, so a redraw never takes away what is half typed. */
  private noticeForm: HTMLDivElement | null = null;
  private workForm: HTMLDivElement | null = null;
  private readonly boardHead = document.createElement('div');
  private readonly listHost = document.createElement('div');
  /** The store log last read, by the founder of the settlement it is of, and when it was asked. */
  private storeLogSeen: { founder: string; log: StoreLogEntry[]; why?: string } | null = null;
  private storeLogAsked = -1e12;
  private storeLogAsking = false;

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly walkTo: (x: number, y: number) => void,
    /** Off the roll of a settlement you were asked onto; absent off an island. */
    private readonly leave?: (d: Deed) => void,
    /** Who lives on it and at what rank; absent off an island. */
    private readonly roll?: DeedRoll,
  ) {
    win.body.classList.add('deed-body');
    // Notices and work are the island's: alone there is one page and no tabs.
    if (roll) {
      const bar = document.createElement('div');
      bar.className = 'log-tabs deed-tabs';
      for (const [id, label, title] of DEED_TABS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tb-btn tb-small log-tab${id === this.tab ? ' tb-on' : ''}`;
        b.textContent = label;
        b.title = title;
        b.addEventListener('click', () => this.show(id));
        this.tabs.set(id, b);
        bar.append(b);
      }
      win.body.append(bar);
    }
    this.body = document.createElement('div');
    this.body.className = 'deed-list';
    this.boardHead.className = 'deed-head';
    win.body.append(this.body);
    game.events.on('world', () => this.render());
    game.events.on('inventory', () => this.render());
    this.render();
  }

  /**
   * Workers and building go on while this is open; look again now and then --
   * but not while one of its lists is dropped down, which a redraw would shut
   * under the pointer.
   */
  update(now: number): void {
    if (!this.win.isOpen || now - this.lastRender < 900) return;
    if (this.tab !== 'overview' && this.roll) {
      // The board asked again now and then; its list drawn again only when what it shows has changed.
      this.lastRender = now;
      if (now - this.lastAsk >= SETTLE_REFRESH * 1000) void this.fetchBoard();
      this.render();
      return;
    }
    const at = document.activeElement;
    if (at instanceof HTMLSelectElement && this.body.contains(at)) return;
    this.lastRender = now;
    this.render();
  }

  /** Turn to a tab, and open the window at it. */
  open(tab: DeedTab): void {
    this.show(tab);
    this.win.open();
  }

  private show(tab: DeedTab): void {
    if (!this.roll) tab = 'overview';
    this.tab = tab;
    for (const [id, b] of this.tabs) b.classList.toggle('tb-on', id === tab);
    this.listKey = '';
    this.body.replaceChildren();
    if (tab !== 'overview') void this.fetchBoard();
    this.render();
  }

  /** The settlement this window is about, as the island's social answer has it. */
  private hereDeed(): MyDeed | undefined {
    const d = this.game.deed;
    return d ? this.roll?.known()?.deeds.find((e) => e.x === d.x && e.y === d.y) : undefined;
  }

  /** Ask the island for the board of the settlement this window is about. */
  private async fetchBoard(): Promise<void> {
    const roll = this.roll;
    const here = this.hereDeed();
    if (!roll || !here || this.asking) return;
    this.asking = true;
    this.lastAsk = performance.now();
    try {
      const got = await roll.board(here.founder, this.tab === 'notices');
      this.board = typeof got === 'string' ? null : got;
      this.boardWhy = typeof got === 'string' ? got : null;
      this.boardFor = here.founder;
    } finally {
      this.asking = false;
    }
    this.render();
  }

  /** Ask the island to do something to the board, say a refusal in the log, and look again. */
  private boardDo(door: Promise<string | null>, after?: () => void): void {
    void door.then(async (why) => {
      if (why) this.game.logMsg(why, 'error');
      else after?.();
      this.lastAsk = -1e9;
      await this.fetchBoard();
    });
  }

  /** Ask the island, say a refusal in the log, and draw what the island says now. */
  private ask(door: Promise<string | null>): void {
    const roll = this.roll;
    void door.then(async (why) => {
      if (why) this.game.logMsg(why, 'error');
      await roll?.again();
      this.render();
    });
  }

  private head(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'deed-head';
    el.textContent = text;
    return el;
  }

  /** One line: something said on the left, the figure on the right. */
  private row(label: string, value: string, title?: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'deed-row';
    const a = document.createElement('span');
    a.textContent = label;
    const b = document.createElement('span');
    b.className = 'deed-value';
    b.textContent = value;
    if (title) el.title = title;
    el.append(a, b);
    return el;
  }

  /** A thing standing on the land, which one click walks you to. */
  private place(name: string, x: number, y: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'deed-row deed-place';
    const a = document.createElement('span');
    a.textContent = name;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-btn tb-small';
    const away = Math.round(Math.hypot(x + 0.5 - this.game.player.x, y + 0.5 - this.game.player.y));
    b.textContent = away ? `${away} away` : 'here';
    b.title = `Walk to (${x}, ${y})`;
    b.addEventListener('click', () => this.walkTo(x, y));
    el.append(a, b);
    return el;
  }

  /**
   * Who lives here and at what rank, and -- where you may give them another
   * -- a list of the ranks you may give them, the one they hold chosen. The
   * rule is `rankRefusal`, the island's own, so a rank is offered exactly
   * where `rpc_rank` would agree.
   */
  private drawRoll(here: MyDeed): void {
    const roll = this.roll;
    if (!roll) return;
    const me = roll.me();
    this.body.append(this.head(`Citizens (${here.folk.length + 1})`));
    this.body.append(this.row('You', rankName(asRanked(here))));
    for (const who of here.folk) {
      const el = document.createElement('div');
      el.className = 'deed-row deed-citizen';
      const name = document.createElement('span');
      name.className = 'deed-who';
      name.textContent = who.name;
      el.append(name);
      const now = who.uid === here.founder ? undefined : defOf(here, who.uid);
      const give = ranksToGive(here, me, who.uid, who.name);
      if (give.length < 2) {
        const v = document.createElement('span');
        v.className = 'deed-value';
        v.textContent = now?.name ?? 'Founder';
        el.title = now ? `${who.name} may ${rankMay(now.perms)}.` : `${who.name} founded ${here.name}.`;
        el.append(v);
      } else {
        const pick = document.createElement('select');
        pick.className = 'panel-select deed-pick';
        pick.title = `${who.name}'s rank at ${here.name}. Lists only ranks you can give.`;
        for (const r of give) {
          const o = document.createElement('option');
          o.value = r.name;
          o.textContent = r.name;
          o.selected = r.id === now?.id;
          o.title = `${r.name} may ${rankMay(r.perms)}.`;
          pick.append(o);
        }
        pick.addEventListener('change', () => {
          pick.blur();
          this.ask(roll.rank(here.founder, who.uid, pick.value));
        });
        el.append(pick);
      }
      this.body.append(el);
    }
  }

  /**
   * The settlement's ranks, highest first. Its founder orders, renames,
   * deletes and makes them, ticks what each may do, and chooses the one
   * newcomers join at; everybody else sees the same list and cannot change
   * it. Every refusal is the island's, said before it is asked.
   */
  private drawRanks(here: MyDeed): void {
    const roll = this.roll;
    if (!roll) return;
    const g = this.game;
    const defs = defsOf(here);
    const edits = here.mine && !!here.defs;
    this.body.append(this.head(`Ranks (${defs.length} of ${RANK_CAP})`));
    const note = document.createElement('div');
    note.className = 'deed-note';
    note.textContent = edits
      ? 'Highest first. Founder (you): all permissions. A rank sends away and sets ranks only below it. Click a rank: permissions.'
      : 'Highest first. Set by the founder. Click a rank: permissions.';
    this.body.append(note);
    for (const [i, r] of defs.entries()) {
      const row = document.createElement('div');
      row.className = 'deed-row deed-rank' + (this.openRank === r.id ? ' deed-rank-open' : '');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'deed-rank-name';
      name.textContent = `${this.openRank === r.id ? '▾' : '▸'} ${r.name}`;
      name.title = `${r.name} may ${rankMay(r.perms)}.`;
      name.setAttribute('aria-expanded', String(this.openRank === r.id));
      // The one an invitation puts newcomers on, marked where the list is read.
      if (r.newcomer) {
        const tag = document.createElement('span');
        tag.className = 'deed-rank-tag';
        tag.textContent = 'newcomers';
        tag.title = 'Newcomer rank.';
        name.append(tag);
      }
      name.addEventListener('click', () => {
        this.openRank = this.openRank === r.id ? null : r.id;
        this.render();
      });
      const held = document.createElement('span');
      held.className = 'deed-rank-held';
      held.textContent = `${r.held} held`;
      held.title = `Held by ${r.held} ${r.held === 1 ? 'citizen' : 'citizens'}.${r.newcomer ? ' Newcomer rank.' : ''}`;
      row.append(name, held);
      if (edits) {
        const tools = document.createElement('span');
        tools.className = 'deed-ranks';
        const tool = (text: string, tip: string, why: string | null, act: () => void, danger = false): void => {
          const b = document.createElement('button');
          b.type = 'button';
          // An arrow or a cross is drawn larger than a word, so it reads at the same size.
          b.className = 'tb-btn tb-small deed-tool' + ([...text].length === 1 ? ' deed-glyph' : '') + (danger ? ' tb-danger' : '');
          b.textContent = text;
          b.title = why ?? tip;
          b.setAttribute('aria-label', tip);
          b.disabled = !!why;
          b.addEventListener('click', act);
          tools.append(b);
        };
        tool('▲', `Move ${r.name} above ${defs[i - 1]?.name ?? ''}`, rankMoveRefusal(defs, r.id, -1), () => this.ask(roll.move(r.id, -1)));
        tool('▼', `Move ${r.name} below ${defs[i + 1]?.name ?? ''}`, rankMoveRefusal(defs, r.id, 1), () => this.ask(roll.move(r.id, 1)));
        tool('Rename', `Rename ${r.name}`, null, () => {
          void g.hooks.prompt(`Rename ${r.name} (max ${RANK_NAME_MAX} characters):`, r.name).then((to) => {
            if (to === null || to.trim() === r.name) return;
            const why = rankNameRefusal(here.name, defs, to, r.id);
            if (why) g.logMsg(why, 'error');
            else this.ask(roll.rename(r.id, to.trim()));
          });
        });
        tool('✕', `Delete ${r.name}`, rankDropRefusal(defs, r.id), () => {
          void g.hooks.confirm(`Delete rank ${r.name}? (held by nobody)`).then((yes) => {
            if (yes) this.ask(roll.drop(r.id));
          });
        }, true);
        row.append(tools);
      }
      this.body.append(row);
      if (this.openRank === r.id) this.body.append(this.permGrid(r, edits, roll));
    }
    if (!edits) return;
    // Newcomers, and a new rank.
    const join = document.createElement('div');
    join.className = 'deed-row';
    const label = document.createElement('span');
    label.textContent = 'Newcomer rank';
    const pick = document.createElement('select');
    pick.className = 'panel-select deed-pick';
    pick.title = 'Rank given on accepting an invitation.';
    for (const r of defs) {
      const o = document.createElement('option');
      o.value = String(r.id);
      o.textContent = r.name;
      o.selected = r.newcomer;
      pick.append(o);
    }
    pick.addEventListener('change', () => {
      pick.blur();
      this.ask(roll.newcomers(Number(pick.value)));
    });
    join.append(label, pick);
    this.body.append(join);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tb-btn deed-leave';
    add.textContent = 'New rank';
    const full = rankAddRefusal(here.name, defs, 'x');
    add.disabled = !!full;
    add.title = full ?? `Added at the bottom, no permissions. Max ${RANK_CAP} ranks besides the founder.`;
    add.addEventListener('click', () => {
      void g.hooks.prompt(`New rank name (max ${RANK_NAME_MAX} characters):`, '').then((name) => {
        if (name === null) return;
        const why = rankAddRefusal(here.name, defs, name);
        if (why) g.logMsg(why, 'error');
        else this.ask(roll.add(name.trim()));
      });
    });
    this.body.append(add);
  }

  /**
   * Every take and every put out of the settlement's stores, newest first, as
   * far back as the island keeps (`STORE_LOG_CAP`): for its founder and for
   * ranks holding Keep the stores, and not drawn for anybody else.
   */
  private drawStoreLog(here: MyDeed): void {
    const roll = this.roll;
    if (!roll || !deedMay(asRanked(here), 'keep_stores')) return;
    const now = Date.now() / 1000;
    if (this.win.isOpen && !this.storeLogAsking
        && (this.storeLogSeen?.founder !== here.founder || now - this.storeLogAsked >= STORE_LOG_EVERY)) {
      this.storeLogAsking = true;
      this.storeLogAsked = now;
      void roll.storeLog(here.founder).then((said) => {
        this.storeLogAsking = false;
        this.storeLogSeen = { founder: here.founder, log: said.log ?? [], why: said.why };
        this.render();
      });
    }
    const seen = this.storeLogSeen?.founder === here.founder ? this.storeLogSeen : null;
    this.body.append(this.head(`Store log${seen && !seen.why ? ` (${seen.log.length}/${STORE_LOG_CAP})` : ''}`));
    const note = (text: string): void => {
      const el = document.createElement('div');
      el.className = 'deed-note';
      el.textContent = text;
      this.body.append(el);
    };
    if (!seen) {
      note('Loading…');
      return;
    }
    if (seen.why) {
      note(seen.why);
      return;
    }
    if (!seen.log.length) {
      note(`No store activity at ${here.name}. Make a store a settlement store from its window.`);
      return;
    }
    for (const e of seen.log) this.body.append(this.row(storeLogLine(e), agoWords(e.at), new Date(e.at * 1000).toLocaleString()));
  }

  /** What one rank may do: a box a power, each with its exact rule, ticked where the rank holds it. */
  private permGrid(r: RankDef, edits: boolean, roll: DeedRoll): HTMLDivElement {
    const grid = document.createElement('div');
    grid.className = 'deed-perms';
    for (const p of RANK_POWERS) {
      const cell = document.createElement('label');
      cell.className = 'deed-perm';
      cell.title = p.rule;
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = (r.perms & powerBit(p.id)) !== 0;
      box.disabled = !edits;
      box.addEventListener('change', () => this.ask(roll.allow(r.id, p.id, box.checked)));
      const text = document.createElement('span');
      text.textContent = p.label;
      cell.append(box, text);
      grid.append(cell);
    }
    return grid;
  }

  render(): void {
    if (this.tab !== 'overview' && this.roll) this.renderBoard();
    else this.renderOverview();
  }

  private renderOverview(): void {
    const g = this.game;
    const d = g.deed;
    this.body.replaceChildren();
    if (!d) {
      const none = document.createElement('div');
      none.className = 'deed-none';
      none.textContent = 'No settlement. Plant a settlement totem to found one.';
      this.body.append(none);
      return;
    }
    const level = g.deedLevel;
    const workers = g.creatures.workers().length;
    const crated = g.creatures.stored().length;
    const side = d.radius * 2 + 1;
    this.body.append(this.head(d.name));
    /*
     * One you were asked onto: whose it is, what you are on it, and the way
     * off it -- which used to be a line at the foot of the People window's
     * settlement page and nowhere else.
     */
    if (!isFounder(d)) {
      const holder = g.neighbourDeeds.find((n) => n.x === d.x && n.y === d.y)?.holder;
      if (holder) this.body.append(this.row('Founder', holder));
      const standing = document.createElement('div');
      standing.className = 'deed-note';
      standing.textContent = standingWord(d);
      this.body.append(standing);
    }
    this.body.append(this.row('Level', `${level} of ${MAX_DEED_LEVEL}`));
    this.body.append(this.row('Border', `radius ${d.radius} tiles · ${side} × ${side}`, `Centred on the totem at (${d.x}, ${d.y}).`));
    this.body.append(this.row('Working', `${workers}/${g.workerCap}`, 'Wildermon working the settlement / max at this level.'));
    // Each trade its workers are at, and whether there are enough of them at it for a specialty (`SPECIALTY_AT`).
    for (const { kind, n } of g.creatures.specialties()) {
      this.body.append(this.row(n >= SPECIALTY_AT ? 'Specialty' : 'Task', specialtySays(kind, n).replace(/^Specialty: /, ''),
        `${SPECIALTY_AT}+ settlement workers on one task: task speed +${percent(SPECIALTY_BONUS)} each.`));
    }
    this.body.append(this.row('In wildermon crates', String(crated), 'Yours in wildermon crates: not working or following.'));
    this.body.append(this.row('Orders', STANCE_NAMES[g.deedStance()], 'Settlement wildermon response to intruders.'));
    this.body.append(this.place('Totem', d.x, d.y));
    // Who lives here and the settlement's ranks, from the island's social answer.
    this.roll?.prime();
    const here: MyDeed | undefined = this.roll?.known()?.deeds.find((e) => e.x === d.x && e.y === d.y);
    if (this.roll && !here) {
      this.body.append(this.head('Citizens'));
      const wait = document.createElement('div');
      wait.className = 'deed-note';
      wait.textContent = 'Loading…';
      this.body.append(wait);
    } else if (here) {
      this.drawRoll(here);
      this.drawRanks(here);
      this.drawStoreLog(here);
    }

    // What the next level wants, and the button that buys it.
    this.body.append(this.head(level < MAX_DEED_LEVEL ? `Next: level ${level + 1}` : 'Max level'));
    if (level < MAX_DEED_LEVEL) {
      const done = upgradeProgress(g, d);
      for (const r of done) {
        const el = this.row(`${r.met ? '✓' : '✗'} ${r.label}`, '');
        el.classList.add(r.met ? 'deed-met' : 'deed-unmet');
        this.body.append(el);
      }
      const why = upgradeReason(g, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tb-btn deed-upgrade';
      btn.textContent = `Upgrade · border ${d.radius + DEED_RADIUS_PER_LEVEL}, ${deedWorkersAt(level + 1)} workers`;
      btn.disabled = !!why;
      btn.title = why ?? 'Requirements met: level up.';
      btn.addEventListener('click', () => {
        const def = DEED_ACTION_BY_ID.get('upgrade_deed');
        if (def) g.requestAction(def, { kind: 'tile', x: d.x, y: d.y, cx: d.x, cy: d.y });
      });
      this.body.append(btn);
      if (why) {
        const note = document.createElement('div');
        note.className = 'deed-note';
        note.textContent = why;
        this.body.append(note);
      }
    }

    // Everything standing inside the border, so nothing has to be hunted for.
    const on = <T extends { x: number; y: number }>(m: Map<number, T>): T[] => [...m.values()].filter((v) => g.onOwnDeed(v.x, v.y));
    const buildings = [...g.buildings.list.values()].filter((b) => {
      const [bx, by] = (b.tiles[0] ?? '').split(',').map(Number);
      return Number.isFinite(bx) && g.onOwnDeed(bx, by);
    });
    const pieces = on(g.furniture);
    const altars = pieces.filter((f) => furnitureDef(f.kind).altar);
    this.body.append(this.head('Structures'));
    const counts: Array<[string, number]> = [
      ['Buildings', buildings.length],
      ['Crates and bins', on(g.crates).length],
      ['Furniture', pieces.length],
      ['Campfires', on(g.campfires).length],
      ['Smelters', on(g.smelters).length],
      ['Kilns', on(g.kilns).length],
      ['Anvils', on(g.anvils).length],
      ['Altars', altars.length],
      ['Traps', on(g.traps).length],
      ['Work posts', on(g.posts).length],
    ];
    let any = false;
    for (const [label, n] of counts) {
      if (!n) continue;
      any = true;
      this.body.append(this.row(label, String(n)));
    }
    if (!any) {
      const bare = document.createElement('div');
      bare.className = 'deed-note';
      bare.textContent = 'None. Lists everything built inside the border.';
      this.body.append(bare);
    }

    // What the baubles in its sockets give, added up, and how full the sockets are.
    const set = d.baubles ?? [];
    if (set.length || altars.length) {
      this.body.append(this.head('Altar baubles'));
      for (const t of BAUBLE_TIERS) {
        this.body.append(this.row(`${t.name} sockets`, `${socketsOf(d, t.id).filter(Boolean).length} of ${t.slots}`));
      }
      for (const line of baubleSummary(set)) {
        const cap = line.capped ? 'at the cap' : '';
        this.body.append(this.row(line.text, cap, line.capped ? 'Over the cap: the excess has no effect.' : undefined));
      }
      const who = document.createElement('div');
      who.className = 'deed-note';
      who.textContent = set.length
        ? baublesFor(here)
        : 'None set. Restore a bauble and set it at the altar.';
      this.body.append(who);
    }

    // The named things worth walking to.
    const marks: Array<{ name: string; x: number; y: number }> = [];
    for (const b of buildings) {
      const [bx, by] = (b.tiles[0] ?? '').split(',').map(Number);
      if (Number.isFinite(bx)) marks.push({ name: b.name, x: bx, y: by });
    }
    for (const f of pieces) marks.push({ name: furnitureName(f), x: f.x, y: f.y });
    for (const c of on(g.crates)) marks.push({ name: crateName(c), x: c.x, y: c.y });
    for (const t of on(g.traps)) marks.push({ name: trapName(t), x: t.x, y: t.y });
    for (const p of on(g.posts)) marks.push({ name: postName(p), x: p.x, y: p.y });
    for (const b of [...g.bridges.values()]) {
      const first = b.spans[0];
      if (first && g.onOwnDeed(first.x, first.y)) marks.push({ name: bridgeName(b), x: first.x, y: first.y });
    }
    if (marks.length) {
      this.body.append(this.head(`Walk to (${marks.length})`));
      marks.sort((a, b) => Math.hypot(a.x - g.player.x, a.y - g.player.y) - Math.hypot(b.x - g.player.x, b.y - g.player.y));
      for (const m of marks.slice(0, 40)) this.body.append(this.place(m.name, m.x, m.y));
    }

    // Renaming, for its founder and a rank allowed it; standing orders and
    // disbanding, its founder's alone, which the island refuses anybody else.
    const tail = document.createElement('div');
    tail.className = 'deed-buttons';
    for (const id of ['rename_deed', 'disband_deed']) {
      const def = ACTION_BY_ID.get(id);
      if (!def || (id === 'rename_deed' ? lacks(d, 'rename') : !isFounder(d))) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small' + (id === 'disband_deed' ? ' tb-danger' : '');
      b.textContent = def.label;
      b.addEventListener('click', () => g.requestAction(def, { kind: 'tile', x: d.x, y: d.y, cx: d.x, cy: d.y }));
      tail.append(b);
    }
    if (!isFounder(d)) {
      // The way off it, at the foot with the other things done to the settlement as a whole, not over what it is.
      if (this.leave) {
        const leave = this.leave;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tb-btn tb-small tb-danger';
        btn.textContent = `Leave ${d.name}`;
        btn.title = 'Leave (asks to confirm).';
        btn.addEventListener('click', () => leave(d));
        tail.append(btn);
      }
      if (tail.childElementCount) this.body.append(this.head('Settlement'), tail);
      return;
    }
    this.body.append(this.head('Settlement wildermon orders'));
    const stance = g.deedStance();
    const row = document.createElement('div');
    row.className = 'deed-buttons';
    for (const st of STANCES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small' + (st === stance ? ' tb-on' : '');
      b.textContent = STANCE_NAMES[st];
      b.title = st === 'aggressive' ? 'Attacks wild creatures inside the border' : st === 'defensive' ? 'Fights back when it or you are attacked' : 'Never fights';
      b.addEventListener('click', () => {
        g.setDeedStance(st);
        this.render();
      });
      row.append(b);
    }
    this.body.append(row);
    this.body.append(tail);
  }

  /* ---- the Notices and Work tabs ------------------------------------------- */

  /**
   * The Notices tab or the Work tab: its head, its form (for a rank that may
   * use it) and its list. The form is made once and put back, never made
   * again, so the list can be drawn again under somebody typing.
   */
  private renderBoard(): void {
    const g = this.game;
    const d = g.deed;
    const roll = this.roll!;
    if (!d) {
      const none = document.createElement('div');
      none.className = 'deed-none';
      none.textContent = 'No settlement. Found one (settlement totem) or accept an invitation.';
      this.body.replaceChildren(none);
      this.listKey = '';
      return;
    }
    roll.prime();
    const here = this.hereDeed();
    const b = here && this.boardFor === here.founder ? this.board : null;
    const why = here && this.boardFor === here.founder ? this.boardWhy : null;
    if (here && !b && !why && !this.asking && performance.now() - this.lastAsk > 1000) void this.fetchBoard();
    const form = this.tab === 'notices' ? this.makeNoticeForm() : this.makeWorkForm();
    if (this.body.children[0] !== this.boardHead || this.body.children[1] !== form || this.body.children[2] !== this.listHost) {
      this.body.replaceChildren(this.boardHead, form, this.listHost);
      this.listKey = '';
    }
    form.hidden = !b || (this.tab === 'notices' ? !b.post : !b.set);
    if (this.tab === 'notices') {
      this.boardHead.textContent = b ? `Notices at ${b.deed} (${b.notices.length}/${NOTICE_KEEP})` : `Notices at ${d.name}`;
    } else {
      const open = b ? b.work.filter((w) => w.closed === null).length : 0;
      this.boardHead.textContent = b ? `Work at ${b.deed} (${open}/${WORK_OPEN_MAX} open)` : `Work at ${d.name}`;
    }
    // What the list shows: the board, and for work, what you carry and where you stand.
    const held = b && this.tab === 'work' ? b.work.map((w) => this.heldFor(w)) : [];
    const reasons = b && this.tab === 'work'
      ? b.work.map((w, i) => deliverRefusal(b, w, thingName(w.def), held[i], g.player.x, g.player.y)) : [];
    const key = JSON.stringify([this.tab, why, b, held, reasons, here ? 1 : 0]);
    if (key === this.listKey) return;
    this.listKey = key;
    this.listHost.replaceChildren();
    if (!here || (!b && !why)) {
      this.listHost.append(this.note('Loading…'));
      return;
    }
    if (!b) {
      this.listHost.append(this.note(why ?? ''));
      return;
    }
    if (this.tab === 'notices') this.drawNotices(b);
    else this.drawWork(b, held, reasons);
  }

  private note(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'deed-note';
    el.textContent = text;
    return el;
  }

  /** How many of a work's thing you carry at its quality or better. */
  private heldFor(w: Work): number {
    return this.game.inventory.items
      .filter((it) => it.id === w.def && (w.minQl === null || it.ql >= w.minQl))
      .reduce((n, it) => n + it.count, 0);
  }

  /** The box a notice is written in, with how many characters it has, and Post. */
  private makeNoticeForm(): HTMLDivElement {
    if (this.noticeForm) return this.noticeForm;
    const form = document.createElement('div');
    form.className = 'deed-form';
    const text = document.createElement('textarea');
    text.className = 'panel-select deed-text';
    text.rows = 3;
    text.maxLength = NOTICE_MAX;
    text.placeholder = `Notice to all citizens (max ${NOTICE_MAX} characters)`;
    const row = document.createElement('div');
    row.className = 'deed-row';
    const left = document.createElement('span');
    left.className = 'deed-note';
    const post = document.createElement('button');
    post.type = 'button';
    post.className = 'tb-btn tb-small';
    post.textContent = 'Post';
    post.title = `To all citizens: ashore, in the log now; away over ${NOTICE_MAIL_DAYS} day${NOTICE_MAIL_DAYS === 1 ? '' : 's'}, by letter; others, on next arrival. Keeps ${NOTICE_KEEP}; oldest dropped.`;
    const count = (): void => {
      left.textContent = `${[...cleanNotice(text.value)].length} of ${NOTICE_MAX} characters`;
    };
    text.addEventListener('input', count);
    // Keys typed here are the notice's, not the game's.
    text.addEventListener('keydown', (e) => e.stopPropagation());
    post.addEventListener('click', () => {
      const b = this.board;
      if (!b || !this.roll) return;
      const why = noticeRefusal(text.value);
      if (why) {
        this.game.logMsg(why, 'error');
        return;
      }
      this.boardDo(this.roll.post(b.founder, cleanNotice(text.value)), () => {
        text.value = '';
        count();
      });
    });
    count();
    row.append(left, post);
    form.append(text, row);
    this.noticeForm = form;
    return form;
  }

  private drawNotices(b: SettleBoard): void {
    if (!b.notices.length) {
      this.listHost.append(this.note(b.post ? 'No notices. Write one above.' : 'No notices.'));
      return;
    }
    for (const n of b.notices) {
      const el = document.createElement('div');
      el.className = 'deed-notice';
      const head = document.createElement('div');
      head.className = 'deed-row';
      const who = document.createElement('span');
      who.className = 'deed-notice-by';
      who.textContent = `${n.by} · ${when(n.at)}`;
      who.title = new Date(n.at * 1000).toLocaleString();
      head.append(who);
      if (b.post) {
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'tb-btn tb-small deed-tool tb-danger';
        down.textContent = 'Take down';
        down.title = 'Remove for everyone.';
        down.addEventListener('click', () => this.boardDo(this.roll!.unpost(b.founder, n.n)));
        head.append(down);
      }
      const text = document.createElement('div');
      text.className = 'deed-notice-text';
      text.textContent = n.text;
      el.append(head, text);
      this.listHost.append(el);
    }
  }

  /** What is wanted: a thing by its name, how many and how good, and Set work. */
  private makeWorkForm(): HTMLDivElement {
    if (this.workForm) return this.workForm;
    const form = document.createElement('div');
    form.className = 'deed-form';
    const list = document.createElement('datalist');
    list.id = 'deed-work-things';
    for (const id of [...workThings().values()].sort((a, c) => thingName(a).localeCompare(thingName(c)))) {
      const o = document.createElement('option');
      o.value = itemDef(id).name;
      list.append(o);
    }
    const thing = document.createElement('input');
    thing.className = 'panel-select deed-input';
    thing.setAttribute('list', list.id);
    thing.placeholder = 'Item wanted';
    thing.title = 'Anything a settlement crate takes (not coins or crates).';
    const count = document.createElement('input');
    count.className = 'panel-select deed-input deed-num';
    count.type = 'number';
    count.min = '1';
    count.max = String(WORK_COUNT_MAX);
    count.placeholder = 'Count';
    count.title = `1 to ${WORK_COUNT_MAX}.`;
    const ql = document.createElement('input');
    ql.className = 'panel-select deed-input deed-num';
    ql.type = 'number';
    ql.min = '0';
    ql.max = String(WORK_QL_TOP);
    ql.placeholder = 'Least QL';
    ql.title = `Min QL, whole number up to ${WORK_QL_TOP}. Empty or 0: any.`;
    for (const el of [thing, count, ql]) el.addEventListener('keydown', (e) => e.stopPropagation());
    const set = document.createElement('button');
    set.type = 'button';
    set.className = 'tb-btn tb-small';
    set.textContent = 'Set work';
    set.title = `Post for all citizens. Max ${WORK_OPEN_MAX} open.`;
    set.addEventListener('click', () => {
      const b = this.board;
      if (!b || !this.roll) return;
      const asked = thing.value.trim().toLowerCase();
      const def = workThings().get(asked) ?? null;
      const known = def ?? Object.keys(ITEM_DEFS).find((id) => itemDef(id).name.toLowerCase() === asked) ?? null;
      const n = Number(count.value);
      const least = ql.value.trim() === '' || Number(ql.value) <= 0 ? null : Number(ql.value);
      const open = b.work.filter((w) => w.closed === null).length;
      const why = workSetRefusal(b.deed, known ? itemDef(known).name : null, !!def, n, least, open);
      if (why || !def) {
        this.game.logMsg(why ?? 'Unknown item.', 'error');
        return;
      }
      this.boardDo(this.roll.setWork(b.founder, def, n, least), () => {
        thing.value = '';
        count.value = '';
        ql.value = '';
      });
    });
    const row = document.createElement('div');
    row.className = 'deed-buttons';
    row.append(count, ql, set);
    form.append(list, thing, row);
    this.workForm = form;
    return form;
  }

  private drawWork(b: SettleBoard, held: number[], reasons: Array<string | null>): void {
    const open = b.work.filter((w) => w.closed === null);
    const closed = b.work.filter((w) => w.closed !== null);
    this.listHost.append(this.note(
      `Deliver within ${DELIVER_REACH} tiles of the totem: matching pack items into the settlement crate, lowest QL first, until filled or the crate is full.`
      + (b.room === null ? ' No settlement crate here.' : ` Settlement crate room: ${b.room}.`)));
    if (!open.length) this.listHost.append(this.note(b.set ? 'No work posted. Set some above.' : 'No work posted.'));
    for (const w of open) {
      const i = b.work.indexOf(w);
      const el = document.createElement('div');
      el.className = 'deed-work';
      const head = document.createElement('div');
      head.className = 'deed-row';
      const label = document.createElement('span');
      label.className = 'deed-who';
      label.textContent = workLabel(w);
      label.title = `Set by ${w.by}, ${when(w.at)}.`;
      const got = document.createElement('span');
      got.className = 'deed-value';
      got.textContent = `${w.got} of ${w.want}`;
      head.append(label, got);
      const bar = document.createElement('div');
      bar.className = 'deed-work-bar';
      const fill = document.createElement('div');
      fill.style.width = `${Math.min(100, (w.got / w.want) * 100)}%`;
      bar.append(fill);
      const tools = document.createElement('div');
      tools.className = 'deed-buttons';
      const going = Math.min(held[i], w.want - w.got, b.room ?? 0);
      const give = document.createElement('button');
      give.type = 'button';
      give.className = 'tb-btn tb-small';
      give.textContent = reasons[i] ? 'Deliver' : `Deliver ${going}`;
      give.disabled = !!reasons[i];
      give.title = reasons[i] ?? `Deliver ${going} × ${thingName(w.def)} to the settlement crate, lowest QL first.`;
      give.addEventListener('click', () => this.boardDo(this.roll!.deliver(b.founder, w.id)));
      tools.append(give);
      if (b.set) {
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'tb-btn tb-small tb-danger';
        down.textContent = 'Take down';
        down.title = 'Close it. Deliveries stay in the settlement crate.';
        down.addEventListener('click', () => {
          void this.game.hooks.confirm(`Close ${workLabel(w)}? ${w.got} delivered stay in the settlement crate.`).then((yes) => {
            if (yes) this.boardDo(this.roll!.dropWork(b.founder, w.id));
          });
        });
        tools.append(down);
      }
      el.append(head, bar, tools);
      const who = deliveredBy(b.ledger, w.id);
      if (who.length) el.append(this.note(`Delivered: ${who.map((x) => `${x.by} ${x.count}`).join(', ')}.`));
      this.listHost.append(el);
    }
    if (closed.length) {
      this.listHost.append(this.head(`Done or closed (newest ${WORK_DONE_KEEP})`));
      for (const w of closed) {
        const el = this.row(workLabel(w), w.how === 'done' ? 'done' : `taken down at ${w.got}`, w.closed ? when(w.closed) : undefined);
        el.classList.add(w.how === 'done' ? 'deed-met' : 'deed-unmet');
        this.listHost.append(el);
      }
    }
    this.listHost.append(this.head(`Ledger (${b.ledger.length} of ${LEDGER_KEEP} kept)`));
    if (!b.ledger.length) this.listHost.append(this.note('Empty. Logs work set, deliveries, work done and work closed.'));
    for (const l of b.ledger) {
      const el = document.createElement('div');
      el.className = 'deed-ledger';
      const at = document.createElement('span');
      at.className = 'deed-ledger-at';
      at.textContent = when(l.at);
      const text = document.createElement('span');
      text.textContent = ledgerWords(l);
      el.append(at, text);
      this.listHost.append(el);
    }
  }
}
