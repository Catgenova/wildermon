/**
 * Which deploy of the site this is, as the corner of the screen shows it
 * before the frame rate: "v561" for the 561st. The build counts it and writes
 * it in (`deploy` in vite.config.ts). Anything that bundles these modules some
 * other way -- the Node tests, the tools -- or a build from a shallow clone,
 * with no history to count, says "dev".
 */
declare const __DEPLOY__: number | undefined;

/** The deploy as a number, or undefined for "dev". */
export const DEPLOY: number | undefined = typeof __DEPLOY__ === 'number' ? __DEPLOY__ : undefined;

export const VERSION: string = DEPLOY !== undefined ? `v${DEPLOY}` : 'dev';

/**
 * Which build of the site this is: the first 16 hex digits of the SHA-256 of
 * every script and stylesheet it serves (`harden()` in scripts/harden.mjs).
 * Said to the island at the join (`rpc_build_check`), which refuses a build
 * it does not know. Undefined anywhere else these modules are bundled.
 */
declare const __BUILD__: string | undefined;

export const BUILD: string | undefined =
  typeof __BUILD__ === 'string' && /^[0-9a-f]{16}$/.test(__BUILD__) ? __BUILD__ : undefined;

/** What the island says to a build it no longer takes, and what the boot card shows with its Reload. */
export const STALE_BUILD = 'Game updated. Reload.';

/** The join refused this build (`rpc_build_check`). */
export class StaleBuild extends Error {
  constructor() {
    super(STALE_BUILD);
  }
}

/**
 * A module this page fetches when it is first wanted -- a wildermon line's models, a voice, the help -- that did not come.
 *
 * A deploy puts the new build's files at the same addresses, and a page loaded before it still holds the old build's
 * hashes in its import map (scripts/sri.mjs): every module it had not loaded yet is refused from then on, and only a
 * reload mends it. A line refused was drawn as its name and health bar and no body, in the world and the Field guide,
 * with nothing said. Whoever is told (`whenModuleMissed`) asks the site which deploy it is on (`ui/update.ts`) and
 * writes it down (`net/errors.ts`).
 */
const missedTold: ((what: string, e: unknown) => void)[] = [];
/** How long a module that did not come is left before it is asked for again, in milliseconds: not every frame it is wanted. */
export const MISSED_RETRY_MS = 30_000;
export function whenModuleMissed(f: (what: string, e: unknown) => void): void {
  missedTold.push(f);
}
export function moduleMissed(what: string, e: unknown): void {
  for (const f of missedTold) f(what, e);
}
