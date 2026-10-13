import { CARRY_PER_STRENGTH, type Game } from '../../game/game';
import { SKILL_DEFS } from '../../game/skills';
import { knackBonus, KNACK_CAP, TITLE_BY_ID } from '../../game/titles';
import type { UIWindow } from '../windows';
import { raisedBySays } from '../raisedBy';

export class SkillsPanel {
  private values = new Map<string, HTMLSpanElement>();
  private notes = new Map<string, HTMLSpanElement>();
  private rows = new Map<string, HTMLDivElement>();

  private titleBox: HTMLDivElement;

  constructor(win: UIWindow, private readonly game: Game) {
    win.body.classList.add('skills-body', 'skill-book');
    // What the trades have earned you the right to be called.
    const head = document.createElement('div');
    head.className = 'skill-group';
    head.textContent = 'Titles';
    this.titleBox = document.createElement('div');
    this.titleBox.className = 'title-box';
    win.body.append(head, this.titleBox);
    for (const group of ['Characteristics', 'Fighting', 'Skills'] as const) {
      const header = document.createElement('div');
      header.className = 'skill-group';
      header.textContent = group;
      win.body.append(header);
      for (const def of SKILL_DEFS.filter((d) => d.group === group)) {
        const row = document.createElement('div');
        row.className = 'skill-row';
        const name = document.createElement('span');
        name.textContent = def.name;
        const note = document.createElement('span');
        note.className = 'skill-note';
        const value = document.createElement('span');
        value.className = 'skill-value';
        row.append(name, note, value);
        win.body.append(row);
        this.values.set(def.id, value);
        this.notes.set(def.id, note);
        this.rows.set(def.id, row);
      }
    }
    this.refresh();
    win.onOpen = () => this.refresh();
    game.events.on('skill', (id) => {
      this.refresh();
      const row = this.rows.get(id);
      if (row) {
        row.classList.remove('flash');
        void row.offsetWidth;
        row.classList.add('flash');
      }
    });
  }

  refresh(): void {
    for (const [id, el] of this.values) el.textContent = this.game.skills.get(id).toFixed(2);
    for (const [id, el] of this.notes) {
      const [short, long] = this.note(id);
      el.textContent = short;
      // The short note's whole sentence, on the row, for whoever wants to know what "wind" is.
      this.rows.get(id)!.title = long;
    }
    // A skill never raised is drawn quieter, so the ones you have worked stand out.
    for (const def of SKILL_DEFS) this.rows.get(def.id)?.classList.toggle('skill-raw', this.game.skills.get(def.id) <= def.start);
    this.drawTitles();
  }

  /** The titles earned, the one worn, and a way to change your mind. */
  private drawTitles(): void {
    const worn = this.game.player.title;
    const earned = this.game.player.titles;
    this.titleBox.replaceChildren();
    if (!earned.length) {
      const none = document.createElement('div');
      none.className = 'title-none';
      none.textContent = 'Take any trade to 50 and they will start calling you something.';
      this.titleBox.append(none);
      return;
    }
    for (const id of earned) {
      const t = TITLE_BY_ID.get(id);
      if (!t) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `title-chip${id === worn ? ' title-worn' : ''}`;
      chip.setAttribute('aria-pressed', String(id === worn));
      chip.textContent = t.name;
      chip.title = id === worn ? 'Worn. Click to take it off.' : `Earned at ${t.at} ${SKILL_DEFS.find((d) => d.id === t.skill)?.name.toLowerCase() ?? t.skill}. Click to wear it.`;
      chip.addEventListener('click', () => {
        this.game.wearTitle(id === worn ? null : id);
        this.refresh();
      });
      this.titleBox.append(chip);
    }
  }

  /** The note beside a skill, short, and the sentence it stands for: its knacks, what it is worth right now, and for a characteristic what raises it. */
  private note(id: string): [string, string] {
    const g = this.game;
    const [short, worth] = this.plain(id) ?? ['', ''];
    // What raises a characteristic, which no trade's name says for it (`RAISED_BY`).
    const raised = raisedBySays(id);
    const long = [worth, raised ? `Raised by ${raised}.` : ''].filter(Boolean).join(' ');
    // A knack is worth saying before anything else: it never wears off.
    const knacks = Math.min(KNACK_CAP, g.player.knacks[id] ?? 0);
    if (!knacks) return [short, long];
    const bonus = Math.round(knackBonus(knacks) * 100);
    return [
      `knack ×${knacks} · +${bonus}%${short ? ` · ${short}` : ''}`,
      `${knacks} of at most ${KNACK_CAP} knacks: +${bonus}% to what every go in this skill raises it.${long ? ` ${long}` : ''}`,
    ];
  }

  /**
   * What a characteristic is worth right now, in the plainest terms, short and
   * as a sentence; nothing while it is worth nothing yet, since "−0%" says less
   * than leaving it out.
   */
  private plain(id: string): [string, string] | null {
    const g = this.game;
    const v = g.skills.get(id);
    switch (id) {
      case 'body_strength': {
        const kg = Math.round(v * CARRY_PER_STRENGTH);
        return [`+${kg} kg carried`, `You carry ${kg} kg more before the weight tells on you: ${CARRY_PER_STRENGTH} kg a point.`];
      }
      case 'body_stamina': {
        const off = Math.round((1 - g.staminaCost(1)) * 100);
        return off > 0 ? [`−${off}% wind`, `Every job and every swing costs ${off}% less stamina.`] : null;
      }
      case 'body_control': {
        const off = Math.round((1 - g.controlSpeed()) * 100);
        return off > 0 ? [`−${off}% time`, `Every job takes ${off}% less time.`] : null;
      }
      case 'mind_logic': {
        const n = g.queueCapacity();
        return [`${n} jobs lined up`, `You can line up ${n} jobs at once.`];
      }
      case 'soul_strength': {
        const up = g.soulBonus() * 100;
        return up > 0 ? [`+${up.toFixed(1)}% tame`, `Taming a creature succeeds ${up.toFixed(1)} percentage points more often.`] : null;
      }
      case 'climbing': {
        const step = Math.round(g.climbStep());
        return [`slopes to ${step}`, `You can walk up a step of ${step} height units.`];
      }
      case 'swimming': {
        const pace = Math.round(g.player.swimSpeed * 100);
        return [`${pace}% swim speed`, `In deep water you move at ${pace}% of your walking pace.`];
      }
      default:
        return null;
    }
  }
}
