import type { Island } from '../../net/island';
import type { Game } from '../../game/game';
import { awayFor } from '../../game/away';
import { flagLabel, flagLine, type WatchFlag, type WatchFlags } from '../../game/watch';

/**
 * The Flags section of the Island keeper window: what the island's watch has
 * raised (`rpc_owner_flags`), newest first, each with Seen, and Seen on all of
 * them at once.
 *
 * A section of its own, with its own element and its own ask, so the window
 * only has to put `el` where it goes and call `refresh` when it asks again.
 */
export class KeeperFlags {
  readonly el: HTMLDivElement;
  private seen: WatchFlags | null = null;
  private failed = false;
  private asking = false;

  constructor(private readonly game: Game, private readonly island: Island) {
    this.el = document.createElement('div');
    this.el.className = 'keeper-flags';
    this.draw();
  }

  async refresh(): Promise<void> {
    if (this.asking) return;
    this.asking = true;
    let got: WatchFlags | null = null;
    try {
      got = await this.island.keeperFlags();
    } finally {
      this.asking = false;
    }
    this.failed = !got;
    if (got) this.seen = got;
    this.draw();
  }

  private async mark(n: number | null): Promise<void> {
    const why = await this.island.keeperFlagSeen(n);
    if (why) this.game.logMsg(why, 'error');
    await this.refresh();
  }

  private draw(): void {
    this.el.replaceChildren();
    const got = this.seen;
    const head = document.createElement('div');
    head.className = 'deed-head keeper-flags-head';
    head.textContent = got ? `Flags (${got.open} open)` : 'Flags';
    if (got && got.open > 0) {
      head.append(this.button('All seen', 'Mark every open flag seen', () => void this.mark(null)));
    }
    this.el.append(head);
    if (!got) {
      this.note(this.failed ? 'No answer from the island.' : 'Loading…', this.failed);
      return;
    }
    if (this.failed) this.note('No answer just now: showing the last answer.', true);
    if (!got.flags.length) {
      const el = document.createElement('div');
      el.className = 'inv-empty';
      el.textContent = 'No flags.';
      this.el.append(el);
      return;
    }
    for (const f of got.flags) this.el.append(this.row(f));
  }

  private row(f: WatchFlag): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `social-row keeper-row keeper-flag${f.seen ? ' keeper-flag-seen' : ''}`;
    const dot = document.createElement('span');
    dot.className = `social-dot${f.seen ? '' : ' social-on'}`;
    dot.title = f.seen ? 'Seen' : 'Open';
    const who = document.createElement('span');
    who.className = 'keeper-who';
    const name = document.createElement('span');
    name.className = 'social-name';
    name.textContent = f.name ? `${flagLabel(f.kind)}: ${f.name}` : flagLabel(f.kind);
    const facts = document.createElement('span');
    facts.className = 'social-where keeper-facts';
    facts.textContent = `${flagLine(f)} · ${awayFor(f.ago)} ago`;
    who.append(name, facts);
    const acts = document.createElement('span');
    acts.className = 'social-acts';
    const seen = this.button('Seen', 'Mark this flag seen', () => void this.mark(f.n));
    if (f.seen) {
      seen.classList.add('keeper-gap');
      seen.disabled = true;
      seen.tabIndex = -1;
      seen.setAttribute('aria-hidden', 'true');
    }
    acts.append(seen);
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

  private note(text: string, bad: boolean): void {
    const el = document.createElement('div');
    el.className = `skill-note market-note${bad ? ' keeper-stale' : ''}`;
    el.textContent = text;
    this.el.append(el);
  }
}
