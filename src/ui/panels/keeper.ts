import type { Island } from '../../net/island';
import type { Game } from '../../game/game';
import { codeNeeded, giveCode } from '../../net/mfa';
import { awayFor } from '../../game/away';
import {
  BAR_FOR, BAR_SHUTS, barLabel, barLine, barNote, CODE_DIGITS, heardLine, KEEPER_CODE, KEEPER_REFRESH, KICK_DOES, moveHint, moveTarget,
  MUTE_FOR, MUTE_SHUTS, muteLabel, muteLine, muteNote, reportReason, type Kept, type KeptBody, type KeptReport,
} from '../../game/keeper';
import type { MenuItem } from '../contextmenu';
import type { UIWindow } from '../windows';
import { KeeperFlags } from './keeperflags';

/** When so many seconds from now is, by this machine's clock: "Fri 15:05". */
const clockIn = (secs: number): string =>
  new Date(Date.now() + secs * 1000).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The Island keeper window: everybody with a body on the island, and what a
 * keeper can do about each of them.
 *
 * Made only for somebody the island says keeps it (`rpc_owner_am_i`), and every
 * door it knocks on asks the island again, so a page that made this window for
 * somebody who does not keep the island would be refused at the first click.
 * One ask fills it (`rpc_owner_online`): when it opens, every `KEEPER_REFRESH`
 * seconds while it stays open, and after anything done from it.
 *
 * An account with two-step sign-in on (`src/net/mfa.ts`) is asked for its
 * authenticator code here first, once per sign-in: until then every keeper
 * door refuses with `KEEPER_CODE`.
 */
export class KeeperPanel {
  private readonly page: HTMLDivElement;
  private seen: Kept | null = null;
  private reports: KeptReport[] = [];
  private failed = false;
  private asking = false;
  private lastAsk = -1e9;
  /** The watch's flags: a section of its own, asked for whenever the list is. */
  private readonly flags: KeeperFlags;
  /** The island wants the authenticator code before it opens any keeper door. */
  private needCode = false;
  private codeSaid = '';
  /** Auth said no code is needed this session; asked again only when a door says otherwise. */
  private codeKnown = false;

  constructor(
    private readonly win: UIWindow,
    private readonly game: Game,
    private readonly island: Island,
    private readonly showMenu: (x: number, y: number, title: string, items: MenuItem[]) => void,
  ) {
    win.body.classList.add('social-body');
    this.page = document.createElement('div');
    this.page.className = 'social-page';
    win.body.append(this.page);
    this.flags = new KeeperFlags(game, island);
    win.onOpen = () => void this.refresh(performance.now() / 1000);
    this.draw();
  }

  /** Asked again while the window is open, and not at all while it is shut. */
  update(now: number): void {
    if (!this.win.isOpen || now - this.lastAsk < KEEPER_REFRESH) return;
    void this.refresh(now);
  }

  private async refresh(now: number): Promise<void> {
    this.lastAsk = now;
    if (this.asking) return;
    this.asking = true;
    let got: Kept | null = null;
    let reports: KeptReport[] | null = null;
    try {
      const was = this.needCode;
      if (!this.codeKnown) {
        try {
          this.needCode = await codeNeeded();
          this.codeKnown = !this.needCode;
        } catch {
          // Auth did not answer: the island still decides, and says KEEPER_CODE if it wants the code.
        }
      }
      // Not drawn again while it waits, so a code half typed stays.
      if (this.needCode) return was ? undefined : this.draw();
      void this.flags.refresh();
      [got, reports] = await Promise.all([this.island.kept(), this.island.keptReports()]);
      if (!got && this.island.keptWhy === KEEPER_CODE) {
        this.needCode = true;
        this.codeKnown = false;
        return this.draw();
      }
    } finally {
      this.asking = false;
    }
    this.failed = !got || !reports;
    if (got) this.seen = got;
    if (reports) this.reports = reports;
    this.draw();
  }

  /** Do a thing, say why it would not, and look again either way. What it did, the island says in the log. */
  private async did(what: Promise<string | null>): Promise<void> {
    const why = await what;
    if (why) this.game.logMsg(why, 'error');
    if (why === KEEPER_CODE) {
      this.needCode = true;
      this.codeKnown = false;
      this.draw();
      return;
    }
    await this.refresh(performance.now() / 1000);
  }

  private draw(): void {
    const top = this.page.scrollTop;
    this.page.replaceChildren();
    if (this.needCode) return this.codeForm();
    const kept = this.seen;
    if (!kept) {
      this.say(this.failed ? `No answer from the island. Retry every ${KEEPER_REFRESH} s while open.`
        : 'Loading…', this.failed);
    } else {
      if (this.failed) this.say(`No answer just now: showing the last answer. Retry every ${KEEPER_REFRESH} s.`, true);
      this.head(`Open reports (${this.reports.length})`);
      if (!this.reports.length) this.empty('No open reports.');
      for (const r of this.reports) this.page.append(this.reportRow(r, kept));
      const ashore = kept.people.filter((b) => !b.away);
      const away = kept.people.filter((b) => b.away);
      this.head(`Ashore (${ashore.length})`);
      if (!ashore.length) this.empty('Nobody ashore.');
      for (const b of ashore) this.page.append(this.row(b, kept));
      this.head(`Away (${away.length})`);
      if (!away.length) this.empty('Nobody away.');
      for (const b of away) this.page.append(this.row(b, kept));
    }
    // What the three buttons do, under the list they act on rather than over it.
    this.head('Actions');
    this.say('Move: to their settlement totem, or the newcomer landing; stops their action, empties their queue, '
      + 'dismounts them from anything ridden, driven, pulled or boarded. '
      + `Mute: refuses ${MUTE_SHUTS}. Kick: ${KICK_DOES}; a bar then refuses ${BAR_SHUTS}. `
      + 'Handled: off the open reports. Clear a ground pile: right-click its tile.');
    this.page.append(this.flags.el);
    // Asked again every so often: the list stays where it was being read.
    this.page.scrollTop = top;
  }

  /** Two-step sign-in is on: the code, before any keeper door opens. */
  private codeForm(): void {
    this.head('Authenticator code');
    this.say(`Authenticator sign-in: on. Keeper tools: the ${CODE_DIGITS}-digit code from your authenticator app, once per sign-in.`);
    const form = document.createElement('form');
    form.className = 'keeper-code';
    const box = document.createElement('input');
    box.type = 'text';
    box.inputMode = 'numeric';
    box.autocomplete = 'one-time-code';
    box.maxLength = 8;
    box.className = 'panel-select';
    box.setAttribute('aria-label', 'Authenticator code');
    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'tb-btn tb-small';
    go.textContent = 'Confirm';
    form.append(box, go);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      go.disabled = true;
      void giveCode(box.value).then(
        () => {
          this.needCode = false;
          this.codeKnown = true;
          this.codeSaid = '';
          void this.refresh(performance.now() / 1000);
        },
        (e: unknown) => {
          this.codeSaid = e instanceof Error ? e.message : 'Refused.';
          this.draw();
        },
      );
    });
    this.page.append(form);
    if (this.codeSaid) this.say(this.codeSaid, true);
    box.focus();
  }

  /** One body: whether they are ashore, who, where and how lately heard from, and the three things to do. */
  private row(b: KeptBody, kept: Kept): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'social-row keeper-row';
    const dot = document.createElement('span');
    dot.className = `social-dot${b.away ? '' : ' social-on'}`;
    dot.title = b.away ? 'Away' : 'Ashore';
    const who = document.createElement('span');
    who.className = 'keeper-who';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = b.you ? `${b.name} (you)` : b.keeper ? `${b.name} (keeper)` : b.name;
    name.title = b.name;
    const facts = document.createElement('span');
    facts.className = `social-where keeper-facts${b.muted || b.barred ? ' keeper-muted' : ''}`;
    facts.textContent = [`${b.x}, ${b.y}`, heardLine(b.heard), muteLine(b, clockIn), barLine(b, clockIn)].filter((s) => s).join(' · ');
    who.append(name, facts);
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    acts.append(this.button('Move', `${moveHint(b, kept.spawn)} Asks to confirm.`, () => {
      void this.game.hooks.confirm(`${moveHint(b, kept.spawn).replace(/\.$/, '')}?`).then((yes) => {
        if (yes) void this.did(this.island.keeperMove(b.uid));
      });
    }));
    acts.append(this.muteButton(b));
    // Unmute keeps its place, hidden, on a row with no mute, so Move and Mute stand in one column down the list.
    acts.append(this.gapped(this.button('Unmute', `Unmute: ${MUTE_SHUTS} allowed again`,
      () => void this.did(this.island.keeperUnmute(b.uid))), b.muted));
    // Kick is not offered on a keeper (the island refuses it), but keeps its place.
    if (!b.you && !b.keeper) acts.append(this.kickButton(b));
    else {
      const none = this.gapped(this.button('Kick', '', () => {}), false);
      none.classList.add('keeper-mute');
      acts.append(none);
    }
    acts.append(this.gapped(this.button('Unbar', `Unbar: ${BAR_SHUTS} open again`,
      () => void this.did(this.island.keeperUnbar(b.uid))), b.barred));
    el.title = `Move to: ${moveTarget(b, kept.spawn)}.`;
    el.append(dot, who, acts);
    return el;
  }

  /** Mute, and a menu of how long. */
  private muteButton(b: KeptBody): HTMLButtonElement {
    const mute = this.button(b.muted ? 'Mute again' : 'Mute',
      `Choose duration. Refuses ${MUTE_SHUTS} until then; muting again replaces the time left.`, () => {
        const r = mute.getBoundingClientRect();
        this.showMenu(r.left, r.bottom + 2, `Mute ${b.you ? 'yourself' : b.name}`, MUTE_FOR.map((secs) => ({
          label: muteLabel(secs),
          note: muteNote(secs),
          onSelect: () => void this.did(this.island.keeperMute(b.uid, secs)),
        })));
      });
    mute.classList.add('keeper-mute');
    return mute;
  }

  /** Kick, and a menu of how long a bar comes with it. Not offered on a keeper: the island refuses it. */
  private kickButton(b: KeptBody): HTMLButtonElement {
    const kick = this.button(b.barred ? 'Kick again' : 'Kick',
      `Choose: log off only, or a bar. Kick: ${KICK_DOES}. A bar refuses ${BAR_SHUTS}; kicking again replaces the time left.`, () => {
        const r = kick.getBoundingClientRect();
        this.showMenu(r.left, r.bottom + 2, `Kick ${b.name}`, BAR_FOR.map((secs) => ({
          label: barLabel(secs),
          note: barNote(secs),
          onSelect: () => void this.did(this.island.keeperKick(b.uid, secs)),
        })));
      });
    kick.classList.add('keeper-mute');
    return kick;
  }

  /** A button that keeps its place, hidden, where it does not apply, so the columns stay straight down the list. */
  private gapped(btn: HTMLButtonElement, shown: boolean): HTMLButtonElement {
    if (!shown) {
      btn.classList.add('keeper-gap');
      btn.disabled = true;
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
    }
    return btn;
  }

  /** One open report: who sent it about whom, why, when, the note, and Mute, Kick and Handled for the one reported. */
  private reportRow(r: KeptReport, kept: Kept): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'social-row keeper-row';
    const who = document.createElement('span');
    who.className = 'keeper-who';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = `${r.whom.name}: ${reportReason(r.reason)}`;
    name.title = `Reported by ${r.by.name}`;
    const facts = document.createElement('span');
    facts.className = 'social-where keeper-facts';
    facts.textContent = [`by ${r.by.name}`, r.ago < 60 ? 'just now' : `${awayFor(r.ago)} ago`,
      r.against > 1 ? `${r.against} open on them` : '', r.note ? `“${r.note}”` : ''].filter((s) => s).join(' · ');
    who.append(name, facts);
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    const body = kept.people.find((b) => b.uid === r.whom.uid);
    if (body) {
      acts.append(this.muteButton(body));
      if (!body.you && !body.keeper) acts.append(this.kickButton(body));
    }
    acts.append(this.button('Handled', 'Off the open reports. The reporter is not told.',
      () => void this.did(this.island.reportHandled(r.n))));
    el.append(who, acts);
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

  private say(text: string, bad = false): void {
    const el = document.createElement('div');
    el.className = `skill-note market-note${bad ? ' keeper-stale' : ''}`;
    el.textContent = text;
    this.page.append(el);
  }

  private head(text: string): void {
    const el = document.createElement('div');
    el.className = 'deed-head';
    el.textContent = text;
    this.page.append(el);
  }

  private empty(text: string): void {
    const el = document.createElement('div');
    el.className = 'inv-empty';
    el.textContent = text;
    this.page.append(el);
  }
}
