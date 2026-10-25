/**
 * Keeping the interface on the screen it is actually on.
 *
 * Two things went wrong on a phone, and they compound.
 *
 * **The page is not always laid out the size of the screen.** Told to render a
 * desktop site — a toggle a browser will also remember on its own — a phone
 * lays the page out about 980 CSS pixels wide and shrinks the whole thing onto
 * four hundred pixels of glass. The viewport meta says `width=device-width`
 * and is simply ignored. Everything still *works*: it is a third of the size
 * it should be, the `max-width: 720px` rules never fire, and the toolbar wraps
 * into two rows across the top of a panel it was never meant to touch.
 *
 * **And then you zoom in to read it.** The interface is `position: fixed`,
 * which pins it to the *layout* viewport, so zooming leaves every panel off the
 * side of the screen. Pinching back out does not work either, because the
 * canvas takes the gesture and zooms the island instead. That is a game with
 * no interface and no way back to one, which is what was reported.
 *
 * The fix is one idea: **`#ui` is the screen, not the page.** It is placed and
 * sized against `visualViewport` — the box the eye can actually see — and
 * scaled so that its own coordinates are always about a phone's worth of room.
 * Whatever the browser has decided the page is, the interface is one screen
 * wide, laid out at a sensible width, and cannot be anywhere but in front of
 * you.
 */

/**
 * The width the interface lays itself out at when the page is wider than a
 * touchscreen wants. About a phone, so the narrow rules mean what they say.
 */
const TOUCH_UI_WIDTH = 420;

/** Past this the interface stops growing, so a big tablet is not absurd. */
const MAX_SCALE = 2.6;

/** Under this the interface calls itself narrow and stacks rather than spreads. */
export const NARROW = 720;

/**
 * A touchscreen on its side lays the interface out at least this wide, and at
 * least `TOUCH_UI_SHORT` tall where that is less: at `TOUCH_UI_WIDTH` across a
 * phone in landscape is about 190 of its own pixels tall, twice the size it
 * needs and no room for a window. Under `NARROW`, so it is still a phone.
 */
const TOUCH_UI_WIDE = 700;
const TOUCH_UI_SHORT = 340;

/** The least a press is given on a phone, in screen pixels (`--tap`). */
const TAP = 44;

/**
 * Whether the interface is a phone's: a finger (coarse pointer) on an
 * interface laid out narrow (`NARROW`). Everything laid out only for a phone
 * asks this, or `#ui.phone` in src/style.css; a desk, a narrow desk window
 * and a tablet worked with a mouse never see it.
 */
let phone = false;
export const isPhone = (): boolean => phone;

/** A box padded by the screen's safe-area insets, read for their size in screen pixels (`insets`). */
let probe: HTMLElement | null = null;

/** The screen's safe-area insets (a notch, a home bar, rounded corners), in screen pixels; nothing on a desk. */
function insets(): { t: number; r: number; b: number; l: number } {
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'safe-probe';
    probe.setAttribute('aria-hidden', 'true');
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Math.max(0, parseFloat(v) || 0);
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}

/**
 * The size somebody asked for, on top of whatever the screen needed.
 *
 * Asked for as a text and window size setting, which "matters on a phone":
 * there the interface is either laid out at about four hundred of its own
 * pixels and scaled up to the glass, or not scaled at all where the phone lays
 * the page out its own width, and neither of those is anybody's choice of how
 * big the writing should be. `fitScreen` multiplies its own scale by this.
 */
export const UI_SIZE_MIN = 0.8;
export const UI_SIZE_MAX = 1.5;
/** The sizes offered at one press (Settings, Text size presets), smallest first, each with its name. */
export const UI_SIZE_PRESETS: ReadonlyArray<readonly [number, string]> = [[0.9, 'Small'], [1, 'Standard'], [1.25, 'Large'], [1.5, 'Largest']];
let chosen = 1;

/**
 * The least room a size may leave the interface along the screen's shorter
 * side, in its own pixels.
 *
 * A window is at least a hundred and sixty wide and the status panel wants two
 * columns of bars; past this, a bigger size stops making anything easier to
 * read and starts putting windows on top of each other with nowhere to go.
 * Measured on a phone's layout: at 280 the status panel's bars and its name
 * ran off its right edge, in both looks; from 300 they fit.
 */
const MIN_UI_SIDE = 300;

/** The fit `followScreen` keeps running, so that a new size is put on at once. */
let refit: (() => void) | null = null;

/** Set the size asked for, clamped to what is offered, and put it on the screen. */
export function setUiSize(size: number): void {
  chosen = Math.min(UI_SIZE_MAX, Math.max(UI_SIZE_MIN, Number.isFinite(size) ? size : 1));
  refit?.();
}

/**
 * The size actually shown, as a share of the screen's own fit.
 *
 * The same as the size asked for except where the screen has no room for it,
 * which is said beside the setting rather than left for somebody to wonder why
 * their 150% looks like 120.
 */
export const uiSizeShown = (): number => box.scale / (box.fit || 1);

/**
 * The interface's own box and scale, as `fitScreen` last left them.
 *
 * Everything that positions itself in the interface has to measure against
 * *this* rather than against `window`: with `#ui` scaled and offset, a window
 * anchored to the right of `window.innerWidth` lands off the side of a screen
 * that is only four hundred of the interface's own pixels wide.
 */
let box = { w: 0, h: 0, scale: 1, left: 0, top: 0, fit: 1 };

/** How much room the interface has, in its own coordinates. */
export const uiBox = (): { w: number; h: number } =>
  box.w ? { w: box.w, h: box.h } : { w: window.innerWidth, h: window.innerHeight };

/** Whether the interface has been measured against the screen yet (`fitScreen`); until then `uiBox` is the page's guess. */
export const uiFitted = (): boolean => box.w > 0;

/**
 * Where a pointer is, in the interface's own coordinates.
 *
 * `clientX` is a page coordinate and the interface is a scaled, shifted box
 * inside the page; dragging a window by raw client pixels moves it two and a
 * third times too far on a phone rendering a desktop layout.
 */
/**
 * The highest a window may be put, which is not always zero.
 *
 * On a narrow screen the status panel goes full width across the top, and a
 * window opened where a desktop would put it lands squarely on it — covering
 * the health bars, the clock and the light, which are the things somebody
 * keeps a window open to work *against*. Measured rather than written down,
 * because the panel's height depends on what is on you.
 */
export function uiFloor(): number {
  const ui = document.getElementById('ui');
  if (!ui?.classList.contains('narrow')) return 0;
  const status = ui.querySelector('.hud-status') as HTMLElement | null;
  if (!status) return 0;
  const floor = Math.round(status.offsetTop + status.offsetHeight + 8);
  /*
   * Unless there would be nothing left under it.
   *
   * A phone in landscape rendering a desktop layout leaves the interface about
   * a hundred and ninety of its own pixels tall, and a status panel takes most
   * of that. Keeping windows below it there means keeping them off the screen,
   * which is worse than letting them cover it.
   */
  return uiBox().h - floor < 200 ? 0 : floor;
}

export function uiPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
  return { x: (e.clientX - box.left) / box.scale, y: (e.clientY - box.top) / box.scale };
}

/**
 * Put the interface over the visible screen.
 *
 * Returns the scale it chose, which is 1 on anything ordinary.
 */
export function fitScreen(ui: HTMLElement): number {
  const vv = window.visualViewport;
  let w = vv?.width ?? window.innerWidth;
  let h = vv?.height ?? window.innerHeight;
  let left = vv?.offsetLeft ?? 0;
  let top = vv?.offsetTop ?? 0;

  /*
   * Scaled up only where the page is wider than a touchscreen would have made
   * it. A finger on a nine-hundred-pixel layout is a phone being told to
   * pretend, or a tablet being given a desktop's interface; a mouse on one is
   * a desktop, and a desktop wants its own pixels.
   */
  const touch = matchMedia('(pointer: coarse)').matches;
  const scaleFor = (w: number, h: number): { fit: number; scale: number } => {
    let fit = touch && w > NARROW ? Math.min(MAX_SCALE, w / TOUCH_UI_WIDTH, Math.max(w / TOUCH_UI_WIDE, h / TOUCH_UI_SHORT)) : 1;
    if (!Number.isFinite(fit) || fit <= 0) fit = 1;
    // Then the size asked for, as far as the screen leaves room for it. Smaller
    // is never refused, but on a touchscreen past `NARROW` it stops at a phone's width.
    let scale = fit * chosen;
    if (chosen > 1) scale = Math.min(scale, Math.max(fit, Math.min(w, h) / MIN_UI_SIDE));
    if (touch && w > NARROW) scale = Math.max(scale, w / TOUCH_UI_WIDE);
    return { fit, scale };
  };
  let { fit, scale } = scaleFor(w, h);
  phone = touch && w / scale <= NARROW;

  /*
   * The page is laid under the notch and the home bar (`viewport-fit=cover`).
   * A phone's HUD keeps its own edges in from them (`--sa-*`, in the
   * interface's pixels); anything else is put inside them, as it was before
   * the page went under them.
   */
  const sa = insets();
  if (!phone && sa.t + sa.r + sa.b + sa.l > 0) {
    left += sa.l;
    top += sa.t;
    w = Math.max(1, w - sa.l - sa.r);
    h = Math.max(1, h - sa.t - sa.b);
    ({ fit, scale } = scaleFor(w, h));
  }
  const k = phone ? 1 / scale : 0;
  ui.style.setProperty('--sa-t', `${sa.t * k}px`);
  ui.style.setProperty('--sa-r', `${sa.r * k}px`);
  ui.style.setProperty('--sa-b', `${sa.b * k}px`);
  ui.style.setProperty('--sa-l', `${sa.l * k}px`);
  ui.style.setProperty('--tap', `${TAP / scale}px`);

  ui.style.transformOrigin = '0 0';
  ui.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  ui.style.width = `${w / scale}px`;
  ui.style.height = `${h / scale}px`;
  ui.classList.toggle('narrow', w / scale <= NARROW);
  ui.classList.toggle('phone', phone);
  box = { w: w / scale, h: h / scale, scale, left, top, fit };
  return scale;
}

/**
 * Follow the screen for as long as the page is open.
 *
 * `visualViewport` fires while a pinch is in progress as well as after it, so
 * this keeps up with the gesture rather than jumping when it ends. The window
 * events are for browsers that have no `visualViewport` at all, where the two
 * viewports are the same thing and nothing is lost.
 */
export function followScreen(ui: HTMLElement, onChange?: (scale: number) => void): void {
  // Fitted first and told after: `onChange?.(fitScreen(ui))` skips the fit itself when nobody is told.
  const fit = (): void => {
    const scale = fitScreen(ui);
    onChange?.(scale);
  };
  const vv = window.visualViewport;
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  // The insets can change with nothing resized: a browser's bars coming and going.
  insets();
  if (probe) new ResizeObserver(fit).observe(probe, { box: 'border-box' });
  refit = fit;
  fit();
}

/** How far the page itself is zoomed in, 1 being not at all. */
export const pageZoom = (): number => window.visualViewport?.scale ?? 1;

/**
 * Put the page back to its own size.
 *
 * There is no API for this — a page may not set its own zoom — but a browser
 * re-reads the viewport meta when it changes, and a `maximum-scale` of one
 * makes it drop the zoom it is holding. Put back a moment later so that
 * pinching is allowed again afterwards: taking zoom away from somebody who
 * wants it is not the point, being stuck at it is.
 *
 * Does nothing where it does not work, which is the right amount of harm for a
 * trick like this.
 */
export function unzoomPage(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const had = meta.getAttribute('content') ?? 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  // Still under the notch and the home bar meanwhile (`fitScreen`).
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  window.setTimeout(() => meta.setAttribute('content', had), 350);
}
