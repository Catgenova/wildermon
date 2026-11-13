/**
 * Less motion: chosen in Settings (`motion`), or asked for by the system
 * (`prefers-reduced-motion`) while the setting follows it.
 *
 * One answer for the canvas and the windows alike. `applyLook` puts the choice
 * here every frame and writes `data-motion` on <html> for the stylesheet; the
 * renderer and the windows' own animations ask `lessMotion()`.
 */

export const MOTIONS = ['auto', 'less', 'full'] as const;
export type Motion = (typeof MOTIONS)[number];

let choice: Motion = 'auto';
/** The system's query, made once and read each time it is asked. */
let query: MediaQueryList | null | undefined;

/** Whether the system asks for less motion. */
export function systemLessMotion(): boolean {
  try {
    if (query === undefined) query = typeof window !== 'undefined' ? (window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null) : null;
    return query?.matches ?? false;
  } catch {
    return false;
  }
}

/** The setting, as Settings has it. */
export function setMotion(m: Motion): void {
  choice = m;
}

/** Whether less motion is drawn now: chosen, or the system's while the setting follows it. */
export const lessMotion = (): boolean => choice === 'less' || (choice === 'auto' && systemLessMotion());

/**
 * Animations off (`Settings.animations`, Settings: Performance): bodies, creatures and everything that moves on its own
 * held still, so a picture is drawn again only when what is in it changes. Put here by the renderer at the start of every
 * frame, and read by what draws the bodies (`src/render/figure.ts`, `src/sculpt/anim`), the creatures
 * (`src/render/beasts.ts`, `src/render/sprites.ts`) and the renderer itself. The windows are not touched.
 */
let held = false;

/** The setting, as the renderer has it this frame. */
export function setAnimations(on: boolean): void {
  held = !on;
}

/** Whether animations are off: every body and creature in a still pose, and nothing moving on its own. */
export const animationsOff = (): boolean => held;

/** Seconds on the clock what moves on its own is drawn at, for a drawing that keeps no clock of its own: held at nought while animations are off. */
export const animNow = (): number => (held ? 0 : performance.now() / 1000);
