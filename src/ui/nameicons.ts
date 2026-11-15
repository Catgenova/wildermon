import { badgeIds, badgeTitle, isTrade, type NameBadges } from '../game/badges';
import { emblemSvg } from '../render/emblems';

/**
 * The trade and class icons before a name in a window: a line of chat, a row
 * of the Social window (`src/game/badges.ts`, `src/render/emblems.ts`).
 *
 * A span that holds them, kit part `rc-emblem` each, sized to the writing it
 * stands in; each with its name as its title. The span is there whether or
 * not anything is known yet, keyed by uid, so icons learned later are put in
 * it (`fillNameIcons`) without the line being drawn again.
 */

/** A box for somebody's icons, filled with what is known of them now. */
export function nameIcons(uid: string, b: NameBadges | undefined, on: boolean): HTMLSpanElement {
  const box = document.createElement('span');
  box.className = 'name-icons rc-emblems';
  box.dataset.by = uid;
  fillNameIcons(box, b, on);
  return box;
}

/** Put somebody's icons in their box, in place of whatever was there; empty for none, or with Name icons off. */
export function fillNameIcons(box: HTMLElement, b: NameBadges | undefined, on: boolean): void {
  const ids = badgeIds(b, on);
  const now = ids.join(' ');
  if (box.dataset.ids === now) return;
  box.dataset.ids = now;
  box.replaceChildren(...ids.map((id) => {
    const el = document.createElement('span');
    el.className = 'name-icon rc-emblem';
    el.dataset.emblem = id;
    el.title = badgeTitle(id);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', badgeTitle(id));
    el.append(emblemSvg(id, isTrade(id) ? 'stone' : 'shield'));
    return el;
  }));
}

/** Every icon box under `root` for these uids (all of them for null), filled again from `get`. */
export function refillNameIcons(root: ParentNode, uids: readonly string[] | null, get: (uid: string) => NameBadges | undefined, on: boolean): void {
  const want = uids ? new Set(uids) : null;
  for (const box of root.querySelectorAll<HTMLElement>('.name-icons[data-by]')) {
    const uid = box.dataset.by!;
    if (!want || want.has(uid)) fillNameIcons(box, get(uid), on);
  }
}
