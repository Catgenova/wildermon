/**
 * The golden "Update to v…" button in the bottom-right corner.
 *
 * Asked for: "When a new version is available pending a browser refresh, add
 * a little golden Update version bottom right that will apply the update via
 * refresh to the current version". Every build writes assets/version.json with
 * its deploy number (vite.config.ts); a page asks for it now and then, and when
 * the site holds a later deploy than the one running, the button shows. A
 * click refreshes the page's own copy of index.html first, so the reload
 * cannot come back from the browser's cache as the old version.
 */
import { DEPLOY, STALE_BUILD, whenModuleMissed } from '../version';

/** How often an open page asks which deploy the site is on. */
export const UPDATE_CHECK_MS = 2 * 60_000;

async function siteDeploy(): Promise<number | undefined> {
  try {
    const res = await fetch(`./assets/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const { deploy } = (await res.json()) as { deploy?: unknown };
    return typeof deploy === 'number' ? deploy : undefined;
  } catch {
    return undefined;
  }
}

/** Reload the page, its own copy of index.html refreshed first so the reload cannot come back from the cache as the old version. */
export async function reloadFresh(): Promise<void> {
  try {
    await fetch(location.href.split('#')[0], { cache: 'reload' });
  } catch {
    /* the reload below fetches it anyway */
  }
  location.reload();
}

/** The button, hidden until there is something newer; a build with no deploy number ("dev") never shows it. */
export function updateButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hud-update';
  btn.hidden = true;
  if (DEPLOY === undefined) return btn;
  const running = DEPLOY;

  let newest = running;
  // A module this page had not loaded yet was refused (`moduleMissed`): with a later deploy on the site, it is this page
  // that is out of date, and the button says so rather than offering the update. A wildermon line refused is drawn as
  // its name and health bar with no body until the page is reloaded.
  let missed = false;
  const say = (): void => {
    if (newest <= running) return;
    btn.textContent = missed ? STALE_BUILD : `Update to v${newest}`;
    btn.classList.toggle('hud-stale', missed);
    btn.title = `Running v${running}`;
    btn.hidden = false;
  };
  let looking: Promise<void> | null = null;
  const look = (): Promise<void> => (looking ??= siteDeploy().then((at) => {
    if (at !== undefined && at > newest) newest = at;
    say();
  }).finally(() => {
    looking = null;
  }));
  whenModuleMissed(() => {
    missed = true;
    say();
    void look();
  });
  btn.addEventListener('click', () => {
    btn.disabled = true;
    void reloadFresh();
  });
  // Not while the page is hidden: it looks again as it comes back in front.
  setInterval(() => {
    if (document.visibilityState !== 'hidden') void look();
  }, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void look();
  });
  void look();
  return btn;
}
