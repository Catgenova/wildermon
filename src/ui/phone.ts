import type { Game } from '../game/game';
import type { Island } from '../net/island';
import { onPhone } from '../engine/device';
import { underTopBars } from './notices';

/**
 * The page as a phone app: the screen kept on through a queue of work,
 * fullscreen, the island listened to again after the app was in the
 * background, and the box being typed in kept above the on-screen keyboard.
 *
 * Everything here but coming back (`watchReturn`) is for a phone alone
 * (`onPhone`); a desktop is left exactly as it was. Nothing here is a game of
 * its own: coming back asks the island, and only the island.
 */

/** The notice while the island is being listened to again. */
export const RECONNECTING = 'Reconnecting…';
/** How long a page may be in the background, in milliseconds, before the island is read again on its return even with nothing cut. */
export const REREAD_AFTER_MS = 5000;
/** How soon a coming back that got no answer is tried again, in milliseconds, while the notice is up. */
export const RECONNECT_RETRY_MS = 3000;
/** How often the wake lock is matched to the work in hand, in milliseconds. */
export const WAKE_EVERY_MS = 1000;
/** How long after a refused wake lock before it is asked for again, in milliseconds. */
export const WAKE_RETRY_MS = 10_000;
/** Screen pixels left between the box being typed in and the top of the keyboard. */
export const KEYBOARD_GAP = 8;

/**
 * Whether the screen should be kept on: on a phone, with the setting on, while
 * an action runs or one is queued, and while the page is in front.
 */
export function wantAwake(o: { phone: boolean; keepAwake: boolean; busy: boolean; hidden: boolean }): boolean {
  return o.phone && o.keepAwake && o.busy && !o.hidden;
}

/** Whether there is work in hand or waiting: what the action bar and the queue show. */
export const busyWith = (game: Pick<Game, 'action' | 'queue'>): boolean => game.action !== null || game.queue.length > 0;

/** The parts of `navigator.wakeLock` used here, so a test can stand in for it. */
export interface WakeSentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}
export interface WakeApi {
  request(type: 'screen'): Promise<WakeSentinel>;
}

/**
 * Holds a screen wake lock while it is wanted and lets it go when it is not.
 *
 * The browser drops the lock itself whenever the page is hidden, so `sync`
 * asks again on the next call after the page is back. A refusal (battery
 * saver, a browser that wants a tap first) waits `WAKE_RETRY_MS` before the
 * next ask rather than asking every second. Where there is no wake lock at
 * all this does nothing.
 */
export class WakeKeeper {
  private lock: WakeSentinel | null = null;
  private asking = false;
  private wanted = false;
  private refusedAt = -Infinity;

  constructor(
    private readonly api: WakeApi | undefined,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  get held(): boolean {
    return this.lock !== null;
  }

  sync(want: boolean): void {
    this.wanted = want;
    if (!this.api) return;
    if (want && !this.lock && !this.asking && this.clock() - this.refusedAt >= WAKE_RETRY_MS) {
      this.asking = true;
      this.api.request('screen').then(
        (lock) => {
          this.asking = false;
          // Not wanted any more by the time it came: let it go at once.
          if (!this.wanted) {
            void lock.release().catch(() => undefined);
            return;
          }
          this.lock = lock;
          lock.addEventListener('release', () => {
            if (this.lock === lock) this.lock = null;
          });
        },
        () => {
          this.asking = false;
          this.refusedAt = this.clock();
        },
      );
    } else if (!want && this.lock) {
      const lock = this.lock;
      this.lock = null;
      void lock.release().catch(() => undefined);
    }
  }

  /** Back in front: a refusal from while hidden is no reason to wait. */
  shown(): void {
    this.refusedAt = -Infinity;
  }
}

type FullscreenDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/**
 * Whether Fullscreen is offered: a phone whose browser has the Fullscreen API
 * (an iPhone's Safari has none), and not already an installed app running
 * fullscreen from the home screen.
 */
export function fullscreenOffered(): boolean {
  if (!onPhone()) return false;
  const doc = document as FullscreenDoc;
  if (!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) return false;
  return isFullscreen() || !matchMedia('(display-mode: fullscreen)').matches;
}

export function isFullscreen(): boolean {
  const doc = document as FullscreenDoc;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** Into fullscreen or out of it. A browser that refuses leaves the page as it was. */
export async function setFullscreen(on: boolean): Promise<void> {
  const doc = document as FullscreenDoc;
  try {
    if (on && !isFullscreen()) {
      const el = document.documentElement as FullscreenEl;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    } else if (!on && isFullscreen()) {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    }
  } catch {
    // Refused: no tap behind it, or a browser that will not. Nothing changes.
  }
}

/**
 * How far to lift a box, in screen pixels, so that it sits `gap` above the
 * bottom of what can be seen: nought when it already does, and never so far
 * that its top goes above the top of what can be seen.
 */
export function keyboardLift(o: { top: number; bottom: number; viewTop: number; viewBottom: number; gap: number }): number {
  const need = o.bottom + o.gap - o.viewBottom;
  if (need <= 0) return 0;
  return Math.max(0, Math.min(need, o.top - o.viewTop - o.gap));
}

const TYPED = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', '']);

/** Whether this is a box the on-screen keyboard comes up for. */
function typedIn(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  return el instanceof HTMLInputElement && TYPED.has(el.type) && !el.readOnly;
}

/**
 * The box being typed in kept above the on-screen keyboard.
 *
 * The keyboard shrinks the visual viewport; when the focused box is then under
 * its top, the window or dialogue it is in (the child of the interface, or of
 * the page, that holds it) is lifted by the keyboard's overlap with CSS
 * `translate`, which leaves its own place and `transform` alone. Put back when
 * the box loses focus or the keyboard goes.
 */
export function keepAboveKeyboard(root: HTMLElement): void {
  const vv = window.visualViewport;
  if (!vv) return;
  let lifted: HTMLElement | null = null;
  let shift = 0;
  const drop = (): void => {
    if (lifted) lifted.style.translate = '';
    lifted = null;
    shift = 0;
  };
  const fit = (): void => {
    const el = document.activeElement;
    if (!onPhone() || !typedIn(el)) {
      drop();
      return;
    }
    let box: HTMLElement = el;
    while (box.parentElement && box.parentElement !== root && box.parentElement !== document.body) box = box.parentElement;
    if (box !== lifted) drop();
    // Measured where it would be unlifted; `translate` is in the holder's own pixels, which the interface may scale.
    const holder = box.parentElement;
    const scale = holder && holder.offsetWidth ? holder.getBoundingClientRect().width / holder.offsetWidth : 1;
    const r = el.getBoundingClientRect();
    const lift = keyboardLift({
      top: r.top + shift,
      bottom: r.bottom + shift,
      viewTop: vv.offsetTop,
      viewBottom: vv.offsetTop + vv.height,
      gap: KEYBOARD_GAP,
    });
    if (lift === shift && box === lifted) return;
    if (lift <= 0) {
      drop();
      return;
    }
    lifted = box;
    shift = lift;
    box.style.translate = `0 ${-lift / (scale || 1)}px`;
  };
  // After the screen's own fit (`followScreen`), which resizes the interface and puts windows back inside it first.
  const soon = (): void => void window.setTimeout(fit, 0);
  vv.addEventListener('resize', soon);
  vv.addEventListener('scroll', soon);
  document.addEventListener('focusin', soon);
  document.addEventListener('focusout', soon);
}

/**
 * Coming back to the island after the page was in the background, or after
 * the network came back.
 *
 * A phone cuts the live connection while the app is out of sight. On return
 * the island is listened to again and read again at once (`Island.comeBack`),
 * with `RECONNECTING` across the top while anything had been cut, until the
 * island's first fresh answer lands. A short look away with nothing cut reads
 * nothing; past `REREAD_AFTER_MS` it reads again quietly.
 */
export function watchReturn(island: Pick<Island, 'deaf' | 'comeBack'>, root: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'saving-banner reconnect-banner';
  bar.setAttribute('role', 'status');
  bar.textContent = RECONNECTING;
  bar.hidden = true;
  root.append(bar);
  let going = false;
  let again = 0;
  let hiddenAt = document.hidden ? performance.now() : Infinity;
  const back = async (loud: boolean): Promise<void> => {
    if (document.hidden || going) return;
    const away = performance.now() - hiddenAt;
    hiddenAt = Infinity;
    const cut = island.deaf();
    if (!loud && !cut && away < REREAD_AFTER_MS && bar.hidden) return;
    going = true;
    window.clearTimeout(again);
    if (loud || cut) {
      bar.hidden = false;
      bar.style.top = `${underTopBars(root, bar)}px`;
    }
    const answered = await island.comeBack().catch(() => false);
    going = false;
    if (answered) bar.hidden = true;
    else if (!bar.hidden) again = window.setTimeout(() => void back(true), RECONNECT_RETRY_MS);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Math.min(hiddenAt, performance.now());
    else void back(false);
  });
  window.addEventListener('online', () => void back(true));
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) void back(true);
  });
}

/** The screen kept on while there is work (`wantAwake`), matched every `WAKE_EVERY_MS` and on every return to the page. */
export function keepAwake(game: Game): void {
  const api = (navigator as Navigator & { wakeLock?: WakeApi }).wakeLock;
  if (!api) return;
  const keeper = new WakeKeeper(api);
  const sync = (): void => keeper.sync(wantAwake({
    phone: onPhone(),
    keepAwake: game.settings.keepAwake,
    busy: busyWith(game),
    hidden: document.hidden,
  }));
  window.setInterval(sync, WAKE_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) keeper.shown();
    sync();
  });
}

/** Whether this browser can keep the screen on at all, for Settings to offer the switch. */
export const wakeOffered = (): boolean => onPhone() && typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** Everything above, turned on once the island is up (`main.ts`). */
export function mountPhone(game: Game, island: Island, root: HTMLElement): void {
  watchReturn(island, root);
  keepAwake(game);
  keepAboveKeyboard(root);
}
