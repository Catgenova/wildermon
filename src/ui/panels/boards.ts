import type { Boards, Island } from '../../net/island';
import { MAX_DEED_LEVEL, type Game } from '../../game/game';
import { BOARD_TOP, bestSkill } from '../../game/boards';
import { SPECIES } from '../../game/creatures';
import { SKILL_DEFS, type SkillDef } from '../../game/skills';
import { GRADE_STEP, TIERS, TRAIT_SLOTS } from '../../game/traits';

/** How often the window asks the island again while it is open, in seconds. */
export const REFRESH = 30;

type Tab = 'skills' | 'wildermon' | 'settlements';

/** A figure as a board prints it: a whole number bare, anything else to one place. */
export const figure = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The most a wildermon can score: every trait it carries at the top grade. */
export const BRED_MAX = TRAIT_SLOTS * GRADE_STEP[TIERS[TIERS.length - 1]];

/**
 * What each board ranks by: the line the window prints over it, which the
 * help repeats. Every number in them is read off the rule it describes, and
 * `supabase/test/boards.ts` holds them to the island's copies of those rules.
 */
export const BOARD_RULES: Record<Tab, string> = {
  skills: `Top ${BOARD_TOP} per skill, by level. Only players who raised the skill are ranked.`,
  wildermon: `Top ${BOARD_TOP} tamed wildermon by trait total, per grade: `
    + `${TIERS.map((t) => `${t} ${figure(GRADE_STEP[t])}`).join(', ')}; max ${figure(BRED_MAX)} for ${TRAIT_SLOTS} traits. `
    + 'Tie: higher level first. Wild not ranked; traits not named.',
  settlements: `Top ${BOARD_TOP} settlements by level (1 to ${MAX_DEED_LEVEL}), then citizens (founder and roll), `
    + 'then age, oldest first.',
};

const TABS: Array<[Tab, string, string]> = [
  ['skills', 'Skills', 'Top players per skill'],
  ['wildermon', 'Wildermon', 'Best-bred tamed wildermon'],
  ['settlements', 'Settlements', 'Largest settlements'],
];

/** The Skills window's order, so a skill is found where it always is. */
const SKILL_GROUPS: Array<SkillDef['group']> = ['Characteristics', 'Fighting', 'Skills'];

/** How many people a settlement holds, as a board says it. */
const citizens = (n: number): string => `${n} ${n === 1 ? 'citizen' : 'citizens'}`;

/**
 * Who leads the island: each skill's highest, the best-bred wildermon and the
 * biggest settlements.
 *
 * All three come from one ask (`rpc_boards`), made when the window opens and
 * every `REFRESH` seconds while it stays open, and never while it is shut. The
 * page is only rebuilt when the answer has changed, so a skill list somebody
 * is in the middle of choosing from is not pulled out from under them.
 *
 * In the game you play by yourself there is nobody to rank against, so the
 * window says what a board ranks by and where you would stand on it.
 */
export class BoardsPanel {
  private readonly bar: HTMLDivElement;
  private readonly page: HTMLDivElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'skills';
  /** The last answer, the same as text to tell whether the next one differs, and whether the latest ask came back empty. */
  private seen: Boards | null = null;
  private seenKey = '';
  private failed = false;
  /** The skill whose board is showing; kept across answers while it has one. */
  private skill: string | null = null;
  private asking = false;
  private lastAsk = -1e9;

  /**
   * Drawn into `host`, the journal's Leaderboards tab (`JournalPanel`), and
   * asked again only while `showing` says that tab can be seen.
   */
  constructor(
    host: HTMLElement,
    private readonly game: Game,
    private readonly island: Island | null,
    private readonly showing: () => boolean,
  ) {
    host.classList.add('skills-body');
    this.bar = document.createElement('div');
    this.bar.className = 'log-tabs';
    for (const [id, label, title] of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tb-btn tb-small log-tab${id === this.tab ? ' tb-on' : ''}`;
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      this.bar.append(b);
    }
    // Alone there is one page, not three boards to choose between.
    this.bar.hidden = !island;
    this.page = document.createElement('div');
    host.append(this.bar, this.page);
    this.draw();
  }

  /** The tab has just been turned to, or the journal opened at it: ask now. */
  shown(): void {
    void this.refresh(performance.now() / 1000);
  }

  private show(id: Tab): void {
    this.tab = id;
    for (const [key, el] of this.tabs) el.classList.toggle('tb-on', key === id);
    this.draw();
  }

  /** Asked again while the tab is showing, and not at all while it is not. */
  update(now: number): void {
    if (!this.showing() || now - this.lastAsk < REFRESH) return;
    void this.refresh(now);
  }

  private async refresh(now: number): Promise<void> {
    this.lastAsk = now;
    if (!this.island) {
      this.draw();
      return;
    }
    if (this.asking) return;
    this.asking = true;
    let got: Boards | null = null;
    try {
      got = await this.island.boards();
    } finally {
      this.asking = false;
    }
    const key = got ? JSON.stringify(got) : this.seenKey;
    if (got && key === this.seenKey && !this.failed) return;
    this.failed = !got;
    if (got) {
      this.seen = got;
      this.seenKey = key;
    }
    this.draw();
  }

  private draw(): void {
    this.page.replaceChildren();
    if (!this.island) return;
    this.say(BOARD_RULES[this.tab]);
    if (!this.seen) {
      this.say(this.failed ? `No answer from the island. Retry every ${REFRESH} s while open.` : 'Loading…');
      return;
    }
    if (this.failed) this.say(`No answer just now: showing the last answer. Retry every ${REFRESH} s.`);
    if (this.tab === 'skills') this.drawSkills(this.seen);
    else if (this.tab === 'wildermon') this.drawWildermon(this.seen);
    else this.drawSettlements(this.seen);
  }

  private drawSkills(b: Boards): void {
    const known = SKILL_GROUPS.map((g) => [g, SKILL_DEFS.filter((d) => d.group === g && b.skills[d.id]?.length)] as const)
      .filter(([, defs]) => defs.length);
    if (!known.length) {
      this.say('No skills raised yet.');
      return;
    }
    // The one you had, while it still has a board; else your own best, if it
    // has one; else the first there is.
    const has = (id: string | null): id is string => !!id && !!b.skills[id]?.length;
    const own = bestSkill((id) => this.game.skills.standing(id))?.id ?? null;
    const shown = has(this.skill) ? this.skill : has(own) ? own : known[0][1][0].id;
    this.skill = shown;
    const pick = document.createElement('select');
    pick.className = 'panel-select board-pick';
    pick.title = 'Skill to show';
    for (const [group, defs] of known) {
      const og = document.createElement('optgroup');
      og.label = group;
      for (const d of defs) {
        const top = b.skills[d.id][0];
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = `${d.name} — ${top.name} ${top.value.toFixed(2)}`;
        o.selected = d.id === shown;
        og.append(o);
      }
      pick.append(og);
    }
    pick.addEventListener('change', () => {
      this.skill = pick.value;
      this.draw();
    });
    const bar = document.createElement('div');
    bar.className = 'panel-bar';
    bar.append(pick);
    this.page.append(bar);
    this.columns('Who', '', 'Skill level');
    b.skills[shown].forEach((p, i) => this.place(i + 1, p.name, '', p.value.toFixed(2), p.mine));
  }

  private drawWildermon(b: Boards): void {
    if (!b.wildermon.length) {
      this.say('No tamed wildermon yet.');
      return;
    }
    this.columns('Wildermon', 'Keeper', 'Traits');
    b.wildermon.forEach((w, i) => this.place(i + 1, `${w.name}, ${SPECIES[w.species]?.name ?? w.species}`,
      w.keeper, figure(w.score), w.mine, `Trait total ${figure(w.score)}/${figure(BRED_MAX)}`));
  }

  private drawSettlements(b: Boards): void {
    if (!b.settlements.length) {
      this.say('No settlements yet.');
      return;
    }
    this.columns('Settlement', 'Founder · citizens', 'Level');
    b.settlements.forEach((s, i) => this.place(i + 1, s.name, `${s.founder}'s · ${citizens(s.citizens)}`,
      String(s.level), s.mine, `Level ${s.level} of ${MAX_DEED_LEVEL}`));
  }

  /** What each column of a board is, over its first place. */
  private columns(who: string, note: string, fig: string): void {
    const row = document.createElement('div');
    row.className = 'skill-row board-row board-cols';
    for (const [text, cls] of [['#', 'board-rank'], [who, ''], [note, 'skill-note'], [fig, 'skill-value']]) {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      row.append(el);
    }
    this.page.append(row);
  }

  /** One place on a board: its number, who or what, a note, and the figure it is ranked by. Yours says so. */
  private place(n: number, who: string, note: string, fig: string, mine: boolean, title = ''): void {
    const row = document.createElement('div');
    row.className = `skill-row board-row${mine ? ' board-mine' : ''}`;
    const rank = document.createElement('span');
    rank.className = 'board-rank';
    rank.textContent = `${n}.`;
    const name = document.createElement('span');
    name.className = 'board-who';
    name.textContent = who;
    if (mine) {
      const you = document.createElement('span');
      you.className = 'board-you';
      you.textContent = 'you';
      name.append(you);
    }
    const aside = document.createElement('span');
    aside.className = 'skill-note';
    aside.textContent = note;
    const value = document.createElement('span');
    value.className = 'skill-value';
    value.textContent = fig;
    if (title) value.title = title;
    row.append(rank, name, aside, value);
    this.page.append(row);
  }

  private say(text: string): void {
    const el = document.createElement('div');
    el.className = 'skill-note market-note board-note';
    el.textContent = text;
    this.page.append(el);
  }
}
