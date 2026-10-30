import { SAY_MAX } from '../../game/chat';
import type { LogEntry, LogKind } from '../../game/events';
import type { Game } from '../../game/game';
import type { UIWindow } from '../windows';
import { keepControlKeys } from '../controlkeys';

/**
 * When a line was said.
 *
 * The hour alone until it is not today's hour. Lines used to be stamped with
 * the moment they reached this machine, so every one of them was from the
 * session you were sitting in and the day never needed saying; they carry
 * the island's own hour now, and a chat scrolled back far enough reaches
 * yesterday — where `09:14:02` on its own is a time that could be any day at
 * all.
 */
function stamp(t: number): string {
  const d = new Date(t);
  const two = (n: number): string => String(n).padStart(2, '0');
  const clock = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  return sameDay ? clock : `${d.getDate()} ${MONTHS[d.getMonth()]} ${clock}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The tabs along the top of the log, and which kinds of line each keeps. Exported for `supabase/test/wildermontab.ts`. */
export const TABS: Array<{ id: string; label: string; title: string; kinds: LogKind[] | null }> = [
  { id: 'all', label: 'All', title: 'All messages', kinds: null },
  { id: 'event', label: 'Work', title: 'Work results', kinds: ['event', 'info'] },
  { id: 'fight', label: 'Combat', title: 'Combat: blows dealt and taken, threats', kinds: ['fight'] },
  { id: 'wildermon', label: 'Wildermon', title: 'Wildermon: taming, crates, posts, tack, gear, breeding, evolving, settlement work, sightings', kinds: ['wildermon'] },
  { id: 'skill', label: 'Skills', title: 'Skill gains', kinds: ['skill'] },
  { id: 'chat', label: 'Social', title: 'Chat and system messages', kinds: ['chat', 'system'] },
  { id: 'error', label: 'Trouble', title: 'Errors and refusals', kinds: ['error'] },
];

/** Lines the list keeps, the oldest let go past it. */
const LIST_MAX = 400;

export class EventLogPanel {
  private list: HTMLDivElement;
  readonly input: HTMLInputElement;
  private pinned = true;
  private tab = TABS[0];
  private query = '';
  private search: HTMLInputElement;
  private tabEls = new Map<string, HTMLButtonElement>();
  private unread = new Map<string, number>();
  /** Lines come in since the list was last brought up to date, laid in together once a frame (`flush`). */
  private pending: LogEntry[] = [];
  private flushing = 0;

  constructor(
    win: UIWindow,
    private readonly game: Game,
  ) {
    win.body.classList.add('log-body');
    // Which lines are kept, and a box to look through them.
    const bar = document.createElement('div');
    bar.className = 'log-tabs';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small log-tab' + (t === this.tab ? ' tb-on' : '');
      b.textContent = t.label;
      b.title = t.title;
      b.dataset.tab = t.id;
      b.addEventListener('click', () => this.show(t.id));
      this.tabEls.set(t.id, b);
      bar.append(b);
    }
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'panel-search log-search';
    this.search.placeholder = 'Find…';
    this.search.title = 'Filter this tab; Esc clears';
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      this.search.value = '';
      this.query = '';
      this.render();
    });
    bar.append(this.search);
    this.list = document.createElement('div');
    this.list.className = 'log-list';
    this.list.addEventListener('scroll', () => {
      this.pinned = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 8;
    });
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'log-input';
    this.input.placeholder = 'Chat (Enter)';
    this.input.maxLength = SAY_MAX;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        game.say(this.input.value);
        this.input.value = '';
        this.input.blur();
      } else if (e.key === 'Escape') {
        this.input.blur();
      }
    });
    keepControlKeys(bar);
    win.body.append(bar, this.list, this.input);
    this.render();
    game.events.on('log', (entry) => this.arrived(entry));
  }

  /** Whether a line belongs on the tab being looked at, and answers the search. */
  private keeps(entry: LogEntry): boolean {
    if (this.tab.kinds && !this.tab.kinds.includes(entry.kind)) return false;
    return !this.query || entry.text.toLowerCase().includes(this.query);
  }

  /** Switch tabs, and forget what was waiting on the one switched to. */
  show(id: string): void {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return;
    this.tab = tab;
    this.unread.set(id, 0);
    for (const [key, el] of this.tabEls) el.classList.toggle('tb-on', key === id);
    this.pinned = true;
    this.render();
  }

  /** Redraw the whole list from the game's own log. */
  private render(): void {
    // Everything in the game's log, the lines waiting included.
    this.pending.length = 0;
    this.list.replaceChildren();
    let shown = 0;
    for (const entry of this.game.log) {
      if (!this.keeps(entry)) continue;
      this.list.append(this.line(entry));
      shown += 1;
    }
    if (!shown) {
      const empty = document.createElement('div');
      empty.className = 'log-line log-info';
      const where = this.tab.kinds ? `on the ${this.tab.label} tab` : 'in the log';
      empty.textContent = this.query
        ? `No match ${where}: “${this.search.value.trim()}”. Esc clears.`
        : `Nothing ${where} yet.`;
      this.list.append(empty);
    }
    this.marks();
    this.list.scrollTop = this.list.scrollHeight;
  }

  /** A line has come in: counted now, laid in with the others that come in this frame. */
  private arrived(entry: LogEntry): void {
    for (const t of TABS) {
      if (t === this.tab || (t.kinds && !t.kinds.includes(entry.kind))) continue;
      this.unread.set(t.id, (this.unread.get(t.id) ?? 0) + 1);
    }
    this.pending.push(entry);
    if (this.pending.length > LIST_MAX) this.pending.shift();
    if (!this.flushing) this.flushing = requestAnimationFrame(() => this.flush());
  }

  /** Add the lines that came in and belong here, then scroll to them once, rather than once a line. */
  private flush(): void {
    this.flushing = 0;
    this.marks();
    const lines = this.pending.filter((e) => this.keeps(e));
    this.pending.length = 0;
    if (!lines.length) return;
    // The first real line clears the "nothing of that sort" notice.
    if (this.list.firstElementChild && !this.list.querySelector('.log-time')) this.list.replaceChildren();
    this.list.append(...lines.map((e) => this.line(e)));
    while (this.list.childElementCount > LIST_MAX) this.list.firstElementChild?.remove();
    if (this.pinned) this.list.scrollTop = this.list.scrollHeight;
  }

  /** Put the waiting count on each tab that has one. */
  private marks(): void {
    for (const t of TABS) {
      const el = this.tabEls.get(t.id);
      if (!el) continue;
      const n = t === this.tab ? 0 : (this.unread.get(t.id) ?? 0);
      if (el.dataset.n === String(n)) continue;
      el.dataset.n = String(n);
      el.textContent = t.label;
      if (n) {
        const count = document.createElement('span');
        count.className = 'log-count';
        count.textContent = n > 99 ? '99+' : String(n);
        el.append(count);
      }
      el.title = n ? `${t.title} — ${n} new` : t.title;
      el.classList.toggle('log-waiting', n > 0);
    }
  }

  private line(entry: LogEntry): HTMLDivElement {
    const line = document.createElement('div');
    line.className = `log-line log-${entry.kind}`;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = `[${stamp(entry.time)}] `;
    line.append(time, document.createTextNode(entry.text));
    return line;
  }

  focus(): void {
    this.input.focus();
  }
}
