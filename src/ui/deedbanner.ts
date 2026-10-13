import type { Deed, Game } from '../game/game';
import { isFounder, rankName } from '../game/ranks';
import { underTopBars } from './notices';

/**
 * A settlement's name near the top of the screen as you walk into it, and a
 * smaller "Leaving" line as you walk out.
 *
 * Read off what the browser already holds: your own settlement (`Game.deed`)
 * and every other one in view with its border (`Game.neighbourDeeds`, which the
 * island sends with the founder's name and, where you are a citizen, your
 * rank). Under it, your rank where you are a citizen, "Founded by you" on your
 * own, and its founder's name anywhere else.
 *
 * A border is crossed only once you are `BANNER_DEPTH` tiles past it, either
 * way, so walking along one says nothing; coming back within `BANNER_AGAIN`
 * seconds of leaving says nothing either; and nothing is said for a
 * settlement you were already standing in when it came into view, which is
 * how every one arrives when the island is first read.
 */

/** How long the name stays up as you come in, and the "Leaving" line as you go, in milliseconds, before each fades. */
export const BANNER_MS = 4000;
export const LEAVING_MS = 2500;
/** How long the fade takes, in milliseconds. */
const FADE_MS = 600;
/** How far past a border, in tiles, before crossing it counts. */
export const BANNER_DEPTH = 1;
/** Seconds after leaving a settlement in which walking back into it shows nothing, and leaving again shows nothing. */
export const BANNER_AGAIN = 10;
/** How often where you stand is looked at, in milliseconds. */
const LOOK_EVERY = 200;
/** Tiles moved between two looks that mean you were put somewhere rather than walked there: loading, or travel. */
const JUMP = 6;

type Shown = Pick<Deed, 'name' | 'x' | 'y' | 'radius' | 'mine' | 'role' | 'rank'> & { holder?: string | null };

const keyOf = (d: Shown): string => `${d.x},${d.y}`;

/**
 * How far inside a settlement's border you stand, in tiles: negative outside it.
 * The border runs round the outer edges of its outermost tiles, which is where
 * the map draws it.
 */
export function depthIn(d: Pick<Deed, 'x' | 'y' | 'radius'>, x: number, y: number): number {
  return Math.min(x - (d.x - d.radius), d.x + d.radius + 1 - x, y - (d.y - d.radius), d.y + d.radius + 1 - y);
}

/** The line under a settlement's name: your rank, yours, or whose. Null when the island did not say whose. */
export function standingLine(g: Game, d: Shown): string | null {
  if (d === g.deed || (d.mine && isFounder(d))) return 'Founded by you';
  if (d.mine) return `Your rank: ${rankName(d)}`;
  return d.holder ? `Founded by ${d.holder}` : null;
}

export class DeedBanner {
  private readonly el: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly subEl: HTMLDivElement;
  private lookedAt = 0;
  /** The settlement you are in, by its token, once you are well inside. */
  private inside: string | null = null;
  /** The settlements in view at the last look. */
  private known = new Set<string>();
  private last: { x: number; y: number } | null = null;
  private leftAt = new Map<string, number>();
  private saidLeaving = new Map<string, number>();
  /** When the banner up starts to fade, and when it is gone; 0 with none up. */
  private fadeAt = 0;
  private goneAt = 0;
  /** Nothing is said in the first moments ashore, while the island's lists arrive and you are put where you were. */
  private readonly settledAt = performance.now() + 3000;

  constructor(private readonly root: HTMLElement, private readonly game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'deed-banner';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    const plate = document.createElement('div');
    plate.className = 'deed-banner-plate';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'deed-banner-name';
    this.subEl = document.createElement('div');
    this.subEl.className = 'deed-banner-sub';
    plate.append(this.nameEl, this.subEl);
    this.el.append(plate);
    root.append(this.el);
  }

  /** Called every frame: where you stand on a beat, and the banner's fade. */
  update(now: number): void {
    if (this.goneAt) {
      if (now >= this.goneAt) {
        this.el.hidden = true;
        this.el.classList.remove('deed-banner-going');
        this.fadeAt = this.goneAt = 0;
      } else if (this.fadeAt && now >= this.fadeAt) {
        this.fadeAt = 0;
        this.el.classList.add('deed-banner-going');
      }
    }
    if (now - this.lookedAt < LOOK_EVERY) return;
    this.lookedAt = now;
    this.look(now);
  }

  private look(now: number): void {
    const g = this.game;
    const { x, y } = g.player;
    const deeds: Shown[] = g.deed ? [g.deed, ...g.neighbourDeeds.filter((d) => keyOf(d) !== keyOf(g.deed as Deed))] : g.neighbourDeeds;
    const jumped = !this.last || Math.hypot(x - this.last.x, y - this.last.y) > JUMP;
    const quiet = jumped || now < this.settledAt || !g.settings.deedBanner;
    if (this.inside !== null) {
      const at = this.inside;
      const d = deeds.find((e) => keyOf(e) === at);
      // Gone from view while you stood in it: disbanded, or a list redrawn. Nothing to say.
      if (!d) this.inside = null;
      else if (depthIn(d, x, y) <= -BANNER_DEPTH) {
        this.inside = null;
        this.leftAt.set(at, now);
        if (!quiet && now - (this.saidLeaving.get(at) ?? -Infinity) >= BANNER_AGAIN * 1000) {
          this.saidLeaving.set(at, now);
          this.show(`Leaving ${d.name}`, null, true);
        }
      }
    }
    if (this.inside === null) {
      const d = deeds.find((e) => depthIn(e, x, y) >= BANNER_DEPTH);
      if (d) {
        const at = keyOf(d);
        this.inside = at;
        const back = now - (this.leftAt.get(at) ?? -Infinity) < BANNER_AGAIN * 1000;
        if (!quiet && !back && this.known.has(at)) this.show(d.name, standingLine(g, d), false);
      }
    }
    this.known = new Set(deeds.map(keyOf));
    this.last = { x, y };
  }

  private show(name: string, sub: string | null, leaving: boolean): void {
    const now = performance.now();
    this.nameEl.textContent = name;
    this.subEl.textContent = sub ?? '';
    this.subEl.hidden = !sub;
    this.el.classList.toggle('deed-banner-leaving', leaving);
    this.el.classList.remove('deed-banner-going');
    this.el.classList.toggle('deed-banner-still', this.game.settings.graphics === 'fast');
    this.el.hidden = false;
    this.el.style.top = `${underTopBars(this.root, this.el)}px`;
    // Start the fade in again, for a banner that replaces one still up.
    const plate = this.el.firstElementChild as HTMLElement;
    plate.style.animation = 'none';
    void plate.offsetWidth;
    plate.style.animation = '';
    this.fadeAt = now + (leaving ? LEAVING_MS : BANNER_MS);
    this.goneAt = this.fadeAt + FADE_MS;
  }
}
