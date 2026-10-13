import { DEED_RADIUS_PER_LEVEL, MAX_DEED_LEVEL, deedWorkersAt, type Deed, type Game } from '../../game/game';
import { DEED_ACTION_BY_ID, standingWord, upgradeProgress, upgradeReason } from '../../game/deed';
import { furnitureDef, furnitureName } from '../../game/furniture';
import { STANCES, STANCE_NAMES } from '../../game/creatures';
import { ACTION_BY_ID } from '../../game/actions';
import { crateName } from '../../game/crates';
import { trapName } from '../../game/traps';
import { bridgeName } from '../../game/bridges';
import { postName } from '../../game/posts';
import { BAUBLE_TIERS, baubleSummary, socketsOf } from '../../game/baubles';
import type { UIWindow } from '../windows';
import {
  andList, isFounder, lacks, POWER, powerBit, RANK_CAP, RANK_NAME_MAX, RANK_POWERS, rankAddRefusal, rankDropRefusal, rankMay,
  rankMoveRefusal, rankName, rankNameRefusal, type PowerId, type RankDef,
} from '../../game/ranks';
import type { MyDeed, Social } from '../../net/island';
import { asRanked, defOf, defsOf, ranksToGive } from './social';

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
}

/**
 * Who a settlement's baubles work for, from its ranks: its founder, and
 * every rank holding Bauble effects (`bauble_here`).
 */
function baublesFor(here: MyDeed | undefined): string {
  const who = here ? defsOf(here).filter((r) => (r.perms & powerBit('served')) !== 0).map((r) => r.name) : [];
  return who.length
    ? `Applied to every action done on its land by its founder and by every ${andList(who)}: the ranks holding ${POWER.served.label}.`
    : `Applied to every action its founder does on its land. No rank holds ${POWER.served.label}.`;
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
    this.body = document.createElement('div');
    this.body.className = 'deed-list';
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
    const at = document.activeElement;
    if (at instanceof HTMLSelectElement && this.body.contains(at)) return;
    this.lastRender = now;
    this.render();
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
        pick.title = `The rank ${who.name} holds at ${here.name}. Only ranks you may give are listed.`;
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
      ? `Highest first. You, the founder, hold every permission. A rank may send away and set the rank only of those below it in this list. Click a rank for its permissions.`
      : `Highest first. Its founder sets these. Click a rank for its permissions.`;
    this.body.append(note);
    for (const [i, r] of defs.entries()) {
      const row = document.createElement('div');
      row.className = 'deed-row deed-rank' + (this.openRank === r.id ? ' deed-rank-open' : '');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'deed-rank-name';
      name.textContent = `${this.openRank === r.id ? '▾' : '▸'} ${r.name}`;
      name.title = `${r.name} may ${rankMay(r.perms)}.`;
      name.addEventListener('click', () => {
        this.openRank = this.openRank === r.id ? null : r.id;
        this.render();
      });
      const held = document.createElement('span');
      held.className = 'deed-rank-held';
      held.textContent = `${r.held} held`;
      held.title = `${r.held === 1 ? '1 citizen holds' : `${r.held} citizens hold`} it.${r.newcomer ? ' Newcomers join at it.' : ''}`;
      row.append(name, held);
      if (edits) {
        const tools = document.createElement('span');
        tools.className = 'deed-ranks';
        const tool = (text: string, tip: string, why: string | null, act: () => void, danger = false): void => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tb-btn tb-small deed-tool' + (danger ? ' tb-danger' : '');
          b.textContent = text;
          b.title = why ?? tip;
          b.disabled = !!why;
          b.addEventListener('click', act);
          tools.append(b);
        };
        tool('▲', `Move ${r.name} above ${defs[i - 1]?.name ?? ''}`, rankMoveRefusal(defs, r.id, -1), () => this.ask(roll.move(r.id, -1)));
        tool('▼', `Move ${r.name} below ${defs[i + 1]?.name ?? ''}`, rankMoveRefusal(defs, r.id, 1), () => this.ask(roll.move(r.id, 1)));
        tool('Rename', `Rename ${r.name}`, null, () => {
          void g.hooks.prompt(`What should ${r.name} be called? At most ${RANK_NAME_MAX} characters.`, r.name).then((to) => {
            if (to === null || to.trim() === r.name) return;
            const why = rankNameRefusal(here.name, defs, to, r.id);
            if (why) g.logMsg(why, 'error');
            else this.ask(roll.rename(r.id, to.trim()));
          });
        });
        tool('✕', `Delete ${r.name}`, rankDropRefusal(defs, r.id), () => {
          void g.hooks.confirm(`Delete the rank ${r.name}? Nobody holds it.`).then((yes) => {
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
    label.textContent = 'Newcomers join as';
    const pick = document.createElement('select');
    pick.className = 'panel-select deed-pick';
    pick.title = 'The rank an invitation puts somebody on when they say yes.';
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
    add.title = full ?? `Added at the foot of the list with no permissions. At most ${RANK_CAP} ranks besides the founder.`;
    add.addEventListener('click', () => {
      void g.hooks.prompt(`What should the new rank be called? At most ${RANK_NAME_MAX} characters.`, '').then((name) => {
        if (name === null) return;
        const why = rankAddRefusal(here.name, defs, name);
        if (why) g.logMsg(why, 'error');
        else this.ask(roll.add(name.trim()));
      });
    });
    this.body.append(add);
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
    const g = this.game;
    const d = g.deed;
    this.body.replaceChildren();
    if (!d) {
      const none = document.createElement('div');
      none.className = 'deed-none';
      none.textContent = 'You have founded no settlement. Plant a settlement token on ground you want to call your own, and this window fills.';
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
      if (holder) this.body.append(this.row('Founded by', holder));
      const standing = document.createElement('div');
      standing.className = 'deed-note';
      standing.textContent = standingWord(d);
      this.body.append(standing);
      if (this.leave) {
        const leave = this.leave;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tb-btn deed-leave';
        btn.textContent = `Leave ${d.name}`;
        btn.title = 'Takes you off its roll. You are asked first.';
        btn.addEventListener('click', () => leave(d));
        this.body.append(btn);
      }
    }
    this.body.append(this.row('Level', `${level} of ${MAX_DEED_LEVEL}`));
    this.body.append(this.row('Border', `${d.radius} tiles out · ${side} × ${side}`, `From the token at (${d.x}, ${d.y}).`));
    this.body.append(this.row('Working', `${workers} of ${g.workerCap}`, 'Wildermon set to work the deed, of the number the settlement has work for at its level.'));
    this.body.append(this.row('In creature crates', String(crated), 'Yours, shut in creature crates: neither working nor following you.'));
    this.body.append(this.row('Orders', STANCE_NAMES[g.deedStance()], 'What every wildermon on the deed does when something walks in.'));
    this.body.append(this.place('The token', d.x, d.y));
    // Who lives here and the settlement's ranks, from the island's social answer.
    this.roll?.prime();
    const here: MyDeed | undefined = this.roll?.known()?.deeds.find((e) => e.x === d.x && e.y === d.y);
    if (this.roll && !here) {
      this.body.append(this.head('Citizens'));
      const wait = document.createElement('div');
      wait.className = 'deed-note';
      wait.textContent = 'Asking the island who lives here…';
      this.body.append(wait);
    } else if (here) {
      this.drawRoll(here);
      this.drawRanks(here);
    }

    // What the next level wants, and the button that buys it.
    this.body.append(this.head(level < MAX_DEED_LEVEL ? `Growing to level ${level + 1}` : 'Fully grown'));
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
      btn.title = why ?? 'Everything is in place. Take the settlement up a level.';
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
    this.body.append(this.head('What stands here'));
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
      bare.textContent = 'Bare ground so far. Everything you build inside the border is counted here.';
      this.body.append(bare);
    }

    // What the baubles in its sockets give, added up, and how full the sockets are.
    const set = d.baubles ?? [];
    if (set.length || altars.length) {
      this.body.append(this.head('Baubles in the altar'));
      for (const t of BAUBLE_TIERS) {
        this.body.append(this.row(`${t.name} sockets`, `${socketsOf(d, t.id).filter(Boolean).length} of ${t.slots}`));
      }
      for (const line of baubleSummary(set)) {
        const cap = line.capped ? 'at the cap' : '';
        this.body.append(this.row(line.text, cap, line.capped ? 'More is set than counts: the rest is lost to the cap until one is replaced.' : undefined));
      }
      const who = document.createElement('div');
      who.className = 'deed-note';
      who.textContent = set.length
        ? baublesFor(here)
        : 'No bauble is set yet. Restore one and set it at the altar.';
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
      if (tail.childElementCount) this.body.append(this.head('The settlement itself'), tail);
      return;
    }
    this.body.append(this.head('Orders for everything kept here'));
    const stance = g.deedStance();
    const row = document.createElement('div');
    row.className = 'deed-buttons';
    for (const st of STANCES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small' + (st === stance ? ' tb-on' : '');
      b.textContent = STANCE_NAMES[st];
      b.title = st === 'aggressive' ? 'Goes for anything wild that crosses the border' : st === 'defensive' ? 'Fights back when it or you are attacked' : 'Never fights, whatever walks in';
      b.addEventListener('click', () => {
        g.setDeedStance(st);
        this.render();
      });
      row.append(b);
    }
    this.body.append(row);
    this.body.append(tail);
  }
}
