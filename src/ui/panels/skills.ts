import { boatHands, CARRY_PER_STRENGTH, CHAR_START, controlPaceAbove, MIND_EASED_SKILLS, staminaCostAbove, type Game, windRegenAbove } from '../../game/game';
import { staminaBarAbove } from '../../game/body';
import { CONTROL_HIT } from '../../game/gear';
import { listed, percent } from '../../game/words';
import { SKILL_BY_ID, SKILL_DEFS } from '../../game/skills';
import { effectTracks, hasEffects, type EffectTrack } from '../../game/skilleffects';
import { knackBonus, KNACK_CAP, TITLE_BY_ID } from '../../game/titles';
import type { UIWindow } from '../windows';
import { raisedBySays } from '../raisedBy';
import { TRACKING, trackingSays } from '../../game/tracking';
import { metres } from '../../game/piers';

/** The thinking skills mind logic eases, by name. */
const MIND_EASED_SAID = listed(MIND_EASED_SKILLS.map((id) => (SKILL_BY_ID.get(id)?.name ?? id).toLowerCase()));

export class SkillsPanel {
  private values = new Map<string, HTMLSpanElement>();
  private notes = new Map<string, HTMLSpanElement>();
  private rows = new Map<string, HTMLDivElement>();
  /** Each skill's sliders, under its row, and which are open. */
  private effects = new Map<string, HTMLDivElement>();
  private open = new Set<string>();

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
        // A skill with numbers behind it opens onto a slider for each (`skilleffects.ts`).
        if (hasEffects(def.id)) {
          const box = document.createElement('div');
          box.className = 'skill-effects';
          box.hidden = true;
          row.classList.add('skill-opens');
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-expanded', 'false');
          const toggle = (): void => {
            if (this.open.has(def.id)) this.open.delete(def.id);
            else this.open.add(def.id);
            this.drawEffects(def.id);
          };
          row.addEventListener('click', toggle);
          row.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            toggle();
          });
          win.body.append(box);
          this.effects.set(def.id, box);
        }
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
    for (const [id, el] of this.values) el.textContent = this.game.skills.standing(id).toFixed(2);
    for (const [id, el] of this.notes) {
      const [short, long] = this.note(id);
      el.textContent = short;
      // The short note's whole sentence, on the row, for whoever wants to know what "wind" is.
      this.rows.get(id)!.title = long;
    }
    // A skill never raised is drawn quieter, so the ones you have worked stand out.
    for (const def of SKILL_DEFS) this.rows.get(def.id)?.classList.toggle('skill-raw', this.game.skills.get(def.id) <= def.start);
    for (const id of this.open) this.drawEffects(id);
    this.drawTitles();
  }

  /** A skill's sliders, drawn afresh when it is open: one track per effect, from its starting value to the top. */
  private drawEffects(id: string): void {
    const box = this.effects.get(id);
    const row = this.rows.get(id);
    if (!box || !row) return;
    const open = this.open.has(id);
    box.hidden = !open;
    row.classList.toggle('skill-open', open);
    row.setAttribute('aria-expanded', String(open));
    if (!open) return;
    box.replaceChildren(...effectTracks(this.game, id).map((t) => this.track(t)));
  }

  private track(t: EffectTrack): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'fx';
    const head = document.createElement('div');
    head.className = 'fx-head';
    const name = document.createElement('span');
    name.className = 'fx-name';
    name.textContent = t.label;
    const now = document.createElement('span');
    now.className = 'fx-now';
    now.textContent = t.now;
    head.append(name, now);
    const rail = document.createElement('div');
    rail.className = 'fx-rail';
    rail.setAttribute('aria-hidden', 'true');
    const pct = `${(t.share * 100).toFixed(1)}%`;
    const fill = document.createElement('i');
    fill.style.width = pct;
    const knob = document.createElement('b');
    knob.style.left = pct;
    rail.append(fill, knob);
    const ends = document.createElement('div');
    ends.className = 'fx-ends';
    const end = (value: string, level: number): HTMLSpanElement => {
      const s = document.createElement('span');
      const at = document.createElement('small');
      at.textContent = ` at ${level}`;
      s.append(value, at);
      return s;
    };
    ends.append(end(t.low, t.from), end(t.high, t.to));
    el.append(head, rail, ends);
    if (t.note) {
      const note = document.createElement('div');
      note.className = 'fx-note';
      note.textContent = t.note;
      el.append(note);
    }
    el.title = `${t.label}: ${t.low} at ${t.from}, ${t.now} now, ${t.high} at ${t.to}.`;
    return el;
  }

  /** The titles earned, the one worn, and a way to change your mind. */
  private drawTitles(): void {
    const worn = this.game.player.title;
    const earned = this.game.player.titles;
    this.titleBox.replaceChildren();
    if (!earned.length) {
      const none = document.createElement('div');
      none.className = 'title-none';
      none.textContent = `None. First title at ${Math.min(...[...TITLE_BY_ID.values()].map((t) => t.at))} in any skill.`;
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
      chip.title = id === worn ? 'Worn. Click to remove.' : `Earned at ${SKILL_DEFS.find((d) => d.id === t.skill)?.name.toLowerCase() ?? t.skill} ${t.at}. Click to wear.`;
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
    const long = [worth, raised ? `Raised by: ${raised}.` : ''].filter(Boolean).join(' ');
    // A knack is worth saying before anything else: it never wears off.
    const knacks = Math.min(KNACK_CAP, g.player.knacks[id] ?? 0);
    if (!knacks) return [short, long];
    const bonus = Math.round(knackBonus(knacks) * 100);
    return [
      `Knacks ${knacks}/${KNACK_CAP}: skill gain +${bonus}%${short ? ` · ${short}` : ''}`,
      `Knacks: ${knacks} of max ${KNACK_CAP}. Skill gain per action +${bonus}%.${long ? ` ${long}` : ''}`,
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
        return [`Carry weight +${kg} kg`, `Carry weight +${kg} kg (${CARRY_PER_STRENGTH} kg per level).`];
      }
      case 'body_stamina': {
        const above = v - CHAR_START;
        const bar = Math.round((staminaBarAbove(above) - 1) * 100);
        const off = Math.round((1 - staminaCostAbove(above)) * 100);
        const back = Math.round((windRegenAbove(above) - 1) * 100);
        return bar > 0
          ? [`Stamina bar +${bar}%, cost −${off}%, recovery +${back}%`,
            `Stamina bar +${bar}%. Stamina cost of actions and swings −${off}%. Stamina recovery +${back}%.`]
          : null;
      }
      case 'body_control': {
        const off = Math.round((1 - controlPaceAbove(v - CHAR_START)) * 100);
        const dodge = g.dodge();
        const hit = v / CONTROL_HIT;
        const sail = boatHands(true, v).toFixed(2);
        return [`Action time −${off}%, dodge ${percent(dodge)}, hit +${percent(hit)}`,
          `Time per action and swing −${off}%. Dodge chance ${percent(dodge)} (armour worn counted). Hit chance +${percent(hit)}. Sailing boat speed ×${sail} of her own.`];
      }
      case 'mind_logic': {
        const n = g.queueCapacity();
        const ease = +g.mindEase().toFixed(1);
        return [`Action queue ${n}, difficulty −${ease}`, `Action queue ${n}. Difficulty −${ease} on crafts, ${MIND_EASED_SAID}; max half.`];
      }
      case 'soul_strength': {
        const up = g.soulBonus() * 100;
        return up > 0 ? [`Tame chance +${up.toFixed(1)}%`, `Tame chance +${up.toFixed(1)} percentage points.`] : null;
      }
      case 'climbing': {
        const step = metres(g.climbStep());
        return [`Max step ${step} m`, `Max step up on foot: ${step} m.`];
      }
      case 'swimming': {
        const pace = Math.round(g.player.swimSpeed * 100);
        return [`Swim speed ${pace}% of walk`, `Swim speed in deep water: ${pace}% of walk speed.`];
      }
      // What a go of Track reaches and reads at this level, and what each band of it says (`tracking.ts`).
      case TRACKING:
        return trackingSays(v);
      default:
        return null;
    }
  }
}
