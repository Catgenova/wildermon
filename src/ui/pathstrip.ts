/**
 * The Path's line at the top of the screen (`src/game/path.ts`): the step you are on, "7/34 · Tame Sapgnaw · Bait: …
 * · Taming 1", and for a step with a place an arrow to it, turned with the view as the compass and a track's arrow
 * are, with how far. The arrow of the last track (`Game.trail`) on a step that tracks or tames a kind. Hidden with the
 * Path off; folded to its number by its own button (`settings.pathFolded`); a click on the line opens the Path tab.
 */
import type { Game } from '../game/game';
import { currentStep, PATH_STEPS, stepNumber, stripSays, stripWhere } from '../game/path';
import { TRACK_SHOW } from '../game/tracking';
import { underTopBars } from './notices';

/** How often the line is looked at, in milliseconds. */
const LOOK_EVERY = 250;

export class PathStrip {
  readonly el: HTMLDivElement;
  private readonly arrow: HTMLSpanElement;
  private readonly text: HTMLSpanElement;
  private readonly far: HTMLSpanElement;
  private readonly fold: HTMLButtonElement;
  private lastAt = -1e9;
  private said = '';

  constructor(private readonly root: HTMLElement, private readonly game: Game, open: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'path-strip';
    this.el.hidden = true;
    this.arrow = document.createElement('span');
    this.arrow.className = 'wind-arrow trail-arrow path-arrow';
    this.arrow.textContent = '↑';
    this.arrow.hidden = true;
    this.text = document.createElement('span');
    this.text.className = 'path-text';
    this.text.title = 'Guiding Light tab';
    this.text.addEventListener('click', open);
    this.far = document.createElement('span');
    this.far.className = 'path-far';
    this.fold = document.createElement('button');
    this.fold.type = 'button';
    this.fold.className = 'tb-btn tb-small path-fold';
    this.fold.addEventListener('click', () => {
      game.settings.pathFolded = !game.settings.pathFolded;
      this.lastAt = -1e9;
    });
    this.el.append(this.arrow, this.text, this.far, this.fold);
    root.append(this.el);
  }

  update(now: number, northAngle: number): void {
    if (now - this.lastAt < LOOK_EVERY) return;
    this.lastAt = now;
    const g = this.game;
    const on = !!g.thePath?.on;
    this.el.hidden = !on;
    if (!on) return;
    const folded = g.settings.pathFolded;
    const s = currentStep(g);
    const line = folded ? (s ? `Guiding Light ${stepNumber(s)}/${PATH_STEPS.length}` : 'Guiding Light done') : stripSays(g);
    if (line !== this.said) {
      this.said = line;
      this.text.textContent = line;
    }
    this.fold.textContent = folded ? '+' : '−';
    this.fold.title = folded ? 'Show the step' : 'Fold to the step number';
    // The place the step points at; else, on a step about a kind, the last track's arrow while it lasts.
    const where = folded ? null : stripWhere(g);
    const trail = !where && s?.tame && g.trail && g.time - g.trail.at < TRACK_SHOW ? g.trail : null;
    const bearing = where ? where.bearing : trail ? trail.bearing : null;
    this.arrow.hidden = bearing === null;
    if (bearing !== null) this.arrow.style.transform = `rotate(${(bearing + northAngle).toFixed(1)}deg)`;
    this.far.textContent = where ? `${where.where.name} · ${where.tiles} tiles` : trail ? `${trail.name} · ${trail.dist}` : '';
    this.far.hidden = !where && !trail;
    this.el.style.top = `${underTopBars(this.root, this.el)}px`;
  }
}
