/**
 * Whether this is a phone: a finger rather than a mouse, the same test
 * `src/ui/screen.ts` scales the interface by. Everything that exists only for
 * a phone (`src/ui/phone.ts`, Low power) asks here, so a desktop is never
 * told it is one.
 */
export const PHONE_QUERY = '(pointer: coarse)';

let query: MediaQueryList | null = null;

/** Asked once a frame by the renderer, so the query is made once and read live after that. */
export function onPhone(): boolean {
  if (typeof matchMedia !== 'function') return false;
  query ??= matchMedia(PHONE_QUERY);
  return query.matches;
}
