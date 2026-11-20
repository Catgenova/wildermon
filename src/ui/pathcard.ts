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
 *
 * The panel (`settings.pathPanel`, on for a new body's first coming ashore): the same card kept up while the Guiding
 * Light is on, one step at a time: the step's place on the Path, its Steps numbered, Why it matters. Skip passes the
 * step and shows the one after; a step that ticks stays shown, marked done, until Next step. Folded to its top line by
 * its own button; Close at the end, when every step is done.
 */
import type { Game } from '../game/game';
import { boundKey } from '../game/keybinds';
import {
  currentStep, MET_MARK, PATH_CARD_HOLD, PATH_STEP_BY_ID, PATH_STEPS, pathCardSays, SEEK_REACH, stepSpot, UNMET_MARK, watchPathCards,
  type PathCardSays,
} from '../game/path';
import { MAX_DEED_LEVEL } from '../game/deedsize';
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
  private readonly findEl: HTMLDivElement;
  private readonly progressEl: HTMLDivElement;
  private readonly rewardEl: HTMLDivElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly seekBtn: HTMLButtonElement;
  /** The mark Show me last put down, taken up when it puts the next. */
  private seekMark: number | null = null;
  private readonly skip: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly tabBtn: HTMLButtonElement;
  private readonly foldBtn: HTMLButtonElement;
  private readonly mid: HTMLDivElement;
  /** The step the panel shows: kept, done or not, until Skip or Next step; null for the current one. */
  private viewId: string | null = null;
  /** The step whose picture is playing. */
  private playing: string | null = null;
  private done: string[] = [];
  private openedAt = 0;
  /** The job going when the card went up, or since, by what and at what: only another started after it takes the card down. */
  private seen = '';
  private lastAt = -1e9;
  private drawn = '';
  private asking = false;
  /** Cards put up since the page opened, for the tests. */
  shown = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly game: Game,
    private readonly openTab: () => void,
    /** The map opened at a spot (`MinimapPanel.showAt`). */
    private readonly showAt: (x: number, y: number) => void = () => {},
  ) {
    this.el = document.createElement('div');
    this.el.className = 'path-card';
    this.el.hidden = true;
    const top = document.createElement('div');
    top.className = 'path-card-top';
    this.doneEl = document.createElement('div');
    this.doneEl.className = 'path-card-done';
    this.foldBtn = this.button('−', 'Fold to the top line', () => {
      game.settings.pathPanelFolded = !game.settings.pathPanelFolded;
      this.drawn = '';
      this.refresh();
    });
    this.foldBtn.classList.add('path-card-fold');
    top.append(this.doneEl, this.foldBtn);
    const mid = document.createElement('div');
    this.mid = mid;
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
    this.findEl = document.createElement('div');
    this.findEl.className = 'path-card-find';
    this.progressEl = document.createElement('div');
    this.progressEl.className = 'path-card-progress';
    this.rewardEl = document.createElement('div');
    this.rewardEl.className = 'path-card-reward';
    text.append(this.nextEl, this.progressEl, this.howEl, this.findEl, this.whyEl, this.rewardEl);
    mid.append(this.preview.el, text);
    const foot = document.createElement('div');
    foot.className = 'path-card-foot';
    this.skip = this.button('Skip next', 'Skip: the step after is current; done later, it still ticks', () => this.skipNext());
    this.nextBtn = this.button('Next step', 'The step after: shown once this one is done', () => this.nextStep());
    this.nextBtn.classList.add('path-card-go');
    this.tabBtn = this.button(`Guiding Light tab (${boundKey('win_path')})`, 'Journal, Guiding Light tab', () => {
      if (!this.pinned) this.close();
      this.openTab();
    });
    this.closeBtn = this.button('Close', 'Close', () => {
      if (this.pinned) game.settings.pathPanel = false;
      this.close();
    });
    this.prevBtn = this.button('Previous step', 'The step before, to read', () => this.prevStep());
    this.seekBtn = this.button('Show me', `Map: where this step is done, or the nearest of what it works on within ${SEEK_REACH} tiles; a mark put there`, () => this.seek());
    foot.append(this.closeBtn, this.prevBtn, this.skip, this.nextBtn, this.seekBtn, this.tabBtn);
    this.el.append(top, mid, foot);
    root.append(this.el);
    watchPathCards(game, (done) => this.open(done));
    // (the first look after the page opens ticks what was met before: the panel shows the step after those)
    game.events.on('pathTicked', (_ticked, first) => {
      if (first) this.viewId = null;
    });
    game.events.on('path', () => this.refresh());
  }

  /** Whether the card is the panel: kept up, one step at a time, while the Guiding Light is on. */
  get pinned(): boolean {
    return this.game.settings.pathPanel && !!this.game.thePath?.on;
  }

  /** The panel up, at the current step: a new body's first coming ashore, or Settings. */
  pin(): void {
    this.game.settings.pathPanel = true;
    this.game.settings.pathPanelFolded = false;
    this.viewId = null;
    this.lastAt = -1e9;
  }

  private show(): void {
    if (!this.el.hidden) return;
    this.openedAt = this.game.time;
    this.seen = jobKey(this.game) ?? '';
    this.drawn = '';
    this.shown++;
    this.el.hidden = false;
    this.refresh();
  }

  /** The panel back a step, to read. */
  private prevStep(): void {
    const at = this.says().next?.number ?? PATH_STEPS.length + 1;
    if (at <= 1) return;
    this.viewId = PATH_STEPS[at - 2].id;
    this.refresh();
  }

  /** Show me: the map at where the step is done, a mark there. */
  private seek(): void {
    const g = this.game;
    const s = PATH_STEP_BY_ID.get(this.says().next?.id ?? '');
    if (!s) return;
    const spot = stepSpot(g, s);
    if (!spot) {
      g.logMsg(`Guiding Light: nothing for this step within ${SEEK_REACH} tiles.`, 'info');
      return;
    }
    if (this.seekMark !== null && g.marks.some((m) => m.id === this.seekMark)) g.removeMark(this.seekMark);
    const x = Math.floor(spot.x), y = Math.floor(spot.y);
    this.seekMark = g.addMark(x, y, `Guiding Light: ${spot.name}`).id;
    this.showAt(x, y);
  }

  /** The panel on to the current step. */
  private nextStep(): void {
    this.viewId = currentStep(this.game)?.id ?? null;
    this.refresh();
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
    // (the panel holds the step it shows, so that one ticked stays up, marked done, until Next step)
    if (this.pinned && this.viewId === null) this.viewId = currentStep(this.game)?.id ?? null;
    return this.pinned ? pathCardSays(this.game, [], this.viewId) : pathCardSays(this.game, this.done);
  }

  /** Put the card up for the steps a look ticked (none: the next step alone), unless Path pop-ups are off. */
  open(done: string[]): void {
    const g = this.game;
    // (the panel shows each step as it ticks, marked done)
    if (this.pinned) return;
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
    this.playing = null;
    this.drawn = '';
  }

  private skipNext(): void {
    const s = this.says().next;
    if (!s || s.passed || this.asking || !this.game.pathDoor) return;
    this.asking = true;
    this.skip.disabled = true;
    void this.game.pathDoor.skip(s.id, true).finally(() => {
      this.asking = false;
      // (the panel goes on to the step after)
      if (this.pinned) this.viewId = currentStep(this.game)?.id ?? null;
      this.refresh();
    });
  }

  /** Draw it again, if it is up and anything it says has changed. */
  refresh(): void {
    if (this.el.hidden) return;
    const c = this.says();
    const pinned = this.pinned;
    const folded = pinned && this.game.settings.pathPanelFolded;
    const key = JSON.stringify([c, pinned, folded, this.asking]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.el.classList.toggle('path-panel', pinned);
    this.foldBtn.hidden = !pinned;
    this.foldBtn.textContent = folded ? '+' : '−';
    this.foldBtn.title = folded ? 'Show the step' : 'Fold to the top line';
    this.mid.hidden = folded;
    const n = c.next;
    if (pinned) {
      const at = n ? `Step ${n.number}/${PATH_STEPS.length} · ${n.phase}` : `${PATH_STEPS.length}/${PATH_STEPS.length} done`;
      this.doneEl.textContent = `Guiding Light · ${at} · goal: settlement level ${MAX_DEED_LEVEL}`;
      const mark = n?.passed === 'done' ? `${MET_MARK} Done · ` : n?.passed === 'skipped' ? 'Skipped · ' : '';
      this.nextEl.textContent = n ? `${mark}${n.line.slice(n.line.indexOf(' · ') + 3)}` : 'Guiding Light: every step done';
    } else {
      this.doneEl.textContent = c.done.length ? `Done: ${c.done.join(' · ')}` : 'Guiding Light';
      this.nextEl.textContent = n ? `Next ${n.line}` : 'Guiding Light: every step done';
    }
    // (the card: "How: " before the first line; the panel: a heading over them, the steps numbered and marked)
    const lines = (el: HTMLElement, head: string, xs: readonly string[], marks?: readonly boolean[]): void => {
      el.replaceChildren();
      if (pinned && xs.length) {
        const h = document.createElement('b');
        h.textContent = head;
        el.append(h);
      }
      for (const [i, x] of xs.entries()) {
        const row = document.createElement('div');
        const h = document.createElement('b');
        h.textContent = pinned ? (marks ? `${i + 1}. ` : '') : i === 0 ? `${head}: ` : '';
        if (pinned && marks) {
          const m = document.createElement('span');
          m.className = marks[i] ? 'path-mark path-mark-on' : 'path-mark';
          m.textContent = marks[i] ? MET_MARK : UNMET_MARK;
          row.append(m, ' ');
        }
        row.append(h, x);
        el.append(row);
      }
    };
    lines(this.howEl, pinned ? 'Steps' : 'How', n?.how ?? [], n?.howDone ?? []);
    const finds = [...(n?.find ?? []).map((l) => `Find: ${l}`), ...(n?.bring ?? []).map((l) => `Bring: ${l}`)];
    this.findEl.replaceChildren(...finds.map((l) => {
      const row = document.createElement('div');
      row.textContent = l;
      return row;
    }));
    this.findEl.hidden = !finds.length;
    lines(this.whyEl, pinned ? 'Why it matters' : 'Why', n?.why ?? []);
    this.progressEl.textContent = n?.progress.length ? `Progress: ${n.progress.join(' · ')}` : '';
    this.progressEl.hidden = !n?.progress.length;
    this.rewardEl.textContent = pinned ? n?.reward ?? '' : '';
    this.rewardEl.hidden = !pinned || !n?.reward;
    this.prevBtn.hidden = !pinned || !n;
    this.prevBtn.disabled = !n || n.number <= 1;
    this.seekBtn.hidden = !pinned || !n;
    this.seekBtn.disabled = !n?.seeks;
    this.closeBtn.hidden = pinned && !!n;
    this.nextBtn.hidden = !pinned || !n;
    this.nextBtn.disabled = !n?.passed;
    this.nextBtn.classList.toggle('path-card-ready', !!n?.passed);
    this.skip.textContent = pinned ? 'Skip' : 'Skip next';
    this.skip.hidden = pinned && !n;
    this.skip.disabled = !n || !!n.passed || this.asking || !this.game.pathDoor;
    this.preview.el.hidden = !n || folded;
    if (!n || folded) {
      this.preview.stop();
      this.playing = null;
    } else if (n.id !== this.playing) {
      this.preview.play(n.show);
      this.playing = n.id;
    }
  }

  /** Every frame: down once an action you start begins after `PATH_CARD_HOLD` seconds; under the bars at the top. */
  update(now: number): void {
    if (now - this.lastAt < LOOK_EVERY) return;
    const g = this.game;
    if (this.pinned) {
      this.lastAt = now;
      this.show();
      this.refresh();
      this.el.style.top = `${underTopBars(this.root, this.el, 'right')}px`;
      return;
    }
    if (this.el.hidden) return;
    this.lastAt = now;
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
