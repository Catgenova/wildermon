/**
 * Logged on and logged off, as the island says them to everybody
 * (`private.presence_said`): a line of kind `presence`, written into Talk,
 * and the banner (`src/ui/deedbanner.ts`).
 */

export const LOGGED_ON = 'Logged on: ';
export const LOGGED_OFF = 'Logged off: ';
/** How old a line may be and still put the banner up, in milliseconds: an older one is caught up on, and goes into Talk only. */
export const PRESENCE_FRESH_MS = 60_000;

/** Who, and on or off, out of a `presence` line; null for anything else. */
export function presenceOf(text: string): { name: string; on: boolean } | null {
  const on = text.startsWith(LOGGED_ON);
  if (!on && !text.startsWith(LOGGED_OFF)) return null;
  const name = text.slice((on ? LOGGED_ON : LOGGED_OFF).length).trim();
  return name ? { name, on } : null;
}
