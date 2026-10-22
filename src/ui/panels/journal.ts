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
  private readonly rows = new Map<string, HTMLButtonElement>();
  /** Each goal's how-to, under its row, shown while the row is opened. */
  private readonly hows = new Map<string, HTMLDivElement>();
  private readonly allBtn: HTMLButtonElement;
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
      ['goals', 'Goals', 'Goals, ticked off when done'],
      ['ledger', 'Ledger', 'Everything made: count, rare count, best QL'],
      ['help', 'Help', 'Rules and numbers'],
      ['news', "What's new", 'Changes, newest first; unread marked'],
      ['boards', 'Leaderboards', 'Top skill holders, best-bred wildermon, largest settlements'],
      ['guide', 'Field guide', 'Every creature kind: seen, tamed, bred, habitat, yield'],
      ['tracker', 'Tracker', 'Tracked skills: progress to next level'],
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
    // Every how-to at once, or none: the list read as a manual rather than a checklist.
    const tools = document.createElement('div');
    tools.className = 'goal-tools';
    this.allBtn = document.createElement('button');
    this.allBtn.type = 'button';
    this.allBtn.className = 'tb-btn tb-small goal-all';
    this.allBtn.addEventListener('click', () => this.openAll(![...this.hows.values()].every((h) => !h.hidden)));
    tools.append(this.count, this.allBtn);
    goals.append(tools, this.next);
    for (const chapter of JOURNAL) {
      const head = document.createElement('div');
      head.className = 'skill-group';
      head.textContent = chapter.name;
      goals.append(head);
      for (const goal of chapter.goals) {
        // The row opens and shuts its how-to: what to do, where, with what, in the game's own words.
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'skill-row goal-row';
        const tick = document.createElement('span');
        tick.className = 'goal-tick';
        const text = document.createElement('span');
        text.className = 'goal-text';
        text.textContent = goal.text;
        const hint = document.createElement('span');
        hint.className = 'skill-note';
        hint.textContent = goal.hint ?? '';
        const fold = document.createElement('span');
        fold.className = 'goal-fold';
        fold.setAttribute('aria-hidden', 'true');
        row.append(tick, text, hint, fold);
        const how = document.createElement('div');
        how.className = 'goal-how';
        how.id = `goal-how-${goal.id}`;
        how.textContent = goal.how ?? goal.hint ?? '';
        how.hidden = true;
        row.setAttribute('aria-expanded', 'false');
        row.setAttribute('aria-controls', how.id);
        row.title = 'How';
        row.addEventListener('click', () => this.openHow(goal.id, how.hidden === true));
        goals.append(row, how);
        this.rows.set(goal.id, row);
        this.hows.set(goal.id, how);
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
    // And the island's record landing, which comes up to a heartbeat after the page was drawn.
    game.events.on('goals', () => this.refresh());
  }

  /** Open or shut one goal's how-to. */
  private openHow(id: string, open: boolean): void {
    const how = this.hows.get(id);
    const row = this.rows.get(id);
    if (!how || !row) return;
    how.hidden = !open;
    row.setAttribute('aria-expanded', String(open));
    row.classList.toggle('goal-open', open);
    this.sayAll();
  }

  /** Open or shut every how-to at once. */
  private openAll(open: boolean): void {
    for (const id of this.hows.keys()) this.openHow(id, open);
  }

  /** The button says what it will do: open them all while any is shut. */
  private sayAll(): void {
    const all = [...this.hows.values()].every((h) => !h.hidden);
    this.allBtn.textContent = all ? 'Hide all how-tos' : 'Show all how-tos';
  }

  /** Turn to a tab. */
  show(tab: JournalTab): void {
    this.tab = tab;
    for (const [id, b] of this.tabs) b.classList.toggle('tb-on', id === tab);
    for (const [id, page] of this.pages) page.hidden = id !== tab;
    if (tab === 'goals') this.refresh();
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
    this.count.textContent = `${done.size}/${ALL_GOALS.length} done · click a goal for how`;
    this.sayAll();
    this.next.replaceChildren();
    const up = nextGoals(done, 3);
    if (!up.length) {
      this.next.textContent = 'All goals done.';
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
