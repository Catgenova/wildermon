import type { Game } from '../../game/game';
import { ALL_GOALS, JOURNAL, chapterOf, nextGoals } from '../../game/journal';
import type { UIWindow } from '../windows';
import { LedgerPanel } from './ledger';
import { NewsPanel } from './news';

/** The journal's tabs: what there is to do, what you have made, how any of it works, what has changed, who stands highest, every kind of creature, and the trades you are watching. */
export type JournalTab = 'goals' | 'ledger' | 'help' | 'news' | 'boards' | 'guide' | 'tracker';

/**
 * The journal: everything somebody thought worth doing on this island, in
 * chapters, ticking itself off as it is done. Nothing here is required and
 * nothing is rewarded; it exists because there is a great deal to do and
 * nothing anywhere else that says so.
 *
 * Its second tab is the ledger (`LedgerPanel`): what you have made, how many,
 * how many rare and the best of each. Its third is the help (`buildHelp`),
 * fetched the first time it is turned to (`onShow`). Its fourth is what has
 * changed on the island (`NewsPanel`), turned to by itself on coming ashore
 * when something has changed since this browser last showed it. Its fifth is
 * the island's leaderboards (`BoardsPanel`), made into `boardsPage` by the UI,
 * which holds the island they are asked of. Its sixth is the field guide
 * (`GuidePanel`), made into `guidePage` by the UI the same way, and its
 * seventh the trades you are watching (`TrackerPanel`), in `trackerPage`.
 * What there is to do, what has been done, how any of it works, what is new,
 * who stands highest, every kind of creature there is and how your trades
 * are climbing are one book.
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
  /** The Help tab's page, which the help is built into when it has been fetched. */
  readonly helpPage: HTMLDivElement;
  private readonly news: NewsPanel;
  /** The Leaderboards tab's page. */
  readonly boardsPage: HTMLDivElement;
  /** The Field guide tab's page. */
  readonly guidePage: HTMLDivElement;
  /** The Tracker tab's page. */
  readonly trackerPage: HTMLDivElement;
  /** Told whenever a tab is shown, the window open. */
  onShow: ((tab: JournalTab) => void) | null = null;

  constructor(private readonly win: UIWindow, private readonly game: Game) {
    win.body.classList.add('settings-body', 'journal-body');
    const bar = document.createElement('div');
    bar.className = 'log-tabs journal-tabs';
    for (const [id, label, title] of [
      ['goals', 'Goals', 'Everything worth doing here, ticking itself off'],
      ['ledger', 'Ledger', 'Everything you have ever made: how many, how many rare, and the best'],
      ['help', 'Help', 'How any of this works'],
      ['news', "What's new", 'What changed on the island, newest first, with what you had not read yet marked'],
      ['boards', 'Leaderboards', 'Who holds each skill highest on the island, its best-bred wildermon and its biggest settlements'],
      ['guide', 'Field guide', 'A page for every kind of creature: which you have seen, tamed and bred, where each lives and what it gives'],
      ['tracker', 'Tracker', 'The few trades you are watching, with a bar apiece toward the next level'],
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
    this.helpPage = document.createElement('div');
    this.helpPage.className = 'journal-help';
    this.helpPage.hidden = true;
    this.pages.set('goals', goals);
    this.pages.set('ledger', made);
    const news = document.createElement('div');
    news.className = 'settings-page';
    news.hidden = true;
    this.news = new NewsPanel(news);
    this.boardsPage = document.createElement('div');
    this.boardsPage.className = 'settings-page';
    this.boardsPage.hidden = true;
    this.pages.set('help', this.helpPage);
    this.pages.set('news', news);
    this.guidePage = document.createElement('div');
    this.guidePage.className = 'settings-page';
    this.guidePage.hidden = true;
    this.pages.set('boards', this.boardsPage);
    this.trackerPage = document.createElement('div');
    this.trackerPage.className = 'settings-page';
    this.trackerPage.hidden = true;
    this.pages.set('guide', this.guidePage);
    this.pages.set('tracker', this.trackerPage);
    win.body.append(bar, goals, made, this.helpPage, news, this.boardsPage, this.guidePage, this.trackerPage);
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
      if (this.tab === 'news') this.news.draw();
      this.onShow?.(this.tab);
    };
    game.events.on('journal', () => this.refresh());
  }

  /** Turn to a tab. */
  show(tab: JournalTab): void {
    this.tab = tab;
    for (const [id, b] of this.tabs) b.classList.toggle('tb-on', id === tab);
    for (const [id, page] of this.pages) page.hidden = id !== tab;
    if (tab === 'ledger') this.ledger.refresh();
    if (tab === 'news' && this.win.isOpen) this.news.draw();
    if (this.win.isOpen) this.onShow?.(tab);
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
