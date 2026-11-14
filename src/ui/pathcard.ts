/**
 * The Path's card (`src/game/path.ts`): up in the top right corner as a step ticks, naming every step that look
 * ticked, then the next step: its line, how it is done and what it is for (`PathStep.how`, `PathStep.why`), and a
 * moving picture of you at it (`pathpreview.ts`). Close, Skip next, and the Path tab. Turned on mid-game, one card with
 * the next step and no list of what was met before (`watchPathCards`). Settings: Path pop-ups.
 *
 * Out of the way of play: in the corner, under the bars along the top, and gone on Close, the Path tab, or the first
 * job you start once it has been up `PATH_CARD_HOLD` seconds (another job, or the same at another thing: a run of goes going
 * on is not a start). Built a node at a
 * time, with no markup (src/page-guard.ts).
 */
import type { Game } from '../game/game';
import { boundKey } from '../game/keybinds';
import { PATH_CARD_HOLD, pathCardSays, watchPathCards, type PathCardSays } from '../game/path';
import { underTopBars } from './notices';
import { PathPreview } from './pathpreview';

/** How often the card is looked at, in milliseconds. */
const LOOK_EVERY = 250;
/** The job in hand, by what it is and what at; null for none. */
const jobKey = (g: Game): string | null => (g.action ? `${g.action.def.id}|${JSON.stringify(g.action.target)}` : null);

export class PathCard {
  readonly el: HTMLDivElement;
  readonly preview: PathPreview;
  private readonly doneEl: HTMLDivElement;
  private readonly nextEl: HTMLDivElement;
  private readonly howEl: HTMLDivElement;
  private readonly whyEl: HTMLDivElement;
  private readonly skip: HTMLButtonElement;
  private done: string[] = [];
  private openedAt = 0;
  /** The job going when the card went up, or since, by what and at what: only another started after it takes the card down. */
  private seen = '';
  private lastAt = -1e9;
  private drawn = '';
  private asking = false;
  /** Cards put up since the page opened, for the tests. */
  shown = 0;

  constructor(private readonly root: HTMLElement, private readonly game: Game, private readonly openTab: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'path-card';
    this.el.hidden = true;
    this.doneEl = document.createElement('div');
    this.doneEl.className = 'path-card-done';
    const mid = document.createElement('div');
    mid.className = 'path-card-mid';
    this.preview = new PathPreview(game);
    const text = document.createElement('div');
    text.className = 'path-card-text';
    this.nextEl = document.createElement('div');
    this.nextEl.className = 'path-card-next';
    this.howEl = document.createElement('div');
    this.howEl.className = 'path-card-lines';
    this.whyEl = document.createElement('div');
    this.whyEl.className = 'path-card-lines path-card-why';
    text.append(this.nextEl, this.howEl, this.whyEl);
    mid.append(this.preview.el, text);
    const foot = document.createElement('div');
    foot.className = 'path-card-foot';
    this.skip = this.button('Skip next', 'Skip: the step after is current; done later, it still ticks', () => this.skipNext());
    const tab = this.button(`Path tab (${boundKey('win_path')})`, 'Journal, Path tab', () => {
      this.close();
      this.openTab();
    });
    foot.append(this.button('Close', 'Close', () => this.close()), this.skip, tab);
    this.el.append(this.doneEl, mid, foot);
    root.append(this.el);
    watchPathCards(game, (done) => this.open(done));
    game.events.on('path', () => this.refresh());
  }

  private button(text: string, title: string, click: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb-btn tb-small';
    b.textContent = text;
    b.title = title;
    b.addEventListener('click', click);
    return b;
  }

  /** What the card says now. */
  says(): PathCardSays {
    return pathCardSays(this.game, this.done);
  }

  /** Put the card up for the steps a look ticked (none: the next step alone), unless Path pop-ups are off. */
  open(done: string[]): void {
    const g = this.game;
    if (!g.settings.pathPopups || !g.thePath?.on) return;
    this.done = done;
    this.openedAt = g.time;
    this.seen = jobKey(g) ?? '';
    this.drawn = '';
    this.shown++;
    this.el.hidden = false;
    this.refresh();
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.preview.stop();
    this.drawn = '';
  }

  private skipNext(): void {
    const s = this.says().next;
    if (!s || this.asking || !this.game.pathDoor) return;
    this.asking = true;
    this.skip.disabled = true;
    void this.game.pathDoor.skip(s.id, true).finally(() => {
      this.asking = false;
      this.refresh();
    });
  }

  /** Draw it again, if it is up and anything it says has changed. */
  refresh(): void {
    if (this.el.hidden) return;
    const c = this.says();
    const key = JSON.stringify(c);
    if (key === this.drawn) return;
    const nextWas = this.drawn ? (JSON.parse(this.drawn) as PathCardSays).next?.id : undefined;
    this.drawn = key;
    this.doneEl.textContent = c.done.length ? `Done: ${c.done.join(' · ')}` : 'Path';
    this.nextEl.textContent = c.next ? `Next ${c.next.line}` : 'Path: every step done';
    const lines = (el: HTMLElement, head: string, xs: readonly string[]): void => {
      el.replaceChildren();
      for (const [i, x] of xs.entries()) {
        const row = document.createElement('div');
        const h = document.createElement('b');
        h.textContent = i === 0 ? `${head}: ` : '';
        row.append(h, x);
        el.append(row);
      }
    };
    lines(this.howEl, 'How', c.next?.how ?? []);
    lines(this.whyEl, 'Why', c.next?.why ?? []);
    this.skip.disabled = !c.next || this.asking || !this.game.pathDoor;
    this.preview.el.hidden = !c.next;
    if (!c.next) this.preview.stop();
    else if (c.next.id !== nextWas) this.preview.play(c.next.show);
  }

  /** Every frame: down once an action you start begins after `PATH_CARD_HOLD` seconds; under the bars at the top. */
  update(now: number): void {
    if (this.el.hidden || now - this.lastAt < LOOK_EVERY) return;
    this.lastAt = now;
    const g = this.game;
    if (!g.settings.pathPopups || !g.thePath?.on) {
      this.close();
      return;
    }
    // (the island says each go of a run afresh: a go of the same job at the same thing is not a start)
    const job = jobKey(g);
    if (job !== null && job !== this.seen) {
      if (g.time - this.openedAt >= PATH_CARD_HOLD) {
        this.close();
        return;
      }
      this.seen = job;
    }
    this.el.style.top = `${underTopBars(this.root, this.el, 'right')}px`;
  }
}
