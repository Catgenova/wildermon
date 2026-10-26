/**
 * The page `stonestart.ts` opens: the boot card as the game page has it, and
 * the first join's Runestone chooser (`pickStone`) put on it for the stones
 * `startChoices` gives. Driven through `window.stonestart`: `show(first,
 * size)` puts the chooser up for a join that is or is not the first on a world
 * that many tiles across, and says what is on the card; `pictures()` waits
 * for each stone's picture to be painted and says what is in each; `pick(id)`
 * clicks a stone, and says what the chooser answered.
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
      `${b.dataset.stone}|${b.querySelector('b')?.textContent}|${b.querySelector('.boot-stone-words > span')?.textContent}`),
    head: card.querySelector('.boot-stones-head')?.textContent ?? null,
    at_once: settled,
  };
}

export interface StonePictures {
  /** Each stone's picture, as `id|share`: how much of it is not its grass, nought to one (nought: no stone drawn). */
  painted: string[];
  /** Whether no two of the pictures are the same. */
  distinct: boolean;
}

/** Wait (a few seconds at most) until every picture has its stone in it, and say what each holds. */
async function pictures(): Promise<StonePictures> {
  const read = (): Array<{ id: string; share: number; data: Uint8ClampedArray }> =>
    [...card.querySelectorAll<HTMLButtonElement>('.boot-stone')].map((b) => {
      const c = b.querySelector('canvas');
      const g = c && c.width && c.height ? c.getContext('2d') : null;
      if (!c || !g) return { id: b.dataset.stone ?? '', share: 0, data: new Uint8ClampedArray() };
      const data = g.getImageData(0, 0, c.width, c.height).data;
      // The grass is the corner's colour: the share of the picture that is something else.
      let off = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 30) off++;
      }
      return { id: b.dataset.stone ?? '', share: off / (data.length / 4), data };
    });
  let now = read();
  for (let waited = 0; waited < 5000 && now.some((p) => p.share < 0.01); waited += 100) {
    await new Promise((r) => setTimeout(r, 100));
    now = read();
  }
  const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
  return {
    painted: now.map((p) => `${p.id}|${p.share.toFixed(3)}`),
    distinct: now.every((p, i) => now.every((q, j) => j <= i || !same(p.data, q.data))),
  };
}

async function pick(id: string): Promise<{ answered: RunestoneId | null; left: number }> {
  card.querySelector<HTMLButtonElement>(`.boot-stone[data-stone="${id}"]`)?.click();
  const answered = await answer;
  return { answered, left: card.querySelectorAll('.boot-stone').length };
}

(window as unknown as { stonestart: unknown }).stonestart = { show, pictures, pick };
