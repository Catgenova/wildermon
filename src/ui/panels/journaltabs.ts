/** The journal's tabs, apart from the journal so the What's new can name them without importing it. */
export type JournalTab = 'goals' | 'ledger' | 'help' | 'news' | 'boards' | 'guide' | 'tracker';
/** The journal's tabs, in order: id, label, what it holds. The tab bar and the UI Menu list them from here. */
export const JOURNAL_TABS: ReadonlyArray<readonly [JournalTab, string, string]> = [
  ['goals', 'Goals', 'Goals, ticked off when done'],
  ['ledger', 'Ledger', 'Everything made: count, rare count, best QL'],
  ['help', 'Help', 'Rules and numbers'],
  ['news', "What's new", 'Changes, newest first; unread marked'],
  ['boards', 'Leaderboards', 'Top skill holders, best-bred wildermon, largest settlements'],
  ['guide', 'Field guide', 'Every creature kind: seen, tamed, bred, habitat, yield'],
  ['tracker', 'Tracker', 'Tracked skills: progress to next level'],
];

/** The key binding that opens each tab (`src/game/keybinds.ts`); Goals is the journal's own key. */
export const JOURNAL_TAB_BIND: Record<JournalTab, string> = {
  goals: 'win_journal', ledger: 'win_ledger', help: 'win_help', news: 'win_news',
  boards: 'win_boards', guide: 'win_guide', tracker: 'win_tracker',
};
