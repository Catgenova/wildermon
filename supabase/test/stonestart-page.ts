/**
 * The page `stonestart.ts` opens: the boot card as the game page has it, and
 * the first join's Runestone chooser (`pickStone`) put on it for the stones
 * `startChoices` gives. Driven through `window.stonestart`: `show(first,
 * size)` puts the chooser up for a join that is or is not the first on a world
 * that many tiles across, and says what is on the card; `pick(id)` clicks a
 * stone, and says what the chooser answered.
 */
import { startChoices, type RunestoneId } from '../../src/game/runestones';
import { pickStone } from '../../src/ui/stonestart';

const boot = document.createElement('div');
boot.id = 'boot';
const card = document.createElement('div');
card.className = 'boot-card';
const name = document.createElement('div');
name.className = 'boot-name';
name.textContent = 'Wildermon';
card.append(name);
boot.append(card);
document.body.append(boot);

let answer: Promise<RunestoneId | null> = Promise.resolve(null);

export interface StoneCard {
  /** Each stone button on the card, as `id|name|place`. */
  stones: string[];
  /** What the chooser is headed, or null when there is none. */
  head: string | null;
  /** Whether the answer came at once (no chooser to wait on). */
  at_once: boolean;
}

async function show(first: boolean, size: number): Promise<StoneCard> {
  card.querySelector('.boot-stones')?.remove();
  answer = pickStone(card, startChoices(first, size));
  const settled = await Promise.race([answer.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 50))]);
  return {
    stones: [...card.querySelectorAll<HTMLButtonElement>('.boot-stone')].map((b) =>
      `${b.dataset.stone}|${b.querySelector('b')?.textContent}|${b.querySelector('span')?.textContent}`),
    head: card.querySelector('.boot-stones-head')?.textContent ?? null,
    at_once: settled,
  };
}

async function pick(id: string): Promise<{ answered: RunestoneId | null; left: number }> {
  card.querySelector<HTMLButtonElement>(`.boot-stone[data-stone="${id}"]`)?.click();
  const answered = await answer;
  return { answered, left: card.querySelectorAll('.boot-stone').length };
}

(window as unknown as { stonestart: unknown }).stonestart = { show, pick };
