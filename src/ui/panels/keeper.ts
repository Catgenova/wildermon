import type { Island } from '../../net/island';
import type { Game } from '../../game/game';
import { heardLine, KEEPER_REFRESH, moveHint, moveTarget, MUTE_FOR, MUTE_SHUTS, muteLabel, muteLine, muteNote, type Kept, type KeptBody } from '../../game/keeper';
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
 */
export class KeeperPanel {
  private readonly page: HTMLDivElement;
  private seen: Kept | null = null;
  private failed = false;
  private asking = false;
  private lastAsk = -1e9;
  /** The watch's flags: a section of its own, asked for whenever the list is. */
  private readonly flags: KeeperFlags;

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
    void this.flags.refresh();
    let got: Kept | null = null;
    try {
      got = await this.island.kept();
    } finally {
      this.asking = false;
    }
    this.failed = !got;
    if (got) this.seen = got;
    this.draw();
  }

  /** Do a thing, say why it would not, and look again either way. What it did, the island says in the log. */
  private async did(what: Promise<string | null>): Promise<void> {
    const why = await what;
    if (why) this.game.logMsg(why, 'error');
    await this.refresh(performance.now() / 1000);
  }

  private draw(): void {
    const top = this.page.scrollTop;
    this.page.replaceChildren();
    const kept = this.seen;
    if (!kept) {
      this.say(this.failed ? `No answer from the island. Retry every ${KEEPER_REFRESH} s while open.`
        : 'Loading…', this.failed);
    } else {
      if (this.failed) this.say(`No answer just now: showing the last answer. Retry every ${KEEPER_REFRESH} s.`, true);
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
      + `Mute: refuses ${MUTE_SHUTS}. Clear a ground pile: right-click its tile.`);
    this.page.append(this.flags.el);
    // Asked again every so often: the list stays where it was being read.
    this.page.scrollTop = top;
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
    facts.className = `social-where keeper-facts${b.muted ? ' keeper-muted' : ''}`;
    facts.textContent = [`${b.x}, ${b.y}`, heardLine(b.heard), muteLine(b, clockIn)].filter((s) => s).join(' · ');
    who.append(name, facts);
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    acts.append(this.button('Move', `${moveHint(b, kept.spawn)} Asks to confirm.`, () => {
      void this.game.hooks.confirm(`${moveHint(b, kept.spawn).replace(/\.$/, '')}?`).then((yes) => {
        if (yes) void this.did(this.island.keeperMove(b.uid));
      });
    }));
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
    acts.append(mute);
    // Unmute keeps its place, hidden, on a row with no mute, so Move and Mute stand in one column down the list.
    const unmute = this.button('Unmute', `Unmute: ${MUTE_SHUTS} allowed again`,
      () => void this.did(this.island.keeperUnmute(b.uid)));
    if (!b.muted) {
      unmute.classList.add('keeper-gap');
      unmute.disabled = true;
      unmute.tabIndex = -1;
      unmute.setAttribute('aria-hidden', 'true');
    }
    acts.append(unmute);
    el.title = `Move to: ${moveTarget(b, kept.spawn)}.`;
    el.append(dot, who, acts);
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
