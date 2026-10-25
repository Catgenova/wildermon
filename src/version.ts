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
