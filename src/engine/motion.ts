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
