import { CANNOT_SAVE, onSaving } from '../net/supabase';
import { underTopBars } from './notices';

/** How often the banner, while it is up, looks again for the bars it stands under, in milliseconds. */
const PLACE_EVERY = 1000;

/**
 * The line across the top of the screen while the island is refusing changes.
 *
 * Asked for after the database filled on 09-25: "Show players a banner
 * instead of a stream of failed actions." While it was read-only an action
 * went off to the island, was refused, and nothing on the screen said so:
 * the click did nothing, and the next one did nothing too. This says once
 * what is happening and stays until a door that was refused goes through.
 *
 * It stands under the toolbar and the status panel rather than over them, so
 * the buttons stay readable while it is up.
 */
export function mountSavingBanner(root: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'saving-banner';
  bar.setAttribute('role', 'alert');
  bar.textContent = CANNOT_SAVE;
  bar.hidden = true;
  root.append(bar);
  let timer = 0;
  const place = (): void => {
    bar.style.top = `${underTopBars(root, bar)}px`;
  };
  onSaving((saving) => {
    bar.hidden = saving;
    clearInterval(timer);
    if (saving) return;
    place();
    timer = window.setInterval(place, PLACE_EVERY);
  });
}
