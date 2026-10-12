import type { Game } from '../../game/game';
import { ALL_GOALS, JOURNAL, chapterOf, nextGoals } from '../../game/journal';
import type { UIWindow } from '../windows';
import { LedgerPanel } from './ledger';

/** The journal's tabs: what there is to do, and what you have made. */
export type JournalTab = 'goals' | 'ledger';

/**
 * The journal: everything somebody thought worth doing on this island, in
 * chapters, ticking itself off as it is done. Nothing here is required and
 * nothing is rewarded; it exists because there is a great deal to do and
 * nothing anywhere else that says so.
 *
 * Its second tab is the ledger (`LedgerPanel`): what you have made, how many,
 * how many rare and the best of each. What there is to do and what has been
 * done are one book.
 */
export class JournalPanel {
  private readonly rows = new Map<string, HTMLDivElement>();
  private readonly count: HTMLDivElement;
  private readonly next: HTMLDivElement;
  private readonly tabs = new Map<JournalTab, HTMLButtonElement>();
  private readonly pages = new Map<JournalTab, HTMLDivElement>();
  /** The tab showing. */
  tab: JournalTab = 'goals';
  readonly ledger: LedgerPanel;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('settings-body');
    const bar = document.createElement('div');
    bar.className = 'log-tabs';
    for (const [id, label, title] of [
      ['goals', 'Goals', 'Everything worth doing here, ticking itself off'],
      ['ledger', 'Ledger', 'Everything you have ever made: how many, how many rare, and the best'],
    ] as Array<[JournalTab, string, string]>) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small log-tab' + (id === this.tab ? ' tb-on' : '');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      bar.append(b);
    }
    const goals = document.createElement('div');
    goals.className = 'settings-page skills-body';
    const made = document.createElement('div');
    made.className = 'journal-ledger';
    made.hidden = true;
    this.pages.set('goals', goals);
    this.pages.set('ledger', made);
    win.body.append(bar, goals, made);
    this.ledger = new LedgerPanel(made, game, () => win.isOpen && this.tab === 'ledger');
    this.count = document.createElement('div');
    this.count.className = 'skill-group';
    /*
     * What to do next, above the eighty-five.
     *
     * The list is complete and in a sensible order and answers the wrong
     * question: with everything on screen at the same volume, "what now" is
     * left entirely to the reader. The chapters were written as an order, so
     * the three undone goals nearest the front are the next thing and the two
     * behind it — and the whole list is still underneath, for when the
     * question has become "what else".
     */
    this.next = document.createElement('div');
    this.next.className = 'goal-next';
    goals.append(this.count, this.next);
    for (const chapter of JOURNAL) {
      const head = document.createElement('div');
      head.className = 'skill-group';
      head.textContent = chapter.name;
      goals.append(head);
      for (const goal of chapter.goals) {
        const row = document.createElement('div');
        row.className = 'skill-row goal-row';
        const tick = document.createElement('span');
        tick.className = 'goal-tick';
        const text = document.createElement('span');
        text.textContent = goal.text;
        const hint = document.createElement('span');
        hint.className = 'skill-note';
        hint.textContent = goal.hint ?? '';
        row.append(tick, text, hint);
        row.title = goal.hint ?? goal.text;
        goals.append(row);
        this.rows.set(goal.id, row);
      }
    }
    this.refresh();
    win.onOpen = () => {
      this.refresh();
      if (this.tab === 'ledger') this.ledger.refresh();
    };
    game.events.on('journal', () => this.refresh());
  }

  /** Turn to a tab. */
  show(tab: JournalTab): void {
    this.tab = tab;
    for (const [id, b] of this.tabs) b.classList.toggle('tb-on', id === tab);
    for (const [id, page] of this.pages) page.hidden = id !== tab;
    if (tab === 'ledger') this.ledger.refresh();
  }

  /** Open at a tab. */
  open(tab: JournalTab): void {
    this.show(tab);
    if (!this.win.isOpen) this.win.open();
  }

  /** Open at a tab; or, already open at it, put the journal away. */
  toggle(tab: JournalTab): void {
    if (this.win.isOpen && this.tab === tab) {
      this.win.close();
      return;
    }
    this.open(tab);
  }

  refresh(): void {
    const done = this.game.ticked;
    for (const [id, row] of this.rows) {
      const met = done.has(id);
      row.classList.toggle('goal-done', met);
      const tick = row.firstElementChild as HTMLElement;
      tick.textContent = met ? '✔' : '·';
    }
    this.count.textContent = `${done.size} of ${ALL_GOALS.length} done`;
    this.next.replaceChildren();
    const up = nextGoals(done, 3);
    if (!up.length) {
      this.next.textContent = 'Everything anybody thought worth doing here, done.';
      return;
    }
    const head = document.createElement('div');
    head.className = 'goal-next-head';
    head.textContent = `Next \u00b7 ${chapterOf(up[0].id)}`;
    this.next.append(head);
    up.forEach((goal, i) => {
      const row = document.createElement('div');
      row.className = 'goal-next-row' + (i === 0 ? ' goal-next-first' : '');
      const what = document.createElement('div');
      what.textContent = goal.text;
      row.append(what);
      // Only the one you are actually on gets the long answer; the two behind
      // it get their note, which is what a list is for.
      const say = i === 0 ? goal.how ?? goal.hint : goal.hint;
      if (say) {
        const note = document.createElement('div');
        note.className = 'goal-next-how';
        note.textContent = say;
        row.append(note);
      }
      this.next.append(row);
    });
  }
}
