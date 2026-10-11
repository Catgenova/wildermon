import type { Game } from '../game/game';
import type { LogEntry } from '../game/events';
import { SKILL_DEFS } from '../game/skills';

/**
 * Notices: a line near the top of the screen for the few moments worth
 * looking up for, that fades on its own and leaves the event log as it was.
 *
 * Four kinds, each switched on or off in Settings:
 *  - a skill reaching a new whole number (`noticeLevel`),
 *  - a knack (`noticeKnack`),
 *  - a run of work finishing, after at least `DONE_AFTER` seconds of it (`noticeDone`),
 *  - a wildermon born (`noticeBirth`).
 *
 * Read off what the game already says and holds -- the skill book, the log
 * and the job in hand -- so the island and the game played alone give the
 * same notices without either of them knowing these exist.
 */

export type NoticeKind = 'level' | 'knack' | 'done' | 'birth';

/** How long a notice stays, in milliseconds, before it fades. */
export const NOTICE_MS = 4500;
/** The most notices up at once; a fifth pushes the oldest off. */
const MOST = 4;
/** Seconds of work, from the first job to the last, before its end is worth a notice. */
export const DONE_AFTER = 8;
/** How often the skill book is looked over for a new whole number, in milliseconds. */
const LOOK_EVERY = 400;

const SETTING: Record<NoticeKind, 'noticeLevel' | 'noticeKnack' | 'noticeDone' | 'noticeBirth'> = {
  level: 'noticeLevel',
  knack: 'noticeKnack',
  done: 'noticeDone',
  birth: 'noticeBirth',
};

export class Notices {
  private readonly el: HTMLDivElement;
  /** Each skill's whole number when last looked, to see it move. */
  private floors = new Map<string, number>();
  private lookedAt = 0;
  /** The run of work in hand: what it was called and when it began. */
  private work: { label: string; since: number } | null = null;
  /** Until when a finished run says nothing, because it was stopped by hand. */
  private hushUntil = 0;
  /**
   * Until when a skill reaching a whole number is only noted, not shown: the
   * first moments ashore, while the island's copy of the skill book arrives
   * and every skill moves off the value it was given before it came.
   */
  private readonly settledAt = performance.now() + 6000;

  constructor(root: HTMLElement, private readonly game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'notices';
    root.append(this.el);
    game.events.on('log', (e: LogEntry) => {
      if (e.text.startsWith('You have a knack for')) this.show('knack', e.text);
      else if (e.text.includes(' drops a young ')) this.show('birth', e.text.replace(/:.*$/, '.'));
    });
  }

  /** A run of work stopped by hand ends without a notice. */
  hush(): void {
    this.hushUntil = performance.now() + 1500;
  }

  show(kind: NoticeKind, text: string): void {
    if (!this.game.settings[SETTING[kind]]) return;
    const n = document.createElement('div');
    n.className = `notice notice-${kind}`;
    n.textContent = text;
    this.el.append(n);
    while (this.el.children.length > MOST) this.el.firstElementChild?.remove();
    setTimeout(() => n.classList.add('notice-going'), NOTICE_MS);
    setTimeout(() => n.remove(), NOTICE_MS + 600);
  }

  /** Called every frame: the skill book on a beat, and the job in hand. */
  update(now: number): void {
    if (now - this.lookedAt >= LOOK_EVERY) {
      this.lookedAt = now;
      for (const def of SKILL_DEFS) {
        const whole = Math.floor(this.game.skills.get(def.id) + 1e-9);
        const was = this.floors.get(def.id);
        this.floors.set(def.id, whole);
        // One whole number up and no more: a jump of several is the book arriving from the island, not a go.
        if (was !== undefined && whole === was + 1 && now > this.settledAt) this.show('level', `${def.name} ${whole}`);
      }
    }
    const busy = this.game.action;
    if (busy) {
      if (!this.work) this.work = { label: busy.def.label, since: now };
      else this.work.label = busy.def.label;
    } else if (this.work && !this.game.queue.length) {
      const ran = (now - this.work.since) / 1000;
      if (ran >= DONE_AFTER && now > this.hushUntil) this.show('done', `Done: ${this.work.label}`);
      this.work = null;
    }
  }
}
