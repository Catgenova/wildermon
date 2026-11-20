/**
 * The season calendar (`seasonCalendar`): the season now and the three after it, when each starts, and what fruits in
 * each, marked where it starts or ends with that season. Built a node at a time, with no markup (src/page-guard.ts).
 */
import type { Game } from '../../game/game';
import { seasonCalendar } from '../../game/fruiting';
import { SEASON_DAYS } from '../../world/calendar';
import { capital } from '../../game/words';

/** How often an open calendar is drawn again, in milliseconds: a day is the least it changes by. */
const LOOK_EVERY = 5000;

export class SeasonsView {
  readonly el: HTMLDivElement;
  private lastAt = -1e9;
  private drawn = '';

  constructor(private readonly game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'seasons rc-scroll';
  }

  update(now: number): void {
    if (now - this.lastAt < LOOK_EVERY) return;
    this.lastAt = now;
    const cal = seasonCalendar(this.game.wallNow());
    const key = JSON.stringify(cal);
    if (key === this.drawn) return;
    this.drawn = key;
    this.el.replaceChildren();
    if (!cal.now) {
      this.el.append(this.line('Before the first spring: everything fruits.', 'seasons-head'));
      return;
    }
    this.el.append(this.line(`Now: ${capital(cal.now)}, day ${cal.day} of ${SEASON_DAYS} · next in ${SEASON_DAYS - cal.day + 1} days`, 'seasons-head'));
    for (const s of cal.seasons) {
      this.el.append(this.line(`${capital(s.season)}${s.inDays === 0 ? ' (now)' : ` (in ${s.inDays} days)`}: ${s.fruits.length} fruiting`, 'seasons-season'));
      for (const f of s.fruits) {
        const mark = f.starts && f.ends ? ' · this season only' : f.starts ? ' · starts' : f.ends ? ' · ends' : '';
        this.el.append(this.line(`${capital(f.source)}${mark}`, f.starts ? 'seasons-fruit seasons-starts' : 'seasons-fruit'));
      }
    }
  }

  private line(text: string, cls: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  }
}
