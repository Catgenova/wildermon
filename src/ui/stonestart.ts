/**
 * The Runestone a first join starts beside, picked on the boot card.
 *
 * Asked for: "new players should select between the 5 runestones for
 * spawning, and spawn 2 tiles away from that stone on selection". Somebody
 * with no body on the island yet is shown the five (`startChoices`), each
 * named with where on the inner bay it stands; the one clicked goes to the
 * island with the join (`Island.join`, `rpc_join`'s `p_stone`), which puts
 * the new body `START_GAP` tiles out from that stone's edge and says where.
 * Somebody coming back, or a test's world with no stones, is never shown it.
 *
 * Built a node at a time, with no markup: the page takes no HTML from a
 * string (src/page-guard.ts).
 */
import { START_GAP, type Runestone, type RunestoneId } from '../game/runestones';

/** What the chooser is headed. */
export const STONE_PICK_HEAD = `Starting Runestone: ${START_GAP} tiles from it`;

/**
 * Show the stones on `card` and wait for one to be clicked: its id. With no
 * stones to pick between, nothing is shown and the answer is null at once.
 */
export function pickStone(card: Element | null, stones: readonly Runestone[]): Promise<RunestoneId | null> {
  if (!card || !stones.length) return Promise.resolve(null);
  return new Promise((done) => {
    const box = document.createElement('div');
    box.className = 'boot-stones';
    const head = document.createElement('div');
    head.className = 'boot-stones-head';
    head.textContent = STONE_PICK_HEAD;
    box.append(head);
    for (const s of stones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'boot-stone';
      b.dataset.stone = s.id;
      const name = document.createElement('b');
      name.textContent = s.name;
      const place = document.createElement('span');
      place.textContent = s.place;
      b.append(name, place);
      b.addEventListener('click', () => {
        box.remove();
        done(s.id);
      });
      box.append(b);
    }
    card.append(box);
    (box.querySelector('button') as HTMLButtonElement | null)?.focus();
  });
}
