/**
 * The keys a control reached with Tab keeps for itself: Tab moves on from it,
 * Enter and Space press it. Out of the box the game has all three (Mark the
 * nearest foe, Talk, Attack), and its handler on the window takes them before
 * the control's own default could, so a panel worked from the keyboard would
 * otherwise stop at its first button.
 *
 * Only while the control shows keyboard focus (`:focus-visible`): a button
 * that was clicked with the mouse keeps focus too, and Space then is Attack.
 */
const KEPT = new Set(['Tab', 'Enter', ' ']);

/** Keep those keys inside `el` for whichever of its controls matching `which` has keyboard focus, unless `not()` says otherwise. */
export function keepControlKeys(el: HTMLElement, which = 'button', not?: () => boolean): void {
  el.addEventListener('keydown', (e) => {
    if (!KEPT.has(e.key) || not?.()) return;
    if (e.target instanceof Element && e.target.matches(`:focus-visible:is(${which})`)) e.stopPropagation();
  });
}
