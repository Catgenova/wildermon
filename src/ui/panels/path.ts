/**
 * The Journal's Path tab: the Path (`src/game/path.ts`) whole, by phase, the step you are on marked, Skip on every
 * step, and the detours beside the steps they fit. Built a node at a time, with no markup (src/page-guard.ts).
 */
import type { Game } from '../../game/game';
import {
  currentStep, PATH_DETOURS, PATH_KINDS, PATH_PHASES, PATH_SKILLS, PATH_STEPS, stepNumber, type PathDetour, type PathStep,
} from '../../game/path';
import { SKILL_BY_ID } from '../../game/skills';
import { listed } from '../../game/words';
import { meaning } from '../kit';

/** What a step's mark says: done, skipped, the one you are on, or still ahead. */
const MARKS = { done: '✔', skipped: '↷', here: '▶', ahead: '·' } as const;

export class PathPanel {
  /** What the page was last drawn from, so a beat that changes nothing draws nothing. */
  private drawn = '';
  /** A Skip asked and not yet answered, by step: its button waits. */
  private readonly asking = new Set<string>();

  constructor(private readonly page: HTMLElement, private readonly game: Game, private readonly showing: () => boolean) {
    game.events.on('path', () => this.refresh());
    game.events.on('journal', () => this.refresh());
  }

  /** Draw again, if the tab is showing and anything it says has changed. */
  refresh(): void {
    if (!this.showing()) return;
    const g = this.game;
    const key = JSON.stringify([g.thePath, [...g.pathDone].sort(), [...this.asking], PATH_STEPS.map((s) => s.label(g)), PATH_DETOURS.map((d) => d.label(g))]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.draw();
  }

  private draw(): void {
    const g = this.game;
    const on = !!g.thePath?.on;
    this.page.replaceChildren();
    const top = document.createElement('div');
    top.className = 'goal-tools';
    const count = document.createElement('div');
    count.className = 'skill-group rc-section';
    const done = PATH_STEPS.filter((s) => g.pathDone.has(s.id)).length;
    const skipped = PATH_STEPS.filter((s) => !g.pathDone.has(s.id) && g.thePath?.skip.includes(s.id)).length;
    count.textContent = `Path: ${on ? 'On' : 'Off'} · ${done}/${PATH_STEPS.length} done · ${skipped} skipped`;
    const turn = document.createElement('button');
    turn.type = 'button';
    turn.className = 'tb-btn rc-btn tb-small';
    turn.textContent = on ? 'Turn off' : 'Turn on';
    turn.title = on ? 'Path off: no line at the top, no ticks' : `Path on: the line at the top, steps tick themselves; notes ${PATH_KINDS.length} kinds in the field guide for Track`;
    turn.disabled = !g.pathDoor;
    turn.addEventListener('click', () => {
      turn.disabled = true;
      void g.pathDoor?.turn(!on).finally(() => (turn.disabled = false));
    });
    top.append(count, turn);
    this.page.append(top);
    const skills = document.createElement('div');
    skills.className = 'goal-next-how';
    skills.textContent = `Skills: ${PATH_SKILLS.length} · ${listed(PATH_SKILLS.map((id) => (SKILL_BY_ID.get(id)?.name ?? id).toLowerCase()))}`;
    this.page.append(skills);

    const here = on ? currentStep(g) : null;
    for (const [phase, title] of PATH_PHASES) {
      const steps = PATH_STEPS.filter((s) => s.phase === phase);
      if (!steps.length) continue;
      const head = document.createElement('div');
      head.className = 'skill-group rc-section';
      head.textContent = title;
      this.page.append(head);
      for (const s of steps) {
        this.page.append(this.row(s, here));
        for (const d of PATH_DETOURS.filter((x) => x.beside === s.id)) this.page.append(this.detour(d));
      }
    }
  }

  /** One step: its mark, number, label and Skip (or Unskip). */
  private row(s: PathStep, here: PathStep | null): HTMLElement {
    const g = this.game;
    const isDone = g.pathDone.has(s.id);
    const isSkipped = !isDone && !!g.thePath?.skip.includes(s.id);
    const row = document.createElement('div');
    row.className = 'skill-row rc-row goal-row path-row' + (isDone ? ' goal-done' : '') + (s === here ? ' path-here rc-now' : '') + (isSkipped ? ' path-skipped' : '');
    meaning(row, isDone ? 'good' : null);
    row.dataset.step = s.id;
    const tick = document.createElement('span');
    tick.className = 'goal-tick';
    tick.textContent = isDone ? MARKS.done : isSkipped ? MARKS.skipped : s === here ? MARKS.here : MARKS.ahead;
    const text = document.createElement('span');
    text.className = 'goal-text';
    text.textContent = `${stepNumber(s)}. ${s.label(g)}`;
    row.append(tick, text);
    if (!isDone && g.thePath?.on) {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'tb-btn rc-btn tb-small path-skip';
      skip.textContent = isSkipped ? 'Unskip' : 'Skip';
      skip.title = isSkipped ? 'Back on the Path' : 'Skip: the next step is current; done later, it still ticks';
      skip.disabled = this.asking.has(s.id) || !g.pathDoor;
      skip.addEventListener('click', () => {
        this.asking.add(s.id);
        this.refresh();
        void g.pathDoor?.skip(s.id, !isSkipped).finally(() => {
          this.asking.delete(s.id);
          this.refresh();
        });
      });
      row.append(skip);
    }
    return row;
  }

  /** A detour, under the step it fits: optional, never in the way. */
  private detour(d: PathDetour): HTMLElement {
    const g = this.game;
    const isDone = g.pathDone.has(d.id);
    const row = document.createElement('div');
    row.className = 'skill-row rc-row goal-row path-row path-detour' + (isDone ? ' goal-done' : '');
    meaning(row, isDone ? 'good' : null);
    row.dataset.step = d.id;
    const tick = document.createElement('span');
    tick.className = 'goal-tick';
    tick.textContent = isDone ? MARKS.done : MARKS.ahead;
    const text = document.createElement('span');
    text.className = 'goal-text';
    text.textContent = `Detour: ${d.label(g)}`;
    row.append(tick, text);
    return row;
  }
}
