import { LETTER_MAX, type Folk, type Island, type JoinRequest, type Letter, type MyDeed, type Social } from '../../net/island';
import { DEEDS_JOINED, type DeedRole, type Game } from '../../game/game';
import { DEFAULT_RANKS, deedMay, FOUNDER, lacks, NEWCOMER_RANK, permsOf, rankMay, rankName, type RankDef, type Ranked } from '../../game/ranks';
import { leaveQuestion } from '../../game/deed';
import { BARTER_REACH } from '../../game/barter';
import type { UIWindow } from '../windows';

/** How often the window asks again while it is open. */
const REFRESH = 6;

/**
 * Everybody, and what they are to you.
 *
 * Three tabs, because they are three questions somebody asks at three
 * different moments: *who is waiting on me*, *who do I know and where are
 * they*, and *what has been said*. One window rather than three because they
 * are all one thing — the people on this island — and because the first of
 * them is a thing you answer once and never think about again.
 *
 * The whole page comes from one ask (`rpc_social`), so it is never half one
 * moment and half another. It asks again while it is open and after anything
 * it does, and not at all while it is shut: an invitation and a friend's
 * asking both announce themselves in the log the second they happen, which is
 * what actually needs to be prompt.
 */
/**
 * Everybody off the same land as you, each of them once.
 *
 * A person on two of your settlements is one person.
 */
export function neighbours(s: Social): Folk[] {
  const by = new Map<string, Folk>();
  for (const d of s.deeds) for (const f of d.folk) if (!by.has(f.uid)) by.set(f.uid, f);
  return [...by.values()];
}

/**
 * Everybody you may write to, each of them once.
 *
 * Friends first, then whoever you share land with, then anybody who has
 * written to you and is neither. Filed by uid because those three lists
 * overlap: a friend you also live with was appearing twice in the Letters tab,
 * which is what was reported. The Friends tab has always folded the same two
 * together through a `Set` and this one concatenated them — the same list said
 * twice, three lines apart in one file.
 *
 * Out here rather than inside the drawing so that it can be read on its own
 * and checked on its own. A rule buried in DOM building is a rule nothing can
 * ask a question of.
 */
export function writeTo(s: Social): Folk[] {
  const by = new Map<string, Folk>();
  for (const f of [...s.friends, ...neighbours(s)]) if (!by.has(f.uid)) by.set(f.uid, f);
  for (const u of s.unread) if (!by.has(u.uid)) by.set(u.uid, { uid: u.uid, name: u.name, online: false });
  return [...by.values()];
}

/**
 * Whether somebody is on as many other people's settlements as anybody may be.
 *
 * Counted by the island (`joined`, which is `deeds_joined_by`), so this and
 * `rpc_invite` cannot disagree about who has room.
 */
export const rollFull = (s: Social, uid: string): boolean => (s.joined?.[uid] ?? 0) >= DEEDS_JOINED;

/**
 * Your rank on one of your settlements, in lower case: the island's word for
 * it, or, from an island that predates mayors and does not say, founder where
 * you planted the stake and builder anywhere else.
 */
export const myRank = (d: MyDeed): DeedRole => d.role ?? (d.mine ? FOUNDER : 'builder');

/** One of your settlements as the rules in `ranks.ts` ask about it: what you are there and what your rank may do. */
export const asRanked = (d: MyDeed): Ranked => ({ name: d.name, role: myRank(d), rank: d.rank, perms: d.perms });

/** Somebody's rank on a settlement of yours, in lower case, or undefined when they are not on its roll. */
export function rankOf(d: MyDeed, uid: string): DeedRole | undefined {
  if (uid === d.founder) return FOUNDER;
  return d.ranks?.[uid] ?? (d.folk.some((f) => f.uid === uid) ? 'builder' : undefined);
}

/**
 * A settlement's ranks, highest first. From an island from before custom
 * ranks, the three every settlement had, counted off `ranks`.
 */
export function defsOf(d: MyDeed): RankDef[] {
  if (d.defs) return [...d.defs].sort((a, b) => a.ord - b.ord || a.id - b.id);
  return DEFAULT_RANKS.map((r, i) => ({
    id: -(i + 1), name: r.name, ord: i + 1, perms: permsOf(r.powers), newcomer: r.name === NEWCOMER_RANK,
    held: Object.values(d.ranks ?? {}).filter((x) => x === r.name.toLowerCase()).length,
  }));
}

/** Somebody's rank on a settlement of yours as the settlement lists it, or undefined for its founder and a stranger. */
export function defOf(d: MyDeed, uid: string): RankDef | undefined {
  const id = d.held?.[uid];
  const role = rankOf(d, uid);
  return defsOf(d).find((r) => (id !== undefined ? r.id === id : r.name.toLowerCase() === role));
}

/** Your own place in a settlement's list: 0 for its founder, above everybody; your rank's place otherwise. */
const myPlace = (d: MyDeed): number =>
  (myRank(d) === FOUNDER ? 0 : defsOf(d).find((r) => r.name.toLowerCase() === myRank(d))?.ord ?? Infinity);

/** The settlements you may ask people onto: the one you founded, and every one your rank on holds Invite. */
export const inviteDeeds = (s: Social): MyDeed[] => s.deeds.filter((d) => deedMay(asRanked(d), 'invite'));

/**
 * Whether you may ask somebody onto a settlement, and if not, why: the same
 * checks as `rpc_invite`, in its order and its words. The settlement is named
 * by its founder; left out, it is the one you founded, which is what the
 * island takes when a browser does not say.
 *
 * Its founder, or a citizen whose rank holds Invite, may ask. Living
 * somewhere already is no bar. One settlement is yours and `DEEDS_JOINED`
 * more may be other people's, whether or not you hold one, and only somebody
 * already on that many rolls is refused. Reported from the island: "I don't
 * have an invite option for you and [another player] since we're already in a
 * deed."
 */
export function inviteRefusal(s: Social, uid: string, name: string, founder?: string): string | null {
  const d = founder === undefined ? s.deeds.find((e) => e.mine) : s.deeds.find((e) => e.founder === founder);
  if (!d) return founder === undefined ? 'No settlement to invite to.' : 'Settlement gone.';
  const no = lacks(asRanked(d), 'invite');
  if (no) return no;
  if (rankOf(d, uid)) return `${name}: already a citizen.`;
  if (rollFull(s, uid)) {
    return `${name}: citizen of ${DEEDS_JOINED} settlements (max).`;
  }
  // An island from before mayors lists only the founder's own, without saying whose.
  const own = s.deeds.find((e) => e.mine)?.founder;
  if (s.sent.some((w) => w.uid === uid && (w.founder ?? own) === d.founder)) {
    return `${name}: invitation pending.`;
  }
  return null;
}

/**
 * Whether you may give somebody a rank of a settlement of yours, by the
 * rank's name, and if not, why: `rpc_rank`'s checks, in its order and its
 * words.
 *
 * Its founder gives anybody else on the roll any of its ranks. A citizen
 * whose rank holds Set ranks gives somebody ranked below them a rank below
 * their own. Nobody changes the founder's rank or their own.
 */
export function rankRefusal(d: MyDeed, me: string, uid: string, name: string, rank: string): string | null {
  const no = lacks(asRanked(d), 'set_ranks');
  if (no) return no;
  if (uid === me) return 'Cannot change your own rank.';
  if (uid === d.founder) return `Cannot change the founder's rank at ${d.name}.`;
  const theirs = defOf(d, uid);
  if (!theirs) return `${name}: not a citizen of ${d.name}.`;
  const to = defsOf(d).find((r) => r.name.toLowerCase() === rank.trim().toLowerCase());
  if (!to) return `${d.name}: no rank named ${rank.trim()}.`;
  if (myRank(d) !== FOUNDER) {
    const mine = myPlace(d);
    const mineName = rankName(asRanked(d));
    if (theirs.ord <= mine) return `${name} holds ${theirs.name} at ${d.name}; your rank (${mineName}) sets ranks only below it.`;
    if (to.ord <= mine) return `Your rank at ${d.name} (${mineName}) gives only ranks below it.`;
  }
  if (theirs.id === to.id) return `${name}: already ${to.name} at ${d.name}.`;
  return null;
}

/** What somebody is told when they are given a rank: `rpc_rank`'s line, word for word. */
export const rankedLine = (by: string, rank: string, deed: string, perms: number): string =>
  `Rank at ${deed}: ${rank} (from ${by}). Allowed: ${rankMay(perms)}.`;

/** What somebody is told when they say yes to an invitation: `rpc_invite_answer`'s line, word for word. */
export const joinedLine = (deed: string, rank: string, perms: number): string =>
  `Citizen of ${deed}: rank ${rank}. Allowed: ${rankMay(perms)}.`;

/**
 * Whether you may take somebody off the roll of a settlement of yours -- or
 * yourself, with your own uid -- and if not, why: `rpc_leave_deed`'s checks,
 * in its order and its words. Its founder sends away anybody; a citizen whose
 * rank holds Send away sends away anybody ranked below them.
 */
export function sendAwayRefusal(d: MyDeed, me: string, uid: string): string | null {
  if (uid !== me && uid === d.founder) return `Cannot send away the founder of ${d.name}.`;
  const onRoll = uid === me ? !d.mine : !!rankOf(d, uid);
  if (!onRoll) return 'Not on the roll.';
  if (uid !== me) {
    const no = lacks(asRanked(d), 'send_away');
    if (no) return no;
    if (myRank(d) !== FOUNDER) {
      const theirs = defOf(d, uid);
      const name = d.folk.find((f) => f.uid === uid)?.name ?? 'somebody';
      if (theirs && theirs.ord <= myPlace(d)) {
        return `${name} holds ${theirs.name} at ${d.name}; your rank (${rankName(asRanked(d))}) sends away only ranks below it.`;
      }
    }
  }
  return null;
}

/**
 * The ranks you may give somebody on a settlement of yours, highest first:
 * every one, for its founder; for a rank holding Set ranks, those below it,
 * and only to somebody ranked below it. Empty where you may give none.
 */
export function ranksToGive(d: MyDeed, me: string, uid: string, name: string): RankDef[] {
  const now = defOf(d, uid)?.id;
  const open = defsOf(d).filter((r) => !rankRefusal(d, me, uid, name, r.name));
  return open.length ? defsOf(d).filter((r) => r.id === now || open.includes(r)) : [];
}

/**
 * Whether you may take up an invitation, and if not, why: the one refusal in
 * `rpc_invite_answer`, a full roll, in its words. The invitation is left
 * standing, so leaving a settlement is all it takes.
 */
export function moveInRefusal(s: Social): string | null {
  if (s.room > 0) return null;
  return `Citizen of ${DEEDS_JOINED - s.room} settlements (max). Leave one first.`;
}

/**
 * Whether somebody who asked may be let in, and if not, why: the one refusal
 * in `rpc_join_answer` past the rank, a full roll, in its words. The ask is
 * left standing.
 */
export const letInRefusal = (q: Pick<JoinRequest, 'name' | 'joined'>): string | null =>
  q.joined < DEEDS_JOINED ? null : `${q.name}: citizen of ${q.joined} settlements, the most allowed.`;

/** How long an answer is trusted by somebody who is not looking at the window. */
const STALE = 60;

export class SocialPanel {
  private readonly bar: HTMLDivElement;
  private readonly page: HTMLDivElement;
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private tab: 'waiting' | 'friends' | 'letters' = 'waiting';
  private seen: Social | null = null;
  /**
   * Which settlement Invite asks people onto, by its founder, when you may
   * invite to more than one: chosen at the top of the Friends tab. Null, or
   * one you may no longer invite to, is the first of them -- your own.
   */
  private inviteFrom: string | null = null;
  /** Ask somebody to trade (the Trade window's `ask`), beside everybody ashore; unset, there is no Trade button. */
  trade: ((uid: string) => void) | null = null;

  /**
   * Everybody this body could reasonably deal with, which is the same roll it
   * could write to: friends, whoever shares land with you, and anybody who
   * has written. Handed out so the Market window has one list rather than a
   * second one that could disagree with this.
   */
  folk(): Folk[] {
    return this.seen ? writeTo(this.seen) : [];
  }
  private asking = false;
  private lastAsk = -1e9;
  /** When the island last answered, by the wall clock, for `known`. */
  private seenAt = -1e12;
  /** Whose thread is open on the letters tab, and what is in it. */
  private talkingTo: Folk | null = null;
  private thread: Letter[] = [];
  private draft = '';

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly island: Island | null,
  ) {
    win.body.classList.add('social-body');
    this.bar = document.createElement('div');
    this.bar.className = 'log-tabs';
    for (const [id, label, title] of [
      ['waiting', 'Waiting', 'Invitations and requests to answer'],
      ['friends', 'Friends', 'Friends and locations'],
      ['letters', 'Letters', 'Messages'],
    ] as Array<['waiting' | 'friends' | 'letters', string, string]>) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tb-btn tb-small log-tab${id === this.tab ? ' tb-on' : ''}`;
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => {
        this.tab = id;
        this.talkingTo = null;
        this.draw();
        this.page.scrollTop = 0;
      });
      this.tabs.set(id, b);
      this.bar.append(b);
    }
    this.page = document.createElement('div');
    this.page.className = 'social-page';
    win.body.append(this.bar, this.page);
    win.onOpen = () => void this.refresh(true);
    this.draw();
  }

  /** Ask again now and then, while anybody is looking. */
  update(now: number): void {
    if (!this.win.isOpen || now - this.lastAsk < REFRESH) return;
    this.lastAsk = now;
    void this.refresh(false);
  }

  /**
   * The island's last answer, while it is recent enough to refuse something
   * on: the right-click menu greys Invite out with the window's own reason,
   * and an answer from ten minutes ago would say "already asked" of somebody
   * who has since said no. Null means the menu offers it and the island says.
   */
  known(): Social | null {
    return this.seen && Date.now() - this.seenAt < STALE * 1000 ? this.seen : null;
  }

  /** Ask the island again if the last answer is older than the window's own beat. */
  prime(): void {
    if (Date.now() - this.seenAt >= REFRESH * 1000) void this.refresh(true);
  }

  /** Ask the island again now, after something changed what it would say. */
  again(): Promise<void> {
    return this.refresh(true);
  }

  /** Your own uid on the island, which the rank and send-away rules ask after; empty off one. */
  private me(): string {
    return this.island?.uid ?? '';
  }

  /** Open on somebody, from wherever they were picked. */
  openOn(uid: string, tab: 'friends' | 'letters' = 'letters'): void {
    this.tab = tab;
    this.talkingTo = null;
    this.win.open();
    void this.refresh(true).then(() => {
      const who = this.find(uid);
      if (who && tab === 'letters') void this.openThread(who);
    });
  }

  private find(uid: string): Folk | null {
    const s = this.seen;
    if (!s) return null;
    return [...s.friends, ...this.neighbours(s), ...s.here].find((f) => f.uid === uid) ?? null;
  }

  /** Everybody off every roll of yours, each named once however many you share. */
  private neighbours(s: Social): Folk[] {
    return neighbours(s);
  }

  private async refresh(force: boolean): Promise<void> {
    if (!this.island || this.asking) return;
    if (!force && !this.win.isOpen) return;
    this.asking = true;
    try {
      const said = await this.island.social();
      if (said) {
        this.seen = said;
        this.seenAt = Date.now();
      }
    } finally {
      this.asking = false;
    }
    this.draw();
  }

  /** Ask first, then do it: for what cannot be taken back with one click. */
  private async sure(question: string, go: () => Promise<string | null>): Promise<void> {
    if (await this.game.hooks.confirm(question)) await this.did(go());
  }

  /** Do a thing, say why it would not, and look again either way. */
  private async did(what: Promise<string | null>): Promise<void> {
    const why = await what;
    if (why) this.game.logMsg(why, 'error');
    await this.refresh(true);
  }

  private async openThread(who: Folk): Promise<void> {
    if (!this.island) return;
    // From wherever it was asked for: `Write` sits on the Friends tab too, and
    // the thread is only drawn on this one.
    this.tab = 'letters';
    this.talkingTo = who;
    this.thread = await this.island.letters(who.uid);
    this.draw();
    // Reading the thread is what marks it read, so the count on the tab has
    // to come from a fresh ask rather than from the page it was drawn with.
    void this.refresh(true);
  }

  // -- the furniture ---------------------------------------------------------

  private head(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'deed-head';
    el.textContent = text;
    return el;
  }

  private empty(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'inv-empty';
    el.textContent = text;
    return el;
  }

  private button(label: string, title: string, go: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-btn tb-small social-do';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', go);
    return b;
  }

  /**
   * One person: a light for whether they are about, a name, and what you can
   * do. `rank`, under a settlement, goes small beneath the name, so the
   * buttons beside it leave the name room.
   */
  private row(who: Folk, note: string, acts: HTMLButtonElement[], rank?: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'social-row';
    const dot = document.createElement('span');
    dot.className = `social-dot${who.online ? ' social-on' : ''}`;
    dot.title = who.online ? 'Ashore' : 'Away';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = who.name;
    name.title = who.name;
    if (rank) {
      const r = document.createElement('span');
      r.className = 'social-rank';
      r.textContent = rank;
      name.append(r);
    }
    const where = document.createElement('span');
    where.className = 'social-where';
    where.textContent = note;
    const doing = document.createElement('span');
    doing.className = 'social-acts';
    doing.append(...acts);
    el.append(dot, name, where, doing);
    return el;
  }

  /** A row that is a question rather than a person: a name, a note, and buttons. */
  private plain(text: string, note: string, acts: HTMLButtonElement[]): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'social-row social-ask';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = text;
    const where = document.createElement('span');
    where.className = 'social-where';
    where.textContent = note;
    const doing = document.createElement('span');
    doing.className = 'social-acts';
    doing.append(...acts);
    el.append(name, where, doing);
    return el;
  }

  /** The settlement Invite asks onto: the one chosen, or the first you may invite to. */
  private inviteTarget(s: Social): MyDeed | undefined {
    const can = inviteDeeds(s);
    return can.find((d) => d.founder === this.inviteFrom) ?? can[0];
  }

  /** Trade, beside anybody ashore: the island says whether they are near enough. */
  private tradeButton(who: Folk): HTMLButtonElement | null {
    const go = this.trade;
    if (!go || !who.online || who.uid === this.me()) return null;
    return this.button('Trade', `Request trade with ${who.name}. Range: ${BARTER_REACH} tiles.`, () => go(who.uid));
  }

  /**
   * Invite, beside anybody not already on the roll of the settlement Invite
   * asks onto (`inviteTarget`), wherever the window lists them. Greyed with
   * the island's reason when there is one, and labelled with it: "Citizen of
   * 3" when they are on as many rolls as anybody may be, "Asked" when they
   * have not answered. Nothing for somebody who may invite nobody anywhere,
   * or somebody already on that settlement.
   */
  private inviteButton(s: Social, who: Folk): HTMLButtonElement | null {
    const isle = this.island;
    const d = this.inviteTarget(s);
    if (!isle || !d || rankOf(d, who.uid)) return null;
    const why = inviteRefusal(s, who.uid, who.name, d.founder);
    const label = !why ? 'Invite' : rollFull(s, who.uid) ? `Citizen of ${DEEDS_JOINED}` : 'Asked';
    const b = this.button(label, why ?? `Ask ${who.name} to live at ${d.name}`,
      () => void this.did(isle.invite(who.uid, d.founder)));
    b.disabled = !!why;
    return b;
  }

  /**
   * Which settlement Invite asks onto, when you may invite to more than one
   * (its founder, or a rank there holding Invite): a button for each, the one in use lit. Nothing when there
   * is one or none, because then there is nothing to choose.
   */
  private invitePicker(s: Social): HTMLDivElement | null {
    const can = inviteDeeds(s);
    if (can.length < 2) return null;
    const at = this.inviteTarget(s);
    const el = document.createElement('div');
    el.className = 'social-row social-ask social-pick';
    const text = document.createElement('span');
    text.className = 'social-name';
    text.textContent = 'Invite to';
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    for (const d of can) {
      const b = this.button(d.name, `Invite to ${d.name} (your rank: ${rankName(asRanked(d))})`, () => {
        this.inviteFrom = d.founder;
        this.draw();
      });
      b.classList.toggle('tb-on', d === at);
      acts.append(b);
    }
    el.append(text, acts);
    return el;
  }

  /** Where somebody is, when the island is willing to say. */
  private whereabouts(who: Folk): string {
    if (!who.online) return 'away';
    if (typeof who.x !== 'number' || typeof who.y !== 'number') return 'ashore';
    return `${who.x}, ${who.y}`;
  }

  // -- the pages -------------------------------------------------------------

  private draw(): void {
    const s = this.seen;
    const waiting = s ? s.invites.length + s.asked.length + (s.requests?.length ?? 0) : 0;
    const unread = s ? s.unread.reduce((n, u) => n + u.n, 0) : 0;
    this.tabs.get('waiting')?.classList.toggle('log-waiting', waiting > 0);
    const wt = this.tabs.get('waiting');
    if (wt) wt.textContent = waiting ? `Waiting (${waiting})` : 'Waiting';
    this.tabs.get('letters')?.classList.toggle('log-waiting', unread > 0);
    const lt = this.tabs.get('letters');
    if (lt) lt.textContent = unread ? `Letters (${unread})` : 'Letters';
    for (const [id, b] of this.tabs) b.classList.toggle('tb-on', id === this.tab);

    this.page.replaceChildren();
    this.page.classList.toggle('social-talking', this.tab === 'letters' && !!this.talkingTo);
    if (!this.island) {
      this.page.append(this.empty('Social: island only.'));
      return;
    }
    if (!s) {
      this.page.append(this.empty('Loading…'));
      return;
    }
    if (this.tab === 'waiting') this.drawWaiting(s);
    else if (this.tab === 'friends') this.drawFriends(s);
    else this.drawLetters(s);
  }

  /** Everything that wants a yes or a no, and nothing that does not. */
  private drawWaiting(s: Social): void {
    const isle = this.island;
    if (!isle) return;
    const requests = s.requests ?? [];
    const requesting = s.requesting ?? [];
    if (!s.invites.length && !s.asked.length && !s.sent.length && !s.asking.length && !requests.length && !requesting.length) {
      this.page.append(this.empty('Nothing waiting. Right-click a player to invite or befriend.'));
      return;
    }
    if (requests.length) {
      this.page.append(this.head('Asking to join'));
      for (const q of requests) {
        const full = letInRefusal(q);
        const letIn = this.button('Let in', full ?? `${q.name} becomes a citizen of ${q.deed}`,
          () => void this.did(isle.answerJoin(q.founder, q.uid, true)));
        letIn.disabled = !!full;
        this.page.append(this.plain(q.name, `to ${q.deed} · citizen of ${q.joined}`, [
          letIn,
          this.button('No', `Turn ${q.name} down`, () => void this.did(isle.answerJoin(q.founder, q.uid, false))),
        ]));
      }
    }
    if (s.invites.length) {
      this.page.append(this.head('Invitations received'));
      const full = moveInRefusal(s);
      if (full) this.page.append(this.empty(full));
      for (const inv of s.invites) {
        const moveIn = this.button('Move in', full ?? `Join ${inv.deed} as a citizen`,
          () => void this.did(isle.answerInvite(inv.founder, true)));
        moveIn.disabled = !!full;
        this.page.append(this.plain(inv.deed, `from ${inv.by}`, [
          moveIn,
          this.button('No', `Turn ${inv.by} down`, () => void this.did(isle.answerInvite(inv.founder, false))),
        ]));
      }
    }
    if (s.asked.length) {
      this.page.append(this.head('Friend requests received'));
      for (const who of s.asked) {
        this.page.append(this.plain(who.name, '', [
          this.button('Yes', `${who.name} becomes a friend`, () => void this.did(isle.befriend(who.uid))),
          this.button('No', `Turn ${who.name} down`, () => void this.did(isle.unfriend(who.uid))),
        ]));
      }
    }
    if (s.sent.length) {
      this.page.append(this.head('Invitations sent'));
      for (const who of s.sent) {
        this.page.append(this.plain(who.name, who.deed ? `to ${who.deed}, not answered` : 'not answered', []));
      }
    }
    if (requesting.length) {
      this.page.append(this.head('Settlements you have asked to join'));
      for (const q of requesting) {
        this.page.append(this.plain(q.deed, 'not answered',
          [this.button('Withdraw', 'Take the ask back', () => void this.did(isle.withdrawJoin(q.founder)))]));
      }
    }
    if (s.asking.length) {
      this.page.append(this.head('Friend requests sent'));
      for (const who of s.asking) {
        this.page.append(this.plain(who.name, 'not answered',
          [this.button('Withdraw', 'Withdraw request', () => void this.did(isle.unfriend(who.uid)))]));
      }
    }
  }

  /** Who you know, who you live with, and everybody else on the island. */
  private drawFriends(s: Social): void {
    const isle = this.island;
    if (!isle) return;
    const pick = this.invitePicker(s);
    if (pick) this.page.append(pick);
    this.page.append(this.head(`Friends (${s.friends.length})`));
    if (!s.friends.length) {
      this.page.append(this.empty('None. Right-click a player, or pick a name below.'));
    }
    for (const who of s.friends) {
      const acts = [
        this.button('Write', `Write to ${who.name}`, () => void this.openThread(who)),
        this.button('Drop', `Remove ${who.name} from friends (asks to confirm).`,
          () => void this.sure(`Remove ${who.name} from friends? Re-friending needs a new request and acceptance.`, () => isle.unfriend(who.uid))),
      ];
      const ask = this.inviteButton(s, who);
      if (ask) acts.unshift(ask);
      const trade = this.tradeButton(who);
      if (trade) acts.unshift(trade);
      this.page.append(this.row(who, this.whereabouts(who), acts));
    }

    for (const d of s.deeds) this.drawDeed(s, d);
    if (!s.deeds.length) {
      this.page.append(this.head('Settlements'));
      this.page.append(this.empty('No settlement. Found one, or accept an invitation.'));
    } else if (s.room > 0) {
      this.page.append(this.empty(`Citizenships left: ${s.room}.`));
    } else {
      this.page.append(this.empty(`Citizen of ${DEEDS_JOINED} other settlements (max).`));
    }

    const known = new Set([...s.friends, ...this.neighbours(s)].map((f) => f.uid));
    const strangers = s.here.filter((f) => !known.has(f.uid));
    this.page.append(this.head(`Others ashore (${strangers.length})`));
    if (!strangers.length) this.page.append(this.empty('None.'));
    for (const who of strangers) {
      const acts = [
        this.button('Befriend', `Ask ${who.name} to be a friend`, () => void this.did(isle.befriend(who.uid))),
        this.button('Write', `Write to ${who.name}`, () => void this.openThread(who)),
      ];
      const ask = this.inviteButton(s, who);
      if (ask) acts.unshift(ask);
      const trade = this.tradeButton(who);
      if (trade) acts.unshift(trade);
      this.page.append(this.row(who, this.whereabouts(who), acts));
    }
    /*
     * And why a stranger has a place beside their name, which will one day
     * stop being true without anybody deploying anything. Said here rather
     * than left to be noticed: the island decides this on a headcount, and a
     * rule that changes itself is a rule people should be able to read.
     */
    if (s.open !== undefined) {
      this.page.append(this.empty(s.open
        ? `Under ${s.crowd ?? 0} players: everyone shown on your map.`
        : `${s.crowd ?? 0}+ players: only friends and neighbours shown.`));
    }
  }


  /**
   * One settlement of yours: who lives on it and at what rank, and the way off it.
   *
   * The same block whether you planted the stake or were asked on. Send away
   * sits beside whoever you may take off the roll -- anybody, for the
   * founder; anybody ranked below you, for a rank holding Send away -- and
   * everybody but the founder gets a way to take themselves off it.
   */
  private drawDeed(s: Social, d: MyDeed): void {
    const isle = this.island;
    if (!isle) return;
    this.page.append(this.head(`${d.name} · ${d.mine ? 'yours' : `${d.by}'s`} · ${d.x}, ${d.y}`));
    if (!d.folk.length) {
      this.page.append(this.empty(deedMay(asRanked(d), 'invite')
        ? 'No other citizens. Right-click a player to invite.'
        : 'No other citizens.'));
    }
    for (const who of d.folk) {
      const acts = [this.button('Write', `Write to ${who.name}`, () => void this.openThread(who))];
      // Somebody off one settlement of yours may be asked onto another.
      const ask = this.inviteButton(s, who);
      if (ask) acts.unshift(ask);
      const trade = this.tradeButton(who);
      if (trade) acts.unshift(trade);
      if (!sendAwayRefusal(d, this.me(), who.uid)) {
        const away = this.button('Send away', `Remove ${who.name} from ${d.name} (asks to confirm).`,
          () => void this.sure(`Send ${who.name} away from ${d.name}? Removed at once; only a new invitation restores them.`,
            () => isle.leaveDeed(d.founder, who.uid)));
        away.classList.add('tb-danger');
        acts.push(away);
      }
      this.page.append(this.row(who, this.whereabouts(who), acts, who.uid === d.founder ? 'Founder' : defOf(d, who.uid)?.name));
    }
    if (!d.mine) {
      const leave = this.button('Leave', `Leave ${d.name} (asks to confirm).`,
        () => void this.sure(leaveQuestion({ name: d.name, x: d.x, y: d.y, radius: d.radius }, d.by), () => isle.leaveDeed(d.founder)));
      leave.classList.add('tb-danger');
      this.page.append(this.plain(`Your rank at ${d.name}: ${rankName(asRanked(d))}.`, '', [leave]));
    }
  }

  /** What has been written: a list of correspondents, or one conversation. */
  private drawLetters(s: Social): void {
    const isle = this.island;
    if (!isle) return;
    if (this.talkingTo) {
      this.drawThread(this.talkingTo);
      return;
    }
    const unread = new Map(s.unread.map((u) => [u.uid, u.n]));
    // Whoever has written and not been read first, in the order the roll gives them.
    const all = writeTo(s);
    const people = [...all.filter((f) => unread.has(f.uid)), ...all.filter((f) => !unread.has(f.uid))];
    this.page.append(this.head('Write to'));
    if (!people.length) {
      this.page.append(this.empty('Friends and fellow citizens appear here. Write to anyone ashore from the Friends tab.'));
      return;
    }
    for (const who of people) {
      const n = unread.get(who.uid) ?? 0;
      const el = this.row(who, n ? `${n} waiting` : this.whereabouts(who),
        [this.button('Open', `Read letters from ${who.name}`, () => void this.openThread(who))]);
      if (n) el.classList.add('social-unread');
      this.page.append(el);
    }
  }

  /** One conversation, and the box you answer in. */
  private drawThread(who: Folk): void {
    const isle = this.island;
    if (!isle) return;
    const back = document.createElement('div');
    back.className = 'social-row social-ask';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = `${who.name} · ${this.whereabouts(who)}`;
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    acts.append(this.button('Back', 'All letters', () => {
      this.talkingTo = null;
      this.draw();
    }));
    back.append(name, acts);

    const list = document.createElement('div');
    list.className = 'social-thread';
    if (!this.thread.length) {
      list.append(this.empty(`No letters with ${who.name}.`));
    }
    for (const line of this.thread) {
      const el = document.createElement('div');
      el.className = `social-said${line.mine ? ' social-mine' : ''}`;
      const from = document.createElement('span');
      from.className = 'social-from';
      from.textContent = line.mine ? 'You' : who.name;
      const text = document.createElement('span');
      text.className = 'social-text';
      text.textContent = line.text;
      el.title = new Date(line.at * 1000).toLocaleString();
      el.append(from, text);
      list.append(el);
    }

    const write = document.createElement('form');
    write.className = 'social-write';
    const box = document.createElement('input');
    box.type = 'text';
    box.id = 'social-draft';
    box.className = 'log-search';
    box.maxLength = LETTER_MAX;
    box.placeholder = `Write to ${who.name}…`;
    box.value = this.draft;
    box.addEventListener('input', () => {
      this.draft = box.value;
    });
    const send = this.button('Send', `Send to ${who.name}`, () => void 0);
    send.type = 'submit';
    write.append(box, send);
    write.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = box.value.trim();
      if (!text) return;
      box.value = '';
      this.draft = '';
      void isle.writeTo(who.uid, text).then(async (why) => {
        if (why) this.game.logMsg(why, 'error');
        await this.openThread(who);
      });
    });

    this.page.append(back, list, write);
    // A conversation is read bottom-up, like every other one.
    list.scrollTop = list.scrollHeight;
  }
}
