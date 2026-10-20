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
import { DEPLOY } from '../version';

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

/** The button, hidden until there is something newer; a build with no deploy number ("dev") never shows it. */
export function updateButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hud-update';
  btn.hidden = true;
  if (DEPLOY === undefined) return btn;
  const running = DEPLOY;

  let newest = running;
  const look = async (): Promise<void> => {
    const at = await siteDeploy();
    if (at === undefined || at <= newest) return;
    newest = at;
    btn.textContent = `Update to v${at}`;
    btn.title = `Running v${running}`;
    btn.hidden = false;
  };
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await fetch(location.href.split('#')[0], { cache: 'reload' });
    } catch {
      /* the reload below fetches it anyway */
    }
    location.reload();
  });
  setInterval(() => void look(), UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void look();
  });
  void look();
  return btn;
}
